import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { HttpError, badRequest, conflict, notFound, tooLarge, unsupported } from './errors.js';
import { assertNotGitInternal, resolveInRoot, toRelativePath } from './safe-path.js';

export interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  children?: TreeNode[];
}

export interface SearchMatch {
  path: string;
  line: number;
  column: number;
  preview: string;
}

export interface SearchResult {
  query: string;
  matches: SearchMatch[];
  truncated: boolean;
}

/** Heavy or irrelevant directories are hidden from the explorer and search. */
const IGNORED_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  '.next',
  '.nuxt',
  '.svelte-kit',
  '.turbo',
  '.cache',
  '.vite',
  'dist',
  'dist-server',
  'build',
  'coverage',
  'release',
  'target',
  '__pycache__',
  '.venv',
  '.idea',
]);

const IGNORED_FILES = new Set(['.DS_Store', 'Thumbs.db']);

export function isIgnoredName(name: string, type: 'file' | 'directory'): boolean {
  if (type === 'directory') return IGNORED_DIRECTORIES.has(name);
  return IGNORED_FILES.has(name);
}

function statSafe(target: string): fs.Stats | null {
  try {
    return fs.statSync(target);
  } catch {
    return null;
  }
}

/** Build the explorer tree. Never follows symlinked directories. */
export function listTree(): TreeNode[] {
  const root = config.workspaceDir;
  let entryCount = 0;

  const walk = (absoluteDir: string, depth: number): TreeNode[] => {
    if (depth > config.limits.maxTreeDepth) return [];

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
    } catch {
      return [];
    }

    const nodes: TreeNode[] = [];
    for (const entry of entries) {
      if (entryCount >= config.limits.maxTreeEntries) break;

      const isDirectory = entry.isDirectory();
      if (!isDirectory && !entry.isFile() && !entry.isSymbolicLink()) continue;
      if (isIgnoredName(entry.name, isDirectory ? 'directory' : 'file')) continue;

      const absolute = path.join(absoluteDir, entry.name);
      const stats = statSafe(absolute);
      if (!stats) continue;
      if (stats.isSymbolicLink()) continue;

      entryCount += 1;
      const node: TreeNode = {
        name: entry.name,
        path: toRelativePath(root, absolute),
        type: stats.isDirectory() ? 'directory' : 'file',
      };

      if (stats.isDirectory()) {
        node.children = walk(absolute, depth + 1);
      } else {
        node.size = stats.size;
      }
      nodes.push(node);
    }

    return nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
  };

  return walk(root, 0);
}

function decodeUtf8(buffer: Buffer, relativePath: string): string {
  const probe = buffer.subarray(0, 8192);
  if (probe.includes(0)) {
    throw unsupported(`"${relativePath}" looks like a binary file and cannot be opened as text`);
  }
  return buffer.toString('utf8');
}

export function readTextFile(relativePath: unknown): { path: string; content: string; size: number } {
  const absolute = resolveInRoot(config.workspaceDir, relativePath);
  const stats = statSafe(absolute);

  if (!stats) throw notFound('File not found');
  if (stats.isDirectory()) throw badRequest('That path is a directory');
  if (stats.size > config.limits.maxFileBytes) {
    throw tooLarge(
      `File is ${(stats.size / 1024 / 1024).toFixed(1)} MB, above the ${config.limits.maxFileBytes / 1024 / 1024} MB editor limit`,
    );
  }

  const buffer = fs.readFileSync(absolute);
  return {
    path: toRelativePath(config.workspaceDir, absolute),
    content: decodeUtf8(buffer, toRelativePath(config.workspaceDir, absolute)),
    size: stats.size,
  };
}

/** Write atomically: temp file in the same directory, then rename. */
export function writeTextFile(relativePath: unknown, content: unknown): { path: string; size: number } {
  const relative = resolveRelativeForWrite(relativePath);
  if (typeof content !== 'string') throw badRequest('`content` must be a string');

  const bytes = Buffer.byteLength(content, 'utf8');
  if (bytes > config.limits.maxFileBytes) {
    throw tooLarge(`Content is above the ${config.limits.maxFileBytes / 1024 / 1024} MB limit`);
  }

  const absolute = resolveInRoot(config.workspaceDir, relative);
  const stats = statSafe(absolute);
  if (stats?.isDirectory()) throw badRequest('That path is a directory');

  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  const temporary = `${absolute}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temporary, content, 'utf8');
  fs.renameSync(temporary, absolute);

  return { path: relative, size: bytes };
}

function resolveRelativeForWrite(relativePath: unknown): string {
  const absolute = resolveInRoot(config.workspaceDir, relativePath);
  const relative = toRelativePath(config.workspaceDir, absolute);
  if (!relative) throw badRequest('Cannot write to the workspace root');
  assertNotGitInternal(relative);
  return relative;
}

export function createEntry(relativePath: unknown, type: 'file' | 'directory'): TreeNode {
  const relative = resolveRelativeForWrite(relativePath);
  const absolute = resolveInRoot(config.workspaceDir, relative);

  if (fs.existsSync(absolute)) throw conflict(`"${relative}" already exists`);

  if (type === 'directory') {
    fs.mkdirSync(absolute, { recursive: true });
  } else {
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, '', { flag: 'wx' });
  }

  return { name: path.basename(absolute), path: relative, type };
}

export function renameEntry(from: unknown, to: unknown): TreeNode {
  const fromRelative = resolveRelativeForWrite(from);
  const toRelative = resolveRelativeForWrite(to);
  const fromAbsolute = resolveInRoot(config.workspaceDir, fromRelative);
  const toAbsolute = resolveInRoot(config.workspaceDir, toRelative);

  if (!fs.existsSync(fromAbsolute)) throw notFound(`"${fromRelative}" does not exist`);
  if (fs.existsSync(toAbsolute)) throw conflict(`"${toRelative}" already exists`);
  if (toRelative.startsWith(`${fromRelative}/`)) {
    throw badRequest('Cannot move a folder inside itself');
  }

  fs.mkdirSync(path.dirname(toAbsolute), { recursive: true });
  fs.renameSync(fromAbsolute, toAbsolute);
  return { name: path.basename(toAbsolute), path: toRelative, type: 'file' };
}

export function deleteEntry(relativePath: unknown): { path: string } {
  const relative = resolveRelativeForWrite(relativePath);
  const absolute = resolveInRoot(config.workspaceDir, relative);
  if (!fs.existsSync(absolute)) throw notFound(`"${relative}" does not exist`);
  fs.rmSync(absolute, { recursive: true, force: true });
  return { path: relative };
}

/** Depth-first walk; `visit` returns false to stop the whole traversal. */
function walkFiles(absoluteDir: string, visit: (absolute: string) => boolean): boolean {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
  } catch {
    return true;
  }

  for (const entry of entries) {
    const isDirectory = entry.isDirectory();
    if (isIgnoredName(entry.name, isDirectory ? 'directory' : 'file')) continue;

    const absolute = path.join(absoluteDir, entry.name);
    let stats: fs.Stats;
    try {
      stats = fs.lstatSync(absolute);
    } catch {
      continue;
    }
    if (stats.isSymbolicLink()) continue;

    if (stats.isDirectory()) {
      if (!walkFiles(absolute, visit)) return false;
    } else if (stats.isFile()) {
      if (!visit(absolute)) return false;
    }
  }

  return true;
}

export function searchWorkspace(
  query: unknown,
  options: { caseSensitive?: boolean; path?: unknown } = {},
): SearchResult {
  if (typeof query !== 'string' || query.trim().length === 0) {
    throw badRequest('A search query is required');
  }
  if (query.length > 200) throw badRequest('Search query is too long');

  const root = config.workspaceDir;
  const scopeAbsolute = options.path ? resolveInRoot(root, options.path) : root;
  const caseSensitive = options.caseSensitive === true;
  const needle = caseSensitive ? query : query.toLowerCase();

  const matches: SearchMatch[] = [];
  let truncated = false;

  walkFiles(scopeAbsolute, (absolute) => {
    if (matches.length >= config.limits.maxSearchResults) {
      truncated = true;
      return false;
    }

    const stats = statSafe(absolute);
    if (!stats || stats.size > config.limits.maxSearchFileBytes) return true;

    let content: string;
    try {
      const buffer = fs.readFileSync(absolute);
      if (buffer.subarray(0, 4096).includes(0)) return true;
      content = buffer.toString('utf8');
    } catch {
      return true;
    }

    const lines = content.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index] ?? '';
      const haystack = caseSensitive ? line : line.toLowerCase();
      const column = haystack.indexOf(needle);
      if (column === -1) continue;

      matches.push({
        path: toRelativePath(root, absolute),
        line: index + 1,
        column: column + 1,
        preview: line.trim().slice(0, 240),
      });

      if (matches.length >= config.limits.maxSearchResults) {
        truncated = true;
        return false;
      }
    }
    return true;
  });

  return { query, matches, truncated };
}

export function isWorkspaceEmpty(): boolean {
  try {
    const entries = fs
      .readdirSync(config.workspaceDir)
      .filter((name) => !IGNORED_FILES.has(name));
    return entries.length === 0;
  } catch {
    return true;
  }
}

export function hasGitDirectory(): boolean {
  return fs.existsSync(path.join(config.workspaceDir, '.git'));
}

/** Resolve a path for serving preview assets, rejecting ignored folders. */
export function resolvePreviewPath(urlPath: string): string | null {
  const decoded = decodeURIComponent(urlPath);
  const relative = decoded.replace(/^\/+/, '');
  const segments = relative.split('/').filter(Boolean);
  if (segments.some((segment) => IGNORED_DIRECTORIES.has(segment))) return null;

  try {
    const absolute = resolveInRoot(config.workspaceDir, relative);
    if (!fs.existsSync(absolute) || fs.statSync(absolute).isDirectory()) return null;
    return absolute;
  } catch (error) {
    if (error instanceof HttpError) return null;
    throw error;
  }
}

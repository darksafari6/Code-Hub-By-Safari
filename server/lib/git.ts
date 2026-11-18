import fs from 'node:fs';
import path from 'node:path';
import git from 'isomorphic-git';
import httpClient from 'isomorphic-git/http/node';
import { config } from '../config.js';
import { badRequest, conflict, notFound } from './errors.js';
import type { GitFileEntry, StatusMatrixRow } from './git-status.js';
import { mapStatusMatrixRow } from './git-status.js';

export interface GitStatus {
  isRepo: boolean;
  branch: string | null;
  hasCommits: boolean;
  remote: string | null;
  files: GitFileEntry[];
}

export interface GitCommit {
  oid: string;
  shortOid: string;
  message: string;
  author: string;
  email: string;
  timestamp: number;
}

const dir = config.workspaceDir;

function assertRepo(): void {
  if (!fs.existsSync(path.join(dir, '.git'))) {
    throw badRequest('This workspace is not a git repository yet');
  }
}

async function currentBranch(): Promise<string | null> {
  try {
    const branch = await git.currentBranch({ fs, dir, fullname: false });
    return branch ?? null;
  } catch {
    return null;
  }
}

async function headOid(): Promise<string | null> {
  try {
    return await git.resolveRef({ fs, dir, ref: 'HEAD' });
  } catch {
    return null;
  }
}

async function remoteUrl(): Promise<string | null> {
  try {
    const url = await git.getConfig({ fs, dir, path: 'remote.origin.url' });
    return url ?? null;
  } catch {
    return null;
  }
}

function authCallback(token: string | null | undefined) {
  if (!token) return undefined;
  return () => ({ username: 'x-access-token', password: token });
}

/** List every file in the workspace that is not ignored, for empty-repo status. */
function listAllUntracked(): GitFileEntry[] {
  const results: GitFileEntry[] = [];
  const walk = (absoluteDir: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === '.git') continue;
      const absolute = path.join(absoluteDir, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
      } else if (entry.isFile()) {
        results.push({
          path: path.relative(dir, absolute).split(path.sep).join('/'),
          status: 'untracked',
          staged: false,
        });
      }
    }
  };
  walk(dir);
  return results;
}

export async function getStatus(): Promise<GitStatus> {
  if (!fs.existsSync(path.join(dir, '.git'))) {
    return { isRepo: false, branch: null, hasCommits: false, remote: null, files: [] };
  }

  const branch = await currentBranch();
  const head = await headOid();
  const remote = await remoteUrl();

  if (!head) {
    return {
      isRepo: true,
      branch,
      hasCommits: false,
      remote,
      files: listAllUntracked(),
    };
  }

  const matrix = (await git.statusMatrix({ fs, dir })) as StatusMatrixRow[];
  const files = matrix
    .map(mapStatusMatrixRow)
    .filter((entry) => entry.status !== 'unmodified')
    .sort((a, b) => a.path.localeCompare(b.path));

  return { isRepo: true, branch, hasCommits: true, remote, files };
}

export async function initRepository(): Promise<GitStatus> {
  if (fs.existsSync(path.join(dir, '.git'))) {
    throw conflict('This workspace is already a git repository');
  }
  await git.init({ fs, dir, defaultBranch: 'main' });
  return getStatus();
}

/**
 * Clone into a scratch directory first, then move the result into place, so a
 * failed clone never destroys the existing workspace.
 */
export async function cloneRepository(options: {
  url: string;
  token?: string | null;
  replace?: boolean;
}): Promise<GitStatus> {
  const { url, token, replace } = options;

  if (!/^https?:\/\/.+/i.test(url)) {
    throw badRequest('Only http(s) git URLs are supported (e.g. https://github.com/user/repo.git)');
  }
  if (fs.existsSync(path.join(dir, '.git'))) {
    throw conflict('This workspace is already a git repository. Delete .git first or use another workspace.');
  }

  const existing = fs
    .readdirSync(dir)
    .filter((name) => name !== '.DS_Store' && name !== 'Thumbs.db');

  if (existing.length > 0 && !replace) {
    throw conflict(
      'The workspace is not empty. Enable "replace workspace contents" to clone into it.',
    );
  }

  const scratch = path.join(config.root, '.safari', `clone-${Date.now()}`);
  fs.mkdirSync(scratch, { recursive: true });

  try {
    await git.clone({
      fs,
      http: httpClient,
      dir: scratch,
      url,
      singleBranch: true,
      depth: 1,
      ...(token ? { onAuth: authCallback(token) } : {}),
    });

    for (const name of fs.readdirSync(dir)) {
      if (name === '.DS_Store' || name === 'Thumbs.db') continue;
      fs.rmSync(path.join(dir, name), { recursive: true, force: true });
    }
    for (const name of fs.readdirSync(scratch)) {
      fs.renameSync(path.join(scratch, name), path.join(dir, name));
    }
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }

  return getStatus();
}

export async function stagePaths(paths: string[] | 'all'): Promise<GitStatus> {
  assertRepo();

  if (paths === 'all') {
    const matrix = (await git.statusMatrix({ fs, dir })) as StatusMatrixRow[];
    for (const [filePath, , workdir] of matrix) {
      if (workdir === 0) {
        await git.remove({ fs, dir, filepath: filePath }).catch(() => undefined);
      } else if (workdir === 2) {
        await git.add({ fs, dir, filepath: filePath });
      }
    }
  } else {
    for (const filePath of paths) {
      if (typeof filePath !== 'string' || filePath.length === 0) continue;
      if (fs.existsSync(path.join(dir, filePath))) {
        await git.add({ fs, dir, filepath: filePath });
      } else {
        await git.remove({ fs, dir, filepath: filePath });
      }
    }
  }

  return getStatus();
}

export async function unstagePaths(paths: string[]): Promise<GitStatus> {
  assertRepo();
  for (const filePath of paths) {
    await git.resetIndex({ fs, dir, filepath: filePath }).catch(() => undefined);
  }
  return getStatus();
}

export async function commit(options: {
  message: string;
  stageAll?: boolean;
  name?: string;
  email?: string;
}): Promise<{ oid: string; status: GitStatus }> {
  assertRepo();

  const message = options.message?.trim();
  if (!message) throw badRequest('A commit message is required');
  if (message.length > 5000) throw badRequest('Commit message is too long');

  if (options.stageAll) {
    await stagePaths('all');
  }

  const staged = await git.statusMatrix({ fs, dir });
  const hasStagedChanges = staged.some((row) => {
    const entry = mapStatusMatrixRow(row as StatusMatrixRow);
    return entry.staged;
  });

  if (!hasStagedChanges && !options.stageAll) {
    throw badRequest('Nothing staged yet. Stage changes first or enable "stage all".');
  }

  const oid = await git.commit({
    fs,
    dir,
    message,
    author: {
      name: options.name?.trim() || 'Safari Dev',
      email: options.email?.trim() || 'dev@safari.local',
    },
  });

  return { oid, status: await getStatus() };
}

export async function getLog(limit = 25): Promise<GitCommit[]> {
  if (!fs.existsSync(path.join(dir, '.git'))) return [];
  try {
    const commits = await git.log({ fs, dir, depth: Math.min(Math.max(limit, 1), 100) });
    return commits.map((entry) => ({
      oid: entry.oid,
      shortOid: entry.oid.slice(0, 7),
      message: entry.commit.message.trim(),
      author: entry.commit.author.name,
      email: entry.commit.author.email,
      timestamp: entry.commit.author.timestamp * 1000,
    }));
  } catch {
    // Empty repository (no commits yet) is a normal state, not an error.
    return [];
  }
}

export async function push(options: {
  token?: string | null;
  remote?: string;
  ref?: string;
  force?: boolean;
}): Promise<{ ok: true }> {
  assertRepo();

  if (!options.token) {
    throw badRequest(
      'A personal access token is required to push. Public read-only remotes can still be cloned.',
    );
  }

  const branch = options.ref ?? (await currentBranch());
  if (!branch) throw badRequest('Cannot push from a detached HEAD');

  const remote = options.remote ?? 'origin';
  const remotes = await git.listRemotes({ fs, dir });
  if (!remotes.some((entry) => entry.remote === remote)) {
    throw notFound(`Remote "${remote}" is not configured for this repository`);
  }

  await git.push({
    fs,
    http: httpClient,
    dir,
    remote,
    ref: branch,
    force: options.force === true,
    onAuth: authCallback(options.token),
  });

  return { ok: true };
}

export async function listBranches(): Promise<{ branches: string[]; current: string | null }> {
  if (!fs.existsSync(path.join(dir, '.git'))) return { branches: [], current: null };
  const branches = await git.listBranches({ fs, dir }).catch(() => []);
  return { branches, current: await currentBranch() };
}

export async function addRemote(url: string): Promise<void> {
  assertRepo();
  if (!/^https?:\/\/.+/i.test(url)) throw badRequest('Only http(s) URLs are supported');
  await git.addRemote({ fs, dir, remote: 'origin', url, force: true });
}

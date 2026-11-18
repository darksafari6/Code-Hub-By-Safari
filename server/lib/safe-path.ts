import fs from 'node:fs';
import path from 'node:path';
import { HttpError } from './errors.js';

/**
 * Convert any incoming path into a normalised, workspace-relative path.
 *
 * Rejects NUL bytes and refuses to climb above the workspace root. Accepts
 * both `/` and `\` separators because they arrive from different clients.
 */
export function normalizeRelativePath(input: unknown): string {
  if (typeof input !== 'string') {
    throw new HttpError(400, 'A path is required');
  }
  if (input.includes('\0')) {
    throw new HttpError(400, 'Path contains invalid characters');
  }

  const unified = input.replace(/\\/g, '/');
  const parts: string[] = [];

  for (const segment of unified.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      if (parts.length === 0) {
        throw new HttpError(400, 'Path escapes the workspace');
      }
      parts.pop();
      continue;
    }
    parts.push(segment);
  }

  return parts.join('/');
}

function isInside(root: string, candidate: string): boolean {
  return candidate === root || candidate.startsWith(root + path.sep);
}

/**
 * Resolve a user supplied path to an absolute path inside `root`.
 *
 * Two layers of protection:
 *  1. lexical check — the resolved path must stay under the root;
 *  2. symlink check — the closest existing ancestor, after `realpath`, must
 *     still be under the (real) root, so a symlink inside the workspace
 *     cannot be used to read `/etc`.
 */
export function resolveInRoot(root: string, input: unknown): string {
  const rootAbs = path.resolve(root);
  const relative = normalizeRelativePath(input);
  const absolute = relative ? path.resolve(rootAbs, relative) : rootAbs;

  if (!isInside(rootAbs, absolute)) {
    throw new HttpError(400, 'Path escapes the workspace');
  }

  let existing = absolute;
  while (!fs.existsSync(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) break;
    existing = parent;
  }

  if (fs.existsSync(existing)) {
    const realRoot = fs.realpathSync(rootAbs);
    const realExisting = fs.realpathSync(existing);
    if (!isInside(realRoot, realExisting)) {
      throw new HttpError(400, 'Path escapes the workspace');
    }
  }

  return absolute;
}

/** Absolute path -> workspace-relative path with a leading slash removed. */
export function toRelativePath(root: string, absolute: string): string {
  const rootAbs = path.resolve(root);
  const relative = path.relative(rootAbs, path.resolve(absolute));
  return relative.split(path.sep).join('/');
}

/** The git directory must never be mutated through the generic file API. */
export function assertNotGitInternal(relativePath: string): void {
  const first = relativePath.split('/')[0];
  if (first === '.git') {
    throw new HttpError(403, 'The .git directory cannot be modified through the file API');
  }
}

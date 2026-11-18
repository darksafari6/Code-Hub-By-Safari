import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { normalizeRelativePath, resolveInRoot, toRelativePath } from '../server/lib/safe-path';

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'safari-safe-path-'));
const root = path.join(sandbox, 'workspace');
fs.mkdirSync(path.join(root, 'src'), { recursive: true });
fs.writeFileSync(path.join(root, 'src', 'index.ts'), 'export {};');
fs.mkdirSync(path.join(sandbox, 'outside'), { recursive: true });
fs.writeFileSync(path.join(sandbox, 'outside', 'secret.txt'), 'nope');
fs.symlinkSync(path.join(sandbox, 'outside'), path.join(root, 'escape-link'));

afterAll(() => {
  fs.rmSync(sandbox, { recursive: true, force: true });
});

describe('normalizeRelativePath', () => {
  it('normalises separators and redundant segments', () => {
    expect(normalizeRelativePath('src/./index.ts')).toBe('src/index.ts');
    expect(normalizeRelativePath('/src//index.ts')).toBe('src/index.ts');
    expect(normalizeRelativePath('src\\nested\\file.ts')).toBe('src/nested/file.ts');
  });

  it('resolves inner traversal but refuses to leave the root', () => {
    expect(normalizeRelativePath('src/../package.json')).toBe('package.json');
    expect(() => normalizeRelativePath('../package.json')).toThrow(/escapes/);
    expect(() => normalizeRelativePath('src/../../etc/passwd')).toThrow(/escapes/);
  });

  it('rejects malformed input', () => {
    expect(() => normalizeRelativePath(undefined)).toThrow(/required/);
    expect(() => normalizeRelativePath('bad\0path')).toThrow(/invalid/);
  });
});

describe('resolveInRoot', () => {
  it('resolves paths inside the root', () => {
    expect(resolveInRoot(root, 'src/index.ts')).toBe(path.join(root, 'src/index.ts'));
    expect(resolveInRoot(root, '')).toBe(path.resolve(root));
  });

  it('blocks traversal attempts', () => {
    expect(() => resolveInRoot(root, '../outside/secret.txt')).toThrow(/escapes/);
    expect(() => resolveInRoot(root, 'src/../../outside/secret.txt')).toThrow(/escapes/);
  });

  it('blocks symlink escapes', () => {
    expect(() => resolveInRoot(root, 'escape-link/secret.txt')).toThrow(/escapes/);
  });
});

describe('toRelativePath', () => {
  it('returns forward-slash relative paths', () => {
    expect(toRelativePath(root, path.join(root, 'src', 'index.ts'))).toBe('src/index.ts');
  });
});

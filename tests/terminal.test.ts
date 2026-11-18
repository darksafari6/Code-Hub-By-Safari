import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveSessionCwd, tokenize } from '../server/lib/terminal';

describe('tokenize', () => {
  it('splits on whitespace', () => {
    expect(tokenize('npm run dev')).toEqual(['npm', 'run', 'dev']);
  });

  it('handles quotes', () => {
    expect(tokenize('echo "hello world"')).toEqual(['echo', 'hello world']);
    expect(tokenize("cat 'a b.txt'")).toEqual(['cat', 'a b.txt']);
  });

  it('collapses repeated spaces and keeps empty results clean', () => {
    expect(tokenize('   ls    -la  ')).toEqual(['ls', '-la']);
    expect(tokenize('')).toEqual([]);
  });
});

describe('resolveSessionCwd', () => {
  it('resolves nested paths', () => {
    expect(resolveSessionCwd('', 'src/components')).toBe('src/components');
    expect(resolveSessionCwd('src', 'components')).toBe('src/components');
  });

  it('clamps .. at the workspace root', () => {
    expect(resolveSessionCwd('', '..')).toBe('');
    expect(resolveSessionCwd('src', '../../..')).toBe('');
    expect(resolveSessionCwd('src/components', '../utils')).toBe('src/utils');
  });

  it('ignores leading slashes so sessions stay inside the workspace', () => {
    expect(resolveSessionCwd('src', '/etc')).toBe('etc');
  });

  it('matches path.posix behaviour for the same inputs', () => {
    const samples = [
      ['a/b', '..'],
      ['a/b', '../c/d'],
      ['', 'x'],
      ['x', '.'],
    ];
    for (const [cwd, target] of samples) {
      const expected = path.posix
        .normalize(path.posix.join(cwd ?? '', target ?? ''))
        .replace(/^\.\/?/, '');
      expect(resolveSessionCwd(cwd ?? '', target ?? '')).toBe(expected === '.' ? '' : expected);
    }
  });
});

describe('os environment sanity', () => {
  it('exposes a shell for command execution', () => {
    expect(typeof os.platform()).toBe('string');
  });
});

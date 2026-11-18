import { describe, expect, it } from 'vitest';
import { isValidBranchName } from '../server/lib/git';

describe('isValidBranchName', () => {
  it('accepts normal branch names', () => {
    for (const name of ['main', 'feature/login', 'fix-123', 'release/2.1.0', 'user.name/x_y']) {
      expect(isValidBranchName(name)).toBe(true);
    }
  });

  it('rejects path traversal and shell-hostile names', () => {
    for (const name of ['../evil', 'a..b', '-rf', 'feature/', '.hidden', 'a b', 'x;rm -rf', 'a.lock', '']) {
      expect(isValidBranchName(name)).toBe(false);
    }
  });

  it('rejects non-strings', () => {
    expect(isValidBranchName(undefined)).toBe(false);
    expect(isValidBranchName(42)).toBe(false);
    expect(isValidBranchName(null)).toBe(false);
  });
});

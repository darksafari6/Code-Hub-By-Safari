import { describe, expect, it } from 'vitest';
import { mapStatusMatrixRow, statusCode } from '../server/lib/git-status';

describe('mapStatusMatrixRow', () => {
  it('maps an untracked file', () => {
    expect(mapStatusMatrixRow(['a.txt', 0, 2, 0])).toEqual({
      path: 'a.txt',
      status: 'untracked',
      staged: false,
    });
  });

  it('maps a staged new file', () => {
    expect(mapStatusMatrixRow(['a.txt', 0, 2, 3])).toEqual({
      path: 'a.txt',
      status: 'added',
      staged: true,
    });
  });

  it('maps an unstaged modification', () => {
    expect(mapStatusMatrixRow(['a.txt', 1, 2, 1])).toEqual({
      path: 'a.txt',
      status: 'modified',
      staged: false,
    });
  });

  it('maps a staged modification', () => {
    expect(mapStatusMatrixRow(['a.txt', 1, 2, 3])).toEqual({
      path: 'a.txt',
      status: 'modified',
      staged: true,
    });
  });

  it('maps an unstaged deletion', () => {
    expect(mapStatusMatrixRow(['a.txt', 1, 0, 1])).toEqual({
      path: 'a.txt',
      status: 'deleted',
      staged: false,
    });
  });

  it('maps a staged deletion', () => {
    expect(mapStatusMatrixRow(['a.txt', 1, 0, 0])).toEqual({
      path: 'a.txt',
      status: 'deleted',
      staged: true,
    });
  });

  it('maps an unmodified file', () => {
    expect(mapStatusMatrixRow(['a.txt', 1, 1, 1])).toEqual({
      path: 'a.txt',
      status: 'unmodified',
      staged: false,
    });
  });
});

describe('statusCode', () => {
  it('produces single letter codes', () => {
    expect(statusCode({ path: 'a', status: 'added', staged: true })).toBe('A');
    expect(statusCode({ path: 'a', status: 'modified', staged: false })).toBe('M');
    expect(statusCode({ path: 'a', status: 'deleted', staged: true })).toBe('D');
    expect(statusCode({ path: 'a', status: 'untracked', staged: false })).toBe('U');
  });
});

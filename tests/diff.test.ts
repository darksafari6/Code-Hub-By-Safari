import { describe, expect, it } from 'vitest';
import { computeLineDiff } from '../src/lib/diff';

describe('computeLineDiff', () => {
  it('reports no hunks for identical input', () => {
    const text = 'alpha\nbeta\ngamma\n';
    const result = computeLineDiff(text, text);

    expect(result.hunks).toHaveLength(0);
    expect(result.added).toBe(0);
    expect(result.removed).toBe(0);
    expect(result.wholeFile).toBe(false);
  });

  it('detects an added line', () => {
    const result = computeLineDiff('one\ntwo\n', 'one\ntwo\nthree\n');

    expect(result.added).toBe(1);
    expect(result.removed).toBe(0);
    expect(result.hunks).toHaveLength(1);

    const added = result.hunks[0]?.lines.filter((line) => line.type === 'added') ?? [];
    expect(added.map((line) => line.text)).toEqual(['three']);
    expect(added[0]?.newLine).toBe(3);
    expect(added[0]?.oldLine).toBeNull();
  });

  it('detects a removed line', () => {
    const result = computeLineDiff('keep\ndrop\nkeep2\n', 'keep\nkeep2\n');

    expect(result.removed).toBe(1);
    expect(result.added).toBe(0);
    expect(result.hunks[0]?.lines.some(( line) => line.type === 'removed' && line.text === 'drop')).toBe(true);
  });

  it('represents a modification as remove plus add', () => {
    const result = computeLineDiff('const a = 1;\n', 'const a = 2;\n');

    expect(result.removed).toBe(1);
    expect(result.added).toBe(1);

    const types = result.hunks[0]?.lines.map((line) => line.type) ?? [];
    expect(types).toContain('removed');
    expect(types).toContain('added');
  });

  it('keeps unchanged context lines around a change', () => {
    const before = Array.from({ length: 20 }, (_, index) => `line ${index + 1}`).join('\n');
    const after = before.replace('line 10', 'line ten');
    const result = computeLineDiff(`${before}\n`, `${after}\n`, 2);

    expect(result.hunks).toHaveLength(1);
    const contextLines = result.hunks[0]?.lines.filter((line) => line.type === 'context') ?? [];
    expect(contextLines.length).toBe(4);
    expect(result.hunks[0]?.header).toMatch(/^@@ -\d+,\d+ \+\d+,\d+ @@$/);
  });

  it('splits distant changes into separate hunks', () => {
    const lines = Array.from({ length: 40 }, (_, index) => `line ${index + 1}`);
    const changed = [...lines];
    changed[2] = 'changed top';
    changed[35] = 'changed bottom';

    const result = computeLineDiff(lines.join('\n'), changed.join('\n'), 2);

    expect(result.hunks.length).toBe(2);
  });

  it('falls back to a whole-file diff for very large inputs', () => {
    const before = Array.from({ length: 3000 }, (_, index) => `a${index}`).join('\n');
    const after = Array.from({ length: 3000 }, (_, index) => `b${index}`).join('\n');
    const result = computeLineDiff(before, after);

    expect(result.wholeFile).toBe(true);
    expect(result.hunks).toHaveLength(1);
    expect(result.added).toBe(3000);
    expect(result.removed).toBe(3000);
  });

  it('handles empty files on either side', () => {
    const added = computeLineDiff('', 'first\nsecond\n');
    expect(added.added).toBe(2);
    expect(added.removed).toBe(0);

    const removed = computeLineDiff('only\n', '');
    expect(removed.removed).toBe(1);
    expect(removed.added).toBe(0);
  });
});

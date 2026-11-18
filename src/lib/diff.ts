export type DiffLineType = 'context' | 'added' | 'removed';

export interface DiffLine {
  type: DiffLineType;
  text: string;
  oldLine: number | null;
  newLine: number | null;
}

export interface DiffHunk {
  header: string;
  lines: DiffLine[];
}

export interface DiffResult {
  hunks: DiffHunk[];
  added: number;
  removed: number;
  /** True when the inputs were too large or different, and a full replace is shown. */
  wholeFile: boolean;
}

interface Operation {
  type: DiffLineType;
  text: string;
  oldLine: number | null;
  newLine: number | null;
}

const MAX_LINES = 2500;
const MAX_CELLS = 4_000_000;

function splitLines(text: string): string[] {
  if (text === '') return [];
  const lines = text.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/**
 * Line-based diff (longest common subsequence). Deliberately small and
 * dependency-free; falls back to a whole-file replacement for inputs that would
 * make the LCS table too large.
 */
export function computeLineDiff(
  oldText: string,
  newText: string,
  contextLines = 3,
): DiffResult {
  const oldLines = splitLines(oldText);
  const newLines = splitLines(newText);

  const tooLarge =
    oldLines.length > MAX_LINES ||
    newLines.length > MAX_LINES ||
    oldLines.length * newLines.length > MAX_CELLS;

  if (tooLarge) {
    const lines: DiffLine[] = [
      ...oldLines.map<DiffLine>((text, index) => ({
        type: 'removed',
        text,
        oldLine: index + 1,
        newLine: null,
      })),
      ...newLines.map<DiffLine>((text, index) => ({
        type: 'added',
        text,
        oldLine: null,
        newLine: index + 1,
      })),
    ];
    return {
      hunks: lines.length > 0 ? [{ header: '@@ full file @@', lines }] : [],
      added: newLines.length,
      removed: oldLines.length,
      wholeFile: true,
    };
  }

  const n = oldLines.length;
  const m = newLines.length;

  // dp[i][j] = LCS length of oldLines[i..] and newLines[j..]
  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i -= 1) {
    const row = dp[i];
    const nextRow = dp[i + 1];
    if (!row || !nextRow) continue;
    for (let j = m - 1; j >= 0; j -= 1) {
      row[j] =
        oldLines[i] === newLines[j]
          ? (nextRow[j + 1] ?? 0) + 1
          : Math.max(nextRow[j] ?? 0, row[j + 1] ?? 0);
    }
  }

  const operations: Operation[] = [];
  let added = 0;
  let removed = 0;
  let i = 0;
  let j = 0;

  while (i < n && j < m) {
    if (oldLines[i] === newLines[j]) {
      operations.push({
        type: 'context',
        text: oldLines[i] ?? '',
        oldLine: i + 1,
        newLine: j + 1,
      });
      i += 1;
      j += 1;
      continue;
    }

    const skipOld = dp[i + 1]?.[j] ?? 0;
    const skipNew = dp[i]?.[j + 1] ?? 0;

    if (skipOld >= skipNew) {
      operations.push({
        type: 'removed',
        text: oldLines[i] ?? '',
        oldLine: i + 1,
        newLine: null,
      });
      removed += 1;
      i += 1;
    } else {
      operations.push({
        type: 'added',
        text: newLines[j] ?? '',
        oldLine: null,
        newLine: j + 1,
      });
      added += 1;
      j += 1;
    }
  }

  while (i < n) {
    operations.push({
      type: 'removed',
      text: oldLines[i] ?? '',
      oldLine: i + 1,
      newLine: null,
    });
    removed += 1;
    i += 1;
  }

  while (j < m) {
    operations.push({
      type: 'added',
      text: newLines[j] ?? '',
      oldLine: null,
      newLine: j + 1,
    });
    added += 1;
    j += 1;
  }

  return { hunks: groupHunks(operations, contextLines), added, removed, wholeFile: false };
}

function groupHunks(operations: Operation[], contextLines: number): DiffHunk[] {
  const changedIndexes = operations
    .map((operation, index) => (operation.type === 'context' ? -1 : index))
    .filter((index) => index >= 0);

  if (changedIndexes.length === 0) return [];

  const ranges: Array<[number, number]> = [];
  for (const index of changedIndexes) {
    const start = Math.max(0, index - contextLines);
    const end = Math.min(operations.length - 1, index + contextLines);
    const previous = ranges[ranges.length - 1];

    if (previous && start <= previous[1] + 1) {
      previous[1] = Math.max(previous[1], end);
    } else {
      ranges.push([start, end]);
    }
  }

  return ranges.map(([start, end]) => {
    const lines = operations.slice(start, end + 1);
    const first = lines[0];
    const oldStart = first?.oldLine ?? 1;
    const newStart = first?.newLine ?? 1;
    const oldCount = lines.filter((line) => line.type !== 'added').length;
    const newCount = lines.filter((line) => line.type !== 'removed').length;

    return {
      header: `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`,
      lines,
    };
  });
}

export type GitFileStatus = 'added' | 'modified' | 'deleted' | 'untracked' | 'unmodified';

export interface GitFileEntry {
  path: string;
  status: GitFileStatus;
  staged: boolean;
}

export type StatusMatrixRow = [string, number, number, number];

/**
 * Translate one isomorphic-git `statusMatrix` row into a UI friendly entry.
 *
 * The matrix columns mean:
 *   HEAD    — 0 absent, 1 identical, 2 different
 *   WORKDIR — 0 absent, 1 identical, 2 different
 *   STAGE   — 0 absent, 1 identical to HEAD, 2 different from HEAD, 3 in index
 */
export function mapStatusMatrixRow(row: StatusMatrixRow): GitFileEntry {
  const [filePath, head, workdir, stage] = row;

  if (head === 0) {
    if (stage === 3) {
      // Added to the index; if it also vanished from disk it is a staged delete.
      return workdir === 0
        ? { path: filePath, status: 'deleted', staged: true }
        : { path: filePath, status: 'added', staged: true };
    }
    if (workdir === 2) {
      return { path: filePath, status: 'untracked', staged: false };
    }
    return { path: filePath, status: 'unmodified', staged: false };
  }

  if (workdir === 0) {
    // Gone from the working directory. Only a staged removal has STAGE 0.
    return { path: filePath, status: 'deleted', staged: stage === 0 };
  }

  if (stage === 3) {
    return { path: filePath, status: 'modified', staged: true };
  }

  if (workdir === 2) {
    return { path: filePath, status: 'modified', staged: false };
  }

  return { path: filePath, status: 'unmodified', staged: false };
}

/** Short, familiar one-letter status codes for the UI. */
export function statusCode(entry: GitFileEntry): string {
  switch (entry.status) {
    case 'added':
      return 'A';
    case 'modified':
      return 'M';
    case 'deleted':
      return 'D';
    case 'untracked':
      return 'U';
    default:
      return '';
  }
}

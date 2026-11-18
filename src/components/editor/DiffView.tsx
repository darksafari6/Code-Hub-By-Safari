import { useMemo } from 'react';
import { computeLineDiff } from '../../lib/diff';
import type { FileDiff } from '../../lib/types';
import { basename } from '../../lib/utils';
import { Button } from '../ui/Button';

interface DiffViewProps {
  diff: FileDiff | null;
  loading: boolean;
  onClose: () => void;
  onReload: () => void;
  onDiscard: () => void;
}

export function DiffView({ diff, loading, onClose, onReload, onDiscard }: DiffViewProps) {
  const result = useMemo(() => {
    if (!diff) return null;
    return computeLineDiff(diff.oldContent, diff.newContent);
  }, [diff]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[color:var(--bg)]">
      <header className="flex shrink-0 items-center gap-3 border-b border-[color:var(--border)] px-3 py-2">
        <span className="truncate text-[12px] font-medium text-[color:var(--text)]">
          {diff ? basename(diff.path) : 'Diff'}
          {diff && (
            <span className="ml-2 font-normal text-[color:var(--text-dim)]">{diff.path}</span>
          )}
        </span>

        {result && !diff?.binary && (
          <span className="shrink-0 font-mono text-[11px]">
            <span className="text-emerald-400">+{result.added}</span>{' '}
            <span className="text-rose-400">-{result.removed}</span>
          </span>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          <Button size="sm" variant="ghost" onClick={onReload} disabled={loading} title="Refresh diff">
            {loading ? 'Loading…' : 'Refresh'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDiscard}
            disabled={!diff}
            title="Restore this file from HEAD"
            className="text-rose-400"
          >
            Discard
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose} title="Close diff">
            Close
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto font-mono text-[12px] leading-[1.6]">
        {!diff && (
          <div className="p-6 text-[color:var(--text-dim)]">
            {loading ? 'Generating diff…' : 'Select a changed file to view its diff.'}
          </div>
        )}

        {diff?.binary && (
          <div className="p-6 text-[color:var(--text-muted)]">
            {diff.path} is a binary file, so no textual diff can be shown.
          </div>
        )}

        {diff && !diff.binary && result && result.hunks.length === 0 && (
          <div className="p-6 text-[color:var(--text-muted)]">No changes relative to HEAD.</div>
        )}

        {diff?.truncated && (
          <div className="border-b border-[color:var(--border)] bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-300">
            This file is too large for a complete diff; only the first 400 KB are shown.
          </div>
        )}

        {diff &&
          !diff.binary &&
          result?.hunks.map((hunk) => (
            <div key={hunk.header} className="border-b border-[color:var(--border)] last:border-b-0">
              <div className="sticky top-0 bg-[color:var(--bg-elevated)] px-3 py-1 text-[11px] text-[color:var(--text-dim)]">
                {hunk.header}
              </div>
              {hunk.lines.map((line, index) => (
                <div
                  key={`${hunk.header}-${index}`}
                  className={
                    line.type === 'added'
                      ? 'flex bg-emerald-500/10'
                      : line.type === 'removed'
                        ? 'flex bg-rose-500/10'
                        : 'flex'
                  }
                >
                  <span className="w-12 shrink-0 select-none px-2 text-right text-[color:var(--text-dim)]">
                    {line.oldLine ?? ''}
                  </span>
                  <span className="w-12 shrink-0 select-none px-2 text-right text-[color:var(--text-dim)]">
                    {line.newLine ?? ''}
                  </span>
                  <span
                    className={
                      line.type === 'added'
                        ? 'w-4 shrink-0 select-none text-emerald-400'
                        : line.type === 'removed'
                          ? 'w-4 shrink-0 select-none text-rose-400'
                          : 'w-4 shrink-0 select-none text-transparent'
                    }
                  >
                    {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ''}
                  </span>
                  <span className="whitespace-pre-wrap break-all pr-4 text-[color:var(--text)]">
                    {line.text || ' '}
                  </span>
                </div>
              ))}
            </div>
          ))}
      </div>
    </div>
  );
}

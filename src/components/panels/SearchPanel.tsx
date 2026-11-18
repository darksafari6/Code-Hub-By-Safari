import { useEffect, useRef, useState } from 'react';
import { CaseSensitive, Loader2, Search as SearchIcon } from 'lucide-react';
import { api } from '../../lib/api';
import type { SearchResult } from '../../lib/types';
import { basename, cn } from '../../lib/utils';
import { IconButton } from '../ui/IconButton';

interface SearchPanelProps {
  onOpen: (path: string, line: number, column: number) => void;
}

export function SearchPanel({ onOpen }: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResult(null);
      setLoading(false);
      setError(null);
      return;
    }

    const currentRequest = ++requestId.current;
    setLoading(true);
    setError(null);

    const timer = window.setTimeout(async () => {
      try {
        const searchResult = await api.files.search(trimmed, caseSensitive);
        if (currentRequest === requestId.current) setResult(searchResult);
      } catch (searchError) {
        if (currentRequest === requestId.current) {
          setError((searchError as Error).message);
          setResult(null);
        }
      } finally {
        if (currentRequest === requestId.current) setLoading(false);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [query, caseSensitive]);

  const grouped = new Map<string, SearchResult['matches']>();
  for (const match of result?.matches ?? []) {
    const existing = grouped.get(match.path) ?? [];
    existing.push(match);
    grouped.set(match.path, existing);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 border-b border-line px-2.5 py-2">
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <SearchIcon
              size={13}
              className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-faint"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search in files"
              autoFocus
              className="h-8 w-full rounded-md border border-line bg-app pl-7 pr-2 text-[12.5px] text-ink outline-none placeholder:text-faint focus:border-accent"
            />
          </div>
          <IconButton
            label="Match case"
            size="sm"
            active={caseSensitive}
            onClick={() => setCaseSensitive((value) => !value)}
          >
            <CaseSensitive size={15} />
          </IconButton>
        </div>
        <p className="px-1 text-[11px] text-faint">
          {loading
            ? 'Searching…'
            : result
              ? `${result.matches.length}${result.truncated ? '+' : ''} result${
                  result.matches.length === 1 ? '' : 's'
                } in ${grouped.size} file${grouped.size === 1 ? '' : 's'}`
              : 'Type at least two characters'}
        </p>
      </div>

      <div className="scrollbar-thin flex-1 overflow-y-auto">
        {loading && !result && (
          <div className="flex justify-center py-8">
            <Loader2 size={16} className="animate-spin text-faint" />
          </div>
        )}

        {error && (
          <p className="px-3 py-4 text-[12px] text-danger">{error}</p>
        )}

        {!loading && !error && result && result.matches.length === 0 && (
          <p className="px-3 py-6 text-center text-[12px] text-faint">
            No matches for “{result.query}”
          </p>
        )}

        {[...grouped.entries()].map(([path, matches]) => (
          <div key={path} className="border-b border-line/60 py-1">
            <div className="flex items-center gap-1.5 px-2.5 py-1 text-[12px] text-ink">
              <span className="truncate font-medium">{basename(path)}</span>
              <span className="truncate text-[11px] text-faint">{path}</span>
              <span className="ml-auto rounded bg-elevated px-1.5 text-[10px] text-muted">
                {matches.length}
              </span>
            </div>
            {matches.map((match) => (
              <button
                key={`${match.path}:${match.line}:${match.column}`}
                type="button"
                onClick={() => onOpen(match.path, match.line, match.column)}
                className="flex w-full items-start gap-2 px-2.5 py-1 text-left transition-colors hover:bg-hover"
              >
                <span className="w-8 shrink-0 text-right text-[11px] leading-4 text-faint">
                  {match.line}
                </span>
                <span
                  className={cn(
                    'truncate font-mono text-[11.5px] leading-4 text-muted',
                  )}
                >
                  {match.preview}
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

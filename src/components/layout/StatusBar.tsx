import { AlertTriangle, CircleAlert, GitBranch, Wifi, WifiOff } from 'lucide-react';
import type { CursorPosition } from '../../lib/types';
import { languageLabel } from '../../lib/languages';
import { cn } from '../../lib/utils';

interface StatusBarProps {
  branch: string | null;
  remote: string | null;
  online: boolean;
  activePath: string | null;
  cursor: CursorPosition;
  tabSize: number;
  errors: number;
  warnings: number;
  provider: { label: string; model: string; configured: boolean } | null;
  version: string;
  onOpenProblems: () => void;
  onOpenGit: () => void;
}

export function StatusBar({
  branch,
  remote,
  online,
  activePath,
  cursor,
  tabSize,
  errors,
  warnings,
  provider,
  version,
  onOpenProblems,
  onOpenGit,
}: StatusBarProps) {
  return (
    <footer className="flex h-6 shrink-0 items-center justify-between border-t border-line bg-panel px-2 text-[11px] text-muted">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onOpenGit}
          className="flex items-center gap-1.5 rounded px-1.5 py-0.5 transition-colors hover:bg-hover hover:text-ink"
          title={remote ? `origin: ${remote}` : 'Open source control'}
        >
          <GitBranch size={12} />
          <span className="max-w-[160px] truncate">{branch ?? 'no repository'}</span>
        </button>

        <button
          type="button"
          onClick={onOpenProblems}
          className="flex items-center gap-1.5 rounded px-1.5 py-0.5 transition-colors hover:bg-hover hover:text-ink"
          title="Show problems"
        >
          <CircleAlert size={12} className={errors > 0 ? 'text-danger' : undefined} />
          <span className={errors > 0 ? 'text-danger' : undefined}>{errors}</span>
          <AlertTriangle
            size={12}
            className={cn('ml-1', warnings > 0 && 'text-warning')}
          />
          <span className={warnings > 0 ? 'text-warning' : undefined}>{warnings}</span>
        </button>

        <span className="flex items-center gap-1.5 px-1.5" title={online ? 'Connected' : 'Offline'}>
          {online ? (
            <Wifi size={12} className="text-success" />
          ) : (
            <WifiOff size={12} className="text-danger" />
          )}
          <span>{online ? 'Connected' : 'Offline'}</span>
        </span>
      </div>

      <div className="flex items-center gap-3">
        <span
          className="flex items-center gap-1.5"
          title={provider ? `${provider.label} · ${provider.model}` : 'No AI provider configured'}
        >
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              provider?.configured ? 'bg-success' : 'bg-faint',
            )}
          />
          AI: {provider ? provider.label : 'not configured'}
        </span>
        <span className="hidden sm:inline">
          Ln {cursor.line}, Col {cursor.column}
        </span>
        <span className="hidden sm:inline">Spaces: {tabSize}</span>
        <span className="hidden md:inline">UTF-8</span>
        <span>{activePath ? languageLabel(activePath) : '—'}</span>
        <span className="hidden lg:inline text-faint">v{version}</span>
      </div>
    </footer>
  );
}

import {
  FilePlus2,
  GitBranch,
  Keyboard,
  Search,
  Sparkles,
  Terminal,
} from 'lucide-react';
import { basename, modKey } from '../../lib/utils';

interface WelcomeProps {
  onNewFile: () => void;
  onQuickOpen: () => void;
  onSearch: () => void;
  onOpenGit: () => void;
  onToggleAssistant: () => void;
  recentFiles: string[];
  onOpenRecent: (path: string) => void;
  hasProvider: boolean;
  providerLabel: string | null;
}

export function Welcome({
  onNewFile,
  onQuickOpen,
  onSearch,
  onOpenGit,
  onToggleAssistant,
  recentFiles,
  onOpenRecent,
  hasProvider,
  providerLabel,
}: WelcomeProps) {
  const mod = modKey();

  const actions = [
    { label: 'New file', hint: 'Create a file in the workspace', icon: FilePlus2, onClick: onNewFile },
    { label: 'Quick open', hint: `${mod} P`, icon: Search, onClick: onQuickOpen },
    { label: 'Search in files', hint: 'Find text across the workspace', icon: Search, onClick: onSearch },
    { label: 'Source control', hint: 'Commit, clone or push', icon: GitBranch, onClick: onOpenGit },
  ];

  return (
    <div className="scrollbar-thin flex-1 overflow-y-auto">
      <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center px-8 py-12">
        <div className="mb-8">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-[#7c5cff] text-white shadow-lg shadow-accent/20">
            <Sparkles size={22} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Safari AI Dev Studio
          </h1>
          <p className="mt-1.5 max-w-lg text-[13px] leading-relaxed text-muted">
            A local-first development workspace. Edit files, run commands in the integrated
            terminal, commit with git, and ask the assistant about the file you are working on.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              className="group flex items-start gap-3 rounded-lg border border-line bg-panel p-3 text-left transition-colors hover:border-faint hover:bg-elevated"
            >
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-elevated text-muted group-hover:text-accent">
                <action.icon size={15} />
              </span>
              <span className="min-w-0">
                <span className="block text-[12.5px] font-medium text-ink">{action.label}</span>
                <span className="block truncate text-[11.5px] text-faint">{action.hint}</span>
              </span>
            </button>
          ))}
        </div>

        {recentFiles.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-faint">
              Open files
            </h2>
            <div className="space-y-0.5">
              {recentFiles.slice(0, 6).map((file) => (
                <button
                  key={file}
                  type="button"
                  onClick={() => onOpenRecent(file)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-hover"
                >
                  <span className="text-[12.5px] text-ink">{basename(file)}</span>
                  <span className="truncate text-[11px] text-faint">{file}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="mt-8 grid grid-cols-1 gap-x-8 gap-y-1.5 text-[11.5px] text-muted sm:grid-cols-2">
          <Row keys={`${mod} K`} label="Command palette" />
          <Row keys={`${mod} P`} label="Quick open file" />
          <Row keys={`${mod} S`} label="Save file" />
          <Row keys={`${mod} B`} label="Toggle sidebar" />
          <Row keys={`${mod} J`} label="Toggle terminal" />
          <Row keys={`${mod} ,`} label="Settings" />
        </section>

        <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-line bg-panel px-3 py-2.5 text-[11.5px]">
          <span className="flex items-center gap-1.5 text-muted">
            <Terminal size={13} />
            Terminal scope: workspace
          </span>
          <span className="flex items-center gap-1.5 text-muted">
            <Keyboard size={13} />
            Ctrl+C interrupts
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className={`h-1.5 w-1.5 rounded-full ${hasProvider ? 'bg-success' : 'bg-warning'}`}
            />
            <span className="text-muted">
              {hasProvider ? `Assistant ready · ${providerLabel}` : 'Assistant needs an API key'}
            </span>
          </span>
          {!hasProvider && (
            <button
              type="button"
              onClick={onToggleAssistant}
              className="text-accent hover:underline"
            >
              Set up
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ keys, label }: { keys: string; label: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span>{label}</span>
      <kbd className="rounded border border-line bg-panel px-1.5 py-0.5 font-sans text-[10.5px] text-faint">
        {keys}
      </kbd>
    </div>
  );
}

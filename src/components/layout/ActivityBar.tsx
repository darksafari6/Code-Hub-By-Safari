import { Files, GitBranch, Search, Settings, Sparkles } from 'lucide-react';
import type { SidebarView } from '../../lib/types';
import { cn } from '../../lib/utils';
import { IconButton } from '../ui/IconButton';

interface ActivityBarProps {
  view: SidebarView;
  onSelectView: (view: SidebarView) => void;
  sidebarVisible: boolean;
  onToggleSidebar: () => void;
  assistantOpen: boolean;
  onToggleAssistant: () => void;
  onOpenSettings: () => void;
}

const VIEWS: Array<{ id: SidebarView; label: string; icon: typeof Files }> = [
  { id: 'explorer', label: 'Explorer', icon: Files },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'git', label: 'Source control', icon: GitBranch },
];

export function ActivityBar({
  view,
  onSelectView,
  sidebarVisible,
  onToggleSidebar,
  assistantOpen,
  onToggleAssistant,
  onOpenSettings,
}: ActivityBarProps) {
  return (
    <nav
      aria-label="Primary navigation"
      className="flex w-12 shrink-0 flex-col items-center justify-between border-r border-line bg-panel py-2"
    >
      <div className="flex w-full flex-col items-center gap-1">
        {VIEWS.map((entry) => {
          const active = sidebarVisible && view === entry.id;
          return (
            <button
              key={entry.id}
              type="button"
              title={entry.label}
              aria-label={entry.label}
              aria-pressed={active}
              onClick={() => {
                if (active) {
                  onToggleSidebar();
                  return;
                }
                onSelectView(entry.id);
                if (!sidebarVisible) onToggleSidebar();
              }}
              className={cn(
                'relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
                active ? 'bg-elevated text-ink' : 'text-muted hover:bg-hover hover:text-ink',
              )}
            >
              {active && (
                <span className="absolute -left-2 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r bg-accent" />
              )}
              <entry.icon size={19} strokeWidth={1.8} />
            </button>
          );
        })}

        <button
          type="button"
          title="Safari Assistant"
          aria-label="Safari Assistant"
          aria-pressed={assistantOpen}
          onClick={onToggleAssistant}
          className={cn(
            'relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
            assistantOpen ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-hover hover:text-ink',
          )}
        >
          <Sparkles size={19} strokeWidth={1.8} />
        </button>
      </div>

      <div className="flex flex-col items-center gap-1">
        <IconButton label="Settings" className="h-9 w-9" onClick={onOpenSettings}>
          <Settings size={18} strokeWidth={1.8} />
        </IconButton>
      </div>
    </nav>
  );
}

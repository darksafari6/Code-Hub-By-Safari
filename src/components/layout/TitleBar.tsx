import { Command, PanelRight, Search, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';
import { IconButton } from '../ui/IconButton';

interface TitleBarProps {
  workspaceName: string;
  branch: string | null;
  onOpenPalette: () => void;
  assistantOpen: boolean;
  onToggleAssistant: () => void;
  previewOpen: boolean;
  onTogglePreview: () => void;
  online: boolean;
  modKey: string;
}

export function TitleBar({
  workspaceName,
  branch,
  onOpenPalette,
  assistantOpen,
  onToggleAssistant,
  previewOpen,
  onTogglePreview,
  online,
  modKey,
}: TitleBarProps) {
  return (
    <header className="flex h-11 shrink-0 items-center justify-between gap-4 border-b border-line bg-panel px-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-accent to-[#7c5cff] text-white shadow-sm">
          <Command size={14} />
        </div>
        <span className="truncate text-[13px] font-semibold tracking-tight text-ink">
          Safari AI Dev Studio
        </span>
        <span className="hidden items-center gap-1.5 text-[12px] text-muted sm:flex">
          <span className="text-faint">/</span>
          <span className="max-w-[180px] truncate">{workspaceName}</span>
        </span>
        {branch && (
          <span className="hidden items-center rounded border border-line bg-elevated px-1.5 py-0.5 text-[11px] text-muted md:flex">
            {branch}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={onOpenPalette}
        className={cn(
          'group flex h-7 w-full max-w-md items-center gap-2 rounded-md border border-line bg-elevated/70 px-2.5 text-left text-[12px] text-muted',
          'transition-colors hover:border-faint hover:bg-elevated',
        )}
      >
        <Search size={13} className="text-faint group-hover:text-muted" />
        <span className="flex-1 truncate">Search files and commands</span>
        <kbd className="rounded border border-line bg-panel px-1.5 py-0.5 text-[10px] text-faint">
          {modKey} K
        </kbd>
      </button>

      <div className="flex items-center gap-1">
        <span
          className={cn(
            'mr-1 h-2 w-2 rounded-full',
            online ? 'bg-success' : 'bg-danger',
          )}
          title={online ? 'Server connected' : 'Server unreachable'}
        />
        <IconButton
          label="Safari Assistant"
          active={assistantOpen}
          onClick={onToggleAssistant}
        >
          <Sparkles size={16} />
        </IconButton>
        <IconButton label="Toggle preview" active={previewOpen} onClick={onTogglePreview}>
          <PanelRight size={16} />
        </IconButton>
      </div>
    </header>
  );
}

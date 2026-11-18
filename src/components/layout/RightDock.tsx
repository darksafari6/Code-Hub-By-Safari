import type { ReactNode } from 'react';
import { Globe, Sparkles, X } from 'lucide-react';
import type { RightTab } from '../../lib/types';
import { cn } from '../../lib/utils';
import { IconButton } from '../ui/IconButton';

interface RightDockProps {
  tab: RightTab;
  onTabChange: (tab: RightTab) => void;
  onClose: () => void;
  width: number;
  assistant: ReactNode;
  preview: ReactNode;
}

export function RightDock({
  tab,
  onTabChange,
  onClose,
  width,
  assistant,
  preview,
}: RightDockProps) {
  return (
    <aside
      aria-label="Assistant and preview"
      className="flex shrink-0 flex-col border-l border-line bg-panel"
      style={{ width }}
    >
      <div className="flex h-8 shrink-0 items-center gap-0.5 border-b border-line px-1.5">
        <button
          type="button"
          onClick={() => onTabChange('assistant')}
          className={cn(
            'flex h-7 items-center gap-1.5 rounded px-2 text-[11.5px] font-medium uppercase tracking-wide transition-colors',
            tab === 'assistant' ? 'bg-elevated text-ink' : 'text-muted hover:bg-hover hover:text-ink',
          )}
        >
          <Sparkles size={12} />
          Assistant
        </button>
        <button
          type="button"
          onClick={() => onTabChange('preview')}
          className={cn(
            'flex h-7 items-center gap-1.5 rounded px-2 text-[11.5px] font-medium uppercase tracking-wide transition-colors',
            tab === 'preview' ? 'bg-elevated text-ink' : 'text-muted hover:bg-hover hover:text-ink',
          )}
        >
          <Globe size={12} />
          Preview
        </button>
        <span className="ml-auto">
          <IconButton label="Close panel" size="sm" onClick={onClose}>
            <X size={13} />
          </IconButton>
        </span>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <div className={cn('absolute inset-0', tab !== 'assistant' && 'hidden')}>{assistant}</div>
        <div className={cn('absolute inset-0', tab !== 'preview' && 'hidden')}>{preview}</div>
      </div>
    </aside>
  );
}

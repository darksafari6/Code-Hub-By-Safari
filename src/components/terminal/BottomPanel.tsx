import type { MutableRefObject } from 'react';
import {
  AlertTriangle,
  CircleAlert,
  Eraser,
  PlugZap,
  TerminalSquare,
  X,
} from 'lucide-react';
import type { EditorProblem, BottomTab, ThemeMode } from '../../lib/types';
import { cn } from '../../lib/utils';
import { IconButton } from '../ui/IconButton';
import { TerminalView, type TerminalHandle } from './TerminalView';

interface BottomPanelProps {
  activeTab: BottomTab;
  onTabChange: (tab: BottomTab) => void;
  visible: boolean;
  height: number;
  theme: ThemeMode;
  fontSize: number;
  terminalHandle: MutableRefObject<TerminalHandle | null>;
  terminalStatus: 'connecting' | 'open' | 'closed';
  onTerminalStatus: (status: 'connecting' | 'open' | 'closed') => void;
  onClose: () => void;
  problems: EditorProblem[];
  counts: { errors: number; warnings: number };
  onOpenProblem: (problem: EditorProblem) => void;
}

export function BottomPanel({
  activeTab,
  onTabChange,
  visible,
  height,
  theme,
  fontSize,
  terminalHandle,
  terminalStatus,
  onTerminalStatus,
  onClose,
  problems,
  counts,
  onOpenProblem,
}: BottomPanelProps) {
  return (
    <section
      aria-label="Panel"
      className={cn(
        'flex shrink-0 flex-col border-t border-line bg-panel',
        !visible && 'hidden',
      )}
      style={{ height }}
    >
      <div className="flex h-8 shrink-0 items-center gap-0.5 border-b border-line px-1.5">
        <TabButton
          active={activeTab === 'terminal'}
          onClick={() => onTabChange('terminal')}
          label="Terminal"
          icon={<TerminalSquare size={13} />}
          badge={
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                terminalStatus === 'open'
                  ? 'bg-success'
                  : terminalStatus === 'connecting'
                    ? 'bg-warning'
                    : 'bg-danger',
              )}
            />
          }
        />
        <TabButton
          active={activeTab === 'problems'}
          onClick={() => onTabChange('problems')}
          label="Problems"
          icon={<CircleAlert size={13} />}
          badge={
            counts.errors + counts.warnings > 0 ? (
              <span className="rounded bg-elevated px-1 text-[10px] text-muted">
                {counts.errors + counts.warnings}
              </span>
            ) : null
          }
        />

        <div className="ml-auto flex items-center gap-0.5">
          {activeTab === 'terminal' ? (
            <>
              <IconButton
                label="Reconnect terminal"
                size="sm"
                onClick={() => terminalHandle.current?.reconnect()}
              >
                <PlugZap size={13} />
              </IconButton>
              <IconButton
                label="Clear terminal"
                size="sm"
                onClick={() => terminalHandle.current?.clear()}
              >
                <Eraser size={13} />
              </IconButton>
            </>
          ) : null}
          <IconButton label="Close panel" size="sm" onClick={onClose}>
            <X size={13} />
          </IconButton>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <div
          className={cn(
            'absolute inset-0',
            activeTab === 'terminal' ? 'visible' : 'invisible pointer-events-none',
          )}
        >
          <TerminalView
            visible={visible && activeTab === 'terminal'}
            fontSize={fontSize}
            theme={theme}
            handleRef={terminalHandle}
            onStatusChange={onTerminalStatus}
          />
        </div>

        {activeTab === 'problems' && (
          <div className="scrollbar-thin absolute inset-0 overflow-y-auto bg-app">
            {problems.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-1.5 text-[12px] text-faint">
                <CircleAlert size={18} />
                No problems detected in open files
              </div>
            ) : (
              <ul className="divide-y divide-line/60">
                {problems.map((problem) => (
                  <li key={`${problem.path}:${problem.line}:${problem.column}:${problem.message}`}>
                    <button
                      type="button"
                      onClick={() => onOpenProblem(problem)}
                      className="flex w-full items-start gap-2 px-3 py-1.5 text-left transition-colors hover:bg-hover"
                    >
                      {problem.severity === 'error' ? (
                        <CircleAlert size={13} className="mt-0.5 shrink-0 text-danger" />
                      ) : (
                        <AlertTriangle size={13} className="mt-0.5 shrink-0 text-warning" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] text-ink">
                          {problem.message}
                        </span>
                        <span className="block truncate text-[11px] text-faint">
                          {problem.path}:{problem.line}:{problem.column}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function TabButton({
  active,
  onClick,
  label,
  icon,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-7 items-center gap-1.5 rounded px-2 text-[11.5px] font-medium uppercase tracking-wide transition-colors',
        active ? 'bg-elevated text-ink' : 'text-muted hover:bg-hover hover:text-ink',
      )}
    >
      {icon}
      {label}
      {badge}
    </button>
  );
}

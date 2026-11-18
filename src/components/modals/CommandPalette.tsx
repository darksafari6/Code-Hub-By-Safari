import { useEffect, useMemo, useRef, useState } from 'react';
import { CornerDownLeft, FileCode2, Search, TerminalSquare } from 'lucide-react';
import { basename, cn } from '../../lib/utils';

export interface PaletteCommand {
  id: string;
  label: string;
  hint?: string;
  group: string;
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  commands: PaletteCommand[];
  files: Array<{ name: string; path: string }>;
  onClose: () => void;
  onOpenFile: (path: string) => void;
}

type Item =
  | { kind: 'command'; id: string; label: string; hint: string; group: string; run: () => void }
  | { kind: 'file'; id: string; label: string; hint: string; group: string; path: string };

export function CommandPalette({
  open,
  commands,
  files,
  onClose,
  onOpenFile,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setSelected(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(timer);
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const needle = query.trim().toLowerCase();

    const commandItems = commands
      .filter((command) => !needle || command.label.toLowerCase().includes(needle))
      .map<Item>((command) => ({
        kind: 'command',
        id: command.id,
        label: command.label,
        hint: command.hint ?? command.group,
        group: command.group,
        run: command.run,
      }));

    const fileItems = files
      .filter((file) => !needle || file.path.toLowerCase().includes(needle))
      .slice(0, 40)
      .map<Item>((file) => ({
        kind: 'file',
        id: `file:${file.path}`,
        label: basename(file.path),
        hint: file.path,
        group: 'Files',
        path: file.path,
      }));

    if (!needle) return [...commandItems, ...fileItems];
    return [...commandItems, ...fileItems];
  }, [commands, files, query]);

  useEffect(() => {
    if (selected >= items.length) setSelected(items.length > 0 ? items.length - 1 : 0);
  }, [items.length, selected]);

  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  if (!open) return null;

  const choose = (item: Item | undefined) => {
    if (!item) return;
    onClose();
    if (item.kind === 'file') onOpenFile(item.path);
    else item.run();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative w-full max-w-xl overflow-hidden rounded-xl border border-line bg-panel shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
          <Search size={15} className="text-faint" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelected(0);
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setSelected((value) => Math.min(value + 1, items.length - 1));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setSelected((value) => Math.max(value - 1, 0));
              } else if (event.key === 'Enter') {
                event.preventDefault();
                choose(items[selected]);
              } else if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
              }
            }}
            placeholder="Type a command or search files…"
            className="flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-faint"
          />
          <kbd className="rounded border border-line bg-elevated px-1.5 py-0.5 text-[10px] text-faint">
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="scrollbar-thin max-h-[55vh] overflow-y-auto p-1.5">
          {items.length === 0 ? (
            <p className="px-3 py-8 text-center text-[12px] text-faint">
              No matches for “{query}”
            </p>
          ) : (
            items.map((item, index) => (
              <button
                key={item.id}
                type="button"
                data-active={index === selected}
                onMouseEnter={() => setSelected(index)}
                onClick={() => choose(item)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left transition-colors',
                  index === selected ? 'bg-accent-soft text-ink' : 'text-muted hover:bg-hover',
                )}
              >
                <span
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded',
                    index === selected ? 'bg-accent/15 text-accent' : 'bg-elevated text-faint',
                  )}
                >
                  {item.kind === 'file' ? (
                    <FileCode2 size={13} />
                  ) : item.group === 'Terminal' ? (
                    <TerminalSquare size={13} />
                  ) : (
                    <CornerDownLeft size={13} />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px]">{item.label}</span>
                  <span className="block truncate text-[11px] text-faint">{item.hint}</span>
                </span>
                <span className="shrink-0 rounded bg-elevated px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-faint">
                  {item.group}
                </span>
              </button>
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-t border-line bg-elevated/40 px-3 py-1.5 text-[10.5px] text-faint">
          <span>↑↓ navigate · Enter select</span>
          <span>{items.length} results</span>
        </div>
      </div>
    </div>
  );
}

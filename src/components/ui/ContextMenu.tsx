import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface ContextMenuItem {
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x, y });

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const rect = menu.getBoundingClientRect();
    const nextX = Math.min(x, window.innerWidth - rect.width - 8);
    const nextY = Math.min(y, window.innerHeight - rect.height - 8);
    setPosition({ x: Math.max(8, nextX), y: Math.max(8, nextY) });
  }, [x, y]);

  useEffect(() => {
    const close = () => onClose();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', close);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', close);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      role="menu"
      style={{ left: position.x, top: position.y }}
      onPointerDown={(event) => event.stopPropagation()}
      className="fixed z-[60] min-w-[190px] overflow-hidden rounded-lg border border-line bg-elevated py-1 shadow-2xl"
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          disabled={item.disabled}
          onClick={() => {
            onClose();
            item.onSelect();
          }}
          className={cn(
            'flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[12.5px] transition-colors',
            'hover:bg-hover disabled:cursor-not-allowed disabled:opacity-40',
            item.danger ? 'text-danger' : 'text-ink',
          )}
        >
          <span className={cn('flex h-4 w-4 items-center justify-center', item.danger ? 'text-danger' : 'text-muted')}>
            {item.icon}
          </span>
          {item.label}
        </button>
      ))}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/utils';

export interface MenuItemDef {
  /** Stable id shared with the native Electron menu. */
  id: string;
  label?: string;
  shortcut?: string;
  disabled?: boolean;
  checked?: boolean;
  separator?: boolean;
  onSelect?: () => void;
}

export interface MenuDef {
  id: string;
  label: string;
  items: MenuItemDef[];
}

interface MenuBarProps {
  menus: MenuDef[];
}

export function MenuBar({ menus }: MenuBarProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!openId) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpenId(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenId(null);
    };

    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [openId]);

  return (
    <div
      ref={containerRef}
      role="menubar"
      className="relative z-40 flex h-8 shrink-0 items-center gap-0.5 border-b border-[color:var(--border)] bg-[color:var(--bg-elevated)] px-2"
    >
      {menus.map((menu) => {
        const isOpen = openId === menu.id;
        return (
          <div key={menu.id} className="relative">
            <button
              type="button"
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={isOpen}
              onClick={() => setOpenId(isOpen ? null : menu.id)}
              onPointerEnter={() => {
                if (openId && openId !== menu.id) setOpenId(menu.id);
              }}
              className={cn(
                'rounded px-2 py-1 text-[12px] transition-colors',
                isOpen
                  ? 'bg-[color:var(--bg-hover)] text-[color:var(--text)]'
                  : 'text-[color:var(--text-muted)] hover:bg-[color:var(--bg-hover)] hover:text-[color:var(--text)]',
              )}
            >
              {menu.label}
            </button>

            {isOpen && (
              <div
                role="menu"
                className="absolute left-0 top-full mt-1 min-w-[250px] rounded-md border border-[color:var(--border)] bg-[color:var(--bg-elevated)] py-1 shadow-2xl"
              >
                {menu.items.map((item) =>
                  item.separator ? (
                    <div
                      key={item.id}
                      role="separator"
                      className="my-1 h-px bg-[color:var(--border)]"
                    />
                  ) : (
                    <button
                      key={item.id}
                      type="button"
                      role="menuitem"
                      data-menu-id={item.id}
                      disabled={item.disabled}
                      onClick={() => {
                        setOpenId(null);
                        item.onSelect?.();
                      }}
                      className={cn(
                        'flex w-full items-center justify-between gap-6 px-3 py-1.5 text-left text-[12px] transition-colors',
                        item.disabled
                          ? 'cursor-not-allowed text-[color:var(--text-dim)]'
                          : 'text-[color:var(--text-muted)] hover:bg-[color:var(--accent)] hover:text-white',
                      )}
                    >
                      <span className="truncate">
                        {item.checked ? '✓ ' : ''}
                        {item.label}
                      </span>
                      {item.shortcut && (
                        <span className="shrink-0 text-[11px] opacity-70">{item.shortcut}</span>
                      )}
                    </button>
                  ),
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

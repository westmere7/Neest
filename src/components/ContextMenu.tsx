import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import './components.css';

export interface MenuItem {
  label: string;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  separator?: boolean;
  run?: () => void;
}

interface MenuState {
  open: { x: number; y: number; items: MenuItem[] } | null;
}

const useMenuStore = create<MenuState>(() => ({ open: null }));

export function openContextMenu(x: number, y: number, items: MenuItem[]) {
  useMenuStore.setState({ open: { x, y, items } });
}

export function closeContextMenu() {
  useMenuStore.setState({ open: null });
}

/** Single global context menu, keyboard navigable, closed on outside click/Esc. */
export function ContextMenuHost() {
  const open = useMenuStore((s) => s.open);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const first = ref.current?.querySelector<HTMLButtonElement>('button:not([disabled])');
    first?.focus();
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) closeContextMenu();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeContextMenu();
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const btns = [...(ref.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? [])];
        const idx = btns.indexOf(document.activeElement as HTMLButtonElement);
        const next = btns[(idx + (e.key === 'ArrowDown' ? 1 : -1) + btns.length) % btns.length];
        next?.focus();
      }
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  if (!open) return null;
  const maxX = window.innerWidth - 230;
  const maxY = window.innerHeight - open.items.length * 32 - 16;
  return (
    <div
      ref={ref}
      className="context-menu"
      role="menu"
      style={{ left: Math.min(open.x, maxX), top: Math.max(8, Math.min(open.y, maxY)) }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {open.items.map((item, i) =>
        item.separator ? (
          <div key={i} className="menu-sep" role="separator" />
        ) : (
          <button
            key={i}
            role="menuitem"
            className={`menu-item${item.danger ? ' danger' : ''}`}
            disabled={item.disabled}
            onClick={() => {
              closeContextMenu();
              item.run?.();
            }}
          >
            <span>{item.label}</span>
            {item.shortcut && <kbd>{item.shortcut}</kbd>}
          </button>
        ),
      )}
    </div>
  );
}

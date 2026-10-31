import { createContext, useContext, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { PanelLeftClose, PanelLeftOpen, type LucideIcon } from 'lucide-react';
import { usePrefsStore } from '@/state/uiStores';

/** Whether the library's category sidebar shows icons only (shared by Furniture and Materials, remembered). */
export const useRailCollapsed = () => usePrefsStore((s) => s.libraryRailCollapsed);

type Tip = { text: string; top: number; left: number } | null;
/** Shows the collapsed rail's instant tooltip beside a button (null hides it). */
const TipContext = createContext<(el: HTMLElement | null, text?: string) => void>(() => {});

/** Hover handlers for an instant tooltip right of the button (the collapsed rail only; native titles are slow). */
function useInstantTip(text: string, on: boolean) {
  const tip = useContext(TipContext);
  if (!on) return {};
  return {
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => tip(e.currentTarget, text),
    onMouseLeave: () => tip(null),
    onFocus: (e: React.FocusEvent<HTMLElement>) => tip(e.currentTarget, text),
    onBlur: () => tip(null),
    onPointerDown: () => tip(null),
  };
}

/**
 * The library's category sidebar. A toggle at its top folds it to icons only (names and counts move
 * to the tooltips) to give the results more room.
 */
export function CategoryRail({
  label,
  testId,
  children,
}: {
  label: string;
  testId?: string;
  children: ReactNode;
}) {
  const collapsed = useRailCollapsed();
  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const [tip, setTip] = useState<Tip>(null);
  const show = (el: HTMLElement | null, text?: string) => {
    if (!el || !text) return setTip(null);
    const r = el.getBoundingClientRect();
    setTip({ text, top: r.top + r.height / 2, left: r.right + 8 });
  };
  const toggleTip = useInstantTipFor(show, collapsed ? 'Show category names' : 'Icons only', collapsed);
  return (
    <TipContext.Provider value={show}>
      <nav className={`lib-cat-rail${collapsed ? ' collapsed' : ''}`} aria-label={label} data-testid={testId}>
        <button
          type="button"
          className="lib-cat-btn lib-cat-toggle"
          onClick={() => usePrefsStore.getState().setLibraryRailCollapsed(!collapsed)}
          title={collapsed ? undefined : 'Icons only'}
          {...toggleTip}
          aria-label={collapsed ? 'Show category names' : 'Show category icons only'}
          aria-pressed={collapsed}
          data-testid="library-rail-toggle"
        >
          <Icon size={13} aria-hidden />
          <span className="lib-cat-label">Collapse</span>
        </button>
        {children}
      </nav>
      {tip &&
        createPortal(
          <div role="tooltip" className="ui-tooltip lib-cat-tip" style={{ top: tip.top, left: tip.left }}>
            <span>{tip.text}</span>
          </div>,
          document.body,
        )}
    </TipContext.Provider>
  );
}

/** The toggle's own tip (it renders the provider, so it can't read the context). */
function useInstantTipFor(show: (el: HTMLElement | null, text?: string) => void, text: string, on: boolean) {
  if (!on) return {};
  return {
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => show(e.currentTarget, text),
    onMouseLeave: () => show(null),
    onPointerDown: () => show(null),
  };
}

/** A heading between groups of categories (a thin divider when the rail is collapsed). */
export function CategoryHeading({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <div className="lib-cat-heading" data-testid={testId}>
      <span>{children}</span>
    </div>
  );
}

/** One category: icon, name and count; collapsed, only the icon (the tooltip names it and its count). */
export function CategoryButton({
  active,
  empty = false,
  onClick,
  icon: Icon,
  label,
  count,
  tooltip,
  testId,
}: {
  active: boolean;
  empty?: boolean;
  onClick: () => void;
  icon: LucideIcon;
  label: string;
  count: number;
  tooltip?: string;
  testId?: string;
}) {
  const collapsed = useRailCollapsed();
  const tip = useInstantTip(`${tooltip ?? label} · ${count}`, collapsed);
  return (
    <button
      type="button"
      {...tip}
      className={`lib-cat-btn${active ? ' on' : ''}${empty ? ' empty' : ''}`}
      onClick={onClick}
      aria-pressed={active}
      aria-label={collapsed ? `${label} (${count})` : undefined}
      title={collapsed ? undefined : (tooltip ?? label)}
      data-testid={testId}
    >
      <Icon size={collapsed ? 15 : 13} aria-hidden />
      <span className="lib-cat-label">{label}</span>
      <span className="lib-cat-count num">{count}</span>
    </button>
  );
}

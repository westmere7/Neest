import type { ReactNode } from 'react';
import { PanelLeftClose, PanelLeftOpen, type LucideIcon } from 'lucide-react';
import { usePrefsStore } from '@/state/uiStores';

/** Whether the library's category sidebar shows icons only (shared by Furniture and Materials, remembered). */
export const useRailCollapsed = () => usePrefsStore((s) => s.libraryRailCollapsed);

/**
 * The library's category sidebar. A toggle at its top folds it to icons only (names and counts move
 * to the tooltips) to give the results more room.
 */
export function CategoryRail({ label, testId, children }: { label: string; testId?: string; children: ReactNode }) {
  const collapsed = useRailCollapsed();
  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose;
  return (
    <nav className={`lib-cat-rail${collapsed ? ' collapsed' : ''}`} aria-label={label} data-testid={testId}>
      <button
        type="button"
        className="lib-cat-btn lib-cat-toggle"
        onClick={() => usePrefsStore.getState().setLibraryRailCollapsed(!collapsed)}
        title={collapsed ? 'Show category names' : 'Icons only'}
        aria-label={collapsed ? 'Show category names' : 'Show category icons only'}
        aria-pressed={collapsed}
        data-testid="library-rail-toggle"
      >
        <Icon size={13} aria-hidden />
        <span className="lib-cat-label">Collapse</span>
      </button>
      {children}
    </nav>
  );
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
  return (
    <button
      type="button"
      className={`lib-cat-btn${active ? ' on' : ''}${empty ? ' empty' : ''}`}
      onClick={onClick}
      aria-pressed={active}
      aria-label={collapsed ? `${label} (${count})` : undefined}
      title={collapsed ? `${tooltip ?? label} · ${count}` : (tooltip ?? label)}
      data-testid={testId}
    >
      <Icon size={collapsed ? 15 : 13} aria-hidden />
      <span className="lib-cat-label">{label}</span>
      <span className="lib-cat-count num">{count}</span>
    </button>
  );
}

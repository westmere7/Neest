import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  ChevronDown,
  Copy,
  Eraser,
  LayoutTemplate,
  MoreHorizontal,
  Pencil,
  Square,
} from 'lucide-react';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore } from '@/state/editorStore';
import { confirmAction } from '@/state/uiStores';
import { openContextMenu } from '@/components/ContextMenu';
import {
  addOption,
  deleteOption,
  listOptions,
  moveOption,
  renameOption,
  switchOption,
  type NewOptionMode,
} from '@/domain/commands/options';

/**
 * Layout options (phương án) next to the project name: several versions of the plan in one project.
 * The button shows the active option; its popover switches, adds (duplicate, same walls without
 * furniture, blank), renames, reorders and deletes options. See domain/commands/options.ts.
 */
export function OptionSwitcher() {
  const project = useProjectStore((s) => s.project!);
  const { options, activeId } = listOptions(project);
  const active = options.find((o) => o.id === activeId) ?? options[0];
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // The popover lives in a portal on <body> so it floats above every panel; it follows the button.
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = ref.current?.getBoundingClientRect();
      if (r) setPos({ left: Math.max(8, Math.min(r.left, window.innerWidth - 288)), top: r.bottom + 10 });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target;
      if (
        t instanceof Element &&
        (ref.current?.contains(t) || menuRef.current?.contains(t) || t.closest('.context-menu'))
      )
        return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !editing) setOpen(false);
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, editing]);

  const run = (label: string, fn: Parameters<ReturnType<typeof useProjectStore.getState>['execute']>[1]) => {
    useProjectStore.getState().execute(label, fn);
    // Ids belong to one option: whatever was selected is gone after a switch.
    useEditorStore.getState().clearSelection();
  };
  const switchTo = (id: string, name: string) => {
    if (id !== activeId) run(`Switch to ${name}`, (d) => void switchOption(d, id));
  };
  const add = (mode: NewOptionMode) => {
    const label =
      mode === 'duplicate'
        ? `Duplicate ${active.name}`
        : mode === 'shell'
          ? 'New option with the same walls'
          : 'New blank option';
    run(label, (d) => void addOption(d, mode));
  };
  const remove = async (id: string, name: string) => {
    const ok = await confirmAction({
      title: `Delete ${name}?`,
      message: 'Its walls, rooms and furniture are removed from the project. Undo brings it back.',
      confirmLabel: 'Delete option',
      danger: true,
    });
    if (ok) run(`Delete ${name}`, (d) => void deleteOption(d, id));
  };
  const rowMenu = (e: React.MouseEvent, id: string, name: string, i: number) => {
    e.preventDefault();
    e.stopPropagation();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    openContextMenu(
      e.type === 'contextmenu' ? e.clientX : r.left,
      e.type === 'contextmenu' ? e.clientY : r.bottom + 4,
      [
        { label: 'Rename…', run: () => setEditing(id) },
        {
          label: 'Duplicate',
          run: () =>
            run(`Duplicate ${name}`, (d) => {
              switchOption(d, id);
              addOption(d, 'duplicate', `${name} copy`);
            }),
        },
        { label: 'Move up', disabled: i === 0, run: () => run(`Move ${name}`, (d) => moveOption(d, id, -1)) },
        {
          label: 'Move down',
          disabled: i === options.length - 1,
          run: () => run(`Move ${name}`, (d) => moveOption(d, id, 1)),
        },
        { separator: true, label: '' },
        { label: 'Delete…', danger: true, disabled: options.length < 2, run: () => void remove(id, name) },
      ],
    );
  };

  return (
    <div className="option-switcher" ref={ref}>
      <button
        type="button"
        className={`option-switch${open ? ' open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        title="Layout options: versions of this layout"
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid="option-switch"
      >
        <LayoutTemplate size={13} aria-hidden />
        <span className="option-switch-name">{active.name}</span>
        {options.length > 1 && <span className="option-count">{options.length}</span>}
        <ChevronDown size={13} aria-hidden />
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            className="option-menu"
            ref={menuRef}
            style={{ left: pos.left, top: pos.top }}
            role="dialog"
            aria-label="Layout options"
            data-testid="option-menu"
          >
            <div className="option-menu-title">Layout options</div>
            <ul className="option-list">
              {options.map((o, i) => (
                <li
                  key={o.id}
                  className={`option-row${o.id === activeId ? ' active' : ''}`}
                  onContextMenu={(e) => rowMenu(e, o.id, o.name, i)}
                >
                  {editing === o.id ? (
                    <RenameInput
                      name={o.name}
                      onDone={(v) => {
                        setEditing(null);
                        if (v && v !== o.name) run(`Rename ${o.name}`, (d) => renameOption(d, o.id, v));
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      className="option-pick"
                      onClick={() => switchTo(o.id, o.name)}
                      onDoubleClick={() => setEditing(o.id)}
                      data-testid="option-pick"
                    >
                      <span className="option-check">{o.id === activeId ? <Check size={14} /> : null}</span>
                      <span className="option-name">{o.name}</span>
                    </button>
                  )}
                  {editing !== o.id && (
                    <>
                      <button
                        type="button"
                        className="option-icon"
                        title="Rename"
                        aria-label={`Rename ${o.name}`}
                        onClick={() => setEditing(o.id)}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        className="option-icon"
                        title="More"
                        aria-label={`More for ${o.name}`}
                        onClick={(e) => rowMenu(e, o.id, o.name, i)}
                      >
                        <MoreHorizontal size={14} />
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
            <div className="menu-sep" />
            <button
              type="button"
              className="menu-item option-add"
              onClick={() => add('duplicate')}
              data-testid="option-duplicate"
            >
              <span>
                <Copy size={13} aria-hidden /> Duplicate {active.name}
              </span>
            </button>
            <button type="button" className="menu-item option-add" onClick={() => add('shell')}>
              <span>
                <Eraser size={13} aria-hidden /> Same walls, no furniture
              </span>
            </button>
            <button type="button" className="menu-item option-add" onClick={() => add('blank')}>
              <span>
                <Square size={13} aria-hidden /> Blank option
              </span>
            </button>
            <p className="option-hint">
              Each option is its own version of the walls, rooms and furniture. Materials, cameras and
              settings are shared.
            </p>
          </div>,
          document.body,
        )}
    </div>
  );
}

function RenameInput({ name, onDone }: { name: string; onDone(v: string): void }) {
  const [value, setValue] = useState(name);
  return (
    <input
      className="input option-rename"
      value={value}
      autoFocus
      maxLength={60}
      aria-label="Option name"
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onDone(value.trim())}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') onDone(value.trim());
        if (e.key === 'Escape') onDone(name);
      }}
    />
  );
}

import { memo, useRef, useState } from 'react';
import { ChevronRight, Eye, EyeOff, FolderInput, Lock, Plus, SquareMousePointer, Trash2, Unlock, X } from 'lucide-react';
import type { ItemLayer, PlacedObject, Project } from '@/domain/model/schema';
import {
  ITEM_LAYER_COLORS,
  deleteItemLayer,
  isObjectHidden,
  objectsInLayer,
  setAllItemLayersVisible,
  setObjectsLayer,
  updateItemLayer,
  updateUnassignedLayer,
} from '@/domain/commands/itemLayers';
import { getAsset } from '@/data/assets/registry';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore } from '@/state/editorStore';
import { confirmAction } from '@/state/uiStores';
import { Button, IconButton, Select } from '@/components/ui';
import { moveSelectionToLayer, newLayerFromSelection, selectLayerItems } from './itemLayerActions';
import './layers.css';

/**
 * Item layers panel (top-bar Layers button): user layers for organising placed items. Each row shows,
 * hides, locks, selects or empties its layer; it is not a stacking order. Items on no layer are
 * listed under "Unassigned". The project-wide Walls / Furniture / Notes layers stay in the Project panel.
 */

const exec = (label: string, fn: Parameters<ReturnType<typeof useProjectStore.getState>['execute']>[1]) =>
  useProjectStore.getState().execute(label, fn);

const itemName = (project: Project, o: PlacedObject) => o.name ?? getAsset(project, o.assetId)?.name ?? 'Item';

/** Drops items that just became hidden from the selection. */
function pruneHiddenSelection() {
  const p = useProjectStore.getState().project;
  const ed = useEditorStore.getState();
  if (!p) return;
  const keep = ed.selection.filter((s) => s.kind !== 'object' || (p.objects[s.id] && !isObjectHidden(p, p.objects[s.id])));
  if (keep.length !== ed.selection.length) ed.setSelection(keep);
}

export const LayersPanel = memo(function LayersPanel() {
  const project = useProjectStore((s) => s.project!);
  const selection = useEditorStore((s) => s.selection);
  const selectedItems = selection.filter((s) => s.kind === 'object' && project.objects[s.id]).length;
  const layers = project.itemLayers ?? [];
  const unassigned = project.layers.unassigned ?? { visible: true, locked: false };
  const anyHidden = !unassigned.visible || layers.some((l) => !l.visible);
  const close = () => useEditorStore.getState().set({ layersPanelOpen: false });

  return (
    <aside className="layers-panel floating" aria-label="Item layers" data-testid="layers-panel">
      <header className="layers-panel-head">
        <div className="layers-panel-titles">
          <span className="layers-panel-eyebrow">Items</span>
          <h2>Layers</h2>
        </div>
        <div className="layers-panel-actions">
          <IconButton
            label={anyHidden ? 'Show all layers' : 'Hide all layers'}
            onClick={() => {
              exec(anyHidden ? 'Show all layers' : 'Hide all layers', (d) => setAllItemLayersVisible(d, anyHidden));
              pruneHiddenSelection();
            }}
            data-testid="layers-toggle-all"
          >
            {anyHidden ? <Eye size={15} /> : <EyeOff size={15} />}
          </IconButton>
          <IconButton
            label={selectedItems ? `New layer with the ${selectedItems} selected item${selectedItems > 1 ? 's' : ''}` : 'New layer'}
            onClick={() => newLayerFromSelection()}
            data-testid="layers-new"
          >
            <Plus size={16} />
          </IconButton>
          <IconButton label="Close layers" onClick={close}>
            <X size={15} />
          </IconButton>
        </div>
      </header>
      <div className="layers-panel-body">
        {!project.layers.furniture.visible && (
          <p className="notice layers-notice">
            All furniture is hidden in the Project panel.{' '}
            <button type="button" className="link-btn" onClick={() => exec('Show furniture', (d) => void (d.layers.furniture.visible = true))}>
              Show it
            </button>
          </p>
        )}
        {layers.map((l) => (
          <LayerRow key={l.id} project={project} layer={l} selectedItems={selectedItems} />
        ))}
        <LayerRow project={project} layer={null} state={unassigned} selectedItems={selectedItems} />
        {layers.length === 0 && (
          <div className="layers-empty">
            <p className="field-hint">
              Sort items into layers (Kitchen, Lighting, Decor…) to show, hide, lock or select them together. Layers only organise
              items; they don't change what is drawn in front.
            </p>
            <Button size="sm" variant="primary" onClick={() => newLayerFromSelection()}>
              <Plus size={13} /> {selectedItems ? 'New layer from selection' : 'New layer'}
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
});

function LayerRow({
  project,
  layer,
  state,
  selectedItems,
}: {
  project: Project;
  /** null = the implicit Unassigned row. */
  layer: ItemLayer | null;
  state?: { visible: boolean; locked: boolean };
  selectedItems: number;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const selection = useEditorStore((s) => s.selection);
  const id = layer?.id ?? null;
  const name = layer?.name ?? 'Unassigned';
  const visible = layer ? layer.visible : (state?.visible ?? true);
  const locked = layer ? layer.locked : (state?.locked ?? false);
  const items = objectsInLayer(project, id);
  const selectedIds = new Set(selection.map((s) => s.id));
  const current = items.length > 0 && items.every((o) => selectedIds.has(o.id));
  const set = (label: string, patch: { visible?: boolean; locked?: boolean }) =>
    exec(label, (d) => (layer ? updateItemLayer(d, layer.id, patch) : updateUnassignedLayer(d, patch)));

  const remove = async () => {
    if (!layer) return;
    const ok =
      items.length === 0 ||
      (await confirmAction({
        title: `Delete layer “${layer.name}”?`,
        message: `Its ${items.length} item${items.length > 1 ? 's stay' : ' stays'} in the plan and go${items.length > 1 ? '' : 'es'} back to Unassigned. You can undo this.`,
        confirmLabel: 'Delete layer',
        danger: true,
      }));
    if (ok) {
      exec(`Delete layer ${layer.name}`, (d) => deleteItemLayer(d, layer.id));
      pruneHiddenSelection();
    }
  };

  return (
    <div className={`item-layer${visible ? '' : ' is-hidden'}${current ? ' is-current' : ''}`} data-testid={`item-layer-${id ?? 'unassigned'}`}>
      <div className="item-layer-row">
        <button
          type="button"
          className={`item-layer-chev${open ? ' open' : ''}`}
          aria-expanded={open}
          aria-label={open ? `Collapse ${name}` : `List the items of ${name}`}
          disabled={!items.length}
          onClick={() => setOpen(!open)}
        >
          <ChevronRight size={13} />
        </button>
        {layer ? (
          <button
            type="button"
            className="item-layer-dot"
            style={{ background: layer.color ?? 'var(--text-3)' }}
            title="Change colour"
            aria-label={`Change the colour of ${name}`}
            onClick={() => {
              const i = ITEM_LAYER_COLORS.indexOf((layer.color ?? '') as (typeof ITEM_LAYER_COLORS)[number]);
              const color = ITEM_LAYER_COLORS[(i + 1) % ITEM_LAYER_COLORS.length];
              exec('Layer colour', (d) => updateItemLayer(d, layer.id, { color }));
            }}
          />
        ) : (
          <span className="item-layer-dot none" aria-hidden />
        )}
        {editing && layer ? (
          <LayerNameInput name={layer.name} onDone={(v) => {
            setEditing(false);
            if (v && v !== layer.name) exec('Rename layer', (d) => updateItemLayer(d, layer.id, { name: v }));
          }} />
        ) : (
          <button
            type="button"
            className={`item-layer-name${layer ? '' : ' fixed'}`}
            title={layer ? 'Rename (click)' : 'Items on no layer'}
            onClick={() => layer && setEditing(true)}
          >
            {name}
          </button>
        )}
        <span className="item-layer-count" title={`${items.length} item${items.length === 1 ? '' : 's'}`}>
          {items.length}
        </span>
        <IconButton
          label={visible ? `Hide ${name}` : `Show ${name}`}
          active={!visible}
          onClick={() => {
            set(visible ? `Hide ${name}` : `Show ${name}`, { visible: !visible });
            pruneHiddenSelection();
          }}
          data-testid="layer-visible"
        >
          {visible ? <Eye size={14} /> : <EyeOff size={14} />}
        </IconButton>
        <IconButton label={locked ? `Unlock ${name}` : `Lock ${name}`} active={locked} onClick={() => set(locked ? `Unlock ${name}` : `Lock ${name}`, { locked: !locked })} data-testid="layer-lock">
          {locked ? <Lock size={14} /> : <Unlock size={14} />}
        </IconButton>
        <IconButton label={`Select all in ${name}`} disabled={!items.length || !visible} onClick={() => selectLayerItems(id)} data-testid="layer-select">
          <SquareMousePointer size={14} />
        </IconButton>
        <IconButton
          label={selectedItems ? `Move the ${selectedItems} selected item${selectedItems > 1 ? 's' : ''} to ${name}` : 'Select items to move them here'}
          disabled={!selectedItems}
          onClick={() => moveSelectionToLayer(id)}
          data-testid="layer-move-here"
        >
          <FolderInput size={14} />
        </IconButton>
        {layer ? (
          <IconButton label={`Delete ${name}`} onClick={() => void remove()} data-testid="layer-delete">
            <Trash2 size={14} />
          </IconButton>
        ) : (
          <span className="item-layer-spacer" />
        )}
      </div>
      {open && items.length > 0 && (
        <ul className="item-layer-items">
          {items
            .map((o) => ({ o, label: itemName(project, o) }))
            .sort((a, b) => a.label.localeCompare(b.label))
            .map(({ o, label }) => (
              <li key={o.id}>
                <button
                  type="button"
                  className={`item-layer-item${selectedIds.has(o.id) ? ' on' : ''}${isObjectHidden(project, o) ? ' dim' : ''}`}
                  onClick={(e) =>
                    e.shiftKey || e.ctrlKey || e.metaKey
                      ? useEditorStore.getState().toggleSelection({ kind: 'object', id: o.id })
                      : useEditorStore.getState().setSelection([{ kind: 'object', id: o.id }])
                  }
                >
                  <span>{label}</span>
                  {o.hidden && <EyeOff size={12} aria-label="Hidden" />}
                  {o.locked && <Lock size={12} aria-label="Locked" />}
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

function LayerNameInput({ name, onDone }: { name: string; onDone: (v: string) => void }) {
  const [value, setValue] = useState(name);
  const done = useRef(false);
  const finish = (v: string) => {
    if (done.current) return;
    done.current = true;
    onDone(v);
  };
  return (
    <input
      className="input item-layer-input"
      value={value}
      autoFocus
      maxLength={60}
      aria-label="Layer name"
      onFocus={(e) => e.target.select()}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => finish(value.trim())}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') finish(value.trim());
        if (e.key === 'Escape') finish(name);
      }}
    />
  );
}

const NEW_LAYER = '__new';
const MIXED = '__mixed';

/** Inspector field: the item layer of the selected items, with "New layer…" at the end. */
export function ItemLayerField({ project, ids }: { project: Project; ids: string[] }) {
  const layers = project.itemLayers ?? [];
  const known = new Set(layers.map((l) => l.id));
  const values = new Set(ids.map((id) => project.objects[id]?.layerId).map((l) => (l && known.has(l) ? l : '')));
  const value = values.size === 1 ? [...values][0] : MIXED;
  const options = [
    ...(value === MIXED ? [{ value: MIXED, label: 'Mixed' }] : []),
    { value: '', label: 'Unassigned' },
    ...layers.map((l) => ({ value: l.id, label: `${l.name}${l.visible ? '' : ' (hidden)'}${l.locked ? ' (locked)' : ''}` })),
    { value: NEW_LAYER, label: 'New layer…' },
  ];
  return (
    <Select
      label="Layer"
      value={value}
      options={options}
      onChange={(v) => {
        if (v === MIXED) return;
        if (v === NEW_LAYER) {
          newLayerFromSelection();
          useEditorStore.getState().set({ layersPanelOpen: true });
          return;
        }
        exec('Move to layer', (d) => setObjectsLayer(d, ids, v || null));
        pruneHiddenSelection();
      }}
    />
  );
}

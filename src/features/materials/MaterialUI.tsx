import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Copy, Link2, Link2Off, Pencil, Search, Star, Trash2 } from 'lucide-react';
import { MaterialSchema, type MaterialCategory, type MaterialDefinition, type PhotoTextureRef, type Project } from '@/domain/model/schema';
import {
  assignMaterial,
  createOverride,
  deleteMaterial,
  duplicateMaterial,
  expandScope,
  materialUsage,
  updateMaterial,
  type MaterialScope,
  type MaterialTarget,
} from '@/domain/commands/entities';
import { MATERIAL_CATALOG, MATERIAL_CATALOG_BY_ID, MATERIAL_CATEGORY_LABELS } from '@/data/materials/catalog';
import { allPatternIds, patternInfo } from '@/data/materials/patterns';
import { PHOTO_SETS, PHOTO_SETS_BY_ID, PHOTO_SOURCE_NAMES, photoSetUrl } from '@/data/materials/photoSets';
import { assetSlotDefault, getAsset, resolveMaterial } from '@/data/assets/registry';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore } from '@/state/editorStore';
import { confirmAction, toast, usePrefsStore, useDialogStore } from '@/state/uiStores';
import { Button, ColorField, IconButton, Segmented, Select, Slider, TextField } from '@/components/ui';
import { Dialog } from '@/components/Overlays';
import { useIsMobile } from '@/components/hooks';
import { swatchBackground } from './textureCache';
import { getPhotoManifest, photoEntry, photoSetFailed, photoVersion, subscribePhotos } from './photoTextures';
import './materials.css';

/** Re-renders when photo textures finish loading (swatches switch from procedural to photo). */
function usePhotoVersion(): number {
  return useSyncExternalStore(subscribePhotos, photoVersion, photoVersion);
}

export function MaterialSwatch({
  material,
  size = 28,
  fill = false,
  title,
}: {
  material: Pick<MaterialDefinition, 'color' | 'texture' | 'opacity' | 'metalness'> & Partial<Pick<MaterialDefinition, 'photo'>>;
  size?: number;
  /** Fill the container's width as a square instead of a fixed size. */
  fill?: boolean;
  title?: string;
}) {
  usePhotoVersion();
  const box = fill ? { width: '100%', aspectRatio: '1 / 1' } : { width: size, height: size };
  return <span className="mat-swatch" style={{ ...box, background: swatchBackground(material) }} title={title} aria-hidden />;
}

/** All materials available to pick: the project's own (incl. edited copies) plus the catalogue. */
export function availableMaterials(project: Project): MaterialDefinition[] {
  const seen = new Set<string>();
  const out: MaterialDefinition[] = [];
  for (const m of Object.values(project.materials)) {
    if (m.overrideOf) continue;
    seen.add(m.id);
    out.push(m);
  }
  for (const m of MATERIAL_CATALOG) if (!seen.has(m.id)) out.push(m);
  return out;
}

// ───────────── Live (transactional) material edits ─────────────

let liveTx = false;
function livePreview(id: string, patch: Partial<MaterialDefinition>) {
  const store = useProjectStore.getState();
  if (!liveTx) {
    store.begin('Edit material');
    liveTx = true;
  }
  store.preview((d) => updateMaterial(d, id, patch));
}
function liveCommit(id: string, patch: Partial<MaterialDefinition>) {
  const store = useProjectStore.getState();
  if (liveTx) {
    liveTx = false;
    store.commit((d) => updateMaterial(d, id, patch));
  } else store.execute('Edit material', (d) => updateMaterial(d, id, patch));
}

// ───────────── Slot row + picker ─────────────

const SCOPE_LABELS: Record<MaterialScope, string> = {
  this: 'This surface only',
  'walls-of-role': 'All walls of this type',
  'asset-instances': 'Every copy of this item',
  'rooms-of-type': 'All rooms of this type',
  'same-material': 'Everywhere this finish is used',
};

export function scopesFor(target: MaterialTarget): MaterialScope[] {
  switch (target.kind) {
    case 'wall-side':
    case 'wall-both':
      return ['this', 'walls-of-role', 'same-material'];
    case 'room-floor':
    case 'room-ceiling':
      return ['this', 'rooms-of-type', 'same-material'];
    case 'object-slot':
      return ['this', 'asset-instances', 'same-material'];
    default:
      return ['this', 'same-material'];
  }
}

/** Identifies a slot row: its target plus its label (two rows may share a target, e.g. a half wall's cap). */
export const slotKey = (target: MaterialTarget, label: string) => `${JSON.stringify(target)}#${label}`;

export function MaterialSlotRow({
  label,
  target,
  materialId,
  testId,
}: {
  label: string;
  target: MaterialTarget;
  materialId: string;
  testId?: string;
}) {
  const project = useProjectStore((s) => s.project!);
  const m = resolveMaterial(project, materialId);
  const isMobile = useIsMobile();
  const key = slotKey(target, label);
  // Desktop: the picker opens as a panel docked beside the Inspector (MaterialPanel). Mobile: inline popover.
  const panelOpen = useEditorStore((s) => s.materialPicker?.key === key);
  const [inlineOpen, setInlineOpen] = useState(false);
  const open = isMobile ? inlineOpen : panelOpen;
  const usage = useMemo(() => materialUsage(project, m.id).length, [project, m.id]);
  const isOverride = !!m.overrideOf;
  const toggle = () => {
    if (isMobile) return setInlineOpen(!inlineOpen);
    useEditorStore.getState().set({ materialPicker: panelOpen ? null : { key, label, target, fallbackId: materialId } });
  };
  return (
    <div className="mat-slot" data-testid={testId}>
      <button
        type="button"
        className={`mat-slot-btn${open ? ' on' : ''}`}
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`${label}: ${m.name}. Change finish`}
      >
        <MaterialSwatch material={m} />
        <span className="mat-slot-text">
          <span className="mat-slot-label">{label}</span>
          <span className="mat-slot-name">{m.name}</span>
        </span>
        {isOverride ? (
          <span className="badge badge-warn" title="Unlinked: this surface has its own copy">
            <Link2Off size={11} /> Override
          </span>
        ) : usage > 1 ? (
          <span className="badge" title={`Shared with ${usage - 1} other surface(s). Editing the material changes all of them.`}>
            <Link2 size={11} /> {usage}
          </span>
        ) : null}
      </button>
      {isMobile && inlineOpen && <InlineMaterialPicker target={target} currentId={m.id} onClose={() => setInlineOpen(false)} />}
    </div>
  );
}

/** Mobile: the picker as a popover under its slot row; closes on an outside press and after a pick. */
function InlineMaterialPicker({ target, currentId, onClose }: { target: MaterialTarget; currentId: string; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node) && !(e.target as Element).closest?.('.mat-slot-btn')) onClose();
    };
    window.addEventListener('pointerdown', onDown, true);
    return () => window.removeEventListener('pointerdown', onDown, true);
  }, [onClose]);
  return (
    <div ref={ref} className="mat-picker popover" role="dialog" aria-label="Choose finish">
      <FinishPicker target={target} currentId={currentId} variant="popover" onClose={onClose} />
    </div>
  );
}

/**
 * Search, filter and a swatch grid of finishes for one slot, with the apply scope, favourites, edit and unlink.
 * `popover` (mobile) closes after a pick; `panel` (the desktop side panel) applies and stays open so several
 * finishes can be tried one after another.
 */
export function FinishPicker({
  target,
  currentId,
  variant,
  onClose,
  onEdit,
}: {
  target: MaterialTarget;
  currentId: string;
  variant: 'popover' | 'panel';
  onClose: () => void;
  /** Panel: opens a material in the panel's edit mode (shows pencil buttons). */
  onEdit?: (materialId: string) => void;
}) {
  const project = useProjectStore((s) => s.project!);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<MaterialCategory | 'all' | 'project'>('project');
  const [scope, setScope] = useState<MaterialScope>('this');
  const favourites = usePrefsStore((s) => s.favouriteMaterials);
  const recents = usePrefsStore((s) => s.recentMaterials);
  const panel = variant === 'panel';
  const gridRef = useRef<HTMLDivElement>(null);
  // Panel: start with the current finish in view (the panel remounts per slot).
  useEffect(() => {
    const grid = gridRef.current;
    const on = grid?.querySelector<HTMLElement>('.mat-cell.on');
    if (!panel || !grid || !on) return;
    const g = grid.getBoundingClientRect();
    const r = on.getBoundingClientRect();
    if (r.top < g.top || r.bottom > g.bottom) grid.scrollTop += r.top - g.top - (grid.clientHeight - r.height) / 2;
  }, [panel]);
  const all = useMemo(() => availableMaterials(project), [project]);
  const usedIds = useMemo(() => new Set(Object.keys(project.materials)), [project.materials]);
  const list = all.filter((m) => {
    if (query && !`${m.name} ${m.category}`.toLowerCase().includes(query.toLowerCase())) return false;
    if (category === 'project') return usedIds.has(m.id) || favourites.includes(m.id) || recents.includes(m.id);
    if (category === 'all') return true;
    return m.category === category;
  });
  const targets = expandScope(project, target, scope, assetSlotDefault);
  const current = resolveMaterial(project, currentId);
  const usage = useMemo(() => materialUsage(project, current.id).length, [project, current.id]);
  const isFav = (id: string) => favourites.includes(id);
  const toggleFavourite = (id: string) => usePrefsStore.getState().toggleFavouriteMaterial(id);
  const apply = (id: string) => {
    useProjectStore.getState().execute(`Apply ${resolveMaterial(project, id).name.toLowerCase()}`, (d) => assignMaterial(d, targets, id));
    usePrefsStore.getState().pushRecentMaterial(id);
    if (!panel) onClose();
  };
  const makeOverride = () => {
    useProjectStore.getState().execute('Unlink surface material', (d) => {
      const nid = createOverride(d, target, currentId);
      if (nid) useEditorStore.getState().set({ activeMaterialId: nid });
    });
    if (!panel) onClose();
  };
  const editCurrent = () => {
    useEditorStore.getState().set({ activeMaterialId: currentId, libraryOpen: true, libraryTab: 'materials' });
    onClose();
  };
  const actions = (
    <div className="mat-picker-actions">
      {!panel && (
        <Button size="sm" variant="ghost" onClick={editCurrent} title="Open this material in the material editor">
          Edit “{current.name}”
        </Button>
      )}
      {!current.overrideOf && (
        <Button size="sm" variant="ghost" onClick={makeOverride} title="Give this surface its own copy so edits don't affect other surfaces">
          <Link2Off size={13} /> Unlink
        </Button>
      )}
    </div>
  );
  return (
    <>
      {panel && (
        <div className="mat-current">
          <div className="mat-current-row">
            <MaterialSwatch material={current} size={44} />
            <div className="mat-current-text">
              <span className="mat-current-name">{current.name}</span>
              <span className="field-hint">
                {MATERIAL_CATEGORY_LABELS[current.category]}
                {current.overrideOf ? ' · unlinked copy' : usage > 1 ? ` · shared by ${usage} surfaces` : ''}
              </span>
            </div>
            {onEdit && (
              <IconButton label={`Edit “${current.name}”`} onClick={() => onEdit(current.id)}>
                <Pencil size={14} />
              </IconButton>
            )}
            <IconButton label={isFav(current.id) ? 'Remove from favourites' : 'Add to favourites'} active={isFav(current.id)} onClick={() => toggleFavourite(current.id)}>
              <Star size={15} className={isFav(current.id) ? 'fav-star' : undefined} />
            </IconButton>
          </div>
          {actions}
        </div>
      )}
      <div className="mat-picker-head">
        <div className="search-box">
          <Search size={13} aria-hidden />
          <input className="input" placeholder="Search finishes" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus={!panel} onKeyDown={(e) => e.stopPropagation()} aria-label="Search finishes" />
        </div>
        <select className="input select" value={category} onChange={(e) => setCategory(e.target.value as typeof category)} aria-label="Category">
          <option value="project">In this project & favourites</option>
          <option value="all">All finishes</option>
          {Object.entries(MATERIAL_CATEGORY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div ref={gridRef} className="mat-grid" role="listbox" aria-label="Finishes">
        {list.length === 0 && <p className="field-hint mat-grid-empty">No finishes match. Try “All finishes”.</p>}
        {list.map((m) => (
          <div key={m.id} className="mat-cell-wrap" role="presentation">
            <button
              type="button"
              role="option"
              aria-selected={m.id === currentId}
              className={`mat-cell${m.id === currentId ? ' on' : ''}`}
              onClick={() => apply(m.id)}
              title={`${m.name} — ${MATERIAL_CATEGORY_LABELS[m.category]}`}
            >
              {panel ? <MaterialSwatch material={m} fill /> : <MaterialSwatch material={m} size={40} />}
              <span className="mat-cell-name">{m.name}</span>
            </button>
            <button
              type="button"
              className={`mat-fav${isFav(m.id) ? ' on' : ''}`}
              aria-label={isFav(m.id) ? `Remove ${m.name} from favourites` : `Add ${m.name} to favourites`}
              aria-pressed={isFav(m.id)}
              title={isFav(m.id) ? 'Remove from favourites' : 'Add to favourites'}
              onClick={() => toggleFavourite(m.id)}
            >
              <Star size={12} />
            </button>
            {onEdit && (
              <button type="button" className="mat-edit" aria-label={`Edit ${m.name}`} title="Edit this finish" onClick={() => onEdit(m.id)}>
                <Pencil size={11} />
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="mat-picker-foot">
        <label className="field-label" htmlFor={`mat-scope-${variant}`}>
          Apply to
        </label>
        <select id={`mat-scope-${variant}`} className="input select" value={scope} onChange={(e) => setScope(e.target.value as MaterialScope)}>
          {scopesFor(target).map((s) => (
            <option key={s} value={s}>
              {SCOPE_LABELS[s]}
            </option>
          ))}
        </select>
        <span className="field-hint">{targets.length === 1 ? 'Changes one surface.' : `Changes ${targets.length} surfaces.`}</span>
        {!panel && actions}
      </div>
    </>
  );
}

// ───────────── Material library + editor ─────────────

export function MaterialLibrary() {
  const project = useProjectStore((s) => s.project!);
  const activeId = useEditorStore((s) => s.activeMaterialId);
  const favourites = usePrefsStore((s) => s.favouriteMaterials);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<MaterialCategory | 'all' | 'project' | 'favourites'>('project');
  const all = useMemo(() => [...availableMaterials(project), ...Object.values(project.materials).filter((m) => m.overrideOf)], [project]);
  const usedIds = useMemo(() => new Set(Object.keys(project.materials)), [project.materials]);
  const list = all.filter((m) => {
    if (query && !`${m.name} ${m.category}`.toLowerCase().includes(query.toLowerCase())) return false;
    if (category === 'project') return usedIds.has(m.id);
    if (category === 'favourites') return favourites.includes(m.id);
    if (category === 'all') return true;
    return m.category === category;
  });
  const active = activeId ? project.materials[activeId] ?? MATERIAL_CATALOG_BY_ID[activeId] : null;
  return (
    <div className="mat-library">
      <div className="lib-filters">
        <div className="search-box">
          <Search size={13} aria-hidden />
          <input className="input" placeholder="Search materials" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.stopPropagation()} aria-label="Search materials" />
        </div>
        <select className="input select" value={category} onChange={(e) => setCategory(e.target.value as typeof category)} aria-label="Material category">
          <option value="project">Used in this project</option>
          <option value="favourites">Favourites</option>
          <option value="all">All materials</option>
          {Object.entries(MATERIAL_CATEGORY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div className="mat-list" role="listbox" aria-label="Materials">
        {list.length === 0 && <p className="field-hint pad">Nothing here yet. Choose “All materials” to browse the library.</p>}
        {list.map((m) => (
          <button
            key={m.id}
            type="button"
            role="option"
            aria-selected={m.id === activeId}
            className={`mat-row${m.id === activeId ? ' on' : ''}`}
            onClick={() => useEditorStore.getState().set({ activeMaterialId: m.id })}
          >
            <MaterialSwatch material={m} size={30} />
            <span className="mat-row-text">
              <span>{m.name}</span>
              <span className="field-hint">
                {MATERIAL_CATEGORY_LABELS[m.category]}
                {m.overrideOf ? ' · override' : ''}
              </span>
            </span>
            {favourites.includes(m.id) && <Star size={12} className="fav-star" aria-label="Favourite" />}
          </button>
        ))}
      </div>
      {active && <MaterialEditor material={active} />}
    </div>
  );
}

/**
 * Material editor. `inPanel` is the finish panel's edit mode: no "Apply to selection" (the
 * panel applies finishes to its own slot).
 */
export function MaterialEditor({ material, inPanel = false }: { material: MaterialDefinition; inPanel?: boolean }) {
  const project = useProjectStore((s) => s.project!);
  const favourites = usePrefsStore((s) => s.favouriteMaterials);
  const usage = useMemo(() => materialUsage(project, material.id), [project, material.id]);
  const inProject = !!project.materials[material.id];
  const id = material.id;
  const commit = (patch: Partial<MaterialDefinition>) => liveCommit(id, patch);
  const preview = (patch: Partial<MaterialDefinition>) => livePreview(id, patch);
  const selection = useEditorStore((s) => s.selection);
  usePhotoVersion();

  const onDelete = async () => {
    if (usage.length) {
      useDialogStore.getState().open('replace-material', { materialId: id });
      return;
    }
    const ok = await confirmAction({ title: `Delete “${material.name}”?`, message: 'This material is not used anywhere. It will be removed from the project.', confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    useProjectStore.getState().execute('Delete material', (d) => deleteMaterial(d, id, 'solid-light-grey'));
    useEditorStore.getState().set({ activeMaterialId: null });
  };
  const onDuplicate = () => {
    const nid = useProjectStore.getState().execute('Duplicate material', (d) => duplicateMaterial(d, id));
    if (nid) {
      useEditorStore.getState().set({ activeMaterialId: nid });
      toast.info('Material duplicated', 'The copy is independent — edit it freely.');
    }
  };
  const applyToSelection = () => {
    const p = useProjectStore.getState().project!;
    const targets: MaterialTarget[] = [];
    for (const s of selection) {
      if (s.kind === 'wall') targets.push({ kind: 'wall-both', wallId: s.id });
      if (s.kind === 'room') targets.push({ kind: 'room-floor', roomId: s.id });
      if (s.kind === 'object') {
        const o = p.objects[s.id];
        const slot = o ? getAsset(p, o.assetId)?.slots[0]?.id : undefined;
        if (slot) targets.push({ kind: 'object-slot', objectId: s.id, slot });
      }
    }
    if (!targets.length) return toast.info('Select walls, rooms or objects first');
    useProjectStore.getState().execute('Apply material', (d) => assignMaterial(d, targets, id));
  };
  return (
    <div className={`mat-editor${inPanel ? ' in-panel' : ''}`} data-testid="material-editor">
      <div className="mat-preview" style={{ background: swatchBackground(material) }}>
        <span className="mat-preview-sheen" />
      </div>
      <div className="mat-editor-head">
        <TextField label="Name" value={material.name} onCommit={(name) => commit({ name })} />
        <div className="mat-editor-tools">
          <IconButton
            label={favourites.includes(id) ? 'Remove from favourites' : 'Add to favourites'}
            active={favourites.includes(id)}
            onClick={() => usePrefsStore.getState().toggleFavouriteMaterial(id)}
          >
            <Star size={15} />
          </IconButton>
          <IconButton label="Duplicate as new material" onClick={onDuplicate}>
            <Copy size={15} />
          </IconButton>
          <IconButton label="Delete material" onClick={() => void onDelete()} disabled={!inProject}>
            <Trash2 size={15} />
          </IconButton>
        </div>
      </div>
      <p className="field-hint">
        {usage.length === 0
          ? 'Not used yet. Pick it from a surface, or apply it to the selection.'
          : `Linked to ${usage.length} surface${usage.length > 1 ? 's' : ''} — edits update all of them.`}
        {material.overrideOf && ` Unlinked copy of “${resolveMaterial(project, material.overrideOf).name}”.`}
      </p>
      {!inPanel && selection.length > 0 && (
        <Button size="sm" onClick={applyToSelection}>
          Apply to selection
        </Button>
      )}
      <ColorField label="Base colour" value={material.color} onPreview={(c) => preview({ color: c })} onCommit={(c) => commit({ color: c })} />
      <div className="quick-swatches" role="group" aria-label="Quick colours">
        {['#f4f2ed', '#d9d4ca', '#a8b5a0', '#8fa3b5', '#c4775a', '#d2a24c', '#3c3f42', '#1c1c1e', '#6b4a33', '#c49a6c'].map((c) => (
          <button key={c} type="button" style={{ background: c }} aria-label={`Colour ${c}`} onClick={() => commit({ color: c })} />
        ))}
      </div>
      <Slider label="Roughness" value={material.roughness} min={0} max={1} step={0.01} onChange={(v) => preview({ roughness: v })} onCommit={(v) => commit({ roughness: v })} />
      <Slider label="Metalness" value={material.metalness} min={0} max={1} step={0.01} onChange={(v) => preview({ metalness: v })} onCommit={(v) => commit({ metalness: v })} />
      <Slider label="Opacity" value={material.opacity} min={0.05} max={1} step={0.01} onChange={(v) => preview({ opacity: v })} onCommit={(v) => commit({ opacity: v })} />
      <TextureControls material={material} preview={preview} commit={commit} />
      <p className="field-hint">Source: {material.source.name} · {material.source.license}</p>
    </div>
  );
}

/**
 * What "Reset to default" restores a material to: the material an unlinked copy was made from,
 * or the catalogue entry it came from. Null for materials made from scratch.
 */
export function defaultMaterialFor(project: Project, m: MaterialDefinition): MaterialDefinition | null {
  const base = m.overrideOf ? resolveMaterial(project, m.overrideOf) : MATERIAL_CATALOG_BY_ID[m.catalogId ?? m.id];
  if (!base) return null;
  // Catalogue entries leave schema defaults out; fill them in so they compare like project copies.
  const parsed = MaterialSchema.safeParse({ ...base, metalness: base.metalness ?? 0 });
  return parsed.success ? parsed.data : base;
}

const LOOK_KEYS = ['color', 'roughness', 'metalness', 'opacity', 'emissive', 'emissiveIntensity', 'texture', 'photo'] as const;

/** True when the material looks different from its default (so a reset would change something). */
export function differsFromDefault(project: Project, m: MaterialDefinition): boolean {
  const base = defaultMaterialFor(project, m);
  if (!base) return false;
  return LOOK_KEYS.some((k) => JSON.stringify(m[k] ?? null) !== JSON.stringify(base[k] ?? null));
}

/** Restores a material's look (colour, surface values, textures) to its default; keeps its name and links. */
export function resetMaterialToDefault(id: string) {
  const store = useProjectStore.getState();
  const p = store.project!;
  const m = resolveMaterial(p, id);
  const base = defaultMaterialFor(p, m);
  if (!base) return;
  const patch: Partial<MaterialDefinition> = {};
  for (const k of LOOK_KEYS) (patch as Record<string, unknown>)[k] = structuredClone(base[k] ?? null);
  store.execute(`Reset ${m.name.toLowerCase()}`, (d) => updateMaterial(d, id, patch));
}

/** Photo set suggested when switching a material without one to photo. */
const CATEGORY_PHOTO: Partial<Record<MaterialCategory, string>> = {
  paint: 'plaster',
  plaster: 'plaster',
  wood: 'oak-veneer',
  laminate: 'oak-veneer',
  tile: 'tile-square',
  stone: 'marble-white',
  metal: 'brushed-metal',
  fabric: 'cotton',
  leather: 'leather',
  rug: 'wool-carpet',
  solid: 'microcement',
};

function defaultPhotoFor(m: MaterialDefinition): PhotoTextureRef | null {
  const fromCatalog = m.catalogId ? MATERIAL_CATALOG_BY_ID[m.catalogId]?.photo : null;
  if (fromCatalog) return { ...fromCatalog, enabled: true };
  const set = PHOTO_SETS_BY_ID[CATEGORY_PHOTO[m.category] ?? ''] ?? PHOTO_SETS[0];
  if (!set) return null;
  const subtle = m.category === 'paint' || m.category === 'solid';
  return { setId: set.id, scale: set.size, rotation: 0, contrast: subtle ? 0.4 : 1, enabled: true };
}

/** Texture source switch (photo ↔ procedural) with the controls for the active one. */
function TextureControls({
  material,
  preview,
  commit,
}: {
  material: MaterialDefinition;
  preview: (patch: Partial<MaterialDefinition>) => void;
  commit: (patch: Partial<MaterialDefinition>) => void;
}) {
  usePhotoVersion();
  const photo = material.photo;
  const mode: 'photo' | 'procedural' = photo?.enabled ? 'photo' : 'procedural';
  const manifest = getPhotoManifest();
  const set = photo ? PHOTO_SETS_BY_ID[photo.setId] : undefined;
  const missing = !!photo?.enabled && ((manifest !== undefined && !photoEntry(photo.setId)) || photoSetFailed(photo.setId));
  const fallbackName = material.texture ? (patternInfo(material.texture.patternId)?.name ?? material.texture.patternId) : null;
  const withPhoto = (patch: Partial<PhotoTextureRef>): Partial<MaterialDefinition> => ({ photo: { ...photo!, ...patch } });
  return (
    <>
      <div className="field">
        <span className="field-label">Texture</span>
        <Segmented
          label="Texture source"
          size="sm"
          value={mode}
          onChange={(v) => {
            if (v === 'photo') {
              const next = photo ? { ...photo, enabled: true } : defaultPhotoFor(material);
              if (next) commit({ photo: next });
            } else if (photo) commit({ photo: { ...photo, enabled: false } });
          }}
          options={[
            { value: 'photo', label: 'Photo', title: 'CC0 photo texture (colour, relief and roughness maps)', testId: 'texture-photo' },
            { value: 'procedural', label: 'Procedural', title: 'Built-in generated pattern', testId: 'texture-procedural' },
          ]}
        />
      </div>
      {mode === 'photo' && photo ? (
        <>
          <Select
            label="Photo texture"
            value={photo.setId}
            onChange={(v) => commit(withPhoto({ setId: v, scale: PHOTO_SETS_BY_ID[v]?.size ?? photo.scale }))}
            options={[
              ...(set ? [] : [{ value: photo.setId, label: `${photo.setId} (unknown)` }]),
              ...PHOTO_SETS.map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
          {missing && (
            <p className="field-hint mat-photo-missing" role="status">
              Photo files aren’t available here, so the procedural {fallbackName ? `“${fallbackName}”` : ''} texture is shown. Run{' '}
              <code>npm run textures</code> to download them.
            </p>
          )}
          {manifest === undefined && <p className="field-hint">Loading photo textures…</p>}
          <Slider
            label="Photo tile size"
            value={photo.scale}
            min={0.05}
            max={6}
            step={0.05}
            format={(v) => `${v.toFixed(2)} m`}
            onChange={(v) => preview(withPhoto({ scale: v }))}
            onCommit={(v) => commit(withPhoto({ scale: v }))}
          />
          <Slider
            label="Photo rotation"
            value={photo.rotation}
            min={0}
            max={180}
            step={5}
            format={(v) => `${v}°`}
            onChange={(v) => preview(withPhoto({ rotation: v }))}
            onCommit={(v) => commit(withPhoto({ rotation: v }))}
          />
          <Slider
            label="Photo strength"
            value={photo.contrast}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => preview(withPhoto({ contrast: v }))}
            onCommit={(v) => commit(withPhoto({ contrast: v }))}
          />
          {set && (
            <p className="field-hint">
              Photo:{' '}
              <a href={photoSetUrl(set)} target="_blank" rel="noreferrer">
                {PHOTO_SOURCE_NAMES[set.source]} {set.assetId}
              </a>{' '}
              · CC0 1.0{fallbackName ? ` · fallback: ${fallbackName}` : ''}
            </p>
          )}
        </>
      ) : (
        <ProceduralTextureControls material={material} preview={preview} commit={commit} />
      )}
    </>
  );
}

function ProceduralTextureControls({
  material,
  preview,
  commit,
}: {
  material: MaterialDefinition;
  preview: (patch: Partial<MaterialDefinition>) => void;
  commit: (patch: Partial<MaterialDefinition>) => void;
}) {
  return (
    <>
      <Select
        label="Pattern"
        value={material.texture?.patternId ?? '__none__'}
        onChange={(v) =>
          commit({
            texture: v === '__none__' ? null : { patternId: v, scale: material.texture?.scale ?? 1, rotation: material.texture?.rotation ?? 0, contrast: material.texture?.contrast ?? 1 },
          })
        }
        options={[{ value: '__none__', label: 'None (solid)' }, ...allPatternIds().map((p) => ({ value: p, label: patternInfo(p)?.name ?? p }))]}
      />
      {material.texture && (
        <>
          <Slider
            label="Texture tile size"
            value={material.texture.scale}
            min={0.05}
            max={5}
            step={0.05}
            format={(v) => `${v.toFixed(2)} m`}
            onChange={(v) => preview({ texture: { ...material.texture!, scale: v } })}
            onCommit={(v) => commit({ texture: { ...material.texture!, scale: v } })}
          />
          <Slider
            label="Texture rotation"
            value={material.texture.rotation}
            min={0}
            max={180}
            step={5}
            format={(v) => `${v}°`}
            onChange={(v) => preview({ texture: { ...material.texture!, rotation: v } })}
            onCommit={(v) => commit({ texture: { ...material.texture!, rotation: v } })}
          />
          <Slider
            label="Pattern strength"
            value={material.texture.contrast}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => preview({ texture: { ...material.texture!, contrast: v } })}
            onCommit={(v) => commit({ texture: { ...material.texture!, contrast: v } })}
          />
        </>
      )}
    </>
  );
}

/** Replacement flow when deleting a material that is still in use. */
export function ReplaceMaterialDialog({ materialId, onClose }: { materialId: string; onClose: () => void }) {
  const project = useProjectStore((s) => s.project!);
  const mats = availableMaterials(project).filter((m) => m.id !== materialId);
  const [replacement, setReplacement] = useState(mats[0]?.id ?? 'solid-light-grey');
  const usage = materialUsage(project, materialId).length;
  const m = resolveMaterial(project, materialId);
  return (
    <Dialog
      title={`Delete “${m.name}”`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="danger"
            onClick={() => {
              useProjectStore.getState().execute('Delete material', (d) => deleteMaterial(d, materialId, replacement));
              useEditorStore.getState().set({ activeMaterialId: replacement });
              onClose();
            }}
          >
            Replace & delete
          </Button>
        </>
      }
    >
      <p className="confirm-text">
        This material is used by {usage} surface{usage > 1 ? 's' : ''}. Choose a replacement so nothing is left without a finish.
      </p>
      <div style={{ marginTop: 12 }}>
        <Select label="Replace with" value={replacement} onChange={setReplacement} options={mats.map((x) => ({ value: x.id, label: x.name }))} />
      </div>
    </Dialog>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Link2, Link2Off, Search, Star, Trash2 } from 'lucide-react';
import type { MaterialCategory, MaterialDefinition, Project } from '@/domain/model/schema';
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
import { TEXTURE_PATTERN_IDS, TEXTURE_PATTERNS } from '@/data/materials/patterns';
import { assetSlotDefault, getAsset, resolveMaterial } from '@/data/assets/registry';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore } from '@/state/editorStore';
import { confirmAction, toast, usePrefsStore, useDialogStore } from '@/state/uiStores';
import { Button, ColorField, IconButton, Select, Slider, TextField } from '@/components/ui';
import { Dialog } from '@/components/Overlays';
import { swatchBackground } from './textureCache';
import './materials.css';

export function MaterialSwatch({ material, size = 28, title }: { material: Pick<MaterialDefinition, 'color' | 'texture' | 'opacity' | 'metalness'>; size?: number; title?: string }) {
  return <span className="mat-swatch" style={{ width: size, height: size, background: swatchBackground(material) }} title={title} aria-hidden />;
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
  const [open, setOpen] = useState(false);
  const usage = useMemo(() => materialUsage(project, m.id).length, [project, m.id]);
  const isOverride = !!m.overrideOf;
  return (
    <div className="mat-slot" data-testid={testId}>
      <button type="button" className="mat-slot-btn" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={`${label}: ${m.name}. Change finish`}>
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
      {open && <MaterialPicker target={target} currentId={m.id} onClose={() => setOpen(false)} />}
    </div>
  );
}

function MaterialPicker({ target, currentId, onClose }: { target: MaterialTarget; currentId: string; onClose: () => void }) {
  const project = useProjectStore((s) => s.project!);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<MaterialCategory | 'all' | 'project'>('project');
  const [scope, setScope] = useState<MaterialScope>('this');
  const favourites = usePrefsStore((s) => s.favouriteMaterials);
  const recents = usePrefsStore((s) => s.recentMaterials);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node) && !(e.target as Element).closest?.('.mat-slot-btn')) onClose();
    };
    window.addEventListener('pointerdown', onDown, true);
    return () => window.removeEventListener('pointerdown', onDown, true);
  }, [onClose]);
  const all = useMemo(() => availableMaterials(project), [project]);
  const usedIds = useMemo(() => new Set(Object.keys(project.materials)), [project.materials]);
  const list = all.filter((m) => {
    if (query && !`${m.name} ${m.category}`.toLowerCase().includes(query.toLowerCase())) return false;
    if (category === 'project') return usedIds.has(m.id) || favourites.includes(m.id) || recents.includes(m.id);
    if (category === 'all') return true;
    return m.category === category;
  });
  const targets = expandScope(project, target, scope, assetSlotDefault);
  const apply = (id: string) => {
    useProjectStore.getState().execute(`Apply ${resolveMaterial(project, id).name.toLowerCase()}`, (d) => assignMaterial(d, targets, id));
    usePrefsStore.getState().pushRecentMaterial(id);
    onClose();
  };
  const makeOverride = () => {
    useProjectStore.getState().execute('Unlink surface material', (d) => {
      const nid = createOverride(d, target, currentId);
      if (nid) useEditorStore.getState().set({ activeMaterialId: nid });
    });
    onClose();
  };
  const current = resolveMaterial(project, currentId);
  return (
    <div ref={ref} className="mat-picker popover" role="dialog" aria-label="Choose finish">
      <div className="mat-picker-head">
        <div className="search-box">
          <Search size={13} aria-hidden />
          <input className="input" placeholder="Search finishes" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus onKeyDown={(e) => e.stopPropagation()} aria-label="Search finishes" />
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
      <div className="mat-grid" role="listbox" aria-label="Finishes">
        {list.length === 0 && <p className="field-hint">No finishes match. Try “All finishes”.</p>}
        {list.map((m) => (
          <button
            key={m.id}
            type="button"
            role="option"
            aria-selected={m.id === currentId}
            className={`mat-cell${m.id === currentId ? ' on' : ''}`}
            onClick={() => apply(m.id)}
            title={`${m.name} — ${MATERIAL_CATEGORY_LABELS[m.category]}`}
          >
            <MaterialSwatch material={m} size={40} />
            <span>{m.name}</span>
          </button>
        ))}
      </div>
      <div className="mat-picker-foot">
        <label className="field-label" htmlFor="mat-scope">
          Apply to
        </label>
        <select id="mat-scope" className="input select" value={scope} onChange={(e) => setScope(e.target.value as MaterialScope)}>
          {scopesFor(target).map((s) => (
            <option key={s} value={s}>
              {SCOPE_LABELS[s]}
            </option>
          ))}
        </select>
        <span className="field-hint">
          {targets.length === 1 ? 'Changes one surface.' : `Changes ${targets.length} surfaces.`}
        </span>
        <div className="mat-picker-actions">
          <Button size="sm" variant="ghost" onClick={() => {
            useEditorStore.getState().set({ activeMaterialId: currentId, libraryOpen: true, libraryTab: 'materials' });
            onClose();
          }}>
            Edit “{current.name}”
          </Button>
          {!current.overrideOf && (
            <Button size="sm" variant="ghost" onClick={makeOverride} title="Give this surface its own copy so edits don't affect other surfaces">
              <Link2Off size={13} /> Unlink
            </Button>
          )}
        </div>
      </div>
    </div>
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

export function MaterialEditor({ material }: { material: MaterialDefinition }) {
  const project = useProjectStore((s) => s.project!);
  const favourites = usePrefsStore((s) => s.favouriteMaterials);
  const usage = useMemo(() => materialUsage(project, material.id), [project, material.id]);
  const inProject = !!project.materials[material.id];
  const id = material.id;
  const commit = (patch: Partial<MaterialDefinition>) => liveCommit(id, patch);
  const preview = (patch: Partial<MaterialDefinition>) => livePreview(id, patch);
  const selection = useEditorStore((s) => s.selection);

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
    <div className="mat-editor" data-testid="material-editor">
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
      {selection.length > 0 && (
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
      <Select
        label="Texture"
        value={material.texture?.patternId ?? '__none__'}
        onChange={(v) =>
          commit({
            texture: v === '__none__' ? null : { patternId: v, scale: material.texture?.scale ?? 1, rotation: material.texture?.rotation ?? 0, contrast: material.texture?.contrast ?? 1 },
          })
        }
        options={[{ value: '__none__', label: 'None (solid)' }, ...TEXTURE_PATTERN_IDS.map((p) => ({ value: p, label: TEXTURE_PATTERNS[p]?.name ?? p }))]}
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
      <p className="field-hint">Source: {material.source.name} · {material.source.license}</p>
    </div>
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

import type { ItemEdits, PartEdit, PlacedObject, Project } from '@/domain/model/schema';
import { getAsset } from '@/data/assets/registry';
import { withModel } from '@/data/assets/models';
import { MIN_SECTION, canEditShape, cleanEdits, editedParts, partBox, partSig, sectionInfo } from '@/data/assets/itemEdits';
import type { AssetDefinition } from '@/data/assets/types';
import { useEditorStore } from '@/state/editorStore';
import { useProjectStore } from '@/state/projectStore';
import { toast } from '@/state/uiStores';

/**
 * The shape editor's actions: entering and leaving it, and every change it makes to an item's
 * `edits` (one undo step each; the item goes back to its plain asset when nothing is left).
 */

/** The asset an item's edits apply to: its asset in its model variant, without the edits. */
export function editBase(project: Pick<Project, 'customAssets'>, o: Pick<PlacedObject, 'assetId' | 'model'>): AssetDefinition | null {
  return withModel(getAsset(project, o.assetId), o.model);
}

/** Whether the item can be opened in the shape editor. */
export function canEditItem(project: Project, objectId: string): boolean {
  const o = project.objects[objectId];
  return !!o && canEditShape(editBase(project, o));
}

/** Whether the shape editor can be opened now: it works in the 3D view only. */
export const shapeEditAvailable = (): boolean => useEditorStore.getState().workspace === '3d';

/** Opens the shape editor on an item (3D view only): the item with everything else in X-ray, no other tool. */
export function enterShapeEdit(objectId: string): void {
  const project = useProjectStore.getState().project;
  if (!project || !canEditItem(project, objectId) || !shapeEditAvailable()) return;
  const o = project.objects[objectId];
  if (o.locked || project.layers.furniture.locked) {
    toast.info('Unlock the item to edit its shape.');
    return;
  }
  const ed = useEditorStore.getState();
  const returnTo = ed.workspace === 'walk' ? '3d' : ed.workspace;
  ed.set({
    tool: 'select',
    placeAssetId: null,
    notesMode: false,
    hoveredNoteId: null,
    servicesMode: false,
    layersPanelOpen: false,
    materialPicker: null,
    chromeHidden: false,
    workspace: '3d',
    selection: [{ kind: 'object', id: objectId }],
    hover: null,
    shapeEdit: { objectId, part: null, hover: null, section: null, returnTo, detached: !!o.edits?.detached },
  });
  ed.requestFocus();
}

/** Leaves the shape editor, back to the view it was opened from (the item stays selected). */
export function exitShapeEdit(): void {
  const ed = useEditorStore.getState();
  const s = ed.shapeEdit;
  if (!s) return;
  ed.set({ shapeEdit: null, workspace: s.returnTo === 'walk' ? '3d' : s.returnTo, hover: null });
}

export function setShapeEditState(patch: Partial<Pick<NonNullable<ReturnType<typeof useEditorStore.getState>['shapeEdit']>, 'part' | 'hover' | 'section'>>): void {
  const ed = useEditorStore.getState();
  if (!ed.shapeEdit) return;
  const next = { ...ed.shapeEdit, ...patch };
  if (next.part === ed.shapeEdit.part && next.hover === ed.shapeEdit.hover && next.section === ed.shapeEdit.section) return;
  ed.set({ shapeEdit: next });
}

/** Changes the edited item's edits (one undo step); cleaned, and dropped when nothing is left. */
export function updateEdits(label: string, fn: (e: ItemEdits, o: PlacedObject, asset: AssetDefinition) => ItemEdits): void {
  const id = useEditorStore.getState().shapeEdit?.objectId;
  const project = useProjectStore.getState().project;
  if (!id || !project) return;
  const o = project.objects[id];
  const asset = o && editBase(project, o);
  if (!asset) return;
  useProjectStore.getState().execute(label, (d) => {
    const obj = d.objects[id];
    // From the committed item (a draft cannot be cloned).
    const next = cleanEdits(asset, fn(structuredClone(o.edits ?? {}), o, asset));
    if (next) obj.edits = next;
    else delete obj.edits;
  });
}

export const setParam = (id: string, label: string, value: number | boolean | string) =>
  updateEdits(`Set ${label.toLowerCase()}`, (e) => ({ ...e, params: { ...e.params, [id]: value } }));

/**
 * Sets the size of section `index` along an axis by moving one of its edges: the edge after it,
 * or for the last section the edge before it. The neighbour section takes up the difference.
 */
export function setSectionSize(axis: 'x' | 'y', index: number, size: number): void {
  updateEdits(axis === 'x' ? 'Set section width' : 'Set section height', (e, o, asset) => {
    const info = sectionInfo(asset, { w: o.width, d: o.depth, h: o.height }, e)[axis];
    const all = [info.lo, ...info.edges, info.hi];
    const n = info.edges.length;
    if (!n || index < 0 || index > n) return e;
    const edges = [...info.edges];
    if (index < n) {
      // Move the edge after the section (index → edges[index]).
      const lo = all[index] + MIN_SECTION;
      const hi = all[index + 2] - MIN_SECTION;
      edges[index] = Math.min(hi, Math.max(lo, all[index] + size));
    } else {
      const lo = all[n - 1] + MIN_SECTION;
      const hi = info.hi - MIN_SECTION;
      edges[n - 1] = Math.min(hi, Math.max(lo, info.hi - size));
    }
    return { ...e, sections: { ...e.sections, [axis]: { n, d: edges.map((v, i) => v - info.found[i]) } } };
  });
}

/** Attached parts follow part edits (on) or each part goes alone (off). */
export function setPartsFollow(follow: boolean): void {
  const ed = useEditorStore.getState();
  if (!ed.shapeEdit) return;
  ed.set({ shapeEdit: { ...ed.shapeEdit, detached: !follow } });
  const project = useProjectStore.getState().project;
  if (project?.objects[ed.shapeEdit.objectId]?.edits?.parts)
    updateEdits(follow ? 'Attached parts follow' : 'Parts move alone', (e) => ({ ...e, detached: follow ? undefined : true }));
}

/** Changes one part's edit (from its current values: grow and move add up). */
export function editPart(index: number, label: string, change: (pe: PartEdit) => PartEdit): void {
  const detached = useEditorStore.getState().shapeEdit?.detached;
  updateEdits(label, (e0, o, asset) => {
    const e = { ...e0, detached: detached ? true : undefined };
    const parts = editedParts(asset, { w: o.width, d: o.depth, h: o.height }, e);
    const p = parts[index];
    if (!p) return e;
    const sig = partSig(p.base);
    const cur = e.parts?.[String(index)];
    const pe: PartEdit = cur && cur.sig === sig ? { ...cur } : { sig };
    return { ...e, parts: { ...e.parts, [String(index)]: change(pe) } };
  });
}

const add3 = (a: [number, number, number] | undefined, b: [number, number, number]): [number, number, number] => [
  (a?.[0] ?? 0) + b[0],
  (a?.[1] ?? 0) + b[1],
  (a?.[2] ?? 0) + b[2],
];

/** Sets a part's size along item axes (null = unchanged), keeping its centre. */
export function setPartSize(index: number, size: [number | null, number | null, number | null]): void {
  editPart(index, 'Resize part', (pe) => {
    const project = useProjectStore.getState().project!;
    const o = project.objects[useEditorStore.getState().shapeEdit!.objectId];
    const asset = editBase(project, o)!;
    const now = partBox(editedParts(asset, { w: o.width, d: o.depth, h: o.height }, o.edits)[index].part).size;
    const d: [number, number, number] = [0, 0, 0];
    size.forEach((v, i) => {
      if (v !== null) d[i] = Math.max(0.005, v) - now[i];
    });
    return { ...pe, grow: add3(pe.grow, d) };
  });
}

/** Moves a part (its centre to `centre` along the given item axes; null = unchanged). */
export function setPartCentre(index: number, centre: [number | null, number | null, number | null]): void {
  editPart(index, 'Move part', (pe) => {
    const project = useProjectStore.getState().project!;
    const o = project.objects[useEditorStore.getState().shapeEdit!.objectId];
    const asset = editBase(project, o)!;
    const now = partBox(editedParts(asset, { w: o.width, d: o.depth, h: o.height }, o.edits)[index].part).centre;
    const d: [number, number, number] = [0, 0, 0];
    centre.forEach((v, i) => {
      if (v !== null) d[i] = v - now[i];
    });
    return { ...pe, move: add3(pe.move, d) };
  });
}

/** Scales a part evenly about its centre by `k` (1.1 = 10 % bigger). */
export function scalePart(index: number, k: number): void {
  const project = useProjectStore.getState().project!;
  const o = project.objects[useEditorStore.getState().shapeEdit!.objectId];
  const asset = editBase(project, o)!;
  const now = partBox(editedParts(asset, { w: o.width, d: o.depth, h: o.height }, o.edits)[index].part).size;
  editPart(index, 'Scale part', (pe) => ({ ...pe, grow: add3(pe.grow, [now[0] * (k - 1), now[1] * (k - 1), now[2] * (k - 1)]) }));
}

/** A drag of the part gizmo, as one step: moved and/or grown by these amounts. */
export function dragPart(index: number, move: [number, number, number], grow: [number, number, number]): void {
  editPart(index, grow.some((v) => v) ? 'Resize part' : 'Move part', (pe) => ({ ...pe, move: add3(pe.move, move), grow: add3(pe.grow, grow) }));
}

export const togglePartHidden = (index: number, hidden: boolean) => editPart(index, hidden ? 'Hide part' : 'Show part', (pe) => ({ ...pe, hidden }));

export const resetPart = (index: number) =>
  updateEdits('Reset part', (e) => {
    const parts = { ...e.parts };
    delete parts[String(index)];
    return { ...e, parts };
  });

export const resetSections = () => updateEdits('Reset sections', (e) => ({ ...e, sections: undefined }));
export const resetParams = () => updateEdits('Reset shape settings', (e) => ({ ...e, params: undefined }));
export const resetShape = () => updateEdits('Reset shape', () => ({}));

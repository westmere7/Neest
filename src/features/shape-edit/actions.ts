import type { ItemEdits, PlacedObject, Project } from '@/domain/model/schema';
import { getAsset } from '@/data/assets/registry';
import { withModel } from '@/data/assets/models';
import { MIN_SECTION, canEditShape, cleanEdits, editsApply, sectionInfo } from '@/data/assets/itemEdits';
import type { AssetDefinition } from '@/data/assets/types';
import { useEditorStore, type ShapeSection } from '@/state/editorStore';
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

/** Whether the item can be opened in the shape editor: it has components to resize, or edits made earlier to see or clear. */
export function canEditItem(project: Project, objectId: string): boolean {
  const o = project.objects[objectId];
  if (!o) return false;
  const asset = editBase(project, o);
  return canEditShape(asset) || (editsApply(asset) && !!o.edits);
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
    shapeEdit: { objectId, section: null, hover: null, param: null, returnTo },
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

const sameSection = (a: ShapeSection | null, b: ShapeSection | null) => a === b || (!!a && !!b && a.axis === b.axis && a.index === b.index);

export function setShapeEditState(patch: Partial<Pick<NonNullable<ReturnType<typeof useEditorStore.getState>['shapeEdit']>, 'section' | 'hover' | 'param'>>): void {
  const ed = useEditorStore.getState();
  if (!ed.shapeEdit) return;
  const next = { ...ed.shapeEdit, ...patch };
  if (sameSection(next.section, ed.shapeEdit.section) && sameSection(next.hover, ed.shapeEdit.hover) && next.param === ed.shapeEdit.param) return;
  ed.set({ shapeEdit: next });
}

/** Changes an item's edits by object id (one undo step); cleaned, and dropped when nothing is left. */
export function updateObjectEdits(objectId: string, label: string, fn: (e: ItemEdits, o: PlacedObject, asset: AssetDefinition) => ItemEdits): void {
  const project = useProjectStore.getState().project;
  if (!project) return;
  const o = project.objects[objectId];
  const asset = o && editBase(project, o);
  if (!asset) return;
  useProjectStore.getState().execute(label, (d) => {
    const obj = d.objects[objectId];
    // From the committed item (a draft cannot be cloned).
    const next = cleanEdits(asset, fn(structuredClone(o.edits ?? {}), o, asset));
    if (next) obj.edits = next;
    else delete obj.edits;
  });
}

/** Changes the edited item's edits (one undo step); cleaned, and dropped when nothing is left. */
export function updateEdits(label: string, fn: (e: ItemEdits, o: PlacedObject, asset: AssetDefinition) => ItemEdits): void {
  const id = useEditorStore.getState().shapeEdit?.objectId;
  if (id) updateObjectEdits(id, label, fn);
}

export const setObjectParam = (objectId: string, id: string, label: string, value: number | boolean | string) =>
  updateObjectEdits(objectId, `Set ${label.toLowerCase()}`, (e) => ({ ...e, params: { ...e.params, [id]: value } }));

export const resetObjectParams = (objectId: string) =>
  updateObjectEdits(objectId, 'Reset shape settings', (e) => ({ ...e, params: undefined }));

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

/** Moves section edges along an axis to these positions (a handle drag in the view), as one step. */
export function setSectionEdges(axis: 'x' | 'y', edges: number[]): void {
  updateEdits(axis === 'x' ? 'Resize compartments' : 'Resize levels', (e, o, asset) => {
    const info = sectionInfo(asset, { w: o.width, d: o.depth, h: o.height }, e)[axis];
    if (edges.length !== info.found.length) return e;
    return { ...e, sections: { ...e.sections, [axis]: { n: edges.length, d: edges.map((v, i) => v - info.found[i]) } } };
  });
}

/** Drops part edits made with the earlier part-by-part editor (the item keeps its settings and sections). */
export const clearPartEdits = () => updateEdits('Clear part edits', (e) => ({ ...e, parts: undefined, detached: undefined }));

export const resetSections = () => updateEdits('Reset sections', (e) => ({ ...e, sections: undefined }));
export const resetParams = () => updateEdits('Reset shape settings', (e) => ({ ...e, params: undefined }));
export const resetShape = () => updateEdits('Reset shape', () => ({}));

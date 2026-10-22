import type { ItemLayer, PlacedObject, Project } from '../model/schema';
import { newId } from '../model/ids';
import { inEveryOption } from './options';
import type { D } from './walls';

/**
 * Item layers (`Project.itemLayers`): user-made lists for organising placed items. A layer can be
 * hidden or locked, which hides or locks its items the way an item's own `hidden` / `locked` flag
 * does; it is not a drawing order. Definitions are project-wide (shared by every layout option);
 * items point at one with `PlacedObject.layerId`. Items without one are "Unassigned", whose state
 * is `layers.unassigned`.
 */

/** Tag colours offered for layers (new layers take the next one in turn). */
export const ITEM_LAYER_COLORS = ['#2a8a78', '#d0a650', '#d9694f', '#4a7fc1', '#8a63c4', '#d65c9a', '#5a9e4b', '#6b7480'] as const;

type LayerSource = Pick<Project, 'itemLayers' | 'layers'>;
type LayerState = { visible: boolean; locked: boolean };

const UNASSIGNED: LayerState = { visible: true, locked: false };

/** The layer an item is filed under, or undefined when it is unassigned (or the layer is gone). */
export function itemLayerOf(p: Pick<Project, 'itemLayers'>, o: Pick<PlacedObject, 'layerId'>): ItemLayer | undefined {
  return o.layerId ? p.itemLayers?.find((l) => l.id === o.layerId) : undefined;
}

/** Visibility and lock state that applies to an item through its layer (Unassigned for none). */
export function itemLayerState(p: LayerSource, o: Pick<PlacedObject, 'layerId'>): LayerState {
  return itemLayerOf(p, o) ?? p.layers?.unassigned ?? UNASSIGNED;
}

/**
 * True when an item is not shown: its own `hidden` flag or a hidden item layer. Every place that
 * skips hidden items (plan, hit-testing, 3D, exports, thumbnails, guest view, walk collisions)
 * goes through this. The project-wide Furniture layer toggle is checked separately by its callers.
 */
export function isObjectHidden(p: LayerSource, o: Pick<PlacedObject, 'hidden' | 'layerId'>): boolean {
  return o.hidden || !itemLayerState(p, o).visible;
}

/** True when an item may not be edited: its own `locked` flag or a locked item layer. */
export function isObjectLocked(p: LayerSource, o: Pick<PlacedObject, 'locked' | 'layerId'>): boolean {
  return o.locked || itemLayerState(p, o).locked;
}

/** Items of a layer in the open plan (`null` = Unassigned, which includes items of deleted layers). */
export function objectsInLayer(p: Pick<Project, 'objects' | 'itemLayers'>, layerId: string | null): PlacedObject[] {
  const ids = new Set((p.itemLayers ?? []).map((l) => l.id));
  return Object.values(p.objects).filter((o) => (layerId === null ? !o.layerId || !ids.has(o.layerId) : o.layerId === layerId));
}

/** Adds a layer at the end of the list and returns its id. */
export function addItemLayer(d: D, name?: string, color?: string): string {
  d.itemLayers ??= [];
  const id = newId('lay');
  const n = d.itemLayers.length + 1;
  d.itemLayers.push({
    id,
    name: name?.trim().slice(0, 60) || nextLayerName(d.itemLayers),
    visible: true,
    locked: false,
    color: color ?? ITEM_LAYER_COLORS[(n - 1) % ITEM_LAYER_COLORS.length],
  });
  return id;
}

function nextLayerName(list: ItemLayer[]): string {
  const taken = new Set(list.map((l) => l.name));
  for (let n = list.length + 1; ; n++) if (!taken.has(`Layer ${n}`)) return `Layer ${n}`;
}

/** Renames, shows/hides, locks or recolours a layer (an empty name is ignored). */
export function updateItemLayer(d: D, id: string, patch: Partial<Omit<ItemLayer, 'id'>>): void {
  const l = d.itemLayers?.find((x) => x.id === id);
  if (!l) return;
  const { name, ...rest } = patch;
  if (name !== undefined && name.trim()) l.name = name.trim().slice(0, 60);
  Object.assign(l, rest);
}

/** Sets the state of the Unassigned row (items on no layer). */
export function updateUnassignedLayer(d: D, patch: Partial<LayerState>): void {
  d.layers.unassigned ??= { ...UNASSIGNED };
  Object.assign(d.layers.unassigned, patch);
}

/** Shows or hides every item layer, Unassigned included. */
export function setAllItemLayersVisible(d: D, visible: boolean): void {
  for (const l of d.itemLayers ?? []) l.visible = visible;
  updateUnassignedLayer(d, { visible });
}

/** Deletes a layer; its items (in every layout option) go back to Unassigned. */
export function deleteItemLayer(d: D, id: string): void {
  if (!d.itemLayers) return;
  d.itemLayers = d.itemLayers.filter((l) => l.id !== id);
  inEveryOption(d, (x) => {
    for (const o of Object.values(x.objects)) if (o.layerId === id) delete o.layerId;
  });
}

/** Moves a layer to a new position in the list. */
export function moveItemLayer(d: D, id: string, to: number): void {
  const list = d.itemLayers ?? [];
  const from = list.findIndex((l) => l.id === id);
  if (from < 0) return;
  const [l] = list.splice(from, 1);
  list.splice(Math.max(0, Math.min(list.length, to)), 0, l);
}

/** Files items under a layer (`null` = Unassigned). Unknown layer ids are ignored. */
export function setObjectsLayer(d: D, ids: string[], layerId: string | null): void {
  if (layerId !== null && !d.itemLayers?.some((l) => l.id === layerId)) return;
  for (const id of ids) {
    const o = d.objects[id];
    if (!o) continue;
    if (layerId) o.layerId = layerId;
    else delete o.layerId;
  }
}

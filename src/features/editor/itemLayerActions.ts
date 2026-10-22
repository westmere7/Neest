import { addItemLayer, isObjectHidden, objectsInLayer, setObjectsLayer } from '@/domain/commands/itemLayers';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore } from '@/state/editorStore';
import { toast } from '@/state/uiStores';

/** Item layers from the UI: the Layers panel, the Inspector's Layer field and the right-click menu. */

const ps = () => useProjectStore.getState();
const es = () => useEditorStore.getState();

/** Ids of the selected items (walls, rooms and the like have no layer). */
export function selectedItemIds(): string[] {
  const p = ps().project;
  if (!p) return [];
  return es()
    .selection.filter((s) => s.kind === 'object' && p.objects[s.id])
    .map((s) => s.id);
}

/** Files the selected items under a layer (`null` = Unassigned). */
export function moveSelectionToLayer(layerId: string | null): void {
  const ids = selectedItemIds();
  if (!ids.length) {
    toast.info('Select items to move them to a layer');
    return;
  }
  const name = layerId ? (ps().project?.itemLayers.find((l) => l.id === layerId)?.name ?? 'layer') : 'Unassigned';
  ps().execute(`Move to ${name}`, (d) => setObjectsLayer(d, ids, layerId));
}

/** Makes a new layer holding the selected items (if any) and returns its id. */
export function newLayerFromSelection(name?: string): string {
  const ids = selectedItemIds();
  let id = '';
  ps().execute('New layer', (d) => {
    id = addItemLayer(d, name);
    setObjectsLayer(d, ids, id);
  });
  return id;
}

/** Selects the shown items of a layer (`null` = Unassigned). */
export function selectLayerItems(layerId: string | null): void {
  const p = ps().project;
  if (!p) return;
  const items = objectsInLayer(p, layerId).filter((o) => !isObjectHidden(p, o));
  if (!items.length) {
    toast.info(layerId === null ? 'No shown unassigned items' : 'This layer has no shown items');
    return;
  }
  es().setSelection(items.map((o) => ({ kind: 'object' as const, id: o.id })));
}

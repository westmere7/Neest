import type { GroupSnapshot } from '@/domain/model/schema';
import { addToCollection, createCollection, deleteCollection, removeFromCollection, updateCollection } from '@/domain/commands/collections';
import type { MenuItem } from '@/components/ContextMenu';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore } from '@/state/editorStore';
import { confirmAction, toast, useDialogStore, usePrefsStore } from '@/state/uiStores';
import { SAVED_GROUP_PREFIX } from './savedGroupAssets';

/**
 * Library collection actions (the data and commands are in domain/commands/collections): open the
 * details dialog, add or remove an item or group, delete, and the card menu entries.
 */

const collections = () => useProjectStore.getState().project?.collections ?? [];

/** Shows a collection in the library's furniture tab. */
export function showCollection(id: string): void {
  useEditorStore.getState().set({ libraryOpen: true, libraryTab: 'furniture', libraryCollection: { id, nonce: Date.now() } });
}

/** Opens the dialog to create a collection (optionally starting with one library item). */
export function newCollection(itemId?: string): void {
  useDialogStore.getState().open('collection-details', itemId ? { itemId } : {});
}

/** Opens the dialog to rename or describe a collection. */
export function editCollection(id: string): void {
  useDialogStore.getState().open('collection-details', { id });
}

/** A copy of the user's own saved group behind a library id (ready-made groups need none). */
export function groupSnapshotsFor(itemId: string): GroupSnapshot[] {
  if (!itemId.startsWith(SAVED_GROUP_PREFIX)) return [];
  const g = usePrefsStore.getState().savedGroups.find((x) => `${SAVED_GROUP_PREFIX}${x.id}` === itemId);
  return g ? [g as GroupSnapshot] : [];
}

/** Creates a collection (from the dialog) and shows it. */
export function saveNewCollection(name: string, description: string, itemId?: string): string | null {
  const items = itemId ? [itemId] : [];
  const id = useProjectStore.getState().execute(`New collection “${name.trim()}”`, (d) => createCollection(d, name, description, items, items.flatMap(groupSnapshotsFor)));
  if (id) showCollection(id);
  return id ?? null;
}

export function saveCollectionDetails(id: string, name: string, description: string): void {
  useProjectStore.getState().execute('Edit collection', (d) => updateCollection(d, id, { name, description }));
}

export function addItemToCollection(id: string, itemId: string, itemName: string): void {
  const c = collections().find((x) => x.id === id);
  if (!c) return;
  useProjectStore.getState().execute(`Add ${itemName} to ${c.name}`, (d) => addToCollection(d, id, [itemId], groupSnapshotsFor(itemId)));
  toast.success(`Added to “${c.name}”`, itemName);
}

export function removeItemFromCollection(id: string, itemId: string, itemName: string): void {
  const c = collections().find((x) => x.id === id);
  if (!c) return;
  useProjectStore.getState().execute(`Remove ${itemName} from ${c.name}`, (d) => removeFromCollection(d, id, [itemId]));
}

export async function removeCollection(id: string): Promise<boolean> {
  const c = collections().find((x) => x.id === id);
  if (!c) return false;
  const ok = await confirmAction({
    title: `Delete “${c.name}”?`,
    message: `The collection and its list of ${c.items.length} item${c.items.length === 1 ? '' : 's'} are removed from this project (in every option). The items stay in the library and placed items stay.`,
    confirmLabel: 'Delete',
    danger: true,
  });
  if (ok) useProjectStore.getState().execute(`Delete collection “${c.name}”`, (d) => deleteCollection(d, id));
  return ok;
}

/** Card menu entries: add to or remove from each collection, and a new collection with the item. */
export function collectionMenuItems(itemId: string, itemName: string): MenuItem[] {
  const list = collections();
  return [
    { separator: true, label: '' },
    ...list.map((c) =>
      c.items.includes(itemId)
        ? { label: `Remove from “${c.name}”`, run: () => removeItemFromCollection(c.id, itemId, itemName) }
        : { label: `Add to “${c.name}”`, run: () => addItemToCollection(c.id, itemId, itemName) },
    ),
    { label: list.length ? 'New collection with this…' : 'Add to a new collection…', run: () => newCollection(itemId) },
  ];
}

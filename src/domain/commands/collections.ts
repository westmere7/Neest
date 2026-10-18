import type { Collection, GroupSnapshot } from '../model/schema';
import { newId } from '../model/ids';
import type { D } from './walls';

/**
 * Library collections (`Project.collections`): named lists of library items and groups, shared by
 * every layout option. Items are library ids (`<asset id>` or `savedgroup:<id>`); a user's own
 * saved group is also copied into the collection (`groups`) so it still places on another machine.
 */

/** Group id behind a `savedgroup:<id>` library id, or null for an ordinary item. */
const groupIdOf = (itemId: string): string | null => (itemId.startsWith('savedgroup:') ? itemId.slice('savedgroup:'.length) : null);

const findCollection = (d: D, id: string): Collection | undefined => (d.collections ?? []).find((c) => c.id === id);

/** Creates a collection (name trimmed, cut to 60 characters) and returns its id. */
export function createCollection(d: D, name: string, description?: string, items: string[] = [], groups: GroupSnapshot[] = []): string {
  const id = newId('col');
  d.collections ??= [];
  const c: Collection = { id, name: cleanName(name, d.collections.length + 1), items: [], groups: {} };
  const desc = description?.trim();
  if (desc) c.description = desc.slice(0, 500);
  d.collections.push(c);
  addToCollection(d, id, items, groups);
  return id;
}

function cleanName(name: string, n: number): string {
  return name.trim().slice(0, 60) || `Collection ${n}`;
}

/** Renames a collection and/or changes its description (an empty description removes it). */
export function updateCollection(d: D, id: string, patch: { name?: string; description?: string }): void {
  const c = findCollection(d, id);
  if (!c) return;
  if (patch.name !== undefined && patch.name.trim()) c.name = patch.name.trim().slice(0, 60);
  if (patch.description !== undefined) {
    const desc = patch.description.trim();
    if (desc) c.description = desc.slice(0, 500);
    else delete c.description;
  }
}

export function deleteCollection(d: D, id: string): void {
  if (!d.collections) return;
  d.collections = d.collections.filter((c) => c.id !== id);
}

/**
 * Adds library items to a collection (each once, at the end). `groups` are copies of the user's
 * saved groups among them; a copy is kept only while its group is in the collection.
 */
export function addToCollection(d: D, id: string, items: string[], groups: GroupSnapshot[] = []): void {
  const c = findCollection(d, id);
  if (!c) return;
  for (const item of items) if (item && !c.items.includes(item) && c.items.length < 500) c.items.push(item);
  for (const g of groups) {
    if (!c.items.includes(`savedgroup:${g.id}`)) continue;
    const { shelf: _s, room: _r, ...copy } = g as GroupSnapshot & { shelf?: string; room?: string };
    c.groups[g.id] = structuredClone(copy);
  }
}

/** Removes library items from a collection (and the copies of removed groups). */
export function removeFromCollection(d: D, id: string, items: string[]): void {
  const c = findCollection(d, id);
  if (!c) return;
  const drop = new Set(items);
  c.items = c.items.filter((x) => !drop.has(x));
  for (const item of items) {
    const gid = groupIdOf(item);
    if (gid) delete c.groups[gid];
  }
}

/** Moves a collection to a new position in the list (for reordering). */
export function moveCollection(d: D, id: string, to: number): void {
  const list = d.collections ?? [];
  const from = list.findIndex((c) => c.id === id);
  if (from < 0) return;
  const [c] = list.splice(from, 1);
  list.splice(Math.max(0, Math.min(list.length, to)), 0, c);
}

import { z } from 'zod';
import { current, isDraft } from 'immer';
import { newId } from '../model/ids';
import {
  CustomAssetSchema,
  ItemLayerSchema,
  MaterialSchema,
  ObjectGroupSchema,
  PlacedObjectSchema,
  type CustomAsset,
  type ItemLayer,
  type MaterialDefinition,
  type ObjectGroup,
  type PlacedObject,
  type Project,
  type Vec2,
} from '../model/schema';
import type { D } from './walls';

/**
 * Copy and paste of placed items (Ctrl+C / Ctrl+X / Ctrl+V). The clipboard holds a self-contained
 * snapshot as text: the items (every field, shape edits and models included), the groups they belong
 * to, the project materials and imported models they use, and their item layers. Being plain text on
 * the system clipboard, it pastes into another tab, window, project or layout option of Neest.
 */

/** Marks Neest's clipboard text. */
export const CLIPBOARD_KIND = 'neest-clipboard';
const MAX_ITEMS = 500;

const PayloadSchema = z.object({
  kind: z.literal(CLIPBOARD_KIND),
  v: z.literal(1),
  /** Where it was copied from: pasting back there offsets the copies, anywhere else keeps their places. */
  projectId: z.string(),
  optionId: z.string().nullable(),
  /** Copy time, unique per copy (repeated pastes of one copy step further). */
  copiedAt: z.number(),
  objects: z.array(PlacedObjectSchema).min(1).max(MAX_ITEMS),
  groups: z.record(z.string(), ObjectGroupSchema).default({}),
  materials: z.record(z.string(), MaterialSchema).default({}),
  customAssets: z.record(z.string(), CustomAssetSchema).default({}),
  layers: z.array(ItemLayerSchema).default([]),
});

export type ClipboardPayload = z.infer<typeof PayloadSchema>;

const plain = <T,>(x: T): T => (isDraft(x) ? (current(x) as T) : x);

/** The clipboard snapshot of these items (objects only; other ids are left out). Null when none is an item. */
export function copyPayload(project: Project, ids: string[], copiedAt = Date.now()): ClipboardPayload | null {
  const objects = [...new Set(ids)].map((id) => project.objects[id]).filter((o): o is PlacedObject => !!o).slice(0, MAX_ITEMS);
  if (!objects.length) return null;
  const groups: Record<string, ObjectGroup> = {};
  const materials: Record<string, MaterialDefinition> = {};
  const customAssets: Record<string, CustomAsset> = {};
  const layers: ItemLayer[] = [];
  for (const o of objects) {
    if (o.groupId && project.groups?.[o.groupId]) groups[o.groupId] = structuredClone(plain(project.groups[o.groupId]));
    for (const m of Object.values(o.materials)) if (project.materials[m]) materials[m] = structuredClone(plain(project.materials[m]));
    if (project.customAssets[o.assetId]) customAssets[o.assetId] = structuredClone(plain(project.customAssets[o.assetId]));
    const layer = o.layerId ? project.itemLayers?.find((l) => l.id === o.layerId) : undefined;
    if (layer && !layers.some((l) => l.id === layer.id)) layers.push(structuredClone(plain(layer)));
  }
  return {
    kind: CLIPBOARD_KIND,
    v: 1,
    projectId: project.id,
    optionId: project.activeOptionId ?? null,
    copiedAt,
    objects: objects.map((o) => structuredClone(plain(o))),
    groups,
    materials,
    customAssets,
    layers,
  };
}

/** Clipboard text of a snapshot. */
export const clipboardText = (p: ClipboardPayload): string => JSON.stringify(p);

/** The snapshot in clipboard text, or null when the text is something else (or broken). */
export function parseClipboard(text: string | null | undefined): ClipboardPayload | null {
  if (!text || !text.includes(CLIPBOARD_KIND)) return null;
  try {
    const r = PayloadSchema.safeParse(JSON.parse(text));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

/** Centre of the copied items' positions (for pasting at a point). */
export function payloadCentre(p: ClipboardPayload): Vec2 {
  const xs = p.objects.map((o) => o.x);
  const ys = p.objects.map((o) => o.y);
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
}

export interface PasteResult {
  ids: string[];
  /** Items left out: their library item is not installed here. */
  skipped: number;
}

/**
 * Pastes the snapshot into the plan, moved by `offset`: new ids, groups copied as new groups (named
 * "… copy" when pasted into the project they came from), missing materials and imported models
 * added, items filed under the same item layer (by id, else by name; else unassigned). Copies come
 * unlocked and shown; services pins are dropped (they point at the source plan's points).
 */
export function pasteObjects(d: D, p: ClipboardPayload, offset: Vec2, assetExists: (assetId: string) => boolean): PasteResult {
  const sameProject = d.id === p.projectId;
  for (const [id, m] of Object.entries(p.materials)) if (!d.materials[id]) d.materials[id] = structuredClone(m);
  for (const [id, a] of Object.entries(p.customAssets)) if (!d.customAssets[id]) d.customAssets[id] = structuredClone(a);
  const layerFor = (layerId: string | undefined): string | undefined => {
    if (!layerId) return undefined;
    if (d.itemLayers?.some((l) => l.id === layerId)) return layerId;
    const name = p.layers.find((l) => l.id === layerId)?.name;
    return name ? d.itemLayers?.find((l) => l.name === name)?.id : undefined;
  };
  const regroup = new Map<string, string>();
  const ids: string[] = [];
  let skipped = 0;
  for (const src of p.objects) {
    if (!assetExists(src.assetId) && !d.customAssets[src.assetId]) {
      skipped++;
      continue;
    }
    const id = newId('obj');
    const o: PlacedObject = { ...structuredClone(src), id, x: src.x + offset.x, y: src.y + offset.y, locked: false, hidden: false };
    delete o.serviceLinks;
    delete o.groupId;
    const layerId = layerFor(src.layerId);
    if (layerId) o.layerId = layerId;
    else delete o.layerId;
    if (src.groupId) {
      let g = regroup.get(src.groupId);
      if (!g) {
        g = newId('grp');
        regroup.set(src.groupId, g);
        const from = p.groups[src.groupId];
        d.groups ??= {};
        d.groups[g] = { id: g, name: `${from?.name ?? 'Group'}${sameProject ? ' copy' : ''}`.slice(0, 80), ...(from?.description ? { description: from.description } : {}) };
      }
      o.groupId = g;
    }
    d.objects[id] = o;
    ids.push(id);
  }
  // A group left with fewer than two members is no group.
  for (const g of regroup.values()) {
    const members = ids.filter((id) => d.objects[id].groupId === g);
    if (members.length < 2) {
      for (const id of members) delete d.objects[id].groupId;
      delete d.groups[g];
    }
  }
  return { ids, skipped };
}

import type { MaterialDefinition, Project, Vec2 } from '@/domain/model/schema';
import { groupObjects, placeObject, prepareVariantMaterials, ungroupObjects, updateObjects, withGroupMates } from '@/domain/commands/entities';
import { MATERIAL_CATALOG_BY_ID } from '@/data/materials/catalog';
import { getAsset } from '@/data/assets/registry';
import { rotate } from '@/domain/geometry/vec';
import { useProjectStore } from '@/state/projectStore';
import { setSelectionExpander, useEditorStore, type SelItem } from '@/state/editorStore';
import { toast, usePrefsStore, type SavedGroup } from '@/state/uiStores';
import { readyGroupById } from '@/data/groups/readyGroups';

/**
 * Groups of placed items: selecting one member selects the whole group (installed into the editor
 * store below), Ctrl+G / Ctrl+Shift+G group and ungroup, and a group can be saved to the library's
 * "Saved groups" shelf (prefs, every project) and placed again as a new group.
 */
setSelectionExpander((sel: SelItem[]): SelItem[] => {
  const p = useProjectStore.getState().project;
  if (!p || !sel.some((s) => s.kind === 'object' && p.objects[s.id]?.groupId)) return sel;
  const ids = withGroupMates(
    p,
    sel.filter((s) => s.kind === 'object').map((s) => s.id),
  );
  const have = new Set(sel.map((s) => s.id));
  return [...sel, ...ids.filter((id) => !have.has(id) && !p.objects[id]?.hidden).map((id) => ({ kind: 'object' as const, id }))];
});

/** Default names like "Group 3" or "Group of 4 items" that say nothing about the contents. */
export const isGenericGroupName = (name: string): boolean => /^group( of)? \d+( items?)?$/i.test(name.trim());

/**
 * A name from a group's contents: its one or two largest items by footprint, then how many more,
 * e.g. "3-seat sofa & coffee table + 2 more". Unknown items are ignored.
 */
export function smartGroupName(items: { assetId: string; width: number; depth: number }[], project: Project | null = null): string {
  const named = items
    .map((it) => ({ name: getAsset(project, it.assetId)?.name, area: it.width * it.depth }))
    .filter((x): x is { name: string; area: number } => Boolean(x.name))
    .sort((a, b) => b.area - a.area);
  if (!named.length) return `Group of ${items.length} items`;
  const short = (n: string) => n.replace(/\s*\([^)]*\)/g, '').replace(/,.*$/, '').trim();
  const first = short(named[0].name);
  const second = named.find((x, i) => i > 0 && short(x.name) !== first);
  const head = second ? `${first} & ${short(second.name).toLowerCase()}` : first;
  const more = items.length - (second ? 2 : 1);
  return (more > 0 ? `${head} + ${more} more` : head).slice(0, 60);
}

/** Renames the user's saved groups that still have generic names after their contents. */
export function renameGenericSavedGroups(): void {
  const prefs = usePrefsStore.getState();
  for (const g of prefs.savedGroups) {
    if (!isGenericGroupName(g.name) || !g.items.every((it) => getAsset(null, it.assetId))) continue;
    prefs.updateSavedGroup(g.id, { name: smartGroupName(g.items), description: g.description ?? '' });
  }
}

const selectedObjectIds = (p: Project): string[] =>
  useEditorStore
    .getState()
    .selection.filter((s) => s.kind === 'object' && p.objects[s.id])
    .map((s) => s.id);

/** What group commands can do with the current selection (for menus and shortcuts). */
export function groupState(p: Project | null): { canGroup: boolean; canUngroup: boolean; groupName: string | null; count: number } {
  if (!p) return { canGroup: false, canUngroup: false, groupName: null, count: 0 };
  const ids = selectedObjectIds(p);
  const groups = new Set(ids.map((id) => p.objects[id].groupId ?? ''));
  const single = groups.size === 1 && !groups.has('') ? [...groups][0] : null;
  return {
    canGroup: ids.length >= 2 && !single,
    canUngroup: ids.some((id) => p.objects[id].groupId),
    groupName: single ? (p.groups?.[single]?.name ?? null) : null,
    count: ids.length,
  };
}

export function groupSelection(): void {
  const ps = useProjectStore.getState();
  const p = ps.project;
  if (!p) return;
  const ids = selectedObjectIds(p);
  if (ids.length < 2) {
    toast.info('Select two or more items to group them');
    return;
  }
  if (ids.some((id) => p.objects[id].locked)) {
    toast.warning('Unlock the items first', 'Locked items cannot be grouped.');
    return;
  }
  const name = smartGroupName(
    ids.map((id) => p.objects[id]),
    p,
  );
  const gid = ps.execute(`Group ${ids.length} items`, (d) => groupObjects(d, ids, name));
  if (gid) toast.success('Grouped', 'Click any of them to select the group. Ctrl+Shift+G ungroups.');
}

export function ungroupSelection(): void {
  const ps = useProjectStore.getState();
  const p = ps.project;
  if (!p) return;
  const ids = selectedObjectIds(p).filter((id) => p.objects[id].groupId);
  if (!ids.length) return;
  ps.execute('Ungroup', (d) => ungroupObjects(d, ids));
}

/** Saves the selected items (relative positions, sizes and finishes) to the library's Saved groups. */
export function saveSelectionToLibrary(name?: string): SavedGroup | null {
  const p = useProjectStore.getState().project;
  if (!p) return null;
  const objs = selectedObjectIds(p)
    .map((id) => p.objects[id])
    .filter((o) => !p.customAssets[o.assetId]);
  if (!objs.length) {
    toast.info('Select library items to save as a group', 'Imported models cannot be saved to the library.');
    return null;
  }
  const xs = objs.map((o) => o.x);
  const ys = objs.map((o) => o.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const defs: Record<string, MaterialDefinition> = {};
  for (const o of objs) {
    for (const id of Object.values(o.materials)) {
      const own = p.materials[id];
      const cat = MATERIAL_CATALOG_BY_ID[id];
      if (own && (!cat || JSON.stringify(own) !== JSON.stringify(cat))) defs[id] = structuredClone(own);
    }
  }
  const groupId = objs[0].groupId;
  const placedName = groupId ? p.groups?.[groupId]?.name : undefined;
  const fallback = placedName && !isGenericGroupName(placedName) ? placedName : smartGroupName(objs, p);
  const description = groupId ? p.groups?.[groupId]?.description : undefined;
  const extent = (o: (typeof objs)[number]) => Math.hypot(o.width, o.depth) / 2;
  const group: SavedGroup = {
    id: Date.now().toString(36),
    name: (name ?? fallback).slice(0, 60),
    ...(description ? { description } : {}),
    createdAt: Date.now(),
    items: objs.map((o) => ({
      assetId: o.assetId,
      name: o.name,
      dx: o.x - cx,
      dy: o.y - cy,
      elevation: o.elevation,
      rotation: o.rotation,
      width: o.width,
      depth: o.depth,
      height: o.height,
      mirrored: o.mirrored,
      materials: { ...o.materials },
    })),
    size: {
      w: Math.max(...objs.map((o) => o.x + extent(o))) - Math.min(...objs.map((o) => o.x - extent(o))),
      d: Math.max(...objs.map((o) => o.y + extent(o))) - Math.min(...objs.map((o) => o.y - extent(o))),
    },
    ...(Object.keys(defs).length ? { defs } : {}),
  };
  usePrefsStore.getState().saveGroup(group);
  toast.success(`Saved “${group.name}”`, 'Find it under Furniture → Saved groups, in every project.');
  return group;
}

/** Places a saved group centred at `at` as a new group, and selects it. */
export function placeSavedGroup(group: SavedGroup, at: Vec2, rotation = 0): void {
  const ps = useProjectStore.getState();
  const p = ps.project;
  if (!p) return;
  const missing = group.items.filter((it) => !getAsset(p, it.assetId)).length;
  const ids = ps.execute(`Place ${group.name}`, (d) => {
    const out: string[] = [];
    for (const it of group.items) {
      if (!getAsset(p, it.assetId)) continue;
      const materials = prepareVariantMaterials(d, it.materials, group.defs);
      // The whole group turns about its centre.
      const off = rotate({ x: it.dx, y: it.dy }, rotation);
      const id = placeObject(d, {
        assetId: it.assetId,
        x: at.x + off.x,
        y: at.y + off.y,
        rotation: it.rotation + rotation,
        width: it.width,
        depth: it.depth,
        height: it.height,
        elevation: it.elevation,
        materials,
        name: it.name ?? undefined,
      });
      if (it.mirrored) updateObjects(d, [id], { mirrored: true });
      out.push(id);
    }
    if (out.length >= 2) groupObjects(d, out, group.name, group.description);
    return out;
  });
  if (missing) toast.warning(`${missing} item${missing > 1 ? 's' : ''} skipped`, 'Their content pack is not installed.');
  if (ids?.length) useEditorStore.getState().set({ tool: 'select', selection: ids.map((id) => ({ kind: 'object', id })) });
}

/** Saved group from a library drag id (`savedgroup:<id>`), if it exists. */
export function savedGroupFromDragId(dragId: string): SavedGroup | undefined {
  // Library cards of saved groups use their asset id, `savedgroup:<id>`.
  if (!dragId.startsWith('savedgroup:')) return undefined;
  const id = dragId.slice('savedgroup:'.length);
  return usePrefsStore.getState().savedGroups.find((g) => g.id === id) ?? readyGroupById(id);
}

import type { Project } from '@/domain/model/schema';
import { deleteEntities, duplicateEntities, rotateObjects, translateObjects, updateObjects, updateOpening } from '@/domain/commands/entities';
import { clampOpenings, flipWall, insertJunctions, translateNodes, updateWalls } from '@/domain/commands/walls';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore, type SelItem } from '@/state/editorStore';
import { confirmAction, toast } from '@/state/uiStores';
import { groupFromSelection } from './groups';
import { transientGroups } from '@/features/library/savedGroupAssets';

const ps = () => useProjectStore.getState();
const es = () => useEditorStore.getState();

export function describeSelection(project: Project, sel: SelItem[]): string {
  if (!sel.length) return 'Nothing selected';
  if (sel.length > 1) return `${sel.length} items selected`;
  const s = sel[0];
  switch (s.kind) {
    case 'wall':
      return 'Wall';
    case 'node':
      return 'Wall endpoint';
    case 'opening': {
      const o = project.openings[s.id];
      return o ? (o.kind.startsWith('window') ? 'Window' : o.kind === 'passage' ? 'Passage' : 'Door') : 'Opening';
    }
    case 'object':
      return project.objects[s.id]?.name ?? 'Object';
    case 'room':
      return project.rooms[s.id]?.name ?? 'Room';
    case 'callout':
      return project.callouts?.[s.id]?.title || 'Note';
  }
}

/** Deletes the current selection, asking for confirmation when complex geometry would be removed. */
export async function deleteSelection(): Promise<void> {
  const project = ps().project;
  const sel = es().selection;
  if (!project || !sel.length) return;
  const walls = sel.filter((s) => s.kind === 'wall' || s.kind === 'node' || s.kind === 'room');
  const lockedWalls = sel.filter((s) => s.kind === 'wall' && project.walls[s.id]?.locked);
  if (lockedWalls.length || (walls.length && project.layers.construction.locked)) {
    toast.warning('Locked walls', 'Unlock the walls (or the construction layer) before deleting them.');
    return;
  }
  const lockedObjs = sel.filter((s) => s.kind === 'object' && project.objects[s.id]?.locked);
  if (lockedObjs.length) {
    toast.warning('Locked objects', 'Unlock the selected objects before deleting them.');
    return;
  }
  const rooms = sel.filter((s) => s.kind === 'room');
  const needsConfirm = sel.length > 3 || rooms.length > 0 || sel.filter((s) => s.kind === 'wall').length > 1;
  if (needsConfirm) {
    const ok = await confirmAction({
      title: rooms.length ? 'Delete room walls?' : `Delete ${sel.length} items?`,
      message: rooms.length
        ? 'Deleting a room removes the walls that enclose only that room (shared walls stay), together with their doors and windows. You can undo this.'
        : 'The selected items and any doors or windows in deleted walls will be removed. You can undo this.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
  }
  ps().execute(sel.length === 1 ? `Delete ${describeSelection(project, sel).toLowerCase()}` : 'Delete selection', (d) =>
    deleteEntities(
      d,
      sel.map((s) => s.id),
    ),
  );
  es().clearSelection();
}

/**
 * Duplicate. Furniture is not copied on the spot: the place tool starts with the copy following the
 * pointer (same size, height, finishes, model and turn) until a click puts it down — several items
 * move as one, kept as a group only if they were one. A door or window starts the door/window tool
 * with a copy of it, inserted where the next click on a wall puts it.
 */
export function duplicateSelection(): void {
  const project = ps().project;
  const sel = es().selection.filter((s) => s.kind === 'object' || s.kind === 'opening');
  if (!project || !sel.length) {
    if (es().selection.length) toast.info('Only furniture and openings can be duplicated');
    return;
  }
  if (sel.every((s) => s.kind === 'object') && placeCopies(project, sel.map((s) => s.id))) return;
  if (sel.length === 1 && sel[0].kind === 'opening' && project.openings[sel[0].id]) {
    const { id: _id, wallId: _wall, offset: _offset, ...template } = project.openings[sel[0].id];
    const workspace = es().workspace === 'walk' ? '3d' : es().workspace;
    es().set({ tool: 'opening', workspace, openingKind: template.kind, openingTemplate: JSON.parse(JSON.stringify(template)), selection: [] });
    toast.info(`Click a wall to insert the copy`, 'Shift-click inserts more, Esc cancels.');
    return;
  }
  const grid = Math.max(project.settings.gridSize, 0.1) * 3;
  const ids = ps().execute('Duplicate', (d) =>
    duplicateEntities(
      d,
      sel.map((s) => s.id),
      { x: grid, y: grid },
    ),
  );
  if (ids?.length) {
    const p = ps().project!;
    es().setSelection(ids.map((id) => ({ kind: p.objects[id] ? 'object' : 'opening', id }) as SelItem));
  }
}

/** Starts the place tool with copies of these items; false when they can't be placed that way. */
function placeCopies(project: NonNullable<ReturnType<typeof ps>['project']>, ids: string[]): boolean {
  const objs = ids.map((id) => project.objects[id]).filter(Boolean);
  if (!objs.length || objs.some((o) => project.customAssets[o.assetId])) return false;
  const workspace = es().workspace === 'walk' ? '3d' : es().workspace;
  if (objs.length === 1) {
    const o = objs[0];
    es().set({
      tool: 'place',
      workspace,
      placeAssetId: o.assetId,
      placeRotation: o.rotation,
      placeTemplate: { assetId: o.assetId, width: o.width, depth: o.depth, height: o.height, elevation: o.elevation, mirrored: o.mirrored, materials: { ...o.materials }, ...(o.model ? { model: o.model } : {}), name: o.name },
      selection: [],
    });
    toast.info('Click to place the copy', 'R turns it, Shift-click places more, Esc cancels.');
    return true;
  }
  const group = groupFromSelection();
  if (!group) return false;
  const gid = objs[0].groupId;
  group.id = `dup-${Date.now().toString(36)}`;
  group.ungrouped = !gid || objs.some((o) => o.groupId !== gid);
  transientGroups.clear();
  transientGroups.set(group.id, group);
  es().set({ tool: 'place', workspace, placeAssetId: `savedgroup:${group.id}`, placeRotation: 0, selection: [] });
  toast.info(`Click to place the ${objs.length} copies`, 'R turns them, Shift-click places more, Esc cancels.');
  return true;
}

export function rotateSelection(delta = Math.PI / 2): void {
  const project = ps().project;
  const ids = es()
    .selection.filter((s) => s.kind === 'object' && !project?.objects[s.id]?.locked)
    .map((s) => s.id);
  if (!ids.length) return;
  ps().execute('Rotate', (d) => rotateObjects(d, ids, delta));
}

export function nudgeSelection(dx: number, dy: number): void {
  const project = ps().project;
  if (!project) return;
  const sel = es().selection;
  const objIds = sel.filter((s) => s.kind === 'object' && !project.objects[s.id]?.locked).map((s) => s.id);
  const nodeIds = new Set<string>();
  if (!project.layers.construction.locked) {
    for (const s of sel) {
      if (s.kind === 'wall' && !project.walls[s.id]?.locked) {
        nodeIds.add(project.walls[s.id].a);
        nodeIds.add(project.walls[s.id].b);
      }
      if (s.kind === 'node') nodeIds.add(s.id);
    }
  }
  const openings = sel.filter((s) => s.kind === 'opening').map((s) => s.id);
  if (!objIds.length && !nodeIds.size && !openings.length) return;
  ps().execute('Nudge', (d) => {
    translateObjects(d, objIds, { x: dx, y: dy });
    if (nodeIds.size) {
      translateNodes(d, [...nodeIds], { x: dx, y: dy });
      insertJunctions(
        d,
        Object.values(d.walls)
          .filter((w) => nodeIds.has(w.a) || nodeIds.has(w.b))
          .map((w) => w.id),
      );
      clampOpenings(d);
    }
    for (const id of openings) {
      const o = d.openings[id];
      if (o) updateOpening(d, id, { offset: o.offset + (Math.abs(dx) > Math.abs(dy) ? dx : dy) });
    }
  });
}

export function flipOpening(id: string, what: 'side' | 'hinge'): void {
  const o = ps().project?.openings[id];
  if (!o) return;
  ps().execute(what === 'side' ? 'Flip swing side' : 'Flip hinge', (d) =>
    updateOpening(d, id, what === 'side' ? { swingSide: o.swingSide === 'left' ? 'right' : 'left' } : { hinge: o.hinge === 'start' ? 'end' : 'start' }),
  );
}

export function toggleLockSelection(): void {
  const project = ps().project;
  const sel = es().selection;
  if (!project || !sel.length) return;
  const walls = sel.filter((s) => s.kind === 'wall').map((s) => s.id);
  const objs = sel.filter((s) => s.kind === 'object').map((s) => s.id);
  const anyUnlocked = walls.some((id) => !project.walls[id]?.locked) || objs.some((id) => !project.objects[id]?.locked);
  ps().execute(anyUnlocked ? 'Lock' : 'Unlock', (d) => {
    updateWalls(d, walls, { locked: anyUnlocked });
    updateObjects(d, objs, { locked: anyUnlocked });
  });
}

export function reverseWall(id: string): void {
  ps().execute('Swap wall sides', (d) => flipWall(d, id));
}

export function selectAll(): void {
  const project = ps().project;
  if (!project) return;
  const sel: SelItem[] = [
    ...Object.values(project.walls)
      .filter((w) => !w.locked && !project.layers.construction.locked)
      .map((w) => ({ kind: 'wall' as const, id: w.id })),
    ...Object.values(project.objects)
      .filter((o) => !o.locked && !project.layers.furniture.locked)
      .map((o) => ({ kind: 'object' as const, id: o.id })),
  ];
  es().setSelection(sel);
}

/** Removes selection entries whose entities no longer exist (after undo/redo or deletion). */
export function pruneSelection(project: Project): void {
  const sel = es().selection;
  const exists = (s: SelItem) =>
    s.kind === 'wall'
      ? !!project.walls[s.id]
      : s.kind === 'node'
        ? !!project.nodes[s.id]
        : s.kind === 'opening'
          ? !!project.openings[s.id]
          : s.kind === 'object'
            ? !!project.objects[s.id]
            : !!project.rooms[s.id];
  const next = sel.filter(exists);
  if (next.length !== sel.length) es().setSelection(next);
  const hover = es().hover;
  if (hover && !exists(hover)) es().setHover(null);
}

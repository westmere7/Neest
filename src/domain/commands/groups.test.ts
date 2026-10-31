import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { createEmptyProject } from '../model/defaults';
import { ProjectSchema, type Project } from '../model/schema';
import type { D } from './walls';
import { deleteEntities, duplicateEntities, groupObjects, mirrorObjects, placeObject, renameGroup, rotateObjects, ungroupObjects, updateObjects, withGroupMates } from './entities';

const edit = (p: Project, fn: (d: D) => void): Project => produce(p, fn);

function three() {
  const ids: string[] = [];
  const p = edit(createEmptyProject(), (d) => {
    for (const x of [0, 1, 2]) ids.push(placeObject(d, { assetId: 'side-table', x, y: 0, width: 0.5, depth: 0.5, height: 0.5 }));
  });
  return { p, ids };
}

describe('object groups', () => {
  it('groups two or more items and finds group mates', () => {
    const { p, ids } = three();
    let gid: string | null = null;
    const q = edit(p, (d) => {
      gid = groupObjects(d, ids.slice(0, 2), 'Reading corner');
    });
    expect(gid).toBeTruthy();
    expect(q.groups[gid!].name).toBe('Reading corner');
    expect(q.objects[ids[0]].groupId).toBe(gid);
    expect(q.objects[ids[2]].groupId).toBeUndefined();
    expect(withGroupMates(q, [ids[1]]).sort()).toEqual(ids.slice(0, 2).sort());
    expect(edit(p, (d) => void groupObjects(d, [ids[0]]))).toEqual(p);
  });

  it('ungroups every member and renames groups', () => {
    const { p, ids } = three();
    let gid = '';
    let q = edit(p, (d) => {
      gid = groupObjects(d, ids)!;
      renameGroup(d, gid, '  Dining set ');
    });
    expect(q.groups[gid].name).toBe('Dining set');
    q = edit(q, (d) => ungroupObjects(d, [ids[2]]));
    expect(Object.keys(q.groups)).toHaveLength(0);
    expect(ids.every((id) => !q.objects[id].groupId)).toBe(true);
  });

  it('drops a group when deleting leaves fewer than two members', () => {
    const { p, ids } = three();
    let q = edit(p, (d) => void groupObjects(d, ids.slice(0, 2)));
    q = edit(q, (d) => deleteEntities(d, [ids[0]]));
    expect(Object.keys(q.groups)).toHaveLength(0);
    expect(q.objects[ids[1]].groupId).toBeUndefined();
  });

  it('duplicates a group as a new group', () => {
    const { p, ids } = three();
    let gid = '';
    let copies: string[] = [];
    const q = edit(edit(p, (d) => void (gid = groupObjects(d, ids.slice(0, 2))!)), (d) => {
      copies = duplicateEntities(d, ids.slice(0, 2), { x: 0, y: 1 });
    });
    const g2 = q.objects[copies[0]].groupId!;
    expect(g2).toBeTruthy();
    expect(g2).not.toBe(gid);
    expect(q.objects[copies[1]].groupId).toBe(g2);
    expect(q.groups[g2].name).toMatch(/copy$/);
  });

  it('older project files without groups still load', () => {
    const { groups: _g, ...old } = createEmptyProject();
    void _g;
    const r = ProjectSchema.safeParse(old);
    expect(r.success).toBe(true);
    expect(r.success && r.data.groups).toEqual({});
  });
});

describe('mirrorObjects', () => {
  it('toggles mirrored on a single object without moving or rotating it', () => {
    let id = '';
    const p0 = edit(createEmptyProject(), (d) => {
      id = placeObject(d, { assetId: 'side-table', x: 2.5, y: -1.2, width: 1.6, depth: 1.2, height: 0.75, rotation: Math.PI / 6 });
    });
    const p1 = edit(p0, (d) => mirrorObjects(d, [id]));
    expect(p1.objects[id]).toMatchObject({ x: 2.5, y: -1.2, rotation: Math.PI / 6, mirrored: true });
    const p2 = edit(p1, (d) => mirrorObjects(d, [id]));
    expect(p2.objects[id]).toMatchObject({ x: 2.5, y: -1.2, rotation: Math.PI / 6, mirrored: false });
  });

  it('reflects a multi-object arrangement across the lead item axis and is an involution at any angle', () => {
    let desk = '';
    let chair = '';
    const p0 = edit(createEmptyProject(), (d) => {
      desk = placeObject(d, { assetId: 'side-table', x: 0, y: 0, width: 1.8, depth: 0.8, height: 0.75, rotation: 0 });
      chair = placeObject(d, { assetId: 'side-table', x: -0.6, y: 0.8, width: 0.5, depth: 0.5, height: 0.9, rotation: Math.PI / 6 });
    });

    // At 0°, centroid x is (-0.6)/2 = -0.3; reflecting across x = -0.3 swaps desk (0 -> -0.6) and chair (-0.6 -> 0).
    const p1 = edit(p0, (d) => mirrorObjects(d, [desk, chair]));
    expect(p1.objects[desk].x).toBeCloseTo(-0.6, 9);
    expect(p1.objects[desk].y).toBeCloseTo(0, 9);
    expect(p1.objects[desk].rotation).toBeCloseTo(0, 9);
    expect(p1.objects[desk].mirrored).toBe(true);
    expect(p1.objects[chair].x).toBeCloseTo(0, 9);
    expect(p1.objects[chair].y).toBeCloseTo(0.8, 9);
    expect(p1.objects[chair].rotation).toBeCloseTo(2 * Math.PI - Math.PI / 6, 9);
    expect(p1.objects[chair].mirrored).toBe(true);

    // Flipping again restores exact coordinates, rotations and mirror flags.
    const p2 = edit(p1, (d) => mirrorObjects(d, [desk, chair]));
    expect(p2.objects[desk].x).toBeCloseTo(0, 9);
    expect(p2.objects[desk].y).toBeCloseTo(0, 9);
    expect(p2.objects[desk].rotation).toBeCloseTo(0, 9);
    expect(p2.objects[desk].mirrored).toBe(false);
    expect(p2.objects[chair].x).toBeCloseTo(-0.6, 9);
    expect(p2.objects[chair].y).toBeCloseTo(0.8, 9);
    expect(p2.objects[chair].rotation).toBeCloseTo(Math.PI / 6, 9);
    expect(p2.objects[chair].mirrored).toBe(false);

    // Also test after rotating the whole group 90° and updating one member's rotation.
    const pRot = edit(p0, (d) => {
      rotateObjects(d, [desk, chair], Math.PI / 2);
      updateObjects(d, [chair], { mirrored: true });
    });
    const pRotFlip1 = edit(pRot, (d) => mirrorObjects(d, [desk, chair]));
    expect(pRotFlip1.objects[desk].mirrored).toBe(true);
    expect(pRotFlip1.objects[chair].mirrored).toBe(false);
    // At 90° (width axis along +y), x coordinates stay unchanged while y coordinates reflect across centroid y.
    expect(pRotFlip1.objects[desk].x).toBeCloseTo(pRot.objects[desk].x, 9);
    expect(pRotFlip1.objects[chair].x).toBeCloseTo(pRot.objects[chair].x, 9);
    expect(pRotFlip1.objects[desk].y).toBeCloseTo(pRot.objects[chair].y, 9);
    expect(pRotFlip1.objects[chair].y).toBeCloseTo(pRot.objects[desk].y, 9);

    const pRotFlip2 = edit(pRotFlip1, (d) => mirrorObjects(d, [desk, chair]));
    expect(pRotFlip2.objects[desk].x).toBeCloseTo(pRot.objects[desk].x, 9);
    expect(pRotFlip2.objects[desk].y).toBeCloseTo(pRot.objects[desk].y, 9);
    expect(pRotFlip2.objects[desk].rotation).toBeCloseTo(pRot.objects[desk].rotation, 9);
    expect(pRotFlip2.objects[desk].mirrored).toBe(pRot.objects[desk].mirrored);
    expect(pRotFlip2.objects[chair].x).toBeCloseTo(pRot.objects[chair].x, 9);
    expect(pRotFlip2.objects[chair].y).toBeCloseTo(pRot.objects[chair].y, 9);
    expect(pRotFlip2.objects[chair].rotation).toBeCloseTo(pRot.objects[chair].rotation, 9);
    expect(pRotFlip2.objects[chair].mirrored).toBe(pRot.objects[chair].mirrored);
  });
});

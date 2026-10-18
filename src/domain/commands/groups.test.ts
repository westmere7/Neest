import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { createEmptyProject } from '../model/defaults';
import { ProjectSchema, type Project } from '../model/schema';
import type { D } from './walls';
import { deleteEntities, duplicateEntities, groupObjects, placeObject, renameGroup, ungroupObjects, withGroupMates } from './entities';

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

import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { createEmptyProject } from '../model/defaults';
import { ProjectSchema, type GroupSnapshot, type Project } from '../model/schema';
import { migrateProject } from '@/storage/migrations';
import type { D } from './walls';
import { addToCollection, createCollection, deleteCollection, moveCollection, removeFromCollection, updateCollection, usedItemIds } from './collections';
import { addOption, deleteOption, switchOption } from './options';

const edit = (p: Project, fn: (d: D) => void): Project => produce(p, fn);

const group: GroupSnapshot & { shelf?: string } = {
  id: 'g1',
  name: 'Reading corner',
  createdAt: 1,
  items: [{ assetId: 'armchair', name: null, dx: 0, dy: 0, elevation: 0, rotation: 0, width: 0.8, depth: 0.8, height: 0.9, mirrored: false, materials: {} }],
  size: { w: 0.8, d: 0.8 },
  shelf: 'Should not be copied',
};

describe('library collections', () => {
  it('lists every item used in the project, in every layout option, once', () => {
    const place = (d: D, id: string, assetId: string) =>
      void (d.objects[id] = { id, assetId, name: null, x: 0, y: 0, elevation: 0, rotation: 0, width: 1, depth: 1, height: 1, mirrored: false, materials: {}, locked: false, hidden: false, edits: { params: { head: 0.5 } } } as never);
    let p = edit(createEmptyProject(), (d) => {
      place(d, 'o1', 'sofa-3');
      place(d, 'o2', 'rug-rect');
      place(d, 'o3', 'sofa-3');
      addOption(d, 'blank');
      place(d, 'o4', 'floor-lamp-tripod');
      place(d, 'o5', 'rug-rect');
    });
    expect(usedItemIds(p).sort()).toEqual(['floor-lamp-tripod', 'rug-rect', 'sofa-3']);
    // Added as library ids: nothing of the placed copies (shape edits) comes along.
    let id = '';
    p = edit(p, (d) => {
      id = createCollection(d, '60LTN', undefined, ['rug-rect']);
      addToCollection(d, id, usedItemIds(d as unknown as Project));
    });
    expect([...p.collections[0].items].sort()).toEqual(['floor-lamp-tripod', 'rug-rect', 'sofa-3']);
  });

  it('creates, edits, fills and deletes collections', () => {
    let id = '';
    let p = edit(createEmptyProject(), (d) => {
      id = createCollection(d, '  Living picks  ', ' Soft things ', ['sofa-3', 'sofa-3', 'rug-rect']);
    });
    expect(p.collections).toEqual([{ id, name: 'Living picks', description: 'Soft things', items: ['sofa-3', 'rug-rect'], groups: {} }]);
    p = edit(p, (d) => updateCollection(d, id, { name: 'Lounge', description: '' }));
    expect(p.collections[0].name).toBe('Lounge');
    expect('description' in p.collections[0]).toBe(false);
    // A blank name is ignored rather than clearing the name.
    p = edit(p, (d) => updateCollection(d, id, { name: '   ' }));
    expect(p.collections[0].name).toBe('Lounge');
    p = edit(p, (d) => addToCollection(d, id, ['floor-lamp-tripod', 'rug-rect']));
    expect(p.collections[0].items).toEqual(['sofa-3', 'rug-rect', 'floor-lamp-tripod']);
    p = edit(p, (d) => removeFromCollection(d, id, ['sofa-3']));
    expect(p.collections[0].items).toEqual(['rug-rect', 'floor-lamp-tripod']);
    p = edit(p, (d) => deleteCollection(d, id));
    expect(p.collections).toEqual([]);
  });

  it('names an unnamed collection and keeps the order when moving', () => {
    let a = '';
    let b = '';
    let p = edit(createEmptyProject(), (d) => {
      a = createCollection(d, '');
      b = createCollection(d, 'Second');
    });
    expect(p.collections.map((c) => c.name)).toEqual(['Collection 1', 'Second']);
    p = edit(p, (d) => moveCollection(d, b, 0));
    expect(p.collections.map((c) => c.id)).toEqual([b, a]);
  });

  it('keeps a copy of a saved group only while the group is in the collection', () => {
    let id = '';
    let p = edit(createEmptyProject(), (d) => {
      id = createCollection(d, 'Corners', undefined, ['savedgroup:g1'], [group]);
    });
    const copy = p.collections[0].groups.g1;
    expect(copy.name).toBe('Reading corner');
    expect('shelf' in copy).toBe(false);
    // A copy without its item in the collection is not kept.
    p = edit(p, (d) => addToCollection(d, id, [], [{ ...group, id: 'g2' }]));
    expect(Object.keys(p.collections[0].groups)).toEqual(['g1']);
    p = edit(p, (d) => removeFromCollection(d, id, ['savedgroup:g1']));
    expect(p.collections[0].groups).toEqual({});
  });

  it('is shared by every layout option', () => {
    let col = '';
    let optB = '';
    let p = edit(createEmptyProject(), (d) => {
      col = createCollection(d, 'Shared', undefined, ['sofa-3']);
      optB = addOption(d, 'blank');
    });
    // addOption switches to the new option: the collection is still there, and edits made in
    // option B show in option A too.
    expect(p.collections.map((c) => c.id)).toEqual([col]);
    p = edit(p, (d) => addToCollection(d, col, ['rug-rect']));
    const optA = p.options!.find((o) => o.id !== optB)!.id;
    p = edit(p, (d) => void switchOption(d, optA));
    expect(p.collections[0].items).toEqual(['sofa-3', 'rug-rect']);
    p = edit(p, (d) => void deleteOption(d, optB));
    expect(p.collections[0].items).toEqual(['sofa-3', 'rug-rect']);
    for (const o of p.options ?? []) expect(o.plan === null || !('collections' in o.plan)).toBe(true);
  });

  it('round-trips through the schema and loads older projects without collections', () => {
    const p = edit(createEmptyProject(), (d) => void createCollection(d, 'Kept', 'Note', ['sofa-3', 'savedgroup:g1'], [group]));
    const raw = JSON.parse(JSON.stringify(p));
    expect(ProjectSchema.parse(raw).collections).toEqual(p.collections);
    expect(migrateProject(raw).project.collections).toEqual(p.collections);
    delete raw.collections;
    const { project, warnings } = migrateProject(raw);
    expect(project.collections).toEqual([]);
    expect(warnings).toEqual([]);
  });
});

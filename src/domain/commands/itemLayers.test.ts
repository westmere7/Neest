import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { createEmptyProject } from '../model/defaults';
import { ProjectSchema, type Project } from '../model/schema';
import { migrateProject } from '@/storage/migrations';
import { buildColliders } from '../walkthrough/collision';
import { computeWallNetwork } from '../geometry/walls';
import type { D } from './walls';
import { duplicateEntities, placeObject } from './entities';
import { addOption, switchOption } from './options';
import {
  ITEM_LAYER_COLORS,
  addItemLayer,
  deleteItemLayer,
  isObjectHidden,
  isObjectLocked,
  itemLayerOf,
  moveItemLayer,
  objectsInLayer,
  setAllItemLayersVisible,
  setObjectsLayer,
  updateItemLayer,
  updateUnassignedLayer,
} from './itemLayers';

const edit = (p: Project, fn: (d: D) => void): Project => produce(p, fn);

/** A project with three chairs; returns their ids too. */
function withChairs(): { p: Project; ids: string[] } {
  const ids: string[] = [];
  const p = edit(createEmptyProject(), (d) => {
    for (let i = 0; i < 3; i++) ids.push(placeObject(d, { assetId: 'dining-chair', x: i, y: 0, width: 0.45, depth: 0.5, height: 0.9 }));
  });
  return { p, ids };
}

describe('item layers', () => {
  it('creates, renames, recolours, reorders and deletes layers', () => {
    let a = '';
    let b = '';
    let p = edit(createEmptyProject(), (d) => {
      a = addItemLayer(d);
      b = addItemLayer(d, '  Kitchen  ');
    });
    expect(p.itemLayers.map((l) => l.name)).toEqual(['Layer 1', 'Kitchen']);
    expect(p.itemLayers[0]).toMatchObject({ visible: true, locked: false, color: ITEM_LAYER_COLORS[0] });
    expect(p.itemLayers[1].color).toBe(ITEM_LAYER_COLORS[1]);
    p = edit(p, (d) => updateItemLayer(d, a, { name: 'Lighting', color: '#123456' }));
    // A blank name is ignored.
    p = edit(p, (d) => updateItemLayer(d, a, { name: '   ' }));
    expect(p.itemLayers[0]).toMatchObject({ name: 'Lighting', color: '#123456' });
    p = edit(p, (d) => moveItemLayer(d, b, 0));
    expect(p.itemLayers.map((l) => l.id)).toEqual([b, a]);
    p = edit(p, (d) => deleteItemLayer(d, b));
    expect(p.itemLayers.map((l) => l.id)).toEqual([a]);
    // New default names skip ones in use.
    p = edit(p, (d) => void addItemLayer(d));
    expect(p.itemLayers[1].name).toBe('Layer 2');
  });

  it('files items under layers and back to Unassigned', () => {
    const { p: p0, ids } = withChairs();
    let a = '';
    let p = edit(p0, (d) => {
      a = addItemLayer(d, 'Dining');
      setObjectsLayer(d, ids.slice(0, 2), a);
    });
    expect(objectsInLayer(p, a).map((o) => o.id)).toEqual(ids.slice(0, 2));
    expect(objectsInLayer(p, null).map((o) => o.id)).toEqual([ids[2]]);
    expect(itemLayerOf(p, p.objects[ids[0]])?.name).toBe('Dining');
    // Unknown layer ids are ignored.
    p = edit(p, (d) => setObjectsLayer(d, [ids[2]], 'lay_missing'));
    expect(p.objects[ids[2]].layerId).toBeUndefined();
    p = edit(p, (d) => setObjectsLayer(d, [ids[0]], null));
    expect('layerId' in p.objects[ids[0]]).toBe(false);
  });

  it('hides and locks items through their layer, Unassigned included', () => {
    const { p: p0, ids } = withChairs();
    let a = '';
    let p = edit(p0, (d) => {
      a = addItemLayer(d, 'Dining');
      setObjectsLayer(d, [ids[0]], a);
    });
    const o = (id: string) => p.objects[id];
    expect(isObjectHidden(p, o(ids[0]))).toBe(false);
    p = edit(p, (d) => updateItemLayer(d, a, { visible: false, locked: true }));
    expect(isObjectHidden(p, o(ids[0]))).toBe(true);
    expect(isObjectLocked(p, o(ids[0]))).toBe(true);
    expect(isObjectHidden(p, o(ids[1]))).toBe(false);
    p = edit(p, (d) => updateUnassignedLayer(d, { visible: false }));
    expect(isObjectHidden(p, o(ids[1]))).toBe(true);
    // The item's own flags still count on a shown layer.
    p = edit(p, (d) => {
      setAllItemLayersVisible(d, true);
      d.objects[ids[2]].hidden = true;
      d.objects[ids[1]].locked = true;
    });
    expect(p.itemLayers[0].visible && p.layers.unassigned.visible).toBe(true);
    expect(isObjectHidden(p, o(ids[2]))).toBe(true);
    expect(isObjectLocked(p, o(ids[1]))).toBe(true);
    // Items filed under a layer that is gone count as Unassigned.
    expect(isObjectHidden(p, { hidden: false, layerId: 'lay_gone' })).toBe(false);
  });

  it('leaves hidden-layer items out of walk collisions', () => {
    const { p: p0, ids } = withChairs();
    const net = (p: Project) => computeWallNetwork(p);
    let p = edit(p0, (d) => void (d.objects[ids[0]].height = 1));
    const before = buildColliders(p, net(p)).length;
    p = edit(p, (d) => {
      const a = addItemLayer(d);
      setObjectsLayer(d, [ids[0]], a);
      updateItemLayer(d, a, { visible: false });
    });
    expect(buildColliders(p, net(p)).length).toBeLessThan(before);
  });

  it('keeps the layer on duplicates and clears it in every option when the layer is deleted', () => {
    const { p: p0, ids } = withChairs();
    let a = '';
    let copies: string[] = [];
    let p = edit(p0, (d) => {
      a = addItemLayer(d, 'Dining');
      setObjectsLayer(d, ids, a);
      copies = duplicateEntities(d, [ids[0]], { x: 1, y: 1 });
    });
    expect(p.objects[copies[0]].layerId).toBe(a);
    // A duplicated option keeps its items on the layer; deleting the layer unfiles both.
    let optB = '';
    p = edit(p, (d) => void (optB = addOption(d, 'duplicate')));
    const optA = p.options!.find((o) => o.id !== optB)!.id;
    p = edit(p, (d) => deleteItemLayer(d, a));
    expect(Object.values(p.objects).some((o) => o.layerId)).toBe(false);
    p = edit(p, (d) => void switchOption(d, optA));
    expect(Object.values(p.objects).some((o) => o.layerId)).toBe(false);
    expect(Object.keys(p.objects).length).toBe(4);
  });

  it('loads older projects with defaults and repairs unknown layer ids', () => {
    const raw = JSON.parse(JSON.stringify(withChairs().p)) as Record<string, unknown>;
    delete raw.itemLayers;
    delete (raw.layers as Record<string, unknown>).unassigned;
    const { project, warnings } = migrateProject(raw);
    expect(project.itemLayers).toEqual([]);
    expect(project.layers.unassigned).toEqual({ visible: true, locked: false });
    expect(warnings).toEqual([]);

    const objects = raw.objects as Record<string, Record<string, unknown>>;
    const first = Object.keys(objects)[0];
    objects[first].layerId = 'lay_missing';
    raw.itemLayers = [
      { id: 'lay_a', name: 'A', color: 'not-a-colour' },
      { id: 'lay_a', name: 'Duplicate' },
    ];
    const fixed = migrateProject(raw);
    expect(fixed.project.objects[first].layerId).toBeUndefined();
    expect(fixed.project.itemLayers).toEqual([{ id: 'lay_a', name: 'A', visible: true, locked: false, color: undefined }]);
    expect(fixed.warnings.some((w) => w.includes('missing layer'))).toBe(true);
  });

  it('gives new projects an empty layer list', () => {
    const p = createEmptyProject();
    expect(p.itemLayers).toEqual([]);
    expect(ProjectSchema.parse(p).layers.unassigned).toEqual({ visible: true, locked: false });
  });
});

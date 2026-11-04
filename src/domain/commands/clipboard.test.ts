import { describe, expect, it } from 'vitest';
import { produce } from 'immer';
import '@/packs/loader';
import { createEmptyProject } from '../model/defaults';
import { getAsset } from '@/data/assets/registry';
import type { Project } from '../model/schema';
import { placeObject, groupObjects } from './entities';
import { addItemLayer } from './itemLayers';
import { clipboardText, copyPayload, parseClipboard, pasteObjects, type ClipboardPayload } from './clipboard';

const exists = (id: string) => !!getAsset(null, id);

/** A project with a grouped pair (one with shape edits and a model), a lone item on a layer, and a project material. */
function source(): { p: Project; pair: string[]; lone: string } {
  let pair: string[] = [];
  let lone = '';
  const p = produce(createEmptyProject({ name: 'From' }), (d) => {
    const layer = addItemLayer(d, 'Kitchen');
    // A project's own material (JSON copy: a draft cannot be structured-cloned).
    d.materials['mat_mine'] = { ...JSON.parse(JSON.stringify(Object.values(d.materials)[0])), id: 'mat_mine', name: 'My paint' };
    const a = placeObject(d, { assetId: 'portal-frames:corner-portal-half-wall', x: 1, y: 2, rotation: 0, width: 4.2, depth: 2.9, height: 2.7, elevation: 0, materials: { frame: 'mat_mine' }, model: 'half-wall' });
    d.objects[a].edits = { params: { legA: 0.5 } };
    const b = placeObject(d, { assetId: 'sofa-3-seat', x: 3, y: 2, rotation: 0, width: 2.2, depth: 0.9, height: 0.8, elevation: 0, materials: {} });
    groupObjects(d, [a, b], 'Corner set');
    lone = placeObject(d, { assetId: 'sofa-3-seat', x: 5, y: 5, rotation: 1, width: 2.2, depth: 0.9, height: 0.8, elevation: 0, materials: {} });
    d.objects[lone].layerId = layer;
    d.objects[lone].locked = true;
    pair = [a, b];
  });
  return { p, pair, lone };
}

const paste = (target: Project, payload: ClipboardPayload, offset = { x: 0, y: 0 }) => {
  let ids: string[] = [];
  let skipped = 0;
  const next = produce(target, (d) => {
    ({ ids, skipped } = pasteObjects(d, payload, offset, exists));
  });
  return { next, ids, skipped };
};

describe('copy and paste of items', () => {
  it('round-trips through clipboard text; other text is not a paste', () => {
    const { p, pair, lone } = source();
    const payload = copyPayload(p, [...pair, lone, 'wall_nope'])!;
    expect(payload.objects).toHaveLength(3);
    expect(parseClipboard(clipboardText(payload))).toEqual(payload);
    expect(parseClipboard('hello')).toBeNull();
    expect(parseClipboard('{"kind":"neest-clipboard","v":1}')).toBeNull();
    expect(copyPayload(p, ['wall_nope'])).toBeNull();
  });

  it('pastes into another project in place: exact shape, model, finishes, a new group, the layer by name', () => {
    const { p, pair, lone } = source();
    const payload = copyPayload(p, [...pair, lone])!;
    const target = produce(createEmptyProject({ name: 'To' }), (d) => void addItemLayer(d, 'Kitchen'));
    const { next, ids, skipped } = paste(target, payload);
    expect(skipped).toBe(0);
    expect(ids).toHaveLength(3);
    const [a, b, c] = ids.map((id) => next.objects[id]);
    expect(a.edits).toEqual({ params: { legA: 0.5 } });
    expect(a.model).toBe('half-wall');
    expect([a.x, a.y]).toEqual([1, 2]);
    // The project material came along.
    expect(next.materials['mat_mine']?.name).toBe('My paint');
    expect(a.materials.frame).toBe('mat_mine');
    // The pair is a new group with the same name; the lone item is not grouped.
    expect(a.groupId).toBeTruthy();
    expect(a.groupId).toBe(b.groupId);
    expect(a.groupId).not.toBe(p.objects[pair[0]].groupId);
    expect(next.groups[a.groupId!].name).toBe('Corner set');
    expect(c.groupId).toBeUndefined();
    // Filed under the target's layer of the same name; copies come unlocked.
    expect(c.layerId).toBe(next.itemLayers.find((l) => l.name === 'Kitchen')!.id);
    expect(c.locked).toBe(false);
  });

  it('pasting back home names the group a copy and moves by the offset; a half group is no group', () => {
    const { p, pair } = source();
    const { next, ids } = paste(p, copyPayload(p, pair)!, { x: 0.3, y: 0.3 });
    const a = next.objects[ids[0]];
    expect([a.x, a.y]).toEqual([1.3, 2.3]);
    expect(next.groups[a.groupId!].name).toBe('Corner set copy');
    const one = paste(p, copyPayload(p, [pair[0]])!);
    expect(one.next.objects[one.ids[0]].groupId).toBeUndefined();
    expect(Object.keys(one.next.groups)).toHaveLength(Object.keys(p.groups).length);
  });

  it('leaves out items whose library item is not installed', () => {
    const { p, pair } = source();
    const payload = copyPayload(p, pair)!;
    payload.objects[1] = { ...payload.objects[1], assetId: 'some-pack:not-installed' };
    const { ids, skipped, next } = paste(createEmptyProject({ name: 'To' }), payload);
    expect(skipped).toBe(1);
    expect(ids).toHaveLength(1);
    // Alone, it is no longer a group.
    expect(next.objects[ids[0]].groupId).toBeUndefined();
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import '@/packs/loader';
import { createEmptyProject } from '@/domain/model/defaults';
import { placeObject, groupObjects } from '@/domain/commands/entities';
import { copyPayload } from '@/domain/commands/clipboard';
import { getAsset } from '@/data/assets/registry';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore } from '@/state/editorStore';
import { pastePayload } from './clipboard';
import { groupFromSelection, placeSavedGroup } from './groups';

const project = () => useProjectStore.getState().project!;

/** A project with a portal (shape edits, model variant) grouped with a sofa. */
function setup(): string[] {
  const p = createEmptyProject({ name: 'Clipboard test' });
  useProjectStore.getState().load(p);
  let ids: string[] = [];
  useProjectStore.getState().execute('Place', (d) => {
    const a = placeObject(d, { assetId: 'portal-frames:corner-portal-half-wall', x: 1, y: 2, rotation: 0, width: 4.2, depth: 2.9, height: 2.7, elevation: 0, materials: {}, model: 'half-wall' });
    d.objects[a].edits = { params: { rA: 0.2 } };
    const b = placeObject(d, { assetId: 'sofa-3-seat', x: 3, y: 2, rotation: 0, width: 2.2, depth: 0.9, height: 0.8, elevation: 0, materials: {} });
    groupObjects(d, [a, b], 'Set');
    ids = [a, b];
  });
  useEditorStore.setState({ selection: ids.map((id) => ({ kind: 'object', id })), shapeEdit: null, notesMode: false, workspace: 'plan', tool: 'select' });
  return ids;
}

describe('paste in the editor', () => {
  beforeEach(() => useEditorStore.setState({ selection: [] }));

  it('steps each paste of one copy further from the originals and selects the copies', () => {
    const ids = setup();
    const payload = copyPayload(project(), ids)!;
    const first = pastePayload(payload);
    const second = pastePayload(payload);
    const step = Math.max(project().settings.gridSize, 0.1) * 3;
    expect(project().objects[first[0]].x).toBeCloseTo(1 + step);
    expect(project().objects[second[0]].x).toBeCloseTo(1 + 2 * step);
    expect(useEditorStore.getState().selection.map((s) => s.id)).toEqual(second);
    // In place, and centred on a point.
    const inPlace = pastePayload(payload, undefined, true);
    expect(project().objects[inPlace[0]].x).toBeCloseTo(1);
    const here = pastePayload(payload, { x: 10, y: 10 });
    const xs = here.map((id) => project().objects[id].x);
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(10);
  });

  it('pastes from another project where the items were', () => {
    const ids = setup();
    const payload = { ...copyPayload(project(), ids)!, projectId: 'prj_elsewhere' };
    const out = pastePayload(payload);
    expect(project().objects[out[0]].x).toBe(1);
    expect(project().objects[out[0]].edits).toEqual({ params: { rA: 0.2 } });
  });
});

describe('duplicate keeps the exact shape and variant', () => {
  it('a duplicated group keeps shape edits and the model variant', () => {
    setup();
    const g = groupFromSelection()!;
    expect(g.items[0].edits).toEqual({ params: { rA: 0.2 } });
    expect(g.items[0].model).toBe('half-wall');
    const before = new Set(Object.keys(project().objects));
    placeSavedGroup(g, { x: 8, y: 8 });
    const copies = Object.values(project().objects).filter((o) => !before.has(o.id));
    const portal = copies.find((o) => o.assetId === 'portal-frames:corner-portal-half-wall')!;
    expect(portal.edits).toEqual({ params: { rA: 0.2 } });
    expect(portal.model).toBe('half-wall');
    expect(getAsset(project(), portal.assetId)).toBeTruthy();
  });
});

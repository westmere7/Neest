import { beforeEach, describe, expect, it } from 'vitest';
import '@/packs/loader';
import { createEmptyProject } from '@/domain/model/defaults';
import { placeObject, groupObjects } from '@/domain/commands/entities';
import { copyPayload } from '@/domain/commands/clipboard';
import { addOption, switchOption } from '@/domain/commands/options';
import { getAsset } from '@/data/assets/registry';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore } from '@/state/editorStore';
import { planContextMenuItems } from '@/features/plan-2d/contextMenu';
import { copySelection, copySelectionToOption, pasteFromClipboard, pastePayload } from './clipboard';
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

  it('copies and pastes items across layout options in the same project (both via clipboard and Copy to option)', async () => {
    const ids = setup();
    await copySelection();
    let optB = '';
    useProjectStore.getState().execute('Add Option B', (d) => {
      optB = addOption(d, 'shell', 'Option B');
    });
    expect(Object.keys(project().objects)).toHaveLength(0);
    // Right-click menu inside a room in Option B offers Paste and Paste here.
    const roomMenu = planContextMenuItems({ kind: 'room', id: 'room_1' }, { x: 2, y: 2 }).map((m) => m.label);
    expect(roomMenu).toContain('Paste');
    expect(roomMenu).toContain('Paste here');

    await pasteFromClipboard();
    const pastedIds = Object.keys(project().objects);
    expect(pastedIds).toHaveLength(2);
    const portal = Object.values(project().objects).find((o) => o.assetId === 'portal-frames:corner-portal-half-wall')!;
    expect([portal.x, portal.y]).toEqual([1, 2]);
    expect(portal.edits).toEqual({ params: { rA: 0.2 } });

    // Direct Copy to another option from Option A into a third option C.
    let optC = '';
    useProjectStore.getState().execute('Add Option C', (d) => {
      optC = addOption(d, 'shell', 'Option C');
      const optA = d.options!.find((o) => o.id !== optB && o.id !== optC)!.id;
      switchOption(d, optA);
    });
    useEditorStore.setState({ selection: [{ kind: 'object', id: ids[0] }] });
    const objMenu = planContextMenuItems({ kind: 'object', id: ids[0] }, { x: 1, y: 2 }).map((m) => m.label);
    expect(objMenu).toContain('Copy to “Option C”');
    const copiedToC = copySelectionToOption(optC);
    expect(copiedToC).toHaveLength(1);
    const cPlan = project().options!.find((o) => o.id === optC)!.plan!;
    expect(cPlan.objects[copiedToC[0]].x).toBe(1);
    expect(cPlan.objects[copiedToC[0]].edits).toEqual({ params: { rA: 0.2 } });
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

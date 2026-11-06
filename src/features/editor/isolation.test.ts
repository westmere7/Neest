import { beforeEach, describe, expect, it } from 'vitest';
import '@/packs/loader';
import { createEmptyProject } from '@/domain/model/defaults';
import { groupObjects, placeObject, ungroupObjects } from '@/domain/commands/entities';
import { copyPayload } from '@/domain/commands/clipboard';
import { derivePlan } from '@/domain/geometry/derive';
import type { Vec2 } from '@/domain/model/schema';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore } from '@/state/editorStore';
import { createSelectTool } from '@/features/plan-2d/tools/selectTool';
import type { PointerInfo, ToolEnv } from '@/features/plan-2d/tools/types';
import { enterIsolation, exitIsolation } from './isolation';
import { pastePayload } from './clipboard';
import './groups';

const project = () => useProjectStore.getState().project!;
const ed = () => useEditorStore.getState();
const ids = () => ed().selection.map((s) => s.id).sort();

/** A grouped table and two chairs, and a sofa outside the group. */
function setup() {
  useProjectStore.getState().load(createEmptyProject({ name: 'Isolation' }));
  const r = { table: '', chairA: '', chairB: '', sofa: '', group: '' };
  useProjectStore.getState().execute('Place', (d) => {
    const put = (assetId: string, x: number, y: number) => placeObject(d, { assetId, x, y, rotation: 0, width: 0.8, depth: 0.8, height: 0.8, elevation: 0, materials: {} });
    r.table = put('side-table', 2, 2);
    r.chairA = put('side-table', 3, 2);
    r.chairB = put('side-table', 4, 2);
    r.sofa = put('sofa-3-seat', 2, 5);
    r.group = groupObjects(d, [r.table, r.chairA, r.chairB], 'Dining set')!;
  });
  useEditorStore.setState({ isolatedGroupId: null, selection: [], tool: 'select', notesMode: false, servicesMode: false, workspace: 'plan' });
  return r;
}

function env(): ToolEnv {
  return {
    project: () => project(),
    derived: () => derivePlan(project()),
    editor: () => ed(),
    px: () => 0.01,
    tol: () => 0.05,
    snap: (p) => ({ point: p, kind: 'none', label: '', guides: [] }),
    setOverlay: () => {},
    setHint: () => {},
    setSnapLabel: () => {},
    setCursor: () => {},
    finish: () => {},
  };
}
const ptr = (p: Vec2): PointerInfo => ({ world: p, screen: { x: p.x * 100, y: p.y * 100 }, button: 0, shift: false, alt: false, mod: false, pointerType: 'mouse' });

describe('group isolation', () => {
  beforeEach(() => useEditorStore.setState({ isolatedGroupId: null }));

  it('selects whole groups outside isolation, single items inside it, and nothing outside the group', () => {
    const r = setup();
    ed().setSelection([{ kind: 'object', id: r.table }]);
    expect(ids()).toEqual([r.table, r.chairA, r.chairB].sort());
    enterIsolation(r.group, r.chairA);
    expect(ed().isolatedGroupId).toBe(r.group);
    expect(ids()).toEqual([r.chairA]);
    ed().setSelection([{ kind: 'object', id: r.sofa }, { kind: 'object', id: r.chairB }]);
    expect(ids()).toEqual([r.chairB]);
    exitIsolation();
    expect(ed().isolatedGroupId).toBeNull();
    expect(ids()).toEqual([r.table, r.chairA, r.chairB].sort());
  });

  it('double-click enters on a grouped item, picks only its items inside, and leaves outside the group (plan)', () => {
    const r = setup();
    const tool = createSelectTool();
    const e = env();
    tool.onDoubleClick?.(ptr({ x: 3, y: 2 }), e);
    expect(ed().isolatedGroupId).toBe(r.group);
    expect(ids()).toEqual([r.chairA]);
    // A click on the sofa (outside the group) picks nothing.
    tool.onPointerDown?.(ptr({ x: 2, y: 5 }), e);
    tool.onPointerUp?.(ptr({ x: 2, y: 5 }), e);
    expect(ids()).not.toContain(r.sofa);
    // A click on another member selects just it.
    tool.onPointerDown?.(ptr({ x: 4, y: 2 }), e);
    tool.onPointerUp?.(ptr({ x: 4, y: 2 }), e);
    expect(ids()).toEqual([r.chairB]);
    // A double-click on empty floor leaves.
    tool.onDoubleClick?.(ptr({ x: 8, y: 8 }), e);
    expect(ed().isolatedGroupId).toBeNull();
  });

  it('items pasted inside join the group', () => {
    const r = setup();
    enterIsolation(r.group, r.table);
    const pasted = pastePayload(copyPayload(project(), [r.sofa])!, { x: 6, y: 6 });
    expect(pasted).toHaveLength(1);
    expect(project().objects[pasted[0]].groupId).toBe(r.group);
    expect(ids()).toEqual(pasted);
  });

  it('ends by itself when the group goes away, also through undo', () => {
    const r = setup();
    enterIsolation(r.group, r.table);
    useProjectStore.getState().execute('Ungroup', (d) => ungroupObjects(d, [r.table]));
    expect(ed().isolatedGroupId).toBeNull();
    // Undo brings the group back; isolating it and undoing its creation ends isolation again.
    useProjectStore.getState().undo();
    enterIsolation(r.group);
    expect(ed().isolatedGroupId).toBe(r.group);
    useProjectStore.getState().undo();
    expect(ed().isolatedGroupId).toBeNull();
  });

  it('ends when Notes mode starts or another project opens', () => {
    const r = setup();
    enterIsolation(r.group);
    ed().set({ notesMode: true });
    expect(ed().isolatedGroupId).toBeNull();
    ed().set({ notesMode: false });
    enterIsolation(r.group);
    useProjectStore.getState().load(createEmptyProject({ name: 'Other' }));
    expect(ed().isolatedGroupId).toBeNull();
  });
});

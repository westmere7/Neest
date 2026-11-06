import { beforeEach, describe, expect, it } from 'vitest';
import { produce } from 'immer';
import '@/packs/loader';
import { createEmptyProject } from '@/domain/model/defaults';
import { derivePlan } from '@/domain/geometry/derive';
import { addCallout } from '@/domain/commands/callouts';
import type { Project, Vec2 } from '@/domain/model/schema';
import { layoutCallout, withNotesShown } from '@/features/callouts/layout';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore } from '@/state/editorStore';
import { useDialogStore } from '@/state/uiStores';
import { createCalloutTool } from './calloutTool';
import type { PointerInfo, ToolEnv } from './types';

const PX = 0.01;

/** The env the plan gives its tools: in Notes mode they see the notes as drawn (PlanCanvas). */
function makeEnv(): ToolEnv {
  const store = () => useProjectStore.getState().project!;
  return {
    project: () => (useEditorStore.getState().notesMode ? withNotesShown(store()) : store()),
    derived: () => derivePlan(store()),
    editor: () => useEditorStore.getState(),
    px: () => PX,
    tol: () => PX * 9,
    snap: (p) => ({ point: p, kind: 'none', label: '', guides: [] }),
    setOverlay: () => {},
    setHint: () => {},
    setSnapLabel: () => {},
    setCursor: () => {},
    finish: () => {},
  };
}

const ptr = (p: Vec2, screen = { x: 100, y: 100 }): PointerInfo => ({ world: p, screen, button: 0, shift: false, alt: false, mod: false, pointerType: 'mouse' });

/** A project with one spot note, the Notes layer as given; returns the note id and the middle of its label. */
function setup(layerVisible: boolean): { id: string; label: Vec2 } {
  let id = '';
  const p = produce(createEmptyProject({ name: 'Notes click' }), (d) => {
    id = addCallout(d, { target: { kind: 'point', x: 2, y: 2, z: 0 }, note: 'Check the drawer runners' });
    d.layers.callouts.visible = layerVisible;
  }) as Project;
  useProjectStore.getState().load(p);
  useEditorStore.setState({ notesMode: true, tool: 'callout', selection: [] });
  useDialogStore.setState({ openDialog: null });
  const l = layoutCallout(withNotesShown(p), derivePlan(p), p.callouts[id], PX)!;
  return { id, label: { x: l.box.x + l.box.w / 2, y: l.box.y + l.box.h / 2 } };
}

describe('clicking a note in Notes mode', () => {
  beforeEach(() => useEditorStore.setState({ notesMode: false }));

  for (const visible of [true, false])
    it(`opens it for editing with "Show in workspace" ${visible ? 'on' : 'off'}, and adds no note`, () => {
      const { id, label } = setup(visible);
      const tool = createCalloutTool();
      const env = makeEnv();
      const count = Object.keys(useProjectStore.getState().project!.callouts).length;
      tool.onPointerDown?.(ptr(label), env);
      tool.onPointerUp?.(ptr(label), env);
      expect(useEditorStore.getState().selection).toEqual([{ kind: 'callout', id }]);
      expect(useDialogStore.getState().openDialog).toBe('callout');
      expect(Object.keys(useProjectStore.getState().project!.callouts)).toHaveLength(count);
      // The layer setting is left as it was.
      expect(useProjectStore.getState().project!.layers.callouts.visible).toBe(visible);
    });

  it('a drag moves the note instead of opening it', () => {
    const { label } = setup(false);
    const tool = createCalloutTool();
    const env = makeEnv();
    tool.onPointerDown?.(ptr(label), env);
    const to = { x: label.x + 0.5, y: label.y };
    tool.onPointerMove?.(ptr(to, { x: 150, y: 100 }), env);
    tool.onPointerUp?.(ptr(to, { x: 150, y: 100 }), env);
    expect(useDialogStore.getState().openDialog).toBeNull();
  });
});

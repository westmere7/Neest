import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyProject } from '@/domain/model/defaults';
import type { Vec2 } from '@/domain/model/schema';
import { derivePlan } from '@/domain/geometry/derive';
import { computeWallNetwork } from '@/domain/geometry/walls';
import { bezierPoint } from '@/domain/geometry/wallPath';
import { addWallChain, findNodeNear } from '@/domain/commands/walls';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore } from '@/state/editorStore';
import { createCurveTool, createMeasureTool, createRoomTool, createWallTool, roomCentreCorners } from './drawTools';
import { createExtendTool } from './extendTool';
import type { PointerInfo, Tool, ToolEnv, ToolOverlay } from './types';

const T = 0.2;

function makeEnv() {
  const state: { overlay: ToolOverlay | null; hint: string | null } = { overlay: null, hint: null };
  const env: ToolEnv = {
    project: () => useProjectStore.getState().project!,
    derived: () => derivePlan(useProjectStore.getState().project!),
    editor: () => useEditorStore.getState(),
    px: () => 0.01,
    tol: () => 0.05,
    // No snapping: tests click exact coordinates.
    snap: (p) => ({ point: p, kind: 'none', label: '', guides: [] }),
    setOverlay: (o) => (state.overlay = o),
    setHint: (h) => (state.hint = h),
    setSnapLabel: () => {},
    setCursor: () => {},
    finish: () => {},
  };
  return { env, state };
}

const ptr = (p: Vec2): PointerInfo => ({ world: p, screen: { x: 0, y: 0 }, button: 0, shift: false, alt: false, mod: false, pointerType: 'mouse' });
const click = (tool: Tool, env: ToolEnv, p: Vec2) => {
  tool.onPointerMove?.(ptr(p), env);
  tool.onPointerDown?.(ptr(p), env);
  tool.onPointerUp?.(ptr(p), env);
};
const key = (tool: Tool, env: ToolEnv, k: string) => tool.onKeyDown?.(new KeyboardEvent('keydown', { key: k }), env);
const project = () => useProjectStore.getState().project!;
const nodeAt = (p: Vec2) => findNodeNear(project(), p, 1e-6);

beforeEach(() => {
  useProjectStore.getState().load(createEmptyProject());
  useEditorStore.setState({ wallReference: 'center', wallThickness: T, wallPreset: null, wallRole: 'interior', measurements: [] });
});

describe('wall tool, drawing by face', () => {
  it('centre reference keeps the clicked points as the centreline', () => {
    const { env } = makeEnv();
    const tool = createWallTool();
    click(tool, env, { x: 0, y: 0 });
    click(tool, env, { x: 4, y: 0 });
    key(tool, env, 'Enter');
    expect(nodeAt({ x: 0, y: 0 })).not.toBeNull();
    expect(nodeAt({ x: 4, y: 0 })).not.toBeNull();
  });

  it('left face: the wall is built to the right of the clicks and mitred at corners', () => {
    useEditorStore.setState({ wallReference: 'left' });
    const { env, state } = makeEnv();
    const tool = createWallTool();
    click(tool, env, { x: 0, y: 0 });
    click(tool, env, { x: 4, y: 0 });
    // East: right is +y, so the centre is at y = +0.1.
    expect(nodeAt({ x: 0, y: 0.1 })).not.toBeNull();
    expect(nodeAt({ x: 4, y: 0.1 })).not.toBeNull();
    // Preview of the next segment (south) shows the re-mitred corner.
    tool.onPointerMove?.(ptr({ x: 4, y: 3 }), env);
    expect(state.overlay?.wallPreviews?.length).toBe(2);
    click(tool, env, { x: 4, y: 3 });
    key(tool, env, 'Enter');
    // South: right is -x, so the centre is at x = 3.9; the corner joins at (3.9, 0.1).
    expect(nodeAt({ x: 3.9, y: 0.1 })).not.toBeNull();
    expect(nodeAt({ x: 3.9, y: 3 })).not.toBeNull();
    expect(Object.keys(project().walls)).toHaveLength(2);
    // The left faces lie on the clicked lines.
    const net = computeWallNetwork(project());
    for (const g of net.walls.values()) {
      const horizontal = Math.abs(project().nodes[g.wall.a].y - project().nodes[g.wall.b].y) < 1e-9;
      for (const p of g.left) {
        if (horizontal) expect(p.y).toBeCloseTo(0, 6);
        else expect(p.x).toBeCloseTo(4, 6);
      }
    }
  });

  it('closing a face-drawn loop mitres the start corner too and makes one room', () => {
    useEditorStore.setState({ wallReference: 'right' });
    const { env } = makeEnv();
    const tool = createWallTool();
    // Clockwise on screen: right of each edge is inside, so the walls are built outwards (clear room 4 x 3).
    for (const p of [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }, { x: 0, y: 0 }]) click(tool, env, p);
    const p = project();
    expect(Object.keys(p.walls)).toHaveLength(4);
    expect(Object.keys(p.nodes)).toHaveLength(4);
    expect(nodeAt({ x: -0.1, y: -0.1 })).not.toBeNull();
    expect(nodeAt({ x: 4.1, y: 3.1 })).not.toBeNull();
    const rooms = derivePlan(p).faces;
    expect(rooms).toHaveLength(1);
    expect(rooms[0].area).toBeCloseTo(12, 6);
  });

  it('Backspace removes the last face segment and keeps drawing from the previous point', () => {
    useEditorStore.setState({ wallReference: 'left' });
    const { env } = makeEnv();
    const tool = createWallTool();
    click(tool, env, { x: 0, y: 0 });
    click(tool, env, { x: 4, y: 0 });
    click(tool, env, { x: 4, y: 3 });
    key(tool, env, 'Backspace');
    expect(Object.keys(project().walls)).toHaveLength(1);
    expect(nodeAt({ x: 4, y: 0.1 })).not.toBeNull();
    click(tool, env, { x: 4, y: -3 });
    key(tool, env, 'Enter');
    expect(Object.keys(project().walls)).toHaveLength(2);
  });
});

describe('room tool, drawing by face', () => {
  it('computes centre corners for each reference', () => {
    const c = roomCentreCorners({ x: 0, y: 0 }, { x: 4, y: 3 }, 'right', T);
    expect(c[0]).toEqual({ x: expect.closeTo(-0.1, 9), y: expect.closeTo(-0.1, 9) });
    const inner = roomCentreCorners({ x: 4, y: 3 }, { x: 0, y: 0 }, 'left', T);
    expect(inner[2]).toEqual({ x: expect.closeTo(3.9, 9), y: expect.closeTo(2.9, 9) });
  });

  it('inner face = clear room size', () => {
    useEditorStore.setState({ wallReference: 'right' });
    const { env } = makeEnv();
    const tool = createRoomTool();
    click(tool, env, { x: 0, y: 0 });
    click(tool, env, { x: 4, y: 3 });
    const rooms = derivePlan(project()).faces;
    expect(rooms).toHaveLength(1);
    expect(rooms[0].area).toBeCloseTo(12, 6);
  });

  it('outer face = walls inside the rectangle', () => {
    useEditorStore.setState({ wallReference: 'left' });
    const { env } = makeEnv();
    const tool = createRoomTool();
    click(tool, env, { x: 0, y: 0 });
    click(tool, env, { x: 4, y: 3 });
    const rooms = derivePlan(project()).faces;
    expect(rooms[0].area).toBeCloseTo(3.6 * 2.6, 6);
  });
});

describe('curve tool', () => {
  it('3-point arc passes through the third click', () => {
    const { env } = makeEnv();
    const tool = createCurveTool();
    click(tool, env, { x: 0, y: 0 });
    click(tool, env, { x: 4, y: 0 });
    click(tool, env, { x: 2, y: -1 });
    const w = Object.values(project().walls)[0];
    expect(w.curve).not.toBeNull();
    const a = project().nodes[w.a];
    const b = project().nodes[w.b];
    const mid = bezierPoint(a, w.curve!, b, 0.5);
    expect(mid.x).toBeCloseTo(2, 9);
    expect(mid.y).toBeCloseTo(-1, 9);
  });

  it('typed chord length and bulge', () => {
    const { env } = makeEnv();
    const tool = createCurveTool();
    click(tool, env, { x: 0, y: 0 });
    tool.onPointerMove?.(ptr({ x: 1, y: 0 }), env);
    for (const k of ['5', 'Enter']) key(tool, env, k);
    // Pointer below the chord (screen down = right of an eastward chord).
    tool.onPointerMove?.(ptr({ x: 2, y: 1 }), env);
    for (const k of ['0', '.', '5', 'Enter']) key(tool, env, k);
    const w = Object.values(project().walls)[0];
    const a = project().nodes[w.a];
    const b = project().nodes[w.b];
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(5, 9);
    const mid = bezierPoint(a, w.curve!, b, 0.5);
    expect(mid.x).toBeCloseTo(2.5, 9);
    expect(mid.y).toBeCloseTo(0.5, 9);
  });

  it('A toggles free-bend mode', () => {
    const { env, state } = makeEnv();
    const tool = createCurveTool();
    expect(key(tool, env, 'a')).toBe(true);
    expect(state.hint).toMatch(/free bend/i);
    key(tool, env, 'a');
    expect(state.hint).toMatch(/3-point/i);
  });
});

describe('measure tool, face to face', () => {
  it('F measures the clear distance to the opposite face', () => {
    useProjectStore.getState().execute('setup', (d) => {
      addWallChain(d, [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 3 }, { x: 0, y: 3 }], { thickness: 0.2, height: 2.7, role: 'interior', closed: true });
    });
    const { env, state } = makeEnv();
    // Face snaps come from the real snapper.
    env.snap = (p) => ({ point: { x: p.x, y: 0.1 }, kind: 'edge', label: 'Wall face', refId: Object.values(project().walls).find((w) => {
      const a = project().nodes[w.a];
      const b = project().nodes[w.b];
      return a.y === 0 && b.y === 0;
    })!.id, guides: [] });
    const tool = createMeasureTool();
    click(tool, env, { x: 2, y: 0.1 });
    expect(key(tool, env, 'f')).toBe(true);
    const m = useEditorStore.getState().measurements;
    expect(m).toHaveLength(1);
    expect(Math.hypot(m[0].b.x - m[0].a.x, m[0].b.y - m[0].a.y)).toBeCloseTo(2.8, 6);
    expect(state.hint).toMatch(/Clear distance/);
  });

  it('F is left alone (fit plan) when not on a face', () => {
    const { env } = makeEnv();
    const tool = createMeasureTool();
    tool.onPointerMove?.(ptr({ x: 1, y: 1 }), env);
    expect(key(tool, env, 'f')).toBe(false);
  });
});

describe('extend tool', () => {
  it('extends, trims and joins with one undo step each', () => {
    useProjectStore.getState().execute('setup', (d) => {
      addWallChain(d, [{ x: 0, y: 0 }, { x: 6, y: 0 }], { thickness: 0.1, height: 2.7, role: 'interior' });
      addWallChain(d, [{ x: 3, y: 4 }, { x: 3, y: 1 }], { thickness: 0.1, height: 2.7, role: 'interior' });
    });
    const { env, state } = makeEnv();
    const tool = createExtendTool();
    const past = () => useProjectStore.getState().past.length;
    const p0 = past();
    // Hover near the stub's free end: preview + hint.
    tool.onPointerMove?.(ptr({ x: 3, y: 1.1 }), env);
    expect(state.overlay?.wallPreviews?.length).toBe(1);
    expect(state.hint).toMatch(/extend/i);
    click(tool, env, { x: 3, y: 1.1 });
    expect(past()).toBe(p0 + 1);
    expect(Object.keys(project().walls)).toHaveLength(3);

    // Trim the long wall's right half? It has a free end at x = 6 and a junction at x = 3.
    tool.onPointerMove?.(ptr({ x: 4, y: 0 }), env);
    expect(state.hint).toMatch(/trim/i);
    click(tool, env, { x: 4, y: 0 });
    expect(past()).toBe(p0 + 2);
    expect(Object.keys(project().walls)).toHaveLength(2);
    // Removing it left an L corner at (3, 0): not joinable.
    tool.onPointerMove?.(ptr({ x: 3, y: 0 }), env);
    expect(state.hint).toMatch(/straight line/i);
  });

  it('joins at a collinear node', () => {
    useProjectStore.getState().execute('setup', (d) => {
      addWallChain(d, [{ x: 0, y: 0 }, { x: 2, y: 0 }], { thickness: 0.1, height: 2.7, role: 'interior' });
      addWallChain(d, [{ x: 2, y: 0 }, { x: 5, y: 0 }], { thickness: 0.2, height: 2.7, role: 'interior' });
    });
    const { env, state } = makeEnv();
    const tool = createExtendTool();
    tool.onPointerMove?.(ptr({ x: 2.01, y: 0 }), env);
    expect(state.hint).toMatch(/join/i);
    click(tool, env, { x: 2.01, y: 0 });
    expect(Object.keys(project().walls)).toHaveLength(1);
  });

  it('refuses to extend curved walls', () => {
    useProjectStore.getState().execute('setup', (d) => {
      addWallChain(d, [{ x: 0, y: 0 }, { x: 4, y: 0 }], { thickness: 0.1, height: 2.7, role: 'interior', curves: [{ x: 2, y: 1 }] });
      addWallChain(d, [{ x: -2, y: -3 }, { x: -2, y: 3 }], { thickness: 0.1, height: 2.7, role: 'interior' });
    });
    const { env, state } = makeEnv();
    const tool = createExtendTool();
    const before = project();
    click(tool, env, { x: 0.05, y: 0.02 });
    expect(state.hint).toMatch(/Curved walls/);
    expect(project()).toBe(before);
  });
});

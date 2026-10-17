import type { Vec2 } from '@/domain/model/schema';
import { canJoinAtNode, extendWall, findExtension, freeEnds, joinWallsAtNode, nodeDegreeOf, trimWall, wallsAtNode, type ExtensionTarget } from '@/domain/commands/wallTools';
import { pointAt, projectOnPath } from '@/domain/geometry/wallPath';
import { add, dist, leftNormal, scale, sub } from '@/domain/geometry/vec';
import { formatLength } from '@/domain/model/units';
import { useProjectStore } from '@/state/projectStore';
import type { Tool, ToolEnv, ToolOverlay } from './types';
import { wallPreviewPolygon } from './drawTools';

const IDLE_HINT =
  'Extend / trim / join: click near a free wall end to extend it to the next wall, click a dangling piece to trim it, or click the joint between two aligned walls to join them.';

type Action =
  | { kind: 'join'; nodeId: string; label: string }
  | { kind: 'extend'; wallId: string; end: 'a' | 'b'; target: ExtensionTarget; thickness: number }
  | { kind: 'trim'; wallId: string }
  | { kind: 'none'; hint: string };

const fmt = (env: ToolEnv, m: number) => {
  const s = env.project().settings;
  return formatLength(m, s.units, s.precision);
};

/** Works out what a click at `p` would do. Pure apart from reading the environment. */
function analyse(env: ToolEnv, p: Vec2): Action {
  const project = env.project();
  const network = env.derived().network;
  const tol = env.tol();

  // 1. A node under the pointer: join two aligned walls, or extend a free end.
  let node: { id: string; d: number } | null = null;
  for (const n of Object.values(project.nodes)) {
    const d = dist(n, p);
    if (d <= tol * 1.2 && (!node || d < node.d)) node = { id: n.id, d };
  }
  if (node) {
    const deg = nodeDegreeOf(project, node.id);
    if (deg === 2) {
      if (canJoinAtNode(project, node.id)) return { kind: 'join', nodeId: node.id, label: 'Join into one wall' };
      const walls = wallsAtNode(project, node.id);
      if (walls.some((w) => w.locked)) return { kind: 'none', hint: 'One of these walls is locked.' };
      if (walls.some((w) => w.curve)) return { kind: 'none', hint: 'Curved walls can’t be joined.' };
      return { kind: 'none', hint: 'Only walls that continue in a straight line can be joined.' };
    }
  }

  // 2. The wall under the pointer.
  let best: { id: string; s: number; d: number } | null = null;
  for (const g of network.walls.values()) {
    if (g.wall.hidden) continue;
    const proj = projectOnPath(g.path, p);
    if (proj.dist <= g.h + tol && (!best || proj.dist < best.d)) best = { id: g.wall.id, s: proj.s, d: proj.dist };
  }
  if (!best) return { kind: 'none', hint: IDLE_HINT };
  const g = network.walls.get(best.id)!;
  const w = g.wall;
  if (w.locked) return { kind: 'none', hint: 'This wall is locked. Unlock it to extend or trim it.' };
  const ends = freeEnds(project, w.id);
  if (!ends.length) return { kind: 'none', hint: 'This wall has no free end. ' + IDLE_HINT };
  const L = g.path.length;
  const zone = Math.min(L * 0.35, Math.max(tol * 4, 0.5));
  const distTo = (end: 'a' | 'b') => (end === 'a' ? best!.s : L - best!.s);
  const near = ends.filter((e) => distTo(e) <= zone).sort((x, y) => distTo(x) - distTo(y))[0];
  if (near) {
    if (w.curve) return { kind: 'none', hint: 'Curved walls can’t be extended. Use a straight wall, or drag the curved wall’s end.' };
    const target = findExtension(project, w.id, near);
    if (!target) return { kind: 'none', hint: 'No wall to extend to within 30 m in this direction.' };
    return { kind: 'extend', wallId: w.id, end: near, target, thickness: w.thickness };
  }
  if (ends.length === 2) return { kind: 'none', hint: 'This wall stands on its own. Hover near an end to extend it, or delete it to remove it.' };
  return { kind: 'trim', wallId: w.id };
}

function overlayFor(env: ToolEnv, action: Action): ToolOverlay | null {
  const project = env.project();
  const network = env.derived().network;
  switch (action.kind) {
    case 'join': {
      const n = project.nodes[action.nodeId];
      const walls = wallsAtNode(project, action.nodeId);
      const others = walls.map((w) => project.nodes[w.a === action.nodeId ? w.b : w.a]);
      const thickness = Math.max(...walls.map((w) => w.thickness));
      return {
        wallPreviews: [wallPreviewPolygon(others[0], others[1], thickness)],
        snap: { p: { x: n.x, y: n.y }, kind: 'node', label: 'Join' },
        labels: [{ p: n, text: 'Join walls' }],
      };
    }
    case 'extend': {
      const { from, to, distance } = action.target;
      return {
        wallPreviews: [wallPreviewPolygon(from, to, action.thickness)],
        lines: [{ a: from, b: to, kind: 'preview' }],
        snap: { p: to, kind: action.target.targetNodeId ? 'node' : 'wall', label: 'Extend to' },
        labels: [{ p: to, text: `Extend ${fmt(env, distance)}` }],
      };
    }
    case 'trim': {
      const g = network.walls.get(action.wallId);
      if (!g) return null;
      const w = g.wall;
      // Mark the cut at the connected end.
      const connectedEnd = freeEnds(project, w.id)[0] === 'a' ? 'b' : 'a';
      const s = connectedEnd === 'a' ? 0 : g.path.length;
      const { p, tangent } = pointAt(g.path, s);
      const nrm = scale(leftNormal(tangent), g.h + 6 * env.px());
      const mid = pointAt(g.path, g.path.length / 2).p;
      return {
        ghostOpening: { pts: g.footprint, valid: false },
        splitMarker: { a: add(p, nrm), b: sub(p, nrm) },
        labels: [{ p: mid, text: `Trim ${fmt(env, g.path.length)}` }],
      };
    }
    default:
      return null;
  }
}

function describe(env: ToolEnv, action: Action): string {
  switch (action.kind) {
    case 'join':
      return 'Click to join these two walls into one (openings stay where they are).';
    case 'extend':
      return `Click to extend this wall by ${fmt(env, action.target.distance)} to meet the ${action.target.targetNodeId ? 'wall end' : 'wall'} ahead.`;
    case 'trim':
      return 'Click to trim this dangling piece back to the junction.';
    default:
      return action.hint;
  }
}

export function createExtendTool(): Tool {
  let action: Action | null = null;
  const update = (env: ToolEnv, p: Vec2) => {
    action = analyse(env, p);
    env.setOverlay(overlayFor(env, action));
    env.setHint(describe(env, action));
    env.setCursor(action.kind === 'none' ? 'crosshair' : 'pointer');
  };
  return {
    id: 'extend',
    cursor: 'crosshair',
    hint: IDLE_HINT,
    onPointerMove(e, env) {
      update(env, e.world);
    },
    onPointerDown(e, env) {
      if (e.button !== 0) return;
      const a = analyse(env, e.world);
      const exec = useProjectStore.getState().execute;
      if (a.kind === 'extend') {
        const ok = exec('Extend wall', (d) => extendWall(d, a.wallId, a.end));
        env.setHint(ok ? 'Wall extended.' : 'Nothing to extend to.');
      } else if (a.kind === 'trim') {
        const ok = exec('Trim wall', (d) => trimWall(d, a.wallId));
        env.setHint(ok ? 'Wall trimmed.' : 'Nothing to trim.');
      } else if (a.kind === 'join') {
        const id = exec('Join walls', (d) => joinWallsAtNode(d, a.nodeId));
        env.setHint(id ? 'Walls joined.' : 'These walls can’t be joined.');
      } else {
        env.setHint(a.hint);
        return;
      }
      action = null;
      env.setOverlay(null);
    },
    cancel(env) {
      // Nothing multi-step to abort: clear the hover preview and let Esc leave the tool.
      action = null;
      env.setOverlay(null);
      return false;
    },
  };
}

import type { Project, Vec2, WallSegment } from '../model/schema';
import { buildWallPath } from '../geometry/wallPath';
import { add, angleDelta, angleOf, closestPointOnSegment, dist, normalize, scale, segmentIntersection, sub } from '../geometry/vec';
import { clampOpenings, deleteWalls, flipWall, healNode, NODE_MERGE_TOL, setNodePositions, settleNode, type D } from './walls';

/** Longest extension the extend tool looks for (metres). */
export const EXTEND_MAX = 30;

/** Angle tolerance (radians) for treating two walls as collinear when joining. */
const JOIN_ANGLE_TOL = 0.01;

type ProjectLike = D | Project;

export function wallsAtNode(p: ProjectLike, nodeId: string) {
  return Object.values(p.walls).filter((w) => w.a === nodeId || w.b === nodeId);
}

export function nodeDegreeOf(p: ProjectLike, nodeId: string): number {
  let n = 0;
  for (const w of Object.values(p.walls)) {
    if (w.a === nodeId) n++;
    if (w.b === nodeId) n++;
  }
  return n;
}

/** Ends of a wall that no other wall touches. */
export function freeEnds(p: ProjectLike, wallId: string): ('a' | 'b')[] {
  const w = p.walls[wallId];
  if (!w) return [];
  const out: ('a' | 'b')[] = [];
  if (nodeDegreeOf(p, w.a) === 1) out.push('a');
  if (nodeDegreeOf(p, w.b) === 1) out.push('b');
  return out;
}

export interface ExtensionTarget {
  /** The moving (free) end node. */
  nodeId: string;
  from: Vec2;
  to: Vec2;
  distance: number;
  /** The wall the extension lands on, or the node it reaches. */
  targetWallId: string | null;
  targetNodeId: string | null;
}

/**
 * Where a straight wall's free end would land if extended along the wall's
 * direction: the nearest wall centreline (or node) the ray meets within
 * `maxDistance`. Returns null for curved walls, non-free ends or no hit.
 */
export function findExtension(p: ProjectLike, wallId: string, end: 'a' | 'b', maxDistance = EXTEND_MAX): ExtensionTarget | null {
  const w = p.walls[wallId];
  if (!w || w.curve) return null;
  const nodeId = end === 'a' ? w.a : w.b;
  const otherId = end === 'a' ? w.b : w.a;
  if (nodeDegreeOf(p, nodeId) !== 1) return null;
  const from = p.nodes[nodeId];
  const other = p.nodes[otherId];
  if (!from || !other || dist(from, other) < NODE_MERGE_TOL) return null;
  const dir = normalize(sub(from, other));
  const far = add(from, scale(dir, maxDistance));
  const minT = (NODE_MERGE_TOL * 5) / maxDistance;
  let best: { t: number; point: Vec2; wallId: string | null; nodeId: string | null } | null = null;

  // Nodes lying on the ray (catches collinear walls ahead, which never "cross" it).
  for (const n of Object.values(p.nodes)) {
    if (n.id === nodeId || n.id === otherId) continue;
    const cp = closestPointOnSegment(n, from, far);
    if (cp.dist <= NODE_MERGE_TOL * 5 && cp.t > minT && (!best || cp.t < best.t)) best = { t: cp.t, point: { x: n.x, y: n.y }, wallId: null, nodeId: n.id };
  }
  for (const o of Object.values(p.walls)) {
    if (o.id === wallId) continue;
    const a = p.nodes[o.a];
    const b = p.nodes[o.b];
    if (!a || !b) continue;
    const pts = buildWallPath(a, b, o.curve).samples.map((s) => s.p);
    for (let i = 0; i < pts.length - 1; i++) {
      const hit = segmentIntersection(from, far, pts[i], pts[i + 1]);
      if (!hit || hit.t <= minT) continue;
      if (!best || hit.t < best.t - 1e-9) best = { t: hit.t, point: hit.point, wallId: o.id, nodeId: null };
    }
  }
  if (!best) return null;
  return {
    nodeId,
    from: { x: from.x, y: from.y },
    to: best.point,
    distance: best.t * maxDistance,
    targetWallId: best.wallId,
    targetNodeId: best.nodeId,
  };
}

/**
 * Extends a straight wall's free end to the nearest wall it would hit,
 * forming a T-junction (or meeting the node it reaches). Openings keep their
 * position on the wall. Returns false when there is nothing to extend to.
 */
export function extendWall(d: D, wallId: string, end: 'a' | 'b', maxDistance = EXTEND_MAX): boolean {
  const target = findExtension(d, wallId, end, maxDistance);
  if (!target) return false;
  const w = d.walls[wallId];
  if (end === 'a') {
    // Offsets are measured from node a, which is the end that moves.
    for (const o of Object.values(d.openings)) if (o.wallId === wallId) o.offset += target.distance;
  }
  setNodePositions(d, { [target.nodeId]: target.to });
  settleNode(d, target.nodeId);
  if (d.walls[w.id]) clampOpenings(d, [w.id]);
  return true;
}

/** Deletes a wall piece that has a free end (a dangling overhang). Returns false if it has none. */
export function trimWall(d: D, wallId: string): boolean {
  const w = d.walls[wallId];
  if (!w || w.locked) return false;
  if (freeEnds(d, wallId).length === 0) return false;
  deleteWalls(d, [wallId]);
  return true;
}

/** True when exactly two straight walls meet at the node and continue in a straight line. */
export function canJoinAtNode(p: ProjectLike, nodeId: string): boolean {
  const walls = wallsAtNode(p, nodeId);
  if (walls.length !== 2) return false;
  const [w1, w2] = walls;
  if (w1.curve || w2.curve || w1.locked || w2.locked) return false;
  const n = p.nodes[nodeId];
  const o1 = w1.a === nodeId ? w1.b : w1.a;
  const o2 = w2.a === nodeId ? w2.b : w2.a;
  if (!n || o1 === o2 || !p.nodes[o1] || !p.nodes[o2]) return false;
  const gap = angleDelta(angleOf(sub(p.nodes[o1], n)), angleOf(sub(p.nodes[o2], n)));
  return Math.abs(gap - Math.PI) <= JOIN_ANGLE_TOL;
}

/**
 * Joins the two collinear straight walls meeting at `nodeId` into one wall.
 * Matching walls are merged by the regular heal logic; otherwise the longer
 * wall's properties (thickness, finishes, …) win. Openings on both walls stay
 * where they are. Returns the surviving wall id, or null when the walls can't
 * be joined.
 */
export function joinWallsAtNode(d: D, nodeId: string): string | null {
  if (!canJoinAtNode(d, nodeId)) return null;
  const [w1, w2] = wallsAtNode(d, nodeId);
  const ids = [w1.id, w2.id];
  healNode(d, nodeId);
  if (!d.nodes[nodeId]) {
    const survivor = ids.find((id) => d.walls[id]) ?? null;
    if (survivor) clampOpenings(d, [survivor]);
    return survivor;
  }
  const len = (id: string) => dist(d.nodes[d.walls[id].a], d.nodes[d.walls[id].b]);
  const [baseId, otherId] = len(w1.id) >= len(w2.id) ? [w1.id, w2.id] : [w2.id, w1.id];
  const base = d.walls[baseId];
  // Orient the other wall so it continues the base wall's direction through the node.
  const other = d.walls[otherId];
  if ((base.b === nodeId && other.a !== nodeId) || (base.a === nodeId && other.b !== nodeId)) flipWall(d, otherId);
  const Lbase = len(baseId);
  const Lother = len(otherId);
  for (const o of Object.values(d.openings)) {
    if (base.b === nodeId) {
      // base: A → node, other: node → B. Other's openings shift by the base length.
      if (o.wallId === otherId) {
        o.wallId = baseId;
        o.offset += Lbase;
      }
    } else {
      // other: A → node, base: node → B. Base's openings shift by the other's length.
      if (o.wallId === baseId) o.offset += Lother;
      else if (o.wallId === otherId) o.wallId = baseId;
    }
  }
  if (base.b === nodeId) base.b = other.b;
  else base.a = other.a;
  delete d.walls[otherId];
  delete d.nodes[nodeId];
  clampOpenings(d, [baseId]);
  return baseId;
}

/** Copies finishes (surface materials and mouldings) from one wall onto others. */
export function matchWallFinishes(d: D, sourceId: string, targetIds: string[]): void {
  const src = d.walls[sourceId];
  if (!src) return;
  const materials = { ...src.materials };
  // JSON round trip: plain data, safe to copy out of an immer draft.
  const finishes = src.finishes ? JSON.stringify(src.finishes) : null;
  for (const id of targetIds) {
    if (id === sourceId) continue;
    const w = d.walls[id];
    if (!w) continue;
    w.materials = { ...materials };
    if (finishes) w.finishes = JSON.parse(finishes) as NonNullable<WallSegment['finishes']>;
    else delete w.finishes;
  }
}

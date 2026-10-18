import { current, isDraft, type Draft } from 'immer';
import { DEFAULT_MATERIALS } from '@/data/materials/catalog';
import { newId } from '../model/ids';
import type { Project, Vec2, WallRole, WallSegment, WallStyle } from '../model/schema';
import { buildWallPath, paramAt, pointAt, projectOnPath, splitBezier, splitCubic } from '../geometry/wallPath';
import { computeWallNetwork } from '../geometry/walls';
import { add, angleDelta, angleOf, closestPointOnSegment, dist, normalize, scale, segmentIntersection, sub } from '../geometry/vec';

export type D = Draft<Project>;

/** Distance under which points are considered the same node (metres). */
export const NODE_MERGE_TOL = 0.002;

const plain = <T extends object>(d: T): T => (isDraft(d) ? (current(d) as T) : d);

export interface WallOptions {
  thickness: number;
  height: number;
  role: WallRole;
  baseElevation?: number;
  materials?: WallSegment['materials'];
  /** From a wall preset: construction style, infill material and trims. */
  style?: WallSegment['style'];
  styleMaterialId?: string;
  finishes?: WallSegment['finishes'];
}

export function defaultWallMaterials(role: WallRole): WallSegment['materials'] {
  return {
    left: DEFAULT_MATERIALS.wallInterior,
    right: role === 'exterior' ? DEFAULT_MATERIALS.wallExterior : DEFAULT_MATERIALS.wallInterior,
    top: DEFAULT_MATERIALS.wallTop,
  };
}

export function addNode(d: D, p: Vec2): string {
  const id = newId('n');
  d.nodes[id] = { id, x: p.x, y: p.y };
  return id;
}

export function findNodeNear(d: D | Project, p: Vec2, tol = NODE_MERGE_TOL): string | null {
  let best: string | null = null;
  let bestD = tol;
  for (const n of Object.values(d.nodes)) {
    const dd = dist(n, p);
    if (dd <= bestD) {
      bestD = dd;
      best = n.id;
    }
  }
  return best;
}

function wallBetween(d: D | Project, u: string, v: string): string | null {
  for (const w of Object.values(d.walls)) {
    if ((w.a === u && w.b === v) || (w.a === v && w.b === u)) return w.id;
  }
  return null;
}

function nodeDegree(d: D | Project, nodeId: string): number {
  let n = 0;
  for (const w of Object.values(d.walls)) {
    if (w.a === nodeId) n++;
    if (w.b === nodeId) n++;
  }
  return n;
}

/** Finds a straight-or-curved wall whose centreline passes within tol of p (excluding its end nodes). */
export function findWallAt(d: D | Project, p: Vec2, tol = NODE_MERGE_TOL, exclude: string[] = []) {
  let best: { wallId: string; s: number; dist: number } | null = null;
  for (const w of Object.values(d.walls)) {
    if (exclude.includes(w.id)) continue;
    const a = d.nodes[w.a];
    const b = d.nodes[w.b];
    if (!a || !b) continue;
    const path = buildWallPath(a, b, w.curve, w.curveEnd);
    const proj = projectOnPath(path, p);
    if (proj.dist <= tol && proj.s > NODE_MERGE_TOL && proj.s < path.length - NODE_MERGE_TOL) {
      if (!best || proj.dist < best.dist) best = { wallId: w.id, s: proj.s, dist: proj.dist };
    }
  }
  return best;
}

/**
 * Splits a wall at arc length s. The original wall keeps its id for the first
 * part (a → new node); a new wall is created for the remainder. Openings are
 * reassigned by their centre offset. A split requested inside an opening is
 * moved to the nearest edge of that opening so no opening is ever cut.
 * Returns the id of the node at the split (an existing end node if the split
 * falls on an end).
 */
export function splitWallAt(d: D, wallId: string, sRequested: number): string {
  const w = d.walls[wallId];
  const a = d.nodes[w.a];
  const b = d.nodes[w.b];
  const path = buildWallPath(a, b, w.curve, w.curveEnd);
  let s = Math.max(0, Math.min(path.length, sRequested));
  const openings = Object.values(d.openings).filter((o) => o.wallId === wallId);
  for (const o of openings) {
    const s0 = o.offset - o.width / 2;
    const s1 = o.offset + o.width / 2;
    if (s > s0 && s < s1) s = s - s0 < s1 - s ? s0 : s1;
  }
  if (s <= NODE_MERGE_TOL) return w.a;
  if (s >= path.length - NODE_MERGE_TOL) return w.b;
  const { p } = pointAt(path, s);
  const mid = addNode(d, p);
  const newWallId = newId('w');
  let firstCurve: Vec2 | null = null;
  let secondCurve: Vec2 | null = null;
  let firstEnd: Vec2 | null = null;
  let secondEnd: Vec2 | null = null;
  if (path.control && path.control2) {
    const parts = splitCubic(a, path.control, path.control2, b, paramAt(path, s));
    firstCurve = parts.first.c1;
    firstEnd = parts.first.c2;
    secondCurve = parts.second.c1;
    secondEnd = parts.second.c2;
    d.nodes[mid].x = parts.first.b.x;
    d.nodes[mid].y = parts.first.b.y;
  } else if (path.control) {
    const t = paramAt(path, s);
    const parts = splitBezier(a, path.control, b, t);
    firstCurve = parts.first.c;
    secondCurve = parts.second.c;
    // Keep the split node exactly on the curve.
    d.nodes[mid].x = parts.first.b.x;
    d.nodes[mid].y = parts.first.b.y;
  }
  const oldB = w.b;
  d.walls[newWallId] = {
    ...structuredClone(plain(w)),
    id: newWallId,
    a: mid,
    b: oldB,
    curve: secondCurve,
    curveEnd: secondEnd,
  };
  w.b = mid;
  w.curve = firstCurve;
  w.curveEnd = firstEnd;
  if (w.heightEnd != null) {
    // Sloped top: both parts keep the same slope line.
    const hMid = w.height + ((w.heightEnd - w.height) * s) / path.length;
    d.walls[newWallId].height = hMid;
    w.heightEnd = hMid;
  }
  for (const o of openings) {
    if (o.offset >= s) {
      o.wallId = newWallId;
      o.offset = o.offset - s;
    }
  }
  return mid;
}

/** Repoints all walls from `fromId` to `intoId`, removing collapsed and duplicate walls. */
export function mergeNodes(d: D, fromId: string, intoId: string): void {
  if (fromId === intoId || !d.nodes[fromId] || !d.nodes[intoId]) return;
  for (const w of Object.values(d.walls)) {
    if (w.a === fromId) w.a = intoId;
    if (w.b === fromId) w.b = intoId;
  }
  delete d.nodes[fromId];
  removeDegenerateWalls(d);
}

/** Deletes zero-length walls and duplicate walls between the same nodes (openings move to the survivor). */
export function removeDegenerateWalls(d: D): void {
  const seen = new Map<string, string>();
  for (const w of Object.values(d.walls)) {
    if (w.a === w.b) {
      deleteWallsRaw(d, [w.id]);
      continue;
    }
    if (w.curve) continue;
    const key = [w.a, w.b].sort().join('|');
    const keep = seen.get(key);
    if (keep) {
      const kw = d.walls[keep];
      const reversed = kw.a !== w.a;
      const L = dist(d.nodes[kw.a], d.nodes[kw.b]);
      for (const o of Object.values(d.openings)) {
        if (o.wallId === w.id) {
          o.wallId = keep;
          if (reversed) {
            o.offset = L - o.offset;
            o.swingSide = o.swingSide === 'left' ? 'right' : 'left';
            o.hinge = o.hinge === 'start' ? 'end' : 'start';
          }
        }
      }
      kw.thickness = Math.max(kw.thickness, w.thickness);
      delete d.walls[w.id];
    } else seen.set(key, w.id);
  }
}

function deleteWallsRaw(d: D, ids: string[]) {
  const set = new Set(ids);
  for (const o of Object.values(d.openings)) if (set.has(o.wallId)) delete d.openings[o.id];
  for (const id of ids) delete d.walls[id];
}

/** Removes nodes not referenced by any wall. */
export function removeOrphanNodes(d: D): void {
  const used = new Set<string>();
  for (const w of Object.values(d.walls)) {
    used.add(w.a);
    used.add(w.b);
  }
  for (const id of Object.keys(d.nodes)) if (!used.has(id)) delete d.nodes[id];
}

/**
 * Merges two straight, collinear walls meeting at a degree-2 node when their
 * properties match, undoing an earlier split once it is no longer needed.
 */
export function healNode(d: D, nodeId: string): void {
  const walls = Object.values(d.walls).filter((w) => w.a === nodeId || w.b === nodeId);
  if (walls.length !== 2) return;
  const [w1, w2] = walls;
  if (w1.curve || w2.curve) return;
  const same =
    Math.abs(w1.thickness - w2.thickness) < 1e-6 &&
    Math.abs(w1.height - w2.height) < 1e-6 &&
    Math.abs(w1.baseElevation - w2.baseElevation) < 1e-6 &&
    w1.role === w2.role &&
    w1.locked === w2.locked;
  if (!same) return;
  const n = d.nodes[nodeId];
  const o1 = w1.a === nodeId ? w1.b : w1.a;
  const o2 = w2.a === nodeId ? w2.b : w2.a;
  if (o1 === o2) return;
  const p1 = d.nodes[o1];
  const p2 = d.nodes[o2];
  const gap = angleDelta(angleOf(sub(p1, n)), angleOf(sub(p2, n)));
  if (Math.abs(gap - Math.PI) > 1e-3) return;
  // Orient w1 so it runs o1 → node, and make sure its materials sides are consistent.
  const w1Forward = w1.b === nodeId;
  const w2Forward = w2.a === nodeId;
  const sameSides = w1Forward === w2Forward;
  if (!sameSides) {
    if (w1.materials.left !== w2.materials.right || w1.materials.right !== w2.materials.left) return;
  } else if (w1.materials.left !== w2.materials.left || w1.materials.right !== w2.materials.right) return;
  const L1 = dist(p1, n);
  const L2 = dist(n, p2);
  // Openings on w1 measured from o1.
  for (const o of Object.values(d.openings)) {
    if (o.wallId === w1.id && !w1Forward) {
      o.offset = L1 - o.offset;
      o.swingSide = o.swingSide === 'left' ? 'right' : 'left';
      o.hinge = o.hinge === 'start' ? 'end' : 'start';
    }
    if (o.wallId === w2.id) {
      o.wallId = w1.id;
      if (w2Forward) o.offset = L1 + o.offset;
      else {
        o.offset = L1 + (L2 - o.offset);
        o.swingSide = o.swingSide === 'left' ? 'right' : 'left';
        o.hinge = o.hinge === 'start' ? 'end' : 'start';
      }
    }
  }
  if (!w1Forward) {
    const { left, right } = w1.materials;
    w1.materials.left = right;
    w1.materials.right = left;
  }
  w1.a = o1;
  w1.b = o2;
  delete d.walls[w2.id];
  delete d.nodes[nodeId];
}

/**
 * Inserts junction nodes where the given straight walls cross or touch other
 * walls, and where existing nodes lie on them, keeping the wall graph planar.
 * Collinear overlaps are split at shared points and then de-duplicated.
 */
export function insertJunctions(d: D, wallIds: string[]): void {
  const queue = [...wallIds];
  let guard = 0;
  while (queue.length && guard++ < 2000) {
    const wid = queue.shift()!;
    const w = d.walls[wid];
    if (!w || w.curve) continue;
    const a = d.nodes[w.a];
    const b = d.nodes[w.b];
    if (!a || !b) continue;
    const L = dist(a, b);
    if (L < NODE_MERGE_TOL) continue;
    let action: (() => void) | null = null;

    // 1. An existing node lies on this wall's interior.
    for (const n of Object.values(d.nodes)) {
      if (n.id === w.a || n.id === w.b) continue;
      const cp = closestPointOnSegment(n, a, b);
      const s = cp.t * L;
      if (cp.dist <= NODE_MERGE_TOL && s > NODE_MERGE_TOL && s < L - NODE_MERGE_TOL) {
        const nodeId = n.id;
        action = () => {
          const mid = splitWallAt(d, wid, s);
          if (mid !== nodeId) mergeNodes(d, mid, nodeId);
        };
        break;
      }
    }

    if (!action) {
      for (const o of Object.values(d.walls)) {
        if (o.id === wid || o.curve) continue;
        const oa = d.nodes[o.a];
        const ob = d.nodes[o.b];
        if (!oa || !ob) continue;
        const LO = dist(oa, ob);
        const oid = o.id;
        // 2. One of this wall's endpoints lies on the other wall's interior (T-junction or collinear overlap).
        for (const endId of [w.a, w.b]) {
          if (endId === o.a || endId === o.b) continue;
          const cp = closestPointOnSegment(d.nodes[endId], oa, ob);
          const sO = cp.t * LO;
          if (cp.dist <= NODE_MERGE_TOL && sO > NODE_MERGE_TOL && sO < LO - NODE_MERGE_TOL) {
            action = () => {
              const m = splitWallAt(d, oid, sO);
              if (m !== endId) mergeNodes(d, m, endId);
            };
            break;
          }
        }
        if (action) break;
        if (o.a === w.a || o.a === w.b || o.b === w.a || o.b === w.b) continue;
        // 3. Proper crossing of both interiors.
        const hit = segmentIntersection(a, b, oa, ob);
        if (!hit) continue;
        const sW = hit.t * L;
        const sO = hit.u * LO;
        if (sW > NODE_MERGE_TOL && sW < L - NODE_MERGE_TOL && sO > NODE_MERGE_TOL && sO < LO - NODE_MERGE_TOL) {
          action = () => {
            const m = splitWallAt(d, oid, sO);
            const mid = splitWallAt(d, wid, sW);
            if (mid !== m) mergeNodes(d, mid, m);
          };
          break;
        }
      }
    }

    if (action) {
      const before = new Set(Object.keys(d.walls));
      action();
      queue.unshift(wid);
      for (const k of Object.keys(d.walls)) if (!before.has(k)) queue.push(k);
    }
  }
  removeDegenerateWalls(d);
}

/** Resolves a node at p: an existing node, a split of a wall passing through p, or a new node. */
export function resolveNodeAt(d: D, p: Vec2): string {
  const existing = findNodeNear(d, p);
  if (existing) return existing;
  const onWall = findWallAt(d, p);
  if (onWall) return splitWallAt(d, onWall.wallId, onWall.s);
  return addNode(d, p);
}

/**
 * Adds a chain of walls through `points`. Endpoints snap to existing nodes or
 * split walls they land on; crossings create junctions; segments duplicating
 * existing walls are skipped. Returns the ids of walls created.
 */
export function addWallChain(
  d: D,
  points: Vec2[],
  opts: WallOptions & { closed?: boolean; curves?: (Vec2 | null)[] },
): string[] {
  const pts = [...points];
  if (opts.closed && pts.length > 2 && dist(pts[0], pts[pts.length - 1]) > NODE_MERGE_TOL) pts.push(pts[0]);
  const created: string[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p = pts[i];
    const q = pts[i + 1];
    if (dist(p, q) < 0.01) continue;
    const u = resolveNodeAt(d, p);
    const v = resolveNodeAt(d, q);
    if (u === v) continue;
    if (wallBetween(d, u, v) && !opts.curves?.[i]) continue;
    const id = newId('w');
    d.walls[id] = {
      id,
      a: u,
      b: v,
      thickness: opts.thickness,
      height: opts.height,
      baseElevation: opts.baseElevation ?? 0,
      role: opts.role,
      curve: opts.curves?.[i] ?? null,
      materials: opts.materials ? { ...opts.materials } : defaultWallMaterials(opts.role),
      locked: false,
      hidden: false,
      ...(opts.style && opts.style !== 'solid' ? { style: opts.style } : {}),
      ...(opts.styleMaterialId ? { styleMaterialId: opts.styleMaterialId } : {}),
      ...(opts.finishes ? { finishes: structuredClone(opts.finishes) } : {}),
    };
    created.push(id);
    if (!d.walls[id].curve) insertJunctions(d, [id]);
  }
  // Report the walls that still exist (some may have been split into more pieces).
  const all = new Set(Object.keys(d.walls));
  return created.filter((id) => all.has(id));
}

/** Creates a closed rectangle of walls between two opposite corners. */
export function addRectangleWalls(d: D, p0: Vec2, p1: Vec2, opts: WallOptions): string[] {
  const x0 = Math.min(p0.x, p1.x);
  const x1 = Math.max(p0.x, p1.x);
  const y0 = Math.min(p0.y, p1.y);
  const y1 = Math.max(p0.y, p1.y);
  if (x1 - x0 < 0.05 || y1 - y0 < 0.05) return [];
  return addWallChain(
    d,
    [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x0, y: y1 },
    ],
    { ...opts, closed: true },
  );
}

/** Similarity transform that maps chord (a0,b0) to (a1,b1); used to keep curve shape when endpoints move. */
function transformControl(c: Vec2, a0: Vec2, b0: Vec2, a1: Vec2, b1: Vec2): Vec2 {
  const d0 = sub(b0, a0);
  const d1 = sub(b1, a1);
  const l0 = Math.hypot(d0.x, d0.y);
  if (l0 < 1e-9) return add(c, sub(a1, a0));
  const k = Math.hypot(d1.x, d1.y) / l0;
  const rot = Math.atan2(d1.y, d1.x) - Math.atan2(d0.y, d0.x);
  const rel = sub(c, a0);
  const cs = Math.cos(rot);
  const sn = Math.sin(rot);
  return add(a1, scale({ x: rel.x * cs - rel.y * sn, y: rel.x * sn + rel.y * cs }, k));
}

/**
 * Moves nodes to new positions. Every wall attached to a moved node keeps its
 * connection (its endpoint moves with the node); curved walls keep their shape
 * relative to their chord.
 */
export function setNodePositions(d: D, positions: Record<string, Vec2>): void {
  const before: Record<string, Vec2> = {};
  for (const id of Object.keys(positions)) {
    const n = d.nodes[id];
    if (n) before[id] = { x: n.x, y: n.y };
  }
  for (const w of Object.values(d.walls)) {
    if (!w.curve) continue;
    if (!(w.a in positions) && !(w.b in positions)) continue;
    const a0 = before[w.a] ?? d.nodes[w.a];
    const b0 = before[w.b] ?? d.nodes[w.b];
    const a1 = positions[w.a] ?? d.nodes[w.a];
    const b1 = positions[w.b] ?? d.nodes[w.b];
    w.curve = transformControl(w.curve, a0, b0, a1, b1);
    if (w.curveEnd) w.curveEnd = transformControl(w.curveEnd, a0, b0, a1, b1);
  }
  for (const [id, p] of Object.entries(positions)) {
    const n = d.nodes[id];
    if (n) {
      n.x = p.x;
      n.y = p.y;
    }
  }
}

export function translateNodes(d: D, nodeIds: string[], delta: Vec2): void {
  const positions: Record<string, Vec2> = {};
  for (const id of nodeIds) {
    const n = d.nodes[id];
    if (n) positions[id] = { x: n.x + delta.x, y: n.y + delta.y };
  }
  setNodePositions(d, positions);
}

/**
 * Sets a wall's length by moving one end along the wall's direction (the
 * anchored end stays fixed). Walls attached to the moved end follow it.
 */
export function setWallLength(d: D, wallId: string, length: number, anchor: 'start' | 'end' = 'start'): void {
  const w = d.walls[wallId];
  if (!w || length < 0.02) return;
  const a = d.nodes[w.a];
  const b = d.nodes[w.b];
  const path = buildWallPath(a, b, w.curve, w.curveEnd);
  if (path.length < 1e-9) return;
  const k = length / path.length;
  const fixed = anchor === 'start' ? a : b;
  const moving = anchor === 'start' ? b : a;
  const np = add(fixed, scale(sub(moving, fixed), k));
  const newCurve = w.curve ? add(fixed, scale(sub(w.curve, fixed), k)) : null;
  const newEnd = w.curveEnd ? add(fixed, scale(sub(w.curveEnd, fixed), k)) : null;
  setNodePositions(d, { [moving.id]: np });
  if (newCurve) d.walls[wallId].curve = newCurve;
  if (newEnd) d.walls[wallId].curveEnd = newEnd;
  // Openings measured from node a keep their distance from the anchored end.
  if (anchor === 'end') {
    const delta = length - path.length;
    for (const o of Object.values(d.openings)) if (o.wallId === wallId) o.offset = Math.max(0, o.offset + delta);
  }
}

/** Sets the angle of a straight wall by rotating its far end about the start node. */
export function setWallAngle(d: D, wallId: string, angle: number): void {
  const w = d.walls[wallId];
  if (!w || w.curve) return;
  const a = d.nodes[w.a];
  const b = d.nodes[w.b];
  const L = dist(a, b);
  setNodePositions(d, { [w.b]: { x: a.x + Math.cos(angle) * L, y: a.y + Math.sin(angle) * L } });
}

export function deleteWalls(d: D, ids: string[]): void {
  const touched = new Set<string>();
  for (const id of ids) {
    const w = d.walls[id];
    if (!w) continue;
    touched.add(w.a);
    touched.add(w.b);
  }
  deleteWallsRaw(d, ids);
  removeOrphanNodes(d);
  for (const n of touched) if (d.nodes[n] && nodeDegree(d, n) === 2) healNode(d, n);
}

/** Joins a node onto the middle of a wall (T-junction) by splitting the wall at the node's projection. */
export function joinNodeToWall(d: D, nodeId: string, wallId: string): void {
  const w = d.walls[wallId];
  const n = d.nodes[nodeId];
  if (!w || !n || w.a === nodeId || w.b === nodeId) return;
  const path = buildWallPath(d.nodes[w.a], d.nodes[w.b], w.curve, w.curveEnd);
  const proj = projectOnPath(path, n);
  const mid = splitWallAt(d, wallId, proj.s);
  if (mid !== nodeId) {
    const target = d.nodes[mid];
    setNodePositions(d, { [nodeId]: { x: target.x, y: target.y } });
    mergeNodes(d, nodeId, mid);
  }
}

/**
 * After a node drag: merges the node into a coincident node or wall and adds
 * junctions where its walls now cross others.
 */
export function settleNode(d: D, nodeId: string): void {
  const n = d.nodes[nodeId];
  if (!n) return;
  const other = Object.values(d.nodes).find((m) => m.id !== nodeId && dist(m, n) <= NODE_MERGE_TOL * 5);
  if (other) {
    mergeNodes(d, nodeId, other.id);
    return;
  }
  const attached = Object.values(d.walls)
    .filter((w) => w.a === nodeId || w.b === nodeId)
    .map((w) => w.id);
  const onWall = findWallAt(d, n, NODE_MERGE_TOL * 5, attached);
  if (onWall) {
    joinNodeToWall(d, nodeId, onWall.wallId);
    return;
  }
  insertJunctions(d, attached);
}

export function updateWalls(d: D, ids: string[], patch: Partial<Omit<WallSegment, 'id' | 'a' | 'b'>>): void {
  for (const id of ids) {
    const w = d.walls[id];
    if (!w) continue;
    if (patch.materials) w.materials = { ...w.materials, ...patch.materials };
    const { materials: _m, ...rest } = patch;
    Object.assign(w, rest);
    // A straight wall has no handles at all.
    if (patch.curve === null) w.curveEnd = null;
  }
}

/** Styles built lower than a room-height wall: railings and half walls. */
const isLowStyle = (s: WallStyle | undefined): boolean => s === 'half' || s === 'railing-glass' || s === 'railing-bars';

/**
 * Changes walls' construction style. Switching to a railing or half wall lowers a room-height wall
 * to 1.05 m and remembers its height (`fullHeight`); switching back to a solid or glass wall
 * restores it (or the project's default wall height when none was remembered).
 */
export function setWallStyle(d: D, ids: string[], style: WallStyle, lowHeight = 1.05): void {
  for (const id of ids) {
    const w = d.walls[id];
    if (!w) continue;
    const wasLow = isLowStyle(w.style);
    if (style === 'solid') delete w.style;
    else w.style = style;
    if (isLowStyle(style)) {
      const limit = style === 'half' ? 1.6 : 1.3;
      if (w.height > limit) {
        w.fullHeight = w.height;
        w.height = lowHeight;
      }
    } else if (wasLow) {
      w.height = w.fullHeight ?? d.settings.defaultWall.height;
      delete w.fullHeight;
    }
  }
}

// ───────────── Curve handles ─────────────

/**
 * Direction a curved wall should have at one end to flow smoothly into the walls joined there
 * (the joined wall's own direction through the shared node), or null when nothing is joined.
 * With several joined walls (a T-junction) the one pointing most along the curve's chord wins.
 */
export function joinTangent(d: D | Project, wallId: string, end: 'a' | 'b'): Vec2 | null {
  const w = d.walls[wallId];
  if (!w) return null;
  const node = end === 'a' ? w.a : w.b;
  const chord = normalize(sub(d.nodes[w.b], d.nodes[w.a]));
  let best: { t: Vec2; score: number } | null = null;
  for (const o of Object.values(d.walls)) {
    if (o.id === wallId || (o.a !== node && o.b !== node)) continue;
    const path = buildWallPath(d.nodes[o.a], d.nodes[o.b], o.curve, o.curveEnd);
    const n = path.samples.length - 1;
    // Unit vector pointing from the node into the joined wall.
    const away = o.a === node ? path.samples[0].tangent : scale(path.samples[n].tangent, -1);
    // At the start the curve continues the joined wall (leaves opposite to it); at the end it runs into it.
    const t = end === 'a' ? scale(away, -1) : away;
    const score = t.x * chord.x + t.y * chord.y;
    if (!best || score > best.score) best = { t, score };
  }
  return best && best.score > -0.999 ? best.t : null;
}

/** Intersection of the rays p + s·u and q - r·v (s, r ≥ 0), or null when parallel or behind. */
function tangentCorner(p: Vec2, u: Vec2, q: Vec2, v: Vec2): { x: Vec2; s: number; r: number } | null {
  const den = u.x * v.y - u.y * v.x;
  if (Math.abs(den) < 1e-6) return null;
  const w = sub(q, p);
  const sP = (w.x * v.y - w.y * v.x) / den;
  const rQ = (u.x * w.y - u.y * w.x) / den;
  if (sP <= 1e-4 || rQ <= 1e-4) return null;
  return { x: add(p, scale(u, sP)), s: sP, r: rQ };
}

/**
 * Bends a curved wall so it leaves and enters the walls joined at its ends smoothly (tangent).
 * Two handles: each handle lies along its end's tangent, sized for a near-circular arc (a quarter
 * circle between two perpendicular walls). One handle: the control point moves to where the two
 * tangent lines meet. A free end keeps pointing at the other end. Returns false if nothing changed.
 */
export function fitCurveToJoins(d: D, wallId: string): boolean {
  const w = d.walls[wallId];
  if (!w) return false;
  const a = d.nodes[w.a];
  const b = d.nodes[w.b];
  const chord = sub(b, a);
  const L = Math.hypot(chord.x, chord.y);
  if (L < 1e-6) return false;
  const ta = joinTangent(d, wallId, 'a');
  const tb = joinTangent(d, wallId, 'b');
  if (!ta && !tb) return false;
  const c = normalize(chord);
  const corner = ta && tb ? tangentCorner(a, ta, b, tb) : null;
  if (!w.curveEnd) {
    if (corner) w.curve = corner.x;
    else if (ta) w.curve = add(a, scale(ta, L / 2));
    else w.curve = sub(b, scale(tb!, L / 2));
    return true;
  }
  if (corner) {
    // Circular-arc handle length: (4/3)·tan(θ/4)·R, with R·tan(θ/2) the distance to the corner.
    const theta = Math.acos(Math.max(-1, Math.min(1, ta!.x * tb!.x + ta!.y * tb!.y)));
    const k = theta < 1e-3 ? 1 / 3 : ((4 / 3) * Math.tan(theta / 4)) / Math.tan(theta / 2);
    w.curve = add(a, scale(ta!, corner.s * k));
    w.curveEnd = sub(b, scale(tb!, corner.r * k));
  } else {
    w.curve = add(a, scale(ta ?? c, L / 3));
    w.curveEnd = sub(b, scale(tb ?? c, L / 3));
  }
  return true;
}

/** Switches a curved wall between one bend handle (quadratic) and two end handles (cubic), keeping its shape. */
export function setCurveHandles(d: D, wallId: string, two: boolean): void {
  const w = d.walls[wallId];
  if (!w?.curve) return;
  const a = d.nodes[w.a];
  const b = d.nodes[w.b];
  if (two && !w.curveEnd) {
    // Exact degree elevation.
    const c = w.curve;
    w.curve = add(a, scale(sub(c, a), 2 / 3));
    w.curveEnd = add(b, scale(sub(c, b), 2 / 3));
  } else if (!two && w.curveEnd) {
    // Closest quadratic: (3·(c1 + c2) − (a + b)) / 4.
    const c1 = w.curve;
    const c2 = w.curveEnd;
    w.curve = { x: (3 * (c1.x + c2.x) - (a.x + b.x)) / 4, y: (3 * (c1.y + c2.y) - (a.y + b.y)) / 4 };
    w.curveEnd = null;
  }
}

/**
 * Reshapes a curved wall into a circular arc through its two ends and its current peak (the
 * point halfway along it): a round top of constant diameter instead of a pointed parabola. The
 * wall gets two handles sized for a circle ((4/3)·tan(θ/4)·R along each end's tangent). Returns
 * false when the wall is straight or its peak lies on the chord.
 */
export function makeCircularArc(d: D, wallId: string): boolean {
  const w = d.walls[wallId];
  if (!w?.curve) return false;
  const a = d.nodes[w.a];
  const b = d.nodes[w.b];
  const path = buildWallPath(a, b, w.curve, w.curveEnd);
  const P = pointAt(path, path.length / 2).p;
  // Circle through a, P, b.
  const ax = a.x;
  const ay = a.y;
  const bx = P.x;
  const by = P.y;
  const cx = b.x;
  const cy = b.y;
  const den = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(den) < 1e-9) return false;
  const a2 = ax * ax + ay * ay;
  const b2 = bx * bx + by * by;
  const c2 = cx * cx + cy * cy;
  const O = { x: (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / den, y: (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / den };
  const R = dist(O, a);
  // Direction of travel round the centre (left or right turn from a through P to b).
  const turn = Math.sign((P.x - a.x) * (b.y - P.y) - (P.y - a.y) * (b.x - P.x));
  const perp = (v: Vec2): Vec2 => normalize({ x: -v.y * turn, y: v.x * turn });
  const ta = perp(sub(a, O));
  const tb = perp(sub(b, O));
  let sweep = Math.atan2(b.y - O.y, b.x - O.x) - Math.atan2(a.y - O.y, a.x - O.x);
  if (turn < 0) sweep = -sweep;
  while (sweep <= 0) sweep += 2 * Math.PI;
  const h = (4 / 3) * Math.tan(sweep / 4) * R;
  w.curve = add(a, scale(ta, h));
  w.curveEnd = sub(b, scale(tb, h));
  return true;
}

/** Average handle length of a two-handle curve as a fraction of its chord. */
export function curveHandleFraction(d: D | Project, wallId: string): number | null {
  const w = d.walls[wallId];
  if (!w?.curve || !w.curveEnd) return null;
  const a = d.nodes[w.a];
  const b = d.nodes[w.b];
  const L = dist(a, b);
  return L > 1e-6 ? (dist(a, w.curve) + dist(b, w.curveEnd)) / (2 * L) : null;
}

/**
 * Sets both handles of a two-handle curve to `frac` × chord length, keeping their directions:
 * longer handles make a fuller, wider top; shorter ones a pointier top.
 */
export function setCurveHandleFraction(d: D, wallId: string, frac: number): void {
  const w = d.walls[wallId];
  if (!w?.curve || !w.curveEnd) return;
  const a = d.nodes[w.a];
  const b = d.nodes[w.b];
  const L = dist(a, b) * Math.max(0.02, frac);
  const ua = normalize(sub(w.curve, a));
  const ub = normalize(sub(w.curveEnd, b));
  if ((ua.x || ua.y) && (ub.x || ub.y)) {
    w.curve = add(a, scale(ua, L));
    w.curveEnd = add(b, scale(ub, L));
  }
}

/** Mirrors a curved wall's handles across its chord (the bulge flips to the other side). */
export function flipCurve(d: D, wallId: string): void {
  const w = d.walls[wallId];
  if (!w?.curve) return;
  const a = d.nodes[w.a];
  const b = d.nodes[w.b];
  const u = normalize(sub(b, a));
  const mirror = (p: Vec2): Vec2 => {
    const v = sub(p, a);
    const along = scale(u, v.x * u.x + v.y * u.y);
    return add(a, sub(scale(along, 2), v));
  };
  w.curve = mirror(w.curve);
  if (w.curveEnd) w.curveEnd = mirror(w.curveEnd);
}

/** Reverses a wall's direction (swaps sides) while keeping openings in place. */
export function flipWall(d: D, wallId: string): void {
  const w = d.walls[wallId];
  if (!w) return;
  const L = buildWallPath(d.nodes[w.a], d.nodes[w.b], w.curve, w.curveEnd).length;
  const { a, b } = w;
  w.a = b;
  w.b = a;
  // A reversed cubic swaps its two handles.
  if (w.curve && w.curveEnd) [w.curve, w.curveEnd] = [w.curveEnd, w.curve];
  const { left, right } = w.materials;
  w.materials.left = right;
  w.materials.right = left;
  if (w.finishes) w.finishes = { left: w.finishes.right, right: w.finishes.left };
  if (w.heightEnd != null) {
    const h = w.height;
    w.height = w.heightEnd;
    w.heightEnd = h;
  }
  for (const o of Object.values(d.openings)) {
    if (o.wallId !== wallId) continue;
    o.offset = L - o.offset;
    o.swingSide = o.swingSide === 'left' ? 'right' : 'left';
    o.hinge = o.hinge === 'start' ? 'end' : 'start';
  }
}

/** Clamps every opening on the given walls into its wall's clear range. */
export function clampOpenings(d: D, wallIds?: string[]): void {
  const snapshot = plain(d as Project);
  const net = computeWallNetwork(snapshot);
  for (const o of Object.values(d.openings)) {
    if (wallIds && !wallIds.includes(o.wallId)) continue;
    const g = net.walls.get(o.wallId);
    if (!g) continue;
    const avail = Math.max(0.2, g.clearEnd - g.clearStart);
    if (o.width > avail) o.width = avail;
    const lo = g.clearStart + o.width / 2;
    const hi = Math.max(lo, g.clearEnd - o.width / 2);
    o.offset = Math.min(Math.max(o.offset, lo), hi);
  }
}

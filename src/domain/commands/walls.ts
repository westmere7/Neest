import { current, isDraft, type Draft } from 'immer';
import { DEFAULT_MATERIALS } from '@/data/materials/catalog';
import { newId } from '../model/ids';
import type { Project, Vec2, WallRole, WallSegment } from '../model/schema';
import { buildWallPath, paramAt, pointAt, projectOnPath, splitBezier } from '../geometry/wallPath';
import { computeWallNetwork } from '../geometry/walls';
import { add, angleDelta, angleOf, closestPointOnSegment, dist, scale, segmentIntersection, sub } from '../geometry/vec';

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
    const path = buildWallPath(a, b, w.curve);
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
  const path = buildWallPath(a, b, w.curve);
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
  if (path.control) {
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
  };
  w.b = mid;
  w.curve = firstCurve;
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
  const path = buildWallPath(a, b, w.curve);
  if (path.length < 1e-9) return;
  const k = length / path.length;
  const fixed = anchor === 'start' ? a : b;
  const moving = anchor === 'start' ? b : a;
  const np = add(fixed, scale(sub(moving, fixed), k));
  const newCurve = w.curve ? add(fixed, scale(sub(w.curve, fixed), k)) : null;
  setNodePositions(d, { [moving.id]: np });
  if (newCurve) d.walls[wallId].curve = newCurve;
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
  const path = buildWallPath(d.nodes[w.a], d.nodes[w.b], w.curve);
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
  }
}

/** Reverses a wall's direction (swaps sides) while keeping openings in place. */
export function flipWall(d: D, wallId: string): void {
  const w = d.walls[wallId];
  if (!w) return;
  const L = buildWallPath(d.nodes[w.a], d.nodes[w.b], w.curve).length;
  const { a, b } = w;
  w.a = b;
  w.b = a;
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

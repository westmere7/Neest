import type { Vec2 } from '../model/schema';
import type { WallNetwork } from './walls';
import { projectOnPath } from './wallPath';
import { add, cross, dist, dot, leftNormal, len, normalize, scale, segmentIntersection, sub } from './vec';

/**
 * Offsets a polyline sideways by `distance` (positive = to the left of the
 * drawing direction, i.e. along `leftNormal`; negative = to the right).
 * Consecutive segments are joined where their offset lines intersect (mitre),
 * so the result has exactly one point per input point. Closed polylines are
 * mitred at every vertex; open ones keep their end points square.
 *
 * Mitres longer than `miterLimit × |distance|` (near-reversals) are clamped
 * along the bisector so a hairpin can't shoot a corner far away.
 */
export function offsetPolyline(points: Vec2[], distance: number, closed = false, miterLimit = 8): Vec2[] {
  let pts = points;
  if (closed && pts.length > 2 && dist(pts[0], pts[pts.length - 1]) < 1e-9) pts = pts.slice(0, -1);
  const n = pts.length;
  if (n < 2 || distance === 0) return pts.map((p) => ({ x: p.x, y: p.y }));
  const segCount = closed ? n : n - 1;
  const dirs: (Vec2 | null)[] = [];
  for (let i = 0; i < segCount; i++) {
    const d = sub(pts[(i + 1) % n], pts[i]);
    dirs.push(len(d) < 1e-9 ? null : normalize(d));
  }
  // Zero-length segments borrow a neighbour's direction.
  const firstDir = dirs.find((d) => d !== null);
  if (!firstDir) return pts.map((p) => ({ x: p.x, y: p.y }));
  let prev: Vec2 = firstDir;
  for (let i = 0; i < segCount; i++) {
    if (dirs[i]) prev = dirs[i]!;
    else dirs[i] = prev;
  }
  const out: Vec2[] = [];
  const limit = miterLimit * Math.abs(distance);
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const inDir = closed ? dirs[(i - 1 + segCount) % segCount] : i > 0 ? dirs[i - 1] : null;
    const outDir = closed ? dirs[i % segCount] : i < n - 1 ? dirs[i] : null;
    if (!inDir || !outDir) {
      out.push(add(p, scale(leftNormal((inDir ?? outDir)!), distance)));
      continue;
    }
    const n1 = leftNormal(inDir);
    const n2 = leftNormal(outDir);
    const k = 1 + dot(n1, n2);
    if (Math.abs(cross(inDir, outDir)) < 1e-9 && k > 1) {
      // Straight continuation.
      out.push(add(p, scale(n1, distance)));
      continue;
    }
    if (k < 1e-9) {
      // Full reversal: no meaningful mitre; push straight back along the bisector limit.
      out.push(add(p, scale(n1, distance)));
      continue;
    }
    let m = scale(add(n1, n2), distance / k);
    if (len(m) > limit) m = scale(normalize(m), limit);
    out.push(add(p, m));
  }
  return out;
}

/**
 * Quadratic Bézier control point for a curve from `a` to `b` that passes
 * through `p` at t = 0.5: B(0.5) = (A + 2C + B) / 4 = P ⇒ C = 2P − (A + B) / 2.
 */
export function arcControlThrough(a: Vec2, b: Vec2, p: Vec2): Vec2 {
  return { x: 2 * p.x - (a.x + b.x) / 2, y: 2 * p.y - (a.y + b.y) / 2 };
}

/** The point at a signed bulge (sagitta) from the chord midpoint; positive bulges to the chord's left. */
export function bulgePoint(a: Vec2, b: Vec2, bulge: number): Vec2 {
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  return add(mid, scale(leftNormal(normalize(sub(b, a))), bulge));
}

/** Signed bulge of `p` relative to chord a→b (positive = left of the chord). */
export function signedBulge(a: Vec2, b: Vec2, p: Vec2): number {
  return dot(sub(p, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }), leftNormal(normalize(sub(b, a))));
}

export interface WallFaceHit {
  wallId: string;
  /** Point on the face. */
  point: Vec2;
  /** Unit normal of the face pointing away from the wall body. */
  normal: Vec2;
  side: 'left' | 'right';
}

/**
 * Identifies the wall face a point lies on (within `tol` of the face line).
 * Returns the face's outward normal at that point.
 */
export function wallFaceAt(network: WallNetwork, wallId: string, p: Vec2, tol = 0.01): WallFaceHit | null {
  const g = network.walls.get(wallId);
  if (!g) return null;
  const proj = projectOnPath(g.path, p);
  if (proj.s < -tol || proj.s > g.path.length + tol) return null;
  const n = leftNormal(proj.tangent);
  const off = dot(sub(p, proj.point), n);
  if (Math.abs(Math.abs(off) - g.h) > tol) return null;
  const sign = off >= 0 ? 1 : -1;
  return { wallId, point: p, normal: scale(n, sign), side: sign > 0 ? 'left' : 'right' };
}

export interface FacingHit {
  wallId: string;
  point: Vec2;
  distance: number;
}

/**
 * Casts a ray from `from` along `dir` and returns the first wall face it meets,
 * provided that face is parallel to the starting face (within `parallelTolDeg`).
 * Used for "clear distance to the opposite wall" measurements.
 */
export function findOppositeFace(
  network: WallNetwork,
  from: Vec2,
  dir: Vec2,
  opts: { maxDistance?: number; parallelTolDeg?: number } = {},
): FacingHit | null {
  const maxD = opts.maxDistance ?? 50;
  const sinTol = Math.sin(((opts.parallelTolDeg ?? 3) * Math.PI) / 180);
  const u = normalize(dir);
  const far = add(from, scale(u, maxD));
  let best: (FacingHit & { segDir: Vec2 }) | null = null;
  for (const g of network.walls.values()) {
    if (g.wall.hidden) continue;
    for (const edge of [g.left, g.right]) {
      for (let i = 0; i < edge.length - 1; i++) {
        const hit = segmentIntersection(from, far, edge[i], edge[i + 1]);
        if (!hit) continue;
        const d = hit.t * maxD;
        if (d < 1e-3) continue;
        if (!best || d < best.distance) best = { wallId: g.wall.id, point: hit.point, distance: d, segDir: normalize(sub(edge[i + 1], edge[i])) };
      }
    }
  }
  if (!best) return null;
  // Parallel faces are perpendicular to the ray.
  if (Math.abs(dot(best.segDir, u)) > sinTol) return null;
  return { wallId: best.wallId, point: best.point, distance: best.distance };
}

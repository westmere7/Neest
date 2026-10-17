import type { Vec2 } from '../model/schema';

/** Geometric comparison tolerance in metres (0.1 mm). */
export const EPS = 1e-4;

export const v = (x: number, y: number): Vec2 => ({ x, y });
export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, y: a.y * s });
export const dot = (a: Vec2, b: Vec2) => a.x * b.x + a.y * b.y;
export const cross = (a: Vec2, b: Vec2) => a.x * b.y - a.y * b.x;
export const len = (a: Vec2) => Math.hypot(a.x, a.y);
export const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);
export const dist2 = (a: Vec2, b: Vec2) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
export const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
export const mid = (a: Vec2, b: Vec2): Vec2 => lerp(a, b, 0.5);
export const eq = (a: Vec2, b: Vec2, eps = EPS) => Math.abs(a.x - b.x) <= eps && Math.abs(a.y - b.y) <= eps;
export const angleOf = (a: Vec2) => Math.atan2(a.y, a.x);
export const fromAngle = (theta: number, length = 1): Vec2 => ({
  x: Math.cos(theta) * length,
  y: Math.sin(theta) * length,
});

export function normalize(a: Vec2): Vec2 {
  const l = len(a);
  return l < 1e-12 ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l };
}

/**
 * Left-hand normal of a direction as seen on screen (y down). Walking along
 * `d`, this vector points to the walker's left.
 */
export const leftNormal = (d: Vec2): Vec2 => ({ x: d.y, y: -d.x });

export function rotate(p: Vec2, theta: number, origin: Vec2 = { x: 0, y: 0 }): Vec2 {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const dx = p.x - origin.x;
  const dy = p.y - origin.y;
  return { x: origin.x + dx * c - dy * s, y: origin.y + dx * s + dy * c };
}

export const round = (n: number, step: number) => Math.round(n / step) * step;

export function snapToGrid(p: Vec2, step: number): Vec2 {
  return { x: round(p.x, step), y: round(p.y, step) };
}

export interface ClosestPoint {
  point: Vec2;
  /** Parameter along the segment, clamped to [0, 1]. */
  t: number;
  dist: number;
}

export function closestPointOnSegment(p: Vec2, a: Vec2, b: Vec2): ClosestPoint {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  let t = l2 < 1e-12 ? 0 : dot(sub(p, a), ab) / l2;
  t = Math.max(0, Math.min(1, t));
  const point = add(a, scale(ab, t));
  return { point, t, dist: dist(p, point) };
}

/** Intersection of two segments. Returns params t (on ab) and u (on cd) in [0,1]. */
export function segmentIntersection(
  a: Vec2,
  b: Vec2,
  c: Vec2,
  d: Vec2,
  eps = 1e-9,
): { point: Vec2; t: number; u: number } | null {
  const r = sub(b, a);
  const s = sub(d, c);
  const denom = cross(r, s);
  if (Math.abs(denom) < eps) return null;
  const ac = sub(c, a);
  const t = cross(ac, s) / denom;
  const u = cross(ac, r) / denom;
  if (t < -eps || t > 1 + eps || u < -eps || u > 1 + eps) return null;
  return { point: add(a, scale(r, t)), t, u };
}

/** Intersection of two infinite lines given as point + direction. */
export function lineIntersection(p: Vec2, r: Vec2, q: Vec2, s: Vec2): Vec2 | null {
  const denom = cross(r, s);
  if (Math.abs(denom) < 1e-9) return null;
  const t = cross(sub(q, p), s) / denom;
  return add(p, scale(r, t));
}

/** Smallest positive angle difference from a to b in [0, 2π). */
export function angleDelta(a: number, b: number): number {
  let d = b - a;
  while (d < 0) d += Math.PI * 2;
  while (d >= Math.PI * 2) d -= Math.PI * 2;
  return d;
}

export function normalizeAngle(theta: number): number {
  let t = theta % (Math.PI * 2);
  if (t < 0) t += Math.PI * 2;
  return t;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function boundsOf(points: Iterable<Vec2>): Bounds | null {
  let b: Bounds | null = null;
  for (const p of points) {
    if (!b) b = { minX: p.x, minY: p.y, maxX: p.x, maxY: p.y };
    else {
      b.minX = Math.min(b.minX, p.x);
      b.minY = Math.min(b.minY, p.y);
      b.maxX = Math.max(b.maxX, p.x);
      b.maxY = Math.max(b.maxY, p.y);
    }
  }
  return b;
}

export function unionBounds(a: Bounds | null, b: Bounds | null): Bounds | null {
  if (!a) return b;
  if (!b) return a;
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

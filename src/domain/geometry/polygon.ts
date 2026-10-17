import { ShapeUtils, Vector2 } from 'three';
import type { Vec2 } from '../model/schema';
import { add, cross, dist, leftNormal, lineIntersection, normalize, scale, segmentIntersection, sub } from './vec';

export type Polygon = Vec2[];

/** Shoelace signed area. Positive = clockwise on screen (y down), i.e. counter-clockwise in math axes. */
export function signedArea(poly: Polygon): number {
  let a = 0;
  for (let i = 0, n = poly.length; i < n; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % n];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

export const polygonArea = (poly: Polygon) => Math.abs(signedArea(poly));

export function polygonPerimeter(poly: Polygon): number {
  let l = 0;
  for (let i = 0, n = poly.length; i < n; i++) l += dist(poly[i], poly[(i + 1) % n]);
  return l;
}

export function pointInPolygon(p: Vec2, poly: Polygon): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function polygonCentroid(poly: Polygon): Vec2 {
  const a = signedArea(poly);
  if (Math.abs(a) < 1e-12) {
    const s = poly.reduce((acc, p) => add(acc, p), { x: 0, y: 0 });
    return scale(s, 1 / Math.max(1, poly.length));
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0, n = poly.length; i < n; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % n];
    const f = p.x * q.y - q.x * p.y;
    cx += (p.x + q.x) * f;
    cy += (p.y + q.y) * f;
  }
  return { x: cx / (6 * a), y: cy / (6 * a) };
}

function distToPolygonEdges(p: Vec2, poly: Polygon): number {
  let best = Infinity;
  for (let i = 0, n = poly.length; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    const ab = sub(b, a);
    const l2 = ab.x * ab.x + ab.y * ab.y;
    let t = l2 < 1e-12 ? 0 : ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / l2;
    t = Math.max(0, Math.min(1, t));
    best = Math.min(best, dist(p, { x: a.x + ab.x * t, y: a.y + ab.y * t }));
  }
  return best;
}

/**
 * Approximate pole of inaccessibility: an interior point far from edges, used
 * for room labels and identity anchors. Works for concave rooms and holes.
 */
export function labelPoint(outer: Polygon, holes: Polygon[] = []): Vec2 {
  const xs = outer.map((p) => p.x);
  const ys = outer.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const inside = (p: Vec2) => pointInPolygon(p, outer) && !holes.some((h) => pointInPolygon(p, h));
  const score = (p: Vec2) =>
    Math.min(distToPolygonEdges(p, outer), ...holes.map((h) => distToPolygonEdges(p, h)));
  let best = polygonCentroid(outer);
  let bestScore = inside(best) ? score(best) : -Infinity;
  let cell = Math.max(maxX - minX, maxY - minY) / 12;
  let cx0 = minX;
  let cy0 = minY;
  let cx1 = maxX;
  let cy1 = maxY;
  for (let iter = 0; iter < 4 && cell > 1e-3; iter++) {
    for (let x = cx0 + cell / 2; x < cx1; x += cell) {
      for (let y = cy0 + cell / 2; y < cy1; y += cell) {
        const p = { x, y };
        if (!inside(p)) continue;
        const s = score(p);
        if (s > bestScore) {
          bestScore = s;
          best = p;
        }
      }
    }
    cx0 = best.x - cell * 2;
    cx1 = best.x + cell * 2;
    cy0 = best.y - cell * 2;
    cy1 = best.y + cell * 2;
    cell /= 4;
  }
  return best;
}

/** True when any two non-adjacent edges intersect. */
export function isSelfIntersecting(poly: Polygon): boolean {
  const n = poly.length;
  if (n < 4) return false;
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(i - j) <= 1 || (i === 0 && j === n - 1)) continue;
      const c = poly[j];
      const d = poly[(j + 1) % n];
      const hit = segmentIntersection(a, b, c, d, 1e-12);
      if (hit && hit.t > 1e-6 && hit.t < 1 - 1e-6 && hit.u > 1e-6 && hit.u < 1 - 1e-6) return true;
    }
  }
  return false;
}

/** Removes consecutive duplicate and collinear vertices. */
export function cleanPolygon(poly: Polygon, eps = 1e-6): Polygon {
  const out: Polygon = [];
  for (const p of poly) {
    const last = out[out.length - 1];
    if (!last || dist(last, p) > eps) out.push(p);
  }
  if (out.length > 1 && dist(out[0], out[out.length - 1]) <= eps) out.pop();
  let changed = true;
  while (changed && out.length > 3) {
    changed = false;
    for (let i = 0; i < out.length; i++) {
      const a = out[(i - 1 + out.length) % out.length];
      const b = out[i];
      const c = out[(i + 1) % out.length];
      const ab = sub(b, a);
      const bc = sub(c, b);
      if (Math.abs(cross(ab, bc)) < eps * Math.max(1, Math.hypot(ab.x, ab.y) + Math.hypot(bc.x, bc.y))) {
        // Only drop when b lies between a and c (not a spike back).
        if (ab.x * bc.x + ab.y * bc.y > 0) {
          out.splice(i, 1);
          changed = true;
          break;
        }
      }
    }
  }
  return out;
}

/**
 * Offsets each polygon edge by its own distance (negative = toward the
 * polygon's left side as walked). Consecutive offset lines are intersected;
 * collinear edges with different distances produce a small step.
 */
export function offsetPolygonEdges(poly: Polygon, distances: number[]): Polygon {
  const n = poly.length;
  const lines = poly.map((p, i) => {
    const q = poly[(i + 1) % n];
    const d = normalize(sub(q, p));
    const nrm = leftNormal(d);
    const o = scale(nrm, distances[i]);
    return { p: add(p, o), q: add(q, o), d };
  });
  const out: Polygon = [];
  for (let i = 0; i < n; i++) {
    const prev = lines[(i - 1 + n) % n];
    const cur = lines[i];
    const hit = lineIntersection(prev.p, prev.d, cur.p, cur.d);
    const c = cross(prev.d, cur.d);
    if (hit && Math.abs(c) > 1e-6) {
      // Limit extreme miters on near-parallel edges.
      if (dist(hit, poly[i]) < 10 * Math.max(Math.abs(distances[i]), Math.abs(distances[(i - 1 + n) % n]), 0.01)) {
        out.push(hit);
        continue;
      }
    }
    out.push(prev.q);
    if (dist(prev.q, cur.p) > 1e-6) out.push(cur.p);
  }
  return out;
}

/** Triangulates a polygon with optional holes. Returns triangles as vertex index triples into [outer, ...holes]. */
export function triangulate(outer: Polygon, holes: Polygon[] = []): number[][] {
  const contour = outer.map((p) => new Vector2(p.x, p.y));
  const holeVecs = holes.map((h) => h.map((p) => new Vector2(p.x, p.y)));
  return ShapeUtils.triangulateShape(contour, holeVecs);
}

/** Andrew's monotone chain convex hull. */
export function convexHull(points: Vec2[]): Polygon {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length < 3) return pts;
  const lower: Vec2[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(sub(lower[lower.length - 1], lower[lower.length - 2]), sub(p, lower[lower.length - 2])) <= 0)
      lower.pop();
    lower.push(p);
  }
  const upper: Vec2[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(sub(upper[upper.length - 1], upper[upper.length - 2]), sub(p, upper[upper.length - 2])) <= 0)
      upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

export function rectPolygon(cx: number, cy: number, w: number, d: number, rotation = 0): Polygon {
  const c = Math.cos(rotation);
  const s = Math.sin(rotation);
  const hw = w / 2;
  const hd = d / 2;
  return [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ].map(([x, y]) => ({ x: cx + x * c - y * s, y: cy + x * s + y * c }));
}

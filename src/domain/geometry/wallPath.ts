import type { Vec2 } from '../model/schema';
import { add, closestPointOnSegment, dist, lerp, normalize, scale, sub } from './vec';

/**
 * A wall centreline path. Straight walls have two samples; curved walls are
 * quadratic Bézier curves (start, control, end) approximated by evenly spaced
 * samples carrying cumulative arc length `s` and unit tangents.
 */
export interface PathSample {
  p: Vec2;
  s: number;
  tangent: Vec2;
}

export interface WallPath {
  a: Vec2;
  b: Vec2;
  control: Vec2 | null;
  samples: PathSample[];
  length: number;
}

export function bezierPoint(a: Vec2, c: Vec2, b: Vec2, t: number): Vec2 {
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
    y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
  };
}

export function bezierTangent(a: Vec2, c: Vec2, b: Vec2, t: number): Vec2 {
  const u = 1 - t;
  const d = {
    x: 2 * u * (c.x - a.x) + 2 * t * (b.x - c.x),
    y: 2 * u * (c.y - a.y) + 2 * t * (b.y - c.y),
  };
  const n = normalize(d);
  return n.x === 0 && n.y === 0 ? normalize(sub(b, a)) : n;
}

/** Splits a quadratic Bézier at t using de Casteljau's algorithm. */
export function splitBezier(a: Vec2, c: Vec2, b: Vec2, t: number) {
  const p01 = lerp(a, c, t);
  const p12 = lerp(c, b, t);
  const m = lerp(p01, p12, t);
  return { first: { a, c: p01, b: m }, second: { a: m, c: p12, b } };
}

/** Returns true when the control point makes a meaningful curve (not collinear). */
export function isMeaningfulCurve(a: Vec2, c: Vec2, b: Vec2): boolean {
  const cp = closestPointOnSegment(c, a, b);
  return cp.dist > Math.max(0.005, dist(a, b) * 0.002);
}

export function buildWallPath(a: Vec2, b: Vec2, control: Vec2 | null): WallPath {
  if (!control || !isMeaningfulCurve(a, control, b)) {
    const d = normalize(sub(b, a));
    const length = dist(a, b);
    return {
      a,
      b,
      control: null,
      length,
      samples: [
        { p: a, s: 0, tangent: d },
        { p: b, s: length, tangent: d },
      ],
    };
  }
  // Estimate arc length to choose sample density (~8 cm chords, 12–64 samples).
  let approx = 0;
  let prev = a;
  for (let i = 1; i <= 32; i++) {
    const p = bezierPoint(a, control, b, i / 32);
    approx += dist(prev, p);
    prev = p;
  }
  const n = Math.max(12, Math.min(64, Math.ceil(approx / 0.08)));
  const samples: PathSample[] = [];
  let s = 0;
  prev = a;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = i === 0 ? a : i === n ? b : bezierPoint(a, control, b, t);
    if (i > 0) s += dist(prev, p);
    samples.push({ p, s, tangent: bezierTangent(a, control, b, t) });
    prev = p;
  }
  return { a, b, control, samples, length: s };
}

/** Point and tangent at arc length s (clamped). */
export function pointAt(path: WallPath, s: number): { p: Vec2; tangent: Vec2; index: number } {
  const { samples } = path;
  if (s <= 0) return { p: samples[0].p, tangent: samples[0].tangent, index: 0 };
  if (s >= path.length) {
    const last = samples[samples.length - 1];
    return { p: last.p, tangent: last.tangent, index: samples.length - 2 };
  }
  let lo = 0;
  let hi = samples.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (samples[m].s <= s) lo = m;
    else hi = m;
  }
  const A = samples[lo];
  const B = samples[hi];
  const t = (s - A.s) / Math.max(1e-12, B.s - A.s);
  const tangent = path.control ? normalize(lerp(A.tangent, B.tangent, t)) : A.tangent;
  return { p: lerp(A.p, B.p, t), tangent, index: lo };
}

/** Bézier parameter t corresponding to arc length s (approximate, via samples). */
export function paramAt(path: WallPath, s: number): number {
  const { samples } = path;
  const n = samples.length - 1;
  if (s <= 0) return 0;
  if (s >= path.length) return 1;
  for (let i = 0; i < n; i++) {
    if (samples[i + 1].s >= s) {
      const f = (s - samples[i].s) / Math.max(1e-12, samples[i + 1].s - samples[i].s);
      return (i + f) / n;
    }
  }
  return 1;
}

export interface PathProjection {
  s: number;
  point: Vec2;
  dist: number;
  tangent: Vec2;
}

/** Closest point on the path to p. */
export function projectOnPath(path: WallPath, p: Vec2): PathProjection {
  let best: PathProjection = { s: 0, point: path.a, dist: Infinity, tangent: path.samples[0].tangent };
  const { samples } = path;
  for (let i = 0; i < samples.length - 1; i++) {
    const A = samples[i];
    const B = samples[i + 1];
    const cp = closestPointOnSegment(p, A.p, B.p);
    if (cp.dist < best.dist) {
      const segLen = B.s - A.s;
      best = {
        s: A.s + cp.t * segLen,
        point: cp.point,
        dist: cp.dist,
        tangent: path.control ? normalize(lerp(A.tangent, B.tangent, cp.t)) : A.tangent,
      };
    }
  }
  return best;
}

/** Offsets path samples by a signed distance along the left normal. */
export function offsetSamples(samples: PathSample[], distance: number): Vec2[] {
  return samples.map((smp) => add(smp.p, scale({ x: smp.tangent.y, y: -smp.tangent.x }, distance)));
}

/** Polyline points of the path between arc lengths s0 and s1 (inclusive ends). */
export function slicePath(path: WallPath, s0: number, s1: number, offset = 0): Vec2[] {
  const pts: Vec2[] = [];
  const at = (s: number) => {
    const { p, tangent } = pointAt(path, s);
    return add(p, scale({ x: tangent.y, y: -tangent.x }, offset));
  };
  pts.push(at(s0));
  for (const smp of path.samples) {
    if (smp.s > s0 + 1e-6 && smp.s < s1 - 1e-6)
      pts.push(add(smp.p, scale({ x: smp.tangent.y, y: -smp.tangent.x }, offset)));
  }
  pts.push(at(s1));
  return pts;
}

/**
 * Plant-building helpers: botanically shaped leaves, fronds, pots, plant stands and hangers.
 *
 * Leaves are flat outlines (thin prisms) laid along a frame and split into panels along the
 * midrib so a blade can arch, twist, fold into a shallow V, carry slits, a wavy or toothed margin
 * and heart- or arrow-shaped basal lobes. Everything returns plain `Part` data, and `fitGroup` /
 * `containParts` keep a plant inside its item box at any size. Re-exported by `@/packs/kit`.
 */
import { clamp, cyl, lathe, lerp, poly, range, ring, rng, rod, sphere, torus, type V2, type V3 } from './parts';
import type { Part, PlanStroke, Size3 } from './types';

export const TAU = Math.PI * 2;
/** Golden angle: successive leaves spiral round a stem without lining up. */
export const GOLDEN = 2.39996;

// ---------------------------------------------------------------------------
// Vectors and frames
// ---------------------------------------------------------------------------

export const vadd = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const vsub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const vmul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const vdot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const vcross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const vlen = (a: V3): number => Math.hypot(a[0], a[1], a[2]);
export const vnorm = (a: V3): V3 => vmul(a, 1 / (vlen(a) || 1));
/** Unit vector at azimuth `az` (0 = +x, π/2 = +z), tilted `tilt` from straight up (π/2 = level). */
export const dirOf = (az: number, tilt: number): V3 => [Math.sin(tilt) * Math.cos(az), Math.cos(tilt), Math.sin(tilt) * Math.sin(az)];
/** Azimuth and tilt of a direction. */
export function azTilt(v: V3): [number, number] {
  const u = vnorm(v);
  return [Math.atan2(u[2], u[0]), Math.acos(clamp(u[1], -1, 1))];
}
/** Point at radius `r` and azimuth `a` on the horizontal plane at height y. */
export const polar = (r: number, a: number, y = 0): V3 => [Math.cos(a) * r, y, Math.sin(a) * r];

/** Point at fraction `t` (0–1) of the total length along a polyline. */
export function along(pts: V3[], t: number): V3 {
  const segs = range(pts.length - 1).map((i) => vlen(vsub(pts[i + 1], pts[i])));
  let rest = clamp(t, 0, 1) * segs.reduce((a, b) => a + b, 0);
  for (const [i, L] of segs.entries()) {
    if (rest <= L || i === segs.length - 1) return vadd(pts[i], vmul(vsub(pts[i + 1], pts[i]), L > 0 ? clamp(rest / L, 0, 1) : 0));
    rest -= L;
  }
  return pts[pts.length - 1];
}

/** Points of a quadratic Bézier from a to b bulging towards c (stems, trailing vines). */
export function bezier(a: V3, c: V3, b: V3, n: number): V3[] {
  return range(n + 1).map((i) => {
    const t = i / n;
    const u = 1 - t;
    return vadd(vadd(vmul(a, u * u), vmul(c, 2 * u * t)), vmul(b, t * t));
  });
}

export type M3 = [V3, V3, V3];
/** Rotation matrix whose columns are the images of local x, y and z. */
/** Rotation matrix whose columns are the given axes. */
export const fromCols = (a: V3, b: V3, c: V3): M3 => [
  [a[0], b[0], c[0]],
  [a[1], b[1], c[1]],
  [a[2], b[2], c[2]],
];
const xform = (m: M3, v: V3): V3 => [vdot(m[0], v), vdot(m[1], v), vdot(m[2], v)];
/** Three.js XYZ Euler angles of a rotation matrix. */
export function euler(m: M3): V3 {
  const m13 = clamp(m[0][2], -1, 1);
  return Math.abs(m13) < 0.9999999 ? [Math.atan2(-m[1][2], m[2][2]), Math.asin(m13), Math.atan2(-m[0][1], m[0][0])] : [Math.atan2(m[2][1], m[1][1]), Math.asin(m13), 0];
}

/** Leaf frame: L runs along the blade, W across it, N is the upper face's normal. */
export interface LeafFrame {
  L: V3;
  W: V3;
  N: V3;
}

/** Frame of a blade pointing at azimuth `az`, tilted `tilt` from vertical and rolled `roll` about its midrib. */
export function leafFrame(az: number, tilt: number, roll = 0): LeafFrame {
  const L = dirOf(az, tilt);
  const W0: V3 = [-Math.sin(az), 0, Math.cos(az)];
  const N0 = vcross(W0, L);
  const c = Math.cos(roll);
  const s = Math.sin(roll);
  return { L, W: vadd(vmul(W0, c), vmul(N0, s)), N: vadd(vmul(W0, -s), vmul(N0, c)) };
}

// ---------------------------------------------------------------------------
// Fitting: keep a plant inside its item box at any size
// ---------------------------------------------------------------------------

/** Item box: x ∈ [-hx, hx], y ∈ [y0, y1], z ∈ [-hz, hz]. */
export interface PlantBox {
  hx: number;
  hz: number;
  y0: number;
  y1: number;
}

export const plantBox = ({ w, d, h }: Size3, y0 = 0): PlantBox => ({ hx: w / 2, hz: d / 2, y0, y1: h });
/** Half the smaller footprint side (the radius a round plant can use). */
export const halfMin = ({ w, d }: Size3): number => Math.min(w, d) / 2;

interface Bounds {
  min: V3;
  max: V3;
}
const PAD = 0.004;

/** Euler XYZ rotation (three.js convention, R = Rx · Ry · Rz). */
function rotXYZ(v: V3, [ax, ay, az]: V3): V3 {
  let [x, y, z] = v;
  [x, y] = [x * Math.cos(az) - y * Math.sin(az), x * Math.sin(az) + y * Math.cos(az)];
  [x, z] = [x * Math.cos(ay) + z * Math.sin(ay), -x * Math.sin(ay) + z * Math.cos(ay)];
  [y, z] = [y * Math.cos(ax) - z * Math.sin(ax), y * Math.sin(ax) + z * Math.cos(ax)];
  return [x, y, z];
}

/** Conservative axis-aligned bounds of a part (the same rule as the library checks). */
export function partBounds(p: Part): Bounds {
  let lo: V3;
  let hi: V3;
  switch (p.shape) {
    case 'box':
      lo = vmul(p.size, -0.5);
      hi = vmul(p.size, 0.5);
      break;
    case 'cylinder': {
      const r = Math.max(p.radiusTop, p.radiusBottom);
      lo = [-r, -p.height / 2, -r];
      hi = [r, p.height / 2, r];
      break;
    }
    case 'sphere':
      lo = [-p.radius, -p.radius, -p.radius];
      hi = [p.radius, p.radius, p.radius];
      break;
    case 'torus': {
      const r = p.radius + p.tube;
      lo = [-r, -r, -p.tube];
      hi = [r, r, p.tube];
      break;
    }
    case 'lathe': {
      const r = Math.max(...p.profile.map((q) => q[0]));
      const ys = p.profile.map((q) => q[1]);
      lo = [-r, Math.min(...ys), -r];
      hi = [r, Math.max(...ys), r];
      break;
    }
    case 'prism': {
      const xs = p.outline.map((q) => q[0]);
      const zs = p.outline.map((q) => q[1]);
      lo = [Math.min(...xs), 0, Math.min(...zs)];
      hi = [Math.max(...xs), p.height, Math.max(...zs)];
      break;
    }
  }
  const s = p.scale ?? [1, 1, 1];
  const min: V3 = [Infinity, Infinity, Infinity];
  const max: V3 = [-Infinity, -Infinity, -Infinity];
  for (const x of [lo[0], hi[0]]) {
    for (const y of [lo[1], hi[1]]) {
      for (const z of [lo[2], hi[2]]) {
        const c: V3 = [x * s[0], y * s[1], z * s[2]];
        const r = p.rotation ? rotXYZ(c, p.rotation) : c;
        for (const i of [0, 1, 2]) {
          min[i] = Math.min(min[i], r[i] + p.position[i]);
          max[i] = Math.max(max[i], r[i] + p.position[i]);
        }
      }
    }
  }
  return { min, max };
}

/** Conservative bounds of a group of parts. */
export function groupBounds(parts: Part[]): Bounds {
  const min: V3 = [Infinity, Infinity, Infinity];
  const max: V3 = [-Infinity, -Infinity, -Infinity];
  for (const p of parts) {
    const b = partBounds(p);
    for (const i of [0, 1, 2]) {
      min[i] = Math.min(min[i], b.min[i]);
      max[i] = Math.max(max[i], b.max[i]);
    }
  }
  return { min, max };
}

/** Uniformly scales a group of parts about the anchor point `a`. */
export const scaleAbout = (parts: Part[], a: V3, k: number): Part[] =>
  parts.map((p) => ({ ...p, position: vadd(a, vmul(vsub(p.position, a), k)), scale: vmul(p.scale ?? [1, 1, 1], k) }));

/** Shrinks a group (a leaf with its stalk, a frond, a vine) about its base `a` until it fits the box. */
export function fitGroup(parts: Part[], a: V3, box: PlantBox, pad = PAD): Part[] {
  if (!parts.length) return parts;
  const b = groupBounds(parts);
  const lo: V3 = [-box.hx + pad, box.y0, -box.hz + pad];
  const hi: V3 = [box.hx - pad, box.y1 - pad, box.hz - pad];
  let k = 1;
  for (const i of [0, 1, 2]) {
    if (b.max[i] > hi[i] && b.max[i] - a[i] > 1e-9) k = Math.min(k, (hi[i] - a[i]) / (b.max[i] - a[i]));
    if (b.min[i] < lo[i] && b.min[i] - a[i] < -1e-9) k = Math.min(k, (lo[i] - a[i]) / (b.min[i] - a[i]));
  }
  k = clamp(k, 0.05, 1);
  return k < 1 ? scaleAbout(parts, a, k) : parts;
}

/** Final guard: any part still poking out of the box is pulled in and shrunk about its own centre. */
export function containParts(parts: Part[], box: PlantBox): Part[] {
  return parts.flatMap((p) => {
    const b = partBounds(p);
    const e = 1e-6;
    if (b.min[0] >= -box.hx - e && b.max[0] <= box.hx + e && b.min[2] >= -box.hz - e && b.max[2] <= box.hz + e && b.min[1] >= box.y0 - e && b.max[1] <= box.y1 + e) return [p];
    const c: V3 = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
    const t: V3 = [clamp(c[0], -box.hx + PAD, box.hx - PAD), clamp(c[1], box.y0 + PAD, box.y1 - PAD), clamp(c[2], -box.hz + PAD, box.hz - PAD)];
    const moved = t[0] !== c[0] || t[1] !== c[1] || t[2] !== c[2] ? { ...p, position: vadd(p.position, vsub(t, c)) } : p;
    return fitGroup([moved], t, box, 0);
  });
}

// ---------------------------------------------------------------------------
// Leaf outlines
// ---------------------------------------------------------------------------

/** Removes repeated points (also across the closing edge) from an outline. */
export function dedupe(pts: V2[]): V2[] {
  const out: V2[] = [];
  for (const p of pts) {
    const q = out[out.length - 1];
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-5) out.push(p);
  }
  while (out.length > 3 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) < 1e-5) out.pop();
  return out;
}

/**
 * Flat panel: `outline` is [x across, z along the blade] in metres with the leaf base at the
 * origin. A prism `t` thick is centred on the frame's plane so the origin lands on `base`.
 *
 * The outline is not re-centred: texture u stays 0 on the midrib (leaf patterns draw their midrib
 * on the tile edge), and `along` shifts texture v so the panels of one blade continue its pattern.
 */
export function leafPanel(slot: string, base: V3, f: LeafFrame, outline: V2[], t: number, plan = false, along = 0): Part {
  // Prism x → across, prism y (extrusion) → −normal, prism z → along the blade.
  const m = fromCols(f.W, vmul(f.N, -1), f.L);
  const part: Part = {
    shape: 'prism',
    outline: outline.map(([x, z]) => [x, z + along] as V2),
    height: Math.max(0.0015, t),
    position: vadd(base, xform(m, [0, -t / 2, -along])),
    rotation: euler(m),
    slot,
  };
  if (!plan) part.plan = false;
  return part;
}

/** Half-width (metres) of a blade at fraction t (0 = base, 1 = tip) of its length. */
export type HalfWidth = (t: number) => number;

/** Ovate / elliptic blade `W` wide, widest at `peak`; `round` < 1 fills the shoulders, > 1 sharpens them. */
export const ovateWidth =
  (W: number, peak = 0.45, round = 0.75): HalfWidth =>
  (t) => {
    const u = t < peak ? (t / peak) * 0.5 : 0.5 + ((t - peak) / (1 - peak)) * 0.5;
    return (W / 2) * Math.pow(Math.max(0, Math.sin(Math.PI * clamp(u, 0, 1))), round);
  };

/** Strap / sword blade: parallel sides, tapering to a point from `tipFrom`. */
export const strapWidth =
  (W: number, tipFrom = 0.6, baseFrac = 0.7): HalfWidth =>
  (t) => {
    const b = t < 0.08 ? lerp(baseFrac, 1, t / 0.08) : 1;
    const tip = t > tipFrom ? Math.pow(Math.max(0, (1 - t) / (1 - tipFrom)), 0.85) : 1;
    return (W / 2) * b * tip;
  };

/** Fleshy succulent blade: a broad base tapering straight to a sharp point. */
export const wedgeWidth =
  (W: number, shoulder = 0.25): HalfWidth =>
  (t) =>
    (W / 2) * (t < shoulder ? lerp(0.7, 1, t / shoulder) : Math.pow(Math.max(0, (1 - t) / (1 - shoulder)), 1.1));

/**
 * Any blade shape from knots [t, fraction of W/2] (t ascending from 0 to 1), smoothly
 * interpolated: e.g. a fiddle with a waist, or an obovate leaf widest near the tip.
 */
export const knotWidth =
  (W: number, knots: V2[]): HalfWidth =>
  (t) => {
    const u = clamp(t, 0, 1);
    for (let i = 1; i < knots.length; i++) {
      const [t0, f0] = knots[i - 1];
      const [t1, f1] = knots[i];
      if (u <= t1 || i === knots.length - 1) {
        const s = t1 > t0 ? clamp((u - t0) / (t1 - t0), 0, 1) : 1;
        return (W / 2) * Math.max(0, lerp(f0, f1, (1 - Math.cos(Math.PI * s)) / 2));
      }
    }
    return 0;
  };

/** A slit or bite cut from the leaf edge at fraction t; `depth` = fraction of the half-width that remains. */
export interface Notch {
  t: number;
  side: 1 | -1;
  depth: number;
  /** How far back (towards the base, as a fraction of the length) the cut reaches the midrib side. */
  back: number;
  /** Width of the cut along the margin (fraction of the length). */
  gap: number;
}

export interface BladeOpts {
  /** Panels along the midrib; more segments let the blade arch. */
  segs?: number;
  /** Extra tilt reached by the last segment (positive droops outwards). */
  bend?: number;
  roll?: number;
  /** Extra roll per segment. */
  twist?: number;
  /** Folds each half up by this angle (a shallow V along the midrib); doubles the panels. */
  fold?: number;
  thick?: number;
  /** Margin points per segment and side. */
  samples?: number;
  notches?: Notch[];
  /** Saw-toothed margin: every other edge point pushed out by this fraction. */
  teeth?: number;
  /** Wavy margin: the half-width swings by ±amp (fraction) `n` times along the blade. */
  wave?: { amp: number; n: number };
  /**
   * Basal lobes behind the leaf base (heart, arrow or shield shapes): they reach back `len`
   * (fraction of the blade length) and flare `flare` (fraction of the blade width) outwards;
   * `point` 0 = round heart lobes, 1 = sharp arrow lobes.
   */
  lobes?: { len: number; flare?: number; point?: number };
  /** Raised midrib rod. */
  rib?: { slot: string; r: number };
  plan?: boolean;
}

interface BladeSeg {
  base: V3;
  f: LeafFrame;
  len: number;
  t0: number;
  t1: number;
}

export interface Blade {
  parts: Part[];
  tip: V3;
  dir: V3;
  segs: BladeSeg[];
}

/**
 * A leaf blade `len` long with half-width profile `hw`, from `base`, pointing at azimuth `az` and
 * tilted `tilt` from vertical. Built as flat panels along the midrib (see BladeOpts).
 */
export function bladeLeaf(slot: string, base: V3, len: number, hw: HalfWidth, az: number, tilt: number, o: BladeOpts = {}): Blade {
  const segs = Math.max(1, Math.round(o.segs ?? 1));
  const n = o.samples ?? 6;
  const th = o.thick ?? 0.004;
  const width: HalfWidth = o.wave ? (t) => hw(t) * (1 + o.wave!.amp * Math.sin(o.wave!.n * Math.PI * t)) : hw;
  const parts: Part[] = [];
  const out: BladeSeg[] = [];
  let p = base;
  let f = leafFrame(az, tilt);
  const lobePts = (): V2[] => {
    if (!o.lobes) return [];
    const L = o.lobes.len * len;
    const w0 = width(0.02);
    const flare = (o.lobes.flare ?? 0.1) * w0 * 2;
    const q = lerp(0.8, 2.2, o.lobes.point ?? 0);
    // From the sinus (origin) back and out round the lobe to the blade edge at the base.
    return range(9).map((k) => {
      const u = k / 8;
      const x = lerp(0, w0, u) + flare * Math.sin(Math.PI * u);
      const z = -L * Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(u, 0.8))), 1 / q);
      return [x, z] as V2;
    });
  };
  for (const s of range(segs)) {
    const t0 = s / segs;
    const t1 = (s + 1) / segs;
    f = leafFrame(az, tilt + (o.bend ?? 0) * (segs > 1 ? s / (segs - 1) : 0), (o.roll ?? 0) + (o.twist ?? 0) * s);
    const zOf = (t: number) => (t - t0) * len;
    const edge = (sd: 1 | -1): V2[] => {
      const ns = (o.notches ?? []).filter((q) => q.side === sd && q.t - q.back > t0 + 0.02 && q.t + q.gap < t1 - 0.02).sort((a, b) => a.t - b.t);
      const events: { t: number; pts: V2[] }[] = [];
      for (const j of range(n + 1)) {
        const t = lerp(t0, t1, j / n);
        if (ns.some((q) => t > q.t - 0.004 && t < q.t + q.gap + 0.004)) continue;
        const tooth = o.teeth && j % 2 === 1 && j < n ? 1 + o.teeth : 1;
        events.push({ t, pts: [[width(t) * tooth, zOf(t)]] });
      }
      for (const q of ns) {
        events.push({
          t: q.t,
          pts: [
            [width(q.t), zOf(q.t)],
            [width(q.t) * q.depth, zOf(q.t - q.back)],
            [width(q.t + q.gap), zOf(q.t + q.gap)],
          ],
        });
      }
      return events.sort((a, b) => a.t - b.t).flatMap((e) => e.pts);
    };
    const lobes = s === 0 ? lobePts() : [];
    // Lobes meet the margin a little above the base (profiles may start at zero width).
    const joined = (pts: V2[]) => (lobes.length ? pts.filter(([, z]) => z >= 0.02 * len) : pts);
    // Overlap the joints a little so an arching blade reads as one piece.
    const stretch = (pts: V2[]) => (s < segs - 1 ? pts.map(([x, z]) => [x, z > 0 ? z * 1.04 : z] as V2) : pts);
    const right = stretch([...lobes, ...joined(edge(1))]);
    const left = stretch([...lobes, ...joined(edge(-1))]).map(([x, z]) => [-x, z] as V2);
    const isPlan = (o.plan ?? false) && s === 0;
    if (o.fold) {
      // Two halves meeting at the midrib, each tipped up by the fold angle.
      const zEnd = stretch([[0, zOf(t1)]])[0][1];
      const halfR = dedupe([[0, 0], ...right, [0, zEnd]]);
      const halfL = dedupe([[0, zEnd], ...[...left].reverse(), [0, 0]]);
      const fr = leafFrame(az, tilt + (o.bend ?? 0) * (segs > 1 ? s / (segs - 1) : 0), (o.roll ?? 0) + (o.twist ?? 0) * s + o.fold);
      const fl = leafFrame(az, tilt + (o.bend ?? 0) * (segs > 1 ? s / (segs - 1) : 0), (o.roll ?? 0) + (o.twist ?? 0) * s - o.fold);
      if (halfR.length >= 3) parts.push(leafPanel(slot, p, fr, halfR, th, isPlan, t0 * len));
      if (halfL.length >= 3) parts.push(leafPanel(slot, p, fl, halfL, th, false, t0 * len));
    } else {
      const outline = dedupe([...right, ...[...left].reverse()]);
      if (outline.length >= 3) parts.push(leafPanel(slot, p, f, outline, th, isPlan, t0 * len));
    }
    const end = vadd(p, vmul(f.L, len / segs));
    if (o.rib) parts.push(rod(o.rib.slot, vadd(p, vmul(f.N, th * 0.5)), vadd(end, vmul(f.N, th * 0.5)), o.rib.r * (1 - 0.6 * t0), { rTop: o.rib.r * (1 - 0.6 * t1), segments: 6, plan: false }));
    out.push({ base: p, f, len, t0, t1 });
    p = end;
  }
  return { parts, tip: p, dir: f.L, segs: out };
}

/** World point at fraction `t` along a blade's midrib, `x` across and `up` off its face. */
export function onBlade(b: Blade, t: number, x = 0, up = 0): { p: V3; f: LeafFrame } {
  const s = b.segs.find((q) => t <= q.t1 + 1e-9) ?? b.segs[b.segs.length - 1];
  const z = (t - s.t0) * s.len;
  return { p: vadd(vadd(vadd(s.base, vmul(s.f.L, z)), vmul(s.f.W, x)), vmul(s.f.N, up)), f: s.f };
}

/**
 * Leaflet outline between base points b0 → b1 on a spine, pointing at angle `beta` from +z
 * towards +x, `L` long and `lw` wide; `prof` = [fraction along, half-width fraction] pairs.
 */
export function leaflet(b0: V2, b1: V2, L: number, lw: number, beta: number, prof: V2[]): V2[] {
  const m: V2 = [(b0[0] + b1[0]) / 2, (b0[1] + b1[1]) / 2];
  const u: V2 = [Math.sin(beta), Math.cos(beta)];
  const nv: V2 = [Math.cos(beta), -Math.sin(beta)];
  const at = (a: number, w: number): V2 => [m[0] + u[0] * a * L + nv[0] * w, m[1] + u[1] * a * L + nv[1] * w];
  return [b0, ...prof.map(([a, w]) => at(a, w * lw)), at(1, 0), ...[...prof].reverse().map(([a, w]) => at(a, -w * lw)), b1];
}

export const LEAFLET_NARROW: V2[] = [[0.35, 0.5]];
export const LEAFLET_OVAL: V2[] = [
  [0.25, 0.42],
  [0.55, 0.5],
  [0.82, 0.3],
];

/** One side (x ≥ 0) of a pinnate frond segment [t0, t1] of a frond `total` long: a comb of leaflets. */
function combOutline(t0: number, t1: number, total: number, size: (t: number) => number, lw: number, spacing: number, beta: number, from: number): V2[] {
  const segLen = (t1 - t0) * total;
  const s = 0.002;
  const sp = Math.max(spacing, (lw * 1.2) / Math.sin(beta));
  const bw = Math.min(lw * 0.6, sp * 0.5);
  const pts: V2[] = [
    [0, 0],
    [s, 0],
  ];
  for (let z = Math.max(0, (from - t0) * total) + sp * 0.3; z + bw < segLen; z += sp) {
    const L = size(t0 + z / total);
    if (L < 0.004) continue;
    pts.push(...leaflet([s, z], [s, z + bw], L, lw, beta, LEAFLET_NARROW));
  }
  pts.push([s, segLen], [0, segLen]);
  return dedupe(pts);
}

export interface FrondOpts {
  segs: number;
  /** Extra tilt reached by the last segment (the arch). */
  bend: number;
  /** Leaflet length at fraction t of the frond. */
  leaflet: (t: number) => number;
  /** Leaflet width, spacing along the rachis, angle from the rachis. */
  lw: number;
  spacing: number;
  beta: number;
  /** Each side's comb is rolled up by this angle (a V-shaped frond). */
  vee: number;
  /** Bare stalk before the first leaflet (fraction of the frond). */
  from: number;
  rachis: number;
  /** Extra droop of the outer half of each comb. */
  plan?: boolean;
}

/** Pinnate palm frond: an arching rachis with a V of leaflet combs, built in `segs` pieces. */
export function pinnateFrond(leafSlot: string, ribSlot: string, base: V3, len: number, az: number, tilt: number, o: FrondOpts): Part[] {
  const parts: Part[] = [];
  let p = base;
  for (const s of range(o.segs)) {
    const t0 = s / o.segs;
    const t1 = (s + 1) / o.segs;
    const tl = tilt + o.bend * (o.segs > 1 ? s / (o.segs - 1) : 0);
    const f = leafFrame(az, tl);
    const end = vadd(p, vmul(f.L, len / o.segs));
    parts.push(rod(ribSlot, p, end, o.rachis * (1 - 0.5 * t0), { rTop: o.rachis * (1 - 0.5 * t1), segments: 6, plan: false }));
    if (t1 > o.from) {
      const comb = combOutline(t0, t1, len, o.leaflet, o.lw, o.spacing, o.beta, o.from);
      for (const sd of [1, -1] as const) {
        parts.push(leafPanel(leafSlot, p, leafFrame(az, tl, sd * o.vee), sd > 0 ? comb : comb.map(([x, z]) => [-x, z] as V2), 0.0025, (o.plan ?? false) && s === 0));
      }
    }
    p = end;
  }
  return parts;
}

/** Palmate (umbrella) leaf: `n` leaflets radiating from the origin over `spread` radians around +z. */
export function palmateOutline(n: number, L: number, lw: number, spread: number, hub: number, rand: () => number, prof: V2[] = LEAFLET_OVAL): V2[] {
  const step = spread / n;
  const w = Math.min(lw, 0.42 * L * step);
  const pts: V2[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const a = -spread / 2 + step * (i + 0.5);
    const db = step * 0.22;
    const len = L * (1 - (0.25 * Math.abs(a)) / Math.PI) * lerp(0.92, 1.05, rand());
    pts.push(...leaflet([Math.sin(a + db) * hub, Math.cos(a + db) * hub], [Math.sin(a - db) * hub, Math.cos(a - db) * hub], len, w, a, prof));
  }
  pts.push([0, -hub * 0.3]);
  return dedupe(pts);
}

/** Leafy sprig: a twig `len` long with leaves `ll` × `lw` on both sides and one at the tip (one flat piece). */
export function sprigOutline(len: number, ll: number, lw: number, beta: number, prof: V2[] = LEAFLET_OVAL): V2[] {
  const s = 0.0015;
  const sp = Math.max(ll * 0.5, (lw * 1.15) / Math.sin(beta));
  const bw = Math.min(lw * 0.35, sp * 0.4);
  const side = (off: number): V2[] => {
    const pts: V2[] = [];
    for (let z = len * 0.1 + off; z + bw < len * 0.8; z += sp) {
      const k = 1 - 0.3 * (z / len);
      pts.push(...leaflet([s, z], [s, z + bw], ll * k, lw * k, beta, prof));
    }
    return pts;
  };
  const tl = ll * 0.85;
  const right: V2[] = [[s, 0], ...side(0), [s, len]];
  const tip: V2[] = [
    [lw * 0.4, len + tl * 0.4],
    [0, len + tl],
    [-lw * 0.4, len + tl * 0.4],
  ];
  const left = [[s, 0] as V2, ...side(sp / 2), [s, len] as V2].map(([x, z]) => [-x, z] as V2).reverse();
  return dedupe([...right, ...tip, ...left]);
}

/** Ellipsoid `size` = [across, along, thick] oriented by a leaf frame (cactus pads, fleshy leaves). */
export function ellipsoid(slot: string, c: V3, f: LeafFrame, size: V3, opts?: { plan?: boolean }): Part {
  return sphere(slot, c, 0.5, { scale: size, rotation: euler(fromCols(f.W, f.L, f.N)), plan: opts?.plan ?? false });
}

/** Frame whose face normal is `n` (for panels facing a direction: spine stars, petals). */
export function facingFrame(n: V3): LeafFrame {
  const [az, tilt] = azTilt(n);
  const W = leafFrame(az, tilt).W;
  const N = vnorm(n);
  return { W, L: vcross(N, W), N };
}

/** Thin disc (coin leaf, pad, petal) of radius r centred at c and facing direction `n`. */
export function discFacing(slot: string, c: V3, n: V3, r: number, t: number, opts?: { segments?: number; scale?: V3; plan?: boolean }): Part {
  const [az, tilt] = azTilt(n);
  const f = leafFrame(az, tilt);
  return cyl(slot, c, r, t, { segments: opts?.segments ?? 14, rotation: euler(fromCols(f.W, f.L, f.N)), scale: opts?.scale, plan: opts?.plan ?? false });
}

/** Low-poly ball (a lathe with few segments): berries, pearls, buds, knots, pebbles. */
export function ball(slot: string, c: V3, r: number, opts?: { scale?: V3; segments?: number; plan?: boolean }): Part {
  const prof: V2[] = range(6).map((i) => {
    const a = -Math.PI / 2 + (i / 5) * Math.PI;
    return [Math.cos(a) * r, Math.sin(a) * r + r] as V2;
  });
  return lathe(slot, [c[0], c[1] - r, c[2]], prof, { segments: opts?.segments ?? 8, scale: opts?.scale, plan: opts?.plan ?? false });
}

/** A chain of rods along a polyline, tapering from r0 to r1 (stems, vines, aerial roots). */
export function stemPath(slot: string, pts: V3[], r0: number, r1 = r0, segments = 6): Part[] {
  return range(pts.length - 1).map((i) =>
    rod(slot, pts[i], pts[i + 1], lerp(r0, r1, i / Math.max(1, pts.length - 1)), { rTop: lerp(r0, r1, (i + 1) / Math.max(1, pts.length - 1)), segments, plan: false }),
  );
}

// ---------------------------------------------------------------------------
// Pots, stands and hangers
// ---------------------------------------------------------------------------

export type PotStyle = 'terracotta' | 'cylinder' | 'taper' | 'bowl' | 'egg' | 'footed' | 'basket' | 'cube' | 'hanging';

/** Lathe profiles as [radius, height] fractions, plus soil height and inner radius fractions. */
const POTS: Record<Exclude<PotStyle, 'cube'>, { prof: V2[]; soil: number; rIn: number }> = {
  // Classic flower pot with a thick rolled collar.
  terracotta: {
    prof: [[0, 0], [0.7, 0], [0.72, 0.015], [0.86, 0.76], [0.97, 0.775], [1, 0.8], [1, 0.985], [0.98, 1], [0.92, 1], [0.88, 0.86]],
    soil: 0.88,
    rIn: 0.88,
  },
  cylinder: { prof: [[0, 0], [0.88, 0], [0.9, 0.012], [0.96, 0.03], [1, 0.06], [1, 0.985], [0.985, 1], [0.93, 1], [0.93, 0.9]], soil: 0.92, rIn: 0.935 },
  taper: { prof: [[0, 0], [0.72, 0], [0.75, 0.02], [0.99, 0.97], [0.985, 1], [0.93, 1], [0.915, 0.9]], soil: 0.92, rIn: 0.92 },
  bowl: { prof: [[0, 0], [0.48, 0], [0.5, 0.05], [0.56, 0.08], [0.8, 0.3], [0.96, 0.66], [1, 0.96], [0.98, 1], [0.92, 1], [0.88, 0.8]], soil: 0.84, rIn: 0.9 },
  egg: { prof: [[0, 0], [0.46, 0], [0.5, 0.04], [0.84, 0.24], [1, 0.52], [0.95, 0.8], [0.84, 0.97], [0.82, 1], [0.76, 1], [0.77, 0.9]], soil: 0.92, rIn: 0.77 },
  footed: {
    prof: [[0, 0], [0.56, 0], [0.56, 0.07], [0.5, 0.1], [0.74, 0.22], [0.95, 0.6], [1, 0.98], [0.98, 1], [0.92, 1], [0.89, 0.88]],
    soil: 0.9,
    rIn: 0.9,
  },
  basket: { prof: [[0, 0], [0.86, 0], [0.9, 0.03], [1, 0.97], [0.93, 1], [0.92, 0.88]], soil: 0.9, rIn: 0.93 },
  hanging: { prof: [[0, 0], [0.34, 0], [0.36, 0.06], [0.7, 0.22], [0.94, 0.55], [1, 0.95], [0.98, 1], [0.92, 1], [0.9, 0.85]], soil: 0.86, rIn: 0.91 },
};

export interface Potted {
  parts: Part[];
  /** Soil surface height. */
  top: number;
  /** Radius (or half-side) of the soil surface. */
  rIn: number;
}

export interface PlanterOpts {
  /** Base height of the pot (on a stand). */
  y0?: number;
  saucer?: boolean;
  /** Woven baskets: room left to the footprint edge for rope handles. */
  handles?: number;
  /** Soil mound in the middle (fraction of the pot radius). */
  mound?: number;
}

/** Planter `r` (top radius or half side) by `h` with soil just below the rim. */
export function planter(potSlot: string, soilSlot: string, r: number, h: number, style: PotStyle, o: PlanterOpts = {}): Potted {
  const y0 = o.y0 ?? 0;
  const parts: Part[] = [];
  let top: number;
  let rIn: number;
  if (style === 'cube') {
    // Square planter with a chamfered lip and a recessed plinth.
    const t = clamp(r * 0.08, 0.008, 0.025);
    const plinth = Math.min(0.02, h * 0.06);
    parts.push(
      { shape: 'box', size: [r * 1.86, plinth, r * 1.86], position: [0, y0 + plinth / 2, 0], slot: potSlot },
      { shape: 'box', size: [2 * r, h - plinth, 2 * r], bevel: Math.min(0.01, r * 0.05), position: [0, y0 + plinth + (h - plinth) / 2, 0], slot: potSlot },
    );
    top = y0 + h - Math.min(0.025, h * 0.1);
    rIn = r - t;
    parts.push({ shape: 'box', size: [2 * rIn, 0.012, 2 * rIn], position: [0, top + 0.004, 0], slot: soilSlot, plan: false });
  } else {
    const spec = POTS[style];
    parts.push(lathe(potSlot, [0, y0, 0], spec.prof.map(([a, b]) => [a * r, b * h] as V2), { segments: 36 }));
    top = y0 + spec.soil * h;
    rIn = spec.rIn * r;
    parts.push(cyl(soilSlot, [0, top - 0.006, 0], rIn, 0.012, { segments: 28, plan: false }));
  }
  if (o.mound) parts.push(sphere(soilSlot, [0, top, 0], rIn * o.mound, { scale: [1, 0.18, 1], plan: false }));
  if (o.saucer && style !== 'cube') {
    const sh = clamp(h * 0.08, 0.012, 0.03);
    const sr = r * 0.96;
    parts.push(lathe(potSlot, [0, y0, 0], [[0, 0], [sr * 0.9, 0], [sr, sh], [sr * 0.95, sh], [sr * 0.86, sh * 0.35], [0, sh * 0.35]], { segments: 32, plan: false }));
  }
  if (style === 'basket') {
    // Rolled rim, woven bands and optional rope handles.
    parts.push(ring(potSlot, [0, y0 + h - 0.008, 0], r * 0.965, Math.min(0.011, r * 0.05), { plan: false }));
    for (const f of [0.18, 0.4, 0.62, 0.84]) parts.push(ring(potSlot, [0, y0 + h * f, 0], lerp(0.9, 1, f) * r - 0.002, Math.min(0.006, r * 0.03), { plan: false }));
    const rl = Math.min(0.045, ((o.handles ?? 0) - 0.008) / 1.3);
    if (rl > 0.012) for (const s of [-1, 1]) parts.push(torus(potSlot, [s * (r + rl * 0.2), y0 + h * 0.78, 0], rl, 0.0065, { rotation: [0, Math.PI / 2, 0], plan: false }));
  }
  if (style === 'terracotta') {
    // A faint throwing groove under the collar.
    parts.push(ring(potSlot, [0, y0 + h * 0.74, 0], r * 0.855, Math.min(0.004, r * 0.02), { plan: false }));
  }
  return { parts, top, rIn };
}

/**
 * Mid-century plant stand: a round tray `r` wide at height `y`, on `legs` splayed tapered legs
 * reaching the footprint radius `reach`.
 */
export function plantStand(slot: string, r: number, y: number, reach: number, legs = 4): Part[] {
  const t = clamp(r * 0.12, 0.012, 0.025);
  const parts: Part[] = [cyl(slot, [0, y - t / 2, 0], r, t, { segments: 32 })];
  parts.push(ring(slot, [0, y - t - 0.004, 0], r * 0.8, 0.008, { plan: false }));
  const leg = clamp(r * 0.1, 0.01, 0.02);
  for (const k of range(legs)) {
    const a = (k / legs) * TAU + Math.PI / 4;
    const foot = polar(Math.max(r * 0.8, reach - leg), a, leg * 0.5);
    const head = polar(r * 0.62, a, y - t);
    parts.push(rod(slot, foot, head, leg * 0.7, { rTop: leg, segments: 10 }));
  }
  return parts;
}

/**
 * Hanging cords from a ceiling ring at height `yTop` down to `n` points on a pot rim of radius
 * `r` at height `yRim`, with a gathered knot just above the pot (macramé style).
 */
export function hangingCords(slot: string, yTop: number, yRim: number, r: number, n = 3, cordR = 0.003): Part[] {
  const knotY = yRim + Math.min(0.12, (yTop - yRim) * 0.25);
  const parts: Part[] = [
    torus(slot, [0, yTop - 0.025, 0], 0.02, 0.004, { plan: false }),
    rod(slot, [0, yTop - 0.045, 0], [0, knotY, 0], cordR * 1.6, { segments: 6, plan: false }),
    ball(slot, [0, knotY, 0], cordR * 4),
  ];
  for (const k of range(n)) {
    const a = (k / n) * TAU + Math.PI / 2;
    const mid = polar(r * 0.75, a, lerp(knotY, yRim, 0.55));
    parts.push(rod(slot, [0, knotY, 0], mid, cordR, { segments: 5, plan: false }), rod(slot, mid, polar(r * 1.01, a, yRim), cordR, { segments: 5, plan: false }));
    parts.push(ball(slot, mid, cordR * 2.4));
  }
  return parts;
}

/** A few pebbles (top dressing) scattered on a soil disc of radius `rIn` at height y. */
export function pebbles(slot: string, rIn: number, y: number, n: number, size: number, seed: number): Part[] {
  const rand = rng(seed);
  return range(n).map(() => {
    const r = size * lerp(0.6, 1.2, rand());
    return ball(slot, polar((rIn - r) * Math.sqrt(rand()), rand() * TAU, y + r * 0.2), r, { scale: [1, 0.6, 0.85], segments: 6 });
  });
}

// ---------------------------------------------------------------------------
// Plan symbols
// ---------------------------------------------------------------------------

/** Scalloped canopy outline (plan symbol). */
export function canopyPlan(rx: number, rz = rx, lobes = 9): PlanStroke {
  const n = lobes * 4;
  return poly(
    range(n).map((i) => {
      const a = (i / n) * TAU;
      const k = 0.86 + 0.14 * Math.abs(Math.cos((i * Math.PI) / 4));
      return [Math.cos(a) * rx * k, Math.sin(a) * rz * k] as V2;
    }),
  );
}

/** Spiky star outline for rosettes of sword leaves (plan symbol). */
export function starPlan(r: number, n: number, inner = 0.45): PlanStroke {
  return poly(range(n * 2).map((i) => polar(i % 2 ? r * inner : r, (i / (n * 2)) * TAU)).map(([x, , z]) => [x, z] as V2));
}

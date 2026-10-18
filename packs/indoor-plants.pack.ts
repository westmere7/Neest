/**
 * Indoor plants — a greenhouse of potted houseplants, floor plants and table succulents.
 *
 * Every plant is built from botanically shaped leaves rather than blobs: flat leaf outlines
 * (prisms stood up and bent in segments along the midrib), strappy blades, broad leaves with
 * splits and lobes, rosettes, pinnate fronds of leaflets, palmate umbrellas and leafy sprigs.
 * Four procedural patterns give the surfaces their detail: leaf veins, variegated leaves,
 * terracotta with grog and speckled glazed ceramic.
 */
import {
  PLANT_SPECIES,
  box,
  circle,
  clamp,
  cyl,
  defineItem,
  definePack,
  lathe,
  leaf,
  lerp,
  matSlot,
  poly,
  prism,
  range,
  rectPoly,
  ring,
  rng,
  rod,
  span,
  sphere,
  torus,
  type Part,
  type PlanStroke,
  type Size3,
  type V2,
  type V3,
} from '@/packs/kit';

// ---------------------------------------------------------------------------
// Vector helpers
// ---------------------------------------------------------------------------

const TAU = Math.PI * 2;
/** Golden angle: successive leaves spiral round the stem without lining up. */
const GOLDEN = 2.39996;

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => mul(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1));
/** Unit vector at azimuth `az` (0 = +x, π/2 = +z), tilted `tilt` from straight up. */
const dirOf = (az: number, tilt: number): V3 => [Math.sin(tilt) * Math.cos(az), Math.cos(tilt), Math.sin(tilt) * Math.sin(az)];
/** Azimuth and tilt of a direction. */
function azTilt(v: V3): [number, number] {
  const u = norm(v);
  return [Math.atan2(u[2], u[0]), Math.acos(clamp(u[1], -1, 1))];
}
/** Point at radius `r` and azimuth `a` on the horizontal plane at height y. */
const polar = (r: number, a: number, y = 0): V3 => [Math.cos(a) * r, y, Math.sin(a) * r];

/** Point at fraction `t` (0–1) of the total length along a polyline. */
function along(pts: V3[], t: number): V3 {
  const segs = range(pts.length - 1).map((i) => Math.hypot(...sub(pts[i + 1], pts[i])));
  let rest = clamp(t, 0, 1) * segs.reduce((a, b) => a + b, 0);
  for (const [i, L] of segs.entries()) {
    if (rest <= L || i === segs.length - 1) return add(pts[i], mul(sub(pts[i + 1], pts[i]), L > 0 ? clamp(rest / L, 0, 1) : 0));
    rest -= L;
  }
  return pts[pts.length - 1];
}

type M3 = [V3, V3, V3];
/** Rotation matrix whose columns are the images of local x, y and z. */
const fromCols = (a: V3, b: V3, c: V3): M3 => [
  [a[0], b[0], c[0]],
  [a[1], b[1], c[1]],
  [a[2], b[2], c[2]],
];
const xform = (m: M3, v: V3): V3 => [dot(m[0], v), dot(m[1], v), dot(m[2], v)];
/** Three.js XYZ Euler angles of a rotation matrix. */
function euler(m: M3): V3 {
  const m13 = clamp(m[0][2], -1, 1);
  return Math.abs(m13) < 0.9999999
    ? [Math.atan2(-m[1][2], m[2][2]), Math.asin(m13), Math.atan2(-m[0][1], m[0][0])]
    : [Math.atan2(m[2][1], m[1][1]), Math.asin(m13), 0];
}

/** Leaf frame: L runs along the blade, W across it, N is the face normal (upper side). */
interface Frame {
  L: V3;
  W: V3;
  N: V3;
}

/** Frame of a blade pointing at azimuth `az`, tilted `tilt` from vertical and rolled `roll` about its midrib. */
function frameOf(az: number, tilt: number, roll = 0): Frame {
  const L = dirOf(az, tilt);
  const W0: V3 = [-Math.sin(az), 0, Math.cos(az)];
  const N0 = cross(W0, L);
  const c = Math.cos(roll);
  const s = Math.sin(roll);
  return { L, W: add(mul(W0, c), mul(N0, s)), N: add(mul(W0, -s), mul(N0, c)) };
}

// ---------------------------------------------------------------------------
// Fitting: keep every leaf inside the item box at any size
// ---------------------------------------------------------------------------

interface Lim {
  hx: number;
  hz: number;
  y1: number;
}
interface Bounds {
  min: V3;
  max: V3;
}

const limOf = ({ w, d, h }: Size3): Lim => ({ hx: w / 2, hz: d / 2, y1: h });
const half = ({ w, d }: Size3): number => Math.min(w, d) / 2;
const PAD = 0.004;

/** Euler XYZ rotation (three.js convention, R = Rx · Ry · Rz). */
function rotXYZ(v: V3, [ax, ay, az]: V3): V3 {
  let [x, y, z] = v;
  [x, y] = [x * Math.cos(az) - y * Math.sin(az), x * Math.sin(az) + y * Math.cos(az)];
  [x, z] = [x * Math.cos(ay) + z * Math.sin(ay), -x * Math.sin(ay) + z * Math.cos(ay)];
  [y, z] = [y * Math.cos(ax) - z * Math.sin(ax), y * Math.sin(ax) + z * Math.cos(ax)];
  return [x, y, z];
}

/** Conservative axis-aligned bounds of a part (same rule as the library checks). */
function partBounds(p: Part): Bounds {
  let lo: V3;
  let hi: V3;
  switch (p.shape) {
    case 'box':
      lo = mul(p.size, -0.5);
      hi = mul(p.size, 0.5);
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

function groupBounds(parts: Part[]): Bounds {
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
const scaleAbout = (parts: Part[], a: V3, k: number): Part[] =>
  parts.map((p) => ({ ...p, position: add(a, mul(sub(p.position, a), k)), scale: mul(p.scale ?? [1, 1, 1], k) }));

/** Shrinks a group (a leaf with its stalk, a frond…) about its base until it fits the box. */
function fitTo(parts: Part[], a: V3, lim: Lim, pad = PAD): Part[] {
  if (!parts.length) return parts;
  const b = groupBounds(parts);
  const lo: V3 = [-lim.hx + pad, 0, -lim.hz + pad];
  const hi: V3 = [lim.hx - pad, lim.y1 - pad, lim.hz - pad];
  let k = 1;
  for (const i of [0, 1, 2]) {
    if (b.max[i] > hi[i] && b.max[i] - a[i] > 1e-9) k = Math.min(k, (hi[i] - a[i]) / (b.max[i] - a[i]));
    if (b.min[i] < lo[i] && b.min[i] - a[i] < -1e-9) k = Math.min(k, (lo[i] - a[i]) / (b.min[i] - a[i]));
  }
  k = clamp(k, 0.05, 1);
  return k < 1 ? scaleAbout(parts, a, k) : parts;
}

/** Final guard: any part still poking out is pulled in and shrunk about its own centre. */
function contain(parts: Part[], lim: Lim): Part[] {
  return parts.flatMap((p) => {
    const b = partBounds(p);
    const e = 1e-6;
    if (b.min[0] >= -lim.hx - e && b.max[0] <= lim.hx + e && b.min[2] >= -lim.hz - e && b.max[2] <= lim.hz + e && b.min[1] >= -e && b.max[1] <= lim.y1 + e) return [p];
    const c: V3 = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
    const t: V3 = [clamp(c[0], -lim.hx + PAD, lim.hx - PAD), clamp(c[1], PAD, lim.y1 - PAD), clamp(c[2], -lim.hz + PAD, lim.hz - PAD)];
    const moved = t[0] !== c[0] || t[1] !== c[1] || t[2] !== c[2] ? { ...p, position: add(p.position, sub(t, c)) } : p;
    return fitTo([moved], t, lim, 0);
  });
}

// ---------------------------------------------------------------------------
// Leaf shapes
// ---------------------------------------------------------------------------

/** Removes repeated points (also across the closing edge) from an outline. */
function dedupe(pts: V2[]): V2[] {
  const out: V2[] = [];
  for (const p of pts) {
    const q = out[out.length - 1];
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-5) out.push(p);
  }
  while (out.length > 3 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) < 1e-5) out.pop();
  return out;
}

/**
 * Flat leaf panel: `outline` is [x across, z along the blade] in metres with the leaf's base at
 * the origin. A prism `t` thick is laid along the frame so the origin lands on `base`.
 */
function panel(slot: string, base: V3, f: Frame, outline: V2[], t: number, plan = false): Part {
  const xs = outline.map((p) => p[0]);
  const zs = outline.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  // Prism x → across, prism y (extrusion) → −normal, prism z → along the blade.
  const m = fromCols(f.W, mul(f.N, -1), f.L);
  const part: Part = {
    shape: 'prism',
    outline: outline.map(([x, z]) => [x - cx, z - cz] as V2),
    height: Math.max(0.002, t),
    position: add(base, xform(m, [cx, -t / 2, cz])),
    rotation: euler(m),
    slot,
  };
  if (!plan) part.plan = false;
  return part;
}

/** Half-width (metres) of a blade at fraction t (0 = base, 1 = tip) of its length. */
type HW = (t: number) => number;

/** Ovate / elliptic blade, widest at `peak`; `round` < 1 fills the shoulders, > 1 sharpens them. */
const ovate =
  (W: number, peak = 0.45, round = 0.75): HW =>
  (t) => {
    const u = t < peak ? (t / peak) * 0.5 : 0.5 + ((t - peak) / (1 - peak)) * 0.5;
    return (W / 2) * Math.pow(Math.max(0, Math.sin(Math.PI * clamp(u, 0, 1))), round);
  };

/** Strap / sword blade: parallel sides, tapering to a point from `tipFrom`. */
const strap =
  (W: number, tipFrom = 0.6, baseFrac = 0.7): HW =>
  (t) => {
    const b = t < 0.08 ? lerp(baseFrac, 1, t / 0.08) : 1;
    const tip = t > tipFrom ? Math.pow(Math.max(0, (1 - t) / (1 - tipFrom)), 0.85) : 1;
    return (W / 2) * b * tip;
  };

/** Fleshy succulent blade: a broad base tapering straight to a sharp point. */
const wedge =
  (W: number, shoulder = 0.25): HW =>
  (t) =>
    (W / 2) * (t < shoulder ? lerp(0.7, 1, t / shoulder) : Math.pow(Math.max(0, (1 - t) / (1 - shoulder)), 1.1));

/** Closed outline of a blade profile (single flat piece). */
function shapeOutline(hw: HW, len: number, n = 10): V2[] {
  const right = range(n + 1).map((j) => [hw(j / n), (j / n) * len] as V2);
  return dedupe([...right, ...right.map(([x, z]) => [-x, z] as V2).reverse()]);
}

/** A tear or lobe cut from the leaf edge at fraction t, `depth` = how much of the half-width remains. */
interface Notch {
  t: number;
  side: 1 | -1;
  depth: number;
  back: number;
  gap: number;
}

interface LeafOpts {
  /** Panels along the midrib; more segments let the blade arch. */
  segs?: number;
  /** Extra tilt reached by the last segment (positive droops outwards). */
  bend?: number;
  roll?: number;
  /** Extra roll per segment. */
  twist?: number;
  thick?: number;
  samples?: number;
  notches?: Notch[];
  /** Saw-toothed margin: every other edge point pushed out by this fraction. */
  teeth?: number;
  /** Raised midrib rod. */
  rib?: { slot: string; r: number };
  plan?: boolean;
}

interface LeafSeg {
  base: V3;
  f: Frame;
  len: number;
  t0: number;
  t1: number;
}

interface Leaf {
  parts: Part[];
  tip: V3;
  dir: V3;
  segs: LeafSeg[];
}

/**
 * A leaf blade of length `len` and half-width profile `hw` from `base`, pointing at azimuth `az`
 * and tilted `tilt` from vertical. Built as flat panels along the midrib so it can arch, twist,
 * carry tears/lobes and a raised midrib.
 */
function bladeLeaf(slot: string, base: V3, len: number, hw: HW, az: number, tilt: number, o: LeafOpts = {}): Leaf {
  const segs = Math.max(1, Math.round(o.segs ?? 1));
  const n = o.samples ?? 6;
  const th = o.thick ?? 0.004;
  const parts: Part[] = [];
  const out: LeafSeg[] = [];
  let p = base;
  let f = frameOf(az, tilt);
  for (const s of range(segs)) {
    const t0 = s / segs;
    const t1 = (s + 1) / segs;
    f = frameOf(az, tilt + (o.bend ?? 0) * (segs > 1 ? s / (segs - 1) : 0), (o.roll ?? 0) + (o.twist ?? 0) * s);
    const zOf = (t: number) => (t - t0) * len;
    const edge = (sd: 1 | -1): V2[] => {
      const ns = (o.notches ?? []).filter((q) => q.side === sd && q.t - q.back > t0 + 0.02 && q.t + q.gap < t1 - 0.02).sort((a, b) => a.t - b.t);
      const events: { t: number; pts: V2[] }[] = [];
      for (const j of range(n + 1)) {
        const t = lerp(t0, t1, j / n);
        if (ns.some((q) => t > q.t - 0.004 && t < q.t + q.gap + 0.004)) continue;
        const tooth = o.teeth && j % 2 === 1 && j < n ? 1 + o.teeth : 1;
        events.push({ t, pts: [[hw(t) * tooth, zOf(t)]] });
      }
      for (const q of ns) {
        events.push({
          t: q.t,
          pts: [
            [hw(q.t), zOf(q.t)],
            [hw(q.t) * q.depth, zOf(q.t - q.back)],
            [hw(q.t + q.gap), zOf(q.t + q.gap)],
          ],
        });
      }
      return events.sort((a, b) => a.t - b.t).flatMap((e) => e.pts);
    };
    const r = edge(1);
    const l = edge(-1)
      .map(([x, z]) => [-x, z] as V2)
      .reverse();
    let outline = dedupe([...r, ...l]);
    // Overlap the joints a little so the arching blade reads as one piece.
    if (s < segs - 1) outline = outline.map(([x, z]) => [x, z * 1.04] as V2);
    if (outline.length >= 3) parts.push(panel(slot, p, f, outline, th, (o.plan ?? false) && s === 0));
    const end = add(p, mul(f.L, len / segs));
    if (o.rib) parts.push(rod(o.rib.slot, add(p, mul(f.N, th * 0.5)), add(end, mul(f.N, th * 0.5)), o.rib.r * (1 - 0.6 * t0), { rTop: o.rib.r * (1 - 0.6 * t1), plan: false }));
    out.push({ base: p, f, len, t0, t1 });
    p = end;
  }
  return { parts, tip: p, dir: f.L, segs: out };
}

/** World point at fraction `t` along a leaf's midrib, `x` across and `up` off its face. */
function onLeaf(lf: Leaf, t: number, x = 0, up = 0): { p: V3; f: Frame } {
  const s = lf.segs.find((q) => t <= q.t1 + 1e-9) ?? lf.segs[lf.segs.length - 1];
  const z = (t - s.t0) * s.len;
  return { p: add(add(add(s.base, mul(s.f.L, z)), mul(s.f.W, x)), mul(s.f.N, up)), f: s.f };
}

/**
 * Leaflet outline between base points b0 → b1 on a spine, pointing at angle `beta` from +z
 * towards +x, `L` long and `lw` wide; `prof` = [fraction along, half-width fraction] pairs.
 */
function lens(b0: V2, b1: V2, L: number, lw: number, beta: number, prof: [number, number][]): V2[] {
  const m: V2 = [(b0[0] + b1[0]) / 2, (b0[1] + b1[1]) / 2];
  const u: V2 = [Math.sin(beta), Math.cos(beta)];
  const nv: V2 = [Math.cos(beta), -Math.sin(beta)];
  const at = (a: number, w: number): V2 => [m[0] + u[0] * a * L + nv[0] * w, m[1] + u[1] * a * L + nv[1] * w];
  return [b0, ...prof.map(([a, w]) => at(a, w * lw)), at(1, 0), ...[...prof].reverse().map(([a, w]) => at(a, -w * lw)), b1];
}

const NARROW: [number, number][] = [[0.35, 0.5]];
const OVAL: [number, number][] = [
  [0.25, 0.42],
  [0.55, 0.5],
  [0.82, 0.3],
];

/** One side (x ≥ 0) of a pinnate frond segment [t0, t1] of a frond `total` long: a comb of leaflets. */
function combOutline(t0: number, t1: number, total: number, leaflet: (t: number) => number, lw: number, spacing: number, beta: number, from: number): V2[] {
  const segLen = (t1 - t0) * total;
  const s = 0.002;
  const sp = Math.max(spacing, (lw * 1.2) / Math.sin(beta));
  const bw = Math.min(lw * 0.6, sp * 0.5);
  const pts: V2[] = [
    [0, 0],
    [s, 0],
  ];
  for (let z = Math.max(0, (from - t0) * total) + sp * 0.3; z + bw < segLen; z += sp) {
    const L = leaflet(t0 + z / total);
    if (L < 0.004) continue;
    pts.push(...lens([s, z], [s, z + bw], L, lw, beta, NARROW));
  }
  pts.push([s, segLen], [0, segLen]);
  return dedupe(pts);
}

/** Leafy sprig: a twig `len` long with oval leaves on both sides and one at the tip (one flat piece). */
function sprigOutline(len: number, ll: number, lw: number, beta: number): V2[] {
  const s = 0.0015;
  const sp = Math.max(ll * 0.5, (lw * 1.15) / Math.sin(beta));
  const bw = Math.min(lw * 0.35, sp * 0.4);
  const side = (off: number): V2[] => {
    const pts: V2[] = [];
    for (let z = len * 0.1 + off; z + bw < len * 0.8; z += sp) {
      const k = 1 - 0.3 * (z / len);
      pts.push(...lens([s, z], [s, z + bw], ll * k, lw * k, beta, OVAL));
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

/** Palmate (umbrella) leaf: `n` leaflets radiating from the origin over `spread` radians around +z. */
function palmateOutline(n: number, L: number, lw: number, spread: number, hub: number, rand: () => number, prof: [number, number][] = OVAL): V2[] {
  const step = spread / n;
  const w = Math.min(lw, 0.42 * L * step);
  const pts: V2[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const a = -spread / 2 + step * (i + 0.5);
    const db = step * 0.22;
    const len = L * (1 - (0.25 * Math.abs(a)) / Math.PI) * lerp(0.92, 1.05, rand());
    pts.push(...lens([Math.sin(a + db) * hub, Math.cos(a + db) * hub], [Math.sin(a - db) * hub, Math.cos(a - db) * hub], len, w, a, prof));
  }
  pts.push([0, -hub * 0.3]);
  return dedupe(pts);
}

/** Pinnate palm frond: arching rachis with a V of leaflet combs, built in `segs` pieces. */
function frond(
  leafSlot: string,
  ribSlot: string,
  base: V3,
  len: number,
  az: number,
  tilt: number,
  o: { segs: number; bend: number; leaflet: (t: number) => number; lw: number; spacing: number; beta: number; vee: number; from: number; rachis: number; plan?: boolean },
): Part[] {
  const parts: Part[] = [];
  let p = base;
  for (const s of range(o.segs)) {
    const t0 = s / o.segs;
    const t1 = (s + 1) / o.segs;
    const tl = tilt + o.bend * (o.segs > 1 ? s / (o.segs - 1) : 0);
    const f = frameOf(az, tl);
    const end = add(p, mul(f.L, len / o.segs));
    parts.push(rod(ribSlot, p, end, o.rachis * (1 - 0.5 * t0), { rTop: o.rachis * (1 - 0.5 * t1), plan: false }));
    const comb = combOutline(t0, t1, len, o.leaflet, o.lw, o.spacing, o.beta, o.from);
    for (const sd of [1, -1] as const) {
      parts.push(panel(leafSlot, p, frameOf(az, tl, sd * o.vee), sd > 0 ? comb : comb.map(([x, z]) => [-x, z] as V2), 0.003, (o.plan ?? false) && s === 0));
    }
    p = end;
  }
  return parts;
}

/** Disc (coin leaf, pad) of radius r facing direction `n`. */
function faceDisc(slot: string, c: V3, n: V3, r: number, t: number, plan = false): Part {
  const [az, tilt] = azTilt(n);
  const f = frameOf(az, tilt);
  return cyl(slot, c, r, t, { segments: 20, rotation: euler(fromCols(f.W, f.L, f.N)), plan });
}

/** Five-ish flat petals round a centre, facing up (small flowers). */
function flower(slot: string, eyeSlot: string, c: V3, petal: number, n: number, turn: number, tilt = 1.3): Part[] {
  return [
    ...range(n).map((i) => leaf(slot, c, petal, petal * 0.8, turn + (i * TAU) / n, tilt, { thick: Math.max(0.0015, petal * 0.15) })),
    sphere(eyeSlot, add(c, [0, petal * 0.15, 0]), petal * 0.28, { plan: false }),
  ];
}

// ---------------------------------------------------------------------------
// Pots
// ---------------------------------------------------------------------------

type PotStyle = 'clay' | 'cylinder' | 'taper' | 'bowl' | 'egg' | 'footed' | 'bucket' | 'basket';

/** Lathe profiles as [radius, height] fractions, soil height and inner radius fractions. */
const POTS: Record<PotStyle, { prof: V2[]; soil: number; rIn: number }> = {
  // Classic flower pot with a thick rolled collar.
  clay: {
    prof: [[0, 0], [0.7, 0], [0.72, 0.015], [0.87, 0.78], [0.98, 0.79], [1, 0.81], [1, 1], [0.92, 1], [0.87, 0.86]],
    soil: 0.88,
    rIn: 0.88,
  },
  cylinder: { prof: [[0, 0], [0.96, 0], [1, 0.025], [1, 1], [0.93, 1], [0.93, 0.9]], soil: 0.92, rIn: 0.935 },
  taper: { prof: [[0, 0], [0.74, 0], [0.76, 0.02], [1, 1], [0.93, 1], [0.915, 0.9]], soil: 0.92, rIn: 0.92 },
  bowl: { prof: [[0, 0], [0.5, 0], [0.52, 0.06], [0.8, 0.3], [0.97, 0.7], [1, 1], [0.92, 1], [0.88, 0.8]], soil: 0.84, rIn: 0.9 },
  egg: { prof: [[0, 0], [0.5, 0], [0.85, 0.25], [1, 0.55], [0.93, 0.82], [0.8, 1], [0.73, 1], [0.75, 0.9]], soil: 0.92, rIn: 0.76 },
  footed: {
    prof: [[0, 0], [0.56, 0], [0.56, 0.07], [0.5, 0.1], [0.74, 0.22], [0.95, 0.6], [1, 1], [0.92, 1], [0.89, 0.88]],
    soil: 0.9,
    rIn: 0.9,
  },
  bucket: { prof: [[0, 0], [0.8, 0], [0.82, 0.02], [1, 0.97], [0.95, 0.97], [0.93, 0.88]], soil: 0.9, rIn: 0.94 },
  basket: { prof: [[0, 0], [0.9, 0], [0.92, 0.02], [1, 1], [0.93, 1], [0.92, 0.88]], soil: 0.9, rIn: 0.93 },
};

interface Potted {
  parts: Part[];
  /** Soil surface height. */
  top: number;
  /** Radius of the soil surface. */
  rIn: number;
}

/** Round planter of top radius `r` and height `h` with soil (or gravel) just below the rim. */
function planter(potSlot: string, soilSlot: string, r: number, h: number, style: PotStyle, opts?: { saucer?: boolean; handles?: number }): Potted {
  const spec = POTS[style];
  const parts: Part[] = [lathe(potSlot, [0, 0, 0], spec.prof.map(([a, b]) => [a * r, b * h] as V2), { segments: 36 })];
  const top = spec.soil * h;
  const rIn = spec.rIn * r;
  parts.push(cyl(soilSlot, [0, top - 0.006, 0], rIn, 0.012, { segments: 28, plan: false }));
  if (opts?.saucer) {
    const sh = clamp(h * 0.08, 0.012, 0.03);
    const sr = r * 0.95;
    parts.push(lathe(potSlot, [0, 0, 0], [[0, 0], [sr * 0.92, 0], [sr, sh], [sr * 0.94, sh], [sr * 0.86, sh * 0.35], [0, sh * 0.35]], { segments: 32, plan: false }));
  }
  if (style === 'basket') {
    // Rolled rim and woven bands; optional rope handles (`handles` = room to the footprint edge).
    parts.push(ring(potSlot, [0, h - 0.008, 0], r * 0.965, Math.min(0.01, r * 0.05), { plan: false }));
    for (const f of [0.3, 0.62]) parts.push(ring(potSlot, [0, h * f, 0], lerp(0.92, 1, f) * r - 0.002, 0.005, { plan: false }));
    const rl = Math.min(0.04, ((opts?.handles ?? 0) - 0.008) / 1.3);
    if (rl > 0.012) for (const s of [-1, 1]) parts.push(ring(potSlot, [s * (r + rl * 0.25), h * 0.8, 0], rl, 0.006, { plan: false }));
  }
  if (style === 'bucket') {
    // Galvanised bucket: rolled rim and two little ear loops.
    const t = Math.min(0.008, r * 0.05);
    parts.push(ring(potSlot, [0, h * 0.97, 0], r * 0.985, t, { plan: false }));
    const er = Math.min(0.014, r * 0.12);
    for (const s of [-1, 1]) parts.push(torus(potSlot, [s * (r * 0.97), h * 0.82, 0], er, er * 0.22, { rotation: [0, Math.PI / 2, 0], plan: false }));
  }
  return { parts, top, rIn };
}

/** Square planter (four walls, a floor of soil) `sx` × `sz` and `h` tall. */
function boxPlanter(potSlot: string, soilSlot: string, sx: number, sz: number, h: number): Potted & { hx: number; hz: number } {
  const t = clamp(Math.min(sx, sz) * 0.08, 0.008, 0.03);
  const x = sx / 2;
  const z = sz / 2;
  const top = h - Math.min(0.02, h * 0.12);
  const b = Math.min(0.006, t * 0.4);
  return {
    parts: [
      span(potSlot, [-x, x], [0, h], [-z, -z + t], { bevel: b }),
      span(potSlot, [-x, x], [0, h], [z - t, z], { bevel: b }),
      span(potSlot, [-x, -x + t], [0, h], [-z + t, z - t], { bevel: b }),
      span(potSlot, [x - t, x], [0, h], [-z + t, z - t], { bevel: b }),
      span(soilSlot, [-x + t, x - t], [0.01, top], [-z + t, z - t], { plan: false }),
    ],
    top,
    rIn: Math.min(x, z) - t,
    hx: x - t,
    hz: z - t,
  };
}

/** A few pebbles scattered on a soil disc. */
function pebbles(slot: string, rIn: number, y: number, n: number, size: number, seed: number): Part[] {
  const rand = rng(seed);
  return range(n).map(() => {
    const r = size * lerp(0.6, 1.2, rand());
    return sphere(slot, polar((rIn - r) * Math.sqrt(rand()), rand() * TAU, y + r * 0.3), r, { scale: [1, 0.6, 0.85], plan: false });
  });
}

// ---------------------------------------------------------------------------
// Plan symbols
// ---------------------------------------------------------------------------

/** Scalloped canopy outline (plan symbol). */
function canopy(rx: number, rz = rx, lobes = 9): PlanStroke {
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
function starPlan(r: number, n: number, inner = 0.45): PlanStroke {
  return poly(range(n * 2).map((i) => polar(i % 2 ? r * inner : r, (i / (n * 2)) * TAU)).map(([x, , z]) => [x, z] as V2));
}

/** Rib-shaped star outline (cactus column cross-section) centred at (cx, cz). */
function ribOutline(cx: number, cz: number, R: number, ribs: number): V2[] {
  const step = TAU / ribs;
  const pts: V2[] = [];
  for (const k of range(ribs)) {
    const a = k * step;
    for (const [da, f] of [
      [-0.28, 0.93],
      [0, 1],
      [0.28, 0.93],
      [0.5, 0.76],
    ] as const) {
      pts.push([cx + Math.cos(a + da * step) * R * f, cz + Math.sin(a + da * step) * R * f]);
    }
  }
  return pts;
}

// ---------------------------------------------------------------------------
// Floor plants
// ---------------------------------------------------------------------------

const birdOfParadise = defineItem({
  id: 'plant-bird-of-paradise',
  name: 'Giant bird of paradise',
  category: 'plants',
  type: 'plants',
  group: 'Indoor plants',
  plant: PLANT_SPECIES['strelitzia-nicolai'],
  tags: ['bird of paradise', 'strelitzia', 'nicolai', 'houseplant', 'tropical', 'floor plant', 'big leaves'],
  description: 'A giant white bird of paradise with huge paddle leaves on tall stalks, many split by the wind, in a black glazed pot.',
  defaultSize: { w: 0.9, d: 0.9, h: 1.8 },
  minSize: { w: 0.5, d: 0.5, h: 1.0 },
  maxSize: { w: 1.6, d: 1.6, h: 2.6 },
  slots: [
    matSlot('pot', 'Pot', 'ceramic-black'),
    matSlot('soil', 'Soil', 'potting-soil'),
    matSlot('leaf', 'Leaves', 'leaf-strelitzia'),
    matSlot('stems', 'Stalks & midribs', 'stem-green'),
  ],
  build: (size) => {
    const { h } = size;
    const m = half(size);
    const lim = limOf(size);
    const pot = planter('pot', 'soil', m * 0.42, clamp(h * 0.2, 0.22, 0.42), 'cylinder');
    const parts: Part[] = [...pot.parts];
    const rand = rng(101);
    const n = clamp(Math.round(h * 5.5), 7, 13);
    const H = h - pot.top;
    for (const i of range(n)) {
      // Two crossing fans of paddle leaves on tall stalks, the signature strelitzia silhouette.
      const fan = lerp(-0.45, 0.45, i / (n - 1)) + (rand() - 0.5) * 0.1;
      const az = (i % 2 ? 1.25 : 0) + (fan >= 0 ? 0 : Math.PI) + (rand() - 0.5) * 0.4;
      const tilt = Math.abs(fan) * 0.85 + 0.04;
      const base = polar(pot.rIn * 0.25 * rand(), rand() * TAU, pot.top);
      const top = add(base, mul(dirOf(az, tilt), H * lerp(0.4, 0.56, rand()) * (1 - Math.abs(fan) * 0.3)));
      const bl = clamp(H * 0.4, 0.3, 0.9) * lerp(0.85, 1.05, rand());
      const notches: Notch[] = range(2 + Math.floor(rand() * 3)).map(() => ({
        t: lerp(0.2, 0.85, rand()),
        side: rand() < 0.5 ? 1 : -1,
        depth: lerp(0.05, 0.3, rand()),
        back: 0.02,
        gap: 0.006,
      }));
      const blade = bladeLeaf('leaf', top, bl, ovate(bl * 0.36, 0.45, 0.45), az + (rand() - 0.5) * 0.2, tilt + lerp(0.05, 0.25, rand()), {
        segs: 2,
        bend: lerp(0.1, 0.3, rand()),
        roll: (rand() - 0.5) * 0.6,
        thick: 0.005,
        samples: 7,
        notches,
        rib: { slot: 'stems', r: 0.006 },
        plan: i === 0 || i === n - 1,
      });
      parts.push(...fitTo([rod('stems', base, top, 0.012, { rTop: 0.009, plan: false }), ...blade.parts], base, lim));
    }
    // A new leaf unfurling from the centre and papery sheaths at the base.
    parts.push(rod('leaf', [0, pot.top, 0], [0.02, pot.top + H * 0.5, 0.01], 0.012, { rTop: 0.003, plan: false }));
    for (const k of range(3)) parts.push(rod('stems', polar(0.02, k * 2.1, pot.top), polar(0.03, k * 2.1, pot.top + H * 0.12), 0.016, { rTop: 0.008, plan: false }));
    return contain(parts, lim);
  },
  planDetail: (size) => [circle([0, 0], half(size) * 0.42), canopy(size.w * 0.46, size.d * 0.4, 7)],
});

const rubberPlant = defineItem({
  id: 'plant-rubber',
  name: 'Burgundy rubber plant',
  category: 'plants',
  type: 'plants',
  group: 'Indoor plants',
  plant: PLANT_SPECIES['ficus-elastica-burgundy'],
  tags: ['rubber plant', 'ficus elastica', 'burgundy', 'houseplant', 'glossy leaves', 'floor plant'],
  description: 'A burgundy rubber plant with big glossy, near-black red leaves and pink new-leaf sheaths, in a matte white pot.',
  defaultSize: { w: 0.6, d: 0.6, h: 1.4 },
  minSize: { w: 0.35, d: 0.35, h: 0.7 },
  maxSize: { w: 1.0, d: 1.0, h: 2.2 },
  slots: [
    matSlot('pot', 'Pot', 'ceramic-matte-white'),
    matSlot('leaf', 'Leaves', 'leaf-burgundy'),
    matSlot('stem', 'Stems & soil', 'bark-brown'),
    matSlot('sheath', 'New-leaf sheaths', 'sheath-red'),
  ],
  build: (size) => {
    const { h } = size;
    const m = half(size);
    const lim = limOf(size);
    const pot = planter('pot', 'stem', m * 0.48, clamp(h * 0.22, 0.18, 0.38), 'taper');
    const parts: Part[] = [...pot.parts];
    const rand = rng(202);
    const stems: V3[][] = [
      [[0.01, pot.top, 0], [-0.012, lerp(pot.top, h, 0.5), 0.008], [0.004, h * 0.86, -0.004]],
      [[pot.rIn * 0.3, pot.top, 0.02], [pot.rIn * 0.45, lerp(pot.top, h, 0.32), 0.03], [m * 0.2, h * 0.62, m * 0.06]],
    ];
    const Lb = clamp(h * 0.2, 0.14, 0.34);
    for (const [k, path] of stems.entries()) {
      const r = k === 0 ? 0.014 : 0.011;
      parts.push(rod('stem', path[0], path[1], r, { rTop: r * 0.85, plan: false }), rod('stem', path[1], path[2], r * 0.85, { rTop: r * 0.6, plan: false }));
      const stemLen = path[2][1] - path[0][1];
      const n = clamp(Math.round(stemLen * 11), 5, 14);
      for (const j of range(n)) {
        const frac = j / (n - 1);
        const P = along(path, lerp(0.22, 0.97, frac));
        const az = j * GOLDEN + k * 1.3 + rand() * 0.3;
        const tilt = lerp(1.35, 0.55, frac) + (rand() - 0.5) * 0.3;
        const Q = add(P, mul(dirOf(az, Math.min(1.2, tilt)), 0.035));
        const len = Lb * lerp(0.8, 1.05, rand()) * (1 - 0.35 * frac * frac);
        const blade = bladeLeaf('leaf', Q, len, ovate(len * 0.5, 0.48, 0.6), az, tilt, {
          segs: 2,
          bend: lerp(0.15, 0.4, rand()),
          roll: (rand() - 0.5) * 0.5,
          thick: 0.005,
          samples: 7,
          plan: k === 0 && j < 2,
        });
        parts.push(...fitTo([rod('leaf', P, Q, 0.004, { plan: false }), ...blade.parts], P, lim));
      }
      // Glossy red sheath wrapping the next leaf at the growing tip.
      const tip = path[2];
      parts.push(...fitTo([rod('sheath', tip, add(tip, [0.005, Lb * 0.35, 0]), 0.009, { rTop: 0.0015, plan: false })], tip, lim));
    }
    return contain(parts, lim);
  },
  planDetail: (size) => [circle([0, 0], half(size) * 0.48), canopy(half(size) * 0.8)],
});

const zzPlant = defineItem({
  id: 'plant-zz',
  name: "ZZ plant 'Raven'",
  category: 'plants',
  type: 'plants',
  group: 'Indoor plants',
  plant: PLANT_SPECIES['zamioculcas-raven'],
  tags: ['zz plant', 'zamioculcas', 'zanzibar gem', 'houseplant', 'low light', 'glossy leaves'],
  description: "ZZ plant 'Raven' with upright stalks of glossy near-black leaflets, in a speckled stoneware pot.",
  defaultSize: { w: 0.55, d: 0.55, h: 0.8 },
  minSize: { w: 0.3, d: 0.3, h: 0.4 },
  maxSize: { w: 0.9, d: 0.9, h: 1.2 },
  slots: [
    matSlot('pot', 'Pot', 'speckled-stoneware'),
    matSlot('soil', 'Soil', 'potting-soil'),
    matSlot('leaf', 'Leaflets', 'leaf-raven'),
    matSlot('stalk', 'Stalks', 'stem-dark'),
  ],
  build: (size) => {
    const { h } = size;
    const m = half(size);
    const lim = limOf(size);
    const pot = planter('pot', 'soil', m * 0.5, clamp(h * 0.3, 0.12, 0.3), 'egg');
    const parts: Part[] = [...pot.parts];
    const rand = rng(303);
    const N = clamp(Math.round(m * 28), 6, 10);
    const pairs = clamp(Math.floor(96 / N / 2), 3, 6);
    for (const i of range(N)) {
      // Upright, slightly arching stalks with a swollen base and glossy paired leaflets.
      const az = i * GOLDEN + rand() * 0.4;
      const base = polar(pot.rIn * 0.35 * Math.sqrt(rand()), az, pot.top);
      const tilt = lerp(0.08, 0.5, rand());
      const len = (h - pot.top) * lerp(0.75, 1, rand());
      const p1 = add(base, mul(dirOf(az, tilt), len * 0.5));
      const p2 = add(p1, mul(dirOf(az, tilt + 0.35), len * 0.5));
      const path = [base, p1, p2];
      const group: Part[] = [
        sphere('stalk', add(base, [0, 0.012, 0]), 0.016, { scale: [1, 1.7, 1], plan: false }),
        rod('stalk', base, p1, 0.011, { rTop: 0.008, plan: false }),
        rod('stalk', p1, p2, 0.008, { rTop: 0.004, plan: false }),
      ];
      const ll = clamp(len * 0.14, 0.03, 0.09);
      for (const j of range(pairs)) {
        const t = lerp(0.38, 0.92, j / (pairs - 1));
        const P = along(path, t);
        const D = t < 0.5 ? dirOf(az, tilt) : dirOf(az, tilt + 0.35);
        const S = norm(cross([0, 1, 0], D));
        for (const sd of [1, -1]) {
          const [la, lt] = azTilt(add(add(mul(D, 0.75), mul(S, sd * 0.8)), [0, 0.1, 0]));
          const len2 = ll * lerp(0.85, 1.05, rand()) * (1 - 0.3 * Math.abs(t - 0.65));
          group.push(...bladeLeaf('leaf', P, len2, ovate(len2 * 0.48, 0.5, 0.7), la, lt, { roll: (rand() - 0.5) * 0.6, thick: 0.003 }).parts);
        }
      }
      group.push(...bladeLeaf('leaf', p2, ll * 0.9, ovate(ll * 0.42, 0.5, 0.7), az, tilt + 0.5, { thick: 0.003 }).parts);
      parts.push(...fitTo(group, base, lim));
    }
    return contain(parts, lim);
  },
  planDetail: (size) => [circle([0, 0], half(size) * 0.5), canopy(half(size) * 0.85)],
});

const peaceLily = defineItem({
  id: 'plant-peace-lily',
  name: "Peace lily 'Sensation'",
  category: 'plants',
  type: 'plants',
  group: 'Indoor plants',
  plant: PLANT_SPECIES['spathiphyllum-sensation'],
  tags: ['peace lily', 'spathiphyllum', 'white flowers', 'houseplant', 'air purifying'],
  description: "Peace lily 'Sensation', a large variety with broad ribbed dark leaves and white spathes, in a blue glazed pot.",
  defaultSize: { w: 0.85, d: 0.85, h: 1.1 },
  minSize: { w: 0.3, d: 0.3, h: 0.4 },
  maxSize: { w: 1.3, d: 1.3, h: 1.6 },
  slots: [
    matSlot('pot', 'Pot', 'glazed-blue'),
    matSlot('leaf', 'Leaves & moss', 'leaf-glossy-dark'),
    matSlot('flower', 'Spathes', 'spathe-white'),
    matSlot('spadix', 'Spadix', 'spadix-cream'),
  ],
  build: (size) => {
    const { h } = size;
    const m = half(size);
    const lim = limOf(size);
    const pot = planter('pot', 'leaf', m * 0.5, clamp(h * 0.32, 0.12, 0.3), 'footed');
    const parts: Part[] = [...pot.parts];
    const rand = rng(404);
    const H = h - pot.top;
    const N = clamp(Math.round(m * 55), 12, 22);
    for (const i of range(N)) {
      const az = i * GOLDEN;
      const base = polar(pot.rIn * 0.3 * Math.sqrt(rand()), rand() * TAU, pot.top);
      const tiltP = lerp(0.15, 0.75, rand());
      const P = add(base, mul(dirOf(az, tiltP), H * lerp(0.25, 0.4, rand())));
      const bl = clamp(H * 0.42, 0.1, 0.38) * lerp(0.8, 1.05, rand());
      const blade = bladeLeaf('leaf', P, bl, ovate(bl * 0.4, 0.42, 0.8), az, tiltP + lerp(0.25, 0.55, rand()), {
        segs: 2,
        bend: lerp(0.3, 0.7, rand()),
        roll: (rand() - 0.5) * 0.6,
        thick: 0.004,
        plan: i < 3,
      });
      parts.push(...fitTo([rod('leaf', base, P, 0.004, { plan: false }), ...blade.parts], base, lim));
    }
    // White spathes on tall stalks, each hooding a creamy spadix.
    const F = clamp(Math.round(m * 9), 2, 5);
    const sl = clamp(h * 0.16, 0.06, 0.16);
    for (const i of range(F)) {
      const az = (i / F) * TAU + rand() * 0.8;
      const tilt = lerp(0.05, 0.3, rand());
      const base = polar(pot.rIn * 0.2 * rand(), rand() * TAU, pot.top);
      const S = add(base, mul(dirOf(az, tilt), (h * lerp(0.9, 0.97, rand()) - sl - pot.top) / Math.cos(tilt)));
      const spathe = bladeLeaf('flower', S, sl, ovate(sl * 0.6, 0.4, 0.6), az, tilt + 0.15, { segs: 2, bend: -0.25, thick: 0.004 });
      const f0 = spathe.segs[0].f;
      const sgn = dot(f0.N, dirOf(az, Math.PI / 2)) >= 0 ? 1 : -1;
      const sb = add(add(S, mul(f0.N, sgn * 0.012)), mul(f0.L, sl * 0.08));
      parts.push(
        ...fitTo(
          [rod('leaf', base, S, 0.0035, { plan: false }), ...spathe.parts, rod('spadix', sb, add(sb, mul(dirOf(az, tilt), sl * 0.42)), 0.008, { rTop: 0.005, plan: false })],
          base,
          lim,
        ),
      );
    }
    return contain(parts, lim);
  },
  planDetail: (size) => [circle([0, 0], half(size) * 0.5), canopy(half(size) * 0.85)],
});

const arecaPalm = defineItem({
  id: 'plant-areca-palm',
  name: 'Areca palm',
  category: 'plants',
  type: 'plants',
  group: 'Indoor plants',
  plant: PLANT_SPECIES['dypsis-lutescens'],
  tags: ['areca palm', 'butterfly palm', 'dypsis', 'palm', 'fronds', 'tropical', 'floor plant'],
  description: 'An areca palm with clustered yellow-green canes and feathery arching fronds, in a woven basket.',
  defaultSize: { w: 0.9, d: 0.9, h: 1.7 },
  minSize: { w: 0.5, d: 0.5, h: 0.9 },
  maxSize: { w: 1.6, d: 1.6, h: 2.6 },
  slots: [
    matSlot('pot', 'Basket', 'woven-basket'),
    matSlot('soil', 'Soil', 'potting-soil'),
    matSlot('leaf', 'Fronds', 'leaf-palm'),
    matSlot('cane', 'Canes', 'cane-gold'),
  ],
  build: (size) => {
    const { h } = size;
    const m = half(size);
    const lim = limOf(size);
    const pr = m * 0.42;
    const pot = planter('pot', 'soil', pr, clamp(h * 0.2, 0.2, 0.42), 'basket', { handles: m - pr });
    const parts: Part[] = [...pot.parts];
    const rand = rng(505);
    const C = clamp(Math.round(m * 14), 4, 8);
    const tops: [V3, number][] = [];
    for (const k of range(C)) {
      // Clustered golden canes, each topped by arching feathery fronds.
      const az = k * GOLDEN;
      const base = polar(pot.rIn * 0.45 * Math.sqrt(rand()), rand() * TAU, pot.top);
      const top = add(base, mul(dirOf(az, lerp(0.05, 0.3, rand())), (h - pot.top) * lerp(0.2, 0.42, rand())));
      parts.push(rod('cane', base, top, 0.013, { rTop: 0.01, plan: false }), ring('cane', add(base, [0, (top[1] - base[1]) * 0.5, 0]), 0.012, 0.003, { plan: false }));
      tops.push([top, az]);
    }
    const F = clamp(C + 4, 8, 12);
    for (const f of range(F)) {
      const [top, caz] = tops[f % C];
      const az = caz + (f >= C ? Math.PI * 0.6 : 0) + (rand() - 0.5) * 0.6;
      const len = (h - top[1]) * lerp(0.95, 1.15, rand());
      const Lmax = len * 0.26;
      const fr = frond('leaf', 'cane', top, len, az, lerp(0.1, 0.4, rand()), {
        segs: 3,
        bend: lerp(0.6, 1.0, rand()),
        leaflet: (t) => Lmax * Math.pow(Math.sin(Math.PI * clamp((t - 0.1) / 0.95, 0, 1)), 0.6) * (1 - 0.45 * t),
        lw: clamp(len * 0.025, 0.01, 0.025),
        spacing: len / 26,
        beta: 0.6,
        vee: 0.5,
        from: 0.12,
        rachis: 0.006,
        plan: f < 3,
      });
      parts.push(...fitTo(fr, top, lim));
    }
    return contain(parts, lim);
  },
  planDetail: (size) => [circle([0, 0], half(size) * 0.42), canopy(half(size) * 0.92, half(size) * 0.92, 11)],
});

const yuccaCane = defineItem({
  id: 'plant-yucca',
  name: 'Yucca cane',
  category: 'plants',
  type: 'plants',
  group: 'Indoor plants',
  plant: PLANT_SPECIES['yucca-gigantea'],
  tags: ['yucca', 'yucca cane', 'spineless yucca', 'elephantipes', 'houseplant', 'floor plant', 'sword leaves'],
  description: 'A spineless yucca: three bark canes of different heights topped with rosettes of sword leaves, in a concrete planter.',
  defaultSize: { w: 0.6, d: 0.6, h: 1.6 },
  minSize: { w: 0.35, d: 0.35, h: 0.8 },
  maxSize: { w: 1.0, d: 1.0, h: 2.4 },
  slots: [
    matSlot('pot', 'Planter', 'concrete-planter'),
    matSlot('soil', 'Top dressing', 'gravel-top'),
    matSlot('leaf', 'Leaves', 'leaf-sword'),
    matSlot('trunk', 'Canes', 'yucca-bark'),
  ],
  build: (size) => {
    const { h } = size;
    const m = half(size);
    const lim = limOf(size);
    const s = m * 1.24;
    const pot = boxPlanter('pot', 'soil', s, s, clamp(h * 0.22, 0.2, 0.4));
    const parts: Part[] = [...pot.parts];
    const rand = rng(606);
    const H = h - pot.top;
    const heads = h >= 1.1 ? 3 : 2;
    const n = clamp(Math.round(m * 55), 12, 20);
    const Ly = Math.min(clamp(H * 0.28, 0.15, 0.45), m * 0.8);
    for (const k of range(heads)) {
      // Thick cut canes of staggered heights, each sprouting a spiky rosette.
      const az = (k * TAU) / heads + 0.5;
      const rc = clamp(m * 0.1, 0.025, 0.05) * (1 - k * 0.1);
      const base = polar(pot.rIn * 0.4, az, pot.top);
      const T = add(base, mul(dirOf(az, 0.08), H * [0.55, 0.38, 0.24][k]));
      parts.push(
        rod('trunk', base, T, rc, { rTop: rc * 0.85, plan: false }),
        cyl('trunk', T, rc * 0.8, 0.012, { plan: false }),
        ...[0.3, 0.6].map((f) => ring('trunk', along([base, T], f), rc * 0.95, 0.004, { plan: false })),
      );
      const sb = add(T, [0, -0.04, 0]);
      const st = add(sb, mul(dirOf(az + 0.4, 0.5), Math.min(0.09, H * 0.08)));
      const head: Part[] = [rod('trunk', sb, st, rc * 0.5, { rTop: rc * 0.4, plan: false })];
      for (const j of range(n)) {
        const frac = j / (n - 1);
        const tilt = lerp(0.12, 1.55, Math.pow(frac, 0.8)) + (rand() - 0.5) * 0.15;
        const len = Ly * lerp(0.75, 1, rand());
        const droop = tilt > 1.1;
        head.push(
          ...bladeLeaf('leaf', st, len, strap(clamp(Ly * 0.1, 0.018, 0.04), 0.55, 0.6), j * GOLDEN + k, tilt, {
            segs: droop ? 2 : 1,
            bend: droop ? 0.35 : 0,
            roll: (rand() - 0.5) * 0.4,
            thick: 0.004,
            plan: j === n - 1,
          }).parts,
        );
      }
      parts.push(...fitTo(head, st, lim));
    }
    return contain(parts, lim);
  },
  planDetail: (size) => {
    const s = half(size) * 1.24;
    return [rectPoly(-s / 2, -s / 2, s / 2, s / 2), starPlan(half(size) * 0.92, 12, 0.6)];
  },
});

const dragonTree = defineItem({
  id: 'plant-dracaena',
  name: 'Dragon tree (dracaena)',
  category: 'plants',
  type: 'plants',
  group: 'Trees',
  plant: PLANT_SPECIES['dracaena-marginata'],
  tags: ['dragon tree', 'dracaena', 'marginata', 'houseplant', 'indoor tree', 'spiky'],
  description: 'A dragon tree with slender bare stems topped by tufts of narrow red-edged leaves, in a concrete planter.',
  defaultSize: { w: 0.6, d: 0.6, h: 1.7 },
  minSize: { w: 0.35, d: 0.35, h: 0.8 },
  maxSize: { w: 1.0, d: 1.0, h: 2.4 },
  slots: [
    matSlot('pot', 'Pot', 'concrete-planter'),
    matSlot('leaf', 'Leaves', 'leaf-dracaena'),
    matSlot('edge', 'Red-edged leaves', 'leaf-red-edge'),
    matSlot('trunk', 'Stems & soil', 'bark-grey'),
  ],
  build: (size) => {
    const { h } = size;
    const m = half(size);
    const lim = limOf(size);
    const pot = planter('pot', 'trunk', m * 0.45, clamp(h * 0.24, 0.2, 0.42), 'cylinder');
    const parts: Part[] = [...pot.parts];
    const rand = rng(707);
    const S = h > 1.2 ? 4 : 3;
    const n = clamp(Math.round(m * 60), 14, 20);
    const Lh = Math.min(clamp(h * 0.2, 0.14, 0.42), m * 0.75);
    for (const k of range(S)) {
      // Thin bendy stems ending in pom-poms of narrow, red-margined leaves.
      const az = (k * TAU) / S + 0.3;
      const p0 = polar(pot.rIn * 0.35, az, pot.top);
      const yTop = lerp(pot.top, h - Lh * 0.95, [1, 0.8, 0.62, 0.48][k]);
      const pT = polar(Math.max(0, m - Lh * 0.95) * lerp(0.5, 1, rand()), az, yTop);
      const p1 = add(add(p0, mul(sub(pT, p0), 0.35)), polar(m * 0.12, az + 1.8));
      const p2 = add(add(p0, mul(sub(pT, p0), 0.7)), polar(m * 0.1, az - 1.2));
      const pts = [p0, p1, p2, pT];
      for (const i of range(3)) parts.push(rod('trunk', pts[i], pts[i + 1], 0.014 - i * 0.002, { rTop: 0.012 - i * 0.002, plan: false }));
      const head: Part[] = [];
      for (const j of range(n)) {
        const tilt = Math.acos(lerp(0.95, -0.55, j / (n - 1))) + (rand() - 0.5) * 0.2;
        const len = Lh * lerp(0.8, 1.05, rand());
        head.push(
          ...bladeLeaf(j % 3 === 1 ? 'edge' : 'leaf', pT, len, strap(clamp(Lh * 0.055, 0.008, 0.016), 0.5, 0.8), j * GOLDEN + k, tilt, {
            segs: tilt > 1.6 ? 2 : 1,
            bend: 0.4,
            roll: (rand() - 0.5) * 0.8,
            thick: 0.003,
            plan: j === n - 1,
          }).parts,
        );
      }
      parts.push(...fitTo(head, pT, lim));
    }
    return contain(parts, lim);
  },
  planDetail: (size) => [circle([0, 0], half(size) * 0.45), canopy(half(size) * 0.8, half(size) * 0.8, 6)],
});

const elephantEar = defineItem({
  id: 'plant-alocasia',
  name: 'Giant elephant ear (alocasia)',
  category: 'plants',
  type: 'plants',
  group: 'Indoor plants',
  plant: PLANT_SPECIES['alocasia-macrorrhizos'],
  tags: ['elephant ear', 'alocasia', 'arrow leaves', 'houseplant', 'tropical', 'big leaves', 'veins'],
  description: 'A giant elephant ear with huge arrow-shaped leaves on tall stalks, in a matte white pot.',
  defaultSize: { w: 0.8, d: 0.8, h: 1.3 },
  minSize: { w: 0.45, d: 0.45, h: 0.6 },
  maxSize: { w: 1.4, d: 1.4, h: 2.2 },
  slots: [
    matSlot('pot', 'Pot', 'ceramic-matte-white'),
    matSlot('soil', 'Soil', 'potting-soil'),
    matSlot('leaf', 'Leaves', 'leaf-alocasia'),
    matSlot('veins', 'Veins & stalks', 'vein-pale'),
  ],
  build: (size) => {
    const { h } = size;
    const m = half(size);
    const lim = limOf(size);
    const pot = planter('pot', 'soil', m * 0.42, clamp(h * 0.26, 0.18, 0.38), 'cylinder');
    const parts: Part[] = [...pot.parts];
    const rand = rng(808);
    const H = h - pot.top;
    const N = clamp(Math.round(h * 4.5), 4, 8);
    // Right half of an arrow-shaped (sagittate) blade, attached at the origin; tip at z = 1.
    const halfShape: V2[] = [
      [0, -0.06],
      [0.11, -0.2],
      [0.22, -0.33],
      [0.34, -0.2],
      [0.38, -0.02],
      [0.36, 0.15],
      [0.3, 0.35],
      [0.2, 0.58],
      [0.1, 0.8],
      [0, 1],
    ];
    const laterals: [V2, V2][] = [
      [[0, -0.02], [0.33, 0.12]],
      [[0, 0.18], [0.27, 0.38]],
      [[0, 0.42], [0.16, 0.62]],
      [[0, -0.04], [0.2, -0.3]],
    ];
    for (const i of range(N)) {
      const az = i * GOLDEN + 0.4;
      const base = polar(pot.rIn * 0.3 * Math.sqrt(rand()), rand() * TAU, pot.top);
      const tiltP = lerp(0.08, 0.42, rand());
      const P = add(base, mul(dirOf(az, tiltP), H * lerp(0.5, 0.78, rand())));
      const Lf = Math.min(clamp(H * 0.42, 0.18, 0.6), m * 0.85) * lerp(0.85, 1.05, rand());
      const tb = lerp(1.55, 1.95, rand());
      const baz = az + (rand() - 0.5) * 0.3;
      const group: Part[] = [rod('veins', base, P, 0.011, { rTop: 0.007, plan: false })];
      const f0 = frameOf(baz, tb);
      const up0 = Math.sign(f0.N[1]) || 1;
      group.push(rod('veins', add(P, mul(f0.N, up0 * 0.004)), add(add(P, mul(f0.L, Lf * 0.92)), mul(f0.N, up0 * 0.004)), 0.004, { rTop: 0.0015, plan: false }));
      for (const sd of [1, -1] as const) {
        // Two halves folded slightly up along the midrib, with pale raised veins.
        const f = frameOf(baz, tb, sd * 0.18);
        const outline = halfShape.map(([x, z]) => [sd * x * Lf, z * Lf] as V2);
        group.push(panel('leaf', P, f, outline, 0.005, i < 2));
        const up = (Math.sign(f.N[1]) || 1) * 0.0045;
        const at = ([x, z]: V2): V3 => add(add(add(P, mul(f.W, sd * x * Lf)), mul(f.L, z * Lf)), mul(f.N, up));
        for (const [a, b] of laterals) group.push(rod('veins', at(a), at(b), 0.0028, { rTop: 0.0012, plan: false }));
      }
      parts.push(...fitTo(group, base, lim));
    }
    return contain(parts, lim);
  },
  planDetail: (size) => [circle([0, 0], half(size) * 0.42), canopy(half(size) * 0.9, half(size) * 0.9, 6)],
});

const bananaPlant = defineItem({
  id: 'plant-banana',
  name: 'Dwarf banana plant',
  category: 'plants',
  type: 'plants',
  group: 'Indoor plants',
  plant: PLANT_SPECIES['musa-dwarf-cavendish'],
  tags: ['banana plant', 'musa', 'tropical', 'big leaves', 'floor plant', 'torn leaves'],
  description: 'A dwarf Cavendish banana with long paddle leaves, some torn along the veins, on a thick pseudostem in a terracotta pot.',
  defaultSize: { w: 0.9, d: 0.9, h: 2.0 },
  minSize: { w: 0.5, d: 0.5, h: 1.0 },
  maxSize: { w: 1.6, d: 1.6, h: 2.7 },
  slots: [
    matSlot('pot', 'Pot', 'terracotta'),
    matSlot('soil', 'Soil', 'potting-soil'),
    matSlot('leaf', 'Leaves', 'leaf-banana'),
    matSlot('trunk', 'Pseudostem & midribs', 'banana-stem'),
  ],
  build: (size) => {
    const { h } = size;
    const m = half(size);
    const lim = limOf(size);
    const pot = planter('pot', 'soil', m * 0.48, clamp(h * 0.22, 0.22, 0.42), 'clay', { saucer: true });
    const parts: Part[] = [...pot.parts];
    const rand = rng(909);
    const H = h - pot.top;
    // Fleshy pseudostem of overlapping leaf sheaths.
    const rs = clamp(m * 0.16, 0.04, 0.09);
    const sh = H * 0.3;
    parts.push(
      lathe('trunk', [0, pot.top - 0.02, 0], [[0, 0], [rs, 0], [rs * 0.98, sh * 0.2], [rs * 0.8, sh * 0.7], [rs * 0.62, sh], [0, sh]], { segments: 20, plan: false }),
      ...range(3).map((k) =>
        lathe('trunk', polar(rs * 0.12, k * 2.1, pot.top + sh * (0.15 + k * 0.22)), [[rs * (0.98 - k * 0.12), 0], [rs * (0.95 - k * 0.12), sh * 0.18], [rs * (0.84 - k * 0.12), sh * 0.2]], {
          segments: 20,
          plan: false,
        }),
      ),
    );
    const crown: V3 = [0, pot.top + sh - 0.02, 0];
    const N = clamp(Math.round(h * 4), 5, 9);
    for (const i of range(N)) {
      const az = i * GOLDEN;
      const tiltP = lerp(0.1, 0.35, rand());
      const P = add(crown, mul(dirOf(az, tiltP), (h - crown[1]) * 0.22));
      const Lb = Math.min(clamp(H * 0.58, 0.4, 1.3), m * 1.9) * lerp(0.85, 1.05, rand());
      const W = Lb * 0.3;
      const notches: Notch[] = range(3 + Math.floor(rand() * 5)).map(() => ({
        t: lerp(0.15, 0.9, rand()),
        side: rand() < 0.5 ? 1 : -1,
        depth: lerp(0.05, 0.5, rand()),
        back: 0.03,
        gap: 0.004,
      }));
      const blade = bladeLeaf(
        'leaf',
        P,
        Lb,
        (t) => (W / 2) * (t < 0.06 ? lerp(0.3, 1, t / 0.06) : 1) * (t > 0.82 ? Math.pow(Math.max(0, (1 - t) / 0.18), 0.6) : 1),
        az,
        tiltP + 0.12,
        { segs: 3, bend: lerp(0.8, 1.25, rand()), roll: (rand() - 0.5) * 0.5, twist: (rand() - 0.5) * 0.3, thick: 0.004, notches, rib: { slot: 'trunk', r: 0.008 }, plan: i < 2 },
      );
      parts.push(...fitTo([rod('trunk', crown, P, 0.012, { rTop: 0.009, plan: false }), ...blade.parts], crown, lim));
    }
    // The next leaf, still rolled into a cigar.
    parts.push(...fitTo([rod('leaf', crown, add(crown, [0.01, H * 0.42, 0]), 0.015, { rTop: 0.004, plan: false })], crown, lim));
    return contain(parts, lim);
  },
  planDetail: (size) => [circle([0, 0], half(size) * 0.48), canopy(half(size) * 0.95, half(size) * 0.95, 6)],
});

const weepingFig = defineItem({
  id: 'plant-weeping-fig',
  name: 'Weeping fig',
  category: 'plants',
  type: 'plants',
  group: 'Trees',
  plant: PLANT_SPECIES['ficus-benjamina'],
  tags: ['weeping fig', 'ficus benjamina', 'braided trunk', 'indoor tree', 'houseplant', 'small leaves'],
  description: 'A weeping fig with a braided trunk and drooping branches of small glossy leaves, in a speckled stoneware pot.',
  defaultSize: { w: 0.8, d: 0.8, h: 1.9 },
  minSize: { w: 0.45, d: 0.45, h: 1.0 },
  maxSize: { w: 1.4, d: 1.4, h: 2.6 },
  slots: [
    matSlot('pot', 'Pot', 'speckled-stoneware'),
    matSlot('soil', 'Soil', 'potting-soil'),
    matSlot('leaf', 'Leaves', 'leaf-ficus'),
    matSlot('trunk', 'Trunk', 'bark-grey'),
  ],
  build: (size) => {
    const { h } = size;
    const m = half(size);
    const lim = limOf(size);
    const pot = planter('pot', 'soil', m * 0.42, clamp(h * 0.22, 0.2, 0.4), 'taper');
    const parts: Part[] = [...pot.parts];
    const rand = rng(1010);
    const tH = pot.top + (h - pot.top) * 0.3;
    // Three stems braided around each other.
    for (const k of range(3)) {
      const pts = range(7).map((j) => polar(0.014 * (1 - j / 12), (k * TAU) / 3 + j * 1.1, lerp(pot.top, tH, j / 6)));
      for (const j of range(6)) parts.push(rod('trunk', pts[j], pts[j + 1], 0.011, { plan: false }));
    }
    parts.push(sphere('trunk', [0, tH, 0], 0.018, { plan: false }));
    // A rounded crown of arching branches and drooping sprays of small glossy leaves.
    const Rc = Math.min(m * 0.92, (h - tH) * 0.55);
    const Rv = (h - tH) * 0.42;
    const Cc: V3 = [0, h - Rv * 1.05, 0];
    const crown: Part[] = [rod('trunk', [0, tH, 0], add(Cc, [0, Rv * 0.4, 0]), 0.009, { rTop: 0.004, plan: false })];
    for (const b of range(6)) {
      const az = b * GOLDEN;
      const end = add(Cc, polar(Rc * 0.5, az, lerp(-0.3, 0.4, rand()) * Rv));
      const mid = add(along([[0, tH, 0], end], 0.5), polar(Rc * 0.05, az, Rv * 0.1));
      crown.push(rod('trunk', [0, tH + 0.02, 0], mid, 0.008, { rTop: 0.006, plan: false }), rod('trunk', mid, end, 0.006, { rTop: 0.003, plan: false }));
    }
    const S = clamp(Math.round(Rc * 170), 30, 70);
    const ll = clamp(Rc * 0.19, 0.032, 0.07);
    for (const s of range(S)) {
      // Sprays scattered through the whole crown, facing up and out, drooping at the rim.
      const y = lerp(-0.75, 1, Math.sqrt(rand()));
      const th = rand() * TAU;
      const dv: V3 = [Math.sqrt(1 - y * y) * Math.cos(th), y, Math.sqrt(1 - y * y) * Math.sin(th)];
      const rb = lerp(0.2, 0.68, Math.sqrt(rand()));
      const [az, tilt] = azTilt(dv);
      crown.push(
        panel(
          'leaf',
          add(Cc, [dv[0] * Rc * rb, dv[1] * Rv * rb, dv[2] * Rc * rb]),
          frameOf(az, Math.min(Math.PI - 0.35, tilt + lerp(0.2, 0.5, rand()) + rb * 0.6), (rand() - 0.5) * 0.7),
          sprigOutline(Rc * lerp(0.3, 0.45, rand()), ll, ll * 0.45, 0.8),
          0.003,
          s < 4,
        ),
      );
    }
    parts.push(...fitTo(crown, Cc, lim));
    return contain(parts, lim);
  },
  planDetail: (size) => [circle([0, 0], half(size) * 0.42), canopy(half(size) * 0.9, half(size) * 0.9, 10)],
});

const umbrellaTree = defineItem({
  id: 'plant-schefflera',
  name: 'Umbrella tree (schefflera)',
  category: 'plants',
  type: 'plants',
  group: 'Trees',
  plant: PLANT_SPECIES['heptapleurum-arboricola'],
  tags: ['umbrella tree', 'schefflera', 'umbrella plant', 'indoor tree', 'houseplant', 'palmate leaves'],
  description: 'An umbrella tree with glossy leaflets fanned out like umbrellas on branching stems, in a terracotta pot.',
  defaultSize: { w: 0.8, d: 0.8, h: 1.6 },
  minSize: { w: 0.45, d: 0.45, h: 0.8 },
  maxSize: { w: 1.3, d: 1.3, h: 2.4 },
  slots: [
    matSlot('pot', 'Pot', 'terracotta'),
    matSlot('soil', 'Soil', 'potting-soil'),
    matSlot('leaf', 'Leaves', 'leaf-schefflera'),
    matSlot('stems', 'Stems', 'bark-brown'),
  ],
  build: (size) => {
    const { h } = size;
    const m = half(size);
    const lim = limOf(size);
    const pot = planter('pot', 'soil', m * 0.42, clamp(h * 0.22, 0.2, 0.4), 'clay');
    const parts: Part[] = [...pot.parts];
    const rand = rng(1111);
    const L = clamp(m * 0.36, 0.08, 0.22);
    const pl = clamp(m * 0.4, 0.1, 0.28);
    for (const k of range(3)) {
      // Woody stems carrying whorls of leaflets on long stalks, like little umbrellas.
      const az = (k * TAU) / 3 + 0.2;
      const base = polar(pot.rIn * 0.3, az, pot.top);
      const top = add(base, mul(dirOf(az, lerp(0.12, 0.24, rand())), (h - pot.top - L * 0.5) * [0.95, 0.8, 0.68][k]));
      const mid = add(along([base, top], 0.5), polar(0.02, az + 1.5));
      const path = [base, mid, top];
      parts.push(rod('stems', base, mid, 0.013, { rTop: 0.011, plan: false }), rod('stems', mid, top, 0.011, { rTop: 0.007, plan: false }));
      const n = clamp(Math.round((top[1] - pot.top) * 10), 5, 14);
      for (const j of range(n)) {
        const t = lerp(0.3, 1, j / (n - 1));
        const P = along(path, t);
        const paz = j * GOLDEN + k;
        const Q = add(P, mul(dirOf(paz, lerp(1.1, 0.5, t)), pl * lerp(0.8, 1.1, rand())));
        const leaflets = 7 + (j % 3);
        const um = panel(
          'leaf',
          Q,
          frameOf(paz, lerp(1.45, 1.75, rand()), (rand() - 0.5) * 0.3),
          palmateOutline(leaflets, L * lerp(0.85, 1.05, rand()), L * 0.36, TAU * 0.86, 0.008, rand),
          0.003,
          j === n - 1,
        );
        parts.push(...fitTo([rod('stems', P, Q, 0.0035, { plan: false }), um], P, lim));
      }
    }
    return contain(parts, lim);
  },
  planDetail: (size) => [circle([0, 0], half(size) * 0.42), canopy(half(size) * 0.9, half(size) * 0.9, 8)],
});

const columnCactus = defineItem({
  id: 'plant-cereus',
  name: 'Blue column cactus',
  category: 'plants',
  type: 'plants',
  group: 'Succulents & cacti',
  plant: PLANT_SPECIES['pilosocereus-pachycladus'],
  tags: ['cactus', 'cereus', 'column cactus', 'peruvian apple', 'succulent', 'desert', 'floor plant'],
  description: 'A blue column cactus with ribbed powder-blue stems and woolly areoles, in a terracotta pot with gravel.',
  defaultSize: { w: 0.45, d: 0.45, h: 1.6 },
  minSize: { w: 0.25, d: 0.25, h: 0.6 },
  maxSize: { w: 0.8, d: 0.8, h: 2.4 },
  slots: [
    matSlot('pot', 'Pot', 'terracotta'),
    matSlot('soil', 'Gravel', 'gravel-top'),
    matSlot('body', 'Cactus', 'cactus-blue'),
    matSlot('spines', 'Areoles', 'spine-cream'),
  ],
  build: (size) => {
    const { h } = size;
    const m = half(size);
    const lim = limOf(size);
    const pot = planter('pot', 'soil', m * 0.62, clamp(h * 0.16, 0.12, 0.3), 'clay');
    const parts: Part[] = [...pot.parts, ...pebbles('soil', pot.rIn, pot.top, 5, 0.012, 3)];
    const ribs = 7;
    const R = clamp(m * 0.3, 0.035, 0.11);
    const sr = clamp(R * 0.09, 0.004, 0.009);
    const H = h - pot.top;
    // Ribbed column with a domed crown and areoles running down every rib.
    const column = (cx: number, cz: number, r: number, y0: number, y1: number, rows: number): Part[] => {
      const out: Part[] = [prism('body', ribOutline(cx, cz, r, ribs), y0, y1 - y0), sphere('body', [cx, y1, cz], r * 0.86, { scale: [1, 0.75, 1], plan: false })];
      for (const row of range(rows)) {
        for (const k of range(ribs)) {
          const y = lerp(y0 + 0.03, y1, (row + 0.5 * (k % 2)) / rows);
          out.push(sphere('spines', [cx + Math.cos((k * TAU) / ribs) * r, y, cz + Math.sin((k * TAU) / ribs) * r], sr, { plan: false }));
        }
      }
      return out;
    };
    const colTop = h - R * 0.7;
    parts.push(...column(0, 0, R, pot.top - 0.01, colTop, clamp(Math.round((colTop - pot.top) / 0.12), 4, 9)));
    if (h > 0.9) {
      // Two arms bending up from the trunk.
      for (const [k, f] of [0.42, 0.58].entries()) {
        const az = k === 0 ? 0.3 : Math.PI + 0.5;
        const Ra = R * 0.72;
        const da = Math.min(R * 0.85 + Ra, m - Ra - 0.01);
        const ya = pot.top + H * f;
        const elbow = polar(da, az, ya + Ra * 0.3);
        const armTop = Math.min(h - Ra * 0.7, ya + H * 0.28);
        parts.push(rod('body', polar(R * 0.5, az, ya), elbow, Ra * 0.9, { plan: false }), sphere('body', elbow, Ra * 0.95, { plan: false }));
        parts.push(...column(elbow[0], elbow[2], Ra, elbow[1], armTop, 3).map((p) => ({ ...p, plan: false })));
      }
    }
    return contain(parts, lim);
  },
  planDetail: (size) => [circle([0, 0], half(size) * 0.62), circle([0, 0], clamp(half(size) * 0.3, 0.035, 0.11))],
});

const agave = defineItem({
  id: 'plant-agave',
  name: 'Century plant (agave)',
  category: 'plants',
  type: 'plants',
  group: 'Succulents & cacti',
  plant: PLANT_SPECIES['agave-americana'],
  tags: ['agave', 'century plant', 'americana', 'succulent', 'rosette', 'desert', 'spiky'],
  description: 'A century plant rosette of thick blue-grey leaves with dark tip spines, in a concrete bowl with gravel.',
  defaultSize: { w: 0.8, d: 0.8, h: 0.75 },
  minSize: { w: 0.4, d: 0.4, h: 0.4 },
  maxSize: { w: 1.4, d: 1.4, h: 1.3 },
  slots: [
    matSlot('pot', 'Bowl', 'concrete-planter'),
    matSlot('soil', 'Gravel', 'gravel-top'),
    matSlot('leaf', 'Leaves', 'leaf-agave'),
    matSlot('spines', 'Tip spines', 'spine-dark'),
  ],
  build: (size) => {
    const { h } = size;
    const m = half(size);
    const lim = limOf(size);
    const pot = planter('pot', 'soil', m * 0.55, clamp(h * 0.3, 0.12, 0.3), 'bowl');
    const parts: Part[] = [...pot.parts];
    const rand = rng(1313);
    const C: V3 = [0, pot.top + 0.01, 0];
    const N = clamp(Math.round(m * 50), 14, 26);
    const Lmax = Math.min(m * 1.05, (h - pot.top) * 1.15);
    const group: Part[] = [];
    for (const j of range(N)) {
      // Thick blue-grey leaves with toothed margins and a dark terminal spine.
      const frac = j / (N - 1);
      const az = j * GOLDEN;
      const tilt = lerp(0.15, 1.45, Math.pow(frac, 0.7)) + (rand() - 0.5) * 0.1;
      const len = Lmax * lerp(0.5, 1, Math.sqrt(frac)) * lerp(0.9, 1.05, rand());
      const lf = bladeLeaf('leaf', add(C, polar(0.015 * frac, az)), len, wedge(len * 0.22, 0.28), az, tilt, {
        segs: 2,
        bend: lerp(-0.1, 0.35, frac),
        thick: clamp(len * 0.04, 0.008, 0.02),
        teeth: 0.08,
        samples: 8,
        roll: (rand() - 0.5) * 0.3,
        plan: j === N - 1,
      });
      group.push(...lf.parts, rod('spines', lf.tip, add(lf.tip, mul(lf.dir, len * 0.06)), 0.003, { rTop: 0.0005, plan: false }));
    }
    parts.push(...fitTo(group, C, lim));
    return contain(parts, lim);
  },
  planDetail: (size) => [circle([0, 0], half(size) * 0.55), starPlan(half(size) * 0.95, 9, 0.55)],
});

const calathea = defineItem({
  id: 'plant-calathea',
  name: "Calathea 'Medallion'",
  category: 'plants',
  type: 'plants',
  group: 'Indoor plants',
  plant: PLANT_SPECIES['goeppertia-medallion'],
  tags: ['calathea', 'prayer plant', 'medallion', 'patterned leaves', 'houseplant', 'purple underside'],
  description: "Calathea 'Medallion' with round leaves patterned in silver and dark green and purple undersides, in a black glazed pot.",
  defaultSize: { w: 0.5, d: 0.5, h: 0.7 },
  minSize: { w: 0.3, d: 0.3, h: 0.4 },
  maxSize: { w: 0.85, d: 0.85, h: 1.1 },
  slots: [
    matSlot('pot', 'Pot', 'ceramic-black'),
    matSlot('leaf', 'Leaves & moss', 'leaf-calathea'),
    matSlot('feather', 'Leaf markings', 'leaf-calathea-feather'),
    matSlot('under', 'Leaf undersides', 'leaf-purple-underside'),
  ],
  build: (size) => {
    const { h } = size;
    const m = half(size);
    const lim = limOf(size);
    const pot = planter('pot', 'leaf', m * 0.48, clamp(h * 0.3, 0.12, 0.3), 'taper');
    const parts: Part[] = [...pot.parts];
    const rand = rng(1414);
    const H = h - pot.top;
    const N = clamp(Math.round(m * 42), 9, 15);
    for (const i of range(N)) {
      // Upright oval leaves: dark green edge, a pale feathered medallion and a purple back.
      const az = i * GOLDEN;
      const base = polar(pot.rIn * 0.35 * Math.sqrt(rand()), rand() * TAU, pot.top);
      const tiltP = lerp(0.1, 0.55, rand());
      const P = add(base, mul(dirOf(az, tiltP), H * lerp(0.35, 0.55, rand())));
      const bl = clamp(H * 0.4, 0.08, 0.3) * lerp(0.85, 1.05, rand());
      const W = bl * 0.58;
      const f = frameOf(az, tiltP + lerp(0.35, 0.75, rand()), (rand() - 0.5) * 0.4);
      const inner = ovate(W * 0.62, 0.5, 0.7);
      const feather = range(17).map((j) => [inner(lerp(0.08, 0.9, j / 16)) * (j % 2 ? 0.68 : 1), lerp(0.08, 0.9, j / 16) * bl] as V2);
      const featherOutline = dedupe([...feather, ...feather.map(([x, z]) => [-x, z] as V2).reverse()]);
      const leafOutline = shapeOutline(ovate(W, 0.5, 0.6), bl, 12);
      parts.push(
        ...fitTo(
          [
            rod('leaf', base, P, 0.0035, { plan: false }),
            panel('leaf', P, f, leafOutline, 0.003, i < 2),
            panel('feather', add(P, mul(f.N, 0.0028)), f, featherOutline, 0.0015),
            panel('under', add(P, mul(f.N, -0.0028)), f, leafOutline.map(([x, z]) => [x * 0.97, z * 0.98] as V2), 0.0015),
          ],
          base,
          lim,
        ),
      );
    }
    return contain(parts, lim);
  },
  planDetail: (size) => [circle([0, 0], half(size) * 0.48), canopy(half(size) * 0.85)],
});

const croton = defineItem({
  id: 'plant-croton',
  name: 'Croton',
  category: 'plants',
  type: 'plants',
  group: 'Indoor plants',
  plant: PLANT_SPECIES['codiaeum-variegatum'],
  tags: ['croton', 'codiaeum', 'petra', 'colourful leaves', 'variegated', 'houseplant', 'red yellow'],
  description: "Croton 'Petra' with leathery leaves veined in gold, orange and red, in a matte white pot.",
  defaultSize: { w: 0.55, d: 0.55, h: 0.9 },
  minSize: { w: 0.3, d: 0.3, h: 0.45 },
  maxSize: { w: 0.9, d: 0.9, h: 1.4 },
  slots: [
    matSlot('pot', 'Pot', 'ceramic-matte-white'),
    matSlot('gold', 'Young leaves', 'croton-gold'),
    matSlot('red', 'Mature leaves', 'croton-red'),
    matSlot('stem', 'Stems & soil', 'bark-brown'),
  ],
  build: (size) => {
    const { h } = size;
    const m = half(size);
    const lim = limOf(size);
    const pot = planter('pot', 'stem', m * 0.45, clamp(h * 0.26, 0.15, 0.32), 'cylinder');
    const parts: Part[] = [...pot.parts];
    const rand = rng(1515);
    const Lc = clamp(h * 0.23, 0.09, 0.28);
    for (const k of range(3)) {
      // Woody stems with leathery leaves splashed green, gold, orange and red.
      const az = (k * TAU) / 3 + 0.4;
      const base = polar(pot.rIn * 0.3, az, pot.top);
      const yTop = h - Lc * [0.55, 0.75, 0.95][k];
      const top = polar(m * 0.12, az, yTop);
      const mid = add(along([base, top], 0.5), polar(0.015, az - 1.4));
      const path = [base, mid, top];
      parts.push(rod('stem', base, mid, 0.009, { rTop: 0.007, plan: false }), rod('stem', mid, top, 0.007, { rTop: 0.004, plan: false }));
      const n = clamp(Math.round((yTop - pot.top) * 16), 5, 12);
      for (const j of range(n)) {
        const frac = j / (n - 1);
        const P = along(path, lerp(0.15, 0.97, frac));
        const laz = j * GOLDEN + k * 2.1;
        const slot = frac > 0.6 ? (rand() < 0.75 ? 'gold' : 'red') : rand() < 0.7 ? 'red' : 'gold';
        const len = Lc * lerp(0.8, 1.05, rand()) * (1 - 0.25 * frac);
        const tilt = lerp(1.45, 0.45, frac) + (rand() - 0.5) * 0.3;
        const Q = add(P, mul(dirOf(laz, tilt * 0.8), 0.025));
        const blade = bladeLeaf(slot, Q, len, ovate(len * 0.42, 0.38, 0.75), laz, tilt, {
          segs: 2,
          bend: 0.35,
          roll: (rand() - 0.5) * 0.5,
          thick: 0.004,
          plan: k === 0 && j < 2,
        });
        parts.push(...fitTo([rod('stem', P, Q, 0.0025, { plan: false }), ...blade.parts], P, lim));
      }
      // Fresh golden leaves crowding the tip.
      for (const j of range(3)) {
        const len = Lc * 0.45;
        parts.push(...fitTo(bladeLeaf('gold', top, len, ovate(len * 0.4, 0.4, 0.8), j * 2.1 + k, 0.35, { thick: 0.003 }).parts, top, lim));
      }
    }
    return contain(parts, lim);
  },
  planDetail: (size) => [circle([0, 0], half(size) * 0.45), canopy(half(size) * 0.82)],
});

const philodendron = defineItem({
  id: 'plant-philodendron',
  name: "Philodendron 'Xanadu' in a basket",
  category: 'plants',
  type: 'plants',
  group: 'Indoor plants',
  plant: PLANT_SPECIES['thaumatophyllum-xanadu'],
  tags: ['philodendron', 'xanadu', 'lobed leaves', 'basket', 'houseplant', 'tropical'],
  description: "Philodendron 'Xanadu', a compact clump of deeply lobed glossy leaves, in a woven basket.",
  defaultSize: { w: 0.7, d: 0.7, h: 0.8 },
  minSize: { w: 0.4, d: 0.4, h: 0.45 },
  maxSize: { w: 1.2, d: 1.2, h: 1.3 },
  slots: [
    matSlot('pot', 'Basket', 'woven-basket'),
    matSlot('soil', 'Soil', 'potting-soil'),
    matSlot('leaf', 'Leaves', 'leaf-philodendron'),
    matSlot('stems', 'Leaf stalks', 'stem-green'),
  ],
  build: (size) => {
    const { h } = size;
    const m = half(size);
    const lim = limOf(size);
    const pr = m * 0.48;
    const pot = planter('pot', 'soil', pr, clamp(h * 0.32, 0.15, 0.34), 'basket', { handles: m - pr });
    const parts: Part[] = [...pot.parts];
    const rand = rng(1616);
    const H = h - pot.top;
    const N = clamp(Math.round(m * 38), 10, 20);
    for (const i of range(N)) {
      // A mound of deeply lobed leaves arching out on long stalks.
      const az = i * GOLDEN;
      const base = polar(pot.rIn * 0.3 * Math.sqrt(rand()), rand() * TAU, pot.top);
      const tiltP = lerp(0.35, 1.0, rand());
      const P = add(base, mul(dirOf(az, tiltP), H * lerp(0.35, 0.55, rand())));
      const bl = clamp(m * 0.6, 0.12, 0.42) * lerp(0.85, 1.05, rand());
      const notches: Notch[] = [0.14, 0.3, 0.6, 0.76].flatMap((t) => [1, -1].map((side) => ({ t: t + (rand() - 0.5) * 0.02, side: side as 1 | -1, depth: 0.35, back: 0.02, gap: 0.07 })));
      const blade = bladeLeaf('leaf', P, bl, ovate(bl * 0.62, 0.42, 0.55), az, tiltP + lerp(0.3, 0.6, rand()), {
        segs: 2,
        bend: 0.45,
        roll: (rand() - 0.5) * 0.4,
        thick: 0.004,
        samples: 8,
        notches,
        plan: i < 3,
      });
      parts.push(...fitTo([rod('stems', base, P, 0.005, { rTop: 0.004, plan: false }), ...blade.parts], base, lim));
    }
    return contain(parts, lim);
  },
  planDetail: (size) => [circle([0, 0], half(size) * 0.48), canopy(half(size) * 0.92, half(size) * 0.92, 10)],
});

const lemonTree = defineItem({
  id: 'plant-lemon-tree',
  name: 'Potted Meyer lemon tree',
  category: 'plants',
  type: 'plants',
  group: 'Trees',
  plant: PLANT_SPECIES['citrus-meyer-lemon'],
  tags: ['lemon tree', 'citrus', 'fruit tree', 'meyer lemon', 'indoor tree', 'terracotta'],
  description: 'A Meyer lemon tree with glossy leaves and ripe yellow lemons, in a terracotta pot.',
  defaultSize: { w: 0.7, d: 0.7, h: 1.5 },
  minSize: { w: 0.4, d: 0.4, h: 0.8 },
  maxSize: { w: 1.2, d: 1.2, h: 2.2 },
  slots: [
    matSlot('pot', 'Pot', 'terracotta'),
    matSlot('leaf', 'Leaves', 'leaf-citrus'),
    matSlot('trunk', 'Trunk & soil', 'bark-grey'),
    matSlot('fruit', 'Lemons', 'lemon-yellow'),
  ],
  build: (size) => {
    const { h } = size;
    const m = half(size);
    const lim = limOf(size);
    const pot = planter('pot', 'trunk', m * 0.5, clamp(h * 0.22, 0.2, 0.4), 'clay', { saucer: true });
    const parts: Part[] = [...pot.parts];
    const rand = rng(1717);
    const Rc = Math.min(m * 0.88, (h - pot.top) * 0.33);
    const Cc: V3 = [0, h - Rc - 0.01, 0];
    const yT = Cc[1] - Rc * 0.3;
    parts.push(rod('trunk', [0, pot.top, 0], [0.01, yT, 0], 0.022, { rTop: 0.016, plan: false }));
    // A clipped ball of leafy sprigs on a clean standard trunk, hung with lemons.
    const crown: Part[] = [];
    for (const b of range(5)) {
      crown.push(rod('trunk', [0.01, yT, 0], add(Cc, polar(Rc * 0.5, (b * TAU) / 5 + 0.3, lerp(-0.2, 0.3, rand()) * Rc)), 0.01, { rTop: 0.005, plan: false }));
    }
    const S = clamp(Math.round(Rc * 180), 30, 64);
    const ll = clamp(Rc * 0.2, 0.035, 0.085);
    for (const s of range(S)) {
      const y = lerp(-0.6, 1, rand());
      const th = rand() * TAU;
      const dv: V3 = [Math.sqrt(1 - y * y) * Math.cos(th), y, Math.sqrt(1 - y * y) * Math.sin(th)];
      const rb = lerp(0.2, 0.62, Math.sqrt(rand()));
      const [az, tilt] = azTilt(dv);
      crown.push(panel('leaf', add(Cc, mul(dv, Rc * rb)), frameOf(az, tilt + 0.25, (rand() - 0.5) * 0.8), sprigOutline(Rc * lerp(0.3, 0.42, rand()), ll, ll * 0.45, 0.8), 0.003, s < 4));
    }
    const F = clamp(Math.round(Rc * 22), 5, 12);
    const rl = clamp(Rc * 0.1, 0.022, 0.04);
    for (const _f of range(F)) {
      const y = lerp(-0.7, 0.4, rand());
      const th = rand() * TAU;
      const pos = add(Cc, mul([Math.sqrt(1 - y * y) * Math.cos(th), y, Math.sqrt(1 - y * y) * Math.sin(th)], Rc * 0.82));
      crown.push(sphere('fruit', pos, rl, { scale: [1, 1.22, 1], plan: false }), sphere('fruit', add(pos, [0, -rl * 1.2, 0]), rl * 0.25, { plan: false }));
    }
    parts.push(...fitTo(crown, Cc, lim));
    return contain(parts, lim);
  },
  planDetail: (size) => [circle([0, 0], half(size) * 0.5), canopy(half(size) * 0.88, half(size) * 0.88, 12)],
});

// ---------------------------------------------------------------------------
// Table plants
// ---------------------------------------------------------------------------

const aloeVera = defineItem({
  id: 'plant-aloe',
  name: 'Aloe vera',
  category: 'plants',
  type: 'plants',
  group: 'Succulents & cacti',
  plant: PLANT_SPECIES['aloe-vera'],
  tags: ['aloe vera', 'aloe', 'succulent', 'medicinal', 'table plant', 'windowsill'],
  description: 'An aloe vera rosette of thick, toothed grey-green leaves, in a terracotta pot with gravel.',
  defaultSize: { w: 0.3, d: 0.3, h: 0.42 },
  minSize: { w: 0.15, d: 0.15, h: 0.2 },
  maxSize: { w: 0.6, d: 0.6, h: 0.8 },
  slots: [
    matSlot('pot', 'Pot', 'terracotta'),
    matSlot('soil', 'Gravel', 'gravel-top'),
    matSlot('leaf', 'Leaves', 'leaf-aloe'),
  ],
  build: (size) => {
    const { h } = size;
    const m = half(size);
    const lim = limOf(size);
    const pot = planter('pot', 'soil', m * 0.6, clamp(h * 0.38, 0.07, 0.22), 'clay');
    const parts: Part[] = [...pot.parts];
    const rand = rng(1818);
    const C: V3 = [0, pot.top + 0.005, 0];
    const N = clamp(Math.round(m * 90), 10, 18);
    const Lmax = Math.min((h - pot.top) * 1.1, m * 1.6);
    const rosette = (c: V3, n: number, Lm: number, seed: number): Part[] => {
      const r2 = rng(seed);
      const out: Part[] = [];
      for (const j of range(n)) {
        // Thick, fleshy, toothed leaves rising in a loose rosette.
        const frac = j / Math.max(1, n - 1);
        const len = Lm * lerp(0.65, 1, r2()) * lerp(1, 0.85, frac);
        out.push(
          ...bladeLeaf('leaf', c, len, wedge(len * 0.17, 0.15), j * GOLDEN + seed, lerp(0.12, 0.95, frac) + (r2() - 0.5) * 0.15, {
            segs: 2,
            bend: lerp(0, 0.35, frac),
            thick: clamp(len * 0.07, 0.006, 0.02),
            teeth: 0.12,
            samples: 8,
            plan: j === n - 1,
          }).parts,
        );
      }
      return out;
    };
    parts.push(...fitTo(rosette(C, N, Lmax, 1), C, lim));
    // Two pups at the pot edge.
    for (const k of range(2)) {
      const c = polar(pot.rIn * 0.62, k * 2.6 + rand(), pot.top + 0.003);
      parts.push(...fitTo(rosette(c, 4, Lmax * 0.3, 7 + k), c, lim));
    }
    return contain(parts, lim);
  },
  planDetail: (size) => [circle([0, 0], half(size) * 0.6), starPlan(half(size) * 0.9, 8, 0.5)],
});

const jadePlant = defineItem({
  id: 'plant-jade',
  name: 'Jade plant',
  category: 'plants',
  type: 'plants',
  group: 'Succulents & cacti',
  plant: PLANT_SPECIES['crassula-ovata'],
  tags: ['jade plant', 'crassula', 'money tree', 'lucky plant', 'succulent', 'table plant'],
  description: 'A jade plant with a thick woody trunk and plump oval leaves, in a blue glazed bowl.',
  defaultSize: { w: 0.38, d: 0.38, h: 0.42 },
  minSize: { w: 0.2, d: 0.2, h: 0.2 },
  maxSize: { w: 0.8, d: 0.8, h: 0.9 },
  slots: [
    matSlot('pot', 'Bowl', 'glazed-blue'),
    matSlot('soil', 'Soil', 'potting-soil'),
    matSlot('leaf', 'Leaves', 'leaf-jade'),
    matSlot('trunk', 'Trunk', 'jade-trunk'),
  ],
  build: (size) => {
    const { h } = size;
    const m = half(size);
    const lim = limOf(size);
    const pot = planter('pot', 'soil', m * 0.7, clamp(h * 0.26, 0.05, 0.16), 'bowl');
    const parts: Part[] = [...pot.parts];
    const rand = rng(1919);
    const H = h - pot.top;
    const rt = clamp(m * 0.1, 0.012, 0.035);
    const B0: V3 = [0, pot.top, 0];
    const yS = pot.top + H * 0.32;
    const tree: Part[] = [sphere('trunk', B0, rt * 1.4, { scale: [1, 0.6, 1], plan: false }), rod('trunk', B0, [0.005, yS, 0], rt, { rTop: rt * 0.8, plan: false })];
    const ll = clamp(m * 0.2, 0.02, 0.065);
    // Plump paired leaves clustered at the tips of the forked branches.
    const pairsAt = (tip: V3, dir: V3, pairs: number) => {
      const [daz] = azTilt(dir);
      for (const p of range(pairs)) {
        const c = sub(tip, mul(dir, p * ll * 0.35));
        for (const sd of [0, Math.PI]) {
          const len = ll * lerp(0.85, 1.1, rand()) * (1 - p * 0.12);
          tree.push(leaf('leaf', c, len, len * 0.62, daz + sd + p * (Math.PI / 2) + (rand() - 0.5) * 0.3, lerp(0.6, 1.2, rand()), { thick: len * 0.24 }));
        }
      }
    };
    for (const k of range(3)) {
      const az = (k * TAU) / 3 + 0.3;
      const B1 = polar(m * 0.32, az, yS + H * 0.22);
      tree.push(rod('trunk', [0.005, yS, 0], B1, rt * 0.6, { rTop: rt * 0.5, plan: false }));
      pairsAt(along([[0.005, yS, 0], B1], 0.6), norm(sub(B1, [0, yS, 0])), 1);
      for (const sd of [-0.6, 0.6]) {
        const B2 = add(B1, add(polar(m * 0.22, az + sd), [0, H * 0.18, 0]));
        tree.push(rod('trunk', B1, B2, rt * 0.4, { rTop: rt * 0.3, plan: false }));
        pairsAt(B2, norm(sub(B2, B1)), 4);
      }
    }
    parts.push(...fitTo(tree, B0, lim));
    return contain(parts, lim);
  },
  planDetail: (size) => [circle([0, 0], half(size) * 0.7), canopy(half(size) * 0.85, half(size) * 0.85, 8)],
});

const moneyPlant = defineItem({
  id: 'plant-pilea',
  name: 'Chinese money plant (pilea)',
  category: 'plants',
  type: 'plants',
  group: 'Indoor plants',
  plant: PLANT_SPECIES['pilea-peperomioides'],
  tags: ['chinese money plant', 'pilea', 'peperomioides', 'pancake plant', 'coin leaves', 'table plant'],
  description: 'A Chinese money plant with round pancake leaves on long stalks, in a matte white pot.',
  defaultSize: { w: 0.3, d: 0.3, h: 0.36 },
  minSize: { w: 0.18, d: 0.18, h: 0.2 },
  maxSize: { w: 0.55, d: 0.55, h: 0.65 },
  slots: [
    matSlot('pot', 'Pot', 'ceramic-matte-white'),
    matSlot('soil', 'Soil', 'potting-soil'),
    matSlot('leaf', 'Leaves', 'leaf-pilea'),
    matSlot('stems', 'Stems', 'stem-green'),
  ],
  build: (size) => {
    const { h } = size;
    const m = half(size);
    const lim = limOf(size);
    const pot = planter('pot', 'soil', m * 0.5, clamp(h * 0.36, 0.07, 0.2), 'cylinder', { saucer: true });
    const parts: Part[] = [...pot.parts];
    const rand = rng(2020);
    const H = h - pot.top;
    const S0: V3 = [0, pot.top, 0];
    const S1: V3 = [0.005, pot.top + H * 0.45, 0];
    parts.push(rod('stems', S0, S1, 0.006, { rTop: 0.004, plan: false }));
    const N = clamp(Math.round(m * 100), 10, 22);
    const rc0 = clamp(m * 0.28, 0.022, 0.07);
    // Round coin leaves held out on long thin stalks from a single upright stem.
    const coin = (P: V3, az: number, tiltP: number, pl: number, rc: number, tiltN: number, plan: boolean): Part[] => {
      const Q = add(P, mul(dirOf(az, tiltP), pl));
      const n = dirOf(az, tiltN);
      return [rod('stems', P, Q, 0.0018, { plan: false }), faceDisc('leaf', add(Q, mul(n, 0.002)), n, rc, 0.003, plan)];
    };
    for (const j of range(N)) {
      const frac = j / (N - 1);
      const P = along([S0, S1], lerp(0.15, 1, frac));
      const az = j * GOLDEN;
      parts.push(
        ...fitTo(
          coin(P, az, lerp(1.35, 0.35, frac), H * lerp(0.45, 0.2, frac) * lerp(0.9, 1.1, rand()), rc0 * lerp(1, 0.6, frac) * lerp(0.85, 1.05, rand()), lerp(0.85, 0.35, frac), j < 3),
          P,
          lim,
        ),
      );
    }
    // Baby plants popping up from the soil.
    for (const k of range(2)) {
      const c = polar(pot.rIn * 0.65, k * 2.8 + 0.6, pot.top);
      for (const j of range(3)) parts.push(...fitTo(coin(c, j * 2.1 + k, 0.4, H * 0.12, rc0 * 0.45, 0.5, false), c, lim));
    }
    return contain(parts, lim);
  },
  planDetail: (size) => [circle([0, 0], half(size) * 0.5), canopy(half(size) * 0.85, half(size) * 0.85, 8)],
});

const africanViolet = defineItem({
  id: 'plant-african-violet',
  name: 'African violet',
  category: 'plants',
  type: 'plants',
  group: 'Indoor plants',
  plant: PLANT_SPECIES['streptocarpus-ionanthus'],
  tags: ['african violet', 'saintpaulia', 'flowering plant', 'purple flowers', 'table plant', 'windowsill'],
  description: 'An African violet: a rosette of velvety leaves around clusters of purple flowers with yellow centres, in a speckled pot.',
  defaultSize: { w: 0.24, d: 0.24, h: 0.18 },
  minSize: { w: 0.14, d: 0.14, h: 0.1 },
  maxSize: { w: 0.4, d: 0.4, h: 0.3 },
  slots: [
    matSlot('pot', 'Pot', 'speckled-stoneware'),
    matSlot('leaf', 'Leaves', 'leaf-velvet'),
    matSlot('flower', 'Flowers', 'violet-purple'),
    matSlot('eye', 'Flower centres', 'pollen-yellow'),
  ],
  build: (size) => {
    const { h } = size;
    const m = half(size);
    const lim = limOf(size);
    const pot = planter('pot', 'leaf', m * 0.55, clamp(h * 0.45, 0.05, 0.12), 'footed');
    const parts: Part[] = [...pot.parts];
    const rand = rng(2121);
    const C: V3 = [0, pot.top + 0.006, 0];
    const L1 = m * 0.95;
    // Flat rosette of velvety round leaves on short stalks, spilling over the rim.
    const shape =
      (W: number): HW =>
      (t) =>
        t < 0.3 ? W * 0.06 : Math.max(W * 0.06, ovate(W, 0.55, 0.55)((t - 0.3) / 0.7));
    const leaves: Part[] = [];
    for (const [ring2, n, tilt, k] of [
      [0, 8, 1.35, 1],
      [1, 6, 0.9, 0.7],
    ] as const) {
      for (const j of range(n)) {
        const len = L1 * k * lerp(0.9, 1.05, rand());
        leaves.push(
          ...bladeLeaf('leaf', C, len, shape(len * 0.48), (j / n) * TAU + ring2 * 0.4 + rand() * 0.2, tilt + (rand() - 0.5) * 0.15, {
            segs: 2,
            bend: 0.25,
            thick: 0.004,
            plan: ring2 === 0 && j % 2 === 0,
          }).parts,
        );
      }
    }
    parts.push(...fitTo(leaves, C, lim));
    const F = clamp(Math.round(m * 45), 5, 9);
    const pl = clamp(m * 0.16, 0.01, 0.025);
    const blooms: Part[] = [];
    for (const _i of range(F)) {
      const fc = add(add(C, polar(m * 0.28 * Math.sqrt(rand()), rand() * TAU)), [0, Math.min((h - C[1]) * lerp(0.55, 0.9, rand()), h - C[1] - pl), 0]);
      blooms.push(rod('leaf', add(C, [0, 0.01, 0]), fc, 0.0015, { plan: false }), ...flower('flower', 'eye', fc, pl, 5, rand() * TAU));
    }
    parts.push(...fitTo(blooms, C, lim));
    return contain(parts, lim);
  },
  planDetail: (size) => [circle([0, 0], half(size) * 0.55), canopy(half(size) * 0.9, half(size) * 0.9, 8)],
});

const haworthia = defineItem({
  id: 'plant-haworthia',
  name: 'Zebra haworthia',
  category: 'plants',
  type: 'plants',
  group: 'Succulents & cacti',
  plant: PLANT_SPECIES['haworthiopsis-attenuata'],
  tags: ['haworthia', 'zebra plant', 'zebra haworthia', 'succulent', 'striped', 'desk plant'],
  description: 'A zebra haworthia with pointed dark-green leaves banded in white, in a small concrete pot with gravel.',
  defaultSize: { w: 0.14, d: 0.14, h: 0.18 },
  minSize: { w: 0.08, d: 0.08, h: 0.1 },
  maxSize: { w: 0.3, d: 0.3, h: 0.35 },
  slots: [
    matSlot('pot', 'Pot', 'concrete-planter'),
    matSlot('soil', 'Gravel', 'gravel-top'),
    matSlot('leaf', 'Leaves', 'leaf-haworthia'),
    matSlot('stripes', 'White stripes', 'tubercle-white'),
  ],
  build: (size) => {
    const { h } = size;
    const m = half(size);
    const lim = limOf(size);
    const s = m * 1.7;
    const pot = boxPlanter('pot', 'soil', s, s, clamp(h * 0.42, 0.04, 0.12));
    const parts: Part[] = [...pot.parts];
    const rand = rng(2222);
    const C: V3 = [0, pot.top, 0];
    const N = clamp(Math.round(m * 230), 12, 20);
    const group: Part[] = [];
    for (const j of range(N)) {
      // Stiff, pointed, incurving leaves banded with raised white stripes outside.
      const frac = j / (N - 1);
      const az = j * GOLDEN;
      const len = (h - pot.top) * lerp(0.7, 1.05, frac) * lerp(0.9, 1.05, rand());
      const W = len * lerp(0.32, 0.26, frac);
      const hw = wedge(W, 0.12);
      const th = clamp(W * 0.25, 0.004, 0.01);
      const lf = bladeLeaf('leaf', add(C, polar(0.006 * frac, az)), len, hw, az, lerp(0.12, 0.85, frac), { segs: 2, bend: -0.25, thick: th, roll: (rand() - 0.5) * 0.3, plan: j === N - 1 });
      group.push(...lf.parts);
      if (frac > 0.35) {
        for (const t of [0.2, 0.38, 0.56, 0.72]) {
          const q = onLeaf(lf, t, 0, -(th / 2 + 0.0008));
          group.push(box('stripes', q.p, [2 * hw(t) * 0.85, 0.0035, 0.0016], { rotation: euler(fromCols(q.f.W, q.f.L, q.f.N)), plan: false }));
        }
      }
    }
    parts.push(...fitTo(group, C, lim));
    return contain(parts, lim);
  },
  planDetail: (size) => {
    const s = half(size) * 1.7;
    return [rectPoly(-s / 2, -s / 2, s / 2, s / 2), starPlan(half(size) * 0.8, 8, 0.5)];
  },
});

const echeveriaBowl = defineItem({
  id: 'plant-echeveria-bowl',
  name: 'Echeveria bowl',
  category: 'plants',
  type: 'plants',
  group: 'Succulents & cacti',
  plant: PLANT_SPECIES['echeveria-bowl'],
  tags: ['echeveria', 'succulent bowl', 'rosettes', 'hens and chicks', 'succulents', 'table centrepiece'],
  description: 'A terracotta bowl of echeveria rosettes in blue-grey and pink, with gravel between.',
  defaultSize: { w: 0.36, d: 0.36, h: 0.14 },
  minSize: { w: 0.2, d: 0.2, h: 0.08 },
  maxSize: { w: 0.7, d: 0.7, h: 0.25 },
  slots: [
    matSlot('pot', 'Bowl', 'terracotta'),
    matSlot('soil', 'Gravel', 'gravel-top'),
    matSlot('blue', 'Blue rosettes', 'echeveria-blue'),
    matSlot('pink', 'Pink rosettes', 'echeveria-pink'),
  ],
  build: (size) => {
    const { h } = size;
    const m = half(size);
    const lim = limOf(size);
    const pot = planter('pot', 'soil', m * 0.98, clamp(h * 0.55, 0.045, 0.12), 'bowl');
    const parts: Part[] = [...pot.parts, ...pebbles('soil', pot.rIn, pot.top, 5, Math.min(0.012, m * 0.05), 23)];
    const rand = rng(2323);
    const R = clamp(Math.round(m * 30), 3, 7);
    const centre = R > 4;
    const ringN = centre ? R - 1 : R;
    // Plump spoon-shaped leaves spiralling into tight rosettes, blue-grey and dusty pink.
    for (const k of range(R)) {
      const isCentre = centre && k === R - 1;
      const pos = isCentre ? ([0, pot.top, 0] as V3) : polar(pot.rIn * 0.52, (k * TAU) / ringN + 0.3, pot.top);
      const rr = pot.rIn * (centre ? 0.36 : 0.45) * lerp(0.8, 1.05, rand());
      const slot = k % 2 ? 'pink' : 'blue';
      const rosette: Part[] = [];
      for (const j of range(13)) {
        const frac = j / 12;
        const len = rr * lerp(0.45, 1, frac);
        rosette.push(leaf(slot, pos, len, len * 0.58, j * GOLDEN + k, lerp(0.2, 1.2, frac), { thick: len * 0.26, plan: j === 12 }));
      }
      parts.push(...fitTo(rosette, pos, lim));
    }
    return contain(parts, lim);
  },
  planDetail: (size) => {
    const m = half(size);
    const R = clamp(Math.round(m * 30), 3, 7);
    const ringN = R > 4 ? R - 1 : R;
    const rIn = m * 0.98 * 0.9;
    return [
      circle([0, 0], m * 0.98),
      ...range(ringN).map((k) => {
        const [x, , z] = polar(rIn * 0.52, (k * TAU) / ringN + 0.3);
        return circle([x, z], rIn * 0.3);
      }),
    ];
  },
});

const peperomia = defineItem({
  id: 'plant-peperomia',
  name: 'Watermelon peperomia',
  category: 'plants',
  type: 'plants',
  group: 'Indoor plants',
  plant: PLANT_SPECIES['peperomia-argyreia'],
  tags: ['peperomia', 'watermelon peperomia', 'argyreia', 'striped leaves', 'table plant', 'red stems'],
  description: 'A watermelon peperomia with round silver-striped leaves on red stalks, in a black glazed pot.',
  defaultSize: { w: 0.28, d: 0.28, h: 0.26 },
  minSize: { w: 0.15, d: 0.15, h: 0.14 },
  maxSize: { w: 0.5, d: 0.5, h: 0.45 },
  slots: [
    matSlot('pot', 'Pot', 'ceramic-black'),
    matSlot('leaf', 'Leaves & moss', 'leaf-peperomia-dark'),
    matSlot('silver', 'Silver stripes', 'leaf-peperomia-silver'),
    matSlot('petiole', 'Red stalks', 'stem-red'),
  ],
  build: (size) => {
    const { h } = size;
    const m = half(size);
    const lim = limOf(size);
    const pot = planter('pot', 'leaf', m * 0.5, clamp(h * 0.38, 0.06, 0.16), 'cylinder');
    const parts: Part[] = [...pot.parts];
    const rand = rng(2424);
    const H = h - pot.top;
    const N = clamp(Math.round(m * 85), 9, 16);
    for (const j of range(N)) {
      // Peltate oval leaves on red stalks, banded silver between dark green veins.
      const az = j * GOLDEN;
      const base = polar(pot.rIn * 0.25 * Math.sqrt(rand()), rand() * TAU, pot.top);
      const tiltP = lerp(0.2, 0.85, rand());
      const P = add(base, mul(dirOf(az, tiltP), H * lerp(0.35, 0.6, rand())));
      const bl = clamp(m * 0.62, 0.04, 0.14) * lerp(0.85, 1.05, rand());
      const hw = ovate(bl * 0.78, 0.42, 0.55);
      const att = 0.22 * bl;
      const leafOutline = shapeOutline(hw, bl, 12).map(([x, z]) => [x, z - att] as V2);
      // Silver bands: a star of arms from the stalk attachment out to near the margin.
      const K = 7;
      const step = TAU / K;
      const arms: V2[] = [];
      for (let i = K - 1; i >= 0; i--) {
        const a = -Math.PI + step * (i + 0.5);
        let r = 0;
        while (r < bl * 1.2) {
          const z = Math.cos(a) * (r + bl * 0.01) + att;
          if (z <= 0 || z >= bl || Math.abs(Math.sin(a) * (r + bl * 0.01)) >= hw(z / bl)) break;
          r += bl * 0.01;
        }
        r *= 0.86;
        if (r < bl * 0.05) continue;
        const db = step * 0.18;
        const hub = bl * 0.015;
        arms.push(
          ...lens([Math.sin(a + db) * hub, Math.cos(a + db) * hub], [Math.sin(a - db) * hub, Math.cos(a - db) * hub], r, 0.6 * r * step, a, [
            [0.2, 0.12],
            [0.5, 0.38],
            [0.8, 0.5],
            [0.95, 0.35],
          ]),
        );
      }
      arms.push([0, 0]);
      const f = frameOf(az, tiltP + lerp(0.35, 0.6, rand()), (rand() - 0.5) * 0.3);
      const group: Part[] = [rod('petiole', base, P, 0.0025, { plan: false }), panel('leaf', P, f, leafOutline, 0.003, j < 2)];
      const star = dedupe(arms);
      if (star.length >= 3) group.push(panel('silver', add(P, mul(f.N, 0.0024)), f, star, 0.0015));
      parts.push(...fitTo(group, base, lim));
    }
    return contain(parts, lim);
  },
  planDetail: (size) => [circle([0, 0], half(size) * 0.5), canopy(half(size) * 0.85, half(size) * 0.85, 8)],
});

const basilPot = defineItem({
  id: 'plant-basil',
  name: 'Basil pot',
  category: 'plants',
  type: 'plants',
  group: 'Herbs & edibles',
  plant: PLANT_SPECIES['ocimum-basilicum'],
  tags: ['basil', 'herb', 'sweet basil', 'kitchen herb', 'windowsill', 'table plant'],
  description: 'A bushy pot of sweet Genovese basil with bright green leaves, in terracotta.',
  defaultSize: { w: 0.22, d: 0.22, h: 0.32 },
  minSize: { w: 0.12, d: 0.12, h: 0.18 },
  maxSize: { w: 0.4, d: 0.4, h: 0.6 },
  slots: [
    matSlot('pot', 'Pot', 'terracotta'),
    matSlot('soil', 'Soil', 'potting-soil'),
    matSlot('leaf', 'Leaves', 'leaf-basil'),
    matSlot('stems', 'Stems', 'stem-green'),
  ],
  build: (size) => {
    const { h } = size;
    const m = half(size);
    const lim = limOf(size);
    const pot = planter('pot', 'soil', m * 0.62, clamp(h * 0.38, 0.07, 0.18), 'clay');
    const parts: Part[] = [...pot.parts];
    const rand = rng(2525);
    const H = h - pot.top;
    const S = clamp(Math.round(m * 45), 3, 6);
    const sc = clamp(H / 0.2, 0.6, 1.6);
    for (const k of range(S)) {
      // Upright stems with pairs of cupped, bright green leaves at every node.
      const az = (k * TAU) / S + rand() * 0.5;
      const base = polar(pot.rIn * 0.45 * Math.sqrt(rand()), az, pot.top);
      const tip = add(base, mul(dirOf(az, lerp(0.05, 0.3, rand())), H * lerp(0.7, 0.92, rand())));
      const group: Part[] = [rod('stems', base, tip, 0.004, { rTop: 0.0025, plan: false })];
      for (const [n, t] of [0.3, 0.52, 0.72, 0.88].entries()) {
        const P = along([base, tip], t);
        const len = lerp(0.075, 0.04, n / 3) * sc * lerp(0.9, 1.05, rand());
        for (const sd of [0, Math.PI]) {
          group.push(
            ...bladeLeaf('leaf', P, len, ovate(len * 0.62, 0.4, 0.7), az + n * (Math.PI / 2) + sd + (rand() - 0.5) * 0.3, lerp(1.15, 0.8, n / 3), {
              segs: n < 2 ? 2 : 1,
              bend: 0.35,
              roll: sd ? 0.3 : -0.3,
              thick: 0.003,
              plan: k === 0 && n === 0,
            }).parts,
          );
        }
      }
      for (const j of range(3)) {
        const len = 0.025 * sc;
        group.push(...bladeLeaf('leaf', tip, len, ovate(len * 0.6, 0.4, 0.7), az + j * 2.1, 0.35, { thick: 0.0025 }).parts);
      }
      parts.push(...fitTo(group, base, lim));
    }
    return contain(parts, lim);
  },
  planDetail: (size) => [circle([0, 0], half(size) * 0.62), canopy(half(size) * 0.88, half(size) * 0.88, 8)],
});

const lavenderPot = defineItem({
  id: 'plant-lavender',
  name: 'Lavender pot',
  category: 'plants',
  type: 'plants',
  group: 'Herbs & edibles',
  plant: PLANT_SPECIES['lavandula-angustifolia'],
  tags: ['lavender', 'lavandula', 'herb', 'purple flowers', 'fragrant', 'zinc pot', 'table plant'],
  description: "Lavender 'Hidcote' with grey-green leaves and purple flower spikes, in a galvanised zinc bucket.",
  defaultSize: { w: 0.26, d: 0.26, h: 0.45 },
  minSize: { w: 0.15, d: 0.15, h: 0.25 },
  maxSize: { w: 0.5, d: 0.5, h: 0.8 },
  slots: [
    matSlot('pot', 'Bucket', 'galvanised-zinc'),
    matSlot('soil', 'Soil', 'potting-soil'),
    matSlot('leaf', 'Leaves & stalks', 'leaf-lavender'),
    matSlot('flower', 'Flowers', 'lavender-purple'),
  ],
  build: (size) => {
    const { h } = size;
    const m = half(size);
    const lim = limOf(size);
    const pot = planter('pot', 'soil', m * 0.6, clamp(h * 0.32, 0.08, 0.2), 'bucket');
    const parts: Part[] = [...pot.parts];
    const rand = rng(2626);
    const H = h - pot.top;
    const C: V3 = [0, pot.top, 0];
    const mound: Part[] = [];
    for (const j of range(24)) {
      // A silvery mound of narrow leaves...
      const len = H * 0.3 * lerp(0.8, 1.1, rand());
      mound.push(...bladeLeaf('leaf', add(C, polar(pot.rIn * 0.3 * rand(), rand() * TAU)), len, strap(Math.max(0.005, len * 0.07), 0.5, 0.8), j * GOLDEN, lerp(0.2, 1.3, j / 23), { thick: 0.002 }).parts);
    }
    parts.push(...fitTo(mound, C, lim));
    // ...with a haze of slim stalks carrying purple flower spikes.
    const F = clamp(Math.round(m * 130), 12, 26);
    const spike = clamp(H * 0.16, 0.025, 0.08);
    for (const _j of range(F)) {
      const az = rand() * TAU;
      const tilt = lerp(0.02, 0.42, Math.sqrt(rand()));
      const base = add(C, polar(pot.rIn * 0.3 * Math.sqrt(rand()), rand() * TAU));
      const dv = dirOf(az, tilt);
      const E = add(base, mul(dv, (H * lerp(0.8, 1, rand())) / Math.cos(tilt) - spike));
      parts.push(
        ...fitTo(
          [rod('leaf', base, E, 0.0013, { plan: false }), leaf('flower', E, spike, 0.011, az, tilt, { thick: 0.011 }), sphere('flower', sub(E, mul(dv, spike * 0.25)), 0.0055, { plan: false })],
          base,
          lim,
        ),
      );
    }
    return contain(parts, lim);
  },
  planDetail: (size) => [circle([0, 0], half(size) * 0.6), canopy(half(size) * 0.7, half(size) * 0.7, 10)],
});

const cactusGarden = defineItem({
  id: 'plant-mini-cactus',
  name: 'Mini cactus garden',
  category: 'plants',
  type: 'plants',
  group: 'Succulents & cacti',
  plant: PLANT_SPECIES['cactus-trough'],
  tags: ['cactus garden', 'mini cacti', 'succulent trough', 'bunny ears', 'golden barrel', 'desk plant'],
  description: 'A concrete trough of small cacti on sand and pebbles: bunny ears, a golden barrel and a flowering mammillaria.',
  defaultSize: { w: 0.32, d: 0.18, h: 0.2 },
  minSize: { w: 0.2, d: 0.12, h: 0.12 },
  maxSize: { w: 0.6, d: 0.35, h: 0.4 },
  slots: [
    matSlot('pot', 'Trough & pebbles', 'concrete-planter'),
    matSlot('sand', 'Sand', 'sand-top'),
    matSlot('cactus', 'Cacti', 'cactus-green'),
    matSlot('flower', 'Flowers', 'cactus-flower-pink'),
  ],
  build: (size) => {
    const { w, d, h } = size;
    const lim = limOf(size);
    const th = clamp(h * 0.35, 0.04, 0.09);
    const pot = boxPlanter('pot', 'sand', w, d, th);
    const parts: Part[] = [...pot.parts];
    const rand = rng(2727);
    const top = pot.top;
    const H = h - top;
    // Golden barrel: a ribbed ball of lobes with a ring of flowers on top.
    const xb = -w * 0.32;
    const rb = Math.min(d * 0.32, H * 0.55, w * 0.13);
    const cb: V3 = [xb, top + rb * 0.8, 0];
    const barrel: Part[] = range(9).map((k) => {
      const a = (k / 9) * TAU;
      return sphere('cactus', add(cb, polar(rb * 0.42, a)), 0.5, { scale: [rb * 0.62, rb * 1.6, rb * 0.42], rotation: [0, -a, 0], plan: k === 0 });
    });
    for (const k of range(4)) barrel.push(sphere('flower', add(cb, polar(rb * 0.3, k * 1.57 + 0.4, rb * 0.72)), rb * 0.14, { plan: false }));
    parts.push(...fitTo(barrel, [xb, top, 0], lim));
    // Slim ribbed column with a side shoot.
    const xc = -w * 0.06;
    const Rc = Math.min(d * 0.16, w * 0.06, 0.03);
    const cTop = top + H * 0.8;
    parts.push(
      ...fitTo(
        [
          prism('cactus', ribOutline(xc, -d * 0.05, Rc, 8), top - 0.004, cTop - top),
          sphere('cactus', [xc, cTop, -d * 0.05], Rc * 0.9, { scale: [1, 0.7, 1], plan: false }),
          prism('cactus', ribOutline(xc + Rc * 1.7, -d * 0.05, Rc * 0.7, 8), top - 0.004, H * 0.42),
          sphere('cactus', [xc + Rc * 1.7, top + H * 0.42, -d * 0.05], Rc * 0.63, { scale: [1, 0.7, 1], plan: false }),
        ],
        [xc, top, -d * 0.05],
        lim,
      ),
    );
    // Bunny-ear prickly pear: flat oval pads stacked on one another.
    const xo = w * 0.2;
    const pw = Math.min(w * 0.11, d * 0.38);
    const ph = Math.min(H * 0.48, pw * 1.3);
    const pads: Part[] = [sphere('cactus', [xo, top + ph * 0.5, 0], 0.5, { scale: [pw, ph, pw * 0.3], plan: true })];
    for (const sd of [-1, 1]) {
      pads.push(sphere('cactus', [xo + sd * pw * 0.32, top + ph * 1.18, 0], 0.5, { scale: [pw * 0.72, ph * 0.72, pw * 0.24], rotation: [0, 0, -sd * 0.45], plan: false }));
    }
    pads.push(sphere('flower', [xo + pw * 0.55, top + ph * 1.5, 0], pw * 0.1, { plan: false }));
    parts.push(...fitTo(pads, [xo, top, 0], lim));
    // Snowball mammillaria crowned with tiny pink flowers.
    const xm = w * 0.38;
    const rm = Math.min(d * 0.25, w * 0.08, H * 0.4);
    const cm: V3 = [xm, top + rm * 0.85, d * 0.05];
    const ball: Part[] = [sphere('cactus', cm, rm, { plan: true })];
    for (const k of range(6)) ball.push(sphere('flower', add(cm, polar(rm * 0.55, (k * TAU) / 6, rm * 0.8)), rm * 0.16, { plan: false }));
    parts.push(...fitTo(ball, [xm, top, d * 0.05], lim));
    // White pebbles on the sand.
    for (const _k of range(6)) {
      const r = Math.min(0.008, d * 0.04) * lerp(0.7, 1.2, rand());
      parts.push(sphere('pot', [lerp(-pot.hx + r, pot.hx - r, rand()), top + r * 0.3, lerp(-pot.hz + r, pot.hz - r, rand())], r, { scale: [1, 0.6, 0.85], plan: false }));
    }
    return contain(parts, lim);
  },
  planDetail: ({ w, d }) => [rectPoly(-w / 2 + 0.012, -d / 2 + 0.012, w / 2 - 0.012, d / 2 - 0.012), circle([-w * 0.32, 0], Math.min(d * 0.32, w * 0.13))],
});

// ---------------------------------------------------------------------------
// Pattern drawing helpers
// ---------------------------------------------------------------------------

/** Smooth tiling wave: integer frequencies keep the tile seamless. */
const wave = (u: number, v: number, fu: number, fv: number, ph: number): number => Math.sin(TAU * (fu * u + fv * v) + ph);

/** Adds a soft round dab to a wrapped luminance field. */
function dab(L: Float32Array, N: number, cx: number, cy: number, r: number, amt: number, soft = 1): void {
  const R = Math.ceil(r + soft + 1);
  const x0 = Math.floor(cx);
  const y0 = Math.floor(cy);
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      const d = Math.hypot(x0 + dx + 0.5 - cx, y0 + dy + 0.5 - cy);
      const f = d < r ? 1 : d < r + soft ? 1 - (d - r) / soft : 0;
      if (f <= 0) continue;
      const x = (((x0 + dx) % N) + N) % N;
      const y = (((y0 + dy) % N) + N) % N;
      L[y * N + x] += amt * f;
    }
  }
}

/**
 * Leaf venation on a tile whose left/right edge is the midrib (u = 0). Leaf UVs run across the
 * blade (u) and along it (v, tip up), so the lateral veins rise in chevrons towards the tip.
 * Returns the vein and midrib strengths (0–1) at a pixel.
 */
function venation(u: number, v: number, veins: number): [number, number] {
  const du = Math.min(u, 1 - u);
  const q = (v + 0.85 * du + 1.1 * du * du) * veins;
  const fq = Math.abs(q - Math.round(q)) / veins;
  const vein = Math.exp(-Math.pow(fq / (0.0045 + du * 0.004), 2)) * (1 - Math.min(1, du / 0.5) * 0.5);
  const rib = Math.exp(-Math.pow(du / 0.008, 2));
  return [vein, rib];
}

function grey(ctx: CanvasRenderingContext2D, N: number, L: Float32Array): void {
  const img = ctx.createImageData(N, N);
  for (let i = 0; i < N * N; i++) {
    const g = Math.round(clamp(L[i], 0, 1) * 255);
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = g;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

export default definePack({
  name: 'Indoor plants',
  version: '1.0.0',
  author: 'Neest team',
  description:
    'Twenty-seven botanically shaped houseplants: tropical floor plants and trees, palms, cacti and agave, plus table plants, succulents and herbs, each in its own pot.',
  license: 'CC0 (made for Neest)',
  items: [
    birdOfParadise,
    rubberPlant,
    zzPlant,
    peaceLily,
    arecaPalm,
    yuccaCane,
    dragonTree,
    elephantEar,
    bananaPlant,
    weepingFig,
    umbrellaTree,
    columnCactus,
    agave,
    calathea,
    croton,
    philodendron,
    lemonTree,
    aloeVera,
    jadePlant,
    moneyPlant,
    africanViolet,
    haworthia,
    echeveriaBowl,
    peperomia,
    basilPot,
    lavenderPot,
    cactusGarden,
  ],
  patterns: [
    {
      id: 'leaf-veins',
      name: 'Leaf venation',
      normalStrength: 0.5,
      // Near-white blade with a darker midrib (tile edge) and chevron side veins; tinted by the leaf colour.
      draw(ctx, size, rand) {
        const N = size;
        const L = new Float32Array(N * N);
        const ph = range(4).map(() => rand() * TAU);
        for (let y = 0; y < N; y++) {
          for (let x = 0; x < N; x++) {
            const u = x / N;
            const v = y / N;
            const [vein, rib] = venation(u, v, 7);
            const net = Math.pow(Math.abs(wave(u, v, 31, 17, ph[0]) * wave(u, v, -23, 29, ph[1])), 6);
            L[y * N + x] = 0.93 + 0.025 * wave(u, v, 2, 3, ph[2]) + 0.015 * wave(u, v, 5, -4, ph[3]) - 0.07 * net - 0.24 * vein - 0.32 * rib;
          }
        }
        for (let i = 0; i < 400; i++) dab(L, N, rand() * N, rand() * N, 0.6 + rand() * 1.2, -0.03 - rand() * 0.04);
        grey(ctx, N, L);
      },
    },
    {
      id: 'leaf-variegated',
      name: 'Variegated leaf',
      normalStrength: 0.4,
      colored: true,
      // Green blade with golden veins, yellow-cream splashes and gold-dust specks (croton-style).
      draw(ctx, size, rand) {
        const N = size;
        const B = new Float32Array(N * N);
        for (let i = 0; i < 70; i++) dab(B, N, rand() * N, rand() * N, N * (0.008 + rand() * 0.04), 0.5 + rand() * 0.6, N * 0.015);
        for (let i = 0; i < 500; i++) dab(B, N, rand() * N, rand() * N, 0.8 + rand() * 2.2, 0.8, 1);
        const ph = range(3).map(() => rand() * TAU);
        const img = ctx.createImageData(N, N);
        for (let y = 0; y < N; y++) {
          for (let x = 0; x < N; x++) {
            const u = x / N;
            const v = y / N;
            const i = y * N + x;
            const [vein, rib] = venation(u, v, 6);
            const tone = 0.92 + 0.08 * wave(u, v, 3, 2, ph[0]) * wave(u, v, -2, 5, ph[1]);
            let r = 0.22 * tone;
            let g = 0.42 * tone;
            let b = 0.17 * tone;
            const splash = clamp(B[i] + 0.12 * wave(u, v, 4, 7, ph[2]), 0, 1);
            r = lerp(r, 0.93, splash);
            g = lerp(g, 0.84, splash);
            b = lerp(b, 0.42, splash);
            const gold = clamp(Math.max(vein * 1.4, rib * 1.2), 0, 1);
            r = lerp(r, 0.96, gold);
            g = lerp(g, 0.78, gold);
            b = lerp(b, 0.22, gold);
            img.data[i * 4] = Math.round(clamp(r, 0, 1) * 255);
            img.data[i * 4 + 1] = Math.round(clamp(g, 0, 1) * 255);
            img.data[i * 4 + 2] = Math.round(clamp(b, 0, 1) * 255);
            img.data[i * 4 + 3] = 255;
          }
        }
        ctx.putImageData(img, 0, 0);
      },
    },
    {
      id: 'terracotta-grog',
      name: 'Terracotta with grog',
      normalStrength: 0.6,
      // Fired clay: soft mottling, faint throwing rings and specks of grog, dark and light.
      draw(ctx, size, rand) {
        const N = size;
        const L = new Float32Array(N * N);
        const ph = range(4).map(() => rand() * TAU);
        for (let y = 0; y < N; y++) {
          for (let x = 0; x < N; x++) {
            const u = x / N;
            const v = y / N;
            L[y * N + x] =
              0.88 + 0.035 * wave(u, v, 1, 2, ph[0]) + 0.025 * wave(u, v, 3, -1, ph[1]) + 0.015 * wave(u, v, 0, 26, ph[2]) + 0.008 * wave(u, v, 0, 61, ph[3]) + (rand() - 0.5) * 0.04;
          }
        }
        for (let i = 0; i < 1600; i++) {
          const dark = rand() < 0.65;
          dab(L, N, rand() * N, rand() * N, 0.5 + rand() * 1.8, dark ? -0.12 - rand() * 0.18 : 0.06 + rand() * 0.06, 0.8);
        }
        grey(ctx, N, L);
      },
    },
    {
      id: 'glazed-speckle',
      name: 'Speckled glaze',
      normalStrength: 0.15,
      // Glossy stoneware glaze with gentle pooling and iron speckles bleeding through.
      draw(ctx, size, rand) {
        const N = size;
        const L = new Float32Array(N * N);
        const ph = range(3).map(() => rand() * TAU);
        for (let y = 0; y < N; y++) {
          for (let x = 0; x < N; x++) {
            const u = x / N;
            const v = y / N;
            L[y * N + x] = 0.95 + 0.02 * wave(u, v, 1, 1, ph[0]) + 0.015 * wave(u, v, 2, -3, ph[1]) + 0.01 * wave(u, v, 0, 5, ph[2]) + (rand() - 0.5) * 0.012;
          }
        }
        for (let i = 0; i < 750; i++) dab(L, N, rand() * N, rand() * N, 0.4 + rand() * 1.0, -0.35 - rand() * 0.25, 0.7);
        for (let i = 0; i < 45; i++) {
          const cx = rand() * N;
          const cy = rand() * N;
          const r = 1.6 + rand() * 1.8;
          dab(L, N, cx, cy, r * 2, -0.08, r);
          dab(L, N, cx, cy, r, -0.3, 0.8);
        }
        grey(ctx, N, L);
      },
    },
  ],
  materials: [
    // Leaves
    { id: 'leaf-raven', name: 'Raven near-black leaf', color: '#121a14', roughness: 0.18 },
    { id: 'leaf-glossy-dark', name: 'Glossy dark leaf', color: '#22432a', roughness: 0.28, pattern: { id: 'leaf-veins', scale: 0.3, contrast: 0.7 } },
    { id: 'leaf-strelitzia', name: 'Strelitzia leaf', color: '#3c6c4c', roughness: 0.4, pattern: { id: 'leaf-veins', scale: 0.9, contrast: 0.5 } },
    { id: 'leaf-burgundy', name: 'Burgundy rubber leaf', color: '#3b1d25', roughness: 0.22, pattern: { id: 'leaf-veins', scale: 0.4, contrast: 0.5 } },
    { id: 'leaf-banana', name: 'Banana leaf', color: '#7db34c', roughness: 0.5, pattern: { id: 'leaf-veins', scale: 1.2, contrast: 0.55 } },
    { id: 'leaf-alocasia', name: 'Alocasia leaf', color: '#183427', roughness: 0.3, pattern: { id: 'leaf-veins', scale: 0.9, contrast: 0.35 } },
    { id: 'leaf-calathea', name: 'Calathea leaf', color: '#1f3e2c', roughness: 0.5, pattern: { id: 'leaf-veins', scale: 0.4, contrast: 0.6 } },
    { id: 'leaf-calathea-feather', name: 'Silvery leaf marking', color: '#a6c79c', roughness: 0.55, pattern: { id: 'leaf-veins', scale: 0.25, contrast: 0.6 } },
    { id: 'leaf-purple-underside', name: 'Purple leaf underside', color: '#5b2443', roughness: 0.6 },
    { id: 'leaf-philodendron', name: 'Philodendron leaf', color: '#2e5f2a', roughness: 0.35, pattern: { id: 'leaf-veins', scale: 0.5, contrast: 0.6 } },
    { id: 'leaf-schefflera', name: 'Schefflera leaf', color: '#2f6a2b', roughness: 0.3, pattern: { id: 'leaf-veins', scale: 0.2, contrast: 0.6 } },
    { id: 'leaf-ficus', name: 'Ficus leaf', color: '#335c27', roughness: 0.3 },
    { id: 'leaf-citrus', name: 'Citrus leaf', color: '#2b5021', roughness: 0.3 },
    { id: 'leaf-palm', name: 'Palm frond', color: '#7ba43f', roughness: 0.55 },
    { id: 'leaf-sword', name: 'Yucca leaf', color: '#3f6e35', roughness: 0.45 },
    { id: 'leaf-dracaena', name: 'Dracaena leaf', color: '#284d2d', roughness: 0.45 },
    { id: 'leaf-red-edge', name: 'Red-edged leaf', color: '#7a2433', roughness: 0.5 },
    { id: 'leaf-agave', name: 'Agave blue-grey', color: '#7f9e98', roughness: 0.7 },
    { id: 'leaf-aloe', name: 'Aloe green', color: '#7b9a68', roughness: 0.5, pattern: { id: 'glazed-speckle', scale: 0.12, contrast: 0.35 } },
    { id: 'leaf-jade', name: 'Jade leaf', color: '#4b7a37', roughness: 0.28 },
    { id: 'leaf-pilea', name: 'Pilea leaf', color: '#5a9440', roughness: 0.45 },
    { id: 'leaf-velvet', name: 'Velvet leaf', category: 'fabric', color: '#2d4a2b', roughness: 0.95, pattern: { id: 'leaf-veins', scale: 0.12, contrast: 0.6 } },
    { id: 'leaf-haworthia', name: 'Haworthia green', color: '#2a4530', roughness: 0.45 },
    { id: 'echeveria-blue', name: 'Echeveria blue', color: '#8fb2aa', roughness: 0.65 },
    { id: 'echeveria-pink', name: 'Echeveria pink', color: '#c79ba9', roughness: 0.6 },
    { id: 'leaf-peperomia-dark', name: 'Peperomia green', color: '#1e3b24', roughness: 0.3 },
    { id: 'leaf-peperomia-silver', name: 'Peperomia silver', color: '#b7c9b0', roughness: 0.35 },
    { id: 'leaf-basil', name: 'Basil leaf', color: '#5ea33a', roughness: 0.5, pattern: { id: 'leaf-veins', scale: 0.1, contrast: 0.6 } },
    { id: 'leaf-lavender', name: 'Lavender foliage', color: '#8ea58b', roughness: 0.8 },
    { id: 'croton-gold', name: 'Croton gold', color: '#ffffff', roughness: 0.35, pattern: { id: 'leaf-variegated', scale: 0.26 } },
    { id: 'croton-red', name: 'Croton red', color: '#ff7a5c', roughness: 0.35, pattern: { id: 'leaf-variegated', scale: 0.26 } },
    { id: 'cactus-blue', name: 'Blue cactus', color: '#567f6c', roughness: 0.6 },
    { id: 'cactus-green', name: 'Cactus green', color: '#3f6e47', roughness: 0.6 },
    // Flowers and fruit
    { id: 'spathe-white', name: 'Peace lily white', color: '#f4f3ec', roughness: 0.6, pattern: { id: 'leaf-veins', scale: 0.25, contrast: 0.3 } },
    { id: 'spadix-cream', name: 'Spadix cream', color: '#e9dca0', roughness: 0.85 },
    { id: 'violet-purple', name: 'Violet purple', color: '#6b3aa6', roughness: 0.85 },
    { id: 'pollen-yellow', name: 'Pollen yellow', color: '#f2c524', roughness: 0.6 },
    { id: 'lavender-purple', name: 'Lavender purple', color: '#7a62b5', roughness: 0.85 },
    { id: 'lemon-yellow', name: 'Lemon yellow', color: '#f0cd2e', roughness: 0.4 },
    { id: 'cactus-flower-pink', name: 'Cactus flower pink', color: '#e8579a', roughness: 0.6 },
    { id: 'spine-cream', name: 'Cactus areoles', color: '#efe7cf', roughness: 0.85 },
    { id: 'spine-dark', name: 'Dark spines', color: '#3b2a1e', roughness: 0.6 },
    { id: 'tubercle-white', name: 'Haworthia stripes', color: '#e9efe4', roughness: 0.7 },
    { id: 'sheath-red', name: 'Rubber plant sheath', color: '#b3263a', roughness: 0.3 },
    // Stems and wood
    { id: 'stem-green', name: 'Green stem', color: '#5f8a3a', roughness: 0.6 },
    { id: 'stem-dark', name: 'Dark green stalk', color: '#2b4a28', roughness: 0.45 },
    { id: 'stem-red', name: 'Red stalk', color: '#8b2f33', roughness: 0.5 },
    { id: 'vein-pale', name: 'Pale veins', color: '#cfe3c4', roughness: 0.5 },
    { id: 'cane-gold', name: 'Palm cane', color: '#a9a24c', roughness: 0.5 },
    { id: 'banana-stem', name: 'Banana stem', color: '#6f8846', roughness: 0.6, pattern: { id: 'wood-grain', scale: 0.4, contrast: 0.4 } },
    { id: 'bark-brown', name: 'Brown bark', category: 'wood', color: '#5d4a3a', roughness: 0.85, pattern: { id: 'wood-grain', scale: 0.15, contrast: 0.6 } },
    { id: 'bark-grey', name: 'Grey bark', category: 'wood', color: '#7b7166', roughness: 0.85, pattern: { id: 'wood-grain', scale: 0.2, contrast: 0.6 } },
    { id: 'yucca-bark', name: 'Yucca cane bark', category: 'wood', color: '#8b7a5e', roughness: 0.9, pattern: { id: 'wood-grain', scale: 0.25, contrast: 0.8 } },
    { id: 'jade-trunk', name: 'Jade trunk', color: '#6f6a45', roughness: 0.6, pattern: { id: 'wood-grain', scale: 0.12, contrast: 0.5 } },
    // Pots and ground
    { id: 'terracotta', name: 'Terracotta', category: 'stone', color: '#b8643c', roughness: 0.85, pattern: { id: 'terracotta-grog', scale: 0.3 } },
    { id: 'ceramic-matte-white', name: 'Matte white ceramic', category: 'stone', color: '#ece9e2', roughness: 0.75, pattern: { id: 'glazed-speckle', scale: 0.4, contrast: 0.35 } },
    { id: 'ceramic-black', name: 'Black glazed ceramic', category: 'stone', color: '#252527', roughness: 0.32, pattern: { id: 'glazed-speckle', scale: 0.3, contrast: 0.5 } },
    { id: 'speckled-stoneware', name: 'Speckled stoneware', category: 'stone', color: '#ddd3c2', roughness: 0.5, pattern: { id: 'glazed-speckle', scale: 0.25 } },
    { id: 'glazed-blue', name: 'Blue glazed ceramic', category: 'stone', color: '#3f6385', roughness: 0.25, pattern: { id: 'glazed-speckle', scale: 0.25, contrast: 0.6 } },
    { id: 'concrete-planter', name: 'Concrete planter', category: 'stone', color: '#9c9a94', roughness: 0.9, pattern: { id: 'concrete', scale: 0.6 } },
    { id: 'woven-basket', name: 'Woven basket', category: 'fabric', color: '#b88f58', roughness: 0.9, pattern: { id: 'jute', scale: 0.12 } },
    { id: 'galvanised-zinc', name: 'Galvanised zinc', category: 'metal', color: '#a3abad', roughness: 0.45, metalness: 0.7, pattern: { id: 'brushed', scale: 0.3 } },
    { id: 'potting-soil', name: 'Potting soil', color: '#3a2a1f', roughness: 1, pattern: { id: 'terracotta-grog', scale: 0.08, contrast: 0.7 } },
    { id: 'gravel-top', name: 'Gravel top dressing', category: 'stone', color: '#b5ada0', roughness: 0.95, pattern: { id: 'terrazzo', scale: 0.12 } },
    { id: 'sand-top', name: 'Desert sand', category: 'stone', color: '#d8c49a', roughness: 1, pattern: { id: 'glazed-speckle', scale: 0.08, contrast: 0.6 } },
  ],
});

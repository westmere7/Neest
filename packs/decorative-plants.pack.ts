/**
 * Hanging & decorative plants — trailing, wall-mounted, cut-flower and terrarium greenery.
 *
 * Everything is built from small procedural pieces: trailing vines are chains of leaves along
 * drooping rod paths, fern fronds are comb-shaped plates bent in segments, flower heads are rings
 * of flattened-sphere petals, and flat leaf outlines (ivy, staghorn, lily petals) are thin prisms
 * stood up in any direction. Four pack patterns add surface detail: leaf veins, moss, twisted
 * macramé cord and a watercolour petal wash.
 */
import {
  arcPoints,
  blobCluster,
  cells,
  circle,
  clamp,
  cyl,
  defineItem,
  definePack,
  ellipsePoints,
  frame4,
  lathe,
  lerp,
  line,
  matSlot,
  poly,
  pot,
  prism,
  range,
  rectPoly,
  ring,
  rng,
  rod,
  rodPath,
  roundRectPoints,
  span,
  sphere,
  torus,
  vcyl,
  type Part,
  type V2,
  type V3,
} from '@/packs/kit';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Ceiling height that hanging items are hung from (top of the item box). */
const CEIL = 2.7;
const TAU = Math.PI * 2;
const NP = { plan: false };
const UP: V3 = [0, 1, 0];
const FRONT: V3 = [0, 0, 1];

/**
 * Pattern tile size (m) for leaves and petals built as flattened spheres (radius 0.5, scaled):
 * one tile spans one leaf face, so the vein pattern's midrib runs down the middle.
 */
const SPHERE_TILE = Math.PI / 2;
/** Tile sizes for flat (prism) leaf outlines; plates are offset by half a tile to centre the midrib. */
const IVY_TILE = 0.06;
const STAG_TILE = 0.12;
const SPIDER_TILE = 0.03;
const LILY_TILE = 0.1;
const STRAP_TILE = 0.05;

// ---------------------------------------------------------------------------
// Vector helpers
// ---------------------------------------------------------------------------

const vAdd = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const vSub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const vMul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const vDot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const vCross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const vLen = (a: V3): number => Math.hypot(a[0], a[1], a[2]);
const vMix = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
function vNorm(a: V3, fallback: V3 = UP): V3 {
  const l = vLen(a);
  return l < 1e-9 ? fallback : [a[0] / l, a[1] / l, a[2] / l];
}
/** Point at azimuth `az` (0 = +x, π/2 = +z front), radius `rad`, height `y`. */
const polar = (az: number, rad: number, y: number): V3 => [Math.cos(az) * rad, y, Math.sin(az) * rad];
/** Unit direction at azimuth `az`, tilted `tilt` from vertical. */
const dirAt = (az: number, tilt: number): V3 => [Math.sin(tilt) * Math.cos(az), Math.cos(tilt), Math.sin(tilt) * Math.sin(az)];
/** Any unit vector perpendicular to `a`. */
function perp(a: V3): V3 {
  const h: V3 = Math.abs(a[1]) < 0.9 ? UP : [1, 0, 0];
  return vNorm(vCross(h, a), [1, 0, 0]);
}
/** The direction closest to `target` that is perpendicular to `dir`. */
function faceToward(dir: V3, target: V3): V3 {
  return vNorm(vSub(target, vMul(dir, vDot(target, dir))), perp(dir));
}
/** Rotate `v` about the unit `axis` by `ang` (Rodrigues). */
function rotAbout(v: V3, axis: V3, ang: number): V3 {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return vAdd(vAdd(vMul(v, c), vMul(vCross(axis, v), s)), vMul(axis, vDot(axis, v) * (1 - c)));
}

/** Orthonormal frame with local y along `ya` and local z as close to `za` as possible. */
function frameOf(ya: V3, za: V3): [V3, V3, V3] {
  const y = vNorm(ya);
  const z = vNorm(vSub(za, vMul(y, vDot(za, y))), perp(y));
  return [vCross(y, z), y, z];
}

/** Euler XYZ angles (three.js order) of the rotation taking local x/y/z onto the given axes. */
function eulerOf([x, y, z]: [V3, V3, V3]): V3 {
  const m13 = z[0];
  const ey = Math.asin(clamp(m13, -1, 1));
  if (Math.abs(m13) < 0.9999999) return [Math.atan2(-z[1], z[2]), ey, Math.atan2(-y[0], x[0])];
  return [Math.atan2(y[2], y[1]), ey, 0];
}

// ---------------------------------------------------------------------------
// Part helpers: oriented ellipsoids, plates, outlines
// ---------------------------------------------------------------------------

/** Ellipsoid centred at `c`: `sy` long along `ya`, `sz` thick along `za`, `sx` wide. */
function ellip(slot: string, c: V3, sx: number, sy: number, sz: number, ya: V3, za: V3): Part {
  return sphere(slot, c, 0.5, { scale: [sx, sy, sz], rotation: eulerOf(frameOf(ya, za)), plan: false });
}

/** Petal / leaf as a flattened ellipsoid growing from `base` along `dir`, its face normal near `nrm`. */
function petal(slot: string, base: V3, dir: V3, nrm: V3, len: number, wid: number, thick: number): Part {
  return ellip(slot, vAdd(base, vMul(dir, len / 2)), wid, len, thick, dir, nrm);
}

/**
 * Flat outline (a thin prism) stood up in any direction: `outline` points are [across, along],
 * with `along` running from `base` in direction `dir`; the face looks towards `nrm`.
 * `uOff` shifts the texture so a vein tile of 2·uOff is centred on the leaf's midrib.
 */
function plate(slot: string, outline: V2[], base: V3, dir: V3, nrm: V3, t = 0.0025, uOff = 0): Part {
  const f = frameOf(nrm, dir);
  const position = vSub(vSub(base, vMul(f[0], uOff)), vMul(f[1], t / 2));
  return {
    shape: 'prism',
    outline: outline.map(([a, b]) => [a + uOff, b] as V2),
    height: t,
    position,
    rotation: eulerOf(f),
    slot,
    plan: false,
  };
}

/** A flat shape facing the front (+z): `pts` are [x, y] in metres, `t` thick from depth z. */
function facePlate(slot: string, pts: V2[], z: number, t: number): Part {
  const ys = pts.map((p) => p[1]);
  const mid = (Math.min(...ys) + Math.max(...ys)) / 2;
  const xs = pts.map((p) => p[0]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  return {
    shape: 'prism',
    outline: pts.map(([x, y]) => [x - cx, -(y - mid)] as V2),
    height: t,
    position: [cx, mid, z],
    rotation: [Math.PI / 2, 0, 0],
    slot,
    plan: false,
  };
}

/** Surface of revolution whose axis points to the front (+z); `profile` is [r, z] about centre `c`. */
function latheFront(slot: string, c: V3, profile: V2[]): Part {
  const ys = profile.map((p) => p[1]);
  const mid = (Math.min(...ys) + Math.max(...ys)) / 2;
  return {
    shape: 'lathe',
    profile: profile.map(([r, y]) => [Math.max(0, r), y - mid] as V2),
    segments: 28,
    position: [c[0], c[1], c[2] + mid],
    rotation: [Math.PI / 2, 0, 0],
    slot,
  };
}

/** Planar polygon (3+ coplanar points) as a thin glass/metal panel. */
function panel(slot: string, pts: V3[], t = 0.002): Part {
  const p0 = pts[0];
  const x = vNorm(vSub(pts[1], p0));
  const y = vNorm(vCross(vSub(pts[1], p0), vSub(pts[2], p0)));
  const z = vCross(x, y);
  return {
    shape: 'prism',
    outline: pts.map((q) => [vDot(vSub(q, p0), x), vDot(vSub(q, p0), z)] as V2),
    height: t,
    position: vSub(p0, vMul(y, t / 2)),
    rotation: eulerOf([x, y, z]),
    slot,
    plan: false,
  };
}

/** Lanceolate (pointed) leaf outline, `len` long and `wid` wide, base `b` × width. */
function lanceOutline(len: number, wid: number, b = 0.35): V2[] {
  return [
    [-wid * b * 0.5, 0],
    [wid * b * 0.5, 0],
    [wid * 0.5, len * 0.4],
    [wid * 0.3, len * 0.75],
    [0, len],
    [-wid * 0.3, len * 0.75],
    [-wid * 0.5, len * 0.4],
  ];
}

/** Tapered strap; pointed when `w1` is (near) zero. */
function strapOutline(len: number, w0: number, w1: number): V2[] {
  if (w1 < 0.002) return [[-w0 / 2, 0], [w0 / 2, 0], [0, len]];
  return [[-w0 / 2, 0], [w0 / 2, 0], [w1 / 2, len], [-w1 / 2, len]];
}

/** Strap with a rounded tip (staghorn antler lobe). */
function lobeOutline(len: number, w0: number, w1: number): V2[] {
  return [
    [-w0 / 2, 0],
    [w0 / 2, 0],
    [w1 / 2, len * 0.72],
    [w1 * 0.3, len * 0.95],
    [0, len],
    [-w1 * 0.3, len * 0.95],
    [-w1 / 2, len * 0.72],
  ];
}

/** Five-lobed English ivy leaf, `s` long. */
function ivyOutline(s: number): V2[] {
  const right: V2[] = [
    [0.2, 0],
    [0.42, 0.12],
    [0.28, 0.3],
    [0.46, 0.52],
    [0.22, 0.62],
    [0.12, 0.85],
  ];
  return [
    [0, 0.06 * s],
    ...right.map(([a, b]) => [a * s, b * s] as V2),
    [0, s],
    ...right.reverse().map(([a, b]) => [-a * s, b * s] as V2),
  ];
}

/** Fern pinnae comb: a rachis with `teeth` leaflets per side, tapering from `w0` to `w1`. */
function combOutline(len: number, w0: number, w1: number, teeth: number): V2[] {
  const rh = 0.0022;
  const s = len / teeth;
  const right: V2[] = [[rh, 0]];
  for (let i = 0; i < teeth; i++) {
    const a = s * i;
    const hw = Math.max(rh * 1.8, lerp(w0, w1, (i + 0.6) / teeth) / 2);
    right.push([hw * 0.8, a + s * 0.3], [hw, a + s * 0.62], [rh, a + s * 0.95]);
  }
  const left = right.map(([a, b]) => [-a, b] as V2).reverse();
  return [...right, [0, len], ...left];
}

const frondTaper = (t: number): number => (t < 0.25 ? lerp(0.55, 1, t / 0.25) : lerp(1, 0.12, (t - 0.25) / 0.75));

/**
 * Fern frond: comb plates bent through the elevation angles `elevs` (radians above horizontal,
 * one per segment) at azimuth `az`, starting at `base`.
 */
function frond(slot: string, base: V3, az: number, len: number, wid: number, elevs: number[], rand: () => number, teeth = 6): Part[] {
  const parts: Part[] = [];
  const n = elevs.length;
  const seg = len / n;
  const roll = (rand() - 0.5) * 0.6;
  const side: V3 = [-Math.sin(az), 0, Math.cos(az)];
  let p = base;
  for (let s = 0; s < n; s++) {
    const e = elevs[s];
    const dir: V3 = [Math.cos(e) * Math.cos(az), Math.sin(e), Math.cos(e) * Math.sin(az)];
    const up: V3 = [-Math.sin(e) * Math.cos(az), Math.cos(e), -Math.sin(e) * Math.sin(az)];
    const nrm = vNorm(vAdd(up, vMul(side, roll)));
    parts.push(plate(slot, combOutline(seg * 1.04, wid * frondTaper(s / n), wid * frondTaper((s + 1) / n), teeth), p, dir, nrm));
    p = vAdd(p, vMul(dir, seg));
  }
  return parts;
}

/** Arching strap leaf (spider plant, tulip, grasses) bent through `elevs`, pointed at the tip. */
function strapLeaf(slot: string, base: V3, az: number, len: number, wid: number, elevs: number[], uOff = 0, t = 0.0025): Part[] {
  const parts: Part[] = [];
  const n = elevs.length;
  const seg = len / n;
  let p = base;
  const wAt = (k: number) => wid * (k === 0 ? 0.65 : Math.max(0, 1 - Math.pow(k / n, 2.2)));
  for (let s = 0; s < n; s++) {
    const e = elevs[s];
    const dir: V3 = [Math.cos(e) * Math.cos(az), Math.sin(e), Math.cos(e) * Math.sin(az)];
    const up: V3 = [-Math.sin(e) * Math.cos(az), Math.cos(e), -Math.sin(e) * Math.sin(az)];
    parts.push(plate(slot, strapOutline(seg * 1.03, wAt(s), s === n - 1 ? 0 : wAt(s + 1)), p, dir, up, t, uOff));
    p = vAdd(p, vMul(dir, seg));
  }
  return parts;
}

/** Ring of `n` petals round axis `ax` at `c`; `cup` 0 = flat and open, π/2 = closed along the axis. */
function petalRing(slot: string, c: V3, ax: V3, n: number, len: number, wid: number, thick: number, cup: number, rot0 = 0, baseR = 0): Part[] {
  const a = vNorm(ax);
  const e1 = perp(a);
  const e2 = vCross(a, e1);
  return range(n).map((k) => {
    const ang = rot0 + (k / n) * TAU;
    const rk = vAdd(vMul(e1, Math.cos(ang)), vMul(e2, Math.sin(ang)));
    const dir = vNorm(vAdd(vMul(rk, Math.cos(cup)), vMul(a, Math.sin(cup))));
    const nrm = vNorm(vSub(vMul(a, Math.cos(cup)), vMul(rk, Math.sin(cup))));
    return petal(slot, vAdd(c, vMul(rk, baseR)), dir, nrm, len, wid, thick);
  });
}

/** Point and unit tangent at fraction `f` along a polyline. */
function alongPath(pts: V3[], f: number): { p: V3; t: V3 } {
  const lens = pts.slice(1).map((q, i) => vLen(vSub(q, pts[i])));
  const total = lens.reduce((s, l) => s + l, 0) || 1;
  let target = clamp(f, 0, 1) * total;
  for (let i = 0; i < lens.length; i++) {
    if (target <= lens[i] || i === lens.length - 1) {
      const k = lens[i] > 0 ? clamp(target / lens[i], 0, 1) : 0;
      return { p: vMix(pts[i], pts[i + 1], k), t: vNorm(vSub(pts[i + 1], pts[i])) };
    }
    target -= lens[i];
  }
  return { p: pts[0], t: UP };
}

/** Trailing vine path: leaves `start`, arcs out along azimuth `az` by `reach` and hangs to `yEnd`. */
function vinePath(start: V3, az: number, reach: number, yEnd: number, n: number, rand: () => number): V3[] {
  const c = Math.cos(az);
  const s = Math.sin(az);
  const sway = (rand() - 0.5) * 0.06;
  const ph = rand() * TAU;
  return range(n + 1).map((i) => {
    const t = i / n;
    const rr = reach * Math.sin((Math.min(1, t * 2.2) * Math.PI) / 2);
    const y = lerp(start[1], yEnd, Math.pow(t, 1.25)) + 0.025 * Math.sin(Math.PI * Math.min(1, t * 3));
    const sw = sway * t + 0.012 * Math.sin(ph + t * 5) * t;
    return [start[0] + c * rr - s * sw, y, start[2] + s * rr + c * sw] as V3;
  });
}

/** Pot (closed lathe) with a soil disc just under the rim. */
function potted(potSlot: string, soilSlot: string, base: V3, r: number, h: number, style: 'taper' | 'cylinder' | 'bowl' | 'urn' | 'belly'): Part[] {
  return [pot(potSlot, base, r, h, style), cyl(soilSlot, [base[0], base[1] + h * 0.9, base[2]], r * 0.86, 0.012, NP)];
}

/**
 * Hanging cords from a hook ring at the top of the item box (`h`) down to `n` points on a pot rim
 * of radius `rimR` at `rimY`. `knots` adds a gathering knot on each cord; `underY` carries the cords
 * on under the pot to a bottom knot with a short tassel.
 */
function hanger(slot: string, h: number, rimY: number, rimR: number, n: number, opts?: { knots?: boolean; underY?: number; r?: number; az0?: number }): Part[] {
  const cr = opts?.r ?? 0.0032;
  const apex: V3 = [0, h - 0.045, 0];
  const parts: Part[] = [torus(slot, [0, h - 0.021, 0], 0.016, 0.004, NP), sphere(slot, apex, 0.011, NP)];
  for (const k of range(n)) {
    const a = (opts?.az0 ?? Math.PI / 6) + (k / n) * TAU;
    const rim = polar(a, rimR, rimY);
    const pts: V3[] = [apex];
    if (opts?.knots) {
      const m = vMix(apex, rim, 0.55);
      pts.push(m);
      parts.push(sphere(slot, m, cr * 2.3, NP));
    }
    pts.push(rim);
    const uy = opts?.underY;
    if (uy !== undefined) pts.push(polar(a, rimR * 0.8, lerp(uy, rimY, 0.3)), [0, uy - 0.012, 0]);
    parts.push(...rodPath(slot, pts, cr));
  }
  const uy = opts?.underY;
  if (uy !== undefined) {
    parts.push(sphere(slot, [0, uy - 0.02, 0], 0.012, NP));
    if (uy > 0.12) parts.push(vcyl(slot, 0, 0, uy - 0.11, uy - 0.025, 0.003, { rTop: 0.008, plan: false }));
  }
  return parts;
}

// ---------------------------------------------------------------------------
// Fitting: uniformly shrink a group of parts about an anchor so it stays inside a box
// ---------------------------------------------------------------------------

type Box = [V3, V3];

function rotXYZ(v: V3, [ax, ay, az]: V3): V3 {
  let [x, y, z] = v;
  [x, y] = [x * Math.cos(az) - y * Math.sin(az), x * Math.sin(az) + y * Math.cos(az)];
  [x, z] = [x * Math.cos(ay) + z * Math.sin(ay), -x * Math.sin(ay) + z * Math.cos(ay)];
  [y, z] = [y * Math.cos(ax) - z * Math.sin(ax), y * Math.sin(ax) + z * Math.cos(ax)];
  return [x, y, z];
}

/** Conservative axis-aligned bounds of a part (same rules as the library checks). */
function partBox(p: Part): Box {
  let mn: V3;
  let mx: V3;
  switch (p.shape) {
    case 'box':
      mn = vMul(p.size, -0.5);
      mx = vMul(p.size, 0.5);
      break;
    case 'cylinder': {
      const r = Math.max(p.radiusTop, p.radiusBottom);
      mn = [-r, -p.height / 2, -r];
      mx = [r, p.height / 2, r];
      break;
    }
    case 'sphere':
      mn = [-p.radius, -p.radius, -p.radius];
      mx = [p.radius, p.radius, p.radius];
      break;
    case 'torus': {
      const r = p.radius + p.tube;
      mn = [-r, -r, -p.tube];
      mx = [r, r, p.tube];
      break;
    }
    case 'lathe': {
      const r = Math.max(...p.profile.map((q) => q[0]));
      const ys = p.profile.map((q) => q[1]);
      mn = [-r, Math.min(...ys), -r];
      mx = [r, Math.max(...ys), r];
      break;
    }
    case 'prism': {
      const xs = p.outline.map((q) => q[0]);
      const zs = p.outline.map((q) => q[1]);
      mn = [Math.min(...xs), 0, Math.min(...zs)];
      mx = [Math.max(...xs), p.height, Math.max(...zs)];
      break;
    }
  }
  const s = p.scale ?? [1, 1, 1];
  const lo: V3 = [Infinity, Infinity, Infinity];
  const hi: V3 = [-Infinity, -Infinity, -Infinity];
  for (const x of [mn[0], mx[0]]) {
    for (const y of [mn[1], mx[1]]) {
      for (const z of [mn[2], mx[2]]) {
        const c0: V3 = [x * s[0], y * s[1], z * s[2]];
        const c = p.rotation ? rotXYZ(c0, p.rotation) : c0;
        for (const i of [0, 1, 2]) {
          lo[i] = Math.min(lo[i], c[i] + p.position[i]);
          hi[i] = Math.max(hi[i], c[i] + p.position[i]);
        }
      }
    }
  }
  return [lo, hi];
}

/** Scale a part uniformly by `s` about point `a`. */
function scaleAbout(p: Part, a: V3, s: number): Part {
  const position = vAdd(a, vMul(vSub(p.position, a), s));
  switch (p.shape) {
    case 'box':
      return { ...p, position, size: vMul(p.size, s), ...(p.bevel !== undefined ? { bevel: p.bevel * s } : {}) };
    case 'cylinder':
      return { ...p, position, radiusTop: p.radiusTop * s, radiusBottom: p.radiusBottom * s, height: p.height * s };
    case 'sphere':
      return { ...p, position, radius: p.radius * s };
    case 'torus':
      return { ...p, position, radius: p.radius * s, tube: p.tube * s };
    case 'lathe':
      return { ...p, position, profile: p.profile.map(([r, y]) => [r * s, y * s] as V2) };
    case 'prism':
      return { ...p, position, outline: p.outline.map(([x, z]) => [x * s, z * s] as V2), height: p.height * s };
  }
}

/** Shrink `parts` about `anchor` (never grows them) until their bounds sit inside `box`. */
function fitParts(parts: Part[], anchor: V3, [lo, hi]: Box): Part[] {
  let s = 1;
  for (const p of parts) {
    const [mn, mx] = partBox(p);
    for (const i of [0, 1, 2]) {
      if (mx[i] > hi[i]) s = Math.min(s, Math.max(0, hi[i] - anchor[i]) / Math.max(1e-6, mx[i] - anchor[i]));
      if (mn[i] < lo[i]) s = Math.min(s, Math.max(0, anchor[i] - lo[i]) / Math.max(1e-6, anchor[i] - mn[i]));
    }
  }
  if (s >= 1) return parts;
  const k = Math.max(0.05, s * 0.995);
  return parts.map((p) => scaleAbout(p, anchor, k));
}

/** The item box, inset by `m`, optionally narrowed. */
function itemBox(w: number, d: number, h: number, o?: { y0?: number; y1?: number; z0?: number; x0?: number; x1?: number; m?: number }): Box {
  const m = o?.m ?? 0.004;
  return [
    [Math.max(-w / 2 + m, o?.x0 ?? -Infinity), o?.y0 ?? m, o?.z0 ?? -d / 2 + m],
    [Math.min(w / 2 - m, o?.x1 ?? Infinity), o?.y1 ?? h - m, d / 2 - m],
  ];
}

// ---------------------------------------------------------------------------
// Flower heads
// ---------------------------------------------------------------------------

/** Layered rose: a bud core and two rings of cupped petals around `axis`. */
function roseHead(slot: string, c: V3, axis: V3, hr: number, rot0: number): Part[] {
  return [
    ellip(slot, vAdd(c, vMul(axis, hr * 0.12)), hr * 0.9, hr * 0.8, hr * 0.9, axis, perp(axis)),
    ...petalRing(slot, c, axis, 3, hr * 0.9, hr * 0.85, hr * 0.22, 1.05, rot0, hr * 0.2),
    ...petalRing(slot, vSub(c, vMul(axis, hr * 0.15)), axis, 5, hr * 1.0, hr * 0.95, hr * 0.18, 0.55, rot0 + 0.6, hr * 0.25),
  ];
}

/** Daisy-type head: a flat ring of petals around a domed centre. */
function daisyHead(petalSlot: string, centreSlot: string, c: V3, axis: V3, r: number, n: number, rot0: number): Part[] {
  return [
    ellip(centreSlot, c, r * 0.7, r * 0.7, r * 0.35, perp(axis), axis),
    ...petalRing(petalSlot, vSub(c, vMul(axis, 0.002)), axis, n, r * 0.85, r * 0.3, 0.003, 0.12, rot0, r * 0.25),
  ];
}

/** Lily: six recurved two-part petals, six stamens with anthers and a pistil. */
function lilyHead(petalSlot: string, stemSlot: string, antherSlot: string, c: V3, axis: V3, pl: number, rot0: number): Part[] {
  const parts: Part[] = [];
  const a = vNorm(axis);
  const e1 = perp(a);
  const e2 = vCross(a, e1);
  for (const k of range(6)) {
    const ang = rot0 + (k / 6) * TAU;
    const rk = vAdd(vMul(e1, Math.cos(ang)), vMul(e2, Math.sin(ang)));
    const wid = pl * (k % 2 ? 0.4 : 0.48);
    const c1 = 0.75;
    const c2 = -0.3;
    const d1 = vNorm(vAdd(vMul(rk, Math.cos(c1)), vMul(a, Math.sin(c1))));
    const n1 = vNorm(vSub(vMul(a, Math.cos(c1)), vMul(rk, Math.sin(c1))));
    const l1 = pl * 0.52;
    const b1 = vAdd(c, vMul(rk, 0.004));
    parts.push(
      plate(petalSlot, [[-wid * 0.12, 0], [wid * 0.12, 0], [wid * 0.5, l1], [-wid * 0.5, l1]], b1, d1, n1, 0.002, LILY_TILE / 2),
    );
    const d2 = vNorm(vAdd(vMul(rk, Math.cos(c2)), vMul(a, Math.sin(c2))));
    const n2 = vNorm(vSub(vMul(a, Math.cos(c2)), vMul(rk, Math.sin(c2))));
    const l2 = pl * 0.5;
    parts.push(
      plate(petalSlot, [[-wid * 0.5, 0], [wid * 0.5, 0], [wid * 0.32, l2 * 0.6], [0, l2], [-wid * 0.32, l2 * 0.6]], vAdd(b1, vMul(d1, l1 * 0.97)), d2, n2, 0.002, LILY_TILE / 2),
    );
    const sd = vNorm(vAdd(a, vMul(rk, 0.38)));
    const tip = vAdd(c, vMul(sd, pl * 0.72));
    parts.push(rod(stemSlot, c, tip, 0.0012, NP), ellip(antherSlot, tip, 0.005, 0.014, 0.004, perp(sd), sd));
  }
  parts.push(rod(stemSlot, c, vAdd(c, vMul(a, pl * 0.8)), 0.0018, NP));
  return parts;
}

/** Echeveria-style rosette of fleshy leaves around a core. */
function rosette(slot: string, c: V3, rr: number, rot0: number): Part[] {
  return [
    ...petalRing(slot, c, UP, 8, rr, rr * 0.55, rr * 0.25, 0.45, rot0, rr * 0.1),
    ...petalRing(slot, vAdd(c, [0, rr * 0.08, 0]), UP, 5, rr * 0.7, rr * 0.45, rr * 0.22, 0.95, rot0 + 0.4, rr * 0.05),
    sphere(slot, vAdd(c, [0, rr * 0.25, 0]), rr * 0.18, NP),
  ];
}

/** Evenly spread unit directions over a sphere cap from straight up (y = 1) down to `yMin`. */
function capDirs(n: number, yMin: number): V3[] {
  return range(n).map((i) => {
    const y = lerp(1, yMin, (i + 0.5) / n);
    const rr = Math.sqrt(Math.max(0, 1 - y * y));
    const a = i * 2.39996;
    return [Math.cos(a) * rr, y, Math.sin(a) * rr] as V3;
  });
}

// ---------------------------------------------------------------------------
// Hanging plants (ceiling)
// ---------------------------------------------------------------------------

const bostonFern = defineItem({
  id: 'plant-boston-fern-hanging',
  name: 'Hanging Boston fern',
  category: 'decor',
  type: 'plants',
  group: 'Hanging plants',
  tags: ['boston fern', 'fern', 'hanging basket', 'fronds', 'nephrolepis', 'trailing', 'chains'],
  mount: 'ceiling',
  defaultElevation: CEIL - 0.8,
  defaultSize: { w: 0.8, d: 0.8, h: 0.8 },
  minSize: { w: 0.45, d: 0.45, h: 0.6 },
  maxSize: { w: 1.3, d: 1.3, h: 1.6 },
  slots: [
    matSlot('basket', 'Coir basket', 'coco-liner'),
    matSlot('leaf', 'Fronds', 'leaf-fern'),
    matSlot('chain', 'Wire & chains', 'metal-anthracite'),
  ],
  build: ({ w, d, h }) => {
    const r = Math.min(w, d) / 2;
    const rand = rng(101);
    const potR = clamp(r * 0.36, 0.1, 0.2);
    const potH = clamp(potR * 0.85, 0.08, 0.16);
    const yTop = clamp(h * 0.6, potH + 0.12, h - 0.2);
    const y0 = yTop - potH;
    const parts: Part[] = [
      pot('basket', [0, y0, 0], potR, potH, 'bowl'),
      sphere('basket', [0, yTop - 0.012, 0], potR * 0.9, { scale: [1, 0.22, 1], plan: false }),
      ring('chain', [0, yTop, 0], potR + 0.003, 0.004, NP),
      ring('chain', [0, y0 + potH * 0.45, 0], potR * 0.92, 0.0035, NP),
      ...hanger('chain', h, yTop, potR + 0.003, 3, { r: 0.0028 }),
    ];
    for (const k of range(4)) {
      const a = (k * Math.PI) / 2 + Math.PI / 4;
      parts.push(...rodPath('chain', [polar(a, potR + 0.003, yTop), polar(a, potR * 0.92, y0 + potH * 0.45), polar(a, potR * 0.5, y0 + 0.004)], 0.0028));
    }
    const fr: Part[] = [];
    const N = clamp(Math.round(r * 40), 14, 22);
    const L = clamp(r * 1.2, 0.3, 0.8);
    const fw = clamp(r * 0.26, 0.09, 0.17);
    for (const i of range(N)) {
      const az = (i / N) * TAU + rand() * 0.4;
      const e0 = lerp(0.45, 0.95, rand());
      const e1 = lerp(-1.0, -1.4, rand());
      fr.push(...frond('leaf', polar(az, potR * 0.55, yTop + 0.005), az, L * lerp(0.72, 1, rand()), fw, [e0, lerp(e0, e1, 0.35), lerp(e0, e1, 0.7), e1], rand, 5));
    }
    for (const i of range(7)) {
      const az = (i / 7) * TAU + 0.3;
      fr.push(...frond('leaf', polar(az, potR * 0.25, yTop), az, L * 0.5, fw * 0.85, [1.35, 0.9, 0.3], rand, 5));
    }
    parts.push(...fitParts(fr, [0, yTop, 0], itemBox(w, d, h, { y1: h - 0.08 })));
    return parts;
  },
  planDetail: ({ w, d }) => {
    const r = Math.min(w, d) / 2;
    const potR = clamp(r * 0.36, 0.1, 0.2);
    const xz = (a: number, rr: number): V2 => [Math.cos(a) * rr, Math.sin(a) * rr];
    return [circle([0, 0], potR), ...range(8).map((k) => line(xz(k * 0.785, potR), xz(k * 0.785, r * 0.85)))];
  },
});

const stringOfPearls = defineItem({
  id: 'plant-string-of-pearls',
  name: 'String of pearls',
  category: 'decor',
  type: 'plants',
  group: 'Hanging plants',
  tags: ['string of pearls', 'succulent', 'senecio', 'trailing', 'hanging', 'beads'],
  mount: 'ceiling',
  defaultElevation: CEIL - 1.1,
  defaultSize: { w: 0.32, d: 0.32, h: 1.1 },
  minSize: { w: 0.22, d: 0.22, h: 0.5 },
  maxSize: { w: 0.6, d: 0.6, h: 1.8 },
  slots: [
    matSlot('pot', 'Pot', 'stoneware'),
    matSlot('pearl', 'Pearls', 'succulent'),
    matSlot('hanger', 'Hanger', 'macrame-cotton'),
    matSlot('soil', 'Soil', 'plant-soil'),
  ],
  build: ({ w, d, h }) => {
    const r = Math.min(w, d) / 2;
    const rand = rng(202);
    const potR = clamp(r * 0.42, 0.055, 0.12);
    const potH = clamp(potR * 1.05, 0.06, 0.13);
    const yTop = clamp(h - clamp(h * 0.28, 0.2, 0.4), potH + 0.1, h - 0.15);
    const y0 = yTop - potH;
    const parts: Part[] = [
      ...potted('pot', 'soil', [0, y0, 0], potR, potH, 'cylinder'),
      ...hanger('hanger', h, yTop, potR + 0.004, 3, { knots: true, underY: y0 }),
    ];
    const pl: Part[] = [];
    const S = clamp(Math.round(r * 48), 6, 9);
    for (const k of range(S)) {
      const az = (k / S) * TAU + rand() * 0.5;
      const reach = potR * 0.3 + rand() * potR * 0.45;
      const yEnd = lerp(0.03, y0 * 0.55, rand());
      const pts = vinePath(polar(az, potR * 0.8, yTop + 0.008), az, reach, yEnd, 3, rand);
      pl.push(...rodPath('pearl', pts, 0.0012));
      for (const q of range(10)) {
        const { p } = alongPath(pts, 0.08 + q * 0.092);
        const j: V3 = [(rand() - 0.5) * 0.006, 0, (rand() - 0.5) * 0.006];
        pl.push(sphere('pearl', vAdd(p, j), 0.0065 * lerp(0.85, 1.1, rand()), NP));
      }
    }
    for (const q of range(10)) {
      pl.push(sphere('pearl', polar(q * 2.4, potR * 0.75 * Math.sqrt(rand()), yTop + 0.004), 0.0068, NP));
    }
    parts.push(...fitParts(pl, [0, yTop, 0], itemBox(w, d, h, { y1: h - 0.06 })));
    return parts;
  },
  planDetail: ({ w, d }) => [circle([0, 0], clamp((Math.min(w, d) / 2) * 0.42, 0.055, 0.12))],
});

const spiderPlant = defineItem({
  id: 'plant-spider-hanging',
  name: 'Hanging spider plant',
  category: 'decor',
  type: 'plants',
  group: 'Hanging plants',
  tags: ['spider plant', 'chlorophytum', 'variegated', 'runners', 'plantlets', 'hanging'],
  mount: 'ceiling',
  defaultElevation: CEIL - 0.9,
  defaultSize: { w: 0.6, d: 0.6, h: 0.9 },
  minSize: { w: 0.35, d: 0.35, h: 0.5 },
  maxSize: { w: 1.0, d: 1.0, h: 1.5 },
  slots: [
    matSlot('pot', 'Pot', 'ceramic-white'),
    matSlot('leaf', 'Leaves', 'leaf-spider'),
    matSlot('hanger', 'Wire hanger', 'metal-white-powder'),
    matSlot('soil', 'Soil', 'plant-soil'),
  ],
  build: ({ w, d, h }) => {
    const r = Math.min(w, d) / 2;
    const rand = rng(303);
    const potR = clamp(r * 0.32, 0.07, 0.14);
    const potH = clamp(potR * 0.95, 0.07, 0.13);
    const yTop = clamp(h - clamp(h * 0.3, 0.2, 0.38), potH + 0.1, h - 0.15);
    const y0 = yTop - potH;
    const parts: Part[] = [
      ...potted('pot', 'soil', [0, y0, 0], potR, potH, 'taper'),
      ring('pot', [0, yTop - 0.004, 0], potR * 0.99, 0.006, NP),
      ...hanger('hanger', h, yTop, potR + 0.003, 3, { r: 0.0018 }),
    ];
    const pl: Part[] = [];
    const N = clamp(Math.round(r * 64), 14, 26);
    const wid = clamp(r * 0.08, 0.018, 0.03);
    for (const i of range(N)) {
      const az = (i / N) * TAU + rand() * 0.35;
      const L = clamp(r * 0.95, 0.22, 0.55) * lerp(0.7, 1, rand());
      const e0 = lerp(0.7, 1.3, rand());
      pl.push(...strapLeaf('leaf', polar(az, potR * 0.3 * rand(), yTop + 0.01), az, L, wid, [e0, lerp(0.1, -0.4, rand()), lerp(-0.6, -1.1, rand())], SPIDER_TILE / 2));
    }
    const R = clamp(Math.round(r * 9), 3, 6);
    for (const k of range(R)) {
      const az = ((k + 0.5) / R) * TAU + rand() * 0.3;
      const yE = lerp(yTop * 0.35, yTop * 0.65, rand());
      const pts: V3[] = [polar(az, potR * 0.5, yTop + 0.02), polar(az, potR + 0.07, yTop + 0.08), polar(az, r * 0.6, lerp(yTop, yE, 0.45)), polar(az + 0.1, r * 0.62, yE)];
      pl.push(...rodPath('leaf', pts, 0.0018));
      const end = pts[3];
      for (const j of range(7)) {
        const dir = dirAt(j * 0.9 + rand(), lerp(0.7, 1.9, rand()));
        pl.push(petal('leaf', end, dir, faceToward(dir, UP), 0.075 * lerp(0.7, 1.1, rand()), 0.014, 0.003));
      }
    }
    parts.push(...fitParts(pl, [0, yTop, 0], itemBox(w, d, h, { y1: h - 0.06 })));
    return parts;
  },
  planDetail: ({ w, d }) => {
    const r = Math.min(w, d) / 2;
    return [circle([0, 0], clamp(r * 0.32, 0.07, 0.14)), circle([0, 0], r * 0.7)];
  },
});

const macrameHanger = defineItem({
  id: 'plant-macrame-hanger',
  name: 'Macramé plant hanger',
  category: 'decor',
  type: 'plants',
  group: 'Hanging plants',
  tags: ['macrame', 'macramé', 'boho', 'knots', 'hanger', 'pilea', 'tassel', 'cotton cord'],
  mount: 'ceiling',
  defaultElevation: CEIL - 1.15,
  defaultSize: { w: 0.4, d: 0.4, h: 1.15 },
  minSize: { w: 0.28, d: 0.28, h: 0.7 },
  maxSize: { w: 0.6, d: 0.6, h: 1.8 },
  slots: [
    matSlot('cord', 'Macramé cord', 'macrame-cotton'),
    matSlot('ring', 'Wooden ring', 'oak-frame'),
    matSlot('pot', 'Pot', 'stoneware'),
    matSlot('leaf', 'Pilea', 'leaf-bright'),
  ],
  build: ({ w, d, h }) => {
    const r = Math.min(w, d) / 2;
    const rand = rng(404);
    const tassel = clamp(h * 0.2, 0.1, 0.35);
    const yWb = tassel;
    const wrapH = 0.045;
    const potR = clamp(r * 0.55, 0.07, 0.15);
    const potH = clamp(potR * 1.05, 0.08, 0.16);
    const y0 = yWb + wrapH + clamp(h * 0.07, 0.05, 0.12);
    const yTop = y0 + potH;
    const yRing = h - 0.034;
    const yTw1 = h - 0.07;
    const yTw0 = yTw1 - 0.05;
    const apex: V3 = [0, yTw0, 0];
    const yD = y0 + potH * 0.72;
    const rD = potR * 1.08 + 0.01;
    const o = NP;
    const parts: Part[] = [
      torus('ring', [0, yRing, 0], 0.028, 0.006, o),
      vcyl('cord', 0, 0, yTw0, yTw1, 0.013, o),
      ring('cord', [0, yTw0 + 0.006, 0], 0.013, 0.003, o),
      ring('cord', [0, yTw1 - 0.006, 0], 0.013, 0.003, o),
      rod('cord', [-0.006, yTw1, 0], [-0.006, yRing - 0.026, 0], 0.004, o),
      rod('cord', [0.006, yTw1, 0], [0.006, yRing - 0.026, 0], 0.004, o),
      pot('pot', [0, y0, 0], potR, potH, 'bowl'),
      vcyl('cord', 0, 0, yWb, yWb + wrapH, 0.016, o),
      ring('cord', [0, yWb + 0.006, 0], 0.016, 0.003, o),
      ring('cord', [0, yWb + wrapH - 0.006, 0], 0.016, 0.003, o),
    ];
    const at = (a: number, f: number): V3 => polar(a, rD * f, lerp(yTw0, yD, f));
    for (const k of range(4)) {
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      const tg: V3 = [-Math.sin(a), 0, Math.cos(a)];
      const A = at(a, 0.42);
      const B = at(a, 0.7);
      parts.push(
        rod('cord', apex, vAdd(A, vMul(tg, 0.006)), 0.0035, o),
        rod('cord', apex, vSub(A, vMul(tg, 0.006)), 0.0035, o),
        rod('cord', A, B, 0.004, o),
      );
      const ax = vNorm(vSub(B, A));
      for (const q of range(4)) {
        parts.push(ellip('cord', vMix(A, B, (q + 0.5) / 4), 0.026, 0.017, 0.012, ax, polar(a, 1, 0)));
      }
      for (const s of [-1, 1]) parts.push(rod('cord', vAdd(B, vMul(tg, 0.005 * s)), polar(a + (s * Math.PI) / 4, rD, yD), 0.0035, o));
    }
    for (const j of range(4)) {
      const a = (j * Math.PI) / 2;
      const D = polar(a, rD, yD);
      parts.push(ellip('cord', D, 0.02, 0.022, 0.012, UP, polar(a, 1, 0)));
      parts.push(...rodPath('cord', [D, polar(a, potR * 0.7, y0 - 0.012), [0, yWb + wrapH, 0]], 0.0035));
    }
    const F = 14;
    for (const q of range(F)) {
      const a = (q / F) * TAU + rand() * 0.3;
      parts.push(rod('cord', polar(a, 0.01, yWb), polar(a, 0.012 + rand() * Math.min(0.05, r * 0.3), 0.004 + rand() * Math.min(0.04, tassel * 0.3)), 0.003, o));
    }
    // Chinese money plant (pilea): round peltate leaves on long stalks.
    const pl: Part[] = [cyl('leaf', [0, yTop - potH * 0.08, 0], potR * 0.86, 0.01, o)];
    const ph = clamp((yTw0 - yTop) * 0.5, 0.04, 0.14);
    const lr = clamp(potR * 0.3, 0.022, 0.04);
    for (const q of range(10)) {
      const az = q * 2.4 + rand() * 0.4;
      const tip = polar(az, lerp(0.015, potR + 0.02, Math.sqrt(rand())), yTop + lerp(0.02, ph, rand()));
      const radial = polar(az, 1, 0);
      pl.push(rod('leaf', [0, yTop - 0.01, 0], tip, 0.0018, o));
      const nrm = vNorm(vAdd(UP, vMul(radial, 0.7)));
      pl.push(ellip('leaf', tip, lr * 2, lr * 2, 0.004, perp(nrm), nrm));
    }
    parts.push(...fitParts(pl, [0, yTop, 0], itemBox(w, d, h, { y1: yTw0 })));
    return parts;
  },
  planDetail: ({ w, d }) => {
    const r = Math.min(w, d) / 2;
    const potR = clamp(r * 0.55, 0.07, 0.15);
    return [circle([0, 0], potR), circle([0, 0], 0.028)];
  },
});

const kokedama = defineItem({
  id: 'plant-kokedama',
  name: 'Kokedama moss balls',
  category: 'decor',
  type: 'plants',
  group: 'Hanging plants',
  tags: ['kokedama', 'moss ball', 'japanese', 'string garden', 'fern', 'peace lily', 'ivy'],
  mount: 'ceiling',
  defaultElevation: CEIL - 1.0,
  defaultSize: { w: 0.6, d: 0.3, h: 1.0 },
  minSize: { w: 0.35, d: 0.2, h: 0.5 },
  maxSize: { w: 1.2, d: 0.5, h: 1.8 },
  slots: [
    matSlot('moss', 'Moss balls', 'moss'),
    matSlot('twine', 'Twine', 'jute-twine'),
    matSlot('leaf', 'Foliage', 'leaf-bright'),
    matSlot('bloom', 'Peace lily bloom', 'petal-white'),
  ],
  build: ({ w, d, h }) => {
    const n = clamp(Math.round(w / 0.2), 2, 4);
    const cw = w / n;
    const rand = rng(505);
    const br = clamp(Math.min(cw * 0.3, d * 0.33), 0.045, 0.1);
    const plantUp = clamp(h * 0.2, 0.1, 0.25);
    const fracs = [0.45, 0.12, 0.65, 0.3];
    const parts: Part[] = [];
    cells(n, -w / 2, w / 2).forEach((x, i) => {
      const yC = br + 0.03 + fracs[i % 4] * Math.max(0, h - br * 2 - plantUp - 0.25);
      const K: V3 = [x, yC + br + plantUp + 0.04, 0];
      parts.push(sphere('moss', [x, yC, 0], br));
      parts.push(ring('twine', [x, yC, 0], br * 1.005, 0.0022, NP));
      for (const a of [0.3, 1.35, 2.4]) parts.push(torus('twine', [x, yC, 0], br * 1.005, 0.0022, { rotation: [0, a, 0], plan: false }));
      for (const k of range(3)) {
        const a = Math.PI / 2 + (k / 3) * TAU;
        parts.push(rod('twine', vAdd([x, yC + br * 0.25, 0], polar(a, br * 0.97, 0)), K, 0.0015, NP));
      }
      parts.push(sphere('twine', K, 0.007, NP), rod('twine', K, [x, h - 0.003, 0], 0.0015, NP));
      const top: V3 = [x, yC + br * 0.85, 0];
      const pl: Part[] = [];
      const kind = i % 3;
      if (kind === 0) {
        for (const j of range(6)) {
          const az = (j / 6) * TAU + rand() * 0.4;
          pl.push(...frond('leaf', top, az, plantUp * 1.3, 0.045, [lerp(0.9, 1.3, rand()), lerp(0, 0.4, rand())], rand, 5));
        }
      } else if (kind === 1) {
        for (const j of range(5)) {
          const dir = dirAt((j / 5) * TAU + rand() * 0.5, lerp(0.35, 0.8, rand()));
          pl.push(petal('leaf', top, dir, faceToward(dir, vNorm([0, 0.3, 1])), plantUp * lerp(0.75, 0.95, rand()), plantUp * 0.36, 0.006));
        }
        for (const s of [-1, 1]) {
          const b: V3 = [x + s * 0.012, yC + br * 0.8 + plantUp * (s > 0 ? 0.9 : 0.75), 0.008];
          pl.push(rod('leaf', top, b, 0.002, NP));
          const dir = vNorm([s * 0.2, 1, 0.35]);
          pl.push(petal('bloom', b, dir, faceToward(dir, FRONT), plantUp * 0.42, plantUp * 0.22, 0.008));
          pl.push(ellip('bloom', vAdd(b, vMul(dir, plantUp * 0.12)), 0.008, plantUp * 0.16, 0.008, dir, FRONT));
        }
      } else {
        for (const j of range(3)) {
          const az = Math.PI / 2 + (j - 1) * 1.6 + rand() * 0.3;
          const start = vAdd([x, yC + br * 0.4, 0], polar(az, br * 0.85, 0));
          const pts = vinePath(start, az, cw * 0.15, Math.max(0.03, yC - br - lerp(0.12, 0.35, rand())), 2, rand);
          pl.push(...rodPath('leaf', pts, 0.0018));
          for (const q of range(4)) {
            const { p } = alongPath(pts, 0.2 + q * 0.25);
            const out = polar(az, 1, 0);
            const dir = vNorm(vAdd(vAdd(out, [0, lerp(-0.4, 0.4, rand()), 0]), vMul([-Math.sin(az), 0, Math.cos(az)], q % 2 ? 0.8 : -0.8)));
            pl.push(plate('leaf', ivyOutline(0.04), p, dir, faceToward(dir, vNorm(vAdd(out, [0, 0.4, 0]))), 0.002, IVY_TILE / 2));
          }
        }
        for (const j of range(3)) {
          const dir = dirAt(j * 2.1, 0.7);
          pl.push(plate('leaf', ivyOutline(0.045), top, dir, faceToward(dir, UP), 0.002, IVY_TILE / 2));
        }
      }
      parts.push(...fitParts(pl, top, itemBox(w, d, h, { x0: x - cw * 0.6, x1: x + cw * 0.6, y1: h - 0.04 })));
    });
    return parts;
  },
  planDetail: ({ w, d }) => {
    const n = clamp(Math.round(w / 0.2), 2, 4);
    const br = clamp(Math.min((w / n) * 0.3, d * 0.33), 0.045, 0.1);
    return cells(n, -w / 2, w / 2).map((x) => circle([x, 0], br));
  },
});

const hangingIvy = defineItem({
  id: 'plant-ivy-hanging',
  name: 'Hanging ivy',
  category: 'decor',
  type: 'plants',
  group: 'Hanging plants',
  tags: ['ivy', 'english ivy', 'hedera', 'trailing', 'vines', 'terracotta', 'hanging'],
  mount: 'ceiling',
  defaultElevation: CEIL - 1.1,
  defaultSize: { w: 0.6, d: 0.6, h: 1.1 },
  minSize: { w: 0.35, d: 0.35, h: 0.6 },
  maxSize: { w: 1.1, d: 1.1, h: 1.8 },
  slots: [
    matSlot('pot', 'Pot', 'terracotta-pot'),
    matSlot('leaf', 'Ivy', 'leaf-ivy'),
    matSlot('hanger', 'Jute hanger', 'jute-twine'),
    matSlot('soil', 'Soil', 'plant-soil'),
  ],
  build: ({ w, d, h }) => {
    const r = Math.min(w, d) / 2;
    const rand = rng(606);
    const potR = clamp(r * 0.32, 0.07, 0.14);
    const potH = clamp(potR * 0.95, 0.07, 0.13);
    const yTop = clamp(h - clamp(h * 0.3, 0.22, 0.42), potH + 0.12, h - 0.16);
    const y0 = yTop - potH;
    const parts: Part[] = [
      ...potted('pot', 'soil', [0, y0, 0], potR, potH, 'taper'),
      ...hanger('hanger', h, yTop - 0.004, potR + 0.004, 3, { knots: true, underY: y0 }),
    ];
    const ll = clamp(r * 0.17, 0.04, 0.07);
    const V = clamp(Math.round(r * 20), 5, 8);
    const pl: Part[] = [];
    for (const k of range(V)) {
      const az = (k / V) * TAU + rand() * 0.5;
      const out = polar(az, 1, 0);
      const side: V3 = [-Math.sin(az), 0, Math.cos(az)];
      const reach = lerp(0.03, Math.max(0.04, r - potR - ll), rand());
      const pts = vinePath(polar(az, potR * 0.85, yTop + 0.01), az, reach, lerp(0.03, y0 * 0.6, rand()), 3, rand);
      pl.push(...rodPath('leaf', pts, 0.002));
      for (const q of range(7)) {
        const { p } = alongPath(pts, 0.1 + q * 0.13);
        const dir = vNorm(vAdd(vAdd(vMul(side, q % 2 ? 0.8 : -0.8), vMul(out, 0.6)), [0, lerp(-0.4, 0.5, rand()), 0]));
        const nrm = faceToward(dir, vNorm(vAdd(out, [0, 0.4, 0])));
        pl.push(plate('leaf', ivyOutline(ll * lerp(0.7, 1.05, rand()) * (1 - q * 0.04)), p, dir, nrm, 0.0022, IVY_TILE / 2));
      }
    }
    for (const q of range(9)) {
      const az = q * 2.4 + rand();
      const dir = dirAt(az, lerp(0.6, 1.2, rand()));
      pl.push(plate('leaf', ivyOutline(ll * lerp(0.8, 1.05, rand())), polar(az, potR * 0.5 * rand(), yTop + 0.01), dir, faceToward(dir, UP), 0.0022, IVY_TILE / 2));
    }
    parts.push(...fitParts(pl, [0, yTop, 0], itemBox(w, d, h, { y1: h - 0.06 })));
    return parts;
  },
  planDetail: ({ w, d }) => {
    const r = Math.min(w, d) / 2;
    return [circle([0, 0], clamp(r * 0.32, 0.07, 0.14)), poly(ellipsePoints(0, 0, r * 0.75, r * 0.75, 10))];
  },
});

const hangingHoya = defineItem({
  id: 'plant-hoya-hanging',
  name: 'Hanging hoya',
  category: 'decor',
  type: 'plants',
  group: 'Hanging plants',
  tags: ['hoya', 'wax plant', 'porcelain flower', 'trailing', 'hanging', 'flowering'],
  mount: 'ceiling',
  defaultElevation: CEIL - 1.0,
  defaultSize: { w: 0.55, d: 0.55, h: 1.0 },
  minSize: { w: 0.32, d: 0.32, h: 0.55 },
  maxSize: { w: 1.0, d: 1.0, h: 1.7 },
  slots: [
    matSlot('pot', 'Pot', 'ceramic-white'),
    matSlot('leaf', 'Waxy leaves', 'leaf-waxy'),
    matSlot('flower', 'Flower clusters', 'petal-hoya'),
    matSlot('hanger', 'Brass chains', 'metal-brass'),
  ],
  build: ({ w, d, h }) => {
    const r = Math.min(w, d) / 2;
    const rand = rng(707);
    const potR = clamp(r * 0.34, 0.07, 0.14);
    const potH = clamp(potR * 0.8, 0.06, 0.11);
    const yTop = clamp(h - clamp(h * 0.3, 0.22, 0.4), potH + 0.12, h - 0.16);
    const y0 = yTop - potH;
    const parts: Part[] = [pot('pot', [0, y0, 0], potR, potH, 'bowl'), ...hanger('hanger', h, yTop, potR + 0.003, 3, { r: 0.0022 })];
    const pl: Part[] = [];
    const ll = clamp(r * 0.2, 0.04, 0.065);
    const V = clamp(Math.round(r * 20), 5, 7);
    let umbels = 0;
    for (const k of range(V)) {
      const az = (k / V) * TAU + rand() * 0.5;
      const out = polar(az, 1, 0);
      const side: V3 = [-Math.sin(az), 0, Math.cos(az)];
      const pts = vinePath(polar(az, potR * 0.85, yTop + 0.01), az, lerp(0.04, Math.max(0.05, r - potR - ll), rand()), lerp(0.04, y0 * 0.55, rand()), 3, rand);
      pl.push(...rodPath('leaf', pts, 0.0025));
      for (const q of range(7)) {
        const { p } = alongPath(pts, 0.1 + q * 0.13);
        const dir = vNorm(vAdd(vAdd(vMul(side, q % 2 ? 0.9 : -0.9), vMul(out, 0.5)), [0, lerp(-0.3, 0.3, rand()), 0]));
        pl.push(petal('leaf', p, dir, faceToward(dir, vNorm(vAdd(out, [0, 0.5, 0]))), ll * lerp(0.8, 1.05, rand()), ll * 0.55, ll * 0.2));
      }
      if (k % 2 === 0 && umbels < 3) {
        umbels++;
        const { p } = alongPath(pts, 0.45);
        const ax = vNorm(vAdd(out, [0, -0.6, 0]));
        const c = vAdd(p, vMul(ax, 0.03));
        pl.push(rod('leaf', p, c, 0.0015, NP), sphere('flower', c, 0.018, NP));
        for (const u of capDirs(9, -0.1)) {
          const fd = vNorm(rotAbout(u, vNorm(vCross(UP, ax), [1, 0, 0]), Math.acos(clamp(vDot(UP, ax), -1, 1))));
          pl.push(ellip('flower', vAdd(c, vMul(fd, 0.022)), 0.014, 0.014, 0.006, perp(fd), fd));
        }
      }
    }
    for (const q of range(8)) {
      const az = q * 2.4 + rand();
      const dir = dirAt(az, lerp(0.5, 1.1, rand()));
      pl.push(petal('leaf', polar(az, potR * 0.4 * rand(), yTop), dir, faceToward(dir, UP), ll, ll * 0.55, ll * 0.2));
    }
    parts.push(...fitParts(pl, [0, yTop, 0], itemBox(w, d, h, { y1: h - 0.06 })));
    return parts;
  },
  planDetail: ({ w, d }) => [circle([0, 0], clamp((Math.min(w, d) / 2) * 0.34, 0.07, 0.14))],
});

const airPlantGlobes = defineItem({
  id: 'plant-air-plants-hanging',
  name: 'Hanging air plant globes',
  category: 'decor',
  type: 'plants',
  group: 'Hanging plants',
  tags: ['air plant', 'tillandsia', 'glass globe', 'terrarium', 'hanging', 'bubble'],
  mount: 'ceiling',
  defaultElevation: CEIL - 0.9,
  defaultSize: { w: 0.6, d: 0.3, h: 0.9 },
  minSize: { w: 0.3, d: 0.2, h: 0.5 },
  maxSize: { w: 1.2, d: 0.5, h: 1.6 },
  slots: [
    matSlot('glass', 'Glass globes', 'glass-vase'),
    matSlot('plant', 'Air plants', 'air-plant'),
    matSlot('string', 'Strings', 'macrame-cotton'),
    matSlot('sand', 'Sand', 'terrarium-sand'),
  ],
  build: ({ w, d, h }) => {
    const n = clamp(Math.round(w / 0.2), 2, 5);
    const rand = rng(808);
    const gr = clamp(Math.min((w / n) * 0.42, d * 0.45), 0.04, 0.09);
    const fracs = [0.35, 0.05, 0.6, 0.2, 0.45];
    const open = 0.55;
    const parts: Part[] = [];
    cells(n, -w / 2, w / 2).forEach((x, i) => {
      const cy = gr + 0.02 + fracs[i % 5] * Math.max(0, h - 2 * gr - 0.2);
      const phiMax = Math.PI - Math.asin(open);
      const prof: V2[] = range(11).map((k) => {
        const ph = (k / 10) * phiMax;
        return [gr * Math.sin(ph), -gr * Math.cos(ph)] as V2;
      });
      parts.push(latheFront('glass', [x, cy, 0], prof));
      parts.push(torus('glass', [x, cy, gr * Math.cos(Math.asin(open))], gr * open, 0.003, NP));
      parts.push(torus('glass', [x, cy + gr + 0.008, 0], 0.008, 0.002, { rotation: [0, Math.PI / 2, 0], plan: false }));
      parts.push(rod('string', [x, cy + gr + 0.016, 0], [x, h - 0.002, 0], 0.0012, NP));
      parts.push(sphere('sand', [x, cy - gr * 0.8, 0], 0.5, { scale: [gr * 1.0, gr * 0.3, gr * 0.9], plan: false }));
      const base: V3 = [x, cy - gr * 0.6, 0];
      for (const j of range(10)) {
        const dir = dirAt((j / 10) * TAU + rand() * 0.5, lerp(0.3, 1.25, rand()));
        parts.push(petal('plant', base, dir, faceToward(dir, UP), gr * lerp(0.55, 0.8, rand()), 0.007, 0.003));
      }
    });
    return parts;
  },
  planDetail: ({ w, d }) => {
    const n = clamp(Math.round(w / 0.2), 2, 5);
    const gr = clamp(Math.min((w / n) * 0.42, d * 0.45), 0.04, 0.09);
    return cells(n, -w / 2, w / 2).map((x) => circle([x, 0], gr));
  },
});

// ---------------------------------------------------------------------------
// Wall plants
// ---------------------------------------------------------------------------

const staghorn = defineItem({
  id: 'plant-staghorn-fern',
  name: 'Mounted staghorn fern',
  category: 'decor',
  type: 'plants',
  group: 'Indoor plants',
  tags: ['staghorn fern', 'platycerium', 'mounted', 'wall plant', 'antler', 'plaque', 'moss'],
  mount: 'wall',
  defaultElevation: 1.25,
  defaultSize: { w: 0.7, d: 0.32, h: 0.8 },
  minSize: { w: 0.4, d: 0.2, h: 0.45 },
  maxSize: { w: 1.2, d: 0.5, h: 1.4 },
  slots: [
    matSlot('board', 'Plaque', 'mount-wood'),
    matSlot('moss', 'Moss pad', 'moss'),
    matSlot('frond', 'Antler fronds', 'leaf-staghorn'),
    matSlot('shield', 'Shield fronds', 'shield-frond'),
  ],
  build: ({ w, d, h }) => {
    const rand = rng(909);
    const zB = -d / 2;
    const bt = 0.02;
    const bw = clamp(w * 0.5, 0.18, 0.42);
    const bh = clamp(h * 0.58, 0.2, 0.5);
    const cy = h * 0.56;
    const zF = zB + bt;
    const board = facePlate('board', roundRectPoints(0, cy, bw, bh, Math.min(bw, bh) * 0.22), zB, bt);
    board.plan = true;
    const parts: Part[] = [
      board,
      sphere('moss', [0, cy - bh * 0.05, zF + 0.012], 0.5, { scale: [bw * 0.62, bh * 0.48, 0.05], plan: false }),
      ellip('shield', [0, cy + bh * 0.14, zF + 0.026], bw * 0.7, bh * 0.6, 0.012, vNorm([0.1, 1, -0.1]), vNorm([0, 0.2, 1])),
      ellip('shield', [-bw * 0.2, cy - bh * 0.06, zF + 0.04], bw * 0.42, bh * 0.38, 0.012, vNorm([-0.4, 1, 0]), vNorm([-0.15, 0.1, 1])),
      ellip('shield', [bw * 0.2, cy - bh * 0.08, zF + 0.04], bw * 0.42, bh * 0.36, 0.012, vNorm([0.4, 1, 0]), vNorm([0.15, 0.1, 1])),
      ellip('shield', [0, cy - bh * 0.2, zF + 0.045], bw * 0.38, bh * 0.26, 0.012, UP, vNorm([0, -0.2, 1])),
    ];
    const C: V3 = [0, cy - bh * 0.02, zF + 0.05];
    const fr: Part[] = [];
    const Lf = clamp(Math.min(w, h) * 0.55, 0.18, 0.62);
    const angles = [95, 135, 52, 168, 14, -28, 208, -75];
    for (const [k, deg] of angles.entries()) {
      const th = ((deg + (rand() - 0.5) * 16) * Math.PI) / 180;
      const L = Lf * lerp(0.75, 1.1, rand()) * (k < 2 ? 1.1 : 1);
      const grow = (p: V3, dir: V3, len: number, w0: number, w1: number, depth: number) => {
        const nrm = faceToward(dir, vNorm([0, 0.25, 1]));
        const tip = depth === 0;
        fr.push(plate('frond', tip ? lobeOutline(len, w0, w1) : strapOutline(len * 1.02, w0, w1), p, dir, nrm, 0.003, STAG_TILE / 2));
        if (tip) return;
        const end = vAdd(p, vMul(dir, len));
        for (const s of [-1, 1]) {
          const nd = vNorm(vAdd(rotAbout(dir, nrm, s * lerp(0.3, 0.5, rand())), [0, -0.18, 0]));
          grow(end, nd, len * 0.72, w1 * 0.62, w1 * 0.55, depth - 1);
        }
      };
      grow(C, vNorm([Math.cos(th) * 0.85, Math.sin(th) * 0.85, 0.45]), L * 0.42, 0.028, 0.065, 2);
    }
    parts.push(...fitParts(fr, C, itemBox(w, d, h, { z0: zB + 0.003 })));
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w * 0.4, -d / 2 + 0.03], [w * 0.4, -d / 2 + 0.03]), poly(ellipsePoints(0, -d * 0.1, w * 0.35, d * 0.3, 16))],
});

const wallPlanters = defineItem({
  id: 'plant-wall-planters',
  name: 'Wall planter trio',
  category: 'decor',
  type: 'plants',
  group: 'Indoor plants',
  tags: ['wall planter', 'half moon pot', 'string of hearts', 'fern', 'snake plant', 'trio'],
  mount: 'wall',
  defaultElevation: 1.2,
  defaultSize: { w: 0.75, d: 0.2, h: 0.6 },
  minSize: { w: 0.45, d: 0.14, h: 0.4 },
  maxSize: { w: 1.4, d: 0.3, h: 1.0 },
  slots: [
    matSlot('pot', 'Wall pots', 'stoneware'),
    matSlot('leaf', 'Trailing & fern', 'leaf-bright'),
    matSlot('leaf2', 'Snake plant', 'leaf-deep'),
    matSlot('soil', 'Soil', 'plant-soil'),
  ],
  build: ({ w, d, h }) => {
    const rand = rng(1010);
    const zb = -d / 2 + 0.003;
    const xs = cells(3, -w / 2, w / 2);
    const pr = clamp(Math.min((w / 3) * 0.36, d - 0.03), 0.05, 0.11);
    const ph = clamp(pr * 1.25, 0.07, 0.14);
    const ybs = [h - ph - clamp(h * 0.08, 0.03, 0.06), clamp(h * 0.12, 0.02, 0.1), clamp(h * 0.3, 0.05, 0.25)];
    const parts: Part[] = [];
    xs.forEach((x, i) => {
      const yb = Math.min(ybs[i], h - ph - 0.01);
      parts.push(prism('pot', arcPoints(x, zb, pr, 0, Math.PI, 14), yb, ph));
      parts.push(prism('pot', arcPoints(x, zb, pr + 0.006, 0, Math.PI, 14), yb + ph - 0.012, 0.012, NP));
      parts.push(prism('soil', arcPoints(x, zb + 0.004, pr - 0.008, 0, Math.PI, 12), yb + ph - 0.02, 0.01, NP));
      parts.push(span('pot', [x - 0.015, x + 0.015], [yb + ph * 0.55, yb + ph * 0.8], [-d / 2, zb + 0.002], NP));
      const top: V3 = [x, yb + ph - 0.01, zb + pr * 0.5];
      const pl: Part[] = [];
      if (i === 0) {
        for (const j of range(5)) {
          const az = Math.PI / 2 + (j - 2) * 0.45;
          const start: V3 = [x + (j - 2) * pr * 0.3, yb + ph, zb + pr * 0.7];
          const pts = vinePath(start, az, pr * 0.5 + rand() * 0.04, lerp(0.02, Math.max(0.03, yb * 0.6), rand()), 3, rand);
          pl.push(...rodPath('leaf', pts, 0.0013));
          for (const q of range(6)) {
            const { p } = alongPath(pts, 0.15 + q * 0.15);
            for (const s of [-1, 1]) {
              const dir = vNorm([s, -0.3, 0.1]);
              pl.push(petal('leaf', p, dir, faceToward(dir, FRONT), 0.016, 0.017, 0.0025));
            }
          }
        }
      } else if (i === 1) {
        const up = clamp(h - (yb + ph) - 0.02, 0.1, 0.3);
        for (const j of range(7)) {
          const az = lerp(0.2, Math.PI - 0.2, j / 6) + (rand() - 0.5) * 0.2;
          pl.push(...frond('leaf', vAdd(top, [(j - 3) * 0.006, 0, 0]), az, up * 1.2, 0.045, [lerp(1.0, 1.35, rand()), lerp(0.2, 0.6, rand())], rand, 5));
        }
      } else {
        const up = clamp(h - (yb + ph) - 0.01, 0.1, 0.32);
        for (const j of range(6)) {
          const az = Math.PI / 2 + (j - 2.5) * 0.5 + rand() * 0.3;
          const dir = dirAt(az, lerp(0.04, 0.3, rand()));
          const nrm = faceToward(dir, [Math.cos(az + Math.PI / 2 + rand()), 0, Math.sin(az + Math.PI / 2 + rand())]);
          pl.push(plate('leaf2', lanceOutline(up * lerp(0.75, 1.1, rand()), 0.038, 0.7), vAdd(top, [(j - 2.5) * 0.008, 0, 0]), dir, nrm, 0.004, STRAP_TILE / 2));
        }
      }
      parts.push(...fitParts(pl, top, itemBox(w, d, h, { z0: zb })));
    });
    return parts;
  },
  planDetail: ({ w, d }) => {
    const pr = clamp(Math.min((w / 3) * 0.36, d - 0.03), 0.05, 0.11);
    return cells(3, -w / 2, w / 2).map((x) => poly(arcPoints(x, -d / 2 + 0.003, pr, 0, Math.PI, 10)));
  },
});

const mossFrame = defineItem({
  id: 'plant-moss-frame',
  name: 'Moss art frame',
  category: 'decor',
  type: 'plants',
  group: 'Indoor plants',
  tags: ['moss art', 'preserved moss', 'moss wall', 'frame', 'reindeer moss', 'biophilic'],
  mount: 'wall',
  defaultElevation: 1.3,
  defaultSize: { w: 0.8, d: 0.06, h: 0.6 },
  minSize: { w: 0.3, d: 0.04, h: 0.25 },
  maxSize: { w: 1.6, d: 0.1, h: 1.2 },
  slots: [
    matSlot('frame', 'Frame', 'oak-frame'),
    matSlot('moss', 'Flat moss', 'moss'),
    matSlot('moss2', 'Cushion moss', 'moss-deep'),
    matSlot('lichen', 'Reindeer moss', 'moss-reindeer'),
  ],
  build: ({ w, d, h }) => {
    const rand = rng(1111);
    const t = clamp(Math.min(w, h) * 0.06, 0.025, 0.05);
    const iw = w - 2 * t;
    const ih = h - 2 * t;
    const zc = -d / 2 + 0.012;
    const parts: Part[] = [
      ...frame4('frame', [-w / 2, w / 2], [0, h], [-d / 2, d / 2], t, { plan: true }),
      span('moss', [-iw / 2, iw / 2], [t, h - t], [-d / 2, zc], NP),
    ];
    const n = clamp(Math.round(iw * ih * 110), 10, 56);
    for (const i of range(n)) {
      const kind = i % 4;
      const rr = Math.min(Math.min(iw, ih) * 0.45, kind === 2 ? lerp(0.025, 0.045, rand()) : lerp(0.03, 0.075, rand()));
      const x = lerp(-iw / 2 + rr, iw / 2 - rr, rand());
      const y = lerp(t + rr, h - t - rr, rand());
      const rz = Math.min(rr * 0.6, d / 2 - zc - 0.003, 0.027);
      if (kind === 2) {
        for (const k of range(3)) {
          const a = k * 2.1 + rand();
          const sr = rr * lerp(0.4, 0.6, rand());
          parts.push(sphere('lichen', [x + Math.cos(a) * rr * 0.45, y + Math.sin(a) * rr * 0.45, zc], sr, { scale: [1, 1, Math.min(1, rz / sr)], plan: false }));
        }
      } else {
        const slot = kind === 3 ? 'moss' : 'moss2';
        parts.push(sphere(slot, [x, y, zc], rr, { scale: [1, lerp(0.7, 1, rand()), (kind === 3 ? 0.5 : 1) * Math.min(1, rz / rr)], plan: false }));
      }
    }
    return parts;
  },
  planDetail: ({ w, d }) => [rectPoly(-w / 2, -d / 2, w / 2, d / 2), line([-w / 2 + 0.03, d / 2 - 0.01], [w / 2 - 0.03, d / 2 - 0.01])],
});

/** Plants for one pocket of the living wall, growing from `a`. */
function pocketPlant(kind: number, a: V3, cw: number, ch: number, rand: () => number): Part[] {
  const out: Part[] = [];
  const fwd = vNorm([0, 0.45, 1]);
  if (kind === 0) {
    for (const j of range(3)) {
      const az = Math.PI / 2 + (j - 1) * 0.9 + (rand() - 0.5) * 0.3;
      out.push(...frond('leaf', a, az, ch * 1.0, cw * 0.32, [lerp(0.7, 1.1, rand()), lerp(0.1, 0.4, rand())], rand, 5));
    }
  } else if (kind === 1) {
    for (const j of range(4)) {
      const dir = dirAt(Math.PI / 2 + (j - 1.5) * 0.7, lerp(0.5, 1.0, rand()));
      out.push(petal('leaf2', a, dir, faceToward(dir, fwd), ch * 0.8, ch * 0.42, 0.006));
    }
  } else if (kind === 2) {
    const jx = (rand() - 0.5) * cw * 0.3;
    const pts: V3[] = [a, vAdd(a, [jx, 0.01, 0.04]), vAdd(a, [jx * 2, -ch * 0.75, 0.05])];
    out.push(...rodPath('leaf', pts, 0.002));
    for (const q of range(4)) {
      const { p } = alongPath(pts, 0.2 + q * 0.25);
      const dir = vNorm([q % 2 ? 1 : -1, -0.2, 0.5]);
      out.push(petal('leaf', p, dir, faceToward(dir, FRONT), ch * 0.3, ch * 0.24, 0.004));
    }
  } else if (kind === 3) {
    for (const j of range(5)) {
      const dir = dirAt(Math.PI / 2 + (j - 2) * 0.4, lerp(0.15, 0.6, rand()));
      out.push(plate('leaf2', strapOutline(ch * lerp(0.85, 1.15, rand()), 0.022, 0), a, dir, faceToward(dir, FRONT)));
    }
  } else {
    for (const j of range(5)) {
      const dir = dirAt(Math.PI / 2 + (j - 2) * 0.7, lerp(0.3, 1.0, rand()));
      const c = vAdd(a, vMul(dir, ch * lerp(0.3, 0.5, rand())));
      const nrm = vNorm(vAdd(fwd, vMul(dir, 0.3)));
      out.push(ellip('leaf', c, ch * 0.3, ch * 0.3, 0.004, perp(nrm), nrm));
    }
  }
  return out;
}

const livingWall = defineItem({
  id: 'plant-living-wall',
  name: 'Living wall panel',
  category: 'decor',
  type: 'plants',
  group: 'Indoor plants',
  tags: ['living wall', 'green wall', 'vertical garden', 'pockets', 'biophilic', 'wall plants'],
  mount: 'wall',
  defaultElevation: 0.9,
  defaultSize: { w: 1.2, d: 0.2, h: 1.0 },
  minSize: { w: 0.6, d: 0.12, h: 0.5 },
  maxSize: { w: 3.0, d: 0.35, h: 2.4 },
  slots: [
    matSlot('frame', 'Frame', 'oak-frame'),
    matSlot('felt', 'Planting felt', 'felt-pocket'),
    matSlot('leaf', 'Ferns & trailers', 'leaf-bright'),
    matSlot('leaf2', 'Broad leaves', 'leaf-deep'),
  ],
  build: ({ w, d, h }) => {
    const rand = rng(1212);
    const ft = 0.04;
    let nx = clamp(Math.round(w / 0.24), 2, 8);
    let ny = clamp(Math.round(h / 0.24), 2, 6);
    while (nx * ny > 22) {
      if (nx >= ny) nx--;
      else ny--;
    }
    const iw = w - 2 * ft;
    const ih = h - 2 * ft;
    const cw = iw / nx;
    const ch = ih / ny;
    const fd = Math.min(d, 0.05);
    const pd = Math.min(0.06, d * 0.35);
    const zP = -d / 2 + 0.012;
    const parts: Part[] = [
      ...frame4('frame', [-w / 2, w / 2], [0, h], [-d / 2, -d / 2 + fd], ft, { plan: true }),
      span('felt', [-iw / 2, iw / 2], [ft, h - ft], [-d / 2, zP], NP),
    ];
    for (const iy of range(ny)) {
      for (const ix of range(nx)) {
        const cx = -iw / 2 + (ix + 0.5) * cw;
        const y0 = ft + iy * ch;
        const pTop = y0 + ch * 0.45;
        parts.push(span('felt', [cx - cw * 0.42, cx + cw * 0.42], [y0 + ch * 0.08, pTop], [zP, zP + pd], { bevel: pd * 0.4, plan: false }));
        const a: V3 = [cx, pTop - 0.01, zP + pd * 0.6];
        const kind = (ix * 7 + iy * 3 + ((ix * iy) % 2)) % 5;
        parts.push(...fitParts(pocketPlant(kind, a, cw, ch, rand), a, itemBox(w, d, h, { x0: cx - cw * 0.75, x1: cx + cw * 0.75, y0: Math.max(0.004, y0 - ch * 0.6), y1: Math.min(h - 0.004, y0 + ch * 1.5) })));
      }
    }
    return parts;
  },
  planDetail: ({ w, d }) => [rectPoly(-w / 2, -d / 2, w / 2, -d / 2 + Math.min(d, 0.05)), line([-w / 2 + 0.05, d / 2 - 0.02], [w / 2 - 0.05, d / 2 - 0.02])],
});

const windowBox = defineItem({
  id: 'plant-window-box',
  name: 'Window box with flowers',
  category: 'decor',
  type: 'plants',
  group: 'Indoor plants',
  tags: ['window box', 'geraniums', 'petunias', 'flower box', 'balcony', 'trough', 'flowers'],
  mount: 'wall',
  defaultElevation: 0.85,
  defaultSize: { w: 0.8, d: 0.26, h: 0.45 },
  minSize: { w: 0.45, d: 0.18, h: 0.3 },
  maxSize: { w: 1.8, d: 0.4, h: 0.8 },
  slots: [
    matSlot('box', 'Window box', 'window-box-paint'),
    matSlot('leaf', 'Foliage', 'leaf-bright'),
    matSlot('flower', 'Geraniums', 'petal-red'),
    matSlot('flower2', 'Petunias', 'petal-white'),
  ],
  build: ({ w, d, h }) => {
    const rand = rng(1313);
    const zb = -d / 2;
    const bd = clamp(d * 0.7, 0.12, 0.25);
    const bH = clamp(h * 0.38, 0.1, 0.2);
    const yb = clamp(h * 0.1, 0.03, 0.06);
    const yT = yb + bH;
    const z0 = zb + 0.012;
    const zf = z0 + bd;
    const parts: Part[] = [
      span('box', [-w / 2 + 0.01, w / 2 - 0.01], [yb, yT], [z0, zf], { bevel: 0.004 }),
      span('box', [-w / 2 + 0.005, w / 2 - 0.005], [yT - 0.014, yT], [zf - 0.004, zf + 0.008], { bevel: 0.003, plan: false }),
      span('box', [-w / 2 + 0.03, w / 2 - 0.03], [yb + bH * 0.3, yb + bH * 0.36], [zf, zf + 0.005], NP),
      span('box', [-w / 2 + 0.03, w / 2 - 0.03], [yb + bH * 0.55, yb + bH * 0.61], [zf, zf + 0.005], NP),
    ];
    for (const s of [-1, 1]) {
      const x = s * (w / 2 - w * 0.18);
      parts.push(
        span('box', [x - 0.012, x + 0.012], [0, yb + bH * 0.8], [zb, z0], NP),
        span('box', [x - 0.01, x + 0.01], [yb - 0.012, yb], [z0, z0 + bd * 0.8], NP),
        rod('box', [x, 0.02, z0], [x, yb - 0.012, z0 + bd * 0.7], 0.006, NP),
      );
    }
    const pl: Part[] = [];
    const n = clamp(Math.round(w / 0.2), 2, 6);
    const zm = z0 + bd * 0.45;
    const nM = clamp(Math.round(w / 0.12), 3, 12);
    for (const k of range(nM)) {
      const x = lerp(-w / 2 + 0.06, w / 2 - 0.06, nM === 1 ? 0.5 : k / (nM - 1));
      pl.push(sphere('leaf', [x, yT + 0.01, zm], 0.5, { scale: [Math.max(0.12, (w / nM) * 1.4), 0.09, bd * 0.85], plan: false }));
    }
    const ph = clamp(h - yT - 0.05, 0.06, 0.22);
    cells(n, -w / 2 + 0.03, w / 2 - 0.03).forEach((gx, i) => {
      const H: V3 = [gx + (rand() - 0.5) * 0.04, yT + ph * lerp(0.7, 1, rand()), zm + (rand() - 0.5) * bd * 0.3];
      for (const q of range(4)) {
        const az = q * 1.57 + rand();
        const dir = vNorm([Math.cos(az), 0.35, Math.sin(az)]);
        pl.push(petal('leaf', [gx, yT + 0.03, zm], dir, faceToward(dir, UP), 0.075, 0.07, 0.008));
      }
      pl.push(rod('leaf', [gx, yT, zm], H, 0.003, NP), ...blobCluster('flower', H, 0.045, 7, 50 + i));
    });
    cells(n, -w / 2 + 0.05, w / 2 - 0.05).forEach((tx) => {
      const j = (rand() - 0.5) * 0.06;
      const pts: V3[] = [[tx, yT, zf - 0.015], [tx + j, yT + 0.012, zf + 0.03], [tx + j * 2, lerp(yT, 0.03, lerp(0.5, 0.9, rand())), Math.min(d / 2 - 0.03, zf + 0.05)]];
      pl.push(...rodPath('leaf', pts, 0.002));
      for (const q of range(2)) {
        const { p } = alongPath(pts, 0.35 + q * 0.5);
        const side = vNorm([q ? 1 : -1, 0, 0.3]);
        pl.push(petal('leaf', p, side, faceToward(side, FRONT), 0.045, 0.03, 0.004));
      }
      for (const q of range(3)) {
        const { p, t } = alongPath(pts, 0.2 + q * 0.38);
        const tdir = vNorm(vAdd(vMul(t, 0.3), [(q - 1) * 0.7, 0.4, 0.8]));
        pl.push(rod('flower2', p, vAdd(p, vMul(tdir, 0.035)), 0.004, { rTop: 0.024, plan: false }));
      }
    });
    parts.push(...fitParts(pl, [0, yT, zm], itemBox(w, d, h, { z0: zb })));
    return parts;
  },
  planDetail: ({ w, d }) => {
    const bd = clamp(d * 0.7, 0.12, 0.25);
    return [rectPoly(-w / 2 + 0.01, -d / 2 + 0.012, w / 2 - 0.01, -d / 2 + 0.012 + bd), line([-w / 2 + 0.05, d / 2 - 0.03], [w / 2 - 0.05, d / 2 - 0.03])];
  },
});

// ---------------------------------------------------------------------------
// Cut flowers & arrangements
// ---------------------------------------------------------------------------

const tulips = defineItem({
  id: 'flowers-tulips',
  name: 'Tulips in vase',
  category: 'decor',
  type: 'decor',
  group: 'Ornaments',
  tags: ['tulips', 'flowers', 'spring', 'bouquet', 'glass vase', 'cut flowers'],
  defaultSize: { w: 0.32, d: 0.32, h: 0.55 },
  minSize: { w: 0.2, d: 0.2, h: 0.35 },
  maxSize: { w: 0.6, d: 0.6, h: 0.9 },
  slots: [
    matSlot('vase', 'Glass vase', 'glass-vase'),
    matSlot('water', 'Water', 'water'),
    matSlot('stem', 'Stems & leaves', 'leaf-tulip'),
    matSlot('petal', 'Tulips', 'petal-pink'),
  ],
  build: ({ w, d, h }) => {
    const r = Math.min(w, d) / 2;
    const rand = rng(1414);
    const vr = clamp(r * 0.36, 0.04, 0.085);
    const vh = clamp(h * 0.4, 0.13, 0.3);
    const parts: Part[] = [
      lathe('vase', [0, 0, 0], [[0, 0], [vr * 0.98, 0], [vr, 0.006], [vr, vh], [vr * 0.93, vh], [vr * 0.93, 0.008], [0, 0.008]], { segments: 32 }),
      vcyl('water', 0, 0, 0.009, vh * 0.62, vr * 0.9, NP),
    ];
    const fl: Part[] = [];
    const n = clamp(Math.round(r * 55), 6, 12);
    const pl = clamp(r * 0.3, 0.04, 0.065);
    for (const i of range(n)) {
      const az = (i / n) * TAU + rand() * 0.4;
      const headR = lerp(vr * 0.7, r * 0.6, rand());
      const headY = lerp(h * 0.66, h * 0.86, rand());
      const mid = polar(az, lerp(vr * 0.6, headR, 0.45), lerp(vh, headY, 0.55));
      const hb = polar(az, headR, headY - pl * 0.9);
      fl.push(...rodPath('stem', [polar(az + Math.PI, vr * 0.5 * rand(), 0.012), polar(az, vr * 0.6, vh), mid, hb], 0.0035));
      const ax = vNorm(vAdd(vNorm(vSub(hb, mid)), [0, 0.6, 0]));
      fl.push(...petalRing('petal', hb, ax, 3, pl, pl * 0.62, pl * 0.22, 1.3, az, 0.004));
      fl.push(...petalRing('petal', hb, ax, 3, pl * 0.95, pl * 0.6, pl * 0.2, 1.4, az + Math.PI / 3, 0.002));
    }
    for (const k of range(4)) {
      const az = (k / 4) * TAU + 0.4;
      fl.push(...strapLeaf('stem', polar(az, vr * 0.5, vh - 0.01), az, h * 0.3, 0.034, [1.4, 1.05, 0.5], STRAP_TILE / 2, 0.003));
    }
    parts.push(...fitParts(fl, [0, vh, 0], itemBox(w, d, h)));
    return parts;
  },
  planDetail: ({ w, d }) => {
    const r = Math.min(w, d) / 2;
    return [circle([0, 0], clamp(r * 0.36, 0.04, 0.085)), circle([0, 0], r * 0.8)];
  },
});

const roses = defineItem({
  id: 'flowers-roses',
  name: 'Rose bouquet',
  category: 'decor',
  type: 'decor',
  group: 'Ornaments',
  tags: ['roses', 'red roses', 'bouquet', 'flowers', 'romantic', 'bubble vase', 'ribbon'],
  defaultSize: { w: 0.38, d: 0.38, h: 0.48 },
  minSize: { w: 0.24, d: 0.24, h: 0.3 },
  maxSize: { w: 0.7, d: 0.7, h: 0.9 },
  slots: [
    matSlot('vase', 'Glass vase', 'glass-vase'),
    matSlot('leaf', 'Stems & leaves', 'leaf-deep'),
    matSlot('petal', 'Roses', 'petal-red'),
    matSlot('ribbon', 'Ribbon', 'satin-ribbon'),
  ],
  build: ({ w, d, h }) => {
    const r = Math.min(w, d) / 2;
    const rand = rng(1515);
    const vr = clamp(r * 0.5, 0.06, 0.12);
    const vh = clamp(vr * 1.55, 0.09, h * 0.42);
    const yB = vh + clamp(h * 0.06, 0.02, 0.05);
    const parts: Part[] = [
      lathe('vase', [0, 0, 0], [
        [0, 0],
        [vr * 0.55, 0],
        [vr * 0.9, vh * 0.2],
        [vr, vh * 0.5],
        [vr * 0.82, vh * 0.85],
        [vr * 0.62, vh],
        [vr * 0.56, vh],
        [vr * 0.74, vh * 0.84],
        [vr * 0.92, vh * 0.5],
        [vr * 0.84, vh * 0.22],
        [vr * 0.5, 0.008],
        [0, 0.008],
      ], { segments: 32 }),
    ];
    const fl: Part[] = [
      ring('ribbon', [0, yB, 0], 0.018, 0.005),
      torus('ribbon', [-0.016, yB, 0.022], 0.013, 0.004, { rotation: [0, 0.5, 0], plan: false }),
      torus('ribbon', [0.016, yB, 0.022], 0.013, 0.004, { rotation: [0, -0.5, 0], plan: false }),
      span('ribbon', [-0.016, -0.004], [yB - 0.055, yB - 0.005], [0.022, 0.024], { rotation: [0, 0, -0.2], plan: false }),
      span('ribbon', [0.004, 0.016], [yB - 0.055, yB - 0.005], [0.022, 0.024], { rotation: [0, 0, 0.2], plan: false }),
    ];
    const n = clamp(Math.round(r * 55), 7, 11);
    const hr = clamp(r * 0.25, 0.03, 0.06);
    const Rs = clamp(r * 0.55, 0.07, 0.3);
    const Cd: V3 = [0, Math.max(yB + 0.05, h - Rs - hr * 1.1), 0];
    const ring1 = Math.round((n - 1) * 0.4);
    const dirs: V3[] = [UP];
    for (const k of range(ring1)) dirs.push(dirAt((k / ring1) * TAU + 0.3, 0.55));
    for (const k of range(n - 1 - ring1)) dirs.push(dirAt((k / (n - 1 - ring1)) * TAU, 1.0));
    for (const [i, u] of dirs.entries()) {
      const c = vAdd(Cd, vMul(u, Rs));
      fl.push(...roseHead('petal', c, u, hr * lerp(0.9, 1.08, rand()), rand() * TAU));
      const az = Math.atan2(u[2], u[0]) + (i ? 0 : 1);
      fl.push(rod('leaf', polar(az + Math.PI, vr * 0.45, 0.012), [0, yB, 0], 0.003, NP), rod('leaf', [0, yB, 0], vSub(c, vMul(u, hr * 0.4)), 0.003, NP));
    }
    for (const k of range(6)) {
      const u = dirAt((k / 6) * TAU + 0.5, 1.3);
      const b = vAdd(Cd, vMul(u, Rs * 0.85));
      const dir = vNorm(vAdd(u, [0, -0.3, 0]));
      fl.push(petal('leaf', b, dir, faceToward(dir, UP), hr * 1.5, hr * 0.85, 0.004));
    }
    parts.push(...fitParts(fl, [0, yB, 0], itemBox(w, d, h)));
    return parts;
  },
  planDetail: ({ w, d }) => {
    const r = Math.min(w, d) / 2;
    return [circle([0, 0], clamp(r * 0.5, 0.06, 0.12)), circle([0, 0], r * 0.85)];
  },
});

const sunflowers = defineItem({
  id: 'flowers-sunflowers',
  name: 'Sunflowers in jug',
  category: 'decor',
  type: 'decor',
  group: 'Ornaments',
  tags: ['sunflowers', 'flowers', 'jug', 'enamel', 'summer', 'yellow', 'cut flowers'],
  defaultSize: { w: 0.45, d: 0.4, h: 0.7 },
  minSize: { w: 0.28, d: 0.24, h: 0.4 },
  maxSize: { w: 0.8, d: 0.7, h: 1.1 },
  slots: [
    matSlot('jug', 'Enamel jug', 'enamel-blue'),
    matSlot('leaf', 'Stems & leaves', 'leaf-bright'),
    matSlot('petal', 'Petals', 'petal-sunflower'),
    matSlot('centre', 'Seed heads', 'sunflower-centre'),
  ],
  build: ({ w, d, h }) => {
    const rand = rng(1616);
    const jr = clamp(Math.min(w * 0.22, d * 0.4), 0.05, 0.1);
    const jh = clamp(h * 0.32, 0.1, 0.25);
    const hdl = Math.max(0.02, Math.min(jh * 0.22, (w / 2 - jr - 0.014) / 1.4));
    const parts: Part[] = [
      lathe('jug', [0, 0, 0], [[0, 0], [jr * 0.85, 0], [jr, jh * 0.15], [jr, jh * 0.55], [jr * 0.82, jh * 0.85], [jr * 0.86, jh], [jr * 0.78, jh], [jr * 0.76, jh * 0.9], [0, jh * 0.9]], { segments: 32 }),
      ring('jug', [0, jh, 0], jr * 0.82, 0.005, NP),
      torus('jug', [-(jr * 0.92 + hdl * 0.4), jh * 0.58, 0], hdl, 0.008, NP),
    ];
    const fl: Part[] = [];
    const n = clamp(Math.round(w * 9), 3, 6);
    const hr = clamp((w / n) * 0.42, 0.03, 0.08);
    for (const i of range(n)) {
      const hx = lerp(-w * 0.3, w * 0.3, n === 1 ? 0.5 : i / (n - 1)) + (rand() - 0.5) * 0.03;
      const hy = h - hr * 1.9 - (i % 2) * h * 0.12 - rand() * 0.04;
      const H: V3 = [hx, hy, lerp(-d * 0.12, d * 0.1, rand())];
      const ax = vNorm([hx * 2, 0.45, 1]);
      const pa = perp(ax);
      fl.push(ellip('centre', H, hr * 2, hr * 2, hr * 0.5, pa, ax));
      fl.push(ellip('leaf', vSub(H, vMul(ax, hr * 0.25)), hr * 2.1, hr * 2.1, hr * 0.35, pa, ax));
      fl.push(...petalRing('petal', vSub(H, vMul(ax, 0.003)), ax, 14, hr * 0.95, hr * 0.36, 0.004, 0.12, rand(), hr * 0.8));
      const az = Math.atan2(H[2], H[0]);
      const pts: V3[] = [polar(az + Math.PI, jr * 0.3, jh * 0.4), polar(az, jr * 0.5, jh), vSub(H, vMul(ax, hr * 0.4))];
      fl.push(...rodPath('leaf', pts, 0.006));
      for (const s of [-1, 1]) {
        const { p } = alongPath(pts, 0.6 + s * 0.08);
        const dir = vNorm([s * 0.9, -0.15, 0.4]);
        fl.push(petal('leaf', p, dir, faceToward(dir, vNorm([0, 0.6, 1])), hr * 2.4, hr * 1.8, 0.006));
      }
    }
    parts.push(...fitParts(fl, [0, jh, 0], itemBox(w, d, h)));
    return parts;
  },
  planDetail: ({ w, d }) => [circle([0, 0], clamp(Math.min(w * 0.22, d * 0.4), 0.05, 0.1)), line([-w * 0.4, d * 0.2], [w * 0.4, d * 0.2])],
});

const hydrangea = defineItem({
  id: 'flowers-hydrangea',
  name: 'Hydrangea in vase',
  category: 'decor',
  type: 'decor',
  group: 'Ornaments',
  tags: ['hydrangea', 'mophead', 'blue flowers', 'urn', 'flowers', 'cut flowers'],
  defaultSize: { w: 0.45, d: 0.45, h: 0.5 },
  minSize: { w: 0.28, d: 0.28, h: 0.3 },
  maxSize: { w: 0.8, d: 0.8, h: 0.9 },
  slots: [
    matSlot('vase', 'Vase', 'stoneware'),
    matSlot('leaf', 'Leaves', 'leaf-bright'),
    matSlot('flower', 'Blooms', 'petal-blue'),
  ],
  build: ({ w, d, h }) => {
    const r = Math.min(w, d) / 2;
    const rand = rng(1717);
    const vr = clamp(r * 0.45, 0.06, 0.13);
    const vh = clamp(h * 0.42, 0.12, 0.3);
    const parts: Part[] = [pot('vase', [0, 0, 0], vr, vh, 'urn')];
    const fl: Part[] = [];
    const n = clamp(Math.round(r * 13), 2, 5);
    const hr = clamp(r * 0.42, 0.06, 0.12);
    for (const i of range(n)) {
      const a = (i / Math.max(1, n - 1)) * TAU + 0.6;
      const Hc: V3 = i === 0 ? [0, h - hr, 0] : polar(a, r - hr * 1.15 - 0.005, Math.min(h - hr, vh + hr * 0.9 + rand() * 0.04));
      fl.push(sphere('flower', Hc, hr * 0.78, NP));
      for (const u of capDirs(16, -0.35)) {
        fl.push(ellip('flower', vAdd(Hc, vMul(u, hr * 0.72)), hr * 0.42, hr * 0.42, hr * 0.22, perp(u), u));
      }
      fl.push(rod('leaf', [0, vh * 0.6, 0], vSub(Hc, [0, hr * 0.5, 0]), 0.005, NP));
      for (const s of [-1, 1]) {
        const rad = vNorm(i === 0 ? polar(s > 0 ? 0.3 : 3.4, 1, 0) : polar(a + s * 0.6, 1, 0));
        const dir = vNorm(vAdd(rad, [0, -0.45, 0]));
        fl.push(petal('leaf', vAdd(Hc, vAdd(vMul(rad, hr * 0.4), [0, -hr * 0.6, 0])), dir, faceToward(dir, UP), hr * 1.2, hr * 0.7, 0.006));
      }
    }
    parts.push(...fitParts(fl, [0, vh, 0], itemBox(w, d, h)));
    return parts;
  },
  planDetail: ({ w, d }) => {
    const r = Math.min(w, d) / 2;
    return [circle([0, 0], clamp(r * 0.45, 0.06, 0.13)), circle([0, 0], r * 0.9)];
  },
});

const eucalyptus = defineItem({
  id: 'flowers-eucalyptus',
  name: 'Eucalyptus stems',
  category: 'decor',
  type: 'decor',
  group: 'Ornaments',
  tags: ['eucalyptus', 'silver dollar', 'greenery', 'stems', 'bottle vase', 'foliage'],
  defaultSize: { w: 0.4, d: 0.3, h: 0.7 },
  minSize: { w: 0.22, d: 0.18, h: 0.4 },
  maxSize: { w: 0.8, d: 0.6, h: 1.2 },
  slots: [
    matSlot('vase', 'Bottle vase', 'stoneware'),
    matSlot('leaf', 'Leaves', 'leaf-silver'),
    matSlot('stem', 'Stems', 'euc-stem'),
  ],
  build: ({ w, d, h }) => {
    const rand = rng(1818);
    const vr = clamp(Math.min(w, d) * 0.2, 0.035, 0.075);
    const vh = clamp(h * 0.38, 0.14, 0.32);
    const parts: Part[] = [
      lathe('vase', [0, 0, 0], [[0, 0], [vr * 0.9, 0], [vr, 0.01], [vr, vh * 0.55], [vr * 0.85, vh * 0.72], [vr * 0.38, vh * 0.86], [vr * 0.3, vh * 0.97], [vr * 0.36, vh], [0, vh]], { segments: 28 }),
    ];
    const fl: Part[] = [];
    const S = clamp(Math.round(w * 14), 4, 7);
    const L = h - vh;
    const lr0 = clamp(L * 0.07, 0.016, 0.032);
    for (const s of range(S)) {
      const az = (s / S) * TAU + rand() * 0.5;
      const lean = lerp(0.15, 0.6, rand());
      const ll = L * lerp(0.85, 1.0, rand());
      const p0: V3 = [0, vh, 0];
      const p1 = vAdd(p0, vMul(dirAt(az, lean * 0.5), ll * 0.35));
      const p2 = vAdd(p1, vMul(dirAt(az, lean), ll * 0.35));
      const p3 = vAdd(p2, vMul(dirAt(az + 0.2, lean * 1.25), ll * 0.3));
      const pts = [p0, p1, p2, p3];
      fl.push(...rodPath('stem', pts, 0.0025));
      const out = polar(az, 1, 0);
      for (const q of range(6)) {
        const f = 0.2 + q * 0.155;
        const { p, t } = alongPath(pts, f);
        let side = vNorm(vCross(t, out), perp(t));
        if (q % 2) side = vNorm(vCross(t, side), perp(t));
        const lr = lr0 * lerp(1.1, 0.6, f);
        for (const sg of [-1, 1]) {
          const dir = vNorm(vAdd(vMul(side, sg), vMul(t, 0.25)));
          fl.push(petal('leaf', p, dir, faceToward(dir, vNorm(vAdd(out, [0, 0.7, 0]))), lr * 2.05, lr * 2, 0.0025));
        }
      }
    }
    parts.push(...fitParts(fl, [0, vh, 0], itemBox(w, d, h)));
    return parts;
  },
  planDetail: ({ w, d }) => [circle([0, 0], clamp(Math.min(w, d) * 0.2, 0.035, 0.075)), poly(ellipsePoints(0, 0, w * 0.4, d * 0.4, 12))],
});

const pampas = defineItem({
  id: 'flowers-pampas',
  name: 'Dried pampas grass',
  category: 'decor',
  type: 'decor',
  group: 'Ornaments',
  tags: ['pampas', 'dried flowers', 'boho', 'floor vase', 'plumes', 'grass'],
  defaultSize: { w: 0.6, d: 0.6, h: 1.3 },
  minSize: { w: 0.35, d: 0.35, h: 0.7 },
  maxSize: { w: 1.2, d: 1.2, h: 2.0 },
  slots: [
    matSlot('vase', 'Floor vase', 'terracotta-pot'),
    matSlot('plume', 'Plumes', 'pampas-plume'),
    matSlot('stem', 'Stems & blades', 'dried-stem'),
  ],
  build: ({ w, d, h }) => {
    const r = Math.min(w, d) / 2;
    const rand = rng(1919);
    const vr = clamp(r * 0.45, 0.07, 0.18);
    const vh = clamp(h * 0.36, 0.22, 0.6);
    const prof: V2[] = [
      [0, 0],
      [vr * 0.7, 0],
      [vr * 0.95, vh * 0.3],
      [vr, vh * 0.5],
      [vr * 0.7, vh * 0.82],
      [vr * 0.42, vh * 0.92],
      [vr * 0.48, vh],
      [vr * 0.4, vh],
      [vr * 0.36, vh * 0.94],
      [0, vh * 0.94],
    ];
    const radAt = (y: number) => {
      for (let i = 1; i < 6; i++) {
        if (y <= prof[i][1]) return lerp(prof[i - 1][0], prof[i][0], (y - prof[i - 1][1]) / Math.max(1e-6, prof[i][1] - prof[i - 1][1]));
      }
      return vr * 0.42;
    };
    const parts: Part[] = [lathe('vase', [0, 0, 0], prof, { segments: 32 })];
    for (const f of [0.18, 0.3, 0.42, 0.54, 0.66]) parts.push(ring('vase', [0, vh * f, 0], radAt(vh * f), 0.005, NP));
    const fl: Part[] = [];
    const P = clamp(Math.round(r * 24), 5, 11);
    const neck: V3 = [0, vh * 0.96, 0];
    for (const i of range(P)) {
      const az = (i / P) * TAU + rand() * 0.6;
      const lean = lerp(0.06, 0.5, rand());
      const L = (h - vh) * lerp(0.75, 1.0, rand());
      const p1 = vAdd(neck, vMul(dirAt(az, lean * 0.7), L * 0.5));
      const p2 = vAdd(p1, vMul(dirAt(az, lean * 1.25), L * 0.5));
      const pts = [neck, p1, p2];
      fl.push(...rodPath('stem', pts, 0.004));
      const pl = L * 0.45;
      for (const [f, k] of [[0.66, 0.2], [0.8, 0.17], [0.93, 0.11]] as [number, number][]) {
        const { p, t } = alongPath(pts, f);
        fl.push(ellip('plume', p, pl * k, pl * 0.42, pl * k, t, perp(t)));
      }
    }
    for (const k of range(6)) {
      const az = (k / 6) * TAU + 0.3;
      fl.push(...strapLeaf('stem', neck, az, (h - vh) * 0.6, 0.012, [1.35, 0.9, 0.2], 0, 0.002));
    }
    parts.push(...fitParts(fl, neck, itemBox(w, d, h)));
    return parts;
  },
  planDetail: ({ w, d }) => {
    const r = Math.min(w, d) / 2;
    return [circle([0, 0], clamp(r * 0.45, 0.07, 0.18)), circle([0, 0], r * 0.9)];
  },
});

const cherryBlossom = defineItem({
  id: 'flowers-cherry-blossom',
  name: 'Cherry blossom branch',
  category: 'decor',
  type: 'decor',
  group: 'Ornaments',
  tags: ['cherry blossom', 'sakura', 'ikebana', 'branch', 'spring', 'japanese', 'suiban'],
  defaultSize: { w: 0.6, d: 0.3, h: 0.6 },
  minSize: { w: 0.35, d: 0.2, h: 0.35 },
  maxSize: { w: 1.2, d: 0.6, h: 1.2 },
  slots: [
    matSlot('dish', 'Ikebana dish', 'glaze-ink'),
    matSlot('branch', 'Branch', 'bark'),
    matSlot('blossom', 'Blossom', 'petal-sakura'),
    matSlot('water', 'Water', 'water'),
  ],
  build: ({ w, d, h }) => {
    const rand = rng(2020);
    const dr = clamp(Math.min(w * 0.32, d * 0.46), 0.08, 0.2);
    const dh = clamp(h * 0.08, 0.035, 0.06);
    const parts: Part[] = [
      lathe('dish', [0, 0, 0], [[0, 0], [dr * 0.9, 0], [dr, dh * 0.3], [dr, dh], [dr * 0.94, dh], [dr * 0.92, dh * 0.25], [0, dh * 0.25]], { segments: 36 }),
      vcyl('water', 0, 0, dh * 0.25, dh * 0.75, dr * 0.93, NP),
      sphere('dish', [dr * 0.45, dh * 0.75, dr * 0.2], dr * 0.16, { scale: [1.3, 0.6, 1], plan: false }),
      sphere('dish', [dr * 0.55, dh * 0.72, -dr * 0.15], dr * 0.11, { scale: [1.2, 0.6, 1], plan: false }),
    ];
    const br: Part[] = [];
    const pl = clamp(h * 0.032, 0.013, 0.026);
    let blossoms = 0;
    const bloom = (c: V3, dir: V3) => {
      if (blossoms >= 16) return;
      blossoms++;
      const ax = vNorm(vAdd(vMul(dir, 0.6), [(rand() - 0.5) * 1.2, 0.5, 0.5 + rand() * 0.6]));
      br.push(...petalRing('blossom', c, ax, 5, pl, pl * 0.85, pl * 0.25, 0.3, rand() * TAU, pl * 0.1));
    };
    const grow = (p: V3, dir: V3, len: number, rad: number, depth: number) => {
      const bend = vMul(vNorm(vCross(dir, FRONT), perp(dir)), rand() < 0.5 ? -1 : 1);
      const mid = vAdd(vAdd(p, vMul(dir, len * 0.5)), vMul(bend, len * 0.08));
      const end = vAdd(p, vMul(dir, len));
      br.push(rod('branch', p, mid, rad, { rTop: rad * 0.9, plan: false }), rod('branch', mid, end, rad * 0.9, { rTop: rad * 0.75, plan: false }));
      if (depth <= 2) bloom(mid, dir);
      if (depth === 0) {
        bloom(end, dir);
        br.push(sphere('blossom', vAdd(end, vMul(dir, pl * 0.6)), pl * 0.4, NP));
        return;
      }
      const kids = depth === 2 && rand() < 0.5 ? 3 : 2;
      for (const k of range(kids)) {
        const axis = vNorm([(rand() - 0.5) * 0.5, (rand() - 0.5) * 0.5, 1]);
        const nd = vNorm(vAdd(rotAbout(dir, axis, (k % 2 ? 1 : -1) * lerp(0.35, 0.65, rand())), [0, 0.1, 0]));
        grow(k === 2 ? mid : end, nd, len * lerp(0.55, 0.7, rand()), rad * 0.65, depth - 1);
      }
    };
    const start: V3 = [-dr * 0.15, dh * 0.6, 0];
    grow(start, vNorm([0.3, 1, 0.1]), h * 0.36, clamp(h * 0.02, 0.008, 0.02), 3);
    parts.push(...fitParts(br, start, itemBox(w, d, h)));
    return parts;
  },
  planDetail: ({ w, d }) => {
    const dr = clamp(Math.min(w * 0.32, d * 0.46), 0.08, 0.2);
    return [circle([0, 0], dr), line([-dr * 0.15, 0], [w * 0.4, 0])];
  },
});

const hyacinth = defineItem({
  id: 'flowers-hyacinth',
  name: 'Hyacinth bulbs in glass',
  category: 'decor',
  type: 'decor',
  group: 'Ornaments',
  tags: ['hyacinth', 'bulbs', 'forcing vase', 'spring', 'roots', 'purple flowers', 'glass'],
  defaultSize: { w: 0.45, d: 0.16, h: 0.42 },
  minSize: { w: 0.14, d: 0.12, h: 0.3 },
  maxSize: { w: 0.9, d: 0.3, h: 0.6 },
  slots: [
    matSlot('glass', 'Forcing vases', 'glass-vase'),
    matSlot('bulb', 'Bulbs & roots', 'bulb-skin'),
    matSlot('leaf', 'Leaves', 'leaf-tulip'),
    matSlot('flower', 'Flowers', 'petal-purple'),
  ],
  build: ({ w, d, h }) => {
    const rand = rng(2121);
    const n = clamp(Math.round(w / 0.14), 1, 4);
    const cw = w / n;
    const vr = clamp(Math.min(cw, d) * 0.4, 0.03, 0.055);
    const vh = clamp(h * 0.42, 0.11, 0.2);
    const F = n >= 4 ? 16 : 20;
    const parts: Part[] = [];
    cells(n, -w / 2, w / 2).forEach((cx) => {
      parts.push(
        lathe('glass', [cx, 0, 0], [[0, 0], [vr * 0.9, 0], [vr, 0.01], [vr, vh * 0.55], [vr * 0.55, vh * 0.7], [vr * 0.55, vh * 0.75], [vr * 0.85, vh * 0.9], [vr * 0.95, vh]], { segments: 28 }),
        vcyl('glass', cx, 0, 0.004, vh * 0.6, vr * 0.92, NP),
      );
      const bR = vr * 0.75;
      const yBulb = vh * 0.82 + bR * 0.5;
      const pl: Part[] = [
        sphere('bulb', [cx, yBulb, 0], bR, { scale: [1, 0.85, 1], plan: false }),
        cyl('bulb', [cx, yBulb + bR * 0.85, 0], bR * 0.5, bR * 0.5, { rTop: bR * 0.15, plan: false }),
      ];
      for (const k of range(6)) {
        const a = (k / 6) * TAU + rand();
        pl.push(rod('bulb', [cx, yBulb - bR * 0.7, 0], vAdd([cx, lerp(0.015, vh * 0.3, rand()), 0], polar(a, vr * lerp(0.3, 0.75, rand()), 0)), 0.0012, NP));
      }
      const top: V3 = [cx, yBulb + bR * 0.9, 0];
      const yS0 = top[1] + 0.03;
      const yS1 = h - 0.016;
      for (const k of range(4)) {
        const az = (k / 4) * TAU + 0.5;
        const dir = dirAt(az, lerp(0.12, 0.35, rand()));
        pl.push(plate('leaf', lanceOutline((yS1 - top[1]) * lerp(0.5, 0.7, rand()), 0.024, 0.85), top, dir, faceToward(dir, polar(az, 1, 0)), 0.003, STRAP_TILE / 2));
      }
      pl.push(vcyl('leaf', cx, 0, top[1], yS0, 0.006, NP), vcyl('flower', cx, 0, yS0, yS1 - 0.005, 0.01, { rTop: 0.005, plan: false }));
      for (const j of range(F)) {
        const t = j / (F - 1);
        const a = j * 2.39996;
        const rad = lerp(0.017, 0.007, Math.pow(t, 1.5));
        const out = polar(a, 1, 0);
        pl.push(ellip('flower', vAdd([cx, lerp(yS0 + 0.008, yS1 - 0.006, t), 0], vMul(out, rad)), 0.016, 0.016, 0.008, perp(out), out));
      }
      parts.push(...fitParts(pl, [cx, vh, 0], itemBox(w, d, h, { x0: cx - cw / 2, x1: cx + cw / 2 })));
    });
    return parts;
  },
  planDetail: ({ w, d }) => {
    const n = clamp(Math.round(w / 0.14), 1, 4);
    const vr = clamp(Math.min(w / n, d) * 0.4, 0.03, 0.055);
    return cells(n, -w / 2, w / 2).map((x) => circle([x, 0], vr));
  },
});

const lilies = defineItem({
  id: 'flowers-lilies',
  name: 'Lily bouquet',
  category: 'decor',
  type: 'decor',
  group: 'Ornaments',
  tags: ['lilies', 'oriental lily', 'white flowers', 'bouquet', 'trumpet vase', 'cut flowers'],
  defaultSize: { w: 0.45, d: 0.4, h: 0.75 },
  minSize: { w: 0.28, d: 0.25, h: 0.45 },
  maxSize: { w: 0.8, d: 0.7, h: 1.2 },
  slots: [
    matSlot('vase', 'Glass vase', 'glass-vase'),
    matSlot('leaf', 'Stems & leaves', 'leaf-deep'),
    matSlot('petal', 'Lilies', 'petal-lily'),
    matSlot('anther', 'Pollen', 'pollen'),
  ],
  build: ({ w, d, h }) => {
    const r = Math.min(w, d) / 2;
    const rand = rng(2222);
    const vr = clamp(r * 0.33, 0.045, 0.09);
    const vh = clamp(h * 0.4, 0.16, 0.38);
    const parts: Part[] = [
      lathe('vase', [0, 0, 0], [[0, 0], [vr * 0.75, 0], [vr * 0.62, 0.015], [vr * 0.55, vh * 0.45], [vr * 0.7, vh * 0.8], [vr, vh], [vr * 0.95, vh], [vr * 0.66, vh * 0.8], [vr * 0.5, vh * 0.45], [vr * 0.55, 0.018], [0, 0.018]], { segments: 32 }),
    ];
    const fl: Part[] = [];
    const n = clamp(Math.round(r * 18), 3, 4);
    const pl = clamp(r * 0.5, 0.07, 0.13);
    for (const i of range(n)) {
      const az = (i / n) * TAU + 0.4 + rand() * 0.4;
      const out = polar(az, 1, 0);
      const Hc = polar(az, lerp(r * 0.3, r * 0.55, rand()), lerp(h * 0.62, h * 0.8, rand()));
      const ax = vNorm(vAdd(vAdd(vMul(out, 0.9), [0, 0.6, 0]), [0, 0, 0.3]));
      fl.push(...lilyHead('petal', 'leaf', 'anther', Hc, ax, pl, rand() * TAU));
      const pts: V3[] = [polar(az + Math.PI, vr * 0.3, 0.02), polar(az, vr * 0.45, vh), vSub(Hc, vMul(ax, 0.01))];
      fl.push(...rodPath('leaf', pts, 0.004));
      const { p } = alongPath(pts, 0.75);
      const dir = vNorm(vAdd(out, [0, 0.5, 0]));
      fl.push(plate('leaf', lanceOutline(pl * 1.1, pl * 0.25), p, dir, faceToward(dir, UP), 0.002, STRAP_TILE / 2));
    }
    for (const k of range(2)) {
      const az = k * 2.6 + 1.2;
      const tip = polar(az, r * 0.3, h * 0.9);
      const dir = vNorm(vAdd(polar(az, 0.35, 0), UP));
      fl.push(rod('leaf', [0, vh, 0], tip, 0.003, NP), ellip('petal', vAdd(tip, vMul(dir, pl * 0.4)), pl * 0.3, pl * 0.9, pl * 0.3, dir, perp(dir)));
    }
    parts.push(...fitParts(fl, [0, vh, 0], itemBox(w, d, h)));
    return parts;
  },
  planDetail: ({ w, d }) => {
    const r = Math.min(w, d) / 2;
    return [circle([0, 0], clamp(r * 0.33, 0.045, 0.09)), circle([0, 0], r * 0.85)];
  },
});

const wildflowers = defineItem({
  id: 'flowers-wildflowers',
  name: 'Wildflower jar',
  category: 'decor',
  type: 'decor',
  group: 'Ornaments',
  tags: ['wildflowers', 'daisies', 'buttercups', 'cow parsley', 'mason jar', 'meadow', 'posy'],
  defaultSize: { w: 0.35, d: 0.3, h: 0.5 },
  minSize: { w: 0.2, d: 0.18, h: 0.3 },
  maxSize: { w: 0.6, d: 0.5, h: 0.8 },
  slots: [
    matSlot('jar', 'Mason jar', 'glass-vase'),
    matSlot('stem', 'Stems & grasses', 'leaf-bright'),
    matSlot('white', 'White flowers', 'petal-white'),
    matSlot('yellow', 'Yellow flowers', 'petal-yellow'),
  ],
  build: ({ w, d, h }) => {
    const r = Math.min(w, d) / 2;
    const rand = rng(2323);
    const jr = clamp(Math.min(w, d) * 0.24, 0.04, 0.075);
    const jh = clamp(h * 0.3, 0.1, 0.18);
    const parts: Part[] = [
      lathe('jar', [0, 0, 0], [[0, 0], [jr * 0.95, 0], [jr, 0.008], [jr, jh * 0.8], [jr * 0.86, jh * 0.88], [jr * 0.8, jh * 0.9], [jr * 0.8, jh], [jr * 0.74, jh], [jr * 0.74, 0.01], [0, 0.01]], { segments: 32 }),
      ring('jar', [0, jh * 0.93, 0], jr * 0.8, 0.0025, NP),
      ring('jar', [0, jh * 0.97, 0], jr * 0.8, 0.0025, NP),
    ];
    const fl: Part[] = [];
    let idx = 0;
    const stem = (y: number, rad: number): { pts: V3[]; top: V3; ax: V3; az: number } => {
      const az = idx * 2.39996 + rand() * 0.5;
      idx++;
      const top = polar(az, rad, y);
      const pts: V3[] = [polar(az + Math.PI, jr * 0.4 * rand(), 0.012), polar(az, jr * 0.5, jh), top];
      fl.push(...rodPath('stem', pts, 0.0022));
      return { pts, top, az, ax: vNorm(vAdd(polar(az, 0.7, 0), [0, 1, 0.25])) };
    };
    const hr = clamp(r * 0.2, 0.022, 0.04);
    for (const k of range(5)) {
      const { top, ax } = stem(lerp(h * 0.65, h - hr * 1.2, rand()), lerp(r * 0.2, r * 0.8, rand()));
      fl.push(...daisyHead('white', 'yellow', top, ax, hr, 9, k));
    }
    for (const k of range(4)) {
      const { top, ax } = stem(lerp(h * 0.55, h * 0.85, rand()), lerp(r * 0.3, r * 0.85, rand()));
      fl.push(...petalRing('yellow', top, ax, 5, hr * 0.55, hr * 0.5, 0.003, 0.75, k));
    }
    for (const k of range(2)) {
      const { top } = stem(lerp(h * 0.75, h * 0.88, rand()), lerp(r * 0.2, r * 0.5, rand()));
      for (const j of range(5)) {
        const dir = dirAt((j / 5) * TAU + k, 0.75);
        const tip = vAdd(top, vMul(dir, hr * 1.3));
        fl.push(rod('stem', top, tip, 0.0012, NP), ellip('white', tip, hr * 0.9, hr * 0.9, hr * 0.35, perp(UP), UP));
      }
    }
    for (let k = 0; k < 4; k++) {
      const { top, pts } = stem(lerp(h * 0.8, h * 0.97, rand()), lerp(r * 0.3, r * 0.8, rand()));
      const t = alongPath(pts, 1).t;
      fl.push(ellip('stem', vAdd(top, vMul(t, hr * 0.8)), 0.008, hr * 1.6, 0.008, t, perp(t)));
    }
    for (const k of range(4)) {
      const az = (k / 4) * TAU + 0.7;
      const dir = dirAt(az, 0.55);
      fl.push(plate('stem', lanceOutline(h * 0.2, 0.016), polar(az, jr * 0.6, jh), dir, faceToward(dir, UP), 0.002, STRAP_TILE / 2));
    }
    parts.push(...fitParts(fl, [0, jh, 0], itemBox(w, d, h)));
    return parts;
  },
  planDetail: ({ w, d }) => {
    const r = Math.min(w, d) / 2;
    return [circle([0, 0], clamp(Math.min(w, d) * 0.24, 0.04, 0.075)), circle([0, 0], r * 0.8)];
  },
});

// ---------------------------------------------------------------------------
// Terrariums
// ---------------------------------------------------------------------------

const terrariumGlobe = defineItem({
  id: 'plant-terrarium-globe',
  name: 'Terrarium globe',
  category: 'decor',
  type: 'plants',
  group: 'Indoor plants',
  tags: ['terrarium', 'glass globe', 'moss', 'fittonia', 'fern', 'miniature garden'],
  defaultSize: { w: 0.36, d: 0.36, h: 0.4 },
  minSize: { w: 0.2, d: 0.2, h: 0.22 },
  maxSize: { w: 0.7, d: 0.7, h: 0.8 },
  slots: [
    matSlot('glass', 'Glass', 'glass-vase'),
    matSlot('ground', 'Sand, stones & stand', 'terrarium-sand'),
    matSlot('moss', 'Moss', 'moss'),
    matSlot('plant', 'Plants', 'leaf-fittonia'),
  ],
  build: ({ w, d, h }) => {
    const rand = rng(2424);
    const R = Math.min(Math.min(w, d) / 2 - 0.004, (h - 0.018) / 2);
    const cy = h - R - 0.002;
    const yb = cy - R;
    const open = 0.62;
    const phiMax = Math.PI - Math.asin(open);
    const prof: V2[] = range(13).map((k) => {
      const ph = (k / 12) * phiMax;
      return [R * Math.sin(ph), -R * Math.cos(ph)] as V2;
    });
    const fill = (y0: number, y1: number, slot: string): Part => {
      const rAt = (y: number) => Math.sqrt(Math.max(0, R * R - (R - y) * (R - y))) * 0.97;
      const ys = range(5).map((k) => lerp(y0, y1, k / 4));
      return lathe(slot, [0, yb, 0], [[0, y0], ...ys.map((y) => [rAt(y), y] as V2), [0, y1]], { segments: 28, plan: false });
    };
    const Ls = R * 0.3;
    const Lm = R * 0.4;
    const yM = yb + Lm;
    const parts: Part[] = [
      latheFront('glass', [0, cy, 0], prof),
      torus('glass', [0, cy, R * Math.cos(Math.asin(open))], R * open, 0.004, NP),
      ring('ground', [0, 0.009, 0], R * 0.42, 0.009),
      fill(0.004, Ls, 'ground'),
      fill(Ls, Lm, 'moss'),
      ...blobCluster('moss', [-R * 0.1, yM, -R * 0.2], R * 0.3, 6, 24),
      sphere('ground', [R * 0.35, yM + R * 0.03, -R * 0.15], R * 0.14, { scale: [1.3, 0.7, 1], plan: false }),
    ];
    for (let k = 0; k < 5; k++) parts.push(sphere('ground', [lerp(-R * 0.4, R * 0.4, rand()), yM, R * lerp(0.2, 0.5, rand())], R * 0.045, { scale: [1.2, 0.6, 1], plan: false }));
    const pl: Part[] = [];
    const fb: V3 = [-R * 0.3, yM, -R * 0.05];
    for (const j of range(7)) {
      const dir = dirAt((j / 7) * TAU + rand() * 0.4, lerp(0.8, 1.3, rand()));
      pl.push(petal('plant', fb, dir, faceToward(dir, UP), R * 0.3, R * 0.2, 0.004));
    }
    const nb: V3 = [R * 0.15, yM, -R * 0.35];
    for (const j of range(4)) {
      const az = (j / 4) * TAU + 0.4;
      pl.push(...frond('moss', nb, az, R * 0.6, R * 0.14, [1.25, 0.55], rand, 5));
    }
    parts.push(...fitParts(pl, [0, yM, 0], [[-R * 0.7, yb + R * 0.3, -R * 0.7], [R * 0.7, cy + R * 0.6, R * 0.6]]));
    return parts;
  },
  planDetail: ({ w, d, h }) => {
    const R = Math.min(Math.min(w, d) / 2 - 0.004, (h - 0.018) / 2);
    return [circle([0, 0], R), line([-R * 0.6, R * 0.78], [R * 0.6, R * 0.78])];
  },
});

const terrariumGeo = defineItem({
  id: 'plant-terrarium-geometric',
  name: 'Geometric terrarium',
  category: 'decor',
  type: 'plants',
  group: 'Indoor plants',
  tags: ['terrarium', 'geometric', 'brass', 'glass', 'succulents', 'wardian case', 'faceted'],
  defaultSize: { w: 0.3, d: 0.3, h: 0.38 },
  minSize: { w: 0.18, d: 0.18, h: 0.22 },
  maxSize: { w: 0.6, d: 0.6, h: 0.8 },
  slots: [
    matSlot('frame', 'Brass frame', 'metal-brass'),
    matSlot('glass', 'Glass', 'glass-vase'),
    matSlot('ground', 'Pebbles', 'gravel'),
    matSlot('plant', 'Succulents', 'succulent'),
  ],
  build: ({ w, d, h }) => {
    const rand = rng(2525);
    const R = (Math.min(w, d) / 2) * 0.97 - 0.004;
    const r0 = R * 0.72;
    const y1 = h * 0.42;
    const apex: V3 = [0, h - 0.016, 0];
    const B = range(6).map((k) => polar((k * Math.PI) / 3, r0, 0.004));
    const M = range(6).map((k) => polar((k * Math.PI) / 3, R, y1));
    const o = NP;
    const parts: Part[] = [
      prism('glass', B.map((p) => [p[0], p[2]] as V2), 0, 0.004),
      sphere('frame', [0, h - 0.008, 0], 0.008, o),
    ];
    for (const k of range(6)) {
      const k1 = (k + 1) % 6;
      parts.push(
        rod('frame', B[k], B[k1], 0.0025, o),
        rod('frame', M[k], M[k1], 0.0025, o),
        rod('frame', B[k], M[k], 0.0025, o),
        rod('frame', M[k], apex, 0.0025, o),
        sphere('frame', M[k], 0.005, o),
        sphere('frame', B[k], 0.004, o),
        panel('glass', [M[k], M[k1], apex]),
      );
      if (k !== 1) parts.push(panel('glass', [B[k], B[k1], M[k1], M[k]]));
    }
    const gh = Math.min(0.05, y1 * 0.3);
    parts.push(prism('ground', range(6).map((k) => polar((k * Math.PI) / 3, r0 * 0.95, 0)).map((p) => [p[0], p[2]] as V2), 0.004, gh, o));
    for (let k = 0; k < 4; k++) parts.push(sphere('ground', [lerp(-r0 * 0.5, r0 * 0.5, rand()), gh + 0.004, lerp(0, r0 * 0.6, rand())], 0.008, { scale: [1.3, 0.7, 1], plan: false }));
    const g = gh + 0.004;
    const pl: Part[] = [
      ...rosette('plant', [-r0 * 0.38, g, -r0 * 0.12], clamp(r0 * 0.3, 0.02, 0.06), 0.3),
      ...rosette('plant', [r0 * 0.4, g, r0 * 0.15], clamp(r0 * 0.22, 0.016, 0.045), 1.1),
      ...blobCluster('plant', [0, g, r0 * 0.35], r0 * 0.2, 4, 25),
    ];
    for (const j of range(7)) {
      const dir = dirAt((j / 7) * TAU + rand(), lerp(0.15, 0.6, rand()));
      pl.push(petal('plant', [r0 * 0.1, g, -r0 * 0.45], dir, faceToward(dir, UP), clamp(y1 * 0.45, 0.03, 0.09), 0.012, 0.006));
    }
    parts.push(...fitParts(pl, [0, g, 0], [[-r0 * 0.85, 0.004, -r0 * 0.8], [r0 * 0.85, y1 + (h - y1) * 0.35, r0 * 0.8]]));
    return parts;
  },
  planDetail: ({ w, d }) => {
    const R = (Math.min(w, d) / 2) * 0.97 - 0.004;
    const hex = (rr: number) => range(6).map((k) => [Math.cos((k * Math.PI) / 3) * rr, Math.sin((k * Math.PI) / 3) * rr] as V2);
    return [poly(hex(R)), poly(hex(R * 0.72)), ...hex(R).map((p) => line([0, 0], p))];
  },
});

const bottleGarden = defineItem({
  id: 'plant-bottle-garden',
  name: 'Bottle garden',
  category: 'decor',
  type: 'plants',
  group: 'Indoor plants',
  tags: ['bottle garden', 'terrarium', 'demijohn', 'carboy', 'sealed', 'ferns', 'moss'],
  defaultSize: { w: 0.34, d: 0.34, h: 0.5 },
  minSize: { w: 0.2, d: 0.2, h: 0.3 },
  maxSize: { w: 0.6, d: 0.6, h: 0.9 },
  slots: [
    matSlot('glass', 'Bottle glass', 'glass-green'),
    matSlot('soil', 'Soil & stones', 'plant-soil'),
    matSlot('plant', 'Plants', 'leaf-fern'),
    matSlot('cork', 'Cork stopper', 'cork'),
  ],
  build: ({ w, d, h }) => {
    const rand = rng(2626);
    const R = Math.min(w, d) / 2 - 0.004;
    const H = h - 0.004;
    const nr = clamp(R * 0.16, 0.018, 0.04);
    const soilH = H * 0.12;
    const parts: Part[] = [
      lathe('glass', [0, 0, 0], [
        [0, 0],
        [R * 0.75, 0],
        [R * 0.96, H * 0.06],
        [R, H * 0.3],
        [R * 0.93, H * 0.5],
        [R * 0.55, H * 0.68],
        [R * 0.2, H * 0.76],
        [nr, H * 0.8],
        [nr, H * 0.9],
        [nr * 1.25, H * 0.91],
        [nr * 1.25, H * 0.94],
        [nr * 0.9, H * 0.94],
      ], { segments: 36 }),
      vcyl('cork', 0, 0, H * 0.9, h, nr * 0.95, { rTop: nr * 1.1, plan: false }),
      lathe('soil', [0, 0.006, 0], [[0, 0], [R * 0.73, 0], [R * 0.9, soilH * 0.6], [R * 0.93, soilH], [0, soilH]], { segments: 28, plan: false }),
      sphere('soil', [R * 0.35, soilH + 0.01, R * 0.2], R * 0.12, { scale: [1.3, 0.7, 1], plan: false }),
    ];
    const g = soilH + 0.006;
    const pl: Part[] = [...blobCluster('plant', [-R * 0.15, g, R * 0.15], R * 0.35, 6, 26)];
    for (const j of range(8)) {
      const az = (j / 8) * TAU + rand() * 0.5;
      pl.push(...frond('plant', [R * 0.1, g, -R * 0.2], az, H * 0.45, R * 0.26, [1.35, 0.8, 0.2], rand, 5));
    }
    for (const j of range(7)) {
      const dir = dirAt((j / 7) * TAU + rand(), lerp(0.5, 1.0, rand()));
      pl.push(petal('plant', [-R * 0.35, g, R * 0.1], dir, faceToward(dir, UP), H * 0.16, H * 0.08, 0.004));
    }
    parts.push(...fitParts(pl, [0, g, 0], [[-R * 0.8, 0.005, -R * 0.8], [R * 0.8, H * 0.55, R * 0.8]]));
    return parts;
  },
  planDetail: ({ w, d }) => {
    const R = Math.min(w, d) / 2 - 0.004;
    return [circle([0, 0], R), circle([0, 0], clamp(R * 0.16, 0.018, 0.04))];
  },
});

// ---------------------------------------------------------------------------
// Pattern helpers
// ---------------------------------------------------------------------------

/** Seamless value noise on an n×n wrapped lattice; u, v in tile units. */
function tileNoise(n: number, rand: () => number): (u: number, v: number) => number {
  const g = Array.from({ length: n * n }, () => rand());
  return (u, v) => {
    const x = (u - Math.floor(u)) * n;
    const y = (v - Math.floor(v)) * n;
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const x0 = xi % n;
    const y0 = yi % n;
    const x1 = (x0 + 1) % n;
    const y1 = (y0 + 1) % n;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = g[y0 * n + x0] + (g[y0 * n + x1] - g[y0 * n + x0]) * sx;
    const b = g[y1 * n + x0] + (g[y1 * n + x1] - g[y1 * n + x0]) * sx;
    return a + (b - a) * sy;
  };
}

const smooth = (a: number, b: number, x: number): number => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------------------
// Pack
// ---------------------------------------------------------------------------

export default definePack({
  name: 'Hanging & decorative plants',
  version: '1.0.0',
  author: 'Neest team',
  description:
    'Hanging ferns, trailing ivy and string of pearls, macramé and kokedama, wall-mounted staghorns and living walls, cut-flower arrangements and glass terrariums.',
  license: 'CC0 (made for Neest)',
  items: [
    bostonFern,
    stringOfPearls,
    spiderPlant,
    macrameHanger,
    kokedama,
    hangingIvy,
    hangingHoya,
    airPlantGlobes,
    staghorn,
    wallPlanters,
    mossFrame,
    livingWall,
    windowBox,
    tulips,
    roses,
    sunflowers,
    hydrangea,
    eucalyptus,
    pampas,
    cherryBlossom,
    hyacinth,
    lilies,
    wildflowers,
    terrariumGlobe,
    terrariumGeo,
    bottleGarden,
  ],
  patterns: [
    {
      id: 'leaf-veins',
      name: 'Leaf veins',
      normalStrength: 0.7,
      // One leaf face per tile: a midrib down the centre (x = 0.5) and paired side veins rising
      // towards the tip (top of the tile), with faint netted veinlets. Veins are lighter than the blade.
      draw(ctx, size, rand) {
        const img = ctx.createImageData(size, size);
        const n1 = tileNoise(6, rand);
        const n2 = tileNoise(24, rand);
        const n3 = tileNoise(48, rand);
        const pairs = 7;
        for (let y = 0; y < size; y++) {
          const v = y / size;
          for (let x = 0; x < size; x++) {
            const u = x / size;
            const dx = Math.abs(u - 0.5);
            const mid = Math.exp(-((dx / 0.012) ** 2));
            const ph = (v + 0.5 * dx + 0.8 * dx * dx) * pairs + (n1(u, v) - 0.5) * 0.25;
            const f = ph - Math.floor(ph);
            const dist = Math.min(f, 1 - f);
            const vein = Math.exp(-((dist / (0.045 - dx * 0.05)) ** 2)) * clamp(1 - dx * 1.6, 0, 1);
            const net = Math.pow(1 - Math.abs(n2(u, v) * 2 - 1), 10);
            let val = 0.8 + 0.05 * n1(u, v) + 0.04 * n3(u, v) + 0.2 * mid + 0.14 * vein + 0.06 * net;
            val = clamp(val, 0, 1);
            const i = (y * size + x) * 4;
            img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(val * 255);
            img.data[i + 3] = 255;
          }
        }
        ctx.putImageData(img, 0, 0);
      },
    },
    {
      id: 'moss',
      name: 'Cushion moss',
      normalStrength: 1.2,
      // Clumpy multi-octave noise with dark crevices and bright frond tips.
      draw(ctx, size, rand) {
        const img = ctx.createImageData(size, size);
        const oct = [tileNoise(5, rand), tileNoise(10, rand), tileNoise(20, rand), tileNoise(40, rand), tileNoise(96, rand)];
        const wts = [0.34, 0.26, 0.18, 0.12, 0.1];
        for (let y = 0; y < size; y++) {
          const v = y / size;
          for (let x = 0; x < size; x++) {
            const u = x / size;
            let f = 0;
            for (let k = 0; k < 5; k++) f += oct[k](u, v) * wts[k];
            const clump = smooth(0.3, 0.72, f);
            const fine = oct[4](u, v);
            const tip = smooth(0.72, 0.9, fine * 0.65 + oct[3](u, v) * 0.35);
            const val = clamp(0.48 + 0.36 * clump + 0.12 * fine + 0.12 * tip - 0.12 * (1 - smooth(0.18, 0.4, f)), 0, 1);
            const i = (y * size + x) * 4;
            img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(val * 255);
            img.data[i + 3] = 255;
          }
        }
        ctx.putImageData(img, 0, 0);
      },
    },
    {
      id: 'macrame-cord',
      name: 'Twisted macramé cord',
      normalStrength: 1.0,
      // Three twisted plies (helical bands) with fine fibres running along each ply.
      draw(ctx, size, rand) {
        const img = ctx.createImageData(size, size);
        const n1 = tileNoise(16, rand);
        const n2 = tileNoise(64, rand);
        for (let y = 0; y < size; y++) {
          const v = y / size;
          for (let x = 0; x < size; x++) {
            const u = x / size;
            const ph = u * 3 + v * 4 + (n1(u, v) - 0.5) * 0.08;
            const f = ph - Math.floor(ph);
            const bump = Math.sqrt(Math.max(0, 1 - (2 * f - 1) ** 2));
            const fibre = 0.5 + 0.5 * Math.cos(TAU * (u * 21 + v * 28 + n2(u, v) * 0.6));
            const val = clamp(0.52 + 0.42 * bump - 0.07 * fibre * bump + 0.07 * (n2(u, v) - 0.5), 0, 1);
            const i = (y * size + x) * 4;
            img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(val * 255);
            img.data[i + 3] = 255;
          }
        }
        ctx.putImageData(img, 0, 0);
      },
    },
    {
      id: 'petal-wash',
      name: 'Watercolour petal wash',
      normalStrength: 0.15,
      colored: true,
      // Soft watercolour: pale paper-white with rosy-violet pigment pools (darker at their dried
      // edges) that deepen towards the petal base (bottom of the tile), plus fine petal streaks.
      draw(ctx, size, rand) {
        const img = ctx.createImageData(size, size);
        const n1 = tileNoise(3, rand);
        const n2 = tileNoise(7, rand);
        const n3 = tileNoise(18, rand);
        const n4 = tileNoise(64, rand);
        for (let y = 0; y < size; y++) {
          const v = y / size;
          const g = 0.5 - 0.5 * Math.cos(TAU * Math.pow(v, 2.2));
          for (let x = 0; x < size; x++) {
            const u = x / size;
            const f = n1(u, v) * 0.55 + n2(u, v) * 0.3 + n3(u, v) * 0.15;
            const pool = smooth(0.45, 0.68, f);
            const edge = Math.exp(-(((f - 0.56) / 0.022) ** 2));
            const streak = 0.5 + 0.5 * Math.cos(TAU * (u * 22 + n2(u, v) * 1.5));
            const a = clamp(0.4 * g + 0.2 * pool + 0.18 * edge, 0, 0.85);
            const lum = 1 - 0.05 * streak * (0.4 + g) - 0.04 * n4(u, v);
            const i = (y * size + x) * 4;
            img.data[i] = Math.round(clamp(lum * (1 - a * 0.14), 0, 1) * 255);
            img.data[i + 1] = Math.round(clamp(lum * (1 - a * 0.36), 0, 1) * 255);
            img.data[i + 2] = Math.round(clamp(lum * (1 - a * 0.22), 0, 1) * 255);
            img.data[i + 3] = 255;
          }
        }
        ctx.putImageData(img, 0, 0);
      },
    },
  ],
  materials: [
    // Greens (leaf veins are tiled one leaf per tile on sphere leaves, or offset on flat outlines).
    { id: 'leaf-fern', name: 'Fern green', color: '#5b8f3a', roughness: 0.7, pattern: { id: 'leaf-veins', scale: 0.05, contrast: 0.5 } },
    { id: 'leaf-bright', name: 'Fresh leaf green', color: '#5f9a3a', roughness: 0.62, pattern: { id: 'leaf-veins', scale: SPHERE_TILE, contrast: 0.85 } },
    { id: 'leaf-deep', name: 'Deep leaf green', color: '#2f5a2f', roughness: 0.55, pattern: { id: 'leaf-veins', scale: SPHERE_TILE, contrast: 0.85 } },
    { id: 'leaf-ivy', name: 'Ivy green', color: '#2d5430', roughness: 0.45, pattern: { id: 'leaf-veins', scale: IVY_TILE, contrast: 1 } },
    { id: 'leaf-waxy', name: 'Waxy hoya green', color: '#3b6a34', roughness: 0.28, pattern: { id: 'leaf-veins', scale: SPHERE_TILE, contrast: 0.45 } },
    { id: 'leaf-spider', name: 'Variegated spider green', color: '#7cae4a', roughness: 0.6, pattern: { id: 'leaf-veins', scale: SPIDER_TILE, contrast: 1 } },
    { id: 'leaf-staghorn', name: 'Staghorn green', color: '#5d8a46', roughness: 0.75, pattern: { id: 'leaf-veins', scale: STAG_TILE, contrast: 0.9 } },
    { id: 'shield-frond', name: 'Shield frond tan', color: '#a08a58', roughness: 0.85, pattern: { id: 'leaf-veins', scale: SPHERE_TILE, contrast: 0.7 } },
    { id: 'leaf-silver', name: 'Eucalyptus silver', color: '#8fa89d', roughness: 0.85, pattern: { id: 'leaf-veins', scale: SPHERE_TILE, contrast: 0.4 } },
    { id: 'leaf-tulip', name: 'Blue-green leaf', color: '#5a8a55', roughness: 0.5, pattern: { id: 'leaf-veins', scale: STRAP_TILE, contrast: 0.5 } },
    { id: 'leaf-fittonia', name: 'Nerve plant', color: '#3a6d3e', roughness: 0.6, pattern: { id: 'leaf-veins', scale: SPHERE_TILE, contrast: 1 } },
    { id: 'succulent', name: 'Succulent green', color: '#7fa55e', roughness: 0.42 },
    { id: 'air-plant', name: 'Air plant silver', color: '#a9b99b', roughness: 0.9, pattern: { id: 'leaf-veins', scale: SPHERE_TILE, contrast: 0.3 } },
    { id: 'moss', name: 'Cushion moss', color: '#5b7d2a', roughness: 1, pattern: { id: 'moss', scale: 0.15 } },
    { id: 'moss-deep', name: 'Mood moss', color: '#3e5d24', roughness: 1, pattern: { id: 'moss', scale: 0.1 } },
    { id: 'moss-reindeer', name: 'Reindeer moss', color: '#c2cf98', roughness: 1, pattern: { id: 'moss', scale: 0.06, contrast: 0.8 } },
    // Flowers (watercolour wash: pale tips, a deeper blush at the petal base).
    { id: 'petal-white', name: 'White petals', color: '#f7f4ef', roughness: 0.6, pattern: { id: 'petal-wash', scale: SPHERE_TILE, contrast: 0.55 } },
    { id: 'petal-pink', name: 'Pink petals', color: '#ee97b0', roughness: 0.55, pattern: { id: 'petal-wash', scale: SPHERE_TILE, contrast: 0.8 } },
    { id: 'petal-red', name: 'Red petals', color: '#c2202e', roughness: 0.5, pattern: { id: 'petal-wash', scale: SPHERE_TILE, contrast: 0.8 } },
    { id: 'petal-yellow', name: 'Yellow petals', color: '#f5cf3a', roughness: 0.55, pattern: { id: 'petal-wash', scale: SPHERE_TILE, contrast: 0.6 } },
    { id: 'petal-purple', name: 'Purple petals', color: '#7e55b2', roughness: 0.55, pattern: { id: 'petal-wash', scale: SPHERE_TILE, contrast: 0.8 } },
    { id: 'petal-sunflower', name: 'Sunflower yellow', color: '#f4b214', roughness: 0.6, pattern: { id: 'petal-wash', scale: SPHERE_TILE, contrast: 0.7 } },
    { id: 'petal-blue', name: 'Hydrangea blue', color: '#8ea3dd', roughness: 0.6, pattern: { id: 'petal-wash', scale: 0.12, contrast: 0.9 } },
    { id: 'petal-sakura', name: 'Sakura pink', color: '#f7cad6', roughness: 0.6, pattern: { id: 'petal-wash', scale: SPHERE_TILE, contrast: 0.7 } },
    { id: 'petal-hoya', name: 'Hoya blush', color: '#f2d5dd', roughness: 0.35, pattern: { id: 'petal-wash', scale: 0.08, contrast: 0.8 } },
    { id: 'petal-lily', name: 'Lily white', color: '#fbf4f1', roughness: 0.5, pattern: { id: 'petal-wash', scale: LILY_TILE, contrast: 0.8 } },
    { id: 'sunflower-centre', name: 'Sunflower seed head', color: '#4a2c14', roughness: 0.95, pattern: { id: 'moss', scale: 0.04 } },
    { id: 'pollen', name: 'Lily pollen', color: '#a4461b', roughness: 0.9 },
    // Vessels, cords and hard materials.
    { id: 'glass-vase', name: 'Clear vase glass', category: 'glass', color: '#e2f0ed', roughness: 0.04, opacity: 0.26 },
    { id: 'glass-green', name: 'Green bottle glass', category: 'glass', color: '#9cc6a4', roughness: 0.05, opacity: 0.38 },
    { id: 'stoneware', name: 'Speckled stoneware', color: '#e9e2d6', roughness: 0.7, pattern: { id: 'granite', scale: 0.2, contrast: 0.5 } },
    { id: 'glaze-ink', name: 'Ink-glaze ceramic', color: '#2b3236', roughness: 0.25, pattern: { id: 'granite', scale: 0.2, contrast: 0.3 } },
    { id: 'enamel-blue', name: 'Blue enamel', category: 'metal', color: '#3c5f9e', roughness: 0.25, metalness: 0.1 },
    { id: 'coco-liner', name: 'Coco coir liner', category: 'fabric', color: '#6d4a2c', roughness: 1, pattern: { id: 'jute', scale: 0.1 } },
    { id: 'macrame-cotton', name: 'Macramé cotton', category: 'fabric', color: '#efe6d3', roughness: 0.95, pattern: { id: 'macrame-cord', scale: 0.03 } },
    { id: 'jute-twine', name: 'Jute twine', category: 'fabric', color: '#b38f5c', roughness: 0.95, pattern: { id: 'macrame-cord', scale: 0.02 } },
    { id: 'mount-wood', name: 'Walnut plaque', category: 'wood', color: '#6e4a30', roughness: 0.55, pattern: { id: 'wood-grain', scale: 0.6 } },
    { id: 'oak-frame', name: 'Oak frame', category: 'wood', color: '#b48a5a', roughness: 0.55, pattern: { id: 'wood-grain', scale: 0.6 } },
    { id: 'window-box-paint', name: 'Sage painted wood', category: 'wood', color: '#7d9a86', roughness: 0.6, pattern: { id: 'wood-grain', scale: 0.8, contrast: 0.4 } },
    { id: 'felt-pocket', name: 'Planting felt', category: 'fabric', color: '#3d3f3c', roughness: 1, pattern: { id: 'weave', scale: 0.08 } },
    { id: 'bark', name: 'Cherry bark', category: 'wood', color: '#4a3426', roughness: 0.85, pattern: { id: 'wood-grain', scale: 0.15 } },
    { id: 'dried-stem', name: 'Dried stem', color: '#b59a6c', roughness: 0.9, pattern: { id: 'wood-grain', scale: 0.2, contrast: 0.5 } },
    { id: 'euc-stem', name: 'Eucalyptus stem', color: '#7b5d4c', roughness: 0.7 },
    { id: 'pampas-plume', name: 'Pampas plume', category: 'fabric', color: '#e6d6b8', roughness: 1, pattern: { id: 'boucle', scale: 0.08 } },
    { id: 'bulb-skin', name: 'Bulb & roots', color: '#dcc7a2', roughness: 0.8 },
    { id: 'terrarium-sand', name: 'Terrarium sand', category: 'stone', color: '#cdb894', roughness: 1, pattern: { id: 'granite', scale: 0.08 } },
    { id: 'gravel', name: 'Pebble gravel', category: 'stone', color: '#9d968a', roughness: 0.95, pattern: { id: 'terrazzo', scale: 0.1 } },
    { id: 'satin-ribbon', name: 'Blush satin ribbon', category: 'fabric', color: '#e8b9b0', roughness: 0.35 },
  ],
});

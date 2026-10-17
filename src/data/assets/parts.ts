/**
 * Small, dependency-free helpers for authoring procedural assets.
 *
 * All helpers return plain `Part` / `PlanStroke` data (no three.js). Coordinates follow the
 * contract in ./types.ts: origin at the footprint centre on the base, x = width, y = up,
 * z = depth with +z the FRONT and -z the back (against the wall).
 */
import type { AssetCategory, AssetDefinition, AssetType, MaterialSlot, Part, PlanStroke, Size3 } from './types';

export type V2 = [number, number];
export type V3 = [number, number, number];

/** Source/licence shared by every built-in procedural asset. */
export const PROCEDURAL_SOURCE = {
  name: 'Neest procedural library',
  license: 'Original (procedural, CC0-compatible)',
} as const;

/** Smallest dimension a helper will emit (keeps degenerate resizes renderable). */
const MIN_DIM = 0.002;
const dim = (v: number): number => Math.max(MIN_DIM, v);

// ---------------------------------------------------------------------------
// Math utilities
// ---------------------------------------------------------------------------

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** [0, 1, …, n-1] */
export const range = (n: number): number[] => Array.from({ length: Math.max(0, Math.floor(n)) }, (_, i) => i);

/** Centres of `n` equal cells dividing the interval [a, b]. */
export const cells = (n: number, a: number, b: number): number[] =>
  range(n).map((i) => a + ((i + 0.5) * (b - a)) / n);

/** Boundaries of `n` equal cells dividing [a, b] as [start, end] pairs. */
export const cellSpans = (n: number, a: number, b: number): V2[] =>
  range(n).map((i) => [a + (i * (b - a)) / n, a + ((i + 1) * (b - a)) / n]);

/** `n` points evenly spaced from a to b inclusive (midpoint when n = 1). */
export const spaced = (n: number, a: number, b: number): number[] =>
  n <= 1 ? [(a + b) / 2] : range(n).map((i) => a + (i * (b - a)) / (n - 1));

// ---------------------------------------------------------------------------
// Part builders
// ---------------------------------------------------------------------------

export interface PartOpts {
  rotation?: V3;
  scale?: V3;
  /** false = hide from the derived 2D plan footprint. */
  plan?: boolean;
}

export interface BoxOpts extends PartOpts {
  /** Edge rounding radius (clamped to < half the smallest side). */
  bevel?: number;
}

export interface CylOpts extends PartOpts {
  /** Top radius (defaults to the bottom radius → straight cylinder). */
  rTop?: number;
  segments?: number;
}

function finish(part: Part, opts: PartOpts | undefined): Part {
  const r = opts?.rotation;
  if (r && (r[0] !== 0 || r[1] !== 0 || r[2] !== 0)) part.rotation = [r[0], r[1], r[2]];
  const s = opts?.scale;
  if (s && (s[0] !== 1 || s[1] !== 1 || s[2] !== 1)) part.scale = [s[0], s[1], s[2]];
  if (opts?.plan === false) part.plan = false;
  return part;
}

/** Box centred at `c` with full size `s` = [x, y, z]. */
export function box(slot: string, c: V3, s: V3, opts?: BoxOpts): Part {
  const size: V3 = [dim(s[0]), dim(s[1]), dim(s[2])];
  const position: V3 = [c[0], c[1], c[2]];
  const bevel = Math.min(opts?.bevel ?? 0, 0.45 * Math.min(size[0], size[1], size[2]));
  const part: Part =
    bevel >= 0.001 ? { shape: 'box', size, bevel, position, slot } : { shape: 'box', size, position, slot };
  return finish(part, opts);
}

/** Box spanning the ranges x = [x0, x1], y = [y0, y1], z = [z0, z1]. */
export function span(slot: string, x: V2, y: V2, z: V2, opts?: BoxOpts): Part {
  return box(
    slot,
    [(x[0] + x[1]) / 2, (y[0] + y[1]) / 2, (z[0] + z[1]) / 2],
    [x[1] - x[0], y[1] - y[0], z[1] - z[0]],
    opts,
  );
}

/** Vertical cylinder (or cone with `rTop`) centred at `c`, bottom radius `r`, height `h`. */
export function cyl(slot: string, c: V3, r: number, h: number, opts?: CylOpts): Part {
  const base = {
    shape: 'cylinder' as const,
    radiusTop: dim(opts?.rTop ?? r),
    radiusBottom: dim(r),
    height: dim(h),
    position: [c[0], c[1], c[2]] as V3,
    slot,
  };
  const part: Part = opts?.segments ? { ...base, segments: opts.segments } : base;
  return finish(part, opts);
}

/** Vertical cylinder at (x, z) running from y0 to y1. */
export function vcyl(
  slot: string,
  x: number,
  z: number,
  y0: number,
  y1: number,
  r: number,
  opts?: CylOpts,
): Part {
  return cyl(slot, [x, (y0 + y1) / 2, z], r, y1 - y0, opts);
}

/** Cylinder rod between two arbitrary points (rotation computed for you). */
export function rod(slot: string, a: V3, b: V3, r: number, opts?: CylOpts): Part {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz) || MIN_DIM;
  const ux = dx / len;
  const uy = dy / len;
  const uz = dz / len;
  // Euler XYZ (three.js): R = Rx·Ry·Rz. Rz tips +Y towards ±X, then Rx swings it into Z.
  const rx = Math.atan2(uz, uy);
  const rz = Math.atan2(-ux, Math.hypot(uy, uz));
  return cyl(slot, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], r, len, {
    ...opts,
    rotation: [rx, 0, rz],
  });
}

/** Horizontal rod along X from x0 to x1 at height y, depth z. */
export const rodX = (
  slot: string,
  x0: number,
  x1: number,
  y: number,
  z: number,
  r: number,
  opts?: CylOpts,
): Part => rod(slot, [x0, y, z], [x1, y, z], r, opts);

/** Horizontal rod along Z from z0 to z1 at (x, y). */
export const rodZ = (
  slot: string,
  x: number,
  y: number,
  z0: number,
  z1: number,
  r: number,
  opts?: CylOpts,
): Part => rod(slot, [x, y, z0], [x, y, z1], r, opts);

/** Disc/drum whose axis points along Z (faces the front), centred at `c`. */
export const discZ = (slot: string, c: V3, r: number, depth: number, opts?: CylOpts): Part =>
  cyl(slot, c, r, depth, { ...opts, rotation: [Math.PI / 2, 0, 0] });

export function sphere(slot: string, c: V3, r: number, opts?: PartOpts): Part {
  return finish({ shape: 'sphere', radius: dim(r), position: [c[0], c[1], c[2]], slot }, opts);
}

/** Torus standing upright in the XY plane (its hole faces ±Z, i.e. the front). */
export function torus(
  slot: string,
  c: V3,
  radius: number,
  tube: number,
  opts?: PartOpts & { arc?: number },
): Part {
  const base = {
    shape: 'torus' as const,
    radius: dim(radius),
    tube: dim(tube),
    position: [c[0], c[1], c[2]] as V3,
    slot,
  };
  const part: Part = opts?.arc !== undefined ? { ...base, arc: opts.arc } : base;
  return finish(part, opts);
}

/** Torus laid flat (horizontal ring). `zScale` stretches it into an ellipse along Z. */
export function ring(
  slot: string,
  c: V3,
  radius: number,
  tube: number,
  opts?: { zScale?: number; plan?: boolean },
): Part {
  const zs = opts?.zScale ?? 1;
  return torus(slot, c, radius, tube, {
    rotation: [Math.PI / 2, 0, 0],
    // After the X rotation, local Y maps onto world Z.
    scale: [1, zs, 1],
    plan: opts?.plan,
  });
}

export interface LatheOpts extends PartOpts {
  segments?: number;
}

/**
 * Surface of revolution. `profile` is [radius, y] from bottom to top with y measured from
 * `base[1]`. The profile is re-centred on its mid-height and the part positioned there, so the
 * placement is identical whether a renderer treats the position as the profile origin or as the
 * geometry centre.
 */
export function lathe(slot: string, base: V3, profile: V2[], opts?: LatheOpts): Part {
  const ys = profile.map((p) => p[1]);
  const mid = (Math.min(...ys) + Math.max(...ys)) / 2;
  const prof: V2[] = profile.map(([r, y]) => [Math.max(0, r), y - mid]);
  const b = {
    shape: 'lathe' as const,
    profile: prof,
    position: [base[0], base[1] + mid, base[2]] as V3,
    slot,
  };
  const part: Part = opts?.segments ? { ...b, segments: opts.segments } : b;
  return finish(part, opts);
}

/**
 * Vertical prism from an outline given in object-local [x, z] coordinates, extruded from y0 up by
 * `height`. The outline is re-centred on its bounding box (position = outline centre at its base).
 */
export function prism(slot: string, outline: V2[], y0: number, height: number, opts?: PartOpts): Part {
  const xs = outline.map((p) => p[0]);
  const zs = outline.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  return finish(
    {
      shape: 'prism',
      outline: outline.map(([x, z]) => [x - cx, z - cz] as V2),
      height: dim(height),
      position: [cx, y0, cz],
      slot,
    },
    opts,
  );
}

/** Mirror parts front-to-back (z → -z), e.g. to put cabinet fronts on the back face. */
export function mirrorZ(parts: Part[]): Part[] {
  return parts.map((p) => {
    const q: Part = { ...p, position: [p.position[0], p.position[1], -p.position[2]] };
    if (p.rotation) q.rotation = [-p.rotation[0], -p.rotation[1], p.rotation[2]];
    if (q.shape === 'prism') q.outline = q.outline.map(([x, z]) => [x, -z] as V2);
    return q;
  });
}

// ---------------------------------------------------------------------------
// Furniture building blocks
// ---------------------------------------------------------------------------

export interface LegOpts {
  /** Round legs (cylinders) instead of square. */
  round?: boolean;
  /** Bottom radius factor for round legs (< 1 tapers towards the floor). */
  taper?: number;
  /** Plan visibility (defaults to false: legs normally sit under a top). */
  plan?: boolean;
}

/** Four legs of thickness `t`, inset from the corners of a w×d footprint, from y0 to y1. */
export function legs4(
  slot: string,
  w: number,
  d: number,
  inset: number,
  y0: number,
  y1: number,
  t: number,
  opts?: LegOpts,
): Part[] {
  const x = w / 2 - inset - t / 2;
  const z = d / 2 - inset - t / 2;
  const plan = opts?.plan ?? false;
  const corners: V2[] = [
    [-x, -z],
    [x, -z],
    [-x, z],
    [x, z],
  ];
  return corners.map(([px, pz]) =>
    opts?.round
      ? vcyl(slot, px, pz, y0, y1, (t / 2) * (opts.taper ?? 1), { rTop: t / 2, plan })
      : span(slot, [px - t / 2, px + t / 2], [y0, y1], [pz - t / 2, pz + t / 2], { plan }),
  );
}

export interface HandleSpec {
  kind: 'bar-h' | 'bar-v' | 'knob';
  x?: number;
  y?: number;
  len?: number;
}

export interface FrontSpec {
  x: V2;
  y: V2;
  handle?: HandleSpec;
}

/**
 * Door/drawer fronts on a carcass whose front plane is at z = `zFace`. Fronts are `thick` deep;
 * handles protrude a further `handleDepth`. Fronts and handles are hidden from the plan.
 */
export function fronts(
  frontSlot: string,
  handleSlot: string,
  specs: FrontSpec[],
  zFace: number,
  thick: number,
  handleDepth: number,
  gap = 0.003,
): Part[] {
  const parts: Part[] = [];
  const zf = zFace + thick;
  for (const f of specs) {
    const [x0, x1] = f.x;
    const [y0, y1] = f.y;
    parts.push(
      span(frontSlot, [x0 + gap / 2, x1 - gap / 2], [y0 + gap / 2, y1 - gap / 2], [zFace, zf], {
        plan: false,
      }),
    );
    const hd = f.handle;
    if (!hd || handleDepth <= 0) continue;
    const hx = hd.x ?? (x0 + x1) / 2;
    const hy = hd.y ?? (y0 + y1) / 2;
    if (hd.kind === 'knob') {
      parts.push(sphere(handleSlot, [hx, hy, zf + handleDepth / 2], handleDepth / 2, { plan: false }));
    } else if (hd.kind === 'bar-h') {
      const len = hd.len ?? Math.min(0.3, (x1 - x0) * 0.5);
      parts.push(
        span(handleSlot, [hx - len / 2, hx + len / 2], [hy - 0.006, hy + 0.006], [zf, zf + handleDepth], {
          plan: false,
        }),
      );
    } else {
      const len = hd.len ?? Math.min(0.3, (y1 - y0) * 0.5);
      parts.push(
        span(handleSlot, [hx - 0.006, hx + 0.006], [hy - len / 2, hy + len / 2], [zf, zf + handleDepth], {
          plan: false,
        }),
      );
    }
  }
  return parts;
}

// ---------------------------------------------------------------------------
// Detail helpers: soft furnishings, joinery, greenery and shelf clutter.
// Objects are merged into one mesh per material slot when rendered, so these
// may emit many small parts (the catalogue test allows up to MAX_PARTS).
// ---------------------------------------------------------------------------

/** Deterministic pseudo-random generator (mulberry32) in [0, 1) for repeatable variation. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Soft cushion filling the given ranges: a box whose edges are rounded by `softness` × its thinnest side. */
export function cushion(slot: string, x: V2, y: V2, z: V2, opts?: PartOpts & { softness?: number }): Part {
  const m = Math.min(x[1] - x[0], y[1] - y[0], z[1] - z[0]);
  return span(slot, x, y, z, { ...opts, bevel: m * clamp(opts?.softness ?? 0.35, 0, 0.45) });
}

/**
 * Plump throw pillow (squashed ellipsoid) centred at `c`: `w` wide, `h` tall and `t` thick.
 * `lean` tips its top towards the back (radians), `turn` rotates it about the vertical axis.
 * Hidden from the plan by default.
 */
export function pillow(
  slot: string,
  c: V3,
  w: number,
  h: number,
  t: number,
  opts?: { lean?: number; turn?: number; plan?: boolean },
): Part {
  return sphere(slot, c, 0.5, {
    scale: [w, h, t],
    rotation: [-(opts?.lean ?? 0), opts?.turn ?? 0, 0],
    plan: opts?.plan ?? false,
  });
}

/**
 * Tufting buttons on a front-facing surface at depth `z`, in an `nx` × `ny` grid over the x/y
 * ranges. `diamond` offsets alternate rows (chesterfield pattern).
 */
export function tufts(
  slot: string,
  x: V2,
  y: V2,
  z: number,
  nx: number,
  ny: number,
  opts?: { r?: number; diamond?: boolean },
): Part[] {
  const r = opts?.r ?? 0.011;
  const parts: Part[] = [];
  const cw = (x[1] - x[0]) / Math.max(1, nx);
  for (const [j, yy] of cells(ny, y[0], y[1]).entries()) {
    const shift = opts?.diamond && j % 2 === 1 ? cw / 2 : 0;
    for (const xx of cells(nx, x[0], x[1])) {
      const px = xx + shift;
      if (px > x[1]) continue;
      parts.push(sphere(slot, [px, yy, z], r, { scale: [1, 1, 0.55], plan: false }));
    }
  }
  return parts;
}

/** Turned (lathe) leg at (x, z) from y0 to y1 with maximum radius `r`. */
export function turnedLeg(
  slot: string,
  x: number,
  z: number,
  y0: number,
  y1: number,
  r: number,
  opts?: { style?: 'spindle' | 'taper' | 'bun' | 'cabriole'; plan?: boolean },
): Part {
  const h = y1 - y0;
  const P: Record<string, V2[]> = {
    spindle: [
      [0, 0],
      [r * 0.55, 0],
      [r * 0.62, h * 0.05],
      [r * 0.42, h * 0.12],
      [r * 0.85, h * 0.2],
      [r * 0.5, h * 0.3],
      [r * 0.55, h * 0.6],
      [r * 0.78, h * 0.7],
      [r * 0.55, h * 0.78],
      [r, h * 0.84],
      [r, h],
      [0, h],
    ],
    taper: [
      [0, 0],
      [r * 0.45, 0],
      [r * 0.5, h * 0.04],
      [r * 0.82, h * 0.82],
      [r, h * 0.88],
      [r, h],
      [0, h],
    ],
    bun: [
      [0, 0],
      [r * 0.6, 0],
      [r * 0.95, h * 0.3],
      [r, h * 0.55],
      [r * 0.8, h * 0.85],
      [r * 0.55, h],
      [0, h],
    ],
    cabriole: [
      [0, 0],
      [r * 0.7, 0],
      [r * 0.75, h * 0.04],
      [r * 0.4, h * 0.12],
      [r * 0.45, h * 0.45],
      [r * 0.7, h * 0.72],
      [r, h * 0.9],
      [r, h],
      [0, h],
    ],
  };
  return lathe(slot, [x, y0, z], P[opts?.style ?? 'spindle'], { segments: 16, plan: opts?.plan ?? false });
}

/**
 * `n` parallel boards filling a block. `axis` 'x' = vertical boards spread along X (a slatted
 * headboard), 'y' = horizontal boards stacked along Y (a slatted bench seat or louvres),
 * 'z' = boards spread front-to-back. `gap` is the fraction of each cell left open.
 */
export function slats(
  slot: string,
  x: V2,
  y: V2,
  z: V2,
  n: number,
  opts?: { axis?: 'x' | 'y' | 'z'; gap?: number; bevel?: number; plan?: boolean },
): Part[] {
  const axis = opts?.axis ?? 'x';
  const gap = clamp(opts?.gap ?? 0.35, 0, 0.9);
  const k = Math.max(1, Math.round(n));
  const along = axis === 'x' ? x : axis === 'y' ? y : z;
  return cellSpans(k, along[0], along[1]).map(([a, b]) => {
    const pad = ((b - a) * gap) / 2;
    const r: V2 = [a + pad, b - pad];
    const o = { bevel: opts?.bevel, plan: opts?.plan };
    return axis === 'x' ? span(slot, r, y, z, o) : axis === 'y' ? span(slot, x, r, z, o) : span(slot, x, y, r, o);
  });
}

/**
 * Shaker door/drawer front: a frame of stiles and rails around a recessed centre panel. The
 * front's back face is at `zFace`; the frame is `thick` deep and the panel sits `recess` back.
 */
export function shakerFront(
  slot: string,
  x: V2,
  y: V2,
  zFace: number,
  thick: number,
  opts?: { rail?: number; recess?: number; gap?: number },
): Part[] {
  const gap = opts?.gap ?? 0.003;
  const x0 = x[0] + gap / 2;
  const x1 = x[1] - gap / 2;
  const y0 = y[0] + gap / 2;
  const y1 = y[1] - gap / 2;
  const rail = Math.min(opts?.rail ?? 0.06, (x1 - x0) * 0.3, (y1 - y0) * 0.3);
  const recess = Math.min(opts?.recess ?? 0.006, thick * 0.6);
  const zf = zFace + thick;
  const o = { plan: false };
  return [
    span(slot, [x0 + rail, x1 - rail], [y0 + rail, y1 - rail], [zFace, zf - recess], o),
    span(slot, [x0, x0 + rail], [y0, y1], [zFace, zf], o),
    span(slot, [x1 - rail, x1], [y0, y1], [zFace, zf], o),
    span(slot, [x0 + rail, x1 - rail], [y1 - rail, y1], [zFace, zf], o),
    span(slot, [x0 + rail, x1 - rail], [y0, y0 + rail], [zFace, zf], o),
  ];
}

/** Bar pull on a front whose surface is at depth `c[2]`: a rod on two standoffs, centred at c. */
export function barPull(slot: string, c: V3, len: number, opts?: { vertical?: boolean; r?: number; stand?: number }): Part[] {
  const r = opts?.r ?? 0.0055;
  const st = opts?.stand ?? 0.028;
  const [x, y, z] = c;
  const half = len / 2;
  const inset = Math.min(0.015, half * 0.3);
  const a: V3 = opts?.vertical ? [x, y - half, z + st] : [x - half, y, z + st];
  const b: V3 = opts?.vertical ? [x, y + half, z + st] : [x + half, y, z + st];
  const ea: V3 = opts?.vertical ? [x, y - half + inset, z] : [x - half + inset, y, z];
  const eb: V3 = opts?.vertical ? [x, y + half - inset, z] : [x + half - inset, y, z];
  return [
    rod(slot, a, b, r, { plan: false }),
    rod(slot, ea, [ea[0], ea[1], z + st], r * 0.8, { plan: false }),
    rod(slot, eb, [eb[0], eb[1], z + st], r * 0.8, { plan: false }),
  ];
}

/** Round knob on a front whose surface is at depth `c[2]`. */
export function knob(slot: string, c: V3, r = 0.014): Part[] {
  const [x, y, z] = c;
  return [
    rod(slot, [x, y, z], [x, y, z + r * 1.1], r * 0.35, { plan: false }),
    sphere(slot, [x, y, z + r * 1.6], r, { scale: [1, 1, 0.7], plan: false }),
  ];
}

/** Four-bar frame (picture, mirror, window) around an opening in the XY plane, over depth range z. */
export function frame4(slot: string, x: V2, y: V2, z: V2, t: number, opts?: PartOpts): Part[] {
  const o = { plan: opts?.plan ?? false };
  return [
    span(slot, [x[0], x[1]], [y[1] - t, y[1]], z, o),
    span(slot, [x[0], x[1]], [y[0], y[0] + t], z, o),
    span(slot, [x[0], x[0] + t], [y[0] + t, y[1] - t], z, o),
    span(slot, [x[1] - t, x[1]], [y[0] + t, y[1] - t], z, o),
  ];
}

/**
 * Books standing on a shelf: a row along X over `x`, spines facing +z, backs at `zBack`, base at
 * `y0`. Heights vary up to `maxH`, depths up to `maxD`. `fill` (0–1) leaves the rest of the shelf
 * empty; `accentSlot` colours every few books differently. Deterministic for a given `seed`.
 */
export function bookRow(
  slot: string,
  x: V2,
  y0: number,
  zBack: number,
  maxH: number,
  maxD: number,
  seed: number,
  opts?: { fill?: number; accentSlot?: string; lean?: boolean; minW?: number; maxW?: number },
): Part[] {
  const rand = rng(seed);
  const parts: Part[] = [];
  const end = x[0] + (x[1] - x[0]) * clamp(opts?.fill ?? 1, 0, 1);
  const minW = opts?.minW ?? 0.022;
  const maxW = opts?.maxW ?? 0.05;
  let cx = x[0] + 0.004;
  let i = 0;
  while (parts.length < 60) {
    const bw = lerp(minW, maxW, rand());
    if (cx + bw > end - 0.002) break;
    const bh = maxH * lerp(0.68, 1, rand());
    const bd = maxD * lerp(0.78, 1, rand());
    const s = opts?.accentSlot && i % 4 === 2 ? opts.accentSlot : slot;
    parts.push(span(s, [cx, cx + bw], [y0, y0 + bh], [zBack, zBack + bd], { plan: false }));
    cx += bw + (rand() < 0.08 ? 0.03 : 0.0015);
    i++;
  }
  // A last book leaning against the row (keeps within the row's x range).
  if (opts?.lean && cx + 0.03 < end) {
    const bh = maxH * 0.8;
    const tilt = 0.32;
    const bw = 0.03;
    const reach = Math.sin(tilt) * bh;
    if (cx + reach + bw < end) {
      parts.push(
        box(slot, [cx + reach / 2 + bw / 2, y0 + (Math.cos(tilt) * bh) / 2, zBack + maxD / 2], [bw, bh, maxD * 0.85], {
          rotation: [0, 0, -tilt],
          plan: false,
        }),
      );
    }
  }
  return parts;
}

/**
 * A single leaf: flattened ellipsoid `len` long and `wid` wide that starts at `base` and points at
 * azimuth `az` (radians, 0 = +x, π/2 = +z), tilted `tilt` from vertical.
 */
export function leaf(slot: string, base: V3, len: number, wid: number, az: number, tilt: number, opts?: { thick?: number; plan?: boolean }): Part {
  const ux = Math.sin(tilt) * Math.cos(az);
  const uy = Math.cos(tilt);
  const uz = Math.sin(tilt) * Math.sin(az);
  const rx = Math.atan2(uz, uy);
  const rz = Math.atan2(-ux, Math.hypot(uy, uz));
  return sphere(slot, [base[0] + (ux * len) / 2, base[1] + (uy * len) / 2, base[2] + (uz * len) / 2], 0.5, {
    scale: [wid, len, opts?.thick ?? Math.max(0.004, wid * 0.12)],
    rotation: [rx, 0, rz],
    plan: opts?.plan ?? false,
  });
}

/**
 * Foliage clump: `n` leaves radiating from `base`, staying within `radius` horizontally and
 * `height` vertically. `spread` (0–1) controls how far leaves lean out from vertical.
 */
export function foliage(
  slot: string,
  base: V3,
  radius: number,
  height: number,
  n: number,
  seed: number,
  opts?: { leafWid?: number; spread?: number; plan?: boolean },
): Part[] {
  const rand = rng(seed);
  const parts: Part[] = [];
  const wid = opts?.leafWid ?? Math.min(0.12, radius * 0.45);
  const spread = clamp(opts?.spread ?? 0.6, 0.05, 1);
  for (let i = 0; i < n; i++) {
    const az = (i / n) * Math.PI * 2 + rand() * 0.8;
    const tilt = lerp(0.12, 1.25, spread * (0.35 + 0.65 * rand()));
    // Keep the whole (conservatively boxed) leaf inside the clump's cylinder.
    const maxByR = Math.max(0.02, (radius - wid * 0.6) / Math.max(0.05, Math.sin(tilt)));
    const maxByH = Math.max(0.02, (height - wid * 0.6) / Math.max(0.05, Math.cos(tilt)));
    const len = Math.min(maxByR, maxByH) * lerp(0.7, 0.92, rand());
    parts.push(leaf(slot, base, len, wid * lerp(0.75, 1.1, rand()), az, tilt, { plan: opts?.plan }));
  }
  return parts;
}

/** Cluster of `n` spheres (shrub, topiary, cloud of blossom) inside a ball of radius `r` around `c`. */
export function blobCluster(slot: string, c: V3, r: number, n: number, seed: number, opts?: { plan?: boolean }): Part[] {
  const rand = rng(seed);
  const parts: Part[] = [];
  for (let i = 0; i < n; i++) {
    const br = r * lerp(0.35, 0.55, rand());
    const reach = r - br;
    const th = rand() * Math.PI * 2;
    const ph = Math.acos(lerp(-0.6, 1, rand()));
    const d = reach * Math.sqrt(rand());
    parts.push(
      sphere(slot, [c[0] + Math.sin(ph) * Math.cos(th) * d, c[1] + Math.cos(ph) * d, c[2] + Math.sin(ph) * Math.sin(th) * d], br, {
        plan: opts?.plan ?? false,
      }),
    );
  }
  return parts;
}

/** Planter pot (closed lathe) standing at `base` with top radius `r` and height `h`. */
export function pot(slot: string, base: V3, r: number, h: number, style: 'taper' | 'cylinder' | 'bowl' | 'urn' | 'belly' = 'taper', opts?: { plan?: boolean }): Part {
  const P: Record<string, V2[]> = {
    taper: [
      [0, 0],
      [r * 0.72, 0],
      [r * 0.95, h * 0.92],
      [r, h * 0.92],
      [r, h],
      [r * 0.9, h],
      [r * 0.88, h * 0.95],
    ],
    cylinder: [
      [0, 0],
      [r * 0.96, 0],
      [r, h * 0.03],
      [r, h],
      [r * 0.92, h],
      [r * 0.92, h * 0.96],
    ],
    bowl: [
      [0, 0],
      [r * 0.5, 0],
      [r * 0.85, h * 0.35],
      [r, h * 0.85],
      [r, h],
      [r * 0.9, h],
    ],
    urn: [
      [0, 0],
      [r * 0.55, 0],
      [r * 0.5, h * 0.12],
      [r * 0.8, h * 0.3],
      [r * 0.95, h * 0.65],
      [r * 0.85, h * 0.9],
      [r, h],
      [r * 0.88, h],
    ],
    belly: [
      [0, 0],
      [r * 0.6, 0],
      [r, h * 0.45],
      [r * 0.9, h * 0.8],
      [r * 0.7, h],
      [r * 0.6, h],
    ],
  };
  return lathe(slot, base, P[style], { segments: 28, plan: opts?.plan });
}

/** Rods joining consecutive points (bent tube frames, hairpin legs, wire baskets). */
export function rodPath(slot: string, pts: V3[], r: number, opts?: CylOpts): Part[] {
  const parts: Part[] = [];
  for (let i = 1; i < pts.length; i++) parts.push(rod(slot, pts[i - 1], pts[i], r, { plan: false, ...opts }));
  return parts;
}

/** Points on a circular arc in the X/Z plane (for prism outlines). Angles in radians, 0 = +x. */
export function arcPoints(cx: number, cz: number, r: number, a0: number, a1: number, n = 12): V2[] {
  return range(n + 1).map((i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return [cx + Math.cos(a) * r, cz + Math.sin(a) * r] as V2;
  });
}

/**
 * Curtain or drape folds: `n` soft vertical half-tubes across `x`, hanging from y1 down to y0,
 * centred on depth `z` with fold depth `depth`.
 */
export function drapeFolds(slot: string, x: V2, y: V2, z: number, n: number, depth: number, opts?: { plan?: boolean }): Part[] {
  const k = Math.max(1, Math.round(n));
  const cw = (x[1] - x[0]) / k;
  return cells(k, x[0], x[1]).map((cx) =>
    cyl(slot, [cx, (y[0] + y[1]) / 2, z], cw * 0.55, y[1] - y[0], {
      scale: [1, 1, depth / (cw * 1.1)],
      segments: 12,
      plan: opts?.plan,
    }),
  );
}

// ---------------------------------------------------------------------------
// Plan strokes
// ---------------------------------------------------------------------------

export const line = (a: V2, b: V2): PlanStroke => ({ kind: 'line', a: [a[0], a[1]], b: [b[0], b[1]] });

export const circle = (c: V2, r: number): PlanStroke => ({ kind: 'circle', c: [c[0], c[1]], r });

export const poly = (points: V2[], closed = true): PlanStroke => ({ kind: 'poly', points, closed });

export const rectPoly = (x0: number, z0: number, x1: number, z1: number): PlanStroke =>
  poly([
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ]);

export function ellipsePoints(cx: number, cz: number, rx: number, rz: number, n = 32): V2[] {
  return range(n).map((i) => {
    const a = (i / n) * Math.PI * 2;
    return [cx + Math.cos(a) * rx, cz + Math.sin(a) * rz] as V2;
  });
}

export function roundRectPoints(cx: number, cz: number, w: number, d: number, r: number, seg = 4): V2[] {
  const rr = Math.max(0, Math.min(r, w / 2, d / 2));
  const hx = w / 2 - rr;
  const hz = d / 2 - rr;
  const corners: [number, number, number][] = [
    [cx + hx, cz + hz, 0],
    [cx - hx, cz + hz, Math.PI / 2],
    [cx - hx, cz - hz, Math.PI],
    [cx + hx, cz - hz, (3 * Math.PI) / 2],
  ];
  const pts: V2[] = [];
  for (const [px, pz, a0] of corners) {
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (i / seg) * (Math.PI / 2);
      pts.push([px + Math.cos(a) * rr, pz + Math.sin(a) * rr]);
    }
  }
  return pts;
}

// ---------------------------------------------------------------------------
// Asset definition
// ---------------------------------------------------------------------------

export const matSlot = (id: string, label: string, defaultMaterial: string): MaterialSlot => ({
  id,
  label,
  defaultMaterial,
});

export interface AssetSpec {
  id: string;
  name: string;
  category: AssetCategory;
  /** What it is (shop by type). */
  type: AssetType;
  /** Shelf within the listing; prefer a name from ASSET_GROUPS in ./catalog. */
  group: string;
  tags: string[];
  defaultSize: Size3;
  minSize?: Size3;
  maxSize?: Size3;
  /** Defaults to fully resizable. */
  resizable?: Partial<AssetDefinition['resizable']>;
  /** Defaults to 'floor'. */
  mount?: AssetDefinition['mount'];
  /** Defaults to 0. */
  defaultElevation?: number;
  /** Defaults to true for wall-mounted assets, otherwise false. */
  wallSnap?: boolean;
  slots: MaterialSlot[];
  build: (size: Size3) => Part[];
  planDetail?: (size: Size3) => PlanStroke[];
  light?: AssetDefinition['light'];
}

export function defineAsset(spec: AssetSpec): AssetDefinition {
  const { resizable, mount, defaultElevation, wallSnap, ...rest } = spec;
  const m = mount ?? 'floor';
  return {
    ...rest,
    resizable: { w: true, d: true, h: true, ...resizable },
    mount: m,
    defaultElevation: defaultElevation ?? 0,
    wallSnap: wallSnap ?? m === 'wall',
    source: { ...PROCEDURAL_SOURCE },
  };
}

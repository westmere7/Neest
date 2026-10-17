/**
 * Small, dependency-free helpers for authoring procedural assets.
 *
 * All helpers return plain `Part` / `PlanStroke` data (no three.js). Coordinates follow the
 * contract in ./types.ts: origin at the footprint centre on the base, x = width, y = up,
 * z = depth with +z the FRONT and -z the back (against the wall).
 */
import type { AssetCategory, AssetDefinition, MaterialSlot, Part, PlanStroke, Size3 } from './types';

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

/**
 * Shelves & shelving — styled shelves for every room.
 *
 * Every shelf comes dressed: rows of books, potted and trailing plants, ceramics, baskets, framed
 * prints, towels, binders and storage tubs, laid out with a seeded random generator so each shelf
 * looks lived-in. Content and shelf counts scale with the item's size, and the whole layout stays
 * within the part budget at every size.
 *
 * Pack patterns: oak veneer grain, powder-coat stipple, woven basket and pegboard holes.
 */
import {
  PLANT_SPECIES,
  bookRow,
  box,
  clamp,
  cushion,
  cyl,
  defineItem,
  definePack,
  discZ,
  foliage,
  frame4,
  lathe,
  leaf,
  lerp,
  line,
  circle,
  matSlot,
  poly,
  pot,
  range,
  rectPoly,
  ring,
  rng,
  rod,
  rodPath,
  rodX,
  rodZ,
  slats,
  spaced,
  span,
  sphere,
  torus,
  vcyl,
  type PackPattern,
  type Part,
  type PlanStroke,
  type V2,
  type V3,
} from '@/packs/kit';

/** Target part count per item (the checks allow 160; the brief asks for at most 150). */
const MAXP = 146;
const NP = { plan: false } as const;

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

type M3 = [V3, V3, V3];

/** Euler XYZ (three.js order, R = Rx·Ry·Rz) → rotation matrix. */
function eulerToMat([a, b, c]: V3): M3 {
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const cb = Math.cos(b);
  const sb = Math.sin(b);
  const cc = Math.cos(c);
  const sc = Math.sin(c);
  return [
    [cb * cc, -cb * sc, sb],
    [ca * sc + sa * sb * cc, ca * cc - sa * sb * sc, -sa * cb],
    [sa * sc - ca * sb * cc, sa * cc + ca * sb * sc, ca * cb],
  ];
}

function matToEuler(m: M3): V3 {
  const m13 = clamp(m[0][2], -1, 1);
  const y = Math.asin(m13);
  if (Math.abs(m13) < 0.9999999) return [Math.atan2(-m[1][2], m[2][2]), y, Math.atan2(-m[0][1], m[0][0])];
  return [Math.atan2(m[2][1], m[1][1]), y, 0];
}

function mul(a: M3, b: M3): M3 {
  const r = (i: number): V3 => [0, 1, 2].map((j) => a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j]) as V3;
  return [r(0), r(1), r(2)];
}

/** Rotate whole parts (position and orientation) about the vertical axis through the origin. */
function turnY(parts: Part[], ang: number): Part[] {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const ry: M3 = [
    [c, 0, s],
    [0, 1, 0],
    [-s, 0, c],
  ];
  return parts.map((p) => {
    const [x, y, z] = p.position;
    const q: Part = { ...p, position: [c * x + s * z, y, -s * x + c * z] };
    q.rotation = matToEuler(mul(ry, eulerToMat(p.rotation ?? [0, 0, 0])));
    return q;
  });
}

/** A flat shape facing the front (+z): `pts` are [x, y], extruded `t` forward from depth z. */
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

/** A side profile: `pts` are [z, y] in metres, extruded along x from x0 to x1. */
function sideProfile(slot: string, pts: V2[], x0: number, x1: number): Part {
  const zs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const zm = (Math.min(...zs) + Math.max(...zs)) / 2;
  const ym = (Math.min(...ys) + Math.max(...ys)) / 2;
  return {
    shape: 'prism',
    outline: pts.map(([z, y]) => [-(y - ym), z - zm] as V2),
    height: x1 - x0,
    position: [x0, ym, zm],
    rotation: [0, 0, -Math.PI / 2],
    slot,
    plan: false,
  };
}

/** Box tipped back by `a` about the bottom-back edge through `pivot`; `lc` is its local centre. */
function tilted(slot: string, pivot: V3, a: number, lc: V3, size: V3): Part {
  const [lx, ly, lz] = lc;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  return box(slot, [pivot[0] + lx, pivot[1] + ly * ca + lz * sa, pivot[2] - ly * sa + lz * ca], size, {
    rotation: [-a, 0, 0],
    plan: false,
  });
}

/**
 * Picture frame leaning back against a wall: moulding bars plus a recessed print. It stands at
 * y0 between depths zMin (wall) and zMax (front stop).
 */
function leanFrame(
  fs: string,
  as: string,
  cx: number,
  y0: number,
  zMin: number,
  zMax: number,
  fw: number,
  fh: number,
  fd: number,
  bar: number,
  aMax = 0.16,
): Part[] {
  const zb = Math.max(zMin, zMax - fd);
  const a = Math.asin(clamp((zb - zMin) / fh, 0, Math.sin(aMax)));
  const pv: V3 = [cx, y0, zb];
  const b = Math.min(bar, fw * 0.25, fh * 0.25);
  return [
    tilted(fs, pv, a, [0, fh - b / 2, fd / 2], [fw, b, fd]),
    tilted(fs, pv, a, [0, b / 2, fd / 2], [fw, b, fd]),
    tilted(fs, pv, a, [-fw / 2 + b / 2, fh / 2, fd / 2], [b, fh - 2 * b, fd]),
    tilted(fs, pv, a, [fw / 2 - b / 2, fh / 2, fd / 2], [b, fh - 2 * b, fd]),
    tilted(as, pv, a, [0, fh / 2, fd * 0.4], [fw - 2 * b + 0.004, fh - 2 * b + 0.004, 0.004]),
  ];
}

type VesselKind = 'bud' | 'bulb' | 'cylinder' | 'amphora' | 'bottle' | 'gourd';
const VESSELS: VesselKind[] = ['bud', 'bulb', 'cylinder', 'amphora', 'bottle', 'gourd'];

/** Vase / bottle / jar of radius r and height h standing at (x, y0, z). */
function vessel(slot: string, x: number, z: number, y0: number, r: number, h: number, kind: VesselKind): Part {
  const P: Record<VesselKind, V2[]> = {
    bud: [[0, 0], [r * 0.75, 0], [r, h * 0.3], [r * 0.85, h * 0.6], [r * 0.3, h * 0.8], [r * 0.34, h], [r * 0.26, h]],
    bulb: [[0, 0], [r * 0.55, 0], [r * 0.95, h * 0.22], [r, h * 0.42], [r * 0.7, h * 0.68], [r * 0.42, h * 0.82], [r * 0.5, h], [r * 0.42, h]],
    cylinder: [[0, 0], [r * 0.95, 0], [r, h * 0.04], [r, h], [r * 0.9, h], [r * 0.9, h * 0.96]],
    amphora: [[0, 0], [r * 0.4, 0], [r * 0.5, h * 0.06], [r, h * 0.45], [r * 0.8, h * 0.72], [r * 0.45, h * 0.86], [r * 0.62, h], [r * 0.52, h]],
    bottle: [[0, 0], [r, 0], [r, h * 0.6], [r * 0.9, h * 0.68], [r * 0.32, h * 0.8], [r * 0.3, h], [0, h]],
    gourd: [[0, 0], [r * 0.6, 0], [r, h * 0.25], [r * 0.8, h * 0.5], [r * 0.45, h * 0.58], [r * 0.6, h * 0.75], [r * 0.3, h * 0.92], [r * 0.25, h], [0, h]],
  };
  return lathe(slot, [x, y0, z], P[kind], { segments: 22, plan: false });
}

/** Segmented books standing on a shelf when the part budget is too tight for single books. */
function bookBlock(slot: string, x0: number, x1: number, y0: number, zb: number, maxH: number, maxD: number, n: number, rand: () => number): Part[] {
  const k = Math.max(1, n);
  const cw = (x1 - x0) / k;
  return range(k).map((i) => {
    const bh = maxH * lerp(0.74, 1, rand());
    const bd = maxD * lerp(0.86, 1, rand());
    return span(slot, [x0 + i * cw + (i ? 0.002 : 0), x0 + (i + 1) * cw], [y0, y0 + bh], [zb, zb + bd], NP);
  });
}

/** Books lying in a pile centred at (cx, cz). */
function bookStack(slot: string, cx: number, cz: number, y0: number, w: number, d: number, maxH: number, rand: () => number): { parts: Part[]; top: number } {
  const parts: Part[] = [];
  let y = y0;
  const n = 2 + Math.floor(rand() * 3);
  for (let i = 0; i < n; i++) {
    const t = lerp(0.022, 0.04, rand());
    if (y + t > y0 + maxH) break;
    const bw = w * lerp(0.84, 0.97, rand());
    const bd = d * lerp(0.84, 0.97, rand());
    const dx = (rand() - 0.5) * (w - bw);
    parts.push(box(slot, [cx + dx, y + t / 2, cz], [bw, t, bd], { rotation: [0, (rand() - 0.5) * 0.08, 0], plan: false }));
    y += t;
  }
  return { parts, top: y };
}

/** A trailing stem with leaves: from a pot rim over the shelf edge, then down the front at depth zv. */
function vine(slot: string, from: V3, yEdge: number, zv: number, yEnd: number, dx: number, seed: number, maxLeaves: number): Part[] {
  const rand = rng(seed);
  const e: V3 = [from[0] + dx * 0.2, yEdge, zv];
  const m: V3 = [from[0] + dx * 0.6, (yEdge + yEnd) / 2, zv];
  const b: V3 = [from[0] + dx, yEnd, zv];
  const parts: Part[] = rodPath(slot, [from, e, m, b], 0.0018);
  const n = clamp(Math.round((yEdge - yEnd) / 0.05), 2, Math.max(2, maxLeaves));
  for (let i = 0; i < n; i++) {
    const f = (i + 0.6) / n;
    const pt: V3 = f < 0.5 ? [lerp(e[0], m[0], f * 2), lerp(e[1], m[1], f * 2), zv] : [lerp(m[0], b[0], f * 2 - 1), lerp(m[1], b[1], f * 2 - 1), zv];
    const az = (i % 2 ? 0 : Math.PI) + (rand() - 0.5) * 0.6;
    parts.push(leaf(slot, pt, lerp(0.03, 0.044, rand()), lerp(0.022, 0.03, rand()), az, lerp(1.75, 2.35, rand())));
  }
  return parts;
}

/** Woven basket: body with softened corners and a rolled rim. */
function basketParts(slot: string, x: V2, y0: number, bh: number, z: V2, handles = false): Part[] {
  const parts: Part[] = [
    span(slot, [x[0] + 0.005, x[1] - 0.005], [y0, y0 + bh - 0.012], [z[0] + 0.005, z[1] - 0.005], { bevel: 0.012, plan: false }),
    span(slot, x, [y0 + bh - 0.024, y0 + bh], z, { bevel: 0.009, plan: false }),
  ];
  if (handles) {
    const zc = (z[0] + z[1]) / 2;
    for (const hx of [x[0] + 0.004, x[1] - 0.004]) {
      parts.push(torus(slot, [hx, y0 + bh * 0.72, zc], 0.024, 0.005, { rotation: [0, Math.PI / 2, 0], plan: false }));
    }
  }
  return parts;
}

/** Towel draped over a round bar at (yb, zb). */
function hangTowel(slot: string, x: V2, yb: number, zb: number, rb: number, drop: number, backFrac: number): Part[] {
  const th = 0.008;
  return [
    rodX(slot, x[0], x[1], yb, zb, rb + th, { segments: 12, plan: false }),
    span(slot, x, [yb - drop, yb], [zb + rb, zb + rb + th], NP),
    span(slot, [x[0] + 0.01, x[1] - 0.01], [yb - drop * backFrac, yb], [zb - rb - th, zb - rb], NP),
    span(slot, x, [yb - drop, yb - drop + 0.03], [zb + rb, zb + rb + th * 1.6], NP),
  ];
}

/** Pump bottle (body + collar, stem and spout in the cap slot). */
function pumpBottle(body: string, cap: string, x: number, z: number, y0: number, r: number, hh: number): Part[] {
  const hb = hh * 0.76;
  return [
    lathe(body, [x, y0, z], [[0, 0], [r * 0.92, 0], [r, hb * 0.06], [r, hb * 0.84], [r * 0.6, hb], [0, hb]], { segments: 18, plan: false }),
    vcyl(cap, x, z, y0 + hb, y0 + hb + hh * 0.07, r * 0.42, NP),
    vcyl(cap, x, z, y0 + hb + hh * 0.07, y0 + hh * 0.95, r * 0.15, NP),
    span(cap, [x - 0.005, x + 0.005], [y0 + hh * 0.9, y0 + hh], [z - r * 0.15, z + r * 0.85], NP),
  ];
}

/** Squeeze tube standing on its cap. */
function squeezeTube(body: string, cap: string, x: number, z: number, y0: number, r: number, hh: number): Part[] {
  const ch = Math.min(0.022, hh * 0.18);
  return [
    vcyl(cap, x, z, y0, y0 + ch, r * 0.55, NP),
    lathe(body, [x, y0 + ch, z], [[0, 0], [r * 0.5, 0], [r * 0.9, (hh - ch) * 0.25], [r, (hh - ch) * 0.7], [r, hh - ch - 0.004], [0, hh - ch]], {
      segments: 16,
      scale: [1, 1, 0.6],
      plan: false,
    }),
  ];
}

// ---------------------------------------------------------------------------
// Shelf dressing: fills a shelf zone left to right with seeded vignettes
// ---------------------------------------------------------------------------

type Kind =
  | 'books'
  | 'stack'
  | 'vase'
  | 'plant'
  | 'trail'
  | 'frame'
  | 'basket'
  | 'box'
  | 'jar'
  | 'bowl'
  | 'towels'
  | 'rolls'
  | 'bottles'
  | 'binders'
  | 'magazine'
  | 'tub'
  | 'carton';

/** Material slots available for shelf contents (a kind is used only when its slots exist). */
interface Dress {
  books?: string;
  decor?: string;
  plants?: string;
  pots?: string;
  frames?: string;
  art?: string;
  baskets?: string;
  boxes?: string;
  towels?: string;
  caps?: string;
  binders?: string;
  rings?: string;
  tubs?: string;
  cartons?: string;
}

interface Zone {
  x: V2;
  /** Shelf surface height. */
  y0: number;
  /** Free height above the shelf. */
  clear: number;
  /** Usable depth range (back, front). */
  z: V2;
  seed: number;
  kinds: Kind[];
  /** Trailing plants may hang down to yMin, in front of the shelf at depth z. */
  vine?: { yMin: number; z: number };
}

const NEED: Record<Kind, number> = {
  books: 0.12,
  stack: 0.05,
  vase: 0.1,
  plant: 0.14,
  trail: 0.1,
  frame: 0.12,
  basket: 0.1,
  box: 0.08,
  jar: 0.08,
  bowl: 0.045,
  towels: 0.06,
  rolls: 0.07,
  bottles: 0.1,
  binders: 0.2,
  magazine: 0.2,
  tub: 0.12,
  carton: 0.12,
};

function hasSlots(dr: Dress, k: Kind, zn: Zone): boolean {
  switch (k) {
    case 'books':
      return !!dr.books;
    case 'stack':
      return !!(dr.books ?? dr.decor);
    case 'vase':
    case 'jar':
    case 'bowl':
    case 'bottles':
      return !!dr.decor;
    case 'plant':
      return !!(dr.plants && (dr.pots ?? dr.decor));
    case 'trail':
      return !!(dr.plants && (dr.pots ?? dr.decor) && zn.vine);
    case 'frame':
      return !!(dr.frames && (dr.art ?? dr.decor));
    case 'basket':
      return !!dr.baskets;
    case 'box':
      return !!dr.boxes;
    case 'towels':
    case 'rolls':
      return !!dr.towels;
    case 'binders':
    case 'magazine':
      return !!dr.binders;
    case 'tub':
      return !!dr.tubs;
    case 'carton':
      return !!dr.cartons;
  }
}

interface Placed {
  parts: Part[];
  w: number;
}

function fillShelf(dr: Dress, zn: Zone, budget: number): Part[] {
  const rand = rng(zn.seed);
  const seed = () => Math.floor(rand() * 1e6);
  const out: Part[] = [];
  const [xa, xb] = zn.x;
  const [za, zb] = zn.z;
  const D = zb - za;
  const C = zn.clear;
  const y0 = zn.y0;
  const pool = zn.kinds.filter((k) => C >= NEED[k] && D >= 0.05 && hasSlots(dr, k, zn));
  if (!pool.length || xb - xa < 0.06 || budget < 1) return out;
  let left = budget;

  const place = (k: Kind, x: number, room: number): Placed | null => {
    switch (k) {
      case 'books': {
        const slot = dr.books as string;
        const maxH = Math.min(C - 0.012, lerp(0.2, 0.29, rand()));
        const bd = Math.min(0.24, D - 0.005);
        const w = Math.min(room, lerp(0.16, 0.46, rand()));
        if (w < 0.07 || maxH < 0.1) return null;
        if (Math.ceil(w / 0.034) + 1 <= left) {
          return { parts: bookRow(slot, [x, x + w], y0, za, maxH, bd, seed(), { lean: rand() < 0.35 }), w };
        }
        const n = Math.min(3, left);
        return n < 1 ? null : { parts: bookBlock(slot, x, x + w, y0, za, maxH, bd, n, rand), w };
      }
      case 'stack': {
        const slot = (dr.books ?? dr.decor) as string;
        const sw = Math.min(room, lerp(0.15, 0.24, rand()));
        if (sw < 0.12) return null;
        const sd = Math.min(D - 0.01, sw * lerp(0.7, 0.85, rand()));
        const cz = za + 0.005 + sd / 2 + (D - 0.01 - sd) * rand() * 0.5;
        const st = bookStack(slot, x + sw / 2, cz, y0, sw, sd, Math.min(C - 0.01, 0.14), rand);
        const parts = st.parts;
        const free = C - (st.top - y0) - 0.012;
        if (dr.decor && free > 0.06 && rand() < 0.65 && left > parts.length + 1) {
          const r = Math.min(sw, sd) * lerp(0.18, 0.28, rand());
          const cx = x + sw / 2 + (rand() - 0.5) * sw * 0.3;
          if (rand() < 0.5) parts.push(vessel(dr.decor, cx, cz, st.top, r, Math.min(free, r * lerp(1.8, 3.2, rand())), VESSELS[Math.floor(rand() * VESSELS.length)]));
          else parts.push(sphere(dr.decor, [cx, st.top + Math.min(r, free / 2) * 0.95, cz], Math.min(r, free / 2) * 0.95, NP));
        }
        return { parts, w: sw };
      }
      case 'vase': {
        const decor = dr.decor as string;
        const r = Math.min(lerp(0.035, 0.065, rand()), D / 2 - 0.006, room / 2);
        if (r < 0.025) return null;
        const hh = Math.min(C - 0.01, r * lerp(2.2, 4.8, rand()));
        if (hh < 0.08) return null;
        const cz = clamp(za + D * lerp(0.35, 0.6, rand()), za + r + 0.003, zb - r - 0.003);
        const parts = [vessel(decor, x + r, cz, y0, r, hh, VESSELS[Math.floor(rand() * VESSELS.length)])];
        let w = 2 * r;
        if (dr.plants && C - hh > 0.08 && rand() < 0.5 && left >= 4) {
          // A few cut stems in the vase.
          const lim = Math.min(cz - za, zb - cz, r + 0.03) - 0.016;
          for (let i = 0; i < 3; i++) {
            const tilt = lerp(0.12, 0.35, rand());
            const len = Math.min(C - hh - 0.015, lim / Math.sin(tilt), lerp(0.1, 0.2, rand()));
            if (len > 0.04) parts.push(leaf(dr.plants, [x + r, y0 + hh * 0.95, cz], len, lerp(0.018, 0.03, rand()), rand() * Math.PI * 2, tilt));
          }
        }
        if (rand() < 0.45 && room > 2 * r + 0.07 && left > parts.length) {
          const r2 = Math.min(r * lerp(0.55, 0.8, rand()), D / 2 - 0.006);
          const h2 = Math.min(C - 0.01, hh * lerp(0.45, 0.75, rand()));
          if (h2 > 0.05) {
            const cz2 = clamp(cz + (rand() - 0.5) * 0.04, za + r2 + 0.003, zb - r2 - 0.003);
            parts.push(vessel(decor, x + 2 * r + 0.008 + r2, cz2, y0, r2, h2, VESSELS[Math.floor(rand() * VESSELS.length)]));
            w = 2 * r + 0.008 + 2 * r2;
          }
        }
        return { parts, w };
      }
      case 'plant': {
        const pots = (dr.pots ?? dr.decor) as string;
        const plants = dr.plants as string;
        const r = Math.min(lerp(0.045, 0.075, rand()), D / 2 - 0.008, room / 2 - 0.004);
        if (r < 0.03 || left < 4) return null;
        const total = Math.min(C - 0.01, lerp(0.22, 0.42, rand()));
        const ph = Math.min(r * lerp(1.3, 1.9, rand()), total * 0.45);
        const rf = Math.max(r, Math.min(r * lerp(1.4, 2.1, rand()), D / 2 - 0.006, room / 2 - 0.002));
        const cx = x + rf;
        const cz = (za + zb) / 2;
        const n = clamp(Math.min(left - 1, 7 + Math.floor(rand() * 5)), 3, 12);
        const upright = rand() < 0.3;
        const styles = ['taper', 'cylinder', 'bowl', 'belly'] as const;
        return {
          parts: [
            pot(pots, [cx, y0, cz], r, ph, styles[Math.floor(rand() * styles.length)], NP),
            ...foliage(plants, [cx, y0 + ph * 0.88, cz], rf, total - ph * 0.88, n, seed(), upright ? { spread: 0.15, leafWid: rf * 0.28 } : { spread: lerp(0.4, 0.9, rand()) }),
          ],
          w: 2 * rf,
        };
      }
      case 'trail': {
        const pots = (dr.pots ?? dr.decor) as string;
        const plants = dr.plants as string;
        const v = zn.vine as { yMin: number; z: number };
        const r = Math.min(lerp(0.045, 0.065, rand()), D / 2 - 0.008);
        const w = Math.max(2 * r, 0.16);
        const ph = r * lerp(1.2, 1.5, rand());
        if (room < w || r < 0.03 || ph + 0.05 > C || left < 12) return null;
        const cx = x + w / 2;
        const cz = zb - r - 0.004;
        const parts: Part[] = [
          pot(pots, [cx, y0, cz], r, ph, 'cylinder', NP),
          ...foliage(plants, [cx, y0 + ph * 0.88, cz], r * 1.15, Math.min(C - ph * 0.88 - 0.01, 0.12), 5, seed(), { spread: 0.9 }),
        ];
        const nv = left >= 26 ? 3 : 2;
        for (let i = 0; i < nv; i++) {
          const sx = cx + (i - (nv - 1) / 2) * r * 0.9;
          const yEnd = Math.max(v.yMin + 0.045, y0 - lerp(0.12, 0.38, rand()));
          if (y0 - yEnd < 0.06) continue;
          parts.push(...vine(plants, [sx, y0 + ph, cz + r * 0.7], y0 + 0.008, v.z, yEnd, (rand() - 0.5) * 0.04, seed(), 6));
        }
        return parts.length <= left ? { parts, w } : null;
      }
      case 'frame': {
        const fw = Math.min(room, lerp(0.13, 0.28, rand()));
        const fh = Math.min(C - 0.015, fw * lerp(0.75, 1.4, rand()));
        if (fw < 0.1 || fh < 0.1 || D < 0.06) return null;
        const fd = 0.018;
        const zMax = za + Math.min(D - 0.004, fd + fh * 0.16 + 0.006);
        return { parts: leanFrame(dr.frames as string, (dr.art ?? dr.decor) as string, x + fw / 2, y0, za + 0.002, zMax, fw, fh, fd, lerp(0.014, 0.028, rand())), w: fw };
      }
      case 'basket': {
        const bw = Math.min(room, lerp(0.22, 0.36, rand()));
        const bh = Math.min(C - 0.015, lerp(0.13, 0.24, rand()));
        if (bw < 0.14 || bh < 0.08) return null;
        const bd = Math.min(D - 0.006, 0.36);
        return { parts: basketParts(dr.baskets as string, [x, x + bw], y0, bh, [za + 0.003, za + 0.003 + bd], left >= 6 && rand() < 0.5), w: bw };
      }
      case 'box': {
        const slot = dr.boxes as string;
        const bw = Math.min(room, lerp(0.18, 0.3, rand()));
        const bh = Math.min(C - 0.012, lerp(0.09, 0.16, rand()));
        if (bw < 0.12 || bh < 0.06) return null;
        const bd = Math.min(D - 0.006, lerp(0.2, 0.3, rand()));
        const lidded = (yb: number, sh: number, inset: number): Part[] => [
          span(slot, [x + 0.004 + inset, x + bw - 0.004 - inset], [yb, yb + sh - 0.018], [za + 0.006 + inset, za + bd - 0.004 - inset], { bevel: 0.004, plan: false }),
          span(slot, [x + inset, x + bw - inset], [yb + sh - 0.02, yb + sh], [za + 0.002 + inset, za + bd - inset], { bevel: 0.004, plan: false }),
        ];
        const parts = lidded(y0, bh, 0);
        if (C > 2 * bh + 0.02 && rand() < 0.5 && left >= 4) parts.push(...lidded(y0 + bh, bh * 0.8, 0.012));
        return { parts, w: bw };
      }
      case 'jar': {
        const decor = dr.decor as string;
        const n = Math.min(2 + Math.floor(rand() * 2), Math.floor(left / 2));
        if (n < 1) return null;
        const parts: Part[] = [];
        let cx = x;
        for (let i = 0; i < n; i++) {
          const r = Math.min(lerp(0.028, 0.045, rand()), D / 2 - 0.006);
          const hh = Math.min(C - 0.012, lerp(0.07, 0.16, rand()) * (1 - i * 0.15));
          if (cx + 2 * r > x + room || hh < 0.05) break;
          const cz = clamp(za + D * 0.45, za + r + 0.004, zb - r - 0.004);
          parts.push(vcyl(decor, cx + r, cz, y0, y0 + hh - 0.014, r, { segments: 20, plan: false }));
          parts.push(vcyl(decor, cx + r, cz, y0 + hh - 0.014, y0 + hh, r * 1.04, { segments: 20, plan: false }));
          cx += 2 * r + 0.006;
        }
        return parts.length ? { parts, w: cx - x - 0.006 } : null;
      }
      case 'bowl': {
        const decor = dr.decor as string;
        const r = Math.min(lerp(0.06, 0.1, rand()), D / 2 - 0.006, room / 2);
        const bh = Math.min(C - 0.01, r * lerp(0.45, 0.65, rand()));
        if (r < 0.04 || bh < 0.03) return null;
        const cz = (za + zb) / 2;
        const parts = [pot(decor, [x + r, y0, cz], r, bh, 'bowl', NP)];
        if (rand() < 0.5 && left >= 4) {
          for (let i = 0; i < 3; i++) {
            const a = (i / 3) * Math.PI * 2 + rand();
            const br = r * 0.28;
            parts.push(sphere(dr.plants ?? decor, [x + r + Math.cos(a) * r * 0.35, y0 + bh * 0.62 + br * 0.5, cz + Math.sin(a) * r * 0.35], br, NP));
          }
        }
        return { parts, w: 2 * r };
      }
      case 'towels': {
        const slot = dr.towels as string;
        const tw = Math.min(room, lerp(0.2, 0.3, rand()));
        const td = Math.min(D - 0.008, lerp(0.16, 0.24, rand()));
        if (tw < 0.14) return null;
        const parts: Part[] = [];
        let y = y0;
        for (let i = 0; i < 5 && parts.length < left; i++) {
          const t = lerp(0.032, 0.045, rand());
          if (y + t > y0 + Math.min(C - 0.01, 0.22)) break;
          const off = rand() * 0.008;
          parts.push(cushion(slot, [x + off, x + tw - 0.008 + off], [y, y + t], [za + 0.004, za + 0.004 + td], { softness: 0.45, plan: false }));
          y += t;
        }
        return parts.length ? { parts, w: tw } : null;
      }
      case 'rolls': {
        const slot = dr.towels as string;
        const rr = Math.min(lerp(0.032, 0.045, rand()), (C - 0.01) / 2);
        if (rr < 0.025) return null;
        const len = Math.min(D - 0.008, lerp(0.2, 0.26, rand()));
        let nb = rand() < 0.5 ? 3 : 2;
        while (nb > 0 && nb * 2 * rr + 0.004 > room) nb--;
        if (nb < 1) return null;
        const parts: Part[] = [];
        for (let j = 0; j < nb; j++) {
          const cy = y0 + rr + j * rr * 1.72;
          if (cy + rr > y0 + C - 0.008) break;
          for (let i = 0; i < nb - j && parts.length < left; i++) {
            parts.push(rodZ(slot, x + rr + (i + j * 0.5) * 2 * rr, cy, za + 0.004, za + 0.004 + len, rr, { segments: 16, plan: false }));
          }
        }
        return { parts, w: nb * 2 * rr };
      }
      case 'bottles': {
        const decor = dr.decor as string;
        const cap = dr.caps ?? decor;
        const parts: Part[] = [];
        let cx = x;
        const n = 2 + Math.floor(rand() * 2);
        for (let i = 0; i < n; i++) {
          const r = Math.min(lerp(0.025, 0.035, rand()), D / 2 - 0.006);
          const hh = Math.min(C - 0.012, lerp(0.12, 0.2, rand()));
          if (cx + 2 * r > x + room || hh < 0.08 || parts.length + 4 > left) break;
          const cz = clamp(za + D * 0.5, za + r + 0.004, zb - r * 0.9 - 0.004);
          parts.push(...(i % 2 === 0 ? pumpBottle(decor, cap, cx + r, cz, y0, r, hh) : [vessel(decor, cx + r, cz, y0, r, hh * 0.85, 'bottle'), vcyl(cap, cx + r, cz, y0 + hh * 0.85, y0 + hh, r * 0.34, NP)]));
          cx += 2 * r + 0.01;
        }
        return parts.length ? { parts, w: cx - x - 0.01 } : null;
      }
      case 'binders': {
        const slot = dr.binders as string;
        const bh = Math.min(C - 0.012, 0.32);
        const bdp = Math.min(D - 0.006, 0.285);
        const per = dr.rings ? 2 : 1;
        const n = Math.min(Math.floor(Math.min(room, lerp(0.2, 0.5, rand())) / 0.078), Math.floor(left / per));
        if (n < 1 || bh < 0.18) return null;
        const parts: Part[] = [];
        for (let i = 0; i < n; i++) {
          const bx = x + i * 0.078;
          parts.push(span(slot, [bx, bx + 0.075], [y0, y0 + bh], [za + 0.004, za + 0.004 + bdp], { bevel: 0.003, plan: false }));
          if (dr.rings) parts.push(discZ(dr.rings, [bx + 0.0375, y0 + bh * 0.2, za + 0.004 + bdp + 0.0015], 0.012, 0.003, NP));
        }
        return { parts, w: n * 0.078 };
      }
      case 'magazine': {
        const slot = dr.binders as string;
        const fw = 0.085;
        const hm = Math.min(C - 0.012, 0.31);
        const dd = Math.min(D - 0.006, 0.24);
        if (room < fw || hm < 0.18) return null;
        const parts = [
          sideProfile(slot, [[za, y0], [za + dd, y0], [za + dd, y0 + hm * 0.42], [za + dd * 0.4, y0 + hm], [za, y0 + hm]], x, x + fw),
        ];
        if (dr.books && left >= 2) parts.push(span(dr.books, [x + 0.008, x + fw - 0.008], [y0 + 0.005, y0 + hm * 0.78], [za + 0.006, za + dd - 0.014], NP));
        return { parts, w: fw };
      }
      case 'tub': {
        const slot = dr.tubs as string;
        const tw = Math.min(room, lerp(0.34, 0.5, rand()));
        const th = Math.min(C - 0.012, lerp(0.16, 0.3, rand()));
        const td = Math.min(D - 0.006, lerp(0.3, 0.45, rand()));
        if (tw < 0.24 || th < 0.1) return null;
        const tub = (yb: number, sh: number): Part[] => [
          span(slot, [x + 0.01, x + tw - 0.01], [yb, yb + sh - 0.02], [za + 0.01, za + td - 0.008], { bevel: 0.012, plan: false }),
          span(slot, [x, x + tw], [yb + sh - 0.024, yb + sh], [za + 0.002, za + td], { bevel: 0.006, plan: false }),
        ];
        const parts = tub(y0, th);
        if (C > 2 * th + 0.02 && rand() < 0.6 && left >= 4) parts.push(...tub(y0 + th, th));
        return { parts, w: tw };
      }
      case 'carton': {
        const slot = dr.cartons as string;
        const cw = Math.min(room, lerp(0.28, 0.45, rand()));
        const ch = Math.min(C - 0.012, lerp(0.18, 0.3, rand()));
        const cd = Math.min(D - 0.006, lerp(0.28, 0.4, rand()));
        if (cw < 0.2 || ch < 0.1) return null;
        const tape = dr.tubs;
        const carton = (yb: number, sh: number, sw: number): Part[] => {
          const ps = [span(slot, [x, x + sw], [yb, yb + sh], [za + 0.004, za + 0.004 + cd], { bevel: 0.002, plan: false })];
          if (tape) {
            ps.push(span(tape, [x + sw / 2 - 0.024, x + sw / 2 + 0.024], [yb + sh, yb + sh + 0.002], [za + 0.004, za + 0.004 + cd], NP));
            ps.push(span(tape, [x + sw / 2 - 0.024, x + sw / 2 + 0.024], [yb + sh - 0.06, yb + sh], [za + 0.004 + cd, za + 0.006 + cd], NP));
          }
          return ps;
        };
        const parts = carton(y0, ch, cw);
        if (C > 2 * ch + 0.02 && rand() < 0.5 && left >= parts.length * 2) parts.push(...carton(y0 + ch + 0.002, ch * 0.85, cw * 0.85));
        return { parts, w: cw };
      }
    }
  };

  let x = xa + rand() * 0.03;
  let last: Kind | null = null;
  for (let guard = 0; guard < 30 && left > 0; guard++) {
    const room = xb - x;
    if (room < 0.05) break;
    let k = pool[Math.floor(rand() * pool.length)];
    if (k === last && k !== 'books' && k !== 'binders' && pool.length > 1) k = pool[(pool.indexOf(k) + 1) % pool.length];
    const res = place(k, x, room);
    if (!res) {
      x += 0.02;
      continue;
    }
    if (res.parts.length > left) break;
    out.push(...res.parts);
    left -= res.parts.length;
    x += res.w + lerp(0.012, 0.05, rand());
    last = k;
  }
  return out;
}

/** Fill several zones, sharing the remaining part budget fairly between them. */
function dressZones(dr: Dress, zones: Zone[], budget: number): Part[] {
  const out: Part[] = [];
  let left = budget;
  zones.forEach((zn, i) => {
    const p = fillShelf(dr, zn, Math.floor(left / (zones.length - i)));
    out.push(...p);
    left -= p.length;
  });
  return out;
}

// ---------------------------------------------------------------------------
// Living room
// ---------------------------------------------------------------------------

const floatingShelfSet = defineItem({
  id: 'floating-shelf-set',
  name: 'Floating shelf trio',
  category: 'living',
  type: 'storage',
  group: 'Bookcases & shelves',
  tags: ['floating shelf', 'wall shelf', 'shelves', 'plants', 'styled', 'display', 'ceramics'],
  mount: 'wall',
  defaultElevation: 0.95,
  defaultSize: { w: 0.9, d: 0.22, h: 0.95 },
  minSize: { w: 0.45, d: 0.14, h: 0.5 },
  maxSize: { w: 2.0, d: 0.32, h: 1.6 },
  slots: [
    matSlot('shelf', 'Shelves & frames', 'oak-veneer'),
    matSlot('decor', 'Ceramics & books', 'speckled-stoneware'),
    matSlot('plants', 'Plants', 'plant-leaf'),
  ],
  build: ({ w, d, h }) => {
    const pt = 0.038;
    const g = h / 3;
    const pw = Math.min(w, Math.max(0.3, w * 0.68));
    const zb = -d / 2;
    const ze = d / 2 - 0.025;
    const parts: Part[] = [];
    const zones: Zone[] = [];
    for (let k = 0; k < 3; k++) {
      const y = k * g;
      const x0 = k % 2 === 0 ? -w / 2 : w / 2 - pw;
      parts.push(span('shelf', [x0, x0 + pw], [y, y + pt], [zb, ze], { bevel: 0.004 }));
      zones.push({
        x: [x0 + 0.02, x0 + pw - 0.02],
        y0: y + pt,
        clear: g - pt - 0.012,
        z: [zb + 0.01, ze - 0.006],
        seed: 101 + k * 17,
        kinds: ['plant', 'vase', 'stack', 'frame', 'trail', 'bowl', 'plant', 'vase', 'jar'],
        vine: k > 0 ? { yMin: 0.01, z: d / 2 - 0.014 } : undefined,
      });
    }
    return [...parts, ...dressZones({ decor: 'decor', plants: 'plants', frames: 'shelf' }, zones, MAXP - parts.length)];
  },
  planDetail: ({ w, d }) => [line([-w / 2, d / 2 - 0.025], [w / 2, d / 2 - 0.025])],
});

const cornerShelf = defineItem({
  id: 'corner-shelf',
  name: 'Corner shelf tower',
  category: 'living',
  type: 'storage',
  group: 'Bookcases & shelves',
  tags: ['corner shelf', 'quarter round', 'etagere', 'bookshelf', 'books', 'display'],
  defaultSize: { w: 0.55, d: 0.55, h: 1.8 },
  minSize: { w: 0.35, d: 0.35, h: 0.9 },
  maxSize: { w: 0.8, d: 0.8, h: 2.2 },
  wallSnap: true,
  slots: [
    matSlot('frame', 'Shelves & posts', 'walnut-veneer'),
    matSlot('books', 'Books', 'book-mix'),
    matSlot('decor', 'Ceramics', 'speckled-stoneware'),
  ],
  build: ({ w, d, h }) => {
    const st = 0.022;
    const ns = clamp(Math.round(h / 0.36), 3, 7);
    const ys = range(ns).map((k) => 0.03 + (k * (h - 0.03 - st)) / (ns - 1));
    const cx = -w / 2;
    const cz = -d / 2;
    const outline: V2[] = [
      [cx, cz],
      ...range(13).map((i) => {
        const a = (i / 12) * (Math.PI / 2);
        return [cx + w * Math.cos(a), cz + d * Math.sin(a)] as V2;
      }),
    ];
    const parts: Part[] = ys.map((y) => ({ shape: 'prism', outline: outline.map(([x, z]) => [x, z] as V2), height: st, position: [0, y, 0], slot: 'frame' }) as Part);
    const posts: V2[] = [
      [cx + 0.018, cz + 0.018],
      [cx + w - 0.03, cz + 0.018],
      [cx + 0.018, cz + d - 0.03],
      [cx + w * 0.64, cz + d * 0.64],
    ];
    for (const [px, pz] of posts) parts.push(vcyl('frame', px, pz, 0, h, 0.013, NP));
    const zones: Zone[] = [];
    for (let k = 0; k < ns - 1; k++) {
      const y0 = ys[k] + st;
      const clear = ys[k + 1] - y0 - 0.012;
      zones.push({ x: [cx + 0.04, cx + 0.04 + 0.6 * w], y0, clear, z: [cz + 0.012, cz + 0.58 * d], seed: 201 + k * 11, kinds: ['books', 'books', 'stack', 'vase', 'bowl', 'frame'] });
      zones.push({ x: [cx + 0.035, cx + 0.035 + 0.22 * w], y0, clear, z: [cz + 0.62 * d, cz + 0.9 * d], seed: 251 + k * 7, kinds: ['vase', 'bowl', 'jar'] });
    }
    return [...parts, ...dressZones({ books: 'books', decor: 'decor', frames: 'frame' }, zones, MAXP - parts.length)];
  },
  planDetail: ({ w, d }) => [
    circle([-w / 2 + 0.018, -d / 2 + 0.018], 0.013),
    circle([-w / 2 + w * 0.64, -d / 2 + d * 0.64], 0.013),
    poly(range(9).map((i) => {
      const a = (i / 8) * (Math.PI / 2);
      return [-w / 2 + w * 0.92 * Math.cos(a), -d / 2 + d * 0.92 * Math.sin(a)] as V2;
    }), false),
  ],
});

const pipeShelf = defineItem({
  id: 'pipe-shelf',
  name: 'Industrial pipe shelf',
  category: 'living',
  type: 'storage',
  group: 'Bookcases & shelves',
  tags: ['pipe shelf', 'industrial', 'iron pipe', 'reclaimed wood', 'wall shelf', 'books', 'plants'],
  mount: 'wall',
  defaultElevation: 0.9,
  defaultSize: { w: 1.0, d: 0.25, h: 0.9 },
  minSize: { w: 0.6, d: 0.18, h: 0.5 },
  maxSize: { w: 2.0, d: 0.35, h: 1.6 },
  slots: [
    matSlot('pipe', 'Pipes & tins', 'black-iron-pipe'),
    matSlot('board', 'Boards', 'reclaimed-pine'),
    matSlot('books', 'Books', 'book-mix'),
    matSlot('plants', 'Plants', 'plant-leaf'),
  ],
  build: ({ w, d, h }) => {
    const r = 0.0135;
    const bt = 0.032;
    const n = clamp(Math.round(h / 0.3), 2, 5);
    const cols = spaced(w > 1.3 ? 3 : 2, -w / 2 + 0.12, w / 2 - 0.12);
    const zw = -d / 2;
    const zp = d / 2 - 0.04;
    const ya = range(n).map((k) => 0.032 + (k * (h - bt - r - 0.032)) / (n - 1));
    const parts: Part[] = ya.map((y) => span('board', [-w / 2, w / 2], [y + r, y + r + bt], [zw, d / 2 - 0.018], { bevel: 0.005 }));
    for (const x of cols) {
      parts.push(vcyl('pipe', x, zp, ya[0], ya[n - 1], r, NP));
      for (const y of ya) {
        parts.push(discZ('pipe', [x, y, zw + 0.005], 0.03, 0.01, NP));
        parts.push(rodZ('pipe', x, y, zw + 0.01, zp, r, NP));
        parts.push(cyl('pipe', [x, y, zp], r * 1.5, 0.05, NP));
      }
    }
    const zones: Zone[] = range(n - 1).map((k) => {
      const y0 = ya[k] + r + bt;
      return {
        x: [-w / 2 + 0.02, w / 2 - 0.02],
        y0,
        clear: ya[k + 1] - r - y0 - 0.008,
        z: [zw + 0.014, zp - r * 1.5 - 0.008],
        seed: 301 + k * 19,
        kinds: ['books', 'books', 'plant', 'trail', 'stack', 'plant', 'books'],
        vine: { yMin: 0.01, z: d / 2 - 0.009 },
      };
    });
    return [...parts, ...dressZones({ books: 'books', plants: 'plants', pots: 'pipe' }, zones, MAXP - parts.length)];
  },
  planDetail: ({ w, d }) => spaced(w > 1.3 ? 3 : 2, -w / 2 + 0.12, w / 2 - 0.12).map((x) => line([x, -d / 2], [x, d / 2 - 0.04])),
});

const gridWallShelving = defineItem({
  id: 'grid-wall-shelving',
  name: 'Wall grid shelving system',
  category: 'living',
  type: 'storage',
  group: 'Bookcases & shelves',
  tags: ['shelving system', 'wall uprights', 'brackets', 'modular', 'string shelf', 'books'],
  mount: 'wall',
  defaultElevation: 0.25,
  defaultSize: { w: 1.6, d: 0.3, h: 1.8 },
  minSize: { w: 0.7, d: 0.2, h: 0.8 },
  maxSize: { w: 3.2, d: 0.4, h: 2.4 },
  slots: [
    matSlot('rail', 'Uprights & brackets', 'powder-black'),
    matSlot('shelf', 'Shelves & boxes', 'oak-veneer'),
    matSlot('books', 'Books', 'book-mix'),
    matSlot('decor', 'Ceramics & prints', 'speckled-stoneware'),
  ],
  build: ({ w, d, h }) => {
    const nb = clamp(Math.round(w / 0.8), 1, 4);
    const ux = spaced(nb + 1, -w / 2 + 0.02, w / 2 - 0.02);
    const uw = 0.024;
    const ud = 0.016;
    const zw = -d / 2;
    const top = h - 0.04;
    const parts: Part[] = [span('rail', [-w / 2, w / 2], [top, top + 0.03], [zw, zw + 0.014], { bevel: 0.003 })];
    for (const x of ux) parts.push(span('rail', [x - uw / 2, x + uw / 2], [0, top], [zw, zw + ud]));
    const rand = rng(41 + nb * 7);
    const nl = clamp(Math.round(h / 0.45), 2, 5);
    const lo = 0.07;
    const hi = top - 0.3;
    const zones: Zone[] = [];
    for (let b = 0; b < nb; b++) {
      const levels = range(nl).map((k) => clamp(lo + (k * (hi - lo)) / (nl - 1) + (rand() - 0.5) * ((hi - lo) / (nl * 3)), lo, hi));
      levels.forEach((y, k) => {
        parts.push(span('shelf', [ux[b] + 0.004, ux[b + 1] - 0.004], [y, y + 0.022], [zw + ud + 0.004, d / 2], { bevel: 0.003 }));
        for (const xu of [ux[b], ux[b + 1]]) parts.push(span('rail', [xu - 0.004, xu + 0.004], [y - 0.05, y], [zw + ud, d / 2 - 0.04], NP));
        const y0 = y + 0.022;
        zones.push({
          x: [ux[b] + 0.02, ux[b + 1] - 0.02],
          y0,
          clear: Math.min(0.36, (k < nl - 1 ? levels[k + 1] : h) - y0 - 0.012),
          z: [zw + ud + 0.006, d / 2 - 0.006],
          seed: 401 + b * 37 + k * 5,
          kinds: ['books', 'books', 'vase', 'stack', 'frame', 'bowl', 'box', 'jar'],
        });
      });
    }
    return [...parts, ...dressZones({ books: 'books', decor: 'decor', frames: 'rail', boxes: 'shelf' }, zones, MAXP - parts.length)];
  },
  planDetail: ({ w, d }) => [line([-w / 2, -d / 2 + 0.016], [w / 2, -d / 2 + 0.016])],
});

const bookcaseLow = defineItem({
  id: 'bookcase-low',
  name: 'Low bookcase',
  category: 'living',
  type: 'storage',
  group: 'Bookcases & shelves',
  tags: ['bookcase', 'low shelf', 'cube shelf', 'baskets', 'books', 'storage'],
  defaultSize: { w: 1.2, d: 0.32, h: 0.8 },
  minSize: { w: 0.6, d: 0.24, h: 0.45 },
  maxSize: { w: 2.4, d: 0.45, h: 1.2 },
  wallSnap: true,
  slots: [
    matSlot('frame', 'Cabinet & wooden pieces', 'oak-veneer'),
    matSlot('books', 'Books', 'book-mix'),
    matSlot('baskets', 'Baskets', 'seagrass-weave'),
  ],
  build: ({ w, d, h }) => {
    const t = 0.022;
    const base = 0.06;
    const xi: V2 = [-w / 2 + t, w / 2 - t];
    const parts: Part[] = [
      span('frame', [-w / 2, -w / 2 + t], [0, h - t], [-d / 2, d / 2]),
      span('frame', [w / 2 - t, w / 2], [0, h - t], [-d / 2, d / 2]),
      span('frame', [-w / 2, w / 2], [h - t, h], [-d / 2, d / 2], { bevel: 0.003 }),
      span('frame', xi, [0, base], [-d / 2, d / 2 - 0.02], NP),
      span('frame', xi, [base, base + t], [-d / 2, d / 2], NP),
      span('frame', xi, [base + t, h - t], [-d / 2, -d / 2 + 0.008], NP),
    ];
    const nc = clamp(Math.round(w / 0.55), 1, 4);
    const colB = range(nc + 1).map((i) => xi[0] + (i * (xi[1] - xi[0])) / nc);
    for (let i = 1; i < nc; i++) parts.push(span('frame', [colB[i] - t / 2, colB[i] + t / 2], [base + t, h - t], [-d / 2 + 0.008, d / 2 - 0.004], NP));
    const inner = h - t - (base + t);
    const nr = clamp(Math.round(inner / 0.32), 1, 3);
    const rh = inner / nr;
    const cx0 = (c: number) => colB[c] + (c > 0 ? t / 2 : 0);
    const cx1 = (c: number) => colB[c + 1] - (c < nc - 1 ? t / 2 : 0);
    const zones: Zone[] = [];
    for (let r = 0; r < nr; r++) {
      const yb = base + t + r * rh;
      for (let c = 0; c < nc; c++) {
        if (r > 0) parts.push(span('frame', [cx0(c), cx1(c)], [yb - t / 2, yb + t / 2], [-d / 2 + 0.008, d / 2 - 0.004], NP));
        const y0 = yb + (r > 0 ? t / 2 : 0);
        zones.push({
          x: [cx0(c) + 0.012, cx1(c) - 0.012],
          y0,
          clear: base + t + (r + 1) * rh - (r < nr - 1 ? t / 2 : 0) - y0 - 0.01,
          z: [-d / 2 + 0.012, d / 2 - 0.008],
          seed: 501 + r * 23 + c * 7,
          kinds: r === 0 ? ['basket', 'basket', 'books'] : ['books', 'books', 'stack', 'bowl', 'basket', 'box'],
        });
      }
    }
    return [...parts, ...dressZones({ books: 'books', baskets: 'baskets', decor: 'frame', boxes: 'frame' }, zones, MAXP - parts.length)];
  },
  planDetail: ({ w, d }) => [line([-w / 2 + 0.022, -d / 2 + 0.008], [w / 2 - 0.022, -d / 2 + 0.008])],
});

const bookcaseBarrister = defineItem({
  id: 'bookcase-barrister',
  name: 'Barrister bookcase',
  category: 'living',
  type: 'storage',
  group: 'Bookcases & shelves',
  tags: ['barrister', 'lawyer bookcase', 'stacking bookcase', 'glass doors', 'lift-up doors', 'books', 'antique'],
  defaultSize: { w: 0.9, d: 0.36, h: 1.5 },
  minSize: { w: 0.6, d: 0.28, h: 0.8 },
  maxSize: { w: 1.4, d: 0.45, h: 2.0 },
  wallSnap: true,
  slots: [
    matSlot('wood', 'Cabinet', 'walnut-veneer'),
    matSlot('glass', 'Door glass', 'glass-clear'),
    matSlot('books', 'Books', 'book-mix'),
    matSlot('decor', 'Curios', 'speckled-stoneware'),
  ],
  build: ({ w, d, h }) => {
    const st = 0.02;
    const baseH = clamp(h * 0.07, 0.07, 0.12);
    const capH = 0.05;
    const body = h - baseH - capH;
    const ns = clamp(Math.round(body / 0.33), 2, 5);
    const wts = range(ns).map((i) => (i === 0 ? 1.15 : 1));
    const sum = wts.reduce((a, b) => a + b, 0);
    const parts: Part[] = [
      span('wood', [-w / 2 + 0.012, w / 2 - 0.012], [0, baseH - 0.016], [-d / 2, d / 2 - 0.012], { bevel: 0.004 }),
      span('wood', [-w / 2, w / 2], [baseH - 0.016, baseH], [-d / 2, d / 2], { bevel: 0.004 }),
      span('wood', [-w / 2, w / 2], [h - capH, h - capH + 0.018], [-d / 2, d / 2], { bevel: 0.004 }),
      span('wood', [-w / 2 + 0.012, w / 2 - 0.012], [h - capH + 0.018, h], [-d / 2, d / 2 - 0.012], { bevel: 0.006 }),
      span('wood', [-w / 2 + st, w / 2 - st], [baseH, h - capH], [-d / 2, -d / 2 + 0.008], NP),
    ];
    const zones: Zone[] = [];
    let y = baseH;
    for (let i = 0; i < ns; i++) {
      const ya = y;
      const yb = y + (body * wts[i]) / sum;
      parts.push(
        span('wood', [-w / 2, -w / 2 + st], [ya + 0.002, yb], [-d / 2, d / 2 - 0.004]),
        span('wood', [w / 2 - st, w / 2], [ya + 0.002, yb], [-d / 2, d / 2 - 0.004]),
        span('wood', [-w / 2 + st, w / 2 - st], [ya, ya + 0.02], [-d / 2 + 0.008, d / 2 - 0.03], NP),
        span('wood', [-w / 2, w / 2], [ya, ya + 0.032], [d / 2 - 0.03, d / 2], { bevel: 0.003, plan: false }),
        ...frame4('wood', [-w / 2 + st, w / 2 - st], [ya + 0.034, yb - 0.004], [d / 2 - 0.024, d / 2 - 0.004], 0.034),
        span('glass', [-w / 2 + st + 0.03, w / 2 - st - 0.03], [ya + 0.064, yb - 0.034], [d / 2 - 0.016, d / 2 - 0.012], NP),
        sphere('wood', [-w * 0.27, ya + 0.051, d / 2 - 0.002], 0.011, { scale: [1, 1, 0.7], plan: false }),
        sphere('wood', [w * 0.27, ya + 0.051, d / 2 - 0.002], 0.011, { scale: [1, 1, 0.7], plan: false }),
      );
      zones.push({
        x: [-w / 2 + st + 0.01, w / 2 - st - 0.01],
        y0: ya + 0.02,
        clear: yb - ya - 0.032,
        z: [-d / 2 + 0.012, d / 2 - 0.034],
        seed: 601 + i * 29,
        kinds: ['books', 'books', 'books', 'stack', 'vase', 'bowl'],
      });
      y = yb;
    }
    return [...parts, ...dressZones({ books: 'books', decor: 'decor' }, zones, MAXP - parts.length)];
  },
  planDetail: ({ w, d }) => [line([-w / 2 + 0.02, d / 2 - 0.014], [w / 2 - 0.02, d / 2 - 0.014])],
});

const bookcaseRevolving = defineItem({
  id: 'bookcase-revolving',
  name: 'Revolving bookcase',
  category: 'living',
  type: 'storage',
  group: 'Bookcases & shelves',
  tags: ['revolving', 'rotating bookcase', 'swivel', 'library', 'books', 'four-sided'],
  defaultSize: { w: 0.5, d: 0.5, h: 1.2 },
  minSize: { w: 0.38, d: 0.38, h: 0.6 },
  maxSize: { w: 0.7, d: 0.7, h: 1.8 },
  slots: [
    matSlot('frame', 'Bookcase', 'oak-veneer'),
    matSlot('books', 'Books', 'book-mix'),
    matSlot('decor', 'Ornaments', 'speckled-stoneware'),
  ],
  build: ({ w, d, h }) => {
    const s = Math.min(w, d);
    const sb = s - 0.016;
    const hh = sb / 2;
    const b = sb * 0.38;
    const t = 0.016;
    const baseH = 0.07;
    const topT = 0.022;
    const nt = clamp(Math.round((h - baseH - topT) / 0.3), 1, 5);
    const th = (h - baseH - topT) / nt;
    const parts: Part[] = [
      cyl('frame', [0, 0.012, 0], s * 0.42, 0.024, { segments: 32 }),
      span('frame', [-hh + 0.02, hh - 0.02], [0.024, baseH], [-hh + 0.02, hh - 0.02], NP),
      span('frame', [-s / 2, s / 2], [h - topT, h], [-s / 2, s / 2], { bevel: 0.005 }),
    ];
    for (let k = 0; k < nt; k++) parts.push(span('frame', [-hh, hh], [baseH + k * th, baseH + k * th + t], [-hh, hh], NP));
    let left = MAXP - parts.length - 4 * 5;
    for (let q = 0; q < 4; q++) {
      const face: Part[] = [
        span('frame', [-hh, hh - b], [baseH, h - topT], [hh - b, hh - b + t], NP),
        span('frame', [hh - b - t, hh - b], [baseH, h - topT], [hh - b + t, hh], NP),
      ];
      for (const zc of [hh - b + t + (b - t) * 0.2, hh - b + t + (b - t) * 0.5, hh - b + t + (b - t) * 0.8]) {
        face.push(span('frame', [-hh, -hh + 0.012], [baseH, h - topT], [zc - 0.011, zc + 0.011], NP));
      }
      const zones: Zone[] = range(nt).map((k) => {
        const y0 = baseH + k * th + t;
        return {
          x: [-hh + 0.02, hh - b - t - 0.008],
          y0,
          clear: (k + 1 < nt ? baseH + (k + 1) * th : h - topT) - y0 - 0.01,
          z: [hh - b + t + 0.004, hh - 0.004],
          seed: 701 + q * 41 + k * 13,
          kinds: ['books', 'books', 'books', 'stack', 'vase'],
        };
      });
      const contents = dressZones({ books: 'books', decor: 'decor' }, zones, Math.floor(left / (4 - q)));
      left -= contents.length;
      parts.push(...turnY([...face, ...contents], (q * Math.PI) / 2));
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const sb = Math.min(w, d) - 0.016;
    const hh = sb / 2;
    const b = sb * 0.38;
    const out: PlanStroke[] = [];
    for (let q = 0; q < 4; q++) {
      const a = (q * Math.PI) / 2;
      const rot = ([x, z]: V2): V2 => [Math.cos(a) * x + Math.sin(a) * z, -Math.sin(a) * x + Math.cos(a) * z];
      out.push(line(rot([-hh, hh - b]), rot([hh - b, hh - b])), line(rot([hh - b, hh - b]), rot([hh - b, hh])));
    }
    return out;
  },
});

const bookcaseWall = defineItem({
  id: 'bookcase-wall',
  name: 'Wall-to-wall bookcase',
  category: 'living',
  type: 'storage',
  group: 'Bookcases & shelves',
  tags: ['built-in', 'library wall', 'bookcase', 'cupboards', 'books', 'floor to ceiling'],
  defaultSize: { w: 3.0, d: 0.35, h: 2.4 },
  minSize: { w: 1.5, d: 0.28, h: 1.8 },
  maxSize: { w: 5.0, d: 0.45, h: 2.7 },
  wallSnap: true,
  slots: [
    matSlot('frame', 'Joinery', 'wood-painted-white'),
    matSlot('books', 'Books', 'book-mix'),
    matSlot('decor', 'Ceramics & prints', 'speckled-stoneware'),
  ],
  build: ({ w, d, h }) => {
    const t = 0.022;
    const plinth = 0.08;
    const crown = 0.06;
    const nc = clamp(Math.round(w / 0.8), 2, 6);
    const xi: V2 = [-w / 2 + t, w / 2 - t];
    const colB = range(nc + 1).map((i) => xi[0] + (i * (xi[1] - xi[0])) / nc);
    const cx0 = (c: number) => colB[c] + (c > 0 ? t / 2 : 0);
    const cx1 = (c: number) => colB[c + 1] - (c < nc - 1 ? t / 2 : 0);
    const cab = h >= 1.9 ? 0.74 : 0;
    const yTop = h - crown;
    const parts: Part[] = [
      span('frame', [-w / 2, -w / 2 + t], [0, yTop], [-d / 2, d / 2]),
      span('frame', [w / 2 - t, w / 2], [0, yTop], [-d / 2, d / 2]),
      span('frame', xi, [yTop, yTop + 0.025], [-d / 2, d / 2 - 0.012], NP),
      span('frame', [-w / 2, w / 2], [yTop + 0.025, h], [-d / 2, d / 2], { bevel: 0.006 }),
      span('frame', xi, [0, plinth], [-d / 2, d / 2 - 0.02], NP),
      span('frame', xi, [plinth, plinth + t], [-d / 2, d / 2], NP),
      span('frame', xi, [plinth + t, yTop], [-d / 2, -d / 2 + 0.008], NP),
    ];
    for (let i = 1; i < nc; i++) parts.push(span('frame', [colB[i] - t / 2, colB[i] + t / 2], [plinth + t, yTop], [-d / 2 + 0.008, d / 2 - 0.004], NP));
    if (cab) {
      parts.push(span('frame', xi, [plinth + cab - t, plinth + cab], [-d / 2 + 0.008, d / 2], NP));
      for (let c = 0; c < nc; c++) {
        const x0 = cx0(c) + 0.003;
        const x1 = cx1(c) - 0.003;
        const y0 = plinth + t + 0.003;
        const y1 = plinth + cab - t - 0.003;
        parts.push(
          span('frame', [x0, x1], [y0, y1], [d / 2 - 0.024, d / 2 - 0.008], NP),
          span('frame', [x0 + 0.05, x1 - 0.05], [y0 + 0.05, y1 - 0.05], [d / 2 - 0.008, d / 2 - 0.002], { bevel: 0.002, plan: false }),
          sphere('frame', [c % 2 === 0 ? x1 - 0.035 : x0 + 0.035, y1 - 0.07, d / 2 + 0.003], 0.012, { scale: [1, 1, 0.8], plan: false }),
        );
      }
    }
    const y0u = cab ? plinth + cab : plinth + t;
    const nr = clamp(Math.round((yTop - y0u) / 0.34), 2, 7);
    const rh = (yTop - y0u) / nr;
    for (let r = 1; r < nr; r++) parts.push(span('frame', xi, [y0u + r * rh - t / 2, y0u + r * rh + t / 2], [-d / 2 + 0.008, d / 2 - 0.004], NP));
    const rand = rng(97 + nc * 3 + nr);
    const zones: Zone[] = [];
    for (let r = 0; r < nr; r++) {
      for (let c = 0; c < nc; c++) {
        const y0 = y0u + r * rh + (r ? t / 2 : 0);
        zones.push({
          x: [cx0(c) + 0.012, cx1(c) - 0.012],
          y0,
          clear: y0u + (r + 1) * rh - (r < nr - 1 ? t / 2 : 0) - y0 - 0.012,
          z: [-d / 2 + 0.012, d / 2 - 0.012],
          seed: 801 + r * 31 + c * 7,
          kinds: rand() < 0.62 ? ['books', 'books', 'books', 'stack'] : ['vase', 'bowl', 'frame', 'stack', 'jar', 'vase'],
        });
      }
    }
    return [...parts, ...dressZones({ books: 'books', decor: 'decor', frames: 'frame' }, zones, MAXP - parts.length)];
  },
  planDetail: ({ w, d }) => {
    const nc = clamp(Math.round(w / 0.8), 2, 6);
    const xs = range(nc - 1).map((i) => -w / 2 + 0.022 + ((i + 1) * (w - 0.044)) / nc);
    return [line([-w / 2 + 0.022, -d / 2 + 0.008], [w / 2 - 0.022, -d / 2 + 0.008]), ...xs.map((x) => line([x, -d / 2 + 0.008], [x, d / 2 - 0.004]))];
  },
});

const displayLedges = defineItem({
  id: 'display-ledges',
  name: 'Picture ledges',
  category: 'living',
  type: 'storage',
  group: 'Bookcases & shelves',
  tags: ['picture ledge', 'photo shelf', 'gallery wall', 'frames', 'art', 'display'],
  mount: 'wall',
  defaultElevation: 1.0,
  defaultSize: { w: 1.2, d: 0.1, h: 0.9 },
  minSize: { w: 0.5, d: 0.07, h: 0.35 },
  maxSize: { w: 2.4, d: 0.14, h: 1.5 },
  slots: [
    matSlot('ledge', 'Ledges', 'oak-veneer'),
    matSlot('frames', 'Frames', 'wood-ebony'),
    matSlot('art', 'Prints', 'paper-art'),
  ],
  build: ({ w, d, h }) => {
    const nl = clamp(Math.round(h / 0.42), 1, 3);
    const g = h / nl;
    const parts: Part[] = [];
    for (let k = 0; k < nl; k++) {
      const y = k * g;
      parts.push(
        span('ledge', [-w / 2, w / 2], [y, y + 0.02], [-d / 2, d / 2], { bevel: 0.002 }),
        span('ledge', [-w / 2, w / 2], [y + 0.02, y + 0.046], [d / 2 - 0.012, d / 2], { bevel: 0.002, plan: false }),
        span('ledge', [-w / 2, w / 2], [y, y + 0.07], [-d / 2, -d / 2 + 0.012], NP),
      );
    }
    let left = MAXP - parts.length;
    for (let k = 0; k < nl; k++) {
      const rand = rng(901 + k * 13);
      const y0 = k * g + 0.02;
      const clear = g - 0.02 - 0.014;
      let budget = Math.floor(left / (nl - k));
      let x = -w / 2 + 0.03 + rand() * 0.04;
      while (x < w / 2 - 0.1 && budget >= 5) {
        const land = rand() < 0.35;
        const fh = clear * lerp(0.5, 0.95, rand());
        const fw = Math.min(land ? fh * lerp(1.2, 1.5, rand()) : fh * lerp(0.65, 0.85, rand()), w / 2 - 0.02 - x);
        if (fw < 0.08) break;
        const fr = leanFrame('frames', 'art', x + fw / 2, y0, -d / 2 + 0.013, d / 2 - 0.013, fw, fh, lerp(0.016, 0.026, rand()), lerp(0.012, 0.03, rand()), 0.2);
        parts.push(...fr);
        budget -= fr.length;
        left -= fr.length;
        x += fw + lerp(0.015, 0.05, rand());
      }
    }
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w / 2, d / 2 - 0.012], [w / 2, d / 2 - 0.012])],
});

const wineShelfWall = defineItem({
  id: 'wine-shelf-wall',
  name: 'Wall wine shelf',
  category: 'living',
  type: 'storage',
  group: 'Bookcases & shelves',
  tags: ['wine rack', 'wine shelf', 'bottles', 'stemware', 'glass rack', 'bar'],
  mount: 'wall',
  defaultElevation: 1.1,
  defaultSize: { w: 0.9, d: 0.32, h: 0.75 },
  minSize: { w: 0.45, d: 0.28, h: 0.4 },
  maxSize: { w: 1.6, d: 0.4, h: 1.2 },
  slots: [
    matSlot('wood', 'Shelf', 'walnut-veneer'),
    matSlot('metal', 'Glass rails & capsules', 'powder-black'),
    matSlot('bottles', 'Wine bottles', 'wine-bottle-glass'),
    matSlot('glasses', 'Stemware', 'glass-clear'),
  ],
  build: ({ w, d, h }) => {
    const t = 0.022;
    const br = 0.037;
    const L = Math.min(0.3, d - 0.02);
    const rows = h >= 0.6 ? 2 : 1;
    const pitch = 0.09;
    const nb = clamp(Math.floor((w - 2 * t - 0.01) / pitch), 1, 16);
    const y1 = t + 0.035 + br - 0.012;
    const y2 = y1 + br * 1.75;
    const yC = (rows === 2 ? y2 : y1) + br + 0.008;
    let gz = clamp((h - yC - t) * 0.55, 0.12, 0.24);
    if (h - yC - t - gz < 0.12) gz = h - yC - t;
    const yT = yC + gz;
    const parts: Part[] = [
      span('wood', [-w / 2, w / 2], [0, t], [-d / 2, d / 2], { bevel: 0.003 }),
      span('wood', [-w / 2, -w / 2 + t], [t, yT + t], [-d / 2, d / 2]),
      span('wood', [w / 2 - t, w / 2], [t, yT + t], [-d / 2, d / 2]),
      span('wood', [-w / 2 + t, w / 2 - t], [t, t + 0.035], [d / 2 - 0.1, d / 2 - 0.078], NP),
      span('wood', [-w / 2 + t, w / 2 - t], [t, t + 0.035], [-d / 2 + 0.05, -d / 2 + 0.072], NP),
      span('wood', [-w / 2 + t, w / 2 - t], [yC - t, yC], [-d / 2, d / 2], NP),
      span('wood', [-w / 2 + t, w / 2 - t], [yC, yT], [-d / 2, -d / 2 + 0.012], NP),
      span('wood', [-w / 2, w / 2], [yT, yT + t], [-d / 2, d / 2], { bevel: 0.003 }),
    ];
    const bottleProfile: V2[] = [[0, 0], [br, 0], [br, L * 0.62], [br * 0.85, L * 0.7], [br * 0.36, L * 0.8], [br * 0.33, L], [0, L]];
    const zc = -d / 2 + 0.01 + L / 2;
    const layBottle = (x: number, y: number, capsule: boolean): Part[] => {
      const ps = [lathe('bottles', [x, y - L / 2, zc], bottleProfile, { rotation: [Math.PI / 2, 0, 0], segments: 16, plan: false })];
      if (capsule) ps.push(rodZ('metal', x, y, zc + L / 2 - 0.05, zc + L / 2 - 0.002, br * 0.36, NP));
      return ps;
    };
    // Glass rails under the top board and inverted wine glasses.
    const ng = clamp(Math.floor((w - 2 * t) / 0.11), 1, 12);
    const gx = range(ng + 1).map((i) => -w / 2 + t + (i * (w - 2 * t)) / ng);
    const gh = Math.min(0.19, gz - 0.03);
    const nz = clamp(Math.floor((d - 0.06) / 0.11), 1, 3);
    if (gh > 0.08) for (const x of gx.slice(1, -1)) parts.push(span('metal', [x - 0.006, x + 0.006], [yT - 0.018, yT], [-d / 2 + 0.02, d / 2 - 0.01], NP));
    // Top shelf contents: standing bottles and a decanter.
    const topClear = h - yT - t - 0.01;
    const top: Part[] = [];
    if (topClear > 0.12) {
      const rand = rng(77 + nb);
      let x = -w / 2 + 0.05;
      while (x < w / 2 - 0.08 && top.length < 10) {
        if (rand() < 0.25 && x < w / 2 - 0.14) {
          const r = 0.055;
          const hh = Math.min(topClear, 0.24);
          top.push(lathe('glasses', [x + r, yT + t, 0], [[0, 0], [r * 0.7, 0], [r, hh * 0.25], [r * 0.9, hh * 0.5], [r * 0.3, hh * 0.68], [r * 0.25, hh * 0.85], [0, hh * 0.85]], { segments: 22, plan: false }));
          top.push(sphere('glasses', [x + r, yT + t + hh * 0.85 + 0.02, 0], 0.02, NP));
          x += 2 * r + 0.03;
        } else {
          const hh = Math.min(topClear, 0.3);
          top.push(vessel('bottles', x + br, -d / 2 + 0.06 + rand() * 0.08, yT + t, br, hh, 'bottle'));
          x += 2 * br + 0.012;
        }
      }
    }
    let left = MAXP - parts.length - top.length;
    parts.push(...top);
    // Bottles in the cradle (capsules only while the budget allows).
    const nBottles = nb + (rows === 2 ? nb - 1 : 0);
    const cap = left - nBottles >= nBottles + 10;
    for (let i = 0; i < nb && left > 0; i++) {
      const ps = layBottle(-w / 2 + t + 0.005 + br + i * pitch, y1, cap);
      parts.push(...ps);
      left -= ps.length;
    }
    if (rows === 2) {
      for (let i = 0; i < nb - 1 && left > 0; i++) {
        const ps = layBottle(-w / 2 + t + 0.005 + br + (i + 0.5) * pitch, y2, cap);
        parts.push(...ps);
        left -= ps.length;
      }
    }
    if (gh > 0.08) {
      const gr = Math.min(0.038, (w - 2 * t) / ng / 2 - 0.006);
      const prof: V2[] = [[gr * 0.92, 0], [gr, gh * 0.15], [gr * 0.95, gh * 0.32], [gr * 0.55, gh * 0.48], [gr * 0.1, gh * 0.55], [0.004, gh * 0.6], [0.004, gh * 0.93], [gr * 0.85, gh * 0.96], [gr * 0.85, gh], [0, gh]];
      for (let i = 0; i < ng; i++) {
        for (let j = 0; j < nz && left > 0; j++) {
          const z = -d / 2 + 0.03 + gr + ((j + 0.5) * (d - 0.06 - 2 * gr)) / nz;
          parts.push(lathe('glasses', [(gx[i] + gx[i + 1]) / 2, yT - 0.018 - gh, z], prof, { segments: 18, plan: false }));
          left--;
        }
      }
    }
    return parts;
  },
  planDetail: ({ w, d }) => [rectPoly(-w / 2 + 0.022, -d / 2, w / 2 - 0.022, d / 2)],
});

const bookLadderLibrary = defineItem({
  id: 'book-ladder-library',
  name: 'Library shelving with rolling ladder',
  category: 'living',
  type: 'storage',
  group: 'Bookcases & shelves',
  tags: ['library', 'rolling ladder', 'brass rail', 'bookcase', 'books', 'home library'],
  defaultSize: { w: 2.4, d: 0.62, h: 2.5 },
  minSize: { w: 1.4, d: 0.55, h: 2.0 },
  maxSize: { w: 4.0, d: 0.8, h: 2.7 },
  wallSnap: true,
  slots: [
    matSlot('wood', 'Bookcase & ladder', 'walnut-veneer'),
    matSlot('metal', 'Rail & hardware', 'metal-brass'),
    matSlot('books', 'Books', 'book-mix'),
    matSlot('decor', 'Ornaments', 'speckled-stoneware'),
  ],
  build: ({ w, d, h }) => {
    const sd = clamp(d - 0.25, 0.3, 0.42);
    const zb = -d / 2;
    const zf = zb + sd;
    const t = 0.024;
    const plinth = 0.09;
    const crown = 0.07;
    const yTop = h - crown;
    const nc = clamp(Math.round(w / 0.85), 2, 5);
    const xi: V2 = [-w / 2 + t, w / 2 - t];
    const colB = range(nc + 1).map((i) => xi[0] + (i * (xi[1] - xi[0])) / nc);
    const parts: Part[] = [
      span('wood', [-w / 2, -w / 2 + t], [0, yTop], [zb, zf]),
      span('wood', [w / 2 - t, w / 2], [0, yTop], [zb, zf]),
      span('wood', xi, [yTop, yTop + 0.03], [zb, zf - 0.012], NP),
      span('wood', [-w / 2, w / 2], [yTop + 0.03, h], [zb, zf + 0.015], { bevel: 0.006 }),
      span('wood', xi, [0, plinth], [zb, zf - 0.02], NP),
      span('wood', xi, [plinth, plinth + t], [zb, zf], NP),
      span('wood', xi, [plinth + t, yTop], [zb, zb + 0.008], NP),
    ];
    for (let i = 1; i < nc; i++) parts.push(span('wood', [colB[i] - t / 2, colB[i] + t / 2], [plinth + t, yTop], [zb + 0.008, zf - 0.004], NP));
    const y0u = plinth + t;
    const nr = clamp(Math.round((yTop - y0u) / 0.33), 5, 7);
    const rh = (yTop - y0u) / nr;
    for (let r = 1; r < nr; r++) parts.push(span('wood', xi, [y0u + r * rh - t / 2, y0u + r * rh + t / 2], [zb + 0.008, zf - 0.004], NP));
    // Brass rail with standoffs.
    const yR = yTop - 0.07;
    const zR = zf + 0.045;
    parts.push(rodX('metal', -w / 2 + 0.03, w / 2 - 0.03, yR, zR, 0.012, NP));
    for (const sx of [-1, 1]) parts.push(sphere('metal', [sx * (w / 2 - 0.03), yR, zR], 0.017, NP));
    for (const x of spaced(nc + 1, -w / 2 + 0.06, w / 2 - 0.06)) parts.push(rodZ('metal', x, yR, zf, zR, 0.007, NP));
    // Rolling ladder hooked over the rail.
    const lx = -w / 2 + w * 0.3;
    const lw = 0.42;
    const zBot = d / 2 - 0.04;
    const yBot = 0.05;
    const zTopL = zR + 0.02;
    const yTopL = yR - 0.01;
    const zAt = (y: number) => zBot + ((zTopL - zBot) * (y - yBot)) / (yTopL - yBot);
    const len = Math.hypot(yTopL - yBot, zTopL - zBot);
    const tilt = Math.atan2(zTopL - zBot, yTopL - yBot);
    for (const sx of [lx - lw / 2, lx + lw / 2]) {
      parts.push(box('wood', [sx, (yBot + yTopL) / 2, (zBot + zTopL) / 2], [0.028, len, 0.06], { rotation: [tilt, 0, 0], plan: false }));
      parts.push(torus('metal', [sx, yR + 0.004, zR], 0.017, 0.004, { rotation: [0, Math.PI / 2, 0], plan: false }));
      parts.push(cyl('metal', [sx, 0.03, zBot], 0.03, 0.02, { rotation: [0, 0, Math.PI / 2], plan: false }));
    }
    for (let y = 0.27; y < yTopL - 0.15; y += 0.28) parts.push(rodX('wood', lx - lw / 2 + 0.012, lx + lw / 2 - 0.012, y, zAt(y), 0.014, NP));
    const rand = rng(1001 + nc);
    const zones: Zone[] = [];
    for (let r = 0; r < nr; r++) {
      for (let c = 0; c < nc; c++) {
        const x0 = colB[c] + (c > 0 ? t / 2 : 0);
        const x1 = colB[c + 1] - (c < nc - 1 ? t / 2 : 0);
        const y0 = y0u + r * rh + (r ? t / 2 : 0);
        zones.push({
          x: [x0 + 0.01, x1 - 0.01],
          y0,
          clear: y0u + (r + 1) * rh - (r < nr - 1 ? t / 2 : 0) - y0 - 0.012,
          z: [zb + 0.012, zf - 0.012],
          seed: 1101 + r * 31 + c * 11,
          kinds: rand() < 0.75 ? ['books', 'books', 'books', 'stack'] : ['books', 'vase', 'frame', 'bowl', 'stack'],
        });
      }
    }
    return [...parts, ...dressZones({ books: 'books', decor: 'decor', frames: 'wood' }, zones, MAXP - parts.length)];
  },
  planDetail: ({ w, d }) => {
    const zf = -d / 2 + clamp(d - 0.25, 0.3, 0.42);
    const lx = -w / 2 + w * 0.3;
    return [line([-w / 2 + 0.03, zf + 0.045], [w / 2 - 0.03, zf + 0.045]), rectPoly(lx - 0.21, zf + 0.06, lx + 0.21, d / 2 - 0.01)];
  },
});

// ---------------------------------------------------------------------------
// Decor, bathroom, office, storage, kids, laundry
// ---------------------------------------------------------------------------

const plantStandTiered = defineItem({
  id: 'plant-stand-tiered',
  name: 'Tiered plant stand',
  category: 'plants',
  type: 'plants',
  group: 'Indoor plants',
  plant: PLANT_SPECIES['tiered-stand-mix'],
  tags: ['plant stand', 'plant ladder', 'tiered', 'pots', 'houseplants', 'plant shelf'],
  description: 'An oak tiered plant stand with terracotta pots of pothos, a baby rubber plant and a snake plant.',
  defaultSize: { w: 0.8, d: 0.35, h: 0.9 },
  minSize: { w: 0.45, d: 0.25, h: 0.5 },
  maxSize: { w: 1.4, d: 0.5, h: 1.4 },
  slots: [
    matSlot('stand', 'Stand', 'oak-veneer'),
    matSlot('pots', 'Pots', 'terracotta-pot'),
    matSlot('plants', 'Plants', 'plant-leaf'),
  ],
  build: ({ w, d, h }) => {
    const nt = clamp(Math.round(h / 0.3), 2, 4);
    const r = 0.014;
    const sd = (d - 0.04) / nt;
    const yTop = h * 0.56;
    const ys = range(nt).map((k) => h * 0.14 + (k * (yTop - h * 0.14)) / (nt - 1));
    const zf = (k: number) => d / 2 - 0.02 - k * sd;
    const xs = [-w / 2 + 0.025, w / 2 - 0.025];
    const parts: Part[] = [];
    for (let k = 0; k < nt; k++) {
      parts.push(...slats('stand', [-w / 2 + 0.01, w / 2 - 0.01], [ys[k] - 0.02, ys[k]], [zf(k) - sd + 0.006, zf(k)], 3, { axis: 'z', gap: 0.2, bevel: 0.003 }));
      for (const x of xs) {
        parts.push(vcyl('stand', x, zf(k) - r - 0.004, 0, ys[k] - 0.02, r, NP));
        parts.push(rodZ('stand', x, ys[k] - 0.02 - r, zf(k) - 0.004, -d / 2 + 0.02 + r, r, NP));
      }
    }
    for (const x of xs) parts.push(vcyl('stand', x, -d / 2 + 0.02 + r, 0, ys[nt - 1] - 0.02, r, NP));
    const np = clamp(Math.floor((w - 0.06) / 0.2), 1, 6);
    const cellW = (w - 0.06) / np;
    let left = MAXP - parts.length;
    let pots = np * nt;
    const rand = rng(1201 + np * 5 + nt);
    for (let k = 0; k < nt; k++) {
      for (let i = 0; i < np; i++) {
        const per = Math.floor(left / pots--);
        const cx = -w / 2 + 0.03 + (i + 0.5) * cellW;
        const cz = zf(k) - sd / 2;
        const room = h - ys[k] - 0.01;
        const pr = Math.min(0.075, sd / 2 - 0.012, cellW / 2 - 0.012) * lerp(0.75, 1, rand());
        if (pr < 0.025 || per < 4) continue;
        const style = k === 0 && rand() < 0.4 && per >= 12 ? 'trail' : (['bush', 'upright', 'rosette'] as const)[Math.floor(rand() * 3)];
        const ph = Math.min(pr * lerp(1.3, 1.9, rand()), room * 0.4);
        const rf = Math.min(cellW / 2 - 0.004, sd / 2 + 0.012);
        const ps: Part[] = [pot('pots', [cx, ys[k], cz], pr, style === 'rosette' ? ph * 0.7 : ph, style === 'rosette' ? 'bowl' : style === 'upright' ? 'cylinder' : 'taper', NP)];
        const fy = ys[k] + ph * 0.88;
        const fh = Math.min(room - ph * 0.88, style === 'upright' ? lerp(0.25, 0.42, rand()) : lerp(0.15, 0.3, rand()));
        const n = clamp(per - 1, 3, 11);
        if (style === 'trail') {
          ps.push(...foliage('plants', [cx, fy, cz], pr * 1.2, Math.min(fh, 0.1), 4, Math.floor(rand() * 1e5), { spread: 0.9 }));
          for (const dx of [-pr * 0.5, pr * 0.5]) {
            ps.push(...vine('plants', [cx + dx, ys[k] + ph, cz + pr * 0.7], ys[k] + 0.005, d / 2 - 0.012, Math.max(0.05, ys[k] - lerp(0.12, 0.3, rand())), (rand() - 0.5) * 0.04, Math.floor(rand() * 1e5), Math.max(2, Math.floor((per - 7) / 2) - 3)));
          }
        } else if (style === 'rosette') {
          ps.push(...foliage('plants', [cx, ys[k] + ph * 0.6, cz], Math.min(rf, pr * 1.3), Math.min(fh, 0.1), n, Math.floor(rand() * 1e5), { spread: 1, leafWid: pr * 0.45 }));
        } else {
          ps.push(...foliage('plants', [cx, fy, cz], style === 'upright' ? pr * 1.2 : rf, fh, n, Math.floor(rand() * 1e5), style === 'upright' ? { spread: 0.12, leafWid: pr * 0.35 } : { spread: lerp(0.5, 0.85, rand()) }));
        }
        if (ps.length > left) continue;
        parts.push(...ps);
        left -= ps.length;
      }
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const nt = 3;
    const sd = (d - 0.04) / nt;
    return range(nt - 1).map((k) => line([-w / 2 + 0.01, d / 2 - 0.02 - (k + 1) * sd], [w / 2 - 0.01, d / 2 - 0.02 - (k + 1) * sd]));
  },
});

const overToiletShelf = defineItem({
  id: 'over-toilet-shelf',
  name: 'Over-toilet shelf unit',
  category: 'bathroom',
  type: 'storage',
  group: 'Bookcases & shelves',
  tags: ['over the toilet', 'space saver', 'bathroom shelf', 'towels', 'toiletries', 'etagere'],
  defaultSize: { w: 0.65, d: 0.26, h: 1.75 },
  minSize: { w: 0.55, d: 0.2, h: 1.4 },
  maxSize: { w: 0.9, d: 0.35, h: 2.0 },
  wallSnap: true,
  slots: [
    matSlot('frame', 'Frame', 'wood-painted-white'),
    matSlot('towels', 'Towels', 'terry-towel'),
    matSlot('decor', 'Jars & bottles', 'speckled-stoneware'),
  ],
  build: ({ w, d, h }) => {
    const leg = 0.03;
    const st = 0.02;
    const yb = Math.min(0.95, h - 0.5);
    const ns = clamp(Math.round((h - yb) / 0.3) + 1, 2, 4);
    const ys = range(ns).map((i) => yb + (i * (h - st - yb)) / (ns - 1));
    const parts: Part[] = [];
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const x0 = sx < 0 ? -w / 2 : w / 2 - leg;
        const z0 = sz < 0 ? -d / 2 : d / 2 - leg;
        parts.push(span('frame', [x0, x0 + leg], [0, h], [z0, z0 + leg]));
      }
      const xr = sx < 0 ? -w / 2 : w / 2 - leg;
      parts.push(span('frame', [xr, xr + leg], [0.1, 0.13], [-d / 2 + leg, d / 2 - leg], NP));
    }
    ys.forEach((y, i) => {
      parts.push(span('frame', [-w / 2 + 0.002, w / 2 - 0.002], [y, y + st], [-d / 2 + 0.002, d / 2 - 0.002], { bevel: 0.003 }));
      if (i < ns - 1) parts.push(span('frame', [-w / 2 + leg, w / 2 - leg], [y + st + 0.03, y + st + 0.05], [-d / 2 + 0.004, -d / 2 + leg - 0.004], NP));
    });
    parts.push(rodX('frame', -w / 2 + leg, w / 2 - leg, yb - 0.06, d / 2 - 0.022, 0.009, NP));
    parts.push(...hangTowel('towels', [-w * 0.2, w * 0.2], yb - 0.06, d / 2 - 0.022, 0.009, Math.min(0.4, yb - 0.08), 0.75));
    const zones: Zone[] = range(ns - 1).map((i) => ({
      x: [-w / 2 + leg + 0.008, w / 2 - leg - 0.008],
      y0: ys[i] + st,
      clear: ys[i + 1] - ys[i] - st - 0.012,
      z: [-d / 2 + leg, d / 2 - 0.008],
      seed: 1301 + i * 17,
      kinds: ['towels', 'rolls', 'bottles', 'jar', 'vase', 'towels', 'bowl'],
    }));
    return [...parts, ...dressZones({ towels: 'towels', decor: 'decor' }, zones, MAXP - parts.length)];
  },
  planDetail: ({ w, d }) => [rectPoly(-w / 2 + 0.03, -d / 2 + 0.03, w / 2 - 0.03, d / 2 - 0.03)],
});

const bathWallShelf = defineItem({
  id: 'bath-wall-shelf',
  name: 'Bathroom wall shelf with towels',
  category: 'bathroom',
  type: 'storage',
  group: 'Bookcases & shelves',
  tags: ['towel shelf', 'towel rail', 'hotel shelf', 'bathroom', 'rolled towels', 'wall shelf'],
  mount: 'wall',
  defaultElevation: 1.15,
  defaultSize: { w: 0.7, d: 0.25, h: 0.45 },
  minSize: { w: 0.4, d: 0.18, h: 0.3 },
  maxSize: { w: 1.2, d: 0.32, h: 0.7 },
  slots: [
    matSlot('shelf', 'Shelf', 'oak-veneer'),
    matSlot('rail', 'Brackets & rail', 'metal-chrome'),
    matSlot('towels', 'Towels', 'terry-towel'),
    matSlot('decor', 'Bottles & jars', 'speckled-stoneware'),
  ],
  build: ({ w, d, h }) => {
    const st = 0.025;
    const shelfY = clamp(h * 0.55, 0.16, h - 0.12);
    const barY = shelfY - 0.075;
    const zBar = d / 2 - 0.03;
    const rb = 0.009;
    const xe = w / 2 - 0.05;
    const parts: Part[] = [span('shelf', [-w / 2, w / 2], [shelfY, shelfY + st], [-d / 2, d / 2], { bevel: 0.004 })];
    for (const x of [-xe, xe]) {
      parts.push(
        span('rail', [x - 0.012, x + 0.012], [shelfY - 0.12, shelfY], [-d / 2, -d / 2 + 0.008]),
        rodZ('rail', x, shelfY - 0.008, -d / 2 + 0.008, d / 2 - 0.03, 0.006, NP),
        rod('rail', [x, shelfY - 0.1, -d / 2 + 0.008], [x, barY, zBar], 0.005, NP),
        sphere('rail', [x, barY, zBar], rb * 1.3, NP),
      );
    }
    parts.push(rodX('rail', -xe, xe, barY, zBar, rb, NP));
    const drop = barY - 0.01;
    if (w >= 0.6) {
      const g = 0.02;
      parts.push(...hangTowel('towels', [-xe + 0.03, -g / 2], barY, zBar, rb, drop, 0.7));
      parts.push(...hangTowel('towels', [g / 2, xe - 0.03], barY, zBar, rb, drop * 0.82, 0.7));
    } else {
      parts.push(...hangTowel('towels', [-xe + 0.03, xe - 0.03], barY, zBar, rb, drop, 0.7));
    }
    const zone: Zone = {
      x: [-w / 2 + 0.02, w / 2 - 0.02],
      y0: shelfY + st,
      clear: h - shelfY - st - 0.008,
      z: [-d / 2 + 0.01, d / 2 - 0.01],
      seed: 1401,
      kinds: ['rolls', 'towels', 'bottles', 'jar', 'rolls', 'vase'],
    };
    return [...parts, ...fillShelf({ towels: 'towels', decor: 'decor', caps: 'rail' }, zone, MAXP - parts.length)];
  },
  planDetail: ({ w, d }) => [line([-w / 2 + 0.05, d / 2 - 0.03], [w / 2 - 0.05, d / 2 - 0.03])],
});

const showerCaddy = defineItem({
  id: 'shower-caddy',
  name: 'Shower corner caddy',
  category: 'bathroom',
  type: 'plumbing',
  group: 'Bathroom accessories',
  tags: ['shower caddy', 'corner shelf', 'wire basket', 'shampoo', 'toiletries', 'shower'],
  mount: 'wall',
  defaultElevation: 1.1,
  defaultSize: { w: 0.25, d: 0.25, h: 0.6 },
  minSize: { w: 0.18, d: 0.18, h: 0.35 },
  maxSize: { w: 0.4, d: 0.4, h: 1.0 },
  slots: [
    matSlot('caddy', 'Wire caddy', 'metal-chrome'),
    matSlot('bottles', 'Bottles', 'plastic-white'),
    matSlot('accents', 'Caps, soap & sponge', 'toy-coral'),
  ],
  build: ({ w, d, h }) => {
    const nt = clamp(Math.round(h / 0.26), 2, 4);
    const wr = 0.0032;
    const cx = -w / 2 + 0.012;
    const cz = -d / 2 + 0.012;
    const rx = w - 0.026;
    const rz = d - 0.026;
    const rimH = 0.045;
    const yb = range(nt).map((k) => 0.012 + (k * (h - rimH - 0.03 - 0.012)) / (nt - 1));
    const at = (f: number, a: number, y: number): V3 => [cx + rx * f * Math.cos(a), y, cz + rz * f * Math.sin(a)];
    const arc = (f: number, y: number): V3[] => range(5).map((i) => at(f, (i / 4) * (Math.PI / 2), y));
    const parts: Part[] = [vcyl('caddy', cx, cz, 0, h, 0.007)];
    for (const y of yb) {
      parts.push(
        ...rodPath('caddy', arc(1, y), wr),
        ...rodPath('caddy', arc(1, y + rimH), wr),
        ...rodPath('caddy', arc(0.55, y), wr),
        rodX('caddy', cx, cx + rx, y, cz, wr, NP),
        rodZ('caddy', cx, y, cz, cz + rz, wr, NP),
        rodX('caddy', cx, cx + rx, y + rimH, cz, wr, NP),
        rodZ('caddy', cx, y + rimH, cz, cz + rz, wr, NP),
        discZ('caddy', [cx + rx * 0.45, y + rimH * 0.6, -d / 2 + 0.004], 0.018, 0.008, NP),
      );
      for (let i = 1; i < 4; i++) {
        const a = (i / 4) * (Math.PI / 2);
        parts.push(rod('caddy', at(1, a, y), at(1, a, y + rimH), wr, NP), rod('caddy', [cx, y, cz], at(1, a, y), wr, NP));
      }
    }
    const rand = rng(1501 + nt);
    const br = Math.min(0.032, rx * 0.18, rz * 0.18);
    const spots: [number, number][] = [
      [0.6, 0.28],
      [0.62, 0.78],
      [0.55, 1.28],
    ];
    let left = MAXP - parts.length;
    yb.forEach((y, k) => {
      const clear = (k < nt - 1 ? yb[k + 1] : h) - y - 0.016;
      const y0 = y + wr;
      if (clear < 0.08) {
        if (left >= 4) {
          const [px, , pz] = at(0.5, 0.5, y0);
          parts.push(cushion('accents', [px - 0.035, px + 0.035], [y0, y0 + 0.022], [pz - 0.022, pz + 0.022], { softness: 0.4, plan: false }));
          left--;
        }
        return;
      }
      spots.forEach(([f, a], i) => {
        if (left < 4) return;
        const [px, , pz] = at(f, a, y0);
        const hh = Math.min(clear - 0.005, lerp(0.12, 0.2, rand()));
        const kind = (k + i) % 3;
        const ps =
          kind === 0
            ? pumpBottle('bottles', 'accents', px, pz, y0, br, hh)
            : kind === 1
              ? squeezeTube('bottles', 'accents', px, pz, y0, br * 0.85, hh * 0.85)
              : [vessel('bottles', px, pz, y0, br, hh * 0.9, 'cylinder'), vcyl('accents', px, pz, y0 + hh * 0.9, y0 + hh, br * 0.6, NP)];
        parts.push(...ps);
        left -= ps.length;
      });
    });
    if (left >= 4) {
      const [px, , pz] = at(0.32, 0.8, yb[0] + wr);
      const sr = Math.min(0.035, rx * 0.16);
      parts.push(...range(4).map((i) => sphere('accents', [px + Math.cos(i * 1.7) * sr * 0.35, yb[0] + wr + sr * (0.7 + (i % 2) * 0.25), pz + Math.sin(i * 1.7) * sr * 0.35], sr * 0.62, NP)));
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const cx = -w / 2 + 0.012;
    const cz = -d / 2 + 0.012;
    return [
      poly([[cx, cz], ...range(9).map((i) => {
        const a = (i / 8) * (Math.PI / 2);
        return [cx + (w - 0.026) * Math.cos(a), cz + (d - 0.026) * Math.sin(a)] as V2;
      })]),
    ];
  },
});

const pegboard = defineItem({
  id: 'pegboard',
  name: 'Pegboard organiser',
  category: 'office',
  type: 'storage',
  group: 'Office storage',
  tags: ['pegboard', 'wall organiser', 'desk organiser', 'hooks', 'craft', 'stationery'],
  mount: 'wall',
  defaultElevation: 1.0,
  defaultSize: { w: 0.9, d: 0.12, h: 0.6 },
  minSize: { w: 0.4, d: 0.08, h: 0.3 },
  maxSize: { w: 1.8, d: 0.2, h: 1.2 },
  slots: [
    matSlot('board', 'Pegboard', 'birch-pegboard'),
    matSlot('metal', 'Hooks & trays', 'powder-black'),
    matSlot('supplies', 'Stationery', 'plastic-mint'),
    matSlot('plants', 'Plants', 'plant-leaf'),
  ],
  build: ({ w, d, h }) => {
    const zf = -d / 2 + 0.024;
    const dd = Math.min(0.09, d / 2 - zf - 0.004);
    const parts: Part[] = [
      span('board', [-w / 2, w / 2], [0, h], [-d / 2 + 0.012, zf]),
      span('board', [-w / 2 + 0.03, w / 2 - 0.03], [0.03, h - 0.03], [-d / 2, -d / 2 + 0.012], NP),
      ...frame4('board', [-w / 2, w / 2], [0, h], [zf, zf + 0.006], 0.02),
    ];
    const nr = clamp(Math.round(h / 0.24), 1, 5);
    const bh = (h - 0.04) / nr;
    const rand = rng(1601 + nr * 3);
    const hook = (x: number, y: number, reach: number): Part[] =>
      rodPath('metal', [[x, y, zf], [x, y, zf + reach], [x, y + 0.018, zf + reach + 0.008]], 0.0028);
    let left = MAXP - parts.length;
    const types = ['shelf', 'cup', 'scissors', 'tape', 'basket', 'clip', 'plant'] as const;
    for (let r = 0; r < nr; r++) {
      const yh = h - 0.03 - r * bh;
      const yl = yh - bh + 0.03;
      const bandH = yh - yl;
      let budget = Math.floor(left / (nr - r));
      let x = -w / 2 + 0.04 + rand() * 0.05;
      for (let guard = 0; guard < 12; guard++) {
        const type = types[Math.floor(rand() * types.length)];
        const ps: Part[] = [];
        let mw = 0;
        if (type === 'shelf') {
          mw = lerp(0.2, 0.3, rand());
          if (x + mw > w / 2 - 0.04) break;
          ps.push(
            span('metal', [x, x + mw], [yl, yl + 0.005], [zf, zf + dd], NP),
            span('metal', [x, x + mw], [yl, yl + 0.03], [zf + dd - 0.004, zf + dd], NP),
            span('metal', [x, x + 0.004], [yl, yl + 0.06], [zf, zf + dd], NP),
            span('metal', [x + mw - 0.004, x + mw], [yl, yl + 0.06], [zf, zf + dd], NP),
          );
          const jr = Math.min(0.024, dd / 2 - 0.006);
          const jh = Math.min(bandH - 0.02, 0.1);
          ps.push(vcyl('supplies', x + 0.01 + jr, zf + dd / 2, yl + 0.005, yl + jh, jr, { segments: 18, plan: false }));
          ps.push(vcyl('metal', x + 0.01 + jr, zf + dd / 2, yl + jh, yl + jh + 0.01, jr * 1.05, NP));
          const px = x + mw - 0.01 - jr * 1.2;
          ps.push(pot('supplies', [px, yl + 0.005, zf + dd / 2], jr * 1.1, Math.min(0.06, jh * 0.6), 'cylinder', NP));
          ps.push(...foliage('plants', [px, yl + 0.05, zf + dd / 2], Math.min(jr * 1.6, dd / 2 - 0.004), Math.min(0.1, bandH - 0.06), 6, Math.floor(rand() * 1e5), { spread: 0.7 }));
        } else if (type === 'cup') {
          mw = 0.08;
          if (x + mw > w / 2 - 0.04) break;
          const cr = Math.min(0.032, dd / 2 - 0.004);
          const ch = Math.min(0.1, bandH * 0.5);
          const cxm = x + mw / 2;
          const czm = zf + cr + 0.004;
          ps.push(vcyl('metal', cxm, czm, yl + 0.02, yl + 0.02 + ch, cr, { segments: 18, plan: false }));
          ps.push(...hook(cxm, yl + 0.02 + ch * 0.8, 0.004));
          for (let i = 0; i < 4; i++) {
            const a = i * 1.6 + rand();
            ps.push(rod('supplies', [cxm + Math.cos(a) * cr * 0.4, yl + 0.04, czm + Math.sin(a) * cr * 0.4], [cxm + Math.cos(a) * cr * 0.7, Math.min(yh - 0.01, yl + 0.02 + ch + 0.07), czm + Math.sin(a) * cr * 0.7], 0.004, NP));
          }
        } else if (type === 'scissors') {
          mw = 0.08;
          if (x + mw > w / 2 - 0.04) break;
          const cxm = x + mw / 2;
          const hy = yh - 0.03;
          ps.push(...hook(cxm, hy, 0.04));
          const zz = zf + 0.03;
          ps.push(torus('supplies', [cxm - 0.012, hy - 0.025, zz], 0.014, 0.004, { plan: false }));
          ps.push(torus('supplies', [cxm + 0.012, hy - 0.025, zz], 0.014, 0.004, { plan: false }));
          const bl = Math.min(0.1, bandH - 0.08);
          ps.push(box('metal', [cxm - 0.004, hy - 0.04 - bl / 2, zz], [0.008, bl, 0.002], { rotation: [0, 0, 0.06], plan: false }));
          ps.push(box('metal', [cxm + 0.004, hy - 0.04 - bl / 2, zz + 0.002], [0.008, bl, 0.002], { rotation: [0, 0, -0.06], plan: false }));
        } else if (type === 'tape') {
          mw = 0.09;
          if (x + mw > w / 2 - 0.04) break;
          const cxm = x + mw / 2;
          const hy = yh - 0.03;
          ps.push(...hook(cxm, hy, 0.05));
          ps.push(torus('supplies', [cxm, hy - 0.025, zf + 0.04], 0.022, 0.009, { plan: false }));
          ps.push(span('metal', [cxm - 0.012, cxm + 0.012], [Math.max(yl, hy - 0.06 - Math.min(0.15, bandH * 0.6)), hy - 0.06], [zf + 0.002, zf + 0.004], NP));
        } else if (type === 'basket') {
          mw = lerp(0.2, 0.28, rand());
          if (x + mw > w / 2 - 0.04) break;
          const bhh = Math.min(0.08, bandH * 0.4);
          const z1 = zf + dd;
          ps.push(span('metal', [x, x + mw], [yl, yl + 0.004], [zf, z1], NP));
          ps.push(rodX('metal', x, x + mw, yl + bhh, z1, 0.0025, NP));
          ps.push(rodZ('metal', x, yl + bhh, zf, z1, 0.0025, NP), rodZ('metal', x + mw, yl + bhh, zf, z1, 0.0025, NP));
          for (const f of [0, 0.33, 0.66, 1]) ps.push(rod('metal', [x + f * mw, yl, z1], [x + f * mw, yl + bhh, z1], 0.0022, NP));
          let nx = x + 0.01;
          for (let i = 0; i < 3 && nx < x + mw - 0.03; i++) {
            const nw = lerp(0.015, 0.03, rand());
            ps.push(span('supplies', [nx, nx + nw], [yl + 0.004, yl + Math.min(bandH - 0.01, bhh + lerp(0.03, 0.08, rand()))], [zf + 0.006, z1 - 0.008], NP));
            nx += nw + 0.004;
          }
        } else if (type === 'clip') {
          mw = lerp(0.13, 0.18, rand());
          if (x + mw > w / 2 - 0.04) break;
          ps.push(span('supplies', [x, x + mw], [yl + 0.01, yh - 0.02], [zf + 0.004, zf + 0.009], NP));
          ps.push(span('board', [x + 0.012, x + mw - 0.012], [yl + 0.02, yh - 0.04], [zf + 0.009, zf + 0.011], NP));
          ps.push(span('metal', [x + mw / 2 - 0.03, x + mw / 2 + 0.03], [yh - 0.045, yh - 0.025], [zf + 0.009, zf + 0.016], NP));
        } else {
          mw = 0.14;
          if (x + mw > w / 2 - 0.04 || bandH < 0.14) continue;
          const cxm = x + mw / 2;
          const pr = Math.min(0.04, dd / 2 - 0.004);
          const czm = zf + pr + 0.006;
          const py = yl + Math.min(0.08, bandH * 0.4);
          ps.push(ring('metal', [cxm, py + pr * 0.9, czm], pr * 1.02, 0.003, { plan: false }));
          ps.push(rod('metal', [cxm, py + pr * 0.9, zf], [cxm, py + pr * 0.9, czm - pr], 0.003, NP));
          ps.push(pot('supplies', [cxm, py, czm], pr, pr * 1.1, 'belly', NP));
          ps.push(...foliage('plants', [cxm, py + pr, czm], Math.min(pr * 1.4, mw / 2), Math.min(0.08, yh - py - pr - 0.01), 5, Math.floor(rand() * 1e5), { spread: 0.9 }));
          if (py - 0.06 > 0.03) ps.push(...vine('plants', [cxm + pr * 0.3, py + pr * 1.05, czm + pr * 0.7], py, czm + pr + 0.006, Math.max(0.03, py - lerp(0.08, 0.2, rand())), 0.02, Math.floor(rand() * 1e5), 4));
        }
        if (ps.length > budget) break;
        parts.push(...ps);
        budget -= ps.length;
        left -= ps.length;
        x += mw + lerp(0.03, 0.1, rand());
      }
    }
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w / 2, -d / 2 + 0.024], [w / 2, -d / 2 + 0.024])],
});

const officeShelving = defineItem({
  id: 'office-shelving',
  name: 'Office shelving with binders',
  category: 'office',
  type: 'storage',
  group: 'Office storage',
  tags: ['office shelving', 'binders', 'lever arch files', 'magazine files', 'archive', 'metal frame'],
  defaultSize: { w: 1.0, d: 0.4, h: 2.0 },
  minSize: { w: 0.6, d: 0.3, h: 1.0 },
  maxSize: { w: 1.8, d: 0.5, h: 2.4 },
  wallSnap: true,
  slots: [
    matSlot('frame', 'Steel frame', 'powder-black'),
    matSlot('shelf', 'Shelves', 'oak-veneer'),
    matSlot('binders', 'Binders & files', 'binder-navy'),
    matSlot('books', 'Books & magazines', 'book-mix'),
  ],
  build: ({ w, d, h }) => {
    const p = 0.025;
    const st = 0.022;
    const ns = clamp(Math.round(h / 0.4), 3, 6);
    const ys = range(ns).map((k) => 0.05 + (k * (h - 0.05 - st)) / (ns - 1));
    const parts: Part[] = [];
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const x0 = sx < 0 ? -w / 2 : w / 2 - p;
        const z0 = sz < 0 ? -d / 2 : d / 2 - p;
        parts.push(span('frame', [x0, x0 + p], [0, h], [z0, z0 + p]));
      }
    }
    for (const y of ys) {
      parts.push(
        span('shelf', [-w / 2 + p, w / 2 - p], [y, y + st], [-d / 2 + 0.012, d / 2 - 0.004], { bevel: 0.002 }),
        span('frame', [-w / 2 + p, w / 2 - p], [y - 0.028, y], [d / 2 - 0.02, d / 2], NP),
        span('frame', [-w / 2 + p, w / 2 - p], [y - 0.028, y], [-d / 2, -d / 2 + 0.02], NP),
        span('frame', [-w / 2, -w / 2 + 0.02], [y - 0.028, y], [-d / 2 + p, d / 2 - p], NP),
        span('frame', [w / 2 - 0.02, w / 2], [y - 0.028, y], [-d / 2 + p, d / 2 - p], NP),
      );
    }
    const yA = ys[0];
    const yB = ys[ns - 1];
    parts.push(
      rod('frame', [-w / 2 + p, yA, -d / 2 + 0.006], [w / 2 - p, yB, -d / 2 + 0.006], 0.005, NP),
      rod('frame', [w / 2 - p, yA, -d / 2 + 0.006], [-w / 2 + p, yB, -d / 2 + 0.006], 0.005, NP),
    );
    for (const x of [-w / 2 + 0.006, w / 2 - 0.006]) {
      parts.push(rod('frame', [x, yA, -d / 2 + p], [x, yB, d / 2 - p], 0.005, NP), rod('frame', [x, yA, d / 2 - p], [x, yB, -d / 2 + p], 0.005, NP));
    }
    const zones: Zone[] = range(ns - 1).map((k) => ({
      x: [-w / 2 + p + 0.01, w / 2 - p - 0.01],
      y0: ys[k] + st,
      clear: ys[k + 1] - 0.028 - ys[k] - st - 0.008,
      z: [-d / 2 + 0.016, d / 2 - 0.022],
      seed: 1701 + k * 23,
      kinds: ['binders', 'binders', 'magazine', 'books', 'box', 'stack'],
    }));
    return [...parts, ...dressZones({ binders: 'binders', rings: 'frame', books: 'books', boxes: 'binders' }, zones, MAXP - parts.length)];
  },
  planDetail: ({ w, d }) => [line([-w / 2, -d / 2], [w / 2, d / 2]), line([-w / 2, d / 2], [w / 2, -d / 2])],
});

const metalUtilityShelving = defineItem({
  id: 'metal-utility-shelving',
  name: 'Metal utility shelving',
  category: 'storage',
  type: 'storage',
  group: 'Bookcases & shelves',
  tags: ['boltless shelving', 'garage shelving', 'steel rack', 'storage tubs', 'boxes', 'utility'],
  defaultSize: { w: 0.9, d: 0.45, h: 1.8 },
  minSize: { w: 0.6, d: 0.35, h: 0.9 },
  maxSize: { w: 1.8, d: 0.6, h: 2.1 },
  wallSnap: true,
  slots: [
    matSlot('frame', 'Steel frame', 'powder-grey'),
    matSlot('deck', 'Shelf decks', 'particleboard'),
    matSlot('tubs', 'Storage tubs & tape', 'clear-tub'),
    matSlot('cartons', 'Cardboard boxes', 'kraft-carton'),
  ],
  build: ({ w, d, h }) => {
    const p = 0.035;
    const tk = 0.003;
    const ns = clamp(Math.round(h / 0.42), 3, 6);
    const ys = range(ns).map((k) => 0.1 + (k * (h - 0.1)) / (ns - 1));
    const parts: Part[] = [];
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const xe = (sx * w) / 2;
        const ze = (sz * d) / 2;
        parts.push(span('frame', [Math.min(xe, xe - sx * p), Math.max(xe, xe - sx * p)], [0, h], [Math.min(ze, ze - sz * tk), Math.max(ze, ze - sz * tk)]));
        parts.push(span('frame', [Math.min(xe, xe - sx * tk), Math.max(xe, xe - sx * tk)], [0, h], [Math.min(ze, ze - sz * p), Math.max(ze, ze - sz * p)], NP));
      }
    }
    for (const y of ys) {
      parts.push(
        span('frame', [-w / 2 + tk, w / 2 - tk], [y - 0.04, y], [d / 2 - 0.014, d / 2 - tk], NP),
        span('frame', [-w / 2 + tk, w / 2 - tk], [y - 0.04, y], [-d / 2 + tk, -d / 2 + 0.014], NP),
        span('frame', [-w / 2 + tk, -w / 2 + 0.014], [y - 0.03, y], [-d / 2 + p, d / 2 - p], NP),
        span('frame', [w / 2 - 0.014, w / 2 - tk], [y - 0.03, y], [-d / 2 + p, d / 2 - p], NP),
        span('deck', [-w / 2 + 0.014, w / 2 - 0.014], [y - 0.016, y - 0.002], [-d / 2 + 0.014, d / 2 - 0.014]),
      );
    }
    const zones: Zone[] = range(ns - 1).map((k) => ({
      x: [-w / 2 + 0.02, w / 2 - 0.02],
      y0: ys[k] - 0.002,
      clear: ys[k + 1] - 0.04 - ys[k] - 0.008,
      z: [-d / 2 + 0.016, d / 2 - 0.016],
      seed: 1801 + k * 29,
      kinds: ['tub', 'carton', 'tub', 'carton'],
    }));
    return [...parts, ...dressZones({ tubs: 'tubs', cartons: 'cartons' }, zones, MAXP - parts.length)];
  },
  planDetail: ({ w, d }) => [line([-w / 2, d / 2 - 0.014], [w / 2, d / 2 - 0.014]), line([-w / 2, -d / 2 + 0.014], [w / 2, -d / 2 + 0.014])],
});

const wallCubbies = defineItem({
  id: 'wall-cubbies',
  name: 'Wall cubbies',
  category: 'storage',
  type: 'storage',
  group: 'Bookcases & shelves',
  tags: ['cubbies', 'cube shelf', 'wall boxes', 'baskets', 'grid shelf', 'display'],
  mount: 'wall',
  defaultElevation: 1.1,
  defaultSize: { w: 0.9, d: 0.3, h: 0.6 },
  minSize: { w: 0.3, d: 0.2, h: 0.3 },
  maxSize: { w: 1.8, d: 0.4, h: 1.2 },
  slots: [
    matSlot('frame', 'Cubbies', 'oak-veneer'),
    matSlot('baskets', 'Baskets', 'seagrass-weave'),
    matSlot('decor', 'Ceramics', 'speckled-stoneware'),
  ],
  build: ({ w, d, h }) => {
    const t = 0.018;
    const nc = clamp(Math.round(w / 0.3), 1, 6);
    const nr = clamp(Math.round(h / 0.3), 1, 4);
    const parts: Part[] = [
      span('frame', [-w / 2, w / 2], [h - t, h], [-d / 2, d / 2], { bevel: 0.002 }),
      span('frame', [-w / 2, w / 2], [0, t], [-d / 2, d / 2], { bevel: 0.002 }),
      span('frame', [-w / 2, -w / 2 + t], [t, h - t], [-d / 2, d / 2]),
      span('frame', [w / 2 - t, w / 2], [t, h - t], [-d / 2, d / 2]),
      span('frame', [-w / 2 + t, w / 2 - t], [t, h - t], [-d / 2, -d / 2 + 0.006], NP),
    ];
    const xb = range(nc + 1).map((i) => -w / 2 + t + (i * (w - 2 * t)) / nc);
    const yb = range(nr + 1).map((j) => t + (j * (h - 2 * t)) / nr);
    for (let i = 1; i < nc; i++) parts.push(span('frame', [xb[i] - t / 2, xb[i] + t / 2], [t, h - t], [-d / 2 + 0.006, d / 2], NP));
    for (let j = 1; j < nr; j++) parts.push(span('frame', [-w / 2 + t, w / 2 - t], [yb[j] - t / 2, yb[j] + t / 2], [-d / 2 + 0.006, d / 2], NP));
    const rand = rng(1901 + nc * 7 + nr);
    let left = MAXP - parts.length;
    const cellsN = nc * nr;
    let done = 0;
    for (let j = 0; j < nr; j++) {
      for (let i = 0; i < nc; i++) {
        const budget = Math.floor(left / (cellsN - done++));
        const x0 = xb[i] + (i ? t / 2 : 0);
        const x1 = xb[i + 1] - (i < nc - 1 ? t / 2 : 0);
        const y0 = yb[j] + (j ? t / 2 : 0);
        const y1 = yb[j + 1] - (j < nr - 1 ? t / 2 : 0);
        let ps: Part[];
        if (rand() < 0.45 && budget >= 2) {
          ps = basketParts('baskets', [x0 + 0.008, x1 - 0.008], y0, (y1 - y0) * lerp(0.62, 0.85, rand()), [-d / 2 + 0.01, d / 2 - 0.004], budget >= 4);
        } else {
          ps = fillShelf({ decor: 'decor', frames: 'frame' }, { x: [x0 + 0.01, x1 - 0.01], y0, clear: y1 - y0 - 0.01, z: [-d / 2 + 0.01, d / 2 - 0.008], seed: 1951 + i * 13 + j * 31, kinds: ['vase', 'bowl', 'stack', 'jar', 'frame'] }, budget);
        }
        parts.push(...ps);
        left -= ps.length;
      }
    }
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w / 2 + 0.018, -d / 2 + 0.006], [w / 2 - 0.018, -d / 2 + 0.006])],
});

const kidsCubbyShelf = defineItem({
  id: 'kids-cubby-shelf',
  name: 'Kids cubby shelf with bins',
  category: 'kids',
  type: 'kids',
  group: 'Kids furniture',
  tags: ['toy storage', 'cubby', 'fabric bins', 'playroom', 'toys', 'nursery'],
  defaultSize: { w: 1.05, d: 0.33, h: 0.75 },
  minSize: { w: 0.4, d: 0.28, h: 0.4 },
  maxSize: { w: 1.5, d: 0.4, h: 1.5 },
  wallSnap: true,
  slots: [
    matSlot('frame', 'Cubby frame', 'wood-painted-white'),
    matSlot('bins', 'Fabric bins', 'canvas-bin-sage'),
    matSlot('toys', 'Accent bins & toys', 'toy-coral'),
  ],
  build: ({ w, d, h }) => {
    const t = 0.018;
    const base = 0.04;
    const nc = clamp(Math.round(w / 0.36), 1, 4);
    const nr = clamp(Math.round((h - base) / 0.34), 1, 4);
    const parts: Part[] = [
      span('frame', [-w / 2, -w / 2 + t], [0, h - t], [-d / 2, d / 2]),
      span('frame', [w / 2 - t, w / 2], [0, h - t], [-d / 2, d / 2]),
      span('frame', [-w / 2, w / 2], [h - t, h], [-d / 2, d / 2], { bevel: 0.008 }),
      span('frame', [-w / 2 + t, w / 2 - t], [0, base], [-d / 2, d / 2 - 0.025], NP),
      span('frame', [-w / 2 + t, w / 2 - t], [base, base + t], [-d / 2, d / 2], NP),
      span('frame', [-w / 2 + t, w / 2 - t], [base + t, h - t], [-d / 2, -d / 2 + 0.006], NP),
    ];
    const xb = range(nc + 1).map((i) => -w / 2 + t + (i * (w - 2 * t)) / nc);
    const yb = range(nr + 1).map((j) => base + t + (j * (h - t - base - t)) / nr);
    for (let i = 1; i < nc; i++) parts.push(span('frame', [xb[i] - t / 2, xb[i] + t / 2], [base + t, h - t], [-d / 2 + 0.006, d / 2], NP));
    for (let j = 1; j < nr; j++) parts.push(span('frame', [-w / 2 + t, w / 2 - t], [yb[j] - t / 2, yb[j] + t / 2], [-d / 2 + 0.006, d / 2], NP));
    const rand = rng(2001 + nc + nr * 5);
    const z0 = -d / 2 + 0.012;
    const z1 = d / 2 - 0.012;
    let binIdx = 0;
    for (let j = 0; j < nr; j++) {
      for (let i = 0; i < nc; i++) {
        const x0 = xb[i] + (i ? t / 2 : 0);
        const x1 = xb[i + 1] - (i < nc - 1 ? t / 2 : 0);
        const y0 = yb[j] + (j ? t / 2 : 0);
        const ch = yb[j + 1] - (j < nr - 1 ? t / 2 : 0) - y0;
        const cx = (x0 + x1) / 2;
        const cz = (z0 + z1) / 2;
        if (rand() < 0.7) {
          const accent = binIdx++ % 3 === 1;
          const body = accent ? 'toys' : 'bins';
          const trim = accent ? 'bins' : 'toys';
          const bh = ch * lerp(0.8, 0.9, rand());
          parts.push(
            cushion(body, [x0 + 0.01, x1 - 0.01], [y0, y0 + bh - 0.03], [z0, z1], { softness: 0.12, plan: false }),
            span(body, [x0 + 0.006, x1 - 0.006], [y0 + bh - 0.035, y0 + bh], [z0 - 0.004, z1 + 0.004], { bevel: 0.006, plan: false }),
            torus(trim, [cx, y0 + bh - 0.05, z1 + 0.004], 0.022, 0.005, { arc: Math.PI, rotation: [0, 0, Math.PI], plan: false }),
          );
          continue;
        }
        const toy = Math.floor(rand() * 4);
        const room = Math.min(ch - 0.02, x1 - x0 - 0.02, z1 - z0);
        if (toy === 0) {
          const r = Math.min(0.08, room * 0.45);
          parts.push(sphere('toys', [cx - (x1 - x0) * 0.15, y0 + r, cz], r, NP), sphere('bins', [cx + (x1 - x0) * 0.2, y0 + r * 0.6, cz + 0.02], r * 0.6, NP));
        } else if (toy === 1) {
          const s = Math.min(0.07, room / 3.2);
          for (let k = 0; k < 3; k++) {
            parts.push(box(k % 2 ? 'bins' : 'toys', [cx + (rand() - 0.5) * 0.02, y0 + s * (k + 0.5), cz], [s, s, s], { rotation: [0, (rand() - 0.5) * 0.5, 0], plan: false }));
          }
          parts.push(box('toys', [cx + s * 1.4, y0 + s / 2, cz - s * 0.5], [s, s, s], { rotation: [0, 0.4, 0], plan: false }));
        } else if (toy === 2) {
          const r = Math.min(0.07, room / 4.2);
          parts.push(
            sphere('bins', [cx, y0 + r * 1.1, cz], r * 1.1, { scale: [1, 1, 0.85], plan: false }),
            sphere('bins', [cx, y0 + r * 2.9, cz], r * 0.8, NP),
            sphere('bins', [cx - r * 0.6, y0 + r * 3.5, cz], r * 0.3, NP),
            sphere('bins', [cx + r * 0.6, y0 + r * 3.5, cz], r * 0.3, NP),
            sphere('toys', [cx, y0 + r * 2.75, cz + r * 0.7], r * 0.25, NP),
          );
        } else {
          const r = Math.min(0.06, room / 3);
          parts.push(cyl('toys', [cx, y0 + 0.008, cz], r * 1.1, 0.016, NP), vcyl('toys', cx, cz, y0, y0 + Math.min(ch - 0.02, r * 2.4), 0.008, NP));
          for (let k = 0; k < 4; k++) parts.push(ring(k % 2 ? 'bins' : 'toys', [cx, y0 + 0.028 + k * r * 0.42, cz], r * (1 - k * 0.17), r * 0.18, { plan: false }));
        }
      }
    }
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w / 2 + 0.018, d / 2 - 0.012], [w / 2 - 0.018, d / 2 - 0.012])],
});

const laundryShelf = defineItem({
  id: 'laundry-shelf',
  name: 'Laundry shelf with hanging rail',
  category: 'laundry',
  type: 'storage',
  group: 'Bookcases & shelves',
  tags: ['laundry shelf', 'hanging rail', 'hangers', 'drying rail', 'baskets', 'utility room'],
  mount: 'wall',
  defaultElevation: 1.0,
  defaultSize: { w: 1.0, d: 0.32, h: 0.95 },
  minSize: { w: 0.6, d: 0.25, h: 0.6 },
  maxSize: { w: 2.0, d: 0.42, h: 1.2 },
  slots: [
    matSlot('shelf', 'Shelf', 'oak-veneer'),
    matSlot('rail', 'Brackets, rail & hangers', 'metal-chrome'),
    matSlot('baskets', 'Baskets', 'white-wicker'),
    matSlot('clothes', 'Clothes', 'fabric-sky'),
  ],
  build: ({ w, d, h }) => {
    const st = 0.025;
    const shelfY = h - clamp(h * 0.27, 0.18, 0.3);
    const railY = shelfY - 0.07;
    const zr = d / 2 - 0.06;
    const bx = w > 1.4 ? [-w / 2 + 0.08, 0, w / 2 - 0.08] : [-w / 2 + 0.08, w / 2 - 0.08];
    const parts: Part[] = [span('shelf', [-w / 2, w / 2], [shelfY, shelfY + st], [-d / 2, d / 2], { bevel: 0.004 })];
    for (const x of bx) {
      parts.push(
        span('rail', [x - 0.01, x + 0.01], [shelfY - 0.16, shelfY], [-d / 2, -d / 2 + 0.006]),
        rodZ('rail', x, shelfY - 0.006, -d / 2 + 0.006, d / 2 - 0.02, 0.006, NP),
        rod('rail', [x, shelfY - 0.15, -d / 2 + 0.006], [x, shelfY - 0.008, d / 2 - 0.06], 0.005, NP),
      );
      if (Math.abs(x) > 0.01) parts.push(rod('rail', [x, shelfY - 0.006, zr], [x, railY, zr], 0.005, NP));
    }
    parts.push(rodX('rail', bx[0], bx[bx.length - 1], railY, zr, 0.0125, NP));
    let left = MAXP - parts.length;
    // Shirts on hangers facing the room.
    const sw = 0.34;
    const n = clamp(Math.floor((w - 0.25) / 0.16), 1, 10);
    const L = Math.min(0.62, railY - 0.05);
    const xsS = spaced(n, -w / 2 + sw / 2 + 0.08, w / 2 - sw / 2 - 0.08);
    const rand = rng(2101 + n);
    xsS.forEach((x, i) => {
      if (left < 13 || L < 0.2) return;
      const z = zr - 0.006 + (i % 3) * 0.006;
      const yN = railY - 0.04;
      const bw = sw * lerp(0.86, 0.96, rand());
      const len = L * lerp(0.82, 1, rand());
      const sl = i % 2 ? 0.16 : Math.min(0.38, len * 0.7);
      parts.push(
        torus('rail', [x, railY + 0.004, zr], 0.016, 0.0025, { rotation: [0, Math.PI / 2, 0], plan: false }),
        rod('rail', [x, railY - 0.012, zr], [x, yN, z], 0.0025, NP),
        rod('rail', [x, yN, z], [x - sw / 2, yN - 0.045, z], 0.003, NP),
        rod('rail', [x, yN, z], [x + sw / 2, yN - 0.045, z], 0.003, NP),
        facePlate(
          'clothes',
          [
            [x - 0.065, yN],
            [x - sw / 2, yN - 0.045],
            [x - sw / 2 - 0.05, yN - sl],
            [x - bw / 2 - 0.005, yN - sl - 0.02],
            [x - bw / 2, yN - Math.max(0.2, sl - 0.02)],
            [x - bw / 2, yN - len],
            [x + bw / 2, yN - len],
            [x + bw / 2, yN - Math.max(0.2, sl - 0.02)],
            [x + bw / 2 + 0.005, yN - sl - 0.02],
            [x + sw / 2 + 0.05, yN - sl],
            [x + sw / 2, yN - 0.045],
            [x + 0.065, yN],
            [x, yN - 0.035],
          ],
          z + 0.004,
          0.006,
        ),
      );
      left -= 5;
    });
    const zone: Zone = { x: [-w / 2 + 0.02, w / 2 - 0.02], y0: shelfY + st, clear: h - shelfY - st - 0.008, z: [-d / 2 + 0.01, d / 2 - 0.01], seed: 2151, kinds: ['basket', 'towels', 'basket', 'towels'] };
    return [...parts, ...fillShelf({ baskets: 'baskets', towels: 'clothes' }, zone, left)];
  },
  planDetail: ({ w, d }) => [line([-w / 2 + 0.08, d / 2 - 0.06], [w / 2 - 0.08, d / 2 - 0.06])],
});

const hatShelf = defineItem({
  id: 'hat-shelf',
  name: 'Entry shelf with hooks',
  category: 'storage',
  type: 'storage',
  group: 'Hallway storage',
  tags: ['coat hooks', 'hat shelf', 'entryway', 'hallway', 'peg rail', 'bags'],
  mount: 'wall',
  defaultElevation: 1.3,
  defaultSize: { w: 0.9, d: 0.26, h: 0.62 },
  minSize: { w: 0.5, d: 0.18, h: 0.4 },
  maxSize: { w: 1.6, d: 0.32, h: 0.8 },
  slots: [
    matSlot('wood', 'Shelf & hook board', 'oak-veneer'),
    matSlot('hooks', 'Hooks', 'metal-brass'),
    matSlot('textiles', 'Hats & bags', 'felt-camel'),
    matSlot('baskets', 'Basket', 'seagrass-weave'),
  ],
  build: ({ w, d, h }) => {
    const st = 0.024;
    const shelfY = h - clamp(h * 0.35, 0.14, 0.26) - st;
    const hb0 = shelfY - 0.13;
    const zw = -d / 2;
    const zb = zw + 0.02;
    const hy = hb0 + 0.06;
    const parts: Part[] = [
      span('wood', [-w / 2, w / 2], [hb0, shelfY], [zw, zb], { bevel: 0.003 }),
      span('wood', [-w / 2, w / 2], [shelfY, shelfY + st], [zw, d / 2], { bevel: 0.004 }),
    ];
    const cb = (x: number): Part => {
      // Quarter-round corbel under the shelf.
      const pts: V2[] = [
        [zb, shelfY],
        ...range(7).map((i) => {
          const a = (i / 6) * (Math.PI / 2);
          return [zb + 0.12 * Math.cos(a), shelfY - 0.11 * Math.sin(a)] as V2;
        }),
      ];
      return sideProfile('wood', pts, x - 0.0125, x + 0.0125);
    };
    for (const x of w > 1.2 ? [-w / 2 + 0.06, 0, w / 2 - 0.06] : [-w / 2 + 0.06, w / 2 - 0.06]) parts.push(cb(x));
    const nh = clamp(Math.round((w - 0.1) / 0.14), 2, 10);
    const hx = spaced(nh, -w / 2 + 0.1, w / 2 - 0.1);
    for (const x of hx) {
      parts.push(discZ('hooks', [x, hy, zb + 0.003], 0.012, 0.006, NP));
      parts.push(...rodPath('hooks', [[x, hy, zb], [x, hy - 0.02, zb + 0.05], [x, hy + 0.008, zb + 0.07]], 0.004));
    }
    const rand = rng(2201 + nh);
    let left = MAXP - parts.length;
    hx.forEach((x, i) => {
      const roll = rand();
      if (roll < 0.3 || left < 8) return;
      const zz = zb + 0.055;
      if (roll < 0.55) {
        const drop = Math.min(0.3, hy - 0.13);
        const half = Math.min(0.13, x + w / 2 - 0.005, w / 2 - x - 0.005);
        if (drop < 0.08 || half < 0.07) return;
        parts.push(
          torus('textiles', [x, hy - 0.06, zz], 0.055, 0.005, { arc: Math.PI, plan: false }),
          span('textiles', [x - half, x + half], [hy - 0.07 - drop, hy - 0.06], [zz - 0.02, zz + 0.02], { bevel: 0.006, plan: false }),
        );
        left -= 2;
      } else if (roll < 0.8) {
        const len = Math.min(0.45, hy - 0.02);
        parts.push(
          box('textiles', [x - 0.035, hy - len / 2, zz + 0.012], [0.07, len, 0.012], { rotation: [0, 0, 0.05], plan: false }),
          box('textiles', [x + 0.03, hy - len * 0.42, zz + 0.026], [0.07, len * 0.84, 0.012], { rotation: [0, 0, -0.06], plan: false }),
          rodX('textiles', x - 0.05, x + 0.05, hy + 0.004, zz - 0.004, 0.012, NP),
        );
        left -= 3;
      } else {
        parts.push(
          sphere('textiles', [x, hy - 0.06, zz + 0.01], 0.07, { scale: [1, 0.75, 0.5], plan: false }),
          box('textiles', [x, hy - 0.115, zz + 0.04], [0.11, 0.008, 0.06], { rotation: [0.6, 0, 0], plan: false }),
        );
        left -= 2;
      }
      if (i === 0 && left > 4) {
        parts.push(torus('hooks', [x, hy - 0.012, zb + 0.07], 0.012, 0.0018, { plan: false }));
        parts.push(box('hooks', [x, hy - 0.04, zb + 0.07], [0.012, 0.045, 0.003], { rotation: [0, 0, 0.2], plan: false }));
        left -= 2;
      }
    });
    // On the shelf: a basket and felt hats.
    const clear = h - shelfY - st - 0.006;
    const D = d - 0.02;
    let x = -w / 2 + 0.03;
    const y0 = shelfY + st;
    while (x < w / 2 - 0.12 && left > 3) {
      if (rand() < 0.4) {
        const bw = Math.min(lerp(0.22, 0.3, rand()), w / 2 - 0.02 - x);
        if (bw < 0.14) break;
        parts.push(...basketParts('baskets', [x, x + bw], y0, Math.min(clear, 0.16), [zw + 0.02, zw + 0.02 + Math.min(D - 0.01, 0.26)]));
        left -= 2;
        x += bw + 0.03;
      } else {
        const r = Math.min(0.15, (D - 0.01) / 2, (w / 2 - 0.02 - x) / 2);
        if (r < 0.08) break;
        const cz = zw + 0.02 + r;
        const stack = clear > 0.16 && rand() < 0.4 ? 2 : 1;
        for (let k = 0; k < stack; k++) {
          const yb = y0 + k * 0.035;
          const ch = Math.min(0.11, clear - 0.012 - k * 0.035);
          parts.push(
            cyl('textiles', [x + r, yb + 0.004, cz], r * (1 - k * 0.04), 0.008, { segments: 32, plan: false }),
            lathe('textiles', [x + r, yb + 0.008, cz], [[r * 0.56, 0], [r * 0.58, ch * 0.2], [r * 0.52, ch * 0.85], [r * 0.3, ch], [0, ch * 0.94]], { segments: 24, plan: false }),
            cyl('wood', [x + r, yb + 0.022, cz], r * 0.575, 0.022, { segments: 24, plan: false }),
          );
          left -= 3;
        }
        x += 2 * r + 0.03;
      }
    }
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w / 2, -d / 2 + 0.02], [w / 2, -d / 2 + 0.02])],
});

// ---------------------------------------------------------------------------
// Patterns
// ---------------------------------------------------------------------------

const smooth = (t: number): number => t * t * (3 - 2 * t);
const smoothstep = (a: number, b: number, v: number): number => smooth(clamp((v - a) / (b - a), 0, 1));

/** Periodic value noise for a size×size tile with gx × gy lattice cells (wraps seamlessly). */
function noiseTile(size: number, gx: number, gy: number, rand: () => number): Float32Array {
  const g = Float32Array.from({ length: gx * gy }, () => rand());
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const fy = (y / size) * gy;
    const iy = Math.floor(fy);
    const ty = smooth(fy - iy);
    const y0 = (iy % gy) * gx;
    const y1 = ((iy + 1) % gy) * gx;
    for (let x = 0; x < size; x++) {
      const fx = (x / size) * gx;
      const ix = Math.floor(fx);
      const tx = smooth(fx - ix);
      const x0 = ix % gx;
      const x1 = (ix + 1) % gx;
      const a = g[y0 + x0] + (g[y0 + x1] - g[y0 + x0]) * tx;
      const b = g[y1 + x0] + (g[y1 + x1] - g[y1 + x0]) * tx;
      out[y * size + x] = a + (b - a) * ty;
    }
  }
  return out;
}

function paint(ctx: CanvasRenderingContext2D, size: number, f: (x: number, y: number, i: number) => number): void {
  const img = ctx.createImageData(size, size);
  for (let y = 0, i = 0; y < size; y++) {
    for (let x = 0; x < size; x++, i++) {
      const v = Math.round(clamp(f(x, y, i), 0, 1) * 255);
      const j = i * 4;
      img.data[j] = img.data[j + 1] = img.data[j + 2] = v;
      img.data[j + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

const PATTERNS: PackPattern[] = [
  {
    id: 'veneer-grain',
    name: 'Oak veneer grain',
    normalStrength: 0.35,
    // Straight-sliced veneer: meandering growth rings along x, fine fibres and open pores.
    draw(ctx, size, rand) {
      const warp = noiseTile(size, 2, 3, rand);
      const wob = noiseTile(size, 3, 12, rand);
      const fibre = noiseTile(size, 4, 96, rand);
      const pores = noiseTile(size, 24, 160, rand);
      const rings = 9;
      paint(ctx, size, (_x, y, i) => {
        const ph = (rings * y) / size + 1.6 * warp[i] + 0.35 * wob[i];
        const p = ph - Math.floor(ph);
        const late = smoothstep(0.5, 0.78, p) * (1 - smoothstep(0.82, 0.97, p));
        return 0.94 - 0.13 * late + 0.06 * (fibre[i] - 0.5) - (pores[i] > 0.7 ? (pores[i] - 0.7) * 0.3 : 0);
      });
    },
  },
  {
    id: 'powder-stipple',
    name: 'Powder-coat stipple',
    normalStrength: 0.3,
    // Fine orange-peel texture of a powder-coated or glazed surface.
    draw(ctx, size, rand) {
      const a = noiseTile(size, 32, 32, rand);
      const b = noiseTile(size, 96, 96, rand);
      paint(ctx, size, (_x, _y, i) => 0.9 + 0.07 * (a[i] - 0.5) + 0.05 * (b[i] - 0.5) + 0.03 * (rand() - 0.5));
    },
  },
  {
    id: 'basket-weave',
    name: 'Woven basket',
    normalStrength: 1.1,
    // Over-under plain weave of flat, slightly twisted seagrass strands.
    draw(ctx, size, rand) {
      const K = 8;
      const c = size / K;
      const tintH = Array.from({ length: K }, () => 0.88 + rand() * 0.12);
      const tintV = Array.from({ length: K }, () => 0.88 + rand() * 0.12);
      const fibH = noiseTile(size, 8, 64, rand);
      const fibV = noiseTile(size, 64, 8, rand);
      paint(ctx, size, (x, y, idx) => {
        const i = Math.floor(x / c);
        const j = Math.floor(y / c);
        const u = (x - i * c) / c;
        const v = (y - j * c) / c;
        const horiz = (i + j) % 2 === 0;
        const across = horiz ? v : u;
        const along = horiz ? u : v;
        if (Math.min(across, 1 - across) < 0.06) return 0.3;
        const round = 0.62 + 0.33 * Math.pow(Math.sin(Math.PI * across), 0.6);
        const dip = 1 - 0.22 * Math.pow(1 - Math.sin(Math.PI * along), 3);
        const twist = 0.03 * Math.sin((along * 2 + across) * Math.PI * 2);
        return round * dip * (horiz ? tintH[j] : tintV[i]) + 0.07 * ((horiz ? fibH[idx] : fibV[idx]) - 0.5) + twist;
      });
    },
  },
  {
    id: 'pegboard-holes',
    name: 'Pegboard holes',
    normalStrength: 0.9,
    // 8 × 8 grid of punched holes with a chamfered rim on a fibrous board.
    draw(ctx, size, rand) {
      const K = 8;
      const c = size / K;
      const hr = c * 0.17;
      const fib = noiseTile(size, 6, 40, rand);
      paint(ctx, size, (x, y, i) => {
        const dx = ((x + 0.5) % c) - c / 2;
        const dy = ((y + 0.5) % c) - c / 2;
        const dist = Math.hypot(dx, dy);
        const v = 0.9 + 0.06 * (fib[i] - 0.5) + 0.02 * (rand() - 0.5);
        if (dist < hr) return 0.1 + 0.1 * (dist / hr);
        if (dist < hr + c * 0.05) return v * 0.8;
        return v;
      });
    },
  },
];

export default definePack({
  name: 'Shelves & shelving',
  version: '1.0.0',
  author: 'Neest team',
  description:
    'Styled shelves for every room: floating, corner, pipe and grid wall shelves, bookcases (low, barrister, revolving, wall-to-wall, library with ladder), plus bathroom, office, utility, kids, laundry, wine and entry shelving, all dressed with books, plants and everyday things.',
  license: 'CC0 (made for Neest)',
  items: [
    floatingShelfSet,
    cornerShelf,
    pipeShelf,
    gridWallShelving,
    bookcaseLow,
    bookcaseBarrister,
    bookcaseRevolving,
    bookcaseWall,
    displayLedges,
    plantStandTiered,
    overToiletShelf,
    bathWallShelf,
    showerCaddy,
    pegboard,
    officeShelving,
    metalUtilityShelving,
    wallCubbies,
    kidsCubbyShelf,
    laundryShelf,
    wineShelfWall,
    bookLadderLibrary,
    hatShelf,
  ],
  patterns: PATTERNS,
  materials: [
    { id: 'oak-veneer', name: 'Oak veneer', category: 'wood', color: '#c99d6b', roughness: 0.55, pattern: { id: 'veneer-grain', scale: 0.8 } },
    { id: 'walnut-veneer', name: 'Walnut veneer', category: 'wood', color: '#6b4731', roughness: 0.5, pattern: { id: 'veneer-grain', scale: 0.8, contrast: 1.2 } },
    { id: 'reclaimed-pine', name: 'Reclaimed pine boards', category: 'wood', color: '#a7774c', roughness: 0.72, pattern: { id: 'veneer-grain', scale: 0.6, contrast: 1.5 } },
    { id: 'powder-black', name: 'Black powder-coat', category: 'metal', color: '#252629', roughness: 0.55, metalness: 0.4, pattern: { id: 'powder-stipple', scale: 0.3 } },
    { id: 'powder-grey', name: 'Grey hammertone steel', category: 'metal', color: '#6f757a', roughness: 0.5, metalness: 0.5, pattern: { id: 'powder-stipple', scale: 0.25, contrast: 1.4 } },
    { id: 'black-iron-pipe', name: 'Black iron pipe', category: 'metal', color: '#34312e', roughness: 0.45, metalness: 0.7, pattern: { id: 'powder-stipple', scale: 0.2, contrast: 1.3 } },
    { id: 'seagrass-weave', name: 'Seagrass weave', category: 'wood', color: '#b8955f', roughness: 0.9, pattern: { id: 'basket-weave', scale: 0.12 } },
    { id: 'white-wicker', name: 'White wicker', category: 'wood', color: '#e6dfcf', roughness: 0.85, pattern: { id: 'basket-weave', scale: 0.1 } },
    { id: 'speckled-stoneware', name: 'Speckled stoneware', category: 'solid', color: '#e7e0d3', roughness: 0.5, pattern: { id: 'powder-stipple', scale: 0.15, contrast: 0.7 } },
    { id: 'terry-towel', name: 'Terry towelling', category: 'fabric', color: '#efebe3', roughness: 1, pattern: { id: 'boucle', scale: 0.08, contrast: 0.8 } },
    { id: 'kraft-carton', name: 'Kraft cardboard', category: 'solid', color: '#b98f5e', roughness: 0.9, pattern: { id: 'plaster', scale: 0.5, contrast: 0.6 } },
    { id: 'birch-pegboard', name: 'Birch pegboard', category: 'wood', color: '#d8bd93', roughness: 0.6, pattern: { id: 'pegboard-holes', scale: 0.2 } },
    { id: 'binder-navy', name: 'Navy polypropylene', category: 'solid', color: '#2d3b57', roughness: 0.45, pattern: { id: 'leather', scale: 0.2, contrast: 0.3 } },
    { id: 'wine-bottle-glass', name: 'Green bottle glass', category: 'glass', color: '#23331f', roughness: 0.08, metalness: 0.1, opacity: 0.9 },
    { id: 'clear-tub', name: 'Clear storage plastic', category: 'glass', color: '#e3ebee', roughness: 0.2, opacity: 0.6 },
    { id: 'canvas-bin-sage', name: 'Sage canvas', category: 'fabric', color: '#9fb8ad', roughness: 0.95, pattern: { id: 'weave', scale: 0.1, contrast: 0.6 } },
    { id: 'toy-coral', name: 'Coral', category: 'solid', color: '#e8735c', roughness: 0.4 },
    { id: 'felt-camel', name: 'Camel felt', category: 'fabric', color: '#a7835c', roughness: 0.95, pattern: { id: 'weave', scale: 0.1, contrast: 0.4 } },
    { id: 'particleboard', name: 'Particleboard', category: 'wood', color: '#c8a77a', roughness: 0.85, pattern: { id: 'granite', scale: 0.2, contrast: 0.9 } },
  ],
});

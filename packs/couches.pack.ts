/**
 * Couches & sectionals — tailored sofas built the way an upholsterer builds them.
 *
 * Every couch is a set of modules (a straight run, a corner seat, a return, a chaise). Each module has
 * an upholstered deck, arms and back frames on its outer sides, loose seat cushions with piping (welts)
 * round the top and along the front edge, and either loose back cushions (leaning, piped, optionally
 * buttoned), a tight padded back, diamond button tufting, vertical channels or big feather pillows.
 * Arms: track, rolled with pleated scroll fronts and welted rings, low English roll, tuxedo, pillowy
 * cloud arms and slim arms with a solid wood cap. Bases: tapered, splayed, turned, bun, cabriole, block
 * and cone legs; an exposed wood rail; a solid oak base; a recessed plinth; a dressmaker skirt with
 * kick pleats at the corners. Sectionals: L corner, chaise and U shapes, with mirrored right-hand
 * versions. Plus a click-clack sofa bed with quilted channels, a pull-out sleeper and a curved sofa.
 *
 * Slots: Upholstery (frame and arms), Cushions (seat and back cushions), Throw pillows, Legs/base.
 */
import {
  box,
  clamp,
  containParts,
  cushion,
  cyl,
  defineItem,
  definePack,
  line,
  matSlot,
  plantBox,
  prism,
  range,
  rod,
  span,
  sphere,
  torus,
  turnedLeg,
  type PackItem,
  type Part,
  type PlanStroke,
  type Size3,
} from '@/packs/kit';

type V2 = [number, number];
type V3 = [number, number, number];
type Side = 'back' | 'front' | 'left' | 'right';
type Arm = 'track' | 'rolled' | 'english' | 'tuxedo' | 'pillow' | 'woodcap' | 'none';
type Back = 'loose' | 'tight' | 'tufted' | 'channel' | 'pillow' | 'camel';
type Leg = 'taper' | 'splay' | 'turned' | 'bun' | 'block' | 'cone' | 'cabriole' | 'glide';
type Base = 'legs' | 'plinth' | 'skirt' | 'woodbase';

interface Look {
  arm: Arm;
  back: Back;
  base: Base;
  leg?: Leg;
  seatTop?: number;
  /** Seat depth of each run of a sectional (back to front). */
  seatDepth?: number;
  armW?: number;
  /** Arms as high as the back (Chesterfield). */
  armHigh?: boolean;
  /** Piping along the cushion and arm edges. */
  welt?: boolean;
  /** Buttons on the inside of the arms. */
  tuftArms?: boolean;
  /** Brass nailheads across the arm fronts. */
  nailheads?: boolean;
  /** Two buttons on each loose back cushion. */
  buttons?: boolean;
  /** Exposed wood rail under the body, on legs (m). */
  rail?: number;
  /** Cushion softness (0.3 tailored … 0.45 slouchy). */
  soft?: number;
  pillows?: number;
  /** Separate modules with a visible gap between them. */
  modular?: boolean;
  /** Pull-out bed: a deeper front rail with a pull strap. */
  sleeper?: boolean;
}

interface Module {
  x: V2;
  z: V2;
  backs: Side[];
  arms: Side[];
  /** Sides joined to another module. */
  seams: Side[];
  seats: number;
  /** Seat cushions are split along this axis. */
  along: 'x' | 'z';
}

const o = { plan: false } as const;
const WR = 0.0045;
const sorted = (a: number, b: number): V2 => (a < b ? [a, b] : [b, a]);
const SIDES: Side[] = ['back', 'front', 'left', 'right'];

const LEG_H: Record<Leg, number> = { taper: 0.15, splay: 0.17, turned: 0.12, bun: 0.07, block: 0.09, cone: 0.14, cabriole: 0.16, glide: 0.025 };
const ARM_W: Record<Arm, number> = { track: 0.15, rolled: 0.21, english: 0.18, tuxedo: 0.17, pillow: 0.27, woodcap: 0.1, none: 0 };

// ───────────── Rotation helpers (lean a cushion back, then turn it to face the seat) ─────────────

type M3 = number[];
/** Ry(yaw) · Rx(pitch) as a row-major 3×3 matrix. */
const rotYX = (yaw: number, pitch: number): M3 => {
  const [cb, sb, ca, sa] = [Math.cos(yaw), Math.sin(yaw), Math.cos(pitch), Math.sin(pitch)];
  return [cb, sb * sa, sb * ca, 0, ca, -sa, -sb, cb * sa, cb * ca];
};
/** Three.js XYZ Euler angles of a rotation matrix. */
const eulerOf = (m: M3): V3 => {
  const y = Math.asin(clamp(m[2], -1, 1));
  return Math.abs(m[2]) < 0.9999 ? [Math.atan2(-m[5], m[8]), y, Math.atan2(-m[1], m[0])] : [Math.atan2(m[7], m[4]), y, 0];
};
const apply = (m: M3, v: V3): V3 => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
/** Turn that makes a cushion's local +z face away from a back on this side. */
const YAW: Record<Side, number> = { back: 0, front: Math.PI, left: Math.PI / 2, right: -Math.PI / 2 };

/** Ranges of an unrotated box part. */
const rangesOf = (p: Part): [V2, V2, V2] => {
  const b = p as Extract<Part, { shape: 'box' }>;
  return [0, 1, 2].map((i) => [b.position[i] - b.size[i] / 2, b.position[i] + b.size[i] / 2]) as [V2, V2, V2];
};

/** Piping round the four edges of one face of a box (axis/sign = the face), sitting on the rounded edge `k` in. */
function weltRect(slot: string, b: [V2, V2, V2], axis: 0 | 1 | 2, sign: 1 | -1, k: number, skip: number[] = []): Part[] {
  const [i, j] = axis === 0 ? [1, 2] : axis === 1 ? [0, 2] : [0, 1];
  const plane = sign > 0 ? b[axis][1] - k : b[axis][0] + k;
  const P = (a: number, c: number): V3 => {
    const p: V3 = [0, 0, 0];
    p[axis] = plane;
    p[i] = a;
    p[j] = c;
    return p;
  };
  const [a0, a1, c0, c1] = [b[i][0] + k, b[i][1] - k, b[j][0] + k, b[j][1] - k];
  const edges: [V3, V3][] = [
    [P(a0, c0), P(a1, c0)],
    [P(a0, c1), P(a1, c1)],
    [P(a0, c0), P(a0, c1)],
    [P(a1, c0), P(a1, c1)],
  ];
  return edges.filter((_, n) => !skip.includes(n)).map(([p, q]) => rod(slot, p, q, WR, o));
}

/**
 * A cushion centred at `c` with half sizes `half` in its own frame (x across, y up, +z its show face),
 * leaned back by `lean` and turned by `yaw`; optional piping round the show face and buttons on it.
 */
function leanCushion(slot: string, c: V3, half: V3, yaw: number, lean: number, soft: number, opts: { welt?: boolean; buttons?: number; plan?: boolean } = {}): Part[] {
  const M = rotYX(yaw, -lean);
  const bev = Math.min(2 * Math.min(...half) * soft, 0.45 * 2 * Math.min(...half));
  const parts: Part[] = [box(slot, c, [half[0] * 2, half[1] * 2, half[2] * 2], { bevel: bev, rotation: eulerOf(M), plan: opts.plan })];
  const T = (p: V3) => add(c, apply(M, p));
  if (opts.welt) {
    const k = 0.293 * bev;
    const [x0, x1, y0, y1, z] = [-half[0] + k, half[0] - k, -half[1] + k, half[1] - k, half[2] - k];
    const ends: [V3, V3][] = [
      [[x0, y1, z], [x1, y1, z]],
      [[x0, y0, z], [x1, y0, z]],
      [[x0, y0, z], [x0, y1, z]],
      [[x1, y0, z], [x1, y1, z]],
    ];
    for (const [a, b] of ends) parts.push(rod(slot, T(a), T(b), WR, o));
  }
  const nb = opts.buttons ?? 0;
  for (const i of range(nb)) parts.push(sphere(slot, T([(-0.5 + (i + 0.5) / nb) * half[0] * 1.1, half[1] * 0.18, half[2] - 0.006]), 0.011, o));
  return parts;
}

const throwPillow = (c: V3, s: number, lean: number, turn: number): Part =>
  cushion('pillows', [c[0] - s / 2, c[0] + s / 2], [c[1] - s / 2, c[1] + s / 2], [c[2] - 0.065, c[2] + 0.065], { softness: 0.45, rotation: [-lean, turn, 0], plan: false });

// ───────────── Frame dimensions ─────────────

function dims(size: Size3, L: Look) {
  const { w, h } = size;
  const legH = L.base === 'legs' ? LEG_H[L.leg ?? 'taper'] : L.base === 'woodbase' ? 0.02 : 0;
  const rail = L.base === 'woodbase' ? 0.09 : L.base === 'legs' ? L.rail ?? 0 : 0;
  const yBase = L.base === 'plinth' ? 0.06 : L.base === 'skirt' ? 0.025 : legH + rail;
  const inset = L.base === 'skirt' ? 0.008 : rail > 0 ? 0.012 : 0;
  const seatTop = clamp(L.seatTop ?? 0.44, yBase + 0.2, h * 0.62);
  const cushT = clamp(seatTop - yBase - 0.1, 0.1, 0.15);
  const deckTop = seatTop - cushT;
  const armW = L.arm === 'none' ? 0 : Math.min(L.armW ?? ARM_W[L.arm], w * 0.12);
  const backT = L.back === 'loose' || L.back === 'pillow' ? 0.15 : 0.17;
  const backTop = L.back === 'loose' ? h - 0.17 : L.back === 'pillow' ? h - 0.24 : L.back === 'camel' ? h - 0.11 : h;
  const armTop = L.armHigh || L.arm === 'tuxedo' ? Math.min(h, backTop) : L.arm === 'english' ? Math.min(h - 0.1, seatTop + 0.17) : L.arm === 'pillow' ? Math.min(h - 0.05, seatTop + 0.19) : Math.min(h - 0.05, seatTop + 0.21);
  const bcD = L.back === 'pillow' ? 0.25 : 0.19;
  return { w, h, legH, rail, yBase, inset, seatTop, cushT, deckTop, armW, backT, backTop, armTop, bcD, soft: L.soft ?? 0.32 };
}
type Dims = ReturnType<typeof dims>;

interface Rect {
  x: V2;
  z: V2;
}

/** Side frame on a rectangle: u runs along the side, v inward from its outer edge. */
function sideMap(r: Rect, s: Side) {
  const alongX = s === 'back' || s === 'front';
  const P = (u: number, v: number): V2 => (s === 'left' ? [r.x[0] + v, u] : s === 'right' ? [r.x[1] - v, u] : s === 'back' ? [u, r.z[0] + v] : [u, r.z[1] - v]);
  return {
    alongX,
    u: (alongX ? r.x : r.z) as V2,
    pt: (u: number, v: number, y: number): V3 => {
      const [x, z] = P(u, v);
      return [x, y, z];
    },
    sp: (slot: string, u: V2, v: V2, y: V2, opts?: { bevel?: number; plan?: boolean }): Part => {
      const a = P(u[0], v[0]);
      const b = P(u[1], v[1]);
      return span(slot, sorted(a[0], b[0]), y, sorted(a[1], b[1]), opts);
    },
  };
}

const has = (m: Module, s: Side) => m.backs.includes(s) || m.arms.includes(s);

/** The body rectangle: the module, pulled in on its outer sides (skirt, wood rail) and at seams of modular sofas. */
function bodyRect(m: Module, f: Dims, L: Look): Rect {
  const at = (s: Side) => (m.seams.includes(s) ? (L.modular ? 0.003 : 0) : f.inset);
  return { x: [m.x[0] + at('left'), m.x[1] - at('right')], z: [m.z[0] + at('back'), m.z[1] - at('front')] };
}

/** Inside the arms and backs. */
function innerRect(m: Module, f: Dims, body: Rect): Rect {
  const t = (s: Side) => (m.backs.includes(s) ? f.backT : m.arms.includes(s) ? f.armW : 0);
  return { x: [body.x[0] + t('left'), body.x[1] - t('right')], z: [body.z[0] + t('back'), body.z[1] - t('front')] };
}

// ───────────── Arms ─────────────

function armParts(f: Dims, L: Look, m: Module, body: Rect, s: Side): Part[] {
  const S = sideMap(body, s);
  const W = f.armW;
  const [y0, top] = [f.yBase, f.armTop];
  const front = !m.backs.includes(S.alongX ? 'right' : 'front');
  const [ua, ub] = S.u;
  const len = ub - ua;
  /** u at distance t from the back end of the arm. */
  const U = (t: number) => (front ? ua + t : ub - t);
  const UR = (t0: number, t1: number) => sorted(U(t0), U(t1));
  const uAxis = S.alongX ? 0 : 2;
  const fwd: 1 | -1 = front ? 1 : -1;
  // The front of an arm that faces ±x needs its rings turned a quarter.
  const ringTurn: V3 = S.alongX ? [0, Math.PI / 2, 0] : [0, 0, 0];
  const backEnd = m.backs.includes(S.alongX ? 'left' : 'back') || m.backs.includes(S.alongX ? 'right' : 'back') ? f.backT + 0.002 : 0;
  const parts: Part[] = [];
  const topWelts = (vOut: number, vIn: number, y: number, t1: number) => {
    if (!L.welt) return;
    parts.push(rod('upholstery', S.pt(U(0.004), vOut, y), S.pt(U(t1), vOut, y), WR, o), rod('upholstery', S.pt(U(0.004), vIn, y), S.pt(U(t1), vIn, y), WR, o));
  };
  const scroll = (r: number, vc: number, yc: number, tEnd: number) => {
    // A round scroll front with a piped ring and pleats gathered to its centre.
    parts.push(rod('upholstery', S.pt(U(tEnd - 0.009), vc, yc), S.pt(U(tEnd - 0.001), vc, yc), r * 0.93, { segments: 24, ...o }));
    const c = S.pt(U(tEnd - 0.0005), vc, yc);
    if (L.welt) parts.push(torus('upholstery', c, r * 0.93, WR, { rotation: ringTurn, plan: false }));
    for (const i of range(8)) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      parts.push(rod('upholstery', c, S.pt(U(tEnd - 0.0005), vc + Math.cos(a) * r * 0.8, yc + Math.sin(a) * r * 0.8), 0.003, o));
    }
  };
  switch (L.arm) {
    case 'track': {
      parts.push(S.sp('upholstery', UR(0, len - 0.006), [0, W], [y0, top], { bevel: 0.03 }));
      const panel = S.sp('upholstery', UR(len - 0.012, len - 0.001), [0.009, W - 0.009], [y0 + 0.012, top - 0.009], { bevel: 0.008, plan: false });
      parts.push(panel);
      if (L.welt) parts.push(...weltRect('upholstery', rangesOf(panel), uAxis, fwd, 0.0024));
      topWelts(0.009, W - 0.009, top - 0.009, len - 0.015);
      break;
    }
    case 'tuxedo': {
      parts.push(S.sp('upholstery', UR(0, len - 0.004), [0, W], [y0, top], { bevel: 0.02 }));
      topWelts(0.006, W - 0.006, top - 0.006, len - 0.01);
      break;
    }
    case 'rolled':
    case 'english': {
      const r = L.arm === 'rolled' ? W * 0.5 : 0.07;
      const tEnd = L.arm === 'rolled' ? len - 0.004 : len - 0.06;
      const vc = L.arm === 'rolled' ? r : W - r - 0.01;
      // Lower arm under the roll (narrower, so the roll overhangs outside), then the roll itself.
      parts.push(S.sp('upholstery', UR(0, tEnd - 0.006), [L.arm === 'rolled' ? 0.03 : 0.04, W], [y0, top - r], { bevel: 0.015 }));
      parts.push(rod('upholstery', S.pt(U(0.001), vc, top - r), S.pt(U(tEnd - 0.006), vc, top - r), r, { segments: 24 }));
      // Front panel under the scroll.
      parts.push(S.sp('upholstery', UR(tEnd - 0.009, tEnd - 0.001), [L.arm === 'rolled' ? 0.036 : 0.046, W - 0.006], [y0 + 0.012, top - r], o));
      scroll(r, vc, top - r, tEnd);
      if (L.arm === 'english') parts.push(S.sp('upholstery', UR(tEnd - 0.006, len - 0.004), [0.04, W - 0.02], [y0, f.deckTop - 0.01], { bevel: 0.01 }));
      break;
    }
    case 'pillow': {
      parts.push(S.sp('upholstery', UR(0, len), [0, W], [y0, top], { bevel: Math.min(W, top - y0) * 0.44 }));
      break;
    }
    case 'woodcap': {
      parts.push(S.sp('upholstery', UR(0, len - 0.05), [0.008, W - 0.008], [y0, top - 0.028], { bevel: 0.012 }));
      parts.push(S.sp('legs', UR(backEnd, len), [0, W], [top - 0.028, top], { bevel: 0.006 }));
      parts.push(S.sp('legs', UR(len - 0.05, len), [0.004, W - 0.004], [Math.max(0, y0 - f.rail), top - 0.028], { bevel: 0.004 }));
      break;
    }
    case 'none':
      break;
  }
  if (L.tuftArms && L.arm !== 'woodcap' && L.arm !== 'none') {
    const yTop = L.arm === 'rolled' ? top - W * 0.5 - 0.02 : top - 0.07;
    for (const t of [0.3, 0.55, 0.8]) for (const y of [f.seatTop + 0.06, (f.seatTop + 0.06 + yTop) / 2, yTop]) if (y < yTop + 0.001) parts.push(sphere('upholstery', S.pt(U(len * t), W + 0.002, y), 0.009, o));
  }
  if (L.nailheads && L.arm !== 'woodcap') for (const i of range(7)) parts.push(sphere('legs', S.pt(U(len - 0.001), W * (0.12 + (0.76 * i) / 6), y0 + 0.04), 0.0055, o));
  return parts;
}

// ───────────── Backs ─────────────

function backParts(f: Dims, L: Look, m: Module, body: Rect, inner: Rect, s: Side): Part[] {
  const S = sideMap(body, s);
  const parts: Part[] = [S.sp('upholstery', S.u, [0, f.backT], [f.yBase, f.backTop], { bevel: 0.025 })];
  const SI = sideMap(inner, s);
  // The inner run of this back: inside arms, and after a neighbouring back's cushions in a corner.
  let [u0, u1] = SI.u;
  const corner = (end: Side) => m.backs.includes(end);
  const lo: Side = S.alongX ? 'left' : 'back';
  const hi: Side = S.alongX ? 'right' : 'front';
  const loose = L.back === 'loose' || L.back === 'pillow';
  if (corner(lo) && (s === 'left' || s === 'right')) u0 += loose ? f.bcD : 0.07;
  if (corner(hi) && (s === 'left' || s === 'right')) u1 -= loose ? f.bcD : 0.07;
  u0 += m.seams.includes(lo) ? 0.002 : 0.003;
  u1 -= m.seams.includes(hi) ? 0.002 : 0.003;
  const len = u1 - u0;
  if (len < 0.15) return parts;
  const vIn = f.backT;
  if (L.back === 'camel') {
    const H = f.h - f.backTop;
    const [x, , z] = S.pt((S.u[0] + S.u[1]) / 2, f.backT / 2, 0);
    const lu = (S.u[1] - S.u[0]) * 0.84;
    parts.push(sphere('upholstery', [x, f.backTop - 0.03, z], 0.5, { scale: S.alongX ? [lu, 2 * (H + 0.03), f.backT * 0.98] : [f.backT * 0.98, 2 * (H + 0.03), lu] }));
  }
  if (loose) {
    const matches = (S.alongX && m.along === 'x') || (!S.alongX && m.along === 'z');
    const nb = matches ? Math.max(1, m.seats) : Math.max(1, Math.round(len / 0.75));
    const cw = len / nb;
    const top = f.h - 0.012;
    const yBot = f.seatTop - 0.012;
    const dep = f.bcD;
    for (const i of range(nb)) {
      const uc = u0 + (i + 0.5) * cw;
      // Against the back frame's inner face (vIn in from the body edge).
      const cc = S.pt(uc, vIn + dep / 2 - 0.012, (yBot + top) / 2);
      if (L.back === 'pillow') parts.push(...leanCushion('cushions', cc, [cw / 2 - 0.004, (top - yBot) / 2, dep / 2], YAW[s], 0.18, 0.45));
      else parts.push(...leanCushion('cushions', cc, [cw / 2 - 0.004, (top - yBot) / 2, dep / 2], YAW[s], 0.11, Math.max(f.soft, 0.38), { welt: L.welt, buttons: L.buttons ? 2 : 0 }));
    }
    return parts;
  }
  // Tight backs: a padded panel on the frame, tufted or channelled.
  const padTop = f.backTop - 0.03;
  const yb = f.seatTop - 0.02;
  if (L.back === 'channel') {
    const k = Math.max(4, Math.round(len / 0.2));
    const cw = len / k;
    for (const i of range(k)) {
      const [x, , z] = S.pt(u0 + (i + 0.5) * cw, vIn + 0.035, 0);
      parts.push(cyl('cushions', [x, (yb + padTop) / 2, z], cw * 0.5, padTop - yb, { scale: S.alongX ? [1, 1, 0.07 / cw] : [0.07 / cw, 1, 1], segments: 14 }));
    }
    return parts;
  }
  const pad = S.sp('cushions', [u0, u1], [vIn - 0.01, vIn + 0.06], [yb, padTop], { bevel: 0.03 });
  parts.push(pad);
  if (L.welt && L.back === 'tight') parts.push(...weltRect('cushions', rangesOf(pad), S.alongX ? 2 : 0, s === 'back' || s === 'left' ? 1 : -1, 0.009));
  if (L.back === 'tufted') {
    const nx = Math.max(4, Math.round((len - 0.12) / 0.17));
    const rows = clamp(Math.round((padTop - yb - 0.1) / 0.13), 2, 4);
    for (const j of range(rows)) {
      const y = yb + 0.07 + ((padTop - yb - 0.14) * (j + 0.5)) / rows;
      const shift = j % 2 ? 0.5 : 0;
      for (const i of range(nx + (j % 2 ? -1 : 0))) {
        const u = u0 + 0.06 + ((len - 0.12) * (i + 0.5 + shift)) / nx;
        parts.push(sphere('cushions', S.pt(u, vIn + 0.06, y), 0.0105, o));
      }
    }
  }
  return parts;
}

// ───────────── Seats, deck and base ─────────────

function seatParts(f: Dims, L: Look, m: Module, body: Rect, inner: Rect): Part[] {
  const parts: Part[] = [];
  const open = (s: Side) => !has(m, s) && !m.seams.includes(s);
  // Deck: pulled back 2 cm on open sides so the cushions sit proud of the front rail.
  const dx: V2 = [inner.x[0] + (open('left') ? 0.02 : 0), inner.x[1] - (open('right') ? 0.02 : 0)];
  const dz: V2 = [inner.z[0] + (open('back') ? 0.02 : 0), inner.z[1] - (open('front') ? 0.02 : 0)];
  parts.push(span('upholstery', dx, [f.yBase, f.deckTop], dz, { bevel: 0.012 }));
  if (L.sleeper && open('front')) {
    const S = sideMap(body, 'front');
    parts.push(S.sp('upholstery', [dx[0] + 0.01, dx[1] - 0.01], [0.012, 0.022], [f.yBase + 0.015, f.deckTop - 0.01], { bevel: 0.006, plan: false }));
    const xc = (dx[0] + dx[1]) / 2;
    parts.push(span('cushions', [xc - 0.07, xc + 0.07], [f.deckTop - 0.06, f.deckTop - 0.035], [body.z[1] - 0.012, body.z[1] - 0.004], { bevel: 0.003, plan: false }));
  }
  // Cushions fill the inner rect; to the body edge on open sides.
  const cx: V2 = [open('left') ? body.x[0] + 0.004 : inner.x[0] + 0.003, open('right') ? body.x[1] - 0.004 : inner.x[1] - 0.003];
  const cz: V2 = [open('back') ? body.z[0] + 0.004 : inner.z[0] + 0.003, open('front') ? body.z[1] - 0.004 : inner.z[1] - 0.003];
  const n = Math.max(1, m.seats);
  const axis = m.along === 'x' ? 0 : 1;
  const r = axis === 0 ? cx : cz;
  const cw = (r[1] - r[0]) / n;
  const frontSide = (['front', 'right', 'left', 'back'] as Side[]).find((s) => open(s));
  const soft = f.soft;
  for (const i of range(n)) {
    const a = r[0] + i * cw + (i ? 0.003 : 0);
    const b = r[0] + (i + 1) * cw - (i < n - 1 ? 0.003 : 0);
    const x = axis === 0 ? ([a, b] as V2) : cx;
    const z = axis === 1 ? ([a, b] as V2) : cz;
    const c = cushion('cushions', x, [f.deckTop, f.seatTop], z, { softness: soft });
    parts.push(c);
    if (!L.welt) continue;
    const bev = (c as Extract<Part, { shape: 'box' }>).bevel ?? 0;
    const k = 0.293 * bev;
    parts.push(...weltRect('cushions', [x, [f.deckTop, f.seatTop], z], 1, 1, k));
    if (frontSide) {
      const y = f.deckTop + k;
      if (frontSide === 'front') parts.push(rod('cushions', [x[0] + k, y, z[1] - k], [x[1] - k, y, z[1] - k], WR, o));
      else if (frontSide === 'back') parts.push(rod('cushions', [x[0] + k, y, z[0] + k], [x[1] - k, y, z[0] + k], WR, o));
      else {
        const xx = frontSide === 'right' ? x[1] - k : x[0] + k;
        parts.push(rod('cushions', [xx, y, z[0] + k], [xx, y, z[1] - k], WR, o));
      }
    }
  }
  return parts;
}

/** Leg positions: module corners that are not buried in a seam, plus centre legs on long runs. */
function legSpots(mods: Module[], f: Dims, L: Look): { x: number; z: number; sx: number; sz: number }[] {
  const inset = L.leg === 'splay' ? 0.09 : L.leg === 'glide' ? 0.08 : 0.065;
  const out: { x: number; z: number; sx: number; sz: number }[] = [];
  const push = (x: number, z: number, sx: number, sz: number) => {
    if (!out.some((p) => Math.hypot(p.x - x, p.z - z) < 0.22)) out.push({ x, z, sx, sz });
  };
  for (const m of mods) {
    const b = bodyRect(m, f, L);
    for (const [xs, sx] of [['left', -1], ['right', 1]] as [Side, number][]) {
      for (const [zs, sz] of [['back', -1], ['front', 1]] as [Side, number][]) {
        if (m.seams.includes(xs) && m.seams.includes(zs)) continue;
        push(sx < 0 ? b.x[0] + inset : b.x[1] - inset, sz < 0 ? b.z[0] + inset : b.z[1] - inset, sx, sz);
      }
    }
    if (b.x[1] - b.x[0] > 2.0) for (const [z, sz] of [[b.z[0] + inset, -1], [b.z[1] - inset, 1]] as [number, number][]) push((b.x[0] + b.x[1]) / 2, z, 0, sz);
    if (b.z[1] - b.z[0] > 2.0) for (const [x, sx] of [[b.x[0] + inset, -1], [b.x[1] - inset, 1]] as [number, number][]) push(x, (b.z[0] + b.z[1]) / 2, sx, 0);
  }
  return out;
}

function legPart(f: Dims, L: Look, p: { x: number; z: number; sx: number; sz: number }): Part {
  const { x, z } = p;
  const H = f.legH;
  switch (L.leg ?? 'taper') {
    case 'splay':
      return rod('legs', [x + p.sx * 0.035, 0.004, z + p.sz * 0.03], [x, H, z], 0.012, { rTop: 0.021, segments: 12, plan: false });
    case 'turned':
      return turnedLeg('legs', x, z, 0, H, 0.028, { style: 'spindle' });
    case 'bun':
      return turnedLeg('legs', x, z, 0, H, 0.045, { style: 'bun' });
    case 'cabriole':
      return turnedLeg('legs', x, z, 0, H, 0.032, { style: 'cabriole' });
    case 'block':
      return span('legs', [x - 0.035, x + 0.035], [0, H], [z - 0.035, z + 0.035], { bevel: 0.006, plan: false });
    case 'cone':
      return cyl('legs', [x, H / 2, z], 0.013, H, { rTop: 0.027, segments: 14, plan: false });
    case 'glide':
      return span('legs', [x - 0.03, x + 0.03], [0, H], [z - 0.03, z + 0.03], { bevel: 0.004, plan: false });
    default:
      return cyl('legs', [x, H / 2, z], 0.017, H, { rTop: 0.025, segments: 14, plan: false });
  }
}

function baseParts(f: Dims, L: Look, mods: Module[]): Part[] {
  const parts: Part[] = [];
  for (const m of mods) {
    const out = (s: Side, d: number) => (m.seams.includes(s) ? 0 : d);
    if (L.base === 'plinth') parts.push(span('legs', [m.x[0] + out('left', 0.045), m.x[1] - out('right', 0.045)], [0, f.yBase], [m.z[0] + out('back', 0.045), m.z[1] - out('front', 0.045)], o));
    if (f.rail > 0) parts.push(span('legs', m.x, [f.yBase - f.rail, f.yBase], m.z, { bevel: 0.005 }));
    if (L.base === 'skirt') {
      const top = f.yBase + 0.17;
      for (const s of SIDES) {
        if (m.seams.includes(s)) continue;
        const S = sideMap(m, s);
        const [lo, hi] = S.alongX ? (['left', 'right'] as Side[]) : (['back', 'front'] as Side[]);
        // Kick pleats: the skirt panels stop short of open corners and show the body behind.
        const u: V2 = [S.u[0] + (m.seams.includes(lo) ? 0 : 0.03), S.u[1] - (m.seams.includes(hi) ? 0 : 0.03)];
        parts.push(S.sp('legs', u, [0, 0.009], [0.012, top], { bevel: 0.003 }));
        parts.push(S.sp('legs', [S.u[0] + (m.seams.includes(lo) ? 0 : 0.006), u[0] + 0.02], [0.004, 0.008], [0.016, top - 0.004], o));
        parts.push(S.sp('legs', [u[1] - 0.02, S.u[1] - (m.seams.includes(hi) ? 0 : 0.006)], [0.004, 0.008], [0.016, top - 0.004], o));
        if (L.welt) parts.push(rod('legs', S.pt(u[0] + 0.004, 0.0055, top - 0.003), S.pt(u[1] - 0.004, 0.0055, top - 0.003), WR, o));
      }
    }
  }
  if (L.base === 'legs' || L.base === 'woodbase') for (const p of legSpots(mods, f, { ...L, leg: L.base === 'woodbase' ? 'glide' : L.leg })) parts.push(legPart(f, L.base === 'woodbase' ? { ...L, leg: 'glide' } : L, p));
  return parts;
}

/** Throw pillows against the back run, at its two ends first. */
function pillowParts(f: Dims, L: Look, mods: Module[]): Part[] {
  const runs = mods.filter((m) => m.backs.includes('back'));
  const n = clamp(L.pillows ?? 0, 0, 4);
  if (!runs.length || !n) return [];
  const ins = runs.map((m) => innerRect(m, f, bodyRect(m, f, L)));
  const x0 = Math.min(...ins.map((r) => r.x[0]));
  const x1 = Math.max(...ins.map((r) => r.x[1]));
  const z = Math.max(...ins.map((r) => r.z[0])) + (L.back === 'loose' || L.back === 'pillow' ? f.bcD : 0.06) + 0.06;
  const s = 0.42;
  return range(n).map((i) => {
    const side = i % 2 === 0 ? -1 : 1;
    const inner = i >= 2;
    const x = side < 0 ? x0 + (inner ? 0.7 : 0.24) : x1 - (inner ? 0.7 : 0.24);
    return throwPillow([x, f.seatTop + 0.2, z], s, 0.3, side * (inner ? -0.12 : -0.32));
  });
}

function couchParts(size: Size3, L: Look, mods: Module[]): Part[] {
  const f = dims(size, L);
  const parts: Part[] = [];
  for (const m of mods) {
    const body = bodyRect(m, f, L);
    const inner = innerRect(m, f, body);
    parts.push(...seatParts(f, L, m, body, inner));
    for (const s of m.backs) parts.push(...backParts(f, L, m, body, inner, s));
    if (L.arm !== 'none') for (const s of m.arms) parts.push(...armParts(f, L, m, body, s));
  }
  parts.push(...baseParts(f, L, mods), ...pillowParts(f, L, mods));
  return containParts(parts, plantBox(size));
}

function couchPlan(size: Size3, L: Look, mods: Module[]): PlanStroke[] {
  const f = dims(size, L);
  const out: PlanStroke[] = [];
  for (const m of mods) {
    const body = bodyRect(m, f, L);
    const inner = innerRect(m, f, body);
    for (const s of m.backs) {
      const S = sideMap(body, s);
      const a = S.pt(S.u[0], f.backT, 0);
      const b = S.pt(S.u[1], f.backT, 0);
      out.push(line([a[0], a[2]], [b[0], b[2]]));
    }
    const n = Math.max(1, m.seats);
    for (const i of range(n - 1)) {
      if (m.along === 'x') {
        const x = inner.x[0] + ((inner.x[1] - inner.x[0]) * (i + 1)) / n;
        out.push(line([x, inner.z[0]], [x, body.z[1]]));
      } else {
        const z = inner.z[0] + ((inner.z[1] - inner.z[0]) * (i + 1)) / n;
        out.push(line([inner.x[0], z], [inner.x[1], z]));
      }
    }
  }
  return out;
}

// ───────────── Layouts ─────────────

type Layout = (s: Size3, L: Look) => Module[];

const straight =
  (seats: number): Layout =>
  ({ w, d }) => [{ x: [-w / 2, w / 2], z: [-d / 2, d / 2], backs: ['back'], arms: ['left', 'right'], seams: [], seats, along: 'x' }];

/** `n` equal modules side by side, arms on the two end modules (modular sofas). */
const modules =
  (n: number): Layout =>
  ({ w, d }) =>
    range(n).map((i) => ({
      x: [-w / 2 + (w * i) / n, -w / 2 + (w * (i + 1)) / n] as V2,
      z: [-d / 2, d / 2] as V2,
      backs: ['back'] as Side[],
      arms: [...(i === 0 ? ['left'] : []), ...(i === n - 1 ? ['right'] : [])] as Side[],
      seams: [...(i > 0 ? ['left'] : []), ...(i < n - 1 ? ['right'] : [])] as Side[],
      seats: 1,
      along: 'x' as const,
    }));

const seatCount = (len: number, max: number) => clamp(Math.round(len / 0.68), 1, max);

/** L corner sectional: corner seat at the back left, a run along the back and a return down the left side. */
const lCorner: Layout = ({ w, d }, L) => {
  const sd = clamp(L.seatDepth ?? 0.98, 0.8, Math.min(d - 0.6, w - 0.9));
  const armW = ARM_W[L.arm];
  return [
    { x: [-w / 2, -w / 2 + sd], z: [-d / 2, -d / 2 + sd], backs: ['back', 'left'], arms: [], seams: ['right', 'front'], seats: 1, along: 'x' },
    { x: [-w / 2 + sd, w / 2], z: [-d / 2, -d / 2 + sd], backs: ['back'], arms: ['right'], seams: ['left'], seats: seatCount(w - sd - armW, 4), along: 'x' },
    { x: [-w / 2, -w / 2 + sd], z: [-d / 2 + sd, d / 2], backs: ['left'], arms: ['front'], seams: ['back'], seats: seatCount(d - sd - armW, 3), along: 'z' },
  ];
};

/** Chaise sectional: a chaise with an arm on the left, a run of seats to its right. */
const chaise: Layout = ({ w, d }, L) => {
  const sd = clamp(L.seatDepth ?? 0.98, 0.8, d - 0.5);
  const armW = ARM_W[L.arm];
  const cw = clamp(0.78 + armW, 0.85, w * 0.42);
  return [
    { x: [-w / 2, -w / 2 + cw], z: [-d / 2, d / 2], backs: ['back'], arms: ['left'], seams: ['right'], seats: 1, along: 'z' },
    { x: [-w / 2 + cw, w / 2], z: [-d / 2, -d / 2 + sd], backs: ['back'], arms: ['right'], seams: ['left'], seats: seatCount(w - cw - armW, 3), along: 'x' },
  ];
};

/** U sectional: return and corner on the left, a run along the back, an armless chaise on the right. */
const uChaise: Layout = ({ w, d }, L) => {
  const sd = clamp(L.seatDepth ?? 0.98, 0.8, Math.min(d - 0.6, (w - 1.6) / 1.0));
  const armW = ARM_W[L.arm];
  const cw = 0.82;
  return [
    { x: [-w / 2, -w / 2 + sd], z: [-d / 2 + sd, d / 2], backs: ['left'], arms: ['front'], seams: ['back'], seats: seatCount(d - sd - armW, 3), along: 'z' },
    { x: [-w / 2, -w / 2 + sd], z: [-d / 2, -d / 2 + sd], backs: ['back', 'left'], arms: [], seams: ['right', 'front'], seats: 1, along: 'x' },
    { x: [-w / 2 + sd, w / 2 - cw], z: [-d / 2, -d / 2 + sd], backs: ['back'], arms: [], seams: ['left', 'right'], seats: seatCount(w - sd - cw, 3), along: 'x' },
    { x: [w / 2 - cw, w / 2], z: [-d / 2, d / 2], backs: ['back'], arms: [], seams: ['left'], seats: 1, along: 'z' },
  ];
};

/** Mirror parts left to right (right-hand versions of the sectionals and desks). */
function mirrorX(parts: Part[]): Part[] {
  return parts.map((p) => {
    const q: Part = { ...p, position: [-p.position[0], p.position[1], p.position[2]] };
    if (p.rotation) q.rotation = [p.rotation[0], -p.rotation[1], -p.rotation[2]];
    if (q.shape === 'prism') q.outline = q.outline.map(([x, z]) => [-x, z] as V2).reverse();
    return q;
  });
}
const mirrorPlan = (s: PlanStroke[]): PlanStroke[] =>
  s.map((k) => (k.kind === 'line' ? { ...k, a: [-k.a[0], k.a[1]], b: [-k.b[0], k.b[1]] } : k.kind === 'circle' ? { ...k, c: [-k.c[0], k.c[1]] } : { ...k, points: k.points.map(([x, z]) => [-x, z] as V2) }));

// ───────────── Click-clack sofa bed ─────────────

function clickClackParts(size: Size3): Part[] {
  const { w, d, h } = size;
  const parts: Part[] = [];
  const legH = 0.2;
  const fx = w / 2 - 0.06;
  const pivotZ = -d / 2 + 0.34;
  const seatY: V2 = [legH + 0.045, 0.43];
  // Chrome frame: four tube legs, side rails, cross bars and hinge plates at the pivot.
  for (const sx of [-1, 1]) {
    for (const z of [-d / 2 + 0.14, d / 2 - 0.07]) parts.push(cyl('frame', [sx * fx, legH / 2, z], 0.014, legH, { segments: 14, ...o }));
    parts.push(span('frame', [sx * fx - 0.012, sx * fx + 0.012], [legH, legH + 0.04], [-d / 2 + 0.12, d / 2 - 0.05], { bevel: 0.004, plan: false }));
    parts.push(span('frame', sx < 0 ? [-w / 2 + 0.004, -w / 2 + 0.014] : [w / 2 - 0.014, w / 2 - 0.004], [legH + 0.02, legH + 0.16], [pivotZ - 0.07, pivotZ + 0.05], { bevel: 0.003, plan: false }));
    parts.push(rod('frame', [sx * (w / 2 - 0.009), legH + 0.1, pivotZ - 0.01], [sx * (w / 2 - 0.022), legH + 0.1, pivotZ - 0.01], 0.012, o));
  }
  for (const z of [-d / 2 + 0.14, d / 2 - 0.07]) parts.push(rod('frame', [-fx, legH + 0.02, z], [fx, legH + 0.02, z], 0.012, o));
  // Slatted deck under the mattress.
  parts.push(span('frame', [-fx + 0.012, fx - 0.012], [legH + 0.03, legH + 0.045], [pivotZ, d / 2 - 0.05], o));
  // Seat: quilted channels running side to side.
  const sx: V2 = [-w / 2 + 0.03, w / 2 - 0.03];
  const n = 4;
  const sz0 = pivotZ;
  const sz1 = d / 2 - 0.005;
  for (const i of range(n)) parts.push(cushion('upholstery', sx, seatY, [sz0 + ((sz1 - sz0) * i) / n + 0.002, sz0 + ((sz1 - sz0) * (i + 1)) / n - 0.002], { softness: 0.24 }));
  // Back: the other half of the mattress, hinged up and leaning back.
  const a = 0.3;
  const up: V3 = [0, Math.cos(a), -Math.sin(a)];
  const nrm: V3 = [0, Math.sin(a), Math.cos(a)];
  const pivot: V3 = [0, seatY[0] + 0.02, pivotZ - 0.01];
  const T = 0.15;
  const Hb = (h - 0.012 - pivot[1]) / Math.cos(a);
  const nb = 4;
  for (const i of range(nb)) {
    const s = ((i + 0.5) * Hb) / nb;
    const c: V3 = [0, pivot[1] + up[1] * s - (nrm[1] * T) / 2, pivot[2] + up[2] * s - (nrm[2] * T) / 2];
    parts.push(box('upholstery', c, [sx[1] - sx[0], Hb / nb - 0.004, T], { bevel: Math.min(Hb / nb, T) * 0.26, rotation: [-a, 0, 0] }));
  }
  // Support bar behind the back.
  parts.push(rod('frame', [-fx, legH + 0.12, -d / 2 + 0.06], [fx, legH + 0.12, -d / 2 + 0.06], 0.011, o));
  for (const side of [-1, 1]) parts.push(throwPillow([side * (w / 2 - 0.32), seatY[1] + 0.2, pivotZ + 0.08], 0.42, 0.3, -side * 0.25));
  return containParts(parts, plantBox(size));
}

// ───────────── Curved sofa ─────────────

function curvedParts(size: Size3): Part[] {
  const { w, d, h } = size;
  const D = Math.min(0.92, d * 0.78);
  const fit = (a: number) => {
    const R = (w / 2 - 0.01) / Math.sin(a);
    return R - (R - D) * Math.cos(a);
  };
  let [lo, hi] = [0.55, 1.4];
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (fit(mid) < d - 0.01) lo = mid;
    else hi = mid;
  }
  const half = lo;
  const R = (w / 2 - 0.01) / Math.sin(half);
  const zc = -d / 2 + R;
  const at = (r: number, a: number, y: number): V3 => [r * Math.sin(a), y, zc - r * Math.cos(a)];
  const P = (r: number, a: number): V2 => [r * Math.sin(a), zc - r * Math.cos(a)];
  const legH = 0.11;
  const yBase = legH;
  const seatTop = clamp(h * 0.56, 0.4, 0.45);
  const deckTop = seatTop - 0.14;
  const backT = 0.16;
  const rIn = R - D;
  const parts: Part[] = [];
  /** An annular sector between radii r0..r1 and angles a0..a1, as a prism from y0 to y1. */
  const sector = (slot: string, r0: number, r1: number, a0: number, a1: number, y0: number, y1: number, plan = true): Part => {
    const k = 3;
    const outer = range(k + 1).map((i) => P(r1, a0 + ((a1 - a0) * i) / k));
    const inner = range(k + 1).map((i) => P(r0, a1 - ((a1 - a0) * i) / k));
    return prism(slot, [...outer, ...inner], y0, y1 - y0, { plan });
  };
  // Back frame, in slim sectors so the plan follows the curve.
  // Rounded arms close both ends; the back frame stops inside them.
  const armT = 0.17;
  const armA = armT / (R - D / 2);
  const nb = 12;
  const bh = half - armA * 0.6;
  for (const i of range(nb)) parts.push(sector('upholstery', R - backT, R - 0.004, -bh + (2 * bh * i) / nb, -bh + (2 * bh * (i + 1)) / nb, yBase, h - 0.16));
  for (const s of [-1, 1]) {
    const a = s * (half - armA / 2);
    const c = at(R - D / 2 - 0.005, a, (yBase + seatTop + 0.2) / 2);
    parts.push(box('upholstery', c, [armT, seatTop + 0.2 - yBase, D - 0.02], { bevel: 0.06, rotation: [0, -a, 0] }));
  }
  // Deck, seat cushions (wedges with a crowned top and a piped front edge) and leaning back cushions.
  const seats = clamp(Math.round((2 * (half - armA) * (R - D / 2)) / 0.55), 3, 5);
  const a0 = -half + armA;
  const seg = (2 * (half - armA)) / seats;
  for (const i of range(seats)) {
    const [s0, s1] = [a0 + i * seg, a0 + (i + 1) * seg];
    const g = 0.003 / (R - D / 2);
    parts.push(sector('upholstery', rIn + 0.03, R - backT, s0, s1, yBase, deckTop));
    parts.push(sector('cushions', rIn + 0.008, R - backT + 0.004, s0 + g, s1 - g, deckTop, seatTop - 0.025, false));
    const gi = 0.016 / (R - D / 2);
    parts.push(sector('cushions', rIn + 0.022, R - backT - 0.01, s0 + gi, s1 - gi, seatTop - 0.025, seatTop, false));
    const sm = (s0 + s1) / 2;
    parts.push(rod('cushions', at(rIn + 0.012, s0 + g, seatTop - 0.026), at(rIn + 0.012, sm, seatTop - 0.026), WR, o), rod('cushions', at(rIn + 0.012, sm, seatTop - 0.026), at(rIn + 0.012, s1 - g, seatTop - 0.026), WR, o));
    const rc = R - backT - 0.085;
    const cw = 2 * rc * Math.sin(seg / 2) - 0.01;
    parts.push(...leanCushion('cushions', at(rc, sm, (seatTop - 0.01 + h - 0.015) / 2), [cw / 2, (h - 0.015 - seatTop + 0.01) / 2, 0.09], -sm, 0.12, 0.4, { welt: true }));
  }
  // Tapered legs under the back and front of the curve.
  for (const a of [-half + armA / 2, -half / 3, half / 3, half - armA / 2]) {
    for (const r of [R - 0.07, rIn + 0.08]) {
      const [x, , z] = at(r, a, 0);
      parts.push(cyl('legs', [x, legH / 2, z], 0.016, legH, { rTop: 0.024, segments: 12, ...o }));
    }
  }
  for (const s of [-1, 1]) {
    const a = s * half * 0.55;
    parts.push(throwPillow(at(R - backT - 0.25, a, seatTop + 0.2), 0.42, 0.28, -a));
  }
  return containParts(parts, plantBox(size));
}

// ───────────── Items ─────────────

type Finish = [name: string, upholstery: string, cushions: string, pillows: string, legs: string];
interface CouchSpec {
  id: string;
  name: string;
  size: Size3;
  min: Size3;
  max: Size3;
  tags: string[];
  description: string;
  finishes: Finish[];
  look?: Look;
  layout?: Layout;
  build?: (s: Size3) => Part[];
  legsLabel?: string;
  /** Right-hand version: mirrored, listed after its left-hand item. */
  mirror?: boolean;
  variantOf?: string;
  bed?: boolean;
  slots?: PackItem['slots'];
}

const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const S3 = (w: number, d: number, h: number): Size3 => ({ w, d, h });

function couch(p: CouchSpec): PackItem {
  const [first, ...rest] = p.finishes;
  const { look, layout } = p;
  const build = p.build ?? ((s: Size3) => couchParts(s, look!, layout!(s, look!)));
  const plan = look && layout ? (s: Size3) => couchPlan(s, look, layout(s, look)) : undefined;
  return defineItem({
    id: p.id,
    name: p.name,
    category: 'living',
    type: p.bed ? 'beds' : 'seating',
    group: p.bed ? 'Daybeds & sofa beds' : 'Sofas & loveseats',
    tags: ['sofa', 'couch', 'ghế sofa', ...p.tags],
    description: p.description,
    defaultSize: p.size,
    minSize: p.min,
    maxSize: p.max,
    wallSnap: true,
    slots: p.slots ?? [matSlot('upholstery', 'Upholstery', first[1]), matSlot('cushions', 'Cushions', first[2]), matSlot('pillows', 'Throw pillows', first[3]), matSlot('legs', p.legsLabel ?? 'Legs', first[4])],
    variants: rest.map(([name, u, c, pl, l]) => ({ id: slug(name), name, materials: (p.slots ? { upholstery: u, pillows: pl, frame: l } : { upholstery: u, cushions: c, pillows: pl, legs: l }) as Record<string, string> })),
    variantOf: p.variantOf,
    build: p.mirror ? (s) => mirrorX(build(s)) : build,
    planDetail: plan && (p.mirror ? (s) => mirrorPlan(plan(s)) : plan),
  });
}

const TRACK: Finish[] = [
  ['Oat weave & oak', 'fabric-boucle-oat', 'fabric-boucle-oat', 'fabric-linen-rust', 'wood-oak-natural'],
  ['Charcoal & walnut', 'fabric-charcoal', 'fabric-charcoal', 'fabric-mustard', 'wood-walnut'],
  ['Sage linen & ash', 'fabric-linen-sage', 'fabric-linen-sage', 'fabric-cream', 'wood-ash-white'],
  ['Navy & black', 'fabric-navy', 'fabric-navy', 'fabric-cream', 'metal-black-matte'],
  ['Terracotta & teak', 'fabric-terracotta', 'fabric-terracotta', 'fabric-cream', 'wood-teak'],
];
const SECTIONAL: Finish[] = [
  ['Grey wool & walnut', 'fabric-wool-grey', 'fabric-wool-grey', 'fabric-mustard', 'wood-walnut'],
  ['Cream & oak', 'fabric-cream', 'fabric-cream', 'fabric-linen-sage', 'wood-oak-light'],
  ['Olive corduroy & black', 'fabric-corduroy-olive', 'fabric-corduroy-olive', 'fabric-cream', 'metal-black-matte'],
  ['Camel corduroy & walnut', 'fabric-corduroy-camel', 'fabric-corduroy-camel', 'fabric-linen-rust', 'wood-walnut'],
  ['Navy & brass', 'fabric-navy', 'fabric-navy', 'fabric-velvet-mustard', 'metal-brass'],
];

const L_LOOK: Look = { arm: 'track', back: 'loose', base: 'legs', leg: 'taper', welt: true, pillows: 3 };
const CHAISE_LOOK: Look = { arm: 'track', back: 'loose', base: 'legs', leg: 'block', welt: true, pillows: 2 };
const U_LOOK: Look = { arm: 'track', back: 'loose', base: 'plinth', welt: true, pillows: 4, armW: 0.14 };

const items: PackItem[] = [
  couch({
    id: 'piped-track-arm-3-seat',
    name: 'Piped track-arm 3-seat sofa',
    look: { arm: 'track', back: 'loose', base: 'legs', leg: 'taper', welt: true, pillows: 2 },
    layout: straight(3),
    size: S3(2.15, 0.95, 0.84),
    min: S3(1.8, 0.86, 0.78),
    max: S3(2.6, 1.05, 0.92),
    tags: ['3-seat', 'track arm', 'piping', 'welt', 'modern', 'tapered legs', 'family sofa'],
    description: 'A modern three-seat sofa with crisp track arms, three loose seat and back cushions finished with piping round every edge, on tapered wooden legs.',
    finishes: TRACK,
  }),
  couch({
    id: 'piped-track-arm-2-seat',
    name: 'Piped track-arm 2-seat sofa',
    look: { arm: 'track', back: 'loose', base: 'legs', leg: 'taper', welt: true, pillows: 2, armW: 0.13 },
    layout: straight(2),
    size: S3(1.6, 0.9, 0.82),
    min: S3(1.3, 0.82, 0.76),
    max: S3(1.9, 1.0, 0.9),
    tags: ['2-seat', 'loveseat', 'track arm', 'piping', 'small sofa', 'apartment'],
    description: 'The two-seat version of the piped track-arm sofa: two piped seat and back cushions between slim square arms, on tapered wooden legs; sized for small living rooms.',
    finishes: TRACK,
  }),
  couch({
    id: 'chesterfield-rolled-arm',
    name: 'Rolled-arm Chesterfield, 3-seat',
    look: { arm: 'rolled', back: 'tufted', base: 'legs', leg: 'bun', armHigh: true, welt: true, tuftArms: true, nailheads: true, seatTop: 0.45 },
    layout: straight(3),
    size: S3(2.2, 0.96, 0.76),
    min: S3(1.7, 0.88, 0.72),
    max: S3(2.6, 1.05, 0.82),
    tags: ['chesterfield', 'button tufted', 'rolled arm', 'leather', 'nailhead', 'classic', 'english'],
    description: 'A classic Chesterfield: arms rolled outward at the height of the back with pleated scroll fronts, deep diamond buttoning, piped seat cushions, brass nailheads and bun feet.',
    finishes: [
      ['Antique tan leather', 'leather-tan', 'leather-tan', 'leather-tan', 'metal-brass'],
      ['Oxblood leather', 'leather-burgundy', 'leather-burgundy', 'leather-burgundy', 'metal-brass'],
      ['Cognac leather', 'leather-cognac', 'leather-cognac', 'leather-cognac', 'metal-bronze'],
      ['Black leather', 'leather-smooth-black', 'leather-smooth-black', 'leather-smooth-black', 'metal-chrome'],
      ['Bottle-green velvet', 'fabric-velvet-green', 'fabric-velvet-green', 'fabric-velvet-green', 'metal-gold'],
    ],
    legsLabel: 'Feet & nailheads',
  }),
  couch({
    id: 'mid-century-walnut-rail',
    name: 'Mid-century sofa on a walnut rail',
    look: { arm: 'woodcap', back: 'loose', base: 'legs', leg: 'splay', rail: 0.045, welt: true, buttons: true, seatTop: 0.43, pillows: 2 },
    layout: straight(3),
    size: S3(2.05, 0.86, 0.8),
    min: S3(1.6, 0.8, 0.74),
    max: S3(2.5, 0.94, 0.86),
    tags: ['mid-century', 'retro', 'walnut', 'splayed legs', 'buttoned', 'danish', 'scandinavian'],
    description: 'A slim mid-century sofa: walnut-capped arms, an exposed walnut rail under the seat, splayed tapered legs and buttoned, piped back cushions.',
    finishes: [
      ['Mustard & walnut', 'fabric-mustard', 'fabric-mustard', 'fabric-cream', 'wood-walnut'],
      ['Charcoal & teak', 'fabric-charcoal', 'fabric-charcoal', 'fabric-mustard', 'wood-teak'],
      ['Olive & oak', 'fabric-olive', 'fabric-olive', 'fabric-linen-rust', 'wood-oak-natural'],
      ['Sky blue & walnut', 'fabric-sky', 'fabric-sky', 'fabric-white-cotton', 'wood-walnut'],
      ['Rust velvet & teak', 'fabric-velvet-rust', 'fabric-velvet-rust', 'fabric-velvet-mustard', 'wood-teak'],
    ],
    legsLabel: 'Wood rail, caps & legs',
  }),
  couch({
    id: 'cloud-modular-4',
    name: 'Deep modular cloud sofa, 4 modules',
    look: { arm: 'pillow', back: 'pillow', base: 'legs', leg: 'glide', modular: true, soft: 0.44, seatTop: 0.42, pillows: 2 },
    layout: modules(4),
    size: S3(3.4, 1.14, 0.76),
    min: S3(2.8, 1.0, 0.7),
    max: S3(4.2, 1.25, 0.84),
    tags: ['cloud', 'modular', 'deep seat', 'oversized', 'feather', 'lounge', 'boucle'],
    description: 'An extra-deep modular sofa of four separate blocks, two of them with fat pillowy arms, each with a plump feather seat cushion and a huge loose back pillow, on hidden glides.',
    finishes: [
      ['Cream bouclé', 'fabric-boucle', 'fabric-boucle', 'fabric-boucle-oat', 'wood-dark-stain'],
      ['Oat bouclé', 'fabric-boucle-oat', 'fabric-boucle-oat', 'fabric-linen-rust', 'wood-dark-stain'],
      ['White cotton', 'fabric-white-cotton', 'fabric-white-cotton', 'fabric-linen-sage', 'wood-dark-stain'],
      ['Grey wool', 'fabric-wool-grey', 'fabric-wool-grey', 'fabric-cream', 'metal-black-matte'],
    ],
    legsLabel: 'Glides',
  }),
  couch({
    id: 'l-corner-sectional-left',
    name: 'L-shaped corner sectional, return left',
    look: L_LOOK,
    layout: lCorner,
    size: S3(2.8, 2.1, 0.84),
    min: S3(2.3, 1.7, 0.78),
    max: S3(3.6, 2.8, 0.92),
    tags: ['sectional', 'l-shape', 'corner sofa', 'sofa góc', 'piping', 'family', 'left hand'],
    description: 'A corner sectional in three pieces: a back run with a track arm on the right, a square corner seat and a return down the left side, all with piped loose cushions on tapered legs.',
    finishes: SECTIONAL,
  }),
  couch({
    id: 'l-corner-sectional-right',
    name: 'L-shaped corner sectional, return right',
    look: L_LOOK,
    layout: lCorner,
    mirror: true,
    variantOf: 'l-corner-sectional-left',
    size: S3(2.8, 2.1, 0.84),
    min: S3(2.3, 1.7, 0.78),
    max: S3(3.6, 2.8, 0.92),
    tags: ['sectional', 'l-shape', 'corner sofa', 'sofa góc', 'piping', 'right hand'],
    description: 'The corner sectional with its return down the right side: back run, corner seat and return, piped loose cushions on tapered legs.',
    finishes: SECTIONAL,
  }),
  couch({
    id: 'chaise-sectional-piped-left',
    name: 'Piped chaise sectional, chaise left',
    look: CHAISE_LOOK,
    layout: chaise,
    size: S3(2.75, 1.62, 0.84),
    min: S3(2.2, 1.4, 0.78),
    max: S3(3.4, 1.95, 0.92),
    tags: ['sectional', 'chaise', 'lounger', 'l-shape', 'sofa chữ l', 'piping', 'left hand'],
    description: 'A sectional with a long chaise lounger on the left, finished with a track arm at both ends, piped cushions throughout and square block feet.',
    finishes: SECTIONAL,
  }),
  couch({
    id: 'chaise-sectional-piped-right',
    name: 'Piped chaise sectional, chaise right',
    look: CHAISE_LOOK,
    layout: chaise,
    mirror: true,
    variantOf: 'chaise-sectional-piped-left',
    size: S3(2.75, 1.62, 0.84),
    min: S3(2.2, 1.4, 0.78),
    max: S3(3.4, 1.95, 0.92),
    tags: ['sectional', 'chaise', 'lounger', 'l-shape', 'sofa chữ l', 'right hand'],
    description: 'The piped chaise sectional with the chaise lounger on the right, track arms at both ends and square block feet.',
    finishes: SECTIONAL,
  }),
  couch({
    id: 'u-sectional-chaise-right',
    name: 'U-shaped sectional, return left & chaise right',
    look: U_LOOK,
    layout: uChaise,
    size: S3(3.5, 2.0, 0.84),
    min: S3(3.0, 1.7, 0.78),
    max: S3(4.4, 2.6, 0.92),
    tags: ['sectional', 'u-shape', 'u sofa', 'sofa chữ u', 'chaise', 'corner', 'large'],
    description: 'A big U-shaped sectional: a return with an arm on the left, a corner seat, a back run and an armless chaise on the right, with piped cushions on a recessed plinth.',
    finishes: SECTIONAL,
    legsLabel: 'Plinth',
  }),
  couch({
    id: 'u-sectional-chaise-left',
    name: 'U-shaped sectional, chaise left & return right',
    look: U_LOOK,
    layout: uChaise,
    mirror: true,
    variantOf: 'u-sectional-chaise-right',
    size: S3(3.5, 2.0, 0.84),
    min: S3(3.0, 1.7, 0.78),
    max: S3(4.4, 2.6, 0.92),
    tags: ['sectional', 'u-shape', 'u sofa', 'sofa chữ u', 'chaise', 'corner'],
    description: 'The U-shaped sectional the other way round: an armless chaise on the left, then the back run, the corner seat and a return with an arm on the right.',
    finishes: SECTIONAL,
    legsLabel: 'Plinth',
  }),
  couch({
    id: 'click-clack-sofa-bed',
    name: 'Click-clack sofa bed',
    bed: true,
    build: clickClackParts,
    size: S3(1.9, 0.96, 0.86),
    min: S3(1.6, 0.88, 0.8),
    max: S3(2.1, 1.05, 0.92),
    tags: ['sofa bed', 'click clack', 'sofa giường', 'futon', 'guest bed', 'convertible', 'small space'],
    description: 'An armless click-clack sofa bed: a quilted mattress in channels that folds flat into a bed, its back hinged on chrome side plates over four chrome tube legs.',
    slots: [matSlot('upholstery', 'Mattress', 'fabric-wool-grey'), matSlot('pillows', 'Throw pillows', 'fabric-mustard'), matSlot('frame', 'Frame & legs', 'metal-chrome')],
    finishes: [
      ['Grey & chrome', 'fabric-wool-grey', '', 'fabric-mustard', 'metal-chrome'],
      ['Navy & black', 'fabric-navy', '', 'fabric-cream', 'metal-black-matte'],
      ['Cream & brass', 'fabric-cream', '', 'fabric-linen-sage', 'metal-brass'],
      ['Charcoal & steel', 'fabric-charcoal', '', 'fabric-blush', 'metal-brushed-steel'],
    ],
  }),
  couch({
    id: 'pull-out-sleeper-3-seat',
    name: 'Pull-out sleeper sofa, 3-seat',
    bed: true,
    look: { arm: 'track', back: 'loose', base: 'legs', leg: 'block', welt: true, sleeper: true, seatTop: 0.46, pillows: 2 },
    layout: straight(3),
    size: S3(2.1, 0.98, 0.86),
    min: S3(1.75, 0.92, 0.8),
    max: S3(2.4, 1.05, 0.92),
    tags: ['sleeper sofa', 'sofa bed', 'pull-out bed', 'sofa giường', 'guest room', 'convertible'],
    description: 'A three-seat sofa hiding a fold-out mattress: piped cushions, track arms and a deep front rail with a fabric pull strap for drawing out the bed frame.',
    finishes: [
      ['Grey weave & walnut', 'fabric-wool-grey', 'fabric-wool-grey', 'fabric-mustard', 'wood-walnut'],
      ['Oat & oak', 'fabric-boucle-oat', 'fabric-boucle-oat', 'fabric-linen-sage', 'wood-oak-light'],
      ['Navy & black', 'fabric-navy', 'fabric-navy', 'fabric-cream', 'metal-black-matte'],
      ['Blush & brass', 'fabric-blush', 'fabric-blush', 'fabric-cream', 'metal-brass'],
    ],
  }),
  couch({
    id: 'camelback-show-wood',
    name: 'Camelback sofa with show-wood rail',
    look: { arm: 'english', back: 'camel', base: 'legs', leg: 'cabriole', rail: 0.045, welt: true, pillows: 2 },
    layout: straight(1),
    size: S3(2.0, 0.9, 0.92),
    min: S3(1.6, 0.84, 0.86),
    max: S3(2.4, 1.0, 1.0),
    tags: ['camelback', 'camel back', 'traditional', 'chippendale', 'cabriole legs', 'bench seat', 'show wood'],
    description: 'A traditional camelback with a humped tight back, low English roll arms with scroll fronts, one long piped bench cushion, a polished show-wood rail and cabriole legs.',
    finishes: [
      ['Damask & mahogany', 'fabric-damask-cream', 'fabric-damask-cream', 'fabric-velvet-rust', 'wood-mahogany'],
      ['Sage linen & cherry', 'fabric-linen-sage', 'fabric-linen-sage', 'fabric-blush', 'wood-cherry'],
      ['Navy & walnut', 'fabric-navy', 'fabric-navy', 'fabric-cream', 'wood-walnut'],
      ['Floral & white', 'fabric-floral-print', 'fabric-floral-print', 'fabric-cream', 'wood-painted-white'],
    ],
    legsLabel: 'Show wood & legs',
  }),
  couch({
    id: 'tufted-tuxedo-3-seat',
    name: 'Button-tufted tuxedo sofa, 3-seat',
    look: { arm: 'tuxedo', back: 'tufted', base: 'legs', leg: 'cone', welt: true, tuftArms: true, pillows: 2 },
    layout: straight(3),
    size: S3(2.15, 0.9, 0.76),
    min: S3(1.6, 0.82, 0.7),
    max: S3(2.6, 1.0, 0.84),
    tags: ['tuxedo', 'button tufted', 'velvet', 'glam', 'art deco', 'cone legs'],
    description: 'A tailored tuxedo sofa whose arms are as high as the back, buttoned inside and out of the arms and across the back, with three piped seat cushions on brass cone legs.',
    finishes: [
      ['Navy velvet & brass', 'fabric-velvet-navy', 'fabric-velvet-navy', 'fabric-velvet-mustard', 'metal-brass'],
      ['Emerald velvet & gold', 'fabric-velvet-green', 'fabric-velvet-green', 'fabric-velvet-blush', 'metal-gold'],
      ['Blush velvet & brass', 'fabric-velvet-blush', 'fabric-velvet-blush', 'fabric-cream', 'metal-brass'],
      ['Grey wool & chrome', 'fabric-wool-grey', 'fabric-wool-grey', 'fabric-velvet-teal', 'metal-chrome'],
      ['Black leather & bronze', 'leather-smooth-black', 'leather-smooth-black', 'fabric-velvet-rust', 'metal-bronze'],
    ],
  }),
  couch({
    id: 'curved-loose-cushion',
    name: 'Curved four-seat sofa with loose cushions',
    build: curvedParts,
    size: S3(2.8, 1.3, 0.8),
    min: S3(2.3, 1.1, 0.74),
    max: S3(3.4, 1.5, 0.88),
    tags: ['curved', 'round', 'crescent', 'semicircle', 'conversation', 'statement', 'piping'],
    description: 'A crescent sofa for a round room or a conversation pit: a curved back frame, wedge-shaped seat cushions with piped fronts, leaning piped back cushions, round end arms and tapered legs.',
    finishes: [
      ['Oat bouclé & walnut', 'fabric-boucle-oat', 'fabric-boucle-oat', 'fabric-velvet-rust', 'wood-walnut'],
      ['Green velvet & brass', 'fabric-velvet-green', 'fabric-velvet-green', 'fabric-velvet-blush', 'metal-brass'],
      ['Cream bouclé & oak', 'fabric-boucle', 'fabric-boucle', 'fabric-linen-sage', 'wood-oak-light'],
      ['Teal velvet & black', 'fabric-velvet-teal', 'fabric-velvet-teal', 'fabric-velvet-mustard', 'metal-black-matte'],
    ],
  }),
  couch({
    id: 'slipcovered-linen-skirted',
    name: 'Slipcovered linen sofa with kick pleats',
    look: { arm: 'rolled', back: 'loose', base: 'skirt', welt: true, soft: 0.42, pillows: 4, armW: 0.19 },
    layout: straight(3),
    size: S3(2.2, 0.98, 0.86),
    min: S3(1.7, 0.88, 0.8),
    max: S3(2.7, 1.08, 0.94),
    tags: ['slipcover', 'linen', 'skirted', 'kick pleat', 'washable', 'cottage', 'coastal'],
    description: 'A relaxed sofa in a loose washable linen slipcover: soft rolled arms, slouchy piped cushions, four throw pillows and a skirt with kick pleats at the corners.',
    finishes: [
      ['Natural linen', 'fabric-linen', 'fabric-linen', 'fabric-linen-rust', 'fabric-linen'],
      ['White cotton', 'fabric-white-cotton', 'fabric-white-cotton', 'fabric-sky', 'fabric-white-cotton'],
      ['Sage linen', 'fabric-linen-sage', 'fabric-linen-sage', 'fabric-cream', 'fabric-linen-sage'],
      ['Rust linen', 'fabric-linen-rust', 'fabric-linen-rust', 'fabric-cream', 'fabric-linen-rust'],
    ],
    legsLabel: 'Skirt',
  }),
  couch({
    id: 'japandi-oak-base',
    name: 'Japandi sofa on a solid oak base',
    look: { arm: 'track', back: 'loose', base: 'woodbase', seatTop: 0.42, armW: 0.13, pillows: 2 },
    layout: straight(3),
    size: S3(2.1, 0.92, 0.78),
    min: S3(1.6, 0.85, 0.72),
    max: S3(2.6, 1.0, 0.86),
    tags: ['japandi', 'minimal', 'oak base', 'low sofa', 'scandinavian', 'japanese', 'wabi-sabi'],
    description: 'A low, calm sofa set on a solid oak base that shows as a ledge all round, with slim square arms and plain loose cushions without piping.',
    finishes: [
      ['Oat & natural oak', 'fabric-boucle-oat', 'fabric-boucle-oat', 'fabric-linen-sage', 'wood-oak-natural'],
      ['Linen & ash', 'fabric-linen', 'fabric-linen', 'fabric-olive', 'wood-ash-white'],
      ['Charcoal & smoked oak', 'fabric-charcoal', 'fabric-charcoal', 'fabric-cream', 'wood-dark-stain'],
      ['Olive & walnut', 'fabric-olive', 'fabric-olive', 'fabric-cream', 'wood-walnut'],
    ],
    legsLabel: 'Oak base',
  }),
];

export default definePack({
  name: 'Couches & sectionals',
  version: '1.0.0',
  author: 'Neest',
  description: 'Tailored couches with piped cushions: track-arm, Chesterfield, mid-century, cloud, camelback, tuxedo, curved and slipcovered sofas, L, chaise and U sectionals, and sofa beds.',
  license: 'CC0-1.0',
  items,
});

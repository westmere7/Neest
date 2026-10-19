/**
 * Studio & apartment beds — the beds that small modern homes are planned around.
 *
 * Wall beds: a vertical (Murphy) queen wall bed open and folded, a side-tilt single wall bed open and
 * folded (styled with books and a basket on top), a wall bed with a sofa in front, a wall bed with a
 * fold-over desk, and a wall bed set between two wardrobes under a bridge cabinet.
 * Loft & raised: an adult steel loft bed with a desk, a sofa or nothing underneath (model variants), a
 * loft bed with storage stairs and a wardrobe underneath, a raised sleeping platform with drawers and a
 * step (bục ngủ), and a tatami platform bed with a shoji headboard.
 * Modern frames: a black steel spindle bed, an oak-legged mattress bed with no headboard, a rattan cane
 * headboard bed, an arched bouclé bed, a floating bed with wrap-around nightstands, a black steel
 * canopy bed with sheer drapes and a pallet bed.
 * Guest & sofa beds: a pull-out sofa bed opened as a double, a fold-out foam chair bed, a folding
 * rollaway guest bed and an upholstered box daybed with bolsters.
 *
 * Mattress sizes follow what is sold in Vietnam (1.0 / 1.2 / 1.4 / 1.6 / 1.8 × 2.0 m).
 */
import {
  barPull,
  bookRow,
  box,
  cells,
  cellSpans,
  clamp,
  cushion,
  cyl,
  defineItem,
  definePack,
  line,
  matSlot,
  pillow,
  poly,
  rectPoly,
  rod,
  rodPath,
  rodX,
  rodZ,
  roundRectPoints,
  slats,
  spaced,
  span,
  sphere,
  torus,
  turnedLeg,
  vcyl,
  type BoxOpts,
  type Part,
  type PlanStroke,
  type Size3,
  type V2,
  type V3,
} from '@/packs/kit';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const NP = { plan: false } as const;
/** Panel thickness of cabinet carcasses. */
const T = 0.025;

/** Detail box (hidden from the plan) spanning x/y/z ranges, with an optional bevel. */
const sp = (slot: string, x: V2, y: V2, z: V2, bevel = 0): Part => span(slot, x, y, z, { bevel, plan: false });

/** A flat shape facing the front (+z): `pts` are [x, y] in metres, `t` thick from depth z. */
function plate(slot: string, pts: V2[], z: number, t: number): Part {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const mid = (Math.min(...ys) + Math.max(...ys)) / 2;
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

/** Outline [x, y] of a panel with square bottom corners and round top corners of radius r. */
function roundTop(x0: number, x1: number, y0: number, y1: number, r: number, n = 6): V2[] {
  const rr = Math.max(0.004, Math.min(r, (x1 - x0) / 2 - 0.001, y1 - y0 - 0.001));
  const pts: V2[] = [[x0, y0]];
  for (let i = 0; i <= n; i++) {
    const a = Math.PI - (i / n) * (Math.PI / 2);
    pts.push([x0 + rr + Math.cos(a) * rr, y1 - rr + Math.sin(a) * rr]);
  }
  for (let i = 0; i <= n; i++) {
    const a = Math.PI / 2 - (i / n) * (Math.PI / 2);
    pts.push([x1 - rr + Math.cos(a) * rr, y1 - rr + Math.sin(a) * rr]);
  }
  pts.push([x1, y0]);
  return pts;
}

/** Outline [x, y] of an arch: straight sides from y0 to ys, then a half-ellipse up to y1. */
function archOutline(x0: number, x1: number, y0: number, ys: number, y1: number, n = 18): V2[] {
  const cx = (x0 + x1) / 2;
  const rx = (x1 - x0) / 2;
  const pts: V2[] = [[x0, y0]];
  for (let i = 0; i <= n; i++) {
    const a = Math.PI - (i / n) * Math.PI;
    pts.push([cx + Math.cos(a) * rx, ys + Math.sin(a) * (y1 - ys)]);
  }
  pts.push([x1, y0]);
  return pts;
}

/** Gathered drape folds running along Z at x (drapeFolds only runs along X). */
function foldsZ(slot: string, x: number, y: V2, z: V2, n: number, depth: number): Part[] {
  const k = Math.max(1, Math.round(n));
  const cw = (z[1] - z[0]) / k;
  return cells(k, z[0], z[1]).map((cz) =>
    cyl(slot, [x, (y[0] + y[1]) / 2, cz], cw * 0.55, y[1] - y[0], { scale: [depth / (cw * 1.1), 1, 1], segments: 12, plan: false }),
  );
}

// ---------------------------------------------------------------------------
// Bedding
// ---------------------------------------------------------------------------

interface Dress {
  /** Mattress extent across the bed (x, or z when `axis` is 'x'). */
  a: V2;
  /** Mattress extent along the bed, head end first (z, or x when `axis` is 'x'). */
  l: V2;
  y0: number;
  top: number;
  /** Highest point the dressing may reach (pillows shrink to stay under it). */
  yMax: number;
  /** 'z' (default): head against the back wall. 'x': long side against the wall, head at -x. */
  axis?: 'z' | 'x';
  sheet: string;
  duvet: string;
  /** Slot of the mattress body; defaults to the sheet. */
  mattress?: string;
  accent?: string;
  /** Duvet overhang past the mattress sides, and past its foot. */
  over?: number;
  overFoot?: number;
  pillows?: number;
  /** Euro shams behind the sleeping pillows (when there is headroom). */
  euro?: boolean;
  /** Pillows lying flat (no headboard to lean on). */
  flat?: boolean;
  /** Accent cushions in front of the pillows. */
  cushions?: number;
  /** Throw folded across the foot (accent slot). */
  throwBlanket?: boolean;
  /** Blanket folded into a stack at the foot instead of a spread duvet (guest beds). */
  stacked?: boolean;
}

/** Part builders in bed space: a = across, l = along (head first), mapped onto x/z by the axis. */
function bedSpace(axis: 'z' | 'x') {
  const sw = axis === 'x';
  const S = (slot: string, a: V2, y: V2, l: V2, opts?: BoxOpts): Part => (sw ? span(slot, l, y, a, opts) : span(slot, a, y, l, opts));
  return {
    S,
    /** Soft block: edges rounded by `soft` × its thinnest side. */
    C: (slot: string, a: V2, y: V2, l: V2, soft: number, plan = false): Part => {
      const m = Math.min(a[1] - a[0], y[1] - y[0], l[1] - l[0]);
      return S(slot, a, y, l, { bevel: m * soft, plan });
    },
    R: (slot: string, a0: number, a1: number, y: number, at: number, r: number): Part =>
      sw ? rodZ(slot, at, y, a0, a1, r, NP) : rodX(slot, a0, a1, y, at, r, NP),
    /** Pillow `w` across, `h` tall and `t` thick, its top leaning towards the head by `lean`. */
    P: (slot: string, a: number, y: number, l: number, w: number, h: number, t: number, lean: number, turn = 0): Part =>
      sw ? sphere(slot, [l, y, a], 0.5, { scale: [t, h, w], rotation: [0, turn, lean], plan: false }) : pillow(slot, [a, y, l], w, h, t, { lean, turn }),
    pt: (a: number, l: number): V2 => (sw ? [l, a] : [a, l]),
  };
}

/** Pillow height that keeps a leaning pillow, sunk 3 cm into the mattress, within `avail` of height. */
const fitPillow = (avail: number, want: number, t: number, lean: number): number =>
  clamp((avail - t * Math.sin(lean)) / Math.cos(lean), 0.1, want);
/** Centre height of a leaning pillow sitting 3 cm into a mattress whose top is at `top`. */
const pillowY = (top: number, h: number, t: number, lean: number): number => top - 0.03 + (h * Math.cos(lean) + t * Math.sin(lean)) / 2;

function duvetFold(d: Dress): number {
  const len = d.l[1] - d.l[0];
  return d.l[0] + clamp(len * 0.27, 0.4, 0.6);
}

function pillowCount(d: Dress): number {
  return d.pillows ?? (d.a[1] - d.a[0] >= 1.15 ? 2 : 1);
}

function pillowWidth(d: Dress, n: number): number {
  const mw = d.a[1] - d.a[0];
  return n === 1 ? Math.min(0.66, mw - 0.1) : Math.min(0.7, mw / n - 0.04);
}

/** Mattress, duvet with a turned-down sheet (or a folded blanket), pillows, cushions and a throw. */
function dressBed(d: Dress): Part[] {
  const { S, C, R, P } = bedSpace(d.axis ?? 'z');
  const [a0, a1] = d.a;
  const [l0, l1] = d.l;
  const t = d.top;
  const o = d.over ?? 0.025;
  const of = d.overFoot ?? o;
  const mw = a1 - a0;
  const len = l1 - l0;
  const parts: Part[] = [C(d.mattress ?? d.sheet, d.a, [d.y0, t], d.l, 0.2, true)];
  const drop = Math.max(d.y0 + 0.03, t - 0.2);
  if (d.stacked) {
    const fl: V2 = [l1 - Math.min(0.5, len * 0.3), l1 - 0.1];
    const fa: V2 = [a0 + mw * 0.12, a1 - mw * 0.12];
    parts.push(
      C(d.duvet, fa, [t - 0.005, t + 0.035], fl, 0.4),
      C(d.duvet, [fa[0] + 0.012, fa[1] - 0.012], [t + 0.03, t + 0.068], [fl[0] + 0.01, fl[1] - 0.012], 0.45),
      R(d.duvet, fa[0] + 0.03, fa[1] - 0.03, t + 0.034, fl[1] - 0.012, 0.018),
    );
  } else {
    const fold = duvetFold(d);
    const side = { bevel: 0.006, plan: false };
    parts.push(
      C(d.duvet, [a0 - o * 0.6, a1 + o * 0.6], [t - 0.012, t + 0.05], [fold, l1 + of * 0.6], 0.4),
      S(d.duvet, [a0 - o, a0 - o + 0.016], [drop, t + 0.035], [fold + 0.03, l1 + of - 0.01], side),
      S(d.duvet, [a1 + o - 0.016, a1 + o], [drop, t + 0.035], [fold + 0.03, l1 + of - 0.01], side),
      S(d.duvet, [a0 - o + 0.01, a1 + o - 0.01], [drop, t + 0.035], [l1 + of - 0.016, l1 + of], side),
      // Folded-back top edge and the sheet turned down over it.
      C(d.duvet, [a0 - o * 0.8, a1 + o * 0.8], [t + 0.035, t + 0.085], [fold, fold + 0.22], 0.45),
      C(d.sheet, [a0 - 0.004, a1 + 0.004], [t + 0.075, t + 0.093], [fold + 0.02, fold + 0.12], 0.45),
    );
    if (l1 - 0.2 > fold + 0.55) for (const l of spaced(2, fold + 0.45, l1 - 0.2)) parts.push(R(d.duvet, a0 - o * 0.4, a1 + o * 0.4, t + 0.049, l, 0.006));
  }
  // Pillows.
  const n = pillowCount(d);
  const pw = pillowWidth(d, n);
  const avail = d.yMax - t + 0.03;
  let front = l0 + 0.3;
  if (d.flat) {
    const ph = fitPillow(avail, 0.13, 0.42, 0.06);
    for (const pa of cells(n, a0, a1)) parts.push(P(d.sheet, pa, pillowY(t, ph, 0.42, 0.06), l0 + 0.25, pw, ph, 0.42, 0.06));
    front = l0 + 0.5;
  } else if (d.euro && avail >= 0.5) {
    const eh = fitPillow(avail, 0.45, 0.16, 0.18);
    const ew = n === 1 ? Math.min(0.62, mw - 0.08) : Math.min(0.66, mw / n - 0.03);
    for (const pa of cells(n, a0, a1)) parts.push(P(d.sheet, pa, pillowY(t, eh, 0.16, 0.18), l0 + 0.12, ew, eh, 0.16, 0.18));
    const ph = fitPillow(avail, 0.34, 0.14, 0.5);
    for (const pa of cells(n, a0, a1)) parts.push(P(d.sheet, pa, pillowY(t, ph, 0.14, 0.5), l0 + 0.3, pw * 0.96, ph, 0.14, 0.5));
    front = l0 + 0.45;
  } else {
    const ph = fitPillow(avail, 0.34, 0.14, 0.45);
    for (const pa of cells(n, a0, a1)) parts.push(P(d.sheet, pa, pillowY(t, ph, 0.14, 0.45), l0 + 0.14, pw, ph, 0.14, 0.45));
  }
  const acc = d.accent;
  if (acc && d.cushions && !d.flat) {
    const k = Math.min(d.cushions, mw >= 1.15 ? 3 : 1);
    const cw = Math.min(0.44, (mw - 0.1) / k);
    const ch = fitPillow(avail - 0.01, 0.36, 0.13, 0.32);
    cells(k, a0 + 0.05, a1 - 0.05).forEach((pa, i) => {
      parts.push(P(acc, pa, pillowY(t, ch, 0.13, 0.32), front, cw, ch, 0.13, 0.32, k > 1 ? (i - (k - 1) / 2) * 0.14 : 0));
    });
  }
  if (acc && d.throwBlanket && !d.stacked) {
    const tl: V2 = [l1 - Math.min(0.52, len * 0.27), l1 - 0.16];
    const td = Math.max(d.y0 + 0.08, t - 0.17);
    const side = { bevel: 0.005, plan: false };
    parts.push(
      C(acc, [a0 - o - 0.006, a1 + o + 0.006], [t + 0.045, t + 0.072], tl, 0.4),
      S(acc, [a0 - o - 0.02, a0 - o - 0.006], [td, t + 0.072], tl, side),
      S(acc, [a1 + o + 0.006, a1 + o + 0.02], [td, t + 0.072], tl, side),
    );
  }
  return parts;
}

/** Plan strokes for a dressed bed: mattress, duvet fold with a turned corner, pillows. */
function dressPlan(d: Dress): PlanStroke[] {
  const { pt } = bedSpace(d.axis ?? 'z');
  const [a0, a1] = d.a;
  const [l0, l1] = d.l;
  const L = (a: number, l: number, a2: number, l2: number) => line(pt(a, l), pt(a2, l2));
  const strokes: PlanStroke[] = [poly([pt(a0, l0), pt(a1, l0), pt(a1, l1), pt(a0, l1)])];
  if (d.stacked) {
    const f0 = l1 - Math.min(0.5, (l1 - l0) * 0.3);
    const m = (a1 - a0) * 0.12;
    strokes.push(poly([pt(a0 + m, f0), pt(a1 - m, f0), pt(a1 - m, l1 - 0.1), pt(a0 + m, l1 - 0.1)]));
  } else {
    const f = duvetFold(d);
    strokes.push(L(a0, f, a1, f), L(a0, f + 0.22, a1, f + 0.22));
    const c = Math.min(0.3, (a1 - a0) * 0.3, l1 - f - 0.3);
    if (c > 0.05) strokes.push(L(a1 - c, f + 0.22, a1, f + 0.22 + c));
  }
  const n = pillowCount(d);
  const pw = pillowWidth(d, n);
  const [lc, dep] = d.flat ? [l0 + 0.25, 0.4] : [l0 + 0.17, 0.3];
  for (const pa of cells(n, a0, a1)) strokes.push(poly(roundRectPoints(pa, lc, pw, dep, 0.06).map(([a, l]) => pt(a, l))));
  return strokes;
}

// ---------------------------------------------------------------------------
// Wall-bed cabinets
// ---------------------------------------------------------------------------

interface Cabinet {
  xa: number;
  xb: number;
  /** Back of the cabinet (against the wall) and its depth. */
  z0: number;
  cd: number;
  h: number;
  /** Height of the fascia over the bed opening. */
  header: number;
  /** false when wardrobes either side are the cabinet's sides. */
  sides?: boolean;
}

/** Wall-bed cabinet carcass: back, sides, crown and the header fascia over the opening. */
function wallCabinet(slot: string, c: Cabinet): Part[] {
  const { xa, xb, z0, cd, h, header } = c;
  const zf = z0 + cd;
  // Without sides the wardrobes either side are the walls: keep back and crown between them.
  const cx: V2 = c.sides === false ? [xa + T, xb - T] : [xa, xb];
  const parts: Part[] = [sp(slot, cx, [0, h - 0.03], [z0, z0 + 0.018])];
  if (c.sides !== false) {
    parts.push(span(slot, [xa, xa + T], [0, h - 0.03], [z0, zf], { bevel: 0.003 }), span(slot, [xb - T, xb], [0, h - 0.03], [z0, zf], { bevel: 0.003 }));
  }
  parts.push(
    span(slot, cx, [h - 0.03, h], [z0, zf], { bevel: 0.004 }),
    sp(slot, [xa + T, xb - T], [h - header, h - 0.03], [zf - 0.02, zf], 0.002),
    sp(slot, [xa + T, xb - T], [h - header - 0.018, h - header], [z0 + 0.018, zf - 0.02]),
  );
  return parts;
}

/**
 * Face of a folded wall bed, recessed 12 mm into the cabinet: faux door panels (`cols` × `rows`), the
 * folded leg board as a strip across the top and bar pulls on it at x = `pulls`.
 */
function wallBedFace(front: string, metal: string, xa: number, xb: number, zf: number, yTop: number, cols: number, rows: number, pulls: number[]): Part[] {
  const x0 = xa + T + 0.003;
  const x1 = xb - T - 0.003;
  const legY = yTop - 0.16;
  const z: V2 = [zf - 0.032, zf - 0.012];
  const parts: Part[] = [
    sp(front, [x0, x1], [0.1, yTop - 0.004], [zf - 0.05, zf - 0.034]),
    sp(front, [x0, x1], [legY + 0.003, yTop - 0.004], z, 0.003),
  ];
  for (const [a, b] of cellSpans(cols, x0, x1)) {
    for (const [c, e] of cellSpans(rows, 0.1, legY)) parts.push(sp(front, [a + 0.002, b - 0.002], [c + 0.002, e - 0.002], z, 0.003));
  }
  const len = Math.min(0.6, ((x1 - x0) / Math.max(1, pulls.length)) * 0.5);
  for (const px of pulls) parts.push(...barPull(metal, [px, (legY + yTop) / 2, zf - 0.012], len, { stand: 0.022 }));
  return parts;
}

/** Recessed kick under a cabinet front. */
const kick = (slot: string, xa: number, xb: number, zf: number): Part => sp(slot, [xa + T, xb - T], [0, 0.09], [zf - 0.07, zf - 0.05]);

/** The lowered bed box of a wall bed: underside panel, rails, deck and the fold-down leg board. */
function wallBedBox(slot: string, x: V2, z: V2, legs: V2[]): Part[] {
  const [x0, x1] = x;
  const [z0, z1] = z;
  const r = 0.022;
  const y: V2 = [0.122, 0.36];
  const parts: Part[] = [
    span(slot, x, [0.1, 0.122], z, { bevel: 0.004 }),
    sp(slot, [x0, x0 + r], y, z, 0.003),
    sp(slot, [x1 - r, x1], y, z, 0.003),
    sp(slot, [x0 + r, x1 - r], y, [z1 - r, z1], 0.003),
    sp(slot, [x0 + r, x1 - r], y, [z0, z0 + r], 0.003),
    sp(slot, [x0 + r, x1 - r], [0.28, 0.3], [z0 + r, z1 - r]),
  ];
  for (const [la, lb] of legs) parts.push(sp(slot, [la, lb], [0, 0.1], [z1 - 0.12, z1 - 0.1], 0.003));
  return parts;
}

/** A vertical wall bed, lowered: cabinet (optionally without sides) and the bed box reaching the front. */
function openWallBed(slot: string, xa: number, xb: number, d: number, h: number, cd: number, sides = true) {
  const z0 = -d / 2;
  const x: V2 = [xa + T + 0.012, xb - T - 0.012];
  const z: V2 = [z0 + 0.04, d / 2];
  const parts = [...wallCabinet(slot, { xa, xb, z0, cd, h, header: 0.2, sides }), ...wallBedBox(slot, x, z, [[x[0] + 0.06, x[1] - 0.06]])];
  return { parts, a: [x[0] + 0.03, x[1] - 0.03] as V2, l: [z[0] + 0.03, z[1] - 0.03] as V2 };
}

const BED_SLOTS = (frame: [string, string], duvet = 'fabric-linen', accent?: [string, string]) => [
  matSlot('frame', frame[0], frame[1]),
  matSlot('bedding', 'Sheets & pillows', 'fabric-white-cotton'),
  matSlot('duvet', 'Duvet', duvet),
  ...(accent ? [matSlot('accent', accent[0], accent[1])] : []),
];

// ---------------------------------------------------------------------------
// 1–2. Vertical wall bed (Murphy), open and folded
// ---------------------------------------------------------------------------

const MURPHY_CD = 0.45;

function murphyDress({ w, d, h }: Size3): Dress {
  const g = openWallBed('frame', -w / 2, w / 2, d, h, MURPHY_CD);
  return { a: g.a, l: g.l, y0: 0.3, top: 0.53, yMax: h, sheet: 'bedding', duvet: 'duvet', accent: 'accent', over: 0.02, cushions: 2, throwBlanket: true };
}

const murphyOpen = defineItem({
  id: 'wall-bed-vertical-open',
  name: 'Vertical wall bed (Murphy), open',
  category: 'bedroom',
  type: 'beds',
  group: 'Wall beds',
  description:
    'A queen wall bed lowered out of its laminate cabinet: the bed box rests on a fold-down leg board, with the header fascia and cabinet sides framing the pillows. Folded, it is only 45 cm deep.',
  tags: ['wall bed', 'murphy bed', 'fold-down bed', 'space saving', 'studio', 'queen', 'giường âm tường', 'giường gấp thông minh', 'giường lật'],
  defaultSize: { w: 1.76, d: 2.15, h: 2.15 },
  minSize: { w: 1.06, d: 2.05, h: 2.0 },
  maxSize: { w: 2.0, d: 2.35, h: 2.4 },
  wallSnap: true,
  slots: BED_SLOTS(['Cabinet & bed box', 'laminate-oak'], 'fabric-linen', ['Throw & cushions', 'fabric-mustard']),
  build: (size) => {
    const { w, d, h } = size;
    return [...openWallBed('frame', -w / 2, w / 2, d, h, MURPHY_CD).parts, ...dressBed(murphyDress(size))];
  },
  planDetail: (size) => [...dressPlan(murphyDress(size)), line([-size.w / 2, -size.d / 2 + MURPHY_CD], [size.w / 2, -size.d / 2 + MURPHY_CD])],
});

/** Plan arrow pointing to the front: the bed folds out this way. */
function foldArrow(d: number): PlanStroke[] {
  const tip: V2 = [0, d / 2 - 0.05];
  return [line([0, -d / 2 + 0.08], tip), line([-0.06, tip[1] - 0.07], tip), line([0.06, tip[1] - 0.07], tip)];
}

const murphyClosed = defineItem({
  id: 'wall-bed-vertical-closed',
  name: 'Vertical wall bed (Murphy), folded',
  category: 'bedroom',
  type: 'beds',
  group: 'Wall beds',
  variantOf: 'wall-bed-vertical-open',
  description:
    'The same queen wall bed folded away: a 45 cm deep laminate cabinet whose face looks like four door panels under the leg-board strip and its long bar pull. Pulled down, the bed reaches about 2.15 m into the room.',
  tags: ['wall bed', 'murphy bed', 'folded', 'cabinet bed', 'space saving', 'studio', 'giường âm tường', 'giường gấp thông minh'],
  defaultSize: { w: 1.76, d: 0.45, h: 2.15 },
  minSize: { w: 1.06, d: 0.4, h: 2.0 },
  maxSize: { w: 2.0, d: 0.55, h: 2.4 },
  wallSnap: true,
  slots: [matSlot('cabinet', 'Cabinet', 'laminate-oak'), matSlot('front', 'Bed front panels', 'laminate-white-matte'), matSlot('metal', 'Handle', 'metal-black-matte')],
  build: ({ w, d, h }) => [
    ...wallCabinet('cabinet', { xa: -w / 2, xb: w / 2, z0: -d / 2, cd: d, h, header: 0.2 }),
    kick('cabinet', -w / 2, w / 2, d / 2),
    ...wallBedFace('front', 'metal', -w / 2, w / 2, d / 2, h - 0.2, w > 1.3 ? 2 : 1, 2, [0]),
  ],
  planDetail: ({ d }) => foldArrow(d),
});

// ---------------------------------------------------------------------------
// 3–4. Side-tilt single wall bed, open and folded
// ---------------------------------------------------------------------------

const SIDE_CD = 0.4;

function sideTiltGeom({ w, d }: Size3) {
  const x: V2 = [-w / 2 + T + 0.012, w / 2 - T - 0.012];
  const z: V2 = [-d / 2 + 0.04, d / 2];
  return { x, z, a: [z[0] + 0.03, z[1] - 0.03] as V2, l: [x[0] + 0.03, x[1] - 0.03] as V2 };
}

function sideTiltDress(size: Size3): Dress {
  const g = sideTiltGeom(size);
  return { a: g.a, l: g.l, y0: 0.3, top: 0.51, yMax: size.h, axis: 'x', sheet: 'bedding', duvet: 'duvet', accent: 'accent', over: 0.02, flat: true, pillows: 1, throwBlanket: true };
}

const sideTiltOpen = defineItem({
  id: 'wall-bed-side-tilt-open',
  name: 'Side-tilt single wall bed, open',
  category: 'bedroom',
  type: 'beds',
  group: 'Wall beds',
  description:
    'A single wall bed that folds sideways into a low 40 cm cabinet, shown lowered: the long side stays against the wall and two leg boards drop at the front. Good under a window or in a home office.',
  tags: ['wall bed', 'horizontal murphy bed', 'side tilt', 'single', 'guest bed', 'space saving', 'giường âm tường ngang', 'giường gấp thông minh'],
  defaultSize: { w: 2.14, d: 1.12, h: 1.2 },
  minSize: { w: 2.05, d: 1.0, h: 1.05 },
  maxSize: { w: 2.3, d: 1.5, h: 1.6 },
  wallSnap: true,
  slots: BED_SLOTS(['Cabinet & bed box', 'laminate-white-matte'], 'fabric-linen-sage', ['Throw', 'fabric-terracotta']),
  build: (size) => {
    const { w, d, h } = size;
    const g = sideTiltGeom(size);
    const legs: V2[] = [-1, 1].map((s) => [s * (w / 2 - 0.4) - 0.16, s * (w / 2 - 0.4) + 0.16] as V2);
    return [...wallCabinet('frame', { xa: -w / 2, xb: w / 2, z0: -d / 2, cd: SIDE_CD, h, header: 0.14 }), ...wallBedBox('frame', g.x, g.z, legs), ...dressBed(sideTiltDress(size))];
  },
  planDetail: (size) => [...dressPlan(sideTiltDress(size)), line([-size.w / 2, -size.d / 2 + SIDE_CD], [size.w / 2, -size.d / 2 + SIDE_CD])],
});

const sideTiltClosed = defineItem({
  id: 'wall-bed-side-tilt-closed',
  name: 'Side-tilt single wall bed, folded',
  category: 'bedroom',
  type: 'beds',
  group: 'Wall beds',
  variantOf: 'wall-bed-side-tilt-open',
  description:
    'The side-tilt single wall bed folded up: a long, low cabinet with three faux door panels and two bar pulls, styled with books and a rattan basket on top. It opens into a 90 × 200 cm bed.',
  tags: ['wall bed', 'horizontal murphy bed', 'folded', 'sideboard', 'single', 'space saving', 'giường âm tường ngang'],
  defaultSize: { w: 2.14, d: 0.4, h: 1.2 },
  minSize: { w: 2.05, d: 0.36, h: 1.05 },
  maxSize: { w: 2.3, d: 0.5, h: 1.6 },
  wallSnap: true,
  slots: [matSlot('cabinet', 'Cabinet', 'laminate-white-matte'), matSlot('front', 'Bed front panels', 'laminate-oak'), matSlot('metal', 'Handles', 'metal-brass')],
  build: ({ w, d, h }) => [
    ...wallCabinet('cabinet', { xa: -w / 2, xb: w / 2, z0: -d / 2, cd: d, h, header: 0.14 }),
    kick('cabinet', -w / 2, w / 2, d / 2),
    ...wallBedFace('front', 'metal', -w / 2, w / 2, d / 2, h - 0.14, 3, 1, [-w / 4, w / 4]),
  ],
  planDetail: ({ d }) => foldArrow(d),
  models: [
    {
      id: 'styled',
      name: 'Styled',
      slots: [matSlot('books', 'Books', 'book-mix'), matSlot('basket', 'Basket', 'rattan-natural')],
      props: ({ w, d, h }) => [
        ...bookRow('books', [w / 2 - 0.75, w / 2 - 0.25], h, -d / 2 + 0.03, 0.24, Math.min(0.17, d - 0.08), 7, { lean: true }),
        span('basket', [-w / 2 + 0.2, -w / 2 + 0.52], [h, h + 0.2], [-d / 2 + 0.04, d / 2 - 0.06], { bevel: 0.02 }),
        box('books', [-w / 2 + 0.75, h + 0.03, -d / 2 + 0.16], [0.24, 0.06, 0.17], { rotation: [0, 0.25, 0], bevel: 0.003 }),
      ],
    },
    { id: 'bare', name: 'Bare' },
  ],
});

// ---------------------------------------------------------------------------
// 5. Wall bed with a sofa in front (sofa mode)
// ---------------------------------------------------------------------------

const FRONT_CD = 0.42;

const wallBedSofa = defineItem({
  id: 'wall-bed-sofa',
  name: 'Wall bed with sofa, sofa mode',
  category: 'bedroom',
  type: 'beds',
  group: 'Wall beds',
  description:
    'A queen wall bed folded into its cabinet with an upholstered sofa in front: the bed swings down over the sofa without moving the cushions, so a studio living room becomes a bedroom in seconds.',
  tags: ['wall bed', 'murphy bed with sofa', 'sofa bed', 'transforming furniture', 'studio', 'giường âm tường kèm sofa', 'sofa giường thông minh'],
  defaultSize: { w: 1.8, d: 1.0, h: 2.15 },
  minSize: { w: 1.5, d: 0.92, h: 2.0 },
  maxSize: { w: 2.1, d: 1.1, h: 2.4 },
  wallSnap: true,
  slots: [
    matSlot('cabinet', 'Cabinet & bed front', 'laminate-white-matte'),
    matSlot('upholstery', 'Sofa upholstery', 'fabric-wool-grey'),
    matSlot('cushions', 'Throw pillows', 'fabric-mustard'),
    matSlot('metal', 'Handle & legs', 'metal-black-matte'),
  ],
  build: ({ w, d, h }) => {
    const z0 = -d / 2;
    const zf = z0 + FRONT_CD;
    const aw = 0.14;
    const sx: V2 = [-w / 2 + aw, w / 2 - aw];
    const parts: Part[] = [
      ...wallCabinet('cabinet', { xa: -w / 2, xb: w / 2, z0, cd: FRONT_CD, h, header: 0.2 }),
      ...wallBedFace('cabinet', 'metal', -w / 2, w / 2, zf, h - 0.2, 2, 2, [0]),
      span('upholstery', sx, [0.1, 0.28], [zf, d / 2 - 0.02], { bevel: 0.01 }),
    ];
    for (const s of [-1, 1]) {
      const x: V2 = s < 0 ? [-w / 2, -w / 2 + aw] : [w / 2 - aw, w / 2];
      parts.push(cushion('upholstery', x, [0.08, 0.62], [zf, d / 2], { softness: 0.3 }));
      for (const z of [zf + 0.05, d / 2 - 0.05]) parts.push(vcyl('metal', (x[0] + x[1]) / 2, z, 0, 0.085, 0.016, NP));
    }
    const n = w >= 1.7 ? 3 : 2;
    for (const [a, b] of cellSpans(n, sx[0], sx[1])) {
      parts.push(
        cushion('upholstery', [a + 0.004, b - 0.004], [0.28, 0.45], [zf + 0.16, d / 2 - 0.01], { softness: 0.35, plan: false }),
        cushion('upholstery', [a + 0.006, b - 0.006], [0.42, 0.88], [zf + 0.025, zf + 0.185], { softness: 0.4, rotation: [-0.1, 0, 0], plan: false }),
      );
    }
    for (const s of [-1, 1]) parts.push(pillow('cushions', [s * (w / 2 - aw - 0.26), 0.62, zf + 0.27], 0.42, 0.4, 0.13, { lean: 0.3, turn: s * 0.2 }));
    return parts;
  },
  planDetail: ({ w, d }) => {
    const zf = -d / 2 + FRONT_CD;
    const strokes: PlanStroke[] = [line([-w / 2, zf], [w / 2, zf]), line([-w / 2 + 0.14, zf + 0.16], [w / 2 - 0.14, zf + 0.16])];
    for (const [a] of cellSpans(w >= 1.7 ? 3 : 2, -w / 2 + 0.14, w / 2 - 0.14).slice(1)) strokes.push(line([a, zf + 0.16], [a, d / 2 - 0.01]));
    return strokes;
  },
});

// ---------------------------------------------------------------------------
// 6. Wall bed with a fold-over desk (desk mode)
// ---------------------------------------------------------------------------

const wallBedDesk = defineItem({
  id: 'wall-bed-desk',
  name: 'Wall bed with fold-over desk, desk mode',
  category: 'bedroom',
  type: 'beds',
  group: 'Wall beds',
  description:
    'A queen wall bed folded away behind an oak-laminate desk and bookshelf that stay level while the bed comes down over them. White cabinet, black steel legs and handle.',
  tags: ['wall bed', 'murphy bed with desk', 'home office', 'transforming furniture', 'studio', 'giường âm tường kèm bàn', 'giường gấp thông minh kèm bàn làm việc'],
  defaultSize: { w: 1.8, d: 0.95, h: 2.15 },
  minSize: { w: 1.5, d: 0.85, h: 2.0 },
  maxSize: { w: 2.1, d: 1.05, h: 2.4 },
  wallSnap: true,
  slots: [
    matSlot('cabinet', 'Cabinet & bed front', 'laminate-white-matte'),
    matSlot('desk', 'Desk & shelf', 'laminate-oak'),
    matSlot('metal', 'Legs, handle & laptop', 'metal-black-matte'),
    matSlot('books', 'Books', 'book-mix'),
  ],
  build: ({ w, d, h }) => {
    const z0 = -d / 2;
    const zf = z0 + FRONT_CD;
    const dx: V2 = [-w / 2 + 0.1, w / 2 - 0.1];
    const parts: Part[] = [
      ...wallCabinet('cabinet', { xa: -w / 2, xb: w / 2, z0, cd: FRONT_CD, h, header: 0.2 }),
      kick('cabinet', -w / 2, w / 2, zf),
      ...wallBedFace('cabinet', 'metal', -w / 2, w / 2, zf, h - 0.2, 2, 2, [0]),
      // Desk top on the face, its front lip and two steel legs.
      span('desk', dx, [0.725, 0.75], [zf - 0.012, d / 2], { bevel: 0.004 }),
      sp('desk', dx, [0.69, 0.725], [d / 2 - 0.04, d / 2 - 0.02]),
      // Shelf with two brackets, books and a lying stack.
      sp('desk', [dx[0] + 0.05, dx[1] - 0.05], [1.12, 1.14], [zf - 0.012, zf + 0.22], 0.003),
      ...bookRow('books', [dx[0] + 0.1, dx[0] + 0.62], 1.14, zf - 0.008, 0.22, 0.17, 11, { lean: true }),
      box('books', [dx[1] - 0.3, 1.155, zf + 0.1], [0.24, 0.03, 0.17], { rotation: [0, 0.15, 0], bevel: 0.003 }),
      box('books', [dx[1] - 0.3, 1.18, zf + 0.1], [0.21, 0.025, 0.15], { rotation: [0, -0.1, 0], bevel: 0.003 }),
      // A closed laptop on the desk.
      sp('metal', [-0.1, 0.22], [0.75, 0.767], [zf + 0.12, zf + 0.34], 0.004),
    ];
    for (const x of [dx[0] + 0.04, dx[1] - 0.04]) {
      parts.push(vcyl('metal', x, d / 2 - 0.05, 0, 0.69, 0.014, NP));
      parts.push(sp('metal', [x - 0.003, x + 0.003], [1.04, 1.12], [zf - 0.012, zf + 0.15]));
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const zf = -d / 2 + FRONT_CD;
    return [line([-w / 2, zf], [w / 2, zf]), rectPoly(-w / 2 + 0.1, zf, w / 2 - 0.1, d / 2)];
  },
});

// ---------------------------------------------------------------------------
// 7. Wall bed between two wardrobes
// ---------------------------------------------------------------------------

const WARD_D = 0.58;

function wardrobeBedGeom({ w, d, h }: Size3) {
  const bc = clamp(w - 1.1, 1.06, 2.0);
  const ww = (w - bc) / 2;
  const hb = Math.min(h, 2.15);
  const g = openWallBed('cabinet', -bc / 2 - T, bc / 2 + T, d, hb, WARD_D, false);
  return { bc, ww, hb, g };
}

function wardrobeBedDress(size: Size3): Dress {
  const { g, hb } = wardrobeBedGeom(size);
  return { a: g.a, l: g.l, y0: 0.3, top: 0.53, yMax: hb, sheet: 'bedding', duvet: 'duvet', over: 0.02, euro: true };
}

const wallBedWardrobes = defineItem({
  id: 'wall-bed-wardrobes',
  name: 'Wall bed between wardrobes, open',
  category: 'bedroom',
  type: 'beds',
  group: 'Wall beds',
  description:
    'A full wall of storage around a lowered queen wall bed: two tall oak-door wardrobes either side and a bridge cabinet above, all in white laminate. Folded, the whole wall is under 60 cm deep.',
  tags: ['wall bed', 'murphy bed', 'wardrobe wall', 'bridge cabinet', 'storage', 'studio', 'giường âm tường kèm tủ áo', 'tủ giường thông minh'],
  defaultSize: { w: 2.9, d: 2.15, h: 2.4 },
  minSize: { w: 2.5, d: 2.05, h: 2.15 },
  maxSize: { w: 3.4, d: 2.35, h: 2.7 },
  wallSnap: true,
  slots: [
    matSlot('cabinet', 'Carcass & bed box', 'laminate-white-matte'),
    matSlot('front', 'Wardrobe doors', 'laminate-oak'),
    matSlot('bedding', 'Sheets & pillows', 'fabric-white-cotton'),
    matSlot('duvet', 'Duvet', 'fabric-wool-grey'),
  ],
  build: (size) => {
    const { w, d, h } = size;
    const { bc, ww, hb, g } = wardrobeBedGeom(size);
    const z0 = -d / 2;
    const zf = z0 + WARD_D;
    const parts: Part[] = [...g.parts];
    for (const s of [-1, 1]) {
      const x: V2 = s < 0 ? [-w / 2, -bc / 2] : [bc / 2, w / 2];
      parts.push(span('cabinet', x, [0, h], [z0, zf - 0.02], { bevel: 0.003 }), sp('cabinet', [x[0] + 0.01, x[1] - 0.01], [0, 0.07], [zf - 0.03, zf - 0.02]));
      const doors = cellSpans(ww > 0.62 ? 2 : 1, x[0], x[1]);
      doors.forEach(([a, b], i) => {
        parts.push(sp('front', [a + 0.002, b - 0.002], [0.075, h - 0.003], [zf - 0.02, zf], 0.003));
        // Pull on the edge nearest the bed for single doors, on the meeting stiles for pairs.
        const inner = doors.length === 1 ? (s < 0 ? b - 0.05 : a + 0.05) : i === 0 ? b - 0.04 : a + 0.04;
        parts.push(...barPull('cabinet', [inner, 1.05, zf], 0.42, { vertical: true, stand: 0.012 }));
      });
    }
    if (h - hb >= 0.15) {
      parts.push(sp('cabinet', [-bc / 2, bc / 2], [hb, h], [z0, zf - 0.02]));
      for (const [a, b] of cellSpans(2, -bc / 2, bc / 2)) {
        parts.push(sp('front', [a + 0.002, b - 0.002], [hb + 0.003, h - 0.003], [zf - 0.02, zf], 0.003));
        parts.push(...barPull('cabinet', [(a + b) / 2, hb + 0.05, zf], Math.min(0.3, (b - a) * 0.4), { stand: 0.012 }));
      }
    }
    parts.push(...dressBed(wardrobeBedDress(size)));
    return parts;
  },
  planDetail: (size) => {
    const { bc } = wardrobeBedGeom(size);
    const zf = -size.d / 2 + WARD_D;
    return [...dressPlan(wardrobeBedDress(size)), line([-size.w / 2, zf], [-bc / 2, zf]), line([bc / 2, zf], [size.w / 2, zf])];
  },
});

// ---------------------------------------------------------------------------
// 8. Adult steel loft bed (desk, sofa or nothing underneath)
// ---------------------------------------------------------------------------

function loftGeom({ w, d, h }: Size3) {
  const deck = h - 0.45;
  return { deck, lad: w / 2 - 0.5, px: w / 2 - 0.025, pz: d / 2 - 0.025 };
}

function loftDress(size: Size3): Dress {
  const g = loftGeom(size);
  const { w, d, h } = size;
  return { a: [-d / 2 + 0.06, d / 2 - 0.06], l: [-w / 2 + 0.05, w / 2 - 0.05], y0: g.deck - 0.012, top: g.deck + 0.15, yMax: h, axis: 'x', sheet: 'bedding', duvet: 'duvet', accent: 'accent', over: 0.02, cushions: 1, throwBlanket: true };
}

/** A two-seat sofa against the wall under the loft deck (stays clear of the ladder). */
function loftSofa({ w, d }: Size3): Part[] {
  const sd = Math.min(0.85, d - 0.15);
  const z0 = -d / 2 + 0.05;
  const z1 = z0 + sd;
  const x0 = -w / 2 + 0.08;
  const x1 = x0 + Math.min(1.6, w - 0.7);
  const aw = 0.13;
  const parts: Part[] = [span('sofa', [x0 + aw, x1 - aw], [0.06, 0.26], [z0 + 0.16, z1], { bevel: 0.01 }), cushion('sofa', [x0 + aw, x1 - aw], [0.06, 0.78], [z0, z0 + 0.16], { softness: 0.3 })];
  for (const x of [
    [x0, x0 + aw],
    [x1 - aw, x1],
  ] as V2[]) {
    parts.push(cushion('sofa', x, [0.06, 0.6], [z0, z1], { softness: 0.35 }));
    for (const z of [z0 + 0.05, z1 - 0.05]) parts.push(vcyl('frame', (x[0] + x[1]) / 2, z, 0, 0.065, 0.015));
  }
  const seats = cellSpans(2, x0 + aw, x1 - aw);
  for (const [a, b] of seats) {
    parts.push(
      cushion('sofa', [a + 0.004, b - 0.004], [0.26, 0.44], [z0 + 0.17, z1 - 0.005], { softness: 0.35 }),
      cushion('sofa', [a + 0.006, b - 0.006], [0.42, 0.78], [z0 + 0.13, z0 + 0.29], { softness: 0.4, rotation: [-0.12, 0, 0] }),
    );
  }
  seats.forEach(([a, b], i) => parts.push(pillow('pillows', [i === 0 ? a + 0.25 : b - 0.25, 0.6, z0 + 0.36], 0.4, 0.38, 0.13, { lean: 0.3, turn: i === 0 ? 0.2 : -0.2 })));
  return parts;
}

/** A desk along the wall under the loft deck, a shelf with books and a closed laptop. */
function loftDesk(size: Size3): Part[] {
  const { w, d } = size;
  const g = loftGeom(size);
  const dz: V2 = [-d / 2 + 0.04, -d / 2 + Math.min(0.65, d - 0.3)];
  const dx: V2 = [-w / 2 + 0.06, g.lad - 0.06];
  const parts: Part[] = [
    span('desk', dx, [0.72, 0.745], dz, { bevel: 0.004 }),
    sp('desk', [dx[0] + 0.02, dx[1] - 0.02], [0.4, 0.72], [dz[0], dz[0] + 0.018]),
    sp('desk', [dx[0] + 0.05, dx[1] - 0.05], [1.1, 1.12], [-d / 2 + 0.04, -d / 2 + 0.28], 0.003),
    ...bookRow('books', [dx[0] + 0.08, dx[0] + 0.62], 1.12, -d / 2 + 0.045, Math.min(0.24, g.deck - 0.1 - 1.12), 0.2, 5, { lean: true }),
    box('books', [dx[1] - 0.35, 0.76, dz[0] + 0.2], [0.23, 0.03, 0.17], { rotation: [0, 0.3, 0], bevel: 0.003 }),
    sp('frame', [dx[0] + 0.3, dx[0] + 0.62], [0.745, 0.762], [dz[1] - 0.32, dz[1] - 0.1], 0.004),
  ];
  for (const x of [dx[0] + 0.03, dx[1] - 0.03]) parts.push(sp('frame', [x - 0.015, x + 0.015], [0, 0.72], [dz[1] - 0.05, dz[1] - 0.02]));
  return parts;
}

const loftSteel = defineItem({
  id: 'loft-bed-steel',
  name: 'Steel loft bed for adults',
  category: 'bedroom',
  type: 'beds',
  group: 'Bunk & loft beds',
  description:
    'A black powder-coated steel loft bed for a 140 × 200 cm mattress, about 1.5 m off the floor with guard rails and a side ladder. Comes with a desk, a two-seat sofa or nothing underneath.',
  tags: ['loft bed', 'high sleeper', 'metal bed', 'adult loft', 'studio', 'desk under bed', 'giường tầng', 'giường gác lửng', 'giường sắt'],
  defaultSize: { w: 2.1, d: 1.5, h: 2.0 },
  minSize: { w: 2.0, d: 1.05, h: 1.8 },
  maxSize: { w: 2.25, d: 1.7, h: 2.3 },
  wallSnap: true,
  slots: BED_SLOTS(['Steel frame', 'metal-black-matte'], 'fabric-linen', ['Throw & cushion', 'fabric-olive']),
  build: (size) => {
    const { w, d, h } = size;
    const g = loftGeom(size);
    const { px, pz } = g;
    const parts: Part[] = [];
    for (const x of [-px, px]) for (const z of [-pz, pz]) parts.push(span('frame', [x - 0.025, x + 0.025], [0, h], [z - 0.025, z + 0.025], { bevel: 0.004 }));
    const y0 = g.deck - 0.07;
    const inX: V2 = [-px + 0.025, px - 0.025];
    const inZ: V2 = [-pz + 0.025, pz - 0.025];
    parts.push(
      sp('frame', inX, [y0, g.deck], [-d / 2, -d / 2 + 0.04]),
      sp('frame', inX, [y0, g.deck], [d / 2 - 0.04, d / 2]),
      sp('frame', [-w / 2, -w / 2 + 0.04], [y0, g.deck], inZ),
      sp('frame', [w / 2 - 0.04, w / 2], [y0, g.deck], inZ),
      sp('frame', inX, [y0 + 0.01, g.deck - 0.03], [-0.02, 0.02]),
      ...slats('frame', [-w / 2 + 0.06, w / 2 - 0.06], [g.deck - 0.025, g.deck - 0.012], [-d / 2 + 0.04, d / 2 - 0.04], Math.round((w - 0.12) / 0.11), { gap: 0.45, plan: false }),
    );
    // Guard rails: mid and top tubes on all four sides, the front stopping at the ladder.
    const tube = (x: V2, y: number, z: V2) => sp('frame', x, [y - 0.0175, y + 0.0175], z);
    for (const y of [g.deck + 0.2, h - 0.0175]) {
      parts.push(
        tube(inX, y, [-d / 2, -d / 2 + 0.035]),
        tube([-px + 0.025, g.lad], y, [d / 2 - 0.035, d / 2]),
        tube([-w / 2, -w / 2 + 0.035], y, inZ),
        tube([w / 2 - 0.035, w / 2], y, inZ),
      );
    }
    for (const x of spaced(Math.round(w / 0.35), -px + 0.2, px - 0.2)) parts.push(sp('frame', [x - 0.008, x + 0.008], [g.deck, h - 0.035], [-d / 2 + 0.01, -d / 2 + 0.026]));
    for (const x of spaced(3, -px + 0.25, g.lad - 0.2)) parts.push(sp('frame', [x - 0.008, x + 0.008], [g.deck, h - 0.035], [d / 2 - 0.026, d / 2 - 0.01]));
    for (const z of spaced(3, -pz + 0.25, pz - 0.25)) {
      for (const x of [-w / 2 + 0.018, w / 2 - 0.018]) parts.push(sp('frame', [x - 0.008, x + 0.008], [g.deck, h - 0.035], [z - 0.008, z + 0.008]));
    }
    // Ladder: a rail from floor to top rail and rungs to the foot post.
    parts.push(span('frame', [g.lad - 0.02, g.lad + 0.02], [0, h], [d / 2 - 0.04, d / 2], { bevel: 0.004 }));
    const rungs = Math.max(3, Math.floor((g.deck - 0.08) / 0.28));
    for (const y of spaced(rungs, 0.3, g.deck - 0.02)) parts.push(rodX('frame', g.lad + 0.02, px - 0.025, y, d / 2 - 0.02, 0.014, NP));
    parts.push(...dressBed(loftDress(size)));
    return parts;
  },
  planDetail: (size) => {
    const { d } = size;
    const g = loftGeom(size);
    return [...dressPlan(loftDress(size)), rectPoly(g.lad, d / 2 - 0.04, g.px, d / 2)];
  },
  models: [
    { id: 'desk', name: 'Desk underneath', slots: [matSlot('desk', 'Desk & shelf', 'wood-oak-light'), matSlot('books', 'Books', 'book-mix')], props: loftDesk },
    { id: 'sofa', name: 'Sofa underneath', slots: [matSlot('sofa', 'Sofa upholstery', 'fabric-linen-sage'), matSlot('pillows', 'Throw pillows', 'fabric-mustard')], props: loftSofa },
    { id: 'open', name: 'Open underneath' },
  ],
});

// ---------------------------------------------------------------------------
// 9. Loft bed with storage stairs and a wardrobe underneath
// ---------------------------------------------------------------------------

function stairLoftGeom({ w, h }: Size3) {
  const xs = w / 2 - 0.5;
  return { xs, deck: h - 0.42 };
}

function stairLoftDress(size: Size3): Dress {
  const { w, d, h } = size;
  const g = stairLoftGeom(size);
  return { a: [-d / 2 + 0.045, d / 2 - 0.045], l: [-w / 2 + 0.045, g.xs - 0.045], y0: g.deck - 0.015, top: g.deck + 0.17, yMax: h, axis: 'x', sheet: 'bedding', duvet: 'duvet', over: 0.02 };
}

const loftStairs = defineItem({
  id: 'loft-bed-stairs-wardrobe',
  name: 'Loft bed with storage stairs & wardrobe',
  category: 'bedroom',
  type: 'beds',
  group: 'Bunk & loft beds',
  description:
    'A white laminate loft bed for a 120 × 200 cm mattress with a staircase of five drawer steps at the foot, a two-door wardrobe and open shelves underneath, and solid guard panels. Oak treads and fronts.',
  tags: ['loft bed', 'stair bed', 'storage stairs', 'wardrobe under bed', 'high sleeper', 'studio', 'giường tầng có cầu thang', 'giường gác xép', 'giường kèm tủ'],
  defaultSize: { w: 2.56, d: 1.3, h: 1.95 },
  minSize: { w: 2.45, d: 1.1, h: 1.75 },
  maxSize: { w: 2.75, d: 1.6, h: 2.2 },
  wallSnap: true,
  slots: [
    matSlot('frame', 'Frame & guards', 'laminate-white-matte'),
    matSlot('fronts', 'Treads & fronts', 'laminate-oak'),
    matSlot('bedding', 'Sheets & pillows', 'fabric-white-cotton'),
    matSlot('duvet', 'Duvet', 'fabric-linen-sage'),
  ],
  build: (size) => {
    const { w, d, h } = size;
    const { xs, deck } = stairLoftGeom(size);
    const p = 0.06;
    const parts: Part[] = [];
    for (const x of [-w / 2 + p / 2, xs - p / 2]) for (const z of [-d / 2 + p / 2, d / 2 - p / 2]) parts.push(span('frame', [x - p / 2, x + p / 2], [0, h], [z - p / 2, z + p / 2], { bevel: 0.004 }));
    const apron: V2 = [deck - 0.16, deck + 0.04];
    const bx: V2 = [-w / 2 + p, xs - p];
    const bz: V2 = [-d / 2 + p, d / 2 - p];
    parts.push(
      span('frame', bx, apron, [d / 2 - 0.025, d / 2]),
      span('frame', bx, apron, [-d / 2, -d / 2 + 0.025]),
      sp('frame', [-w / 2, -w / 2 + 0.025], apron, bz),
      sp('frame', [xs - 0.025, xs], apron, bz),
      sp('frame', [-w / 2 + 0.025, xs - 0.025], [deck - 0.035, deck - 0.015], [-d / 2 + 0.025, d / 2 - 0.025]),
      // Guard panels with rounded cap rails; the foot end is open over the top of the stairs.
      sp('frame', bx, [deck + 0.04, h - 0.03], [-d / 2 + 0.004, -d / 2 + 0.022]),
      sp('frame', bx, [deck + 0.04, h - 0.03], [d / 2 - 0.022, d / 2 - 0.004]),
      sp('frame', [-w / 2 + 0.004, -w / 2 + 0.022], [deck + 0.04, h - 0.03], bz),
      sp('frame', [xs - 0.022, xs - 0.004], [deck + 0.04, h - 0.03], [0, bz[1]]),
      sp('frame', [-w / 2, xs], [h - 0.03, h], [-d / 2, -d / 2 + 0.03], 0.012),
      sp('frame', [-w / 2, xs], [h - 0.03, h], [d / 2 - 0.03, d / 2], 0.012),
      sp('frame', [-w / 2, -w / 2 + 0.03], [h - 0.03, h], [-d / 2, d / 2], 0.012),
      sp('frame', [xs - 0.03, xs], [h - 0.03, h], [0, d / 2], 0.012),
    );
    // Five drawer steps climbing from the front to the back, under oak treads.
    const n = 5;
    const zFront = d / 2 - 0.03;
    const run = (zFront + d / 2) / n;
    const rise = deck / (n + 1);
    for (let k = 1; k <= n; k++) {
      const z1 = zFront - (k - 1) * run;
      const z0 = z1 - run;
      const top = rise * k;
      parts.push(
        span('frame', [xs + 0.005, w / 2], [0, top - 0.02], [z0, z1], { bevel: 0.003 }),
        sp('fronts', [xs + 0.005, w / 2], [top - 0.02, top], [z0, z1 + 0.012], 0.003),
        sp('fronts', [xs + 0.03, w / 2 - 0.025], [rise * (k - 1) + 0.015, top - 0.035], [z1, z1 + 0.016], 0.003),
        ...barPull('frame', [(xs + w / 2) / 2, rise * (k - 1) + Math.max(0.05, rise * 0.55), z1 + 0.016], 0.12, { stand: 0.012, r: 0.005 }),
      );
    }
    // Wardrobe at the head end and open shelves beside it.
    const wx: V2 = [-w / 2 + p + 0.01, -w / 2 + p + 0.01 + Math.min(0.9, xs - p - (-w / 2 + p) - 0.5)];
    const wz: V2 = [-d / 2 + 0.03, -d / 2 + 0.03 + Math.min(0.56, d - 0.4)];
    const wy = deck - 0.18;
    parts.push(sp('frame', wx, [0, wy], [wz[0], wz[1] - 0.018], 0.003));
    for (const [a, b] of cellSpans(2, wx[0], wx[1])) {
      parts.push(sp('fronts', [a + 0.002, b - 0.002], [0.03, wy - 0.003], [wz[1] - 0.018, wz[1]], 0.003));
      parts.push(...barPull('frame', [a < (wx[0] + wx[1]) / 2 ? b - 0.04 : a + 0.04, wy * 0.55, wz[1]], 0.3, { vertical: true, stand: 0.012 }));
    }
    const shX: V2 = [wx[1] + 0.03, xs - p - 0.03];
    const shZ: V2 = [-d / 2 + 0.03, -d / 2 + 0.33];
    parts.push(sp('frame', [shX[0], shX[0] + 0.018], [0, wy], shZ), sp('frame', [shX[1] - 0.018, shX[1]], [0, wy], shZ));
    for (const y of spaced(4, 0.03, wy - 0.02)) parts.push(sp('frame', [shX[0] + 0.018, shX[1] - 0.018], [y - 0.01, y + 0.01], shZ));
    parts.push(...dressBed(stairLoftDress(size)));
    return parts;
  },
  planDetail: (size) => {
    const { w, d } = size;
    const { xs } = stairLoftGeom(size);
    const strokes = dressPlan(stairLoftDress(size));
    const run = (d - 0.03) / 5;
    for (let k = 1; k < 5; k++) strokes.push(line([xs, d / 2 - 0.03 - k * run], [w / 2, d / 2 - 0.03 - k * run]));
    return strokes;
  },
});

// ---------------------------------------------------------------------------
// 10. Raised sleeping platform with drawers and a step (bục ngủ)
// ---------------------------------------------------------------------------

function raisedGeom({ w, d }: Size3) {
  const zf = d / 2 - 0.3;
  const mw = clamp(w - 0.6, 0.9, 2.0);
  const ml = Math.min(2.0, d - 0.42);
  return { zf, ph: 0.4, mw, l: [-d / 2 + 0.07, -d / 2 + 0.07 + ml] as V2 };
}

function raisedDress(size: Size3): Dress {
  const g = raisedGeom(size);
  return { a: [-g.mw / 2, g.mw / 2], l: g.l, y0: g.ph, top: g.ph + 0.22, yMax: size.h, sheet: 'bedding', duvet: 'duvet', accent: 'accent', cushions: 2, throwBlanket: true };
}

const raisedPlatform = defineItem({
  id: 'raised-platform-bed',
  name: 'Raised sleeping platform with drawers & step',
  category: 'bedroom',
  type: 'beds',
  group: 'Beds',
  description:
    'A 40 cm oak sleeping platform wider than its mattress, with handle-less drawers along the front, a full-width step and a low slatted headboard. The ledges either side work as bedside shelves.',
  tags: ['platform bed', 'raised floor', 'stage bed', 'sleeping platform', 'storage drawers', 'Korean', 'Japanese', 'bục ngủ', 'giường bục gỗ', 'sàn ngủ'],
  defaultSize: { w: 2.2, d: 2.5, h: 1.0 },
  minSize: { w: 1.6, d: 2.3, h: 0.9 },
  maxSize: { w: 2.8, d: 2.9, h: 1.3 },
  wallSnap: true,
  slots: BED_SLOTS(['Platform & headboard', 'wood-oak-natural'], 'fabric-cream', ['Throw, cushions & books', 'fabric-linen-rust']),
  build: (size) => {
    const { w, d, h } = size;
    const g = raisedGeom(size);
    const parts: Part[] = [
      span('frame', [-w / 2, w / 2], [0, g.ph], [-d / 2, g.zf], { bevel: 0.006 }),
      span('frame', [-w / 2, w / 2], [0, 0.18], [g.zf, d / 2], { bevel: 0.006 }),
      span('frame', [-w / 2, w / 2], [g.ph, h], [-d / 2, -d / 2 + 0.035], { bevel: 0.005 }),
      ...slats('frame', [-w / 2 + 0.03, w / 2 - 0.03], [g.ph + 0.02, h - 0.03], [-d / 2 + 0.035, -d / 2 + 0.05], Math.round((w - 0.06) / 0.07), { gap: 0.3, plan: false }),
    ];
    for (const [a, b] of cellSpans(clamp(Math.round(w / 0.7), 2, 4), -w / 2 + 0.03, w / 2 - 0.03)) {
      parts.push(sp('frame', [a + 0.004, b - 0.004], [0.19, g.ph - 0.03], [g.zf, g.zf + 0.016], 0.003));
    }
    const ledge = (w - g.mw) / 2;
    if (ledge >= 0.2) {
      const x = w / 2 - ledge / 2;
      parts.push(
        box('accent', [x, g.ph + 0.015, -d / 2 + 0.4], [Math.min(0.2, ledge - 0.04), 0.03, 0.15], { rotation: [0, 0.2, 0], bevel: 0.003 }),
        box('accent', [x, g.ph + 0.04, -d / 2 + 0.4], [Math.min(0.17, ledge - 0.06), 0.022, 0.13], { rotation: [0, -0.15, 0], bevel: 0.003 }),
      );
    }
    parts.push(...dressBed(raisedDress(size)));
    return parts;
  },
  planDetail: (size) => [...dressPlan(raisedDress(size)), line([-size.w / 2, raisedGeom(size).zf], [size.w / 2, raisedGeom(size).zf])],
});

// ---------------------------------------------------------------------------
// 11. Tatami platform bed with a shoji headboard
// ---------------------------------------------------------------------------

function tatamiDress({ w, d, h }: Size3): Dress {
  const mw = clamp(w - 0.4, 0.9, 1.8);
  return { a: [-mw / 2, mw / 2], l: [-d / 2 + 0.13, -d / 2 + 0.13 + Math.min(2.0, d - 0.23)], y0: 0.298, top: 0.42, yMax: h, sheet: 'bedding', duvet: 'duvet', flat: true, over: 0.03 };
}

const tatamiBed = defineItem({
  id: 'tatami-platform-bed',
  name: 'Tatami platform bed with shoji headboard',
  category: 'bedroom',
  type: 'beds',
  group: 'Beds',
  description:
    'A low light-oak platform set with two igusa tatami mats and a futon on top, behind it a shoji headboard of oak lattice over white paper. Popular in Japanese- and Korean-style apartments.',
  tags: ['tatami bed', 'japanese bed', 'futon', 'low bed', 'japandi', 'shoji', 'giường tatami', 'giường kiểu nhật', 'giường thấp'],
  defaultSize: { w: 2.0, d: 2.2, h: 0.75 },
  minSize: { w: 1.4, d: 2.05, h: 0.6 },
  maxSize: { w: 2.4, d: 2.5, h: 1.0 },
  wallSnap: true,
  slots: [
    matSlot('frame', 'Frame & headboard', 'wood-oak-light'),
    matSlot('tatami', 'Tatami mats', 'tatami-igusa'),
    matSlot('bedding', 'Futon, pillows & shoji paper', 'fabric-white-cotton'),
    matSlot('duvet', 'Duvet', 'fabric-linen'),
  ],
  build: (size) => {
    const { w, d, h } = size;
    const rim = 0.045;
    const zb = -d / 2 + 0.035;
    const yt = 0.3;
    const parts: Part[] = [
      sp('frame', [-w / 2 + 0.1, w / 2 - 0.1], [0, 0.06], [zb + 0.08, d / 2 - 0.1]),
      span('frame', [-w / 2, w / 2], [0.06, yt - 0.03], [zb, d / 2], { bevel: 0.006 }),
      sp('frame', [-w / 2, -w / 2 + rim], [yt - 0.03, yt], [zb, d / 2], 0.004),
      sp('frame', [w / 2 - rim, w / 2], [yt - 0.03, yt], [zb, d / 2], 0.004),
      sp('frame', [-w / 2 + rim, w / 2 - rim], [yt - 0.03, yt], [d / 2 - rim, d / 2], 0.004),
      sp('frame', [-w / 2 + rim, w / 2 - rim], [yt - 0.03, yt], [zb, zb + rim], 0.004),
    ];
    for (const [a, b] of cellSpans(2, -w / 2 + rim, w / 2 - rim)) parts.push(sp('tatami', [a + 0.002, b - 0.002], [yt - 0.03, yt - 0.003], [zb + rim, d / 2 - rim], 0.006));
    // Shoji headboard: a backing board, a frame and a kumiko lattice.
    const hx: V2 = [-w / 2, w / 2];
    const hy: V2 = [0.06, h];
    parts.push(span('frame', hx, hy, [-d / 2, -d / 2 + 0.018], { bevel: 0.003 }));
    parts.push(...[
      sp('frame', hx, [h - 0.04, h], [-d / 2 + 0.018, zb], 0.003),
      sp('frame', hx, [yt, yt + 0.04], [-d / 2 + 0.018, zb]),
      sp('frame', [-w / 2, -w / 2 + 0.04], [yt, h - 0.04], [-d / 2 + 0.018, zb]),
      sp('frame', [w / 2 - 0.04, w / 2], [yt, h - 0.04], [-d / 2 + 0.018, zb]),
    ]);
    const ly: V2 = [yt + 0.04, h - 0.04];
    parts.push(sp('bedding', [-w / 2 + 0.039, w / 2 - 0.039], ly, [-d / 2 + 0.019, -d / 2 + 0.023]));
    for (const x of spaced(clamp(Math.round(w / 0.2), 5, 14), -w / 2 + 0.04 + 0.1, w / 2 - 0.04 - 0.1)) parts.push(sp('frame', [x - 0.007, x + 0.007], ly, [-d / 2 + 0.024, -d / 2 + 0.034]));
    for (const y of spaced(Math.max(1, Math.round((ly[1] - ly[0]) / 0.14) - 1), ly[0] + 0.07, ly[1] - 0.07)) parts.push(sp('frame', [-w / 2 + 0.04, w / 2 - 0.04], [y - 0.007, y + 0.007], [-d / 2 + 0.024, -d / 2 + 0.034]));
    parts.push(...dressBed(tatamiDress(size)));
    return parts;
  },
  planDetail: (size) => [...dressPlan(tatamiDress(size)), line([0, -size.d / 2 + 0.08], [0, size.d / 2 - 0.045])],
});

// ---------------------------------------------------------------------------
// 12. Black steel frame bed with a spindle headboard
// ---------------------------------------------------------------------------

function steelDress({ w, d, h }: Size3): Dress {
  const t = 0.035;
  return { a: [-w / 2 + t + 0.004, w / 2 - t - 0.004], l: [-d / 2 + t + 0.005, d / 2 - 0.06], y0: 0.297, top: 0.53, yMax: h, sheet: 'bedding', duvet: 'duvet', accent: 'accent', overFoot: 0.02, cushions: 2, throwBlanket: true };
}

const steelBed = defineItem({
  id: 'steel-spindle-bed',
  name: 'Black steel frame bed with spindle headboard',
  category: 'bedroom',
  type: 'beds',
  group: 'Beds',
  description:
    'A slim matte-black square-tube steel bed: tall head posts with a row of round spindles, a low foot rail, steel slats and a centre support leg. Light and easy to move in a rented flat.',
  tags: ['metal bed', 'steel bed', 'iron bed', 'industrial', 'minimal', 'spindle headboard', 'giường sắt', 'giường sắt sơn tĩnh điện', 'giường khung sắt'],
  defaultSize: { w: 1.66, d: 2.08, h: 0.95 },
  minSize: { w: 0.96, d: 2.0, h: 0.8 },
  maxSize: { w: 1.96, d: 2.25, h: 1.2 },
  wallSnap: true,
  slots: BED_SLOTS(['Steel frame', 'metal-black-matte'], 'fabric-linen', ['Throw & cushions', 'fabric-terracotta']),
  build: (size) => {
    const { w, d, h } = size;
    const t = 0.035;
    const ht = t / 2;
    const px = w / 2 - ht;
    const hz = -d / 2 + ht;
    const fz = d / 2 - ht;
    const post = (x: number, z: number, y1: number) => span('frame', [x - ht, x + ht], [0, y1], [z - ht, z + ht], { bevel: 0.003 });
    const across: V2 = [-px + ht, px - ht];
    const parts: Part[] = [
      post(-px, hz, h),
      post(px, hz, h),
      post(-px, fz, 0.42),
      post(px, fz, 0.42),
      sp('frame', across, [h - 0.03, h], [hz - 0.015, hz + 0.015], 0.003),
      sp('frame', across, [0.43, 0.46], [hz - 0.015, hz + 0.015], 0.003),
      sp('frame', across, [0.39, 0.42], [fz - 0.015, fz + 0.015], 0.003),
      sp('frame', across, [0.2, 0.225], [fz - 0.012, fz + 0.012], 0.003),
      span('frame', [-w / 2, -w / 2 + t], [0.24, 0.29], [hz + ht, fz - ht]),
      span('frame', [w / 2 - t, w / 2], [0.24, 0.29], [hz + ht, fz - ht]),
      sp('frame', across, [0.24, 0.29], [hz - ht, hz + ht]),
      sp('frame', [-0.015, 0.015], [0.255, 0.285], [hz + ht, fz - ht]),
      ...slats('frame', [-w / 2 + t, w / 2 - t], [0.285, 0.297], [hz + ht, fz - ht], Math.round(d / 0.14), { axis: 'z', gap: 0.5, plan: false }),
    ];
    for (const z of [-d / 6, d / 6]) parts.push(vcyl('frame', 0, z, 0, 0.255, 0.012, NP));
    for (const x of cells(clamp(Math.round((w - 2 * t) / 0.11), 5, 18), -px + ht, px - ht)) parts.push(vcyl('frame', x, hz, 0.46, h - 0.03, 0.007, NP));
    parts.push(...dressBed(steelDress(size)));
    return parts;
  },
  planDetail: (size) => [...dressPlan(steelDress(size)), line([-size.w / 2, -size.d / 2 + 0.035], [size.w / 2, -size.d / 2 + 0.035])],
});

// ---------------------------------------------------------------------------
// 13. Oak-legged mattress bed without a headboard
// ---------------------------------------------------------------------------

function leggedGeom({ w, d, h }: Size3) {
  const legH = clamp(h - 0.44, 0.12, 0.32);
  return { legH, baseTop: legH + 0.12, x: [-w / 2 + 0.025, w / 2 - 0.025] as V2, z: [-d / 2, d / 2 - 0.025] as V2 };
}

function leggedDress(size: Size3): Dress {
  const g = leggedGeom(size);
  return { a: g.x, l: g.z, y0: g.baseTop, top: g.baseTop + 0.2, yMax: size.h, sheet: 'bedding', duvet: 'duvet', flat: true };
}

const leggedBed = defineItem({
  id: 'legged-mattress-bed',
  name: 'Oak-legged mattress bed (no headboard)',
  category: 'bedroom',
  type: 'beds',
  group: 'Beds',
  description:
    'A minimalist bed with no headboard or frame: a fabric-covered sprung base standing on six tapered oak legs, with the mattress on top. Pushes against a wall or under a window and looks tidy from every side.',
  tags: ['legged bed', 'divan', 'no headboard', 'minimalist', 'muji style', 'box spring', 'giường không đầu', 'giường chân gỗ', 'nệm có chân'],
  defaultSize: { w: 1.4, d: 1.96, h: 0.62 },
  minSize: { w: 0.97, d: 1.95, h: 0.56 },
  maxSize: { w: 1.8, d: 2.1, h: 0.8 },
  wallSnap: true,
  slots: [
    matSlot('legs', 'Legs', 'wood-oak-light'),
    matSlot('base', 'Base cover', 'fabric-wool-grey'),
    matSlot('bedding', 'Sheets & pillows', 'fabric-white-cotton'),
    matSlot('duvet', 'Duvet', 'fabric-linen-sage'),
  ],
  build: (size) => {
    const { w, d } = size;
    const g = leggedGeom(size);
    const parts: Part[] = [cushion('base', g.x, [g.legH, g.baseTop], g.z, { softness: 0.12 })];
    for (const x of [-w / 2 + 0.12, w / 2 - 0.12]) {
      for (const z of [-d / 2 + 0.12, 0, d / 2 - 0.15]) parts.push(turnedLeg('legs', x, z, 0, g.legH + 0.005, 0.022, { style: 'taper' }));
    }
    parts.push(...dressBed(leggedDress(size)));
    return parts;
  },
  planDetail: (size) => dressPlan(leggedDress(size)),
});

// ---------------------------------------------------------------------------
// 14. Rattan cane headboard bed
// ---------------------------------------------------------------------------

const CANE_HT = 0.05;

function caneDress({ w, d, h }: Size3): Dress {
  return { a: [-w / 2 + 0.05, w / 2 - 0.05], l: [-d / 2 + CANE_HT + 0.005, d / 2 - 0.045], y0: 0.3, top: 0.55, yMax: h, sheet: 'bedding', duvet: 'duvet', overFoot: 0.03 };
}

const caneBed = defineItem({
  id: 'cane-headboard-bed',
  name: 'Rattan cane headboard bed',
  category: 'bedroom',
  type: 'beds',
  group: 'Beds',
  description:
    'A teak bed whose headboard frames a woven rattan cane panel under softly rounded top corners, on tapered legs. A tropical modern favourite.',
  tags: ['cane bed', 'rattan bed', 'wicker headboard', 'tropical', 'indochine', 'oak', 'giường mây', 'giường đan mây', 'giường gỗ đầu mây'],
  defaultSize: { w: 1.7, d: 2.12, h: 1.15 },
  minSize: { w: 1.05, d: 2.05, h: 0.95 },
  maxSize: { w: 2.0, d: 2.3, h: 1.4 },
  wallSnap: true,
  slots: [
    matSlot('frame', 'Frame', 'wood-teak'),
    matSlot('cane', 'Cane panel', 'cane-natural'),
    matSlot('bedding', 'Sheets & pillows', 'fabric-white-cotton'),
    matSlot('duvet', 'Duvet', 'fabric-linen'),
  ],
  build: (size) => {
    const { w, d, h } = size;
    const bw = 0.055;
    const hb0 = 0.32;
    const r = Math.min(0.24, w * 0.14, (h - hb0) * 0.45);
    const zb = -d / 2 + CANE_HT;
    const outer = roundTop(-w / 2, w / 2, hb0, h, r);
    const inner = roundTop(-w / 2 + bw, w / 2 - bw, hb0, h - bw, Math.max(0.005, r - bw)).reverse();
    const parts: Part[] = [
      span('frame', [-w / 2, -w / 2 + bw], [0, hb0 + 0.01], [-d / 2, zb], { bevel: 0.004 }),
      span('frame', [w / 2 - bw, w / 2], [0, hb0 + 0.01], [-d / 2, zb], { bevel: 0.004 }),
      plate('frame', [...outer, ...inner], -d / 2, CANE_HT),
      sp('frame', [-w / 2 + bw, w / 2 - bw], [hb0, hb0 + 0.06], [-d / 2, zb], 0.003),
      plate('cane', roundTop(-w / 2 + bw - 0.01, w / 2 - bw + 0.01, hb0 + 0.05, h - bw + 0.01, Math.max(0.02, r - bw + 0.01)), -d / 2 + 0.018, 0.012),
      span('frame', [-w / 2 + 0.01, -w / 2 + 0.05], [0.18, 0.36], [zb, d / 2], { bevel: 0.006 }),
      span('frame', [w / 2 - 0.05, w / 2 - 0.01], [0.18, 0.36], [zb, d / 2], { bevel: 0.006 }),
      span('frame', [-w / 2 + 0.05, w / 2 - 0.05], [0.18, 0.36], [d / 2 - 0.04, d / 2], { bevel: 0.006 }),
      sp('frame', [-w / 2 + 0.05, w / 2 - 0.05], [0.28, 0.3], [zb, d / 2 - 0.04]),
    ];
    for (const x of [-w / 2 + 0.04, w / 2 - 0.04]) parts.push(turnedLeg('frame', x, d / 2 - 0.04, 0, 0.185, 0.026, { style: 'taper' }));
    parts.push(...dressBed(caneDress(size)));
    return parts;
  },
  planDetail: (size) => dressPlan(caneDress(size)),
});

// ---------------------------------------------------------------------------
// 15. Arched bouclé headboard bed
// ---------------------------------------------------------------------------

function archDress({ w, d, h }: Size3): Dress {
  return { a: [-w / 2 + 0.055, w / 2 - 0.055], l: [-d / 2 + 0.095, d / 2 - 0.03], y0: 0.34, top: 0.58, yMax: h, sheet: 'bedding', duvet: 'duvet', accent: 'accent', euro: true, cushions: 2, throwBlanket: true };
}

const archBed = defineItem({
  id: 'arch-headboard-bed',
  name: 'Arched bouclé headboard bed',
  category: 'bedroom',
  type: 'beds',
  group: 'Beds',
  description:
    'A soft modern bed upholstered in cream bouclé: a tall arched headboard with a padded, piped front panel over a rounded base on a recessed plinth. Dressed with euro shams and a rust throw.',
  tags: ['arched bed', 'curved headboard', 'boucle', 'upholstered bed', 'organic modern', 'queen', 'giường bọc nệm đầu cong', 'giường bọc vải', 'giường đầu vòm'],
  defaultSize: { w: 1.75, d: 2.15, h: 1.3 },
  minSize: { w: 1.1, d: 2.05, h: 1.05 },
  maxSize: { w: 2.05, d: 2.35, h: 1.6 },
  wallSnap: true,
  slots: BED_SLOTS(['Upholstery', 'fabric-boucle'], 'fabric-linen-sage', ['Throw & cushions', 'fabric-linen-rust']),
  build: (size) => {
    const { w, d, h } = size;
    const ry = Math.min(w / 2, h - 0.6) * 0.8;
    const ys = h - ry;
    const inner = archOutline(-w / 2 + 0.03, w / 2 - 0.03, 0.12, ys, h - 0.03);
    const zp = -d / 2 + 0.085;
    const parts: Part[] = [
      span('frame', [-w / 2 + 0.005, w / 2 - 0.005], [0.1, 0.3], [-d / 2 + 0.005, -d / 2 + 0.035]),
      plate('frame', archOutline(-w / 2, w / 2, 0.1, ys, h), -d / 2, 0.04),
      plate('frame', inner, -d / 2 + 0.04, 0.05),
      ...rodPath('frame', inner.map(([x, y]) => [x, y, zp] as V3), 0.01),
      sp('frame', [-w / 2 + 0.12, w / 2 - 0.12], [0, 0.08], [-d / 2 + 0.2, d / 2 - 0.12]),
      span('frame', [-w / 2 + 0.02, w / 2 - 0.02], [0.08, 0.34], [-d / 2 + 0.09, d / 2], { bevel: 0.04 }),
    ];
    parts.push(...dressBed(archDress(size)));
    return parts;
  },
  planDetail: (size) => dressPlan(archDress(size)),
});

// ---------------------------------------------------------------------------
// 16. Floating bed with wrap-around nightstands
// ---------------------------------------------------------------------------

function wrapGeom({ w, d }: Size3) {
  return { bw: clamp(w - 1.0, 1.0, 2.0), zh: -d / 2 + 0.05 };
}

function wrapDress(size: Size3): Dress {
  const g = wrapGeom(size);
  return { a: [-g.bw / 2 + 0.035, g.bw / 2 - 0.035], l: [g.zh + 0.065, size.d / 2 - 0.03], y0: 0.32, top: 0.56, yMax: size.h, sheet: 'bedding', duvet: 'duvet' };
}

const wrapBed = defineItem({
  id: 'wrap-nightstand-bed',
  name: 'Floating bed with wrap-around nightstands',
  category: 'bedroom',
  type: 'beds',
  group: 'Beds',
  description:
    'A walnut-laminate bed whose wide headboard wraps round into two floating nightstands with drawers, over a platform that seems to hover on a recessed plinth. Padded channel cushions behind the pillows.',
  tags: ['floating bed', 'integrated nightstands', 'headboard with side tables', 'modern', 'walnut', 'giường liền tab', 'giường kèm tab đầu giường', 'giường gỗ công nghiệp'],
  defaultSize: { w: 2.7, d: 2.15, h: 1.0 },
  minSize: { w: 2.2, d: 2.05, h: 0.85 },
  maxSize: { w: 3.3, d: 2.35, h: 1.25 },
  wallSnap: true,
  slots: [
    matSlot('frame', 'Frame & nightstands', 'laminate-walnut'),
    matSlot('pad', 'Headboard cushions', 'fabric-wool-grey'),
    matSlot('bedding', 'Sheets & pillows', 'fabric-white-cotton'),
    matSlot('duvet', 'Duvet', 'fabric-cream'),
  ],
  build: (size) => {
    const { w, d, h } = size;
    const { bw, zh } = wrapGeom(size);
    const parts: Part[] = [
      span('frame', [-w / 2, w / 2], [0.1, h], [-d / 2, zh], { bevel: 0.006 }),
      sp('frame', [-w / 2 + 0.2, w / 2 - 0.2], [0, 0.1], [-d / 2, -d / 2 + 0.04]),
      span('frame', [-bw / 2, bw / 2], [0.12, 0.32], [zh, d / 2], { bevel: 0.008 }),
      sp('frame', [-bw / 2 + 0.15, bw / 2 - 0.15], [0, 0.12], [zh + 0.15, d / 2 - 0.2]),
    ];
    for (const [a, b] of cellSpans(3, 0.42, h - 0.07)) {
      parts.push(cushion('pad', [-bw / 2 + 0.02, bw / 2 - 0.02], [a + 0.003, b - 0.003], [zh, zh + 0.06], { softness: 0.45, plan: false }));
    }
    for (const s of [-1, 1]) {
      const x: V2 = s < 0 ? [-w / 2 + 0.02, -bw / 2 - 0.06] : [bw / 2 + 0.06, w / 2 - 0.02];
      parts.push(
        span('frame', x, [0.34, 0.52], [zh, zh + 0.4], { bevel: 0.006 }),
        sp('frame', [x[0] + 0.015, x[1] - 0.015], [0.35, 0.47], [zh + 0.4, zh + 0.415], 0.003),
      );
    }
    parts.push(...dressBed(wrapDress(size)));
    return parts;
  },
  planDetail: (size) => {
    const { w, d } = size;
    const { bw, zh } = wrapGeom(size);
    return [...dressPlan(wrapDress(size)), rectPoly(-w / 2 + 0.02, zh, -bw / 2 - 0.06, zh + 0.4), rectPoly(bw / 2 + 0.06, zh, w / 2 - 0.02, zh + 0.4), line([-w / 2, -d / 2 + 0.05], [w / 2, -d / 2 + 0.05])];
  },
});

// ---------------------------------------------------------------------------
// 17. Black steel canopy bed with sheer drapes
// ---------------------------------------------------------------------------

function canopyDress({ w, d, h }: Size3): Dress {
  return { a: [-w / 2 + 0.04, w / 2 - 0.04], l: [-d / 2 + 0.04, d / 2 - 0.06], y0: 0.285, top: 0.52, yMax: h, sheet: 'bedding', duvet: 'duvet', overFoot: 0.02 };
}

const canopyBed = defineItem({
  id: 'steel-canopy-bed',
  name: 'Black steel canopy bed with sheer drapes',
  category: 'bedroom',
  type: 'beds',
  group: 'Beds',
  description:
    'A minimal four-poster of thin matte-black square tube with canopy rails, a rail headboard and an ivory sheer voile draped over the head end and hanging at both head posts.',
  tags: ['canopy bed', 'four poster', 'metal bed', 'sheer curtains', 'minimal', 'romantic', 'giường có màn', 'giường khung sắt', 'giường bốn cột'],
  defaultSize: { w: 1.7, d: 2.12, h: 2.1 },
  minSize: { w: 1.05, d: 2.05, h: 1.9 },
  maxSize: { w: 2.05, d: 2.3, h: 2.4 },
  wallSnap: true,
  slots: [
    matSlot('frame', 'Steel frame', 'metal-black-matte'),
    matSlot('bedding', 'Sheets & pillows', 'fabric-white-cotton'),
    matSlot('duvet', 'Duvet', 'fabric-linen'),
    matSlot('sheer', 'Sheer drapes', 'sheer-voile'),
  ],
  build: (size) => {
    const { w, d, h } = size;
    const t = 0.03;
    const ht = t / 2;
    const px = w / 2 - ht;
    const pz = d / 2 - ht;
    const parts: Part[] = [];
    for (const x of [-px, px]) for (const z of [-pz, pz]) parts.push(span('frame', [x - ht, x + ht], [0, h], [z - ht, z + ht], { bevel: 0.003 }));
    const inX: V2 = [-px + ht, px - ht];
    const inZ: V2 = [-pz + ht, pz - ht];
    parts.push(
      sp('frame', inX, [h - t, h], [-pz - ht, -pz + ht]),
      sp('frame', inX, [h - t, h], [pz - ht, pz + ht]),
      sp('frame', [-px - ht, -px + ht], [h - t, h], inZ),
      sp('frame', [px - ht, px + ht], [h - t, h], inZ),
      sp('frame', inX, [0.4, 0.42], [pz - 0.01, pz + 0.01]),
      span('frame', [-w / 2, -w / 2 + t], [0.24, 0.285], inZ),
      span('frame', [w / 2 - t, w / 2], [0.24, 0.285], inZ),
      sp('frame', inX, [0.265, 0.285], inZ),
      sp('frame', [-0.015, 0.015], [0.235, 0.265], inZ),
    );
    for (const y of [0.45, 0.75, Math.min(1.05, h - 0.4)]) parts.push(sp('frame', inX, [y - 0.012, y + 0.012], [-pz + 0.001, -pz + 0.021]));
    for (const z of [-d / 6, d / 6]) parts.push(vcyl('frame', 0, z, 0, 0.235, 0.012, NP));
    // Sheer voile over the head-end rails, a gathered panel behind the headboard and a drop at each head post.
    parts.push(
      sp('sheer', [-w / 2 + 0.005, w / 2 - 0.005], [h + 0.001, h + 0.008], [-d / 2 + 0.005, -d / 2 + Math.min(0.85, d * 0.4)]),
      ...[-1, 1].flatMap((s) => foldsZ('sheer', s * (w / 2 - 0.025), [0.05, h - 0.01], [-d / 2 + 0.04, -d / 2 + 0.42], 4, 0.035)),
    );
    const n = Math.round((w - 0.1) / 0.16);
    for (const cx of cells(n, -px + 0.05, px - 0.05)) {
      const cw = (2 * px - 0.1) / n;
      parts.push(cyl('sheer', [cx, (0.5 + h - 0.01) / 2, -d / 2 + 0.009], cw * 0.55, h - 0.51, { scale: [1, 1, 0.014 / (cw * 1.1)], segments: 12, plan: false }));
    }
    parts.push(...dressBed(canopyDress(size)));
    return parts;
  },
  planDetail: (size) => {
    const px = size.w / 2 - 0.015;
    const pz = size.d / 2 - 0.015;
    return [...dressPlan(canopyDress(size)), line([-px, -pz], [px, pz]), line([px, -pz], [-px, pz])];
  },
});

// ---------------------------------------------------------------------------
// 18. Wooden pallet bed
// ---------------------------------------------------------------------------

const PH = 0.144;

/** A Euro-style pallet lying flat: deck boards along z, stringers across, nine blocks and bottom boards. */
function pallet(slot: string, x: V2, z: V2, y0: number): Part[] {
  const [x0, x1] = x;
  const [z0, z1] = z;
  const parts: Part[] = cellSpans(5, x0, x1).map(([a, b], i) => {
    const pad = (b - a) * (i % 2 ? 0.28 : 0.1);
    return span(slot, [a + pad, b - pad], [y0 + 0.122, y0 + PH], z, { bevel: 0.002 });
  });
  const xs = [x0 + 0.05, (x0 + x1) / 2, x1 - 0.05];
  const zs = [z0 + 0.05, (z0 + z1) / 2, z1 - 0.05];
  for (const zc of zs) parts.push(sp(slot, x, [y0 + 0.1, y0 + 0.122], [zc - 0.05, zc + 0.05]));
  for (const xc of xs) {
    for (const zc of zs) parts.push(sp(slot, [xc - 0.05, xc + 0.05], [y0 + 0.022, y0 + 0.1], [zc - 0.05, zc + 0.05]));
    parts.push(sp(slot, [xc - 0.05, xc + 0.05], [y0, y0 + 0.022], z));
  }
  return parts;
}

/** A pallet stood upright against the wall as a headboard (back face at zb). */
function palletUpright(slot: string, x: V2, y1: number, zb: number): Part[] {
  const [x0, x1] = x;
  const parts: Part[] = cellSpans(5, x0, x1).map(([a, b], i) => {
    const pad = (b - a) * (i % 2 ? 0.28 : 0.1);
    return span(slot, [a + pad, b - pad], [0, y1], [zb + 0.122, zb + PH], { bevel: 0.002 });
  });
  for (const yc of [0.05, y1 / 2, y1 - 0.05]) parts.push(sp(slot, x, [yc - 0.05, yc + 0.05], [zb + 0.1, zb + 0.122]));
  for (const xc of [x0 + 0.05, (x0 + x1) / 2, x1 - 0.05]) {
    parts.push(sp(slot, [xc - 0.05, xc + 0.05], [y1 - 0.1, y1], [zb + 0.022, zb + 0.1]), sp(slot, [xc - 0.05, xc + 0.05], [0, y1], [zb, zb + 0.022]));
  }
  return parts;
}

function palletDress({ w, d, h }: Size3): Dress {
  const l0 = -d / 2 + PH + 0.01;
  return { a: [-w / 2 + 0.03, w / 2 - 0.03], l: [l0, Math.min(d / 2 - 0.03, l0 + 2.0)], y0: PH, top: PH + 0.22, yMax: h, sheet: 'bedding', duvet: 'duvet', accent: 'accent', over: 0.02, cushions: 2, throwBlanket: true };
}

const palletBed = defineItem({
  id: 'pallet-bed',
  name: 'Wooden pallet bed',
  category: 'bedroom',
  type: 'beds',
  group: 'Beds',
  description:
    'A low DIY bed of four raw pine shipping pallets with two more stood up as a headboard, a mattress on top and a ledge left free at the foot for books. Cheap, sturdy and very studio.',
  tags: ['pallet bed', 'diy bed', 'low bed', 'rustic', 'industrial', 'reclaimed wood', 'giường pallet', 'giường gỗ pallet', 'giường bệt'],
  defaultSize: { w: 1.6, d: 2.55, h: 1.2 },
  minSize: { w: 1.4, d: 2.35, h: 0.95 },
  maxSize: { w: 2.0, d: 2.7, h: 1.4 },
  wallSnap: true,
  slots: BED_SLOTS(['Pallets', 'pallet-pine'], 'fabric-linen', ['Throw, cushions & books', 'fabric-mustard']),
  build: (size) => {
    const { w, d, h } = size;
    const z0 = -d / 2 + PH;
    const parts: Part[] = [];
    for (const x of [
      [-w / 2, 0],
      [0, w / 2],
    ] as V2[]) {
      parts.push(...palletUpright('frame', x, h, -d / 2));
      for (const z of cellSpans(2, z0, d / 2)) parts.push(...pallet('frame', x, z, 0));
    }
    const dr = palletDress(size);
    if (d / 2 - dr.l[1] >= 0.25) {
      const zc = (dr.l[1] + d / 2) / 2;
      parts.push(
        box('accent', [w / 4, PH + 0.015, zc], [0.22, 0.03, 0.16], { rotation: [0, 0.3, 0], bevel: 0.003 }),
        box('accent', [w / 4, PH + 0.04, zc], [0.18, 0.022, 0.13], { rotation: [0, -0.1, 0], bevel: 0.003 }),
      );
    }
    parts.push(...dressBed(dr));
    return parts;
  },
  planDetail: (size) => {
    const { w, d } = size;
    const z0 = -d / 2 + PH;
    return [...dressPlan(palletDress(size)), line([0, z0], [0, d / 2]), line([-w / 2, (z0 + d / 2) / 2], [w / 2, (z0 + d / 2) / 2])];
  },
});

// ---------------------------------------------------------------------------
// 19. Pull-out sofa bed, opened
// ---------------------------------------------------------------------------

const PULL_ARM = 0.2;
const PULL_SD = 0.92;

function pullDress({ w, d, h }: Size3): Dress {
  const mw = w - 2 * PULL_ARM - 0.06;
  return { a: [-mw / 2, mw / 2], l: [-d / 2 + 0.22, d / 2 - 0.04], y0: 0.33, top: 0.45, yMax: h, sheet: 'bedding', duvet: 'duvet', over: 0.02 };
}

const pullOutSofaBed = defineItem({
  id: 'sofa-bed-pullout-open',
  name: 'Pull-out sofa bed, opened',
  category: 'living',
  type: 'beds',
  group: 'Daybeds & sofa beds',
  // The same kind of sofa closed, from the couches pack: listed side by side.
  variantOf: 'couches:pull-out-sleeper-3-seat',
  description:
    'A three-seat sofa with its fold-out steel mechanism pulled forward into a made-up double bed: a 12 cm mattress on two folding U-legs, the tight channel back acting as the headboard.',
  tags: ['sofa bed', 'pull-out bed', 'sleeper sofa', 'guest bed', 'opened', 'studio', 'sofa giường', 'sofa kéo thành giường', 'ghế sofa giường'],
  defaultSize: { w: 2.0, d: 2.15, h: 0.85 },
  minSize: { w: 1.6, d: 1.95, h: 0.75 },
  maxSize: { w: 2.4, d: 2.3, h: 0.95 },
  wallSnap: true,
  slots: [
    matSlot('upholstery', 'Sofa upholstery', 'fabric-wool-grey'),
    matSlot('bedding', 'Sheets & pillows', 'fabric-white-cotton'),
    matSlot('duvet', 'Duvet', 'fabric-sky'),
    matSlot('metal', 'Legs & bed frame', 'metal-anthracite'),
  ],
  build: (size) => {
    const { w, d, h } = size;
    const zs = -d / 2 + PULL_SD;
    const mw = w - 2 * PULL_ARM - 0.06;
    const bx: V2 = [-w / 2 + PULL_ARM, w / 2 - PULL_ARM];
    const parts: Part[] = [
      cushion('upholstery', bx, [0.12, h - 0.02], [-d / 2, -d / 2 + 0.16], { softness: 0.3 }),
      sp('upholstery', bx, [0.12, 0.3], [zs - 0.08, zs], 0.01),
      sp('upholstery', bx, [0.12, 0.2], [-d / 2 + 0.16, zs - 0.08]),
    ];
    for (const [a, b] of cellSpans(3, bx[0], bx[1])) parts.push(cushion('upholstery', [a + 0.004, b - 0.004], [0.46, h - 0.06], [-d / 2 + 0.14, -d / 2 + 0.21], { softness: 0.45, plan: false }));
    for (const s of [-1, 1]) {
      const x: V2 = s < 0 ? [-w / 2, -w / 2 + PULL_ARM] : [w / 2 - PULL_ARM, w / 2];
      parts.push(cushion('upholstery', x, [0.12, 0.62], [-d / 2, zs], { softness: 0.3 }));
      for (const z of [-d / 2 + 0.08, zs - 0.08]) parts.push(vcyl('metal', s * (w / 2 - 0.1), z, 0, 0.12, 0.02, { rTop: 0.024, plan: false }));
    }
    // Fold-out frame: side and foot tubes, two folding U-legs.
    const fx = mw / 2 + 0.012;
    parts.push(
      rodZ('metal', -fx, 0.31, zs - 0.05, d / 2 - 0.03, 0.012, NP),
      rodZ('metal', fx, 0.31, zs - 0.05, d / 2 - 0.03, 0.012, NP),
      rodX('metal', -fx, fx, 0.31, d / 2 - 0.03, 0.012, NP),
    );
    for (const z of [zs + 0.5, d / 2 - 0.08]) {
      const lx = mw / 2 - 0.03;
      parts.push(rod('metal', [-lx, 0.015, z], [-lx, 0.31, z], 0.012, NP), rod('metal', [lx, 0.015, z], [lx, 0.31, z], 0.012, NP), rodX('metal', -lx, lx, 0.015, z, 0.012, NP));
    }
    parts.push(...dressBed(pullDress(size)));
    return parts;
  },
  planDetail: (size) => [...dressPlan(pullDress(size)), line([-size.w / 2, -size.d / 2 + PULL_SD], [size.w / 2, -size.d / 2 + PULL_SD])],
});

// ---------------------------------------------------------------------------
// 20. Fold-out foam chair bed
// ---------------------------------------------------------------------------

const chairBed = defineItem({
  id: 'chair-bed-foldout',
  name: 'Fold-out foam chair bed',
  category: 'living',
  type: 'beds',
  group: 'Daybeds & sofa beds',
  description:
    'A compact armchair made of three hinged foam blocks in a charcoal zip-off cover with contrast piping; unfolded, it lies flat as a 70 × 190 cm single mattress for a guest.',
  tags: ['chair bed', 'fold out chair', 'foam sofa bed', 'guest bed', 'armchair', 'small space', 'ghế sofa giường', 'ghế giường gấp', 'ghế nệm gấp'],
  defaultSize: { w: 0.85, d: 0.85, h: 0.78 },
  minSize: { w: 0.7, d: 0.75, h: 0.65 },
  maxSize: { w: 1.1, d: 0.95, h: 0.9 },
  slots: [matSlot('fabric', 'Foam cover', 'fabric-charcoal'), matSlot('piping', 'Piping', 'fabric-cream'), matSlot('cushion', 'Throw pillow', 'fabric-mustard')],
  build: ({ w, d, h }) => {
    const aw = 0.14;
    const sx: V2 = [-w / 2 + aw, w / 2 - aw];
    const ch = Math.min(0.36, h - 0.43);
    const cw = Math.min(0.4, sx[1] - sx[0] - 0.08);
    const parts: Part[] = [
      cushion('fabric', sx, [0, 0.19], [-d / 2 + 0.02, d / 2], { softness: 0.25 }),
      cushion('fabric', sx, [0.19, 0.4], [-d / 2 + 0.2, d / 2], { softness: 0.3, plan: false }),
      cushion('fabric', sx, [0.19, h - 0.015], [-d / 2 + 0.025, -d / 2 + 0.225], { softness: 0.3, rotation: [-0.08, 0, 0], plan: false }),
      rodX('piping', sx[0] + 0.02, sx[1] - 0.02, 0.392, d / 2 - 0.008, 0.006, NP),
      rodX('piping', sx[0] + 0.02, sx[1] - 0.02, 0.184, d / 2 - 0.006, 0.006, NP),
      cushion('cushion', [-cw / 2, cw / 2], [0.4, 0.4 + ch], [-d / 2 + 0.255, -d / 2 + 0.385], { softness: 0.45, rotation: [-0.25, 0, 0], plan: false }),
    ];
    for (const s of [-1, 1]) {
      const x: V2 = s < 0 ? [-w / 2, -w / 2 + aw] : [w / 2 - aw, w / 2];
      parts.push(cushion('fabric', x, [0, 0.56], [-d / 2 + 0.02, d / 2], { softness: 0.4 }), rodZ('piping', (x[0] + x[1]) / 2, 0.556, -d / 2 + 0.08, d / 2 - 0.06, 0.006, NP));
    }
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w / 2 + 0.14, -d / 2 + 0.2], [w / 2 - 0.14, -d / 2 + 0.2])],
});

// ---------------------------------------------------------------------------
// 21. Folding rollaway guest bed
// ---------------------------------------------------------------------------

function guestDress({ w, d, h }: Size3): Dress {
  return { a: [-w / 2 + 0.03, w / 2 - 0.03], l: [-d / 2 + 0.04, d / 2 - 0.03], y0: 0.313, top: 0.43, yMax: h, sheet: 'bedding', duvet: 'blanket', mattress: 'mattress', flat: true, pillows: 1, stacked: true };
}

const guestBed = defineItem({
  id: 'folding-guest-bed',
  name: 'Folding rollaway guest bed',
  category: 'bedroom',
  type: 'beds',
  group: 'Daybeds & sofa beds',
  description:
    'A single rollaway bed on an anthracite steel tube frame with a headrest loop, folding legs and castors at the centre hinge, made up with a pillow and a folded blanket. Folds in half to roll into a cupboard.',
  tags: ['folding bed', 'rollaway bed', 'guest bed', 'camp bed', 'cot', 'giường gấp', 'giường xếp', 'giường gấp có bánh xe'],
  defaultSize: { w: 0.86, d: 1.95, h: 0.62 },
  minSize: { w: 0.75, d: 1.85, h: 0.55 },
  maxSize: { w: 1.05, d: 2.05, h: 0.75 },
  wallSnap: true,
  slots: [
    matSlot('frame', 'Steel frame', 'metal-anthracite'),
    matSlot('mattress', 'Mattress cover', 'fabric-navy'),
    matSlot('bedding', 'Sheet & pillow', 'fabric-white-cotton'),
    matSlot('blanket', 'Folded blanket', 'fabric-wool-grey'),
  ],
  build: (size) => {
    const { w, d, h } = size;
    const r = 0.013;
    const fy = 0.3;
    const fx = w / 2 - 0.02;
    const zh = -d / 2 + 0.02;
    const parts: Part[] = [
      rodZ('frame', -fx, fy, zh, d / 2 - 0.02, r, NP),
      rodZ('frame', fx, fy, zh, d / 2 - 0.02, r, NP),
      rodX('frame', -fx, fx, fy, d / 2 - 0.02, r, NP),
      ...rodPath('frame', [
        [-fx, fy, zh],
        [-fx, h - 0.06, zh],
        [-fx + 0.04, h - 0.02, zh],
        [fx - 0.04, h - 0.02, zh],
        [fx, h - 0.06, zh],
        [fx, fy, zh],
      ], r),
    ];
    for (const x of [-fx, fx]) parts.push(cyl('frame', [x, fy, 0], 0.025, 0.03, { rotation: [0, 0, Math.PI / 2], plan: false }));
    const lx = fx - 0.04;
    for (const z of [-d / 2 + 0.18, d / 2 - 0.18]) parts.push(rod('frame', [-lx, 0.03, z], [-lx, fy, z], r, NP), rod('frame', [lx, 0.03, z], [lx, fy, z], r, NP), rodX('frame', -lx, lx, 0.03, z, r, NP));
    for (const z of [-0.05, 0.05]) {
      for (const x of [-lx, lx]) parts.push(rod('frame', [x, 0.07, z], [x, fy, z], r, NP), torus('frame', [x, 0.035, z], 0.025, 0.01, { rotation: [0, Math.PI / 2, 0], plan: false }));
    }
    const g = guestDress(size);
    parts.push(...dressBed(g), rodX('mattress', g.a[0] + 0.01, g.a[1] - 0.01, g.top - 0.004, 0, 0.012, NP));
    return parts;
  },
  planDetail: (size) => [...dressPlan(guestDress(size)), line([-size.w / 2 + 0.03, 0], [size.w / 2 - 0.03, 0])],
});

// ---------------------------------------------------------------------------
// 22. Upholstered box daybed with bolsters
// ---------------------------------------------------------------------------

const DAY_T = 0.14;

const boxDaybed = defineItem({
  id: 'upholstered-daybed',
  name: 'Upholstered box daybed with bolsters',
  category: 'living',
  type: 'beds',
  group: 'Daybeds & sofa beds',
  description:
    'A sofa by day and a single bed by night: an oat bouclé box frame wrapping a 90 × 190 cm mattress on three sides, with two round bolsters and rust linen back cushions, on walnut legs.',
  tags: ['daybed', 'sofa bed', 'guest bed', 'box daybed', 'bolster', 'studio', 'giường sofa', 'giường ban ngày', 'sofa giường đơn'],
  defaultSize: { w: 2.05, d: 0.98, h: 0.72 },
  minSize: { w: 1.95, d: 0.88, h: 0.62 },
  maxSize: { w: 2.25, d: 1.15, h: 0.85 },
  wallSnap: true,
  slots: [
    matSlot('frame', 'Upholstered frame', 'fabric-boucle-oat'),
    matSlot('seat', 'Seat & bolsters', 'fabric-cream'),
    matSlot('cushions', 'Back cushions', 'fabric-linen-rust'),
    matSlot('legs', 'Legs', 'wood-walnut'),
  ],
  build: ({ w, d, h }) => {
    const t = DAY_T;
    const base = 0.1;
    const ix: V2 = [-w / 2 + t, w / 2 - t];
    const parts: Part[] = [
      cushion('frame', [-w / 2, w / 2], [base, h], [-d / 2, -d / 2 + t], { softness: 0.3 }),
      cushion('frame', ix, [base, 0.32], [d / 2 - 0.08, d / 2], { softness: 0.3 }),
      sp('frame', ix, [base, 0.3], [-d / 2 + t, d / 2 - 0.08]),
      cushion('seat', [ix[0] + 0.003, ix[1] - 0.003], [0.3, 0.46], [-d / 2 + t, d / 2 - 0.015], { softness: 0.22, plan: false }),
      rodX('seat', ix[0] + 0.02, ix[1] - 0.02, 0.455, d / 2 - 0.02, 0.008, NP),
    ];
    for (const s of [-1, 1]) {
      parts.push(cushion('frame', s < 0 ? [-w / 2, -w / 2 + t] : [w / 2 - t, w / 2], [base, h - 0.1], [-d / 2, d / 2], { softness: 0.35 }));
      for (const z of [-d / 2 + 0.07, d / 2 - 0.07]) parts.push(turnedLeg('legs', s * (w / 2 - 0.07), z, 0, base + 0.005, 0.022, { style: 'taper' }));
    }
    const br = Math.min(0.1, (h - 0.46) / 2);
    for (const s of [-1, 1]) parts.push(rodZ('seat', s * (w / 2 - t - br - 0.01), 0.46 + br - 0.005, -d / 2 + t + 0.08, d / 2 - 0.1, br, { segments: 24, plan: false }));
    const inner = ix[1] - ix[0] - 4 * br - 0.06;
    const cw = Math.min(0.55, inner / 3 - 0.02);
    const ch = fitPillow(h - 0.46 + 0.03, 0.42, 0.16, 0.2);
    const cy = pillowY(0.46, ch, 0.16, 0.2);
    const cz = -d / 2 + t + 0.1;
    for (const cx of cells(3, ix[0] + 2 * br + 0.03, ix[1] - 2 * br - 0.03)) {
      parts.push(cushion('cushions', [cx - cw / 2, cx + cw / 2], [cy - ch / 2, cy + ch / 2], [cz - 0.08, cz + 0.08], { softness: 0.45, rotation: [-0.2, 0, 0], plan: false }));
    }
    return parts;
  },
  planDetail: ({ w, d }) => [rectPoly(-w / 2 + DAY_T, -d / 2 + DAY_T, w / 2 - DAY_T, d / 2 - 0.015)],
});

// ---------------------------------------------------------------------------
// Pack
// ---------------------------------------------------------------------------

export default definePack({
  name: 'Studio & apartment beds',
  version: '1.0.0',
  author: 'Neest team',
  description:
    'Beds for studios and small modern apartments: Murphy and side-tilt wall beds (open and folded, with a sofa, a desk or wardrobes), adult loft beds, raised and tatami platforms, steel, oak-legged, cane, arched, wrap-around, canopy and pallet beds, and pull-out, chair, rollaway and box daybed guest beds.',
  license: 'CC0 (made for Neest)',
  items: [
    murphyOpen,
    murphyClosed,
    sideTiltOpen,
    sideTiltClosed,
    wallBedSofa,
    wallBedDesk,
    wallBedWardrobes,
    loftSteel,
    loftStairs,
    raisedPlatform,
    tatamiBed,
    steelBed,
    leggedBed,
    caneBed,
    archBed,
    wrapBed,
    canopyBed,
    palletBed,
    pullOutSofaBed,
    chairBed,
    guestBed,
    boxDaybed,
  ],
  materials: [
    { id: 'tatami-igusa', name: 'Igusa tatami', category: 'rug', color: '#bdb97a', roughness: 0.85, pattern: { id: 'wallpaper-grasscloth', scale: 0.35, contrast: 0.8, rotation: 90 } },
    { id: 'sheer-voile', name: 'Ivory sheer voile', category: 'fabric', color: '#f6f3ec', roughness: 0.9, opacity: 0.5, pattern: { id: 'weave', scale: 0.04, contrast: 0.3 } },
    { id: 'pallet-pine', name: 'Raw pallet pine', category: 'wood', color: '#c9a878', roughness: 0.85, pattern: { id: 'wood-grain', scale: 0.6, contrast: 1.1 } },
  ],
});

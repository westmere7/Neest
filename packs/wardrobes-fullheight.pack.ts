/**
 * Full-height wardrobes — floor-to-ceiling built-ins that meet a 2.7 m ceiling (and resize from 2.3 to
 * 3.2 m to match other ceilings). Every one is built like real joinery: 3 mm reveals between doors,
 * scribed end panels flush with the fronts, a recessed kicker, a scribe or cornice that closes the gap
 * to the ceiling, and top-box cupboards once the ceiling is too high for one door.
 *
 * Types: shaker, handleless push-to-open, sliding (mirror, oak and mirror, smoked glass, shoji), bi-fold,
 * reeded oak, rattan cane, a lit glass-front walk-in, an open system, an L-shaped corner, a bridge over
 * a bed, a drawer bank, a lit dressing-mirror niche, loft steel and glass, and two Vietnamese-apartment
 * favourites (melamine MDF with aluminium handles, acrylic gloss with rounded open end shelves).
 *
 * Wardrobes whose interior shows (glass, cane, open) have a Filled and an Empty model; opaque sliding
 * wardrobes have Closed and Open (one door slid across, clothes inside). Contents never change the
 * size or the plan outline.
 */
import {
  arcPoints,
  barPull,
  cellSpans,
  cells,
  clamp,
  cyl,
  defineItem,
  definePack,
  discZ,
  knob,
  lathe,
  line,
  matSlot,
  prism,
  range,
  rng,
  rod,
  rodX,
  span,
  sphere,
  torus,
  vcyl,
  type MaterialSlot,
  type PackItem,
  type PackMaterial,
  type PackPattern,
  type Part,
  type PlanStroke,
  type Size3,
} from '@/packs/kit';

type V2 = [number, number];
const o = { plan: false } as const;
/** Reveal between doors and round every front. */
const GAP = 0.003;
/** Door thickness. */
const T = 0.019;
/** Carcass board thickness. */
const BT = 0.018;

const cycle = <X>(list: X[], n: number): X[] => range(n).map((i) => list[i % list.length]);

// ───────────────────────── Item shell ─────────────────────────

type WardrobeSpec = Omit<PackItem, 'category' | 'type' | 'group' | 'defaultSize' | 'minSize' | 'maxSize'> & { w: number; d: number; wr: V2; dr: V2 };

/** A floor-to-ceiling wardrobe on the bedroom Wardrobes shelf: 2.7 m by default, 2.3–3.2 m. */
const wardrobe = ({ w, d, wr, dr, ...rest }: WardrobeSpec): PackItem =>
  defineItem({
    category: 'bedroom',
    type: 'storage',
    group: 'Wardrobes',
    wallSnap: true,
    defaultSize: { w, d, h: 2.7 },
    minSize: { w: wr[0], d: dr[0], h: 2.3 },
    maxSize: { w: wr[1], d: dr[1], h: 3.2 },
    ...rest,
  });

interface Zones {
  /** Kicker height. */
  plinth: number;
  /** Top of the main doors. */
  top: number;
  /** Top of the top boxes (= top when there are none); the scribe or cornice runs from here to the ceiling. */
  boxTop: number;
  hasBox: boolean;
}

/** Height bands: kicker, main doors up to `plinth + main`, top boxes above when there is room, scribe. */
function zones(h: number, opts?: { plinth?: number; scribe?: number; main?: number }): Zones {
  const plinth = opts?.plinth ?? 0.1;
  const boxTop = h - (opts?.scribe ?? 0.04);
  const main = plinth + (opts?.main ?? 2.2);
  const hasBox = boxTop - main >= 0.28;
  return { plinth, boxTop, top: hasBox ? main : boxTop, hasBox };
}

const doorCount = (width: number, target: number, lo: number, hi: number) => clamp(Math.round(width / target), lo, hi);
/** Pairs of doors meet in the middle; an odd last door hinges on the wall side. */
const handleRight = (i: number, n: number) => i % 2 === 0 && i !== n - 1;

/**
 * Solid wardrobe body: end panels flush with the door fronts (zF), the carcass behind the doors, a
 * recessed kicker and either a scribe to the ceiling or a stepped cornice.
 */
function shell(slot: string, { w, d, h }: Size3, z: Zones, zF: number, zD: number, end: number, opts?: { cornice?: boolean; block?: string; kick?: string }): Part[] {
  const zb = -d / 2;
  const top = opts?.cornice ? z.boxTop : h;
  const xi: V2 = [-w / 2 + end, w / 2 - end];
  const parts = [
    span(slot, [-w / 2, xi[0]], [0, top], [zb, zF]),
    span(slot, [xi[1], w / 2], [0, top], [zb, zF]),
    span(opts?.block ?? slot, xi, [z.plinth, z.boxTop], [zb, zD - 0.002]),
    span(opts?.kick ?? slot, xi, [0, z.plinth], [zb, zF - 0.06], o),
  ];
  if (opts?.cornice) parts.push(span(slot, [-w / 2, w / 2], [z.boxTop, z.boxTop + 0.018], [zb, zF + 0.008], o), span(slot, [-w / 2, w / 2], [z.boxTop + 0.018, h], [zb, zF + 0.02], o));
  else parts.push(span(slot, xi, [z.boxTop, h], [zb, zF - 0.006], o));
  return parts;
}

/** Plan: the line of the fronts with a tick at every door joint. */
const frontPlan = (x0: number, x1: number, z: number, n: number): PlanStroke[] => [line([x0, z], [x1, z]), ...cellSpans(n, x0, x1).slice(1).map(([a]) => line([a, z - 0.04], [a, z]))];

// ───────────────────────── Fronts ─────────────────────────

/** Flat slab door over x × y (reveal taken off each edge), back face at zb. */
const slab = (slot: string, x: V2, y: V2, zb: number, t = T, bevel = 0.0015): Part => span(slot, [x[0] + GAP / 2, x[1] - GAP / 2], [y[0] + GAP / 2, y[1] - GAP / 2], [zb, zb + t], { bevel, plan: false });

/** Shaker door: stiles and rails round recessed panels, with an optional mid rail at `mid`. */
function shaker(slot: string, x: V2, y: V2, zb: number, t: number, rail = 0.07, mid?: number): Part[] {
  const [x0, x1, y0, y1] = [x[0] + GAP / 2, x[1] - GAP / 2, y[0] + GAP / 2, y[1] - GAP / 2];
  const rl = Math.min(rail, (x1 - x0) * 0.3, (y1 - y0) * 0.3);
  const zf = zb + t;
  const p = [
    span(slot, [x0, x0 + rl], [y0, y1], [zb, zf], o),
    span(slot, [x1 - rl, x1], [y0, y1], [zb, zf], o),
    span(slot, [x0 + rl, x1 - rl], [y1 - rl, y1], [zb, zf], o),
    span(slot, [x0 + rl, x1 - rl], [y0, y0 + rl], [zb, zf], o),
  ];
  const hasMid = mid !== undefined && mid - rl > y0 + rl + 0.15 && mid + rl < y1 - rl - 0.15;
  const panels: V2[] = hasMid ? [[y0 + rl, mid - rl / 2], [mid + rl / 2, y1 - rl]] : [[y0 + rl, y1 - rl]];
  if (hasMid) p.push(span(slot, [x0 + rl, x1 - rl], [mid - rl / 2, mid + rl / 2], [zb, zf], o));
  for (const py of panels) p.push(span(slot, [x0 + rl, x1 - rl], py, [zb, zf - 0.007], o));
  return p;
}

/** Framed door: stiles and rails round an infill (glass, cane), with optional glazing bars and a mid rail. */
function framedDoor(frame: string, infill: string, x: V2, y: V2, zb: number, t: number, rail: number, opts?: { bars?: number; mid?: number; vbar?: boolean }): Part[] {
  const [x0, x1, y0, y1] = [x[0] + GAP / 2, x[1] - GAP / 2, y[0] + GAP / 2, y[1] - GAP / 2];
  const rl = Math.min(rail, (x1 - x0) * 0.3);
  const zf = zb + t;
  const p = [
    span(frame, [x0, x0 + rl], [y0, y1], [zb, zf], o),
    span(frame, [x1 - rl, x1], [y0, y1], [zb, zf], o),
    span(frame, [x0 + rl, x1 - rl], [y1 - rl, y1], [zb, zf], o),
    span(frame, [x0 + rl, x1 - rl], [y0, y0 + rl], [zb, zf], o),
    // The infill runs 4 mm into the frame groove, so its edges never sit on a rail or bar face.
    span(infill, [x0 + rl - 0.004, x1 - rl + 0.004], [y0 + rl - 0.004, y1 - rl + 0.004], [zb + t / 2 - 0.003, zb + t / 2 + 0.003], o),
  ];
  const bw = Math.min(0.018, rl * 0.6);
  const mid = opts?.mid;
  if (mid !== undefined && mid > y0 + rl + 0.2 && mid < y1 - rl - 0.2) p.push(span(frame, [x0 + rl, x1 - rl], [mid - rl / 2, mid + rl / 2], [zb, zf], o));
  const nb = opts?.bars ?? 0;
  for (const [, b] of cellSpans(nb + 1, y0 + rl, y1 - rl).slice(0, nb)) p.push(span(frame, [x0 + rl, x1 - rl], [b - bw / 2, b + bw / 2], [zb + 0.002, zf - 0.002], o));
  if (opts?.vbar) p.push(span(frame, [(x0 + x1) / 2 - bw / 2, (x0 + x1) / 2 + bw / 2], [y0 + rl, y1 - rl], [zb + 0.002, zf - 0.002], o));
  return p;
}

/**
 * Slab door with a routed finger pull along one edge ('left'/'right': a vertical channel at that edge;
 * 'top'/'bottom': a horizontal one), so it needs no handle.
 */
function grooveDoor(slot: string, x: V2, y: V2, zb: number, edge: 'left' | 'right' | 'top' | 'bottom', t = T): Part[] {
  const [x0, x1, y0, y1] = [x[0] + GAP / 2, x[1] - GAP / 2, y[0] + GAP / 2, y[1] - GAP / 2];
  const g = 0.028;
  const back: V2 = [zb, zb + t - 0.014];
  const front: V2 = [zb, zb + t];
  if (edge === 'left') return [span(slot, [x0 + g, x1], [y0, y1], front, o), span(slot, [x0, x0 + g], [y0, y1], back, o)];
  if (edge === 'right') return [span(slot, [x0, x1 - g], [y0, y1], front, o), span(slot, [x1 - g, x1], [y0, y1], back, o)];
  if (edge === 'top') return [span(slot, [x0, x1], [y0, y1 - g], front, o), span(slot, [x0, x1], [y1 - g, y1], back, o)];
  return [span(slot, [x0, x1], [y0 + g, y1], front, o), span(slot, [x0, x1], [y0, y0 + g], back, o)];
}

type Pull = 'bar' | 'long' | 'ring' | 'leather' | 'profile';

/** A door handle on a front whose face is at depth z (all stay within 34 mm of it). */
function pull(kind: Pull, slot: string, x: number, y: number, z: number, len = 0.32): Part[] {
  switch (kind) {
    case 'bar':
      return barPull(slot, [x, y, z], len, { vertical: true });
    case 'long':
      return barPull(slot, [x, y, z], len, { vertical: true, r: 0.007, stand: 0.026 });
    case 'ring':
      return [discZ(slot, [x, y + 0.022, z + 0.004], 0.011, 0.008, o), torus(slot, [x, y, z + 0.009], 0.021, 0.0032, o)];
    case 'leather':
      return [span(slot, [x - 0.0125, x + 0.0125], [y - 0.075, y + 0.075], [z, z + 0.003], o), span(slot, [x - 0.012, x + 0.012], [y - 0.06, y + 0.06], [z + 0.003, z + 0.02], { bevel: 0.008, plan: false })];
    case 'profile':
      // Aluminium T-profile handle (tay nắm thanh nhôm): a stem and a flange.
      return [span(slot, [x - 0.004, x + 0.004], [y - len / 2, y + len / 2], [z, z + 0.014], o), span(slot, [x - 0.012, x + 0.012], [y - len / 2, y + len / 2], [z + 0.014, z + 0.02], { bevel: 0.002, plan: false })];
  }
}

/** Vertical bar pull on a front facing +x (the return of an L wardrobe), face at x. */
function barPullX(slot: string, x: number, y: number, z: number, len: number): Part[] {
  const st = 0.028;
  const r = 0.0055;
  return [
    rod(slot, [x + st, y - len / 2, z], [x + st, y + len / 2, z], r, o),
    rod(slot, [x, y - len / 2 + 0.015, z], [x + st, y - len / 2 + 0.015, z], r * 0.8, o),
    rod(slot, [x, y + len / 2 - 0.015, z], [x + st, y + len / 2 - 0.015, z], r * 0.8, o),
  ];
}

// ───────────────────────── Interiors & contents ─────────────────────────

/** Parts that are contents (clothes, shoes, boxes): see `filled`. */
const FILL = new WeakSet<Part>();
function F<P extends Part | Part[]>(p: P): P {
  for (const x of Array.isArray(p) ? p : [p]) FILL.add(x);
  return p;
}
const isFill = (p: Part) => FILL.has(p);

/** Slots of the contents (the Filled / Open models' own slots). */
const CONTENT_SLOTS: MaterialSlot[] = [matSlot('clothes', 'Hanging clothes', 'garments-mix'), matSlot('folded', 'Folded clothes & shoes', 'folded-mix'), matSlot('boxes', 'Storage boxes', 'linen-box')];

/** Splits off the contents as the default "Filled" model's props, with an "Empty" model beside it. */
function filled(item: PackItem): PackItem {
  const raw = item.build;
  return {
    ...item,
    build: (s) => raw(s).filter((p) => !isFill(p)),
    models: [
      { id: 'filled', name: 'Filled', slots: CONTENT_SLOTS, props: (s) => raw(s).filter(isFill) },
      { id: 'empty', name: 'Empty' },
    ],
  };
}

interface Inside {
  /** Carcass, shelves and dividers. */
  body: string;
  /** Hanging rails and drawer pulls. */
  rail: string;
  /** Drawer fronts (defaults to body). */
  front?: string;
  /** LED strips under the shelves. */
  light?: string;
  /** false = no back panel (open systems against the wall). */
  back?: boolean;
}
type Bay = 'hang' | 'long' | 'double' | 'shelves' | 'drawers' | 'shoes' | 'boxes';

/** Hanging clothes in a few garment groups of different lengths under a rail, with some hanger hooks. */
function hanging(S: Inside, a: number, b: number, y: number, len: number, zc: number, dep: number, r: () => number): Part[] {
  const out: Part[] = [rodX(S.rail, a, b, y, zc, 0.0095, o)];
  if (len < 0.2) return out;
  const n = clamp(Math.round((b - a) / 0.2), 1, 6);
  const D = Math.min(0.5, dep - 0.06);
  for (const [g0, g1] of cellSpans(n, a + 0.02, b - 0.02)) {
    const L = len * (0.6 + 0.4 * r());
    const dd = D * (0.8 + 0.2 * r());
    out.push(F(span('clothes', [g0 + 0.004, g1 - 0.004], [y - 0.045 - L, y - 0.045], [zc - dd / 2, zc + dd / 2], { bevel: 0.022, plan: false })));
  }
  for (const x of cells(Math.min(3, n), a + 0.05, b - 0.05)) out.push(F(torus(S.rail, [x, y + 0.012, zc], 0.014, 0.002, { rotation: [0, Math.PI / 2, 0], arc: Math.PI * 1.4, plan: false })));
  return out;
}

/** Folded clothes stacks on a shelf at y. */
function foldedStacks(a: number, b: number, y: number, h: number, zi: number, dep: number, r: () => number): Part[] {
  if (h < 0.08) return [];
  const n = Math.max(1, Math.floor((b - a) / 0.3));
  const hw = Math.min(0.13, (b - a) / (2 * n) - 0.02);
  return F(cells(n, a, b).map((cx) => span('folded', [cx - hw, cx + hw], [y, y + h * (0.6 + 0.4 * r())], [zi + 0.02, zi + Math.min(dep - 0.04, 0.34)], { bevel: 0.01, plan: false })));
}

/** Pairs of shoes on a shelf or floor at y. */
function shoePairs(a: number, b: number, y: number, zi: number, dep: number): Part[] {
  const n = clamp(Math.floor((b - a) / 0.2), 1, 4);
  const zc = zi + dep * 0.5;
  return F(cells(n, a, b).flatMap((cx) => [-0.045, 0.045].map((dx) => span('folded', [cx + dx - 0.038, cx + dx + 0.038], [y, y + 0.085], [zc - 0.13, zc + 0.13], { bevel: 0.025, plan: false }))));
}

/** Fabric storage boxes on a shelf at y. */
function storageBoxes(a: number, b: number, y: number, h: number, zi: number, dep: number, r: () => number): Part[] {
  if (h < 0.1) return [];
  const n = Math.max(1, Math.floor((b - a) / 0.36));
  const hw = Math.min(0.16, (b - a) / (2 * n) - 0.015);
  return F(cells(n, a, b).map((cx) => span('boxes', [cx - hw, cx + hw], [y, y + Math.min(h, 0.3) * (0.75 + 0.25 * r())], [zi + 0.02, zi + Math.min(dep - 0.03, 0.42)], { bevel: 0.012, plan: false })));
}

/** One bay of a wardrobe interior between a and b, floor ya to ceiling yb, depth zi..zf. */
function bay(S: Inside, kind: Bay, a: number, b: number, ya: number, yb: number, zi: number, zf: number, r: () => number): Part[] {
  const p: Part[] = [];
  const dep = zf - zi;
  const zc = zi + dep / 2;
  const H = yb - ya;
  /** A shelf whose top is at y, lit from below when the wardrobe has LED strips. */
  const shelf = (y: number) => {
    p.push(span(S.body, [a, b], [y - BT, y], [zi, zf - 0.012], o));
    if (S.light) p.push(span(S.light, [a + 0.01, b - 0.01], [y - BT - 0.006, y - BT], [zf - 0.05, zf - 0.036], o));
  };
  /** Compartments between shelves at `ys`, filled by `fill(y, clearHeight, index)`. */
  const shelves = (y0: number, ys: number[], fill: (y: number, gap: number, i: number) => void) => {
    ys.forEach(shelf);
    const bottoms = [y0, ...ys];
    const tops = [...ys.map((y) => y - BT), yb];
    bottoms.forEach((y, i) => fill(y, tops[i] - y, i));
  };
  switch (kind) {
    case 'hang':
    case 'long':
    case 'double': {
      const hat = yb - clamp(H * 0.15, 0.25, 0.4);
      shelf(hat);
      if (S.light) p.push(span(S.light, [a + 0.01, b - 0.01], [yb - 0.006, yb], [zf - 0.05, zf - 0.036], o));
      p.push(...foldedStacks(a, b, hat, Math.min(0.24, yb - hat - 0.04), zi, dep, r));
      const rail = hat - BT - 0.06;
      if (kind === 'double') {
        const lower = ya + (rail - ya) * 0.48;
        p.push(...hanging(S, a, b, rail, Math.min(0.9, rail - lower - 0.1), zc, dep, r), ...hanging(S, a, b, lower, Math.min(0.9, lower - ya - 0.1), zc, dep, r));
      } else {
        p.push(...hanging(S, a, b, rail, kind === 'long' ? Math.min(1.5, rail - ya - 0.12) : Math.min(1.05, rail - ya - 0.4), zc, dep, r));
        if (kind === 'hang') p.push(...shoePairs(a, b, ya, zi, dep));
      }
      break;
    }
    case 'shelves':
    case 'shoes': {
      const n = clamp(Math.round(H / (kind === 'shoes' ? 0.24 : 0.36)), 2, 11);
      shelves(ya, range(n - 1).map((i) => ya + (H * (i + 1)) / n), (y, gap, i) => {
        if (kind === 'shoes' && y < ya + 1.2 && gap > 0.1) p.push(...shoePairs(a, b, y, zi, dep));
        else if (i % 3 === 1) p.push(...storageBoxes(a, b, y, gap - 0.03, zi, dep, r));
        else p.push(...foldedStacks(a, b, y, Math.min(0.26, gap - 0.04), zi, dep, r));
      });
      break;
    }
    case 'drawers': {
      const dh = 0.19;
      const nd = H > 1.2 ? 3 : 2;
      for (const k of range(nd)) {
        const y0 = ya + k * dh;
        p.push(span(S.front ?? S.body, [a + 0.004, b - 0.004], [y0 + 0.002, y0 + dh - 0.002], [zf - 0.03, zf - 0.012], { bevel: 0.002, plan: false }));
        p.push(rodX(S.rail, (a + b) / 2 - 0.07, (a + b) / 2 + 0.07, y0 + dh - 0.045, zf - 0.0065, 0.005, o));
      }
      const top = ya + nd * dh + BT + 0.01;
      const n = clamp(Math.round((yb - top) / 0.36), 1, 7);
      shelves(top, [top, ...range(n - 1).map((i) => top + ((yb - top) * (i + 1)) / n)].slice(1), (y, gap, i) => {
        if (i % 2 === 1) p.push(...storageBoxes(a, b, y, gap - 0.03, zi, dep, r));
        else p.push(...foldedStacks(a, b, y, Math.min(0.26, gap - 0.04), zi, dep, r));
      });
      shelf(top);
      break;
    }
    case 'boxes':
      p.push(...storageBoxes(a, b, ya, H - 0.03, zi, dep, r));
      break;
  }
  return p;
}

/** A wardrobe interior over x × y: back panel, bottom and top boards, dividers and one bay per entry. */
function interior(S: Inside, x: V2, y: V2, zb: number, zf: number, bays: Bay[], seed: number): Part[] {
  const [x0, x1] = x;
  const [y0, y1] = y;
  const zi = S.back === false ? zb : zb + 0.01;
  const parts: Part[] = [span(S.body, [x0, x1], [y0, y0 + BT], [zi, zf], o), span(S.body, [x0, x1], [y1 - BT, y1], [zi, zf], o)];
  if (S.back !== false) parts.push(span(S.body, [x0, x1], [y0, y1], [zb, zi], o));
  const spans = cellSpans(bays.length, x0, x1);
  for (const [a] of spans.slice(1)) parts.push(span(S.body, [a - BT / 2, a + BT / 2], [y0 + BT, y1 - BT], [zi, zf], o));
  const r = rng(seed);
  spans.forEach(([a, b], i) => parts.push(...bay(S, bays[i], a + (i > 0 ? BT / 2 : 0), b - (i < spans.length - 1 ? BT / 2 : 0), y0 + BT, y1 - BT, zi, zf, r)));
  return parts;
}

// ───────────────────────── Sliding wardrobes ─────────────────────────

interface SlideCfg {
  carcass: string;
  /** Door frames and tracks. */
  frame: string;
  /** Infill of door k of n. */
  infill: (k: number, n: number) => { slot: string; kind: 'flat' | 'transoms' | 'shoji' };
  inside: Inside;
  bays: Bay[];
  seed: number;
}

function slideGeo({ w, d, h }: Size3) {
  const xi: V2 = [-w / 2 + 0.02, w / 2 - 0.02];
  const W = xi[1] - xi[0];
  const n = clamp(Math.round(W / 0.95), 2, 4);
  const ov = 0.04;
  return { xi, W, n, ov, dw: (W + ov * (n - 1)) / n, yb: 0.016, yt: Math.min(h - 0.1, 2.72), zC: d / 2 - 0.085 };
}
/** Three doors: the middle one runs on the front track; otherwise every other door. */
const frontTrack = (k: number, n: number) => (n === 3 ? k === 1 : k % 2 === 1);

/** Carcass, interior (with contents marked), and the pelmet or top boxes above the track. */
function slideBody(size: Size3, c: SlideCfg): Part[] {
  const { w, d, h } = size;
  const g = slideGeo(size);
  const zb = -d / 2;
  const top = g.yt + 0.025;
  const parts: Part[] = [
    span(c.carcass, [-w / 2, g.xi[0]], [0, h], [zb, d / 2 - 0.004]),
    span(c.carcass, [g.xi[1], w / 2], [0, h], [zb, d / 2 - 0.004]),
    span(c.carcass, g.xi, [0, 0.06], [zb, g.zC - 0.03]),
    ...interior(c.inside, g.xi, [0.06, top], zb, g.zC, cycle(c.bays, clamp(Math.round(g.W / 0.6), 2, 6)), c.seed),
  ];
  if (h - top > 0.22) {
    // Ceilings above 2.85 m: top-box doors over the sliding doors, flush with the front track.
    const zt = d / 2 - 0.03;
    parts.push(span(c.carcass, g.xi, [top, h - 0.03], [zb, zt - 0.002]));
    for (const ax of cellSpans(g.n, g.xi[0], g.xi[1])) parts.push(slab(c.carcass, ax, [top, h - 0.03], zt));
    parts.push(span(c.carcass, g.xi, [h - 0.03, h], [zb, zt + T - 0.006], o));
  } else parts.push(span(c.carcass, g.xi, [top, h], [zb, d / 2 - 0.008]));
  return parts;
}

const slideTracks = (size: Size3, c: SlideCfg): Part[] => {
  const g = slideGeo(size);
  return [span(c.frame, g.xi, [0, 0.012], [g.zC, size.d / 2 - 0.01], o), span(c.frame, g.xi, [g.yt, g.yt + 0.025], [g.zC, size.d / 2 - 0.01], o)];
};

/** Aluminium-framed sliding doors on two tracks; `open` slides one front door across its neighbour. */
function slideDoors(size: Size3, c: SlideCfg, open: boolean): Part[] {
  const g = slideGeo(size);
  const parts: Part[] = [];
  const st = 0.024;
  const rl = 0.04;
  const moved = open ? (g.n === 3 ? 1 : g.n - 1) : -1;
  for (const k of range(g.n)) {
    const z0 = frontTrack(k, g.n) ? g.zC + 0.044 : g.zC + 0.012;
    const z1 = z0 + 0.022;
    const x0 = g.xi[0] + k * (g.dw - g.ov) + (k === moved ? (g.n === 3 ? 1 : -1) * (g.dw - g.ov) : 0);
    const x1 = x0 + g.dw;
    const [yb, yt] = [g.yb, g.yt];
    // Full-height stiles stand 8 mm proud: they are the handles.
    parts.push(
      span(c.frame, [x0, x0 + st], [yb, yt], [z0, z1 + 0.008], o),
      span(c.frame, [x1 - st, x1], [yb, yt], [z0, z1 + 0.008], o),
      span(c.frame, [x0 + st, x1 - st], [yt - rl, yt], [z0, z1], o),
      span(c.frame, [x0 + st, x1 - st], [yb, yb + rl], [z0, z1], o),
    );
    const ix: V2 = [x0 + st, x1 - st];
    const iy: V2 = [yb + rl, yt - rl];
    const zi: V2 = [z0 + 0.007, z1 - 0.007];
    const f = c.infill(k, g.n);
    if (f.kind === 'flat') parts.push(span(f.slot, ix, iy, zi, o));
    else if (f.kind === 'transoms') {
      for (const [i, [a, b]] of cellSpans(3, iy[0], iy[1]).entries()) {
        parts.push(span(f.slot, ix, [a + (i > 0 ? 0.006 : 0), b - (i < 2 ? 0.006 : 0)], zi, o));
        if (i < 2) parts.push(span(c.frame, ix, [b - 0.006, b + 0.006], [zi[0] - 0.002, zi[1] + 0.002], o));
      }
    } else {
      // Shoji: paper behind a kumiko lattice of two uprights and evenly spaced cross bars.
      parts.push(span(f.slot, ix, iy, [zi[0], zi[0] + 0.004], o));
      const zl: V2 = [zi[0] + 0.004, z1 - 0.003];
      for (const [, xb] of cellSpans(3, ix[0], ix[1]).slice(0, 2)) parts.push(span(c.frame, [xb - 0.007, xb + 0.007], iy, zl, o));
      const nh = clamp(Math.round((iy[1] - iy[0]) / 0.3), 3, 9);
      for (const [, yy] of cellSpans(nh, iy[0], iy[1]).slice(0, nh - 1)) parts.push(span(c.frame, ix, [yy - 0.007, yy + 0.007], zl, o));
    }
  }
  return parts;
}

const slidePlan = ({ w, d }: Size3): PlanStroke[] => {
  const zC = d / 2 - 0.085;
  return [line([-w / 2 + 0.02, zC + 0.023], [w / 2 - 0.02, zC + 0.023]), line([-w / 2 + 0.02, zC + 0.055], [w / 2 - 0.02, zC + 0.055])];
};

/** Opaque sliding wardrobe: Closed, and Open with one door slid across and clothes inside. */
function slidingOpaque(spec: Omit<WardrobeSpec, 'build'>, c: SlideCfg, doorSlots: string[]): PackItem {
  const hidden = new Set(doorSlots);
  return wardrobe({
    ...spec,
    build: (s) => [...slideBody(s, c).filter((p) => !isFill(p)), ...slideTracks(s, c), ...slideDoors(s, c, false)],
    planDetail: slidePlan,
    models: [
      { id: 'closed', name: 'Closed' },
      {
        id: 'open',
        name: 'Open',
        hide: doorSlots,
        slots: [...spec.slots.filter((sl) => hidden.has(sl.id)), ...CONTENT_SLOTS],
        // The hidden slots come back slid open; interior parts in those slots (rails) come back too.
        props: (s) => [...slideTracks(s, c), ...slideDoors(s, c, true), ...slideBody(s, c).filter((p) => isFill(p) || hidden.has(p.slot))],
      },
    ],
  });
}

// ───────────────────────── Showcase (glass, cane, steel) hinged wardrobes ─────────────────────────

interface ShowCfg {
  frame: string;
  infill: string;
  carcass: string;
  handles: string;
  inside: Inside;
  bays: Bay[];
  seed: number;
  pull: Pull;
  pullLen?: number;
  rail?: number;
  t?: number;
  bars?: number;
  vbar?: boolean;
  mid?: number;
  /** Side panels of the frame material (steel) instead of the carcass. */
  sides?: string;
  zones?: Parameters<typeof zones>[1];
}

/** Hinged framed doors over a visible interior; top boxes framed the same way. */
function showcase(size: Size3, c: ShowCfg): Part[] {
  const { w, d, h } = size;
  const zb = -d / 2;
  const z = zones(h, c.zones);
  const t = c.t ?? 0.022;
  const zF = d / 2 - 0.035;
  const zD = zF - t;
  const end = 0.02;
  const xi: V2 = [-w / 2 + end, w / 2 - end];
  const n = doorCount(xi[1] - xi[0], 0.5, 2, 6);
  const parts: Part[] = [
    span(c.sides ?? c.carcass, [-w / 2, xi[0]], [0, h], [zb, zF]),
    span(c.sides ?? c.carcass, [xi[1], w / 2], [0, h], [zb, zF]),
    span(c.sides ?? c.carcass, xi, [0, z.plinth], [zb, zF - 0.05]),
    span(c.sides ?? c.carcass, xi, [z.boxTop, h], [zb, zF - 0.006]),
    ...interior(c.inside, xi, [z.plinth, z.top], zb, zD - 0.004, cycle(c.bays, n), c.seed),
  ];
  if (z.hasBox) parts.push(...interior(c.inside, xi, [z.top, z.boxTop], zb, zD - 0.004, cycle<Bay>(['boxes'], n), c.seed + 7));
  for (const [i, [x0, x1]] of cellSpans(n, xi[0], xi[1]).entries()) {
    const right = handleRight(i, n);
    const hx = right ? x1 - 0.042 : x0 + 0.042;
    parts.push(...framedDoor(c.frame, c.infill, [x0, x1], [z.plinth, z.top], zD, t, c.rail ?? 0.05, { bars: c.bars, vbar: c.vbar, mid: c.mid }));
    parts.push(...pull(c.pull, c.handles, hx, Math.min(1.1, z.top - 0.5), zF, c.pullLen));
    if (z.hasBox) parts.push(...framedDoor(c.frame, c.infill, [x0, x1], [z.top, z.boxTop], zD, t, c.rail ?? 0.05));
  }
  return parts;
}

// ───────────────────────── Patterns & materials ─────────────────────────

const GARMENTS = ['#2f3b52', '#e9e4da', '#8a3b2c', '#6f7b5c', '#d7c3a5', '#1f1f22', '#a9b8c9', '#c97f5a', '#f2efe8', '#596a7a', '#7c5a46', '#b9a07a', '#e3c9c9', '#3d5a4a'];

const patterns: PackPattern[] = [
  {
    id: 'garments',
    name: 'Clothes on hangers',
    colored: true,
    normalStrength: 0.8,
    draw(ctx, size, rand) {
      let x = 0;
      while (x < size) {
        const w = Math.round(size * (0.04 + rand() * 0.06));
        const c = GARMENTS[Math.floor(rand() * GARMENTS.length)];
        ctx.fillStyle = c;
        ctx.fillRect(x, 0, w, size);
        const g = ctx.createLinearGradient(x, 0, x + w, 0);
        g.addColorStop(0, '#00000040');
        g.addColorStop(0.2, '#00000000');
        g.addColorStop(0.8, '#00000000');
        g.addColorStop(1, '#00000050');
        ctx.fillStyle = g;
        ctx.fillRect(x, 0, w, size);
        // Shoulders in shadow at the top, a hem or waistband lower down on some.
        ctx.fillStyle = '#00000030';
        ctx.fillRect(x, 0, w, Math.round(size * 0.05));
        if (rand() < 0.5) ctx.fillRect(x, Math.round(size * (0.45 + rand() * 0.4)), w, Math.round(size * 0.02));
        x += w;
      }
    },
  },
  {
    id: 'folded-stack',
    name: 'Folded clothes',
    colored: true,
    normalStrength: 0.8,
    draw(ctx, size, rand) {
      let y = 0;
      while (y < size) {
        const h = Math.round(size * (0.06 + rand() * 0.06));
        ctx.fillStyle = GARMENTS[Math.floor(rand() * GARMENTS.length)];
        ctx.fillRect(0, y, size, h);
        ctx.fillStyle = '#00000038';
        ctx.fillRect(0, y + h - 2, size, 2);
        y += h;
      }
    },
  },
  {
    id: 'cane-open',
    name: 'Open cane webbing',
    cutout: true,
    normalStrength: 1,
    draw(ctx, size) {
      // Horizontal, vertical and two diagonal strands round open octagons; the holes stay transparent.
      ctx.clearRect(0, 0, size, size);
      const n = 6;
      const step = size / n;
      const stroke = (x0: number, y0: number, x1: number, y1: number) => {
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      };
      ctx.lineCap = 'butt';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = step * 0.13;
      for (let i = 0; i <= n; i++) {
        stroke(i * step, -1, i * step, size + 1);
        stroke(-1, i * step, size + 1, i * step);
      }
      ctx.strokeStyle = '#ececec';
      ctx.lineWidth = step * 0.07;
      for (let k = -n; k <= 2 * n; k++) {
        const c = (k + 0.5) * step;
        stroke(c - step, -step, c + size + step, size + step);
        stroke(c + step, -step, c - size - step, size + step);
      }
    },
  },
];

const materials: PackMaterial[] = [
  { id: 'garments-mix', name: 'Clothes on hangers', category: 'fabric', color: '#ffffff', roughness: 0.95, pattern: { id: 'garments', scale: 0.7, contrast: 1 } },
  { id: 'folded-mix', name: 'Folded clothes', category: 'fabric', color: '#ffffff', roughness: 0.95, pattern: { id: 'folded-stack', scale: 0.32, contrast: 1 } },
  { id: 'linen-box', name: 'Linen storage box', category: 'fabric', color: '#cbbda4', roughness: 0.95, pattern: { id: 'weave', scale: 0.1, contrast: 0.6 } },
  { id: 'cane-open', name: 'Open rattan cane', category: 'wood', color: '#d4b07a', roughness: 0.8, pattern: { id: 'cane-open', scale: 0.15, contrast: 1 } },
  { id: 'bronze-glass', name: 'Bronze glass', category: 'glass', color: '#8a6f55', roughness: 0.05, opacity: 0.4 },
  { id: 'washi-paper', name: 'Washi paper', category: 'fabric', color: '#f3ecdc', roughness: 0.9, opacity: 0.85, pattern: { id: 'weave', scale: 0.06, contrast: 0.25 } },
];

// ───────────────────────── Items ─────────────────────────

const shakerWall = wardrobe({
  id: 'shaker-wardrobe-top-boxes',
  name: 'Shaker wardrobe wall with top boxes',
  w: 2.4,
  d: 0.62,
  wr: [1.0, 4.8],
  dr: [0.55, 0.72],
  tags: ['wardrobe', 'fitted wardrobe', 'shaker', 'built-in', 'floor to ceiling', 'tủ áo âm trần'],
  description: 'Floor-to-ceiling painted shaker wardrobe: tall framed doors with a mid rail and brass bar pulls, top-box cupboards with knobs, scribed end panels, a recessed kicker and a stepped cornice at the ceiling.',
  slots: [matSlot('doors', 'Doors', 'paint-warm-white'), matSlot('carcass', 'Carcass, kicker & cornice', 'paint-warm-white'), matSlot('handles', 'Handles', 'metal-brass')],
  variants: [
    { id: 'sage', name: 'Sage & brass', materials: { doors: 'paint-sage', carcass: 'paint-sage' } },
    { id: 'navy', name: 'Navy & brass', materials: { doors: 'paint-navy', carcass: 'paint-navy' } },
    { id: 'mushroom', name: 'Mushroom & black', materials: { doors: 'paint-mushroom', carcass: 'paint-mushroom', handles: 'metal-black-matte' } },
    { id: 'oak', name: 'Oak & black', materials: { doors: 'wood-oak-natural', carcass: 'wood-oak-natural', handles: 'metal-black-matte' } },
  ],
  build: (size) => {
    const { w, d, h } = size;
    const z = zones(h, { scribe: 0.05 });
    const end = 0.05;
    const zF = d / 2 - 0.035;
    const t = 0.022;
    const zD = zF - t;
    const parts = shell('carcass', size, z, zF, zD, end, { cornice: true });
    const n = doorCount(w - 2 * end, 0.5, 2, 8);
    for (const [i, [x0, x1]] of cellSpans(n, -w / 2 + end, w / 2 - end).entries()) {
      const hx = handleRight(i, n) ? x1 - 0.045 : x0 + 0.045;
      parts.push(...shaker('doors', [x0, x1], [z.plinth, z.top], zD, t, 0.075, 1.05), ...pull('bar', 'handles', hx, 1.05, zF));
      if (z.hasBox) parts.push(...shaker('doors', [x0, x1], [z.top, z.boxTop], zD, t, 0.06), ...knob('handles', [hx, z.top + 0.07, zF], 0.012));
    }
    return parts;
  },
  planDetail: ({ w, d }) => frontPlan(-w / 2 + 0.05, w / 2 - 0.05, d / 2 - 0.035, doorCount(w - 0.1, 0.5, 2, 8)),
});

const handleless = wardrobe({
  id: 'handleless-push-wardrobe',
  name: 'Handleless push-to-open wardrobe',
  w: 2.4,
  d: 0.6,
  wr: [0.9, 4.8],
  dr: [0.5, 0.7],
  tags: ['wardrobe', 'handleless', 'push to open', 'minimal', 'flat slab', 'tủ áo cánh phẳng'],
  description: 'Minimal floor-to-ceiling wardrobe of flat matt slab doors that open with a push: dark 3 mm shadow gaps, a black recessed plinth washed by an LED strip, and a ceiling scribe.',
  slots: [matSlot('fronts', 'Doors', 'laminate-white-matte'), matSlot('carcass', 'End panels & scribe', 'laminate-white-matte'), matSlot('shadow', 'Shadow gaps & plinth', 'paint-soft-black'), matSlot('light', 'Plinth LED', 'light-warm')],
  light: { color: '#ffe2b0', intensity: 0.25, distance: 1.4, y: 0.03, z: 0.25 },
  variants: [
    { id: 'greige', name: 'Greige', materials: { fronts: 'laminate-greige', carcass: 'laminate-greige' } },
    { id: 'black', name: 'Black', materials: { fronts: 'laminate-black', carcass: 'laminate-black' } },
    { id: 'oak', name: 'Oak', materials: { fronts: 'laminate-oak', carcass: 'laminate-oak' } },
    { id: 'sage', name: 'Sage', materials: { fronts: 'laminate-sage', carcass: 'laminate-sage' } },
  ],
  build: (size) => {
    const { w, d, h } = size;
    const z = zones(h, { main: 2.47, plinth: 0.08, scribe: 0.03 });
    const end = 0.022;
    const zF = d / 2 - 0.002;
    const zD = zF - T;
    const parts = shell('carcass', size, z, zF, zD, end, { block: 'shadow', kick: 'shadow' });
    parts.push(span('light', [-w / 2 + end + 0.02, w / 2 - end - 0.02], [0.012, 0.02], [zF - 0.06, zF - 0.052], o));
    const n = doorCount(w - 2 * end, 0.5, 2, 10);
    for (const ax of cellSpans(n, -w / 2 + end, w / 2 - end)) {
      parts.push(slab('fronts', ax, [z.plinth, z.top], zD, T, 0.001));
      if (z.hasBox) parts.push(slab('fronts', ax, [z.top, z.boxTop], zD, T, 0.001));
    }
    return parts;
  },
  planDetail: ({ w, d }) => frontPlan(-w / 2 + 0.022, w / 2 - 0.022, d / 2 - 0.002, doorCount(w - 0.044, 0.5, 2, 10)),
});

const mirrorSlide = slidingOpaque(
  {
    id: 'sliding-mirror-wardrobe',
    name: 'Sliding mirror wardrobe, full height',
    w: 2.0,
    d: 0.65,
    wr: [1.2, 4.0],
    dr: [0.58, 0.72],
    tags: ['wardrobe', 'sliding doors', 'mirror', 'built-in', 'bypass doors', 'tủ áo cửa lùa gương'],
    description: 'Floor-to-ceiling sliding wardrobe with full mirror doors in slim champagne aluminium frames on top and bottom tracks; inside, hanging rails, shelves and drawers. Open model shows one door slid across.',
    slots: [matSlot('carcass', 'Carcass, pelmet & interior', 'laminate-white-matte'), matSlot('mirror', 'Mirror panels', 'glass-mirror'), matSlot('frame', 'Door frames & tracks', 'metal-champagne'), matSlot('rail', 'Hanging rails', 'metal-chrome')],
    variants: [
      { id: 'black', name: 'Black frames', materials: { frame: 'metal-black-matte', rail: 'metal-black-matte' } },
      { id: 'bronze', name: 'Bronze mirror', materials: { mirror: 'bronze-glass', frame: 'metal-bronze', carcass: 'laminate-walnut' } },
      { id: 'silver', name: 'Silver & oak', materials: { frame: 'metal-brushed-steel', carcass: 'laminate-oak' } },
    ],
  },
  { carcass: 'carcass', frame: 'frame', infill: () => ({ slot: 'mirror', kind: 'flat' }), inside: { body: 'carcass', rail: 'rail' }, bays: ['hang', 'shelves', 'double', 'drawers'], seed: 3 },
  ['mirror', 'frame'],
);

const threePanel = slidingOpaque(
  {
    id: 'three-panel-sliding-wardrobe',
    name: 'Three-panel sliding wardrobe, oak and mirror',
    w: 2.7,
    d: 0.65,
    wr: [2.2, 4.0],
    dr: [0.58, 0.72],
    tags: ['wardrobe', 'sliding doors', 'three door', 'oak', 'mirror', 'tủ áo 3 cánh lùa'],
    description: 'Three sliding doors to the ceiling: oak-effect panels split by slim aluminium transoms on the outer doors and a full mirror on the middle one, with a pelmet, floor track and a fitted interior.',
    slots: [matSlot('carcass', 'Carcass, pelmet & interior', 'laminate-white-matte'), matSlot('panel', 'Door panels', 'laminate-oak'), matSlot('mirror', 'Mirror', 'glass-mirror'), matSlot('frame', 'Frames, transoms & rails', 'metal-brushed-steel')],
    variants: [
      { id: 'walnut', name: 'Walnut & bronze', materials: { panel: 'laminate-walnut', frame: 'metal-bronze', mirror: 'bronze-glass' } },
      { id: 'grey', name: 'Grey gloss', materials: { panel: 'laminate-gloss-grey', frame: 'metal-chrome' } },
      { id: 'white', name: 'White & black', materials: { panel: 'laminate-white-matte', frame: 'metal-black-matte' } },
    ],
  },
  {
    carcass: 'carcass',
    frame: 'frame',
    infill: (k, n) => (k === Math.floor(n / 2) ? { slot: 'mirror', kind: 'flat' } : { slot: 'panel', kind: 'transoms' }),
    inside: { body: 'carcass', rail: 'frame' },
    bays: ['long', 'shelves', 'hang', 'drawers', 'double'],
    seed: 5,
  },
  ['panel', 'mirror', 'frame'],
);

const shoji = slidingOpaque(
  {
    id: 'shoji-sliding-wardrobe',
    name: 'Shoji sliding wardrobe',
    w: 2.4,
    d: 0.65,
    wr: [1.2, 4.0],
    dr: [0.58, 0.72],
    tags: ['wardrobe', 'shoji', 'japandi', 'sliding doors', 'washi', 'oshiire', 'tủ áo kiểu Nhật'],
    description: 'Japanese-style sliding wardrobe to the ceiling: light oak frames with a kumiko lattice over translucent washi paper, running on timber tracks under an oak pelmet.',
    slots: [matSlot('carcass', 'Carcass & pelmet', 'wood-oak-light'), matSlot('frame', 'Frames, lattice & tracks', 'wood-oak-natural'), matSlot('paper', 'Paper panels', 'washi-paper'), matSlot('rail', 'Hanging rails', 'wood-walnut')],
    variants: [
      { id: 'walnut', name: 'Walnut', materials: { carcass: 'wood-walnut', frame: 'wood-walnut', rail: 'metal-black-matte' } },
      { id: 'black', name: 'Black lattice', materials: { frame: 'wood-ebony', carcass: 'wood-ash-white' } },
      { id: 'frosted', name: 'Frosted glass', materials: { paper: 'glass-frosted' } },
    ],
  },
  { carcass: 'carcass', frame: 'frame', infill: () => ({ slot: 'paper', kind: 'shoji' }), inside: { body: 'carcass', rail: 'rail' }, bays: ['hang', 'shelves', 'long', 'boxes'], seed: 11 },
  ['frame', 'paper'],
);

const glassSlideCfg: SlideCfg = {
  carcass: 'carcass',
  frame: 'frame',
  infill: () => ({ slot: 'glass', kind: 'flat' }),
  inside: { body: 'carcass', rail: 'frame', light: 'light' },
  bays: ['hang', 'shelves', 'double', 'drawers', 'shoes'],
  seed: 7,
};
const glassSlide = filled(
  wardrobe({
    id: 'smoked-glass-sliding-wardrobe',
    name: 'Smoked-glass sliding wardrobe with lighting',
    w: 2.4,
    d: 0.65,
    wr: [1.2, 4.0],
    dr: [0.58, 0.72],
    tags: ['wardrobe', 'sliding doors', 'glass', 'smoked glass', 'LED', 'tủ áo cửa kính lùa'],
    description: 'Sliding wardrobe of smoked glass in black aluminium frames: a walnut interior lit by LED strips under every shelf, with hanging, folded stacks, drawers and shoes showing through.',
    slots: [matSlot('carcass', 'Carcass & interior', 'laminate-walnut'), matSlot('glass', 'Door glass', 'glass-tinted'), matSlot('frame', 'Frames, tracks & rails', 'metal-black-matte'), matSlot('light', 'LED strips', 'light-warm')],
    light: { color: '#ffdcae', intensity: 0.45, distance: 2.2, y: 1.6, z: 0.05 },
    variants: [
      { id: 'bronze', name: 'Bronze glass', materials: { glass: 'bronze-glass', frame: 'metal-bronze' } },
      { id: 'clear', name: 'Clear & oak', materials: { glass: 'glass-clear', carcass: 'laminate-oak' } },
      { id: 'reeded', name: 'Reeded & white', materials: { glass: 'glass-reeded', carcass: 'laminate-white-matte', frame: 'metal-champagne' } },
    ],
    build: (s) => [...slideBody(s, glassSlideCfg), ...slideTracks(s, glassSlideCfg), ...slideDoors(s, glassSlideCfg, false)],
    planDetail: slidePlan,
  }),
);

const bifold = wardrobe({
  id: 'panelled-bifold-wardrobe',
  name: 'Panelled bi-fold wardrobe',
  w: 1.8,
  d: 0.62,
  wr: [0.9, 3.6],
  dr: [0.55, 0.72],
  tags: ['wardrobe', 'bi-fold', 'folding doors', 'panelled', 'cottage', 'tủ áo cửa xếp'],
  description: 'Full-height wardrobe with pairs of bi-fold leaves, each with two recessed panels, folding on brass hinges with a knob at the fold; panelled top boxes and a cornice at the ceiling.',
  slots: [matSlot('leaves', 'Doors', 'paint-cream'), matSlot('carcass', 'Carcass, kicker & cornice', 'paint-cream'), matSlot('hardware', 'Knobs & hinges', 'metal-brass')],
  variants: [
    { id: 'powder', name: 'Powder blue', materials: { leaves: 'paint-dusty-blue', carcass: 'paint-dusty-blue' } },
    { id: 'olive', name: 'Olive', materials: { leaves: 'paint-olive', carcass: 'paint-olive', hardware: 'metal-bronze' } },
    { id: 'pine', name: 'Pine', materials: { leaves: 'wood-pine', carcass: 'wood-pine', hardware: 'metal-black-matte' } },
    { id: 'white', name: 'White & chrome', materials: { leaves: 'paint-pure-white', carcass: 'paint-pure-white', hardware: 'metal-chrome' } },
  ],
  build: (size) => {
    const { w, d, h } = size;
    const z = zones(h, { scribe: 0.05 });
    const end = 0.04;
    const zF = d / 2 - 0.032;
    const t = 0.022;
    const zD = zF - t;
    const parts = shell('carcass', size, z, zF, zD, end, { cornice: true });
    const m = doorCount(w - 2 * end, 0.9, 1, 4);
    for (const [j, [a, b]] of cellSpans(m, -w / 2 + end, w / 2 - end).entries()) {
      const mid = (a + b) / 2;
      parts.push(...shaker('leaves', [a, mid], [z.plinth, z.top], zD, t, 0.065, 1.0), ...shaker('leaves', [mid, b], [z.plinth, z.top], zD, t, 0.065, 1.0));
      for (const hy of [z.plinth + 0.2, (z.plinth + z.top) / 2, z.top - 0.2]) parts.push(vcyl('hardware', mid, zF - 0.002, hy - 0.035, hy + 0.035, 0.0055, o));
      // The knob sits on the outer leaf next to the fold.
      const kx = j % 2 === 0 ? mid + 0.045 : mid - 0.045;
      parts.push(...knob('hardware', [kx, 1.05, zF], 0.013));
      if (z.hasBox) parts.push(...shaker('leaves', [a, mid], [z.top, z.boxTop], zD, t, 0.055), ...shaker('leaves', [mid, b], [z.top, z.boxTop], zD, t, 0.055));
    }
    return parts;
  },
  planDetail: ({ w, d }) => frontPlan(-w / 2 + 0.04, w / 2 - 0.04, d / 2 - 0.032, 2 * doorCount(w - 0.08, 0.9, 1, 4)),
});

const reeded = wardrobe({
  id: 'reeded-oak-wardrobe',
  name: 'Reeded oak wardrobe with leather pulls',
  w: 2.4,
  d: 0.6,
  wr: [1.0, 4.8],
  dr: [0.5, 0.7],
  tags: ['wardrobe', 'reeded', 'fluted', 'oak', 'japandi', 'leather handles', 'tủ áo gỗ sồi soi rãnh'],
  description: 'Floor-to-ceiling oak wardrobe whose doors carry vertically reeded panels inside a slim flat border, with cognac leather tab pulls, plain oak top boxes, a recessed kicker and a ceiling scribe.',
  slots: [matSlot('fluted', 'Reeded door panels', 'wood-fluted-oak'), matSlot('carcass', 'Door borders, top boxes & carcass', 'wood-oak-natural'), matSlot('handles', 'Leather pulls', 'leather-cognac')],
  variants: [
    { id: 'walnut', name: 'Walnut', materials: { fluted: 'wood-fluted-walnut', carcass: 'wood-walnut', handles: 'leather-black' } },
    { id: 'white', name: 'White fluted', materials: { fluted: 'laminate-fluted-white', carcass: 'laminate-white-matte', handles: 'leather-tan' } },
    { id: 'charcoal', name: 'Charcoal & oak', materials: { carcass: 'laminate-black', handles: 'leather-tan' } },
  ],
  build: (size) => {
    const { w, d, h } = size;
    const z = zones(h, { main: 2.3 });
    const end = 0.025;
    const zF = d / 2 - 0.022;
    const zD = zF - 0.022;
    const parts = shell('carcass', size, z, zF, zD, end);
    const n = doorCount(w - 2 * end, 0.5, 2, 10);
    for (const [i, [x0, x1]] of cellSpans(n, -w / 2 + end, w / 2 - end).entries()) {
      const [a, b, y0, y1] = [x0 + GAP / 2, x1 - GAP / 2, z.plinth + GAP / 2, z.top - GAP / 2];
      const bd = 0.035;
      parts.push(
        span('carcass', [a, a + bd], [y0, y1], [zD, zF], o),
        span('carcass', [b - bd, b], [y0, y1], [zD, zF], o),
        span('carcass', [a + bd, b - bd], [y1 - bd, y1], [zD, zF], o),
        span('carcass', [a + bd, b - bd], [y0, y0 + bd], [zD, zF], o),
        span('fluted', [a + bd, b - bd], [y0 + bd, y1 - bd], [zD, zF - 0.003], o),
      );
      const hx = handleRight(i, n) ? b - 0.018 : a + 0.018;
      parts.push(...pull('leather', 'handles', hx, 1.05, zF));
      if (z.hasBox) parts.push(slab('carcass', [x0, x1], [z.top, z.boxTop], zD, 0.022));
    }
    return parts;
  },
  planDetail: ({ w, d }) => frontPlan(-w / 2 + 0.025, w / 2 - 0.025, d / 2 - 0.022, doorCount(w - 0.05, 0.5, 2, 10)),
});

const cane = filled(
  wardrobe({
    id: 'rattan-cane-wardrobe',
    name: 'Rattan cane-door wardrobe',
    w: 2.0,
    d: 0.6,
    wr: [1.0, 3.2],
    dr: [0.5, 0.7],
    tags: ['wardrobe', 'rattan', 'cane', 'mây đan', 'boho', 'tủ áo cánh mây'],
    description: 'Teak-framed wardrobe to the ceiling with open rattan cane webbing in every door and top box, so the clothes show softly through; brass ring pulls and a cream interior.',
    slots: [matSlot('frame', 'Door frames', 'wood-teak'), matSlot('cane', 'Cane panels', 'cane-open'), matSlot('carcass', 'Carcass & interior', 'paint-cream'), matSlot('handles', 'Ring pulls & rails', 'metal-brass')],
    variants: [
      { id: 'oak', name: 'Light oak', materials: { frame: 'wood-oak-light', carcass: 'wood-ash-white' } },
      { id: 'black', name: 'Black frames', materials: { frame: 'wood-ebony', carcass: 'paint-greige', handles: 'metal-black-matte' } },
      { id: 'sage', name: 'Sage painted', materials: { frame: 'paint-sage', carcass: 'paint-sage' } },
    ],
    build: (s) =>
      showcase(s, {
        frame: 'frame',
        infill: 'cane',
        carcass: 'carcass',
        handles: 'handles',
        inside: { body: 'carcass', rail: 'handles' },
        bays: ['hang', 'shelves', 'long', 'drawers'],
        seed: 13,
        pull: 'ring',
        rail: 0.06,
        mid: 1.0,
      }),
    planDetail: ({ w, d }) => frontPlan(-w / 2 + 0.02, w / 2 - 0.02, d / 2 - 0.035, doorCount(w - 0.04, 0.5, 2, 6)),
  }),
);

const walkIn = filled(
  wardrobe({
    id: 'glass-walk-in-wardrobe-lit',
    name: 'Glass-front walk-in wardrobe with LED lighting',
    w: 2.4,
    d: 0.62,
    wr: [1.2, 3.2],
    dr: [0.55, 0.72],
    tags: ['wardrobe', 'glass doors', 'walk-in', 'boutique', 'LED', 'dressing room', 'tủ áo kính có đèn'],
    description: 'Boutique-style glass-front wardrobe: bronze glass doors in slim black frames with long bar pulls, a walnut interior lit under every shelf, hanging and double hanging, drawers, shoes and boxes in the top section.',
    slots: [matSlot('frame', 'Door frames & pulls', 'metal-black-matte'), matSlot('glass', 'Door glass', 'bronze-glass'), matSlot('carcass', 'Carcass & interior', 'laminate-walnut'), matSlot('light', 'LED strips', 'light-warm')],
    light: { color: '#ffdcae', intensity: 0.55, distance: 2.4, y: 1.9, z: 0.0 },
    variants: [
      { id: 'clear', name: 'Clear & oak', materials: { glass: 'glass-clear', carcass: 'laminate-oak' } },
      { id: 'champagne', name: 'Champagne & white', materials: { frame: 'metal-champagne', glass: 'glass-tinted', carcass: 'laminate-white-matte' } },
      { id: 'gold', name: 'Gold & smoked', materials: { frame: 'metal-gold', glass: 'glass-tinted', carcass: 'laminate-black' } },
    ],
    build: (s) =>
      showcase(s, {
        frame: 'frame',
        infill: 'glass',
        carcass: 'carcass',
        handles: 'frame',
        inside: { body: 'carcass', rail: 'frame', light: 'light' },
        bays: ['hang', 'shelves', 'double', 'drawers', 'long', 'shoes'],
        seed: 17,
        pull: 'long',
        pullLen: 0.7,
        rail: 0.022,
      }),
    planDetail: ({ w, d }) => frontPlan(-w / 2 + 0.02, w / 2 - 0.02, d / 2 - 0.035, doorCount(w - 0.04, 0.5, 2, 6)),
  }),
);

const loft = filled(
  wardrobe({
    id: 'loft-steel-glass-wardrobe',
    name: 'Loft steel and glass wardrobe',
    w: 2.0,
    d: 0.6,
    wr: [1.0, 3.2],
    dr: [0.5, 0.7],
    tags: ['wardrobe', 'loft', 'industrial', 'steel', 'crittall', 'glass', 'tủ áo khung sắt kính'],
    description: 'Industrial floor-to-ceiling wardrobe: black steel doors glazed in a Crittall grid of clear glass, steel side panels and a steel kicker, oak shelves and black steel hanging rails inside.',
    slots: [matSlot('steel', 'Steel frames, sides & rails', 'metal-black-matte'), matSlot('glass', 'Glass', 'glass-clear'), matSlot('carcass', 'Oak interior', 'wood-oak-natural')],
    variants: [
      { id: 'reeded', name: 'Reeded glass', materials: { glass: 'glass-reeded' } },
      { id: 'brass', name: 'Brass & walnut', materials: { steel: 'metal-brass', carcass: 'wood-walnut', glass: 'glass-tinted' } },
      { id: 'gunmetal', name: 'Gunmetal & white', materials: { steel: 'metal-gunmetal', carcass: 'laminate-white-matte' } },
    ],
    build: (s) =>
      showcase(s, {
        frame: 'steel',
        infill: 'glass',
        carcass: 'carcass',
        handles: 'steel',
        sides: 'steel',
        inside: { body: 'carcass', rail: 'steel' },
        bays: ['hang', 'shelves', 'double', 'drawers'],
        seed: 19,
        pull: 'long',
        pullLen: 0.5,
        rail: 0.035,
        t: 0.03,
        bars: 3,
        vbar: true,
        zones: { plinth: 0.06 },
      }),
    planDetail: ({ w, d }) => frontPlan(-w / 2 + 0.02, w / 2 - 0.02, d / 2 - 0.035, doorCount(w - 0.04, 0.5, 2, 6)),
  }),
);

const openSystem = filled(
  wardrobe({
    id: 'open-wardrobe-system',
    name: 'Open floor-to-ceiling wardrobe system',
    w: 2.4,
    d: 0.55,
    wr: [1.2, 4.2],
    dr: [0.4, 0.65],
    tags: ['open wardrobe', 'closet system', 'walk-in', 'hanging rails', 'shelves', 'tủ áo mở'],
    description: 'Doorless oak wardrobe system from floor to ceiling against the wall: oak gables, long and double hanging on black rails, shelves of folded clothes and boxes, a sage drawer unit and shoe shelves.',
    slots: [matSlot('panels', 'Gables & shelves', 'wood-oak-natural'), matSlot('rail', 'Rails & pulls', 'metal-black-matte'), matSlot('drawers', 'Drawer fronts', 'paint-sage')],
    variants: [
      { id: 'walnut', name: 'Walnut & brass', materials: { panels: 'wood-walnut', rail: 'metal-brass', drawers: 'wood-walnut' } },
      { id: 'white', name: 'White & oak', materials: { panels: 'laminate-white-matte', drawers: 'wood-oak-natural', rail: 'metal-chrome' } },
      { id: 'grey', name: 'Grey', materials: { panels: 'laminate-grey', drawers: 'laminate-grey', rail: 'metal-anthracite' } },
    ],
    build: ({ w, d, h }) => {
      const g = 0.025;
      const xi: V2 = [-w / 2 + g, w / 2 - g];
      const n = clamp(Math.round((xi[1] - xi[0]) / 0.6), 2, 7);
      return [
        span('panels', [-w / 2, xi[0]], [0, h], [-d / 2, d / 2]),
        span('panels', [xi[1], w / 2], [0, h], [-d / 2, d / 2]),
        span('panels', xi, [0, 0.08], [-d / 2, d / 2 - 0.04]),
        ...interior({ body: 'panels', rail: 'rail', front: 'drawers', back: false }, xi, [0.08, h], -d / 2, d / 2, cycle<Bay>(['long', 'shelves', 'double', 'drawers', 'hang', 'shoes', 'shelves'], n), 23),
      ];
    },
  }),
);

const corner = wardrobe({
  id: 'l-corner-wardrobe-full-height',
  name: 'L-shaped corner wardrobe, full height',
  w: 2.4,
  d: 1.8,
  wr: [1.5, 3.6],
  dr: [1.2, 3.0],
  tags: ['wardrobe', 'corner wardrobe', 'L-shaped', 'fitted', 'built-in', 'tủ áo góc chữ L'],
  description: 'Fitted wardrobe wrapping a room corner: two runs of greige slab doors with black bar pulls meeting at corner fillers, top boxes along both, a recessed kicker and scribes to the ceiling. Stand it in a corner, back run against the wall.',
  slots: [matSlot('doors', 'Doors', 'laminate-greige'), matSlot('carcass', 'Carcass, fillers & kicker', 'laminate-greige'), matSlot('handles', 'Handles', 'metal-black-matte')],
  variants: [
    { id: 'white', name: 'White & brass', materials: { doors: 'laminate-white-matte', carcass: 'laminate-white-matte', handles: 'metal-brass' } },
    { id: 'oak', name: 'Oak', materials: { doors: 'laminate-oak', carcass: 'laminate-oak' } },
    { id: 'navy', name: 'Navy & brass', materials: { doors: 'laminate-navy', carcass: 'laminate-navy', handles: 'metal-brass' } },
  ],
  build: ({ w, d, h }) => {
    const z = zones(h);
    const dep = 0.6;
    const zb = -d / 2;
    const xl = -w / 2;
    const fz = zb + dep;
    const fx = xl + dep;
    const end = 0.025;
    const fill = 0.06;
    const t = T;
    const k = t + 0.002;
    const parts: Part[] = [
      // Back run block, return block (plan), corner fillers, end panels.
      span('carcass', [xl, w / 2 - end], [z.plinth, z.boxTop], [zb, fz - k]),
      span('carcass', [xl, fx - k], [z.plinth, z.boxTop], [fz - k, d / 2 - end]),
      span('carcass', [fx - k, fx + fill], [z.plinth, z.boxTop], [fz - k, fz], o),
      span('carcass', [fx - k, fx], [z.plinth, z.boxTop], [fz, fz + fill], o),
      span('carcass', [w / 2 - end, w / 2], [0, h], [zb, fz]),
      span('carcass', [xl, fx], [0, h], [d / 2 - end, d / 2]),
      span('carcass', [xl, w / 2 - end], [0, z.plinth], [zb, fz - 0.06], o),
      span('carcass', [xl, fx - 0.06], [0, z.plinth], [fz - 0.06, d / 2 - end], o),
      span('carcass', [xl, w / 2 - end], [z.boxTop, h], [zb, fz - 0.006], o),
      span('carcass', [xl, fx - 0.006], [z.boxTop, h], [fz - 0.006, d / 2 - end], o),
    ];
    // Back run: doors face +z.
    const nb = doorCount(w / 2 - end - fx - fill, 0.5, 1, 6);
    for (const [i, [x0, x1]] of cellSpans(nb, fx + fill, w / 2 - end).entries()) {
      parts.push(slab('doors', [x0, x1], [z.plinth, z.top], fz - t));
      const hx = handleRight(i, nb) ? x1 - 0.04 : x0 + 0.04;
      parts.push(...pull('bar', 'handles', hx, 1.05, fz));
      if (z.hasBox) parts.push(slab('doors', [x0, x1], [z.top, z.boxTop], fz - t));
    }
    // Return: doors face +x.
    const nr = doorCount(d / 2 - end - fz - fill, 0.5, 1, 6);
    for (const [i, [z0, z1]] of cellSpans(nr, fz + fill, d / 2 - end).entries()) {
      const zr: V2 = [z0 + GAP / 2, z1 - GAP / 2];
      parts.push(span('doors', [fx - t, fx], [z.plinth + GAP / 2, z.top - GAP / 2], zr, { bevel: 0.0015, plan: false }));
      const hz = handleRight(i, nr) ? z1 - 0.04 : z0 + 0.04;
      parts.push(...barPullX('handles', fx, 1.05, hz, 0.32));
      if (z.hasBox) parts.push(span('doors', [fx - t, fx], [z.top + GAP / 2, z.boxTop - GAP / 2], zr, { bevel: 0.0015, plan: false }));
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const fz = -d / 2 + 0.6;
    const fx = -w / 2 + 0.6;
    return [line([fx, fz], [w / 2 - 0.025, fz]), line([fx, fz], [fx, d / 2 - 0.025])];
  },
});

const bridgeLightX = (3.4 - 2 * clamp(3.4 * 0.19, 0.45, 0.8)) / 4;
const bridge = wardrobe({
  id: 'over-bed-bridge-wardrobe',
  name: 'Over-bed bridge wardrobe',
  w: 3.4,
  d: 0.6,
  wr: [2.6, 4.8],
  dr: [0.5, 0.7],
  tags: ['wardrobe', 'bridge', 'over bed', 'top boxes', 'headboard', 'tủ áo đầu giường'],
  description: 'Bedroom wall of two full-height wardrobe towers joined by a bridge of shallow cupboards over the bed, with a slatted oak headboard panel and reading lights under the bridge. Push the bed into the gap.',
  slots: [matSlot('doors', 'Doors', 'laminate-greige'), matSlot('carcass', 'Carcass & bridge', 'laminate-greige'), matSlot('panel', 'Headboard panel', 'wood-slats-oak'), matSlot('light', 'Reading light strip', 'light-warm')],
  light: {
    color: '#ffe0b4',
    intensity: 0.5,
    distance: 2.2,
    y: 1.95,
    kind: 'spot',
    angle: 0.85,
    penumbra: 0.6,
    heads: [
      { x: -bridgeLightX, y: 1.95, z: 0.07, dir: [0, -1, 0] },
      { x: bridgeLightX, y: 1.95, z: 0.07, dir: [0, -1, 0] },
    ],
  },
  variants: [
    { id: 'white', name: 'White & walnut', materials: { doors: 'laminate-white-matte', carcass: 'laminate-white-matte', panel: 'wood-slats-walnut' } },
    { id: 'sage', name: 'Sage & oak', materials: { doors: 'laminate-sage', carcass: 'laminate-sage' } },
    { id: 'oak', name: 'Oak & linen', materials: { doors: 'laminate-oak', carcass: 'laminate-oak', panel: 'fabric-linen' } },
  ],
  build: ({ w, d, h }) => {
    const z = zones(h);
    const tw = clamp(w * 0.19, 0.45, 0.8);
    const zb = -d / 2;
    const zF = d / 2 - 0.002;
    const zD = zF - T;
    const bd = Math.min(0.42, d - 0.1);
    const yB = z.boxTop - clamp(h * 0.26, 0.5, 0.8);
    const xi: V2 = [-w / 2 + tw, w / 2 - tw];
    const parts: Part[] = [];
    for (const s of [-1, 1]) {
      const outer = (s * w) / 2;
      const inner = s * (w / 2 - tw);
      const [a, b] = s < 0 ? [outer, inner] : [inner, outer];
      const e = 0.02;
      const ti: V2 = [a + e, b - e];
      parts.push(
        span('carcass', [a, a + e], [0, s < 0 ? h : z.boxTop], [zb, zF]),
        span('carcass', [b - e, b], [0, s < 0 ? z.boxTop : h], [zb, zF]),
        span('carcass', ti, [z.plinth, z.boxTop], [zb, zD - 0.002]),
        span('carcass', ti, [0, z.plinth], [zb, zF - 0.06], o),
        span('carcass', s < 0 ? [a + e, b] : [a, b - e], [z.boxTop, h], [zb, zF - 0.006], o),
      );
      const nt = doorCount(ti[1] - ti[0], 0.45, 1, 2);
      for (const [i, ax] of cellSpans(nt, ti[0], ti[1]).entries()) {
        const edge = nt === 2 ? (i === 0 ? 'right' : 'left') : s < 0 ? 'right' : 'left';
        parts.push(...grooveDoor('doors', ax, [z.plinth, z.top], zD, edge));
        if (z.hasBox) parts.push(...grooveDoor('doors', ax, [z.top, z.boxTop], zD, 'bottom'));
      }
    }
    // The bridge: shallow cupboards over the bed, opened from below by a groove.
    const zbF = zb + bd;
    parts.push(
      span('carcass', xi, [yB, yB + 0.02], [zb, zbF], o),
      span('carcass', xi, [yB + 0.02, z.boxTop], [zb, zbF - T - 0.002], o),
      span('carcass', xi, [z.boxTop, h], [zb, zbF - 0.006], o),
      span('panel', xi, [0, yB], [zb, zb + 0.022], o),
      span('light', [xi[0] + 0.05, xi[1] - 0.05], [yB - 0.008, yB], [zbF - 0.06, zbF - 0.042], o),
    );
    for (const ax of cellSpans(doorCount(xi[1] - xi[0], 0.5, 2, 6), xi[0], xi[1])) parts.push(...grooveDoor('doors', ax, [yB + 0.02, z.boxTop], zbF - T, 'bottom'));
    return parts;
  },
  planDetail: ({ w, d }) => {
    const tw = clamp(w * 0.19, 0.45, 0.8);
    const zf = -d / 2 + Math.min(0.42, d - 0.1);
    return [line([-w / 2, d / 2 - 0.002], [-w / 2 + tw, d / 2 - 0.002]), line([w / 2 - tw, d / 2 - 0.002], [w / 2, d / 2 - 0.002]), line([-w / 2 + tw, zf], [w / 2 - tw, zf])];
  },
});

const drawerBank = wardrobe({
  id: 'walnut-drawer-bank-wardrobe',
  name: 'Walnut wardrobe with drawer bank',
  w: 2.4,
  d: 0.6,
  wr: [1.6, 4.0],
  dr: [0.5, 0.7],
  tags: ['wardrobe', 'drawers', 'walnut', 'mid-century', 'fitted', 'tủ áo có ngăn kéo'],
  description: 'Full-height walnut wardrobe with a centre bank of five drawers with brass cup pulls under a tall door, flanked by hanging sections with long brass bar pulls, and top boxes up to the ceiling.',
  slots: [matSlot('fronts', 'Doors & drawer fronts', 'wood-walnut'), matSlot('carcass', 'Carcass, kicker & scribe', 'wood-walnut'), matSlot('handles', 'Handles', 'metal-brass')],
  variants: [
    { id: 'oak', name: 'Oak & black', materials: { fronts: 'wood-oak-natural', carcass: 'wood-oak-natural', handles: 'metal-black-matte' } },
    { id: 'white', name: 'White & walnut', materials: { fronts: 'paint-pure-white', carcass: 'wood-walnut' } },
    { id: 'green', name: 'Forest green', materials: { fronts: 'paint-forest', carcass: 'paint-forest' } },
  ],
  build: (size) => {
    const { w, d, h } = size;
    const z = zones(h);
    const end = 0.025;
    const zF = d / 2 - 0.035;
    const t = 0.02;
    const zD = zF - t;
    const parts = shell('carcass', size, z, zF, zD, end);
    const cw = clamp(w * 0.3, 0.6, 0.9);
    const sides: V2[] = [[-w / 2 + end, -cw / 2], [cw / 2, w / 2 - end]];
    for (const [s, [a, b]] of sides.entries()) {
      const n = doorCount(b - a, 0.5, 1, 4);
      for (const [i, [x0, x1]] of cellSpans(n, a, b).entries()) {
        // Left-side doors hinge on the left, so pairs meet; a single door opens away from the drawers.
        const right = n === 1 ? s === 0 : handleRight(i, n);
        parts.push(slab('fronts', [x0, x1], [z.plinth, z.top], zD, t), ...pull('long', 'handles', right ? x1 - 0.04 : x0 + 0.04, 1.1, zF, 0.6));
        if (z.hasBox) parts.push(slab('fronts', [x0, x1], [z.top, z.boxTop], zD, t));
      }
    }
    const dt = z.plinth + 5 * 0.2;
    for (const k of range(5)) {
      const y0 = z.plinth + k * 0.2;
      parts.push(slab('fronts', [-cw / 2, cw / 2], [y0, y0 + 0.2], zD, t), span('handles', [-0.05, 0.05], [y0 + 0.13, y0 + 0.16], [zF, zF + 0.018], { bevel: 0.008, plan: false }));
    }
    parts.push(slab('fronts', [-cw / 2, cw / 2], [dt, z.top], zD, t), ...pull('bar', 'handles', 0, dt + 0.25, zF, 0.25));
    if (z.hasBox) parts.push(slab('fronts', [-cw / 2, cw / 2], [z.top, z.boxTop], zD, t));
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w / 2 + 0.025, d / 2 - 0.035], [w / 2 - 0.025, d / 2 - 0.035])],
});

const nicheLightZ = 0.6 / 2 - 0.002 - T - 0.06;
const dressing = wardrobe({
  id: 'dressing-mirror-niche-wardrobe',
  name: 'Wardrobe with lit dressing-mirror niche',
  w: 2.6,
  d: 0.6,
  wr: [1.6, 4.4],
  dr: [0.5, 0.7],
  tags: ['wardrobe', 'dressing mirror', 'full-length mirror', 'LED', 'niche', 'tủ áo có gương soi'],
  description: 'Floor-to-ceiling wardrobe with a recessed oak niche in the middle holding a full-length dressing mirror between two vertical LED strips; handleless greige doors with finger-pull edges either side and top boxes above.',
  slots: [matSlot('doors', 'Doors', 'laminate-greige'), matSlot('carcass', 'Carcass & niche', 'wood-oak-natural'), matSlot('mirror', 'Mirror', 'glass-mirror'), matSlot('light', 'LED strips', 'light-warm')],
  light: { color: '#ffe6c4', intensity: 0.45, distance: 2.0, y: 1.4, z: nicheLightZ },
  variants: [
    { id: 'blush', name: 'Blush & oak', materials: { doors: 'laminate-pink' } },
    { id: 'white', name: 'White & walnut', materials: { doors: 'laminate-white-matte', carcass: 'wood-walnut' } },
    { id: 'black', name: 'Black & bronze', materials: { doors: 'laminate-black', carcass: 'laminate-black', mirror: 'bronze-glass' } },
  ],
  build: (size) => {
    const { w, d, h } = size;
    const z = zones(h);
    const end = 0.022;
    const zF = d / 2 - 0.002;
    const zD = zF - T;
    const zb = -d / 2;
    const cw = clamp(w * 0.24, 0.5, 0.7);
    const zN = zD - 0.12;
    const parts = shell('carcass', size, z, zF, zD, end).filter((_, i) => i !== 2);
    const sides: V2[] = [[-w / 2 + end, -cw / 2 - BT], [cw / 2 + BT, w / 2 - end]];
    for (const [s, [a, b]] of sides.entries()) {
      parts.push(span('carcass', [a, b], [z.plinth, z.boxTop], [zb, zD - 0.002]));
      const n = doorCount(b - a, 0.5, 1, 4);
      for (const [i, ax] of cellSpans(n, a, b).entries()) {
        const right = n === 1 ? s === 0 : handleRight(i, n);
        parts.push(...grooveDoor('doors', ax, [z.plinth, z.top], zD, right ? 'right' : 'left'));
        if (z.hasBox) parts.push(...grooveDoor('doors', ax, [z.top, z.boxTop], zD, 'bottom'));
      }
    }
    // The niche: sides flush with the doors, a back, a floor, the mirror and two LED strips.
    parts.push(
      span('carcass', [-cw / 2 - BT, -cw / 2], [z.plinth, z.top], [zD - 0.002, zF], o),
      span('carcass', [cw / 2, cw / 2 + BT], [z.plinth, z.top], [zD - 0.002, zF], o),
      span('carcass', [-cw / 2, cw / 2], [z.plinth, z.top], [zb, zN]),
      span('carcass', [-cw / 2, cw / 2], [z.plinth - 0.02, z.plinth], [zN, zF - 0.004], o),
      span('mirror', [-cw / 2 + 0.05, cw / 2 - 0.05], [z.plinth + 0.06, z.top - 0.06], [zN, zN + 0.005], o),
      span('light', [-cw / 2, -cw / 2 + 0.008], [z.plinth + 0.06, z.top - 0.06], [zD - 0.07, zD - 0.05], o),
      span('light', [cw / 2 - 0.008, cw / 2], [z.plinth + 0.06, z.top - 0.06], [zD - 0.07, zD - 0.05], o),
    );
    if (z.hasBox) {
      parts.push(span('carcass', [-cw / 2 - BT, cw / 2 + BT], [z.top, z.boxTop], [zb, zD - 0.002], o));
      parts.push(...grooveDoor('doors', [-cw / 2 - BT, cw / 2 + BT], [z.top, z.boxTop], zD, 'bottom'));
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const cw = clamp(w * 0.24, 0.5, 0.7);
    const zF = d / 2 - 0.002;
    const zN = zF - T - 0.12;
    return [line([-w / 2 + 0.022, zF], [-cw / 2, zF]), line([cw / 2, zF], [w / 2 - 0.022, zF]), line([-cw / 2, zN], [cw / 2, zN])];
  },
});

const melamine = wardrobe({
  id: 'melamine-mdf-wardrobe-vn',
  name: 'Melamine MDF wardrobe with aluminium handles',
  w: 2.0,
  d: 0.6,
  wr: [1.2, 3.6],
  dr: [0.5, 0.65],
  tags: ['wardrobe', 'melamine', 'MDF', 'Vietnam', 'tủ áo gỗ MDF phủ melamine', 'tủ quần áo', 'aluminium handle'],
  description: 'The Vietnamese apartment classic: oak-grain melamine MDF doors with long aluminium profile handles, a mirror on the end door, two drawers under the middle doors, top boxes to the ceiling and a white carcass.',
  slots: [matSlot('fronts', 'Doors (melamine)', 'laminate-oak'), matSlot('carcass', 'Carcass & plinth (melamine)', 'laminate-white-matte'), matSlot('handles', 'Aluminium handles', 'metal-brushed-steel'), matSlot('mirror', 'Mirror', 'glass-mirror')],
  variants: [
    { id: 'walnut', name: 'Walnut grain', materials: { fronts: 'laminate-walnut', carcass: 'laminate-walnut', handles: 'metal-black-matte' } },
    { id: 'grey', name: 'Grey & oak', materials: { fronts: 'laminate-grey', carcass: 'laminate-oak' } },
    { id: 'pink', name: 'Pink', materials: { fronts: 'laminate-pink', carcass: 'laminate-white-matte', handles: 'metal-gold' } },
    { id: 'white', name: 'White gloss', materials: { fronts: 'laminate-white-gloss', handles: 'metal-champagne' } },
  ],
  build: (size) => {
    const { w, d, h } = size;
    const z = zones(h, { plinth: 0.08 });
    const end = 0.018;
    const zF = d / 2 - 0.022;
    const t = 0.018;
    const zD = zF - t;
    const parts = shell('carcass', size, z, zF, zD, end);
    const n = doorCount(w - 2 * end, 0.48, 2, 8);
    const dy = z.plinth + 0.4;
    for (const [i, [x0, x1]] of cellSpans(n, -w / 2 + end, w / 2 - end).entries()) {
      const right = handleRight(i, n);
      const hx = right ? x1 - 0.03 : x0 + 0.03;
      // The middle pair stands on two drawers.
      const drawers = n >= 4 && (i === n / 2 - 1 || i === n / 2) && n % 2 === 0;
      const y0 = drawers ? dy : z.plinth;
      parts.push(slab('fronts', [x0, x1], [y0, z.top], zD, t), ...pull('profile', 'handles', hx, Math.min(1.15, (y0 + z.top) / 2), zF, Math.min(1.1, z.top - y0 - 0.4)));
      if (drawers) for (const k of range(2)) parts.push(slab('fronts', [x0, x1], [z.plinth + k * 0.2, z.plinth + (k + 1) * 0.2], zD, t), span('handles', [(x0 + x1) / 2 - 0.08, (x0 + x1) / 2 + 0.08], [z.plinth + k * 0.2 + 0.155, z.plinth + k * 0.2 + 0.17], [zF, zF + 0.016], { bevel: 0.003, plan: false }));
      if (i === n - 1) parts.push(span('mirror', [x0 + 0.06, x1 - 0.06], [y0 + 0.15, z.top - 0.15], [zF, zF + 0.005], o));
      if (z.hasBox) parts.push(slab('fronts', [x0, x1], [z.top, z.boxTop], zD, t), span('handles', [hx - 0.06, hx + 0.06], [z.top + 0.02, z.top + 0.035], [zF, zF + 0.016], { bevel: 0.003, plan: false }));
    }
    return parts;
  },
  planDetail: ({ w, d }) => frontPlan(-w / 2 + 0.018, w / 2 - 0.018, d / 2 - 0.022, doorCount(w - 0.036, 0.48, 2, 8)),
});

// Acrylic wardrobe: decor on the open end shelves is the Styled model.
const DECOR = new WeakSet<Part>();
const D = <P extends Part | Part[]>(p: P): P => {
  for (const x of Array.isArray(p) ? p : [p]) DECOR.add(x);
  return p;
};
const vase = (cx: number, y: number, z: number, h: number): Part =>
  lathe('decor', [cx, y, z], [
    [0, 0],
    [h * 0.22, 0],
    [h * 0.3, h * 0.35],
    [h * 0.2, h * 0.78],
    [h * 0.12, h * 0.92],
    [h * 0.14, h],
    [0, h],
  ], { segments: 16, plan: false });

const acrylic = wardrobe({
  id: 'acrylic-gloss-wardrobe-open-shelves-vn',
  name: 'Acrylic gloss wardrobe with open end shelves',
  w: 2.4,
  d: 0.6,
  wr: [1.6, 4.0],
  dr: [0.5, 0.65],
  tags: ['wardrobe', 'acrylic', 'high gloss', 'Vietnam', 'tủ áo acrylic bóng gương', 'open shelves', 'kệ góc bo tròn'],
  description: 'Popular in Vietnamese apartments: high-gloss white acrylic doors with slim gold pulls, oak-grain top boxes, and a run of open shelves at the end with a rounded front corner for books, vases and a plant.',
  slots: [matSlot('fronts', 'Acrylic doors', 'laminate-white-gloss'), matSlot('carcass', 'Carcass, top boxes & end shelves', 'laminate-oak'), matSlot('handles', 'Handles', 'metal-gold')],
  variants: [
    { id: 'grey', name: 'Grey gloss & walnut', materials: { fronts: 'laminate-gloss-grey', carcass: 'laminate-walnut', handles: 'metal-black-matte' } },
    { id: 'pink', name: 'Pink & white', materials: { fronts: 'laminate-pink', carcass: 'laminate-white-matte' } },
    { id: 'black', name: 'Black gloss & oak', materials: { fronts: 'laminate-black', handles: 'metal-champagne' } },
  ],
  build: (size) => {
    const { w, d, h } = size;
    const z = zones(h, { plinth: 0.08 });
    const end = 0.018;
    const zF = d / 2 - 0.032;
    const zD = zF - T;
    const zb = -d / 2;
    const ew = clamp(w * 0.15, 0.3, 0.42);
    const xs = w / 2 - ew;
    const parts = shell('carcass', { w: w, d, h }, z, zF, zD, end).map((p, i) => (i === 1 ? span('carcass', [xs - BT, xs], [0, h], [zb, zF]) : p));
    // Shell parts 2–4 (block, kicker, scribe) were built for the whole width: trim them to the doors.
    for (const i of [2, 3, 4]) {
      const p = parts[i];
      if (p.shape !== 'box') continue;
      const x0 = p.position[0] - p.size[0] / 2;
      const x1 = xs - BT;
      parts[i] = { ...p, position: [(x0 + x1) / 2, p.position[1], p.position[2]], size: [x1 - x0, p.size[1], p.size[2]] };
    }
    const n = doorCount(xs - BT + w / 2 - end, 0.5, 2, 8);
    for (const [i, [x0, x1]] of cellSpans(n, -w / 2 + end, xs - BT).entries()) {
      const hx = handleRight(i, n) ? x1 - 0.035 : x0 + 0.035;
      parts.push(slab('fronts', [x0, x1], [z.plinth, z.top], zD, T, 0.001), ...barPull('handles', [hx, 1.05, zF], 0.22, { vertical: true, r: 0.004, stand: 0.024 }));
      if (z.hasBox) parts.push(slab('carcass', [x0, x1], [z.top, z.boxTop], zD));
    }
    // Open end shelves with a rounded outer-front corner, from the floor to the ceiling.
    const R = Math.min(ew - 0.02, zF - zb - 0.05);
    const outline: V2[] = [[xs, zb + 0.012], [w / 2, zb + 0.012], ...arcPoints(w / 2 - R, zF - R, R, 0, Math.PI / 2, 10), [xs, zF]];
    parts.push(span('carcass', [xs, w / 2], [0, h], [zb, zb + 0.012]), prism('carcass', outline, 0, z.plinth), prism('carcass', outline, h - 0.03, 0.03, o));
    const ns = clamp(Math.round((h - 0.03 - z.plinth) / 0.38), 4, 8);
    const pitch = (h - 0.03 - z.plinth) / ns;
    const zc = zb + 0.012 + (zF - zb) * 0.42;
    const cx = xs + ew * 0.45;
    for (const k of range(ns)) {
      const y = z.plinth + k * pitch;
      if (k > 0) parts.push(prism('carcass', outline, y - 0.022, 0.022, o));
      const gap = pitch - 0.022 - 0.02;
      const pick = k % 4;
      if (pick === 0) parts.push(D(span('books', [xs + 0.01, xs + Math.min(ew * 0.55, 0.2)], [y, y + Math.min(gap, 0.26)], [zb + 0.02, zb + 0.2], o)), D(vase(cx + ew * 0.2, y, zc, Math.min(gap * 0.6, 0.18))));
      else if (pick === 1) parts.push(...D([cyl('decor', [cx, y + 0.07, zc], 0.07, 0.14, { rTop: 0.085, segments: 18, plan: false }), sphere('plant', [cx, y + 0.21, zc], 0.11, { scale: [1.1, 0.9, 1], plan: false }), sphere('plant', [cx + 0.06, y + 0.27, zc - 0.03], 0.07, o)]));
      else if (pick === 2) parts.push(...D(range(4).map((j) => span('books', [cx - 0.1 + (j % 2) * 0.006, cx + 0.1 - (j % 2) * 0.004], [y + j * 0.03, y + j * 0.03 + 0.028], [zc - 0.07, zc + 0.07], o))), D(sphere('decor', [cx, y + 0.12 + 0.035, zc], 0.035, o)));
      else parts.push(D(vase(cx - 0.04, y, zc, Math.min(gap * 0.75, 0.26))), D(vase(cx + 0.08, y, zc + 0.03, Math.min(gap * 0.45, 0.14))));
    }
    return parts;
  },
  planDetail: ({ w, d }) => frontPlan(-w / 2 + 0.018, w / 2 - clamp(w * 0.15, 0.3, 0.42) - BT, d / 2 - 0.032, doorCount(w - clamp(w * 0.15, 0.3, 0.42) - BT - 0.018, 0.5, 2, 8)),
});
const acrylicStyled: PackItem = {
  ...acrylic,
  build: (s) => acrylic.build(s).filter((p) => !DECOR.has(p)),
  models: [
    { id: 'styled', name: 'Styled', slots: [matSlot('books', 'Books', 'book-mix'), matSlot('decor', 'Vases & pots', 'ceramic-white'), matSlot('plant', 'Plant', 'plant-leaf')], props: (s) => acrylic.build(s).filter((p) => DECOR.has(p)) },
    { id: 'bare', name: 'Bare' },
  ],
};

export default definePack({
  name: 'Full-height wardrobes',
  version: '1.0.0',
  author: 'Neest',
  description: 'Floor-to-ceiling built-in wardrobes that meet a 2.7 m ceiling (resizable from 2.3 to 3.2 m): shaker, handleless, sliding mirror, oak and glass, shoji, bi-fold, reeded oak, rattan cane, lit glass walk-in, open system, L corner, over-bed bridge, drawer bank, dressing-mirror niche, loft steel and glass, and Vietnamese melamine and acrylic wardrobes.',
  license: 'CC0',
  items: [shakerWall, handleless, mirrorSlide, threePanel, glassSlide, shoji, bifold, reeded, cane, walkIn, loft, openSystem, corner, bridge, drawerBank, dressing, melamine, acrylicStyled],
  materials,
  patterns,
});

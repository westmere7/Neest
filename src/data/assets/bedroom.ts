import type { AssetDefinition, Part, PlanStroke, Size3 } from './types';
import {
  barPull,
  bookRow,
  box,
  cells,
  cellSpans,
  circle,
  clamp,
  cushion,
  cyl,
  defineAsset,
  discZ,
  knob,
  lathe,
  line,
  matSlot,
  pillow,
  rectPoly,
  ring,
  rng,
  rod,
  rodPath,
  rodX,
  rodZ,
  roundRectPoints,
  poly,
  shakerFront,
  slats,
  span,
  spaced,
  sphere,
  torus,
  turnedLeg,
  vcyl,
  drapeFolds,
  type BoxOpts,
  type V2,
  type V3,
} from './parts';

// ---------------------------------------------------------------------------
// Shared bed dressing (mattress, duvet with a folded edge, sheet, pillows)
// ---------------------------------------------------------------------------

export interface BedDress {
  /** Mattress extent across the bed (x for head-at-back beds, z for head-at-left beds). */
  across: V2;
  /** Mattress extent along the bed, from the head end to the foot end. */
  along: V2;
  /** Mattress bottom and top heights. */
  y0: number;
  top: number;
  /** Highest point the dressing may reach (usually the asset height). */
  yMax: number;
  /** 'z': head at -z (against the wall); 'x': head at -x (long side against the wall). */
  axis?: 'z' | 'x';
  pillows: number;
  bedding: string;
  duvet: string;
  /** Optional accent slot for a decorative cushion and, with `throwBlanket`, a foot throw. */
  accent?: string;
  throwBlanket?: boolean;
  /** Duvet overhang past the mattress sides and foot. */
  overhang?: number;
}

function dressGeom(o: BedDress) {
  const [a0, a1] = o.across;
  const [l0, l1] = o.along;
  const len = l1 - l0;
  const mw = a1 - a0;
  const n = Math.max(1, Math.round(o.pillows));
  const duvetStart = l0 + clamp(len * 0.27, 0.28, 0.58);
  const foldEnd = duvetStart + clamp(len * 0.13, 0.12, 0.28);
  const pw = n === 1 ? Math.min(0.7, mw - 0.12) : Math.min(0.7, mw / n - 0.06);
  return { a0, a1, l0, l1, len, mw, n, duvetStart, foldEnd, pw, pillowZ: l0 + 0.23, ov: o.overhang ?? 0.02 };
}

/** Dresses a mattress: every bedding-slot count except the pillows is fixed. */
export function dressBed(o: BedDress): Part[] {
  const g = dressGeom(o);
  const ax = o.axis ?? 'z';
  const t = o.top;
  const S = (slot: string, a: V2, y: V2, l: V2, opts?: BoxOpts): Part =>
    ax === 'z' ? span(slot, a, y, l, opts) : span(slot, l, y, a, opts);
  const C = (slot: string, a: V2, y: V2, l: V2, softness: number): Part =>
    ax === 'z'
      ? cushion(slot, a, y, l, { softness, plan: false })
      : cushion(slot, l, y, a, { softness, plan: false });
  const R = (slot: string, p0: number, p1: number, y: number, at: number, r: number): Part =>
    ax === 'z' ? rodX(slot, p0, p1, y, at, r, { plan: false }) : rodZ(slot, at, y, p0, p1, r, { plan: false });

  const drop = Math.min(0.16, (t - o.y0) * 0.9);
  const da0 = g.a0 - g.ov;
  const da1 = g.a1 + g.ov;
  const parts: Part[] = [
    // Mattress with the fitted sheet.
    C(o.bedding, [g.a0, g.a1], [o.y0, t], [g.l0, g.l1], 0.18),
    // Duvet draped over the sides and foot.
    C(o.duvet, [da0, da1], [t - drop, t + 0.045], [g.duvetStart, g.l1 + g.ov], 0.3),
    // Folded-back top edge with its rolled crease.
    C(o.duvet, [da0 + 0.005, da1 - 0.005], [t + 0.045, t + 0.08], [g.duvetStart, g.foldEnd], 0.4),
    R(o.duvet, da0 + 0.01, da1 - 0.01, t + 0.0625, g.foldEnd, 0.0175),
    // Top sheet turned back over the duvet.
    S(o.bedding, [da0 + 0.01, da1 - 0.01], [t + 0.078, t + 0.09], [g.duvetStart - 0.015, (g.duvetStart + g.foldEnd) / 2], {
      bevel: 0.004,
      plan: false,
    }),
  ];
  // Quilting seams across the duvet.
  if (g.l1 - 0.12 > g.foldEnd + 0.15) {
    for (const l of spaced(3, g.foldEnd + 0.15, g.l1 - 0.12)) parts.push(R(o.duvet, da0 + 0.02, da1 - 0.02, t + 0.045, l, 0.005));
  }
  // Pillows: one part each, so wide beds have exactly one more bedding part.
  for (const c of cells(g.n, g.a0, g.a1)) {
    parts.push(
      ax === 'z'
        ? pillow(o.bedding, [c, t + 0.07, g.pillowZ], g.pw, 0.15, 0.42, { lean: 0.18 })
        : pillow(o.bedding, [g.pillowZ, t + 0.075, c], 0.42, 0.15, g.pw),
    );
  }
  if (o.accent) {
    const s = Math.min(0.42, g.mw * 0.45, (o.yMax - t - 0.06) / 0.96);
    if (s >= 0.22) {
      const at = g.l0 + 0.5;
      const mid = (g.a0 + g.a1) / 2;
      parts.push(
        ax === 'z'
          ? pillow(o.accent, [mid, t + 0.04 + s * 0.48, at], s, s, 0.13, { lean: 0.3 })
          : pillow(o.accent, [at, t + 0.04 + s * 0.5, mid], 0.13, s, s),
      );
    }
    if (o.throwBlanket) {
      const tl: V2 = [g.l1 - Math.min(0.55, g.len * 0.27), g.l1 - 0.12];
      parts.push(
        S(o.accent, [da0 - 0.008, da1 + 0.008], [t + 0.045, t + 0.065], tl, { bevel: 0.008, plan: false }),
        S(o.accent, [da0 - 0.012, da0 - 0.002], [t - drop - 0.04, t + 0.06], tl, { bevel: 0.004, plan: false }),
        S(o.accent, [da1 + 0.002, da1 + 0.012], [t - drop - 0.04, t + 0.06], tl, { bevel: 0.004, plan: false }),
      );
    }
  }
  return parts;
}

/** Plan strokes for a dressed bed: pillows, the duvet fold and a turned-down corner. */
export function dressPlan(o: BedDress): PlanStroke[] {
  const g = dressGeom(o);
  const P = (a: number, l: number): V2 => ((o.axis ?? 'z') === 'z' ? [a, l] : [l, a]);
  const da0 = g.a0 - g.ov;
  const da1 = g.a1 + g.ov;
  const strokes: PlanStroke[] = [line(P(da0, g.foldEnd), P(da1, g.foldEnd)), line(P(da0, g.duvetStart), P(da1, g.duvetStart))];
  const c = Math.min(0.35, (da1 - da0) * 0.3, g.l1 - g.foldEnd - 0.05);
  if (c > 0.05) strokes.push(line(P(da1 - c, g.foldEnd), P(da1, g.foldEnd + c)));
  for (const a of cells(g.n, g.a0, g.a1)) {
    const pts = roundRectPoints(0, 0, g.pw, 0.38, 0.06).map(([x, z]) => P(a + x, g.pillowZ + z));
    strokes.push(poly(pts));
  }
  if (o.accent && o.throwBlanket) {
    const l = g.l1 - Math.min(0.55, g.len * 0.27);
    strokes.push(line(P(da0, l), P(da1, l)), line(P(da0, g.l1 - 0.12), P(da1, g.l1 - 0.12)));
  }
  return strokes;
}

// ---------------------------------------------------------------------------
// Beds (shared parametric family)
// ---------------------------------------------------------------------------

function bedFrame({ w, d, h }: Size3) {
  const hbT = 0.08;
  const zHead = -d / 2 + hbT;
  const dress: BedDress = {
    across: [-w / 2 + 0.05, w / 2 - 0.05],
    along: [zHead + 0.01, d / 2 - 0.03],
    y0: 0.3,
    top: 0.54,
    yMax: h,
    pillows: w < 1.2 ? 1 : 2,
    bedding: 'bedding',
    duvet: 'duvet',
    accent: 'headboard',
    throwBlanket: true,
  };
  return { legH: 0.1, frameTop: 0.3, zHead, post: 0.06, dress };
}

function bedParts(size: Size3): Part[] {
  const { w, d, h } = size;
  const g = bedFrame(size);
  const rail = 0.04;
  const parts: Part[] = [
    // Headboard posts, cap and padded backing.
    span('frame', [-w / 2, -w / 2 + g.post], [0, h - 0.035], [-d / 2, g.zHead], { bevel: 0.012 }),
    span('frame', [w / 2 - g.post, w / 2], [0, h - 0.035], [-d / 2, g.zHead], { bevel: 0.012 }),
    span('frame', [-w / 2, w / 2], [h - 0.035, h], [-d / 2, g.zHead + 0.008], { bevel: 0.01, plan: false }),
    span('headboard', [-w / 2 + g.post, w / 2 - g.post], [g.frameTop - 0.08, h - 0.035], [-d / 2 + 0.01, -d / 2 + 0.04], {
      plan: false,
    }),
    // Side and foot rails around a recessed slat deck.
    span('frame', [-w / 2, -w / 2 + rail], [g.legH, g.frameTop], [g.zHead, d / 2], { bevel: 0.01 }),
    span('frame', [w / 2 - rail, w / 2], [g.legH, g.frameTop], [g.zHead, d / 2], { bevel: 0.01 }),
    span('frame', [-w / 2 + rail, w / 2 - rail], [g.legH, g.frameTop], [d / 2 - rail, d / 2], { bevel: 0.01 }),
    span('frame', [-w / 2 + rail, w / 2 - rail], [g.frameTop - 0.04, g.frameTop - 0.02], [g.zHead, d / 2 - rail], { plan: false }),
    turnedLeg('frame', -w / 2 + 0.035, d / 2 - 0.035, 0, g.legH + 0.01, 0.026, { style: 'taper' }),
    turnedLeg('frame', w / 2 - 0.035, d / 2 - 0.035, 0, g.legH + 0.01, 0.026, { style: 'taper' }),
  ];
  // Vertical channel tufting on the headboard.
  const channels = clamp(Math.round((w - 2 * g.post) / 0.2), 3, 11);
  for (const [xa, xb] of cellSpans(channels, -w / 2 + g.post, w / 2 - g.post)) {
    parts.push(
      cushion('headboard', [xa + 0.003, xb - 0.003], [g.frameTop, h - 0.045], [-d / 2 + 0.035, g.zHead], {
        softness: 0.45,
        plan: false,
      }),
    );
  }
  parts.push(...dressBed(g.dress));
  return parts;
}

function bedPlan(size: Size3): PlanStroke[] {
  return dressPlan(bedFrame(size).dress);
}

const BED_SLOTS = [
  matSlot('frame', 'Frame & legs', 'wood-oak-light'),
  matSlot('headboard', 'Headboard & throw', 'fabric-wool-grey'),
  matSlot('bedding', 'Sheets & pillows', 'fabric-white-cotton'),
  matSlot('duvet', 'Duvet', 'fabric-linen'),
];

function bed(
  id: string,
  name: string,
  mattress: string,
  w: number,
  d: number,
  h: number,
  wRange: [number, number],
): AssetDefinition {
  return defineAsset({
    id,
    name,
    category: 'bedroom',
    type: 'beds',
    group: 'Beds',
    tags: ['bed', 'sleep', mattress, 'mattress', 'headboard'],
    defaultSize: { w, d, h },
    minSize: { w: wRange[0], d: 1.9, h: 0.75 },
    maxSize: { w: wRange[1], d: 2.35, h: 1.4 },
    wallSnap: true,
    slots: BED_SLOTS,
    build: bedParts,
    planDetail: bedPlan,
  });
}

const bedSingle = bed('bed-single', 'Single bed', 'single', 0.98, 2.08, 0.95, [0.85, 1.3]);
const bedDouble = bed('bed-double', 'Double bed', 'double', 1.48, 2.08, 1.0, [1.25, 1.7]);
const bedQueen = bed('bed-queen', 'Queen bed', 'queen', 1.68, 2.13, 1.05, [1.5, 1.9]);
const bedKing = bed('bed-king', 'King bed', 'king', 1.88, 2.13, 1.1, [1.7, 2.2]);

// ---------------------------------------------------------------------------
// More beds
// ---------------------------------------------------------------------------

/** Gathered side-valance folds running along Z (drapeFolds only runs along X). */
function foldsZ(slot: string, x: number, y: V2, z: V2, n: number, depth: number): Part[] {
  const k = Math.max(1, Math.round(n));
  const cw = (z[1] - z[0]) / k;
  return cells(k, z[0], z[1]).map((cz) =>
    cyl(slot, [x, (y[0] + y[1]) / 2, cz], cw * 0.55, y[1] - y[0], {
      scale: [depth / (cw * 1.1), 1, 1],
      segments: 12,
      plan: false,
    }),
  );
}

function canopyDress({ w, d, h }: Size3): BedDress {
  return {
    across: [-w / 2 + 0.1, w / 2 - 0.1],
    along: [-d / 2 + 0.11, d / 2 - 0.11],
    y0: 0.38,
    top: 0.62,
    yMax: h - 0.35,
    pillows: w < 1.2 ? 1 : 2,
    bedding: 'bedding',
    duvet: 'duvet',
    accent: 'drapes',
  };
}

const bedCanopy = defineAsset({
  id: 'bed-canopy',
  name: 'Four-poster canopy bed',
  category: 'bedroom',
  type: 'beds',
  group: 'Beds',
  tags: ['bed', 'four poster', 'canopy', 'romantic', 'drapes', 'queen'],
  defaultSize: { w: 1.75, d: 2.25, h: 2.15 },
  minSize: { w: 1.05, d: 2.05, h: 1.95 },
  maxSize: { w: 2.25, d: 2.4, h: 2.45 },
  wallSnap: true,
  slots: [
    matSlot('frame', 'Posts & frame', 'wood-walnut'),
    matSlot('bedding', 'Sheets & pillows', 'fabric-white-cotton'),
    matSlot('duvet', 'Duvet', 'fabric-cream'),
    matSlot('drapes', 'Drapes & cushion', 'fabric-linen'),
  ],
  build: (size) => {
    const { w, d, h } = size;
    const pr = 0.04;
    const px = w / 2 - pr;
    const pz = d / 2 - pr;
    const railY: V2 = [h - 0.12, h - 0.07];
    const parts: Part[] = [];
    for (const [x, z] of [
      [-px, -pz],
      [px, -pz],
      [-px, pz],
      [px, pz],
    ] as V2[]) {
      parts.push(
        span('frame', [x - pr, x + pr], [0, 0.42], [z - pr, z + pr], { bevel: 0.008 }),
        vcyl('frame', x, z, 0.42, h - 0.05, 0.028, { plan: false }),
        lathe('frame', [x, 0.42, z], [
          [0, 0],
          [0.036, 0],
          [0.036, 0.03],
          [0.03, 0.05],
        ], { plan: false }),
        sphere('frame', [x, h - 0.03, z], 0.03, { plan: false }),
      );
    }
    // Canopy frame rails.
    parts.push(
      span('frame', [-px, px], railY, [-pz - 0.02, -pz + 0.02], { plan: false }),
      span('frame', [-px, px], railY, [pz - 0.02, pz + 0.02], { plan: false }),
      span('frame', [-px - 0.02, -px + 0.02], railY, [-pz, pz], { plan: false }),
      span('frame', [px - 0.02, px + 0.02], railY, [-pz, pz], { plan: false }),
    );
    // Bed rails and slat deck.
    parts.push(
      span('frame', [-px + pr, px - pr], [0.18, 0.38], [-pz - 0.02, -pz + 0.02], { plan: false }),
      span('frame', [-px + pr, px - pr], [0.18, 0.38], [pz - 0.02, pz + 0.02], { plan: false }),
      span('frame', [-px - 0.02, -px + 0.02], [0.18, 0.38], [-pz + pr, pz - pr], { plan: false }),
      span('frame', [px - 0.02, px + 0.02], [0.18, 0.38], [-pz + pr, pz - pr], { plan: false }),
    );
    // Panelled headboard and low footboard.
    const hbTop = Math.min(1.35, h * 0.58);
    parts.push(span('frame', [-px + pr, px - pr], [0.38, hbTop], [-pz - 0.015, -pz + 0.01], { plan: false }));
    parts.push(...shakerFront('frame', [-px + pr, px - pr], [0.55, hbTop - 0.04], -pz + 0.01, 0.02, { rail: 0.06 }));
    parts.push(rodX('frame', -px + pr, px - pr, hbTop, -pz, 0.025, { plan: false }));
    parts.push(span('frame', [-px + pr, px - pr], [0.38, 0.62], [pz - 0.015, pz + 0.015], { plan: false }));
    parts.push(rodX('frame', -px + pr, px - pr, 0.62, pz, 0.022, { plan: false }));
    // Fabric canopy, valances and tied-back curtains at each post.
    parts.push(span('drapes', [-px, px], [h - 0.08, h - 0.07], [-pz, pz], { plan: false }));
    const vy: V2 = [h - 0.32, h - 0.075];
    parts.push(...drapeFolds('drapes', [-px + 0.05, px - 0.05], vy, pz + 0.01, Math.round(w / 0.15), 0.035, { plan: false }));
    parts.push(...foldsZ('drapes', -px - 0.01, vy, [-pz + 0.05, pz - 0.05], Math.round(d / 0.17), 0.035));
    parts.push(...foldsZ('drapes', px + 0.01, vy, [-pz + 0.05, pz - 0.05], Math.round(d / 0.17), 0.035));
    const tieY = h * 0.5;
    for (const [x, z] of [
      [-(w / 2 - 0.1), -(d / 2 - 0.1)],
      [w / 2 - 0.1, -(d / 2 - 0.1)],
      [-(w / 2 - 0.1), d / 2 - 0.1],
      [w / 2 - 0.1, d / 2 - 0.1],
    ] as V2[]) {
      parts.push(
        cyl('drapes', [x, (tieY + vy[0]) / 2, z], 0.035, vy[0] - tieY, { rTop: 0.075, segments: 14, plan: false }),
        cyl('drapes', [x, tieY / 2 + 0.01, z], 0.095, tieY - 0.02, { rTop: 0.035, segments: 14, plan: false }),
        ring('drapes', [x, tieY, z], 0.04, 0.012, { plan: false }),
      );
    }
    parts.push(...dressBed(canopyDress(size)));
    return parts;
  },
  planDetail: (size) => {
    const pr = 0.04;
    const px = size.w / 2 - pr;
    const pz = size.d / 2 - pr;
    return [
      ...dressPlan(canopyDress(size)),
      circle([-px, -pz], 0.03),
      circle([px, -pz], 0.03),
      circle([-px, pz], 0.03),
      circle([px, pz], 0.03),
      line([-px, -pz], [px, pz]),
      line([px, -pz], [-px, pz]),
    ];
  },
});

function platformDress({ w, d, h }: Size3): BedDress {
  return {
    across: [-w / 2 + 0.12, w / 2 - 0.12],
    along: [-d / 2 + 0.09, d / 2 - 0.16],
    y0: 0.2,
    top: 0.42,
    yMax: h,
    pillows: w < 1.2 ? 1 : 2,
    bedding: 'bedding',
    duvet: 'duvet',
    accent: 'throw',
    throwBlanket: true,
    overhang: 0.025,
  };
}

const bedPlatform = defineAsset({
  id: 'bed-platform',
  name: 'Low platform bed',
  category: 'bedroom',
  type: 'beds',
  group: 'Beds',
  tags: ['bed', 'platform', 'low', 'japandi', 'floating', 'slatted headboard'],
  defaultSize: { w: 1.8, d: 2.2, h: 0.8 },
  minSize: { w: 1.0, d: 2.0, h: 0.65 },
  maxSize: { w: 2.25, d: 2.4, h: 1.1 },
  wallSnap: true,
  slots: [
    matSlot('frame', 'Platform & headboard', 'wood-oak-natural'),
    matSlot('bedding', 'Sheets & pillows', 'fabric-white-cotton'),
    matSlot('duvet', 'Duvet', 'fabric-olive'),
    matSlot('throw', 'Throw & cushion', 'fabric-mustard'),
  ],
  build: (size) => {
    const { w, d, h } = size;
    const zb = -d / 2 + 0.06;
    const parts: Part[] = [
      // Recessed plinth makes the deck appear to float.
      span('frame', [-w / 2 + 0.1, w / 2 - 0.1], [0, 0.1], [-d / 2 + 0.12, d / 2 - 0.12], { plan: false }),
      span('frame', [-w / 2, w / 2], [0.1, 0.2], [zb, d / 2], { bevel: 0.012 }),
      // Low slatted headboard on a solid back.
      span('frame', [-w / 2, w / 2], [0.1, h - 0.025], [-d / 2, -d / 2 + 0.025], { plan: true }),
      span('frame', [-w / 2, w / 2], [h - 0.025, h], [-d / 2, zb], { bevel: 0.008, plan: false }),
      span('frame', [-w / 2, -w / 2 + 0.035], [0.1, h - 0.025], [-d / 2, zb], { plan: false }),
      span('frame', [w / 2 - 0.035, w / 2], [0.1, h - 0.025], [-d / 2, zb], { plan: false }),
      ...slats('frame', [-w / 2 + 0.035, w / 2 - 0.035], [0.2, h - 0.025], [-d / 2 + 0.025, zb - 0.005], Math.round(w / 0.075), {
        gap: 0.35,
        plan: false,
      }),
    ];
    parts.push(...dressBed(platformDress(size)));
    // A book left on the deck ledge at the foot.
    parts.push(
      box('throw', [w / 2 - 0.3, 0.215, d / 2 - 0.08], [0.2, 0.03, 0.13], { rotation: [0, 0.3, 0], bevel: 0.004, plan: false }),
    );
    return parts;
  },
  planDetail: (size) => [
    ...dressPlan(platformDress(size)),
    rectPoly(-size.w / 2 + 0.1, -size.d / 2 + 0.06, size.w / 2 - 0.1, size.d / 2 - 0.08),
  ],
});

function daybedGeom({ w, d, h }: Size3) {
  const post = 0.05;
  const armH = h - 0.12;
  const seat = 0.46;
  const cushions = clamp(Math.round((w - 0.4) / 0.55), 2, 4);
  const ch = Math.min(0.42, h - 0.5);
  return { post, armH, seat, cushions, ch, x0: -w / 2 + post, x1: w / 2 - post, zb: -d / 2 + 0.04 };
}

const daybedTrundle = defineAsset({
  id: 'daybed-trundle',
  name: 'Daybed with trundle',
  category: 'bedroom',
  type: 'beds',
  group: 'Daybeds & sofa beds',
  tags: ['daybed', 'trundle', 'guest bed', 'spindle', 'sofa bed', 'kids room'],
  defaultSize: { w: 2.02, d: 0.95, h: 0.9 },
  minSize: { w: 1.9, d: 0.85, h: 0.75 },
  maxSize: { w: 2.2, d: 1.1, h: 1.1 },
  wallSnap: true,
  slots: [
    matSlot('frame', 'Frame', 'wood-painted-white'),
    matSlot('mattress', 'Mattress cover', 'fabric-linen'),
    matSlot('cushions', 'Cushions & bolsters', 'fabric-sky'),
    matSlot('metal', 'Knobs', 'metal-brass'),
  ],
  build: (size) => {
    const { w, d, h } = size;
    const g = daybedGeom(size);
    const hp = g.post / 2;
    const parts: Part[] = [];
    // Corner posts: tall at the back, arm height at the front, with ball finials.
    for (const sx of [-1, 1]) {
      const x = sx * (w / 2 - hp);
      parts.push(span('frame', [x - hp, x + hp], [0, h], [-d / 2, -d / 2 + g.post], { bevel: 0.008 }));
      parts.push(span('frame', [x - hp, x + hp], [0, g.armH], [d / 2 - g.post, d / 2], { bevel: 0.008 }));
      parts.push(sphere('frame', [x, g.armH + 0.03, d / 2 - hp], 0.03, { plan: false }));
      // Arm: top rail, lower rail and spindles.
      parts.push(span('frame', [x - 0.02, x + 0.02], [g.armH - 0.05, g.armH], [-d / 2 + g.post, d / 2 - g.post], { plan: false }));
      parts.push(
        ...slats('frame', [x - 0.012, x + 0.012], [0.32, g.armH - 0.05], [-d / 2 + g.post, d / 2 - g.post], Math.round((d - 0.1) / 0.09), {
          axis: 'z',
          gap: 0.6,
          plan: false,
        }),
      );
    }
    // Back: top rail, bottom rail and spindles.
    parts.push(span('frame', [g.x0, g.x1], [h - 0.06, h - 0.01], [-d / 2, -d / 2 + 0.04], { bevel: 0.006, plan: false }));
    parts.push(span('frame', [g.x0, g.x1], [0.24, 0.36], [-d / 2, -d / 2 + 0.04], { plan: false }));
    parts.push(
      ...slats('frame', [g.x0, g.x1], [0.36, h - 0.06], [-d / 2 + 0.01, -d / 2 + 0.03], Math.round((w - 0.1) / 0.09), {
        gap: 0.6,
        plan: false,
      }),
    );
    // Front rail, deck and the trundle drawer below.
    parts.push(span('frame', [g.x0, g.x1], [0.24, 0.32], [d / 2 - 0.04, d / 2], { bevel: 0.006, plan: false }));
    parts.push(span('frame', [g.x0, g.x1], [0.29, 0.32], [-d / 2 + 0.04, d / 2 - 0.04], { plan: false }));
    parts.push(span('frame', [g.x0 + 0.02, g.x1 - 0.02], [0.03, 0.2], [-d / 2 + 0.08, d / 2 - 0.05], { plan: false }));
    parts.push(...shakerFront('frame', [g.x0 + 0.02, g.x1 - 0.02], [0.03, 0.22], d / 2 - 0.05, 0.02, { rail: 0.04 }));
    for (const x of [-w / 4, w / 4]) parts.push(...knob('metal', [x, 0.125, d / 2 - 0.03], 0.012));
    // Mattress, back cushions and bolsters.
    parts.push(cushion('mattress', [g.x0, g.x1], [0.32, g.seat], [-d / 2 + 0.04, d / 2 - 0.04], { softness: 0.25, plan: false }));
    parts.push(rodX('mattress', g.x0 + 0.02, g.x1 - 0.02, g.seat - 0.015, d / 2 - 0.05, 0.007, { plan: false }));
    const pw = Math.min(0.55, (g.x1 - g.x0 - 0.36) / g.cushions - 0.02);
    for (const cx of cells(g.cushions, g.x0 + 0.18, g.x1 - 0.18)) {
      parts.push(pillow('cushions', [cx, g.seat + 0.01 + g.ch / 2, g.zb + 0.1], pw, g.ch, 0.16, { lean: 0.22 }));
    }
    for (const sx of [-1, 1]) {
      const x = sx * (w / 2 - g.post - 0.09);
      parts.push(rodZ('cushions', x, g.seat + 0.08, -d / 2 + 0.1, d / 2 - 0.1, 0.08, { segments: 20, plan: false }));
      parts.push(sphere('metal', [x, g.seat + 0.08, d / 2 - 0.095], 0.012, { plan: false }));
    }
    return parts;
  },
  planDetail: (size) => {
    const g = daybedGeom(size);
    const { w, d } = size;
    const strokes: PlanStroke[] = [
      rectPoly(g.x0, -d / 2 + 0.04, g.x1, d / 2 - 0.04),
      line([-w / 2 + g.post + 0.17, -d / 2 + 0.1], [-w / 2 + g.post + 0.17, d / 2 - 0.1]),
      line([w / 2 - g.post - 0.17, -d / 2 + 0.1], [w / 2 - g.post - 0.17, d / 2 - 0.1]),
    ];
    for (const [a] of cellSpans(g.cushions, g.x0 + 0.18, g.x1 - 0.18).slice(1)) {
      strokes.push(line([a, g.zb + 0.02], [a, g.zb + 0.2]));
    }
    strokes.push(line([g.x0 + 0.18, g.zb + 0.2], [g.x1 - 0.18, g.zb + 0.2]));
    return strokes;
  },
});

// ---------------------------------------------------------------------------
// Case goods
// ---------------------------------------------------------------------------

const bedside = defineAsset({
  id: 'bedside-table',
  name: 'Bedside table',
  category: 'bedroom',
  type: 'surfaces',
  group: 'Nightstands',
  tags: ['nightstand', 'night table', 'bedside', 'drawer'],
  defaultSize: { w: 0.45, d: 0.4, h: 0.5 },
  minSize: { w: 0.3, d: 0.28, h: 0.35 },
  maxSize: { w: 0.7, d: 0.55, h: 0.75 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Body', 'wood-oak-light'),
    matSlot('handle', 'Knob', 'metal-brass'),
    matSlot('decor', 'Books', 'book-mix'),
  ],
  build: ({ w, d, h }) => {
    const legH = Math.min(0.12, h * 0.25);
    const topT = 0.022;
    const t = 0.018;
    const zC = d / 2 - 0.05;
    const zF = zC + 0.018;
    const yTop = h - topT;
    const drawerH = Math.min(0.16, (yTop - legH) * 0.45);
    const shelfTop = yTop - drawerH;
    const xo = w / 2 - 0.012;
    const xi: V2 = [-xo + t, xo - t];
    const zBack = -d / 2 + 0.022;
    const nicheH = shelfTop - t - (legH + t);
    const parts: Part[] = [
      span('body', [-w / 2, w / 2], [yTop, h], [-d / 2, d / 2], { bevel: 0.008 }),
      span('body', [-xo, -xo + t], [legH, yTop], [-d / 2 + 0.01, zF], { plan: false }),
      span('body', [xo - t, xo], [legH, yTop], [-d / 2 + 0.01, zF], { plan: false }),
      span('body', xi, [legH, yTop], [-d / 2 + 0.01, zBack], { plan: false }),
      span('body', xi, [legH, legH + t], [zBack, zF], { plan: false }),
      span('body', xi, [shelfTop - t, shelfTop], [zBack, zF], { plan: false }),
      ...shakerFront('body', [xi[0] + 0.002, xi[1] - 0.002], [shelfTop + 0.002, yTop - 0.002], zC, 0.018, { rail: 0.03 }),
      ...knob('handle', [0, (shelfTop + yTop) / 2, zF], 0.012),
    ];
    for (const x of [-xo + 0.022, xo - 0.022]) {
      for (const z of [-d / 2 + 0.032, zF - 0.022]) {
        parts.push(turnedLeg('body', x, z, 0, legH, 0.017, { style: 'taper' }));
      }
    }
    // Books in the open niche: a standing row and a small flat stack.
    const bookTop = legH + t;
    const xMid = xi[0] + (xi[1] - xi[0]) * 0.6;
    if (nicheH > 0.12) {
      parts.push(...bookRow('decor', [xi[0] + 0.006, xMid], bookTop, zBack + 0.005, Math.min(0.22, nicheH - 0.02), Math.min(0.17, zF - zBack - 0.04), 11, { fill: 0.9 }));
    }
    const sw = Math.min(0.15, xi[1] - xMid - 0.02);
    const sd = Math.min(0.2, zF - zBack - 0.05);
    const sx = (xMid + xi[1]) / 2;
    const sz = (zBack + zF) / 2;
    parts.push(
      span('decor', [sx - sw / 2, sx + sw / 2], [bookTop, bookTop + 0.025], [sz - sd / 2, sz + sd / 2], { plan: false }),
      box('decor', [sx, bookTop + 0.037, sz], [sw * 0.9, 0.022, sd * 0.85], { rotation: [0, 0.15, 0], plan: false }),
    );
    return parts;
  },
  planDetail: ({ w, d }) => [
    rectPoly(-w / 2 + 0.015, -d / 2 + 0.015, w / 2 - 0.015, d / 2 - 0.015),
    circle([0, d / 2 - 0.02], 0.012),
  ],
});

function wardrobeDoors(w: number): number {
  return clamp(Math.round(w / 0.5), 1, 4);
}

const wardrobe = defineAsset({
  id: 'wardrobe',
  name: 'Wardrobe (2-door)',
  category: 'bedroom',
  type: 'storage',
  group: 'Wardrobes',
  tags: ['closet', 'armoire', 'wardrobe', 'cupboard', 'clothes'],
  defaultSize: { w: 1.0, d: 0.6, h: 2.1 },
  minSize: { w: 0.6, d: 0.45, h: 1.6 },
  maxSize: { w: 2.0, d: 0.7, h: 2.6 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Body & doors', 'laminate-white-matte'),
    matSlot('handle', 'Handles', 'metal-black-matte'),
  ],
  build: ({ w, d, h }) => {
    const plinth = 0.08;
    const corn = 0.05;
    const zC = d / 2 - 0.058;
    const zF = zC + 0.02;
    const xs = w / 2 - 0.03;
    const top = h - corn;
    const hy = Math.min(1.05, h * 0.5);
    const parts: Part[] = [
      span('body', [-w / 2 + 0.01, w / 2 - 0.01], [plinth, top], [-d / 2, zC]),
      span('body', [-w / 2 + 0.01, -xs], [plinth, top], [zC, zF], { plan: false }),
      span('body', [xs, w / 2 - 0.01], [plinth, top], [zC, zF], { plan: false }),
      span('body', [-w / 2 + 0.03, w / 2 - 0.03], [0, plinth], [-d / 2 + 0.02, zC - 0.03], { plan: false }),
      span('body', [-w / 2 + 0.01, w / 2 - 0.01], [plinth - 0.012, plinth], [-d / 2, zF], { plan: false }),
      // Stepped cornice.
      span('body', [-w / 2, w / 2], [top, top + 0.018], [-d / 2, d / 2 - 0.02], { bevel: 0.005 }),
      span('body', [-w / 2 + 0.008, w / 2 - 0.008], [top + 0.018, h], [-d / 2, d / 2 - 0.03], { bevel: 0.008, plan: false }),
    ];
    const n = wardrobeDoors(w);
    const ym = plinth + (top - plinth) * 0.64;
    for (const [i, [xa, xb]] of cellSpans(n, -xs, xs).entries()) {
      const rail = Math.min(0.07, (xb - xa) * 0.18);
      parts.push(...shakerFront('body', [xa, xb], [plinth + 0.002, top - 0.002], zC, 0.02, { rail }));
      parts.push(span('body', [xa + rail, xb - rail], [ym - 0.035, ym + 0.035], [zC, zF], { plan: false }));
      // Pulls sit on the meeting stiles of each pair (a lone last door opens from its left edge).
      const pairLeft = i % 2 === 0 && i + 1 < n;
      const px = pairLeft ? xb - 0.04 : xa + 0.04;
      parts.push(...barPull('handle', [px, hy, zF], Math.min(0.3, h * 0.14), { vertical: true, stand: 0.026 }));
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const zDoor = d / 2 - 0.038;
    const zRail = (-d / 2 + zDoor) / 2;
    const reach = Math.min(0.2, (zDoor + d / 2) / 2 - 0.04);
    const strokes: PlanStroke[] = [
      line([-w / 2, zDoor], [w / 2, zDoor]),
      line([-w / 2 + 0.04, zRail], [w / 2 - 0.04, zRail]),
    ];
    for (const [a] of cellSpans(wardrobeDoors(w), -w / 2 + 0.03, w / 2 - 0.03).slice(1)) {
      strokes.push(line([a, zDoor], [a, d / 2 - 0.02]));
    }
    const n = clamp(Math.round(w / 0.15), 3, 12);
    for (const x of spaced(n, -w / 2 + 0.12, w / 2 - 0.12)) {
      strokes.push(line([x - 0.03, zRail - reach], [x + 0.03, zRail + reach]));
    }
    return strokes;
  },
});

const dresser = defineAsset({
  id: 'dresser',
  name: 'Chest of drawers',
  category: 'bedroom',
  type: 'storage',
  group: 'Dressers & chests',
  tags: ['dresser', 'chest', 'drawers', 'commode', 'storage'],
  defaultSize: { w: 1.0, d: 0.48, h: 0.85 },
  minSize: { w: 0.5, d: 0.35, h: 0.5 },
  maxSize: { w: 2.0, d: 0.6, h: 1.4 },
  wallSnap: true,
  slots: [matSlot('body', 'Body', 'wood-ash-white'), matSlot('handle', 'Handles', 'metal-brass')],
  build: ({ w, d, h }) => {
    const legH = 0.1;
    const topT = 0.025;
    const zC = d / 2 - 0.052;
    const zF = zC + 0.018;
    const xs = w / 2 - 0.03;
    const cols = w >= 0.9 ? 2 : 1;
    const rows = clamp(Math.round((h - legH - topT) / 0.22), 2, 6);
    const parts: Part[] = [
      span('body', [-w / 2, w / 2], [h - topT, h], [-d / 2, d / 2], { bevel: 0.006 }),
      span('body', [-w / 2 + 0.012, w / 2 - 0.012], [legH, h - topT], [-d / 2 + 0.005, zC], { plan: false }),
      span('body', [-w / 2 + 0.012, -xs], [legH, h - topT], [zC, zF], { plan: false }),
      span('body', [xs, w / 2 - 0.012], [legH, h - topT], [zC, zF], { plan: false }),
      span('body', [-xs, xs], [legH, legH + 0.03], [zC, zF], { plan: false }),
      // Shaped apron under the carcass.
      span('body', [-w / 2 + 0.06, w / 2 - 0.06], [legH - 0.03, legH], [zC - 0.01, zF - 0.004], { bevel: 0.006, plan: false }),
    ];
    for (const x of [-w / 2 + 0.04, w / 2 - 0.04]) {
      for (const z of [-d / 2 + 0.05, zF - 0.03]) {
        parts.push(turnedLeg('body', x, z, 0, legH, 0.024, { style: 'taper' }));
      }
    }
    for (const x of cellSpans(cols, -xs, xs)) {
      for (const y of cellSpans(rows, legH + 0.03, h - topT - 0.004)) {
        const rail = Math.min(0.04, (y[1] - y[0]) * 0.22);
        parts.push(...shakerFront('body', x, y, zC, 0.018, { rail }));
        const len = Math.min(0.16, (x[1] - x[0]) * 0.35);
        parts.push(...barPull('handle', [(x[0] + x[1]) / 2, (y[0] + y[1]) / 2, zF], len, { r: 0.005, stand: 0.022 }));
      }
    }
    return parts;
  },
  planDetail: ({ w, d }) => [rectPoly(-w / 2 + 0.015, -d / 2 + 0.015, w / 2 - 0.015, d / 2 - 0.015)],
});

const mirrorFloor = defineAsset({
  id: 'mirror-floor',
  name: 'Leaning floor mirror',
  category: 'bedroom',
  type: 'decor',
  group: 'Mirrors',
  tags: ['mirror', 'full length', 'leaning', 'dressing'],
  defaultSize: { w: 0.6, d: 0.32, h: 1.7 },
  minSize: { w: 0.35, d: 0.15, h: 1.0 },
  maxSize: { w: 1.2, d: 0.5, h: 2.2 },
  wallSnap: true,
  slots: [matSlot('frame', 'Frame', 'wood-oak-light'), matSlot('glass', 'Mirror', 'glass-mirror')],
  build: ({ w, d, h }) => {
    const t = 0.03;
    // Lean angle chosen so the tilted panel exactly fills the footprint depth.
    const th = Math.atan2(Math.max(0.005, d - t - 0.01), h);
    const L = (h - t * Math.sin(th)) / Math.cos(th);
    const ez = L * Math.sin(th) + t * Math.cos(th);
    const cy = h / 2;
    const cz = -d / 2 + ez / 2;
    const rotation: V3 = [-th, 0, 0];
    // Box in panel space: u across, v up the panel, n out of the mirror face.
    const B = (slot: string, u: V2, v: V2, n: V2, plan = false, bevel = 0): Part => {
      const um = (u[0] + u[1]) / 2;
      const vm = (v[0] + v[1]) / 2;
      const nm = (n[0] + n[1]) / 2;
      return box(
        slot,
        [um, cy + vm * Math.cos(th) + nm * Math.sin(th), cz - vm * Math.sin(th) + nm * Math.cos(th)],
        [u[1] - u[0], v[1] - v[0], n[1] - n[0]],
        { rotation, plan, bevel },
      );
    };
    const fw = clamp(w * 0.09, 0.04, 0.07);
    const u0 = -w / 2;
    const u1 = w / 2;
    const v0 = -L / 2;
    const v1 = L / 2;
    const full: V2 = [-t / 2, t / 2];
    const bead: V2 = [t / 2 - 0.014, t / 2 + 0.003];
    const b = 0.012;
    return [
      B('frame', [u0, u0 + fw], [v0, v1], full, true, 0.008),
      B('frame', [u1 - fw, u1], [v0, v1], full, true, 0.008),
      B('frame', [u0 + fw, u1 - fw], [v1 - fw, v1], full, false, 0.008),
      B('frame', [u0 + fw, u1 - fw], [v0, v0 + fw], full, false, 0.008),
      B('frame', [u0 + fw - 0.01, u1 - fw + 0.01], [v0 + fw - 0.01, v1 - fw + 0.01], [-t / 2, -t / 2 + 0.008]),
      B('glass', [u0 + fw, u1 - fw], [v0 + fw, v1 - fw], [t / 2 - 0.014, t / 2 - 0.008]),
      // Inner bead moulding.
      B('frame', [u0 + fw, u0 + fw + b], [v0 + fw, v1 - fw], bead),
      B('frame', [u1 - fw - b, u1 - fw], [v0 + fw, v1 - fw], bead),
      B('frame', [u0 + fw + b, u1 - fw - b], [v1 - fw - b, v1 - fw], bead),
      B('frame', [u0 + fw + b, u1 - fw - b], [v0 + fw, v0 + fw + b], bead),
    ];
  },
  planDetail: ({ w, d }) => [line([-w / 2 + 0.04, d / 2 - 0.03], [w / 2 - 0.04, d / 2 - 0.03])],
});

// ---------------------------------------------------------------------------
// New storage and furniture
// ---------------------------------------------------------------------------

const armoire = defineAsset({
  id: 'armoire',
  name: 'Armoire',
  category: 'bedroom',
  type: 'storage',
  group: 'Wardrobes',
  tags: ['armoire', 'wardrobe', 'antique', 'french', 'cupboard', 'clothes'],
  defaultSize: { w: 1.1, d: 0.6, h: 2.0 },
  minSize: { w: 0.8, d: 0.45, h: 1.6 },
  maxSize: { w: 1.6, d: 0.7, h: 2.4 },
  wallSnap: true,
  slots: [matSlot('body', 'Body', 'wood-cherry'), matSlot('handle', 'Knobs & escutcheons', 'metal-brass')],
  build: ({ w, d, h }) => {
    const zC = d / 2 - 0.06;
    const zF = zC + 0.022;
    const base = 0.16;
    const crownY = h - 0.12;
    const xs = w / 2 - 0.07;
    const dh = clamp((crownY - base) * 0.11, 0.14, 0.2);
    const doorY: V2 = [base + dh + 0.008, crownY - 0.006];
    const parts: Part[] = [
      span('body', [-w / 2 + 0.01, w / 2 - 0.01], [0.1, base], [-d / 2 + 0.01, d / 2 - 0.01], { bevel: 0.012 }),
      span('body', [-w / 2 + 0.03, w / 2 - 0.03], [base, crownY], [-d / 2 + 0.02, zC], { plan: false }),
      span('body', [-w / 2 + 0.025, -xs], [base, crownY], [zC, zF], { bevel: 0.004, plan: false }),
      span('body', [xs, w / 2 - 0.025], [base, crownY], [zC, zF], { bevel: 0.004, plan: false }),
      span('body', [-xs, xs], [base + dh, base + dh + 0.008], [zC, zF], { plan: false }),
      // Stepped crown moulding.
      span('body', [-w / 2 + 0.02, w / 2 - 0.02], [crownY, crownY + 0.03], [-d / 2 + 0.02, d / 2 - 0.03], { plan: false }),
      span('body', [-w / 2 + 0.005, w / 2 - 0.005], [crownY + 0.03, h - 0.04], [-d / 2 + 0.01, d / 2 - 0.012], { bevel: 0.015, plan: false }),
      span('body', [-w / 2, w / 2], [h - 0.04, h], [-d / 2, d / 2], { bevel: 0.008 }),
    ];
    for (const x of [-w / 2 + 0.06, w / 2 - 0.06]) {
      for (const z of [-d / 2 + 0.06, d / 2 - 0.06]) parts.push(turnedLeg('body', x, z, 0, 0.1, 0.04, { style: 'bun' }));
    }
    // Two drawers under the doors.
    for (const [xa, xb] of cellSpans(2, -xs, xs)) {
      parts.push(...shakerFront('body', [xa, xb], [base, base + dh], zC, 0.022, { rail: 0.035 }));
      parts.push(...knob('handle', [(xa + xb) / 2, base + dh / 2, zF], 0.015));
    }
    // Two tall doors, each with a mid rail, raised fields, a knob and a keyhole plate.
    const midY = doorY[0] + (doorY[1] - doorY[0]) * 0.32;
    const rail = 0.07;
    const hy = Math.min(1.1, doorY[0] + (doorY[1] - doorY[0]) * 0.45);
    for (const [i, [xa, xb]] of cellSpans(2, -xs, xs).entries()) {
      parts.push(...shakerFront('body', [xa, xb], doorY, zC, 0.022, { rail, recess: 0.008 }));
      parts.push(span('body', [xa + rail, xb - rail], [midY - 0.035, midY + 0.035], [zC, zF], { plan: false }));
      parts.push(span('body', [xa + rail + 0.025, xb - rail - 0.025], [midY + 0.06, doorY[1] - rail - 0.025], [zC, zF - 0.003], { bevel: 0.006, plan: false }));
      parts.push(span('body', [xa + rail + 0.025, xb - rail - 0.025], [doorY[0] + rail + 0.025, midY - 0.06], [zC, zF - 0.003], { bevel: 0.006, plan: false }));
      const kx = i === 0 ? xb - 0.04 : xa + 0.04;
      parts.push(...knob('handle', [kx, hy, zF], 0.016));
      parts.push(span('handle', [kx - 0.012, kx + 0.012], [hy - 0.075, hy - 0.035], [zF, zF + 0.003], { bevel: 0.001, plan: false }));
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const zF = d / 2 - 0.038;
    return [line([-w / 2 + 0.03, zF], [w / 2 - 0.03, zF]), line([0, zF], [0, d / 2 - 0.01])];
  },
});

function vanityMirror({ w, h }: Size3) {
  const topY = 0.76;
  const R = Math.max(0.08, Math.min(0.32, (h - topY - 0.1 - 0.016) / 2, w / 2 - 0.12));
  return { topY, R, cy: topY + 0.08 + R };
}

const vanity = defineAsset({
  id: 'vanity-dressing-table',
  name: 'Dressing table with mirror',
  category: 'bedroom',
  type: 'surfaces',
  group: 'Vanity & dressing tables',
  tags: ['vanity', 'dressing table', 'makeup', 'mirror', 'console'],
  defaultSize: { w: 1.0, d: 0.45, h: 1.45 },
  minSize: { w: 0.75, d: 0.38, h: 1.2 },
  maxSize: { w: 1.5, d: 0.6, h: 1.8 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Table', 'wood-painted-white'),
    matSlot('metal', 'Mirror frame & knobs', 'metal-brass'),
    matSlot('mirror', 'Mirror', 'glass-mirror'),
    matSlot('decor', 'Accessories', 'ceramic-sage'),
  ],
  build: (size) => {
    const { w, d } = size;
    const m = vanityMirror(size);
    const topT = 0.025;
    const yA = m.topY - topT;
    const zC = d / 2 - 0.06;
    const zF = zC + 0.016;
    const zm = -d / 2 + 0.07;
    const parts: Part[] = [
      span('body', [-w / 2, w / 2], [yA, m.topY], [-d / 2, d / 2], { bevel: 0.006 }),
      span('body', [-w / 2 + 0.04, w / 2 - 0.04], [yA - 0.13, yA], [-d / 2 + 0.04, zC], { plan: false }),
    ];
    for (const x of [-w / 2 + 0.05, w / 2 - 0.05]) {
      for (const z of [-d / 2 + 0.05, d / 2 - 0.07]) parts.push(turnedLeg('body', x, z, 0, yA, 0.022, { style: 'taper' }));
    }
    for (const [xa, xb] of cellSpans(3, -w / 2 + 0.07, w / 2 - 0.07)) {
      parts.push(...shakerFront('body', [xa, xb], [yA - 0.125, yA - 0.005], zC, 0.016, { rail: 0.025 }));
      parts.push(...knob('metal', [(xa + xb) / 2, yA - 0.065, zF], 0.011));
    }
    // Round tilting mirror on a stand.
    const sx = m.R + 0.04;
    parts.push(
      span('body', [-sx - 0.03, sx + 0.03], [m.topY, m.topY + 0.025], [zm - 0.05, zm + 0.05], { bevel: 0.008, plan: false }),
      vcyl('metal', -sx, zm, m.topY + 0.025, m.cy, 0.01, { plan: false }),
      vcyl('metal', sx, zm, m.topY + 0.025, m.cy, 0.01, { plan: false }),
      sphere('metal', [-sx, m.cy, zm], 0.016, { plan: false }),
      sphere('metal', [sx, m.cy, zm], 0.016, { plan: false }),
      rodX('metal', -sx, sx, m.cy, zm, 0.005, { plan: false }),
      torus('metal', [0, m.cy, zm], m.R, 0.015, { plan: false }),
      discZ('body', [0, m.cy, zm - 0.01], m.R, 0.01, { plan: false }),
      discZ('mirror', [0, m.cy, zm + 0.003], m.R - 0.006, 0.006, { plan: false }),
    );
    // Perfume bottles, a jewellery box and a ring dish.
    const bz = d / 2 - 0.15;
    const bottle = (x: number, s: number): Part[] => [
      lathe('decor', [x, m.topY, bz], [
        [0, 0],
        [0.025 * s, 0],
        [0.028 * s, 0.06 * s],
        [0.01 * s, 0.075 * s],
        [0.01 * s, 0.085 * s],
        [0, 0.085 * s],
      ], { plan: false }),
      sphere('metal', [x, m.topY + 0.092 * s, bz], 0.012 * s, { plan: false }),
    ];
    parts.push(...bottle(w / 2 - 0.12, 1), ...bottle(w / 2 - 0.19, 0.8));
    const jx: V2 = [-w / 2 + 0.07, -w / 2 + 0.21];
    parts.push(
      span('decor', jx, [m.topY, m.topY + 0.05], [bz - 0.05, bz + 0.05], { bevel: 0.005, plan: false }),
      span('decor', [jx[0] - 0.004, jx[1] + 0.004], [m.topY + 0.05, m.topY + 0.068], [bz - 0.054, bz + 0.054], { bevel: 0.005, plan: false }),
      sphere('metal', [(jx[0] + jx[1]) / 2, m.topY + 0.072, bz], 0.008, { plan: false }),
      cyl('decor', [w / 2 - 0.3, m.topY + 0.008, bz + 0.03], 0.045, 0.016, { rTop: 0.05, plan: false }),
    );
    return parts;
  },
  planDetail: (size) => {
    const { w, d } = size;
    const m = vanityMirror(size);
    const zm = -d / 2 + 0.07;
    return [
      line([-m.R, zm], [m.R, zm]),
      line([-w / 2 + 0.04, d / 2 - 0.044], [w / 2 - 0.04, d / 2 - 0.044]),
      circle([w / 2 - 0.12, d / 2 - 0.15], 0.028),
    ];
  },
});

const blanketChest = defineAsset({
  id: 'blanket-chest',
  name: 'Blanket chest',
  category: 'bedroom',
  type: 'storage',
  group: 'Dressers & chests',
  tags: ['blanket box', 'trunk', 'chest', 'ottoman', 'end of bed', 'storage'],
  defaultSize: { w: 1.0, d: 0.45, h: 0.52 },
  minSize: { w: 0.6, d: 0.35, h: 0.38 },
  maxSize: { w: 1.6, d: 0.6, h: 0.7 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Chest', 'wood-teak'),
    matSlot('metal', 'Fittings', 'metal-black-matte'),
    matSlot('throw', 'Folded throw', 'fabric-mustard'),
  ],
  build: ({ w, d, h }) => {
    const yL = h - 0.05;
    const zP = d / 2 - 0.04;
    const parts: Part[] = [
      span('body', [-w / 2 + 0.005, w / 2 - 0.005], [0.07, 0.11], [-d / 2 + 0.005, d / 2 - 0.005], { bevel: 0.008 }),
      span('body', [-w / 2 + 0.02, w / 2 - 0.02], [0.11, yL - 0.04], [-d / 2 + 0.02, zP], { plan: false }),
      span('body', [-w / 2, w / 2], [yL - 0.04, yL], [-d / 2, d / 2], { bevel: 0.01 }),
    ];
    for (const x of [-w / 2 + 0.05, w / 2 - 0.05]) {
      for (const z of [-d / 2 + 0.05, d / 2 - 0.05]) parts.push(turnedLeg('body', x, z, 0, 0.07, 0.034, { style: 'bun' }));
    }
    const n = clamp(Math.round((w - 0.06) / 0.32), 2, 5);
    for (const x of cellSpans(n, -w / 2 + 0.02, w / 2 - 0.02)) {
      parts.push(...shakerFront('body', x, [0.11, yL - 0.04], zP, 0.02, { rail: 0.045, recess: 0.008, gap: 0 }));
    }
    // Corner brackets, lock plate and ring handles on the ends.
    const zM = zP + 0.02;
    for (const sx of [-1, 1]) {
      const x0 = sx * (w / 2 - 0.02);
      const x1 = sx * (w / 2 - 0.075);
      parts.push(span('metal', [Math.min(x0, x1), Math.max(x0, x1)], [yL - 0.1, yL - 0.045], [zM, zM + 0.004], { plan: false }));
      parts.push(span('metal', [Math.min(x0, x1), Math.max(x0, x1)], [0.115, 0.165], [zM, zM + 0.004], { plan: false }));
      parts.push(torus('metal', [sx * (w / 2 - 0.006), yL - 0.13, 0], 0.035, 0.006, { rotation: [0, Math.PI / 2, 0], plan: false }));
      parts.push(span('metal', [sx * (w / 2 - 0.004) - 0.002, sx * (w / 2 - 0.004) + 0.002], [yL - 0.12, yL - 0.07], [-0.03, 0.03], { plan: false }));
    }
    parts.push(span('metal', [-0.035, 0.035], [yL - 0.13, yL - 0.045], [zM, zM + 0.005], { bevel: 0.002, plan: false }));
    parts.push(sphere('body', [0, yL - 0.1, zM + 0.005], 0.007, { plan: false }));
    // Folded throw lying on one end of the lid and hanging over the front.
    const tx: V2 = [w * 0.08, w / 2 - 0.07];
    parts.push(
      cushion('throw', tx, [yL - 0.002, yL + 0.028], [-d / 2 + 0.04, d / 2 - 0.005], { softness: 0.4, plan: false }),
      cushion('throw', [tx[0] + 0.01, tx[1] - 0.01], [yL + 0.024, h], [-d / 2 + 0.05, d / 2 - 0.02], { softness: 0.4, plan: false }),
      cushion('throw', tx, [yL - 0.17, yL + 0.02], [d / 2 - 0.004, d / 2 + 0.012], { softness: 0.45, plan: false }),
    );
    return parts;
  },
  planDetail: ({ w, d }) => [
    rectPoly(-w / 2 + 0.02, -d / 2 + 0.02, w / 2 - 0.02, d / 2 - 0.02),
    rectPoly(w * 0.08, -d / 2 + 0.04, w / 2 - 0.07, d / 2 - 0.005),
  ],
});

function valetGeom({ w, h }: Size3) {
  const hw = Math.min(0.22, w / 2 - 0.03);
  const yS = h - 0.08;
  const barY = 0.42 + (h - 1.0) * 0.3;
  const jl = yS - 0.02 - (barY + 0.06);
  return { hw, yS, barY, jl, jw: 2 * hw - 0.02 };
}

const valetStand = defineAsset({
  id: 'valet-stand',
  name: 'Clothes valet stand',
  category: 'bedroom',
  type: 'storage',
  group: 'Wardrobes',
  tags: ['valet', 'suit stand', 'clothes stand', 'jacket hanger', 'dressing'],
  defaultSize: { w: 0.5, d: 0.4, h: 1.15 },
  minSize: { w: 0.42, d: 0.32, h: 1.0 },
  maxSize: { w: 0.6, d: 0.5, h: 1.3 },
  slots: [
    matSlot('wood', 'Wood', 'wood-walnut'),
    matSlot('metal', 'Metal & buttons', 'metal-brass'),
    matSlot('jacket', 'Jacket & shoes', 'fabric-navy'),
    matSlot('trousers', 'Trousers', 'fabric-wool-grey'),
  ],
  build: (size) => {
    const { w, d, h } = size;
    const g = valetGeom(size);
    const fx = w / 2 - 0.05;
    const parts: Part[] = [
      span('wood', [-fx - 0.02, -fx + 0.02], [0, 0.03], [-d / 2 + 0.01, d / 2 - 0.01], { bevel: 0.008 }),
      span('wood', [fx - 0.02, fx + 0.02], [0, 0.03], [-d / 2 + 0.01, d / 2 - 0.01], { bevel: 0.008 }),
      span('wood', [-fx + 0.02, fx - 0.02], [0.005, 0.03], [-0.025, 0.025], { plan: false }),
      vcyl('wood', 0, 0, 0.03, h - 0.05, 0.02, { plan: false }),
      sphere('wood', [0, h - 0.03, 0], 0.03, { plan: false }),
      // Shoe shelf on two blocks.
      span('wood', [-fx - 0.012, -fx + 0.012], [0.03, 0.1], [-0.1, 0.1], { plan: false }),
      span('wood', [fx - 0.012, fx + 0.012], [0.03, 0.1], [-0.1, 0.1], { plan: false }),
      ...slats('wood', [-fx - 0.015, fx + 0.015], [0.1, 0.115], [-d / 2 + 0.03, d / 2 - 0.03], 4, { axis: 'z', gap: 0.25, plan: false }),
    ];
    // Curved shoulder hanger.
    const pts: V3[] = spaced(7, -g.hw, g.hw).map((x) => [x, g.yS - 0.05 * (x / g.hw) ** 2, 0] as V3);
    parts.push(...rodPath('wood', pts, 0.016));
    // Trouser bar with folded trousers.
    const tw = Math.min(0.3, w - 0.14);
    const tl = Math.min(0.25, g.barY - 0.24);
    parts.push(
      rodX('metal', -tw / 2 - 0.02, tw / 2 + 0.02, g.barY, 0, 0.008, { plan: false }),
      rodX('trousers', -tw / 2, tw / 2, g.barY, 0, 0.02, { plan: false }),
      span('trousers', [-tw / 2, tw / 2], [g.barY - tl, g.barY], [0.008, 0.022], { bevel: 0.004, plan: false }),
      span('trousers', [-tw / 2, tw / 2], [g.barY - tl * 0.8, g.barY], [-0.022, -0.008], { bevel: 0.004, plan: false }),
    );
    // Jacket on the hanger: body, sloping shoulders, sleeves, lapels and buttons.
    const jTop = g.yS - 0.07;
    const jBot = g.yS - 0.02 - g.jl;
    parts.push(
      cushion('jacket', [-g.jw / 2 + 0.03, g.jw / 2 - 0.03], [jBot, jTop], [-0.05, 0.05], { softness: 0.4 }),
      box('jacket', [-g.jw / 4, g.yS - 0.06, 0], [g.jw / 2, 0.05, 0.1], { rotation: [0, 0, 0.22], bevel: 0.02, plan: false }),
      box('jacket', [g.jw / 4, g.yS - 0.06, 0], [g.jw / 2, 0.05, 0.1], { rotation: [0, 0, -0.22], bevel: 0.02, plan: false }),
      cushion('jacket', [-g.jw / 2, -g.jw / 2 + 0.07], [jBot + 0.05, g.yS - 0.08], [-0.045, 0.06], { softness: 0.45, plan: false }),
      cushion('jacket', [g.jw / 2 - 0.07, g.jw / 2], [jBot + 0.05, g.yS - 0.08], [-0.045, 0.06], { softness: 0.45, plan: false }),
      box('jacket', [-0.045, g.yS - 0.2, 0.052], [0.05, 0.24, 0.008], { rotation: [0, 0, 0.28], plan: false }),
      box('jacket', [0.045, g.yS - 0.2, 0.052], [0.05, 0.24, 0.008], { rotation: [0, 0, -0.28], plan: false }),
      sphere('metal', [0, jTop - (jTop - jBot) * 0.55, 0.052], 0.008, { plan: false }),
      sphere('metal', [0, jTop - (jTop - jBot) * 0.75, 0.052], 0.008, { plan: false }),
    );
    // A pair of shoes on the shelf.
    const sl = Math.min(0.26, d - 0.1);
    for (const x of [-0.06, 0.06]) {
      parts.push(
        cushion('jacket', [x - 0.04, x + 0.04], [0.115, 0.16], [-sl / 2, sl / 2], { softness: 0.45, plan: false }),
        cushion('jacket', [x - 0.04, x + 0.04], [0.115, 0.2], [-sl / 2, -sl / 2 + 0.09], { softness: 0.4, plan: false }),
      );
    }
    return parts;
  },
  planDetail: (size) => {
    const g = valetGeom(size);
    return [rectPoly(-g.jw / 2, -0.05, g.jw / 2, 0.06), line([-g.hw, 0], [g.hw, 0])];
  },
});

function railGarments(w: number): number {
  return clamp(Math.round((w - 0.2) / 0.08), 2, 22);
}

const clothesRail = defineAsset({
  id: 'clothes-rail',
  name: 'Open clothes rail',
  category: 'bedroom',
  type: 'storage',
  group: 'Wardrobes',
  tags: ['clothes rail', 'garment rack', 'hanging', 'open wardrobe', 'industrial'],
  defaultSize: { w: 1.2, d: 0.45, h: 1.6 },
  minSize: { w: 0.6, d: 0.35, h: 1.2 },
  maxSize: { w: 2.0, d: 0.6, h: 1.9 },
  wallSnap: true,
  slots: [
    matSlot('metal', 'Frame & hangers', 'metal-black-matte'),
    matSlot('shelf', 'Shelf', 'wood-oak-light'),
    matSlot('clothesA', 'Clothes', 'fabric-terracotta'),
    matSlot('clothesB', 'Clothes & boxes', 'fabric-cream'),
  ],
  build: ({ w, d, h }) => {
    const ux = w / 2 - 0.02;
    const railY = h - 0.03;
    const parts: Part[] = [
      rodZ('metal', -ux, 0.015, -d / 2 + 0.02, d / 2 - 0.02, 0.015),
      rodZ('metal', ux, 0.015, -d / 2 + 0.02, d / 2 - 0.02, 0.015),
      vcyl('metal', -ux, 0, 0.03, railY, 0.014, { plan: false }),
      vcyl('metal', ux, 0, 0.03, railY, 0.014, { plan: false }),
      rodX('metal', -ux, ux, railY, 0, 0.014, { plan: false }),
      sphere('metal', [-ux, railY, 0], 0.018, { plan: false }),
      sphere('metal', [ux, railY, 0], 0.018, { plan: false }),
      span('shelf', [-ux + 0.015, ux - 0.015], [0.12, 0.145], [-d / 2 + 0.03, d / 2 - 0.03], { bevel: 0.004 }),
      rodX('metal', -ux, ux, 0.11, -d / 2 + 0.06, 0.008, { plan: false }),
      rodX('metal', -ux, ux, 0.11, d / 2 - 0.06, 0.008, { plan: false }),
    ];
    // Boxes and shoes on the base shelf.
    const nb = Math.max(1, Math.floor((w - 0.1) / 0.36));
    for (const [i, cx] of cells(nb, -ux + 0.03, ux - 0.03).entries()) {
      if (i % 2 === 0) {
        parts.push(
          span('clothesB', [cx - 0.14, cx + 0.14], [0.145, 0.32], [-d / 2 + 0.05, d / 2 - 0.08], { bevel: 0.006, plan: false }),
          span('clothesB', [cx - 0.145, cx + 0.145], [0.3, 0.33], [-d / 2 + 0.045, d / 2 - 0.075], { bevel: 0.006, plan: false }),
        );
      } else {
        for (const x of [cx - 0.06, cx + 0.06]) {
          parts.push(
            cushion('clothesA', [x - 0.04, x + 0.04], [0.145, 0.19], [-0.13, 0.12], { softness: 0.45, plan: false }),
            cushion('clothesA', [x - 0.04, x + 0.04], [0.145, 0.24], [-0.13, -0.04], { softness: 0.4, plan: false }),
          );
        }
      }
    }
    // Hung garments: hook, shoulder bar and body, with deterministic variety.
    const rand = rng(31);
    const gw = Math.min(0.42, d - 0.06);
    const n = railGarments(w);
    const maxL = Math.min(1.05, h - 0.45);
    for (const x of cells(n, -ux + 0.07, ux - 0.07)) {
      const cx = x + (rand() - 0.5) * 0.015;
      const L = maxL * (0.55 + 0.45 * rand());
      const slot = rand() < 0.5 ? 'clothesA' : 'clothesB';
      const tx = 0.03 + rand() * 0.02;
      parts.push(
        rod('metal', [cx, railY, 0], [cx, railY - 0.05, 0], 0.003, { plan: false }),
        rodZ('metal', cx, railY - 0.06, -gw / 2 + 0.01, gw / 2 - 0.01, 0.005, { plan: false }),
        cushion(slot, [cx - tx / 2, cx + tx / 2], [railY - 0.06 - L, railY - 0.065], [-gw / 2, gw / 2], { softness: 0.4, plan: false }),
      );
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const ux = w / 2 - 0.02;
    const gw = Math.min(0.42, d - 0.06);
    const strokes: PlanStroke[] = [line([-ux, 0], [ux, 0])];
    for (const x of cells(railGarments(w), -ux + 0.07, ux - 0.07)) strokes.push(line([x, -gw / 2], [x, gw / 2]));
    return strokes;
  },
});

const benchBedEnd = defineAsset({
  id: 'bench-bed-end',
  name: 'Bed-end bench',
  category: 'bedroom',
  type: 'seating',
  group: 'Stools & benches',
  tags: ['bench', 'end of bed', 'upholstered', 'tufted', 'ottoman', 'seat'],
  defaultSize: { w: 1.3, d: 0.42, h: 0.48 },
  minSize: { w: 0.8, d: 0.35, h: 0.4 },
  maxSize: { w: 1.9, d: 0.55, h: 0.56 },
  slots: [
    matSlot('frame', 'Frame & legs', 'wood-walnut'),
    matSlot('upholstery', 'Upholstery', 'fabric-velvet-teal'),
    matSlot('throw', 'Folded throw', 'fabric-cream'),
  ],
  build: ({ w, d, h }) => {
    const seatTop = h - 0.035;
    const frameTop = seatTop - 0.09;
    const parts: Part[] = [
      span('frame', [-w / 2 + 0.02, w / 2 - 0.02], [frameTop - 0.07, frameTop], [-d / 2 + 0.02, d / 2 - 0.02], { bevel: 0.005, plan: false }),
      cushion('upholstery', [-w / 2, w / 2], [frameTop, seatTop], [-d / 2, d / 2], { softness: 0.3 }),
      rodX('upholstery', -w / 2 + 0.03, w / 2 - 0.03, seatTop - 0.014, d / 2 - 0.012, 0.006, { plan: false }),
      rodX('upholstery', -w / 2 + 0.03, w / 2 - 0.03, seatTop - 0.014, -d / 2 + 0.012, 0.006, { plan: false }),
      rodX('frame', -w / 2 + 0.06, w / 2 - 0.06, 0.12, 0, 0.012, { plan: false }),
      rodZ('frame', -w / 2 + 0.045, 0.12, -d / 2 + 0.05, d / 2 - 0.05, 0.012, { plan: false }),
      rodZ('frame', w / 2 - 0.045, 0.12, -d / 2 + 0.05, d / 2 - 0.05, 0.012, { plan: false }),
    ];
    for (const x of [-w / 2 + 0.045, w / 2 - 0.045]) {
      for (const z of [-d / 2 + 0.045, d / 2 - 0.045]) parts.push(turnedLeg('frame', x, z, 0, frameTop - 0.07, 0.022, { style: 'spindle' }));
    }
    // Diamond tufting on the seat top.
    const nx = clamp(Math.round(w / 0.18), 3, 10);
    for (const [j, z] of [-d * 0.17, d * 0.17].entries()) {
      for (const x of cells(nx - j, -w / 2 + 0.08 + j * ((w - 0.16) / nx / 2), w / 2 - 0.08 - j * ((w - 0.16) / nx / 2))) {
        parts.push(sphere('upholstery', [x, seatTop - 0.004, z], 0.01, { scale: [1, 0.55, 1], plan: false }));
      }
    }
    // Folded throw over the right end.
    const tx: V2 = [w / 2 - 0.4, w / 2 - 0.09];
    parts.push(
      cushion('throw', tx, [seatTop - 0.006, seatTop + 0.018], [-d / 2 + 0.03, d / 2 - 0.002], { softness: 0.4, plan: false }),
      cushion('throw', [tx[0] + 0.01, tx[1] - 0.01], [seatTop + 0.014, h], [-d / 2 + 0.04, d / 2 - 0.015], { softness: 0.4, plan: false }),
      cushion('throw', tx, [frameTop - 0.06, seatTop + 0.012], [d / 2 - 0.002, d / 2 + 0.012], { softness: 0.45, plan: false }),
    );
    return parts;
  },
  planDetail: ({ w, d }) => {
    const strokes: PlanStroke[] = [rectPoly(w / 2 - 0.4, -d / 2 + 0.03, w / 2 - 0.09, d / 2)];
    const nx = clamp(Math.round(w / 0.18), 3, 10);
    for (const x of cells(nx, -w / 2 + 0.08, w / 2 - 0.08)) {
      if (x < w / 2 - 0.42) strokes.push(circle([x, -d * 0.17], 0.01));
    }
    return strokes;
  },
});

export const BEDROOM_ASSETS: AssetDefinition[] = [
  bedSingle,
  bedDouble,
  bedQueen,
  bedKing,
  bedCanopy,
  bedPlatform,
  daybedTrundle,
  bedside,
  wardrobe,
  armoire,
  dresser,
  blanketChest,
  vanity,
  mirrorFloor,
  valetStand,
  clothesRail,
  benchBedEnd,
];

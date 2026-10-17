import type { AssetDefinition, Part, PlanStroke, Size3 } from './types';
import {
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
  ellipsePoints,
  knob,
  lathe,
  legs4,
  lerp,
  line,
  matSlot,
  pillow,
  poly,
  prism,
  range,
  rectPoly,
  ring,
  rng,
  rod,
  rodPath,
  rodX,
  rodZ,
  slats,
  span,
  sphere,
  torus,
  tufts,
  turnedLeg,
  vcyl,
  type V2,
  type V3,
} from './parts';

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

/** Soft cushion tipped back by `lean` radians about its centre (top towards -z). */
function leanCushion(slot: string, x: V2, y: V2, z: V2, lean: number, softness = 0.3): Part {
  const s: V3 = [x[1] - x[0], y[1] - y[0], z[1] - z[0]];
  return box(slot, [(x[0] + x[1]) / 2, (y[0] + y[1]) / 2, (z[0] + z[1]) / 2], s, {
    bevel: Math.min(...s) * softness,
    rotation: [-lean, 0, 0],
    plan: false,
  });
}

/** Depth of the front face of a `leanCushion` (same ranges and lean) at height `at`. */
function leanFaceZ(y: V2, z: V2, lean: number, at: number): number {
  const yc = (y[0] + y[1]) / 2;
  const zc = (z[0] + z[1]) / 2;
  return zc + (z[1] - z[0]) / 2 / Math.cos(lean) - (at - yc) * Math.tan(lean);
}

/** Buttons on an upward-facing surface at height `y`, in an nx × nz grid. */
function topButtons(slot: string, x: V2, z: V2, y: number, nx: number, nz: number, r = 0.011, diamond = false): Part[] {
  const parts: Part[] = [];
  const cw = (x[1] - x[0]) / Math.max(1, nx);
  for (const [j, zz] of cells(nz, z[0], z[1]).entries()) {
    const shift = diamond && j % 2 === 1 ? cw / 2 : 0;
    for (const xx of cells(nx, x[0], x[1])) {
      const px = xx + shift;
      if (px > x[1] - 0.001) continue;
      parts.push(sphere(slot, [px, y, zz], r, { scale: [1, 0.55, 1], plan: false }));
    }
  }
  return parts;
}

/** Small vase / bottle profile (closed lathe) of radius r and height hh. */
function vaseProfile(r: number, hh: number): V2[] {
  return [
    [0, 0],
    [r * 0.6, 0],
    [r, hh * 0.35],
    [r * 0.8, hh * 0.65],
    [r * 0.42, hh * 0.85],
    [r * 0.5, hh],
    [0, hh],
  ];
}

/** Shallow bowl profile (closed lathe). */
function bowlProfile(r: number, hh: number): V2[] {
  return [
    [0, 0],
    [r * 0.45, 0],
    [r * 0.85, hh * 0.45],
    [r, hh],
    [r * 0.9, hh],
    [r * 0.75, hh * 0.55],
    [0, hh * 0.3],
  ];
}

/** Stack of flat books lying on a surface at y0, centred on (x, z). Returns parts and top height. */
function bookStack(slot: string, x: number, z: number, y0: number, w: number, d: number, n: number, seed: number): Part[] {
  const rand = rng(seed);
  const parts: Part[] = [];
  let y = y0;
  for (let i = 0; i < n; i++) {
    const t = lerp(0.022, 0.04, rand());
    const bw = w * lerp(0.82, 1, rand());
    const bd = d * lerp(0.8, 1, rand());
    const dx = (rand() - 0.5) * (w - bw) * 0.8;
    parts.push(
      box(slot, [x + dx, y + t / 2, z], [bw, t, bd], { rotation: [0, (rand() - 0.5) * 0.12, 0], plan: false }),
    );
    y += t;
  }
  return parts;
}

// ---------------------------------------------------------------------------
// Sofas
// ---------------------------------------------------------------------------

interface SofaStyle {
  arm: 'box' | 'roll' | 'track';
  /** Fixed arm width — resizing stretches the seat, not the arms. */
  armW: number;
  legH: number;
  leg: 'block' | 'taper' | 'splay';
  /** Height of a wooden base rail between the legs and the upholstery. */
  rail?: number;
  /** Buttons on the back cushions. */
  buttons?: boolean;
  /** Throw pillows at each end. */
  pillows: number;
}

const BACK_LEAN = 0.1;

function sofaFrame({ w, d, h }: Size3, s: SofaStyle) {
  const backT = clamp(d * 0.22, 0.15, 0.22);
  const seatTop = clamp(h * 0.53, 0.36, 0.46);
  const x0 = -w / 2 + s.armW;
  const x1 = w / 2 - s.armW;
  return {
    base: s.legH + (s.rail ?? 0),
    backT,
    seatTop,
    deckTop: seatTop - 0.13,
    armTop: Math.min(h - 0.06, seatTop + 0.2),
    x0,
    x1,
    zb: -d / 2 + backT,
    seats: clamp(Math.round((x1 - x0) / 0.62), 1, 4),
    backCushionD: clamp(d * 0.18, 0.12, 0.2),
  };
}

/** Seat cushion with a boxing seam, plus a leaning back cushion (optionally buttoned). */
function sofaSeat(x: V2, deckTop: number, seatTop: number, zb: number, zEnd: number, backD: number, h: number, buttons = false): Part[] {
  const cx: V2 = [x[0] + 0.006, x[1] - 0.006];
  const by: V2 = [seatTop - 0.01, h - 0.035];
  const bz: V2 = [zb + 0.005, zb + 0.005 + backD];
  const parts: Part[] = [
    cushion('upholstery', cx, [deckTop, seatTop], [zb + 0.01, zEnd], { softness: 0.3 }),
    rodX('upholstery', x[0] + 0.05, x[1] - 0.05, deckTop + (seatTop - deckTop) * 0.45, zEnd - 0.004, 0.005, {
      plan: false,
    }),
    leanCushion('upholstery', cx, by, bz, BACK_LEAN),
  ];
  if (buttons) {
    for (const f of [0.38, 0.68]) {
      const y = lerp(by[0], by[1], f);
      parts.push(...tufts('upholstery', cx, [y, y], leanFaceZ(by, bz, BACK_LEAN, y) - 0.004, 2, 1, { r: 0.012 }));
    }
  }
  return parts;
}

/** Throw pillows leaning against the back cushions at each end of a seat run. */
function sofaPillows(x0: number, x1: number, seatTop: number, zFront: number, h: number, n: number, slot = 'upholstery'): Part[] {
  const parts: Part[] = [];
  const pw = clamp((h - seatTop) * 0.95, 0.28, 0.44);
  for (const side of [-1, 1]) {
    for (let k = 0; k < n; k++) {
      const sz = pw * (1 - 0.14 * k);
      const px = side < 0 ? x0 + sz * 0.55 + k * 0.16 : x1 - sz * 0.55 - k * 0.16;
      parts.push(
        pillow(slot, [px, seatTop + sz * 0.45, zFront + 0.05 + k * 0.05], sz, sz * 0.95, 0.15, {
          lean: 0.3,
          turn: side * (0.2 - 0.25 * k),
        }),
      );
    }
  }
  return parts;
}

function sofaLegs({ w, d }: Size3, s: SofaStyle): Part[] {
  const parts: Part[] = [];
  const t = 0.05;
  if (s.rail) {
    parts.push(
      span('legs', [-w / 2 + 0.015, w / 2 - 0.015], [s.legH, s.legH + s.rail], [-d / 2 + 0.015, d / 2 - 0.015], {
        bevel: 0.008,
        plan: false,
      }),
    );
  }
  for (const fx of w > 2.0 ? [-1, 0, 1] : [-1, 1]) {
    for (const fz of [-1, 1]) {
      const x = fx * (w / 2 - 0.03 - t / 2);
      const z = fz * (d / 2 - 0.03 - t / 2);
      if (s.leg === 'block') {
        parts.push(span('legs', [x - t / 2, x + t / 2], [0, s.legH], [z - t / 2, z + t / 2], { bevel: 0.006, plan: false }));
      } else if (s.leg === 'taper') {
        parts.push(turnedLeg('legs', x, z, 0, s.legH, 0.026, { style: 'taper' }));
      } else {
        // Splayed dowel: thick at the top under the frame, thin and angled out at the floor.
        parts.push(rod('legs', [x, 0, z], [x - fx * 0.05, s.legH, z - fz * 0.05], 0.011, { rTop: 0.02, plan: false }));
      }
    }
  }
  return parts;
}

function sofaParts(size: Size3, s: SofaStyle): Part[] {
  const { w, d, h } = size;
  const g = sofaFrame(size, s);
  const zf = d / 2;
  const parts: Part[] = [
    span('upholstery', [g.x0, g.x1], [g.base, g.deckTop], [g.zb, zf - 0.02], { plan: false }),
    span('upholstery', [-w / 2, w / 2], [g.base, h], [-d / 2, g.zb], { bevel: 0.035 }),
  ];
  for (const xa of [[-w / 2, g.x0] as V2, [g.x1, w / 2] as V2]) {
    const xm = (xa[0] + xa[1]) / 2;
    if (s.arm === 'roll') {
      const ra = s.armW / 2;
      parts.push(span('upholstery', xa, [g.base, g.armTop - ra], [g.zb, zf], { bevel: 0.015 }));
      parts.push(rodZ('upholstery', xm, g.armTop - ra, g.zb, zf - 0.025, ra, { segments: 24 }));
      parts.push(discZ('upholstery', [xm, g.armTop - ra, zf - 0.0125], ra * 0.96, 0.025, { segments: 24, plan: false }));
      parts.push(sphere('upholstery', [xm, g.armTop - ra, zf], 0.014, { scale: [1, 1, 0.5], plan: false }));
    } else if (s.arm === 'box') {
      parts.push(span('upholstery', xa, [g.base, g.armTop - 0.05], [g.zb, zf], { bevel: 0.03 }));
      parts.push(cushion('upholstery', xa, [g.armTop - 0.07, g.armTop], [g.zb - 0.02, zf], { softness: 0.45, plan: false }));
    } else {
      parts.push(span('upholstery', xa, [g.base, g.armTop], [g.zb, zf], { bevel: 0.012 }));
    }
  }
  for (const xs of cellSpans(g.seats, g.x0, g.x1)) {
    parts.push(...sofaSeat(xs, g.deckTop, g.seatTop, g.zb, zf - 0.004, g.backCushionD, h, s.buttons));
  }
  parts.push(...sofaPillows(g.x0, g.x1, g.seatTop, g.zb + g.backCushionD, h, s.pillows));
  parts.push(...sofaLegs(size, s));
  return parts;
}

function sofaPlan(size: Size3, s: SofaStyle): PlanStroke[] {
  const g = sofaFrame(size, s);
  const zf = size.d / 2;
  const zc = g.zb + g.backCushionD;
  return [
    line([g.x0, g.zb], [g.x0, zf]),
    line([g.x1, g.zb], [g.x1, zf]),
    line([g.x0, zc], [g.x1, zc]),
    ...cellSpans(g.seats, g.x0, g.x1)
      .slice(1)
      .map(([x]) => line([x, zc], [x, zf - 0.01])),
  ];
}

const SOFA_3: SofaStyle = { arm: 'box', armW: 0.2, legH: 0.07, leg: 'block', pillows: 2 };
const LOVESEAT: SofaStyle = { arm: 'roll', armW: 0.18, legH: 0.14, leg: 'taper', pillows: 1 };
const MID_CENTURY: SofaStyle = { arm: 'track', armW: 0.1, legH: 0.16, leg: 'splay', rail: 0.04, buttons: true, pillows: 1 };

const sofa3 = defineAsset({
  id: 'sofa-3-seat',
  name: '3-seat sofa',
  category: 'living',
  type: 'seating',
  group: 'Sofas & loveseats',
  tags: ['couch', 'sofa', 'seating', 'settee', 'lounge'],
  defaultSize: { w: 2.2, d: 0.92, h: 0.82 },
  minSize: { w: 1.6, d: 0.8, h: 0.7 },
  maxSize: { w: 3.2, d: 1.2, h: 1.0 },
  wallSnap: true,
  slots: [matSlot('upholstery', 'Upholstery', 'fabric-linen'), matSlot('legs', 'Legs', 'metal-black-matte')],
  build: (size) => sofaParts(size, SOFA_3),
  planDetail: (size) => sofaPlan(size, SOFA_3),
});

const loveseat = defineAsset({
  id: 'sofa-loveseat',
  name: '2-seat loveseat',
  category: 'living',
  type: 'seating',
  group: 'Sofas & loveseats',
  tags: ['couch', 'sofa', 'loveseat', 'seating', 'settee'],
  defaultSize: { w: 1.5, d: 0.88, h: 0.8 },
  minSize: { w: 1.2, d: 0.75, h: 0.7 },
  maxSize: { w: 2.0, d: 1.1, h: 1.0 },
  wallSnap: true,
  slots: [
    matSlot('upholstery', 'Upholstery', 'fabric-velvet-green'),
    matSlot('legs', 'Legs', 'wood-oak-light'),
  ],
  build: (size) => sofaParts(size, LOVESEAT),
  planDetail: (size) => sofaPlan(size, LOVESEAT),
});

const sofaMidCentury = defineAsset({
  id: 'sofa-mid-century',
  name: 'Mid-century sofa',
  category: 'living',
  type: 'seating',
  group: 'Sofas & loveseats',
  tags: ['sofa', 'couch', 'mid-century', 'retro', 'button back', 'tapered legs', 'seating'],
  defaultSize: { w: 2.0, d: 0.85, h: 0.8 },
  minSize: { w: 1.4, d: 0.75, h: 0.7 },
  maxSize: { w: 2.6, d: 1.0, h: 0.9 },
  wallSnap: true,
  slots: [matSlot('upholstery', 'Upholstery', 'fabric-mustard'), matSlot('legs', 'Legs & base rail', 'wood-teak')],
  build: (size) => sofaParts(size, MID_CENTURY),
  planDetail: (size) => sofaPlan(size, MID_CENTURY),
});

function cornerSofaFrame({ w, d, h }: Size3) {
  const armW = 0.2;
  const backT = 0.2;
  const seatTop = clamp(h * 0.53, 0.36, 0.46);
  const chaiseW = clamp(w * 0.33, 0.8, 1.0);
  const x0 = -w / 2 + armW;
  const xR = w / 2 - armW;
  const xc = xR - chaiseW;
  return {
    armW,
    legH: 0.07,
    seatTop,
    deckTop: seatTop - 0.13,
    armTop: Math.min(h - 0.06, seatTop + 0.2),
    x0,
    xR,
    xc,
    zb: -d / 2 + backT,
    zm: -d / 2 + Math.min(0.95, d - 0.4),
    seats: clamp(Math.round((xc - x0) / 0.62), 1, 3),
    backCushionD: 0.18,
  };
}

const sofaCorner = defineAsset({
  id: 'sofa-corner-l',
  name: 'L-shaped corner sofa',
  category: 'living',
  type: 'seating',
  group: 'Sofas & loveseats',
  tags: ['couch', 'sectional', 'chaise', 'corner sofa', 'l-shape', 'seating'],
  defaultSize: { w: 2.7, d: 1.6, h: 0.82 },
  minSize: { w: 2.1, d: 1.3, h: 0.7 },
  maxSize: { w: 3.6, d: 2.2, h: 1.0 },
  wallSnap: true,
  slots: [
    matSlot('upholstery', 'Upholstery', 'fabric-wool-grey'),
    matSlot('legs', 'Legs', 'metal-black-matte'),
  ],
  build: (size) => {
    const { w, d, h } = size;
    const g = cornerSofaFrame(size);
    const zf = d / 2;
    const parts: Part[] = [
      span('upholstery', [-w / 2, w / 2], [g.legH, h], [-d / 2, g.zb], { bevel: 0.035 }),
      span('upholstery', [-w / 2, g.x0], [g.legH, g.armTop - 0.05], [g.zb, g.zm], { bevel: 0.03 }),
      cushion('upholstery', [-w / 2, g.x0], [g.armTop - 0.07, g.armTop], [g.zb - 0.02, g.zm], {
        softness: 0.45,
        plan: false,
      }),
      span('upholstery', [g.xR, w / 2], [g.legH, g.armTop - 0.05], [g.zb, zf], { bevel: 0.03 }),
      cushion('upholstery', [g.xR, w / 2], [g.armTop - 0.07, g.armTop], [g.zb - 0.02, zf], {
        softness: 0.45,
        plan: false,
      }),
      // L-shaped seat deck (concave → kept out of the plan footprint).
      prism(
        'upholstery',
        [
          [g.x0, g.zb],
          [g.xR, g.zb],
          [g.xR, zf - 0.02],
          [g.xc, zf - 0.02],
          [g.xc, g.zm - 0.02],
          [g.x0, g.zm - 0.02],
        ],
        g.legH,
        g.deckTop - g.legH,
        { plan: false },
      ),
    ];
    for (const xs of cellSpans(g.seats, g.x0, g.xc)) {
      parts.push(...sofaSeat(xs, g.deckTop, g.seatTop, g.zb, g.zm - 0.01, g.backCushionD, h));
    }
    parts.push(...sofaSeat([g.xc, g.xR], g.deckTop, g.seatTop, g.zb, zf - 0.004, g.backCushionD, h));
    // Chaise seam where a long chaise cushion would fold.
    parts.push(rodX('upholstery', g.xc + 0.05, g.xR - 0.05, g.seatTop - 0.004, g.zm - 0.01, 0.005, { plan: false }));
    const zp = g.zb + g.backCushionD;
    parts.push(...sofaPillows(g.x0, g.xR, g.seatTop, zp, h, 1));
    parts.push(
      pillow('upholstery', [g.x0 + 0.42, g.seatTop + 0.15, zp + 0.08], 0.36, 0.34, 0.14, { lean: 0.3, turn: 0.15 }),
    );
    const t = 0.05;
    const legAt: V2[] = [
      [-w / 2 + 0.03 + t / 2, -d / 2 + 0.03 + t / 2],
      [w / 2 - 0.03 - t / 2, -d / 2 + 0.03 + t / 2],
      [-w / 2 + 0.03 + t / 2, g.zm - 0.03 - t / 2],
      [w / 2 - 0.03 - t / 2, d / 2 - 0.03 - t / 2],
      [g.xc + 0.03 + t / 2, d / 2 - 0.03 - t / 2],
      [g.xc + 0.03 + t / 2, -d / 2 + 0.03 + t / 2],
    ];
    for (const [x, z] of legAt) {
      parts.push(span('legs', [x - t / 2, x + t / 2], [0, g.legH], [z - t / 2, z + t / 2], { bevel: 0.006, plan: false }));
    }
    return parts;
  },
  planDetail: (size) => {
    const g = cornerSofaFrame(size);
    const zc = g.zb + g.backCushionD;
    const strokes = cellSpans(g.seats, g.x0, g.xc)
      .slice(1)
      .map(([x]) => line([x, zc], [x, g.zm - 0.01]));
    strokes.push(line([g.xc, zc], [g.xc, g.zm - 0.01]));
    strokes.push(line([g.x0, zc], [g.xR, zc]));
    strokes.push(line([g.x0, g.zb], [g.x0, g.zm]));
    strokes.push(line([g.xR, g.zb], [g.xR, size.d / 2]));
    return strokes;
  },
});

const chesterfield = defineAsset({
  id: 'sofa-chesterfield',
  name: 'Chesterfield sofa',
  category: 'living',
  type: 'seating',
  group: 'Sofas & loveseats',
  tags: ['chesterfield', 'sofa', 'couch', 'tufted', 'leather', 'classic', 'rolled arm'],
  defaultSize: { w: 2.1, d: 0.95, h: 0.76 },
  minSize: { w: 1.5, d: 0.85, h: 0.68 },
  maxSize: { w: 2.8, d: 1.1, h: 0.85 },
  wallSnap: true,
  slots: [
    matSlot('upholstery', 'Leather', 'leather-cognac'),
    matSlot('legs', 'Bun feet', 'wood-dark-stain'),
    matSlot('studs', 'Nailheads', 'metal-brass'),
  ],
  build: ({ w, d, h }) => {
    const armW = 0.24;
    const legH = 0.09;
    const backT = 0.22;
    const seatTop = clamp(h * 0.57, 0.4, 0.47);
    const deckTop = seatTop - 0.12;
    const rr = 0.075;
    const ra = 0.1;
    const x0 = -w / 2 + armW;
    const x1 = w / 2 - armW;
    const zb = -d / 2 + backT;
    const zf = d / 2;
    const parts: Part[] = [
      span('upholstery', [-w / 2 + 0.02, w / 2 - 0.02], [legH, h - rr], [-d / 2, zb], { bevel: 0.02 }),
      rodX('upholstery', -w / 2 + 0.05, w / 2 - 0.05, h - rr, zb - rr + 0.02, rr, { segments: 24 }),
      span('upholstery', [x0, x1], [legH, deckTop], [zb, zf], { bevel: 0.02 }),
      ...tufts(
        'upholstery',
        [x0 + 0.02, x1 - 0.02],
        [seatTop + 0.06, h - rr - 0.03],
        zb + 0.004,
        clamp(Math.round((x1 - x0) / 0.15), 3, 16),
        3,
        { diamond: true, r: 0.012 },
      ),
    ];
    for (const side of [-1, 1]) {
      const xa: V2 = side < 0 ? [-w / 2, x0] : [x1, w / 2];
      const rx = side * (w / 2 - ra);
      const yr = h - ra;
      parts.push(span('upholstery', xa, [legH, yr], [zb - 0.02, zf], { bevel: 0.02 }));
      parts.push(rodZ('upholstery', rx, yr, -d / 2 + 0.04, zf - 0.03, ra, { segments: 28 }));
      parts.push(discZ('upholstery', [rx, yr, zf - 0.015], ra, 0.03, { segments: 28, plan: false }));
      // Nailheads around the scroll.
      for (const k of range(11)) {
        const a = lerp(-0.25 * Math.PI, 1.25 * Math.PI, k / 10);
        parts.push(
          sphere('studs', [rx + Math.cos(a) * (ra - 0.012), yr + Math.sin(a) * (ra - 0.012), zf], 0.0065, {
            scale: [1, 1, 0.6],
            plan: false,
          }),
        );
      }
      // Diamond tufting on the inner face of the arm.
      const xi = side < 0 ? x0 + 0.004 : x1 - 0.004;
      const nz = clamp(Math.round((zf - zb - 0.15) / 0.15), 2, 5);
      const cz = (zf - 0.1 - (zb + 0.05)) / nz;
      for (const [j, yy] of cells(2, seatTop + 0.05, yr - 0.03).entries()) {
        for (const zz of cells(nz, zb + 0.05, zf - 0.1)) {
          const pz = zz + (j % 2 === 1 ? cz / 2 : 0);
          if (pz > zf - 0.1) continue;
          parts.push(sphere('upholstery', [xi, yy, pz], 0.012, { scale: [0.55, 1, 1], plan: false }));
        }
      }
    }
    const seats = clamp(Math.round((x1 - x0) / 0.6), 1, 3);
    for (const [xa, xb] of cellSpans(seats, x0, x1)) {
      parts.push(cushion('upholstery', [xa + 0.005, xb - 0.005], [deckTop, seatTop], [zb + 0.01, zf - 0.005], { softness: 0.25 }));
      parts.push(rodX('upholstery', xa + 0.04, xb - 0.04, (deckTop + seatTop) / 2, zf - 0.006, 0.005, { plan: false }));
    }
    for (const fx of w > 2 ? [-1, 0, 1] : [-1, 1]) {
      for (const fz of [-1, 1]) {
        parts.push(turnedLeg('legs', fx * (w / 2 - 0.08), fz * (d / 2 - 0.08), 0, legH, 0.045, { style: 'bun' }));
      }
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const x0 = -w / 2 + 0.24;
    const x1 = w / 2 - 0.24;
    const zb = -d / 2 + 0.22;
    const seats = clamp(Math.round((x1 - x0) / 0.6), 1, 3);
    return [
      line([x0, zb], [x0, d / 2]),
      line([x1, zb], [x1, d / 2]),
      line([x0, zb], [x1, zb]),
      ...cellSpans(seats, x0, x1)
        .slice(1)
        .map(([x]) => line([x, zb], [x, d / 2 - 0.01])),
    ];
  },
});

const futon = defineAsset({
  id: 'sofa-bed-futon',
  name: 'Futon sofa bed',
  category: 'living',
  type: 'beds',
  group: 'Daybeds & sofa beds',
  tags: ['futon', 'sofa bed', 'guest bed', 'sleeper', 'couch', 'convertible'],
  defaultSize: { w: 1.9, d: 0.9, h: 0.85 },
  minSize: { w: 1.4, d: 0.8, h: 0.75 },
  maxSize: { w: 2.2, d: 1.0, h: 0.95 },
  wallSnap: true,
  slots: [matSlot('mattress', 'Mattress', 'fabric-navy'), matSlot('frame', 'Frame', 'wood-pine')],
  build: ({ w, d, h }) => {
    const at = 0.06;
    const armTop = clamp(h * 0.68, 0.5, 0.62);
    const x0 = -w / 2 + at;
    const x1 = w / 2 - at;
    const zf = d / 2;
    const deckY = 0.3;
    const mt = 0.15;
    const parts: Part[] = [];
    for (const side of [-1, 1]) {
      const xm = side * (w / 2 - at / 2);
      for (const z of [-d / 2 + 0.04, zf - 0.04]) {
        parts.push(
          span('frame', [xm - at / 2, xm + at / 2], [0, armTop - 0.025], [z - 0.035, z + 0.035], {
            bevel: 0.005,
            plan: false,
          }),
        );
      }
      parts.push(span('frame', [xm - at / 2, xm + at / 2], [armTop - 0.025, armTop], [-d / 2, zf], { bevel: 0.006 }));
      parts.push(span('frame', [xm - 0.02, xm + 0.02], [0.08, 0.13], [-d / 2 + 0.075, zf - 0.075], { plan: false }));
      parts.push(
        ...slats('frame', [xm - 0.012, xm + 0.012], [0.13, armTop - 0.025], [-d / 2 + 0.075, zf - 0.075], 5, {
          axis: 'z',
          gap: 0.55,
          plan: false,
        }),
      );
    }
    parts.push(span('frame', [x0, x1], [deckY - 0.08, deckY], [zf - 0.07, zf - 0.04], { plan: false }));
    parts.push(span('frame', [x0, x1], [deckY - 0.08, deckY], [-d / 2 + 0.12, -d / 2 + 0.15], { plan: false }));
    // Reclined back frame.
    const by0 = deckY + 0.04;
    const bz0 = -d / 2 + 0.2;
    const by1 = h - 0.06;
    const bz1 = -d / 2 + 0.04;
    for (const x of [x0 + 0.03, x1 - 0.03]) parts.push(rod('frame', [x, by0, bz0], [x, by1, bz1], 0.02, { plan: false }));
    for (const f of [0.15, 0.45, 0.75, 0.97]) {
      parts.push(rodX('frame', x0 + 0.03, x1 - 0.03, lerp(by0, by1, f), lerp(bz0, bz1, f), 0.014, { plan: false }));
    }
    // Mattress: seat section, folded back section and the fold between them.
    parts.push(cushion('mattress', [x0 + 0.01, x1 - 0.01], [deckY, deckY + mt], [-d / 2 + 0.15, zf - 0.02], { softness: 0.4 }));
    const L = Math.hypot(by1 - by0, bz0 - bz1);
    const a = Math.atan2(bz0 - bz1, by1 - by0);
    const off = 0.022 + mt / 2;
    const cy = (by0 + by1) / 2 + Math.sin(a) * off;
    const cz = (bz0 + bz1) / 2 + Math.cos(a) * off;
    parts.push(
      box('mattress', [0, cy, cz], [x1 - x0 - 0.02, L * 0.92, mt], { rotation: [-a, 0, 0], bevel: mt * 0.4, plan: false }),
    );
    parts.push(rodX('mattress', x0 + 0.03, x1 - 0.03, deckY + mt * 0.5, -d / 2 + 0.16, mt * 0.48, { plan: false }));
    // Ties (tufts) through the mattress.
    const nx = clamp(Math.round((x1 - x0) / 0.32), 2, 7);
    parts.push(...topButtons('mattress', [x0 + 0.05, x1 - 0.05], [-d / 2 + 0.3, zf - 0.1], deckY + mt, nx, 2, 0.013));
    const faceZ = (y: number) => cz + mt / 2 / Math.cos(a) - (y - cy) * Math.tan(a);
    for (const f of [-0.2, 0.15]) {
      const y = cy + f * L;
      parts.push(...tufts('mattress', [x0 + 0.05, x1 - 0.05], [y, y], faceZ(y) - 0.004, nx, 1, { r: 0.013 }));
    }
    for (const side of [-1, 1]) {
      const y = deckY + mt + 0.17;
      parts.push(
        pillow('mattress', [side * (x1 - 0.26), y, faceZ(y) + 0.07], 0.4, 0.38, 0.14, { lean: 0.35, turn: side * 0.18 }),
      );
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const x0 = -w / 2 + 0.06;
    const x1 = w / 2 - 0.06;
    return [line([x0, -d / 2 + 0.2], [x1, -d / 2 + 0.2]), line([x0, -d / 2], [x0, d / 2]), line([x1, -d / 2], [x1, d / 2])];
  },
});

// ---------------------------------------------------------------------------
// Chairs
// ---------------------------------------------------------------------------

const armchair = defineAsset({
  id: 'armchair',
  name: 'Lounge armchair',
  category: 'living',
  type: 'seating',
  group: 'Living chairs',
  tags: ['chair', 'armchair', 'seating', 'lounge chair', 'accent chair'],
  defaultSize: { w: 0.82, d: 0.85, h: 0.8 },
  minSize: { w: 0.65, d: 0.7, h: 0.65 },
  maxSize: { w: 1.1, d: 1.1, h: 1.05 },
  slots: [
    matSlot('upholstery', 'Upholstery', 'fabric-boucle'),
    matSlot('frame', 'Frame & legs', 'wood-walnut'),
  ],
  build: ({ w, d, h }) => {
    const armW = 0.13;
    const legH = 0.17;
    const seatTop = clamp(h * 0.52, 0.36, 0.45);
    const deckTop = seatTop - 0.11;
    const armTop = Math.min(h - 0.08, seatTop + 0.18);
    const x0 = -w / 2 + armW;
    const x1 = w / 2 - armW;
    const zb = -d / 2 + 0.15;
    const zf = d / 2;
    const by: V2 = [seatTop - 0.01, h - 0.04];
    const bz: V2 = [zb, zb + 0.14];
    const parts: Part[] = [
      span('upholstery', [x0, x1], [legH, deckTop], [zb, zf - 0.02], { plan: false }),
      span('upholstery', [-w / 2 + 0.01, w / 2 - 0.01], [legH, h], [-d / 2, zb], { bevel: 0.04 }),
      cushion('upholstery', [x0 + 0.005, x1 - 0.005], [deckTop, seatTop], [zb + 0.01, zf - 0.005], { softness: 0.32 }),
      rodX('upholstery', x0 + 0.05, x1 - 0.05, (deckTop + seatTop) / 2, zf - 0.007, 0.005, { plan: false }),
      leanCushion('upholstery', [x0 + 0.01, x1 - 0.01], by, bz, 0.12),
      pillow('upholstery', [0, seatTop + 0.13, bz[1] + 0.05], (x1 - x0) * 0.62, 0.24, 0.11, { lean: 0.2 }),
      // Wooden seat rail along the front.
      span('frame', [-w / 2 + 0.02, w / 2 - 0.02], [legH, legH + 0.035], [zf - 0.04, zf - 0.015], { bevel: 0.005, plan: false }),
    ];
    for (const xa of [[-w / 2, x0] as V2, [x1, w / 2] as V2]) {
      parts.push(span('upholstery', xa, [legH, armTop - 0.03], [zb, zf - 0.03], { bevel: 0.025 }));
      parts.push(span('frame', xa, [armTop - 0.03, armTop], [zb, zf], { bevel: 0.008 }));
    }
    for (const fx of [-1, 1]) {
      for (const fz of [-1, 1]) {
        parts.push(turnedLeg('frame', fx * (w / 2 - 0.05), fz * (d / 2 - 0.05), 0, legH, 0.024, { style: 'taper' }));
      }
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const x0 = -w / 2 + 0.13;
    const x1 = w / 2 - 0.13;
    const zb = -d / 2 + 0.15;
    return [line([x0, zb], [x0, d / 2]), line([x1, zb], [x1, d / 2]), line([x0, zb + 0.14], [x1, zb + 0.14])];
  },
});

const wingback = defineAsset({
  id: 'armchair-wingback',
  name: 'Wingback chair',
  category: 'living',
  type: 'seating',
  group: 'Living chairs',
  tags: ['wingback', 'armchair', 'wing chair', 'reading chair', 'classic', 'tufted'],
  defaultSize: { w: 0.8, d: 0.85, h: 1.1 },
  minSize: { w: 0.7, d: 0.75, h: 1.0 },
  maxSize: { w: 0.95, d: 1.0, h: 1.25 },
  slots: [matSlot('upholstery', 'Upholstery', 'fabric-velvet-teal'), matSlot('legs', 'Legs', 'wood-walnut')],
  build: ({ w, d, h }) => {
    const legH = 0.16;
    const armW = 0.15;
    const seatTop = clamp(h * 0.4, 0.4, 0.47);
    const deckTop = seatTop - 0.1;
    const armTop = seatTop + 0.2;
    const ra = 0.06;
    const x0 = -w / 2 + armW;
    const x1 = w / 2 - armW;
    const zb = -d / 2 + 0.16;
    const zf = d / 2;
    const parts: Part[] = [
      span('upholstery', [-w / 2 + 0.04, w / 2 - 0.04], [legH, h - 0.05], [-d / 2, zb], { bevel: 0.04 }),
      rodX('upholstery', -w / 2 + 0.1, w / 2 - 0.1, h - 0.05, -d / 2 + 0.09, 0.05, { segments: 20 }),
      span('upholstery', [x0, x1], [legH, deckTop], [zb, zf], { bevel: 0.015 }),
      cushion('upholstery', [x0 + 0.005, x1 - 0.005], [deckTop, seatTop], [zb + 0.01, zf - 0.005], { softness: 0.3 }),
      rodX('upholstery', x0 + 0.04, x1 - 0.04, (deckTop + seatTop) / 2, zf - 0.007, 0.005, { plan: false }),
      ...tufts('upholstery', [x0 + 0.03, x1 - 0.03], [seatTop + 0.1, h - 0.14], zb + 0.004, 3, 3, { diamond: true, r: 0.012 }),
    ];
    const wingD = clamp(d * 0.36, 0.26, 0.34);
    const wy: V2 = [armTop - 0.02, h - 0.06];
    for (const side of [-1, 1]) {
      const xa: V2 = side < 0 ? [-w / 2, x0] : [x1, w / 2];
      const rx = side * (w / 2 - ra);
      parts.push(span('upholstery', xa, [legH, armTop - ra], [zb, zf], { bevel: 0.015 }));
      parts.push(rodZ('upholstery', rx, armTop - ra, zb, zf - 0.02, ra, { segments: 20 }));
      parts.push(discZ('upholstery', [rx, armTop - ra, zf - 0.01], ra, 0.02, { segments: 20, plan: false }));
      // Flared wing with a rolled front edge.
      const yaw = side * 0.15;
      const wx = side * (w / 2 - 0.06);
      const wz = zb + wingD / 2 - 0.06;
      parts.push(
        box('upholstery', [wx, (wy[0] + wy[1]) / 2, wz], [0.07, wy[1] - wy[0], wingD], {
          rotation: [0, yaw, 0],
          bevel: 0.025,
          plan: false,
        }),
      );
      const ex = wx + Math.sin(yaw) * (wingD / 2) - side * 0.01;
      const ez = wz + Math.cos(yaw) * (wingD / 2) - 0.02;
      parts.push(vcyl('upholstery', ex, ez, wy[0], wy[1] - 0.02, 0.032, { plan: false }));
      parts.push(sphere('upholstery', [ex, wy[1] - 0.02, ez], 0.032, { plan: false }));
      // Legs: cabriole at the front, raked at the back, joined by an H-stretcher.
      const lx = side * (w / 2 - 0.06);
      parts.push(turnedLeg('legs', lx, zf - 0.06, 0, legH, 0.03, { style: 'cabriole' }));
      parts.push(rod('legs', [lx, 0, -d / 2 + 0.035], [lx, legH, -d / 2 + 0.07], 0.015, { rTop: 0.022, plan: false }));
      parts.push(rodZ('legs', lx, 0.08, -d / 2 + 0.06, zf - 0.06, 0.01, { plan: false }));
    }
    parts.push(rodX('legs', -w / 2 + 0.06, w / 2 - 0.06, 0.08, 0, 0.01, { plan: false }));
    return parts;
  },
  planDetail: ({ w, d }) => {
    const x0 = -w / 2 + 0.15;
    const x1 = w / 2 - 0.15;
    const zb = -d / 2 + 0.16;
    return [line([x0, zb], [x0, d / 2]), line([x1, zb], [x1, d / 2]), line([x0, zb], [x1, zb])];
  },
});

const recliner = defineAsset({
  id: 'chair-recliner',
  name: 'Recliner',
  category: 'living',
  type: 'seating',
  group: 'Living chairs',
  tags: ['recliner', 'lazy boy', 'armchair', 'lounge chair', 'tv chair', 'footrest'],
  defaultSize: { w: 0.92, d: 0.98, h: 1.02 },
  minSize: { w: 0.8, d: 0.85, h: 0.95 },
  maxSize: { w: 1.05, d: 1.1, h: 1.1 },
  slots: [matSlot('upholstery', 'Upholstery', 'leather-tan'), matSlot('base', 'Base & lever', 'metal-black-matte')],
  build: ({ w, d, h }) => {
    const plinth = 0.06;
    const armW = 0.2;
    const seatTop = clamp(h * 0.47, 0.44, 0.5);
    const deckTop = seatTop - 0.12;
    const armTop = seatTop + 0.17;
    const x0 = -w / 2 + armW;
    const x1 = w / 2 - armW;
    const zb = -d / 2 + 0.2;
    const zf = d / 2;
    const zr = zf - 0.12;
    const parts: Part[] = [
      span('base', [-w / 2 + 0.05, w / 2 - 0.05], [0, plinth], [-d / 2 + 0.05, zf - 0.08], { plan: false }),
      span('upholstery', [-w / 2 + 0.03, w / 2 - 0.03], [plinth, h - 0.08], [-d / 2, zb], { bevel: 0.05 }),
      span('upholstery', [x0, x1], [plinth, deckTop], [zb, zr], { plan: false }),
      // Folded footrest panel.
      cushion('upholstery', [x0 + 0.01, x1 - 0.01], [plinth + 0.02, deckTop], [zr, zf - 0.005], { softness: 0.3, plan: false }),
      rodX('upholstery', x0 + 0.05, x1 - 0.05, (plinth + deckTop) / 2, zf - 0.008, 0.005, { plan: false }),
      cushion('upholstery', [x0 + 0.005, x1 - 0.005], [deckTop, seatTop], [zb + 0.01, zf - 0.01], { softness: 0.35 }),
      rodX('upholstery', x0 + 0.05, x1 - 0.05, (deckTop + seatTop) / 2, zf - 0.013, 0.005, { plan: false }),
    ];
    // Pillow-top back: three stacked bolsters stepping back.
    const rr = (h - 0.02 - seatTop) / 6;
    for (const i of range(3)) {
      const y = seatTop + rr + i * (2 * rr - 0.01);
      parts.push(rodX('upholstery', x0 + 0.01, x1 - 0.01, y, zb + rr - 0.03 - i * 0.035, rr, { segments: 24, plan: false }));
    }
    for (const side of [-1, 1]) {
      const xa: V2 = side < 0 ? [-w / 2, x0] : [x1, w / 2];
      const xm = (xa[0] + xa[1]) / 2;
      const rA = armW * 0.45;
      parts.push(span('upholstery', xa, [plinth, armTop - rA], [zb - 0.05, zf - 0.02], { bevel: 0.04 }));
      parts.push(rodZ('upholstery', xm, armTop - rA, zb - 0.05, zf - 0.04, rA, { segments: 24 }));
      parts.push(discZ('upholstery', [xm, armTop - rA, zf - 0.03], rA * 0.98, 0.02, { segments: 24, plan: false }));
      parts.push(rodX('upholstery', xa[0] + 0.03, xa[1] - 0.03, plinth + 0.03, zf - 0.025, 0.006, { plan: false }));
    }
    // Recline lever on the outside of the right arm.
    parts.push(span('base', [w / 2 - 0.002, w / 2 + 0.01], [seatTop - 0.07, seatTop + 0.01], [zf - 0.24, zf - 0.21], { bevel: 0.004, plan: false }));
    parts.push(span('base', [w / 2 - 0.002, w / 2 + 0.012], [seatTop - 0.07, seatTop - 0.05], [zf - 0.27, zf - 0.18], { bevel: 0.004, plan: false }));
    return parts;
  },
  planDetail: ({ w, d }) => {
    const x0 = -w / 2 + 0.2;
    const x1 = w / 2 - 0.2;
    const zb = -d / 2 + 0.2;
    return [
      line([x0, zb], [x0, d / 2]),
      line([x1, zb], [x1, d / 2]),
      line([x0, d / 2 - 0.12], [x1, d / 2 - 0.12]),
    ];
  },
});

const rockingChair = defineAsset({
  id: 'chair-rocking',
  name: 'Rocking chair',
  category: 'living',
  type: 'seating',
  group: 'Living chairs',
  tags: ['rocking chair', 'rocker', 'nursery chair', 'porch chair', 'spindle', 'wood'],
  defaultSize: { w: 0.65, d: 0.9, h: 1.05 },
  minSize: { w: 0.55, d: 0.8, h: 0.95 },
  maxSize: { w: 0.75, d: 1.05, h: 1.15 },
  slots: [matSlot('frame', 'Frame', 'wood-oak-light'), matSlot('cushion', 'Cushion & throw', 'fabric-linen')],
  build: ({ w, d, h }) => {
    const rx = w / 2 - 0.045;
    const seatY = 0.42;
    const armY = seatY + 0.22;
    const zFront = d / 2 - 0.26;
    const zBack = -d / 2 + 0.24;
    const zTop = zBack - 0.16;
    const half = d / 2 - 0.02;
    const rk = (z: number) => 0.022 + 0.08 * (z / half) ** 2;
    const postTop = h - 0.03;
    const postZ = (y: number) => lerp(zBack, zTop, (y - (seatY - 0.04)) / (postTop - (seatY - 0.04)));
    const parts: Part[] = [
      span('frame', [-rx + 0.02, rx - 0.02], [seatY - 0.04, seatY], [zBack - 0.02, zFront + 0.05], { bevel: 0.008 }),
    ];
    for (const side of [-1, 1]) {
      const x = side * rx;
      const xt = x * 0.92;
      parts.push(
        ...rodPath(
          'frame',
          range(9).map((i) => {
            const z = lerp(-half, half, i / 8);
            return [x, rk(z), z] as V3;
          }),
          0.018,
        ),
      );
      parts.push(rod('frame', [x, rk(zFront), zFront], [x, seatY - 0.04, zFront], 0.017, { plan: false }));
      parts.push(rod('frame', [x, rk(zBack), zBack], [x, seatY - 0.04, zBack], 0.019, { plan: false }));
      parts.push(rod('frame', [x, seatY - 0.04, zBack], [xt, postTop, zTop], 0.017, { plan: false }));
      parts.push(sphere('frame', [xt, postTop, zTop], 0.024, { plan: false }));
      parts.push(rodZ('frame', x, 0.2, zBack, zFront, 0.011, { plan: false }));
      // Arm on a turned support.
      const za = postZ(armY);
      parts.push(span('frame', [x - 0.03, x + 0.03], [armY, armY + 0.025], [za - 0.02, zFront + 0.07], { bevel: 0.008, plan: false }));
      parts.push(rod('frame', [x, seatY, zFront + 0.02], [x, armY, zFront + 0.04], 0.014, { plan: false }));
    }
    // Spindle back and crest rail.
    const xt = rx * 0.92;
    parts.push(span('frame', [-xt, xt], [h - 0.1, h - 0.04], [zTop - 0.015, zTop + 0.015], { bevel: 0.01, plan: false }));
    const n = clamp(Math.round((2 * rx * 0.9) / 0.07), 5, 9);
    for (const x of cells(n, -rx * 0.85, rx * 0.85)) {
      parts.push(rod('frame', [x, seatY, zBack + 0.01], [x * 0.95, h - 0.1, zTop + 0.004], 0.008, { plan: false }));
    }
    // Seat pad, lumbar cushion and a knitted throw over the right arm.
    parts.push(cushion('cushion', [-rx + 0.04, rx - 0.04], [seatY, seatY + 0.05], [zBack + 0.03, zFront + 0.04], { softness: 0.4, plan: false }));
    parts.push(pillow('cushion', [0, seatY + 0.17, postZ(seatY + 0.17) + 0.08], rx * 1.2, 0.26, 0.1, { lean: 0.3 }));
    const zA = zFront - 0.25;
    parts.push(span('cushion', [rx - 0.04, rx + 0.035], [armY + 0.025, armY + 0.04], [zA, zA + 0.28], { bevel: 0.005, plan: false }));
    parts.push(span('cushion', [rx + 0.03, rx + 0.042], [armY - 0.25, armY + 0.04], [zA, zA + 0.28], { bevel: 0.004, plan: false }));
    return parts;
  },
  planDetail: ({ w, d }) => {
    const rx = w / 2 - 0.045;
    return [line([-rx, -d / 2 + 0.02], [-rx, d / 2 - 0.02]), line([rx, -d / 2 + 0.02], [rx, d / 2 - 0.02])];
  },
});

const eggChair = defineAsset({
  id: 'chair-egg',
  name: 'Egg swivel chair',
  category: 'living',
  type: 'seating',
  group: 'Living chairs',
  tags: ['egg chair', 'swivel chair', 'lounge chair', 'retro', 'shell chair', 'cocoon'],
  defaultSize: { w: 0.85, d: 0.85, h: 1.05 },
  minSize: { w: 0.75, d: 0.75, h: 0.95 },
  maxSize: { w: 1.0, d: 1.0, h: 1.15 },
  slots: [
    matSlot('shell', 'Shell', 'plastic-white'),
    matSlot('lining', 'Upholstery', 'fabric-terracotta'),
    matSlot('base', 'Swivel base', 'metal-chrome'),
  ],
  build: ({ w, d, h }) => {
    const R = Math.min(w, d) / 2;
    const tube = 0.035;
    const seatY = clamp(h * 0.42, 0.4, 0.47);
    const y0 = seatY - 0.04;
    const y1 = h - tube;
    const parts: Part[] = [];
    // Four-star swivel base, column and trumpet.
    const L = R * 0.9;
    for (const k of range(4)) {
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      parts.push(
        box('base', [(Math.cos(a) * L) / 2, 0.022, (Math.sin(a) * L) / 2], [L, 0.03, 0.05], {
          rotation: [0, -a, 0],
          bevel: 0.008,
          plan: false,
        }),
      );
      parts.push(cyl('base', [Math.cos(a) * (L - 0.03), 0.005, Math.sin(a) * (L - 0.03)], 0.022, 0.01, { plan: false }));
    }
    parts.push(vcyl('base', 0, 0, 0.03, seatY - 0.12, 0.03, { plan: false }));
    parts.push(
      lathe('base', [0, 0.03, 0], [[0, 0], [0.09, 0], [0.05, 0.03], [0.034, 0.1], [0, 0.1]], { segments: 28, plan: false }),
    );
    // Shell bowl under the seat.
    parts.push(
      lathe(
        'shell',
        [0, seatY - 0.13, 0],
        [
          [0, 0],
          [R * 0.3, 0],
          [R * 0.62, 0.04],
          [R * 0.78, 0.1],
          [R * 0.8, 0.12],
          [0, 0.12],
        ],
        { segments: 36 },
      ),
    );
    // Egg shell built from stacked open rings; the opening faces the front and widens upwards.
    const N = 12;
    for (const i of range(N)) {
      const t = i / (N - 1);
      const y = lerp(y0, y1, t);
      const r = (R - tube) * Math.sqrt(Math.max(0.06, 1 - ((t - 0.35) / 0.7) ** 2));
      const gap = lerp(2.5, 4.2, t);
      const rot: V3 = [Math.PI / 2, 0, Math.PI / 2 + gap / 2];
      parts.push(torus('shell', [0, y, 0], r, tube, { rotation: rot, arc: 2 * Math.PI - gap, plan: false }));
      parts.push(
        torus('lining', [0, y, 0], Math.max(0.05, r - tube * 1.3), tube * 0.7, {
          rotation: rot,
          arc: 2 * Math.PI - gap,
          plan: false,
        }),
      );
    }
    // Seat cushion with a soft rim and a leaning back cushion.
    parts.push(cyl('lining', [0, seatY + 0.03, 0.02], R * 0.68, 0.07, { segments: 32, plan: false }));
    parts.push(ring('lining', [0, seatY + 0.03, 0.02], R * 0.68, 0.035, { plan: false }));
    parts.push(pillow('lining', [0, seatY + 0.28, -R * 0.5], R * 0.95, 0.4, 0.13, { lean: 0.25 }));
    return parts;
  },
  planDetail: ({ w, d }) => {
    const R = Math.min(w, d) / 2;
    return [circle([0, 0], R - 0.001), poly(ellipsePoints(0, 0.02, R * 0.68, R * 0.68, 24))];
  },
});

const papasan = defineAsset({
  id: 'chair-papasan',
  name: 'Papasan chair',
  category: 'living',
  type: 'seating',
  group: 'Living chairs',
  tags: ['papasan', 'bowl chair', 'rattan', 'wicker', 'boho', 'round chair'],
  defaultSize: { w: 1.1, d: 1.1, h: 0.85 },
  minSize: { w: 0.9, d: 0.9, h: 0.75 },
  maxSize: { w: 1.3, d: 1.3, h: 0.95 },
  slots: [matSlot('frame', 'Rattan frame', 'rattan-natural'), matSlot('cushion', 'Cushion', 'fabric-mustard')],
  build: ({ w, d, h }) => {
    const R = Math.min(w, d) / 2;
    const tube = 0.014;
    const tilt = 0.22;
    const baseH = clamp(h * 0.36, 0.26, 0.34);
    const rb = R * 0.42;
    const parts: Part[] = [];
    // Drum base with a waist and vertical canes.
    for (const i of range(5)) {
      const y = lerp(0.02, baseH - 0.02, i / 4);
      parts.push(ring('frame', [0, y, 0], rb * (1 - 0.14 * Math.sin((Math.PI * i) / 4)), 0.016, { plan: false }));
    }
    for (const k of range(8)) {
      const a = (k / 8) * Math.PI * 2;
      parts.push(
        ...rodPath(
          'frame',
          [
            [Math.cos(a) * rb, 0.02, Math.sin(a) * rb],
            [Math.cos(a) * rb * 0.86, baseH / 2, Math.sin(a) * rb * 0.86],
            [Math.cos(a) * rb, baseH - 0.02, Math.sin(a) * rb],
          ],
          0.008,
        ),
      );
    }
    // Bowl: rings stacked along an axis tipped back by `tilt`.
    const st = Math.sin(tilt);
    const ct = Math.cos(tilt);
    const D = Math.max(0.15, Math.min(0.36, (h - 0.04 - baseH - R * st) / ct));
    const z0 = (D * st) / 2;
    const rRim = R - tube - 0.05;
    const nRing = 7;
    const ringAt = (k: number) => {
      const s = k / (nRing - 1);
      const ax = s * D;
      return {
        c: [0, baseH + ax * ct, z0 - ax * st] as V3,
        r: lerp(rb * 0.8, rRim, Math.sqrt(s)),
      };
    };
    for (const k of range(nRing)) {
      const { c, r } = ringAt(k);
      parts.push(torus('frame', c, r, k === nRing - 1 ? 0.022 : tube, { rotation: [Math.PI / 2 + tilt, 0, 0], plan: k === nRing - 1 }));
    }
    for (const j of range(8)) {
      const phi = (j / 8) * Math.PI * 2 + Math.PI / 8;
      const pts = range(nRing).map((k) => {
        const { c, r } = ringAt(k);
        return [c[0] + r * Math.cos(phi), c[1] - r * Math.sin(phi) * st, c[2] + r * Math.sin(phi) * ct] as V3;
      });
      parts.push(...rodPath('frame', pts, 0.01));
    }
    // Big round cushion nestled in the bowl, with a centre button.
    const top = ringAt(nRing - 1);
    const cc: V3 = [0, top.c[1] - 0.06 * ct, top.c[2] + 0.06 * st];
    const cr = rRim - 0.02;
    parts.push(sphere('cushion', cc, 0.5, { scale: [2 * cr, 0.18, 2 * cr], rotation: [tilt, 0, 0], plan: false }));
    parts.push(sphere('cushion', [0, cc[1] + 0.09 * ct, cc[2] + 0.09 * st], 0.018, { rotation: [tilt, 0, 0], scale: [1, 0.5, 1], plan: false }));
    for (const k of range(6)) {
      const phi = (k / 6) * Math.PI * 2;
      const rr = cr * 0.5;
      const lift = 0.085;
      parts.push(
        sphere(
          'cushion',
          [rr * Math.cos(phi), cc[1] + lift * ct - rr * Math.sin(phi) * st, cc[2] + lift * st + rr * Math.sin(phi) * ct],
          0.014,
          { rotation: [tilt, 0, 0], scale: [1, 0.5, 1], plan: false },
        ),
      );
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const R = Math.min(w, d) / 2;
    return [circle([0, 0], R * 0.42), circle([0, 0], (R - 0.07) * 0.5)];
  },
});

const slipperChair = defineAsset({
  id: 'chair-slipper',
  name: 'Slipper accent chair',
  category: 'living',
  type: 'seating',
  group: 'Living chairs',
  tags: ['slipper chair', 'accent chair', 'armless', 'channel tufted', 'velvet', 'bedroom chair'],
  defaultSize: { w: 0.62, d: 0.72, h: 0.84 },
  minSize: { w: 0.55, d: 0.65, h: 0.78 },
  maxSize: { w: 0.75, d: 0.85, h: 0.95 },
  slots: [matSlot('upholstery', 'Upholstery', 'fabric-velvet-blush'), matSlot('legs', 'Legs', 'metal-brass')],
  build: ({ w, d, h }) => {
    const legH = 0.18;
    const seatTop = clamp(h * 0.5, 0.4, 0.46);
    const baseTop = seatTop - 0.08;
    const zb = -d / 2 + 0.14;
    const lean = 0.1;
    const parts: Part[] = [
      span('upholstery', [-w / 2 + 0.02, w / 2 - 0.02], [legH, baseTop], [zb - 0.05, d / 2 - 0.01], { bevel: 0.03 }),
      cushion('upholstery', [-w / 2 + 0.03, w / 2 - 0.03], [baseTop, seatTop], [zb, d / 2 - 0.005], { softness: 0.35, plan: false }),
      rodX('upholstery', -w / 2 + 0.07, w / 2 - 0.07, (baseTop + seatTop) / 2, d / 2 - 0.008, 0.005, { plan: false }),
      box('upholstery', [0, (legH + h - 0.03) / 2, -d / 2 + 0.085], [w - 0.04, h - 0.03 - legH, 0.08], {
        rotation: [-lean, 0, 0],
        bevel: 0.03,
      }),
    ];
    // Channel-tufted back: vertical channels wrapping slightly around the sitter.
    const k = clamp(Math.round((w - 0.06) / 0.1), 4, 8);
    const yb = baseTop - 0.02;
    for (const [xa, xb] of cellSpans(k, -w / 2 + 0.035, w / 2 - 0.035)) {
      const xc = (xa + xb) / 2;
      const f = xc / (w / 2);
      parts.push(
        box('upholstery', [xc, (yb + h - 0.015) / 2, -d / 2 + 0.11 + f * f * 0.05], [xb - xa - 0.006, h - 0.015 - yb, 0.1], {
          rotation: [-lean, -f * 0.35, 0],
          bevel: 0.035,
          plan: false,
        }),
      );
    }
    parts.push(pillow('upholstery', [0, seatTop + 0.12, zb + 0.12], w * 0.55, 0.22, 0.11, { lean: 0.2 }));
    for (const fx of [-1, 1]) {
      for (const fz of [-1, 1]) {
        const top: V3 = [fx * (w / 2 - 0.08), legH, fz > 0 ? d / 2 - 0.1 : -d / 2 + 0.12];
        const foot: V3 = [fx * (w / 2 - 0.04), 0, fz > 0 ? d / 2 - 0.05 : -d / 2 + 0.05];
        parts.push(rod('legs', foot, top, 0.011, { rTop: 0.02, plan: false }));
        parts.push(cyl('legs', [foot[0], 0.015, foot[2]], 0.014, 0.03, { plan: false }));
      }
    }
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w / 2 + 0.03, -d / 2 + 0.16], [w / 2 - 0.03, -d / 2 + 0.16])],
});

const beanBag = defineAsset({
  id: 'bean-bag',
  name: 'Bean bag',
  category: 'living',
  type: 'seating',
  group: 'Living chairs',
  tags: ['bean bag', 'beanbag', 'floor cushion', 'lounger', 'kids', 'gaming'],
  defaultSize: { w: 0.85, d: 0.85, h: 0.75 },
  minSize: { w: 0.6, d: 0.6, h: 0.55 },
  maxSize: { w: 1.2, d: 1.2, h: 0.95 },
  slots: [matSlot('fabric', 'Fabric', 'fabric-olive')],
  build: ({ w, d, h }) => {
    const R = w / 2;
    const sz = d / w;
    return [
      lathe(
        'fabric',
        [0, 0, 0],
        [
          [0, 0],
          [R * 0.85, 0],
          [R * 0.98, h * 0.12],
          [R * 0.96, h * 0.3],
          [R * 0.82, h * 0.45],
          [R * 0.5, h * 0.52],
          [0, h * 0.53],
        ],
        { scale: [1, 1, sz], segments: 36 },
      ),
      // Slumped back, seat dent and side lumps.
      sphere('fabric', [0, h * 0.6, -d * 0.17], 0.5, { scale: [w * 0.78, h * 0.76, d * 0.5], plan: false }),
      sphere('fabric', [0, h * 0.36, d * 0.12], 0.5, { scale: [w * 0.66, h * 0.36, d * 0.58], plan: false }),
      sphere('fabric', [-w * 0.27, h * 0.42, d * 0.02], 0.5, { scale: [w * 0.42, h * 0.5, d * 0.62], plan: false }),
      sphere('fabric', [w * 0.27, h * 0.42, d * 0.02], 0.5, { scale: [w * 0.42, h * 0.5, d * 0.62], plan: false }),
      ring('fabric', [0, h * 0.1, 0], R * 0.95, 0.006, { zScale: sz, plan: false }),
      // Carry handle at the top of the back.
      torus('fabric', [0, h * 0.9, -d * 0.36], 0.045, 0.01, { rotation: [-0.5, Math.PI / 2, 0], arc: Math.PI, plan: false }),
    ];
  },
  planDetail: ({ w, d }) => [poly(ellipsePoints(0, d * 0.1, w * 0.3, d * 0.25, 24))],
});

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

const coffeeRect = defineAsset({
  id: 'coffee-table',
  name: 'Coffee table',
  category: 'living',
  type: 'surfaces',
  group: 'Coffee tables',
  tags: ['table', 'coffee table', 'low table', 'rectangular'],
  defaultSize: { w: 1.2, d: 0.6, h: 0.4 },
  minSize: { w: 0.6, d: 0.4, h: 0.25 },
  maxSize: { w: 2.0, d: 1.2, h: 0.55 },
  slots: [matSlot('top', 'Top & shelf', 'wood-oak-light'), matSlot('legs', 'Frame', 'metal-black-matte')],
  build: ({ w, d, h }) => {
    const t = 0.03;
    const leg = 0.04;
    const inset = 0.04;
    const ox = w / 2 - inset;
    const oz = d / 2 - inset;
    const shelfY = Math.min(0.1, h * 0.3);
    const ry: V2 = [h - t - 0.03, h - t];
    const o = { plan: false };
    const parts: Part[] = [
      span('top', [-w / 2, w / 2], [h - t, h], [-d / 2, d / 2], { bevel: 0.008 }),
      ...legs4('legs', w, d, inset, 0, h - t, leg),
      span('legs', [-ox + leg, ox - leg], ry, [oz - 0.015, oz], o),
      span('legs', [-ox + leg, ox - leg], ry, [-oz, -oz + 0.015], o),
      span('legs', [-ox, -ox + 0.015], ry, [-oz + leg, oz - leg], o),
      span('legs', [ox - 0.015, ox], ry, [-oz + leg, oz - leg], o),
      span('legs', [-ox + leg, ox - leg], [shelfY - 0.02, shelfY], [oz - leg, oz - leg + 0.015], o),
      span('legs', [-ox + leg, ox - leg], [shelfY - 0.02, shelfY], [-oz + leg - 0.015, -oz + leg], o),
      ...slats('top', [-ox + leg, ox - leg], [shelfY, shelfY + 0.018], [-oz + 0.005, oz - 0.005], clamp(Math.round((2 * oz) / 0.07), 3, 14), {
        axis: 'z',
        gap: 0.18,
        bevel: 0.003,
        plan: false,
      }),
    ];
    // Metal tray with two wooden coasters on the top.
    const tw = Math.min(0.34, w * 0.32);
    const td = Math.min(0.22, d * 0.45);
    const tx = w * 0.18;
    parts.push(span('legs', [tx - tw / 2, tx + tw / 2], [h, h + 0.004], [-td / 2, td / 2], o));
    parts.push(
      ...[
        span('legs', [tx - tw / 2, tx + tw / 2], [h, h + 0.016], [td / 2 - 0.004, td / 2], o),
        span('legs', [tx - tw / 2, tx + tw / 2], [h, h + 0.016], [-td / 2, -td / 2 + 0.004], o),
        span('legs', [tx - tw / 2, tx - tw / 2 + 0.004], [h, h + 0.016], [-td / 2, td / 2], o),
        span('legs', [tx + tw / 2 - 0.004, tx + tw / 2], [h, h + 0.016], [-td / 2, td / 2], o),
      ],
    );
    for (const cx of [tx - tw * 0.22, tx + tw * 0.22]) parts.push(cyl('top', [cx, h + 0.009, 0], Math.min(0.045, td * 0.3), 0.01, o));
    // Lidded wooden box on the lower shelf.
    const boxH = Math.min(0.12, h - t - 0.03 - (shelfY + 0.018) - 0.02);
    if (boxH > 0.04) {
      const bx = -w * 0.2;
      const bw = Math.min(0.3, w * 0.25);
      const bd = Math.min(0.22, d * 0.5);
      const y0 = shelfY + 0.018;
      parts.push(span('top', [bx - bw / 2, bx + bw / 2], [y0, y0 + boxH * 0.75], [-bd / 2, bd / 2], { bevel: 0.004, plan: false }));
      parts.push(span('top', [bx - bw / 2 - 0.004, bx + bw / 2 + 0.004], [y0 + boxH * 0.75, y0 + boxH], [-bd / 2 - 0.004, bd / 2 + 0.004], { bevel: 0.004, plan: false }));
      parts.push(...knob('legs', [bx, y0 + boxH * 0.4, bd / 2], 0.008));
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const tw = Math.min(0.34, w * 0.32);
    const td = Math.min(0.22, d * 0.45);
    const tx = w * 0.18;
    return [rectPoly(tx - tw / 2, -td / 2, tx + tw / 2, td / 2)];
  },
});

const coffeeRound = defineAsset({
  id: 'coffee-table-round',
  name: 'Round coffee table',
  category: 'living',
  type: 'surfaces',
  group: 'Coffee tables',
  tags: ['table', 'coffee table', 'round', 'low table'],
  defaultSize: { w: 0.9, d: 0.9, h: 0.38 },
  minSize: { w: 0.5, d: 0.5, h: 0.25 },
  maxSize: { w: 1.4, d: 1.4, h: 0.5 },
  slots: [matSlot('top', 'Top', 'wood-walnut'), matSlot('legs', 'Legs & shelf', 'wood-walnut')],
  build: ({ w, d, h }) => {
    const r = w / 2;
    const sz = d / w;
    const t = 0.035;
    const apron = 0.05;
    const shelfY = Math.min(0.1, h * 0.28);
    const o = { plan: false };
    const parts: Part[] = [
      cyl('top', [0, h - t / 2, 0], r - t / 2, t, { scale: [1, 1, sz], segments: 48 }),
      ring('top', [0, h - t / 2, 0], r - t / 2, t / 2, { zScale: sz, plan: false }),
      cyl('legs', [0, h - t - apron / 2, 0], r * 0.72, apron, { scale: [1, 1, sz], segments: 40, plan: false }),
      cyl('legs', [0, shelfY + 0.009, 0], r * 0.62, 0.018, { scale: [1, 1, sz], segments: 40, plan: false }),
    ];
    const nLegs = w > 1.0 ? 4 : 3;
    for (const k of range(nLegs)) {
      const a = Math.PI / 2 + (k * 2 * Math.PI) / nLegs;
      parts.push(turnedLeg('legs', Math.cos(a) * r * 0.66, Math.sin(a) * r * 0.66 * sz, 0, h - t - apron, 0.026, { style: 'taper' }));
    }
    // Turned bowl of wooden balls on the shelf, if there is room.
    const room = h - t - apron - (shelfY + 0.018);
    if (room > 0.08) {
      const br = Math.min(0.1, r * 0.3);
      const y0 = shelfY + 0.018;
      parts.push(lathe('legs', [0, y0, 0], bowlProfile(br, 0.05), { segments: 28, ...o }));
      for (const k of range(3)) {
        const a = (k * 2 * Math.PI) / 3;
        parts.push(sphere('top', [Math.cos(a) * br * 0.35, y0 + 0.05, Math.sin(a) * br * 0.35], 0.025, o));
      }
    }
    return parts;
  },
  planDetail: ({ w, d }) => [poly(ellipsePoints(0, 0, w / 2 - 0.035, d / 2 - 0.035, 40))],
});

const sideTable = defineAsset({
  id: 'side-table',
  name: 'Side table',
  category: 'living',
  type: 'surfaces',
  group: 'End tables',
  tags: ['table', 'end table', 'side table', 'pedestal', 'round'],
  defaultSize: { w: 0.45, d: 0.45, h: 0.55 },
  minSize: { w: 0.3, d: 0.3, h: 0.35 },
  maxSize: { w: 0.7, d: 0.7, h: 0.75 },
  slots: [matSlot('top', 'Top', 'stone-marble-carrara'), matSlot('base', 'Base', 'metal-black-matte')],
  build: ({ w, d, h }) => {
    const R = w / 2;
    const sz: V3 = [1, 1, d / w];
    const o = { scale: sz, segments: 40, plan: false };
    return [
      lathe(
        'top',
        [0, h - 0.026, 0],
        [
          [0, 0],
          [R - 0.012, 0],
          [R, 0.008],
          [R, 0.02],
          [R - 0.006, 0.026],
          [0, 0.026],
        ],
        { scale: sz, segments: 48 },
      ),
      cyl('base', [0, h - 0.032, 0], R * 0.42, 0.012, o),
      vcyl('base', 0, 0, 0.03, h - 0.038, 0.02, { plan: false }),
      cyl('base', [0, h - 0.07, 0], 0.03, 0.025, { plan: false }),
      cyl('base', [0, 0.07, 0], 0.03, 0.025, { plan: false }),
      lathe(
        'base',
        [0, 0, 0],
        [
          [0, 0],
          [w * 0.36, 0],
          [w * 0.36, 0.008],
          [w * 0.3, 0.02],
          [0.05, 0.032],
          [0, 0.032],
        ],
        o,
      ),
    ];
  },
  planDetail: ({ w, d }) => [poly(ellipsePoints(0, 0, w / 2 - 0.012, d / 2 - 0.012, 32))],
});

const nestingTables = defineAsset({
  id: 'tables-nesting',
  name: 'Nesting side tables',
  category: 'living',
  type: 'surfaces',
  group: 'End tables',
  tags: ['nesting tables', 'side table', 'end table', 'set', 'stacking tables'],
  defaultSize: { w: 0.6, d: 0.45, h: 0.55 },
  minSize: { w: 0.4, d: 0.3, h: 0.4 },
  maxSize: { w: 1.2, d: 0.6, h: 0.7 },
  slots: [
    matSlot('top', 'Tops', 'wood-walnut'),
    matSlot('frame', 'Frames', 'metal-brass'),
    matSlot('decor', 'Ceramics', 'ceramic-sage'),
    matSlot('books', 'Books', 'book-mix'),
  ],
  build: ({ w, d, h }) => {
    const n = w >= 0.9 ? 3 : 2;
    const tt = 0.018;
    const lt = 0.016;
    const d0 = d * (n === 3 ? 0.7 : 0.78);
    const parts: Part[] = [];
    const o = { plan: false };
    const tbl: { x: V2; z: V2; h: number }[] = [];
    for (const i of range(n)) {
      const wi = w * (1 - 0.16 * i);
      const di = d0 * (1 - 0.08 * i);
      const hi = h * (1 - 0.12 * i);
      const zFront = -d / 2 + d0 + (i * (d - d0)) / (n - 1);
      const cx = -i * w * 0.03;
      const x: V2 = [cx - wi / 2, cx + wi / 2];
      const z: V2 = [zFront - di, zFront];
      tbl.push({ x, z, h: hi });
      parts.push(span('top', x, [hi - tt, hi], z, { bevel: 0.006 }));
      for (const lx of [x[0] + 0.01, x[1] - 0.01 - lt]) {
        for (const lz of [z[0] + 0.01, z[1] - 0.01 - lt]) {
          parts.push(span('frame', [lx, lx + lt], [0, hi - tt], [lz, lz + lt], o));
        }
        // Side rails under the top leave the front open so the next table slides in.
        parts.push(span('frame', [lx, lx + lt], [hi - tt - 0.025, hi - tt], [z[0] + 0.01, z[1] - 0.01], o));
      }
    }
    // Story details: a book and a dish on the biggest top, a candle on the smallest.
    const big = tbl[0];
    const bx = big.x[0] + (big.x[1] - big.x[0]) * 0.3;
    const bz = (big.z[0] + big.z[1]) / 2;
    parts.push(box('books', [bx, big.h + 0.008, bz], [Math.min(0.2, w * 0.3), 0.016, Math.min(0.14, d * 0.3)], { rotation: [0, 0.2, 0], plan: false }));
    parts.push(lathe('decor', [big.x[1] - 0.09, big.h, bz], bowlProfile(0.05, 0.016), { segments: 24, plan: false }));
    const small = tbl[n - 1];
    const prev = tbl[n - 2];
    const strip = small.z[1] - prev.z[1];
    const room = h - small.h;
    if (strip > 0.06 && room > 0.04) {
      parts.push(
        lathe('decor', [small.x[0] + 0.07, small.h, (small.z[1] + prev.z[1]) / 2], vaseProfile(Math.min(0.035, strip * 0.4), Math.min(0.09, room)), {
          segments: 20,
          plan: false,
        }),
      );
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const n = w >= 0.9 ? 3 : 2;
    const d0 = d * (n === 3 ? 0.7 : 0.78);
    return range(n - 1).map((i) => {
      const z = -d / 2 + d0 + (i * (d - d0)) / (n - 1);
      return line([-w / 2 + 0.02, z], [w / 2 - 0.02, z]);
    });
  },
});

const consoleTable = defineAsset({
  id: 'console-table',
  name: 'Console table',
  category: 'living',
  type: 'surfaces',
  group: 'Console tables',
  tags: ['console', 'hall table', 'sofa table', 'entry table', 'narrow table', 'drawers'],
  defaultSize: { w: 1.2, d: 0.35, h: 0.8 },
  minSize: { w: 0.7, d: 0.25, h: 0.7 },
  maxSize: { w: 2.0, d: 0.5, h: 0.9 },
  wallSnap: true,
  slots: [
    matSlot('top', 'Wood', 'wood-oak-light'),
    matSlot('frame', 'Frame & knobs', 'metal-black-matte'),
    matSlot('decor', 'Ceramics', 'ceramic-white'),
    matSlot('books', 'Books', 'book-mix'),
  ],
  build: ({ w, d, h }) => {
    const tt = 0.03;
    const lt = 0.035;
    const apH = Math.min(0.12, h * 0.15);
    const shelfY = Math.min(0.16, h * 0.2);
    const ox = w / 2 - 0.02;
    const oz = d / 2 - 0.02;
    const o = { plan: false };
    const yA = h - tt - apH;
    const parts: Part[] = [
      span('top', [-w / 2, w / 2], [h - tt, h], [-d / 2, d / 2], { bevel: 0.006 }),
      ...legs4('frame', w, d, 0.02, 0, h - tt, lt),
      span('top', [-ox + lt, ox - lt], [yA, h - tt], [-oz + 0.01, oz - 0.012], o),
      span('top', [-ox, ox], [shelfY, shelfY + 0.022], [-oz, oz], o),
      span('frame', [-ox + lt, ox - lt], [shelfY - 0.025, shelfY], [oz - lt, oz - lt + 0.012], o),
      span('frame', [-ox + lt, ox - lt], [shelfY - 0.025, shelfY], [-oz + lt - 0.012, -oz + lt], o),
    ];
    const nd = w > 1.7 ? 3 : w > 0.95 ? 2 : 1;
    for (const [xa, xb] of cellSpans(nd, -ox + lt, ox - lt)) {
      parts.push(span('top', [xa + 0.004, xb - 0.004], [yA + 0.008, h - tt - 0.006], [oz - 0.012, oz], o));
      parts.push(...knob('frame', [(xa + xb) / 2, (yA + h - tt) / 2, oz], 0.012));
    }
    // Lower shelf styling: a vase of dried branches, a stack of books and a bowl.
    const y0 = shelfY + 0.022;
    const room = yA - y0 - 0.03;
    const vx = -w * 0.28;
    const vh = Math.min(0.26, room * 0.55);
    parts.push(lathe('decor', [vx, y0, 0], vaseProfile(Math.min(0.065, oz * 0.6), vh), { segments: 24, ...o }));
    const stem = room - vh;
    for (const k of range(3)) {
      const a = -0.35 + k * 0.35;
      parts.push(rod('frame', [vx, y0 + vh - 0.02, 0], [vx + Math.sin(a) * stem * 0.5, y0 + vh + stem * 0.92, Math.cos(a * 3) * 0.02], 0.003, o));
    }
    const bd = Math.min(0.17, 2 * oz - 0.06);
    const books = bookStack('books', w * 0.2, 0, y0, Math.min(0.26, w * 0.22), bd, 3, 7);
    parts.push(...books);
    const by = books.reduce((m, p) => Math.max(m, p.position[1]), y0) + 0.02;
    parts.push(lathe('decor', [w * 0.2, by, 0], bowlProfile(Math.min(0.08, bd * 0.45), 0.045), { segments: 24, ...o }));
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w / 2 + 0.06, d / 2 - 0.03], [w / 2 - 0.06, d / 2 - 0.03])],
});

const coffeeTrunk = defineAsset({
  id: 'coffee-table-trunk',
  name: 'Trunk coffee table',
  category: 'living',
  type: 'surfaces',
  group: 'Coffee tables',
  tags: ['trunk', 'chest', 'coffee table', 'storage', 'vintage', 'steamer trunk'],
  defaultSize: { w: 1.0, d: 0.55, h: 0.45 },
  minSize: { w: 0.7, d: 0.4, h: 0.35 },
  maxSize: { w: 1.4, d: 0.8, h: 0.55 },
  slots: [
    matSlot('body', 'Wood', 'wood-dark-stain'),
    matSlot('strap', 'Leather straps', 'leather-tan'),
    matSlot('metal', 'Brass fittings', 'metal-brass'),
  ],
  build: ({ w, d, h }) => {
    const feetH = 0.05;
    const lidH = clamp(h * 0.16, 0.05, 0.09);
    const yl = h - lidH;
    const zf = d / 2;
    const o = { plan: false };
    const parts: Part[] = [
      span('body', [-w / 2 + 0.01, w / 2 - 0.01], [feetH, yl], [-d / 2 + 0.01, zf - 0.01], { bevel: 0.006 }),
      span('body', [-w / 2, w / 2], [yl, h - 0.004], [-d / 2, zf], { bevel: 0.01 }),
    ];
    // Wooden battens around the body.
    for (const y of [feetH + 0.03, (feetH + yl) / 2]) {
      parts.push(span('body', [-w / 2 + 0.012, w / 2 - 0.012], [y, y + 0.03], [zf - 0.012, zf - 0.003], o));
      parts.push(span('body', [-w / 2 + 0.012, w / 2 - 0.012], [y, y + 0.03], [-zf + 0.003, -zf + 0.012], o));
    }
    // Leather straps over the lid and down the front, with brass buckles.
    for (const sx of [-w * 0.27, w * 0.27]) {
      const x: V2 = [sx - 0.025, sx + 0.025];
      parts.push(span('strap', x, [h - 0.006, h], [-d / 2 + 0.002, zf - 0.002], o));
      parts.push(span('strap', x, [yl, h], [zf - 0.002, zf + 0.004], o));
      parts.push(span('strap', x, [feetH + 0.02, yl], [zf - 0.012, zf - 0.004], o));
      parts.push(span('strap', x, [feetH + 0.02, h], [-zf + 0.004, -zf + 0.012], o));
      parts.push(span('metal', [sx - 0.032, sx + 0.032], [yl - 0.07, yl - 0.03], [zf - 0.006, zf - 0.001], o));
    }
    // Brass corner caps, latch and side handles.
    for (const fx of [-1, 1]) {
      for (const fz of [-1, 1]) {
        const x: V2 = fx < 0 ? [-w / 2 - 0.002, -w / 2 + 0.045] : [w / 2 - 0.045, w / 2 + 0.002];
        const z: V2 = fz < 0 ? [-zf - 0.002, -zf + 0.045] : [zf - 0.045, zf + 0.002];
        parts.push(span('metal', x, [h - 0.045, h - 0.002], z, { bevel: 0.004, plan: false }));
        parts.push(span('metal', [x[0] + fx * 0.0, x[1]], [feetH, feetH + 0.045], [z[0], z[1]], { bevel: 0.004, plan: false }));
        parts.push(turnedLeg('metal', fx * (w / 2 - 0.05), fz * (zf - 0.05), 0, feetH, 0.03, { style: 'bun' }));
      }
      parts.push(
        torus('strap', [fx * (w / 2 - 0.004), (feetH + yl) / 2 + 0.05, 0], 0.06, 0.009, {
          rotation: [0, Math.PI / 2, Math.PI],
          arc: Math.PI,
          plan: false,
        }),
      );
      for (const pz of [-0.06, 0.06]) {
        parts.push(span('metal', [fx * (w / 2 - 0.006) - 0.004, fx * (w / 2 - 0.006) + 0.004], [(feetH + yl) / 2 + 0.035, (feetH + yl) / 2 + 0.065], [pz - 0.02, pz + 0.02], o));
      }
    }
    parts.push(span('metal', [-0.04, 0.04], [yl - 0.055, yl + 0.025], [zf - 0.002, zf + 0.004], o));
    parts.push(sphere('metal', [0, yl - 0.03, zf + 0.006], 0.008, o));
    return parts;
  },
  planDetail: ({ w, d }) =>
    [-w * 0.27, w * 0.27].flatMap((sx) => [line([sx - 0.025, -d / 2], [sx - 0.025, d / 2]), line([sx + 0.025, -d / 2], [sx + 0.025, d / 2])]),
});

const coffeeGlass = defineAsset({
  id: 'coffee-table-glass',
  name: 'Glass coffee table',
  category: 'living',
  type: 'surfaces',
  group: 'Coffee tables',
  tags: ['glass', 'coffee table', 'brass', 'modern', 'low table', 'shelf'],
  defaultSize: { w: 1.1, d: 0.6, h: 0.4 },
  minSize: { w: 0.7, d: 0.45, h: 0.3 },
  maxSize: { w: 1.6, d: 1.0, h: 0.5 },
  slots: [
    matSlot('glass', 'Glass', 'glass-clear'),
    matSlot('frame', 'Frame', 'metal-brass'),
    matSlot('books', 'Books', 'book-mix'),
    matSlot('decor', 'Ceramics', 'ceramic-black'),
  ],
  build: ({ w, d, h }) => {
    const r = 0.01;
    const gt = 0.012;
    const shelfY = Math.min(0.12, h * 0.3);
    const ox = w / 2;
    const oz = d / 2;
    const o = { plan: false };
    const parts: Part[] = [span('glass', [-w / 2, w / 2], [h - gt, h], [-d / 2, d / 2])];
    // Square-tube cage: posts plus rails at the floor, shelf and top.
    for (const fx of [-1, 1]) {
      for (const fz of [-1, 1]) {
        const x = fx * (ox - r);
        const z = fz * (oz - r);
        parts.push(span('frame', [x - r, x + r], [0, h - gt], [z - r, z + r], o));
      }
    }
    for (const y of [0, shelfY, h - gt - 2 * r]) {
      parts.push(span('frame', [-ox + 2 * r, ox - 2 * r], [y, y + 2 * r], [oz - 2 * r, oz], o));
      parts.push(span('frame', [-ox + 2 * r, ox - 2 * r], [y, y + 2 * r], [-oz, -oz + 2 * r], o));
      parts.push(span('frame', [-ox, -ox + 2 * r], [y, y + 2 * r], [-oz + 2 * r, oz - 2 * r], o));
      parts.push(span('frame', [ox - 2 * r, ox], [y, y + 2 * r], [-oz + 2 * r, oz - 2 * r], o));
    }
    const sy = shelfY + 2 * r;
    parts.push(span('glass', [-ox + 2 * r, ox - 2 * r], [sy, sy + 0.008], [-oz + 2 * r, oz - 2 * r], o));
    // Styling on the shelf: books, a bowl and a sphere; a small dish on top.
    const y0 = sy + 0.008;
    const room = h - gt - 2 * r - y0;
    const books = bookStack('books', -w * 0.22, 0, y0, Math.min(0.28, w * 0.25), Math.min(0.2, d * 0.4), room > 0.13 ? 3 : 2, 3);
    parts.push(...books);
    const br = Math.min(0.11, d * 0.2);
    parts.push(lathe('decor', [w * 0.18, y0, -0.02], bowlProfile(br, Math.min(0.07, room * 0.6)), { segments: 28, ...o }));
    const sr = Math.min(0.05, room * 0.4);
    parts.push(sphere('decor', [w * 0.18 + br + sr + 0.03, y0 + sr, 0.03], sr, o));
    parts.push(lathe('decor', [-w * 0.18, h, 0.04], bowlProfile(0.06, 0.014), { segments: 24, ...o }));
    return parts;
  },
  planDetail: ({ w, d }) => [rectPoly(-w / 2 + 0.02, -d / 2 + 0.02, w / 2 - 0.02, d / 2 - 0.02)],
});

// ---------------------------------------------------------------------------
// Storage & accents
// ---------------------------------------------------------------------------

const mediaConsole = defineAsset({
  id: 'media-console',
  name: 'Media console / TV unit',
  category: 'living',
  type: 'storage',
  group: 'Media units',
  tags: ['tv unit', 'tv stand', 'console', 'media', 'low cabinet', 'entertainment'],
  defaultSize: { w: 1.8, d: 0.42, h: 0.5 },
  minSize: { w: 1.0, d: 0.3, h: 0.35 },
  maxSize: { w: 3.0, d: 0.6, h: 0.8 },
  wallSnap: true,
  slots: [matSlot('body', 'Body', 'wood-walnut'), matSlot('legs', 'Legs & pulls', 'metal-black-matte')],
  build: ({ w, d, h }) => {
    const legH = Math.min(0.12, h * 0.25);
    const pt = 0.018;
    const ft = 0.018;
    const zFace = d / 2 - ft - 0.012;
    const zb = -d / 2;
    const yb = legH;
    const yt = h - pt;
    const n = clamp(Math.round(w / 0.45), 2, 6);
    const openIdx = n >= 3 ? Math.floor(n / 2) : -1;
    const o = { plan: false };
    const parts: Part[] = [
      span('body', [-w / 2, w / 2], [yt, h], [zb, d / 2], { bevel: 0.004 }),
      span('body', [-w / 2, w / 2], [yb, yb + pt], [zb, zFace], o),
      span('body', [-w / 2, -w / 2 + pt], [yb, yt], [zb, zFace + ft], o),
      span('body', [w / 2 - pt, w / 2], [yb, yt], [zb, zFace + ft], o),
      span('body', [-w / 2 + pt, w / 2 - pt], [yb + pt, yt], [zb, zb + 0.008], o),
      ...legs4('legs', w, d, 0.06, 0, legH, 0.03),
    ];
    if (w > 2.0) {
      for (const z of [-d / 2 + 0.06 + 0.015, d / 2 - 0.06 - 0.015]) {
        parts.push(span('legs', [-0.015, 0.015], [0, legH], [z - 0.015, z + 0.015], o));
      }
    }
    const cs = cellSpans(n, -w / 2 + pt, w / 2 - pt);
    for (const [i, [xa, xb]] of cs.entries()) {
      if (i > 0) parts.push(span('body', [xa - pt / 2, xa + pt / 2], [yb + pt, yt], [zb + 0.008, zFace], o));
      const xc = (xa + xb) / 2;
      if (i === openIdx) {
        const ym = (yb + pt + yt) / 2;
        parts.push(span('body', [xa + pt / 2, xb - pt / 2], [ym - 0.009, ym + 0.009], [zb + 0.008, zFace - 0.01], o));
        // Games console below the shelf.
        const cw = Math.min(0.15, (xb - xa) * 0.35);
        const cd = Math.min(0.25, d - 0.14);
        parts.push(span('legs', [xc - cw, xc + cw], [yb + pt, yb + pt + 0.05], [zb + 0.04, zb + 0.04 + cd], { bevel: 0.006, plan: false }));
        continue;
      }
      parts.push(span('body', [xa + 0.002, xb - 0.002], [yb + 0.002, yt - 0.002], [zFace, zFace + ft], o));
      // Reeded door face.
      const nR = clamp(Math.round((xb - xa) / 0.045), 4, 10);
      parts.push(
        ...slats('body', [xa + 0.012, xb - 0.012], [yb + 0.02, yt - 0.02], [zFace + ft, zFace + ft + 0.008], nR, {
          axis: 'x',
          gap: 0.25,
          bevel: 0.003,
          plan: false,
        }),
      );
      const px = i < n / 2 ? xb - 0.025 : xa + 0.025;
      const len = Math.min(0.12, (yt - yb) * 0.5);
      const pm = (yb + yt) / 2;
      parts.push(span('legs', [px - 0.006, px + 0.006], [pm - len / 2, pm + len / 2], [zFace + ft, zFace + ft + 0.012], o));
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const n = clamp(Math.round(w / 0.45), 2, 6);
    const zf = d / 2 - 0.03;
    return [
      line([-w / 2, zf], [w / 2, zf]),
      ...cellSpans(n, -w / 2, w / 2)
        .slice(1)
        .map(([x]) => line([x, zf], [x, d / 2])),
    ];
  },
});

const bookcase = defineAsset({
  id: 'bookcase',
  name: 'Bookcase',
  category: 'living',
  type: 'storage',
  group: 'Bookcases & shelves',
  tags: ['bookshelf', 'shelves', 'books', 'library', 'storage'],
  defaultSize: { w: 0.9, d: 0.32, h: 1.9 },
  minSize: { w: 0.4, d: 0.22, h: 0.6 },
  maxSize: { w: 1.8, d: 0.5, h: 2.6 },
  wallSnap: true,
  slots: [matSlot('frame', 'Frame', 'wood-oak-light'), matSlot('books', 'Books', 'book-mix')],
  build: ({ w, d, h }) => {
    const t = 0.025;
    const base = 0.08;
    const xi: V2 = [-w / 2 + t, w / 2 - t];
    const o = { plan: false };
    const parts: Part[] = [
      span('frame', [-w / 2, -w / 2 + t], [0, h - t], [-d / 2, d / 2]),
      span('frame', [w / 2 - t, w / 2], [0, h - t], [-d / 2, d / 2]),
      span('frame', [-w / 2, w / 2], [h - t, h], [-d / 2, d / 2], { bevel: 0.004 }),
      span('frame', xi, [0, base - 0.015], [-d / 2, d / 2 - 0.02], o),
      span('frame', xi, [base - 0.015, base], [-d / 2, d / 2 - 0.005], o),
      span('frame', xi, [base, h - t], [-d / 2, -d / 2 + 0.01], o),
    ];
    const inner = h - t - base;
    const n = clamp(Math.round(inner / 0.36), 1, 8);
    const compH = inner / n;
    const innerW = w - 2 * t;
    const bookD = Math.min(0.22, d - 0.05);
    const zBack = -d / 2 + 0.012;
    const budget = Math.floor(108 / n);
    const limitW = Math.max(0.05, (budget - 3) * 0.0315);
    for (let k = 0; k < n; k++) {
      const yb = base + k * compH;
      if (k > 0) parts.push(span('frame', xi, [yb - t / 2, yb + t / 2], [-d / 2 + 0.01, d / 2 - 0.005], o));
      const y0 = yb + (k > 0 ? t / 2 : 0);
      const yClear = k === n - 1 ? h - t : yb + compH - t / 2;
      const maxH = Math.min(0.28, yClear - y0 - 0.015);
      if (maxH < 0.06) continue;
      const seed = 11 + k * 7;
      const style = k % 3;
      if (style === 0) {
        const rowW = Math.min(innerW * 0.62, limitW);
        parts.push(...bookRow('books', [xi[0] + 0.01, xi[0] + 0.01 + rowW], y0, zBack, maxH, bookD, seed, { lean: true }));
        if (innerW > 0.45) {
          parts.push(lathe('frame', [xi[1] - 0.09, y0, zBack + bookD / 2], vaseProfile(0.05, Math.min(0.2, maxH * 0.8)), { segments: 20, ...o }));
        }
      } else if (style === 1) {
        const stackW = Math.min(0.24, innerW * 0.4);
        parts.push(...bookStack('books', xi[0] + 0.02 + stackW / 2, zBack + bookD / 2, y0, stackW, bookD * 0.9, maxH > 0.15 ? 4 : 2, seed));
        const x0 = xi[0] + stackW + 0.05;
        parts.push(...bookRow('books', [x0, Math.min(xi[1] - 0.01, x0 + limitW)], y0, zBack, maxH, bookD, seed));
      } else {
        parts.push(...bookRow('books', [xi[0] + 0.01, xi[0] + 0.01 + Math.min(innerW * 0.85, limitW)], y0, zBack, maxH, bookD, seed, { lean: true }));
        if (innerW > 0.45) parts.push(sphere('frame', [xi[1] - 0.06, y0 + 0.04, zBack + bookD / 2], 0.04, o));
      }
    }
    return parts;
  },
});

const wallShelf = defineAsset({
  id: 'wall-shelf',
  name: 'Floating wall shelf',
  category: 'living',
  type: 'storage',
  group: 'Bookcases & shelves',
  tags: ['shelf', 'ledge', 'wall shelf', 'bracket shelf'],
  defaultSize: { w: 0.9, d: 0.24, h: 0.2 },
  minSize: { w: 0.3, d: 0.12, h: 0.06 },
  maxSize: { w: 2.4, d: 0.4, h: 0.4 },
  mount: 'wall',
  defaultElevation: 1.2,
  slots: [matSlot('board', 'Board', 'wood-oak-light'), matSlot('bracket', 'Brackets', 'metal-black-matte')],
  build: ({ w, d, h }) => {
    const bt = 0.035;
    const bh = h - bt;
    const o = { plan: false };
    const parts: Part[] = [
      span('board', [-w / 2, w / 2], [h - bt, h], [-d / 2, d / 2], { bevel: 0.004 }),
      span('board', [-w / 2 + 0.01, w / 2 - 0.01], [h - bt - 0.006, h - bt], [d / 2 - 0.02, d / 2 - 0.005], o),
    ];
    const inset = Math.min(0.12, w * 0.2);
    for (const bx of [-w / 2 + inset, w / 2 - inset]) {
      parts.push(span('bracket', [bx - 0.015, bx + 0.015], [0, bh], [-d / 2, -d / 2 + 0.006], o));
      parts.push(span('bracket', [bx - 0.015, bx + 0.015], [bh - 0.008, bh], [-d / 2, -d / 2 + d * 0.8], o));
      if (bh > 0.06) {
        parts.push(rod('bracket', [bx, bh * 0.2, -d / 2 + 0.006], [bx, bh - 0.008, -d / 2 + d * 0.55], 0.005, o));
      }
      for (const y of [bh * 0.25, bh * 0.7]) parts.push(sphere('bracket', [bx, y, -d / 2 + 0.007], 0.005, { scale: [1, 1, 0.5], plan: false }));
    }
    return parts;
  },
});

const pouf = defineAsset({
  id: 'pouf-round',
  name: 'Round pouf',
  category: 'living',
  type: 'seating',
  group: 'Ottomans & poufs',
  tags: ['pouf', 'footstool', 'ottoman', 'seat', 'round'],
  defaultSize: { w: 0.5, d: 0.5, h: 0.42 },
  minSize: { w: 0.35, d: 0.35, h: 0.25 },
  maxSize: { w: 0.9, d: 0.9, h: 0.55 },
  slots: [matSlot('upholstery', 'Upholstery', 'rug-jute')],
  build: ({ w, d, h }) => {
    const R = w / 2;
    const zs = d / w;
    const sz: V3 = [1, 1, zs];
    const o = { plan: false };
    const parts: Part[] = [
      lathe(
        'upholstery',
        [0, 0, 0],
        [
          [0, 0],
          [R * 0.86, 0],
          [R * 0.97, h * 0.14],
          [R, h * 0.5],
          [R * 0.97, h * 0.86],
          [R * 0.86, h],
          [0, h],
        ],
        { scale: sz, segments: 40 },
      ),
      ring('upholstery', [0, h * 0.5, 0], R - 0.006, 0.006, { zScale: zs, plan: false }),
      ring('upholstery', [0, h - 0.012, 0], R * 0.9, 0.007, { zScale: zs, plan: false }),
      ring('upholstery', [0, 0.012, 0], R * 0.9, 0.007, { zScale: zs, plan: false }),
      ring('upholstery', [0, h - 0.002, 0], R * 0.45, 0.004, { zScale: zs, plan: false }),
      sphere('upholstery', [0, h, 0], 0.02, { scale: [1, 0.5, 1], plan: false }),
    ];
    // Embroidered star on the top.
    for (const k of range(8)) {
      const a = (k / 8) * Math.PI * 2;
      parts.push(rod('upholstery', [Math.cos(a) * 0.04, h - 0.002, Math.sin(a) * 0.04 * zs], [Math.cos(a) * R * 0.72, h - 0.002, Math.sin(a) * R * 0.72 * zs], 0.004, o));
    }
    return parts;
  },
  planDetail: ({ w, d }) => [poly(ellipsePoints(0, 0, w * 0.225, d * 0.225, 24))],
});

const ottoman = defineAsset({
  id: 'ottoman',
  name: 'Upholstered ottoman',
  category: 'living',
  type: 'seating',
  group: 'Ottomans & poufs',
  tags: ['ottoman', 'footstool', 'bench', 'footrest'],
  defaultSize: { w: 0.9, d: 0.6, h: 0.42 },
  minSize: { w: 0.4, d: 0.4, h: 0.3 },
  maxSize: { w: 1.6, d: 1.0, h: 0.55 },
  slots: [matSlot('upholstery', 'Upholstery', 'leather-cognac'), matSlot('legs', 'Legs', 'wood-walnut')],
  build: ({ w, d, h }) => {
    const legH = 0.08;
    const cush = Math.min(0.08, (h - legH) * 0.35);
    const yc = h - cush;
    const o = { plan: false };
    const parts: Part[] = [
      span('upholstery', [-w / 2 + 0.01, w / 2 - 0.01], [legH, yc], [-d / 2 + 0.01, d / 2 - 0.01], { bevel: 0.015 }),
      cushion('upholstery', [-w / 2, w / 2], [yc, h], [-d / 2, d / 2], { softness: 0.3 }),
      rodX('upholstery', -w / 2 + 0.03, w / 2 - 0.03, yc, d / 2 - 0.006, 0.006, o),
      rodX('upholstery', -w / 2 + 0.03, w / 2 - 0.03, yc, -d / 2 + 0.006, 0.006, o),
      rodZ('upholstery', -w / 2 + 0.006, yc, -d / 2 + 0.03, d / 2 - 0.03, 0.006, o),
      rodZ('upholstery', w / 2 - 0.006, yc, -d / 2 + 0.03, d / 2 - 0.03, 0.006, o),
      ...topButtons(
        'upholstery',
        [-w / 2 + 0.06, w / 2 - 0.06],
        [-d / 2 + 0.06, d / 2 - 0.06],
        h - 0.003,
        clamp(Math.round(w / 0.2), 2, 7),
        clamp(Math.round(d / 0.2), 2, 5),
        0.012,
        true,
      ),
    ];
    for (const fx of [-1, 1]) {
      for (const fz of [-1, 1]) {
        parts.push(turnedLeg('legs', fx * (w / 2 - 0.05), fz * (d / 2 - 0.05), 0, legH, 0.022, { style: 'taper' }));
      }
    }
    return parts;
  },
  planDetail: ({ w, d }) => [rectPoly(-w / 2 + 0.03, -d / 2 + 0.03, w / 2 - 0.03, d / 2 - 0.03)],
});

export const LIVING_ASSETS: AssetDefinition[] = [
  sofa3,
  loveseat,
  sofaCorner,
  chesterfield,
  sofaMidCentury,
  futon,
  armchair,
  wingback,
  recliner,
  rockingChair,
  eggChair,
  papasan,
  slipperChair,
  beanBag,
  coffeeRect,
  coffeeRound,
  coffeeTrunk,
  coffeeGlass,
  sideTable,
  nestingTables,
  consoleTable,
  mediaConsole,
  bookcase,
  wallShelf,
  pouf,
  ottoman,
];

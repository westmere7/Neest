import type { AssetDefinition, Part, PlanStroke, Size3 } from './types';
import {
  cellSpans,
  clamp,
  cyl,
  defineAsset,
  fronts,
  lathe,
  legs4,
  line,
  matSlot,
  prism,
  range,
  ring,
  rodZ,
  span,
  vcyl,
  type FrontSpec,
  type V2,
  type V3,
} from './parts';

// ---------------------------------------------------------------------------
// Sofas
// ---------------------------------------------------------------------------

interface SofaStyle {
  arm: 'box' | 'roll';
  /** Fixed arm width — resizing stretches the seat, not the arms. */
  armW: number;
  legH: number;
  legRound: boolean;
}

function sofaFrame({ w, d, h }: Size3, s: SofaStyle) {
  const backT = clamp(d * 0.22, 0.15, 0.22);
  const seatTop = clamp(h * 0.53, 0.36, 0.46);
  const x0 = -w / 2 + s.armW;
  const x1 = w / 2 - s.armW;
  return {
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

function sofaParts(size: Size3, s: SofaStyle): Part[] {
  const { w, d, h } = size;
  const g = sofaFrame(size, s);
  const parts: Part[] = [
    span('upholstery', [g.x0, g.x1], [s.legH, g.deckTop], [g.zb, d / 2 - 0.02], { plan: false }),
    span('upholstery', [-w / 2, w / 2], [s.legH, h], [-d / 2, g.zb], { bevel: 0.02 }),
  ];
  for (const xa of [[-w / 2, g.x0] as V2, [g.x1, w / 2] as V2]) {
    if (s.arm === 'box') {
      parts.push(span('upholstery', xa, [s.legH, g.armTop], [g.zb, d / 2], { bevel: 0.02 }));
    } else {
      const ra = s.armW / 2;
      parts.push(span('upholstery', xa, [s.legH, g.armTop - ra], [g.zb, d / 2], { bevel: 0.015 }));
      parts.push(rodZ('upholstery', (xa[0] + xa[1]) / 2, g.armTop - ra, g.zb, d / 2, ra, { segments: 24 }));
    }
  }
  for (const [xa, xb] of cellSpans(g.seats, g.x0, g.x1)) {
    parts.push(
      span('upholstery', [xa + 0.005, xb - 0.005], [g.deckTop, g.seatTop], [g.zb, d / 2 - 0.01], {
        bevel: 0.02,
      }),
    );
    parts.push(
      span('upholstery', [xa + 0.005, xb - 0.005], [g.seatTop, h - 0.04], [g.zb, g.zb + g.backCushionD], {
        bevel: 0.02,
      }),
    );
  }
  parts.push(...legs4('legs', w, d, 0.03, 0, s.legH, 0.05, { round: s.legRound, taper: 0.65 }));
  return parts;
}

function sofaDividers(size: Size3, s: SofaStyle): PlanStroke[] {
  const g = sofaFrame(size, s);
  return cellSpans(g.seats, g.x0, g.x1)
    .slice(1)
    .map(([x]) => line([x, g.zb + g.backCushionD], [x, size.d / 2 - 0.01]));
}

const SOFA_3: SofaStyle = { arm: 'box', armW: 0.2, legH: 0.07, legRound: false };
const LOVESEAT: SofaStyle = { arm: 'roll', armW: 0.18, legH: 0.14, legRound: true };

const sofa3 = defineAsset({
  id: 'sofa-3-seat',
  name: '3-seat sofa',
  category: 'living',
  tags: ['couch', 'sofa', 'seating', 'settee', 'lounge'],
  defaultSize: { w: 2.2, d: 0.92, h: 0.82 },
  minSize: { w: 1.6, d: 0.8, h: 0.7 },
  maxSize: { w: 3.2, d: 1.2, h: 1.0 },
  wallSnap: true,
  slots: [matSlot('upholstery', 'Upholstery', 'fabric-linen'), matSlot('legs', 'Legs', 'metal-black-matte')],
  build: (size) => sofaParts(size, SOFA_3),
  planDetail: (size) => sofaDividers(size, SOFA_3),
});

const loveseat = defineAsset({
  id: 'sofa-loveseat',
  name: '2-seat loveseat',
  category: 'living',
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
  planDetail: (size) => sofaDividers(size, LOVESEAT),
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
    const parts: Part[] = [
      span('upholstery', [-w / 2, w / 2], [g.legH, h], [-d / 2, g.zb], { bevel: 0.02 }),
      span('upholstery', [-w / 2, g.x0], [g.legH, g.armTop], [g.zb, g.zm], { bevel: 0.02 }),
      span('upholstery', [g.xR, w / 2], [g.legH, g.armTop], [g.zb, d / 2], { bevel: 0.02 }),
      // L-shaped seat deck (concave → kept out of the convex-hull plan footprint).
      prism(
        'upholstery',
        [
          [g.x0, g.zb],
          [g.xR, g.zb],
          [g.xR, d / 2 - 0.02],
          [g.xc, d / 2 - 0.02],
          [g.xc, g.zm - 0.02],
          [g.x0, g.zm - 0.02],
        ],
        g.legH,
        g.deckTop - g.legH,
        { plan: false },
      ),
      span('upholstery', [g.xc + 0.005, g.xR - 0.005], [g.deckTop, g.seatTop], [g.zb, d / 2 - 0.01], {
        bevel: 0.02,
      }),
      span('upholstery', [g.xc + 0.005, g.xR - 0.005], [g.seatTop, h - 0.04], [g.zb, g.zb + g.backCushionD], {
        bevel: 0.02,
      }),
    ];
    for (const [xa, xb] of cellSpans(g.seats, g.x0, g.xc)) {
      parts.push(
        span('upholstery', [xa + 0.005, xb - 0.005], [g.deckTop, g.seatTop], [g.zb, g.zm - 0.01], {
          bevel: 0.02,
        }),
      );
      parts.push(
        span('upholstery', [xa + 0.005, xb - 0.005], [g.seatTop, h - 0.04], [g.zb, g.zb + g.backCushionD], {
          bevel: 0.02,
        }),
      );
    }
    const t = 0.05;
    const legAt: V2[] = [
      [-w / 2 + 0.03 + t / 2, -d / 2 + 0.03 + t / 2],
      [w / 2 - 0.03 - t / 2, -d / 2 + 0.03 + t / 2],
      [-w / 2 + 0.03 + t / 2, g.zm - 0.03 - t / 2],
      [w / 2 - 0.03 - t / 2, d / 2 - 0.03 - t / 2],
      [g.xc + 0.03 + t / 2, d / 2 - 0.03 - t / 2],
    ];
    for (const [x, z] of legAt) {
      parts.push(span('legs', [x - t / 2, x + t / 2], [0, g.legH], [z - t / 2, z + t / 2], { plan: false }));
    }
    return parts;
  },
  planDetail: (size) => {
    const g = cornerSofaFrame(size);
    const strokes = cellSpans(g.seats, g.x0, g.xc)
      .slice(1)
      .map(([x]) => line([x, g.zb + g.backCushionD], [x, g.zm - 0.01]));
    strokes.push(line([g.xc, g.zb + g.backCushionD], [g.xc, g.zm - 0.01]));
    return strokes;
  },
});

const armchair = defineAsset({
  id: 'armchair',
  name: 'Lounge armchair',
  category: 'living',
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
    const parts: Part[] = [
      span('upholstery', [x0, x1], [legH, deckTop], [zb, d / 2 - 0.02], { plan: false }),
      span('upholstery', [-w / 2, w / 2], [legH, h], [-d / 2, zb], { bevel: 0.02 }),
      span('upholstery', [x0 + 0.005, x1 - 0.005], [deckTop, seatTop], [zb, d / 2 - 0.01], { bevel: 0.02 }),
      span('upholstery', [x0 + 0.005, x1 - 0.005], [seatTop, h - 0.05], [zb, zb + 0.14], { bevel: 0.02 }),
    ];
    for (const xa of [[-w / 2, x0] as V2, [x1, w / 2] as V2]) {
      parts.push(span('upholstery', xa, [legH, armTop - 0.03], [zb, d / 2 - 0.03], { bevel: 0.02 }));
      parts.push(span('frame', xa, [armTop - 0.03, armTop], [zb, d / 2], { bevel: 0.008 }));
    }
    parts.push(...legs4('frame', w, d, 0.03, 0, legH, 0.045, { round: true, taper: 0.6 }));
    return parts;
  },
});

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

const coffeeRect = defineAsset({
  id: 'coffee-table',
  name: 'Coffee table',
  category: 'living',
  tags: ['table', 'coffee table', 'low table', 'rectangular'],
  defaultSize: { w: 1.2, d: 0.6, h: 0.4 },
  minSize: { w: 0.6, d: 0.4, h: 0.25 },
  maxSize: { w: 2.0, d: 1.2, h: 0.55 },
  slots: [matSlot('top', 'Top', 'wood-oak-light'), matSlot('legs', 'Legs', 'metal-black-matte')],
  build: ({ w, d, h }) => {
    const t = 0.03;
    const leg = 0.04;
    return [
      span('top', [-w / 2, w / 2], [h - t, h], [-d / 2, d / 2], { bevel: 0.005 }),
      ...legs4('legs', w, d, 0.04, 0, h - t, leg),
      span('top', [-w / 2 + 0.08, w / 2 - 0.08], [0.1, 0.12], [-d / 2 + 0.08, d / 2 - 0.08], { plan: false }),
    ];
  },
});

const coffeeRound = defineAsset({
  id: 'coffee-table-round',
  name: 'Round coffee table',
  category: 'living',
  tags: ['table', 'coffee table', 'round', 'low table'],
  defaultSize: { w: 0.9, d: 0.9, h: 0.38 },
  minSize: { w: 0.5, d: 0.5, h: 0.25 },
  maxSize: { w: 1.4, d: 1.4, h: 0.5 },
  slots: [matSlot('top', 'Top', 'wood-walnut'), matSlot('legs', 'Legs', 'wood-walnut')],
  build: ({ w, d, h }) => {
    const r = w / 2;
    const sz = d / w;
    const t = 0.035;
    const parts: Part[] = [cyl('top', [0, h - t / 2, 0], r, t, { scale: [1, 1, sz], segments: 48 })];
    for (const k of range(3)) {
      const a = Math.PI / 2 + (k * 2 * Math.PI) / 3;
      parts.push(
        vcyl('legs', Math.cos(a) * r * 0.68, Math.sin(a) * r * 0.68 * sz, 0, h - t, 0.022, { plan: false }),
      );
    }
    parts.push(cyl('top', [0, 0.11, 0], r * 0.68, 0.018, { scale: [1, 1, sz], segments: 40, plan: false }));
    return parts;
  },
});

const sideTable = defineAsset({
  id: 'side-table',
  name: 'Side table',
  category: 'living',
  tags: ['table', 'end table', 'side table', 'pedestal', 'round'],
  defaultSize: { w: 0.45, d: 0.45, h: 0.55 },
  minSize: { w: 0.3, d: 0.3, h: 0.35 },
  maxSize: { w: 0.7, d: 0.7, h: 0.75 },
  slots: [matSlot('top', 'Top', 'stone-marble-carrara'), matSlot('base', 'Base', 'metal-black-matte')],
  build: ({ w, d, h }) => {
    const sz: V3 = [1, 1, d / w];
    return [
      cyl('top', [0, h - 0.0125, 0], w / 2, 0.025, { scale: sz, segments: 40 }),
      vcyl('base', 0, 0, 0.02, h - 0.025, 0.022, { plan: false }),
      cyl('base', [0, 0.01, 0], w * 0.36, 0.02, { scale: sz, segments: 32, plan: false }),
    ];
  },
});

// ---------------------------------------------------------------------------
// Storage & accents
// ---------------------------------------------------------------------------

const mediaConsole = defineAsset({
  id: 'media-console',
  name: 'Media console / TV unit',
  category: 'living',
  tags: ['tv unit', 'tv stand', 'console', 'media', 'low cabinet', 'entertainment'],
  defaultSize: { w: 1.8, d: 0.42, h: 0.5 },
  minSize: { w: 1.0, d: 0.3, h: 0.35 },
  maxSize: { w: 3.0, d: 0.6, h: 0.8 },
  wallSnap: true,
  slots: [matSlot('body', 'Body', 'wood-walnut'), matSlot('legs', 'Legs', 'metal-black-matte')],
  build: ({ w, d, h }) => {
    const legH = Math.min(0.12, h * 0.25);
    const ft = 0.018;
    const zFace = d / 2 - ft;
    const n = clamp(Math.round(w / 0.45), 2, 6);
    const specs: FrontSpec[] = cellSpans(n, -w / 2, w / 2).map((x) => ({ x, y: [legH + 0.01, h - 0.01] }));
    return [
      span('body', [-w / 2, w / 2], [legH, h], [-d / 2, zFace]),
      ...fronts('body', 'legs', specs, zFace, ft, 0),
      ...legs4('legs', w, d, 0.06, 0, legH, 0.03),
    ];
  },
});

const bookcase = defineAsset({
  id: 'bookcase',
  name: 'Bookcase',
  category: 'living',
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
    const parts: Part[] = [
      span('frame', [-w / 2, -w / 2 + t], [0, h], [-d / 2, d / 2]),
      span('frame', [w / 2 - t, w / 2], [0, h], [-d / 2, d / 2]),
      span('frame', xi, [h - t, h], [-d / 2, d / 2]),
      span('frame', xi, [0, base], [-d / 2, d / 2 - 0.02], { plan: false }),
      span('frame', xi, [base, h - t], [-d / 2, -d / 2 + 0.01], { plan: false }),
    ];
    const inner = h - t - base;
    const n = clamp(Math.round(inner / 0.36), 1, 8);
    const compH = inner / n;
    const fill = [0.62, 0.45, 0.78, 0.5, 0.7, 0.4, 0.66, 0.55];
    const innerW = w - 2 * t;
    const bookD = Math.min(0.22, d - 0.05);
    for (let k = 0; k < n; k++) {
      const yb = base + k * compH;
      if (k > 0)
        parts.push(
          span('frame', xi, [yb - t / 2, yb + t / 2], [-d / 2 + 0.01, d / 2 - 0.005], { plan: false }),
        );
      const y0 = yb + (k > 0 ? t / 2 : 0);
      const bh = Math.min(0.26, compH - t / 2 - (k > 0 ? t / 2 : 0) - 0.03);
      if (bh < 0.05) continue;
      const bw = innerW * fill[k % fill.length];
      const xa = k % 2 === 0 ? xi[0] + 0.01 : xi[1] - 0.01 - bw;
      parts.push(
        span('books', [xa, xa + bw], [y0, y0 + bh], [-d / 2 + 0.012, -d / 2 + 0.012 + bookD], {
          plan: false,
        }),
      );
    }
    return parts;
  },
});

const wallShelf = defineAsset({
  id: 'wall-shelf',
  name: 'Floating wall shelf',
  category: 'living',
  tags: ['shelf', 'ledge', 'wall shelf', 'bracket shelf'],
  defaultSize: { w: 0.9, d: 0.24, h: 0.2 },
  minSize: { w: 0.3, d: 0.12, h: 0.06 },
  maxSize: { w: 2.4, d: 0.4, h: 0.4 },
  mount: 'wall',
  defaultElevation: 1.2,
  slots: [matSlot('board', 'Board', 'wood-oak-light'), matSlot('bracket', 'Brackets', 'metal-black-matte')],
  build: ({ w, d, h }) => {
    const bt = 0.035;
    const parts: Part[] = [span('board', [-w / 2, w / 2], [h - bt, h], [-d / 2, d / 2])];
    const inset = Math.min(0.12, w * 0.2);
    for (const bx of [-w / 2 + inset, w / 2 - inset]) {
      parts.push(
        span('bracket', [bx - 0.015, bx + 0.015], [0, h - bt], [-d / 2, -d / 2 + 0.012], { plan: false }),
      );
      parts.push(
        span('bracket', [bx - 0.015, bx + 0.015], [h - bt - 0.01, h - bt], [-d / 2, -d / 2 + d * 0.8], {
          plan: false,
        }),
      );
    }
    return parts;
  },
});

const pouf = defineAsset({
  id: 'pouf-round',
  name: 'Round pouf',
  category: 'living',
  tags: ['pouf', 'footstool', 'ottoman', 'seat', 'round'],
  defaultSize: { w: 0.5, d: 0.5, h: 0.42 },
  minSize: { w: 0.35, d: 0.35, h: 0.25 },
  maxSize: { w: 0.9, d: 0.9, h: 0.55 },
  slots: [matSlot('upholstery', 'Upholstery', 'rug-jute')],
  build: ({ w, d, h }) => {
    const R = w / 2;
    const sz: V3 = [1, 1, d / w];
    return [
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
      ring('upholstery', [0, h * 0.5, 0], R - 0.006, 0.006, { zScale: d / w, plan: false }),
    ];
  },
});

const ottoman = defineAsset({
  id: 'ottoman',
  name: 'Upholstered ottoman',
  category: 'living',
  tags: ['ottoman', 'footstool', 'bench', 'footrest'],
  defaultSize: { w: 0.9, d: 0.6, h: 0.42 },
  minSize: { w: 0.4, d: 0.4, h: 0.3 },
  maxSize: { w: 1.6, d: 1.0, h: 0.55 },
  slots: [matSlot('upholstery', 'Upholstery', 'leather-cognac'), matSlot('legs', 'Legs', 'wood-walnut')],
  build: ({ w, d, h }) => {
    const legH = 0.08;
    const cushion = Math.min(0.08, (h - legH) * 0.35);
    return [
      span('upholstery', [-w / 2 + 0.01, w / 2 - 0.01], [legH, h - cushion], [-d / 2 + 0.01, d / 2 - 0.01], {
        bevel: 0.015,
      }),
      span('upholstery', [-w / 2, w / 2], [h - cushion, h], [-d / 2, d / 2], { bevel: 0.02 }),
      ...legs4('legs', w, d, 0.04, 0, legH, 0.04, { round: true, taper: 0.7 }),
    ];
  },
});

export const LIVING_ASSETS: AssetDefinition[] = [
  sofa3,
  loveseat,
  sofaCorner,
  armchair,
  coffeeRect,
  coffeeRound,
  sideTable,
  mediaConsole,
  bookcase,
  wallShelf,
  pouf,
  ottoman,
];

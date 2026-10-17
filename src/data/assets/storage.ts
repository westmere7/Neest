import type { AssetDefinition, Part, PlanStroke } from './types';
import {
  barPull,
  blobCluster,
  bookRow,
  box,
  cellSpans,
  cells,
  circle,
  clamp,
  cushion,
  cyl,
  defineAsset,
  discZ,
  foliage,
  frame4,
  fronts,
  knob,
  lathe,
  lerp,
  line,
  legs4,
  matSlot,
  pot,
  range,
  rectPoly,
  ring,
  rng,
  rod,
  rodPath,
  rodX,
  rodZ,
  shakerFront,
  slats,
  span,
  spaced,
  sphere,
  torus,
  turnedLeg,
  vcyl,
  type FrontSpec,
  type V2,
  type V3,
} from './parts';

// ---------------------------------------------------------------------------
// Small shelf props
// ---------------------------------------------------------------------------

/** Lathe vase standing at `base`, `r` wide and `hgt` tall (slim bottle-neck or bulbous). */
function vase(slot: string, base: V3, r: number, hgt: number, style: 'bottle' | 'bulb' = 'bottle'): Part {
  const P: Record<string, V2[]> = {
    bottle: [
      [0, 0],
      [r * 0.7, 0],
      [r, hgt * 0.35],
      [r * 0.8, hgt * 0.62],
      [r * 0.32, hgt * 0.78],
      [r * 0.3, hgt * 0.95],
      [r * 0.42, hgt],
      [r * 0.28, hgt],
    ],
    bulb: [
      [0, 0],
      [r * 0.55, 0],
      [r, hgt * 0.45],
      [r * 0.85, hgt * 0.8],
      [r * 0.55, hgt],
      [r * 0.45, hgt],
    ],
  };
  return lathe(slot, base, P[style], { segments: 20, plan: false });
}

/** Lidded storage box with a darker handle slot, front at z1. */
function storageBox(slot: string, slotSlot: string, x: V2, y0: number, hgt: number, z: V2): Part[] {
  const cx = (x[0] + x[1]) / 2;
  const hw = Math.min(0.04, (x[1] - x[0]) * 0.2);
  return [
    span(slot, x, [y0, y0 + hgt - 0.012], [z[0] + 0.004, z[1] - 0.004], { bevel: 0.004, plan: false }),
    span(slot, [x[0] - 0.003, x[1] + 0.003], [y0 + hgt - 0.014, y0 + hgt], z, { bevel: 0.003, plan: false }),
    span(slotSlot, [cx - hw, cx + hw], [y0 + hgt * 0.55, y0 + hgt * 0.55 + 0.016], [z[1] - 0.005, z[1] - 0.002], { bevel: 0.004, plan: false }),
  ];
}

/** Flat stack of `n` books lying on their sides, centred at (cx, cz). */
function bookStack(slot: string, cx: number, cz: number, y0: number, n: number, seed: number, maxD: number): Part[] {
  const rand = rng(seed);
  const parts: Part[] = [];
  let y = y0;
  for (let i = 0; i < n; i++) {
    const t = lerp(0.02, 0.035, rand());
    const bw = lerp(0.16, 0.22, rand());
    const bd = Math.min(maxD, lerp(0.12, 0.16, rand()));
    parts.push(box(slot, [cx + (rand() - 0.5) * 0.015, y + t / 2, cz], [bw, t, bd], { rotation: [0, (rand() - 0.5) * 0.2, 0], plan: false }));
    y += t;
  }
  return parts;
}

// ---------------------------------------------------------------------------
// Cabinets and shelving
// ---------------------------------------------------------------------------

const sideboard = defineAsset({
  id: 'sideboard',
  name: 'Sideboard / credenza',
  category: 'storage',
  type: 'storage',
  group: 'Sideboards & cabinets',
  tags: ['sideboard', 'credenza', 'buffet', 'cabinet', 'dresser'],
  defaultSize: { w: 1.6, d: 0.45, h: 0.78 },
  minSize: { w: 0.9, d: 0.35, h: 0.6 },
  maxSize: { w: 2.6, d: 0.55, h: 1.0 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Body & fronts', 'wood-walnut'),
    matSlot('legs', 'Legs', 'wood-walnut'),
    matSlot('handle', 'Knobs', 'metal-brass'),
  ],
  build: ({ w, d, h }) => {
    const legH = Math.min(0.18, h * 0.25);
    const topT = 0.025;
    const zf = d / 2 - 0.036;
    const yTop = h - topT;
    const drawerH = Math.min(0.16, (yTop - legH) * 0.3);
    const cols = cellSpans(clamp(Math.round(w / 0.45), 2, 5), -w / 2 + 0.012, w / 2 - 0.012);
    const parts: Part[] = [
      span('body', [-w / 2, w / 2], [yTop, h], [-d / 2, d / 2], { bevel: 0.004 }),
      span('body', [-w / 2 + 0.008, w / 2 - 0.008], [legH, yTop], [-d / 2, zf]),
      // Apron under the carcass that the legs join.
      span('legs', [-w / 2 + 0.03, w / 2 - 0.03], [legH - 0.035, legH], [-d / 2 + 0.03, zf - 0.02], { plan: false }),
      ...legs4('legs', w, d, 0.04, 0, legH - 0.01, 0.042, { round: true, taper: 0.5 }),
    ];
    cols.forEach(([x0, x1], i) => {
      // Slab drawer on top with a knob, shaker door below with a knob at the meeting edge.
      parts.push(...fronts('body', 'handle', [{ x: [x0, x1], y: [yTop - drawerH, yTop - 0.004] }], zf, 0.018, 0));
      parts.push(...knob('handle', [(x0 + x1) / 2, yTop - drawerH / 2 - 0.002, zf + 0.018], 0.013));
      parts.push(...shakerFront('body', [x0, x1], [legH + 0.008, yTop - drawerH], zf, 0.018, { rail: 0.055, recess: 0.007 }));
      const kx = i % 2 === 0 ? x1 - 0.045 : x0 + 0.045;
      parts.push(...knob('handle', [kx, yTop - drawerH - 0.07, zf + 0.018], 0.014));
    });
    return parts;
  },
});

const shelving = defineAsset({
  id: 'shelving-unit',
  name: 'Open shelving unit',
  category: 'storage',
  type: 'storage',
  group: 'Bookcases & shelves',
  tags: ['shelves', 'shelving', 'rack', 'etagere', 'industrial'],
  defaultSize: { w: 0.9, d: 0.4, h: 1.8 },
  minSize: { w: 0.4, d: 0.25, h: 0.5 },
  maxSize: { w: 1.8, d: 0.6, h: 2.4 },
  wallSnap: true,
  slots: [
    matSlot('shelf', 'Shelves', 'wood-plywood'),
    matSlot('frame', 'Frame', 'metal-black-matte'),
    matSlot('books', 'Books', 'book-mix'),
    matSlot('decor', 'Boxes & vases', 'ceramic-white'),
  ],
  build: ({ w, d, h }) => {
    const p = 0.025;
    const st = 0.025;
    const parts: Part[] = [];
    const corners: V2[] = [
      [-w / 2 + p / 2, -d / 2 + p / 2],
      [w / 2 - p / 2, -d / 2 + p / 2],
      [-w / 2 + p / 2, d / 2 - p / 2],
      [w / 2 - p / 2, d / 2 - p / 2],
    ];
    for (const [x, z] of corners) {
      parts.push(span('frame', [x - p / 2, x + p / 2], [0.01, h], [z - p / 2, z + p / 2]));
      parts.push(vcyl('frame', x, z, 0, 0.01, 0.011, { plan: false }));
    }
    const n = clamp(Math.round((h - 0.1) / 0.38) + 1, 2, 8);
    const ys = spaced(n, 0.06 + st / 2, h - st / 2);
    ys.forEach((y, i) => {
      parts.push(span('shelf', [-w / 2 + p, w / 2 - p], [y - st / 2, y + st / 2], [-d / 2, d / 2], { plan: i === n - 1 }));
    });
    const zb = -d / 2 + p / 2;
    parts.push(rod('frame', [-w / 2 + p, 0.1, zb], [w / 2 - p, h - 0.1, zb], 0.004, { plan: false }));
    parts.push(rod('frame', [w / 2 - p, 0.1, zb], [-w / 2 + p, h - 0.1, zb], 0.004, { plan: false }));
    // Shelf clutter: books, lidded boxes, vases and book stacks (none on the top shelf).
    const x0 = -w / 2 + p + 0.01;
    const x1 = w / 2 - p - 0.01;
    const iw = x1 - x0;
    const maxD = Math.min(0.24, d - 0.06);
    const zBack = -d / 2 + 0.03;
    for (let i = 0; i < n - 1; i++) {
      const y0 = ys[i] + st / 2;
      const clear = ys[i + 1] - st / 2 - y0;
      if (clear < 0.12) continue;
      const bh = Math.min(0.3, clear - 0.03);
      const bookW = Math.min(0.4, iw * (iw > 0.6 ? 0.55 : 0.7));
      const pattern = i % 3;
      if (pattern === 0) {
        parts.push(...bookRow('books', [x0, x0 + bookW], y0, zBack, bh, maxD, 101 + i * 13, { lean: true }));
        const bxw = Math.min(0.3, x1 - (x0 + bookW) - 0.03);
        if (bxw > 0.12) parts.push(...storageBox('decor', 'frame', [x1 - bxw, x1], y0, Math.min(0.2, clear * 0.65), [-d / 2 + 0.03, d / 2 - 0.03]));
      } else if (pattern === 1) {
        parts.push(vase('decor', [x0 + 0.06, y0, 0], 0.045, Math.min(0.24, clear - 0.03), 'bottle'));
        const rest = x1 - (x0 + 0.13);
        if (rest > 0.24) parts.push(...bookStack('books', x0 + 0.24, 0, y0, 3, 7 + i, maxD));
        if (rest > 0.48) parts.push(...bookRow('books', [x0 + 0.37, Math.min(x1, x0 + 0.37 + bookW)], y0, zBack, bh, maxD, 77 + i * 5, { fill: 0.9 }));
      } else {
        parts.push(...bookRow('books', [x1 - bookW, x1], y0, zBack, bh, maxD, 59 + i * 3));
        if (iw - bookW > 0.14) {
          const vx = x0 + Math.min(0.08, (iw - bookW) / 2);
          parts.push(vase('decor', [vx, y0, 0], 0.055, Math.min(0.16, clear - 0.03), 'bulb'));
        }
      }
    }
    return parts;
  },
});

const drawerUnit = defineAsset({
  id: 'drawer-unit',
  name: 'Mobile drawer unit',
  category: 'storage',
  type: 'storage',
  group: 'Office storage',
  tags: ['drawers', 'pedestal', 'caddy', 'under desk', 'storage'],
  defaultSize: { w: 0.42, d: 0.55, h: 0.6 },
  minSize: { w: 0.3, d: 0.4, h: 0.4 },
  maxSize: { w: 0.6, d: 0.7, h: 0.8 },
  slots: [
    matSlot('body', 'Body', 'laminate-white-matte'),
    matSlot('handle', 'Handles & lock', 'metal-brushed-steel'),
    matSlot('wheel', 'Castors', 'solid-black'),
  ],
  build: ({ w, d, h }) => {
    const wheel = 0.025;
    const base = 2 * wheel + 0.012;
    const zf = d / 2 - 0.035;
    const top = h - 0.02;
    const pencil = h > 0.45 ? 0.12 : 0;
    const rows: V2[] =
      pencil > 0 ? [[top - pencil, top], ...cellSpans(2, base + 0.01, top - pencil)] : cellSpans(2, base + 0.01, top);
    const specs: FrontSpec[] = rows.map((y) => ({ x: [-w / 2 + 0.005, w / 2 - 0.005] as V2, y }));
    const parts: Part[] = [
      span('body', [-w / 2, w / 2], [base, top], [-d / 2, zf], { bevel: 0.004 }),
      span('body', [-w / 2, w / 2], [top, h], [-d / 2, zf + 0.018], { bevel: 0.005 }),
      ...fronts('body', 'handle', specs, zf, 0.017, 0),
      cyl('handle', [w / 2 - 0.04, top - 0.03, zf + 0.019], 0.009, 0.006, { rotation: [Math.PI / 2, 0, 0], plan: false }),
    ];
    for (const [y0, y1] of rows) {
      const hy = y1 - Math.min(0.04, (y1 - y0) * 0.3);
      parts.push(...barPull('handle', [0, hy, zf + 0.017], Math.min(0.18, w * 0.5), { stand: 0.02, r: 0.0045 }));
    }
    // Castors: mounting plate, swivel stem, fork and wheel.
    for (const x of [-w / 2 + 0.045, w / 2 - 0.045]) {
      for (const z of [-d / 2 + 0.05, d / 2 - 0.07]) {
        parts.push(span('wheel', [x - 0.02, x + 0.02], [base - 0.006, base], [z - 0.02, z + 0.02], { plan: false }));
        parts.push(vcyl('wheel', x, z, base - 0.016, base - 0.006, 0.008, { plan: false }));
        parts.push(span('wheel', [x - 0.014, x + 0.014], [wheel, base - 0.016], [z - 0.016, z + 0.012], { bevel: 0.004, plan: false }));
        parts.push(rod('wheel', [x - 0.01, wheel, z - 0.006], [x + 0.01, wheel, z - 0.006], wheel, { segments: 16, plan: false }));
      }
    }
    return parts;
  },
});

const shoeCabinet = defineAsset({
  id: 'shoe-cabinet',
  name: 'Shoe cabinet',
  category: 'storage',
  type: 'storage',
  group: 'Hallway storage',
  tags: ['shoe cabinet', 'shoe rack', 'hallway', 'entryway', 'tilt-out'],
  defaultSize: { w: 0.8, d: 0.24, h: 1.05 },
  minSize: { w: 0.5, d: 0.17, h: 0.6 },
  maxSize: { w: 1.4, d: 0.35, h: 1.6 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Body & flaps', 'laminate-white-matte'),
    matSlot('accent', 'Top, legs & grips', 'wood-oak-light'),
  ],
  build: ({ w, d, h }) => {
    const legH = 0.08;
    const topT = 0.02;
    const zf = d / 2 - 0.025;
    const yTop = h - topT;
    const drawer = h >= 0.9 ? 0.11 : 0;
    const n = clamp(Math.round((yTop - drawer - legH) / 0.3), 1, 5);
    const flaps = cellSpans(n, legH, yTop - drawer);
    const grip = Math.min(0.14, w * 0.22);
    const parts: Part[] = [
      span('accent', [-w / 2, w / 2], [yTop, h], [-d / 2, d / 2], { bevel: 0.004 }),
      span('body', [-w / 2, w / 2], [legH, yTop], [-d / 2, zf]),
      span('body', [-w / 2 + 0.03, w / 2 - 0.03], [legH - 0.02, legH], [-d / 2 + 0.02, zf - 0.01], { plan: false }),
      ...legs4('accent', w, d, 0.03, 0, legH - 0.02, 0.032, { round: true, taper: 0.6 }),
    ];
    // Tilt-out flaps: slab fronts with a routed finger grip along the top edge, pivot caps at the
    // sides and a vent slot near the foot of each flap.
    for (const [y0, y1] of flaps) {
      parts.push(...fronts('body', 'accent', [{ x: [-w / 2 + 0.004, w / 2 - 0.004], y: [y0, y1] }], zf, 0.016, 0));
      parts.push(span('accent', [-grip, grip], [y1 - 0.03, y1 - 0.008], [zf + 0.012, d / 2 - 0.004], { bevel: 0.006, plan: false }));
      parts.push(span('accent', [-grip * 0.9, grip * 0.9], [y1 - 0.024, y1 - 0.014], [d / 2 - 0.006, d / 2], { plan: false }));
      for (const side of [-1, 1]) {
        parts.push(cyl('accent', [side * (w / 2 + 0.002), y0 + 0.035, zf - 0.02], 0.009, 0.004, { rotation: [0, 0, Math.PI / 2], plan: false }));
      }
      parts.push(...slats('accent', [-w * 0.3, w * 0.3], [y0 + 0.02, y0 + 0.028], [zf + 0.016, zf + 0.018], clamp(Math.round(w / 0.08), 4, 12), { axis: 'x', gap: 0.5, plan: false }));
    }
    if (drawer > 0) {
      parts.push(...fronts('body', 'accent', [{ x: [-w / 2 + 0.004, w / 2 - 0.004], y: [yTop - drawer, yTop - 0.003] }], zf, 0.016, 0));
      parts.push(...knob('accent', [0, yTop - drawer / 2, zf + 0.016], 0.011));
    }
    return parts;
  },
});

const cubeStorage = defineAsset({
  id: 'cube-storage',
  name: 'Cube storage with baskets',
  category: 'storage',
  type: 'storage',
  group: 'Bookcases & shelves',
  tags: ['cube storage', 'kallax', 'cubby', 'baskets', 'bins', 'shelving', 'room divider'],
  defaultSize: { w: 0.77, d: 0.39, h: 0.77 },
  minSize: { w: 0.42, d: 0.33, h: 0.42 },
  maxSize: { w: 1.5, d: 0.45, h: 1.5 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Frame', 'wood-painted-white'),
    matSlot('baskets', 'Fabric bins', 'felt-grey'),
    matSlot('books', 'Books', 'book-mix'),
    matSlot('decor', 'Vases & tabs', 'ceramic-sage'),
  ],
  build: ({ w, d, h }) => {
    const ot = 0.035;
    const it = 0.015;
    const cols = clamp(Math.round((w - 2 * ot) / 0.35), 1, 4);
    const rows = clamp(Math.round((h - 2 * ot) / 0.35), 1, 4);
    const xs = cellSpans(cols, -w / 2 + ot, w / 2 - ot);
    const ys = cellSpans(rows, ot, h - ot);
    const parts: Part[] = [
      span('body', [-w / 2, w / 2], [h - ot, h], [-d / 2, d / 2], { bevel: 0.003 }),
      span('body', [-w / 2, w / 2], [0, ot], [-d / 2, d / 2], { bevel: 0.003 }),
      span('body', [-w / 2, -w / 2 + ot], [ot, h - ot], [-d / 2, d / 2]),
      span('body', [w / 2 - ot, w / 2], [ot, h - ot], [-d / 2, d / 2]),
    ];
    for (const [x] of xs.slice(1)) parts.push(span('body', [x - it / 2, x + it / 2], [ot, h - ot], [-d / 2, d / 2], { plan: false }));
    for (const [y] of ys.slice(1)) parts.push(span('body', [-w / 2 + ot, w / 2 - ot], [y - it / 2, y + it / 2], [-d / 2, d / 2], { plan: false }));
    const rand = rng(61);
    ys.forEach(([ry0, ry1], r) => {
      const y0 = ry0 + (r === 0 ? 0 : it / 2);
      const y1 = ry1 - (r === rows - 1 ? 0 : it / 2);
      xs.forEach(([cx0, cx1], c) => {
        const x0 = cx0 + (c === 0 ? 0 : it / 2);
        const x1 = cx1 - (c === cols - 1 ? 0 : it / 2);
        const cw = x1 - x0;
        const ch = y1 - y0;
        const k = (r + c * 2) % 3;
        if (k === 0) {
          // Fabric bin with a rim and a pull tab.
          const bx: V2 = [x0 + 0.008, x1 - 0.008];
          const top = y1 - 0.012;
          parts.push(span('baskets', bx, [y0, top - 0.02], [-d / 2 + 0.02, d / 2 - 0.01], { bevel: 0.008, plan: false }));
          parts.push(span('baskets', [bx[0] - 0.002, bx[1] + 0.002], [top - 0.022, top], [-d / 2 + 0.018, d / 2 - 0.008], { bevel: 0.006, plan: false }));
          parts.push(span('decor', [(x0 + x1) / 2 - 0.035, (x0 + x1) / 2 + 0.035], [top - 0.07, top - 0.035], [d / 2 - 0.01, d / 2 - 0.004], { bevel: 0.006, plan: false }));
        } else if (k === 1) {
          parts.push(...bookRow('books', [x0, x0 + cw * 0.72], y0, -d / 2 + 0.03, Math.min(0.28, ch - 0.03), Math.min(0.24, d - 0.06), 13 + r * 7 + c, { lean: true }));
          parts.push(vase('decor', [x1 - 0.045, y0, 0.02], 0.035, Math.min(0.2, ch - 0.04), rand() < 0.5 ? 'bottle' : 'bulb'));
        } else {
          parts.push(...bookStack('books', (x0 + x1) / 2, 0, y0, 2, 3 + r + c, Math.min(0.2, d - 0.08)));
          parts.push(vase('decor', [(x0 + x1) / 2 + 0.02, y0 + 0.05, 0], 0.05, Math.min(0.14, ch - 0.08), 'bulb'));
        }
      });
    });
    return parts;
  },
  planDetail: ({ w, d }) => {
    const cols = clamp(Math.round((w - 0.07) / 0.35), 1, 4);
    return cellSpans(cols, -w / 2 + 0.035, w / 2 - 0.035)
      .slice(1)
      .map(([x]) => line([x, -d / 2], [x, d / 2]));
  },
});

const displayCabinet = defineAsset({
  id: 'display-cabinet',
  name: 'Glass display cabinet',
  category: 'storage',
  type: 'storage',
  group: 'Sideboards & cabinets',
  tags: ['display cabinet', 'vitrine', 'curio', 'china cabinet', 'glass cabinet', 'showcase'],
  defaultSize: { w: 0.8, d: 0.4, h: 1.8 },
  minSize: { w: 0.5, d: 0.35, h: 1.4 },
  maxSize: { w: 1.2, d: 0.5, h: 2.1 },
  wallSnap: true,
  slots: [
    matSlot('frame', 'Frame', 'wood-oak-natural'),
    matSlot('glass', 'Glass', 'glass-clear'),
    matSlot('items', 'Crockery', 'ceramic-white'),
    matSlot('handle', 'Handles', 'metal-brass'),
  ],
  build: ({ w, d, h }) => {
    const yb = 0.1;
    const yt = h - 0.045;
    const p = 0.03;
    const parts: Part[] = [
      span('frame', [-w / 2 + 0.015, w / 2 - 0.015], [0, 0.08], [-d / 2 + 0.01, d / 2 - 0.025]),
      span('frame', [-w / 2, w / 2], [0.08, yb], [-d / 2, d / 2], { bevel: 0.004 }),
      span('frame', [-w / 2, w / 2], [yt, h], [-d / 2, d / 2], { bevel: 0.005 }),
      span('frame', [-w / 2 + 0.008, w / 2 - 0.008], [yt - 0.03, yt], [-d / 2 + 0.008, d / 2 - 0.008], { plan: false }),
      span('frame', [-w / 2 + p, w / 2 - p], [yb, yt], [-d / 2, -d / 2 + 0.01], { plan: false }),
    ];
    for (const x of [-w / 2 + p / 2, w / 2 - p / 2]) {
      for (const z of [-d / 2 + p / 2, d / 2 - 0.02 - p / 2]) parts.push(span('frame', [x - p / 2, x + p / 2], [yb, yt], [z - p / 2, z + p / 2], { plan: false }));
      parts.push(span('glass', [x - 0.002, x + 0.002], [yb, yt - 0.03], [-d / 2 + p, d / 2 - 0.02 - p], { plan: false }));
    }
    // Glazed doors on the front.
    const nd = w > 0.65 ? 2 : 1;
    const zd: V2 = [d / 2 - 0.02, d / 2];
    cellSpans(nd, -w / 2 + 0.004, w / 2 - 0.004).forEach(([x0, x1], i) => {
      parts.push(...frame4('frame', [x0 + 0.002, x1 - 0.002], [yb + 0.004, yt - 0.034], zd, 0.04));
      parts.push(span('glass', [x0 + 0.04, x1 - 0.04], [yb + 0.04, yt - 0.07], [d / 2 - 0.013, d / 2 - 0.009], { plan: false }));
      const hx = nd === 2 ? (i === 0 ? x1 - 0.022 : x0 + 0.022) : x1 - 0.022;
      parts.push(...barPull('handle', [hx, (yb + yt) / 2, d / 2], 0.12, { vertical: true, stand: 0.014, r: 0.004 }));
    });
    // Glass shelves and their crockery.
    const n = clamp(Math.round((yt - 0.03 - yb) / 0.36), 3, 6);
    const levels = cellSpans(n, yb, yt - 0.03);
    const ix0 = -w / 2 + p + 0.01;
    const ix1 = w / 2 - p - 0.01;
    const iw = ix1 - ix0;
    const zi0 = -d / 2 + 0.02;
    const zi1 = d / 2 - 0.05;
    const zc = (zi0 + zi1) / 2;
    levels.forEach(([y0, y1], i) => {
      const sy = i === 0 ? y0 : y0 + 0.008;
      if (i > 0) parts.push(span('glass', [-w / 2 + p, w / 2 - p], [y0, y0 + 0.008], [-d / 2 + 0.01, d / 2 - 0.04], { plan: false }));
      const clear = y1 - sy;
      const kind = i % 3;
      if (kind === 0) {
        // Plates standing on edge against the back.
        const pr = Math.min(0.12, clear * 0.42, iw / 6);
        for (const x of cells(clamp(Math.floor(iw / (pr * 2 + 0.02)), 1, 4), ix0, ix1)) {
          parts.push(discZ('items', [x, sy + pr, zi0 + 0.02], pr, 0.014, { rTop: pr * 0.92, segments: 24, plan: false }));
        }
      } else if (kind === 1) {
        // A row of wine glasses.
        const gh = Math.min(0.2, clear - 0.04);
        for (const x of cells(clamp(Math.floor(iw / 0.09), 2, 6), ix0, ix1)) {
          parts.push(
            lathe(
              'items',
              [x, sy, zc],
              [
                [0, 0],
                [0.032, 0],
                [0.006, gh * 0.04],
                [0.005, gh * 0.45],
                [0.035, gh * 0.62],
                [0.038, gh * 0.85],
                [0.032, gh],
                [0.03, gh],
              ],
              { segments: 16, plan: false },
            ),
          );
        }
      } else {
        // A stack of bowls, a teapot and a vase.
        for (const k of range(3)) {
          parts.push(
            lathe(
              'items',
              [ix0 + 0.09, sy + k * 0.03, zc],
              [
                [0, 0],
                [0.04, 0],
                [0.075, 0.035],
                [0.07, 0.035],
              ],
              { segments: 20, plan: false },
            ),
          );
        }
        const tx = (ix0 + ix1) / 2 + 0.03;
        if (iw > 0.36) {
          parts.push(sphere('items', [tx, sy + 0.065, zc], 0.07, { scale: [1, 0.85, 1], plan: false }));
          parts.push(rod('items', [tx + 0.05, sy + 0.05, zc], [tx + 0.1, sy + 0.1, zc], 0.008, { rTop: 0.005, plan: false }));
          parts.push(torus('items', [tx - 0.07, sy + 0.07, zc], 0.03, 0.006, { plan: false }));
          parts.push(sphere('handle', [tx, sy + 0.13, zc], 0.012, { plan: false }));
        }
        parts.push(vase('items', [ix1 - 0.05, sy, zc], 0.045, Math.min(0.26, clear - 0.04), 'bottle'));
      }
    });
    return parts;
  },
});

const wineRack = defineAsset({
  id: 'wine-rack',
  name: 'Wine rack',
  category: 'storage',
  type: 'storage',
  group: 'Bookcases & shelves',
  tags: ['wine rack', 'bottle rack', 'wine storage', 'bar', 'cellar', 'kitchen'],
  defaultSize: { w: 0.6, d: 0.3, h: 0.9 },
  minSize: { w: 0.35, d: 0.25, h: 0.4 },
  maxSize: { w: 1.0, d: 0.35, h: 1.2 },
  wallSnap: true,
  slots: [
    matSlot('wood', 'Wood', 'wood-walnut'),
    matSlot('bottles', 'Bottles', 'glass-tinted'),
    matSlot('caps', 'Capsules', 'metal-copper'),
    matSlot('labels', 'Labels', 'paper-art'),
  ],
  build: ({ w, d, h }) => {
    const sd = 0.018;
    const yb = 0.05;
    const yt = h - sd;
    const rows = clamp(Math.floor((yt - yb) / 0.105), 2, 10);
    const cols = clamp(Math.floor((w - 2 * sd) / 0.1), 2, 9);
    const xs = cellSpans(cols, -w / 2 + sd, w / 2 - sd);
    const ys = cellSpans(rows, yb, yt);
    const parts: Part[] = [
      span('wood', [-w / 2, w / 2], [yt, h], [-d / 2, d / 2], { bevel: 0.003 }),
      span('wood', [-w / 2, -w / 2 + sd], [0, yt], [-d / 2, d / 2]),
      span('wood', [w / 2 - sd, w / 2], [0, yt], [-d / 2, d / 2]),
      span('wood', [-w / 2 + sd, w / 2 - sd], [0, yb], [d / 2 - 0.03, d / 2 - 0.012], { plan: false }),
      span('wood', [-w / 2 + sd, w / 2 - sd], [0, yb], [-d / 2 + 0.012, -d / 2 + 0.03], { plan: false }),
    ];
    // Cradle rails under every row and slim dividers between columns, front and back.
    for (const [y0] of ys) {
      for (const z of [d / 2 - 0.05, -d / 2 + 0.06]) parts.push(rodX('wood', -w / 2 + sd, w / 2 - sd, y0 + 0.007, z, 0.007, { plan: false }));
    }
    for (const [x] of xs.slice(1)) {
      for (const z of [d / 2 - 0.03, -d / 2 + 0.03]) parts.push(span('wood', [x - 0.005, x + 0.005], [yb, yt], [z - 0.008, z + 0.008], { plan: false }));
    }
    // Bottles lying necks-out: body, shoulder, neck, capsule and a label.
    const rand = rng(29);
    const cw = (w - 2 * sd) / cols;
    const rh = (yt - yb) / rows;
    const br = Math.min(0.037, cw / 2 - 0.009, rh / 2 - 0.012);
    const zb0 = -d / 2 + 0.012;
    const bl = d - 0.024 - 0.09;
    // Keep the whole rack within the part budget (5 parts per bottle).
    const maxBottles = Math.max(0, Math.floor((140 - parts.length) / 5));
    let count = 0;
    for (const [y0] of ys) {
      for (const [x0, x1] of xs) {
        if (count >= maxBottles || rand() > 0.72) continue;
        count++;
        const cx = (x0 + x1) / 2;
        const cy = y0 + 0.014 + br;
        const z1 = zb0 + bl;
        parts.push(
          rodZ('bottles', cx, cy, zb0, z1, br, { segments: 16, plan: false }),
          rod('bottles', [cx, cy, z1], [cx, cy, z1 + 0.03], br, { rTop: br * 0.34, segments: 16, plan: false }),
          rodZ('bottles', cx, cy, z1 + 0.03, z1 + 0.065, br * 0.32, { segments: 12, plan: false }),
          rodZ('caps', cx, cy, z1 + 0.06, z1 + 0.09, br * 0.36, { segments: 12, plan: false }),
          rodZ('labels', cx, cy, zb0 + bl * 0.3, zb0 + bl * 0.72, br + 0.001, { segments: 16, plan: false }),
        );
      }
    }
    return parts;
  },
});

// ---------------------------------------------------------------------------
// Hallway
// ---------------------------------------------------------------------------

const coatStand = defineAsset({
  id: 'coat-stand',
  name: 'Coat stand',
  category: 'storage',
  type: 'storage',
  group: 'Hallway storage',
  tags: ['coat stand', 'coat rack', 'hat stand', 'hallway', 'entryway', 'hooks'],
  defaultSize: { w: 0.5, d: 0.5, h: 1.8 },
  minSize: { w: 0.4, d: 0.4, h: 1.6 },
  maxSize: { w: 0.65, d: 0.65, h: 1.95 },
  slots: [
    matSlot('wood', 'Wood', 'wood-walnut'),
    matSlot('metal', 'Hook tips', 'metal-brass'),
    matSlot('scarf', 'Scarf & hat band', 'fabric-mustard'),
    matSlot('hat', 'Hat', 'felt-grey'),
  ],
  build: ({ w, d, h }) => {
    const R = Math.min(w, d) / 2 - 0.02;
    const poleTop = h - 0.12;
    const parts: Part[] = [
      vcyl('wood', 0, 0, 0.22, poleTop, 0.02, { segments: 16 }),
      cyl('wood', [0, 0.24, 0], 0.032, 0.05, { rTop: 0.022, segments: 16, plan: false }),
      ...[0.9, 1.3].map((y) => cyl('wood', [0, Math.min(y, poleTop - 0.3), 0], 0.026, 0.02, { segments: 16, plan: false })),
      sphere('wood', [0, poleTop, 0], 0.028, { plan: false }),
    ];
    // Tripod feet.
    for (const k of range(3)) {
      const a = Math.PI / 2 + (k * 2 * Math.PI) / 3;
      const fx = Math.cos(a) * (R - 0.02);
      const fz = Math.sin(a) * (R - 0.02);
      parts.push(rod('wood', [0, 0.3, 0], [fx, 0.02, fz], 0.015, { plan: false }));
      parts.push(sphere('wood', [fx, 0.018, fz], 0.018, { scale: [1, 0.9, 1] }));
    }
    // Two tiers of curved hooks with brass tips.
    const tiers: [number, number, number][] = [
      [poleTop - 0.1, Math.min(0.15, R - 0.02), 0],
      [poleTop - 0.32, Math.min(0.11, R - 0.03), Math.PI / 4],
    ];
    for (const [y, reach, off] of tiers) {
      for (const k of range(4)) {
        const a = off + (k * Math.PI) / 2;
        const c = Math.cos(a);
        const s = Math.sin(a);
        const pts: V3[] = [
          [c * 0.018, y, s * 0.018],
          [c * reach * 0.7, y - 0.02, s * reach * 0.7],
          [c * reach, y + 0.03, s * reach],
        ];
        parts.push(...rodPath('wood', pts, 0.008));
        parts.push(sphere('metal', [c * reach, y + 0.04, s * reach], 0.012, { plan: false }));
      }
    }
    // A felt hat on the top and a scarf hanging from a lower hook.
    const br = Math.min(0.14, R + 0.03);
    parts.push(
      cyl('hat', [0, poleTop + 0.03, 0], br, 0.008, { segments: 28, plan: false }),
      cyl('hat', [0, poleTop + 0.075, 0], 0.085, 0.09, { rTop: 0.075, segments: 24, plan: false }),
      cyl('scarf', [0, poleTop + 0.045, 0], 0.087, 0.02, { segments: 24, plan: false }),
    );
    const hy = poleTop - 0.32;
    const a = Math.PI / 4;
    const reach = Math.min(0.11, R - 0.03);
    const sx = Math.cos(a) * reach * 0.75;
    const sz = Math.sin(a) * reach * 0.75;
    // Tails hang either side of the hook (tangential offset), the fold wraps over it.
    const tx = -Math.sin(a) * 0.012;
    const tz = Math.cos(a) * 0.012;
    const rx = Math.cos(a) * 0.05;
    const rz = Math.sin(a) * 0.05;
    parts.push(
      box('scarf', [sx - tx, hy - 0.27, sz - tz], [0.11, 0.5, 0.012], { rotation: [0, -a, 0.03], bevel: 0.004, plan: false }),
      box('scarf', [sx + tx, hy - 0.23, sz + tz], [0.11, 0.42, 0.012], { rotation: [0, -a, -0.04], bevel: 0.004, plan: false }),
      rod('scarf', [sx - rx, hy - 0.02, sz - rz], [sx + rx, hy - 0.02, sz + rz], 0.02, { plan: false }),
    );
    return parts;
  },
  planDetail: ({ w, d }) => {
    const R = Math.min(w, d) / 2 - 0.02;
    return [circle([0, 0], Math.min(0.15, R - 0.02)), circle([0, 0], 0.02)];
  },
});

const hallTree = defineAsset({
  id: 'hall-tree',
  name: 'Hall tree with bench',
  category: 'storage',
  type: 'storage',
  group: 'Hallway storage',
  tags: ['hall tree', 'hall stand', 'entryway bench', 'coat rack', 'shoe bench', 'mudroom'],
  defaultSize: { w: 1.0, d: 0.42, h: 1.85 },
  minSize: { w: 0.7, d: 0.35, h: 1.6 },
  maxSize: { w: 1.4, d: 0.5, h: 2.0 },
  wallSnap: true,
  slots: [
    matSlot('frame', 'Frame', 'wood-painted-white'),
    matSlot('cushion', 'Cushion & scarf', 'fabric-linen'),
    matSlot('metal', 'Hooks & shoes', 'metal-black-matte'),
    matSlot('baskets', 'Baskets', 'rattan-natural'),
  ],
  build: ({ w, d, h }) => {
    const st = 0.04;
    const seatY = 0.46;
    const ud = Math.min(0.3, d - 0.05);
    const cubby = h - 0.3;
    const parts: Part[] = [];
    for (const side of [-1, 1]) {
      const sx: V2 = side < 0 ? [-w / 2, -w / 2 + st] : [w / 2 - st, w / 2];
      parts.push(span('frame', sx, [0, seatY + 0.18], [-d / 2, d / 2 - 0.01], { bevel: 0.006 }));
      parts.push(span('frame', sx, [seatY + 0.18, h - 0.03], [-d / 2, -d / 2 + 0.12], { plan: false }));
      parts.push(span('frame', sx, [cubby, h - 0.03], [-d / 2, -d / 2 + ud], { plan: false }));
    }
    const ix: V2 = [-w / 2 + st, w / 2 - st];
    parts.push(
      span('frame', [-w / 2, w / 2], [h - 0.03, h], [-d / 2, -d / 2 + ud + 0.015], { bevel: 0.005, plan: false }),
      span('frame', ix, [cubby - 0.02, cubby], [-d / 2, -d / 2 + ud], { plan: false }),
      // Bench seat, cushion, shoe shelf and kick rail.
      span('frame', ix, [seatY - 0.03, seatY], [-d / 2, d / 2 - 0.01], { plan: false }),
      cushion('cushion', [ix[0] + 0.01, ix[1] - 0.01], [seatY, seatY + 0.06], [-d / 2 + 0.13, d / 2 - 0.015], { plan: false }),
      span('frame', ix, [0.08, 0.1], [-d / 2 + 0.01, d / 2 - 0.03], { plan: false }),
      span('frame', ix, [0, 0.08], [d / 2 - 0.05, d / 2 - 0.03], { plan: false }),
      // Beadboard back panel.
      ...slats('frame', ix, [seatY, cubby - 0.02], [-d / 2, -d / 2 + 0.012], clamp(Math.round((w - 2 * st) / 0.08), 6, 16), { axis: 'x', gap: 0.06, plan: false }),
      span('frame', ix, [seatY, cubby - 0.02], [-d / 2, -d / 2 + 0.006], { plan: false }),
    );
    // Hook rail with double hooks.
    const hookY = cubby - 0.14;
    const zr = -d / 2 + 0.03;
    parts.push(span('frame', ix, [hookY - 0.045, hookY + 0.045], [-d / 2 + 0.012, zr], { bevel: 0.004, plan: false }));
    const nh = clamp(Math.round((w - 2 * st) / 0.22), 2, 6);
    const hxs = cells(nh, ix[0], ix[1]);
    for (const x of hxs) {
      parts.push(span('metal', [x - 0.012, x + 0.012], [hookY - 0.03, hookY + 0.03], [zr, zr + 0.004], { plan: false }));
      parts.push(...rodPath('metal', [[x, hookY - 0.01, zr], [x, hookY - 0.035, zr + 0.045], [x, hookY - 0.01, zr + 0.07]], 0.005));
      parts.push(...rodPath('metal', [[x, hookY + 0.015, zr], [x, hookY + 0.04, zr + 0.05]], 0.005));
      parts.push(sphere('metal', [x, hookY - 0.008, zr + 0.072], 0.008, { plan: false }));
    }
    // A scarf hanging from the first hook.
    const fx = hxs[0];
    parts.push(
      box('cushion', [fx, hookY - 0.24, zr + 0.06], [0.12, 0.42, 0.012], { rotation: [0.05, 0, 0.03], bevel: 0.004, plan: false }),
      box('cushion', [fx + 0.03, hookY - 0.2, zr + 0.075], [0.12, 0.36, 0.012], { rotation: [0.08, 0, -0.06], bevel: 0.004, plan: false }),
    );
    // Wicker baskets in the top cubby.
    const nb = clamp(Math.round((w - 2 * st) / 0.32), 2, 4);
    for (const [x0, x1] of cellSpans(nb, ix[0] + 0.01, ix[1] - 0.01)) {
      const bh = Math.min(0.2, h - 0.03 - cubby - 0.03);
      parts.push(span('baskets', [x0 + 0.01, x1 - 0.01], [cubby, cubby + bh], [-d / 2 + 0.02, -d / 2 + ud - 0.01], { bevel: 0.01, plan: false }));
      parts.push(span('baskets', [x0 + 0.008, x1 - 0.008], [cubby + bh - 0.02, cubby + bh], [-d / 2 + 0.018, -d / 2 + ud - 0.008], { bevel: 0.006, plan: false }));
    }
    // Pairs of shoes on the shelf.
    const np = clamp(Math.floor((w - 2 * st) / 0.25), 1, 4);
    const rand = rng(8);
    for (const x of cells(np, ix[0], ix[1])) {
      for (const dx of [-0.05, 0.05]) {
        const sz = d / 2 - 0.05 - 0.13 + (rand() - 0.5) * 0.02;
        parts.push(span('metal', [x + dx - 0.042, x + dx + 0.042], [0.1, 0.112], [sz - 0.13, sz + 0.13], { bevel: 0.006, plan: false }));
        parts.push(span('cushion', [x + dx - 0.04, x + dx + 0.04], [0.112, 0.17], [sz - 0.125, sz + 0.06], { bevel: 0.03, plan: false }));
      }
    }
    return parts;
  },
  planDetail: ({ w, d }) => [rectPoly(-w / 2 + 0.05, -d / 2 + 0.13, w / 2 - 0.05, d / 2 - 0.015)],
});

const shelfLadder = defineAsset({
  id: 'shelf-ladder',
  name: 'Leaning ladder shelf',
  category: 'storage',
  type: 'storage',
  group: 'Bookcases & shelves',
  tags: ['ladder shelf', 'leaning shelf', 'bookshelf', 'etagere', 'plant stand', 'scandi'],
  defaultSize: { w: 0.6, d: 0.42, h: 1.8 },
  minSize: { w: 0.4, d: 0.32, h: 1.4 },
  maxSize: { w: 0.9, d: 0.5, h: 2.1 },
  wallSnap: true,
  slots: [
    matSlot('wood', 'Wood', 'wood-oak-light'),
    matSlot('books', 'Books', 'book-mix'),
    matSlot('decor', 'Pots & vases', 'ceramic-white'),
    matSlot('plant', 'Plants', 'plant-leaf'),
  ],
  build: ({ w, d, h }) => {
    const tx = 0.035;
    const tz = 0.03;
    const zB = d / 2 - tz / 2 - 0.004;
    const zT = -d / 2 + tz / 2 + 0.006;
    const theta = Math.atan2(zB - zT, h);
    const Lr = Math.hypot(h, zB - zT) - tz * Math.sin(theta);
    const zr = (y: number): number => zB - ((zB - zT) * y) / h;
    const parts: Part[] = [];
    for (const x of [-w / 2 + tx / 2, w / 2 - tx / 2]) {
      parts.push(box('wood', [x, h / 2, (zB + zT) / 2], [tx, Lr, tz], { rotation: [-theta, 0, 0], bevel: 0.004 }));
    }
    const n = clamp(Math.round(h / 0.38), 3, 6);
    const ys = spaced(n, 0.14, h - 0.18);
    const ix: V2 = [-w / 2 + tx, w / 2 - tx];
    const iw = ix[1] - ix[0];
    ys.forEach((y, i) => {
      const zf = zr(y) + tz / 2;
      const sd = Math.min(0.36, zf + d / 2 - 0.006);
      if (sd < 0.1) {
        parts.push(rodX('wood', ix[0], ix[1], y - 0.012, zr(y), 0.012, { plan: false }));
        return;
      }
      const zb = zf - sd;
      parts.push(span('wood', ix, [y - 0.018, y], [zb, zf], { plan: false }));
      parts.push(span('wood', ix, [y, y + 0.035], [zb, zb + 0.012], { plan: false }));
      const clear = i < n - 1 ? ys[i + 1] - 0.018 - y : h - y;
      const maxD = Math.min(0.22, sd - 0.03);
      const zc = (zb + 0.012 + zf) / 2;
      const kind = i === 0 ? 0 : i % 3;
      if (kind === 0) {
        // Potted plant on the deepest shelf, with a basket of books beside it.
        const pr = Math.min(0.1, sd / 2 - 0.02, iw * 0.25);
        const ph = Math.min(0.18, clear * 0.45);
        const px = ix[0] + pr + 0.02;
        parts.push(pot('decor', [px, y, zc], pr, ph, 'taper'));
        parts.push(cyl('books', [px, y + ph * 0.93, zc], pr * 0.86, 0.006, { segments: 20, plan: false }));
        const fh = Math.min(0.4, clear - ph - 0.03);
        if (fh > 0.08) parts.push(...foliage('plant', [px, y + ph * 0.9, zc], Math.min(pr * 1.6, iw * 0.4), fh, 11, 5 + i, { spread: 0.7 }));
        if (iw - 2 * pr > 0.22 && maxD > 0.1) {
          parts.push(...bookStack('books', ix[1] - 0.12, zc, y, 3, 17, maxD));
        }
      } else if (kind === 1 && maxD > 0.1) {
        parts.push(...bookRow('books', [ix[0], ix[0] + iw * 0.6], y, zb + 0.014, Math.min(0.26, clear - 0.03), maxD, 33 + i * 5, { lean: true }));
        parts.push(vase('decor', [ix[1] - 0.06, y, zc], 0.04, Math.min(0.22, clear - 0.03), 'bottle'));
      } else {
        // A little succulent bowl and a candle.
        const br = Math.min(0.07, sd / 2 - 0.02);
        parts.push(pot('decor', [ix[0] + iw * 0.3, y, zc], br, 0.06, 'bowl'));
        parts.push(...blobCluster('plant', [ix[0] + iw * 0.3, y + 0.07, zc], Math.min(br, 0.05), 5, 9 + i));
        parts.push(vcyl('decor', ix[0] + iw * 0.72, zc, y, y + Math.min(0.12, clear - 0.04), Math.min(0.035, sd / 2 - 0.02), { segments: 16, plan: false }));
      }
    });
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w / 2 + 0.035, d / 2 - 0.02], [w / 2 - 0.035, d / 2 - 0.02])],
});

const wallHooks = defineAsset({
  id: 'wall-hooks',
  name: 'Wall hook rail',
  category: 'storage',
  type: 'storage',
  group: 'Hallway storage',
  tags: ['hooks', 'coat hooks', 'peg rail', 'hook rail', 'hallway', 'entryway', 'keys'],
  defaultSize: { w: 0.6, d: 0.08, h: 0.45 },
  minSize: { w: 0.3, d: 0.06, h: 0.12 },
  maxSize: { w: 1.2, d: 0.12, h: 0.8 },
  mount: 'wall',
  defaultElevation: 1.25,
  slots: [
    matSlot('board', 'Board', 'wood-oak-light'),
    matSlot('hooks', 'Hooks & keys', 'metal-black-matte'),
    matSlot('bag', 'Tote bag', 'leather-cognac'),
    matSlot('scarf', 'Scarf', 'fabric-mustard'),
  ],
  build: ({ w, d, h }) => {
    const bh = Math.min(0.12, h);
    const hy = h - bh / 2;
    const z0 = -d / 2 + 0.02;
    const zt = d / 2 - 0.012;
    const n = clamp(Math.round(w / 0.15), 2, 8);
    const xs = cells(n, -w / 2, w / 2);
    const parts: Part[] = [
      span('board', [-w / 2, w / 2], [h - bh, h], [-d / 2, z0], { bevel: 0.004 }),
      span('board', [-w / 2 + 0.006, w / 2 - 0.006], [h - bh + 0.006, h - 0.006], [z0, z0 + 0.003], { bevel: 0.001, plan: false }),
    ];
    for (const x of xs) {
      parts.push(discZ('hooks', [x, hy, z0 + 0.003], 0.013, 0.006, { segments: 16, plan: false }));
      parts.push(
        ...rodPath(
          'hooks',
          [
            [x, hy, z0 + 0.003],
            [x, hy - 0.022, z0 + (zt - z0) * 0.6],
            [x, hy - 0.024, zt],
            [x, hy - 0.002, zt + 0.003],
          ],
          0.0045,
        ),
      );
      parts.push(sphere('hooks', [x, hy + 0.001, zt + 0.003], 0.007, { plan: false }));
    }
    // Things hanging from the hooks when there is room below the board.
    const drop = h - bh - 0.01;
    if (drop > 0.2) {
      const hookLow = hy - 0.024;
      // Tote bag: two handles meeting at the hook, body flat against the wall.
      const bx = xs[0];
      const bw = Math.min(0.3, w * 0.4);
      const cx = clamp(bx, -w / 2 + bw / 2, w / 2 - bw / 2);
      const bagH = Math.min(0.32, drop - 0.12);
      const bagTop = hookLow - 0.1;
      parts.push(
        span('bag', [cx - bw / 2, cx + bw / 2], [bagTop - bagH, bagTop], [-d / 2 + 0.02, -d / 2 + 0.05], { bevel: 0.008, plan: false }),
        rod('bag', [cx - bw * 0.3, bagTop, -d / 2 + 0.04], [bx, hookLow, zt - 0.004], 0.005, { plan: false }),
        rod('bag', [cx + bw * 0.3, bagTop, -d / 2 + 0.04], [bx, hookLow, zt - 0.004], 0.005, { plan: false }),
      );
      if (n >= 3) {
        const sx = xs[n >= 4 ? 2 : 1];
        const len = Math.min(0.5, drop);
        parts.push(
          box('scarf', [sx - 0.02, hookLow - len / 2, zt - 0.02], [0.1, len, 0.012], { rotation: [0.03, 0, 0.04], bevel: 0.004, plan: false }),
          box('scarf', [sx + 0.02, hookLow - len * 0.42, zt - 0.008], [0.1, len * 0.84, 0.012], { rotation: [0.05, 0, -0.05], bevel: 0.004, plan: false }),
        );
      }
      // Keys on the last hook.
      const kx = xs[n - 1];
      parts.push(torus('hooks', [kx, hookLow - 0.02, zt - 0.004], 0.014, 0.0018, { plan: false }));
      parts.push(box('hooks', [kx - 0.008, hookLow - 0.055, zt - 0.004], [0.012, 0.04, 0.003], { rotation: [0, 0, 0.25], plan: false }));
      parts.push(box('hooks', [kx + 0.01, hookLow - 0.05, zt - 0.006], [0.012, 0.035, 0.003], { rotation: [0, 0, -0.35], plan: false }));
    }
    return parts;
  },
});

const umbrellaStand = defineAsset({
  id: 'umbrella-stand',
  name: 'Umbrella stand',
  category: 'storage',
  type: 'storage',
  group: 'Hallway storage',
  tags: ['umbrella stand', 'umbrella holder', 'hallway', 'entryway', 'rain'],
  defaultSize: { w: 0.26, d: 0.26, h: 0.62 },
  minSize: { w: 0.2, d: 0.2, h: 0.45 },
  maxSize: { w: 0.35, d: 0.35, h: 0.75 },
  slots: [
    matSlot('bin', 'Stand', 'metal-anthracite'),
    matSlot('canopy', 'Umbrella', 'fabric-navy'),
    matSlot('canopy2', 'Second umbrella', 'fabric-mustard'),
    matSlot('handle', 'Handles', 'wood-walnut'),
  ],
  build: ({ w, d, h }) => {
    const R = Math.min(w, d) / 2 - 0.006;
    const binH = h * 0.6;
    const parts: Part[] = [
      pot('bin', [0, 0, 0], R, binH, 'cylinder', { plan: true }),
      ring('bin', [0, 0.04, 0], R + 0.002, 0.004),
      ring('bin', [0, binH - 0.04, 0], R + 0.002, 0.004),
      ring('bin', [0, binH, 0], R - 0.002, 0.005),
    ];
    // Three folded umbrellas leaning outward; tips in the stand, handles above the rim.
    const specs: [number, string, 'hook' | 'straight', number][] = [
      [0.3, 'canopy', 'hook', 1],
      [2.4, 'canopy2', 'straight', 0.92],
      [4.3, 'canopy', 'straight', 0.8],
    ];
    for (const [az, slot, style, k] of specs) {
      const o = R * 0.5;
      const bp: V3 = [Math.cos(az) * o * 0.3, 0.02, Math.sin(az) * o * 0.3];
      const tp: V3 = [Math.cos(az) * o, (h - 0.09) * k, Math.sin(az) * o];
      const at = (t: number): V3 => [lerp(bp[0], tp[0], t), lerp(bp[1], tp[1], t), lerp(bp[2], tp[2], t)];
      const ub = 0.62;
      parts.push(
        rod(slot, at(0), at(0.12), 0.006, { rTop: 0.02, segments: 12, plan: false }),
        rod(slot, at(0.12), at(0.3), 0.02, { rTop: 0.032, segments: 12, plan: false }),
        rod(slot, at(0.3), at(ub), 0.032, { rTop: 0.012, segments: 12, plan: false }),
        rod('bin', at(0.4), at(0.43), 0.031, { segments: 12, plan: false }),
        rod('bin', at(ub), at(0.9), 0.005, { plan: false }),
      );
      const top = at(0.9);
      if (style === 'straight') {
        parts.push(rod('handle', top, at(1), 0.014, { segments: 12, plan: false }));
        parts.push(sphere('handle', at(1), 0.016, { plan: false }));
      } else {
        // J-hook curling back towards the middle of the stand.
        const ix = -Math.cos(az);
        const iz = -Math.sin(az);
        const hr = 0.035;
        const base = at(1);
        const pts: V3[] = [top, base];
        for (const t of [0.25, 0.5, 0.75, 1]) {
          const a = Math.PI * t;
          pts.push([base[0] + ix * hr * (1 - Math.cos(a)), base[1] + hr * Math.sin(a), base[2] + iz * hr * (1 - Math.cos(a))]);
        }
        parts.push(...rodPath('handle', pts, 0.009));
      }
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const R = Math.min(w, d) / 2 - 0.006;
    return [circle([0, 0], R - 0.008)];
  },
});

const basketsWicker = defineAsset({
  id: 'baskets-wicker',
  name: 'Wicker baskets',
  category: 'storage',
  type: 'storage',
  group: 'Baskets & boxes',
  tags: ['baskets', 'wicker', 'rattan', 'storage basket', 'blanket basket', 'laundry'],
  defaultSize: { w: 0.8, d: 0.4, h: 0.45 },
  minSize: { w: 0.4, d: 0.3, h: 0.25 },
  maxSize: { w: 1.2, d: 0.5, h: 0.6 },
  slots: [
    matSlot('wicker', 'Wicker', 'rattan-natural'),
    matSlot('textile', 'Blankets & yarn', 'fabric-cream'),
    matSlot('trim', 'Leather handles', 'leather-tan'),
  ],
  build: ({ w, d, h }) => {
    const n = clamp(Math.round(w / 0.36), 1, 3);
    const spans = cellSpans(n, -w / 2, w / 2);
    const parts: Part[] = [];
    const scaleR = [1, 0.85, 0.93];
    const scaleH = [1, 0.7, 0.82];
    spans.forEach(([x0, x1], i) => {
      const cx = (x0 + x1) / 2;
      const r = Math.min((x1 - x0) / 2 - 0.018, d / 2 - 0.01) * scaleR[i];
      const bh = (h - 0.07) * scaleH[i];
      parts.push(pot('wicker', [cx, 0, 0], r, bh, 'cylinder', { plan: true }));
      for (const y of spaced(3, bh * 0.2, bh * 0.8)) parts.push(ring('wicker', [cx, y, 0], r + 0.002, 0.005, { plan: false }));
      parts.push(ring('trim', [cx, bh, 0], r * 0.96, 0.008, { plan: false }));
      for (const side of [-1, 1]) {
        parts.push(torus('trim', [cx + side * (r + 0.006), bh - 0.05, 0], 0.024, 0.006, { rotation: [0, Math.PI / 2, 0], plan: false }));
      }
      if (i === 0) {
        // Rolled blankets poking out of the big basket.
        const rr = Math.min(0.06, r * 0.32);
        for (const [k, dx] of [-1, 0, 1].entries()) {
          if (Math.abs(dx) * rr * 2 + rr > r * 0.9) continue;
          parts.push(rodZ('textile', cx + dx * rr * 1.9, bh - 0.01 + (k === 1 ? 0.015 : 0), -r * 0.8, r * 0.8, rr, { segments: 16, plan: false }));
        }
      } else if (i === 1) {
        // A throw folded on top, its end draped over the front rim.
        parts.push(span('textile', [cx - r * 0.85, cx + r * 0.85], [bh - 0.02, bh + 0.025], [-r * 0.85, r * 0.85], { bevel: 0.015, plan: false }));
        parts.push(span('textile', [cx - r * 0.5, cx + r * 0.5], [bh - 0.14, bh + 0.02], [r + 0.004, r + 0.016], { bevel: 0.005, plan: false }));
      } else {
        // Balls of yarn with a pair of needles.
        const yr = Math.min(0.045, r * 0.35);
        for (const [dx, dz] of [
          [-0.4, 0.1],
          [0.35, -0.2],
          [0, 0.35],
        ] as V2[]) {
          parts.push(sphere('textile', [cx + dx * r, bh - 0.005, dz * r], yr, { plan: false }));
        }
        parts.push(rod('trim', [cx - r * 0.3, bh - 0.02, -r * 0.3], [cx + r * 0.2, bh + 0.05, -r * 0.1], 0.004, { plan: false }));
      }
    });
    return parts;
  },
  planDetail: ({ w, d }) => {
    const n = clamp(Math.round(w / 0.36), 1, 3);
    const scaleR = [1, 0.85, 0.93];
    const strokes: PlanStroke[] = [];
    cellSpans(n, -w / 2, w / 2).forEach(([x0, x1], i) => {
      const r = Math.min((x1 - x0) / 2 - 0.018, d / 2 - 0.01) * scaleR[i];
      strokes.push(circle([(x0 + x1) / 2, 0], r * 0.9));
    });
    return strokes;
  },
});

const storageTrunk = defineAsset({
  id: 'storage-trunk',
  name: 'Storage trunk',
  category: 'storage',
  type: 'storage',
  group: 'Dressers & chests',
  tags: ['trunk', 'chest', 'blanket box', 'steamer trunk', 'toy box', 'vintage'],
  defaultSize: { w: 0.9, d: 0.5, h: 0.5 },
  minSize: { w: 0.6, d: 0.4, h: 0.4 },
  maxSize: { w: 1.2, d: 0.6, h: 0.6 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Wood', 'wood-dark-stain'),
    matSlot('straps', 'Leather straps', 'leather-cognac'),
    matSlot('metal', 'Brass fittings', 'metal-brass'),
  ],
  build: ({ w, d, h }) => {
    const yb = 0.04;
    const lidH = Math.min(0.12, (h - yb) * 0.27);
    const ys = h - lidH;
    const parts: Part[] = [
      span('body', [-w / 2 + 0.008, w / 2 - 0.008], [yb, ys], [-d / 2 + 0.008, d / 2 - 0.008], { bevel: 0.006 }),
      span('body', [-w / 2, w / 2], [ys, h - 0.004], [-d / 2, d / 2], { bevel: 0.015 }),
      // Brass edge bands at the lid seam and the base.
      span('metal', [-w / 2 + 0.002, w / 2 - 0.002], [ys - 0.008, ys + 0.004], [-d / 2 + 0.002, d / 2 - 0.002], { plan: false }),
      span('metal', [-w / 2 + 0.004, w / 2 - 0.004], [yb, yb + 0.012], [-d / 2 + 0.004, d / 2 - 0.004], { plan: false }),
      // Lock plate and keyhole.
      span('metal', [-0.04, 0.04], [ys - 0.07, ys + 0.03], [d / 2 - 0.004, d / 2 + 0.003], { bevel: 0.004, plan: false }),
      span('body', [-0.004, 0.004], [ys - 0.045, ys - 0.025], [d / 2 + 0.003, d / 2 + 0.005], { plan: false }),
    ];
    for (const x of [-w / 2 + 0.05, w / 2 - 0.05]) {
      for (const z of [-d / 2 + 0.05, d / 2 - 0.05]) parts.push(turnedLeg('body', x, z, 0, yb, 0.03, { style: 'bun' }));
    }
    // Corner caps.
    const c = 0.045;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const xr: V2 = sx < 0 ? [-w / 2 - 0.002, -w / 2 + c] : [w / 2 - c, w / 2 + 0.002];
        const zr: V2 = sz < 0 ? [-d / 2 - 0.002, -d / 2 + c] : [d / 2 - c, d / 2 + 0.002];
        parts.push(span('metal', xr, [yb, yb + c], zr, { bevel: 0.004, plan: false }));
        parts.push(span('metal', xr, [h - c, h], zr, { bevel: 0.006, plan: false }));
      }
    }
    // Two leather straps over the lid with brass buckles.
    for (const x of [-w * 0.27, w * 0.27]) {
      parts.push(
        span('straps', [x - 0.026, x + 0.026], [yb + 0.02, h - 0.01], [d / 2 - 0.004, d / 2 + 0.002], { plan: false }),
        span('straps', [x - 0.026, x + 0.026], [h - 0.006, h + 0.002], [-d / 2 + 0.02, d / 2 - 0.01], { bevel: 0.002, plan: false }),
        span('straps', [x - 0.026, x + 0.026], [yb + 0.02, h - 0.01], [-d / 2 - 0.002, -d / 2 + 0.004], { plan: false }),
        ...frame4('metal', [x - 0.032, x + 0.032], [ys - 0.08, ys - 0.03], [d / 2 + 0.002, d / 2 + 0.006], 0.007),
      );
    }
    // Side carry handles.
    const hy = (yb + ys) / 2 + 0.04;
    for (const side of [-1, 1]) {
      const x = side * (w / 2 + 0.003);
      parts.push(span('metal', [Math.min(x, side * (w / 2 - 0.004)), Math.max(x, side * (w / 2 - 0.004))], [hy - 0.025, hy + 0.025], [-0.08, 0.08], { plan: false }));
      parts.push(rodZ('straps', side * (w / 2 + 0.011), hy - 0.03, -0.06, 0.06, 0.007, { plan: false }));
      for (const z of [-0.06, 0.06]) parts.push(rodX('metal', side * (w / 2), side * (w / 2 + 0.011), hy - 0.03, z, 0.004, { plan: false }));
    }
    // Studs along the lid edge.
    for (const x of spaced(clamp(Math.round(w / 0.08), 6, 14), -w / 2 + 0.07, w / 2 - 0.07)) {
      if (Math.abs(Math.abs(x) - w * 0.27) < 0.04 || Math.abs(x) < 0.05) continue;
      parts.push(sphere('metal', [x, ys + 0.016, d / 2], 0.005, { plan: false }));
    }
    return parts;
  },
  planDetail: ({ w, d }) => [
    line([-w * 0.27 - 0.026, -d / 2], [-w * 0.27 - 0.026, d / 2]),
    line([-w * 0.27 + 0.026, -d / 2], [-w * 0.27 + 0.026, d / 2]),
    line([w * 0.27 - 0.026, -d / 2], [w * 0.27 - 0.026, d / 2]),
    line([w * 0.27 + 0.026, -d / 2], [w * 0.27 + 0.026, d / 2]),
  ],
});

export const STORAGE_ASSETS: AssetDefinition[] = [
  sideboard,
  shelving,
  drawerUnit,
  shoeCabinet,
  cubeStorage,
  displayCabinet,
  wineRack,
  coatStand,
  hallTree,
  shelfLadder,
  wallHooks,
  umbrellaStand,
  basketsWicker,
  storageTrunk,
];

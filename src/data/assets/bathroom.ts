import type { AssetDefinition, Part, PlanStroke } from './types';
import {
  cellSpans,
  circle,
  clamp,
  cyl,
  defineAsset,
  discZ,
  ellipsePoints,
  fronts,
  lathe,
  line,
  matSlot,
  poly,
  rodX,
  rodZ,
  roundRectPoints,
  span,
  spaced,
  sphere,
  vcyl,
  type FrontSpec,
  type V2,
} from './parts';

const toilet = defineAsset({
  id: 'toilet',
  name: 'Toilet',
  category: 'bathroom',
  tags: ['wc', 'toilet', 'lavatory', 'loo', 'commode'],
  defaultSize: { w: 0.38, d: 0.68, h: 0.78 },
  minSize: { w: 0.34, d: 0.55, h: 0.65 },
  maxSize: { w: 0.45, d: 0.8, h: 0.9 },
  wallSnap: true,
  slots: [
    matSlot('ceramic', 'Ceramic', 'ceramic-white'),
    matSlot('seat', 'Seat & lid', 'ceramic-white'),
    matSlot('flush', 'Flush button', 'metal-chrome'),
  ],
  build: ({ w, d, h }) => {
    const tankD = clamp(d * 0.25, 0.14, 0.2);
    const seatY = clamp(h * 0.52, 0.36, 0.44);
    const rx = w / 2 - 0.01;
    // Bowl half-depth; overlaps the tank slightly so the two read as one piece.
    const rz = (d - tankD) / 2 + 0.03;
    const bz = d / 2 - rz;
    const sz = rz / rx;
    return [
      span('ceramic', [-w / 2 + 0.01, w / 2 - 0.01], [seatY - 0.08, h - 0.03], [-d / 2, -d / 2 + tankD], {
        bevel: 0.015,
      }),
      span('ceramic', [-w / 2, w / 2], [h - 0.03, h - 0.004], [-d / 2, -d / 2 + tankD + 0.01], {
        bevel: 0.01,
      }),
      vcyl('flush', 0, -d / 2 + tankD / 2, h - 0.006, h, 0.025, { plan: false }),
      cyl('ceramic', [0, 0.1, bz], rx * 0.55, 0.2, { scale: [1, 1, sz], segments: 32, plan: false }),
      cyl('ceramic', [0, (0.18 + seatY - 0.02) / 2, bz], rx * 0.72, seatY - 0.2, {
        rTop: rx,
        scale: [1, 1, sz],
        segments: 32,
      }),
      cyl('seat', [0, seatY - 0.01, bz], rx + 0.005, 0.02, {
        scale: [1, 1, rz / (rx + 0.005)],
        segments: 32,
      }),
      cyl('seat', [0, seatY + 0.0075, bz], rx - 0.005, 0.015, {
        scale: [1, 1, (rz - 0.01) / (rx - 0.005)],
        segments: 32,
      }),
    ];
  },
});

function vanityLayout(w: number, d: number, h: number) {
  const n = w >= 1.2 ? 2 : 1;
  const R = Math.min(0.2, (w / n) * 0.36, d * 0.38);
  const bz = 0.02;
  return {
    ct: h - 0.25,
    n,
    R,
    bz,
    zt: bz - R - 0.04,
    xs: cellSpans(n, -w / 2, w / 2).map(([a, b]) => (a + b) / 2),
  };
}

const vanity = defineAsset({
  id: 'vanity-basin',
  name: 'Vanity with basin',
  category: 'bathroom',
  tags: ['vanity', 'basin', 'sink', 'washbasin', 'bathroom cabinet'],
  defaultSize: { w: 0.8, d: 0.48, h: 1.05 },
  minSize: { w: 0.5, d: 0.38, h: 0.95 },
  maxSize: { w: 1.6, d: 0.6, h: 1.2 },
  wallSnap: true,
  slots: [
    matSlot('cabinet', 'Cabinet', 'wood-oak-light'),
    matSlot('top', 'Countertop', 'stone-marble-carrara'),
    matSlot('basin', 'Basin', 'ceramic-white'),
    matSlot('tap', 'Tap', 'metal-chrome'),
  ],
  build: ({ w, d, h }) => {
    const L = vanityLayout(w, d, h);
    const plinth = 0.12;
    const zf = d / 2 - 0.02;
    const specs: FrontSpec[] = [];
    for (const x of cellSpans(w >= 1.1 ? 2 : 1, -w / 2, w / 2)) {
      for (const y of cellSpans(2, plinth, L.ct - 0.03)) specs.push({ x, y });
    }
    const parts: Part[] = [
      span('cabinet', [-w / 2 + 0.01, w / 2 - 0.01], [0, plinth], [-d / 2, zf - 0.05], { plan: false }),
      span('cabinet', [-w / 2, w / 2], [plinth, L.ct - 0.03], [-d / 2, zf]),
      ...fronts('cabinet', 'cabinet', specs, zf, 0.02, 0),
      span('top', [-w / 2, w / 2], [L.ct - 0.03, L.ct], [-d / 2, d / 2]),
    ];
    const R = L.R;
    for (const x of L.xs) {
      parts.push(
        lathe(
          'basin',
          [x, L.ct, L.bz],
          [
            [0, 0],
            [R * 0.55, 0],
            [R * 0.85, 0.03],
            [R * 0.98, 0.09],
            [R, 0.13],
            [R - 0.012, 0.13],
            [R * 0.86, 0.08],
            [R * 0.5, 0.035],
            [0, 0.03],
          ],
          { segments: 40 },
        ),
      );
      parts.push(vcyl('tap', x, L.zt, L.ct, h - 0.014, 0.014, { plan: false }));
      parts.push(sphere('tap', [x, h - 0.014, L.zt], 0.014, { plan: false }));
      parts.push(rodZ('tap', x, h - 0.014, L.zt, L.zt + R * 0.8, 0.009, { plan: false }));
    }
    return parts;
  },
  planDetail: ({ w, d, h }) => {
    const L = vanityLayout(w, d, h);
    const strokes: PlanStroke[] = [];
    for (const x of L.xs) {
      strokes.push(circle([x, L.bz], L.R - 0.012), circle([x, L.bz], 0.02), circle([x, L.zt], 0.014));
    }
    return strokes;
  },
});

const basinPedestal = defineAsset({
  id: 'basin-pedestal',
  name: 'Pedestal basin',
  category: 'bathroom',
  tags: ['basin', 'sink', 'washbasin', 'pedestal', 'lavatory'],
  defaultSize: { w: 0.55, d: 0.45, h: 0.92 },
  minSize: { w: 0.4, d: 0.35, h: 0.8 },
  maxSize: { w: 0.75, d: 0.6, h: 1.0 },
  wallSnap: true,
  slots: [matSlot('ceramic', 'Ceramic', 'ceramic-white'), matSlot('tap', 'Tap', 'metal-chrome')],
  build: ({ w, d, h }) => {
    const rim = h - 0.07;
    const bowlH = 0.17;
    const yb = rim - bowlH;
    const pz = -d * 0.12;
    const tz = -d / 2 + 0.035;
    return [
      lathe(
        'ceramic',
        [0, 0, pz],
        [
          [0, 0],
          [0.11, 0],
          [0.09, 0.04],
          [0.075, yb * 0.5],
          [0.085, yb + 0.02],
          [0, yb + 0.02],
        ],
        { segments: 32, plan: false },
      ),
      // Unit-radius bowl stretched to the footprint ellipse.
      lathe(
        'ceramic',
        [0, yb, 0],
        [
          [0, 0],
          [0.55, 0],
          [0.85, 0.06],
          [1, 0.15],
          [1, bowlH],
          [0.88, bowlH],
          [0.75, 0.08],
          [0, 0.05],
        ],
        { scale: [w / 2, 1, d / 2], segments: 40 },
      ),
      span('ceramic', [-w * 0.3, w * 0.3], [rim - 0.1, rim + 0.012], [-d / 2, -d / 2 + 0.07], {
        bevel: 0.01,
      }),
      vcyl('tap', 0, tz, rim + 0.012, h - 0.012, 0.012, { plan: false }),
      sphere('tap', [0, h - 0.012, tz], 0.012, { plan: false }),
      rodZ('tap', 0, h - 0.012, tz, tz + 0.1, 0.008, { plan: false }),
    ];
  },
  planDetail: ({ w, d }) => [poly(ellipsePoints(0, 0, w * 0.44, d * 0.44)), circle([0, 0], 0.02)],
});

const shower = defineAsset({
  id: 'shower-tray',
  name: 'Shower tray with glass screen',
  category: 'bathroom',
  tags: ['shower', 'walk-in', 'shower tray', 'screen', 'enclosure'],
  defaultSize: { w: 0.9, d: 0.9, h: 2.0 },
  minSize: { w: 0.7, d: 0.7, h: 1.8 },
  maxSize: { w: 1.8, d: 1.4, h: 2.3 },
  wallSnap: true,
  slots: [
    matSlot('tray', 'Tray', 'ceramic-white'),
    matSlot('glass', 'Glass', 'glass-clear'),
    matSlot('metal', 'Fittings', 'metal-chrome'),
  ],
  build: ({ w, d, h }) => {
    const trayH = 0.04;
    const gw = clamp(w * 0.6, 0.5, w - 0.1);
    const headZ = -d / 2 + Math.min(0.3, d * 0.35);
    const headR = Math.min(0.12, w * 0.15, d * 0.15);
    return [
      span('tray', [-w / 2, w / 2], [0, trayH], [-d / 2, d / 2], { bevel: 0.005 }),
      span('glass', [-w / 2 + 0.02, -w / 2 + gw], [trayH, h - 0.02], [d / 2 - 0.03, d / 2 - 0.02]),
      span('metal', [-w / 2, -w / 2 + 0.02], [trayH, h - 0.02], [d / 2 - 0.035, d / 2 - 0.015]),
      rodZ('metal', -w / 2 + gw - 0.03, h - 0.03, -d / 2, d / 2 - 0.025, 0.01, { plan: false }),
      vcyl('metal', 0, -d / 2 + 0.02, 0.9, h - 0.05, 0.012, { plan: false }),
      rodZ('metal', 0, h - 0.05, -d / 2, headZ, 0.01, { plan: false }),
      cyl('metal', [0, h - 0.065, headZ], headR, 0.012, { segments: 32, plan: false }),
      discZ('metal', [0, 1.1, -d / 2 + 0.015], 0.04, 0.03, { plan: false }),
    ];
  },
  planDetail: ({ w, d }) => [
    line([-w / 2, -d / 2], [w / 2, d / 2]),
    line([-w / 2, d / 2], [w / 2, -d / 2]),
    circle([0, 0], 0.045),
  ],
});

const bathtub = defineAsset({
  id: 'bathtub',
  name: 'Bathtub',
  category: 'bathroom',
  tags: ['bath', 'tub', 'bathtub', 'soaking'],
  defaultSize: { w: 1.7, d: 0.75, h: 0.58 },
  minSize: { w: 1.4, d: 0.65, h: 0.45 },
  maxSize: { w: 2.0, d: 0.95, h: 0.7 },
  wallSnap: true,
  slots: [matSlot('tub', 'Tub', 'ceramic-white'), matSlot('metal', 'Fittings', 'metal-chrome')],
  build: ({ w, d, h }) => {
    const te = 0.1;
    const ts = 0.07;
    const base = 0.12;
    const xi: V2 = [-w / 2 + te, w / 2 - te];
    return [
      span('tub', [-w / 2, w / 2], [0, base], [-d / 2, d / 2]),
      span('tub', [-w / 2, -w / 2 + te], [base, h], [-d / 2, d / 2], { bevel: 0.01 }),
      span('tub', [w / 2 - te, w / 2], [base, h], [-d / 2, d / 2], { bevel: 0.01 }),
      span('tub', xi, [base, h], [-d / 2, -d / 2 + ts], { bevel: 0.01 }),
      span('tub', xi, [base, h], [d / 2 - ts, d / 2], { bevel: 0.01 }),
      cyl('metal', [w / 2 - te - 0.12, base + 0.002, 0], 0.025, 0.004, { plan: false }),
      cyl('metal', [w / 2 - te - 0.003, h - 0.12, 0], 0.03, 0.006, {
        rotation: [0, 0, Math.PI / 2],
        plan: false,
      }),
      span('metal', [w / 2 - te - 0.12, w / 2 - te], [h - 0.06, h - 0.035], [-0.025, 0.025], { plan: false }),
    ];
  },
  planDetail: ({ w, d }) => [
    poly(roundRectPoints(0, 0, w - 0.2, d - 0.14, 0.12)),
    circle([w / 2 - 0.22, 0], 0.025),
  ],
});

const towelRail = defineAsset({
  id: 'towel-rail',
  name: 'Heated towel rail',
  category: 'bathroom',
  tags: ['towel rail', 'towel warmer', 'ladder', 'radiator', 'towel'],
  defaultSize: { w: 0.5, d: 0.1, h: 0.8 },
  minSize: { w: 0.3, d: 0.06, h: 0.4 },
  maxSize: { w: 1.0, d: 0.15, h: 1.8 },
  mount: 'wall',
  defaultElevation: 0.4,
  slots: [matSlot('metal', 'Finish', 'metal-chrome')],
  build: ({ w, d, h }) => {
    const zp = d / 2 - 0.015;
    const px = w / 2 - 0.015;
    const n = clamp(Math.round(h / 0.08), 3, 16);
    const parts: Part[] = [vcyl('metal', -px, zp, 0, h, 0.015), vcyl('metal', px, zp, 0, h, 0.015)];
    spaced(n, 0.04, h - 0.04).forEach((y, i) =>
      parts.push(rodX('metal', -px, px, y, zp, 0.01, { plan: i === n - 1 })),
    );
    for (const x of [-px, px]) {
      for (const y of [0.1, h - 0.1]) parts.push(rodZ('metal', x, y, -d / 2, zp, 0.008, { plan: false }));
    }
    return parts;
  },
});

const bathroomMirror = defineAsset({
  id: 'bathroom-mirror',
  name: 'Bathroom mirror',
  category: 'bathroom',
  tags: ['mirror', 'vanity mirror', 'wall mirror', 'bathroom'],
  defaultSize: { w: 0.6, d: 0.03, h: 0.8 },
  minSize: { w: 0.3, d: 0.02, h: 0.3 },
  maxSize: { w: 1.8, d: 0.06, h: 1.4 },
  mount: 'wall',
  defaultElevation: 1.1,
  slots: [matSlot('glass', 'Mirror', 'glass-mirror'), matSlot('frame', 'Frame', 'metal-black-matte')],
  build: ({ w, d, h }) => {
    const f = Math.min(0.015, w * 0.05, h * 0.05);
    return [
      span('frame', [-w / 2, w / 2], [0, h], [-d / 2, d / 2 - 0.006], { bevel: 0.004 }),
      span('glass', [-w / 2 + f, w / 2 - f], [f, h - f], [d / 2 - 0.006, d / 2]),
    ];
  },
});

export const BATHROOM_ASSETS: AssetDefinition[] = [
  toilet,
  vanity,
  basinPedestal,
  shower,
  bathtub,
  towelRail,
  bathroomMirror,
];

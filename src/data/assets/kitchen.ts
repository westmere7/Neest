import type { AssetDefinition, Part, PlanStroke } from './types';
import {
  cellSpans,
  circle,
  clamp,
  cyl,
  defineAsset,
  discZ,
  fronts,
  legs4,
  line,
  matSlot,
  mirrorZ,
  poly,
  rectPoly,
  ring,
  rodZ,
  roundRectPoints,
  span,
  sphere,
  torus,
  vcyl,
  type FrontSpec,
  type V2,
} from './parts';

/** Standard kitchen joinery dimensions (metres). */
const PLINTH = 0.1;
const TOP_T = 0.04;
const FRONT_T = 0.02;
const HANDLE_D = 0.025;
/** Carcass front plane for a unit of depth d (fronts + handles sit in front of it). */
const faceZ = (d: number): number => d / 2 - FRONT_T - HANDLE_D;

const FRONT_SLOT = matSlot('front', 'Fronts & carcass', 'laminate-white-matte');
const WORKTOP_SLOT = matSlot('worktop', 'Worktop', 'stone-marble-carrara');
const HANDLE_SLOT = matSlot('handle', 'Handles', 'metal-brushed-steel');

/** Recessed plinth + carcass box from the plinth up to `carcassTop`. */
function baseShell(w: number, d: number, carcassTop: number): Part[] {
  const zf = faceZ(d);
  return [
    span('front', [-w / 2, w / 2], [0, PLINTH], [-d / 2, zf - 0.05], { plan: false }),
    span('front', [-w / 2, w / 2], [PLINTH, carcassTop], [-d / 2, zf]),
  ];
}

/** Worktop with a rectangular cut-out [cx0, cx1] × [cz0, cz1] (four slabs around the hole). */
function worktopAround(w: number, d: number, y: V2, cx: V2, cz: V2): Part[] {
  const parts: Part[] = [];
  if (cx[0] > -w / 2 + 0.001) parts.push(span('worktop', [-w / 2, cx[0]], y, [-d / 2, d / 2]));
  if (cx[1] < w / 2 - 0.001) parts.push(span('worktop', [cx[1], w / 2], y, [-d / 2, d / 2]));
  if (cz[0] > -d / 2 + 0.001) parts.push(span('worktop', cx, y, [-d / 2, cz[0]]));
  if (cz[1] < d / 2 - 0.001) parts.push(span('worktop', cx, y, [cz[1], d / 2]));
  return parts;
}

const baseCabinet = defineAsset({
  id: 'kitchen-base-cabinet',
  name: 'Kitchen base cabinet',
  category: 'kitchen',
  type: 'surfaces',
  group: 'Counters & cabinets',
  tags: ['cabinet', 'base unit', 'cupboard', 'counter', 'worktop', 'drawer'],
  defaultSize: { w: 0.6, d: 0.6, h: 0.9 },
  minSize: { w: 0.3, d: 0.45, h: 0.7 },
  maxSize: { w: 1.2, d: 0.7, h: 1.0 },
  wallSnap: true,
  slots: [FRONT_SLOT, WORKTOP_SLOT, HANDLE_SLOT],
  build: ({ w, d, h }) => {
    const y1 = h - TOP_T;
    const drawerH = clamp((y1 - PLINTH) * 0.2, 0.12, 0.18);
    const specs: FrontSpec[] = [{ x: [-w / 2, w / 2], y: [y1 - drawerH, y1], handle: { kind: 'bar-h' } }];
    for (const x of cellSpans(w > 0.65 ? 2 : 1, -w / 2, w / 2)) {
      specs.push({ x, y: [PLINTH, y1 - drawerH], handle: { kind: 'bar-h', y: y1 - drawerH - 0.05 } });
    }
    return [
      ...baseShell(w, d, y1),
      span('worktop', [-w / 2, w / 2], [y1, h], [-d / 2, d / 2]),
      ...fronts('front', 'handle', specs, faceZ(d), FRONT_T, HANDLE_D),
    ];
  },
});

const wallCabinet = defineAsset({
  id: 'kitchen-wall-cabinet',
  name: 'Kitchen wall cabinet',
  category: 'kitchen',
  type: 'storage',
  group: 'Kitchen cabinets',
  tags: ['cabinet', 'wall unit', 'upper cabinet', 'cupboard'],
  defaultSize: { w: 0.6, d: 0.35, h: 0.72 },
  minSize: { w: 0.3, d: 0.25, h: 0.3 },
  maxSize: { w: 1.2, d: 0.45, h: 1.0 },
  mount: 'wall',
  defaultElevation: 1.45,
  slots: [FRONT_SLOT, HANDLE_SLOT],
  build: ({ w, d, h }) => {
    const zf = faceZ(d);
    const specs: FrontSpec[] = cellSpans(w > 0.65 ? 2 : 1, -w / 2, w / 2).map((x) => ({
      x,
      y: [0, h],
      handle: { kind: 'bar-h', y: Math.min(0.05, h * 0.15) },
    }));
    return [
      span('front', [-w / 2, w / 2], [0, h], [-d / 2, zf]),
      ...fronts('front', 'handle', specs, zf, FRONT_T, HANDLE_D),
    ];
  },
  // High-level units are crossed through on plans.
  planDetail: ({ w, d }) => [line([-w / 2, -d / 2], [w / 2, d / 2]), line([-w / 2, d / 2], [w / 2, -d / 2])],
});

const tallCabinet = defineAsset({
  id: 'kitchen-tall-cabinet',
  name: 'Tall pantry cabinet',
  category: 'kitchen',
  type: 'storage',
  group: 'Kitchen cabinets',
  tags: ['pantry', 'larder', 'tall unit', 'cupboard', 'cabinet'],
  defaultSize: { w: 0.6, d: 0.6, h: 2.2 },
  minSize: { w: 0.3, d: 0.45, h: 1.6 },
  maxSize: { w: 1.2, d: 0.7, h: 2.5 },
  wallSnap: true,
  slots: [FRONT_SLOT, HANDLE_SLOT],
  build: ({ w, d, h }) => {
    const split = PLINTH + (h - PLINTH) * 0.62;
    const specs: FrontSpec[] = [];
    for (const x of cellSpans(w > 0.65 ? 2 : 1, -w / 2, w / 2)) {
      specs.push({ x, y: [PLINTH, split], handle: { kind: 'bar-h', y: split - 0.05 } });
      specs.push({ x, y: [split, h], handle: { kind: 'bar-h', y: split + 0.05 } });
    }
    return [...baseShell(w, d, h), ...fronts('front', 'handle', specs, faceZ(d), FRONT_T, HANDLE_D)];
  },
});

const island = defineAsset({
  id: 'kitchen-island',
  name: 'Kitchen island',
  category: 'kitchen',
  type: 'surfaces',
  group: 'Counters & cabinets',
  tags: ['island', 'breakfast bar', 'counter', 'waterfall', 'peninsula'],
  defaultSize: { w: 1.8, d: 0.9, h: 0.92 },
  minSize: { w: 1.0, d: 0.6, h: 0.85 },
  maxSize: { w: 3.0, d: 1.4, h: 1.1 },
  slots: [WORKTOP_SLOT, matSlot('front', 'Fronts', 'laminate-sage'), HANDLE_SLOT],
  build: ({ w, d, h }) => {
    const t = 0.04;
    const overhang = clamp(d * 0.33, 0.2, 0.35);
    const zCarcassFront = d / 2 - overhang;
    const xi: V2 = [-w / 2 + t, w / 2 - t];
    const parts: Part[] = [
      span('worktop', [-w / 2, w / 2], [h - t, h], [-d / 2, d / 2]),
      span('worktop', [-w / 2, -w / 2 + t], [0, h - t], [-d / 2, d / 2]),
      span('worktop', [w / 2 - t, w / 2], [0, h - t], [-d / 2, d / 2]),
      span('front', xi, [PLINTH, h - t], [-d / 2 + FRONT_T + HANDLE_D, zCarcassFront]),
      span('front', xi, [0, PLINTH], [-d / 2 + 0.08, zCarcassFront - 0.02], { plan: false }),
    ];
    // Drawers face the cook on the back (-z); the overhang at +z gives knee space for stools.
    const yTop = h - t;
    const specs: FrontSpec[] = [];
    for (const x of cellSpans(clamp(Math.round((w - 2 * t) / 0.6), 1, 5), xi[0], xi[1])) {
      specs.push({ x, y: [yTop - 0.2, yTop], handle: { kind: 'bar-h' } });
      specs.push({ x, y: [PLINTH, yTop - 0.2], handle: { kind: 'bar-h', y: yTop - 0.25 } });
    }
    // Build on the +z side, then mirror onto the back face.
    parts.push(...mirrorZ(fronts('front', 'handle', specs, d / 2 - FRONT_T - HANDLE_D, FRONT_T, HANDLE_D)));
    return parts;
  },
  planDetail: ({ w, d }) => {
    const z = d / 2 - clamp(d * 0.33, 0.2, 0.35);
    return [line([-w / 2 + 0.04, z], [w / 2 - 0.04, z])];
  },
});

// ---------------------------------------------------------------------------
// Wet & hot units
// ---------------------------------------------------------------------------

const TAP_H = 0.27;

function sinkLayout(w: number, d: number, h: number) {
  const top = h - TAP_H;
  const bw = clamp(w - 0.2, 0.3, 0.8);
  const bd = clamp(d - 0.2, 0.3, 0.42);
  const bz = 0.03;
  return { top, bw, bd, bz, bz0: bz - bd / 2, bz1: bz + bd / 2, zt: bz - bd / 2 - 0.045 };
}

const sinkUnit = defineAsset({
  id: 'kitchen-sink-unit',
  name: 'Sink unit',
  category: 'kitchen',
  type: 'plumbing',
  group: 'Sinks',
  tags: ['sink', 'basin', 'tap', 'faucet', 'base unit', 'kitchen sink'],
  defaultSize: { w: 0.8, d: 0.6, h: 0.9 + TAP_H },
  minSize: { w: 0.6, d: 0.5, h: 1.0 },
  maxSize: { w: 1.2, d: 0.7, h: 1.3 },
  wallSnap: true,
  slots: [
    FRONT_SLOT,
    WORKTOP_SLOT,
    matSlot('sink', 'Sink', 'metal-brushed-steel'),
    matSlot('tap', 'Tap & handles', 'metal-chrome'),
  ],
  build: ({ w, d, h }) => {
    const L = sinkLayout(w, d, h);
    const zf = faceZ(d);
    const yt0 = L.top - TOP_T;
    const yb = L.top - 0.2; // basin floor
    const wt = 0.008;
    const bx: V2 = [-L.bw / 2, L.bw / 2];
    const bzr: V2 = [L.bz0, L.bz1];
    const parts: Part[] = [
      span('front', [-w / 2, w / 2], [0, PLINTH], [-d / 2, zf - 0.05], { plan: false }),
      span('front', [-w / 2, w / 2], [PLINTH, yb - 0.01], [-d / 2, zf]),
      span('front', [-w / 2, -w / 2 + 0.018], [yb - 0.01, yt0], [-d / 2, zf], { plan: false }),
      span('front', [w / 2 - 0.018, w / 2], [yb - 0.01, yt0], [-d / 2, zf], { plan: false }),
      span('front', [-w / 2 + 0.018, w / 2 - 0.018], [yb - 0.01, yt0], [-d / 2, -d / 2 + 0.018], {
        plan: false,
      }),
      ...worktopAround(w, d, [yt0, L.top], bx, bzr),
      span('sink', bx, [yb, yb + wt], bzr, { plan: false }),
      span('sink', [bx[0], bx[0] + wt], [yb, L.top], bzr, { plan: false }),
      span('sink', [bx[1] - wt, bx[1]], [yb, L.top], bzr, { plan: false }),
      span('sink', [bx[0] + wt, bx[1] - wt], [yb, L.top], [L.bz0, L.bz0 + wt], { plan: false }),
      span('sink', [bx[0] + wt, bx[1] - wt], [yb, L.top], [L.bz1 - wt, L.bz1], { plan: false }),
      cyl('sink', [0, yb + wt + 0.002, L.bz], 0.035, 0.004, { plan: false }),
      // Gooseneck tap behind the basin.
      vcyl('tap', 0, L.zt, L.top, h - 0.016, 0.016),
      sphere('tap', [0, h - 0.016, L.zt], 0.016, { plan: false }),
      rodZ('tap', 0, h - 0.016, L.zt, L.zt + Math.min(0.2, L.bd * 0.55), 0.011, { plan: false }),
      vcyl('tap', 0, L.zt + Math.min(0.2, L.bd * 0.55), h - 0.06, h - 0.016, 0.011, { plan: false }),
      span('tap', [0.016, 0.07], [h - 0.1, h - 0.088], [L.zt - 0.006, L.zt + 0.006], { plan: false }),
    ];
    const specs: FrontSpec[] = cellSpans(w > 0.65 ? 2 : 1, -w / 2, w / 2).map((x) => ({
      x,
      y: [PLINTH, yt0],
      handle: { kind: 'bar-h', y: yt0 - 0.05 },
    }));
    parts.push(...fronts('front', 'tap', specs, zf, FRONT_T, HANDLE_D));
    return parts;
  },
  planDetail: ({ w, d, h }) => {
    const L = sinkLayout(w, d, h);
    return [
      poly(roundRectPoints(0, L.bz, L.bw - 0.03, L.bd - 0.03, 0.05)),
      circle([0, L.bz], 0.035),
      circle([0, L.zt], 0.02),
    ];
  },
});

function hobLayout(w: number, d: number) {
  const hw = Math.min(w - 0.06, 0.58);
  const hd = Math.min(d - 0.1, 0.52);
  const r = Math.min(hw, hd) * 0.19;
  const burners: [number, number, number][] =
    hw >= 0.5
      ? [
          [-hw / 4, -hd / 4, r],
          [hw / 4, -hd / 4, r * 0.8],
          [-hw / 4, hd / 4, r * 0.8],
          [hw / 4, hd / 4, r],
        ]
      : [
          [0, -hd / 4, Math.min(r * 1.2, hd / 4 - 0.01)],
          [0, hd / 4, Math.min(r, hd / 4 - 0.01)],
        ];
  return { hw, hd, burners };
}

const cooktopUnit = defineAsset({
  id: 'kitchen-cooktop',
  name: 'Cooktop & oven unit',
  category: 'kitchen',
  type: 'appliances',
  group: 'Cooking',
  tags: ['hob', 'cooktop', 'stove', 'oven', 'range', 'cooker'],
  defaultSize: { w: 0.6, d: 0.6, h: 0.9 },
  minSize: { w: 0.45, d: 0.5, h: 0.8 },
  maxSize: { w: 1.0, d: 0.7, h: 1.0 },
  wallSnap: true,
  slots: [
    FRONT_SLOT,
    WORKTOP_SLOT,
    matSlot('hob', 'Hob & oven glass', 'screen-black'),
    matSlot('metal', 'Metal trim', 'metal-brushed-steel'),
  ],
  build: ({ w, d, h }) => {
    const { hw, hd, burners } = hobLayout(w, d);
    const zf = faceZ(d);
    const yt0 = h - TOP_T;
    const parts: Part[] = [
      ...baseShell(w, d, yt0),
      ...worktopAround(w, d, [yt0, h], [-hw / 2, hw / 2], [-hd / 2, hd / 2]),
      span('hob', [-hw / 2, hw / 2], [h - 0.045, h], [-hd / 2, hd / 2]),
    ];
    for (const [x, z, r] of burners) {
      parts.push(ring('metal', [x, h - 0.003, z], r, 0.003, { plan: false }));
      parts.push(ring('metal', [x, h - 0.003, z], r * 0.55, 0.003, { plan: false }));
    }
    const ovenTop = yt0 - 0.1;
    const drawerTop = PLINTH + 0.14;
    parts.push(
      ...fronts(
        'front',
        'metal',
        [{ x: [-w / 2, w / 2], y: [PLINTH, drawerTop], handle: { kind: 'bar-h' } }],
        zf,
        FRONT_T,
        HANDLE_D,
      ),
    );
    parts.push(
      ...fronts(
        'hob',
        'metal',
        [
          {
            x: [-w / 2, w / 2],
            y: [drawerTop, ovenTop],
            handle: { kind: 'bar-h', y: ovenTop - 0.04, len: w * 0.7 },
          },
        ],
        zf,
        FRONT_T,
        HANDLE_D,
      ),
    );
    parts.push(...fronts('metal', 'metal', [{ x: [-w / 2, w / 2], y: [ovenTop, yt0] }], zf, FRONT_T, 0));
    return parts;
  },
  planDetail: ({ w, d }) => {
    const { hw, hd, burners } = hobLayout(w, d);
    const strokes: PlanStroke[] = [rectPoly(-hw / 2, -hd / 2, hw / 2, hd / 2)];
    for (const [x, z, r] of burners) {
      strokes.push(circle([x, z], r));
      strokes.push(circle([x, z], r * 0.55));
    }
    return strokes;
  },
});

const ovenTower = defineAsset({
  id: 'kitchen-oven-tower',
  name: 'Oven tower',
  category: 'kitchen',
  type: 'appliances',
  group: 'Cooking',
  tags: ['oven', 'microwave', 'tall unit', 'housing', 'appliance'],
  defaultSize: { w: 0.6, d: 0.6, h: 2.2 },
  minSize: { w: 0.55, d: 0.55, h: 1.8 },
  maxSize: { w: 0.9, d: 0.7, h: 2.5 },
  wallSnap: true,
  slots: [FRONT_SLOT, matSlot('appliance', 'Appliance glass', 'screen-black'), HANDLE_SLOT],
  build: ({ w, d, h }) => {
    const zf = faceZ(d);
    const X: V2 = [-w / 2, w / 2];
    const len = w * 0.75;
    return [
      ...baseShell(w, d, h),
      ...fronts(
        'front',
        'handle',
        [
          { x: X, y: [PLINTH, 0.45], handle: { kind: 'bar-h', y: 0.4 } },
          { x: X, y: [1.5, h], handle: { kind: 'bar-h', y: 1.55 } },
        ],
        zf,
        FRONT_T,
        HANDLE_D,
      ),
      ...fronts('handle', 'handle', [{ x: X, y: [0.97, 1.05] }], zf, FRONT_T, 0),
      ...fronts(
        'appliance',
        'handle',
        [
          { x: X, y: [0.45, 0.97], handle: { kind: 'bar-h', y: 0.92, len } },
          { x: X, y: [1.05, 1.5], handle: { kind: 'bar-h', y: 1.45, len } },
        ],
        zf,
        FRONT_T,
        HANDLE_D,
      ),
    ];
  },
});

const fridge = defineAsset({
  id: 'fridge',
  name: 'Fridge freezer',
  category: 'kitchen',
  type: 'appliances',
  group: 'Refrigeration',
  tags: ['fridge', 'refrigerator', 'freezer', 'appliance', 'cooler'],
  defaultSize: { w: 0.7, d: 0.7, h: 1.85 },
  minSize: { w: 0.5, d: 0.55, h: 0.8 },
  maxSize: { w: 1.0, d: 0.8, h: 2.1 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Body & doors', 'metal-brushed-steel'),
    matSlot('handle', 'Handles', 'metal-chrome'),
  ],
  build: ({ w, d, h }) => {
    const doorT = 0.05;
    const handleD = 0.035;
    const zf = d / 2 - doorT - handleD;
    const z2: V2 = [zf, zf + doorT];
    const zh: V2 = [zf + doorT, d / 2];
    const foot = 0.02;
    const freezer = h > 1.2 ? h * 0.34 : 0;
    const ySplit = foot + freezer;
    const parts: Part[] = [
      span('body', [-w / 2, w / 2], [foot, h], [-d / 2, zf], { bevel: 0.01 }),
      ...legs4('handle', w, d - 2 * (doorT + handleD), 0.03, 0, foot, 0.04, { round: true }),
    ];
    const french = w >= 0.85;
    const upper = french ? cellSpans(2, -w / 2, w / 2) : [[-w / 2, w / 2] as V2];
    const hLen = Math.min(0.6, (h - ySplit) * 0.4);
    upper.forEach(([x0, x1], i) => {
      parts.push(span('body', [x0 + 0.002, x1 - 0.002], [ySplit + 0.003, h - 0.002], z2, { bevel: 0.008 }));
      const hx = french ? (i === 0 ? x1 - 0.05 : x0 + 0.05) : x1 - 0.05;
      parts.push(
        span('handle', [hx - 0.01, hx + 0.01], [ySplit + 0.12, ySplit + 0.12 + hLen], zh, { plan: false }),
      );
    });
    if (freezer > 0) {
      parts.push(
        span('body', [-w / 2 + 0.002, w / 2 - 0.002], [foot + 0.003, ySplit - 0.003], z2, { bevel: 0.008 }),
      );
      parts.push(span('handle', [-w * 0.3, w * 0.3], [ySplit - 0.07, ySplit - 0.05], zh, { plan: false }));
    }
    return parts;
  },
});

const dishwasher = defineAsset({
  id: 'dishwasher',
  name: 'Dishwasher',
  category: 'kitchen',
  type: 'appliances',
  group: 'Cleaning',
  tags: ['dishwasher', 'appliance', 'dishes', 'under counter'],
  defaultSize: { w: 0.6, d: 0.6, h: 0.85 },
  minSize: { w: 0.45, d: 0.55, h: 0.8 },
  maxSize: { w: 0.6, d: 0.65, h: 0.9 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Body & door', 'metal-brushed-steel'),
    matSlot('panel', 'Control panel', 'screen-black'),
    matSlot('handle', 'Handle', 'metal-chrome'),
  ],
  build: ({ w, d, h }) => {
    const zf = d / 2 - 0.035;
    const zd: V2 = [zf, zf + 0.02];
    return [
      span('body', [-w / 2, w / 2], [0.08, h], [-d / 2, zf]),
      span('panel', [-w / 2 + 0.01, w / 2 - 0.01], [0, 0.08], [-d / 2 + 0.05, zf - 0.03], { plan: false }),
      span('body', [-w / 2 + 0.002, w / 2 - 0.002], [0.08, h - 0.1], zd, { plan: false }),
      span('panel', [-w / 2 + 0.002, w / 2 - 0.002], [h - 0.098, h - 0.005], zd, { plan: false }),
      span('handle', [-w * 0.3, w * 0.3], [h - 0.135, h - 0.115], [zf + 0.02, d / 2], { plan: false }),
    ];
  },
});

const washingMachine = defineAsset({
  id: 'washing-machine',
  name: 'Washing machine',
  category: 'kitchen',
  type: 'appliances',
  group: 'Laundry',
  tags: ['washer', 'laundry', 'washing machine', 'appliance', 'utility'],
  defaultSize: { w: 0.6, d: 0.6, h: 0.85 },
  minSize: { w: 0.5, d: 0.45, h: 0.8 },
  maxSize: { w: 0.65, d: 0.7, h: 0.9 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Body', 'laminate-white-gloss'),
    matSlot('door', 'Door glass', 'glass-tinted'),
    matSlot('trim', 'Door ring & dial', 'metal-chrome'),
  ],
  build: ({ w, d, h }) => {
    const zf = d / 2 - 0.04;
    const R = Math.min(w * 0.32, (h - 0.2) * 0.38);
    const yc = 0.02 + (h - 0.14) * 0.48;
    return [
      span('body', [-w / 2, w / 2], [0.02, h], [-d / 2, zf], { bevel: 0.01 }),
      ...legs4('trim', w, d - 0.1, 0.04, 0, 0.02, 0.04, { round: true }),
      span('door', [-w / 2 + 0.01, w / 2 - 0.01], [h - 0.12, h - 0.02], [zf, zf + 0.004], { plan: false }),
      span('body', [-w / 2 + 0.03, -w / 2 + 0.2], [h - 0.11, h - 0.03], [zf, zf + 0.012], { plan: false }),
      discZ('trim', [w / 2 - 0.1, h - 0.07, zf + 0.014], 0.03, 0.02, { plan: false }),
      torus('trim', [0, yc, zf + 0.02], R, 0.02, { plan: false }),
      discZ('door', [0, yc, zf + 0.015], R - 0.005, 0.03, { plan: false }),
    ];
  },
});

export const KITCHEN_ASSETS: AssetDefinition[] = [
  baseCabinet,
  wallCabinet,
  tallCabinet,
  island,
  sinkUnit,
  cooktopUnit,
  ovenTower,
  fridge,
  dishwasher,
  washingMachine,
];

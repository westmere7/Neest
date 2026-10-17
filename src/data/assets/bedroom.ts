import type { AssetDefinition, Part, PlanStroke, Size3 } from './types';
import {
  box,
  cellSpans,
  clamp,
  defineAsset,
  fronts,
  legs4,
  line,
  matSlot,
  span,
  spaced,
  type FrontSpec,
  type V3,
} from './parts';

// ---------------------------------------------------------------------------
// Beds (shared parametric family)
// ---------------------------------------------------------------------------

function bedFrame({ w, d }: Size3) {
  const hbT = 0.08;
  const side = 0.05;
  const zHead = -d / 2 + hbT;
  const duvetStart = zHead + 0.55;
  return {
    side,
    legH: 0.1,
    frameTop: 0.32,
    mattTop: 0.54,
    zHead,
    pillows: w < 1.2 ? 1 : 2,
    mw: w - 2 * side,
    duvetStart,
    foldZ: duvetStart + 0.3,
    xL: -w / 2 + side - 0.02,
    xR: w / 2 - side + 0.02,
  };
}

function bedParts(size: Size3): Part[] {
  const { w, d, h } = size;
  const g = bedFrame(size);
  const parts: Part[] = [
    span('headboard', [-w / 2, w / 2], [0, h], [-d / 2, g.zHead], { bevel: 0.02 }),
    span('frame', [-w / 2, w / 2], [g.legH, g.frameTop], [g.zHead, d / 2], { bevel: 0.01 }),
    ...legs4('frame', w, d, 0.03, 0, g.legH, 0.05),
    span(
      'bedding',
      [-w / 2 + g.side, w / 2 - g.side],
      [g.frameTop, g.mattTop],
      [g.zHead + 0.01, d / 2 - 0.03],
      { bevel: 0.02 },
    ),
  ];
  const pw = g.pillows === 1 ? Math.min(0.7, g.mw - 0.12) : Math.min(0.7, g.mw / 2 - 0.06);
  const centres = g.pillows === 1 ? [0] : [-g.mw / 4, g.mw / 4];
  for (const cx of centres) {
    parts.push(
      span(
        'bedding',
        [cx - pw / 2, cx + pw / 2],
        [g.mattTop - 0.01, g.mattTop + 0.12],
        [g.zHead + 0.04, g.zHead + 0.46],
        {
          bevel: 0.02,
        },
      ),
    );
  }
  // Duvet draped over the mattress, with the sheet turned back over its top edge.
  parts.push(
    span('duvet', [g.xL, g.xR], [g.mattTop - 0.12, g.mattTop + 0.05], [g.duvetStart, d / 2 - 0.01], {
      bevel: 0.02,
    }),
  );
  parts.push(
    span('bedding', [g.xL, g.xR], [g.mattTop + 0.05, g.mattTop + 0.075], [g.duvetStart, g.foldZ], {
      bevel: 0.01,
    }),
  );
  return parts;
}

function bedPlan(size: Size3): PlanStroke[] {
  const g = bedFrame(size);
  const c = Math.min(0.4, (g.xR - g.xL) * 0.3, size.d / 2 - 0.02 - g.foldZ);
  return [line([g.xL, g.foldZ], [g.xR, g.foldZ]), line([g.xR - c, g.foldZ], [g.xR, g.foldZ + c])];
}

const BED_SLOTS = [
  matSlot('frame', 'Frame', 'wood-oak-light'),
  matSlot('headboard', 'Headboard', 'fabric-wool-grey'),
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
// Case goods
// ---------------------------------------------------------------------------

const bedside = defineAsset({
  id: 'bedside-table',
  name: 'Bedside table',
  category: 'bedroom',
  tags: ['nightstand', 'night table', 'bedside', 'drawer'],
  defaultSize: { w: 0.45, d: 0.4, h: 0.5 },
  minSize: { w: 0.3, d: 0.28, h: 0.35 },
  maxSize: { w: 0.7, d: 0.55, h: 0.75 },
  wallSnap: true,
  slots: [matSlot('body', 'Body', 'wood-oak-light'), matSlot('handle', 'Knob', 'metal-brass')],
  build: ({ w, d, h }) => {
    const legH = Math.min(0.12, h * 0.25);
    const zFace = d / 2 - 0.04;
    const drawerH = Math.min(0.16, (h - legH) * 0.45);
    const t = 0.018;
    const shelfTop = h - drawerH - 0.02;
    const xi: [number, number] = [-w / 2 + t, w / 2 - t];
    // Drawer box on top, open shelf niche below.
    return [
      span('body', [-w / 2, -w / 2 + t], [legH, h], [-d / 2, zFace]),
      span('body', [w / 2 - t, w / 2], [legH, h], [-d / 2, zFace]),
      span('body', xi, [shelfTop, h], [-d / 2, zFace]),
      span('body', xi, [legH, legH + t], [-d / 2, zFace], { plan: false }),
      span('body', xi, [legH + t, shelfTop], [-d / 2, -d / 2 + 0.01], { plan: false }),
      ...fronts(
        'body',
        'handle',
        [{ x: [-w / 2, w / 2], y: [shelfTop, h], handle: { kind: 'knob' } }],
        zFace,
        0.016,
        0.024,
      ),
      ...legs4('body', w, d, 0.02, 0, legH, 0.035, { round: true, taper: 0.7 }),
    ];
  },
});

const wardrobe = defineAsset({
  id: 'wardrobe',
  name: 'Wardrobe (2-door)',
  category: 'bedroom',
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
    const zFace = d / 2 - 0.045;
    const hy = Math.min(1.05, h * 0.5);
    const specs: FrontSpec[] = [
      { x: [-w / 2, 0], y: [0.08, h], handle: { kind: 'bar-v', x: -0.04, y: hy, len: 0.3 } },
      { x: [0, w / 2], y: [0.08, h], handle: { kind: 'bar-v', x: 0.04, y: hy, len: 0.3 } },
    ];
    return [
      span('body', [-w / 2 + 0.02, w / 2 - 0.02], [0, 0.08], [-d / 2, zFace - 0.05], { plan: false }),
      span('body', [-w / 2, w / 2], [0.08, h], [-d / 2, zFace]),
      ...fronts('body', 'handle', specs, zFace, 0.02, 0.025),
    ];
  },
  planDetail: ({ w, d }) => {
    const zDoor = d / 2 - 0.045;
    const zRail = (-d / 2 + zDoor) / 2;
    const reach = Math.min(0.2, (zDoor + d / 2) / 2 - 0.04);
    const strokes: PlanStroke[] = [
      line([-w / 2, zDoor], [w / 2, zDoor]),
      line([0, zDoor], [0, d / 2 - 0.025]),
      line([-w / 2 + 0.04, zRail], [w / 2 - 0.04, zRail]),
    ];
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
  tags: ['dresser', 'chest', 'drawers', 'commode', 'storage'],
  defaultSize: { w: 1.0, d: 0.48, h: 0.85 },
  minSize: { w: 0.5, d: 0.35, h: 0.5 },
  maxSize: { w: 2.0, d: 0.6, h: 1.4 },
  wallSnap: true,
  slots: [matSlot('body', 'Body', 'wood-ash-white'), matSlot('handle', 'Handles', 'metal-brass')],
  build: ({ w, d, h }) => {
    const legH = 0.1;
    const topT = 0.025;
    const zFace = d / 2 - 0.03;
    const cols = w >= 0.9 ? 2 : 1;
    const rows = clamp(Math.round((h - legH - topT) / 0.22), 2, 6);
    const specs: FrontSpec[] = [];
    for (const x of cellSpans(cols, -w / 2 + 0.01, w / 2 - 0.01)) {
      for (const y of cellSpans(rows, legH + 0.01, h - topT - 0.005)) {
        specs.push({ x, y, handle: { kind: 'bar-h', len: Math.min(0.16, (x[1] - x[0]) * 0.35) } });
      }
    }
    return [
      span('body', [-w / 2, w / 2], [h - topT, h], [-d / 2, d / 2]),
      span('body', [-w / 2 + 0.005, w / 2 - 0.005], [legH, h - topT], [-d / 2, zFace]),
      ...fronts('body', 'handle', specs, zFace, 0.018, 0.012),
      ...legs4('body', w, d, 0.02, 0, legH, 0.035, { round: true, taper: 0.7 }),
    ];
  },
});

const mirrorFloor = defineAsset({
  id: 'mirror-floor',
  name: 'Leaning floor mirror',
  category: 'bedroom',
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
    const c: V3 = [0, h / 2, -d / 2 + ez / 2];
    const rotation: V3 = [-th, 0, 0];
    const off = t / 2 + 0.002;
    return [
      box('frame', c, [w, L, t], { rotation }),
      box('glass', [0, c[1] + Math.sin(th) * off, c[2] + Math.cos(th) * off], [w - 0.06, L - 0.06, 0.006], {
        rotation,
        plan: false,
      }),
    ];
  },
});

export const BEDROOM_ASSETS: AssetDefinition[] = [
  bedSingle,
  bedDouble,
  bedQueen,
  bedKing,
  bedside,
  wardrobe,
  dresser,
  mirrorFloor,
];

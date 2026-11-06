/**
 * Over-washer laundry storage — doorless solid-wood wall shelves sized to hang high above a
 * side-by-side washer and dryer pair (default mounting height 1.45 m, clearing an open top-load
 * washing machine lid). One full-height compartment holds a woven rattan laundry basket with folded
 * linen and a tall family-size liquid detergent jug; the other half is split by a fixed shelf into
 * two open cubbies. Offered with the tall compartment on the left or mirrored to the right, and in
 * Filled (with basket & detergent) or Empty models.
 */
import {
  box,
  clamp,
  cyl,
  defineItem,
  definePack,
  lathe,
  line,
  matSlot,
  range,
  span,
  torus,
  type AssetParam,
  type PackItem,
  type ParamValues,
  type Part,
  type PlanStroke,
  type Size3,
} from '@/packs/kit';

const WOOD = matSlot('wood', 'Wood carcass', 'wood-oak-natural');
const BASKET = matSlot('basket', 'Laundry basket', 'rattan-natural');
const LINEN = matSlot('linen', 'Basket laundry & label', 'fabric-cream');
const BOTTLE = matSlot('bottle', 'Detergent bottle', 'paint-sage-teal');

const WOOD_VARIANTS: NonNullable<PackItem['variants']> = [
  { id: 'light-oak', name: 'Light oak & white bottle', materials: { wood: 'wood-oak-light', bottle: 'plastic-white' } },
  { id: 'walnut', name: 'Walnut & deep teal bottle', materials: { wood: 'wood-walnut', bottle: 'paint-deep-teal' } },
  { id: 'white-ash', name: 'White ash & cobalt bottle', materials: { wood: 'wood-ash-white', bottle: 'plastic-blue' } },
  { id: 'birch-ply', name: 'Birch plywood', materials: { wood: 'wood-plywood' } },
];

const DEFAULT_TALL_W = 0.58;
const DEFAULT_LOWER_H = 0.275;

type TallSide = 'left' | 'right';

interface ShelfGeo {
  w: number;
  d: number;
  h: number;
  t: number;
  tIn: number;
  zCleat: number;
  tBack: number;
  zIn0: number;
  z1: number;
  xDiv: number;
  tx0: number;
  tx1: number;
  sx0: number;
  sx1: number;
  yShelf: number;
}

function shelfGeo({ w, d, h }: Size3, side: TallSide, params?: ParamValues): ShelfGeo {
  const t = clamp(Math.min(w, h) * 0.036, 0.018, 0.022);
  const tIn = 0.018;
  const zCleat = 0.008;
  const tBack = 0.012;
  const zIn0 = -d / 2 + zCleat + tBack;
  const z1 = d / 2;

  const innerW = Math.max(0.36, w - 2 * t - tIn);
  const rawTallW = typeof params?.tallWidth === 'number' ? params.tallWidth : DEFAULT_TALL_W;
  const minTall = Math.min(0.28, innerW * 0.42);
  const maxTall = Math.max(minTall + 0.04, innerW - Math.min(0.22, innerW * 0.35));
  const tallW = clamp(rawTallW, minTall, maxTall);

  const xInner0 = -w / 2 + t;
  const xInner1 = w / 2 - t;
  const xDiv = side === 'left' ? xInner0 + tallW + tIn / 2 : xInner1 - tallW - tIn / 2;
  const [tx0, tx1] = side === 'left' ? [xInner0, xDiv - tIn / 2] : [xDiv + tIn / 2, xInner1];
  const [sx0, sx1] = side === 'left' ? [xDiv + tIn / 2, xInner1] : [xInner0, xDiv - tIn / 2];

  const innerH = Math.max(0.24, h - 2 * t - tIn);
  const rawLowerH = typeof params?.lowerHeight === 'number' ? params.lowerHeight : DEFAULT_LOWER_H;
  const minLower = Math.min(0.12, innerH * 0.3);
  const maxLower = Math.max(minLower + 0.02, innerH - Math.min(0.12, innerH * 0.3));
  const lowerH = clamp(rawLowerH, minLower, maxLower);
  const yShelf = t + lowerH + tIn / 2;

  return { w, d, h, t, tIn, zCleat, tBack, zIn0, z1, xDiv, tx0, tx1, sx0, sx1, yShelf };
}

function shelfParams(side: TallSide): AssetParam[] {
  return [
    {
      id: 'tallWidth',
      label: 'Tall bay width',
      kind: 'length',
      default: DEFAULT_TALL_W,
      min: 0.28,
      max: 1.2,
      step: 0.01,
      handle: (size, p) => {
        const g = shelfGeo(size, side, p);
        return {
          at: [g.xDiv, g.h / 2, g.d / 2 + 0.01],
          dir: side === 'left' ? [1, 0, 0] : [-1, 0, 0],
        };
      },
    },
    {
      id: 'lowerHeight',
      label: 'Lower cubby height',
      kind: 'length',
      default: DEFAULT_LOWER_H,
      min: 0.12,
      max: 0.7,
      step: 0.01,
      handle: (size, p) => {
        const g = shelfGeo(size, side, p);
        return {
          at: [(g.sx0 + g.sx1) / 2, g.yShelf, g.d / 2 + 0.01],
          dir: [0, 1, 0],
        };
      },
    },
  ];
}

/** Woven rectangular-rounded rattan laundry basket with side carry loops and folded cream laundry. */
function buildLaundryBasket(bx: number, y0: number, bz: number, bw: number, bd: number, bh: number): Part[] {
  const parts: Part[] = [];
  const wallT = clamp(Math.min(bw, bd) * 0.075, 0.012, 0.018);
  const rimH = clamp(bh * 0.14, 0.032, 0.048);
  const bodyH = bh - rimH;

  // Solid base and 3 horizontal woven rib bands tapering gently outward.
  parts.push(
    span('basket', [bx - bw * 0.45, bx + bw * 0.45], [y0, y0 + 0.016], [bz - bd * 0.45, bz + bd * 0.45], {
      bevel: 0.006,
      plan: false,
    }),
  );
  const tiers = 3;
  const tierStep = (bodyH - 0.016) / tiers;
  for (const i of range(tiers)) {
    const k = 0.91 + (i / tiers) * 0.07;
    const ty0 = y0 + 0.016 + i * tierStep + 0.0015;
    const ty1 = y0 + 0.016 + (i + 1) * tierStep - 0.0015;
    parts.push(
      span('basket', [bx - (bw / 2) * k, bx + (bw / 2) * k], [ty0, ty1], [bz - (bd / 2) * k, bz + (bd / 2) * k], {
        bevel: 0.014,
        plan: false,
      }),
    );
  }

  // Hollow braided upper rim (4 rails) so looking down into the basket reveals the linen inside.
  const ry0 = y0 + bodyH;
  const ry1 = y0 + bh;
  const hx = bw / 2;
  const hz = bd / 2;
  parts.push(
    span('basket', [bx - hx, bx + hx], [ry0, ry1], [bz + hz - wallT, bz + hz], { bevel: 0.006, plan: false }),
    span('basket', [bx - hx, bx + hx], [ry0, ry1], [bz - hz, bz - hz + wallT], { bevel: 0.006, plan: false }),
    span('basket', [bx - hx, bx - hx + wallT], [ry0, ry1], [bz - hz + wallT, bz + hz - wallT], { bevel: 0.005, plan: false }),
    span('basket', [bx + hx - wallT, bx + hx], [ry0, ry1], [bz - hz + wallT, bz + hz - wallT], { bevel: 0.005, plan: false }),
  );

  // Braided rattan side carry handles on the left and right ends of the rim.
  const rHandle = clamp(bd * 0.15, 0.022, 0.036);
  const tube = 0.0065;
  for (const sgn of [-1, 1] as const) {
    parts.push(
      torus('basket', [bx + sgn * (hx - wallT * 0.45), ry1 - 0.004, bz], rHandle, tube, {
        arc: Math.PI,
        rotation: [0, Math.PI / 2, 0],
        plan: false,
      }),
    );
  }

  // Softly angled folded linen & towels tucked inside the basket and peeking above the rim.
  const lw = Math.max(0.06, bw - wallT * 2.8);
  const ld = Math.max(0.06, bd - wallT * 2.8);
  const linenH1 = clamp(rimH * 0.85, 0.026, 0.042);
  const linenH2 = clamp(rimH * 0.72, 0.022, 0.036);
  parts.push(
    box('linen', [bx - lw * 0.03, ry0 + linenH1 * 0.52, bz], [lw * 0.94, linenH1, ld * 0.92], {
      bevel: 0.01,
      rotation: [0, 0.06, 0],
      plan: false,
    }),
    box('linen', [bx + lw * 0.04, ry0 + linenH1 + linenH2 * 0.44, bz - ld * 0.03], [lw * 0.82, linenH2, ld * 0.78], {
      bevel: 0.01,
      rotation: [0.03, -0.08, 0],
      plan: false,
    }),
  );

  return parts;
}

/** Tall family-size liquid laundry detergent jug with moulded grip handle, wrap label & dosing cap. */
function buildTallDetergentBottle(jx: number, y0: number, jz: number, jw: number, jd: number, totalH: number): Part[] {
  const yaw = -0.22;
  const bodyH = totalH * 0.86;
  const r = jw * 0.44;
  const zScale = clamp(jd / Math.max(0.05, jw), 1.05, 1.28);
  // Shift body slightly away from the handle side so body + side handle stay balanced around jx.
  const cx = jx - Math.cos(yaw) * r * 0.08;
  const cz = jz + Math.sin(yaw) * r * 0.08;

  const body = lathe(
    'bottle',
    [cx, y0, cz],
    [
      [0, 0],
      [r * 0.84, 0],
      [r * 0.98, bodyH * 0.06],
      [r, bodyH * 0.56],
      [r * 0.92, bodyH * 0.71],
      [r * 0.52, bodyH * 0.89],
      [r * 0.29, bodyH * 0.94],
      [r * 0.29, bodyH],
      [0, bodyH],
    ],
    { segments: 20, scale: [1, 1, zScale], rotation: [0, yaw, 0], plan: false },
  );

  // Moulded side grip handle along the upper shoulder.
  const hOff = r * 0.56;
  const hR = clamp(bodyH * 0.14, 0.024, 0.046);
  const hTube = clamp(r * 0.14, 0.0065, 0.01);
  const handle = torus(
    'bottle',
    [cx + Math.cos(yaw) * hOff, y0 + bodyH * 0.67, cz - Math.sin(yaw) * hOff],
    hR,
    hTube,
    { arc: Math.PI * 1.04, rotation: [0, yaw, -Math.PI / 2 - 0.16], plan: false },
  );

  // Proud wrap-around cream label band + contrasting front emblem stripe.
  const labelH = bodyH * 0.37;
  const labelY = y0 + bodyH * 0.33;
  const labelWrap = cyl('linen', [cx, labelY, cz], r * 1.025, labelH, {
    segments: 20,
    scale: [1, 1, zScale],
    rotation: [0, yaw, 0],
    plan: false,
  });
  const frontDist = r * zScale * 1.025 + 0.002;
  const frontBadge = box(
    'bottle',
    [cx - Math.sin(yaw) * frontDist, labelY, cz + Math.cos(yaw) * frontDist],
    [r * 0.86, labelH * 0.42, 0.0035],
    { bevel: 0.001, rotation: [0, yaw, 0], plan: false },
  );

  // Tall ribbed dosing/measuring cap + collar ring on top of the neck.
  const capH = totalH - bodyH + 0.008;
  const cap = cyl('bottle', [cx, y0 + bodyH + (totalH - bodyH) * 0.48, cz], r * 0.35, capH, {
    rTop: r * 0.29,
    segments: 16,
    plan: false,
  });
  const collar = torus('bottle', [cx, y0 + bodyH + 0.003, cz], r * 0.35, 0.0035, {
    rotation: [Math.PI / 2, 0, 0],
    plan: false,
  });

  return [body, handle, labelWrap, frontBadge, cap, collar];
}

function buildOverWasherShelf(size: Size3, side: TallSide, params?: ParamValues): Part[] {
  const g = shelfGeo(size, side, params);
  const { w, d, h, t, tIn, zCleat, tBack, zIn0, z1, xDiv, tx0, tx1, sx0, sx1, yShelf } = g;
  const x0 = -w / 2;
  const x1 = w / 2;
  const z0 = -d / 2;

  // 1. Open doorless solid-wood carcass (9 parts, stable order).
  const carcass: Part[] = [
    span('wood', [x0, x0 + t], [0, h], [z0, z1], { bevel: 0.002 }),
    span('wood', [x1 - t, x1], [0, h], [z0, z1], { bevel: 0.002 }),
    span('wood', [x0 + t, x1 - t], [0, t], [z0, z1], { bevel: 0.002 }),
    span('wood', [x0 + t, x1 - t], [h - t, h], [z0, z1], { bevel: 0.002, plan: false }),
    span('wood', [x0 + t, x1 - t], [t, h - t], [z0 + zCleat, z0 + zCleat + tBack], { plan: false }),
    span('wood', [x0 + t, x1 - t], [h - t - 0.055, h - t - 0.005], [z0, z0 + zCleat], { plan: false }),
    span('wood', [x0 + t, x1 - t], [t + 0.005, t + 0.045], [z0, z0 + zCleat], { plan: false }),
    span('wood', [xDiv - tIn / 2, xDiv + tIn / 2], [t, h - t], [zIn0, z1 - 0.002], { bevel: 0.0015, plan: false }),
    span('wood', [sx0, sx1], [yShelf - tIn / 2, yShelf + tIn / 2], [zIn0, z1 - 0.003], { bevel: 0.0015, plan: false }),
  ];

  // 2. Tall bay contents: 1 woven laundry basket + 1 tall liquid detergent bottle (lifted 2 mm off wood).
  const tw = tx1 - tx0;
  const td = z1 - zIn0;
  const yFloor = t + 0.002;
  const th = Math.max(0.24, h - 2 * t - 0.004);

  const pad = clamp(tw * 0.045, 0.012, 0.028);
  const gap = clamp(tw * 0.055, 0.016, 0.032);
  const uW = Math.max(0.2, tw - 2 * pad - gap);
  const bw = clamp(uW * 0.65, 0.13, 0.325);
  const jw = clamp(uW * 0.33, 0.068, 0.15);
  const groupW = bw + gap + jw;
  const shiftX = side === 'left' ? -Math.min(0.008, (tw - groupW) * 0.2) : 0;
  const gx0 = (tx0 + tx1 - groupW) / 2 + shiftX;

  const bx = gx0 + bw / 2;
  const jx = gx0 + bw + gap + jw / 2;
  const bz = (zIn0 + z1) / 2 + 0.012;
  const bd = clamp(td * 0.76, 0.15, 0.255);
  const bh = clamp(th * 0.62, 0.19, 0.355);

  const jd = clamp(td * 0.55, 0.095, 0.18);
  const bottleH = clamp(th * 0.75, 0.24, 0.43);

  return [
    ...carcass,
    ...buildLaundryBasket(bx, yFloor, bz, bw, bd, bh),
    ...buildTallDetergentBottle(jx, yFloor, bz + 0.01, jw, jd, bottleH),
  ];
}

function shelfPlanDetail(size: Size3, side: TallSide, params?: ParamValues): PlanStroke[] {
  const g = shelfGeo(size, side, params);
  return [
    line([-g.w / 2 + g.t, g.zIn0], [g.w / 2 - g.t, g.zIn0]),
    line([g.xDiv, g.zIn0], [g.xDiv, g.z1 - 0.003]),
  ];
}

const MODELS = [
  { id: 'filled', name: 'With basket & detergent' },
  { id: 'empty', name: 'Empty shelf', hide: ['basket', 'linen', 'bottle'] },
];

const overWasherShelfLeft = defineItem({
  id: 'over-washer-wood-shelf',
  name: 'Over-washer open oak wall shelf',
  category: 'laundry',
  type: 'storage',
  group: 'Bathroom & laundry storage',
  tags: [
    'over washer shelf',
    'laundry wall shelf',
    'open wood shelf',
    'detergent shelf',
    'top load washer clearance',
    'kệ máy giặt',
    'kệ gỗ treo tường',
    'kệ giặt sấy',
  ],
  description:
    'Doorless solid-oak wall shelf hung at 1.45 m so a top-load washer lid swings fully open underneath: one full-height compartment on the left holding a woven laundry basket and tall liquid detergent jug, and two stacked open cubbies on the right.',
  mount: 'wall',
  defaultElevation: 1.45,
  defaultSize: { w: 1.2, d: 0.35, h: 0.62 },
  minSize: { w: 0.75, d: 0.28, h: 0.45 },
  maxSize: { w: 1.8, d: 0.48, h: 0.95 },
  price: { vnd: 2_200_000, estimate: true },
  slots: [WOOD, BASKET, LINEN, BOTTLE],
  variants: WOOD_VARIANTS,
  models: MODELS,
  params: shelfParams('left'),
  build: (size, params) => buildOverWasherShelf(size, 'left', params),
  planDetail: (size, params) => shelfPlanDetail(size, 'left', params),
});

const overWasherShelfRight = defineItem({
  id: 'over-washer-wood-shelf-right',
  name: 'Over-washer open oak wall shelf (tall bay right)',
  variantOf: 'over-washer-wood-shelf',
  category: 'laundry',
  type: 'storage',
  group: 'Bathroom & laundry storage',
  tags: [
    'over washer shelf',
    'laundry wall shelf',
    'open wood shelf',
    'mirrored laundry shelf',
    'top load washer clearance',
    'kệ máy giặt',
    'kệ gỗ treo tường',
    'kệ trên máy giặt sấy',
  ],
  description:
    'Mirrored doorless solid-oak over-washer wall shelf hung at 1.45 m to clear an open top-load washer lid: two stacked open cubbies on the left and a full-height compartment on the right holding a woven laundry basket and tall liquid detergent jug.',
  mount: 'wall',
  defaultElevation: 1.45,
  defaultSize: { w: 1.2, d: 0.35, h: 0.62 },
  minSize: { w: 0.75, d: 0.28, h: 0.45 },
  maxSize: { w: 1.8, d: 0.48, h: 0.95 },
  price: { vnd: 2_200_000, estimate: true },
  slots: [WOOD, BASKET, LINEN, BOTTLE],
  variants: WOOD_VARIANTS,
  models: MODELS,
  params: shelfParams('right'),
  build: (size, params) => buildOverWasherShelf(size, 'right', params),
  planDetail: (size, params) => shelfPlanDetail(size, 'right', params),
});

export default definePack({
  name: 'Over-Washer Laundry Storage',
  version: '1.0.0',
  author: 'Neest',
  license: 'CC0-1.0',
  description:
    'Doorless solid-wood wall shelves sized to hang high above top-load or front-load washers and dryers, combining a full-height basket-and-detergent bay with two stacked open cubbies.',
  items: [overWasherShelfLeft, overWasherShelfRight],
});

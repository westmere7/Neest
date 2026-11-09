/**
 * Laundry corner: a bamboo frame that stacks a dryer over a front-load washer (with a shelf on top), a
 * bamboo-and-black-metal side shelf, a wicker basket of rolled towels (or of bottles), a pair of
 * detergent bottles and the washer's wall tap. The ready group "Stacked laundry corner" puts them
 * together with the catalogue's own washer and dryer.
 */
import {
  clamp,
  cyl,
  defineItem,
  definePack,
  discZ,
  lathe,
  line,
  matSlot,
  range,
  rod,
  rodX,
  rodZ,
  span,
  type AssetParam,
  type ParamValues,
  type Part,
  type Size3,
} from '@/packs/kit';

const num = (p: ParamValues | undefined, k: string, v: number) => (typeof p?.[k] === 'number' && Number.isFinite(p[k]) ? (p[k] as number) : v);
const flag = (p: ParamValues | undefined, k: string, v: boolean) => (typeof p?.[k] === 'boolean' ? (p[k] as boolean) : v);

// ───────────────────────── Washer-dryer stacking frame ─────────────────────────

const POST = 0.035;
const BOARD = 0.025;

function frameGeo({ w, d, h }: Size3, p?: ParamValues) {
  const shelf = clamp(num(p, 'shelf', 0.9), 0.4, Math.max(0.4, h - 0.35));
  return { w, d, h, shelf, top: flag(p, 'top', true) };
}

/** A shelf of bamboo slats running front to back, with aprons front and back, its top at y. */
function slatShelf(w: number, d: number, y: number): Part[] {
  const x0 = -w / 2 + POST;
  const x1 = w / 2 - POST;
  const n = Math.max(3, Math.round((x1 - x0) / 0.06));
  const sw = (x1 - x0) / n;
  return [
    ...range(n).map((i) => span('wood', [x0 + i * sw + 0.002, x0 + (i + 1) * sw - 0.002], [y - BOARD, y], [-d / 2 + POST, d / 2 - POST])),
    span('wood', [x0, x1], [y - 0.07, y - BOARD], [d / 2 - POST, d / 2 - POST + 0.02], { plan: false }),
    span('wood', [x0, x1], [y - 0.07, y - BOARD], [-d / 2 + POST - 0.02, -d / 2 + POST], { plan: false }),
  ];
}

function buildFrame(size: Size3, p?: ParamValues): Part[] {
  const g = frameGeo(size, p);
  const { w, d, h } = g;
  const parts: Part[] = [];
  for (const x of [-w / 2 + POST / 2, w / 2 - POST / 2]) {
    for (const z of [-d / 2 + POST / 2, d / 2 - POST / 2]) parts.push(span('wood', [x - POST / 2, x + POST / 2], [0, h], [z - POST / 2, z + POST / 2]));
    // Side rails tying front and back posts: low, under the dryer shelf and under the top.
    for (const y of [0.06, g.shelf - 0.05, ...(g.top ? [h - 0.05] : [])]) {
      parts.push(span('wood', [x - POST / 2 + 0.006, x + POST / 2 - 0.006], [y - 0.02, y + 0.02], [-d / 2 + POST, d / 2 - POST], { plan: false }));
    }
  }
  parts.push(...slatShelf(w, d, g.shelf));
  if (g.top) parts.push(...slatShelf(w, d, h));
  return parts;
}

const frameParams: AssetParam[] = [
  {
    id: 'shelf',
    label: 'Dryer shelf height',
    kind: 'length',
    default: 0.9,
    min: 0.4,
    max: 2.2,
    step: 0.01,
    hint: 'Just above the washer (85 cm for most front loaders)',
    handle: (size, p) => {
      const g = frameGeo(size, p);
      return { at: [0, g.shelf, g.d / 2 + 0.01], dir: [0, 1, 0] };
    },
  },
  { id: 'top', label: 'Shelf on top', kind: 'toggle', default: true },
];

const stackFrame = defineItem({
  id: 'washer-dryer-stack-frame',
  name: 'Bamboo washer-dryer stacking frame',
  category: 'laundry',
  type: 'storage',
  group: 'Bathroom & laundry storage',
  tags: ['washer dryer stand', 'stacking frame', 'laundry tower', 'over washer shelf', 'bamboo', 'kệ máy giặt', 'kệ máy sấy'],
  description:
    'A bamboo frame that stands over a front-load washer and holds a dryer on its slatted shelf, with another shelf on top for baskets and plants. In the shape editor, set the dryer shelf height and turn the top shelf on or off.',
  defaultSize: { w: 0.7, d: 0.66, h: 2.0 },
  minSize: { w: 0.62, d: 0.5, h: 1.2 },
  maxSize: { w: 0.9, d: 0.8, h: 2.4 },
  wallSnap: true,
  slots: [matSlot('wood', 'Bamboo frame', 'wood-bamboo')],
  variants: [
    { id: 'oak', name: 'Light oak', materials: { wood: 'wood-oak-light' } },
    { id: 'carbonised', name: 'Carbonised bamboo', materials: { wood: 'wood-bamboo-carbonised' } },
  ],
  params: frameParams,
  build: (size, p) => buildFrame(size, p),
  planDetail: ({ w, d }) => [line([-w / 2, -d / 2], [w / 2, d / 2]), line([-w / 2, d / 2], [w / 2, -d / 2])],
});

// ───────────────────────── Bamboo and metal side shelf ─────────────────────────

const R_POST = 0.009;

function shelfLevels(h: number, p?: ParamValues): number[] {
  const n = clamp(Math.round(num(p, 'tiers', 3)), 2, 5);
  const y0 = Math.min(0.12, h * 0.15);
  const y1 = h - 0.005;
  return range(n).map((i) => y0 + ((y1 - y0) * i) / (n - 1));
}

const sideShelf = defineItem({
  id: 'bamboo-metal-shelf',
  name: 'Bamboo shelf on black metal posts',
  category: 'laundry',
  type: 'storage',
  group: 'Bathroom & laundry storage',
  tags: ['shelf unit', 'etagere', 'laundry shelf', 'bamboo', 'metal', 'kệ tre', 'kệ 3 tầng'],
  description: 'An open shelf unit with bamboo shelves on thin black metal posts. Set how many shelves in the shape editor.',
  defaultSize: { w: 0.5, d: 0.35, h: 1.25 },
  minSize: { w: 0.3, d: 0.22, h: 0.5 },
  maxSize: { w: 1.2, d: 0.5, h: 2.0 },
  wallSnap: true,
  slots: [matSlot('wood', 'Shelves', 'wood-bamboo'), matSlot('metal', 'Posts', 'metal-black-matte')],
  variants: [
    { id: 'oak-white', name: 'Oak & white', materials: { wood: 'wood-oak-light', metal: 'metal-white-powder' } },
    { id: 'walnut', name: 'Walnut & black', materials: { wood: 'wood-walnut' } },
  ],
  params: [{ id: 'tiers', label: 'Shelves', kind: 'count', default: 3, min: 2, max: 5, step: 1 }],
  build: ({ w, d, h }, p) => {
    const px = w / 2 - 0.014;
    const pz = d / 2 - 0.014;
    const parts: Part[] = [];
    for (const x of [-px, px]) for (const z of [-pz, pz]) parts.push(rod('metal', [x, 0, z], [x, h, z], R_POST, { segments: 10 }));
    for (const y of shelfLevels(h, p)) {
      parts.push(span('wood', [-w / 2, w / 2], [y - 0.02, y], [-d / 2, d / 2]));
      // A rail along the back under each shelf.
      parts.push(rodX('metal', -px, px, y - 0.035, -pz, 0.005, { plan: false }));
    }
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w / 2, d / 2 - 0.02], [w / 2, d / 2 - 0.02])],
});

// ───────────────────────── Wicker basket with towels (or bottles) ─────────────────────────

/** Open wicker basket: base, four walls and a rim, its walls `bh` tall. */
function basket(w: number, d: number, bh: number): Part[] {
  const t = 0.008;
  return [
    span('basket', [-w / 2, w / 2], [0, t], [-d / 2, d / 2]),
    span('basket', [-w / 2, w / 2], [t, bh], [d / 2 - t, d / 2]),
    span('basket', [-w / 2, w / 2], [t, bh], [-d / 2, -d / 2 + t]),
    span('basket', [-w / 2, -w / 2 + t], [t, bh], [-d / 2 + t, d / 2 - t]),
    span('basket', [w / 2 - t, w / 2], [t, bh], [-d / 2 + t, d / 2 - t]),
  ];
}

function towelsIn({ w, d, h }: Size3): Part[] {
  const bh = h * 0.6;
  const n = Math.max(2, Math.round((w - 0.02) / 0.075));
  const r = Math.min((w - 0.02) / (2 * n), (h - 0.01) / 2.4);
  const cy = Math.min(h - r, bh + r * 0.2);
  const parts = basket(w, d, bh);
  range(n).forEach((i) => {
    const x = -w / 2 + 0.01 + r * (2 * i + 1);
    parts.push(rodZ('towel', x, cy, -d / 2 + 0.015, d / 2 - 0.015, r * 0.98, { segments: 16, plan: false }));
    // The rolled end: a slightly smaller disc showing the roll's face.
    parts.push(discZ('towel', [x, cy, d / 2 - 0.014], r * 0.7, 0.004, { plan: false }));
  });
  return parts;
}

function bottlesIn({ w, d, h }: Size3): Part[] {
  const bh = h * 0.45;
  const parts = basket(w, d, bh);
  const n = Math.max(2, Math.round((w - 0.02) / 0.08));
  const r = Math.min((w - 0.03) / (2 * n), (d - 0.03) / 2, 0.04);
  range(n).forEach((i) => {
    const x = -w / 2 + 0.015 + ((w - 0.03) * (2 * i + 1)) / (2 * n);
    const bt = (h - 0.03) * (i % 2 ? 0.85 : 1);
    parts.push(lathe('bottle', [x, 0.008, 0], [[0, 0], [r, 0], [r, bt * 0.7], [r * 0.45, bt * 0.85], [r * 0.35, bt * 0.88], [0, bt * 0.88]], { segments: 16 }));
    parts.push(cyl('cap', [x, 0.008 + bt * 0.88 + (h - 0.008 - bt * 0.88) / 2, 0], r * 0.38, Math.min(0.03, h - 0.008 - bt * 0.88), { plan: false }));
  });
  return parts;
}

const towelBasket = defineItem({
  id: 'wicker-towel-basket',
  name: 'Wicker basket with rolled towels',
  category: 'laundry',
  type: 'storage',
  group: 'Baskets & boxes',
  tags: ['wicker basket', 'towels', 'rolled towels', 'bottles', 'shelf basket', 'giỏ mây', 'khăn'],
  description: 'A low wicker basket of rolled white towels; the "With bottles" model holds bottles instead.',
  defaultSize: { w: 0.32, d: 0.24, h: 0.2 },
  minSize: { w: 0.18, d: 0.14, h: 0.1 },
  maxSize: { w: 0.6, d: 0.45, h: 0.4 },
  slots: [
    matSlot('basket', 'Basket', 'wicker-fine'),
    matSlot('towel', 'Towels', 'fabric-white-cotton'),
    matSlot('bottle', 'Bottles', 'plastic-white'),
    matSlot('cap', 'Caps', 'paint-sage-teal'),
  ],
  models: [{ id: 'bottles', name: 'With bottles', build: (size) => bottlesIn(size) }],
  build: (size) => towelsIn(size),
});

// ───────────────────────── Detergent bottles ─────────────────────────

const detergentBottles = defineItem({
  id: 'detergent-bottles',
  name: 'Laundry detergent bottles',
  category: 'laundry',
  type: 'decor',
  group: 'Ornaments',
  tags: ['detergent', 'fabric softener', 'laundry bottles', 'nước giặt', 'nước xả'],
  description: 'A tall detergent jug with a handle and a round softener bottle, labels and caps.',
  defaultSize: { w: 0.26, d: 0.12, h: 0.3 },
  minSize: { w: 0.16, d: 0.07, h: 0.18 },
  maxSize: { w: 0.4, d: 0.2, h: 0.45 },
  slots: [matSlot('bottle', 'Bottles', 'plastic-white'), matSlot('label', 'Labels', 'paint-sage-teal'), matSlot('cap', 'Caps', 'plastic-blue')],
  build: ({ w, d, h }) => {
    const jw = w * 0.55;
    const jx0 = -w / 2;
    const jx1 = jx0 + jw;
    const jh = h * 0.86;
    const r = Math.min((w - jw) / 2 - 0.004, d / 2);
    const bx = w / 2 - r;
    const bh = h * 0.78;
    return [
      span('bottle', [jx0, jx1], [0, jh], [-d / 2, d / 2], { bevel: Math.min(0.012, d / 5) }),
      span('label', [jx0 + 0.015, jx1 - 0.015], [jh * 0.25, jh * 0.7], [d / 2 - 0.001, d / 2 + 0.001], { plan: false }),
      cyl('cap', [jx0 + jw * 0.3, jh + (h - jh) / 2, 0], Math.min(0.022, d / 3), h - jh, { plan: false }),
      rod('bottle', [jx1 - jw * 0.15, jh * 0.55, 0], [jx1 - jw * 0.15, jh * 0.95, 0], Math.min(0.012, d / 6), { plan: false }),
      lathe('bottle', [bx, 0, 0], [[0, 0], [r, 0], [r, bh * 0.75], [r * 0.4, bh * 0.92], [r * 0.4, bh], [0, bh]], { segments: 18 }),
      cyl('label', [bx, bh * 0.4, 0], r + 0.001, bh * 0.35, { segments: 18, plan: false }),
      cyl('cap', [bx, bh + (h - bh) / 2, 0], r * 0.45, h - bh, { plan: false }),
    ];
  },
});

// ───────────────────────── Washer wall tap ─────────────────────────

const wallTap = defineItem({
  id: 'washer-wall-tap',
  name: 'Washing machine wall tap',
  category: 'laundry',
  type: 'plumbing',
  group: 'Bathroom accessories',
  tags: ['tap', 'faucet', 'washing machine tap', 'bib tap', 'vòi máy giặt'],
  description: 'A chrome wall tap with a lever handle and a hose outlet, for the washing machine.',
  mount: 'wall',
  defaultElevation: 1.0,
  defaultSize: { w: 0.06, d: 0.12, h: 0.1 },
  minSize: { w: 0.05, d: 0.09, h: 0.08 },
  maxSize: { w: 0.1, d: 0.16, h: 0.14 },
  slots: [matSlot('metal', 'Chrome', 'metal-chrome'), matSlot('handle', 'Lever', 'plastic-blue')],
  build: ({ w, d, h }) => {
    const zb = -d / 2;
    const cy = h * 0.55;
    const r = Math.min(w / 2, h * 0.45);
    return [
      discZ('metal', [0, cy, zb + 0.004], r, 0.008, { segments: 20 }),
      rodZ('metal', 0, cy, zb + 0.008, zb + d * 0.55, 0.011, { segments: 14 }),
      rod('metal', [0, cy, zb + d * 0.55], [0, cy - h * 0.4, zb + d * 0.75], 0.009, { segments: 12, plan: false }),
      cyl('metal', [0, cy - h * 0.45, zb + d * 0.78], 0.011, h * 0.1, { segments: 12, plan: false }),
      rodX('handle', -w / 2 + 0.005, w / 2 - 0.005, cy + 0.016, zb + d * 0.4, 0.006, { plan: false }),
    ];
  },
});

export default definePack({
  name: 'Laundry corner',
  version: '1.0.0',
  author: 'Neest team',
  description: 'A bamboo washer-dryer stacking frame, a bamboo-and-metal side shelf, a wicker basket of towels or bottles, detergent bottles and a washer wall tap.',
  license: 'CC0 (made for Neest)',
  items: [stackFrame, sideShelf, towelBasket, detergentBottles, wallTap],
});

/**
 * Branded fitness — the KingSmith WalkingPad C2 (sold in Vietnam as WPS1F), a folding walking pad for
 * under a desk, at its published sizes. Open and folded take different floor space, so each is its own
 * item: unfolded 1445 × 518 × 125 mm, folded 825 × 518 × 136 mm (KingSmith spec sheet). White by
 * default, with the yellow and black finishes as colour variants.
 *
 * Original procedural shapes: no logos or trademark artwork. Fixed products, so nothing resizes.
 */
import { cyl, defineItem, definePack, matSlot, range, rodX, span, type AssetBrand, type Part, type PackPattern, type Size3 } from '@/packs/kit';

const o = { plan: false } as const;
const TAGS = ['branded', 'kingsmith', 'walkingpad', 'walking pad', 'treadmill', 'under desk', 'máy đi bộ', 'fitness', 'foldable'];

function fixed(w: number, d: number, h: number) {
  const s: Size3 = { w, d, h };
  return { defaultSize: s, minSize: s, maxSize: s, resizable: { w: false, d: false, h: false } };
}

const BRAND: AssetBrand = {
  name: 'KingSmith',
  model: 'WalkingPad C2 (WPS1F)',
  line: 'Foldable walking pad',
  url: 'https://www.walkingpad.com/collections/all/products/c2-walkingpad-4-leg-standing-desk-bundle',
  specs: [
    ['Unfolded (L × W × H)', '1445 × 518 × 125 mm'],
    ['Folded (L × W × H)', '825 × 518 × 136 mm'],
    ['Walking area', '1200 × 400 mm'],
    ['Speed', '0.5–6 km/h'],
    ['Net weight', '25 kg'],
    ['Max user weight', '100 kg'],
  ],
};

const SLOTS = [
  matSlot('body', 'Body', 'walkingpad-white'),
  matSlot('belt', 'Walking belt', 'walkingpad-belt'),
  matSlot('trim', 'Display glass, feet & wheels', 'walkingpad-black-gloss'),
  matSlot('led', 'Display LEDs', 'walkingpad-led'),
];
const VARIANTS = [
  { id: 'yellow', name: 'Yellow', materials: { body: 'walkingpad-yellow' } },
  { id: 'black', name: 'Black', materials: { body: 'walkingpad-graphite' } },
];

const W = 0.518;
const HOOD = 0.19; // motor hood length at the front end
const RAIL = 0.055; // side rail width
const DECK_H = 0.105; // belt surface height

/**
 * The motor hood: a rounded white cover with a black glass panel carrying the speed digits and two
 * touch keys, the transport wheels below its front edge. `z0..z1` along the item, base at y0.
 */
function hood(z0: number, z1: number, y0: number, h: number): Part[] {
  const zm = (z0 + z1) / 2;
  const parts: Part[] = [
    span('body', [-W / 2, W / 2], [y0 + 0.012, y0 + h], [z0, z1], { bevel: 0.028, plan: true }),
    span('body', [-W / 2 + 0.01, W / 2 - 0.01], [y0, y0 + 0.02], [z0 + 0.01, z1 - 0.01], o),
    // Black glass panel on top, set into the hood.
    span('trim', [-W * 0.34, W * 0.34], [y0 + h - 0.002, y0 + h + 0.001], [zm - 0.055, zm + 0.04], { bevel: 0.001, plan: false }),
  ];
  // Speed readout: a row of small LED digit blocks and the two touch keys (power / mode).
  for (const k of range(3)) parts.push(span('led', [-0.04 + k * 0.026, -0.022 + k * 0.026], [y0 + h + 0.001, y0 + h + 0.0018], [zm - 0.028, zm + 0.004], o));
  for (const s of [-1, 1]) {
    parts.push(cyl('led', [s * W * 0.22, y0 + h + 0.0012, zm - 0.012], 0.011, 0.0008, { segments: 20, plan: false }));
    parts.push(cyl('trim', [s * W * 0.22, y0 + h + 0.0016, zm - 0.012], 0.0075, 0.0008, { segments: 20, plan: false }));
  }
  // Transport wheels tucked under the front edge.
  for (const s of [-1, 1]) parts.push({ ...cyl('trim', [0, 0, 0], 0.022, 0.03, { segments: 16, plan: false }), position: [s * (W / 2 - 0.06), y0 + 0.022, z0 + 0.03], rotation: [0, 0, Math.PI / 2] } as Part);
  return parts;
}

/** A deck section from z0 to z1: side rails with grey grip strips, belt between, rubber feet below. */
function deck(z0: number, z1: number, y0: number, opts: { belt: boolean; endCap: 'none' | 'rear' }): Part[] {
  const parts: Part[] = [];
  const top = y0 + DECK_H - 0.02;
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? -W / 2 : W / 2 - RAIL;
    parts.push(span('body', [x0, x0 + RAIL], [y0 + 0.012, top + 0.012], [z0, z1], { bevel: 0.012 }));
    parts.push(span('trim', [x0 + 0.012, x0 + RAIL - 0.012], [top + 0.012, top + 0.0135], [z0 + 0.02, z1 - 0.02], o));
  }
  // Base plate under the belt.
  parts.push(span('body', [-W / 2 + RAIL, W / 2 - RAIL], [y0 + 0.012, y0 + 0.03], [z0, z1], o));
  if (opts.belt) parts.push(span('belt', [-W / 2 + RAIL + 0.004, W / 2 - RAIL - 0.004], [y0 + 0.03, top + 0.008], [z0 + 0.004, z1 - 0.004], { bevel: 0.006 }));
  for (const z of [z0 + 0.06, z1 - 0.06]) for (const s of [-1, 1]) parts.push(cyl('trim', [s * (W / 2 - 0.05), y0 + 0.006, z], 0.018, 0.012, { segments: 12, plan: false }));
  if (opts.endCap === 'rear') {
    // Rounded rear end cap over the back roller.
    parts.push(span('body', [-W / 2, W / 2], [y0 + 0.012, top + 0.012], [z1 - 0.045, z1], { bevel: 0.02, plan: false }));
    parts.push(rodX('trim', -W / 2 + RAIL, W / 2 - RAIL, top - 0.004, z1 - 0.05, 0.014, { segments: 16, plan: false }));
  }
  return parts;
}

/** Fold seam across the rails and the hinge knuckles at the fold. */
function hinge(z: number, y0: number): Part[] {
  const parts: Part[] = [];
  for (const s of [-1, 1]) {
    const x = s * (W / 2 - RAIL / 2);
    parts.push(span('trim', [x - RAIL / 2 - 0.0005, x + RAIL / 2 + 0.0005], [y0 + 0.012, y0 + DECK_H - 0.006], [z - 0.0015, z + 0.0015], o));
    parts.push({ ...cyl('body', [0, 0, 0], 0.02, 0.03, { segments: 16, plan: false }), position: [s * (W / 2 - 0.004), y0 + 0.05, z], rotation: [0, 0, Math.PI / 2] } as Part);
  }
  return parts;
}

const unfolded = defineItem({
  id: 'kingsmith-walkingpad-c2',
  name: 'KingSmith WalkingPad C2, unfolded',
  category: 'hobbies',
  type: 'activities',
  group: 'Fitness',
  tags: [...TAGS, 'unfolded', 'open'],
  description: 'Folding walking pad for under a standing desk, laid open: motor hood with a speed display and touch keys, a 120 × 40 cm belt between grip-strip rails, the fold seam in the middle. The folded one is its own item (it takes less floor).',
  ...fixed(W, 1.445, 0.125),
  slots: SLOTS,
  variants: VARIANTS,
  brand: BRAND,
  build: ({ d, h }) => {
    const z0 = -d / 2;
    const fold = z0 + 0.825; // the folded length: the rear half swings over onto the front half
    return [...hood(z0, z0 + HOOD, 0, h), ...deck(z0 + HOOD - 0.01, fold, 0, { belt: true, endCap: 'none' }), ...hinge(fold, 0), ...deck(fold, d / 2, 0, { belt: true, endCap: 'rear' })];
  },
});

const folded = defineItem({
  id: 'kingsmith-walkingpad-c2-folded',
  name: 'KingSmith WalkingPad C2, folded',
  category: 'hobbies',
  type: 'activities',
  group: 'Fitness',
  tags: [...TAGS, 'folded', 'stored'],
  description: 'The WalkingPad C2 folded in half for storage: the rear deck swung over onto the front one, belt inside, its rubber feet facing up, the hinge at the fold end. 82.5 × 51.8 cm — slides under a sofa or bed.',
  ...fixed(W, 0.825, 0.136),
  slots: SLOTS,
  variants: VARIANTS,
  brand: BRAND,
  build: ({ d, h }) => {
    const z0 = -d / 2;
    const z1 = d / 2;
    const half = 0.068;
    const parts: Part[] = [...hood(z0, z0 + HOOD, 0, 0.125), ...deck(z0 + HOOD - 0.01, z1, 0, { belt: true, endCap: 'none' })];
    // The rear half lies upside down on top (from the fold back towards the hood).
    const upper = deck(z0 + HOOD + 0.005, z1, 0, { belt: true, endCap: 'rear' }).map((p) => {
      const [x, y, z] = p.position;
      // Mirror about the fold end (z1) and flip upside down.
      const flipped: Part = { ...p, position: [x, h - y, z1 - (z - (z0 + HOOD + 0.005))] as [number, number, number], plan: false };
      const r = p.rotation ?? [0, 0, 0];
      flipped.rotation = [r[0] + Math.PI, r[1], r[2]];
      return flipped;
    });
    parts.push(...upper);
    // Hinge knuckles at the fold end, spanning both halves.
    for (const s of [-1, 1]) parts.push({ ...cyl('body', [0, 0, 0], half * 0.55, 0.03, { segments: 18, plan: false }), position: [s * (W / 2 - 0.016), h / 2, z1 - 0.03], rotation: [0, 0, Math.PI / 2] } as Part);
    return parts;
  },
});

const patterns: PackPattern[] = [
  {
    id: 'belt-grooves',
    name: 'Walking belt grooves',
    normalStrength: 0.9,
    draw(ctx, size) {
      ctx.fillStyle = '#d9d9d9';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = '#9a9a9a';
      const n = 48;
      for (let i = 0; i < n; i++) ctx.fillRect(0, Math.round((i * size) / n), size, Math.max(1, Math.round(size / n / 3)));
    },
  },
];

export default definePack({
  name: 'Branded fitness',
  version: '1.0.0',
  author: 'Neest',
  description: 'KingSmith WalkingPad C2 (WPS1F) folding walking pad, unfolded and folded, at its published sizes.',
  license: 'CC0 (made for Neest); brand names belong to their owners',
  items: [unfolded, folded],
  patterns,
  materials: [
    { id: 'walkingpad-white', name: 'WalkingPad white', category: 'solid', color: '#f1f1ef', roughness: 0.32 },
    { id: 'walkingpad-yellow', name: 'WalkingPad yellow', category: 'solid', color: '#f4cf1f', roughness: 0.32 },
    { id: 'walkingpad-graphite', name: 'WalkingPad graphite', category: 'solid', color: '#2a2b2d', roughness: 0.35 },
    { id: 'walkingpad-belt', name: 'Walking belt', category: 'fabric', color: '#3a3b3d', roughness: 0.85, pattern: { id: 'belt-grooves', scale: 0.12, contrast: 0.8 } },
    { id: 'walkingpad-black-gloss', name: 'Black glass', category: 'solid', color: '#111214', roughness: 0.08 },
    { id: 'walkingpad-led', name: 'Display LED', category: 'solid', color: '#d8ecff', roughness: 0.3, emissive: '#9fd0ff', emissiveIntensity: 1.6 },
  ],
});

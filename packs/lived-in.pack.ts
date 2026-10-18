/**
 * Lived-in — the small everyday things that make a home look used rather than staged: a dinner
 * place setting and shared family dishes, two coffee mugs, an open book with reading glasses, a
 * magazine stack, a TV remote with coasters, a chopping board with vegetables, cooking condiments,
 * dish soap with a sponge, a pair of sneakers, house slippers and a bathroom toiletries set.
 * Tabletop pieces sit at table, counter or nightstand height by default.
 */
import {
  clamp,
  containParts,
  cyl,
  defineItem,
  definePack,
  matSlot,
  plantBox,
  rod,
  span,
  sphere,
  torus,
  type PackMaterial,
  type Part,
  type Size3,
} from '@/packs/kit';

type V3 = [number, number, number];
const o = { plan: false } as const;
const keep = (parts: Part[], size: Size3) => containParts(parts, plantBox(size));

const materials: PackMaterial[] = [
  { id: 'stoneware', name: 'Speckled stoneware', category: 'solid', color: '#ece6da', roughness: 0.45, pattern: { id: 'terrazzo', scale: 0.08, contrast: 0.25 } },
  { id: 'stoneware-dark', name: 'Charcoal stoneware', category: 'solid', color: '#3d3b38', roughness: 0.5 },
  { id: 'placemat-linen', name: 'Linen placemat', category: 'fabric', color: '#cbbda6', roughness: 0.95, pattern: { id: 'weave', scale: 0.03, contrast: 0.4 } },
  { id: 'cooked-rice', name: 'Steamed rice', category: 'solid', color: '#f4f1e7', roughness: 0.9 },
  { id: 'grilled-salmon', name: 'Grilled salmon', category: 'solid', color: '#df7f52', roughness: 0.7 },
  { id: 'leafy-greens', name: 'Leafy greens', category: 'solid', color: '#5e8e3c', roughness: 0.7 },
  { id: 'miso-soup', name: 'Miso soup', category: 'solid', color: '#b7894a', roughness: 0.3 },
  { id: 'water-glass', name: 'Drinking glass', category: 'glass', color: '#e3f0f2', roughness: 0.05, opacity: 0.35 },
  { id: 'soy-sauce', name: 'Soy sauce', category: 'solid', color: '#2a170d', roughness: 0.2 },
  { id: 'cooking-oil', name: 'Cooking oil', category: 'glass', color: '#d0a53a', roughness: 0.1, opacity: 0.75 },
  { id: 'tomato', name: 'Tomato', category: 'solid', color: '#cf3b26', roughness: 0.35 },
  { id: 'onion-skin', name: 'Onion', category: 'solid', color: '#e6d3a8', roughness: 0.5 },
  { id: 'carrot', name: 'Carrot', category: 'solid', color: '#e2742a', roughness: 0.6 },
  { id: 'paper-page', name: 'Book pages', category: 'solid', color: '#f2ede1', roughness: 0.9 },
  { id: 'cloth-cover-sage', name: 'Sage cloth cover', category: 'fabric', color: '#7c8c74', roughness: 0.85 },
  { id: 'glossy-cover', name: 'Magazine covers', category: 'solid', color: '#d9cbb5', roughness: 0.3, pattern: { id: 'rug-geometric', scale: 0.25, contrast: 0.5 } },
  { id: 'coffee-brew', name: 'Coffee', category: 'solid', color: '#3a2314', roughness: 0.15 },
  { id: 'black-plastic', name: 'Black plastic', category: 'solid', color: '#1e1e1f', roughness: 0.5 },
  { id: 'cork', name: 'Cork', category: 'solid', color: '#b48a5e', roughness: 0.95, pattern: { id: 'terrazzo', scale: 0.04, contrast: 0.4 } },
  { id: 'canvas-white', name: 'White canvas', category: 'fabric', color: '#eeede8', roughness: 0.85, pattern: { id: 'weave', scale: 0.02, contrast: 0.3 } },
  { id: 'rubber-sole', name: 'Gum sole', category: 'solid', color: '#d8cfc0', roughness: 0.8 },
  { id: 'felt-grey', name: 'Grey felt', category: 'fabric', color: '#8a8780', roughness: 1 },
  { id: 'sponge-yellow', name: 'Sponge', category: 'solid', color: '#e6c54a', roughness: 1 },
  { id: 'soap-green', name: 'Dish soap', category: 'glass', color: '#9cc27a', roughness: 0.1, opacity: 0.8 },
  { id: 'pump-white', name: 'White plastic', category: 'solid', color: '#f1f0ec', roughness: 0.4 },
];

/** Flat plate with a low rim. */
const plate = (slot: string, c: V3, r: number): Part[] => [
  cyl(slot, [c[0], c[1] + 0.006, c[2]], r, 0.012, { rTop: r, segments: 28, plan: false }),
  torus(slot, [c[0], c[1] + 0.013, c[2]], r - 0.005, 0.004, { rotation: [Math.PI / 2, 0, 0], plan: false }),
];
/** Bowl (flared cylinder) with its contents' surface just under the rim. */
const bowl = (slot: string, fill: string, c: V3, r: number, h: number): Part[] => [
  cyl(slot, [c[0], c[1] + h / 2, c[2]], r * 0.55, h, { rTop: r, segments: 24, plan: false }),
  cyl(fill, [c[0], c[1] + h * 0.82, c[2]], r * 0.88, 0.004, { segments: 24, plan: false }),
];
const chopsticks = (slot: string, c: V3, len: number, ang = 0): Part[] =>
  [-0.008, 0.008].map((dz) => {
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const a: V3 = [c[0] - (len / 2) * ca - dz * sa, c[1], c[2] + (len / 2) * sa - dz * ca];
    const b: V3 = [c[0] + (len / 2) * ca - dz * sa, c[1], c[2] - (len / 2) * sa - dz * ca];
    return rod(slot, a, b, 0.0028, { segments: 6, rTop: 0.0018, plan: false });
  });

// 1. Dinner place setting
const placeSetting = defineItem({
  id: 'dinner-place-setting',
  name: 'Dinner place setting with rice, salmon & soup',
  category: 'dining',
  type: 'decor',
  group: 'Candles & tabletop',
  tags: ['place setting', 'dinner', 'meal', 'plate', 'chopsticks', 'food', 'tableware', 'bữa cơm'],
  description: 'One person’s dinner on a linen placemat: a bowl of rice, grilled salmon with greens, miso soup, chopsticks on a rest and a cup of tea.',
  defaultSize: { w: 0.45, d: 0.34, h: 0.1 },
  minSize: { w: 0.38, d: 0.28, h: 0.08 },
  maxSize: { w: 0.55, d: 0.42, h: 0.14 },
  defaultElevation: 0.75,
  slots: [matSlot('dishes', 'Dishes & rice', 'stoneware'), matSlot('mat', 'Placemat', 'placemat-linen'), matSlot('food', 'Salmon, soup & tea', 'grilled-salmon'), matSlot('greens', 'Greens', 'leafy-greens')],
  build: (size) => {
    const { w, d } = size;
    const y = 0.003;
    return keep(
      [
        span('mat', [-w / 2, w / 2], [0, y], [-d / 2, d / 2], { plan: true }),
        ...plate('dishes', [-0.02, y, 0.0], 0.11),
        span('food', [-0.075, 0.025], [y + 0.012, y + 0.03], [0.0, 0.05], { bevel: 0.008, plan: false }),
        ...[-0.05, -0.02, 0.01, 0.035].map((x, i) => sphere('greens', [x, y + 0.022, -0.045 + (i % 2) * 0.01], 0.018, { scale: [1.2, 0.5, 0.8], plan: false })),
        // Rice bowl (the rice is a soft white mound) and miso soup.
        cyl('dishes', [0.15, y + 0.025, 0.07], 0.03, 0.05, { rTop: 0.055, segments: 24, plan: false }),
        sphere('dishes', [0.15, y + 0.045, 0.07], 0.048, { scale: [1, 0.4, 1], plan: false }),
        ...bowl('dishes', 'food', [0.15, y, -0.07], 0.05, 0.045),
        // Chopstick rest and chopsticks, tea cup.
        span('dishes', [-0.205, -0.185], [y, y + 0.01], [0.08, 0.1], { bevel: 0.004, plan: false }),
        ...chopsticks('dishes', [-0.19, y + 0.012, -0.01], 0.21, Math.PI / 2),
        ...bowl('dishes', 'food', [0.0, y, 0.135], 0.03, 0.05),
      ],
      size,
    );
  },
});

/** Shared dishes in the middle of the table. */
const sharedDishes = defineItem({
  id: 'shared-family-dishes',
  name: 'Shared family dishes',
  category: 'dining',
  type: 'decor',
  group: 'Candles & tabletop',
  tags: ['shared dishes', 'family meal', 'food', 'stir fry', 'soup', 'tableware', 'mâm cơm'],
  description: 'Dishes to share in the middle of the table: stir-fried greens, braised fish in a clay pot, a soup tureen and a little bowl of dipping sauce.',
  defaultSize: { w: 0.62, d: 0.3, h: 0.16 },
  minSize: { w: 0.5, d: 0.25, h: 0.12 },
  maxSize: { w: 0.8, d: 0.4, h: 0.2 },
  defaultElevation: 0.75,
  slots: [matSlot('dishes', 'Dishes', 'stoneware'), matSlot('greens', 'Greens', 'leafy-greens'), matSlot('fish', 'Fish & sauce', 'grilled-salmon'), matSlot('pot', 'Clay pot & tureen', 'stoneware-dark')],
  build: (size) => {
    const parts: Part[] = [...plate('dishes', [-0.2, 0, 0], 0.1)];
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4;
      parts.push(sphere('greens', [-0.2 + Math.cos(a) * 0.045 * (i % 3) * 0.6, 0.026, Math.sin(a) * 0.045 * (i % 3) * 0.6], 0.022, { scale: [1.3, 0.5, 0.9], plan: false }));
    }
    parts.push(
      cyl('pot', [0.0, 0.035, 0.02], 0.065, 0.07, { rTop: 0.07, segments: 24 }),
      cyl('fish', [0.0, 0.066, 0.02], 0.062, 0.006, { segments: 24, plan: false }),
      span('fish', [-0.04, 0.03], [0.068, 0.085], [0.0, 0.035], { bevel: 0.006, plan: false }),
      ...bowl('pot', 'greens', [0.2, 0, -0.01], 0.085, 0.09),
      cyl('pot', [0.2, 0.095, -0.01], 0.07, 0.01, { rTop: 0.05, segments: 20, plan: false }),
      sphere('pot', [0.2, 0.108, -0.01], 0.012, o),
      ...bowl('dishes', 'fish', [0.08, 0, 0.11], 0.03, 0.025),
    );
    return keep(parts, size);
  },
});

// 3. Coffee mugs
const mugs = defineItem({
  id: 'coffee-mugs-pair',
  name: 'Two coffee mugs on coasters',
  category: 'living',
  type: 'decor',
  group: 'Candles & tabletop',
  tags: ['mugs', 'coffee', 'tea', 'coasters', 'cups', 'tabletop'],
  description: 'A pair of stoneware mugs of coffee on cork coasters, one pushed a little further away, as if two people just sat down.',
  defaultSize: { w: 0.3, d: 0.16, h: 0.1 },
  minSize: { w: 0.24, d: 0.12, h: 0.08 },
  maxSize: { w: 0.4, d: 0.22, h: 0.12 },
  defaultElevation: 0.4,
  slots: [matSlot('mug', 'Mugs', 'stoneware'), matSlot('coffee', 'Coffee', 'coffee-brew'), matSlot('coaster', 'Coasters', 'cork')],
  build: (size) => {
    const parts: Part[] = [];
    for (const [x, z] of [
      [-0.07, 0.02],
      [0.08, -0.03],
    ]) {
      parts.push(
        cyl('coaster', [x, 0.003, z], 0.048, 0.006, { segments: 20 }),
        cyl('mug', [x, 0.05, z], 0.04, 0.088, { rTop: 0.042, segments: 20, plan: false }),
        cyl('coffee', [x, 0.087, z], 0.037, 0.004, { segments: 20, plan: false }),
        torus('mug', [x + 0.046, 0.05, z], 0.022, 0.006, { arc: Math.PI, rotation: [0, 0, -Math.PI / 2], plan: false }),
      );
    }
    return keep(parts, size);
  },
});

// 4. Open book and glasses
const openBook = defineItem({
  id: 'open-book-glasses',
  name: 'Open book with reading glasses',
  category: 'bedroom',
  type: 'decor',
  group: 'Ornaments',
  tags: ['book', 'open book', 'reading glasses', 'reading', 'nightstand', 'tabletop'],
  description: 'A cloth-bound book left open face up, with folded reading glasses resting beside it.',
  defaultSize: { w: 0.34, d: 0.24, h: 0.04 },
  minSize: { w: 0.26, d: 0.18, h: 0.03 },
  maxSize: { w: 0.44, d: 0.3, h: 0.06 },
  defaultElevation: 0.5,
  slots: [matSlot('pages', 'Pages', 'paper-page'), matSlot('cover', 'Cover', 'cloth-cover-sage'), matSlot('frames', 'Glasses', 'black-plastic')],
  build: (size) => {
    const bw = 0.24;
    const bd = 0.17;
    const parts: Part[] = [span('cover', [-bw / 2, bw / 2], [0, 0.004], [-bd / 2, bd / 2], { plan: true })];
    for (const s of [-1, 1]) parts.push(span('pages', s < 0 ? [-bw / 2 + 0.006, -0.004] : [0.004, bw / 2 - 0.006], [0.004, 0.016], [-bd / 2 + 0.005, bd / 2 - 0.005], { rotation: [0, 0, s * 0.06], plan: false }));
    const gx = 0.14;
    parts.push(
      torus('frames', [gx, 0.012, -0.03], 0.022, 0.0025, { rotation: [Math.PI / 2, 0, 0], plan: false }),
      torus('frames', [gx, 0.012, 0.025], 0.022, 0.0025, { rotation: [Math.PI / 2, 0, 0], plan: false }),
      rod('frames', [gx - 0.02, 0.014, -0.06], [gx - 0.02, 0.014, 0.06], 0.002, o),
    );
    return keep(parts, size);
  },
});

// 5. Magazine stack
const magazines = defineItem({
  id: 'magazine-stack',
  name: 'Stack of magazines',
  category: 'living',
  type: 'decor',
  group: 'Ornaments',
  tags: ['magazines', 'stack', 'coffee table', 'reading', 'tabletop'],
  description: 'A loose stack of interiors and travel magazines, each slightly askew.',
  defaultSize: { w: 0.32, d: 0.26, h: 0.04 },
  minSize: { w: 0.26, d: 0.2, h: 0.02 },
  maxSize: { w: 0.4, d: 0.32, h: 0.08 },
  defaultElevation: 0.4,
  slots: [matSlot('cover', 'Covers', 'glossy-cover'), matSlot('pages', 'Pages', 'paper-page')],
  build: (size) => {
    const n = clamp(Math.round(size.h / 0.007), 2, 10);
    const t = size.h / n;
    const parts: Part[] = [];
    for (let i = 0; i < n; i++) {
      const a = ((i * 37) % 11) / 11 - 0.5;
      parts.push(span(i === n - 1 ? 'cover' : i % 2 ? 'pages' : 'cover', [-0.11, 0.11], [i * t, (i + 1) * t], [-0.14, 0.14].map((v) => v * 0.6) as [number, number], { rotation: [0, a * 0.25, 0], plan: i === 0 }));
    }
    return keep(parts, size);
  },
});

// 6. Remote and coasters
const remote = defineItem({
  id: 'tv-remote-coasters',
  name: 'TV remote, coasters & candle',
  category: 'living',
  type: 'decor',
  group: 'Candles & tabletop',
  tags: ['remote', 'tv remote', 'coasters', 'candle', 'coffee table', 'tabletop'],
  description: 'Everyday coffee-table clutter: the TV remote, a stack of cork coasters and a candle in a small stoneware dish.',
  defaultSize: { w: 0.32, d: 0.14, h: 0.08 },
  minSize: { w: 0.26, d: 0.1, h: 0.06 },
  maxSize: { w: 0.42, d: 0.2, h: 0.12 },
  defaultElevation: 0.4,
  slots: [matSlot('remote', 'Remote', 'black-plastic'), matSlot('coaster', 'Coasters', 'cork'), matSlot('candle', 'Candle dish', 'stoneware')],
  build: (size) =>
    keep(
      [
        span('remote', [-0.15, -0.02], [0, 0.018], [-0.02, 0.02], { bevel: 0.006, rotation: [0, 0.2, 0] }),
        cyl('coaster', [0.04, 0.012, 0.02], 0.045, 0.024, { segments: 20, plan: false }),
        cyl('candle', [0.11, 0.01, -0.02], 0.04, 0.02, { rTop: 0.045, segments: 20, plan: false }),
        cyl('candle', [0.11, 0.04, -0.02], 0.028, 0.05, { segments: 20, plan: false }),
      ],
      size,
    ),
});

// 7. Chopping board with vegetables
const choppingBoard = defineItem({
  id: 'chopping-board-vegetables',
  name: 'Chopping board with vegetables',
  category: 'kitchen',
  type: 'decor',
  group: 'Candles & tabletop',
  tags: ['chopping board', 'cutting board', 'vegetables', 'cooking', 'knife', 'counter'],
  description: 'Dinner in progress on the counter: an oak board with a knife, a tomato half sliced and two carrots.',
  defaultSize: { w: 0.46, d: 0.3, h: 0.07 },
  minSize: { w: 0.38, d: 0.24, h: 0.05 },
  maxSize: { w: 0.6, d: 0.38, h: 0.1 },
  defaultElevation: 0.9,
  slots: [matSlot('board', 'Board & knife handle', 'wood-oak-natural'), matSlot('veg', 'Tomatoes', 'tomato'), matSlot('carrot', 'Carrots', 'carrot'), matSlot('blade', 'Knife blade', 'metal-stainless-polished')],
  build: (size) =>
    keep(
      [
        span('board', [-0.2, 0.18], [0, 0.02], [-0.12, 0.12], { bevel: 0.006, plan: true }),
        sphere('veg', [-0.11, 0.045, 0.03], 0.03, o),
        ...[0, 1, 2].map((i) => cyl('veg', [-0.04 + i * 0.024, 0.026, -0.04], 0.027, 0.008, { rotation: [0, 0, 0.3], segments: 16, plan: false })),
        ...[0, 1].map((i) => rod('carrot', [0.0, 0.034 + i * 0.012, 0.08 - i * 0.03], [0.16, 0.034 + i * 0.012, 0.06 - i * 0.03], 0.013, { rTop: 0.004, segments: 10, plan: false })),
        span('board', [0.02, 0.12], [0.02, 0.032], [-0.095, -0.075], { bevel: 0.004, plan: false }),
        span('blade', [0.12, 0.21], [0.021, 0.024], [-0.102, -0.068], { plan: false }),
      ],
      size,
    ),
});

// 8. Cooking condiments
const condiments = defineItem({
  id: 'cooking-condiments',
  name: 'Cooking condiments by the hob',
  category: 'kitchen',
  type: 'decor',
  group: 'Candles & tabletop',
  tags: ['condiments', 'soy sauce', 'oil', 'fish sauce', 'utensils', 'counter', 'nước mắm'],
  description: 'What lives next to the hob: bottles of oil, soy and fish sauce, a pepper mill and a crock of wooden spoons and spatulas.',
  defaultSize: { w: 0.36, d: 0.14, h: 0.34 },
  minSize: { w: 0.28, d: 0.1, h: 0.26 },
  maxSize: { w: 0.48, d: 0.2, h: 0.42 },
  defaultElevation: 0.9,
  slots: [matSlot('oil', 'Oil', 'cooking-oil'), matSlot('sauce', 'Sauces', 'soy-sauce'), matSlot('crock', 'Crock & mill', 'stoneware'), matSlot('wood', 'Utensils', 'wood-oak-natural')],
  build: (size) => {
    const parts: Part[] = [
      cyl('oil', [-0.14, 0.1, 0.0], 0.028, 0.2, { segments: 14, plan: false }),
      cyl('oil', [-0.14, 0.215, 0.0], 0.012, 0.03, { rTop: 0.008, segments: 10, plan: false }),
      cyl('sauce', [-0.08, 0.08, 0.02], 0.026, 0.16, { segments: 14, plan: false }),
      cyl('sauce', [-0.08, 0.17, 0.02], 0.01, 0.024, { segments: 10, plan: false }),
      cyl('sauce', [-0.03, 0.07, -0.02], 0.024, 0.14, { segments: 14, plan: false }),
      cyl('crock', [-0.03, 0.15, -0.02], 0.009, 0.02, { segments: 10, plan: false }),
      cyl('wood', [0.025, 0.07, 0.03], 0.018, 0.14, { rTop: 0.016, segments: 12, plan: false }),
      cyl('crock', [0.11, 0.06, 0.0], 0.05, 0.12, { rTop: 0.055, segments: 20 }),
    ];
    for (const [dx, dz, lean] of [
      [-0.015, 0.01, -0.15],
      [0.015, -0.01, 0.12],
      [0.0, 0.02, 0.02],
    ]) parts.push(rod('wood', [0.11 + dx, 0.03, dz], [0.11 + dx + lean * 0.3, 0.3, dz + 0.01], 0.006, { segments: 6, plan: false }));
    return keep(parts, size);
  },
});

// 9. Dish soap
const dishSoap = defineItem({
  id: 'dish-soap-sponge',
  name: 'Dish soap, sponge & brush',
  category: 'kitchen',
  type: 'decor',
  group: 'Candles & tabletop',
  tags: ['dish soap', 'sponge', 'brush', 'sink', 'washing up', 'counter'],
  description: 'Beside the sink: a bottle of green dish soap, a sponge and a wooden dish brush on a small stoneware tray.',
  defaultSize: { w: 0.24, d: 0.1, h: 0.22 },
  minSize: { w: 0.18, d: 0.08, h: 0.16 },
  maxSize: { w: 0.32, d: 0.14, h: 0.28 },
  defaultElevation: 0.9,
  slots: [matSlot('soap', 'Soap', 'soap-green'), matSlot('sponge', 'Sponge', 'sponge-yellow'), matSlot('tray', 'Tray & pump', 'stoneware'), matSlot('brush', 'Brush', 'wood-oak-natural')],
  build: (size) =>
    keep(
      [
        span('tray', [-0.11, 0.11], [0, 0.012], [-0.045, 0.045], { bevel: 0.004, plan: true }),
        cyl('soap', [-0.06, 0.095, 0], 0.03, 0.17, { segments: 16, plan: false }),
        cyl('tray', [-0.06, 0.19, 0], 0.01, 0.02, { segments: 10, plan: false }),
        span('sponge', [0.0, 0.09], [0.012, 0.042], [-0.03, 0.03], { bevel: 0.006, plan: false }),
        rod('brush', [0.04, 0.06, 0.02], [0.1, 0.16, 0.0], 0.007, { segments: 8, plan: false }),
        sphere('brush', [0.035, 0.05, 0.022], 0.02, { scale: [1, 0.8, 1], plan: false }),
      ],
      size,
    ),
});

// 10. Sneakers
const sneakers = defineItem({
  id: 'sneakers-pair',
  name: 'Pair of canvas sneakers',
  category: 'storage',
  type: 'storage',
  group: 'Hallway storage',
  tags: ['shoes', 'sneakers', 'trainers', 'entry', 'hallway', 'giày'],
  description: 'White canvas sneakers kicked off by the door, one slightly turned.',
  defaultSize: { w: 0.3, d: 0.3, h: 0.1 },
  minSize: { w: 0.24, d: 0.26, h: 0.08 },
  maxSize: { w: 0.36, d: 0.34, h: 0.12 },
  slots: [matSlot('upper', 'Uppers', 'canvas-white'), matSlot('sole', 'Soles', 'rubber-sole'), matSlot('laces', 'Laces & insole', 'felt-grey')],
  build: (size) => {
    const parts: Part[] = [];
    for (const [x, rot] of [
      [-0.065, 0.12],
      [0.07, -0.25],
    ]) {
      const r: [number, number, number] = [0, rot, 0];
      parts.push(
        span('sole', [x - 0.045, x + 0.045], [0, 0.022], [-0.13, 0.13], { bevel: 0.02, rotation: r, plan: true }),
        span('upper', [x - 0.04, x + 0.04], [0.02, 0.07], [-0.12, 0.06], { bevel: 0.025, rotation: r, plan: false }),
        span('upper', [x - 0.038, x + 0.038], [0.02, 0.045], [0.04, 0.12], { bevel: 0.02, rotation: r, plan: false }),
        span('laces', [x - 0.028, x + 0.028], [0.066, 0.072], [-0.08, -0.03], { rotation: r, plan: false }),
      );
    }
    return keep(parts, size);
  },
});

// 11. Slippers
const slippers = defineItem({
  id: 'house-slippers',
  name: 'Felt house slippers',
  category: 'storage',
  type: 'storage',
  group: 'Hallway storage',
  tags: ['slippers', 'house shoes', 'felt', 'entry', 'bedroom', 'dép'],
  description: 'A pair of grey felt house slippers left by the bed or the door.',
  defaultSize: { w: 0.26, d: 0.28, h: 0.06 },
  minSize: { w: 0.22, d: 0.24, h: 0.04 },
  maxSize: { w: 0.32, d: 0.32, h: 0.08 },
  slots: [matSlot('felt', 'Felt', 'felt-grey'), matSlot('sole', 'Soles', 'rubber-sole')],
  build: (size) => {
    const parts: Part[] = [];
    for (const [x, rot] of [
      [-0.055, 0.08],
      [0.06, -0.1],
    ]) {
      const r: [number, number, number] = [0, rot, 0];
      parts.push(
        span('sole', [x - 0.045, x + 0.045], [0, 0.014], [-0.125, 0.125], { bevel: 0.02, rotation: r, plan: true }),
        span('felt', [x - 0.044, x + 0.044], [0.014, 0.045], [0.0, 0.12], { bevel: 0.02, rotation: r, plan: false }),
      );
    }
    return keep(parts, size);
  },
});

// 12. Toiletries
const toiletries = defineItem({
  id: 'toiletries-set',
  name: 'Toothbrushes, soap & lotion',
  category: 'bathroom',
  type: 'plumbing',
  group: 'Bathroom accessories',
  tags: ['toiletries', 'toothbrush', 'soap dispenser', 'lotion', 'vanity', 'bathroom'],
  description: 'Daily bathroom things on the basin: two toothbrushes in a cup, a soap pump, a lotion bottle and a folded hand towel.',
  defaultSize: { w: 0.32, d: 0.12, h: 0.2 },
  minSize: { w: 0.24, d: 0.1, h: 0.16 },
  maxSize: { w: 0.4, d: 0.16, h: 0.26 },
  defaultElevation: 0.85,
  slots: [matSlot('ceramic', 'Cup & pump', 'stoneware'), matSlot('bottle', 'Bottles', 'pump-white'), matSlot('brush', 'Toothbrushes', 'sponge-yellow'), matSlot('towel', 'Hand towel', 'placemat-linen')],
  build: (size) =>
    keep(
      [
        cyl('ceramic', [-0.12, 0.045, 0.0], 0.03, 0.09, { segments: 16, plan: false }),
        rod('brush', [-0.125, 0.04, 0.0], [-0.14, 0.18, 0.005], 0.005, o),
        rod('brush', [-0.115, 0.04, 0.0], [-0.1, 0.17, -0.005], 0.005, o),
        cyl('ceramic', [-0.04, 0.06, 0.0], 0.032, 0.12, { segments: 16, plan: false }),
        cyl('bottle', [-0.04, 0.135, 0.0], 0.008, 0.03, { segments: 8, plan: false }),
        span('bottle', [-0.04, -0.01], [0.145, 0.153], [-0.004, 0.004], { plan: false }),
        cyl('bottle', [0.025, 0.07, 0.02], 0.025, 0.14, { segments: 16, plan: false }),
        span('towel', [0.06, 0.155], [0, 0.04], [-0.05, 0.05], { bevel: 0.01 }),
      ],
      size,
    ),
});

export default definePack({
  name: 'Lived-in',
  version: '1.0.0',
  author: 'Neest',
  description: 'Everyday clutter that makes a home look lived in: meals on the table, mugs, books, shoes, cooking things and toiletries.',
  license: 'CC0-1.0',
  materials,
  items: [placeSetting, sharedDishes, mugs, openBook, magazines, remote, choppingBoard, condiments, dishSoap, sneakers, slippers, toiletries],
});

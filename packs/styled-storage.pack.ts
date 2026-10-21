/**
 * Styled storage — detailed cabinets, wardrobes, shelves and racks with two models each: Filled, as
 * they look in a lived-in home (books, ornaments, plants and baskets on the shelves; hanging clothes,
 * folded stacks and shoes in the wardrobes; jars and tins in the pantry; bins and bottles on the
 * utility rack), and Empty. The contents are the Filled model's props: they never change the item's
 * size or plan outline, and their material slots only show while the item is filled.
 *
 * Rows of books, hanging clothes, folded stacks and pantry jars are a few textured blocks each (the
 * built-in book-spine pattern and this pack's colour patterns), so even a full walk-in run stays well
 * within the part budget; ornaments and plants are real shapes. Wire shelf decks use a see-through
 * pattern.
 */
import {
  clamp,
  cells,
  containParts,
  cyl,
  defineItem,
  definePack,
  lathe,
  matSlot,
  plantBox,
  range,
  rodX,
  span,
  sphere,
  torus,
  vcyl,
  type PackItem,
  type PackMaterial,
  type PackPattern,
  type Part,
  type Size3,
} from '@/packs/kit';

type V2 = [number, number];
const o = { plan: false } as const;
/** Hash of a position to [0, 1): the same spot always gets the same pick. */
const hash3 = (x: number, y: number, z: number) => {
  const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return h - Math.floor(h);
};

/**
 * Keeps parts inside the box and gives each its own texture offset from where it stands, so rows
 * of books, clothes, stacks and jars never repeat the same stretch of their pattern.
 */
const keep = (parts: Part[], size: Size3) =>
  containParts(parts, plantBox(size)).map((p) => ({ ...p, uv: [hash3(...p.position) * 4, hash3(p.position[2], p.position[0], p.position[1]) * 4] as [number, number] }));

/** Parts that are contents (books, clothes, decor…), whatever their slot: see `filled`. */
const FILL = new WeakSet<Part>();
/** Marks parts as contents. */
function F<T extends Part | Part[]>(p: T): T {
  for (const x of Array.isArray(p) ? p : [p]) FILL.add(x);
  return p;
}

/**
 * Splits an item into its furniture (the item's own build) and its contents (the "Filled" model's
 * props, the default) with an "Empty" model beside it. Contents are parts marked with `F` or in one
 * of the `fill` slots, which move from the item to the Filled model.
 */
function filled(item: PackItem, fill: string[]): PackItem {
  const fillSlots = new Set(fill);
  const isFill = (p: Part) => FILL.has(p) || fillSlots.has(p.slot);
  const raw = item.build;
  return {
    ...item,
    slots: item.slots.filter((sl) => !fillSlots.has(sl.id)),
    build: (size) => keep(raw(size).filter((p) => !isFill(p)), size),
    models: [
      { id: 'filled', name: 'Filled', slots: item.slots.filter((sl) => fillSlots.has(sl.id)), props: (size) => keep(raw(size).filter(isFill), size) },
      { id: 'empty', name: 'Empty' },
    ],
  };
}

/** Deterministic pseudo-random sequence for styling choices. */
function rng(seed: number) {
  let s = Math.imul(seed ^ 0x9e3779b9, 2654435761) >>> 0 || 1;
  for (let i = 0; i < 4; i++) s = (s * 1664525 + 1013904223) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ───────────────────────── Patterns & materials ─────────────────────────

const GARMENTS = ['#2f3b52', '#e9e4da', '#8a3b2c', '#6f7b5c', '#d7c3a5', '#1f1f22', '#a9b8c9', '#c97f5a', '#f2efe8', '#596a7a', '#7c5a46', '#b9a07a'];

const patterns: PackPattern[] = [
  {
    id: 'garments',
    name: 'Hanging clothes',
    colored: true,
    normalStrength: 0.7,
    draw(ctx, size, rand) {
      let x = 0;
      while (x < size) {
        const w = Math.round(size * (0.05 + rand() * 0.07));
        const c = GARMENTS[Math.floor(rand() * GARMENTS.length)];
        const g = ctx.createLinearGradient(x, 0, x + w, 0);
        g.addColorStop(0, '#00000033');
        g.addColorStop(0.15, c);
        g.addColorStop(0.85, c);
        g.addColorStop(1, '#00000044');
        ctx.fillStyle = c;
        ctx.fillRect(x, 0, w, size);
        ctx.fillStyle = g;
        ctx.fillRect(x, 0, w, size);
        // Sleeves and hems: slightly darker lower band on some garments.
        if (rand() < 0.5) {
          ctx.fillStyle = '#00000022';
          ctx.fillRect(x, Math.round(size * (0.55 + rand() * 0.3)), w, size);
        }
        x += w;
      }
    },
  },
  {
    id: 'folded-stack',
    name: 'Folded clothes stack',
    colored: true,
    normalStrength: 0.8,
    draw(ctx, size, rand) {
      let y = 0;
      while (y < size) {
        const h = Math.round(size * (0.07 + rand() * 0.06));
        ctx.fillStyle = GARMENTS[Math.floor(rand() * GARMENTS.length)];
        ctx.fillRect(0, y, size, h);
        ctx.fillStyle = '#00000030';
        ctx.fillRect(0, y + h - 2, size, 2);
        y += h;
      }
    },
  },
  {
    id: 'pantry-jars',
    name: 'Pantry jars and tins',
    colored: true,
    normalStrength: 0.6,
    draw(ctx, size, rand) {
      const contents = ['#d9b77a', '#7a4a2a', '#f1ece0', '#c58b3c', '#4e6b3a', '#b3442f', '#e8d39a', '#3b2a20'];
      ctx.fillStyle = '#e9e6df';
      ctx.fillRect(0, 0, size, size);
      let x = 0;
      while (x < size) {
        const w = Math.round(size * (0.1 + rand() * 0.06));
        const h = Math.round(size * (0.55 + rand() * 0.4));
        const tin = rand() < 0.3;
        ctx.fillStyle = tin ? '#b9bcc0' : '#dfe6e6';
        ctx.fillRect(x + 2, size - h, w - 4, h);
        ctx.fillStyle = contents[Math.floor(rand() * contents.length)];
        ctx.fillRect(x + 5, size - h * 0.85, w - 10, h * 0.85);
        ctx.fillStyle = tin ? '#7b7f84' : '#2b2b2b';
        ctx.fillRect(x + 3, size - h - 6, w - 6, 8);
        x += w;
      }
    },
  },
  {
    id: 'wire-deck',
    name: 'Wire shelf deck',
    cutout: true,
    normalStrength: 0.5,
    draw(ctx, size) {
      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = '#ffffff';
      const n = 10;
      const step = size / n;
      const t = Math.max(2, Math.round(step * 0.14));
      for (let i = 0; i < n; i++) ctx.fillRect(Math.round(i * step), 0, t, size);
      ctx.fillRect(0, 0, size, t * 2);
      ctx.fillRect(0, Math.round(size / 2), size, t * 2);
    },
  },
];

const materials: PackMaterial[] = [
  { id: 'garments-mix', name: 'Hanging clothes', category: 'fabric', color: '#ffffff', roughness: 0.95, pattern: { id: 'garments', scale: 0.6, contrast: 1 } },
  { id: 'folded-mix', name: 'Folded clothes', category: 'fabric', color: '#ffffff', roughness: 0.95, pattern: { id: 'folded-stack', scale: 0.35, contrast: 1 } },
  { id: 'pantry-mix', name: 'Pantry jars', category: 'solid', color: '#ffffff', roughness: 0.4, pattern: { id: 'pantry-jars', scale: 0.4, contrast: 1 } },
  { id: 'wire-chrome', name: 'Chrome wire deck', category: 'metal', color: '#d6d9dc', roughness: 0.25, metalness: 0.9, pattern: { id: 'wire-deck', scale: 0.25, contrast: 1 } },
  { id: 'smoked-glass', name: 'Smoked glass', category: 'glass', color: '#5a5f63', roughness: 0.05, opacity: 0.35 },
  { id: 'clear-glass-door', name: 'Clear glass', category: 'glass', color: '#e3eef0', roughness: 0.05, opacity: 0.22 },
  { id: 'jute-basket', name: 'Woven basket', category: 'fabric', color: '#c4a674', roughness: 1, pattern: { id: 'jute', scale: 0.08, contrast: 0.8 } },
  { id: 'stoneware-mix', name: 'Stoneware', category: 'solid', color: '#e8e2d6', roughness: 0.45, pattern: { id: 'terrazzo', scale: 0.1, contrast: 0.2 } },
];

// ───────────────────────── Styling helpers ─────────────────────────

/** A block of standing books (book-spine texture) from x0 to x1 on a shelf at y, backed against zBack. */
const bookBlock = (slot: string, x0: number, x1: number, y: number, h: number, zBack: number, d: number): Part => F(span(slot, [x0, x1], [y, y + h], [zBack, zBack + d], o));

/** Books lying flat in a small stack. */
const bookStack = (slot: string, cx: number, y: number, z: number, n: number, w = 0.2, d = 0.15): Part[] =>
  F(range(n).map((i) => span(slot, [cx - w / 2 + (i % 2) * 0.008, cx + w / 2 - (i % 2) * 0.006], [y + i * 0.028, y + (i + 1) * 0.028 - 0.002], [z - d / 2, z + d / 2], { rotation: [0, (i % 3) * 0.06 - 0.06, 0], plan: false })));

/** A small vase (lathe). */
const vase = (slot: string, cx: number, y: number, z: number, h: number): Part =>
  F(lathe(slot, [cx, y, z], [
    [0, 0],
    [h * 0.22, 0],
    [h * 0.3, h * 0.35],
    [h * 0.22, h * 0.75],
    [h * 0.12, h * 0.9],
    [h * 0.14, h],
    [0, h],
  ], { segments: 16, plan: false }));

/** A potted plant: a pot and a few leaf clumps. */
const plant = (pot: string, leaf: string, cx: number, y: number, z: number, h: number): Part[] => F([
  cyl(pot, [cx, y + h * 0.18, z], h * 0.2, h * 0.36, { rTop: h * 0.24, segments: 14, plan: false }),
  sphere(leaf, [cx, y + h * 0.55, z], h * 0.3, { scale: [1.1, 0.9, 1], plan: false }),
  sphere(leaf, [cx - h * 0.18, y + h * 0.48, z + h * 0.05], h * 0.2, o),
  sphere(leaf, [cx + h * 0.16, y + h * 0.7, z - h * 0.04], h * 0.18, o),
]);

/** A trailing plant spilling over a shelf edge. */
const trailing = (pot: string, leaf: string, cx: number, y: number, z: number): Part[] => F([
  cyl(pot, [cx, y + 0.05, z], 0.06, 0.1, { rTop: 0.07, segments: 14, plan: false }),
  sphere(leaf, [cx, y + 0.12, z], 0.08, { scale: [1.2, 0.6, 1], plan: false }),
  sphere(leaf, [cx + 0.05, y - 0.02, z + 0.06], 0.05, { scale: [0.7, 2.2, 0.7], plan: false }),
  sphere(leaf, [cx - 0.06, y - 0.06, z + 0.05], 0.045, { scale: [0.7, 2.6, 0.7], plan: false }),
]);

/** A picture frame leaning against the back. */
const frame = (slot: string, art: string, cx: number, y: number, zBack: number, w: number, h: number): Part[] => F([
  { ...span(slot, [-w / 2, w / 2], [0, h], [-0.008, 0.008], o), position: [cx, y + h / 2, zBack + 0.03], rotation: [-0.12, 0, 0] } as Part,
  { ...span(art, [-w / 2 + 0.015, w / 2 - 0.015], [0, h - 0.03], [-0.003, 0.003], o), position: [cx, y + h / 2, zBack + 0.04], rotation: [-0.12, 0, 0] } as Part,
]);

/**
 * Fills one shelf bay (x0..x1 at height y, clear height h, depth d from zBack) with a mix of books,
 * ornaments, plants and boxes, chosen by `seed`: groups of books of uneven heights (some leaning or
 * lying flat), vases, plants, baskets, frames and candles, arranged from either side.
 */
function styleBay(s: { books: string; decor: string; plant: string; box?: string }, x0: number, x1: number, y: number, h: number, zBack: number, d: number, seed: number): Part[] {
  const r = rng(seed);
  const parts: Part[] = [];
  const w = x1 - x0;
  const zc = zBack + d * 0.5;
  const bh = clamp(h * 0.82, 0.12, 0.3);
  const bd = clamp(d * 0.75, 0.12, 0.24);
  /** Standing books from a to b in 1–4 groups of different heights and depths, maybe one leaning at the end. */
  const books = (a: number, b: number) => {
    const n = clamp(Math.round(((b - a) / 0.12) * (0.4 + r() * 0.6)), 1, 4);
    let x = a;
    for (const i of range(n)) {
      const end = i === n - 1 ? b : x + ((b - a) / n) * (0.7 + r() * 0.6);
      parts.push(bookBlock(s.books, x, Math.min(end, b) - 0.002, y, bh * (0.68 + r() * 0.32), zBack, bd * (0.8 + r() * 0.2)));
      x = Math.min(end, b);
    }
    if (r() < 0.4 && b - a > 0.12 && b < x1 - 0.1) {
      const lean = 0.2 + r() * 0.15;
      const hh = bh * 0.85;
      parts.push({ ...span(s.books, [-0.015, 0.015], [-hh / 2, hh / 2], [-bd / 2, bd / 2], o), position: [b + Math.sin(lean) * hh * 0.5 + 0.02, y + Math.cos(lean) * hh * 0.5, zBack + bd / 2], rotation: [0, 0, lean] } as Part);
    }
  };
  const candles = (cx: number) => {
    for (const k of range(1 + Math.floor(r() * 3))) parts.push(cyl(s.decor, [cx + k * 0.06, y + 0.04 + k * 0.012, zc], 0.025, 0.08 + k * 0.025, { segments: 14, plan: false }));
  };
  const kind = Math.floor(r() * 8);
  const split = 0.45 + r() * 0.2;
  if (kind === 0) books(x0 + 0.01, x1 - 0.01);
  else if (kind === 1) {
    books(x0 + 0.01, x0 + w * split);
    parts.push(vase(s.decor, x0 + w * (split + 1) * 0.5 + 0.02, y, zc, Math.min(h * (0.55 + r() * 0.25), 0.28)));
  } else if (kind === 2) {
    parts.push(...plant(s.decor, s.plant, x0 + w * 0.28, y, zc, Math.min(h * (0.65 + r() * 0.25), 0.3)));
    const n = 2 + Math.floor(r() * 3);
    parts.push(...bookStack(s.books, x0 + w * 0.72, y, zc, n, Math.min(0.2, w * 0.38)));
    if (r() < 0.6) parts.push(sphere(s.decor, [x0 + w * 0.72, y + n * 0.028 + 0.03, zc], 0.03, o));
  } else if (kind === 3) {
    const n = w > 0.5 ? 2 : 1;
    for (const cx of cells(n, x0 + 0.01, x1 - 0.01)) parts.push(span(s.box ?? s.decor, [cx - w / (2 * n) + 0.015, cx + w / (2 * n) - 0.015], [y, y + Math.min(h * (0.6 + r() * 0.2), 0.26)], [zBack + 0.01, zBack + Math.min(d - 0.01, 0.3)], { bevel: 0.01, plan: false }));
  } else if (kind === 4) {
    parts.push(...frame(s.decor, s.books, x0 + w * 0.3, y, zBack, Math.min(w * 0.45, 0.3), Math.min(h * 0.8, 0.28)));
    if (r() < 0.5) books(x0 + w * 0.6, x1 - 0.01);
    else candles(x0 + w * 0.64);
  } else if (kind === 5) {
    // Books lying flat with a plant on top, then a short standing row.
    const n = 3 + Math.floor(r() * 3);
    parts.push(...bookStack(s.books, x0 + w * 0.25, y, zc, n, Math.min(0.22, w * 0.42)));
    if (h > n * 0.028 + 0.15) parts.push(...trailing(s.decor, s.plant, x0 + w * 0.25, y + n * 0.028, zc));
    books(x0 + w * 0.52, x1 - 0.01);
  } else if (kind === 6) {
    // A few books, a gap, a bookend ornament and candles.
    books(x0 + 0.01, x0 + w * 0.35);
    parts.push(sphere(s.decor, [x0 + w * 0.45, y + 0.045, zc], 0.045, { scale: [1, 1.2, 1], plan: false }));
    candles(x0 + w * 0.65);
  } else {
    // Two vases of different heights and a small stack.
    parts.push(vase(s.decor, x0 + w * 0.22, y, zc, Math.min(h * 0.8, 0.3)), vase(s.decor, x0 + w * 0.42, y, zc, Math.min(h * 0.5, 0.16)));
    parts.push(...bookStack(s.books, x0 + w * 0.74, y, zc, 2 + Math.floor(r() * 2), Math.min(0.2, w * 0.36)));
  }
  if (r() < 0.5) {
    // Arrange it from the other side.
    for (const p of parts) {
      p.position = [x0 + x1 - p.position[0], p.position[1], p.position[2]];
      if (p.rotation) p.rotation = [p.rotation[0], -p.rotation[1], -p.rotation[2]];
    }
  }
  return F(parts);
}

// ───────────────────────── Shelves ─────────────────────────

const styledCubes = filled(defineItem({
  id: 'styled-cube-shelf',
  name: 'Cube shelf with baskets',
  category: 'living',
  type: 'storage',
  group: 'Bookcases & shelves',
  tags: ['cube shelf', 'kallax', 'baskets', 'books', 'storage', 'kệ ô vuông'],
  description: 'A white cube shelf of 3 × 3 compartments: woven baskets, rows of books, a plant and ornaments, with a lamp and a vase on top.',
  defaultSize: { w: 1.12, d: 0.39, h: 1.12 },
  minSize: { w: 0.77, d: 0.33, h: 0.77 },
  maxSize: { w: 1.5, d: 0.42, h: 1.5 },
  slots: [matSlot('frame', 'Shelf', 'paint-pure-white'), matSlot('books', 'Books', 'book-mix'), matSlot('basket', 'Baskets', 'jute-basket'), matSlot('plant', 'Plants', 'plant-leaf')],
  build: (size) => {
    const { w, d, h } = size;
    const t = 0.018;
    const n = clamp(Math.round(w / 0.37), 2, 4);
    const m = clamp(Math.round(h / 0.37), 2, 4);
    const z0 = -d / 2;
    const parts: Part[] = [];
    for (const x of range(n + 1).map((i) => -w / 2 + (w * i) / n)) parts.push(span('frame', [Math.max(-w / 2, x - t / 2), Math.min(w / 2, x + t / 2)], [0, h], [z0, d / 2], o));
    for (const y of range(m + 1).map((i) => (h * i) / m)) parts.push(span('frame', [-w / 2, w / 2], [Math.max(0, y - t / 2), Math.min(h, y + t / 2)], [z0, d / 2], { plan: y === 0 }));
    const cw = w / n;
    const ch = h / m;
    let k = 0;
    for (const i of range(n))
      for (const j of range(m)) {
        const x0 = -w / 2 + cw * i + t / 2;
        const y0 = ch * j + t / 2;
        const pick = hash3(i, j, w) < 0.3 ? 0 : 1;
        if (pick === 0) parts.push(span('basket', [x0 + 0.015, x0 + cw - t - 0.015], [y0, y0 + ch - t - 0.03], [z0 + 0.02, d / 2 - 0.01], { bevel: 0.012, plan: false }));
        else parts.push(...styleBay({ books: 'books', decor: 'frame', plant: 'plant', box: 'basket' }, x0, x0 + cw - t, y0, ch - t, z0 + 0.01, d - 0.02, 31 + k * 5));
        k++;
      }
    return parts;
  },
}), ['books', 'basket', 'plant']);

const styledWallShelves = filled(defineItem({
  id: 'styled-floating-shelves',
  name: 'Floating oak shelves',
  category: 'living',
  type: 'storage',
  group: 'Bookcases & shelves',
  tags: ['floating shelves', 'wall shelves', 'books', 'plants', 'decor', 'kệ treo tường'],
  description: 'Three floating oak shelves on the wall styled with books, a trailing pothos, candles, a small vase and a leaning print.',
  defaultSize: { w: 1.0, d: 0.24, h: 0.95 },
  minSize: { w: 0.6, d: 0.18, h: 0.6 },
  maxSize: { w: 1.8, d: 0.3, h: 1.4 },
  mount: 'wall',
  defaultElevation: 1.0,
  slots: [matSlot('shelf', 'Shelves', 'wood-oak-natural'), matSlot('books', 'Books & print', 'book-mix'), matSlot('decor', 'Pots & candles', 'stoneware-mix'), matSlot('plant', 'Plants', 'plant-leaf')],
  build: (size) => {
    const { w, d, h } = size;
    const z0 = -d / 2;
    const ys = [0.02, h * 0.38, h * 0.74];
    const parts: Part[] = [];
    ys.forEach((y, i) => {
      parts.push(span('shelf', [-w / 2, w / 2], [y, y + 0.03], [z0, d / 2], { bevel: 0.004, plan: i === 0 }));
      const yy = y + 0.03;
      const gap = i < 2 ? ys[i + 1] - yy - 0.02 : h - yy - 0.01;
      if (i === 0) parts.push(bookBlock('books', -w / 2 + 0.04, -w * 0.05, yy, Math.min(gap, 0.24), z0, d * 0.8), ...trailing('decor', 'plant', w * 0.28, yy, z0 + d * 0.45));
      else if (i === 1) parts.push(...frame('shelf', 'books', -w * 0.25, yy, z0, Math.min(0.26, w * 0.3), Math.min(gap * 0.85, 0.26)), vase('decor', w * 0.1, yy, z0 + d * 0.5, Math.min(gap * 0.8, 0.22)), cyl('decor', [w * 0.32, yy + 0.04, z0 + d * 0.5], 0.035, 0.08, { segments: 14, plan: false }), cyl('decor', [w * 0.4, yy + 0.05, z0 + d * 0.5], 0.03, 0.1, { segments: 14, plan: false }));
      else parts.push(...bookStack('books', -w * 0.25, yy, z0 + d * 0.5, 3, 0.2, d * 0.7), ...plant('decor', 'plant', w * 0.25, yy, z0 + d * 0.5, Math.min(gap, 0.24)));
    });
    return parts;
  },
}), ['books', 'decor', 'plant']);

const styledDivider = filled(defineItem({
  id: 'styled-room-divider-shelf',
  name: 'Open room-divider shelf',
  category: 'living',
  type: 'storage',
  group: 'Bookcases & shelves',
  tags: ['room divider', 'open shelf', 'bookcase', 'partition', 'studio', 'kệ ngăn phòng'],
  description: 'A wide shelf open on both sides, to divide a studio while keeping light: books, plants and ornaments in a 4 × 4 grid of slender black frames.',
  defaultSize: { w: 1.6, d: 0.35, h: 1.8 },
  minSize: { w: 0.8, d: 0.28, h: 1.2 },
  maxSize: { w: 2.4, d: 0.42, h: 2.4 },
  slots: [matSlot('frame', 'Frame', 'metal-black-matte'), matSlot('shelf', 'Shelves', 'wood-oak-light'), matSlot('books', 'Books', 'book-mix'), matSlot('plant', 'Plants & pots', 'plant-leaf')],
  build: (size) => {
    const { w, d, h } = size;
    const n = clamp(Math.round(w / 0.4), 2, 6);
    const m = clamp(Math.round(h / 0.42), 3, 6);
    const parts: Part[] = [];
    for (const x of range(n + 1).map((i) => -w / 2 + 0.01 + ((w - 0.02) * i) / n)) for (const z of [-d / 2 + 0.01, d / 2 - 0.01]) parts.push(vcyl('frame', x, z, 0, h, 0.008, o));
    const ys = range(m).map((i) => 0.05 + ((h - 0.08) * i) / (m - 1));
    for (const y of ys) parts.push(span('shelf', [-w / 2, w / 2], [y, y + 0.022], [-d / 2, d / 2], { plan: y === ys[0] }));
    const cw = (w - 0.02) / n;
    ys.slice(0, -1).forEach((y, j) => {
      for (const i of range(n)) {
        if ((i + j) % 3 === 2) continue; // leave some bays open for light
        const x0 = -w / 2 + 0.01 + cw * i + 0.01;
        parts.push(...styleBay({ books: 'books', decor: 'shelf', plant: 'plant' }, x0, x0 + cw - 0.02, y + 0.022, ys[j + 1] - y - 0.03, -d / 2 + 0.02, d - 0.04, 53 + i * 5 + j * 11));
      }
    });
    return parts;
  },
}), ['books', 'plant']);

const kitchenShelves = filled(defineItem({
  id: 'styled-kitchen-wall-shelves',
  name: 'Kitchen wall shelves with rail',
  category: 'kitchen',
  type: 'storage',
  group: 'Kitchen cabinets',
  tags: ['kitchen shelves', 'open shelving', 'plates', 'jars', 'mugs', 'kệ bếp'],
  description: 'Two open kitchen shelves with a rail beneath: stacked plates and bowls, glass jars of pasta and rice, mugs on hooks and a leaning cutting board.',
  defaultSize: { w: 1.0, d: 0.26, h: 0.72 },
  minSize: { w: 0.6, d: 0.2, h: 0.5 },
  maxSize: { w: 1.6, d: 0.32, h: 1.0 },
  mount: 'wall',
  defaultElevation: 1.4,
  slots: [matSlot('shelf', 'Shelves & board', 'wood-oak-natural'), matSlot('ceramic', 'Plates & mugs', 'stoneware-mix'), matSlot('jars', 'Jars', 'pantry-mix'), matSlot('metal', 'Rail & brackets', 'metal-black-matte')],
  build: (size) => {
    const { w, d, h } = size;
    const z0 = -d / 2;
    const parts: Part[] = [rodX('metal', -w / 2 + 0.04, w / 2 - 0.04, 0.1, z0 + 0.05, 0.006, { plan: false })];
    for (const y of [0.16, h * 0.6]) {
      parts.push(span('shelf', [-w / 2, w / 2], [y, y + 0.028], [z0, d / 2], { bevel: 0.004, plan: y === 0.16 }));
      for (const s of [-1, 1]) parts.push(span('metal', [s * (w / 2 - 0.08) - 0.008, s * (w / 2 - 0.08) + 0.008], [y - 0.06, y], [z0, z0 + d * 0.7], o));
    }
    const y1 = 0.188;
    const y2 = h * 0.6 + 0.028;
    // Lower shelf: plates and bowls stacked, a cutting board leaning.
    for (const i of range(6)) parts.push(cyl('ceramic', [-w * 0.3, y1 + 0.006 + i * 0.012, z0 + d * 0.5], 0.11, 0.01, { segments: 24, plan: false }));
    for (const i of range(3)) parts.push(cyl('ceramic', [-w * 0.05, y1 + 0.03 + i * 0.045, z0 + d * 0.5], 0.06 + i * 0.004, 0.045, { rTop: 0.075, segments: 20, plan: false }));
    parts.push(F({ ...span('shelf', [-0.12, 0.12], [0, 0.32], [-0.01, 0.01], o), position: [w * 0.3, y1 + 0.16, z0 + 0.04], rotation: [-0.1, 0, 0.05] } as Part));
    // Upper shelf: a row of jars.
    parts.push(span('jars', [-w / 2 + 0.05, w * 0.15], [y2, y2 + Math.min(0.2, h - y2 - 0.01)], [z0 + 0.03, z0 + Math.min(0.15, d - 0.03)], o));
    parts.push(cyl('ceramic', [w * 0.32, y2 + 0.06, z0 + d * 0.5], 0.05, 0.12, { rTop: 0.06, segments: 16, plan: false }));
    // Mugs on the rail.
    for (const x of cells(4, -w * 0.25, w * 0.25)) parts.push(cyl('ceramic', [x, 0.05, z0 + 0.06], 0.035, 0.08, { segments: 14, plan: false }), torus('metal', [x, 0.1, z0 + 0.05], 0.012, 0.0025, o));
    return parts;
  },
}), ['ceramic', 'jars']);

// ───────────────────────── Wardrobes ─────────────────────────

/** Hanging clothes: a textured block of garments under a rail, with hanger hooks. */
function hangingClothes(slot: string, rail: string, x0: number, x1: number, yRail: number, length: number, z: number, d: number): Part[] {
  return [
    rodX(rail, x0, x1, yRail, z, 0.009, o),
    F(span(slot, [x0 + 0.02, x1 - 0.02], [yRail - length, yRail - 0.05], [z - d / 2, z + d / 2], { bevel: 0.02, plan: false })),
    ...F(cells(Math.max(3, Math.round((x1 - x0) / 0.12)), x0 + 0.04, x1 - 0.04).map((x) => torus(rail, [x, yRail + 0.012, z], 0.014, 0.002, { rotation: [0, Math.PI / 2, 0], arc: Math.PI * 1.4, plan: false }))),
  ];
}

/** Folded clothes stacks on a shelf. */
const foldedStacks = (slot: string, x0: number, x1: number, y: number, h: number, zBack: number, d: number): Part[] =>
  F(cells(Math.max(1, Math.round((x1 - x0) / 0.3)), x0, x1).map((cx, i) => span(slot, [cx - 0.13, cx + 0.13], [y, y + h * (0.62 + hash3(cx, y, i) * 0.38)], [zBack + 0.02, zBack + Math.min(d - 0.02, 0.34)], { bevel: 0.01, plan: false })));

/** Shoes in pairs on a low shelf. */
const shoes = (slot: string, x0: number, x1: number, y: number, z: number): Part[] =>
  F(cells(Math.max(1, Math.round((x1 - x0) / 0.2)), x0, x1).flatMap((cx) => [-0.045, 0.045].map((dx) => span(slot, [cx + dx - 0.04, cx + dx + 0.04], [y, y + 0.08], [z - 0.13, z + 0.13], { bevel: 0.025, plan: false }))));

const openWardrobe = filled(defineItem({
  id: 'open-wardrobe-clothes',
  name: 'Open oak wardrobe',
  category: 'bedroom',
  type: 'storage',
  group: 'Wardrobes',
  tags: ['open wardrobe', 'clothes', 'closet', 'hanging rail', 'shelves', 'tủ quần áo mở'],
  description: 'An open oak wardrobe: a hanging section full of clothes on hangers, shelves of folded jumpers and boxes beside it, and shoes along the bottom.',
  defaultSize: { w: 1.2, d: 0.55, h: 2.0 },
  minSize: { w: 0.9, d: 0.45, h: 1.7 },
  maxSize: { w: 2.0, d: 0.65, h: 2.4 },
  slots: [matSlot('frame', 'Wardrobe', 'wood-oak-light'), matSlot('clothes', 'Hanging clothes', 'garments-mix'), matSlot('folded', 'Folded clothes & shoes', 'folded-mix'), matSlot('metal', 'Rail', 'metal-black-matte')],
  build: (size) => {
    const { w, d, h } = size;
    const t = 0.02;
    const z0 = -d / 2;
    const split = -w / 2 + w * 0.6;
    const parts: Part[] = [
      span('frame', [-w / 2, -w / 2 + t], [0, h], [z0, d / 2], o),
      span('frame', [w / 2 - t, w / 2], [0, h], [z0, d / 2], o),
      span('frame', [-w / 2, w / 2], [h - t, h], [z0, d / 2], { plan: true }),
      span('frame', [-w / 2 + t, w / 2 - t], [0, 0.06], [z0, d / 2], o),
      span('frame', [-w / 2 + t, w / 2 - t], [0.06, h - t], [z0, z0 + 0.01], o),
      span('frame', [split - t / 2, split + t / 2], [0.06, h - t], [z0, d / 2], o),
      span('frame', [-w / 2 + t, split - t / 2], [h - 0.32, h - 0.3], [z0, d / 2], o),
      ...hangingClothes('clothes', 'metal', -w / 2 + t, split - t / 2, h - 0.38, Math.min(1.05, h - 0.75), 0, Math.min(0.42, d - 0.08)),
      ...foldedStacks('folded', -w / 2 + t + 0.02, split - t - 0.02, h - 0.3, 0.22, z0, d),
      ...shoes('folded', -w / 2 + t + 0.03, split - t - 0.03, 0.06, d * 0.1),
    ];
    const ys = range(5).map((i) => 0.06 + ((h - t - 0.06) * i) / 5);
    ys.forEach((y, i) => {
      if (i > 0) parts.push(span('frame', [split + t / 2, w / 2 - t], [y - t, y], [z0, d / 2], o));
      const gap = (h - t - 0.06) / 5 - t;
      if (i % 2 === 0) parts.push(...foldedStacks('folded', split + t / 2 + 0.01, w / 2 - t - 0.01, y, Math.min(gap * 0.8, 0.28), z0, d));
      else parts.push(span('folded', [split + t, w / 2 - t - 0.02], [y, y + Math.min(gap * 0.75, 0.24)], [z0 + 0.03, d / 2 - 0.05], { bevel: 0.01, plan: false }));
    });
    return parts;
  },
}), ['clothes', 'folded']);

const glassWardrobe = filled(defineItem({
  id: 'glass-door-wardrobe',
  name: 'Glass-door wardrobe',
  category: 'bedroom',
  type: 'storage',
  group: 'Wardrobes',
  tags: ['wardrobe', 'glass doors', 'smoked glass', 'clothes', 'closet', 'tủ kính'],
  description: 'A tall wardrobe with framed smoked-glass doors showing what is inside: hanging clothes, folded stacks and boxes on the top shelf, drawers below.',
  defaultSize: { w: 1.6, d: 0.6, h: 2.2 },
  minSize: { w: 1.0, d: 0.5, h: 1.9 },
  maxSize: { w: 2.4, d: 0.65, h: 2.6 },
  slots: [matSlot('frame', 'Body & door frames', 'paint-soft-black'), matSlot('glass', 'Door glass', 'smoked-glass'), matSlot('clothes', 'Clothes', 'garments-mix'), matSlot('folded', 'Folded clothes & drawers', 'folded-mix')],
  build: (size) => {
    const { w, d, h } = size;
    const t = 0.022;
    const z0 = -d / 2;
    const zf = d / 2 - 0.04;
    const drawerH = 0.42;
    const parts: Part[] = [
      span('frame', [-w / 2, -w / 2 + t], [0, h], [z0, zf], o),
      span('frame', [w / 2 - t, w / 2], [0, h], [z0, zf], o),
      span('frame', [-w / 2, w / 2], [h - t, h], [z0, zf], { plan: true }),
      span('frame', [-w / 2 + t, w / 2 - t], [0, drawerH], [z0, zf], o),
      span('frame', [-w / 2 + t, w / 2 - t], [drawerH, h - t], [z0, z0 + 0.01], o),
      span('frame', [-w / 2 + t, w / 2 - t], [h - 0.36, h - 0.34], [z0, zf], o),
      ...hangingClothes('clothes', 'frame', -w / 2 + t, w / 2 - t, h - 0.42, Math.min(1.1, h - drawerH - 0.5), 0, Math.min(0.45, d - 0.1)),
      ...foldedStacks('folded', -w / 2 + t + 0.02, w / 2 - t - 0.02, h - 0.34, 0.24, z0, d - 0.03),
    ];
    // Drawer fronts and pulls.
    for (const i of range(2)) parts.push(span('frame', [-w / 2 + t + 0.005, w / 2 - t - 0.005], [0.03 + i * 0.195, 0.215 + i * 0.195], [zf, zf + 0.018], { bevel: 0.003, plan: false }), rodX('frame', -0.12, 0.12, 0.12 + i * 0.195, zf + 0.03, 0.006, o));
    // Glass doors with slim frames.
    const nd = w > 1.3 ? 2 : 1;
    for (const k of range(nd)) {
      const a = -w / 2 + t + ((w - 2 * t) * k) / nd + 0.004;
      const b = -w / 2 + t + ((w - 2 * t) * (k + 1)) / nd - 0.004;
      parts.push(span('glass', [a + 0.02, b - 0.02], [drawerH + 0.02, h - t - 0.02], [zf + 0.004, zf + 0.008], o));
      for (const [x0, x1, y0, y1] of [
        [a, a + 0.02, drawerH, h - t],
        [b - 0.02, b, drawerH, h - t],
        [a, b, drawerH, drawerH + 0.02],
        [a, b, h - t - 0.02, h - t],
      ])
        parts.push(span('frame', [x0, x1], [y0, y1], [zf, zf + 0.022], o));
    }
    return parts;
  },
}), ['clothes', 'folded']);

const walkInRun = filled(defineItem({
  id: 'walk-in-closet-run',
  name: 'Walk-in closet run',
  category: 'bedroom',
  type: 'storage',
  group: 'Wardrobes',
  tags: ['walk-in closet', 'dressing room', 'clothes', 'shoes', 'shelves', 'phòng thay đồ'],
  description: 'A 2.4 m open closet system: long hanging, double hanging, folded stacks on shelves, a tower of drawers and slanted shoe shelves, all full.',
  defaultSize: { w: 2.4, d: 0.55, h: 2.3 },
  minSize: { w: 1.8, d: 0.45, h: 2.0 },
  maxSize: { w: 3.6, d: 0.62, h: 2.7 },
  slots: [matSlot('frame', 'Panels', 'wood-walnut'), matSlot('clothes', 'Hanging clothes', 'garments-mix'), matSlot('folded', 'Folded clothes & shoes', 'folded-mix'), matSlot('metal', 'Rails & handles', 'metal-brass')],
  build: (size) => {
    const { w, d, h } = size;
    const t = 0.022;
    const z0 = -d / 2;
    const xs = [-w / 2, -w / 2 + w * 0.25, -w / 2 + w * 0.5, -w / 2 + w * 0.72, w / 2];
    const parts: Part[] = [span('frame', [-w / 2, w / 2], [h - t, h], [z0, d / 2], { plan: true }), span('frame', [-w / 2, w / 2], [0, 0.05], [z0, d / 2], o)];
    xs.forEach((x) => parts.push(span('frame', [Math.max(-w / 2, x - t / 2), Math.min(w / 2, x + t / 2)], [0, h], [z0, d / 2], o)));
    parts.push(span('frame', [-w / 2, w / 2], [0.05, h - t], [z0, z0 + 0.01], o));
    // 1: long hanging.
    parts.push(...hangingClothes('clothes', 'metal', xs[0] + t / 2, xs[1] - t / 2, h - 0.3, 1.35, 0, d - 0.12), span('frame', [xs[0], xs[1]], [h - 0.28, h - 0.26], [z0, d / 2], o), ...foldedStacks('folded', xs[0] + 0.03, xs[1] - 0.03, h - 0.26, 0.2, z0, d));
    // 2: double hanging.
    parts.push(...hangingClothes('clothes', 'metal', xs[1] + t / 2, xs[2] - t / 2, h - 0.3, 0.85, 0, d - 0.12), ...hangingClothes('clothes', 'metal', xs[1] + t / 2, xs[2] - t / 2, h * 0.47, 0.85, 0, d - 0.12));
    // 3: shelves with folded stacks over drawers.
    const ys = [0.72, 1.06, 1.4, 1.74, 2.05].filter((y) => y < h - 0.1);
    for (const i of range(3)) parts.push(span('frame', [xs[2] + t / 2, xs[3] - t / 2], [0.05 + i * 0.22, 0.25 + i * 0.22], [d / 2 - 0.035, d / 2 - 0.015], o), rodX('metal', (xs[2] + xs[3]) / 2 - 0.08, (xs[2] + xs[3]) / 2 + 0.08, 0.15 + i * 0.22, d / 2 - 0.007, 0.005, o));
    ys.forEach((y, i) => {
      parts.push(span('frame', [xs[2] + t / 2, xs[3] - t / 2], [y - t, y], [z0, d / 2], o));
      if (i < ys.length - 1) parts.push(...foldedStacks('folded', xs[2] + t, xs[3] - t, y, Math.min(0.26, ys[i + 1] - y - 0.04), z0, d));
    });
    // 4: slanted shoe shelves and a hat box.
    for (const i of range(5)) {
      const y = 0.12 + i * 0.3;
      parts.push({ ...span('frame', [xs[3] + t / 2, xs[4] - t / 2], [-0.009, 0.009], [z0, d / 2 - 0.02], o), position: [(xs[3] + xs[4]) / 2, y, -0.01], rotation: [0.25, 0, 0] } as Part);
      parts.push(...shoes('folded', xs[3] + 0.04, xs[4] - 0.04, y + 0.02, 0).map((p) => ({ ...p, rotation: [0.25, 0, 0] as [number, number, number] })));
    }
    parts.push(cyl('folded', [(xs[3] + xs[4]) / 2, h - 0.18, -0.02], 0.15, 0.25, { segments: 20, plan: false }));
    return parts;
  },
}), ['clothes', 'folded']);

const clothesRail = filled(defineItem({
  id: 'styled-clothes-rail',
  name: 'Clothes rail with shelf',
  category: 'bedroom',
  type: 'storage',
  group: 'Wardrobes',
  tags: ['clothes rail', 'garment rack', 'open closet', 'shoes', 'giá treo quần áo'],
  description: 'A freestanding black metal rail full of shirts, dresses and coats, with a shelf of shoes and a woven basket underneath.',
  defaultSize: { w: 1.2, d: 0.45, h: 1.6 },
  minSize: { w: 0.8, d: 0.38, h: 1.3 },
  maxSize: { w: 1.8, d: 0.55, h: 1.9 },
  slots: [matSlot('metal', 'Frame', 'metal-black-matte'), matSlot('clothes', 'Clothes', 'garments-mix'), matSlot('shoes', 'Shoes', 'folded-mix'), matSlot('basket', 'Basket & shelf', 'jute-basket')],
  build: (size) => {
    const { w, d, h } = size;
    const parts: Part[] = [];
    for (const s of [-1, 1]) parts.push(vcyl('metal', s * (w / 2 - 0.02), 0, 0, h, 0.012, { plan: true }), rod2('metal', s * (w / 2 - 0.02), d / 2 - 0.02, -d / 2 + 0.02));
    parts.push(...hangingClothes('clothes', 'metal', -w / 2 + 0.02, w / 2 - 0.02, h - 0.03, Math.min(1.0, h - 0.45), 0, d - 0.12));
    parts.push(span('basket', [-w / 2 + 0.03, w / 2 - 0.03], [0.14, 0.16], [-d / 2 + 0.03, d / 2 - 0.03], { plan: true }), ...shoes('shoes', -w / 2 + 0.06, w * 0.15, 0.16, 0), F(span('basket', [w * 0.2, w / 2 - 0.06], [0.16, 0.36], [-d / 2 + 0.05, d / 2 - 0.05], { bevel: 0.015, plan: false })));
    return parts;
  },
}), ['clothes', 'shoes']);

/** Foot bar along z at x (for freestanding rails). */
function rod2(slot: string, x: number, z0: number, z1: number): Part {
  return { ...span(slot, [x - 0.012, x + 0.012], [0, 0.025], [Math.min(z0, z1), Math.max(z0, z1)], o) } as Part;
}

// ───────────────────────── Cabinets ─────────────────────────

const displayCabinet = filled(defineItem({
  id: 'styled-display-cabinet',
  name: 'Walnut glass display cabinet',
  category: 'living',
  type: 'storage',
  group: 'Sideboards & cabinets',
  tags: ['display cabinet', 'vitrine', 'glass doors', 'ceramics', 'tủ trưng bày'],
  description: 'A slim vitrine with clear glass doors and shelves of ceramics, glasses, books and a small plant, lit from inside like a little gallery.',
  defaultSize: { w: 0.9, d: 0.4, h: 1.9 },
  minSize: { w: 0.6, d: 0.32, h: 1.4 },
  maxSize: { w: 1.4, d: 0.48, h: 2.2 },
  slots: [matSlot('frame', 'Cabinet', 'wood-walnut'), matSlot('glass', 'Glass', 'clear-glass-door'), matSlot('decor', 'Ceramics & glasses', 'stoneware-mix'), matSlot('books', 'Books', 'book-mix')],
  build: (size) => {
    const { w, d, h } = size;
    const t = 0.022;
    const z0 = -d / 2;
    const zf = d / 2 - 0.02;
    const parts: Part[] = [
      span('frame', [-w / 2, -w / 2 + t], [0, h], [z0, zf], o),
      span('frame', [w / 2 - t, w / 2], [0, h], [z0, zf], o),
      span('frame', [-w / 2, w / 2], [h - t, h], [z0, zf], { plan: true }),
      span('frame', [-w / 2 + t, w / 2 - t], [0, 0.08], [z0, zf], o),
      span('frame', [-w / 2 + t, w / 2 - t], [0.08, h - t], [z0, z0 + 0.01], o),
      span('glass', [-w / 2 + 0.03, w / 2 - 0.03], [0.1, h - 0.03], [zf, zf + 0.006], o),
    ];
    const ys = range(4).map((i) => 0.08 + ((h - t - 0.08) * i) / 4);
    ys.forEach((y, i) => {
      if (i > 0) parts.push(span('glass', [-w / 2 + t, w / 2 - t], [y - 0.008, y], [z0 + 0.01, zf - 0.01], o));
      const yy = y;
      const gap = (h - t - 0.08) / 4 - 0.02;
      if (i === 0) parts.push(bookBlock('books', -w / 2 + t + 0.02, 0.05, yy, Math.min(gap, 0.26), z0 + 0.02, 0.2), vase('decor', w * 0.25, yy, 0, Math.min(gap * 0.8, 0.3)));
      else if (i === 1) for (const x of cells(4, -w / 2 + 0.08, w / 2 - 0.08)) parts.push(F(cyl('glass', [x, yy + 0.06, 0], 0.03, 0.12, { rTop: 0.035, segments: 12, plan: false })));
      else if (i === 2) {
        for (const k of range(5)) parts.push(cyl('decor', [-w * 0.2, yy + 0.006 + k * 0.012, 0], 0.1, 0.01, { segments: 20, plan: false }));
        parts.push(vase('decor', w * 0.2, yy, 0, Math.min(gap * 0.7, 0.24)));
      } else parts.push(...plant('decor', 'decor', -w * 0.2, yy, 0, Math.min(gap * 0.8, 0.25)), sphere('decor', [w * 0.2, yy + 0.06, 0], 0.06, o));
    });
    return parts;
  },
}), ['decor', 'books']);

const sideboard = filled(defineItem({
  id: 'styled-sideboard',
  name: 'Fluted oak sideboard',
  category: 'living',
  type: 'storage',
  group: 'Sideboards & cabinets',
  tags: ['sideboard', 'credenza', 'buffet', 'decor', 'lamp', 'tủ thấp'],
  description: 'A low oak sideboard with fluted doors, styled on top with a table lamp, a stack of art books, a ceramic vase of branches and a fruit bowl.',
  defaultSize: { w: 1.6, d: 0.45, h: 1.35 },
  minSize: { w: 1.0, d: 0.38, h: 1.1 },
  maxSize: { w: 2.2, d: 0.52, h: 1.5 },
  slots: [matSlot('wood', 'Sideboard', 'wood-oak-light'), matSlot('decor', 'Lamp, vase & bowl', 'stoneware-mix'), matSlot('books', 'Books', 'book-mix'), matSlot('metal', 'Legs & handles', 'metal-black-matte')],
  build: (size) => {
    const { w, d } = size;
    const bh = 0.78;
    const z0 = -d / 2;
    const zd = d / 2 - 0.03;
    const parts: Part[] = [span('wood', [-w / 2, w / 2], [0.12, bh], [z0, zd], { bevel: 0.006, plan: true })];
    for (const x of [-w / 2 + 0.06, w / 2 - 0.06]) for (const z of [z0 + 0.06, d / 2 - 0.06]) parts.push(vcyl('metal', x, z, 0, 0.12, 0.012, o));
    const nd = clamp(Math.round(w / 0.42), 2, 5);
    for (const i of range(nd)) {
      const a = -w / 2 + 0.01 + ((w - 0.02) * i) / nd + 0.003;
      const b = -w / 2 + 0.01 + ((w - 0.02) * (i + 1)) / nd - 0.003;
      parts.push(span('wood', [a, b], [0.14, bh - 0.02], [zd, zd + 0.012], { plan: false }));
      for (const x of cells(6, a + 0.01, b - 0.01)) parts.push(vcyl('wood', x, zd + 0.013, 0.15, bh - 0.03, 0.006, o));
    }
    // Styling on top.
    const y = bh;
    parts.push(
      cyl('decor', [-w * 0.36, y + 0.12, 0], 0.07, 0.24, { rTop: 0.05, segments: 18, plan: false }),
      cyl('decor', [-w * 0.36, y + 0.34, 0], 0.13, 0.16, { rTop: 0.09, segments: 18, plan: false }),
      ...bookStack('books', -w * 0.08, y, 0, 3, 0.26, 0.2),
      sphere('decor', [-w * 0.08, y + 0.11, 0], 0.035, o),
      vase('decor', w * 0.16, y, -0.02, 0.32),
      rod_('metal', w * 0.16, y + 0.3, -0.02),
      cyl('decor', [w * 0.36, y + 0.045, 0.02], 0.12, 0.08, { rTop: 0.15, segments: 20, plan: false }),
      sphere('books', [w * 0.34, y + 0.1, 0.02], 0.04, o),
      sphere('books', [w * 0.39, y + 0.1, 0.0], 0.038, o),
    );
    return parts;
  },
}), ['decor', 'books']);

/** Bare branches in a vase. */
function rod_(slot: string, x: number, y: number, z: number): Part {
  return F({ ...vcyl(slot, x, z, y, y + 0.22, 0.003, o), rotation: [0.15, 0, 0.12] } as Part);
}

const tvWallUnit = filled(defineItem({
  id: 'styled-tv-wall-unit',
  name: 'TV wall unit with niches',
  category: 'living',
  type: 'storage',
  group: 'Media units',
  tags: ['tv wall unit', 'media wall', 'entertainment unit', 'bookshelf', 'kệ tivi'],
  description: 'A full media wall: a low cabinet run, a TV recess and open niches on both sides filled with books, ornaments, a plant and speakers. Leave space for a 55" TV.',
  defaultSize: { w: 2.4, d: 0.4, h: 1.9 },
  minSize: { w: 1.8, d: 0.32, h: 1.5 },
  maxSize: { w: 3.6, d: 0.48, h: 2.4 },
  slots: [matSlot('body', 'Unit', 'paint-pure-white'), matSlot('wood', 'Niche backs & shelves', 'wood-oak-light'), matSlot('books', 'Books', 'book-mix'), matSlot('decor', 'Ornaments & plants', 'stoneware-mix')],
  build: (size) => {
    const { w, d, h } = size;
    const z0 = -d / 2;
    const base = 0.45;
    const side = Math.min(0.55, w * 0.22);
    const parts: Part[] = [span('body', [-w / 2, w / 2], [0.06, base], [z0, d / 2 - 0.012], { bevel: 0.004, plan: true }), span('body', [-w / 2 + 0.02, w / 2 - 0.02], [0, 0.06], [z0 + 0.02, d / 2 - 0.04], o)];
    const nd = clamp(Math.round(w / 0.6), 3, 6);
    for (const i of range(nd)) {
      const a = -w / 2 + (w * i) / nd + 0.003;
      parts.push(span('body', [a, a + w / nd - 0.006], [0.08, base - 0.02], [d / 2 - 0.011, d / 2 - 0.001], o));
    }
    for (const s of [-1, 1]) {
      const x0 = s < 0 ? -w / 2 : w / 2 - side;
      const x1 = x0 + side;
      parts.push(span('body', [x0, x0 + 0.02], [base, h], [z0, d / 2 - 0.05], o), span('body', [x1 - 0.02, x1], [base, h], [z0, d / 2 - 0.05], o), span('wood', [x0 + 0.02, x1 - 0.02], [base, h], [z0, z0 + 0.01], o), span('body', [x0, x1], [h - 0.02, h], [z0, d / 2 - 0.05], o));
      const ys = [base, base + (h - base) * 0.34, base + (h - base) * 0.67];
      ys.forEach((y, i) => {
        if (i > 0) parts.push(span('wood', [x0 + 0.02, x1 - 0.02], [y - 0.02, y], [z0, d / 2 - 0.05], o));
        parts.push(...styleBay({ books: 'books', decor: 'decor', plant: 'decor' }, x0 + 0.02, x1 - 0.02, y, (h - base) * 0.33 - 0.03, z0 + 0.01, d - 0.08, 71 + i * 9 + (s + 1) * 13));
      });
    }
    // Speakers either side of the TV recess.
    for (const s of [-1, 1]) parts.push(span('decor', [s * (w / 2 - side - 0.12) - 0.07, s * (w / 2 - side - 0.12) + 0.07], [base, base + 0.26], [z0 + 0.08, z0 + 0.28], { bevel: 0.01, plan: false }));
    return parts;
  },
}), ['books', 'decor']);

const pantry = filled(defineItem({
  id: 'styled-pantry-cabinet',
  name: 'Open pantry cabinet',
  category: 'kitchen',
  type: 'storage',
  group: 'Kitchen cabinets',
  tags: ['pantry', 'larder', 'jars', 'food storage', 'open doors', 'tủ đồ khô'],
  description: 'A tall larder cabinet with its doors open: shelves of jars, tins, cereal boxes, a basket of onions and bottles in the door racks.',
  defaultSize: { w: 0.8, d: 0.6, h: 2.1 },
  minSize: { w: 0.6, d: 0.5, h: 1.8 },
  maxSize: { w: 1.2, d: 0.65, h: 2.4 },
  slots: [matSlot('body', 'Cabinet', 'paint-sage'), matSlot('jars', 'Jars & tins', 'pantry-mix'), matSlot('boxes', 'Boxes & basket', 'jute-basket'), matSlot('wood', 'Shelves', 'wood-oak-natural')],
  build: (size) => {
    const { w, d, h } = size;
    const t = 0.02;
    const z0 = -d / 2;
    const parts: Part[] = [
      span('body', [-w / 2, -w / 2 + t], [0, h], [z0, d / 2 - 0.02], o),
      span('body', [w / 2 - t, w / 2], [0, h], [z0, d / 2 - 0.02], o),
      span('body', [-w / 2, w / 2], [h - t, h], [z0, d / 2 - 0.02], { plan: true }),
      span('body', [-w / 2, w / 2], [0, 0.08], [z0, d / 2 - 0.02], o),
      span('body', [-w / 2 + t, w / 2 - t], [0.08, h - t], [z0, z0 + 0.01], o),
    ];
    const ys = range(5).map((i) => 0.08 + ((h - t - 0.08) * i) / 5);
    ys.forEach((y, i) => {
      if (i > 0) parts.push(span('wood', [-w / 2 + t, w / 2 - t], [y - t, y], [z0, d / 2 - 0.04], o));
      const gap = (h - t - 0.08) / 5 - t;
      if (i === 0) parts.push(span('boxes', [-w / 2 + 0.05, w / 2 - 0.05], [y, y + gap * 0.7], [z0 + 0.04, d / 2 - 0.1], { bevel: 0.015, plan: false }));
      else if (i === 4) parts.push(span('boxes', [-w / 2 + 0.04, 0], [y, y + gap * 0.85], [z0 + 0.03, z0 + 0.25], o), span('boxes', [0.02, w / 2 - 0.04], [y, y + gap * 0.75], [z0 + 0.03, z0 + 0.22], o));
      else {
        // Jars and tins in uneven groups at the back, a lower row in front, sometimes a cereal box.
        const r = rng(91 + i * 17);
        let x = -w / 2 + 0.03;
        while (x < w / 2 - 0.08) {
          const x2 = Math.min(w / 2 - 0.03, x + 0.12 + r() * 0.2);
          if (r() < 0.2) parts.push(span('boxes', [x, x2 - 0.01], [y, y + Math.min(gap * 0.95, 0.3)], [z0 + 0.03, z0 + 0.2], o));
          else parts.push(span('jars', [x, x2 - 0.01], [y, y + Math.min(gap * (0.55 + r() * 0.35), 0.28)], [z0 + 0.03, z0 + 0.03 + Math.min(0.2, d * 0.4)], o));
          x = x2;
        }
        const a = -w / 2 + 0.03 + r() * 0.1;
        parts.push(span('jars', [a, a + (w - 0.1) * (0.4 + r() * 0.45)], [y, y + Math.min(gap * (0.4 + r() * 0.25), 0.2)], [z0 + 0.25, d / 2 - 0.08], o));
      }
    });
    return parts;
  },
}), ['jars', 'boxes']);

const dresser = filled(defineItem({
  id: 'styled-dresser',
  name: 'Walnut chest of drawers',
  category: 'bedroom',
  type: 'storage',
  group: 'Dressers & chests',
  tags: ['dresser', 'chest of drawers', 'mirror', 'perfume', 'decor', 'tủ ngăn kéo'],
  description: 'A six-drawer chest styled on top with a round mirror leaning against the wall, a tray of perfumes, a jewellery dish and a small plant.',
  defaultSize: { w: 1.0, d: 0.48, h: 1.45 },
  minSize: { w: 0.7, d: 0.4, h: 1.2 },
  maxSize: { w: 1.6, d: 0.55, h: 1.6 },
  slots: [matSlot('wood', 'Chest', 'wood-walnut'), matSlot('handle', 'Handles', 'metal-brass'), matSlot('decor', 'Tray, bottles & pot', 'stoneware-mix'), matSlot('mirror', 'Mirror', 'glass-mirror')],
  build: (size) => {
    const { w, d } = size;
    const bh = 0.85;
    const z0 = -d / 2;
    const zd = d / 2 - 0.04;
    const parts: Part[] = [span('wood', [-w / 2, w / 2], [0.08, bh], [z0, zd], { bevel: 0.006, plan: true })];
    for (const x of [-w / 2 + 0.05, w / 2 - 0.05]) for (const z of [z0 + 0.05, zd - 0.05]) parts.push(cyl('wood', [x, 0.04, z], 0.015, 0.08, { rTop: 0.02, segments: 10, plan: false }));
    for (const r of range(3))
      for (const c of range(2)) {
        const y0 = 0.1 + r * 0.245;
        const x0 = -w / 2 + 0.015 + c * (w / 2 - 0.0075);
        parts.push(span('wood', [x0, x0 + w / 2 - 0.0225], [y0, y0 + 0.235], [zd, zd + 0.012], { bevel: 0.003, plan: false }), sphere('handle', [x0 + (w / 2 - 0.0225) / 2, y0 + 0.12, zd + 0.024], 0.012, o));
      }
    parts.push(
      { ...cyl('mirror', [0, 0, 0], 0.27, 0.012, { segments: 32, plan: false }), position: [-w * 0.12, bh + 0.29, z0 + 0.05], rotation: [Math.PI / 2 - 0.12, 0, 0] } as Part,
      F({ ...torus('wood', [0, 0, 0], 0.27, 0.012, o), position: [-w * 0.12, bh + 0.29, z0 + 0.056], rotation: [-0.12, 0, 0] } as Part),
      span('decor', [w * 0.12, w * 0.4], [bh, bh + 0.015], [-0.08, 0.08], { bevel: 0.005, plan: false }),
      cyl('decor', [w * 0.18, bh + 0.06, 0], 0.025, 0.09, { segments: 12, plan: false }),
      cyl('mirror', [w * 0.26, bh + 0.05, 0.02], 0.02, 0.07, { segments: 12, plan: false }),
      cyl('decor', [w * 0.34, bh + 0.04, -0.02], 0.022, 0.05, { segments: 12, plan: false }),
      ...plant('decor', 'decor', w * 0.36, bh, z0 + 0.12, 0.2),
    );
    return parts;
  },
}), ['decor', 'mirror']);

const shoeRack = filled(defineItem({
  id: 'styled-shoe-rack',
  name: 'Slatted shoe rack',
  category: 'storage',
  type: 'storage',
  group: 'Hallway storage',
  tags: ['shoe rack', 'shoes', 'entry', 'hallway', 'kệ giày'],
  description: 'A three-tier slatted oak shoe rack full of sneakers, sandals and boots, with a basket of slippers on top.',
  defaultSize: { w: 0.9, d: 0.32, h: 0.75 },
  minSize: { w: 0.6, d: 0.28, h: 0.5 },
  maxSize: { w: 1.4, d: 0.38, h: 1.1 },
  slots: [matSlot('wood', 'Rack', 'wood-oak-light'), matSlot('shoes', 'Shoes', 'folded-mix'), matSlot('basket', 'Basket', 'jute-basket')],
  build: (size) => {
    const { w, d, h } = size;
    const parts: Part[] = [];
    for (const s of [-1, 1]) parts.push(span('wood', [s * w / 2 - (s > 0 ? 0.02 : 0), s * w / 2 + (s < 0 ? 0.02 : 0)].sort((a, b) => a - b) as V2, [0, h - 0.2], [-d / 2, d / 2], { plan: true }));
    const ys = [0.04, (h - 0.2) * 0.5, h - 0.22];
    ys.forEach((y, i) => {
      for (const z of cells(4, -d / 2 + 0.02, d / 2 - 0.02)) parts.push(span('wood', [-w / 2 + 0.02, w / 2 - 0.02], [y, y + 0.018], [z - 0.025, z + 0.025], { plan: i === 2 }));
      if (i < 2) parts.push(...shoes('shoes', -w / 2 + 0.06, w / 2 - 0.06, y + 0.018, 0).map((p) => ({ ...p, scale: [1, 1, Math.min(1, d / 0.3)] as [number, number, number] })));
    });
    parts.push(span('basket', [-w * 0.3, w * 0.3], [h - 0.2, h - 0.02], [-d / 2 + 0.02, d / 2 - 0.02], { bevel: 0.015, plan: false }));
    return parts;
  },
}), ['shoes', 'basket']);

const utilityRack = filled(defineItem({
  id: 'utility-wire-rack-filled',
  name: 'Chrome wire shelving rack',
  category: 'laundry',
  type: 'storage',
  group: 'Bookcases & shelves',
  tags: ['wire rack', 'utility shelving', 'storage rack', 'laundry', 'pantry', 'kệ inox'],
  description: 'A chrome wire shelving unit for the laundry, pantry or balcony: storage bins, detergent bottles, folded towels, paper towels and a basket of pegs.',
  defaultSize: { w: 0.9, d: 0.45, h: 1.8 },
  minSize: { w: 0.6, d: 0.35, h: 1.2 },
  maxSize: { w: 1.5, d: 0.6, h: 2.1 },
  slots: [matSlot('wire', 'Wire frame & decks', 'wire-chrome'), matSlot('bins', 'Bins & bottles', 'plastic-white'), matSlot('towels', 'Towels', 'folded-mix'), matSlot('basket', 'Baskets', 'jute-basket')],
  build: (size) => {
    const { w, d, h } = size;
    const parts: Part[] = [];
    for (const x of [-w / 2 + 0.012, w / 2 - 0.012]) for (const z of [-d / 2 + 0.012, d / 2 - 0.012]) parts.push(vcyl('wire', x, z, 0, h, 0.012, o));
    const n = clamp(Math.round(h / 0.42), 3, 5);
    const ys = range(n + 1).map((i) => 0.12 + ((h - 0.14) * i) / n);
    ys.forEach((y, i) => {
      parts.push(span('wire', [-w / 2 + 0.01, w / 2 - 0.01], [y - 0.003, y + 0.003], [-d / 2 + 0.01, d / 2 - 0.01], { plan: i === ys.length - 1 }));
      if (i === ys.length - 1) return;
      const gap = ys[i + 1] - y - 0.03;
      const pick = i % 4;
      if (pick === 0) parts.push(span('bins', [-w / 2 + 0.03, -0.01], [y, y + gap * 0.8], [-d / 2 + 0.03, d / 2 - 0.03], { bevel: 0.015, plan: false }), span('bins', [0.01, w / 2 - 0.03], [y, y + gap * 0.8], [-d / 2 + 0.03, d / 2 - 0.03], { bevel: 0.015, plan: false }));
      else if (pick === 1) {
        for (const x of cells(4, -w / 2 + 0.06, w * 0.1)) parts.push(cyl('bins', [x, y + gap * 0.3, 0], 0.045, gap * 0.6, { rTop: 0.03, segments: 12, plan: false }));
        parts.push(span('towels', [w * 0.15, w / 2 - 0.04], [y, y + gap * 0.7], [-d / 2 + 0.04, d / 2 - 0.04], { bevel: 0.01, plan: false }));
      } else if (pick === 2) parts.push(...range(3).map((k) => vcyl('bins', -w / 2 + 0.1 + k * 0.13, 0, y, y + Math.min(gap * 0.9, 0.26), 0.055, o)), span('basket', [w * 0.08, w / 2 - 0.04], [y, y + gap * 0.6], [-d / 2 + 0.04, d / 2 - 0.04], { bevel: 0.015, plan: false }));
      else parts.push(span('towels', [-w / 2 + 0.04, w / 2 - 0.04], [y, y + gap * 0.75], [-d / 2 + 0.04, d / 2 - 0.04], { bevel: 0.01, plan: false }));
    });
    return parts;
  },
}), ['bins', 'towels', 'basket']);

const items: PackItem[] = [
  styledCubes,
  styledWallShelves,
  styledDivider,
  kitchenShelves,
  openWardrobe,
  glassWardrobe,
  walkInRun,
  clothesRail,
  displayCabinet,
  sideboard,
  tvWallUnit,
  pantry,
  dresser,
  shoeRack,
  utilityRack,
];

export default definePack({
  name: 'Styled storage',
  version: '1.0.0',
  author: 'Neest',
  description: 'Detailed cabinets, wardrobes, shelves and racks that come filled: books, clothes, shoes, jars and decor.',
  license: 'CC0-1.0',
  patterns,
  materials,
  items,
});

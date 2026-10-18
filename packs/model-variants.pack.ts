/**
 * Model variants — alternative versions of library items, listed right after the original
 * (`variantOf`): empty versions of dressed furniture (a bookcase without books, a desk without
 * its accessories) and styled versions of bare furniture (a dining table set for dinner, a
 * sideboard with a lamp, vases and books).
 *
 * Empty versions drop the prop slots of the original. Styled versions build the original a bit
 * lower than their own box and stand props on its top, so everything stays inside the box.
 */
import {
  builtInAsset,
  containParts,
  cyl,
  defineItem,
  definePack,
  lathe,
  matSlot,
  plantBox,
  range,
  rng,
  span,
  sphere,
  type PackItem,
  type Part,
  type Size3,
} from '@/packs/kit';

const o = { plan: false };

function base(id: string) {
  const a = builtInAsset(id);
  if (!a) throw new Error(`model-variants: unknown base asset ${id}`);
  return a;
}

/** A version of `baseId` without the parts in `drop` slots. */
function empty(baseId: string, id: string, name: string, drop: string[], description: string, tags: string[]): PackItem {
  const b = base(baseId);
  return defineItem({
    id,
    name,
    category: b.category,
    type: b.type,
    group: b.group,
    tags: [...new Set([...b.tags, 'empty', 'bare', 'without props', ...tags])],
    description,
    defaultSize: b.defaultSize,
    minSize: b.minSize,
    maxSize: b.maxSize,
    resizable: b.resizable,
    mount: b.mount,
    defaultElevation: b.defaultElevation,
    wallSnap: b.wallSnap,
    slots: b.slots.filter((s) => !drop.includes(s.id)),
    build: (size) => b.build(size).filter((p) => !drop.includes(p.slot)),
    planDetail: b.planDetail,
    variantOf: baseId,
  });
}

type Slot = [id: string, label: string, material: string];

/** A version of `baseId` with props on its top surface, `extra` metres high. */
function styled(
  baseId: string,
  id: string,
  name: string,
  extra: number,
  slots: Slot[],
  props: (size: Size3, top: number) => Part[],
  description: string,
  tags: string[],
): PackItem {
  const b = base(baseId);
  const lift = (s: Size3 | undefined): Size3 | undefined => (s ? { ...s, h: s.h + extra } : undefined);
  return defineItem({
    id,
    name,
    category: b.category,
    type: b.type,
    group: b.group,
    tags: [...new Set([...b.tags, 'styled', 'decorated', ...tags])],
    description,
    defaultSize: lift(b.defaultSize)!,
    minSize: lift(b.minSize),
    maxSize: lift(b.maxSize),
    resizable: b.resizable,
    mount: b.mount,
    defaultElevation: b.defaultElevation,
    wallSnap: b.wallSnap,
    slots: [...b.slots, ...slots.map(([sid, label, m]) => matSlot(sid, label, m))],
    build: (size) => {
      const top = size.h - extra;
      // Props move or shrink to stay inside the box at small sizes.
      return [...b.build({ ...size, h: top }), ...containParts(props(size, top), plantBox(size))];
    },
    planDetail: b.planDetail ? (size) => b.planDetail!({ ...size, h: size.h - extra }) : undefined,
    variantOf: baseId,
  });
}

// ───────────── Props ─────────────

const plate = (slot: string, x: number, z: number, y: number, r = 0.13): Part[] => [
  cyl(slot, [x, y + 0.006, z], r, 0.012, { rTop: r * 1.02, segments: 24, ...o }),
  cyl(slot, [x, y + 0.016, z], r * 0.62, 0.008, { rTop: r * 0.7, segments: 20, ...o }),
];
const glass = (slot: string, x: number, z: number, y: number, h = 0.12): Part => cyl(slot, [x, y + h / 2, z], 0.03, h, { rTop: 0.037, segments: 16, ...o });
const bowl = (slot: string, x: number, z: number, y: number, r: number, h: number): Part =>
  lathe(
    slot,
    [x, y, z],
    [
      [r * 0.45, 0],
      [r * 0.8, h * 0.35],
      [r, h],
      [r * 0.94, h],
      [r * 0.4, h * 0.12],
    ],
    { segments: 24, ...o },
  );
const vase = (slot: string, x: number, z: number, y: number, h: number, r: number): Part =>
  lathe(
    slot,
    [x, y, z],
    [
      [r * 0.6, 0],
      [r, h * 0.35],
      [r * 0.85, h * 0.65],
      [r * 0.42, h * 0.88],
      [r * 0.55, h],
    ],
    { segments: 20, ...o },
  );
/** A stack of `n` books lying flat, slightly turned. */
function bookStack(slot: string, x: number, z: number, y: number, n: number, seed: number): Part[] {
  const rand = rng(seed);
  let yy = y;
  return range(n).map(() => {
    const t = 0.025 + rand() * 0.015;
    const w = 0.2 + rand() * 0.06;
    const d = 0.14 + rand() * 0.05;
    const p = span(slot, [x - w / 2, x + w / 2], [yy, yy + t], [z - d / 2, z + d / 2], { rotation: [0, (rand() - 0.5) * 0.5, 0], ...o });
    yy += t;
    return p;
  });
}
/** Books standing in a row with a bookend. */
function bookRowStanding(slot: string, x0: number, z: number, y: number, n: number, seed: number): Part[] {
  const rand = rng(seed);
  let x = x0;
  return range(n).map(() => {
    const t = 0.025 + rand() * 0.02;
    const h = 0.17 + rand() * 0.07;
    const p = span(slot, [x, x + t], [y, y + h], [z - 0.08, z + 0.08], o);
    x += t + 0.002;
    return p;
  });
}
/** Table lamp: a base, a stem and a drum shade. */
const lamp = (slot: string, shade: string, x: number, z: number, y: number, h: number): Part[] => [
  cyl(slot, [x, y + 0.012, z], 0.07, 0.024, { segments: 20, ...o }),
  cyl(slot, [x, y + h * 0.35, z], 0.012, h * 0.65, { segments: 10, ...o }),
  cyl(shade, [x, y + h * 0.78, z], 0.15, h * 0.42, { rTop: 0.12, segments: 24, ...o }),
];
const fruit = (slot: string, x: number, z: number, y: number, r: number): Part[] => {
  const rand = rng(Math.round(x * 100 + z * 10));
  return range(5).map((i) => sphere(slot, [x + Math.cos(i * 1.3) * r * 0.45 * rand(), y + r * (i === 4 ? 0.85 : 0.45), z + Math.sin(i * 1.3) * r * 0.45 * rand()], r * 0.32, o));
};

/** Place settings along both long sides of a rectangular top. */
function placeSettings(size: Size3, top: number, tw: string, gl: string): Part[] {
  const parts: Part[] = [];
  const n = Math.max(1, Math.floor((size.w - 0.2) / 0.6));
  const step = (size.w - 0.2) / n;
  for (const side of [-1, 1]) {
    for (const i of range(n)) {
      const x = -size.w / 2 + 0.1 + step * (i + 0.5);
      const z = side * (size.d / 2 - 0.17);
      parts.push(...plate(tw, x, z, top), glass(gl, x + 0.16, z - side * 0.12, top));
    }
  }
  parts.push(vase(tw, 0, 0, top, 0.18, 0.06));
  return parts;
}

function roundSettings(size: Size3, top: number, tw: string, gl: string): Part[] {
  const r = Math.min(size.w, size.d) / 2 - 0.17;
  const n = Math.max(2, Math.min(6, Math.floor((2 * Math.PI * r) / 0.55)));
  const parts: Part[] = [];
  for (const i of range(n)) {
    const a = (i / n) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    parts.push(...plate(tw, x, z, top, 0.12), glass(gl, x * 0.72 + Math.cos(a + 0.6) * 0.08, z * 0.72 + Math.sin(a + 0.6) * 0.08, top));
  }
  parts.push(bowl(tw, 0, 0, top, 0.11, 0.07), ...fruit(gl === 'glassware' ? 'tableware' : gl, 0, 0, top + 0.02, 0.1));
  return parts;
}

// ───────────── Items ─────────────

const items: PackItem[] = [
  // Empty versions of dressed furniture.
  empty('bookcase', 'bookcase-empty', 'Bookcase, empty', ['books'], 'The same bookcase with bare shelves, ready to fill with your own books and objects.', ['empty shelves']),
  empty('shelf-ladder', 'shelf-ladder-empty', 'Leaning ladder shelf, empty', ['books', 'decor', 'plant'], 'The leaning ladder shelf with its shelves left bare.', ['empty shelves']),
  empty('shelving-unit', 'shelving-unit-empty', 'Open shelving unit, empty', ['books', 'decor'], 'The open shelving unit with nothing on its shelves.', ['empty shelves']),
  empty('cube-storage', 'cube-storage-baskets-only', 'Cube storage, baskets only', ['books', 'decor'], 'The cube storage unit with only its fabric baskets: open cubes are left empty.', ['empty cubes']),
  empty('coffee-table-glass', 'coffee-table-glass-clear', 'Glass coffee table, clear top', ['books', 'decor'], 'The glass coffee table with nothing on it.', ['clear']),
  empty('console-table', 'console-table-bare', 'Console table, bare', ['decor', 'books'], 'The console table with an empty top.', ['clear top']),
  empty('tables-nesting', 'tables-nesting-bare', 'Nesting side tables, bare', ['decor', 'books'], 'The nesting side tables with clear tops.', ['clear top']),
  empty('desk-hutch', 'desk-hutch-empty', 'Desk with hutch, empty shelves', ['books'], 'The desk with hutch, its shelves left empty.', ['empty shelves']),
  empty('bedside-table', 'bedside-table-bare', 'Bedside table, bare', ['decor'], 'The bedside table with a clear top.', ['clear top']),
  empty('china-cabinet', 'china-cabinet-empty', 'China cabinet, empty', ['china'], 'The china cabinet with empty glass shelves.', ['empty shelves']),
  empty('display-cabinet', 'display-cabinet-empty', 'Glass display cabinet, empty', ['items'], 'The glass display cabinet with nothing on display.', ['empty shelves']),
  empty('bar-cart', 'bar-cart-no-bottles', 'Bar cart, no bottles', ['bottles'], 'The bar cart without its bottles, leaving the mirrored shelves and ice bucket.', ['no bottles']),
  empty('wine-rack', 'wine-rack-empty', 'Wine rack, empty', ['bottles', 'caps', 'labels'], 'The wine rack with every slot empty.', ['empty']),
  empty('dining-table-trestle', 'dining-table-trestle-no-runner', 'Farmhouse trestle table, no runner', ['runner'], 'The farmhouse trestle table without its linen runner.', ['plain']),
  empty('picnic-table', 'picnic-table-no-cloth', 'Picnic table, no cloth', ['cloth'], 'The picnic table without its tablecloth.', ['plain']),
  empty('utility-sink', 'utility-sink-empty', 'Utility sink, empty', ['items'], 'The utility sink with nothing on or under it.', ['empty']),
  // Styled versions of bare furniture.
  styled(
    'dining-table-rect',
    'dining-table-rect-set',
    'Rectangular dining table, set for dinner',
    0.19,
    [
      ['tableware', 'Tableware', 'ceramic-white'],
      ['glassware', 'Glasses', 'glass-clear'],
    ],
    (s, t) => placeSettings(s, t, 'tableware', 'glassware'),
    'The rectangular dining table laid for dinner: a plate and glass at every seat and a vase in the middle.',
    ['set table', 'place settings', 'dinner', 'plates', 'glasses'],
  ),
  styled(
    'dining-table-round',
    'dining-table-round-set',
    'Round dining table, set for dinner',
    0.13,
    [
      ['tableware', 'Tableware', 'ceramic-white'],
      ['glassware', 'Glasses', 'glass-clear'],
    ],
    (s, t) => roundSettings(s, t, 'tableware', 'glassware'),
    'The round dining table laid with plates and glasses around a fruit bowl.',
    ['set table', 'place settings', 'dinner', 'plates', 'fruit bowl'],
  ),
  styled(
    'dining-table-pedestal',
    'dining-table-pedestal-set',
    'Tulip pedestal table, set for two',
    0.13,
    [
      ['tableware', 'Tableware', 'ceramic-white'],
      ['glassware', 'Glasses', 'glass-clear'],
    ],
    (s, t) => roundSettings(s, t, 'tableware', 'glassware'),
    'The tulip pedestal table laid with plates and glasses around a fruit bowl.',
    ['set table', 'place settings', 'breakfast', 'plates'],
  ),
  styled(
    'patio-table',
    'patio-table-set',
    'Patio dining table, set for lunch',
    0.19,
    [
      ['tableware', 'Tableware', 'ceramic-white'],
      ['glassware', 'Glasses', 'glass-clear'],
    ],
    (s, t) => placeSettings(s, t, 'tableware', 'glassware'),
    'The patio dining table laid outdoors with plates, glasses and a vase.',
    ['set table', 'outdoor dining', 'lunch', 'plates', 'glasses'],
  ),
  styled(
    'coffee-table-round',
    'coffee-table-round-styled',
    'Round coffee table with books & vase',
    0.3,
    [
      ['books', 'Books', 'book-mix'],
      ['decor', 'Vase & tray', 'ceramic-sage'],
    ],
    (s, t) => [...bookStack('books', -s.w * 0.15, s.d * 0.05, t, 3, 11), vase('decor', s.w * 0.18, -s.d * 0.08, t, 0.28, 0.07), bowl('decor', s.w * 0.12, s.d * 0.2, t, 0.09, 0.05)],
    'The round coffee table styled with a stack of books, a tall vase and a small bowl.',
    ['books', 'vase', 'coffee table books'],
  ),
  styled(
    'side-table',
    'side-table-styled',
    'Side table with lamp & book',
    0.5,
    [
      ['shade', 'Lamp shade', 'fabric-cream'],
      ['books', 'Books', 'book-mix'],
    ],
    (s, t) => [...lamp('base', 'shade', -s.w * 0.12, -s.d * 0.08, t, 0.48), ...bookStack('books', s.w * 0.15, s.d * 0.15, t, 2, 5)],
    'The side table with a small table lamp and a couple of books.',
    ['table lamp', 'books', 'reading'],
  ),
  styled(
    'sideboard',
    'sideboard-styled',
    'Sideboard with lamp, vases & books',
    0.55,
    [['decor', 'Lamp shade, vases & books', 'ceramic-white']],
    (s, t) => [
      ...lamp('handle', 'decor', -s.w * 0.36, 0, t, 0.52),
      vase('decor', s.w * 0.05, -s.d * 0.1, t, 0.32, 0.08),
      vase('decor', s.w * 0.14, -s.d * 0.05, t, 0.2, 0.06),
      bowl('decor', s.w * 0.34, s.d * 0.05, t, 0.13, 0.07),
      ...bookStack('decor', -s.w * 0.12, s.d * 0.1, t, 3, 7),
    ],
    'The sideboard styled with a brass table lamp, two ceramic vases, a stack of books and a bowl.',
    ['table lamp', 'vases', 'credenza styling'],
  ),
  styled(
    'media-console',
    'media-console-styled',
    'Media console with books & vases',
    0.32,
    [
      ['books', 'Books', 'book-mix'],
      ['decor', 'Vases', 'ceramic-white'],
    ],
    (s, t) => [...bookRowStanding('books', -s.w * 0.45, -s.d * 0.1, t, 8, 21), vase('decor', s.w * 0.38, 0, t, 0.3, 0.07), bowl('decor', s.w * 0.25, s.d * 0.1, t, 0.1, 0.05)],
    'The media console with a row of books, a tall vase and a bowl, leaving the middle free for a TV.',
    ['books', 'vases', 'tv unit styling'],
  ),
  styled(
    'dresser',
    'dresser-styled',
    'Chest of drawers with tray, vase & books',
    0.3,
    [
      ['decor', 'Tray & vase', 'ceramic-white'],
      ['books', 'Books', 'book-mix'],
    ],
    (s, t) => [span('decor', [-s.w * 0.4, -s.w * 0.1], [t, t + 0.015], [-s.d * 0.25, s.d * 0.15], o), vase('decor', s.w * 0.3, -s.d * 0.1, t, 0.28, 0.07), ...bookStack('books', 0.05, 0, t, 2, 3)],
    'The chest of drawers styled with a tray, a vase and a couple of books.',
    ['tray', 'vase', 'bedroom styling'],
  ),
  styled(
    'kitchen-base-cabinet',
    'kitchen-base-cabinet-styled',
    'Kitchen base cabinet with jars & board',
    0.24,
    [['items', 'Jars & bowls', 'ceramic-white']],
    (s, t) => [
      span('items', [-s.w * 0.4, -s.w * 0.05], [t, t + 0.02], [-s.d * 0.3, s.d * 0.05], { bevel: 0.004, ...o }),
      ...range(3).map((i) => cyl('items', [s.w * (0.1 + i * 0.12), t + 0.08 + (i % 2) * 0.03, -s.d * 0.3], 0.05, 0.16 + (i % 2) * 0.06, { segments: 16, ...o })),
      bowl('items', s.w * 0.25, s.d * 0.15, t, 0.1, 0.06),
    ],
    'The kitchen base cabinet with a chopping board, three storage jars and a bowl on the worktop.',
    ['jars', 'chopping board', 'kitchen styling'],
  ),
  styled(
    'kitchen-island',
    'kitchen-island-styled',
    'Kitchen island with fruit bowl & vase',
    0.32,
    [['items', 'Bowl & vase', 'ceramic-white']],
    (s, t) => [bowl('items', -s.w * 0.15, 0, t, 0.16, 0.08), ...fruit('items', -s.w * 0.15, 0, t + 0.03, 0.14), vase('items', s.w * 0.22, -s.d * 0.1, t, 0.3, 0.07)],
    'The kitchen island with a fruit bowl and a tall vase of stems.',
    ['fruit bowl', 'vase', 'kitchen styling'],
  ),
];

export default definePack({
  name: 'Model variants',
  version: '1.0.0',
  author: 'Neest',
  description: 'Empty and styled versions of library furniture, listed next to the originals.',
  license: 'CC0-1.0',
  items,
});

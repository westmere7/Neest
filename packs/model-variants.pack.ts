/**
 * Model variants for library furniture: dressed items get an empty model (a bookcase without
 * books, a bar cart without bottles) and bare items a styled one (a dining table set for dinner,
 * a sideboard with a lamp, vases and books). Pick the model with the toggle on the library card,
 * in its info card, or in the Inspector for placed items.
 *
 * Empty models hide the prop slots of the original. Styled models stand props on the item's top;
 * the props rise above the item but never change its size, outline or collisions.
 *
 * These used to be separate library items ("Bookcase, empty"…); projects that placed them are
 * moved to the original item in the matching model when they load (RETIRED_MODEL_ITEMS).
 */
import { containParts, cyl, definePack, lathe, plantBox, matSlot, range, rng, span, sphere, type AssetModelVariant, type Part, type Size3 } from '@/packs/kit';

const o = { plan: false };

type Extension = { original: string; models: AssetModelVariant[] };

/** The original keeps its props; the "empty" model drops the parts in the `drop` slots. */
const empty = (drop: string[], name = 'Empty', original = 'Filled'): Extension => ({ original, models: [{ id: 'empty', name, hide: drop }] });

type Slot = [id: string, label: string, material: string];

/** How far props may rise above the item's top. */
const ABOVE = 1;

/** The original stays bare; the "styled" model adds props on its top (moved or shrunk to stay over the item at small sizes). */
const styled = (slots: Slot[], props: (size: Size3, top: number) => Part[], name = 'Styled', original = 'Bare'): Extension => ({
  original,
  models: [{ id: 'styled', name, slots: slots.map(([id, label, m]) => matSlot(id, label, m)), props: (size) => containParts(props(size, size.h), { ...plantBox(size), y1: size.h + ABOVE }) }],
});

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

// ───────────── Models ─────────────

const TABLEWARE: Slot[] = [
  ['tableware', 'Tableware', 'ceramic-white'],
  ['glassware', 'Glasses', 'glass-clear'],
];

const models: Record<string, Extension> = {
  // Empty models of dressed furniture.
  bookcase: empty(['books']),
  'shelf-ladder': empty(['books', 'decor', 'plant']),
  'shelving-unit': empty(['books', 'decor']),
  'cube-storage': empty(['books', 'decor'], 'Baskets only'),
  'coffee-table-glass': empty(['books', 'decor'], 'Clear top'),
  'console-table': empty(['decor', 'books'], 'Bare'),
  'tables-nesting': empty(['decor', 'books'], 'Bare'),
  'desk-hutch': empty(['books']),
  'bedside-table': empty(['decor'], 'Bare'),
  'china-cabinet': empty(['china']),
  'display-cabinet': empty(['items']),
  'bar-cart': empty(['bottles'], 'No bottles'),
  'wine-rack': empty(['bottles', 'caps', 'labels']),
  'dining-table-trestle': empty(['runner'], 'No runner', 'With runner'),
  'picnic-table': empty(['cloth'], 'No cloth', 'With cloth'),
  'utility-sink': empty(['items']),
  // Styled models of bare furniture.
  'dining-table-rect': styled(TABLEWARE, (s, t) => placeSettings(s, t, 'tableware', 'glassware'), 'Table set'),
  'dining-table-round': styled(TABLEWARE, (s, t) => roundSettings(s, t, 'tableware', 'glassware'), 'Table set'),
  'dining-table-pedestal': styled(TABLEWARE, (s, t) => roundSettings(s, t, 'tableware', 'glassware'), 'Table set'),
  'patio-table': styled(TABLEWARE, (s, t) => placeSettings(s, t, 'tableware', 'glassware'), 'Table set'),
  'coffee-table-round': styled(
    [
      ['books', 'Books', 'book-mix'],
      ['decor', 'Vase & tray', 'ceramic-sage'],
    ],
    (s, t) => [...bookStack('books', -s.w * 0.15, s.d * 0.05, t, 3, 11), vase('decor', s.w * 0.18, -s.d * 0.08, t, 0.28, 0.07), bowl('decor', s.w * 0.12, s.d * 0.2, t, 0.09, 0.05)],
  ),
  'side-table': styled(
    [
      ['shade', 'Lamp shade', 'fabric-cream'],
      ['books', 'Books', 'book-mix'],
    ],
    (s, t) => [...lamp('base', 'shade', -s.w * 0.12, -s.d * 0.08, t, 0.48), ...bookStack('books', s.w * 0.15, s.d * 0.15, t, 2, 5)],
  ),
  sideboard: styled([['decor', 'Lamp shade, vases & books', 'ceramic-white']], (s, t) => [
    ...lamp('handle', 'decor', -s.w * 0.36, 0, t, 0.52),
    vase('decor', s.w * 0.05, -s.d * 0.1, t, 0.32, 0.08),
    vase('decor', s.w * 0.14, -s.d * 0.05, t, 0.2, 0.06),
    bowl('decor', s.w * 0.34, s.d * 0.05, t, 0.13, 0.07),
    ...bookStack('decor', -s.w * 0.12, s.d * 0.1, t, 3, 7),
  ]),
  'media-console': styled(
    [
      ['books', 'Books', 'book-mix'],
      ['decor', 'Vases', 'ceramic-white'],
    ],
    (s, t) => [...bookRowStanding('books', -s.w * 0.45, -s.d * 0.1, t, 8, 21), vase('decor', s.w * 0.38, 0, t, 0.3, 0.07), bowl('decor', s.w * 0.25, s.d * 0.1, t, 0.1, 0.05)],
  ),
  dresser: styled(
    [
      ['decor', 'Tray & vase', 'ceramic-white'],
      ['books', 'Books', 'book-mix'],
    ],
    (s, t) => [span('decor', [-s.w * 0.4, -s.w * 0.1], [t, t + 0.015], [-s.d * 0.25, s.d * 0.15], o), vase('decor', s.w * 0.3, -s.d * 0.1, t, 0.28, 0.07), ...bookStack('books', 0.05, 0, t, 2, 3)],
  ),
  'kitchen-base-cabinet': styled([['items', 'Jars & bowls', 'ceramic-white']], (s, t) => [
    span('items', [-s.w * 0.4, -s.w * 0.05], [t, t + 0.02], [-s.d * 0.3, s.d * 0.05], { bevel: 0.004, ...o }),
    ...range(3).map((i) => cyl('items', [s.w * (0.1 + i * 0.12), t + 0.08 + (i % 2) * 0.03, -s.d * 0.3], 0.05, 0.16 + (i % 2) * 0.06, { segments: 16, ...o })),
    bowl('items', s.w * 0.25, s.d * 0.15, t, 0.1, 0.06),
  ]),
  'kitchen-island': styled([['items', 'Bowl & vase', 'ceramic-white']], (s, t) => [
    bowl('items', -s.w * 0.15, 0, t, 0.16, 0.08),
    ...fruit('items', -s.w * 0.15, 0, t + 0.03, 0.14),
    vase('items', s.w * 0.22, -s.d * 0.1, t, 0.3, 0.07),
  ]),
};

export default definePack({
  name: 'Model variants',
  version: '2.0.0',
  author: 'Neest',
  description: 'Empty and styled models of library furniture, picked with the model toggle.',
  license: 'CC0-1.0',
  items: [],
  models,
});

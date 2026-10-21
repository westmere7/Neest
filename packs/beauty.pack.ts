/**
 * Beauty — vanity tables and makeup desks that come set up, makeup and skincare sets, lotion trios,
 * perfumes, hair tools, jewellery, a lighted mirror, a nail polish rack, a beauty trolley, toiletry
 * shelves and a handbag display.
 *
 * The vanities have two models: Filled (set up with makeup and skincare, the default) and Empty;
 * the products are the Filled model's props and never change the vanity's size or outline.
 *
 * Small bottles, lipsticks and jars share one colour-swatch texture per slot: each part is offset to
 * the centre of a different swatch (see `finish`), so a tray of products comes out in assorted
 * colours with only a few material slots.
 */
import {
  cells,
  clamp,
  containParts,
  cyl,
  defineItem,
  definePack,
  lathe,
  matSlot,
  plantBox,
  range,
  rod,
  rodX,
  span,
  sphere,
  torus,
  vcyl,
  type Part,
  type PackItem,
  type PackMaterial,
  type PackPattern,
  type Size3,
} from '@/packs/kit';

type V3 = [number, number, number];
const o = { plan: false } as const;

// ───────────────────────── Colour swatches ─────────────────────────

/** Swatches per tile side in the swatch patterns. */
const N = 6;
/** Swatch size (metres) of each swatch material: its pattern scale is N × this. */
const CELL = { cosmetic: 0.12, skincare: 0.26, polish: 0.08 } as const;

const hash3 = (x: number, y: number, z: number) => {
  const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return h - Math.floor(h);
};

/** Where a part's texture coordinates are centred (box projection is centred; wrapped shapes start at 0). */
function uvCentre(p: Part): [number, number] {
  switch (p.shape) {
    case 'cylinder':
      return [Math.PI * Math.max(p.radiusTop, p.radiusBottom), p.height / 2];
    case 'sphere':
      return [Math.PI * p.radius, (Math.PI * p.radius) / 2];
    case 'torus':
      return [((p.arc ?? Math.PI * 2) * p.radius) / 2, Math.PI * p.tube];
    case 'lathe': {
      const maxR = Math.max(...p.profile.map(([r]) => r));
      const len = p.profile.reduce((s, q, i) => (i ? s + Math.hypot(q[0] - p.profile[i - 1][0], q[1] - p.profile[i - 1][1]) : 0), 0);
      return [Math.PI * maxR, len / 2];
    }
    default:
      return [0, 0];
  }
}

/**
 * Keeps parts in the box; parts in a swatch slot are centred on a swatch picked from where they
 * stand, every other part gets a varied texture offset.
 */
function finish(parts: Part[], size: Size3, swatch: Record<string, number> = {}): Part[] {
  return containParts(parts, plantBox(size)).map((p) => {
    const [x, y, z] = p.position;
    const cell = swatch[p.slot];
    if (!cell) return { ...p, uv: [hash3(x, y, z) * 4, hash3(z, x, y) * 4] as [number, number] };
    const [cu, cv] = uvCentre(p);
    const kx = Math.floor(hash3(x, y, z) * N);
    const ky = Math.floor(hash3(z + 3.1, x, y) * N);
    return { ...p, uv: [(kx + 0.5) * cell - cu, (ky + 0.5) * cell - cv] as [number, number] };
  });
}

const swatches = (colors: string[]) => (ctx: CanvasRenderingContext2D, size: number) => {
  for (const i of range(N))
    for (const j of range(N)) {
      const x0 = Math.round((i * size) / N);
      const y0 = Math.round((j * size) / N);
      ctx.fillStyle = colors[(i * 5 + j * 7 + ((i * j) % 3)) % colors.length];
      ctx.fillRect(x0, y0, Math.round(((i + 1) * size) / N) - x0, Math.round(((j + 1) * size) / N) - y0);
    }
};

const patterns: PackPattern[] = [
  {
    id: 'cosmetic-swatches',
    name: 'Cosmetic colours',
    colored: true,
    normalStrength: 0,
    draw: swatches(['#f2c4c9', '#e8a3a8', '#c45a6a', '#9e2235', '#6b1f2f', '#f4d6c3', '#dba98b', '#b77b5e', '#f7efe8', '#1d1b1c', '#d9b6d9', '#f0b9a0', '#e7d7c9', '#c9a46a']),
  },
  {
    id: 'skincare-swatches',
    name: 'Skincare bottle colours',
    colored: true,
    normalStrength: 0,
    draw: swatches(['#f6f1ea', '#efe3d3', '#f3d3d6', '#dfe7dc', '#e9e1f0', '#ffffff', '#d8c8b0', '#bfd3d9', '#f6e3c8', '#ede9e4']),
  },
  {
    id: 'polish-swatches',
    name: 'Nail polish colours',
    colored: true,
    normalStrength: 0,
    draw: swatches(['#c8102e', '#e75480', '#f4a6b8', '#ffd1dc', '#7b1e3a', '#d9a48f', '#f2e2d2', '#5b2a86', '#2e86c1', '#16a085', '#f39c12', '#111111', '#e8e8e8', '#b03a5b']),
  },
  {
    id: 'eyeshadow-pans',
    name: 'Eyeshadow palette',
    colored: true,
    normalStrength: 0.6,
    draw(ctx, size, rand) {
      const shades = ['#f3d9c8', '#e6b89c', '#c98b6b', '#a0583d', '#6e3626', '#3b2018', '#e9c1c6', '#c97e8a', '#9c4256', '#d9b26a', '#b98a4a', '#f5e6da', '#8e6c8a', '#4a3a48', '#d4a5a5', '#2a1f1d'];
      ctx.fillStyle = '#1b1a1a';
      ctx.fillRect(0, 0, size, size);
      const n = 4;
      const step = size / n;
      for (const i of range(n))
        for (const j of range(n)) {
          const c = shades[(i * 4 + j + Math.floor(rand() * 3)) % shades.length];
          const g = ctx.createRadialGradient(i * step + step * 0.4, j * step + step * 0.4, 1, i * step + step / 2, j * step + step / 2, step * 0.5);
          g.addColorStop(0, '#ffffff55');
          g.addColorStop(0.35, c);
          g.addColorStop(1, c);
          ctx.fillStyle = g;
          ctx.fillRect(i * step + step * 0.1, j * step + step * 0.1, step * 0.8, step * 0.8);
        }
    },
  },
];

const materials: PackMaterial[] = [
  { id: 'cosmetics-mix', name: 'Cosmetics (assorted colours)', category: 'solid', color: '#ffffff', roughness: 0.35, pattern: { id: 'cosmetic-swatches', scale: CELL.cosmetic * N, contrast: 1 } },
  { id: 'skincare-mix', name: 'Skincare bottles (assorted)', category: 'solid', color: '#ffffff', roughness: 0.3, pattern: { id: 'skincare-swatches', scale: CELL.skincare * N, contrast: 1 } },
  { id: 'polish-mix', name: 'Nail polish (assorted)', category: 'solid', color: '#ffffff', roughness: 0.1, pattern: { id: 'polish-swatches', scale: CELL.polish * N, contrast: 1 } },
  { id: 'eyeshadow-palette', name: 'Eyeshadow palette', category: 'solid', color: '#ffffff', roughness: 0.6, pattern: { id: 'eyeshadow-pans', scale: 0.12, contrast: 1 } },
  { id: 'champagne-gold', name: 'Champagne gold', category: 'metal', color: '#d6b680', roughness: 0.22, metalness: 1 },
  { id: 'rose-gold', name: 'Rose gold', category: 'metal', color: '#e0a993', roughness: 0.22, metalness: 1 },
  { id: 'gloss-black', name: 'Gloss black', category: 'solid', color: '#141414', roughness: 0.15 },
  { id: 'frosted-blush-glass', name: 'Frosted blush glass', category: 'glass', color: '#f2c9cf', roughness: 0.35, opacity: 0.75 },
  { id: 'amber-glass', name: 'Amber glass', category: 'glass', color: '#9b5a1d', roughness: 0.1, opacity: 0.85 },
  { id: 'perfume-glass', name: 'Perfume glass', category: 'glass', color: '#f6ead6', roughness: 0.05, opacity: 0.5 },
  { id: 'clear-acrylic', name: 'Clear acrylic', category: 'glass', color: '#f1f6f8', roughness: 0.05, opacity: 0.25 },
  { id: 'blush-lacquer', name: 'Blush lacquer', category: 'solid', color: '#efc9c9', roughness: 0.25 },
  { id: 'leather-blush', name: 'Blush leather', category: 'leather', color: '#d9a3a0', roughness: 0.5 },
  { id: 'vanity-bulb', name: 'Vanity bulb glow', category: 'solid', color: '#fff6e6', roughness: 0.3, emissive: '#ffe9c8', emissiveIntensity: 2.6 },
];

/** Parts that are products on a vanity, whatever their slot: see `filledVanity`. */
const FILL = new WeakSet<Part>();
function F(parts: Part[]): Part[] {
  for (const p of parts) FILL.add(p);
  return parts;
}

/** A vanity whose products (parts marked with `F` or in the `products` slot) are its default "Filled" model. */
function filledVanity(item: PackItem): PackItem {
  const isFill = (p: Part) => FILL.has(p) || p.slot === 'products';
  const raw = item.build;
  return {
    ...item,
    slots: item.slots.filter((sl) => sl.id !== 'products'),
    build: (size) => finish(raw(size).filter((p) => !isFill(p)), size, SW),
    models: [
      { id: 'filled', name: 'Filled', slots: item.slots.filter((sl) => sl.id === 'products'), props: (size) => finish(raw(size).filter(isFill), size, SW) },
      { id: 'empty', name: 'Empty' },
    ],
  };
}

/** Swatch slots used by most items here. */
const SW = { products: CELL.cosmetic, makeup: CELL.cosmetic, bottles: CELL.skincare, polish: CELL.polish };

// ───────────────────────── Product shapes ─────────────────────────

/** A pump bottle (lotion, cleanser): body, collar, stem and pump head with nozzle. */
const pump = (body: string, cap: string, x: number, y: number, z: number, r: number, h: number): Part[] => [
  cyl(body, [x, y + h / 2, z], r, h, { segments: 18, plan: false }),
  cyl(cap, [x, y + h + 0.006, z], r * 0.45, 0.012, { segments: 14, plan: false }),
  vcyl(cap, x, z, y + h + 0.012, y + h + 0.035, r * 0.14, o),
  span(cap, [x - r * 0.35, x + r * 0.35], [y + h + 0.035, y + h + 0.05], [z - r * 0.3, z + r * 1.1], o),
];

/** A serum bottle with a dropper. */
const dropper = (glass: string, cap: string, x: number, y: number, z: number, r = 0.016, h = 0.07): Part[] => [
  cyl(glass, [x, y + h / 2, z], r, h, { segments: 16, plan: false }),
  cyl(cap, [x, y + h + 0.01, z], r * 0.6, 0.02, { segments: 12, plan: false }),
  sphere(cap, [x, y + h + 0.028, z], r * 0.5, { scale: [1, 1.5, 1], plan: false }),
];

/** A cream jar with its lid. */
const jar = (body: string, lid: string, x: number, y: number, z: number, r = 0.03, h = 0.035): Part[] => [
  cyl(body, [x, y + h * 0.4, z], r, h * 0.8, { segments: 20, plan: false }),
  cyl(lid, [x, y + h * 0.9, z], r * 1.02, h * 0.25, { segments: 20, plan: false }),
];

/** A squeeze tube standing on its cap. */
const tube = (body: string, cap: string, x: number, y: number, z: number, h = 0.15): Part[] => [
  cyl(cap, [x, y + 0.012, z], 0.016, 0.024, { segments: 14, plan: false }),
  cyl(body, [x, y + 0.024 + (h - 0.024) / 2, z], 0.024, h - 0.024, { rTop: 0.026, segments: 16, scale: [1, 1, 0.55], plan: false }),
];

/** A lipstick: metal case and coloured bullet. */
const lipstick = (casing: string, color: string, x: number, y: number, z: number): Part[] => [
  cyl(casing, [x, y + 0.025, z], 0.01, 0.05, { segments: 14, plan: false }),
  cyl(color, [x, y + 0.062, z], 0.0075, 0.024, { rTop: 0.004, segments: 12, plan: false }),
];

/** An eyeshadow palette, open flat or closed. */
const palette = (casing: string, pans: string, x: number, y: number, z: number, w = 0.15, d = 0.1, rot = 0): Part[] => [
  span(casing, [x - w / 2, x + w / 2], [y, y + 0.012], [z - d / 2, z + d / 2], { bevel: 0.003, rotation: [0, rot, 0], plan: false }),
  { ...span(pans, [-w / 2 + 0.008, w / 2 - 0.008], [0, 0.002], [-d / 2 + 0.008, d / 2 - 0.008], o), position: [x, y + 0.013, z], rotation: [0, rot, 0] } as Part,
];

/** A cup of makeup brushes fanning out. */
const brushCup = (cup: string, handle: string, tip: string, x: number, y: number, z: number, n = 5): Part[] => {
  const parts: Part[] = [cyl(cup, [x, y + 0.055, z], 0.035, 0.11, { segments: 18, plan: false })];
  for (const i of range(n)) {
    const a = (i / n) * Math.PI * 2 + 0.4;
    const top: V3 = [x + Math.cos(a) * 0.035, y + 0.17 + (i % 2) * 0.03, z + Math.sin(a) * 0.03];
    parts.push(rod(handle, [x + Math.cos(a) * 0.008, y + 0.03, z + Math.sin(a) * 0.008], top, 0.004, { segments: 8, plan: false }));
    parts.push(sphere(tip, [top[0] + Math.cos(a) * 0.006, top[1] + 0.012, top[2] + Math.sin(a) * 0.005], 0.009, { scale: [1, 1.8, 1], plan: false }));
  }
  return parts;
};

/** Perfume bottles of a few shapes. */
const perfume = (glass: string, cap: string, x: number, y: number, z: number, kind: number): Part[] => {
  if (kind === 0)
    return [span(glass, [x - 0.03, x + 0.03], [y, y + 0.08], [z - 0.018, z + 0.018], { bevel: 0.005, plan: false }), cyl(cap, [x, y + 0.095, z], 0.014, 0.03, { segments: 14, plan: false })];
  if (kind === 1)
    return [
      lathe(glass, [x, y, z], [[0, 0], [0.028, 0], [0.034, 0.03], [0.026, 0.06], [0.01, 0.07], [0, 0.07]], { segments: 18, plan: false }),
      sphere(cap, [x, y + 0.085, z], 0.018, o),
    ];
  if (kind === 2) return [cyl(glass, [x, y + 0.05, z], 0.02, 0.1, { segments: 16, plan: false }), cyl(cap, [x, y + 0.115, z], 0.021, 0.03, { segments: 16, plan: false })];
  return [span(glass, [x - 0.025, x + 0.025], [y, y + 0.06], [z - 0.025, z + 0.025], { bevel: 0.01, rotation: [0, 0.6, 0], plan: false }), span(cap, [x - 0.012, x + 0.012], [y + 0.06, y + 0.09], [z - 0.012, z + 0.012], { rotation: [0, 0.6, 0], plan: false })];
};

/** An assortment of makeup and skincare on a surface from x0 to x1 at height y (front at zf). */
function vanityTop(slots: { products: string; casing: string; glass: string }, x0: number, x1: number, y: number, zB: number, zF: number): Part[] {
  const w = x1 - x0;
  const zm = (zB + zF) / 2;
  const at = (t: number) => x0 + w * t;
  return [
    ...palette(slots.casing, slots.products, at(0.12), y, zF - 0.07, 0.14, 0.09, 0.2),
    ...lipstick(slots.casing, slots.products, at(0.26), y, zF - 0.05),
    ...lipstick(slots.casing, slots.products, at(0.29), y, zF - 0.08),
    ...lipstick(slots.casing, slots.products, at(0.32), y, zF - 0.045),
    ...brushCup(slots.products, slots.casing, slots.products, at(0.82), y, zm - 0.02),
    ...pump(slots.products, slots.casing, at(0.62), y, zB + 0.07, 0.028, 0.13),
    ...dropper(slots.glass, slots.casing, at(0.55), y, zB + 0.08),
    ...jar(slots.products, slots.casing, at(0.68), y, zm + 0.04),
    ...perfume(slots.glass, slots.casing, at(0.4), y, zB + 0.08, 1),
    ...perfume(slots.glass, slots.casing, at(0.46), y, zB + 0.07, 0),
    cyl(slots.products, [at(0.5), y + 0.006, zF - 0.06], 0.035, 0.012, { segments: 20, plan: false }),
  ];
}

// ───────────────────────── Vanities ─────────────────────────

const hollywoodVanity = filledVanity(defineItem({
  id: 'hollywood-vanity-set-up',
  name: 'Hollywood vanity',
  category: 'bedroom',
  type: 'surfaces',
  group: 'Vanity & dressing tables',
  tags: ['vanity', 'makeup table', 'dressing table', 'hollywood mirror', 'bulbs', 'makeup', 'bàn trang điểm'],
  description: 'A white makeup desk with a tall Hollywood mirror ringed by warm bulbs, set up with palettes, lipsticks, a cup of brushes, serums, a pump lotion and perfumes.',
  defaultSize: { w: 1.1, d: 0.45, h: 1.55 },
  minSize: { w: 0.8, d: 0.38, h: 1.3 },
  maxSize: { w: 1.6, d: 0.55, h: 1.9 },
  wallSnap: true,
  slots: [matSlot('desk', 'Desk & frame', 'laminate-white-gloss'), matSlot('mirror', 'Mirror & perfume glass', 'glass-mirror'), matSlot('light', 'Bulbs', 'vanity-bulb'), matSlot('products', 'Makeup & products', 'cosmetics-mix')],
  light: {
    color: '#ffe7c4',
    intensity: 0.4,
    distance: 2.5,
    y: 1.2,
    heads: [
      { x: -0.4, y: 1.15, z: -0.17 },
      { x: 0.4, y: 1.15, z: -0.17 },
      { x: 0, y: 1.5, z: -0.17 },
    ],
  },
  build: (size) => {
    const { w, d, h } = size;
    const top = 0.74;
    const z0 = -d / 2;
    const parts: Part[] = [span('desk', [-w / 2, w / 2], [top, top + 0.03], [z0, d / 2], { bevel: 0.006, plan: true })];
    for (const x of [-w / 2 + 0.04, w / 2 - 0.04]) for (const z of [z0 + 0.04, d / 2 - 0.04]) parts.push(cyl('desk', [x, top / 2, z], 0.02, top, { rTop: 0.024, segments: 14, plan: false }));
    parts.push(span('desk', [-w / 2 + 0.03, w / 2 - 0.03], [top - 0.13, top], [z0 + 0.02, d / 2 - 0.025], o));
    for (const s of [-1, 1]) parts.push(span('desk', [s < 0 ? -w / 2 + 0.035 : 0.003, s < 0 ? -0.003 : w / 2 - 0.035], [top - 0.125, top - 0.005], [d / 2 - 0.025, d / 2 - 0.012], { bevel: 0.003, plan: false }), sphere('mirror', [s * w * 0.25, top - 0.065, d / 2 - 0.004], 0.009, o));
    // Mirror with bulbs.
    const mw = Math.min(w * 0.8, 0.95);
    const y0 = top + 0.03;
    parts.push(span('desk', [-mw / 2, mw / 2], [y0, h], [z0, z0 + 0.035], o), span('mirror', [-mw / 2 + 0.07, mw / 2 - 0.07], [y0 + 0.05, h - 0.07], [z0 + 0.035, z0 + 0.039], o));
    const zb = z0 + 0.05;
    for (const y of cells(4, y0 + 0.08, h - 0.12)) for (const s of [-1, 1]) parts.push(sphere('light', [s * (mw / 2 - 0.035), y, zb], 0.022, o));
    for (const x of cells(4, -mw / 2 + 0.12, mw / 2 - 0.12)) parts.push(sphere('light', [x, h - 0.035, zb], 0.022, o));
    parts.push(...F(vanityTop({ products: 'products', casing: 'desk', glass: 'mirror' }, -w / 2 + 0.05, w / 2 - 0.05, top + 0.03, z0 + 0.05, d / 2 - 0.02)));
    return parts;
  },
}));

const roundMirrorVanity = filledVanity(defineItem({
  id: 'oak-vanity-round-mirror',
  name: 'Oak vanity with round mirror',
  category: 'bedroom',
  type: 'surfaces',
  group: 'Vanity & dressing tables',
  tags: ['vanity', 'dressing table', 'round mirror', 'makeup', 'skincare', 'bàn trang điểm'],
  description: 'A slim oak dressing table on gold legs with a big round mirror and two drawers, set up with skincare, makeup, perfume and a brush cup.',
  defaultSize: { w: 1.0, d: 0.42, h: 1.5 },
  minSize: { w: 0.7, d: 0.35, h: 1.2 },
  maxSize: { w: 1.4, d: 0.5, h: 1.8 },
  wallSnap: true,
  slots: [matSlot('wood', 'Table', 'wood-oak-light'), matSlot('metal', 'Legs, handles & caps', 'champagne-gold'), matSlot('mirror', 'Mirror & glass', 'glass-mirror'), matSlot('products', 'Makeup & products', 'cosmetics-mix')],
  build: (size) => {
    const { w, d, h } = size;
    const top = 0.76;
    const z0 = -d / 2;
    const parts: Part[] = [span('wood', [-w / 2, w / 2], [top - 0.15, top], [z0, d / 2 - 0.02], { bevel: 0.006, plan: true })];
    for (const x of [-w / 2 + 0.05, w / 2 - 0.05]) for (const z of [z0 + 0.05, d / 2 - 0.07]) parts.push(cyl('metal', [x, (top - 0.15) / 2, z], 0.008, top - 0.15, { rTop: 0.012, segments: 10, plan: false }));
    for (const s of [-1, 1]) parts.push(span('wood', [s < 0 ? -w / 2 + 0.01 : 0.004, s < 0 ? -0.004 : w / 2 - 0.01], [top - 0.14, top - 0.01], [d / 2 - 0.02, d / 2 - 0.008], { bevel: 0.003, plan: false }), rodX('metal', s * w * 0.25 - 0.04, s * w * 0.25 + 0.04, top - 0.075, d / 2 - 0.002, 0.004, o));
    const r = Math.min(w * 0.36, (h - top) / 2 - 0.01);
    const cy = top + r + 0.01;
    parts.push({ ...cyl('mirror', [0, 0, 0], r, 0.01, { segments: 40, plan: false }), position: [0, cy, z0 + 0.03], rotation: [Math.PI / 2, 0, 0] } as Part, { ...torus('metal', [0, 0, 0], r, 0.012, o), position: [0, cy, z0 + 0.03] } as Part);
    parts.push(...F(vanityTop({ products: 'products', casing: 'metal', glass: 'mirror' }, -w / 2 + 0.04, w / 2 - 0.04, top, z0 + 0.06, d / 2 - 0.04)));
    return parts;
  },
}));

const glassTopDesk = filledVanity(defineItem({
  id: 'glass-top-makeup-desk',
  name: 'Glass-top makeup desk with tri-fold mirror',
  category: 'bedroom',
  type: 'surfaces',
  group: 'Vanity & dressing tables',
  tags: ['makeup desk', 'glass top', 'vanity', 'tri-fold mirror', 'cosmetics display', 'bàn trang điểm'],
  description: 'A white makeup desk whose glass top shows trays of lipsticks, palettes and brushes underneath, with a three-panel folding mirror and drawers on the right.',
  defaultSize: { w: 1.2, d: 0.5, h: 1.35 },
  minSize: { w: 0.9, d: 0.42, h: 1.2 },
  maxSize: { w: 1.6, d: 0.6, h: 1.6 },
  wallSnap: true,
  slots: [matSlot('desk', 'Desk', 'laminate-white-gloss'), matSlot('glass', 'Glass top', 'clear-acrylic'), matSlot('mirror', 'Mirrors', 'glass-mirror'), matSlot('products', 'Makeup', 'cosmetics-mix')],
  build: (size) => {
    const { w, d, h } = size;
    const top = 0.76;
    const z0 = -d / 2;
    const ped = Math.min(0.4, w * 0.33);
    const parts: Part[] = [
      span('desk', [w / 2 - ped, w / 2], [0, top - 0.01], [z0, d / 2 - 0.02], { plan: true }),
      span('desk', [-w / 2, -w / 2 + 0.03], [0, top - 0.01], [z0, d / 2 - 0.02], o),
      span('desk', [-w / 2 + 0.03, w / 2 - ped], [top - 0.07, top - 0.06], [z0 + 0.02, d / 2 - 0.04], o),
      span('desk', [-w / 2 + 0.03, w / 2 - ped], [top - 0.06, top - 0.01], [d / 2 - 0.045, d / 2 - 0.02], o),
      span('glass', [-w / 2, w / 2], [top - 0.01, top], [z0, d / 2]),
    ];
    for (const i of range(3)) parts.push(span('desk', [w / 2 - ped + 0.008, w / 2 - 0.008], [0.02 + i * 0.24, 0.25 + i * 0.24], [d / 2 - 0.02, d / 2 - 0.006], { bevel: 0.004, plan: false }), rodX('mirror', w / 2 - ped / 2 - 0.05, w / 2 - ped / 2 + 0.05, 0.2 + i * 0.24, d / 2, 0.005, o));
    // Compartments under the glass: lipsticks lying, palettes, brushes.
    const y = top - 0.06;
    for (const x of cells(8, -w / 2 + 0.06, -w / 2 + 0.3)) parts.push({ ...cyl('products', [0, 0, 0], 0.01, 0.07, { segments: 10, plan: false }), position: [x, y + 0.012, 0.05], rotation: [Math.PI / 2, 0, 0] } as Part);
    parts.push(...F([...palette('desk', 'products', -w / 2 + 0.42, y, 0.05, 0.14, 0.1), ...palette('desk', 'products', -w / 2 + 0.42, y, -0.1, 0.14, 0.1)]));
    for (const x of cells(5, w / 2 - ped - 0.3, w / 2 - ped - 0.05)) parts.push(...F([rodX('desk', x - 0.003, x + 0.003, y + 0.008, 0, 0.004, o)]), { ...cyl('products', [0, 0, 0], 0.005, 0.16, { segments: 8, plan: false }), position: [x, y + 0.008, 0], rotation: [Math.PI / 2, 0, 0] } as Part);
    // Tri-fold mirror.
    const mw = Math.min(0.36, w * 0.3);
    const mh = Math.min(0.55, h - top - 0.02);
    parts.push(span('mirror', [-mw / 2, mw / 2], [top, top + mh], [z0 + 0.04, z0 + 0.05], o));
    for (const s of [-1, 1]) parts.push({ ...span('mirror', [-mw / 4, mw / 4], [0, mh * 0.85], [-0.005, 0.005], o), position: [s * (mw / 2 + mw / 4 - 0.02), top + mh * 0.425, z0 + 0.1], rotation: [0, -s * 0.6, 0] } as Part);
    parts.push(...F([...pump('products', 'desk', w / 2 - 0.12, top, z0 + 0.12, 0.026, 0.12), ...jar('products', 'desk', w / 2 - 0.22, top, z0 + 0.14), ...brushCup('products', 'desk', 'products', -w / 2 + 0.12, top, z0 + 0.12, 4)]));
    return parts;
  },
}));

const vanityStool = defineItem({
  id: 'velvet-vanity-stool',
  name: 'Velvet vanity stool',
  category: 'bedroom',
  type: 'seating',
  group: 'Stools & benches',
  tags: ['vanity stool', 'velvet', 'ottoman', 'makeup stool', 'ghế đôn'],
  description: 'A plump round velvet stool on slim gold legs, sized to tuck under a vanity.',
  defaultSize: { w: 0.4, d: 0.4, h: 0.47 },
  minSize: { w: 0.32, d: 0.32, h: 0.4 },
  maxSize: { w: 0.5, d: 0.5, h: 0.55 },
  slots: [matSlot('fabric', 'Upholstery', 'fabric-velvet-blush'), matSlot('metal', 'Legs', 'champagne-gold')],
  variants: [
    { id: 'green', name: 'Green velvet', materials: { fabric: 'fabric-velvet-green' } },
    { id: 'navy', name: 'Navy velvet', materials: { fabric: 'fabric-velvet-navy' } },
    { id: 'boucle', name: 'Cream bouclé', materials: { fabric: 'fabric-boucle' } },
  ],
  build: (size) => {
    const { w, d, h } = size;
    const r = Math.min(w, d) / 2;
    const parts: Part[] = [cyl('fabric', [0, h - 0.07, 0], r, 0.14, { segments: 32, scale: [w / (2 * r), 1, d / (2 * r)] }), torus('fabric', [0, h - 0.04, 0], r - 0.03, 0.03, o)];
    for (const i of range(4)) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      parts.push(rod('metal', [Math.cos(a) * r * 0.55, h - 0.14, Math.sin(a) * r * 0.55], [Math.cos(a) * r * 0.85, 0, Math.sin(a) * r * 0.85], 0.009, { segments: 8, plan: false }));
    }
    return finish(parts, size);
  },
});

const shellChair = defineItem({
  id: 'velvet-shell-vanity-chair',
  name: 'Velvet shell vanity chair',
  category: 'bedroom',
  type: 'seating',
  group: 'Desk chairs',
  tags: ['vanity chair', 'shell chair', 'scallop', 'velvet', 'ghế trang điểm'],
  description: 'A small velvet chair with a channel-tufted scallop back on gold legs, for a vanity or a desk.',
  defaultSize: { w: 0.52, d: 0.5, h: 0.8 },
  minSize: { w: 0.45, d: 0.44, h: 0.72 },
  maxSize: { w: 0.62, d: 0.58, h: 0.9 },
  slots: [matSlot('fabric', 'Upholstery', 'fabric-velvet-blush'), matSlot('metal', 'Legs', 'champagne-gold')],
  variants: [
    { id: 'green', name: 'Green velvet', materials: { fabric: 'fabric-velvet-green' } },
    { id: 'teal', name: 'Teal velvet', materials: { fabric: 'fabric-velvet-teal' } },
    { id: 'boucle', name: 'Cream bouclé', materials: { fabric: 'fabric-boucle' } },
  ],
  build: (size) => {
    const { w, d, h } = size;
    const seat = 0.46;
    const parts: Part[] = [cyl('fabric', [0, seat - 0.05, 0.02], w / 2 - 0.02, 0.1, { segments: 32, scale: [1, 1, (d - 0.06) / (w - 0.04)] })];
    const n = 6;
    for (const i of range(n)) {
      const a = Math.PI * (0.12 + (0.76 * (i + 0.5)) / n);
      const x = -Math.cos(a) * (w / 2 - 0.05);
      const z = -Math.sin(a) * (d / 2 - 0.05) + 0.02;
      const hh = (h - seat) * (0.75 + 0.25 * Math.sin(a));
      parts.push({ ...cyl('fabric', [0, 0, 0], 0.045, hh + 0.08, { segments: 12, plan: false }), position: [x, seat + hh / 2 - 0.02, z], rotation: [0, 0, 0] } as Part, sphere('fabric', [x, seat + hh + 0.02, z], 0.045, o));
    }
    for (const [x, z] of [
      [-w / 2 + 0.07, d / 2 - 0.06],
      [w / 2 - 0.07, d / 2 - 0.06],
      [-w / 2 + 0.08, -d / 2 + 0.08],
      [w / 2 - 0.08, -d / 2 + 0.08],
    ])
      parts.push(cyl('metal', [x, (seat - 0.1) / 2, z], 0.01, seat - 0.1, { rTop: 0.014, segments: 10, plan: true }));
    return finish(parts, size);
  },
});

// ───────────────────────── Makeup & skincare sets ─────────────────────────

const makeupSet = defineItem({
  id: 'makeup-collection',
  name: 'Makeup collection',
  category: 'bedroom',
  type: 'decor',
  group: 'Beauty & makeup',
  tags: ['makeup', 'cosmetics', 'lipstick', 'eyeshadow palette', 'brushes', 'mỹ phẩm', 'son'],
  description: 'Everyday makeup laid out on a tray: two palettes, a row of lipsticks, foundation, mascara, a compact, blush and a cup of brushes.',
  defaultSize: { w: 0.42, d: 0.26, h: 0.22 },
  minSize: { w: 0.3, d: 0.2, h: 0.18 },
  maxSize: { w: 0.7, d: 0.4, h: 0.3 },
  slots: [matSlot('products', 'Lipsticks & products', 'cosmetics-mix'), matSlot('casing', 'Cases & handles', 'gloss-black'), matSlot('pans', 'Palettes', 'eyeshadow-palette'), matSlot('tray', 'Tray & caps', 'champagne-gold')],
  build: (size) => {
    const { w, d } = size;
    const z0 = -d / 2;
    const y = 0.012;
    const parts: Part[] = [span('tray', [-w / 2, w / 2], [0, 0.006], [z0, d / 2], { bevel: 0.003, plan: true }), span('tray', [-w / 2, w / 2], [0.006, 0.014], [z0, z0 + 0.006], o), span('tray', [-w / 2, w / 2], [0.006, 0.014], [d / 2 - 0.006, d / 2], o)];
    parts.push(...palette('casing', 'pans', -w * 0.27, y, d * 0.12, w * 0.36, d * 0.42, 0.1), ...palette('casing', 'pans', -w * 0.25, y + 0.014, d * 0.1, w * 0.28, d * 0.32, -0.15));
    for (const [i, x] of cells(5, -w * 0.05, w * 0.28).entries()) parts.push(...lipstick(i % 2 ? 'tray' : 'casing', 'products', x, y, z0 + 0.04 + (i % 2) * 0.02));
    parts.push(...brushCup('products', 'casing', 'products', w * 0.38, y, z0 + d * 0.32, 5));
    parts.push(span('products', [w * 0.05, w * 0.12], [y, y + 0.11], [0.0, 0.03], { bevel: 0.006, plan: false }), cyl('casing', [w * 0.085, y + 0.125, 0.015], 0.012, 0.03, { segments: 12, plan: false }));
    parts.push({ ...cyl('casing', [0, 0, 0], 0.008, 0.13, { segments: 12, plan: false }), position: [w * 0.15, y + 0.009, d * 0.35], rotation: [0, 0, Math.PI / 2] } as Part);
    parts.push(cyl('tray', [w * 0.2, y + 0.008, d * 0.12], 0.035, 0.016, { segments: 24, plan: false }), cyl('products', [w * 0.32, y + 0.007, d * 0.25], 0.03, 0.014, { segments: 24, plan: false }));
    return finish(parts, size, SW);
  },
});

const skincareSet = defineItem({
  id: 'skincare-routine-set',
  name: 'Skincare routine set',
  category: 'bathroom',
  type: 'decor',
  group: 'Beauty & makeup',
  tags: ['skincare', 'lotion', 'serum', 'toner', 'moisturiser', 'cleanser', 'dưỡng da', 'kem dưỡng'],
  description: 'A full skincare routine on a marble tray: cleanser and toner pumps, serums with droppers, a moisturiser jar, sunscreen and eye-cream tubes, and a jar of cotton pads.',
  defaultSize: { w: 0.4, d: 0.22, h: 0.22 },
  minSize: { w: 0.28, d: 0.16, h: 0.16 },
  maxSize: { w: 0.7, d: 0.35, h: 0.3 },
  slots: [matSlot('bottles', 'Bottles & jars', 'skincare-mix'), matSlot('glass', 'Serum glass', 'amber-glass'), matSlot('caps', 'Caps & pumps', 'champagne-gold'), matSlot('tray', 'Tray & cotton', 'stone-marble-carrara')],
  variants: [
    { id: 'blush', name: 'Blush glass & rose gold', materials: { glass: 'frosted-blush-glass', caps: 'rose-gold' } },
    { id: 'minimal', name: 'Clear glass & white', materials: { glass: 'perfume-glass', caps: 'plastic-white', tray: 'wood-oak-light' } },
  ],
  build: (size) => {
    const { w, d, h } = size;
    const z0 = -d / 2;
    const y = 0.012;
    const k = clamp(h / 0.22, 0.75, 1.3);
    const parts: Part[] = [span('tray', [-w / 2, w / 2], [0, y], [z0, d / 2], { bevel: 0.004, plan: true })];
    parts.push(...pump('bottles', 'caps', -w * 0.38, y, z0 + d * 0.32, 0.03, 0.15 * k), ...pump('bottles', 'caps', -w * 0.22, y, z0 + d * 0.3, 0.026, 0.12 * k));
    parts.push(...dropper('glass', 'caps', -w * 0.06, y, z0 + d * 0.3, 0.017, 0.075 * k), ...dropper('glass', 'caps', w * 0.04, y, z0 + d * 0.28, 0.014, 0.06 * k));
    parts.push(cyl('bottles', [w * 0.18, y + 0.07 * k, z0 + d * 0.3], 0.028, 0.14 * k, { segments: 18, plan: false }), cyl('caps', [w * 0.18, y + 0.14 * k + 0.015, z0 + d * 0.3], 0.018, 0.03, { segments: 14, plan: false }));
    parts.push(...tube('bottles', 'caps', w * 0.32, y, z0 + d * 0.28, 0.15 * k), ...tube('bottles', 'caps', w * 0.42, y, z0 + d * 0.3, 0.1 * k));
    parts.push(...jar('bottles', 'caps', -w * 0.3, y, d * 0.22, 0.034, 0.04), ...jar('bottles', 'caps', -w * 0.1, y, d * 0.24, 0.022, 0.03));
    parts.push(cyl('glass', [w * 0.12, y + 0.04, d * 0.22], 0.035, 0.08, { segments: 20, plan: false }), cyl('tray', [w * 0.12, y + 0.035, d * 0.22], 0.03, 0.065, { segments: 20, plan: false }), cyl('caps', [w * 0.12, y + 0.085, d * 0.22], 0.036, 0.01, { segments: 20, plan: false }));
    parts.push(...perfume('glass', 'caps', w * 0.33, y, d * 0.22, 2));
    return finish(parts, size, SW);
  },
});

const lotionTrio = defineItem({
  id: 'body-lotion-trio',
  name: 'Body lotion & wash trio',
  category: 'bathroom',
  type: 'decor',
  group: 'Beauty & makeup',
  tags: ['lotion', 'body wash', 'hand soap', 'pump bottles', 'amber', 'sữa tắm', 'dưỡng thể'],
  description: 'Three matching pump bottles — hand wash, body wash and body lotion — on a small tray, for a basin or a bath ledge.',
  defaultSize: { w: 0.3, d: 0.12, h: 0.25 },
  minSize: { w: 0.22, d: 0.1, h: 0.18 },
  maxSize: { w: 0.45, d: 0.16, h: 0.32 },
  slots: [matSlot('bottles', 'Bottles', 'amber-glass'), matSlot('pumps', 'Pumps', 'gloss-black'), matSlot('labels', 'Labels', 'paint-pure-white'), matSlot('tray', 'Tray', 'wood-oak-natural')],
  variants: [
    { id: 'white', name: 'White & gold', materials: { bottles: 'ceramic-white', pumps: 'champagne-gold', labels: 'gloss-black' } },
    { id: 'blush', name: 'Blush & rose gold', materials: { bottles: 'frosted-blush-glass', pumps: 'rose-gold' } },
    { id: 'sage', name: 'Sage & black', materials: { bottles: 'ceramic-sage', tray: 'stone-marble-carrara' } },
  ],
  build: (size) => {
    const { w, d, h } = size;
    const y = 0.015;
    const parts: Part[] = [span('tray', [-w / 2, w / 2], [0, y], [-d / 2, d / 2], { bevel: 0.006, plan: true })];
    const r = Math.min(d / 2 - 0.01, w / 7);
    cells(3, -w / 2, w / 2).forEach((x, i) => {
      const bh = (h - y - 0.06) * (i === 1 ? 1 : 0.85);
      parts.push(...pump('bottles', 'pumps', x, y, 0, r, bh));
      parts.push(cyl('labels', [x, y + bh * 0.5, 0], r + 0.0015, bh * 0.35, { segments: 18, plan: false }));
    });
    return finish(parts, size);
  },
});

const perfumeTray = defineItem({
  id: 'perfume-collection-tray',
  name: 'Perfume collection on a mirror tray',
  category: 'bedroom',
  type: 'decor',
  group: 'Beauty & makeup',
  tags: ['perfume', 'fragrance', 'mirror tray', 'dresser decor', 'nước hoa'],
  description: 'Six perfume bottles of different shapes on a round mirrored tray with a gold rim, for a dresser or vanity.',
  defaultSize: { w: 0.32, d: 0.32, h: 0.13 },
  minSize: { w: 0.24, d: 0.24, h: 0.1 },
  maxSize: { w: 0.45, d: 0.45, h: 0.16 },
  slots: [matSlot('glass', 'Bottles', 'perfume-glass'), matSlot('caps', 'Caps & rim', 'champagne-gold'), matSlot('tray', 'Tray', 'glass-mirror'), matSlot('juice', 'Perfume', 'frosted-blush-glass')],
  build: (size) => {
    const { w, d } = size;
    const r = Math.min(w, d) / 2;
    const y = 0.012;
    const parts: Part[] = [cyl('tray', [0, 0.005, 0], r - 0.006, 0.01, { segments: 40, plan: true }), torus('caps', [0, 0.01, 0], r - 0.006, 0.006, o)];
    const spots: [number, number, number][] = [
      [-0.45, -0.3, 0],
      [-0.05, -0.45, 1],
      [0.4, -0.25, 2],
      [-0.4, 0.3, 3],
      [0.05, 0.1, 0],
      [0.38, 0.35, 1],
    ];
    for (const [fx, fz, k] of spots) {
      const x = fx * r;
      const z = fz * r;
      const ps = perfume('glass', 'caps', x, y, z, k);
      parts.push(...ps);
      // Coloured juice inside the first bottle part.
      if (k === 0) parts.push(span('juice', [x - 0.025, x + 0.025], [y + 0.004, y + 0.055], [z - 0.013, z + 0.013], { bevel: 0.004, plan: false }));
      if (k === 2) parts.push(cyl('juice', [x, y + 0.035, z], 0.016, 0.06, { segments: 14, plan: false }));
    }
    return finish(parts, size);
  },
});

const acrylicOrganizer = defineItem({
  id: 'acrylic-makeup-organiser',
  name: 'Acrylic makeup organiser, full',
  category: 'bedroom',
  type: 'decor',
  group: 'Beauty & makeup',
  tags: ['makeup organiser', 'acrylic', 'lipstick holder', 'drawers', 'hộp đựng mỹ phẩm'],
  description: 'A clear acrylic organiser with a row of lipstick slots, tall compartments of brushes and bottles, and three drawers of palettes and compacts below.',
  defaultSize: { w: 0.3, d: 0.18, h: 0.32 },
  minSize: { w: 0.22, d: 0.14, h: 0.24 },
  maxSize: { w: 0.45, d: 0.25, h: 0.42 },
  slots: [matSlot('acrylic', 'Acrylic', 'clear-acrylic'), matSlot('products', 'Makeup', 'cosmetics-mix'), matSlot('casing', 'Cases', 'gloss-black'), matSlot('pans', 'Palettes', 'eyeshadow-palette')],
  build: (size) => {
    const { w, d, h } = size;
    const dh = h * 0.42;
    const parts: Part[] = [span('acrylic', [-w / 2, w / 2], [0, dh], [-d / 2, d / 2], { plan: true }), span('acrylic', [-w / 2, w / 2], [dh, h], [-d / 2, -d / 2 + 0.004], o)];
    for (const x of [-w / 2, w / 2 - 0.004]) parts.push(span('acrylic', [x, x + 0.004], [dh, h * 0.82], [-d / 2, d / 2], o));
    parts.push(span('acrylic', [-w / 2, w / 2], [dh, dh + 0.06], [d / 2 - 0.004, d / 2], o));
    // Drawers of palettes.
    for (const i of range(3)) {
      const y = 0.006 + (i * dh) / 3;
      parts.push(...palette('casing', 'pans', -w * 0.18, y, 0, w * 0.5, d * 0.7), cyl('casing', [w * 0.28, y + 0.008, 0], 0.03, 0.014, { segments: 20, plan: false }));
    }
    // Top: lipstick row at the front, brushes and bottles at the back.
    for (const x of cells(clamp(Math.round(w / 0.03), 5, 12), -w / 2 + 0.02, w / 2 - 0.02)) parts.push(...lipstick('casing', 'products', x, dh, d / 2 - 0.03));
    parts.push(...brushCup('acrylic', 'casing', 'products', -w * 0.28, dh, -d * 0.15, 5));
    parts.push(...pump('products', 'casing', w * 0.05, dh, -d * 0.18, 0.02, h * 0.3), cyl('products', [w * 0.22, dh + 0.05, -d * 0.18], 0.018, 0.1, { segments: 14, plan: false }), cyl('casing', [w * 0.22, dh + 0.11, -d * 0.18], 0.012, 0.025, { segments: 12, plan: false }), ...dropper('products', 'casing', w * 0.36, dh, -d * 0.15, 0.014, 0.06));
    return finish(parts, size, SW);
  },
});

const lightedMirror = defineItem({
  id: 'lighted-makeup-mirror',
  name: 'Lighted makeup mirror',
  category: 'bedroom',
  type: 'decor',
  group: 'Beauty & makeup',
  tags: ['makeup mirror', 'LED mirror', 'lighted mirror', 'tabletop mirror', 'gương trang điểm'],
  description: 'A round tabletop mirror with an LED ring on a tilting stand, with a small magnifying mirror clipped to the side.',
  defaultSize: { w: 0.3, d: 0.15, h: 0.42 },
  minSize: { w: 0.22, d: 0.12, h: 0.32 },
  maxSize: { w: 0.4, d: 0.2, h: 0.52 },
  slots: [matSlot('body', 'Stand & frame', 'paint-pure-white'), matSlot('mirror', 'Mirror', 'glass-mirror'), matSlot('light', 'LED ring', 'vanity-bulb')],
  light: { color: '#fff1dc', intensity: 0.25, distance: 1.5, y: 0.25, z: 0.03 },
  build: (size) => {
    const { w, d, h } = size;
    const r = Math.min(w / 2 - 0.01, (h - 0.1) / 2);
    const cy = h - r - 0.005;
    const tilt = -0.12;
    const disc = (slot: string, rr: number, t: number, dz: number): Part => ({ ...cyl(slot, [0, 0, 0], rr, t, { segments: 40, plan: false }), position: [0, cy, dz], rotation: [Math.PI / 2 + tilt, 0, 0] }) as Part;
    const parts: Part[] = [
      cyl('body', [0, 0.012, 0], Math.min(d / 2, 0.075), 0.024, { segments: 28, plan: true }),
      vcyl('body', 0, 0, 0.024, cy - r + 0.02, 0.012, o),
      disc('body', r, 0.02, -0.005),
      disc('light', r - 0.006, 0.006, 0.006),
      disc('mirror', r - 0.025, 0.004, 0.01),
      { ...cyl('body', [0, 0, 0], r * 0.32, 0.01, { segments: 24, plan: false }), position: [r * 0.62, cy - r * 0.55, 0.02], rotation: [Math.PI / 2 + tilt, 0, 0] } as Part,
      { ...cyl('mirror', [0, 0, 0], r * 0.28, 0.004, { segments: 24, plan: false }), position: [r * 0.62, cy - r * 0.55, 0.026], rotation: [Math.PI / 2 + tilt, 0, 0] } as Part,
    ];
    return finish(parts, size);
  },
});

const hairTools = defineItem({
  id: 'hair-styling-tools',
  name: 'Hair styling tools',
  category: 'bedroom',
  type: 'decor',
  group: 'Beauty & makeup',
  tags: ['hair dryer', 'straightener', 'curling iron', 'hairbrush', 'máy sấy tóc'],
  description: 'A hair dryer, a flat iron, a curling wand and a round brush laid out on a heat mat, with a comb and a few scrunchies.',
  defaultSize: { w: 0.5, d: 0.32, h: 0.1 },
  minSize: { w: 0.4, d: 0.25, h: 0.08 },
  maxSize: { w: 0.7, d: 0.45, h: 0.14 },
  slots: [matSlot('tools', 'Tools', 'blush-lacquer'), matSlot('dark', 'Plates, cords & bristles', 'gloss-black'), matSlot('mat', 'Heat mat & comb', 'fabric-boucle-oat'), matSlot('scrunchies', 'Scrunchies', 'cosmetics-mix')],
  variants: [
    { id: 'black', name: 'Black & gold', materials: { tools: 'gloss-black', dark: 'champagne-gold' } },
    { id: 'white', name: 'White', materials: { tools: 'plastic-white' } },
  ],
  build: (size) => {
    const { w, d } = size;
    const y = 0.006;
    const parts: Part[] = [span('mat', [-w / 2, w * 0.05], [0, y], [-d / 2, d / 2], { bevel: 0.002, plan: true })];
    // Hair dryer lying on its side: barrel, nozzle, handle.
    parts.push({ ...cyl('tools', [0, 0, 0], 0.04, 0.15, { segments: 20, plan: false }), position: [-w * 0.22, y + 0.04, -d * 0.18], rotation: [0, 0, Math.PI / 2] } as Part);
    parts.push({ ...cyl('dark', [0, 0, 0], 0.03, 0.04, { rTop: 0.022, segments: 16, plan: false }), position: [-w * 0.22 + 0.095, y + 0.04, -d * 0.18], rotation: [0, 0, -Math.PI / 2] } as Part);
    parts.push(span('tools', [-w * 0.22 - 0.03, -w * 0.22 + 0.0], [y, y + 0.03], [-d * 0.18 + 0.02, -d * 0.18 + 0.13], { bevel: 0.012, plan: false }));
    // Flat iron.
    for (const dz of [-0.012, 0.012]) parts.push(span('tools', [-w * 0.42, -w * 0.08], [y, y + 0.018], [d * 0.22 + dz - 0.011, d * 0.22 + dz + 0.011], { bevel: 0.006, plan: false }));
    parts.push(span('dark', [-w * 0.2, -w * 0.08], [y + 0.004, y + 0.016], [d * 0.22 - 0.002, d * 0.22 + 0.002], o));
    // Curling wand and round brush on the bare surface.
    parts.push(rodX('tools', w * 0.1, w * 0.28, y + 0.015, -d * 0.2, 0.015, o), rodX('dark', w * 0.28, w * 0.45, y + 0.012, -d * 0.2, 0.012, o));
    parts.push(rodX('tools', w * 0.1, w * 0.26, y + 0.012, d * 0.05, 0.011, o), rodX('dark', w * 0.26, w * 0.44, y + 0.022, d * 0.05, 0.022, o));
    parts.push(span('mat', [w * 0.12, w * 0.4], [0, 0.006], [d * 0.26, d * 0.3], o));
    for (const [i, x] of [w * 0.18, w * 0.27, w * 0.36].entries()) parts.push(torus('scrunchies', [x, y + 0.008, d * 0.4 - i * 0.01], 0.022, 0.011, { rotation: [Math.PI / 2, 0, 0], plan: false }));
    return finish(parts, size, { scrunchies: CELL.cosmetic });
  },
});

const jewelleryStand = defineItem({
  id: 'jewellery-stand-set',
  name: 'Jewellery stand & ring dish',
  category: 'bedroom',
  type: 'decor',
  group: 'Beauty & makeup',
  tags: ['jewellery', 'jewelry', 'necklace stand', 'ring dish', 'earrings', 'trang sức'],
  description: 'A gold T-bar stand hung with necklaces, a velvet ring cone, a ceramic dish of earrings and a small jewellery box with its lid open.',
  defaultSize: { w: 0.36, d: 0.18, h: 0.34 },
  minSize: { w: 0.26, d: 0.14, h: 0.26 },
  maxSize: { w: 0.5, d: 0.24, h: 0.45 },
  slots: [matSlot('metal', 'Stand & jewellery', 'champagne-gold'), matSlot('velvet', 'Velvet', 'fabric-velvet-blush'), matSlot('dish', 'Dish & box', 'ceramic-white'), matSlot('pearls', 'Pearls & beads', 'paint-pure-white')],
  build: (size) => {
    const { w, d, h } = size;
    const sx = -w * 0.18;
    const parts: Part[] = [cyl('metal', [sx, 0.005, 0], 0.05, 0.01, { segments: 24, plan: true }), vcyl('metal', sx, 0, 0.01, h - 0.01, 0.005, o), rodX('metal', sx - w * 0.28, sx + w * 0.28, h - 0.01, 0, 0.005, o)];
    // Necklaces: thin hanging loops, a pearl strand.
    for (const [i, dx] of [-0.1, -0.03, 0.05, 0.11].entries()) {
      const L = 0.08 + i * 0.03;
      parts.push({ ...torus(i === 2 ? 'pearls' : 'metal', [0, 0, 0], 0.02, i === 2 ? 0.004 : 0.0012, o), position: [sx + dx * w * 2.4, h - 0.01 - L / 2, 0.004], scale: [1, L / 0.04, 1] } as Part);
      if (i !== 2) parts.push(sphere(i === 0 ? 'velvet' : 'metal', [sx + dx * w * 2.4, h - 0.01 - L, 0.006], 0.007, o));
    }
    // Ring cone.
    parts.push(cyl('velvet', [w * 0.12, 0.05, -d * 0.18], 0.006, 0.1, { rTop: 0.004, segments: 16, plan: false }), cyl('velvet', [w * 0.12, 0.05, -d * 0.18], 0.025, 0.1, { rTop: 0.006, segments: 16, plan: false }));
    for (const [k, y] of [0.035, 0.055, 0.07].entries()) parts.push(torus(k === 1 ? 'pearls' : 'metal', [w * 0.12, y, -d * 0.18], 0.02 - k * 0.004, 0.002, { rotation: [Math.PI / 2, 0, 0], plan: false }));
    // Dish with earrings.
    parts.push(cyl('dish', [w * 0.3, 0.01, d * 0.15], 0.05, 0.02, { rTop: 0.06, segments: 24, plan: false }), sphere('pearls', [w * 0.28, 0.022, d * 0.15], 0.006, o), sphere('pearls', [w * 0.31, 0.022, d * 0.17], 0.006, o), torus('metal', [w * 0.33, 0.022, d * 0.12], 0.01, 0.0015, { rotation: [Math.PI / 2, 0, 0], plan: false }));
    // Small jewellery box, lid open.
    parts.push(span('dish', [w * 0.0, w * 0.2], [0, 0.045], [d * 0.05, d / 2 - 0.01], { bevel: 0.004, plan: false }), span('velvet', [w * 0.01, w * 0.19], [0.04, 0.046], [d * 0.06, d / 2 - 0.02], o));
    parts.push({ ...span('dish', [-w * 0.1, w * 0.1], [-0.003, 0.003], [-0.04, 0.04], o), position: [w * 0.1, 0.085, d * 0.05 - 0.004], rotation: [Math.PI / 2 - 0.25, 0, 0] } as Part);
    return finish(parts, size);
  },
});

const cosmeticBag = defineItem({
  id: 'cosmetic-bag-brush-roll',
  name: 'Cosmetic bag & brush roll',
  category: 'bedroom',
  type: 'decor',
  group: 'Beauty & makeup',
  tags: ['makeup bag', 'cosmetic pouch', 'brush roll', 'travel', 'túi mỹ phẩm'],
  description: 'A quilted makeup pouch spilling a lipstick, mascara and a compact, beside an unrolled brush roll of eight brushes.',
  defaultSize: { w: 0.42, d: 0.28, h: 0.12 },
  minSize: { w: 0.32, d: 0.22, h: 0.09 },
  maxSize: { w: 0.6, d: 0.38, h: 0.16 },
  slots: [matSlot('bag', 'Pouch & roll', 'leather-blush'), matSlot('casing', 'Handles & cases', 'gloss-black'), matSlot('metal', 'Zip & ferrules', 'champagne-gold'), matSlot('products', 'Makeup & brush tips', 'cosmetics-mix')],
  build: (size) => {
    const { w, d, h } = size;
    const parts: Part[] = [];
    // Pouch.
    const px = -w * 0.25;
    parts.push(span('bag', [px - w * 0.22, px + w * 0.22], [0, h * 0.9], [-d / 2 + 0.01, -d * 0.02], { bevel: Math.min(0.04, h * 0.4), plan: true }), rodX('metal', px - w * 0.18, px + w * 0.18, h * 0.88, -d * 0.24, 0.004, o), span('metal', [px + w * 0.16, px + w * 0.2], [h * 0.8, h * 0.88], [-d * 0.24 + 0.004, -d * 0.24 + 0.01], o));
    parts.push(...lipstick('metal', 'products', px - w * 0.1, 0, d * 0.1).map((p) => ({ ...p, position: [p.position[0] + (p.position[1] - 0.03), 0.011, p.position[2]] as V3, rotation: [0, 0, Math.PI / 2] as V3 })));
    parts.push({ ...cyl('casing', [0, 0, 0], 0.008, 0.12, { segments: 12, plan: false }), position: [px + w * 0.05, 0.009, d * 0.2], rotation: [0, 0.4, Math.PI / 2] } as Part, cyl('casing', [px + w * 0.15, 0.008, d * 0.06], 0.035, 0.016, { segments: 24, plan: false }));
    // Brush roll: flat panel with brushes in pockets.
    const rx0 = w * 0.02;
    const rx1 = w / 2 - 0.01;
    parts.push(span('bag', [rx0, rx1], [0, 0.006], [-d / 2 + 0.01, d / 2 - 0.01], { plan: true }), span('bag', [rx0, rx1], [0.006, 0.014], [-d / 2 + 0.01, -d * 0.1], o));
    for (const [i, x] of cells(8, rx0 + 0.02, rx1 - 0.02).entries()) {
      const L = d * (0.62 + (i % 3) * 0.08);
      const z0 = -d / 2 + 0.03;
      parts.push(rod('casing', [x, 0.012, z0], [x, 0.012, z0 + L * 0.7], 0.004, { segments: 8, plan: false }), rod('metal', [x, 0.012, z0 + L * 0.7], [x, 0.012, z0 + L * 0.82], 0.005, { segments: 8, plan: false }), sphere('products', [x, 0.012, z0 + L * 0.9], 0.008, { scale: [1, 0.8, 1.8], plan: false }));
    }
    return finish(parts, size, SW);
  },
});

// ───────────────────────── Racks, shelves & trolley ─────────────────────────

const polishRack = defineItem({
  id: 'nail-polish-wall-rack',
  name: 'Nail polish wall rack, full',
  category: 'bedroom',
  type: 'decor',
  group: 'Beauty & makeup',
  tags: ['nail polish', 'nail rack', 'wall rack', 'manicure', 'sơn móng tay'],
  description: 'A slim wall rack with four rows of nail polish bottles in every colour.',
  defaultSize: { w: 0.5, d: 0.08, h: 0.45 },
  minSize: { w: 0.3, d: 0.06, h: 0.3 },
  maxSize: { w: 0.9, d: 0.1, h: 0.7 },
  mount: 'wall',
  defaultElevation: 1.2,
  slots: [matSlot('rack', 'Rack', 'clear-acrylic'), matSlot('polish', 'Polish', 'polish-mix'), matSlot('caps', 'Caps', 'gloss-black')],
  build: (size) => {
    const { w, d, h } = size;
    const z0 = -d / 2;
    const rows = clamp(Math.round(h / 0.11), 2, 6);
    const parts: Part[] = [span('rack', [-w / 2, w / 2], [0, h], [z0, z0 + 0.006], { plan: true })];
    for (const x of [-w / 2, w / 2 - 0.006]) parts.push(span('rack', [x, x + 0.006], [0, h], [z0, d / 2], o));
    const per = clamp(Math.floor((w - 0.02) / 0.034), 4, 24);
    for (const j of range(rows)) {
      const y = 0.005 + (j * h) / rows;
      parts.push(span('rack', [-w / 2, w / 2], [y - 0.005, y], [z0, d / 2], o), span('rack', [-w / 2, w / 2], [y, y + 0.02], [d / 2 - 0.004, d / 2], o));
      for (const x of cells(per, -w / 2 + 0.01, w / 2 - 0.01)) parts.push(cyl('polish', [x, y + 0.022, z0 + d * 0.55], 0.013, 0.044, { segments: 10, plan: false }), cyl('caps', [x, y + 0.058, z0 + d * 0.55], 0.006, 0.028, { segments: 8, plan: false }));
    }
    return finish(parts.slice(0, 160), size, SW);
  },
});

const beautyTrolley = defineItem({
  id: 'beauty-trolley-filled',
  name: 'Beauty trolley, filled',
  category: 'bedroom',
  type: 'decor',
  group: 'Beauty & makeup',
  tags: ['beauty cart', 'rolling cart', 'trolley', 'skincare storage', 'makeup storage', 'xe đẩy'],
  description: 'A three-tier metal rolling cart: skincare and perfume on top, makeup and brushes in the middle, towels, cotton and hair tools at the bottom.',
  defaultSize: { w: 0.45, d: 0.35, h: 0.78 },
  minSize: { w: 0.38, d: 0.3, h: 0.65 },
  maxSize: { w: 0.6, d: 0.42, h: 0.9 },
  slots: [matSlot('cart', 'Cart', 'paint-blush'), matSlot('products', 'Bottles & makeup', 'skincare-mix'), matSlot('caps', 'Caps, handles & wheels', 'champagne-gold'), matSlot('towels', 'Towels & cotton', 'fabric-white-cotton')],
  variants: [
    { id: 'white', name: 'White', materials: { cart: 'metal-white-powder' } },
    { id: 'black', name: 'Black', materials: { cart: 'metal-black-matte' } },
    { id: 'mint', name: 'Mint', materials: { cart: 'plastic-mint' } },
  ],
  build: (size) => {
    const { w, d, h } = size;
    const parts: Part[] = [];
    for (const x of [-w / 2 + 0.015, w / 2 - 0.015]) for (const z of [-d / 2 + 0.015, d / 2 - 0.015]) parts.push(vcyl('cart', x, z, 0.05, h, 0.008, o), sphere('caps', [x, 0.025, z], 0.025, o));
    const ys = [0.08, 0.08 + (h - 0.12) / 2, h - 0.04];
    for (const y of ys) parts.push(span('cart', [-w / 2 + 0.01, w / 2 - 0.01], [y - 0.004, y], [-d / 2 + 0.01, d / 2 - 0.01], { plan: y === ys[2] }), span('cart', [-w / 2 + 0.01, w / 2 - 0.01], [y, y + 0.06], [-d / 2 + 0.01, -d / 2 + 0.013], o), span('cart', [-w / 2 + 0.01, w / 2 - 0.01], [y, y + 0.06], [d / 2 - 0.013, d / 2 - 0.01], o));
    // Top: skincare.
    const t = ys[2];
    parts.push(...pump('products', 'caps', -w * 0.3, t, -d * 0.15, 0.026, 0.13), ...pump('products', 'caps', -w * 0.12, t, -d * 0.18, 0.022, 0.1), ...dropper('products', 'caps', w * 0.05, t, -d * 0.15), ...jar('products', 'caps', w * 0.25, t, -d * 0.1), ...tube('products', 'caps', w * 0.35, t, d * 0.12, 0.12), ...perfume('products', 'caps', -w * 0.2, t, d * 0.18, 1), ...perfume('products', 'caps', w * 0.05, t, d * 0.18, 0));
    // Middle: makeup.
    const m = ys[1];
    parts.push(...brushCup('products', 'caps', 'products', -w * 0.25, m, 0, 5), ...palette('caps', 'products', w * 0.15, m, -d * 0.1, 0.14, 0.09), ...lipstick('caps', 'products', w * 0.05, m, d * 0.2), ...lipstick('caps', 'products', w * 0.12, m, d * 0.22), ...lipstick('caps', 'products', w * 0.19, m, d * 0.2), ...jar('products', 'caps', w * 0.33, m, d * 0.18, 0.025, 0.03));
    // Bottom: rolled towels and a jar of cotton pads.
    const b = ys[0];
    for (const z of [-d * 0.2, 0, d * 0.2]) parts.push({ ...cyl('towels', [0, 0, 0], 0.035, w * 0.42, { segments: 14, plan: false }), position: [-w * 0.18, b + 0.035, z], rotation: [0, 0, Math.PI / 2] } as Part);
    parts.push(cyl('products', [w * 0.25, b + 0.05, 0], 0.045, 0.1, { segments: 20, plan: false }), cyl('towels', [w * 0.25, b + 0.045, 0], 0.04, 0.085, { segments: 20, plan: false }));
    return finish(parts, size, SW);
  },
});

const toiletryShelf = defineItem({
  id: 'bathroom-shelf-toiletries',
  name: 'Bathroom shelf with toiletries',
  category: 'bathroom',
  type: 'plumbing',
  group: 'Bathroom accessories',
  tags: ['bathroom shelf', 'toiletries', 'lotion', 'shampoo', 'glass shelf', 'kệ nhà tắm'],
  description: 'Two glass shelves on gold brackets filled with lotions, a cleanser, serums, cotton pads, a reed diffuser and a small plant.',
  defaultSize: { w: 0.6, d: 0.15, h: 0.45 },
  minSize: { w: 0.4, d: 0.12, h: 0.32 },
  maxSize: { w: 1.0, d: 0.2, h: 0.6 },
  mount: 'wall',
  defaultElevation: 1.15,
  slots: [matSlot('glass', 'Shelves', 'glass-clear'), matSlot('metal', 'Brackets & caps', 'champagne-gold'), matSlot('bottles', 'Bottles & jars', 'skincare-mix'), matSlot('dark', 'Diffuser & amber glass', 'amber-glass')],
  build: (size) => {
    const { w, d, h } = size;
    const z0 = -d / 2;
    const ys = [0.02, h * 0.55];
    const parts: Part[] = [];
    for (const [i, y] of ys.entries()) {
      parts.push(span('glass', [-w / 2, w / 2], [y, y + 0.01], [z0, d / 2], { plan: i === 0 }));
      for (const s of [-1, 1]) parts.push(span('metal', [s * (w / 2 - 0.06) - 0.006, s * (w / 2 - 0.06) + 0.006], [y - 0.02, y], [z0, z0 + d * 0.8], o));
    }
    const y1 = ys[0] + 0.01;
    const y2 = ys[1] + 0.01;
    const zc = z0 + d * 0.5;
    parts.push(...pump('bottles', 'metal', -w * 0.38, y1, zc, 0.028, 0.14), ...pump('bottles', 'metal', -w * 0.24, y1, zc, 0.025, 0.12), ...tube('bottles', 'metal', -w * 0.1, y1, zc, 0.14), ...jar('bottles', 'metal', w * 0.05, y1, zc), cyl('dark', [w * 0.22, y1 + 0.05, zc], 0.03, 0.1, { segments: 16, plan: false }), cyl('bottles', [w * 0.36, y1 + 0.04, zc], 0.035, 0.08, { segments: 18, plan: false }), cyl('metal', [w * 0.36, y1 + 0.085, zc], 0.036, 0.01, { segments: 18, plan: false }));
    for (const k of range(5)) parts.push(rod('dark', [w * 0.22, y1 + 0.08, zc], [w * 0.22 + Math.cos(k * 1.3) * 0.05, y1 + 0.24, zc + Math.sin(k * 1.3) * 0.03], 0.0018, { segments: 6, plan: false }));
    parts.push(...dropper('dark', 'metal', -w * 0.35, y2, zc), ...dropper('dark', 'metal', -w * 0.27, y2, zc, 0.014, 0.06), ...pump('bottles', 'metal', -w * 0.1, y2, zc, 0.024, 0.11), ...jar('bottles', 'metal', w * 0.08, y2, zc, 0.028, 0.035));
    parts.push(cyl('bottles', [w * 0.3, y2 + 0.04, zc], 0.035, 0.08, { rTop: 0.04, segments: 16, plan: false }), sphere('dark', [w * 0.3, y2 + 0.12, zc], 0.05, { scale: [1.2, 0.9, 1], plan: false }));
    return finish(parts, size, SW);
  },
});

const showerCaddy = defineItem({
  id: 'shower-caddy-filled',
  name: 'Shower caddy, filled',
  category: 'bathroom',
  type: 'plumbing',
  group: 'Bathroom accessories',
  tags: ['shower caddy', 'shampoo', 'conditioner', 'body wash', 'razor', 'kệ phòng tắm'],
  description: 'A two-tier wall-mounted shower caddy with shampoo, conditioner and body wash pumps, a scrub jar, a razor, a loofah and a bar of soap.',
  defaultSize: { w: 0.36, d: 0.13, h: 0.42 },
  minSize: { w: 0.28, d: 0.1, h: 0.32 },
  maxSize: { w: 0.5, d: 0.16, h: 0.55 },
  mount: 'wall',
  defaultElevation: 1.0,
  slots: [matSlot('metal', 'Caddy', 'metal-black-matte'), matSlot('bottles', 'Bottles', 'skincare-mix'), matSlot('caps', 'Pumps & caps', 'gloss-black'), matSlot('loofah', 'Loofah & soap', 'plastic-pink')],
  build: (size) => {
    const { w, d, h } = size;
    const z0 = -d / 2;
    const parts: Part[] = [];
    const ys = [0.02, h * 0.55];
    for (const [i, y] of ys.entries()) {
      for (const z of cells(4, z0 + 0.01, d / 2 - 0.01)) parts.push(rodX('metal', -w / 2, w / 2, y, z, 0.003, { plan: i === 0 && z < 0 }));
      parts.push(rodX('metal', -w / 2, w / 2, y + 0.04, d / 2 - 0.004, 0.003, o));
      for (const x of [-w / 2 + 0.004, w / 2 - 0.004]) parts.push(rod('metal', [x, y, z0], [x, y, d / 2 - 0.004], 0.003, { plan: i === 0 }), vcyl('metal', x, d / 2 - 0.004, y, y + 0.04, 0.003, o));
    }
    for (const x of [-w / 2 + 0.004, w / 2 - 0.004]) parts.push(vcyl('metal', x, z0 + 0.004, 0, h, 0.004, o));
    const y1 = ys[0] + 0.003;
    const y2 = ys[1] + 0.003;
    parts.push(...pump('bottles', 'caps', -w * 0.3, y1, 0, 0.03, 0.17), ...pump('bottles', 'caps', -w * 0.05, y1, 0, 0.03, 0.17), ...pump('bottles', 'caps', w * 0.22, y1, 0, 0.028, 0.15));
    parts.push(...jar('bottles', 'caps', -w * 0.25, y2, 0, 0.035, 0.05), span('loofah', [-w * 0.05, w * 0.1], [y2, y2 + 0.03], [-0.03, 0.03], { bevel: 0.012, plan: false }), sphere('loofah', [w * 0.3, y2 + 0.07, 0.0], 0.055, o), { ...span('caps', [-0.06, 0.06], [-0.006, 0.006], [-0.01, 0.01], o), position: [w * 0.02, y2 + 0.04, d / 2 - 0.03], rotation: [0, 0, 0.3] } as Part);
    return finish(parts, size, SW);
  },
});

const handbagShelf = defineItem({
  id: 'handbag-display-shelf',
  name: 'Handbag display shelves',
  category: 'bedroom',
  type: 'decor',
  group: 'Beauty & makeup',
  tags: ['handbags', 'purses', 'bag shelf', 'closet display', 'túi xách'],
  description: 'Three wall shelves displaying handbags — a structured tote, a top-handle bag, a quilted chain bag, a clutch and a bucket bag — with a hat on top.',
  defaultSize: { w: 1.0, d: 0.32, h: 1.1 },
  minSize: { w: 0.7, d: 0.26, h: 0.8 },
  maxSize: { w: 1.6, d: 0.4, h: 1.5 },
  mount: 'wall',
  defaultElevation: 0.9,
  slots: [matSlot('shelf', 'Shelves', 'paint-pure-white'), matSlot('bags', 'Bags', 'leather-blush'), matSlot('bags2', 'More bags', 'leather-tan'), matSlot('metal', 'Hardware & hat', 'champagne-gold')],
  build: (size) => {
    const { w, d, h } = size;
    const z0 = -d / 2;
    const ys = [0.02, h * 0.36, h * 0.7];
    const parts: Part[] = [];
    for (const [i, y] of ys.entries()) parts.push(span('shelf', [-w / 2, w / 2], [y, y + 0.025], [z0, d / 2], { bevel: 0.004, plan: i === 0 }));
    const gapH = (i: number) => (i < 2 ? ys[i + 1] - ys[i] - 0.04 : h - ys[2] - 0.04);
    const bag = (slot: string, x: number, y: number, bw: number, bh: number, bd: number, handle: 'top' | 'chain' | 'none'): Part[] => {
      const p: Part[] = [span(slot, [x - bw / 2, x + bw / 2], [y, y + bh], [-bd / 2, bd / 2], { bevel: Math.min(0.02, bd * 0.3), plan: false }), span('metal', [x - 0.012, x + 0.012], [y + bh * 0.72, y + bh * 0.8], [bd / 2, bd / 2 + 0.004], o)];
      if (handle === 'top') p.push({ ...torus(slot, [0, 0, 0], bw * 0.28, 0.008, { arc: Math.PI, plan: false }), position: [x, y + bh, 0] } as Part);
      if (handle === 'chain') p.push({ ...torus('metal', [0, 0, 0], bw * 0.42, 0.003, { arc: Math.PI, plan: false }), position: [x, y + bh, 0] } as Part);
      return p;
    };
    const y0 = ys[0] + 0.025;
    const y1 = ys[1] + 0.025;
    const y2 = ys[2] + 0.025;
    parts.push(...bag('bags2', -w * 0.25, y0, Math.min(0.38, w * 0.38), Math.min(gapH(0) * 0.7, 0.28), Math.min(0.15, d * 0.5), 'top'), ...bag('bags', w * 0.2, y0, Math.min(0.28, w * 0.28), Math.min(gapH(0) * 0.55, 0.2), Math.min(0.12, d * 0.4), 'top'));
    parts.push(...bag('bags', -w * 0.28, y1, Math.min(0.24, w * 0.25), Math.min(gapH(1) * 0.5, 0.16), Math.min(0.08, d * 0.3), 'chain'), ...bag('bags2', w * 0.02, y1, Math.min(0.26, w * 0.26), Math.min(gapH(1) * 0.3, 0.09), 0.03, 'none'), ...bag('bags', w * 0.3, y1, Math.min(0.2, w * 0.2), Math.min(gapH(1) * 0.6, 0.22), Math.min(0.18, d * 0.55), 'top'));
    parts.push(cyl('metal', [-w * 0.25, y2 + 0.005, 0], 0.18, 0.01, { segments: 32, plan: false }), cyl('metal', [-w * 0.25, y2 + 0.05, 0], 0.08, 0.09, { rTop: 0.075, segments: 24, plan: false }), ...bag('bags2', w * 0.2, y2, Math.min(0.3, w * 0.3), Math.min(gapH(2) * 0.6, 0.22), Math.min(0.14, d * 0.45), 'top'));
    return finish(parts, size);
  },
});

const ledFloorMirror = defineItem({
  id: 'led-arched-floor-mirror',
  name: 'Arched floor mirror with LED edge',
  category: 'bedroom',
  type: 'decor',
  group: 'Mirrors',
  tags: ['floor mirror', 'full length mirror', 'arched mirror', 'LED mirror', 'gương soi toàn thân'],
  description: 'A full-length arched mirror on a slim gold frame with a soft LED glow around its edge, leaning against the wall.',
  defaultSize: { w: 0.65, d: 0.35, h: 1.7 },
  minSize: { w: 0.45, d: 0.3, h: 1.4 },
  maxSize: { w: 0.9, d: 0.45, h: 2.0 },
  slots: [matSlot('frame', 'Frame', 'champagne-gold'), matSlot('mirror', 'Mirror', 'glass-mirror'), matSlot('light', 'LED edge', 'vanity-bulb')],
  light: { color: '#fff1dc', intensity: 0.3, distance: 2, y: 1.0, z: 0.1 },
  build: (size) => {
    const { w, d, h } = size;
    const r = w / 2;
    const lean = Math.atan2(d - 0.05, h);
    const L = h / Math.cos(lean);
    const straight = L - r;
    const parts: Part[] = [];
    // Built upright around the origin, then leaned back.
    const up: Part[] = [
      span('mirror', [-r + 0.02, r - 0.02], [0, straight], [-0.004, 0.004]),
      { ...cyl('mirror', [0, 0, 0], r - 0.02, 0.008, { segments: 32, plan: false }), position: [0, straight, 0], rotation: [Math.PI / 2, 0, 0] } as Part,
      span('frame', [-r, -r + 0.02], [0, straight], [-0.012, 0.008], o),
      span('frame', [r - 0.02, r], [0, straight], [-0.012, 0.008], o),
      span('frame', [-r, r], [0, 0.02], [-0.012, 0.008], o),
      { ...torus('frame', [0, 0, 0], r - 0.01, 0.012, { arc: Math.PI, plan: false }), position: [0, straight, -0.002] } as Part,
      span('light', [-r + 0.018, -r + 0.024], [0.02, straight], [-0.016, -0.012], o),
      span('light', [r - 0.024, r - 0.018], [0.02, straight], [-0.016, -0.012], o),
      { ...torus('light', [0, 0, 0], r - 0.021, 0.003, { arc: Math.PI, plan: false }), position: [0, straight, -0.014] } as Part,
    ];
    const zBase = d / 2 - 0.03;
    for (const p of up) {
      const [x, y, z] = p.position;
      const ny = y * Math.cos(lean) - z * Math.sin(lean);
      const nz = y * Math.sin(lean) + z * Math.cos(lean);
      const rot = p.rotation ?? [0, 0, 0];
      parts.push({ ...p, position: [x, ny, zBase - nz], rotation: [rot[0] - lean, rot[1], rot[2]] });
    }
    return finish(parts, size);
  },
});

const candleSet = defineItem({
  id: 'candle-diffuser-set',
  name: 'Candles & reed diffuser set',
  category: 'bathroom',
  type: 'decor',
  group: 'Candles & tabletop',
  tags: ['candles', 'reed diffuser', 'spa', 'scented', 'nến thơm'],
  description: 'Three scented candles in glass jars, a reed diffuser and a rolled hand towel on a marble tray — the spa touch for a bath ledge or vanity.',
  defaultSize: { w: 0.34, d: 0.16, h: 0.3 },
  minSize: { w: 0.25, d: 0.12, h: 0.22 },
  maxSize: { w: 0.5, d: 0.22, h: 0.4 },
  slots: [matSlot('tray', 'Tray', 'stone-marble-carrara'), matSlot('glass', 'Jars & diffuser', 'amber-glass'), matSlot('wax', 'Wax & towel', 'fabric-white-cotton'), matSlot('reeds', 'Reeds & lids', 'wood-oak-natural')],
  build: (size) => {
    const { w, d, h } = size;
    const y = 0.012;
    const parts: Part[] = [span('tray', [-w / 2, w / 2], [0, y], [-d / 2, d / 2], { bevel: 0.004, plan: true })];
    for (const [i, x] of [-w * 0.36, -w * 0.18, -w * 0.02].entries()) {
      const ch = 0.05 + i * 0.02;
      const z = i === 1 ? -d * 0.15 : d * 0.1;
      parts.push(cyl('glass', [x, y + ch / 2, z], 0.032, ch, { segments: 18, plan: false }), cyl('wax', [x, y + ch * 0.4, z], 0.029, ch * 0.75, { segments: 18, plan: false }), vcyl('reeds', x, z, y + ch * 0.78, y + ch * 0.84, 0.002, o));
    }
    const dx = w * 0.22;
    parts.push(cyl('glass', [dx, y + 0.05, -d * 0.1], 0.035, 0.1, { rTop: 0.02, segments: 18, plan: false }));
    for (const k of range(6)) parts.push(rod('reeds', [dx, y + 0.09, -d * 0.1], [dx + Math.cos(k * 1.05) * 0.06, h - 0.01, -d * 0.1 + Math.sin(k * 1.05) * 0.03], 0.0018, { segments: 6, plan: false }));
    parts.push({ ...cyl('wax', [0, 0, 0], 0.03, 0.12, { segments: 16, plan: false }), position: [w * 0.3, y + 0.03, d * 0.22], rotation: [0, 0, Math.PI / 2] } as Part);
    return finish(parts, size);
  },
});

const items: PackItem[] = [
  hollywoodVanity,
  roundMirrorVanity,
  glassTopDesk,
  vanityStool,
  shellChair,
  makeupSet,
  skincareSet,
  lotionTrio,
  perfumeTray,
  acrylicOrganizer,
  lightedMirror,
  hairTools,
  jewelleryStand,
  cosmeticBag,
  polishRack,
  beautyTrolley,
  toiletryShelf,
  showerCaddy,
  handbagShelf,
  ledFloorMirror,
  candleSet,
];

export default definePack({
  name: 'Beauty',
  version: '1.0.0',
  author: 'Neest',
  description: 'Vanities and makeup desks set up, makeup and skincare sets, lotions, perfumes, hair tools, jewellery, mirrors and toiletry shelves.',
  license: 'CC0-1.0',
  patterns,
  materials,
  items,
});

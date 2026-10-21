/**
 * Pets — homes and furniture for birds, dogs and cats, plus a few animals:
 *
 * - Birds: a modular wire bird cage of snap-together panels and round connectors (white, with a
 *   white base band, a pull-out tray, a wire floor, a side door, a hanging nest, a bead swing,
 *   perches and feeding cups; resizes in whole modules), a wide version, a round dome cage on a
 *   stand, a floor play stand, and lovebirds in four colour morphs.
 * - Dogs: a round donut bed, a bolster bed, a wire crate with tray and pad, an end-table crate, a
 *   raised double bowl, an outdoor kennel, an octagonal play pen, a pressure gate and a toy basket.
 * - Cats: a tall cat tree, a scratching post, a hooded litter box, a litter cabinet, wall steps, a
 *   felt cave, a window perch, a water fountain, a tilted double bowl, a pet carrier and a sleeping cat.
 */
import {
  clamp,
  cells,
  containParts,
  cyl,
  defineItem,
  definePack,
  discZ,
  lathe,
  matSlot,
  plantBox,
  prism,
  range,
  rod,
  rodX,
  rodZ,
  span,
  spaced,
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
type V3 = [number, number, number];
const o = { plan: false } as const;
const keep = (parts: Part[], size: Size3) => containParts(parts, plantBox(size));
const common = { category: 'pets' as const, type: 'pets' as const };

/** Vertical cage wires on a transparent tile (a see-through pattern: the gaps are holes). */
const patterns: PackPattern[] = [
  {
    id: 'cage-wires',
    name: 'Cage wires',
    cutout: true,
    normalStrength: 0.6,
    draw(ctx, size) {
      ctx.clearRect(0, 0, size, size);
      const n = 8;
      const step = size / n;
      const wire = Math.max(2, Math.round(step * 0.16));
      for (let i = 0; i < n; i++) {
        const x = Math.round(i * step + step / 2 - wire / 2);
        const g = ctx.createLinearGradient(x, 0, x + wire, 0);
        g.addColorStop(0, '#d9d9d6');
        g.addColorStop(0.45, '#ffffff');
        g.addColorStop(1, '#cfcfcc');
        ctx.fillStyle = g;
        ctx.fillRect(x, 0, wire, size);
      }
    },
  },
  {
    id: 'crate-mesh',
    name: 'Crate wire mesh',
    cutout: true,
    normalStrength: 0.6,
    draw(ctx, size) {
      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = '#ffffff';
      const n = 4;
      const step = size / n;
      const wire = Math.max(2, Math.round(step * 0.09));
      for (let i = 0; i < n; i++) ctx.fillRect(Math.round(i * step + step / 2 - wire / 2), 0, wire, size);
      ctx.fillRect(0, Math.round(size / 2 - wire / 2), size, wire);
    },
  },
];

const materials: PackMaterial[] = [
  { id: 'wire-mesh-white', name: 'White cage wire', category: 'metal', color: '#f4f4f2', roughness: 0.4, metalness: 0.2, pattern: { id: 'cage-wires', scale: 0.1, contrast: 1 } },
  { id: 'wire-mesh-black', name: 'Black cage wire', category: 'metal', color: '#2a2a2c', roughness: 0.45, metalness: 0.3, pattern: { id: 'cage-wires', scale: 0.1, contrast: 1 } },
  { id: 'crate-mesh-black', name: 'Black crate mesh', category: 'metal', color: '#2a2a2c', roughness: 0.45, metalness: 0.3, pattern: { id: 'crate-mesh', scale: 0.2, contrast: 1 } },
  { id: 'white-plastic', name: 'White plastic', category: 'solid', color: '#f3f3f0', roughness: 0.45 },
  { id: 'tray-black', name: 'Black tray', category: 'solid', color: '#222224', roughness: 0.55 },
  { id: 'perch-wood', name: 'Perch wood', category: 'wood', color: '#c99a63', roughness: 0.75, pattern: { id: 'wood-grain', scale: 0.12, contrast: 0.5 } },
  { id: 'nest-coconut', name: 'Coconut fibre', category: 'fabric', color: '#b98a52', roughness: 1, pattern: { id: 'jute', scale: 0.06, contrast: 0.6 } },
  { id: 'lovebird-green', name: 'Lovebird green', category: 'solid', color: '#4caf3c', roughness: 0.7 },
  { id: 'lovebird-peach', name: 'Peach face', category: 'solid', color: '#f28a5c', roughness: 0.7 },
  { id: 'lovebird-blue', name: 'Lovebird blue', category: 'solid', color: '#3f74c9', roughness: 0.7 },
  { id: 'lovebird-yellow', name: 'Lutino yellow', category: 'solid', color: '#f1d53a', roughness: 0.7 },
  { id: 'lovebird-violet', name: 'Violet', category: 'solid', color: '#6c5a9e', roughness: 0.7 },
  { id: 'beak-coral', name: 'Coral beak', category: 'solid', color: '#e2513a', roughness: 0.4 },
  { id: 'eye-dark', name: 'Dark eye & tail', category: 'solid', color: '#1d2b4a', roughness: 0.4 },
  { id: 'plush-grey', name: 'Grey plush', category: 'fabric', color: '#a9a7a2', roughness: 1, pattern: { id: 'boucle', scale: 0.08, contrast: 0.7 } },
  { id: 'plush-cream', name: 'Cream plush', category: 'fabric', color: '#e9e1d2', roughness: 1, pattern: { id: 'boucle', scale: 0.08, contrast: 0.7 } },
  { id: 'canvas-olive', name: 'Olive canvas', category: 'fabric', color: '#77805a', roughness: 0.9, pattern: { id: 'weave', scale: 0.04, contrast: 0.4 } },
  { id: 'sisal', name: 'Sisal rope', category: 'fabric', color: '#cdb98e', roughness: 1, pattern: { id: 'jute', scale: 0.03, contrast: 0.8 } },
  { id: 'felt-charcoal', name: 'Charcoal felt', category: 'fabric', color: '#4a4b4e', roughness: 1 },
  { id: 'steel-bowl', name: 'Stainless bowl', category: 'metal', color: '#c9ccd0', roughness: 0.25, metalness: 0.9 },
  { id: 'cat-ginger', name: 'Ginger fur', category: 'fabric', color: '#d9893f', roughness: 1 },
  { id: 'cat-grey', name: 'Grey fur', category: 'fabric', color: '#8c8d91', roughness: 1 },
  { id: 'cat-black', name: 'Black fur', category: 'fabric', color: '#26262a', roughness: 1 },
  { id: 'cat-white', name: 'White fur', category: 'fabric', color: '#f1eee8', roughness: 1 },
  { id: 'cat-pink', name: 'Pink nose & ears', category: 'solid', color: '#e6a1a0', roughness: 0.6 },
  { id: 'toy-red', name: 'Red toy', category: 'solid', color: '#d6453a', roughness: 0.6 },
  { id: 'dark-hole', name: 'Shadowed opening', category: 'solid', color: '#141414', roughness: 1 },
];

// ───────────────────────── Birds ─────────────────────────

/**
 * Modular cage: a base band (solid panels around a pull-out tray), then rows of wire modules
 * (≈36 cm wide, ≈28 cm high) joined by round connectors at every grid node. Wire spacing widens on
 * very large cages to keep the part count reasonable.
 */
function modularCage({ w, d, h }: Size3): Part[] {
  const parts: Part[] = [];
  const BASE = clamp(h * 0.22, 0.16, 0.26);
  const cols = Math.max(1, Math.round(w / 0.36));
  const rows = Math.max(1, Math.round((h - BASE) / 0.28));
  const x0 = -w / 2 + 0.012;
  const x1 = w / 2 - 0.012;
  const z0 = -d / 2 + 0.012;
  const z1 = d / 2 - 0.012;
  const levels = range(rows + 1).map((i) => BASE + ((h - 0.012 - BASE) * i) / rows);
  // Base band: white panels on four sides, a black pull-out tray under the front, a wire floor.
  parts.push(
    span('base', [x0, x1], [0.035, BASE], [z1 - 0.004, z1], o),
    span('base', [x0, x1], [0.035, BASE], [z0, z0 + 0.004], o),
    span('base', [x0, x0 + 0.004], [0.035, BASE], [z0, z1], o),
    span('base', [x1 - 0.004, x1], [0.035, BASE], [z0, z1], o),
    span('tray', [x0 + 0.01, x1 - 0.01], [0.008, 0.035], [z0 + 0.01, d / 2], { bevel: 0.004, plan: false }),
    span('base', [x0 + 0.004, x1 - 0.004], [BASE - 0.05, BASE - 0.045], [z0 + 0.004, z1 - 0.004]),
  );
  // Wire panels: one see-through textured panel per face (the wires are in the texture), a wire
  // floor over the tray and a wire roof.
  const top = levels[rows];
  const t = 0.0015;
  parts.push(
    span('frame', [x0, x1], [BASE, top], [z1 - t, z1 + t], o),
    span('frame', [x0, x1], [BASE, top], [z0 - t, z0 + t], o),
    span('frame', [x0 - t, x0 + t], [BASE, top], [z0, z1], o),
    span('frame', [x1 - t, x1 + t], [BASE, top], [z0, z1], o),
    span('frame', [x0, x1], [top - t, top + t], [z0, z1], o),
    span('frame', [x0, x1], [BASE - 0.012, BASE - 0.009], [z0, z1], o),
  );
  // Module edges: a white rail around every level and an upright at every module seam.
  for (const y of levels) {
    parts.push(rodX('base', x0, x1, y, z1, 0.0032, o), rodX('base', x0, x1, y, z0, 0.0032, o), rodZ('base', x0, y, z0, z1, 0.0032, o), rodZ('base', x1, y, z0, z1, 0.0032, o));
  }
  for (const x of spaced(cols + 1, x0, x1)) parts.push(vcyl('base', x, z1, BASE, top, 0.0032, o), vcyl('base', x, z0, BASE, top, 0.0032, o));
  // Connectors at every grid node of the front; at the back (usually against a wall) only the corners.
  const colX = spaced(cols + 1, x0, x1);
  const nodeYs = [0.035, ...levels];
  for (const y of nodeYs) {
    for (const x of colX) parts.push(discZ('base', [x, y, z1 + 0.002], 0.02, 0.01, o));
    for (const x of [x0, x1]) parts.push(discZ('base', [x, y, z0 - 0.002], 0.02, 0.01, o));
  }
  // Side door on the right, in the middle row: a framed hatch with a latch.
  const dy0 = levels[Math.min(1, rows - 1)];
  const dy1 = levels[Math.min(2, rows)];
  const dz = Math.min(0.13, (z1 - z0) / 2 - 0.02);
  parts.push(
    rod('base', [x1 + 0.006, dy0 + 0.01, -dz], [x1 + 0.006, dy1 - 0.01, -dz], 0.0035, o),
    rod('base', [x1 + 0.006, dy0 + 0.01, dz], [x1 + 0.006, dy1 - 0.01, dz], 0.0035, o),
    rod('base', [x1 + 0.006, dy1 - 0.01, -dz], [x1 + 0.006, dy1 - 0.01, dz], 0.0035, o),
    sphere('base', [x1 + 0.006, (dy0 + dy1) / 2, dz + 0.012], 0.008, o),
  );
  // Inside: a coconut nest hung at the top, a bead swing, perches and two feeding cups.
  const nx0 = x0 + (x1 - x0) * 0.22;
  parts.push(
    sphere('toys', [nx0, top - 0.11, z0 + 0.09], 0.065, { scale: [1, 0.9, 1], plan: false }),
    discZ('tray', [nx0, top - 0.11, z0 + 0.155], 0.024, 0.006, o),
    vcyl('toys', nx0, z0 + 0.09, top - 0.06, top, 0.003, o),
  );
  const sx = x0 + (x1 - x0) * 0.7;
  const swingLen = Math.min(0.24, (top - BASE) * 0.35);
  parts.push(vcyl('toys', sx, 0, top - swingLen, top, 0.0025, o));
  for (const i of range(5)) parts.push(sphere('toys', [sx, top - 0.03 - (i * (swingLen - 0.05)) / 4, 0], 0.011, o));
  parts.push(torus('toys', [sx, top - swingLen - 0.05, 0], 0.05, 0.004, { plan: false }), rodX('toys', sx - 0.045, sx + 0.045, top - swingLen - 0.1, 0, 0.006, o));
  const py = levels[Math.min(1, rows)] - 0.06;
  parts.push(rodX('toys', x0 + 0.04, x0 + (x1 - x0) * 0.42, py, 0, 0.009, o), rodX('toys', x0 + (x1 - x0) * 0.55, x1 - 0.04, py + 0.02, z0 + (z1 - z0) * 0.35, 0.009, o));
  for (const zc of [z1 - 0.06, z1 - 0.14]) parts.push(cyl('base', [x1 - 0.045, levels[Math.min(1, rows)] - 0.13, zc], 0.025, 0.04, { rTop: 0.028, segments: 14, plan: false }));
  return parts;
}

const cage = defineItem({
  ...common,
  id: 'modular-bird-cage',
  name: 'Modular wire bird cage',
  group: 'Bird cages',
  tags: ['bird cage', 'modular cage', 'lovebird', 'parakeet', 'budgie', 'lồng chim', 'chuồng chim', 'pet'],
  description: 'A snap-together cage of white wire panels and round connectors, with a solid base band, a pull-out tray, a side door, a coconut nest, a bead swing, perches and two feeding cups. Resizes in whole modules.',
  defaultSize: { w: 0.72, d: 0.37, h: 1.07 },
  minSize: { w: 0.36, d: 0.3, h: 0.7 },
  maxSize: { w: 1.44, d: 0.74, h: 1.8 },
  slots: [matSlot('frame', 'Wire panels', 'wire-mesh-white'), matSlot('base', 'Base, rails & connectors', 'white-plastic'), matSlot('tray', 'Tray', 'tray-black'), matSlot('toys', 'Nest, perches & swing', 'perch-wood')],
  variants: [
    { id: 'black', name: 'Black', materials: { frame: 'wire-mesh-black', base: 'tray-black' } },
    { id: 'mint', name: 'Mint & white', materials: { base: 'plastic-mint' } },
    { id: 'pink', name: 'Pink & white', materials: { base: 'plastic-pink' } },
  ],
  build: (size) => keep(modularCage(size), size),
});
const cageWide = defineItem({
  ...cage,
  id: 'modular-bird-cage-wide',
  name: 'Modular wire bird cage, 3 × 4 modules',
  description: 'The modular wire cage built three modules wide and four high, for a pair or a small flock of lovebirds, budgies or finches.',
  tags: ['bird cage', 'modular cage', 'large', 'aviary', 'lovebird', 'lồng chim'],
  defaultSize: { w: 1.08, d: 0.37, h: 1.38 },
  variantOf: 'modular-bird-cage',
});

const domeCage = defineItem({
  ...common,
  id: 'dome-bird-cage-stand',
  name: 'Round dome bird cage on stand',
  group: 'Bird cages',
  tags: ['bird cage', 'dome cage', 'round cage', 'stand', 'canary', 'lồng chim tròn'],
  description: 'A classic round wire cage with a domed top and a hanging ring, on a tall stand with a turned base. Inside: two perches and a swing.',
  defaultSize: { w: 0.5, d: 0.5, h: 1.6 },
  minSize: { w: 0.35, d: 0.35, h: 1.2 },
  maxSize: { w: 0.8, d: 0.8, h: 2 },
  slots: [matSlot('frame', 'Wire & stand', 'metal-brass'), matSlot('base', 'Cage floor', 'white-plastic'), matSlot('toys', 'Perches', 'perch-wood')],
  build: (size) => {
    const { w, h } = size;
    const R = w / 2 - 0.01;
    const yb = h * 0.48;
    const yTop = h - R * 0.75 - 0.06;
    const parts: Part[] = [
      lathe('frame', [0, 0, 0], [[0, 0], [R * 0.7, 0], [R * 0.72, 0.02], [R * 0.3, 0.05], [0.025, 0.08], [0.02, 0.1]], { plan: true }),
      vcyl('frame', 0, 0, 0.08, yb, 0.015, o),
      cyl('base', [0, yb + 0.02, 0], R, 0.04, { segments: 32, plan: false }),
    ];
    for (const y of [yb + 0.04, yb + (yTop - yb) * 0.5, yTop]) parts.push(torus('frame', [0, y, 0], R, 0.003, { rotation: [Math.PI / 2, 0, 0], plan: false }));
    const n = 24;
    for (const i of range(n)) {
      const a = (i / n) * Math.PI * 2;
      parts.push(vcyl('frame', Math.cos(a) * R, Math.sin(a) * R, yb + 0.04, yTop, 0.0016, o));
    }
    // Domed top: half-circle ribs from side to side, scaled down in height.
    for (const i of range(6)) {
      const a = (i / 6) * Math.PI;
      parts.push(torus('frame', [0, yTop, 0], R, 0.0018, { rotation: [0, a, 0], arc: Math.PI, scale: [1, 0.75, 1], plan: false }));
    }
    parts.push(torus('frame', [0, yTop + R * 0.75 + 0.03, 0], 0.03, 0.004, { plan: false }));
    parts.push(rodX('toys', -R * 0.8, R * 0.8, yb + (yTop - yb) * 0.35, 0, 0.007, o), rodZ('toys', 0, yb + (yTop - yb) * 0.7, -R * 0.7, R * 0.7, 0.007, o));
    return keep(parts, size);
  },
});

const playStand = defineItem({
  ...common,
  id: 'bird-play-stand',
  name: 'Bird play stand with ladder',
  group: 'Bird accessories',
  tags: ['play stand', 'bird gym', 'perch', 'ladder', 'parrot', 'lovebird', 'giá đậu chim'],
  description: 'A wooden play gym for time out of the cage: a tray on castors, a central post with two perch levels, a ladder, a bell and two cups.',
  defaultSize: { w: 0.6, d: 0.45, h: 1.25 },
  minSize: { w: 0.45, d: 0.35, h: 0.9 },
  maxSize: { w: 0.9, d: 0.6, h: 1.6 },
  slots: [matSlot('wood', 'Perches & ladder', 'perch-wood'), matSlot('tray', 'Tray & legs', 'white-plastic'), matSlot('cups', 'Cups & bell', 'steel-bowl')],
  build: (size) => {
    const { w, d, h } = size;
    const ty = 0.62;
    const parts: Part[] = [span('tray', [-w / 2, w / 2], [ty - 0.06, ty], [-d / 2, d / 2], { bevel: 0.015 })];
    for (const [x, z] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ])
      parts.push(rod('tray', [x * (w / 2 - 0.05), 0.04, z * (d / 2 - 0.05)], [x * (w / 2 - 0.08), ty - 0.06, z * (d / 2 - 0.08)], 0.012, o), sphere('tray', [x * (w / 2 - 0.05), 0.025, z * (d / 2 - 0.05)], 0.025, o));
    parts.push(vcyl('wood', 0, 0, ty, h - 0.02, 0.02, o));
    parts.push(rodX('wood', -w / 2 + 0.03, w / 2 - 0.03, h - 0.04, 0, 0.012, o), rodZ('wood', 0, ty + (h - ty) * 0.5, -d / 2 + 0.05, d / 2 - 0.05, 0.011, o));
    for (const s of [-1, 1]) parts.push(cyl('cups', [s * (w / 2 - 0.06), h - 0.07, 0], 0.035, 0.05, { rTop: 0.04, segments: 14, plan: false }));
    // Ladder from the tray up to the lower perch.
    const lx = -w / 4;
    for (const s of [-0.05, 0.05]) parts.push(rod('wood', [lx + s, ty, d / 2 - 0.04], [lx + s, ty + (h - ty) * 0.5, 0.04], 0.006, o));
    for (const i of range(4)) {
      const t = (i + 1) / 5;
      parts.push(rodX('wood', lx - 0.05, lx + 0.05, ty + (h - ty) * 0.5 * t, d / 2 - 0.04 - (d / 2 - 0.08) * t, 0.005, o));
    }
    parts.push(vcyl('cups', w / 2 - 0.12, 0, h - 0.16, h - 0.05, 0.002, o), sphere('cups', [w / 2 - 0.12, h - 0.17, 0], 0.016, o));
    return keep(parts, size);
  },
});

/** A perched bird facing +z: body, head with face patch, beak, tail, eyes and feet. */
function birdParts(size: Size3): Part[] {
  const s = size.h / 0.15;
  const at = (x: number, y: number, z: number): V3 => [x * s, y * s, z * s];
  return [
    sphere('body', at(0, 0.06, -0.005), 0.034 * s, { scale: [0.95, 1.05, 1.25], plan: true }),
    sphere('body', at(0, 0.112, 0.022), 0.025 * s, o),
    sphere('face', at(0, 0.108, 0.034), 0.02 * s, { scale: [1.05, 0.95, 0.8], plan: false }),
    cyl('beak', at(0, 0.103, 0.05), 0.009 * s, 0.018 * s, { rTop: 0.002 * s, rotation: [Math.PI / 2 + 0.5, 0, 0], segments: 8, plan: false }),
    sphere('accent', at(-0.016, 0.116, 0.035), 0.004 * s, o),
    sphere('accent', at(0.016, 0.116, 0.035), 0.004 * s, o),
    // Short tail angled down behind.
    span('body', [-0.011 * s, 0.011 * s], [0.03 * s, 0.038 * s], [-0.078 * s, -0.04 * s], { rotation: [-0.45, 0, 0], bevel: 0.003 * s, plan: false }),
    sphere('body', at(-0.026, 0.07, -0.012), 0.016 * s, { scale: [0.5, 1.4, 1.8], plan: false }),
    sphere('body', at(0.026, 0.07, -0.012), 0.016 * s, { scale: [0.5, 1.4, 1.8], plan: false }),
    vcyl('beak', -0.01 * s, 0.005 * s, 0, 0.026 * s, 0.0025 * s, o),
    vcyl('beak', 0.01 * s, 0.005 * s, 0, 0.026 * s, 0.0025 * s, o),
  ];
}

const lovebird = defineItem({
  ...common,
  id: 'lovebird',
  name: 'Lovebird',
  group: 'Pet birds & animals',
  tags: ['lovebird', 'bird', 'parrot', 'pet bird', 'chim uyên ương', 'agapornis'],
  description: 'A peach-faced lovebird standing on its feet, about 15 cm tall. Raise it onto a perch with the elevation; colour morphs as variants.',
  defaultSize: { w: 0.07, d: 0.16, h: 0.15 },
  minSize: { w: 0.05, d: 0.11, h: 0.1 },
  maxSize: { w: 0.1, d: 0.22, h: 0.2 },
  slots: [matSlot('body', 'Feathers', 'lovebird-green'), matSlot('face', 'Face', 'lovebird-peach'), matSlot('beak', 'Beak & feet', 'beak-coral'), matSlot('accent', 'Eyes', 'eye-dark')],
  variants: [
    { id: 'blue', name: 'Blue morph', materials: { body: 'lovebird-blue', face: 'white-plastic' } },
    { id: 'lutino', name: 'Lutino (yellow)', materials: { body: 'lovebird-yellow', face: 'lovebird-peach', accent: 'toy-red' } },
    { id: 'fischer', name: "Fischer's lovebird", materials: { face: 'toy-red' } },
    { id: 'violet', name: 'Violet', materials: { body: 'lovebird-violet', face: 'cat-pink' } },
  ],
  build: (size) => keep(birdParts(size), size),
});

// ───────────────────────── Dogs ─────────────────────────

const donutBed = defineItem({
  ...common,
  id: 'dog-bed-donut',
  name: 'Round donut dog bed',
  group: 'Dog beds & crates',
  tags: ['dog bed', 'donut bed', 'round bed', 'calming bed', 'pet bed', 'nệm chó'],
  description: 'A deep round plush bed with a raised bolster rim and a soft centre cushion, for dogs (or cats) that sleep curled up.',
  defaultSize: { w: 0.8, d: 0.8, h: 0.22 },
  minSize: { w: 0.45, d: 0.45, h: 0.14 },
  maxSize: { w: 1.3, d: 1.3, h: 0.32 },
  slots: [matSlot('fabric', 'Plush', 'plush-grey'), matSlot('base', 'Non-slip base', 'tray-black')],
  build: (size) => {
    const { w, d, h } = size;
    const r = Math.min(w, d) / 2;
    const tube = Math.min(h / 2, r * 0.22);
    return keep(
      [
        cyl('base', [0, 0.006, 0], r - 0.01, 0.012, { segments: 32 }),
        torus('fabric', [0, h - tube, 0], r - tube, tube, { rotation: [Math.PI / 2, 0, 0], scale: [w / (2 * r), d / (2 * r), 1], plan: false }),
        cyl('fabric', [0, h * 0.25, 0], r - tube * 1.4, h * 0.38, { segments: 32, scale: [w / (2 * r), 1, d / (2 * r)], plan: false }),
      ],
      size,
    );
  },
});

const bolsterBed = defineItem({
  ...common,
  id: 'dog-bed-bolster',
  name: 'Bolster dog bed',
  group: 'Dog beds & crates',
  tags: ['dog bed', 'bolster bed', 'orthopedic', 'rectangular', 'pet bed', 'nệm chó'],
  description: 'A rectangular orthopaedic dog bed with a thick foam mattress and a bolster on three sides to rest the head on.',
  defaultSize: { w: 1.0, d: 0.72, h: 0.24 },
  minSize: { w: 0.6, d: 0.45, h: 0.16 },
  maxSize: { w: 1.4, d: 1.0, h: 0.32 },
  slots: [matSlot('fabric', 'Cover', 'canvas-olive'), matSlot('cushion', 'Mattress', 'plush-cream')],
  build: (size) => {
    const { w, d, h } = size;
    const r = Math.min(0.08, h / 2);
    return keep(
      [
        span('fabric', [-w / 2, w / 2], [0, h * 0.4], [-d / 2, d / 2], { bevel: 0.03 }),
        span('cushion', [-w / 2 + 2 * r, w / 2 - 2 * r], [h * 0.4, h * 0.58], [-d / 2 + 2 * r, d / 2 - 0.02], { bevel: 0.03, plan: false }),
        rodX('fabric', -w / 2 + r, w / 2 - r, h - r, -d / 2 + r, r, { segments: 16, plan: false }),
        rodZ('fabric', -w / 2 + r, h - r, -d / 2 + r, d / 2 - r, r, { segments: 16, plan: false }),
        rodZ('fabric', w / 2 - r, h - r, -d / 2 + r, d / 2 - r, r, { segments: 16, plan: false }),
        sphere('fabric', [-w / 2 + r, h - r, -d / 2 + r], r, o),
        sphere('fabric', [w / 2 - r, h - r, -d / 2 + r], r, o),
        sphere('fabric', [-w / 2 + r, h - r, d / 2 - r], r, o),
        sphere('fabric', [w / 2 - r, h - r, d / 2 - r], r, o),
      ],
      size,
    );
  },
});

/** Wire box: see-through mesh panels on four sides and the top, with a rod frame round the edges. */
function wireBox(mesh: string, frame: string, w: number, d: number, y0: number, y1: number, r = 0.004): Part[] {
  const x0 = -w / 2;
  const x1 = w / 2;
  const z0 = -d / 2;
  const z1 = d / 2;
  const t = 0.0015;
  const parts: Part[] = [
    span(mesh, [x0, x1], [y0, y1], [z1 - t, z1 + t], o),
    span(mesh, [x0, x1], [y0, y1], [z0 - t, z0 + t], o),
    span(mesh, [x0 - t, x0 + t], [y0, y1], [z0, z1], o),
    span(mesh, [x1 - t, x1 + t], [y0, y1], [z0, z1], o),
    span(mesh, [x0, x1], [y1 - t, y1 + t], [z0, z1], o),
  ];
  for (const y of [y0, y1]) parts.push(rodX(frame, x0, x1, y, z1, r, o), rodX(frame, x0, x1, y, z0, r, o), rodZ(frame, x0, y, z0, z1, r, o), rodZ(frame, x1, y, z0, z1, r, o));
  for (const [x, z] of [
    [x0, z0],
    [x1, z0],
    [x0, z1],
    [x1, z1],
  ])
    parts.push(vcyl(frame, x, z, y0, y1, r, o));
  return parts;
}

const wireCrate = defineItem({
  ...common,
  id: 'dog-crate-wire',
  name: 'Wire dog crate with pad',
  group: 'Dog beds & crates',
  tags: ['dog crate', 'wire crate', 'kennel', 'cage', 'puppy', 'chuồng chó'],
  description: 'A folding wire crate with a plastic floor tray, a cushioned pad inside, a front door with slide latches and a carry handle on top.',
  defaultSize: { w: 0.92, d: 0.6, h: 0.66 },
  minSize: { w: 0.6, d: 0.45, h: 0.5 },
  maxSize: { w: 1.22, d: 0.78, h: 0.86 },
  slots: [matSlot('mesh', 'Wire mesh', 'crate-mesh-black'), matSlot('wire', 'Frame & door', 'metal-black-matte'), matSlot('tray', 'Tray & handle', 'tray-black'), matSlot('pad', 'Pad', 'plush-grey')],
  build: (size) => {
    const { w, d, h } = size;
    const parts: Part[] = [
      span('tray', [-w / 2 + 0.01, w / 2 - 0.01], [0, 0.03], [-d / 2 + 0.01, d / 2 - 0.01], { bevel: 0.006, plan: true }),
      span('pad', [-w / 2 + 0.04, w / 2 - 0.04], [0.03, 0.08], [-d / 2 + 0.04, d / 2 - 0.04], { bevel: 0.02, plan: false }),
      ...wireBox('mesh', 'wire', w - 0.01, d - 0.01, 0.03, h - 0.03),
      rodX('tray', -0.08, 0.08, h - 0.015, 0, 0.01, o),
    ];
    // Door frame on the front with two latches.
    const dx = Math.min(0.28, w / 3);
    parts.push(
      rod('wire', [-dx, 0.06, d / 2 + 0.004], [-dx, h - 0.06, d / 2 + 0.004], 0.004, o),
      rod('wire', [dx, 0.06, d / 2 + 0.004], [dx, h - 0.06, d / 2 + 0.004], 0.004, o),
      rod('wire', [-dx, h - 0.06, d / 2 + 0.004], [dx, h - 0.06, d / 2 + 0.004], 0.004, o),
      span('tray', [dx - 0.02, dx + 0.02], [h * 0.3, h * 0.33], [d / 2, d / 2 + 0.008], o),
      span('tray', [dx - 0.02, dx + 0.02], [h * 0.7, h * 0.73], [d / 2, d / 2 + 0.008], o),
    );
    return keep(parts, size);
  },
});

const furnitureCrate = defineItem({
  ...common,
  id: 'dog-crate-end-table',
  name: 'Wooden dog crate end table',
  group: 'Dog beds & crates',
  tags: ['dog crate', 'end table', 'furniture crate', 'kennel', 'wooden', 'chuồng chó gỗ'],
  description: 'A dog crate that doubles as a side table: a solid wood top over spindle sides, a spindle door with a black latch and a cushion inside.',
  defaultSize: { w: 0.9, d: 0.6, h: 0.66 },
  minSize: { w: 0.6, d: 0.45, h: 0.5 },
  maxSize: { w: 1.2, d: 0.75, h: 0.82 },
  slots: [matSlot('wood', 'Frame & spindles', 'wood-walnut'), matSlot('top', 'Top', 'wood-oak-natural'), matSlot('metal', 'Latch & hinges', 'metal-black-matte'), matSlot('pad', 'Cushion', 'plush-grey')],
  build: (size) => {
    const { w, d, h } = size;
    const t = 0.03;
    const parts: Part[] = [
      span('top', [-w / 2, w / 2], [h - t, h], [-d / 2, d / 2], { bevel: 0.006 }),
      span('wood', [-w / 2 + 0.01, w / 2 - 0.01], [0, 0.04], [-d / 2 + 0.01, d / 2 - 0.01], o),
      span('pad', [-w / 2 + 0.05, w / 2 - 0.05], [0.04, 0.1], [-d / 2 + 0.05, d / 2 - 0.05], { bevel: 0.025, plan: false }),
    ];
    for (const [x, z] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ])
      parts.push(span('wood', [x * (w / 2 - 0.01) - 0.022, x * (w / 2 - 0.01) + 0.022].sort((a, b) => a - b) as V2, [0, h - t], [z * (d / 2 - 0.01) - 0.022, z * (d / 2 - 0.01) + 0.022].sort((a, b) => a - b) as V2, o));
    for (const x of cells(Math.round(w / 0.07), -w / 2 + 0.04, w / 2 - 0.04)) parts.push(vcyl('wood', x, -d / 2 + 0.012, 0.04, h - t, 0.009, o), vcyl('wood', x, d / 2 - 0.012, 0.04, h - t, 0.009, o));
    for (const z of cells(Math.round(d / 0.07), -d / 2 + 0.04, d / 2 - 0.04)) parts.push(vcyl('wood', -w / 2 + 0.012, z, 0.04, h - t, 0.009, o), vcyl('wood', w / 2 - 0.012, z, 0.04, h - t, 0.009, o));
    parts.push(span('wood', [-w / 2 + 0.03, w / 2 - 0.03], [h - t - 0.04, h - t], [d / 2 - 0.022, d / 2], o), span('metal', [w * 0.2, w * 0.2 + 0.05], [h * 0.45, h * 0.5], [d / 2, d / 2 + 0.01], o));
    return keep(parts, size);
  },
});

const raisedBowls = defineItem({
  ...common,
  id: 'raised-double-dog-bowl',
  name: 'Raised double dog bowl',
  group: 'Feeding & care',
  tags: ['dog bowl', 'raised feeder', 'food bowl', 'water bowl', 'elevated', 'bát ăn chó'],
  description: 'Two stainless bowls set into a raised bamboo stand, for food and water at a comfortable height.',
  defaultSize: { w: 0.48, d: 0.26, h: 0.2 },
  minSize: { w: 0.32, d: 0.18, h: 0.1 },
  maxSize: { w: 0.7, d: 0.36, h: 0.36 },
  slots: [matSlot('stand', 'Stand', 'wood-oak-natural'), matSlot('bowl', 'Bowls', 'steel-bowl'), matSlot('food', 'Food & water', 'nest-coconut')],
  build: (size) => {
    const { w, d, h } = size;
    const br = Math.min(d / 2 - 0.02, w / 4 - 0.02);
    const parts: Part[] = [span('stand', [-w / 2, w / 2], [h - 0.025, h - 0.005], [-d / 2, d / 2], { bevel: 0.006 })];
    for (const s of [-1, 1]) {
      parts.push(span('stand', [s * (w / 2 - 0.02) - 0.012, s * (w / 2 - 0.02) + 0.012].sort((a, b) => a - b) as V2, [0, h - 0.025], [-d / 2 + 0.01, d / 2 - 0.01], o));
      parts.push(cyl('bowl', [s * w * 0.24, h - 0.03, 0], br * 0.7, 0.06, { rTop: br, segments: 24, plan: false }), cyl('food', [s * w * 0.24, h - 0.012, 0], br * 0.88, 0.006, { segments: 24, plan: false }));
    }
    return keep(parts, size);
  },
});

const kennel = defineItem({
  ...common,
  id: 'outdoor-dog-house',
  name: 'Wooden dog house',
  group: 'Dog beds & crates',
  tags: ['dog house', 'kennel', 'outdoor', 'wooden', 'pitched roof', 'nhà chó'],
  description: 'An outdoor kennel of painted timber boards with a pitched roof, an arched doorway and a raised floor. For a balcony, terrace or garden.',
  defaultSize: { w: 0.8, d: 0.95, h: 0.82 },
  minSize: { w: 0.55, d: 0.65, h: 0.6 },
  maxSize: { w: 1.2, d: 1.3, h: 1.1 },
  slots: [matSlot('walls', 'Walls', 'wood-painted-white'), matSlot('roof', 'Roof', 'paint-charcoal'), matSlot('opening', 'Doorway', 'dark-hole')],
  build: (size) => {
    const { w, d, h } = size;
    const eave = h * 0.6;
    const parts: Part[] = [];
    // Gable walls as prisms in the XY plane, extruded through the depth by rotating them.
    const gable: V2[] = [
      [-w / 2 + 0.03, 0],
      [w / 2 - 0.03, 0],
      [w / 2 - 0.03, eave],
      [0, h - 0.04],
      [-w / 2 + 0.03, eave],
    ];
    const prismXY = (slot: string, pts: V2[], z0: number, t: number): Part => {
      const p = prism(slot, pts.map(([x, y]) => [x, -y] as V2), z0, t, o);
      return { ...p, rotation: [Math.PI / 2, 0, 0], position: [p.position[0], -p.position[2], p.position[1]] } as Part;
    };
    parts.push(prismXY('walls', gable, d / 2 - 0.03 - 0.02, 0.02), prismXY('walls', gable, -d / 2 + 0.03, 0.02));
    parts.push(span('walls', [-w / 2 + 0.03, -w / 2 + 0.05], [0, eave], [-d / 2 + 0.03, d / 2 - 0.03]), span('walls', [w / 2 - 0.05, w / 2 - 0.03], [0, eave], [-d / 2 + 0.03, d / 2 - 0.03]));
    const dw = w * 0.42;
    const dh = eave * 0.75;
    const arch: V2[] = [[-dw / 2, 0.04], [dw / 2, 0.04], [dw / 2, dh - dw / 2]];
    for (const i of range(9)) {
      const a = (i / 8) * Math.PI;
      arch.push([Math.cos(a) * (dw / 2), dh - dw / 2 + Math.sin(a) * (dw / 2)]);
    }
    arch.push([-dw / 2, dh - dw / 2]);
    parts.push(prismXY('opening', arch, d / 2 - 0.029, 0.004));
    // Roof: two sloping boards with an overhang.
    const run = w / 2;
    const rise = h - eave;
    const len = Math.hypot(run, rise) + 0.05;
    const ang = Math.atan2(rise, run);
    for (const s of [-1, 1]) {
      parts.push({ ...span('roof', [-len / 2, len / 2], [-0.012, 0.012], [-d / 2, d / 2], { bevel: 0.004 }), position: [(s * run) / 2, eave + rise / 2, 0], rotation: [0, 0, -s * ang] } as Part);
    }
    return keep(parts, size);
  },
});

const playpen = defineItem({
  ...common,
  id: 'pet-playpen-octagon',
  name: 'Octagonal pet play pen',
  group: 'Dog beds & crates',
  tags: ['playpen', 'puppy pen', 'exercise pen', 'pet fence', 'quây chó'],
  description: 'Eight black metal panels in an octagon to give a puppy or rabbit a safe area to play; fold flat when not in use.',
  defaultSize: { w: 1.5, d: 1.5, h: 0.62 },
  minSize: { w: 0.9, d: 0.9, h: 0.5 },
  maxSize: { w: 2.2, d: 2.2, h: 1.0 },
  slots: [matSlot('frame', 'Panels', 'metal-black-matte')],
  build: (size) => {
    const { w, d, h } = size;
    const parts: Part[] = [];
    const pts = range(8).map((i) => {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      return [(Math.cos(a) * w) / 2 / Math.cos(Math.PI / 8), (Math.sin(a) * d) / 2 / Math.cos(Math.PI / 8)] as V2;
    });
    const sc = Math.cos(Math.PI / 8) * 0.985;
    for (const i of range(8)) {
      const a = pts[i].map((v) => v * sc) as V2;
      const b = pts[(i + 1) % 8].map((v) => v * sc) as V2;
      parts.push(rod('frame', [a[0], 0.01, a[1]], [b[0], 0.01, b[1]], 0.006, { plan: true }), rod('frame', [a[0], h - 0.01, a[1]], [b[0], h - 0.01, b[1]], 0.006, o), rod('frame', [a[0], 0, a[1]], [a[0], h, a[1]], 0.008, o));
      for (const t of [0.2, 0.4, 0.6, 0.8]) {
        const x = a[0] + (b[0] - a[0]) * t;
        const z = a[1] + (b[1] - a[1]) * t;
        parts.push(rod('frame', [x, 0.01, z], [x, h - 0.01, z], 0.003, o));
      }
    }
    return keep(parts, size);
  },
});

const petGate = defineItem({
  ...common,
  id: 'pet-gate-pressure',
  name: 'Pressure-fit pet gate',
  group: 'Dog beds & crates',
  tags: ['pet gate', 'baby gate', 'stair gate', 'doorway', 'dog gate', 'cửa chắn'],
  description: 'A white metal gate wedged into a doorway or at the stairs, with a walk-through door that swings both ways and a small cat flap.',
  defaultSize: { w: 0.8, d: 0.06, h: 0.76 },
  minSize: { w: 0.7, d: 0.04, h: 0.6 },
  maxSize: { w: 1.1, d: 0.1, h: 1.0 },
  slots: [matSlot('frame', 'Frame', 'metal-white-powder'), matSlot('base', 'Pads & latch', 'white-plastic')],
  build: (size) => {
    const { w, h } = size;
    const parts: Part[] = [
      rodX('frame', -w / 2, w / 2, 0.02, 0, 0.01, { plan: true }),
      rodX('frame', -w / 2, w / 2, h - 0.02, 0, 0.01, o),
      vcyl('frame', -w / 2 + 0.01, 0, 0, h, 0.01, o),
      vcyl('frame', w / 2 - 0.01, 0, 0, h, 0.01, o),
      vcyl('frame', -w * 0.18, 0, 0.02, h - 0.02, 0.008, o),
      vcyl('frame', w * 0.32, 0, 0.02, h - 0.02, 0.008, o),
    ];
    for (const x of cells(Math.round(w / 0.065), -w / 2 + 0.02, w / 2 - 0.02)) parts.push(vcyl('frame', x, 0, 0.03, h - 0.03, 0.004, o));
    for (const s of [-1, 1]) for (const y of [0.12, h - 0.12]) parts.push(cyl('base', [s * (w / 2 - 0.012), y, 0], 0.022, 0.024, { rotation: [0, 0, Math.PI / 2], plan: false }));
    parts.push(span('base', [w * 0.3, w * 0.36], [h - 0.12, h - 0.04], [-0.02, 0.02], { bevel: 0.006, plan: false }));
    return keep(parts, size);
  },
});

const toyBasket = defineItem({
  ...common,
  id: 'dog-toy-basket',
  name: 'Dog toy basket',
  group: 'Feeding & care',
  tags: ['toy basket', 'dog toys', 'ball', 'rope toy', 'storage', 'đồ chơi chó'],
  description: 'A woven basket of dog toys: a tennis ball, a rope tug, a plush bone and a rubber ring spilling over the rim.',
  defaultSize: { w: 0.4, d: 0.3, h: 0.3 },
  minSize: { w: 0.3, d: 0.22, h: 0.2 },
  maxSize: { w: 0.55, d: 0.4, h: 0.4 },
  slots: [matSlot('basket', 'Basket', 'nest-coconut'), matSlot('toys', 'Toys', 'toy-red'), matSlot('ball', 'Ball & rope', 'lovebird-yellow')],
  build: (size) => {
    const { w, d, h } = size;
    const bh = h * 0.72;
    return keep(
      [
        span('basket', [-w / 2, w / 2], [0, bh], [-d / 2, d / 2], { bevel: 0.03 }),
        sphere('ball', [-w * 0.18, bh + 0.02, 0.0], 0.033, o),
        rod('ball', [-0.02, bh + 0.03, -d * 0.2], [w * 0.3, bh + 0.08, d * 0.15], 0.014, o),
        sphere('ball', [w * 0.3, bh + 0.08, d * 0.15], 0.024, o),
        rod('toys', [w * 0.05, bh, d * 0.15], [w * 0.2, bh + 0.09, -d * 0.1], 0.02, o),
        sphere('toys', [w * 0.05, bh, d * 0.15], 0.028, o),
        sphere('toys', [w * 0.2, bh + 0.09, -d * 0.1], 0.028, o),
        torus('toys', [-w * 0.3, bh + 0.035, d * 0.25], 0.045, 0.014, { rotation: [1.1, 0, 0.2], plan: false }),
      ],
      size,
    );
  },
});

// ───────────────────────── Cats ─────────────────────────

const catTree = defineItem({
  ...common,
  id: 'cat-tree-tall',
  name: 'Tall cat tree with condo & hammock',
  group: 'Cat furniture',
  tags: ['cat tree', 'cat tower', 'scratching post', 'condo', 'hammock', 'nhà cây cho mèo'],
  description: 'A floor-to-perch cat tree: sisal scratching posts, three plush platforms, a cube condo with a round entrance, a hammock and a top bed with a rim, and a dangling pom-pom.',
  defaultSize: { w: 0.6, d: 0.5, h: 1.6 },
  minSize: { w: 0.45, d: 0.4, h: 1.0 },
  maxSize: { w: 0.9, d: 0.7, h: 2.2 },
  slots: [matSlot('plush', 'Plush', 'plush-grey'), matSlot('sisal', 'Sisal posts', 'sisal'), matSlot('opening', 'Condo opening', 'dark-hole'), matSlot('toy', 'Pom-pom', 'toy-red')],
  build: (size) => {
    const { w, d, h } = size;
    const k = h / 1.6;
    const parts: Part[] = [span('plush', [-w / 2, w / 2], [0, 0.04], [-d / 2, d / 2], { bevel: 0.01 })];
    const post = (x: number, z: number, y0: number, y1: number) => parts.push(vcyl('sisal', x, z, y0, y1, 0.045, o));
    // Condo cube bottom-left.
    const cw = Math.min(0.36, w * 0.6);
    parts.push(span('plush', [-w / 2 + 0.02, -w / 2 + 0.02 + cw], [0.04, 0.04 + cw], [-d / 2 + 0.02, -d / 2 + 0.02 + cw], { bevel: 0.015, plan: false }));
    parts.push(discZ('opening', [-w / 2 + 0.02 + cw / 2, 0.04 + cw / 2, -d / 2 + 0.02 + cw + 0.002], cw * 0.3, 0.004, o));
    post(w / 2 - 0.08, d / 2 - 0.1, 0.04, 0.62 * k);
    post(-w / 2 + 0.08, -d / 2 + 0.1, 0.04 + cw, 1.05 * k);
    post(w / 2 - 0.1, -d / 2 + 0.12, 0.62 * k, 1.42 * k);
    // Platforms.
    parts.push(cyl('plush', [w / 2 - 0.18, 0.64 * k, 0.02], 0.2, 0.03, { segments: 28, scale: [1, 1, 0.9], plan: false }));
    parts.push(span('plush', [-w / 2 + 0.02, 0.05], [1.05 * k, 1.08 * k], [-d / 2 + 0.02, d / 2 - 0.1], { bevel: 0.012, plan: false }));
    // Hammock under the right platform.
    parts.push(torus('plush', [w / 2 - 0.18, 0.45 * k, 0.02], 0.13, 0.012, { rotation: [Math.PI / 2, 0, 0], plan: false }), sphere('plush', [w / 2 - 0.18, 0.43 * k, 0.02], 0.13, { scale: [1, 0.22, 0.9], plan: false }));
    // Top bed with a rim.
    parts.push(cyl('plush', [w / 2 - 0.22, 1.44 * k, -0.02], 0.2, 0.04, { segments: 28, plan: false }), torus('plush', [w / 2 - 0.22, 1.49 * k, -0.02], 0.18, 0.035, { rotation: [Math.PI / 2, 0, 0], plan: false }));
    parts.push(vcyl('sisal', -0.12, d / 2 - 0.22, 0.8 * k, 1.05 * k, 0.003, o), sphere('toy', [-0.12, 0.79 * k, d / 2 - 0.22], 0.025, o));
    return keep(parts, size);
  },
});

const scratchPost = defineItem({
  ...common,
  id: 'cat-scratching-post',
  name: 'Sisal scratching post',
  group: 'Cat furniture',
  tags: ['scratching post', 'sisal', 'cat', 'scratcher', 'trụ cào móng'],
  description: 'A tall sisal-wrapped post on a heavy plush base with a small top perch and a toy on a spring.',
  defaultSize: { w: 0.4, d: 0.4, h: 0.82 },
  minSize: { w: 0.3, d: 0.3, h: 0.5 },
  maxSize: { w: 0.55, d: 0.55, h: 1.2 },
  slots: [matSlot('plush', 'Plush', 'plush-cream'), matSlot('sisal', 'Sisal', 'sisal'), matSlot('toy', 'Toy', 'toy-red')],
  build: (size) => {
    const { w, d, h } = size;
    return keep(
      [
        span('plush', [-w / 2, w / 2], [0, 0.045], [-d / 2, d / 2], { bevel: 0.012 }),
        vcyl('sisal', 0, 0, 0.045, h - 0.035, 0.05, o),
        span('plush', [-w * 0.32, w * 0.32], [h - 0.035, h], [-d * 0.32, d * 0.32], { bevel: 0.01, plan: false }),
        rod('toy', [w * 0.2, 0.045, d * 0.2], [w * 0.3, 0.25, d * 0.3], 0.003, o),
        sphere('toy', [w * 0.3, 0.26, d * 0.3], 0.025, o),
      ],
      size,
    );
  },
});

const litterBox = defineItem({
  ...common,
  id: 'cat-litter-box-hooded',
  name: 'Hooded cat litter box',
  group: 'Cat furniture',
  tags: ['litter box', 'litter tray', 'hooded', 'cat toilet', 'khay vệ sinh mèo'],
  description: 'A covered litter tray with a swinging door flap, a carbon filter vent on top and a carry handle; keeps litter and smells in.',
  defaultSize: { w: 0.55, d: 0.42, h: 0.42 },
  minSize: { w: 0.42, d: 0.34, h: 0.32 },
  maxSize: { w: 0.7, d: 0.55, h: 0.55 },
  slots: [matSlot('body', 'Hood', 'white-plastic'), matSlot('tray', 'Tray', 'canvas-olive'), matSlot('flap', 'Door flap', 'dark-hole')],
  build: (size) => {
    const { w, d, h } = size;
    const th = h * 0.32;
    return keep(
      [
        span('tray', [-w / 2, w / 2], [0, th], [-d / 2, d / 2], { bevel: 0.02 }),
        span('body', [-w / 2 + 0.01, w / 2 - 0.01], [th - 0.01, h - 0.05], [-d / 2 + 0.01, d / 2 - 0.01], { bevel: 0.05, plan: false }),
        span('body', [-w * 0.3, w * 0.3], [h - 0.06, h], [-d * 0.25, d * 0.25], { bevel: 0.03, plan: false }),
        span('flap', [-w * 0.18, w * 0.18], [th + 0.01, th + (h - th) * 0.62], [d / 2 - 0.012, d / 2 - 0.006], { bevel: 0.03, plan: false }),
      ],
      size,
    );
  },
});

const litterCabinet = defineItem({
  ...common,
  id: 'cat-litter-cabinet',
  name: 'Cat litter cabinet',
  group: 'Cat furniture',
  tags: ['litter cabinet', 'litter box furniture', 'cat', 'hidden litter', 'tủ vệ sinh mèo'],
  description: 'A low wooden cabinet that hides the litter box: two doors at the front, a round cat entrance in the side and a top to use as a bench or shelf.',
  defaultSize: { w: 0.9, d: 0.5, h: 0.6 },
  minSize: { w: 0.6, d: 0.4, h: 0.45 },
  maxSize: { w: 1.2, d: 0.6, h: 0.8 },
  slots: [matSlot('body', 'Cabinet', 'wood-oak-light'), matSlot('doors', 'Doors', 'paint-pure-white'), matSlot('metal', 'Knobs & legs', 'metal-black-matte'), matSlot('opening', 'Cat entrance', 'dark-hole')],
  build: (size) => {
    const { w, d, h } = size;
    const leg = 0.08;
    const parts: Part[] = [span('body', [-w / 2, w / 2], [leg, h], [-d / 2, d / 2], { bevel: 0.006 })];
    for (const [x, z] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ])
      parts.push(vcyl('metal', x * (w / 2 - 0.04), z * (d / 2 - 0.04), 0, leg, 0.012, o));
    for (const s of [-1, 1]) {
      parts.push(span('doors', s < 0 ? [-w / 2 + 0.015, -0.004] : [0.004, w / 2 - 0.015], [leg + 0.015, h - 0.015], [d / 2 + 0.001, d / 2 + 0.012], { bevel: 0.003, plan: false }));
      parts.push(sphere('metal', [s * 0.04, (leg + h) / 2, d / 2 + 0.02], 0.01, o));
    }
    parts.push(cyl('opening', [w / 2 + 0.001, leg + (h - leg) * 0.42, 0], Math.min(0.1, (h - leg) * 0.3), 0.004, { rotation: [0, 0, Math.PI / 2], segments: 24, plan: false }));
    return keep(parts, size);
  },
});

const wallSteps = defineItem({
  ...common,
  id: 'cat-wall-steps',
  name: 'Cat wall steps & bed',
  group: 'Cat furniture',
  tags: ['cat shelves', 'wall steps', 'cat climbing', 'wall mounted', 'kệ mèo leo'],
  description: 'Wall-mounted oak steps that climb diagonally to a cushioned bed with a low rim, giving cats a route along the wall.',
  defaultSize: { w: 1.4, d: 0.32, h: 1.2 },
  minSize: { w: 0.9, d: 0.25, h: 0.8 },
  maxSize: { w: 2.2, d: 0.4, h: 1.8 },
  mount: 'wall',
  defaultElevation: 0.6,
  slots: [matSlot('wood', 'Steps', 'wood-oak-light'), matSlot('cushion', 'Cushion', 'plush-grey'), matSlot('metal', 'Brackets', 'metal-black-matte')],
  build: (size) => {
    const { w, d, h } = size;
    const parts: Part[] = [];
    const n = 4;
    for (const i of range(n)) {
      const x = -w / 2 + 0.16 + (i * (w - 0.7)) / (n - 1);
      const y = (i * (h - 0.25)) / (n - 1) + 0.02;
      parts.push(span('wood', [x - 0.15, x + 0.15], [y, y + 0.025], [-d / 2, -d / 2 + d * 0.8], { bevel: 0.004, plan: i === 0 }), span('metal', [x - 0.01, x + 0.01], [y - 0.06, y], [-d / 2, -d / 2 + 0.012], o));
    }
    const bx = w / 2 - 0.25;
    const by = h - 0.18;
    parts.push(span('wood', [bx - 0.24, bx + 0.24], [by, by + 0.025], [-d / 2, d / 2], { bevel: 0.004 }), span('wood', [bx - 0.24, bx + 0.24], [by, by + 0.1], [d / 2 - 0.015, d / 2], o), span('cushion', [bx - 0.22, bx + 0.22], [by + 0.025, by + 0.08], [-d / 2 + 0.01, d / 2 - 0.02], { bevel: 0.02, plan: false }));
    return keep(parts, size);
  },
});

const caveBed = defineItem({
  ...common,
  id: 'cat-felt-cave',
  name: 'Felt cat cave',
  group: 'Cat furniture',
  tags: ['cat cave', 'felt bed', 'cat bed', 'hideaway', 'wool', 'ổ mèo'],
  description: 'A hand-felted wool cave with a round entrance and a flat cushion inside; cats love to hide in it.',
  defaultSize: { w: 0.45, d: 0.45, h: 0.3 },
  minSize: { w: 0.35, d: 0.35, h: 0.22 },
  maxSize: { w: 0.6, d: 0.6, h: 0.4 },
  slots: [matSlot('felt', 'Felt', 'felt-charcoal'), matSlot('opening', 'Entrance', 'dark-hole')],
  build: (size) => {
    const { w, d, h } = size;
    return keep(
      [
        sphere('felt', [0, h / 2, 0], 0.5, { scale: [w, h, d], plan: true }),
        discZ('opening', [0, h * 0.42, d / 2 - 0.02], Math.min(w, h) * 0.3, 0.02, o),
      ],
      size,
    );
  },
});

const windowPerch = defineItem({
  ...common,
  id: 'cat-window-perch',
  name: 'Cat window perch',
  group: 'Cat furniture',
  tags: ['window perch', 'cat hammock', 'window seat', 'cat bed', 'võng mèo'],
  description: 'A sling hammock bed that hangs below a window sill (or on the wall) on a black steel frame, so the cat can watch outside.',
  defaultSize: { w: 0.55, d: 0.32, h: 0.16 },
  minSize: { w: 0.45, d: 0.25, h: 0.1 },
  maxSize: { w: 0.75, d: 0.4, h: 0.22 },
  mount: 'wall',
  defaultElevation: 0.85,
  slots: [matSlot('fabric', 'Sling', 'plush-cream'), matSlot('frame', 'Frame', 'metal-black-matte')],
  build: (size) => {
    const { w, d, h } = size;
    return keep(
      [
        rodX('frame', -w / 2 + 0.01, w / 2 - 0.01, h - 0.012, d / 2 - 0.012, 0.008, { plan: true }),
        rodZ('frame', -w / 2 + 0.012, h - 0.012, -d / 2, d / 2 - 0.012, 0.008, o),
        rodZ('frame', w / 2 - 0.012, h - 0.012, -d / 2, d / 2 - 0.012, 0.008, o),
        sphere('fabric', [0, h * 0.55, 0], 0.5, { scale: [w - 0.04, h * 0.8, d - 0.04] }),
      ],
      size,
    );
  },
});

const fountain = defineItem({
  ...common,
  id: 'pet-water-fountain',
  name: 'Pet water fountain',
  group: 'Feeding & care',
  tags: ['water fountain', 'drinking fountain', 'cat', 'dog', 'filter', 'máy lọc nước'],
  description: 'A filtered drinking fountain with a ceramic bowl and a gentle flowing spout that keeps water fresh and tempts cats to drink.',
  defaultSize: { w: 0.22, d: 0.22, h: 0.18 },
  minSize: { w: 0.16, d: 0.16, h: 0.12 },
  maxSize: { w: 0.32, d: 0.32, h: 0.26 },
  slots: [matSlot('body', 'Bowl', 'white-plastic'), matSlot('water', 'Water', 'water-glass-pet')],
  build: (size) => {
    const { w, d, h } = size;
    const r = Math.min(w, d) / 2;
    return keep(
      [
        lathe('body', [0, 0, 0], [[0, 0], [r * 0.85, 0], [r, h * 0.45], [r * 0.95, h * 0.5], [0, h * 0.5]], { plan: true }),
        cyl('water', [0, h * 0.49, 0], r * 0.9, 0.004, { segments: 28, plan: false }),
        cyl('body', [0, h * 0.7, 0], r * 0.35, h * 0.4, { rTop: r * 0.18, segments: 20, plan: false }),
        cyl('water', [0, h * 0.95, 0], r * 0.15, h * 0.08, { rTop: r * 0.2, segments: 16, plan: false }),
      ],
      size,
    );
  },
});

const catBowls = defineItem({
  ...common,
  id: 'cat-bowls-tilted',
  name: 'Tilted cat bowls on stand',
  group: 'Feeding & care',
  tags: ['cat bowl', 'food bowl', 'tilted', 'ceramic', 'stand', 'bát ăn mèo'],
  description: 'Two shallow ceramic bowls tilted on a small wooden stand: easier on whiskers and necks, one for food, one for water.',
  defaultSize: { w: 0.32, d: 0.16, h: 0.12 },
  minSize: { w: 0.24, d: 0.12, h: 0.08 },
  maxSize: { w: 0.45, d: 0.22, h: 0.18 },
  slots: [matSlot('stand', 'Stand', 'wood-walnut'), matSlot('bowl', 'Bowls', 'white-plastic'), matSlot('food', 'Food & water', 'nest-coconut')],
  build: (size) => {
    const { w, d, h } = size;
    const br = Math.min(d / 2 - 0.01, w / 4 - 0.01);
    const parts: Part[] = [span('stand', [-w / 2, w / 2], [0, h * 0.45], [-d / 2, d / 2], { bevel: 0.01, rotation: [0.15, 0, 0] })];
    for (const s of [-1, 1]) parts.push(cyl('bowl', [s * w * 0.24, h * 0.7, 0], br * 0.6, h * 0.4, { rTop: br, segments: 24, rotation: [0.25, 0, 0], plan: false }), cyl('food', [s * w * 0.24, h * 0.86, 0.01], br * 0.8, 0.005, { segments: 24, rotation: [0.25, 0, 0], plan: false }));
    return keep(parts, size);
  },
});

const carrier = defineItem({
  ...common,
  id: 'pet-carrier',
  name: 'Pet carrier',
  group: 'Feeding & care',
  tags: ['pet carrier', 'cat carrier', 'travel crate', 'vet', 'lồng vận chuyển'],
  description: 'A hard-shell carrier for cats and small dogs with a steel grille door, side air vents and a top handle; for vet visits and travel.',
  defaultSize: { w: 0.48, d: 0.32, h: 0.3 },
  minSize: { w: 0.4, d: 0.28, h: 0.26 },
  maxSize: { w: 0.7, d: 0.48, h: 0.5 },
  slots: [matSlot('shell', 'Shell', 'paint-sage'), matSlot('base', 'Base', 'white-plastic'), matSlot('grille', 'Door grille', 'metal-chrome')],
  build: (size) => {
    const { w, d, h } = size;
    const parts: Part[] = [
      span('base', [-w / 2, w / 2], [0, h * 0.45], [-d / 2, d / 2], { bevel: 0.025 }),
      span('shell', [-w / 2 + 0.005, w / 2 - 0.005], [h * 0.42, h - 0.04], [-d / 2 + 0.005, d / 2 - 0.005], { bevel: 0.05, plan: false }),
      rodX('shell', -0.07, 0.07, h - 0.02, 0, 0.012, o),
    ];
    for (const x of cells(6, -w * 0.18, w * 0.18)) parts.push(rod('grille', [x, h * 0.12, d / 2 + 0.002], [x, h * 0.78, d / 2 + 0.002], 0.0025, o));
    for (const y of [h * 0.12, h * 0.45, h * 0.78]) parts.push(rodX('grille', -w * 0.2, w * 0.2, y, d / 2 + 0.002, 0.003, o));
    return keep(parts, size);
  },
});

const sleepingCat = defineItem({
  ...common,
  id: 'sleeping-cat',
  name: 'Sleeping cat',
  group: 'Pet birds & animals',
  tags: ['cat', 'sleeping cat', 'kitten', 'pet', 'mèo'],
  description: 'A cat curled up asleep with its tail wrapped round, about 45 cm long. Put it on a bed, a sofa or a cat tree; fur colours as variants.',
  defaultSize: { w: 0.45, d: 0.36, h: 0.16 },
  minSize: { w: 0.3, d: 0.24, h: 0.1 },
  maxSize: { w: 0.6, d: 0.48, h: 0.22 },
  slots: [matSlot('fur', 'Fur', 'cat-ginger'), matSlot('accent', 'Nose & inner ears', 'cat-pink')],
  variants: [
    { id: 'grey-tabby', name: 'Grey', materials: { fur: 'cat-grey' } },
    { id: 'black', name: 'Black', materials: { fur: 'cat-black' } },
    { id: 'white', name: 'White', materials: { fur: 'cat-white' } },
  ],
  build: (size) => {
    const { w, d, h } = size;
    const k = w / 0.45;
    const parts: Part[] = [
      sphere('fur', [-0.03 * k, h * 0.42, -0.02 * k], 0.5, { scale: [w * 0.82, h * 0.85, d * 0.8], plan: true }),
      sphere('fur', [0.14 * k, h * 0.5, 0.07 * k], 0.07 * k, { scale: [1.1, 0.9, 1], plan: false }),
      cyl('fur', [0.11 * k, h * 0.85, 0.06 * k], 0.022 * k, 0.04 * k, { rTop: 0.002, rotation: [0, 0, 0.35], segments: 8, plan: false }),
      cyl('fur', [0.17 * k, h * 0.84, 0.11 * k], 0.022 * k, 0.04 * k, { rTop: 0.002, rotation: [0.35, 0, -0.2], segments: 8, plan: false }),
      sphere('accent', [0.19 * k, h * 0.46, 0.14 * k], 0.008 * k, o),
      torus('fur', [-0.02 * k, h * 0.18, 0.02 * k], 0.17 * k, 0.022 * k, { rotation: [Math.PI / 2, 0, 0.3], arc: Math.PI * 1.1, scale: [1, 0.85, 1], plan: false }),
    ];
    return keep(parts, size);
  },
});

materials.push({ id: 'water-glass-pet', name: 'Fountain water', category: 'glass', color: '#cfe8f2', roughness: 0.05, opacity: 0.6 });

const items: PackItem[] = [
  cage,
  cageWide,
  domeCage,
  playStand,
  lovebird,
  donutBed,
  bolsterBed,
  wireCrate,
  furnitureCrate,
  kennel,
  playpen,
  petGate,
  raisedBowls,
  toyBasket,
  catTree,
  scratchPost,
  litterBox,
  litterCabinet,
  wallSteps,
  caveBed,
  windowPerch,
  fountain,
  catBowls,
  carrier,
  sleepingCat,
];

export default definePack({
  name: 'Pets',
  version: '1.0.0',
  author: 'Neest',
  description: 'Cages, beds, crates, cat trees, bowls and more for birds, dogs and cats, plus lovebirds and a sleeping cat.',
  license: 'CC0-1.0',
  patterns,
  materials,
  items,
});

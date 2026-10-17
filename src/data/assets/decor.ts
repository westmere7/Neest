import type { AssetDefinition, Part } from './types';
import {
  box,
  cells,
  clamp,
  cyl,
  defineAsset,
  ellipsePoints,
  lathe,
  matSlot,
  poly,
  range,
  rectPoly,
  rod,
  rodX,
  span,
  sphere,
  vcyl,
} from './parts';

// ---------------------------------------------------------------------------
// Soft furnishings
// ---------------------------------------------------------------------------

const rugRect = defineAsset({
  id: 'rug-rect',
  name: 'Rectangular rug',
  category: 'decor',
  tags: ['rug', 'carpet', 'mat', 'runner', 'textile'],
  defaultSize: { w: 2.0, d: 1.4, h: 0.01 },
  minSize: { w: 0.6, d: 0.4, h: 0.005 },
  maxSize: { w: 5.0, d: 4.0, h: 0.04 },
  slots: [matSlot('rug', 'Rug', 'rug-berber')],
  build: ({ w, d, h }) => {
    const fr = Math.min(0.05, w * 0.04);
    return [
      span('rug', [-w / 2 + fr, w / 2 - fr], [0, h], [-d / 2, d / 2]),
      span('rug', [-w / 2, -w / 2 + fr], [0, h * 0.5], [-d / 2 + 0.02, d / 2 - 0.02]),
      span('rug', [w / 2 - fr, w / 2], [0, h * 0.5], [-d / 2 + 0.02, d / 2 - 0.02]),
    ];
  },
  planDetail: ({ w, d }) => {
    const fr = Math.min(0.05, w * 0.04);
    const b = Math.min(0.1, d * 0.08);
    return [rectPoly(-w / 2 + fr + b, -d / 2 + b, w / 2 - fr - b, d / 2 - b)];
  },
});

const rugRound = defineAsset({
  id: 'rug-round',
  name: 'Round rug',
  category: 'decor',
  tags: ['rug', 'carpet', 'round', 'circular', 'mat'],
  defaultSize: { w: 1.6, d: 1.6, h: 0.01 },
  minSize: { w: 0.6, d: 0.6, h: 0.005 },
  maxSize: { w: 4.0, d: 4.0, h: 0.04 },
  slots: [matSlot('rug', 'Rug', 'rug-jute')],
  build: ({ w, d, h }) => [cyl('rug', [0, h / 2, 0], w / 2, h, { scale: [1, 1, d / w], segments: 64 })],
  planDetail: ({ w, d }) => {
    const b = Math.min(0.1, Math.min(w, d) * 0.06);
    return [poly(ellipsePoints(0, 0, w / 2 - b, d / 2 - b, 48))];
  },
});

const curtains = defineAsset({
  id: 'curtains',
  name: 'Curtains (pair)',
  category: 'decor',
  tags: ['curtains', 'drapes', 'window', 'textile', 'blinds'],
  defaultSize: { w: 2.4, d: 0.18, h: 2.55 },
  minSize: { w: 0.8, d: 0.12, h: 1.2 },
  maxSize: { w: 5.0, d: 0.3, h: 3.2 },
  mount: 'wall',
  defaultElevation: 0.03,
  slots: [matSlot('fabric', 'Fabric', 'fabric-linen'), matSlot('rod', 'Rod', 'metal-black-matte')],
  build: ({ w, d, h }) => {
    const pw = clamp(w * 0.22, 0.25, 0.9);
    const n = clamp(Math.round(pw / 0.08), 3, 8);
    const rp = (pw / n / 2) * 1.15;
    const wave = 0.012;
    const sz = Math.min(1.6, (d / 2 - wave - 0.02) / rp);
    const yRod = h - 0.025;
    const parts: Part[] = [
      rodX('rod', -w / 2 + 0.03, w / 2 - 0.03, yRod, 0, 0.012),
      sphere('rod', [-w / 2 + 0.025, yRod, 0], 0.025, { plan: false }),
      sphere('rod', [w / 2 - 0.025, yRod, 0], 0.025, { plan: false }),
    ];
    for (const bx of [-w / 2 + 0.15, w / 2 - 0.15]) {
      parts.push(span('rod', [bx - 0.01, bx + 0.01], [h - 0.04, h - 0.01], [-d / 2, 0], { plan: false }));
    }
    // Two gathered panels drawn open at the sides; each pleat is a flattened cylinder.
    for (const x0 of [-w / 2 + 0.04, w / 2 - 0.04 - pw]) {
      cells(n, x0, x0 + pw).forEach((x, i) => {
        parts.push(
          vcyl('fabric', x, i % 2 === 0 ? -wave : wave, 0.01, h - 0.03, rp, {
            scale: [1, 1, sz],
            segments: 16,
          }),
        );
      });
    }
    return parts;
  },
});

const cushion = defineAsset({
  id: 'cushion',
  name: 'Throw cushion',
  category: 'decor',
  tags: ['cushion', 'pillow', 'throw pillow', 'textile', 'scatter'],
  defaultSize: { w: 0.45, d: 0.16, h: 0.45 },
  minSize: { w: 0.25, d: 0.08, h: 0.25 },
  maxSize: { w: 0.8, d: 0.3, h: 0.8 },
  // Rests on a sofa seat by default.
  defaultElevation: 0.42,
  slots: [matSlot('fabric', 'Fabric', 'fabric-mustard')],
  build: ({ w, d, h }) => [
    sphere('fabric', [0, h / 2, 0], 0.5, { scale: [w, h, d] }),
    box('fabric', [0, h / 2, 0], [w * 0.88, h * 0.88, d * 0.5], { bevel: 0.02 }),
  ],
});

const throwBlanket = defineAsset({
  id: 'throw-blanket',
  name: 'Folded throw blanket',
  category: 'decor',
  tags: ['throw', 'blanket', 'plaid', 'textile', 'folded'],
  defaultSize: { w: 0.5, d: 0.35, h: 0.08 },
  minSize: { w: 0.25, d: 0.2, h: 0.02 },
  maxSize: { w: 1.2, d: 0.8, h: 0.2 },
  slots: [matSlot('fabric', 'Fabric', 'fabric-wool-grey')],
  build: ({ w, d, h }) => {
    const lh = h / 4;
    return range(4).map((i) => {
      const off = i % 2 === 0 ? -0.008 : 0.008;
      return span(
        'fabric',
        [-w / 2 + 0.008 + off, w / 2 - 0.008 + off],
        [i * lh, (i + 1) * lh - 0.001],
        [-d / 2, d / 2],
        {
          bevel: Math.min(0.01, lh * 0.4),
        },
      );
    });
  },
});

// ---------------------------------------------------------------------------
// Plants
// ---------------------------------------------------------------------------

/** Foliage blob: u/v ∈ [-1, 1] across the free footprint, y ∈ [0, 1] up the band, s = size fraction. */
interface Blob {
  u: number;
  v: number;
  y: number;
  s: number;
}

function foliage(slot: string, w: number, d: number, yLo: number, yHi: number, blobs: Blob[]): Part[] {
  const m = Math.min(w, d) / 2;
  return blobs.map((b) => {
    const r = b.s * m;
    const ry = Math.min(r, (yHi - yLo) / 2);
    const y = clamp(yLo + b.y * (yHi - yLo), yLo + ry, yHi - ry);
    return sphere(slot, [b.u * (w / 2 - r), y, b.v * (d / 2 - r)], r, { scale: [1, ry / r, 1] });
  });
}

const plantPotted = defineAsset({
  id: 'plant-potted',
  name: 'Potted plant',
  category: 'decor',
  tags: ['plant', 'pot', 'greenery', 'houseplant', 'bush'],
  defaultSize: { w: 0.45, d: 0.45, h: 0.9 },
  minSize: { w: 0.2, d: 0.2, h: 0.3 },
  maxSize: { w: 1.0, d: 1.0, h: 1.6 },
  slots: [
    matSlot('pot', 'Pot', 'ceramic-white'),
    matSlot('leaf', 'Foliage', 'plant-leaf'),
    matSlot('soil', 'Soil', 'plant-soil'),
  ],
  build: ({ w, d, h }) => {
    const potR = (Math.min(w, d) / 2) * 0.62;
    const potH = clamp(h * 0.32, 0.1, 0.4);
    return [
      lathe(
        'pot',
        [0, 0, 0],
        [
          [0, 0],
          [potR * 0.78, 0],
          [potR * 0.98, potH * 0.9],
          [potR, potH],
          [potR * 0.93, potH],
        ],
        { segments: 32 },
      ),
      cyl('soil', [0, potH - 0.025, 0], potR * 0.92, 0.01, { plan: false }),
      ...foliage('leaf', w, d, potH - 0.03, h, [
        { u: 0, v: 0, y: 0.55, s: 0.75 },
        { u: 0.8, v: 0.3, y: 0.35, s: 0.5 },
        { u: -0.7, v: 0.5, y: 0.4, s: 0.48 },
        { u: -0.3, v: -0.8, y: 0.45, s: 0.5 },
        { u: 0.4, v: -0.6, y: 0.62, s: 0.45 },
        { u: 0.1, v: 0.1, y: 0.95, s: 0.45 },
      ]),
    ];
  },
});

const plantLarge = defineAsset({
  id: 'plant-large',
  name: 'Large floor plant',
  category: 'decor',
  tags: ['plant', 'tree', 'fiddle leaf', 'indoor tree', 'greenery'],
  defaultSize: { w: 0.8, d: 0.8, h: 1.8 },
  minSize: { w: 0.4, d: 0.4, h: 1.0 },
  maxSize: { w: 1.5, d: 1.5, h: 2.6 },
  slots: [
    matSlot('pot', 'Basket', 'rug-jute'),
    matSlot('leaf', 'Foliage', 'plant-leaf'),
    matSlot('trunk', 'Trunk', 'wood-dark-stain'),
    matSlot('soil', 'Soil', 'plant-soil'),
  ],
  build: ({ w, d, h }) => {
    const potR = (Math.min(w, d) / 2) * 0.45;
    const potH = clamp(h * 0.18, 0.2, 0.4);
    const yLo = h * 0.42;
    return [
      lathe(
        'pot',
        [0, 0, 0],
        [
          [0, 0],
          [potR * 0.85, 0],
          [potR, potH],
          [potR * 0.94, potH],
        ],
        { segments: 32 },
      ),
      cyl('soil', [0, potH - 0.02, 0], potR * 0.9, 0.01, { plan: false }),
      vcyl('trunk', 0, 0, potH - 0.05, h * 0.8, 0.025, { rTop: 0.015, plan: false }),
      rod('trunk', [0, h * 0.5, 0], [(w / 2) * 0.35, h * 0.62, (d / 2) * 0.15], 0.012, { plan: false }),
      rod('trunk', [0, h * 0.46, 0], [-(w / 2) * 0.35, h * 0.56, -(d / 2) * 0.15], 0.012, { plan: false }),
      ...foliage('leaf', w, d, yLo, h, [
        { u: 0, v: 0, y: 0.85, s: 0.55 },
        { u: 0.75, v: 0.25, y: 0.6, s: 0.45 },
        { u: -0.7, v: -0.3, y: 0.52, s: 0.45 },
        { u: 0.2, v: -0.8, y: 0.38, s: 0.4 },
        { u: -0.3, v: 0.75, y: 0.32, s: 0.42 },
        { u: 0.55, v: -0.5, y: 0.75, s: 0.38 },
        { u: -0.45, v: 0.3, y: 0.92, s: 0.36 },
      ]),
    ];
  },
});

// ---------------------------------------------------------------------------
// Accessories
// ---------------------------------------------------------------------------

const artwork = defineAsset({
  id: 'artwork-framed',
  name: 'Framed artwork',
  category: 'decor',
  tags: ['art', 'picture', 'frame', 'print', 'poster', 'painting'],
  defaultSize: { w: 0.7, d: 0.03, h: 0.5 },
  minSize: { w: 0.2, d: 0.02, h: 0.2 },
  maxSize: { w: 2.4, d: 0.08, h: 1.8 },
  mount: 'wall',
  defaultElevation: 1.3,
  slots: [
    matSlot('frame', 'Frame', 'wood-oak-light'),
    matSlot('mat', 'Mount', 'paint-pure-white'),
    matSlot('art', 'Artwork', 'paper-art'),
  ],
  build: ({ w, d, h }) => {
    const f = clamp(Math.min(w, h) * 0.05, 0.015, 0.05);
    const m = Math.min(w, h) * 0.08;
    return [
      span('frame', [-w / 2, w / 2], [h - f, h], [-d / 2, d / 2]),
      span('frame', [-w / 2, w / 2], [0, f], [-d / 2, d / 2]),
      span('frame', [-w / 2, -w / 2 + f], [f, h - f], [-d / 2, d / 2]),
      span('frame', [w / 2 - f, w / 2], [f, h - f], [-d / 2, d / 2]),
      span('mat', [-w / 2 + f, w / 2 - f], [f, h - f], [-d / 2, d / 2 - 0.008], { plan: false }),
      span('art', [-w / 2 + f + m, w / 2 - f - m], [f + m, h - f - m], [d / 2 - 0.008, d / 2 - 0.006], {
        plan: false,
      }),
    ];
  },
});

const vase = defineAsset({
  id: 'vase',
  name: 'Vase with stems',
  category: 'decor',
  tags: ['vase', 'flowers', 'stems', 'ceramic', 'centrepiece'],
  defaultSize: { w: 0.3, d: 0.3, h: 0.6 },
  minSize: { w: 0.1, d: 0.1, h: 0.15 },
  maxSize: { w: 0.6, d: 0.6, h: 1.2 },
  slots: [matSlot('vase', 'Vase', 'ceramic-white'), matSlot('stems', 'Stems', 'plant-leaf')],
  build: ({ w, d, h }) => {
    const m = Math.min(w, d) / 2;
    const R = m * 0.55;
    const vh = h * 0.5;
    const leafR = Math.min(m * 0.28, h / 6);
    const ry = leafR * 1.5;
    const parts: Part[] = [
      lathe(
        'vase',
        [0, 0, 0],
        [
          [0, 0],
          [R * 0.55, 0],
          [R * 0.9, vh * 0.2],
          [R, vh * 0.45],
          [R * 0.7, vh * 0.78],
          [R * 0.35, vh * 0.9],
          [R * 0.4, vh],
        ],
        { segments: 32 },
      ),
    ];
    const tips: [number, number, number][] = [
      [-0.55, 0.15, 0.93],
      [0.6, -0.2, 0.82],
      [0.05, 0.55, 1.0],
    ];
    for (const [u, v, fy] of tips) {
      const x = u * (w / 2 - leafR);
      const z = v * (d / 2 - leafR);
      const ty = clamp(fy * h, vh + ry, h - ry);
      parts.push(rod('stems', [0, vh * 0.7, 0], [x, ty - ry * 0.5, z], 0.004, { plan: false }));
      parts.push(sphere('stems', [x, ty, z], leafR, { scale: [1, 1.5, 1] }));
    }
    return parts;
  },
});

const books = defineAsset({
  id: 'books-stack',
  name: 'Stack of books',
  category: 'decor',
  tags: ['books', 'stack', 'coffee table books', 'reading', 'magazines'],
  defaultSize: { w: 0.3, d: 0.23, h: 0.14 },
  minSize: { w: 0.15, d: 0.12, h: 0.03 },
  maxSize: { w: 0.5, d: 0.4, h: 0.4 },
  slots: [matSlot('books', 'Books', 'book-mix')],
  build: ({ w, d, h }) => {
    const n = clamp(Math.round(h / 0.035), 1, 12);
    const t = h / n;
    const fw = [1, 0.9, 0.96, 0.85, 0.93, 0.88];
    const fd = [1, 0.92, 0.85, 0.95, 0.9, 0.97];
    const ang = [0, 0.09, -0.06, 0.14, -0.1, 0.05];
    return range(n).map((i) => {
      const a = ang[i % 6];
      const bw = w * fw[i % 6];
      const bd = d * fd[i % 6];
      const c = Math.abs(Math.cos(a));
      const s = Math.abs(Math.sin(a));
      // Shrink rotated books so their footprint stays inside the bounding box.
      const k = Math.min(1, w / (bw * c + bd * s), d / (bw * s + bd * c));
      return box('books', [0, t * (i + 0.5), 0], [bw * k, t - 0.001, bd * k], { rotation: [0, a, 0] });
    });
  },
});

export const DECOR_ASSETS: AssetDefinition[] = [
  rugRect,
  rugRound,
  curtains,
  plantPotted,
  plantLarge,
  artwork,
  vase,
  books,
  cushion,
  throwBlanket,
];

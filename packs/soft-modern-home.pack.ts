/**
 * Soft modern home — furniture from warm, curvy Vietnamese apartment interiors (oak, bouclé,
 * quartz, brass, reeded glass, LED coves): a curved sofa on a wooden plinth, a pill coffee table,
 * a floating TV console with a round pedestal end, a wavy island with an under-glow, an arched bar
 * and wine wall, a fluted pedestal table, arch-leg and cane-back chairs, a backlit wall niche,
 * butter-yellow rounded wall cabinets, a cream base run with oak trims, a cylinder hood, brass
 * saucer pendants, a pleated lamp, a wood-framed glass partition, glass blocks, wooden blinds and a
 * wide-blade ceiling fan.
 */
import {
  clamp,
  containParts,
  cyl,
  defineItem,
  definePack,
  ellipsePoints,
  lathe,
  matSlot,
  plantBox,
  prism,
  range,
  rod,
  roundRectPoints,
  span,
  sphere,
  torus,
  type PackMaterial,
  type Part,
  type Size3,
} from '@/packs/kit';

type V2 = [number, number];
const o = { plan: false };
const CEILING = 2.7;
const WARM = '#ffd9a8';
const keep = (parts: Part[], size: Size3) => containParts(parts, plantBox(size));

/**
 * A flat panel in the X/Y (front) plane: \`pts\` are [x, y] (y up), extruded from z0 to z0 + t
 * towards the front. For arched doors, rounded niches and rounded cabinet fronts.
 */
function panelXY(slot: string, pts: V2[], z0: number, t: number, plan = false): Part {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  return {
    shape: 'prism',
    outline: pts.map(([x, y]) => [x - cx, -(y - cy)] as V2),
    height: t,
    position: [cx, cy, z0],
    rotation: [Math.PI / 2, 0, 0],
    slot,
    plan,
  };
}

/** Rectangle with a semicircular (arched) top, as [x, y] points. */
function archPoints(x0: number, x1: number, y0: number, y1: number, n = 12): V2[] {
  const r = (x1 - x0) / 2;
  const cx = (x0 + x1) / 2;
  const top = y1 - r;
  const pts: V2[] = [
    [x0, y0],
    [x1, y0],
  ];
  for (const i of range(n + 1)) {
    const a = (i / n) * Math.PI;
    pts.push([cx + Math.cos(a) * r, top + Math.sin(a) * r]);
  }
  return pts;
}

/** Rounded rectangle as [x, y] points in the front plane. */
const roundRectXY = (cx: number, cy: number, w: number, h: number, r: number): V2[] => roundRectPoints(cx, cy, w, h, r, 5).map(([x, y]) => [x, y] as V2);

/** Stadium (pill) outline in plan. */
const stadium = (w: number, d: number): V2[] => roundRectPoints(0, 0, w, d, d / 2, 8);

// ───────────── Materials ─────────────

const materials: PackMaterial[] = [
  { id: 'butter-lacquer', name: 'Butter yellow lacquer', category: 'laminate', color: '#efd68e', roughness: 0.45 },
  { id: 'cream-lacquer', name: 'Cream lacquer', category: 'laminate', color: '#eee4d2', roughness: 0.5 },
  { id: 'reeded-glass', name: 'Reeded glass (ribbed)', category: 'glass', color: '#e6eeee', roughness: 0.25, opacity: 0.55, pattern: { id: 'fluted', scale: 0.025, contrast: 0.6 } },
  { id: 'warm-oak', name: 'Warm oak veneer', category: 'wood', color: '#c99a68', roughness: 0.55, pattern: { id: 'wood-grain', scale: 0.7, contrast: 0.55 } },
  { id: 'black-ash', name: 'Black ash (open grain)', category: 'wood', color: '#2b2622', roughness: 0.5, pattern: { id: 'wood-grain', scale: 0.5, contrast: 0.9 } },
  { id: 'calacatta-quartz', name: 'Calacatta quartz', category: 'stone', color: '#f2efe9', roughness: 0.3, pattern: { id: 'marble', scale: 1.4, contrast: 0.45 } },
  { id: 'oat-boucle', name: 'Oat bouclé', category: 'fabric', color: '#e3d8c6', roughness: 1, pattern: { id: 'boucle', scale: 0.2, contrast: 0.85 } },
  { id: 'knit-throw', name: 'Cream chunky knit', category: 'fabric', color: '#eee6d6', roughness: 1, pattern: { id: 'weave', scale: 0.05, contrast: 0.7 } },
  { id: 'glass-blocks', name: 'Glass blocks (19 cm)', category: 'glass', color: '#b9d3d9', roughness: 0.12, opacity: 0.85, pattern: { id: 'tile-square', scale: 0.19, contrast: 1 } },
  { id: 'pleated-linen', name: 'Pleated linen shade', category: 'fabric', color: '#f3ede0', roughness: 0.95, pattern: { id: 'fluted', scale: 0.02, contrast: 0.5 } },
];

// ───────────── Living room ─────────────

const curvedSofa = defineItem({
  id: 'curved-sofa-wood-plinth',
  name: 'Curved bouclé sofa on oak plinth',
  category: 'living',
  type: 'seating',
  group: 'Sofas & loveseats',
  tags: ['sofa', 'curved sofa', 'boucle', 'plinth', 'japandi', 'rounded', 'ghế sofa'],
  description: 'A soft curved sofa in oat bouclé on a rounded oak plinth, with a high rounded arm at one end, scatter cushions and a knitted throw.',
  defaultSize: { w: 2.1, d: 0.88, h: 0.78 },
  minSize: { w: 1.6, d: 0.8, h: 0.7 },
  maxSize: { w: 2.8, d: 1.0, h: 0.86 },
  wallSnap: true,
  slots: [matSlot('upholstery', 'Upholstery', 'oat-boucle'), matSlot('base', 'Plinth', 'warm-oak'), matSlot('pillows', 'Cushions', 'fabric-cream'), matSlot('throw', 'Throw', 'knit-throw')],
  build: (size) => {
    const { w, d, h } = size;
    const r = Math.min(0.32, d * 0.4);
    const parts: Part[] = [
      prism('base', roundRectPoints(0, 0, w - 0.08, d - 0.08, r, 6), 0.02, 0.1),
      prism('upholstery', roundRectPoints(0, 0, w, d, r, 6), 0.12, 0.2),
      // Seat cushion, slightly inset and domed by its rounded outline.
      prism('upholstery', roundRectPoints(0.06, d * 0.08, w - 0.32, d - 0.32, r * 0.7, 6), 0.32, 0.1, o),
      // Back along the rear, merging into a rounded arm at the left end.
      prism('upholstery', roundRectPoints(0.1, -d / 2 + 0.1, w - 0.2, 0.2, 0.1, 5), 0.32, h - 0.32),
      prism('upholstery', roundRectPoints(-w / 2 + 0.12, 0, 0.24, d - 0.02, 0.12, 5), 0.32, h * 0.82 - 0.32),
    ];
    // Scatter cushions leaning on the back.
    for (const [x, tilt] of [
      [-w / 2 + 0.42, 0.18],
      [-w / 2 + 0.8, -0.12],
      [w / 2 - 0.55, 0.2],
    ] as const)
      parts.push(span('pillows', [x - 0.2, x + 0.2], [0.42, 0.8], [-d / 2 + 0.22, -d / 2 + 0.34], { bevel: 0.05, rotation: [-0.3, tilt, 0], plan: false }));
    // Throw draped over the right end of the seat.
    parts.push(span('throw', [w / 2 - 0.45, w / 2 - 0.05], [0.42, 0.45], [-d / 2 + 0.25, d / 2 - 0.02], { bevel: 0.01, rotation: [0, 0.1, 0], plan: false }));
    parts.push(span('throw', [w / 2 - 0.42, w / 2 - 0.1], [0.14, 0.44], [d / 2 - 0.05, d / 2 - 0.02], { bevel: 0.01, plan: false }));
    return keep(parts, size);
  },
});

const pillCoffeeTable = defineItem({
  id: 'pill-coffee-table-column-legs',
  name: 'Pill coffee table on column legs',
  category: 'living',
  type: 'surfaces',
  group: 'Coffee tables',
  tags: ['coffee table', 'oval', 'pill', 'oak', 'column legs', 'japandi', 'bàn trà'],
  description: 'A low oak coffee table with a pill-shaped top resting on three chunky round column legs.',
  defaultSize: { w: 1.0, d: 0.5, h: 0.38 },
  minSize: { w: 0.7, d: 0.4, h: 0.3 },
  maxSize: { w: 1.4, d: 0.7, h: 0.45 },
  slots: [matSlot('top', 'Top', 'warm-oak'), matSlot('legs', 'Legs', 'warm-oak')],
  build: (size) => {
    const { w, d, h } = size;
    const lr = Math.min(0.075, d * 0.16);
    const parts: Part[] = [prism('top', stadium(w, d), h - 0.045, 0.045)];
    for (const [x, z] of [
      [-w / 2 + d * 0.4, 0],
      [w / 2 - d * 0.42, -d * 0.12],
      [w * 0.12, d * 0.18],
    ] as const)
      parts.push(cyl('legs', [x, (h - 0.045) / 2, z], lr, h - 0.045, { segments: 24 }));
    return keep(parts, size);
  },
});

const tvConsole = defineItem({
  id: 'floating-tv-console-pedestal-end',
  name: 'Floating TV console with round pedestal end',
  category: 'living',
  type: 'storage',
  group: 'Media units',
  tags: ['tv console', 'media unit', 'floating', 'oak', 'pedestal', 'kệ tivi', 'japandi'],
  description: 'A long low oak TV console with handleless drawers, floating above a recessed plinth, ending in a curved shelf on a round white pedestal for a plant.',
  defaultSize: { w: 2.6, d: 0.42, h: 0.62 },
  minSize: { w: 1.8, d: 0.35, h: 0.5 },
  maxSize: { w: 3.6, d: 0.5, h: 0.75 },
  wallSnap: true,
  slots: [matSlot('wood', 'Cabinet', 'warm-oak'), matSlot('fronts', 'Drawer fronts', 'warm-oak'), matSlot('pedestal', 'Pedestal', 'plaster-white')],
  build: (size) => {
    const { w, d, h } = size;
    const endR = Math.min(0.24, d * 0.58);
    const x1 = w / 2 - endR * 2;
    const cabH = Math.min(0.42, h * 0.68);
    const y0 = 0.12;
    const parts: Part[] = [
      span('wood', [-w / 2 + 0.06, x1 - 0.04], [0, y0], [-d / 2 + 0.03, d / 2 - 0.08], o),
      span('wood', [-w / 2, x1], [y0, cabH], [-d / 2, d / 2 - 0.02]),
    ];
    const n = Math.max(2, Math.round((x1 + w / 2) / 0.6));
    const cw = (x1 + w / 2) / n;
    for (const i of range(n)) parts.push(span('fronts', [-w / 2 + i * cw + 0.003, -w / 2 + (i + 1) * cw - 0.003], [y0 + 0.004, cabH - 0.03], [d / 2 - 0.02, d / 2], o));
    // Curved end: a shelf at the cabinet top on a round pedestal.
    const pc: [number, number] = [w / 2 - endR, 0];
    parts.push(cyl('pedestal', [pc[0], cabH / 2, pc[1]], endR * 0.75, cabH, { segments: 32 }));
    // Pill-shaped shelf from the cabinet out over the pedestal, rounded at the end.
    parts.push(prism('wood', roundRectPoints((x1 - 0.1 + w / 2) / 2, 0, w / 2 - x1 + 0.1, d - 0.02, (d - 0.02) / 2, 10), cabH - 0.035, 0.035));
    // A thin open shelf above the drawers.
    parts.push(span('wood', [-w / 2, x1 * 0.4], [h - 0.03, h], [-d / 2, -d / 2 + d * 0.62], o));
    parts.push(span('wood', [x1 * 0.4 - 0.03, x1 * 0.4], [cabH, h], [-d / 2, -d / 2 + d * 0.62], o));
    return keep(parts, size);
  },
});

const pedestalSideTable = defineItem({
  id: 'round-pedestal-side-table',
  name: 'Round white pedestal with oak top',
  category: 'living',
  type: 'surfaces',
  group: 'End tables',
  tags: ['pedestal', 'side table', 'plinth', 'round', 'plant stand', 'japandi'],
  description: 'A smooth white round pedestal capped with a thin oak disc, for a plant or a lamp beside the sofa or TV console.',
  defaultSize: { w: 0.42, d: 0.42, h: 0.55 },
  minSize: { w: 0.28, d: 0.28, h: 0.3 },
  maxSize: { w: 0.6, d: 0.6, h: 0.9 },
  slots: [matSlot('pedestal', 'Pedestal', 'plaster-white'), matSlot('top', 'Top', 'warm-oak')],
  build: (size) => {
    const r = Math.min(size.w, size.d) / 2;
    return keep([cyl('pedestal', [0, (size.h - 0.03) / 2, 0], r * 0.82, size.h - 0.03, { segments: 40 }), cyl('top', [0, size.h - 0.015, 0], r, 0.03, { segments: 40 })], size);
  },
});

const ceilingFan = defineItem({
  id: 'wide-blade-ceiling-fan',
  name: 'Ceiling fan with four wide blades',
  category: 'living',
  type: 'electronics',
  group: 'Climate',
  tags: ['ceiling fan', 'fan', 'quạt trần', 'four blades', 'modern', 'climate'],
  description: 'A modern 132 cm ceiling fan with four broad paddle blades in warm grey, a slim motor housing and a short downrod.',
  defaultSize: { w: 1.32, d: 1.32, h: 0.38 },
  minSize: { w: 1.0, d: 1.0, h: 0.3 },
  maxSize: { w: 1.6, d: 1.6, h: 0.6 },
  mount: 'ceiling',
  defaultElevation: CEILING - 0.38,
  slots: [matSlot('body', 'Motor & rod', 'metal-anthracite'), matSlot('blades', 'Blades', 'laminate-greige')],
  build: (size) => {
    const { w, h } = size;
    const R = w / 2;
    const parts: Part[] = [
      cyl('body', [0, h - 0.015, 0], 0.07, 0.03, { segments: 24 }),
      rod('body', [0, h - 0.03, 0], [0, 0.12, 0], 0.012, { segments: 10 }),
      cyl('body', [0, 0.07, 0], 0.11, 0.1, { rTop: 0.09, segments: 32 }),
      sphere('body', [0, 0.02, 0], 0.05, { scale: [1, 0.5, 1] }),
    ];
    for (const k of range(4)) {
      const a = (k * Math.PI) / 2;
      // Paddle blade: wide at the tip, narrow at the hub.
      const pts: V2[] = [
        [0.1, -0.04],
        [R * 0.55, -0.11],
        [R, -0.1],
        [R, 0.08],
        [R * 0.55, 0.07],
        [0.1, 0.03],
      ].map(([x, z]) => [x * Math.cos(a) - z * Math.sin(a), x * Math.sin(a) + z * Math.cos(a)] as V2);
      parts.push(prism('blades', pts, 0.07, 0.012, { rotation: [0, 0, 0] }));
    }
    return keep(parts, size);
  },
});

// ───────────── Dining ─────────────

const archLegChair = defineItem({
  id: 'arch-leg-upholstered-chair',
  name: 'Arch-leg upholstered dining chair',
  category: 'dining',
  type: 'seating',
  group: 'Dining chairs',
  tags: ['dining chair', 'arch legs', 'upholstered', 'boucle', 'oak', 'rounded back', 'ghế ăn'],
  description: 'A chunky oak dining chair whose front and back legs join in soft arches, with a rounded upholstered back and a padded seat.',
  defaultSize: { w: 0.5, d: 0.54, h: 0.8 },
  minSize: { w: 0.44, d: 0.48, h: 0.74 },
  maxSize: { w: 0.58, d: 0.6, h: 0.88 },
  slots: [matSlot('wood', 'Frame', 'warm-oak'), matSlot('upholstery', 'Upholstery', 'oat-boucle')],
  build: (size) => {
    const { w, d, h } = size;
    const seat = 0.46;
    const t = 0.05;
    const parts: Part[] = [];
    const legW = 0.11;
    const zF = d / 2 - 0.04;
    const zB = -d / 2 + 0.06;
    for (const s of [-1, 1]) {
      const xc = s * (w / 2 - legW / 2 - 0.01);
      // Front leg: a thick plank with a narrow arched opening under the seat (two posts and a small arch).
      const top = seat - 0.06;
      const archY = top - 0.07;
      for (const k of [-1, 1]) parts.push(span('wood', [xc + k * (legW / 2) - (k > 0 ? 0.03 : 0), xc + k * (legW / 2) + (k > 0 ? 0 : 0.03)], [0, archY], [zF - t / 2, zF + t / 2], { bevel: 0.008 }));
      parts.push(torus('wood', [xc, archY, zF], legW / 2 - 0.015, 0.015, { arc: Math.PI, scale: [1, 1, t / 0.03], plan: false }));
      parts.push(span('wood', [xc - legW / 2, xc + legW / 2], [archY + legW / 2 - 0.02, top], [zF - t / 2, zF + t / 2], { bevel: 0.008 }));
      // Back leg rising into the back post.
      parts.push(span('wood', [xc - 0.025, xc + 0.025], [0, h - 0.12], [zB - 0.022, zB + 0.022], { bevel: 0.008 }));
      // Side rail under the seat.
      parts.push(span('wood', [xc - 0.015, xc + 0.015], [top - 0.06, top - 0.02], [zB, zF], o));
    }
    // Seat and a rounded back pad between the back posts.
    parts.push(span('upholstery', [-w / 2 + 0.01, w / 2 - 0.01], [seat - 0.06, seat], [-d / 2 + 0.04, d / 2 - 0.01], { bevel: 0.025 }));
    parts.push(panelXY('upholstery', roundRectXY(0, h - 0.14, w - 0.06, 0.24, 0.1), zB + 0.022, 0.06));
    return keep(parts, size);
  },
});

const quartzTable = defineItem({
  id: 'rounded-quartz-dining-table',
  name: 'Rounded quartz dining table on oak panels',
  category: 'dining',
  type: 'surfaces',
  group: 'Dining tables',
  tags: ['dining table', 'quartz', 'rounded corners', 'oak', 'bàn ăn', 'japandi'],
  description: 'A dining table with a thick white quartz top with soft rounded corners and a bullnose edge, on two rounded oak panel legs.',
  defaultSize: { w: 1.6, d: 0.85, h: 0.76 },
  minSize: { w: 1.2, d: 0.75, h: 0.72 },
  maxSize: { w: 2.4, d: 1.0, h: 0.78 },
  slots: [matSlot('top', 'Top', 'calacatta-quartz'), matSlot('base', 'Base', 'warm-oak')],
  build: (size) => {
    const { w, d, h } = size;
    const parts: Part[] = [prism('top', roundRectPoints(0, 0, w, d, 0.14, 6), h - 0.05, 0.05)];
    for (const s of [-1, 1]) parts.push(prism('base', roundRectPoints(s * (w / 2 - 0.28), 0, 0.08, d - 0.24, 0.04, 4), 0, h - 0.05));
    parts.push(span('base', [-w / 2 + 0.28, w / 2 - 0.28], [h - 0.13, h - 0.05], [-0.03, 0.03], o));
    return keep(parts, size);
  },
});

const flutedTable = defineItem({
  id: 'fluted-pedestal-pill-table',
  name: 'Pill dining table with fluted pedestal',
  category: 'dining',
  type: 'surfaces',
  group: 'Dining tables',
  tags: ['dining table', 'pill', 'oval', 'fluted', 'reeded', 'pedestal', 'oak', 'bàn ăn'],
  description: 'A pill-shaped oak dining table on a reeded drum pedestal of vertical flutes, for four in a small dining nook.',
  defaultSize: { w: 1.3, d: 0.65, h: 0.75 },
  minSize: { w: 1.0, d: 0.55, h: 0.72 },
  maxSize: { w: 1.8, d: 0.85, h: 0.78 },
  slots: [matSlot('top', 'Top', 'warm-oak'), matSlot('base', 'Pedestal', 'warm-oak')],
  build: (size) => {
    const { w, d, h } = size;
    const parts: Part[] = [prism('top', stadium(w, d), h - 0.035, 0.035)];
    // Fluted pedestal: a ring of round flutes around a pill-shaped core.
    const pw = w * 0.62;
    const pd = d * 0.5;
    const outline = stadium(pw, pd);
    parts.push(prism('base', stadium(pw - 0.04, pd - 0.04), 0, h - 0.035, o));
    const per = outline.reduce((s, p, i) => s + Math.hypot(p[0] - outline[(i + 1) % outline.length][0], p[1] - outline[(i + 1) % outline.length][1]), 0);
    const nF = Math.min(40, Math.max(16, Math.round(per / 0.05)));
    const step = per / nF;
    let acc = 0;
    let next = 0;
    for (let i = 0; i < outline.length && parts.length < 1 + 1 + nF; i++) {
      const a = outline[i];
      const b = outline[(i + 1) % outline.length];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      while (next <= acc + L) {
        const f = (next - acc) / L;
        parts.push(cyl('base', [a[0] + (b[0] - a[0]) * f, (h - 0.035) / 2, a[1] + (b[1] - a[1]) * f], 0.022, h - 0.035, { segments: 10, plan: false }));
        next += step;
      }
      acc += L;
    }
    return keep(parts, size);
  },
});

const caneChair = defineItem({
  id: 'cane-back-dining-chair',
  name: 'Cane-back oak dining chair',
  category: 'dining',
  type: 'seating',
  group: 'Dining chairs',
  tags: ['dining chair', 'cane', 'rattan', 'oak', 'cushion', 'ghế mây'],
  description: 'A light oak dining chair with a woven cane back panel between curved posts and a plump white seat cushion.',
  defaultSize: { w: 0.45, d: 0.5, h: 0.86 },
  minSize: { w: 0.4, d: 0.44, h: 0.8 },
  maxSize: { w: 0.52, d: 0.56, h: 0.92 },
  slots: [matSlot('wood', 'Frame', 'wood-oak-light'), matSlot('cane', 'Cane back', 'rattan-natural'), matSlot('cushion', 'Seat cushion', 'fabric-white-cotton')],
  build: (size) => {
    const { w, d, h } = size;
    const seat = 0.46;
    const t = 0.032;
    const parts: Part[] = [];
    for (const sx of [-1, 1]) {
      parts.push(span('wood', [sx * (w / 2 - t) - t / 2, sx * (w / 2 - t) + t / 2], [0, seat - 0.04], [d / 2 - 0.05 - t / 2, d / 2 - 0.05 + t / 2], { bevel: 0.006 }));
      // Back leg rising into a gently raked post.
      parts.push(rod('wood', [sx * (w / 2 - t), 0, -d / 2 + 0.05], [sx * (w / 2 - t), seat, -d / 2 + 0.08], t / 2, { segments: 10 }));
      parts.push(rod('wood', [sx * (w / 2 - t), seat, -d / 2 + 0.08], [sx * (w / 2 - t - 0.01), h, -d / 2 + 0.02], t / 2, { segments: 10, plan: false }));
      parts.push(span('wood', [sx * (w / 2 - t) - 0.012, sx * (w / 2 - t) + 0.012], [0.16, 0.19], [-d / 2 + 0.06, d / 2 - 0.05], o));
    }
    parts.push(span('wood', [-w / 2 + t, w / 2 - t], [seat - 0.08, seat - 0.04], [-d / 2 + 0.05, d / 2 - 0.03], o));
    parts.push(span('cushion', [-w / 2 + 0.01, w / 2 - 0.01], [seat - 0.04, seat + 0.03], [-d / 2 + 0.06, d / 2 - 0.01], { bevel: 0.03 }));
    // Cane panel framed by two rails.
    parts.push(span('cane', [-w / 2 + t, w / 2 - t], [h - 0.3, h - 0.06], [-d / 2 + 0.03, -d / 2 + 0.045], o));
    for (const y of [h - 0.31, h - 0.05]) parts.push(span('wood', [-w / 2 + t, w / 2 - t], [y - 0.015, y + 0.015], [-d / 2 + 0.025, -d / 2 + 0.05], o));
    return keep(parts, size);
  },
});

const pleatedLamp = defineItem({
  id: 'pleated-shade-table-lamp',
  name: 'Pleated shade table lamp',
  category: 'lighting',
  type: 'lighting',
  group: 'Table lamps',
  tags: ['table lamp', 'pleated shade', 'wood base', 'bedside lamp', 'đèn bàn'],
  description: 'A small table lamp with a pleated linen shade on a round oak base and slim stem.',
  defaultSize: { w: 0.24, d: 0.24, h: 0.36 },
  minSize: { w: 0.18, d: 0.18, h: 0.28 },
  maxSize: { w: 0.36, d: 0.36, h: 0.55 },
  slots: [matSlot('shade', 'Shade', 'pleated-linen'), matSlot('base', 'Base & stem', 'wood-oak-light'), matSlot('light', 'Bulb', 'light-warm')],
  light: { color: WARM, intensity: 0.5, distance: 3, y: 0.24 },
  build: (size) => {
    const { w, h } = size;
    const R = w / 2;
    const parts: Part[] = [
      cyl('base', [0, 0.02, 0], R * 0.45, 0.04, { rTop: R * 0.4, segments: 24 }),
      rod('base', [0, 0.04, 0], [0, h * 0.62, 0], 0.008, { segments: 8 }),
      sphere('light', [0, h * 0.66, 0], R * 0.18),
      // Faceted lathe gives the pleats.
      lathe('shade', [0, h * 0.5, 0], [
        [R, 0],
        [R * 0.55, h * 0.48],
        [R * 0.52, h * 0.5],
      ], { segments: 18 }),
    ];
    return keep(parts, size);
  },
});

const brassPendant = defineItem({
  id: 'brass-saucer-pendant',
  name: 'Brass saucer pendant with glass',
  category: 'lighting',
  type: 'lighting',
  group: 'Ceiling lights',
  tags: ['pendant', 'brass', 'saucer', 'glass', 'dining light', 'đèn thả'],
  description: 'A brass saucer pendant over a clear glass shade on a long thin cord, to hang in pairs over an island or dining table.',
  defaultSize: { w: 0.34, d: 0.34, h: 0.9 },
  minSize: { w: 0.26, d: 0.26, h: 0.4 },
  maxSize: { w: 0.48, d: 0.48, h: 1.6 },
  mount: 'ceiling',
  defaultElevation: CEILING - 0.9,
  slots: [matSlot('metal', 'Brass, cord & canopy', 'metal-brass'), matSlot('glass', 'Glass', 'glass-clear'), matSlot('light', 'Bulb', 'light-warm')],
  light: { color: WARM, intensity: 1.2, distance: 4.5, y: 0.1 },
  build: (size) => {
    const { w, h } = size;
    const R = w / 2;
    return keep(
      [
        cyl('metal', [0, h - 0.01, 0], 0.05, 0.02, { segments: 20 }),
        rod('metal', [0, h - 0.02, 0], [0, 0.22, 0], 0.003, { segments: 6, plan: false }),
        cyl('metal', [0, 0.2, 0], 0.035, 0.05, { segments: 16 }),
        // Profile runs bottom to top (a reversed profile renders inside out).
        lathe('metal', [0, 0.11, 0], [
          [R * 0.98, 0],
          [R, 0.006],
          [R * 0.55, 0.036],
          [0.04, 0.066],
        ], { segments: 32 }),
        cyl('glass', [0, 0.07, 0], R * 0.42, 0.1, { rTop: R * 0.36, segments: 28 }),
        sphere('light', [0, 0.08, 0], R * 0.18),
      ],
      size,
    );
  },
});

// ───────────── Kitchen ─────────────

/** Wavy island outline: a rounded rectangle whose front edge swells and dips like a wave. */
function wavyOutline(w: number, d: number, n = 48): V2[] {
  return range(n).map((i) => {
    const a = (i / n) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    // Superellipse (squarish) with a wave on the front half.
    const px = Math.sign(c) * Math.pow(Math.abs(c), 0.45) * (w / 2);
    let pz = Math.sign(s) * Math.pow(Math.abs(s), 0.45) * (d / 2);
    if (s > 0) pz *= 0.82 + 0.18 * Math.cos((px / (w / 2)) * Math.PI * 1.5);
    return [px, pz] as V2;
  });
}

const wavyIsland = defineItem({
  id: 'wavy-oak-island-underglow',
  name: 'Wavy oak island with quartz top & under-glow',
  category: 'kitchen',
  type: 'surfaces',
  group: 'Counters & cabinets',
  tags: ['kitchen island', 'wavy', 'curved', 'oak', 'quartz', 'led', 'đảo bếp'],
  description: 'A sculptural kitchen island with a wavy oak body, a matching white quartz top and a warm LED glow from the recessed toe-kick.',
  defaultSize: { w: 1.6, d: 0.8, h: 0.9 },
  minSize: { w: 1.2, d: 0.65, h: 0.86 },
  maxSize: { w: 2.4, d: 1.0, h: 0.95 },
  slots: [matSlot('wood', 'Body', 'warm-oak'), matSlot('top', 'Top', 'calacatta-quartz'), matSlot('light', 'LED strip', 'light-warm')],
  light: { color: WARM, intensity: 0.5, distance: 1.8, y: 0.04 },
  build: (size) => {
    const { w, d, h } = size;
    const out = wavyOutline(w, d);
    const inset = (k: number) => out.map(([x, z]) => [x * k, z * k] as V2);
    return keep([prism('light', inset(0.86), 0.005, 0.05), prism('wood', inset(0.97), 0.06, h - 0.1), prism('top', out, h - 0.04, 0.04)], size);
  },
});

const barCabinet = defineItem({
  id: 'arched-bar-wine-cabinet',
  name: 'Arched bar & wine cabinet wall',
  category: 'dining',
  type: 'storage',
  group: 'Sideboards & cabinets',
  tags: ['bar cabinet', 'wine rack', 'arched', 'reeded glass', 'display', 'tủ rượu', 'pantry'],
  description: 'A full-height oak bar wall: arched reeded-glass cabinets either side, wine racks, a lit arched marble niche with shelves, and a counter over base cupboards.',
  defaultSize: { w: 2.6, d: 0.45, h: 2.4 },
  minSize: { w: 1.8, d: 0.38, h: 2.1 },
  maxSize: { w: 3.6, d: 0.6, h: 2.8 },
  wallSnap: true,
  slots: [matSlot('wood', 'Oak', 'warm-oak'), matSlot('glass', 'Door glass', 'reeded-glass'), matSlot('stone', 'Niche & counter', 'calacatta-quartz'), matSlot('light', 'Niche light', 'light-warm')],
  light: { color: WARM, intensity: 0.9, distance: 3, y: 2.0 },
  build: (size) => {
    const { w, d, h } = size;
    const z0 = -d / 2;
    const zf = d / 2;
    const counter = 0.9;
    const side = Math.min(0.75, w * 0.28);
    const parts: Part[] = [
      // Carcass: back, sides, top and the counter level.
      span('wood', [-w / 2, w / 2], [0, h], [z0, z0 + 0.02]),
      span('wood', [-w / 2, -w / 2 + 0.03], [0, h], [z0, zf]),
      span('wood', [w / 2 - 0.03, w / 2], [0, h], [z0, zf]),
      span('wood', [-w / 2, w / 2], [h - 0.04, h], [z0, zf]),
      span('wood', [-w / 2, w / 2], [0, counter - 0.03], [z0, zf - 0.02]),
      span('stone', [-w / 2 + 0.03, w / 2 - 0.03], [counter - 0.03, counter], [z0, zf]),
    ];
    // Base cupboard fronts.
    const nb = Math.max(3, Math.round(w / 0.6));
    for (const i of range(nb)) {
      const x0 = -w / 2 + 0.03 + ((w - 0.06) * i) / nb;
      const x1 = -w / 2 + 0.03 + ((w - 0.06) * (i + 1)) / nb;
      parts.push(span('wood', [x0 + 0.002, x1 - 0.002], [0.08, counter - 0.04], [zf - 0.02, zf], o));
    }
    // Side towers: wine racks, then arched glass doors up top.
    for (const s of [-1, 1]) {
      const xa = s < 0 ? -w / 2 + 0.03 : w / 2 - 0.03 - side;
      const xb = xa + side;
      parts.push(span('wood', [s < 0 ? xb : xa - 0.02, s < 0 ? xb + 0.02 : xa], [counter, h - 0.04], [z0, zf], o));
      for (const k of range(4)) parts.push(span('wood', [xa, xb], [counter + 0.1 + k * 0.1, counter + 0.115 + k * 0.1], [z0 + 0.05, zf - 0.03], o));
      const yd = counter + 0.52;
      parts.push(span('wood', [xa, xb], [yd - 0.02, yd], [z0, zf], o));
      const half = side / 2;
      for (const j of [0, 1]) {
        const dx0 = xa + j * half + 0.02;
        const dx1 = xa + (j + 1) * half - 0.02;
        parts.push(panelXY('wood', archPoints(dx0 - 0.015, dx1 + 0.015, yd + 0.02, h - 0.08), zf - 0.025, 0.012));
        parts.push(panelXY('glass', archPoints(dx0 + 0.03, dx1 - 0.03, yd + 0.07, h - 0.13), zf - 0.012, 0.006));
      }
    }
    // Lit arched niche in the middle with shelves.
    const nx0 = -w / 2 + 0.03 + side + 0.06;
    const nx1 = w / 2 - 0.03 - side - 0.06;
    parts.push(panelXY('stone', archPoints(nx0, nx1, counter, h - 0.12, 14), z0 + 0.02, 0.01));
    parts.push(panelXY('light', archPoints(nx0 - 0.015, nx1 + 0.015, counter + 0.4, h - 0.1, 14), z0 + 0.015, 0.004));
    for (const y of [counter + 0.45, counter + 0.85, counter + 1.2]) if (y < h - 0.3) parts.push(span('wood', [nx0, nx1], [y, y + 0.025], [z0 + 0.03, zf - 0.08], o));
    return keep(parts, size);
  },
});

const butterCabinets = defineItem({
  id: 'butter-rounded-wall-cabinets',
  name: 'Rounded butter-yellow wall cabinets',
  category: 'kitchen',
  type: 'storage',
  group: 'Kitchen cabinets',
  tags: ['wall cabinet', 'kitchen', 'butter yellow', 'rounded', 'retro', 'lacquer', 'tủ bếp trên'],
  description: 'A run of wall cabinets with softly rounded corners in butter-yellow lacquer: two tall doors and two stacked doors with rounded inset grooves.',
  defaultSize: { w: 1.5, d: 0.36, h: 0.72 },
  minSize: { w: 0.8, d: 0.3, h: 0.5 },
  maxSize: { w: 2.4, d: 0.42, h: 0.9 },
  mount: 'wall',
  defaultElevation: 1.45,
  wallSnap: true,
  slots: [matSlot('body', 'Cabinet', 'butter-lacquer'), matSlot('doors', 'Doors', 'butter-lacquer')],
  build: (size) => {
    const { w, d, h } = size;
    const parts: Part[] = [panelXY('body', roundRectXY(0, h / 2, w, h, 0.06), -d / 2, d - 0.03, true)];
    const hw = w / 2;
    const cells: [number, number, number, number][] = [
      [-hw, -hw / 2, 0, h],
      [-hw / 2, 0, 0, h],
      [0, hw, h / 2, h],
      [0, hw, 0, h / 2],
    ];
    for (const [x0, x1, y0, y1] of cells) {
      parts.push(panelXY('doors', roundRectXY((x0 + x1) / 2, (y0 + y1) / 2, x1 - x0 - 0.006, y1 - y0 - 0.006, 0.05), d / 2 - 0.03, 0.02));
      // Rounded inset groove (a slightly proud inner panel reads as a routed line).
      parts.push(panelXY('doors', roundRectXY((x0 + x1) / 2, (y0 + y1) / 2, x1 - x0 - 0.07, y1 - y0 - 0.07, 0.05), d / 2 - 0.01, 0.006));
    }
    return keep(parts, size);
  },
});

const creamBaseRun = defineItem({
  id: 'cream-base-run-oak-trims',
  name: 'Cream base run with oak trims & pegboard door',
  category: 'kitchen',
  type: 'surfaces',
  group: 'Counters & cabinets',
  tags: ['kitchen counter', 'base cabinets', 'cream', 'oak trim', 'pegboard', 'sink', 'hob', 'tủ bếp dưới'],
  description: 'A 2.4 m run of cream lacquered drawers and doors separated by fine oak trims, with a perforated pegboard door, a black undermount sink, a black induction hob and a white quartz top.',
  defaultSize: { w: 2.4, d: 0.62, h: 0.9 },
  minSize: { w: 1.8, d: 0.55, h: 0.85 },
  maxSize: { w: 3.2, d: 0.7, h: 0.95 },
  wallSnap: true,
  slots: [matSlot('fronts', 'Fronts', 'cream-lacquer'), matSlot('trim', 'Oak trims & plinth', 'warm-oak'), matSlot('top', 'Worktop', 'stone-quartz-white'), matSlot('fixtures', 'Sink & hob', 'metal-black-matte')],
  build: (size) => {
    const { w, d, h } = size;
    const z0 = -d / 2;
    const zf = d / 2 - 0.02;
    const top = h - 0.03;
    const parts: Part[] = [
      span('trim', [-w / 2, w / 2], [0, top], [z0, zf - 0.02]),
      span('top', [-w / 2, w / 2], [top, h], [z0, d / 2]),
    ];
    // Bays: pegboard door, drawers ×3 twice, double doors under the sink.
    const bays: ('peg' | 'drawers' | 'doors')[] = ['peg', 'drawers', 'drawers', 'doors', 'drawers'];
    const bw = w / bays.length;
    const y0 = 0.1;
    for (const [i, kind] of bays.entries()) {
      const x0 = -w / 2 + i * bw;
      const x1 = x0 + bw;
      const g = 0.008;
      const fr = (a: number, b: number, c: number, e: number) => span('fronts', [a + g / 2, b - g / 2], [c + g / 2, e - g / 2], [zf - 0.02, zf], o);
      if (kind === 'drawers') {
        const cuts = [y0, y0 + (top - y0) * 0.36, y0 + (top - y0) * 0.68, top - 0.01];
        for (const k of range(3)) parts.push(fr(x0, x1, cuts[k], cuts[k + 1]));
      } else if (kind === 'doors') {
        parts.push(fr(x0, (x0 + x1) / 2, y0, top - 0.01), fr((x0 + x1) / 2, x1, y0, top - 0.01));
      } else {
        parts.push(fr(x0, x1, y0, top - 0.01));
        for (const r of range(5)) for (const c of range(3)) parts.push(cyl('trim', [x0 + bw * (0.3 + c * 0.2), top - 0.12 - r * 0.07, zf + 0.0005], 0.012, 0.004, { rotation: [Math.PI / 2, 0, 0], segments: 10, plan: false }));
      }
    }
    // Undermount sink, gooseneck tap and induction hob.
    const sx = -w / 2 + bw * 3.5;
    parts.push(span('fixtures', [sx - 0.28, sx + 0.28], [top - 0.002, h + 0.001], [-0.18, 0.16], o));
    const hx = -w / 2 + bw * 1.5;
    parts.push(span('fixtures', [hx - 0.29, hx + 0.29], [h, h + 0.004], [-0.22, 0.2], o));
    return keep(parts, size);
  },
});

const cylinderHood = defineItem({
  id: 'cylinder-wall-cooker-hood',
  name: 'Cylinder wall cooker hood',
  category: 'kitchen',
  type: 'appliances',
  group: 'Cooking',
  tags: ['cooker hood', 'range hood', 'cylinder', 'white', 'máy hút mùi', 'extractor'],
  description: 'A slim white cylindrical cooker hood that hangs on the wall over the hob, with a ring of intake slots and a control strip.',
  defaultSize: { w: 0.4, d: 0.4, h: 0.65 },
  minSize: { w: 0.3, d: 0.3, h: 0.5 },
  maxSize: { w: 0.5, d: 0.5, h: 0.9 },
  mount: 'wall',
  defaultElevation: 1.55,
  wallSnap: true,
  slots: [matSlot('body', 'Body', 'metal-white-powder'), matSlot('vents', 'Vents & buttons', 'metal-anthracite')],
  build: (size) => {
    const { w, d, h } = size;
    const R = Math.min(w, d) / 2;
    const parts: Part[] = [cyl('body', [0, h / 2, 0], R, h, { segments: 40 }), cyl('vents', [0, 0.004, 0], R * 0.92, 0.008, { segments: 40 })];
    for (const k of range(10)) {
      const a = Math.PI * 0.25 + (k / 9) * Math.PI * 0.5;
      parts.push(span('vents', [-0.004, 0.004], [h - 0.12, h - 0.06], [-0.002, 0.002], { rotation: [0, -a + Math.PI / 2, 0], plan: false }));
      parts[parts.length - 1].position = [Math.cos(a) * R, h - 0.09, Math.sin(a) * R];
    }
    for (const k of range(3)) parts.push(sphere('vents', [-0.03 + k * 0.03, 0.12, R - 0.002], 0.006, o));
    return keep(parts, size);
  },
});

const hoopChair = defineItem({
  id: 'black-hoop-back-chair',
  name: 'Black hoop-back wooden chair',
  category: 'dining',
  type: 'seating',
  group: 'Dining chairs',
  tags: ['dining chair', 'black', 'hoop back', 'bentwood', 'wishbone', 'ghế gỗ'],
  description: 'A black-stained wooden chair with a continuous bent hoop back and a light upholstered seat pad.',
  defaultSize: { w: 0.48, d: 0.5, h: 0.78 },
  minSize: { w: 0.42, d: 0.44, h: 0.72 },
  maxSize: { w: 0.54, d: 0.56, h: 0.84 },
  slots: [matSlot('wood', 'Frame', 'black-ash'), matSlot('seat', 'Seat pad', 'fabric-mustard')],
  build: (size) => {
    const { w, d, h } = size;
    const seat = 0.45;
    const r = 0.016;
    const parts: Part[] = [];
    for (const sx of [-1, 1]) {
      parts.push(rod('wood', [sx * (w / 2 - 0.04), 0, d / 2 - 0.05], [sx * (w / 2 - 0.05), seat - 0.03, d / 2 - 0.07], r, { segments: 10 }));
      parts.push(rod('wood', [sx * (w / 2 - 0.04), 0, -d / 2 + 0.05], [sx * (w / 2 - 0.05), seat - 0.03, -d / 2 + 0.08], r, { segments: 10 }));
      parts.push(rod('wood', [sx * (w / 2 - 0.05), seat - 0.03, -d / 2 + 0.08], [sx * (w / 2 - 0.05), h - (w / 2 - 0.05), -d / 2 + 0.06], r, { segments: 10, plan: false }));
    }
    parts.push(torus('wood', [0, h - (w / 2 - 0.05), -d / 2 + 0.06], w / 2 - 0.05, r, { arc: Math.PI, plan: false }));
    parts.push(span('wood', [-w / 2 + 0.04, w / 2 - 0.04], [seat - 0.06, seat - 0.03], [-d / 2 + 0.06, d / 2 - 0.05], o));
    parts.push(span('seat', [-w / 2 + 0.03, w / 2 - 0.03], [seat - 0.03, seat + 0.02], [-d / 2 + 0.07, d / 2 - 0.02], { bevel: 0.02 }));
    return keep(parts, size);
  },
});

const blackOvalTable = defineItem({
  id: 'oval-black-ash-dining-table',
  name: 'Oval black ash dining table',
  category: 'dining',
  type: 'surfaces',
  group: 'Dining tables',
  tags: ['dining table', 'oval', 'black', 'ash', 'open grain', 'bàn ăn'],
  description: 'An oval dining table in black-stained ash with a strong open grain, on four tapered legs set in from the edge.',
  defaultSize: { w: 1.5, d: 0.9, h: 0.75 },
  minSize: { w: 1.1, d: 0.75, h: 0.72 },
  maxSize: { w: 2.2, d: 1.1, h: 0.78 },
  slots: [matSlot('top', 'Top', 'black-ash'), matSlot('legs', 'Legs', 'black-ash')],
  build: (size) => {
    const { w, d, h } = size;
    const parts: Part[] = [prism('top', ellipsePoints(0, 0, w / 2, d / 2, 48), h - 0.035, 0.035)];
    for (const [sx, sz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ])
      parts.push(rod('legs', [sx * w * 0.3, 0, sz * d * 0.26], [sx * w * 0.27, h - 0.035, sz * d * 0.22], 0.022, { rTop: 0.03, segments: 12 }));
    parts.push(prism('legs', ellipsePoints(0, 0, w * 0.3, d * 0.24, 32), h - 0.1, 0.065, o));
    return keep(parts, size);
  },
});

// ───────────── Walls, windows & lighting coves ─────────────

const wallNiche = defineItem({
  id: 'backlit-rounded-wall-niche',
  name: 'Backlit rounded wall niche with shelves',
  category: 'living',
  type: 'storage',
  group: 'Bookcases & shelves',
  tags: ['wall niche', 'shelves', 'backlit', 'led', 'rounded', 'display', 'hốc tường'],
  description: 'A rounded recessed-look wall niche lined in oak with three floating shelves and a warm LED halo around its edge, for photos and keepsakes.',
  defaultSize: { w: 1.6, d: 0.16, h: 0.95 },
  minSize: { w: 0.8, d: 0.12, h: 0.6 },
  maxSize: { w: 2.6, d: 0.25, h: 1.6 },
  mount: 'wall',
  defaultElevation: 0.95,
  wallSnap: true,
  slots: [matSlot('back', 'Niche lining', 'warm-oak'), matSlot('shelves', 'Shelves', 'warm-oak'), matSlot('light', 'LED halo', 'light-warm'), matSlot('surround', 'Surround', 'plaster-white')],
  light: { color: WARM, intensity: 0.6, distance: 2.2, y: 0.5, z: 0.05 },
  build: (size) => {
    const { w, d, h } = size;
    const r = Math.min(0.22, h * 0.25);
    const parts: Part[] = [
      panelXY('surround', roundRectXY(0, h / 2, w, h, r + 0.02), -d / 2, 0.02, true),
      panelXY('light', roundRectXY(0, h / 2, w - 0.04, h - 0.04, r), -d / 2 + 0.02, 0.004),
      panelXY('back', roundRectXY(0, h / 2, w - 0.1, h - 0.1, r * 0.8), -d / 2 + 0.024, 0.01),
    ];
    for (const k of range(3)) {
      const y = 0.12 + ((h - 0.24) * (k + 0.3)) / 3;
      parts.push(span('shelves', [-w / 2 + 0.1 + r * 0.3, w / 2 - 0.1 - r * 0.3], [y, y + 0.025], [-d / 2 + 0.03, d / 2], o));
    }
    return keep(parts, size);
  },
});

const glassPartition = defineItem({
  id: 'oak-framed-glass-partition',
  name: 'Oak-framed glass partition with clerestory band',
  category: 'construction',
  type: 'structure',
  group: 'Partitions',
  tags: ['partition', 'glass wall', 'room divider', 'oak frame', 'clerestory', 'vách kính'],
  description: 'A room divider with a low white plastered wall, a band of small square lights in an oak frame and tall glass panes above, open to the ceiling.',
  defaultSize: { w: 2.4, d: 0.1, h: 2.4 },
  minSize: { w: 1.0, d: 0.08, h: 1.8 },
  maxSize: { w: 4.8, d: 0.2, h: 3.2 },
  wallSnap: true,
  slots: [matSlot('frame', 'Oak frame', 'warm-oak'), matSlot('glass', 'Glass', 'glass-clear'), matSlot('wall', 'Low wall', 'plaster-white')],
  build: (size) => {
    const { w, d, h } = size;
    const t = 0.05;
    const base = Math.min(0.75, h * 0.32);
    const band = base + 0.28;
    const parts: Part[] = [
      span('wall', [-w / 2, w / 2], [0, base], [-d / 2, d / 2]),
      span('frame', [-w / 2, w / 2], [base, base + 0.04], [-d / 2 - 0.0, d / 2]),
      span('frame', [-w / 2, w / 2], [band, band + t], [-d / 2 + 0.01, d / 2 - 0.01]),
      span('frame', [-w / 2, w / 2], [h - t, h], [-d / 2 + 0.01, d / 2 - 0.01]),
      span('glass', [-w / 2 + t, w / 2 - t], [band + t, h - t], [-0.004, 0.004], o),
      span('glass', [-w / 2 + t, w / 2 - t], [base + 0.04, band], [-0.003, 0.003], o),
    ];
    const n = Math.max(2, Math.round(w / 0.8));
    for (const i of range(n + 1)) {
      const x = -w / 2 + (w * i) / n;
      parts.push(span('frame', [clamp(x - t / 2, -w / 2, w / 2 - t), clamp(x + t / 2, -w / 2 + t, w / 2)], [base, h], [-d / 2 + 0.01, d / 2 - 0.01]));
    }
    // Small square lights in the band.
    const m = Math.max(4, Math.round(w / 0.2));
    for (const j of range(m)) {
      const x = -w / 2 + (w * j) / m;
      parts.push(span('frame', [x - 0.012, x + 0.012], [base + 0.04, band], [-d / 2 + 0.02, d / 2 - 0.02], o));
    }
    return keep(parts, size);
  },
});

const glassBlockPanel = defineItem({
  id: 'glass-block-window-panel',
  name: 'Glass block window panel',
  category: 'construction',
  type: 'structure',
  group: 'Partitions',
  tags: ['glass block', 'glass brick', 'window', 'partition', 'gạch kính', 'light'],
  description: 'A panel of glass blocks in a slim white frame: lets light through while blurring the view, for a kitchen window or shower wall.',
  defaultSize: { w: 0.6, d: 0.08, h: 1.6 },
  minSize: { w: 0.3, d: 0.06, h: 0.4 },
  maxSize: { w: 3.0, d: 0.12, h: 3.0 },
  wallSnap: true,
  slots: [matSlot('blocks', 'Glass blocks', 'glass-blocks'), matSlot('frame', 'Frame', 'plaster-white')],
  build: (size) => {
    const { w, d, h } = size;
    const f = 0.03;
    return keep(
      [
        span('blocks', [-w / 2 + f, w / 2 - f], [f, h - f], [-d / 2 + 0.01, d / 2 - 0.01]),
        span('frame', [-w / 2, w / 2], [0, f], [-d / 2, d / 2]),
        span('frame', [-w / 2, w / 2], [h - f, h], [-d / 2, d / 2]),
        span('frame', [-w / 2, -w / 2 + f], [f, h - f], [-d / 2, d / 2]),
        span('frame', [w / 2 - f, w / 2], [f, h - f], [-d / 2, d / 2]),
      ],
      size,
    );
  },
});

const woodBlind = defineItem({
  id: 'wooden-venetian-blind',
  name: 'Wooden venetian blind',
  category: 'decor',
  type: 'decor',
  group: 'Curtains & blinds',
  tags: ['blind', 'venetian blind', 'wooden slats', 'window', 'rèm gỗ', 'mành'],
  description: 'A wooden venetian blind with 50 mm slats on cotton ladder tapes, a headrail and a weighted bottom rail, hung over a window.',
  defaultSize: { w: 1.2, d: 0.06, h: 1.5 },
  minSize: { w: 0.4, d: 0.05, h: 0.5 },
  maxSize: { w: 3.0, d: 0.08, h: 3.0 },
  mount: 'wall',
  defaultElevation: 0.9,
  wallSnap: true,
  slots: [matSlot('slats', 'Slats', 'wood-oak-light'), matSlot('tapes', 'Ladder tapes', 'fabric-cream')],
  build: (size) => {
    const { w, d, h } = size;
    const parts: Part[] = [span('slats', [-w / 2, w / 2], [h - 0.05, h], [-d / 2, d / 2]), span('slats', [-w / 2 + 0.01, w / 2 - 0.01], [0, 0.03], [-d / 2 + 0.005, d / 2 - 0.005])];
    const n = Math.min(70, Math.max(6, Math.floor((h - 0.08) / 0.045)));
    for (const i of range(n)) {
      const y = 0.05 + ((h - 0.1) * (i + 0.5)) / n;
      parts.push(span('slats', [-w / 2 + 0.01, w / 2 - 0.01], [y - 0.003, y + 0.003], [-d / 2 + 0.006, d / 2 - 0.006], { rotation: [0.35, 0, 0], plan: false }));
    }
    for (const x of [-w / 2 + w * 0.18, w / 2 - w * 0.18]) parts.push(span('tapes', [x - 0.012, x + 0.012], [0.02, h - 0.05], [d / 2 - 0.012, d / 2 - 0.008], o));
    return keep(parts, size);
  },
});

export default definePack({
  name: 'Soft modern home',
  version: '1.0.0',
  author: 'Neest',
  description: 'Warm, curvy furniture from Vietnamese Japandi apartments: oak, bouclé, quartz, brass, reeded glass and LED coves.',
  license: 'CC0-1.0',
  materials,
  items: [
    curvedSofa,
    pillCoffeeTable,
    tvConsole,
    pedestalSideTable,
    ceilingFan,
    archLegChair,
    quartzTable,
    flutedTable,
    caneChair,
    pleatedLamp,
    brassPendant,
    wavyIsland,
    barCabinet,
    butterCabinets,
    creamBaseRun,
    cylinderHood,
    hoopChair,
    blackOvalTable,
    wallNiche,
    glassPartition,
    glassBlockPanel,
    woodBlind,
  ],
});

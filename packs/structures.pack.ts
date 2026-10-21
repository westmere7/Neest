/**
 * Structures — the building around the furniture: classical, clad, steel and mushroom columns,
 * pilasters, beams and joists, coffered and tray ceilings, soffits and boxed-in risers, half walls,
 * archways, glass, breeze-block, slatted and barn-door partitions, window seats, wall-to-wall
 * joinery, chimney breasts, stoves and radiators, and staircases (straight, floating, steel spine,
 * L, U, spiral, alternating tread, loft ladder), split-level steps, platforms and balustrades.
 *
 * Coordinates: the front of an item faces +z, wall items stand with their back on -z, y is up.
 * Staircases climb from the front (+z) towards the back.
 */
import {
  barPull,
  bookRow,
  box,
  cellSpans,
  cells,
  clamp,
  containParts,
  cushion,
  cyl,
  defineItem,
  definePack,
  ellipsePoints,
  frame4,
  knob,
  lathe,
  line,
  matSlot,
  plantBox,
  poly,
  prism,
  range,
  rectPoly,
  ring,
  rod,
  roundRectPoints,
  shakerFront,
  spaced,
  span,
  sphere,
  torus,
  turnedLeg,
  vcyl,
  type AssetPresetVariant,
  type Part,
  type PlanStroke,
  type Size3,
} from '@/packs/kit';

type V2 = [number, number];
type V3 = [number, number, number];
const o = { plan: false };
const CEILING = 2.7;
const C = 'construction' as const;
const keep = (parts: Part[], size: Size3) => containParts(parts, plantBox(size));
const rg = (a: number, b: number): V2 => (a < b ? [a, b] : [b, a]);
const mid = (v: number[]) => (Math.min(...v) + Math.max(...v)) / 2;

/** A flat panel in the X/Y (front) plane from [x, y] points, extruded from z0 to z0 + t. */
function panelXY(slot: string, pts: V2[], z0: number, t: number, plan = false): Part {
  const cx = mid(pts.map((p) => p[0]));
  const cy = mid(pts.map((p) => p[1]));
  const part: Part = {
    shape: 'prism',
    outline: pts.map(([x, y]) => [x - cx, -(y - cy)] as V2),
    height: t,
    position: [cx, cy, z0],
    rotation: [Math.PI / 2, 0, 0],
    slot,
  };
  if (!plan) part.plan = false;
  return part;
}

/** A flat panel in the Z/Y (side) plane from [z, y] points, extruded from x0 to x0 + t. */
function panelZY(slot: string, pts: V2[], x0: number, t: number, plan = false): Part {
  const cz = mid(pts.map((p) => p[0]));
  const cy = mid(pts.map((p) => p[1]));
  const part: Part = {
    shape: 'prism',
    outline: pts.map(([z, y]) => [y - cy, z - cz] as V2),
    height: t,
    position: [x0 + t, cy, cz],
    rotation: [0, 0, Math.PI / 2],
    slot,
  };
  if (!plan) part.plan = false;
  return part;
}

/** A square-section bar from a to b (its length along a→b), `sx` × `sz` in section. */
function bar(slot: string, a: V3, b: V3, sx: number, sz: number, opts?: { plan?: boolean; bevel?: number }): Part {
  const d: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const L = Math.hypot(...d) || 0.001;
  const [ux, uy, uz] = [d[0] / L, d[1] / L, d[2] / L];
  return box(slot, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], [sx, L, sz], {
    rotation: [Math.atan2(uz, uy), 0, Math.atan2(-ux, Math.hypot(uy, uz))],
    plan: opts?.plan,
    bevel: opts?.bevel,
  });
}

/** Boxes approximating a ring sector in the X/Y plane (arch mouldings and frames). */
function arcBand(slot: string, cx: number, cy: number, r0: number, r1: number, a0: number, a1: number, n: number, z: V2, plan = false): Part[] {
  const da = (a1 - a0) / n;
  const rm = (r0 + r1) / 2;
  const chord = 2 * r1 * Math.sin(Math.abs(da) / 2) * 1.04;
  return range(n).map((k) => {
    const a = a0 + (k + 0.5) * da;
    return box(slot, [cx + Math.cos(a) * rm, cy + Math.sin(a) * rm, (z[0] + z[1]) / 2], [chord, r1 - r0, z[1] - z[0]], {
      rotation: [0, 0, a + Math.PI / 2],
      plan,
    });
  });
}

/** Points along an arc in the X/Y plane. */
const arcXY = (cx: number, cy: number, r: number, a0: number, a1: number, n: number): V2[] =>
  range(n + 1).map((i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as V2;
  });

/** Outline of a round-headed opening: a rectangle x0..x1 from y0 with a semicircle springing at sy. */
const archOutline = (x0: number, x1: number, y0: number, sy: number, n = 16): V2[] => [
  [x0, y0],
  [x1, y0],
  ...arcXY((x0 + x1) / 2, sy, (x1 - x0) / 2, 0, Math.PI, n),
];

/** The fill above a semicircular arch (x0..x1 springing at sy) up to yTop: the arch head / spandrels. */
const archHead = (x0: number, x1: number, sy: number, yTop: number, n = 16): V2[] => [
  ...arcXY((x0 + x1) / 2, sy, (x1 - x0) / 2, Math.PI, 0, n),
  [x1, yTop],
  [x0, yTop],
];

/** Polygon [s, y] between two straight lines top(s) and bot(s) over s0..s1, clipped to lo..hi in y. */
function band(s0: number, s1: number, top: (s: number) => number, bot: (s: number) => number, lo: number, hi: number): V2[] {
  const ks = [s0, s1];
  for (const f of [top, bot]) {
    for (const y of [lo, hi]) {
      const a = f(s0);
      const b = f(s1);
      if ((a - y) * (b - y) < 0) ks.push(s0 + ((y - a) / (b - a)) * (s1 - s0));
    }
  }
  ks.sort((p, q) => p - q);
  const c = (y: number) => clamp(y, lo, hi);
  const pts: V2[] = [...ks.map((s) => [s, c(top(s))] as V2), ...[...ks].reverse().map((s) => [s, c(bot(s))] as V2)];
  return pts.filter((p, i) => {
    const q = pts[(i + pts.length - 1) % pts.length];
    return Math.abs(p[0] - q[0]) > 1e-6 || Math.abs(p[1] - q[1]) > 1e-6;
  });
}

/** A plump square throw pillow (rounded box) centred at c, leaning back by `lean` and turned by `turn`. */
const squarePillow = (slot: string, c: V3, pw: number, ph: number, t: number, lean: number, turn: number): Part =>
  box(slot, c, [pw, ph, t], { rotation: [-lean, turn, 0], bevel: t * 0.45, plan: false });

/** Plan arrow along a path (stairs: from the bottom step up). */
function stairArrow(pts: V2[]): PlanStroke[] {
  const [a, b] = [pts[pts.length - 2], pts[pts.length - 1]];
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const [ux, uz] = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
  const s = 0.12;
  return [
    poly(pts, false),
    line(b, [b[0] - ux * s - uz * s * 0.5, b[1] - uz * s + ux * s * 0.5]),
    line(b, [b[0] - ux * s + uz * s * 0.5, b[1] - uz * s - ux * s * 0.5]),
  ];
}

// ---------------------------------------------------------------------------
// Columns, pilasters, posts and beams
// ---------------------------------------------------------------------------

/** A classical round column: plinth, moulded base, swelling shaft (optionally reeded), Doric capital. */
function classicalColumn({ w, d, h }: Size3, reeds: number): Part[] {
  const R = Math.min(w, d) / 2;
  const sc: V3 = [w / (2 * R), 1, d / (2 * R)];
  const k = clamp(h / 2.7, 0.8, 1.5);
  const plinth = 0.07 * k;
  const baseH = 0.1 * k;
  const abacus = 0.06 * k;
  const echinus = 0.1 * k;
  const rb = R * 0.74;
  const rt = rb * 0.86;
  const y0 = plinth + baseH;
  const y1 = h - abacus - echinus;
  const L = y1 - y0;
  const radius = (t: number) => rb * (1 + 0.012 * Math.sin(Math.PI * t)) - (rb - rt) * Math.pow(t, 1.6);
  const shaft: V2[] = [[0, 0], ...[0, 0.15, 0.33, 0.5, 0.7, 0.85, 1].map((t) => [radius(t), t * L] as V2), [0, L]];
  const parts: Part[] = [
    span('trim', [-w / 2, w / 2], [0, plinth], [-d / 2, d / 2]),
    lathe('trim', [0, plinth, 0], [[0, 0], [R * 0.95, 0], [R * 0.96, baseH * 0.15], [R * 0.93, baseH * 0.32], [R * 0.86, baseH * 0.45], [rb * 1.12, baseH * 0.55], [rb * 1.15, baseH * 0.72], [rb * 1.06, baseH * 0.9], [rb, baseH], [0, baseH]], { segments: 40, scale: sc }),
    lathe('shaft', [0, y0, 0], shaft, { segments: 40, scale: sc }),
    torus('trim', [0, y1 - 0.03 * k, 0], radius(0.98) * 1.0, 0.012 * k, { rotation: [Math.PI / 2, 0, 0], scale: [sc[0], sc[2], 1], plan: false }),
    lathe('trim', [0, y1, 0], [[0, 0], [rt * 1.02, 0], [rt * 1.08, echinus * 0.15], [R * 0.8, echinus * 0.62], [R * 0.9, echinus * 0.86], [R * 0.92, echinus], [0, echinus]], { segments: 40, scale: sc, plan: false }),
    span('trim', [-w / 2, w / 2], [h - abacus, h], [-d / 2, d / 2], o),
  ];
  if (reeds > 0) {
    const rf = ((Math.PI * rb) / reeds) * 0.55;
    for (const i of range(reeds)) {
      const a = (i / reeds) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const r0 = radius(0) - rf * 0.35;
      const r1 = radius(1) - rf * 0.35;
      parts.push(rod('shaft', [c * r0 * sc[0], y0 + 0.03, s * r0 * sc[2]], [c * r1 * sc[0], y1 - 0.05 * k, s * r1 * sc[2]], rf, { segments: 8, plan: false }));
    }
  }
  return parts;
}

const columnVariants: AssetPresetVariant[] = [
  { id: 'travertine', name: 'Travertine', materials: { shaft: 'stone-travertine', trim: 'stone-travertine' } },
  { id: 'marble', name: 'Carrara marble', materials: { shaft: 'stone-marble-carrara', trim: 'stone-marble-carrara' } },
  { id: 'concrete', name: 'Cast concrete', materials: { shaft: 'concrete-grey', trim: 'concrete-grey' } },
];

const reededColumn = defineItem({
  id: 'reeded-classical-column',
  name: 'Reeded classical column',
  category: C,
  type: 'structure',
  group: 'Columns',
  tags: ['column', 'fluted column', 'reeded', 'doric', 'classical', 'pillar', 'cột tròn'],
  description: 'A classical round column whose gently swelling shaft is dressed in twenty slim reeds, on a moulded base and square plinth, under a Doric capital.',
  defaultSize: { w: 0.42, d: 0.42, h: 2.7 },
  minSize: { w: 0.25, d: 0.25, h: 2.0 },
  maxSize: { w: 0.9, d: 0.9, h: 4.5 },
  slots: [matSlot('shaft', 'Shaft', 'plaster-white'), matSlot('trim', 'Base & capital', 'plaster-white')],
  variants: columnVariants,
  build: (size) => classicalColumn(size, 20),
});

const tuscanColumn = defineItem({
  id: 'tuscan-column',
  name: 'Tuscan column with entasis',
  category: C,
  type: 'structure',
  group: 'Columns',
  tags: ['column', 'tuscan', 'classical', 'entasis', 'pillar', 'colonnade'],
  description: 'A plain Tuscan column: a smooth shaft that swells slightly and tapers to the top, a torus base on a square plinth and a simple round capital.',
  defaultSize: { w: 0.4, d: 0.4, h: 2.7 },
  minSize: { w: 0.22, d: 0.22, h: 2.0 },
  maxSize: { w: 0.9, d: 0.9, h: 4.5 },
  slots: [matSlot('shaft', 'Shaft', 'plaster-white'), matSlot('trim', 'Base & capital', 'paint-satin-white')],
  variants: columnVariants,
  build: (size) => classicalColumn(size, 0),
});

const pilaster = defineItem({
  id: 'panelled-pilaster',
  name: 'Panelled pilaster',
  category: C,
  type: 'structure',
  group: 'Columns',
  tags: ['pilaster', 'half column', 'wall column', 'moulding', 'classical', 'trụ áp tường'],
  description: 'A flat pilaster against a wall: a plinth block, a shaft with a raised panel moulding and a stepped capital, painted like the joinery.',
  defaultSize: { w: 0.35, d: 0.08, h: 2.7 },
  minSize: { w: 0.2, d: 0.04, h: 2.0 },
  maxSize: { w: 0.8, d: 0.2, h: 4.5 },
  wallSnap: true,
  slots: [matSlot('body', 'Shaft', 'plaster-white'), matSlot('trim', 'Mouldings', 'paint-satin-white')],
  variants: [
    { id: 'greige', name: 'Greige', materials: { body: 'paint-greige', trim: 'paint-greige' } },
    { id: 'oak', name: 'Oak', materials: { body: 'wood-oak-natural', trim: 'wood-oak-natural' } },
    { id: 'stone', name: 'Limestone', materials: { body: 'stone-travertine', trim: 'stone-marble-beige' } },
  ],
  build: ({ w, d, h }) => {
    const pl = Math.min(0.24, h * 0.09);
    const cap = Math.min(0.2, h * 0.07);
    const fz = d / 2 - 0.012;
    const px = w / 2 - Math.max(0.045, w * 0.16);
    return [
      span('trim', [-w / 2, w / 2], [0, pl], [-d / 2, d / 2]),
      span('trim', [-w / 2 + 0.006, w / 2 - 0.006], [pl, pl + 0.025], [-d / 2, d / 2 - 0.004], o),
      span('body', [-w / 2 + 0.015, w / 2 - 0.015], [pl + 0.025, h - cap], [-d / 2, fz]),
      span('trim', [-w / 2 + 0.01, w / 2 - 0.01], [h - cap, h - cap + 0.02], [-d / 2, fz + 0.006], o),
      span('trim', [-w / 2 + 0.015, w / 2 - 0.015], [h - cap + 0.02, h - 0.06], [-d / 2, fz], o),
      span('trim', [-w / 2 + 0.006, w / 2 - 0.006], [h - 0.06, h - 0.035], [-d / 2, d / 2 - 0.005], o),
      span('trim', [-w / 2, w / 2], [h - 0.035, h], [-d / 2, d / 2], o),
      ...frame4('trim', [-px, px], [pl + 0.145, h - cap - 0.12], [fz, fz + 0.01], 0.016),
    ];
  },
});

const slatColumn = defineItem({
  id: 'slat-clad-square-column',
  name: 'Oak slat-clad square column',
  category: C,
  type: 'structure',
  group: 'Columns',
  tags: ['column', 'slats', 'battens', 'cladding', 'japandi', 'ốp lam gỗ'],
  description: 'A square structural column wrapped on all four sides in slim vertical oak battens, floating on a black shadow-gap base.',
  defaultSize: { w: 0.45, d: 0.45, h: 2.7 },
  minSize: { w: 0.2, d: 0.2, h: 2.0 },
  maxSize: { w: 1.5, d: 1.5, h: 4.5 },
  slots: [matSlot('slats', 'Slats', 'wood-oak-natural'), matSlot('core', 'Core', 'paint-charcoal'), matSlot('trim', 'Shadow-gap base', 'metal-black-matte')],
  variants: [
    { id: 'walnut', name: 'Walnut', materials: { slats: 'wood-walnut' } },
    { id: 'black', name: 'Black stained', materials: { slats: 'wood-ebony', core: 'paint-soft-black' } },
    { id: 'white', name: 'White oak', materials: { slats: 'wood-ash-white', core: 'paint-warm-white' } },
  ],
  build: ({ w, d, h }) => {
    const g = 0.06;
    const t = 0.022;
    const sw = 0.034;
    const parts: Part[] = [
      span('trim', [-w / 2 + 0.015, w / 2 - 0.015], [0, g], [-d / 2 + 0.015, d / 2 - 0.015]),
      span('core', [-w / 2 + t, w / 2 - t], [g, h], [-d / 2 + t, d / 2 - t], o),
    ];
    const nx = clamp(Math.round(w / 0.055), 3, 30);
    const nz = clamp(Math.round((d - 2 * t) / 0.055), 2, 30);
    for (const x of spaced(nx, -w / 2 + sw / 2, w / 2 - sw / 2)) {
      parts.push(span('slats', [x - sw / 2, x + sw / 2], [g, h], [d / 2 - t, d / 2]), span('slats', [x - sw / 2, x + sw / 2], [g, h], [-d / 2, -d / 2 + t]));
    }
    for (const z of spaced(nz, -d / 2 + t + sw / 2 + 0.01, d / 2 - t - sw / 2 - 0.01)) {
      parts.push(span('slats', [w / 2 - t, w / 2], [g, h], [z - sw / 2, z + sw / 2]), span('slats', [-w / 2, -w / 2 + t], [g, h], [z - sw / 2, z + sw / 2]));
    }
    return parts;
  },
});

const steelColumn = defineItem({
  id: 'steel-h-column',
  name: 'Exposed steel H-column',
  category: C,
  type: 'structure',
  group: 'Columns',
  tags: ['steel column', 'universal column', 'i-beam', 'industrial', 'loft', 'cột thép'],
  description: 'An exposed universal steel column (H section) on a bolted base plate with a cap plate at the ceiling, for loft and industrial interiors.',
  defaultSize: { w: 0.25, d: 0.25, h: 2.7 },
  minSize: { w: 0.15, d: 0.15, h: 2.0 },
  maxSize: { w: 0.5, d: 0.5, h: 4.5 },
  slots: [matSlot('steel', 'Steel section', 'metal-anthracite'), matSlot('bolts', 'Bolts', 'metal-brushed-steel')],
  variants: [
    { id: 'white', name: 'White powder coat', materials: { steel: 'metal-white-powder' } },
    { id: 'red-oxide', name: 'Red oxide primer', materials: { steel: 'paint-oxblood' } },
    { id: 'raw', name: 'Raw steel', materials: { steel: 'metal-gunmetal' } },
  ],
  build: ({ w, d, h }) => {
    const bp = 0.02;
    const tf = clamp(w * 0.07, 0.01, 0.025);
    const tw = tf * 0.65;
    const fz = d / 2 - 0.03;
    const bf = w - 0.03;
    const parts: Part[] = [
      span('steel', [-w / 2, w / 2], [0, bp], [-d / 2, d / 2]),
      span('steel', [-w / 2, w / 2], [h - bp, h], [-d / 2, d / 2], o),
      span('steel', [-bf / 2, bf / 2], [bp, h - bp], [fz - tf, fz]),
      span('steel', [-bf / 2, bf / 2], [bp, h - bp], [-fz, -fz + tf]),
      span('steel', [-tw / 2, tw / 2], [bp, h - bp], [-fz + tf, fz - tf]),
    ];
    // Stiffener plates either side of the web at the foot and the head.
    for (const y of [[bp, bp + 0.12], [h - bp - 0.12, h - bp]] as V2[]) {
      for (const s of [-1, 1]) parts.push(span('steel', s < 0 ? [-bf / 2 + 0.005, -tw / 2] : [tw / 2, bf / 2 - 0.005], y, [-0.004, 0.004], o));
    }
    for (const x of [-w / 2 + 0.03, w / 2 - 0.03]) {
      for (const z of [-d / 2 + 0.015, d / 2 - 0.015]) {
        parts.push(
          cyl('bolts', [x, bp + 0.0015, z], 0.014, 0.003, { plan: false }),
          cyl('bolts', [x, bp + 0.011, z], 0.011, 0.016, { segments: 6, plan: false }),
          cyl('bolts', [x, h - bp - 0.0015, z], 0.014, 0.003, { plan: false }),
          cyl('bolts', [x, h - bp - 0.011, z], 0.011, 0.016, { segments: 6, plan: false }),
        );
      }
    }
    return parts;
  },
});

const mushroomColumn = defineItem({
  id: 'mushroom-concrete-column',
  name: 'Board-formed mushroom column',
  category: C,
  type: 'structure',
  group: 'Columns',
  tags: ['column', 'mushroom column', 'concrete', 'brutalist', 'flared capital', 'cột nấm'],
  description: 'A round board-formed concrete column whose shaft flares into a wide mushroom capital under the slab, with a slim steel floor collar.',
  defaultSize: { w: 1.2, d: 1.2, h: 2.7 },
  minSize: { w: 0.6, d: 0.6, h: 2.2 },
  maxSize: { w: 2.4, d: 2.4, h: 4.5 },
  slots: [matSlot('concrete', 'Concrete', 'concrete-grey'), matSlot('collar', 'Floor collar', 'metal-black-matte')],
  variants: [
    { id: 'white', name: 'White concrete', materials: { concrete: 'microcement' } },
    { id: 'plaster', name: 'Lime plaster', materials: { concrete: 'limewash-warm', collar: 'metal-brass' } },
  ],
  build: ({ w, d, h }) => {
    const R = Math.min(w, d) / 2;
    const sc: V3 = [w / (2 * R), 1, d / (2 * R)];
    const rs = clamp(R * 0.3, 0.12, 0.3);
    const capH = clamp(R * 0.75, 0.35, 0.9);
    const yc = h - capH;
    const flare: V2[] = [[0, 0], ...range(8).map((i) => {
      const t = i / 7;
      return [rs + (R * 0.98 - rs) * Math.pow(t, 2.2), t * (capH - 0.09)] as V2;
    }), [R, capH - 0.06], [R, capH], [0, capH]];
    const parts: Part[] = [
      cyl('collar', [0, 0.012, 0], rs * 1.12, 0.024, { segments: 40 }),
      lathe('concrete', [0, 0.024, 0], [[0, 0], [rs * 1.04, 0], [rs * 1.02, (yc - 0.024) * 0.5], [rs, yc - 0.024], [0, yc - 0.024]], { segments: 40, scale: sc }),
      lathe('concrete', [0, yc, 0], flare, { segments: 48, scale: sc, plan: false }),
    ];
    // Board-form joints: shallow rings every 0.3 m up the shaft.
    for (let y = 0.3; y < yc - 0.1; y += 0.3) {
      parts.push(torus('concrete', [0, y, 0], rs * 1.03, 0.004, { rotation: [Math.PI / 2, 0, 0], scale: [sc[0], sc[2], 1], plan: false }));
    }
    return parts;
  },
  planDetail: ({ w, d }) => [poly(ellipsePoints(0, 0, w / 2, d / 2, 40))],
});

const marbleColumn = defineItem({
  id: 'marble-clad-square-column',
  name: 'Marble-clad column with brass inlays',
  category: C,
  type: 'structure',
  group: 'Columns',
  tags: ['column', 'marble', 'stone cladding', 'brass', 'luxury', 'ốp đá'],
  description: 'A square column clad in book-matched marble slabs, with brass joint lines between the courses, brass corner beads and a brass plinth.',
  defaultSize: { w: 0.5, d: 0.5, h: 2.7 },
  minSize: { w: 0.25, d: 0.25, h: 2.0 },
  maxSize: { w: 1.5, d: 1.5, h: 4.5 },
  slots: [matSlot('stone', 'Stone cladding', 'stone-marble-carrara'), matSlot('metal', 'Brass inlays', 'metal-brass')],
  variants: [
    { id: 'nero', name: 'Nero marble & gold', materials: { stone: 'stone-marble-nero', metal: 'metal-gold' } },
    { id: 'travertine', name: 'Travertine & bronze', materials: { stone: 'stone-travertine', metal: 'metal-bronze' } },
    { id: 'green', name: 'Green marble', materials: { stone: 'stone-marble-green' } },
  ],
  build: ({ w, d, h }) => {
    const base = 0.06;
    const top = 0.03;
    const joint = 0.008;
    const e = 0.012;
    const courses = Math.max(1, Math.ceil((h - base - top) / 1.2));
    const ch = (h - base - top) / courses;
    const parts: Part[] = [span('metal', [-w / 2, w / 2], [0, base], [-d / 2, d / 2]), span('metal', [-w / 2, w / 2], [h - top, h], [-d / 2, d / 2], o)];
    for (const c of range(courses)) {
      const y0 = base + c * ch;
      const y1 = y0 + ch - (c < courses - 1 ? joint : 0);
      parts.push(span('stone', [-w / 2 + e, w / 2 - e], [y0, y1], [-d / 2, d / 2]), span('stone', [-w / 2, w / 2], [y0, y1], [-d / 2 + e, d / 2 - e], o));
      if (c < courses - 1) parts.push(span('metal', [-w / 2 + 0.003, w / 2 - 0.003], [y1, y1 + joint], [-d / 2 + 0.003, d / 2 - 0.003], o));
    }
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) parts.push(span('metal', rg(sx * (w / 2 - e), (sx * w) / 2), [base, h - top], rg(sz * (d / 2 - e), (sz * d) / 2), o));
    }
    return parts;
  },
});

const mirrorColumn = defineItem({
  id: 'mirror-clad-column',
  name: 'Mirror-tiled column',
  category: C,
  type: 'structure',
  group: 'Columns',
  tags: ['column', 'mirror', 'bevelled mirror', 'glam', 'ốp gương', 'pillar'],
  description: 'A square column clad in bevelled mirror tiles with thin dark joints and a chrome skirting, making a bulky pillar almost disappear.',
  defaultSize: { w: 0.45, d: 0.45, h: 2.7 },
  minSize: { w: 0.25, d: 0.25, h: 2.0 },
  maxSize: { w: 1.0, d: 1.0, h: 4.5 },
  slots: [matSlot('mirror', 'Mirror tiles', 'glass-mirror'), matSlot('core', 'Joints', 'metal-anthracite'), matSlot('trim', 'Skirting', 'metal-chrome')],
  variants: [
    { id: 'smoked', name: 'Smoked mirror & brass', materials: { mirror: 'glass-tinted', trim: 'metal-brass' } },
    { id: 'gold', name: 'Gold trim', materials: { trim: 'metal-gold' } },
  ],
  build: ({ w, d, h }) => {
    const sk = 0.08;
    const t = 0.006;
    const g = 0.002;
    const parts: Part[] = [span('trim', [-w / 2, w / 2], [0, sk], [-d / 2, d / 2]), span('core', [-w / 2 + t, w / 2 - t], [sk, h], [-d / 2 + t, d / 2 - t], o)];
    const rows = clamp(Math.round((h - sk) / 0.4), 2, 12);
    const cx = clamp(Math.round(w / 0.45), 1, 3);
    const cz = clamp(Math.round(d / 0.45), 1, 3);
    for (const [y0, y1] of cellSpans(rows, sk, h)) {
      for (const [x0, x1] of cellSpans(cx, -w / 2, w / 2)) {
        parts.push(span('mirror', [x0 + g, x1 - g], [y0 + g, y1 - g], [d / 2 - t, d / 2], { bevel: 0.0025, plan: false }));
        parts.push(span('mirror', [x0 + g, x1 - g], [y0 + g, y1 - g], [-d / 2, -d / 2 + t], { bevel: 0.0025, plan: false }));
      }
      for (const [z0, z1] of cellSpans(cz, -d / 2, d / 2)) {
        parts.push(span('mirror', [w / 2 - t, w / 2], [y0 + g, y1 - g], [z0 + g, z1 - g], { bevel: 0.0025, plan: false }));
        parts.push(span('mirror', [-w / 2, -w / 2 + t], [y0 + g, y1 - g], [z0 + g, z1 - g], { bevel: 0.0025, plan: false }));
      }
    }
    return parts;
  },
});

const timberPortal = defineItem({
  id: 'timber-post-beam-frame',
  name: 'Timber post and beam frame',
  category: C,
  type: 'structure',
  group: 'Columns',
  tags: ['post and beam', 'timber frame', 'knee brace', 'beam', 'rustic', 'khung gỗ'],
  description: 'Two square oak posts carrying a deep beam, stiffened by knee braces, with black steel flitch plates and bolts at the joints.',
  defaultSize: { w: 2.4, d: 0.2, h: 2.7 },
  minSize: { w: 1.2, d: 0.12, h: 2.1 },
  maxSize: { w: 5.0, d: 0.35, h: 3.6 },
  slots: [matSlot('timber', 'Timber', 'wood-oak-natural'), matSlot('steel', 'Plates & bolts', 'metal-black-matte')],
  variants: [
    { id: 'dark', name: 'Dark stained', materials: { timber: 'wood-dark-stain' } },
    { id: 'reclaimed', name: 'Reclaimed pine', materials: { timber: 'wood-pine' } },
    { id: 'ironwood', name: 'Ironwood (gỗ lim)', materials: { timber: 'wood-ironwood' } },
  ],
  build: ({ w, d, h }) => {
    const pw = d * 0.8;
    const bh = clamp(w * 0.08, 0.18, 0.35);
    const yb = h - bh;
    const L = clamp(w * 0.22, 0.35, 0.75);
    const s = L / Math.SQRT2;
    const bt = pw * 0.6;
    const parts: Part[] = [span('timber', [-w / 2, w / 2], [yb, h], [-d / 2, d / 2], o)];
    for (const side of [-1, 1]) {
      const xo = (side * w) / 2;
      const xi = side * (w / 2 - pw);
      const [x0, x1] = rg(xo, xi);
      parts.push(span('timber', [x0, x1], [0, yb], [-pw / 2, pw / 2]));
      parts.push(bar('timber', [xi, yb - s - bt * 0.3, 0], [xi - side * (s + bt * 0.3), yb, 0], bt * 0.8, pw * 0.7, o));
      for (const z of [pw / 2, -pw / 2 - 0.006]) {
        parts.push(span('steel', [x0 + 0.01, x1 - 0.01], [yb - 0.3, yb + 0.12], [z, z + 0.006], o));
        for (const [bx, by] of [[0.3, 0.15], [0.7, 0.15], [0.3, 0.75], [0.7, 0.75]]) {
          parts.push(cyl('steel', [x0 + (x1 - x0) * bx, yb - 0.3 + 0.42 * by, z < 0 ? z - 0.002 : z + 0.008], 0.012, 0.004, { rotation: [Math.PI / 2, 0, 0], segments: 6, plan: false }));
        }
        parts.push(span('steel', [x0 + 0.01, x1 - 0.01], [0, 0.18], [z, z + 0.006], o));
      }
    }
    return keep(parts, { w, d, h });
  },
  planDetail: ({ w, d }) => [line([-w / 2, -d / 2], [w / 2, -d / 2]), line([-w / 2, d / 2], [w / 2, d / 2])],
});

const downstandBeam = defineItem({
  id: 'downstand-beam',
  name: 'Downstand ceiling beam',
  category: C,
  type: 'structure',
  group: 'Beams & ceilings',
  tags: ['beam', 'downstand', 'dầm', 'ceiling beam', 'concrete beam', 'bulkhead'],
  description: 'A plastered concrete beam dropping below the ceiling between two walls, with a small cove where it meets the slab.',
  defaultSize: { w: 3.0, d: 0.3, h: 0.4 },
  minSize: { w: 0.6, d: 0.15, h: 0.15 },
  maxSize: { w: 8.0, d: 0.8, h: 0.9 },
  mount: 'ceiling',
  defaultElevation: CEILING - 0.4,
  wallSnap: true,
  slots: [matSlot('finish', 'Finish', 'paint-ceiling-white')],
  variants: [
    { id: 'concrete', name: 'Fair-faced concrete', materials: { finish: 'concrete-grey' } },
    { id: 'timber', name: 'Timber-clad', materials: { finish: 'wood-oak-wide' } },
  ],
  build: ({ w, d, h }) => {
    const c = Math.min(0.03, d * 0.12);
    return [
      span('finish', [-w / 2, w / 2], [0, h], [-d / 2 + c, d / 2 - c]),
      span('finish', [-w / 2, w / 2], [h - c, h], [d / 2 - c, d / 2], o),
      span('finish', [-w / 2, w / 2], [h - c * 1.7, h - c], [d / 2 - c, d / 2 - c * 0.5], o),
      span('finish', [-w / 2, w / 2], [h - c, h], [-d / 2, -d / 2 + c], o),
      span('finish', [-w / 2, w / 2], [h - c * 1.7, h - c], [-d / 2 + c * 0.5, -d / 2 + c], o),
    ];
  },
  planDetail: ({ w, d }) => [line([-w / 2, -d / 2], [w / 2, d / 2]), line([-w / 2, d / 2], [w / 2, -d / 2])],
});

const ceilingJoists = defineItem({
  id: 'exposed-timber-ceiling-joists',
  name: 'Exposed timber ceiling joists',
  category: C,
  type: 'structure',
  group: 'Beams & ceilings',
  tags: ['beams', 'joists', 'rafters', 'timber ceiling', 'farmhouse', 'xà gỗ'],
  description: 'A run of exposed timber joists across a ceiling, resting on ledger boards at both ends in black steel joist hangers.',
  defaultSize: { w: 3.0, d: 3.0, h: 0.22 },
  minSize: { w: 1.2, d: 1.2, h: 0.12 },
  maxSize: { w: 6.0, d: 6.0, h: 0.4 },
  mount: 'ceiling',
  defaultElevation: CEILING - 0.22,
  slots: [matSlot('timber', 'Beams', 'wood-oak-natural'), matSlot('steel', 'Joist hangers', 'metal-black-matte')],
  variants: [
    { id: 'dark', name: 'Dark stained', materials: { timber: 'wood-dark-stain' } },
    { id: 'whitewashed', name: 'Whitewashed', materials: { timber: 'wood-whitewashed' } },
    { id: 'white', name: 'Painted white', materials: { timber: 'paint-satin-white', steel: 'metal-white-powder' } },
  ],
  build: ({ w, d, h }) => {
    const bw = 0.09;
    const lg = 0.06;
    const n = clamp(Math.round(w / 0.6), 2, 14);
    const parts: Part[] = [
      span('timber', [-w / 2, w / 2], [h * 0.35, h], [-d / 2, -d / 2 + lg]),
      span('timber', [-w / 2, w / 2], [h * 0.35, h], [d / 2 - lg, d / 2]),
    ];
    for (const x of spaced(n, -w / 2 + bw / 2 + 0.004, w / 2 - bw / 2 - 0.004)) {
      parts.push(span('timber', [x - bw / 2, x + bw / 2], [0, h], [-d / 2 + lg, d / 2 - lg]));
      for (const s of [-1, 1]) {
        const ze = s * (d / 2 - lg);
        parts.push(span('steel', [x - bw / 2 - 0.003, x + bw / 2 + 0.003], [0.02, h * 0.85], rg(ze, ze - s * 0.05), o));
      }
    }
    return parts;
  },
  planDetail: ({ w, d }) => spaced(clamp(Math.round(w / 0.6), 2, 14), -w / 2 + 0.049, w / 2 - 0.049).map((x) => line([x, -d / 2], [x, d / 2])),
});

const steelBeam = defineItem({
  id: 'steel-i-beam-ceiling',
  name: 'Exposed steel I-beam',
  category: C,
  type: 'structure',
  group: 'Beams & ceilings',
  tags: ['steel beam', 'i-beam', 'rsj', 'industrial', 'loft', 'dầm thép'],
  description: 'An exposed steel I-beam under the ceiling with welded web stiffeners and bolted end plates, as in an opened-up loft.',
  defaultSize: { w: 3.0, d: 0.18, h: 0.3 },
  minSize: { w: 1.0, d: 0.1, h: 0.15 },
  maxSize: { w: 8.0, d: 0.4, h: 0.6 },
  mount: 'ceiling',
  defaultElevation: CEILING - 0.3,
  wallSnap: true,
  slots: [matSlot('steel', 'Steel', 'metal-anthracite'), matSlot('bolts', 'Bolts', 'metal-brushed-steel')],
  variants: [
    { id: 'white', name: 'White powder coat', materials: { steel: 'metal-white-powder' } },
    { id: 'red-oxide', name: 'Red oxide primer', materials: { steel: 'paint-oxblood' } },
  ],
  build: ({ w, d, h }) => {
    const tf = clamp(h * 0.06, 0.01, 0.025);
    const tw = tf * 0.6;
    const ep = 0.015;
    const parts: Part[] = [
      span('steel', [-w / 2 + ep, w / 2 - ep], [h - tf, h], [-d / 2, d / 2]),
      span('steel', [-w / 2 + ep, w / 2 - ep], [0, tf], [-d / 2, d / 2]),
      span('steel', [-w / 2 + ep, w / 2 - ep], [tf, h - tf], [-tw / 2, tw / 2], o),
      span('steel', [-w / 2, -w / 2 + ep], [0, h], [-d / 2, d / 2], o),
      span('steel', [w / 2 - ep, w / 2], [0, h], [-d / 2, d / 2], o),
    ];
    const n = clamp(Math.round(w / 0.75), 2, 12);
    for (const x of spaced(n, -w / 2 + 0.3, w / 2 - 0.3)) {
      parts.push(span('steel', [x - 0.005, x + 0.005], [tf, h - tf], [tw / 2, d / 2 - 0.005], o), span('steel', [x - 0.005, x + 0.005], [tf, h - tf], [-d / 2 + 0.005, -tw / 2], o));
    }
    for (const x of [-w / 2 + ep, w / 2 - ep]) {
      for (const [y, z] of [[0.3, 0.3], [0.3, 0.7], [0.7, 0.3], [0.7, 0.7]]) {
        const pz = -d / 2 + d * z;
        const py = tf + (h - 2 * tf) * y;
        parts.push(rod('bolts', [x, py, pz], [x + (x < 0 ? 0.012 : -0.012), py, pz], 0.009, { segments: 6, plan: false }));
      }
    }
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w / 2, -d / 2], [w / 2, d / 2]), line([-w / 2, d / 2], [w / 2, -d / 2])],
});

// ---------------------------------------------------------------------------
// Ceilings, soffits and boxing
// ---------------------------------------------------------------------------

const cofferedCeiling = defineItem({
  id: 'coffered-ceiling',
  name: 'Coffered ceiling grid',
  category: C,
  type: 'structure',
  group: 'Beams & ceilings',
  tags: ['coffered ceiling', 'waffle ceiling', 'ceiling beams', 'trần ô vuông', 'classic', 'moulding'],
  description: 'A grid of deep painted beams forming square coffers, each with a stepped moulding and a recessed panel in a contrasting colour.',
  defaultSize: { w: 2.4, d: 2.4, h: 0.2 },
  minSize: { w: 1.2, d: 1.2, h: 0.12 },
  maxSize: { w: 6.0, d: 6.0, h: 0.4 },
  mount: 'ceiling',
  defaultElevation: CEILING - 0.2,
  slots: [matSlot('beams', 'Beams', 'paint-satin-white'), matSlot('panel', 'Coffer panels', 'paint-greige'), matSlot('trim', 'Mouldings', 'paint-satin-white')],
  variants: [
    { id: 'walnut', name: 'Walnut beams', materials: { beams: 'wood-walnut', trim: 'wood-walnut', panel: 'paint-warm-white' } },
    { id: 'navy', name: 'Navy coffers', materials: { panel: 'paint-navy' } },
    { id: 'grasscloth', name: 'Grasscloth coffers', materials: { panel: 'grasscloth-natural' } },
  ],
  build: ({ w, d, h }) => {
    const bw = 0.12;
    const nx = clamp(Math.round(w / 0.8), 1, 4);
    const nz = clamp(Math.round(d / 0.8), 1, 4);
    const xs = spaced(nx + 1, -w / 2 + bw / 2, w / 2 - bw / 2);
    const zs = spaced(nz + 1, -d / 2 + bw / 2, d / 2 - bw / 2);
    const parts: Part[] = xs.map((x) => span('beams', [x - bw / 2, x + bw / 2], [0, h], [-d / 2, d / 2]));
    const ym: V2 = [h * 0.45, h * 0.45 + 0.025];
    for (const i of range(nx)) {
      const [cx0, cx1] = [xs[i] + bw / 2, xs[i + 1] - bw / 2];
      for (const z of zs) parts.push(span('beams', [cx0, cx1], [0, h], [z - bw / 2, z + bw / 2]));
      for (const j of range(nz)) {
        const [cz0, cz1] = [zs[j] + bw / 2, zs[j + 1] - bw / 2];
        parts.push(
          span('panel', [cx0, cx1], [h - 0.015, h], [cz0, cz1], o),
          span('trim', [cx0, cx1], ym, [cz0, cz0 + 0.025], o),
          span('trim', [cx0, cx1], ym, [cz1 - 0.025, cz1], o),
          span('trim', [cx0, cx0 + 0.025], ym, [cz0 + 0.025, cz1 - 0.025], o),
          span('trim', [cx1 - 0.025, cx1], ym, [cz0 + 0.025, cz1 - 0.025], o),
        );
      }
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const xs = spaced(clamp(Math.round(w / 0.8), 1, 4) + 1, -w / 2 + 0.06, w / 2 - 0.06);
    const zs = spaced(clamp(Math.round(d / 0.8), 1, 4) + 1, -d / 2 + 0.06, d / 2 - 0.06);
    return [...xs.map((x) => line([x, -d / 2], [x, d / 2])), ...zs.map((z) => line([-w / 2, z], [w / 2, z]))];
  },
});

const trayCeiling = defineItem({
  id: 'tray-ceiling-led-cove',
  name: 'Tray ceiling with LED cove',
  category: C,
  type: 'structure',
  group: 'Beams & ceilings',
  tags: ['tray ceiling', 'drop ceiling', 'LED cove', 'trần giật cấp', 'trần thạch cao', 'downlights'],
  description: 'A plasterboard drop ceiling around the room edge with a hidden LED strip glowing up into the raised centre and recessed downlights in the band.',
  defaultSize: { w: 3.6, d: 3.0, h: 0.3 },
  minSize: { w: 1.6, d: 1.4, h: 0.18 },
  maxSize: { w: 8.0, d: 8.0, h: 0.5 },
  mount: 'ceiling',
  defaultElevation: CEILING - 0.3,
  slots: [matSlot('board', 'Plasterboard', 'paint-ceiling-white'), matSlot('glow', 'LED cove & downlights', 'light-warm'), matSlot('trim', 'Downlight rims', 'metal-white-powder')],
  variants: [
    { id: 'cool', name: 'Cool white LEDs', materials: { glow: 'light-cool' } },
    { id: 'brass', name: 'Brass rims', materials: { trim: 'metal-brass' } },
  ],
  build: ({ w, d, h }) => {
    const b = clamp(Math.min(w, d) * 0.15, 0.35, 0.8);
    const lip = 0.12;
    const bo = b - lip;
    const g = Math.min(0.1, h * 0.4);
    const yb = 0.012;
    const parts: Part[] = [];
    const frame = (w0: number, d0: number, t: number, y: V2, slot: string, plan = true) => {
      const opt = plan ? undefined : o;
      parts.push(
        span(slot, [-w0 / 2, w0 / 2], y, [d0 / 2 - t, d0 / 2], opt),
        span(slot, [-w0 / 2, w0 / 2], y, [-d0 / 2, -d0 / 2 + t], opt),
        span(slot, [-w0 / 2, -w0 / 2 + t], y, [-d0 / 2 + t, d0 / 2 - t], opt),
        span(slot, [w0 / 2 - t, w0 / 2], y, [-d0 / 2 + t, d0 / 2 - t], opt),
      );
    };
    frame(w, d, bo, [yb, h], 'board');
    frame(w - 2 * bo, d - 2 * bo, lip, [yb, h - g], 'board');
    frame(w - 2 * b + 0.04, d - 2 * b + 0.04, 0.02, [h - g, h - g + 0.05], 'board', false);
    frame(w - 2 * b + 0.12, d - 2 * b + 0.12, 0.02, [h - g, h - g + 0.012], 'glow', false);
    const lights: V2[] = [];
    const kx = clamp(Math.round((w - 2 * b) / 1.0), 1, 6);
    const kz = clamp(Math.round((d - 2 * b) / 1.0), 1, 6);
    for (const x of cells(kx, -w / 2 + b, w / 2 - b)) lights.push([x, d / 2 - b / 2], [x, -d / 2 + b / 2]);
    for (const z of cells(kz, -d / 2 + b, d / 2 - b)) lights.push([w / 2 - b / 2, z], [-w / 2 + b / 2, z]);
    for (const [x, z] of lights) parts.push(ring('trim', [x, 0.006, z], 0.042, 0.006, o), cyl('glow', [x, 0.007, z], 0.037, 0.008, o));
    return parts;
  },
  planDetail: ({ w, d }) => {
    const b = clamp(Math.min(w, d) * 0.15, 0.35, 0.8);
    return [rectPoly(-w / 2 + b, -d / 2 + b, w / 2 - b, d / 2 - b)];
  },
});

const kitchenSoffit = defineItem({
  id: 'kitchen-soffit-downlights',
  name: 'Kitchen soffit with downlights',
  category: C,
  type: 'structure',
  group: 'Beams & ceilings',
  tags: ['soffit', 'bulkhead', 'kitchen', 'downlights', 'crown moulding', 'trần bếp'],
  description: 'A boxed soffit over wall cabinets that closes the gap to the ceiling, finished with a bead moulding and a row of recessed LED downlights.',
  defaultSize: { w: 2.4, d: 0.4, h: 0.35 },
  minSize: { w: 0.6, d: 0.25, h: 0.15 },
  maxSize: { w: 6.0, d: 0.8, h: 0.8 },
  mount: 'ceiling',
  defaultElevation: CEILING - 0.35,
  wallSnap: true,
  slots: [matSlot('finish', 'Soffit', 'paint-satin-white'), matSlot('trim', 'Mouldings & rims', 'paint-satin-white'), matSlot('glow', 'Downlights', 'light-warm')],
  variants: [
    { id: 'sage', name: 'Sage', materials: { finish: 'paint-sage', trim: 'paint-sage' } },
    { id: 'oak', name: 'Oak-clad', materials: { finish: 'wood-oak-natural', trim: 'wood-oak-natural' } },
  ],
  build: ({ w, d, h }) => {
    const parts: Part[] = [
      span('finish', [-w / 2, w / 2], [0.035, h], [-d / 2, d / 2 - 0.02]),
      span('trim', [-w / 2, w / 2], [0.012, 0.035], [-d / 2, d / 2]),
      rod('trim', [-w / 2, 0.03, d / 2 - 0.012], [w / 2, 0.03, d / 2 - 0.012], 0.012, { plan: false }),
      span('trim', [-w / 2, w / 2], [h - 0.025, h], [d / 2 - 0.02, d / 2], o),
    ];
    const zc = -0.02;
    for (const x of cells(clamp(Math.round(w / 0.6), 1, 10), -w / 2, w / 2)) {
      parts.push(ring('trim', [x, 0.006, zc], 0.04, 0.006, o), cyl('glow', [x, 0.007, zc], 0.034, 0.008, o));
    }
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w / 2, -d / 2], [w / 2, d / 2]), line([-w / 2, d / 2], [w / 2, -d / 2])],
});

const pipeRiser = defineItem({
  id: 'pipe-riser-boxing',
  name: 'Boxed-in pipe riser with access hatches',
  category: C,
  type: 'structure',
  group: 'Built-ins',
  tags: ['boxing', 'pipe box', 'riser', 'hộp kỹ thuật', 'access panel', 'soil stack'],
  description: 'A plasterboard box hiding soil and water pipes in a room corner, with skirting on its exposed faces and two framed access hatches with cam locks.',
  defaultSize: { w: 0.35, d: 0.3, h: 2.7 },
  minSize: { w: 0.15, d: 0.12, h: 2.0 },
  maxSize: { w: 1.2, d: 1.0, h: 4.0 },
  wallSnap: true,
  slots: [matSlot('board', 'Plasterboard', 'plaster-white'), matSlot('trim', 'Skirting & hatches', 'paint-satin-white'), matSlot('metal', 'Cam locks', 'metal-chrome')],
  variants: [
    { id: 'tiled', name: 'Tiled (bathroom)', materials: { board: 'tile-subway-white' } },
    { id: 'greige', name: 'Greige', materials: { board: 'paint-greige', trim: 'paint-greige' } },
  ],
  build: ({ w, d, h }) => {
    const e = 0.012;
    const zf = d / 2 - e;
    const parts: Part[] = [
      span('board', [-w / 2, w / 2 - e], [0, h], [-d / 2, zf]),
      span('trim', [-w / 2, w / 2], [0, 0.1], [zf, d / 2]),
      span('trim', [w / 2 - e, w / 2], [0, 0.1], [-d / 2, zf]),
    ];
    const hw = Math.min(0.3, w - 0.06);
    for (const [y0, hh] of [[0.9, Math.min(0.5, hw * 1.6)], [0.22, Math.min(0.22, hw)]] as V2[]) {
      const x: V2 = [-hw / 2 - 0.006, hw / 2 + 0.006];
      parts.push(...frame4('trim', x, [y0, y0 + hh], [zf, zf + 0.008], 0.014));
      parts.push(span('trim', [-hw / 2 + 0.01, hw / 2 - 0.01], [y0 + 0.016, y0 + hh - 0.016], [zf, zf + 0.004], o));
      for (const s of [-1, 1]) parts.push(cyl('metal', [s * (hw / 2 - 0.035), y0 + hh - 0.05, zf + 0.007], 0.009, 0.006, { rotation: [Math.PI / 2, 0, 0], plan: false }));
    }
    return parts;
  },
});

const cornerChase = defineItem({
  id: 'l-shaped-corner-duct-chase',
  name: 'L-shaped corner duct chase',
  category: C,
  type: 'structure',
  group: 'Built-ins',
  tags: ['chase', 'duct', 'boxing', 'hộp gen', 'service void', 'riser'],
  description: 'An L-shaped plasterboard chase wrapping a room corner to hide ducts and risers, with skirting, a vent grille near the top and a side access panel.',
  defaultSize: { w: 0.6, d: 0.6, h: 2.7 },
  minSize: { w: 0.3, d: 0.3, h: 2.0 },
  maxSize: { w: 1.5, d: 1.5, h: 4.0 },
  wallSnap: true,
  slots: [matSlot('board', 'Plasterboard', 'plaster-white'), matSlot('trim', 'Skirting & panel', 'paint-satin-white'), matSlot('grille', 'Vent grille', 'metal-white-powder')],
  variants: [{ id: 'charcoal', name: 'Charcoal', materials: { board: 'paint-charcoal', trim: 'paint-charcoal', grille: 'metal-black-matte' } }],
  build: ({ w, d, h }) => {
    const t = clamp(Math.min(w, d) * 0.4, 0.12, 0.35);
    const e = 0.012;
    const L = (k: number): V2[] => [
      [-w / 2, -d / 2],
      [w / 2 - k, -d / 2],
      [w / 2 - k, -d / 2 + t - k],
      [-w / 2 + t - k, -d / 2 + t - k],
      [-w / 2 + t - k, d / 2 - k],
      [-w / 2, d / 2 - k],
    ];
    const parts: Part[] = [prism('trim', L(0), 0, 0.1), prism('board', L(e), 0.1, h - 0.1)];
    const zf = -d / 2 + t - e;
    const gx: V2 = [-w / 2 + t + 0.04, Math.min(w / 2 - 0.04, -w / 2 + t + 0.44)];
    if (gx[1] - gx[0] > 0.12) {
      parts.push(...frame4('grille', gx, [h - 0.3, h - 0.12], [zf, zf + 0.008], 0.014));
      for (const y of spaced(6, h - 0.28, h - 0.14)) parts.push(span('grille', [gx[0] + 0.014, gx[1] - 0.014], [y - 0.005, y + 0.005], [zf, zf + 0.006], o));
    }
    const xf = -w / 2 + t - e;
    const zr: V2 = [-d / 2 + t + 0.03, Math.min(d / 2 - 0.04, -d / 2 + t + 0.4)];
    if (zr[1] - zr[0] > 0.12) {
      parts.push(span('trim', [xf, xf + 0.008], [0.9, 1.5], zr, o));
      parts.push(cyl('grille', [xf + 0.01, 1.42, (zr[0] + zr[1]) / 2], 0.009, 0.006, { rotation: [0, 0, Math.PI / 2], plan: false }));
    }
    return parts;
  },
});

// ---------------------------------------------------------------------------
// Built-in joinery and seating
// ---------------------------------------------------------------------------

const windowSeatBookcases = defineItem({
  id: 'window-seat-with-bookcases',
  name: 'Window seat with flanking bookcases',
  category: C,
  type: 'structure',
  group: 'Built-ins',
  tags: ['window seat', 'built-in', 'bookcase', 'reading nook', 'joinery', 'ghế bên cửa sổ'],
  description: 'Floor-to-ceiling painted joinery framing a window: bookcases with cupboards below on both sides, a drawer-base seat with a linen cushion and pillows, and a bridging header.',
  defaultSize: { w: 2.6, d: 0.5, h: 2.5 },
  minSize: { w: 1.8, d: 0.38, h: 2.0 },
  maxSize: { w: 4.0, d: 0.7, h: 3.2 },
  wallSnap: true,
  slots: [matSlot('joinery', 'Joinery', 'paint-satin-white'), matSlot('cushion', 'Cushions', 'fabric-linen'), matSlot('books', 'Books', 'book-mix'), matSlot('metal', 'Knobs', 'metal-brass')],
  variants: [
    { id: 'sage', name: 'Sage & oat', materials: { joinery: 'paint-sage', cushion: 'fabric-boucle-oat' } },
    { id: 'navy', name: 'Navy & mustard', materials: { joinery: 'paint-navy', cushion: 'fabric-mustard' } },
    { id: 'oak', name: 'Oak & rust', materials: { joinery: 'wood-oak-natural', cushion: 'fabric-linen-rust', metal: 'metal-black-matte' } },
  ],
  build: (size) => {
    const { w, d, h } = size;
    const t = 0.022;
    const tw = clamp(w * 0.24, 0.4, 0.8);
    const seatH = 0.44;
    const plinth = 0.08;
    const header = clamp(h * 0.12, 0.22, 0.4);
    const zb = -d / 2;
    const zf = d / 2 - 0.055;
    const cupTop = 0.9;
    const parts: Part[] = [];
    for (const s of [-1, 1]) {
      const [a, b] = rg((s * w) / 2, s * (w / 2 - tw));
      parts.push(
        span('joinery', [a, a + t], [0, h], [zb, zf]),
        span('joinery', [b - t, b], [0, h], [zb, zf]),
        span('joinery', [a + t, b - t], [h - t, h], [zb, zf], o),
        span('joinery', [a + t, b - t], [0, plinth], [zb, zf - 0.04], o),
        span('joinery', [a + t, b - t], [plinth, h - t], [zb, zb + 0.012], o),
        span('joinery', [a + t, b - t], [cupTop - t, cupTop], [zb + 0.012, zf + 0.02], o),
      );
      const nd = b - a > 0.6 ? 2 : 1;
      for (const [i, [x0, x1]] of cellSpans(nd, a, b).entries()) {
        parts.push(...shakerFront('joinery', [x0, x1], [plinth, cupTop - t], zf, 0.02, { rail: 0.06 }));
        const kx = nd === 1 ? (s < 0 ? x1 - 0.05 : x0 + 0.05) : i === 0 ? x1 - 0.04 : x0 + 0.04;
        parts.push(...knob('metal', [kx, cupTop - 0.1, zf + 0.02], 0.013));
      }
      const ns = clamp(Math.round((h - t - cupTop) / 0.36), 3, 5);
      const pitch = (h - t - cupTop) / ns;
      for (let k = 1; k < ns; k++) parts.push(span('joinery', [a + t, b - t], [cupTop + k * pitch - t, cupTop + k * pitch], [zb + 0.012, zf - 0.005], o));
      const sw = b - a - 2 * t;
      for (const k of [0, 1, 3]) {
        if (k >= ns) continue;
        parts.push(...bookRow('books', [a + t, b - t], cupTop + k * pitch, zb + 0.03, Math.min(0.28, pitch - 0.06), Math.min(0.22, d - 0.12), 11 + k * 7 + (s > 0 ? 3 : 0), { fill: Math.min(0.8, 0.4 / sw), minW: 0.03, maxW: 0.055 }));
      }
    }
    const [sx0, sx1] = [-w / 2 + tw, w / 2 - tw];
    const seatW = sx1 - sx0;
    parts.push(
      span('joinery', [sx0, sx1], [0, plinth], [zb, zf - 0.04]),
      span('joinery', [sx0, sx1], [plinth, seatH - 0.025], [zb, zf], o),
      span('joinery', [sx0, sx1], [seatH - 0.025, seatH], [zb, d / 2 - 0.01], o),
      cushion('cushion', [sx0 + 0.01, sx1 - 0.01], [seatH, seatH + 0.08], [zb + 0.01, d / 2 - 0.02], { softness: 0.4 }),
      span('joinery', [sx0, sx1], [h - header, h], [zb, zf], o),
      span('joinery', [-w / 2, w / 2], [h - 0.05, h], [zf, d / 2 - 0.02], o),
    );
    const nd = clamp(Math.round(seatW / 0.6), 1, 3);
    for (const [x0, x1] of cellSpans(nd, sx0, sx1)) {
      parts.push(...shakerFront('joinery', [x0, x1], [plinth, seatH - 0.03], zf, 0.02, { rail: 0.05 }));
      parts.push(...knob('metal', [(x0 + x1) / 2, (plinth + seatH) / 2, zf + 0.02], 0.013));
    }
    const np = clamp(Math.round(seatW / 0.5), 2, 5);
    for (const [i, x] of cells(np, sx0, sx1).entries()) {
      const pw = Math.min(0.42, seatW / np - 0.03);
      parts.push(squarePillow('cushion', [x, seatH + 0.08 + 0.19, zb + 0.15], pw, 0.38, 0.14, 0.25, (i % 2 ? 1 : -1) * 0.08));
    }
    return keep(parts, size);
  },
});

const storageWindowSeat = defineItem({
  id: 'storage-window-seat',
  name: 'Storage window seat with drawers',
  category: C,
  type: 'structure',
  group: 'Built-ins',
  tags: ['window seat', 'bench', 'storage bench', 'bay window', 'built-in', 'ghế cửa sổ'],
  description: 'A built-in oak window seat with deep drawers, a thick bouclé cushion, sage linen pillows against the glass and a folded throw.',
  defaultSize: { w: 1.6, d: 0.55, h: 0.88 },
  minSize: { w: 0.8, d: 0.4, h: 0.6 },
  maxSize: { w: 3.0, d: 0.8, h: 1.0 },
  wallSnap: true,
  slots: [matSlot('base', 'Base', 'wood-oak-natural'), matSlot('cushion', 'Seat cushion', 'fabric-boucle-oat'), matSlot('pillows', 'Pillows & throw', 'fabric-linen-sage'), matSlot('pulls', 'Pulls', 'metal-black-matte')],
  variants: [
    { id: 'white', name: 'White & blue', materials: { base: 'paint-satin-white', cushion: 'fabric-linen', pillows: 'fabric-sky' } },
    { id: 'walnut', name: 'Walnut & rust', materials: { base: 'wood-walnut', pillows: 'fabric-linen-rust', pulls: 'metal-brass' } },
    { id: 'green', name: 'Green velvet', materials: { cushion: 'fabric-velvet-green', pillows: 'fabric-mustard' } },
  ],
  build: (size) => {
    const { w, d, h } = size;
    const seatH = Math.min(0.42, h - 0.3);
    const cu = 0.08;
    const plinth = 0.07;
    const zf = d / 2 - 0.055;
    const parts: Part[] = [
      span('base', [-w / 2 + 0.03, w / 2 - 0.03], [0, plinth], [-d / 2, zf - 0.04], o),
      span('base', [-w / 2, w / 2], [plinth, seatH - 0.03], [-d / 2, zf]),
      span('base', [-w / 2, w / 2], [seatH - 0.03, seatH], [-d / 2, d / 2]),
      cushion('cushion', [-w / 2 + 0.01, w / 2 - 0.01], [seatH, seatH + cu], [-d / 2 + 0.01, d / 2 - 0.01], { softness: 0.4 }),
    ];
    const n = clamp(Math.round(w / 0.5), 1, 5);
    for (const [x0, x1] of cellSpans(n, -w / 2, w / 2)) {
      parts.push(span('base', [x0 + 0.003, x1 - 0.003], [plinth + 0.01, seatH - 0.04], [zf, zf + 0.018], { bevel: 0.004, plan: false }));
      parts.push(...barPull('pulls', [(x0 + x1) / 2, seatH - 0.1, zf + 0.018], Math.min(0.2, (x1 - x0) * 0.4)));
    }
    const top = seatH + cu;
    const ph = Math.min(0.4, (h - top) * 0.92);
    const k = clamp(Math.round(w / 0.45), 2, 6);
    for (const [i, x] of cells(k, -w / 2 + 0.05, w / 2 - (w > 1.2 ? 0.4 : 0.05)).entries()) {
      const pw = Math.min(0.42, (w - 0.4) / k);
      parts.push(squarePillow(i % 2 ? 'cushion' : 'pillows', [x, top + ph / 2, -d / 2 + 0.14], pw, ph, 0.13, 0.22, (i % 2 ? 1 : -1) * 0.1));
    }
    if (w > 1.2) parts.push(cushion('pillows', [w / 2 - 0.4, w / 2 - 0.06], [top, top + 0.045], [-d / 2 + 0.08, d / 2 - 0.06], { softness: 0.45, plan: false }));
    return keep(parts, size);
  },
});

const banquette = defineItem({
  id: 'built-in-booth-banquette',
  name: 'Built-in banquette with channel-tufted back',
  category: 'dining',
  type: 'seating',
  group: 'Stools & benches',
  tags: ['banquette', 'booth', 'bench seating', 'built-in', 'dining nook', 'ghế băng'],
  description: 'A wall-to-wall booth bench: a panelled painted base with end panels, a deep seat cushion and a channel-tufted upholstered back under an oak ledge.',
  defaultSize: { w: 1.8, d: 0.65, h: 1.05 },
  minSize: { w: 0.9, d: 0.5, h: 0.85 },
  maxSize: { w: 4.0, d: 0.8, h: 1.3 },
  wallSnap: true,
  slots: [matSlot('base', 'Base & ends', 'paint-sage'), matSlot('fabric', 'Upholstery', 'fabric-boucle-oat'), matSlot('cap', 'Top ledge', 'wood-oak-natural')],
  variants: [
    { id: 'green-velvet', name: 'Green velvet', materials: { fabric: 'fabric-velvet-green', base: 'paint-warm-white' } },
    { id: 'cognac', name: 'Cognac leather', materials: { fabric: 'leather-cognac', base: 'paint-charcoal' } },
    { id: 'rust', name: 'Rust velvet', materials: { fabric: 'fabric-velvet-rust', base: 'paint-mushroom', cap: 'wood-walnut' } },
  ],
  build: ({ w, d, h }) => {
    const seatH = 0.46;
    const plinth = 0.1;
    const et = 0.03;
    const [x0, x1] = [-w / 2 + et, w / 2 - et];
    const zfp = d / 2 - 0.03;
    const parts: Part[] = [
      span('base', [-w / 2, -w / 2 + et], [0, h - 0.04], [-d / 2, d / 2 - 0.02]),
      span('base', [w / 2 - et, w / 2], [0, h - 0.04], [-d / 2, d / 2 - 0.02]),
      span('base', [x0, x1], [0, plinth], [-d / 2, d / 2 - 0.08], o),
      span('base', [x0, x1], [plinth, seatH - 0.08], [-d / 2, zfp]),
      span('base', [x0, x1], [seatH - 0.08, seatH - 0.06], [-d / 2, d / 2 - 0.005], o),
      cushion('fabric', [x0 + 0.005, x1 - 0.005], [seatH - 0.06, seatH + 0.04], [-d / 2 + 0.15, d / 2 - 0.01], { softness: 0.35 }),
      span('base', [x0, x1], [seatH - 0.06, h - 0.06], [-d / 2, -d / 2 + 0.03], o),
      span('cap', [-w / 2, w / 2], [h - 0.06, h - 0.02], [-d / 2, -d / 2 + 0.17], o),
      span('cap', [-w / 2, w / 2], [h - 0.02, h], [-d / 2, -d / 2 + 0.19], o),
    ];
    for (const [a, b] of cellSpans(clamp(Math.round((x1 - x0) / 0.45), 1, 8), x0, x1)) {
      parts.push(...frame4('base', [a + 0.06, b - 0.06], [plinth + 0.05, seatH - 0.13], [zfp, zfp + 0.012], 0.016));
    }
    for (const [a, b] of cellSpans(clamp(Math.round((x1 - x0) / 0.16), 4, 24), x0, x1)) {
      parts.push(cushion('fabric', [a + 0.003, b - 0.003], [seatH + 0.04, h - 0.07], [-d / 2 + 0.03, -d / 2 + 0.14], { softness: 0.45, plan: false }));
    }
    return parts;
  },
});

const mediaWall = defineItem({
  id: 'built-in-media-wall',
  name: 'Built-in media wall with fluted panel',
  category: 'living',
  type: 'storage',
  group: 'Media units',
  tags: ['media wall', 'tv wall', 'built-in', 'fluted', 'kệ tivi âm tường', 'LED shelves'],
  description: 'A full-height TV wall: a fluted oak back panel for the screen over a floating drawer console, flanked by cabinets with oak shelves lit by LED strips, under a bridging header.',
  defaultSize: { w: 3.2, d: 0.45, h: 2.7 },
  minSize: { w: 2.2, d: 0.35, h: 2.2 },
  maxSize: { w: 5.0, d: 0.6, h: 3.2 },
  wallSnap: true,
  slots: [matSlot('joinery', 'Cabinetry', 'laminate-greige'), matSlot('fluted', 'Fluted panel', 'wood-fluted-oak'), matSlot('shelves', 'Shelves & top', 'wood-oak-natural'), matSlot('glow', 'LED strips', 'light-warm')],
  variants: [
    { id: 'white', name: 'White & walnut', materials: { joinery: 'laminate-white-matte', fluted: 'wood-fluted-walnut', shelves: 'wood-walnut' } },
    { id: 'charcoal', name: 'Charcoal & oak', materials: { joinery: 'laminate-black' } },
    { id: 'marble', name: 'Marble feature', materials: { fluted: 'stone-marble-carrara', joinery: 'laminate-white-matte' } },
  ],
  build: ({ w, d, h }) => {
    const t = 0.02;
    const tw = clamp(w * 0.2, 0.45, 0.8);
    const cw = w - 2 * tw;
    const zb = -d / 2;
    const zf = d / 2 - 0.02;
    const plinth = 0.08;
    const doorTop = 0.95;
    const hdr = 0.4;
    const parts: Part[] = [];
    for (const s of [-1, 1]) {
      const [a, b] = rg((s * w) / 2, s * (w / 2 - tw));
      parts.push(
        span('joinery', [a, a + t], [0, h], [zb, zf]),
        span('joinery', [b - t, b], [0, h], [zb, zf]),
        span('joinery', [a + t, b - t], [h - t, h], [zb, zf], o),
        span('joinery', [a + t, b - t], [plinth, h - t], [zb, zb + 0.012], o),
        span('joinery', [a + t, b - t], [0, plinth], [zb, zf - 0.03], o),
        span('joinery', [a + t, b - t], [doorTop - t, doorTop], [zb + 0.012, zf], o),
      );
      for (const [x0, x1] of cellSpans(b - a > 0.6 ? 2 : 1, a, b)) parts.push(span('joinery', [x0 + 0.0015, x1 - 0.0015], [plinth + 0.003, doorTop - 0.003], [zf, d / 2], o));
      const ns = 3;
      const pitch = (h - t - doorTop) / (ns + 1);
      for (const k of range(ns)) {
        const y = doorTop + (k + 1) * pitch;
        parts.push(span('shelves', [a + t, b - t], [y - 0.03, y], [zb + 0.012, zf - 0.01], o));
        parts.push(span('glow', [a + t + 0.01, b - t - 0.01], [y - 0.038, y - 0.03], [zf - 0.06, zf - 0.045], o));
      }
    }
    const dc = Math.min(0.42, d - 0.02);
    const ze = zb + dc;
    parts.push(
      span('fluted', [-cw / 2, cw / 2], [0.48, h - hdr], [zb, zb + 0.025], o),
      span('joinery', [-cw / 2, cw / 2], [0.2, 0.45], [zb, ze - 0.02]),
      span('shelves', [-cw / 2, cw / 2], [0.45, 0.48], [zb, ze]),
      span('glow', [-cw / 2 + 0.05, cw / 2 - 0.05], [0.19, 0.2], [zb + 0.05, ze - 0.06], o),
      span('joinery', [-cw / 2, cw / 2], [h - hdr, h], [zb, zf], o),
      span('glow', [-cw / 2 + 0.03, cw / 2 - 0.03], [h - hdr - 0.008, h - hdr], [zf - 0.05, zf - 0.035], o),
    );
    for (const [x0, x1] of cellSpans(clamp(Math.round(cw / 0.6), 2, 4), -cw / 2, cw / 2)) {
      parts.push(span('joinery', [x0 + 0.0015, x1 - 0.0015], [0.203, 0.447], [ze - 0.02, ze], o));
      parts.push(span('shelves', [(x0 + x1) / 2 - 0.06, (x0 + x1) / 2 + 0.06], [0.43, 0.445], [ze - 0.005, ze + 0.004], o));
    }
    return parts;
  },
});

const alcoveCupboard = defineItem({
  id: 'alcove-cupboard-shelves',
  name: 'Alcove cupboard with floating shelves',
  category: C,
  type: 'structure',
  group: 'Built-ins',
  tags: ['alcove', 'chimney alcove', 'built-in cupboard', 'floating shelves', 'joinery', 'hốc tường'],
  description: 'Classic alcove joinery beside a chimney breast: a painted shaker cupboard with an oak top and chunky oak floating shelves above, styled with a few ceramics.',
  defaultSize: { w: 1.0, d: 0.42, h: 2.5 },
  minSize: { w: 0.5, d: 0.3, h: 1.6 },
  maxSize: { w: 1.8, d: 0.6, h: 3.0 },
  wallSnap: true,
  slots: [matSlot('paint', 'Cupboard', 'paint-sage'), matSlot('wood', 'Top & shelves', 'wood-oak-natural'), matSlot('metal', 'Knobs', 'metal-brass'), matSlot('decor', 'Ceramics', 'ceramic-white')],
  variants: [
    { id: 'navy', name: 'Navy', materials: { paint: 'paint-navy' } },
    { id: 'white', name: 'White & walnut', materials: { paint: 'paint-warm-white', wood: 'wood-walnut' } },
    { id: 'clay', name: 'Clay', materials: { paint: 'paint-clay', decor: 'ceramic-black' } },
  ],
  build: (size) => {
    const { w, d, h } = size;
    const zf = d / 2 - 0.06;
    const parts: Part[] = [
      span('paint', [-w / 2, w / 2], [0, 0.1], [-d / 2, zf - 0.05], o),
      span('paint', [-w / 2, w / 2], [0.1, 0.89], [-d / 2, zf]),
      span('wood', [-w / 2, w / 2], [0.89, 0.92], [-d / 2, d / 2 - 0.01]),
    ];
    const nd = w > 0.7 ? 2 : 1;
    for (const [i, [x0, x1]] of cellSpans(nd, -w / 2, w / 2).entries()) {
      parts.push(...shakerFront('paint', [x0, x1], [0.1, 0.885], zf, 0.02, { rail: 0.06 }));
      parts.push(...knob('metal', [nd === 1 ? x1 - 0.06 : i === 0 ? x1 - 0.045 : x0 + 0.045, 0.75, zf + 0.02], 0.013));
    }
    const sd = Math.min(0.3, d - 0.08);
    const ys: number[] = [];
    for (let y = 1.3; y < h - 0.05; y += 0.36) ys.push(y);
    const rand = (i: number) => ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1;
    for (const [i, y] of ys.entries()) {
      parts.push(span('wood', [-w / 2, w / 2], [y, y + 0.04], [-d / 2, -d / 2 + sd]));
      const room = (i + 1 < ys.length ? ys[i + 1] : h) - y - 0.06;
      if (room < 0.12) continue;
      const vh = Math.min(0.24, room * (0.6 + rand(i) * 0.3));
      const vx = (i % 2 ? 0.22 : -0.22) * w;
      const r = Math.min(0.06, sd * 0.3);
      parts.push(lathe('decor', [vx, y + 0.04, -d / 2 + sd / 2], [[0, 0], [r * 0.6, 0], [r, vh * 0.35], [r * 0.9, vh * 0.7], [r * 0.45, vh * 0.88], [r * 0.5, vh], [0, vh]], { segments: 24, plan: false }));
      parts.push(lathe('decor', [-vx * 0.9, y + 0.04, -d / 2 + sd / 2], [[0, 0], [r * 0.7, 0], [r * 1.5, Math.min(0.07, room * 0.4)], [0, Math.min(0.07, room * 0.4)]], { segments: 24, plan: false }));
      if (room > 0.2) {
        for (const k of range(3)) parts.push(span('wood', [-0.1 * w - 0.08 + k * 0.01, -0.1 * w + 0.08 - k * 0.012], [y + 0.04 + k * 0.03, y + 0.07 + k * 0.03], [-d / 2 + 0.03, -d / 2 + Math.min(sd - 0.02, 0.22)], o));
      }
    }
    return keep(parts, size);
  },
});

const deskNook = defineItem({
  id: 'built-in-desk-nook',
  name: 'Built-in desk nook with wall cabinets',
  category: 'office',
  type: 'surfaces',
  group: 'Desks',
  tags: ['desk nook', 'built-in desk', 'study nook', 'home office', 'góc làm việc', 'pinboard'],
  description: 'A fitted study nook: an oak desktop on a three-drawer pedestal and side panel, a cork pinboard back, an open shelf and wall cabinets above.',
  defaultSize: { w: 1.6, d: 0.6, h: 2.4 },
  minSize: { w: 1.0, d: 0.5, h: 2.0 },
  maxSize: { w: 2.6, d: 0.75, h: 3.0 },
  wallSnap: true,
  slots: [matSlot('joinery', 'Cabinets', 'laminate-white-matte'), matSlot('top', 'Desk & shelf', 'wood-oak-natural'), matSlot('cork', 'Pinboard', 'cork'), matSlot('metal', 'Handles', 'metal-black-matte')],
  variants: [
    { id: 'sage', name: 'Sage', materials: { joinery: 'laminate-sage' } },
    { id: 'walnut', name: 'Walnut & navy', materials: { joinery: 'laminate-navy', top: 'wood-walnut', metal: 'metal-brass' } },
  ],
  build: ({ w, d, h }) => {
    const pw = 0.42;
    const zf = d / 2 - 0.06;
    const uc = Math.min(0.35, d - 0.1);
    const cab0 = Math.max(1.5, h - 0.85);
    const parts: Part[] = [
      span('joinery', [-w / 2, -w / 2 + pw], [0.08, 0.72], [-d / 2, zf]),
      span('joinery', [-w / 2 + 0.02, -w / 2 + pw - 0.02], [0, 0.08], [-d / 2, zf - 0.04], o),
      span('joinery', [w / 2 - 0.03, w / 2], [0, 0.72], [-d / 2, d / 2 - 0.03]),
      span('top', [-w / 2, w / 2], [0.72, 0.75], [-d / 2, d / 2]),
      span('cork', [-w / 2, w / 2], [0.75, cab0 - 0.3], [-d / 2, -d / 2 + 0.012], o),
      span('top', [-w / 2, w / 2], [cab0 - 0.3, cab0 - 0.27], [-d / 2, -d / 2 + 0.22], o),
      span('joinery', [-w / 2, w / 2], [cab0, h], [-d / 2, -d / 2 + uc], o),
      ring('metal', [w / 2 - 0.15, 0.75, -d / 2 + 0.08], 0.03, 0.006, o),
    ];
    for (const [y0, y1] of cellSpans(3, 0.08, 0.72)) {
      parts.push(span('joinery', [-w / 2 + 0.002, -w / 2 + pw - 0.002], [y0 + 0.002, y1 - 0.002], [zf, zf + 0.02], o));
      parts.push(...barPull('metal', [-w / 2 + pw / 2, y1 - 0.05, zf + 0.02], 0.16));
    }
    const n = clamp(Math.round(w / 0.45), 2, 6);
    for (const [i, [x0, x1]] of cellSpans(n, -w / 2, w / 2).entries()) {
      parts.push(span('joinery', [x0 + 0.002, x1 - 0.002], [cab0 + 0.002, h - 0.002], [-d / 2 + uc, -d / 2 + uc + 0.02], o));
      parts.push(...barPull('metal', [i % 2 ? x0 + 0.04 : x1 - 0.04, cab0 + 0.1, -d / 2 + uc + 0.02], 0.12, { vertical: true }));
    }
    return parts;
  },
});

const raisedPlatform = defineItem({
  id: 'raised-platform-drawers',
  name: 'Raised timber platform with drawers',
  category: C,
  type: 'structure',
  group: 'Built-ins',
  tags: ['platform', 'raised floor', 'sàn nâng', 'tatami platform', 'storage', 'bục gỗ'],
  description: 'A raised plank-topped timber platform for a sleeping or tea corner, with a row of deep storage drawers across its front.',
  defaultSize: { w: 2.4, d: 2.0, h: 0.4 },
  minSize: { w: 1.0, d: 1.0, h: 0.2 },
  maxSize: { w: 4.0, d: 3.5, h: 0.6 },
  wallSnap: true,
  slots: [matSlot('deck', 'Deck boards', 'wood-oak-natural'), matSlot('carcass', 'Sides & plinth', 'paint-satin-white'), matSlot('fronts', 'Drawer fronts', 'wood-oak-natural'), matSlot('pulls', 'Pulls', 'metal-black-matte')],
  variants: [
    { id: 'walnut', name: 'Walnut', materials: { deck: 'wood-walnut', fronts: 'wood-walnut' } },
    { id: 'bamboo', name: 'Bamboo', materials: { deck: 'wood-bamboo', fronts: 'wood-bamboo', carcass: 'paint-mushroom' } },
    { id: 'white', name: 'Whitewashed', materials: { deck: 'wood-whitewashed', fronts: 'paint-warm-white' } },
  ],
  build: ({ w, d, h }) => {
    const zf = d / 2 - 0.04;
    const parts: Part[] = [
      span('carcass', [-w / 2, w / 2], [0.06, h - 0.025], [-d / 2, zf]),
      span('carcass', [-w / 2 + 0.03, w / 2 - 0.03], [0, 0.06], [-d / 2, zf - 0.04], o),
    ];
    for (const [z0, z1] of cellSpans(clamp(Math.round(d / 0.18), 3, 20), -d / 2, d / 2)) parts.push(span('deck', [-w / 2, w / 2], [h - 0.025, h], [z0 + 0.0015, z1 - 0.0015]));
    for (const [x0, x1] of cellSpans(clamp(Math.round(w / 0.6), 1, 8), -w / 2, w / 2)) {
      parts.push(span('fronts', [x0 + 0.003, x1 - 0.003], [0.07, h - 0.035], [zf, zf + 0.018], { bevel: 0.003, plan: false }));
      const cx = (x0 + x1) / 2;
      parts.push(span('pulls', [cx - 0.08, cx + 0.08], [h - 0.065, h - 0.05], [zf + 0.018, zf + 0.032], o));
    }
    return parts;
  },
});

const entryBench = defineItem({
  id: 'entryway-bench-cubbies',
  name: 'Entryway bench with cubbies and hooks',
  category: 'storage',
  type: 'storage',
  group: 'Hallway storage',
  tags: ['mudroom', 'entryway', 'shoe bench', 'coat hooks', 'tủ giày', 'built-in'],
  description: 'A built-in hall unit: shoe cubbies under a cushioned oak bench, a beadboard back with double coat hooks and a top shelf of cubbies holding wooden crates.',
  defaultSize: { w: 1.2, d: 0.42, h: 2.0 },
  minSize: { w: 0.8, d: 0.32, h: 1.7 },
  maxSize: { w: 2.4, d: 0.5, h: 2.6 },
  wallSnap: true,
  slots: [matSlot('carcass', 'Cabinetry', 'paint-satin-white'), matSlot('seat', 'Seat, shelf & crates', 'wood-oak-natural'), matSlot('cushion', 'Cushion', 'fabric-linen'), matSlot('metal', 'Hooks', 'metal-black-matte')],
  variants: [
    { id: 'sage', name: 'Sage', materials: { carcass: 'paint-sage', cushion: 'fabric-linen-rust' } },
    { id: 'navy', name: 'Navy & brass', materials: { carcass: 'paint-navy', metal: 'metal-brass', cushion: 'fabric-cream' } },
  ],
  build: ({ w, d, h }) => {
    const t = 0.02;
    const seat = 0.46;
    const shelf = Math.min(1.65, h - 0.35);
    const ud = Math.min(0.32, d - 0.04);
    const parts: Part[] = [
      span('carcass', [-w / 2, -w / 2 + t], [0, h], [-d / 2, d / 2]),
      span('carcass', [w / 2 - t, w / 2], [0, h], [-d / 2, d / 2]),
      span('carcass', [-w / 2 + t, w / 2 - t], [0, 0.06], [-d / 2, d / 2 - 0.03], o),
      span('carcass', [-w / 2 + t, w / 2 - t], [0.06, seat - 0.03], [-d / 2, -d / 2 + 0.012], o),
      span('carcass', [-w / 2 + t, w / 2 - t], [0.24, 0.26], [-d / 2 + 0.012, d / 2 - 0.01], o),
      span('seat', [-w / 2 + t, w / 2 - t], [seat - 0.03, seat], [-d / 2, d / 2]),
      cushion('cushion', [-w / 2 + t + 0.01, w / 2 - t - 0.01], [seat, seat + 0.05], [-d / 2 + 0.05, d / 2 - 0.02], { softness: 0.4, plan: false }),
      span('seat', [-w / 2 + t, w / 2 - t], [shelf, shelf + 0.03], [-d / 2, -d / 2 + ud], o),
      span('carcass', [-w / 2 + t, w / 2 - t], [h - 0.03, h], [-d / 2, -d / 2 + ud], o),
      span('carcass', [-w / 2 + t, w / 2 - t], [shelf + 0.03, h - 0.03], [-d / 2, -d / 2 + 0.012], o),
      span('carcass', [-w / 2 + t, w / 2 - t], [1.42, 1.52], [-d / 2 + 0.015, -d / 2 + 0.035], o),
    ];
    const nc = clamp(Math.round(w / 0.3), 2, 8);
    const cs = cellSpans(nc, -w / 2 + t, w / 2 - t);
    for (const [x0] of cs.slice(1)) parts.push(span('carcass', [x0 - 0.009, x0 + 0.009], [0.06, seat - 0.03], [-d / 2 + 0.012, d / 2 - 0.01], o));
    for (const [x0] of cs.slice(1)) parts.push(span('carcass', [x0 - 0.009, x0 + 0.009], [shelf + 0.03, h - 0.03], [-d / 2 + 0.012, -d / 2 + ud], o));
    for (const [x0, x1] of cs) {
      parts.push(span('seat', [x0 + 0.02, x1 - 0.02], [shelf + 0.03, shelf + 0.03 + Math.min(0.2, h - shelf - 0.1)], [-d / 2 + 0.03, -d / 2 + ud - 0.01], { bevel: 0.004, plan: false }));
    }
    for (const [x0, x1] of cellSpans(clamp(Math.round(w / 0.1), 6, 24), -w / 2 + t, w / 2 - t)) parts.push(span('carcass', [x0 + 0.002, x1 - 0.002], [seat, 1.42], [-d / 2 + 0.012, -d / 2 + 0.02], o));
    for (const x of cells(clamp(Math.round(w / 0.25), 2, 8), -w / 2 + t, w / 2 - t)) {
      const z = -d / 2 + 0.035;
      parts.push(
        rod('metal', [x, 1.49, z], [x, 1.45, z + 0.07], 0.005, o),
        rod('metal', [x, 1.47, z], [x, 1.5, z + 0.04], 0.004, o),
        sphere('metal', [x, 1.45, z + 0.07], 0.008, o),
      );
    }
    return parts;
  },
});

// ---------------------------------------------------------------------------
// Heating: chimney breasts, fires, stoves and radiators
// ---------------------------------------------------------------------------

/** A soft flame outline (a teardrop whose tip curls by `lean`) standing on y0, as [x, y] points. */
function flame(cx: number, y0: number, fw: number, fh: number, lean: number): V2[] {
  const ts = [0, 0.12, 0.28, 0.45, 0.62, 0.78, 0.9];
  const half = (t: number) => (fw / 2) * Math.pow(1 - t, 0.75) * (1 + 0.3 * Math.sin(Math.PI * t));
  const off = (t: number) => lean * t * t;
  return [
    ...ts.map((t) => [cx - half(t) + off(t), y0 + fh * t] as V2),
    [cx + lean, y0 + fh],
    ...[...ts].reverse().map((t) => [cx + half(t) + off(t), y0 + fh * t] as V2),
  ];
}

const chimneyBreast = defineItem({
  id: 'chimney-breast-log-burner',
  name: 'Chimney breast with log burner',
  category: C,
  type: 'structure',
  group: 'Heating',
  tags: ['chimney breast', 'fireplace', 'log burner', 'wood stove', 'brick', 'lò sưởi'],
  description: 'A plastered floor-to-ceiling chimney breast with a brick-lined opening, soldier-course brick lintel and brick hearth, holding a black cast-iron log burner with a glowing window.',
  defaultSize: { w: 1.6, d: 0.85, h: 2.7 },
  minSize: { w: 1.1, d: 0.7, h: 2.2 },
  maxSize: { w: 2.4, d: 1.0, h: 3.5 },
  wallSnap: true,
  slots: [matSlot('breast', 'Chimney breast', 'plaster-white'), matSlot('brick', 'Brick opening & hearth', 'brick-red'), matSlot('stove', 'Stove & flue', 'metal-black-matte'), matSlot('glow', 'Fire glow', 'fire-glow')],
  variants: [
    { id: 'limewash', name: 'Limewash & white brick', materials: { breast: 'limewash-warm', brick: 'brick-white' } },
    { id: 'dark', name: 'Dark breast & slate', materials: { breast: 'paint-charcoal', brick: 'stone-slate' } },
    { id: 'green', name: 'Green & terracotta', materials: { breast: 'paint-forest', brick: 'tile-terracotta-rustic' } },
  ],
  build: (size) => {
    const { w, d, h } = size;
    const db = d - 0.32;
    const zb = -d / 2;
    const zfb = zb + db;
    const ow = clamp(w * 0.58, 0.7, 1.2);
    const oh = 0.95;
    const hearth = 0.05;
    const parts: Part[] = [
      span('breast', [-w / 2, -ow / 2], [0, h], [zb, zfb]),
      span('breast', [ow / 2, w / 2], [0, h], [zb, zfb]),
      span('breast', [-ow / 2, ow / 2], [oh + 0.22, h], [zb, zfb], o),
      span('brick', [-ow / 2 - 0.05, ow / 2 + 0.05], [oh, oh + 0.22], [zb + 0.08, zfb + 0.01], o),
      span('brick', [-ow / 2, ow / 2], [hearth, oh], [zb, zb + 0.08], o),
      span('brick', [-ow / 2, -ow / 2 + 0.06], [hearth, oh], [zb + 0.08, zfb], o),
      span('brick', [ow / 2 - 0.06, ow / 2], [hearth, oh], [zb + 0.08, zfb], o),
      span('brick', [-ow / 2 - 0.15, ow / 2 + 0.15], [0, hearth], [zb + 0.08, d / 2]),
    ];
    // The stove.
    const sw = Math.min(0.5, ow - 0.2);
    const sd = Math.min(0.36, db - 0.12);
    const zc = zb + 0.1 + sd / 2;
    const y0 = hearth + 0.08;
    const sh = Math.min(0.55, oh - y0 - 0.15);
    const zs = zc + sd / 2;
    parts.push(span('stove', [-sw / 2, sw / 2], [y0, y0 + sh], [zc - sd / 2, zs], { bevel: 0.01, plan: false }));
    parts.push(span('stove', [-sw / 2 - 0.015, sw / 2 + 0.015], [y0 + sh, y0 + sh + 0.015], [zc - sd / 2 - 0.015, zs + 0.015], o));
    for (const x of [-sw / 2 + 0.03, sw / 2 - 0.03]) for (const z of [zc - sd / 2 + 0.03, zs - 0.03]) parts.push(vcyl('stove', x, z, hearth, y0, 0.015, o));
    parts.push(...frame4('stove', [-sw / 2 + 0.03, sw / 2 - 0.03], [y0 + 0.05, y0 + sh - 0.05], [zs, zs + 0.012], 0.04));
    for (const [i, x] of cells(3, -sw / 2 + 0.07, sw / 2 - 0.07).entries()) parts.push(panelXY('glow', flame(x, y0 + 0.09, 0.05, (sh - 0.18) * (0.5 + 0.2 * (i % 2)), i % 2 ? 0.01 : -0.01), zs, 0.004));
    parts.push(rod('stove', [sw / 2 - 0.05, y0 + sh * 0.5, zs + 0.012], [sw / 2 - 0.05, y0 + sh * 0.5, zs + 0.05], 0.008, o));
    parts.push(span('stove', [-sw / 2 + 0.05, sw / 2 - 0.05], [y0 + 0.012, y0 + 0.04], [zs, zs + 0.015], o));
    parts.push(vcyl('stove', 0, zc - 0.03, y0 + sh + 0.015, oh, 0.065, { segments: 24, plan: false }));
    parts.push(ring('stove', [0, y0 + sh + 0.05, zc - 0.03], 0.068, 0.008, o));
    return keep(parts, size);
  },
});

const electricFire = defineItem({
  id: 'linear-electric-fire-surround',
  name: 'Linear electric fire in plaster surround',
  category: C,
  type: 'structure',
  group: 'Heating',
  tags: ['electric fire', 'fireplace', 'media fireplace', 'linear fire', 'lò sưởi điện', 'flame effect'],
  description: 'A wide built-in electric fire with a black firebox, a crystal ember bed and LED flame effect, set in a smooth plaster surround with a stone top.',
  defaultSize: { w: 1.8, d: 0.35, h: 1.1 },
  minSize: { w: 1.0, d: 0.25, h: 0.8 },
  maxSize: { w: 3.0, d: 0.5, h: 2.7 },
  wallSnap: true,
  slots: [matSlot('surround', 'Surround', 'venetian-white'), matSlot('firebox', 'Firebox & trim', 'metal-black-matte'), matSlot('flame', 'Flame glow', 'fire-glow'), matSlot('ember', 'Ember bed', 'glass-tinted')],
  variants: [
    { id: 'microcement', name: 'Microcement', materials: { surround: 'microcement' } },
    { id: 'travertine', name: 'Travertine', materials: { surround: 'stone-travertine', firebox: 'metal-bronze' } },
    { id: 'blue-flame', name: 'Cool flame', materials: { flame: 'light-cool', ember: 'glass-clear' } },
  ],
  build: ({ w, d, h }) => {
    const fw = clamp(w - 0.5, 0.6, 2.2);
    const fh = Math.min(0.4, h - 0.4);
    const y0 = clamp(h * 0.3, 0.25, 0.5);
    const yT = y0 + fh;
    const zf = d / 2 - 0.008;
    const zbk = -d / 2 + 0.05;
    const parts: Part[] = [
      span('surround', [-w / 2, -fw / 2 - 0.02], [0, h - 0.05], [-d / 2, zf]),
      span('surround', [fw / 2 + 0.02, w / 2], [0, h - 0.05], [-d / 2, zf]),
      span('surround', [-fw / 2 - 0.02, fw / 2 + 0.02], [0, y0 - 0.02], [-d / 2, zf], o),
      span('surround', [-fw / 2 - 0.02, fw / 2 + 0.02], [yT + 0.02, h - 0.05], [-d / 2, zf], o),
      span('surround', [-w / 2, w / 2], [h - 0.05, h], [-d / 2, d / 2]),
      ...frame4('firebox', [-fw / 2 - 0.02, fw / 2 + 0.02], [y0 - 0.02, yT + 0.02], [zf, d / 2], 0.02),
      span('firebox', [-fw / 2, fw / 2], [y0, yT], [zbk, zbk + 0.02], o),
      span('firebox', [-fw / 2, fw / 2], [y0, y0 + 0.01], [zbk, zf], o),
      span('firebox', [-fw / 2, fw / 2], [yT - 0.01, yT], [zbk, zf], o),
      span('firebox', [-fw / 2, -fw / 2 + 0.01], [y0, yT], [zbk, zf], o),
      span('firebox', [fw / 2 - 0.01, fw / 2], [y0, yT], [zbk, zf], o),
      span('flame', [-fw / 2 + 0.02, fw / 2 - 0.02], [y0 + 0.01, y0 + 0.02], [zbk + 0.03, zf - 0.04], o),
    ];
    const k = clamp(Math.round(fw / 0.16), 3, 13);
    for (const [i, x] of cells(k, -fw / 2 + 0.04, fw / 2 - 0.04).entries()) {
      const f = 0.6 + 0.3 * (((i * 7) % 5) / 4);
      parts.push(panelXY('flame', flame(x, y0 + 0.025, Math.min(0.15, fw / k), (fh - 0.07) * f, ((i % 3) - 1) * 0.02), zbk + 0.04, 0.004));
      parts.push(panelXY('flame', flame(x + fw / k / 2, y0 + 0.025, Math.min(0.1, fw / k), (fh - 0.07) * f * 0.55, ((i % 2) * 2 - 1) * 0.012), zbk + 0.1, 0.004));
    }
    const rand = (i: number) => ((Math.sin(i * 78.233) * 43758.5453) % 1 + 1) % 1;
    for (const i of range(clamp(Math.round(fw / 0.07), 8, 30))) {
      const x = -fw / 2 + 0.04 + (fw - 0.08) * rand(i + 1);
      const z = zbk + 0.06 + (zf - zbk - 0.12) * rand(i + 40);
      parts.push(sphere('ember', [x, y0 + 0.025, z], 0.022 + rand(i + 9) * 0.01, { scale: [1.3, 0.6, 1], plan: false }));
    }
    return parts;
  },
});

const castIronRadiator = defineItem({
  id: 'cast-iron-column-radiator',
  name: 'Cast-iron column radiator',
  category: C,
  type: 'structure',
  group: 'Heating',
  tags: ['radiator', 'cast iron', 'victorian', 'heating', 'column radiator', 'lò sưởi'],
  description: 'A traditional floor-standing cast-iron radiator of double-column sections on turned feet, with brass wheel valves at both ends.',
  defaultSize: { w: 0.9, d: 0.2, h: 0.75 },
  minSize: { w: 0.4, d: 0.14, h: 0.45 },
  maxSize: { w: 2.0, d: 0.3, h: 1.0 },
  wallSnap: true,
  slots: [matSlot('iron', 'Cast iron', 'metal-anthracite'), matSlot('valves', 'Valves', 'metal-brass')],
  variants: [
    { id: 'white', name: 'White & chrome', materials: { iron: 'metal-white-powder', valves: 'metal-chrome' } },
    { id: 'raw', name: 'Polished raw iron', materials: { iron: 'metal-gunmetal' } },
    { id: 'cream', name: 'Heritage cream', materials: { iron: 'paint-cream', valves: 'metal-copper' } },
  ],
  build: ({ w, d, h }) => {
    const feet = 0.1;
    const vw = 0.06;
    const rw = w - 2 * vw;
    const n = clamp(Math.round(rw / 0.065), 4, 28);
    const pitch = rw / n;
    const cw = pitch * 0.42;
    const parts: Part[] = [];
    for (const x of cells(n, -rw / 2, rw / 2)) {
      parts.push(
        span('iron', [x - cw, x + cw], [feet + 0.04, h - 0.05], [d * 0.04, d / 2 - 0.015], { bevel: 0.014 }),
        span('iron', [x - cw, x + cw], [feet + 0.04, h - 0.05], [-d / 2 + 0.015, -d * 0.04], { bevel: 0.014, plan: false }),
        span('iron', [x - cw * 1.05, x + cw * 1.05], [h - 0.075, h - 0.005], [-d / 2 + 0.01, d / 2 - 0.01], { bevel: 0.02, plan: false }),
        span('iron', [x - cw * 1.05, x + cw * 1.05], [feet, feet + 0.065], [-d / 2 + 0.01, d / 2 - 0.01], { bevel: 0.02, plan: false }),
      );
    }
    for (const x of [-rw / 2 + pitch / 2, rw / 2 - pitch / 2]) {
      for (const z of [-d / 2 + 0.035, d / 2 - 0.035]) parts.push(turnedLeg('iron', x, z, 0, feet + 0.01, 0.024, { style: 'bun' }));
    }
    for (const s of [-1, 1]) {
      const x = s * (w / 2 - vw / 2);
      parts.push(
        rod('valves', [s * (rw / 2 - 0.01), feet + 0.035, 0], [x, feet + 0.035, 0], 0.012, o),
        vcyl('valves', x, 0, 0, feet + 0.06, 0.013, o),
        sphere('valves', [x, feet + 0.035, 0], 0.02, o),
        vcyl('valves', x, 0, feet + 0.06, feet + 0.1, 0.006, o),
        ring('valves', [x, feet + 0.1, 0], 0.024, 0.005, o),
      );
    }
    parts.push(cyl('valves', [rw / 2 - pitch / 2, h - 0.04, d / 2 - 0.01], 0.008, 0.02, { rotation: [Math.PI / 2, 0, 0], plan: false }));
    return parts;
  },
});

const panelRadiator = defineItem({
  id: 'double-panel-convector-radiator',
  name: 'Double-panel convector radiator',
  category: C,
  type: 'structure',
  group: 'Heating',
  tags: ['radiator', 'panel radiator', 'type 22', 'convector', 'heating', 'thermostatic valve'],
  description: 'A white steel double-panel convector radiator with pressed vertical channels, a top grille, a thermostatic valve and a lockshield valve.',
  defaultSize: { w: 1.0, d: 0.1, h: 0.6 },
  minSize: { w: 0.4, d: 0.08, h: 0.3 },
  maxSize: { w: 2.4, d: 0.14, h: 0.9 },
  mount: 'wall',
  defaultElevation: 0.15,
  slots: [matSlot('body', 'Radiator', 'metal-white-powder'), matSlot('valves', 'Valves', 'metal-chrome'), matSlot('trv', 'Thermostat head', 'plastic-white')],
  variants: [
    { id: 'anthracite', name: 'Anthracite', materials: { body: 'metal-anthracite' } },
    { id: 'black', name: 'Matt black & brass', materials: { body: 'metal-black-matte', valves: 'metal-brass', trv: 'plastic-black' } },
  ],
  build: ({ w, d, h }) => {
    const x0 = -w / 2 + 0.05;
    const x1 = w / 2 - 0.07;
    const zf = d / 2 - 0.004;
    const parts: Part[] = [
      span('body', [x0, x1], [0.0, h], [zf - 0.02, zf]),
      span('body', [x0, x1], [0.0, h], [-d / 2 + 0.02, -d / 2 + 0.042]),
      span('body', [x0 + 0.02, x1 - 0.02], [0.02, h - 0.03], [-d / 2 + 0.042, zf - 0.02], o),
      span('body', [x0, x0 + 0.004], [0, h - 0.006], [-d / 2 + 0.042, zf - 0.02], o),
      span('body', [x1 - 0.004, x1], [0, h - 0.006], [-d / 2 + 0.042, zf - 0.02], o),
    ];
    for (const x of cells(clamp(Math.round((x1 - x0) / 0.033), 8, 70), x0, x1)) parts.push(span('body', [x - 0.004, x + 0.004], [0.03, h - 0.03], [zf, d / 2], o));
    // Top grille between the panels.
    for (const x of spaced(clamp(Math.round((x1 - x0) / 0.04), 6, 50), x0 + 0.02, x1 - 0.02)) parts.push(span('body', [x - 0.004, x + 0.004], [h - 0.012, h - 0.002], [-d / 2 + 0.042, zf - 0.02], o));
    const vx = w / 2 - 0.035;
    parts.push(
      rod('valves', [x1 - 0.01, 0.05, 0], [vx, 0.05, 0], 0.01, o),
      vcyl('valves', vx, 0, 0.0, 0.1, 0.012, o),
      vcyl('trv', vx, 0, 0.1, 0.2, 0.026, o),
      vcyl('trv', vx, 0, 0.2, 0.21, 0.02, o),
      rod('valves', [-w / 2 + 0.025, 0.05, 0], [x0 + 0.01, 0.05, 0], 0.01, o),
      vcyl('valves', -w / 2 + 0.025, 0, 0.0, 0.09, 0.012, o),
      span('valves', [x0 + 0.1, x0 + 0.14], [h - 0.1, h - 0.03], [-d / 2, -d / 2 + 0.02], o),
      span('valves', [x1 - 0.14, x1 - 0.1], [h - 0.1, h - 0.03], [-d / 2, -d / 2 + 0.02], o),
    );
    return parts;
  },
});

const radiatorCover = defineItem({
  id: 'radiator-cover-dowel-grille',
  name: 'Radiator cover with dowel grille',
  category: C,
  type: 'structure',
  group: 'Heating',
  tags: ['radiator cover', 'radiator cabinet', 'grille', 'console', 'hall', 'heating'],
  description: 'A painted radiator cabinet with a front grille of slim vertical dowels, an open back and an oak top that doubles as a console shelf.',
  defaultSize: { w: 1.2, d: 0.22, h: 0.9 },
  minSize: { w: 0.6, d: 0.15, h: 0.6 },
  maxSize: { w: 2.4, d: 0.35, h: 1.2 },
  wallSnap: true,
  slots: [matSlot('cab', 'Cabinet', 'paint-satin-white'), matSlot('top', 'Top shelf', 'wood-oak-natural'), matSlot('grille', 'Dowel grille', 'paint-satin-white')],
  variants: [
    { id: 'oak', name: 'Oak grille', materials: { grille: 'wood-oak-natural' } },
    { id: 'navy', name: 'Navy', materials: { cab: 'paint-navy', grille: 'paint-navy' } },
    { id: 'cane', name: 'Sage & cane', materials: { cab: 'paint-sage', grille: 'cane-natural' } },
  ],
  build: ({ w, d, h }) => {
    const zf = d / 2 - 0.01;
    const zr: V2 = [zf - 0.02, zf];
    const yt = h - 0.025;
    const parts: Part[] = [
      span('top', [-w / 2, w / 2], [yt, h], [-d / 2, d / 2], { bevel: 0.004 }),
      span('cab', [-w / 2 + 0.005, -w / 2 + 0.025], [0, yt], [-d / 2, zf]),
      span('cab', [w / 2 - 0.025, w / 2 - 0.005], [0, yt], [-d / 2, zf]),
      span('cab', [-w / 2 + 0.025, w / 2 - 0.025], [0, 0.08], zr, o),
      span('cab', [-w / 2 + 0.025, w / 2 - 0.025], [yt - 0.07, yt], zr, o),
      span('cab', [-w / 2 + 0.025, -w / 2 + 0.06], [0.08, yt - 0.07], zr, o),
      span('cab', [w / 2 - 0.06, w / 2 - 0.025], [0.08, yt - 0.07], zr, o),
    ];
    for (const x of spaced(clamp(Math.round((w - 0.14) / 0.03), 8, 70), -w / 2 + 0.075, w / 2 - 0.075)) parts.push(vcyl('grille', x, zf - 0.012, 0.08, yt - 0.07, 0.0065, { segments: 8, plan: false }));
    return parts;
  },
});

const woodStove = defineItem({
  id: 'wood-stove-with-flue',
  name: 'Freestanding wood stove with flue',
  category: C,
  type: 'structure',
  group: 'Heating',
  tags: ['wood stove', 'log burner', 'stove', 'flue pipe', 'hearth', 'bếp lò sưởi'],
  description: 'A cast-iron wood-burning stove on four legs with a glass door showing the fire, a slate hearth plate and a black flue pipe rising to the ceiling.',
  defaultSize: { w: 0.9, d: 0.9, h: 2.7 },
  minSize: { w: 0.7, d: 0.7, h: 2.2 },
  maxSize: { w: 1.4, d: 1.4, h: 4.0 },
  slots: [matSlot('stove', 'Stove & flue', 'metal-black-matte'), matSlot('hearth', 'Hearth plate', 'stone-slate'), matSlot('glass', 'Door glass', 'glass-tinted'), matSlot('glow', 'Fire glow', 'fire-glow')],
  variants: [
    { id: 'green', name: 'Green enamel', materials: { stove: 'paint-forest' } },
    { id: 'glass-hearth', name: 'Glass hearth', materials: { hearth: 'glass-clear' } },
    { id: 'granite', name: 'Granite hearth', materials: { hearth: 'stone-granite', stove: 'metal-anthracite' } },
  ],
  build: (size) => {
    const { w, d, h } = size;
    const sw = 0.48;
    const sd = 0.4;
    const zc = -d / 2 + 0.12 + sd / 2;
    const zs = zc + sd / 2;
    const y0 = 0.18;
    const y1 = 0.78;
    const parts: Part[] = [
      span('hearth', [-w / 2, w / 2], [0, 0.03], [-d / 2, d / 2], { bevel: 0.005 }),
      span('stove', [-sw / 2, sw / 2], [y0, y0 + 0.04], [zc - sd / 2, zs], o),
      span('stove', [-sw / 2 - 0.02, sw / 2 + 0.02], [y1 - 0.04, y1], [zc - sd / 2 - 0.02, zs + 0.02], { bevel: 0.006, plan: false }),
      span('stove', [-sw / 2, -sw / 2 + 0.03], [y0 + 0.04, y1 - 0.04], [zc - sd / 2, zs], o),
      span('stove', [sw / 2 - 0.03, sw / 2], [y0 + 0.04, y1 - 0.04], [zc - sd / 2, zs], o),
      span('stove', [-sw / 2 + 0.03, sw / 2 - 0.03], [y0 + 0.04, y1 - 0.04], [zc - sd / 2, zc - sd / 2 + 0.03], o),
      ...frame4('stove', [-sw / 2, sw / 2], [y0 + 0.04, y1 - 0.04], [zs - 0.03, zs], 0.06),
      span('glass', [-sw / 2 + 0.06, sw / 2 - 0.06], [y0 + 0.1, y1 - 0.1], [zs - 0.02, zs - 0.012], o),
      span('glow', [-sw / 2 + 0.05, sw / 2 - 0.05], [y0 + 0.04, y0 + 0.12], [zc - sd / 2 + 0.05, zs - 0.05], o),
      span('stove', [-sw / 2 + 0.05, sw / 2 - 0.05], [y0, y0 + 0.04], [zs, zs + 0.02], o),
      rod('stove', [sw / 2 - 0.03, y0 + 0.3, zs], [sw / 2 - 0.03, y0 + 0.3, zs + 0.04], 0.008, o),
      cyl('stove', [sw / 2 - 0.03, y0 + 0.3, zs + 0.05], 0.014, 0.03, { rotation: [Math.PI / 2, 0, 0], segments: 12, plan: false }),
      vcyl('stove', 0, zc - 0.04, y1, h - 0.01, 0.075, { segments: 24, plan: false }),
      cyl('stove', [0, h - 0.005, zc - 0.04], 0.16, 0.01, { segments: 32, plan: false }),
    ];
    for (const [i, x] of cells(5, -sw / 2 + 0.08, sw / 2 - 0.08).entries()) parts.push(panelXY('glow', flame(x, y0 + 0.1, 0.07, 0.16 + 0.08 * ((i * 3) % 2), (i % 3) * 0.01 - 0.01), zc, 0.004));
    for (const [i, z] of [zc - 0.08, zc + 0.02].entries()) parts.push(rod('stove', [-sw / 2 + 0.06, y0 + 0.07 + i * 0.02, z], [sw / 2 - 0.06, y0 + 0.08, z + 0.03], 0.03, { segments: 10, plan: false }));
    for (const x of [-sw / 2 + 0.035, sw / 2 - 0.035]) for (const z of [zc - sd / 2 + 0.035, zs - 0.035]) parts.push(turnedLeg('stove', x, z, 0.03, y0, 0.022, { style: 'taper' }));
    for (const s of [-1, 1]) for (const y of spaced(4, y0 + 0.12, y1 - 0.12)) parts.push(span('stove', s < 0 ? [-sw / 2 - 0.012, -sw / 2] : [sw / 2, sw / 2 + 0.012], [y - 0.006, y + 0.006], [zc - sd / 2 + 0.04, zs - 0.04], o));
    for (const y of [y1 + 0.08, 1.6, 2.4].filter((y) => y < h - 0.1)) parts.push(ring('stove', [0, y, zc - 0.04], 0.078, 0.006, o));
    return keep(parts, size);
  },
});

// ---------------------------------------------------------------------------
// Half walls, archways and partitions
// ---------------------------------------------------------------------------

/** Skirting on both long faces of a wall running along x, plus the two ends. */
function skirting(slot: string, w: number, d: number, inset: number, t = 0.012, sh = 0.1): Part[] {
  const zf = d / 2 - inset;
  const xe = w / 2 - inset;
  return [
    span(slot, [-xe - t, xe + t], [0, sh], [zf, zf + t], o),
    span(slot, [-xe - t, xe + t], [0, sh], [-zf - t, -zf], o),
    span(slot, [xe, xe + t], [0, sh], [-zf, zf], o),
    span(slot, [-xe - t, -xe], [0, sh], [-zf, zf], o),
  ];
}

const ponyWall = defineItem({
  id: 'half-wall-oak-cap',
  name: 'Half wall with oak cap',
  category: C,
  type: 'structure',
  group: 'Partitions',
  tags: ['half wall', 'pony wall', 'knee wall', 'tường lửng', 'divider', 'room divider'],
  description: 'A plastered pony wall at counter height that divides a room without closing it off, topped with a solid oak cap and finished with skirting all round.',
  defaultSize: { w: 2.0, d: 0.15, h: 1.05 },
  minSize: { w: 0.5, d: 0.1, h: 0.6 },
  maxSize: { w: 6.0, d: 0.3, h: 1.4 },
  slots: [matSlot('wall', 'Wall', 'plaster-white'), matSlot('cap', 'Oak cap', 'wood-oak-natural'), matSlot('trim', 'Skirting', 'paint-satin-white')],
  variants: [
    { id: 'tiled', name: 'Subway tiled', materials: { wall: 'tile-subway-white' } },
    { id: 'limewash', name: 'Limewash & walnut', materials: { wall: 'limewash-warm', cap: 'wood-walnut', trim: 'limewash-warm' } },
    { id: 'marble', name: 'Marble cap', materials: { cap: 'stone-marble-carrara', wall: 'paint-greige', trim: 'paint-greige' } },
  ],
  build: ({ w, d, h }) => [
    span('cap', [-w / 2, w / 2], [h - 0.04, h], [-d / 2, d / 2], { bevel: 0.006 }),
    span('wall', [-w / 2 + 0.02, w / 2 - 0.02], [0, h - 0.04], [-d / 2 + 0.02, d / 2 - 0.02]),
    ...skirting('trim', w, d, 0.02),
  ],
});

const halfWallColumns = defineItem({
  id: 'half-wall-with-columns',
  name: 'Half wall with square columns',
  category: C,
  type: 'structure',
  group: 'Partitions',
  tags: ['half wall', 'columns', 'craftsman', 'room divider', 'tường lửng có cột', 'header'],
  description: 'A craftsman-style divider: a capped half wall with a painted square column at each end rising to a header beam, leaving the middle open.',
  defaultSize: { w: 2.4, d: 0.22, h: 2.7 },
  minSize: { w: 1.2, d: 0.15, h: 2.2 },
  maxSize: { w: 5.0, d: 0.4, h: 3.5 },
  slots: [matSlot('wall', 'Wall', 'plaster-white'), matSlot('trim', 'Columns & header', 'paint-satin-white'), matSlot('cap', 'Cap', 'wood-oak-natural')],
  variants: [
    { id: 'sage', name: 'Sage columns', materials: { trim: 'paint-sage' } },
    { id: 'oak', name: 'Oak columns', materials: { trim: 'wood-oak-natural', cap: 'wood-walnut' } },
  ],
  build: ({ w, d, h }) => {
    const wallH = 1.0;
    const cw = Math.min(d, 0.3);
    const hdr = 0.3;
    const parts: Part[] = [
      span('wall', [-w / 2 + 0.02, w / 2 - 0.02], [0, wallH - 0.04], [-d / 2 + 0.02, d / 2 - 0.02]),
      span('cap', [-w / 2, w / 2], [wallH - 0.04, wallH], [-d / 2, d / 2], { bevel: 0.006 }),
      span('trim', [-w / 2, w / 2], [h - hdr, h], [-d / 2 + 0.01, d / 2 - 0.01], o),
      span('trim', [-w / 2 + cw, w / 2 - cw], [h - hdr - 0.03, h - hdr], [-d / 2 + 0.005, d / 2 - 0.005], o),
      ...skirting('trim', w, d, 0.02),
    ];
    for (const s of [-1, 1]) {
      const [x0, x1] = rg((s * w) / 2, s * (w / 2 - cw));
      parts.push(
        span('trim', [x0 + 0.005, x1 - 0.005], [wallH, wallH + 0.16], [-d / 2 + 0.005, d / 2 - 0.005], o),
        span('trim', [x0 + 0.015, x1 - 0.015], [wallH + 0.16, wallH + 0.18], [-d / 2 + 0.015, d / 2 - 0.015], o),
        span('trim', [x0 + 0.03, x1 - 0.03], [wallH + 0.18, h - hdr - 0.09], [-d / 2 + 0.03, d / 2 - 0.03], o),
        span('trim', [x0 + 0.02, x1 - 0.02], [h - hdr - 0.09, h - hdr - 0.06], [-d / 2 + 0.02, d / 2 - 0.02], o),
        span('trim', [x0 + 0.005, x1 - 0.005], [h - hdr - 0.06, h - hdr], [-d / 2 + 0.005, d / 2 - 0.005], o),
      );
    }
    return parts;
  },
});

const halfWallSpindles = defineItem({
  id: 'half-wall-spindle-screen',
  name: 'Half wall with spindle screen',
  category: C,
  type: 'structure',
  group: 'Partitions',
  tags: ['half wall', 'spindles', 'balusters', 'screen', 'room divider', 'vách tiện'],
  description: 'A capped half wall carrying a row of turned spindles up to a ceiling rail between two end posts: an airy, see-through room divider.',
  defaultSize: { w: 2.0, d: 0.14, h: 2.7 },
  minSize: { w: 0.8, d: 0.1, h: 1.6 },
  maxSize: { w: 4.0, d: 0.25, h: 3.2 },
  slots: [matSlot('wall', 'Wall', 'plaster-white'), matSlot('cap', 'Cap, rails & posts', 'wood-oak-natural'), matSlot('spindles', 'Spindles', 'paint-satin-white')],
  variants: [
    { id: 'all-oak', name: 'All oak', materials: { spindles: 'wood-oak-natural' } },
    { id: 'walnut', name: 'Walnut & cream', materials: { cap: 'wood-walnut', spindles: 'wood-walnut', wall: 'paint-cream' } },
    { id: 'black', name: 'Black spindles', materials: { spindles: 'paint-soft-black' } },
  ],
  build: ({ w, d, h }) => {
    const wallH = 0.95;
    const pw = 0.07;
    const parts: Part[] = [
      span('wall', [-w / 2 + 0.02, w / 2 - 0.02], [0, wallH - 0.04], [-d / 2 + 0.02, d / 2 - 0.02]),
      span('cap', [-w / 2, w / 2], [wallH - 0.04, wallH], [-d / 2, d / 2], { bevel: 0.006 }),
      span('cap', [-w / 2 + pw, w / 2 - pw], [wallH, wallH + 0.025], [-0.03, 0.03], o),
      span('cap', [-w / 2 + 0.01, w / 2 - 0.01], [h - 0.08, h], [-d / 2 + 0.02, d / 2 - 0.02], o),
      span('cap', [-w / 2 + 0.01, -w / 2 + 0.01 + pw], [wallH, h - 0.08], [-0.035, 0.035], o),
      span('cap', [w / 2 - 0.01 - pw, w / 2 - 0.01], [wallH, h - 0.08], [-0.035, 0.035], o),
      ...skirting('cap', w, d, 0.02),
    ];
    const n = clamp(Math.round((w - 2 * pw) / 0.12), 3, 40);
    for (const x of cells(n, -w / 2 + 0.01 + pw, w / 2 - 0.01 - pw)) parts.push(turnedLeg('spindles', x, 0, wallH + 0.025, h - 0.08, 0.024, { style: 'spindle' }));
    return parts;
  },
});

const archway = defineItem({
  id: 'arched-opening-wall',
  name: 'Wall section with round archway',
  category: C,
  type: 'structure',
  group: 'Partitions',
  tags: ['archway', 'arch', 'arched opening', 'cổng vòm', 'doorway', 'partition'],
  description: 'A plastered wall section with a round-headed opening, trimmed on both faces with architraves that follow the arch, a keystone and plinth blocks.',
  defaultSize: { w: 1.6, d: 0.2, h: 2.7 },
  minSize: { w: 1.0, d: 0.1, h: 2.2 },
  maxSize: { w: 3.2, d: 0.45, h: 3.6 },
  slots: [matSlot('wall', 'Wall', 'plaster-white'), matSlot('trim', 'Architraves', 'paint-satin-white')],
  variants: [
    { id: 'limewash', name: 'Limewash', materials: { wall: 'limewash-warm', trim: 'limewash-warm' } },
    { id: 'terracotta', name: 'Terracotta', materials: { wall: 'limewash-terracotta', trim: 'paint-cream' } },
    { id: 'oak', name: 'Oak architraves', materials: { trim: 'wood-oak-natural' } },
  ],
  build: ({ w, d, h }) => {
    const pier = clamp(w * 0.15, 0.15, 0.5);
    const ow = w - 2 * pier;
    const r = ow / 2;
    const sh = Math.min(2.05, h - r - 0.12);
    const tz = Math.min(0.016, d * 0.12);
    const bw = 0.07;
    const parts: Part[] = [
      span('wall', [-w / 2, -ow / 2], [0, h], [-d / 2 + tz, d / 2 - tz]),
      span('wall', [ow / 2, w / 2], [0, h], [-d / 2 + tz, d / 2 - tz]),
      panelXY('wall', archHead(-ow / 2, ow / 2, sh, h, 20), -d / 2 + tz, d - 2 * tz),
    ];
    for (const zr of [[d / 2 - tz, d / 2], [-d / 2, -d / 2 + tz]] as V2[]) {
      parts.push(
        span('trim', [-ow / 2 - bw, -ow / 2], [0.16, sh], zr, o),
        span('trim', [ow / 2, ow / 2 + bw], [0.16, sh], zr, o),
        span('trim', [-ow / 2 - bw - 0.01, -ow / 2], [0, 0.16], zr, o),
        span('trim', [ow / 2, ow / 2 + bw + 0.01], [0, 0.16], zr, o),
        span('trim', [-w / 2, -ow / 2 - bw - 0.01], [0, 0.1], zr, o),
        span('trim', [ow / 2 + bw + 0.01, w / 2], [0, 0.1], zr, o),
        span('trim', [-0.05, 0.05], [sh + r - 0.02, sh + r + bw + 0.04], zr, o),
        ...arcBand('trim', 0, sh, r, r + bw, 0, Math.PI, 14, zr),
      );
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const ow = w - 2 * clamp(w * 0.15, 0.15, 0.5);
    return [line([-ow / 2, -d / 2], [ow / 2, -d / 2]), line([-ow / 2, d / 2], [ow / 2, d / 2])];
  },
});

const reededArchPartition = defineItem({
  id: 'reeded-glass-arched-door-partition',
  name: 'Reeded glass partition with arched door',
  category: C,
  type: 'structure',
  group: 'Partitions',
  tags: ['glass partition', 'reeded glass', 'arched door', 'crittall', 'steel frame', 'vách kính'],
  description: 'A slim black steel glazing screen with reeded glass, a gridded side panel on each side and an arch-topped glazed door with a brass knob in the middle.',
  defaultSize: { w: 2.4, d: 0.06, h: 2.4 },
  minSize: { w: 1.6, d: 0.04, h: 2.1 },
  maxSize: { w: 4.0, d: 0.1, h: 3.2 },
  slots: [matSlot('frame', 'Steel frame', 'metal-black-matte'), matSlot('glass', 'Glass', 'glass-reeded'), matSlot('handle', 'Knob', 'metal-brass')],
  variants: [
    { id: 'clear', name: 'Clear glass', materials: { glass: 'glass-clear' } },
    { id: 'bronze', name: 'Bronze & frosted', materials: { frame: 'metal-bronze', glass: 'glass-frosted' } },
    { id: 'white', name: 'White frame', materials: { frame: 'metal-white-powder', handle: 'metal-chrome' } },
  ],
  build: ({ w, d, h }) => {
    const f = 0.04;
    const dw = 0.84;
    const doorTop = Math.min(2.15, h - f - 0.12);
    const ri = dw / 2 - f;
    const sy = doorTop - dw / 2;
    const gz: V2 = [-0.004, 0.004];
    const lz: V2 = [-d / 2 + 0.006, d / 2 - 0.006];
    const parts: Part[] = [
      ...frame4('frame', [-w / 2, w / 2], [0, h], [-d / 2, d / 2], f, { plan: true }),
      span('frame', [-dw / 2 - f, -dw / 2], [f, h - f], [-d / 2, d / 2]),
      span('frame', [dw / 2, dw / 2 + f], [f, h - f], [-d / 2, d / 2]),
      panelXY('glass', archHead(-dw / 2, dw / 2, sy, h - f), gz[0], gz[1] - gz[0]),
      ...arcBand('frame', 0, sy, ri, dw / 2, 0, Math.PI, 14, lz),
      span('frame', [-dw / 2, -dw / 2 + f], [f, sy], lz),
      span('frame', [dw / 2 - f, dw / 2], [f, sy], lz),
      span('frame', [-dw / 2 + f, dw / 2 - f], [f, f + 0.12], lz),
      span('frame', [-dw / 2 + f, dw / 2 - f], [0.98, 1.0], lz, o),
      panelXY('glass', archOutline(-ri, ri, f + 0.12, sy, 20), gz[0], gz[1] - gz[0]),
      sphere('handle', [dw / 2 - f - 0.05, 1.0, d / 2 - 0.012], 0.012, o),
      sphere('handle', [dw / 2 - f - 0.05, 1.0, -d / 2 + 0.012], 0.012, o),
    ];
    for (const s of [-1, 1]) {
      const [x0, x1] = rg(s * (w / 2 - f), s * (dw / 2 + f));
      parts.push(span('glass', [x0, x1], [f, h - f], gz, o));
      for (const y of spaced(3, f + (h - 2 * f) * 0.25, f + (h - 2 * f) * 0.75)) parts.push(span('frame', [x0, x1], [y - 0.012, y + 0.012], lz, o));
      if (x1 - x0 > 0.7) parts.push(span('frame', [(x0 + x1) / 2 - 0.012, (x0 + x1) / 2 + 0.012], [f, h - f], lz, o));
    }
    return parts;
  },
});

const barnDoors = defineItem({
  id: 'sliding-barn-door-partition',
  name: 'Sliding barn door partition',
  category: C,
  type: 'structure',
  group: 'Partitions',
  tags: ['barn door', 'sliding door', 'partition', 'cửa lùa', 'farmhouse', 'track'],
  description: 'A pair of plank barn doors with Z braces hanging from black strap rollers on an exposed track, closing an opening between two posts under a header.',
  defaultSize: { w: 2.0, d: 0.14, h: 2.45 },
  minSize: { w: 1.2, d: 0.14, h: 2.1 },
  maxSize: { w: 3.6, d: 0.2, h: 3.0 },
  slots: [matSlot('boards', 'Door boards', 'wood-oak-natural'), matSlot('hw', 'Track & hardware', 'metal-black-matte'), matSlot('frame', 'Posts & header', 'paint-satin-white')],
  variants: [
    { id: 'white', name: 'White boards', materials: { boards: 'wood-painted-white' } },
    { id: 'walnut', name: 'Walnut', materials: { boards: 'wood-walnut', frame: 'paint-greige' } },
    { id: 'reclaimed', name: 'Reclaimed pine', materials: { boards: 'wood-pine', hw: 'metal-gunmetal' } },
  ],
  build: (size) => {
    const { w, d, h } = size;
    const pw = 0.09;
    const zb = -d / 2;
    const zl: V2 = [zb + 0.085, zb + 0.115];
    const y0 = 0.015;
    const y1 = h - 0.14;
    const parts: Part[] = [
      span('frame', [-w / 2, -w / 2 + pw], [0, h], [zb, zb + 0.07]),
      span('frame', [w / 2 - pw, w / 2], [0, h], [zb, zb + 0.07]),
      span('frame', [-w / 2 + pw, w / 2 - pw], [h - 0.2, h], [zb, zb + 0.07], o),
      span('hw', [-w / 2 + 0.02, w / 2 - 0.02], [h - 0.12, h - 0.09], [zb + 0.07, zb + 0.08], o),
      span('hw', [-0.02, 0.02], [0, 0.015], [zb + 0.08, zb + 0.12], o),
    ];
    for (const x of spaced(4, -w / 2 + 0.06, w / 2 - 0.06)) parts.push(cyl('hw', [x, h - 0.105, zb + 0.083], 0.012, 0.006, { rotation: [Math.PI / 2, 0, 0], segments: 6, plan: false }));
    for (const s of [-1, 1]) {
      const [lx0, lx1] = rg(s * 0.002, s * (w / 2 - pw + 0.03));
      const nb = clamp(Math.round((lx1 - lx0) / 0.15), 3, 8);
      for (const [a, b] of cellSpans(nb, lx0, lx1)) parts.push(span('boards', [a + 0.002, b - 0.002], [y0, y1], [zl[0], zl[1] - 0.012]));
      const zm = zl[1] - 0.006;
      parts.push(
        span('boards', [lx0 + 0.02, lx1 - 0.02], [y1 - 0.2, y1 - 0.05], [zl[1] - 0.012, zl[1]], o),
        span('boards', [lx0 + 0.02, lx1 - 0.02], [y0 + 0.08, y0 + 0.23], [zl[1] - 0.012, zl[1]], o),
        bar('boards', [s < 0 ? lx1 - 0.09 : lx0 + 0.09, y0 + 0.23, zm], [s < 0 ? lx0 + 0.09 : lx1 - 0.09, y1 - 0.2, zm], 0.12, 0.012, o),
      );
      for (const hx of [lx0 + 0.12, lx1 - 0.12]) {
        parts.push(
          span('hw', [hx - 0.02, hx + 0.02], [y1 - 0.15, h - 0.05], [zl[1], zl[1] + 0.006], o),
          cyl('hw', [hx, h - 0.05, zb + 0.075], 0.04, 0.015, { rotation: [Math.PI / 2, 0, 0], segments: 24, plan: false }),
          rod('hw', [hx, h - 0.05, zb + 0.07], [hx, h - 0.05, zl[1] + 0.006], 0.008, o),
        );
      }
      const px = s * 0.07;
      parts.push(...barPull('hw', [px, 1.0, zl[1]], 0.3, { vertical: true, stand: 0.012, r: 0.006 }));
    }
    return keep(parts, size);
  },
});

const breezeBlocks = defineItem({
  id: 'breeze-block-screen-wall',
  name: 'Breeze block screen wall',
  category: C,
  type: 'structure',
  group: 'Partitions',
  tags: ['breeze block', 'gạch thông gió', 'ventilation block', 'screen wall', 'mid-century', 'tropical'],
  description: 'A screen wall of square ventilation blocks with round openings, the tropical Vietnamese gạch thông gió, on a concrete plinth with a coping on top.',
  defaultSize: { w: 1.8, d: 0.1, h: 2.4 },
  minSize: { w: 0.6, d: 0.08, h: 0.6 },
  maxSize: { w: 4.0, d: 0.2, h: 3.2 },
  slots: [matSlot('block', 'Breeze blocks', 'paint-warm-white'), matSlot('cap', 'Coping & plinth', 'concrete-grey')],
  variants: [
    { id: 'terracotta', name: 'Terracotta', materials: { block: 'terracotta-pot' } },
    { id: 'concrete', name: 'Raw concrete', materials: { block: 'concrete-grey', cap: 'concrete-grey' } },
    { id: 'sage', name: 'Sage', materials: { block: 'paint-sage', cap: 'paint-sage' } },
  ],
  build: ({ w, d, h }) => {
    const base = 0.1;
    const top = 0.04;
    const H = h - base - top;
    let c = 0.2;
    let nx = Math.max(1, Math.round(w / c));
    let ny = Math.max(1, Math.round(H / c));
    while (nx * ny > 110) {
      c *= 1.1;
      nx = Math.max(1, Math.round(w / c));
      ny = Math.max(1, Math.round(H / c));
    }
    const cw = w / nx;
    const ch = H / ny;
    const tb = 0.022;
    const parts: Part[] = [span('cap', [-w / 2, w / 2], [0, base], [-d / 2, d / 2]), span('cap', [-w / 2, w / 2], [h - top, h], [-d / 2, d / 2], o)];
    for (const i of range(nx + 1)) {
      const x = -w / 2 + i * cw;
      parts.push(span('block', [Math.max(-w / 2, x - tb / 2), Math.min(w / 2, x + tb / 2)], [base, h - top], [-d / 2, d / 2], o));
    }
    for (const j of range(ny + 1)) {
      const y = base + j * ch;
      parts.push(span('block', [-w / 2, w / 2], [Math.max(base, y - tb / 2), Math.min(h - top, y + tb / 2)], [-d / 2 + 0.002, d / 2 - 0.002], o));
    }
    const rr = Math.min(cw, ch) * 0.3;
    const tt = Math.min(cw, ch) * 0.075;
    for (const i of range(nx)) {
      for (const j of range(ny)) {
        parts.push(torus('block', [-w / 2 + (i + 0.5) * cw, base + (j + 0.5) * ch, 0], rr, tt, { scale: [1, 1, (d / 2 - 0.004) / tt], plan: false }));
      }
    }
    return parts;
  },
});

const curvedGlassBlock = defineItem({
  id: 'curved-glass-block-wall',
  name: 'Curved glass block wall',
  category: C,
  type: 'structure',
  group: 'Partitions',
  tags: ['glass block', 'glass brick', 'curved wall', 'gạch kính', 'shower wall', 'art deco'],
  description: 'A sweeping semicircular wall of glass blocks on a slim base with a matching cap: lets light through while screening a shower or entry.',
  defaultSize: { w: 1.6, d: 0.7, h: 2.0 },
  minSize: { w: 0.8, d: 0.3, h: 0.6 },
  maxSize: { w: 3.2, d: 1.6, h: 2.7 },
  slots: [matSlot('blocks', 'Glass blocks', 'glass-block'), matSlot('trim', 'Base & cap', 'plaster-white')],
  variants: [
    { id: 'frosted', name: 'Frosted', materials: { blocks: 'glass-frosted' } },
    { id: 'chrome', name: 'Chrome trims', materials: { trim: 'metal-chrome' } },
  ],
  build: (size) => {
    const { w, d, h } = size;
    const t = 0.08;
    const n = 12;
    const m = 0.008;
    const pt = (a: number): V2 => [(w / 2 - t / 2 - m) * Math.cos(a), d / 2 - t / 2 - m - (d - t - 2 * m) * Math.sin(a)];
    const parts: Part[] = [];
    for (const k of range(n)) {
      const p0 = pt((k / n) * Math.PI);
      const p1 = pt(((k + 1) / n) * Math.PI);
      const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) + 0.004;
      const rot: V3 = [0, Math.atan2(-(p1[1] - p0[1]), p1[0] - p0[0]), 0];
      const c: V2 = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
      parts.push(
        box('blocks', [c[0], h / 2, c[1]], [L, h - 0.09, t - 0.008], { rotation: rot }),
        box('trim', [c[0], 0.03, c[1]], [L, 0.06, t], { rotation: rot, plan: false }),
        box('trim', [c[0], h - 0.015, c[1]], [L, 0.03, t], { rotation: rot, plan: false }),
      );
    }
    return keep(parts, size);
  },
});

const serpentineSlats = defineItem({
  id: 'serpentine-slat-partition',
  name: 'Serpentine slatted partition',
  category: C,
  type: 'structure',
  group: 'Partitions',
  tags: ['slats', 'wave partition', 'curved divider', 'lam gỗ', 'room divider', 'sculptural'],
  description: 'Floor-to-ceiling oak slats set out along a gentle S-curve between a black floor track and ceiling rail: a sculptural, see-through room divider.',
  defaultSize: { w: 2.4, d: 0.5, h: 2.7 },
  minSize: { w: 1.0, d: 0.2, h: 1.2 },
  maxSize: { w: 5.0, d: 1.2, h: 3.2 },
  slots: [matSlot('slats', 'Slats', 'wood-oak-natural'), matSlot('rail', 'Rails', 'metal-black-matte')],
  variants: [
    { id: 'walnut', name: 'Walnut', materials: { slats: 'wood-walnut' } },
    { id: 'white', name: 'White', materials: { slats: 'paint-satin-white', rail: 'metal-white-powder' } },
    { id: 'bamboo', name: 'Bamboo', materials: { slats: 'wood-bamboo' } },
  ],
  build: (size) => {
    const { w, d, h } = size;
    const A = (d - 0.07) / 2;
    const L = w - 0.07;
    const at = (t: number): V2 => [-L / 2 + t * L, A * Math.sin(2 * Math.PI * t)];
    const yaw = (t: number) => Math.atan2(-2 * Math.PI * A * Math.cos(2 * Math.PI * t), L);
    const parts: Part[] = [];
    const n = clamp(Math.round(w / 0.07), 8, 64);
    for (const t of spaced(n, 0, 1)) {
      const [x, z] = at(t);
      parts.push(box('slats', [x, h / 2, z], [0.03, h - 0.08, 0.06], { rotation: [0, yaw(t), 0] }));
    }
    const m = 16;
    for (const k of range(m)) {
      const [a, b] = [at(k / m), at((k + 1) / m)];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) + 0.01;
      const rot: V3 = [0, Math.atan2(-(b[1] - a[1]), b[0] - a[0]), 0];
      parts.push(box('rail', [(a[0] + b[0]) / 2, 0.02, (a[1] + b[1]) / 2], [len, 0.04, 0.045], { rotation: rot, plan: false }));
      parts.push(box('rail', [(a[0] + b[0]) / 2, h - 0.02, (a[1] + b[1]) / 2], [len, 0.04, 0.045], { rotation: rot, plan: false }));
    }
    return keep(parts, size);
  },
});

const canePartition = defineItem({
  id: 'cane-panel-room-divider',
  name: 'Arched cane panel partition',
  category: C,
  type: 'structure',
  group: 'Partitions',
  tags: ['cane', 'rattan', 'partition', 'vách mây', 'arched', 'room divider'],
  description: 'A fixed walnut-framed partition of tall arch-topped rattan cane panels over a row of low cane panels, letting light and air pass between rooms.',
  defaultSize: { w: 2.0, d: 0.06, h: 2.4 },
  minSize: { w: 0.8, d: 0.04, h: 1.8 },
  maxSize: { w: 4.0, d: 0.1, h: 3.2 },
  slots: [matSlot('frame', 'Frame', 'wood-walnut'), matSlot('cane', 'Cane webbing', 'cane-natural')],
  variants: [
    { id: 'oak', name: 'Oak frame', materials: { frame: 'wood-oak-natural' } },
    { id: 'black', name: 'Black frame', materials: { frame: 'paint-soft-black' } },
    { id: 'white', name: 'White frame', materials: { frame: 'paint-satin-white' } },
  ],
  build: ({ w, d, h }) => {
    const f = 0.045;
    const ty = 0.9;
    const cols = clamp(Math.round(w / 0.65), 1, 6);
    const parts: Part[] = [
      ...frame4('frame', [-w / 2, w / 2], [0, h], [-d / 2, d / 2], f, { plan: true }),
      span('frame', [-w / 2 + f, w / 2 - f], [ty - f / 2, ty + f / 2], [-d / 2, d / 2], o),
    ];
    const cz: V2 = [-0.004, 0.004];
    for (const [i, [a, b]] of cellSpans(cols, -w / 2 + f, w / 2 - f).entries()) {
      const x0 = i === 0 ? a : a + f / 2;
      const x1 = i === cols - 1 ? b : b - f / 2;
      if (i > 0) parts.push(span('frame', [a - f / 2, a + f / 2], [f, h - f], [-d / 2, d / 2]));
      const sy = h - f - (x1 - x0) / 2;
      parts.push(span('cane', [x0, x1], [f, ty - f / 2], cz, o));
      parts.push(panelXY('frame', archHead(x0, x1, sy, h - f, 14), -d / 2 + 0.005, d - 0.01));
      parts.push(panelXY('cane', archOutline(x0, x1, ty + f / 2, sy, 14), cz[0], cz[1] - cz[0]));
    }
    return parts;
  },
});

// ---------------------------------------------------------------------------
// Staircases, steps and balustrades
// ---------------------------------------------------------------------------

/** A straight flight of steps climbing along one axis. */
interface Flight {
  axis: 'x' | 'z';
  /** The flight's width on the other axis (between the strings). */
  across: V2;
  /** Position of the first riser on the axis. */
  s0: number;
  /** Climbing direction along the axis. */
  dir: 1 | -1;
  n: number;
  going: number;
  /** Level the flight starts from. */
  y0: number;
  rise: number;
}
const NOSE = 0.025;

/** A box over `across` × `along` (flight axis) × y. */
const fspan = (slot: string, f: Flight, across: V2, along: V2, y: V2, opts?: { plan?: boolean; bevel?: number }): Part =>
  f.axis === 'z' ? span(slot, across, y, along, opts) : span(slot, along, y, across, opts);

/** The point `s` up the flight (measured from the first riser), `c` across it, at height y. */
const fpt = (f: Flight, s: number, c: number, y: number): V3 => (f.axis === 'z' ? [c, y, f.s0 + f.dir * s] : [f.s0 + f.dir * s, y, c]);

/** Height of the line through the nosings, `s` up the flight. */
const nosing = (f: Flight, s: number) => f.y0 + f.rise + (s * f.rise) / f.going;

/** Treads (with nosings) and optional closed risers. */
function steps(f: Flight, tread: string, riser: string | null, tt = 0.04): Part[] {
  const parts: Part[] = [];
  for (const i of range(f.n)) {
    const a = f.s0 + f.dir * i * f.going;
    const top = f.y0 + (i + 1) * f.rise;
    parts.push(fspan(tread, f, f.across, rg(a - f.dir * NOSE, a + f.dir * f.going), [top - tt, top]));
    if (riser) parts.push(fspan(riser, f, f.across, rg(a, a + f.dir * 0.02), [f.y0 + i * f.rise, top - tt], o));
  }
  return parts;
}

/** A closed string (side board) along a flight over `c` across, trimmed at the floor and at yMax. */
function stairString(slot: string, f: Flight, c: V2, yMax: number, depth = 0.3, over = 0.05): Part {
  const L = f.n * f.going;
  const k = f.rise / f.going;
  const top0 = f.y0 + f.rise + over;
  const yT = (s: number) => Math.min(yMax, top0 + s * k);
  const yB = (s: number) => Math.max(f.y0, top0 - depth + s * k);
  const sFloor = (depth - f.rise - over) / k;
  const sTop = (yMax - top0) / k;
  const pts: V2[] = [[0, f.y0], [0, yT(0)]];
  if (sTop > 0 && sTop < L) pts.push([sTop, yMax]);
  pts.push([L, yT(L)], [L, yB(L)]);
  if (sFloor > 0 && sFloor < L) pts.push([sFloor, f.y0]);
  const P = pts.map(([s, y]) => [f.s0 + f.dir * s, y] as V2);
  return f.axis === 'z' ? panelZY(slot, P, c[0], c[1] - c[0], true) : panelXY(slot, P, c[0], c[1] - c[0], true);
}

/** Square balusters `per` tread at `c` across, standing on the string (or the treads) up to the handrail. */
function balusters(slot: string, f: Flight, c: number, yMax: number, opts?: { per?: number; size?: number; onTreads?: boolean; round?: boolean }): Part[] {
  const per = opts?.per ?? 2;
  const sz = opts?.size ?? 0.032;
  const parts: Part[] = [];
  for (const i of range(f.n)) {
    for (const k of range(per)) {
      const s = (i + (k + 0.5) / per) * f.going;
      const yb = opts?.onTreads ? f.y0 + (i + 1) * f.rise : nosing(f, s) + 0.05;
      const yr = Math.min(yMax - 0.05, nosing(f, s) + 0.88);
      if (yr - yb < 0.1) continue;
      const p = fpt(f, s, c, 0);
      parts.push(opts?.round ? vcyl(slot, p[0], p[2], yb, yr, sz / 2, { segments: 10, plan: false }) : span(slot, [p[0] - sz / 2, p[0] + sz / 2], [yb, yr], [p[2] - sz / 2, p[2] + sz / 2], o));
    }
  }
  return parts;
}

/** Handrail following the pitch `off` above the nosings from s = a to b, stopping below yMax. */
function handrail(slot: string, f: Flight, c: number, yMax: number, a: number, b: number, off = 0.9, sec: V2 = [0.06, 0.045]): Part[] {
  const k = f.rise / f.going;
  const end = Math.min(b, (yMax - 0.03 - (f.y0 + f.rise + off)) / k);
  if (end - a < 0.1) return [];
  const p0 = fpt(f, a, c, nosing(f, a) + off);
  const p1 = fpt(f, end, c, nosing(f, end) + off);
  return [f.axis === 'z' ? bar(slot, p0, p1, sec[0], sec[1], { plan: false, bevel: 0.012 }) : bar(slot, p0, p1, sec[1], sec[0], { plan: false, bevel: 0.012 })];
}

/** A square newel post with a cap and ball finial; total height clipped to yMax. */
function newel(slot: string, x: number, z: number, y1: number, yMax: number, s = 0.09): Part[] {
  const top = Math.min(y1, yMax - 0.1);
  return [
    span(slot, [x - s / 2, x + s / 2], [0, top], [z - s / 2, z + s / 2]),
    span(slot, [x - s / 2 - 0.008, x + s / 2 + 0.008], [top, top + 0.03], [z - s / 2 - 0.008, z + s / 2 + 0.008], o),
    sphere(slot, [x, top + 0.065, z], 0.035, o),
  ];
}

/** Plan strokes for a flight: a line at every riser. */
const treadLines = (f: Flight): PlanStroke[] =>
  range(f.n).map((i) => {
    const a = f.s0 + f.dir * i * f.going;
    return f.axis === 'z' ? line([f.across[0], a], [f.across[1], a]) : line([a, f.across[0]], [a, f.across[1]]);
  });

const stairSlots = [
  matSlot('tread', 'Treads & handrails', 'wood-oak-natural'),
  matSlot('paint', 'Risers & strings', 'paint-satin-white'),
  matSlot('spindles', 'Spindles & newels', 'paint-satin-white'),
];
const stairVariants: AssetPresetVariant[] = [
  { id: 'all-oak', name: 'All oak', materials: { paint: 'wood-oak-natural', spindles: 'wood-oak-natural' } },
  { id: 'walnut', name: 'Walnut & white', materials: { tread: 'wood-walnut' } },
  { id: 'black', name: 'Oak & black', materials: { spindles: 'paint-soft-black', paint: 'paint-charcoal' } },
];
const ST = 0.04;

const straightFlight = ({ w, d, h }: Size3): Flight => {
  const n = clamp(Math.round(h / 0.18), 4, 22);
  return { axis: 'z', across: [-w / 2 + ST, w / 2 - ST], s0: d / 2 - NOSE, dir: -1, n, going: (d - NOSE - 0.002) / n, y0: 0, rise: h / n };
};

const straightStair = defineItem({
  id: 'straight-staircase-spindles',
  name: 'Straight staircase with spindle balustrade',
  category: C,
  type: 'structure',
  group: 'Stairs & steps',
  tags: ['staircase', 'stairs', 'straight stair', 'cầu thang', 'balustrade', 'newel'],
  description: 'A straight closed-string staircase with oak treads, white risers, square spindles and a newel post on the open side, and a wall handrail on brackets.',
  defaultSize: { w: 0.95, d: 3.6, h: 2.7 },
  minSize: { w: 0.7, d: 1.6, h: 1.0 },
  maxSize: { w: 1.6, d: 5.5, h: 4.0 },
  slots: [...stairSlots, matSlot('metal', 'Wall-rail brackets', 'metal-brushed-steel')],
  variants: stairVariants,
  build: (size) => {
    const { w, d, h } = size;
    const f = straightFlight(size);
    const L = f.n * f.going;
    const parts: Part[] = [
      ...steps(f, 'tread', 'paint'),
      stairString('paint', f, [-w / 2, -w / 2 + ST], h),
      stairString('paint', f, [w / 2 - ST, w / 2], h),
      ...balusters('spindles', f, w / 2 - ST / 2, h),
      ...newel('spindles', w / 2 - 0.055, d / 2 - 0.055, nosing(f, 0) + 1.0, h),
      ...handrail('tread', f, w / 2 - 0.03, h, 0.1, L),
      ...handrail('tread', f, -w / 2 + 0.07, h, 0.3, L, 0.88, [0.045, 0.045]),
    ];
    for (const s of spaced(3, 0.5, L * 0.8)) {
      const y = nosing(f, s) + 0.84;
      if (y > h - 0.06) continue;
      const z = f.s0 - s;
      parts.push(rod('metal', [-w / 2, y, z], [-w / 2 + 0.07, y, z], 0.007, o), cyl('metal', [-w / 2 + 0.004, y, z], 0.025, 0.008, { rotation: [0, 0, Math.PI / 2], plan: false }));
    }
    return keep(parts, size);
  },
  planDetail: (size) => {
    const f = straightFlight(size);
    return [...treadLines(f), ...stairArrow([[0, size.d / 2 - 0.1], [0, -size.d / 2 + 0.15]])];
  },
});

const floatingStair = defineItem({
  id: 'floating-staircase-glass',
  name: 'Floating oak staircase with glass balustrade',
  category: C,
  type: 'structure',
  group: 'Stairs & steps',
  tags: ['floating stairs', 'cantilever stairs', 'glass balustrade', 'cầu thang bay', 'modern', 'LED'],
  description: 'Chunky oak block treads cantilevered from the wall with no risers, each lit underneath by an LED strip, guarded by a frameless glass balustrade with a steel cap rail.',
  defaultSize: { w: 0.9, d: 3.6, h: 2.7 },
  minSize: { w: 0.7, d: 1.6, h: 1.0 },
  maxSize: { w: 1.3, d: 5.5, h: 4.0 },
  slots: [matSlot('tread', 'Treads', 'wood-oak-natural'), matSlot('glass', 'Glass', 'glass-clear'), matSlot('steel', 'Clamps, rail & wall plate', 'metal-brushed-steel'), matSlot('glow', 'LED strips', 'light-warm')],
  variants: [
    { id: 'walnut', name: 'Walnut', materials: { tread: 'wood-walnut' } },
    { id: 'concrete', name: 'Concrete treads', materials: { tread: 'microcement', steel: 'metal-black-matte' } },
    { id: 'smoked', name: 'Smoked glass & black', materials: { glass: 'glass-tinted', steel: 'metal-black-matte' } },
  ],
  build: (size) => {
    const { w, d, h } = size;
    const n = clamp(Math.round(h / 0.18), 4, 22);
    const f: Flight = { axis: 'z', across: [-w / 2 + 0.012, w / 2 - 0.03], s0: d / 2 - 0.005, dir: -1, n, going: (d - 0.01) / n, y0: 0, rise: h / n };
    const tt = Math.min(0.08, f.rise * 0.45);
    const parts: Part[] = [];
    for (const i of range(n)) {
      const a = f.s0 - i * f.going;
      const top = (i + 1) * f.rise;
      parts.push(span('tread', f.across, [top - tt, top], [a - f.going + 0.004, a], { bevel: 0.004 }));
      parts.push(span('glow', [-w / 2 + 0.05, w / 2 - 0.08], [top - tt - 0.004, top - tt], [a - f.going + 0.04, a - 0.04], o));
    }
    // Hidden steel stringer plate on the wall, showing as a thin band under the treads.
    const k = f.rise / f.going;
    const L = n * f.going;
    const plate: V2[] = [[f.s0, 0], [f.s0, f.rise - tt], [f.s0 - L + f.going, h - tt], [f.s0 - L, h - tt], [f.s0 - L, Math.max(0, h - tt - 0.2)]];
    const sF = (0.2 - (f.rise - tt)) / k;
    if (sF > 0 && sF < L) plate.push([f.s0 - sF, 0]);
    parts.push(panelZY('steel', plate, -w / 2, 0.012));
    // Glass panels, about a metre each, along the open side.
    const yTop = (s: number) => Math.min(h, nosing(f, s) + 0.9);
    const yBot = (s: number) => Math.max(0, nosing(f, s) - tt - 0.12);
    const segs = Math.max(1, Math.round(L / 1.1));
    for (const [sa, sb] of cellSpans(segs, 0, L)) {
      const a = sa + 0.006;
      const b = sb - 0.006;
      const ss = [a, ...[(h - f.y0 - f.rise - 0.9) / k, (tt + 0.12 - f.rise) / k].filter((s) => s > a && s < b).sort((p, q) => p - q), b];
      const pts: V2[] = [...ss.map((s) => [f.s0 - s, yBot(s)] as V2), ...ss.reverse().map((s) => [f.s0 - s, yTop(s)] as V2)];
      parts.push(panelZY('glass', pts, w / 2 - 0.014, 0.012, true));
      for (const s of [sa + (sb - sa) * 0.25, sa + (sb - sa) * 0.75]) {
        const y = nosing(f, s) - tt - 0.04;
        if (y > 0.04 && y < h - 0.04) parts.push(span('steel', [w / 2 - 0.03, w / 2 - 0.014], [y - 0.03, y + 0.03], [f.s0 - s - 0.025, f.s0 - s + 0.025], o));
      }
    }
    parts.push(...handrail('steel', f, w / 2 - 0.008, h, 0.01, L - 0.01, 0.91, [0.016, 0.03]));
    return keep(parts, size);
  },
  planDetail: (size) => [...treadLines(straightFlight(size)), ...stairArrow([[0, size.d / 2 - 0.1], [0, -size.d / 2 + 0.15]])],
});

const spineStair = defineItem({
  id: 'steel-spine-staircase',
  name: 'Steel spine staircase with open treads',
  category: C,
  type: 'structure',
  group: 'Stairs & steps',
  tags: ['mono stringer', 'spine staircase', 'steel stairs', 'open riser', 'cầu thang xương cá', 'industrial'],
  description: 'A central black steel spine with welded brackets carrying open oak treads, a row of slim steel balusters and a flat steel handrail on one side.',
  defaultSize: { w: 0.9, d: 3.4, h: 2.7 },
  minSize: { w: 0.7, d: 1.6, h: 1.0 },
  maxSize: { w: 1.3, d: 5.5, h: 4.0 },
  slots: [matSlot('steel', 'Steel', 'metal-black-matte'), matSlot('tread', 'Treads', 'wood-oak-natural')],
  variants: [
    { id: 'walnut', name: 'Walnut treads', materials: { tread: 'wood-walnut' } },
    { id: 'white', name: 'White steel', materials: { steel: 'metal-white-powder' } },
    { id: 'ironwood', name: 'Ironwood treads', materials: { tread: 'wood-ironwood', steel: 'metal-anthracite' } },
  ],
  build: (size) => {
    const { w, d, h } = size;
    const n = clamp(Math.round(h / 0.18), 4, 22);
    const going = (d - 0.06) / n;
    const rise = h / n;
    const zf = d / 2 - 0.03;
    const f: Flight = { axis: 'z', across: [-w / 2, w / 2], s0: zf, dir: -1, n, going, y0: 0, rise };
    const parts: Part[] = [];
    const drop = 0.2;
    const spineY = (s: number) => nosing(f, s) - 0.045 - drop;
    const kk = rise / going;
    const sA = Math.max(0, (0.02 - (spineY(0) + 0.08)) / kk);
    const sEnd = (n - 0.5) * going;
    parts.push(panelZY('steel', band(sA, sEnd, (s) => spineY(s) + 0.08, (s) => spineY(s) - 0.08, 0, h).map(([s, y]) => [zf - s, y] as V2), -0.05, 0.1, true));
    const zp = zf - Math.max(sA, (0.08 - spineY(0)) / kk);
    parts.push(span('steel', [-0.1, 0.1], [0, 0.012], [Math.max(-d / 2, zp - 0.15), Math.min(d / 2, zp + 0.15)]));
    for (const i of range(n)) {
      const a = zf - i * going;
      const top = (i + 1) * rise;
      const sm = (i + 0.5) * going;
      parts.push(span('tread', [-w / 2, w / 2], [top - 0.045, top], [a - going + 0.006, a + 0.006], { bevel: 0.003 }));
      const yb = Math.max(0.02, spineY(sm) + 0.06);
      if (top - 0.045 - yb > 0.01) parts.push(span('steel', [-0.12, 0.12], [yb, top - 0.045], [a - going / 2 - 0.03, a - going / 2 + 0.03], o));
      parts.push(span('steel', [-w / 2 + 0.06, w / 2 - 0.06], [top - 0.055, top - 0.045], [a - going / 2 - 0.02, a - going / 2 + 0.02], o));
    }
    parts.push(...balusters('steel', f, w / 2 - 0.03, h, { per: 1, size: 0.018, onTreads: true, round: true }));
    parts.push(...handrail('steel', f, w / 2 - 0.03, h, 0.02, n * going, 0.9, [0.012, 0.05]));
    return keep(parts, size);
  },
  planDetail: ({ w, d, h }) => {
    const n = clamp(Math.round(h / 0.18), 4, 22);
    const f: Flight = { axis: 'z', across: [-w / 2, w / 2], s0: d / 2 - 0.03, dir: -1, n, going: (d - 0.06) / n, y0: 0, rise: h / n };
    return [...treadLines(f), ...stairArrow([[0, d / 2 - 0.1], [0, -d / 2 + 0.15]])];
  },
});

/** L-shaped stair in the back-right corner: flight 1 up the right side, a quarter landing, flight 2 to the left. */
function lFlights({ w, d, h }: Size3) {
  const sw = clamp(Math.min(w, d) * 0.42, 0.75, 1.1);
  const n = clamp(Math.round(h / 0.18), 6, 24);
  const rise = h / n;
  const len1 = d - sw - NOSE;
  const len2 = w - sw - 0.002;
  const n1 = clamp(Math.round(((n - 1) * len1) / (len1 + len2)), 1, n - 2);
  const n2 = n - 1 - n1;
  const f1: Flight = { axis: 'z', across: [w / 2 - sw + ST, w / 2 - ST], s0: d / 2 - NOSE, dir: -1, n: n1, going: len1 / n1, y0: 0, rise };
  const f2: Flight = { axis: 'x', across: [-d / 2 + ST, -d / 2 + sw - ST], s0: w / 2 - sw, dir: -1, n: n2, going: len2 / n2, y0: (n1 + 1) * rise, rise };
  return { sw, f1, f2, yl: (n1 + 1) * rise };
}

const lStair = defineItem({
  id: 'l-shaped-staircase',
  name: 'L-shaped staircase with quarter landing',
  category: C,
  type: 'structure',
  group: 'Stairs & steps',
  tags: ['L-shaped stairs', 'quarter landing', 'staircase', 'cầu thang chữ L', 'corner stairs', 'newel'],
  description: 'A corner staircase that climbs one wall, turns on a square quarter landing and continues along the next wall, with closed strings, spindles and newel posts on the open side.',
  defaultSize: { w: 2.2, d: 2.8, h: 2.7 },
  minSize: { w: 1.6, d: 1.8, h: 2.2 },
  maxSize: { w: 3.6, d: 4.2, h: 3.6 },
  slots: stairSlots,
  variants: stairVariants,
  build: (size) => {
    const { w, d, h } = size;
    const { sw, f1, f2, yl } = lFlights(size);
    const parts: Part[] = [
      ...steps(f1, 'tread', 'paint'),
      ...steps(f2, 'tread', 'paint'),
      span('tread', [w / 2 - sw, w / 2], [yl - 0.04, yl], [-d / 2, -d / 2 + sw]),
      span('paint', f1.across, [yl - f1.rise, yl - 0.04], [-d / 2 + sw - 0.02, -d / 2 + sw], o),
      span('paint', [w / 2 - sw, w / 2], [yl - 0.28, yl + 0.05], [-d / 2, -d / 2 + ST], o),
      span('paint', [w / 2 - ST, w / 2], [yl - 0.28, yl + 0.05], [-d / 2 + ST, -d / 2 + sw], o),
      stairString('paint', f1, [w / 2 - ST, w / 2], h),
      stairString('paint', f1, [w / 2 - sw, w / 2 - sw + ST], h),
      stairString('paint', f2, [-d / 2, -d / 2 + ST], h),
      stairString('paint', f2, [-d / 2 + sw - ST, -d / 2 + sw], h),
      ...balusters('spindles', f1, w / 2 - sw + ST / 2, h),
      ...balusters('spindles', f2, -d / 2 + sw - ST / 2, h),
      ...newel('spindles', w / 2 - sw + 0.045, d / 2 - 0.055, nosing(f1, 0) + 1.0, h),
      ...newel('spindles', w / 2 - sw + 0.045, -d / 2 + sw - 0.045, yl + 1.0, h, 0.1),
      ...handrail('tread', f1, w / 2 - sw + 0.03, h, 0.1, f1.n * f1.going - 0.06),
      ...handrail('tread', f2, -d / 2 + sw - 0.03, h, 0.06, f2.n * f2.going),
    ];
    return keep(parts, size);
  },
  planDetail: (size) => {
    const { sw, f1, f2 } = lFlights(size);
    const { w, d } = size;
    return [...treadLines(f1), ...treadLines(f2), ...stairArrow([[w / 2 - sw / 2, d / 2 - 0.1], [w / 2 - sw / 2, -d / 2 + sw / 2], [-w / 2 + 0.15, -d / 2 + sw / 2]])];
  },
});

/** U-shaped stair: flight 1 up the right half, a half landing across the back, flight 2 back down the left half. */
function uFlights({ w, d, h }: Size3) {
  const gap = 0.1;
  const sw = (w - gap) / 2;
  const lw = clamp(sw, 0.8, Math.min(1.2, d * 0.4));
  const n = clamp(Math.round(h / 0.18), 6, 24);
  const rise = h / n;
  const n1 = Math.floor((n - 1) / 2);
  const n2 = n - 1 - n1;
  const f1: Flight = { axis: 'z', across: [gap / 2 + ST, w / 2 - ST], s0: d / 2 - NOSE, dir: -1, n: n1, going: (d - lw - NOSE) / n1, y0: 0, rise };
  const f2: Flight = { axis: 'z', across: [-w / 2 + ST, -gap / 2 - ST], s0: -d / 2 + lw, dir: 1, n: n2, going: (d - lw - 0.002) / n2, y0: (n1 + 1) * rise, rise };
  return { gap, sw, lw, f1, f2, yl: (n1 + 1) * rise };
}

const uStair = defineItem({
  id: 'u-shaped-staircase',
  name: 'U-shaped staircase with half landing',
  category: C,
  type: 'structure',
  group: 'Stairs & steps',
  tags: ['U-shaped stairs', 'half landing', 'dog-leg', 'switchback', 'cầu thang chữ U', 'staircase'],
  description: 'A compact switchback staircase: two flights side by side joined by a full-width half landing, with spindle balustrades along the narrow well and newel posts at the turn.',
  defaultSize: { w: 2.0, d: 2.8, h: 2.7 },
  minSize: { w: 1.6, d: 2.0, h: 2.2 },
  maxSize: { w: 3.0, d: 4.2, h: 3.6 },
  slots: stairSlots,
  variants: stairVariants,
  build: (size) => {
    const { w, d, h } = size;
    const { gap, lw, f1, f2, yl } = uFlights(size);
    const zl = -d / 2 + lw;
    const parts: Part[] = [
      ...steps(f1, 'tread', 'paint'),
      ...steps(f2, 'tread', 'paint'),
      span('tread', [-w / 2, w / 2], [yl - 0.04, yl], [-d / 2, zl]),
      span('paint', f1.across, [yl - f1.rise, yl - 0.04], [zl - 0.02, zl], o),
      span('paint', [-w / 2, w / 2], [yl - 0.28, yl - 0.04], [zl - 0.035, zl - 0.005], o),
      span('paint', [-w / 2, w / 2], [yl - 0.28, yl + 0.05], [-d / 2, -d / 2 + ST], o),
      stairString('paint', f1, [w / 2 - ST, w / 2], h),
      stairString('paint', f1, [gap / 2, gap / 2 + ST], h),
      stairString('paint', f2, [-w / 2, -w / 2 + ST], h),
      stairString('paint', f2, [-gap / 2 - ST, -gap / 2], h),
      ...balusters('spindles', f1, gap / 2 + ST / 2, h),
      ...balusters('spindles', f2, -gap / 2 - ST / 2, h),
      ...newel('spindles', gap / 2 + 0.045, d / 2 - 0.055, nosing(f1, 0) + 1.0, h),
      ...newel('spindles', gap / 2 + 0.045, zl - 0.045, yl + 1.0, h),
      ...newel('spindles', -gap / 2 - 0.045, zl - 0.045, yl + 1.0, h),
      ...handrail('tread', f1, gap / 2 + 0.03, h, 0.1, f1.n * f1.going - 0.1),
      ...handrail('tread', f2, -gap / 2 - 0.03, h, 0.06, f2.n * f2.going),
    ];
    if (yl + 0.92 < h - 0.02) parts.push(span('tread', [-gap / 2, gap / 2], [yl + 0.86, yl + 0.9], [zl - 0.075, zl - 0.015], o));
    return keep(parts, size);
  },
  planDetail: (size) => {
    const { gap, lw, f1, f2 } = uFlights(size);
    const { w, d } = size;
    const xr = (gap / 2 + w / 2) / 2;
    return [...treadLines(f1), ...treadLines(f2), ...stairArrow([[xr, d / 2 - 0.1], [xr, -d / 2 + lw / 2], [-xr, -d / 2 + lw / 2], [-xr, d / 2 - 0.15]])];
  },
});

const spiralStair = defineItem({
  id: 'spiral-staircase',
  name: 'Spiral staircase',
  category: C,
  type: 'structure',
  group: 'Stairs & steps',
  tags: ['spiral staircase', 'helical stairs', 'cầu thang xoắn ốc', 'loft', 'compact stairs', 'mezzanine'],
  description: 'A space-saving spiral stair: wedge-shaped oak treads on steel arms around a central column, turning three-quarters to a quarter landing, with a baluster per tread and a curving handrail.',
  defaultSize: { w: 1.6, d: 1.6, h: 2.7 },
  minSize: { w: 1.2, d: 1.2, h: 2.2 },
  maxSize: { w: 2.4, d: 2.4, h: 3.6 },
  slots: [matSlot('tread', 'Treads', 'wood-oak-natural'), matSlot('frame', 'Column & balusters', 'metal-black-matte'), matSlot('rail', 'Handrail', 'wood-oak-natural')],
  variants: [
    { id: 'all-black', name: 'All black steel', materials: { tread: 'metal-black-matte', rail: 'metal-black-matte' } },
    { id: 'white', name: 'White & oak', materials: { frame: 'metal-white-powder' } },
    { id: 'walnut', name: 'Walnut & brass', materials: { tread: 'wood-walnut', rail: 'wood-walnut', frame: 'metal-bronze' } },
  ],
  build: (size) => {
    const { w, d, h } = size;
    const n = clamp(Math.round(h / 0.21), 8, 18);
    const rise = h / n;
    const rx = w / 2;
    const rz = d / 2;
    const rc = 0.07;
    const a0 = Math.PI / 2;
    const da = (1.5 * Math.PI) / (n - 1);
    const P = (a: number, r: number): V2 => [Math.cos(a) * r * rx, Math.sin(a) * r * rz];
    const tt = 0.04;
    const parts: Part[] = [vcyl('frame', 0, 0, 0, h, 0.055, { segments: 20 }), cyl('frame', [0, 0.006, 0], 0.16, 0.012, { segments: 24 })];
    const rails: V3[] = [];
    for (const i of range(n)) {
      const top = (i + 1) * rise;
      const last = i === n - 1;
      const t0 = a0 + i * da;
      const t1 = last ? a0 + 2 * Math.PI : t0 + da + 0.04;
      const m = last ? 10 : 5;
      const outline: V2[] = [[Math.cos(t0) * rc, Math.sin(t0) * rc], ...range(m + 1).map((k) => P(t0 + ((t1 - t0) * k) / m, 0.995)), [Math.cos(t1) * rc, Math.sin(t1) * rc]];
      parts.push(prism('tread', outline, top - tt, tt));
      const [ex, ez] = P(t0 + 0.06, 0.92);
      parts.push(rod('frame', [Math.cos(t0 + 0.06) * 0.05, top - tt - 0.015, Math.sin(t0 + 0.06) * 0.05], [ex, top - tt - 0.015, ez], 0.012, { segments: 8, plan: false }));
      if (last) continue;
      for (const f of [0.3, 0.8]) {
        const [bx, bz] = P(t0 + da * f, 0.93);
        const yr = Math.min(h - 0.03, top + 0.88 + rise * (f - 0.5));
        if (yr - top > 0.1) parts.push(vcyl('frame', bx, bz, top, yr, 0.009, { segments: 8, plan: false }));
      }
      const [hx, hz] = P(t0 + da * 0.55, 0.93);
      rails.push([hx, Math.min(h - 0.03, top + 0.9), hz]);
    }
    for (const i of range(rails.length - 1)) parts.push(rod('rail', rails[i], rails[i + 1], 0.022, { segments: 10, plan: false }));
    parts.push(sphere('frame', [0, h - 0.03, 0], 0.03, o));
    return keep(parts, size);
  },
  planDetail: ({ w, d, h }) => {
    const n = clamp(Math.round(h / 0.21), 8, 18);
    const da = (1.5 * Math.PI) / (n - 1);
    const strokes: PlanStroke[] = [poly(ellipsePoints(0, 0, w / 2 - 0.004, d / 2 - 0.004, 40))];
    for (const i of range(n)) {
      const a = Math.PI / 2 + i * da;
      strokes.push(line([Math.cos(a) * 0.07, Math.sin(a) * 0.07], [Math.cos(a) * (w / 2 - 0.004), Math.sin(a) * (d / 2 - 0.004)]));
    }
    const arc: V2[] = range(13).map((k) => {
      const a = Math.PI / 2 + 0.2 + (1.5 * Math.PI - 0.4) * (k / 12);
      return [Math.cos(a) * w * 0.3, Math.sin(a) * d * 0.3];
    });
    return [...strokes, ...stairArrow(arc)];
  },
});

const atticLadder = defineItem({
  id: 'folding-attic-ladder',
  name: 'Folding loft ladder with hatch',
  category: C,
  type: 'structure',
  group: 'Stairs & steps',
  tags: ['loft ladder', 'attic ladder', 'folding ladder', 'thang gác xép', 'hatch', 'access'],
  description: 'A three-section folding timber loft ladder unfolded from a white ceiling hatch, with the hatch door hanging behind it, spring arms, metal hinges and a short handrail.',
  defaultSize: { w: 0.7, d: 1.6, h: 2.7 },
  minSize: { w: 0.55, d: 1.2, h: 2.2 },
  maxSize: { w: 1.0, d: 2.2, h: 3.2 },
  slots: [matSlot('ladder', 'Ladder', 'wood-pine'), matSlot('hatch', 'Hatch & frame', 'paint-satin-white'), matSlot('metal', 'Hinges & arms', 'metal-brushed-steel')],
  variants: [
    { id: 'aluminium', name: 'Aluminium ladder', materials: { ladder: 'metal-brushed-steel', metal: 'metal-anthracite' } },
    { id: 'oak', name: 'Oak ladder', materials: { ladder: 'wood-oak-natural' } },
  ],
  build: (size) => {
    const { w, d, h } = size;
    const fr = 0.07;
    const Lh = Math.min(1.2, d - 0.15);
    const T: V3 = [0, h - fr, -d / 2 + 0.07];
    const B: V3 = [0, 0, d / 2 - 0.04];
    const v: V3 = [0, T[1] - B[1], T[2] - B[2]];
    const Lt = Math.hypot(v[1], v[2]);
    const u: V3 = [0, v[1] / Lt, v[2] / Lt];
    const nrm: V3 = [0, -u[2], u[1]];
    const at = (s: number, x: number, off = 0): V3 => [x, B[1] + u[1] * s + nrm[1] * off, B[2] + u[2] * s + nrm[2] * off];
    const sx = w / 2 - 0.075;
    const parts: Part[] = [
      span('hatch', [-w / 2, w / 2], [h - fr, h], [-d / 2, -d / 2 + 0.04]),
      span('hatch', [-w / 2, w / 2], [h - fr, h], [-d / 2 + Lh - 0.04, -d / 2 + Lh]),
      span('hatch', [-w / 2, -w / 2 + 0.04], [h - fr, h], [-d / 2 + 0.04, -d / 2 + Lh - 0.04]),
      span('hatch', [w / 2 - 0.04, w / 2], [h - fr, h], [-d / 2 + 0.04, -d / 2 + Lh - 0.04]),
      bar('hatch', at(Lt, 0, -0.045), at(Lt - Lh + 0.08, 0, -0.045), w - 0.1, 0.03, o),
    ];
    const gap = 0.012;
    for (const k of range(3)) {
      const s0 = (k * Lt) / 3 + (k ? gap : 0.06);
      const s1 = ((k + 1) * Lt) / 3 - (k < 2 ? gap : 0.0);
      for (const x of [-sx, sx]) parts.push(bar('ladder', at(s0, x), at(s1, x), 0.026, 0.07));
      if (k < 2) for (const x of [-sx, sx]) parts.push(bar('metal', at(s1 - 0.04, x + Math.sign(x) * 0.016), at(s1 + 0.04 + 2 * gap, x + Math.sign(x) * 0.016), 0.004, 0.06, o));
    }
    const nt = Math.max(5, Math.round(Lt / 0.27) - 1);
    for (const i of range(nt)) {
      const p = at(((i + 1) * Lt) / (nt + 1), 0);
      parts.push(span('ladder', [-sx + 0.013, sx - 0.013], [p[1] - 0.014, p[1] + 0.014], [p[2] - 0.045, p[2] + 0.045], o));
    }
    for (const x of [-sx, sx]) parts.push(span('metal', [x - 0.02, x + 0.02], [0, 0.03], [B[2] - 0.05, B[2] + 0.02]));
    for (const x of [-w / 2 + 0.02, w / 2 - 0.02]) parts.push(rod('metal', [x, h - fr - 0.01, -d / 2 + Lh * 0.62], at(Lt - 0.45, x, -0.045), 0.007, o));
    parts.push(rod('metal', at(Lt * 0.62, sx + 0.02, 0.32), at(Lt * 0.9, sx + 0.02, 0.32), 0.013, o));
    for (const s of [Lt * 0.66, Lt * 0.86]) parts.push(rod('metal', at(s, sx + 0.02, 0.035), at(s, sx + 0.02, 0.32), 0.008, o));
    return keep(parts, size);
  },
  planDetail: ({ w, d }) => [rectPoly(-w / 2, -d / 2, w / 2, -d / 2 + Math.min(1.2, d - 0.15)), line([-w / 2, -d / 2], [w / 2, -d / 2 + Math.min(1.2, d - 0.15)])],
});

const shipLadder = defineItem({
  id: 'alternating-tread-stair',
  name: 'Alternating tread stair',
  category: C,
  type: 'structure',
  group: 'Stairs & steps',
  tags: ['alternating tread', 'ship ladder', 'space saver', 'gác lửng', 'mezzanine stairs', 'steep stair'],
  description: 'A steep space-saving stair with paddle treads alternating left and right on a black steel centre stringer, and handrails on both sides: for mezzanines and lofts.',
  defaultSize: { w: 0.62, d: 1.5, h: 2.7 },
  minSize: { w: 0.5, d: 1.0, h: 2.0 },
  maxSize: { w: 0.8, d: 2.2, h: 3.6 },
  slots: [matSlot('steel', 'Steel', 'metal-black-matte'), matSlot('tread', 'Treads', 'wood-oak-natural')],
  variants: [
    { id: 'white', name: 'White steel', materials: { steel: 'metal-white-powder' } },
    { id: 'walnut', name: 'Walnut', materials: { tread: 'wood-walnut' } },
  ],
  build: (size) => {
    const { w, d, h } = size;
    const zB = d / 2 - 0.06;
    const zT = -d / 2 + 0.06;
    const k = h / (zB - zT);
    const n = Math.max(6, Math.round(h / 0.2));
    const rise = h / n;
    const band = 0.18;
    const stringer = (x0: number, t: number) => panelZY('steel', [[zB, 0], [zB, band], [zT + band / k, h], [zT, h]], x0, t, true);
    const parts: Part[] = [stringer(-0.012, 0.024), stringer(-w / 2, 0.012), stringer(w / 2 - 0.012, 0.012)];
    for (const i of range(n - 1)) {
      const y = (i + 1) * rise;
      const z = zB - (y - band * 0.7) / k;
      const left = i % 2 === 0;
      parts.push(span('tread', left ? [-w / 2 + 0.012, 0.03] : [-0.03, w / 2 - 0.012], [y - 0.035, y], [Math.max(-d / 2, z - 0.13), Math.min(d / 2, z + 0.11)], { bevel: 0.004 }));
    }
    for (const x of [-w / 2 + 0.018, w / 2 - 0.018]) {
      parts.push(rod('steel', [x, 0.9 + band, zB], [x, h - 0.03, zB - (h - 0.93 - band) / k], 0.016, { plan: false }));
      for (const t of [0.15, 0.5, 0.85]) {
        const z = zB - t * (zB - zT);
        const yl = (zB - z) * k + band;
        if (yl + 0.88 < h - 0.03) parts.push(vcyl('steel', x, z, yl, yl + 0.9, 0.01, o));
      }
    }
    return keep(parts, size);
  },
  planDetail: ({ d }) => stairArrow([[0, d / 2 - 0.1], [0, -d / 2 + 0.15]]),
});

const splitSteps = defineItem({
  id: 'split-level-steps-led',
  name: 'Split-level steps with LED nosings',
  category: C,
  type: 'structure',
  group: 'Stairs & steps',
  tags: ['steps', 'split level', 'sunken lounge', 'bậc tam cấp', 'platform steps', 'LED'],
  description: 'Full-width steps between two floor levels, with oak tread caps over white risers and a warm LED strip tucked under every nosing.',
  defaultSize: { w: 2.4, d: 0.9, h: 0.51 },
  minSize: { w: 0.8, d: 0.3, h: 0.15 },
  maxSize: { w: 6.0, d: 1.8, h: 1.0 },
  slots: [matSlot('tread', 'Treads', 'wood-oak-natural'), matSlot('riser', 'Risers', 'paint-satin-white'), matSlot('glow', 'LED strips', 'light-warm')],
  variants: [
    { id: 'concrete', name: 'Microcement', materials: { tread: 'microcement', riser: 'microcement' } },
    { id: 'terrazzo', name: 'Terrazzo', materials: { tread: 'tile-terrazzo', riser: 'tile-terrazzo' } },
    { id: 'walnut', name: 'Walnut', materials: { tread: 'wood-walnut', riser: 'paint-charcoal' } },
  ],
  build: ({ w, d, h }) => {
    const n = clamp(Math.round(h / 0.17), 1, 6);
    const rise = h / n;
    const going = d / n;
    const cap = Math.min(0.03, rise * 0.3);
    const parts: Part[] = [];
    for (const i of range(n)) {
      const zf = d / 2 - i * going;
      const zb = i === n - 1 ? -d / 2 : zf - going;
      const top = (i + 1) * rise;
      parts.push(
        span('riser', [-w / 2, w / 2], [0, top - cap], [zb, zf - 0.02]),
        span('tread', [-w / 2, w / 2], [top - cap, top], [zb, zf], { bevel: 0.003 }),
        span('glow', [-w / 2 + 0.02, w / 2 - 0.02], [top - cap - 0.012, top - cap], [zf - 0.032, zf - 0.02], o),
      );
    }
    return parts;
  },
  planDetail: ({ w, d, h }) => {
    const n = clamp(Math.round(h / 0.17), 1, 6);
    return range(n).map((i) => line([-w / 2, d / 2 - i * (d / n)], [w / 2, d / 2 - i * (d / n)]));
  },
});

const bullnoseSteps = defineItem({
  id: 'curved-bullnose-steps',
  name: 'Curved bullnose entry steps',
  category: C,
  type: 'structure',
  group: 'Stairs & steps',
  tags: ['bullnose step', 'curved steps', 'entry steps', 'bậc cong', 'marble steps', 'stadium'],
  description: 'Two rounded marble steps with half-round ends, the lower one wider, on plastered risers with raised brass anti-slip strips along the nosings.',
  defaultSize: { w: 1.6, d: 0.65, h: 0.34 },
  minSize: { w: 0.9, d: 0.4, h: 0.15 },
  maxSize: { w: 3.0, d: 1.2, h: 0.6 },
  slots: [matSlot('tread', 'Treads', 'stone-marble-carrara'), matSlot('riser', 'Risers', 'plaster-white'), matSlot('strip', 'Nosing strips', 'metal-brass')],
  variants: [
    { id: 'travertine', name: 'Travertine', materials: { tread: 'stone-travertine', riser: 'stone-travertine' } },
    { id: 'granite', name: 'Granite', materials: { tread: 'stone-granite', strip: 'metal-black-matte' } },
    { id: 'oak', name: 'Oak', materials: { tread: 'wood-oak-natural', riser: 'paint-satin-white' } },
  ],
  build: ({ w, d, h }) => {
    const n = h > 0.26 ? 2 : 1;
    const rise = h / n;
    const cap = Math.min(0.03, rise * 0.3);
    const parts: Part[] = [];
    for (const i of range(n)) {
      const sw = i === 0 ? w : Math.max(w * 0.6, w - 0.5);
      const sd = i === 0 ? d : d * 0.55;
      const cz = -d / 2 + sd / 2;
      const top = (i + 1) * rise;
      parts.push(prism('riser', roundRectPoints(0, cz - 0.01, sw - 0.03, sd - 0.02, (sd - 0.02) / 2, 8), 0, top - cap));
      parts.push(prism('tread', roundRectPoints(0, cz, sw, sd, sd / 2, 8), top - cap, cap - 0.002));
      const zf = cz + sd / 2;
      parts.push(span('strip', [-(sw / 2 - sd / 2), sw / 2 - sd / 2], [top - 0.004, top], [zf - 0.05, zf - 0.035], o));
      parts.push(span('strip', [-(sw / 2 - sd / 2), sw / 2 - sd / 2], [top - 0.004, top], [zf - 0.075, zf - 0.06], o));
    }
    return parts;
  },
});

const glassBalustrade = defineItem({
  id: 'glass-balustrade-oak-rail',
  name: 'Glass balustrade with oak handrail',
  category: C,
  type: 'structure',
  group: 'Stairs & steps',
  tags: ['balustrade', 'glass railing', 'lan can kính', 'guard rail', 'mezzanine', 'landing'],
  description: 'A frameless toughened-glass guard in a brushed steel base shoe, capped with a rounded oak handrail: for landings, mezzanines and level changes.',
  defaultSize: { w: 2.0, d: 0.1, h: 1.05 },
  minSize: { w: 0.5, d: 0.06, h: 0.85 },
  maxSize: { w: 5.0, d: 0.15, h: 1.2 },
  slots: [matSlot('glass', 'Glass', 'glass-clear'), matSlot('shoe', 'Base shoe', 'metal-brushed-steel'), matSlot('rail', 'Handrail', 'wood-oak-natural')],
  variants: [
    { id: 'steel-cap', name: 'Steel cap rail', materials: { rail: 'metal-brushed-steel' } },
    { id: 'black', name: 'Black & walnut', materials: { shoe: 'metal-black-matte', rail: 'wood-walnut' } },
    { id: 'frosted', name: 'Frosted glass', materials: { glass: 'glass-frosted' } },
  ],
  build: ({ w, d, h }) => {
    const parts: Part[] = [
      span('shoe', [-w / 2, w / 2], [0, 0.11], [-d * 0.4, d * 0.4]),
      span('rail', [-w / 2, w / 2], [h - 0.05, h], [-d / 2, d / 2], { bevel: Math.min(0.02, d * 0.2) }),
    ];
    for (const [x0, x1] of cellSpans(Math.max(1, Math.ceil(w / 1.2)), -w / 2, w / 2)) parts.push(span('glass', [x0 + 0.004, x1 - 0.004], [0.06, h - 0.04], [-0.006, 0.006], o));
    return parts;
  },
});

const spindleBalustrade = defineItem({
  id: 'spindle-balustrade-newels',
  name: 'Turned spindle balustrade with newels',
  category: C,
  type: 'structure',
  group: 'Stairs & steps',
  tags: ['balustrade', 'banister', 'spindles', 'lan can gỗ', 'newel post', 'landing'],
  description: 'A traditional landing balustrade: turned white spindles between an oak base rail and a moulded oak handrail, ending in square newel posts with ball finials.',
  defaultSize: { w: 2.0, d: 0.12, h: 1.0 },
  minSize: { w: 0.6, d: 0.09, h: 0.85 },
  maxSize: { w: 5.0, d: 0.2, h: 1.2 },
  slots: [matSlot('rail', 'Newels & rails', 'wood-oak-natural'), matSlot('spindle', 'Spindles', 'paint-satin-white')],
  variants: [
    { id: 'all-oak', name: 'All oak', materials: { spindle: 'wood-oak-natural' } },
    { id: 'walnut', name: 'Walnut & black', materials: { rail: 'wood-walnut', spindle: 'paint-soft-black' } },
  ],
  build: ({ w, d, h }) => {
    const nw = Math.min(0.09, d);
    const parts: Part[] = [
      span('rail', [-w / 2 + nw, w / 2 - nw], [0, 0.06], [-0.035, 0.035]),
      span('rail', [-w / 2 + nw, w / 2 - nw], [h - 0.17, h - 0.12], [-0.04, 0.04], { bevel: 0.012, plan: false }),
      span('rail', [-w / 2 + nw, w / 2 - nw], [h - 0.19, h - 0.17], [-0.03, 0.03], o),
    ];
    for (const x of [-w / 2 + nw / 2, w / 2 - nw / 2]) {
      parts.push(
        span('rail', [x - nw / 2, x + nw / 2], [0, h - 0.1], [-nw / 2, nw / 2]),
        span('rail', [x - nw / 2, x + nw / 2], [h - 0.1, h - 0.075], [-d / 2, d / 2], o),
        lathe('rail', [x, h - 0.075, 0], [[0, 0], [0.018, 0], [0.012, 0.012], [0.03, 0.04], [0.02, 0.068], [0, 0.075]], { segments: 20, plan: false }),
      );
    }
    for (const x of cells(clamp(Math.round((w - 2 * nw) / 0.11), 2, 45), -w / 2 + nw, w / 2 - nw)) parts.push(turnedLeg('spindle', x, 0, 0.06, h - 0.19, 0.022, { style: 'spindle' }));
    return parts;
  },
});

export default definePack({
  name: 'Structures',
  version: '1.0.0',
  author: 'Neest team',
  description:
    'Fifty-four pieces of the building itself: classical, clad, steel and mushroom columns, pilasters, beams and joists, coffered and tray ceilings, soffits and boxed-in risers, window seats and wall-to-wall joinery, chimney breasts, stoves and radiators, half walls, archways and partitions (glass, breeze block, cane, barn doors), and staircases from straight and spiral to a folding loft ladder, plus steps, platforms and balustrades.',
  license: 'CC0 (made for Neest)',
  materials: [{ id: 'fire-glow', name: 'Fire glow', category: 'solid', color: '#ff8a2a', roughness: 0.6, emissive: '#ff5208', emissiveIntensity: 1.3 }],
  items: [
    reededColumn,
    tuscanColumn,
    pilaster,
    slatColumn,
    steelColumn,
    mushroomColumn,
    marbleColumn,
    mirrorColumn,
    timberPortal,
    downstandBeam,
    ceilingJoists,
    steelBeam,
    cofferedCeiling,
    trayCeiling,
    kitchenSoffit,
    pipeRiser,
    cornerChase,
    windowSeatBookcases,
    storageWindowSeat,
    banquette,
    mediaWall,
    alcoveCupboard,
    deskNook,
    raisedPlatform,
    entryBench,
    chimneyBreast,
    electricFire,
    castIronRadiator,
    panelRadiator,
    radiatorCover,
    woodStove,
    ponyWall,
    halfWallColumns,
    halfWallSpindles,
    archway,
    reededArchPartition,
    barnDoors,
    breezeBlocks,
    curvedGlassBlock,
    serpentineSlats,
    canePartition,
    straightStair,
    floatingStair,
    spineStair,
    lStair,
    uStair,
    spiralStair,
    atticLadder,
    shipLadder,
    splitSteps,
    bullnoseSteps,
    glassBalustrade,
    spindleBalustrade,
  ],
});

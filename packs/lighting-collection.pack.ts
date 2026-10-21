/**
 * Lighting collection — ceiling, wall, floor, table, kitchen and outdoor fixtures whose light
 * sources sit exactly where their glowing parts are: recessed downlights, spot heads and task
 * lamps shine as cones, bare bulbs, globes and lanterns glow all round, the torchiere points up
 * and the up/down sconce washes both ways. Sized for modern apartments with a 2.7 m ceiling.
 */
import {
  circle,
  clamp,
  cyl,
  defineItem,
  definePack,
  ellipsePoints,
  lathe,
  lerp,
  line,
  matSlot,
  poly,
  prism,
  range,
  rectPoly,
  rng,
  ring,
  rod,
  rodPath,
  rodX,
  rodZ,
  span,
  sphere,
  torus,
  vcyl,
  type LatheOpts,
  type Part,
  type Size3,
  type V2,
  type V3,
} from '@/packs/kit';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Ceiling height the ceiling fittings are dimensioned for. */
const CEILING = 2.7;
/** Base elevation that puts a ceiling fitting of height `h` just under the ceiling. */
const ceilingElevation = (h: number): number => CEILING - h - 0.01;
const WARM = '#ffd9a8';
const COOL = '#f2f4ff';
const NP = { plan: false } as const;

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const unit = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** Euler XYZ rotation that turns local +y onto the direction `u` (same maths as `rod`). */
function rotAlong(u: V3): V3 {
  const [x, y, z] = unit(u);
  return [Math.atan2(z, y), 0, Math.atan2(-x, Math.hypot(y, z))];
}

/** A lathe whose axis runs along `u`, with profile y = 0 at point `P`. */
function latheAlong(slot: string, P: V3, u: V3, profile: V2[], opts?: LatheOpts): Part {
  const n = unit(u);
  const p = lathe(slot, [0, 0, 0], profile, { ...opts, rotation: rotAlong(n) });
  const mid = p.position[1];
  p.position = [P[0] + n[0] * mid, P[1] + n[1] * mid, P[2] + n[2] * mid];
  return p;
}

/** Cylinder of radius r along `u`, from a + u·t0 to a + u·t1. */
const cylAlong = (slot: string, a: V3, u: V3, t0: number, t1: number, r: number, segments = 20): Part =>
  rod(slot, add(a, mul(u, t0)), add(a, mul(u, t1)), r, { segments, plan: false });

/**
 * Closed thin-walled lathe profile: the outer surface (bottom → top) followed by the inner one
 * (top → bottom), offset by `t` inwards and `dy` vertically, so the inside renders too.
 */
function shell(outer: V2[], t: number, dy: number): V2[] {
  const ys = outer.map((p) => p[1]);
  const lo = Math.min(...ys);
  const hi = Math.max(...ys);
  const inner = outer
    .slice()
    .reverse()
    .map(([r, y]) => [Math.max(0, r - t), clamp(y + dy, lo, hi)] as V2);
  return [...outer, ...inner, outer[0]];
}

/** Prism extruded along X (length L, centred on c[0]); outline is [y, z] relative to (c[1], c[2]). */
function xPrism(slot: string, outline: V2[], c: V3, L: number, opts?: { plan?: boolean }): Part {
  const p = prism(slot, outline, 0, L, { ...opts, rotation: [0, 0, Math.PI / 2] });
  // Rz(90°) maps the outline's x onto y and the extrusion (local +y) onto −x.
  p.position = [c[0] + L / 2, c[1] + p.position[0], c[2] + p.position[2]];
  return p;
}

/** Ceiling canopy (shallow dome + cord collar) whose top sits at y = `top`. */
function canopy(slot: string, top: number, r: number): Part[] {
  return [
    lathe(
      slot,
      [0, top - 0.03, 0],
      [
        [0, 0],
        [r * 0.35, 0],
        [r * 0.8, 0.012],
        [r, 0.026],
        [r, 0.03],
        [0, 0.03],
      ],
      { segments: 28, plan: false },
    ),
    vcyl(slot, 0, 0, top - 0.045, top - 0.03, Math.max(0.006, r * 0.18), NP),
  ];
}

/** Candle-flame / bulb teardrop of radius `r` and height `fh` standing at `base`. */
function flame(slot: string, base: V3, r: number, fh: number): Part {
  return lathe(
    slot,
    base,
    [
      [0, 0],
      [r * 0.8, fh * 0.12],
      [r, fh * 0.35],
      [r * 0.6, fh * 0.7],
      [0, fh],
    ],
    { segments: 16, plan: false },
  );
}

// ---------------------------------------------------------------------------
// Ceiling: recessed downlights, LED panel, flush drum
// ---------------------------------------------------------------------------

/** One recessed downlight trim of outer radius R: flange, skirt, reflector cone and lens (lens at 0.75·h). */
function downlightUnit(cx: number, cz: number, R: number, h: number, zs = 1): Part[] {
  const sc: V3 = [1, 1, zs];
  const lensY = h * 0.75;
  return [
    cyl('trim', [cx, h - 0.003, cz], R, 0.006, { scale: sc, segments: 40 }),
    lathe(
      'trim',
      [cx, 0, cz],
      [
        [R * 0.74, 0],
        [R * 0.8, h - 0.006],
        [R * 0.68, h - 0.006],
        [R * 0.68, 0],
        [R * 0.74, 0],
      ],
      { scale: sc, segments: 40, plan: false },
    ),
    lathe(
      'reflector',
      [cx, 0, cz],
      [
        [R * 0.68, 0],
        [R * 0.68, lensY],
        [R * 0.42, lensY],
        [R * 0.66, 0.001],
        [R * 0.68, 0],
      ],
      { scale: sc, segments: 40, plan: false },
    ),
    cyl('light', [cx, lensY - 0.002, cz], R * 0.43, 0.004, { scale: sc, segments: 32, plan: false }),
    ring('trim', [cx, 0.0025, cz], R * 0.71, 0.0025, { zScale: zs, plan: false }),
  ];
}

const DOWNLIGHT_SLOTS = [
  matSlot('trim', 'Trim', 'metal-white-powder'),
  matSlot('reflector', 'Reflector', 'aluminium'),
  matSlot('light', 'Lens', 'light-warm'),
];

const recessedDownlight = defineItem({
  id: 'recessed-downlight',
  name: 'Recessed downlight',
  category: 'lighting',
  type: 'lighting',
  group: 'Ceiling lights',
  tags: ['downlight', 'recessed', 'spot', 'can light', 'pot light', 'ceiling', 'đèn âm trần', 'den am tran'],
  defaultSize: { w: 0.12, d: 0.12, h: 0.04 },
  minSize: { w: 0.07, d: 0.07, h: 0.025 },
  maxSize: { w: 0.25, d: 0.25, h: 0.08 },
  mount: 'ceiling',
  defaultElevation: ceilingElevation(0.04),
  slots: DOWNLIGHT_SLOTS,
  // The spot starts at the lens, deep in the reflector, and lights the floor below.
  light: { color: WARM, intensity: 1.3, distance: 4.5, y: 0.026, kind: 'spot', angle: 0.5, penumbra: 0.5 },
  build: ({ w, d, h }) => downlightUnit(0, 0, w / 2, h, d / w),
  planDetail: ({ w, d }) => [
    poly(ellipsePoints(0, 0, (w / 2) * 0.68, (d / 2) * 0.68)),
    line([-w * 0.15, 0], [w * 0.15, 0]),
    line([0, -d * 0.15], [0, d * 0.15]),
  ],
});

const DL_SET_R = 0.045;

const downlightSet = defineItem({
  id: 'downlight-set-4',
  name: 'Recessed downlights (set of 4)',
  category: 'lighting',
  type: 'lighting',
  group: 'Ceiling lights',
  tags: ['downlights', 'recessed', 'grid', 'spots', 'set of four', 'ceiling', 'đèn âm trần', 'den am tran'],
  defaultSize: { w: 2.4, d: 2.4, h: 0.04 },
  minSize: { w: 0.8, d: 0.8, h: 0.025 },
  maxSize: { w: 5, d: 5, h: 0.08 },
  mount: 'ceiling',
  defaultElevation: ceilingElevation(0.04),
  slots: DOWNLIGHT_SLOTS,
  // Four lenses at the quarter points; resizing the item spaces them out.
  light: {
    color: WARM,
    intensity: 1.1,
    distance: 4.5,
    y: 0.026,
    kind: 'spot',
    angle: 0.55,
    penumbra: 0.5,
    heads: [
      { x: -0.6, y: 0.026, z: -0.6 },
      { x: 0.6, y: 0.026, z: -0.6 },
      { x: -0.6, y: 0.026, z: 0.6 },
      { x: 0.6, y: 0.026, z: 0.6 },
    ],
  },
  build: ({ w, d, h }) => {
    const parts: Part[] = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(...downlightUnit((sx * w) / 4, (sz * d) / 4, DL_SET_R, h));
    return parts;
  },
  planDetail: ({ w, d }) => {
    const out = [rectPoly(-w / 4, -d / 4, w / 4, d / 4)];
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const x = (sx * w) / 4;
        const z = (sz * d) / 4;
        out.push(line([x - 0.07, z], [x + 0.07, z]), line([x, z - 0.07], [x, z + 0.07]));
      }
    }
    return out;
  },
});

const drumFlush = defineItem({
  id: 'fabric-drum-flush',
  name: 'Fabric drum flush light',
  category: 'lighting',
  type: 'lighting',
  group: 'Ceiling lights',
  tags: ['drum', 'flush mount', 'fabric shade', 'linen', 'ceiling light', 'bedroom', 'đèn ốp trần', 'den op tran'],
  defaultSize: { w: 0.5, d: 0.5, h: 0.2 },
  minSize: { w: 0.3, d: 0.3, h: 0.12 },
  maxSize: { w: 0.9, d: 0.9, h: 0.35 },
  mount: 'ceiling',
  defaultElevation: ceilingElevation(0.2),
  slots: [
    matSlot('light', 'Glowing shade', 'linen-glow'),
    matSlot('diffuser', 'Bottom diffuser', 'opal-warm'),
    matSlot('metal', 'Plate & rims', 'brass-aged'),
  ],
  // Bulbs inside the drum: a soft all-round glow through the fabric.
  light: { color: WARM, intensity: 1.3, distance: 5.5, y: 0.09 },
  build: ({ w, d, h }) => {
    const R = w / 2 - 0.004;
    const zs = d / w;
    const sc: V3 = [1, 1, zs];
    const sh = h - 0.03;
    const pr = Math.min(R * 0.45, 0.09);
    const parts: Part[] = [
      cyl('metal', [0, h - 0.01, 0], pr, 0.02, { scale: sc, segments: 32, plan: false }),
      lathe(
        'light',
        [0, 0, 0],
        [
          [R - 0.003, 0],
          [R, 0],
          [R, sh],
          [R - 0.003, sh],
          [R - 0.003, 0],
        ],
        { scale: sc, segments: 48 },
      ),
      ring('metal', [0, 0.004, 0], R - 0.0015, 0.004, { zScale: zs, plan: false }),
      ring('metal', [0, sh - 0.004, 0], R - 0.0015, 0.004, { zScale: zs, plan: false }),
      cyl('diffuser', [0, 0.012, 0], R - 0.004, 0.004, { scale: sc, segments: 48, plan: false }),
      cyl('metal', [0, 0.008, 0], 0.018, 0.008, { segments: 20, plan: false }),
      sphere('metal', [0, 0.005, 0], 0.008, NP),
    ];
    for (const i of range(3)) {
      const a = (2 * Math.PI * i) / 3 + Math.PI / 6;
      const c = Math.cos(a);
      const s = Math.sin(a) * zs;
      parts.push(rod('metal', [c * pr * 0.9, h - 0.02, s * pr * 0.9], [c * (R - 0.006), sh - 0.004, s * (R - 0.006)], 0.0025, NP));
    }
    return parts;
  },
  planDetail: ({ w, d }) => [poly(ellipsePoints(0, 0, w / 2 - 0.02, d / 2 - 0.02)), circle([0, 0], 0.018)],
});

// ---------------------------------------------------------------------------
// Ceiling: chandeliers
// ---------------------------------------------------------------------------

const SPUTNIK_BANDS = [
  { el: -1.0, n: 5, off: 0.3 },
  { el: -0.4, n: 9, off: 0 },
  { el: 0.2, n: 8, off: 0.2 },
  { el: 0.65, n: 5, off: 0.9 },
];

function sputnikGeom({ w, d, h }: Size3) {
  const m = Math.min(w, d) / 2;
  const br = 0.022;
  const L = Math.min(m - br - 0.012, (h - 0.12 - 2 * br) / (Math.sin(1.0) + Math.sin(0.65)));
  const hub: V3 = [0, L * Math.sin(1.0) + br + 0.01, 0];
  const hubR = clamp(L * 0.12, 0.035, 0.06);
  const arms: V3[] = SPUTNIK_BANDS.flatMap((b) =>
    range(b.n).map((i) => {
      const az = b.off + (2 * Math.PI * i) / b.n;
      return unit([Math.cos(b.el) * Math.cos(az), Math.sin(b.el), Math.cos(b.el) * Math.sin(az)]);
    }),
  );
  return { L, hub, hubR, br, arms };
}

const SPUTNIK_DEFAULT: Size3 = { w: 0.9, d: 0.9, h: 0.9 };

const sputnik = defineItem({
  id: 'sputnik-chandelier',
  name: 'Sputnik chandelier',
  category: 'lighting',
  type: 'lighting',
  group: 'Ceiling lights',
  tags: ['sputnik', 'starburst', 'chandelier', 'mid-century', 'brass', 'globe bulbs', 'đèn chùm', 'den chum'],
  defaultSize: SPUTNIK_DEFAULT,
  minSize: { w: 0.6, d: 0.6, h: 0.6 },
  maxSize: { w: 1.4, d: 1.4, h: 1.6 },
  mount: 'ceiling',
  defaultElevation: ceilingElevation(0.9),
  slots: [matSlot('metal', 'Hub & arms', 'brass-aged'), matSlot('light', 'Globe bulbs', 'opal-warm')],
  // Three of the bare globes (120° apart on the lower ring) stand in for all 27.
  light: (() => {
    const g = sputnikGeom(SPUTNIK_DEFAULT);
    const heads = [5, 8, 11].map((i) => {
      const p = add(g.hub, mul(g.arms[i], g.L));
      return { x: p[0], y: p[1], z: p[2] };
    });
    return { color: WARM, intensity: 0.8, distance: 6, y: heads[0].y, heads };
  })(),
  build: (size) => {
    const { h } = size;
    const g = sputnikGeom(size);
    const parts: Part[] = [
      ...canopy('metal', h, 0.06),
      vcyl('metal', 0, 0, g.hub[1] + g.hubR * 0.8, h - 0.045, 0.009, NP),
      sphere('metal', g.hub, g.hubR),
      ring('metal', g.hub, g.hubR, 0.004, NP),
    ];
    for (const u of g.arms) {
      const sock = g.L - g.br - 0.022;
      parts.push(
        cylAlong('metal', g.hub, u, g.hubR * 0.85, sock, 0.0045, 8),
        cylAlong('metal', g.hub, u, sock, g.L - g.br + 0.004, 0.009, 14),
        sphere('light', add(g.hub, mul(u, g.L)), g.br, NP),
      );
    }
    return parts;
  },
  planDetail: (size) => {
    const g = sputnikGeom(size);
    return [circle([0, 0], g.L * Math.cos(0.2)), circle([0, 0], g.hubR)];
  },
});

function bubbleGeom({ w, d, h }: Size3) {
  const n = clamp(Math.round(w / 0.2), 3, 9);
  const gr = Math.min(d / 2 - 0.005, 0.1, (w / n) * 0.5 - 0.005);
  const zo = Math.max(0, d / 2 - gr - 0.005) * 0.8;
  const rand = rng(11);
  const lo = gr + 0.01;
  const hi = Math.max(lo, Math.min(h * 0.5, h - 0.08 - gr));
  const globes: V3[] = range(n).map((i) => [-w / 2 + ((i + 0.5) * w) / n, lerp(lo, hi, rand()), (i % 2 ? 1 : -1) * zo]);
  return { n, gr, zo, globes, br: gr * 0.32, lit: Array.from(new Set([1, Math.floor(n / 2), n - 2])) };
}

const BUBBLE_DEFAULT: Size3 = { w: 1.2, d: 0.35, h: 0.9 };

const bubbleCluster = defineItem({
  id: 'bubble-cluster-pendant',
  name: 'Bubble glass cluster pendant',
  category: 'lighting',
  type: 'lighting',
  group: 'Ceiling lights',
  tags: ['bubble', 'glass globes', 'cluster', 'linear', 'dining', 'modern', 'smoked glass', 'đèn thả bóng thủy tinh', 'den tha'],
  defaultSize: BUBBLE_DEFAULT,
  minSize: { w: 0.6, d: 0.2, h: 0.5 },
  maxSize: { w: 2.4, d: 0.6, h: 1.8 },
  mount: 'ceiling',
  defaultElevation: ceilingElevation(0.9),
  slots: [
    matSlot('metal', 'Canopy & cords', 'brass-aged'),
    matSlot('glass', 'Bubble glass', 'bubble-glass'),
    matSlot('light', 'Bulbs', 'opal-warm'),
  ],
  // Small globe bulbs at the centre of the clear bubbles; three of them carry the light.
  light: (() => {
    const g = bubbleGeom(BUBBLE_DEFAULT);
    const heads = g.lit.map((i) => ({ x: g.globes[i][0], y: g.globes[i][1], z: g.globes[i][2] }));
    return { color: WARM, intensity: 0.6, distance: 4.5, y: heads[0].y, heads };
  })(),
  build: (size) => {
    const { w, d, h } = size;
    const g = bubbleGeom(size);
    const bz = Math.min(d / 2 - 0.005, g.zo + 0.025);
    const parts: Part[] = [
      span('metal', [-w / 2 + 0.02, w / 2 - 0.02], [h - 0.025, h], [-bz, bz], { bevel: 0.006, plan: false }),
    ];
    for (const [x, y, z] of g.globes) {
      parts.push(
        vcyl('metal', x, z, y + g.gr + 0.02, h - 0.025, 0.002, NP),
        vcyl('metal', x, z, y + g.gr * 0.9, y + g.gr + 0.025, 0.016, { rTop: 0.011, segments: 16, plan: false }),
        sphere('glass', [x, y, z], g.gr),
        vcyl('metal', x, z, y + g.br * 0.6, y + g.gr * 0.92, 0.006, NP),
        sphere('light', [x, y, z], g.br, NP),
      );
    }
    return parts;
  },
  planDetail: (size) => {
    const g = bubbleGeom(size);
    return g.globes.map(([x, , z]) => circle([x, z], g.gr));
  },
});

// ---------------------------------------------------------------------------
// Ceiling: pendants
// ---------------------------------------------------------------------------

const CAGE_PROF: V2[] = [
  [0.4, 0],
  [0.82, 0.1],
  [1, 0.3],
  [1, 0.64],
  [0.8, 0.86],
  [0.42, 1],
];

function cageGeom({ w, d, h }: Size3) {
  const R = Math.min(w, d) / 2 - 0.004;
  const ch = Math.min(clamp(R * 2.6, 0.14, 0.42), h * 0.55);
  const br = Math.min(R * 0.62, 0.034);
  const b0 = Math.max(0.01, ch - 0.05 - 2.5 * br);
  return { R, ch, br, b0, bulbC: b0 + br * 1.1 };
}

const CAGE_DEFAULT: Size3 = { w: 0.2, d: 0.2, h: 0.9 };

const cagePendant = defineItem({
  id: 'cage-pendant',
  name: 'Industrial cage pendant',
  category: 'lighting',
  type: 'lighting',
  group: 'Ceiling lights',
  tags: ['cage', 'industrial', 'edison bulb', 'filament', 'pendant', 'loft', 'đèn thả', 'den tha'],
  defaultSize: CAGE_DEFAULT,
  minSize: { w: 0.14, d: 0.14, h: 0.4 },
  maxSize: { w: 0.35, d: 0.35, h: 1.8 },
  mount: 'ceiling',
  defaultElevation: ceilingElevation(0.9),
  slots: [
    matSlot('metal', 'Cage & cord', 'iron-black'),
    matSlot('brass', 'Socket & canopy', 'brass-aged'),
    matSlot('light', 'Edison bulb', 'edison-glow'),
  ],
  // A bare amber filament bulb: all-round light from the bulb's centre.
  light: { color: '#ffc27a', intensity: 0.9, distance: 4, y: cageGeom(CAGE_DEFAULT).bulbC },
  build: (size) => {
    const { w, d, h } = size;
    const g = cageGeom(size);
    const br = g.br;
    const parts: Part[] = [
      ...canopy('brass', h, Math.min(0.055, Math.min(w, d) / 2 - 0.003)),
      vcyl('metal', 0, 0, g.ch + 0.024, h - 0.045, 0.0035, NP),
      vcyl('brass', 0, 0, g.b0 + 2.5 * br - 0.004, g.ch + 0.026, 0.017, { segments: 20, plan: false }),
      ring('brass', [0, g.ch - 0.008, 0], 0.017, 0.002, NP),
      ring('brass', [0, g.ch + 0.012, 0], 0.017, 0.002, NP),
      lathe(
        'metal',
        [0, g.ch - 0.004, 0],
        [
          [0, 0],
          [g.R * 0.42 + 0.004, 0],
          [g.R * 0.42 + 0.004, 0.01],
          [0.02, 0.026],
          [0, 0.026],
        ],
        { segments: 28, plan: false },
      ),
      lathe(
        'light',
        [0, g.b0, 0],
        [
          [0, 0],
          [br * 0.45, br * 0.12],
          [br * 0.9, br * 0.55],
          [br, br * 1.1],
          [br * 0.8, br * 1.7],
          [br * 0.45, br * 2.15],
          [br * 0.4, br * 2.5],
          [0, br * 2.5],
        ],
        { segments: 24, plan: false },
      ),
      ring('metal', [0, 0.003, 0], g.R * 0.4, 0.003, NP),
      ring('metal', [0, g.ch * 0.3, 0], g.R - 0.001, 0.0025),
      ring('metal', [0, g.ch * 0.64, 0], g.R - 0.001, 0.0025, NP),
    ];
    for (const i of range(8)) {
      const a = (2 * Math.PI * i) / 8;
      const pts = CAGE_PROF.map(([r, y]) => [Math.cos(a) * r * g.R, Math.max(0.003, y * g.ch), Math.sin(a) * r * g.R] as V3);
      parts.push(...rodPath('metal', pts, 0.0022, { segments: 6 }));
    }
    return parts;
  },
  planDetail: (size) => {
    const g = cageGeom(size);
    return [circle([0, 0], g.R), circle([0, 0], g.br)];
  },
});

function haloGeom({ w, d }: Size3) {
  const R = Math.min(w, d) / 2 - 0.005;
  const rw = clamp(R * 0.08, 0.018, 0.045);
  const rc = R - rw / 2;
  const anchors = range(3).map((i) => {
    const a = Math.PI / 2 + (2 * Math.PI * i) / 3;
    return [Math.cos(a) * rc, Math.sin(a) * rc] as V2;
  });
  return { R, rw, rh: 0.03, rc, anchors };
}

const HALO_DEFAULT: Size3 = { w: 0.6, d: 0.6, h: 0.9 };

const haloPendant = defineItem({
  id: 'halo-ring-pendant',
  name: 'Halo ring LED pendant',
  category: 'lighting',
  type: 'lighting',
  group: 'Ceiling lights',
  tags: ['halo', 'ring', 'circle', 'led pendant', 'modern', 'minimal', 'suspended', 'đèn thả vòng tròn', 'den led tron'],
  defaultSize: HALO_DEFAULT,
  minSize: { w: 0.3, d: 0.3, h: 0.3 },
  maxSize: { w: 1.2, d: 1.2, h: 1.8 },
  mount: 'ceiling',
  defaultElevation: ceilingElevation(0.9),
  slots: [
    matSlot('body', 'Ring', 'iron-black'),
    matSlot('cable', 'Wires & canopy', 'metal-chrome'),
    matSlot('light', 'LED strip', 'led-warm'),
  ],
  // The LED strip runs round the underside of the ring: three wide soft cones spaced along it.
  light: (() => {
    const g = haloGeom(HALO_DEFAULT);
    return {
      color: WARM,
      intensity: 0.6,
      distance: 4.5,
      y: 0.002,
      kind: 'spot' as const,
      angle: 1.15,
      penumbra: 0.85,
      heads: g.anchors.map(([x, z]) => ({ x, y: 0.002, z })),
    };
  })(),
  build: (size) => {
    const { w, d, h } = size;
    const g = haloGeom(size);
    const { R, rw, rh } = g;
    const parts: Part[] = [
      ...canopy('cable', h, Math.min(0.05, Math.min(w, d) / 2 - 0.005)),
      lathe(
        'body',
        [0, 0, 0],
        [
          [R, 0.004],
          [R, rh],
          [R - rw, rh],
          [R - rw, 0.004],
          [R, 0.004],
        ],
        { segments: 64 },
      ),
      lathe(
        'light',
        [0, 0, 0],
        [
          [R - rw + 0.003, 0],
          [R - 0.003, 0],
          [R - 0.003, 0.004],
          [R - rw + 0.003, 0.004],
          [R - rw + 0.003, 0],
        ],
        { segments: 64, plan: false },
      ),
    ];
    for (const [x, z] of g.anchors) {
      parts.push(
        rod('cable', [x, rh, z], [0, h - 0.045, 0], 0.0012, { segments: 6, plan: false }),
        cyl('cable', [x, rh + 0.006, z], 0.004, 0.012, { segments: 10, plan: false }),
      );
    }
    return parts;
  },
  planDetail: (size) => {
    const g = haloGeom(size);
    return [circle([0, 0], g.R), circle([0, 0], g.R - g.rw)];
  },
});

function islandGeom({ w, d }: Size3) {
  const xs = [-w / 3, 0, w / 3];
  const R = Math.min(d / 2 - 0.005, w / 6 - 0.015, 0.22);
  const sh = clamp(R, 0.08, 0.26);
  const bulbR = Math.min(0.035, R * 0.3);
  return { xs, R, sh, bulbR, bulbY: sh * 0.34 };
}

const ISLAND_DEFAULT: Size3 = { w: 1.6, d: 0.3, h: 1.0 };

const islandTrio = defineItem({
  id: 'island-pendant-trio',
  name: 'Kitchen island pendant trio',
  category: 'kitchen',
  type: 'lighting',
  group: 'Ceiling lights',
  tags: ['kitchen island', 'pendants', 'three lights', 'dome', 'bar', 'dining', 'đèn thả bàn đảo', 'den tha bep'],
  defaultSize: ISLAND_DEFAULT,
  minSize: { w: 0.9, d: 0.2, h: 0.4 },
  maxSize: { w: 3.0, d: 0.5, h: 1.8 },
  mount: 'ceiling',
  defaultElevation: ceilingElevation(1.0),
  slots: [
    matSlot('shade', 'Shades', 'iron-black'),
    matSlot('fittings', 'Canopy & cords', 'brass-aged'),
    matSlot('light', 'Bulbs', 'light-warm'),
  ],
  // Each dome throws a cone onto the worktop from its bulb.
  light: (() => {
    const g = islandGeom(ISLAND_DEFAULT);
    return {
      color: WARM,
      intensity: 1.0,
      distance: 4,
      y: g.bulbY,
      kind: 'spot' as const,
      angle: 0.75,
      penumbra: 0.5,
      heads: g.xs.map((x) => ({ x, y: g.bulbY })),
    };
  })(),
  build: (size) => {
    const { h } = size;
    const g = islandGeom(size);
    const parts: Part[] = [
      span('fittings', [g.xs[0] - 0.05, g.xs[2] + 0.05], [h - 0.025, h], [-0.035, 0.035], { bevel: 0.006, plan: false }),
    ];
    const outer: V2[] = [
      [g.R, 0],
      [g.R * 0.97, g.sh * 0.15],
      [g.R * 0.8, g.sh * 0.5],
      [g.R * 0.45, g.sh * 0.85],
      [0.025, g.sh],
      [0, g.sh],
    ];
    for (const x of g.xs) {
      parts.push(
        lathe('shade', [x, 0, 0], shell(outer, 0.003, -0.003), { segments: 40 }),
        ring('shade', [x, 0.003, 0], g.R - 0.003, 0.003, NP),
        vcyl('fittings', x, 0, g.sh - 0.006, g.sh + 0.03, 0.018, NP),
        vcyl('fittings', x, 0, g.bulbY + g.bulbR * 0.6, g.sh, 0.014, NP),
        sphere('light', [x, g.bulbY, 0], g.bulbR, NP),
        vcyl('fittings', x, 0, g.sh + 0.03, h - 0.025, 0.0025, NP),
      );
    }
    return parts;
  },
  planDetail: (size) => {
    const g = islandGeom(size);
    return [...g.xs.map((x) => circle([x, 0], g.R * 0.4)), line([g.xs[0], 0], [g.xs[2], 0])];
  },
});

const MONO_T = [0.1, 0.3, 0.5, 0.7, 0.9];
/** Aim of each head: left, forward, down, back, right. */
const MONO_DIRS: V3[] = [
  [-0.55, -0.8, 0.2],
  [0.2, -0.8, 0.55],
  [0, -1, 0],
  [-0.2, -0.8, -0.55],
  [0.55, -0.8, 0.2],
];
const MONO_L = 0.085;
const MONO_R = 0.026;

function monoGeom({ w, d, h }: Size3) {
  const drop = clamp(h * 0.3, 0.06, 0.2);
  const railY = h - drop;
  const A = clamp(d / 2 - 0.16, 0, 0.35);
  const x0 = -w / 2 + 0.03;
  const x1 = w / 2 - 0.03;
  const at = (t: number): V3 => [lerp(x0, x1, t), railY, A * Math.sin(2 * Math.PI * t)];
  const heads = MONO_T.map((t, i) => {
    const p = at(t);
    const knuckle: V3 = [p[0], railY - 0.045, p[2]];
    const u = unit(MONO_DIRS[i]);
    return { p, knuckle, u, lens: add(knuckle, mul(u, 0.012 + MONO_L)) };
  });
  return { railY, at, heads };
}

const MONO_DEFAULT: Size3 = { w: 2.0, d: 0.8, h: 0.4 };

const monorail = defineItem({
  id: 'monorail-spots',
  name: 'Monorail spotlights',
  category: 'lighting',
  type: 'lighting',
  group: 'Ceiling lights',
  tags: ['monorail', 'track', 'spotlights', 'adjustable', 'gallery', 'curved rail', 'đèn ray', 'đèn rọi', 'den ray'],
  defaultSize: MONO_DEFAULT,
  minSize: { w: 1.2, d: 0.4, h: 0.25 },
  maxSize: { w: 4.0, d: 1.6, h: 0.8 },
  mount: 'ceiling',
  defaultElevation: ceilingElevation(0.4),
  slots: [
    matSlot('metal', 'Rail & stand-offs', 'metal-chrome'),
    matSlot('heads', 'Spot heads', 'metal-white-powder'),
    matSlot('light', 'Lenses', 'light-warm'),
  ],
  // Five heads, each aimed its own way (left, forward, down, back, right).
  light: (() => {
    const g = monoGeom(MONO_DEFAULT);
    return {
      color: WARM,
      intensity: 0.9,
      distance: 4.5,
      y: g.heads[0].lens[1],
      kind: 'spot' as const,
      angle: 0.38,
      penumbra: 0.5,
      heads: g.heads.map((hd) => ({ x: hd.lens[0], y: hd.lens[1], z: hd.lens[2], dir: hd.u })),
    };
  })(),
  build: (size) => {
    const { h } = size;
    const g = monoGeom(size);
    const rail = range(21).map((i) => g.at(i / 20));
    const parts: Part[] = [
      ...rodPath('metal', rail, 0.006, { segments: 12, plan: true }),
      sphere('metal', rail[0], 0.008, NP),
      sphere('metal', rail[20], 0.008, NP),
    ];
    for (const t of [0.02, 0.5, 0.98]) {
      const p = g.at(t);
      parts.push(
        vcyl('metal', p[0], p[2], g.railY, h - 0.012, 0.0035, NP),
        cyl('metal', [p[0], h - 0.006, p[2]], 0.025, 0.012, { segments: 24, plan: false }),
      );
    }
    for (const hd of g.heads) {
      parts.push(
        vcyl('heads', hd.p[0], hd.p[2], hd.knuckle[1], g.railY, 0.005, NP),
        sphere('heads', hd.knuckle, 0.011, NP),
        cylAlong('heads', hd.knuckle, hd.u, 0.012, 0.012 + MONO_L, MONO_R, 24),
        cylAlong('heads', hd.knuckle, hd.u, 0.026, 0.031, MONO_R + 0.004, 24),
        cylAlong('heads', hd.knuckle, hd.u, 0.037, 0.042, MONO_R + 0.004, 24),
        cylAlong('light', hd.knuckle, hd.u, 0.012 + MONO_L - 0.004, 0.012 + MONO_L + 0.001, MONO_R * 0.8, 24),
      );
    }
    return parts;
  },
  planDetail: (size) => {
    const g = monoGeom(size);
    const pts = range(21).map((i) => {
      const p = g.at(i / 20);
      return [p[0], p[2]] as V2;
    });
    return [poly(pts, false), ...g.heads.map((hd) => circle([hd.lens[0], hd.lens[2]], MONO_R))];
  },
});

// ---------------------------------------------------------------------------
// Wall lights
// ---------------------------------------------------------------------------

function udGeom({ w, d }: Size3) {
  const r = Math.min(w / 2 - 0.002, d * 0.32);
  return { r, zc: d / 2 - r - 0.002 };
}

const UD_DEFAULT: Size3 = { w: 0.09, d: 0.15, h: 0.24 };

const upDownSconce = defineItem({
  id: 'up-down-sconce',
  name: 'Up-down cylinder sconce',
  category: 'lighting',
  type: 'lighting',
  group: 'Wall lights',
  tags: ['up down', 'wall washer', 'cylinder', 'sconce', 'modern', 'hallway', 'đèn hắt tường', 'den hat tuong'],
  defaultSize: UD_DEFAULT,
  minSize: { w: 0.06, d: 0.1, h: 0.14 },
  maxSize: { w: 0.16, d: 0.25, h: 0.5 },
  mount: 'wall',
  defaultElevation: 1.6,
  slots: [matSlot('body', 'Body', 'iron-black'), matSlot('light', 'Lenses', 'light-warm')],
  // Two narrow beams from the open ends, one up and one down, grazing the wall.
  light: (() => {
    const g = udGeom(UD_DEFAULT);
    return {
      color: WARM,
      intensity: 0.7,
      distance: 3,
      y: 0.002,
      kind: 'spot' as const,
      angle: 0.3,
      penumbra: 0.6,
      heads: [
        { y: 0.002, z: g.zc, dir: [0, -1, 0] as V3 },
        { y: UD_DEFAULT.h - 0.002, z: g.zc, dir: [0, 1, 0] as V3 },
      ],
    };
  })(),
  build: (size) => {
    const { w, d, h } = size;
    const g = udGeom(size);
    const pw = Math.min(w / 2, 0.03);
    return [
      span('body', [-pw, pw], [h * 0.3, h * 0.7], [-d / 2, -d / 2 + 0.01], { bevel: 0.003 }),
      rodZ('body', 0, h / 2, -d / 2 + 0.01, g.zc - g.r + 0.003, 0.008, NP),
      vcyl('body', 0, g.zc, 0.004, h - 0.004, g.r, { segments: 32 }),
      ring('body', [0, 0.006, g.zc], g.r - 0.0015, 0.0015, NP),
      ring('body', [0, h - 0.006, g.zc], g.r - 0.0015, 0.0015, NP),
      cyl('light', [0, 0.002, g.zc], g.r * 0.8, 0.004, { segments: 32, plan: false }),
      cyl('light', [0, h - 0.002, g.zc], g.r * 0.8, 0.004, { segments: 32, plan: false }),
    ];
  },
  planDetail: (size) => {
    const g = udGeom(size);
    return [circle([0, g.zc], g.r * 0.8)];
  },
});

function vanityGeom({ d, h }: Size3) {
  const tr = Math.min(h * 0.32, d * 0.3, 0.035);
  return { tr, zt: d / 2 - tr - 0.003, yt: h / 2 };
}

const VANITY_DEFAULT: Size3 = { w: 0.8, d: 0.11, h: 0.1 };

const vanityBar = defineItem({
  id: 'vanity-light-bar',
  name: 'Vanity light bar',
  category: 'bathroom',
  type: 'lighting',
  group: 'Wall lights',
  tags: ['vanity', 'bathroom', 'mirror light', 'bar', 'chrome', 'cool white', 'đèn gương', 'den guong', 'đèn soi gương'],
  defaultSize: VANITY_DEFAULT,
  minSize: { w: 0.4, d: 0.08, h: 0.07 },
  maxSize: { w: 1.5, d: 0.16, h: 0.16 },
  mount: 'wall',
  // Above a mirror, top of the bar at ~2 m.
  defaultElevation: 1.9,
  slots: [matSlot('metal', 'Chrome', 'metal-chrome'), matSlot('light', 'Opal tube', 'opal-cool')],
  // Two wide, cool cones angled forward and down onto the face at the basin.
  light: (() => {
    const g = vanityGeom(VANITY_DEFAULT);
    const x = VANITY_DEFAULT.w / 4;
    return {
      color: COOL,
      intensity: 0.75,
      distance: 3.5,
      y: g.yt,
      kind: 'spot' as const,
      dir: [0, -0.45, 1] as V3,
      angle: 1.1,
      penumbra: 0.8,
      heads: [
        { x: -x, y: g.yt, z: g.zt },
        { x, y: g.yt, z: g.zt },
      ],
    };
  })(),
  build: (size) => {
    const { w, d, h } = size;
    const g = vanityGeom(size);
    const z0 = -d / 2;
    const ph = h * 0.35;
    const parts: Part[] = [
      span('metal', [-w / 2 + 0.01, w / 2 - 0.01], [h / 2 - ph, h / 2 + ph], [z0, z0 + 0.012], { bevel: 0.004 }),
      rodX('light', -w / 2 + 0.02, w / 2 - 0.02, g.yt, g.zt, g.tr, { segments: 32 }),
      rodX('metal', -w / 2 + 0.004, -w / 2 + 0.02, g.yt, g.zt, g.tr + 0.002, { segments: 32, plan: false }),
      rodX('metal', w / 2 - 0.02, w / 2 - 0.004, g.yt, g.zt, g.tr + 0.002, { segments: 32, plan: false }),
    ];
    for (const x of [-w / 2 + 0.07, 0, w / 2 - 0.07]) {
      parts.push(
        rodZ('metal', x, g.yt, z0 + 0.012, g.zt, 0.007, NP),
        rodX('metal', x - 0.01, x + 0.01, g.yt, g.zt, g.tr + 0.0025, { segments: 32, plan: false }),
      );
    }
    return parts;
  },
  planDetail: (size) => {
    const g = vanityGeom(size);
    return [line([-size.w / 2 + 0.02, g.zt], [size.w / 2 - 0.02, g.zt])];
  },
});

const WASH_DIR: V3 = [0, -1, -0.35];

const wallWasher = defineItem({
  id: 'linear-wall-washer',
  name: 'Linear wall washer',
  category: 'lighting',
  type: 'lighting',
  group: 'Wall lights',
  tags: ['wall washer', 'wall grazer', 'linear', 'led', 'slim', 'minimal', 'accent lighting', 'đèn hắt tường', 'đèn rọi tường'],
  defaultSize: { w: 1.0, d: 0.09, h: 0.05 },
  minSize: { w: 0.4, d: 0.06, h: 0.03 },
  maxSize: { w: 2.4, d: 0.15, h: 0.08 },
  mount: 'wall',
  // High on the wall, just under the ceiling, grazing the wall below.
  defaultElevation: 2.35,
  slots: [matSlot('body', 'Profile', 'aluminium'), matSlot('light', 'LED lens', 'led-warm')],
  // Three cones from the slot in the underside, tipped back towards the wall.
  light: {
    color: WARM,
    intensity: 0.55,
    distance: 3.5,
    y: 0.002,
    kind: 'spot',
    dir: WASH_DIR,
    angle: 0.85,
    penumbra: 0.8,
    heads: [
      { x: -1 / 3, y: 0.002, z: 0.005 },
      { x: 0, y: 0.002, z: 0.005 },
      { x: 1 / 3, y: 0.002, z: 0.005 },
    ],
  },
  build: ({ w, d, h }) => {
    const zb = -d / 2 + 0.02;
    const parts: Part[] = [
      span('body', [-w / 2 + 0.008, w / 2 - 0.008], [0.006, h], [zb, d / 2], { bevel: 0.004 }),
      span('body', [-w / 2 + 0.008, w / 2 - 0.008], [0, 0.006], [d / 2 - 0.015, d / 2], NP),
      span('light', [-w / 2 + 0.008, w / 2 - 0.008], [0, 0.006], [zb + 0.005, d / 2 - 0.015], NP),
      span('body', [-w / 2, -w / 2 + 0.008], [0, h], [zb, d / 2], { bevel: 0.002, plan: false }),
      span('body', [w / 2 - 0.008, w / 2], [0, h], [zb, d / 2], { bevel: 0.002, plan: false }),
    ];
    for (const x of [-w / 2 + 0.08, w / 2 - 0.08]) {
      parts.push(span('body', [x - 0.015, x + 0.015], [h * 0.2, h * 0.8], [-d / 2, zb], NP));
    }
    return parts;
  },
  planDetail: ({ w }) => [line([-w / 2 + 0.01, 0.005], [w / 2 - 0.01, 0.005])],
});

const underCabinet = defineItem({
  id: 'under-cabinet-led',
  name: 'Under-cabinet LED bar',
  category: 'kitchen',
  type: 'lighting',
  group: 'Wall lights',
  tags: ['under cabinet', 'led bar', 'kitchen', 'task light', 'worktop', 'cool white', 'đèn led tủ bếp', 'den tu bep'],
  defaultSize: { w: 0.6, d: 0.05, h: 0.025 },
  minSize: { w: 0.3, d: 0.035, h: 0.015 },
  maxSize: { w: 1.5, d: 0.08, h: 0.04 },
  mount: 'wall',
  // Under the wall cabinets, about 0.5 m above the worktop.
  defaultElevation: 1.4,
  slots: [
    matSlot('body', 'Aluminium body', 'aluminium'),
    matSlot('caps', 'End caps', 'plastic-white'),
    matSlot('light', 'Diffuser', 'led-cool'),
  ],
  // A strip of LEDs: two wide cool cones straight down onto the worktop.
  light: {
    color: COOL,
    intensity: 0.5,
    distance: 2.2,
    y: 0.001,
    kind: 'spot',
    angle: 1.05,
    penumbra: 0.8,
    heads: [
      { x: -0.15, y: 0.001 },
      { x: 0.15, y: 0.001 },
    ],
  },
  build: ({ w, d, h }) => [
    span('body', [-w / 2 + 0.012, w / 2 - 0.012], [h * 0.3, h], [-d / 2, d / 2 - 0.004], { bevel: 0.003 }),
    span('light', [-w / 2 + 0.013, w / 2 - 0.013], [0, h * 0.3], [-d / 2 + 0.006, d / 2 - 0.01], NP),
    span('caps', [-w / 2, -w / 2 + 0.012], [0, h], [-d / 2, d / 2 - 0.004], { bevel: 0.003, plan: false }),
    span('caps', [w / 2 - 0.012, w / 2], [0, h], [-d / 2, d / 2 - 0.004], { bevel: 0.003, plan: false }),
    span('caps', [w / 2 - 0.045, w / 2 - 0.025], [h * 0.45, h * 0.85], [d / 2 - 0.004, d / 2], NP),
  ],
  planDetail: ({ w, d }) => [rectPoly(-w / 2 + 0.013, -d / 2 + 0.006, w / 2 - 0.013, d / 2 - 0.01)],
});

// ---------------------------------------------------------------------------
// Floor lamps
// ---------------------------------------------------------------------------

function torchGeom({ w, d, h }: Size3) {
  const m = Math.min(w, d) / 2;
  const R = m - 0.004;
  const bh = clamp(R * 0.55, 0.07, 0.16);
  return { m, R, bh, yB: h - bh, glowY: h - bh * 0.3 };
}

const TORCH_DEFAULT: Size3 = { w: 0.36, d: 0.36, h: 1.8 };

const torchiere = defineItem({
  id: 'torchiere',
  name: 'Torchiere uplighter',
  category: 'lighting',
  type: 'lighting',
  group: 'Floor lamps',
  tags: ['torchiere', 'uplighter', 'floor lamp', 'bowl', 'indirect', 'ceiling bounce', 'đèn cây', 'den cay hat tran'],
  defaultSize: TORCH_DEFAULT,
  minSize: { w: 0.26, d: 0.26, h: 1.4 },
  maxSize: { w: 0.55, d: 0.55, h: 2.0 },
  slots: [
    matSlot('metal', 'Base & stem', 'brass-aged'),
    matSlot('shade', 'Bowl', 'frosted-glass'),
    matSlot('light', 'Lamp', 'opal-warm'),
  ],
  // The lamp in the bowl throws a wide cone up onto the ceiling.
  light: (() => {
    const g = torchGeom(TORCH_DEFAULT);
    return { color: WARM, intensity: 1.4, distance: 4.5, y: g.glowY + 0.003, kind: 'spot' as const, dir: [0, 1, 0] as V3, angle: 1.0, penumbra: 0.7 };
  })(),
  build: (size) => {
    const { h } = size;
    const g = torchGeom(size);
    const rb = g.m * 0.8;
    const outer: V2[] = [
      [0, 0],
      [0.02, 0],
      [0.05, g.bh * 0.12],
      [g.R * 0.5, g.bh * 0.45],
      [g.R * 0.85, g.bh * 0.8],
      [g.R, g.bh],
    ];
    return [
      lathe(
        'metal',
        [0, 0, 0],
        [
          [0, 0],
          [rb, 0],
          [rb, 0.015],
          [rb * 0.75, 0.035],
          [rb * 0.2, 0.05],
          [0, 0.05],
        ],
        { segments: 40 },
      ),
      vcyl('metal', 0, 0, 0.05, g.yB + 0.01, 0.0115, { segments: 16, plan: false }),
      vcyl('metal', 0, 0, h * 0.33, h * 0.33 + 0.018, 0.016, NP),
      vcyl('metal', 0, 0, h * 0.62, h * 0.62 + 0.018, 0.016, NP),
      rodZ('metal', 0, h * 0.55, 0.01, 0.026, 0.004, NP),
      sphere('metal', [0, h * 0.55, 0.028], 0.007, NP),
      lathe('shade', [0, g.yB, 0], shell(outer, 0.004, 0.004), { segments: 40, plan: false }),
      ring('metal', [0, h - 0.003, 0], g.R - 0.002, 0.003, NP),
      cyl('light', [0, g.glowY, 0], g.R * 0.7, 0.004, { segments: 32, plan: false }),
    ];
  },
  planDetail: (size) => {
    const g = torchGeom(size);
    return [circle([0, 0], g.R), circle([0, 0], g.R * 0.7)];
  },
});

const READ_DIR = unit([0, -0.8, 0.6]);
const READ_SHADE_R = 0.07;
const READ_SHADE_H = 0.13;

function readGeom({ w, d, h }: Size3) {
  const rb = Math.min(w / 2, 0.15) - 0.005;
  const zb = -d / 2 + rb + 0.005;
  const piv: V3 = [0, h - 0.07, d / 2 - 0.13];
  const u = mul(READ_DIR, -1);
  const P = add(piv, mul(READ_DIR, READ_SHADE_H));
  return { rb, zb, yS: h * 0.72, piv, u, P, lens: add(P, mul(u, 0.03)) };
}

const READ_DEFAULT: Size3 = { w: 0.32, d: 0.6, h: 1.45 };

const readingFloorLamp = defineItem({
  id: 'reading-floor-lamp',
  name: 'Reading floor lamp',
  category: 'lighting',
  type: 'lighting',
  group: 'Floor lamps',
  tags: ['reading lamp', 'floor lamp', 'adjustable', 'task light', 'armchair', 'đèn cây đọc sách', 'den doc sach'],
  defaultSize: READ_DEFAULT,
  minSize: { w: 0.26, d: 0.45, h: 1.2 },
  maxSize: { w: 0.45, d: 0.9, h: 1.8 },
  slots: [
    matSlot('metal', 'Stem & arm', 'iron-black'),
    matSlot('shade', 'Shade', 'brass-aged'),
    matSlot('base', 'Base', 'iron-black'),
    matSlot('light', 'Lens', 'light-warm'),
  ],
  // A focused cone from the tilted head, forward and down over the reader's lap.
  light: (() => {
    const g = readGeom(READ_DEFAULT);
    return {
      color: WARM,
      intensity: 0.9,
      distance: 3.5,
      x: g.lens[0],
      y: g.lens[1],
      z: g.lens[2],
      kind: 'spot' as const,
      dir: READ_DIR,
      angle: 0.5,
      penumbra: 0.45,
    };
  })(),
  build: (size) => {
    const { h } = size;
    const g = readGeom(size);
    const R = READ_SHADE_R;
    const sh = READ_SHADE_H;
    const dz = g.piv[2] - g.zb;
    const outer: V2[] = [
      [R, 0],
      [R * 0.96, sh * 0.22],
      [R * 0.6, sh * 0.75],
      [0.02, sh],
      [0, sh],
    ];
    return [
      lathe(
        'base',
        [0, 0, g.zb],
        [
          [0, 0],
          [g.rb, 0],
          [g.rb, 0.012],
          [g.rb * 0.9, 0.025],
          [g.rb * 0.25, 0.032],
          [0, 0.032],
        ],
        { segments: 40 },
      ),
      vcyl('metal', 0, g.zb, 0.032, g.yS, 0.011, { segments: 16, plan: false }),
      sphere('metal', [0, g.yS, g.zb], 0.016, NP),
      ...rodPath(
        'metal',
        [
          [0, g.yS, g.zb],
          [0, h - 0.06, g.zb + dz * 0.12],
          [0, h - 0.03, g.zb + dz * 0.45],
          [0, h - 0.04, g.zb + dz * 0.8],
          g.piv,
        ],
        0.008,
        { segments: 12 },
      ),
      sphere('metal', g.piv, 0.014, NP),
      latheAlong('shade', g.P, g.u, shell(outer, 0.003, -0.003), { segments: 32, plan: false }),
      cylAlong('light', g.P, g.u, 0.03, 0.034, R * 0.72, 28),
      ring('base', [0, 0.012, g.zb], g.rb - 0.004, 0.004, NP),
    ];
  },
  planDetail: (size) => {
    const g = readGeom(size);
    return [circle([0, g.zb], g.rb * 0.6), line([0, g.zb], [0, g.P[2]]), circle([0, g.P[2]], READ_SHADE_R * 0.8)];
  },
});

function globeFloorGeom({ w, d, h }: Size3) {
  const R = Math.min(Math.min(w, d) / 2 - 0.005, 0.2, h * 0.15);
  return { R, gy: h - R };
}

const GLOBE_FLOOR_DEFAULT: Size3 = { w: 0.35, d: 0.35, h: 1.5 };

const globeFloorLamp = defineItem({
  id: 'globe-floor-lamp',
  name: 'Globe floor lamp',
  category: 'lighting',
  type: 'lighting',
  group: 'Floor lamps',
  tags: ['globe', 'opal', 'floor lamp', 'minimal', 'modern', 'ball', 'đèn cây quả cầu', 'den cay'],
  defaultSize: GLOBE_FLOOR_DEFAULT,
  minSize: { w: 0.25, d: 0.25, h: 1.0 },
  maxSize: { w: 0.5, d: 0.5, h: 1.9 },
  slots: [
    matSlot('metal', 'Base & stem', 'iron-black'),
    matSlot('collar', 'Collar', 'brass-aged'),
    matSlot('light', 'Opal globe', 'opal-warm'),
  ],
  // The whole opal globe glows: a point light at its centre.
  light: { color: WARM, intensity: 1.1, distance: 4.5, y: globeFloorGeom(GLOBE_FLOOR_DEFAULT).gy },
  build: (size) => {
    const { w, d } = size;
    const g = globeFloorGeom(size);
    const rb = (Math.min(w, d) / 2) * 0.8;
    const y0 = g.gy - g.R;
    const parts: Part[] = [
      lathe(
        'metal',
        [0, 0, 0],
        [
          [0, 0],
          [rb, 0],
          [rb, 0.008],
          [rb * 0.96, 0.016],
          [0, 0.016],
        ],
        { segments: 48 },
      ),
      vcyl('metal', 0, 0, 0.016, y0 + 0.01, 0.009, { segments: 16, plan: false }),
      cyl('collar', [0, y0 + 0.004, 0], 0.022, 0.028, { rTop: 0.032, segments: 24, plan: false }),
      sphere('light', [0, g.gy, 0], g.R, NP),
    ];
    if (d / 2 - 0.01 - rb > 0.04) {
      const zsw = -(rb + d / 2) / 2;
      parts.push(
        rodZ('metal', 0, 0.004, -rb, -d / 2 + 0.01, 0.003, NP),
        span('metal', [-0.014, 0.014], [0, 0.012], [zsw - 0.02, zsw + 0.02], { bevel: 0.005, plan: false }),
      );
    }
    return parts;
  },
  planDetail: (size) => {
    const g = globeFloorGeom(size);
    return [circle([0, 0], g.R), circle([0, 0], 0.012)];
  },
});

// ---------------------------------------------------------------------------
// Table lamps
// ---------------------------------------------------------------------------

/** Annular arc in the (y, z) plane: the cross-section of a half-tube shade, open at the bottom. */
function arcBand(ro: number, ri: number, a0: number, a1: number, n = 14): V2[] {
  const outer = range(n + 1).map((i) => {
    const t = lerp(a0, a1, i / n);
    return [ro * Math.sin(t), ro * Math.cos(t)] as V2;
  });
  const inner = range(n + 1).map((i) => {
    const t = lerp(a1, a0, i / n);
    return [ri * Math.sin(t), ri * Math.cos(t)] as V2;
  });
  return [...outer, ...inner];
}

function bankerGeom({ w, d, h }: Size3) {
  const rs = Math.min(d / 2 - 0.008, 0.08, h * 0.2);
  const yS = h - rs - 0.004;
  return { rs, L: w - 0.02, yS, yC: yS - rs * 0.95, bulbY: yS - rs * 0.1 };
}

const BANKER_DEFAULT: Size3 = { w: 0.36, d: 0.2, h: 0.4 };
const BANKER_A0 = -0.25;
const BANKER_A1 = Math.PI + 0.25;

const bankersLamp = defineItem({
  id: 'bankers-lamp',
  name: "Banker's lamp",
  category: 'office',
  type: 'lighting',
  group: 'Table lamps',
  tags: ["banker's lamp", 'green glass', 'desk lamp', 'library', 'brass', 'study', 'đèn bàn', 'den ban lam viec'],
  defaultSize: BANKER_DEFAULT,
  minSize: { w: 0.28, d: 0.16, h: 0.32 },
  maxSize: { w: 0.5, d: 0.28, h: 0.55 },
  // On a desk top.
  defaultElevation: 0.75,
  slots: [
    matSlot('metal', 'Brass base & fittings', 'brass-aged'),
    matSlot('shade', 'Green glass shade', 'banker-green'),
    matSlot('light', 'Glass lining & bulb', 'opal-warm'),
  ],
  // The tube bulb under the half-tube shade: a broad cone down onto the desk.
  light: (() => {
    const g = bankerGeom(BANKER_DEFAULT);
    return { color: WARM, intensity: 0.6, distance: 2.5, y: g.bulbY, kind: 'spot' as const, angle: 0.9, penumbra: 0.6 };
  })(),
  build: (size) => {
    const { w, d } = size;
    const g = bankerGeom(size);
    const rb = Math.min(w * 0.3, 0.12);
    const zs = Math.min(1, (d / 2 - 0.005) / rb);
    const L = g.L;
    const parts: Part[] = [
      lathe(
        'metal',
        [0, 0, 0],
        [
          [0, 0],
          [rb, 0],
          [rb, 0.008],
          [rb * 0.92, 0.016],
          [rb * 0.6, 0.03],
          [rb * 0.25, 0.036],
          [0, 0.036],
        ],
        { scale: [1, 1, zs], segments: 40 },
      ),
      vcyl('metal', 0, 0, 0.036, g.yC, 0.008, { segments: 16, plan: false }),
      vcyl('metal', 0, 0, 0.036, 0.05, 0.014, NP),
      vcyl('metal', 0, 0, g.yC - 0.012, g.yC + 0.004, 0.012, NP),
      vcyl('metal', 0, 0, g.yC, g.bulbY - 0.008, 0.007, NP),
      xPrism('shade', arcBand(g.rs, g.rs - 0.004, BANKER_A0, BANKER_A1), [0, g.yS, 0], L),
      xPrism('light', arcBand(g.rs - 0.004, g.rs - 0.006, BANKER_A0, BANKER_A1), [0, g.yS, 0], L - 0.01, NP),
      xPrism('shade', arcBand(g.rs, 0.001, BANKER_A0, BANKER_A1, 10), [-L / 2 + 0.002, g.yS, 0], 0.004, NP),
      xPrism('shade', arcBand(g.rs, 0.001, BANKER_A0, BANKER_A1, 10), [L / 2 - 0.002, g.yS, 0], 0.004, NP),
      rodX('light', -L * 0.35, L * 0.35, g.bulbY, 0, 0.011, { segments: 16, plan: false }),
      // Pull chain.
      vcyl('metal', L * 0.15, g.rs * 0.55, g.yS - g.rs * 0.9, g.yS - g.rs * 0.2, 0.0012, NP),
      sphere('metal', [L * 0.15, g.yS - g.rs * 0.9, g.rs * 0.55], 0.0045, NP),
    ];
    // Bracket arms from the stem to clips under the back edge of the shade.
    for (const s of [-1, 1]) {
      const clip: V3 = [s * L * 0.3, g.yS - g.rs * 0.22, -g.rs * 0.92];
      parts.push(
        ...rodPath(
          'metal',
          [
            [0, g.yC, 0],
            [s * L * 0.16, g.yC + 0.008, -g.rs * 0.5],
            clip,
          ],
          0.0035,
        ),
        sphere('metal', clip, 0.006, NP),
      );
    }
    return parts;
  },
  planDetail: (size) => {
    const g = bankerGeom(size);
    return [rectPoly(-g.L / 2, -g.rs, g.L / 2, g.rs), line([-g.L / 2, 0], [g.L / 2, 0])];
  },
});

function hurricaneGeom({ w, d, h }: Size3) {
  const R = Math.min(w, d) / 2 - 0.003;
  const bh = clamp(h * 0.12, 0.03, 0.08);
  const gh = h - bh;
  const ch = Math.min(gh * 0.35, 0.12);
  const cr = R * 0.42;
  const fr = Math.min(0.012, cr * 0.4);
  const fh = Math.min(0.04, gh * 0.12);
  const fy = bh + ch + 0.004;
  return { R, bh, gh, ch, cr, fr, fh, fy, flameC: fy + fh * 0.35 };
}

const HURRICANE_DEFAULT: Size3 = { w: 0.16, d: 0.16, h: 0.38 };

const hurricaneLamp = defineItem({
  id: 'hurricane-lamp',
  name: 'Hurricane candle lamp',
  category: 'lighting',
  type: 'lighting',
  group: 'Table lamps',
  tags: ['hurricane', 'glass chimney', 'candle', 'pillar candle', 'table centrepiece', 'romantic', 'đèn nến', 'den nen thuy tinh'],
  defaultSize: HURRICANE_DEFAULT,
  minSize: { w: 0.1, d: 0.1, h: 0.25 },
  maxSize: { w: 0.3, d: 0.3, h: 0.7 },
  defaultElevation: 0.75,
  slots: [
    matSlot('base', 'Base & rim', 'brass-aged'),
    matSlot('glass', 'Glass chimney', 'glass-clear'),
    matSlot('wax', 'Candle', 'ivory-wax'),
    matSlot('light', 'Flame', 'light-candle'),
  ],
  // An open flame: soft, warm, all-round.
  light: { color: '#ffb86b', intensity: 0.35, distance: 2.5, y: hurricaneGeom(HURRICANE_DEFAULT).flameC },
  build: (size) => {
    const { h } = size;
    const g = hurricaneGeom(size);
    const R = g.R;
    const outer: V2[] = [
      [R * 0.72, 0],
      [R * 0.92, g.gh * 0.3],
      [R, g.gh * 0.5],
      [R * 0.9, g.gh * 0.75],
      [R * 0.78, g.gh],
    ];
    return [
      lathe(
        'base',
        [0, 0, 0],
        [
          [0, 0],
          [R * 0.85, 0],
          [R * 0.88, g.bh * 0.2],
          [R * 0.7, g.bh * 0.45],
          [R * 0.55, g.bh * 0.7],
          [R * 0.8, g.bh],
          [0, g.bh],
        ],
        { segments: 32 },
      ),
      lathe('glass', [0, g.bh, 0], shell(outer, 0.003, 0), { segments: 40, plan: false }),
      ring('base', [0, h - 0.003, 0], R * 0.78 - 0.0015, 0.003, NP),
      vcyl('wax', 0, 0, g.bh, g.bh + g.ch, g.cr, { segments: 24, plan: false }),
      vcyl('base', 0, 0, g.bh + g.ch, g.fy + 0.002, 0.0012, NP),
      flame('light', [0, g.fy, 0], g.fr, g.fh),
    ];
  },
  planDetail: (size) => {
    const g = hurricaneGeom(size);
    return [circle([0, 0], g.R * 0.78), circle([0, 0], g.cr)];
  },
});

// ---------------------------------------------------------------------------
// Outdoor & string lights
// ---------------------------------------------------------------------------

function festoonGeom({ w, h }: Size3) {
  const pc = w / 2 - 0.045;
  const xa = w / 2 - 0.08;
  const top = h * 0.93;
  const sag = h * 0.12;
  const cy = (x: number): number => top - sag * (1 - (x / xa) ** 2);
  const n = clamp(2 * Math.round(xa / 0.45) - 1, 3, 19);
  const bx = range(n).map((i) => -xa + ((i + 1) * 2 * xa) / (n + 1));
  const bulb = (x: number): V3 => [x, cy(x) - 0.085, 0];
  const q = Math.max(1, Math.floor((n - 1) / 4));
  return { pc, xa, top, cy, n, bx, bulb, lit: [q, (n - 1) / 2, n - 1 - q] };
}

const FESTOON_DEFAULT: Size3 = { w: 4.0, d: 0.25, h: 2.6 };

const festoon = defineItem({
  id: 'festoon-posts',
  name: 'Festoon string lights',
  category: 'outdoor',
  type: 'lighting',
  group: 'Outdoor & string lights',
  tags: ['festoon', 'string lights', 'globe bulbs', 'posts', 'patio', 'garden party', 'café', 'đèn dây', 'den day bong tron'],
  defaultSize: FESTOON_DEFAULT,
  minSize: { w: 2.0, d: 0.15, h: 2.0 },
  maxSize: { w: 8.0, d: 0.4, h: 3.2 },
  slots: [
    matSlot('posts', 'Posts', 'wood-teak'),
    matSlot('cable', 'Cable & sockets', 'rubber-black'),
    matSlot('light', 'Bulbs', 'festoon-glow'),
  ],
  // Three of the bare globes along the sagging cable carry the light.
  light: (() => {
    const g = festoonGeom(FESTOON_DEFAULT);
    const heads = g.lit.map((i) => {
      const p = g.bulb(g.bx[i]);
      return { x: p[0], y: p[1] };
    });
    return { color: '#ffc98a', intensity: 0.45, distance: 3.5, y: heads[0].y, heads };
  })(),
  build: (size) => {
    const { d, h } = size;
    const g = festoonGeom(size);
    const bz = Math.min(0.05, d / 2 - 0.005);
    const parts: Part[] = [];
    for (const s of [-1, 1]) {
      const x = s * g.pc;
      parts.push(
        span('cable', [x - 0.045, x + 0.045], [0, 0.012], [-bz, bz], { bevel: 0.003 }),
        span('posts', [x - 0.035, x + 0.035], [0.012, h - 0.02], [-0.035, 0.035], { bevel: 0.004 }),
        span('posts', [x - 0.04, x + 0.04], [h - 0.02, h], [-0.04, 0.04], { bevel: 0.006, plan: false }),
        torus('cable', [s * (g.xa + 0.004), g.top, 0], 0.008, 0.002, NP),
      );
    }
    const pts = range(17).map((i) => {
      const x = lerp(-g.xa, g.xa, i / 16);
      return [x, g.cy(x), 0] as V3;
    });
    parts.push(...rodPath('cable', pts, 0.003, { segments: 8 }));
    for (const x of g.bx) {
      const y = g.cy(x);
      parts.push(
        vcyl('cable', x, 0, y - 0.03, y, 0.002, NP),
        vcyl('cable', x, 0, y - 0.056, y - 0.028, 0.011, { segments: 14, plan: false }),
        sphere('light', g.bulb(x), 0.03, NP),
      );
    }
    return parts;
  },
  planDetail: (size) => {
    const g = festoonGeom(size);
    return [line([-g.xa, 0], [g.xa, 0]), ...g.bx.map((x) => circle([x, 0], 0.03))];
  },
});

// ---------------------------------------------------------------------------
// Pack
// ---------------------------------------------------------------------------

export default definePack({
  name: 'Lighting collection',
  version: '1.0.0',
  author: 'Neest',
  description:
    'Twenty modern light fittings with correctly placed light sources: recessed downlights (single and a set of four), an LED panel, a fabric drum, a Sputnik chandelier, a bubble glass cluster, an industrial cage pendant, a halo ring LED pendant, a kitchen island trio, monorail spots, up/down and vanity sconces, a linear wall washer, an under-cabinet LED bar, a torchiere, a reading floor lamp, a globe floor lamp, a banker’s lamp, a hurricane lamp and festoon string lights.',
  license: 'CC0',
  items: [
    recessedDownlight,
    downlightSet,
    drumFlush,
    sputnik,
    bubbleCluster,
    cagePendant,
    haloPendant,
    islandTrio,
    monorail,
    upDownSconce,
    vanityBar,
    wallWasher,
    underCabinet,
    torchiere,
    readingFloorLamp,
    globeFloorLamp,
    bankersLamp,
    hurricaneLamp,
    festoon,
  ],
  materials: [
    // Glowing diffusers (for 'light' slots).
    { id: 'opal-warm', name: 'Warm opal glass', category: 'glass', color: '#fff6e8', roughness: 0.4, emissive: '#ffe0b0', emissiveIntensity: 2.2 },
    { id: 'opal-cool', name: 'Cool opal glass', category: 'glass', color: '#f5f8ff', roughness: 0.4, emissive: '#e6eeff', emissiveIntensity: 2.4 },
    { id: 'led-cool', name: 'Cool LED diffuser', category: 'solid', color: '#f7f9ff', roughness: 0.5, emissive: '#eef3ff', emissiveIntensity: 2.6 },
    { id: 'edison-glow', name: 'Amber filament bulb', category: 'glass', color: '#ffc477', roughness: 0.15, emissive: '#ff9d3a', emissiveIntensity: 2.6 },
    { id: 'festoon-glow', name: 'Festoon bulb glow', category: 'glass', color: '#fff0d6', roughness: 0.2, emissive: '#ffcf8a', emissiveIntensity: 2.4 },
    { id: 'linen-glow', name: 'Glowing linen shade', category: 'fabric', color: '#efe6d4', roughness: 0.95, emissive: '#ffdcaa', emissiveIntensity: 1.1, pattern: { id: 'weave', scale: 0.12, contrast: 0.6 } },
    { id: 'led-warm', name: 'Warm LED diffuser', category: 'solid', color: '#fff7ea', roughness: 0.5, emissive: '#ffe2b8', emissiveIntensity: 2.4 },
    // Frames, shades and glass.
    { id: 'brass-aged', name: 'Aged brass', category: 'metal', color: '#b8914a', roughness: 0.35, metalness: 1, pattern: { id: 'brushed', scale: 0.3, contrast: 0.5 } },
    { id: 'iron-black', name: 'Black iron', category: 'metal', color: '#26262a', roughness: 0.55, metalness: 0.7 },
    { id: 'aluminium', name: 'Brushed aluminium', category: 'metal', color: '#c9ccd0', roughness: 0.3, metalness: 0.9, pattern: { id: 'brushed', scale: 0.3, contrast: 0.4 } },
    { id: 'bubble-glass', name: 'Smoky bubble glass', category: 'glass', color: '#d9c8a6', roughness: 0.03, metalness: 0.1, opacity: 0.3 },
    { id: 'frosted-glass', name: 'Frosted glass', category: 'glass', color: '#eef2f2', roughness: 0.5, opacity: 0.7 },
    { id: 'banker-green', name: "Banker's green glass", category: 'glass', color: '#1f5a3a', roughness: 0.12, metalness: 0.1 },
    { id: 'ivory-wax', name: 'Ivory wax', category: 'solid', color: '#f1e8d6', roughness: 0.6 },
  ],
});

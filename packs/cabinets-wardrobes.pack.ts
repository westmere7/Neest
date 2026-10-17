/**
 * Cabinets & wardrobes — storage furniture with real joinery.
 *
 * Shaker, slab, louvred, mirrored, glazed and cane-webbed fronts on plinths and under cornices,
 * with knobs, bar pulls, cup pulls and visible hinges where a piece would show them. Open pieces
 * show what they hold: clothes on hangers, folded stacks, shoes, ceramics, bottles and glasses.
 * Door and drawer counts follow the width, and contents re-flow when an item is resized.
 *
 * Pack patterns: crown-cut wood veneer (cathedral grain), brushed paint for painted MDF and a
 * coloured cane webbing with octagonal holes.
 */
import {
  barPull,
  bookRow,
  box,
  cellSpans,
  clamp,
  cyl,
  defineItem,
  definePack,
  discZ,
  frame4,
  knob,
  lathe,
  lerp,
  line,
  matSlot,
  pot,
  prism,
  range,
  rectPoly,
  rng,
  rod,
  rodPath,
  rodX,
  rodZ,
  shakerFront,
  spaced,
  span,
  sphere,
  torus,
  turnedLeg,
  vcyl,
  type Part,
  type PlanStroke,
  type V2,
  type V3,
} from '@/packs/kit';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const NP = { plan: false } as const;

/** Detail box (hidden from the plan) spanning x/y/z ranges, with an optional bevel. */
const sp = (slot: string, x: V2, y: V2, z: V2, bevel = 0): Part => span(slot, x, y, z, { bevel, plan: false });

/** A flat shape facing the front (+z): `pts` are [x, y] in metres, `t` thick from depth z. */
function facePlate(slot: string, pts: V2[], z: number, t: number): Part {
  const ys = pts.map((p) => p[1]);
  const xs = pts.map((p) => p[0]);
  const mid = (Math.min(...ys) + Math.max(...ys)) / 2;
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  return {
    shape: 'prism',
    outline: pts.map(([x, y]) => [x - cx, -(y - mid)] as V2),
    height: t,
    position: [cx, mid, z],
    rotation: [Math.PI / 2, 0, 0],
    slot,
    plan: false,
  };
}

/** A flat shape seen from the side: `pts` are [z, y], extruded `t` along +x from x. */
function sidePlate(slot: string, pts: V2[], x: number, t: number): Part {
  const zs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  return {
    shape: 'prism',
    outline: pts.map(([z, y]) => [-(y - cy), z - cz] as V2),
    height: t,
    position: [x, cy, cz],
    rotation: [0, 0, -Math.PI / 2],
    slot,
    plan: false,
  };
}

/** A board between two points in the XY plane (roof boards, braces), spanning depth z. */
function beamXY(slot: string, a: V2, b: V2, z: V2, t: number): Part {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return box(slot, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (z[0] + z[1]) / 2], [len, t, z[1] - z[0]], {
    rotation: [0, 0, Math.atan2(b[1] - a[1], b[0] - a[0])],
    plan: false,
  });
}

/**
 * Turns parts built in a local frame (front face towards +z) by `theta` about the vertical axis
 * and moves them to (ox, oz). Only for boxes, spheres and vertical cylinders without x/z tilt.
 */
function placeY(parts: Part[], theta: number, ox: number, oz: number): Part[] {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return parts.map((p) => {
    const [x, y, z] = p.position;
    const r = p.rotation ?? [0, 0, 0];
    return { ...p, position: [ox + x * c + z * s, y, oz - x * s + z * c], rotation: [r[0], r[1] + theta, r[2]] };
  });
}

/** Butt-hinge knuckle: a short vertical barrel at the hinged edge of a door. */
const hinge = (slot: string, x: number, yc: number, z: number, len = 0.05): Part =>
  vcyl(slot, x, z, yc - len / 2, yc + len / 2, 0.0045, NP);

/** Hinge pair: knuckles near the top and bottom of a door edge. */
function hinges(slot: string, x: number, y: V2, z: number): Part[] {
  const inset = Math.min(0.12, (y[1] - y[0]) * 0.15);
  return [hinge(slot, x, y[0] + inset, z), hinge(slot, x, y[1] - inset, z)];
}

/**
 * Framed door: stiles and rails around an inset (mirror, glass, cane or a contrasting panel).
 * The inset sits `depth` (fraction of t) into the frame. `bead` adds a slim inner moulding.
 */
function framedFront(
  frameSlot: string,
  insetSlot: string,
  x: V2,
  y: V2,
  zFace: number,
  t: number,
  rail = 0.05,
  depth = 0.5,
  bead = false,
): Part[] {
  const g = 0.0015;
  const x0 = x[0] + g;
  const x1 = x[1] - g;
  const y0 = y[0] + g;
  const y1 = y[1] - g;
  const r = Math.min(rail, (x1 - x0) * 0.3, (y1 - y0) * 0.3);
  const zi = zFace + t * depth;
  const parts: Part[] = [
    ...frame4(frameSlot, [x0, x1], [y0, y1], [zFace, zFace + t], r),
    sp(insetSlot, [x0 + r - 0.003, x1 - r + 0.003], [y0 + r - 0.003, y1 - r + 0.003], [zi - 0.004, zi]),
  ];
  if (bead) parts.push(...frame4(frameSlot, [x0 + r, x1 - r], [y0 + r, y1 - r], [zFace, zFace + t * 0.85], 0.012));
  return parts;
}

/** Louvred door: frame plus angled slats; the slat count follows the height (capped). */
function louvreFront(slot: string, x: V2, y: V2, zFace: number, t: number, maxSlats: number, rail = 0.05): Part[] {
  const g = 0.0015;
  const x0 = x[0] + g;
  const x1 = x[1] - g;
  const y0 = y[0] + g;
  const y1 = y[1] - g;
  const r = Math.min(rail, (x1 - x0) * 0.3, (y1 - y0) * 0.2);
  const iy0 = y0 + r;
  const iy1 = y1 - r;
  const n = clamp(Math.round((iy1 - iy0) / 0.042), 3, Math.max(3, maxSlats));
  const pitch = (iy1 - iy0) / n;
  const parts: Part[] = [...frame4(slot, [x0, x1], [y0, y1], [zFace, zFace + t], r)];
  for (const i of range(n)) {
    parts.push(
      box(slot, [(x0 + x1) / 2, iy0 + (i + 0.5) * pitch, zFace + t / 2], [x1 - x0 - 2 * r + 0.004, pitch * 1.25, 0.005], {
        rotation: [-0.75, 0, 0],
        plan: false,
      }),
    );
  }
  return parts;
}

/** Pull position on door i of n: on the meeting stiles of each pair, else the free edge. */
function pullX(i: number, n: number, a: number, b: number, inset = 0.04): number {
  const pairLeft = i % 2 === 0 && i + 1 < n;
  return pairLeft ? b - inset : a + inset;
}

/** Half-moon cup (bin) pull, open side up, on a front whose surface is at depth z. */
const cupPull = (slot: string, x: number, y: number, z: number, r: number): Part =>
  torus(slot, [x, y, z + 0.008], r, Math.min(0.0045, r * 0.4), {
    arc: Math.PI,
    rotation: [0, 0, Math.PI],
    scale: [1, 1, 1.6],
    plan: false,
  });

/** Five-point star facing the front, centred at (x, y) with outer radius R. */
function star(slot: string, x: number, y: number, R: number, z: number, t: number): Part {
  const pts: V2[] = range(10).map((i) => {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? R : R * 0.45;
    return [x + Math.cos(a) * rr, y + Math.sin(a) * rr];
  });
  return facePlate(slot, pts, z, t);
}

// ---- Clothes, shoes and boxes ----------------------------------------------

type Garment = 'shirt' | 'coat' | 'dress' | 'trousers' | 'knit';
const DROP: Record<Garment, number> = { shirt: 0.72, coat: 1.0, dress: 1.05, trousers: 0.55, knit: 0.62 };

/** One garment on a wire hanger, hanging from a rail at yRail centred on depth zc. */
function garment(
  slot: string,
  hangerSlot: string,
  kind: Garment,
  x: number,
  yRail: number,
  zc: number,
  width: number,
  maxDrop: number,
  hook: boolean,
): Part[] {
  const W = width;
  const yS = yRail - 0.045;
  const L = Math.max(0.18, Math.min(DROP[kind], maxDrop));
  const th = kind === 'coat' ? 0.045 : kind === 'knit' ? 0.034 : kind === 'trousers' ? 0.03 : 0.022;
  let pts: V2[];
  if (kind === 'dress') {
    pts = [
      [-W * 0.28, yS - 0.03],
      [-W * 0.1, yS],
      [W * 0.1, yS],
      [W * 0.28, yS - 0.03],
      [W * 0.22, yS - L * 0.38],
      [W * 0.5, yS - L],
      [-W * 0.5, yS - L],
      [-W * 0.22, yS - L * 0.38],
    ];
  } else if (kind === 'trousers') {
    pts = [
      [-W * 0.3, yS + 0.004],
      [W * 0.3, yS + 0.004],
      [W * 0.27, yS - L],
      [-W * 0.27, yS - L],
    ];
  } else {
    const sh = kind === 'coat' ? 0.07 : 0.05;
    pts = [
      [-W * 0.5, yS - sh],
      [-W * 0.15, yS],
      [W * 0.15, yS],
      [W * 0.5, yS - sh],
      [W * 0.46, yS - L],
      [-W * 0.46, yS - L],
    ];
  }
  const parts: Part[] = [
    sidePlate(slot, pts.map(([z, y]) => [z + zc, y] as V2), x - th / 2, th),
    rodZ(hangerSlot, x, yS + 0.004, zc - W * 0.44, zc + W * 0.44, 0.0035, NP),
  ];
  if (hook) parts.push(rod(hangerSlot, [x, yS + 0.004, zc], [x, yRail + 0.012, zc], 0.0025, NP));
  return parts;
}

/** A rail's worth of garments over x; count follows the rail length. Deterministic per seed. */
function hangingRow(
  slots: string[],
  hangerSlot: string,
  x: V2,
  yRail: number,
  zc: number,
  width: number,
  maxDrop: number,
  kinds: Garment[],
  seed: number,
  opts: { pitch?: number; max?: number; hook?: boolean } = {},
): Part[] {
  const rand = rng(seed);
  const pitch = opts.pitch ?? 0.075;
  const n = clamp(Math.floor((x[1] - x[0] - 0.04) / pitch), 1, opts.max ?? 20);
  const parts: Part[] = [];
  for (const gx of spaced(n, x[0] + 0.04, x[1] - 0.04)) {
    const kind = kinds[Math.floor(rand() * kinds.length) % kinds.length];
    const slot = slots[Math.floor(rand() * slots.length) % slots.length];
    const jx = (rand() - 0.5) * Math.min(0.012, pitch * 0.2);
    parts.push(...garment(slot, hangerSlot, kind, gx + jx, yRail, zc, width, maxDrop, opts.hook ?? false));
  }
  return parts;
}

/** Stack of folded clothes (soft slabs, slightly offset), base at y0. */
function foldedStack(slots: string[], cx: number, y0: number, zc: number, w: number, dep: number, n: number, seed: number): Part[] {
  const rand = rng(seed);
  const parts: Part[] = [];
  let y = y0;
  for (const i of range(n)) {
    const th = lerp(0.03, 0.048, rand());
    const jx = (rand() - 0.5) * 0.01;
    parts.push(
      span(slots[(i + seed) % slots.length], [cx - w / 2 + jx, cx + w / 2 + jx], [y, y + th], [zc - dep / 2, zc + dep / 2], {
        bevel: th * 0.4,
        plan: false,
      }),
    );
    y += th;
  }
  return parts;
}

/** A pair of shoes (or ankle boots) side by side, toes to the front, on a surface at y0. */
function shoePair(slot: string, cx: number, y0: number, zc: number, len: number, boot = false): Part[] {
  const sw = Math.min(0.09, len * 0.36);
  const parts: Part[] = [];
  for (const s of [-1, 1]) {
    const x = cx + s * (sw / 2 + 0.006);
    parts.push(sphere(slot, [x, y0 + 0.038, zc], 0.5, { scale: [sw, 0.076, len], plan: false }));
    if (boot) parts.push(vcyl(slot, x, zc - len * 0.22, y0 + 0.03, y0 + 0.26, sw * 0.45, NP));
  }
  return parts;
}

// ---- Ceramics, bottles and glasses -----------------------------------------

/** Ceramic vase on a shelf: 0 bottle vase, 1 ginger jar, 2 tall cylinder vase. */
function vase(slot: string, x: number, y0: number, z: number, r: number, hh: number, kind: number): Part {
  const P: V2[][] = [
    [
      [0, 0],
      [r * 0.6, 0],
      [r, hh * 0.3],
      [r * 0.88, hh * 0.56],
      [r * 0.34, hh * 0.78],
      [r * 0.28, hh * 0.93],
      [r * 0.4, hh],
      [0, hh],
    ],
    [
      [0, 0],
      [r * 0.65, 0],
      [r, hh * 0.42],
      [r * 0.82, hh * 0.8],
      [r * 0.52, hh * 0.86],
      [r * 0.52, hh * 0.93],
      [r * 0.22, hh],
      [0, hh],
    ],
    [
      [0, 0],
      [r * 0.8, 0],
      [r * 0.85, hh * 0.85],
      [r, hh],
      [r * 0.9, hh],
      [r * 0.88, hh * 0.96],
    ],
  ];
  return lathe(slot, [x, y0, z], P[kind % 3], { segments: 24, plan: false });
}

/** Bottle: 0 wine, 1 gin/decanter, 2 squat whisky. */
function bottle(slot: string, x: number, y0: number, z: number, r: number, hh: number, kind: number): Part {
  const P: V2[][] = [
    [
      [0, 0],
      [r, 0],
      [r, hh * 0.6],
      [r * 0.9, hh * 0.67],
      [r * 0.33, hh * 0.78],
      [r * 0.3, hh],
      [0, hh],
    ],
    [
      [0, 0],
      [r, 0],
      [r, hh * 0.72],
      [r * 0.55, hh * 0.8],
      [r * 0.3, hh * 0.83],
      [r * 0.3, hh * 0.94],
      [r * 0.45, hh * 0.96],
      [r * 0.2, hh],
      [0, hh],
    ],
    [
      [0, 0],
      [r, 0],
      [r, hh * 0.55],
      [r * 0.45, hh * 0.68],
      [r * 0.27, hh * 0.72],
      [r * 0.27, hh],
      [0, hh],
    ],
  ];
  return lathe(slot, [x, y0, z], P[kind % 3], { segments: 18, plan: false });
}

/** Drinking glass: 0 tumbler, 1 stemmed coupe/wine glass. */
function drinkingGlass(slot: string, x: number, y0: number, z: number, r: number, hh: number, kind: number): Part {
  const prof: V2[] =
    kind % 2 === 0
      ? [
          [0, 0],
          [r * 0.92, 0],
          [r, hh],
          [r * 0.94, hh],
          [r * 0.86, hh * 0.1],
        ]
      : [
          [0, 0],
          [r * 0.8, 0],
          [r * 0.12, hh * 0.05],
          [r * 0.1, hh * 0.5],
          [r * 0.6, hh * 0.6],
          [r, hh * 0.85],
          [r * 0.96, hh],
        ];
  return lathe(slot, [x, y0, z], prof, { segments: 18, plan: false });
}

// ---- Standard carcass pieces -----------------------------------------------

/** Two-step cornice: a cove band set back slightly under an overhanging cap. */
function cornice(slot: string, w: number, d: number, y0: number, y1: number, ov: number): Part[] {
  const ym = y0 + (y1 - y0) * 0.45;
  return [
    sp(slot, [-w / 2 + ov * 0.5, w / 2 - ov * 0.5], [y0, ym], [-d / 2, d / 2 - ov * 0.5], 0.004),
    span(slot, [-w / 2, w / 2], [ym, y1], [-d / 2, d / 2], { bevel: 0.006 }),
  ];
}

/** Plan strokes: a front line and a hanging rail with hanger ticks. */
function wardrobePlan(w: number, d: number, zDoor: number): PlanStroke[] {
  const zRail = (-d / 2 + zDoor) / 2;
  const reach = Math.min(0.18, (zDoor + d / 2) / 2 - 0.05);
  const strokes: PlanStroke[] = [line([-w / 2, zDoor], [w / 2, zDoor]), line([-w / 2 + 0.05, zRail], [w / 2 - 0.05, zRail])];
  const n = clamp(Math.round(w / 0.15), 3, 16);
  for (const x of spaced(n, -w / 2 + 0.1, w / 2 - 0.1)) strokes.push(line([x - 0.03, zRail - reach], [x + 0.03, zRail + reach]));
  return strokes;
}

/** Plan strokes: door/drawer divisions along the front. */
function frontPlan(w: number, z: number, n: number): PlanStroke[] {
  const strokes: PlanStroke[] = [line([-w / 2, z], [w / 2, z])];
  for (const [a] of cellSpans(n, -w / 2, w / 2).slice(1)) strokes.push(line([a, z - 0.03], [a, z]));
  return strokes;
}

// ---------------------------------------------------------------------------
// Wardrobes
// ---------------------------------------------------------------------------

const slidingCount = (w: number): number => clamp(Math.round(w / 0.9), 2, 3);

const slidingWardrobe = defineItem({
  id: 'wardrobe-sliding',
  name: 'Sliding-door wardrobe',
  category: 'bedroom',
  type: 'storage',
  group: 'Wardrobes',
  tags: ['wardrobe', 'closet', 'sliding doors', 'mirror', 'modern', 'clothes', 'bypass doors'],
  defaultSize: { w: 1.8, d: 0.64, h: 2.2 },
  minSize: { w: 1.2, d: 0.55, h: 1.8 },
  maxSize: { w: 3.0, d: 0.72, h: 2.6 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Carcass & pelmet', 'painted-white'),
    matSlot('door', 'Door panels', 'walnut-veneer'),
    matSlot('mirror', 'Mirror door', 'glass-mirror'),
    matSlot('metal', 'Tracks & profiles', 'metal-brushed-steel'),
  ],
  build: ({ w, d, h }) => {
    const n = slidingCount(w);
    const cheek = 0.018;
    const pl = 0.07;
    const pel = 0.08;
    const zC = d / 2 - 0.075;
    const W = w - 2 * cheek;
    const ov = 0.04;
    const dw = (W + ov * (n - 1)) / n;
    const yb = pl;
    const yt = h - pel;
    const xi: V2 = [-w / 2 + cheek, w / 2 - cheek];
    const parts: Part[] = [
      span('body', [-w / 2, w / 2], [0, h], [-d / 2, zC]),
      sp('body', [-w / 2, xi[0]], [0, h], [zC, d / 2], 0.003),
      sp('body', [xi[1], w / 2], [0, h], [zC, d / 2], 0.003),
      sp('body', xi, [h - pel, h], [zC, d / 2 - 0.004], 0.003),
      sp('body', xi, [0, pl - 0.012], [zC, d / 2 - 0.02]),
      sp('metal', xi, [pl - 0.012, pl], [zC, d / 2 - 0.012]),
      sp('metal', xi, [h - pel - 0.012, h - pel], [zC, d / 2 - 0.012]),
    ];
    const mirrorIdx = n === 3 ? 1 : 0;
    const st = 0.022;
    const rl = 0.035;
    for (const i of range(n)) {
      const frontTrack = n === 2 ? i === 1 : i % 2 === 0;
      const z0 = frontTrack ? zC + 0.036 : zC + 0.01;
      const z1 = z0 + 0.022;
      const x0 = xi[0] + i * (dw - ov);
      const x1 = x0 + dw;
      // Aluminium frame: the full-height stiles double as the handle profiles.
      parts.push(
        sp('metal', [x0, x0 + st], [yb, yt], [z0, z1 + 0.008], 0.003),
        sp('metal', [x1 - st, x1], [yb, yt], [z0, z1 + 0.008], 0.003),
        sp('metal', [x0 + st, x1 - st], [yt - rl, yt], [z0, z1]),
        sp('metal', [x0 + st, x1 - st], [yb, yb + rl], [z0, z1]),
      );
      const ix: V2 = [x0 + st, x1 - st];
      const iy: V2 = [yb + rl, yt - rl];
      const zi: V2 = [z0 + 0.006, z1 - 0.006];
      if (i === mirrorIdx) {
        parts.push(sp('mirror', ix, iy, zi));
      } else {
        // Three veneer panels split by slim aluminium transoms.
        for (const [k, [a, b]] of cellSpans(3, iy[0], iy[1]).entries()) {
          parts.push(sp('door', ix, [a + (k > 0 ? 0.006 : 0), b - (k < 2 ? 0.006 : 0)], zi));
          if (k < 2) parts.push(sp('metal', ix, [b - 0.006, b + 0.006], [zi[0], zi[1] + 0.002]));
        }
      }
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const zC = d / 2 - 0.075;
    return [...wardrobePlan(w, d, zC), line([-w / 2, zC + 0.047], [w / 2, zC + 0.047])];
  },
});

const mirroredWardrobe = defineItem({
  id: 'wardrobe-mirrored',
  name: 'Mirrored wardrobe',
  category: 'bedroom',
  type: 'storage',
  group: 'Wardrobes',
  tags: ['wardrobe', 'closet', 'mirror', 'mirrored doors', 'drawers', 'cornice', 'clothes'],
  defaultSize: { w: 1.2, d: 0.6, h: 2.1 },
  minSize: { w: 0.8, d: 0.5, h: 1.7 },
  maxSize: { w: 2.4, d: 0.68, h: 2.5 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Body & frames', 'painted-sage'),
    matSlot('mirror', 'Mirror', 'glass-mirror'),
    matSlot('handle', 'Pulls & knobs', 'metal-brass'),
  ],
  build: ({ w, d, h }) => {
    const ov = 0.015;
    const pl = 0.09;
    const corH = 0.065;
    const t = 0.022;
    const zC = d / 2 - 0.05;
    const xi: V2 = [-w / 2 + ov, w / 2 - ov];
    const top = h - corH;
    const parts: Part[] = [
      span('body', xi, [pl, top], [-d / 2, zC]),
      sp('body', [xi[0] + 0.02, xi[1] - 0.02], [0, pl - 0.02], [-d / 2 + 0.02, zC - 0.015]),
      sp('body', [xi[0] - 0.006, xi[1] + 0.006], [pl - 0.022, pl], [-d / 2, zC + t + 0.006], 0.005),
      ...cornice('body', w, d, top, h, ov),
    ];
    // Drawer plinth row.
    const yd: V2 = [pl, pl + clamp(h * 0.1, 0.16, 0.24)];
    const nd = clamp(Math.round(w / 0.6), 1, 4);
    for (const [a, b] of cellSpans(nd, xi[0], xi[1])) {
      parts.push(...shakerFront('body', [a, b], yd, zC, t, { rail: 0.045 }));
      parts.push(...knob('handle', [(a + b) / 2, (yd[0] + yd[1]) / 2, zC + t], 0.014));
    }
    // Mirror doors with a moulded bead inside each frame.
    const n = clamp(Math.round(w / 0.5), 2, 5);
    const yy: V2 = [yd[1], top];
    const hy = clamp(1.05, yy[0] + 0.2, top - 0.2);
    for (const [i, [a, b]] of cellSpans(n, xi[0], xi[1]).entries()) {
      parts.push(...framedFront('body', 'mirror', [a, b], yy, zC, t, 0.06, 0.55, true));
      parts.push(...barPull('handle', [pullX(i, n, a, b, 0.032), hy, zC + t], Math.min(0.24, (top - yy[0]) * 0.15), { vertical: true, stand: 0.02 }));
    }
    return parts;
  },
  planDetail: ({ w, d }) => wardrobePlan(w, d, d / 2 - 0.05),
});

/** Corner wardrobe footprint: an L along the back (-z) and left (-x) walls with a 45° door between. */
function cornerGeom(w: number, d: number) {
  const m = Math.min(w, d);
  const dep = clamp(m * 0.4, 0.45, 0.6);
  const s = clamp(m - dep - 0.32, 0.22, 0.5);
  const zA = -d / 2 + dep;
  const xB = -w / 2 + dep;
  return { dep, s, zA, xB, xc: xB + s, zc: zA + s };
}

const cornerWardrobe = defineItem({
  id: 'wardrobe-corner',
  name: 'Corner wardrobe',
  category: 'bedroom',
  type: 'storage',
  group: 'Wardrobes',
  tags: ['wardrobe', 'corner', 'closet', 'l-shaped', 'shaker', 'clothes', 'angled door'],
  defaultSize: { w: 1.4, d: 1.4, h: 2.1 },
  minSize: { w: 1.1, d: 1.1, h: 1.8 },
  maxSize: { w: 2.2, d: 2.2, h: 2.5 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Carcass & cornice', 'oak-veneer'),
    matSlot('door', 'Doors', 'painted-white'),
    matSlot('handle', 'Knobs', 'metal-brass'),
  ],
  build: ({ w, d, h }) => {
    const g = cornerGeom(w, d);
    const pl = 0.08;
    const capH = 0.06;
    const t = 0.022;
    const top = h - capH;
    const outline: V2[] = [
      [-w / 2, -d / 2],
      [w / 2, -d / 2],
      [w / 2, g.zA],
      [g.xc, g.zA],
      [g.xB, g.zc],
      [g.xB, d / 2],
      [-w / 2, d / 2],
    ];
    const parts: Part[] = [prism('body', outline, 0, top), prism('body', outline, top, capH, NP)];
    const faces: { L: number; theta: number; ox: number; oz: number; n: number }[] = [
      { L: w / 2 - g.xc, theta: 0, ox: (g.xc + w / 2) / 2, oz: g.zA, n: 0 },
      { L: g.s * Math.SQRT2, theta: Math.PI / 4, ox: (g.xB + g.xc) / 2, oz: (g.zc + g.zA) / 2, n: 1 },
      { L: d / 2 - g.zc, theta: Math.PI / 2, ox: g.xB, oz: (g.zc + d / 2) / 2, n: 0 },
    ];
    const hy = clamp(1.0, pl + 0.3, top - 0.3);
    for (const f of faces) {
      const n = f.n || clamp(Math.round(f.L / 0.5), 1, 3);
      const local: Part[] = [];
      for (const [i, [a, b]] of cellSpans(n, -f.L / 2, f.L / 2).entries()) {
        local.push(...shakerFront('door', [a, b], [pl + 0.003, top - 0.003], 0, t, { rail: 0.065 }));
        const kx = n === 1 ? b - 0.05 : pullX(i, n, a, b, 0.05);
        local.push(sphere('handle', [kx, hy, t + 0.014], 0.015, { scale: [1, 1, 0.8], plan: false }));
      }
      // Cornice fascia over the doors.
      local.push(sp('body', [-f.L / 2, f.L / 2], [top, h], [-0.004, t + 0.008], 0.004));
      parts.push(...placeY(local, f.theta, f.ox, f.oz));
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const g = cornerGeom(w, d);
    return [
      line([-w / 2 + g.dep / 2, -d / 2 + g.dep / 2], [w / 2 - 0.05, -d / 2 + g.dep / 2]),
      line([-w / 2 + g.dep / 2, -d / 2 + g.dep / 2], [-w / 2 + g.dep / 2, d / 2 - 0.05]),
    ];
  },
});

const builtinWardrobe = defineItem({
  id: 'wardrobe-builtin',
  name: 'Built-in floor-to-ceiling wardrobe',
  category: 'bedroom',
  type: 'storage',
  group: 'Wardrobes',
  tags: ['wardrobe', 'built-in', 'fitted', 'floor to ceiling', 'closet', 'shaker', 'top boxes'],
  defaultSize: { w: 2.4, d: 0.62, h: 2.6 },
  minSize: { w: 1.2, d: 0.5, h: 2.2 },
  maxSize: { w: 4.0, d: 0.7, h: 2.7 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Carcass, fillers & kick', 'painted-white'),
    matSlot('door', 'Doors', 'painted-sage'),
    matSlot('handle', 'Pulls & knobs', 'metal-brass'),
  ],
  build: ({ w, d, h }) => {
    const f = 0.04;
    const kick = 0.1;
    const bulk = 0.05;
    const t = 0.022;
    const zC = d / 2 - 0.05;
    const zF = zC + t;
    const xi: V2 = [-w / 2 + f, w / 2 - f];
    const yTop = h - bulk;
    const boxH = clamp((h - kick - bulk) * 0.17, 0.3, 0.48);
    const yT = yTop - boxH;
    const parts: Part[] = [
      span('body', [-w / 2, w / 2], [0, h], [-d / 2, zC]),
      sp('body', [-w / 2, xi[0]], [0, h], [zC, zF]),
      sp('body', [xi[1], w / 2], [0, h], [zC, zF]),
      sp('body', xi, [yTop, h], [zC, zF]),
      sp('body', xi, [0, kick], [zC, zF - 0.02]),
    ];
    const n = clamp(Math.round((xi[1] - xi[0]) / 0.5), 2, 8);
    const hy = clamp(1.05, kick + 0.3, yT - 0.3);
    for (const [i, [a, b]] of cellSpans(n, xi[0], xi[1]).entries()) {
      const px = pullX(i, n, a, b);
      parts.push(
        ...shakerFront('door', [a, b], [kick, yT], zC, t, { rail: 0.07 }),
        ...barPull('handle', [px, hy, zF], Math.min(0.45, (yT - kick) * 0.25), { vertical: true, stand: 0.02 }),
        ...shakerFront('door', [a, b], [yT, yTop], zC, t, { rail: 0.05 }),
        ...knob('handle', [px, yT + 0.07, zF], 0.012),
      );
    }
    return parts;
  },
  planDetail: ({ w, d }) => wardrobePlan(w, d, d / 2 - 0.05),
});

type Bay = 'double' | 'long' | 'drawers' | 'shoes';
const BAY_PLAN: Record<number, Bay[]> = {
  2: ['double', 'drawers'],
  3: ['double', 'drawers', 'long'],
  4: ['long', 'double', 'drawers', 'shoes'],
  5: ['long', 'double', 'drawers', 'double', 'shoes'],
};

/** One bay of the walk-in system between x0 and x1, floor y0 to the hat shelf y1. */
function closetBay(type: Bay, x0: number, x1: number, y0: number, y1: number, d: number, seed: number): Part[] {
  const zb = -d / 2;
  const zf = d / 2;
  const bw = x1 - x0;
  const cx = (x0 + x1) / 2;
  const W = Math.min(0.44, d - 0.06);
  const cl = ['clothes', 'clothes', 'accent'];
  const parts: Part[] = [];
  if (type === 'double' || type === 'long') {
    const yU = y1 - 0.05;
    parts.push(rodX('metal', x0, x1, yU, 0, 0.012, NP));
    if (type === 'double') {
      const yL = y0 + (y1 - y0) * 0.48;
      parts.push(rodX('metal', x0, x1, yL, 0, 0.012, NP));
      parts.push(...hangingRow(cl, 'metal', [x0, x1], yU, 0, W, yU - 0.045 - yL - 0.06, ['shirt', 'shirt', 'knit'], seed, { pitch: 0.085, max: 6 }));
      parts.push(...hangingRow(cl, 'metal', [x0, x1], yL, 0, W, yL - 0.045 - y0 - 0.05, ['trousers'], seed + 1, { pitch: 0.085, max: 6 }));
    } else {
      parts.push(...hangingRow(cl, 'metal', [x0, x1], yU, 0, W, yU - 0.045 - y0 - 0.32, ['coat', 'dress', 'coat'], seed, { pitch: 0.09, max: 6 }));
      parts.push(...shoePair('accent', cx, y0, 0, Math.min(0.26, d - 0.1), true));
    }
  } else if (type === 'drawers') {
    const dh = clamp((y1 - y0) * 0.11, 0.15, 0.2);
    const yd = y0 + 3 * dh;
    parts.push(sp('body', [x0, x1], [y0, yd], [zb, zf - 0.03]));
    parts.push(sp('body', [x0, x1], [yd, yd + 0.019], [zb, zf - 0.01]));
    for (const k of range(3)) {
      const a = y0 + k * dh;
      parts.push(sp('body', [x0 + 0.003, x1 - 0.003], [a + 0.003, a + dh - 0.003], [zf - 0.03, zf - 0.012], 0.003));
      parts.push(...barPull('metal', [cx, a + dh * 0.62, zf - 0.012], Math.min(0.22, bw * 0.4), { stand: 0.02 }));
    }
    const levels = [yd + 0.019, ...[0.36, 0.7].map((f) => yd + 0.019 + (y1 - yd - 0.019) * f)];
    const ns = bw > 0.55 ? 2 : 1;
    const sw = Math.min(0.3, bw / ns - 0.05);
    for (const [k, y] of levels.entries()) {
      if (k > 0) parts.push(sp('body', [x0, x1], [y - 0.019, y], [zb, zf - 0.01]));
      for (const [j, sx] of spaced(ns, x0 + bw / (2 * ns), x1 - bw / (2 * ns)).entries()) {
        parts.push(...foldedStack(['clothes', 'accent'], sx, y, -0.02, sw, Math.min(0.28, d - 0.12), k === 2 ? 2 : 3, seed + k * 3 + j));
      }
    }
  } else {
    // Slanted shoe shelves below, shoe boxes on flat shelves above.
    const nShelf = 3;
    const pairs = clamp(Math.floor(bw / 0.22), 1, 3);
    const tilt = 0.25;
    const sd = d - 0.08;
    for (const k of range(nShelf)) {
      const ys = y0 + 0.08 + k * 0.2;
      parts.push(box('body', [cx, ys, 0], [bw, 0.016, sd], { rotation: [tilt, 0, 0], plan: false }));
      const off = 0.008 + 0.038;
      for (const [j, px] of spaced(pairs, x0 + bw / (2 * pairs), x1 - bw / (2 * pairs)).entries()) {
        const slot = (j + k) % 2 === 0 ? 'accent' : 'clothes';
        for (const s of [-1, 1]) {
          parts.push(
            sphere(slot, [px + s * 0.05, ys + off * Math.cos(tilt), off * Math.sin(tilt)], 0.5, {
              scale: [0.088, 0.076, Math.min(0.27, sd - 0.04)],
              rotation: [tilt, 0, 0],
              plan: false,
            }),
          );
        }
      }
    }
    const yb = y0 + 0.08 + nShelf * 0.2 + 0.1;
    const nb = clamp(Math.floor((y1 - yb) / 0.28), 1, 3);
    const bxw = Math.min(0.3, bw / 2 - 0.04);
    for (const k of range(nb)) {
      const y = yb + k * 0.28;
      parts.push(sp('body', [x0, x1], [y - 0.019, y], [zb, zf - 0.01]));
      for (const sx of spaced(2, x0 + bw / 4, x1 - bw / 4)) {
        parts.push(sp('clothes', [sx - bxw / 2, sx + bxw / 2], [y, y + 0.12], [zb + 0.04, zb + 0.04 + Math.min(0.34, d - 0.12)], 0.004));
      }
    }
  }
  return parts;
}

const walkInCloset = defineItem({
  id: 'walk-in-closet',
  name: 'Walk-in closet system',
  category: 'bedroom',
  type: 'storage',
  group: 'Wardrobes',
  tags: ['walk-in', 'closet', 'dressing room', 'open wardrobe', 'hanging rail', 'shoe shelves', 'drawers', 'clothes'],
  defaultSize: { w: 2.4, d: 0.6, h: 2.2 },
  minSize: { w: 1.4, d: 0.45, h: 1.9 },
  maxSize: { w: 4.0, d: 0.7, h: 2.6 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Panels, shelves & drawers', 'oak-veneer'),
    matSlot('metal', 'Rails, pulls & hangers', 'metal-black-matte'),
    matSlot('clothes', 'Clothes & boxes', 'fabric-linen'),
    matSlot('accent', 'Accent clothes & shoes', 'fabric-navy'),
  ],
  build: ({ w, d, h }) => {
    const t = 0.019;
    const base = 0.06;
    const nb = clamp(Math.round(w / 0.75), 2, 5);
    const types = BAY_PLAN[nb];
    const yHat = h - clamp(h * 0.15, 0.3, 0.4);
    const parts: Part[] = [
      span('body', [-w / 2, w / 2], [h - 0.022, h], [-d / 2, d / 2]),
      sp('body', [-w / 2, w / 2], [0, base], [-d / 2 + 0.02, d / 2 - 0.03]),
    ];
    const posts = spaced(nb + 1, -w / 2 + t / 2, w / 2 - t / 2);
    for (const x of posts) parts.push(span('body', [x - t / 2, x + t / 2], [0, h - 0.022], [-d / 2, d / 2]));
    for (const [i, type] of types.entries()) {
      const x0 = posts[i] + t / 2;
      const x1 = posts[i + 1] - t / 2;
      const cx = (x0 + x1) / 2;
      const bxw = Math.min(0.42, x1 - x0 - 0.08);
      parts.push(sp('body', [x0, x1], [yHat - 0.019, yHat], [-d / 2, d / 2 - 0.01]));
      parts.push(
        sp('clothes', [cx - bxw / 2, cx + bxw / 2], [yHat, yHat + Math.min(0.24, h - 0.022 - yHat - 0.03)], [-d / 2 + 0.04, d / 2 - 0.06], 0.008),
      );
      parts.push(...closetBay(type, x0, x1, base, yHat - 0.019, d, 11 + i * 7));
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const nb = clamp(Math.round(w / 0.75), 2, 5);
    const strokes: PlanStroke[] = [line([-w / 2, d / 2 - 0.01], [w / 2, d / 2 - 0.01])];
    const posts = spaced(nb + 1, -w / 2 + 0.01, w / 2 - 0.01);
    for (const [i, type] of BAY_PLAN[nb].entries()) {
      if (type === 'double' || type === 'long') strokes.push(line([posts[i] + 0.03, 0], [posts[i + 1] - 0.03, 0]));
      else strokes.push(rectPoly(posts[i] + 0.03, -d / 2 + 0.03, posts[i + 1] - 0.03, d / 2 - 0.04));
    }
    return strokes;
  },
});

const openRack = defineItem({
  id: 'wardrobe-open',
  name: 'Open wardrobe rack with clothes',
  category: 'bedroom',
  type: 'storage',
  group: 'Wardrobes',
  tags: ['clothes rack', 'garment rail', 'open wardrobe', 'industrial', 'pipe', 'hangers', 'shoes'],
  defaultSize: { w: 1.2, d: 0.45, h: 1.75 },
  minSize: { w: 0.7, d: 0.38, h: 1.4 },
  maxSize: { w: 2.0, d: 0.6, h: 2.0 },
  wallSnap: true,
  slots: [
    matSlot('frame', 'Pipe frame & hangers', 'metal-black-matte'),
    matSlot('wood', 'Shelf', 'oak-veneer'),
    matSlot('clothes', 'Clothes', 'fabric-linen'),
    matSlot('accent', 'Accent clothes & shoes', 'fabric-terracotta'),
  ],
  build: ({ w, d, h }) => {
    const r = 0.014;
    const xs = w / 2 - 0.03;
    const yRail = h - r - 0.004;
    const zf = d / 2 - 0.02;
    const yShelf = 0.2;
    const parts: Part[] = [
      rodX('frame', -xs, xs, yRail, 0, r, NP),
      span('wood', [-xs + r, xs - r], [yShelf, yShelf + 0.028], [-zf + 0.02, zf - 0.02], { bevel: 0.004 }),
    ];
    for (const sx of [-1, 1]) {
      const x = sx * xs;
      parts.push(
        vcyl('frame', x, 0, 0.018, yRail, r),
        rodZ('frame', x, 0.018, -zf, zf, r, NP),
        sphere('frame', [x, 0.018, 0], r * 1.35, NP),
        sphere('frame', [x, yRail, 0], r * 1.3, NP),
        sphere('frame', [x, 0.018, -zf], r * 1.15, NP),
        sphere('frame', [x, 0.018, zf], r * 1.15, NP),
        rodZ('frame', x, yShelf - 0.012, -zf + 0.03, zf - 0.03, r * 0.75, NP),
        rodX('frame', x, x - sx * 0.03, yShelf - 0.012, 0, r * 0.75, NP),
      );
    }
    const W = Math.min(0.42, d - 0.03);
    parts.push(
      ...hangingRow(['clothes', 'accent', 'clothes'], 'frame', [-xs + r, xs - r], yRail, 0, W, yRail - 0.045 - yShelf - 0.2, ['shirt', 'shirt', 'coat', 'dress', 'knit'], 7, {
        pitch: 0.075,
        max: 16,
        hook: true,
      }),
    );
    // On the shelf: a folded stack at the left, shoes along the rest.
    const y0 = yShelf + 0.028;
    const stackW = 0.26;
    parts.push(...foldedStack(['clothes', 'accent'], -xs + r + 0.02 + stackW / 2, y0, 0, stackW, Math.min(0.26, d - 0.12), 3, 3));
    const sx0 = -xs + r + 0.06 + stackW;
    const sx1 = xs - r - 0.02;
    const pairs = clamp(Math.floor((sx1 - sx0) / 0.24), 1, 5);
    for (const [j, px] of spaced(pairs, sx0 + (sx1 - sx0) / (2 * pairs), sx1 - (sx1 - sx0) / (2 * pairs)).entries()) {
      parts.push(...shoePair(j % 2 === 0 ? 'accent' : 'clothes', px, y0, 0, Math.min(0.26, d - 0.1)));
    }
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w / 2 + 0.03, 0], [w / 2 - 0.03, 0]), rectPoly(-w / 2 + 0.05, -d / 2 + 0.04, w / 2 - 0.05, d / 2 - 0.04)],
});

const kidsWardrobe = defineItem({
  id: 'wardrobe-kids',
  name: 'Kids wardrobe',
  category: 'kids',
  type: 'storage',
  group: 'Wardrobes',
  tags: ['kids', 'children', 'wardrobe', 'house', 'playful', 'nursery', 'gable roof', 'closet'],
  defaultSize: { w: 0.9, d: 0.5, h: 1.75 },
  minSize: { w: 0.6, d: 0.4, h: 1.3 },
  maxSize: { w: 1.4, d: 0.6, h: 2.1 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Body & roof gable', 'painted-white'),
    matSlot('accent', 'Roof, panels & drawer', 'painted-mint'),
    matSlot('knobs', 'Knobs & feet', 'oak-veneer'),
  ],
  build: ({ w, d, h }) => {
    const feet = 0.07;
    const roofH = clamp(w * 0.36, 0.2, 0.42);
    const top = h - roofH;
    const ov = 0.025;
    const xi: V2 = [-w / 2 + ov, w / 2 - ov];
    const zC = d / 2 - 0.05;
    const t = 0.02;
    const zF = zC + t;
    const parts: Part[] = [
      span('body', xi, [feet, top], [-d / 2, zC]),
      facePlate(
        'body',
        [
          [xi[0], top],
          [xi[1], top],
          [0, h - 0.035],
        ],
        -d / 2,
        zF + d / 2,
      ),
      beamXY('accent', [-w / 2 + 0.012, top - 0.01], [0, h - 0.012], [-d / 2, zF + 0.012], 0.03),
      beamXY('accent', [w / 2 - 0.012, top - 0.01], [0, h - 0.012], [-d / 2, zF + 0.012], 0.03),
      sp('accent', xi, [top - 0.02, top], [zC, zF + 0.004]),
    ];
    // Chimney on the right slope.
    const cx = w * 0.2;
    const ys = top + roofH * (1 - cx / (w / 2));
    parts.push(sp('accent', [cx - 0.03, cx + 0.03], [ys - 0.03, Math.min(h, ys + 0.09)], [-0.07, 0.03]));
    // Round gable window with a cross muntin.
    const wy = top + roofH * 0.38;
    const wr = roofH * 0.17;
    parts.push(
      discZ('accent', [0, wy, zF + 0.004], wr, 0.008, NP),
      torus('body', [0, wy, zF + 0.006], wr, Math.min(0.007, wr * 0.2), NP),
      sp('body', [-0.004, 0.004], [wy - wr, wy + wr], [zF + 0.004, zF + 0.01]),
      sp('body', [-wr, wr], [wy - 0.004, wy + 0.004], [zF + 0.004, zF + 0.01]),
    );
    // Bun feet.
    for (const fx of [-1, 1]) {
      for (const fz of [-1, 1]) parts.push(turnedLeg('knobs', fx * (w / 2 - ov - 0.05), fz * (d / 2 - 0.08), 0, feet, 0.032, { style: 'bun' }));
    }
    // Wide bottom drawer and framed doors with a star on each panel.
    const dh = clamp((top - feet) * 0.16, 0.16, 0.24);
    parts.push(...shakerFront('accent', xi, [feet, feet + dh], zC, t, { rail: 0.04 }));
    for (const kx of spaced(2, xi[0] + (xi[1] - xi[0]) * 0.25, xi[1] - (xi[1] - xi[0]) * 0.25)) {
      parts.push(...knob('knobs', [kx, feet + dh / 2, zF], 0.017));
    }
    const n = clamp(Math.round((xi[1] - xi[0]) / 0.42), 1, 3);
    const dy: V2 = [feet + dh, top - 0.02];
    for (const [i, [a, b]] of cellSpans(n, xi[0], xi[1]).entries()) {
      parts.push(...framedFront('body', 'accent', [a, b], dy, zC, t, 0.05, 0.4));
      parts.push(star('body', (a + b) / 2, dy[1] - Math.min(0.2, (b - a) * 0.4), Math.min(0.06, (b - a) * 0.16), zC + t * 0.4, 0.006));
      parts.push(...knob('knobs', [n === 1 ? b - 0.05 : pullX(i, n, a, b, 0.05), (dy[0] + dy[1]) / 2, zF], 0.02));
    }
    return parts;
  },
  planDetail: ({ w, d }) => frontPlan(w, d / 2 - 0.025, clamp(Math.round((w - 0.05) / 0.42), 1, 3)),
});

// ---------------------------------------------------------------------------
// Chests
// ---------------------------------------------------------------------------

const tallboy = defineItem({
  id: 'tallboy',
  name: 'Tallboy chest',
  category: 'bedroom',
  type: 'storage',
  group: 'Dressers & chests',
  tags: ['tallboy', 'highboy', 'chest of drawers', 'drawers', 'mid-century', 'walnut', 'dresser'],
  defaultSize: { w: 0.65, d: 0.45, h: 1.3 },
  minSize: { w: 0.45, d: 0.38, h: 1.0 },
  maxSize: { w: 1.1, d: 0.55, h: 1.6 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Body & drawers', 'walnut-veneer'),
    matSlot('handle', 'Pulls & sabots', 'metal-brass'),
  ],
  build: ({ w, d, h }) => {
    const legH = clamp(h * 0.11, 0.1, 0.18);
    const topT = 0.025;
    const zC = d / 2 - 0.04;
    const zF = zC + 0.02;
    const xi: V2 = [-w / 2 + 0.012, w / 2 - 0.012];
    const parts: Part[] = [
      span('body', xi, [legH, h - topT], [-d / 2, zC]),
      span('body', [-w / 2, w / 2], [h - topT, h], [-d / 2, d / 2 - 0.004], { bevel: 0.008 }),
      sp('body', [xi[0] + 0.01, xi[1] - 0.01], [legH - 0.035, legH], [-d / 2 + 0.02, zC]),
    ];
    for (const fx of [-1, 1]) {
      for (const fz of [-1, 1]) {
        const x = fx * (w / 2 - 0.045);
        const z = fz * (d / 2 - 0.055);
        parts.push(turnedLeg('body', x, z, 0.02, legH, 0.022, { style: 'taper' }), vcyl('handle', x, z, 0, 0.022, 0.011, NP));
      }
    }
    const rows = clamp(Math.round((h - legH - topT) / 0.17), 4, 8);
    const y0 = legH + 0.006;
    const y1 = h - topT - 0.006;
    // Graduated drawers: deepest at the bottom.
    const weights = range(rows).map((k) => 1.25 - (0.45 * k) / (rows - 1));
    const total = weights.reduce((s, v) => s + v, 0);
    let y = y0;
    for (const [k, wt] of weights.entries()) {
      const yb = y + ((y1 - y0) * wt) / total;
      const split = k === rows - 1 && w > 0.55;
      const cols: V2[] = split ? cellSpans(2, xi[0], xi[1]) : [xi];
      for (const [a, b] of cols) {
        parts.push(sp('body', [a + 0.0015, b - 0.0015], [y + 0.0015, yb - 0.0015], [zC, zF], 0.004));
        const cy = (y + yb) / 2;
        if (split) parts.push(...knob('handle', [(a + b) / 2, cy, zF], 0.012));
        else parts.push(...barPull('handle', [(a + b) / 2, cy, zF], Math.min(0.22, (b - a) * 0.36), { stand: 0.02 }));
      }
      y = yb;
    }
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w / 2, d / 2 - 0.02], [w / 2, d / 2 - 0.02])],
});

const narrowChest = defineItem({
  id: 'lingerie-chest',
  name: 'Tall narrow chest',
  category: 'bedroom',
  type: 'storage',
  group: 'Dressers & chests',
  tags: ['lingerie chest', 'semainier', 'narrow', 'chest of drawers', 'seven drawers', 'tall', 'painted'],
  defaultSize: { w: 0.45, d: 0.38, h: 1.3 },
  minSize: { w: 0.35, d: 0.3, h: 1.0 },
  maxSize: { w: 0.7, d: 0.5, h: 1.6 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Body & drawers', 'painted-white'),
    matSlot('top', 'Top, base & feet', 'oak-veneer'),
    matSlot('knobs', 'Knobs', 'metal-brass'),
  ],
  build: ({ w, d, h }) => {
    const baseH = 0.09;
    const topT = 0.022;
    const t = 0.018;
    const zC = d / 2 - 0.042;
    const zF = zC + t;
    const xi: V2 = [-w / 2 + 0.014, w / 2 - 0.014];
    const parts: Part[] = [
      span('body', xi, [baseH, h - topT], [-d / 2, zC]),
      span('top', [-w / 2, w / 2], [h - topT, h], [-d / 2, d / 2 - 0.006], { bevel: 0.007 }),
      sp('top', [-w / 2 + 0.004, w / 2 - 0.004], [baseH - 0.03, baseH], [-d / 2, zF + 0.006], 0.005),
    ];
    // Bracket feet.
    for (const fx of [-1, 1]) {
      for (const fz of [-1, 1]) {
        const x = fx * (w / 2 - 0.035);
        const z = fz * (d / 2 - 0.04);
        parts.push(sp('top', [x - 0.028, x + 0.028], [0, baseH - 0.03], [z - 0.028, z + 0.028], 0.008));
      }
    }
    const rows = clamp(Math.round((h - baseH - topT) / 0.15), 5, 9);
    for (const [a, b] of cellSpans(rows, baseH + 0.004, h - topT - 0.004)) {
      parts.push(...shakerFront('body', xi, [a, b], zC, t, { rail: 0.026, recess: 0.005 }));
      const cy = (a + b) / 2;
      if (w > 0.55) {
        for (const kx of [-w * 0.22, w * 0.22]) parts.push(...knob('knobs', [kx, cy, zF], 0.011));
      } else {
        parts.push(...knob('knobs', [0, cy, zF], 0.012));
      }
    }
    return parts;
  },
});

// ---------------------------------------------------------------------------
// Display & living room cabinets
// ---------------------------------------------------------------------------

/** A shelf's worth of ceramics (and the odd glass vase) along x at floor height y0. */
function ceramicsRow(
  slots: { ceramic: string; glass: string },
  x: V2,
  y0: number,
  gap: number,
  zBack: number,
  zFront: number,
  seed: number,
): Part[] {
  const rand = rng(seed);
  const parts: Part[] = [];
  const k = clamp(Math.floor((x[1] - x[0]) / 0.16), 1, 6);
  const room = (zFront - zBack) / 2 - 0.008;
  const zc = (zBack + zFront) / 2;
  const hmax = gap - 0.02;
  if (hmax < 0.05) return parts;
  for (const [i, cx] of spaced(k, x[0] + (x[1] - x[0]) / (2 * k), x[1] - (x[1] - x[0]) / (2 * k)).entries()) {
    const kind = Math.floor(rand() * 5);
    const r = Math.min(room, 0.06, (x[1] - x[0]) / (2 * k) - 0.01);
    if (kind === 0 || kind === 1) {
      parts.push(vase(slots.ceramic, cx, y0, zc, r * lerp(0.75, 1, rand()), Math.min(hmax, 0.3) * lerp(0.7, 1, rand()), kind + i));
    } else if (kind === 2) {
      // Plate standing against the back with a small bowl in front.
      const pr = Math.min(0.11, hmax * 0.45, (x[1] - x[0]) / (2 * k) - 0.01);
      parts.push(discZ(slots.ceramic, [cx, y0 + pr, zBack + 0.012], pr, 0.012, NP));
      parts.push(pot(slots.ceramic, [cx, y0, Math.min(zFront - r * 0.8, zBack + 0.03 + r * 0.8)], r * 0.75, Math.min(hmax, r * 0.7), 'bowl', NP));
    } else if (kind === 3) {
      parts.push(pot(slots.ceramic, [cx, y0, zc], r * 0.85, Math.min(hmax, 0.2) * lerp(0.7, 1, rand()), 'belly', NP));
    } else {
      parts.push(vase(slots.glass, cx, y0, zc, r * 0.8, Math.min(hmax, 0.26) * lerp(0.7, 1, rand()), 2));
    }
  }
  return parts;
}

const vitrine = defineItem({
  id: 'vitrine',
  name: 'Glass vitrine cabinet',
  category: 'living',
  type: 'storage',
  group: 'Sideboards & cabinets',
  tags: ['vitrine', 'display cabinet', 'glass', 'curio', 'ceramics', 'showcase', 'hinged doors'],
  defaultSize: { w: 0.9, d: 0.42, h: 1.8 },
  minSize: { w: 0.5, d: 0.32, h: 1.2 },
  maxSize: { w: 1.6, d: 0.55, h: 2.2 },
  wallSnap: true,
  slots: [
    matSlot('frame', 'Frame', 'oak-veneer'),
    matSlot('glass', 'Glass', 'glass-clear'),
    matSlot('ceramic', 'Ceramics', 'ceramic-white'),
    matSlot('metal', 'Hinges & knobs', 'metal-brass'),
  ],
  build: ({ w, d, h }) => {
    const baseH = 0.1;
    const topH = 0.06;
    const post = 0.03;
    const t = 0.022;
    const zC = d / 2 - t - 0.016;
    const yTop = h - topH - 0.02;
    const parts: Part[] = [
      span('frame', [-w / 2, w / 2], [0, baseH], [-d / 2, d / 2 - 0.01], { bevel: 0.005 }),
      span('frame', [-w / 2, w / 2], [h - topH, h], [-d / 2, d / 2], { bevel: 0.006 }),
      sp('frame', [-w / 2 + 0.008, w / 2 - 0.008], [yTop, h - topH], [-d / 2, d / 2 - 0.012]),
      sp('frame', [-w / 2 + post, w / 2 - post], [baseH, yTop], [-d / 2, -d / 2 + 0.012]),
    ];
    for (const sx of [-1, 1]) {
      const xo = sx * (w / 2 - post / 2);
      parts.push(
        span('frame', [xo - post / 2, xo + post / 2], [baseH, yTop], [-d / 2, -d / 2 + post]),
        span('frame', [xo - post / 2, xo + post / 2], [baseH, yTop], [zC - post, zC]),
        sp('glass', sx < 0 ? [-w / 2 + 0.006, -w / 2 + 0.012] : [w / 2 - 0.012, w / 2 - 0.006], [baseH, yTop], [-d / 2 + post, zC - post]),
      );
    }
    // Glass shelves, evenly spaced.
    const ns = clamp(Math.round((yTop - baseH) / 0.38) - 1, 2, 5);
    const levels = [baseH, ...range(ns).map((k) => baseH + ((k + 1) * (yTop - baseH)) / (ns + 1))];
    for (const y of levels.slice(1)) parts.push(sp('glass', [-w / 2 + 0.014, w / 2 - 0.014], [y - 0.004, y + 0.004], [-d / 2 + 0.014, zC - 0.01]));
    for (const [k, y] of levels.entries()) {
      const next = k + 1 < levels.length ? levels[k + 1] - 0.004 : yTop;
      const floor = k === 0 ? y : y + 0.004;
      parts.push(...ceramicsRow({ ceramic: 'ceramic', glass: 'glass' }, [-w / 2 + 0.04, w / 2 - 0.04], floor, next - floor, -d / 2 + 0.014, zC - 0.012, 21 + k * 5));
    }
    // Glazed doors with visible hinges.
    const n = clamp(Math.round(w / 0.45), 1, 3);
    const dy: V2 = [baseH + 0.004, yTop - 0.002];
    for (const [i, [a, b]] of cellSpans(n, -w / 2 + 0.004, w / 2 - 0.004).entries()) {
      parts.push(...framedFront('frame', 'glass', [a, b], dy, zC, t, 0.035, 0.5));
      const hingeLeft = n === 1 || i % 2 === 0;
      const kx = hingeLeft ? b - 0.03 : a + 0.03;
      parts.push(...hinges('metal', hingeLeft ? a + 0.002 : b - 0.002, dy, zC + t + 0.003));
      parts.push(...knob('metal', [kx, (dy[0] + dy[1]) / 2, zC + t], 0.01));
    }
    return parts;
  },
  planDetail: ({ w, d }) => [rectPoly(-w / 2 + 0.03, -d / 2 + 0.03, w / 2 - 0.03, d / 2 - 0.05)],
});

const barCabinet = defineItem({
  id: 'bar-cabinet',
  name: 'Bar cabinet',
  category: 'living',
  type: 'storage',
  group: 'Sideboards & cabinets',
  tags: ['bar', 'drinks cabinet', 'cocktail', 'bottles', 'glasses', 'mid-century', 'lift-up lid', 'mirror'],
  defaultSize: { w: 1.0, d: 0.48, h: 1.32 },
  minSize: { w: 0.7, d: 0.4, h: 1.0 },
  maxSize: { w: 1.6, d: 0.6, h: 1.6 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Cabinet', 'walnut-veneer'),
    matSlot('brass', 'Brass fittings', 'metal-brass'),
    matSlot('glass', 'Bottles & glasses', 'glass-tinted'),
    matSlot('mirror', 'Mirror lining', 'glass-mirror'),
  ],
  build: ({ w, d, h }) => {
    const legH = clamp(h * 0.15, 0.14, 0.22);
    const lidT = 0.022;
    const Ld = d - 0.03;
    const bodyTop = clamp(h - Ld, legH + 0.45, h - 0.12);
    const Lh = h - bodyTop;
    const tilt = Lh >= Ld ? 0 : Math.acos(Lh / Ld);
    const zC = d / 2 - 0.045;
    const t = 0.022;
    const wellD = clamp(bodyTop - legH - 0.25, 0.12, 0.22);
    const wellFloor = bodyTop - wellD;
    const xi: V2 = [-w / 2 + 0.01, w / 2 - 0.01];
    const parts: Part[] = [
      span('body', xi, [legH, wellFloor], [-d / 2, zC]),
      sp('mirror', [xi[0] + 0.02, xi[1] - 0.02], [wellFloor - 0.004, wellFloor], [-d / 2 + 0.02, zC - 0.02]),
      span('body', xi, [wellFloor, bodyTop], [-d / 2, -d / 2 + 0.02]),
      sp('body', xi, [wellFloor, bodyTop], [zC - 0.02, zC]),
      sp('body', [xi[0], xi[0] + 0.02], [wellFloor, bodyTop], [-d / 2, zC]),
      sp('body', [xi[1] - 0.02, xi[1]], [wellFloor, bodyTop], [-d / 2, zC]),
      // Brass gallery rail along the front of the well.
      rodX('brass', xi[0] + 0.03, xi[1] - 0.03, bodyTop + 0.025, zC - 0.01, 0.004, NP),
      vcyl('brass', xi[0] + 0.03, zC - 0.01, bodyTop, bodyTop + 0.025, 0.004, NP),
      vcyl('brass', xi[1] - 0.03, zC - 0.01, bodyTop, bodyTop + 0.025, 0.004, NP),
    ];
    // Lift-up lid hinged at the back, mirror on its inner face.
    const up: V3 = [0, Math.cos(tilt), Math.sin(tilt)];
    const out: V3 = [0, -Math.sin(tilt), Math.cos(tilt)];
    const at = (along: number, off: number): V3 => [0, bodyTop + up[1] * along + out[1] * off, -d / 2 + 0.002 + up[2] * along + out[2] * off];
    parts.push(
      box('body', at(Ld / 2, lidT / 2), [w - 0.02, Ld, lidT], { rotation: [tilt, 0, 0], plan: false }),
      box('mirror', at(Ld / 2, lidT + 0.0015), [w - 0.09, Ld - 0.07, 0.003], { rotation: [tilt, 0, 0], plan: false }),
      vcyl('brass', xi[0] + 0.12, -d / 2 + 0.006, bodyTop - 0.005, bodyTop + 0.02, 0.006, NP),
      vcyl('brass', xi[1] - 0.12, -d / 2 + 0.006, bodyTop - 0.005, bodyTop + 0.02, 0.006, NP),
    );
    // Bottles in the back of the well, glasses on a mirrored tray at the front.
    const rand = rng(5);
    const kB = clamp(Math.floor((w - 0.1) / 0.1), 3, 10);
    const zB = -d / 2 + 0.02 + 0.05;
    for (const [i, x] of spaced(kB, xi[0] + 0.07, xi[1] - 0.07).entries()) {
      const hh = Math.min(lerp(0.26, 0.34, rand()), h - wellFloor - 0.01);
      parts.push(bottle('glass', x, wellFloor, zB + (i % 2) * 0.03, lerp(0.032, 0.04, rand()), hh, i));
    }
    const trayY = bodyTop - 0.11;
    const zG = zC - 0.02 - 0.06;
    parts.push(sp('mirror', [xi[0] + 0.03, xi[1] - 0.03], [trayY - 0.006, trayY], [zG - 0.05, zG + 0.05]));
    const kG = clamp(Math.floor((w - 0.1) / 0.09), 2, 8);
    for (const [i, x] of spaced(kG, xi[0] + 0.07, xi[1] - 0.07).entries()) {
      parts.push(drinkingGlass('glass', x, trayY, zG, i % 2 === 0 ? 0.033 : 0.04, i % 2 === 0 ? 0.09 : 0.15, i));
    }
    // Doors and tapered legs with brass sabots.
    const n = clamp(Math.round(w / 0.45), 2, 4);
    const ky = (legH + bodyTop) / 2 + 0.08;
    for (const [i, [a, b]] of cellSpans(n, xi[0], xi[1]).entries()) {
      parts.push(...shakerFront('body', [a, b], [legH + 0.004, bodyTop - 0.004], zC, t, { rail: 0.05 }));
      parts.push(...knob('brass', [pullX(i, n, a, b, 0.035), ky, zC + t], 0.012));
    }
    for (const fx of [-1, 1]) {
      for (const fz of [-1, 1]) {
        const x = fx * (w / 2 - 0.05);
        const z = fz * (d / 2 - 0.06);
        parts.push(turnedLeg('body', x, z, 0.03, legH, 0.02, { style: 'taper' }), vcyl('brass', x, z, 0, 0.032, 0.0095, NP));
      }
    }
    return parts;
  },
  planDetail: ({ w, d }) => [rectPoly(-w / 2 + 0.03, -d / 2 + 0.02, w / 2 - 0.03, d / 2 - 0.065), line([-w / 2, d / 2 - 0.045], [w / 2, d / 2 - 0.045])],
});

const caneSideboard = defineItem({
  id: 'cane-sideboard',
  name: 'Cane-front sideboard',
  category: 'living',
  type: 'storage',
  group: 'Sideboards & cabinets',
  tags: ['sideboard', 'credenza', 'cane', 'rattan', 'webbing', 'boho', 'mid-century', 'buffet'],
  defaultSize: { w: 1.6, d: 0.45, h: 0.78 },
  minSize: { w: 0.9, d: 0.38, h: 0.6 },
  maxSize: { w: 2.4, d: 0.55, h: 0.95 },
  wallSnap: true,
  slots: [
    matSlot('wood', 'Wood', 'oak-veneer'),
    matSlot('cane', 'Cane webbing', 'cane-natural'),
    matSlot('metal', 'Knobs', 'metal-brass'),
  ],
  build: ({ w, d, h }) => {
    const legH = clamp(h * 0.2, 0.1, 0.2);
    const topT = 0.03;
    const zC = d / 2 - 0.042;
    const t = 0.022;
    const parts: Part[] = [
      span('wood', [-w / 2 + 0.01, w / 2 - 0.01], [legH, h - topT], [-d / 2, zC]),
      span('wood', [-w / 2, w / 2], [h - topT, h], [-d / 2, d / 2 - 0.005], { bevel: 0.01 }),
      sp('wood', [-w / 2 + 0.01, w / 2 - 0.01], [legH, legH + 0.03], [zC, zC + t]),
    ];
    for (const x of spaced(w > 1.8 ? 3 : 2, -w / 2 + 0.07, w / 2 - 0.07)) {
      for (const z of [-(d / 2 - 0.07), d / 2 - 0.08]) parts.push(turnedLeg('wood', x, z, 0, legH, 0.022, { style: 'taper' }));
    }
    const n = clamp(Math.round(w / 0.42), 2, 6);
    const dy: V2 = [legH + 0.03, h - topT - 0.006];
    for (const [i, [a, b]] of cellSpans(n, -w / 2 + 0.01, w / 2 - 0.01).entries()) {
      parts.push(...framedFront('wood', 'cane', [a, b], dy, zC, t, 0.045, 0.45));
      parts.push(...knob('metal', [pullX(i, n, a, b, 0.03), (dy[0] + dy[1]) / 2, zC + t], 0.012));
    }
    return parts;
  },
  planDetail: ({ w, d }) => frontPlan(w, d / 2 - 0.02, clamp(Math.round(w / 0.42), 2, 6)),
});

const wallMedia = defineItem({
  id: 'wall-media-cabinet',
  name: 'Wall-hung media cabinet',
  category: 'living',
  type: 'storage',
  group: 'Media units',
  tags: ['media unit', 'tv unit', 'floating', 'wall-hung', 'fluted', 'reeded', 'console', 'tv stand'],
  mount: 'wall',
  defaultElevation: 0.3,
  defaultSize: { w: 1.8, d: 0.38, h: 0.38 },
  minSize: { w: 1.0, d: 0.3, h: 0.28 },
  maxSize: { w: 3.0, d: 0.5, h: 0.6 },
  slots: [
    matSlot('body', 'Carcass', 'oak-veneer'),
    matSlot('front', 'Fluted fronts', 'painted-charcoal'),
    matSlot('tech', 'Console & router', 'plastic-black'),
  ],
  build: ({ w, d, h }) => {
    const t = 0.018;
    const fz = 0.02;
    const zC = d / 2 - fz - 0.006;
    const ns = clamp(Math.round(w / 0.6), 2, 5);
    const open = Math.floor(ns / 2);
    const parts: Part[] = [
      span('body', [-w / 2, w / 2], [h - t, h], [-d / 2, d / 2]),
      span('body', [-w / 2, w / 2], [0, t], [-d / 2, d / 2]),
      span('body', [-w / 2, -w / 2 + t], [t, h - t], [-d / 2, d / 2]),
      span('body', [w / 2 - t, w / 2], [t, h - t], [-d / 2, d / 2]),
      sp('body', [-w / 2 + t, w / 2 - t], [t, h - t], [-d / 2, -d / 2 + 0.008]),
    ];
    const bounds = spaced(ns + 1, -w / 2 + t, w / 2 - t);
    for (const x of bounds.slice(1, -1)) parts.push(sp('body', [x - t / 2, x + t / 2], [t, h - t], [-d / 2, d / 2 - 0.004]));
    const fy: V2 = [t + 0.002, h - t - 0.002];
    for (const i of range(ns)) {
      const a = bounds[i] + (i > 0 ? t / 2 : 0);
      const b = bounds[i + 1] - (i < ns - 1 ? t / 2 : 0);
      if (i === open) {
        // Open niche: a games console and a router with aerials.
        const cx = (a + b) / 2;
        const ih = h - 2 * t;
        const cw = Math.min(0.3, b - a - 0.1);
        const ch = Math.min(0.07, ih * 0.35);
        const cd = Math.min(0.26, d - 0.1);
        parts.push(
          sp('tech', [cx - cw / 2 - 0.03, cx + cw / 2 - 0.03], [t, t + ch], [-d / 2 + 0.03, -d / 2 + 0.03 + cd], 0.008),
          sp('tech', [cx + cw / 2 - 0.02, cx + cw / 2 + 0.04], [t, t + Math.min(0.035, ih * 0.2)], [-d / 2 + 0.03, -d / 2 + 0.15], 0.006),
          rod('tech', [cx + cw / 2 - 0.01, t + 0.03, -d / 2 + 0.04], [cx + cw / 2 - 0.015, Math.min(h - t - 0.01, t + ih * 0.8), -d / 2 + 0.035], 0.003, NP),
          rod('tech', [cx + cw / 2 + 0.03, t + 0.03, -d / 2 + 0.04], [cx + cw / 2 + 0.035, Math.min(h - t - 0.01, t + ih * 0.8), -d / 2 + 0.035], 0.003, NP),
        );
        continue;
      }
      // Push-to-open flap with half-round reeding.
      parts.push(sp('front', [a + 0.002, b - 0.002], fy, [zC, zC + fz * 0.5]));
      const nf = clamp(Math.round((b - a) / 0.03), 6, 18);
      const pitch = (b - a - 0.006) / nf;
      for (const k of range(nf)) {
        parts.push(vcyl('front', a + 0.003 + (k + 0.5) * pitch, zC + fz * 0.5, fy[0] + 0.004, fy[1] - 0.004, pitch * 0.5, { segments: 10, plan: false }));
      }
    }
    return parts;
  },
});

const buffetHutch = defineItem({
  id: 'buffet-hutch',
  name: 'Buffet with hutch',
  category: 'dining',
  type: 'storage',
  group: 'Sideboards & cabinets',
  tags: ['buffet', 'hutch', 'dresser', 'welsh dresser', 'china cabinet', 'plates', 'glazed doors', 'farmhouse'],
  defaultSize: { w: 1.4, d: 0.5, h: 2.0 },
  minSize: { w: 0.9, d: 0.42, h: 1.7 },
  maxSize: { w: 2.2, d: 0.6, h: 2.3 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Painted body', 'painted-sage'),
    matSlot('top', 'Worktop & knobs', 'walnut-veneer'),
    matSlot('glass', 'Glass', 'glass-clear'),
    matSlot('plates', 'Plates & mugs', 'ceramic-white'),
  ],
  build: ({ w, d, h }) => {
    const pl = 0.08;
    const t = 0.022;
    const yTop = clamp(h * 0.45, 0.78, 0.92);
    const zC = d / 2 - 0.045;
    const xi: V2 = [-w / 2 + 0.015, w / 2 - 0.015];
    const parts: Part[] = [
      span('body', xi, [pl, yTop - 0.03], [-d / 2, zC]),
      sp('body', [xi[0] + 0.02, xi[1] - 0.02], [0, pl], [-d / 2 + 0.02, zC - 0.01]),
      span('top', [-w / 2, w / 2], [yTop - 0.03, yTop], [-d / 2, d / 2], { bevel: 0.008 }),
    ];
    const n = clamp(Math.round(w / 0.45), 2, 4);
    const dr: V2 = [yTop - 0.03 - 0.16, yTop - 0.034];
    for (const [i, [a, b]] of cellSpans(n, xi[0], xi[1]).entries()) {
      parts.push(
        ...shakerFront('body', [a, b], dr, zC, t, { rail: 0.035 }),
        ...knob('top', [(a + b) / 2, (dr[0] + dr[1]) / 2, zC + t], 0.013),
        ...shakerFront('body', [a, b], [pl, dr[0]], zC, t, { rail: 0.055 }),
        ...knob('top', [pullX(i, n, a, b), dr[0] - 0.08, zC + t], 0.014),
      );
    }
    // Hutch: open niche over the worktop, glazed cabinet above, cornice on top.
    const dh = clamp(d * 0.62, 0.26, 0.34);
    const hz: V2 = [-d / 2, -d / 2 + dh];
    const hx: V2 = [-w / 2 + 0.03, w / 2 - 0.03];
    const corH = 0.07;
    const yc = h - corH;
    const niche = clamp((yc - yTop) * 0.22, 0.18, 0.3);
    const yg = yTop + niche;
    const zG = hz[1] - t;
    const ysh = (yg + yc) / 2;
    parts.push(
      sp('body', hx, [yTop, yc], [hz[0], hz[0] + 0.012]),
      sp('body', [hx[0], hx[0] + 0.02], [yTop, yc], hz),
      sp('body', [hx[1] - 0.02, hx[1]], [yTop, yc], hz),
      sp('body', hx, [yg - 0.02, yg], [hz[0], zG]),
      sp('body', [hx[0] + 0.02, hx[1] - 0.02], [ysh - 0.009, ysh + 0.009], [hz[0] + 0.012, zG - 0.005]),
      sp('body', [hx[0] - 0.015, hx[1] + 0.015], [yc, yc + corH * 0.45], [hz[0], hz[1] + 0.012], 0.004),
      sp('body', [-w / 2, w / 2], [yc + corH * 0.45, h], [hz[0], hz[1] + 0.03], 0.006),
    );
    const ix: V2 = [hx[0] + 0.02, hx[1] - 0.02];
    // Plates standing on a groove behind a plate rail, on both levels.
    const kP = clamp(Math.floor((ix[1] - ix[0] - 0.04) / 0.2), 2, 9);
    for (const y of [yg, ysh + 0.009]) {
      const gap = y === yg ? ysh - 0.009 - yg : yc - ysh - 0.009;
      const pr = Math.min(0.11, gap * 0.42, (ix[1] - ix[0]) / (2 * kP) - 0.005);
      for (const x of spaced(kP, ix[0] + (ix[1] - ix[0]) / (2 * kP), ix[1] - (ix[1] - ix[0]) / (2 * kP))) {
        parts.push(discZ('plates', [x, y + pr, hz[0] + 0.024], pr, 0.012, NP));
      }
      parts.push(rodX('body', ix[0], ix[1], y + Math.min(0.04, pr * 0.5), hz[0] + 0.045, 0.004, NP));
    }
    const nh = clamp(Math.round((ix[1] - ix[0]) / 0.45), 2, 4);
    const gy: V2 = [yg, yc - 0.004];
    for (const [i, [a, b]] of cellSpans(nh, ix[0], ix[1]).entries()) {
      parts.push(...framedFront('body', 'glass', [a, b], gy, zG, t, 0.035, 0.5));
      // Glazing bars: one upright, two transoms.
      const mz: V2 = [zG + t * 0.35, zG + t * 0.8];
      parts.push(sp('body', [(a + b) / 2 - 0.007, (a + b) / 2 + 0.007], gy, mz));
      for (const f of [1 / 3, 2 / 3]) {
        const my = gy[0] + (gy[1] - gy[0]) * f;
        parts.push(sp('body', [a + 0.01, b - 0.01], [my - 0.007, my + 0.007], mz));
      }
      parts.push(...knob('top', [pullX(i, nh, a, b, 0.03), (gy[0] + gy[1]) / 2, zG + t], 0.011));
    }
    // Mugs in the open niche.
    const kM = clamp(Math.floor((ix[1] - ix[0]) / 0.3), 2, 5);
    const mugH = Math.min(0.095, niche - 0.04);
    for (const x of spaced(kM, ix[0] + 0.08, ix[1] - 0.12)) {
      const mz = hz[0] + 0.012 + 0.07;
      parts.push(cyl('plates', [x, yTop + mugH / 2, mz], 0.04, mugH, { plan: false }));
      parts.push(torus('plates', [x + 0.046, yTop + mugH * 0.55, mz], mugH * 0.24, 0.006, NP));
    }
    return parts;
  },
  planDetail: ({ w, d }) => [
    line([-w / 2, d / 2 - 0.023], [w / 2, d / 2 - 0.023]),
    line([-w / 2 + 0.03, -d / 2 + clamp(d * 0.62, 0.26, 0.34)], [w / 2 - 0.03, -d / 2 + clamp(d * 0.62, 0.26, 0.34)]),
  ],
});

// ---------------------------------------------------------------------------
// Storage, office & bathroom
// ---------------------------------------------------------------------------

const apothecary = defineItem({
  id: 'apothecary-cabinet',
  name: 'Apothecary cabinet',
  category: 'storage',
  type: 'storage',
  group: 'Sideboards & cabinets',
  tags: ['apothecary', 'chemist', 'drawers', 'multi-drawer', 'label holders', 'cup pulls', 'vintage', 'haberdashery'],
  defaultSize: { w: 0.9, d: 0.4, h: 1.2 },
  minSize: { w: 0.5, d: 0.3, h: 0.8 },
  maxSize: { w: 1.5, d: 0.5, h: 1.8 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Cabinet & drawers', 'walnut-veneer'),
    matSlot('brass', 'Label holders & cup pulls', 'metal-brass'),
    matSlot('labels', 'Label cards', 'label-card'),
  ],
  build: ({ w, d, h }) => {
    const baseH = 0.08;
    const topT = 0.03;
    const zC = d / 2 - 0.045;
    const ff = 0.025;
    const xi: V2 = [-w / 2 + 0.02, w / 2 - 0.02];
    const parts: Part[] = [
      span('body', xi, [baseH, h - topT], [-d / 2, zC]),
      span('body', [-w / 2, w / 2], [h - topT, h], [-d / 2, d / 2], { bevel: 0.008 }),
      sp('body', [-w / 2 + 0.006, w / 2 - 0.006], [0, baseH], [-d / 2, zC + 0.026], 0.006),
      sp('body', [xi[0], xi[0] + ff], [baseH, h - topT], [zC, zC + 0.02]),
      sp('body', [xi[1] - ff, xi[1]], [baseH, h - topT], [zC, zC + 0.02]),
      sp('body', xi, [h - topT - ff, h - topT], [zC, zC + 0.02]),
      sp('body', xi, [baseH, baseH + ff], [zC, zC + 0.02]),
    ];
    const gx: V2 = [xi[0] + ff, xi[1] - ff];
    const gy: V2 = [baseH + ff, h - topT - ff];
    const cols = clamp(Math.round((gx[1] - gx[0]) / 0.2), 2, 7);
    let rows = clamp(Math.round((gy[1] - gy[0]) / 0.15), 3, 10);
    while (cols * rows > 30) rows--;
    const zf = zC + 0.02;
    for (const [a, b] of cellSpans(cols, gx[0], gx[1])) {
      for (const [c, e] of cellSpans(rows, gy[0], gy[1])) {
        const cx = (a + b) / 2;
        const cy = (c + e) / 2;
        const lw = Math.min(0.065, (b - a) * 0.45);
        const lh = Math.min(0.03, (e - c) * 0.24);
        const ly = cy + 0.004;
        parts.push(
          sp('body', [a + 0.002, b - 0.002], [c + 0.002, e - 0.002], [zC + 0.002, zf], 0.002),
          sp('brass', [cx - lw / 2, cx + lw / 2], [ly, ly + lh], [zf, zf + 0.002]),
          sp('labels', [cx - lw / 2 + 0.004, cx + lw / 2 - 0.004], [ly + 0.004, ly + lh - 0.004], [zf + 0.002, zf + 0.003]),
          cupPull('brass', cx, cy - 0.008, zf, Math.min(0.022, (b - a) * 0.16, (e - c) * 0.28)),
        );
      }
    }
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w / 2 + 0.02, d / 2 - 0.025], [w / 2 - 0.02, d / 2 - 0.025])],
});

const shoeCabinet = defineItem({
  id: 'shoe-cabinet-tall',
  name: 'Tall shoe cabinet',
  category: 'storage',
  type: 'storage',
  group: 'Hallway storage',
  tags: ['shoe cabinet', 'shoe storage', 'louvred', 'ventilated', 'hallway', 'entryway', 'tall'],
  defaultSize: { w: 0.8, d: 0.36, h: 1.7 },
  minSize: { w: 0.5, d: 0.28, h: 1.1 },
  maxSize: { w: 1.4, d: 0.45, h: 2.1 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Body', 'painted-white'),
    matSlot('louvre', 'Louvred doors', 'oak-veneer'),
    matSlot('shoes', 'Shoes', 'leather-cognac'),
    matSlot('handle', 'Pulls', 'metal-black-matte'),
  ],
  build: ({ w, d, h }) => {
    const pl = 0.05;
    const topT = 0.022;
    const side = 0.018;
    const niche = clamp(h * 0.12, 0.16, 0.24);
    const zC = d / 2 - 0.045;
    const t = 0.022;
    const xi: V2 = [-w / 2 + side, w / 2 - side];
    const yN = pl + 0.018 + niche;
    const parts: Part[] = [
      span('body', [-w / 2, w / 2], [h - topT, h], [-d / 2, d / 2 - 0.01], { bevel: 0.006 }),
      span('body', [-w / 2, xi[0]], [0, h - topT], [-d / 2, d / 2 - 0.012]),
      span('body', [xi[1], w / 2], [0, h - topT], [-d / 2, d / 2 - 0.012]),
      sp('body', xi, [pl, h - topT], [-d / 2, -d / 2 + 0.01]),
      sp('body', xi, [0, pl], [-d / 2 + 0.02, d / 2 - 0.03]),
      sp('body', xi, [pl, pl + 0.018], [-d / 2, d / 2 - 0.012]),
      sp('body', xi, [yN, yN + 0.018], [-d / 2, d / 2 - 0.012]),
      sp('body', xi, [yN + 0.018, h - topT], [-d / 2, zC]),
    ];
    // Shoes in the open bottom niche.
    const pairs = clamp(Math.floor((xi[1] - xi[0]) / 0.25), 1, 5);
    const len = Math.min(0.26, d - 0.07);
    for (const px of spaced(pairs, xi[0] + (xi[1] - xi[0]) / (2 * pairs), xi[1] - (xi[1] - xi[0]) / (2 * pairs))) {
      parts.push(...shoePair('shoes', px, pl + 0.018, -0.006, len));
    }
    // Inset louvred doors (ventilation) with slim vertical pulls.
    const n = clamp(Math.round(w / 0.42), 1, 3);
    const dy: V2 = [yN + 0.02, h - topT - 0.003];
    const hy = clamp(1.0, dy[0] + 0.15, dy[1] - 0.15);
    for (const [i, [a, b]] of cellSpans(n, xi[0], xi[1]).entries()) {
      parts.push(...louvreFront('louvre', [a, b], dy, zC, t, Math.floor(96 / n), 0.05));
      const px = n === 1 ? b - 0.03 : pullX(i, n, a, b, 0.025);
      parts.push(...barPull('handle', [px, hy, zC + t], 0.16, { vertical: true, stand: 0.018, r: 0.0045 }));
    }
    return parts;
  },
  planDetail: ({ w, d }) => frontPlan(w, d / 2 - 0.023, clamp(Math.round(w / 0.42), 1, 3)),
});

const locker = defineItem({
  id: 'locker-cabinet',
  name: 'Metal locker cabinet',
  category: 'storage',
  type: 'storage',
  group: 'Office storage',
  tags: ['locker', 'metal', 'steel', 'industrial', 'gym', 'school', 'vented', 'two-tier'],
  defaultSize: { w: 0.9, d: 0.45, h: 1.8 },
  minSize: { w: 0.3, d: 0.35, h: 1.2 },
  maxSize: { w: 1.8, d: 0.6, h: 2.0 },
  wallSnap: true,
  slots: [
    matSlot('steel', 'Powder-coated steel', 'locker-steel'),
    matSlot('dark', 'Vents & plinth', 'metal-anthracite'),
    matSlot('handle', 'Handles', 'metal-chrome'),
    matSlot('plate', 'Number plates', 'metal-brass'),
  ],
  build: ({ w, d, h }) => {
    const base = 0.09;
    const zC = d / 2 - 0.03;
    const t = 0.012;
    const zF = zC + t;
    const cols = clamp(Math.round(w / 0.3), 1, 6);
    const tiers = h >= 1.7 ? 2 : 1;
    const parts: Part[] = [
      span('steel', [-w / 2, w / 2], [base, h], [-d / 2, zC]),
      sp('dark', [-w / 2 + 0.01, w / 2 - 0.01], [0, base], [-d / 2 + 0.01, zC - 0.01]),
      sp('steel', [-w / 2, w / 2], [h - 0.014, h], [zC - 0.002, zF + 0.004], 0.003),
    ];
    for (const [a, b] of cellSpans(cols, -w / 2 + 0.006, w / 2 - 0.006)) {
      for (const [ti, [y0, y1]] of cellSpans(tiers, base + 0.008, h - 0.018).entries()) {
        const cx = (a + b) / 2;
        parts.push(sp('steel', [a + 0.004, b - 0.004], [y0 + 0.004, y1 - 0.004], [zC, zF], 0.003));
        // Pressed vent slots near the top and bottom of every door.
        const vw = Math.min(0.14, (b - a) * 0.55);
        for (const k of range(3)) {
          for (const yv of [y1 - 0.05 - k * 0.022, y0 + 0.05 + k * 0.022]) {
            parts.push(sp('dark', [cx - vw / 2, cx + vw / 2], [yv - 0.005, yv + 0.005], [zF, zF + 0.002], 0.002));
          }
        }
        const hx = b - 0.035;
        const hy = tiers === 1 ? clamp(1.0, y0 + 0.2, y1 - 0.2) : ti === 0 ? y1 - 0.18 : y0 + 0.2;
        parts.push(
          sp('handle', [hx - 0.012, hx + 0.012], [hy - 0.045, hy + 0.045], [zF, zF + 0.006], 0.003),
          sp('handle', [hx - 0.004, hx + 0.004], [hy - 0.02, hy + 0.02], [zF + 0.006, zF + 0.016], 0.002),
          sp('plate', [cx - 0.022, cx + 0.022], [y1 - 0.135, y1 - 0.11], [zF, zF + 0.0015]),
        );
      }
    }
    return parts;
  },
  planDetail: ({ w, d }) => frontPlan(w, d / 2 - 0.018, clamp(Math.round(w / 0.3), 1, 6)),
});

const tallStorage = defineItem({
  id: 'storage-cabinet-tall',
  name: 'Tall storage cabinet',
  category: 'storage',
  type: 'storage',
  group: 'Sideboards & cabinets',
  tags: ['tall cabinet', 'cupboard', 'linen cupboard', 'baskets', 'drawers', 'shaker', 'storage'],
  defaultSize: { w: 0.8, d: 0.42, h: 1.9 },
  minSize: { w: 0.5, d: 0.35, h: 1.5 },
  maxSize: { w: 1.4, d: 0.6, h: 2.3 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Painted body', 'painted-navy'),
    matSlot('wood', 'Niche lining & knobs', 'oak-veneer'),
    matSlot('baskets', 'Baskets', 'rattan-natural'),
  ],
  build: ({ w, d, h }) => {
    const pl = 0.08;
    const corH = 0.06;
    const t = 0.022;
    const ov = 0.012;
    const zC = d / 2 - ov - 0.035;
    const zF = zC + t;
    const xi: V2 = [-w / 2 + ov, w / 2 - ov];
    const top = h - corH;
    const drH = clamp((top - pl) * 0.2, 0.3, 0.42);
    const yN0 = pl + drH;
    const nicheH = clamp((top - pl) * 0.17, 0.24, 0.34);
    const yN1 = yN0 + nicheH;
    const parts: Part[] = [
      span('body', xi, [pl, yN0], [-d / 2, zC]),
      span('body', xi, [yN1, top], [-d / 2, zC]),
      sp('body', [xi[0] + 0.02, xi[1] - 0.02], [0, pl], [-d / 2 + 0.02, zC - 0.01]),
      sp('body', [xi[0], xi[0] + 0.02], [yN0, yN1], [-d / 2, zF]),
      sp('body', [xi[1] - 0.02, xi[1]], [yN0, yN1], [-d / 2, zF]),
      sp('body', xi, [yN0, yN0 + 0.02], [-d / 2, zF]),
      sp('body', xi, [yN1 - 0.02, yN1], [-d / 2, zF]),
      sp('wood', [xi[0] + 0.02, xi[1] - 0.02], [yN0 + 0.02, yN1 - 0.02], [-d / 2, -d / 2 + 0.01]),
      ...cornice('body', w, d, top, h, ov),
    ];
    // Woven baskets in the open niche.
    const iw = xi[1] - xi[0] - 0.04;
    const k = clamp(Math.floor(iw / 0.32), 1, 4);
    const bw = iw / k - 0.02;
    const bh = Math.min(0.22, nicheH - 0.07);
    const bz: V2 = [-d / 2 + 0.02, Math.min(zF - 0.01, -d / 2 + 0.02 + 0.34)];
    for (const x of spaced(k, xi[0] + 0.02 + iw / (2 * k), xi[1] - 0.02 - iw / (2 * k))) {
      parts.push(
        sp('baskets', [x - bw / 2, x + bw / 2], [yN0 + 0.02, yN0 + 0.02 + bh], bz, 0.015),
        sp('baskets', [x - bw / 2 - 0.003, x + bw / 2 + 0.003], [yN0 + 0.02 + bh - 0.018, yN0 + 0.02 + bh], [bz[0] - 0.003, bz[1] + 0.003], 0.008),
      );
    }
    // Drawers below, doors above.
    const dc = w > 0.9 ? 2 : 1;
    for (const [a, b] of cellSpans(dc, xi[0], xi[1])) {
      for (const [c, e] of cellSpans(2, pl, yN0)) {
        parts.push(...shakerFront('body', [a, b], [c, e], zC, t, { rail: 0.04 }));
        parts.push(...knob('wood', [(a + b) / 2, (c + e) / 2, zF], 0.014));
      }
    }
    const n = clamp(Math.round(w / 0.45), 1, 3);
    for (const [i, [a, b]] of cellSpans(n, xi[0], xi[1]).entries()) {
      parts.push(...shakerFront('body', [a, b], [yN1, top], zC, t, { rail: 0.06 }));
      parts.push(...knob('wood', [n === 1 ? b - 0.04 : pullX(i, n, a, b), yN1 + 0.1, zF], 0.014));
    }
    return parts;
  },
  planDetail: ({ w, d }) => frontPlan(w, d / 2 - 0.025, clamp(Math.round(w / 0.45), 1, 3)),
});

type CredenzaBay = 'files' | 'open' | 'door';
const CREDENZA: Record<number, CredenzaBay[]> = {
  2: ['files', 'door'],
  3: ['files', 'open', 'door'],
  4: ['files', 'open', 'door', 'door'],
  5: ['files', 'door', 'open', 'door', 'files'],
};

const credenza = defineItem({
  id: 'filing-credenza',
  name: 'Office credenza',
  category: 'office',
  type: 'storage',
  group: 'Office storage',
  tags: ['credenza', 'office', 'file drawers', 'filing', 'low cabinet', 'books', 'executive'],
  defaultSize: { w: 1.6, d: 0.45, h: 0.66 },
  minSize: { w: 1.0, d: 0.38, h: 0.55 },
  maxSize: { w: 2.4, d: 0.55, h: 0.8 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Cabinet', 'painted-charcoal'),
    matSlot('top', 'Top', 'walnut-veneer'),
    matSlot('metal', 'Base, pulls & card holders', 'metal-brass'),
    matSlot('books', 'Books & files', 'book-mix'),
  ],
  build: ({ w, d, h }) => {
    const legH = 0.12;
    const topT = 0.03;
    const zC = d / 2 - 0.042;
    const t = 0.022;
    const zF = zC + t;
    const yT = h - topT;
    const parts: Part[] = [span('top', [-w / 2, w / 2], [yT, h], [-d / 2, d / 2 - 0.005], { bevel: 0.006 })];
    // Bent steel sled base.
    for (const sx of [-1, 1]) {
      const x = sx * (w / 2 - 0.08);
      parts.push(
        ...rodPath(
          'metal',
          [
            [x, legH, -d / 2 + 0.05],
            [x, 0.012, -d / 2 + 0.05],
            [x, 0.012, d / 2 - 0.07],
            [x, legH, d / 2 - 0.07],
          ],
          0.011,
        ),
      );
    }
    const ns = clamp(Math.round(w / 0.45), 2, 5);
    const kinds = CREDENZA[ns];
    const xs = spaced(ns + 1, -w / 2 + 0.01, w / 2 - 0.01);
    for (const x of xs) parts.push(span('body', [x - 0.009, x + 0.009], [legH, yT], [-d / 2, x === xs[0] || x === xs[ns] ? zF : zC]));
    for (const [i, kind] of kinds.entries()) {
      const a = xs[i] + 0.009;
      const b = xs[i + 1] - 0.009;
      const cx = (a + b) / 2;
      if (kind === 'open') {
        parts.push(
          span('body', [a, b], [legH, legH + 0.02], [-d / 2, zF]),
          span('body', [a, b], [yT - 0.02, yT], [-d / 2, zF]),
          sp('body', [a, b], [legH + 0.02, yT - 0.02], [-d / 2, -d / 2 + 0.015]),
          ...bookRow('books', [a + 0.015, b - 0.015], legH + 0.02, -d / 2 + 0.02, Math.min(0.26, yT - legH - 0.07), Math.min(0.22, d - 0.1), 31 + i, {
            fill: 0.8,
            lean: true,
          }),
        );
        continue;
      }
      parts.push(span('body', [a, b], [legH, yT], [-d / 2, zC]));
      if (kind === 'files') {
        for (const [c, e] of cellSpans(2, legH + 0.003, yT - 0.003)) {
          parts.push(
            sp('body', [a + 0.002, b - 0.002], [c + 0.002, e - 0.002], [zC, zF], 0.003),
            sp('metal', [cx - 0.04, cx + 0.04], [e - 0.06, e - 0.035], [zF, zF + 0.002], 0.001),
            ...barPull('metal', [cx, e - 0.085, zF], Math.min(0.18, (b - a) * 0.45), { stand: 0.02 }),
          );
        }
      } else {
        parts.push(sp('body', [a + 0.002, b - 0.002], [legH + 0.005, yT - 0.005], [zC, zF], 0.003));
        const px = i < ns / 2 ? b - 0.035 : a + 0.035;
        parts.push(...barPull('metal', [px, yT - 0.12, zF], Math.min(0.16, (yT - legH) * 0.35), { vertical: true, stand: 0.02 }));
      }
    }
    return parts;
  },
  planDetail: ({ w, d }) => frontPlan(w, d / 2 - 0.02, clamp(Math.round(w / 0.45), 2, 5)),
});

const bathCabinet = defineItem({
  id: 'vanity-cabinet-wall',
  name: 'Wall-hung bathroom cabinet',
  category: 'bathroom',
  type: 'storage',
  group: 'Sideboards & cabinets',
  tags: ['bathroom cabinet', 'wall cabinet', 'louvred', 'towels', 'toiletries', 'open shelf', 'cupboard'],
  mount: 'wall',
  defaultElevation: 1.15,
  defaultSize: { w: 0.6, d: 0.2, h: 0.75 },
  minSize: { w: 0.35, d: 0.14, h: 0.45 },
  maxSize: { w: 1.2, d: 0.3, h: 1.1 },
  slots: [
    matSlot('body', 'Cabinet & knobs', 'painted-white'),
    matSlot('door', 'Louvred doors', 'painted-sage'),
    matSlot('toiletry', 'Toiletries', 'ceramic-white'),
    matSlot('towel', 'Towels', 'fabric-white-cotton'),
  ],
  build: ({ w, d, h }) => {
    const t = 0.016;
    const ft = 0.018;
    const shelfH = clamp(h * 0.24, 0.13, 0.22);
    const zC = d / 2 - ft - 0.024;
    const xi: V2 = [-w / 2 + t, w / 2 - t];
    const parts: Part[] = [
      span('body', [-w / 2, w / 2], [h - t, h], [-d / 2, d / 2], { bevel: 0.003 }),
      span('body', [-w / 2, xi[0]], [0, h - t], [-d / 2, d / 2 - 0.004]),
      span('body', [xi[1], w / 2], [0, h - t], [-d / 2, d / 2 - 0.004]),
      span('body', xi, [0, t], [-d / 2, d / 2 - 0.004]),
      sp('body', xi, [shelfH, shelfH + t], [-d / 2, zC + ft]),
      sp('body', xi, [t, h - t], [-d / 2, -d / 2 + 0.008]),
    ];
    // Open shelf: rolled towels on the left, bottles on the right.
    const ih = shelfH - t;
    const rr = Math.min(0.04, ih / 2 - 0.006);
    const half = (xi[0] + xi[1]) / 2;
    const kT = clamp(Math.floor((half - xi[0] - 0.01) / (2 * rr + 0.008)), 1, 4);
    for (const x of spaced(kT, xi[0] + 0.008 + rr, half - rr - 0.004)) {
      parts.push(rodZ('towel', x, t + rr, -d / 2 + 0.014, d / 2 - 0.03, rr, NP));
    }
    const kB = clamp(Math.floor((xi[1] - half - 0.02) / 0.06), 1, 5);
    for (const [i, x] of spaced(kB, half + 0.035, xi[1] - 0.03).entries()) {
      const bh = Math.min(ih - 0.012, [0.16, 0.12, 0.19][i % 3]);
      parts.push(bottle('toiletry', x, t, -d / 2 + 0.008 + Math.min(0.06, d / 2 - 0.02), Math.min(0.024, d / 4), bh, i + 1));
    }
    // Inset louvred doors on top.
    const n = clamp(Math.round((xi[1] - xi[0]) / 0.32), 1, 3);
    const dy: V2 = [shelfH + t + 0.002, h - t - 0.002];
    for (const [i, [a, b]] of cellSpans(n, xi[0], xi[1]).entries()) {
      parts.push(...louvreFront('door', [a, b], dy, zC, ft, Math.floor(80 / n), 0.04));
      parts.push(...knob('body', [n === 1 ? b - 0.03 : pullX(i, n, a, b, 0.03), (dy[0] + dy[1]) / 2, zC + ft], 0.01));
    }
    return parts;
  },
});

const jewelleryArmoire = defineItem({
  id: 'jewelry-armoire',
  name: 'Jewellery armoire',
  category: 'bedroom',
  type: 'storage',
  group: 'Dressers & chests',
  tags: ['jewellery', 'jewelry', 'armoire', 'necklace doors', 'ring rolls', 'mirror lid', 'cabriole legs', 'drawers'],
  defaultSize: { w: 0.45, d: 0.34, h: 1.05 },
  minSize: { w: 0.35, d: 0.28, h: 0.85 },
  maxSize: { w: 0.7, d: 0.45, h: 1.3 },
  wallSnap: true,
  slots: [
    matSlot('wood', 'Wood', 'wood-cherry'),
    matSlot('velvet', 'Velvet lining', 'fabric-velvet-navy'),
    matSlot('mirror', 'Lid mirror', 'glass-mirror'),
    matSlot('brass', 'Knobs & hinges', 'metal-brass'),
  ],
  build: ({ w, d, h }) => {
    const legH = clamp(h * 0.16, 0.12, 0.2);
    const lidT = 0.018;
    const Ld = d - 0.03;
    const bodyTop = clamp(h - Ld, legH + 0.45, h - 0.1);
    const Lh = h - bodyTop;
    const tilt = Lh >= Ld ? 0 : Math.acos(Lh / Ld);
    const sideIn = 0.03;
    const zC = d / 2 - 0.035;
    const zF = zC + 0.018;
    const xi: V2 = [-w / 2 + sideIn, w / 2 - sideIn];
    const yTray = bodyTop - 0.05;
    const parts: Part[] = [
      span('wood', xi, [legH, yTray], [-d / 2, zC]),
      // Shallow velvet-lined tray with ring rolls under the lid.
      sp('wood', [-w / 2 + 0.012, w / 2 - 0.012], [yTray, bodyTop], [-d / 2, -d / 2 + 0.014]),
      sp('wood', [-w / 2 + 0.012, w / 2 - 0.012], [yTray, bodyTop], [zC - 0.008, zF + 0.004], 0.003),
      sp('wood', [-w / 2 + 0.012, -w / 2 + 0.026], [yTray, bodyTop], [-d / 2, zC]),
      sp('wood', [w / 2 - 0.026, w / 2 - 0.012], [yTray, bodyTop], [-d / 2, zC]),
      sp('velvet', [-w / 2 + 0.026, w / 2 - 0.026], [yTray, yTray + 0.008], [-d / 2 + 0.014, zC - 0.008]),
      sp('wood', [xi[0] + 0.006, xi[1] - 0.006], [legH - 0.04, legH], [-d / 2 + 0.02, zC + 0.006], 0.004),
    ];
    const nR = clamp(Math.floor((zC - 0.008 - (-d / 2 + 0.014)) / 0.026), 3, 9);
    for (const z of spaced(nR, -d / 2 + 0.028, zC - 0.022)) parts.push(rodX('velvet', -w / 2 + 0.03, w / 2 - 0.03, yTray + 0.018, z, 0.0105, NP));
    // Lift-up lid with a mirror inside, hinged at the back.
    const up: V3 = [0, Math.cos(tilt), Math.sin(tilt)];
    const out: V3 = [0, -Math.sin(tilt), Math.cos(tilt)];
    const at = (along: number, off: number): V3 => [0, bodyTop + up[1] * along + out[1] * off, -d / 2 + 0.002 + up[2] * along + out[2] * off];
    parts.push(
      box('wood', at(Ld / 2, lidT / 2), [w - 0.024, Ld, lidT], { rotation: [tilt, 0, 0], plan: false }),
      box('mirror', at(Ld / 2, lidT + 0.0015), [w - 0.07, Ld - 0.05, 0.003], { rotation: [tilt, 0, 0], plan: false }),
      vcyl('brass', -w * 0.25, -d / 2 + 0.006, bodyTop - 0.012, bodyTop + 0.012, 0.005, NP),
      vcyl('brass', w * 0.25, -d / 2 + 0.006, bodyTop - 0.012, bodyTop + 0.012, 0.005, NP),
    );
    // Front drawers with tiny knobs.
    const rows = clamp(Math.round((yTray - legH - 0.02) / 0.1), 3, 7);
    for (const [a, b] of cellSpans(rows, legH + 0.004, yTray - 0.004)) {
      parts.push(sp('wood', [xi[0] + 0.002, xi[1] - 0.002], [a + 0.002, b - 0.002], [zC, zF], 0.003));
      parts.push(...knob('brass', [0, (a + b) / 2, zF], 0.009));
    }
    // Necklace doors on both sides: raised panel, knob at the front, hinges at the back.
    for (const sx of [-1, 1]) {
      const xo: V2 = sx < 0 ? [-w / 2 + 0.012, xi[0]] : [xi[1], w / 2 - 0.012];
      const xp: V2 = sx < 0 ? [-w / 2 + 0.006, -w / 2 + 0.012] : [w / 2 - 0.012, w / 2 - 0.006];
      const dy: V2 = [legH + 0.02, yTray - 0.012];
      const dz: V2 = [-d / 2 + 0.015, zC - 0.004];
      parts.push(
        sp('wood', xo, dy, dz, 0.003),
        sp('wood', xp, [dy[0] + 0.04, dy[1] - 0.04], [dz[0] + 0.03, dz[1] - 0.03], 0.002),
        sphere('brass', [sx * (w / 2 - 0.006), (dy[0] + dy[1]) / 2, dz[1] - 0.025], 0.007, NP),
        ...hinges('brass', sx * (w / 2 - 0.012), dy, dz[0] + 0.004),
      );
    }
    // Cabriole legs.
    for (const fx of [-1, 1]) {
      for (const fz of [-1, 1]) parts.push(turnedLeg('wood', fx * (w / 2 - sideIn - 0.022), fz * (d / 2 - 0.05), 0, legH, 0.022, { style: 'cabriole' }));
    }
    return parts;
  },
});

const cornerCurio = defineItem({
  id: 'curio-cabinet-corner',
  name: 'Corner curio cabinet',
  category: 'living',
  type: 'storage',
  group: 'Sideboards & cabinets',
  tags: ['curio', 'corner', 'display cabinet', 'glass', 'mirrored back', 'ornaments', 'china', 'collectibles'],
  defaultSize: { w: 0.75, d: 0.75, h: 1.8 },
  minSize: { w: 0.5, d: 0.5, h: 1.2 },
  maxSize: { w: 1.1, d: 1.1, h: 2.2 },
  wallSnap: true,
  slots: [
    matSlot('wood', 'Wood', 'walnut-veneer'),
    matSlot('glass', 'Glass', 'glass-clear'),
    matSlot('mirror', 'Mirrored back', 'glass-mirror'),
    matSlot('ornament', 'Ornaments', 'ceramic-white'),
  ],
  build: ({ w, d, h }) => {
    const sd = clamp(Math.min(w, d) * 0.16, 0.08, 0.16);
    const baseH = 0.1;
    const crownH = 0.08;
    const yTop = h - crownH;
    const outline: V2[] = [
      [-w / 2, -d / 2],
      [w / 2, -d / 2],
      [w / 2, -d / 2 + sd],
      [-w / 2 + sd, d / 2],
      [-w / 2, d / 2],
    ];
    const C: V2 = [w / 2, -d / 2 + sd];
    const D: V2 = [-w / 2 + sd, d / 2];
    const L = Math.hypot(C[0] - D[0], C[1] - D[1]);
    const ux = (C[0] - D[0]) / L;
    const uz = (C[1] - D[1]) / L;
    const theta = Math.atan2(-uz, ux);
    const t = 0.022;
    const parts: Part[] = [
      prism('wood', outline, 0, baseH),
      prism('wood', outline, yTop, crownH, NP),
      sp('mirror', [-w / 2 + 0.012, w / 2 - 0.03], [baseH, yTop], [-d / 2, -d / 2 + 0.006]),
      sp('mirror', [-w / 2, -w / 2 + 0.006], [baseH, yTop], [-d / 2 + 0.012, d / 2 - 0.03]),
      sp('glass', [w / 2 - 0.006, w / 2], [baseH, yTop], [-d / 2 + 0.006, -d / 2 + sd - 0.03]),
      sp('glass', [-w / 2 + 0.006, -w / 2 + sd - 0.03], [baseH, yTop], [d / 2 - 0.006, d / 2]),
      span('wood', [w / 2 - 0.03, w / 2], [baseH, yTop], [C[1] - 0.03, C[1]]),
      span('wood', [D[0] - 0.03, D[0]], [baseH, yTop], [d / 2 - 0.03, d / 2]),
      span('wood', [-w / 2, -w / 2 + 0.02], [baseH, yTop], [-d / 2, -d / 2 + 0.02]),
    ];
    // Diagonal glazed door(s), built facing +z and turned to the 45° front.
    const n = L > 0.8 ? 2 : 1;
    const dy: V2 = [baseH + 0.003, yTop - 0.003];
    const local: Part[] = [
      sp('wood', [-L / 2 + 0.01, L / 2 - 0.01], [yTop, yTop + crownH * 0.55], [-0.02, 0.012], 0.004),
      sp('wood', [-L / 2 + 0.01, L / 2 - 0.01], [baseH - 0.03, baseH], [-0.02, 0.008], 0.004),
    ];
    for (const [i, [a, b]] of cellSpans(n, -L / 2 + 0.035, L / 2 - 0.035).entries()) {
      local.push(...framedFront('wood', 'glass', [a, b], dy, -t, t, 0.04, 0.5));
      const hingeLeft = i === 0;
      local.push(...hinges('ornament', hingeLeft ? a - 0.002 : b + 0.002, dy, -0.004));
      local.push(sphere('wood', [hingeLeft ? b - 0.03 : a + 0.03, (dy[0] + dy[1]) / 2, 0.012], 0.012, { scale: [1, 1, 0.8], plan: false }));
    }
    parts.push(...placeY(local, theta, (C[0] + D[0]) / 2, (C[1] + D[1]) / 2));
    // Glass shelves following the cabinet outline.
    const shelf: V2[] = [
      [-w / 2 + 0.008, -d / 2 + 0.008],
      [w / 2 - 0.02, -d / 2 + 0.008],
      [w / 2 - 0.02, -d / 2 + sd - 0.025],
      [-w / 2 + sd - 0.025, d / 2 - 0.02],
      [-w / 2 + 0.008, d / 2 - 0.02],
    ];
    const ns = clamp(Math.round((yTop - baseH) / 0.38) - 1, 2, 5);
    const levels = [baseH, ...range(ns).map((k) => baseH + ((k + 1) * (yTop - baseH)) / (ns + 1))];
    for (const y of levels.slice(1)) parts.push(prism('glass', shelf, y - 0.004, 0.008, NP));
    // Ornaments in a row parallel to the doors, nearer the back corner.
    const rand = rng(17);
    const k = clamp(Math.floor(L / 0.22), 2, 4);
    for (const [li, y] of levels.entries()) {
      const top = (li + 1 < levels.length ? levels[li + 1] - 0.004 : yTop) - 0.02;
      const y0 = li === 0 ? y : y + 0.004;
      const hmax = top - y0;
      for (const [j, f] of spaced(k, 0.25, 0.75).entries()) {
        const px = -w / 2 + (D[0] + f * (C[0] - D[0]) + w / 2) * 0.55;
        const pz = -d / 2 + (D[1] + f * (C[1] - D[1]) + d / 2) * 0.55;
        const kind = (j + li) % 3;
        if (kind === 0) {
          parts.push(vase('ornament', px, y0, pz, 0.045, Math.min(hmax, 0.26) * lerp(0.75, 1, rand()), li + j));
        } else if (kind === 1) {
          const pr = Math.min(0.09, hmax * 0.45);
          parts.push(cyl('ornament', [px, y0 + pr, pz], pr, 0.012, { rotation: [Math.PI / 2, 0, -theta], plan: false }));
        } else {
          const fh = Math.min(hmax, 0.2) * lerp(0.7, 1, rand());
          parts.push(
            lathe(
              'ornament',
              [px, y0, pz],
              [
                [0, 0],
                [0.035, 0],
                [0.03, fh * 0.1],
                [0.018, fh * 0.7],
                [0, fh * 0.72],
              ],
              { segments: 16, plan: false },
            ),
            sphere('ornament', [px, y0 + fh * 0.84, pz], fh * 0.13, NP),
          );
        }
      }
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const sd = clamp(Math.min(w, d) * 0.16, 0.08, 0.16);
    return [line([w / 2 - 0.02, -d / 2 + sd - 0.015], [-w / 2 + sd - 0.015, d / 2 - 0.02])];
  },
});

// ---------------------------------------------------------------------------
// Patterns
// ---------------------------------------------------------------------------

/** Periodic value noise on an N×N tile with px × py lattice cells (wraps seamlessly), in [-1, 1]. */
function tileNoise(N: number, px: number, py: number, rand: () => number): Float32Array {
  const PX = Math.max(1, Math.round(px));
  const PY = Math.max(1, Math.round(py));
  const lat = new Float32Array(PX * PY);
  for (let i = 0; i < lat.length; i++) lat[i] = rand() * 2 - 1;
  const axis = (P: number) => {
    const i0 = new Int32Array(N);
    const i1 = new Int32Array(N);
    const tt = new Float32Array(N);
    for (let x = 0; x < N; x++) {
      const u = ((x + 0.5) * P) / N;
      const i = Math.floor(u);
      const f = u - i;
      tt[x] = f * f * (3 - 2 * f);
      i0[x] = i % P;
      i1[x] = (i + 1) % P;
    }
    return { i0, i1, tt };
  };
  const ax = axis(PX);
  const ay = axis(PY);
  const out = new Float32Array(N * N);
  for (let y = 0; y < N; y++) {
    const r0 = ay.i0[y] * PX;
    const r1 = ay.i1[y] * PX;
    const ty = ay.tt[y];
    for (let x = 0; x < N; x++) {
      const a = lat[r0 + ax.i0[x]] + (lat[r1 + ax.i0[x]] - lat[r0 + ax.i0[x]]) * ty;
      const b = lat[r0 + ax.i1[x]] + (lat[r1 + ax.i1[x]] - lat[r0 + ax.i1[x]]) * ty;
      out[y * N + x] = a + (b - a) * ax.tt[x];
    }
  }
  return out;
}

/** A few octaves of tileNoise, roughly in [-1, 1]. */
function tileFbm(N: number, px: number, py: number, octaves: number, rand: () => number): Float32Array {
  const out = new Float32Array(N * N);
  let amp = 1;
  let total = 0;
  for (let o = 0; o < octaves; o++) {
    const n = tileNoise(N, px * 2 ** o, py * 2 ** o, rand);
    for (let i = 0; i < out.length; i++) out[i] += n[i] * amp;
    total += amp;
    amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

const smooth = (e0: number, e1: number, x: number): number => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Write a grey (luminance) field to the canvas. */
function putGrey(ctx: CanvasRenderingContext2D, N: number, L: Float32Array): void {
  const img = ctx.createImageData(N, N);
  for (let i = 0; i < L.length; i++) {
    const v = Math.round(clamp(L[i], 0, 1) * 255);
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

const crownVeneer = {
  id: 'crown-veneer',
  name: 'Crown-cut veneer',
  normalStrength: 0.3,
  // Vertical grain with nested cathedral arches (K per tile height, mirrored across the tile), pore dashes and fibre streaks.
  draw(ctx: CanvasRenderingContext2D, size: number, rand: () => number) {
    const N = size;
    const warp = tileFbm(N, 2, 3, 3, rand);
    const wobble = tileNoise(N, 10, 3, rand);
    const fibre = tileNoise(N, 140, 4, rand);
    const band = tileFbm(N, 5, 2, 2, rand);
    const pores = tileNoise(N, 90, 24, rand);
    const L = new Float32Array(N * N);
    const R = 11;
    const K = 2;
    for (let y = 0; y < N; y++) {
      const v = (y + 0.5) / N;
      for (let x = 0; x < N; x++) {
        const i = y * N + x;
        const u = (x + 0.5) / N;
        const ph = (R * (1 - Math.cos(Math.PI * 2 * u))) / 2 - K * v + 0.7 * warp[i] + 0.12 * wobble[i];
        const p = ph - Math.floor(ph);
        const late = smooth(0.52, 0.78, p) * (1 - smooth(0.86, 0.98, p));
        const pore = pores[i] > 0.55 ? (pores[i] - 0.55) * 0.22 : 0;
        L[i] = 0.86 - 0.17 * late + 0.045 * band[i] + 0.03 * fibre[i] - pore * (0.6 + late);
      }
    }
    putGrey(ctx, N, L);
  },
};

const brushPaint = {
  id: 'brush-paint',
  name: 'Brushed paint',
  normalStrength: 0.25,
  // Painted MDF: faint vertical bristle lines, soft lap marks and a fine speckle.
  draw(ctx: CanvasRenderingContext2D, size: number, rand: () => number) {
    const N = size;
    const bristle = tileNoise(N, 180, 3, rand);
    const strokes = tileNoise(N, 36, 2, rand);
    const laps = tileFbm(N, 3, 4, 2, rand);
    const speck = tileNoise(N, 160, 160, rand);
    const L = new Float32Array(N * N);
    for (let i = 0; i < L.length; i++) {
      L[i] = 0.92 + 0.028 * bristle[i] + 0.016 * strokes[i] + 0.02 * laps[i] - (speck[i] > 0.8 ? 0.03 : 0);
    }
    putGrey(ctx, N, L);
  },
};

const caneWebbing = {
  id: 'cane-webbing',
  name: 'Cane webbing',
  normalStrength: 1.1,
  colored: true,
  // Seven-step cane: vertical and horizontal strand pairs with two diagonal strands, leaving
  // octagonal holes (dark: the cabinet interior behind). Strands are shaded round with fibre streaks.
  draw(ctx: CanvasRenderingContext2D, size: number, rand: () => number) {
    const N = size;
    const n = 10;
    const fibV = tileNoise(N, 6, 90, rand);
    const fibH = tileNoise(N, 90, 6, rand);
    const tone = tileFbm(N, 4, 4, 2, rand);
    const img = ctx.createImageData(N, N);
    const PW = 0.15;
    const SW = PW / 2;
    const DW = 0.055;
    const honey = [0.88, 0.71, 0.45];
    const hole = [0.14, 0.095, 0.06];
    for (let y = 0; y < N; y++) {
      const gy = ((y + 0.5) / N) * n;
      const fy = gy - Math.floor(gy);
      const dh = Math.min(fy, 1 - fy);
      for (let x = 0; x < N; x++) {
        const i = y * N + x;
        const gx = ((x + 0.5) / N) * n;
        const fx = gx - Math.floor(gx);
        const dv = Math.min(fx, 1 - fx);
        const a = gx + gy - 0.5;
        const b = gx - gy - 0.5;
        const da = Math.abs(a - Math.round(a)) * Math.SQRT1_2;
        const db = Math.abs(b - Math.round(b)) * Math.SQRT1_2;
        const inV = dv < PW;
        const inH = dh < PW;
        const inA = da < DW;
        const inB = db < DW;
        let shade = -1;
        let fib = 0;
        if (inA || inB) {
          // Diagonals ride on top; at their crossings they alternate over/under.
          const aTop = inA && (!inB || (Math.round(a) + Math.round(b)) % 2 === 0);
          const q = (aTop ? da : db) / DW;
          shade = Math.sqrt(Math.max(0, 1 - q * q));
          fib = (fibV[i] + fibH[i]) * 0.5;
        } else if (inV || inH) {
          const vTop = inV && (!inH || (Math.round(gx) + Math.round(gy)) % 2 === 0);
          const q = Math.abs((vTop ? dv : dh) - SW) / SW;
          shade = Math.sqrt(Math.max(0, 1 - q * q));
          fib = vTop ? fibV[i] : fibH[i];
          // Shadow where a pair dives under a diagonal.
          const near = Math.min(da, db) / DW;
          if (near < 1.6) shade *= 0.75 + 0.25 * (near - 1) / 0.6;
        }
        let r: number;
        let g: number;
        let bl: number;
        if (shade < 0) {
          const k = 0.9 + 0.1 * tone[i];
          r = hole[0] * k;
          g = hole[1] * k;
          bl = hole[2] * k;
        } else {
          const k = (0.52 + 0.48 * shade) * (1 + 0.09 * fib + 0.06 * tone[i]);
          r = honey[0] * k;
          g = honey[1] * k;
          bl = honey[2] * k;
        }
        img.data[i * 4] = Math.round(clamp(r, 0, 1) * 255);
        img.data[i * 4 + 1] = Math.round(clamp(g, 0, 1) * 255);
        img.data[i * 4 + 2] = Math.round(clamp(bl, 0, 1) * 255);
        img.data[i * 4 + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  },
};

// ---------------------------------------------------------------------------
// Pack
// ---------------------------------------------------------------------------

export default definePack({
  name: 'Cabinets & wardrobes',
  version: '1.0.0',
  author: 'Neest team',
  description:
    'Wardrobes (sliding, mirrored, corner, built-in, walk-in, open rack, kids), chests, vitrines, bar and media cabinets, apothecary drawers, lockers and more, with real joinery and visible contents.',
  license: 'CC0 (made for Neest)',
  items: [
    slidingWardrobe,
    mirroredWardrobe,
    cornerWardrobe,
    builtinWardrobe,
    walkInCloset,
    openRack,
    kidsWardrobe,
    tallboy,
    narrowChest,
    vitrine,
    barCabinet,
    caneSideboard,
    wallMedia,
    buffetHutch,
    apothecary,
    shoeCabinet,
    locker,
    tallStorage,
    credenza,
    bathCabinet,
    jewelleryArmoire,
    cornerCurio,
  ],
  patterns: [crownVeneer, brushPaint, caneWebbing],
  materials: [
    { id: 'walnut-veneer', name: 'Walnut veneer (crown cut)', category: 'wood', color: '#6a4630', roughness: 0.5, pattern: { id: 'crown-veneer', scale: 0.7, contrast: 0.9 } },
    { id: 'oak-veneer', name: 'Oak veneer (crown cut)', category: 'wood', color: '#c9a273', roughness: 0.55, pattern: { id: 'crown-veneer', scale: 0.7, contrast: 0.7 } },
    { id: 'painted-white', name: 'Painted MDF, chalk white', category: 'paint', color: '#ebe7de', roughness: 0.7, pattern: { id: 'brush-paint', scale: 0.6, contrast: 0.9 } },
    { id: 'painted-sage', name: 'Painted MDF, sage', category: 'paint', color: '#9aa891', roughness: 0.7, pattern: { id: 'brush-paint', scale: 0.6, contrast: 0.9 } },
    { id: 'painted-navy', name: 'Painted MDF, ink blue', category: 'paint', color: '#2f3d56', roughness: 0.65, pattern: { id: 'brush-paint', scale: 0.6, contrast: 0.9 } },
    { id: 'painted-charcoal', name: 'Painted MDF, charcoal', category: 'paint', color: '#3b3c3f', roughness: 0.65, pattern: { id: 'brush-paint', scale: 0.6, contrast: 0.9 } },
    { id: 'painted-blush', name: 'Painted MDF, blush', category: 'paint', color: '#e4b8ac', roughness: 0.7, pattern: { id: 'brush-paint', scale: 0.6, contrast: 0.9 } },
    { id: 'painted-mint', name: 'Painted MDF, mint', category: 'paint', color: '#a7d3c2', roughness: 0.7, pattern: { id: 'brush-paint', scale: 0.6, contrast: 0.9 } },
    { id: 'cane-natural', name: 'Cane webbing, natural', category: 'wood', color: '#ffffff', roughness: 0.7, pattern: { id: 'cane-webbing', scale: 0.16 } },
    { id: 'cane-ebonised', name: 'Cane webbing, ebonised', category: 'wood', color: '#6e625a', roughness: 0.65, pattern: { id: 'cane-webbing', scale: 0.16 } },
    { id: 'locker-steel', name: 'Powder-coated steel, grey-green', category: 'metal', color: '#87958f', roughness: 0.45, metalness: 0.35, pattern: { id: 'brushed', scale: 0.4, contrast: 0.25 } },
    { id: 'label-card', name: 'Label card', category: 'solid', color: '#efe5cc', roughness: 0.9 },
  ],
});

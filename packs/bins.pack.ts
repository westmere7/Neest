/**
 * Bins — 36 waste and recycling bins for every room: kitchen pedal bins (round, rectangular and
 * D-shaped, 12–45 L, soft-close, butterfly lid, bamboo lid), touchless motion-sensor bins, a
 * dual-compartment recycling pedal bin, a slim gap bin, swing-lid bins, a countertop compost caddy, a
 * door-hung under-sink bin, stacking recycling crates, a three-bin recycling station and Japanese
 * stacking sorting bins; small bathroom pedal and sensor bins; wastebaskets in rattan, seagrass, cane,
 * teak, ceramic, brass wire, steel mesh and leather; office bins; and outdoor wheelie bins (120 L and
 * 240 L) with a public-style twin recycling bin. Vietnamese names in the tags (thùng rác, thùng rác
 * đạp chân, thùng rác cảm ứng, thùng rác nắp lật).
 *
 * Local space: origin at the centre of the footprint on the floor, +z is the front. Lids are shown
 * closed. Round bins size their body from the smaller of width and depth (less the pedal) so they stay
 * inside the box at any size.
 */
import {
  arcPoints,
  box,
  cellSpans,
  clamp,
  cyl,
  defineItem,
  definePack,
  discZ,
  lathe,
  lerp,
  matSlot,
  prism,
  range,
  ring,
  rod,
  rodX,
  roundRectPoints,
  spaced,
  span,
  sphere,
  torus,
  vcyl,
  type Part,
  type Size3,
  type V2,
  type V3,
} from '@/packs/kit';

// ── Shared helpers ───────────────────────────────────────────────────────────

const TAU = Math.PI * 2;
const O = { plan: false } as const;
const SHELF = 'Baskets & boxes';
const BATH = 'Bathroom accessories';

/** A mid-market Vietnamese estimate, in đồng. */
const est = (vnd: number) => ({ vnd, estimate: true });

/** Detail box (hidden from the plan) spanning x/y/z ranges, with an optional bevel. */
const sp = (slot: string, x: V2, y: V2, z: V2, bevel = 0): Part => span(slot, x, y, z, { bevel, plan: false });

/** Point at angle `a` (0 = +x, π/2 = +z, the front) and radius `r`, at height y. */
const polar = (a: number, r: number, y: number, zc = 0): V3 => [Math.cos(a) * r, y, zc + Math.sin(a) * r];

/** A board seen from the side: `pts` are [z, y], extruded `t` along +x from x0. */
function sidePlate(slot: string, pts: V2[], x0: number, t: number, plan = false): Part {
  const zs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const part: Part = {
    shape: 'prism',
    outline: pts.map(([z, y]) => [-(y - cy), z - cz] as V2),
    height: t,
    position: [x0, cy, cz],
    rotation: [0, 0, -Math.PI / 2],
    slot,
  };
  if (!plan) part.plan = false;
  return part;
}

/** Radius of a lathe profile ([r, y], y ascending) at height y. */
function profileR(profile: V2[], y: number): number {
  for (let i = 1; i < profile.length; i++) {
    const [r0, y0] = profile[i - 1];
    const [r1, y1] = profile[i];
    if (y >= y0 && y <= y1 && y1 > y0) return lerp(r0, r1, (y - y0) / (y1 - y0));
  }
  return profile[profile.length - 1][0];
}

/**
 * Open basket wall as a double-walled lathe: `outer` is the outside profile ([r, y], bottom to top,
 * starting at y = 0), `wall` the wall thickness. The inside follows the outside down to a floor.
 */
function basketShell(slot: string, outer: V2[], wall: number, opts: { segments?: number; zc?: number; plan?: boolean } = {}): Part {
  const inner = [...outer]
    .reverse()
    .filter(([, y]) => y > wall)
    .map(([r, y]) => [Math.max(0.001, r - wall), y] as V2);
  const floorR = Math.max(0.001, profileR(outer, wall) - wall);
  const profile: V2[] = [[0, 0], ...outer.filter(([r]) => r > 0), ...inner, [floorR, wall], [0, wall]];
  return lathe(slot, [0, 0, opts.zc ?? 0], profile, { segments: opts.segments ?? 40, plan: opts.plan });
}

// ── Round bins ───────────────────────────────────────────────────────────────

interface RoundOpts {
  /** Pedal half-width (0 = no pedal). */
  pedal?: number;
  lid?: 'dome' | 'flat' | 'butterfly' | 'tall-dome';
  lidH?: number;
  /** Slot for the lid (default 'lid'). */
  lidSlot?: string;
  /** Slot for a sensor window on the lid front (motion-sensor bins). */
  sensor?: string;
  /** Plastic base ring under the body (default true). */
  base?: boolean;
}

/** Round bin: body, base ring, lid, hinge and optional pedal / sensor window. */
function roundBin({ w, d, h }: Size3, o: RoundOpts = {}): Part[] {
  const P = o.pedal ? 0.04 : 0;
  const r = Math.min(w, d - P) / 2 - 0.002;
  const zc = -P / 2;
  const tall = o.lid === 'tall-dome';
  const lidH = o.lidH ?? (tall ? clamp(h * 0.16, 0.06, 0.11) : clamp(h * 0.07, 0.02, 0.05));
  const yb = o.base === false ? 0 : 0.014;
  const hb = h - lidH;
  const lid = o.lidSlot ?? 'lid';
  const rl = r * 1.01;
  const parts: Part[] = [lathe('body', [0, yb, zc], [[0, 0], [r * 0.95, 0], [r, 0.02], [r, hb - yb], [0, hb - yb]], { segments: 48 })];
  if (o.base !== false) parts.push(vcyl('trim', 0, zc, 0, yb + 0.006, r * 0.93, { segments: 40, plan: false }));
  if (o.lid === 'flat') {
    parts.push(lathe(lid, [0, hb, zc], [[0, 0], [rl, 0], [rl, lidH * 0.75], [rl * 0.97, lidH], [0, lidH]], { segments: 48, plan: false }));
  } else if (o.lid === 'butterfly') {
    const t = lidH * 0.7;
    const left = arcPoints(0, zc, rl, Math.PI / 2, (3 * Math.PI) / 2, 16).map(([x, z]) => [x - 0.004, z] as V2);
    const right = arcPoints(0, zc, rl, -Math.PI / 2, Math.PI / 2, 16).map(([x, z]) => [x + 0.004, z] as V2);
    parts.push(prism(lid, left, hb, t, O), prism(lid, right, hb, t, O), sp('trim', [-0.012, 0.012], [hb + 0.003, hb + t + 0.008], [zc - rl * 0.97, zc + rl * 0.97], 0.004));
    // Lift tabs at the outer edge of each half.
    for (const s of [-1, 1]) parts.push(sp('trim', [s * rl * 0.55 - 0.02, s * rl * 0.55 + 0.02], [hb + t - 0.002, hb + t + 0.006], [zc + rl * 0.6, zc + rl * 0.75], 0.003));
  } else if (tall) {
    parts.push(lathe(lid, [0, hb, zc], [[0, 0], [rl, 0], [rl, lidH * 0.18], [rl * 0.92, lidH * 0.5], [rl * 0.7, lidH * 0.85], [rl * 0.35, lidH * 0.99], [0, lidH]], { segments: 48, plan: false }));
  } else {
    parts.push(lathe(lid, [0, hb, zc], [[0, 0], [rl, 0], [rl, lidH * 0.35], [rl * 0.9, lidH * 0.75], [rl * 0.6, lidH * 0.97], [0, lidH]], { segments: 48, plan: false }));
  }
  // Hinge at the back.
  parts.push(sp('trim', [-r * 0.22, r * 0.22], [hb - 0.035, hb + Math.min(0.012, lidH * 0.4)], [zc - r - 0.006, zc - r + 0.012], 0.004));
  if (o.pedal) parts.push(sp('trim', [-o.pedal, o.pedal], [0.008, 0.03], [zc + r - 0.025, d / 2], 0.006));
  if (o.sensor) {
    parts.push(
      sp(o.sensor, [-0.035, 0.035], [hb + lidH * 0.08, hb + lidH * 0.3], [zc + rl - 0.02, zc + rl + 0.003], 0.003),
      // Battery cover at the back of the lid.
      sp(o.sensor, [-0.04, 0.04], [hb + lidH * 0.06, hb + lidH * 0.3], [zc - rl - 0.003, zc - rl + 0.02], 0.003),
    );
  }
  return parts;
}

// ── Straight-sided bins (rounded rectangle, D-shape) ─────────────────────────

/** Outline of a bin in plan ([x, z]) between z0 (back) and z1 (front), grown outward by `g`. */
type OutlineFn = (w: number, z0: number, z1: number, g: number) => V2[];

const rrOutline =
  (corner: number): OutlineFn =>
  (w, z0, z1, g) => {
    const bw = w - 0.004 + 2 * g;
    const bd = z1 - z0 - 0.004 + 2 * g;
    return roundRectPoints(0, (z0 + z1) / 2, bw, bd, Math.max(0.001, Math.min(corner + g, bw / 2 - 0.001, bd / 2 - 0.001)), 5);
  };

/** Flat back, rounded front corners (sits flat against a wall). */
const dOutline: OutlineFn = (w, z0, z1, g) => {
  const bw = w - 0.004 + 2 * g;
  const back = z0 + 0.002 - g;
  const front = z1 - 0.002 + g;
  const R = Math.max(0.01, Math.min(bw / 2 - 0.003, front - back - 0.01));
  return [[-bw / 2, back], [bw / 2, back], ...arcPoints(bw / 2 - R, front - R, R, 0, Math.PI / 2, 8), ...arcPoints(-bw / 2 + R, front - R, R, Math.PI / 2, Math.PI, 8)];
};

interface ShellOpts {
  /** Pedal centres along x (none = no pedal). */
  pedals?: number[];
  pedalW?: number;
  lidH?: number;
  /** Trim band between body and lid. */
  band?: boolean;
  /** Slot for a sensor window on the lid front. */
  sensor?: string;
  /** Plastic base under the body (default true). */
  base?: boolean;
  /** false = no lid (the item draws its own). */
  lid?: boolean;
  lidSlot?: string;
}

/** Straight-sided bin from a plan outline: body, base, optional band, stepped lid, hinge, pedals. */
function shellBin({ w, d, h }: Size3, outline: OutlineFn, o: ShellOpts = {}): Part[] {
  const pedals = o.pedals ?? [];
  const P = pedals.length ? 0.04 : 0;
  const z0 = -d / 2;
  const z1 = d / 2 - P;
  const lidH = o.lidH ?? clamp(h * 0.07, 0.02, 0.05);
  const hb = h - lidH;
  const band = o.band ? 0.018 : 0;
  const yb = o.base === false ? 0 : 0.014;
  const lid = o.lidSlot ?? 'lid';
  const parts: Part[] = [prism('body', outline(w, z0, z1, 0), yb, hb - band - yb)];
  if (o.base !== false) parts.push(prism('trim', outline(w, z0, z1, -0.008), 0, yb + 0.006, O));
  if (band) parts.push(prism('trim', outline(w, z0, z1, 0.0015), hb - band, band, O));
  if (o.lid !== false) {
    parts.push(prism(lid, outline(w, z0, z1, 0.002), hb, lidH * 0.65, O), prism(lid, outline(w, z0, z1, -0.006), hb + lidH * 0.65, lidH * 0.35, O));
  }
  parts.push(sp('trim', [-w * 0.2, w * 0.2], [hb - 0.03, hb + Math.min(0.012, lidH * 0.5)], [z0 - 0.004, z0 + 0.012], 0.004));
  const pw = o.pedalW ?? 0.045;
  for (const px of pedals) parts.push(sp('trim', [px - pw, px + pw], [0.008, 0.03], [z1 - 0.03, d / 2], 0.006));
  if (o.sensor) {
    parts.push(
      sp(o.sensor, [-0.035, 0.035], [hb + lidH * 0.1, hb + lidH * 0.55], [z1 - 0.012, z1 + 0.004], 0.002),
      sp(o.sensor, [-0.012, 0.012], [h - 0.002, h + 0.002], [z1 - 0.06, z1 - 0.036], 0.002),
    );
  }
  return parts;
}

// ── Kitchen pedal bins ───────────────────────────────────────────────────────

const PEDAL_LOOKS = {
  white: { id: 'white', name: 'White', materials: { body: 'metal-white-powder', lid: 'metal-white-powder' } },
  black: { id: 'matte-black', name: 'Matte black', materials: { body: 'metal-black-matte', lid: 'metal-black-matte' } },
  sage: { id: 'sage', name: 'Sage', materials: { body: 'laminate-sage', lid: 'laminate-sage' } },
  cream: { id: 'cream', name: 'Cream', materials: { body: 'ceramic-cream', lid: 'ceramic-cream' } },
  steel: { id: 'brushed-steel', name: 'Brushed steel', materials: { body: 'metal-brushed-steel', lid: 'metal-brushed-steel' } },
  polished: { id: 'polished', name: 'Polished stainless', materials: { body: 'metal-stainless-polished', lid: 'metal-stainless-polished' } },
};

const creamPedal12 = defineItem({
  id: 'cream-round-pedal-bin-12l',
  name: 'Cream round pedal bin, 12 L',
  category: 'kitchen',
  type: 'storage',
  group: SHELF,
  tags: ['pedal bin', 'trash can', 'kitchen bin', 'retro', 'thùng rác', 'thùng rác đạp chân', '12 litre'],
  description: 'A retro round pedal bin in cream powder-coated steel with a domed lid, a chrome foot pedal and a removable 12-litre plastic inner bucket.',
  price: est(550_000),
  defaultSize: { w: 0.26, d: 0.3, h: 0.4 },
  minSize: { w: 0.22, d: 0.26, h: 0.33 },
  maxSize: { w: 0.32, d: 0.36, h: 0.48 },
  slots: [matSlot('body', 'Body', 'ceramic-cream'), matSlot('lid', 'Lid', 'ceramic-cream'), matSlot('trim', 'Pedal, hinge & base', 'metal-chrome')],
  variants: [PEDAL_LOOKS.white, PEDAL_LOOKS.sage, PEDAL_LOOKS.black, { id: 'red', name: 'Retro red', materials: { body: 'solid-red', lid: 'solid-red' } }, PEDAL_LOOKS.steel],
  build: (s) => roundBin(s, { pedal: 0.04, lid: 'dome' }),
});

const steelPedal30 = defineItem({
  id: 'brushed-steel-pedal-bin-30l',
  name: 'Brushed steel round pedal bin, 30 L',
  category: 'kitchen',
  type: 'storage',
  group: SHELF,
  tags: ['pedal bin', 'trash can', 'kitchen bin', 'stainless steel', 'soft close', 'thùng rác inox', 'thùng rác đạp chân'],
  description: 'A classic round kitchen pedal bin in fingerprint-proof brushed stainless steel with a flat soft-close lid, a black plastic base and a 30-litre inner bucket.',
  price: est(1_200_000),
  defaultSize: { w: 0.32, d: 0.37, h: 0.65 },
  minSize: { w: 0.28, d: 0.32, h: 0.55 },
  maxSize: { w: 0.38, d: 0.43, h: 0.72 },
  slots: [matSlot('body', 'Body', 'metal-brushed-steel'), matSlot('lid', 'Lid', 'metal-brushed-steel'), matSlot('trim', 'Pedal, hinge & base', 'plastic-black')],
  variants: [PEDAL_LOOKS.black, PEDAL_LOOKS.white, PEDAL_LOOKS.sage, PEDAL_LOOKS.cream, PEDAL_LOOKS.polished],
  build: (s) => roundBin(s, { pedal: 0.05, lid: 'flat' }),
});

const tallPedal45 = defineItem({
  id: 'tall-pedal-bin-45l',
  name: 'Tall brushed steel pedal bin, 45 L',
  category: 'kitchen',
  type: 'storage',
  group: SHELF,
  tags: ['pedal bin', 'large bin', 'trash can', 'family bin', 'stainless steel', 'thùng rác inox', 'thùng rác đạp chân'],
  description: 'A tall round family-size pedal bin in brushed stainless steel with a domed soft-close lid, a wide pedal and a 45-litre bucket with carry handle.',
  price: est(1_800_000),
  defaultSize: { w: 0.35, d: 0.4, h: 0.78 },
  minSize: { w: 0.3, d: 0.35, h: 0.68 },
  maxSize: { w: 0.42, d: 0.47, h: 0.86 },
  slots: [matSlot('body', 'Body', 'metal-brushed-steel'), matSlot('lid', 'Lid', 'metal-brushed-steel'), matSlot('trim', 'Pedal, hinge & base', 'plastic-black')],
  variants: [PEDAL_LOOKS.black, PEDAL_LOOKS.white, PEDAL_LOOKS.polished, { id: 'black-lid', name: 'Steel with black lid', materials: { lid: 'metal-black-matte' } }],
  build: (s) => roundBin(s, { pedal: 0.065, lid: 'dome' }),
});

const rectSoftClose40 = defineItem({
  id: 'rectangular-soft-close-bin-40l',
  name: 'Rectangular soft-close pedal bin, 40 L',
  category: 'kitchen',
  type: 'storage',
  group: SHELF,
  tags: ['pedal bin', 'rectangular bin', 'soft close', 'kitchen bin', 'stainless steel', 'thùng rác đạp chân', 'thùng rác chữ nhật'],
  description: 'A space-saving rectangular pedal bin with rounded corners in brushed stainless steel, a black lid band, a soft-close lid and a 40-litre liner.',
  price: est(1_900_000),
  defaultSize: { w: 0.4, d: 0.34, h: 0.68 },
  minSize: { w: 0.34, d: 0.28, h: 0.55 },
  maxSize: { w: 0.48, d: 0.4, h: 0.78 },
  wallSnap: true,
  slots: [matSlot('body', 'Body', 'metal-brushed-steel'), matSlot('lid', 'Lid', 'metal-brushed-steel'), matSlot('trim', 'Lid band, pedal & base', 'plastic-black')],
  variants: [PEDAL_LOOKS.black, { id: 'white', name: 'White with grey band', materials: { body: 'metal-white-powder', lid: 'metal-white-powder', trim: 'solid-mid-grey' } }, PEDAL_LOOKS.sage, PEDAL_LOOKS.cream],
  build: (s) => shellBin(s, rrOutline(0.04), { pedals: [0], pedalW: 0.06, band: true }),
});

const dShapeStep30 = defineItem({
  id: 'd-shape-step-bin-30l',
  name: 'D-shaped step bin, 30 L',
  category: 'kitchen',
  type: 'storage',
  group: SHELF,
  tags: ['step bin', 'pedal bin', 'd-shape', 'wall bin', 'matte black', 'thùng rác đạp chân', 'kitchen bin'],
  description: 'A D-shaped pedal bin in matte black powder-coated steel with a flat back that sits snugly against a wall or cabinet, a soft-close lid and a 30-litre liner.',
  price: est(1_500_000),
  defaultSize: { w: 0.4, d: 0.32, h: 0.62 },
  minSize: { w: 0.34, d: 0.27, h: 0.5 },
  maxSize: { w: 0.48, d: 0.38, h: 0.72 },
  wallSnap: true,
  slots: [matSlot('body', 'Body', 'metal-black-matte'), matSlot('lid', 'Lid', 'metal-black-matte'), matSlot('trim', 'Pedal, hinge & base', 'plastic-black')],
  variants: [PEDAL_LOOKS.steel, PEDAL_LOOKS.white, PEDAL_LOOKS.sage, PEDAL_LOOKS.cream],
  build: (s) => shellBin(s, dOutline, { pedals: [0], pedalW: 0.055 }),
});

const sageStep20 = defineItem({
  id: 'sage-soft-close-step-bin-20l',
  name: 'Sage soft-close step bin, 20 L',
  category: 'kitchen',
  type: 'storage',
  group: SHELF,
  tags: ['step bin', 'pedal bin', 'soft close', 'sage green', 'square bin', 'thùng rác đạp chân', 'thùng rác vuông'],
  description: 'A rounded-square step bin in matte sage powder-coated steel with a white soft-close lid, a wide foot bar and a 20-litre inner bucket.',
  price: est(850_000),
  defaultSize: { w: 0.3, d: 0.33, h: 0.45 },
  minSize: { w: 0.26, d: 0.29, h: 0.38 },
  maxSize: { w: 0.36, d: 0.39, h: 0.54 },
  slots: [matSlot('body', 'Body', 'laminate-sage'), matSlot('lid', 'Lid', 'metal-white-powder'), matSlot('trim', 'Foot bar, hinge & base', 'plastic-white')],
  variants: [
    { id: 'all-white', name: 'All white', materials: { body: 'metal-white-powder' } },
    { id: 'cream', name: 'Cream', materials: { body: 'ceramic-cream', lid: 'ceramic-cream' } },
    { id: 'charcoal', name: 'Charcoal', materials: { body: 'metal-anthracite', lid: 'metal-anthracite', trim: 'plastic-black' } },
    { id: 'blush', name: 'Blush', materials: { body: 'plastic-pink', lid: 'metal-white-powder' } },
  ],
  build: (s) => shellBin(s, rrOutline(0.07), { pedals: [0], pedalW: 0.09 }),
});

const bambooLid20 = defineItem({
  id: 'bamboo-lid-pedal-bin-20l',
  name: 'Round pedal bin with bamboo lid, 20 L',
  category: 'kitchen',
  type: 'storage',
  group: SHELF,
  tags: ['pedal bin', 'bamboo lid', 'scandi', 'kitchen bin', 'white bin', 'thùng rác nắp tre', 'thùng rác đạp chân'],
  description: 'A white powder-coated round pedal bin topped with a flat natural bamboo lid, a black pedal and base, and a 20-litre inner bucket.',
  price: est(750_000),
  defaultSize: { w: 0.29, d: 0.33, h: 0.45 },
  minSize: { w: 0.25, d: 0.29, h: 0.38 },
  maxSize: { w: 0.34, d: 0.38, h: 0.55 },
  slots: [matSlot('body', 'Body', 'metal-white-powder'), matSlot('lid', 'Bamboo lid', 'wood-bamboo'), matSlot('trim', 'Pedal, hinge & base', 'plastic-black')],
  variants: [
    { id: 'black', name: 'Black with bamboo', materials: { body: 'metal-black-matte' } },
    { id: 'sage', name: 'Sage with bamboo', materials: { body: 'laminate-sage' } },
    { id: 'grey-oak', name: 'Grey with oak', materials: { body: 'solid-mid-grey', lid: 'wood-oak-natural' } },
    { id: 'cream-walnut', name: 'Cream with walnut', materials: { body: 'ceramic-cream', lid: 'wood-walnut' } },
  ],
  build: (s) => roundBin(s, { pedal: 0.045, lid: 'flat', lidH: 0.022 }),
});

const butterfly30 = defineItem({
  id: 'butterfly-lid-pedal-bin-30l',
  name: 'Butterfly-lid pedal bin, 30 L',
  category: 'kitchen',
  type: 'storage',
  group: SHELF,
  tags: ['pedal bin', 'butterfly lid', 'split lid', 'stainless steel', 'under counter', 'thùng rác đạp chân', 'thùng rác inox'],
  description: 'A round brushed-steel pedal bin whose lid opens as two half-moon wings from a centre hinge bar, so it fits under a worktop; 30-litre liner.',
  price: est(1_300_000),
  defaultSize: { w: 0.32, d: 0.37, h: 0.62 },
  minSize: { w: 0.28, d: 0.32, h: 0.52 },
  maxSize: { w: 0.38, d: 0.43, h: 0.72 },
  slots: [matSlot('body', 'Body', 'metal-brushed-steel'), matSlot('lid', 'Lid wings', 'metal-brushed-steel'), matSlot('trim', 'Hinge bar, pedal & base', 'plastic-black')],
  variants: [PEDAL_LOOKS.black, PEDAL_LOOKS.white, PEDAL_LOOKS.cream, { id: 'steel-black-lid', name: 'Steel with black wings', materials: { lid: 'metal-black-matte' } }],
  build: (s) => roundBin(s, { pedal: 0.05, lid: 'butterfly', lidH: 0.03 }),
});

// ── Motion-sensor bins ───────────────────────────────────────────────────────

const roundSensor30 = defineItem({
  id: 'round-sensor-bin-30l',
  name: 'Round motion-sensor bin, 30 L',
  category: 'kitchen',
  type: 'storage',
  group: SHELF,
  tags: ['sensor bin', 'touchless bin', 'motion sensor', 'smart bin', 'automatic lid', 'thùng rác cảm ứng', 'thùng rác thông minh'],
  description: 'A touchless round bin in brushed steel with a black domed lid that lifts when an infrared sensor sees a hand; runs on AA batteries, 30 litres.',
  price: est(1_500_000),
  defaultSize: { w: 0.3, d: 0.3, h: 0.66 },
  minSize: { w: 0.26, d: 0.26, h: 0.55 },
  maxSize: { w: 0.36, d: 0.36, h: 0.75 },
  slots: [matSlot('body', 'Body', 'metal-brushed-steel'), matSlot('lid', 'Sensor lid', 'plastic-black'), matSlot('trim', 'Hinge & base', 'plastic-black'), matSlot('sensor', 'Sensor window & battery cover', 'screen-black')],
  variants: [
    { id: 'white', name: 'White', materials: { body: 'metal-white-powder', lid: 'plastic-white', trim: 'plastic-white' } },
    { id: 'all-black', name: 'All black', materials: { body: 'metal-black-matte' } },
    { id: 'steel-lid', name: 'Steel lid', materials: { lid: 'metal-brushed-steel' } },
    { id: 'champagne', name: 'Champagne', materials: { body: 'metal-champagne', lid: 'metal-champagne' } },
  ],
  build: (s) => roundBin(s, { lid: 'tall-dome', sensor: 'sensor', lidH: clamp(s.h * 0.12, 0.05, 0.09) }),
});

const rectSensor45 = defineItem({
  id: 'rectangular-sensor-bin-45l',
  name: 'Rectangular motion-sensor bin, 45 L',
  category: 'kitchen',
  type: 'storage',
  group: SHELF,
  tags: ['sensor bin', 'touchless bin', 'motion sensor', 'large kitchen bin', 'stainless steel', 'thùng rác cảm ứng', 'thùng rác thông minh'],
  description: 'A large rectangular touchless bin: brushed stainless body, black lid with an infrared sensor window and an open/close button, battery-powered, 45 litres.',
  price: est(2_600_000),
  defaultSize: { w: 0.42, d: 0.3, h: 0.72 },
  minSize: { w: 0.36, d: 0.26, h: 0.6 },
  maxSize: { w: 0.5, d: 0.36, h: 0.8 },
  wallSnap: true,
  slots: [matSlot('body', 'Body', 'metal-brushed-steel'), matSlot('lid', 'Sensor lid', 'plastic-black'), matSlot('trim', 'Lid band, hinge & base', 'plastic-black'), matSlot('sensor', 'Sensor window & button', 'screen-black')],
  variants: [
    { id: 'all-black', name: 'All black', materials: { body: 'metal-black-matte' } },
    { id: 'white', name: 'White', materials: { body: 'metal-white-powder', lid: 'plastic-white', trim: 'solid-light-grey' } },
    { id: 'gunmetal', name: 'Gunmetal', materials: { body: 'metal-gunmetal' } },
    { id: 'steel-lid', name: 'All steel', materials: { lid: 'metal-brushed-steel' } },
  ],
  build: (s) => shellBin(s, rrOutline(0.035), { band: true, sensor: 'sensor', lidH: clamp(s.h * 0.08, 0.04, 0.065) }),
});

const slimSensor9 = defineItem({
  id: 'slim-sensor-bin-9l',
  name: 'Slim motion-sensor bin, 9 L',
  category: 'bathroom',
  type: 'plumbing',
  group: BATH,
  tags: ['sensor bin', 'touchless bin', 'bathroom bin', 'slim bin', 'motion sensor', 'thùng rác cảm ứng', 'thùng rác nhà tắm'],
  description: 'A slim white plastic touchless bin for the bathroom, with a battery-powered infrared sensor in the lid front and a 9-litre capacity.',
  price: est(900_000),
  defaultSize: { w: 0.25, d: 0.16, h: 0.33 },
  minSize: { w: 0.21, d: 0.14, h: 0.28 },
  maxSize: { w: 0.3, d: 0.2, h: 0.4 },
  wallSnap: true,
  slots: [matSlot('body', 'Body', 'plastic-white'), matSlot('lid', 'Sensor lid', 'plastic-white'), matSlot('trim', 'Hinge & base', 'solid-light-grey'), matSlot('sensor', 'Sensor window & button', 'screen-black')],
  variants: [
    { id: 'black', name: 'Black', materials: { body: 'plastic-black', lid: 'plastic-black', trim: 'plastic-black' } },
    { id: 'steel', name: 'Steel body', materials: { body: 'metal-brushed-steel', lid: 'plastic-black', trim: 'plastic-black' } },
    { id: 'mint', name: 'Mint', materials: { body: 'plastic-mint', lid: 'plastic-white' } },
  ],
  build: (s) => shellBin(s, rrOutline(0.04), { sensor: 'sensor', lidH: 0.035 }),
});

// ── Recycling and sorting ────────────────────────────────────────────────────

const dualRecycling = defineItem({
  id: 'dual-recycling-pedal-bin',
  name: 'Dual-compartment recycling pedal bin, 2 × 20 L',
  category: 'kitchen',
  type: 'storage',
  group: SHELF,
  tags: ['recycling bin', 'dual bin', 'pedal bin', 'waste sorting', 'two compartment', 'thùng rác phân loại', 'thùng rác đạp chân'],
  description: 'A wide rectangular brushed-steel pedal bin with two 20-litre compartments, each with its own lid and pedal, and colour-coded labels for recycling and general waste.',
  price: est(2_200_000),
  defaultSize: { w: 0.52, d: 0.38, h: 0.66 },
  minSize: { w: 0.44, d: 0.32, h: 0.55 },
  maxSize: { w: 0.6, d: 0.44, h: 0.76 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Body & lids', 'metal-brushed-steel'),
    matSlot('trim', 'Pedals, hinges & base', 'plastic-black'),
    matSlot('label-a', 'Left label (recycling)', 'plastic-blue'),
    matSlot('label-b', 'Right label (general waste)', 'solid-mid-grey'),
  ],
  variants: [
    { id: 'black', name: 'Matte black', materials: { body: 'metal-black-matte' } },
    { id: 'white', name: 'White', materials: { body: 'metal-white-powder', trim: 'solid-mid-grey' } },
    { id: 'compost', name: 'Recycling & compost', materials: { 'label-b': 'plastic-green' } },
  ],
  build: (size) => {
    const { w, d, h } = size;
    const lidH = clamp(h * 0.06, 0.025, 0.045);
    const hb = h - lidH;
    const z0 = -d / 2;
    const z1 = d / 2 - 0.04;
    const zm = (z0 + z1) / 2;
    const bd = z1 - z0 - 0.004;
    const parts = shellBin(size, rrOutline(0.035), { pedals: [-w / 4, w / 4], pedalW: 0.045, lid: false, lidH });
    for (const [i, s] of [-1, 1].entries()) {
      const cx = (s * w) / 4;
      parts.push(
        prism('body', roundRectPoints(cx, zm, w / 2 - 0.006, bd + 0.004, 0.03, 5), hb, lidH * 0.65, O),
        prism('body', roundRectPoints(cx, zm, w / 2 - 0.02, bd - 0.01, 0.024, 5), hb + lidH * 0.65, lidH * 0.35, O),
        discZ(i === 0 ? 'label-a' : 'label-b', [cx, hb - 0.07, z1 - 0.002 + 0.0015], 0.026, 0.003, { segments: 24, plan: false }),
      );
    }
    return parts;
  },
});

const slimGap25 = defineItem({
  id: 'slim-rolling-gap-bin-25l',
  name: 'Slim rolling gap bin, 25 L',
  category: 'kitchen',
  type: 'storage',
  group: SHELF,
  tags: ['slim bin', 'gap bin', 'narrow bin', 'castors', 'beside the fridge', 'thùng rác khe hẹp', 'thùng rác'],
  description: 'A narrow plastic bin on hidden castors that slides into the gap beside a fridge or cabinet, with a front pull handle and a grey flip-up lid; 25 litres.',
  price: est(450_000),
  defaultSize: { w: 0.18, d: 0.45, h: 0.62 },
  minSize: { w: 0.14, d: 0.38, h: 0.5 },
  maxSize: { w: 0.24, d: 0.52, h: 0.72 },
  wallSnap: true,
  slots: [matSlot('body', 'Body', 'plastic-white'), matSlot('lid', 'Lid', 'solid-light-grey'), matSlot('trim', 'Handle & castors', 'plastic-black')],
  variants: [
    { id: 'grey', name: 'Grey', materials: { body: 'solid-mid-grey', lid: 'solid-light-grey' } },
    { id: 'black', name: 'Black', materials: { body: 'plastic-black', lid: 'plastic-black', trim: 'solid-mid-grey' } },
    { id: 'mint', name: 'Mint & white', materials: { body: 'plastic-mint', lid: 'plastic-white' } },
  ],
  build: ({ w, d, h }) => {
    const yb = 0.035;
    const lidH = 0.03;
    const parts: Part[] = [
      span('body', [-w / 2 + 0.002, w / 2 - 0.002], [yb, h - lidH], [-d / 2, d / 2 - 0.016], { bevel: 0.018 }),
      span('lid', [-w / 2, w / 2], [h - lidH, h], [-d / 2, d / 2 - 0.012], { bevel: 0.01, plan: false }),
      // Front pull handle and lid lift tab.
      sp('trim', [-w * 0.32, w * 0.32], [h - 0.11, h - 0.09], [d / 2 - 0.016, d / 2], 0.006),
      sp('trim', [-w * 0.3, -w * 0.3 + 0.012], [h - 0.11, h - 0.075], [d / 2 - 0.02, d / 2 - 0.004], 0.004),
      sp('trim', [w * 0.3 - 0.012, w * 0.3], [h - 0.11, h - 0.075], [d / 2 - 0.02, d / 2 - 0.004], 0.004),
      sp('trim', [-w / 2 + 0.01, w / 2 - 0.01], [yb - 0.006, yb + 0.004], [-d / 2 + 0.01, d / 2 - 0.024], 0.003),
    ];
    for (const sx of [-1, 1]) {
      for (const z of [-d / 2 + 0.04, d / 2 - 0.06]) {
        parts.push(rod('trim', [sx * (w / 2 - 0.035), 0.016, z], [sx * (w / 2 - 0.015), 0.016, z], 0.016, { segments: 16, plan: false }));
      }
    }
    return parts;
  },
});

const swingSquare40 = defineItem({
  id: 'square-swing-lid-bin-40l',
  name: 'Square swing-lid bin, 40 L',
  category: 'kitchen',
  type: 'storage',
  group: SHELF,
  tags: ['swing lid bin', 'swing top', 'kitchen bin', 'plastic bin', 'thùng rác nắp lắc', 'thùng rác nhựa', 'tall bin'],
  description: 'A tall square plastic kitchen bin with a hood whose swing flap tips inward when you push rubbish through; the hood lifts off to change the 40-litre bag.',
  price: est(350_000),
  defaultSize: { w: 0.32, d: 0.28, h: 0.72 },
  minSize: { w: 0.26, d: 0.23, h: 0.55 },
  maxSize: { w: 0.38, d: 0.34, h: 0.82 },
  wallSnap: true,
  slots: [matSlot('body', 'Body', 'plastic-white'), matSlot('lid', 'Hood', 'plastic-white'), matSlot('flap', 'Swing flap', 'solid-mid-grey')],
  variants: [
    { id: 'grey', name: 'Grey', materials: { body: 'solid-mid-grey', lid: 'solid-mid-grey', flap: 'solid-light-grey' } },
    { id: 'black', name: 'Black', materials: { body: 'plastic-black', lid: 'plastic-black', flap: 'solid-mid-grey' } },
    { id: 'green', name: 'Green', materials: { body: 'plastic-green', lid: 'plastic-green', flap: 'plastic-white' } },
    { id: 'blue', name: 'Blue', materials: { body: 'plastic-blue', lid: 'plastic-blue', flap: 'plastic-white' } },
  ],
  build: ({ w, d, h }) => {
    const hoodH = clamp(h * 0.14, 0.07, 0.12);
    const hb = h - hoodH;
    return [
      prism('body', roundRectPoints(0, 0, w - 0.01, d - 0.01, 0.03, 5), 0, hb + 0.01),
      span('lid', [-w / 2, w / 2], [hb, h - 0.012], [-d / 2, d / 2], { bevel: 0.025, plan: false }),
      box('flap', [0, h - 0.014, 0.004], [w - 0.07, 0.012, d - 0.08], { rotation: [0.07, 0, 0], bevel: 0.004, plan: false }),
      sp('flap', [-0.012, 0.012], [h - 0.03, h - 0.01], [-d / 2 + 0.025, d / 2 - 0.025], 0.004),
    ];
  },
});

const compostCaddy = defineItem({
  id: 'countertop-compost-caddy-5l',
  name: 'Countertop compost caddy, 5 L',
  category: 'kitchen',
  type: 'storage',
  group: SHELF,
  tags: ['compost caddy', 'food waste', 'compost bin', 'countertop', 'organic waste', 'thùng ủ rác hữu cơ', 'thùng rác nhà bếp'],
  description: 'A small brushed-steel caddy for food scraps that sits on the worktop, with a black lid holding a replaceable charcoal filter and a fold-down carry handle; 5 litres.',
  price: est(450_000),
  defaultSize: { w: 0.2, d: 0.17, h: 0.27 },
  minSize: { w: 0.16, d: 0.14, h: 0.22 },
  maxSize: { w: 0.26, d: 0.22, h: 0.34 },
  slots: [matSlot('body', 'Caddy', 'metal-brushed-steel'), matSlot('lid', 'Lid & base', 'plastic-black'), matSlot('handle', 'Handle & filter vents', 'metal-brushed-steel')],
  variants: [
    { id: 'white', name: 'White', materials: { body: 'metal-white-powder', lid: 'plastic-white', handle: 'metal-chrome' } },
    { id: 'sage', name: 'Sage', materials: { body: 'laminate-sage', lid: 'plastic-white' } },
    { id: 'copper', name: 'Copper', materials: { body: 'metal-copper', handle: 'metal-copper' } },
    { id: 'black', name: 'All black', materials: { body: 'metal-black-matte', handle: 'metal-black-matte' } },
  ],
  build: ({ w, d, h }) => {
    const R = Math.min(w / 2 - 0.015, h * 0.32);
    const lidTop = h - R - 0.007;
    const parts: Part[] = [
      prism('body', roundRectPoints(0, 0, w - 0.004, d - 0.004, 0.035, 5), 0.008, lidTop - 0.03 - 0.008),
      prism('lid', roundRectPoints(0, 0, w - 0.02, d - 0.02, 0.03, 5), 0, 0.012, O),
      prism('lid', roundRectPoints(0, 0, w, d, 0.036, 5), lidTop - 0.03, 0.022, O),
      prism('lid', roundRectPoints(0, 0, w - 0.03, d - 0.03, 0.028, 5), lidTop - 0.008, 0.008, O),
      torus('handle', [0, lidTop - 0.012, 0], R, 0.0045, { arc: Math.PI, plan: false }),
    ];
    for (const sx of [-1, 1]) parts.push(sp('handle', [sx * R - 0.008, sx * R + 0.008], [lidTop - 0.026, lidTop - 0.005], [-0.008, 0.008], 0.003));
    for (const [x, z] of [[-0.025, -0.012], [0, -0.012], [0.025, -0.012], [-0.025, 0.012], [0, 0.012], [0.025, 0.012]] as V2[]) {
      parts.push(cyl('handle', [x, lidTop + 0.001, z + 0.02], 0.006, 0.002, { segments: 12, plan: false }));
    }
    return parts;
  },
});

const doorCaddy = defineItem({
  id: 'door-hung-under-sink-bin-8l',
  name: 'Door-hung under-sink bin, 8 L',
  category: 'kitchen',
  type: 'storage',
  group: SHELF,
  tags: ['under sink bin', 'door bin', 'cabinet door', 'hanging bin', 'small bin', 'thùng rác treo cánh tủ', 'thùng rác'],
  description: 'A compact plastic bin that hooks over the inside of a cabinet door under the sink, with a flip lid and a front tab; 8 litres.',
  price: est(180_000),
  defaultSize: { w: 0.27, d: 0.2, h: 0.3 },
  minSize: { w: 0.22, d: 0.16, h: 0.24 },
  maxSize: { w: 0.32, d: 0.24, h: 0.36 },
  mount: 'wall',
  wallSnap: true,
  defaultElevation: 0.3,
  slots: [matSlot('body', 'Body', 'plastic-white'), matSlot('lid', 'Flip lid & tab', 'solid-light-grey'), matSlot('hooks', 'Door hooks', 'metal-white-powder')],
  variants: [
    { id: 'grey', name: 'Grey', materials: { body: 'solid-mid-grey', lid: 'solid-light-grey' } },
    { id: 'black', name: 'Black', materials: { body: 'plastic-black', lid: 'plastic-black', hooks: 'metal-black-matte' } },
    { id: 'green', name: 'Compost green', materials: { body: 'plastic-green', lid: 'plastic-white' } },
  ],
  build: ({ w, d, h }) => {
    const top = h - 0.055;
    const zb = -d / 2 + 0.025;
    const parts: Part[] = [
      span('body', [-w / 2 + 0.004, w / 2 - 0.004], [0.004, top - 0.018], [zb, d / 2 - 0.014], { bevel: 0.02 }),
      span('lid', [-w / 2, w / 2], [top - 0.018, top], [zb, d / 2 - 0.01], { bevel: 0.007, plan: false }),
      sp('lid', [-0.04, 0.04], [top - 0.03, top - 0.006], [d / 2 - 0.014, d / 2], 0.004),
    ];
    for (const sx of [-1, 1]) {
      const x: V2 = [sx * w * 0.3 - 0.016, sx * w * 0.3 + 0.016];
      parts.push(
        sp('hooks', x, [top - 0.08, h], [zb - 0.005, zb], 0.0015),
        sp('hooks', x, [h - 0.005, h], [-d / 2, zb - 0.005], 0.0015),
        sp('hooks', x, [h - 0.045, h - 0.005], [-d / 2, -d / 2 + 0.004], 0.0015),
      );
    }
    return parts;
  },
});

const stackingCrates = defineItem({
  id: 'stacking-recycling-crates',
  name: 'Stacking recycling crates, set of 3',
  category: 'kitchen',
  type: 'storage',
  group: SHELF,
  tags: ['recycling crates', 'stacking bins', 'waste sorting', 'open front', 'plastic crates', 'thùng phân loại rác', 'recycling'],
  description: 'Three open-fronted plastic crates that stack into a sorting tower, in blue, yellow and green, so cans, plastics and paper can be dropped in from the front.',
  price: est(650_000),
  defaultSize: { w: 0.4, d: 0.34, h: 0.75 },
  minSize: { w: 0.32, d: 0.28, h: 0.5 },
  maxSize: { w: 0.5, d: 0.42, h: 0.9 },
  slots: [matSlot('top', 'Top crate', 'plastic-blue'), matSlot('middle', 'Middle crate', 'plastic-yellow'), matSlot('bottom', 'Bottom crate', 'plastic-green')],
  variants: [
    { id: 'greys', name: 'Greys', materials: { top: 'solid-light-grey', middle: 'solid-mid-grey', bottom: 'plastic-black' } },
    { id: 'white', name: 'All white', materials: { top: 'plastic-white', middle: 'plastic-white', bottom: 'plastic-white' } },
    { id: 'pastel', name: 'Pastels', materials: { top: 'plastic-mint', middle: 'plastic-pink', bottom: 'paint-butter' } },
  ],
  build: ({ w, d, h }) => {
    const t = 0.008;
    const ch = h / 3;
    const parts: Part[] = [];
    for (const i of range(3)) {
      const s = ['bottom', 'middle', 'top'][i];
      const y0 = i * ch;
      const y1 = y0 + ch - 0.002;
      const lip = y0 + ch * 0.35;
      parts.push(
        span(s, [-w / 2 + t, w / 2 - t], [y0, y0 + t], [-d / 2 + t, d / 2 - t], { plan: i === 0 }),
        span(s, [-w / 2, w / 2], [y0, y1], [-d / 2, -d / 2 + t], { plan: i === 0 }),
        span(s, [-w / 2 + t, w / 2 - t], [y0, lip], [d / 2 - t, d / 2], O),
        sidePlate(s, [[-d / 2, y0], [d / 2, y0], [d / 2, lip], [-d / 2 + d * 0.45, y1], [-d / 2, y1]], -w / 2, t, i === 0),
        sidePlate(s, [[-d / 2, y0], [d / 2, y0], [d / 2, lip], [-d / 2 + d * 0.45, y1], [-d / 2, y1]], w / 2 - t, t, i === 0),
        // Hand-hold slot in the front lip.
        sp(s, [-w * 0.18, w * 0.18], [lip - 0.03, lip - 0.012], [d / 2 + 0.001, d / 2 + 0.004], 0.003),
      );
    }
    return parts;
  },
});

const recyclingStation = defineItem({
  id: 'three-bin-recycling-station',
  name: 'Three-bin recycling station',
  category: 'kitchen',
  type: 'storage',
  group: SHELF,
  tags: ['recycling station', 'sorting bins', 'three bins', 'waste cabinet', 'recycling', 'thùng rác phân loại', 'tủ thùng rác'],
  description: 'A white powder-coated steel cabinet holding three bins behind front doors, with lift-up lids and door tabs colour-coded blue for recycling, grey for general waste and green for organics.',
  price: est(2_400_000),
  defaultSize: { w: 0.9, d: 0.4, h: 0.78 },
  minSize: { w: 0.7, d: 0.32, h: 0.6 },
  maxSize: { w: 1.1, d: 0.48, h: 0.9 },
  wallSnap: true,
  slots: [
    matSlot('frame', 'Cabinet', 'metal-white-powder'),
    matSlot('recycle', 'Recycling lid & tab', 'plastic-blue'),
    matSlot('general', 'General waste lid & tab', 'solid-mid-grey'),
    matSlot('organic', 'Organic lid & tab', 'plastic-green'),
  ],
  variants: [
    { id: 'black', name: 'Black cabinet', materials: { frame: 'metal-black-matte' } },
    { id: 'oak', name: 'Oak cabinet', materials: { frame: 'wood-oak-natural' } },
    { id: 'steel', name: 'Steel cabinet', materials: { frame: 'metal-brushed-steel' } },
  ],
  build: ({ w, d, h }) => {
    const t = 0.015;
    const parts: Part[] = [
      span('frame', [-w / 2, -w / 2 + t], [0.02, h - 0.03], [-d / 2, d / 2]),
      span('frame', [w / 2 - t, w / 2], [0.02, h - 0.03], [-d / 2, d / 2]),
      span('frame', [-w / 2 + t, w / 2 - t], [0.02, h - 0.03], [-d / 2, -d / 2 + 0.01], O),
      span('frame', [-w / 2 + t, w / 2 - t], [0.02, 0.035], [-d / 2 + 0.01, d / 2 - 0.02], O),
      span('frame', [-w / 2, w / 2], [h - 0.03, h - 0.02], [-d / 2, d / 2], O),
      sp('frame', [-w / 2 + 0.02, w / 2 - 0.02], [0, 0.02], [-d / 2 + 0.03, d / 2 - 0.05]),
    ];
    const cellsX = cellSpans(3, -w / 2 + t, w / 2 - t);
    const lids = ['recycle', 'general', 'organic'];
    for (const [i, [x0, x1]] of cellsX.entries()) {
      const cx = (x0 + x1) / 2;
      const s = lids[i];
      if (i > 0) parts.push(sp('frame', [x0 - 0.006, x0 + 0.006], [0.035, h - 0.03], [-d / 2 + 0.01, d / 2 - 0.02]));
      parts.push(
        span(s, [x0 + 0.004, x1 - 0.004], [h - 0.02, h], [-d / 2 + 0.005, d / 2 - 0.004], { bevel: 0.006, plan: false }),
        sp(s, [cx - 0.06, cx + 0.06], [h - 0.034, h - 0.012], [d / 2 - 0.012, d / 2 + 0.004], 0.004),
        sp('frame', [x0 + 0.004, x1 - 0.004], [0.04, h - 0.035], [d / 2 - 0.02, d / 2 - 0.002], 0.004),
        sp(s, [cx - 0.05, cx + 0.05], [h - 0.12, h - 0.07], [d / 2 - 0.003, d / 2 + 0.002], 0.003),
      );
    }
    return parts;
  },
});

const japaneseSorting = defineItem({
  id: 'japanese-stacking-sorting-bins',
  name: 'Japanese stacking sorting bins, 3 tiers',
  category: 'kitchen',
  type: 'storage',
  group: SHELF,
  tags: ['sorting bins', 'japanese bins', 'stacking bins', 'recycling', 'drawer bins', 'thùng rác phân loại kiểu nhật', 'gomi bako'],
  description: 'A Japanese-style tower of three stackable plastic bins on castors, each with a tilting front flap and a sorting label, so burnables, plastics and cans each get a tier.',
  price: est(1_300_000),
  defaultSize: { w: 0.4, d: 0.45, h: 0.88 },
  minSize: { w: 0.32, d: 0.38, h: 0.6 },
  maxSize: { w: 0.48, d: 0.52, h: 1.05 },
  wallSnap: true,
  slots: [matSlot('body', 'Bins', 'plastic-white'), matSlot('flaps', 'Front flaps & top', 'solid-light-grey'), matSlot('labels', 'Sorting labels', 'plastic-green'), matSlot('trim', 'Grips & castors', 'plastic-black')],
  variants: [
    { id: 'grey', name: 'Grey', materials: { body: 'solid-mid-grey', flaps: 'solid-light-grey' } },
    { id: 'black', name: 'Black', materials: { body: 'plastic-black', flaps: 'solid-mid-grey', trim: 'solid-mid-grey' } },
    { id: 'wood-look', name: 'White with oak flaps', materials: { flaps: 'wood-oak-light' } },
  ],
  build: ({ w, d, h }) => {
    const cast = 0.05;
    const tierH = (h - cast - 0.012) / 3;
    const parts: Part[] = [];
    for (const i of range(3)) {
      const y0 = cast + i * tierH;
      const y1 = y0 + tierH;
      parts.push(
        span('body', [-w / 2, w / 2], [y0 + 0.003, y1 - 0.003], [-d / 2, d / 2 - 0.02], { bevel: 0.01, plan: i === 0 }),
        sp('flaps', [-w / 2 + 0.015, w / 2 - 0.015], [y0 + 0.02, y1 - 0.015], [d / 2 - 0.022, d / 2 - 0.004], 0.008),
        sp('trim', [-0.06, 0.06], [y1 - 0.045, y1 - 0.03], [d / 2 - 0.006, d / 2], 0.004),
        sp('labels', [-w / 2 + 0.04, -w / 2 + 0.1], [y0 + 0.04, y0 + 0.08], [d / 2 - 0.006, d / 2 - 0.001], 0.003),
      );
    }
    parts.push(sp('flaps', [-w / 2 + 0.006, w / 2 - 0.006], [h - 0.012 - 0.003, h], [-d / 2 + 0.006, d / 2 - 0.022], 0.005));
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const x = sx * (w / 2 - 0.04);
        const z = sz * (d / 2 - 0.06);
        parts.push(vcyl('trim', x, z, 0.036, cast + 0.004, 0.012, { segments: 12, plan: false }), rod('trim', [x - 0.01, 0.022, z], [x + 0.01, 0.022, z], 0.022, { segments: 14, plan: false }));
      }
    }
    return parts;
  },
});

const vnFlipLid15 = defineItem({
  id: 'plastic-flip-lid-bin-15l',
  name: 'Plastic flip-lid bin, 15 L',
  category: 'kitchen',
  type: 'storage',
  group: SHELF,
  tags: ['flip lid bin', 'plastic bin', 'swing lid', 'household bin', 'thùng rác nắp lật', 'thùng rác nhựa', 'thùng rác'],
  description: 'The everyday Vietnamese household bin: a tapered polypropylene tub with a lid frame and a centre-pivot flap that tips when pushed; 15 litres.',
  price: est(120_000),
  defaultSize: { w: 0.28, d: 0.23, h: 0.38 },
  minSize: { w: 0.22, d: 0.18, h: 0.3 },
  maxSize: { w: 0.36, d: 0.3, h: 0.5 },
  slots: [matSlot('body', 'Tub', 'plastic-blue'), matSlot('lid', 'Lid & flap', 'plastic-blue')],
  variants: [
    { id: 'green', name: 'Green', materials: { body: 'plastic-green', lid: 'plastic-green' } },
    { id: 'grey', name: 'Grey', materials: { body: 'solid-mid-grey', lid: 'solid-mid-grey' } },
    { id: 'red', name: 'Red', materials: { body: 'plastic-red', lid: 'plastic-red' } },
    { id: 'yellow', name: 'Yellow', materials: { body: 'plastic-yellow', lid: 'plastic-yellow' } },
    { id: 'white', name: 'White', materials: { body: 'plastic-white', lid: 'plastic-white' } },
  ],
  build: ({ w, d, h }) => {
    const hb = h - 0.05;
    const prof: V2[] = [[-d / 2 + 0.022, 0], [d / 2 - 0.022, 0], [d / 2 - 0.004, hb], [-d / 2 + 0.004, hb]];
    const parts: Part[] = [
      sidePlate('body', prof, -w / 2 + 0.016, w - 0.032, true),
      sp('body', [-w / 2 + 0.006, w / 2 - 0.006], [hb - 0.03, hb], [-d / 2 + 0.002, d / 2 - 0.002], 0.006),
      sp('lid', [-w / 2, w / 2], [hb, hb + 0.022], [-d / 2, d / 2], 0.006),
      box('lid', [0, hb + 0.03, 0], [w - 0.07, 0.008, d - 0.06], { rotation: [-0.1, 0, 0], bevel: 0.003, plan: false }),
    ];
    for (const sx of [-1, 1]) parts.push(sp('lid', [sx * (w / 2 - 0.035) - 0.01, sx * (w / 2 - 0.035) + 0.01], [hb + 0.018, hb + 0.04], [-0.012, 0.012], 0.004));
    return parts;
  },
});

// ── Bathroom ─────────────────────────────────────────────────────────────────

const steelPedal5 = defineItem({
  id: 'brushed-steel-pedal-bin-5l',
  name: 'Brushed steel round pedal bin, 5 L',
  category: 'bathroom',
  type: 'plumbing',
  group: BATH,
  tags: ['pedal bin', 'bathroom bin', 'small bin', 'stainless steel', 'thùng rác nhà tắm', 'thùng rác đạp chân', '5 litre'],
  description: 'A small round pedal bin for the bathroom in brushed stainless steel with a domed lid, a plastic base and a 5-litre removable bucket.',
  price: est(350_000),
  defaultSize: { w: 0.21, d: 0.25, h: 0.28 },
  minSize: { w: 0.18, d: 0.22, h: 0.24 },
  maxSize: { w: 0.25, d: 0.29, h: 0.34 },
  slots: [matSlot('body', 'Body', 'metal-brushed-steel'), matSlot('lid', 'Lid', 'metal-brushed-steel'), matSlot('trim', 'Pedal, hinge & base', 'plastic-black')],
  variants: [
    PEDAL_LOOKS.white,
    PEDAL_LOOKS.black,
    { id: 'rose-gold', name: 'Rose gold', materials: { body: 'metal-rose-gold', lid: 'metal-rose-gold' } },
    { id: 'brass', name: 'Brushed brass', materials: { body: 'metal-brass', lid: 'metal-brass' } },
    PEDAL_LOOKS.sage,
  ],
  build: (s) => roundBin(s, { pedal: 0.035, lid: 'dome' }),
});

const whiteMini3 = defineItem({
  id: 'white-mini-pedal-bin-3l',
  name: 'White mini pedal bin, 3 L',
  category: 'bathroom',
  type: 'plumbing',
  group: BATH,
  tags: ['mini bin', 'pedal bin', 'bathroom bin', 'plastic bin', 'thùng rác mini', 'thùng rác đạp chân', 'cosmetic bin'],
  description: 'A tiny white plastic pedal bin with soft rounded corners and a grey lid, for the bathroom floor or beside a dressing table; 3 litres.',
  price: est(150_000),
  defaultSize: { w: 0.17, d: 0.2, h: 0.24 },
  minSize: { w: 0.15, d: 0.18, h: 0.2 },
  maxSize: { w: 0.21, d: 0.24, h: 0.28 },
  slots: [matSlot('body', 'Body', 'plastic-white'), matSlot('lid', 'Lid', 'solid-light-grey'), matSlot('trim', 'Pedal & base', 'solid-light-grey')],
  variants: [
    { id: 'pink', name: 'Pink', materials: { body: 'plastic-pink', lid: 'plastic-white', trim: 'plastic-white' } },
    { id: 'mint', name: 'Mint', materials: { body: 'plastic-mint', lid: 'plastic-white', trim: 'plastic-white' } },
    { id: 'black', name: 'Black', materials: { body: 'plastic-black', lid: 'plastic-black', trim: 'solid-mid-grey' } },
  ],
  build: (s) => shellBin(s, rrOutline(0.05), { pedals: [0], pedalW: 0.035, lidH: 0.022 }),
});

const slimPedal6 = defineItem({
  id: 'slim-rectangular-pedal-bin-6l',
  name: 'Slim rectangular pedal bin, 6 L',
  category: 'bathroom',
  type: 'plumbing',
  group: BATH,
  tags: ['slim bin', 'pedal bin', 'bathroom bin', 'beside toilet', 'matte black', 'thùng rác nhà tắm', 'thùng rác đạp chân'],
  description: 'A slim rectangular pedal bin in matte black powder-coated steel, shallow enough to stand between the toilet and the wall, with a soft-close lid; 6 litres.',
  price: est(450_000),
  defaultSize: { w: 0.3, d: 0.19, h: 0.3 },
  minSize: { w: 0.25, d: 0.16, h: 0.26 },
  maxSize: { w: 0.36, d: 0.23, h: 0.36 },
  wallSnap: true,
  slots: [matSlot('body', 'Body', 'metal-black-matte'), matSlot('lid', 'Lid', 'metal-black-matte'), matSlot('trim', 'Pedal, hinge & base', 'plastic-black')],
  variants: [PEDAL_LOOKS.white, PEDAL_LOOKS.steel, PEDAL_LOOKS.cream, PEDAL_LOOKS.sage],
  build: (s) => shellBin(s, rrOutline(0.03), { pedals: [0], pedalW: 0.04, lidH: 0.025 }),
});

const ceramicBasket = defineItem({
  id: 'glazed-ceramic-wastebasket',
  name: 'Glazed ceramic wastebasket',
  category: 'bathroom',
  type: 'plumbing',
  group: BATH,
  tags: ['wastebasket', 'ceramic', 'bathroom bin', 'open bin', 'glazed', 'sọt rác gốm', 'thùng rác sứ'],
  description: 'An open round wastebasket in glossy glazed stoneware, slightly flared, standing on a narrow unglazed foot ring.',
  price: est(450_000),
  defaultSize: { w: 0.22, d: 0.22, h: 0.26 },
  minSize: { w: 0.18, d: 0.18, h: 0.2 },
  maxSize: { w: 0.28, d: 0.28, h: 0.32 },
  slots: [matSlot('glaze', 'Glaze', 'ceramic-cream'), matSlot('foot', 'Foot ring', 'terracotta-pot')],
  variants: [
    { id: 'sage', name: 'Sage glaze', materials: { glaze: 'ceramic-sage' } },
    { id: 'black', name: 'Black glaze', materials: { glaze: 'ceramic-black' } },
    { id: 'white', name: 'White glaze', materials: { glaze: 'ceramic-white' } },
    { id: 'blue', name: 'Blue glaze', materials: { glaze: 'ceramic-blue' } },
  ],
  build: ({ w, d, h }) => {
    const R = Math.min(w, d) / 2;
    return [
      vcyl('foot', 0, 0, 0, 0.014, R * 0.78, { segments: 40 }),
      basketShell('glaze', [[R * 0.8, 0.012], [R * 0.84, 0.03], [R * 0.97, h * 0.75], [R, h]], 0.008, { segments: 48 }),
    ];
  },
});

// ── Woven, wood, metal and leather wastebaskets ──────────────────────────────

const rattanBasket = defineItem({
  id: 'rattan-round-wastebasket',
  name: 'Rattan round wastebasket',
  category: 'bedroom',
  type: 'storage',
  group: SHELF,
  tags: ['wastebasket', 'rattan', 'woven', 'paper bin', 'sọt rác mây', 'giỏ rác', 'natural'],
  description: 'A hand-woven natural rattan wastebasket, gently tapered, with a wrapped rim and woven bands; for paper and light waste.',
  price: est(220_000),
  defaultSize: { w: 0.26, d: 0.26, h: 0.3 },
  minSize: { w: 0.2, d: 0.2, h: 0.22 },
  maxSize: { w: 0.34, d: 0.34, h: 0.4 },
  slots: [matSlot('basket', 'Rattan', 'rattan-natural')],
  variants: [
    { id: 'wicker', name: 'Fine wicker', materials: { basket: 'wicker-fine' } },
    { id: 'bamboo', name: 'Woven bamboo', materials: { basket: 'bamboo-woven' } },
    { id: 'black', name: 'Black cane', materials: { basket: 'cane-black' } },
  ],
  build: ({ w, d, h }) => {
    const R = Math.min(w, d) / 2 - 0.004;
    const outer: V2[] = [[R * 0.78, 0], [R, h - 0.004]];
    const parts: Part[] = [basketShell('basket', outer, 0.007)];
    for (const y of spaced(clamp(Math.round(h / 0.05), 3, 8), 0.04, h - 0.04)) parts.push(ring('basket', [0, y, 0], profileR(outer, y), 0.0035, O));
    parts.push(ring('basket', [0, h - 0.008, 0], R - 0.002, 0.0075, O), ring('basket', [0, 0.008, 0], R * 0.78 - 0.002, 0.006, O));
    return parts;
  },
});

const seagrassBasket = defineItem({
  id: 'seagrass-belly-wastebasket',
  name: 'Seagrass belly wastebasket with rope handles',
  category: 'bedroom',
  type: 'storage',
  group: SHELF,
  tags: ['wastebasket', 'seagrass', 'woven basket', 'belly basket', 'sọt cỏ biển', 'giỏ rác', 'boho'],
  description: 'A round belly-shaped basket coiled from seagrass, narrowing to the rim, with two twisted rope handles; used as a bedroom or bathroom wastebasket.',
  price: est(250_000),
  defaultSize: { w: 0.3, d: 0.3, h: 0.32 },
  minSize: { w: 0.22, d: 0.22, h: 0.24 },
  maxSize: { w: 0.4, d: 0.4, h: 0.42 },
  slots: [matSlot('basket', 'Seagrass', 'rug-seagrass'), matSlot('handles', 'Rope handles', 'fabric-hessian')],
  variants: [
    { id: 'water-hyacinth', name: 'Water hyacinth', materials: { basket: 'wicker-fine' } },
    { id: 'jute', name: 'Jute', materials: { basket: 'rug-jute' } },
    { id: 'black-handles', name: 'Black rope', materials: { handles: 'fabric-charcoal' } },
  ],
  build: ({ w, d, h }) => {
    const R = Math.min(w, d) / 2 - 0.012;
    const outer: V2[] = [[R * 0.72, 0], [R * 0.92, h * 0.25], [R, h * 0.5], [R * 0.94, h * 0.78], [R * 0.86, h]];
    const parts: Part[] = [basketShell('basket', outer, 0.009, { segments: 44 })];
    for (const y of spaced(clamp(Math.round(h / 0.035), 4, 12), 0.03, h - 0.03)) parts.push(ring('basket', [0, y, 0], profileR(outer, y), 0.004, O));
    for (const sx of [-1, 1]) parts.push(torus('handles', [sx * (R * 0.86 + 0.004), h - 0.03, 0], 0.032, 0.006, { rotation: [0, Math.PI / 2, 0], arc: Math.PI, plan: false }));
    return parts;
  },
});

const canePanelBasket = defineItem({
  id: 'oak-cane-square-wastebasket',
  name: 'Oak and cane square wastebasket',
  category: 'bedroom',
  type: 'storage',
  group: SHELF,
  tags: ['wastebasket', 'cane webbing', 'oak', 'square bin', 'sọt rác gỗ', 'mây đan', 'japandi'],
  description: 'A square open wastebasket with a solid oak frame, a slatted oak base and rattan cane-webbing panels on all four sides.',
  price: est(650_000),
  defaultSize: { w: 0.26, d: 0.26, h: 0.32 },
  minSize: { w: 0.2, d: 0.2, h: 0.24 },
  maxSize: { w: 0.34, d: 0.34, h: 0.42 },
  slots: [matSlot('frame', 'Oak frame', 'wood-oak-natural'), matSlot('cane', 'Cane panels', 'cane-natural')],
  variants: [
    { id: 'walnut', name: 'Walnut & cane', materials: { frame: 'wood-walnut' } },
    { id: 'black', name: 'Black ash & cane', materials: { frame: 'wood-ash-black' } },
    { id: 'white-oak', name: 'White oak & black cane', materials: { frame: 'wood-white-oak', cane: 'cane-black' } },
  ],
  build: ({ w, d, h }) => {
    const p = 0.02;
    const parts: Part[] = [span('frame', [-w / 2 + p, w / 2 - p], [0.012, 0.024], [-d / 2 + p, d / 2 - p], { plan: false })];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(span('frame', sx < 0 ? [-w / 2, -w / 2 + p] : [w / 2 - p, w / 2], [0, h], sz < 0 ? [-d / 2, -d / 2 + p] : [d / 2 - p, d / 2], { bevel: 0.003 }));
    for (const y of [[0.008, 0.028], [h - 0.018, h - 0.002]] as V2[]) {
      parts.push(
        sp('frame', [-w / 2 + p, w / 2 - p], y, [-d / 2 + 0.002, -d / 2 + 0.016]),
        sp('frame', [-w / 2 + p, w / 2 - p], y, [d / 2 - 0.016, d / 2 - 0.002]),
        sp('frame', [-w / 2 + 0.002, -w / 2 + 0.016], y, [-d / 2 + p, d / 2 - p]),
        sp('frame', [w / 2 - 0.016, w / 2 - 0.002], y, [-d / 2 + p, d / 2 - p]),
      );
    }
    const yc: V2 = [0.028, h - 0.018];
    parts.push(
      sp('cane', [-w / 2 + p, w / 2 - p], yc, [-d / 2 + 0.006, -d / 2 + 0.01]),
      sp('cane', [-w / 2 + p, w / 2 - p], yc, [d / 2 - 0.01, d / 2 - 0.006]),
      sp('cane', [-w / 2 + 0.006, -w / 2 + 0.01], yc, [-d / 2 + p, d / 2 - p]),
      sp('cane', [w / 2 - 0.01, w / 2 - 0.006], yc, [-d / 2 + p, d / 2 - p]),
    );
    return parts;
  },
});

const teakBasket = defineItem({
  id: 'turned-teak-wastebasket',
  name: 'Turned teak wastebasket with brass rim',
  category: 'living',
  type: 'storage',
  group: SHELF,
  tags: ['wastebasket', 'teak', 'wooden bin', 'turned wood', 'sọt rác gỗ', 'thùng rác gỗ', 'brass'],
  description: 'A round open wastebasket turned from solid teak, oiled to a warm glow, with a thin brass band around the rim and a recessed foot.',
  price: est(750_000),
  defaultSize: { w: 0.26, d: 0.26, h: 0.3 },
  minSize: { w: 0.2, d: 0.2, h: 0.22 },
  maxSize: { w: 0.32, d: 0.32, h: 0.38 },
  slots: [matSlot('wood', 'Wood', 'wood-teak'), matSlot('rim', 'Rim band', 'metal-brass')],
  variants: [
    { id: 'walnut', name: 'Walnut', materials: { wood: 'wood-walnut' } },
    { id: 'oak', name: 'Oak & black', materials: { wood: 'wood-oak-natural', rim: 'metal-black-matte' } },
    { id: 'acacia', name: 'Acacia & copper', materials: { wood: 'wood-acacia', rim: 'metal-copper' } },
  ],
  build: ({ w, d, h }) => {
    const R = Math.min(w, d) / 2 - 0.004;
    return [
      vcyl('wood', 0, 0, 0, 0.012, R * 0.86, { segments: 40 }),
      basketShell('wood', [[R * 0.9, 0.01], [R * 0.93, 0.02], [R, h * 0.85], [R, h]], 0.012, { segments: 48, plan: false }),
      vcyl('rim', 0, 0, h - 0.03, h - 0.012, R + 0.003, { segments: 48, plan: false }),
    ];
  },
});

const brassWireBasket = defineItem({
  id: 'brass-wire-lattice-wastebasket',
  name: 'Brass wire lattice wastebasket',
  category: 'bedroom',
  type: 'storage',
  group: SHELF,
  tags: ['wastebasket', 'wire basket', 'brass', 'lattice', 'sọt rác kim loại', 'giỏ rác', 'see-through'],
  description: 'An open round wastebasket of crossing brass-plated steel wires forming a diamond lattice, with a solid round base plate and a rolled top rim.',
  price: est(380_000),
  defaultSize: { w: 0.25, d: 0.25, h: 0.3 },
  minSize: { w: 0.2, d: 0.2, h: 0.22 },
  maxSize: { w: 0.32, d: 0.32, h: 0.38 },
  slots: [matSlot('wire', 'Wire', 'metal-brass')],
  variants: [
    { id: 'black', name: 'Black', materials: { wire: 'metal-black-matte' } },
    { id: 'white', name: 'White', materials: { wire: 'metal-white-powder' } },
    { id: 'chrome', name: 'Chrome', materials: { wire: 'metal-chrome' } },
    { id: 'copper', name: 'Copper', materials: { wire: 'metal-copper' } },
  ],
  build: ({ w, d, h }) => {
    const rt = Math.min(w, d) / 2 - 0.006;
    const rb = rt * 0.82;
    const n = 14;
    const twist = TAU / n;
    const parts: Part[] = [cyl('wire', [0, 0.004, 0], rb + 0.002, 0.008, { segments: 32 }), ring('wire', [0, h - 0.006, 0], rt, 0.005, O), ring('wire', [0, 0.01, 0], rb, 0.003, O), ring('wire', [0, h * 0.5, 0], lerp(rb, rt, 0.5) * Math.cos(twist / 2), 0.002, O)];
    for (const i of range(n)) {
      const a = i * twist;
      parts.push(rod('wire', polar(a, rb, 0.01), polar(a + twist, rt, h - 0.006), 0.0018, { segments: 5, plan: false }));
      parts.push(rod('wire', polar(a, rb, 0.01), polar(a - twist, rt, h - 0.006), 0.0018, { segments: 5, plan: false }));
    }
    return parts;
  },
});

// ── Office ───────────────────────────────────────────────────────────────────

const meshBasket = defineItem({
  id: 'steel-mesh-wastepaper-basket',
  name: 'Black steel mesh wastepaper basket',
  category: 'office',
  type: 'storage',
  group: SHELF,
  tags: ['wastepaper basket', 'mesh bin', 'office bin', 'under desk', 'sọt rác lưới', 'thùng rác văn phòng', 'paper bin'],
  description: 'The classic office wastepaper basket: a round black powder-coated steel mesh, slightly flared, with a solid base and a rolled rim.',
  price: est(150_000),
  defaultSize: { w: 0.28, d: 0.28, h: 0.33 },
  minSize: { w: 0.22, d: 0.22, h: 0.26 },
  maxSize: { w: 0.34, d: 0.34, h: 0.4 },
  slots: [matSlot('mesh', 'Mesh & rim', 'metal-black-matte')],
  variants: [
    { id: 'silver', name: 'Silver', materials: { mesh: 'metal-brushed-steel' } },
    { id: 'white', name: 'White', materials: { mesh: 'metal-white-powder' } },
    { id: 'gold', name: 'Gold', materials: { mesh: 'metal-gold' } },
  ],
  build: ({ w, d, h }) => {
    const rt = Math.min(w, d) / 2 - 0.007;
    const rb = rt * 0.84;
    const prof: V2[] = [[rb, 0.01], [rt, h - 0.007]];
    const parts: Part[] = [cyl('mesh', [0, 0.005, 0], rb + 0.002, 0.01, { segments: 36 }), ring('mesh', [0, h - 0.007, 0], rt, 0.006, O), ring('mesh', [0, 0.012, 0], rb, 0.004, O)];
    for (const i of range(40)) {
      const a = (i / 40) * TAU;
      parts.push(rod('mesh', polar(a, rb, 0.01), polar(a, rt, h - 0.007), 0.0016, { segments: 4, plan: false }));
    }
    for (const y of spaced(clamp(Math.round(h / 0.035), 5, 11), 0.035, h - 0.03)) parts.push(ring('mesh', [0, y, 0], profileR(prof, y), 0.0016, O));
    return parts;
  },
});

const leatherBasket = defineItem({
  id: 'stitched-leather-wastebasket',
  name: 'Stitched leather wastebasket',
  category: 'office',
  type: 'storage',
  group: SHELF,
  tags: ['wastebasket', 'leather', 'paper bin', 'study', 'executive', 'sọt rác da', 'thùng rác văn phòng'],
  description: 'A straight-sided round wastebasket wrapped in tan saddle leather, with a contrast-stitched darker rim and two leather loop handles.',
  price: est(1_100_000),
  defaultSize: { w: 0.26, d: 0.26, h: 0.32 },
  minSize: { w: 0.22, d: 0.22, h: 0.26 },
  maxSize: { w: 0.32, d: 0.32, h: 0.38 },
  slots: [matSlot('leather', 'Leather', 'leather-tan'), matSlot('trim', 'Rim & handles', 'leather-chocolate')],
  variants: [
    { id: 'black', name: 'Black', materials: { leather: 'leather-smooth-black', trim: 'leather-black' } },
    { id: 'cognac', name: 'Cognac', materials: { leather: 'leather-cognac' } },
    { id: 'grey', name: 'Grey & black', materials: { leather: 'leather-grey', trim: 'leather-black' } },
  ],
  build: ({ w, d, h }) => {
    const R = Math.min(w, d) / 2 - 0.012;
    return [
      basketShell('leather', [[R, 0], [R, h - 0.012]], 0.005, { segments: 48 }),
      ring('trim', [0, h - 0.012, 0], R - 0.002, 0.008, O),
      vcyl('trim', 0, 0, 0.002, 0.016, R + 0.002, { segments: 48, plan: false }),
      torus('trim', [-(R + 0.002), h - 0.05, 0], 0.025, 0.005, { rotation: [0, Math.PI / 2, 0], arc: Math.PI, plan: false }),
      torus('trim', [R + 0.002, h - 0.05, 0], 0.025, 0.005, { rotation: [0, Math.PI / 2, 0], arc: Math.PI, plan: false }),
    ];
  },
});

const officeSwing25 = defineItem({
  id: 'round-swing-lid-office-bin-25l',
  name: 'Round swing-lid office bin, 25 L',
  category: 'office',
  type: 'storage',
  group: SHELF,
  tags: ['swing lid bin', 'office bin', 'round bin', 'plastic bin', 'thùng rác nắp lắc', 'thùng rác văn phòng', 'hood bin'],
  description: 'A round grey plastic bin with a tall domed hood and a swing flap in the front, the kind found in offices and corridors; 25 litres.',
  price: est(280_000),
  defaultSize: { w: 0.3, d: 0.3, h: 0.6 },
  minSize: { w: 0.25, d: 0.25, h: 0.48 },
  maxSize: { w: 0.36, d: 0.36, h: 0.72 },
  slots: [matSlot('body', 'Body', 'solid-mid-grey'), matSlot('lid', 'Domed hood', 'solid-light-grey'), matSlot('trim', 'Swing flap & hinge', 'solid-mid-grey')],
  variants: [
    { id: 'white', name: 'White', materials: { body: 'plastic-white', lid: 'plastic-white', trim: 'solid-light-grey' } },
    { id: 'black', name: 'Black', materials: { body: 'plastic-black', lid: 'plastic-black', trim: 'solid-mid-grey' } },
    { id: 'steel', name: 'Stainless', materials: { body: 'metal-brushed-steel', lid: 'metal-brushed-steel', trim: 'plastic-black' } },
  ],
  build: (s) => {
    const r = Math.min(s.w, s.d) / 2 - 0.002;
    const lidH = clamp(s.h * 0.2, 0.09, 0.14);
    const hb = s.h - lidH;
    return [
      ...roundBin(s, { lid: 'tall-dome', lidH, base: false }),
      box('trim', [0, hb + lidH * 0.42, r * 0.8], [r * 0.95, lidH * 0.5, 0.006], { rotation: [-0.65, 0, 0], bevel: 0.002, plan: false }),
    ];
  },
});

const paperBox = defineItem({
  id: 'paper-recycling-box',
  name: 'Paper recycling box with slot lid',
  category: 'office',
  type: 'storage',
  group: SHELF,
  tags: ['paper recycling', 'recycling box', 'office bin', 'confidential paper', 'thùng rác giấy', 'thùng tái chế', 'recycling'],
  description: 'A blue polypropylene box for waste paper, with a lid that has a long posting slot, side hand-holds and a white recycling triangle on the front.',
  price: est(320_000),
  defaultSize: { w: 0.32, d: 0.25, h: 0.45 },
  minSize: { w: 0.26, d: 0.2, h: 0.35 },
  maxSize: { w: 0.4, d: 0.32, h: 0.6 },
  wallSnap: true,
  slots: [matSlot('body', 'Box', 'plastic-blue'), matSlot('lid', 'Lid', 'plastic-blue'), matSlot('print', 'Recycling symbol', 'plastic-white'), matSlot('trim', 'Slot & hand-holds', 'plastic-black')],
  variants: [
    { id: 'green', name: 'Green', materials: { body: 'plastic-green', lid: 'plastic-green' } },
    { id: 'grey', name: 'Grey with blue lid', materials: { body: 'solid-mid-grey', lid: 'plastic-blue' } },
    { id: 'white', name: 'White', materials: { body: 'plastic-white', lid: 'plastic-white', print: 'plastic-green' } },
  ],
  build: ({ w, d, h }) => {
    const front = d / 2 - 0.004;
    const parts: Part[] = [
      span('body', [-w / 2 + 0.004, w / 2 - 0.004], [0, h - 0.03], [-d / 2 + 0.004, front], { bevel: 0.006 }),
      span('lid', [-w / 2, w / 2], [h - 0.03, h], [-d / 2, d / 2], { bevel: 0.006, plan: false }),
      sp('trim', [-w * 0.3, w * 0.3], [h - 0.004, h + 0.001], [-0.012, 0.012], 0.002),
    ];
    for (const sx of [-1, 1]) parts.push(sp('trim', sx < 0 ? [-w / 2 + 0.002, -w / 2 + 0.006] : [w / 2 - 0.006, w / 2 - 0.002], [h - 0.12, h - 0.09], [-0.05, 0.05], 0.0015));
    const s = Math.min(0.05, w * 0.16);
    const cy = h * 0.52;
    for (const k of range(3)) {
      const a = Math.PI / 2 + (k * TAU) / 3 + Math.PI / 3;
      parts.push(box('print', [Math.cos(a) * s * 0.5, cy + Math.sin(a) * s * 0.5, front + 0.0015], [s * 1.25, 0.009, 0.003], { rotation: [0, 0, a + Math.PI / 2], plan: false }));
    }
    return parts;
  },
});

// ── Outdoor ──────────────────────────────────────────────────────────────────

const WHEELIE_VARIANTS = [
  { id: 'blue', name: 'Blue', materials: { body: 'solid-blue', lid: 'solid-blue' } },
  { id: 'orange', name: 'Orange', materials: { body: 'paint-burnt-orange', lid: 'paint-burnt-orange' } },
  { id: 'yellow', name: 'Yellow', materials: { body: 'solid-yellow', lid: 'solid-yellow' } },
  { id: 'grey', name: 'Grey', materials: { body: 'solid-mid-grey', lid: 'solid-mid-grey' } },
  { id: 'grey-green-lid', name: 'Grey with green lid', materials: { body: 'solid-mid-grey', lid: 'solid-green' } },
];

/** Two-wheeled bin with a tapered body, overhanging lid, back handle and axle. */
function wheelieBin({ w, d, h }: Size3): Part[] {
  const wr = clamp(h * 0.095, 0.08, 0.11);
  const zw = -d / 2 + wr + 0.005;
  const bx = w / 2 - 0.065;
  const yb = 0.04;
  const top = h - 0.06;
  const prof: V2[] = [[-d / 2 + 0.06, yb], [d / 2 - 0.09, yb], [d / 2 - 0.035, top], [-d / 2 + 0.03, top]];
  const parts: Part[] = [
    sidePlate('body', prof, -bx, 2 * bx, true),
    sp('body', [-bx - 0.012, bx + 0.012], [top - 0.05, top], [-d / 2 + 0.024, d / 2 - 0.028], 0.01),
    span('lid', [-bx - 0.016, bx + 0.016], [top, top + 0.03], [-d / 2 + 0.012, d / 2], { bevel: 0.01, plan: false }),
    sp('lid', [-bx + 0.02, bx - 0.02], [top - 0.035, top + 0.005], [d / 2 - 0.022, d / 2], 0.006),
    sp('lid', [-bx * 0.6, bx * 0.6], [top + 0.026, h - 0.014], [-d / 2 + 0.1, d / 2 - 0.08], 0.008),
    rodX('trim', -bx + 0.03, bx - 0.03, top - 0.035, -d / 2 + 0.016, 0.016, O),
    rodX('trim', -w / 2 + 0.06, w / 2 - 0.06, wr, zw, 0.012, O),
  ];
  for (const sx of [-1, 1]) {
    const fx = sx * (bx - 0.05);
    parts.push(
      sp('body', [fx - 0.035, fx + 0.035], [0, yb + 0.01], [d / 2 - 0.2, d / 2 - 0.1], 0.006),
      rod('wheels', [sx * (w / 2 - 0.06), wr, zw], [sx * (w / 2 - 0.006), wr, zw], wr, { segments: 24, plan: false }),
      rod('trim', [sx * (w / 2 - 0.009), wr, zw], [sx * (w / 2 - 0.001), wr, zw], wr * 0.45, { segments: 16, plan: false }),
      // Rib down each back corner over the wheel housing.
      sp('body', sx < 0 ? [-bx - 0.008, -bx + 0.03] : [bx - 0.03, bx + 0.008], [wr * 2 + 0.01, top - 0.05], [-d / 2 + 0.035, -d / 2 + 0.07], 0.006),
    );
  }
  return parts;
}

const wheelie120 = defineItem({
  id: 'wheelie-bin-120l',
  name: 'Wheelie bin, 120 L',
  category: 'outdoor',
  type: 'storage',
  group: SHELF,
  tags: ['wheelie bin', 'outdoor bin', 'wheeled bin', 'garbage bin', 'thùng rác 120 lít', 'thùng rác có bánh xe', 'thùng rác công cộng'],
  description: 'A two-wheeled 120-litre HDPE wheelie bin with a hinged lid and back handle, the green bin used for apartment corridors, shops and garden waste in Vietnam.',
  price: est(750_000),
  defaultSize: { w: 0.48, d: 0.55, h: 0.93 },
  minSize: { w: 0.44, d: 0.5, h: 0.85 },
  maxSize: { w: 0.54, d: 0.62, h: 1.0 },
  slots: [matSlot('body', 'Body', 'solid-green'), matSlot('lid', 'Lid', 'solid-green'), matSlot('wheels', 'Wheels', 'rubber-black'), matSlot('trim', 'Handle, axle & hubs', 'plastic-black')],
  variants: WHEELIE_VARIANTS,
  build: wheelieBin,
});

const wheelie240 = defineItem({
  id: 'wheelie-bin-240l',
  name: 'Wheelie bin, 240 L',
  category: 'outdoor',
  type: 'storage',
  group: SHELF,
  tags: ['wheelie bin', 'large outdoor bin', 'wheeled bin', 'garbage bin', 'thùng rác 240 lít', 'thùng rác có bánh xe', 'thùng rác công cộng'],
  description: 'A large two-wheeled 240-litre HDPE wheelie bin with a hinged lid, back handle and rubber wheels, used by Vietnamese buildings and streets for collected waste.',
  price: est(1_300_000),
  defaultSize: { w: 0.58, d: 0.73, h: 1.07 },
  minSize: { w: 0.54, d: 0.66, h: 1.0 },
  maxSize: { w: 0.64, d: 0.8, h: 1.15 },
  slots: [matSlot('body', 'Body', 'solid-green'), matSlot('lid', 'Lid', 'solid-green'), matSlot('wheels', 'Wheels', 'rubber-black'), matSlot('trim', 'Handle, axle & hubs', 'plastic-black')],
  variants: WHEELIE_VARIANTS,
  build: wheelieBin,
});

const twinOutdoor = defineItem({
  id: 'twin-recycling-bin-stand',
  name: 'Twin recycling bins on a steel stand',
  category: 'outdoor',
  type: 'storage',
  group: SHELF,
  tags: ['twin bin', 'recycling bin', 'public bin', 'outdoor bin', 'balcony', 'thùng rác đôi', 'thùng rác phân loại'],
  description: 'A public-style pair of 40-litre plastic bins, one green for organic waste and one blue for recyclables, hanging from a steel post stand with grey hooded tops and front openings.',
  price: est(2_600_000),
  defaultSize: { w: 0.9, d: 0.4, h: 1.0 },
  minSize: { w: 0.75, d: 0.34, h: 0.85 },
  maxSize: { w: 1.1, d: 0.48, h: 1.15 },
  wallSnap: true,
  slots: [matSlot('bin-a', 'Left bin (organic)', 'solid-green'), matSlot('bin-b', 'Right bin (recyclable)', 'solid-blue'), matSlot('hood', 'Hoods', 'solid-mid-grey'), matSlot('frame', 'Stand & openings', 'metal-anthracite')],
  variants: [
    { id: 'green-orange', name: 'Green & orange', materials: { 'bin-b': 'paint-burnt-orange' } },
    { id: 'green-yellow', name: 'Green & yellow', materials: { 'bin-b': 'solid-yellow' } },
    { id: 'grey-blue', name: 'Grey & blue', materials: { 'bin-a': 'solid-mid-grey' } },
  ],
  build: ({ w, d, h }) => {
    const pr = 0.022;
    const pz = -d / 2 + 0.025;
    const parts: Part[] = [rodX('frame', -w / 2 + pr, w / 2 - pr, h - 0.035, pz, 0.018, O)];
    for (const sx of [-1, 1]) {
      const px = sx * (w / 2 - pr);
      parts.push(
        vcyl('frame', px, pz, 0, h - 0.025, pr, { segments: 16 }),
        sphere('frame', [px, h - 0.025, pz], pr, O),
        sp('frame', [px - 0.022, px + 0.022], [0, 0.008], [-d / 2, -d / 2 + 0.12]),
      );
    }
    const bins: [string, V2][] = [
      ['bin-a', [-w / 2 + 0.05, -0.01]],
      ['bin-b', [0.01, w / 2 - 0.05]],
    ];
    for (const [slot, [x0, x1]] of bins) {
      const cx = (x0 + x1) / 2;
      parts.push(
        span(slot, [x0, x1], [0.14, h - 0.16], [-d / 2 + 0.05, d / 2 - 0.01], { bevel: 0.035 }),
        span('hood', [x0 - 0.005, x1 + 0.005], [h - 0.16, h - 0.07], [-d / 2 + 0.045, d / 2], { bevel: 0.03, plan: false }),
        sp('frame', [x0 + 0.04, x1 - 0.04], [h - 0.145, h - 0.09], [d / 2 - 0.012, d / 2 + 0.004], 0.01),
        sp('frame', [cx - 0.04, cx + 0.04], [h - 0.09, h - 0.02], [-d / 2 + 0.03, -d / 2 + 0.05], 0.004),
      );
    }
    return parts;
  },
});

export default definePack({
  name: 'Bins',
  version: '1.0.0',
  author: 'Neest team',
  description:
    'Thirty-six waste and recycling bins: kitchen pedal bins from 5 to 45 L (round, rectangular, D-shaped, butterfly and bamboo lids), touchless motion-sensor bins, dual and three-bin recycling, Japanese stacking sorting bins, a slim gap bin, a compost caddy, the Vietnamese thùng rác nắp lật, bathroom bins, woven, wood, ceramic, wire and leather wastebaskets, office bins, and 120 L and 240 L wheelie bins.',
  license: 'CC0 (made for Neest)',
  items: [
    creamPedal12,
    steelPedal30,
    tallPedal45,
    rectSoftClose40,
    dShapeStep30,
    sageStep20,
    bambooLid20,
    butterfly30,
    roundSensor30,
    rectSensor45,
    dualRecycling,
    slimGap25,
    swingSquare40,
    compostCaddy,
    doorCaddy,
    stackingCrates,
    recyclingStation,
    japaneseSorting,
    vnFlipLid15,
    steelPedal5,
    whiteMini3,
    slimPedal6,
    slimSensor9,
    ceramicBasket,
    rattanBasket,
    seagrassBasket,
    canePanelBasket,
    teakBasket,
    brassWireBasket,
    meshBasket,
    leatherBasket,
    officeSwing25,
    paperBox,
    wheelie120,
    wheelie240,
    twinOutdoor,
  ],
});

/**
 * Stools — 35 stools for every room: bar and counter stools (gas-lift swivel, low-back walnut,
 * hairpin, sheet steel, cross-braced oak, channel-tufted velvet, rattan, tractor seat, bentwood with
 * cane, Shaker tape seat), Vietnamese everyday stools (ghế nhựa đỏ, tall round plastic stool, đôn gỗ,
 * glazed đôn sứ, ghế tre, long ghế băng), workshop and studio stools (lab stool on castors, wobble
 * stool, round piano stool, box stool, steel step stool) and small low ones (milking stool, spool
 * stool, kids' step stool, mushroom, tree stump, Japanese low stool, cork, butterfly, camp stool,
 * tulip, skirted vanity stool, X-frame stool, tufted footstool).
 *
 * Local space: origin at the centre of the footprint on the floor, +z is the front. Round stools
 * size their seat from the smaller of width and depth so they stay inside the box at any size.
 */
import {
  clamp,
  cells,
  cushion,
  cyl,
  defineItem,
  definePack,
  lathe,
  lerp,
  matSlot,
  prism,
  range,
  ring,
  rod,
  rodPath,
  rodX,
  rodZ,
  roundRectPoints,
  spaced,
  span,
  sphere,
  torus,
  turnedLeg,
  vcyl,
  type Part,
  type Size3,
  type V2,
  type V3,
} from '@/packs/kit';

// ── Shared helpers ───────────────────────────────────────────────────────────

const TAU = Math.PI * 2;
const O = { plan: false } as const;
const GROUP = 'Stools & benches';

/** Detail box (hidden from the plan) spanning x/y/z ranges, with an optional bevel. */
const sp = (slot: string, x: V2, y: V2, z: V2, bevel = 0): Part => span(slot, x, y, z, { bevel, plan: false });

/** Point a fraction `t` of the way from a to b. */
const along = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** Point at angle `a` (0 = +x, π/2 = +z, the front) and radius `r`, at height y. */
const polar = (a: number, r: number, y: number): V3 => [Math.cos(a) * r, y, Math.sin(a) * r];

/**
 * Square-section member from a to b (a box version of `rod`). For a mostly vertical member `tx` is
 * its thickness along x and `tz` along z. Hidden from the plan.
 */
function stick(slot: string, a: V3, b: V3, tx: number, tz = tx, bevel = 0): Part {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz) || 0.002;
  const rot: V3 = [Math.atan2(dz / len, dy / len), 0, Math.atan2(-dx / len, Math.hypot(dy, dz) / len)];
  return {
    shape: 'box',
    size: [tx, len, tz],
    ...(bevel > 0 ? { bevel } : {}),
    position: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2],
    rotation: rot,
    slot,
    plan: false,
  };
}

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

/** A disc facing outward from the centre at angle `a`: from radius r0 to r1, at height y. */
const radialDisc = (slot: string, a: number, r0: number, r1: number, y: number, rad: number): Part =>
  rod(slot, polar(a, r0, y), polar(a, r1, y), rad, { plan: false });

/** Torus standing upright, its hole facing outward from the centre at angle `a`. */
const radialRing = (slot: string, a: number, r: number, y: number, radius: number, tube: number): Part =>
  torus(slot, polar(a, r, y), radius, tube, { rotation: [0, Math.PI / 2 - a, 0], plan: false });

/** Linear interpolation of a lathe profile's radius at height y (profile is [r, y], y ascending). */
function profileR(profile: V2[], y: number): number {
  for (let i = 1; i < profile.length; i++) {
    const [r0, y0] = profile[i - 1];
    const [r1, y1] = profile[i];
    if (y >= y0 && y <= y1 && y1 > y0) return lerp(r0, r1, (y - y0) / (y1 - y0));
  }
  return profile[profile.length - 1][0];
}

/** Gas-lift column with a dust sleeve, from y0 to y1, plus a swivel plate under the seat. */
function gasColumn(frame: string, sleeve: string, y0: number, y1: number, rSleeve = 0.03): Part[] {
  const ySplit = lerp(y0, y1, 0.62);
  return [
    vcyl(sleeve, 0, 0, y0, ySplit, rSleeve, O),
    vcyl(frame, 0, 0, ySplit, y1 - 0.02, rSleeve * 0.48, O),
    cyl(sleeve, [0, y1 - 0.01, 0], 0.075, 0.02, O),
  ];
}

// ── Bar & counter stools ─────────────────────────────────────────────────────

const gasLiftStool = defineItem({
  id: 'gas-lift-swivel-bar-stool',
  name: 'Gas-lift swivel bar stool',
  category: 'kitchen',
  type: 'seating',
  group: GROUP,
  tags: ['bar stool', 'swivel stool', 'adjustable', 'gas lift', 'chrome', 'foot ring', 'kitchen island', 'ghế quầy bar', 'ghế bar xoay'],
  description: 'A height-adjustable bar stool with a padded faux-leather seat on a chrome gas-lift column, a foot ring and a weighted round base.',
  defaultSize: { w: 0.42, d: 0.42, h: 0.8 },
  minSize: { w: 0.36, d: 0.36, h: 0.6 },
  maxSize: { w: 0.48, d: 0.48, h: 0.86 },
  slots: [
    matSlot('seat', 'Seat', 'leather-black'),
    matSlot('frame', 'Column, base & foot ring', 'metal-chrome'),
    matSlot('trim', 'Seat shell & lever', 'plastic-black'),
  ],
  variants: [
    { id: 'white', name: 'White seat', materials: { seat: 'leather-white' } },
    { id: 'cognac', name: 'Cognac seat', materials: { seat: 'leather-cognac' } },
    { id: 'green-velvet', name: 'Green velvet', materials: { seat: 'fabric-velvet-green' } },
    { id: 'black-base', name: 'All black', materials: { frame: 'metal-black-matte' } },
  ],
  build: ({ w, d, h }) => {
    const R = Math.min(w, d) / 2;
    const yS = h - 0.075;
    const yF = clamp(yS * 0.42, 0.2, 0.32);
    const Rb = R - 0.005;
    const Rf = R * 0.78;
    const parts: Part[] = [
      lathe('frame', [0, 0, 0], [[0, 0], [Rb, 0], [Rb, 0.008], [Rb * 0.92, 0.016], [Rb * 0.55, 0.03], [0.06, 0.042], [0, 0.042]], { segments: 40 }),
      vcyl('frame', 0, 0, 0.042, yF - 0.015, 0.028, O),
      cyl('frame', [0, yF, 0], 0.036, 0.03, O),
      ...gasColumn('frame', 'trim', yF + 0.015, yS - 0.03, 0.031),
      ring('frame', [0, yF, 0], Rf, 0.011, O),
      lathe('trim', [0, yS - 0.03, 0], [[0, 0], [0.09, 0], [R * 0.9, 0.026], [R * 0.9, 0.03], [0, 0.03]], { segments: 32, plan: false }),
      lathe('seat', [0, yS, 0], [[0, 0], [R * 0.9, 0], [R - 0.004, 0.018], [R, 0.04], [R * 0.96, 0.065], [R * 0.75, 0.075], [0, 0.072]], { segments: 40 }),
      torus('trim', [0, yS + 0.04, 0], R - 0.003, 0.0035, { rotation: [Math.PI / 2, 0, 0], plan: false }),
      rod('trim', [0.05, yS - 0.05, 0.02], [R * 0.7, yS - 0.06, R * 0.3], 0.006, O),
      sphere('trim', [R * 0.7, yS - 0.06, R * 0.3], 0.012, O),
    ];
    for (const k of range(3)) {
      const a = Math.PI / 2 + (k * TAU) / 3;
      parts.push(rod('frame', polar(a, 0.034, yF), polar(a, Rf, yF), 0.0075, O));
    }
    return parts;
  },
});

const lowBackStool = defineItem({
  id: 'low-back-walnut-bar-stool',
  name: 'Low-back walnut bar stool',
  category: 'kitchen',
  type: 'seating',
  group: GROUP,
  tags: ['bar stool', 'low back', 'walnut', 'leather pad', 'footrest', 'kitchen island', 'mid-century', 'ghế bar gỗ'],
  description: 'A solid walnut bar stool with splayed round legs, a curved low back rail, a leather seat pad and a brass kick plate on the footrest.',
  defaultSize: { w: 0.44, d: 0.44, h: 0.92 },
  minSize: { w: 0.38, d: 0.38, h: 0.78 },
  maxSize: { w: 0.5, d: 0.5, h: 1.0 },
  slots: [
    matSlot('wood', 'Seat, legs & back', 'wood-walnut'),
    matSlot('pad', 'Seat pad', 'leather-cognac'),
    matSlot('metal', 'Kick plate', 'metal-brass'),
  ],
  build: ({ w, d, h }) => {
    const parts: Part[] = [];
    const yS = clamp(h - 0.17, 0.6, 0.82);
    const sT = 0.035;
    const yU = yS - sT;
    parts.push(prism('wood', roundRectPoints(0, 0.015, w - 0.02, d - 0.05, 0.05, 4), yU, sT));
    parts.push(cushion('pad', [-w / 2 + 0.035, w / 2 - 0.035], [yS, yS + 0.024], [-d / 2 + 0.075, d / 2 - 0.03], { softness: 0.45, plan: false }));
    const foot = (sx: number, sz: number): V3 => [sx * (w / 2 - 0.022), 0, sz * (d / 2 - 0.022)];
    const top = (sx: number, sz: number): V3 => [sx * (w / 2 - 0.075), yU, sz > 0 ? d / 2 - 0.08 : -d / 2 + 0.07];
    const legAt = (sx: number, sz: number, y: number) => along(foot(sx, sz), top(sx, sz), y / yU);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(rod('wood', foot(sx, sz), top(sx, sz), 0.016, { rTop: 0.019, plan: false }));
    // Footrest at the front with a brass kick plate; back and (higher) side stretchers.
    const yF = clamp(yS * 0.38, 0.2, 0.3);
    parts.push(rod('wood', legAt(-1, 1, yF), legAt(1, 1, yF), 0.015, O));
    const fa = legAt(1, 1, yF);
    parts.push(rodX('metal', -fa[0] * 0.6, fa[0] * 0.6, yF, fa[2], 0.0168, O));
    parts.push(rod('wood', legAt(-1, -1, yF), legAt(1, -1, yF), 0.012, O));
    for (const sx of [-1, 1]) parts.push(rod('wood', legAt(sx, -1, yF + 0.07), legAt(sx, 1, yF + 0.07), 0.012, O));
    // Curved back rail on two posts.
    const Rb = 0.38;
    const wr = w / 2 - 0.06;
    const amax = Math.asin(Math.min(0.95, wr / Rb));
    const zMid = -d / 2 + 0.013;
    const n = 5;
    const step = (2 * amax) / n;
    const segW = 2 * Rb * Math.sin(step / 2) + 0.004;
    for (const i of range(n)) {
      const a = -amax + step * (i + 0.5);
      parts.push(box3('wood', [Rb * Math.sin(a), h - 0.035, zMid + Rb * (1 - Math.cos(a))], [segW, 0.07, 0.022], -a, 0.006));
    }
    const zEnd = zMid + Rb * (1 - Math.cos(amax - step / 2));
    for (const s of [-1, 1]) parts.push(rod('wood', [s * (w / 2 - 0.08), yS - 0.005, -d / 2 + 0.06], [s * Rb * Math.sin(amax - step / 2), h - 0.05, zEnd], 0.012, O));
    return parts;
  },
});

/** Box turned about the vertical axis by `ry` (hidden from the plan unless `plan`). */
function box3(slot: string, c: V3, s: V3, ry: number, bevel = 0, plan = false): Part {
  return {
    shape: 'box',
    size: [s[0], s[1], s[2]],
    ...(bevel > 0 ? { bevel: Math.min(bevel, 0.45 * Math.min(...s)) } : {}),
    position: [c[0], c[1], c[2]],
    ...(ry !== 0 ? { rotation: [0, ry, 0] as V3 } : {}),
    slot,
    ...(plan ? {} : { plan: false }),
  };
}

const hairpinStool = defineItem({
  id: 'hairpin-leg-bar-stool',
  name: 'Hairpin-leg stool with oak seat',
  category: 'kitchen',
  type: 'seating',
  group: GROUP,
  tags: ['hairpin legs', 'bar stool', 'counter stool', 'industrial', 'oak', 'steel rod', 'round seat', 'ghế đẩu chân sắt'],
  description: 'A round solid-oak seat on three black steel hairpin legs with a thin foot ring; sized from a low stool up to bar height.',
  defaultSize: { w: 0.38, d: 0.38, h: 0.75 },
  minSize: { w: 0.32, d: 0.32, h: 0.42 },
  maxSize: { w: 0.44, d: 0.44, h: 0.8 },
  slots: [matSlot('seat', 'Seat', 'wood-oak-natural'), matSlot('metal', 'Hairpin legs', 'metal-black-matte')],
  build: ({ w, d, h }) => {
    const R = Math.min(w, d) / 2;
    const sT = 0.032;
    const yU = h - sT;
    const rt = R * 0.55;
    const rb = R - 0.022;
    const parts: Part[] = [
      lathe('seat', [0, yU, 0], [[0, 0], [R - 0.008, 0], [R, 0.008], [R, sT - 0.006], [R - 0.006, sT], [0, sT]], { segments: 40 }),
    ];
    for (const k of range(3)) {
      const a = -Math.PI / 2 + (k * TAU) / 3;
      const dt = 0.025 / rt;
      const db = 0.009 / rb;
      parts.push(cyl('metal', [Math.cos(a) * rt, yU - 0.003, Math.sin(a) * rt], 0.034, 0.006, O));
      const b0 = polar(a - db, rb, 0.006);
      const b1 = polar(a + db, rb, 0.006);
      parts.push(rod('metal', polar(a - dt, rt, yU - 0.006), b0, 0.0055, O));
      parts.push(rod('metal', polar(a + dt, rt, yU - 0.006), b1, 0.0055, O));
      parts.push(rod('metal', b0, b1, 0.0055, O), sphere('metal', b0, 0.0055, O), sphere('metal', b1, 0.0055, O));
    }
    if (h > 0.58) {
      const yF = clamp(h * 0.36, 0.2, 0.3);
      parts.push(ring('metal', [0, yF, 0], lerp(rb, rt, yF / yU) - 0.002, 0.006, O));
    }
    return parts;
  },
});

/** Sheet-steel bistro stool: folded L-section legs, riveted to a dished seat pan with a skirt. */
function steelStool({ w, d, h }: Size3, bar: boolean): Part[] {
  const parts: Part[] = [];
  const sw = w * 0.84;
  const sd = d * 0.84;
  parts.push(prism('steel', roundRectPoints(0, 0, sw, sd, 0.05, 4), h - 0.005, 0.004));
  // Drain holes in the seat (dark discs just proud of the pan).
  for (const [x, z] of [[0, 0], [0.035, 0], [-0.035, 0], [0, 0.035], [0, -0.035]] as V2[]) {
    parts.push(cyl('feet', [x, h - 0.00075, z], 0.006, 0.0015, O));
  }
  // Skirt under the seat.
  const ah = bar ? 0.04 : 0.032;
  const yA: V2 = [h - 0.005 - ah, h - 0.005];
  for (const s of [-1, 1]) {
    parts.push(sp('steel', [-sw / 2 + 0.045, sw / 2 - 0.045], yA, [s * (sd / 2 - 0.006) - 0.0015, s * (sd / 2 - 0.006) + 0.0015]));
    parts.push(sp('steel', [s * (sw / 2 - 0.006) - 0.0015, s * (sw / 2 - 0.006) + 0.0015], yA, [-sd / 2 + 0.045, sd / 2 - 0.045]));
  }
  const pw = 0.042;
  const legTop = (sx: number, sz: number): V3 => [sx * (sw / 2 - 0.024), h - 0.006, sz * (sd / 2 - 0.024)];
  const legBot = (sx: number, sz: number): V3 => [sx * (w / 2 - 0.026), 0.012, sz * (d / 2 - 0.026)];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const a = legTop(sx, sz);
      const b = legBot(sx, sz);
      const offA: V3 = [sx * 0.0015, 0, -sz * pw * 0.4];
      const offB: V3 = [-sx * pw * 0.4, 0, sz * 0.0015];
      parts.push(stick('steel', [a[0] + offA[0], a[1], a[2] + offA[2]], [b[0] + offA[0], b[1], b[2] + offA[2]], 0.003, pw));
      parts.push(stick('steel', [a[0] + offB[0], a[1], a[2] + offB[2]], [b[0] + offB[0], b[1], b[2] + offB[2]], pw, 0.003));
      // Rivets fixing the leg to the skirt.
      for (const t of [0.03, 0.065]) {
        const p = along(a, b, t / (a[1] - b[1]));
        parts.push(sphere('steel', [p[0] + sx * 0.004, p[1], p[2] - sz * 0.012], 0.0042, O));
      }
      parts.push(sp('feet', [b[0] - 0.02, b[0] + 0.02], [0, 0.014], [b[2] - 0.02, b[2] + 0.02], 0.004));
    }
  }
  if (bar) {
    const yF = clamp(h * 0.34, 0.2, 0.28);
    const at = (sx: number, sz: number) => along(legBot(sx, sz), legTop(sx, sz), (yF - 0.012) / (h - 0.018));
    parts.push(...rodPath('steel', [at(-1, 1), at(1, 1), at(1, -1), at(-1, -1), at(-1, 1)], 0.009));
  }
  return parts;
}

const steelVariants = [
  { id: 'red', name: 'Red', materials: { steel: 'powder-red' } },
  { id: 'black', name: 'Black', materials: { steel: 'metal-black-matte' } },
  { id: 'white', name: 'White', materials: { steel: 'metal-white-powder' } },
  { id: 'mustard', name: 'Mustard', materials: { steel: 'powder-mustard' } },
];

const steelBarStool = defineItem({
  id: 'sheet-steel-bar-stool',
  name: 'Industrial sheet-steel bar stool',
  category: 'kitchen',
  type: 'seating',
  group: GROUP,
  tags: ['bar stool', 'metal stool', 'industrial', 'bistro', 'stackable', 'galvanised steel', 'café', 'ghế sắt'],
  description: 'A stackable bistro bar stool pressed from sheet steel: a dished seat with drain holes, folded splayed legs riveted to the skirt and a tube footrest.',
  defaultSize: { w: 0.43, d: 0.43, h: 0.76 },
  minSize: { w: 0.38, d: 0.38, h: 0.62 },
  maxSize: { w: 0.48, d: 0.48, h: 0.8 },
  slots: [matSlot('steel', 'Steel', 'metal-brushed-steel'), matSlot('feet', 'Foot caps & holes', 'rubber-black')],
  variants: steelVariants,
  build: (size) => steelStool(size, true),
});

const steelLowStool = defineItem({
  id: 'sheet-steel-low-stool',
  name: 'Industrial sheet-steel low stool',
  category: 'dining',
  type: 'seating',
  group: GROUP,
  tags: ['metal stool', 'low stool', 'industrial', 'bistro', 'stackable', 'galvanised steel', 'café', 'ghế đẩu sắt'],
  description: 'The low version of the stackable bistro stool: a dished sheet-steel seat on four folded, riveted legs that splay out to rubber caps.',
  defaultSize: { w: 0.4, d: 0.4, h: 0.45 },
  minSize: { w: 0.34, d: 0.34, h: 0.4 },
  maxSize: { w: 0.45, d: 0.45, h: 0.5 },
  slots: [matSlot('steel', 'Steel', 'powder-red'), matSlot('feet', 'Foot caps & holes', 'rubber-black')],
  variants: [
    { id: 'galvanised', name: 'Galvanised', materials: { steel: 'metal-brushed-steel' } },
    ...steelVariants.filter((v) => v.id !== 'red'),
  ],
  build: (size) => steelStool(size, false),
});

const crossBraceStool = defineItem({
  id: 'cross-braced-oak-counter-stool',
  name: 'Cross-braced oak counter stool',
  category: 'kitchen',
  type: 'seating',
  group: GROUP,
  tags: ['counter stool', 'oak', 'x brace', 'farmhouse', 'kitchen island', 'backless', 'wooden stool', 'ghế quầy gỗ sồi'],
  description: 'A square oak counter stool with a two-board seat, pegged aprons, X-braced sides and a sturdy front footrest.',
  defaultSize: { w: 0.4, d: 0.36, h: 0.65 },
  minSize: { w: 0.34, d: 0.3, h: 0.5 },
  maxSize: { w: 0.46, d: 0.42, h: 0.8 },
  slots: [matSlot('seat', 'Seat boards', 'wood-white-oak'), matSlot('frame', 'Legs & braces', 'wood-oak-natural')],
  build: ({ w, d, h }) => {
    const parts: Part[] = [];
    const sT = 0.03;
    const yU = h - sT;
    parts.push(span('seat', [-w / 2, w / 2], [yU, h], [-d / 2, -0.001], { bevel: 0.006 }));
    parts.push(span('seat', [-w / 2, w / 2], [yU, h], [0.001, d / 2], { bevel: 0.006 }));
    const lt = 0.036;
    const xl = w / 2 - 0.02 - lt / 2;
    const zl = d / 2 - 0.02 - lt / 2;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(sp('frame', [sx * xl - lt / 2, sx * xl + lt / 2], [0, yU], [sz * zl - lt / 2, sz * zl + lt / 2], 0.003));
    // Aprons, set back from the leg faces, with pegs.
    const ah = 0.06;
    const yA: V2 = [yU - ah, yU];
    for (const s of [-1, 1]) {
      const za = s * (zl + lt / 2 - 0.016);
      const xa = s * (xl + lt / 2 - 0.016);
      parts.push(sp('frame', [-xl, xl], yA, [za - 0.01, za + 0.01]));
      parts.push(sp('frame', [xa - 0.01, xa + 0.01], yA, [-zl, zl]));
      for (const t of [-1, 1]) {
        parts.push(cyl('seat', [t * xl, yU - ah / 2, s * (zl + lt / 2 + 0.0008)], 0.004, 0.003, { rotation: [Math.PI / 2, 0, 0], plan: false }));
      }
    }
    // X-braced sides between a low side rail and the aprons.
    const y0 = clamp(h * 0.14, 0.07, 0.12);
    const y1 = yU - ah - 0.004;
    for (const s of [-1, 1]) {
      const x = s * xl;
      parts.push(sp('frame', [x - 0.012, x + 0.012], [y0 - 0.025, y0], [-zl, zl]));
      parts.push(stick('frame', [x, y0, zl - lt / 2 - 0.004], [x, y1, -zl + lt / 2 + 0.004], 0.018, 0.03));
      parts.push(stick('frame', [x + s * 0.0005, y0, -zl + lt / 2 + 0.004], [x + s * 0.0005, y1, zl - lt / 2 - 0.004], 0.018, 0.03));
    }
    const yF = clamp(h * 0.33, 0.17, 0.28);
    parts.push(sp('frame', [-xl, xl], [yF - 0.03, yF], [zl - 0.014, zl + 0.014], 0.004));
    parts.push(sp('frame', [-xl, xl], [y0 - 0.025, y0], [-zl - 0.011, -zl + 0.011]));
    return parts;
  },
});

const channelStool = defineItem({
  id: 'channel-tufted-velvet-counter-stool',
  name: 'Channel-tufted velvet counter stool',
  category: 'kitchen',
  type: 'seating',
  group: GROUP,
  tags: ['counter stool', 'velvet', 'channel tufted', 'upholstered', 'low back', 'brass footrest', 'glam', 'ghế quầy nhung'],
  description: 'An upholstered counter stool with a deep velvet seat and a curved channel-tufted back on slim black legs with a brass footrest and brass caps.',
  defaultSize: { w: 0.46, d: 0.5, h: 0.9 },
  minSize: { w: 0.42, d: 0.46, h: 0.82 },
  maxSize: { w: 0.52, d: 0.56, h: 1.05 },
  slots: [
    matSlot('uph', 'Velvet upholstery', 'fabric-velvet-green'),
    matSlot('frame', 'Legs', 'metal-black-matte'),
    matSlot('brass', 'Footrest & caps', 'metal-brass'),
  ],
  variants: [
    { id: 'blush', name: 'Blush velvet', materials: { uph: 'fabric-velvet-blush' } },
    { id: 'rust', name: 'Rust velvet', materials: { uph: 'fabric-velvet-rust' } },
    { id: 'navy', name: 'Navy velvet', materials: { uph: 'fabric-velvet-navy' } },
    { id: 'oat-boucle', name: 'Oat bouclé', materials: { uph: 'fabric-boucle-oat' } },
  ],
  build: ({ w, d, h }) => {
    const parts: Part[] = [];
    const yS = clamp(h - 0.25, 0.55, 0.8);
    const cT = 0.08;
    const yB = yS - cT - 0.015;
    parts.push(cushion('uph', [-w / 2 + 0.015, w / 2 - 0.015], [yS - cT, yS], [-d / 2 + 0.06, d / 2 - 0.01], { softness: 0.4 }));
    parts.push(sp('frame', [-w / 2 + 0.05, w / 2 - 0.05], [yB, yS - cT], [-d / 2 + 0.08, d / 2 - 0.05]));
    // Curved back of vertical channels.
    const Rb = 0.32;
    const wr = w / 2 - 0.04;
    const amax = Math.asin(Math.min(0.95, wr / Rb));
    const zMid = -d / 2 + 0.032;
    const n = 5;
    const step = (2 * amax) / n;
    const segW = 2 * Rb * Math.sin(step / 2) + 0.004;
    const y0 = yS - 0.05;
    for (const i of range(n)) {
      const a = -amax + step * (i + 0.5);
      parts.push(box3('uph', [Rb * Math.sin(a), (y0 + h) / 2, zMid + Rb * (1 - Math.cos(a))], [segW, h - y0, 0.06], -a, 0.026));
    }
    for (const s of [-1, 1]) parts.push(rod('frame', [s * 0.1, yB + 0.004, -d / 2 + 0.085], [s * 0.1, yS + 0.04, -d / 2 + 0.06], 0.009, O));
    // Slim splayed legs with brass caps and a footrest.
    const foot = (sx: number, sz: number): V3 => [sx * (w / 2 - 0.025), 0, sz * (d / 2 - 0.025)];
    const top = (sx: number, sz: number): V3 => [sx * (w / 2 - 0.07), yB, sz * (d / 2 - 0.085)];
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const a = foot(sx, sz);
        const b = top(sx, sz);
        parts.push(rod('frame', a, b, 0.011, O));
        parts.push(rod('brass', a, along(a, b, 0.035 / yB), 0.0135, O));
      }
    }
    const yF = clamp(yS * 0.4, 0.2, 0.3);
    const at = (sx: number, sz: number) => along(foot(sx, sz), top(sx, sz), yF / yB);
    parts.push(rod('brass', at(-1, 1), at(1, 1), 0.012, O));
    parts.push(rod('frame', at(-1, -1), at(1, -1), 0.008, O));
    for (const sx of [-1, 1]) parts.push(rod('frame', at(sx, -1), at(sx, 1), 0.008, O));
    return parts;
  },
});

const rattanStool = defineItem({
  id: 'rattan-bar-stool',
  name: 'Rattan bar stool with woven seat',
  category: 'kitchen',
  type: 'seating',
  group: GROUP,
  tags: ['rattan', 'bar stool', 'wicker', 'mây', 'ghế mây', 'tropical', 'boho', 'woven seat'],
  description: 'A bent-rattan bar stool: four pole legs with peel bindings, double foot rings, a woven cane seat in a rattan rim and a thin cushion.',
  defaultSize: { w: 0.42, d: 0.42, h: 0.75 },
  minSize: { w: 0.38, d: 0.38, h: 0.6 },
  maxSize: { w: 0.48, d: 0.48, h: 0.8 },
  slots: [
    matSlot('pole', 'Rattan poles', 'rattan-natural'),
    matSlot('weave', 'Woven seat & bindings', 'cane-natural'),
    matSlot('pad', 'Seat pad', 'fabric-cream'),
  ],
  build: ({ w, d, h }) => {
    const parts: Part[] = [];
    const R = Math.min(w, d) / 2;
    const yR = h - 0.045;
    parts.push(ring('pole', [0, yR, 0], R - 0.025, 0.018));
    parts.push(cyl('weave', [0, yR - 0.003, 0], R - 0.032, 0.018, O));
    parts.push(lathe('pad', [0, yR + 0.006, 0], [[0, 0], [R - 0.04, 0], [R - 0.032, 0.014], [R - 0.038, 0.032], [R * 0.6, 0.039], [0, 0.039]], { segments: 32, plan: false }));
    const rt = R - 0.06;
    const rb = R - 0.022;
    const yT = yR - 0.012;
    const rAt = (y: number) => lerp(rb, rt, y / yT);
    parts.push(ring('pole', [0, yR - 0.045, 0], rAt(yR - 0.045) + 0.004, 0.01, O));
    const yF = clamp(h * 0.36, 0.2, 0.3);
    const yL = yF * 0.45;
    parts.push(ring('pole', [0, yF, 0], rAt(yF), 0.014, O), ring('pole', [0, yL, 0], rAt(yL), 0.01, O));
    for (const k of range(4)) {
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      const b = polar(a, rb, 0);
      const t = polar(a, rt, yT);
      parts.push(rod('pole', b, t, 0.015, O));
      for (const y of [yL, yF, yR - 0.045]) parts.push(rod('weave', along(b, t, (y - 0.022) / yT), along(b, t, (y + 0.022) / yT), 0.0172, O));
    }
    return parts;
  },
});

const tractorStool = defineItem({
  id: 'tractor-seat-swivel-stool',
  name: 'Tractor-seat swivel stool',
  category: 'kitchen',
  type: 'seating',
  group: GROUP,
  tags: ['tractor seat', 'swivel stool', 'industrial', 'farmhouse', 'cast iron', 'tripod', 'adjustable', 'ghế bar công nghiệp'],
  description: 'A pressed-steel tractor seat with drain holes on a threaded swivel spindle and a cast-iron tripod base with a foot ring.',
  defaultSize: { w: 0.42, d: 0.42, h: 0.7 },
  minSize: { w: 0.38, d: 0.38, h: 0.6 },
  maxSize: { w: 0.46, d: 0.46, h: 0.8 },
  slots: [
    matSlot('seat', 'Seat', 'powder-red'),
    matSlot('frame', 'Cast-iron base', 'metal-black-matte'),
    matSlot('metal', 'Threaded spindle', 'metal-brushed-steel'),
  ],
  variants: [
    { id: 'green', name: 'Tractor green', materials: { seat: 'powder-green' } },
    { id: 'yellow', name: 'Yellow', materials: { seat: 'powder-mustard' } },
    { id: 'steel', name: 'Bare steel', materials: { seat: 'metal-brushed-steel' } },
  ],
  build: ({ w, d, h }) => {
    const parts: Part[] = [];
    const R = Math.min(w, d) / 2;
    const rx = R * 0.96;
    const rz = R * 0.9;
    const outline = range(36).map((i) => {
      const a = (i / 36) * TAU;
      const s = Math.sin(a);
      const k = s > 0 ? 1 - 0.28 * s : 1;
      return [rx * Math.cos(a) * k, rz * s] as V2;
    });
    parts.push(prism('seat', outline, h - 0.014, 0.008));
    // Rolled rim around the back half.
    const rim = range(13).map((i) => {
      const a = Math.PI + (i / 12) * Math.PI;
      return [rx * Math.cos(a) * 0.985, h - 0.006, rz * Math.sin(a) * 0.985] as V3;
    });
    parts.push(...rodPath('seat', rim, 0.006));
    for (const [x, z] of [[0, 0], [-0.055, -0.02], [0.055, -0.02], [-0.03, 0.05], [0.03, 0.05], [0, -0.08], [-0.1, -0.07], [0.1, -0.07]] as V2[]) {
      parts.push(cyl('frame', [x * (R / 0.21), h - 0.0058, z * (R / 0.21)], 0.008, 0.0015, O));
    }
    // Spring bar, swivel plate, threaded spindle.
    parts.push(sp('frame', [-0.025, 0.025], [h - 0.027, h - 0.014], [-R * 0.6, R * 0.45]));
    parts.push(cyl('frame', [0, h - 0.035, 0], 0.06, 0.016, O));
    const yH = clamp(h * 0.45, 0.25, 0.36);
    parts.push(vcyl('metal', 0, 0, yH + 0.03, h - 0.043, 0.016, O));
    for (const y of spaced(6, yH + 0.05, h - 0.07)) parts.push(ring('metal', [0, y, 0], 0.016, 0.0025, O));
    // Tripod base and foot ring.
    parts.push(vcyl('frame', 0, 0, yH - 0.03, yH + 0.03, 0.04, O));
    const rb = R - 0.03;
    for (const k of range(3)) {
      const a = Math.PI / 2 + (k * TAU) / 3;
      parts.push(rod('frame', polar(a, 0.03, yH - 0.01), polar(a, rb, 0.012), 0.014, O));
      parts.push(cyl('frame', [Math.cos(a) * rb, 0.006, Math.sin(a) * rb], 0.022, 0.012, O));
    }
    const yF = yH * 0.5;
    parts.push(ring('frame', [0, yF, 0], lerp(rb, 0.03, (yF - 0.012) / (yH - 0.022)) - 0.004, 0.009, O));
    return parts;
  },
});

const bentwoodStool = defineItem({
  id: 'bentwood-cane-bar-stool',
  name: 'Bentwood bar stool with cane seat',
  category: 'dining',
  type: 'seating',
  group: GROUP,
  tags: ['bentwood', 'bar stool', 'cane seat', 'bistro', 'vienna', 'beech', 'café', 'ghế bar mây đan'],
  description: 'A Vienna café bar stool in steam-bent beech: a round woven cane seat in a bent rim, gently curved legs and a foot ring.',
  defaultSize: { w: 0.42, d: 0.42, h: 0.76 },
  minSize: { w: 0.38, d: 0.38, h: 0.62 },
  maxSize: { w: 0.46, d: 0.46, h: 0.8 },
  slots: [matSlot('wood', 'Bentwood frame', 'wood-dark-stain'), matSlot('cane', 'Cane seat', 'cane-natural')],
  build: ({ w, d, h }) => {
    const parts: Part[] = [];
    const R = Math.min(w, d) / 2;
    const yR = h - 0.025;
    parts.push(ring('wood', [0, yR, 0], R - 0.02, 0.018));
    parts.push(cyl('cane', [0, yR + 0.001, 0], R - 0.031, 0.012, O));
    parts.push(ring('wood', [0, yR - 0.045, 0], R - 0.045, 0.012, O));
    const rt = R - 0.045;
    const rb = R - 0.02;
    const yT = yR - 0.02;
    const rAt = (y: number) => lerp(rb, rt, y / yT) + 0.012 * Math.sin((Math.PI * y) / yT);
    for (const k of range(4)) {
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      parts.push(...rodPath('wood', spaced(4, 0, yT).map((y) => polar(a, rAt(y), y)), 0.0145));
    }
    const yF = clamp(h * 0.34, 0.2, 0.28);
    parts.push(ring('wood', [0, yF, 0], rAt(yF), 0.012, O));
    parts.push(ring('wood', [0, yR - 0.16, 0], rAt(yR - 0.16) - 0.01, 0.008, O));
    return parts;
  },
});

const shakerStool = defineItem({
  id: 'shaker-tape-counter-stool',
  name: 'Shaker counter stool with woven tape seat',
  category: 'kitchen',
  type: 'seating',
  group: GROUP,
  tags: ['shaker', 'counter stool', 'woven tape', 'cherry', 'checkerboard', 'farmhouse', 'turned posts', 'ghế quầy đan dây'],
  description: 'A Shaker-style counter stool: four cherry posts with finials, round rungs and a seat woven from cotton tape in a two-colour checkerboard.',
  defaultSize: { w: 0.4, d: 0.36, h: 0.64 },
  minSize: { w: 0.34, d: 0.3, h: 0.45 },
  maxSize: { w: 0.46, d: 0.42, h: 0.78 },
  slots: [
    matSlot('frame', 'Cherry frame', 'wood-cherry'),
    matSlot('tapeA', 'Tape, light', 'fabric-cream'),
    matSlot('tapeB', 'Tape, dark', 'fabric-navy'),
  ],
  variants: [
    { id: 'olive', name: 'Olive & cream', materials: { tapeB: 'fabric-olive' } },
    { id: 'rust', name: 'Terracotta & cream', materials: { tapeB: 'fabric-terracotta' } },
    { id: 'charcoal', name: 'Charcoal & natural', materials: { tapeA: 'fabric-hessian', tapeB: 'fabric-charcoal' } },
  ],
  build: ({ w, d, h }) => {
    const parts: Part[] = [];
    const xp = w / 2 - 0.02;
    const zp = d / 2 - 0.02;
    const rp = 0.017;
    const yR = h - 0.035;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        parts.push(vcyl('frame', sx * xp, sz * zp, 0, h - 0.016, rp, O));
        parts.push(lathe('frame', [sx * xp, h - 0.016, sz * zp], [[rp * 0.8, 0], [rp * 1.02, 0.006], [rp * 0.75, 0.012], [0, 0.016]], { segments: 16, plan: false }));
      }
    }
    // Seat rails and rungs.
    const rr = 0.013;
    for (const s of [-1, 1]) {
      parts.push(rodX('frame', -xp, xp, yR, s * zp, rr, O));
      parts.push(rodZ('frame', s * xp, yR - 0.006, -zp, zp, rr, O));
    }
    const y1 = clamp(h * 0.28, 0.12, 0.22);
    const rungs = h > 0.55 ? [y1, lerp(y1, yR, 0.5)] : [y1];
    for (const y of rungs) {
      for (const s of [-1, 1]) {
        parts.push(rodX('frame', -xp, xp, y, s * zp, 0.011, O));
        parts.push(rodZ('frame', s * xp, y + 0.045, -zp, zp, 0.011, O));
      }
    }
    // Checkerboard tape on top (wrapping the front and back rails), plain layers underneath.
    const x0 = -xp + rp;
    const x1 = xp - rp;
    const z0 = -zp - 0.008;
    const z1 = zp + 0.008;
    const nx = clamp(Math.round((x1 - x0) / 0.04), 4, 9);
    const nz = clamp(Math.round((z1 - z0) / 0.04), 4, 9);
    const cx = (x1 - x0) / nx;
    const cz = (z1 - z0) / nz;
    const yT: V2 = [yR + 0.008, yR + 0.016];
    for (const i of range(nx)) {
      for (const j of range(nz)) {
        const slot = (i + j) % 2 ? 'tapeB' : 'tapeA';
        parts.push(sp(slot, [x0 + i * cx + 0.0006, x0 + (i + 1) * cx - 0.0006], yT, [z0 + j * cz + 0.0006, z0 + (j + 1) * cz - 0.0006], 0.0018));
      }
    }
    parts.push(span('tapeA', [x0, x1], [yR - 0.016, yR - 0.012], [-zp, zp]));
    parts.push(sp('tapeB', [x0, x1], [yR - 0.021, yR - 0.017], [-zp + 0.004, zp - 0.004]));
    return parts;
  },
});

// ── Vietnamese everyday stools ───────────────────────────────────────────────

const plasticColours = (except: string) =>
  [
    { id: 'red', name: 'Red', materials: { plastic: 'plastic-red' } },
    { id: 'blue', name: 'Blue', materials: { plastic: 'plastic-blue' } },
    { id: 'green', name: 'Green', materials: { plastic: 'plastic-green' } },
    { id: 'yellow', name: 'Yellow', materials: { plastic: 'plastic-yellow' } },
    { id: 'pink', name: 'Pink', materials: { plastic: 'plastic-pink' } },
  ].filter((v) => v.id !== except);

const lowPlasticStool = defineItem({
  id: 'low-red-plastic-stool',
  name: 'Low plastic stool (ghế nhựa đỏ)',
  category: 'dining',
  type: 'seating',
  group: GROUP,
  tags: ['plastic stool', 'ghế nhựa', 'ghe nhua do', 'street food', 'vỉa hè', 'low stool', 'vietnamese', 'red stool'],
  description: 'The single red plastic stool of every Vietnamese street stall: a ribbed square seat with a hand slot, a skirt and four splayed L-section legs.',
  defaultSize: { w: 0.3, d: 0.3, h: 0.26 },
  minSize: { w: 0.26, d: 0.26, h: 0.22 },
  maxSize: { w: 0.36, d: 0.36, h: 0.32 },
  slots: [matSlot('plastic', 'Plastic', 'plastic-red')],
  variants: plasticColours('red'),
  build: ({ w, d, h }) => {
    const parts: Part[] = [];
    const sw = w - 0.03;
    const sd = d - 0.03;
    const yT: V2 = [h - 0.0195, h - 0.0015];
    const hx = 0.05;
    const hz = 0.012;
    // Seat top around the hand slot.
    parts.push(span('plastic', [-sw / 2, sw / 2], yT, [-sd / 2, -hz], { bevel: 0.004 }));
    parts.push(span('plastic', [-sw / 2, sw / 2], yT, [hz, sd / 2], { bevel: 0.004 }));
    parts.push(span('plastic', [-sw / 2, -hx], yT, [-hz - 0.002, hz + 0.002], { bevel: 0.002 }));
    parts.push(span('plastic', [hx, sw / 2], yT, [-hz - 0.002, hz + 0.002], { bevel: 0.002 }));
    // Raised ribs on the seat.
    for (const z of [-sd / 2 + 0.035, sd / 2 - 0.035]) parts.push(sp('plastic', [-sw / 2 + 0.03, sw / 2 - 0.03], [h - 0.003, h], [z - 0.003, z + 0.003]));
    // Skirt and cross ribs under the seat.
    const yS: V2 = [h - 0.07, h - 0.018];
    for (const s of [-1, 1]) {
      parts.push(sp('plastic', [-sw / 2 + 0.035, sw / 2 - 0.035], yS, [s * (sd / 2 - 0.004) - 0.002, s * (sd / 2 - 0.004) + 0.002]));
      parts.push(sp('plastic', [s * (sw / 2 - 0.004) - 0.002, s * (sw / 2 - 0.004) + 0.002], yS, [-sd / 2 + 0.035, sd / 2 - 0.035]));
    }
    parts.push(sp('plastic', [-sw / 2 + 0.01, sw / 2 - 0.01], [h - 0.045, h - 0.018], [-0.002, 0.002]));
    // Splayed L-section legs with flat foot pads.
    const pw = 0.042;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const a: V3 = [sx * (sw / 2 - 0.02), h - 0.018, sz * (sd / 2 - 0.02)];
        const b: V3 = [sx * (w / 2 - 0.022), 0.006, sz * (d / 2 - 0.022)];
        const oA: V2 = [sx * 0.012, -sz * 0.008];
        const oB: V2 = [-sx * 0.008, sz * 0.012];
        parts.push(stick('plastic', [a[0] + oA[0], a[1], a[2] + oA[1]], [b[0] + oA[0], b[1], b[2] + oA[1]], 0.004, pw));
        parts.push(stick('plastic', [a[0] + oB[0], a[1], a[2] + oB[1]], [b[0] + oB[0], b[1], b[2] + oB[1]], pw, 0.004));
        parts.push(sp('plastic', [b[0] - 0.02, b[0] + 0.02], [0, 0.006], [b[2] - 0.02, b[2] + 0.02], 0.002));
      }
    }
    return parts;
  },
});

const tallPlasticStool = defineItem({
  id: 'tall-round-plastic-stool',
  name: 'Tall round plastic stool (ghế nhựa tròn cao)',
  category: 'dining',
  type: 'seating',
  group: GROUP,
  tags: ['plastic stool', 'ghế nhựa', 'round stool', 'tall stool', 'quán ăn', 'vietnamese', 'blue stool', 'stackable'],
  description: 'The taller round plastic stool of Vietnamese eateries and kitchens: a lipped seat with a finger hole, a deep skirt, four ribbed legs and a ring stretcher.',
  defaultSize: { w: 0.33, d: 0.33, h: 0.45 },
  minSize: { w: 0.28, d: 0.28, h: 0.38 },
  maxSize: { w: 0.38, d: 0.38, h: 0.5 },
  slots: [matSlot('plastic', 'Plastic', 'plastic-blue')],
  variants: plasticColours('blue'),
  build: ({ w, d, h }) => {
    const parts: Part[] = [];
    const R = (Math.min(w, d) / 2) * 0.9;
    const r0 = 0.018;
    parts.push(lathe('plastic', [0, h - 0.03, 0], [[r0, 0.03], [r0, 0], [R - 0.004, 0], [R, 0.006], [R, 0.026], [R - 0.006, 0.03], [r0, 0.03]], { segments: 36 }));
    parts.push(cyl('plastic', [0, h - 0.055, 0], R - 0.012, 0.05, { rTop: R - 0.01, segments: 32, plan: false }));
    const rb = Math.min(w, d) / 2 - 0.024;
    const rt = R - 0.03;
    const yT = h - 0.06;
    const rAt = (y: number) => lerp(rb, rt, y / yT);
    for (const k of range(4)) {
      const a = (k * Math.PI) / 2;
      const top = polar(a, rt, yT);
      const bot = polar(a, rb, 0.008);
      const onX = k % 2 === 0;
      parts.push(stick('plastic', top, bot, onX ? 0.006 : 0.046, onX ? 0.046 : 0.006));
      const fin = (p: V3): V3 => polar(a, Math.hypot(p[0], p[2]) - 0.014, p[1]);
      parts.push(stick('plastic', fin(top), fin(bot), onX ? 0.028 : 0.005, onX ? 0.005 : 0.028));
      parts.push(cyl('plastic', [bot[0], 0.004, bot[2]], 0.022, 0.008, O));
    }
    const yF = clamp(h * 0.33, 0.12, 0.17);
    parts.push(ring('plastic', [0, yF, 0], rAt(yF), 0.008, O));
    return parts;
  },
});

const donStool = defineItem({
  id: 'carved-wooden-don-stool',
  name: 'Carved wooden drum stool (đôn gỗ)',
  category: 'living',
  type: 'seating',
  group: GROUP,
  tags: ['đôn gỗ', 'don go', 'drum stool', 'rosewood', 'gỗ hương', 'carved', 'marble top', 'vietnamese', 'tea stool'],
  description: 'A traditional Vietnamese rosewood drum stool with beaded bands, carved medallions on four sides, short bun feet and an inset marble top.',
  defaultSize: { w: 0.36, d: 0.36, h: 0.45 },
  minSize: { w: 0.3, d: 0.3, h: 0.38 },
  maxSize: { w: 0.45, d: 0.45, h: 0.5 },
  slots: [
    matSlot('wood', 'Carved wood', 'wood-rosewood'),
    matSlot('top', 'Marble top', 'stone-marble-carrara'),
    matSlot('carve', 'Carved recesses', 'wood-ebony'),
  ],
  build: ({ w, d, h }) => {
    const parts: Part[] = [];
    const R = Math.min(w, d) / 2;
    const yb = 0.04;
    const H = h - yb;
    const prof: V2[] = [[0, 0], [R * 0.84, 0], [R * 0.86, 0.012], [R * 0.84, 0.024], [R * 0.93, H * 0.3], [R * 0.95, H * 0.5], [R * 0.93, H * 0.7], [R * 0.84, H - 0.024], [R * 0.86, H - 0.012], [R * 0.88, H], [R * 0.8, H], [R * 0.8, H - 0.006], [0, H - 0.006]];
    parts.push(lathe('wood', [0, yb, 0], prof, { segments: 40 }));
    parts.push(cyl('top', [0, yb + H - 0.0035, 0], R * 0.8 - 0.002, 0.005, { segments: 40, plan: false }));
    // Beaded bands top and bottom, thin incised rings on the belly.
    parts.push(ring('wood', [0, yb + 0.012, 0], R * 0.86, 0.006, O), ring('wood', [0, yb + H - 0.012, 0], R * 0.86, 0.006, O));
    for (const f of [0.3, 0.7]) parts.push(ring('carve', [0, yb + H * f, 0], R * 0.93 + 0.001, 0.0035, O));
    // Carved medallions on four sides, each with a raised flower boss.
    const rMed = Math.min(0.055, H * 0.17);
    const rBody = R * 0.95;
    for (const k of range(4)) {
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      parts.push(radialDisc('carve', a, rBody - 0.014, rBody + 0.002, yb + H * 0.5, rMed));
      parts.push(radialDisc('wood', a, rBody - 0.01, rBody + 0.007, yb + H * 0.5, rMed * 0.5));
      parts.push(radialRing('wood', a, rBody + 0.001, yb + H * 0.5, rMed, 0.005));
      parts.push(turnedLeg('wood', Math.cos(a) * R * 0.66, Math.sin(a) * R * 0.66, 0, yb, 0.03, { style: 'bun' }));
    }
    return parts;
  },
});

const ceramicStool = defineItem({
  id: 'glazed-ceramic-drum-stool',
  name: 'Glazed ceramic drum stool (đôn sứ)',
  category: 'outdoor',
  type: 'seating',
  group: GROUP,
  tags: ['đôn sứ', 'garden stool', 'ceramic stool', 'drum stool', 'chinoiserie', 'bát tràng', 'side table', 'porcelain'],
  description: 'A glazed porcelain garden stool shaped like a drum, with rows of raised studs, painted bands and four pierced coin windows; also a side table.',
  defaultSize: { w: 0.34, d: 0.34, h: 0.46 },
  minSize: { w: 0.3, d: 0.3, h: 0.4 },
  maxSize: { w: 0.4, d: 0.4, h: 0.5 },
  slots: [
    matSlot('glaze', 'Glaze', 'ceramic-blue'),
    matSlot('band', 'Painted bands', 'ceramic-white'),
    matSlot('hollow', 'Hollow inside', 'solid-black'),
  ],
  variants: [
    { id: 'white-blue', name: 'White & blue', materials: { glaze: 'ceramic-white', band: 'ceramic-blue' } },
    { id: 'celadon', name: 'Celadon', materials: { glaze: 'ceramic-sage', band: 'ceramic-cream' } },
    { id: 'black-gold', name: 'Black & gold', materials: { glaze: 'ceramic-black', band: 'metal-gold' } },
    { id: 'cream', name: 'Cream', materials: { glaze: 'ceramic-cream', band: 'ceramic-sage' } },
  ],
  build: ({ w, d, h }) => {
    const parts: Part[] = [];
    const R = Math.min(w, d) / 2;
    const top = h - 0.0012;
    const prof: V2[] = [[0, 0], [R * 0.78, 0], [R * 0.8, 0.01], [R * 0.8, 0.03], [R * 0.93, h * 0.3], [R * 0.96, h * 0.5], [R * 0.93, h * 0.7], [R * 0.8, h - 0.03], [R * 0.8, h - 0.012], [R * 0.76, top], [0, top]];
    parts.push(lathe('glaze', [0, 0, 0], prof, { segments: 44 }));
    parts.push(cyl('band', [0, h - 0.0008, 0], R * 0.42, 0.0016, { segments: 36, plan: false }));
    // Rows of raised studs near the rims.
    for (const y of [0.045, h - 0.045]) {
      const r = profileR(prof, y);
      for (const k of range(14)) parts.push(sphere('glaze', polar((k * TAU) / 14, r + 0.001, y), 0.0065, O));
    }
    for (const f of [0.3, 0.7]) parts.push(ring('band', [0, h * f, 0], profileR(prof, h * f) + 0.0005, 0.0045, O));
    // Pierced coin windows.
    const rw = Math.min(0.045, h * 0.1);
    const rBody = R * 0.96;
    for (const k of range(4)) {
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      parts.push(radialDisc('hollow', a, rBody - 0.016, rBody - 0.001, h * 0.5, rw - 0.002));
      parts.push(radialRing('glaze', a, rBody - 0.002, h * 0.5, rw, 0.007));
    }
    return parts;
  },
});

const bambooStool = defineItem({
  id: 'bamboo-stool-ghe-tre',
  name: 'Bamboo stool (ghế tre)',
  category: 'outdoor',
  type: 'seating',
  group: GROUP,
  tags: ['ghế tre', 'ghe tre', 'bamboo stool', 'vietnamese', 'countryside', 'split bamboo', 'rattan binding', 'đồng quê'],
  description: 'A countryside Vietnamese bamboo stool: four whole culms with nodes, rattan-bound rails and a seat of split-bamboo slats.',
  defaultSize: { w: 0.38, d: 0.38, h: 0.4 },
  minSize: { w: 0.3, d: 0.3, h: 0.3 },
  maxSize: { w: 0.45, d: 0.45, h: 0.48 },
  slots: [
    matSlot('bamboo', 'Bamboo poles', 'wood-bamboo'),
    matSlot('slat', 'Split-bamboo seat', 'wood-bamboo'),
    matSlot('bind', 'Rattan bindings', 'rattan-natural'),
  ],
  build: ({ w, d, h }) => {
    const parts: Part[] = [];
    const xl = w / 2 - 0.02;
    const zl = d / 2 - 0.02;
    const rl = 0.017;
    const ySide = h - 0.036;
    const yFront = h - 0.075;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const x = sx * xl;
        const z = sz * zl;
        parts.push(vcyl('bamboo', x, z, 0, h - 0.022, rl, O));
        for (const y of spaced(3, 0.08, h - 0.12)) parts.push(ring('bamboo', [x, y, z], rl + 0.0008, 0.0032, O));
        for (const y of [ySide, yFront]) parts.push(ring('bind', [x, y, z], rl + 0.002, 0.004, O));
      }
    }
    for (const s of [-1, 1]) {
      parts.push(rodZ('bamboo', s * xl, ySide, -zl - 0.012, zl + 0.012, 0.014, O));
      parts.push(rodX('bamboo', -xl, xl, yFront, s * zl, 0.012, O));
      parts.push(rodX('bamboo', -xl, xl, 0.12, s * zl, 0.011, O));
      parts.push(rodZ('bamboo', s * xl, 0.15, -zl, zl, 0.011, O));
    }
    const n = clamp(Math.round((d - 0.008) / 0.034), 6, 14);
    for (const [z0, z1] of cells(n, -d / 2 + 0.004, d / 2 - 0.004).map((c) => [c - (d - 0.008) / n / 2, c + (d - 0.008) / n / 2])) {
      parts.push(span('slat', [-xl - 0.012, xl + 0.012], [h - 0.02, h], [z0 + 0.0025, z1 - 0.0025], { bevel: 0.005 }));
    }
    return parts;
  },
});

const plankBench = defineItem({
  id: 'long-plank-bench-ghe-bang',
  name: 'Long plank bench (ghế băng)',
  category: 'dining',
  type: 'seating',
  group: GROUP,
  tags: ['ghế băng', 'ghe bang', 'long stool', 'plank bench', 'backless bench', 'vietnamese', 'acacia', 'wedged tenons'],
  description: 'A long backless Vietnamese plank bench in acacia: one thick board on splayed legs with wedged through-tenons, end stretchers and a long rail.',
  defaultSize: { w: 1.2, d: 0.26, h: 0.45 },
  minSize: { w: 0.8, d: 0.22, h: 0.4 },
  maxSize: { w: 1.8, d: 0.32, h: 0.48 },
  slots: [matSlot('wood', 'Wood', 'wood-acacia'), matSlot('wedge', 'Wedges', 'wood-dark-stain')],
  build: ({ w, d, h }) => {
    const parts: Part[] = [];
    const sT = 0.035;
    const yU = h - sT;
    parts.push(span('wood', [-w / 2, w / 2], [yU, h - 0.0016], [-d / 2, d / 2], { bevel: 0.005 }));
    const xt = w / 2 - 0.13;
    const zt = d / 2 - 0.055;
    const top = (sx: number, sz: number): V3 => [sx * xt, yU, sz * zt];
    const foot = (sx: number, sz: number): V3 => [sx * (xt + 0.035), 0, sz * (d / 2 - 0.022)];
    for (const sx of [-1, 1]) {
      // Cleat under the seat holding the legs.
      parts.push(sp('wood', [sx * xt - 0.03, sx * xt + 0.03], [yU - 0.03, yU], [-d / 2 + 0.02, d / 2 - 0.02]));
      for (const sz of [-1, 1]) {
        parts.push(stick('wood', foot(sx, sz), [sx * xt, h - 0.0008, sz * zt], 0.04, 0.035));
        parts.push(sp('wedge', [sx * xt - 0.016, sx * xt + 0.016], [h - 0.005, h], [sz * zt - 0.002, sz * zt + 0.002]));
      }
      const yS = 0.13;
      const a = along(foot(sx, -1), top(sx, -1), yS / yU);
      const b = along(foot(sx, 1), top(sx, 1), yS / yU);
      parts.push(stick('wood', [a[0], yS, a[2] - 0.01], [b[0], yS, b[2] + 0.01], 0.03, 0.03));
    }
    // Long rail resting on the middle of the end stretchers.
    const xr = along(foot(1, 1), top(1, 1), 0.13 / yU)[0];
    parts.push(sp('wood', [-xr - 0.01, xr + 0.01], [0.145, 0.175], [-0.014, 0.014], 0.003));
    return parts;
  },
});

// ── Studio, workshop & bathroom ─────────────────────────────────────────────

const pianoStool = defineItem({
  id: 'adjustable-round-piano-stool',
  name: 'Adjustable round piano stool',
  category: 'hobbies',
  type: 'seating',
  group: GROUP,
  tags: ['piano stool', 'revolving stool', 'adjustable', 'screw stool', 'buttoned leather', 'music', 'ghế đàn piano'],
  description: 'A revolving piano stool: a buttoned leather top with brass studs that winds up and down on a brass screw over four splayed ebonised legs.',
  defaultSize: { w: 0.38, d: 0.38, h: 0.52 },
  minSize: { w: 0.34, d: 0.34, h: 0.48 },
  maxSize: { w: 0.42, d: 0.42, h: 0.62 },
  slots: [
    matSlot('leather', 'Leather top', 'leather-black'),
    matSlot('wood', 'Wood base', 'wood-ebony'),
    matSlot('metal', 'Screw & studs', 'metal-brass'),
  ],
  build: ({ w, d, h }) => {
    const parts: Part[] = [];
    const R = Math.min(w, d) / 2;
    parts.push(lathe('leather', [0, h - 0.06, 0], [[0, 0], [R - 0.01, 0], [R, 0.015], [R - 0.002, 0.04], [R * 0.88, 0.056], [0, 0.06]], { segments: 40 }));
    parts.push(sphere('leather', [0, h - 0.004, 0], 0.009, { scale: [1, 0.5, 1], plan: false }));
    for (const k of range(8)) parts.push(sphere('leather', polar((k * TAU) / 8, R * 0.55, h - 0.0045), 0.009, { scale: [1, 0.5, 1], plan: false }));
    for (const k of range(24)) parts.push(sphere('metal', polar((k * TAU) / 24, R - 0.004, h - 0.05), 0.005, O));
    parts.push(lathe('wood', [0, h - 0.1, 0], [[0, 0], [R * 0.8, 0], [R * 0.86, 0.02], [R * 0.9, 0.04], [0, 0.04]], { segments: 36, plan: false }));
    const yC = h - 0.15;
    const yL = yC - 0.1;
    parts.push(vcyl('metal', 0, 0, yC, h - 0.1, 0.02, O));
    for (const y of spaced(4, yC + 0.008, h - 0.108)) parts.push(ring('metal', [0, y, 0], 0.02, 0.003, O));
    parts.push(lathe('wood', [0, yL, 0], [[0, 0], [0.05, 0], [0.058, 0.02], [0.045, 0.06], [0.05, 0.09], [0.04, 0.1], [0, 0.1]], { segments: 24, plan: false }));
    const rb = R - 0.022;
    for (const k of range(4)) {
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      const b = polar(a, rb, 0);
      const t = polar(a, 0.045, yL + 0.07);
      parts.push(rod('wood', b, t, 0.016, { rTop: 0.021, plan: false }));
      parts.push(rod('metal', b, along(b, t, 0.035 / (yL + 0.07)), 0.0175, O));
    }
    const yS = clamp(yL * 0.4, 0.1, 0.14);
    const p = (k: number) => along(polar(Math.PI / 4 + (k * Math.PI) / 2, rb, 0), polar(Math.PI / 4 + (k * Math.PI) / 2, 0.045, yL + 0.07), yS / (yL + 0.07));
    parts.push(...rodPath('wood', [p(0), p(1), p(2), p(3), p(0)], 0.009));
    return parts;
  },
});

const labStool = defineItem({
  id: 'round-lab-stool-on-castors',
  name: 'Round lab stool on castors',
  category: 'office',
  type: 'seating',
  group: GROUP,
  tags: ['lab stool', 'castors', 'swivel stool', 'gas lift', 'workshop', 'salon stool', 'foot ring', 'ghế xoay tròn'],
  description: 'A backless swivel stool for labs, workshops and salons: a round PU seat on a gas lift, a chrome foot ring and a five-star base on twin-wheel castors.',
  defaultSize: { w: 0.5, d: 0.5, h: 0.6 },
  minSize: { w: 0.46, d: 0.46, h: 0.48 },
  maxSize: { w: 0.56, d: 0.56, h: 0.75 },
  slots: [
    matSlot('seat', 'PU seat', 'leather-black'),
    matSlot('frame', 'Base & foot ring', 'metal-chrome'),
    matSlot('castors', 'Castors & column', 'plastic-black'),
  ],
  variants: [
    { id: 'white', name: 'White seat', materials: { seat: 'leather-white' } },
    { id: 'grey', name: 'Grey fabric', materials: { seat: 'fabric-wool-grey' } },
    { id: 'blue', name: 'Navy fabric', materials: { seat: 'fabric-navy' } },
  ],
  build: ({ w, d, h }) => {
    const parts: Part[] = [];
    const R = Math.min(w, d) / 2;
    const rc = R - 0.035;
    for (const k of range(5)) {
      const a = Math.PI / 2 + (k * TAU) / 5;
      parts.push(box3('frame', polar(a, (0.03 + rc) / 2, 0.085), [rc - 0.03, 0.024, 0.034], -a, 0.008, true));
      const p = polar(a, rc, 0.024);
      const n: V3 = [-Math.sin(a) * 0.014, 0, Math.cos(a) * 0.014];
      parts.push(rod('castors', [p[0] - n[0], p[1], p[2] - n[2]], [p[0] + n[0], p[1], p[2] + n[2]], 0.024, O));
      parts.push(vcyl('castors', p[0], p[2], 0.048, 0.075, 0.012, O));
    }
    parts.push(vcyl('frame', 0, 0, 0.065, 0.11, 0.035, O));
    const yS = h - 0.07;
    const yF = clamp(h * 0.42, 0.2, 0.32);
    const Rf = R * 0.72;
    parts.push(...gasColumn('frame', 'castors', 0.11, yS));
    parts.push(cyl('frame', [0, yF, 0], 0.036, 0.03, O), ring('frame', [0, yF, 0], Rf, 0.01, O));
    for (const k of range(3)) {
      const a = Math.PI / 2 + (k * TAU) / 3;
      parts.push(rod('frame', polar(a, 0.034, yF), polar(a, Rf, yF), 0.007, O));
    }
    parts.push(lathe('seat', [0, yS, 0], [[0, 0], [R * 0.75, 0], [R * 0.78, 0.02], [R * 0.8, 0.05], [R * 0.76, 0.066], [0, 0.07]], { segments: 40 }));
    parts.push(rod('castors', [0.05, yS - 0.02, 0], [R * 0.68, yS - 0.03, R * 0.2], 0.006, O));
    return parts;
  },
});

const wobbleStool = defineItem({
  id: 'active-wobble-stool',
  name: 'Active wobble stool',
  category: 'office',
  type: 'seating',
  group: GROUP,
  tags: ['wobble stool', 'active sitting', 'ergonomic', 'rocking stool', 'standing desk', 'height adjustable', 'ghế công thái học'],
  description: 'An ergonomic stool that tilts and rocks on a rounded rubber base, with a cushioned seat, an adjustable column and a carry handle.',
  defaultSize: { w: 0.36, d: 0.36, h: 0.55 },
  minSize: { w: 0.34, d: 0.34, h: 0.44 },
  maxSize: { w: 0.4, d: 0.4, h: 0.7 },
  slots: [
    matSlot('seat', 'Seat cushion', 'fabric-wool-grey'),
    matSlot('body', 'Column & handle', 'metal-anthracite'),
    matSlot('base', 'Rocker base', 'rubber-black'),
  ],
  variants: [
    { id: 'navy', name: 'Navy', materials: { seat: 'fabric-navy' } },
    { id: 'mustard', name: 'Mustard', materials: { seat: 'fabric-mustard' } },
    { id: 'terracotta', name: 'Terracotta', materials: { seat: 'fabric-terracotta' } },
    { id: 'olive', name: 'Olive', materials: { seat: 'fabric-olive' } },
  ],
  build: ({ w, d, h }) => {
    const R = Math.min(w, d) / 2;
    const rB = R * 0.82;
    const yS = h - 0.08;
    return [
      lathe('base', [0, 0, 0], [[0, 0], [rB * 0.4, 0.004], [rB * 0.7, 0.016], [rB * 0.92, 0.036], [rB, 0.056], [rB * 0.93, 0.07], [0, 0.07]], { segments: 40 }),
      cyl('body', [0, 0.072, 0], rB * 0.7, 0.004, { segments: 32, plan: false }),
      vcyl('body', 0, 0, 0.074, yS - 0.03, 0.045, { rTop: 0.034, plan: false }),
      ring('body', [0, yS - 0.045, 0], 0.06, 0.006, O),
      box3('body', [0.08, yS - 0.045, 0], [0.045, 0.008, 0.022], 0, 0.003),
      lathe('body', [0, yS - 0.03, 0], [[0, 0], [0.05, 0], [R * 0.8, 0.026], [R * 0.8, 0.03], [0, 0.03]], { segments: 32, plan: false }),
      lathe('seat', [0, yS, 0], [[0, 0], [R * 0.85, 0], [R - 0.002, 0.025], [R, 0.05], [R * 0.92, 0.075], [0, 0.08]], { segments: 40 }),
      ...rodPath('body', [[-0.05, yS - 0.03, -R * 0.62], [-0.06, yS - 0.05, -R + 0.012], [0.06, yS - 0.05, -R + 0.012], [0.05, yS - 0.03, -R * 0.62]], 0.007),
    ];
  },
});

const boxStool = defineItem({
  id: 'box-stool-with-rod',
  name: 'Box stool with round rail',
  category: 'office',
  type: 'seating',
  group: GROUP,
  tags: ['box stool', 'ulm stool', 'side table', 'step stool', 'finger joints', 'spruce', 'bauhaus', 'ghế hộp gỗ'],
  description: 'A three-board spruce box stool with finger-jointed corners and a round beech rail at the foot: a seat, a side table, a step or a carrier.',
  defaultSize: { w: 0.4, d: 0.3, h: 0.44 },
  minSize: { w: 0.36, d: 0.26, h: 0.4 },
  maxSize: { w: 0.44, d: 0.34, h: 0.48 },
  slots: [matSlot('board', 'Spruce boards', 'wood-pine'), matSlot('rod', 'Beech rail & joints', 'wood-maple')],
  build: ({ w, d, h }) => {
    const parts: Part[] = [];
    const t = 0.019;
    parts.push(span('board', [-w / 2 + t, w / 2 - t], [h - t, h], [-d / 2, d / 2]));
    for (const s of [-1, 1]) {
      const xo = s * (w / 2 - 0.001);
      const xi = s * (w / 2 - t);
      parts.push(span('board', [Math.min(xo, xi), Math.max(xo, xi)], [0, h - t], [-d / 2, d / 2], O));
      // Finger joints: seat and side fingers alternate along the depth.
      const xe: V2 = [Math.min(s * (w / 2), xi), Math.max(s * (w / 2), xi)];
      for (const i of range(5)) {
        const z0 = -d / 2 + (i * d) / 5 + (i ? 0.0004 : 0);
        const z1 = -d / 2 + ((i + 1) * d) / 5 - (i < 4 ? 0.0004 : 0);
        parts.push(sp(i % 2 ? 'rod' : 'board', xe, [h - t, h], [z0, z1]));
      }
    }
    parts.push(rodX('rod', -w / 2, w / 2, 0.045, 0, 0.0145, O));
    return parts;
  },
});

const stepStool = defineItem({
  id: 'folding-steel-two-step-stool',
  name: 'Folding steel two-step stool',
  category: 'kitchen',
  type: 'seating',
  group: GROUP,
  tags: ['step stool', 'folding', 'kitchen ladder', 'steel', 'two step', 'ribbed treads', 'ghế thang gấp', 'thang ghế'],
  description: 'A folding two-step kitchen stool: a white steel tube frame with ribbed grey treads, side locking braces and rubber feet.',
  defaultSize: { w: 0.44, d: 0.5, h: 0.48 },
  minSize: { w: 0.4, d: 0.44, h: 0.42 },
  maxSize: { w: 0.5, d: 0.58, h: 0.6 },
  slots: [
    matSlot('frame', 'Steel frame', 'metal-white-powder'),
    matSlot('tread', 'Treads', 'solid-light-grey'),
    matSlot('feet', 'Rubber feet', 'rubber-black'),
  ],
  build: ({ w, d, h }) => {
    const parts: Part[] = [];
    const xt = w / 2 - 0.015;
    const xi = w / 2 - 0.03;
    const yTop = h - 0.002;
    const yLow = h * 0.5;
    for (const s of [-1, 1]) {
      const F0: V3 = [s * xt, 0.012, d / 2 - 0.02];
      const F1: V3 = [s * xt, h - 0.03, -d / 2 + 0.16];
      const B0: V3 = [s * xt, 0.012, -d / 2 + 0.02];
      const B1: V3 = [s * xt, h - 0.035, -d / 2 + 0.1];
      parts.push(rod('frame', F0, F1, 0.012, O), rod('frame', B0, B1, 0.012, O));
      parts.push(rod('feet', [F0[0], 0.012, F0[2]], along(F0, F1, 0.03 / (F1[1] - F0[1])), 0.0145, O));
      parts.push(rod('feet', [B0[0], 0.012, B0[2]], along(B0, B1, 0.03 / (B1[1] - B0[1])), 0.0145, O));
      parts.push(sphere('feet', [F0[0], 0.0125, F0[2]], 0.0125, O), sphere('feet', [B0[0], 0.0125, B0[2]], 0.0125, O));
      // Locking brace between the front and back legs, hinge at the top.
      const yb = 0.16;
      parts.push(rod('frame', along(F0, F1, (yb - F0[1]) / (F1[1] - F0[1])), along(B0, B1, (yb - B0[1]) / (B1[1] - B0[1])), 0.006, O));
      parts.push(rodX('frame', s * (xt - 0.016), s * (xt + 0.008), h - 0.034, -d / 2 + 0.12, 0.009, O));
    }
    // Treads: lower one hung on the front legs, top platform over the hinge.
    const zLow = lerp(d / 2 - 0.02, -d / 2 + 0.16, (yLow - 0.012) / (h - 0.042));
    const treads: [V2, number][] = [
      [[zLow - 0.065, zLow + 0.065], yLow],
      [[-d / 2 + 0.05, -d / 2 + 0.3], yTop],
    ];
    for (const [[z0, z1], y] of treads) {
      parts.push(span('tread', [-xi, xi], [y - 0.026, y], [z0, z1], { bevel: 0.004 }));
      for (const z of spaced(4, z0 + 0.025, z1 - 0.025)) parts.push(sp('tread', [-xi + 0.025, xi - 0.025], [y, y + 0.0018], [z - 0.004, z + 0.004]));
    }
    return parts;
  },
});

// ── Small & low stools ───────────────────────────────────────────────────────

const milkingStool = defineItem({
  id: 'three-legged-milking-stool',
  name: 'Three-legged milking stool',
  category: 'living',
  type: 'seating',
  group: GROUP,
  tags: ['milking stool', 'three legs', 'tripod stool', 'farmhouse', 'low stool', 'wedged tenons', 'ghế đẩu ba chân'],
  description: 'A low round stool on three splayed ash legs, tenoned right through the thick oak seat and split with walnut wedges.',
  defaultSize: { w: 0.3, d: 0.3, h: 0.3 },
  minSize: { w: 0.26, d: 0.26, h: 0.22 },
  maxSize: { w: 0.36, d: 0.36, h: 0.4 },
  slots: [
    matSlot('seat', 'Seat', 'wood-oak-natural'),
    matSlot('legs', 'Legs', 'wood-ash-white'),
    matSlot('wedge', 'Wedges', 'wood-walnut'),
  ],
  build: ({ w, d, h }) => {
    const R = Math.min(w, d) / 2;
    const sT = 0.042;
    const parts: Part[] = [lathe('seat', [0, h - sT, 0], [[0, 0], [R - 0.012, 0], [R - 0.002, 0.01], [R, 0.026], [R - 0.008, sT - 0.0016], [0, sT - 0.0016]], { segments: 40 })];
    const rt = R * 0.5;
    const rb = R - 0.02;
    for (const k of range(3)) {
      const a = Math.PI / 2 + (k * TAU) / 3;
      const b = polar(a, rb, 0);
      const t = polar(a, rt, h - sT);
      parts.push(rod('legs', b, t, 0.0145, { rTop: 0.0185, plan: false }));
      // The tenon comes up through the seat a little further out along the splay.
      const g = along(b, t, (h - 0.003) / (h - sT));
      parts.push(cyl('legs', [g[0], h - 0.0034, g[2]], 0.0155, 0.0052, O));
      parts.push(box3('wedge', [g[0], h - 0.0025, g[2]], [0.03, 0.005, 0.004], -a + 0.3, 0));
    }
    return parts;
  },
});

const spoolStool = defineItem({
  id: 'moulded-spool-stool',
  name: 'Moulded plastic spool stool',
  category: 'kids',
  type: 'seating',
  group: GROUP,
  tags: ['spool stool', 'pop stool', 'plastic stool', 'stackable', 'colourful', 'side table', 'retro', 'ghế nhựa tròn'],
  description: 'A light pop stool made of two moulded plastic cones joined at the waist, with ribbed rims; it stacks and doubles as a side table.',
  defaultSize: { w: 0.31, d: 0.31, h: 0.44 },
  minSize: { w: 0.28, d: 0.28, h: 0.4 },
  maxSize: { w: 0.36, d: 0.36, h: 0.48 },
  slots: [matSlot('plastic', 'Plastic', 'plastic-yellow')],
  variants: [
    { id: 'red', name: 'Red', materials: { plastic: 'plastic-red' } },
    { id: 'white', name: 'White', materials: { plastic: 'plastic-white' } },
    { id: 'black', name: 'Black', materials: { plastic: 'plastic-black' } },
    { id: 'mint', name: 'Mint', materials: { plastic: 'plastic-mint' } },
    { id: 'pink', name: 'Pink', materials: { plastic: 'plastic-pink' } },
  ],
  build: ({ w, d, h }) => {
    const R = Math.min(w, d) / 2;
    const m = h / 2;
    const parts: Part[] = [
      lathe('plastic', [0, 0, 0], [[0, 0], [R, 0], [R, 0.014], [R - 0.012, 0.022], [R * 0.56, m - 0.008], [R * 0.5, m], [R * 0.56, m + 0.008], [R - 0.012, h - 0.022], [R, h - 0.014], [R, h], [R - 0.014, h], [R - 0.02, h - 0.006], [0, h - 0.008]], { segments: 40 }),
      ring('plastic', [0, m, 0], R * 0.5 + 0.002, 0.005, O),
    ];
    for (const y of [0.03, 0.04, h - 0.04, h - 0.03]) {
      const r = y < m ? lerp(R - 0.012, R * 0.56, (y - 0.022) / (m - 0.03)) : lerp(R * 0.56, R - 0.012, (y - m - 0.008) / (h - 0.03 - m));
      parts.push(ring('plastic', [0, y, 0], r, 0.0025, O));
    }
    return parts;
  },
});

const kidsStepStool = defineItem({
  id: 'kids-wooden-step-up-stool',
  name: "Children's wooden step-up stool",
  category: 'kids',
  type: 'seating',
  group: GROUP,
  tags: ['step stool', 'kids', 'children', 'toddler', 'two step', 'bathroom sink', 'non-slip', 'ghế bậc trẻ em'],
  description: 'A sturdy two-step stool so small children can reach the basin or the counter: painted sides with an arch, birch treads and rubber grip strips.',
  defaultSize: { w: 0.4, d: 0.3, h: 0.26 },
  minSize: { w: 0.32, d: 0.24, h: 0.2 },
  maxSize: { w: 0.46, d: 0.36, h: 0.32 },
  slots: [
    matSlot('body', 'Painted sides', 'wood-painted-white'),
    matSlot('tread', 'Treads', 'wood-plywood'),
    matSlot('grip', 'Grip strips', 'rubber-black'),
  ],
  build: ({ w, d, h }) => {
    const parts: Part[] = [];
    const t = 0.016;
    const yB = h - 0.0012;
    const yA = h * 0.52;
    const zm = 0.0;
    const zf = d / 2 - 0.006;
    const zb = -d / 2 + 0.004;
    const rz = d / 2 - 0.05;
    const ry = Math.min(0.06, yA * 0.5);
    const profile: V2[] = [
      [zf, 0],
      [zf, yA - 0.0015],
      [zm, yA - 0.0015],
      [zm, yB - 0.0015],
      [zb, yB - 0.0015],
      [zb, 0],
      ...range(9).map((i) => {
        const th = Math.PI - (i * Math.PI) / 8;
        return [rz * Math.cos(th), ry * Math.sin(th)] as V2;
      }),
    ];
    for (const s of [-1, 1]) parts.push(sidePlate('body', profile, s < 0 ? -w / 2 : w / 2 - t, t, true));
    const xi: V2 = [-w / 2 + t, w / 2 - t];
    const treads: [V2, number][] = [
      [[zm, d / 2], yA],
      [[-d / 2, zm + 0.006], yB],
    ];
    for (const [[z0, z1], y] of treads) {
      parts.push(span('tread', xi, [y - 0.018, y], [z0, z1], { bevel: 0.003 }));
      for (const z of spaced(2, z0 + 0.035, z1 - 0.035)) parts.push(sp('grip', [xi[0] + 0.03, xi[1] - 0.03], [y, y + 0.0012], [z - 0.011, z + 0.011]));
    }
    // Riser under the top step and a back panel.
    parts.push(sp('body', xi, [yA, yB - 0.018], [zm - 0.012, zm - 0.001]));
    parts.push(sp('body', xi, [yA + 0.01, yB - 0.03], [-d / 2 + 0.006, -d / 2 + 0.018]));
    return parts;
  },
});

const mushroomStool = defineItem({
  id: 'solid-oak-mushroom-stool',
  name: 'Solid oak mushroom stool',
  category: 'living',
  type: 'seating',
  group: GROUP,
  tags: ['mushroom stool', 'turned stool', 'solid wood', 'oak', 'walnut', 'organic', 'side table', 'ghế nấm gỗ'],
  description: 'A turned solid-wood stool shaped like a mushroom: a domed oak cap on a thick walnut stem with two grooves and a flared foot.',
  defaultSize: { w: 0.38, d: 0.38, h: 0.42 },
  minSize: { w: 0.3, d: 0.3, h: 0.32 },
  maxSize: { w: 0.45, d: 0.45, h: 0.48 },
  slots: [matSlot('cap', 'Seat cap', 'wood-oak-natural'), matSlot('stem', 'Stem', 'wood-walnut')],
  build: ({ w, d, h }) => {
    const R = Math.min(w, d) / 2;
    const capH = clamp(h * 0.22, 0.07, 0.1);
    const yC = h - capH;
    const stem: V2[] = [[0, 0], [R * 0.62, 0], [R * 0.6, 0.015], [R * 0.4, 0.06], [R * 0.3, yC * 0.5], [R * 0.33, yC - 0.02], [R * 0.45, yC], [0, yC]];
    const parts: Part[] = [
      lathe('cap', [0, yC, 0], [[0, 0], [R * 0.55, 0], [R * 0.85, capH * 0.15], [R, capH * 0.45], [R * 0.93, capH * 0.8], [R * 0.7, capH * 0.97], [0, capH]], { segments: 44 }),
      lathe('stem', [0, 0, 0], stem, { segments: 36, plan: false }),
    ];
    for (const y of [yC * 0.3, yC * 0.36]) parts.push(ring('stem', [0, y, 0], profileR(stem, y) - 0.001, 0.0025, O));
    return parts;
  },
});

const stumpStool = defineItem({
  id: 'tree-stump-stool',
  name: 'Tree-stump stool with bark',
  category: 'outdoor',
  type: 'seating',
  group: GROUP,
  tags: ['tree stump', 'log stool', 'natural wood', 'bark', 'rustic', 'side table', 'cabin', 'gốc cây', 'đôn gốc cây'],
  description: 'A section of log kept in its bark, with a sanded and sealed top showing the growth rings and drying cracks; a stool or a side table.',
  defaultSize: { w: 0.36, d: 0.36, h: 0.42 },
  minSize: { w: 0.28, d: 0.28, h: 0.3 },
  maxSize: { w: 0.48, d: 0.48, h: 0.5 },
  slots: [
    matSlot('bark', 'Bark', 'stump-bark'),
    matSlot('top', 'Sanded top', 'wood-pine'),
    matSlot('rings', 'Growth rings', 'wood-walnut'),
  ],
  build: ({ w, d, h }) => {
    const R = Math.min(w, d) / 2;
    const wob = [1, 0.96, 0.985, 0.95, 0.975, 0.955, 0.97];
    const prof: V2[] = [[0, 0], [R * 0.97, 0], [R, 0.02], ...wob.map((k, i) => [R * k * 0.97, lerp(0.05, h - 0.03, i / (wob.length - 1))] as V2), [R * 0.9, h - 0.008], [R * 0.88, h - 0.004], [0, h - 0.004]];
    const parts: Part[] = [lathe('bark', [0, 0, 0], prof, { segments: 28 })];
    parts.push(cyl('top', [0, h - 0.015, 0], R * 0.86, 0.027, { segments: 40, plan: false }));
    for (const f of [0.22, 0.42, 0.6, 0.76]) parts.push(ring('rings', [0, h - 0.0015, 0], R * 0.86 * f, 0.0012, O));
    parts.push(box3('rings', [R * 0.3, h - 0.0015, R * 0.05], [R * 0.5, 0.003, 0.003], 0.35, 0));
    parts.push(box3('rings', [-R * 0.25, h - 0.0015, -R * 0.2], [R * 0.4, 0.003, 0.0025], 2.4, 0));
    // A few knots on the bark.
    for (const [a, y, s] of [[0.6, 0.35, 0.022], [2.4, 0.6, 0.018], [4.1, 0.22, 0.026], [5.3, 0.75, 0.016]] as V3[]) {
      parts.push(sphere('bark', polar(a, profileR(prof, h * y) - s * 0.7, h * y), s, { scale: [1, 0.8, 1], plan: false }));
    }
    return parts;
  },
});

const japaneseStool = defineItem({
  id: 'japanese-low-wooden-stool',
  name: 'Japanese low wooden stool',
  category: 'living',
  type: 'seating',
  group: GROUP,
  tags: ['japanese', 'low stool', 'hinoki', 'koshikake', 'genkan', 'wedged tenons', 'minimal', 'ghế thấp nhật'],
  description: 'A low pale hinoki stool for the genkan or the floor table: one board on two splayed slab legs with wedged through-tenons and a low stretcher.',
  defaultSize: { w: 0.42, d: 0.22, h: 0.22 },
  minSize: { w: 0.3, d: 0.18, h: 0.16 },
  maxSize: { w: 0.6, d: 0.28, h: 0.3 },
  slots: [matSlot('wood', 'Hinoki', 'wood-ash-white'), matSlot('wedge', 'Wedges', 'wood-walnut')],
  build: ({ w, d, h }) => {
    const parts: Part[] = [];
    const sT = 0.028;
    const yU = h - sT;
    parts.push(span('wood', [-w / 2, w / 2], [yU, h - 0.0016], [-d / 2, d / 2], { bevel: 0.006 }));
    const xl = w / 2 - 0.07;
    const lt = 0.026;
    const legX = (y: number) => xl + 0.03 * (1 - y / yU);
    for (const s of [-1, 1]) {
      parts.push(stick('wood', [s * (xl + 0.03), 0.004, 0], [s * xl, yU, 0], lt, d - 0.03));
      for (const z of [-d / 4, d / 4]) {
        parts.push(sp('wood', [s * xl - lt / 2, s * xl + lt / 2], [yU, h - 0.0008], [z - 0.022, z + 0.022]));
        parts.push(sp('wedge', [s * xl - 0.0018, s * xl + 0.0018], [h - 0.005, h], [z - 0.02, z + 0.02]));
      }
      // Stretcher tenon showing outside the leg.
      const xo = legX(0.055) + lt / 2 + 0.008;
      parts.push(sp('wood', [s > 0 ? legX(0.055) - 0.01 : -xo, s > 0 ? xo : -legX(0.055) + 0.01], [0.042, 0.068], [-0.011, 0.011]));
      parts.push(sp('wedge', [s * xo - 0.004, s * xo + 0.004].sort((a, b) => a - b) as V2, [0.044, 0.066], [-0.0016, 0.0016]));
    }
    parts.push(sp('wood', [-legX(0.055), legX(0.055)], [0.044, 0.066], [-0.0105, 0.0105]));
    return parts;
  },
});

const corkStool = defineItem({
  id: 'solid-cork-stool',
  name: 'Solid cork stool',
  category: 'living',
  type: 'seating',
  group: GROUP,
  tags: ['cork stool', 'cork', 'side table', 'natural', 'sustainable', 'hourglass', 'lightweight', 'ghế bần'],
  description: 'A light hourglass stool turned from a solid block of agglomerated cork, with two shallow grooves; warm to touch and fine in the bathroom.',
  defaultSize: { w: 0.36, d: 0.36, h: 0.43 },
  minSize: { w: 0.3, d: 0.3, h: 0.38 },
  maxSize: { w: 0.42, d: 0.42, h: 0.48 },
  slots: [matSlot('cork', 'Cork', 'cork')],
  build: ({ w, d, h }) => {
    const R = Math.min(w, d) / 2;
    const prof: V2[] = [[0, 0], [R * 0.9, 0], [R * 0.98, 0.012], [R, 0.03], [R * 0.9, h * 0.25], [R * 0.72, h * 0.5], [R * 0.9, h * 0.75], [R, h - 0.03], [R * 0.98, h - 0.012], [R * 0.9, h], [0, h]];
    return [
      lathe('cork', [0, 0, 0], prof, { segments: 48 }),
      ring('cork', [0, h * 0.25, 0], profileR(prof, h * 0.25) - 0.002, 0.003, O),
      ring('cork', [0, h * 0.75, 0], profileR(prof, h * 0.75) - 0.002, 0.003, O),
    ];
  },
});

const butterflyStool = defineItem({
  id: 'plywood-butterfly-stool',
  name: 'Bent plywood butterfly stool',
  category: 'living',
  type: 'seating',
  group: GROUP,
  tags: ['butterfly stool', 'bent plywood', 'japanese modern', 'mid-century', 'rosewood', 'brass', 'design classic', 'ghế bướm'],
  description: 'Two identical bent-plywood halves, back to back like wings, joined by brass bolts and a slim brass stretcher between the legs.',
  defaultSize: { w: 0.42, d: 0.31, h: 0.39 },
  minSize: { w: 0.38, d: 0.28, h: 0.36 },
  maxSize: { w: 0.5, d: 0.36, h: 0.44 },
  slots: [matSlot('ply', 'Bent plywood', 'wood-rosewood'), matSlot('metal', 'Brass bolts & stretcher', 'metal-brass')],
  build: ({ w, d, h }) => {
    const parts: Part[] = [];
    const t = 0.012;
    const ys = h - 0.06;
    const bez = (a: V2, c: V2, b: V2, u: number): V2 => [
      (1 - u) ** 2 * a[0] + 2 * u * (1 - u) * c[0] + u * u * b[0],
      (1 - u) ** 2 * a[1] + 2 * u * (1 - u) * c[1] + u * u * b[1],
    ];
    const C: V2 = [0.008, ys];
    const legPts = range(8).map((i) => bez(C, [0.03, 0.1], [w / 2 - 0.04, 0.007], i / 7));
    const wingPts = range(8).map((i) => bez(C, [w * 0.24, ys - 0.012], [w / 2 - 0.009, h - 0.008], i / 7));
    const seg = (p: V2, q: V2, s: number, plan: boolean): Part => {
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]) + 0.002;
      const part: Part = {
        shape: 'box',
        size: [len, t, d],
        position: [(s * (p[0] + q[0])) / 2, (p[1] + q[1]) / 2, 0],
        rotation: [0, 0, Math.atan2(q[1] - p[1], s * (q[0] - p[0]))],
        slot: 'ply',
      };
      if (!plan) part.plan = false;
      return part;
    };
    for (const s of [-1, 1]) {
      for (let i = 1; i < 8; i++) {
        parts.push(seg(legPts[i - 1], legPts[i], s, false));
        parts.push(seg(wingPts[i - 1], wingPts[i], s, true));
      }
    }
    // Bolts through both halves under the seat, and the stretcher between the legs.
    for (const z of [-d * 0.25, d * 0.25]) {
      parts.push(rodX('metal', -0.022, 0.022, ys - 0.05, z, 0.004, O));
      for (const s of [-1, 1]) parts.push(sphere('metal', [s * 0.022, ys - 0.05, z], 0.006, { scale: [0.5, 1, 1], plan: false }));
    }
    const yR = 0.11;
    let xr = legPts[legPts.length - 1][0];
    for (let i = 1; i < 60; i++) {
      const p = bez(C, [0.03, 0.1], [w / 2 - 0.04, 0.007], i / 59);
      if (p[1] <= yR) {
        xr = p[0];
        break;
      }
    }
    parts.push(rodX('metal', -xr - 0.004, xr + 0.004, yR, 0, 0.0055, O));
    for (const s of [-1, 1]) parts.push(sphere('metal', [s * (xr + 0.01), yR, 0], 0.007, { scale: [0.6, 1, 1], plan: false }));
    return parts;
  },
});

const campStool = defineItem({
  id: 'folding-camp-stool-canvas',
  name: 'Folding camp stool with canvas seat',
  category: 'outdoor',
  type: 'seating',
  group: GROUP,
  tags: ['camp stool', 'folding stool', 'canvas', 'fishing stool', 'portable', 'x frame', 'picnic', 'ghế xếp'],
  description: 'A portable folding stool: two crossed beech leg frames pivoting on steel bolts, with a canvas sling seat between the top rails.',
  defaultSize: { w: 0.4, d: 0.33, h: 0.42 },
  minSize: { w: 0.34, d: 0.28, h: 0.36 },
  maxSize: { w: 0.48, d: 0.4, h: 0.5 },
  slots: [
    matSlot('frame', 'Wooden frame', 'wood-maple'),
    matSlot('canvas', 'Canvas seat', 'fabric-olive'),
    matSlot('metal', 'Pivot bolts', 'metal-brushed-steel'),
  ],
  build: ({ w, d, h }) => {
    const parts: Part[] = [];
    const xo = w / 2 - 0.012;
    const xi = xo - 0.024;
    const zb = d / 2 - 0.016;
    const zt = d / 2 - 0.026;
    const yt = h - 0.022;
    for (const s of [-1, 1]) {
      parts.push(stick('frame', [s * xo, 0.012, zb], [s * xo, yt, -zt], 0.018, 0.026, 0.003));
      parts.push(stick('frame', [s * xi, 0.012, -zb], [s * xi, yt, zt], 0.018, 0.026, 0.003));
      const yc = (yt * zb + 0.012 * zt) / (zb + zt);
      const zc = lerp(zb, -zt, (yc - 0.012) / (yt - 0.012));
      const a = s * (xo + 0.011);
      const b = s * (xi - 0.011);
      parts.push(rodX('metal', Math.min(a, b), Math.max(a, b), yc, zc, 0.0045, O));
      parts.push(sphere('metal', [a, yc, zc], 0.006, { scale: [0.5, 1, 1], plan: false }));
    }
    parts.push(rodX('frame', -xo, xo, yt, -zt, 0.012, O), rodX('frame', -xi, xi, yt, zt, 0.012, O));
    parts.push(rodX('frame', -xo, xo, 0.07, lerp(zb, -zt, (0.07 - 0.012) / (yt - 0.012)), 0.01, O));
    parts.push(rodX('frame', -xi, xi, 0.07, -lerp(zb, -zt, (0.07 - 0.012) / (yt - 0.012)), 0.01, O));
    // Sagging canvas sling.
    const n = 4;
    const sag = 0.022;
    const pt = (i: number): V2 => {
      const z = lerp(-zt, zt, i / n);
      return [z, yt + 0.012 - sag * (1 - (z / zt) ** 2)];
    };
    for (let i = 1; i <= n; i++) {
      const [z0, y0] = pt(i - 1);
      const [z1, y1] = pt(i);
      parts.push({
        shape: 'box',
        size: [2 * xi - 0.02, 0.004, Math.hypot(z1 - z0, y1 - y0) + 0.002],
        position: [0, (y0 + y1) / 2, (z0 + z1) / 2],
        rotation: [Math.atan2(-(y1 - y0), z1 - z0), 0, 0],
        slot: 'canvas',
      });
    }
    return parts;
  },
});

const tulipStool = defineItem({
  id: 'tulip-pedestal-stool',
  name: 'Tulip pedestal stool',
  category: 'living',
  type: 'seating',
  group: GROUP,
  tags: ['tulip stool', 'pedestal', 'space age', 'mid-century', 'bouclé', 'vanity stool', 'round stool', 'ghế đôn chân xoè'],
  description: 'A space-age stool on one flared pedestal that opens into a shallow cup holding a round bouclé cushion.',
  defaultSize: { w: 0.4, d: 0.4, h: 0.45 },
  minSize: { w: 0.36, d: 0.36, h: 0.4 },
  maxSize: { w: 0.46, d: 0.46, h: 0.5 },
  slots: [matSlot('base', 'Pedestal', 'metal-white-powder'), matSlot('cushion', 'Seat cushion', 'fabric-boucle')],
  variants: [
    { id: 'black', name: 'Black & charcoal', materials: { base: 'metal-black-matte', cushion: 'fabric-boucle-charcoal' } },
    { id: 'sage', name: 'White & sage velvet', materials: { cushion: 'fabric-velvet-sage' } },
    { id: 'champagne', name: 'Champagne & green', materials: { base: 'metal-champagne', cushion: 'fabric-velvet-green' } },
  ],
  build: ({ w, d, h }) => {
    const R = Math.min(w, d) / 2;
    const yC = h - 0.05;
    return [
      lathe('base', [0, 0, 0], [[0, 0], [R * 0.82, 0], [R * 0.83, 0.006], [R * 0.6, 0.028], [R * 0.25, 0.08], [R * 0.14, 0.16], [R * 0.13, yC * 0.6], [R * 0.2, yC * 0.85], [R * 0.55, yC - 0.02], [R * 0.92, yC - 0.004], [R, yC + 0.008], [R - 0.008, yC + 0.012], [R - 0.012, yC - 0.004], [0, yC - 0.006]], { segments: 48 }),
      lathe('cushion', [0, yC - 0.004, 0], [[0, 0], [R - 0.014, 0], [R - 0.011, 0.018], [R - 0.014, h - yC - 0.006], [R * 0.75, h - yC + 0.0035], [0, h - yC + 0.004]], { segments: 44, plan: false }),
    ];
  },
});

const vanityStool = defineItem({
  id: 'skirted-round-vanity-stool',
  name: 'Skirted round vanity stool',
  category: 'bedroom',
  type: 'seating',
  group: GROUP,
  tags: ['vanity stool', 'dressing table', 'skirted', 'pleated', 'linen', 'piping', 'french', 'ghế bàn trang điểm'],
  description: 'A round dressing-table stool with a padded linen top, contrast piping and a box-pleated skirt down to the floor, finished with a button.',
  defaultSize: { w: 0.42, d: 0.42, h: 0.46 },
  minSize: { w: 0.36, d: 0.36, h: 0.4 },
  maxSize: { w: 0.5, d: 0.5, h: 0.52 },
  slots: [matSlot('fabric', 'Top & skirt', 'fabric-linen-sage'), matSlot('trim', 'Piping & button', 'fabric-cream')],
  variants: [
    { id: 'blush', name: 'Blush velvet', materials: { fabric: 'fabric-velvet-blush', trim: 'fabric-velvet-blush' } },
    { id: 'floral', name: 'Floral print', materials: { fabric: 'fabric-floral-print' } },
    { id: 'natural', name: 'Natural & rust', materials: { fabric: 'fabric-linen', trim: 'fabric-linen-rust' } },
  ],
  build: ({ w, d, h }) => {
    const R = Math.min(w, d) / 2;
    const yT = h - 0.07;
    const parts: Part[] = [
      lathe('fabric', [0, yT, 0], [[0, 0], [R - 0.008, 0], [R - 0.002, 0.02], [R - 0.004, 0.045], [R * 0.85, 0.065], [0, 0.07]], { segments: 44 }),
      ring('trim', [0, yT + 0.022, 0], R - 0.006, 0.005, O),
      ring('trim', [0, yT - 0.006, 0], R - 0.01, 0.006, O),
      sphere('trim', [0, h - 0.006, 0], 0.012, { scale: [1, 0.5, 1], plan: false }),
    ];
    const n = 20;
    for (const k of range(n)) {
      const a = (k * TAU) / n;
      const r = k % 2 ? R - 0.018 : R - 0.012;
      const segLen = 2 * r * Math.sin(Math.PI / n) + 0.006;
      parts.push(box3('fabric', polar(a, r, (0.008 + yT + 0.004) / 2), [segLen, yT + 0.004 - 0.008, 0.01], -(a + Math.PI / 2), 0.003));
    }
    return parts;
  },
});

const xFrameStool = defineItem({
  id: 'x-frame-upholstered-stool',
  name: 'X-frame upholstered stool',
  category: 'living',
  type: 'seating',
  group: GROUP,
  tags: ['x frame', 'x bench', 'upholstered stool', 'brass', 'bed end', 'regency', 'bouclé', 'ghế đôn chân chéo'],
  description: 'A Regency-style stool on two crossed flat-bar brass frames joined by a stretcher with ball ends, with a piped, buttoned bouclé cushion.',
  defaultSize: { w: 0.56, d: 0.42, h: 0.46 },
  minSize: { w: 0.45, d: 0.36, h: 0.42 },
  maxSize: { w: 0.8, d: 0.5, h: 0.5 },
  slots: [matSlot('frame', 'Brass X-frame', 'metal-brass'), matSlot('uph', 'Upholstery', 'fabric-boucle-oat')],
  variants: [
    { id: 'green', name: 'Green velvet & brass', materials: { uph: 'fabric-velvet-green' } },
    { id: 'cognac', name: 'Cognac & black', materials: { uph: 'leather-cognac', frame: 'metal-black-matte' } },
    { id: 'rust', name: 'Rust velvet & bronze', materials: { uph: 'fabric-velvet-rust', frame: 'metal-bronze' } },
  ],
  build: ({ w, d, h }) => {
    const parts: Part[] = [];
    const xs = w / 2 - 0.022;
    const yR = h - 0.09;
    const z = d / 2 - 0.03;
    for (const s of [-1, 1]) {
      parts.push(stick('frame', [s * xs, 0.012, z], [s * xs, yR, -z], 0.012, 0.03, 0.002));
      parts.push(stick('frame', [s * xs, 0.012, -z], [s * xs, yR, z], 0.012, 0.03, 0.002));
      parts.push(rodZ('frame', s * xs, yR + 0.008, -d / 2 + 0.02, d / 2 - 0.02, 0.01, O));
      for (const zz of [-z, z]) parts.push(sp('frame', [s * xs - 0.009, s * xs + 0.009], [0, 0.014], [zz - 0.025, zz + 0.025], 0.003));
    }
    const yc = (yR + 0.012) / 2;
    parts.push(rodX('frame', -xs, xs, yc, 0, 0.008, O));
    for (const s of [-1, 1]) parts.push(sphere('frame', [s * (xs + 0.012), yc, 0], 0.012, O));
    // Cushion with piping and buttons.
    const xc: V2 = [-w / 2 + 0.008, w / 2 - 0.008];
    const zc: V2 = [-d / 2 + 0.008, d / 2 - 0.008];
    parts.push(cushion('uph', xc, [yR + 0.018, h - 0.004], zc, { softness: 0.3 }));
    const yp = h - 0.016;
    parts.push(...rodPath('uph', [[xc[0] + 0.01, yp, zc[0] + 0.004], [xc[1] - 0.01, yp, zc[0] + 0.004]], 0.004));
    parts.push(...rodPath('uph', [[xc[0] + 0.01, yp, zc[1] - 0.004], [xc[1] - 0.01, yp, zc[1] - 0.004]], 0.004));
    const nb = clamp(Math.round(w / 0.18), 2, 4);
    for (const x of cells(nb, xc[0], xc[1])) for (const zz of [-d * 0.15, d * 0.15]) parts.push(sphere('uph', [x, h - 0.006, zz], 0.009, { scale: [1, 0.5, 1], plan: false }));
    return parts;
  },
});

const footstool = defineItem({
  id: 'button-tufted-leather-footstool',
  name: 'Button-tufted leather footstool',
  category: 'living',
  type: 'seating',
  group: 'Ottomans & poufs',
  tags: ['footstool', 'ottoman', 'chesterfield', 'button tufted', 'leather', 'nailhead trim', 'bun feet', 'đôn gác chân'],
  description: 'A Chesterfield footstool in cognac leather with a deep-buttoned top, a row of antique-bronze nailheads and turned walnut bun feet.',
  defaultSize: { w: 0.6, d: 0.42, h: 0.4 },
  minSize: { w: 0.45, d: 0.35, h: 0.34 },
  maxSize: { w: 0.9, d: 0.6, h: 0.46 },
  slots: [
    matSlot('leather', 'Leather', 'leather-cognac'),
    matSlot('wood', 'Bun feet', 'wood-walnut'),
    matSlot('nails', 'Nailheads', 'metal-bronze'),
  ],
  build: ({ w, d, h }) => {
    const parts: Part[] = [];
    const legH = clamp(h * 0.25, 0.08, 0.11);
    const bx: V2 = [-w / 2 + 0.012, w / 2 - 0.012];
    const bz: V2 = [-d / 2 + 0.012, d / 2 - 0.012];
    parts.push(span('leather', bx, [legH, h - 0.05], bz, { bevel: 0.01 }));
    parts.push(cushion('leather', [-w / 2 + 0.004, w / 2 - 0.004], [h - 0.062, h - 0.005], [-d / 2 + 0.004, d / 2 - 0.004], { softness: 0.4, plan: false }));
    // Diamond buttoning.
    const nx = clamp(Math.round(w / 0.14), 3, 6);
    for (const [j, z] of [-d * 0.18, d * 0.18].entries()) {
      for (const x of cells(nx, -w / 2 + 0.06 + (j ? 0.03 : 0), w / 2 - 0.06 + (j ? 0.03 : 0))) {
        if (Math.abs(x) < w / 2 - 0.05) parts.push(sphere('leather', [x, h - 0.0052, z], 0.0085, { scale: [1, 0.6, 1], plan: false }));
      }
    }
    // Nailhead trim along the bottom of the upholstery.
    const yN = legH + 0.016;
    const step = 0.032;
    for (const x of spaced(Math.floor((w - 0.06) / step) + 1, -w / 2 + 0.03, w / 2 - 0.03)) {
      for (const s of [-1, 1]) parts.push(sphere('nails', [x, yN, s * (bz[1] + 0.0015)], 0.0055, O));
    }
    for (const z of spaced(Math.floor((d - 0.06) / step) + 1, -d / 2 + 0.03, d / 2 - 0.03)) {
      for (const s of [-1, 1]) parts.push(sphere('nails', [s * (bx[1] + 0.0015), yN, z], 0.0055, O));
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(turnedLeg('wood', sx * (w / 2 - 0.055), sz * (d / 2 - 0.055), 0, legH, 0.03, { style: 'bun' }));
    return parts;
  },
});

export default definePack({
  name: 'Stools',
  version: '1.0.0',
  author: 'Neest team',
  description:
    'Thirty-five stools: bar and counter stools (gas-lift, low-back walnut, hairpin, sheet steel, cross-braced oak, channel-tufted velvet, rattan, tractor seat, bentwood with cane, Shaker tape seat), Vietnamese everyday stools (ghế nhựa đỏ, tall round plastic stool, đôn gỗ, đôn sứ, ghế tre, ghế băng), studio and workshop stools, and small low stools from a milking stool to a tree stump.',
  license: 'CC0 (made for Neest)',
  items: [
    gasLiftStool,
    lowBackStool,
    hairpinStool,
    steelBarStool,
    steelLowStool,
    crossBraceStool,
    channelStool,
    rattanStool,
    tractorStool,
    bentwoodStool,
    shakerStool,
    lowPlasticStool,
    tallPlasticStool,
    donStool,
    ceramicStool,
    bambooStool,
    plankBench,
    pianoStool,
    labStool,
    wobbleStool,
    boxStool,
    stepStool,
    milkingStool,
    spoolStool,
    kidsStepStool,
    mushroomStool,
    stumpStool,
    japaneseStool,
    corkStool,
    butterflyStool,
    campStool,
    tulipStool,
    vanityStool,
    xFrameStool,
    footstool,
  ],
  materials: [
    { id: 'powder-red', name: 'Red powder-coated steel', category: 'metal', color: '#b0322b', roughness: 0.5, metalness: 0.35 },
    { id: 'powder-mustard', name: 'Mustard powder-coated steel', category: 'metal', color: '#c99a2e', roughness: 0.5, metalness: 0.35 },
    { id: 'powder-green', name: 'Tractor-green enamel', category: 'metal', color: '#2f6b3a', roughness: 0.4, metalness: 0.3 },
    { id: 'stump-bark', name: 'Log bark', category: 'wood', color: '#6e5846', roughness: 0.95, pattern: { id: 'wood-grain', scale: 0.2, contrast: 0.7 }, photo: { set: 'bark-furrowed', scale: 0.5 } },
  ],
});

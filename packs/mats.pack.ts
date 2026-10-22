/**
 * Mats — 35 floor mats for every room:
 * - Door and entrance: coir doormat with a printed border, rubber-backed tufted doormat, half-moon coir
 *   mat, rubber ring scraper mat, recessed aluminium entrance grid, boot tray with river pebbles.
 * - Bath: ribbed tufted cotton, channel-quilted memory foam, bamboo lattice shower mat, diatomite stone
 *   (thảm đá khuê tảo), pebble-look PVC, U-shaped toilet contour mat.
 * - Kitchen and laundry: anti-fatigue foam mat, washable runner, silicone under-sink drip tray,
 *   washing-machine anti-vibration mat.
 * - Living, bedroom and kids: round braided jute, faux fur shag, EVA puzzle tiles, folding padded play
 *   mat, XPE crawling mat with a town map.
 * - Fitness: thick NBR mat, rubber gym tiles, rolled yoga mat with strap.
 * - Asian and Vietnamese: single and two-mat tatami, Nga Sơn chiếu cói, chiếu trúc, chiếu mây, prayer rug.
 * - Office, pets and outdoor: clear PVC chair mat with lip, silicone feeding mat, cooling gel mat,
 *   reversible plastic straw mat, gingham picnic blanket.
 *
 * Local space: origin at the centre of the footprint on the floor, +z is the front. Printed and woven
 * motifs are thin layers whose tops (and bottoms) step 0.6 mm per colour, so no two colours share a plane.
 */
import {
  cellSpans,
  cells,
  clamp,
  cushion,
  cyl,
  defineItem,
  definePack,
  lathe,
  line,
  matSlot,
  poly,
  prism,
  range,
  rectPoly,
  ellipsePoints,
  rng,
  rodX,
  rodZ,
  roundRectPoints,
  spaced,
  span,
  sphere,
  torus,
  vcyl,
  box,
  type PackPattern,
  type Part,
  type PlanStroke,
  type V2,
} from '@/packs/kit';

// ── Shared helpers ───────────────────────────────────────────────────────────

const TAU = Math.PI * 2;
const O = { plan: false } as const;
const RUGS = 'Rugs';

/** Detail box (hidden from the plan) spanning x/y/z ranges. */
const sp = (slot: string, x: V2, y: V2, z: V2, bevel = 0): Part =>
  span(slot, x, y, z, { bevel, plan: false });

/** Four bars of a rectangular band (outer x0..x1, z0..z1, bar width t) from y0 to y1; corners not doubled. */
function band(
  slot: string,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  t: number,
  y0: number,
  y1: number,
  plan = false,
  bevel = 0,
): Part[] {
  const o = { bevel, plan };
  return [
    span(slot, [x0, x1], [y0, y1], [z0, z0 + t], o),
    span(slot, [x0, x1], [y0, y1], [z1 - t, z1], o),
    span(slot, [x0, x0 + t], [y0, y1], [z0 + t, z1 - t], o),
    span(slot, [x1 - t, x1], [y0, y1], [z0 + t, z1 - t], o),
  ];
}

/** Rounded-rectangle slab (prism) centred at (cx, cz). */
const slab = (
  slot: string,
  w: number,
  d: number,
  r: number,
  y0: number,
  hh: number,
  plan = true,
  cx = 0,
  cz = 0,
): Part => prism(slot, roundRectPoints(cx, cz, w, d, r, 5), y0, hh, plan ? undefined : O);

/** Flat rhombus (prism) with half-diagonals a (x) and b (z). */
const rhombus = (slot: string, x: number, z: number, a: number, b: number, y: V2): Part =>
  prism(
    slot,
    [
      [x - a, z],
      [x, z - b],
      [x + a, z],
      [x, z + b],
    ],
    y[0],
    y[1] - y[0],
    O,
  );

/** Thin flat strip from (xa, za) to (xb, zb), width t, between heights y. */
function strip(slot: string, xa: number, za: number, xb: number, zb: number, t: number, y: V2): Part {
  const len = Math.hypot(xb - xa, zb - za);
  return box(slot, [(xa + xb) / 2, (y[0] + y[1]) / 2, (za + zb) / 2], [len, y[1] - y[0], t], {
    rotation: [0, -Math.atan2(zb - za, xb - xa), 0],
    plan: false,
  });
}

/** Flat ring lying on the floor plane (hole facing up), stretched to sx × sz, tube scaled vertically by sy. */
const flatRing = (
  slot: string,
  x: number,
  y: number,
  z: number,
  R: number,
  tube: number,
  sx = 1,
  sz = 1,
  sy = 1,
): Part =>
  torus(slot, [x, y, z], R, tube, { rotation: [Math.PI / 2, 0, 0], scale: [sx, sz, sy], plan: false });

/** Flat arc of a ring from angle `start` (0 = +x, π/2 = +z) through `arc`. */
const flatArc = (
  slot: string,
  x: number,
  y: number,
  z: number,
  R: number,
  tube: number,
  start: number,
  arc: number,
  sy = 1,
): Part =>
  torus(slot, [x, y, z], R, tube, { rotation: [Math.PI / 2, 0, start], scale: [1, 1, sy], arc, plan: false });

/** Print layer k: a 2 mm layer whose top sits 0.6 mm (k + 1) above the surface `top`. */
const layer = (top: number, k: number): V2 => [top - 0.0014 + 0.0006 * k, top + 0.0006 + 0.0006 * k];

const byte = (v: number): number => Math.round(clamp(v, 0, 1) * 255);

// ── Door and entrance ────────────────────────────────────────────────────────

const coirPrinted = defineItem({
  id: 'coir-doormat-printed-border',
  name: 'Coir doormat with printed border',
  category: 'decor',
  type: 'decor',
  group: RUGS,
  tags: ['doormat', 'coir', 'entrance mat', 'thảm chùi chân', 'thảm xơ dừa', 'welcome mat'],
  description:
    'Stiff coconut-coir doormat on a black rubber backing, printed with a black border band, a fine inner line and corner diamonds.',
  defaultSize: { w: 0.75, d: 0.45, h: 0.022 },
  minSize: { w: 0.4, d: 0.3, h: 0.015 },
  maxSize: { w: 1.5, d: 1.0, h: 0.035 },
  slots: [
    matSlot('coir', 'Coir', 'coir'),
    matSlot('print', 'Printed border', 'coir-black'),
    matSlot('backing', 'Rubber backing', 'rubber-black'),
  ],
  build: ({ w, d, h }) => {
    const bh = 0.004;
    const i = 0.006;
    const b = clamp(Math.min(w, d) * 0.08, 0.022, 0.05);
    const m = i + clamp(Math.min(w, d) * 0.05, 0.015, 0.04);
    const x0 = -w / 2 + m;
    const x1 = w / 2 - m;
    const z0 = -d / 2 + m;
    const z1 = d / 2 - m;
    const py: V2 = [h - 0.002, h + 0.001];
    const g = b + 0.012;
    const parts: Part[] = [
      span('backing', [-w / 2, w / 2], [0, bh], [-d / 2, d / 2], { bevel: 0.0015 }),
      sp('coir', [-w / 2 + i, w / 2 - i], [bh, h], [-d / 2 + i, d / 2 - i], 0.002),
      ...band('print', x0, x1, z0, z1, b, py[0], py[1]),
      ...band('print', x0 + g, x1 - g, z0 + g, z1 - g, 0.006, py[0], py[1]),
    ];
    // Corner diamonds inside the fine line, and three along the middle.
    const s = b * 0.55;
    const cx = x1 - g - 0.006 - s - 0.01;
    const cz = z1 - g - 0.006 - s - 0.01;
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) parts.push(rhombus('print', sx * cx, sz * cz, s, s, py));
    for (const x of [-1, 0, 1]) parts.push(rhombus('print', x * s * 3, 0, s * 1.2, s * 0.8, py));
    return parts;
  },
  planDetail: ({ w, d }) => {
    const b = clamp(Math.min(w, d) * 0.08, 0.022, 0.05);
    const m = 0.006 + clamp(Math.min(w, d) * 0.05, 0.015, 0.04) + b;
    return [rectPoly(-w / 2 + m, -d / 2 + m, w / 2 - m, d / 2 - m)];
  },
});

const tuftedDoormat = defineItem({
  id: 'tufted-rubber-doormat',
  name: 'Rubber-backed tufted doormat',
  category: 'decor',
  type: 'decor',
  group: RUGS,
  tags: ['doormat', 'entrance mat', 'thảm chùi chân', 'thảm cao su', 'ribbed', 'dirt trapper'],
  description:
    'Grey ribbed polypropylene tufts set in a black moulded rubber tray with a bevelled lip that keeps the dirt in.',
  defaultSize: { w: 0.9, d: 0.6, h: 0.012 },
  minSize: { w: 0.5, d: 0.4, h: 0.008 },
  maxSize: { w: 1.8, d: 1.2, h: 0.018 },
  slots: [matSlot('pile', 'Tufted pile', 'carpet-grey'), matSlot('rubber', 'Rubber border', 'rubber-black')],
  build: ({ w, d, h }) => {
    const e = clamp(Math.min(w, d) * 0.05, 0.022, 0.04);
    const yb = h * 0.3;
    const parts: Part[] = [
      span('rubber', [-w / 2, w / 2], [0, yb], [-d / 2, d / 2], { bevel: 0.002 }),
      ...band('rubber', -w / 2, w / 2, -d / 2, d / 2, e, 0, h * 0.75, false, 0.003),
    ];
    const n = clamp(Math.round((d - 2 * e) / 0.02), 4, 70);
    const p = (d - 2 * e - 0.006) / n;
    for (const z of cells(n, -d / 2 + e + 0.003, d / 2 - e - 0.003)) {
      parts.push(
        sp(
          'pile',
          [-w / 2 + e + 0.003, w / 2 - e - 0.003],
          [yb, h],
          [z - p * 0.45, z + p * 0.45],
          Math.min(p * 0.4, (h - yb) * 0.45),
        ),
      );
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const e = clamp(Math.min(w, d) * 0.05, 0.022, 0.04);
    return [rectPoly(-w / 2 + e, -d / 2 + e, w / 2 - e, d / 2 - e)];
  },
});

/** Half-ellipse outline: flat edge at z0, round edge towards +z (rx wide, rz deep). */
function halfMoon(rx: number, rz: number, z0: number, n = 28): V2[] {
  return range(n + 1).map((i) => {
    const a = (i / n) * Math.PI;
    return [Math.cos(a) * rx, z0 + Math.sin(a) * rz] as V2;
  });
}

const halfMoonCoir = defineItem({
  id: 'half-moon-coir-mat',
  name: 'Half-moon coir doormat',
  category: 'decor',
  type: 'decor',
  group: RUGS,
  tags: ['doormat', 'half moon', 'semicircle', 'coir', 'thảm xơ dừa', 'thảm bán nguyệt', 'front door'],
  description:
    'Semicircular coconut-coir doormat on a rubber backing, printed with a dark arch band, a row of dots and a rising-sun motif.',
  defaultSize: { w: 0.75, d: 0.45, h: 0.02 },
  minSize: { w: 0.5, d: 0.3, h: 0.015 },
  maxSize: { w: 1.2, d: 0.7, h: 0.03 },
  slots: [
    matSlot('coir', 'Coir', 'coir'),
    matSlot('print', 'Print', 'coir-black'),
    matSlot('backing', 'Rubber backing', 'rubber-black'),
  ],
  build: ({ w, d, h }) => {
    const z0 = -d / 2;
    const py: V2 = [h - 0.002, h + 0.001];
    const rx1 = w / 2 - 0.03;
    const rz1 = d - 0.045;
    const bb = clamp(d * 0.08, 0.02, 0.045);
    const rx2 = rx1 - bb;
    const rz2 = rz1 - bb;
    const parts: Part[] = [
      prism('backing', halfMoon(w / 2, d, z0), 0, 0.003),
      prism('coir', halfMoon(w / 2 - 0.005, d - 0.01, z0 + 0.005), 0.003, h - 0.003, O),
      prism(
        'print',
        [...halfMoon(rx1, rz1, z0 + 0.012), ...halfMoon(rx2, rz2, z0 + 0.012).reverse()],
        py[0],
        py[1] - py[0],
        O,
      ),
    ];
    // Dots along an inner arch.
    const rxd = rx2 - 0.03;
    const rzd = rz2 - 0.03;
    for (const a of spaced(7, 0.25, Math.PI - 0.25)) {
      parts.push(
        vcyl('print', Math.cos(a) * rxd, z0 + 0.012 + Math.sin(a) * rzd, py[0], py[1], 0.008, {
          ...O,
          segments: 16,
        }),
      );
    }
    // Rising sun at the flat edge with seven rays.
    const rs = Math.min(rx2, rz2) * 0.35;
    parts.push(prism('print', halfMoon(rs, rs, z0 + 0.012, 16), py[0], py[1] - py[0], O));
    for (const a of spaced(7, 0.2, Math.PI - 0.2)) {
      const c = Math.cos(a);
      const s = Math.sin(a);
      parts.push(
        strip(
          'print',
          c * (rs + 0.012),
          z0 + 0.012 + s * (rs + 0.012),
          c * (rs + 0.04),
          z0 + 0.012 + s * (rs + 0.04),
          0.006,
          py,
        ),
      );
    }
    return parts;
  },
  planDetail: ({ w, d }) => [poly(halfMoon(w / 2 - 0.03, d - 0.045, -d / 2 + 0.012), false)],
});

const ringMat = defineItem({
  id: 'rubber-ring-scraper-mat',
  name: 'Rubber ring scraper mat',
  category: 'outdoor',
  type: 'decor',
  group: RUGS,
  tags: [
    'scraper mat',
    'ring mat',
    'rubber mat',
    'thảm cao su lỗ',
    'thảm chùi chân',
    'outdoor doormat',
    'drainage',
  ],
  description:
    'Heavy black rubber mat made of interlinked rings on an edge rail, so mud and rain drain straight through.',
  defaultSize: { w: 0.9, d: 0.6, h: 0.022 },
  minSize: { w: 0.4, d: 0.3, h: 0.015 },
  maxSize: { w: 1.5, d: 1.0, h: 0.03 },
  slots: [matSlot('rubber', 'Rubber', 'rubber-black')],
  build: ({ w, d, h }) => {
    const nx = clamp(Math.round(w / 0.075), 4, 12);
    const nz = clamp(Math.round(d / 0.075), 3, 12);
    const e = 0.006;
    const cw = (w - 2 * e) / nx;
    const cd = (d - 2 * e) / nz;
    const R0 = Math.min(cw, cd) / 2;
    const tube = R0 * 0.22;
    const parts: Part[] = band('rubber', -w / 2, w / 2, -d / 2, d / 2, e, 0, h * 0.6, true);
    for (const x of cells(nx, -w / 2 + e, w / 2 - e)) {
      for (const z of cells(nz, -d / 2 + e, d / 2 - e)) {
        parts.push(flatRing('rubber', x, h / 2, z, R0 - tube, tube, cw / 2 / R0, cd / 2 / R0, h / 2 / tube));
      }
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const nx = clamp(Math.round(w / 0.075), 4, 12);
    const nz = clamp(Math.round(d / 0.075), 3, 12);
    const out: PlanStroke[] = [];
    for (const [x] of cellSpans(nx, -w / 2 + 0.006, w / 2 - 0.006).slice(1))
      out.push(line([x, -d / 2], [x, d / 2]));
    for (const [z] of cellSpans(nz, -d / 2 + 0.006, d / 2 - 0.006).slice(1))
      out.push(line([-w / 2, z], [w / 2, z]));
    return out;
  },
});

const gridMat = defineItem({
  id: 'aluminium-entrance-grid-mat',
  name: 'Recessed aluminium entrance grid mat',
  category: 'decor',
  type: 'decor',
  group: RUGS,
  tags: [
    'entrance matting',
    'recessed mat',
    'aluminium mat',
    'thảm nhôm',
    'thảm sảnh',
    'lobby',
    'commercial',
  ],
  description:
    'Commercial entrance mat of aluminium profiles in a frame, with alternating carpet and black rubber scraper inserts.',
  defaultSize: { w: 1.2, d: 0.9, h: 0.02 },
  minSize: { w: 0.6, d: 0.4, h: 0.012 },
  maxSize: { w: 3.0, d: 2.0, h: 0.027 },
  slots: [
    matSlot('alu', 'Aluminium profiles', 'metal-brushed-steel'),
    matSlot('textile', 'Carpet inserts', 'carpet-grey'),
    matSlot('rubber', 'Rubber inserts', 'rubber-black'),
  ],
  build: ({ w, d, h }) => {
    const fr = 0.02;
    const parts: Part[] = band('alu', -w / 2, w / 2, -d / 2, d / 2, fr, 0, h - 0.002, true, 0.001);
    const n = clamp(Math.round((d - 2 * fr) / 0.033), 4, 70);
    const xr: V2 = [-w / 2 + fr + 0.003, w / 2 - fr - 0.003];
    const g = 0.0025;
    for (const [k, [za, zb]] of cellSpans(n, -d / 2 + fr + 0.002, d / 2 - fr - 0.002).entries()) {
      parts.push(sp('alu', xr, [0.002, h - 0.004], [za + g, zb - g], 0.0015));
      parts.push(
        sp(
          k % 3 === 1 ? 'rubber' : 'textile',
          [xr[0] + 0.001, xr[1] - 0.001],
          [h - 0.009, h],
          [za + g + 0.004, zb - g - 0.004],
          0.0015,
        ),
      );
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const n = clamp(Math.round((d - 0.04) / 0.033), 4, 70);
    const out: PlanStroke[] = [rectPoly(-w / 2 + 0.02, -d / 2 + 0.02, w / 2 - 0.02, d / 2 - 0.02)];
    for (const [z] of cellSpans(n, -d / 2 + 0.022, d / 2 - 0.022)
      .slice(1)
      .filter((_, i) => i % 3 === 0))
      out.push(line([-w / 2 + 0.02, z], [w / 2 - 0.02, z]));
    return out;
  },
});

const bootTray = defineItem({
  id: 'boot-tray-pebbles',
  name: 'Boot tray with river pebbles',
  category: 'storage',
  type: 'storage',
  group: 'Hallway storage',
  tags: ['boot tray', 'shoe tray', 'khay để giày', 'pebbles', 'entryway', 'wet shoes', 'genkan'],
  description:
    'Low black rubber boot tray with a raised rim, filled with smooth grey and charcoal river pebbles so wet shoes drain and dry.',
  defaultSize: { w: 0.76, d: 0.38, h: 0.045 },
  minSize: { w: 0.5, d: 0.3, h: 0.035 },
  maxSize: { w: 1.2, d: 0.5, h: 0.06 },
  slots: [
    matSlot('tray', 'Tray', 'rubber-black'),
    matSlot('pebbles', 'River pebbles', 'pebble-grey'),
    matSlot('dark', 'Dark pebbles', 'pebble-dark'),
  ],
  build: ({ w, d, h }) => {
    const t = 0.008;
    const fb = 0.004;
    const parts: Part[] = [
      span('tray', [-w / 2, w / 2], [0, fb], [-d / 2, d / 2], { bevel: 0.0015 }),
      ...band('tray', -w / 2, w / 2, -d / 2, d / 2, t, 0, h, true, 0.003),
    ];
    const iw = w - 2 * t - 0.006;
    const id = d - 2 * t - 0.006;
    const pitch = Math.max(0.042, Math.sqrt((iw * id) / 125));
    const nx = Math.max(1, Math.floor(iw / pitch));
    const nz = Math.max(1, Math.floor(id / pitch));
    const r = rng(11);
    const ryMax = Math.min(0.012, (h - fb) * 0.45);
    for (const x of cells(nx, -iw / 2, iw / 2)) {
      for (const z of cells(nz, -id / 2, id / 2)) {
        const rx = pitch * (0.36 + 0.1 * r());
        const rz = pitch * (0.28 + 0.12 * r());
        const ry = ryMax * (0.7 + 0.3 * r());
        const jx = (r() - 0.5) * pitch * 0.12;
        const jz = (r() - 0.5) * pitch * 0.12;
        parts.push(
          sphere(r() < 0.35 ? 'dark' : 'pebbles', [x + jx, fb + ry * 0.55, z + jz], 1, {
            scale: [rx, ry, rz],
            rotation: [0, r() * Math.PI, 0],
            plan: false,
          }),
        );
      }
    }
    return parts;
  },
  planDetail: ({ w, d }) => [rectPoly(-w / 2 + 0.008, -d / 2 + 0.008, w / 2 - 0.008, d / 2 - 0.008)],
});

// ── Bath ─────────────────────────────────────────────────────────────────────

const ribbedBath = defineItem({
  id: 'ribbed-cotton-bath-mat',
  name: 'Ribbed tufted cotton bath mat',
  category: 'bathroom',
  type: 'decor',
  group: RUGS,
  tags: ['bath mat', 'cotton', 'tufted', 'thảm nhà tắm', 'thảm cotton', 'ribbed', 'absorbent'],
  description:
    'Thick tufted cotton bath mat with soft ribs running front to back, finished with a flat stone-grey hemmed edge.',
  defaultSize: { w: 0.8, d: 0.5, h: 0.02 },
  minSize: { w: 0.5, d: 0.35, h: 0.012 },
  maxSize: { w: 1.3, d: 0.8, h: 0.03 },
  slots: [
    matSlot('pile', 'Cotton pile', 'fabric-terry-white'),
    matSlot('hem', 'Hemmed edge', 'fabric-stone'),
  ],
  build: ({ w, d, h }) => {
    const e = 0.018;
    const parts: Part[] = [
      ...band('hem', -w / 2, w / 2, -d / 2, d / 2, e, 0, h * 0.45, true, 0.002),
      sp('pile', [-w / 2 + e, w / 2 - e], [0, h * 0.35], [-d / 2 + e, d / 2 - e]),
    ];
    const n = clamp(Math.round((w - 2 * e) / 0.03), 5, 50);
    const p = (w - 2 * e) / n;
    for (const x of cells(n, -w / 2 + e, w / 2 - e)) {
      parts.push(
        cushion('pile', [x - p * 0.46, x + p * 0.46], [h * 0.3, h], [-d / 2 + e + 0.004, d / 2 - e - 0.004], {
          softness: 0.45,
          plan: false,
        }),
      );
    }
    return parts;
  },
  planDetail: ({ w, d }) => [rectPoly(-w / 2 + 0.018, -d / 2 + 0.018, w / 2 - 0.018, d / 2 - 0.018)],
});

const memoryFoamBath = defineItem({
  id: 'memory-foam-bath-mat',
  name: 'Channel-quilted memory foam bath mat',
  category: 'bathroom',
  type: 'decor',
  group: RUGS,
  tags: ['bath mat', 'memory foam', 'velvet', 'thảm nhà tắm', 'thảm chống trượt', 'quilted', 'soft'],
  description:
    'Plush grey velvet bath mat over memory foam, quilted into wide puffy channels, on a grey non-slip rubber base.',
  defaultSize: { w: 0.8, d: 0.5, h: 0.03 },
  minSize: { w: 0.5, d: 0.35, h: 0.02 },
  maxSize: { w: 1.2, d: 0.75, h: 0.04 },
  slots: [
    matSlot('velvet', 'Velvet cover', 'fabric-velvet-grey'),
    matSlot('base', 'Non-slip base', 'rubber-grey'),
  ],
  build: ({ w, d, h }) => {
    const r = Math.min(0.05, w * 0.1, d * 0.1);
    const parts: Part[] = [
      slab('base', w, d, r, 0, 0.002),
      slab('velvet', w - 0.008, d - 0.008, r * 0.9, 0.002, h * 0.45, false),
    ];
    const n = clamp(Math.round(d / 0.09), 3, 9);
    for (const [za, zb] of cellSpans(n, -d / 2 + 0.006, d / 2 - 0.006)) {
      parts.push(
        cushion('velvet', [-w / 2 + 0.006, w / 2 - 0.006], [h * 0.25, h], [za + 0.002, zb - 0.002], {
          softness: 0.45,
          plan: false,
        }),
      );
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const n = clamp(Math.round(d / 0.09), 3, 9);
    return cellSpans(n, -d / 2 + 0.006, d / 2 - 0.006)
      .slice(1)
      .map(([z]) => line([-w / 2 + 0.02, z], [w / 2 - 0.02, z]));
  },
});

const bambooLattice = defineItem({
  id: 'bamboo-lattice-shower-mat',
  name: 'Bamboo lattice shower mat',
  category: 'bathroom',
  type: 'decor',
  group: RUGS,
  tags: ['shower mat', 'duckboard', 'bamboo', 'thảm tre', 'thảm nhà tắm', 'lattice', 'slatted'],
  description:
    'Two crossed layers of oiled bamboo slats forming an open lattice that drains, standing on small rubber feet.',
  defaultSize: { w: 0.6, d: 0.4, h: 0.03 },
  minSize: { w: 0.4, d: 0.3, h: 0.025 },
  maxSize: { w: 1.0, d: 0.7, h: 0.04 },
  slots: [matSlot('bamboo', 'Bamboo', 'wood-bamboo'), matSlot('feet', 'Rubber feet', 'rubber-black')],
  build: ({ w, d, h }) => {
    const fh = 0.004;
    const mid = fh + (h - fh) * 0.45;
    const parts: Part[] = [];
    const nTop = clamp(Math.round(d / 0.042), 4, 24);
    const st = (d / nTop) * 0.7;
    for (const [k, z] of cells(nTop, -d / 2, d / 2).entries()) {
      const edge = k === 0 || k === nTop - 1;
      parts.push(
        span('bamboo', [-w / 2, w / 2], [mid, h], [z - st / 2, z + st / 2], { bevel: 0.003, plan: edge }),
      );
    }
    const nB = clamp(Math.round(w / 0.09), 3, 14);
    const sb = 0.022;
    const xs = spaced(nB, -w / 2 + sb / 2 + 0.01, w / 2 - sb / 2 - 0.01);
    for (const [k, x] of xs.entries()) {
      const edge = k === 0 || k === nB - 1;
      parts.push(
        span('bamboo', [x - sb / 2, x + sb / 2], [fh, mid], [-d / 2 + 0.004, d / 2 - 0.004], {
          bevel: 0.002,
          plan: edge,
        }),
      );
      if (edge || k === Math.floor(nB / 2))
        for (const z of [-d / 2 + 0.03, d / 2 - 0.03])
          parts.push(vcyl('feet', x, z, 0, fh, 0.009, { ...O, segments: 16 }));
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const nTop = clamp(Math.round(d / 0.042), 4, 24);
    return cells(nTop, -d / 2, d / 2)
      .slice(0, -1)
      .map((z) => line([-w / 2, z + d / nTop / 2], [w / 2, z + d / nTop / 2]));
  },
});

const diatomite = defineItem({
  id: 'diatomite-bath-mat',
  name: 'Diatomite stone bath mat',
  category: 'bathroom',
  type: 'decor',
  group: RUGS,
  tags: [
    'diatomite',
    'diatomaceous earth',
    'thảm đá',
    'thảm đá khuê tảo',
    'quick dry',
    'bath mat',
    'stone mat',
  ],
  description:
    'Thin rigid slab of pale diatomaceous earth that soaks up water and dries in minutes, with grey wave-line inlays and rubber corner pads.',
  defaultSize: { w: 0.6, d: 0.39, h: 0.009 },
  minSize: { w: 0.45, d: 0.3, h: 0.008 },
  maxSize: { w: 0.8, d: 0.5, h: 0.012 },
  slots: [
    matSlot('stone', 'Diatomite', 'diatomite'),
    matSlot('inlay', 'Wave inlay', 'diatomite-grey'),
    matSlot('pads', 'Non-slip pads', 'rubber-black'),
  ],
  build: ({ w, d, h }) => {
    const pad = 0.0015;
    const parts: Part[] = [slab('stone', w, d, 0.025, pad, h - pad)];
    const x0 = -w / 2 + 0.035;
    const x1 = w / 2 - 0.035;
    const A = Math.min(0.008, d * 0.02);
    for (const k of range(3)) {
      const zc = d / 2 - 0.05 - k * 0.016;
      const n = 24;
      const top: V2[] = range(n + 1).map((i) => {
        const x = x0 + ((x1 - x0) * i) / n;
        return [x, zc + A * Math.sin((i / n) * TAU * 2) - 0.003];
      });
      const bottom: V2[] = top.map(([x, z]) => [x, z + 0.006] as V2).reverse();
      parts.push(prism('inlay', [...top, ...bottom], h - 0.001, 0.0018, O));
    }
    for (const sx of [-1, 1])
      for (const sz of [-1, 1])
        parts.push(
          vcyl('pads', sx * (w / 2 - 0.04), sz * (d / 2 - 0.04), 0, pad, 0.012, { ...O, segments: 16 }),
        );
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w / 2 + 0.035, d / 2 - 0.066], [w / 2 - 0.035, d / 2 - 0.066])],
});

const pebbleBath = defineItem({
  id: 'pebble-bath-mat',
  name: 'Pebble-look bath mat',
  category: 'bathroom',
  type: 'decor',
  group: RUGS,
  tags: ['pebble mat', 'shower mat', 'thảm sỏi', 'thảm chống trượt', 'river stone', 'anti-slip', 'bath mat'],
  description:
    'Non-slip PVC shower mat moulded as smooth flat river pebbles in two greys, set on a thin white base.',
  defaultSize: { w: 0.7, d: 0.4, h: 0.015 },
  minSize: { w: 0.4, d: 0.3, h: 0.01 },
  maxSize: { w: 1.0, d: 0.6, h: 0.02 },
  slots: [
    matSlot('pebbles', 'Pebbles', 'pebble-grey'),
    matSlot('dark', 'Dark pebbles', 'pebble-dark'),
    matSlot('base', 'PVC base', 'plastic-white'),
  ],
  build: ({ w, d, h }) => {
    const parts: Part[] = [slab('base', w, d, 0.03, 0, 0.003)];
    const pitch = Math.max(0.045, Math.sqrt((w * d) / 120));
    const nx = Math.max(2, Math.floor((w - 0.02) / pitch));
    const nz = Math.max(2, Math.floor((d - 0.02) / pitch));
    const r = rng(5);
    for (const [j, z] of cells(nz, -d / 2 + 0.01, d / 2 - 0.01).entries()) {
      for (const x of cells(nx, -w / 2 + 0.01, w / 2 - 0.01)) {
        const rx = pitch * (0.36 + 0.12 * r());
        const rz = pitch * (0.28 + 0.12 * r());
        const ry = (h - 0.003) * (0.55 + 0.35 * r());
        const jx = (r() - 0.5) * pitch * 0.2 + (j % 2 ? pitch * 0.08 : -pitch * 0.08);
        parts.push(
          sphere(r() < 0.3 ? 'dark' : 'pebbles', [x + jx, 0.003, z + (r() - 0.5) * pitch * 0.15], 1, {
            scale: [rx, ry, rz],
            rotation: [0, r() * Math.PI, 0],
            plan: false,
          }),
        );
      }
    }
    return parts;
  },
});

/** U-shaped toilet mat outline: notch for the pedestal at the back (−z), inset by e. */
function uOutline(w: number, d: number, e: number): V2[] {
  const nw = Math.min(w * 0.4, 0.2);
  const cz = -d / 2 + d * 0.4 - nw / 2;
  const r = nw / 2 + e;
  const x0 = -w / 2 + e;
  const x1 = w / 2 - e;
  const zb = -d / 2 + e;
  const zf = d / 2 - e;
  const rc = 0.05 - e;
  const pts: V2[] = [[x1, zb]];
  for (const a of spaced(6, 0, Math.PI / 2))
    pts.push([x1 - rc + Math.cos(a) * rc, zf - rc + Math.sin(a) * rc]);
  for (const a of spaced(6, Math.PI / 2, Math.PI))
    pts.push([x0 + rc + Math.cos(a) * rc, zf - rc + Math.sin(a) * rc]);
  pts.push([x0, zb], [-r, zb]);
  for (const a of spaced(16, Math.PI, 0)) pts.push([Math.cos(a) * r, cz + Math.sin(a) * r]);
  pts.push([r, zb]);
  return pts;
}

const toiletMat = defineItem({
  id: 'u-shaped-toilet-mat',
  name: 'U-shaped toilet contour mat',
  category: 'bathroom',
  type: 'decor',
  group: RUGS,
  tags: ['toilet mat', 'contour mat', 'pedestal mat', 'thảm bồn cầu', 'thảm chữ U', 'bathroom rug'],
  description:
    'Soft sage microfibre mat with a U-shaped cut-out that hugs the toilet pedestal, bound in cream with sculpted arcs around the notch.',
  defaultSize: { w: 0.5, d: 0.5, h: 0.015 },
  minSize: { w: 0.4, d: 0.4, h: 0.01 },
  maxSize: { w: 0.65, d: 0.6, h: 0.025 },
  slots: [
    matSlot('pile', 'Pile', 'fabric-velvet-sage'),
    matSlot('trim', 'Binding & sculpted lines', 'fabric-cream'),
  ],
  build: ({ w, d, h }) => {
    const nw = Math.min(w * 0.4, 0.2);
    const cz = -d / 2 + d * 0.4 - nw / 2;
    const r = nw / 2 + 0.012;
    const parts: Part[] = [
      prism('trim', uOutline(w, d, 0), 0, h * 0.55),
      prism('pile', uOutline(w, d, 0.012), 0.0015, h - 0.0015, O),
    ];
    // Sculpted lines: arcs round the notch (short strips: a torus arc is bounds-checked as a full ring).
    for (const R of [r + 0.035, r + 0.07]) {
      const pts = spaced(13, 0, Math.PI).map((a) => [Math.cos(a) * R, cz + Math.sin(a) * R] as V2);
      for (const i of range(pts.length - 1))
        parts.push(
          strip('trim', pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 0.005, [h - 0.001, h + 0.0012]),
        );
      for (const sx of [-1, 1]) parts.push(rodZ('trim', sx * R, h, -d / 2 + 0.014, cz, 0.0025, O));
    }
    return parts;
  },
  planDetail: ({ w, d }) => [poly(uOutline(w, d, 0.012))],
});

// ── Kitchen and laundry ──────────────────────────────────────────────────────

const antiFatigue = defineItem({
  id: 'anti-fatigue-kitchen-mat',
  name: 'Anti-fatigue kitchen mat',
  category: 'kitchen',
  type: 'decor',
  group: RUGS,
  tags: [
    'anti-fatigue mat',
    'kitchen mat',
    'thảm bếp',
    'thảm chống mỏi',
    'standing mat',
    'cushioned',
    'foam',
  ],
  description:
    'Thick black PU foam standing mat with rounded bevelled edges and an embossed diamond lattice on top.',
  defaultSize: { w: 1.0, d: 0.5, h: 0.02 },
  minSize: { w: 0.6, d: 0.4, h: 0.012 },
  maxSize: { w: 2.4, d: 0.9, h: 0.025 },
  slots: [matSlot('foam', 'PU foam', 'pu-foam-black')],
  build: ({ w, d, h }) => {
    const parts: Part[] = [span('foam', [-w / 2, w / 2], [0, h], [-d / 2, d / 2], { bevel: h * 0.45 })];
    const x0 = -w / 2 + 0.04;
    const x1 = w / 2 - 0.04;
    const z0 = -d / 2 + 0.04;
    const z1 = d / 2 - 0.04;
    const p = Math.max(0.07, (w + d) / 60);
    const y: V2 = [h - 0.001, h + 0.0012];
    // Lines z = x − c (rising) and z = −x + c (falling), clipped to the inner rectangle.
    for (let c = x0 - z1 + p / 2; c < x1 - z0; c += p) {
      const xa = Math.max(x0, z0 + c);
      const xb = Math.min(x1, z1 + c);
      if (xb - xa > 0.015) parts.push(strip('foam', xa, xa - c, xb, xb - c, 0.006, y));
    }
    for (let c = x0 + z0 + p / 2; c < x1 + z1; c += p) {
      const xa = Math.max(x0, c - z1);
      const xb = Math.min(x1, c - z0);
      if (xb - xa > 0.015) parts.push(strip('foam', xa, c - xa, xb, c - xb, 0.006, y));
    }
    return parts;
  },
  planDetail: ({ w, d }) => [rectPoly(-w / 2 + 0.04, -d / 2 + 0.04, w / 2 - 0.04, d / 2 - 0.04)],
});

const kitchenRunner = defineItem({
  id: 'washable-kitchen-runner',
  name: 'Washable kitchen runner',
  category: 'kitchen',
  type: 'decor',
  group: RUGS,
  tags: ['kitchen runner', 'washable rug', 'thảm bếp', 'thảm dài', 'flatweave', 'non-slip'],
  description:
    'Machine-washable flatweave runner in grey herringbone with mustard end bands and pinstripes, a charcoal dash row and a bound edge.',
  defaultSize: { w: 1.5, d: 0.45, h: 0.006 },
  minSize: { w: 0.8, d: 0.4, h: 0.004 },
  maxSize: { w: 3.0, d: 0.8, h: 0.01 },
  slots: [
    matSlot('field', 'Woven field', 'fabric-herringbone-grey'),
    matSlot('stripes', 'Stripes', 'fabric-mustard'),
    matSlot('binding', 'Bound edge', 'fabric-charcoal'),
  ],
  build: ({ w, d, h }) => {
    const e = 0.012;
    const ys = layer(h, 0);
    const yd = layer(h, 1);
    const parts: Part[] = [
      ...band('binding', -w / 2, w / 2, -d / 2, d / 2, e, 0, h, true),
      sp('field', [-w / 2 + e, w / 2 - e], [0, h - 0.001], [-d / 2 + e, d / 2 - e]),
    ];
    const zr: V2 = [-d / 2 + e + 0.008, d / 2 - e - 0.008];
    for (const s of [-1, 1]) {
      for (const [o, bw] of [
        [0.06, 0.035],
        [0.11, 0.01],
        [0.13, 0.01],
      ] as const) {
        const xa = s * (w / 2 - o);
        const xb = s * (w / 2 - o - bw);
        parts.push(sp('stripes', [Math.min(xa, xb), Math.max(xa, xb)], ys, zr));
      }
    }
    for (const s of [-1, 1])
      parts.push(
        sp('stripes', [-w / 2 + 0.16, w / 2 - 0.16], ys, [
          s * (d / 2 - e - 0.03) - 0.003,
          s * (d / 2 - e - 0.03) + 0.003,
        ]),
      );
    const n = clamp(Math.round((w - 0.4) / 0.06), 1, 40);
    for (const x of cells(n, -w / 2 + 0.2, w / 2 - 0.2))
      parts.push(sp('binding', [x - 0.012, x + 0.012], yd, [-0.004, 0.004]));
    return parts;
  },
  planDetail: ({ w, d }) => [
    line([-w / 2 + 0.06, -d / 2 + 0.03], [-w / 2 + 0.06, d / 2 - 0.03]),
    line([w / 2 - 0.06, -d / 2 + 0.03], [w / 2 - 0.06, d / 2 - 0.03]),
  ],
});

const sinkTray = defineItem({
  id: 'under-sink-drip-tray',
  name: 'Silicone under-sink drip tray',
  category: 'kitchen',
  type: 'decor',
  group: RUGS,
  tags: [
    'under sink mat',
    'drip tray',
    'cabinet liner',
    'thảm lót tủ bếp',
    'khay silicone',
    'leak protector',
  ],
  description:
    'Grey silicone liner for the cabinet under the sink, with a raised rim, a grid of drainage ribs and a white drain plug at the front.',
  defaultSize: { w: 0.86, d: 0.56, h: 0.02 },
  minSize: { w: 0.6, d: 0.4, h: 0.015 },
  maxSize: { w: 0.9, d: 0.6, h: 0.025 },
  slots: [matSlot('silicone', 'Silicone', 'silicone-grey'), matSlot('plug', 'Drain plug', 'plastic-white')],
  build: ({ w, d, h }) => {
    const t = 0.01;
    const fb = 0.004;
    const parts: Part[] = [
      slab('silicone', w, d, 0.02, 0, fb),
      ...band(
        'silicone',
        -w / 2 + 0.002,
        w / 2 - 0.002,
        -d / 2 + 0.002,
        d / 2 - 0.002,
        t,
        0,
        h,
        false,
        0.004,
      ),
    ];
    const xi = w / 2 - t - 0.008;
    const zi = d / 2 - t - 0.008;
    for (const x of spaced(Math.max(3, Math.round((2 * xi) / 0.055)), -xi + 0.02, xi - 0.02))
      parts.push(sp('silicone', [x - 0.002, x + 0.002], [fb - 0.001, fb + 0.004], [-zi, zi], 0.0015));
    for (const z of spaced(Math.max(3, Math.round((2 * zi) / 0.055)), -zi + 0.02, zi - 0.02))
      parts.push(sp('silicone', [-xi, xi], [fb - 0.001, fb + 0.0035], [z - 0.002, z + 0.002], 0.0015));
    parts.push(
      cyl('plug', [w / 2 - 0.08, h * 0.5, d / 2 - 0.001], 0.009, 0.006, {
        rotation: [Math.PI / 2, 0, 0],
        plan: false,
        segments: 20,
      }),
    );
    return parts;
  },
  planDetail: ({ w, d }) => [rectPoly(-w / 2 + 0.012, -d / 2 + 0.012, w / 2 - 0.012, d / 2 - 0.012)],
});

const washerPad = defineItem({
  id: 'washer-anti-vibration-mat',
  name: 'Washing machine anti-vibration mat',
  category: 'laundry',
  type: 'appliances',
  group: 'Laundry',
  tags: ['anti-vibration', 'washer mat', 'thảm lót máy giặt', 'chân đế máy giặt', 'rubber', 'noise'],
  description:
    'Ribbed black rubber mat with four grey foot cups that stop a washing machine from walking and humming on tiles.',
  defaultSize: { w: 0.62, d: 0.62, h: 0.03 },
  minSize: { w: 0.55, d: 0.55, h: 0.02 },
  maxSize: { w: 0.7, d: 0.7, h: 0.04 },
  slots: [matSlot('mat', 'Rubber mat', 'rubber-black'), matSlot('cups', 'Foot cups', 'rubber-grey')],
  build: ({ w, d, h }) => {
    const base = 0.008;
    const rt = base + 0.0025;
    const parts: Part[] = [span('mat', [-w / 2, w / 2], [0, base], [-d / 2, d / 2], { bevel: 0.003 })];
    const n = clamp(Math.round((d - 0.04) / 0.02), 10, 40);
    for (const z of cells(n, -d / 2 + 0.02, d / 2 - 0.02))
      parts.push(
        sp('mat', [-w / 2 + 0.02, w / 2 - 0.02], [base - 0.001, rt], [z - 0.004, z + 0.004], 0.0012),
      );
    const H = h - rt;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        parts.push(
          lathe(
            'cups',
            [sx * (w / 2 - 0.075), rt, sz * (d / 2 - 0.075)],
            [
              [0, 0],
              [0.038, 0],
              [0.04, H * 0.25],
              [0.036, H],
              [0.028, H],
              [0.026, H * 0.4],
              [0, H * 0.4],
            ],
            { segments: 28, plan: false },
          ),
        );
      }
    }
    return parts;
  },
  planDetail: ({ w, d }) =>
    [-1, 1].flatMap((sx) =>
      [-1, 1].map(
        (sz) => ({ kind: 'circle', c: [sx * (w / 2 - 0.075), sz * (d / 2 - 0.075)], r: 0.04 }) as PlanStroke,
      ),
    ),
});

// ── Living, bedroom and kids ─────────────────────────────────────────────────

const braidedJute = defineItem({
  id: 'round-braided-jute-mat',
  name: 'Round braided jute mat',
  category: 'living',
  type: 'decor',
  group: RUGS,
  tags: ['jute rug', 'braided', 'round rug', 'thảm đay', 'thảm tròn', 'natural fibre', 'boho'],
  description:
    'Hand-braided natural jute cord coiled into a flat round mat, with three cream cotton braids worked into the coil.',
  defaultSize: { w: 1.2, d: 1.2, h: 0.012 },
  minSize: { w: 0.6, d: 0.6, h: 0.008 },
  maxSize: { w: 2.4, d: 2.4, h: 0.02 },
  slots: [matSlot('jute', 'Braided jute', 'rug-jute'), matSlot('accent', 'Accent braids', 'fabric-cream')],
  build: ({ w, d, h }) => {
    const R = w / 2;
    const zs = d / w;
    const parts: Part[] = [
      cyl('jute', [0, h * 0.2, 0], R - 0.002, h * 0.4, { scale: [1, 1, zs], segments: 64 }),
    ];
    const n = clamp(Math.round(R / 0.026), 6, 46);
    const pr = R / n;
    const accents = new Set([n - 3, n - 6, Math.round(n * 0.45)]);
    for (const i of range(n))
      parts.push(
        flatRing(
          accents.has(i) ? 'accent' : 'jute',
          0,
          h / 2,
          0,
          (i + 0.5) * pr,
          pr * 0.5,
          1,
          zs,
          h / 2 / (pr * 0.5),
        ),
      );
    return parts;
  },
  planDetail: ({ w, d }) => {
    const n = clamp(Math.round(w / 2 / 0.026), 6, 46);
    return [n - 3, n - 6].map((i) =>
      poly(ellipsePoints(0, 0, ((i + 0.5) * w) / 2 / n, ((i + 0.5) * d) / 2 / n, 40)),
    );
  },
});

const fauxFur = defineItem({
  id: 'faux-fur-shag-rug',
  name: 'Faux fur shag rug',
  category: 'bedroom',
  type: 'decor',
  group: RUGS,
  tags: ['faux fur', 'shag rug', 'fluffy rug', 'thảm lông', 'thảm lông giả', 'bedside rug', 'sheepskin look'],
  description:
    'Rectangular dove-grey faux fur rug with a deep fluffy pile in soft clumps, on a suede-feel backing.',
  defaultSize: { w: 1.6, d: 1.0, h: 0.05 },
  minSize: { w: 0.6, d: 0.4, h: 0.03 },
  maxSize: { w: 2.4, d: 1.6, h: 0.07 },
  slots: [matSlot('fur', 'Faux fur', 'faux-fur-grey'), matSlot('backing', 'Suede backing', 'suede-sand')],
  build: ({ w, d, h }) => {
    const r0 = Math.min(0.06, w * 0.08, d * 0.08);
    const parts: Part[] = [
      slab('backing', w, d, r0, 0, 0.003),
      sp('fur', [-w / 2 + 0.01, w / 2 - 0.01], [0.003, h * 0.45], [-d / 2 + 0.01, d / 2 - 0.01], h * 0.18),
    ];
    const pitch = Math.max(0.065, Math.sqrt((w * d) / 140));
    const rMax = pitch * 0.62;
    const nx = clamp(Math.round((w - 2 * rMax) / pitch) + 1, 2, 14);
    const nz = clamp(Math.round((d - 2 * rMax) / pitch) + 1, 2, 10);
    const r = rng(23);
    for (const z of spaced(nz, -d / 2 + rMax, d / 2 - rMax)) {
      for (const x of spaced(nx, -w / 2 + rMax, w / 2 - rMax)) {
        const ry = h * (0.42 + 0.08 * r());
        parts.push(
          sphere('fur', [x, h - ry, z], 1, {
            scale: [rMax * (0.85 + 0.15 * r()), ry, rMax * (0.85 + 0.15 * r())],
            plan: false,
          }),
        );
      }
    }
    return parts;
  },
});

const evaPuzzle = defineItem({
  id: 'eva-puzzle-play-mat',
  name: 'Grey and cream EVA puzzle mat',
  category: 'kids',
  type: 'kids',
  group: 'Nursery',
  tags: ['puzzle mat', 'foam tiles', 'thảm xốp', 'thảm xốp ghép', 'interlocking', 'play mat', 'nursery'],
  description:
    'Large 60 cm interlocking EVA foam tiles in grey and cream with jigsaw teeth along every joint and straight edge strips.',
  defaultSize: { w: 1.8, d: 1.2, h: 0.012 },
  minSize: { w: 0.6, d: 0.6, h: 0.01 },
  maxSize: { w: 3.0, d: 3.0, h: 0.02 },
  slots: [
    matSlot('grey', 'Grey tiles', 'eva-grey'),
    matSlot('cream', 'Cream tiles', 'eva-cream'),
    matSlot('edge', 'Edge strips', 'eva-grey'),
  ],
  build: ({ w, d, h }) => {
    const e = 0.025;
    const ix0 = -w / 2 + e;
    const ix1 = w / 2 - e;
    const iz0 = -d / 2 + e;
    const iz1 = d / 2 - e;
    const nx = clamp(Math.round((w - 2 * e) / 0.6), 1, 5);
    const nz = clamp(Math.round((d - 2 * e) / 0.6), 1, 5);
    const xs = cellSpans(nx, ix0, ix1);
    const zs = cellSpans(nz, iz0, iz1);
    const g = 0.001;
    const slotOf = (i: number, j: number) => ((i + j) % 2 ? 'cream' : 'grey');
    const parts: Part[] = [...band('edge', -w / 2, w / 2, -d / 2, d / 2, e - 0.001, 0, h, true, 0.0015)];
    for (const [j, [z0, z1]] of zs.entries())
      for (const [i, [x0, x1]] of xs.entries())
        parts.push(span(slotOf(i, j), [x0 + g, x1 - g], [0, h], [z0 + g, z1 - g], { bevel: 0.0015 }));
    const seams = (nx - 1) * nz + (nz - 1) * nx;
    const k = seams * 4 + nx * nz + 4 <= 155 ? 2 : 1;
    const ty: V2 = [h - 0.003, h + 0.0008];
    const tooth = (slot: string, sx: number, sz: number, ax: 'x' | 'z', dir: number) => {
      // Neck from the seam into the neighbour, then a round head.
      if (ax === 'x') {
        parts.push(
          sp(slot, [Math.min(sx, sx + dir * 0.02), Math.max(sx, sx + dir * 0.02)], ty, [
            sz - 0.009,
            sz + 0.009,
          ]),
        );
        parts.push(vcyl(slot, sx + dir * 0.027, sz, ty[0], ty[1], 0.016, { ...O, segments: 20 }));
      } else {
        parts.push(
          sp(slot, [sx - 0.009, sx + 0.009], ty, [
            Math.min(sz, sz + dir * 0.02),
            Math.max(sz, sz + dir * 0.02),
          ]),
        );
        parts.push(vcyl(slot, sx, sz + dir * 0.027, ty[0], ty[1], 0.016, { ...O, segments: 20 }));
      }
    };
    for (const [j, [z0, z1]] of zs.entries()) {
      for (const [i, [x0, x1]] of xs.entries()) {
        // Teeth alternate between the two tiles of a joint.
        if (i < nx - 1) {
          for (const [t, z] of cells(k, z0, z1).entries()) {
            const back = (t + i + j) % 2 === 1;
            tooth(slotOf(back ? i + 1 : i, j), x1, z, 'x', back ? -1 : 1);
          }
        }
        if (j < nz - 1) {
          for (const [t, x] of cells(k, x0, x1).entries()) {
            const back = (t + i + j) % 2 === 1;
            tooth(slotOf(i, back ? j + 1 : j), x, z1, 'z', back ? -1 : 1);
          }
        }
      }
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const e = 0.025;
    const nx = clamp(Math.round((w - 2 * e) / 0.6), 1, 5);
    const nz = clamp(Math.round((d - 2 * e) / 0.6), 1, 5);
    const out: PlanStroke[] = [rectPoly(-w / 2 + e, -d / 2 + e, w / 2 - e, d / 2 - e)];
    for (const [x] of cellSpans(nx, -w / 2 + e, w / 2 - e).slice(1))
      out.push(line([x, -d / 2 + e], [x, d / 2 - e]));
    for (const [z] of cellSpans(nz, -d / 2 + e, d / 2 - e).slice(1))
      out.push(line([-w / 2 + e, z], [w / 2 - e, z]));
    return out;
  },
});

const foldingPlay = defineItem({
  id: 'folding-padded-play-mat',
  name: 'Folding padded play mat',
  category: 'kids',
  type: 'kids',
  group: 'Nursery',
  tags: ['folding play mat', 'baby mat', 'thảm gấp', 'thảm chơi cho bé', 'padded', 'waterproof', 'rainbow'],
  description:
    'Four thick foam panels in wipe-clean white PU joined by grey fabric hinges, printed with a mint rainbow, polka dots and grey clouds.',
  defaultSize: { w: 2.0, d: 1.8, h: 0.04 },
  minSize: { w: 1.2, d: 1.2, h: 0.03 },
  maxSize: { w: 2.4, d: 2.0, h: 0.05 },
  slots: [
    matSlot('panels', 'PU panels', 'leather-white'),
    matSlot('print', 'Print', 'plastic-mint'),
    matSlot('trim', 'Hinges & clouds', 'fabric-dove-grey'),
  ],
  build: ({ w, d, h }) => {
    const n = d >= 1.6 ? 4 : 3;
    const spans = cellSpans(n, -d / 2, d / 2);
    const parts: Part[] = [];
    for (const [k, [za, zb]] of spans.entries()) {
      parts.push(cushion('panels', [-w / 2, w / 2], [0, h], [za + 0.004, zb - 0.004], { softness: 0.3 }));
      if (k < n - 1)
        parts.push(sp('trim', [-w / 2 + 0.02, w / 2 - 0.02], [0, h * 0.3], [zb - 0.006, zb + 0.006]));
    }
    const pY = layer(h, 0);
    const cY = layer(h, 1);
    // Rainbow on the second panel, opening towards the front.
    const [rz0, rz1] = spans[1];
    const rcx = -w * 0.2;
    const rcz = rz0 + 0.06;
    const rMax = Math.min(0.3, (rz1 - rz0) * 0.75, w * 0.2);
    for (const f of [0.6, 0.8, 1])
      parts.push(flatArc('print', rcx, h, rcz, rMax * f, 0.014, 0, Math.PI, 0.1));
    // Clouds: three overlapping discs each, at the rainbow's feet.
    for (const s of [-1, 1]) {
      const cx = rcx + s * rMax * 0.9;
      for (const [dx, rr] of [
        [-0.045, 0.035],
        [0, 0.05],
        [0.045, 0.035],
      ] as const)
        parts.push(vcyl('trim', cx + dx, rcz + 0.05, cY[0], cY[1], rr, { ...O, segments: 20 }));
    }
    // Polka dots on the other panels.
    for (const [k, [za, zb]] of spans.entries()) {
      if (k === 1) continue;
      for (const [i, x] of cells(6, -w / 2 + 0.12, w / 2 - 0.12).entries()) {
        const z = za + (zb - za) * (i % 2 ? 0.35 : 0.65);
        parts.push(vcyl('print', x, z, pY[0], pY[1], 0.035, { ...O, segments: 20 }));
      }
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const n = d >= 1.6 ? 4 : 3;
    return cellSpans(n, -d / 2, d / 2)
      .slice(1)
      .map(([z]) => line([-w / 2, z], [w / 2, z]));
  },
});

const xpeTown = defineItem({
  id: 'xpe-crawling-mat-town',
  name: 'XPE crawling mat with town map',
  category: 'kids',
  type: 'kids',
  group: 'Nursery',
  tags: ['crawling mat', 'XPE mat', 'thảm xốp XPE', 'thảm cho bé bò', 'road map', 'play mat', 'town'],
  description:
    'Thin cushioned XPE foam crawling mat printed with a town map: a ring road with lane markings, a park, trees, houses and a river.',
  defaultSize: { w: 1.8, d: 2.0, h: 0.01 },
  minSize: { w: 1.0, d: 1.2, h: 0.005 },
  maxSize: { w: 2.0, d: 2.2, h: 0.02 },
  slots: [
    matSlot('base', 'XPE foam', 'xpe-white'),
    matSlot('road', 'Roads & houses', 'solid-mid-grey'),
    matSlot('green', 'Parks & trees', 'plastic-green'),
    matSlot('blue', 'River & roofs', 'plastic-blue'),
  ],
  build: ({ w, d, h }) => {
    const parts: Part[] = [
      span('base', [-w / 2, w / 2], [0, h], [-d / 2, d / 2], { bevel: Math.min(0.003, h * 0.3) }),
    ];
    const L = (k: number) => layer(h, k);
    const rx = w * 0.3;
    const rz = d * 0.28;
    const rw = 0.09;
    // Ring road, a crossroad and an exit to the left edge.
    for (const s of [-1, 1]) {
      parts.push(sp('road', [-rx - rw / 2, rx + rw / 2], L(2), [s * rz - rw / 2, s * rz + rw / 2]));
      parts.push(sp('road', [s * rx - rw / 2, s * rx + rw / 2], L(2), [-rz + rw / 2, rz - rw / 2]));
    }
    parts.push(sp('road', [-rw / 2, rw / 2], L(2), [-rz + rw / 2, rz - rw / 2]));
    parts.push(sp('road', [-w / 2 + 0.04, -rx - rw / 2], L(2), [-rw / 2, rw / 2]));
    // Lane dashes.
    const dash = (xa: number, xb: number, za: number, zb: number) => {
      const len = Math.hypot(xb - xa, zb - za);
      const n = Math.max(1, Math.floor(len / 0.12));
      for (const t of cells(n, 0, 1)) {
        const x = xa + (xb - xa) * t;
        const z = za + (zb - za) * t;
        parts.push(
          xb !== xa
            ? sp('base', [x - 0.025, x + 0.025], L(3), [z - 0.004, z + 0.004])
            : sp('base', [x - 0.004, x + 0.004], L(3), [z - 0.025, z + 0.025]),
        );
      }
    };
    for (const s of [-1, 1]) {
      dash(-rx + rw, rx - rw, s * rz, s * rz);
      dash(s * rx, s * rx, -rz + rw, rz - rw);
    }
    dash(0, 0, -rz + rw, rz - rw);
    // Park with a pond inside the loop (back-left), houses in the other quadrants.
    const qx = rx / 2;
    const qz = rz / 2;
    parts.push(slab('green', rx * 0.7, rz * 0.6, 0.04, L(1)[0], L(1)[1] - L(1)[0], false, -qx, -qz));
    parts.push(
      vcyl('blue', -qx, -qz, L(0)[0] + 0.0012, L(0)[1] + 0.0012, Math.min(rx, rz) * 0.12, {
        ...O,
        segments: 24,
      }),
    );
    for (const [hx, hz] of [
      [qx, -qz],
      [-qx, qz],
      [qx, qz],
    ] as const) {
      for (const dx of [-0.11, 0, 0.11]) {
        const x = hx + dx * (rx / 0.54);
        parts.push(sp('road', [x - 0.035, x + 0.035], L(2), [hz - 0.01, hz + 0.05]));
        parts.push(
          prism(
            'blue',
            [
              [x - 0.045, hz - 0.012],
              [x + 0.045, hz - 0.012],
              [x, hz - 0.06],
            ],
            L(4)[0],
            L(4)[1] - L(4)[0],
            O,
          ),
        );
      }
    }
    // Trees along the left and right margins.
    for (const s of [-1, 1])
      for (const z of spaced(5, -rz, rz))
        parts.push(
          vcyl(
            'green',
            s * (rx + rw / 2 + (w / 2 - rx - rw / 2) / 2),
            z + (s > 0 ? 0.08 : 0),
            L(1)[0],
            L(1)[1],
            0.035,
            { ...O, segments: 16 },
          ),
        );
    // River across the front strip, under the loop.
    const zr = (rz + rw / 2 + d / 2) / 2;
    const pts: V2[] = [
      [-w / 2 + 0.02, zr - 0.04],
      [-w * 0.2, zr + 0.05],
      [w * 0.05, zr - 0.04],
      [w * 0.3, zr + 0.04],
      [w / 2 - 0.02, zr - 0.02],
    ];
    for (const i of range(pts.length - 1))
      parts.push(
        strip(
          'blue',
          pts[i][0],
          pts[i][1],
          pts[i + 1][0],
          pts[i + 1][1],
          Math.min(0.09, (d / 2 - rz - rw / 2) * 0.4),
          L(0),
        ),
      );
    return parts;
  },
  planDetail: ({ w, d }) => [rectPoly(-w * 0.3, -d * 0.28, w * 0.3, d * 0.28)],
});

// ── Fitness ──────────────────────────────────────────────────────────────────

const nbrMat = defineItem({
  id: 'thick-nbr-exercise-mat',
  name: 'Thick NBR exercise mat',
  category: 'hobbies',
  type: 'activities',
  group: 'Fitness',
  tags: ['exercise mat', 'NBR mat', 'thảm tập', 'thảm tập yoga', 'pilates', 'thick mat', 'workout'],
  description:
    'Extra-thick 15 mm plum NBR foam mat with soft rounded edges and an embossed chevron grip, with its elastic carry strap lying on top.',
  defaultSize: { w: 0.61, d: 1.83, h: 0.015 },
  minSize: { w: 0.55, d: 1.7, h: 0.008 },
  maxSize: { w: 0.8, d: 2.0, h: 0.02 },
  slots: [matSlot('foam', 'NBR foam', 'nbr-plum'), matSlot('strap', 'Carry strap', 'fabric-charcoal')],
  build: ({ w, d, h }) => {
    const parts: Part[] = [span('foam', [-w / 2, w / 2], [0, h], [-d / 2, d / 2], { bevel: h * 0.45 })];
    const y: V2 = [h - 0.001, h + 0.0008];
    const n = Math.round((d - 0.12) / 0.05);
    const xe = w / 2 - 0.04;
    for (const z of cells(n, -d / 2 + 0.06, d / 2 - 0.06)) {
      parts.push(strip('foam', -xe, z - 0.012, 0, z, 0.005, y), strip('foam', 0, z, xe, z - 0.012, 0.005, y));
    }
    const R = Math.min(0.2, w * 0.33);
    const zc = d / 2 - 0.16;
    parts.push(flatRing('strap', 0, h + 0.003, zc, R, 0.003, 1, 0.22, 1));
    parts.push(sp('strap', [R - 0.015, R + 0.015], [h, h + 0.007], [zc - 0.014, zc + 0.014], 0.002));
    return parts;
  },
  planDetail: ({ w, d }) => [
    poly(ellipsePoints(0, d / 2 - 0.16, Math.min(0.2, w * 0.33), Math.min(0.2, w * 0.33) * 0.22, 24)),
  ],
});

const gymTiles = defineItem({
  id: 'rubber-gym-floor-tiles',
  name: 'Rubber gym floor tiles',
  category: 'hobbies',
  type: 'activities',
  group: 'Fitness',
  tags: [
    'gym flooring',
    'rubber tiles',
    'thảm cao su phòng gym',
    'gạch cao su',
    'EPDM',
    'home gym',
    'weights',
  ],
  description:
    'Set of six 50 cm square rubber gym tiles, 2 cm thick, in black rubber with coloured EPDM flecks and chamfered edges.',
  defaultSize: { w: 1.0, d: 1.5, h: 0.02 },
  minSize: { w: 0.5, d: 0.5, h: 0.015 },
  maxSize: { w: 3.0, d: 3.0, h: 0.03 },
  slots: [matSlot('rubber', 'Rubber', 'epdm-fleck')],
  build: ({ w, d, h }) => {
    const nx = clamp(Math.round(w / 0.5), 1, 6);
    const nz = clamp(Math.round(d / 0.5), 1, 6);
    const g = 0.0015;
    const parts: Part[] = [];
    for (const [z0, z1] of cellSpans(nz, -d / 2, d / 2))
      for (const [x0, x1] of cellSpans(nx, -w / 2, w / 2))
        parts.push(span('rubber', [x0 + g, x1 - g], [0, h], [z0 + g, z1 - g], { bevel: 0.004 }));
    return parts;
  },
  planDetail: ({ w, d }) => {
    const nx = clamp(Math.round(w / 0.5), 1, 6);
    const nz = clamp(Math.round(d / 0.5), 1, 6);
    const out: PlanStroke[] = [];
    for (const [x] of cellSpans(nx, -w / 2, w / 2).slice(1)) out.push(line([x, -d / 2], [x, d / 2]));
    for (const [z] of cellSpans(nz, -d / 2, d / 2).slice(1)) out.push(line([-w / 2, z], [w / 2, z]));
    return out;
  },
});

const rolledYoga = defineItem({
  id: 'rolled-yoga-mat-strap',
  name: 'Rolled yoga mat with carry strap',
  category: 'hobbies',
  type: 'activities',
  group: 'Fitness',
  tags: ['yoga mat', 'rolled', 'carry strap', 'thảm yoga', 'thảm tập cuộn', 'TPE', 'two-tone'],
  description:
    'Two-tone teal and grey TPE yoga mat rolled up, the layers showing as rings at the ends, held by a charcoal carry strap.',
  defaultSize: { w: 0.66, d: 0.16, h: 0.16 },
  minSize: { w: 0.6, d: 0.1, h: 0.1 },
  maxSize: { w: 0.8, d: 0.22, h: 0.22 },
  slots: [
    matSlot('top', 'Top layer', 'tpe-teal'),
    matSlot('under', 'Under layer', 'tpe-grey'),
    matSlot('strap', 'Strap', 'fabric-charcoal'),
  ],
  build: ({ w, d, h }) => {
    const r = Math.min(d, h) / 2 - 0.006;
    const L = w - 0.03;
    const parts: Part[] = [rodX('top', -L / 2, L / 2, r, 0, r, { segments: 32 })];
    for (const sx of [-1, 1]) {
      for (const f of [0.28, 0.5, 0.72, 0.92])
        parts.push(
          torus('under', [sx * (L / 2 + 0.0005), r, 0], r * f, 0.0022, {
            rotation: [0, Math.PI / 2, 0],
            plan: false,
          }),
        );
    }
    // The free end of the mat, a slight ridge on the roll.
    const a = 0.6;
    parts.push(
      rodX('top', -L / 2, L / 2, r + (r + 0.001) * Math.sin(a), (r + 0.001) * Math.cos(a), 0.003, O),
    );
    for (const sx of [-1, 1])
      parts.push(
        torus('strap', [sx * L * 0.3, r, 0], r + 0.003, 0.003, {
          rotation: [0, Math.PI / 2, 0],
          scale: [1, 1, 4],
          plan: false,
        }),
      );
    parts.push(box('strap', [0, 2 * r + 0.0075, 0], [0.6 * L, 0.003, 0.025], { plan: false }));
    return parts;
  },
  planDetail: ({ w }) => [line([-w * 0.3, -0.01], [-w * 0.3, 0.01]), line([w * 0.3, -0.01], [w * 0.3, 0.01])],
});

// ── Asian and Vietnamese ─────────────────────────────────────────────────────

/** One tatami: igusa body over x0..x1 × z0..z1, heri border bands along both long (z) sides. */
function tatami(x0: number, x1: number, z0: number, z1: number, h: number): Part[] {
  const b = 0.03;
  const parts: Part[] = [span('igusa', [x0 + 0.002, x1 - 0.002], [0, h], [z0, z1], { bevel: 0.003 })];
  for (const [xa, xb, stitch] of [
    [x0, x0 + b, x0 + b + 0.002],
    [x1 - b, x1, x1 - b - 0.002],
  ] as const) {
    parts.push(sp('heri', [xa, xb], [0, h + 0.001], [z0 + 0.001, z1 - 0.001], 0.002));
    parts.push(rodZ('heri', stitch, h + 0.0004, z0 + 0.01, z1 - 0.01, 0.0011, { ...O, segments: 6 }));
  }
  return parts;
}

const tatamiSingle = defineItem({
  id: 'single-tatami-mat',
  name: 'Single tatami mat with heri border',
  category: 'living',
  type: 'decor',
  group: RUGS,
  tags: ['tatami', 'igusa', 'japanese', 'chiếu tatami', 'thảm tatami', 'heri', 'floor mat'],
  description:
    'One standard Edoma tatami of woven igusa rush over a firm core, with dark brocade heri borders stitched along both long sides.',
  defaultSize: { w: 0.88, d: 1.76, h: 0.055 },
  minSize: { w: 0.8, d: 1.6, h: 0.03 },
  maxSize: { w: 0.96, d: 1.92, h: 0.06 },
  slots: [
    matSlot('igusa', 'Igusa rush (tatami)', 'tatami-mat'),
    matSlot('heri', 'Heri border', 'heri-brocade'),
  ],
  build: ({ w, d, h }) => tatami(-w / 2, w / 2, -d / 2, d / 2, h),
  planDetail: ({ w, d }) => [
    line([-w / 2 + 0.03, -d / 2], [-w / 2 + 0.03, d / 2]),
    line([w / 2 - 0.03, -d / 2], [w / 2 - 0.03, d / 2]),
  ],
});

const tatamiPair = defineItem({
  id: 'two-tatami-mats',
  name: 'Two tatami mats side by side',
  category: 'living',
  type: 'decor',
  group: RUGS,
  tags: ['tatami', 'ni-jo', 'japanese', 'chiếu tatami', 'thảm tatami', 'tea corner', 'washitsu'],
  description:
    'A square two-mat (ni-jō) layout of igusa tatami laid side by side, their brocade heri borders meeting along the centre line.',
  defaultSize: { w: 1.76, d: 1.76, h: 0.055 },
  minSize: { w: 1.6, d: 1.6, h: 0.03 },
  maxSize: { w: 1.92, d: 1.92, h: 0.06 },
  slots: [
    matSlot('igusa', 'Igusa rush (tatami)', 'tatami-mat'),
    matSlot('heri', 'Heri border', 'heri-brocade'),
  ],
  build: ({ w, d, h }) => [
    ...tatami(-w / 2, -0.0015, -d / 2, d / 2, h),
    ...tatami(0.0015, w / 2, -d / 2, d / 2, h),
  ],
  planDetail: ({ w, d }) => [
    line([0, -d / 2], [0, d / 2]),
    line([-w / 2 + 0.03, -d / 2], [-w / 2 + 0.03, d / 2]),
    line([w / 2 - 0.03, -d / 2], [w / 2 - 0.03, d / 2]),
  ],
});

const chieuCoi = defineItem({
  id: 'chieu-coi-nga-son',
  name: 'Nga Sơn sedge sleeping mat (chiếu cói)',
  category: 'bedroom',
  type: 'decor',
  group: RUGS,
  tags: ['chiếu cói', 'chiếu Nga Sơn', 'sedge mat', 'sleeping mat', 'chiếu hoa', 'vietnamese', 'traditional'],
  description:
    'Traditional Nga Sơn sleeping mat woven from golden sedge, with a red and green woven border, a diamond medallion and cloth-bound ends.',
  defaultSize: { w: 1.6, d: 2.0, h: 0.005 },
  minSize: { w: 0.8, d: 1.8, h: 0.003 },
  maxSize: { w: 2.2, d: 2.2, h: 0.008 },
  slots: [
    matSlot('sedge', 'Sedge (cói)', 'sedge'),
    matSlot('red', 'Red pattern', 'sedge-red'),
    matSlot('green', 'Green pattern', 'sedge-green'),
    matSlot('binding', 'Cloth binding', 'binding-indigo'),
  ],
  build: ({ w, d, h }) => {
    const R = layer(h, 0);
    const G = layer(h, 1);
    const R2 = layer(h, 2);
    const parts: Part[] = [span('sedge', [-w / 2, w / 2], [0, h], [-d / 2 + 0.002, d / 2 - 0.002])];
    for (const s of [-1, 1]) {
      parts.push(
        sp(
          'binding',
          [-w / 2 + 0.001, w / 2 - 0.001],
          [0, h + 0.002],
          s > 0 ? [d / 2 - 0.03, d / 2] : [-d / 2, -d / 2 + 0.03],
          0.001,
        ),
      );
      parts.push(
        rodZ('sedge', s * (w / 2 - 0.003), h * 0.5, -d / 2 + 0.03, d / 2 - 0.03, Math.min(0.003, h * 0.6), {
          ...O,
          segments: 8,
        }),
      );
    }
    const mx = 0.07;
    const mz = 0.09;
    const bw = 0.045;
    const x0 = -w / 2 + mx;
    const x1 = w / 2 - mx;
    const z0 = -d / 2 + mz;
    const z1 = d / 2 - mz;
    parts.push(...band('red', x0, x1, z0, z1, bw, R[0], R[1]));
    const gi = bw + 0.02;
    parts.push(...band('green', x0 + gi, x1 - gi, z0 + gi, z1 - gi, 0.012, G[0], G[1]));
    // Corner diamonds inside the green line.
    const ci = gi + 0.012 + 0.05;
    for (const sx of [-1, 1])
      for (const sz of [-1, 1])
        parts.push(rhombus('red', sx * (w / 2 - mx - ci), sz * (d / 2 - mz - ci), 0.035, 0.035, R));
    // Rows of small flower blocks at the head and foot.
    const n = clamp(Math.round((x1 - x0 - 2 * ci - 0.1) / 0.12), 3, 15);
    for (const s of [-1, 1]) {
      for (const [i, x] of cells(n, x0 + ci + 0.05, x1 - ci - 0.05).entries())
        parts.push(rhombus(i % 2 ? 'green' : 'red', x, s * (d / 2 - mz - ci), 0.022, 0.03, i % 2 ? G : R));
    }
    // Centre medallion.
    const a = Math.min(w * 0.18, 0.3);
    parts.push(
      rhombus('red', 0, 0, a, a * 1.25, R),
      rhombus('green', 0, 0, a * 0.62, a * 0.78, G),
      sp('red', [-a * 0.2, a * 0.2], R2, [-a * 0.2, a * 0.2]),
    );
    for (const [dx, dz] of [
      [a * 1.2, 0],
      [-a * 1.2, 0],
      [0, a * 1.45],
      [0, -a * 1.45],
    ] as const)
      parts.push(vcyl('green', dx, dz, G[0], G[1], 0.02, { ...O, segments: 16 }));
    return parts;
  },
  planDetail: ({ w, d }) => [
    rectPoly(-w / 2 + 0.07, -d / 2 + 0.09, w / 2 - 0.07, d / 2 - 0.09),
    poly([
      [-Math.min(w * 0.18, 0.3), 0],
      [0, -Math.min(w * 0.18, 0.3) * 1.25],
      [Math.min(w * 0.18, 0.3), 0],
      [0, Math.min(w * 0.18, 0.3) * 1.25],
    ]),
  ],
});

const chieuTruc = defineItem({
  id: 'chieu-truc-bamboo-mat',
  name: 'Bamboo tile sleeping mat (chiếu trúc)',
  category: 'bedroom',
  type: 'decor',
  group: RUGS,
  tags: ['chiếu trúc', 'chiếu tre', 'bamboo mat', 'summer mat', 'cooling mat', 'sleeping mat', 'mahjong mat'],
  description:
    'Cool summer sleeping mat of small polished bamboo tiles linked in a grid, edged all round with a camel cotton binding and rounded corners.',
  defaultSize: { w: 1.6, d: 2.0, h: 0.006 },
  minSize: { w: 0.8, d: 1.8, h: 0.004 },
  maxSize: { w: 2.0, d: 2.2, h: 0.008 },
  slots: [
    matSlot('bamboo', 'Bamboo tiles', 'bamboo-tiles'),
    matSlot('binding', 'Edge binding', 'fabric-corduroy-camel'),
  ],
  build: ({ w, d, h }) => {
    const r = 0.06;
    const e = 0.02;
    const parts: Part[] = [
      slab('binding', w, d, r, 0, h),
      slab('bamboo', w - 2 * e, d - 2 * e, r - e, 0.0005, h + 0.0003, false),
    ];
    // Stitching just inside the binding.
    for (const s of [-1, 1]) {
      parts.push(
        rodX('binding', -w / 2 + r, w / 2 - r, h + 0.0004, s * (d / 2 - e * 0.45), 0.0012, {
          ...O,
          segments: 6,
        }),
      );
      parts.push(
        rodZ('binding', s * (w / 2 - e * 0.45), h + 0.0004, -d / 2 + r, d / 2 - r, 0.0012, {
          ...O,
          segments: 6,
        }),
      );
    }
    return parts;
  },
  planDetail: ({ w, d }) => [poly(roundRectPoints(0, 0, w - 0.04, d - 0.04, 0.04, 4))],
});

const rattanMat = defineItem({
  id: 'chieu-may-rattan-mat',
  name: 'Woven rattan floor mat (chiếu mây)',
  category: 'living',
  type: 'decor',
  group: RUGS,
  tags: ['chiếu mây', 'rattan mat', 'cane mat', 'woven', 'thảm mây', 'natural', 'tropical'],
  description:
    'Open-weave rattan cane mat framed by a round rattan rim that is wrapped with split cane every few centimetres.',
  defaultSize: { w: 1.2, d: 1.8, h: 0.012 },
  minSize: { w: 0.6, d: 0.9, h: 0.008 },
  maxSize: { w: 1.8, d: 2.2, h: 0.016 },
  slots: [matSlot('rattan', 'Rattan weave', 'cane-natural'), matSlot('rim', 'Rattan rim', 'rattan-natural')],
  build: ({ w, d, h }) => {
    const rr = Math.min(0.006, h * 0.5);
    const parts: Part[] = [
      span('rattan', [-w / 2 + 2 * rr, w / 2 - 2 * rr], [0, h * 0.5], [-d / 2 + 2 * rr, d / 2 - 2 * rr]),
    ];
    for (const s of [-1, 1]) {
      parts.push(rodX('rim', -w / 2 + rr, w / 2 - rr, rr, s * (d / 2 - rr), rr, { segments: 12 }));
      parts.push(rodZ('rim', s * (w / 2 - rr), rr, -d / 2 + rr, d / 2 - rr, rr, { segments: 12 }));
    }
    const step = Math.max(0.07, (2 * (w + d)) / 110);
    const t = 0.0011;
    for (const s of [-1, 1]) {
      for (const x of cells(Math.max(1, Math.floor((w - 0.04) / step)), -w / 2 + 0.02, w / 2 - 0.02))
        parts.push(
          torus('rim', [x, rr, s * (d / 2 - rr)], rr + t, t, { rotation: [0, Math.PI / 2, 0], plan: false }),
        );
      for (const z of cells(Math.max(1, Math.floor((d - 0.04) / step)), -d / 2 + 0.02, d / 2 - 0.02))
        parts.push(torus('rim', [s * (w / 2 - rr), rr, z], rr + t, t, { plan: false }));
    }
    return parts;
  },
  planDetail: ({ w, d }) => [rectPoly(-w / 2 + 0.012, -d / 2 + 0.012, w / 2 - 0.012, d / 2 - 0.012)],
});

/** Arched field of a prayer rug: rectangle with a pointed arch towards −z (inset grows the outline by g). */
function mihrab(w: number, d: number, fr: number, b: number, g = 0): V2[] {
  const fx = w / 2 - b + g;
  const zf = d / 2 - fr - b + g;
  const zt = -d / 2 + fr + b - g;
  const rise = Math.min(fx * 1.1, (zf - zt) * 0.4);
  const zs = zt + rise;
  const pts: V2[] = [
    [fx, zf],
    [fx, zs],
  ];
  for (const a of spaced(8, 0, 1.35)) pts.push([fx * Math.cos(a), zs - rise * 0.92 * Math.sin(a)]);
  pts.push([0, zt]);
  for (const a of spaced(8, 1.35, 0)) pts.push([-fx * Math.cos(a), zs - rise * 0.92 * Math.sin(a)]);
  pts.push([-fx, zs], [-fx, zf]);
  return pts;
}

const prayerRug = defineItem({
  id: 'prayer-rug-mihrab',
  name: 'Prayer rug with mihrab arch',
  category: 'living',
  type: 'decor',
  group: RUGS,
  tags: ['prayer rug', 'prayer mat', 'sajadah', 'thảm cầu nguyện', 'mihrab', 'janamaz'],
  description:
    'Small burgundy pile prayer rug with a gold border, a pointed mihrab arch with a hanging lamp motif, and cream fringes at both ends.',
  defaultSize: { w: 0.7, d: 1.15, h: 0.008 },
  minSize: { w: 0.6, d: 1.0, h: 0.005 },
  maxSize: { w: 0.8, d: 1.25, h: 0.012 },
  slots: [
    matSlot('field', 'Pile field', 'prayer-burgundy'),
    matSlot('border', 'Border & arch', 'prayer-gold'),
    matSlot('fringe', 'Fringe', 'fabric-cream'),
  ],
  build: ({ w, d, h }) => {
    const fr = 0.035;
    const b = clamp(w * 0.1, 0.05, 0.08);
    const zb0 = -d / 2 + fr;
    const zb1 = d / 2 - fr;
    const parts: Part[] = [
      span('border', [-w / 2, w / 2], [0, h], [zb0, zb1]),
      prism('border', mihrab(w, d, fr, b, 0.012), 0.0005, h, O),
      prism('field', mihrab(w, d, fr, b), 0.001, h, O),
      ...band('field', -w / 2 + 0.012, w / 2 - 0.012, zb0 + 0.012, zb1 - 0.012, 0.006, h - 0.001, h + 0.001),
    ];
    // Hanging lamp from the apex of the arch.
    const zt = -d / 2 + fr + b;
    const rise = Math.min((w / 2 - b) * 1.1, (zb1 - b - zt) * 0.4);
    const L = layer(h, 2);
    parts.push(sp('border', [-0.002, 0.002], L, [zt + 0.015, zt + rise * 0.55]));
    parts.push(rhombus('border', 0, zt + rise * 0.55 + 0.03, 0.025, 0.035, L));
    // Three small diamonds in the foot panel.
    for (const x of [-1, 0, 1]) parts.push(rhombus('border', x * 0.07, zb1 - b - 0.06, 0.02, 0.028, L));
    // Fringes at both ends.
    const n = clamp(Math.round(w / 0.018), 10, 50);
    for (const s of [-1, 1]) {
      for (const x of cells(n, -w / 2 + 0.01, w / 2 - 0.01))
        parts.push(sp('fringe', [x - 0.003, x + 0.003], [0, h * 0.5], s > 0 ? [zb1, d / 2] : [-d / 2, zb0]));
    }
    return parts;
  },
  planDetail: ({ w, d }) => [poly(mihrab(w, d, 0.035, clamp(w * 0.1, 0.05, 0.08)))],
});

// ── Office, pets and outdoor ─────────────────────────────────────────────────

const chairMat = defineItem({
  id: 'clear-pvc-chair-mat',
  name: 'Clear PVC chair mat with lip',
  category: 'office',
  type: 'decor',
  group: RUGS,
  tags: ['chair mat', 'office mat', 'floor protector', 'thảm lót ghế', 'thảm PVC trong', 'lip', 'desk'],
  description:
    'Transparent PVC floor protector for a rolling desk chair, with a tongue-shaped lip at the back that slides under the desk.',
  defaultSize: { w: 1.2, d: 1.35, h: 0.004 },
  minSize: { w: 0.9, d: 1.1, h: 0.002 },
  maxSize: { w: 1.5, d: 1.8, h: 0.005 },
  slots: [matSlot('pvc', 'Clear PVC', 'pvc-clear')],
  build: ({ w, d, h }) => {
    const lipD = clamp(d * 0.18, 0.2, 0.3);
    const lipW = clamp(w * 0.42, 0.4, 0.6);
    const zm = -d / 2 + lipD;
    return [
      prism('pvc', roundRectPoints(0, (zm + d / 2) / 2, w, d / 2 - zm, 0.025, 5), 0, h),
      prism(
        'pvc',
        [
          [-lipW / 2, zm],
          [-lipW / 2 + 0.03, -d / 2 + 0.01],
          [-lipW / 2 + 0.04, -d / 2],
          [lipW / 2 - 0.04, -d / 2],
          [lipW / 2 - 0.03, -d / 2 + 0.01],
          [lipW / 2, zm],
        ],
        0,
        h,
      ),
    ];
  },
});

const feedingMat = defineItem({
  id: 'silicone-pet-feeding-mat',
  name: 'Silicone pet feeding mat',
  category: 'pets',
  type: 'pets',
  group: 'Feeding & care',
  tags: ['feeding mat', 'pet bowl mat', 'thảm lót bát ăn', 'chó mèo', 'silicone', 'spill mat', 'paw print'],
  description:
    'Grey silicone mat with a rolled spill rim, two raised rings to seat the bowls and white paw prints between them.',
  defaultSize: { w: 0.48, d: 0.3, h: 0.012 },
  minSize: { w: 0.4, d: 0.25, h: 0.008 },
  maxSize: { w: 0.6, d: 0.4, h: 0.015 },
  slots: [matSlot('silicone', 'Silicone', 'silicone-grey'), matSlot('print', 'Paw prints', 'plastic-white')],
  build: ({ w, d, h }) => {
    const R = Math.min(0.04, w * 0.12, d * 0.15);
    const rr = Math.min(h * 0.5, 0.006);
    const parts: Part[] = [slab('silicone', w, d, R, 0, 0.003)];
    for (const s of [-1, 1]) {
      parts.push(rodX('silicone', -w / 2 + R, w / 2 - R, rr, s * (d / 2 - rr), rr, { ...O, segments: 12 }));
      parts.push(rodZ('silicone', s * (w / 2 - rr), rr, -d / 2 + R, d / 2 - R, rr, { ...O, segments: 12 }));
    }
    for (const [cx, cz, th] of [
      [1, 1, 0],
      [-1, 1, Math.PI / 2],
      [-1, -1, Math.PI],
      [1, -1, (3 * Math.PI) / 2],
    ] as const)
      parts.push(flatArc('silicone', cx * (w / 2 - R), rr, cz * (d / 2 - R), R - rr, rr, th, Math.PI / 2));
    const br = Math.min(0.085, d * 0.3);
    for (const s of [-1, 1]) parts.push(flatRing('silicone', s * w * 0.24, 0.003, 0, br, 0.0025, 1, 1, 0.6));
    // Paw prints: a pad and four toes.
    const paw = (x: number, z: number, k: number) => {
      parts.push(vcyl('print', x, z, 0.002, 0.0035, 0.011 * k, { ...O, segments: 16, scale: [1, 1, 0.85] }));
      for (const [dx, dz] of [
        [-0.013, -0.012],
        [-0.005, -0.019],
        [0.005, -0.019],
        [0.013, -0.012],
      ] as const)
        parts.push(vcyl('print', x + dx * k, z + dz * k, 0.002, 0.0035, 0.0045 * k, { ...O, segments: 12 }));
    };
    paw(0, 0.02, 1);
    paw(-0.025, -d / 2 + 0.07, 0.75);
    paw(0.03, d / 2 - 0.05, 0.75);
    return parts;
  },
  planDetail: ({ w, d }) =>
    [-1, 1].map((s) => ({ kind: 'circle', c: [s * w * 0.24, 0], r: Math.min(0.085, d * 0.3) }) as PlanStroke),
});

const coolingMat = defineItem({
  id: 'pet-cooling-gel-mat',
  name: 'Pet cooling gel mat',
  category: 'pets',
  type: 'pets',
  group: 'Dog beds & crates',
  tags: ['cooling mat', 'pet mat', 'thảm làm mát', 'thảm gel cho chó mèo', 'summer', 'self-cooling'],
  description:
    'Pressure-activated cooling pad for a dog or cat: a quilted grid of glossy blue gel cells inside a welded navy edge.',
  defaultSize: { w: 0.65, d: 0.5, h: 0.015 },
  minSize: { w: 0.4, d: 0.3, h: 0.01 },
  maxSize: { w: 1.2, d: 0.9, h: 0.02 },
  slots: [matSlot('gel', 'Cooling gel cover', 'cooling-gel'), matSlot('edge', 'Welded edge', 'fabric-navy')],
  build: ({ w, d, h }) => {
    const e = 0.018;
    const parts: Part[] = [slab('edge', w, d, Math.min(0.03, w * 0.08), 0, h * 0.35)];
    const nx = clamp(Math.round((w - 2 * e) / 0.1), 2, 12);
    const nz = clamp(Math.round((d - 2 * e) / 0.1), 2, 9);
    for (const [z0, z1] of cellSpans(nz, -d / 2 + e, d / 2 - e)) {
      for (const [x0, x1] of cellSpans(nx, -w / 2 + e, w / 2 - e))
        parts.push(
          cushion('gel', [x0 + 0.003, x1 - 0.003], [0.001, h], [z0 + 0.003, z1 - 0.003], {
            softness: 0.45,
            plan: false,
          }),
        );
    }
    return parts;
  },
  planDetail: ({ w, d }) => [rectPoly(-w / 2 + 0.018, -d / 2 + 0.018, w / 2 - 0.018, d / 2 - 0.018)],
});

const outdoorPP = defineItem({
  id: 'reversible-plastic-straw-mat',
  name: 'Reversible plastic straw outdoor mat',
  category: 'outdoor',
  type: 'decor',
  group: RUGS,
  tags: [
    'outdoor rug',
    'plastic straw mat',
    'thảm nhựa',
    'thảm ngoài trời',
    'reversible',
    'patio',
    'polypropylene',
  ],
  description:
    'Lightweight reversible mat woven from navy and cream polypropylene straw, with a cream border band, three zigzag rows and stitched black edges.',
  defaultSize: { w: 2.7, d: 1.8, h: 0.005 },
  minSize: { w: 1.2, d: 0.9, h: 0.003 },
  maxSize: { w: 3.6, d: 2.7, h: 0.008 },
  slots: [
    matSlot('navy', 'Navy weave', 'pp-navy'),
    matSlot('cream', 'Cream weave', 'pp-cream'),
    matSlot('binding', 'Stitched binding', 'fabric-charcoal'),
  ],
  build: ({ w, d, h }) => {
    const e = 0.02;
    const C = layer(h, 0);
    const parts: Part[] = [
      ...band('binding', -w / 2, w / 2, -d / 2, d / 2, e, 0, h + 0.0005, true),
      sp('navy', [-w / 2 + e, w / 2 - e], [0, h], [-d / 2 + e, d / 2 - e]),
    ];
    const bo = e + Math.min(0.06, d * 0.04);
    const bw = Math.min(0.05, d * 0.03);
    parts.push(...band('cream', -w / 2 + bo, w / 2 - bo, -d / 2 + bo, d / 2 - bo, bw, C[0], C[1]));
    const step = 0.113;
    const x0 = -w / 2 + bo + bw + 0.08;
    const n = Math.floor((w / 2 - bo - bw - 0.08 - x0) / step);
    const xs = x0 + (w / 2 - bo - bw - 0.08 - x0 - n * step) / 2;
    for (const zr of [-d * 0.22, 0, d * 0.22]) {
      for (const k of range(n)) {
        const s = k % 2 ? -1 : 1;
        parts.push(
          strip(
            'cream',
            xs + k * step - 0.004,
            zr + s * (step / 2 + 0.004),
            xs + (k + 1) * step + 0.004,
            zr - s * (step / 2 + 0.004),
            0.03,
            C,
          ),
        );
      }
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const bo = 0.02 + Math.min(0.06, d * 0.04);
    return [rectPoly(-w / 2 + bo, -d / 2 + bo, w / 2 - bo, d / 2 - bo)];
  },
});

const picnic = defineItem({
  id: 'gingham-picnic-blanket',
  name: 'Waterproof gingham picnic blanket',
  category: 'outdoor',
  type: 'decor',
  group: RUGS,
  tags: ['picnic blanket', 'picnic mat', 'thảm dã ngoại', 'thảm picnic', 'gingham', 'waterproof', 'camping'],
  description:
    'Soft red-and-white gingham fleece picnic blanket on a black waterproof backing, one corner folded back to show its tan carry strap.',
  defaultSize: { w: 2.0, d: 1.5, h: 0.008 },
  minSize: { w: 1.3, d: 1.1, h: 0.005 },
  maxSize: { w: 2.0, d: 2.0, h: 0.012 },
  slots: [
    matSlot('fleece', 'Gingham fleece', 'gingham-red'),
    matSlot('backing', 'Waterproof backing', 'plastic-black'),
    matSlot('strap', 'Carry strap', 'leather-tan'),
  ],
  build: ({ w, d, h }) => {
    const top = h - 0.003;
    const parts: Part[] = [
      span('backing', [-w / 2, w / 2], [0, 0.0015], [-d / 2, d / 2]),
      cushion('fleece', [-w / 2 + 0.003, w / 2 - 0.003], [0.0015, top], [-d / 2 + 0.003, d / 2 - 0.003], {
        softness: 0.3,
        plan: false,
      }),
    ];
    // Fold creases.
    for (const x of [-w / 6, w / 6])
      parts.push(
        sp(
          'fleece',
          [x - 0.008, x + 0.008],
          [top - 0.0015, top + 0.0012],
          [-d / 2 + 0.02, d / 2 - 0.02],
          0.002,
        ),
      );
    parts.push(
      sp('fleece', [-w / 2 + 0.02, w / 2 - 0.02], [top - 0.0015, top + 0.0009], [-0.008, 0.008], 0.002),
    );
    // Front-right corner folded back over the blanket, showing the backing and the strap.
    const c = Math.min(0.28, w * 0.14, d * 0.18);
    const X = w / 2 - 0.004;
    const Z = d / 2 - 0.004;
    parts.push(
      prism(
        'backing',
        [
          [X - c, Z],
          [X, Z - c],
          [X - c, Z - c],
        ],
        top + 0.0003,
        0.0022,
        O,
      ),
    );
    parts.push(
      strip('strap', X - c * 0.85, Z - c * 0.55, X - c * 0.45, Z - c * 0.95, 0.025, [
        top + 0.0022,
        top + 0.0034,
      ]),
    );
    parts.push(flatRing('strap', X - c * 0.82, top + 0.003, Z - c * 0.82, 0.03, 0.0035, 1, 1, 0.5));
    return parts;
  },
  planDetail: ({ w, d }) => {
    const c = Math.min(0.28, w * 0.14, d * 0.18);
    return [
      line([w / 2 - 0.004 - c, d / 2 - 0.004], [w / 2 - 0.004, d / 2 - 0.004 - c]),
      line([-w / 6, -d / 2], [-w / 6, d / 2]),
      line([w / 6, -d / 2], [w / 6, d / 2]),
    ];
  },
});

// ── Patterns ─────────────────────────────────────────────────────────────────

const patterns: PackPattern[] = [
  {
    id: 'coir-bristle',
    name: 'Coir bristles',
    normalStrength: 1.1,
    // Short stiff coconut fibres in every direction over a darker gap colour, wrapped so the tile repeats.
    draw(ctx, size, rand) {
      const g = (v: number) => `rgb(${byte(v)},${byte(v)},${byte(v)})`;
      ctx.fillStyle = g(0.45);
      ctx.fillRect(0, 0, size, size);
      ctx.lineCap = 'round';
      for (let i = 0; i < 2600; i++) {
        const x = rand() * size;
        const y = rand() * size;
        const a = rand() * Math.PI;
        const len = size * (0.01 + rand() * 0.035);
        const dx = Math.cos(a) * len;
        const dy = Math.sin(a) * len;
        ctx.strokeStyle = g(0.55 + rand() * 0.45);
        ctx.lineWidth = Math.max(1, size * (0.003 + rand() * 0.004));
        for (const ox of [-size, 0, size]) {
          for (const oy of [-size, 0, size]) {
            const px = x + ox;
            const py = y + oy;
            if (px + len < 0 || px - len > size || py + len < 0 || py - len > size) continue;
            ctx.beginPath();
            ctx.moveTo(px - dx / 2, py - dy / 2);
            ctx.lineTo(px + dx / 2, py + dy / 2);
            ctx.stroke();
          }
        }
      }
    },
  },
  {
    id: 'sedge-weave',
    name: 'Sedge weave (cói)',
    normalStrength: 0.9,
    // Rounded sedge strands across the tile, pinched by the jute warp; the warp shifts every other row.
    draw(ctx, size, rand) {
      const img = ctx.createImageData(size, size);
      const rows = 48;
      const warps = 8;
      const tone = range(rows).map(() => (rand() - 0.5) * 0.16);
      const dark = range(rows).map(() => (rand() < 0.12 ? -0.1 : 0));
      const ph = range(rows).map(() => rand());
      for (let y = 0; y < size; y++) {
        const v = ((y + 0.5) / size) * rows;
        const r = Math.min(rows - 1, Math.floor(v));
        const c = v - r;
        const prof = Math.sqrt(Math.max(0, 1 - (2 * c - 1) ** 2));
        for (let x = 0; x < size; x++) {
          const u = (x + 0.5) / size;
          const wu = u * warps + (r % 2) * 0.5;
          const pinch = Math.exp(-(((wu - Math.round(wu)) / 0.06) ** 2));
          const L =
            0.72 + 0.22 * prof + tone[r] + dark[r] + 0.03 * Math.sin(TAU * (u * 3 + ph[r])) - 0.12 * pinch;
          const i = (y * size + x) * 4;
          img.data[i] = img.data[i + 1] = img.data[i + 2] = byte(L);
          img.data[i + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
    },
  },
  {
    id: 'bamboo-tile',
    name: 'Bamboo mat tiles',
    normalStrength: 1,
    // A grid of small rounded bamboo tiles with dark gaps between, each with its own tone and a node line.
    draw(ctx, size, rand) {
      const img = ctx.createImageData(size, size);
      const cols = 6;
      const rows = 8;
      const tone = range(cols * rows).map(() => (rand() - 0.5) * 0.14);
      const node = range(cols * rows).map(() => 0.25 + rand() * 0.5);
      const streak = range(64).map(() => (rand() - 0.5) * 0.06);
      for (let y = 0; y < size; y++) {
        const fv = (y / size) * rows;
        const j = Math.floor(fv);
        const fy = fv - j;
        for (let x = 0; x < size; x++) {
          const fu = (x / size) * cols;
          const i = Math.floor(fu);
          const fx = fu - i;
          const k = j * cols + i;
          let L: number;
          if (fx < 0.05 || fx > 0.95 || fy < 0.06 || fy > 0.94) L = 0.22;
          else {
            const cx = (fx - 0.05) / 0.9;
            L = 0.8 + tone[k] - 0.16 * (2 * cx - 1) ** 2 + streak[(i * 8 + Math.floor(fx * 8)) % 64];
            if (Math.abs(fy - node[k]) < 0.02) L -= 0.12;
          }
          const p = (y * size + x) * 4;
          img.data[p] = img.data[p + 1] = img.data[p + 2] = byte(L);
          img.data[p + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
    },
  },
  {
    id: 'gingham',
    name: 'Red gingham',
    normalStrength: 0.3,
    colored: true,
    // Red and white gingham: white ground, pink where one band crosses, red where two cross.
    draw(ctx, size, rand) {
      const img = ctx.createImageData(size, size);
      const n = 8;
      const fleck = range(97).map(() => (rand() - 0.5) * 0.04);
      for (let y = 0; y < size; y++) {
        const by = Math.floor((y / size) * n) % 2 === 0;
        for (let x = 0; x < size; x++) {
          const bx = Math.floor((x / size) * n) % 2 === 0;
          const f = fleck[(x * 7 + y * 13) % 97] + ((x + y) % 2 ? 0.015 : -0.015);
          const [r, g, b] = bx && by ? [0.72, 0.16, 0.15] : bx || by ? [0.9, 0.55, 0.52] : [0.97, 0.95, 0.92];
          const p = (y * size + x) * 4;
          img.data[p] = byte(r + f);
          img.data[p + 1] = byte(g + f);
          img.data[p + 2] = byte(b + f);
          img.data[p + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
    },
  },
];

export default definePack({
  name: 'Mats',
  version: '1.0.0',
  author: 'Neest team',
  description:
    'Mats for every room: doormats and entrance grids, bath, shower and toilet mats, kitchen and laundry mats, play and exercise mats, tatami, chiếu cói, chiếu trúc, chiếu mây, pet mats and outdoor mats.',
  license: 'CC0 (made for Neest)',
  items: [
    coirPrinted,
    tuftedDoormat,
    halfMoonCoir,
    ringMat,
    gridMat,
    bootTray,
    ribbedBath,
    memoryFoamBath,
    bambooLattice,
    diatomite,
    pebbleBath,
    toiletMat,
    antiFatigue,
    kitchenRunner,
    sinkTray,
    washerPad,
    braidedJute,
    fauxFur,
    evaPuzzle,
    foldingPlay,
    xpeTown,
    nbrMat,
    gymTiles,
    rolledYoga,
    tatamiSingle,
    tatamiPair,
    chieuCoi,
    chieuTruc,
    rattanMat,
    prayerRug,
    chairMat,
    feedingMat,
    coolingMat,
    outdoorPP,
    picnic,
  ],
  patterns,
  materials: [
    {
      id: 'coir',
      name: 'Coconut coir',
      category: 'rug',
      color: '#a8753f',
      roughness: 1,
      pattern: { id: 'coir-bristle', scale: 0.12 },
    },
    {
      id: 'coir-black',
      name: 'Black-printed coir',
      category: 'rug',
      color: '#2f2924',
      roughness: 1,
      pattern: { id: 'coir-bristle', scale: 0.12, contrast: 0.6 },
    },
    {
      id: 'rubber-grey',
      name: 'Grey rubber',
      category: 'solid',
      color: '#585b5e',
      roughness: 0.85,
      pattern: { id: 'leather', scale: 0.08, contrast: 0.25 },
    },
    {
      id: 'epdm-fleck',
      name: 'Black EPDM rubber with flecks',
      category: 'solid',
      color: '#2b2b2b',
      roughness: 0.9,
      pattern: { id: 'granite', scale: 0.2, contrast: 0.9 },
    },
    {
      id: 'pu-foam-black',
      name: 'Anti-fatigue PU foam',
      category: 'solid',
      color: '#28292c',
      roughness: 0.7,
      pattern: { id: 'leather', scale: 0.12, contrast: 0.5 },
    },
    {
      id: 'diatomite',
      name: 'Diatomite',
      category: 'stone',
      color: '#ebe6dc',
      roughness: 0.95,
      pattern: { id: 'travertine', scale: 0.4, contrast: 0.3 },
    },
    {
      id: 'diatomite-grey',
      name: 'Grey diatomite',
      category: 'stone',
      color: '#8f918e',
      roughness: 0.95,
      pattern: { id: 'travertine', scale: 0.4, contrast: 0.3 },
    },
    {
      id: 'pebble-grey',
      name: 'Pebble grey PVC',
      category: 'solid',
      color: '#a8a299',
      roughness: 0.45,
      pattern: { id: 'granite', scale: 0.08, contrast: 0.4 },
    },
    {
      id: 'pebble-dark',
      name: 'Dark pebble PVC',
      category: 'solid',
      color: '#5d5a55',
      roughness: 0.45,
      pattern: { id: 'granite', scale: 0.08, contrast: 0.4 },
    },
    {
      id: 'sedge',
      name: 'Sedge weave (cói)',
      category: 'rug',
      color: '#e3cd97',
      roughness: 0.75,
      pattern: { id: 'sedge-weave', scale: 0.18 },
    },
    {
      id: 'sedge-red',
      name: 'Red-dyed sedge',
      category: 'rug',
      color: '#b2312a',
      roughness: 0.75,
      pattern: { id: 'sedge-weave', scale: 0.18 },
    },
    {
      id: 'sedge-green',
      name: 'Green-dyed sedge',
      category: 'rug',
      color: '#3d7648',
      roughness: 0.75,
      pattern: { id: 'sedge-weave', scale: 0.18 },
    },
    {
      id: 'binding-indigo',
      name: 'Indigo cotton binding',
      category: 'fabric',
      color: '#2b3f6b',
      roughness: 0.85,
      pattern: { id: 'weave', scale: 0.03, contrast: 0.5 },
    },
    {
      id: 'bamboo-tiles',
      name: 'Bamboo tiles (chiếu trúc)',
      category: 'wood',
      color: '#d4b97c',
      roughness: 0.45,
      pattern: { id: 'bamboo-tile', scale: 0.16 },
    },
    {
      id: 'heri-brocade',
      name: 'Tatami border brocade',
      category: 'fabric',
      color: '#252a39',
      roughness: 0.65,
      pattern: { id: 'wallpaper-damask', scale: 0.05, contrast: 0.5 },
    },
    {
      id: 'pvc-clear',
      name: 'Clear PVC',
      category: 'solid',
      color: '#e6eff1',
      roughness: 0.12,
      opacity: 0.45,
    },
    { id: 'silicone-grey', name: 'Grey silicone', category: 'solid', color: '#8e9695', roughness: 0.6 },
    {
      id: 'cooling-gel',
      name: 'Blue cooling-gel cover',
      category: 'fabric',
      color: '#4b9ed3',
      roughness: 0.35,
      pattern: { id: 'weave', scale: 0.03, contrast: 0.25 },
    },
    { id: 'xpe-white', name: 'White XPE foam', category: 'solid', color: '#f3f1ec', roughness: 0.55 },
    {
      id: 'nbr-plum',
      name: 'Plum NBR foam',
      category: 'solid',
      color: '#6b4a7b',
      roughness: 0.85,
      pattern: { id: 'leather', scale: 0.06, contrast: 0.3 },
    },
    { id: 'tpe-teal', name: 'Teal TPE', category: 'solid', color: '#2f8884', roughness: 0.7 },
    { id: 'tpe-grey', name: 'Grey TPE', category: 'solid', color: '#8e9496', roughness: 0.7 },
    {
      id: 'pp-navy',
      name: 'Navy woven polypropylene',
      category: 'rug',
      color: '#28395f',
      roughness: 0.6,
      pattern: { id: 'weave', scale: 0.03, contrast: 0.6 },
    },
    {
      id: 'pp-cream',
      name: 'Cream woven polypropylene',
      category: 'rug',
      color: '#e7dcc3',
      roughness: 0.6,
      pattern: { id: 'weave', scale: 0.03, contrast: 0.6 },
    },
    {
      id: 'gingham-red',
      name: 'Red gingham fleece',
      category: 'fabric',
      color: '#ffffff',
      roughness: 0.95,
      pattern: { id: 'gingham', scale: 0.16 },
    },
    {
      id: 'prayer-burgundy',
      name: 'Burgundy rug pile',
      category: 'rug',
      color: '#7a1e2a',
      roughness: 1,
      pattern: { id: 'weave', scale: 0.02, contrast: 0.3 },
    },
    {
      id: 'prayer-gold',
      name: 'Gold rug pile',
      category: 'rug',
      color: '#c79a40',
      roughness: 1,
      pattern: { id: 'weave', scale: 0.02, contrast: 0.3 },
    },
    {
      id: 'faux-fur-grey',
      name: 'Grey faux fur',
      category: 'fabric',
      color: '#b8b5b0',
      roughness: 1,
      pattern: { id: 'boucle', scale: 0.08, contrast: 0.8 },
    },
    {
      id: 'eva-grey',
      name: 'Grey EVA foam',
      category: 'solid',
      color: '#8b8e91',
      roughness: 0.8,
      pattern: { id: 'leather', scale: 0.05, contrast: 0.25 },
    },
    {
      id: 'eva-cream',
      name: 'Cream EVA foam',
      category: 'solid',
      color: '#ece5d4',
      roughness: 0.8,
      pattern: { id: 'leather', scale: 0.05, contrast: 0.25 },
    },
  ],
});

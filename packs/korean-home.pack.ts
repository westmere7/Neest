/**
 * Korean home — everyday pieces of a modern Korean apartment: a kimchi refrigerator, a Korean
 * BBQ table and a hanji paper table lamp.
 *
 * Four procedural patterns are drawn by this pack: hanji paper fibre, celadon glaze with
 * crackle and sanggam cranes, jogakbo patchwork and najeon (mother-of-pearl on black lacquer).
 */
import {
  box,
  cells,
  clamp,
  cyl,
  defineItem,
  definePack,
  lathe,
  legs4,
  lerp,
  line,
  matSlot,
  range,
  ring,
  rng,
  rod,
  rodPath,
  rodX,
  sphere,
  span,
  spaced,
  vcyl,
  circle,
  type Part,
  type V2,
} from '@/packs/kit';

const TAU = Math.PI * 2;

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------


/** Small side dish (banchan) with a mound of food. */
function banchanDish(dishSlot: string, foodSlot: string, x: number, z: number, y0: number, r: number, dh: number, room: number): Part[] {
  const fr = r * 0.66;
  const sy = clamp((room - dh * 0.7) / fr, 0.2, 0.7);
  return [
    lathe(dishSlot, [x, y0, z], [
      [0, 0],
      [r * 0.62, 0],
      [r * 0.9, dh * 0.6],
      [r, dh],
      [r * 0.94, dh],
    ], { segments: 20, plan: false }),
    sphere(foodSlot, [x, y0 + dh * 0.7, z], fr, { scale: [1, sy, 1], plan: false }),
  ];
}

// ---------------------------------------------------------------------------
// Pattern helpers: a float RGB tile that wraps at its edges, so anything painted on it
// (fibres, motifs, crackle) tiles seamlessly.
// ---------------------------------------------------------------------------

type Rgb = [number, number, number];
type Paint = Rgb | ((x: number, y: number) => Rgb);

const hex = (s: string): Rgb => [
  parseInt(s.slice(1, 3), 16) / 255,
  parseInt(s.slice(3, 5), 16) / 255,
  parseInt(s.slice(5, 7), 16) / 255,
];

class Tile {
  readonly size: number;
  readonly px: Float32Array;

  constructor(size: number, base: (x: number, y: number) => Rgb) {
    this.size = size;
    this.px = new Float32Array(size * size * 3);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const c = base(x, y);
        const i = (y * size + x) * 3;
        this.px[i] = c[0];
        this.px[i + 1] = c[1];
        this.px[i + 2] = c[2];
      }
    }
  }

  private wrap(v: number): number {
    const s = this.size;
    return ((v % s) + s) % s;
  }

  /** Blends `c` into pixel (x, y) with opacity `a` (coordinates wrap). */
  blend(x: number, y: number, c: Rgb, a: number): void {
    if (a <= 0) return;
    const k = Math.min(1, a);
    const i = (this.wrap(y) * this.size + this.wrap(x)) * 3;
    this.px[i] += (c[0] - this.px[i]) * k;
    this.px[i + 1] += (c[1] - this.px[i + 1]) * k;
    this.px[i + 2] += (c[2] - this.px[i + 2]) * k;
  }

  /** Paints the pixels around (cx, cy) whose signed distance `sd` (px, negative inside) is ≤ 0.5. */
  private stamp(cx: number, cy: number, reach: number, sd: (dx: number, dy: number) => number, paint: Paint, a: number): void {
    const x0 = Math.floor(cx - reach);
    const x1 = Math.ceil(cx + reach);
    const y0 = Math.floor(cy - reach);
    const y1 = Math.ceil(cy + reach);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const cov = clamp(0.5 - sd(x + 0.5 - cx, y + 0.5 - cy), 0, 1);
        if (cov <= 0) continue;
        const c = typeof paint === 'function' ? paint(this.wrap(x), this.wrap(y)) : paint;
        this.blend(x, y, c, cov * a);
      }
    }
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, rot: number, paint: Paint, a = 1): void {
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    const m = Math.min(rx, ry);
    this.stamp(cx, cy, Math.max(rx, ry) + 1, (dx, dy) => {
      const u = dx * c + dy * s;
      const v = -dx * s + dy * c;
      const q = (u * u) / (rx * rx) + (v * v) / (ry * ry);
      return (Math.sqrt(q) - 1) * m;
    }, paint, a);
  }

  ring(cx: number, cy: number, r: number, width: number, paint: Paint, a = 1): void {
    this.stamp(cx, cy, r + width + 1, (dx, dy) => Math.abs(Math.sqrt(dx * dx + dy * dy) - r) - width / 2, paint, a);
  }

  line(x0: number, y0: number, x1: number, y1: number, width: number, paint: Paint, a = 1): void {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len2 = dx * dx + dy * dy || 1e-6;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    this.stamp(cx, cy, Math.sqrt(len2) / 2 + width / 2 + 1, (px, py) => {
      const ax = px + cx - x0;
      const ay = py + cy - y0;
      const t = clamp((ax * dx + ay * dy) / len2, 0, 1);
      const ex = ax - t * dx;
      const ey = ay - t * dy;
      return Math.sqrt(ex * ex + ey * ey) - width / 2;
    }, paint, a);
  }

  path(pts: V2[], width: number, paint: Paint, a = 1): void {
    for (let i = 1; i < pts.length; i++) this.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], width, paint, a);
  }

  flush(ctx: CanvasRenderingContext2D): void {
    const s = this.size;
    const img = ctx.createImageData(s, s);
    for (let i = 0, j = 0; i < s * s * 3; i += 3, j += 4) {
      img.data[j] = Math.round(clamp(this.px[i], 0, 1) * 255);
      img.data[j + 1] = Math.round(clamp(this.px[i + 1], 0, 1) * 255);
      img.data[j + 2] = Math.round(clamp(this.px[i + 2], 0, 1) * 255);
      img.data[j + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }
}

/** Lattice cell index and smoothstep weight for each pixel column/row of a tile. */
function lattice(period: number, size: number): { i0: Int32Array; i1: Int32Array; s: Float32Array } {
  const i0 = new Int32Array(size);
  const i1 = new Int32Array(size);
  const s = new Float32Array(size);
  for (let x = 0; x < size; x++) {
    const f = (x * period) / size;
    const i = Math.floor(f);
    const t = f - i;
    i0[x] = i % period;
    i1[x] = (i + 1) % period;
    s[x] = t * t * (3 - 2 * t);
  }
  return { i0, i1, s };
}

/** Value noise in [0, 1) repeating `period` times across a size×size tile (row-major image). */
function noiseImage(rand: () => number, period: number, size: number): Float32Array {
  const g = Float32Array.from({ length: period * period }, () => rand());
  const L = lattice(period, size);
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const r0 = L.i0[y] * period;
    const r1 = L.i1[y] * period;
    const sy = L.s[y];
    for (let x = 0; x < size; x++) {
      const a = g[r0 + L.i0[x]];
      const b = g[r0 + L.i1[x]];
      const c = g[r1 + L.i0[x]];
      const d = g[r1 + L.i1[x]];
      const sx = L.s[x];
      const top = a + (b - a) * sx;
      out[y * size + x] = top + (c + (d - c) * sx - top) * sy;
    }
  }
  return out;
}

/** Three octaves of periodic value noise in [0, 1). */
function fbmImage(rand: () => number, base: number, size: number): Float32Array {
  const n0 = noiseImage(rand, base, size);
  const n1 = noiseImage(rand, base * 2, size);
  const n2 = noiseImage(rand, base * 4, size);
  for (let i = 0; i < n0.length; i++) n0[i] = n0[i] * 0.55 + n1[i] * 0.3 + n2[i] * 0.15;
  return n0;
}

/** Periodic cellular image: distance between the nearest and second-nearest seed (cell units). */
function crackImage(rand: () => number, g: number, size: number): Float32Array {
  const pts = Float32Array.from({ length: g * g * 2 }, () => 0.1 + rand() * 0.8);
  const w = (a: number) => ((a % g) + g) % g;
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const fy = (y * g) / size;
    const j = Math.floor(fy);
    for (let x = 0; x < size; x++) {
      const fx = (x * g) / size;
      const i = Math.floor(fx);
      let d1 = 99;
      let d2 = 99;
      for (let dj = -1; dj <= 1; dj++) {
        const row = w(j + dj) * g;
        for (let di = -1; di <= 1; di++) {
          const k = (row + w(i + di)) * 2;
          const ex = fx - (i + di + pts[k]);
          const ey = fy - (j + dj + pts[k + 1]);
          const dd = ex * ex + ey * ey;
          if (dd < d1) {
            d2 = d1;
            d1 = dd;
          } else if (dd < d2) d2 = dd;
        }
      }
      out[y * size + x] = Math.sqrt(d2) - Math.sqrt(d1);
    }
  }
  return out;
}

/** Sanggam (inlaid) flying crane, heading +x (or -x when `flip`), scale `s` px. */
function inlayCrane(t: Tile, cx: number, cy: number, s: number, flip: boolean, white: Rgb, black: Rgb): void {
  const f = flip ? -1 : 1;
  const X = (x: number) => cx + x * s * f;
  const Y = (y: number) => cy + y * s;
  t.ellipse(X(-0.1), Y(-0.42), s * 0.62, s * 0.15, -1.05 * f, white);
  t.ellipse(X(-0.42), Y(-0.86), s * 0.2, s * 0.07, -1.05 * f, black);
  t.ellipse(X(0), Y(0), s * 0.55, s * 0.17, -0.12 * f, white);
  t.ellipse(X(0.05), Y(0.36), s * 0.5, s * 0.12, 0.85 * f, white, 0.9);
  t.ellipse(X(-0.55), Y(0.04), s * 0.18, s * 0.08, 0.1 * f, black);
  t.line(X(0.42), Y(-0.06), X(0.98), Y(-0.28), s * 0.075, white);
  t.ellipse(X(1.02), Y(-0.29), s * 0.09, s * 0.075, 0, white);
  t.line(X(1.08), Y(-0.28), X(1.34), Y(-0.21), s * 0.04, black);
  t.line(X(-0.5), Y(0.06), X(-1.1), Y(0.2), s * 0.035, black);
  t.line(X(-0.5), Y(0.1), X(-1.08), Y(0.27), s * 0.035, black);
}

/** Sanggam cloud: white puffs with a black curl. */
function inlayCloud(t: Tile, cx: number, cy: number, s: number, white: Rgb, black: Rgb): void {
  t.ellipse(cx - s * 0.35, cy, s * 0.26, s * 0.2, 0, white);
  t.ellipse(cx, cy - s * 0.12, s * 0.3, s * 0.24, 0, white);
  t.ellipse(cx + s * 0.35, cy, s * 0.24, s * 0.19, 0, white);
  t.ring(cx, cy - s * 0.12, s * 0.12, s * 0.05, black);
  t.path(range(6).map((i) => [cx + s * (0.55 + i * 0.16), cy + s * 0.12 + Math.sin(i * 1.2) * s * 0.06] as V2), s * 0.06, white);
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------




const kimchiFridge = defineItem({
  id: 'kimchi-fridge',
  name: 'Kimchi refrigerator',
  category: 'kitchen',
  type: 'appliances',
  group: 'Refrigeration',
  tags: ['kimchi', 'refrigerator', 'fridge', 'kimchi fridge', 'korean', 'chest', 'dimchae', 'fermentation'],
  defaultSize: { w: 0.95, d: 0.68, h: 0.86 },
  minSize: { w: 0.7, d: 0.55, h: 0.7 },
  maxSize: { w: 1.3, d: 0.8, h: 1.0 },
  slots: [
    matSlot('body', 'Body & lids', 'pearl-white'),
    matSlot('accent', 'Front panel', 'wine-gloss'),
    matSlot('trim', 'Handles & print', 'metal-brushed-steel'),
    matSlot('display', 'Control display', 'screen-black'),
  ],
  build: ({ w, d, h }) => {
    const footH = 0.03;
    const lidT = 0.05;
    const zF = d / 2 - 0.02;
    const bodyTop = h - lidT;
    const dTop = footH + (bodyTop - footH) * 0.4;
    const o = { plan: false };
    const parts: Part[] = [
      span('body', [-w / 2, w / 2], [footH, bodyTop], [-d / 2, zF], { bevel: 0.015 }),
      ...legs4('trim', w, d - 0.04, 0.04, 0, footH + 0.004, 0.05),
      // Drawer below, gloss panel above.
      span('body', [-w / 2 + 0.015, w / 2 - 0.015], [footH + 0.015, dTop], [zF, zF + 0.01], { bevel: 0.006, plan: false }),
      span('trim', [-w * 0.32, w * 0.32], [dTop - 0.032, dTop - 0.018], [zF + 0.01, zF + 0.02], { bevel: 0.003, plan: false }),
      span('accent', [-w / 2 + 0.02, w / 2 - 0.02], [dTop + 0.012, bodyTop - 0.015], [zF, zF + 0.006], { bevel: 0.003, plan: false }),
      // Control display with indicator icons.
      span('display', [-Math.min(0.1, w * 0.12), Math.min(0.1, w * 0.12)], [bodyTop - 0.11, bodyTop - 0.05], [zF + 0.006, zF + 0.01], o),
      ...spaced(4, -Math.min(0.07, w * 0.08), Math.min(0.07, w * 0.08)).map((x) =>
        span('trim', [x - 0.008, x + 0.008], [bodyTop - 0.085, bodyTop - 0.075], [zF + 0.01, zF + 0.012], o),
      ),
    ];
    // Two lift-up lids with front grip lips and rear hinges.
    for (const s of [-1, 1]) {
      const lx: V2 = s < 0 ? [-w / 2, -0.004] : [0.004, w / 2];
      const cx = (lx[0] + lx[1]) / 2;
      const lw = lx[1] - lx[0];
      parts.push(span('body', lx, [bodyTop, h], [-d / 2, zF + 0.012], { bevel: 0.012, plan: false }));
      parts.push(span('body', [lx[0] + 0.03, lx[1] - 0.03], [h - 0.004, h], [-d / 2 + 0.04, zF - 0.03], { bevel: 0.002, plan: false }));
      parts.push(span('trim', [cx - lw * 0.3, cx + lw * 0.3], [bodyTop + 0.008, bodyTop + 0.02], [zF + 0.012, d / 2], { bevel: 0.003, plan: false }));
      parts.push(rodX('trim', cx - lw * 0.3, cx + lw * 0.3, bodyTop, -d / 2 + 0.01, 0.008, o));
    }
    // Printed flower spray on the gloss panel.
    const py = (dTop + bodyTop) / 2;
    const fx = w * 0.26;
    const fz = zF + 0.007;
    const petal = Math.min(0.028, (bodyTop - dTop) * 0.08);
    for (const [cx, cy, k] of [[fx, py + petal, 1], [fx + petal * 3.2, py - petal * 1.6, 0.7]] as [number, number, number][]) {
      for (const p of range(5)) {
        const ang = (p / 5) * TAU + 0.3;
        parts.push(
          sphere('trim', [cx + Math.cos(ang) * petal * k * 0.9, cy + Math.sin(ang) * petal * k * 0.9, fz], 0.5, {
            scale: [petal * k * 1.6, petal * k * 0.9, 0.003],
            rotation: [0, 0, ang],
            plan: false,
          }),
        );
      }
      parts.push(sphere('accent', [cx, cy, fz + 0.001], petal * k * 0.35, { scale: [1, 1, 0.15], plan: false }));
    }
    parts.push(...rodPath('trim', [[fx - petal * 0.5, py - petal * 4, fz], [fx, py - petal * 0.5, fz], [fx + petal * 3.2, py - petal * 1.6, fz]], 0.0025));
    for (const [lx, ly, r] of [[fx - petal * 1.2, py - petal * 2.6, 0.6], [fx + petal * 1.1, py - petal * 2.2, -0.5]] as [number, number, number][]) {
      parts.push(sphere('trim', [lx, ly, fz], 0.5, { scale: [petal * 1.8, petal * 0.7, 0.003], rotation: [0, 0, r], plan: false }));
    }
    return parts;
  },
  planDetail: ({ d }) => [line([0, -d / 2], [0, d / 2])],
});






const kbbqTable = defineItem({
  id: 'kbbq-table',
  name: 'Korean BBQ table',
  category: 'dining',
  type: 'surfaces',
  group: 'Dining tables',
  tags: ['korean bbq', 'kbbq', 'gogi-gui', 'grill table', 'samgyeopsal', 'charcoal', 'hood', 'banchan', 'korean'],
  defaultSize: { w: 1.2, d: 0.75, h: 2.4 },
  minSize: { w: 0.8, d: 0.6, h: 0.6 },
  maxSize: { w: 1.8, d: 1.0, h: 2.7 },
  slots: [
    matSlot('top', 'Table top', 'ottchil'),
    matSlot('steel', 'Grill, hood & bowls', 'metal-brushed-steel'),
    matSlot('food', 'Meat & banchan', 'kimchi-red'),
    matSlot('light', 'Charcoal embers', 'charcoal-glow'),
  ],
  light: { color: '#ff7a33', intensity: 0.8, distance: 2.2, y: 0.7 },
  build: ({ w, d, h }) => {
    const hood = h >= 1.4;
    const top = hood ? Math.min(0.72, h - 0.7) : h - 0.045;
    const tT = 0.04;
    const under = top - tT;
    const rg = Math.min(0.17, w * 0.2, d * 0.3);
    const o = { plan: false };
    const parts: Part[] = [
      span('top', [-w / 2, w / 2], [under, top], [-d / 2, d / 2], { bevel: 0.006 }),
      // Steel edging.
      span('steel', [-w / 2, w / 2], [under - 0.004, top + 0.002], [d / 2 - 0.008, d / 2], o),
      span('steel', [-w / 2, w / 2], [under - 0.004, top + 0.002], [-d / 2, -d / 2 + 0.008], o),
      span('steel', [-w / 2, -w / 2 + 0.008], [under - 0.004, top + 0.002], [-d / 2 + 0.008, d / 2 - 0.008], o),
      span('steel', [w / 2 - 0.008, w / 2], [under - 0.004, top + 0.002], [-d / 2 + 0.008, d / 2 - 0.008], o),
      ...legs4('steel', w, d, 0.05, 0, under, 0.045),
      span('steel', [-w / 2 + 0.07, w / 2 - 0.07], [0.08, 0.1], [-0.02, 0.02], o),
      // Burner housing below the grill.
      vcyl('steel', 0, 0, Math.max(0.1, under - 0.2), under, rg * 0.9, { segments: 28, plan: false }),
      // Grill well, ember bed and grate.
      ring('steel', [0, top + 0.004, 0], rg, 0.01, { plan: false }),
      cyl('steel', [0, top - 0.025, 0], rg * 0.97, 0.05, { segments: 32, plan: false }),
    ];
    const rand = rng(88);
    for (const k of range(9)) {
      const a = rand() * TAU;
      const rr = rg * 0.7 * Math.sqrt((k + rand()) / 9);
      parts.push(sphere('light', [Math.cos(a) * rr, top - 0.008, Math.sin(a) * rr], 0.024, { scale: [1, 0.6, 1], plan: false }));
    }
    for (const z of spaced(9, -rg * 0.85, rg * 0.85)) {
      const half = Math.sqrt(rg * rg - z * z) * 0.97;
      parts.push(rodX('steel', -half, half, top + 0.008, z, 0.0035, o));
    }
    // Strips of samgyeopsal sizzling on the grate.
    for (const [z, ang] of [[-rg * 0.4, 0.15], [0, -0.08], [rg * 0.4, 0.1]] as V2[]) {
      parts.push(box('food', [0, top + 0.016, z], [rg * 1.1, 0.008, 0.035], { rotation: [0, ang, 0], bevel: 0.003, plan: false }));
    }
    // Tongs beside the grill.
    const tx0 = rg + 0.04;
    const tx1 = Math.min(rg + 0.24, w / 2 - 0.03);
    parts.push(rod('steel', [tx0, top + 0.008, 0.02], [tx1, top + 0.008, 0.06], 0.004, o));
    parts.push(rod('steel', [tx0, top + 0.008, 0.035], [tx1, top + 0.008, 0.068], 0.004, o));
    // Banchan in small steel bowls along both long edges, clear of the grill.
    const nb = clamp(Math.floor((w - 0.08) / 0.12), 2, 12);
    const br = Math.min(0.045, d * 0.07);
    for (const z of [d / 2 - 0.075, -d / 2 + 0.075]) {
      for (const x of cells(nb, -w / 2 + 0.04, w / 2 - 0.04)) {
        if (Math.abs(x) < rg + br + 0.01 && Math.abs(z) < rg + br + 0.01) continue;
        parts.push(...banchanDish('steel', 'food', x, z, top, br, 0.028, 0.04));
      }
    }
    if (hood) {
      // Telescoping smoke hood hanging over the grill.
      const yH = top + 0.42;
      const rH = Math.min(0.3, rg * 1.6, w / 2 - 0.02, d / 2 - 0.02);
      const yp = yH + 0.18;
      parts.push(
        cyl('steel', [0, yH + 0.09, 0], rH, 0.18, { rTop: 0.075, segments: 32, plan: false }),
        ring('steel', [0, yH, 0], rH, 0.008, { plan: false }),
        vcyl('steel', 0, 0, yp, h, 0.065, { segments: 24, plan: false }),
        vcyl('steel', 0, 0, yp + (h - yp) * 0.45, h, 0.074, { segments: 24, plan: false }),
        ring('steel', [0, yp + (h - yp) * 0.45, 0], 0.074, 0.006, { plan: false }),
        rodX('steel', rH * 0.55, rH * 0.85, yH + 0.03, 0, 0.008, o),
      );
    }
    return parts;
  },
  planDetail: ({ w, d }) => [circle([0, 0], Math.min(0.17, w * 0.2, d * 0.3))],
});



const hanjiLamp = defineItem({
  id: 'hanji-lamp',
  name: 'Hanji paper table lamp',
  category: 'lighting',
  type: 'lighting',
  group: 'Table lamps',
  tags: ['hanji', 'paper lamp', 'korean', 'table lamp', 'lantern', 'plum blossom', 'maehwa', 'deung'],
  defaultSize: { w: 0.26, d: 0.26, h: 0.44 },
  minSize: { w: 0.15, d: 0.15, h: 0.25 },
  maxSize: { w: 0.5, d: 0.5, h: 0.9 },
  slots: [
    matSlot('wood', 'Wooden frame', 'ottchil'),
    matSlot('light', 'Hanji shade', 'hanji-glow'),
    matSlot('accent', 'Ink painting', 'ink-black'),
  ],
  light: { color: '#ffd59a', intensity: 0.7, distance: 2.6, y: 0.22 },
  build: ({ w, d, h }) => {
    const bh = clamp(h * 0.07, 0.02, 0.04);
    const p = clamp(Math.min(w, d) * 0.06, 0.01, 0.02);
    const capH = clamp(h * 0.04, 0.012, 0.025);
    const yTop = h - capH;
    const o = { plan: false };
    const parts: Part[] = [
      span('wood', [-w / 2, w / 2], [0, bh], [-d / 2, d / 2], { bevel: 0.004 }),
      span('light', [-w / 2 + 0.01, w / 2 - 0.01], [bh, yTop], [-d / 2 + 0.01, d / 2 - 0.01], o),
      span('wood', [-w / 2 + 0.004, w / 2 - 0.004], [yTop, h], [-d / 2 + 0.004, d / 2 - 0.004], { bevel: 0.003, plan: false }),
    ];
    // Corner posts and bottom rails.
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const cx = sx * (w / 2 - 0.004 - p / 2);
        const cz = sz * (d / 2 - 0.004 - p / 2);
        parts.push(span('wood', [cx - p / 2, cx + p / 2], [bh, yTop], [cz - p / 2, cz + p / 2], o));
      }
    }
    const e = 0.004;
    parts.push(
      span('wood', [-w / 2 + e, w / 2 - e], [bh, bh + p], [d / 2 - e - 0.008, d / 2 - e], o),
      span('wood', [-w / 2 + e, w / 2 - e], [bh, bh + p], [-d / 2 + e, -d / 2 + e + 0.008], o),
      span('wood', [-w / 2 + e, -w / 2 + e + 0.008], [bh, bh + p], [-d / 2 + e, d / 2 - e], o),
      span('wood', [w / 2 - e - 0.008, w / 2 - e], [bh, bh + p], [-d / 2 + e, d / 2 - e], o),
    );
    // Lattice band around the bottom of the shade.
    const bandTop = bh + (yTop - bh) * 0.22;
    const nx = clamp(Math.round((w - 0.04) / 0.035), 2, 8);
    const nz = clamp(Math.round((d - 0.04) / 0.035), 2, 8);
    for (const sz of [-1, 1]) {
      const zc = sz * (d / 2 - 0.008);
      for (const x of cells(nx, -w / 2 + p, w / 2 - p)) parts.push(span('wood', [x - 0.003, x + 0.003], [bh + p, bandTop], [zc - 0.003, zc + 0.003], o));
      parts.push(span('wood', [-w / 2 + e, w / 2 - e], [bandTop, bandTop + 0.006], [zc - 0.004, zc + 0.004], o));
    }
    for (const sx of [-1, 1]) {
      const xc = sx * (w / 2 - 0.008);
      for (const z of cells(nz, -d / 2 + p, d / 2 - p)) parts.push(span('wood', [xc - 0.003, xc + 0.003], [bh + p, bandTop], [z - 0.003, z + 0.003], o));
      parts.push(span('wood', [xc - 0.004, xc + 0.004], [bandTop, bandTop + 0.006], [-d / 2 + e, d / 2 - e], o));
    }
    // Ink plum branch (maehwa) painted on the front and back panels.
    const ax = w / 2 - 0.03;
    const y0 = bandTop + 0.02;
    const y1 = yTop - 0.03;
    const Y = (f: number) => lerp(y0, y1, f);
    for (const sz of [-1, 1]) {
      const z = sz * (d / 2 - 0.0095);
      const X = (f: number) => sz * lerp(-ax, ax, f);
      parts.push(
        ...rodPath('accent', [[X(0), Y(0.15), z], [X(0.35), Y(0.4), z], [X(0.5), Y(0.75), z], [X(0.8), Y(0.95), z]], 0.0028),
        rod('accent', [X(0.35), Y(0.4), z], [X(0.85), Y(0.5), z], 0.0018, o),
      );
      for (const [fx, fy] of [[0.5, 0.76], [0.62, 0.86], [0.85, 0.5], [0.66, 0.46], [0.3, 0.36], [0.78, 0.95]] as V2[]) {
        parts.push(sphere('accent', [X(fx), Y(fy), z], 0.5, { scale: [Math.min(0.022, w * 0.07), Math.min(0.022, w * 0.07), 0.002], plan: false }));
      }
    }
    return parts;
  },
});


export default definePack({
  name: 'Korean home',
  version: '1.0.0',
  author: 'Neest team',
  description:
    'A kimchi refrigerator, a Korean BBQ table and a hanji paper table lamp.',
  license: 'CC0 (made for Neest)',
  items: [
    kimchiFridge,
    kbbqTable,
    hanjiLamp,
  ],
  patterns: [
    {
      id: 'hanji-fibre',
      name: 'Hanji paper fibre',
      normalStrength: 0.45,
      // Cloudy mulberry pulp, long translucent fibres, bark specks and faint laid lines.
      draw(ctx, size, rand) {
        const k = size / 512;
        const cloud = fbmImage(rand, 4, size);
        const fine = noiseImage(rand, 64, size);
        const step = size / 24;
        const t = new Tile(size, (x, y) => {
          const i = y * size + x;
          const v = 0.88 + cloud[i] * 0.08 + fine[i] * 0.03 - (y % step < 1 ? 0.012 : 0);
          return [v, v, v];
        });
        for (let f = 0; f < 260; f++) {
          let x = rand() * size;
          let y = rand() * size;
          let ang = rand() * TAU;
          const len = (6 + rand() * 16) * k;
          const wid = (0.5 + rand() * 0.9) * k;
          const c: Rgb = rand() < 0.6 ? [1, 1, 1] : [0.8, 0.8, 0.8];
          const a = 0.25 + rand() * 0.35;
          for (let s = 0; s < 5; s++) {
            ang += (rand() - 0.5) * 0.6;
            const nx = x + Math.cos(ang) * len;
            const ny = y + Math.sin(ang) * len;
            t.line(x, y, nx, ny, wid, c, a);
            x = nx;
            y = ny;
          }
        }
        for (let s = 0; s < 50; s++) {
          const v = 0.5 + rand() * 0.15;
          t.ellipse(rand() * size, rand() * size, (0.6 + rand() * 1.2) * k, (0.4 + rand() * 0.8) * k, rand() * TAU, [v, v, v], 0.55);
        }
        t.flush(ctx);
      },
    },
    {
      id: 'celadon-crackle',
      name: 'Celadon with sanggam cranes',
      normalStrength: 0.25,
      colored: true,
      // Jade-green glaze pooling unevenly, inlaid cranes and clouds, and a fine crackle network.
      draw(ctx, size, rand) {
        const k = size / 512;
        const pool = fbmImage(rand, 3, size);
        const mott = noiseImage(rand, 24, size);
        const t = new Tile(size, (x, y) => {
          const p = pool[y * size + x];
          const m = mott[y * size + x] * 0.03;
          return [0.48 + p * 0.14 + m, 0.63 + p * 0.12 + m, 0.55 + p * 0.1 + m];
        });
        const white: Rgb = [0.9, 0.9, 0.84];
        const black: Rgb = [0.17, 0.18, 0.17];
        const cell = size / 3;
        for (let gy = 0; gy < 3; gy++) {
          for (let gx = 0; gx < 3; gx++) {
            const cx = (gx + 0.35 + rand() * 0.3) * cell;
            const cy = (gy + 0.35 + rand() * 0.3) * cell;
            if ((gx + gy) % 2 === 0) {
              const s = 30 * k;
              if (gy !== 1) {
                t.ring(cx, cy, s * 1.55, s * 0.06, white);
                t.ring(cx, cy, s * 1.42, s * 0.03, black);
              }
              inlayCrane(t, cx, cy, s, rand() < 0.5, white, black);
            } else inlayCloud(t, cx, cy, 36 * k, white, black);
          }
        }
        const big = crackImage(rand, 9, size);
        const small = crackImage(rand, 19, size);
        const dark: Rgb = [0.28, 0.38, 0.34];
        const mid: Rgb = [0.38, 0.5, 0.45];
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            const e1 = big[y * size + x];
            if (e1 < 0.04) t.blend(x, y, dark, (1 - e1 / 0.04) * 0.45);
            const e2 = small[y * size + x];
            if (e2 < 0.04) t.blend(x, y, mid, (1 - e2 / 0.04) * 0.22);
          }
        }
        t.flush(ctx);
      },
    },
    {
      id: 'jogakbo',
      name: 'Jogakbo patchwork',
      normalStrength: 0.5,
      colored: true,
      // Ramie and silk scraps of many colours sewn together with ridged seams and stitches.
      draw(ctx, size, rand) {
        const k = size / 512;
        const palette = ['#3a4a8a', '#5fa58f', '#e7a0b0', '#edc95a', '#c64a4a', '#8a5a9a', '#efe4cc', '#9cc4dc', '#b8d8b0', '#c99a4a', '#f3efe6', '#d9774a'].map(hex);
        const rects: [number, number, number, number][] = [];
        const min = size * 0.1;
        const split = (x0: number, y0: number, x1: number, y1: number, depth: number): void => {
          const w = x1 - x0;
          const h = y1 - y0;
          const canX = w >= min * 2;
          const canY = h >= min * 2;
          if (depth >= 6 || (!canX && !canY) || (depth > 2 && rand() < 0.15)) {
            rects.push([x0, y0, x1, y1]);
            return;
          }
          const alongX = canX && (!canY || (w > h ? rand() < 0.8 : rand() < 0.2));
          if (alongX) {
            const m = Math.round(x0 + w * (0.3 + rand() * 0.4));
            split(x0, y0, m, y1, depth + 1);
            split(m, y0, x1, y1, depth + 1);
          } else {
            const m = Math.round(y0 + h * (0.3 + rand() * 0.4));
            split(x0, y0, x1, m, depth + 1);
            split(x0, m, x1, y1, depth + 1);
          }
        };
        split(0, 0, size, size, 0);
        const t = new Tile(size, () => [1, 1, 1]);
        const sw = Math.max(1, Math.round(1.5 * k));
        const sk = Math.max(1, Math.round(1.2 * k));
        const dash = Math.max(4, Math.round(8 * k));
        let last = -1;
        for (const [x0, y0, x1, y1] of rects) {
          let ci = Math.floor(rand() * palette.length);
          if (ci === last) ci = (ci + 1) % palette.length;
          last = ci;
          const c = palette[ci];
          const shade = 0.94 + rand() * 0.1;
          for (let y = y0; y < y1; y++) {
            for (let x = x0; x < x1; x++) {
              const dl = x - x0;
              const dr = x1 - 1 - x;
              const dt = y - y0;
              const db = y1 - 1 - y;
              const edge = Math.min(dl, dr, dt, db);
              let f = shade + (((x >> 1) + (y >> 1)) % 2 === 0 ? 0.018 : -0.018);
              if (edge < sw) f *= 0.68;
              else if (edge >= sw + 2 && edge < sw + 2 + sk) {
                const along = edge === dt || edge === db ? x : y;
                if (along % dash < dash * 0.6) f *= 1.16;
              }
              const i = (y * size + x) * 3;
              t.px[i] = c[0] * f;
              t.px[i + 1] = c[1] * f;
              t.px[i + 2] = c[2] * f;
            }
          }
        }
        t.flush(ctx);
      },
    },
    {
      id: 'najeon',
      name: 'Najeon mother-of-pearl',
      normalStrength: 0.3,
      colored: true,
      // Black lacquer inlaid with iridescent shell: scrolling vines, curls, leaves and blossoms.
      draw(ctx, size, rand) {
        const k = size / 512;
        const sheen = fbmImage(rand, 3, size);
        const t = new Tile(size, (x, y) => {
          const v = 0.05 + sheen[y * size + x] * 0.035;
          return [v * 1.15, v * 0.95, v * 0.85];
        });
        const nacre = (seed: number) => (x: number, y: number): Rgb => {
          const a = TAU * ((x / size) * 2 + y / size) + seed;
          const b = 0.82 + 0.08 * Math.sin(TAU * ((y / size) * 3 + (x / size) * 2) + seed * 2);
          return [b + 0.09 * Math.sin(a), b + 0.09 * Math.sin(a + 2.1), b + 0.1 * Math.sin(a + 4.2)];
        };
        const lacquer: Rgb = [0.05, 0.04, 0.035];
        const flower = (fx: number, fy: number, pr: number, seed: number): void => {
          const rot = rand() * TAU;
          for (let p = 0; p < 5; p++) {
            const ang = rot + (p / 5) * TAU;
            const tx = fx + Math.cos(ang) * pr * 0.95;
            const ty = fy + Math.sin(ang) * pr * 0.95;
            t.ellipse(tx, ty, pr * 0.62, pr * 0.42, ang, nacre(seed + p * 0.7));
            t.line(fx, fy, fx + Math.cos(ang) * pr * 1.4, fy + Math.sin(ang) * pr * 1.4, 0.7 * k, lacquer, 0.55);
          }
          t.ellipse(fx, fy, pr * 0.3, pr * 0.3, 0, [0.95, 0.86, 0.62]);
        };
        const m = 2;
        for (let r = 0; r < 2; r++) {
          const y0 = size * (0.25 + r * 0.5);
          const amp = size * 0.08;
          const ph = rand() * TAU;
          const seed = rand() * TAU;
          const yAt = (x: number) => y0 + amp * Math.sin((TAU * m * x) / size + ph);
          const steps = 96;
          t.path(range(steps + 1).map((i) => [(i * size) / steps, yAt((i * size) / steps)] as V2), 2.4 * k, nacre(seed));
          for (let c = 0; c < m * 2; c++) {
            const xc = (((0.25 + c * 0.5 - ph / TAU) / m) % 1 + 1) % 1 * size;
            const dir = c % 2 === 0 ? 1 : -1;
            const sy = yAt(xc);
            // Curling tendril.
            const R = size * 0.05;
            const ccx = xc + R * 0.6;
            const ccy = sy + dir * R * 1.1;
            const th0 = Math.atan2(sy - ccy, xc - ccx);
            const rad0 = Math.hypot(sy - ccy, xc - ccx);
            t.path(range(16).map((j) => {
              const th = th0 + dir * j * 0.42;
              const rr = rad0 * (1 - j / 19);
              return [ccx + Math.cos(th) * rr, ccy + Math.sin(th) * rr] as V2;
            }), 1.8 * k, nacre(seed + 1));
            // Leaves at the junction.
            t.ellipse(xc - R * 0.5, sy + dir * R * 0.4, R * 0.45, R * 0.16, dir * 0.7, nacre(seed + 2));
            t.ellipse(xc - R * 0.9, sy - dir * R * 0.3, R * 0.4, R * 0.14, -dir * 0.5, nacre(seed + 3));
            // Blossom in the trough.
            const fx = xc + size / (4 * m);
            flower(fx, yAt(fx) - dir * R * 0.2, size * 0.032, seed + c);
          }
        }
        // Scattered small blossoms and shell dots.
        for (let i = 0; i < 10; i++) {
          const x = rand() * size;
          const y = rand() * size;
          if (i % 2 === 0) flower(x, y, size * 0.016, rand() * TAU);
          else t.ellipse(x, y, 2.4 * k, 2.4 * k, 0, nacre(rand() * TAU));
        }
        t.flush(ctx);
      },
    },
  ],
  materials: [
    { id: 'hanji', name: 'Hanji paper', color: '#f2e8d2', roughness: 0.92, pattern: { id: 'hanji-fibre', scale: 0.35 } },
    { id: 'hanji-aged', name: 'Aged hanji', color: '#e6d6b4', roughness: 0.92, pattern: { id: 'hanji-fibre', scale: 0.5 } },
    { id: 'hanji-glow', name: 'Glowing hanji', color: '#fff0d4', roughness: 0.9, emissive: '#ffcf8a', emissiveIntensity: 1.8, pattern: { id: 'hanji-fibre', scale: 0.25 } },
    { id: 'celadon', name: 'Goryeo celadon', color: '#ffffff', roughness: 0.14, pattern: { id: 'celadon-crackle', scale: 0.22 } },
    { id: 'sanggam-white', name: 'Sanggam white inlay', color: '#e8e5d6', roughness: 0.2 },
    { id: 'jogakbo', name: 'Jogakbo patchwork', category: 'fabric', color: '#ffffff', roughness: 0.85, pattern: { id: 'jogakbo', scale: 0.6 } },
    { id: 'najeon', name: 'Najeon lacquer', category: 'wood', color: '#ffffff', roughness: 0.2, pattern: { id: 'najeon', scale: 0.45 } },
    { id: 'black-lacquer', name: 'Black ottchil lacquer', category: 'wood', color: '#17110f', roughness: 0.2, pattern: { id: 'wood-grain', scale: 0.8, contrast: 0.15 } },
    { id: 'nacre', name: 'Mother-of-pearl', color: '#eef0ea', roughness: 0.15, metalness: 0.35 },
    { id: 'zelkova', name: 'Zelkova (neutinamu)', category: 'wood', color: '#9a6438', roughness: 0.45, pattern: { id: 'wood-grain', scale: 0.7 } },
    { id: 'paulownia', name: 'Paulownia (odong)', category: 'wood', color: '#c9a77a', roughness: 0.55, pattern: { id: 'wood-grain', scale: 0.6, contrast: 0.9 } },
    { id: 'pine-wood', name: 'Hanok pine', category: 'wood', color: '#c99c66', roughness: 0.6, pattern: { id: 'wood-grain', scale: 0.8, contrast: 0.8 } },
    { id: 'ottchil', name: 'Lacquered wood (ottchil)', category: 'wood', color: '#5e3320', roughness: 0.35, pattern: { id: 'wood-grain', scale: 0.7, contrast: 0.6 } },
    { id: 'yugi-brass', name: 'Yugi brass', category: 'metal', color: '#c9a14e', roughness: 0.28, metalness: 1, pattern: { id: 'brushed', scale: 0.3, contrast: 0.4 } },
    { id: 'black-iron', name: 'Black iron', category: 'metal', color: '#2a2622', roughness: 0.6, metalness: 0.5 },
    { id: 'onggi', name: 'Onggi glaze', color: '#5a3826', roughness: 0.32, pattern: { id: 'granite', scale: 0.3, contrast: 0.4 } },
    { id: 'onggi-lid', name: 'Onggi lid', color: '#4a2e1f', roughness: 0.45, pattern: { id: 'granite', scale: 0.3, contrast: 0.4 } },
    { id: 'cotton-ivory', name: 'Ivory cotton', category: 'fabric', color: '#f1ece0', roughness: 0.95, pattern: { id: 'weave', scale: 0.1, contrast: 0.35 } },
    { id: 'silk-jade', name: 'Jade silk', category: 'fabric', color: '#4f9a86', roughness: 0.55, pattern: { id: 'weave', scale: 0.06, contrast: 0.3 } },
    { id: 'silk-crimson', name: 'Crimson silk', category: 'fabric', color: '#b8243a', roughness: 0.55, pattern: { id: 'weave', scale: 0.06, contrast: 0.3 } },
    { id: 'silk-yellow', name: 'Yellow silk', category: 'fabric', color: '#f0c64a', roughness: 0.55, pattern: { id: 'weave', scale: 0.06, contrast: 0.3 } },
    { id: 'silk-indigo', name: 'Indigo silk', category: 'fabric', color: '#2c3a73', roughness: 0.55, pattern: { id: 'weave', scale: 0.06, contrast: 0.3 } },
    { id: 'peony-pink', name: 'Peony pink', color: '#d9547a', roughness: 0.7 },
    { id: 'minhwa-green', name: 'Minhwa green', color: '#3f7a5a', roughness: 0.75 },
    { id: 'baekja', name: 'White porcelain (baekja)', color: '#f1efe6', roughness: 0.1 },
    { id: 'kimchi-red', name: 'Kimchi red', color: '#c4402c', roughness: 0.5 },
    { id: 'charcoal-glow', name: 'Charcoal embers', color: '#ff7a2e', roughness: 0.8, emissive: '#ff4a12', emissiveIntensity: 2.2 },
    { id: 'pearl-white', name: 'Pearl white gloss', color: '#f3efe8', roughness: 0.15, metalness: 0.1 },
    { id: 'wine-gloss', name: 'Wine gloss', color: '#7a1f2e', roughness: 0.15, metalness: 0.1 },
    { id: 'jade-stone', name: 'Jade', category: 'stone', color: '#5fae8c', roughness: 0.2 },
    { id: 'ink-black', name: 'Ink', color: '#2a2420', roughness: 0.8 },
  ],
});

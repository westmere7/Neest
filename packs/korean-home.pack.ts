/**
 * Korean home — furniture and objects from a Korean (hanok-inspired) household.
 *
 * Floor living on the ondol: yo bedding, a soban meal table, a jwaseok floor chair. Wooden
 * chests with brass and iron fittings (bandaji, nong), a black-lacquer najeon wardrobe, a
 * celadon maebyeong, onggi jars on a stone platform, hanji lattice and lamp, a peony folding
 * screen, a hanbok on its stand, norigae, a kimchi refrigerator and a Korean BBQ table.
 *
 * Four procedural patterns are drawn by this pack: hanji paper fibre, celadon glaze with
 * crackle and sanggam cranes, jogakbo patchwork and najeon (mother-of-pearl on black lacquer).
 */
import {
  box,
  cellSpans,
  cells,
  clamp,
  cushion,
  cyl,
  defineItem,
  definePack,
  discZ,
  frame4,
  lathe,
  legs4,
  lerp,
  line,
  matSlot,
  poly,
  range,
  rectPoly,
  ring,
  rng,
  rod,
  rodPath,
  rodX,
  sphere,
  span,
  spaced,
  torus,
  vcyl,
  circle,
  type Part,
  type V2,
  type V3,
} from '@/packs/kit';

const TAU = Math.PI * 2;

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

/** A flat shape facing the front (+z): `pts` are [x, y] in metres, `t` thick from depth z. */
function facePlate(slot: string, pts: V2[], z: number, t: number): Part {
  const ys = pts.map((p) => p[1]);
  const mid = (Math.min(...ys) + Math.max(...ys)) / 2;
  const xs = pts.map((p) => p[0]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  // Prism outline lies in X/Z and extrudes along Y; rotating +90° about X turns it to face +z.
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

/** Vertical bow-tie (butterfly) hinge plate centred at (x, y), `s` half-height. */
function butterflyPlate(slot: string, x: number, y: number, s: number, z: number, t: number): Part {
  return facePlate(
    slot,
    [
      [x - s * 0.62, y + s],
      [x + s * 0.62, y + s],
      [x + s * 0.18, y],
      [x + s * 0.62, y - s],
      [x - s * 0.62, y - s],
      [x - s * 0.18, y],
    ],
    z,
    t,
  );
}

/** Point (lx, lz) of a panel turned `a` about the vertical axis (three.js Euler Y) around (cx, cz). */
function turnY(a: number, cx: number, cz: number, lx: number, lz: number): V2 {
  return [cx + lx * Math.cos(a) + lz * Math.sin(a), cz - lx * Math.sin(a) + lz * Math.cos(a)];
}

/** Brass (yugi) bowl with a domed lid, standing at (x, y0, z): radius r, total height hh. */
function lidBowl(slot: string, x: number, z: number, y0: number, r: number, hh: number): Part[] {
  const bh = hh * 0.56;
  const lh = hh - bh;
  return [
    lathe(slot, [x, y0, z], [
      [0, 0],
      [r * 0.55, 0],
      [r * 0.6, bh * 0.12],
      [r * 0.9, bh * 0.55],
      [r, bh],
    ], { segments: 24, plan: false }),
    lathe(slot, [x, y0 + bh, z], [
      [r * 1.02, 0],
      [r * 0.96, lh * 0.45],
      [r * 0.62, lh * 0.82],
      [r * 0.24, lh * 0.86],
      [r * 0.2, lh],
      [0, lh],
    ], { segments: 24, plan: false }),
  ];
}

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

const yoBedding = defineItem({
  id: 'yo-floor-bedding',
  name: 'Yo floor bedding with ibul',
  category: 'bedroom',
  type: 'beds',
  group: 'Beds',
  tags: ['yo', 'ibul', 'korean', 'floor bed', 'futon', 'ondol', 'quilt', 'bedding', 'pillow', 'hanok'],
  defaultSize: { w: 1.0, d: 2.1, h: 0.24 },
  minSize: { w: 0.75, d: 1.7, h: 0.14 },
  maxSize: { w: 1.6, d: 2.4, h: 0.36 },
  slots: [
    matSlot('yo', 'Yo mattress & collar', 'cotton-ivory'),
    matSlot('ibul', 'Ibul quilt', 'jogakbo'),
    matSlot('pillow', 'Pillow', 'silk-jade'),
    matSlot('caps', 'Embroidered pillow ends', 'silk-crimson'),
  ],
  build: ({ w, d, h }) => {
    const yoH = h * 0.4;
    const qT = h * 0.24;
    const head = -d / 2;
    const qz0 = head + Math.min(0.5, d * 0.24);
    const flap = Math.min(0.34, d * 0.16);
    const qx: V2 = [-w / 2 + 0.012, w / 2 - 0.012];
    const parts: Part[] = [
      cushion('yo', [-w / 2, w / 2], [0, yoH], [-d / 2, d / 2], { softness: 0.45 }),
      // Ibul over the lower body; its top edge is turned back over itself.
      cushion('ibul', qx, [yoH - 0.008, yoH + qT], [qz0, d / 2 - 0.008], { softness: 0.45 }),
      rodX('ibul', qx[0] + 0.01, qx[1] - 0.01, yoH + qT * 0.88, qz0 + qT * 0.5, qT * 0.88, { segments: 16, plan: false }),
      cushion('ibul', qx, [yoH + qT * 0.8, yoH + qT * 1.75], [qz0, qz0 + flap], { softness: 0.45, plan: false }),
      // White cotton collar (iburit) on the turned-back edge.
      cushion('yo', [qx[0] + 0.004, qx[1] - 0.004], [yoH + qT * 1.6, yoH + qT * 1.85], [qz0 + flap - Math.min(0.1, flap * 0.4), qz0 + flap + 0.004], {
        softness: 0.4,
        plan: false,
      }),
      // Quilting lines across the quilt.
      ...spaced(3, qz0 + flap + 0.18, d / 2 - 0.15).map((z) =>
        rodX('ibul', qx[0] + 0.03, qx[1] - 0.03, yoH + qT * 0.98, z, 0.006, { plan: false }),
      ),
    ];
    // Cylindrical Korean pillows (beggae) with round embroidered ends.
    const nP = w >= 1.3 ? 2 : 1;
    const pr = Math.min(0.075, (h - yoH) * 0.47);
    const pl = Math.min(0.5, (w / nP) * 0.76);
    const pz = head + Math.max(pr + 0.06, (qz0 - head) * 0.45);
    const py = yoH + pr;
    for (const px of nP === 2 ? [-w / 4, w / 4] : [0]) {
      parts.push(rodX('pillow', px - pl / 2, px + pl / 2, py, pz, pr, { segments: 20 }));
      for (const s of [-1, 1]) {
        const xe = px + (s * pl) / 2;
        parts.push(rodX('caps', xe - 0.006, xe + 0.006, py, pz, pr * 1.02, { segments: 24, plan: false }));
        parts.push(rodX('yo', xe + s * 0.004, xe + s * 0.009, py, pz, pr * 0.5, { segments: 20, plan: false }));
        parts.push(torus('caps', [xe + s * 0.008, py, pz], pr * 0.72, pr * 0.06, { rotation: [0, Math.PI / 2, 0], plan: false }));
      }
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const qz0 = -d / 2 + Math.min(0.5, d * 0.24);
    const flap = Math.min(0.34, d * 0.16);
    return [line([-w / 2 + 0.02, qz0], [w / 2 - 0.02, qz0]), line([-w / 2 + 0.02, qz0 + flap], [w / 2 - 0.02, qz0 + flap])];
  },
});

const sobanTable = defineItem({
  id: 'soban-table',
  name: 'Soban low dining table',
  category: 'dining',
  type: 'surfaces',
  group: 'Dining tables',
  tags: ['soban', 'korean', 'low table', 'floor table', 'banchan', 'najuban', 'meal', 'bapsang', 'sujeo'],
  defaultSize: { w: 0.72, d: 0.48, h: 0.32 },
  minSize: { w: 0.5, d: 0.36, h: 0.24 },
  maxSize: { w: 1.2, d: 0.8, h: 0.42 },
  slots: [
    matSlot('wood', 'Lacquered wood', 'ottchil'),
    matSlot('brass', 'Yugi brassware', 'yugi-brass'),
    matSlot('porcelain', 'Porcelain dishes', 'baekja'),
    matSlot('food', 'Banchan', 'kimchi-red'),
  ],
  build: ({ w, d, h }) => {
    const dishH = Math.min(0.085, h * 0.3);
    const top = h - dishH;
    const tT = 0.024;
    const rimH = 0.012;
    const rimW = 0.016;
    const legT = clamp(Math.min(w, d) * 0.07, 0.026, 0.045);
    const inset = 0.03;
    const under = top - tT;
    const o = { plan: false };
    const parts: Part[] = [
      span('wood', [-w / 2, w / 2], [under, top], [-d / 2, d / 2], { bevel: 0.006 }),
      // Raised rim (jeon) around the top.
      span('wood', [-w / 2, w / 2], [top, top + rimH], [d / 2 - rimW, d / 2], { bevel: 0.004, plan: false }),
      span('wood', [-w / 2, w / 2], [top, top + rimH], [-d / 2, -d / 2 + rimW], { bevel: 0.004, plan: false }),
      span('wood', [-w / 2, -w / 2 + rimW], [top, top + rimH], [-d / 2 + rimW, d / 2 - rimW], { bevel: 0.004, plan: false }),
      span('wood', [w / 2 - rimW, w / 2], [top, top + rimH], [-d / 2 + rimW, d / 2 - rimW], { bevel: 0.004, plan: false }),
      // Aprons (ungak) with a little cloud-shaped drop at the centre.
      span('wood', [-w / 2 + inset, w / 2 - inset], [under - 0.045, under], [d / 2 - inset - 0.012, d / 2 - inset], o),
      span('wood', [-w / 2 + inset, w / 2 - inset], [under - 0.045, under], [-d / 2 + inset, -d / 2 + inset + 0.012], o),
      span('wood', [-w / 2 + inset, -w / 2 + inset + 0.012], [under - 0.045, under], [-d / 2 + inset, d / 2 - inset], o),
      span('wood', [w / 2 - inset - 0.012, w / 2 - inset], [under - 0.045, under], [-d / 2 + inset, d / 2 - inset], o),
      sphere('wood', [0, under - 0.045, d / 2 - inset - 0.006], 0.022, { scale: [1.6, 0.8, 0.3], plan: false }),
      sphere('wood', [0, under - 0.045, -d / 2 + inset + 0.006], 0.022, { scale: [1.6, 0.8, 0.3], plan: false }),
      ...legs4('wood', w, d, inset, 0, under, legT),
      // Floor stretchers (jokdae) joining the feet.
      span('wood', [-w / 2 + inset, w / 2 - inset], [0, 0.022], [d / 2 - inset - legT, d / 2 - inset], o),
      span('wood', [-w / 2 + inset, w / 2 - inset], [0, 0.022], [-d / 2 + inset, -d / 2 + inset + legT], o),
      span('wood', [-w / 2 + inset, -w / 2 + inset + legT], [0, 0.022], [-d / 2 + inset, d / 2 - inset], o),
      span('wood', [w / 2 - inset - legT, w / 2 - inset], [0, 0.022], [-d / 2 + inset, d / 2 - inset], o),
    ];
    // Table setting: rice and soup in lidded yugi bowls, sujeo, rows of banchan.
    const ix0 = -w / 2 + rimW + 0.015;
    const ix1 = w / 2 - rimW - 0.015;
    const iz0 = -d / 2 + rimW + 0.012;
    const iz1 = d / 2 - rimW - 0.012;
    const iw = ix1 - ix0;
    const fr = Math.min(0.13, (iz1 - iz0) * 0.45);
    const zF = iz1 - fr / 2;
    const s = dishH / 0.085;
    const rRice = Math.min(0.05, fr * 0.42, iw * 0.12);
    const rSoup = Math.min(0.06, fr * 0.46, iw * 0.13);
    parts.push(...lidBowl('brass', ix0 + iw * 0.18, zF, top, rRice, dishH * 0.92));
    parts.push(...lidBowl('brass', ix0 + iw * 0.45, zF, top, rSoup, dishH * 0.8));
    // Spoon and flat metal chopsticks, tips pointing away from the diner.
    const sx = ix0 + iw * 0.84;
    const L = Math.min(0.21, (iz1 - iz0) * 0.92);
    const zs1 = iz1 - 0.005;
    const zs0 = zs1 - L;
    parts.push(
      span('brass', [sx - 0.0045, sx + 0.0045], [top, top + 0.004], [zs0 + 0.045, zs1], o),
      sphere('brass', [sx, top + 0.004, zs0 + 0.026], 0.021, { scale: [0.9, 0.22, 1.25], plan: false }),
      span('brass', [sx + 0.02, sx + 0.025], [top, top + 0.004], [zs0, zs1], o),
      span('brass', [sx + 0.03, sx + 0.035], [top, top + 0.004], [zs0, zs1], o),
    );
    const bx1 = ix0 + iw * 0.7;
    const bz1 = iz1 - fr;
    const rw = bx1 - ix0;
    const rd = bz1 - iz0;
    if (rd > 0.05) {
      const cols = clamp(Math.floor(rw / 0.105), 1, 7);
      const rows = clamp(Math.floor(rd / 0.095), 1, 3);
      const r = Math.min(0.04 * s + 0.005, (rw / cols) * 0.42, (rd / rows) * 0.42);
      const dh = Math.min(0.024, dishH * 0.32);
      let k = 0;
      for (const z of cells(rows, iz0, bz1)) {
        for (const x of cells(cols, ix0, bx1)) {
          parts.push(...banchanDish(k % 3 === 1 ? 'brass' : 'porcelain', 'food', x, z, top, r, dh, dishH * 0.75));
          k++;
        }
      }
    }
    return parts;
  },
  planDetail: ({ w, d }) => [rectPoly(-w / 2 + 0.016, -d / 2 + 0.016, w / 2 - 0.016, d / 2 - 0.016)],
});

const jwaseokChair = defineItem({
  id: 'jwaseok-chair',
  name: 'Jwaseok floor chair',
  category: 'living',
  type: 'seating',
  group: 'Living chairs',
  tags: ['jwaseok', 'floor chair', 'korean', 'legless chair', 'meditation', 'ondol', 'folding'],
  defaultSize: { w: 0.48, d: 0.55, h: 0.5 },
  minSize: { w: 0.38, d: 0.42, h: 0.36 },
  maxSize: { w: 0.75, d: 0.8, h: 0.8 },
  slots: [
    matSlot('cushion', 'Upholstery', 'silk-jade'),
    matSlot('panel', 'Patchwork panels', 'jogakbo'),
    matSlot('frame', 'Frame & hinges', 'ottchil'),
  ],
  build: ({ w, d, h }) => {
    const baseT = 0.014;
    const seatH = clamp(h * 0.2, 0.06, 0.12);
    const tilt = 0.36;
    const t = clamp(d * 0.13, 0.05, 0.08);
    const y0 = 0.03;
    const L = (h - y0 - t * Math.sin(tilt)) / Math.cos(tilt);
    const zExt = L * Math.sin(tilt) + t * Math.cos(tilt);
    const cz = -d / 2 + zExt / 2;
    const cy = y0 + (L * Math.cos(tilt) + t * Math.sin(tilt)) / 2;
    const a = -tilt;
    const rot: V3 = [a, 0, 0];
    const bw = w - 0.03;
    /** Point on the backrest in its own (ly up the back, lz out of its face) coordinates. */
    const at = (lx: number, ly: number, lz: number): V3 => [lx, cy + ly * Math.cos(a) - lz * Math.sin(a), cz + ly * Math.sin(a) + lz * Math.cos(a)];
    const seatZ0 = Math.min(-d / 2 + zExt - t * 0.6, d / 2 - 0.12);
    const parts: Part[] = [
      span('frame', [-w / 2, w / 2], [0, baseT], [-d / 2, d / 2], { bevel: 0.004 }),
      cushion('cushion', [-w / 2 + 0.008, w / 2 - 0.008], [baseT, seatH], [seatZ0, d / 2 - 0.005], { softness: 0.4 }),
      span('panel', [-w / 2 + 0.05, w / 2 - 0.05], [seatH - 0.004, seatH + 0.003], [seatZ0 + 0.05, d / 2 - 0.05], { bevel: 0.002, plan: false }),
      box('cushion', [0, cy, cz], [bw, L, t], { bevel: t * 0.35, rotation: rot }),
      box('panel', at(0, L * 0.06, t / 2 + 0.001), [bw - 0.09, L * 0.66, 0.006], { rotation: rot, plan: false }),
      // Rigid shell on the back of the backrest.
      box('frame', at(0, 0, -t / 2 - 0.002), [bw * 0.94, L * 0.94, 0.006], { bevel: 0.002, rotation: rot, plan: false }),
    ];
    // Ratchet hinges at the foot of the backrest.
    const hb = at(0, -L / 2 + 0.06, 0);
    for (const s of [-1, 1]) {
      parts.push(box('frame', [s * (w / 2 - 0.007), hb[1], hb[2]], [0.01, 0.08, Math.min(0.05, t * 0.8)], { rotation: rot, plan: false }));
      parts.push(rodX('frame', s * (w / 2 - 0.016), s * (w / 2 - 0.002), hb[1] - 0.02, hb[2], 0.016, { plan: false }));
    }
    // Quilting buttons on the back panel and the seat.
    for (const ly of [L * 0.25, -L * 0.12]) {
      for (const lx of [-bw * 0.22, 0, bw * 0.22]) {
        parts.push(sphere('cushion', at(lx, ly, t / 2 + 0.005), 0.01, { scale: [1, 1, 0.55], rotation: rot, plan: false }));
      }
    }
    for (const x of [-w * 0.18, w * 0.18]) {
      parts.push(sphere('cushion', [x, seatH + 0.004, (seatZ0 + d / 2) / 2], 0.01, { scale: [1, 0.55, 1], plan: false }));
    }
    return parts;
  },
});

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

const changhoScreen = defineItem({
  id: 'changho-screen',
  name: 'Hanok lattice window screen',
  category: 'decor',
  type: 'decor',
  group: 'Screens & dividers',
  tags: ['changho', 'hanok', 'lattice', 'hanji', 'screen', 'korean', 'window', 'divider', 'ttisal'],
  defaultSize: { w: 0.9, d: 0.36, h: 1.6 },
  minSize: { w: 0.5, d: 0.25, h: 0.9 },
  maxSize: { w: 1.6, d: 0.5, h: 2.1 },
  slots: [
    matSlot('wood', 'Lattice & frame', 'pine-wood'),
    matSlot('paper', 'Hanji paper', 'hanji'),
    matSlot('foot', 'Feet', 'ottchil'),
  ],
  build: ({ w, d, h }) => {
    const footH = 0.06;
    const t = 0.032;
    const fw = clamp(w * 0.05, 0.035, 0.055);
    const x0 = -w / 2 + 0.02;
    const x1 = w / 2 - 0.02;
    const y0 = footH;
    const o = { plan: false };
    const parts: Part[] = [];
    for (const s of [-1, 1]) {
      const fx = s * (w / 2 - 0.06);
      parts.push(span('foot', [fx - 0.03, fx + 0.03], [0, footH], [-d / 2, d / 2], { bevel: 0.014 }));
      parts.push(span('foot', [fx - 0.018, fx + 0.018], [footH, footH + 0.07], [t / 2, t / 2 + 0.035], { bevel: 0.006, plan: false }));
      parts.push(span('foot', [fx - 0.018, fx + 0.018], [footH, footH + 0.07], [-t / 2 - 0.035, -t / 2], { bevel: 0.006, plan: false }));
    }
    parts.push(...frame4('wood', [x0, x1], [y0, h], [-t / 2, t / 2], fw, { plan: true }));
    // Solid kick panel and rail at the bottom.
    const yK = y0 + fw + (h - y0) * 0.16;
    const rail = fw * 0.6;
    parts.push(span('wood', [x0 + fw, x1 - fw], [y0 + fw, yK], [-t / 2 + 0.008, t / 2 - 0.008], o));
    parts.push(span('wood', [x0 + fw, x1 - fw], [yK, yK + rail], [-t / 2, t / 2], o));
    // Hanji glued behind the lattice.
    const py0 = yK + rail;
    const py1 = h - fw;
    parts.push(span('paper', [x0 + fw, x1 - fw], [py0, py1], [-0.006, -0.002], o));
    // Ttisal lattice: close vertical muntins with three bands of horizontal ones.
    const iw = x1 - x0 - 2 * fw;
    const nv = Math.max(3, Math.round(iw / 0.042)) - 1;
    const bz: V2 = [-0.002, t / 2 - 0.006];
    for (const i of range(nv)) {
      const x = x0 + fw + (iw * (i + 1)) / (nv + 1);
      parts.push(span('wood', [x - 0.0055, x + 0.0055], [py0, py1], bz, o));
    }
    const sp = Math.min(0.03, (py1 - py0) / 40);
    for (const f of [0.1, 0.5, 0.9]) {
      const yc = py0 + (py1 - py0) * f;
      for (const k of range(4)) {
        const y = yc + (k - 1.5) * sp;
        parts.push(span('wood', [x0 + fw, x1 - fw], [y - 0.0055, y + 0.0055], bz, o));
      }
    }
    return parts;
  },
  planDetail: ({ w }) => [line([-w / 2 + 0.02, 0], [w / 2 - 0.02, 0])],
});

const byeongpung = defineItem({
  id: 'byeongpung',
  name: 'Byeongpung painted screen',
  category: 'decor',
  type: 'decor',
  group: 'Screens & dividers',
  tags: ['byeongpung', 'folding screen', 'peony', 'moranbyeong', 'minhwa', 'korean', 'divider', 'painting'],
  defaultSize: { w: 2.8, d: 0.3, h: 1.7 },
  minSize: { w: 1.2, d: 0.15, h: 0.8 },
  maxSize: { w: 4.0, d: 0.5, h: 2.2 },
  slots: [
    matSlot('border', 'Silk border & frame', 'silk-indigo'),
    matSlot('paper', 'Painted ground', 'hanji-aged'),
    matSlot('peony', 'Peony blossoms', 'peony-pink'),
    matSlot('foliage', 'Leaves & rocks', 'minhwa-green'),
  ],
  build: ({ w, d, h }) => {
    const t = 0.022;
    const n = clamp(2 * Math.round(w / 0.7), 2, 10);
    const cw = w / n;
    const th = Math.atan2(Math.max(0.001, d - t - 0.004), cw);
    const pw = (cw / Math.cos(th)) * 0.985;
    const b = Math.min(0.035, pw * 0.1);
    const yb = Math.min(0.12, h * 0.09);
    const yt = Math.min(0.16, h * 0.11);
    const pa: V2 = [yb, h - yt];
    const ph = pa[1] - pa[0];
    const pwid = pw - 2 * b;
    const fz = t / 2 + 0.0045;
    const parts: Part[] = [];
    for (const i of range(n)) {
      const a = i % 2 === 0 ? th : -th;
      const cx = -w / 2 + cw * (i + 0.5);
      const rot: V3 = [0, a, 0];
      const P = (lx: number, ly: number, lz: number): V3 => {
        const [x, z] = turnY(a, cx, 0, lx, lz);
        return [x, ly, z];
      };
      const flat = (slot: string, lx: number, ly: number, sx: number, sy: number, rz: number): Part =>
        sphere(slot, P(clamp(lx, -pwid / 2 + sx / 2, pwid / 2 - sx / 2), ly, fz), 0.5, { scale: [sx, sy, 0.003], rotation: [0, a, rz], plan: false });
      parts.push(box('border', [cx, h / 2, 0], [pw, h, t], { rotation: rot }));
      parts.push(box('paper', P(0, (pa[0] + pa[1]) / 2, t / 2 + 0.001), [pwid, ph, 0.004], { rotation: rot, plan: false }));
      // A peony bush growing from a garden rock, varied per panel.
      const rand = rng(1907 + i * 31);
      const sway = (rand() - 0.5) * pwid * 0.3;
      const fr = Math.min(pwid * 0.2, ph * 0.07);
      parts.push(flat('foliage', (rand() - 0.5) * pwid * 0.15, pa[0] + ph * 0.1, pwid * 0.62, ph * 0.15, (rand() - 0.5) * 0.3));
      const s0 = P(0, pa[0] + ph * 0.16, fz);
      const s1 = P(sway, pa[0] + ph * 0.5, fz);
      const s2 = P(sway * 0.4, pa[0] + ph * 0.78, fz);
      parts.push(rod('foliage', s0, s1, 0.004, { plan: false }), rod('foliage', s1, s2, 0.0035, { plan: false }));
      for (const [k, f] of [0.32, 0.44, 0.58, 0.68].entries()) {
        const side = k % 2 === 0 ? -1 : 1;
        parts.push(flat('foliage', sway * f + side * pwid * 0.16, pa[0] + ph * f, pwid * 0.3, Math.max(0.01, pwid * 0.11), side * 0.55));
      }
      const fl: [number, number, number][] = [
        [sway * 0.4, 0.8, 1],
        [sway + pwid * 0.2 * (rand() < 0.5 ? -1 : 1), 0.6, 0.85],
        [sway * 0.5 - pwid * 0.18, 0.42, 0.75],
      ];
      for (const [lx, f, k] of fl) parts.push(flat('peony', lx, pa[0] + ph * f, fr * 2 * k, fr * 1.7 * k, 0));
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const t = 0.022;
    const n = clamp(2 * Math.round(w / 0.7), 2, 10);
    const cw = w / n;
    const th = Math.atan2(Math.max(0.001, d - t - 0.004), cw);
    const zz = ((cw / Math.cos(th)) * 0.985 * Math.sin(th)) / 2;
    return [poly(range(n + 1).map((i) => [-w / 2 + cw * i, i % 2 === 0 ? zz : -zz] as V2), false)];
  },
});

const bandajiChest = defineItem({
  id: 'bandaji-chest',
  name: 'Bandaji chest',
  category: 'storage',
  type: 'storage',
  group: 'Dressers & chests',
  tags: ['bandaji', 'chest', 'korean', 'blanket chest', 'antique', 'brass', 'zelkova', 'drop front', 'trunk'],
  defaultSize: { w: 0.9, d: 0.45, h: 0.75 },
  minSize: { w: 0.6, d: 0.35, h: 0.5 },
  maxSize: { w: 1.3, d: 0.6, h: 1.0 },
  slots: [
    matSlot('wood', 'Zelkova panels', 'zelkova'),
    matSlot('frame', 'Frame', 'ottchil'),
    matSlot('metal', 'Fittings', 'black-iron'),
  ],
  build: ({ w, d, h }) => {
    const footH = clamp(h * 0.07, 0.03, 0.06);
    const topT = 0.03;
    const sideIn = 0.012;
    const zf = d / 2 - 0.03;
    const yb = footH;
    const yt = h - topT;
    const yHinge = yb + (yt - yb) * 0.46;
    const st = clamp(w * 0.06, 0.04, 0.07);
    const rl = 0.035;
    const xl = -w / 2 + sideIn;
    const xr = w / 2 - sideIn;
    const zr: V2 = [zf, zf + 0.008];
    const zm: V2 = [zf + 0.008, zf + 0.011];
    const o = { plan: false };
    const parts: Part[] = [
      span('wood', [xl, xr], [yb, yt], [-d / 2 + 0.01, zf]),
      span('frame', [-w / 2, w / 2], [yt, h], [-d / 2, d / 2], { bevel: 0.006 }),
      // Bracket feet and a low apron.
      ...[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => {
          const fx: V2 = sx < 0 ? [xl, xl + 0.07] : [xr - 0.07, xr];
          const fzz: V2 = sz < 0 ? [-d / 2 + 0.01, -d / 2 + 0.08] : [zf - 0.07, zf + 0.008];
          return span('frame', fx, [0, footH], fzz, { bevel: 0.004 });
        }),
      ),
      span('frame', [xl + 0.07, xr - 0.07], [footH - 0.018, footH], [zf - 0.01, zf + 0.004], o),
      // Front frame: stiles and rails around the drop-front flap and the fixed lower panel.
      span('frame', [xl, xl + st], [yb, yt], zr, o),
      span('frame', [xr - st, xr], [yb, yt], zr, o),
      span('frame', [xl + st, xr - st], [yb, yb + rl], zr, o),
      span('frame', [xl + st, xr - st], [yHinge - rl / 2, yHinge + rl / 2], zr, o),
      span('frame', [xl + st, xr - st], [yt - rl, yt], zr, o),
      // Flap panel, slightly proud of the carcass.
      span('wood', [xl + st, xr - st], [yHinge + rl / 2, yt - rl], [zf, zf + 0.004], o),
    ];
    // Corner plates (L-shaped) at the four front corners.
    const cp = Math.min(0.07, w * 0.08);
    for (const [cx, sx] of [[xl, 1], [xr, -1]] as V2[]) {
      for (const [cy, sy] of [[yb, 1], [yt, -1]] as V2[]) {
        const xx: V2 = sx > 0 ? [cx, cx + cp] : [cx - cp, cx];
        const yy: V2 = sy > 0 ? [cy, cy + cp] : [cy - cp, cy];
        parts.push(span('metal', xx, [Math.min(cy, cy + sy * 0.022), Math.max(cy, cy + sy * 0.022)], zm, o));
        parts.push(span('metal', [Math.min(cx, cx + sx * 0.022), Math.max(cx, cx + sx * 0.022)], yy, zm, o));
      }
    }
    // Butterfly hinges along the flap's bottom edge.
    const nh = clamp(Math.round(w / 0.4), 2, 3);
    const hs = Math.min(0.05, (yHinge - yb) * 0.25);
    for (const x of spaced(nh, xl + st + 0.09, xr - st - 0.09)) {
      parts.push(butterflyPlate('metal', x, yHinge, hs, zf + 0.008, 0.003));
      parts.push(rodX('metal', x - hs * 0.35, x + hs * 0.35, yHinge, zf + 0.012, 0.005, o));
    }
    // Round lock plate (apbatang) with hasp and a long barrel padlock.
    const rL = Math.min(0.085, (yt - yHinge) * 0.3, w * 0.1);
    const yL = yHinge + (yt - yHinge) * 0.5;
    const lockL = Math.min(0.12, w * 0.13);
    parts.push(
      discZ('metal', [0, yL, zf + 0.0095], rL, 0.003, { segments: 32, plan: false }),
      torus('metal', [0, yL, zf + 0.011], rL * 0.72, Math.max(0.002, rL * 0.04), { plan: false }),
      span('metal', [-0.012, 0.012], [yHinge - rl * 0.6, yL - rL * 0.4], zm, o),
      sphere('metal', [0, yL, zf + 0.012], Math.min(0.012, rL * 0.2), { scale: [1, 1, 0.5], plan: false }),
      rodX('metal', -lockL / 2, lockL / 2, yHinge - rl * 0.6 - 0.012, zf + 0.016, 0.011, o),
      torus('metal', [lockL * 0.3, yHinge - rl * 0.6, zf + 0.016], 0.016, 0.003, { arc: Math.PI, plan: false }),
    );
    // Top front corner caps and ring handles on the sides.
    for (const s of [-1, 1]) {
      const xx: V2 = s < 0 ? [-w / 2, -w / 2 + 0.06] : [w / 2 - 0.06, w / 2];
      parts.push(span('metal', xx, [h - 0.004, h], [d / 2 - 0.06, d / 2], o));
      parts.push(span('metal', xx, [yt, h - 0.004], [d / 2 - 0.004, d / 2], o));
      parts.push(span('metal', [s * (xr + 0.002) - 0.002, s * (xr + 0.002) + 0.002], [yt - 0.11, yt - 0.05], [-0.04, 0.04], o));
      parts.push(torus('metal', [s * (xr + 0.004), yt - 0.1, 0], 0.035, 0.005, { rotation: [0, Math.PI / 2, 0], plan: false }));
    }
    return parts;
  },
});

const celadonVase = defineItem({
  id: 'celadon-vase',
  name: 'Celadon maebyeong vase',
  category: 'decor',
  type: 'decor',
  group: 'Ornaments',
  tags: ['celadon', 'maebyeong', 'vase', 'goryeo', 'korean', 'ceramic', 'sanggam', 'crane', 'cheongja'],
  defaultSize: { w: 0.24, d: 0.24, h: 0.36 },
  minSize: { w: 0.12, d: 0.12, h: 0.18 },
  maxSize: { w: 0.5, d: 0.5, h: 0.8 },
  slots: [
    matSlot('glaze', 'Celadon glaze', 'celadon'),
    matSlot('inlay', 'White inlay', 'sanggam-white'),
    matSlot('stand', 'Stand', 'ottchil'),
  ],
  build: ({ w, d, h }) => {
    const R = Math.min(w, d) / 2;
    const sh = clamp(h * 0.07, 0.012, 0.04);
    const H = h - sh;
    const r = R * 0.98;
    const prof: V2[] = [
      [0, 0],
      [0.5, 0],
      [0.56, 0.02],
      [0.54, 0.06],
      [0.58, 0.22],
      [0.68, 0.42],
      [0.86, 0.6],
      [0.98, 0.72],
      [1, 0.77],
      [0.93, 0.85],
      [0.66, 0.91],
      [0.3, 0.945],
      [0.22, 0.96],
      [0.24, 0.98],
      [0.3, 0.995],
      [0.28, 1],
      [0.18, 1],
    ];
    const parts: Part[] = [
      lathe('stand', [0, 0, 0], [
        [0, 0],
        [R * 0.78, 0],
        [R * 0.8, sh * 0.35],
        [R * 0.7, sh * 0.75],
        [R * 0.62, sh],
        [0, sh],
      ], { segments: 32 }),
      lathe('glaze', [0, sh, 0], prof.map(([a, b]) => [a * r, b * H] as V2), { segments: 40, plan: false }),
      // Inlaid bands below the shoulder and at the lip.
      ring('inlay', [0, sh + H * 0.86, 0], r * 0.9, Math.max(0.0015, r * 0.012), { plan: false }),
      ring('inlay', [0, sh + H * 0.995, 0], r * 0.29, Math.max(0.0012, r * 0.01), { plan: false }),
    ];
    // Band of inlaid lotus petals around the foot.
    const np = 14;
    for (const k of range(np)) {
      const phi = (k / np) * TAU;
      const rho = r * 0.565;
      parts.push(
        sphere('inlay', [Math.cos(phi) * rho, sh + H * 0.12, Math.sin(phi) * rho], 0.5, {
          scale: [r * 0.2, H * 0.12, r * 0.02],
          rotation: [0, Math.PI / 2 - phi, 0],
          plan: false,
        }),
      );
    }
    return parts;
  },
  planDetail: ({ w, d }) => [circle([0, 0], Math.min(w, d) * 0.15)],
});

const onggiJars = defineItem({
  id: 'onggi-jars',
  name: 'Onggi kimchi jars',
  category: 'outdoor',
  type: 'storage',
  group: 'Baskets & boxes',
  tags: ['onggi', 'jangdok', 'jangdokdae', 'kimchi', 'jars', 'earthenware', 'korean', 'fermentation', 'crock'],
  defaultSize: { w: 1.2, d: 0.8, h: 0.75 },
  minSize: { w: 0.6, d: 0.45, h: 0.4 },
  maxSize: { w: 2.4, d: 1.6, h: 1.1 },
  slots: [
    matSlot('onggi', 'Onggi glaze', 'onggi'),
    matSlot('lid', 'Lids', 'onggi-lid'),
    matSlot('stone', 'Stone platform', 'stone-granite'),
  ],
  build: ({ w, d, h }) => {
    const ph = clamp(h * 0.1, 0.03, 0.08);
    const avail = h - ph;
    const rand = rng(53);
    const parts: Part[] = [span('stone', [-w / 2, w / 2], [0, ph], [-d / 2, d / 2], { bevel: 0.015 })];
    const jar = (x: number, z: number, R: number, H: number): void => {
      const bh = H * 0.87;
      const lh = H - bh;
      const y = ph;
      parts.push(
        lathe('onggi', [x, y, z], [
          [0, 0],
          [R * 0.6, 0],
          [R * 0.78, bh * 0.12],
          [R * 0.95, bh * 0.4],
          [R, bh * 0.58],
          [R * 0.93, bh * 0.76],
          [R * 0.76, bh * 0.9],
          [R * 0.64, bh * 0.97],
          [R * 0.68, bh],
          [R * 0.6, bh],
        ], { segments: 28 }),
        ring('onggi', [x, y + bh * 0.985, z], R * 0.66, Math.max(0.003, R * 0.03), { plan: false }),
        // Finger-drawn band (a raised wave line) on the shoulder.
        ring('onggi', [x, y + bh * 0.72, z], R * 0.95, Math.max(0.0025, R * 0.012), { plan: false }),
        lathe('lid', [x, y + bh, z], [
          [R * 0.72, 0],
          [R * 0.66, lh * 0.35],
          [R * 0.4, lh * 0.78],
          [R * 0.13, lh * 0.84],
          [R * 0.11, lh],
          [0, lh],
        ], { segments: 28, plan: false }),
      );
    };
    // Tall jars at the back, smaller ones in front.
    const nb = clamp(Math.round(w / 0.5), 1, 6);
    const rb = Math.min((w / nb) * 0.47, d * 0.3);
    for (const i of range(nb)) {
      const R = rb * lerp(0.86, 1, rand());
      const slack = w / nb / 2 - R;
      jar(-w / 2 + (i + 0.5) * (w / nb) + (rand() - 0.5) * slack, -d / 2 + rb + (rand() - 0.5) * (rb - R), R, avail * lerp(0.86, 0.99, rand()));
    }
    const nf = clamp(Math.round(w / 0.36), 1, 8);
    const rf = Math.min((w / nf) * 0.45, d * 0.22);
    for (const i of range(nf)) {
      const R = rf * lerp(0.8, 1, rand());
      jar(-w / 2 + (i + 0.5) * (w / nf), d / 2 - rf, R, avail * lerp(0.48, 0.66, rand()));
    }
    return parts;
  },
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

const hanbokDisplay = defineItem({
  id: 'hanbok-display',
  name: 'Hanbok on display stand',
  category: 'decor',
  type: 'decor',
  group: 'Ornaments',
  tags: ['hanbok', 'jeogori', 'chima', 'korean', 'traditional dress', 'display', 'stand', 'goreum'],
  defaultSize: { w: 0.78, d: 0.5, h: 1.62 },
  minSize: { w: 0.55, d: 0.35, h: 1.1 },
  maxSize: { w: 1.1, d: 0.8, h: 1.95 },
  slots: [
    matSlot('jeogori', 'Jeogori jacket', 'silk-yellow'),
    matSlot('chima', 'Chima, collar & ribbons', 'silk-crimson'),
    matSlot('trim', 'Dongjeong collar', 'cotton-ivory'),
    matSlot('stand', 'Stand', 'ottchil'),
  ],
  build: ({ w, d, h }) => {
    const s = clamp(Math.min(w / 0.78, d / 0.5), 0.6, 1.3);
    const baseR = (Math.min(w, d) / 2) * 0.62;
    const yBar = h - 0.12;
    const o = { plan: false };
    const parts: Part[] = [
      lathe('stand', [0, 0, 0], [
        [0, 0],
        [baseR, 0],
        [baseR * 0.96, 0.02],
        [baseR * 0.5, 0.035],
        [0, 0.035],
      ], { segments: 32 }),
      vcyl('stand', 0, 0, 0.03, h - 0.04, 0.014, o),
      sphere('stand', [0, h - 0.028, 0], 0.026, o),
      // Shoulder crossbar (hwaetdae) with turned end knobs.
      rodX('stand', -w / 2 + 0.02, w / 2 - 0.02, yBar, 0, 0.011, o),
      sphere('stand', [-w / 2 + 0.02, yBar, 0], 0.018, o),
      sphere('stand', [w / 2 - 0.02, yBar, 0], 0.018, o),
    ];
    // Chima: full, high-waisted skirt falling to the base, with soft pleats.
    const jT = yBar + 0.035;
    const jB = jT - clamp(0.26 * s, 0.16, 0.3);
    const cT = jB + 0.06;
    const cB = 0.045;
    const L = cT - cB;
    const rt = 0.1 * s;
    const rb = Math.min(w * 0.4, 0.36 * s);
    const zs = Math.min(1, (d / 2 - 0.015) / rb);
    parts.push(
      lathe('chima', [0, cB, 0], [
        [rb, 0],
        [rb * 0.99, L * 0.08],
        [rb * 0.9, L * 0.35],
        [rb * 0.68, L * 0.65],
        [rt * 1.25, L * 0.9],
        [rt, L],
        [0, L],
      ], { segments: 40, scale: [1, 1, zs] }),
    );
    for (const k of range(14)) {
      const a = (k / 14) * TAU + 0.11;
      const pa: V3 = [Math.cos(a) * rt * 1.2, cT - L * 0.1, Math.sin(a) * rt * 1.2 * zs];
      const pb: V3 = [Math.cos(a) * rb * 0.97, cB + 0.01, Math.sin(a) * rb * 0.97 * zs];
      parts.push(rod('chima', pa, pb, 0.011 * s, { segments: 8, plan: false }));
    }
    // Jeogori: short jacket body, sleeves along the crossbar, curved sleeve bottoms, cuffs.
    const bh = 0.16 * s;
    const dz = Math.min(0.1 * s, d / 2 - 0.05);
    parts.push(cushion('jeogori', [-bh, bh], [jB, jT], [-dz, dz], { softness: 0.4, plan: false }));
    for (const sd of [-1, 1]) {
      const x0 = sd * bh * 0.8;
      const x1 = sd * (w / 2 - 0.05);
      const r0 = Math.min(0.07 * s, dz);
      const r1 = r0 * 0.85;
      parts.push(rod('jeogori', [x0, yBar - 0.012, 0], [x1, yBar - 0.03, 0], r0, { rTop: r1, segments: 20, plan: false }));
      parts.push(sphere('jeogori', [(x0 + x1) / 2 + sd * 0.02, yBar - 0.05 * s, 0], 0.5, { scale: [Math.abs(x1 - x0) * 0.8, 0.14 * s, r0 * 1.8], plan: false }));
      parts.push(rod('chima', [x1 - sd * 0.05 * s, yBar - 0.028, 0], [x1, yBar - 0.03, 0], r1 * 1.05, { segments: 20, plan: false }));
    }
    // Collar (git), white dongjeong and the goreum bow with long ribbons.
    const zf = dz + 0.003;
    parts.push(
      rod('chima', [-0.06 * s, jT - 0.005, dz * 0.7], [0.045 * s, jT - 0.13 * s, zf], 0.013 * s, o),
      rod('chima', [0.06 * s, jT - 0.005, dz * 0.7], [0.005 * s, jT - 0.085 * s, zf], 0.013 * s, o),
      rod('trim', [-0.066 * s, jT, dz * 0.62], [-0.01 * s, jT - 0.06 * s, zf + 0.008], 0.008 * s, o),
      rod('trim', [0.066 * s, jT, dz * 0.62], [0.025 * s, jT - 0.04 * s, zf + 0.008], 0.008 * s, o),
    );
    const g: V3 = [0.05 * s, jT - 0.13 * s, zf + 0.01];
    const L1 = Math.min(0.42 * s, g[1] - 0.2);
    const L2 = L1 * 0.62;
    parts.push(
      torus('chima', g, 0.022 * s, 0.008 * s, { scale: [1.4, 0.8, 1], plan: false }),
      box('chima', [g[0] + 0.012, g[1] - L1 / 2, g[2]], [0.042 * s, L1, 0.004], { rotation: [0, 0, 0.06], plan: false }),
      box('chima', [g[0] - 0.012, g[1] - L2 / 2, g[2] + 0.002], [0.036 * s, L2, 0.004], { rotation: [0, 0, -0.12], plan: false }),
    );
    return parts;
  },
});

const norigaeWall = defineItem({
  id: 'norigae-wall',
  name: 'Norigae wall ornaments',
  category: 'decor',
  type: 'decor',
  group: 'Wall art',
  tags: ['norigae', 'tassel', 'maedeup', 'knot', 'korean', 'jade', 'wall hanging', 'ornament', 'hanbok'],
  mount: 'wall',
  defaultElevation: 1.15,
  defaultSize: { w: 0.6, d: 0.06, h: 0.55 },
  minSize: { w: 0.3, d: 0.04, h: 0.3 },
  maxSize: { w: 1.4, d: 0.12, h: 0.9 },
  slots: [
    matSlot('bar', 'Hanging rod', 'ottchil'),
    matSlot('gem', 'Jade & silver', 'jade-stone'),
    matSlot('silk1', 'Silk cord (red)', 'silk-crimson'),
    matSlot('silk2', 'Silk cord (blue)', 'silk-indigo'),
  ],
  build: ({ w, d, h }) => {
    const r = Math.min(0.012, d / 2 - 0.008);
    const zb = -d / 2 + r + 0.004;
    const yb = h - r - 0.012;
    const o = { plan: false };
    const parts: Part[] = [
      rodX('bar', -w / 2 + 0.02, w / 2 - 0.02, yb, zb, r),
      sphere('bar', [-w / 2 + 0.02, yb, zb], r * 1.4, o),
      sphere('bar', [w / 2 - 0.02, yb, zb], r * 1.4, o),
      span('bar', [-w / 2 + 0.06, -w / 2 + 0.08], [yb - 0.01, yb + 0.01], [-d / 2, zb], o),
      span('bar', [w / 2 - 0.08, w / 2 - 0.06], [yb - 0.01, yb + 0.01], [-d / 2, zb], o),
    ];
    const n = clamp(Math.round((w - 0.08) / 0.12), 2, 8);
    const sc = Math.min(1, (w - 0.1) / n / 0.11);
    const avail = yb - 0.015;
    const rand = rng(612);
    for (const [i, x] of cells(n, -w / 2 + 0.05, w / 2 - 0.05).entries()) {
      const a = i % 2 === 0 ? 'silk1' : 'silk2';
      const b = i % 2 === 0 ? 'silk2' : 'silk1';
      const z = zb;
      const yK = yb - avail * 0.16;
      const yP = yb - avail * 0.38;
      const yC = yb - avail * 0.56;
      const tl = avail * lerp(0.34, 0.42, rand());
      parts.push(
        torus(a, [x, yb, z], r + 0.004, 0.0025, { rotation: [0, Math.PI / 2, 0], plan: false }),
        vcyl(a, x, z, yC, yb - r, 0.0022, o),
        // Maedeup knot: a diamond body with two side loops.
        sphere(a, [x, yK, z], 0.5, { scale: [0.034 * sc, 0.04 * sc, 0.012], rotation: [0, 0, Math.PI / 4], plan: false }),
        sphere(a, [x - 0.022 * sc, yK, z], 0.5, { scale: [0.02 * sc, 0.014 * sc, 0.01], plan: false }),
        sphere(a, [x + 0.022 * sc, yK, z], 0.5, { scale: [0.02 * sc, 0.014 * sc, 0.01], plan: false }),
      );
      // Ornament (jade butterfly, double gourd or jade disc).
      const k = i % 3;
      if (k === 0) {
        for (const sx of [-1, 1]) {
          parts.push(sphere('gem', [x + sx * 0.02 * sc, yP + 0.01 * sc, z], 0.5, { scale: [0.036 * sc, 0.028 * sc, 0.008], rotation: [0, 0, sx * 0.5], plan: false }));
          parts.push(sphere('gem', [x + sx * 0.014 * sc, yP - 0.016 * sc, z], 0.5, { scale: [0.022 * sc, 0.02 * sc, 0.008], rotation: [0, 0, -sx * 0.4], plan: false }));
        }
        parts.push(sphere(b, [x, yP, z], 0.5, { scale: [0.008, 0.036 * sc, 0.01], plan: false }));
      } else if (k === 1) {
        parts.push(sphere('gem', [x, yP + 0.018 * sc, z], 0.015 * sc, { scale: [1, 1, 0.6], plan: false }));
        parts.push(sphere('gem', [x, yP - 0.012 * sc, z], 0.022 * sc, { scale: [1, 1, 0.6], plan: false }));
        parts.push(cyl(b, [x, yP + 0.003 * sc, z], 0.007 * sc, 0.006, o));
      } else {
        parts.push(discZ('gem', [x, yP, z], 0.028 * sc, 0.008, { segments: 28, plan: false }));
        parts.push(torus(b, [x, yP, z], 0.028 * sc, 0.0035, o));
      }
      // Small knot, cap and the long silk tassel.
      parts.push(
        sphere(b, [x, yP - 0.042 * sc, z], 0.011 * sc, o),
        sphere(b, [x, yC, z], 0.012, { scale: [1, 1, 0.8], plan: false }),
        cyl('gem', [x, yC - 0.014, z], 0.009, 0.01, o),
        vcyl(b, x, z, Math.max(0.005, yC - 0.019 - tl), yC - 0.019, 0.016 * sc, { rTop: 0.007, scale: [1, 1, 0.7], plan: false }),
      );
    }
    return parts;
  },
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

/** One tier of a nong: carcass, front frame, doors and brass fittings. */
function nongTier(w: number, d: number, y0: number, th: number): Part[] {
  const zf = d / 2 - 0.022;
  const x0 = -w / 2 + 0.008;
  const x1 = w / 2 - 0.008;
  const y1 = y0 + th;
  const st = clamp(w * 0.05, 0.035, 0.06);
  const rl = clamp(th * 0.06, 0.025, 0.04);
  const dw = Math.min(w * 0.22, 0.26);
  const es = st * 0.6;
  const dy0 = y0 + th * 0.2;
  const dy1 = y0 + th * 0.84;
  const zr: V2 = [zf, zf + 0.01];
  const zm: V2 = [zf + 0.01, zf + 0.013];
  const o = { plan: false };
  const yTopIn = y1 - 0.02;
  const parts: Part[] = [
    span('wood', [x0, x1], [y0 + 0.004, yTopIn], [-d / 2 + 0.01, zf]),
    span('frame', [-w / 2, w / 2], [yTopIn, y1], [-d / 2, d / 2 - 0.006], { bevel: 0.004 }),
    span('frame', [x0, x1], [y0, y0 + 0.012], [-d / 2 + 0.005, zf + 0.008], o),
    // Front frame.
    span('frame', [x0, x0 + st], [y0 + 0.012, yTopIn], zr, o),
    span('frame', [x1 - st, x1], [y0 + 0.012, yTopIn], zr, o),
    span('frame', [-dw - es, -dw], [dy0, dy1], zr, o),
    span('frame', [dw, dw + es], [dy0, dy1], zr, o),
    span('frame', [x0 + st, x1 - st], [y0 + 0.012, y0 + 0.012 + rl], zr, o),
    span('frame', [x0 + st, x1 - st], [dy0 - rl, dy0], zr, o),
    span('frame', [x0 + st, x1 - st], [dy1, dy1 + rl], zr, o),
    span('frame', [x0 + st, x1 - st], [yTopIn - rl, yTopIn], zr, o),
    // Figured panels: door leaves (proud), side panels and bands (recessed).
    span('panel', [-dw + 0.003, -0.002], [dy0, dy1], [zf + 0.002, zf + 0.009], o),
    span('panel', [0.002, dw - 0.003], [dy0, dy1], [zf + 0.002, zf + 0.009], o),
    span('panel', [x0 + st, -dw - es], [dy0, dy1], [zf, zf + 0.005], o),
    span('panel', [dw + es, x1 - st], [dy0, dy1], [zf, zf + 0.005], o),
    span('panel', [x0 + st, x1 - st], [dy1 + rl, yTopIn - rl], [zf, zf + 0.005], o),
    span('panel', [x0 + st, x1 - st], [y0 + 0.012 + rl, dy0 - rl], [zf, zf + 0.005], o),
  ];
  // Hinges on the outer edges of the doors.
  for (const sx of [-1, 1]) {
    for (const f of [0.18, 0.82]) {
      const hy = lerp(dy0, dy1, f);
      // From just over the stile to 4 cm onto the door leaf.
      const ea = sx * (dw + 0.006);
      const eb = sx * (dw - 0.04);
      parts.push(span('metal', [Math.min(ea, eb), Math.max(ea, eb)], [hy - 0.018, hy + 0.018], zm, o));
    }
  }
  // Round lock plate, hasp, barrel padlock and half-moon pulls.
  const ly = lerp(dy0, dy1, 0.6);
  const lr = Math.min(0.055, dw * 0.35, (dy1 - dy0) * 0.2);
  parts.push(
    discZ('metal', [0, ly, zf + 0.0115], lr, 0.003, { segments: 28, plan: false }),
    span('metal', [-0.008, 0.008], [ly - lr * 1.6, ly], zm, o),
    rodX('metal', -0.045, 0.045, ly - lr * 1.7, zf + 0.022, 0.009, o),
  );
  for (const sx of [-1, 1]) {
    const px = sx * dw * 0.45;
    parts.push(discZ('metal', [px, ly - lr * 0.2, zf + 0.0105], 0.012, 0.002, { plan: false }));
    parts.push(torus('metal', [px, ly - lr * 0.2, zf + 0.014], 0.016, 0.0028, { arc: Math.PI, rotation: [0, 0, Math.PI], plan: false }));
  }
  // Corner plates and side ring handles.
  const cp = Math.min(0.05, w * 0.06);
  for (const cx of [x0, x1 - cp]) {
    for (const cy of [y0 + 0.012, yTopIn - cp]) parts.push(span('metal', [cx, cx + cp], [cy, cy + cp], zm, o));
  }
  for (const sx of [-1, 1]) {
    parts.push(torus('metal', [sx * (x1 + 0.004), y0 + th * 0.6, 0], 0.03, 0.004, { rotation: [0, Math.PI / 2, 0], plan: false }));
  }
  return parts;
}

const nongCabinet = defineItem({
  id: 'nong-cabinet',
  name: 'Nong stacked chest',
  category: 'storage',
  type: 'storage',
  group: 'Dressers & chests',
  tags: ['nong', 'ijung-nong', 'stacked chest', 'korean', 'antique', 'brass fittings', 'clothes chest', 'joseon'],
  defaultSize: { w: 0.9, d: 0.48, h: 1.32 },
  minSize: { w: 0.6, d: 0.38, h: 0.8 },
  maxSize: { w: 1.4, d: 0.62, h: 1.8 },
  slots: [
    matSlot('wood', 'Carcass', 'zelkova'),
    matSlot('panel', 'Figured panels', 'paulownia'),
    matSlot('frame', 'Frame & stand', 'ottchil'),
    matSlot('metal', 'Brass fittings', 'yugi-brass'),
  ],
  build: ({ w, d, h }) => {
    const sh = clamp(h * 0.09, 0.07, 0.14);
    const tierH = (h - sh) / 2;
    const o = { plan: false };
    const parts: Part[] = [
      span('frame', [-w / 2, w / 2], [sh - 0.025, sh], [-d / 2, d / 2], { bevel: 0.004 }),
      ...legs4('frame', w, d, 0, 0, sh - 0.025, 0.045),
      span('frame', [-w / 2 + 0.045, w / 2 - 0.045], [sh - 0.06, sh - 0.025], [d / 2 - 0.02, d / 2 - 0.005], o),
      span('frame', [-w / 2 + 0.045, w / 2 - 0.045], [sh - 0.06, sh - 0.025], [-d / 2 + 0.005, -d / 2 + 0.02], o),
      sphere('frame', [0, sh - 0.06, d / 2 - 0.0125], 0.03, { scale: [2, 0.8, 0.25], plan: false }),
    ];
    for (const k of [0, 1]) parts.push(...nongTier(w, d, sh + k * tierH, tierH));
    return parts;
  },
});

const najeonWardrobe = defineItem({
  id: 'mother-of-pearl-wardrobe',
  name: 'Mother-of-pearl wardrobe (najeon)',
  category: 'bedroom',
  type: 'storage',
  group: 'Wardrobes',
  tags: ['najeon', 'mother of pearl', 'otjang', 'wardrobe', 'black lacquer', 'korean', 'inlay', 'chilgi', 'jagae'],
  defaultSize: { w: 1.2, d: 0.58, h: 1.9 },
  minSize: { w: 0.8, d: 0.48, h: 1.4 },
  maxSize: { w: 2.4, d: 0.7, h: 2.3 },
  slots: [
    matSlot('lacquer', 'Black lacquer', 'black-lacquer'),
    matSlot('najeon', 'Najeon panels', 'najeon'),
    matSlot('brass', 'Brass fittings', 'yugi-brass'),
    matSlot('nacre', 'Mother-of-pearl', 'nacre'),
  ],
  build: ({ w, d, h }) => {
    const plH = clamp(h * 0.06, 0.08, 0.13);
    const corH = clamp(h * 0.035, 0.05, 0.08);
    const zf = d / 2 - 0.03;
    const x0 = -w / 2 + 0.01;
    const x1 = w / 2 - 0.01;
    const o = { plan: false };
    const parts: Part[] = [
      span('lacquer', [x0, x1], [plH * 0.45, plH], [-d / 2 + 0.01, d / 2 - 0.012]),
      span('lacquer', [x0, x1], [plH, h - corH], [-d / 2, zf]),
      span('lacquer', [-w / 2, w / 2], [h - corH, h], [-d / 2, d / 2], { bevel: 0.006 }),
      span('nacre', [x0 + 0.02, x1 - 0.02], [h - corH * 0.6, h - corH * 0.4], [d / 2 - 0.001, d / 2 + 0.002], o),
    ];
    // Bracket feet with brass caps.
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const fx: V2 = sx < 0 ? [x0, x0 + 0.08] : [x1 - 0.08, x1];
        const fz: V2 = sz < 0 ? [-d / 2 + 0.01, -d / 2 + 0.09] : [d / 2 - 0.09, d / 2 - 0.012];
        parts.push(span('lacquer', fx, [0, plH * 0.45], fz, { bevel: 0.004 }));
      }
      const cx: V2 = sx < 0 ? [-w / 2, -w / 2 + 0.06] : [w / 2 - 0.06, w / 2];
      parts.push(span('brass', cx, [h - corH, h], [d / 2 - 0.003, d / 2 + 0.001], o));
      parts.push(span('brass', sx < 0 ? [x0, x0 + 0.06] : [x1 - 0.06, x1], [plH * 0.45, plH], [d / 2 - 0.012, d / 2 - 0.008], o));
    }
    // Drawers along the bottom.
    const dz = clamp(h * 0.11, 0.14, 0.22);
    const yd0 = plH + 0.01;
    const yd1 = yd0 + dz;
    const nDr = clamp(Math.round(w / 0.6), 2, 4);
    for (const [a, b] of cellSpans(nDr, x0 + 0.012, x1 - 0.012)) {
      const cx = (a + b) / 2;
      const m = Math.min(0.03, dz * 0.18);
      parts.push(
        span('lacquer', [a + 0.003, b - 0.003], [yd0, yd1], [zf, zf + 0.016], { bevel: 0.004, plan: false }),
        span('najeon', [a + m, b - m], [yd0 + m, yd1 - m], [zf + 0.016, zf + 0.019], o),
        discZ('brass', [cx, (yd0 + yd1) / 2, zf + 0.02], 0.022, 0.003, { plan: false }),
        torus('brass', [cx, (yd0 + yd1) / 2 - 0.004, zf + 0.024], 0.02, 0.003, { arc: Math.PI, rotation: [0, 0, Math.PI], plan: false }),
      );
    }
    // Doors in pairs with najeon panels, nacre roundels and brass fittings.
    const nPair = clamp(Math.round(w / 0.9), 1, 3);
    const nd = nPair * 2;
    const ydoor0 = yd1 + 0.012;
    const ydoor1 = h - corH - 0.012;
    const dh = ydoor1 - ydoor0;
    const spans = cellSpans(nd, x0 + 0.012, x1 - 0.012);
    for (const [i, [a, b]] of spans.entries()) {
      const cx = (a + b) / 2;
      const m = Math.min(0.04, (b - a) * 0.12);
      const mr = Math.min((b - a) * 0.26, 0.08);
      const my = ydoor0 + dh * 0.72;
      parts.push(
        span('lacquer', [a + 0.003, b - 0.003], [ydoor0, ydoor1], [zf, zf + 0.016], { bevel: 0.004, plan: false }),
        span('najeon', [a + m, b - m], [ydoor0 + m, ydoor1 - m], [zf + 0.016, zf + 0.019], o),
        torus('nacre', [cx, my, zf + 0.0195], mr, Math.max(0.003, mr * 0.07), o),
        discZ('nacre', [cx, my, zf + 0.0195], mr * 0.45, 0.002, { segments: 24, plan: false }),
      );
      const ex = i % 2 === 0 ? a + 0.003 : b - 0.003;
      const inward = i % 2 === 0 ? 1 : -1;
      for (const f of [0.12, 0.88]) {
        const hy = ydoor0 + dh * f;
        const xs: V2 = inward > 0 ? [ex, ex + 0.05] : [ex - 0.05, ex];
        parts.push(span('brass', xs, [hy - 0.025, hy + 0.025], [zf + 0.016, zf + 0.021], o));
      }
    }
    for (const p of range(nPair)) {
      const c = spans[p * 2][1];
      const ly = ydoor0 + dh * 0.45;
      const lr = Math.min(0.055, (spans[p * 2][1] - spans[p * 2][0]) * 0.2);
      parts.push(
        discZ('brass', [c, ly, zf + 0.0205], lr, 0.003, { segments: 32, plan: false }),
        span('brass', [c - 0.006, c + 0.006], [ly - lr * 2.2, ly + lr * 0.4], [zf + 0.019, zf + 0.024], o),
        torus('brass', [c, ly - lr * 2.2, zf + 0.026], 0.02, 0.003, { arc: Math.PI, rotation: [0, 0, Math.PI], plan: false }),
      );
    }
    return parts;
  },
});

// ---------------------------------------------------------------------------
// Pack
// ---------------------------------------------------------------------------

export default definePack({
  name: 'Korean home',
  version: '1.0.0',
  author: 'Neest team',
  description:
    'Ondol floor living, hanok lattice and hanji, celadon, onggi jars, najeon lacquer, brass-bound chests, a hanbok and norigae, a kimchi refrigerator and a Korean BBQ table.',
  license: 'CC0 (made for Neest)',
  items: [
    yoBedding,
    sobanTable,
    jwaseokChair,
    kimchiFridge,
    changhoScreen,
    byeongpung,
    bandajiChest,
    celadonVase,
    onggiJars,
    kbbqTable,
    hanbokDisplay,
    norigaeWall,
    hanjiLamp,
    nongCabinet,
    najeonWardrobe,
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

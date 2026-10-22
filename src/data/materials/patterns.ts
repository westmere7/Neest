/**
 * Procedural texture library for the Neest starter materials.
 *
 * Every pattern is generated in the browser from a fixed seed, so tiles are
 * identical across sessions and exports, need no network and carry no
 * third-party licence. Patterns are rasterised into float buffers (cheap,
 * analytic, wrap-around maths) and written to the canvas with a single
 * putImageData, which makes every tile repeat seamlessly.
 *
 * Most patterns are near-white luminance tiles (mean ≈ 0.8–0.9, details darker)
 * because the renderer multiplies them by the material's base colour. A few
 * (`colored: true`) are drawn in muted natural colours.
 *
 * One tile covers `texture.scale` metres of surface; feature sizes below are
 * chosen for the scales used in catalog.ts.
 */

export interface TexturePattern {
  id: string;
  name: string;
  /** Draws one seamless tile onto a size×size canvas. rng is a seeded deterministic PRNG in [0,1). */
  draw(ctx: CanvasRenderingContext2D, size: number, rng: () => number): void;
  colored?: boolean;
  /**
   * See-through pattern: pixels the tile leaves transparent are holes (wire mesh, perforated metal,
   * lattice). Surfaces using it render transparent and double-sided.
   */
  cutout?: boolean;
  /** Relative strength for normal-map derivation (0 = flat, ~1 = pronounced relief like grout/brick). */
  normalStrength: number;
}

type Rng = () => number;
type Rgb = readonly [number, number, number];
type Field = Float32Array;

const TAU = Math.PI * 2;

// ---------------------------------------------------------------------------
// Random numbers & hashing
// ---------------------------------------------------------------------------

/** Small, fast, seeded PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fmix32(input: number): number {
  let h = input | 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Deterministic hash of an integer lattice point → [0, 1). */
function hash2(x: number, y: number, seed: number): number {
  return fmix32(seed ^ fmix32((x | 0) + fmix32((y | 0) + 0x9e3779b9))) / 4294967296;
}

function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Draws a 32-bit seed from rng (constant rng consumption regardless of tile size). */
const nextSeed = (rng: Rng): number => Math.floor(rng() * 4294967296) >>> 0;
const range = (rng: Rng, a: number, b: number): number => a + (b - a) * rng();

// ---------------------------------------------------------------------------
// Math helpers
// ---------------------------------------------------------------------------

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
const mod = (a: number, n: number): number => ((a % n) + n) % n;
const fract = (v: number): number => v - Math.floor(v);
/** Shortest distance between two coordinates on a ring of length n. */
const wrapDist = (a: number, b: number, n: number): number => {
  const d = mod(a - b, n);
  return Math.min(d, n - d);
};
/** Anti-aliased coverage from a signed distance in pixels (positive = inside). */
const cover = (d: number): number => clamp01(d + 0.5);

// ---------------------------------------------------------------------------
// Fields & periodic noise
// ---------------------------------------------------------------------------

function field(N: number, value = 0): Field {
  const f = new Float32Array(N * N);
  if (value !== 0) f.fill(value);
  return f;
}

/**
 * Per-axis lattice lookup. `phase` (fraction of a cell) shifts the lattice so
 * that octaves don't all line up with the tile edge; periodicity is unaffected.
 */
function axisSetup(N: number, P: number, phase: number): { i0: Int32Array; i1: Int32Array; t: Float32Array } {
  const i0 = new Int32Array(N);
  const i1 = new Int32Array(N);
  const t = new Float32Array(N);
  for (let x = 0; x < N; x++) {
    const u = ((x + 0.5) * P) / N - 0.5 + phase;
    const i = Math.floor(u);
    const f = u - i;
    t[x] = f * f * (3 - 2 * f);
    i0[x] = mod(i, P);
    i1[x] = mod(i + 1, P);
  }
  return { i0, i1, t };
}

/**
 * Adds periodic value noise in [-amp, amp] to dst. px/py are the number of
 * lattice cells across the tile (independently per axis → anisotropic noise);
 * the lattice wraps, so the result tiles seamlessly.
 */
function addNoise(dst: Field, N: number, px: number, py: number, amp: number, seed: number): void {
  const PX = Math.max(1, Math.min(N, Math.round(px)));
  const PY = Math.max(1, Math.min(N, Math.round(py)));
  const lat = new Float32Array(PX * PY);
  for (let j = 0; j < PY; j++) {
    for (let i = 0; i < PX; i++) lat[j * PX + i] = hash2(i, j, seed) * 2 - 1;
  }
  const ax = axisSetup(N, PX, hash2(-1, -2, seed));
  const ay = axisSetup(N, PY, hash2(-3, -4, seed));
  const row = new Float32Array(PX);
  for (let y = 0, i = 0; y < N; y++) {
    // Interpolate the two lattice rows once, then only lerp along x per pixel.
    const r0 = ay.i0[y] * PX;
    const r1 = ay.i1[y] * PX;
    const ty = ay.t[y];
    for (let k = 0; k < PX; k++) {
      const a = lat[r0 + k];
      row[k] = amp * (a + (lat[r1 + k] - a) * ty);
    }
    for (let x = 0; x < N; x++, i++) {
      const a = row[ax.i0[x]];
      dst[i] += a + (row[ax.i1[x]] - a) * ax.t[x];
    }
  }
}

/** Adds fractal (multi-octave) periodic noise in roughly [-amp, amp]. */
function addFbm(
  dst: Field,
  N: number,
  px: number,
  py: number,
  octaves: number,
  amp: number,
  seed: number,
  gain = 0.5,
): void {
  let total = 0;
  for (let o = 0, a = 1; o < octaves; o++, a *= gain) total += a;
  for (let o = 0, a = 1; o < octaves; o++, a *= gain) {
    addNoise(
      dst,
      N,
      px * 2 ** o,
      py * 2 ** o,
      (amp * a) / total,
      (seed + Math.imul(o + 1, 0x9e3779b9)) >>> 0,
    );
  }
}

function fbmField(N: number, px: number, py: number, octaves: number, seed: number, gain = 0.5): Field {
  const f = field(N);
  addFbm(f, N, px, py, octaves, 1, seed, gain);
  return f;
}

function noiseField(N: number, px: number, py: number, seed: number): Field {
  const f = field(N);
  addNoise(f, N, px, py, 1, seed);
  return f;
}

interface Cells {
  /** Distance to the nearest feature point, in cell units. */
  f1: Field;
  /** Distance to the second-nearest feature point, in cell units. */
  f2: Field;
  /** Wrapped index of the nearest cell. */
  id: Int32Array;
  P: number;
}

/** Periodic Worley (cellular) noise with `cells` × `cells` jittered feature points. */
function worley(N: number, cells: number, seed: number, jitter: number): Cells {
  const P = Math.max(1, Math.min(N, Math.round(cells)));
  const jx = new Float32Array(P * P);
  const jy = new Float32Array(P * P);
  for (let j = 0; j < P; j++) {
    for (let i = 0; i < P; i++) {
      jx[j * P + i] = 0.5 + (hash2(i, j, seed) - 0.5) * jitter;
      jy[j * P + i] = 0.5 + (hash2(i, j, seed ^ 0x5bd1e995) - 0.5) * jitter;
    }
  }
  const cs = N / P;
  // Wrapped neighbour indices per column / row, so the inner loop has no modulo.
  const cellX = new Int32Array(N);
  const wrapX = new Int32Array(N * 3);
  for (let x = 0; x < N; x++) {
    const c = Math.floor((x + 0.5) / cs);
    cellX[x] = c;
    for (let d = 0; d < 3; d++) wrapX[x * 3 + d] = mod(c + d - 1, P);
  }
  const f1 = field(N);
  const f2 = field(N);
  const id = new Int32Array(N * N);
  for (let y = 0, i = 0; y < N; y++) {
    const v = (y + 0.5) / cs;
    const cy = Math.floor(v);
    for (let x = 0; x < N; x++, i++) {
      const u = (x + 0.5) / cs;
      const cx = cellX[x];
      const w3 = x * 3;
      let b1 = Infinity;
      let b2 = Infinity;
      let bi = 0;
      for (let dj = -1; dj <= 1; dj++) {
        const j = cy + dj;
        const jw = (j < 0 ? j + P : j >= P ? j - P : j) * P;
        for (let di = 0; di < 3; di++) {
          const ii = cx + di - 1;
          const k = jw + wrapX[w3 + di];
          const dx = ii + jx[k] - u;
          const dy = j + jy[k] - v;
          const d = dx * dx + dy * dy;
          if (d < b1) {
            b2 = b1;
            b1 = d;
            bi = k;
          } else if (d < b2) {
            b2 = d;
          }
        }
      }
      f1[i] = Math.sqrt(b1);
      f2[i] = Math.sqrt(b2);
      id[i] = bi;
    }
  }
  return { f1, f2, id, P };
}

/** Visits every pixel of a (possibly edge-crossing) box, wrapping indices around the tile. */
function forBox(
  N: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  fn: (i: number, px: number, py: number) => void,
): void {
  const xa = Math.floor(x0);
  const xb = Math.ceil(x1);
  const ya = Math.floor(y0);
  const yb = Math.ceil(y1);
  const wx0 = mod(xa, N);
  for (let y = ya; y < yb; y++) {
    const row = mod(y, N) * N;
    const py = y + 0.5;
    for (let x = xa, wx = wx0; x < xb; x++) {
      fn(row + wx, x + 0.5, py);
      if (++wx === N) wx = 0;
    }
  }
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

function putGray(ctx: CanvasRenderingContext2D, N: number, L: Field): void {
  const img = ctx.createImageData(N, N);
  const d = img.data;
  for (let i = 0, j = 0; i < L.length; i++, j += 4) {
    const v = L[i] * 255;
    d[j] = v;
    d[j + 1] = v;
    d[j + 2] = v;
    d[j + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

interface RgbField {
  r: Field;
  g: Field;
  b: Field;
}

function rgbField(N: number, c: Rgb): RgbField {
  return { r: field(N, c[0]), g: field(N, c[1]), b: field(N, c[2]) };
}

/** Alpha-blends colour c over pixel i. */
function blend(f: RgbField, i: number, c: Rgb, a: number): void {
  if (a <= 0) return;
  f.r[i] += (c[0] - f.r[i]) * a;
  f.g[i] += (c[1] - f.g[i]) * a;
  f.b[i] += (c[2] - f.b[i]) * a;
}

function putRgb(ctx: CanvasRenderingContext2D, N: number, f: RgbField): void {
  const img = ctx.createImageData(N, N);
  const d = img.data;
  for (let i = 0, j = 0; i < f.r.length; i++, j += 4) {
    d[j] = f.r[i] * 255;
    d[j + 1] = f.g[i] * 255;
    d[j + 2] = f.b[i] * 255;
    d[j + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

// ---------------------------------------------------------------------------
// Paint, plaster, concrete, brick
// ---------------------------------------------------------------------------

function drawPaint(ctx: CanvasRenderingContext2D, N: number, rng: Rng): void {
  const L = field(N, 0.885);
  addFbm(L, N, 3, 3, 4, 0.04, nextSeed(rng)); // broad mottling
  addNoise(L, N, 56, 3, 0.012, nextSeed(rng)); // faint vertical roller lanes
  addNoise(L, N, 128, 128, 0.02, nextSeed(rng)); // roller stipple / orange peel
  addNoise(L, N, 256, 256, 0.028, nextSeed(rng));
  addNoise(L, N, 512, 512, 0.016, nextSeed(rng));
  putGray(ctx, N, L);
}

function drawPlaster(ctx: CanvasRenderingContext2D, N: number, rng: Rng): void {
  const L = field(N, 0.87);
  addFbm(L, N, 2, 2, 6, 0.09, nextSeed(rng));
  addFbm(L, N, 10, 10, 3, 0.025, nextSeed(rng));
  // Trowel swipes: curved soft lenses with a slightly darker leading edge.
  for (let s = 0; s < 70; s++) {
    const cx = rng() * N;
    const cy = rng() * N;
    const ang = rng() * Math.PI;
    const len = N * range(rng, 0.05, 0.15);
    const wid = len * range(rng, 0.2, 0.38);
    const bend = range(rng, -0.5, 0.5);
    const delta = range(rng, -0.045, 0.045);
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const across = wid * (1 + Math.abs(bend));
    const hx = Math.abs(len * ca) + Math.abs(across * sa) + 1;
    const hy = Math.abs(len * sa) + Math.abs(across * ca) + 1;
    forBox(N, cx - hx, cy - hy, cx + hx, cy + hy, (i, px, py) => {
      const dx = px - cx;
      const dy = py - cy;
      const u = (dx * ca + dy * sa) / len;
      const v = (-dx * sa + dy * ca) / wid - bend * u * u;
      const e = u * u + v * v;
      if (e >= 1) return;
      const body = (1 - e) * (1 - e);
      const ridge = v > 0 ? Math.max(0, 1 - Math.abs(e - 0.8) / 0.14) : 0;
      L[i] += delta * body - Math.abs(delta) * 0.6 * ridge;
    });
  }
  addNoise(L, N, 256, 256, 0.014, nextSeed(rng));
  addNoise(L, N, 512, 512, 0.01, nextSeed(rng));
  const pits = noiseField(N, 320, 320, nextSeed(rng));
  const craze = worley(N, 9, nextSeed(rng), 1);
  const crazeMask = fbmField(N, 3, 3, 2, nextSeed(rng));
  for (let i = 0; i < L.length; i++) {
    if (pits[i] > 0.8) L[i] -= (pits[i] - 0.8) * 0.3;
    const line = 1 - smoothstep(0, 0.012, craze.f2[i] - craze.f1[i]);
    L[i] -= 0.03 * line * smoothstep(0.15, 0.5, crazeMask[i]);
  }
  putGray(ctx, N, L);
}

/** Board-formed concrete: horizontal board imprints, seams, blotches and bug holes. */
function drawConcrete(ctx: CanvasRenderingContext2D, N: number, rng: Rng): void {
  const rows = 14;
  const rowH = N / rows;
  const L = field(N, 0.85);
  addFbm(L, N, 3, 3, 5, 0.07, nextSeed(rng));
  addFbm(L, N, 24, 24, 2, 0.015, nextSeed(rng));
  const grain = fbmField(N, 5, 110, 3, nextSeed(rng));
  const tone: number[] = [];
  const off: number[] = [];
  const joint: number[] = [];
  for (let r = 0; r < rows; r++) {
    tone.push(range(rng, -0.035, 0.035));
    off.push(Math.floor(rng() * N));
    joint.push(rng() * N);
  }
  const gap = Math.max(0.8, N * 0.0022);
  for (let y = 0, i = 0; y < N; y++) {
    const r = Math.min(rows - 1, Math.floor((y + 0.5) / rowH));
    const ly = y + 0.5 - r * rowH;
    const seam = 1 - smoothstep(0, gap, Math.min(ly, rowH - ly));
    const lip = smoothstep(gap, gap * 2.5, ly) * (1 - smoothstep(gap * 2.5, gap * 4, ly));
    const gy = ((y + off[r]) % N) * N;
    for (let x = 0; x < N; x++, i++) {
      const dj = wrapDist(x + 0.5, joint[r], N);
      L[i] +=
        tone[r] + 0.035 * grain[gy + x] - 0.15 * seam + 0.03 * lip - 0.08 * (1 - smoothstep(0, gap, dj));
    }
  }
  for (let h = 0; h < 280; h++) {
    const cx = rng() * N;
    const cy = rng() * N;
    const r = N * range(rng, 0.0009, 0.0032) * (rng() < 0.12 ? 2 : 1);
    const depth = range(rng, 0.2, 0.38);
    forBox(N, cx - r - 1, cy - r - 1, cx + r + 1, cy + r + 1, (i, px, py) => {
      const d = Math.hypot(px - cx, py - cy);
      L[i] -= depth * cover(r - d) * (1 - (0.4 * d) / (r + 1));
    });
  }
  addNoise(L, N, 384, 384, 0.022, nextSeed(rng));
  putGray(ctx, N, L);
}

/** Running-bond brick, 215×65 mm with 10 mm mortar joints (4 × 12 per 0.9 m tile). */
function drawBrick(ctx: CanvasRenderingContext2D, N: number, rng: Rng): void {
  const cols = 4;
  const rows = 12;
  const cw = N / cols;
  const ch = N / rows;
  const half = (N * 0.011) / 2;
  const tone = new Float32Array(cols * rows);
  for (let k = 0; k < tone.length; k++) tone[k] = range(rng, -0.07, 0.07) - (rng() < 0.12 ? 0.1 : 0);
  const face = fbmField(N, 24, 24, 3, nextSeed(rng));
  const sand = noiseField(N, 512, 512, nextSeed(rng));
  const edge = fbmField(N, 64, 64, 2, nextSeed(rng));
  const edgeAmp = N * 0.003;
  const bevel = N * 0.006;
  const spall = fbmField(N, 16, 16, 3, nextSeed(rng));
  const chips = fbmField(N, 48, 48, 2, nextSeed(rng));
  const L = field(N);
  for (let y = 0, i = 0; y < N; y++) {
    const py = y + 0.5;
    const r = Math.min(rows - 1, Math.floor(py / ch));
    const ly = py - r * ch;
    const shift = (r & 1) * (cw / 2);
    const dy = Math.min(ly - half, ch - half - ly);
    for (let x = 0; x < N; x++, i++) {
      const sx = x + 0.5 + shift;
      const c = Math.floor(sx / cw);
      const lx = sx - c * cw;
      const k = r * cols + mod(c, cols);
      const d0 = Math.min(lx - half, cw - half - lx, dy) + edge[i] * edgeAmp;
      const d = d0 - (d0 < bevel * 2 ? Math.max(0, chips[i] - 0.35) * bevel * 3 : 0);
      const spalled = smoothstep(0.32, 0.45, spall[i]);
      const brick =
        0.86 + tone[k] + 0.05 * face[i] + 0.035 * sand[i] - 0.05 * spalled - 0.07 * (1 - smoothstep(0, bevel, d));
      // Mortar sits back from the face: shaded under each brick edge.
      const mortar = 0.6 + 0.05 * sand[i] + 0.02 * face[i] - 0.05 * smoothstep(-half, 0, d);
      L[i] = mortar + (brick - mortar) * cover(d);
    }
  }
  putGray(ctx, N, L);
}

// ---------------------------------------------------------------------------
// Wood
// ---------------------------------------------------------------------------

/**
 * Periodic wood-grain luminance offsets (grain runs along x). `rings` is the
 * number of growth rings across the tile height, `warp` how far (in ring
 * periods) the rings meander.
 */
function woodGrain(N: number, rng: Rng, rings: number, warp: number, arch: number): Field {
  const w1 = fbmField(N, 1, 2, 3, nextSeed(rng), 0.45); // broad meander of the rings
  const w2 = fbmField(N, 2, 10, 2, nextSeed(rng)); // ring-spacing variation, long along x
  const archF = fbmField(N, 2, 1, 2, nextSeed(rng)); // gentle waves along the board
  const streak = fbmField(N, 3, 200, 3, nextSeed(rng)); // fine fibres
  const band = fbmField(N, 2, 40, 2, nextSeed(rng)); // broader colour streaks
  const lateVar = fbmField(N, 2, 14, 2, nextSeed(rng));
  const pores = noiseField(N, 40, 320, nextSeed(rng));
  // Open pore channels: short dark dashes running with the grain (ring-porous woods).
  const poreLines = noiseField(N, 22, 300, nextSeed(rng));
  // Ray flecks: tiny pale dashes along the grain, and a faint cross-grain "figure" shimmer.
  const fleck = noiseField(N, 120, 640, nextSeed(rng));
  const figure = noiseField(N, 16, 3, nextSeed(rng));
  const out = field(N);
  for (let y = 0, i = 0; y < N; y++) {
    const base = (rings * (y + 0.5)) / N;
    for (let x = 0; x < N; x++, i++) {
      const ph = base + warp * w1[i] + 0.6 * w2[i] + arch * archF[i];
      const p = ph - Math.floor(ph);
      const lv = lateVar[i];
      const late = smoothstep(0.5 - 0.18 * lv, 0.8, p) * (1 - smoothstep(0.84, 0.97, p));
      const pore = pores[i] > 0.55 ? (pores[i] - 0.55) * 0.1 : 0;
      const channel = poreLines[i] > 0.42 ? (poreLines[i] - 0.42) * 0.12 * (1 - 0.6 * late) : 0;
      const ray = fleck[i] > 0.72 ? (fleck[i] - 0.72) * 0.09 : 0;
      out[i] =
        -0.085 * late * Math.max(0.15, 0.7 + 0.8 * lv) +
        0.028 * streak[i] +
        0.045 * band[i] +
        0.012 * figure[i] -
        pore * (0.5 + late) -
        channel +
        ray;
    }
  }
  return out;
}

interface PlankOptions {
  rows: number;
  minJoints: number;
  maxJoints: number;
  rings: number;
  warp: number;
  tone: number;
  knots: number;
}

/** Floor boards running along x with staggered butt joints that wrap around the tile. */
function drawPlanks(ctx: CanvasRenderingContext2D, N: number, rng: Rng, o: PlankOptions): void {
  const grain = woodGrain(N, rng, o.rings, o.warp, 0.6);
  const rowH = N / o.rows;
  const gap = Math.max(0.9, N * 0.0026);
  const joints: number[][] = [];
  for (let r = 0; r < o.rows; r++) {
    const k = o.minJoints + Math.floor(rng() * (o.maxJoints - o.minJoints + 1));
    const start = rng() * N;
    const js: number[] = [];
    for (let j = 0; j < k; j++) js.push(mod(start + ((j + range(rng, -0.14, 0.14)) * N) / k, N));
    js.sort((a, b) => a - b);
    joints.push(js);
  }
  const P = o.rows * o.maxJoints;
  const tone = new Float32Array(P);
  const ox = new Int32Array(P);
  const oy = new Int32Array(P);
  const contrast = new Float32Array(P);
  for (let p = 0; p < P; p++) {
    tone[p] = range(rng, -o.tone, o.tone);
    ox[p] = Math.floor(rng() * N);
    oy[p] = Math.floor(rng() * N);
    contrast[p] = range(rng, 0.75, 1.25);
  }
  // Traffic wear: broad, slightly lighter and flatter patches.
  const wear = fbmField(N, 3, 6, 3, nextSeed(rng));
  const L = field(N);
  for (let y = 0, i = 0; y < N; y++) {
    const r = Math.min(o.rows - 1, Math.floor((y + 0.5) / rowH));
    const ly = y + 0.5 - r * rowH;
    const dy = Math.min(ly, rowH - ly);
    const js = joints[r];
    for (let x = 0; x < N; x++, i++) {
      const px = x + 0.5;
      let seg = js.length - 1;
      let dj = Infinity;
      for (let j = 0; j < js.length; j++) {
        if (px >= js[j]) seg = j;
        dj = Math.min(dj, wrapDist(px, js[j], N));
      }
      const id = r * o.maxJoints + seg;
      const g = grain[((y + oy[id]) % N) * N + ((x + ox[id]) % N)];
      const e = Math.min(dy, dj);
      // Micro-bevel: a thin bright lip just inside the dark joint.
      const lip = smoothstep(gap, gap * 1.8, e) * (1 - smoothstep(gap * 1.8, gap * 3.2, e));
      const endGrain = 1 - smoothstep(0, gap * 9, dj);
      const worn = Math.max(0, wear[i]);
      L[i] =
        0.86 +
        tone[id] +
        g * contrast[id] * (1 - 0.25 * worn) +
        0.015 * worn +
        0.035 * lip -
        0.025 * endGrain -
        0.36 * (1 - smoothstep(0, gap, e)) -
        0.035 * (1 - smoothstep(0, gap * 5, e));
    }
  }
  for (let k = 0; k < o.knots; k++) {
    const r = Math.floor(rng() * o.rows);
    const cx = rng() * N;
    const cy = (r + range(rng, 0.3, 0.7)) * rowH;
    const ry = rowH * range(rng, 0.05, 0.1);
    const rx = ry * range(rng, 1.6, 2.8);
    const reach = 3;
    forBox(N, cx - rx * reach, cy - ry * reach, cx + rx * reach, cy + ry * reach, (i, px, py) => {
      if (Math.floor(py / rowH) !== r) return;
      const e = Math.hypot((px - cx) / rx, (py - cy) / ry);
      const core = (1 - smoothstep(0.8, 1.05, e)) * (0.55 + 0.45 * smoothstep(0.2, 0.9, e));
      const halo = Math.max(0, 1 - (e - 1) / (reach - 1)) * (0.5 + 0.5 * Math.cos(e * TAU * 1.2));
      L[i] -= 0.2 * core + (e > 1 ? 0.05 * halo : 0);
    });
  }
  putGray(ctx, N, L);
}

function drawWoodPlanks(ctx: CanvasRenderingContext2D, N: number, rng: Rng): void {
  // 1.6 m tile → 8 boards of 0.2 m, 1–2 butt joints per row.
  drawPlanks(ctx, N, rng, {
    rows: 8,
    minJoints: 1,
    maxJoints: 2,
    rings: 88,
    warp: 3.5,
    tone: 0.06,
    knots: 0,
  });
}

function drawWoodPlanksWide(ctx: CanvasRenderingContext2D, N: number, rng: Rng): void {
  // 2.4 m tile → 8 boards of 0.3 m, mostly full-length with the odd knot.
  drawPlanks(ctx, N, rng, {
    rows: 8,
    minJoints: 1,
    maxJoints: 1,
    rings: 72,
    warp: 4.5,
    tone: 0.07,
    knots: 9,
  });
}

function drawWoodGrain(ctx: CanvasRenderingContext2D, N: number, rng: Rng): void {
  const grain = woodGrain(N, rng, 40, 2.5, 1.2);
  const L = field(N, 0.865);
  addFbm(L, N, 2, 6, 3, 0.03, nextSeed(rng));
  for (let i = 0; i < L.length; i++) L[i] += grain[i];
  putGray(ctx, N, L);
}

/**
 * 45° herringbone parquet. Blocks are 5:1 (≈ 85 × 425 mm at the 1.2 m catalog
 * scale): in block-width units the axis-aligned herringbone lattice is spanned
 * by (1,1) and (k,−k); rotated by 45° it becomes rectangular, which lets an
 * integer number of zig-zag columns and block rows fit the square tile.
 */
function drawHerringbone(ctx: CanvasRenderingContext2D, N: number, rng: Rng): void {
  const k = 5;
  const colsX = 2;
  const rowsY = colsX * k;
  const W = N / (colsX * k * Math.SQRT2);
  const grain = woodGrain(N, rng, 90, 3, 0.5);
  // Per-block tone and grain offsets, indexed by (column mod colsX, orientation, row mod rowsY).
  const blocks = colsX * 2 * rowsY;
  const tone = new Float32Array(blocks);
  const offX = new Float32Array(blocks);
  const offY = new Float32Array(blocks);
  for (let b = 0; b < blocks; b++) {
    tone[b] = range(rng, -0.065, 0.065);
    offX[b] = Math.floor(rng() * N);
    offY[b] = Math.floor(rng() * N);
  }
  const gap = Math.max(0.8, N * 0.0024);
  const L = field(N);
  for (let y = 0, i = 0; y < N; y++) {
    const Y = (y + 0.5) / W;
    for (let x = 0; x < N; x++, i++) {
      const X = (x + 0.5) / W;
      const u = (X + Y) / Math.SQRT2;
      const v = (Y - X) / Math.SQRT2;
      const m0 = Math.floor((u - v + k + 1) / (2 * k));
      let s = 0;
      let t = 0;
      let bm = 0;
      let bi = 0;
      let orient = -1;
      for (let c = 0; c < 3 && orient < 0; c++) {
        const m = c === 0 ? m0 : c === 1 ? m0 - 1 : m0 + 1;
        const qu = u - m * k;
        const qv = v + m * k;
        let n = Math.floor(qv);
        if (qu >= n && qu < n + k) {
          s = qu - n;
          t = qv - n;
          bm = m;
          bi = n;
          orient = 0;
          break;
        }
        n = Math.floor(qu);
        if (qv >= n + 1 && qv < n + 1 + k) {
          s = qv - n - 1;
          t = qu - n;
          bm = m;
          bi = n;
          orient = 1;
        }
      }
      const b = (mod(bm, colsX) * 2 + Math.max(orient, 0)) * rowsY + mod(bi, rowsY);
      const gx = Math.floor(s * W + offX[b]) % N;
      const gy = Math.floor(t * W + offY[b]) % N;
      const e = Math.min(t, 1 - t, s, k - s) * W;
      L[i] =
        0.86 +
        tone[b] +
        grain[gy * N + gx] +
        0.03 * smoothstep(gap, gap * 1.8, e) * (1 - smoothstep(gap * 1.8, gap * 3.2, e)) -
        0.34 * (1 - smoothstep(0, gap, e)) -
        0.035 * (1 - smoothstep(0, gap * 5, e));
    }
  }
  putGray(ctx, N, L);
}

// ---------------------------------------------------------------------------
// Tile & mosaic
// ---------------------------------------------------------------------------

interface TileOptions {
  cols: number;
  rows: number;
  /** Horizontal offset per row as a fraction of the tile width (0.5 = running bond). */
  shift: number;
  /** Grout width as a fraction of the texture tile. */
  grout: number;
  face: number;
  /** Luminance of alternate (checkerboard) tiles, if any. */
  alt?: number;
  tone: number;
  cloud: number;
  cloudCells: number;
  bevel: number;
  groutL: number;
  /** Per-side random inset as a fraction of the tile size (hand-cut irregularity). */
  jitter: number;
  /** Per-tile glaze gradient amplitude (handmade look). */
  tilt: number;
}

function drawTiles(ctx: CanvasRenderingContext2D, N: number, rng: Rng, o: TileOptions): void {
  const cw = N / o.cols;
  const ch = N / o.rows;
  const g = Math.max(0.9, o.grout * N) / 2;
  const count = o.cols * o.rows;
  const tone = new Float32Array(count);
  const inset = new Float32Array(count * 4);
  const tx = new Float32Array(count);
  const ty = new Float32Array(count);
  const minSide = Math.min(cw, ch);
  for (let k = 0; k < count; k++) {
    tone[k] = range(rng, -o.tone, o.tone);
    for (let s = 0; s < 4; s++) inset[k * 4 + s] = g + rng() * o.jitter * minSide;
    tx[k] = range(rng, -o.tilt, o.tilt);
    ty[k] = range(rng, -o.tilt, o.tilt);
  }
  const cloud = fbmField(N, o.cloudCells, o.cloudCells, 4, nextSeed(rng));
  const fine = noiseField(N, 384, 384, nextSeed(rng));
  const bevelPx = Math.max(1, minSide * 0.05);
  // Edge wear: a slightly ragged outline plus occasional chips that bite into the glaze.
  const ragged = fbmField(N, 96, 96, 2, nextSeed(rng));
  const chips = fbmField(N, 40, 40, 2, nextSeed(rng));
  const pits = noiseField(N, 256, 256, nextSeed(rng));
  const grime = fbmField(N, 6, 6, 3, nextSeed(rng));
  const chipDepth = Math.max(0.6, minSide * 0.035);
  const L = field(N);
  for (let y = 0, i = 0; y < N; y++) {
    const py = y + 0.5;
    const r = Math.min(o.rows - 1, Math.floor(py / ch));
    const ly = py - r * ch;
    const shift = fract(r * o.shift) * cw;
    for (let x = 0; x < N; x++, i++) {
      const sx = x + 0.5 + shift;
      const c = Math.floor(sx / cw);
      const lx = sx - c * cw;
      const cc = mod(c, o.cols);
      const k = r * o.cols + cc;
      const d0 = Math.min(
        lx - inset[k * 4],
        cw - inset[k * 4 + 1] - lx,
        ly - inset[k * 4 + 2],
        ch - inset[k * 4 + 3] - ly,
      );
      const chip = Math.max(0, chips[i] - 0.5) * chipDepth * 4;
      const d = d0 + ragged[i] * 0.35 - (d0 < chipDepth * 2 ? chip : 0);
      const base = o.alt !== undefined && (r + cc) & 1 ? o.alt : o.face;
      const faceV =
        base +
        tone[k] +
        o.cloud * cloud[i] +
        0.012 * fine[i] +
        tx[k] * (lx / cw - 0.5) +
        ty[k] * (ly / ch - 0.5) -
        o.bevel * (1 - smoothstep(0, bevelPx, d)) -
        (pits[i] > 0.78 ? (pits[i] - 0.78) * 0.35 : 0) -
        0.03 * Math.min(1, chip) * (1 - smoothstep(0, chipDepth * 2, d0));
      // Grout: patchy grime, darker where it meets the tile edge (shadowed, dirt collects).
      const groutV = o.groutL + 0.035 * fine[i] + 0.04 * grime[i] - 0.04 * smoothstep(-g, 0, d);
      L[i] = groutV + (faceV - groutV) * cover(d);
    }
  }
  putGray(ctx, N, L);
}

function drawTileSquare(ctx: CanvasRenderingContext2D, N: number, rng: Rng): void {
  // 0.6 m tile → 2 × 2 tiles of 300 mm with 2–3 mm grout.
  drawTiles(ctx, N, rng, {
    cols: 2,
    rows: 2,
    shift: 0,
    grout: 0.005,
    face: 0.93,
    tone: 0.015,
    cloud: 0.015,
    cloudCells: 4,
    bevel: 0.05,
    groutL: 0.62,
    jitter: 0,
    tilt: 0.01,
  });
}

function drawSubway(ctx: CanvasRenderingContext2D, N: number, rng: Rng): void {
  // 0.6 m tile → running bond of 150 × 75 mm bricks (4 × 8).
  drawTiles(ctx, N, rng, {
    cols: 4,
    rows: 8,
    shift: 0.5,
    grout: 0.0045,
    face: 0.92,
    tone: 0.035,
    cloud: 0.02,
    cloudCells: 8,
    bevel: 0.09,
    groutL: 0.6,
    jitter: 0.004,
    tilt: 0.04,
  });
}

function drawTileLarge(ctx: CanvasRenderingContext2D, N: number, rng: Rng): void {
  // 1.2 m tile → 2 × 2 porcelain slabs of 600 mm with a stone-like cloudy face.
  drawTiles(ctx, N, rng, {
    cols: 2,
    rows: 2,
    shift: 0,
    grout: 0.0028,
    face: 0.88,
    tone: 0.015,
    cloud: 0.05,
    cloudCells: 3,
    bevel: 0.03,
    groutL: 0.6,
    jitter: 0,
    tilt: 0.01,
  });
}

function drawChecker(ctx: CanvasRenderingContext2D, N: number, rng: Rng): void {
  drawTiles(ctx, N, rng, {
    cols: 2,
    rows: 2,
    shift: 0,
    grout: 0.004,
    face: 0.94,
    alt: 0.45,
    tone: 0.012,
    cloud: 0.012,
    cloudCells: 4,
    bevel: 0.03,
    groutL: 0.68,
    jitter: 0,
    tilt: 0.008,
  });
}

function drawMosaic(ctx: CanvasRenderingContext2D, N: number, rng: Rng): void {
  // 0.3 m tile → 12 × 12 chips of ~23 mm with irregular grout.
  drawTiles(ctx, N, rng, {
    cols: 12,
    rows: 12,
    shift: 0,
    grout: 0.006,
    face: 0.86,
    tone: 0.1,
    cloud: 0.012,
    cloudCells: 12,
    bevel: 0.08,
    groutL: 0.66,
    jitter: 0.035,
    tilt: 0.05,
  });
}

/**
 * Flat-top hexagon tiles with grout. 6 columns × 5 rows per tile; the hex
 * lattice is stretched vertically by ~4 % so it repeats on a square tile.
 */
function drawHex(ctx: CanvasRenderingContext2D, N: number, rng: Rng): void {
  const pairs = 3;
  const rows = 5;
  const cols = pairs * 2;
  const R = N / (3 * pairs);
  const rowH = Math.sqrt(3) * R;
  const sy = rowH / (N / rows);
  const seed = nextSeed(rng);
  const half = Math.max(0.9, N * 0.007) / 2;
  const mottle = fbmField(N, 10, 10, 3, nextSeed(rng));
  const fine = noiseField(N, 384, 384, nextSeed(rng));
  const L = field(N);
  for (let y = 0, i = 0; y < N; y++) {
    const Y = (y + 0.5) * sy;
    for (let x = 0; x < N; x++, i++) {
      const X = x + 0.5;
      const c0 = Math.round(X / (1.5 * R));
      let d1 = Infinity;
      let d2 = Infinity;
      let bc = 0;
      let br = 0;
      for (let c = c0 - 1; c <= c0 + 1; c++) {
        const off = c & 1 ? 0.5 : 0;
        const r0 = Math.round(Y / rowH - off);
        const hx = c * 1.5 * R;
        for (let r = r0 - 1; r <= r0 + 1; r++) {
          const hy = (r + off) * rowH;
          const d = (X - hx) * (X - hx) + (Y - hy) * (Y - hy);
          if (d < d1) {
            d2 = d1;
            d1 = d;
            bc = c;
            br = r;
          } else if (d < d2) {
            d2 = d;
          }
        }
      }
      const dEdge = (d2 - d1) / (2 * rowH) - half;
      const h = hash2(mod(bc, cols), mod(br, rows), seed);
      const tile =
        0.86 +
        (h - 0.5) * 0.16 +
        0.05 * mottle[i] +
        0.015 * fine[i] -
        0.06 * (1 - smoothstep(0, R * 0.18, dEdge));
      const grout = 0.62 + 0.04 * fine[i];
      L[i] = grout + (tile - grout) * cover(dEdge);
    }
  }
  putGray(ctx, N, L);
}

/** Terrazzo: fine matrix with angular chips of varying grey (≈ 32 % coverage). */
function drawTerrazzo(ctx: CanvasRenderingContext2D, N: number, rng: Rng): void {
  const L = field(N, 0.9);
  addFbm(L, N, 4, 4, 3, 0.02, nextSeed(rng));
  addNoise(L, N, 512, 512, 0.025, nextSeed(rng));
  const speck = noiseField(N, 256, 256, nextSeed(rng));
  for (let i = 0; i < L.length; i++) if (speck[i] > 0.6) L[i] -= (speck[i] - 0.6) * 0.8;
  let area = 0;
  for (let n = 0; n < 6000 && area < 0.32; n++) {
    const size = 0.003 + 0.016 * rng() ** 2.4;
    const rx = size * range(rng, 0.8, 1.25);
    const ry = size * range(rng, 0.55, 1);
    area += Math.PI * rx * ry * 0.8;
    const pick = rng();
    const tone =
      pick < 0.4
        ? range(rng, 0.95, 1.02)
        : pick < 0.7
          ? range(rng, 0.66, 0.82)
          : pick < 0.86
            ? range(rng, 0.46, 0.6)
            : range(rng, 0.28, 0.42);
    const cx = rng() * N;
    const cy = rng() * N;
    const rot = rng() * Math.PI;
    const ca = Math.cos(rot);
    const sa = Math.sin(rot);
    const nv = 5 + Math.floor(rng() * 4);
    const angles: number[] = [];
    for (let v = 0; v < nv; v++) angles.push(rng() * TAU);
    angles.sort((a, b) => a - b);
    const vx: number[] = [];
    const vy: number[] = [];
    for (const a of angles) {
      const ex = Math.cos(a) * rx * N;
      const ey = Math.sin(a) * ry * N;
      vx.push(cx + ex * ca - ey * sa);
      vy.push(cy + ex * sa + ey * ca);
    }
    // Inward edge normals (polygon on an ellipse → convex).
    const nx: number[] = [];
    const ny: number[] = [];
    const nc: number[] = [];
    for (let v = 0; v < nv; v++) {
      const ax = vx[v];
      const ay = vy[v];
      const bx = vx[(v + 1) % nv];
      const by = vy[(v + 1) % nv];
      let ex = -(by - ay);
      let ey = bx - ax;
      const len = Math.hypot(ex, ey) || 1;
      ex /= len;
      ey /= len;
      if (ex * (cx - ax) + ey * (cy - ay) < 0) {
        ex = -ex;
        ey = -ey;
      }
      nx.push(ex);
      ny.push(ey);
      nc.push(-(ex * ax + ey * ay));
    }
    const r = Math.max(rx, ry) * N + 1;
    const shade = range(rng, -0.03, 0.03);
    forBox(N, cx - r, cy - r, cx + r, cy + r, (i, px, py) => {
      let d = Infinity;
      for (let v = 0; v < nv; v++) d = Math.min(d, nx[v] * px + ny[v] * py + nc[v]);
      const a = cover(d);
      if (a > 0) L[i] += (tone + shade * Math.min(1, d / 3) - L[i]) * a;
    });
  }
  addNoise(L, N, 512, 512, 0.012, nextSeed(rng));
  putGray(ctx, N, L);
}

// ---------------------------------------------------------------------------
// Stone
// ---------------------------------------------------------------------------

/**
 * Line profile around the zero crossings of |sin(θ/2)|; periodic whenever θ
 * advances by a multiple of 2π across the tile.
 */
const veinLine = (theta: number, width: number): number =>
  1 - smoothstep(0, width, Math.abs(Math.sin(theta * 0.5)));

/** Carrara-style marble: soft grey diagonal veins with clouds and fine branching. */
function drawMarble(ctx: CanvasRenderingContext2D, N: number, rng: Rng): void {
  const L = field(N, 0.95);
  addFbm(L, N, 3, 3, 5, 0.035, nextSeed(rng));
  const w1 = fbmField(N, 2, 2, 4, nextSeed(rng));
  const w2 = fbmField(N, 3, 3, 4, nextSeed(rng));
  const w3 = fbmField(N, 5, 5, 3, nextSeed(rng));
  const m1 = fbmField(N, 2, 2, 3, nextSeed(rng));
  const m2 = fbmField(N, 3, 3, 3, nextSeed(rng));
  for (let y = 0, i = 0; y < N; y++) {
    const fy = (y + 0.5) / N;
    for (let x = 0; x < N; x++, i++) {
      const fx = (x + 0.5) / N;
      const t1 = TAU * 2 * (fx + fy) + 4.2 * w1[i];
      const t2 = TAU * (2 * fx - fy) + 4.5 * w2[i] + 1.5 * w1[i];
      const t3 = TAU * (fx + 3 * fy) + 6 * w3[i];
      const s1 = smoothstep(-0.4, 0.4, m1[i]);
      const s2 = smoothstep(-0.25, 0.45, m2[i]);
      const cloud = 1 - smoothstep(0, 0.3, Math.abs(Math.sin(t1 * 0.5)));
      L[i] -=
        0.2 * veinLine(t1, 0.05) * s1 +
        0.06 * cloud * s1 +
        0.14 * veinLine(t2, 0.025) * s2 +
        0.05 * veinLine(t3, 0.018) * (0.4 + 0.6 * s1);
    }
  }
  // Hair-thin branching veins following the main flow, and calcite sparkle.
  const w4 = fbmField(N, 7, 7, 3, nextSeed(rng));
  const sparkle = noiseField(N, 384, 384, nextSeed(rng));
  for (let y = 0, i = 0; y < N; y++) {
    const fy = (y + 0.5) / N;
    for (let x = 0; x < N; x++, i++) {
      const fx = (x + 0.5) / N;
      const t4 = TAU * (3 * fx + 2 * fy) + 7 * w4[i] + 2 * w1[i];
      L[i] -= 0.07 * veinLine(t4, 0.008) * smoothstep(-0.1, 0.5, m2[i]);
      if (sparkle[i] > 0.75) L[i] += (sparkle[i] - 0.75) * 0.06;
    }
  }
  addNoise(L, N, 384, 384, 0.008, nextSeed(rng));
  putGray(ctx, N, L);
}

/** Vein-cut travertine: soft horizontal bedding with elongated, irregular voids. */
function drawTravertine(ctx: CanvasRenderingContext2D, N: number, rng: Rng): void {
  const L = field(N, 0.88);
  addFbm(L, N, 3, 3, 5, 0.03, nextSeed(rng));
  addNoise(L, N, 4, 120, 0.02, nextSeed(rng));
  addNoise(L, N, 8, 260, 0.012, nextSeed(rng));
  const warp = fbmField(N, 2, 2, 2, nextSeed(rng));
  const ragged = fbmField(N, 96, 96, 2, nextSeed(rng));
  for (let y = 0, i = 0; y < N; y++) {
    for (let x = 0; x < N; x++, i++) {
      const ph = (8 * (y + 0.5)) / N + 0.7 * warp[i];
      L[i] += 0.025 * Math.sin(TAU * ph) + 0.012 * Math.sin(TAU * 3 * ph + 1);
    }
  }
  for (let p = 0; p < 150; p++) {
    const cx = rng() * N;
    const cy = rng() * N;
    const len = N * (0.004 + 0.035 * rng() ** 1.8);
    const hgt = len * range(rng, 0.07, 0.2);
    const ang = range(rng, -0.06, 0.06);
    const depth = range(rng, 0.2, 0.36);
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const r = len + 2;
    forBox(N, cx - r, cy - r, cx + r, cy + r, (i, px, py) => {
      const dx = px - cx;
      const dy = py - cy;
      const u = (dx * ca + dy * sa) / len;
      const v = (-dx * sa + dy * ca) / hgt;
      const e = Math.sqrt(u * u + v * v) + 0.35 * ragged[i];
      const a = cover((1 - e) * hgt);
      if (a > 0) L[i] -= depth * a * (0.8 - 0.2 * v);
    });
  }
  addNoise(L, N, 384, 384, 0.012, nextSeed(rng));
  putGray(ctx, N, L);
}

/** Cleft slate: overlapping flaky layers with ragged step edges and cleavage streaks. */
function drawSlate(ctx: CanvasRenderingContext2D, N: number, rng: Rng): void {
  const terrain = fbmField(N, 3, 2, 4, nextSeed(rng));
  addFbm(terrain, N, 20, 14, 2, 0.12, nextSeed(rng));
  const seed = nextSeed(rng);
  const L = field(N, 0.82);
  addFbm(L, N, 6, 6, 3, 0.03, nextSeed(rng));
  addNoise(L, N, 384, 384, 0.025, nextSeed(rng));
  addNoise(L, N, 192, 192, 0.02, nextSeed(rng));
  const streak = fbmField(N, 6, 90, 2, nextSeed(rng));
  const levels = 5;
  for (let y = 0, i = 0; y < N; y++) {
    for (let x = 0; x < N; x++, i++) {
      const q = (terrain[i] * 0.5 + 0.5) * levels;
      const fl = Math.floor(q);
      const fr = q - fl;
      L[i] +=
        (hash2(fl, 1, seed) - 0.5) * 0.08 -
        0.09 * (1 - smoothstep(0, 0.05, fr)) +
        0.035 * smoothstep(0.93, 1, fr) +
        0.02 * streak[i];
    }
  }
  putGray(ctx, N, L);
}

/** Speckled granite: a mosaic of light, mid and dark crystals (~7 mm) in loose clusters. */
function drawGranite(ctx: CanvasRenderingContext2D, N: number, rng: Rng): void {
  const cells = worley(N, 84, nextSeed(rng), 1);
  const cluster = fbmField(N, 8, 8, 2, nextSeed(rng));
  const seed = nextSeed(rng);
  const P = cells.P;
  const cs = N / P;
  const tones = new Float32Array(P * P);
  for (let k = 0; k < tones.length; k++) {
    const cxp = Math.min(N - 1, Math.floor(((k % P) + 0.5) * cs));
    const cyp = Math.min(N - 1, Math.floor((Math.floor(k / P) + 0.5) * cs));
    const cl = cluster[cyp * N + cxp];
    const p = hash2(k, 7, seed) + 0.12 * cl;
    const t = hash2(k, 11, seed);
    tones[k] = p < 0.58 ? 0.9 + 0.08 * t : p < 0.88 ? 0.66 + 0.14 * t : 0.3 + 0.16 * t;
  }
  const L = field(N);
  addFbm(L, N, 4, 4, 3, 0.03, nextSeed(rng));
  addNoise(L, N, 384, 384, 0.02, nextSeed(rng));
  for (let i = 0; i < L.length; i++) {
    L[i] += tones[cells.id[i]] - 0.04 * (1 - smoothstep(0, 0.1, cells.f2[i] - cells.f1[i]));
  }
  putGray(ctx, N, L);
}

// ---------------------------------------------------------------------------
// Metal
// ---------------------------------------------------------------------------

function drawBrushed(ctx: CanvasRenderingContext2D, N: number, rng: Rng): void {
  const L = field(N, 0.86);
  addNoise(L, N, 3, 512, 0.05, nextSeed(rng));
  addNoise(L, N, 10, 256, 0.035, nextSeed(rng));
  addNoise(L, N, 2, 64, 0.02, nextSeed(rng));
  addFbm(L, N, 2, 2, 3, 0.02, nextSeed(rng));
  for (let s = 0; s < 50; s++) {
    const y0 = rng() * N;
    const x0 = rng() * N;
    const len = N * range(rng, 0.15, 0.9);
    const slope = range(rng, -0.004, 0.004);
    const amp = range(rng, -0.06, 0.05);
    for (let t = 0; t < len; t++) {
      const yy = y0 + slope * t - 0.5;
      const yi = Math.floor(yy);
      const fy = yy - yi;
      const a = amp * Math.sin((Math.PI * t) / len);
      const xi = mod(Math.floor(x0 + t), N);
      L[mod(yi, N) * N + xi] += a * (1 - fy);
      L[mod(yi + 1, N) * N + xi] += a * fy;
    }
  }
  putGray(ctx, N, L);
}

// ---------------------------------------------------------------------------
// Fabric, leather & rugs
// ---------------------------------------------------------------------------

/** 1D periodic value noise along a thread: `cells` lattice points per tile. */
function threadNoise(thread: number, pos: number, cells: number, seed: number): number {
  const u = pos * cells - 0.5;
  const i = Math.floor(u);
  const f = u - i;
  const t = f * f * (3 - 2 * f);
  const a = hash2(thread, mod(i, cells), seed);
  const b = hash2(thread, mod(i + 1, cells), seed);
  return (a + (b - a) * t) * 2 - 1;
}

/** Plain-weave fabric: 48 warp × 48 weft threads per tile with slubs and twist. */
function drawWeave(ctx: CanvasRenderingContext2D, N: number, rng: Rng): void {
  const T = 48;
  const cell = N / T;
  const seed = nextSeed(rng);
  const toneV = new Float32Array(T);
  const toneH = new Float32Array(T);
  for (let t = 0; t < T; t++) {
    toneV[t] = range(rng, -0.035, 0.035);
    toneH[t] = range(rng, -0.035, 0.035);
  }
  // Slubs: slow tone changes along each thread (thread index × position along it).
  const slubV = new Float32Array(T * N);
  const slubH = new Float32Array(T * N);
  for (let t = 0; t < T; t++) {
    for (let p = 0; p < N; p++) {
      slubV[t * N + p] = 0.045 * threadNoise(t, (p + 0.5) / N, 7, seed);
      slubH[t * N + p] = 0.045 * threadNoise(t + T, (p + 0.5) / N, 7, seed);
    }
  }
  const fuzz = noiseField(N, 384, 384, nextSeed(rng));
  const cloud = fbmField(N, 4, 4, 3, nextSeed(rng));
  // Fibres: fine streaks running along each thread's direction, plus a few pills.
  const fibreV = noiseField(N, 192, 24, nextSeed(rng));
  const fibreH = noiseField(N, 24, 192, nextSeed(rng));
  const pills = noiseField(N, 96, 96, nextSeed(rng));
  const L = field(N);
  for (let y = 0, i = 0; y < N; y++) {
    const v = (y + 0.5) / cell;
    const j = Math.min(T - 1, Math.floor(v));
    const b = v - j;
    for (let x = 0; x < N; x++, i++) {
      const u = (x + 0.5) / cell;
      const ii = Math.min(T - 1, Math.floor(u));
      const a = u - ii;
      const warpTop = ((ii + j) & 1) === 0;
      const across = warpTop ? a : b;
      const along = warpTop ? b : a;
      const tone = warpTop ? toneV[ii] + slubV[ii * N + y] : toneH[j] + slubH[j * N + x];
      const c = Math.abs(across - 0.5) / 0.5;
      const h = Math.sqrt(Math.max(0, 1 - c * c)) ** 0.7;
      const lift = 0.85 + 0.15 * Math.sin(Math.PI * along);
      const twist = Math.sin(TAU * (along * 3 + across * 1.5));
      const fibre = warpTop ? fibreV[i] : fibreH[i];
      const pill = pills[i] > 0.8 ? (pills[i] - 0.8) * 0.25 : 0;
      L[i] =
        0.66 + 0.26 * h * lift - 0.02 * twist * h + tone + 0.035 * fuzz[i] + 0.02 * cloud[i] + 0.03 * fibre * h + pill;
    }
  }
  putGray(ctx, N, L);
}

/** Bouclé: densely packed small yarn loops over a clumpy base. */
function drawBoucle(ctx: CanvasRenderingContext2D, N: number, rng: Rng): void {
  // Dense yarn nubs (cellular domes) give full coverage with dark crevices...
  const nubs = worley(N, 60, nextSeed(rng), 1);
  const H = field(N);
  for (let i = 0; i < H.length; i++) {
    const f = nubs.f1[i];
    H[i] = 0.62 * Math.max(0, 1 - 1.5 * f * f);
  }
  // ...overlaid with small curled loops catching the light.
  for (let n = 0; n < 1700; n++) {
    const cx = rng() * N;
    const cy = rng() * N;
    const R = N * range(rng, 0.007, 0.014);
    const w = R * range(rng, 0.35, 0.5);
    const sq = range(rng, 0.6, 1);
    const ang = rng() * Math.PI;
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const k = range(rng, 0.75, 1);
    const reach = R + w * 1.3;
    forBox(N, cx - reach, cy - reach, cx + reach, cy + reach, (i, px, py) => {
      const dx = px - cx;
      const dy = py - cy;
      const u = dx * ca + dy * sa;
      const v = (-dx * sa + dy * ca) / sq;
      const t = (Math.sqrt(u * u + v * v) - R) / (w * 1.3);
      if (t <= -1 || t >= 1) return;
      const s = 1 - t * t;
      const val = k * s * s;
      if (val > H[i]) H[i] = val;
    });
  }
  const L = field(N, 0.63);
  addFbm(L, N, 6, 6, 3, 0.05, nextSeed(rng));
  addNoise(L, N, 384, 384, 0.025, nextSeed(rng));
  for (let i = 0; i < L.length; i++) L[i] += 0.32 * H[i];
  putGray(ctx, N, L);
}

/** Pebble-grain leather: rounded cellular pebbles with soft creases and broader wrinkles. */
function drawLeather(ctx: CanvasRenderingContext2D, N: number, rng: Rng): void {
  const peb = worley(N, 38, nextSeed(rng), 1);
  const wr = worley(N, 7, nextSeed(rng), 0.9);
  const depth = fbmField(N, 6, 6, 2, nextSeed(rng));
  const seed = nextSeed(rng);
  const fine = worley(N, 16, nextSeed(rng), 1);
  const pores = noiseField(N, 320, 320, nextSeed(rng));
  const L = field(N, 0.86);
  addFbm(L, N, 3, 3, 4, 0.04, nextSeed(rng));
  addNoise(L, N, 384, 384, 0.012, nextSeed(rng));
  for (let i = 0; i < L.length; i++) {
    // Rounded pebble plateau: bright in the middle, rolling off into soft creases.
    const plateau = smoothstep(0, 0.5, peb.f2[i] - peb.f1[i]);
    const wrinkle = 1 - smoothstep(0, 0.07, wr.f2[i] - wr.f1[i]);
    L[i] +=
      0.1 * (plateau - 0.5) * (0.8 + 0.4 * depth[i]) -
      0.04 * wrinkle -
      0.02 * (1 - smoothstep(0, 0.04, fine.f2[i] - fine.f1[i])) * plateau -
      (pores[i] > 0.72 ? (pores[i] - 0.72) * 0.12 : 0) +
      (hash2(peb.id[i], 3, seed) - 0.5) * 0.025;
  }
  putGray(ctx, N, L);
}

/** Chunky 2×2 basket-weave jute with twisted yarns (24 yarns per 0.25 m tile). */
function drawJute(ctx: CanvasRenderingContext2D, N: number, rng: Rng): void {
  const T = 24;
  const cell = N / T;
  const toneV = new Float32Array(T);
  const toneH = new Float32Array(T);
  const phV = new Float32Array(T);
  const phH = new Float32Array(T);
  for (let t = 0; t < T; t++) {
    toneV[t] = range(rng, -0.05, 0.05);
    toneH[t] = range(rng, -0.05, 0.05);
    phV[t] = rng() * TAU;
    phH[t] = rng() * TAU;
  }
  const fibV = noiseField(N, 256, 24, nextSeed(rng));
  const fibH = noiseField(N, 24, 256, nextSeed(rng));
  const fuzz = noiseField(N, 512, 512, nextSeed(rng));
  const L = field(N);
  for (let y = 0, i = 0; y < N; y++) {
    const v = (y + 0.5) / cell;
    const j = Math.floor(v);
    const b = v - j;
    for (let x = 0; x < N; x++, i++) {
      const u = (x + 0.5) / cell;
      const ii = Math.floor(u);
      const a = u - ii;
      const warpTop = (((ii >> 1) + (j >> 1)) & 1) === 0;
      const across = warpTop ? a : b;
      const along = warpTop ? v : u;
      const tone = warpTop ? toneV[ii] : toneH[j];
      const ph = warpTop ? phV[ii] : phH[j];
      const fib = warpTop ? fibV[i] : fibH[i];
      const c = Math.abs(across - 0.5) / 0.5;
      const h = Math.sqrt(Math.max(0, 1 - c * c)) ** 0.8;
      const dip = Math.sin(Math.PI * fract(along / 2)) ** 0.5;
      const twist = Math.sin(TAU * (along * 1.5 + across * 0.9) + ph);
      L[i] = 0.46 + 0.42 * h * (0.8 + 0.2 * dip) - 0.07 * twist * h + 0.08 * fib + 0.045 * fuzz[i] + tone;
    }
  }
  putGray(ctx, N, L);
}

/** Berber rug: cream loop pile with groups of darker stripes with hand-woven wobble. */
function drawRugStripes(ctx: CanvasRenderingContext2D, N: number, rng: Rng): void {
  interface Band {
    y0: number;
    y1: number;
    v: number;
  }
  const bands: Band[] = [];
  const groups = 3;
  for (let g = 0; g < groups; g++) {
    const center = ((g + range(rng, 0.35, 0.65)) / groups) * N;
    const thick = N * range(rng, 0.022, 0.045);
    const thin = N * range(rng, 0.006, 0.012);
    const gap = N * range(rng, 0.008, 0.016);
    const v = range(rng, 0.34, 0.5);
    const parts: Array<[number, boolean]> =
      rng() < 0.6
        ? [
            [thin, true],
            [gap, false],
            [thick, true],
            [gap, false],
            [thin, true],
          ]
        : [
            [thick, true],
            [gap, false],
            [thin, true],
          ];
    let total = 0;
    for (const [w] of parts) total += w;
    let y = center - total / 2;
    for (const [w, ink] of parts) {
      if (ink) bands.push({ y0: y, y1: y + w, v: v + range(rng, -0.04, 0.04) });
      y += w;
    }
  }
  // Stripe profile as a sub-pixel lookup table over one tile height (wraps).
  const SUB = 4;
  const lut = new Float32Array(N * SUB);
  for (let s = 0; s < lut.length; s++) {
    const yy = (s + 0.5) / SUB;
    let v = 0.93;
    for (const bd of bands) {
      for (let o = -N; o <= N; o += N) {
        const a = cover(Math.min(yy - (bd.y0 + o), bd.y1 + o - yy));
        if (a > 0) v += (bd.v - v) * a;
      }
    }
    lut[s] = v;
  }
  const wob = fbmField(N, 16, 4, 2, nextSeed(rng));
  const nub = noiseField(N, 150, 190, nextSeed(rng));
  addNoise(nub, N, 300, 300, 0.5, nextSeed(rng));
  const fleck = noiseField(N, 256, 256, nextSeed(rng));
  const abrash = fbmField(N, 2, 8, 2, nextSeed(rng));
  const rowsPerTile = 160;
  const L = field(N);
  for (let y = 0, i = 0; y < N; y++) {
    const row = 0.5 + 0.5 * Math.cos((TAU * rowsPerTile * (y + 0.5)) / N);
    for (let x = 0; x < N; x++, i++) {
      const yy = y + 0.5 + wob[i] * N * 0.004;
      let v = lut[mod(Math.floor(yy * SUB), N * SUB)] + 0.025 * abrash[i];
      if (fleck[i] > 0.62) v -= (fleck[i] - 0.62) * 0.9;
      const pile = 0.93 + 0.05 * nub[i] - 0.035 * row;
      L[i] = v * pile;
    }
  }
  putGray(ctx, N, L);
}

/** Geometric (Beni Ourain–style) rug: ink diamond lattice with accent motifs on ivory. */
function drawRugGeometric(ctx: CanvasRenderingContext2D, N: number, rng: Rng): void {
  const w = N / 3;
  const h = N / 2;
  const g = Math.sqrt(1 / (w * w) + 1 / (h * h));
  const ivory: Rgb = [0.95, 0.93, 0.88];
  const ink: Rgb = [0.2, 0.22, 0.3];
  const accents: Rgb[] = [
    [0.68, 0.38, 0.27],
    [0.83, 0.65, 0.36],
    [0.42, 0.52, 0.62],
  ];
  const wx = fbmField(N, 6, 6, 2, nextSeed(rng));
  const wy = fbmField(N, 6, 6, 2, nextSeed(rng));
  const pile = noiseField(N, 256, 256, nextSeed(rng));
  const abrash = fbmField(N, 2, 7, 2, nextSeed(rng));
  const wobble = N * 0.005;
  const lineHalf = N * 0.0065;
  const out = rgbField(N, ivory);
  for (let y = 0, i = 0; y < N; y++) {
    for (let x = 0; x < N; x++, i++) {
      const X = x + 0.5 + wobble * wx[i];
      const Y = y + 0.5 + wobble * wy[i];
      const f1 = X / w + Y / h;
      const f2 = X / w - Y / h;
      const d1 = Math.abs(f1 - Math.round(f1)) / g;
      const d2 = Math.abs(f2 - Math.round(f2)) / g;
      const k1 = Math.floor(f1);
      const k2 = Math.floor(f2);
      const m = Math.max(Math.abs(f1 - k1 - 0.5), Math.abs(f2 - k2 - 0.5));
      const accent = accents[mod(k1 + k2, 3)];
      blend(out, i, accent, cover(lineHalf * 0.55 - Math.abs(m - 0.3) / g));
      blend(out, i, accent, cover((0.08 - m) / g));
      blend(out, i, ink, cover(lineHalf - Math.min(d1, d2)));
      blend(out, i, ink, cover(lineHalf * 2.4 - Math.hypot(d1, d2)));
      const s = 1 + 0.05 * pile[i] + 0.03 * abrash[i];
      out.r[i] *= s;
      out.g[i] *= s;
      out.b[i] *= s;
    }
  }
  putRgb(ctx, N, out);
}

// ---------------------------------------------------------------------------
// Art & books (multi-coloured)
// ---------------------------------------------------------------------------

/** Abstract mid-century composition on paper, kept inside a margin so edges tile cleanly. */
function drawArt(ctx: CanvasRenderingContext2D, N: number, rng: Rng): void {
  const paper: Rgb = [0.95, 0.925, 0.87];
  const palette: Rgb[] = [
    [0.79, 0.45, 0.33], // terracotta
    [0.58, 0.66, 0.56], // sage
    [0.88, 0.7, 0.4], // ochre
    [0.46, 0.56, 0.66], // dusty blue
    [0.9, 0.74, 0.68], // blush
  ];
  for (let k = palette.length - 1; k > 0; k--) {
    const j = Math.floor(rng() * (k + 1));
    const t = palette[k];
    palette[k] = palette[j];
    palette[j] = t;
  }
  const charcoal: Rgb = [0.22, 0.22, 0.24];
  const grain = fbmField(N, 6, 6, 3, nextSeed(rng));
  addNoise(grain, N, 384, 384, 0.6, nextSeed(rng));
  const rough = noiseField(N, 160, 160, nextSeed(rng));
  const out = rgbField(N, paper);
  const S = N;
  const roughAmp = N * 0.0015;

  type Sdf = (px: number, py: number) => number;
  /**
   * Multiply-blends a shape given by its signed distance (px, negative inside)
   * within its bounding box (all shapes stay inside the paper margin).
   */
  const paint = (sd: Sdf, bx: readonly [number, number, number, number], c: Rgb, opacity: number): void => {
    const x0 = Math.max(0, Math.floor(bx[0] - 2));
    const x1 = Math.min(N, Math.ceil(bx[2] + 2));
    const y0 = Math.max(0, Math.floor(bx[1] - 2));
    const y1 = Math.min(N, Math.ceil(bx[3] + 2));
    for (let y = y0; y < y1; y++) {
      for (let x = x0, i = y * N + x0; x < x1; x++, i++) {
        const a = cover(-(sd(x + 0.5, y + 0.5) + rough[i] * roughAmp)) * opacity;
        if (a <= 0) continue;
        out.r[i] *= 1 + (c[0] - 1) * a;
        out.g[i] *= 1 + (c[1] - 1) * a;
        out.b[i] *= 1 + (c[2] - 1) * a;
      }
    }
  };
  const circle =
    (cx: number, cy: number, r: number): Sdf =>
    (px, py) =>
      Math.hypot(px - cx, py - cy) - r;
  const box =
    (x0: number, y0: number, x1: number, y1: number): Sdf =>
    (px, py) => {
      const dx = Math.max(x0 - px, px - x1);
      const dy = Math.max(y0 - py, py - y1);
      return dx > 0 || dy > 0 ? Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) : Math.max(dx, dy);
    };

  // Ground band.
  const groundTop = S * range(rng, 0.72, 0.76);
  paint(
    box(S * 0.08, groundTop, S * 0.92, S * 0.9),
    [S * 0.08, groundTop, S * 0.92, S * 0.9],
    palette[4],
    0.85,
  );
  // Sun.
  const sunX = S * range(rng, 0.56, 0.66);
  const sunY = S * range(rng, 0.3, 0.38);
  const sunR = S * range(rng, 0.16, 0.2);
  paint(circle(sunX, sunY, sunR), [sunX - sunR, sunY - sunR, sunX + sunR, sunY + sunR], palette[0], 0.95);
  // Arch (rectangle with a semicircular top).
  const ax0 = S * range(rng, 0.13, 0.19);
  const aw = S * range(rng, 0.22, 0.27);
  const ar = aw / 2;
  const aTop = S * range(rng, 0.42, 0.5);
  const archBody = box(ax0, aTop, ax0 + aw, S * 0.86);
  const archCap = circle(ax0 + ar, aTop, ar);
  paint(
    (px, py) => Math.min(archBody(px, py), archCap(px, py)),
    [ax0, aTop - ar, ax0 + aw, S * 0.86],
    palette[1],
    0.92,
  );
  // Block overlapping the sun.
  const bx0 = S * range(rng, 0.5, 0.56);
  const by0 = S * range(rng, 0.46, 0.52);
  const bx1 = bx0 + S * range(rng, 0.24, 0.3);
  paint(box(bx0, by0, bx1, S * 0.84), [bx0, by0, bx1, S * 0.84], palette[2], 0.9);
  // Line work: an open ring and a ground line.
  const ringR = sunR * range(rng, 1.12, 1.22);
  const ringX = sunX - S * 0.03;
  const ringY = sunY + S * 0.02;
  paint(
    (px, py) => Math.abs(Math.hypot(px - ringX, py - ringY) - ringR) - S * 0.003,
    [ringX - ringR - S * 0.01, ringY - ringR - S * 0.01, ringX + ringR + S * 0.01, ringY + ringR + S * 0.01],
    charcoal,
    0.85,
  );
  paint(
    box(S * 0.08, S * 0.86, S * 0.92, S * 0.864),
    [S * 0.08, S * 0.86, S * 0.92, S * 0.864],
    charcoal,
    0.9,
  );
  // Dots.
  const dots = 3 + Math.floor(rng() * 3);
  for (let d = 0; d < dots; d++) {
    const dx = S * (0.14 + d * 0.045);
    const dr = S * 0.011;
    paint(
      circle(dx, S * 0.2, dr),
      [dx - dr, S * 0.2 - dr, dx + dr, S * 0.2 + dr],
      d % 2 ? palette[3] : charcoal,
      0.9,
    );
  }
  for (let i = 0; i < out.r.length; i++) {
    const s = 1 + 0.03 * grain[i];
    out.r[i] *= s;
    out.g[i] *= s;
    out.b[i] *= s;
  }
  putRgb(ctx, N, out);
}

/** A shelf row of book spines (varied widths, heights and colours) standing on a shelf board. */
function drawBooks(ctx: CanvasRenderingContext2D, N: number, rng: Rng): void {
  const palette: Rgb[] = [
    [0.55, 0.2, 0.18],
    [0.2, 0.27, 0.42],
    [0.24, 0.39, 0.31],
    [0.82, 0.62, 0.3],
    [0.91, 0.87, 0.77],
    [0.5, 0.52, 0.55],
    [0.25, 0.45, 0.48],
    [0.73, 0.57, 0.41],
    [0.16, 0.16, 0.17],
    [0.76, 0.53, 0.5],
    [0.52, 0.52, 0.32],
    [0.94, 0.93, 0.9],
  ];
  const gold: Rgb = [0.86, 0.73, 0.43];
  const shelfH = N * 0.05;
  const base = N - shelfH;
  const fine = noiseField(N, 384, 384, nextSeed(rng));
  const shelfGrain = fbmField(N, 3, 64, 2, nextSeed(rng));
  const out = rgbField(N, [0, 0, 0]);
  for (let y = 0, i = 0; y < N; y++) {
    const py = y + 0.5;
    for (let x = 0; x < N; x++, i++) {
      if (py < base) {
        const s = 0.12 + 0.08 * (py / base);
        out.r[i] = s * 1.08;
        out.g[i] = s;
        out.b[i] = s * 0.9;
      } else {
        const s =
          0.82 +
          0.05 * shelfGrain[i] +
          (py - base < 1.5 ? 0.08 : 0) -
          0.12 * (1 - smoothstep(0, shelfH, N - py));
        out.r[i] = s * 0.96;
        out.g[i] = s * 0.86;
        out.b[i] = s * 0.72;
      }
    }
  }
  const widths: number[] = [];
  let sum = 0;
  while (sum < N) {
    const w = N * range(rng, 0.045, 0.1);
    widths.push(w);
    sum += w;
  }
  const scale = N / sum;
  let x0 = rng() * N;
  let last = -1;
  for (const w0 of widths) {
    const w = w0 * scale;
    let ci = Math.floor(rng() * palette.length);
    if (ci === last) ci = (ci + 1) % palette.length;
    last = ci;
    const col = palette[ci];
    const h = base * range(rng, 0.72, 0.96);
    const top = base - h;
    const bands = rng() < 0.65;
    const bandCol: Rgb = rng() < 0.6 ? gold : ci === 4 || ci === 11 ? palette[8] : palette[4];
    const titleTop = range(rng, 0.18, 0.3);
    const titleLen = range(rng, 0.2, 0.42);
    const left = x0;
    forBox(N, left, top - 1, left + w, base, (i, px, py) => {
      const fx = (px - left) / w;
      const fy = (py - top) / h;
      const edge = Math.min(px - left, left + w - px);
      let c: Rgb = col;
      if (bands && ((fy > 0.07 && fy < 0.1) || (fy > 0.88 && fy < 0.91))) c = bandCol;
      else if (fy > titleTop && fy < titleTop + titleLen && fx > 0.32 && fx < 0.68) {
        c = [
          col[0] * 0.55 + bandCol[0] * 0.45,
          col[1] * 0.55 + bandCol[1] * 0.45,
          col[2] * 0.55 + bandCol[2] * 0.45,
        ];
      }
      const shade =
        (0.7 + 0.32 * Math.sin(Math.PI * fx) ** 0.6) *
        (0.62 + 0.38 * smoothstep(0, 1.6, edge)) *
        (1 + 0.04 * fine[i]);
      const topLight = py - top < 2 ? 1.12 : 1;
      const a = cover(py - top);
      blend(out, i, [c[0] * shade * topLight, c[1] * shade * topLight, c[2] * shade * topLight], a);
    });
    x0 += w;
  }
  putRgb(ctx, N, out);
}

// ---------------------------------------------------------------------------
// Wallpapers
// ---------------------------------------------------------------------------

/** Anti-aliased band test: 1 inside [a, b] (tile units), soft over `px`. */
const band = (t: number, a: number, b: number, px: number): number => clamp01((t - a) / px + 0.5) * clamp01((b - t) / px + 0.5);

/** Paper ground: fine fibres and faint mottling around `base`. */
function paperGround(N: number, rng: Rng, base: number): Field {
  const L = field(N, base);
  addFbm(L, N, 4, 4, 3, 0.025, nextSeed(rng));
  addNoise(L, N, 160, 160, 0.012, nextSeed(rng));
  return L;
}

/** Regency stripes: a wide satin band, a pair of pinstripes and paper grain, four repeats per tile. */
function drawWallpaperStripes(ctx: CanvasRenderingContext2D, N: number, rng: Rng): void {
  const L = paperGround(N, rng, 0.92);
  addNoise(L, N, 6, 120, 0.015, nextSeed(rng)); // vertical print streaks
  const px = 4 / N;
  for (let y = 0, i = 0; y < N; y++) {
    for (let x = 0; x < N; x++, i++) {
      const t = fract(((x + 0.5) / N) * 4);
      L[i] -= 0.11 * band(t, 0.04, 0.42, px) + 0.16 * band(t, 0.5, 0.515, px) + 0.16 * band(t, 0.545, 0.56, px);
    }
  }
  putGray(ctx, N, L);
}

/** Damask: large mirrored medallions inside an ogee frame, with scrolls and leaves, in a half-drop repeat. */
function drawWallpaperDamask(ctx: CanvasRenderingContext2D, N: number, rng: Rng): void {
  const L = paperGround(N, rng, 0.83);
  const centres: [number, number][] = [
    [0.25, 0.25],
    [0.75, 0.75],
  ];
  const pw = 1 / N;
  const fill = (d: number) => clamp01(d / pw + 0.5);
  const stroke = (d: number, w: number) => clamp01((w - Math.abs(d)) / pw + 0.5);
  for (let y = 0, i = 0; y < N; y++) {
    for (let x = 0; x < N; x++, i++) {
      const u = (x + 0.5) / N;
      const v = (y + 0.5) / N;
      let motif = 0;
      let line = 0;
      for (const [cx, cy] of centres) {
        let dx = u - cx;
        let dy = v - cy;
        dx -= Math.round(dx);
        dy -= Math.round(dy);
        const ax = Math.abs(dx);
        // Ogee frame: a pointed oval ring round each medallion.
        const ox = ax + 0.06 * Math.abs(dy);
        const og = Math.hypot(ox / 0.25, dy / 0.36) - 1;
        motif = Math.max(motif, stroke(og * 0.22, 0.007));
        // Central rosette with petals and a tall finial and stem.
        const r = Math.hypot(ax * 1.25, dy);
        const th = Math.atan2(ax * 1.25, dy);
        const rose = 0.12 + 0.035 * Math.cos(6 * th) + 0.02 * Math.cos(12 * th) - r;
        motif = Math.max(motif, fill(rose));
        line = Math.max(line, stroke(rose, pw * 1.1));
        const finial = 0.03 * Math.exp(-Math.pow((dy + 0.2) / 0.06, 2)) + 0.012 - ax;
        if (dy < -0.08 && dy > -0.3) motif = Math.max(motif, fill(finial));
        if (dy > 0.08 && dy < 0.28) motif = Math.max(motif, fill(0.01 - ax));
        // Curling scrolls either side, top and bottom.
        for (const sy of [-0.15, 0.15]) {
          const rd = Math.hypot(ax - 0.15, dy - sy) - 0.06;
          const open = Math.atan2(dy - sy, ax - 0.15) * Math.sign(sy);
          if (open > -2.4) motif = Math.max(motif, stroke(rd, 0.012));
          motif = Math.max(motif, fill(0.022 - Math.hypot(ax - 0.12, dy - sy * 0.7)));
        }
        // Leaves between the frames.
        const lx = ax - 0.36;
        const leaf = Math.hypot(lx * 1.6, dy) - 0.06 * (0.6 + 0.4 * Math.cos(2 * Math.atan2(dy, lx)));
        motif = Math.max(motif, fill(-leaf));
      }
      L[i] += 0.1 * motif - 0.07 * line;
    }
  }
  putGray(ctx, N, L);
}

/** Fish-scale lookup: the scale on top at (u, v) in tile units with `cols` scales per row. */
function scaleAt(u: number, v: number, cols: number): { i: number; j: number; r: number; a: number } {
  const s = 1 / cols;
  const rows = cols * 2;
  const row = Math.floor(v * rows);
  let best = { i: 0, j: 0, r: 2, a: 0 };
  let bestY = -Infinity;
  for (let dr = 0; dr <= 2; dr++) {
    const j = row + dr;
    const cy = j / rows;
    const off = mod(j, 2) ? s / 2 : 0;
    const ic = Math.round((u - off) / s);
    for (const di of [-1, 0, 1]) {
      const cx = (ic + di) * s + off;
      const dx = u - cx;
      const dy = v - cy;
      const r = Math.hypot(dx, dy) / (s * 0.5);
      // Each scale shows its upper half; lower rows are laid over the rows above.
      if (r < 1 && dy <= 0 && cy > bestY) {
        bestY = cy;
        best = { i: mod(ic + di, cols), j: mod(j, rows), r, a: Math.atan2(dx, -dy) };
      }
    }
  }
  return best;
}

/** Art-deco fans: overlapping scallops with concentric arcs and radiating ribs. */
function drawWallpaperDeco(ctx: CanvasRenderingContext2D, N: number, rng: Rng): void {
  const L = paperGround(N, rng, 0.9);
  const cols = 4;
  const pw = (2 * cols) / N;
  for (let y = 0, i = 0; y < N; y++) {
    for (let x = 0; x < N; x++, i++) {
      const sc = scaleAt((x + 0.5) / N, (y + 0.5) / N, cols);
      if (sc.r > 1) continue;
      const arcs = Math.abs(fract(sc.r * 4) - 0.5);
      const ribs = Math.abs(fract((sc.a / Math.PI) * 6 + 0.5) - 0.5) * sc.r;
      const rim = 1 - smoothstep(0, pw * 1.5, 1 - sc.r);
      const arcLine = (1 - smoothstep(0, pw * 1.3, 0.5 - arcs)) * smoothstep(0.25, 0.3, sc.r);
      const ribLine = (1 - smoothstep(0, pw, ribs)) * smoothstep(0.2, 0.35, sc.r) * (sc.r < 0.75 ? 1 : 0);
      L[i] -= 0.17 * arcLine + 0.12 * ribLine + 0.2 * rim;
    }
  }
  putGray(ctx, N, L);
}

/** Grasscloth: horizontal plant fibres with slubs over fine vertical weft threads. */
function drawWallpaperGrasscloth(ctx: CanvasRenderingContext2D, N: number, rng: Rng): void {
  const L = field(N, 0.86);
  addNoise(L, N, 3, 90, 0.07, nextSeed(rng));
  addNoise(L, N, 8, 180, 0.04, nextSeed(rng));
  addFbm(L, N, 2, 6, 2, 0.04, nextSeed(rng));
  const slub = noiseField(N, 6, 48, nextSeed(rng));
  for (let y = 0, i = 0; y < N; y++) {
    for (let x = 0; x < N; x++, i++) {
      const weft = Math.abs(fract(((x + 0.5) / N) * 64) - 0.5) < 0.08 ? 0.035 : 0;
      L[i] += (slub[i] > 0.55 ? (slub[i] - 0.55) * 0.25 : 0) - weft;
    }
  }
  putGray(ctx, N, L);
}

type Rgb3 = [number, number, number];
const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Tropical leaves (banana and palm-like) in greens on a warm cream ground. */
function drawWallpaperBotanical(ctx: CanvasRenderingContext2D, N: number, rng: Rng): void {
  const ground: Rgb = [0.94, 0.92, 0.85];
  const f = rgbField(N, ground);
  const tex = fbmField(N, 5, 5, 3, nextSeed(rng));
  for (let i = 0; i < N * N; i++) {
    const k = 1 + 0.025 * tex[i];
    f.r[i] *= k;
    f.g[i] *= k;
    f.b[i] *= k;
  }
  const greens: Rgb[] = [
    [0.16, 0.36, 0.25],
    [0.26, 0.48, 0.3],
    [0.42, 0.6, 0.38],
    [0.2, 0.42, 0.36],
  ];
  for (let k = 0; k < 16; k++) {
    const cx = rng() * N;
    const cy = rng() * N;
    const len = N * range(rng, 0.22, 0.36);
    const wid = len * range(rng, 0.2, 0.34);
    const ang = rng() * TAU;
    const col = greens[Math.floor(rng() * greens.length)];
    const dark = mixRgb(col, [0.05, 0.15, 0.1], 0.35);
    const light = mixRgb(col, [0.85, 0.92, 0.7], 0.35);
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const splits = rng() < 0.5;
    const R = len + 2;
    forBox(N, cx - R, cy - R, cx + R, cy + R, (i, px, py) => {
      const dx = px - cx;
      const dy = py - cy;
      const lx = dx * ca + dy * sa; // along the leaf, 0 at the stalk
      const ly = -dx * sa + dy * ca;
      if (lx < 0 || lx > len) return;
      const t = lx / len;
      const hw = wid * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05)), 0.75);
      const edge = hw - Math.abs(ly);
      if (edge < -0.5) return;
      // Tears from the margin towards the midrib (banana leaves).
      if (splits && Math.abs(ly) > hw * 0.25 && Math.abs(fract((lx + Math.abs(ly) * 0.7) / (len * 0.12)) - 0.5) < 0.04) return;
      let c: Rgb3 = [col[0], col[1], col[2]];
      if (Math.abs(fract((lx + Math.abs(ly) * 0.8) / (len * 0.06)) - 0.5) < 0.08) c = mixRgb(c, dark, 0.35);
      if (Math.abs(ly) < Math.max(0.8, hw * 0.05)) c = mixRgb(c, light, 0.7);
      blend(f, i, c, cover(edge));
    });
  }
  putRgb(ctx, N, f);
}

/** Ditsy floral: small five-petal flowers with leaf pairs scattered on a soft ground. */
function drawWallpaperFloral(ctx: CanvasRenderingContext2D, N: number, rng: Rng): void {
  const ground: Rgb = [0.93, 0.91, 0.86];
  const f = rgbField(N, ground);
  const petals: Rgb[] = [
    [0.86, 0.55, 0.58],
    [0.96, 0.95, 0.93],
    [0.78, 0.66, 0.84],
    [0.95, 0.78, 0.5],
  ];
  const leaf: Rgb = [0.45, 0.58, 0.42];
  const eye: Rgb = [0.93, 0.76, 0.3];
  for (let k = 0; k < 46; k++) {
    const cx = rng() * N;
    const cy = rng() * N;
    const r = N * range(rng, 0.018, 0.03);
    const col = petals[Math.floor(rng() * petals.length)];
    const rot = rng() * TAU;
    for (const s of [-1, 1]) {
      const la = rot + s * 1.9;
      const lx0 = cx + Math.cos(la) * r * 1.4;
      const ly0 = cy + Math.sin(la) * r * 1.4;
      forBox(N, lx0 - r, ly0 - r, lx0 + r, ly0 + r, (i, px, py) => {
        const dx = px - lx0;
        const dy = py - ly0;
        const a = dx * Math.cos(la) + dy * Math.sin(la);
        const b = -dx * Math.sin(la) + dy * Math.cos(la);
        blend(f, i, leaf, cover(r * 0.9 - Math.hypot(a, b * 2.4)));
      });
    }
    const R = r * 1.2;
    forBox(N, cx - R, cy - R, cx + R, cy + R, (i, px, py) => {
      const dx = px - cx;
      const dy = py - cy;
      const rr = Math.hypot(dx, dy);
      const th = Math.atan2(dy, dx) - rot;
      blend(f, i, col, cover(r * (0.62 + 0.38 * Math.abs(Math.cos((5 * th) / 2))) - rr));
      blend(f, i, eye, cover(r * 0.22 - rr));
    });
  }
  putRgb(ctx, N, f);
}

// ---------------------------------------------------------------------------
// Floors and tiles
// ---------------------------------------------------------------------------

/** Encaustic cement tiles (gạch bông): an eight-fold star, a ring and corner circles, 2 × 2 tiles. */
function drawCementTile(ctx: CanvasRenderingContext2D, N: number, rng: Rng): void {
  const cream: Rgb = [0.92, 0.89, 0.81];
  const navy: Rgb = [0.17, 0.26, 0.35];
  const terra: Rgb = [0.71, 0.38, 0.27];
  const sage: Rgb = [0.5, 0.6, 0.5];
  const grout: Rgb = [0.62, 0.6, 0.56];
  const f = rgbField(N, cream);
  const mottle = fbmField(N, 6, 6, 4, nextSeed(rng));
  const pw = 4 / N; // one pixel in tile-local units (2 tiles across, local −1…1)
  for (let y = 0, i = 0; y < N; y++) {
    for (let x = 0; x < N; x++, i++) {
      const a = fract(((x + 0.5) / N) * 2) * 2 - 1;
      const b = fract(((y + 0.5) / N) * 2) * 2 - 1;
      let ax = Math.abs(a);
      let ay = Math.abs(b);
      if (ay > ax) [ax, ay] = [ay, ax];
      const r = Math.hypot(ax, ay);
      const th = Math.atan2(ay, ax);
      // Corner quarter circles (whole circles where four tiles meet).
      const corner = Math.hypot(1 - ax, 1 - ay);
      blend(f, i, navy, cover((0.42 - corner) / pw));
      blend(f, i, cream, cover((0.3 - corner) / pw));
      blend(f, i, terra, cover((0.18 - corner) / pw));
      // Ring, petals on the diagonals, star in the middle.
      blend(f, i, navy, cover((0.035 - Math.abs(r - 0.66)) / pw));
      const pa = ax - 0.47;
      const pb = ay - 0.47;
      blend(f, i, sage, cover((0.16 - Math.hypot((pa + pb) * 0.75, (pa - pb) * 1.6)) / pw));
      blend(f, i, navy, cover((0.3 + 0.12 * Math.cos(8 * th) - r) / pw));
      blend(f, i, terra, cover((0.12 - r) / pw));
      // Border line just inside the tile edge, grout, cement mottling.
      blend(f, i, navy, cover((0.025 - Math.abs(ax - 0.93)) / pw) * (ay < 0.93 ? 1 : 0));
      blend(f, i, grout, cover((ax - 0.985) / pw));
      const m = 1 + 0.045 * mottle[i];
      f.r[i] *= m;
      f.g[i] *= m;
      f.b[i] *= m;
    }
  }
  putRgb(ctx, N, f);
}

/** Simple parallel grain for parquet blocks: streaks across `t` (0–1 across the block). */
const blockGrain = (t: number, seed: number, along: number): number =>
  0.04 * Math.sin(TAU * (t * (6 + 4 * hash2(seed, 1, 7)) + 0.6 * Math.sin(TAU * along + seed))) + 0.025 * Math.sin(TAU * t * 23 + seed * 3.1);

/** Chevron parquet: planks cut at 45° meeting on the centre line of each of four columns. */
function drawChevron(ctx: CanvasRenderingContext2D, N: number, rng: Rng): void {
  const L = field(N);
  const seed = nextSeed(rng) % 9973;
  const fine = fbmField(N, 6, 60, 2, nextSeed(rng));
  const cols = 4;
  const rows = 8;
  const pw = 1 / N;
  for (let y = 0, i = 0; y < N; y++) {
    const v = (y + 0.5) / N;
    for (let x = 0; x < N; x++, i++) {
      const u = (x + 0.5) / N;
      const c = Math.floor(u * cols);
      const lu = u * cols - c; // 0…1 across the column
      const m = Math.abs(lu - 0.5) / cols; // distance from the column centre, tile units
      const side = lu < 0.5 ? 0 : 1;
      const q = (v + m) * rows;
      const k = Math.floor(q);
      const across = q - k;
      const id = (c * 31 + mod(k, rows) * 7 + side * 3 + seed) | 0;
      let l = 0.83 + (hash2(id, 3, seed) - 0.5) * 0.12 + blockGrain(across, id, m * cols) + 0.02 * fine[i];
      l *= 0.62 + 0.38 * smoothstep(0, pw * 1.2, Math.min(across, 1 - across) / rows);
      l *= 0.6 + 0.4 * smoothstep(0, pw * 1.2, m);
      l *= 0.6 + 0.4 * smoothstep(0, pw * 1.2, Math.min(lu, 1 - lu) / cols);
      L[i] = l;
    }
  }
  putGray(ctx, N, L);
}

/** Basketweave parquet: squares of three planks alternating direction, 4 × 4 squares per tile. */
function drawParquetBasket(ctx: CanvasRenderingContext2D, N: number, rng: Rng): void {
  const L = field(N);
  const seed = nextSeed(rng) % 9973;
  const fine = fbmField(N, 30, 30, 2, nextSeed(rng));
  const S = 4;
  const pw = 1 / N;
  for (let y = 0, i = 0; y < N; y++) {
    for (let x = 0; x < N; x++, i++) {
      const a = ((x + 0.5) / N) * S;
      const b = ((y + 0.5) / N) * S;
      const ci = Math.floor(a);
      const cj = Math.floor(b);
      const fa = a - ci;
      const fb = b - cj;
      const vertical = (ci + cj) % 2 === 0;
      const across = (vertical ? fa : fb) * 3;
      const along = vertical ? fb : fa;
      const k = Math.floor(across);
      const t = across - k;
      const id = (ci * 13 + cj * 17 + k * 5 + seed) | 0;
      let l = 0.83 + (hash2(id, 9, seed) - 0.5) * 0.12 + blockGrain(t, id, along) + 0.015 * fine[i];
      l *= 0.62 + 0.38 * smoothstep(0, pw * 1.2, Math.min(t, 1 - t) / (3 * S));
      l *= 0.58 + 0.42 * smoothstep(0, pw * 1.2, Math.min(fa, 1 - fa, fb, 1 - fb) / S);
      L[i] = l;
    }
  }
  putGray(ctx, N, L);
}

/** Rustic square terracotta (Bát Tràng style): fired-clay mottling, darker fired edges, sunken grout. */
function drawTerracottaTile(ctx: CanvasRenderingContext2D, N: number, rng: Rng): void {
  const L = field(N);
  const seed = nextSeed(rng) % 9973;
  const mottle = fbmField(N, 8, 8, 4, nextSeed(rng));
  const pits = noiseField(N, 90, 90, nextSeed(rng));
  const S = 4;
  const pw = 1 / N;
  for (let y = 0, i = 0; y < N; y++) {
    for (let x = 0; x < N; x++, i++) {
      const a = ((x + 0.5) / N) * S;
      const b = ((y + 0.5) / N) * S;
      const ci = Math.floor(a);
      const cj = Math.floor(b);
      const e = Math.min(a - ci, ci + 1 - a, b - cj, cj + 1 - b) / S; // distance to the tile edge
      const tone = (hash2(mod(ci, S) + seed, mod(cj, S), 11) - 0.5) * 0.14;
      let l = 0.84 + tone + 0.06 * mottle[i] - 0.06 * (1 - smoothstep(0, 0.02, e)) - (pits[i] > 0.7 ? (pits[i] - 0.7) * 0.4 : 0);
      if (e < 0.008) l = 0.62 + 0.03 * mottle[i];
      else l *= 0.75 + 0.25 * smoothstep(0.008, 0.008 + pw * 1.5, e);
      L[i] = l;
    }
  }
  putGray(ctx, N, L);
}

/** Fish-scale (scallop) glazed tiles with pooled glaze, per-tile shade and grout. */
function drawFishscale(ctx: CanvasRenderingContext2D, N: number, rng: Rng): void {
  const L = field(N);
  const seed = nextSeed(rng) % 9973;
  const cols = 6;
  const pw = (2 * cols) / N;
  for (let y = 0, i = 0; y < N; y++) {
    for (let x = 0; x < N; x++, i++) {
      const sc = scaleAt((x + 0.5) / N, (y + 0.5) / N, cols);
      if (sc.r > 1) {
        L[i] = 0.68;
        continue;
      }
      const tone = (hash2(sc.i + seed, sc.j, 5) - 0.5) * 0.12;
      const pool = 0.06 * (1 - sc.r) - 0.05 * Math.pow(sc.r, 6);
      const grout = 1 - smoothstep(0, pw * 1.6, 1 - sc.r);
      L[i] = (0.86 + tone + pool) * (1 - grout) + 0.68 * grout;
    }
  }
  putGray(ctx, N, L);
}

/** Penny-round mosaic: small round tiles in staggered rows, 12 across, with grout. */
function drawPenny(ctx: CanvasRenderingContext2D, N: number, rng: Rng): void {
  const L = field(N);
  const seed = nextSeed(rng) % 9973;
  const cols = 12;
  const rows = 14;
  const rad = 0.46 / cols;
  const pw = 1 / N;
  for (let y = 0, i = 0; y < N; y++) {
    const v = (y + 0.5) / N;
    for (let x = 0; x < N; x++, i++) {
      const u = (x + 0.5) / N;
      const row = Math.floor(v * rows);
      let best = 1;
      let bi = 0;
      let bj = 0;
      for (let dr = -1; dr <= 1; dr++) {
        const j = row + dr;
        const off = mod(j, 2) ? 0.5 / cols : 0;
        const cy = (j + 0.5) / rows;
        const ci = Math.round((u - off) * cols - 0.5);
        for (let di = -1; di <= 1; di++) {
          const cx = (ci + di + 0.5) / cols + off;
          const d = Math.hypot(wrapDist(u, cx, 1), wrapDist(v, cy, 1)) / rad;
          if (d < best) {
            best = d;
            bi = mod(ci + di, cols);
            bj = mod(j, rows);
          }
        }
      }
      const tone = (hash2(bi + seed, bj, 13) - 0.5) * 0.14;
      const inside = smoothstep(0, (pw * 1.3) / rad, 1 - best);
      L[i] = 0.66 * (1 - inside) + (0.87 + tone + 0.05 * (1 - best)) * inside;
    }
  }
  putGray(ctx, N, L);
}

// ---------------------------------------------------------------------------
// Wall and furniture finishes
// ---------------------------------------------------------------------------

/** Limewash: cloudy, crossing brush strokes with soft chalky variation. */
function drawLimewash(ctx: CanvasRenderingContext2D, N: number, rng: Rng): void {
  const L = field(N, 0.86);
  addFbm(L, N, 2, 2, 4, 0.09, nextSeed(rng), 0.55);
  const h = noiseField(N, 26, 5, nextSeed(rng));
  const v = noiseField(N, 5, 26, nextSeed(rng));
  const mask = fbmField(N, 3, 3, 2, nextSeed(rng));
  addNoise(L, N, 120, 120, 0.01, nextSeed(rng));
  for (let i = 0; i < N * N; i++) {
    const t = smoothstep(-0.3, 0.3, mask[i]);
    L[i] += 0.035 * (h[i] * t + v[i] * (1 - t));
  }
  putGray(ctx, N, L);
}

/** Venetian (polished) plaster: soft cloudy marbling with burnished lighter veils. */
function drawVenetian(ctx: CanvasRenderingContext2D, N: number, rng: Rng): void {
  const L = field(N, 0.87);
  const warp = fbmField(N, 3, 3, 4, nextSeed(rng), 0.55);
  const cloud = fbmField(N, 4, 4, 4, nextSeed(rng));
  for (let i = 0; i < N * N; i++) {
    const vein = 1 - smoothstep(0, 0.06, Math.abs(fract(warp[i] * 2.5) - 0.5) - 0.38);
    L[i] += 0.05 * cloud[i] + 0.04 * vein - 0.02 * warp[i];
  }
  putGray(ctx, N, L);
}

/** Fluted (reeded) panel: twelve vertical rounded flutes with shadowed joints and faint grain. */
function drawFluted(ctx: CanvasRenderingContext2D, N: number, rng: Rng): void {
  const L = field(N);
  const grain = fbmField(N, 48, 4, 2, nextSeed(rng));
  const flutes = 12;
  for (let y = 0, i = 0; y < N; y++) {
    for (let x = 0; x < N; x++, i++) {
      const shade = Math.sin(Math.PI * fract(((x + 0.5) / N) * flutes));
      L[i] = 0.62 + 0.32 * Math.pow(shade, 0.7) + 0.02 * grain[i];
    }
  }
  putGray(ctx, N, L);
}

/** Wood slat panel: eight vertical slats with grain over dark felt gaps (acoustic panels, screens). */
function drawWoodSlats(ctx: CanvasRenderingContext2D, N: number, rng: Rng): void {
  const L = field(N);
  const seed = nextSeed(rng) % 9973;
  const grain = fbmField(N, 60, 3, 3, nextSeed(rng));
  const slats = 8;
  const gap = 0.16;
  const pw = 1 / N;
  for (let y = 0, i = 0; y < N; y++) {
    for (let x = 0; x < N; x++, i++) {
      const a = ((x + 0.5) / N) * slats;
      const k = Math.floor(a);
      const t = a - k;
      if (t > 1 - gap) {
        L[i] = 0.3;
        continue;
      }
      const tw = t / (1 - gap);
      const id = k + seed;
      let l = 0.86 + (hash2(id, 4, seed) - 0.5) * 0.1 + 0.05 * grain[i] + blockGrain(tw, id, (y + 0.5) / N) * 0.6;
      l *= 0.8 + 0.2 * smoothstep(0, (pw * slats) / (1 - gap), Math.min(tw, 1 - tw));
      L[i] = l;
    }
  }
  putGray(ctx, N, L);
}

/** Rattan cane webbing: horizontal, vertical and two diagonal strands round open octagons. */
function drawCane(ctx: CanvasRenderingContext2D, N: number, rng: Rng): void {
  const L = field(N);
  const fibre = noiseField(N, 64, 64, nextSeed(rng));
  const cells = 8;
  const strand = (d: number, w: number): number => (d < w ? 0.74 + 0.22 * Math.cos(((Math.PI / 2) * d) / w) : 0);
  for (let y = 0, i = 0; y < N; y++) {
    for (let x = 0; x < N; x++, i++) {
      const u = fract(((x + 0.5) / N) * cells);
      const v = fract(((y + 0.5) / N) * cells);
      const dH = Math.abs(v - Math.round(v));
      const dV = Math.abs(u - Math.round(u));
      const dD1 = Math.abs(fract(u + v + 0.5) - 0.5) / Math.SQRT2;
      const dD2 = Math.abs(fract(u - v + 0.5) - 0.5) / Math.SQRT2;
      const s = Math.max(strand(dH, 0.17), strand(dV, 0.17), strand(dD1, 0.1) * 0.98, strand(dD2, 0.1) * 0.96);
      L[i] = s > 0 ? s + 0.03 * fibre[i] : 0.4;
    }
  }
  putGray(ctx, N, L);
}

// ---------------------------------------------------------------------------
// More tiles, wallpapers and metal (2026-10-22)
// ---------------------------------------------------------------------------

/**
 * Vietnamese "hoa" gạch bông: a red four-petal flower with a gold eye, green leaves on the
 * diagonals, blue rings round the corners (whole circles where four tiles meet), 2 × 2 tiles.
 */
function drawCementLotus(ctx: CanvasRenderingContext2D, N: number, rng: Rng): void {
  const cream: Rgb = [0.93, 0.9, 0.82];
  const red: Rgb = [0.7, 0.27, 0.23];
  const pink: Rgb = [0.86, 0.55, 0.47];
  const green: Rgb = [0.34, 0.49, 0.37];
  const blue: Rgb = [0.2, 0.32, 0.47];
  const gold: Rgb = [0.86, 0.66, 0.3];
  const grout: Rgb = [0.62, 0.6, 0.56];
  const f = rgbField(N, cream);
  const mottle = fbmField(N, 6, 6, 4, nextSeed(rng));
  const pw = 4 / N;
  for (let y = 0, i = 0; y < N; y++) {
    for (let x = 0; x < N; x++, i++) {
      const a = fract(((x + 0.5) / N) * 2) * 2 - 1;
      const b = fract(((y + 0.5) / N) * 2) * 2 - 1;
      const ax = Math.abs(a);
      const ay = Math.abs(b);
      const r = Math.hypot(a, b);
      const c2 = Math.abs(Math.cos(2 * Math.atan2(b, a)));
      // Corner rings and gold dots.
      const corner = Math.hypot(1 - ax, 1 - ay);
      blend(f, i, blue, cover((0.36 - corner) / pw));
      blend(f, i, cream, cover((0.29 - corner) / pw));
      blend(f, i, gold, cover((0.13 - corner) / pw));
      // Leaves on the diagonals.
      const p = (ax + ay) / Math.SQRT2;
      const q = (ax - ay) / Math.SQRT2;
      const leaf = 1 - Math.hypot((p - 0.7) / 0.17, q / 0.075);
      blend(f, i, green, cover((leaf * 0.075) / pw));
      blend(f, i, cream, cover((0.008 - Math.abs(q)) / pw) * (p > 0.56 && p < 0.84 ? 1 : 0));
      // Flower: outer red petals, pink inner petals, gold eye.
      blend(f, i, red, cover((0.16 + 0.34 * Math.pow(c2, 1.6) - r) / pw));
      blend(f, i, pink, cover((0.1 + 0.17 * Math.pow(c2, 1.6) - r) / pw));
      blend(f, i, gold, cover((0.075 - r) / pw));
      // Blue border line, grout, cement mottling.
      const m = Math.max(ax, ay);
      blend(f, i, blue, cover((0.022 - Math.abs(m - 0.92)) / pw) * (Math.min(ax, ay) < 0.7 ? 1 : 0));
      blend(f, i, grout, cover((m - 0.985) / pw));
      const k = 1 + 0.045 * mottle[i];
      f.r[i] *= k;
      f.g[i] *= k;
      f.b[i] *= k;
    }
  }
  putRgb(ctx, N, f);
}

/**
 * Two-tone encaustic tile (tinted by the material colour): an eight-point star with a light
 * centre, diamonds that meet across the joints, corner discs and a fine border, 2 × 2 tiles.
 */
function drawCementStar(ctx: CanvasRenderingContext2D, N: number, rng: Rng): void {
  const L = field(N);
  const mottle = fbmField(N, 6, 6, 4, nextSeed(rng));
  const pw = 4 / N;
  const ground = 0.92;
  const ink = 0.5;
  const mid = 0.72;
  for (let y = 0, i = 0; y < N; y++) {
    for (let x = 0; x < N; x++, i++) {
      const a = fract(((x + 0.5) / N) * 2) * 2 - 1;
      const b = fract(((y + 0.5) / N) * 2) * 2 - 1;
      let ax = Math.abs(a);
      let ay = Math.abs(b);
      if (ay > ax) [ax, ay] = [ay, ax];
      const r = Math.hypot(ax, ay);
      let l = ground;
      const paint = (v: number, d: number) => {
        const t = cover(d / pw);
        l += (v - l) * t;
      };
      paint(ink, 0.36 - Math.max(ax, ay)); // square
      paint(ink, 0.36 - (ax + ay) / Math.SQRT2); // square turned 45° → star
      paint(ground, 0.17 - r);
      paint(ink, 0.065 - r);
      paint(ink, 0.3 - (1 - ax + ay)); // joint diamonds
      paint(mid, 0.2 - Math.hypot(1 - ax, 1 - ay)); // corner discs
      paint(mid, 0.018 - Math.abs(ax - 0.93)); // border
      paint(0.64, ax - 0.985); // grout
      L[i] = l * (1 + 0.04 * mottle[i]);
    }
  }
  putGray(ctx, N, L);
}

/**
 * Two-tone quatrefoil cement tile: four overlapping circles drawn as lines round a lighter
 * clover, linked by quarter circles in the corners, 2 × 2 tiles.
 */
function drawCementQuatrefoil(ctx: CanvasRenderingContext2D, N: number, rng: Rng): void {
  const L = field(N);
  const mottle = fbmField(N, 6, 6, 4, nextSeed(rng));
  const pw = 4 / N;
  const w = 0.045;
  for (let y = 0, i = 0; y < N; y++) {
    for (let x = 0; x < N; x++, i++) {
      const a = fract(((x + 0.5) / N) * 2) * 2 - 1;
      const b = fract(((y + 0.5) / N) * 2) * 2 - 1;
      const ax = Math.abs(a);
      const ay = Math.abs(b);
      const dA = Math.hypot(ax - 0.45, ay) - 0.45;
      const dB = Math.hypot(ax, ay - 0.45) - 0.45;
      const inside = Math.min(dA, dB);
      const corner = Math.hypot(1 - ax, 1 - ay) - 0.5;
      let l = 0.93;
      l += (0.8 - l) * cover(-inside / pw);
      l += (0.8 - l) * cover(-corner / pw);
      const line = Math.min(Math.abs(dA), Math.abs(dB), Math.abs(corner));
      l += (0.48 - l) * cover((w / 2 - line) / pw);
      l += (0.48 - l) * cover((0.07 - Math.hypot(ax, ay)) / pw);
      l += (0.64 - l) * cover((Math.max(ax, ay) - 0.985) / pw);
      L[i] = l * (1 + 0.04 * mottle[i]);
    }
  }
  putGray(ctx, N, L);
}

/** Glazed tiles laid in a 45° herringbone (4:1 tiles), with grout, per-tile shade and glaze pooling. */
function drawTileHerringbone(ctx: CanvasRenderingContext2D, N: number, rng: Rng): void {
  const k = 4;
  const colsX = 2;
  const rowsY = colsX * k;
  const W = N / (colsX * k * Math.SQRT2);
  const blocks = colsX * 2 * rowsY;
  const tone = new Float32Array(blocks);
  const tilt = new Float32Array(blocks);
  for (let b = 0; b < blocks; b++) {
    tone[b] = range(rng, -0.03, 0.03);
    tilt[b] = range(rng, -0.03, 0.03);
  }
  const cloud = fbmField(N, 8, 8, 3, nextSeed(rng));
  const gap = Math.max(0.8, N * 0.003);
  const L = field(N);
  for (let y = 0, i = 0; y < N; y++) {
    const Y = (y + 0.5) / W;
    for (let x = 0; x < N; x++, i++) {
      const X = (x + 0.5) / W;
      const u = (X + Y) / Math.SQRT2;
      const v = (Y - X) / Math.SQRT2;
      const m0 = Math.floor((u - v + k + 1) / (2 * k));
      let s = 0;
      let t = 0;
      let bm = 0;
      let bi = 0;
      let orient = -1;
      for (let c = 0; c < 3 && orient < 0; c++) {
        const m = c === 0 ? m0 : c === 1 ? m0 - 1 : m0 + 1;
        const qu = u - m * k;
        const qv = v + m * k;
        let n = Math.floor(qv);
        if (qu >= n && qu < n + k) {
          s = qu - n;
          t = qv - n;
          bm = m;
          bi = n;
          orient = 0;
          break;
        }
        n = Math.floor(qu);
        if (qv >= n + 1 && qv < n + 1 + k) {
          s = qv - n - 1;
          t = qu - n;
          bm = m;
          bi = n;
          orient = 1;
        }
      }
      const b = (mod(bm, colsX) * 2 + Math.max(orient, 0)) * rowsY + mod(bi, rowsY);
      const e = Math.min(t, 1 - t, s, k - s) * W;
      const face = 0.9 + tone[b] + tilt[b] * (s / k - 0.5) + 0.015 * cloud[i] - 0.07 * (1 - smoothstep(gap, gap * 4, e));
      L[i] = 0.62 + (face - 0.62) * smoothstep(gap * 0.5, gap * 1.3, e);
    }
  }
  putGray(ctx, N, L);
}

/** Ogee trellis wallpaper: two families of wavy lines, half a column apart, touching into an onion lattice. */
function drawWallpaperTrellis(ctx: CanvasRenderingContext2D, N: number, rng: Rng): void {
  const L = paperGround(N, rng, 0.92);
  const cols = 3;
  const rows = 2;
  const amp = 0.25;
  const px = cols / N;
  for (let y = 0, i = 0; y < N; y++) {
    const v = (y + 0.5) / N;
    const s = Math.sin(TAU * v * rows);
    // Slope of the curves in column units per column unit, to keep the line width even.
    const slope = Math.hypot(1, (amp * TAU * rows * Math.cos(TAU * v * rows)) / cols);
    for (let x = 0; x < N; x++, i++) {
      const u = ((x + 0.5) / N) * cols;
      const d1 = Math.abs(fract(u + amp * s) - 0.5);
      const d2 = Math.abs(fract(u - amp * s + 0.5) - 0.5);
      const d = (0.5 - Math.max(d1, d2)) / slope;
      const line = clamp01((0.028 - d) / px + 0.5);
      L[i] -= 0.22 * line;
    }
  }
  putGray(ctx, N, L);
}

/** Fern wallpaper: scattered fronds (a curved stem with tapering paired leaflets) on paper. */
function drawWallpaperFern(ctx: CanvasRenderingContext2D, N: number, rng: Rng): void {
  const L = paperGround(N, rng, 0.93);
  const ink = field(N); // strongest frond per pixel, so overlapping fronds do not darken
  for (let k = 0; k < 14; k++) {
    const cx = rng() * N;
    const cy = rng() * N;
    const len = N * range(rng, 0.24, 0.34);
    const ang = rng() * TAU;
    const bend = range(rng, -0.6, 0.6);
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const shade = range(rng, 0.18, 0.28);
    const R = len * 0.62;
    const ox = cx + (ca * len) / 2;
    const oy = cy + (sa * len) / 2;
    forBox(N, ox - R, oy - R, ox + R, oy + R, (i, px, py) => {
      const dx = px - cx;
      const dy = py - cy;
      const lx = dx * ca + dy * sa;
      let ly = -dx * sa + dy * ca;
      if (lx < -2 || lx > len + 2) return;
      const t = clamp01(lx / len);
      ly -= bend * len * 0.18 * t * t; // the frond curls a little
      const stem = Math.abs(ly) - Math.max(0.5, 1.2 * (1 - t));
      let a = t < 1 ? cover(-stem) : 0;
      // Leaflets: ellipses angled 50° forward from the stem, shrinking towards the tip.
      const spacing = len * 0.075;
      const fy = Math.abs(ly);
      const j0 = Math.round(lx / spacing);
      for (let j = j0 - 1; j <= j0 + 1; j++) {
        if (j < 1 || j * spacing > len * 0.96) continue;
        const ll = len * 0.22 * (1 - 0.75 * ((j * spacing) / len));
        const fx = lx - j * spacing;
        const along = fx * 0.643 + fy * 0.766;
        const across = -fx * 0.766 + fy * 0.643;
        const el = 1 - Math.hypot((along - ll * 0.5) / (ll * 0.5), across / (ll * 0.22));
        a = Math.max(a, cover(el * ll * 0.22));
      }
      ink[i] = Math.max(ink[i], shade * a * (0.85 + 0.15 * t));
    });
  }
  for (let i = 0; i < N * N; i++) L[i] -= ink[i];
  putGray(ctx, N, L);
}

/** Hammered metal: overlapping round hammer dimples (darker hollows, bright ridges). */
function drawHammered(ctx: CanvasRenderingContext2D, N: number, rng: Rng): void {
  const c = worley(N, 12, nextSeed(rng), 0.85);
  const fine = noiseField(N, 200, 200, nextSeed(rng));
  const L = field(N);
  for (let i = 0; i < N * N; i++) {
    const hollow = smoothstep(0, 0.75, c.f1[i]);
    const ridge = 1 - smoothstep(0, 0.12, c.f2[i] - c.f1[i]);
    L[i] = 0.74 + 0.14 * hollow + 0.05 * ridge + 0.008 * fine[i];
  }
  putGray(ctx, N, L);
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const PATTERN_LIST: TexturePattern[] = [
  { id: 'paint', name: 'Paint', normalStrength: 0.25, draw: drawPaint },
  { id: 'plaster', name: 'Trowelled plaster', normalStrength: 0.4, draw: drawPlaster },
  { id: 'concrete', name: 'Board-formed concrete', normalStrength: 0.55, draw: drawConcrete },
  { id: 'brick', name: 'Brick (running bond)', normalStrength: 1, draw: drawBrick },
  { id: 'wood-planks', name: 'Wood planks', normalStrength: 0.45, draw: drawWoodPlanks },
  { id: 'wood-planks-wide', name: 'Wide wood boards', normalStrength: 0.45, draw: drawWoodPlanksWide },
  { id: 'wood-grain', name: 'Wood grain', normalStrength: 0.3, draw: drawWoodGrain },
  { id: 'herringbone', name: 'Herringbone parquet', normalStrength: 0.5, draw: drawHerringbone },
  { id: 'tile-square', name: 'Square tile', normalStrength: 0.8, draw: drawTileSquare },
  { id: 'subway', name: 'Subway tile', normalStrength: 0.8, draw: drawSubway },
  { id: 'hex', name: 'Hexagon tile', normalStrength: 0.85, draw: drawHex },
  { id: 'tile-large', name: 'Large-format tile', normalStrength: 0.7, draw: drawTileLarge },
  { id: 'checker', name: 'Checkerboard tile', normalStrength: 0.4, draw: drawChecker },
  { id: 'terrazzo', name: 'Terrazzo', normalStrength: 0.2, draw: drawTerrazzo },
  { id: 'mosaic', name: 'Mosaic', normalStrength: 0.8, draw: drawMosaic },
  { id: 'marble', name: 'Marble', normalStrength: 0.1, draw: drawMarble },
  { id: 'travertine', name: 'Travertine', normalStrength: 0.5, draw: drawTravertine },
  { id: 'slate', name: 'Cleft slate', normalStrength: 0.6, draw: drawSlate },
  { id: 'granite', name: 'Speckled granite', normalStrength: 0.15, draw: drawGranite },
  { id: 'brushed', name: 'Brushed metal', normalStrength: 0.15, draw: drawBrushed },
  { id: 'weave', name: 'Woven fabric', normalStrength: 0.6, draw: drawWeave },
  { id: 'boucle', name: 'Bouclé', normalStrength: 0.7, draw: drawBoucle },
  { id: 'leather', name: 'Pebbled leather', normalStrength: 0.6, draw: drawLeather },
  { id: 'jute', name: 'Jute basket weave', normalStrength: 0.9, draw: drawJute },
  { id: 'rug-stripes', name: 'Berber stripes', normalStrength: 0.5, draw: drawRugStripes },
  { id: 'rug-geometric', name: 'Geometric rug', normalStrength: 0.35, colored: true, draw: drawRugGeometric },
  { id: 'art', name: 'Abstract art print', normalStrength: 0.05, colored: true, draw: drawArt },
  { id: 'books', name: 'Book spines', normalStrength: 0.4, colored: true, draw: drawBooks },
  // Wallpapers
  { id: 'wallpaper-stripes', name: 'Regency stripe wallpaper', normalStrength: 0.15, draw: drawWallpaperStripes },
  { id: 'wallpaper-damask', name: 'Damask wallpaper', normalStrength: 0.2, draw: drawWallpaperDamask },
  { id: 'wallpaper-deco', name: 'Art deco fan wallpaper', normalStrength: 0.2, draw: drawWallpaperDeco },
  { id: 'wallpaper-grasscloth', name: 'Grasscloth', normalStrength: 0.6, draw: drawWallpaperGrasscloth },
  { id: 'wallpaper-botanical', name: 'Tropical leaf wallpaper', normalStrength: 0.1, colored: true, draw: drawWallpaperBotanical },
  { id: 'wallpaper-floral', name: 'Ditsy floral wallpaper', normalStrength: 0.1, colored: true, draw: drawWallpaperFloral },
  // Floors and tiles
  { id: 'cement-tile', name: 'Encaustic cement tile (gạch bông)', normalStrength: 0.35, colored: true, draw: drawCementTile },
  { id: 'chevron', name: 'Chevron parquet', normalStrength: 0.5, draw: drawChevron },
  { id: 'parquet-basket', name: 'Basketweave parquet', normalStrength: 0.5, draw: drawParquetBasket },
  { id: 'terracotta-tile', name: 'Rustic terracotta tile', normalStrength: 0.8, draw: drawTerracottaTile },
  { id: 'fishscale', name: 'Fish-scale tile', normalStrength: 0.8, draw: drawFishscale },
  { id: 'penny', name: 'Penny-round mosaic', normalStrength: 0.85, draw: drawPenny },
  // Wall and furniture finishes
  { id: 'limewash', name: 'Limewash', normalStrength: 0.3, draw: drawLimewash },
  { id: 'venetian', name: 'Venetian plaster', normalStrength: 0.15, draw: drawVenetian },
  { id: 'fluted', name: 'Fluted panel', normalStrength: 1, draw: drawFluted },
  { id: 'wood-slats', name: 'Wood slat panel', normalStrength: 0.9, draw: drawWoodSlats },
  { id: 'cane', name: 'Rattan cane webbing', normalStrength: 1, draw: drawCane },
  // More tiles, wallpapers and metal (2026-10-22)
  { id: 'cement-tile-lotus', name: 'Flower cement tile (gạch bông hoa)', normalStrength: 0.35, colored: true, draw: drawCementLotus },
  { id: 'cement-tile-star', name: 'Two-tone star cement tile', normalStrength: 0.35, draw: drawCementStar },
  { id: 'cement-tile-quatrefoil', name: 'Two-tone quatrefoil cement tile', normalStrength: 0.35, draw: drawCementQuatrefoil },
  { id: 'tile-herringbone', name: 'Herringbone glazed tile', normalStrength: 0.8, draw: drawTileHerringbone },
  { id: 'wallpaper-trellis', name: 'Ogee trellis wallpaper', normalStrength: 0.15, draw: drawWallpaperTrellis },
  { id: 'wallpaper-fern', name: 'Fern wallpaper', normalStrength: 0.12, draw: drawWallpaperFern },
  { id: 'hammered', name: 'Hammered metal', normalStrength: 0.7, draw: drawHammered },
];

export const TEXTURE_PATTERNS: Record<string, TexturePattern> = Object.fromEntries(
  PATTERN_LIST.map((p) => [p.id, p]),
);

export const TEXTURE_PATTERN_IDS: string[] = PATTERN_LIST.map((p) => p.id);

// ---------------------------------------------------------------------------
// Canvas rendering & caches
// ---------------------------------------------------------------------------

const DEFAULT_TEXTURE_SIZE = 512;
const DEFAULT_URL_SIZE = 128;
/** Converts a luminance gradient (per pixel) into a normal tilt for normalStrength = 1. */
const NORMAL_GAIN = 5;

const baseCache = new Map<string, HTMLCanvasElement>();
const contrastCache = new Map<string, HTMLCanvasElement>();
const normalCache = new Map<string, HTMLCanvasElement>();
const urlCache = new Map<string, string>();
let canvasUnavailable = false;

/** Patterns added by content packs (ids `<pack>:<id>`), kept apart from the built-in set. */
const PACK_PATTERNS = new Map<string, TexturePattern>();

function getPattern(id: string): TexturePattern | undefined {
  return Object.prototype.hasOwnProperty.call(TEXTURE_PATTERNS, id) ? TEXTURE_PATTERNS[id] : PACK_PATTERNS.get(id);
}

/** Built-in or pack pattern by id. */
export const patternInfo = (id: string): TexturePattern | undefined => getPattern(id);

/** Every pattern id: built-in first, then content-pack patterns. */
export const allPatternIds = (): string[] => [...TEXTURE_PATTERN_IDS, ...PACK_PATTERNS.keys()];

/** Replaces the content-pack patterns and drops their cached canvases (packs reload live). */
export function setPackPatterns(list: TexturePattern[]): void {
  PACK_PATTERNS.clear();
  for (const p of list) PACK_PATTERNS.set(p.id, p);
  for (const cache of [baseCache, contrastCache, normalCache, urlCache] as Map<string, unknown>[]) {
    for (const k of [...cache.keys()]) if (k.includes(':')) cache.delete(k);
  }
}

const normSize = (size: number): number =>
  Math.max(1, Math.min(4096, Math.round(Number.isFinite(size) ? size : 0)));
const normContrast = (c: number): number => Math.round(clamp01(Number.isFinite(c) ? c : 1) * 100) / 100;

function createCanvas(size: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (canvasUnavailable || typeof document === 'undefined') return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      canvasUnavailable = true;
      return null;
    }
    return { canvas, ctx };
  } catch {
    canvasUnavailable = true;
    return null;
  }
}

function baseCanvas(pattern: TexturePattern, size: number): HTMLCanvasElement | null {
  const key = `${pattern.id}|${size}`;
  const hit = baseCache.get(key);
  if (hit) return hit;
  const c = createCanvas(size);
  if (!c) return null;
  try {
    pattern.draw(c.ctx, size, mulberry32(hashString(pattern.id)));
  } catch {
    return null;
  }
  baseCache.set(key, c.canvas);
  return c.canvas;
}

function readPixels(canvas: HTMLCanvasElement): Uint8ClampedArray | null {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  try {
    return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  } catch {
    return null;
  }
}

function meanColor(data: Uint8ClampedArray): string {
  let r = 0;
  let g = 0;
  let b = 0;
  const n = data.length / 4;
  for (let j = 0; j < data.length; j += 4) {
    r += data[j];
    g += data[j + 1];
    b += data[j + 2];
  }
  return `rgb(${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)})`;
}

/**
 * Cached canvas for (id, size, contrast). contrast in [0,1] blends the tile
 * toward white (0 = plain white, 1 = full pattern); for colored patterns it
 * blends toward the tile's mean colour. Returns null if canvas 2D is
 * unavailable (e.g. jsdom) or the id is unknown.
 */
export function renderPattern(
  id: string,
  size: number = DEFAULT_TEXTURE_SIZE,
  contrast = 1,
): HTMLCanvasElement | null {
  const pattern = getPattern(id);
  if (!pattern) return null;
  const s = normSize(size);
  const c = normContrast(contrast);
  const base = baseCanvas(pattern, s);
  if (!base || c >= 1) return base;
  const key = `${id}|${s}|${c}`;
  const hit = contrastCache.get(key);
  if (hit) return hit;
  const target = createCanvas(s);
  if (!target) return null;
  let fill = '#ffffff';
  if (pattern.colored) {
    const px = readPixels(base);
    if (px) fill = meanColor(px);
  }
  const { ctx } = target;
  ctx.drawImage(base, 0, 0);
  ctx.globalAlpha = 1 - c;
  ctx.fillStyle = fill;
  // A see-through pattern keeps its holes: blend only over what the tile drew.
  if (pattern.cutout) ctx.globalCompositeOperation = 'source-atop';
  ctx.fillRect(0, 0, s, s);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  contrastCache.set(key, target.canvas);
  return target.canvas;
}

/**
 * Cached tangent-space normal map (RGB, OpenGL convention: +Y up) derived from
 * the pattern's luminance with a wrap-around Sobel filter, scaled by the
 * pattern's normalStrength (dark = recessed). Null if unavailable.
 */
export function renderNormalMap(id: string, size: number = DEFAULT_TEXTURE_SIZE): HTMLCanvasElement | null {
  const pattern = getPattern(id);
  if (!pattern) return null;
  const N = normSize(size);
  const key = `${id}|${N}`;
  const hit = normalCache.get(key);
  if (hit) return hit;
  const base = baseCanvas(pattern, N);
  if (!base) return null;
  const src = readPixels(base);
  if (!src) return null;
  const target = createCanvas(N);
  if (!target) return null;
  const h = new Float32Array(N * N);
  for (let i = 0, j = 0; i < h.length; i++, j += 4) {
    h[i] = (0.299 * src[j] + 0.587 * src[j + 1] + 0.114 * src[j + 2]) / 255;
  }
  const img = target.ctx.createImageData(N, N);
  const d = img.data;
  const k = (pattern.normalStrength * NORMAL_GAIN) / 8;
  for (let y = 0, i = 0; y < N; y++) {
    const ym = ((y - 1 + N) % N) * N;
    const y0 = y * N;
    const yp = ((y + 1) % N) * N;
    for (let x = 0; x < N; x++, i++) {
      const xm = (x - 1 + N) % N;
      const xp = (x + 1) % N;
      const gx = h[ym + xp] + 2 * h[y0 + xp] + h[yp + xp] - h[ym + xm] - 2 * h[y0 + xm] - h[yp + xm];
      const gy = h[yp + xm] + 2 * h[yp + x] + h[yp + xp] - h[ym + xm] - 2 * h[ym + x] - h[ym + xp];
      // Canvas y points down, tangent-space +Y (OpenGL) points up.
      const nx = -gx * k;
      const ny = gy * k;
      const inv = 1 / Math.sqrt(nx * nx + ny * ny + 1);
      const j = i * 4;
      d[j] = (nx * inv * 0.5 + 0.5) * 255;
      d[j + 1] = (ny * inv * 0.5 + 0.5) * 255;
      d[j + 2] = (inv * 0.5 + 0.5) * 255;
      d[j + 3] = 255;
    }
  }
  target.ctx.putImageData(img, 0, 0);
  normalCache.set(key, target.canvas);
  return target.canvas;
}

/** Cached PNG data URL (for SVG <pattern> fills and UI swatches). Null if unavailable. */
export function patternDataUrl(id: string, size: number = DEFAULT_URL_SIZE, contrast = 1): string | null {
  const s = normSize(size);
  const c = normContrast(contrast);
  const key = `${id}|${s}|${c}`;
  const hit = urlCache.get(key);
  if (hit !== undefined) return hit;
  const canvas = renderPattern(id, s, c);
  if (!canvas) return null;
  try {
    const url = canvas.toDataURL('image/png');
    urlCache.set(key, url);
    return url;
  } catch {
    return null;
  }
}

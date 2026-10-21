/**
 * Vietnamese home: content pack.
 *
 * Everyday and festive objects of a Vietnamese home: street-food plastic stools, a motorbike
 * parked in the living room, Tết kumquat and peach blossom, a phin coffee, the thermos-and-tea
 * tray, a folding hammock, a sơn mài painting, a bamboo blind and more.
 *
 * Four procedural patterns give the materials their surface: sơn mài lacquer (gold leaf,
 * eggshell inlay, vermilion lotus on a black/cánh-gián ground), carved gụ wood relief, thổ cẩm
 * brocade and split bamboo slats.
 */
import {
  PLANT_SPECIES,
  circle,
  clamp,
  cyl,
  defineItem,
  definePack,
  frame4,
  lathe,
  leaf,
  lerp,
  line,
  matSlot,
  range,
  rectPoly,
  ring,
  rng,
  rod,
  rodPath,
  rodX,
  rodZ,
  spaced,
  span,
  sphere,
  torus,
  vcyl,
  box,
  type Part,
  type V2,
  type V3,
} from '@/packs/kit';

const TAU = Math.PI * 2;

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------


/** Point on a surface of revolution (axis at x, z) at azimuth `a` (0 = +z, front). */
const onRev = (x: number, z: number, a: number, r: number, y: number): V3 => [x + Math.sin(a) * r, y, z + Math.cos(a) * r];

/**
 * Painted decal (thin ellipsoid) lying on a vertical surface of revolution at azimuth `a`:
 * `w` across, `h` tall, rolled `roll` radians within the surface.
 */
function decal(slot: string, c: V3, a: number, w: number, h: number, roll = 0): Part {
  return sphere(slot, c, 0.5, { scale: [w, h, 0.006], rotation: [0, a, roll], plan: false });
}

/** Small flower decal (centre + petals) on a surface of revolution. */
function flowerDecal(slot: string, ax: number, az: number, a: number, r: number, y: number, m: number, petals = 5): Part[] {
  const parts: Part[] = [decal(slot, onRev(ax, az, a, r, y), a, m, m)];
  const tx = Math.cos(a);
  const tz = -Math.sin(a);
  for (const k of range(petals)) {
    const p = (k / petals) * TAU + 0.3;
    const off = m * 0.95;
    const c = onRev(ax, az, a, r - 0.0008, y + Math.sin(p) * off);
    parts.push(decal(slot, [c[0] + tx * Math.cos(p) * off, c[1], c[2] + tz * Math.cos(p) * off], a, m * 1.15, m * 0.55, p));
  }
  return parts;
}

/** Vietnamese street-food plastic stool (ghế nhựa) with bottom footprint `s`, height `hs`, base at y0. */
function plasticStool(slot: string, x: number, z: number, y0: number, s: number, hs: number, opts: { seat: boolean; legs: boolean }): Part[] {
  const st = s * 0.82;
  const top = y0 + hs;
  const parts: Part[] = [
    span(slot, [x - st / 2 - 0.006, x + st / 2 + 0.006], [top - 0.018, top], [z - st / 2 - 0.006, z + st / 2 + 0.006], { bevel: 0.008 }),
    span(slot, [x - st / 2, x + st / 2], [top - 0.066, top - 0.018], [z - st / 2, z + st / 2], { bevel: 0.006, plan: false }),
  ];
  if (opts.seat) {
    // Oval hand-hole and raised grip ribs moulded into the seat.
    parts.push(ring(slot, [x, top + 0.001, z], st * 0.15, 0.004, { zScale: 0.35, plan: false }));
    for (const k of [-1, 1]) {
      parts.push(span(slot, [x - st * 0.36, x + st * 0.36], [top - 0.002, top + 0.003], [z + k * st * 0.3 - 0.005, z + k * st * 0.3 + 0.005], { plan: false }));
    }
  }
  if (opts.legs) {
    const a = st / 2 - 0.016;
    const b = s / 2 - 0.018;
    for (const [sx, sz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ]) {
      parts.push(rod(slot, [x + sx * a, top - 0.06, z + sz * a], [x + sx * b, y0 + 0.012, z + sz * b], 0.014, { plan: false }));
    }
    // Ground ring joining the feet.
    for (const k of [-1, 1]) {
      parts.push(span(slot, [x - b, x + b], [y0, y0 + 0.022], [z + k * b - 0.008, z + k * b + 0.008], { plan: false }));
      parts.push(span(slot, [x + k * b - 0.008, x + k * b + 0.008], [y0, y0 + 0.022], [z - b, z + b], { plan: false }));
    }
  }
  return parts;
}

// ---------------------------------------------------------------------------
// Pattern helpers (pure maths on a pixel buffer, so every tile wraps seamlessly)
// ---------------------------------------------------------------------------

type RGB = [number, number, number];

/** Integer lattice hash → [0, 1). */
function hash(x: number, y: number, seed: number): number {
  let h = (Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ seed) | 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Seamless value noise with `f` whole lattice cells per tile: returns (u, v) → [0, 1) for u, v in [0, 1). */
function tileNoise(f: number, seed: number): (u: number, v: number) => number {
  const lat = new Float32Array(f * f);
  for (let j = 0; j < f; j++) for (let i = 0; i < f; i++) lat[j * f + i] = hash(i, j, seed);
  return (u, v) => {
    const x = u * f;
    const y = v * f;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const tx = x - x0;
    const ty = y - y0;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const i0 = ((x0 % f) + f) % f;
    const j0 = ((y0 % f) + f) % f;
    const i1 = (i0 + 1) % f;
    const j1 = (j0 + 1) % f;
    return lerp(lerp(lat[j0 * f + i0], lat[j0 * f + i1], sx), lerp(lat[j1 * f + i0], lat[j1 * f + i1], sx), sy);
  };
}

const smooth = (e0: number, e1: number, x: number): number => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const mul = (a: RGB, k: number): RGB => [a[0] * k, a[1] * k, a[2] * k];
const grey = (l: number): RGB => [l, l, l];
/** Signed wrapped distance in tile units, in (-0.5, 0.5]. */
const wrapD = (x: number): number => x - Math.round(x);

/** Fills the tile pixel by pixel; `shade(u, v)` gets pixel-centre coordinates in [0, 1). */
function shadeTile(ctx: CanvasRenderingContext2D, size: number, shade: (u: number, v: number, x: number, y: number) => RGB): void {
  const img = ctx.createImageData(size, size);
  const data = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const c = shade((x + 0.5) / size, (y + 0.5) / size, x, y);
      const i = (y * size + x) * 4;
      data[i] = Math.round(clamp(c[0], 0, 1) * 255);
      data[i + 1] = Math.round(clamp(c[1], 0, 1) * 255);
      data[i + 2] = Math.round(clamp(c[2], 0, 1) * 255);
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** Sơn mài: gold-leaf moon, vermilion lotus and eggshell-inlaid water on black/cánh-gián lacquer. */
function drawSonMai(ctx: CanvasRenderingContext2D, size: number, rand: () => number): void {
  const seed = Math.floor(rand() * 1e9);
  const G = 34;
  const jit = Array.from({ length: G * G }, () => [0.15 + rand() * 0.7, 0.15 + rand() * 0.7] as const);
  const tone = Array.from({ length: G * G }, () => rand());
  const flowers = [
    { x: 0.17, y: 0.5, s: 0.95, wl: 0 },
    { x: 0.42, y: 0.38, s: 1.2, wl: 0 },
    { x: 0.88, y: 0.57, s: 0.85, wl: 0 },
  ];
  const leaves = [
    { x: 0.04, y: 0.73, rx: 0.12, ry: 0.04 },
    { x: 0.62, y: 0.74, rx: 0.13, ry: 0.045 },
    { x: 0.3, y: 0.71, rx: 0.075, ry: 0.028 },
  ];
  // Petals as [sin, cos, length, width, outer?] in drawing order (outer ring first).
  const petals = [
    ...[-1.25, -0.62, 0, 0.62, 1.25].map((a) => [Math.sin(a), Math.cos(a), 0.08, 0.028, 1] as const),
    ...[-0.32, 0.32].map((a) => [Math.sin(a), Math.cos(a), 0.066, 0.022, 0] as const),
  ];
  const water = (u: number) => 0.84 + 0.022 * Math.sin(TAU * 2 * u) + 0.01 * Math.sin(TAU * 5 * u + 1);
  const BLACK: RGB = [0.04, 0.025, 0.018];
  const WING: RGB = [0.3, 0.1, 0.04];
  const GOLD: RGB = [0.9, 0.7, 0.32];
  const EGG: RGB = [0.95, 0.91, 0.82];
  const BURNT: RGB = [0.72, 0.55, 0.34];
  const VERM: RGB = [0.66, 0.11, 0.05];
  const PINK: RGB = [0.95, 0.6, 0.5];
  const LEAF: RGB = [0.36, 0.28, 0.08];
  const waterCol = Float32Array.from({ length: size }, (_, x) => water((x + 0.5) / size));
  for (const f of flowers) f.wl = water(f.x);
  const n3 = tileNoise(3, seed);
  const n9 = tileNoise(9, seed + 1);
  const n14 = tileNoise(14, seed + 2);

  shadeTile(ctx, size, (u, v) => {
    const n = 0.6 * n3(u, v) + 0.4 * n9(u, v);
    let c = mix(BLACK, WING, smooth(0.4, 0.92, n) * 0.85);

    // Eggshell water band: cracked mosaic of shell pieces.
    const wv = Math.abs(wrapD(v - waterCol[Math.min(size - 1, Math.floor(u * size))]));
    if (wv < 0.084 && wv < 0.07 * (0.65 + 0.55 * n14(u, v))) {
      const gx = u * G;
      const gy = v * G;
      const ix = Math.floor(gx);
      const iy = Math.floor(gy);
      let f1 = 9;
      let f2 = 9;
      let id = 0;
      for (let j = -1; j <= 1; j++) {
        for (let i = -1; i <= 1; i++) {
          const cx = ix + i;
          const cy = iy + j;
          const k = (((cy % G) + G) % G) * G + (((cx % G) + G) % G);
          const dx = cx + jit[k][0] - gx;
          const dy = cy + jit[k][1] - gy;
          const dd = dx * dx + dy * dy;
          if (dd < f1) {
            f2 = f1;
            f1 = dd;
            id = k;
          } else if (dd < f2) f2 = dd;
        }
      }
      if (Math.sqrt(f2) - Math.sqrt(f1) > 0.1) {
        const t = tone[id];
        c = mul(t < 0.22 ? BURNT : EGG, 0.86 + 0.14 * t);
      }
    }

    // Lotus leaves with gilded rims and veins.
    for (const l of leaves) {
      const dx = wrapD(u - l.x) / l.rx;
      const dy = wrapD(v - l.y) / l.ry;
      const e = dx * dx + dy * dy;
      if (e < 1) {
        const ang = Math.atan2(dy, dx);
        const vein = Math.abs((((ang * 9) / TAU) % 1 + 1) % 1 - 0.5) > 0.45;
        c = e > 0.86 || vein ? mul(GOLD, 0.85) : mix(LEAF, mul(GOLD, 0.7), Math.sqrt(e) * 0.5);
      }
    }

    // Flowers on gilded stems.
    for (const f of flowers) {
      const dx = wrapD(u - f.x);
      const dy = wrapD(v - f.y);
      if (v > f.y + 0.02 && v < f.wl && Math.abs(dx) < 0.02 && Math.abs(dx - 0.012 * Math.sin((dy / 0.3) * Math.PI)) < 0.0035 * f.s) c = mul(GOLD, 0.75);
      if (Math.abs(dx) > 0.1 * f.s || dy > 0.03 || dy < -0.1 * f.s) continue;
      for (const [sa, ca, L0, W0, deep] of petals) {
        const L = L0 * f.s;
        const along = dx * sa - dy * ca;
        const across = dx * ca + dy * sa;
        const e = ((along - L * 0.55) / (L * 0.5)) ** 2 + (across / (W0 * f.s)) ** 2;
        if (e < 1) {
          const t = clamp(along / L, 0, 1);
          if (deep) c = e > 0.78 ? GOLD : mix(VERM, PINK, t * 0.85);
          else c = e > 0.8 ? GOLD : mix(PINK, EGG, t);
        }
      }
    }

    // Gold-leaf moon, laid as small squares.
    const mdx = wrapD(u - 0.75);
    const mdy = wrapD(v - 0.2);
    const mr = Math.sqrt(mdx * mdx + mdy * mdy);
    if (mr < 0.11) {
      const gu = u * 28;
      const gv = v * 28;
      const seam = Math.min(gu - Math.floor(gu), gv - Math.floor(gv)) < 0.06;
      c = mul(GOLD, (seam ? 0.78 : 0.86) + 0.16 * hash(Math.floor(gu), Math.floor(gv), seed + 3));
    } else if (mr < 0.14) {
      c = mix(c, mul(GOLD, 0.5), (1 - (mr - 0.11) / 0.03) * 0.35);
    }

    // Scattered gold dust (rắc vàng).
    const D = 96;
    const cx = Math.floor(u * D);
    const cy = Math.floor(v * D);
    if (hash(cx, cy, seed + 4) < 0.05) {
      const px = (cx + 0.5) / D;
      const py = (cy + 0.5) / D;
      if ((u - px) ** 2 + (v - py) ** 2 < 0.0022 ** 2) c = GOLD;
    }
    return c;
  });
}

/** Gụ wood carved in relief: rosettes, cloud scrolls and leaves over a stippled ground, with grain. */
function drawGoCarving(ctx: CanvasRenderingContext2D, size: number, rand: () => number): void {
  const seed = Math.floor(rand() * 1e9);
  const N = 2;
  /** Relief height (0 = recessed ground, 1 = carved surface) of one motif cell at (cu, cv) ∈ [-0.5, 0.5). */
  const motif = (cu: number, cv: number): number => {
    const r = Math.sqrt(cu * cu + cv * cv);
    const a = Math.atan2(cv, cu);
    // Eight-petal rosette with incised petal veins, a raised ring and a boss.
    const rp = 0.15 + 0.045 * Math.cos(8 * a);
    let H = 1 - smooth(rp - 0.02, rp, r);
    const pd = Math.abs((((a * 8) / TAU) % 1 + 1) % 1 - 0.5);
    if (r > 0.06 && r < rp - 0.03 && pd > 0.44) H -= 0.45;
    H = Math.max(H, 1 - smooth(0.012, 0.024, Math.abs(r - 0.225)));
    if (r < 0.045) H = 1;
    // Cloud scrolls (vân mây) centred on the cell corners.
    const rc = Math.sqrt((0.5 - Math.abs(cu)) ** 2 + (0.5 - Math.abs(cv)) ** 2);
    H = Math.max(H, 1 - smooth(0.015, 0.027, Math.abs(rc - 0.15)), 1 - smooth(0.012, 0.022, Math.abs(rc - 0.085)));
    if (rc < 0.03) H = 1;
    // Leaves along the diagonals.
    const t = ((Math.abs(cu) + Math.abs(cv)) / Math.SQRT2 - 0.25) / 0.17;
    if (t > 0 && t < 1) {
      const wid = 0.04 * Math.sin(Math.PI * t);
      H = Math.max(H, 1 - smooth(wid - 0.012, wid, Math.abs(Math.abs(cu) - Math.abs(cv)) / Math.SQRT2));
    }
    return clamp(H, 0, 1);
  };
  // Every cell is identical, so evaluate the motif once per cell pixel when the size allows it.
  const cs = size % N === 0 ? size / N : 0;
  const cache = new Float32Array(cs * cs).fill(-1);
  shadeTile(ctx, size, (u, v, x, y) => {
    const cu = ((u * N) % 1) - 0.5;
    const cv = ((v * N) % 1) - 0.5;
    let H: number;
    if (cs) {
      const k = (y % cs) * cs + (x % cs);
      if (cache[k] < 0) cache[k] = motif(cu, cv);
      H = cache[k];
    } else H = motif(cu, cv);
    const stipple = 0.06 * hash(x, y, seed);
    const warp = 0.25 * Math.sin(TAU * (3 * v + 0.3 * Math.sin(TAU * 2 * u))) + 0.12 * Math.sin(TAU * (7 * v + u));
    const grain = Math.sin(TAU * (14 * u + warp));
    const l = lerp(0.42 + stipple, 0.92, H) + 0.05 * grain - 0.8 * H * (1 - H);
    return grey(l);
  });
}

/** Thổ cẩm brocade: stitched bands of lozenges, zigzags and dots in the highland palette. */
function drawThoCam(ctx: CanvasRenderingContext2D, size: number, rand: () => number): void {
  const seed = Math.floor(rand() * 1e9);
  const S = 64;
  const RED: RGB = [0.62, 0.07, 0.09];
  const BLACK: RGB = [0.08, 0.06, 0.07];
  const YEL: RGB = [0.92, 0.68, 0.14];
  const WHITE: RGB = [0.93, 0.89, 0.79];
  const GREEN: RGB = [0.12, 0.46, 0.27];
  const BLUE: RGB = [0.13, 0.25, 0.56];
  const PINK: RGB = [0.86, 0.3, 0.5];
  const stitch = (i: number, j: number): RGB => {
    const alt = j >= 32;
    const r = j % 32;
    if (r < 2 || r === 31) return BLACK;
    if (r === 2 || r === 5 || r === 18) return YEL;
    if (r < 5) return i % 4 === (r === 3 ? 0 : 2) ? WHITE : BLACK;
    if (r < 18) {
      const dy = Math.abs(r - 6 - 5.5) - 0.5;
      const dx = Math.abs((i % 16) - 7.5) - 0.5;
      const m = dx + dy;
      if (m <= 1) return alt ? YEL : WHITE;
      if (m <= 2) return alt ? RED : BLACK;
      if (m <= 4) return YEL;
      if (m === 5) return alt ? WHITE : BLACK;
      if (m === 6) return GREEN;
      if (dx >= 6 && dy <= 1) return alt ? PINK : YEL;
      return alt ? BLACK : RED;
    }
    if (r < 23) {
      const tri = Math.abs((i % 8) - 3.5) - 0.5;
      return Math.round(tri) === r - 19 ? (alt ? WHITE : PINK) : BLACK;
    }
    if (r < 25) return alt ? BLUE : GREEN;
    const dd = Math.abs((i % 6) - 2.5) - 0.5 + Math.abs(r - 25 - 2.5) - 0.5;
    if (dd === 0) return WHITE;
    if (dd === 1) return YEL;
    return RED;
  };
  shadeTile(ctx, size, (u, v) => {
    const gx = u * S;
    const gy = v * S;
    const i = Math.floor(gx);
    const j = Math.floor(gy);
    const fx = gx - i;
    const fy = gy - j;
    let k = (0.78 + 0.22 * Math.sin(Math.PI * fy)) * (0.93 + 0.1 * hash(i, j, seed));
    if (fx < 0.1) k *= 0.86;
    return mul(stitch(i, j), k);
  });
}

/** Split bamboo slats running across the tile, with nodes, fibres and dark gaps. */
function drawNanTre(ctx: CanvasRenderingContext2D, size: number, rand: () => number): void {
  const seed = Math.floor(rand() * 1e9);
  const S = 16;
  const slat = Array.from({ length: S }, () => ({ n1: rand(), n2: rand(), tone: 0.88 + rand() * 0.16 }));
  const n5 = tileNoise(5, seed + 1);
  shadeTile(ctx, size, (u, v, _x, y) => {
    const sv = v * S;
    const j = Math.floor(sv) % S;
    const fy = sv - Math.floor(sv);
    if (fy < 0.07 || fy > 0.93) return grey(0.3);
    const s = slat[j];
    let l = (0.76 + 0.2 * Math.sin((Math.PI * (fy - 0.07)) / 0.86)) * s.tone;
    l *= 0.95 + 0.07 * hash(y, 7, seed) + 0.05 * (n5(u, v) - 0.5);
    for (const p of [s.n1, s.n2]) {
      const du = Math.abs(wrapD(u - p));
      if (du < 0.004) l *= 0.86;
      else if (du < 0.016) l *= 1 + 0.07 * (1 - (du - 0.004) / 0.012);
    }
    return grey(l);
  });
}

// ---------------------------------------------------------------------------
// Living room
// ---------------------------------------------------------------------------




const hammock = defineItem({
  id: 'folding-hammock',
  name: 'Folding net hammock (võng xếp)',
  category: 'living',
  type: 'seating',
  group: 'Living chairs',
  tags: ['hammock', 'vong', 'vong xep', 'folding', 'net', 'nap', 'relax', 'vietnamese', 'steel frame'],
  defaultSize: { w: 2.6, d: 0.8, h: 1.25 },
  minSize: { w: 2.2, d: 0.6, h: 1.0 },
  maxSize: { w: 3.0, d: 1.0, h: 1.5 },
  slots: [
    matSlot('frame', 'Steel frame', 'hammock-frame'),
    matSlot('net', 'Net', 'vong-net'),
    matSlot('cord', 'Cords & caps', 'cord-red'),
  ],
  build: ({ w, d, h }) => {
    const hx = w / 2 - 0.05;
    const fx = w / 2 - 0.45;
    const sx = hx - 0.42;
    const yTop = h - 0.05;
    const yS = h - 0.38;
    const sag = clamp(yS - 0.38, 0.08, 0.32);
    const bedW = Math.min(0.7, d - 0.12);
    const yAt = (x: number) => yS - sag * (1 - (x / sx) ** 2);
    const parts: Part[] = [rodX('frame', -fx, fx, 0.03, 0, 0.026)];
    for (const s of [-1, 1]) {
      const top: V3 = [s * hx, yTop, 0];
      const foot: V3 = [s * fx, 0.05, 0];
      const mid: V3 = [lerp(foot[0], top[0], 0.35), lerp(foot[1], top[1], 0.35), 0];
      parts.push(
        rodZ('frame', s * fx, 0.025, -d / 2 + 0.035, d / 2 - 0.035, 0.022),
        sphere('cord', [s * fx, 0.025, -d / 2 + 0.03], 0.028, { plan: false }),
        sphere('cord', [s * fx, 0.025, d / 2 - 0.03], 0.028, { plan: false }),
        rod('frame', foot, top, 0.024, { plan: false }),
        rod('frame', [s * (fx - 0.4), 0.04, 0], mid, 0.016, { plan: false }),
        sphere('cord', [s * hx, yTop + 0.012, 0], 0.03, { plan: false }),
        torus('frame', [s * (hx - 0.03), yTop - 0.05, 0], 0.025, 0.006, { plan: false }),
      );
      for (const z of spaced(5, -bedW / 2, bedW / 2)) {
        parts.push(rod('cord', [s * (hx - 0.03), yTop - 0.075, 0], [s * sx, yAt(s * sx), z], 0.003, { plan: false }));
      }
    }
    // Sagging net bed, edged with a thicker cord.
    const xs = spaced(9, -sx, sx);
    for (let i = 0; i < xs.length - 1; i++) {
      const a: V3 = [xs[i], yAt(xs[i]), 0];
      const b: V3 = [xs[i + 1], yAt(xs[i + 1]), 0];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      parts.push(
        box('net', [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0], [len + 0.01, 0.01, bedW], {
          rotation: [0, 0, Math.atan2(b[1] - a[1], b[0] - a[0])],
          plan: false,
        }),
      );
    }
    for (const z of [-bedW / 2, bedW / 2]) {
      parts.push(...rodPath('cord', xs.map((x) => [x, yAt(x) + 0.004, z] as V3), 0.007));
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const sx = w / 2 - 0.47;
    const bedW = Math.min(0.7, d - 0.12);
    return [rectPoly(-sx, -bedW / 2, sx, bedW / 2), line([-w / 2 + 0.05, 0], [-sx, 0]), line([sx, 0], [w / 2 - 0.05, 0])];
  },
});

// ---------------------------------------------------------------------------
// Dining & kitchen
// ---------------------------------------------------------------------------

const stoolStack = defineItem({
  id: 'plastic-stool-stack',
  name: 'Plastic stool stack',
  category: 'dining',
  type: 'seating',
  group: 'Stools & benches',
  tags: ['plastic stool', 'ghe nhua', 'stack', 'street food', 'vietnamese', 'red', 'blue', 'low stool', 'via he'],
  defaultSize: { w: 0.62, d: 0.33, h: 0.52 },
  minSize: { w: 0.3, d: 0.3, h: 0.26 },
  maxSize: { w: 1.0, d: 0.4, h: 0.75 },
  slots: [
    matSlot('red', 'Red stools', 'plastic-red'),
    matSlot('blue', 'Blue stools', 'plastic-blue'),
  ],
  build: ({ w, d, h }) => {
    const nS = clamp(Math.floor(w / 0.3), 1, 3);
    const cw = w / nS;
    const s = Math.min(cw, d) - 0.01;
    const hs = Math.min(h, 0.27);
    const extra = h - hs;
    const n = 1 + clamp(Math.round(extra / 0.045), 0, 10);
    const step = n > 1 ? extra / (n - 1) : 0;
    const parts: Part[] = [];
    for (const k of range(nS)) {
      const x = -w / 2 + cw * (k + 0.5);
      for (const i of range(n)) {
        const slot = nS === 1 ? (i === n - 1 && n > 1 ? 'blue' : 'red') : k % 2 ? 'blue' : 'red';
        parts.push(...plasticStool(slot, x, 0, i * step, s, hs, { seat: i === n - 1, legs: i === 0 }));
      }
    }
    return parts;
  },
});

const lowTable = defineItem({
  id: 'low-plastic-table',
  name: 'Low plastic table with stools',
  category: 'dining',
  type: 'surfaces',
  group: 'Dining tables',
  tags: ['plastic table', 'street food', 'pho', 'iced tea', 'tra da', 'vietnamese', 'stools', 'low table', 'quan an'],
  defaultSize: { w: 1.25, d: 1.25, h: 0.56 },
  minSize: { w: 0.8, d: 0.6, h: 0.45 },
  maxSize: { w: 2.0, d: 1.6, h: 0.68 },
  slots: [
    matSlot('table', 'Table', 'plastic-blue'),
    matSlot('stools', 'Stools', 'plastic-red'),
    matSlot('tableware', 'Bowls & chopsticks', 'ceramic-white'),
    matSlot('glass', 'Iced-tea glasses', 'tra-da'),
  ],
  build: ({ w, d, h }) => {
    const s = 0.29;
    const hs = 0.27;
    const top = h - 0.12;
    const four = d >= 1.05;
    const tw = clamp(w - s * 1.1, 0.45, 1.3);
    const td = four ? clamp(d - s * 1.1, 0.45, 1.0) : clamp(d - 0.02, 0.4, 0.9);
    const parts: Part[] = [
      span('table', [-tw / 2, tw / 2], [top - 0.025, top], [-td / 2, td / 2], { bevel: 0.01 }),
      span('table', [-tw / 2 + 0.02, tw / 2 - 0.02], [top - 0.075, top - 0.025], [-td / 2 + 0.02, td / 2 - 0.02], { plan: false }),
    ];
    const a: V2 = [tw / 2 - 0.05, td / 2 - 0.05];
    const b: V2 = [tw / 2 - 0.03, td / 2 - 0.03];
    for (const [sx, sz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ]) {
      parts.push(rod('table', [sx * a[0], top - 0.07, sz * a[1]], [sx * b[0], 0.02, sz * b[1]], 0.02, { plan: false }));
    }
    for (const k of [-1, 1]) {
      parts.push(rodX('table', -b[0], b[0], 0.05, k * b[1], 0.01, { plan: false }), rodZ('table', k * b[0], 0.05, -b[1], b[1], 0.01, { plan: false }));
    }
    // Stools at the ends (and front/back when deep enough).
    const seats: V2[] = [
      [-(w / 2 - s / 2), 0],
      [w / 2 - s / 2, 0],
    ];
    if (four) seats.push([0, -(d / 2 - s / 2)], [0, d / 2 - s / 2]);
    for (const [x, z] of seats) parts.push(...plasticStool('stools', x, z, 0, s, hs, { seat: true, legs: true }));
    // A street-food spread: bowls with chopsticks, a chopstick cup and glasses of iced tea.
    const nb = tw > 0.7 ? 3 : 2;
    for (const [i, x] of spaced(nb, -tw * 0.28, tw * 0.28).entries()) {
      const z = (i % 2 ? 0.1 : -0.12) * td;
      parts.push(
        lathe('tableware', [x, top, z], [
          [0, 0],
          [0.03, 0],
          [0.034, 0.008],
          [0.058, 0.045],
          [0.054, 0.046],
          [0, 0.015],
        ], { segments: 24 }),
        rod('tableware', [x - 0.07, top + 0.05, z + 0.012], [x + 0.08, top + 0.047, z + 0.03], 0.0035, { plan: false }),
        rod('tableware', [x - 0.07, top + 0.05, z + 0.024], [x + 0.08, top + 0.047, z + 0.045], 0.0035, { plan: false }),
      );
    }
    const hz = td * 0.28;
    parts.push(vcyl('tableware', 0, hz, top, top + 0.07, 0.03, { rTop: 0.032, plan: false }));
    for (const k of range(8)) {
      const ang = (k / 8) * TAU;
      parts.push(rod('tableware', [Math.cos(ang) * 0.012, top + 0.01, hz + Math.sin(ang) * 0.012], [Math.cos(ang) * 0.02, top + 0.115, hz + Math.sin(ang) * 0.02], 0.003, { plan: false }));
    }
    const ng = four ? 4 : 2;
    for (const k of range(ng)) {
      const x = (k % 2 ? 1 : -1) * tw * 0.36;
      const z = (k < 2 ? 1 : -1) * td * 0.3;
      parts.push(vcyl('glass', x, z, top, top + 0.1, 0.031, { rTop: 0.036, segments: 16, plan: false }));
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const four = d >= 1.05;
    const tw = clamp(w - 0.29 * 1.1, 0.45, 1.3);
    const td = four ? clamp(d - 0.29 * 1.1, 0.45, 1.0) : clamp(d - 0.02, 0.4, 0.9);
    return [rectPoly(-tw / 2, -td / 2, tw / 2, td / 2)];
  },
});

const phinCoffee = defineItem({
  id: 'phin-coffee-set',
  name: 'Phin coffee set',
  category: 'kitchen',
  type: 'decor',
  group: 'Candles & tabletop',
  tags: ['phin', 'coffee', 'ca phe sua da', 'condensed milk', 'drip filter', 'vietnamese coffee', 'tray'],
  defaultSize: { w: 0.26, d: 0.18, h: 0.21 },
  minSize: { w: 0.18, d: 0.13, h: 0.15 },
  maxSize: { w: 0.45, d: 0.3, h: 0.3 },
  slots: [
    matSlot('metal', 'Phin & tray', 'metal-brushed-steel'),
    matSlot('glass', 'Glass', 'glass-clear'),
    matSlot('coffee', 'Coffee', 'phin-coffee'),
    matSlot('milk', 'Condensed milk', 'condensed-milk'),
  ],
  build: ({ w, d, h }) => {
    const t = 0.008;
    const parts: Part[] = [
      span('metal', [-w / 2, w / 2], [0, t], [-d / 2, d / 2], { bevel: 0.003 }),
    ];
    // Tray rim (four low walls).
    parts.push(
      span('metal', [-w / 2, w / 2], [t, t + 0.01], [-d / 2, -d / 2 + 0.005], { plan: false }),
      span('metal', [-w / 2, w / 2], [t, t + 0.01], [d / 2 - 0.005, d / 2], { plan: false }),
      span('metal', [-w / 2, -w / 2 + 0.005], [t, t + 0.01], [-d / 2, d / 2], { plan: false }),
      span('metal', [w / 2 - 0.005, w / 2], [t, t + 0.01], [-d / 2, d / 2], { plan: false }),
    );
    // Glass with a layer of condensed milk under the dripping coffee.
    const gr = Math.min(0.035, d * 0.28);
    const gx = -w / 2 + gr * 1.3 + 0.012;
    const gh = Math.min(0.1, h * 0.48);
    const y0 = t;
    parts.push(
      lathe('glass', [gx, y0, 0], [
        [0, 0],
        [gr * 0.88, 0],
        [gr, gh],
        [gr * 0.94, gh],
        [gr * 0.83, 0.012],
        [0, 0.012],
      ], { segments: 24 }),
    );
    const rr = (y: number) => lerp(gr * 0.83, gr * 0.93, y / gh) - 0.002;
    const milkTop = 0.012 + gh * 0.22;
    parts.push(
      vcyl('milk', gx, 0, y0 + 0.012, y0 + milkTop, rr(0.012), { rTop: rr(milkTop), plan: false }),
      vcyl('coffee', gx, 0, y0 + milkTop, y0 + gh * 0.72, rr(milkTop), { rTop: rr(gh * 0.72), plan: false }),
    );
    // Phin filter sitting on the glass: plate with tabs, chamber, lid and knob.
    const py = y0 + gh;
    const plateR = gr * 1.25;
    const chR = gr * 0.82;
    const ph = Math.min(0.055, h - gh - t - 0.035);
    parts.push(
      cyl('metal', [gx, py + 0.002, 0], plateR, 0.004, { segments: 28, plan: false }),
      ring('metal', [gx, py + 0.004, 0], plateR - 0.002, 0.002, { plan: false }),
      span('metal', [gx + plateR - 0.004, gx + plateR + 0.008], [py, py + 0.004], [-0.01, 0.01], { plan: false }),
      span('metal', [gx - plateR - 0.008, gx - plateR + 0.004], [py, py + 0.004], [-0.01, 0.01], { plan: false }),
      vcyl('metal', gx, 0, py + 0.004, py + 0.004 + ph, chR, { rTop: chR * 1.04, segments: 28, plan: false }),
      cyl('metal', [gx, py + 0.008 + ph, 0], chR * 1.08, 0.008, { segments: 28, plan: false }),
      vcyl('metal', gx, 0, py + 0.012 + ph, py + 0.022 + ph, 0.006, { plan: false }),
      sphere('metal', [gx, py + 0.024 + ph, 0], 0.009, { scale: [1, 0.6, 1], plan: false }),
      // Drip of coffee from the phin into the glass.
      vcyl('coffee', gx, 0, y0 + gh * 0.72, py, 0.0015, { plan: false }),
    );
    // Long spoon and a can of condensed milk.
    const sx = gx + plateR + 0.025;
    parts.push(
      rod('metal', [sx - 0.004, t + 0.004, -d / 2 + 0.03], [sx + 0.004, t + 0.004, d / 2 - 0.045], 0.0025, { plan: false }),
      sphere('metal', [sx + 0.004, t + 0.004, d / 2 - 0.03], 0.012, { scale: [0.75, 0.3, 1.2], plan: false }),
    );
    const cr = Math.min(0.036, (w / 2 - sx - 0.012) * 0.9);
    if (cr > 0.015) {
      const cx = w / 2 - cr - 0.008;
      const ch = Math.min(0.08, h - t - 0.01);
      parts.push(
        vcyl('milk', cx, 0, t, t + ch, cr, { segments: 24, plan: false }),
        ring('metal', [cx, t + ch, 0], cr - 0.002, 0.0025, { plan: false }),
        ring('metal', [cx, t + 0.003, 0], cr - 0.002, 0.0025, { plan: false }),
      );
    }
    return parts;
  },
});

const thermosTea = defineItem({
  id: 'thermos-tea-set',
  name: 'Thermos and tea set',
  category: 'kitchen',
  type: 'decor',
  group: 'Candles & tabletop',
  tags: ['thermos', 'phich', 'tea set', 'am chen', 'teapot', 'tea cups', 'tray', 'vietnamese', 'green tea'],
  defaultSize: { w: 0.5, d: 0.36, h: 0.38 },
  minSize: { w: 0.32, d: 0.25, h: 0.3 },
  maxSize: { w: 0.8, d: 0.5, h: 0.45 },
  slots: [
    matSlot('thermos', 'Thermos', 'thermos-red'),
    matSlot('china', 'Teapot & cups', 'bat-trang-glaze'),
    matSlot('tray', 'Lacquer tray', 'lacquer-red'),
    matSlot('tea', 'Tea', 'tea-liquid'),
  ],
  build: ({ w, d, h }) => {
    const tr = Math.min(0.06, d * 0.17);
    const th = h;
    const tx = -w / 2 + tr + 0.01;
    const tz = -d / 2 + tr + 0.02;
    const parts: Part[] = [
      lathe('thermos', [tx, 0, tz], [
        [0, 0],
        [tr * 0.9, 0],
        [tr, 0.012],
        [tr, th * 0.66],
        [tr * 0.96, th * 0.7],
        [tr * 0.62, th * 0.78],
        [tr * 0.5, th * 0.82],
        [tr * 0.5, th * 0.84],
        [0, th * 0.84],
      ], { segments: 28 }),
      ring('thermos', [tx, 0.014, tz], tr, 0.004, { plan: false }),
      vcyl('thermos', tx, tz, th * 0.84, th * 0.95, tr * 0.52, { rTop: tr * 0.48, segments: 24, plan: false }),
      vcyl('thermos', tx, tz, th * 0.95, th, tr * 0.26, { rTop: tr * 0.22, plan: false }),
    ];
    // Side handle loop.
    const rr = th * 0.16;
    parts.push(torus('thermos', [tx + tr * 0.9, th * 0.5, tz], rr, 0.008, { arc: Math.PI, rotation: [0, 0, -Math.PI / 2], plan: false }));
    // Printed flowers on the body.
    for (const [a, y] of [
      [0.35, th * 0.42],
      [-0.25, th * 0.24],
    ] as const) {
      parts.push(...flowerDecal('china', tx, tz, a, tr + 0.001, y, tr * 0.22));
    }
    // Lacquered tray with teapot on its saucer and the little cups.
    const x0 = tx + tr * 0.9 + rr + 0.02;
    const x1 = w / 2 - 0.005;
    const z0 = -d / 2 + 0.02;
    const z1 = d / 2 - 0.01;
    const trayW = x1 - x0;
    const trayD = z1 - z0;
    parts.push(
      span('tray', [x0, x1], [0, 0.012], [z0, z1], { bevel: 0.004 }),
      span('tray', [x0, x1], [0.012, 0.03], [z0, z0 + 0.008], { plan: false }),
      span('tray', [x0, x1], [0.012, 0.03], [z1 - 0.008, z1], { plan: false }),
      span('tray', [x0, x0 + 0.008], [0.012, 0.03], [z0, z1], { plan: false }),
      span('tray', [x1 - 0.008, x1], [0.012, 0.03], [z0, z1], { plan: false }),
    );
    const pr = Math.min(0.06, trayW * 0.22, trayD * 0.22);
    const px = (x0 + x1) / 2;
    const pz = z0 + trayD * 0.33;
    const y = 0.012;
    const by = y + 0.008;
    parts.push(
      lathe('china', [px, y, pz], [
        [0, 0],
        [pr * 0.9, 0],
        [pr * 1.3, 0.008],
        [pr * 1.25, 0.009],
        [0, 0.004],
      ], { segments: 28 }),
      lathe('china', [px, by, pz], [
        [0, 0],
        [pr * 0.6, 0],
        [pr, pr * 0.45],
        [pr * 0.9, pr * 0.85],
        [pr * 0.55, pr],
        [0, pr],
      ], { segments: 28 }),
      sphere('china', [px, by + pr * 1.06, pz], pr * 0.14, { plan: false }),
      rod('china', [px + pr * 0.75, by + pr * 0.35, pz], [px + pr * 1.4, by + pr * 0.9, pz], pr * 0.12, { rTop: pr * 0.06, plan: false }),
      torus('china', [px - pr * 0.98, by + pr * 0.5, pz], pr * 0.3, pr * 0.07, { plan: false }),
    );
    const nc = clamp(Math.floor((trayW - 0.02) / 0.07), 2, 6);
    const cr = 0.025;
    const hc = 0.032;
    const czz = z1 - Math.max(0.045, trayD * 0.24);
    for (const cx of spaced(nc, x0 + 0.04, x1 - 0.04)) {
      parts.push(
        lathe('china', [cx, y, czz], [
          [0, 0],
          [cr * 0.55, 0],
          [cr * 0.6, 0.005],
          [cr, hc],
          [cr * 0.92, hc],
          [0, hc * 0.25],
        ], { segments: 20 }),
        cyl('tea', [cx, y + hc * 0.75, czz], cr * 0.82, 0.003, { segments: 20, plan: false }),
      );
    }
    return parts;
  },
});

// ---------------------------------------------------------------------------
// Bedroom
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Outdoor
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Decor & plants
// ---------------------------------------------------------------------------

const nonLa = defineItem({
  id: 'non-la-wall',
  name: 'Nón lá conical hats',
  category: 'decor',
  type: 'decor',
  group: 'Wall art',
  tags: ['non la', 'conical hat', 'palm leaf', 'hat', 'vietnamese', 'wall decor', 'ao dai'],
  mount: 'wall',
  defaultElevation: 1.35,
  defaultSize: { w: 0.85, d: 0.2, h: 0.48 },
  minSize: { w: 0.35, d: 0.1, h: 0.3 },
  maxSize: { w: 1.8, d: 0.3, h: 0.7 },
  slots: [
    matSlot('leaf', 'Palm leaf', 'non-la-leaf'),
    matSlot('ribbon', 'Silk strap', 'silk-ribbon'),
  ],
  build: ({ w, d, h }) => {
    const n = clamp(Math.round(w / 0.42), 1, 4);
    const r = Math.min(h / 2 - 0.01, w / (2 + 1.6 * (n - 1)));
    const parts: Part[] = [];
    for (const [i, cx] of spaced(n, -w / 2 + r, w / 2 - r).entries()) {
      const rr = r * (i % 2 ? 0.92 : 1);
      const cy = h / 2 + (i % 2 ? -1 : 1) * Math.min(0.04, h / 2 - rr - 0.005);
      const depth = Math.min(d - 0.012, rr * 0.85);
      const zb = -d / 2 + 0.004;
      const mid = depth / 2;
      const prof: V2[] = range(7).map((k) => {
        const t = k / 6;
        return [rr * Math.pow(1 - t, 0.92), depth * t] as V2;
      });
      parts.push(lathe('leaf', [cx, cy - mid, zb + mid], prof, { segments: 36, rotation: [Math.PI / 2, 0, 0] }));
      parts.push(torus('leaf', [cx, cy, zb + 0.004], rr, 0.0045, { plan: false }));
      // Ribs of the frame rings (vành) showing through the leaf.
      for (const k of range(4)) {
        const t = (k + 1) / 5;
        parts.push(torus('leaf', [cx, cy, zb + depth * t], rr * Math.pow(1 - t, 0.92) + 0.001, 0.0022, { plan: false }));
      }
      // Silk chin strap looped across the brim.
      const strap: V3[] = range(7).map((k) => {
        const a = Math.PI * (1.08 + (k / 6) * 0.84);
        const t = 0.06 + 0.16 * Math.sin((Math.PI * k) / 6);
        const sr = rr * Math.pow(1 - t, 0.92) + 0.004;
        return [cx + Math.cos(a) * sr, cy + Math.sin(a) * sr, zb + depth * t + 0.006];
      });
      parts.push(...rodPath('ribbon', strap, 0.005));
    }
    return parts;
  },
});

const kumquat = defineItem({
  id: 'kumquat-tree',
  name: 'Tết kumquat tree',
  category: 'plants',
  type: 'plants',
  group: 'Trees',
  plant: PLANT_SPECIES['citrus-japonica-kumquat'],
  tags: ['kumquat', 'quat', 'tet', 'lunar new year', 'li xi', 'red envelope', 'fruit tree', 'vietnamese', 'lucky'],
  description: 'A Tết kumquat tree (cây quất) laden with orange fruit and hung with red lì xì envelopes, in a brown-glazed pot.',
  defaultSize: { w: 0.85, d: 0.85, h: 1.35 },
  minSize: { w: 0.45, d: 0.45, h: 0.7 },
  maxSize: { w: 1.4, d: 1.4, h: 2.2 },
  slots: [
    matSlot('pot', 'Glazed pot & trunk', 'glazed-brown'),
    matSlot('leaves', 'Leaves', 'plant-leaf-dark'),
    matSlot('fruit', 'Kumquats', 'kumquat-orange'),
    matSlot('lixi', 'Red envelopes', 'li-xi-red'),
  ],
  build: ({ w, d, h }) => {
    const r = Math.min(w, d) / 2;
    const potR = clamp(r * 0.5, 0.1, 0.32);
    const potH = clamp(h * 0.24, 0.16, 0.42);
    const R = Math.min(r - 0.006, (h - potH * 0.95) / 2);
    const cy = h - R;
    const parts: Part[] = [
      lathe('pot', [0, 0, 0], [
        [0, 0],
        [potR * 0.62, 0],
        [potR * 0.6, potH * 0.06],
        [potR * 0.88, potH * 0.35],
        [potR, potH * 0.8],
        [potR * 0.93, potH * 0.92],
        [potR * 0.97, potH],
        [potR * 0.88, potH],
      ], { segments: 32 }),
      ring('pot', [0, potH * 0.92, 0], potR * 0.93, 0.01, { plan: false }),
      vcyl('pot', 0, 0, potH * 0.8, cy, clamp(R * 0.07, 0.015, 0.04), { rTop: clamp(R * 0.05, 0.01, 0.03), plan: false }),
      sphere('leaves', [0, cy, 0], R * 0.7),
    ];
    // Leafy dome: blobs placed on a Fibonacci sphere, reaching the canopy radius.
    const nb = 14;
    const b = R * 0.38;
    const blobs: V3[] = [];
    for (const k of range(nb)) {
      const yy = 1 - ((k + 0.5) / nb) * 1.75;
      const rad = Math.sqrt(Math.max(0, 1 - yy * yy));
      const th = k * 2.39996;
      const c: V3 = [Math.cos(th) * rad * (R - b), yy * (R - b), Math.sin(th) * rad * (R - b)];
      blobs.push(c);
      parts.push(sphere('leaves', [c[0], cy + c[1], c[2]], b, { plan: false }));
    }
    const surface = (u: V3): number => {
      let t = R * 0.7;
      for (const c of blobs) {
        const uc = u[0] * c[0] + u[1] * c[1] + u[2] * c[2];
        const disc = b * b - (c[0] * c[0] + c[1] * c[1] + c[2] * c[2] - uc * uc);
        if (disc >= 0) t = Math.max(t, uc + Math.sqrt(disc));
      }
      return t;
    };
    // Kumquats dotted over the surface.
    const fr = clamp(R * 0.055, 0.014, 0.03);
    const nf = clamp(Math.round(R * R * 190), 14, 60);
    const rand = rng(88);
    for (const k of range(nf)) {
      const yy = 1 - ((k + 0.5) / nf) * 1.55;
      const rad = Math.sqrt(Math.max(0, 1 - yy * yy));
      const th = k * 2.39996 + rand() * 0.4;
      const u: V3 = [Math.cos(th) * rad, yy, Math.sin(th) * rad];
      const t = surface(u) - fr * 0.4;
      parts.push(sphere('fruit', [u[0] * t, cy + u[1] * t, u[2] * t], fr * lerp(0.85, 1.1, rand()), { scale: [1, 0.9, 1], plan: false }));
    }
    // Lì xì envelopes hung on the front of the tree.
    const ne = clamp(Math.round(R * 14), 3, 9);
    const ew = clamp(R * 0.13, 0.04, 0.065);
    for (const k of range(ne)) {
      const az = lerp(-1.5, 1.5, (k + 0.5) / ne) + (rand() - 0.5) * 0.25;
      const el = lerp(-0.35, 0.45, rand());
      const u: V3 = [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)];
      const t = surface(u) - 0.012;
      parts.push(box('lixi', [u[0] * t, cy + u[1] * t - ew * 0.4, u[2] * t], [ew, ew * 1.55, 0.003], { rotation: [0, az, (rand() - 0.5) * 0.3], plan: false }));
    }
    return parts;
  },
  planDetail: ({ w, d }) => [circle([0, 0], Math.min(w, d) / 2 - 0.01)],
});

const peachBlossom = defineItem({
  id: 'peach-blossom',
  name: 'Peach blossom branches in vase',
  category: 'plants',
  type: 'plants',
  group: 'Cut & dried flowers',
  plant: PLANT_SPECIES['cut-peach-blossom'],
  tags: ['peach blossom', 'hoa dao', 'tet', 'lunar new year', 'branches', 'pink', 'vase', 'vietnamese', 'spring'],
  description: 'Tết peach blossom branches (hoa đào) in pink bloom with red lì xì envelopes, in a Bát Tràng crackle-glaze vase.',
  defaultSize: { w: 0.75, d: 0.55, h: 1.5 },
  minSize: { w: 0.4, d: 0.3, h: 0.8 },
  maxSize: { w: 1.4, d: 1.0, h: 2.4 },
  slots: [
    matSlot('vase', 'Ceramic vase', 'bat-trang-glaze'),
    matSlot('bark', 'Branches', 'peach-bark'),
    matSlot('blossom', 'Blossoms', 'peach-pink'),
    matSlot('lixi', 'Red envelopes', 'li-xi-red'),
  ],
  build: ({ w, d, h }) => {
    const vr = clamp(Math.min(w, d) * 0.24, 0.07, 0.17);
    const vh = clamp(h * 0.3, 0.22, 0.55);
    const parts: Part[] = [
      lathe('vase', [0, 0, 0], [
        [0, 0],
        [vr * 0.62, 0],
        [vr * 0.66, vh * 0.04],
        [vr * 0.95, vh * 0.35],
        [vr, vh * 0.55],
        [vr * 0.72, vh * 0.85],
        [vr * 0.5, vh * 0.92],
        [vr * 0.58, vh],
        [vr * 0.5, vh],
      ], { segments: 32 }),
    ];
    const nb = clamp(Math.round(w * 7 + 1), 4, 7);
    const rand = rng(23);
    const mx = w / 2 - 0.035;
    const mz = d / 2 - 0.035;
    const my = h - 0.03;
    const cl = (p: V3): V3 => [clamp(p[0], -mx, mx), clamp(p[1], vh * 0.9, my), clamp(p[2], -mz, mz)];
    const bloom = (p: V3) => {
      const br = 0.016 + rand() * 0.012;
      parts.push(sphere('blossom', cl([p[0] + (rand() - 0.5) * 0.05, p[1] + (rand() - 0.5) * 0.04, p[2] + (rand() - 0.5) * 0.05]), br, { scale: [1, 0.8, 1], plan: false }));
    };
    const hangs: V3[] = [];
    for (const k of range(nb)) {
      const az = (k / nb) * TAU + rand() * 0.6;
      const reach = 0.45 + rand() * 0.55;
      const start: V3 = [Math.cos(az) * vr * 0.25, vh * 0.92, Math.sin(az) * vr * 0.25];
      const end = cl([Math.cos(az) * mx * reach, h * (0.62 + rand() * 0.36), Math.sin(az) * mz * reach]);
      const pts: V3[] = [start];
      for (const s of range(4)) {
        const t = (s + 1) / 4;
        const j = 0.07 * (1 - Math.abs(2 * t - 1));
        pts.push(cl([lerp(start[0], end[0], t) + (rand() - 0.5) * j * 2, lerp(start[1], end[1], t) + (rand() - 0.5) * j, lerp(start[2], end[2], t) + (rand() - 0.5) * j * 2]));
      }
      for (const s of range(4)) {
        parts.push(rod('bark', pts[s], pts[s + 1], 0.012 * (1 - s * 0.17), { plan: false }));
        for (const t of [0.2, 0.55, 0.9]) {
          bloom([lerp(pts[s][0], pts[s + 1][0], t), lerp(pts[s][1], pts[s + 1][1], t), lerp(pts[s][2], pts[s + 1][2], t)]);
        }
      }
      const tw = cl([pts[2][0] + (rand() - 0.5) * 0.3, pts[2][1] + 0.12 + rand() * 0.1, pts[2][2] + (rand() - 0.5) * 0.2]);
      parts.push(rod('bark', pts[2], tw, 0.005, { plan: false }));
      bloom(tw);
      bloom([(pts[2][0] + tw[0]) / 2, (pts[2][1] + tw[1]) / 2, (pts[2][2] + tw[2]) / 2]);
      if (k % 2 === 0) hangs.push(pts[3]);
    }
    for (const [i, p] of hangs.entries()) {
      const c = cl([p[0], Math.max(vh + 0.08, p[1] - 0.06), p[2]]);
      parts.push(box('lixi', c, [0.04, 0.062, 0.003], { rotation: [0, i * 1.3, 0.12], plan: false }));
    }
    return parts;
  },
  planDetail: ({ w, d }) => [circle([0, 0], clamp(Math.min(w, d) * 0.24, 0.07, 0.17)), rectPoly(-w / 2 + 0.05, -d / 2 + 0.05, w / 2 - 0.05, d / 2 - 0.05)],
});

const lacquerPainting = defineItem({
  id: 'lacquer-painting',
  name: 'Sơn mài lacquer painting',
  category: 'decor',
  type: 'decor',
  group: 'Wall art',
  tags: ['son mai', 'lacquer', 'painting', 'gold leaf', 'eggshell', 'lotus', 'vietnamese', 'art', 'triptych'],
  mount: 'wall',
  defaultElevation: 1.35,
  defaultSize: { w: 0.9, d: 0.035, h: 0.6 },
  minSize: { w: 0.3, d: 0.02, h: 0.25 },
  maxSize: { w: 2.4, d: 0.06, h: 1.4 },
  slots: [
    matSlot('art', 'Lacquer panel', 'son-mai-art'),
    matSlot('frame', 'Black lacquer frame', 'lacquer-black'),
    matSlot('trim', 'Gold fillet', 'gold-leaf'),
  ],
  build: ({ w, d, h }) => {
    const n = clamp(Math.round(w / (h * 1.25)), 1, 4);
    const gap = n > 1 ? 0.03 : 0;
    const pw = (w - gap * (n - 1)) / n;
    const z0 = -d / 2;
    const zb = z0 + d * 0.55;
    const fr = clamp(Math.min(pw, h) * 0.06, 0.018, 0.05);
    const parts: Part[] = [];
    for (const i of range(n)) {
      const x0 = -w / 2 + i * (pw + gap);
      const x1 = x0 + pw;
      parts.push(
        span('frame', [x0, x1], [0, h], [z0, zb]),
        span('art', [x0 + fr, x1 - fr], [fr, h - fr], [zb, zb + d * 0.08], { plan: false }),
        ...frame4('frame', [x0, x1], [0, h], [zb, d / 2], fr),
        ...frame4('trim', [x0 + fr, x1 - fr], [fr, h - fr], [zb, zb + d * 0.22], 0.006),
      );
    }
    return parts;
  },
});

const bambooBlind = defineItem({
  id: 'bamboo-blind',
  name: 'Bamboo blind (mành tre)',
  category: 'decor',
  type: 'decor',
  group: 'Curtains & blinds',
  tags: ['bamboo', 'blind', 'manh tre', 'roll-up', 'shade', 'window', 'vietnamese', 'natural'],
  mount: 'wall',
  defaultElevation: 0.55,
  defaultSize: { w: 1.2, d: 0.06, h: 1.7 },
  minSize: { w: 0.5, d: 0.03, h: 0.6 },
  maxSize: { w: 3.0, d: 0.12, h: 2.5 },
  slots: [
    matSlot('bamboo', 'Split bamboo', 'bamboo-split'),
    matSlot('cord', 'Cords & binding', 'cord-red'),
  ],
  build: ({ w, d, h }) => {
    const zb = -d / 2;
    const rr = clamp((d - 0.016) / 2, 0.006, 0.035);
    const rollY = clamp(h * 0.4, rr + 0.02, h - 0.15);
    const pole = Math.min(0.022, d / 2 - 0.002);
    const zp = zb + 0.004;
    const parts: Part[] = [
      rodX('bamboo', -w / 2 + 0.005, w / 2 - 0.005, h - pole, zb + pole, pole),
      span('bamboo', [-w / 2 + 0.01, w / 2 - 0.01], [rollY, h - pole], [zp, zp + 0.006], { plan: false }),
      rodX('bamboo', -w / 2 + 0.01, w / 2 - 0.01, rollY, zb + rr + 0.003, rr, { plan: false }),
    ];
    // Nodes on the head pole.
    for (const x of spaced(Math.round(w / 0.4) + 1, -w / 2 + 0.05, w / 2 - 0.05)) {
      parts.push(torus('bamboo', [x, h - pole, zb + pole], pole, 0.003, { rotation: [0, Math.PI / 2, 0], plan: false }));
    }
    // Cloth-bound edges and the vertical weaving cords.
    for (const s of [-1, 1]) {
      parts.push(span('cord', [s > 0 ? w / 2 - 0.022 : -w / 2 + 0.01, s > 0 ? w / 2 - 0.01 : -w / 2 + 0.022], [rollY, h - pole], [zp - 0.001, zp + 0.008], { plan: false }));
    }
    for (const x of spaced(Math.round(w / 0.18) + 1, -w / 2 + 0.06, w / 2 - 0.06)) {
      parts.push(rod('cord', [x, rollY, zp + 0.0075], [x, h - pole * 2, zp + 0.0075], 0.0015, { plan: false }));
    }
    // Lift cords running down the front and looping under the roll.
    const zc = zb + 2 * rr + 0.008;
    for (const x of [-w * 0.3, w * 0.3]) {
      parts.push(
        rod('cord', [x, h - pole, zc], [x, rollY, zc], 0.002, { plan: false }),
        torus('cord', [x, rollY, zb + rr + 0.003], rr + 0.004, 0.0025, { rotation: [0, Math.PI / 2, 0], plan: false }),
      );
    }
    // Pull cord with a tassel.
    const px = w / 2 - 0.03;
    const py = Math.max(0.05, rollY * 0.5);
    parts.push(
      rod('cord', [px, h - pole, zb + 0.02], [px, py, zb + 0.02], 0.0025, { plan: false }),
      cyl('cord', [px, py - 0.025, zb + 0.02], 0.009, 0.05, { rTop: 0.004, plan: false }),
    );
    return parts;
  },
});


const lotusBowl = defineItem({
  id: 'lotus-pond-bowl',
  name: 'Lotus bowl',
  category: 'plants',
  type: 'plants',
  group: 'Outdoor plants',
  plant: PLANT_SPECIES['nelumbo-nucifera'],
  tags: ['lotus', 'hoa sen', 'water plant', 'bowl', 'pond', 'ceramic', 'vietnamese', 'national flower'],
  description: 'A dwarf bowl lotus (hoa sen) with round leaves and pink flowers above the water, in a Bát Tràng crackle-glaze bowl.',
  defaultSize: { w: 0.6, d: 0.6, h: 0.75 },
  minSize: { w: 0.35, d: 0.35, h: 0.35 },
  maxSize: { w: 1.2, d: 1.2, h: 1.3 },
  slots: [
    matSlot('bowl', 'Glazed bowl', 'bat-trang-glaze'),
    matSlot('water', 'Water', 'water'),
    matSlot('leaves', 'Leaves & stems', 'lotus-leaf'),
    matSlot('flower', 'Lotus flowers', 'lotus-pink'),
  ],
  build: ({ w, d, h }) => {
    const r = Math.min(w, d) / 2;
    const bh = clamp(h * 0.42, 0.14, 0.4);
    const wy = bh * 0.86;
    const parts: Part[] = [
      lathe('bowl', [0, 0, 0], [
        [0, 0],
        [r * 0.55, 0],
        [r * 0.58, 0.02],
        [r * 0.9, bh * 0.45],
        [r * 0.99, bh * 0.82],
        [r * 0.95, bh],
        [r * 0.9, bh],
        [r * 0.88, bh * 0.9],
      ], { segments: 36 }),
      ring('bowl', [0, bh, 0], r * 0.93, r * 0.03, { plan: false }),
      cyl('water', [0, wy, 0], r * 0.88, 0.006, { segments: 36, plan: false }),
    ];
    // Floating leaves.
    for (const k of range(4)) {
      const a = (k / 4) * TAU + 0.4;
      parts.push(cyl('leaves', [Math.cos(a) * r * 0.45, wy + 0.004, Math.sin(a) * r * 0.45], r * 0.24, 0.004, { segments: 20, plan: false }));
    }
    // Raised umbrella leaves on stems.
    const lr = clamp(r * 0.36, 0.07, 0.2);
    for (const [a, f] of [
      [0.9, 0.62],
      [3.9, 0.78],
    ] as const) {
      const dist = Math.max(0, r - lr - 0.02);
      const lx = Math.cos(a) * dist;
      const lz = Math.sin(a) * dist;
      const ly = Math.min(lerp(bh, h, f), h - lr * 0.4 - 0.02);
      parts.push(
        rod('leaves', [lx * 0.4, wy, lz * 0.4], [lx, ly, lz], 0.006, { plan: false }),
        lathe('leaves', [lx, ly, lz], [
          [0, 0],
          [lr * 0.3, lr * 0.06],
          [lr * 0.75, lr * 0.18],
          [lr, lr * 0.32],
        ], { segments: 24, plan: false }),
      );
    }
    // Two open flowers and a closed bud.
    const pl = clamp(r * 0.3, 0.06, 0.13);
    for (const [a, dist, drop] of [
      [2.2, 0.25, 0],
      [-0.6, 0.15, 0.25],
    ] as const) {
      const fx = Math.cos(a) * r * dist;
      const fz = Math.sin(a) * r * dist;
      const fb = h - pl - 0.01 - (h - bh) * drop;
      parts.push(rod('leaves', [fx * 0.5, wy, fz * 0.5], [fx, fb, fz], 0.006, { plan: false }));
      for (const k of range(6)) parts.push(leaf('flower', [fx, fb, fz], pl, pl * 0.5, (k / 6) * TAU, 0.75, { thick: pl * 0.12 }));
      for (const k of range(5)) parts.push(leaf('flower', [fx, fb, fz], pl * 0.9, pl * 0.45, (k / 5) * TAU + 0.6, 0.35, { thick: pl * 0.12 }));
      parts.push(cyl('leaves', [fx, fb + pl * 0.35, fz], pl * 0.2, pl * 0.16, { rTop: pl * 0.24, plan: false }));
    }
    const bx = Math.cos(4.8) * r * 0.3;
    const bz = Math.sin(4.8) * r * 0.3;
    const by = Math.min(lerp(bh, h, 0.55), h - pl - 0.005);
    parts.push(
      rod('leaves', [bx * 0.5, wy, bz * 0.5], [bx, by, bz], 0.005, { plan: false }),
      lathe('flower', [bx, by, bz], [
        [0, 0],
        [pl * 0.25, pl * 0.25],
        [pl * 0.22, pl * 0.6],
        [0, pl],
      ], { segments: 16, plan: false }),
    );
    return parts;
  },
  planDetail: ({ w, d }) => [circle([0, 0], Math.min(w, d) / 2 * 0.88)],
});

export default definePack({
  name: 'Vietnamese home',
  version: '1.0.0',
  author: 'Neest team',
  description:
    'Street-food plastic stools, a motorbike, Tết kumquat and peach blossom, phin coffee, a folding hammock and other everyday pieces of a Vietnamese home.',
  license: 'CC0 (made for Neest)',
  items: [
    stoolStack,
    lowTable,
    nonLa,
    phinCoffee,
    kumquat,
    peachBlossom,
    lacquerPainting,
    bambooBlind,
    thermosTea,
    hammock,
    lotusBowl,
  ],
  patterns: [
    { id: 'son-mai', name: 'Sơn mài lacquer', normalStrength: 0.25, colored: true, draw: drawSonMai },
    { id: 'go-carving', name: 'Carved gụ wood', normalStrength: 1.2, draw: drawGoCarving },
    { id: 'tho-cam', name: 'Thổ cẩm brocade', normalStrength: 0.6, colored: true, draw: drawThoCam },
    { id: 'nan-tre', name: 'Split bamboo slats', normalStrength: 0.9, draw: drawNanTre },
  ],
  materials: [
    // Lacquer & gilding
    { id: 'son-mai-art', name: 'Sơn mài lacquer art', color: '#ffffff', roughness: 0.16, pattern: { id: 'son-mai', scale: 0.9 } },
    { id: 'lacquer-black', name: 'Black lacquer', color: '#17100c', roughness: 0.14 },
    { id: 'lacquer-red', name: 'Vermilion lacquer', color: '#8e1c12', roughness: 0.16 },
    { id: 'gold-leaf', name: 'Gold leaf', category: 'metal', color: '#d6a845', roughness: 0.32, metalness: 0.85, pattern: { id: 'brushed', scale: 0.2, contrast: 0.3 } },
    { id: 'mother-of-pearl', name: 'Mother-of-pearl', color: '#efe9e2', roughness: 0.18, metalness: 0.15 },
    // Wood
    { id: 'go-wood', name: 'Gụ wood', category: 'wood', color: '#5a2c17', roughness: 0.35, pattern: { id: 'wood-grain', scale: 0.6, contrast: 0.9 } },
    { id: 'go-carved', name: 'Carved gụ wood', category: 'wood', color: '#5e2f19', roughness: 0.42, pattern: { id: 'go-carving', scale: 0.32 } },
    { id: 'peach-bark', name: 'Peach branch bark', category: 'wood', color: '#3b2a22', roughness: 0.85, pattern: { id: 'wood-grain', scale: 0.15, contrast: 0.7 } },
    // Weaves & textiles
    { id: 'tho-cam', name: 'Thổ cẩm brocade', category: 'fabric', color: '#ffffff', roughness: 0.85, pattern: { id: 'tho-cam', scale: 0.35 } },
    { id: 'bamboo-split', name: 'Split bamboo', category: 'wood', color: '#d6b676', roughness: 0.55, pattern: { id: 'nan-tre', scale: 0.4 } },
    { id: 'chieu-coi', name: 'Sedge mat (chiếu cói)', category: 'rug', color: '#e2c98f', roughness: 0.7, pattern: { id: 'nan-tre', scale: 0.12, contrast: 0.8 } },
    { id: 'non-la-leaf', name: 'Nón lá palm leaf', category: 'fabric', color: '#eadcb0', roughness: 0.72, pattern: { id: 'nan-tre', scale: 0.06, contrast: 0.45 } },
    { id: 'silk-ribbon', name: 'Pink silk', category: 'fabric', color: '#e7709b', roughness: 0.45 },
    { id: 'cord-red', name: 'Red nylon cord', category: 'fabric', color: '#b3262a', roughness: 0.6 },
    { id: 'mosquito-net', name: 'Mosquito netting', category: 'fabric', color: '#f5f5f0', roughness: 0.95, opacity: 0.35, pattern: { id: 'weave', scale: 0.02, contrast: 0.6 } },
    { id: 'vong-net', name: 'Hammock net', category: 'fabric', color: '#2e8a68', roughness: 0.75, opacity: 0.9, pattern: { id: 'weave', scale: 0.05, contrast: 1 } },
    // Ceramics
    { id: 'bat-trang-glaze', name: 'Bát Tràng crackle glaze', color: '#eee5cf', roughness: 0.16, pattern: { id: 'marble', scale: 0.12, contrast: 0.55 } },
    { id: 'cobalt-glaze', name: 'Cobalt underglaze', color: '#1f3f8f', roughness: 0.18 },
    { id: 'glazed-brown', name: 'Brown-glazed earthenware', color: '#4e2a18', roughness: 0.22 },
    // Metal & plastic
    { id: 'hammock-frame', name: 'Powder-coated steel (blue)', category: 'metal', color: '#2c6a93', roughness: 0.4, metalness: 0.5 },
    { id: 'thermos-red', name: 'Enamelled thermos red', category: 'metal', color: '#c2352a', roughness: 0.3, metalness: 0.3 },
    { id: 'scooter-paint', name: 'Scooter pearl red', category: 'metal', color: '#b51f2a', roughness: 0.22, metalness: 0.35 },
    { id: 'helmet-paint', name: 'Helmet yellow', color: '#f0c93a', roughness: 0.3 },
    // Food, drink & festive
    { id: 'offering-fruit', name: 'Offering fruit', color: '#e58a24', roughness: 0.45 },
    { id: 'kumquat-orange', name: 'Kumquat orange', color: '#f08c12', roughness: 0.35 },
    { id: 'li-xi-red', name: 'Lì xì red', color: '#cf1b20', roughness: 0.45 },
    { id: 'peach-pink', name: 'Peach blossom pink', color: '#f3a3bf', roughness: 0.65 },
    { id: 'lotus-pink', name: 'Lotus pink', color: '#ef8fb0', roughness: 0.55 },
    { id: 'lotus-leaf', name: 'Lotus leaf green', color: '#4d7a34', roughness: 0.5 },
    { id: 'phin-coffee', name: 'Black coffee', color: '#2a150b', roughness: 0.1 },
    { id: 'condensed-milk', name: 'Condensed milk', color: '#f1e6c8', roughness: 0.3 },
    { id: 'tea-liquid', name: 'Green tea', color: '#a8a04a', roughness: 0.08 },
    { id: 'tra-da', name: 'Iced tea glass', category: 'glass', color: '#c58a3a', roughness: 0.08, opacity: 0.6 },
    { id: 'altar-glow', name: 'Altar lamp glow', color: '#ff6a4a', roughness: 0.4, emissive: '#ff3a1a', emissiveIntensity: 2.4 },
  ],
});

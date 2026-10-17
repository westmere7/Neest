/**
 * Chinese home — everyday furniture and decorations from a modern Chinese household.
 *
 * A gongfu tea table, a family round table with a lazy susan, a mahjong table, a bamboo steamer
 * stack, a blue-and-white floor vase, red silk lanterns, a goldfish bowl and the lucky plants found
 * in many homes. Four pack patterns give the
 * surfaces their character: blue-and-white porcelain painting, red lacquer with gold clouds,
 * fine hongmu rosewood grain and silk brocade with gold roundels.
 */
import {
  box,
  cells,
  circle,
  clamp,
  cyl,
  defineItem,
  definePack,
  ellipsePoints,
  lathe,
  leaf,
  lerp,
  matSlot,
  poly,
  pot,
  range,
  rectPoly,
  ring,
  rng,
  rod,
  rodPath,
  slats,
  span,
  sphere,
  torus,
  vcyl,
  type Part,
  type V2,
  type V3,
} from '@/packs/kit';

const TAU = Math.PI * 2;
const HALF_PI = Math.PI / 2;

/** [min, max] of two numbers, for spans mirrored with a sign. */
const ordered = (a: number, b: number): V2 => (a < b ? [a, b] : [b, a]);




/** Rotate [x, y, z] about the X axis (three.js convention). */
const rotX = ([x, y, z]: V3, a: number): V3 => [x, y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)];

// ---------------------------------------------------------------------------
// Pattern helpers (all tile seamlessly: lattices wrap, repeats are whole numbers)
// ---------------------------------------------------------------------------

/** Periodic value noise on a gx × gy lattice over the unit tile. */
function tileNoise(rand: () => number, gx: number, gy: number): (u: number, v: number) => number {
  const g = Array.from({ length: gx * gy }, () => rand());
  return (u, v) => {
    const x = (u - Math.floor(u)) * gx;
    const y = (v - Math.floor(v)) * gy;
    const x0 = Math.floor(x) % gx;
    const y0 = Math.floor(y) % gy;
    const fx = x - Math.floor(x);
    const fy = y - Math.floor(y);
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const x1 = (x0 + 1) % gx;
    const y1 = (y0 + 1) % gy;
    const a = g[y0 * gx + x0];
    const b = g[y0 * gx + x1];
    const c = g[y1 * gx + x0];
    const e = g[y1 * gx + x1];
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + e) * sx * sy;
  };
}

const smooth = (a: number, b: number, t: number): number => {
  const x = clamp((t - a) / (b - a), 0, 1);
  return x * x * (3 - 2 * x);
};

/** Runs `fn` nine times, shifted by a whole tile in every direction, so motifs wrap. */
function tiled(ctx: CanvasRenderingContext2D, size: number, fn: () => void): void {
  for (const dx of [-size, 0, size]) {
    for (const dy of [-size, 0, size]) {
      ctx.save();
      ctx.translate(dx, dy);
      fn();
      ctx.restore();
    }
  }
}

/** Blue-and-white porcelain: a scrolling lotus vine painted in cobalt on a warm white glaze. */
function drawQinghua(ctx: CanvasRenderingContext2D, size: number, rand: () => number): void {
  const s = size;
  const k = s / 512;
  const glaze = '#f5f3ec';
  const ink = (a: number) => `rgba(26, 52, 140, ${a})`;
  ctx.fillStyle = glaze;
  ctx.fillRect(0, 0, s, s);
  const spots = range(36).map(() => [rand() * s, rand() * s, (10 + rand() * 30) * k, rand()] as const);
  const A = s * 0.12;
  const rows = [
    { yc: s * 0.25, ph: 0, bloom: 0 },
    { yc: s * 0.75, ph: Math.PI, bloom: 1 },
  ];
  const stemY = (yc: number, ph: number, x: number) => yc + A * Math.sin((x / s) * TAU * 2 + ph);
  const dots = range(40).map(() => [rand(), rand(), rand()] as const);

  const blossom = (x: number, y: number, R: number, rot: number) => {
    for (const i of range(8)) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot + (i * TAU) / 8);
      ctx.beginPath();
      ctx.ellipse(0, -R * 0.6, R * 0.28, R * 0.42, 0, 0, TAU);
      ctx.fillStyle = ink(0.5);
      ctx.fill();
      ctx.lineWidth = 1.8 * k;
      ctx.strokeStyle = ink(0.95);
      ctx.stroke();
      ctx.restore();
    }
    for (const i of range(8)) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot + ((i + 0.5) * TAU) / 8);
      ctx.beginPath();
      ctx.ellipse(0, -R * 0.36, R * 0.15, R * 0.25, 0, 0, TAU);
      ctx.fillStyle = ink(0.82);
      ctx.fill();
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(x, y, R * 0.2, 0, TAU);
    ctx.fillStyle = glaze;
    ctx.fill();
    ctx.lineWidth = 1.6 * k;
    ctx.strokeStyle = ink(0.95);
    ctx.stroke();
    for (const i of range(6)) {
      const a = (i * TAU) / 6;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * R * 0.1, y + Math.sin(a) * R * 0.1, 1.6 * k, 0, TAU);
      ctx.fillStyle = ink(0.9);
      ctx.fill();
    }
    // "Heaped and piled" cobalt spots, typical of early Ming wares.
    for (const [u, v, t] of dots.slice(0, 8)) {
      const a = u * TAU;
      const rr = R * (0.45 + v * 0.4);
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * rr, y + Math.sin(a) * rr, (1 + t * 1.6) * k, 0, TAU);
      ctx.fillStyle = 'rgba(14, 26, 80, 0.75)';
      ctx.fill();
    }
  };

  const leafShape = (x: number, y: number, len: number, ang: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len * 0.5, -len * 0.34, len, 0);
    ctx.quadraticCurveTo(len * 0.5, len * 0.34, 0, 0);
    ctx.fillStyle = ink(0.68);
    ctx.fill();
    ctx.lineWidth = 1.4 * k;
    ctx.strokeStyle = ink(0.95);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(len * 0.08, 0);
    ctx.lineTo(len * 0.85, 0);
    ctx.lineWidth = 1.1 * k;
    ctx.strokeStyle = glaze;
    ctx.stroke();
    ctx.restore();
  };

  const tendril = (x: number, y: number, r: number, dir: number) => {
    ctx.beginPath();
    for (let t = 0; t <= Math.PI * 3; t += 0.15) {
      const rr = r * (1 - t / (Math.PI * 3.4));
      const px = x + dir * Math.cos(t) * rr;
      const py = y + Math.sin(t) * rr;
      if (t === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.lineWidth = 2 * k;
    ctx.strokeStyle = ink(0.9);
    ctx.stroke();
  };

  const floret = (x: number, y: number, R: number) => {
    leafShape(x + R * 0.5, y + R * 0.6, R * 1.2, 0.5);
    leafShape(x - R * 0.5, y + R * 0.6, R * 1.2, Math.PI - 0.5);
    for (const i of range(5)) {
      const a = (i * TAU) / 5 - HALF_PI;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * R * 0.55, y + Math.sin(a) * R * 0.55, R * 0.42, 0, TAU);
      ctx.fillStyle = ink(0.62);
      ctx.fill();
      ctx.lineWidth = 1.3 * k;
      ctx.strokeStyle = ink(0.95);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(x, y, R * 0.26, 0, TAU);
    ctx.fillStyle = glaze;
    ctx.fill();
    ctx.stroke();
  };

  tiled(ctx, s, () => {
    for (const [x, y, r, a] of spots) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fillStyle = `rgba(188, 204, 230, ${0.025 + a * 0.04})`;
      ctx.fill();
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const { yc, ph, bloom } of rows) {
      ctx.beginPath();
      for (let x = -8 * k; x <= s + 8 * k; x += 4 * k) {
        if (x <= -8 * k) ctx.moveTo(x, stemY(yc, ph, x));
        else ctx.lineTo(x, stemY(yc, ph, x));
      }
      ctx.lineWidth = 3.4 * k;
      ctx.strokeStyle = ink(0.92);
      ctx.stroke();
      // Small leaves where the vine crosses its centre line.
      for (const m of range(4)) {
        const x = (m * s) / 4;
        leafShape(x, stemY(yc, ph, x), s * 0.06, (m % 2 === 0 ? -0.7 : 0.7) + (bloom ? Math.PI : 0));
      }
      for (const m of range(4)) {
        const x = s / 8 + (m * s) / 4;
        const y = stemY(yc, ph, x);
        if (m % 2 === bloom) {
          // A leafy spray round each lotus, then the flower on top.
          const side = y > yc ? 1 : -1;
          for (const [j, da] of [-0.9, 0, 0.9].entries()) leafShape(x, y, s * (j === 1 ? 0.13 : 0.11), side * HALF_PI + da);
          blossom(x, y, s * 0.095, m * 0.3);
        } else {
          const side = y > yc ? -1 : 1;
          leafShape(x, y, s * 0.075, side * 1.9);
          leafShape(x, y, s * 0.07, side * 1.2);
          tendril(x + s * 0.04, y + side * s * 0.05, s * 0.028, side);
        }
      }
    }
    // Small florets in the gaps between the two vines.
    for (const [fx, fy] of [[0.375, 0.5], [0.875, 0.5], [0.125, 0], [0.625, 0]]) floret(fx * s, fy * s, s * 0.05);
  });
}

/** Cinnabar lacquer with gilded auspicious clouds (xiangyun). */
function drawLacquerClouds(ctx: CanvasRenderingContext2D, size: number, rand: () => number): void {
  const s = size;
  const k = s / 512;
  ctx.fillStyle = '#9a1c17';
  ctx.fillRect(0, 0, s, s);
  const mottle = range(60).map(() => [rand() * s, rand() * s, (8 + rand() * 40) * k, rand()] as const);
  const clouds = range(8).map((i) => {
    const r = Math.floor(i / 2);
    const c = i % 2;
    return {
      x: (c + 0.5 + (r % 2) * 0.5) * (s / 2) + (rand() - 0.5) * s * 0.04,
      y: (r + 0.5) * (s / 4) + (rand() - 0.5) * s * 0.03,
      c: s * 0.08 * (0.9 + rand() * 0.2),
      flip: (r + c) % 2 === 0 ? 1 : -1,
      rot: (rand() - 0.5) * 0.3,
    };
  });
  const gold = '#d9aa45';
  const goldDark = '#8a5716';

  const cloud = (x: number, y: number, c: number, flip: number, rot: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(flip, 1);
    ctx.lineCap = 'round';
    // Trailing wisp ending in a curl: a dark outline stroke under a gold one.
    const wisp = () => {
      ctx.beginPath();
      ctx.moveTo(-0.75 * c, 0.35 * c);
      ctx.bezierCurveTo(-1.3 * c, 0.78 * c, -1.75 * c, -0.05 * c, -2.25 * c, 0.33 * c);
      ctx.arc(-2.25 * c, 0.16 * c, 0.17 * c, 0.5 * Math.PI, 2.3 * Math.PI);
    };
    wisp();
    ctx.lineWidth = 0.2 * c + 2.8 * k;
    ctx.strokeStyle = goldDark;
    ctx.stroke();
    wisp();
    ctx.lineWidth = 0.2 * c;
    ctx.strokeStyle = gold;
    ctx.stroke();
    // Overlapping curled lobes, each outlined and holding an inward spiral.
    const lobes: [number, number, number][] = [
      [-0.25 * c, 0.5 * c, 0.22 * c],
      [0.3 * c, 0.5 * c, 0.22 * c],
      [-0.72 * c, 0.18 * c, 0.4 * c],
      [0.72 * c, 0.18 * c, 0.4 * c],
      [0.45 * c, -0.5 * c, 0.3 * c],
      [0, -0.12 * c, 0.58 * c],
    ];
    for (const [lx, ly, lr] of lobes) {
      ctx.beginPath();
      ctx.arc(lx, ly, lr, 0, TAU);
      ctx.fillStyle = gold;
      ctx.fill();
      ctx.lineWidth = 1.4 * k;
      ctx.strokeStyle = goldDark;
      ctx.stroke();
      // Inward spiral in each lobe.
      ctx.beginPath();
      for (let t = 0; t <= Math.PI * 3.2; t += 0.12) {
        const rr = lr * 0.78 * (t / (Math.PI * 3.2));
        const px = lx + Math.cos(t + 1) * rr;
        const py = ly + Math.sin(t + 1) * rr;
        if (t === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.lineWidth = 1.8 * k;
      ctx.stroke();
    }
    ctx.restore();
  };

  tiled(ctx, s, () => {
    for (const [x, y, r, a] of mottle) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fillStyle = a > 0.5 ? `rgba(60, 4, 2, ${0.025 + a * 0.035})` : `rgba(210, 70, 50, ${0.02 + a * 0.04})`;
      ctx.fill();
    }
    for (const cl of clouds) cloud(cl.x, cl.y, cl.c, cl.flip, cl.rot);
  });
}

/** Fine, dense rosewood grain with dark late-wood lines and pore dashes (near-white, tinted by the material). */
function drawHongmuGrain(ctx: CanvasRenderingContext2D, size: number, rand: () => number): void {
  const img = ctx.createImageData(size, size);
  const warp = tileNoise(rand, 2, 3);
  const warp2 = tileNoise(rand, 4, 16);
  const streak = tileNoise(rand, 2, 48);
  const tone = tileNoise(rand, 3, 6);
  const pore = tileNoise(rand, 48, 384);
  const rings = 34;
  for (let y = 0; y < size; y++) {
    const v = (y + 0.5) / size;
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size;
      const ph = rings * v + 2.2 * warp(u, v) + 0.5 * warp2(u, v);
      const p = ph - Math.floor(ph);
      const late = smooth(0.52, 0.8, p) * (1 - smooth(0.86, 0.98, p));
      let L = 0.9 - 0.22 * late * (0.55 + 0.9 * tone(u, v)) + 0.09 * (streak(u, v) - 0.5);
      const pr = pore(u, v);
      if (pr > 0.72) L -= (pr - 0.72) * 0.9;
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(clamp(L, 0, 1) * 255);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** Crimson silk brocade: gold roundels with a quatrefoil, teal florets between, twill weave. */
function drawBrocade(ctx: CanvasRenderingContext2D, size: number, rand: () => number): void {
  const img = ctx.createImageData(size, size);
  const s = size;
  const rowH = s / 4;
  const colW = s / 2;
  const R = s * 0.11;
  const ground: [number, number, number] = [142, 26, 36];
  const goldC: [number, number, number] = [222, 176, 78];
  const teal: [number, number, number] = [44, 128, 132];
  const slub = tileNoise(rand, 8, 64);
  for (let y = 0; y < s; y++) {
    const j = Math.floor(y / rowH);
    const off = (j % 2) * (colW / 2);
    const dy = y + 0.5 - (j + 0.5) * rowH;
    for (let x = 0; x < s; x++) {
      const xx = (((x + 0.5 - off) % s) + s) % s;
      const dx = xx - (Math.floor(xx / colW) + 0.5) * colW;
      const r = Math.hypot(dx, dy);
      const th = Math.atan2(dy, dx);
      let c = ground;
      let shade = 1;
      if (r < R) {
        if (r > R * 0.86) c = goldC;
        else if (r > R * 0.74 && Math.cos(th * 16) > 0.2) c = goldC;
        else if (r < R * 0.66 * (0.5 + 0.5 * Math.abs(Math.cos(th * 2)))) c = r < R * 0.16 ? (r < R * 0.08 ? goldC : ground) : goldC;
        else shade = 0.86;
      } else {
        // Teal four-dot florets midway between neighbouring roundels.
        const fx = Math.abs(dx) - colW / 2;
        const fr = s * 0.022;
        const d1 = Math.min(Math.hypot(fx - fr, dy), Math.hypot(fx + fr, dy), Math.hypot(fx, dy - fr), Math.hypot(fx, dy + fr));
        if (Math.hypot(fx, dy) < s * 0.008) c = goldC;
        else if (d1 < s * 0.013) c = teal;
      }
      // Twill: diagonal ribs plus faint slubs along the weft.
      const twill = (x + y) % 4 < 2 ? 1 : 0.88;
      const f = shade * twill * (0.94 + 0.12 * slub((x + 0.5) / s, (y + 0.5) / s));
      const i = (y * s + x) * 4;
      img.data[i] = Math.round(clamp(c[0] * f, 0, 255));
      img.data[i + 1] = Math.round(clamp(c[1] * f, 0, 255));
      img.data[i + 2] = Math.round(clamp(c[2] * f, 0, 255));
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

// ---------------------------------------------------------------------------
// Living room
// ---------------------------------------------------------------------------




const gongfuTeaTable = defineItem({
  id: 'gongfu-tea-table',
  name: 'Gongfu tea table',
  category: 'living',
  type: 'surfaces',
  group: 'Coffee tables',
  tags: ['tea', 'gongfu', 'cha', 'tea tray', 'yixing', 'teapot', 'chinese', 'rosewood', 'kettle'],
  defaultSize: { w: 1.2, d: 0.6, h: 0.72 },
  minSize: { w: 0.9, d: 0.5, h: 0.6 },
  maxSize: { w: 1.8, d: 0.9, h: 0.95 },
  slots: [
    matSlot('wood', 'Table', 'hongmu'),
    matSlot('tray', 'Tea tray & kettle base', 'wujin-stone'),
    matSlot('clay', 'Teapot & caddy', 'yixing-clay'),
    matSlot('porcelain', 'Cups & kettle', 'white-porcelain'),
  ],
  build: ({ w, d, h }) => {
    const o = { plan: false };
    const tT = h - 0.19;
    const slab = 0.07;
    const lt = 0.075;
    const parts: Part[] = [span('wood', [-w / 2, w / 2], [tT - slab, tT], [-d / 2, d / 2], { bevel: 0.012 })];
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        parts.push(span('wood', ordered(sx * (w / 2 - 0.03 - lt), sx * (w / 2 - 0.03)), [0.04, tT - slab], ordered(sz * (d / 2 - 0.03 - lt), sz * (d / 2 - 0.03)), o));
        parts.push(span('wood', ordered(sx * (w / 2 - 0.05 - lt), sx * (w / 2 - 0.03)), [0, 0.045], ordered(sz * (d / 2 - 0.05 - lt), sz * (d / 2 - 0.03)), { bevel: 0.012, plan: false }));
      }
      parts.push(span('wood', ordered(sx * (w / 2 - 0.06), sx * (w / 2 - 0.035)), [tT - slab - 0.06, tT - slab], [-d / 2 + 0.1, d / 2 - 0.1], o));
    }
    for (const sz of [-1, 1]) parts.push(span('wood', [-w / 2 + 0.1, w / 2 - 0.1], [tT - slab - 0.06, tT - slab], ordered(sz * (d / 2 - 0.06), sz * (d / 2 - 0.035)), o));

    // Stone tea tray with drainage slats.
    const trW = clamp(w * 0.5, 0.36, 0.8);
    const trD = clamp(d * 0.62, 0.28, 0.5);
    const trX = -w * 0.06;
    const trZ = d / 2 - trD / 2 - 0.05;
    parts.push(span('tray', [trX - trW / 2, trX + trW / 2], [tT, tT + 0.03], [trZ - trD / 2, trZ + trD / 2], { bevel: 0.008, plan: false }));
    parts.push(
      ...slats('tray', [trX - trW / 2 + 0.025, trX + trW / 2 - 0.025], [tT + 0.03, tT + 0.038], [trZ - trD / 2 + 0.025, trZ + trD / 2 - 0.025], clamp(Math.round(trW / 0.03), 8, 26), {
        axis: 'x',
        gap: 0.35,
        plan: false,
      }),
    );
    const yTr = tT + 0.038;
    // Yixing teapot.
    const tpX = trX + trW * 0.16;
    const tpZ = trZ - trD * 0.12;
    parts.push(
      lathe('clay', [tpX, yTr, tpZ], [[0, 0], [0.035, 0], [0.055, 0.022], [0.052, 0.045], [0.03, 0.06], [0, 0.06]], { segments: 24, plan: false }),
      cyl('clay', [tpX, yTr + 0.062, tpZ], 0.028, 0.006, { plan: false }),
      sphere('clay', [tpX, yTr + 0.071, tpZ], 0.009, o),
      rod('clay', [tpX + 0.045, yTr + 0.02, tpZ], [tpX + 0.082, yTr + 0.058, tpZ], 0.007, o),
      torus('clay', [tpX - 0.062, yTr + 0.034, tpZ], 0.021, 0.006, { plan: false }),
    );
    // Fairness pitcher and a toad tea pet.
    parts.push(
      lathe('porcelain', [trX - trW * 0.2, yTr, tpZ], [[0, 0], [0.028, 0], [0.032, 0.05], [0.038, 0.075], [0.034, 0.077], [0.026, 0.055], [0, 0.055]], { segments: 20, plan: false }),
      sphere('clay', [trX - trW * 0.38, yTr + 0.013, tpZ + 0.02], 0.022, { scale: [1.2, 0.65, 1], plan: false }),
      sphere('clay', [trX - trW * 0.38, yTr + 0.022, tpZ + 0.038], 0.012, { scale: [1.3, 0.8, 1], plan: false }),
    );
    // A row of small cups.
    const nc = clamp(Math.round(trW / 0.1), 3, 7);
    for (const x of cells(nc, trX - trW / 2 + 0.04, trX + trW / 2 - 0.04)) {
      parts.push(lathe('porcelain', [x, yTr, trZ + trD * 0.26], [[0, 0], [0.014, 0], [0.024, 0.03], [0.021, 0.03], [0.012, 0.005], [0, 0.005]], { segments: 18, plan: false }));
    }
    // Tea caddy at the back left.
    parts.push(pot('clay', [-w / 2 + 0.12, tT, -d / 2 + 0.12], 0.045, 0.1, 'urn', { plan: false }));
    parts.push(sphere('clay', [-w / 2 + 0.12, tT + 0.108, -d / 2 + 0.12], 0.012, o));
    // Kettle on its warming base at the right.
    const kx = w / 2 - 0.12;
    const kz = -d * 0.05;
    const ky = tT + 0.02;
    parts.push(
      cyl('tray', [kx, tT + 0.01, kz], 0.085, 0.02, { segments: 28, plan: false }),
      lathe('porcelain', [kx, ky, kz], [[0, 0], [0.068, 0], [0.076, 0.03], [0.072, 0.09], [0.045, 0.11], [0, 0.11]], { segments: 28, plan: false }),
      sphere('porcelain', [kx, ky + 0.115, kz], 0.011, o),
      torus('tray', [kx, ky + 0.11, kz], 0.045, 0.006, { arc: Math.PI, plan: false }),
      rod('porcelain', [kx - 0.065, ky + 0.05, kz], [kx - 0.105, ky + 0.09, kz], 0.008, o),
    );
    return parts;
  },
  planDetail: ({ w, d }) => {
    const trW = clamp(w * 0.5, 0.36, 0.8);
    const trD = clamp(d * 0.62, 0.28, 0.5);
    const trX = -w * 0.06;
    const trZ = d / 2 - trD / 2 - 0.05;
    return [rectPoly(trX - trW / 2, trZ - trD / 2, trX + trW / 2, trZ + trD / 2), circle([w / 2 - 0.12, -d * 0.05], 0.085)];
  },
});

// ---------------------------------------------------------------------------
// Dining & kitchen
// ---------------------------------------------------------------------------

const roundTable = defineItem({
  id: 'round-table-lazy-susan',
  name: 'Round table with lazy susan',
  category: 'dining',
  type: 'surfaces',
  group: 'Dining tables',
  tags: ['round table', 'lazy susan', 'turntable', 'chinese', 'family dinner', 'banquet', 'dishes', 'chopsticks'],
  defaultSize: { w: 1.2, d: 1.2, h: 0.9 },
  minSize: { w: 0.8, d: 0.8, h: 0.82 },
  maxSize: { w: 1.8, d: 1.8, h: 0.95 },
  slots: [
    matSlot('wood', 'Table & chopsticks', 'hongmu'),
    matSlot('turntable', 'Lazy susan', 'glass-tinted'),
    matSlot('dishes', 'Dishes', 'qinghua-porcelain'),
    matSlot('food', 'Food', 'braised-food'),
  ],
  build: ({ w, d, h }) => {
    const o = { plan: false };
    const R = w / 2;
    const Rz = d / 2;
    const zs = d / w;
    const tT = h - 0.14;
    const rand = rng(168);
    const parts: Part[] = [
      cyl('wood', [0, tT - 0.0175, 0], R, 0.035, { segments: 56, scale: [1, 1, zs] }),
      ring('wood', [0, tT - 0.035, 0], R - 0.012, 0.012, { zScale: zs, plan: false }),
      cyl('wood', [0, tT - 0.075, 0], R * 0.86, 0.08, { segments: 48, scale: [1, 1, zs], plan: false }),
      ring('wood', [0, 0.16, 0], R * 0.74, 0.014, { zScale: zs, plan: false }),
    ];
    const nLeg = Math.max(R, Rz) > 0.7 ? 6 : 4;
    for (const k of range(nLeg)) {
      const a = Math.PI / 4 + (k * TAU) / nLeg;
      const x = Math.cos(a) * R * 0.74;
      const z = Math.sin(a) * Rz * 0.74;
      parts.push(vcyl('wood', x, z, 0.04, tT - 0.1, 0.028, { rTop: 0.034, plan: false }));
      parts.push(sphere('wood', [x, 0.032, z], 0.034, { scale: [1, 0.95, 1], plan: false }));
    }
    // Lazy susan and the shared dishes on it.
    const rt = Math.min(R, Rz) * 0.52;
    const f = clamp(rt / 0.31, 0.75, 1.3);
    const yt = tT + 0.029;
    parts.push(cyl('turntable', [0, tT + 0.008, 0], 0.11, 0.016, { segments: 24, plan: false }));
    parts.push(cyl('turntable', [0, tT + 0.0225, 0], rt, 0.013, { segments: 48, plan: false }));
    parts.push(pot('dishes', [0, yt, 0], 0.11 * f, 0.075, 'bowl', { plan: false }));
    parts.push(cyl('food', [0, yt + 0.062, 0], 0.098 * f, 0.004, { segments: 24, plan: false }));
    const ringR = rt * 0.66;
    const pr = Math.min(0.08, ringR * Math.sin(Math.PI / 8) * 1.05, rt - ringR - 0.008);
    const nd = clamp(Math.round((TAU * ringR) / 0.19), 4, 8);
    for (const i of range(nd)) {
      const a = (i * TAU) / nd + 0.3;
      const x = Math.cos(a) * ringR;
      const z = Math.sin(a) * ringR;
      parts.push(lathe('dishes', [x, yt, z], [[0, 0], [pr * 0.6, 0], [pr, 0.015], [pr * 0.92, 0.018], [pr * 0.55, 0.006], [0, 0.006]], { segments: 24, plan: false }));
      const kind = i % 3;
      if (kind === 0) {
        parts.push(sphere('food', [x, yt + 0.012, z], pr * 0.55, { scale: [1, 0.45, 1], plan: false }));
        parts.push(sphere('food', [x + pr * 0.2, yt + 0.022, z - pr * 0.1], pr * 0.25, o));
      } else if (kind === 1) {
        // Steamed whole fish, lying across the plate.
        const t = a + HALF_PI;
        parts.push(sphere('food', [x, yt + 0.016, z], 0.5, { scale: [pr * 1.3, 0.026, pr * 0.46], rotation: [0, -t, 0], plan: false }));
        parts.push(leaf('food', [x - Math.cos(t) * pr * 0.6, yt + 0.016, z - Math.sin(t) * pr * 0.6], pr * 0.32, pr * 0.34, t + Math.PI, HALF_PI, { thick: 0.004 }));
      } else {
        // Dumplings.
        for (const j of range(4)) {
          const b = (j * TAU) / 4 + 0.4;
          parts.push(sphere('food', [x + Math.cos(b) * pr * 0.42, yt + 0.014, z + Math.sin(b) * pr * 0.42], pr * 0.24, { scale: [1.3, 0.75, 0.9], plan: false }));
        }
      }
    }
    // Place settings round the edge: plate, rice bowl and chopsticks.
    const nP = clamp(Math.round((Math.PI * (R + Rz)) / 0.6), 4, 10);
    for (const i of range(nP)) {
      const a = (i * TAU) / nP + HALF_PI + rand() * 0.02;
      const at = (r: number, da = 0): V3 => [Math.cos(a + da) * (R - r), tT, Math.sin(a + da) * (Rz - r)];
      const p = at(0.11);
      parts.push(cyl('dishes', [p[0], tT + 0.005, p[2]], 0.06, 0.01, { rTop: 0.065, segments: 20, plan: false }));
      const b = at(0.13, -0.11);
      parts.push(pot('dishes', [b[0], tT, b[2]], 0.042, 0.045, 'bowl', { plan: false }));
      for (const off of [0.085, 0.1]) {
        const c0 = at(0.2, off);
        const c1 = at(0.03, off);
        parts.push(rod('wood', [c0[0], tT + 0.005, c0[2]], [c1[0], tT + 0.005, c1[2]], 0.0035, o));
      }
    }
    return parts;
  },
  planDetail: ({ w, d }) => [poly(ellipsePoints(0, 0, Math.min(w, d) * 0.26, Math.min(w, d) * 0.26, 32))],
});


const bambooSteamer = defineItem({
  id: 'bamboo-steamer-stack',
  name: 'Bamboo steamer stack',
  category: 'kitchen',
  type: 'appliances',
  group: 'Cooking',
  tags: ['steamer', 'bamboo', 'dim sum', 'bao', 'buns', 'wok', 'chinese', 'cookware'],
  defaultSize: { w: 0.34, d: 0.34, h: 0.36 },
  minSize: { w: 0.2, d: 0.2, h: 0.2 },
  maxSize: { w: 0.5, d: 0.5, h: 0.6 },
  slots: [
    matSlot('bamboo', 'Bamboo tiers', 'bamboo-cane'),
    matSlot('weave', 'Woven lid & floor', 'bamboo-weave'),
    matSlot('buns', 'Bao buns', 'bao-dough'),
    matSlot('wok', 'Wok', 'metal-anthracite'),
  ],
  build: ({ w, d, h }) => {
    const o = { plan: false };
    const R = Math.min(w, d) / 2;
    const rb = R * 0.8;
    const wall = clamp(rb * 0.05, 0.005, 0.01);
    const wokH = clamp(h * 0.16, 0.035, 0.08);
    const parts: Part[] = [
      lathe('wok', [0, 0, 0], [[0, 0], [R * 0.35, 0], [R * 0.75, wokH * 0.55], [R * 0.97, wokH], [R * 0.93, wokH], [R * 0.72, wokH * 0.6], [R * 0.33, 0.008], [0, 0.008]], { segments: 32 }),
    ];
    const yS0 = wokH * 0.75;
    const lidH = clamp(h * 0.1, 0.025, 0.05);
    const tilt = 0.18;
    const stackTop = h - (lidH * Math.cos(tilt) + 2 * rb * Math.sin(tilt)) - 0.004;
    const nT = clamp(Math.round((stackTop - yS0) / 0.08), 1, 5);
    const tierH = (stackTop - yS0) / nT;
    for (const i of range(nT)) {
      const y0 = yS0 + i * tierH;
      parts.push(
        lathe('bamboo', [0, y0, 0], [[rb - wall, 0], [rb, 0], [rb, tierH], [rb - wall, tierH], [rb - wall, 0]], { segments: 36, plan: false }),
        ring('bamboo', [0, y0 + 0.007, 0], rb, 0.004, o),
        ring('bamboo', [0, y0 + tierH - 0.007, 0], rb, 0.004, o),
      );
    }
    // Slatted floor of the top tier, with steamed buns.
    const yF = stackTop - tierH + 0.008;
    parts.push(cyl('weave', [0, yF, 0], rb - wall, 0.006, { segments: 32, plan: false }));
    const bR = Math.min(rb * 0.27, (tierH - 0.016) / 1.3);
    const buns: V2[] = rb > 0.09 ? [[0, 0], ...range(4).map((j) => [Math.cos((j * TAU) / 4 + 0.4) * rb * 0.5, Math.sin((j * TAU) / 4 + 0.4) * rb * 0.5] as V2)] : [[0, 0]];
    for (const [bx, bz] of buns) {
      parts.push(sphere('buns', [bx, yF + 0.003 + bR * 0.62, bz], bR, { scale: [1, 0.62, 1], plan: false }));
      parts.push(sphere('buns', [bx, yF + 0.003 + bR * 1.2, bz], bR * 0.2, o));
    }
    // Woven lid propped open at the front, resting on the back rim.
    const a = -tilt;
    const back = rotX([0, 0, -rb], a);
    const O: V3 = [0, stackTop - back[1], -rb - back[2]];
    const at = (v: V3): V3 => {
      const q = rotX(v, a);
      return [O[0] + q[0], O[1] + q[1], O[2] + q[2]];
    };
    const lc = at([0, lidH / 2, 0]);
    parts.push(
      lathe('weave', [lc[0], lc[1] - lidH / 2, lc[2]], [[0, 0], [rb - 0.004, 0], [rb - 0.004, lidH * 0.5], [rb * 0.82, lidH * 0.8], [rb * 0.45, lidH * 0.97], [0, lidH]], {
        segments: 36,
        rotation: [a, 0, 0],
        plan: false,
      }),
    );
    parts.push(torus('bamboo', at([0, lidH * 0.25, 0]), rb - 0.002, Math.min(0.006, lidH * 0.22), { rotation: [HALF_PI + a, 0, 0], plan: false }));
    return parts;
  },
  planDetail: ({ w, d }) => [circle([0, 0], (Math.min(w, d) / 2) * 0.8)],
});

// ---------------------------------------------------------------------------
// Hobbies
// ---------------------------------------------------------------------------

const mahjongTable = defineItem({
  id: 'mahjong-table',
  name: 'Mahjong table with tiles',
  category: 'hobbies',
  type: 'activities',
  group: 'Games',
  tags: ['mahjong', 'majiang', 'tiles', 'game table', 'chinese', 'card table', 'felt'],
  defaultSize: { w: 0.9, d: 0.9, h: 0.8 },
  minSize: { w: 0.8, d: 0.8, h: 0.72 },
  maxSize: { w: 1.0, d: 1.0, h: 0.85 },
  slots: [
    matSlot('wood', 'Table', 'hongmu'),
    matSlot('felt', 'Felt top', 'mahjong-felt'),
    matSlot('face', 'Tile faces & dice', 'mahjong-bone'),
    matSlot('back', 'Tile backs & marks', 'mahjong-jade'),
  ],
  build: ({ w, d, h }) => {
    const o = { plan: false };
    const tt = 0.02;
    const tl = 0.04;
    const tw = 0.03;
    const gap = 0.0015;
    const yF = h - 2 * tt - 0.004;
    const rim = 0.05;
    const top0 = yF - 0.035;
    const parts: Part[] = [
      span('wood', [-w / 2, w / 2], [top0, yF - 0.008], [-d / 2, d / 2], { bevel: 0.006 }),
      span('felt', [-w / 2 + rim, w / 2 - rim], [yF - 0.008, yF], [-d / 2 + rim, d / 2 - rim], o),
      span('wood', [-w / 2, w / 2], [yF - 0.008, yF + 0.012], [d / 2 - rim, d / 2], { bevel: 0.006, plan: false }),
      span('wood', [-w / 2, w / 2], [yF - 0.008, yF + 0.012], [-d / 2, -d / 2 + rim], { bevel: 0.006, plan: false }),
      span('wood', [-w / 2, -w / 2 + rim], [yF - 0.008, yF + 0.012], [-d / 2 + rim, d / 2 - rim], { bevel: 0.006, plan: false }),
      span('wood', [w / 2 - rim, w / 2], [yF - 0.008, yF + 0.012], [-d / 2 + rim, d / 2 - rim], { bevel: 0.006, plan: false }),
    ];
    // Aprons, each with a small chip drawer; square legs with low stretchers.
    const ai = 0.03;
    const yA: V2 = [top0 - 0.1, top0];
    parts.push(span('wood', [-w / 2 + ai, w / 2 - ai], yA, [d / 2 - ai - 0.02, d / 2 - ai], o));
    parts.push(span('wood', [-w / 2 + ai, w / 2 - ai], yA, [-d / 2 + ai, -d / 2 + ai + 0.02], o));
    parts.push(span('wood', [-w / 2 + ai, -w / 2 + ai + 0.02], yA, [-d / 2 + ai, d / 2 - ai], o));
    parts.push(span('wood', [w / 2 - ai - 0.02, w / 2 - ai], yA, [-d / 2 + ai, d / 2 - ai], o));
    parts.push(span('wood', [-0.12, 0.12], [top0 - 0.085, top0 - 0.015], [d / 2 - ai, d / 2 - ai + 0.012], o));
    parts.push(span('wood', [-0.12, 0.12], [top0 - 0.085, top0 - 0.015], [-d / 2 + ai - 0.012, -d / 2 + ai], o));
    parts.push(span('wood', [-w / 2 + ai - 0.012, -w / 2 + ai], [top0 - 0.085, top0 - 0.015], [-0.12, 0.12], o));
    parts.push(span('wood', [w / 2 - ai, w / 2 - ai + 0.012], [top0 - 0.085, top0 - 0.015], [-0.12, 0.12], o));
    const ky = top0 - 0.05;
    parts.push(sphere('face', [0, ky, d / 2 - ai + 0.018], 0.008, o));
    parts.push(sphere('face', [0, ky, -d / 2 + ai - 0.018], 0.008, o));
    parts.push(sphere('face', [-w / 2 + ai - 0.018, ky, 0], 0.008, o));
    parts.push(sphere('face', [w / 2 - ai + 0.018, ky, 0], 0.008, o));
    const lt = 0.05;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) parts.push(span('wood', ordered(sx * (w / 2 - ai), sx * (w / 2 - ai - lt)), [0, top0], ordered(sz * (d / 2 - ai), sz * (d / 2 - ai - lt)), o));
    }
    const sx0 = w / 2 - ai - lt / 2;
    const sz0 = d / 2 - ai - lt / 2;
    parts.push(span('wood', [-sx0, sx0], [0.1, 0.125], [sz0 - 0.01, sz0 + 0.01], o));
    parts.push(span('wood', [-sx0, sx0], [0.1, 0.125], [-sz0 - 0.01, -sz0 + 0.01], o));
    parts.push(span('wood', [sx0 - 0.01, sx0 + 0.01], [0.1, 0.125], [-sz0, sz0], o));
    parts.push(span('wood', [-sx0 - 0.01, -sx0 + 0.01], [0.1, 0.125], [-sz0, sz0], o));

    // Four tile walls, two tiles high, set out as a pinwheel square. Tiles lie face down.
    const half = Math.min(w, d) / 2 - rim - 0.1;
    const n = clamp(Math.floor((2 * half - tl) / (tw + gap)), 6, 17);
    const L = n * (tw + gap) + tl;
    const rot = (q: number, x: V2, z: V2): [V2, V2] => {
      if (q === 0) return [x, z];
      if (q === 1) return [z, [-x[1], -x[0]]];
      if (q === 2) return [[-x[1], -x[0]], [-z[1], -z[0]]];
      return [[-z[1], -z[0]], x];
    };
    const tile = (slot: string, q: number, x: V2, y: V2, z: V2) => {
      const [rx, rz] = rot(q, x, z);
      return span(slot, rx, y, rz, { bevel: 0.002, plan: false });
    };
    for (const q of range(4)) {
      const x0 = -L / 2;
      const z: V2 = [L / 2 - tl, L / 2];
      parts.push(tile('face', q, [x0, L / 2 - tl], [yF, yF + 1.6 * tt], z));
      parts.push(tile('back', q, [x0 - 0.0008, L / 2 - tl + 0.0008], [yF + 0.6 * tt, yF + tt], [z[0] - 0.0008, z[1] + 0.0008]));
      for (const i of range(n)) {
        const a = x0 + i * (tw + gap) + gap / 2;
        parts.push(tile('back', q, [a, a + tw], [yF + 1.6 * tt, yF + 2 * tt], z));
      }
    }
    // A few discarded tiles lying face up inside the walls, and a pair of dice.
    const inner = L / 2 - tl - 0.02;
    const discards: [number, number, number][] = [
      ...range(5).map((i) => [0, (i - 2) * (tw + 0.003), inner - tl / 2] as [number, number, number]),
      ...range(3).map((i) => [1, (i - 1) * (tw + 0.003), inner - tl / 2] as [number, number, number]),
    ];
    for (const [i, [q, u, v]] of discards.entries()) {
      const x: V2 = [u - tw / 2, u + tw / 2];
      const z: V2 = [v - tl / 2, v + tl / 2];
      parts.push(tile('back', q, x, [yF, yF + 0.4 * tt], z));
      parts.push(tile('face', q, x, [yF + 0.4 * tt, yF + tt], z));
      const kind = i % 3;
      const mx: V2 = kind === 2 ? [u - tw * 0.3, u + tw * 0.3] : kind === 1 ? [u - 0.002, u + 0.002] : [u - 0.006, u + 0.006];
      const mz: V2 = kind === 2 ? [v - 0.002, v + 0.002] : kind === 1 ? [v - tl * 0.32, v + tl * 0.32] : [v - 0.006, v + 0.006];
      const [rx, rz] = rot(q, mx, mz);
      parts.push(span('back', rx, [yF + tt, yF + tt + 0.0012], rz, o));
    }
    parts.push(box('face', [-0.03, yF + 0.008, -0.02], [0.016, 0.016, 0.016], { bevel: 0.003, rotation: [0, 0.4, 0], plan: false }));
    parts.push(box('face', [0.012, yF + 0.008, -0.04], [0.016, 0.016, 0.016], { bevel: 0.003, rotation: [0, -0.3, 0], plan: false }));
    return parts;
  },
  planDetail: ({ w, d }) => {
    const half = Math.min(w, d) / 2 - 0.15;
    const n = clamp(Math.floor((2 * half - 0.04) / 0.0315), 6, 17);
    const L = n * 0.0315 + 0.04;
    return [rectPoly(-w / 2 + 0.05, -d / 2 + 0.05, w / 2 - 0.05, d / 2 - 0.05), rectPoly(-L / 2, -L / 2, L / 2, L / 2)];
  },
});

// ---------------------------------------------------------------------------
// Decor
// ---------------------------------------------------------------------------


const floorVase = defineItem({
  id: 'porcelain-floor-vase',
  name: 'Blue-and-white floor vase',
  category: 'decor',
  type: 'decor',
  group: 'Ornaments',
  tags: ['vase', 'porcelain', 'blue and white', 'qinghua', 'ming', 'chinese', 'floor vase', 'jingdezhen'],
  defaultSize: { w: 0.42, d: 0.42, h: 0.95 },
  minSize: { w: 0.25, d: 0.25, h: 0.5 },
  maxSize: { w: 0.7, d: 0.7, h: 1.5 },
  slots: [
    matSlot('body', 'Porcelain', 'qinghua-porcelain'),
    matSlot('band', 'Bands & handles', 'cobalt-glaze'),
    matSlot('stand', 'Stand', 'hongmu'),
  ],
  build: ({ w, d, h }) => {
    const o = { plan: false };
    const R = Math.min(w, d) / 2;
    const sh = clamp(h * 0.09, 0.05, 0.12);
    const vh = h - sh;
    const vr = R * 0.86;
    const P = (r: number, y: number): V2 => [vr * r, vh * y];
    const parts: Part[] = [
      lathe('body', [0, sh, 0], [P(0, 0), P(0.5, 0), P(0.53, 0.025), P(0.48, 0.05), P(0.66, 0.18), P(0.92, 0.38), P(1, 0.5), P(0.9, 0.63), P(0.62, 0.74), P(0.4, 0.8), P(0.36, 0.86), P(0.42, 0.95), P(0.52, 0.99), P(0.49, 1), P(0.38, 0.97)], {
        segments: 44,
      }),
      ring('band', [0, sh + vh * 0.8, 0], vr * 0.4, 0.006, o),
      ring('band', [0, sh + vh * 0.645, 0], vr * 0.86, 0.006, o),
      ring('band', [0, sh + vh * 0.05, 0], vr * 0.48, 0.006, o),
      ring('band', [0, sh + vh * 0.985, 0], vr * 0.5, 0.006, o),
    ];
    // Lion-mask ring handles on the shoulder.
    const hr = clamp(vr * 0.16, 0.02, 0.05);
    for (const sx of [-1, 1]) {
      parts.push(sphere('band', [sx * vr * 0.8, sh + vh * 0.68, 0], hr * 0.6, { scale: [0.55, 1, 1], plan: false }));
      parts.push(torus('band', [sx * vr * 0.82, sh + vh * 0.68 - hr * 0.9, 0], hr, hr * 0.18, { rotation: [0, HALF_PI, 0], plan: false }));
    }
    // Carved rosewood stand.
    parts.push(cyl('stand', [0, sh - 0.012, 0], R * 0.62, 0.024, { segments: 32, plan: false }));
    parts.push(ring('stand', [0, 0.012, 0], R * 0.55, 0.012, o));
    for (const k of range(5)) {
      const a = (k * TAU) / 5 + HALF_PI;
      const x = Math.cos(a) * R * 0.55;
      const z = Math.sin(a) * R * 0.55;
      parts.push(vcyl('stand', x, z, 0.012, sh - 0.024, 0.011, { rTop: 0.016, plan: false }));
    }
    return parts;
  },
  planDetail: ({ w, d }) => [circle([0, 0], (Math.min(w, d) / 2) * 0.86 * 0.5)],
});

const lanternPair = defineItem({
  id: 'red-lantern-pair',
  name: 'Red silk lantern pair',
  category: 'lighting',
  type: 'lighting',
  group: 'Ceiling lights',
  tags: ['lantern', 'denglong', 'red', 'chinese new year', 'festival', 'silk', 'tassel', 'pendant'],
  mount: 'ceiling',
  defaultElevation: 1.9,
  defaultSize: { w: 0.9, d: 0.42, h: 0.8 },
  minSize: { w: 0.5, d: 0.25, h: 0.5 },
  maxSize: { w: 1.6, d: 0.7, h: 1.2 },
  slots: [
    matSlot('light', 'Glowing silk', 'lantern-silk'),
    matSlot('trim', 'Gilt caps', 'gilt-bronze'),
    matSlot('tassel', 'Cords & tassels', 'tassel-silk'),
  ],
  light: { color: '#ff4a26', intensity: 0.9, distance: 3.5, y: 0.47 },
  build: ({ w, d, h }) => {
    const o = { plan: false };
    const lr = Math.min(w / 4 - 0.01, d / 2 - 0.005);
    const cordLen = h * 0.14;
    const capH = 0.03;
    const bodyH = h * 0.46;
    const yCap1 = h - cordLen;
    const yB1 = yCap1 - capH;
    const yB0 = yB1 - bodyH;
    const yCap0 = yB0 - capH;
    const fringeTop = Math.max(0.06, yCap0 * 0.6);
    const parts: Part[] = [];
    for (const sx of [-1, 1]) {
      const cx = (sx * w) / 4;
      parts.push(
        cyl('trim', [cx, h - 0.008, 0], 0.035, 0.016, o),
        vcyl('tassel', cx, 0, yCap1, h - 0.016, 0.004, o),
        sphere('trim', [cx, yCap1 + cordLen * 0.45, 0], 0.012, o),
      );
      // Ribbed silk body: eight lobes round the axis.
      const s = 2 * lr;
      for (const k of range(8)) {
        const a = (k / 8) * TAU;
        parts.push(sphere('light', [cx + Math.cos(a) * s * 0.2, (yB0 + yB1) / 2, Math.sin(a) * s * 0.2], 0.5, { scale: [s * 0.56, bodyH, s * 0.36], rotation: [0, -a, 0], plan: k === 0 }));
      }
      parts.push(
        cyl('trim', [cx, yB1 + capH / 2, 0], lr * 0.36, capH, { rTop: lr * 0.3, segments: 24, plan: false }),
        cyl('trim', [cx, yB0 - capH / 2, 0], lr * 0.3, capH, { rTop: lr * 0.36, segments: 24, plan: false }),
        sphere('tassel', [cx, yCap0 - 0.016, 0], 0.015, o),
        vcyl('tassel', cx, 0, fringeTop, yCap0 - 0.016, 0.004, o),
        cyl('trim', [cx, fringeTop, 0], 0.013, 0.014, o),
        cyl('tassel', [cx, (0.006 + fringeTop) / 2, 0], Math.min(lr * 0.28, 0.05), fringeTop - 0.006, { rTop: 0.011, segments: 20, plan: false }),
      );
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const lr = Math.min(w / 4 - 0.01, d / 2 - 0.005);
    return [circle([-w / 4, 0], lr), circle([w / 4, 0], lr)];
  },
});


const moneyTree = defineItem({
  id: 'money-tree',
  name: 'Money tree (pachira)',
  category: 'decor',
  type: 'plants',
  group: 'Indoor plants',
  tags: ['money tree', 'pachira', 'fa cai shu', 'braided', 'feng shui', 'plant', 'lucky', 'chinese'],
  defaultSize: { w: 0.75, d: 0.75, h: 1.4 },
  minSize: { w: 0.35, d: 0.35, h: 0.7 },
  maxSize: { w: 1.0, d: 1.0, h: 2.2 },
  slots: [
    matSlot('leaves', 'Leaves', 'plant-leaf'),
    matSlot('trunk', 'Braided trunk & soil', 'pachira-bark'),
    matSlot('pot', 'Pot', 'qinghua-porcelain'),
    matSlot('ribbon', 'Red ribbon', 'tassel-silk'),
  ],
  build: ({ w, d, h }) => {
    const o = { plan: false };
    const R = Math.min(w, d) / 2;
    const rand = rng(888);
    const potR = clamp(R * 0.55, 0.09, 0.26);
    const potH = clamp(h * 0.2, 0.12, 0.38);
    const parts: Part[] = [pot('pot', [0, 0, 0], potR, potH, 'taper'), cyl('trunk', [0, potH * 0.92, 0], potR * 0.88, 0.012, o)];
    // Five stems braided together, splaying at the top.
    const yBase = potH * 0.9;
    const yTop = yBase + (h - yBase) * 0.36;
    const sr = clamp(h * 0.011, 0.008, 0.02);
    const tips: V3[] = [];
    // Swollen caudex at the foot of the braid.
    parts.push(lathe('trunk', [0, yBase, 0], [[0, 0], [sr * 3.4, 0], [sr * 3.1, (yTop - yBase) * 0.06], [sr * 2.2, (yTop - yBase) * 0.16], [0, (yTop - yBase) * 0.18]], { segments: 16, plan: false }));
    for (const k of range(5)) {
      const pts: V3[] = range(7).map((i) => {
        const t = i / 6;
        const a = (k / 5) * TAU + t * TAU * 1.1;
        const rb = sr * 1.3 + t ** 4 * R * 0.15;
        return [Math.cos(a) * rb, lerp(yBase, yTop, t), Math.sin(a) * rb];
      });
      parts.push(...rodPath('trunk', pts, sr));
      tips.push(pts[6]);
    }
    // Long petioles carrying palmate clusters of five leaflets.
    const Ll = clamp(R * 0.4, 0.07, 0.24);
    const lw = Ll * 0.38;
    const reach = R - Ll - lw * 0.6 - 0.008;
    const yHi = h - Ll * 0.45 - lw * 0.6;
    for (const tip of tips) {
      for (const j of range(3)) {
        const az = Math.atan2(tip[2], tip[0]) + (j - 1) * 0.8 + (rand() - 0.5) * 0.4;
        const rc = reach * lerp(0.55, 1, rand());
        const yc = lerp(yTop + (yHi - yTop) * 0.15, yHi, rand());
        const c: V3 = [Math.cos(az) * rc, yc, Math.sin(az) * rc];
        parts.push(rod('leaves', tip, c, sr * 0.35, o));
        for (const m of range(5)) parts.push(leaf('leaves', c, Ll * lerp(0.75, 1, rand()), lw, az + (m - 2) * 0.55, lerp(1.25, 1.62, rand())));
      }
    }
    // A red ribbon bow tied round the braid.
    const ry = lerp(yBase, yTop, 0.38);
    const bl = sr * 1.8;
    parts.push(
      ring('ribbon', [0, ry, 0], sr * 2.6, sr * 0.5, o),
      torus('ribbon', [-bl, ry + bl * 0.4, sr * 2.8], bl, sr * 0.35, { rotation: [0, 0, 0.5], plan: false }),
      torus('ribbon', [bl, ry + bl * 0.4, sr * 2.8], bl, sr * 0.35, { rotation: [0, 0, -0.5], plan: false }),
      sphere('ribbon', [0, ry, sr * 2.9], sr * 0.7, o),
    );
    return parts;
  },
  planDetail: ({ w, d }) => [circle([0, 0], (Math.min(w, d) / 2) * 0.9)],
});

const luckyBamboo = defineItem({
  id: 'lucky-bamboo',
  name: 'Lucky bamboo in vase',
  category: 'decor',
  type: 'plants',
  group: 'Indoor plants',
  tags: ['lucky bamboo', 'fu gui zhu', 'dracaena', 'bamboo', 'feng shui', 'glass vase', 'pebbles', 'chinese'],
  defaultSize: { w: 0.28, d: 0.28, h: 0.75 },
  minSize: { w: 0.15, d: 0.15, h: 0.4 },
  maxSize: { w: 0.5, d: 0.5, h: 1.4 },
  slots: [
    matSlot('stalk', 'Stalks', 'lucky-bamboo-stalk'),
    matSlot('leaves', 'Leaves', 'plant-leaf-light'),
    matSlot('vase', 'Vase & pebbles', 'glass-clear'),
    matSlot('ribbon', 'Gold ribbon', 'gilt-bronze'),
  ],
  build: ({ w, d, h }) => {
    const o = { plan: false };
    const R = Math.min(w, d) / 2;
    const rand = rng(8);
    const vr = R * 0.58;
    const vh = clamp(h * 0.24, 0.08, 0.3);
    const parts: Part[] = [pot('vase', [0, 0, 0], vr, vh, 'cylinder')];
    for (const i of range(8)) {
      const a = (i / 8) * TAU + rand();
      const rr = vr * 0.5 * Math.sqrt(rand());
      parts.push(sphere('vase', [Math.cos(a) * rr, 0.012 + vr * 0.12 + rand() * vr * 0.1, Math.sin(a) * rr], vr * 0.22, { scale: [1, 0.6, 1], plan: false }));
    }
    // Eight stalks (a lucky number) in three tiers, tied with a gold ribbon.
    const sr = clamp(R * 0.075, 0.006, 0.012);
    const rp = vr * 0.42;
    const Ll = Math.min(clamp(h * 0.11, 0.04, 0.13), (R - rp - 0.006) / 1.2);
    const lw = Ll * 0.3;
    const top = h - Ll * 0.9 - lw * 0.6;
    const tiers = [1, 0.8, 0.62, 0.8, 0.62, 0.8, 0.62, 0.62];
    const lowest = vh + 0.06;
    for (const i of range(8)) {
      const a = ((i - 1) / 7) * TAU;
      const x = i === 0 ? 0 : Math.cos(a) * rp;
      const z = i === 0 ? 0 : Math.sin(a) * rp;
      const yt = lerp(lowest, top, tiers[i]);
      parts.push(vcyl('stalk', x, z, 0.01, yt, sr, { plan: false }));
      const nn = clamp(Math.floor((yt - vh) / 0.11), 0, 3);
      for (const j of range(nn)) parts.push(cyl('stalk', [x, vh + 0.05 + j * 0.11, z], sr * 1.22, 0.007, o));
      for (const m of range(3)) parts.push(leaf('leaves', [x, yt - 0.01, z], Ll * lerp(0.8, 1, rand()), lw, a + (m * TAU) / 3 + rand() * 0.6, lerp(0.5, 1.0, rand())));
    }
    const ry = vh + 0.035;
    const rr = rp + sr + 0.004;
    parts.push(
      ring('ribbon', [0, ry, 0], rr, 0.004, o),
      torus('ribbon', [-0.012, ry + 0.008, rr], 0.01, 0.002, { rotation: [0, 0, 0.6], plan: false }),
      torus('ribbon', [0.012, ry + 0.008, rr], 0.01, 0.002, { rotation: [0, 0, -0.6], plan: false }),
    );
    return parts;
  },
  planDetail: ({ w, d }) => [circle([0, 0], (Math.min(w, d) / 2) * 0.58)],
});


const goldfishBowl = defineItem({
  id: 'goldfish-bowl',
  name: 'Goldfish bowl',
  category: 'decor',
  type: 'decor',
  group: 'Ornaments',
  tags: ['goldfish', 'fish bowl', 'porcelain', 'blue and white', 'chinese', 'feng shui', 'aquarium', 'pond'],
  defaultSize: { w: 0.55, d: 0.55, h: 0.55 },
  minSize: { w: 0.3, d: 0.3, h: 0.3 },
  maxSize: { w: 1.0, d: 1.0, h: 1.0 },
  slots: [
    matSlot('bowl', 'Porcelain bowl', 'qinghua-porcelain'),
    matSlot('water', 'Water', 'water'),
    matSlot('fish', 'Goldfish', 'goldfish-orange'),
    matSlot('stand', 'Stand', 'hongmu'),
  ],
  build: ({ w, d, h }) => {
    const o = { plan: false };
    const R = Math.min(w, d) / 2;
    const sh = clamp(h * 0.18, 0.05, 0.14);
    const bh = h - sh;
    const rb = R * 0.97;
    const lip = clamp(rb * 0.05, 0.01, 0.03);
    const yw = bh * 0.86;
    const parts: Part[] = [
      lathe('bowl', [0, sh, 0], [[0, 0], [rb * 0.56, 0], [rb * 0.6, bh * 0.03], [rb * 0.82, bh * 0.3], [rb * 0.96, bh * 0.68], [rb, bh * 0.94], [rb, bh], [rb - lip, bh], [rb - lip, bh * 0.94], [rb * 0.95 - lip, bh * 0.68], [rb * 0.8 - lip, bh * 0.35], [0, bh * 0.35]], {
        segments: 44,
      }),
      ring('bowl', [0, sh + bh - lip * 0.5, 0], rb - lip / 2, lip * 0.5, o),
    ];
    const rw = 0.98 * rb - lip - 0.002;
    parts.push(cyl('water', [0, sh + yw - 0.003, 0], rw, 0.006, { segments: 40, plan: false }));
    // Fantail goldfish just under the surface.
    const rand = rng(21);
    const n = clamp(Math.round(rw / 0.07), 3, 6);
    const fl = clamp(rw * 0.32, 0.04, 0.13);
    for (const i of range(n)) {
      const head = rand() * TAU;
      const a = (i / n) * TAU + rand() * 0.5;
      const rp = (rw - fl) * 0.75 * Math.sqrt(0.2 + 0.8 * rand());
      // Backs and dorsal fins just break the surface so the fish read from above.
      const c: V3 = [Math.cos(a) * rp, sh + yw - fl * 0.06, Math.sin(a) * rp];
      const ux = Math.cos(head);
      const uz = Math.sin(head);
      const tail: V3 = [c[0] - ux * fl * 0.28, c[1], c[2] - uz * fl * 0.28];
      parts.push(
        sphere('fish', c, 0.5, { scale: [fl * 0.62, fl * 0.26, fl * 0.3], rotation: [0, -head, 0], plan: false }),
        leaf('fish', tail, fl * 0.42, fl * 0.28, head + Math.PI + 0.45, 1.35, { thick: 0.003 }),
        leaf('fish', tail, fl * 0.42, fl * 0.28, head + Math.PI - 0.45, 1.35, { thick: 0.003 }),
        leaf('fish', [c[0], c[1] + fl * 0.1, c[2]], fl * 0.2, fl * 0.12, head + Math.PI, 0.75, { thick: 0.003 }),
      );
    }
    // Rosewood stand.
    parts.push(cyl('stand', [0, sh - 0.012, 0], R * 0.72, 0.024, { segments: 36, plan: false }));
    parts.push(ring('stand', [0, 0.012, 0], R * 0.62, 0.012, o));
    for (const k of range(5)) {
      const ang = (k * TAU) / 5 + HALF_PI;
      const x = Math.cos(ang) * R * 0.62;
      const z = Math.sin(ang) * R * 0.62;
      parts.push(vcyl('stand', x, z, 0.02, sh - 0.024, 0.013, { rTop: 0.017, plan: false }));
      parts.push(sphere('stand', [x, 0.02, z], 0.02, o));
    }
    return parts;
  },
  planDetail: ({ w, d }) => [circle([0, 0], (Math.min(w, d) / 2) * 0.85)],
});

export default definePack({
  name: 'Chinese home',
  version: '1.0.0',
  author: 'Neest team',
  description:
    'A gongfu tea table, a family round table with a lazy susan, a mahjong table, a bamboo steamer, a blue-and-white vase, red silk lanterns, a goldfish bowl and lucky plants.',
  license: 'CC0 (made for Neest)',
  items: [
    roundTable,
    mahjongTable,
    floorVase,
    lanternPair,
    gongfuTeaTable,
    moneyTree,
    luckyBamboo,
    bambooSteamer,
    goldfishBowl,
  ],
  patterns: [
    { id: 'qinghua', name: 'Blue-and-white porcelain', normalStrength: 0.05, colored: true, draw: drawQinghua },
    { id: 'lacquer-clouds', name: 'Red lacquer with gold clouds', normalStrength: 0.15, colored: true, draw: drawLacquerClouds },
    { id: 'hongmu-grain', name: 'Hongmu rosewood grain', normalStrength: 0.3, draw: drawHongmuGrain },
    { id: 'silk-brocade', name: 'Silk brocade', normalStrength: 0.5, colored: true, draw: drawBrocade },
  ],
  materials: [
    { id: 'qinghua-porcelain', name: 'Blue-and-white porcelain', category: 'tile', color: '#ffffff', roughness: 0.12, pattern: { id: 'qinghua', scale: 0.32 } },
    { id: 'white-porcelain', name: 'White porcelain glaze', category: 'tile', color: '#f3f0e8', roughness: 0.1 },
    { id: 'cobalt-glaze', name: 'Cobalt glaze', category: 'tile', color: '#1d3a8a', roughness: 0.14 },
    { id: 'gold-cloud-lacquer', name: 'Red lacquer with gold clouds', category: 'wood', color: '#ffffff', roughness: 0.24, pattern: { id: 'lacquer-clouds', scale: 0.45 } },
    { id: 'cinnabar-lacquer', name: 'Cinnabar lacquer', category: 'wood', color: '#9a1f18', roughness: 0.28 },
    { id: 'black-lacquer', name: 'Black lacquer', category: 'wood', color: '#161213', roughness: 0.18 },
    { id: 'hongmu', name: 'Hongmu rosewood', category: 'wood', color: '#5a2a1b', roughness: 0.42, pattern: { id: 'hongmu-grain', scale: 0.5 } },
    { id: 'huanghuali', name: 'Huanghuali', category: 'wood', color: '#9a6436', roughness: 0.45, pattern: { id: 'hongmu-grain', scale: 0.5, contrast: 0.85 } },
    { id: 'silk-brocade', name: 'Silk brocade', category: 'fabric', color: '#ffffff', roughness: 0.55, pattern: { id: 'silk-brocade', scale: 0.25 } },
    { id: 'lantern-silk', name: 'Glowing lantern silk', category: 'fabric', color: '#e0301e', roughness: 0.7, emissive: '#ff3b1f', emissiveIntensity: 1.6, pattern: { id: 'weave', scale: 0.1, contrast: 0.3 } },
    { id: 'tassel-silk', name: 'Red silk cord', category: 'fabric', color: '#b3161b', roughness: 0.6, pattern: { id: 'weave', scale: 0.05, contrast: 0.3 } },
    { id: 'gilt-bronze', name: 'Gilt bronze', category: 'metal', color: '#c99c3f', roughness: 0.32, metalness: 0.85 },
    { id: 'mahjong-bone', name: 'Mahjong tile face', category: 'solid', color: '#f1ead6', roughness: 0.22 },
    { id: 'mahjong-jade', name: 'Mahjong tile back', category: 'solid', color: '#13866f', roughness: 0.22 },
    { id: 'mahjong-felt', name: 'Mahjong felt', category: 'fabric', color: '#2b6a45', roughness: 0.95, pattern: { id: 'weave', scale: 0.06, contrast: 0.4 } },
    { id: 'xuan-paper', name: 'Xuan paper', category: 'solid', color: '#efe5cc', roughness: 0.9, pattern: { id: 'plaster', scale: 0.4, contrast: 0.3 } },
    { id: 'sumi-ink', name: 'Sumi ink', category: 'solid', color: '#151312', roughness: 0.55 },
    { id: 'mount-silk', name: 'Scroll mounting silk', category: 'fabric', color: '#b7bfae', roughness: 0.7, pattern: { id: 'weave', scale: 0.05, contrast: 0.35 } },
    { id: 'yixing-clay', name: 'Yixing purple clay', category: 'tile', color: '#6e3324', roughness: 0.6, pattern: { id: 'granite', scale: 0.1, contrast: 0.3 } },
    { id: 'wujin-stone', name: 'Black tea-tray stone', category: 'stone', color: '#22201f', roughness: 0.5, pattern: { id: 'slate', scale: 0.4, contrast: 0.5 } },
    { id: 'bamboo-cane', name: 'Steamer bamboo', category: 'wood', color: '#d1b276', roughness: 0.6, pattern: { id: 'wood-grain', scale: 0.15, contrast: 0.6 } },
    { id: 'bamboo-weave', name: 'Woven bamboo', category: 'wood', color: '#c9a565', roughness: 0.7, pattern: { id: 'jute', scale: 0.08 } },
    { id: 'bao-dough', name: 'Steamed bun dough', category: 'solid', color: '#f5efe2', roughness: 0.8 },
    { id: 'braised-food', name: 'Braised dishes', category: 'solid', color: '#8f3d1c', roughness: 0.45 },
    { id: 'lucky-bamboo-stalk', name: 'Lucky bamboo stalk', category: 'solid', color: '#7aa63a', roughness: 0.45 },
    { id: 'pachira-bark', name: 'Money tree bark', category: 'wood', color: '#8b7d55', roughness: 0.85, pattern: { id: 'wood-grain', scale: 0.2, contrast: 0.6 } },
    { id: 'goldfish-orange', name: 'Goldfish scales', category: 'solid', color: '#ff6a12', roughness: 0.35 },
    { id: 'carved-stone', name: 'Carved granite', category: 'stone', color: '#b8b2a6', roughness: 0.85, pattern: { id: 'granite', scale: 0.4, contrast: 0.7 } },
  ],
});

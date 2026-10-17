/**
 * Café dining set — modelled on a Vietnamese café corner: a rustic pine plank table on splayed
 * trestle legs with honey-coloured cross-back bentwood chairs and woven taupe seats, plus the
 * condiment caddy that sits on it (chopstick cup, spoons, napkin box, stacked bowls, brown glazed
 * jars and pottery bottles).
 */
import {
  clamp,
  cushion,
  defineItem,
  definePack,
  lathe,
  line,
  matSlot,
  range,
  ring,
  rng,
  rod,
  rodPath,
  span,
  sphere,
  vcyl,
  type Part,
  type V3,
} from '@/packs/kit';

// ── Placement helper ─────────────────────────────────────────────────────────

/** Moves parts by (dx, dz); `flip` turns them 180° about the vertical axis first. */
function place(parts: Part[], dx: number, dz: number, flip: boolean): Part[] {
  return parts.map((p) => {
    const [x, y, z] = p.position;
    const q: Part = { ...p, position: flip ? [dx - x, y, dz - z] : [dx + x, y, dz + z] };
    if (flip) {
      // Ry(π)·Rx(a)·Ry(b)·Rz(c) = Rx(−a)·Ry(π+b)·Rz(c)
      const r = p.rotation ?? [0, 0, 0];
      q.rotation = [-r[0], r[1] + Math.PI, r[2]];
    }
    return q;
  });
}

// ── Cross-back bentwood chair ────────────────────────────────────────────────

interface ChairSlots {
  wood: string;
  seat: string;
  feet: string;
}

/** Cross-back bistro chair facing +z, w × d × h, origin at the floor centre. */
function chairParts(w: number, d: number, h: number, s: ChairSlots): Part[] {
  const sx = w / 0.44;
  const sz = d / 0.5;
  const seat = clamp(h * 0.52, 0.38, 0.5);
  const r = 0.016;
  const fxTop = 0.18 * sx;
  const fxBot = 0.195 * sx;
  const bx = 0.17 * sx;
  const parts: Part[] = [];
  for (const side of [-1, 1]) {
    // Front legs splay slightly outwards and forwards.
    parts.push(rod(s.wood, [side * fxBot, 0.012, 0.2 * sz], [side * fxTop, seat - 0.035, 0.17 * sz], r, { plan: false }));
    // Back legs run on up as the back posts, raked back a little.
    parts.push(
      ...rodPath(
        s.wood,
        [
          [side * fxBot * 0.97, 0.012, -0.2 * sz],
          [side * bx, seat - 0.02, -0.17 * sz],
          [side * bx, h - 0.045, -0.215 * sz],
        ],
        r,
      ),
    );
    // Rubber feet.
    parts.push(vcyl(s.feet, side * fxBot, 0.2 * sz, 0, 0.014, r + 0.002, { plan: false }));
    parts.push(vcyl(s.feet, side * fxBot * 0.97, -0.2 * sz, 0, 0.014, r + 0.002, { plan: false }));
    // Bentwood brace curling from the front leg up under the seat.
    parts.push(rod(s.wood, [side * 0.183 * sx, seat - 0.16, 0.175 * sz], [side * 0.09 * sx, seat - 0.05, 0.19 * sz], 0.011, { plan: false }));
  }
  // Seat ring under the woven cushion.
  parts.push(ring(s.wood, [0, seat - 0.04, 0.01 * sz], 0.2 * Math.min(sx, sz) * 1.0, 0.012, { zScale: sz / Math.min(sx, sz) * (sx / Math.max(sx, sz)), plan: false }));
  parts.push(cushion(s.seat, [-0.205 * sx, 0.205 * sx], [seat - 0.03, seat + 0.025], [-0.19 * sz, 0.215 * sz], { softness: 0.4 }));
  // X back and a low back rail.
  parts.push(rod(s.wood, [-bx, seat + 0.04, -0.183 * sz], [bx, h - 0.075, -0.21 * sz], 0.013, { plan: false }));
  parts.push(rod(s.wood, [bx, seat + 0.04, -0.183 * sz], [-bx, h - 0.075, -0.21 * sz], 0.013, { plan: false }));
  parts.push(rod(s.wood, [-bx, seat + 0.045, -0.18 * sz], [bx, seat + 0.045, -0.18 * sz], 0.012, { plan: false }));
  // Crest rail bowing gently backwards between the post tops.
  const crest: V3[] = range(5).map((i) => {
    const t = -1 + (i * 2) / 4;
    return [t * bx, h - 0.04, -0.215 * sz - 0.022 * sz * (1 - t * t)];
  });
  parts.push(...rodPath(s.wood, crest, 0.018));
  return parts;
}

// ── Rustic plank table ───────────────────────────────────────────────────────

/** Plank-top table on splayed trestle ends, centred at (0, 0). */
function tableParts(w: number, d: number, h: number, top: string, frame: string): Part[] {
  const t = 0.035;
  const gap = 0.006;
  const n = clamp(Math.round(d / 0.15), 3, 6);
  const pw = (d - gap * (n - 1)) / n;
  const rand = rng(17);
  const parts: Part[] = [];
  for (const i of range(n)) {
    const z0 = -d / 2 + i * (pw + gap);
    // Planks sit a hair proud of one another, like real boards.
    const dy = (rand() - 0.5) * 0.002;
    parts.push(span(top, [-w / 2, w / 2], [h - t + dy, h + dy - 0.001], [z0, z0 + pw], { bevel: 0.004 }));
  }
  const endX = w / 2 - Math.min(0.13, w * 0.12);
  const H = h - t - 0.04;
  for (const sx of [-1, 1]) {
    const x = sx * endX;
    // Cleat under the planks that the legs hang from.
    parts.push(span(frame, [x - 0.03, x + 0.03], [h - t - 0.04, h - t], [-(d / 2 - 0.05), d / 2 - 0.05], { plan: false }));
    // Two legs per end, splayed outwards towards the floor.
    const zt = Math.min(0.1, d * 0.15);
    const zb = d / 2 - 0.045;
    for (const sz of [-1, 1]) {
      const a = Math.atan2(sz * (zt - zb), H);
      const L = Math.hypot(H, zb - zt);
      parts.push({
        shape: 'box',
        size: [0.045, L, 0.05],
        position: [x, H / 2, sz * (zt + zb) / 2],
        rotation: [a, 0, 0],
        slot: frame,
        plan: false,
      });
    }
    // Low stretcher between the two legs of an end.
    const yS = 0.13;
    const zAt = zb + (zt - zb) * (yS / H);
    parts.push(span(frame, [x - 0.02, x + 0.02], [yS - 0.02, yS + 0.02], [-zAt, zAt], { plan: false }));
  }
  // Long rail tying the two ends together.
  parts.push(span(frame, [-endX, endX], [0.11, 0.15], [-0.02, 0.02], { plan: false }));
  return parts;
}

// ── Table with four (or six) chairs ──────────────────────────────────────────

const diningSet = defineItem({
  id: 'cafe-dining-set',
  name: 'Café plank table with cross-back chairs',
  category: 'dining',
  type: 'surfaces',
  group: 'Dining tables',
  tags: ['dining set', 'table and chairs', 'cafe', 'café', 'bistro', 'cross back', 'plank table'],
  defaultSize: { w: 1.5, d: 1.4, h: 0.88 },
  minSize: { w: 1.1, d: 1.2, h: 0.82 },
  maxSize: { w: 2.6, d: 1.7, h: 0.95 },
  slots: [
    matSlot('top', 'Plank top', 'pine-weathered'),
    matSlot('frame', 'Table legs', 'pine-frame'),
    matSlot('chair', 'Chair frames & feet', 'bentwood-honey'),
    matSlot('seat', 'Seat pads', 'seat-taupe'),
  ],
  build: ({ w, d, h }) => {
    const td = clamp(d - 0.75, 0.5, 1.0);
    const th = Math.min(0.76, h - 0.12);
    const tw = w - 0.06;
    const parts: Part[] = tableParts(tw, td, th, 'top', 'frame');
    const perSide = w >= 2.2 ? 3 : 2;
    const cw = 0.44;
    const cd = 0.48;
    const zc = td / 2 + 0.11;
    const xs = range(perSide).map((i) => -tw / 2 + ((i + 0.5) * tw) / perSide);
    const one = chairParts(cw, cd, h, { wood: 'chair', seat: 'seat', feet: 'chair' });
    for (const x of xs) {
      parts.push(...place(one, x, zc, true)); // front row faces back towards the table
      parts.push(...place(one, x, -zc, false)); // back row faces forward
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const td = clamp(d - 0.75, 0.5, 1.0);
    return [line([-(w - 0.06) / 2, 0], [(w - 0.06) / 2, 0]), line([-(w - 0.06) / 2, -td / 2], [(w - 0.06) / 2, -td / 2])];
  },
});

// ── Condiment caddy ──────────────────────────────────────────────────────────

const caddy = defineItem({
  id: 'table-caddy',
  name: 'Table condiment caddy',
  category: 'dining',
  type: 'decor',
  group: 'Candles & tabletop',
  tags: ['chopsticks', 'spoons', 'condiments', 'bowls', 'sauce', 'jar', 'cafe', 'café', 'tabletop'],
  defaultSize: { w: 0.5, d: 0.22, h: 0.3 },
  minSize: { w: 0.4, d: 0.18, h: 0.24 },
  maxSize: { w: 0.62, d: 0.28, h: 0.36 },
  slots: [
    matSlot('wood', 'Wooden pieces', 'bentwood-honey'),
    matSlot('ceramic', 'Bowls & bottles', 'ceramic-cream'),
    matSlot('glaze', 'Glazed jars', 'glaze-brown'),
    matSlot('accent', 'Chopsticks & bands', 'chopstick-dark'),
  ],
  build: ({ w, d, h }) => {
    // Everything is laid out in a 0.5 × 0.22 × 0.3 box and scaled uniformly to fit.
    const k = Math.min(w / 0.5, d / 0.22, h / 0.3);
    const P = (x: number, y: number, z: number): V3 => [x * k, y * k, z * k];
    const rand = rng(23);
    const parts: Part[] = [];
    // Shallow wooden tray.
    parts.push(span('wood', [-0.245 * k, 0.245 * k], [0, 0.012 * k], [-0.105 * k, 0.105 * k], { bevel: 0.004 * k }));
    // Chopstick cup with chopsticks and two wooden spoons.
    parts.push(vcyl('wood', -0.18 * k, -0.035 * k, 0.012 * k, 0.13 * k, 0.034 * k, { rTop: 0.036 * k, segments: 20, plan: false }));
    parts.push(vcyl('accent', -0.18 * k, -0.035 * k, 0.05 * k, 0.058 * k, 0.0365 * k, { segments: 20, plan: false }));
    for (const i of range(8)) {
      const a = (i / 8) * Math.PI * 2;
      const r0 = 0.012 + rand() * 0.012;
      const top = 0.255 + rand() * 0.035;
      parts.push(
        rod('accent', P(-0.18 + Math.cos(a) * r0, 0.03, -0.035 + Math.sin(a) * r0), P(-0.18 + Math.cos(a) * (r0 + 0.008), top, -0.035 + Math.sin(a) * (r0 + 0.008)), 0.0028 * k, { plan: false }),
      );
    }
    for (const sx of [-1, 1]) {
      const base: V3 = [-0.18 + sx * 0.018, 0.03, -0.03];
      const tip: V3 = [-0.18 + sx * 0.04, 0.22, -0.02];
      parts.push(rod('wood', P(...base), P(...tip), 0.004 * k, { plan: false }));
      parts.push(sphere('wood', P(tip[0] + sx * 0.006, 0.235, tip[2]), 0.016 * k, { scale: [1, 1.5, 0.45], plan: false }));
    }
    // Wooden napkin box with a dark slot.
    parts.push(span('wood', [-0.11 * k, -0.05 * k], [0.012 * k, 0.085 * k], [0.025 * k, 0.09 * k], { bevel: 0.003 * k, plan: false }));
    parts.push(span('accent', [-0.1 * k, -0.06 * k], [0.084 * k, 0.087 * k], [0.05 * k, 0.065 * k], { plan: false }));
    // Three stacked rice bowls with a blue band.
    for (const i of range(3)) {
      const y0 = 0.012 + i * 0.024;
      parts.push(
        lathe(
          'ceramic',
          P(0.04, y0, -0.03),
          [
            [0, 0],
            [0.022 * k, 0],
            [0.024 * k, 0.006 * k],
            [0.05 * k, 0.03 * k],
            [0.058 * k, 0.04 * k],
            [0.054 * k, 0.04 * k],
          ],
          { segments: 24, plan: false },
        ),
      );
    }
    parts.push(ring('accent', P(0.04, 0.012 + 2 * 0.024 + 0.033, -0.03), 0.054 * k, 0.003 * k, { plan: false }));
    // Brown glazed lidded jars.
    for (const [x, z, s] of [
      [0.14, 0.055, 1],
      [0.205, -0.045, 0.85],
    ] as const) {
      const r = 0.032 * s;
      const hh = 0.06 * s;
      parts.push(
        lathe(
          'glaze',
          P(x, 0.012, z),
          [
            [0, 0],
            [r * 0.7 * k, 0],
            [r * k, hh * 0.45 * k],
            [r * 0.8 * k, hh * 0.9 * k],
            [r * 0.55 * k, hh * k],
            [0, hh * k],
          ],
          { segments: 24, plan: false },
        ),
      );
      parts.push(sphere('glaze', P(x, 0.012 + hh + 0.006, z), 0.009 * k * s, { scale: [1, 0.8, 1], plan: false }));
    }
    // Pottery sauce bottles.
    for (const [x, z] of [
      [0.115, -0.05],
      [0.215, 0.055],
    ] as const) {
      parts.push(
        lathe(
          'ceramic',
          P(x, 0.012, z),
          [
            [0, 0],
            [0.024 * k, 0],
            [0.03 * k, 0.03 * k],
            [0.028 * k, 0.07 * k],
            [0.012 * k, 0.095 * k],
            [0.01 * k, 0.115 * k],
            [0, 0.115 * k],
          ],
          { segments: 20, plan: false },
        ),
      );
      parts.push(vcyl('accent', x * k, z * k, 0.127 * k, 0.142 * k, 0.011 * k, { plan: false }));
    }
    return parts;
  },
});

// ── Textures ─────────────────────────────────────────────────────────────────

/** Fills a seamless near-white tile from a value function of tile coordinates in [0, 1). */
function paint(ctx: CanvasRenderingContext2D, size: number, value: (u: number, v: number, x: number, y: number) => number) {
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = Math.round(Math.min(1, Math.max(0, value(x / size, y / size, x, y))) * 255);
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

const TAU = Math.PI * 2;

export default definePack({
  name: 'Café dining set',
  version: '1.0.0',
  author: 'Neest team',
  description: 'Vietnamese café table set: rustic plank table with four cross-back bentwood chairs, and its table caddy.',
  license: 'CC0 (made for Neest)',
  items: [diningSet, caddy],
  patterns: [
    {
      id: 'pine-planks',
      name: 'Weathered pine',
      normalStrength: 0.55,
      draw(ctx, size, rand) {
        const ph = range(6).map(() => rand() * TAU);
        const knots = range(3).map(() => ({ x: rand(), y: rand(), r: 0.02 + rand() * 0.025 }));
        const noise = new Float32Array(size * size).map(() => rand());
        paint(ctx, size, (u, v, x, y) => {
          // Grain runs along u (the plank length); integer frequencies keep the tile seamless.
          // Mostly straight grain that drifts gently, with fine lines between the main ones.
          const wav = Math.sin(u * TAU + ph[0]) * 0.35 + Math.sin(u * TAU * 3 + ph[1]) * 0.1;
          const lines = Math.pow(Math.abs(Math.sin(v * TAU * 11 + wav * 3 + Math.sin(v * TAU * 2 + ph[2]) * 2.2)), 12);
          const fine = Math.pow(Math.abs(Math.sin(v * TAU * 37 + wav * 4 + Math.sin(v * TAU * 3 + ph[5]) * 2)), 16);
          let val = 0.88 - lines * 0.2 - fine * 0.05 + Math.sin(v * TAU * 5 + ph[3]) * 0.045 + Math.sin(u * TAU * 2 + v * TAU * 3 + ph[4]) * 0.02;
          for (const k of knots) {
            let dx = Math.abs(u - k.x);
            let dy = Math.abs(v - k.y);
            dx = Math.min(dx, 1 - dx) / 2.4;
            dy = Math.min(dy, 1 - dy);
            const dd = Math.hypot(dx, dy) / k.r;
            if (dd < 2.2) val -= 0.3 * Math.exp(-dd * dd * 2.2) + 0.05 * Math.max(0, Math.sin(dd * 9)) * (1 - dd / 2.2);
          }
          return val + (noise[y * size + x] - 0.5) * 0.05;
        });
      },
    },
    {
      id: 'beech-grain',
      name: 'Bentwood beech',
      normalStrength: 0.25,
      draw(ctx, size, rand) {
        const ph = range(4).map(() => rand() * TAU);
        const noise = new Float32Array(size * size).map(() => rand());
        paint(ctx, size, (u, v, x, y) => {
          const wav = Math.sin(u * TAU + ph[0]) * 0.4;
          const lines = Math.pow(Math.abs(Math.sin(v * TAU * 26 + wav * 3 + Math.sin(v * TAU * 2 + ph[1]))), 9);
          return 0.9 - lines * 0.12 + Math.sin(v * TAU * 5 + ph[2]) * 0.02 + (noise[y * size + x] - 0.5) * 0.03;
        });
      },
    },
    {
      id: 'woven-seat',
      name: 'Woven seat fabric',
      normalStrength: 0.8,
      draw(ctx, size, rand) {
        const n = 32;
        const tone = new Float32Array(n * n).map(() => rand());
        const noise = new Float32Array(size * size).map(() => rand());
        paint(ctx, size, (u, v, x, y) => {
          const cx = Math.floor(u * n);
          const cy = Math.floor(v * n);
          const fx = u * n - cx;
          const fy = v * n - cy;
          // Basket weave: pairs of cells alternate warp/weft.
          const horizontal = (Math.floor(cx / 2) + Math.floor(cy / 2)) % 2 === 0;
          const across = horizontal ? fy : fx;
          const along = horizontal ? fx : fy;
          let val = 0.7 + 0.22 * Math.sin(Math.PI * across) - 0.04 * Math.pow(Math.sin(along * Math.PI * 3), 2);
          if (across < 0.07 || across > 0.93) val -= 0.15;
          return val + (tone[cy * n + cx] - 0.5) * 0.06 + (noise[y * size + x] - 0.5) * 0.06;
        });
      },
    },
    {
      id: 'pottery-speckle',
      name: 'Speckled pottery',
      normalStrength: 0.2,
      draw(ctx, size, rand) {
        const ph = range(4).map(() => rand() * TAU);
        const specks = range(140).map(() => ({ x: rand() * size, y: rand() * size, r: 0.6 + rand() * 1.6, k: 0.15 + rand() * 0.35 }));
        paint(ctx, size, (u, v, x, y) => {
          let val = 0.9 + Math.sin(u * TAU * 2 + ph[0]) * Math.sin(v * TAU * 3 + ph[1]) * 0.04 + Math.sin((u + v) * TAU * 5 + ph[2]) * 0.015;
          for (const s of specks) {
            let dx = Math.abs(x - s.x);
            let dy = Math.abs(y - s.y);
            dx = Math.min(dx, size - dx);
            dy = Math.min(dy, size - dy);
            if (dx < 3 && dy < 3 && dx * dx + dy * dy < s.r * s.r) val -= s.k;
          }
          return val;
        });
      },
    },
  ],
  materials: [
    { id: 'pine-weathered', name: 'Weathered pine planks', category: 'wood', color: '#c9975a', roughness: 0.72, pattern: { id: 'pine-planks', scale: 0.9, contrast: 0.9 } },
    { id: 'pine-frame', name: 'Aged pine', category: 'wood', color: '#b07a40', roughness: 0.75, pattern: { id: 'pine-planks', scale: 0.6, contrast: 0.8 } },
    { id: 'bentwood-honey', name: 'Honey bentwood', category: 'wood', color: '#d9a13c', roughness: 0.42, pattern: { id: 'beech-grain', scale: 0.45, contrast: 0.7 } },
    { id: 'seat-taupe', name: 'Taupe woven seat', category: 'fabric', color: '#8c7d6b', roughness: 0.95, pattern: { id: 'woven-seat', scale: 0.12, contrast: 0.85 } },
    { id: 'ceramic-cream', name: 'Cream stoneware', color: '#ece4d2', roughness: 0.3, pattern: { id: 'pottery-speckle', scale: 0.15 } },
    { id: 'glaze-brown', name: 'Brown glaze', color: '#7a3e16', roughness: 0.18, pattern: { id: 'pottery-speckle', scale: 0.2, contrast: 0.4 } },
    { id: 'chopstick-dark', name: 'Dark lacquered wood', category: 'wood', color: '#3b2a1d', roughness: 0.55 },
  ],
});

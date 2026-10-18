/**
 * Asian everyday — the ordinary objects found in homes across East and Southeast Asia.
 *
 * Rice cooker, hot pot table, water dispenser with its big blue bottle, the shoe rack and
 * slippers by the door, a massage chair, a full karaoke set, a squat toilet and a wet bathroom
 * with stool, basin and dipper, a ceiling drying rack full of laundry, an evaporative cooler,
 * a teak bale daybed, a tiffin carrier, a potted frangipani and a Vietnamese box fan.
 *
 * Four pack patterns give the materials their surface: textured (orange-peel) plastic,
 * speckled terrazzo floor tile, kawung batik with wax crackle, and fine teak grain.
 */
import {
  PLANT_SPECIES,
  arcPoints,
  blobCluster,
  box,
  circle,
  clamp,
  cushion,
  cyl,
  defineItem,
  definePack,
  discZ,
  drapeFolds,
  ellipsePoints,
  fronts,
  lathe,
  leaf,
  line,
  matSlot,
  pillow,
  poly,
  pot,
  prism,
  range,
  rectPoly,
  ring,
  rng,
  rod,
  rodPath,
  rodX,
  rodZ,
  slats,
  spaced,
  span,
  sphere,
  torus,
  vcyl,
  type Part,
  type V2,
  type V3,
} from '@/packs/kit';

// ---------------------------------------------------------------------------
// Shared geometry helpers
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

/** A shape seen from the side: `pts` are [z, y] in metres, extruded along x from x0 to x1. */
function sidePlate(slot: string, pts: V2[], x0: number, x1: number): Part {
  const zs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const midZ = (Math.min(...zs) + Math.max(...zs)) / 2;
  const midY = (Math.min(...ys) + Math.max(...ys)) / 2;
  // Rotating -90° about Z sends the prism's extrusion (local y) along +x and local x to -y.
  return {
    shape: 'prism',
    outline: pts.map(([z, y]) => [-(y - midY), z - midZ] as V2),
    height: x1 - x0,
    position: [x0, midY, midZ],
    rotation: [0, 0, -Math.PI / 2],
    slot,
    plan: false,
  };
}

/** Point on a 2D line in the y/z plane: p + v·t (used for tilted backrests and leg rests). */
const yz = (p: V2, v: V2, t: number): V2 => [p[0] + v[0] * t, p[1] + v[1] * t];

// ---------------------------------------------------------------------------
// Pattern helpers (seamless, deterministic)
// ---------------------------------------------------------------------------

type Rand = () => number;

/** Value noise on a px×py lattice that wraps at the tile edge. Sample with x in [0, px), y in [0, py). */
function tileNoise(rand: Rand, px: number, py = px): (x: number, y: number) => number {
  const g = Float32Array.from({ length: px * py }, () => rand());
  const at = (i: number, j: number): number => g[(((j % py) + py) % py) * px + (((i % px) + px) % px)];
  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = at(xi, yi);
    const b = at(xi + 1, yi);
    const c = at(xi, yi + 1);
    const e = at(xi + 1, yi + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + e) * sx * sy;
  };
}

/**
 * Crackle mask: 1 where a tileable noise field crosses mid-level within `width` pixels, giving
 * thin lines of even weight (the gradient is taken from wrapped neighbours, so it tiles).
 */
function crackMask(n: (x: number, y: number) => number, period: number, size: number, width: number): Uint8Array {
  const f = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) f[y * size + x] = n((x / size) * period, (y / size) * period) - 0.5;
  const mask = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const c = f[y * size + x];
      const gx = f[y * size + ((x + 1) % size)] - c;
      const gy = f[((y + 1) % size) * size + x] - c;
      mask[y * size + x] = Math.abs(c) / Math.max(1e-5, Math.hypot(gx, gy)) < width ? 1 : 0;
    }
  }
  return mask;
}

/** Fills the tile from a per-pixel colour function of (u, v) in [0, 1). */
function paint(ctx: CanvasRenderingContext2D, size: number, f: (u: number, v: number, x: number, y: number) => readonly [number, number, number]): void {
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b] = f(x / size, y / size, x, y);
      const i = (y * size + x) * 4;
      img.data[i] = Math.round(clamp(r, 0, 1) * 255);
      img.data[i + 1] = Math.round(clamp(g, 0, 1) * 255);
      img.data[i + 2] = Math.round(clamp(b, 0, 1) * 255);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

const hex = (c: string): [number, number, number] => [parseInt(c.slice(1, 3), 16) / 255, parseInt(c.slice(3, 5), 16) / 255, parseInt(c.slice(5, 7), 16) / 255];

// ---------------------------------------------------------------------------
// Kitchen
// ---------------------------------------------------------------------------

const riceCooker = defineItem({
  id: 'rice-cooker',
  name: 'Rice cooker',
  category: 'kitchen',
  type: 'appliances',
  group: 'Small appliances',
  tags: ['rice cooker', 'rice', 'cooker', 'noi com dien', 'suihanki', 'steam', 'countertop', 'appliance', 'asian'],
  defaultSize: { w: 0.32, d: 0.32, h: 0.27 },
  minSize: { w: 0.26, d: 0.26, h: 0.21 },
  maxSize: { w: 0.42, d: 0.42, h: 0.34 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Body', 'plastic-white-textured'),
    matSlot('lid', 'Lid & trim', 'metal-brushed-steel'),
    matSlot('trim', 'Handle & buttons', 'plastic-black'),
    matSlot('accent', 'Panel & paddle holder', 'plastic-pink-textured'),
  ],
  build: ({ w, d, h }) => {
    const hw = 0.04;
    const R = Math.min((w - hw) / 2 - 0.004, d / 2 - 0.028);
    const x0 = -w / 2 + R + 0.002;
    const footH = 0.012;
    const bodyH = (h - footH) * 0.6;
    const yb = footH + bodyH;
    const lidH = h - yb - 0.03;
    const o = { plan: false };
    const py0 = footH + bodyH * 0.2;
    const py1 = footH + bodyH * 0.8;
    const zp = R + 0.012;
    const parts: Part[] = [
      lathe('body', [x0, footH, 0], [
        [0, 0],
        [R * 0.86, 0],
        [R * 0.97, 0.012],
        [R, bodyH * 0.3],
        [R, bodyH * 0.92],
        [R * 0.98, bodyH],
        [0, bodyH],
      ], { segments: 40 }),
      ring('lid', [x0, yb, 0], R * 0.985, 0.005, o),
      // Domed lid with its arched carry handle and steam vent.
      lathe('lid', [x0, yb, 0], [
        [R * 0.98, 0],
        [R * 0.95, lidH * 0.3],
        [R * 0.78, lidH * 0.75],
        [R * 0.45, lidH * 0.97],
        [0, lidH],
      ], { segments: 40, plan: false }),
      ...rodPath('trim', [
        [x0 - R * 0.34, yb + lidH * 0.9, 0],
        [x0 - R * 0.24, h - 0.012, 0],
        [x0 + R * 0.24, h - 0.012, 0],
        [x0 + R * 0.34, yb + lidH * 0.9, 0],
      ], 0.009),
      cyl('trim', [x0, yb + lidH * 0.9, -R * 0.5], 0.02, 0.014, o),
      cyl('accent', [x0, yb + lidH * 0.9 + 0.009, -R * 0.5], 0.014, 0.006, o),
      // Hinge at the back and the lid release on the front.
      span('trim', [x0 - 0.03, x0 + 0.03], [yb - 0.012, yb + 0.012], [-R - 0.006, -R + 0.012], o),
      span('trim', [x0 - 0.022, x0 + 0.022], [yb - 0.018, yb + 0.006], [R - 0.006, R + 0.012], { bevel: 0.004, plan: false }),
      // Control panel: display, keep-warm light and buttons.
      span('accent', [x0 - R * 0.42, x0 + R * 0.42], [py0, py1], [R * 0.8, zp], { bevel: 0.01, plan: false }),
      span('trim', [x0 - R * 0.22, x0 + R * 0.22], [py0 + (py1 - py0) * 0.55, py0 + (py1 - py0) * 0.85], [zp - 0.001, zp + 0.002], o),
      discZ('lid', [x0 + R * 0.3, py0 + (py1 - py0) * 0.3, zp + 0.002], 0.012, 0.006, o),
      sphere('accent', [x0 + R * 0.3, py0 + (py1 - py0) * 0.7, zp], 0.005, o),
      // Paddle holder clipped to the right side, with the rice paddle standing in it.
      span('accent', [x0 + R - 0.01, x0 + R + 0.03], [footH + bodyH * 0.3, footH + bodyH * 0.85], [-0.022, 0.022], { bevel: 0.006 }),
      span('body', [x0 + R + 0.006, x0 + R + 0.016], [footH + bodyH * 0.6, Math.min(h - 0.01, yb + 0.07)], [-0.014, 0.014], { bevel: 0.003, plan: false }),
      // Power cord at the back.
      rod('trim', [x0 + R * 0.3, footH + 0.03, -R * 0.9], [x0 + R * 0.5, 0.006, -d / 2 + 0.008], 0.004, o),
    ];
    for (const x of spaced(3, -R * 0.24, R * 0.06)) {
      parts.push(discZ('trim', [x0 + x, py0 + (py1 - py0) * 0.3, zp + 0.002], 0.007, 0.005, o));
    }
    for (const k of range(4)) {
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      parts.push(cyl('trim', [x0 + Math.cos(a) * R * 0.7, footH / 2, Math.sin(a) * R * 0.7], 0.014, footH, o));
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const R = Math.min((w - 0.04) / 2 - 0.004, d / 2 - 0.028);
    const x0 = -w / 2 + R + 0.002;
    return [circle([x0, 0], R * 0.55), line([x0 - R * 0.24, 0], [x0 + R * 0.24, 0])];
  },
});

const waterDispenser = defineItem({
  id: 'water-dispenser',
  name: 'Water dispenser with bottle',
  category: 'kitchen',
  type: 'appliances',
  group: 'Small appliances',
  tags: ['water dispenser', 'water cooler', 'bottle', 'hot', 'cold', 'drinking water', 'cay nuoc nong lanh', 'asian'],
  defaultSize: { w: 0.32, d: 0.34, h: 1.4 },
  minSize: { w: 0.28, d: 0.3, h: 1.1 },
  maxSize: { w: 0.4, d: 0.42, h: 1.6 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Body', 'plastic-white-textured'),
    matSlot('bottle', 'Water bottle', 'pet-bottle-blue'),
    matSlot('hot', 'Hot tap', 'plastic-red'),
    matSlot('cold', 'Cold tap & cap', 'plastic-blue'),
  ],
  build: ({ w, d, h }) => {
    const bodyH = Math.min(h * 0.68, h - 0.3);
    const rb = Math.min(w, d) / 2 - 0.012;
    const bh = h - bodyH - 0.01;
    const zFront = d / 2 - 0.01;
    const zIn = d / 2 - 0.075;
    const aT = bodyH * 0.72;
    const aB = bodyH * 0.42;
    const o = { plan: false };
    const neck = Math.min(0.1, bh * 0.25);
    const parts: Part[] = [
      // Cabinet with a recessed dispensing alcove.
      span('body', [-w / 2, w / 2], [0, bodyH], [-d / 2, zIn], { bevel: 0.025 }),
      span('body', [-w / 2, w / 2], [aT, bodyH], [zIn - 0.02, zFront], { bevel: 0.02 }),
      span('body', [-w / 2, w / 2], [0, aB], [zIn - 0.02, zFront], { bevel: 0.02 }),
      span('body', [-w / 2, -w / 2 + 0.03], [aB - 0.01, aT + 0.01], [zIn - 0.02, zFront], { bevel: 0.008, plan: false }),
      span('body', [w / 2 - 0.03, w / 2], [aB - 0.01, aT + 0.01], [zIn - 0.02, zFront], { bevel: 0.008, plan: false }),
      // Drip tray and grate.
      span('body', [-w / 2 + 0.04, w / 2 - 0.04], [aB, aB + 0.02], [zIn, zFront + 0.005], { bevel: 0.006, plan: false }),
      ...slats('cold', [-w / 2 + 0.05, w / 2 - 0.05], [aB + 0.02, aB + 0.024], [zIn + 0.008, zFront - 0.005], 8, { axis: 'x', gap: 0.5, plan: false }),
      // Lower storage door handle and the badge/indicator lights.
      span('body', [-w * 0.3, w * 0.3], [aB - 0.06, aB - 0.045], [zFront - 0.002, zFront + 0.008], { bevel: 0.004, plan: false }),
      sphere('hot', [-w * 0.12, bodyH - 0.08, zFront], 0.008, o),
      sphere('cold', [w * 0.12, bodyH - 0.08, zFront], 0.008, o),
      span('cold', [-w * 0.2, w * 0.2], [bodyH - 0.045, bodyH - 0.035], [zFront - 0.002, zFront + 0.002], o),
      // Bottle seat on top.
      cyl('body', [0, bodyH + 0.012, 0], Math.min(rb * 0.6, 0.09), 0.024, { segments: 32, plan: false }),
      // Upside-down 19 L bottle: neck down into the seat, ribs round the waist.
      lathe('bottle', [0, bodyH + 0.01, 0], [
        [0, 0],
        [0.026, 0],
        [0.026, neck * 0.45],
        [rb * 0.5, neck],
        [rb * 0.97, neck + 0.07],
        [rb, neck + 0.1],
        [rb, bh - 0.03],
        [rb * 0.9, bh],
        [0, bh],
      ], { segments: 40, plan: false }),
      cyl('cold', [0, bodyH + 0.012 + neck * 0.2, 0], 0.03, neck * 0.3, o),
    ];
    for (const f of [0.35, 0.55, 0.75]) {
      parts.push(ring('bottle', [0, bodyH + 0.01 + neck + 0.1 + (bh - neck - 0.13) * f, 0], rb, 0.005, o));
    }
    // Hot (red, with child lock) and cold (blue) taps.
    for (const [x, slot] of [[-w * 0.18, 'hot'], [w * 0.18, 'cold']] as const) {
      parts.push(span(slot, [x - 0.018, x + 0.018], [aT - 0.05, aT], [zIn - 0.005, zIn + 0.035], { bevel: 0.006, plan: false }));
      parts.push(span(slot, [x - 0.014, x + 0.014], [aT - 0.075, aT - 0.04], [zIn + 0.03, zIn + 0.042], { bevel: 0.004, plan: false }));
      parts.push(vcyl(slot, x, zIn + 0.012, aT - 0.07, aT - 0.05, 0.006, o));
    }
    parts.push(sphere('hot', [-w * 0.18, aT - 0.005, zIn + 0.03], 0.007, o));
    return parts;
  },
  planDetail: ({ w, d }) => [circle([0, 0], Math.min(w, d) / 2 - 0.012)],
});

const tiffinCarrier = defineItem({
  id: 'tiffin-carrier',
  name: 'Tiffin carrier',
  category: 'kitchen',
  type: 'storage',
  group: 'Baskets & boxes',
  tags: ['tiffin', 'lunch box', 'pinto', 'cap long', 'cà mèn', 'dabba', 'enamel', 'food carrier', 'asian'],
  defaultSize: { w: 0.17, d: 0.17, h: 0.36 },
  minSize: { w: 0.12, d: 0.12, h: 0.22 },
  maxSize: { w: 0.26, d: 0.26, h: 0.5 },
  slots: [
    matSlot('enamel', 'Enamel tiers', 'enamel-pinto'),
    matSlot('steel', 'Frame & rims', 'metal-brushed-steel'),
    matSlot('grip', 'Handle grip', 'teak-dark'),
  ],
  build: ({ w, d, h }) => {
    const r = Math.min(w / 2 - 0.02, d / 2 - 0.004);
    const handleH = Math.min(0.09, h * 0.25);
    const stackTop = h - handleH;
    const lidH = Math.min(0.03, stackTop * 0.12);
    const n = clamp(Math.round((stackTop - lidH) / 0.07), 2, 5);
    const th = (stackTop - lidH) / n;
    const o = { plan: false };
    const xb = r + 0.006;
    const parts: Part[] = [];
    for (const i of range(n)) {
      const y = i * th;
      parts.push(
        lathe('enamel', [0, y, 0], [
          [0, 0],
          [r * 0.9, 0],
          [r, Math.min(0.008, th * 0.12)],
          [r, th * 0.9],
          [r * 0.96, th],
          [0, th],
        ], { segments: 32, plan: i === 0 }),
      );
      parts.push(ring('steel', [0, y + th - 0.004, 0], r * 0.975, 0.004, o));
      // Lugs the side bars pass through.
      for (const sx of [-1, 1]) {
        parts.push(span('steel', sx < 0 ? [-xb - 0.006, -r + 0.004] : [r - 0.004, xb + 0.006], [y + th * 0.5, y + th * 0.68], [-0.011, 0.011], o));
      }
    }
    // Domed lid with a little knob.
    parts.push(
      lathe('enamel', [0, stackTop - lidH, 0], [
        [r * 0.97, 0],
        [r * 0.9, lidH * 0.5],
        [r * 0.55, lidH * 0.92],
        [0, lidH],
      ], { segments: 32, plan: false }),
    );
    // Side bars, top clamp and carrying handle.
    for (const sx of [-1, 1]) {
      parts.push(span('steel', [sx * xb - 0.004, sx * xb + 0.004], [th * 0.35, stackTop + 0.016], [-0.009, 0.009], o));
    }
    parts.push(span('steel', [-xb - 0.004, xb + 0.004], [stackTop + 0.006, stackTop + 0.016], [-0.009, 0.009], o));
    parts.push(sphere('steel', [0, stackTop + 0.016, 0.009], 0.006, o));
    const R = Math.max(0.02, Math.min(r * 0.8, handleH - 0.03));
    parts.push(torus('steel', [0, stackTop + 0.016, 0], R, 0.004, { arc: Math.PI, plan: false }));
    parts.push(rodX('grip', -Math.min(0.04, R * 0.7), Math.min(0.04, R * 0.7), stackTop + 0.016 + R, 0, 0.009, o));
    return parts;
  },
  planDetail: ({ w, d }) => [line([-(Math.min(w / 2 - 0.02, d / 2 - 0.004) + 0.01), 0], [Math.min(w / 2 - 0.02, d / 2 - 0.004) + 0.01, 0])],
});

// ---------------------------------------------------------------------------
// Dining
// ---------------------------------------------------------------------------

const hotpotTable = defineItem({
  id: 'hotpot-table',
  name: 'Hot pot table set',
  category: 'dining',
  type: 'surfaces',
  group: 'Dining tables',
  tags: ['hot pot', 'hotpot', 'lau', 'shabu shabu', 'steamboat', 'huoguo', 'induction', 'dining table', 'round table', 'asian'],
  defaultSize: { w: 1.0, d: 1.0, h: 0.86 },
  minSize: { w: 0.7, d: 0.7, h: 0.72 },
  maxSize: { w: 1.6, d: 1.6, h: 0.95 },
  slots: [
    matSlot('table', 'Table & chopsticks', 'teak-dark'),
    matSlot('steel', 'Pot, cooker & ladles', 'metal-brushed-steel'),
    matSlot('china', 'Bowls & bone broth', 'ceramic-white'),
    matSlot('broth', 'Spicy broth & sauces', 'chili-broth'),
  ],
  build: ({ w, d, h }) => {
    const rx = w / 2;
    const rz = d / 2;
    const s = Math.min(rx, rz);
    const tt = 0.035;
    const topY = Math.min(0.75, h - 0.11);
    const o = { plan: false };
    const ib = Math.min(0.16, s * 0.32);
    const cookTop = topY + 0.05;
    const pr = Math.min(0.15, ib * 0.95);
    const ph = Math.min(0.09, h - cookTop - 0.012);
    const brothY = cookTop + ph * 0.72;
    const rand = rng(23);
    const parts: Part[] = [
      // Round pedestal table.
      cyl('table', [0, topY - tt / 2, 0], rx, tt, { segments: 56, scale: [1, 1, rz / rx] }),
      cyl('table', [0, topY - tt - 0.03, 0], rx * 0.9, 0.06, { segments: 48, scale: [1, 1, rz / rx], plan: false }),
      vcyl('table', 0, 0, 0.06, topY - tt - 0.06, 0.06, o),
      span('table', [-s * 0.6, s * 0.6], [0, 0.06], [-0.04, 0.04], { bevel: 0.015, plan: false }),
      span('table', [-0.04, 0.04], [0, 0.06], [-s * 0.6, s * 0.6], { bevel: 0.015, plan: false }),
      // Induction cooker with its control strip.
      span('steel', [-ib, ib], [topY, cookTop], [-ib, ib], { bevel: 0.012, plan: false }),
      span('broth', [-ib * 0.5, ib * 0.5], [cookTop - 0.03, cookTop - 0.012], [ib - 0.002, ib + 0.002], o),
      // Split "yin-yang" hot pot: spicy red broth and milky bone broth.
      lathe('steel', [0, cookTop, 0], [
        [0, 0],
        [pr * 0.9, 0],
        [pr, 0.01],
        [pr, ph * 0.88],
        [pr * 1.06, ph],
        [pr * 0.96, ph],
        [pr * 0.94, ph * 0.72],
        [0, ph * 0.72],
      ], { segments: 40, plan: false }),
      prism('broth', [...arcPoints(0, 0, pr * 0.93, 0, Math.PI, 12), ...arcPoints(-pr * 0.465, 0, pr * 0.465, Math.PI, 2 * Math.PI, 6).slice(1), ...arcPoints(pr * 0.465, 0, pr * 0.465, Math.PI, 0, 6).slice(1, -1)], brothY, 0.006, o),
      prism('china', [...arcPoints(0, 0, pr * 0.93, Math.PI, 2 * Math.PI, 12), ...arcPoints(pr * 0.465, 0, pr * 0.465, 0, Math.PI, 6).slice(1), ...arcPoints(-pr * 0.465, 0, pr * 0.465, 2 * Math.PI, Math.PI, 6).slice(1, -1)], brothY, 0.006, o),
      ...rodPath('steel', [
        ...arcPoints(-pr * 0.465, 0, pr * 0.465, Math.PI, 2 * Math.PI, 5),
        ...arcPoints(pr * 0.465, 0, pr * 0.465, Math.PI, 0, 5).slice(1),
      ].map(([x, z]) => [x, brothY + 0.012, z] as V3), 0.003),
      torus('steel', [-(pr + 0.014), cookTop + ph * 0.8, 0], 0.016, 0.005, { rotation: [0, Math.PI / 2, 0], plan: false }),
      torus('steel', [pr + 0.014, cookTop + ph * 0.8, 0], 0.016, 0.005, { rotation: [0, Math.PI / 2, 0], plan: false }),
      // Two ladles resting in the pot.
      sphere('steel', [pr * 0.35, brothY + 0.01, -pr * 0.35], 0.03, { scale: [1, 0.45, 1], plan: false }),
      rod('steel', [pr * 0.35, brothY + 0.02, -pr * 0.35], [pr * 1.25, Math.min(h - 0.01, cookTop + ph + 0.07), -pr * 1.05], 0.004, o),
      sphere('steel', [-pr * 0.4, brothY + 0.01, pr * 0.3], 0.028, { scale: [1, 0.4, 1], plan: false }),
      rod('steel', [-pr * 0.4, brothY + 0.02, pr * 0.3], [-pr * 1.25, Math.min(h - 0.01, cookTop + ph + 0.06), pr * 1.0], 0.004, o),
    ];
    // Mushrooms and tofu bobbing in the broth.
    for (const i of range(5)) {
      const a = rand() * Math.PI * 2;
      const rr = pr * (0.3 + rand() * 0.5);
      parts.push(sphere(i % 2 ? 'table' : 'china', [Math.cos(a) * rr, brothY + 0.008, Math.sin(a) * rr], 0.012 + rand() * 0.006, { scale: [1, 0.6, 1], plan: false }));
    }
    // Place settings round the edge: dipping bowl with sauce and a pair of chopsticks.
    const n = clamp(Math.round((Math.PI * (rx + rz)) / 0.45), 4, 10);
    for (const i of range(n)) {
      const a = ((i + 0.5) / n) * Math.PI * 2;
      const c = Math.cos(a);
      const sn = Math.sin(a);
      const bx = c * (rx - 0.17);
      const bz = sn * (rz - 0.17);
      parts.push(pot('china', [bx, topY, bz], 0.055, 0.04, 'bowl', o));
      parts.push(cyl('broth', [bx, topY + 0.03, bz], 0.042, 0.004, o));
      const cx = c * (rx - 0.075);
      const cz = sn * (rz - 0.075);
      for (const off of [-0.009, 0.009]) {
        const ox = cx + c * off;
        const oz = cz + sn * off;
        parts.push(rod('table', [ox + sn * 0.1, topY + 0.005, oz - c * 0.1], [ox - sn * 0.1, topY + 0.005, oz + c * 0.1], 0.0035, { rTop: 0.0025, plan: false }));
      }
    }
    // Plates of sliced beef and greens between pot and bowls on larger tables.
    if (s >= 0.48) {
      for (const k of range(2)) {
        const a = Math.PI / 4 + k * Math.PI + Math.PI / n;
        const rr = ib + 0.085;
        const px = Math.cos(a) * rr;
        const pz = Math.sin(a) * rr;
        parts.push(cyl('china', [px, topY + 0.006, pz], 0.065, 0.012, { rTop: 0.07, segments: 28, plan: false }));
        parts.push(...blobCluster(k ? 'broth' : 'table', [px, topY + 0.03, pz], 0.045, 4, 40 + k, { plan: false }));
      }
    }
    return parts;
  },
  planDetail: ({ w, d }) => [poly(ellipsePoints(0, 0, w / 2 - 0.12, d / 2 - 0.12, 32)), circle([0, 0], Math.min(0.15, Math.min(0.16, Math.min(w, d) * 0.16) * 0.95))],
});

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

const shoeRack = defineItem({
  id: 'entry-shoe-rack',
  name: 'Entryway shoe rack with slippers',
  category: 'storage',
  type: 'storage',
  group: 'Hallway storage',
  tags: ['shoe rack', 'shoes', 'slippers', 'genkan', 'entryway', 'house slippers', 'dep', 'hallway', 'asian'],
  defaultSize: { w: 0.8, d: 0.55, h: 0.6 },
  minSize: { w: 0.5, d: 0.28, h: 0.35 },
  maxSize: { w: 1.4, d: 0.7, h: 0.9 },
  wallSnap: true,
  slots: [
    matSlot('frame', 'Rack', 'teak-golden'),
    matSlot('shoes', 'Shoes', 'leather-tan'),
    matSlot('slippers', 'Slippers', 'plastic-sky-textured'),
    matSlot('soles', 'Soles & sneakers', 'plastic-white-textured'),
  ],
  build: ({ w, d, h }) => {
    const rackD = d < 0.45 ? d : Math.min(0.32, d * 0.6);
    const zb = -d / 2;
    const zf = zb + rackD;
    const post = 0.03;
    const tiers = clamp(Math.round((h - 0.06) / 0.18), 2, 5);
    const yTop = h - 0.002;
    const ys = spaced(tiers, 0.06, yTop);
    const gap = ys[1] - ys[0];
    const o = { plan: false };
    const rand = rng(11);
    const parts: Part[] = [];
    for (const x of [-w / 2 + post / 2, w / 2 - post / 2]) {
      for (const z of [zb + post / 2, zf - post / 2]) {
        parts.push(span('frame', [x - post / 2, x + post / 2], [0, h], [z - post / 2, z + post / 2], { bevel: 0.004 }));
      }
    }
    for (const y of ys) {
      for (const x of [-w / 2, w / 2 - post]) parts.push(span('frame', [x, x + post], [y - 0.03, y - 0.008], [zb + post, zf - post], o));
      parts.push(...slats('frame', [-w / 2 + post, w / 2 - post], [y - 0.02, y], [zb + 0.004, zf - 0.004], 4, { axis: 'z', gap: 0.3, bevel: 0.003, plan: false }));
    }
    // Pairs of shoes, toes to the front, on every shelf but the top one.
    const pc = clamp(Math.floor((w - 2 * post) / 0.24), 1, 5);
    const len = Math.min(0.26, rackD - 0.03);
    const uh = Math.min(0.1, (gap - 0.02) * 0.7);
    for (const y of ys.slice(0, -1)) {
      for (const px of spaced(pc, -w / 2 + post + (w - 2 * post) / (2 * pc), w / 2 - post - (w - 2 * post) / (2 * pc))) {
        const kind = rand();
        const upper = kind < 0.4 ? 'shoes' : kind < 0.75 ? 'soles' : 'slippers';
        const z0 = zf - 0.01 - len;
        for (const sx of [-0.045, 0.045]) {
          const x = px + sx;
          parts.push(span(upper === 'soles' ? 'shoes' : 'soles', [x - 0.038, x + 0.038], [y, y + 0.015], [z0, z0 + len], { bevel: 0.012, plan: false }));
          parts.push(sphere(upper, [x, y + 0.015 + uh * 0.32, z0 + len * 0.42], 0.5, { scale: [0.07, uh * 1.3, len * 0.84], plan: false }));
        }
      }
    }
    // House slippers lined up on the floor in front.
    const zoneZ0 = zf + 0.02;
    const zoneLen = d / 2 - 0.01 - zoneZ0;
    if (zoneLen >= 0.16) {
      const sp = clamp(Math.floor(w / 0.26), 1, 5);
      const L = Math.min(0.25, zoneLen);
      const z0 = d / 2 - 0.01 - L;
      for (const px of spaced(sp, -w / 2 + w / (2 * sp), w / 2 - w / (2 * sp))) {
        const turn = (rand() - 0.5) * 0.25;
        for (const sx of [-0.05, 0.05]) {
          const x = px + sx;
          parts.push(span('slippers', [x - 0.042, x + 0.042], [0, 0.018], [z0, z0 + L], { bevel: 0.008, rotation: [0, turn, 0] }));
          parts.push(span('slippers', [x - 0.046, x + 0.046], [0.016, 0.042], [z0 + L * 0.5, z0 + L * 0.82], { bevel: 0.01, rotation: [0, turn, 0], plan: false }));
        }
      }
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const rackD = d < 0.45 ? d : Math.min(0.32, d * 0.6);
    return [rectPoly(-w / 2, -d / 2, w / 2, -d / 2 + rackD), line([-w / 2, -d / 2], [w / 2, -d / 2 + rackD])];
  },
});

// ---------------------------------------------------------------------------
// Living
// ---------------------------------------------------------------------------

const massageChair = defineItem({
  id: 'massage-chair',
  name: 'Massage chair',
  category: 'living',
  type: 'seating',
  group: 'Living chairs',
  tags: ['massage chair', 'massage', 'recliner', 'ghe massage', 'zero gravity', 'shiatsu', 'armchair', 'asian'],
  defaultSize: { w: 0.85, d: 1.3, h: 1.2 },
  minSize: { w: 0.75, d: 1.1, h: 1.05 },
  maxSize: { w: 1.0, d: 1.6, h: 1.35 },
  slots: [
    matSlot('shell', 'Shell', 'massage-shell'),
    matSlot('upholstery', 'Upholstery', 'massage-leather'),
    matSlot('trim', 'Chrome trim', 'metal-chrome'),
    matSlot('panel', 'Control panel', 'screen-black'),
  ],
  build: ({ w, d, h }) => {
    const armW = clamp(w * 0.17, 0.12, 0.17);
    const innerX = w / 2 - armW;
    const baseH = 0.1;
    const seatY = clamp(h * 0.4, 0.42, 0.52);
    const seatZ0 = -d / 2 + d * 0.38;
    const seatZ1 = seatZ0 + Math.min(0.52, d * 0.36);
    const armTop = seatY + 0.2;
    const o = { plan: false };
    // Backrest: leans back by `a`; local +z faces the sitter.
    const a = 0.42;
    const u: V2 = [Math.cos(a), -Math.sin(a)];
    const pz: V2 = [Math.sin(a), Math.cos(a)];
    const tb = 0.18;
    const hood = 0.07;
    const P0: V2 = [seatY - 0.1, seatZ0 - 0.05];
    const tt = tb + hood;
    const L = Math.min((h - 0.015 - P0[0] - tt * pz[0]) / u[0] - 0.03, (P0[1] + d / 2 - 0.01 - tt * pz[1]) / -u[1] - 0.03);
    const bw = innerX * 2 - 0.02;
    const back = (t: number, n: number): V3 => {
      const p = yz(yz(P0, u, t), pz, n);
      return [0, p[0], p[1]];
    };
    const rotB: V3 = [-a, 0, 0];
    // Leg rest: hangs down and forward by `b` from the seat front; local +z faces the calves.
    const b = 0.7;
    const v: V2 = [-Math.cos(b), Math.sin(b)];
    const p1: V2 = [Math.sin(b), Math.cos(b)];
    const tl = 0.18;
    const T: V2 = [seatY - 0.03, seatZ1 - 0.03];
    const Ll = Math.min((T[0] - 0.015 - tl * p1[0]) / -v[0], (d / 2 - 0.012 - T[1]) / v[1]);
    const leg = (t: number, n: number, x = 0): V3 => {
      const p = yz(yz(T, v, t), p1, n);
      return [x, p[0], p[1]];
    };
    const rotL: V3 = [-b, 0, 0];
    const parts: Part[] = [
      span('shell', [-w / 2 + 0.04, w / 2 - 0.04], [0, baseH], [-d / 2 + 0.12, seatZ1], { bevel: 0.03 }),
      span('shell', [-innerX, innerX], [baseH, seatY - 0.12], [seatZ0, seatZ1 - 0.04], o),
      cushion('upholstery', [-innerX, innerX], [seatY - 0.12, seatY], [seatZ0 - 0.04, seatZ1], { softness: 0.3, plan: false }),
      // Backrest with a shell hood behind it and three air-bag pads.
      box('upholstery', back(L / 2, -tb / 2), [bw, L, tb], { rotation: rotB, bevel: 0.04, plan: false }),
      box('shell', back((L + 0.03) / 2, -tb - hood / 2 + 0.01), [bw + 0.06, L + 0.03, hood], { rotation: rotB, bevel: 0.03, plan: false }),
      pillow('upholstery', back(L - 0.12, 0.04), bw * 0.62, 0.15, 0.08, { lean: a }),
    ];
    for (const i of range(3)) parts.push(box('upholstery', back(L * (0.14 + 0.24 * i), 0.012), [bw * 0.78, L * 0.2, 0.035], { rotation: rotB, bevel: 0.014, plan: false }));
    // Shoulder wings either side of the upper backrest.
    for (const sx of [-1, 1]) {
      const c = back(L * 0.72, -tb / 2 + 0.03);
      parts.push(box('shell', [sx * (bw / 2 + 0.005), c[1], c[2]], [0.05, L * 0.5, tb + 0.04], { rotation: rotB, bevel: 0.02, plan: false }));
    }
    // Arm pods with air-bag sleeves and a chrome strip.
    for (const sx of [-1, 1]) {
      const xs: V2 = sx < 0 ? [-w / 2, -innerX] : [innerX, w / 2];
      parts.push(span('shell', xs, [baseH - 0.02, armTop], [seatZ0 - 0.16, seatZ1 + 0.02], { bevel: 0.05 }));
      parts.push(span('upholstery', sx < 0 ? [-innerX, -innerX + 0.03] : [innerX - 0.03, innerX], [seatY, armTop - 0.04], [seatZ0 - 0.1, seatZ1 - 0.03], { bevel: 0.012, plan: false }));
      parts.push(span('upholstery', [xs[0] + 0.015, xs[1] - 0.015], [armTop - 0.01, armTop + 0.05], [seatZ0 - 0.08, seatZ1 - 0.08], { bevel: 0.02, plan: false }));
      parts.push(span('trim', sx < 0 ? [-w / 2 - 0.002, -w / 2 + 0.004] : [w / 2 - 0.004, w / 2 + 0.002], [armTop - 0.12, armTop - 0.1], [seatZ0 - 0.1, seatZ1 - 0.02], o));
    }
    // Control panel on the right arm.
    parts.push(span('panel', [innerX + 0.02, w / 2 - 0.02], [armTop + 0.04, armTop + 0.06], [seatZ1 - 0.07, seatZ1 + 0.01], { bevel: 0.006, plan: false }));
    // Leg rest with calf channels and a foot well.
    parts.push(box('upholstery', leg(Ll / 2, -tl / 2), [bw - 0.04, Ll, tl], { rotation: rotL, bevel: 0.035, plan: false }));
    parts.push(box('shell', leg(Ll / 2, -tl / 2), [bw, Ll * 0.96, tl * 0.7], { rotation: rotL, bevel: 0.03, plan: false }));
    parts.push(box('shell', leg(Ll * 0.5, 0.005), [0.05, Ll * 0.86, 0.05], { rotation: rotL, bevel: 0.02, plan: false }));
    for (const sx of [-1, 1]) parts.push(box('upholstery', leg(Ll * 0.48, 0.0, sx * bw * 0.25), [bw * 0.38, Ll * 0.78, 0.035], { rotation: rotL, bevel: 0.014, plan: false }));
    parts.push(box('trim', leg(Ll - 0.04, -tl / 2), [bw * 0.7, 0.012, tl * 0.75], { rotation: rotL, plan: false }));
    // Transport wheels at the back.
    for (const sx of [-1, 1]) parts.push(cyl('trim', [sx * (w / 2 - 0.08), 0.035, -d / 2 + 0.12], 0.035, 0.03, { rotation: [0, 0, Math.PI / 2], plan: false }));
    return parts;
  },
  planDetail: ({ w, d }) => {
    const armW = clamp(w * 0.17, 0.12, 0.17);
    const seatZ0 = -d / 2 + d * 0.38;
    const seatZ1 = seatZ0 + Math.min(0.52, d * 0.36);
    return [line([-w / 2 + armW, seatZ0], [-w / 2 + armW, seatZ1]), line([w / 2 - armW, seatZ0], [w / 2 - armW, seatZ1]), line([-w / 2 + armW, seatZ1], [w / 2 - armW, seatZ1])];
  },
});

const karaokeSet = defineItem({
  id: 'karaoke-set',
  name: 'Karaoke set',
  category: 'living',
  type: 'electronics',
  group: 'TV & audio',
  tags: ['karaoke', 'tv', 'speakers', 'microphone', 'mixer', 'ktv', 'noraebang', 'hat karaoke', 'media unit', 'asian'],
  defaultSize: { w: 2.0, d: 0.45, h: 1.35 },
  minSize: { w: 1.4, d: 0.35, h: 1.1 },
  maxSize: { w: 3.0, d: 0.6, h: 1.8 },
  wallSnap: true,
  slots: [
    matSlot('cabinet', 'TV cabinet', 'teak-golden'),
    matSlot('device', 'Speakers & TV', 'metal-anthracite'),
    matSlot('metal', 'Grilles & knobs', 'metal-chrome'),
    matSlot('light', 'Screen glow', 'karaoke-glow'),
  ],
  light: { color: '#8a7bff', intensity: 0.7, distance: 3, y: 0.9 },
  build: ({ w, d, h }) => {
    const sw = clamp(w * 0.14, 0.2, 0.3);
    const sd = Math.min(d, 0.3);
    const sh = Math.min(h * 0.78, 1.05);
    const cabX = w / 2 - sw - 0.03;
    const cabH = Math.min(0.48, h * 0.36);
    const zf = d / 2 - 0.01;
    const nw = cabX * 0.32;
    const o = { plan: false };
    const tvW = Math.min(cabX * 2 * 0.9, (h - cabH - 0.12) / 0.5625);
    const tvH = tvW * 0.5625;
    const tvY0 = cabH + 0.08;
    const tz0 = -d / 2 + 0.04;
    const parts: Part[] = [
      // Low teak cabinet: doors either side of an open bay with the karaoke player.
      span('cabinet', [-cabX, cabX], [0.05, cabH], [-d / 2, zf], { bevel: 0.008 }),
      span('cabinet', [-cabX + 0.03, cabX - 0.03], [0, 0.05], [-d / 2 + 0.03, zf - 0.04], o),
      span('device', [-nw, nw], [0.07, cabH - 0.04], [zf - 0.004, zf + 0.001], o),
      ...fronts('cabinet', 'metal', [
        { x: [-cabX + 0.015, -nw - 0.01], y: [0.07, cabH - 0.02], handle: { kind: 'knob', x: -nw - 0.05 } },
        { x: [nw + 0.01, cabX - 0.015], y: [0.07, cabH - 0.02], handle: { kind: 'knob', x: nw + 0.05 } },
      ], zf - 0.01, 0.016, 0.012),
      // Karaoke player and amplifier stacked in the bay.
      span('device', [-nw + 0.02, nw - 0.02], [0.08, 0.16], [zf - 0.004 - Math.min(0.32, d * 0.7), zf + 0.006], { bevel: 0.006, plan: false }),
      span('light', [-nw * 0.4, nw * 0.4], [0.11, 0.135], [zf + 0.005, zf + 0.008], o),
      span('device', [-nw + 0.02, nw - 0.02], [0.18, Math.min(0.3, cabH - 0.06)], [zf - 0.004 - Math.min(0.32, d * 0.7), zf + 0.006], { bevel: 0.006, plan: false }),
      // TV on a stand, screen showing lyrics.
      span('device', [-0.03, 0.03], [cabH, tvY0 + 0.05], [tz0 + 0.005, tz0 + 0.04], o),
      span('device', [-0.16, 0.16], [cabH, cabH + 0.015], [tz0 - 0.02, tz0 + 0.12], { bevel: 0.005, plan: false }),
      span('device', [-tvW / 2, tvW / 2], [tvY0, tvY0 + tvH], [tz0, tz0 + 0.045], { bevel: 0.006, plan: false }),
      span('light', [-tvW / 2 + 0.012, tvW / 2 - 0.012], [tvY0 + 0.012, tvY0 + tvH - 0.012], [tz0 + 0.045, tz0 + 0.048], o),
      span('metal', [-tvW * 0.3, tvW * 0.3], [tvY0 + tvH * 0.19, tvY0 + tvH * 0.22], [tz0 + 0.048, tz0 + 0.051], o),
      span('metal', [-tvW * 0.22, tvW * 0.22], [tvY0 + tvH * 0.11, tvY0 + tvH * 0.14], [tz0 + 0.048, tz0 + 0.051], o),
      span('device', [-tvW * 0.3, -tvW * 0.05], [tvY0 + tvH * 0.19, tvY0 + tvH * 0.22], [tz0 + 0.051, tz0 + 0.053], o),
    ];
    // Tower speakers either side.
    for (const side of [-1, 1]) {
      const sx = side * (w / 2 - sw / 2);
      const zs = d / 2 - 0.002;
      parts.push(span('device', [sx - sw / 2, sx + sw / 2], [0.03, sh], [d / 2 - sd, zs], { bevel: 0.012 }));
      parts.push(span('cabinet', [sx - sw / 2 + 0.01, sx + sw / 2 - 0.01], [0, 0.03], [d / 2 - sd + 0.01, zs - 0.01], o));
      const rw = sw * 0.36;
      for (const y of [sh * 0.22, sh * 0.48]) {
        parts.push(torus('metal', [sx, y, zs + 0.004], rw, 0.007, o));
        parts.push(discZ('device', [sx, y, zs], rw * 0.95, 0.01, o));
        parts.push(discZ('metal', [sx, y, zs + 0.004], rw * 0.2, 0.012, o));
      }
      parts.push(torus('metal', [sx, sh * 0.72, zs + 0.003], sw * 0.12, 0.005, o));
      parts.push(sphere('metal', [sx, sh * 0.72, zs], sw * 0.07, { scale: [1, 1, 0.5], plan: false }));
      parts.push(span('light', [sx - sw * 0.3, sx + sw * 0.3], [sh * 0.86, sh * 0.875], [zs, zs + 0.003], o));
    }
    // Mixer with knobs and faders.
    const mx0 = cabX * 0.42;
    const mx1 = cabX * 0.92;
    const mz0 = zf - Math.min(0.22, d * 0.5);
    const mz1 = zf - 0.03;
    parts.push(span('device', [mx0, mx1], [cabH, cabH + 0.05], [mz0, mz1], { bevel: 0.008, plan: false }));
    for (const x of spaced(5, mx0 + 0.04, mx1 - 0.04)) {
      parts.push(cyl('metal', [x, cabH + 0.058, mz0 + (mz1 - mz0) * 0.3], 0.01, 0.016, o));
      parts.push(span('metal', [x - 0.004, x + 0.004], [cabH + 0.05, cabH + 0.06], [mz0 + (mz1 - mz0) * 0.6, mz0 + (mz1 - mz0) * 0.8], o));
    }
    // Wireless mics in their charging dock.
    const dx0 = -cabX * 0.9;
    const dx1 = -cabX * 0.55;
    const dz = (mz0 + mz1) / 2;
    parts.push(span('device', [dx0, dx1], [cabH, cabH + 0.04], [mz0, mz1], { bevel: 0.01, plan: false }));
    for (const x of spaced(2, dx0 + 0.05, dx1 - 0.05)) {
      parts.push(vcyl('device', x, dz, cabH + 0.03, cabH + 0.2, 0.016, { rTop: 0.02, plan: false }));
      parts.push(cyl('metal', [x, cabH + 0.205, dz], 0.022, 0.012, o));
      parts.push(sphere('metal', [x, cabH + 0.225, dz], 0.03, o));
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const sw = clamp(w * 0.14, 0.2, 0.3);
    const sd = Math.min(d, 0.3);
    return [rectPoly(-w / 2, d / 2 - sd, -w / 2 + sw, d / 2), rectPoly(w / 2 - sw, d / 2 - sd, w / 2, d / 2), line([-w / 2 + sw + 0.03, -d / 2 + 0.06], [w / 2 - sw - 0.03, -d / 2 + 0.06])];
  },
});

const teakDaybed = defineItem({
  id: 'teak-daybed',
  name: 'Teak daybed (bale)',
  category: 'living',
  type: 'beds',
  group: 'Daybeds & sofa beds',
  tags: ['daybed', 'bale', 'teak', 'four poster', 'canopy', 'triangle pillow', 'mon khwan', 'thai', 'balinese', 'lounger', 'asian'],
  defaultSize: { w: 2.0, d: 1.1, h: 2.1 },
  minSize: { w: 1.6, d: 0.85, h: 1.6 },
  maxSize: { w: 2.4, d: 1.6, h: 2.6 },
  slots: [
    matSlot('teak', 'Teak frame', 'teak-golden'),
    matSlot('cushion', 'Mattress', 'batik-indigo'),
    matSlot('pillow', 'Triangle pillow & bolsters', 'batik-red'),
    matSlot('drape', 'Canopy & curtains', 'muslin-cream'),
  ],
  build: ({ w, d, h }) => {
    const post = 0.09;
    const platY = 0.42;
    const top = h - 0.06;
    const o = { plan: false };
    const xi = w / 2 - post;
    const zi = d / 2 - post;
    const parts: Part[] = [
      span('teak', [-w / 2 + 0.02, w / 2 - 0.02], [0.12, platY], [-d / 2 + 0.02, d / 2 - 0.02], { bevel: 0.01 }),
      // Canopy frame and fabric top with a pleated valance.
      span('teak', [-w / 2, w / 2], [top - 0.08, top], [-d / 2, -d / 2 + 0.06], o),
      span('teak', [-w / 2, w / 2], [top - 0.08, top], [d / 2 - 0.06, d / 2], o),
      span('teak', [-w / 2, -w / 2 + 0.06], [top - 0.08, top], [-d / 2 + 0.06, d / 2 - 0.06], o),
      span('teak', [w / 2 - 0.06, w / 2], [top - 0.08, top], [-d / 2 + 0.06, d / 2 - 0.06], o),
      span('drape', [-xi, xi], [top - 0.012, top - 0.004], [-zi, zi], o),
      ...drapeFolds('drape', [-xi, xi], [top - 0.32, top - 0.08], d / 2 - 0.03, Math.round((2 * xi) / 0.2), 0.035, o),
      // Segmented mattress (the classic folding mat), triangle pillow, bolsters and cushions.
      span('teak', [-w / 2 + 0.06, w / 2 - 0.06], [0.03, 0.12], [-d / 2 + 0.06, d / 2 - 0.06], o),
    ];
    // Posts with finials.
    for (const x of [-w / 2 + post / 2, w / 2 - post / 2]) {
      for (const z of [-d / 2 + post / 2, d / 2 - post / 2]) {
        parts.push(span('teak', [x - post / 2, x + post / 2], [0, top], [z - post / 2, z + post / 2], { bevel: 0.008 }));
        parts.push(sphere('teak', [x, h - 0.035, z], 0.035, o));
        parts.push(cyl('teak', [x, top + 0.004, z], 0.03, 0.008, o));
      }
    }
    // Front apron: three raised panels.
    for (const [x0, x1] of [[-xi, -xi / 3], [-xi / 3, xi / 3], [xi / 3, xi]] as V2[]) {
      parts.push(span('teak', [x0 + 0.04, x1 - 0.04], [0.17, platY - 0.05], [d / 2 - 0.02, d / 2 - 0.006], { bevel: 0.006, plan: false }));
    }
    // Back and side balustrades.
    const railY = platY + 0.36;
    parts.push(span('teak', [-xi, xi], [railY, railY + 0.05], [-d / 2 + 0.02, -d / 2 + 0.08], o));
    for (const x of spaced(Math.max(2, Math.round((2 * xi) / 0.15)), -xi + 0.06, xi - 0.06)) {
      parts.push(vcyl('teak', x, -d / 2 + 0.05, platY, railY, 0.014, o));
    }
    for (const sx of [-1, 1]) {
      parts.push(span('teak', sx < 0 ? [-w / 2 + 0.02, -w / 2 + 0.08] : [w / 2 - 0.08, w / 2 - 0.02], [platY + 0.26, platY + 0.31], [-zi, zi], o));
      for (const z of spaced(Math.max(2, Math.round((2 * zi) / 0.15)), -zi + 0.06, zi - 0.06)) {
        parts.push(vcyl('teak', sx * (w / 2 - 0.05), z, platY, platY + 0.26, 0.014, o));
      }
    }
    // Segmented mattress.
    const segs = clamp(Math.round((2 * xi - 0.04) / 0.2), 6, 12);
    for (const [x0, x1] of range(segs).map((i) => [-xi + 0.02 + ((2 * xi - 0.04) * i) / segs, -xi + 0.02 + ((2 * xi - 0.04) * (i + 1)) / segs] as V2)) {
      parts.push(cushion('cushion', [x0 + 0.002, x1 - 0.002], [platY, platY + 0.08], [-d / 2 + 0.09, d / 2 - 0.05], { softness: 0.45, plan: false }));
    }
    // Thai triangle pillow (mon khwan) against the back rail, with bolsters at each end.
    const tw = Math.min(0.6, xi * 0.6);
    const zb = -d / 2 + 0.09;
    const ty = platY + 0.08;
    parts.push(sidePlate('pillow', [[zb, ty], [zb + 0.32, ty], [zb + 0.03, ty + Math.min(0.46, top - ty - 0.4)]], -tw / 2, tw / 2));
    for (const sx of [-1, 1]) {
      parts.push(rodZ('pillow', sx * (xi - 0.12), ty + 0.085, zb + 0.08, d / 2 - 0.2, 0.08, { segments: 20, plan: false }));
      parts.push(pillow('pillow', [sx * (tw / 2 + 0.22), ty + 0.17, zb + 0.12], 0.4, 0.34, 0.12, { lean: 0.25, turn: sx * 0.15 }));
    }
    // Curtains tied back at the front posts.
    for (const sx of [-1, 1]) {
      const x = sx * (w / 2 - post - 0.06);
      const z = d / 2 - 0.08;
      const tieY = platY + 0.5;
      parts.push(cyl('drape', [x, (tieY + top - 0.08) / 2, z], 0.03, top - 0.08 - tieY, { rTop: 0.06, segments: 14, plan: false }));
      parts.push(cyl('drape', [x, (platY + 0.12 + tieY) / 2, z], 0.07, tieY - platY - 0.12, { rTop: 0.03, segments: 14, plan: false }));
      parts.push(ring('pillow', [x, tieY, z], 0.034, 0.008, o));
    }
    return parts;
  },
  planDetail: ({ w, d }) => [rectPoly(-w / 2 + 0.09, -d / 2 + 0.09, w / 2 - 0.09, d / 2 - 0.05), line([-w / 2, -d / 2], [w / 2, d / 2]), line([-w / 2, d / 2], [w / 2, -d / 2])],
});

const boxFan = defineItem({
  id: 'floor-fan-box',
  name: 'Box fan (quạt hộp)',
  category: 'living',
  type: 'electronics',
  group: 'Climate',
  tags: ['box fan', 'quat hop', 'fan', 'electric fan', 'rotating louvre', 'cooling', 'vietnam', 'asian'],
  defaultSize: { w: 0.4, d: 0.17, h: 0.46 },
  minSize: { w: 0.3, d: 0.13, h: 0.36 },
  maxSize: { w: 0.55, d: 0.22, h: 0.62 },
  slots: [
    matSlot('body', 'Body', 'plastic-cream-textured'),
    matSlot('grille', 'Rotating louvre', 'plastic-sky-textured'),
    matSlot('blades', 'Blades', 'fan-blade-clear'),
    matSlot('knobs', 'Knobs & keys', 'plastic-black'),
  ],
  build: ({ w, d, h }) => {
    const footH = 0.03;
    const handleH = 0.035;
    const y0 = footH;
    const y1 = h - handleH;
    const t = 0.028;
    const ctrlH = 0.055;
    const ax = w / 2 - t;
    const ayT = y1 - t;
    const ayB = y0 + ctrlH;
    const R = Math.min(ax, (ayT - ayB) / 2) - 0.006;
    const yc = (ayT + ayB) / 2;
    const zF = d / 2 - 0.006;
    const o = { plan: false };
    const parts: Part[] = [
      // Square housing.
      span('body', [-w / 2, w / 2], [y1 - t, y1], [-d / 2 + 0.01, d / 2], { bevel: 0.01 }),
      span('body', [-w / 2, w / 2], [y0, ayB], [-d / 2 + 0.01, d / 2], { bevel: 0.01 }),
      span('body', [-w / 2, -ax], [ayB, ayT], [-d / 2 + 0.01, d / 2], { bevel: 0.006 }),
      span('body', [ax, w / 2], [ayB, ayT], [-d / 2 + 0.01, d / 2], { bevel: 0.006 }),
      span('body', [-ax, ax], [ayB, ayT], [-d / 2 + 0.01, -d / 2 + 0.024], o),
      // Rear motor and the translucent blades.
      discZ('body', [0, yc, -d / 2 + 0.05], R * 0.26, 0.05, o),
      discZ('blades', [0, yc, -d / 2 + 0.085], R * 0.12, 0.03, o),
      // Bezel and the rotating louvre: radial vanes, rings and a badge.
      torus('body', [0, yc, zF - 0.004], R + 0.008, 0.01, o),
      torus('grille', [0, yc, zF - 0.008], R * 0.62, 0.005, o),
      discZ('grille', [0, yc, zF - 0.006], R * 0.2, 0.014, o),
      discZ('knobs', [0, yc, zF + 0.002], R * 0.12, 0.004, o),
    ];
    // Corner fillers between the round opening and the square frame.
    for (const [sx, sy] of [[1, 1], [-1, 1], [-1, -1], [1, -1]] as V2[]) {
      const arc = arcPoints(0, 0, R + 0.01, 0, Math.PI / 2, 8).map(([cx, cz]) => [sx * cx, yc + sy * cz] as V2);
      const yEdge = sy > 0 ? ayT : ayB;
      const pts: V2[] = [[sx * ax, yc], [sx * ax, yEdge], [0, yEdge], ...arc.slice().reverse()];
      parts.push(facePlate('body', pts, zF - 0.012, 0.012));
    }
    for (const k of range(4)) {
      const a = (k / 4) * Math.PI * 2 + 0.4;
      parts.push(sphere('blades', [Math.cos(a) * R * 0.48, yc + Math.sin(a) * R * 0.48, -d / 2 + 0.085], 0.5, { scale: [R * 0.78, R * 0.42, 0.006], rotation: [0, 0, a], plan: false }));
    }
    for (const k of range(14)) {
      const a = (k / 14) * Math.PI * 2;
      parts.push(box('grille', [Math.cos(a) * R * 0.58, yc + Math.sin(a) * R * 0.58, zF - 0.012], [R * 0.8, 0.012, 0.008], { rotation: [0, 0, a + 0.35], plan: false }));
    }
    // Controls along the bottom strip: piano keys and a timer knob.
    const cy = (y0 + ayB) / 2;
    for (const x of spaced(4, -ax + 0.02, -ax + 0.11)) {
      parts.push(span('knobs', [x - 0.011, x + 0.011], [cy - 0.012, cy + 0.012], [d / 2 - 0.002, d / 2 + 0.006], { bevel: 0.003, plan: false }));
    }
    parts.push(discZ('knobs', [ax - 0.03, cy, d / 2 + 0.004], 0.019, 0.016, o));
    parts.push(span('grille', [ax - 0.032, ax - 0.028], [cy + 0.004, cy + 0.017], [d / 2 + 0.012, d / 2 + 0.014], o));
    parts.push(sphere('grille', [0, cy, d / 2], 0.005, o));
    // Carry handle and feet.
    parts.push(...rodPath('body', [
      [-w * 0.2, y1 - 0.004, 0],
      [-w * 0.16, h - 0.012, 0],
      [w * 0.16, h - 0.012, 0],
      [w * 0.2, y1 - 0.004, 0],
    ], 0.01));
    for (const sx of [-1, 1]) parts.push(span('body', [sx * (w / 2 - 0.06) - 0.03, sx * (w / 2 - 0.06) + 0.03], [0, footH], [-d / 2, d / 2], { bevel: 0.008, plan: false }));
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w / 2 + 0.03, d / 2 - 0.01], [w / 2 - 0.03, d / 2 - 0.01])],
});

// ---------------------------------------------------------------------------
// Bathroom
// ---------------------------------------------------------------------------

const squatToilet = defineItem({
  id: 'squat-toilet',
  name: 'Squat toilet',
  category: 'bathroom',
  type: 'plumbing',
  group: 'Toilets',
  tags: ['squat toilet', 'squat pan', 'toilet', 'cistern', 'water bucket', 'dipper', 'bucket flush', 'asian'],
  defaultSize: { w: 0.85, d: 0.85, h: 1.05 },
  minSize: { w: 0.62, d: 0.7, h: 0.8 },
  maxSize: { w: 1.2, d: 1.2, h: 1.3 },
  wallSnap: true,
  slots: [
    matSlot('ceramic', 'Pan & cistern', 'ceramic-white'),
    matSlot('tile', 'Tiled step', 'terrazzo-speckled'),
    matSlot('plastic', 'Bucket & dipper', 'plastic-basin-red'),
    matSlot('metal', 'Pipes & taps', 'metal-chrome'),
  ],
  build: ({ w, d, h }) => {
    const ps = 0.12;
    const cisD = 0.16;
    const zWall = -d / 2;
    const panW = Math.min(0.42, w * 0.55);
    const r = panW / 2;
    const px = -w / 2 + 0.04 + r;
    const pz0 = zWall + cisD + 0.04;
    const pz1 = d / 2 - 0.04;
    const panL = Math.min(0.62, pz1 - pz0);
    const pcz = (pz0 + pz0 + panL) / 2;
    const zs = panL / 2 / r;
    const hp = 0.05;
    const o = { plan: false };
    const cw = Math.min(0.4, panW);
    const cy0 = h - 0.4;
    const cy1 = h - 0.05;
    const br = Math.min(0.15, (w - panW - 0.1) / 2);
    const bh = Math.min(0.32, h * 0.3);
    const bx = w / 2 - 0.03 - br;
    const bz = zWall + br + 0.03;
    const hood = panL * 0.36;
    const ty = ps + bh + 0.16;
    const parts: Part[] = [
      span('tile', [-w / 2, w / 2], [0, ps], [-d / 2, d / 2], { bevel: 0.01 }),
      // Ceramic pan with its foot treads and the hood at the wall end.
      lathe('ceramic', [px, ps, pcz], [
        [0, 0.012],
        [r * 0.32, 0.015],
        [r * 0.55, hp * 0.8],
        [r * 0.6, hp],
        [r, hp],
        [r, 0],
      ], { segments: 36, scale: [1, 1, zs], plan: false }),
      sphere('ceramic', [px, ps + hp * 0.5, pz0 + hood / 2], 0.5, { scale: [r * 1.25, 0.15, hood], plan: false }),
      cyl('metal', [px, ps + 0.016, pcz + panL * 0.28], 0.035, 0.004, o),
      // Low cistern on the wall, lid, flush lever and down pipe.
      span('ceramic', [px - cw / 2, px + cw / 2], [cy0, cy1], [zWall, zWall + cisD], { bevel: 0.015, plan: false }),
      span('ceramic', [px - cw / 2 - 0.005, px + cw / 2 + 0.005], [cy1, cy1 + 0.03], [zWall, zWall + cisD + 0.01], { bevel: 0.008, plan: false }),
      span('metal', [px - cw / 2 + 0.02, px - cw / 2 + 0.09], [cy1 - 0.05, cy1 - 0.035], [zWall + cisD, zWall + cisD + 0.012], { bevel: 0.003, plan: false }),
      discZ('metal', [px - cw / 2 + 0.03, cy1 - 0.042, zWall + cisD + 0.01], 0.012, 0.012, o),
      ...rodPath('metal', [
        [px, cy0 + 0.01, zWall + 0.06],
        [px, ps + 0.12, zWall + 0.06],
        [px, ps + 0.06, pz0 + 0.03],
      ], 0.02),
      // Wall tap above the bucket.
      discZ('metal', [bx, ty, zWall + 0.004], 0.025, 0.008, o),
      rodZ('metal', bx, ty, zWall, zWall + br * 0.9, 0.011, o),
      vcyl('metal', bx, zWall + br * 0.9, ty - 0.05, ty + 0.005, 0.009, o),
      rodX('metal', bx - 0.035, bx + 0.035, ty + 0.035, zWall + 0.04, 0.006, o),
      vcyl('metal', bx, zWall + 0.04, ty, ty + 0.035, 0.008, o),
      // Bucket and dipper.
      lathe('plastic', [bx, ps, bz], [
        [0, 0],
        [br * 0.84, 0],
        [br, bh],
        [br * 0.95, bh],
        [br * 0.8, 0.02],
        [0, 0.02],
      ], { segments: 32, plan: false }),
      ring('plastic', [bx, ps + bh, bz], br * 0.98, 0.007, o),
      torus('metal', [bx, ps + bh, bz], br * 0.96, 0.004, { arc: Math.PI, rotation: [-0.9, 0, 0], plan: false }),
      lathe('plastic', [bx + br * 0.25, ps + bh - 0.05, bz + br * 0.15], [
        [0, 0],
        [0.04, 0],
        [0.055, 0.06],
        [0.05, 0.06],
        [0.035, 0.006],
        [0, 0.006],
      ], { segments: 24, plan: false }),
      rod('plastic', [bx + br * 0.25 - 0.04, ps + bh + 0.005, bz + br * 0.15], [bx - br * 0.85, ps + bh + 0.06, bz + br * 0.15], 0.009, o),
    ];
    // Ribbed foot treads either side of the bowl.
    for (const sx of [-1, 1]) {
      for (const k of range(5)) {
        const z = pcz + panL * 0.04 + (k - 2) * 0.035;
        parts.push(span('ceramic', [px + sx * r * 0.8 - 0.032, px + sx * r * 0.8 + 0.032], [ps + hp, ps + hp + 0.006], [z - 0.008, z + 0.008], { bevel: 0.003, plan: false }));
      }
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const panW = Math.min(0.42, w * 0.55);
    const r = panW / 2;
    const px = -w / 2 + 0.04 + r;
    const pz0 = -d / 2 + 0.2;
    const panL = Math.min(0.62, d / 2 - 0.04 - pz0);
    const br = Math.min(0.15, (w - panW - 0.1) / 2);
    return [
      poly(ellipsePoints(px, pz0 + panL / 2, r, panL / 2, 28)),
      poly(ellipsePoints(px, pz0 + panL / 2 + 0.03, r * 0.55, panL * 0.3, 20)),
      rectPoly(px - Math.min(0.4, panW) / 2, -d / 2, px + Math.min(0.4, panW) / 2, -d / 2 + 0.16),
      circle([w / 2 - 0.03 - br, -d / 2 + br + 0.03], br),
    ];
  },
});

const wetBathSet = defineItem({
  id: 'wet-bath-set',
  name: 'Wet bathroom set',
  category: 'bathroom',
  type: 'plumbing',
  group: 'Showers & tubs',
  tags: ['wet bathroom', 'handheld shower', 'shower', 'plastic stool', 'basin', 'bucket', 'dipper', 'mandi', 'asian'],
  defaultSize: { w: 1.2, d: 0.7, h: 1.9 },
  minSize: { w: 1.0, d: 0.55, h: 1.6 },
  maxSize: { w: 1.6, d: 1.0, h: 2.2 },
  wallSnap: true,
  slots: [
    matSlot('metal', 'Shower & taps', 'metal-chrome'),
    matSlot('stool', 'Stool & bottles', 'plastic-sky-textured'),
    matSlot('tubs', 'Basin & bucket', 'plastic-basin-red'),
    matSlot('water', 'Water', 'water'),
  ],
  build: ({ w, d, h }) => {
    const zW = -d / 2;
    const o = { plan: false };
    const br = 0.14;
    const bh = 0.3;
    const rb = clamp(Math.min((w - 0.3 - 2 * br - 0.1) / 2, (d - 0.08) / 2), 0.14, 0.26);
    const sx = -w / 2 + 0.17;
    const bxB = -w / 2 + 0.36 + rb;
    const bzB = zW + rb + 0.05;
    const bx = w / 2 - 0.03 - br;
    const bz = zW + br + 0.04;
    const vy = 0.95;
    const by = h - 0.15;
    const zb = zW + 0.06;
    const st = 0.22;
    const sz = Math.min(d / 2 - 0.16, 0.08);
    const bbh = 0.16;
    const parts: Part[] = [
      // Mixer valve with lever, shower bracket and the handheld shower.
      discZ('metal', [bxB, vy, zW + 0.005], 0.045, 0.01, o),
      rodZ('metal', bxB, vy, zW, zW + 0.06, 0.018, o),
      rod('metal', [bxB, vy + 0.01, zW + 0.06], [bxB + 0.07, vy + 0.04, zW + 0.07], 0.006, o),
      vcyl('metal', bxB, zW + 0.05, vy - 0.06, vy - 0.01, 0.01, o),
      discZ('metal', [bxB, by, zW + 0.005], 0.02, 0.01, o),
      span('metal', [bxB - 0.012, bxB + 0.012], [by - 0.03, by + 0.01], [zW, zb + 0.01], { bevel: 0.004, plan: false }),
      rod('metal', [bxB, by - 0.09, zb + 0.005], [bxB, by + 0.08, zb + 0.05], 0.014, { rTop: 0.017, plan: false }),
      cyl('metal', [bxB, by + 0.1, zb + 0.06], 0.045, 0.025, { rotation: [Math.PI / 2 + 0.6, 0, 0], plan: false }),
      ...rodPath('metal', [
        [bxB, vy - 0.06, zW + 0.05],
        [bxB + 0.02, vy - 0.3, zW + 0.07],
        [bxB + 0.09, vy - 0.42, zW + 0.08],
        [bxB + 0.16, vy - 0.3, zW + 0.07],
        [bxB + 0.12, vy + 0.1, zW + 0.05],
        [bxB + 0.04, by - 0.3, zW + 0.04],
        [bxB, by - 0.09, zb + 0.005],
      ], 0.007),
      // Low tap above the bucket.
      discZ('metal', [bx, 0.55, zW + 0.004], 0.025, 0.008, o),
      rodZ('metal', bx, 0.55, zW, zW + br * 0.8, 0.01, o),
      vcyl('metal', bx, zW + br * 0.8, 0.5, 0.555, 0.008, o),
      rodX('metal', bx - 0.035, bx + 0.035, 0.59, zW + 0.035, 0.006, o),
      vcyl('metal', bx, zW + 0.035, 0.55, 0.59, 0.008, o),
      // Wall shelf with shampoo bottles.
      span('metal', [bx - 0.14, bx + 0.12], [1.3, 1.31], [zW, zW + 0.12], { plan: false }),
      rodX('metal', bx - 0.14, bx + 0.12, 1.34, zW + 0.115, 0.004, o),
      vcyl('stool', bx - 0.08, zW + 0.06, 1.31, 1.5, 0.03, o),
      vcyl('tubs', bx - 0.01, zW + 0.06, 1.31, 1.46, 0.032, o),
      cyl('metal', [bx - 0.08, 1.51, zW + 0.06], 0.012, 0.02, o),
      // Big shallow basin of water.
      lathe('tubs', [bxB, 0, bzB], [
        [0, 0],
        [rb * 0.74, 0],
        [rb * 0.95, bbh * 0.9],
        [rb, bbh],
        [rb * 0.93, bbh],
        [rb * 0.72, 0.012],
        [0, 0.012],
      ], { segments: 40 }),
      ring('tubs', [bxB, bbh, bzB], rb * 0.97, 0.008, o),
      cyl('water', [bxB, bbh * 0.72, bzB], rb * 0.9, 0.006, { segments: 40, plan: false }),
      // Bucket with water and a floating dipper.
      lathe('tubs', [bx, 0, bz], [
        [0, 0],
        [br * 0.84, 0],
        [br, bh],
        [br * 0.95, bh],
        [br * 0.8, 0.02],
        [0, 0.02],
      ], { segments: 32 }),
      ring('tubs', [bx, bh, bz], br * 0.98, 0.007, o),
      cyl('water', [bx, bh * 0.82, bz], br * 0.92, 0.006, o),
      torus('metal', [bx, bh, bz], br * 0.96, 0.004, { arc: Math.PI, rotation: [-1.0, 0, 0], plan: false }),
      lathe('stool', [bx - br * 0.2, bh * 0.82 - 0.03, bz + br * 0.1], [
        [0, 0],
        [0.035, 0],
        [0.05, 0.055],
        [0.045, 0.055],
        [0.03, 0.006],
        [0, 0.006],
      ], { segments: 24, plan: false }),
      rod('stool', [bx - br * 0.2 + 0.04, bh * 0.82 + 0.02, bz + br * 0.1], [bx + br * 0.9, bh + 0.06, bz + br * 0.1], 0.008, o),
      // Low plastic stool.
      span('stool', [sx - 0.15, sx + 0.15], [st - 0.025, st], [sz - 0.15, sz + 0.15], { bevel: 0.02 }),
      span('stool', [sx - 0.04, sx + 0.04], [st - 0.004, st + 0.001], [sz - 0.012, sz + 0.012], { bevel: 0.004, plan: false }),
      span('stool', [sx - 0.14, sx + 0.14], [st - 0.06, st - 0.025], [sz + 0.13, sz + 0.14], o),
      span('stool', [sx - 0.14, sx + 0.14], [st - 0.06, st - 0.025], [sz - 0.14, sz - 0.13], o),
      span('stool', [sx - 0.14, sx - 0.13], [st - 0.06, st - 0.025], [sz - 0.13, sz + 0.13], o),
      span('stool', [sx + 0.13, sx + 0.14], [st - 0.06, st - 0.025], [sz - 0.13, sz + 0.13], o),
    ];
    for (const lx of [-1, 1]) {
      for (const lz of [-1, 1]) {
        parts.push(rod('stool', [sx + lx * 0.115, st - 0.03, sz + lz * 0.115], [sx + lx * 0.135, 0.01, sz + lz * 0.135], 0.016, { rTop: 0.013, plan: false }));
      }
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const rb = clamp(Math.min((w - 0.3 - 0.28 - 0.1) / 2, (d - 0.08) / 2), 0.14, 0.26);
    return [circle([-w / 2 + 0.36 + rb, -d / 2 + rb + 0.05], rb * 0.85), circle([w / 2 - 0.17, -d / 2 + 0.18], 0.12)];
  },
});

// ---------------------------------------------------------------------------
// Laundry
// ---------------------------------------------------------------------------

const dryingRack = defineItem({
  id: 'ceiling-drying-rack',
  name: 'Ceiling clothes drying rack',
  category: 'laundry',
  type: 'appliances',
  group: 'Laundry',
  tags: ['drying rack', 'clothes airer', 'laundry', 'ceiling', 'pulley', 'hangers', 'balcony', 'gian phoi', 'asian'],
  mount: 'ceiling',
  defaultElevation: 1.69,
  defaultSize: { w: 1.6, d: 0.5, h: 1.0 },
  minSize: { w: 1.0, d: 0.4, h: 0.6 },
  maxSize: { w: 2.4, d: 0.7, h: 1.4 },
  slots: [
    matSlot('frame', 'Rack', 'aluminium-satin'),
    matSlot('clothesA', 'Batik clothes', 'batik-indigo'),
    matSlot('clothesB', 'Cotton clothes', 'fabric-sky'),
    matSlot('hangers', 'Hangers & pegs', 'plastic-pink-textured'),
  ],
  build: ({ w, d, h }) => {
    const barY = h - Math.min(0.4, h * 0.38);
    const zB = -d * 0.2;
    const zF = d * 0.2;
    const o = { plan: false };
    const rand = rng(5);
    const parts: Part[] = [rodX('frame', -w / 2 + 0.02, w / 2 - 0.02, barY, zB, 0.012), rodX('frame', -w / 2 + 0.02, w / 2 - 0.02, barY, zF, 0.012)];
    // Ceiling pulleys, lift cables and end pieces.
    for (const sx of [-1, 1]) {
      const x = sx * (w / 2 - 0.12);
      parts.push(span('frame', [x - 0.05, x + 0.05], [h - 0.02, h], [-d * 0.3, d * 0.3], { bevel: 0.006, plan: false }));
      parts.push(cyl('frame', [x, h - 0.045, 0], 0.025, 0.05, o));
      parts.push(rod('frame', [x, h - 0.07, 0], [x, barY + 0.08, 0], 0.003, o));
      parts.push(span('frame', [x - 0.015, x + 0.015], [barY + 0.06, barY + 0.1], [-0.02, 0.02], { bevel: 0.005, plan: false }));
      parts.push(rod('frame', [x, barY + 0.06, 0], [x, barY, zB], 0.006, o));
      parts.push(rod('frame', [x, barY + 0.06, 0], [x, barY, zF], 0.006, o));
    }
    // Shirts and trousers on hangers along the back bar.
    const sw = Math.min(0.36, d * 0.55);
    const zc = clamp(zB, -d / 2 + sw / 2 + 0.06, d / 2 - sw / 2 - 0.06);
    const nS = clamp(Math.floor((w - 0.3) / 0.2), 2, 8);
    for (const [i, x] of spaced(nS, -w / 2 + 0.18, w / 2 - 0.18).entries()) {
      const slot = i % 2 ? 'clothesB' : 'clothesA';
      const apex = barY - 0.05;
      parts.push(torus('hangers', [x, barY + 0.012, zB], 0.016, 0.003, { arc: Math.PI, rotation: [0, Math.PI / 2, 0], plan: false }));
      parts.push(rod('hangers', [x, barY - 0.004, zB], [x, apex, zc], 0.003, o));
      if (i % 3 === 2) {
        const len = Math.min(0.7, barY - 0.12) * (0.85 + rand() * 0.15);
        parts.push(rod('hangers', [x, apex, zc], [x, apex - 0.03, zc - sw * 0.35], 0.004, o));
        parts.push(rod('hangers', [x, apex, zc], [x, apex - 0.03, zc + sw * 0.35], 0.004, o));
        parts.push(rodZ('hangers', x, apex - 0.03, zc - sw * 0.38, zc + sw * 0.38, 0.005, o));
        for (const lz of [-1, 1]) {
          parts.push(span(slot, [x - 0.012, x + 0.012], [apex - 0.03 - len, apex - 0.03], lz < 0 ? [zc - sw * 0.36, zc - 0.005] : [zc + 0.005, zc + sw * 0.36], { bevel: 0.004, plan: false }));
        }
      } else {
        const sh = Math.min(0.55, barY - 0.16) * (0.8 + rand() * 0.2);
        const top = apex - 0.06;
        parts.push(rod('hangers', [x, apex, zc], [x, top, zc - sw * 0.45], 0.004, o));
        parts.push(rod('hangers', [x, apex, zc], [x, top, zc + sw * 0.45], 0.004, o));
        parts.push(rodZ('hangers', x, top, zc - sw * 0.45, zc + sw * 0.45, 0.004, o));
        parts.push(span(slot, [x - 0.012, x + 0.012], [top - sh, top + 0.01], [zc - sw * 0.4, zc + sw * 0.4], { bevel: 0.005, plan: false }));
        for (const lz of [-1, 1]) {
          parts.push(box(slot, [x, top - 0.07, zc + lz * (sw * 0.4 + 0.02)], [0.022, 0.14, 0.06], { rotation: [lz * 0.5, 0, 0], bevel: 0.004, plan: false }));
        }
      }
    }
    // Towels over the front bar, leaving room for the sock hanger.
    const tx0 = -w / 2 + 0.14;
    const tx1 = w / 2 - 0.46;
    const nT = Math.max(1, Math.floor((tx1 - tx0) / 0.42));
    for (const [i, x] of spaced(nT, tx0 + (tx1 - tx0) / (2 * nT), tx1 - (tx1 - tx0) / (2 * nT)).entries()) {
      const slot = i % 2 ? 'clothesA' : 'clothesB';
      const tl = Math.min(0.45, barY - 0.05) * (0.8 + rand() * 0.2);
      const tw = Math.min(0.36, ((tx1 - tx0) / nT) * 0.85);
      parts.push(rodX(slot, x - tw / 2, x + tw / 2, barY + 0.006, zF, 0.016, o));
      parts.push(span(slot, [x - tw / 2, x + tw / 2], [barY - tl, barY + 0.006], [zF + 0.008, zF + 0.016], o));
      parts.push(span(slot, [x - tw / 2, x + tw / 2], [barY - tl * 0.7, barY + 0.006], [zF - 0.016, zF - 0.008], o));
    }
    // Round peg hanger with socks and underwear.
    const hx = w / 2 - 0.24;
    const rr = Math.min(0.16, d / 2 - zF - 0.03);
    const ry = barY - 0.14;
    parts.push(torus('hangers', [hx, barY + 0.012, zF], 0.016, 0.003, { arc: Math.PI, rotation: [0, Math.PI / 2, 0], plan: false }));
    parts.push(rod('hangers', [hx, barY - 0.004, zF], [hx, ry + 0.06, zF], 0.003, o));
    parts.push(ring('hangers', [hx, ry, zF], rr, 0.006, o));
    for (const k of range(3)) {
      const a = (k / 3) * Math.PI * 2;
      parts.push(rod('hangers', [hx, ry + 0.06, zF], [hx + Math.cos(a) * rr, ry, zF + Math.sin(a) * rr], 0.0025, o));
    }
    for (const k of range(8)) {
      const a = (k / 8) * Math.PI * 2 + 0.2;
      const cx = hx + Math.cos(a) * rr;
      const cz = zF + Math.sin(a) * rr;
      const len = Math.min(0.16 + rand() * 0.06, ry - 0.04);
      parts.push(span('hangers', [cx - 0.006, cx + 0.006], [ry - 0.035, ry + 0.005], [cz - 0.008, cz + 0.008], o));
      parts.push(span(k % 2 ? 'clothesA' : 'clothesB', [cx - 0.03, cx + 0.03], [ry - 0.03 - len, ry - 0.025], [cz - 0.006, cz + 0.006], { bevel: 0.003, rotation: [0, a, 0], plan: false }));
    }
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w / 2 + 0.02, -d * 0.2], [w / 2 - 0.02, -d * 0.2]), line([-w / 2 + 0.02, d * 0.2], [w / 2 - 0.02, d * 0.2])],
});

// ---------------------------------------------------------------------------
// Electronics
// ---------------------------------------------------------------------------

const airCooler = defineItem({
  id: 'air-cooler',
  name: 'Evaporative air cooler',
  category: 'electronics',
  type: 'electronics',
  group: 'Climate',
  tags: ['air cooler', 'evaporative cooler', 'swamp cooler', 'quat dieu hoa', 'cooling', 'fan', 'water tank', 'asian'],
  defaultSize: { w: 0.42, d: 0.34, h: 1.05 },
  minSize: { w: 0.32, d: 0.26, h: 0.7 },
  maxSize: { w: 0.55, d: 0.45, h: 1.3 },
  slots: [
    matSlot('body', 'Body', 'plastic-white-textured'),
    matSlot('louvre', 'Louvres & buttons', 'plastic-cooler-blue'),
    matSlot('pad', 'Cooling pads', 'cooling-pad'),
    matSlot('dark', 'Grilles & wheels', 'plastic-black'),
  ],
  build: ({ w, d, h }) => {
    const y0 = 0.05;
    const top = h - 0.006;
    const zf = d / 2 - 0.005;
    const lx: V2 = [-w / 2 + 0.06, w / 2 - 0.06];
    const ly: V2 = [h * 0.55, h - 0.12];
    const o = { plan: false };
    const parts: Part[] = [
      span('body', [-w / 2 + 0.005, w / 2 - 0.005], [y0, top], [-d / 2 + 0.005, zf], { bevel: 0.04 }),
      span('body', [-w / 2, w / 2], [y0, y0 + 0.1], [-d / 2, d / 2], { bevel: 0.03 }),
      // Front louvres over a dark grille.
      span('dark', [lx[0], lx[1]], [ly[0], ly[1]], [zf - 0.002, zf + 0.002], o),
      ...slats('dark', lx, ly, [zf + 0.002, zf + 0.006], 6, { axis: 'x', gap: 0.75, plan: false }),
      ...slats('louvre', lx, ly, [zf + 0.004, zf + 0.016], Math.max(4, Math.round((ly[1] - ly[0]) / 0.03)), { axis: 'y', gap: 0.45, bevel: 0.002, plan: false }),
      span('louvre', [-w * 0.18, w * 0.18], [ly[0] - 0.04, ly[0] - 0.03], [zf - 0.001, zf + 0.003], o),
      // Water tank window with level marks.
      span('louvre', [-0.05, 0.05], [y0 + 0.13, y0 + 0.25], [zf - 0.002, zf + 0.003], { bevel: 0.004, plan: false }),
      // Top control panel: display and buttons; handle recess at the back.
      span('dark', [-w / 2 + 0.05, w / 2 - 0.05], [top - 0.004, top + 0.004], [d / 2 - 0.16, d / 2 - 0.04], { bevel: 0.002, plan: false }),
      span('louvre', [-0.04, 0.04], [top + 0.003, top + 0.005], [d / 2 - 0.15, d / 2 - 0.12], o),
      span('dark', [-0.08, 0.08], [top - 0.003, top + 0.004], [-d / 2 + 0.03, -d / 2 + 0.06], o),
    ];
    for (const k of range(3)) parts.push(span('dark', [-0.03, 0.03], [y0 + 0.16 + k * 0.03, y0 + 0.163 + k * 0.03], [zf + 0.003, zf + 0.005], o));
    for (const x of spaced(4, -w / 2 + 0.08, w / 2 - 0.08)) parts.push(cyl('louvre', [x, top + 0.003, d / 2 - 0.08], 0.01, 0.006, o));
    // Honeycomb pads behind slotted grilles on both sides and the back.
    const py: V2 = [h * 0.28, h * 0.85];
    for (const sx of [-1, 1]) {
      const x0 = sx * (w / 2 - 0.004);
      parts.push(span('pad', [Math.min(x0, x0 + sx * 0.006), Math.max(x0, x0 + sx * 0.006)], py, [-d / 2 + 0.05, d / 2 - 0.05], o));
      parts.push(...slats('body', sx < 0 ? [-w / 2 - 0.004, -w / 2 + 0.002] : [w / 2 - 0.002, w / 2 + 0.004], py, [-d / 2 + 0.05, d / 2 - 0.05], Math.max(4, Math.round((d - 0.1) / 0.03)), { axis: 'z', gap: 0.6, plan: false }));
    }
    parts.push(span('pad', [-w / 2 + 0.05, w / 2 - 0.05], py, [-d / 2 - 0.002, -d / 2 + 0.006], o));
    parts.push(...slats('body', [-w / 2 + 0.05, w / 2 - 0.05], py, [-d / 2 - 0.004, -d / 2 + 0.002], Math.max(4, Math.round((w - 0.1) / 0.03)), { axis: 'x', gap: 0.6, plan: false }));
    // Castors.
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const x = sx * (w / 2 - 0.05);
        const z = sz * (d / 2 - 0.05);
        parts.push(vcyl('dark', x, z, 0.035, y0 + 0.01, 0.012, o));
        parts.push(cyl('dark', [x, 0.022, z], 0.022, 0.018, { rotation: [0, 0, Math.PI / 2], plan: false }));
      }
    }
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w / 2 + 0.06, d / 2 - 0.02], [w / 2 - 0.06, d / 2 - 0.02])],
});

// ---------------------------------------------------------------------------
// Outdoor
// ---------------------------------------------------------------------------


const frangipani = defineItem({
  id: 'potted-frangipani',
  name: 'Potted frangipani tree',
  category: 'plants',
  type: 'plants',
  group: 'Outdoor plants',
  plant: PLANT_SPECIES['plumeria-rubra'],
  tags: ['frangipani', 'plumeria', 'hoa su', 'champa', 'temple tree', 'flowering tree', 'glazed pot', 'tropical', 'asian'],
  description: 'A frangipani tree (hoa sứ) with thick branching stems, clusters of long leaves and fragrant white-and-yellow flowers, in a cobalt glazed pot.',
  defaultSize: { w: 0.9, d: 0.9, h: 1.8 },
  minSize: { w: 0.5, d: 0.5, h: 1.0 },
  maxSize: { w: 1.6, d: 1.6, h: 3.0 },
  slots: [
    matSlot('pot', 'Glazed pot', 'glazed-pot-cobalt'),
    matSlot('bark', 'Trunk & soil', 'frangipani-bark'),
    matSlot('leaves', 'Leaves', 'plant-leaf-dark'),
    matSlot('flowers', 'Flowers', 'frangipani-flower'),
  ],
  build: ({ w, d, h }) => {
    const s = Math.min(w, d);
    const potR = clamp(s * 0.26, 0.14, 0.3);
    const potH = Math.min(potR * 1.3, h * 0.28);
    const leafLen = clamp(s * 0.17, 0.12, 0.3);
    const leafWid = leafLen * 0.3;
    const Rc = Math.max(0.04, s / 2 - leafLen - leafWid / 2 - 0.02);
    const y3 = h - leafLen * 0.95 - leafWid / 2 - 0.02;
    const yF = potH + (y3 - potH) * 0.4;
    const y2 = yF + (y3 - yF) * 0.5;
    const tr = clamp(s * 0.045, 0.03, 0.07);
    const o = { plan: false };
    const rand = rng(17);
    const parts: Part[] = [
      pot('pot', [0, 0, 0], potR, potH, 'belly'),
      ring('pot', [0, potH - 0.004, 0], potR * 0.62, 0.012, o),
      cyl('bark', [0, potH - 0.025, 0], potR * 0.6, 0.012, o),
      rod('bark', [0, potH - 0.03, 0], [0.01, yF, 0], tr, { rTop: tr * 0.85, plan: false }),
      sphere('bark', [0.01, yF, 0], tr * 0.95, o),
    ];
    const F: V3 = [0.01, yF, 0];
    for (const k of range(3)) {
      const az = Math.PI / 2 + (k * Math.PI * 2) / 3 + (rand() - 0.5) * 0.5;
      const P1: V3 = [Math.cos(az) * Rc * 0.5, y2 + (rand() - 0.5) * 0.06, Math.sin(az) * Rc * 0.5];
      parts.push(rod('bark', F, P1, tr * 0.72, { rTop: tr * 0.6, plan: false }));
      parts.push(sphere('bark', P1, tr * 0.62, o));
      for (const side of [-1, 1]) {
        const a2 = az + side * (0.45 + rand() * 0.2);
        const rr = Rc * (0.85 + rand() * 0.15);
        const tip: V3 = [Math.cos(a2) * rr, y3 - rand() * Math.min(0.1, (y3 - y2) * 0.3), Math.sin(a2) * rr];
        parts.push(rod('bark', P1, tip, tr * 0.52, { rTop: tr * 0.42, plan: false }));
        // Rosette of long leaves at the branch tip.
        for (const j of range(6)) {
          const la = (j / 6) * Math.PI * 2 + rand() * 0.6;
          parts.push(leaf('leaves', tip, leafLen * (0.8 + rand() * 0.2), leafWid * (0.85 + rand() * 0.2), la, 0.6 + rand() * 0.55));
        }
        // Two five-petalled flowers above the rosette.
        for (const f of range(2)) {
          const fa = a2 + (f - 0.5) * 1.6;
          const c: V3 = [tip[0] + Math.cos(fa) * 0.03, tip[1] + 0.04 + f * 0.015, tip[2] + Math.sin(fa) * 0.03];
          const pl = clamp(leafLen * 0.2, 0.025, 0.05);
          for (const p of range(5)) {
            parts.push(leaf('flowers', c, pl, pl * 0.6, (p / 5) * Math.PI * 2 + f, 1.2, { thick: 0.004 }));
          }
        }
      }
    }
    return parts;
  },
  planDetail: ({ w, d }) => [circle([0, 0], clamp(Math.min(w, d) * 0.26, 0.14, 0.3) * 0.62)],
});

// ---------------------------------------------------------------------------
// Decor
// ---------------------------------------------------------------------------


export default definePack({
  name: 'Asian everyday',
  version: '1.0.0',
  author: 'Neest team',
  description:
    'Everyday objects from homes across East and Southeast Asia: rice cooker, hot pot table, water dispenser, shoe rack and slippers, massage chair, karaoke set, squat toilet, wet bathroom, drying rack, air cooler, teak daybed, tiffin carrier, frangipani and box fan.',
  license: 'CC0 (made for Neest)',
  items: [
    riceCooker,
    hotpotTable,
    waterDispenser,
    shoeRack,
    massageChair,
    karaokeSet,
    squatToilet,
    wetBathSet,
    dryingRack,
    airCooler,
    teakDaybed,
    tiffinCarrier,
    frangipani,
    boxFan,
  ],
  patterns: [
    {
      id: 'textured-plastic',
      name: 'Textured plastic',
      normalStrength: 0.45,
      // Fine orange-peel stipple of moulded household plastic; near-white so the colour tints it.
      draw(ctx, size, rand) {
        const coarse = tileNoise(rand, 24);
        const fine = tileNoise(rand, 112);
        paint(ctx, size, (u, v) => {
          const n = 0.9 + (coarse(u * 24, v * 24) - 0.5) * 0.05 + (fine(u * 112, v * 112) - 0.5) * 0.12;
          return [n, n, n];
        });
      },
    },
    {
      id: 'speckled-terrazzo',
      name: 'Speckled terrazzo tile',
      normalStrength: 0.35,
      colored: true,
      // 2 × 2 cast terrazzo tiles: cream cement, mottling, coloured stone chips and grout joints.
      draw(ctx, size, rand) {
        const mottle = tileNoise(rand, 8);
        const base = hex('#e6dfd1');
        const chipColors = ['#3b3836', '#8e8a85', '#a4553c', '#f6f3ec', '#56705f', '#c49a55', '#6d6a66'].map(hex);
        const chip = new Int8Array(size * size).fill(-1);
        const sc = size / 512;
        const count = Math.round(1400 * sc * sc);
        for (let k = 0; k < count; k++) {
          const cx = rand() * size;
          const cy = rand() * size;
          const big = rand() < 0.12;
          const rx = (big ? 4 + rand() * 5 : 1 + rand() * 2.6) * sc;
          const ry = rx * (0.5 + rand() * 0.5);
          const a = rand() * Math.PI;
          const ca = Math.cos(a);
          const sa = Math.sin(a);
          const ci = Math.floor(rand() * chipColors.length);
          const R = Math.ceil(rx) + 1;
          for (let yy = -R; yy <= R; yy++) {
            for (let xx = -R; xx <= R; xx++) {
              const px = Math.floor(cx) + xx;
              const py = Math.floor(cy) + yy;
              const lx = (px + 0.5 - cx) * ca + (py + 0.5 - cy) * sa;
              const ly = -(px + 0.5 - cx) * sa + (py + 0.5 - cy) * ca;
              if ((lx / rx) ** 2 + (ly / ry) ** 2 > 1 + Math.abs(Math.sin(lx * 1.7 + ly)) * 0.3) continue;
              chip[(((py % size) + size) % size) * size + (((px % size) + size) % size)] = ci;
            }
          }
        }
        const half = size / 2;
        const g = Math.max(1.5, size * 0.004);
        paint(ctx, size, (u, v, x, y) => {
          const ex = Math.min(x % half, half - (x % half));
          const ey = Math.min(y % half, half - (y % half));
          const e = Math.min(ex, ey);
          if (e < g) return [0.74, 0.71, 0.66];
          const m = 0.95 + (mottle(u * 8, v * 8) - 0.5) * 0.1;
          const edge = e < g + 2 ? 0.94 : 1;
          const ci = chip[y * size + x];
          const c = ci >= 0 ? chipColors[ci] : base;
          return [c[0] * m * edge, c[1] * m * edge, c[2] * m * edge];
        });
      },
    },
    {
      id: 'batik-kawung',
      name: 'Kawung batik',
      normalStrength: 0.25,
      colored: true,
      // Classic kawung motif (four-petal palm-fruit flowers) on indigo, with fine wax crackle lines.
      draw(ctx, size, rand) {
        const n = 4;
        const crack = crackMask(tileNoise(rand, 12), 12, size, 0.7);
        const crack2 = crackMask(tileNoise(rand, 20), 20, size, 0.5);
        const indigo = hex('#1f2c57');
        const cream = hex('#ead9b5');
        const brown = hex('#7b4a24');
        const soga = hex('#b7793a');
        paint(ctx, size, (u, v, x, y) => {
          const gx = u * n;
          const gy = v * n;
          const fx = gx - Math.floor(gx) - 0.5;
          const fy = gy - Math.floor(gy) - 0.5;
          // Petals sit on the cell diagonals; each corner gathers four petals into a flower.
          let col = indigo;
          const qx = Math.abs(fx);
          const qy = Math.abs(fy);
          const along = (qx + qy) / Math.SQRT2 - 0.3;
          const across = (qx - qy) / Math.SQRT2;
          const pe = (along / 0.27) ** 2 + (across / 0.13) ** 2;
          if (pe < 1) {
            col = pe > 0.72 ? brown : cream;
            const inner = ((along - 0.06) / 0.07) ** 2 + (across / 0.035) ** 2;
            if (inner < 1) col = soga;
          }
          const cd = Math.hypot(fx, fy);
          if (cd < 0.07) col = cd < 0.04 ? soga : cream;
          // Wax crackle: thin veins where the noise crosses mid-level.
          const vein = crack[y * size + x] + crack2[y * size + x] > 0;
          const weave = (x + y) % 2 === 0 ? 1 : 0.96;
          const k = vein ? (col === indigo ? 1.6 : 0.75) : 1;
          return [col[0] * k * weave, col[1] * k * weave, col[2] * k * weave];
        });
      },
    },
    {
      id: 'teak-grain',
      name: 'Teak grain',
      normalStrength: 0.3,
      // Long, gently waving teak grain with dark streaks and open pores; near-white for tinting.
      draw(ctx, size, rand) {
        const warp = tileNoise(rand, 3, 4);
        const warp2 = tileNoise(rand, 9);
        const streak = tileNoise(rand, 3, 28);
        const pores = tileNoise(rand, 40, 160);
        paint(ctx, size, (u, v) => {
          const wv = v + (warp(u * 3, v * 4) - 0.5) * 0.045 + (warp2(u * 9, v * 9) - 0.5) * 0.012;
          const g = Math.sin(wv * Math.PI * 2 * 22);
          const g2 = Math.sin(wv * Math.PI * 2 * 57 + 1.3);
          const st = streak(u * 3, wv * 28);
          let l = 0.86 + g * 0.045 + g2 * 0.02 - Math.max(0, st - 0.58) * 0.4;
          const p = pores(u * 40, v * 160);
          if (p < 0.2) l -= (0.2 - p) * 0.5;
          return [l, l, l];
        });
      },
    },
  ],
  materials: [
    // Plastics (textured-plastic pattern).
    { id: 'plastic-white-textured', name: 'Textured white plastic', color: '#f1eee8', roughness: 0.55, pattern: { id: 'textured-plastic', scale: 0.08 } },
    { id: 'plastic-cream-textured', name: 'Textured cream plastic', color: '#eee4cc', roughness: 0.55, pattern: { id: 'textured-plastic', scale: 0.08 } },
    { id: 'plastic-pink-textured', name: 'Textured pink plastic', color: '#efa3b8', roughness: 0.5, pattern: { id: 'textured-plastic', scale: 0.08 } },
    { id: 'plastic-sky-textured', name: 'Textured sky-blue plastic', color: '#7fbde3', roughness: 0.5, pattern: { id: 'textured-plastic', scale: 0.08 } },
    { id: 'plastic-basin-red', name: 'Basin red plastic', color: '#d23b35', roughness: 0.45, pattern: { id: 'textured-plastic', scale: 0.1 } },
    { id: 'plastic-cooler-blue', name: 'Cooler blue plastic', color: '#5b9fd0', roughness: 0.4, pattern: { id: 'textured-plastic', scale: 0.08 } },
    { id: 'massage-shell', name: 'Champagne shell', color: '#dccfbb', roughness: 0.3, metalness: 0.15, pattern: { id: 'textured-plastic', scale: 0.12, contrast: 0.5 } },
    { id: 'fan-blade-clear', name: 'Clear blue fan blades', color: '#9fd3f2', roughness: 0.15, opacity: 0.6 },
    { id: 'pet-bottle-blue', name: 'Blue water bottle', category: 'glass', color: '#8cc6ee', roughness: 0.08, opacity: 0.55 },
    // Tile and stone.
    { id: 'terrazzo-speckled', name: 'Speckled terrazzo tile', category: 'tile', color: '#ffffff', roughness: 0.4, pattern: { id: 'speckled-terrazzo', scale: 0.6 } },
    // Textiles (batik-kawung pattern and built-ins).
    { id: 'batik-indigo', name: 'Indigo kawung batik', category: 'fabric', color: '#ffffff', roughness: 0.9, pattern: { id: 'batik-kawung', scale: 0.3 } },
    { id: 'batik-red', name: 'Red kawung batik', category: 'fabric', color: '#f3a58e', roughness: 0.85, pattern: { id: 'batik-kawung', scale: 0.25 } },
    { id: 'muslin-cream', name: 'Cream muslin', category: 'fabric', color: '#f3ece0', roughness: 0.95, opacity: 0.88, pattern: { id: 'weave', scale: 0.1, contrast: 0.4 } },
    { id: 'massage-leather', name: 'Massage chair leather', category: 'leather', color: '#4a2f2a', roughness: 0.55, pattern: { id: 'leather', scale: 0.2, contrast: 0.6 } },
    { id: 'cooling-pad', name: 'Cellulose cooling pad', color: '#c99659', roughness: 0.95, pattern: { id: 'hex', scale: 0.05, contrast: 0.8 } },
    // Wood (teak-grain pattern).
    { id: 'teak-golden', name: 'Golden teak', category: 'wood', color: '#b67a3e', roughness: 0.55, pattern: { id: 'teak-grain', scale: 0.6 } },
    { id: 'teak-dark', name: 'Dark teak', category: 'wood', color: '#6d4224', roughness: 0.5, pattern: { id: 'teak-grain', scale: 0.6 } },
    { id: 'lacquer-red', name: 'Red lacquer', category: 'wood', color: '#951c16', roughness: 0.28, pattern: { id: 'teak-grain', scale: 0.5, contrast: 0.25 } },
    // Metals, glazes and glows.
    { id: 'gold-leaf', name: 'Gold leaf', category: 'metal', color: '#d9a441', roughness: 0.32, metalness: 0.85, pattern: { id: 'brushed', scale: 0.2, contrast: 0.4 } },
    { id: 'aluminium-satin', name: 'Satin aluminium', category: 'metal', color: '#c6cace', roughness: 0.35, metalness: 0.8, pattern: { id: 'brushed', scale: 0.3, contrast: 0.5 } },
    { id: 'enamel-pinto', name: 'Green enamel', color: '#2f7d6d', roughness: 0.22, metalness: 0.05 },
    { id: 'glazed-pot-cobalt', name: 'Cobalt glazed ceramic', color: '#25477a', roughness: 0.2, pattern: { id: 'marble', scale: 0.5, contrast: 0.3 } },
    { id: 'chili-broth', name: 'Chilli broth', color: '#b3261e', roughness: 0.15 },
    { id: 'karaoke-glow', name: 'Karaoke screen glow', color: '#6f63e8', roughness: 0.2, emissive: '#7d6dff', emissiveIntensity: 1.6 },
    { id: 'shrine-red-glow', name: 'Shrine lamp glow', color: '#ff4a3a', roughness: 0.4, emissive: '#ff2a1c', emissiveIntensity: 2.4 },
    // Plants.
    { id: 'frangipani-bark', name: 'Frangipani bark', category: 'wood', color: '#8a8275', roughness: 0.9, pattern: { id: 'leather', scale: 0.25, contrast: 0.5 } },
    { id: 'frangipani-flower', name: 'Frangipani petals', color: '#fbf0d2', roughness: 0.6 },
    { id: 'marigold', name: 'Marigold', category: 'fabric', color: '#f29a1c', roughness: 0.85, pattern: { id: 'boucle', scale: 0.05, contrast: 0.7 } },
  ],
});

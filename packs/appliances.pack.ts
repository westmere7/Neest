/**
 * Appliances — detailed, brand-neutral household appliances.
 *
 * Big fridges and freezers (side-by-side with an ice and water dispenser, a pastel retro fridge,
 * a mini fridge, an under-counter fridge and a chest freezer), a dishwasher drawer and a trio of
 * pedal bins, a shelf of countertop helpers (air fryer, blender, food processor, juicer, slow and
 * pressure cookers, bread maker, waffle maker, sandwich press, sparkling water maker, coffee
 * grinder, drip coffee maker, toaster oven, filter jug) and the cleaning and climate kit (upright
 * vacuum, steam mop, garment steamer, dehumidifier, ceramic heater, tower fan, wall hair dryer).
 *
 * Every item has its displays, buttons, knobs, vents, cords and transparent jars modelled. Three
 * pack patterns give the materials their surface: satin brushed stainless, orange-peel textured
 * plastic and a staggered perforated grille.
 */
import {
  barPull,
  cells,
  clamp,
  cyl,
  defineItem,
  definePack,
  discZ,
  frame4,
  lathe,
  legs4,
  line,
  matSlot,
  range,
  rectPoly,
  ring,
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
  circle,
  type Part,
  type V2,
  type V3,
} from '@/packs/kit';

// ---------------------------------------------------------------------------
// Shared geometry helpers
// ---------------------------------------------------------------------------

/** Detail parts: hidden from the 2D plan. */
const o = { plan: false };

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

/**
 * Swing parts (built closed) open about a hinge line parallel to X at (py, pz). A positive angle
 * lifts their front (+z) ends upwards, like a waffle-maker lid. Exact for parts whose own
 * rotation is about X only (Euler XYZ: a world X rotation simply adds to the X angle).
 */
function hingeX(parts: Part[], py: number, pz: number, a: number): Part[] {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return parts.map((p) => {
    const [x, y, z] = p.position;
    const dy = y - py;
    const dz = z - pz;
    const r = p.rotation ?? [0, 0, 0];
    return { ...p, position: [x, py + dy * c + dz * s, pz - dy * s + dz * c] as V3, rotation: [r[0] - a, r[1], r[2]] as V3 };
  });
}

/**
 * A panel tilted back by `tilt` (radians) about X and centred at `c`. Returns a mapper from
 * panel coordinates (u across, v up the slope, n out of the face) to object space, plus a
 * box builder that keeps parts flush with the slope.
 */
function slope(c: V3, tilt: number) {
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  const at = (u: number, v: number, n: number): V3 => [c[0] + u, c[1] + n * ct + v * st, c[2] + n * st - v * ct];
  const panel = (slot: string, u: number, v: number, n: number, size: V3, bevel = 0): Part => ({
    ...span(slot, [-size[0] / 2, size[0] / 2], [-size[1] / 2, size[1] / 2], [-size[2] / 2, size[2] / 2], { bevel, plan: false }),
    position: at(u, v, n),
    rotation: [tilt, 0, 0],
  });
  return { at, panel };
}

/** Four round feet of radius `r` from the floor up to `y1`, inset from a w×d footprint. */
function feet4(slot: string, w: number, d: number, inset: number, r: number, y1: number): Part[] {
  const out: Part[] = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) out.push(vcyl(slot, sx * (w / 2 - inset), sz * (d / 2 - inset), 0, y1, r, o));
  return out;
}

/** Cylinder whose axis runs along X (wheels, barrels, rollers), centred at `c`. */
function cylX(slot: string, c: V3, r: number, len: number, rTop?: number): Part {
  return cyl(slot, c, r, len, { rTop, rotation: [0, 0, Math.PI / 2], plan: false });
}

/** Front-facing dial: a knob disc with a raised pointer ridge, face at depth z. */
function dial(slot: string, ridge: string, x: number, y: number, z: number, r: number, turn = 0.6): Part[] {
  const depth = Math.min(0.02, r * 0.8);
  return [
    discZ(slot, [x, y, z + depth / 2], r, depth, { segments: 24, plan: false }),
    discZ(slot, [x, y, z + depth + 0.002], r * 0.82, 0.004, { segments: 24, plan: false }),
    { ...span(ridge, [-r * 0.12, r * 0.12], [0, r * 0.75], [0, 0.003]), position: [x, y, z + depth + 0.004], rotation: [0, 0, turn], plan: false },
  ];
}

/** Small rectangular buttons in a row across [x0, x1] at height y, faces at depth z. */
function buttonRow(slot: string, n: number, x0: number, x1: number, y: number, z: number, bw: number, bh: number): Part[] {
  return cells(n, x0, x1).map((x) => span(slot, [x - bw / 2, x + bw / 2], [y - bh / 2, y + bh / 2], [z, z + 0.003], { bevel: 0.0012, plan: false }));
}

/** Hollow vessel (jar, carafe, jug) by revolving an outer then inner wall. `pts` are outer [r, y]. */
function vessel(slot: string, base: V3, pts: V2[], wall: number, floor: number, opts?: { segments?: number; scale?: V3 }): Part {
  const inner = pts
    .slice()
    .reverse()
    .map(([r, y]) => [Math.max(0, r - wall), Math.max(floor, y)] as V2);
  const profile: V2[] = [[0, 0], ...pts, ...inner, [0, floor]];
  return lathe(slot, base, profile, { segments: opts?.segments ?? 28, scale: opts?.scale, plan: false });
}

// ---------------------------------------------------------------------------
// Refrigeration
// ---------------------------------------------------------------------------

const sideBySideFridge = defineItem({
  id: 'fridge-side-by-side',
  name: 'Side-by-side fridge',
  category: 'kitchen',
  type: 'appliances',
  group: 'Refrigeration',
  tags: ['fridge', 'refrigerator', 'side by side', 'american fridge', 'freezer', 'ice dispenser', 'water dispenser'],
  defaultSize: { w: 0.91, d: 0.72, h: 1.78 },
  minSize: { w: 0.8, d: 0.62, h: 1.7 },
  maxSize: { w: 0.96, d: 0.8, h: 1.85 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Doors & cabinet', 'satin-stainless'),
    matSlot('trim', 'Gaskets & dispenser', 'textured-black'),
    matSlot('handles', 'Handles & chrome', 'metal-chrome'),
    matSlot('display', 'Dispenser display', 'led-blue'),
  ],
  build: ({ w, d, h }) => {
    const plinth = 0.1;
    const zf = d / 2 - 0.085;
    const zd = zf + 0.045;
    const split = -w / 2 + w * 0.42;
    const top = h - 0.004;
    const parts: Part[] = [
      span('body', [-w / 2, w / 2], [0.012, h], [-d / 2, zf], { bevel: 0.01 }),
      // Recessed kick plinth with a slotted grille.
      span('trim', [-w / 2 + 0.015, w / 2 - 0.015], [0.012, plinth - 0.006], [zf - 0.03, zf + 0.006], o),
      ...slats('body', [-w / 2 + 0.03, w / 2 - 0.03], [0.03, plinth - 0.025], [zf + 0.006, zf + 0.01], Math.round((w - 0.06) / 0.022), {
        axis: 'x',
        gap: 0.55,
        plan: false,
      }),
      ...feet4('trim', w, d, 0.06, 0.018, 0.014),
      // Freezer (left) and fridge (right) doors with a dark gasket between.
      span('body', [-w / 2, split - 0.002], [plinth, top], [zf, zd], { bevel: 0.008 }),
      span('body', [split + 0.002, w / 2], [plinth, top], [zf, zd], { bevel: 0.008 }),
      span('trim', [split - 0.004, split + 0.004], [plinth, top], [zf - 0.01, zd - 0.006], o),
      span('trim', [-w / 2 + 0.004, w / 2 - 0.004], [plinth - 0.006, plinth], [zf - 0.01, zd - 0.004], o),
      // Top hinge covers.
      span('trim', [-w / 2 + 0.02, -w / 2 + 0.09], [h - 0.02, h], [zf - 0.05, zf + 0.004], { bevel: 0.004, plan: false }),
      span('trim', [w / 2 - 0.09, w / 2 - 0.02], [h - 0.02, h], [zf - 0.05, zf + 0.004], { bevel: 0.004, plan: false }),
      // Badge strip on the fridge door.
      span('handles', [(split + w / 2) / 2 - 0.04, (split + w / 2) / 2 + 0.04], [h - 0.09, h - 0.082], [zd, zd + 0.002], o),
    ];
    // Long vertical bar handles either side of the split.
    const hy = plinth + (top - plinth) * 0.52;
    const hl = Math.min(1.0, (top - plinth) * 0.62);
    parts.push(...barPull('handles', [split - 0.045, hy, zd], hl, { vertical: true, r: 0.011, stand: 0.03 }));
    parts.push(...barPull('handles', [split + 0.045, hy, zd], hl, { vertical: true, r: 0.011, stand: 0.03 }));
    // Ice and water dispenser in the freezer door.
    const cx = (-w / 2 + split) / 2 - 0.02;
    const dw = Math.min(0.22, (split + w / 2) * 0.58);
    const dy0 = h * 0.5;
    const dy1 = dy0 + Math.min(0.34, h * 0.19);
    parts.push(
      span('handles', [cx - dw / 2 - 0.014, cx + dw / 2 + 0.014], [dy0 - 0.014, dy1 + 0.07], [zd, zd + 0.003], { bevel: 0.006, plan: false }),
      span('trim', [cx - dw / 2, cx + dw / 2], [dy0, dy1], [zd + 0.003, zd + 0.005], { bevel: 0.01, plan: false }),
      span('display', [cx - dw / 2, cx + dw / 2], [dy1 + 0.012, dy1 + 0.058], [zd + 0.003, zd + 0.006], { bevel: 0.004, plan: false }),
      ...buttonRow('trim', 4, cx - dw / 2 + 0.01, cx + dw / 2 - 0.01, dy1 + 0.022, zd + 0.006, 0.026, 0.01),
      span('trim', [cx - 0.03, cx + 0.03], [dy1 - 0.07, dy1 - 0.005], [zd + 0.005, zd + 0.03], { bevel: 0.008, plan: false }),
      vcyl('handles', cx + 0.045, zd + 0.02, dy1 - 0.05, dy1 - 0.005, 0.006, o),
      span('handles', [cx - 0.035, cx + 0.035], [dy0 + 0.06, dy1 - 0.09], [zd + 0.008, zd + 0.016], { bevel: 0.004, rotation: [0.15, 0, 0], plan: false }),
      span('handles', [cx - dw / 2 + 0.008, cx + dw / 2 - 0.008], [dy0, dy0 + 0.014], [zd + 0.005, zd + 0.035], { bevel: 0.004, plan: false }),
      ...slats('trim', [cx - dw / 2 + 0.012, cx + dw / 2 - 0.012], [dy0 + 0.014, dy0 + 0.017], [zd + 0.008, zd + 0.032], 9, { axis: 'x', gap: 0.5, plan: false }),
    );
    return parts;
  },
  planDetail: ({ w, d }) => {
    const zf = d / 2 - 0.085;
    const split = -w / 2 + w * 0.42;
    return [line([-w / 2, zf], [w / 2, zf]), line([split, zf], [split, zf + 0.045])];
  },
});

const retroFridge = defineItem({
  id: 'fridge-retro',
  name: 'Retro fridge',
  category: 'kitchen',
  type: 'appliances',
  group: 'Refrigeration',
  tags: ['fridge', 'refrigerator', 'retro', '50s', 'pastel', 'mint', 'vintage', 'rounded'],
  defaultSize: { w: 0.6, d: 0.66, h: 1.52 },
  minSize: { w: 0.55, d: 0.6, h: 1.3 },
  maxSize: { w: 0.7, d: 0.74, h: 1.8 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Enamel body', 'enamel-mint'),
    matSlot('chrome', 'Chrome handles & legs', 'metal-chrome'),
    matSlot('seal', 'Door seals', 'rubber-black'),
  ],
  build: ({ w, d, h }) => {
    const legH = 0.07;
    const zd = d / 2 - 0.045;
    const zf = zd - 0.06;
    const yS = h - (h - legH) * 0.27;
    const hx = -w / 2 + 0.065;
    const parts: Part[] = [
      span('body', [-w / 2, w / 2], [legH, h], [-d / 2, zf + 0.02], { bevel: 0.07 }),
      // Plump rounded doors: main below, freezer compartment above.
      span('body', [-w / 2 + 0.004, w / 2 - 0.004], [legH + 0.012, yS - 0.005], [zf, zd], { bevel: 0.027 }),
      span('body', [-w / 2 + 0.004, w / 2 - 0.004], [yS + 0.005, h - 0.008], [zf, zd], { bevel: 0.027 }),
      span('seal', [-w / 2 + 0.03, w / 2 - 0.03], [yS - 0.007, yS + 0.007], [zf - 0.004, zd - 0.012], o),
      span('seal', [-w / 2 + 0.03, w / 2 - 0.03], [legH + 0.004, legH + 0.014], [zf - 0.004, zd - 0.012], o),
      ...legs4('chrome', w, d, 0.04, 0, legH + 0.01, 0.045, { round: true, taper: 0.55 }),
      span('chrome', [-w / 2 + 0.05, w / 2 - 0.05], [legH - 0.018, legH], [zf - 0.01, zf + 0.02], { bevel: 0.006, plan: false }),
      // Oval chrome badge.
      sphere('chrome', [0, yS - 0.09, zd], 1, { scale: [0.07, 0.018, 0.006], plan: false }),
      span('chrome', [-0.09, 0.09], [yS - 0.0915, yS - 0.0885], [zd - 0.002, zd + 0.001], o),
    ];
    // Chunky chrome lever handles on the opening side.
    const handle = (y0: number, y1: number): Part[] => [
      ...rodPath('chrome', [[hx, y0, zd - 0.004], [hx, y0 + 0.015, zd + 0.03], [hx, y1 - 0.015, zd + 0.03], [hx, y1, zd - 0.004]], 0.011),
      span('chrome', [hx - 0.018, hx + 0.018], [y1 - 0.02, y1 + 0.012], [zd - 0.004, zd + 0.006], { bevel: 0.006, plan: false }),
      span('chrome', [hx - 0.018, hx + 0.018], [y0 - 0.012, y0 + 0.02], [zd - 0.004, zd + 0.006], { bevel: 0.006, plan: false }),
    ];
    parts.push(...handle(yS - 0.07 - Math.min(0.4, (yS - legH) * 0.4), yS - 0.07));
    parts.push(...handle(yS + 0.05, yS + 0.05 + Math.min(0.18, (h - yS) * 0.5)));
    // Hinge knuckles on the right.
    for (const y of [legH + 0.035, yS - 0.03, yS + 0.03, h - 0.04]) {
      parts.push(vcyl('chrome', w / 2 - 0.02, zd - 0.01, y - 0.014, y + 0.014, 0.01, o));
    }
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w / 2, d / 2 - 0.105], [w / 2, d / 2 - 0.105])],
});

const miniFridge = defineItem({
  id: 'mini-fridge',
  name: 'Mini fridge',
  category: 'kitchen',
  type: 'appliances',
  group: 'Refrigeration',
  tags: ['fridge', 'mini fridge', 'bar fridge', 'dorm', 'compact', 'drinks', 'refrigerator'],
  defaultSize: { w: 0.48, d: 0.5, h: 0.85 },
  minSize: { w: 0.4, d: 0.42, h: 0.5 },
  maxSize: { w: 0.56, d: 0.6, h: 0.9 },
  slots: [
    matSlot('body', 'Cabinet', 'textured-black'),
    matSlot('door', 'Door', 'satin-stainless'),
    matSlot('trim', 'Seal, grille & coils', 'textured-grey'),
  ],
  build: ({ w, d, h }) => {
    const footH = 0.02;
    const zf = d / 2 - 0.04;
    const mid = footH + (h - footH) * 0.6;
    const parts: Part[] = [
      span('body', [-w / 2, w / 2], [footH, h], [-d / 2 + 0.025, zf], { bevel: 0.012 }),
      span('door', [-w / 2 + 0.003, w / 2 - 0.003], [footH + 0.052, h - 0.006], [zf, d / 2 - 0.002], { bevel: 0.01 }),
      span('trim', [-w / 2 + 0.006, w / 2 - 0.006], [footH + 0.048, h - 0.003], [zf - 0.004, zf + 0.004], o),
      // Front vent strip under the door.
      span('trim', [-w / 2 + 0.015, w / 2 - 0.015], [footH + 0.006, footH + 0.044], [zf - 0.006, zf + 0.004], { bevel: 0.004, plan: false }),
      ...slats('body', [-w / 2 + 0.03, w / 2 - 0.03], [footH + 0.012, footH + 0.038], [zf + 0.004, zf + 0.008], Math.round((w - 0.06) / 0.018), {
        axis: 'x',
        gap: 0.5,
        plan: false,
      }),
      // Recessed pull handle and hinges.
      span('trim', [w / 2 - 0.034, w / 2 - 0.016], [mid - 0.12, mid + 0.12], [d / 2 - 0.004, d / 2 + 0.001], { bevel: 0.004, plan: false }),
      span('trim', [-w / 2 + 0.004, -w / 2 + 0.03], [h - 0.014, h], [zf - 0.02, zf + 0.012], o),
      span('trim', [-w / 2 + 0.004, -w / 2 + 0.03], [footH + 0.04, footH + 0.054], [zf - 0.02, zf + 0.012], o),
      // Badge.
      span('trim', [-w / 2 + 0.04, -w / 2 + 0.11], [h - 0.062, h - 0.05], [d / 2 - 0.003, d / 2], o),
      ...feet4('trim', w, d, 0.04, 0.016, footH + 0.002),
      // Compressor hump and condenser coil on the back.
      span('trim', [-w * 0.3, w * 0.3], [footH, footH + 0.16], [-d / 2 + 0.008, -d / 2 + 0.03], { bevel: 0.02, plan: false }),
    ];
    const coilTop = h - 0.05;
    const coilBottom = footH + 0.2;
    for (const x of spaced(Math.max(4, Math.round((w - 0.1) / 0.04)), -w / 2 + 0.06, w / 2 - 0.06)) {
      parts.push(vcyl('trim', x, -d / 2 + 0.012, coilBottom, coilTop, 0.003, o));
    }
    parts.push(rodX('trim', -w / 2 + 0.05, w / 2 - 0.05, coilBottom + 0.01, -d / 2 + 0.006, 0.004, o));
    parts.push(rodX('trim', -w / 2 + 0.05, w / 2 - 0.05, coilTop - 0.01, -d / 2 + 0.006, 0.004, o));
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w / 2, d / 2 - 0.04], [w / 2, d / 2 - 0.04])],
});

const chestFreezer = defineItem({
  id: 'chest-freezer',
  name: 'Chest freezer',
  category: 'laundry',
  type: 'appliances',
  group: 'Refrigeration',
  tags: ['freezer', 'chest freezer', 'deep freeze', 'storage', 'garage', 'utility'],
  defaultSize: { w: 1.0, d: 0.7, h: 0.85 },
  minSize: { w: 0.6, d: 0.55, h: 0.8 },
  maxSize: { w: 1.6, d: 0.8, h: 0.9 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Enamel body & lid', 'enamel-white'),
    matSlot('trim', 'Lid trim, plinth & panel', 'textured-grey'),
    matSlot('leds', 'Indicator lights', 'led-blue'),
  ],
  build: ({ w, d, h }) => {
    const zf = d / 2 - 0.012;
    const lidY = h - 0.072;
    const hw = Math.min(0.14, w * 0.15);
    const parts: Part[] = [
      span('body', [-w / 2 + 0.006, w / 2 - 0.006], [0.03, lidY - 0.006], [-d / 2 + 0.025, zf], { bevel: 0.02 }),
      span('trim', [-w / 2 + 0.012, w / 2 - 0.012], [lidY - 0.008, lidY + 0.002], [-d / 2 + 0.03, zf - 0.004], o),
      span('body', [-w / 2, w / 2], [lidY, h], [-d / 2 + 0.02, d / 2], { bevel: 0.02 }),
      // Lid lip and handle with a lock.
      span('trim', [-w / 2 + 0.005, w / 2 - 0.005], [lidY, lidY + 0.012], [d / 2 - 0.012, d / 2], { bevel: 0.004, plan: false }),
      span('trim', [-hw, hw], [lidY - 0.016, lidY + 0.004], [d / 2 - 0.03, d / 2], { bevel: 0.006, plan: false }),
      discZ('trim', [hw + 0.03, lidY + 0.03, d / 2 + 0.003], 0.009, 0.006, o),
      // Plinth and bumpers.
      span('trim', [-w / 2 + 0.02, w / 2 - 0.02], [0, 0.032], [-d / 2 + 0.04, zf - 0.015], o),
      ...feet4('trim', w, d, 0.05, 0.02, 0.03),
      // Control panel: thermostat dial and indicator LEDs.
      span('trim', [w / 2 - 0.17, w / 2 - 0.04], [lidY - 0.085, lidY - 0.03], [zf - 0.002, zf + 0.002], { bevel: 0.004, plan: false }),
      ...dial('trim', 'body', w / 2 - 0.07, lidY - 0.058, zf + 0.002, 0.016),
      // Drain plug.
      discZ('trim', [-w / 2 + 0.08, 0.07, zf + 0.004], 0.015, 0.008, o),
      // Side vent and rear hinges.
      ...slats('trim', [w / 2 - 0.007, w / 2], [0.08, 0.28], [-d / 2 + 0.08, -d / 2 + 0.3], 8, { axis: 'y', gap: 0.5, plan: false }),
      span('trim', [-w * 0.3 - 0.04, -w * 0.3 + 0.04], [lidY - 0.04, lidY + 0.03], [-d / 2, -d / 2 + 0.03], { bevel: 0.006, plan: false }),
      span('trim', [w * 0.3 - 0.04, w * 0.3 + 0.04], [lidY - 0.04, lidY + 0.03], [-d / 2, -d / 2 + 0.03], { bevel: 0.006, plan: false }),
    ];
    for (const x of cells(3, w / 2 - 0.165, w / 2 - 0.1)) parts.push(sphere('leds', [x, lidY - 0.058, zf + 0.002], 0.0045, o));
    return parts;
  },
  planDetail: ({ w, d }) => [rectPoly(-w / 2 + 0.03, -d / 2 + 0.05, w / 2 - 0.03, d / 2 - 0.03)],
});

const undercounterFridge = defineItem({
  id: 'undercounter-fridge',
  name: 'Under-counter fridge',
  category: 'kitchen',
  type: 'appliances',
  group: 'Refrigeration',
  tags: ['fridge', 'under counter', 'larder fridge', 'refrigerator', 'compact', 'built under'],
  defaultSize: { w: 0.6, d: 0.58, h: 0.82 },
  minSize: { w: 0.5, d: 0.55, h: 0.8 },
  maxSize: { w: 0.65, d: 0.62, h: 0.88 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Cabinet', 'textured-white'),
    matSlot('door', 'Door', 'satin-stainless'),
    matSlot('grille', 'Kick grille & seal', 'grille-black'),
    matSlot('handle', 'Handle & feet', 'metal-chrome'),
  ],
  build: ({ w, d, h }) => {
    const zd = d / 2 - 0.035;
    const zf = zd - 0.04;
    const parts: Part[] = [
      span('body', [-w / 2, w / 2], [0.085, h], [-d / 2, zf], { bevel: 0.008 }),
      span('body', [-w / 2 + 0.01, w / 2 - 0.01], [0.02, 0.085], [-d / 2 + 0.02, zf - 0.04]),
      span('grille', [-w / 2 + 0.008, w / 2 - 0.008], [0.022, 0.082], [zf - 0.04, zf - 0.03], o),
      ...legs4('handle', w, d, 0.03, 0, 0.024, 0.024, { round: true }),
      span('door', [-w / 2 + 0.003, w / 2 - 0.003], [0.09, h - 0.004], [zf, zd], { bevel: 0.006 }),
      span('grille', [-w / 2 + 0.008, w / 2 - 0.008], [0.086, h - 0.002], [zf - 0.004, zf + 0.002], o),
      // Fine groove under the top edge and a small badge.
      span('grille', [-w / 2 + 0.03, w / 2 - 0.03], [h - 0.112, h - 0.108], [zd - 0.001, zd + 0.001], o),
      span('handle', [-0.03, 0.03], [0.13, 0.138], [zd, zd + 0.002], o),
      ...barPull('handle', [0, h - 0.06, zd], Math.min(w * 0.75, 0.46), { r: 0.009, stand: 0.025 }),
    ];
    // Hinge pins on the right edge.
    for (const y of [0.1, h - 0.014]) parts.push(vcyl('handle', w / 2 - 0.012, zd - 0.01, y - 0.01, y + 0.01, 0.006, o));
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w / 2, d / 2 - 0.075], [w / 2, d / 2 - 0.075])],
});

// ---------------------------------------------------------------------------
// Countertop appliances
// ---------------------------------------------------------------------------

const airFryer = defineItem({
  id: 'air-fryer',
  name: 'Air fryer',
  category: 'kitchen',
  type: 'appliances',
  group: 'Small appliances',
  tags: ['air fryer', 'fryer', 'countertop', 'cooking', 'basket', 'digital'],
  defaultSize: { w: 0.3, d: 0.36, h: 0.33 },
  minSize: { w: 0.24, d: 0.3, h: 0.28 },
  maxSize: { w: 0.38, d: 0.42, h: 0.4 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Body & basket', 'textured-black'),
    matSlot('window', 'Basket window', 'smoked-window'),
    matSlot('display', 'Touch display', 'led-blue'),
    matSlot('accent', 'Trim & vents', 'satin-stainless'),
  ],
  build: ({ w, d, h }) => {
    const zf = d / 2 - 0.045;
    const drawerTop = h * 0.56;
    const tilt = 0.45;
    const panelC: V3 = [0, h - 0.04, zf - 0.05];
    const p = slope(panelC, tilt);
    const pw = w * 0.62;
    const parts: Part[] = [
      span('body', [-w / 2, w / 2], [0.012, h - 0.03], [-d / 2 + 0.006, zf], { bevel: 0.045 }),
      span('body', [-w / 2 + 0.02, w / 2 - 0.02], [h - 0.07, h], [-d / 2 + 0.03, zf - 0.03], { bevel: 0.03 }),
      // Sloped control panel with display and touch keys.
      p.panel('accent', 0, 0, 0, [pw + 0.012, 0.01, 0.092], 0.004),
      p.panel('body', 0, 0, 0.005, [pw, 0.004, 0.082], 0.002),
      p.panel('display', 0, 0.006, 0.0075, [w * 0.2, 0.002, 0.034]),
      // Pull-out basket with a viewing window and a grip handle.
      span('body', [-w / 2 + 0.022, w / 2 - 0.022], [0.03, drawerTop], [zf - 0.01, zf + 0.012], { bevel: 0.01, plan: false }),
      span('accent', [-w / 2 + 0.024, w / 2 - 0.024], [drawerTop - 0.004, drawerTop + 0.002], [zf - 0.012, zf + 0.008], o),
      span('window', [-w * 0.24, w * 0.24], [drawerTop - 0.09, drawerTop - 0.025], [zf + 0.012, zf + 0.015], { bevel: 0.004, plan: false }),
      ...frame4('accent', [-w * 0.24 - 0.006, w * 0.24 + 0.006], [drawerTop - 0.096, drawerTop - 0.019], [zf + 0.012, zf + 0.016], 0.006),
      span('body', [-0.045, 0.045], [0.07, 0.11], [zf + 0.012, d / 2 - 0.004], { bevel: 0.012, plan: false }),
      span('accent', [-0.015, 0.015], [0.108, 0.114], [zf + 0.03, zf + 0.04], { bevel: 0.002, plan: false }),
      ...feet4('body', w, d, 0.04, 0.012, 0.014),
    ];
    for (const side of [-1, 1]) {
      for (const v of [-0.018, 0.018]) parts.push(p.panel('accent', side * (w * 0.2), v, 0.0075, [0.014, 0.003, 0.012], 0.002));
    }
    // Rear exhaust slots and the power cord running out of the back.
    parts.push(...slats('accent', [-w * 0.28, w * 0.28], [h * 0.5, h * 0.82], [-d / 2, -d / 2 + 0.006], 7, { axis: 'y', gap: 0.55, plan: false }));
    parts.push(...rodPath('body', [[w * 0.25, 0.05, -d / 2 + 0.006], [w * 0.25, 0.006, -d / 2 + 0.005], [w / 2 - 0.008, 0.006, -d / 2 + 0.005]], 0.004));
    return parts;
  },
});

const blender = defineItem({
  id: 'blender',
  name: 'Blender',
  category: 'kitchen',
  type: 'appliances',
  group: 'Small appliances',
  tags: ['blender', 'smoothie', 'jug', 'countertop', 'mixer', 'liquidiser'],
  defaultSize: { w: 0.2, d: 0.22, h: 0.45 },
  minSize: { w: 0.16, d: 0.18, h: 0.38 },
  maxSize: { w: 0.26, d: 0.28, h: 0.55 },
  wallSnap: true,
  slots: [
    matSlot('base', 'Motor base', 'satin-stainless'),
    matSlot('jar', 'Jar', 'clear-tritan'),
    matSlot('trim', 'Lid, handle & dial', 'textured-black'),
    matSlot('blades', 'Blades & ring', 'metal-chrome'),
  ],
  build: ({ w, d, h }) => {
    const bh = h * 0.28;
    const jr = Math.min(w * 0.36, d * 0.42);
    const jx = -w * 0.08;
    const jy = bh + 0.024;
    const lidY = h - 0.03;
    const jh = lidY - jy;
    const kr = Math.min(0.026, bh * 0.22);
    const parts: Part[] = [
      span('base', [-w / 2 + 0.006, w / 2 - 0.006], [0.01, bh], [-d / 2 + 0.02, d / 2 - 0.02], { bevel: 0.02 }),
      span('trim', [-w / 2 + 0.012, w / 2 - 0.012], [0, 0.012], [-d / 2 + 0.026, d / 2 - 0.026], { bevel: 0.004 }),
      // Control face: dial with chrome ring and two buttons.
      span('trim', [-w * 0.36, w * 0.36], [bh * 0.2, bh * 0.85], [d / 2 - 0.022, d / 2 - 0.016], { bevel: 0.006, plan: false }),
      ...dial('trim', 'blades', 0, bh * 0.52, d / 2 - 0.016, kr),
      torus('blades', [0, bh * 0.52, d / 2 - 0.015], kr + 0.004, 0.0018, o),
      span('blades', [-w * 0.3, -w * 0.3 + 0.016], [bh * 0.48, bh * 0.56], [d / 2 - 0.016, d / 2 - 0.012], { bevel: 0.002, plan: false }),
      span('blades', [w * 0.3 - 0.016, w * 0.3], [bh * 0.48, bh * 0.56], [d / 2 - 0.016, d / 2 - 0.012], { bevel: 0.002, plan: false }),
      // Coupling collar, octagonal jar and lid.
      cyl('trim', [jx, bh + 0.012, 0], jr * 0.88, 0.024, { segments: 8, plan: false }),
      vessel('jar', [jx, jy, 0], [[jr * 0.78, 0], [jr * 0.82, 0.012], [jr, jh * 0.9], [jr * 1.03, jh]], 0.004, 0.02, { segments: 8 }),
      cyl('trim', [jx, lidY + 0.009, 0], jr * 1.03, 0.018, { segments: 8, plan: false }),
      cyl('jar', [jx, h - 0.006, 0], jr * 0.32, 0.012, { segments: 16, plan: false }),
      cyl('blades', [jx, jy + 0.03, 0], 0.01, 0.02, o),
    ];
    // Four cross blades, alternately tipped up and down.
    for (const k of range(4)) {
      const a = (k * Math.PI) / 2 + 0.3;
      parts.push({
        ...span('blades', [0, jr * 0.62], [-0.001, 0.001], [-0.007, 0.007]),
        position: [jx + Math.cos(a) * jr * 0.31, jy + 0.038, -Math.sin(a) * jr * 0.31],
        rotation: [0, a, k % 2 ? 0.25 : -0.25],
        plan: false,
      });
    }
    // Measuring ticks on the jar.
    for (const y of cells(4, jy + jh * 0.25, jy + jh * 0.8)) {
      parts.push(span('trim', [jx - 0.012, jx + 0.012], [y - 0.001, y + 0.001], [jr * 0.95, jr * 0.95 + 0.002], o));
    }
    // Loop handle on the right.
    parts.push(
      ...rodPath('trim', [[jx + jr * 0.95, jy + 0.04, 0], [w / 2 - 0.016, jy + 0.06, 0], [w / 2 - 0.016, lidY - 0.06, 0], [jx + jr * 0.98, lidY - 0.02, 0]], 0.012),
    );
    return parts;
  },
});

const foodProcessor = defineItem({
  id: 'food-processor',
  name: 'Food processor',
  category: 'kitchen',
  type: 'appliances',
  group: 'Small appliances',
  tags: ['food processor', 'chopper', 'slicer', 'countertop', 'mixer', 'bowl'],
  defaultSize: { w: 0.26, d: 0.24, h: 0.42 },
  minSize: { w: 0.22, d: 0.2, h: 0.34 },
  maxSize: { w: 0.32, d: 0.3, h: 0.5 },
  wallSnap: true,
  slots: [
    matSlot('base', 'Motor base', 'textured-white'),
    matSlot('bowl', 'Bowl & lid', 'clear-tritan'),
    matSlot('trim', 'Pusher, handle & paddles', 'textured-grey'),
    matSlot('blade', 'Blades', 'metal-chrome'),
  ],
  build: ({ w, d, h }) => {
    const bh = h * 0.3;
    const br = Math.min(w * 0.36, d * 0.42);
    const bx = -w * 0.07;
    const bH = (h - bh) * 0.5;
    const lidY = bh + bH;
    const cr = br * 0.34;
    const cz = -br * 0.32;
    const parts: Part[] = [
      span('base', [-w / 2, w / 2], [0.01, bh], [-d / 2, d / 2 - 0.02], { bevel: 0.025 }),
      ...feet4('trim', w, d - 0.02, 0.03, 0.012, 0.012),
      // Three paddle switches (on / off / pulse).
      ...cells(3, -w * 0.26, w * 0.26).map((x) =>
        span('trim', [x - 0.016, x + 0.016], [bh * 0.3, bh * 0.62], [d / 2 - 0.022, d / 2 - 0.006], { bevel: 0.005, plan: false }),
      ),
      // Bowl on its spindle with an S blade and a slicing disc.
      vessel('bowl', [bx, bh, 0], [[br * 0.9, 0], [br * 0.95, 0.01], [br, bH]], 0.004, 0.012, { segments: 32 }),
      vcyl('trim', bx, 0, bh, bh + bH * 0.85, 0.009, o),
      cyl('blade', [bx, bh + bH * 0.62, 0], br * 0.82, 0.003, { segments: 32, plan: false }),
      // Lid with feed tube and pusher.
      cyl('bowl', [bx, lidY + 0.006, 0], br * 1.02, 0.012, { segments: 32, plan: false }),
      vcyl('bowl', bx, cz, lidY + 0.012, h - 0.03, cr, { segments: 20, scale: [1, 1, 0.7], plan: false }),
      vcyl('trim', bx, cz, h - 0.09, h - 0.012, cr * 0.85, { segments: 20, scale: [1, 1, 0.7], plan: false }),
      cyl('trim', [bx, h - 0.007, cz], cr * 1.15, 0.014, { segments: 20, scale: [1, 1, 0.75], plan: false }),
      // Bowl handle.
      span('trim', [bx + br * 0.92, bx + br + 0.03], [bh + bH * 0.15, bh + bH * 0.9], [-0.014, 0.014], { bevel: 0.008, plan: false }),
    ];
    for (const k of range(2)) {
      const a = k * Math.PI + 0.4;
      parts.push({
        ...span('blade', [0, br * 0.7], [-0.001, 0.001], [-0.01, 0.01]),
        position: [bx + Math.cos(a) * br * 0.35, bh + bH * 0.2 + k * 0.012, -Math.sin(a) * br * 0.35],
        rotation: [0, a, 0],
        plan: false,
      });
    }
    return parts;
  },
});

const juicer = defineItem({
  id: 'juicer',
  name: 'Juicer',
  category: 'kitchen',
  type: 'appliances',
  group: 'Small appliances',
  tags: ['juicer', 'juice', 'centrifugal', 'fruit', 'countertop', 'jug'],
  defaultSize: { w: 0.26, d: 0.4, h: 0.44 },
  minSize: { w: 0.22, d: 0.34, h: 0.38 },
  maxSize: { w: 0.32, d: 0.46, h: 0.52 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Body & clamps', 'satin-stainless'),
    matSlot('clear', 'Cover, chute & jug', 'clear-tritan'),
    matSlot('trim', 'Pulp bin, pusher & dial', 'textured-black'),
    matSlot('juice', 'Juice', 'orange-juice'),
  ],
  build: ({ w, d, h }) => {
    const bh = h * 0.4;
    const zb0 = -d / 2 + d * 0.2;
    const zb1 = zb0 + d * 0.45;
    const zc = (zb0 + zb1) / 2;
    const rc = Math.min(w / 2 - 0.02, (zb1 - zb0) / 2);
    const ch = (h - bh) * 0.38;
    const jr = Math.min((d / 2 - zb1) / 2 - 0.006, w * 0.3);
    const jz = d / 2 - jr - 0.004;
    const jh = bh - 0.03;
    const parts: Part[] = [
      span('body', [-w / 2 + 0.01, w / 2 - 0.01], [0.01, bh], [zb0, zb1], { bevel: 0.03 }),
      ...feet4('trim', w - 0.02, zb1 - zb0, 0.03, 0.012, 0.012).map((p) => ({ ...p, position: [p.position[0], p.position[1], p.position[2] + zc] as V3 })),
      ...dial('trim', 'body', 0, bh * 0.5, zb1 - 0.004, 0.026),
      // Pulp bin behind.
      span('trim', [-w / 2 + 0.02, w / 2 - 0.02], [0.01, bh + ch * 0.6], [-d / 2, zb0 + 0.02], { bevel: 0.02 }),
      // Clear domed cover over the stainless filter basket.
      lathe('clear', [0, bh, zc], [[0, 0], [rc, 0], [rc, ch * 0.5], [rc * 0.6, ch], [0, ch]], { segments: 32, plan: false }),
      lathe('body', [0, bh + 0.005, zc], [[0, 0], [rc * 0.55, 0], [rc * 0.85, ch * 0.4], [0, ch * 0.4]], { segments: 28, plan: false }),
      // Wide feed chute and pusher.
      vcyl('clear', 0, zc, bh + ch * 0.8, h - 0.04, rc * 0.42, { segments: 24, plan: false }),
      vcyl('trim', 0, zc, h - 0.1, h - 0.012, rc * 0.38, { segments: 24, plan: false }),
      cyl('trim', [0, h - 0.007, zc], rc * 0.5, 0.014, { segments: 24, plan: false }),
      // Spout over the jug.
      rod('body', [0, bh + 0.035, zc + rc * 0.9], [0, bh + 0.012, jz - jr * 0.4], 0.012, o),
      // Juice jug with a froth-separator lid and handle.
      vessel('clear', [0, 0, jz], [[jr * 0.95, 0], [jr, jh]], 0.003, 0.006, { segments: 28 }),
      lathe('juice', [0, 0.006, jz], [[0, 0], [jr * 0.92, 0], [jr * 0.95, jh * 0.55], [0, jh * 0.55]], { segments: 28, plan: false }),
      cyl('trim', [0, jh + 0.006, jz], jr * 1.02, 0.012, { segments: 28, plan: false }),
      ...rodPath('clear', [[jr * 0.9, jh * 0.85, jz], [jr + 0.03, jh * 0.8, jz], [jr + 0.03, jh * 0.25, jz], [jr * 0.9, jh * 0.2, jz]], 0.009),
    ];
    // Locking clamps over the cover.
    for (const s of [-1, 1]) {
      parts.push(...rodPath('body', [[s * (w / 2 - 0.016), bh - 0.03, zc], [s * (w / 2 - 0.016), bh + ch * 0.5, zc], [s * rc * 0.62, bh + ch * 0.85, zc]], 0.008));
    }
    return parts;
  },
});

const slowCooker = defineItem({
  id: 'slow-cooker',
  name: 'Slow cooker',
  category: 'kitchen',
  type: 'appliances',
  group: 'Cooking',
  tags: ['slow cooker', 'crock pot', 'stew', 'casserole', 'countertop'],
  defaultSize: { w: 0.4, d: 0.28, h: 0.28 },
  minSize: { w: 0.32, d: 0.22, h: 0.22 },
  maxSize: { w: 0.48, d: 0.34, h: 0.34 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Housing & lid rim', 'satin-stainless'),
    matSlot('crock', 'Stoneware crock', 'ceramic-black'),
    matSlot('lid', 'Glass lid', 'clear-tritan'),
    matSlot('trim', 'Handles, knob & dial', 'textured-black'),
  ],
  build: ({ w, d, h }) => {
    const R = w / 2 - 0.04;
    const zs = Math.min(1, (d / 2 - 0.02) / R);
    const zFront = R * zs;
    const bodyH = h * 0.6;
    const y0 = 0.012;
    const lidY = y0 + bodyH + 0.02;
    const lidH = h - lidY - 0.024;
    const sc: V3 = [1, 1, zs];
    const parts: Part[] = [
      cyl('trim', [0, 0.008, 0], R * 0.88, 0.016, { segments: 32, scale: sc }),
      lathe('body', [0, y0, 0], [[0, 0], [R * 0.9, 0], [R * 0.98, 0.02], [R, bodyH * 0.3], [R, bodyH], [R * 0.95, bodyH]], { segments: 40, scale: sc }),
      cyl('crock', [0, y0 + bodyH + 0.01, 0], R * 0.95, 0.02, { segments: 40, scale: sc, plan: false }),
      lathe('lid', [0, lidY, 0], [[R * 0.93, 0], [R * 0.93, 0.006], [R * 0.75, lidH * 0.6], [R * 0.3, lidH], [0, lidH], [0, 0]], { segments: 40, scale: sc, plan: false }),
      ring('body', [0, lidY + 0.003, 0], R * 0.92, 0.005, { zScale: zs, plan: false }),
      cyl('trim', [0, h - 0.014, 0], 0.024, 0.028, { rTop: 0.03, segments: 20, plan: false }),
      sphere('trim', [R * 0.5, lidY + lidH * 0.55, 0], 0.006, o),
      // Front control panel with a dial and an indicator.
      span('trim', [-0.06, 0.06], [y0 + bodyH * 0.22, y0 + bodyH * 0.68], [zFront - 0.02, zFront + 0.004], { bevel: 0.006, plan: false }),
      ...dial('body', 'trim', 0, y0 + bodyH * 0.43, zFront + 0.004, 0.02),
      sphere('crock', [0.042, y0 + bodyH * 0.6, zFront + 0.004], 0.004, o),
    ];
    // Side handles.
    for (const s of [-1, 1]) {
      parts.push(span('trim', s < 0 ? [-w / 2, -R + 0.01] : [R - 0.01, w / 2], [y0 + bodyH * 0.74, y0 + bodyH * 0.92], [-0.05 * zs, 0.05 * zs], { bevel: 0.008, plan: false }));
    }
    return parts;
  },
});

const pressureCooker = defineItem({
  id: 'pressure-cooker',
  name: 'Electric pressure cooker',
  category: 'kitchen',
  type: 'appliances',
  group: 'Cooking',
  tags: ['pressure cooker', 'multicooker', 'instant pot', 'rice', 'stew', 'countertop', 'digital'],
  defaultSize: { w: 0.33, d: 0.32, h: 0.32 },
  minSize: { w: 0.27, d: 0.26, h: 0.26 },
  maxSize: { w: 0.4, d: 0.38, h: 0.4 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Housing', 'satin-stainless'),
    matSlot('lid', 'Lid, base & panel', 'textured-black'),
    matSlot('display', 'Display', 'led-blue'),
    matSlot('buttons', 'Buttons & valve', 'textured-grey'),
  ],
  build: ({ w, d, h }) => {
    const R = Math.min(w / 2 - 0.035, d / 2 - 0.03);
    const bodyH = h * 0.66;
    const lidH = h - bodyH - 0.01 - 0.03;
    const topY = bodyH + 0.01 + lidH;
    const zp = R + 0.012;
    const parts: Part[] = [
      cyl('lid', [0, 0.0125, 0], R * 0.98, 0.025, { segments: 40 }),
      lathe('body', [0, 0.02, 0], [[0, 0], [R, 0], [R, bodyH - 0.03], [R * 0.97, bodyH - 0.02], [0, bodyH - 0.02]], { segments: 40 }),
      cyl('lid', [0, bodyH, 0], R * 1.01, 0.02, { segments: 40, plan: false }),
      lathe('lid', [0, bodyH + 0.01, 0], [[0, 0], [R * 1.02, 0], [R * 1.02, 0.015], [R * 0.85, lidH * 0.6], [R * 0.45, lidH], [0, lidH]], {
        segments: 40,
        plan: false,
      }),
      span('lid', [-R * 0.45, R * 0.45], [topY - 0.006, topY + 0.024], [-0.014, 0.014], { bevel: 0.008, plan: false }),
      // Steam release and float valves.
      vcyl('buttons', R * 0.38, -R * 0.42, bodyH + lidH * 0.6, bodyH + lidH * 0.6 + 0.035, 0.016, { segments: 16, plan: false }),
      span('buttons', [R * 0.38 - 0.004, R * 0.38 + 0.004], [bodyH + lidH * 0.6 + 0.02, bodyH + lidH * 0.6 + 0.042], [-R * 0.42 - 0.016, -R * 0.42 + 0.016], o),
      vcyl('body', -R * 0.3, -R * 0.45, bodyH + lidH * 0.6, bodyH + lidH * 0.6 + 0.012, 0.005, o),
      // Front panel: display above a button grid.
      span('lid', [-R * 0.62, R * 0.62], [bodyH * 0.18, bodyH * 0.86], [R - 0.03, zp], { bevel: 0.012, plan: false }),
      span('display', [-R * 0.24, R * 0.24], [bodyH * 0.6, bodyH * 0.78], [zp, zp + 0.003], { bevel: 0.002, plan: false }),
      // Condensation cup at the back.
      span('buttons', [-0.022, 0.022], [bodyH * 0.55, bodyH * 0.85], [-R - 0.022, -R + 0.01], { bevel: 0.008, plan: false }),
    ];
    for (const x of [-R * 0.45, R * 0.45]) parts.push(...cells(3, bodyH * 0.38, bodyH * 0.8).map((y) => span('buttons', [x - 0.014, x + 0.014], [y - 0.008, y + 0.008], [zp, zp + 0.004], { bevel: 0.002, plan: false })));
    parts.push(...buttonRow('buttons', 3, -R * 0.3, R * 0.3, bodyH * 0.38, zp, 0.03, 0.014));
    // Side handles.
    for (const s of [-1, 1]) {
      parts.push(span('lid', s < 0 ? [-w / 2, -R + 0.01] : [R - 0.01, w / 2], [bodyH - 0.06, bodyH - 0.025], [-0.045, 0.045], { bevel: 0.01, plan: false }));
    }
    return parts;
  },
});

const breadMaker = defineItem({
  id: 'bread-maker',
  name: 'Bread maker',
  category: 'kitchen',
  type: 'appliances',
  group: 'Cooking',
  tags: ['bread maker', 'bread machine', 'baking', 'loaf', 'dough', 'countertop'],
  defaultSize: { w: 0.28, d: 0.38, h: 0.32 },
  minSize: { w: 0.24, d: 0.32, h: 0.28 },
  maxSize: { w: 0.34, d: 0.45, h: 0.38 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Body & lid', 'textured-white'),
    matSlot('window', 'Viewing window', 'smoked-window'),
    matSlot('trim', 'Panel, vents & handle', 'textured-grey'),
    matSlot('display', 'Display', 'led-blue'),
  ],
  build: ({ w, d, h }) => {
    const zl1 = d / 2 - d * 0.3;
    const lowY = h * 0.66;
    const parts: Part[] = [
      span('body', [-w / 2, w / 2], [0.012, lowY], [-d / 2, d / 2], { bevel: 0.03 }),
      span('body', [-w / 2, w / 2], [lowY - 0.04, h - 0.014], [-d / 2, zl1], { bevel: 0.03 }),
      // Hinged lid with window, steam vents and a front lift handle.
      span('body', [-w / 2 + 0.01, w / 2 - 0.01], [h - 0.03, h - 0.002], [-d / 2 + 0.012, zl1 - 0.004], { bevel: 0.012 }),
      span('window', [-w * 0.28, w * 0.28], [h - 0.004, h], [-d / 2 + d * 0.22, zl1 - 0.03], { bevel: 0.0015, plan: false }),
      ...slats('trim', [-w * 0.26, w * 0.26], [h - 0.004, h], [-d / 2 + 0.03, -d / 2 + d * 0.16], 6, { axis: 'z', gap: 0.5, plan: false }),
      span('trim', [-0.045, 0.045], [h - 0.034, h - 0.008], [zl1 - 0.012, zl1 + 0.014], { bevel: 0.006, plan: false }),
      ...feet4('trim', w, d, 0.035, 0.012, 0.014),
      // Rear vents.
      ...slats('trim', [-w * 0.3, w * 0.3], [0.05, lowY - 0.06], [-d / 2 - 0.001, -d / 2 + 0.004], 6, { axis: 'y', gap: 0.55, plan: false }),
    ];
    // Sloped control panel bridging the low front and the lid block.
    const ya = h - 0.02;
    const za = zl1;
    const yb = lowY - 0.005;
    const zb = d / 2 - 0.012;
    const tilt = Math.atan2(ya - yb, zb - za);
    const len = Math.hypot(ya - yb, zb - za);
    const p = slope([0, (ya + yb) / 2, (za + zb) / 2], tilt);
    parts.push(
      p.panel('body', 0, 0, -0.012, [w, 0.03, len], 0.01),
      p.panel('trim', 0, 0, 0.004, [w * 0.82, 0.004, len * 0.82], 0.003),
      p.panel('display', 0, len * 0.18, 0.0065, [w * 0.34, 0.002, len * 0.24]),
    );
    for (const u of cells(4, -w * 0.32, w * 0.32)) parts.push(p.panel('body', u, -len * 0.2, 0.007, [0.022, 0.004, 0.014], 0.002));
    parts.push(p.panel('body', -w * 0.32, len * 0.18, 0.007, [0.02, 0.004, 0.02], 0.002), p.panel('body', w * 0.32, len * 0.18, 0.007, [0.02, 0.004, 0.02], 0.002));
    return parts;
  },
});

/** Waffle grid on a plate: walls in both directions over the x / z ranges, `t` high from y0. */
function waffleGrid(slot: string, x: V2, z: V2, y0: number, t: number, pitch: number): Part[] {
  const nx = Math.max(3, Math.round((x[1] - x[0]) / pitch));
  const nz = Math.max(3, Math.round((z[1] - z[0]) / pitch));
  return [
    ...spaced(nx + 1, x[0] + 0.002, x[1] - 0.002).map((xx) => span(slot, [xx - 0.002, xx + 0.002], [y0, y0 + t], z, o)),
    ...spaced(nz + 1, z[0] + 0.002, z[1] - 0.002).map((zz) => span(slot, x, [y0, y0 + t], [zz - 0.002, zz + 0.002], o)),
  ];
}

const waffleMaker = defineItem({
  id: 'waffle-maker',
  name: 'Waffle maker',
  category: 'kitchen',
  type: 'appliances',
  group: 'Cooking',
  tags: ['waffle', 'waffle iron', 'breakfast', 'belgian waffle', 'countertop'],
  defaultSize: { w: 0.3, d: 0.36, h: 0.36 },
  minSize: { w: 0.26, d: 0.3, h: 0.26 },
  maxSize: { w: 0.36, d: 0.44, h: 0.45 },
  wallSnap: true,
  slots: [
    matSlot('shell', 'Shell', 'satin-stainless'),
    matSlot('plates', 'Non-stick plates', 'non-stick'),
    matSlot('accents', 'Handle, hinge & feet', 'textured-black'),
    matSlot('leds', 'Ready lights', 'led-blue'),
  ],
  build: ({ w, d, h }) => {
    const baseH = 0.075;
    const pw = w - 0.05;
    const py = baseH + 0.012;
    const pz = -d / 2 + 0.055;
    const z0 = pz + 0.012;
    const z1 = d / 2 - 0.035;
    const L = z1 - z0;
    const lt = 0.045;
    const a = Math.min(1.2, Math.asin(clamp((h - py - 0.02) / (L + 0.045), 0.1, 0.98)));
    const parts: Part[] = [
      span('shell', [-w / 2, w / 2], [0.012, baseH], [-d / 2 + 0.02, d / 2 - 0.02], { bevel: 0.025 }),
      ...feet4('accents', w, d, 0.04, 0.012, 0.014),
      span('plates', [-pw / 2, pw / 2], [baseH - 0.004, baseH + 0.004], [z0, z1], o),
      ...waffleGrid('plates', [-pw / 2, pw / 2], [z0, z1], baseH + 0.004, 0.008, 0.028),
      span('accents', [-0.05, 0.05], [baseH * 0.35, baseH * 0.8], [d / 2 - 0.03, d / 2], { bevel: 0.01, plan: false }),
      sphere('leds', [-w / 2 + 0.05, baseH * 0.55, d / 2 - 0.022], 0.004, o),
      sphere('leds', [-w / 2 + 0.07, baseH * 0.55, d / 2 - 0.022], 0.004, o),
      // Hinge barrel and brackets.
      rodX('accents', -w / 2 + 0.04, w / 2 - 0.04, py, pz, 0.01, o),
      span('accents', [-w / 2 + 0.03, -w / 2 + 0.06], [baseH - 0.01, py + 0.008], [pz - 0.02, pz + 0.012], { bevel: 0.004, plan: false }),
      span('accents', [w / 2 - 0.06, w / 2 - 0.03], [baseH - 0.01, py + 0.008], [pz - 0.02, pz + 0.012], { bevel: 0.004, plan: false }),
    ];
    // The lid, built closed above the plate and swung open about the hinge.
    const lid: Part[] = [
      span('shell', [-w / 2 + 0.005, w / 2 - 0.005], [py + 0.002, py + lt], [z0 - 0.008, z1 + 0.01], { bevel: 0.02 }),
      span('plates', [-pw / 2, pw / 2], [py - 0.002, py + 0.004], [z0, z1], o),
      ...waffleGrid('plates', [-pw / 2, pw / 2], [z0, z1], py - 0.008, 0.006, 0.028),
      span('accents', [-0.05, 0.05], [py + 0.01, py + 0.036], [z1 + 0.01, z1 + 0.034], { bevel: 0.008, plan: false }),
    ];
    parts.push(...hingeX(lid, py, pz, a).map((p) => ({ ...p, plan: false })));
    return parts;
  },
});

const sandwichPress = defineItem({
  id: 'sandwich-press',
  name: 'Sandwich press',
  category: 'kitchen',
  type: 'appliances',
  group: 'Cooking',
  tags: ['sandwich press', 'panini', 'contact grill', 'toastie', 'grill', 'countertop'],
  defaultSize: { w: 0.36, d: 0.34, h: 0.16 },
  minSize: { w: 0.3, d: 0.28, h: 0.13 },
  maxSize: { w: 0.5, d: 0.42, h: 0.22 },
  wallSnap: true,
  slots: [
    matSlot('shell', 'Shell', 'satin-stainless'),
    matSlot('plates', 'Ribbed plates', 'non-stick'),
    matSlot('accents', 'Handle, skirt & feet', 'textured-black'),
    matSlot('leds', 'Ready lights', 'led-blue'),
  ],
  build: ({ w, d, h }) => {
    const baseH = 0.05;
    const pw = w - 0.05;
    const py = baseH + 0.03;
    const pz = -d / 2 + 0.045;
    const z0 = pz + 0.01;
    const z1 = d / 2 - 0.06;
    const lt = 0.035;
    const reach = z1 + 0.05 - pz;
    const a = Math.asin(clamp((h - py - lt - 0.005) / reach, 0.03, 0.5));
    const ribs = Math.max(6, Math.round((z1 - z0) / 0.02));
    const parts: Part[] = [
      span('accents', [-w / 2, w / 2], [0.01, baseH], [-d / 2 + 0.01, d / 2 - 0.04], { bevel: 0.015 }),
      span('shell', [-w / 2 + 0.006, w / 2 - 0.006], [0.02, baseH], [-d / 2 + 0.015, d / 2 - 0.045], { bevel: 0.012 }),
      ...feet4('accents', w, d - 0.04, 0.04, 0.012, 0.012),
      span('plates', [-pw / 2, pw / 2], [baseH, baseH + 0.006], [z0, z1], o),
      ...spaced(ribs, z0 + 0.008, z1 - 0.008).map((z) => span('plates', [-pw / 2 + 0.004, pw / 2 - 0.004], [baseH + 0.006, baseH + 0.011], [z - 0.0025, z + 0.0025], o)),
      // Drip spout and ready lights.
      span('accents', [-0.03, 0.03], [baseH - 0.01, baseH + 0.004], [z1, d / 2 - 0.035], { bevel: 0.004, plan: false }),
      sphere('leds', [w / 2 - 0.06, baseH * 0.55, d / 2 - 0.044], 0.004, o),
      sphere('leds', [w / 2 - 0.08, baseH * 0.55, d / 2 - 0.044], 0.004, o),
      // Floating hinge arms at the back.
      span('accents', [-w / 2 + 0.03, -w / 2 + 0.05], [baseH - 0.01, py + 0.012], [-d / 2 + 0.02, pz + 0.012], { bevel: 0.004, plan: false }),
      span('accents', [w / 2 - 0.05, w / 2 - 0.03], [baseH - 0.01, py + 0.012], [-d / 2 + 0.02, pz + 0.012], { bevel: 0.004, plan: false }),
      rodX('accents', -w / 2 + 0.035, w / 2 - 0.035, py, pz, 0.008, o),
    ];
    const lid: Part[] = [
      span('shell', [-w / 2 + 0.004, w / 2 - 0.004], [py + 0.004, py + lt], [z0 - 0.01, z1 + 0.01], { bevel: 0.014 }),
      span('plates', [-pw / 2, pw / 2], [py - 0.002, py + 0.004], [z0, z1], o),
      ...spaced(ribs, z0 + 0.008, z1 - 0.008).map((z) => span('plates', [-pw / 2 + 0.004, pw / 2 - 0.004], [py - 0.007, py - 0.002], [z - 0.0025, z + 0.0025], o)),
      // Long front handle on two posts.
      span('accents', [-w / 2 + 0.04, w / 2 - 0.04], [py + lt - 0.008, py + lt + 0.004], [z1 + 0.035, z1 + 0.05], { bevel: 0.005, plan: false }),
      span('accents', [-w / 2 + 0.04, -w / 2 + 0.055], [py + lt - 0.012, py + lt], [z1 + 0.005, z1 + 0.045], { bevel: 0.003, plan: false }),
      span('accents', [w / 2 - 0.055, w / 2 - 0.04], [py + lt - 0.012, py + lt], [z1 + 0.005, z1 + 0.045], { bevel: 0.003, plan: false }),
    ];
    parts.push(...hingeX(lid, py, pz, a).map((p) => ({ ...p, plan: false })));
    return parts;
  },
});

const sodaMaker = defineItem({
  id: 'soda-maker',
  name: 'Sparkling water maker',
  category: 'kitchen',
  type: 'appliances',
  group: 'Small appliances',
  tags: ['soda', 'sparkling water', 'carbonator', 'fizzy', 'co2', 'countertop'],
  defaultSize: { w: 0.15, d: 0.26, h: 0.44 },
  minSize: { w: 0.13, d: 0.22, h: 0.4 },
  maxSize: { w: 0.2, d: 0.3, h: 0.5 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Body', 'textured-white'),
    matSlot('accent', 'Button, tray & trim', 'satin-stainless'),
    matSlot('bottle', 'Bottle', 'clear-tritan'),
    matSlot('water', 'Water', 'water'),
  ],
  build: ({ w, d, h }) => {
    const zt = -d / 2 + d * 0.45;
    const headY = h - 0.085;
    const zfront = d / 2 - 0.015;
    const br = Math.min(w / 2 - 0.012, (zfront - zt) / 2 - 0.006);
    const bz = (zt + zfront) / 2;
    const bY0 = 0.036;
    const bH = headY - 0.02 - bY0;
    const parts: Part[] = [
      span('body', [-w / 2, w / 2], [0, h - 0.014], [-d / 2, zt], { bevel: 0.03 }),
      span('body', [-w / 2, w / 2], [0, 0.032], [-d / 2, d / 2], { bevel: 0.012 }),
      span('accent', [-w / 2 + 0.012, w / 2 - 0.012], [0.032, 0.036], [zt, d / 2 - 0.012], { bevel: 0.0015, plan: false }),
      span('body', [-w / 2, w / 2], [headY, h - 0.014], [-d / 2, zfront], { bevel: 0.025 }),
      // Carbonation button on top and a brushed strip down the front of the tower.
      cyl('accent', [0, h - 0.009, -d * 0.12], 0.032, 0.018, { rTop: 0.03, segments: 28, plan: false }),
      span('accent', [-w * 0.32, w * 0.32], [0.06, headY - 0.02], [zt, zt + 0.004], { bevel: 0.0015, plan: false }),
      // Fizz-level LEDs on the head front.
      ...cells(3, -0.015, 0.015).map((x) => sphere('accent', [x, headY + 0.025, zfront], 0.003, o)),
      // Bottle screwed into the head, partly filled.
      vessel('bottle', [0, bY0, bz], [[br * 0.92, 0], [br, 0.01], [br, bH * 0.75], [br * 0.55, bH * 0.88], [br * 0.42, bH]], 0.003, 0.004, { segments: 28 }),
      lathe('water', [0, bY0 + 0.004, bz], [[0, 0], [br * 0.95, 0], [br * 0.97, bH * 0.6], [0, bH * 0.6]], { segments: 28, plan: false }),
      cyl('accent', [0, headY - 0.01, bz], br * 0.5, 0.02, { segments: 24, plan: false }),
      vcyl('accent', 0, bz, bY0 + bH * 0.3, headY - 0.02, 0.003, o),
    ];
    return parts;
  },
});

const coffeeGrinder = defineItem({
  id: 'coffee-grinder',
  name: 'Coffee grinder',
  category: 'kitchen',
  type: 'appliances',
  group: 'Small appliances',
  tags: ['coffee grinder', 'burr grinder', 'beans', 'coffee', 'espresso', 'countertop'],
  defaultSize: { w: 0.14, d: 0.22, h: 0.38 },
  minSize: { w: 0.12, d: 0.18, h: 0.32 },
  maxSize: { w: 0.18, d: 0.26, h: 0.45 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Body', 'textured-black'),
    matSlot('hopper', 'Bean hopper', 'smoked-window'),
    matSlot('accent', 'Dials & grounds bin', 'satin-stainless'),
    matSlot('beans', 'Coffee beans', 'coffee-beans'),
  ],
  build: ({ w, d, h }) => {
    const bh = h * 0.6;
    const zt = -d / 2 + d * 0.5;
    const r1 = Math.min(w / 2 - 0.006, d / 2 - 0.012);
    const r0 = r1 * 0.5;
    const hz = -d * 0.05;
    const hy = bh + 0.024;
    const hh = h - 0.02 - hy;
    const cz = (zt + d / 2 - 0.012) / 2;
    const cw = Math.min(w - 0.03, 0.1);
    const parts: Part[] = [
      span('body', [-w / 2, w / 2], [0, bh], [-d / 2, zt], { bevel: 0.02 }),
      span('body', [-w / 2, w / 2], [0, 0.03], [-d / 2, d / 2], { bevel: 0.01 }),
      span('body', [-w / 2, w / 2], [bh - 0.07, bh], [-d / 2, d / 2 - 0.012], { bevel: 0.02 }),
      // Grounds container under the chute.
      span('accent', [-cw / 2, cw / 2], [0.03, bh - 0.11], [cz - (d / 2 - zt) * 0.35, cz + (d / 2 - zt) * 0.35], { bevel: 0.012, plan: false }),
      span('body', [-cw / 2 + 0.01, cw / 2 - 0.01], [bh - 0.11, bh - 0.105], [cz - (d / 2 - zt) * 0.25, cz + (d / 2 - zt) * 0.25], o),
      span('accent', [-0.012, 0.012], [bh - 0.09, bh - 0.07], [cz - 0.012, cz + 0.012], o),
      // Start button and timer dial.
      discZ('accent', [0, bh - 0.035, d / 2 - 0.008], 0.012, 0.008, o),
      cyl('accent', [w / 2 - 0.004, bh * 0.55, -d * 0.18], 0.02, 0.012, { rotation: [0, 0, Math.PI / 2], segments: 24, plan: false }),
      // Grind-size collar, hopper, beans and lid.
      cyl('accent', [0, bh + 0.012, hz], r0 * 1.3, 0.024, { segments: 28, plan: false }),
      vessel('hopper', [0, hy, hz], [[r0, 0], [r1 * 0.95, hh * 0.85], [r1, hh]], 0.003, 0.004, { segments: 28 }),
      lathe('beans', [0, hy + 0.004, hz], [[0, 0], [r0 * 0.95, 0], [r1 * 0.78, hh * 0.6], [r1 * 0.3, hh * 0.68], [0, hh * 0.66]], { segments: 24, plan: false }),
      cyl('body', [0, h - 0.01, hz], r1 * 0.98, 0.02, { rTop: r1 * 0.9, segments: 28, plan: false }),
    ];
    // Grip ribs round the grind collar.
    for (const k of range(10)) {
      const a = (k / 10) * Math.PI * 2;
      parts.push(span('accent', [-0.002, 0.002], [bh + 0.002, bh + 0.022], [-0.003, 0.003], { rotation: [0, a, 0] }));
      const last = parts[parts.length - 1];
      last.position = [Math.cos(a) * r0 * 1.32, bh + 0.012, hz - Math.sin(a) * r0 * 1.32];
      last.plan = false;
    }
    return parts;
  },
});

const dripCoffee = defineItem({
  id: 'drip-coffee',
  name: 'Drip coffee maker',
  category: 'kitchen',
  type: 'appliances',
  group: 'Small appliances',
  tags: ['coffee maker', 'filter coffee', 'drip', 'carafe', 'brew', 'countertop'],
  defaultSize: { w: 0.24, d: 0.3, h: 0.38 },
  minSize: { w: 0.2, d: 0.26, h: 0.32 },
  maxSize: { w: 0.3, d: 0.36, h: 0.45 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Body & carafe lid', 'textured-black'),
    matSlot('carafe', 'Glass carafe & tank window', 'clear-tritan'),
    matSlot('accent', 'Hotplate, band & buttons', 'satin-stainless'),
    matSlot('coffee', 'Coffee', 'brewed-coffee'),
  ],
  build: ({ w, d, h }) => {
    const zt = -d / 2 + d * 0.38;
    const bH = 0.05;
    const hh = h * 0.24;
    const cz = (zt + d / 2) / 2 + 0.005;
    const cr = Math.min(w / 2 - 0.045, (d / 2 - zt) / 2 - 0.01);
    const cx = -0.015;
    const cy = bH + 0.006;
    const ch = h - hh - 0.012 - cy;
    const parts: Part[] = [
      span('body', [-w / 2, w / 2], [0, h - 0.01], [-d / 2, zt], { bevel: 0.025 }),
      span('body', [-w / 2, w / 2], [0, bH], [-d / 2, d / 2], { bevel: 0.015 }),
      span('body', [-w / 2, w / 2], [h - hh, h], [-d / 2, d / 2 - 0.01], { bevel: 0.025 }),
      // Water-level window down the side of the reservoir tower.
      span('carafe', [w / 2 - 0.002, w / 2 + 0.002], [bH + 0.04, h - hh - 0.03], [-d / 2 + 0.03, -d / 2 + 0.055], o),
      // Hinged top lid line and the brew-head drip nozzle.
      span('accent', [-w / 2 + 0.02, w / 2 - 0.02], [h - 0.004, h], [-d / 2 + 0.02, d / 2 - 0.03], { bevel: 0.0015, plan: false }),
      vcyl('body', cx, cz, h - hh - 0.012, h - hh, 0.012, o),
      // Hotplate and control buttons on the base.
      cyl('accent', [cx, bH + 0.003, cz], cr * 1.05, 0.006, { segments: 32, plan: false }),
      ...buttonRow('accent', 3, -w * 0.3, w * 0.3, bH * 0.5, d / 2 - 0.003, 0.02, 0.012),
      // Glass carafe with coffee, band, lid and handle.
      vessel('carafe', [cx, cy, cz], [[cr * 0.82, 0], [cr, ch * 0.3], [cr * 0.95, ch * 0.6], [cr * 0.7, ch * 0.84], [cr * 0.74, ch]], 0.003, 0.004, { segments: 32 }),
      lathe('coffee', [cx, cy + 0.004, cz], [[0, 0], [cr * 0.8, 0], [cr * 0.96, ch * 0.3], [cr * 0.94, ch * 0.45], [0, ch * 0.45]], { segments: 32, plan: false }),
      ring('accent', [cx, cy + ch * 0.86, cz], cr * 0.71, 0.004, { plan: false }),
      cyl('body', [cx, cy + ch - 0.004, cz], cr * 0.76, 0.012, { rTop: cr * 0.6, segments: 32, plan: false }),
      ...rodPath('body', [[cx + cr * 0.72, cy + ch * 0.86, cz], [cx + cr + 0.032, cy + ch * 0.8, cz], [cx + cr + 0.032, cy + ch * 0.25, cz], [cx + cr * 0.95, cy + ch * 0.2, cz]], 0.01),
    ];
    return parts;
  },
});

const toasterOven = defineItem({
  id: 'toaster-oven',
  name: 'Toaster oven',
  category: 'kitchen',
  type: 'appliances',
  group: 'Cooking',
  tags: ['toaster oven', 'mini oven', 'countertop oven', 'grill', 'bake', 'toast'],
  defaultSize: { w: 0.46, d: 0.36, h: 0.27 },
  minSize: { w: 0.4, d: 0.32, h: 0.24 },
  maxSize: { w: 0.56, d: 0.42, h: 0.32 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Body, rack & handle', 'satin-stainless'),
    matSlot('glass', 'Door glass', 'smoked-window'),
    matSlot('accents', 'Knobs, panel & feet', 'textured-black'),
    matSlot('elements', 'Heating elements', 'heater-glow'),
  ],
  build: ({ w, d, h }) => {
    const zf = d / 2 - 0.035;
    const cpw = clamp(w * 0.22, 0.08, 0.12);
    const xc = w / 2 - cpw / 2 - 0.003;
    const cx0 = -w / 2 + 0.02;
    const cx1 = w / 2 - cpw - 0.01;
    const cy0 = 0.04;
    const cy1 = h - 0.025;
    const dcx = (cx0 + cx1) / 2;
    const parts: Part[] = [
      span('body', [-w / 2, w / 2], [0.015, cy0], [-d / 2, zf]),
      span('body', [-w / 2, w / 2], [cy1, h], [-d / 2, zf], { bevel: 0.01 }),
      span('body', [-w / 2, cx0], [cy0, cy1], [-d / 2, zf]),
      span('body', [cx1, w / 2], [cy0, cy1], [-d / 2, zf]),
      span('body', [cx0, cx1], [cy0, cy1], [-d / 2, -d / 2 + 0.01]),
      span('accents', [cx0, cx1], [cy0, cy1], [-d / 2 + 0.01, -d / 2 + 0.013], o),
      span('accents', [cx0, cx1], [cy0, cy0 + 0.003], [-d / 2 + 0.01, zf], o),
      ...feet4('accents', w, d - 0.04, 0.04, 0.012, 0.016),
      // Control panel with three knobs.
      span('accents', [w / 2 - cpw, w / 2 - 0.006], [0.025, h - 0.012], [zf, zf + 0.004], { bevel: 0.003, plan: false }),
      ...cells(3, 0.06, h - 0.045).reverse().flatMap((y, i) => dial('accents', 'body', xc, y, zf + 0.004, 0.019, -0.8 + i * 0.7)),
      // Glass door in a stainless frame, bar handle and crumb tray.
      span('glass', [cx0 + 0.012, cx1 - 0.012], [cy0 + 0.012, cy1 - 0.035], [zf + 0.002, zf + 0.006], o),
      ...frame4('body', [-w / 2 + 0.006, cx1 + 0.004], [0.022, h - 0.008], [zf, zf + 0.008], 0.022),
      span('body', [-w / 2 + 0.028, cx1 - 0.018], [h - 0.05, h - 0.03], [zf, zf + 0.008], o),
      ...barPull('body', [dcx, h - 0.04, zf + 0.008], (cx1 - cx0) * 0.75, { r: 0.007, stand: 0.022 }),
      span('accents', [cx0 + 0.02, cx1 - 0.02], [0.016, 0.022], [zf, zf + 0.012], { bevel: 0.002, plan: false }),
      // Rack and glowing elements inside.
      rodX('body', cx0 + 0.005, cx1 - 0.005, cy0 + (cy1 - cy0) * 0.4, zf - 0.03, 0.003, o),
      rodX('body', cx0 + 0.005, cx1 - 0.005, cy0 + (cy1 - cy0) * 0.4, -d / 2 + 0.03, 0.003, o),
    ];
    for (const x of spaced(Math.max(5, Math.round((cx1 - cx0) / 0.03)), cx0 + 0.015, cx1 - 0.015)) {
      parts.push(rodZ('body', x, cy0 + (cy1 - cy0) * 0.4, -d / 2 + 0.03, zf - 0.03, 0.002, o));
    }
    for (const y of [cy0 + 0.012, cy1 - 0.012]) {
      for (const z of [-d * 0.15, d * 0.08]) parts.push(rodX('elements', cx0 + 0.01, cx1 - 0.01, y, z, 0.004, o));
    }
    // Top vents.
    parts.push(...slats('accents', [cx0 + 0.04, cx1 - 0.04], [h - 0.001, h], [-d / 2 + 0.04, -d / 2 + 0.12], 6, { axis: 'z', gap: 0.55, plan: false }));
    return parts;
  },
});

const waterFilterJug = defineItem({
  id: 'water-filter-jug',
  name: 'Water filter jug',
  category: 'kitchen',
  type: 'appliances',
  group: 'Small appliances',
  tags: ['water filter', 'filter jug', 'pitcher', 'jug', 'drinking water', 'cartridge'],
  defaultSize: { w: 0.27, d: 0.12, h: 0.27 },
  minSize: { w: 0.22, d: 0.1, h: 0.22 },
  maxSize: { w: 0.32, d: 0.15, h: 0.32 },
  slots: [
    matSlot('jug', 'Jug & reservoir', 'clear-tritan'),
    matSlot('water', 'Water', 'water'),
    matSlot('lid', 'Lid & handle', 'textured-white'),
    matSlot('filter', 'Filter cartridge', 'textured-grey'),
  ],
  build: ({ w, d, h }) => {
    const xr = w / 2 - 0.05;
    const top = h - 0.03;
    const parts: Part[] = [
      span('jug', [-w / 2 + 0.012, xr], [0, top], [-d / 2, d / 2], { bevel: 0.02 }),
      span('water', [-w / 2 + 0.016, xr - 0.004], [0.004, h * 0.4], [-d / 2 + 0.004, d / 2 - 0.004], { bevel: 0.015, plan: false }),
      // Top reservoir with unfiltered water and the cartridge.
      span('jug', [-w / 2 + 0.04, xr - 0.01], [h * 0.5, top - 0.002], [-d / 2 + 0.008, d / 2 - 0.008], { bevel: 0.012, plan: false }),
      span('water', [-w / 2 + 0.044, xr - 0.014], [h * 0.52, h * 0.7], [-d / 2 + 0.012, d / 2 - 0.012], { bevel: 0.01, plan: false }),
      vcyl('filter', -w * 0.04, 0, h * 0.26, h * 0.52, Math.min(0.024, d * 0.22), { segments: 20, plan: false }),
      cyl('filter', [-w * 0.04, h * 0.52, 0], Math.min(0.03, d * 0.3), 0.012, { segments: 20, plan: false }),
      // Lid with flip tab over the spout and a filter-life indicator.
      span('lid', [-w / 2 + 0.03, xr + 0.006], [top - 0.004, h - 0.012], [-d / 2, d / 2], { bevel: 0.008 }),
      span('lid', [-w / 2, -w / 2 + 0.04], [top - 0.002, h - 0.006], [-d / 2 + 0.02, d / 2 - 0.02], { bevel: 0.006, rotation: [0, 0, -0.08], plan: false }),
      cyl('filter', [xr - 0.03, h - 0.009, 0], 0.012, 0.006, { segments: 20, plan: false }),
      // Spout lip.
      span('jug', [-w / 2, -w / 2 + 0.016], [top - 0.03, top], [-d / 4, d / 4], { bevel: 0.006, plan: false }),
      // C-shaped handle.
      span('lid', [xr - 0.004, w / 2 - 0.004], [top - 0.04, top], [-0.014, 0.014], { bevel: 0.01, plan: false }),
      span('lid', [w / 2 - 0.026, w / 2], [0.04, top - 0.02], [-0.014, 0.014], { bevel: 0.01, plan: false }),
      span('lid', [xr - 0.004, w / 2 - 0.006], [0.03, 0.06], [-0.012, 0.012], { bevel: 0.01, plan: false }),
    ];
    return parts;
  },
});

const dishDrawer = defineItem({
  id: 'dish-drawer',
  name: 'Dishwasher drawer',
  category: 'kitchen',
  type: 'appliances',
  group: 'Cleaning',
  tags: ['dishwasher', 'dish drawer', 'double drawer', 'built under', 'kitchen'],
  defaultSize: { w: 0.6, d: 0.58, h: 0.82 },
  minSize: { w: 0.45, d: 0.55, h: 0.4 },
  maxSize: { w: 0.6, d: 0.62, h: 0.88 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Drawer fronts', 'satin-stainless'),
    matSlot('trim', 'Gaps, plinth & controls', 'textured-black'),
    matSlot('handles', 'Handles & buttons', 'metal-chrome'),
    matSlot('display', 'Display', 'led-blue'),
  ],
  build: ({ w, d, h }) => {
    const plinth = Math.min(0.1, h * 0.2);
    const zf = d / 2 - 0.07;
    const zd = zf + 0.04;
    const n = h - plinth >= 0.5 ? 2 : 1;
    const parts: Part[] = [
      span('trim', [-w / 2, w / 2], [plinth, h], [-d / 2, zf]),
      span('trim', [-w / 2 + 0.01, w / 2 - 0.01], [0.02, plinth], [-d / 2 + 0.02, zf - 0.045], o),
      ...legs4('handles', w, d - 0.08, 0.04, 0, 0.024, 0.022, { round: true }),
    ];
    for (const [i, [y0, y1]] of [...(n === 2 ? ([[plinth, plinth + (h - plinth) * 0.5], [plinth + (h - plinth) * 0.5, h]] as V2[]) : ([[plinth, h]] as V2[]))].entries()) {
      parts.push(span('body', [-w / 2 + 0.002, w / 2 - 0.002], [y0 + 0.003, y1 - 0.003], [zf, zd], { bevel: 0.006 }));
      parts.push(...barPull('handles', [0, y1 - 0.06, zd], w * 0.7, { r: 0.008, stand: 0.022 }));
      if (i === n - 1) {
        // Control strip along the top edge of the top drawer.
        parts.push(
          span('trim', [-w / 2 + 0.03, w / 2 - 0.03], [y1 - 0.028, y1 - 0.01], [zd, zd + 0.002], { bevel: 0.0008, plan: false }),
          span('display', [-0.045, 0.045], [y1 - 0.025, y1 - 0.013], [zd + 0.002, zd + 0.003], o),
          ...cells(6, -w / 2 + 0.05, -0.07).map((x) => cyl('handles', [x, y1 - 0.019, zd + 0.003], 0.005, 0.002, { rotation: [Math.PI / 2, 0, 0], plan: false })),
          ...cells(2, 0.07, w / 2 - 0.05).map((x) => cyl('handles', [x, y1 - 0.019, zd + 0.003], 0.005, 0.002, { rotation: [Math.PI / 2, 0, 0], plan: false })),
        );
      }
    }
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w / 2, d / 2 - 0.07], [w / 2, d / 2 - 0.07])],
});

const binTrio = defineItem({
  id: 'trash-bins',
  name: 'Kitchen bin trio',
  category: 'kitchen',
  type: 'storage',
  group: 'Baskets & boxes',
  tags: ['bin', 'trash', 'rubbish', 'recycling', 'compost', 'pedal bin', 'waste'],
  defaultSize: { w: 0.9, d: 0.36, h: 0.7 },
  minSize: { w: 0.6, d: 0.28, h: 0.5 },
  maxSize: { w: 1.2, d: 0.45, h: 0.8 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Bins', 'satin-stainless'),
    matSlot('lids', 'Lids', 'textured-black'),
    matSlot('pedals', 'Pedals, bases & hinges', 'textured-grey'),
    matSlot('labels', 'Sorting labels', 'plastic-green'),
  ],
  build: ({ w, d, h }) => {
    const gap = 0.02;
    const fw = [0.37, 0.34, 0.29];
    const fh = [1, 0.88, 0.74];
    const usable = w - gap * 2;
    const front = d / 2 - 0.025;
    const parts: Part[] = [];
    let x0 = -w / 2;
    for (const i of range(3)) {
      const bw = usable * fw[i];
      const x1 = x0 + bw;
      const cx = (x0 + x1) / 2;
      const bh = h * fh[i];
      const lidT = 0.035;
      const ly = bh - lidT - 0.05;
      parts.push(
        span('body', [x0, x1], [0.02, bh - lidT], [-d / 2 + 0.005, front], { bevel: 0.035 }),
        span('pedals', [x0 + 0.01, x1 - 0.01], [0, 0.03], [-d / 2 + 0.015, front - 0.01], { bevel: 0.01, plan: false }),
        span('lids', [x0, x1], [bh - lidT, bh], [-d / 2, front], { bevel: 0.016, plan: false }),
        span('lids', [x0 + 0.01, x1 - 0.01], [bh - lidT - 0.006, bh - lidT + 0.002], [-d / 2 + 0.01, front - 0.008], o),
        span('pedals', [x0 + 0.02, x1 - 0.02], [bh - 0.045, bh - 0.02], [-d / 2, -d / 2 + 0.016], { bevel: 0.005, plan: false }),
        span('pedals', [cx - Math.min(0.06, bw * 0.3), cx + Math.min(0.06, bw * 0.3)], [0.012, 0.034], [front - 0.01, d / 2], { bevel: 0.006, plan: false }),
      );
      // Sorting symbol: triangle (recycling), circle (general), leaf (compost).
      const s = Math.min(0.03, bw * 0.12);
      if (i === 0) parts.push(facePlate('labels', [[cx - s, ly - s * 0.8], [cx + s, ly - s * 0.8], [cx, ly + s * 0.9]], front, 0.004));
      if (i === 1) parts.push(discZ('labels', [cx, ly, front + 0.002], s * 0.9, 0.004, { segments: 24, plan: false }));
      if (i === 2) parts.push(facePlate('labels', [[cx, ly - s], [cx + s * 0.7, ly - s * 0.1], [cx + s * 0.3, ly + s * 0.8], [cx, ly + s], [cx - s * 0.3, ly + s * 0.8], [cx - s * 0.7, ly - s * 0.1]], front, 0.004));
      x0 = x1 + gap;
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const usable = w - 0.04;
    const a = -w / 2 + usable * 0.37 + 0.01;
    const b = a + 0.02 + usable * 0.34;
    return [line([a, -d / 2], [a, d / 2 - 0.025]), line([b, -d / 2], [b, d / 2 - 0.025])];
  },
});

// ---------------------------------------------------------------------------
// Cleaning, laundry and climate
// ---------------------------------------------------------------------------

const uprightVacuum = defineItem({
  id: 'upright-vacuum',
  name: 'Upright vacuum cleaner',
  category: 'laundry',
  type: 'appliances',
  group: 'Cleaning',
  tags: ['vacuum', 'hoover', 'upright', 'bagless', 'cyclone', 'cleaning', 'carpet'],
  defaultSize: { w: 0.32, d: 0.34, h: 1.1 },
  minSize: { w: 0.28, d: 0.3, h: 0.95 },
  maxSize: { w: 0.4, d: 0.4, h: 1.2 },
  slots: [
    matSlot('body', 'Body', 'textured-grey'),
    matSlot('accent', 'Accent', 'textured-plum'),
    matSlot('bin', 'Clear dust bin', 'clear-tritan'),
    matSlot('cord', 'Wheels, hose & cord', 'textured-black'),
  ],
  build: ({ w, d, h }) => {
    const hd = d * 0.45;
    const hz0 = d / 2 - hd;
    const zc = -d / 2 + 0.1;
    const rb = Math.min(0.1, w / 2 - 0.05);
    const wheelR = 0.07;
    const colTop = h * 0.74;
    const binR = Math.min(0.065, w * 0.2);
    const binZ = zc + 0.03 + binR;
    const binY0 = 0.26;
    const binY1 = Math.min(colTop - 0.05, h * 0.62);
    const parts: Part[] = [
      // Floor head with brush roll window, bumper and accent cover.
      span('body', [-w / 2, w / 2], [0.012, 0.085], [hz0, d / 2], { bevel: 0.03 }),
      span('cord', [-w / 2 + 0.01, w / 2 - 0.01], [0.014, 0.05], [d / 2 - 0.012, d / 2], { bevel: 0.006, plan: false }),
      span('accent', [-w * 0.32, w * 0.32], [0.084, 0.09], [hz0 + 0.03, d / 2 - 0.07], { bevel: 0.002, plan: false }),
      span('bin', [-w * 0.38, w * 0.38], [0.082, 0.088], [d / 2 - 0.065, d / 2 - 0.02], { bevel: 0.002, plan: false }),
      cylX('accent', [0, 0.05, d / 2 - 0.042], 0.022, w * 0.74),
      // Neck joint and motor pod between the rear wheels.
      rod('body', [0, 0.06, hz0 + 0.01], [0, 0.12, zc], 0.03, o),
      lathe('body', [0, 0.03, zc], [[0, 0], [rb * 0.8, 0], [rb, 0.07], [rb * 0.85, 0.16], [rb * 0.4, 0.2], [0, 0.2]], { segments: 28 }),
      // Spine column, clear cyclone bin with a cone inside.
      span('body', [-0.055, 0.055], [0.2, colTop], [zc - 0.06, zc + 0.03], { bevel: 0.025 }),
      lathe('bin', [0, binY0, binZ], [[0, 0], [binR * 0.9, 0], [binR, 0.02], [binR, binY1 - binY0], [0, binY1 - binY0]], { segments: 28, plan: false }),
      lathe('body', [0, binY0 + 0.02, binZ], [[0, 0], [binR * 0.25, 0], [binR * 0.65, (binY1 - binY0) * 0.75], [0, (binY1 - binY0) * 0.75]], { segments: 20, plan: false }),
      cyl('accent', [0, binY0 - 0.01, binZ], binR * 1.04, 0.02, { segments: 28, plan: false }),
      cyl('accent', [0, binY1 + 0.012, binZ], binR * 1.04, 0.024, { segments: 28, plan: false }),
      span('accent', [-0.02, 0.02], [binY1 - 0.02, binY1 + 0.03], [binZ + binR - 0.01, binZ + binR + 0.012], { bevel: 0.006, plan: false }),
      // Handle tube and loop grip.
      vcyl('body', 0, zc - 0.015, colTop - 0.02, h - 0.12, 0.018, o),
      ...rodPath('accent', [[0, h - 0.15, zc - 0.015], [0, h - 0.016, zc - 0.015], [0, h - 0.016, zc + 0.075], [0, h - 0.08, zc + 0.075]], 0.016),
      span('cord', [-0.012, 0.012], [h - 0.06, h - 0.035], [zc + 0.01, zc + 0.024], { bevel: 0.004, plan: false }),
      // Power button on the pod.
      discZ('accent', [0, 0.17, zc + rb * 0.45 + 0.01], 0.014, 0.01, o),
    ];
    // Rear wheels with hubs.
    for (const s of [-1, 1]) {
      parts.push(cylX('cord', [s * (w / 2 - 0.025), wheelR, -d / 2 + wheelR + 0.005], wheelR, 0.04));
      parts.push(cylX('accent', [s * (w / 2 - 0.003), wheelR, -d / 2 + wheelR + 0.005], wheelR * 0.45, 0.006));
    }
    // Cord wrapped on two hooks at the back, and the hose up the side.
    const zh = zc - 0.075;
    parts.push(span('cord', [-0.03, 0.03], [h * 0.45 - 0.012, h * 0.45 + 0.012], [zh - 0.006, zc - 0.06], { bevel: 0.004, plan: false }));
    parts.push(span('cord', [-0.03, 0.03], [colTop - 0.03, colTop - 0.006], [zh - 0.006, zc - 0.06], { bevel: 0.004, plan: false }));
    for (const x of spaced(4, -0.02, 0.02)) parts.push(vcyl('cord', x, zh + (x > 0 ? 0.004 : 0), h * 0.45, colTop - 0.018, 0.005, o));
    parts.push(...rodPath('cord', [[-0.07, 0.16, zc - 0.03], [-0.085, 0.35, zc - 0.05], [-0.08, colTop - 0.1, zc - 0.045], [-0.055, colTop - 0.05, zc - 0.03]], 0.018));
    return parts;
  },
  planDetail: ({ w, d }) => [rectPoly(-w / 2, d / 2 - d * 0.45, w / 2, d / 2)],
});

const steamMop = defineItem({
  id: 'steam-mop',
  name: 'Steam mop',
  category: 'laundry',
  type: 'appliances',
  group: 'Cleaning',
  tags: ['steam mop', 'mop', 'floor cleaner', 'steam', 'cleaning'],
  defaultSize: { w: 0.3, d: 0.2, h: 1.15 },
  minSize: { w: 0.26, d: 0.16, h: 1.0 },
  maxSize: { w: 0.36, d: 0.26, h: 1.25 },
  slots: [
    matSlot('body', 'Body & pole', 'textured-white'),
    matSlot('accent', 'Grip, trigger & trim', 'textured-teal'),
    matSlot('tank', 'Water tank', 'water'),
    matSlot('pad', 'Microfibre pad', 'microfibre'),
  ],
  build: ({ w, d, h }) => {
    const bz = 0;
    const parts: Part[] = [
      span('pad', [-w / 2, w / 2], [0, 0.022], [-d / 2 + 0.02, d / 2], { bevel: 0.008 }),
      span('body', [-w / 2 + 0.006, w / 2 - 0.006], [0.018, 0.05], [-d / 2 + 0.025, d / 2 - 0.006], { bevel: 0.015 }),
      span('accent', [-w / 2 + 0.03, w / 2 - 0.03], [0.049, 0.054], [-d / 2 + 0.04, d / 2 - 0.02], { bevel: 0.002, plan: false }),
      // Swivel joint and neck.
      sphere('accent', [0, 0.065, bz], 0.026, o),
      rod('body', [0, 0.07, bz], [0, 0.26, bz], 0.017, o),
      // Main housing with the water tank window and steam selector.
      span('body', [-0.05, 0.05], [0.25, 0.66], [bz - 0.055, bz + 0.05], { bevel: 0.035, plan: false }),
      span('tank', [-0.034, 0.034], [0.32, 0.56], [bz + 0.044, bz + 0.058], { bevel: 0.01, plan: false }),
      cyl('accent', [0, 0.6, bz + 0.05], 0.014, 0.012, { rotation: [Math.PI / 2, 0, 0], segments: 20, plan: false }),
      span('accent', [-0.052, 0.052], [0.27, 0.285], [bz - 0.052, bz + 0.054], { bevel: 0.004, plan: false }),
      // Pole, grip, trigger and handle loop.
      vcyl('body', 0, bz - 0.01, 0.65, h - 0.12, 0.014, o),
      vcyl('accent', 0, bz - 0.01, h - 0.26, h - 0.1, 0.02, o),
      span('accent', [-0.008, 0.008], [h - 0.2, h - 0.16], [bz + 0.008, bz + 0.022], { bevel: 0.004, plan: false }),
      ...rodPath('body', [[0, h - 0.11, bz - 0.01], [0, h - 0.016, bz - 0.01], [0, h - 0.016, bz + 0.06], [0, h - 0.07, bz + 0.06]], 0.014),
      // Cord wrap hooks and the wound cord on the back.
      span('accent', [-0.025, 0.025], [0.7, 0.72], [bz - 0.06, bz - 0.02], { bevel: 0.004, plan: false }),
      span('accent', [-0.025, 0.025], [h - 0.32, h - 0.3], [bz - 0.06, bz - 0.02], { bevel: 0.004, plan: false }),
    ];
    for (const x of spaced(3, -0.016, 0.016)) parts.push(vcyl('body', x, bz - 0.05, 0.71, h - 0.31, 0.0045, o));
    return parts;
  },
  planDetail: ({ w, d }) => [rectPoly(-w / 2, -d / 2 + 0.02, w / 2, d / 2)],
});

const garmentSteamer = defineItem({
  id: 'garment-steamer',
  name: 'Garment steamer',
  category: 'laundry',
  type: 'appliances',
  group: 'Laundry',
  tags: ['garment steamer', 'clothes steamer', 'steam', 'ironing', 'wrinkles', 'laundry'],
  defaultSize: { w: 0.34, d: 0.32, h: 1.6 },
  minSize: { w: 0.28, d: 0.26, h: 1.3 },
  maxSize: { w: 0.4, d: 0.38, h: 1.8 },
  slots: [
    matSlot('base', 'Base & steam head', 'textured-white'),
    matSlot('tank', 'Water tank', 'water'),
    matSlot('pole', 'Pole & hanger', 'metal-chrome'),
    matSlot('hose', 'Hose, pedals & castors', 'textured-black'),
  ],
  build: ({ w, d, h }) => {
    const pz = -d / 2 + 0.04;
    const headY = h * 0.6;
    const hy = h - 0.1;
    const parts: Part[] = [
      span('base', [-w / 2, w / 2], [0.03, 0.13], [-d / 2, d / 2], { bevel: 0.04 }),
      ...range(4).map((k) => sphere('hose', [(k % 2 ? 1 : -1) * (w / 2 - 0.04), 0.016, (k < 2 ? 1 : -1) * (d / 2 - 0.04)], 0.016, o)),
      span('tank', [-w / 2 + 0.03, w / 2 - 0.03], [0.12, 0.3], [-d / 2 + 0.07, d / 2 - 0.04], { bevel: 0.035 }),
      cyl('base', [w * 0.18, 0.305, 0.02], 0.025, 0.014, { segments: 20, plan: false }),
      // Foot pedals: power and steam level.
      span('hose', [-0.07, -0.02], [0.05, 0.075], [d / 2 - 0.03, d / 2], { bevel: 0.006, plan: false }),
      span('hose', [0.02, 0.07], [0.05, 0.075], [d / 2 - 0.03, d / 2], { bevel: 0.006, plan: false }),
      // Telescopic pole with its clamp collar.
      vcyl('pole', 0, pz, 0.13, h * 0.62, 0.015, o),
      vcyl('pole', 0, pz, h * 0.6, hy, 0.01, o),
      vcyl('hose', 0, pz, h * 0.6, h * 0.64, 0.02, o),
      // Hanger bar with curled ends and a top hook.
      rodX('pole', -w / 2 + 0.02, w / 2 - 0.02, hy, pz, 0.008, o),
      ...rodPath('pole', [[-w / 2 + 0.02, hy, pz], [-w / 2 + 0.01, hy - 0.04, pz]], 0.008),
      ...rodPath('pole', [[w / 2 - 0.02, hy, pz], [w / 2 - 0.01, hy - 0.04, pz]], 0.008),
      ...rodPath('pole', [[0, hy, pz], [0, h - 0.03, pz], [0.025, h - 0.008, pz], [0.045, h - 0.03, pz]], 0.006),
      // Steam head parked in its holder.
      span('hose', [-0.02, 0.02], [headY - 0.05, headY + 0.02], [pz + 0.01, pz + 0.04], { bevel: 0.006, plan: false }),
      span('base', [-0.06, 0.06], [headY - 0.04, headY + 0.08], [pz + 0.04, pz + 0.085], { bevel: 0.02, plan: false }),
      span('hose', [-0.05, 0.05], [headY - 0.03, headY + 0.07], [pz + 0.085, pz + 0.09], { bevel: 0.002, plan: false }),
      span('hose', [-0.012, 0.012], [headY - 0.16, headY - 0.04], [pz + 0.05, pz + 0.075], { bevel: 0.008, plan: false }),
      // Hose swooping from the base up to the head.
      ...rodPath('hose', [[w * 0.25, 0.28, -0.02], [w * 0.34, 0.45, 0.07], [w * 0.3, 0.75, 0.09], [w * 0.15, headY - 0.3, 0.06], [0, headY - 0.16, pz + 0.062]], 0.012),
    ];
    return parts;
  },
  planDetail: ({ w, d }) => [circle([0, -d / 2 + 0.04], 0.015), line([-w / 2 + 0.02, -d / 2 + 0.04], [w / 2 - 0.02, -d / 2 + 0.04])],
});

const dehumidifier = defineItem({
  id: 'dehumidifier',
  name: 'Dehumidifier',
  category: 'living',
  type: 'electronics',
  group: 'Climate',
  tags: ['dehumidifier', 'damp', 'humidity', 'mould', 'climate', 'water tank'],
  defaultSize: { w: 0.36, d: 0.26, h: 0.55 },
  minSize: { w: 0.3, d: 0.2, h: 0.42 },
  maxSize: { w: 0.44, d: 0.32, h: 0.68 },
  slots: [
    matSlot('body', 'Body', 'textured-white'),
    matSlot('grille', 'Grilles, castors & panel', 'grille-black'),
    matSlot('tank', 'Tank window', 'smoked-window'),
    matSlot('display', 'Display', 'led-blue'),
  ],
  build: ({ w, d, h }) => {
    const top = h - 0.006;
    const tankTop = h * 0.45;
    const zf = d / 2 - 0.004;
    const parts: Part[] = [
      span('body', [-w / 2, w / 2], [0.03, top], [-d / 2 + 0.003, zf], { bevel: 0.04 }),
      ...range(4).map((k) => sphere('grille', [(k % 2 ? 1 : -1) * (w / 2 - 0.05), 0.017, (k < 2 ? 1 : -1) * (d / 2 - 0.05)], 0.017, o)),
      // Top: outlet louvres, control panel and a recessed carry handle.
      ...slats('grille', [-w / 2 + 0.04, w / 2 - 0.04], [top - 0.002, h], [-d / 2 + 0.05, -0.005], Math.max(4, Math.round((d / 2 - 0.05) / 0.014)), {
        axis: 'z',
        gap: 0.45,
        plan: false,
      }),
      span('grille', [-w * 0.34, w * 0.34], [top - 0.003, h - 0.002], [0.01, zf - 0.035], { bevel: 0.003, plan: false }),
      span('display', [-0.028, 0.028], [h - 0.002, h], [0.03, Math.min(0.07, zf - 0.045)], o),
      ...cells(4, -w * 0.28, w * 0.28)
        .filter((x) => Math.abs(x) > 0.04)
        .map((x) => cyl('body', [x, h - 0.001, (0.01 + zf - 0.035) / 2], 0.008, 0.002, { segments: 16, plan: false })),
      span('grille', [-0.07, 0.07], [top - 0.004, h], [-d / 2 + 0.012, -d / 2 + 0.035], { bevel: 0.002, plan: false }),
      // Front: water tank drawer with level window and finger grip.
      span('body', [-w / 2 + 0.02, w / 2 - 0.02], [0.05, tankTop], [zf - 0.004, d / 2], { bevel: 0.006, plan: false }),
      span('grille', [-w / 2 + 0.012, w / 2 - 0.012], [tankTop + 0.002, tankTop + 0.006], [zf - 0.004, d / 2 + 0.001], o),
      span('tank', [-w * 0.3, -w * 0.12], [0.08, tankTop - 0.05], [d / 2 - 0.002, d / 2 + 0.002], { bevel: 0.0015, plan: false }),
      span('grille', [-0.06, 0.06], [tankTop - 0.035, tankTop - 0.012], [d / 2 - 0.003, d / 2 + 0.002], { bevel: 0.002, plan: false }),
      // Rear intake filter grille and drain hose port.
      span('grille', [-w * 0.38, w * 0.38], [h * 0.35, h * 0.85], [-d / 2, -d / 2 + 0.005], { bevel: 0.002, plan: false }),
      rodZ('grille', w * 0.3, 0.09, -d / 2, -d / 2 + 0.01, 0.01, o),
    ];
    // Side hand grips.
    for (const s of [-1, 1]) parts.push(span('grille', s < 0 ? [-w / 2 - 0.001, -w / 2 + 0.004] : [w / 2 - 0.004, w / 2 + 0.001], [h * 0.7, h * 0.76], [-0.06, 0.06], { bevel: 0.002, plan: false }));
    return parts;
  },
});

const spaceHeater = defineItem({
  id: 'space-heater',
  name: 'Ceramic space heater',
  category: 'electronics',
  type: 'electronics',
  group: 'Climate',
  tags: ['heater', 'space heater', 'ceramic heater', 'fan heater', 'ptc', 'warm'],
  defaultSize: { w: 0.22, d: 0.18, h: 0.32 },
  minSize: { w: 0.17, d: 0.14, h: 0.25 },
  maxSize: { w: 0.3, d: 0.24, h: 0.7 },
  slots: [
    matSlot('body', 'Body', 'textured-white'),
    matSlot('grille', 'Front grille', 'grille-silver'),
    matSlot('accents', 'Base, knobs & frame', 'textured-grey'),
    matSlot('glow', 'Ceramic element glow', 'heater-glow'),
  ],
  build: ({ w, d, h }) => {
    const zf = d / 2 - 0.02;
    const gx: V2 = [-w / 2 + 0.035, w / 2 - 0.035];
    const gy: V2 = [0.065, h - 0.075];
    const top = h - 0.006;
    const parts: Part[] = [
      cyl('accents', [0, 0.01, 0], w / 2, 0.02, { scale: [1, 1, d / w], segments: 36 }),
      span('body', [-w / 2 + 0.015, w / 2 - 0.015], [0.025, top], [-d / 2 + 0.02, zf], { bevel: 0.03 }),
      // Glowing ceramic core behind horizontal grille bars in a frame.
      span('glow', gx, gy, [zf - 0.002, zf + 0.002], o),
      ...slats('grille', gx, gy, [zf + 0.002, zf + 0.008], Math.max(6, Math.round((gy[1] - gy[0]) / 0.012)), { axis: 'y', gap: 0.45, plan: false }),
      ...frame4('accents', [gx[0] - 0.008, gx[1] + 0.008], [gy[0] - 0.008, gy[1] + 0.008], [zf, zf + 0.01], 0.008),
      // Top: thermostat and mode knobs, power light and a carry handle slot.
      vcyl('accents', -w * 0.18, 0, top - 0.004, h, 0.017, { segments: 20, plan: false }),
      vcyl('accents', w * 0.18, 0, top - 0.004, h, 0.017, { segments: 20, plan: false }),
      span('body', [-w * 0.18 - 0.002, -w * 0.18 + 0.002], [h - 0.001, h + 0.002], [-0.014, 0.014], { rotation: [0, 0.6, 0], plan: false }),
      span('body', [w * 0.18 - 0.002, w * 0.18 + 0.002], [h - 0.001, h + 0.002], [-0.014, 0.014], { rotation: [0, -0.3, 0], plan: false }),
      sphere('glow', [0, top - 0.004, zf - 0.03], 0.005, o),
      span('accents', [-0.05, 0.05], [h - 0.045, h - 0.015], [-d / 2 + 0.016, -d / 2 + 0.024], { bevel: 0.003, plan: false }),
      // Rear intake slots.
      ...slats('accents', [-w * 0.3, w * 0.3], [0.06, h * 0.7], [-d / 2 + 0.016, -d / 2 + 0.022], 8, { axis: 'y', gap: 0.5, plan: false }),
    ];
    return parts;
  },
});

const towerFan = defineItem({
  id: 'tower-fan',
  name: 'Tower fan',
  category: 'electronics',
  type: 'electronics',
  group: 'Climate',
  tags: ['fan', 'tower fan', 'oscillating', 'cooling', 'bladeless', 'summer'],
  defaultSize: { w: 0.28, d: 0.28, h: 1.05 },
  minSize: { w: 0.24, d: 0.24, h: 0.75 },
  maxSize: { w: 0.34, d: 0.34, h: 1.25 },
  slots: [
    matSlot('body', 'Body & grille bars', 'textured-white'),
    matSlot('grille', 'Air outlet', 'grille-black'),
    matSlot('accents', 'Base & top panel', 'textured-grey'),
    matSlot('display', 'Display', 'led-blue'),
  ],
  build: ({ w, d, h }) => {
    const R = Math.min(w, d) / 2;
    const tr = R * 0.62;
    const zs = 0.78;
    const colY0 = 0.055;
    const colTop = h - 0.014;
    const zF = tr * zs;
    const gw = tr * 1.0;
    const gy: V2 = [0.16, h - 0.13];
    const parts: Part[] = [
      lathe('accents', [0, 0, 0], [[0, 0], [R, 0], [R, 0.012], [R * 0.9, 0.032], [R * 0.45, 0.045], [R * 0.4, 0.06], [0, 0.06]], { segments: 40 }),
      cyl('body', [0, (colY0 + colTop) / 2, 0], tr, colTop - colY0, { scale: [1, 1, zs], segments: 36, plan: false }),
      cyl('accents', [0, h - 0.007, 0], tr * 0.98, 0.014, { scale: [1, 1, zs], segments: 36, plan: false }),
      // Air outlet strip with vertical bars and a few horizontal braces.
      span('grille', [-gw / 2, gw / 2], gy, [zF * 0.5, zF + 0.002], o),
      ...slats('body', [-gw / 2, gw / 2], gy, [zF + 0.002, zF + 0.008], Math.max(8, Math.round(gw / 0.011)), { axis: 'x', gap: 0.55, plan: false }),
      ...cells(4, gy[0], gy[1]).map((y) => span('body', [-gw / 2, gw / 2], [y - 0.003, y + 0.003], [zF + 0.002, zF + 0.009], o)),
      // Top controls.
      span('display', [-0.018, 0.018], [h - 0.0005, h + 0.0015], [tr * zs * 0.15, tr * zs * 0.45], o),
      ...cells(4, -tr * 0.65, tr * 0.65)
        .filter((x) => Math.abs(x) > 0.025)
        .map((x) => cyl('body', [x, h + 0.001, tr * zs * 0.15], 0.008, 0.003, { segments: 16, plan: false })),
      // Carry slot at the back top.
      span('grille', [-tr * 0.4, tr * 0.4], [h - 0.09, h - 0.06], [-zF - 0.002, -zF * 0.6], { bevel: 0.006, plan: false }),
    ];
    return parts;
  },
  planDetail: ({ w, d }) => [circle([0, 0], Math.min(w, d) / 2 * 0.62)],
});

const wallHairDryer = defineItem({
  id: 'hair-dryer-wall',
  name: 'Wall hair dryer',
  category: 'bathroom',
  type: 'appliances',
  group: 'Small appliances',
  tags: ['hair dryer', 'hotel', 'wall mounted', 'blow dryer', 'bathroom', 'coiled cord'],
  mount: 'wall',
  defaultElevation: 1.15,
  defaultSize: { w: 0.26, d: 0.15, h: 0.36 },
  minSize: { w: 0.22, d: 0.12, h: 0.3 },
  maxSize: { w: 0.32, d: 0.2, h: 0.44 },
  slots: [
    matSlot('holder', 'Wall unit & holster', 'textured-white'),
    matSlot('dryer', 'Dryer', 'textured-grey'),
    matSlot('cord', 'Coiled cord & switch', 'textured-black'),
    matSlot('grille', 'Intake grille', 'grille-black'),
  ],
  build: ({ w, d, h }) => {
    const zw = -d / 2;
    const zr = -d / 2 + d * 0.6;
    const bR = Math.min(0.045, d * 0.28, h * 0.13);
    const ringY = h * 0.62;
    const by = h - bR;
    const bx0 = -w / 2 + 0.012;
    const bx1 = w / 2 - 0.05;
    const boxTop = h * 0.42;
    const parts: Part[] = [
      // Wall unit with rocker switch and a pilot light.
      span('holder', [-0.07, 0.07], [0, boxTop], [zw, zw + 0.05], { bevel: 0.012 }),
      span('cord', [-0.012, 0.012], [boxTop * 0.55, boxTop * 0.8], [zw + 0.05, zw + 0.056], { bevel: 0.003, plan: false }),
      sphere('grille', [0.035, boxTop * 0.7, zw + 0.05], 0.004, o),
      // Bracket arm and holster ring.
      span('holder', [-0.02, 0.02], [ringY - 0.03, ringY + 0.005], [zw, zr - 0.02], { bevel: 0.006, plan: false }),
      span('holder', [-0.03, 0.03], [ringY - 0.06, ringY + 0.01], [zw, zw + 0.015], { bevel: 0.004 }),
      ring('holder', [0, ringY, zr], 0.026, 0.007, { plan: false }),
      // Dryer: handle down through the ring, barrel across the top.
      vcyl('dryer', 0, zr, ringY - 0.09, by, 0.017, { segments: 16, plan: false }),
      span('cord', [-0.006, 0.006], [ringY - 0.06, ringY - 0.03], [zr + 0.012, zr + 0.022], { bevel: 0.002, plan: false }),
      cylX('dryer', [(bx0 + bx1) / 2, by, zr], bR, bx1 - bx0),
      cylX('dryer', [bx1 + 0.02, by, zr], bR * 0.65, 0.04, bR * 0.85),
      cylX('grille', [bx0 - 0.003, by, zr], bR * 0.85, 0.008),
      cylX('cord', [bx0 + 0.03, by, zr], bR * 1.02, 0.01),
    ];
    // Coiled cord from the handle down to the wall unit.
    const cx = 0.045;
    const cz = zw + 0.065;
    const coilR = 0.012;
    const yTop = ringY - 0.1;
    const yBot = 0.03;
    const turns = Math.max(4, Math.round((yTop - yBot) / 0.022));
    const pts: V3[] = [[0, ringY - 0.09, zr]];
    for (const i of range(turns * 5 + 1)) {
      const t = i / (turns * 5);
      const a = t * turns * Math.PI * 2;
      pts.push([cx + Math.cos(a) * coilR, yTop - t * (yTop - yBot), cz + Math.sin(a) * coilR]);
    }
    pts.push([0.05, 0.012, zw + 0.03]);
    parts.push(...rodPath('cord', pts, 0.0035));
    return parts;
  },
});

export default definePack({
  name: 'Appliances',
  version: '1.0.0',
  author: 'Neest team',
  description:
    'Detailed, brand-neutral appliances: side-by-side, retro, mini and under-counter fridges, a chest freezer, dishwasher drawer, countertop cooking and coffee kit, vacuum, steam mop, garment steamer and climate gadgets.',
  license: 'CC0 (made for Neest)',
  items: [
    sideBySideFridge,
    retroFridge,
    miniFridge,
    chestFreezer,
    undercounterFridge,
    airFryer,
    blender,
    foodProcessor,
    juicer,
    slowCooker,
    pressureCooker,
    breadMaker,
    waffleMaker,
    sandwichPress,
    sodaMaker,
    coffeeGrinder,
    dripCoffee,
    toasterOven,
    dishDrawer,
    binTrio,
    uprightVacuum,
    steamMop,
    dehumidifier,
    spaceHeater,
    towerFan,
    wallHairDryer,
    garmentSteamer,
    waterFilterJug,
  ],
  patterns: [
    {
      id: 'satin-steel',
      name: 'Satin brushed stainless',
      normalStrength: 0.2,
      // Long horizontal brush streaks over a fine grain; near-white so the material colour tints it.
      draw(ctx, size, rand) {
        const img = ctx.createImageData(size, size);
        const streaks = periodicNoise(size, 3, 160, rand);
        const bands = periodicNoise(size, 6, 48, rand);
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            const k = y * size + x;
            const v = 0.84 + (streaks[k] - 0.5) * 0.12 + (bands[k] - 0.5) * 0.06 + (rand() - 0.5) * 0.03;
            const i = k * 4;
            img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(clamp(v, 0, 1) * 255);
            img.data[i + 3] = 255;
          }
        }
        ctx.putImageData(img, 0, 0);
      },
    },
    {
      id: 'orange-peel',
      name: 'Textured appliance plastic',
      normalStrength: 0.55,
      // Fine stipple of soft bumps, like moulded appliance housings.
      draw(ctx, size, rand) {
        const img = ctx.createImageData(size, size);
        const fine = periodicNoise(size, 64, 64, rand);
        const coarse = periodicNoise(size, 16, 16, rand);
        for (let k = 0; k < size * size; k++) {
          const v = 0.9 + (fine[k] - 0.5) * 0.14 + (coarse[k] - 0.5) * 0.05 + (rand() - 0.5) * 0.02;
          const i = k * 4;
          img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(clamp(v, 0, 1) * 255);
          img.data[i + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);
      },
    },
    {
      id: 'perforated',
      name: 'Perforated grille',
      normalStrength: 1.1,
      // Staggered round holes (16 per row, 16 rows) with a soft lit rim.
      draw(ctx, size, rand) {
        const img = ctx.createImageData(size, size);
        const n = 16;
        const p = size / n;
        const r = p * 0.3;
        for (let y = 0; y < size; y++) {
          const j = Math.floor(y / p);
          for (let x = 0; x < size; x++) {
            let best = Infinity;
            for (let dj = -1; dj <= 1; dj++) {
              const jj = j + dj;
              const off = (((jj % n) + n) % 2) * 0.5 * p;
              const cy = (jj + 0.5) * p;
              const i0 = Math.round((x - off) / p - 0.5);
              for (let di = -1; di <= 1; di++) {
                const cx = (i0 + di + 0.5) * p + off;
                const dd = Math.hypot(x - cx, y - cy);
                if (dd < best) best = dd;
              }
            }
            let v: number;
            if (best < r - 1) v = 0.12;
            else if (best < r + 1) v = 0.12 + ((best - (r - 1)) / 2) * 0.86;
            else if (best < r + 2.5) v = 0.98;
            else v = 0.88 + (rand() - 0.5) * 0.03;
            const i = (y * size + x) * 4;
            img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(clamp(v, 0, 1) * 255);
            img.data[i + 3] = 255;
          }
        }
        ctx.putImageData(img, 0, 0);
      },
    },
  ],
  materials: [
    { id: 'satin-stainless', name: 'Satin stainless steel', category: 'metal', color: '#c4c7ca', roughness: 0.3, metalness: 0.95, pattern: { id: 'satin-steel', scale: 0.35 } },
    { id: 'black-stainless', name: 'Black stainless steel', category: 'metal', color: '#4a4c51', roughness: 0.34, metalness: 0.85, pattern: { id: 'satin-steel', scale: 0.35 } },
    { id: 'textured-white', name: 'Textured white plastic', color: '#f0efeb', roughness: 0.55, pattern: { id: 'orange-peel', scale: 0.08, contrast: 0.8 } },
    { id: 'textured-black', name: 'Textured black plastic', color: '#26272a', roughness: 0.6, pattern: { id: 'orange-peel', scale: 0.08, contrast: 0.9 } },
    { id: 'textured-grey', name: 'Textured grey plastic', color: '#8e9297', roughness: 0.55, pattern: { id: 'orange-peel', scale: 0.08, contrast: 0.8 } },
    { id: 'textured-plum', name: 'Plum plastic', color: '#7a3f86', roughness: 0.42, pattern: { id: 'orange-peel', scale: 0.08, contrast: 0.5 } },
    { id: 'textured-teal', name: 'Teal plastic', color: '#2a9d9a', roughness: 0.42, pattern: { id: 'orange-peel', scale: 0.08, contrast: 0.5 } },
    { id: 'enamel-mint', name: 'Pastel mint enamel', color: '#a9dcc8', roughness: 0.2, pattern: { id: 'orange-peel', scale: 0.2, contrast: 0.25 } },
    { id: 'enamel-white', name: 'Appliance white enamel', color: '#f3f3ef', roughness: 0.26, pattern: { id: 'orange-peel', scale: 0.2, contrast: 0.25 } },
    { id: 'grille-black', name: 'Black perforated grille', category: 'metal', color: '#2b2c2f', roughness: 0.5, metalness: 0.4, pattern: { id: 'perforated', scale: 0.06 } },
    { id: 'grille-silver', name: 'Silver perforated grille', category: 'metal', color: '#b9bcc0', roughness: 0.35, metalness: 0.8, pattern: { id: 'perforated', scale: 0.05 } },
    { id: 'clear-tritan', name: 'Clear jar plastic', category: 'glass', color: '#e4eef0', roughness: 0.05, opacity: 0.3 },
    { id: 'smoked-window', name: 'Smoked appliance window', category: 'glass', color: '#5a5f63', roughness: 0.08, opacity: 0.6 },
    { id: 'led-blue', name: 'Blue LED display', color: '#0f1a22', roughness: 0.15, emissive: '#3fc4ff', emissiveIntensity: 1.4 },
    { id: 'heater-glow', name: 'Glowing heating element', color: '#ff8a3c', roughness: 0.5, emissive: '#ff5a14', emissiveIntensity: 2 },
    { id: 'non-stick', name: 'Non-stick coating', color: '#2e2e30', roughness: 0.55, pattern: { id: 'orange-peel', scale: 0.06, contrast: 0.5 } },
    { id: 'orange-juice', name: 'Orange juice', category: 'glass', color: '#f39a1e', roughness: 0.1, opacity: 0.85 },
    { id: 'brewed-coffee', name: 'Brewed coffee', category: 'glass', color: '#3a2114', roughness: 0.08, opacity: 0.9 },
    { id: 'coffee-beans', name: 'Roasted coffee beans', color: '#4a2c1a', roughness: 0.5, pattern: { id: 'granite', scale: 0.05 } },
    { id: 'microfibre', name: 'Microfibre pad', category: 'fabric', color: '#d6dbdf', roughness: 1, pattern: { id: 'boucle', scale: 0.06 } },
  ],
});

/** Periodic value noise with `cx` × `cy` lattice cells across the tile (wraps seamlessly), values 0–1. */
function periodicNoise(size: number, cx: number, cy: number, rand: () => number): Float32Array {
  const g = Array.from({ length: cx * cy }, () => rand());
  const out = new Float32Array(size * size);
  const s = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) {
    const gy = (y / size) * cy;
    const y0 = Math.floor(gy);
    const fy = s(gy - y0);
    const ya = y0 % cy;
    const yb = (y0 + 1) % cy;
    for (let x = 0; x < size; x++) {
      const gx = (x / size) * cx;
      const x0 = Math.floor(gx);
      const fx = s(gx - x0);
      const xa = x0 % cx;
      const xb = (x0 + 1) % cx;
      const top = g[ya * cx + xa] * (1 - fx) + g[ya * cx + xb] * fx;
      const bot = g[yb * cx + xa] * (1 - fx) + g[yb * cx + xb] * fx;
      out[y * size + x] = top * (1 - fy) + bot * fy;
    }
  }
  return out;
}

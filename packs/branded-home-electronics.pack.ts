/**
 * Branded home electronics — fans, vacuums, robot vacuums, air treatment, heaters, smart speakers,
 * routers and small kitchen appliances that Vietnamese homes buy from Xiaomi, Dyson, Dreame,
 * Roborock, Ecovacs, Sharp, Daikin, Levoit, Google, Apple, TP-Link, Philips and Cuckoo.
 *
 * Every item is a real model sold in Vietnam at its published size (`brand.url` names the source).
 * Original procedural shapes: no logos or trademark artwork. Fixed products, so nothing resizes;
 * where the maker sells several finishes they are offered as colour variants.
 */
import {
  cyl,
  defineItem,
  definePack,
  discZ,
  lathe,
  matSlot,
  prism,
  range,
  circle,
  ellipsePoints,
  poly,
  ring,
  rod,
  roundRectPoints,
  span,
  sphere,
  torus,
  vcyl,
  type AssetBrand,
  type AssetPresetVariant,
  type Part,
  type Size3,
  type V2,
  type V3,
} from '@/packs/kit';

const o = { plan: false };
const TAU = Math.PI * 2;

function fixed(w: number, d: number, h: number) {
  const s: Size3 = { w, d, h };
  return { defaultSize: s, minSize: s, maxSize: s, resizable: { w: false, d: false, h: false } };
}

const brand = (name: string, model: string, line: string, url: string, specs: [string, string][]): AssetBrand => ({ name, model, line, url, specs });

/** The maker's finishes as colour variants: [id, name, { slot: material }]. */
const finishes = (...list: [string, string, Record<string, string>][]): AssetPresetVariant[] => list.map(([id, name, materials]) => ({ id, name, materials }));

/** Horizontal cylinder along X centred at `c`. */
const cylX = (slot: string, c: V3, r: number, len: number, opts?: { segments?: number; plan?: boolean }): Part =>
  cyl(slot, c, r, len, { segments: opts?.segments, plan: opts?.plan, rotation: [0, 0, Math.PI / 2] });

/** Thin wire (few segments) between two points; never in the plan. */
const wire = (slot: string, a: V3, b: V3, r: number): Part => rod(slot, a, b, r, { segments: 5, plan: false });

/** Rounded slab lying flat: a prism with a rounded-rectangle outline. */
const slab = (slot: string, cx: number, cz: number, w: number, d: number, r: number, y0: number, h: number, plan = true): Part =>
  prism(slot, roundRectPoints(cx, cz, w, d, r, 5), y0, h, plan ? undefined : o);

/** Round tower body (lathe) from a list of [radius, y] points, closed at both ends. */
const tower = (slot: string, x: number, z: number, profile: V2[], segments = 40, plan = true): Part =>
  lathe(slot, [x, 0, z], profile, { segments, ...(plan ? {} : o) });

// ---------------------------------------------------------------------------
// Fans
// ---------------------------------------------------------------------------

const FAN_TAGS = ['branded', 'vietnam', 'xiaomi', 'quạt', 'fan', 'smart home', 'climate', 'electronics'];

/** Euler XYZ angles for "turn by `a` about z, after pitching by `p` about the part's own x". */
function rotZX(a: number, p: number): V3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [Math.atan2(c * Math.sin(p), Math.cos(p)), Math.asin(s * Math.sin(p)), Math.atan2(s * Math.cos(p), c)];
}

/**
 * Round fan head facing +z, centred at `c` (grille centre plane): domed front grille of swirled
 * wires with rings and a centre badge, flatter back grille, pitched blades (an optional second,
 * larger row behind for twin-layer rotors), spinner, and the motor housing behind.
 */
function fanHead(c: V3, R: number, f: { blades: number; outer?: number; spokes: number; depth: number; motorR: number; motorL: number }, s = { grille: 'grille', blade: 'blade', body: 'body', trim: 'trim' }): Part[] {
  const [x, y, z] = c;
  const zf = z + f.depth / 2; // front rim plane
  const zb = z - f.depth / 2; // back rim plane
  const dome = f.depth * 0.32;
  const parts: Part[] = [
    torus(s.grille, [x, y, z], R, 0.006, o),
    torus(s.grille, [x, y, zf], R - 0.004, 0.0035, o),
    torus(s.grille, [x, y, zb], R - 0.006, 0.0035, o),
  ];
  // Rim band joining the two grilles.
  for (const k of range(6)) {
    const a = (k / 6) * TAU + 0.2;
    parts.push(wire(s.grille, [x + Math.cos(a) * (R - 0.003), y + Math.sin(a) * (R - 0.003), zb], [x + Math.cos(a) * (R - 0.003), y + Math.sin(a) * (R - 0.003), zf], 0.003));
  }
  // Front: swirled spokes from the rim to the badge, rising into a shallow dome; two rings.
  const rb = R * 0.2;
  for (const k of range(f.spokes)) {
    const a = (k / f.spokes) * TAU;
    const b = a + 0.45;
    const am = a + 0.2;
    const rm = R * 0.58;
    const zm = zf + dome * 0.7;
    parts.push(
      wire(s.grille, [x + Math.cos(a) * (R - 0.004), y + Math.sin(a) * (R - 0.004), zf], [x + Math.cos(am) * rm, y + Math.sin(am) * rm, zm], 0.0016),
      wire(s.grille, [x + Math.cos(am) * rm, y + Math.sin(am) * rm, zm], [x + Math.cos(b) * rb, y + Math.sin(b) * rb, zf + dome], 0.0016),
    );
  }
  parts.push(torus(s.grille, [x, y, zf + dome * 0.7], R * 0.58, 0.0022, o), torus(s.grille, [x, y, zf + dome * 0.92], R * 0.36, 0.002, o));
  parts.push(discZ(s.grille, [x, y, zf + dome], rb + 0.004, 0.008, { segments: 32, plan: false }), discZ(s.trim, [x, y, zf + dome + 0.0045], rb * 0.55, 0.002, { segments: 28, plan: false }));
  // Back: straight radial wires and one ring around the motor.
  const nb = Math.round(f.spokes * 0.75);
  for (const k of range(nb)) {
    const a = (k / nb) * TAU + 0.1;
    parts.push(wire(s.grille, [x + Math.cos(a) * (R - 0.006), y + Math.sin(a) * (R - 0.006), zb], [x + Math.cos(a) * f.motorR, y + Math.sin(a) * f.motorR, zb - 0.012], 0.0016));
  }
  parts.push(torus(s.grille, [x, y, zb - 0.006], R * 0.6, 0.002, o));
  // Rotor: spinner and blades.
  const zr = z + 0.006;
  parts.push(discZ(s.blade, [x, y, zr], R * 0.13, 0.03, { segments: 28, plan: false }), sphere(s.blade, [x, y, zr + 0.015], R * 0.11, { scale: [1, 1, 0.5], plan: false }));
  const row = (n: number, len: number, wid: number, dz: number, phase: number) => {
    for (const k of range(n)) {
      const a = (k / n) * TAU + phase;
      const rm = R * 0.13 + len * 0.45;
      parts.push(sphere(s.blade, [x + Math.cos(a) * rm, y + Math.sin(a) * rm, zr + dz], 1, { scale: [len / 2, wid / 2, 0.0025], rotation: rotZX(a + 0.28, 0.45), plan: false }));
    }
  };
  if (f.outer) row(f.outer, R * 0.84, R * 0.42, -0.012, 0.3);
  row(f.blades, f.outer ? R * 0.6 : R * 0.82, f.outer ? R * 0.3 : R * 0.36, 0.004, 0);
  // Motor housing behind the back grille: a short rounded drum.
  const zm0 = zb - 0.012;
  parts.push(
    { ...lathe(s.body, [0, 0, 0], [[0, 0], [f.motorR * 0.7, 0], [f.motorR * 0.95, f.motorL * 0.2], [f.motorR, f.motorL * 0.55], [f.motorR, f.motorL], [0, f.motorL]], { segments: 32, rotation: [Math.PI / 2, 0, 0], plan: false }), position: [x, y, zm0 - f.motorL / 2] } as Part,
  );
  return parts;
}

/** Xiaomi pedestal fan: low round base, telescopic two-part pole, neck and the fan head. */
function xiaomiStandFan({ w, d, h }: Size3, f: { blades: number; outer?: number; battery?: boolean; panel: 'top' | 'back' }): Part[] {
  const R = w / 2 - 0.008;
  const cy = h - R - 0.004;
  const motorL = 0.07;
  const headD = 0.1;
  // Head sits forward so the motor clears the pole; the base is centred under the pole.
  const zc = d / 2 - headD / 2 - headD * 0.32 - 0.008;
  const zp = zc - headD / 2 - 0.012 - motorL * 0.55;
  const br = d / 2 - Math.abs(zp) - 0.002;
  const bh = f.battery ? 0.07 : 0.045;
  const parts: Part[] = [
    // Base: weighted disc with a soft shoulder (the Pro keeps its battery in a taller base).
    tower('body', 0, zp, [[0, 0], [br * 0.97, 0], [br, 0.008], [br * 0.97, bh * 0.55], [br * 0.8, bh * 0.92], [br * 0.3, bh], [0, bh]], 48),
    cyl('trim', [0, 0.002, zp], br * 0.85, 0.004, { segments: 40, plan: false }),
    // Lower pole (wider), collar, upper chromed-white pole.
    vcyl('body', 0, zp, bh - 0.004, h * 0.42, 0.019, { segments: 24, plan: false }),
    vcyl('trim', 0, zp, h * 0.42, h * 0.44, 0.021, { segments: 24, plan: false }),
    vcyl('body', 0, zp, h * 0.44, cy - 0.06, 0.0135, { segments: 20, plan: false }),
    // Neck: a short yoke from the pole top into the motor housing, with the tilt knuckle.
    rod('body', [0, cy - 0.065, zp], [0, cy - 0.03, zp + 0.01], 0.02, { segments: 20, plan: false }),
    cylX('trim', [0, cy - 0.035, zp + 0.008], 0.022, 0.05, { segments: 24, plan: false }),
  ];
  if (f.battery) {
    // Charging port and battery light on the base.
    parts.push(discZ('trim', [0, bh * 0.45, zp + br - 0.006], 0.006, 0.004, { segments: 12, plan: false }));
    for (const i of range(4)) parts.push(span('trim', [-0.018 + i * 0.012, -0.012 + i * 0.012], [bh * 0.7, bh * 0.7 + 0.003], [zp + br * 0.55, zp + br * 0.55 + 0.004], o));
  }
  parts.push(...fanHead([0, cy, zc], R, { blades: f.blades, outer: f.outer, spokes: 30, depth: headD, motorR: 0.068, motorL }));
  // Control panel: a row of touch buttons on top of the motor drum, or a rocker on its back.
  const zm = zc - headD / 2 - 0.012 - motorL / 2;
  if (f.panel === 'top') {
    for (const i of range(4)) parts.push(cyl('trim', [-0.024 + i * 0.016, cy + 0.068, zm], 0.0045, 0.002, { segments: 12, plan: false }));
    parts.push(sphere('trim', [0.04, cy + 0.067, zm], 0.002, o));
  } else {
    parts.push(span('trim', [-0.02, 0.02], [cy - 0.012, cy + 0.012], [zm - motorL / 2 - 0.003, zm - motorL / 2 + 0.002], { bevel: 0.003, plan: false }));
  }
  return parts;
}

const FAN_SLOTS = [
  matSlot('body', 'Body, pole & base', 'hx-matte-white'),
  matSlot('grille', 'Grille', 'hx-gloss-white'),
  matSlot('blade', 'Blades', 'hx-blade-white'),
  matSlot('trim', 'Buttons & trim', 'hx-silver'),
];

const fan2 = defineItem({
  id: 'xiaomi-smart-standing-fan-2',
  name: 'Xiaomi Smart Standing Fan 2',
  category: 'living',
  type: 'electronics',
  group: 'Climate',
  tags: [...FAN_TAGS, 'quạt đứng', 'quạt cây', 'stand fan', 'pedestal fan', 'dc fan', 'mi home'],
  description: 'All-white Xiaomi DC pedestal fan with a twin-layer rotor (7 inner and 5 outer blades) behind a domed swirl grille, touch buttons on the head and a slim telescopic pole.',
  ...fixed(0.343, 0.33, 1.0),
  slots: FAN_SLOTS,
  build: (size) => xiaomiStandFan(size, { blades: 7, outer: 5, panel: 'top' }),
  brand: brand('Xiaomi', 'BPLDS02DM', 'Smart Standing Fan 2', 'https://www.mi.com/vn/product/mi-smart-standing-fan-2/specs/', [
    ['Size (W × D × H)', '343 × 330 × 1000 mm (head lowers to ≈ 625 mm)'],
    ['Weight', '3 kg'],
    ['Rotor', 'Twin layer, 7 + 5 blades'],
    ['Power', '15 W DC, 140° oscillation, app control'],
  ]),
});

const towerFan = defineItem({
  id: 'xiaomi-smart-tower-fan',
  name: 'Xiaomi Smart Tower Fan',
  category: 'living',
  type: 'electronics',
  group: 'Climate',
  tags: [...FAN_TAGS, 'quạt tháp', 'tower fan', 'bladeless', 'quạt không cánh', 'oscillating'],
  description: 'Slim white Xiaomi tower fan: an oval column with a tall 68 cm outlet of vertical louvres down the front, perforated intake at the back, touch keys on the top and a low rounded-square base.',
  ...fixed(0.31, 0.31, 1.111),
  slots: [matSlot('body', 'Column & base', 'hx-gloss-white'), matSlot('grille', 'Outlet louvres', 'hx-grille-dark'), matSlot('intake', 'Rear intake', 'hx-perforated-white'), matSlot('trim', 'Top panel', 'hx-silver')],
  build: ({ w, d, h }) => {
    const rx = 0.078;
    const rz = 0.062;
    const top = h;
    const bh = 0.05;
    const parts: Part[] = [
      // Base: rounded square, slightly domed, with a rubber ring underneath.
      slab('body', 0, 0, w, d, 0.07, 0.006, bh - 0.022),
      slab('body', 0, 0, w - 0.04, d - 0.04, 0.06, bh - 0.016, 0.014, false),
      slab('trim', 0, 0, w - 0.06, d - 0.06, 0.05, 0, 0.006, false),
      cyl('body', [0, bh + 0.008, 0], rx * 1.15, 0.018, { segments: 40, scale: [1, 1, rz / rx], plan: false }),
      // Column: oval, closed at the top.
      lathe('body', [0, bh + 0.016, 0], [[0, 0], [rx, 0], [rx, top - bh - 0.04], [rx * 0.96, top - bh - 0.024], [rx * 0.8, top - bh - 0.016], [0, top - bh - 0.016]], { segments: 40, scale: [1, 1, rz / rx], plan: false }),
    ];
    // Front outlet: a recessed dark slot with vertical louvres.
    const y0 = top - 0.12 - 0.682;
    const y1 = top - 0.12;
    parts.push(span('grille', [-0.022, 0.022], [y0, y1], [rz - 0.01, rz + 0.002], { bevel: 0.004, plan: false }));
    for (const x of [-0.016, -0.008, 0, 0.008, 0.016]) parts.push(span('body', [x - 0.0012, x + 0.0012], [y0 + 0.005, y1 - 0.005], [rz - 0.004, rz + 0.003], o));
    // Rear intake: a tall perforated panel.
    parts.push(span('intake', [-0.05, 0.05], [bh + 0.12, top - 0.14], [-rz - 0.002, -rz + 0.012], { bevel: 0.006, plan: false }));
    // Top: touch panel with keys and a small status display.
    parts.push(cyl('trim', [0, top - 0.004, 0], rx * 0.84, 0.002, { segments: 40, scale: [1, 1, rz / rx], plan: false }));
    for (const i of range(4)) parts.push(cyl('grille', [-0.03 + i * 0.02, top - 0.0025, 0.012], 0.0045, 0.001, { segments: 12, plan: false }));
    parts.push(span('grille', [-0.018, 0.018], [top - 0.003, top - 0.0025], [-0.03, -0.014], o));
    return parts;
  },
  planDetail: () => [poly(ellipsePoints(0, 0, 0.078, 0.062))],
  brand: brand('Xiaomi', 'BPTS01DM', 'Smart Tower Fan', 'https://fptshop.com.vn/quat/quat-thap-xiaomi-smart-tower-fan', [
    ['Size (W × D × H)', '310 × 310 × 1111 mm'],
    ['Weight', '4.3 kg'],
    ['Outlet', '682 mm tall'],
    ['Power', '22 W, 30–150° oscillation, app control'],
  ]),
});

// ---------------------------------------------------------------------------
// Stick, wet-dry and canister vacuums
// ---------------------------------------------------------------------------

const VAC_TAGS = ['branded', 'vietnam', 'máy hút bụi', 'vacuum', 'vacuum cleaner', 'cleaning'];

/**
 * Cordless stick vacuum hanging on its wall dock, front +z: floor head on the floor, wand straight
 * up into the clear bin, the cyclone pack and motor above it, the handle and battery towards the
 * wall, and the dock bracket on the wall with its charging lead.
 */
function stickVacuum({ w, d, h }: Size3, v: { binR: number; binH: number; motorR: number; head: 'fluffy' | 'motorbar' | 'flat'; headD: number; screen: boolean; cyclones: number; slim?: boolean }): Part[] {
  const zf = d / 2;
  const zw = zf - v.headD + 0.03; // wand axis (the head's neck sits near its back)
  const wandR = v.slim ? 0.0145 : 0.0165;
  const yTop = h;
  const yBin1 = yTop - 0.17;
  const yBin0 = yBin1 - v.binH;
  const zBin = zw;
  const zMotor = zBin - v.binR - v.motorR + 0.012;
  const zWall = -d / 2;
  const zHandle = Math.max(zMotor - v.motorR - 0.03, zWall + 0.032);
  const parts: Part[] = [];
  // Floor head.
  const hh = v.head === 'flat' ? 0.05 : 0.065;
  const hz0 = zf - v.headD;
  parts.push(span('body', [-w / 2 + 0.004, w / 2 - 0.004], [0.008, hh], [hz0, zf - 0.004], { bevel: 0.018 }));
  if (v.head === 'fluffy') {
    // Soft roller across the whole front, with end caps.
    parts.push(cylX('roller', [0, 0.034, zf - 0.034], 0.033, w - 0.03, { segments: 28, plan: false }));
    for (const s of [-1, 1]) parts.push(cylX('body', [s * (w / 2 - 0.009), 0.034, zf - 0.034], 0.035, 0.016, { segments: 24, plan: false }));
    parts.push(span('accent', [-w / 2 + 0.02, w / 2 - 0.02], [hh - 0.004, hh + 0.002], [hz0 + 0.01, zf - 0.07], { bevel: 0.002, plan: false }));
  } else {
    // Brush bar window and bristle strip, a coloured top cover.
    parts.push(span('bin', [-w / 2 + 0.03, w / 2 - 0.03], [hh - 0.004, hh + 0.001], [zf - 0.07, zf - 0.02], { bevel: 0.002, plan: false }));
    parts.push(cylX('roller', [0, hh - 0.025, zf - 0.045], 0.018, w - 0.07, { segments: 20, plan: false }));
    parts.push(span('accent', [-w / 2 + 0.03, w / 2 - 0.03], [hh - 0.002, hh + 0.003], [hz0 + 0.008, zf - 0.078], { bevel: 0.002, plan: false }));
    parts.push(span('roller', [-w / 2 + 0.01, w / 2 - 0.01], [0.004, 0.012], [zf - 0.012, zf - 0.002], o));
  }
  // Rear wheels and the neck knuckle.
  for (const s of [-1, 1]) parts.push(cylX('roller', [s * 0.045, 0.02, hz0 + 0.02], 0.02, 0.018, { segments: 16, plan: false }));
  parts.push(sphere('body', [0, hh + 0.012, zw], 0.03, o), rod('accent', [0, hh + 0.012, zw], [0, hh + 0.07, zw], wandR + 0.004, { segments: 20, plan: false }));
  // Wand, with a release collar near the top.
  parts.push(vcyl('accent', 0, zw, hh + 0.07, yBin0 - 0.03, wandR, { segments: 20, plan: false }));
  parts.push(vcyl('body', 0, zw, yBin0 - 0.05, yBin0 + 0.005, wandR + 0.006, { segments: 20, plan: false }));
  // Clear bin with its release lever and the shroud inside.
  parts.push(lathe('bin', [0, yBin0, zBin], [[0, 0], [v.binR * 0.9, 0], [v.binR, 0.015], [v.binR, v.binH], [0, v.binH]], { segments: 32, plan: false }));
  parts.push(lathe('metal', [0, yBin0 + 0.01, zBin], [[0, 0], [v.binR * 0.35, 0], [v.binR * 0.62, v.binH * 0.85], [0, v.binH * 0.85]], { segments: 24, plan: false }));
  parts.push(span('accent', [-0.008, 0.008], [yBin1 - 0.04, yBin1 + 0.01], [zBin + v.binR - 0.004, zBin + v.binR + 0.01], { bevel: 0.004, plan: false }));
  // Cyclone pack: a ring of small cones on top of the bin.
  const yc = yBin1;
  parts.push(lathe('metal', [0, yc, zBin], [[0, 0], [v.binR * 1.02, 0], [v.binR, 0.035], [v.binR * 0.75, 0.07], [0, 0.07]], { segments: 32, plan: false }));
  for (const k of range(v.cyclones)) {
    const a = (k / v.cyclones) * TAU;
    parts.push(cyl('metal', [Math.cos(a) * v.binR * 0.72, yc + 0.075, zBin + Math.sin(a) * v.binR * 0.72], 0.009, 0.03, { rTop: 0.006, segments: 10, plan: false }));
  }
  parts.push(cyl('body', [0, yc + 0.095, zBin], v.binR * 0.5, 0.012, { segments: 24, plan: false }));
  // Motor: vertical drum behind the bin, exhaust filter cap on top, screen facing up and back.
  const ym0 = yBin1 - 0.06;
  const ym1 = yTop - 0.03;
  parts.push(vcyl('body', 0, zMotor, ym0, ym1, v.motorR, { segments: 28, plan: false }));
  parts.push(cyl('metal', [0, ym1 + 0.012, zMotor], v.motorR * 0.92, 0.024, { segments: 28, plan: false }));
  for (const k of range(6)) parts.push(cyl('body', [0, ym1 + 0.004 + k * 0.004, zMotor], v.motorR * 0.95, 0.0012, { segments: 28, plan: false }));
  parts.push(span('metal', [-0.016, 0.016], [yBin0 + 0.03, ym0 + 0.01], [zBin - v.binR + 0.004, zMotor + 0.01], { bevel: 0.006, plan: false }));
  if (v.screen) parts.push(span('screen', [-0.016, 0.016], [ym1 - 0.05, ym1 - 0.012], [zMotor - v.motorR - 0.002, zMotor - v.motorR + 0.004], { bevel: 0.002, plan: false }));
  // Handle: a pistol grip running down towards the wall, trigger, and the battery below it.
  const yh1 = ym1 - 0.02;
  const yh0 = ym0 - 0.06;
  parts.push(rod('body', [0, yh1, zMotor - v.motorR + 0.01], [0, yh1, zHandle], 0.016, { segments: 16, plan: false }));
  parts.push(rod('body', [0, yh1, zHandle], [0, yh0, zHandle + 0.01], 0.017, { segments: 16, plan: false }));
  parts.push(span('accent', [-0.007, 0.007], [yh1 - 0.08, yh1 - 0.03], [zHandle + 0.012, zHandle + 0.03], { bevel: 0.004, plan: false }));
  parts.push(span('body', [-0.035, 0.035], [yh0 - 0.07, yh0 + 0.01], [zHandle - 0.02, zMotor + v.motorR * 0.4], { bevel: 0.014, plan: false }));
  // Wall dock: back plate with the charging cradle under the battery and an accessory clip.
  const zp = zWall + 0.008;
  parts.push(span('dock', [-0.032, 0.032], [yh0 - 0.21, yh0 + 0.03], [zWall, zp], { bevel: 0.004 }));
  parts.push(span('dock', [-0.04, 0.04], [yh0 - 0.088, yh0 - 0.07], [zp, zMotor + v.motorR * 0.4], { bevel: 0.006, plan: false }));
  parts.push(span('dock', [-0.025, 0.025], [yh0 - 0.2, yh0 - 0.15], [zp, zp + 0.035], { bevel: 0.006, plan: false }));
  parts.push(vcyl('dock', 0.02, zWall + 0.004, 0.02, yh0 - 0.21, 0.0025, { segments: 6, plan: false }));
  return parts;
}

const DYSON_SLOTS = [matSlot('body', 'Body, handle & dock', 'hx-iron'), matSlot('metal', 'Cyclones & shroud', 'hx-nickel'), matSlot('accent', 'Wand & trigger', 'hx-dyson-yellow'), matSlot('bin', 'Clear bin', 'hx-clear')];

const dysonV15 = defineItem({
  id: 'dyson-v15-detect',
  name: 'Dyson V15 Detect cordless vacuum on wall dock',
  category: 'laundry',
  type: 'appliances',
  group: 'Cleaning',
  tags: [...VAC_TAGS, 'dyson', 'máy hút bụi cầm tay', 'cordless', 'stick vacuum', 'không dây', 'wall dock'],
  description: 'Dyson V15 Detect hanging on its wall dock: soft roller floor head, yellow wand, clear bin under a ring of nickel cyclones, the motor with its rear LCD screen, pistol grip and click-in battery.',
  ...fixed(0.25, 0.266, 1.26),
  wallSnap: true,
  slots: DYSON_SLOTS,
  variants: finishes(['gold', 'Gold/Iron (Absolute)', { accent: 'hx-dyson-gold' }]),
  build: (size) => stickVacuum(size, { binR: 0.058, binH: 0.15, motorR: 0.045, head: 'fluffy', headD: 0.15, screen: true, cyclones: 14 }).map(fixSlots),
  brand: brand('Dyson', 'SV22', 'V15 Detect', 'https://www.dysoncanada.ca/en/vacuum-cleaners/cordless/v15/detect-absolute-hepa-gold', [
    ['Size (W × D × H)', '250 × 266 × 1260 mm'],
    ['Weight', '≈ 3.1 kg'],
    ['Bin', '0.76 L'],
    ['Run time', 'up to 60 min'],
  ]),
});

const xiaomiG11 = defineItem({
  id: 'xiaomi-vacuum-cleaner-g11',
  name: 'Xiaomi Vacuum Cleaner G11 on wall mount',
  category: 'laundry',
  type: 'appliances',
  group: 'Cleaning',
  tags: [...VAC_TAGS, 'xiaomi', 'máy hút bụi cầm tay', 'cordless', 'stick vacuum', 'không dây', 'mi home'],
  description: 'White Xiaomi cordless stick vacuum on its 2-in-1 charging wall mount: brush-bar floor head, grey wand, clear bin and cyclones, colour screen on the back and a long battery handle.',
  ...fixed(0.256, 0.214, 1.25),
  wallSnap: true,
  slots: [matSlot('body', 'Body, handle & mount', 'hx-gloss-white'), matSlot('metal', 'Cyclones', 'hx-silver'), matSlot('accent', 'Wand & accents', 'hx-matte-charcoal'), matSlot('bin', 'Clear bin', 'hx-clear')],
  build: (size) => stickVacuum(size, { binR: 0.046, binH: 0.13, motorR: 0.042, head: 'motorbar', headD: 0.12, screen: true, cyclones: 9, slim: true }).map(fixSlots),
  brand: brand('Xiaomi', 'BHR5512EU', 'Vacuum Cleaner G11', 'https://cellphones.com.vn/may-hut-bui-cam-tay-xiaomi-mi-vacuum-cleaner-g11.html', [
    ['Main unit', '341.5 × 100 × 266.5 mm, 1.6 kg'],
    ['Assembled', '≈ 256 × 214 × 1250 mm on the mount'],
    ['Suction power', '500 W, 0.3 L bin'],
    ['Run time', 'up to ≈ 60 min'],
  ]),
});

/** The stick builder uses 'roller', 'screen' and 'dock' parts: map them onto the four slots. */
function fixSlots(p: Part): Part {
  if (p.slot === 'roller') return { ...p, slot: 'body' };
  if (p.slot === 'screen') return { ...p, slot: 'bin' };
  if (p.slot === 'dock') return { ...p, slot: 'body' };
  return p;
}

const dreameH12 = defineItem({
  id: 'dreame-h12-pro',
  name: 'Dreame H12 Pro wet & dry vacuum on its base',
  category: 'laundry',
  type: 'appliances',
  group: 'Cleaning',
  tags: [...VAC_TAGS, 'dreame', 'máy lau nhà', 'máy hút bụi lau nhà', 'wet dry', 'floor washer', 'cordless'],
  description: 'Black upright Dreame floor washer standing in its charging and self-cleaning base: wide roller head, clean-water tank on the front with a dirty-water tank behind, a round LED display and a long handle with a grip.',
  ...fixed(0.3, 0.3, 1.12),
  wallSnap: true,
  slots: [matSlot('body', 'Body & handle', 'hx-matte-black'), matSlot('tank', 'Water tanks', 'hx-smoke'), matSlot('roller', 'Roller', 'hx-mop'), matSlot('screen', 'Display', 'hx-display')],
  build: ({ w, d, h }) => {
    const parts: Part[] = [];
    // Base tray with the cleaning trough and charging contacts.
    parts.push(slab('body', 0, 0, w, d, 0.04, 0, 0.03));
    parts.push(span('tank', [-w / 2 + 0.03, w / 2 - 0.03], [0.03, 0.034], [-0.01, d / 2 - 0.03], { bevel: 0.002, plan: false }));
    parts.push(span('body', [-0.05, 0.05], [0.03, 0.09], [-d / 2 + 0.01, -d / 2 + 0.05], { bevel: 0.01, plan: false }));
    // Head: wide housing over the roller.
    const hz = d / 2 - 0.13;
    parts.push(span('body', [-0.135, 0.135], [0.034, 0.12], [hz - 0.04, d / 2 - 0.035], { bevel: 0.025, plan: false }));
    parts.push(cylX('roller', [0, 0.072, d / 2 - 0.075], 0.038, 0.25, { segments: 28, plan: false }));
    parts.push(span('tank', [-0.11, 0.11], [0.118, 0.124], [hz - 0.01, d / 2 - 0.06], { bevel: 0.002, plan: false }));
    // Body column: dirty tank (back), clean tank (front), electronics and the display.
    const zc = -0.03;
    parts.push(span('body', [-0.075, 0.075], [0.12, 0.62], [zc - 0.065, zc + 0.03], { bevel: 0.03, plan: false }));
    parts.push(span('tank', [-0.07, 0.07], [0.14, 0.42], [zc + 0.02, zc + 0.085], { bevel: 0.025, plan: false }));
    parts.push(span('body', [-0.072, 0.072], [0.42, 0.45], [zc + 0.015, zc + 0.088], { bevel: 0.01, plan: false }));
    parts.push(span('tank', [-0.06, 0.06], [0.46, 0.6], [zc + 0.02, zc + 0.07], { bevel: 0.02, plan: false }));
    parts.push(discZ('screen', [0, 0.53, zc + 0.072], 0.034, 0.004, { segments: 32, plan: false }));
    parts.push(torus('roller', [0, 0.53, zc + 0.074], 0.034, 0.002, o));
    // Handle: tube and a grip with buttons.
    parts.push(vcyl('body', 0, zc - 0.02, 0.62, h - 0.12, 0.016, { segments: 18, plan: false }));
    parts.push(rod('body', [0, h - 0.13, zc - 0.02], [0, h - 0.006, zc - 0.045], 0.019, { segments: 18, plan: false }));
    parts.push(span('roller', [-0.006, 0.006], [h - 0.1, h - 0.04], [zc - 0.02, zc - 0.002], { bevel: 0.004, plan: false }));
    return parts;
  },
  brand: brand('Dreame', 'H12 Pro', 'H12 Pro wet & dry vacuum', 'https://www.dienmayxanh.com/may-hut-bui/khong-day-dreame-h12-pro', [
    ['Vacuum (W × D × H)', '275 × 238 × 1100 mm'],
    ['With base', '≈ 300 × 300 × 1120 mm'],
    ['Weight', '≈ 4.9 kg'],
  ]),
});

const hitachiCanister = defineItem({
  id: 'hitachi-cv-sf16a',
  name: 'Hitachi CV-SF16A canister vacuum',
  category: 'laundry',
  type: 'appliances',
  group: 'Cleaning',
  tags: [...VAC_TAGS, 'hitachi', 'máy hút bụi có dây', 'canister', 'bagless', 'corded'],
  description: 'Compact dark-blue Hitachi bagless canister vacuum on wheels: clear dust cup at the front, hose socket, carry handle on top and a cord-rewind pedal, with the hose curled over its top.',
  ...fixed(0.239, 0.298, 0.214),
  slots: [matSlot('body', 'Body', 'hx-hitachi-blue'), matSlot('cup', 'Dust cup', 'hx-clear'), matSlot('trim', 'Wheels, hose & pedals', 'hx-matte-charcoal'), matSlot('accent', 'Filter & buttons', 'hx-silver')],
  build: ({ w, d, h }) => {
    const zf = d / 2;
    const parts: Part[] = [
      // Body shell with a rounded nose.
      span('body', [-w / 2 + 0.01, w / 2 - 0.01], [0.03, h * 0.72], [-d / 2, zf - 0.08], { bevel: 0.05 }),
      lathe('body', [0, 0.03, zf - 0.11], [[0, 0], [w / 2 - 0.012, 0], [w / 2 - 0.014, h * 0.5], [w * 0.34, h * 0.62], [0, h * 0.64]], { segments: 36, scale: [1, 1, 0.9], plan: false }),
      // Clear dust cup at the front with its filter inside.
      cyl('cup', [0, h * 0.42, zf - 0.07], 0.068, 0.12, { segments: 32, plan: false }),
      cyl('accent', [0, h * 0.42, zf - 0.07], 0.04, 0.1, { segments: 24, plan: false }),
      // Hose socket and the start of the hose, curling back over the top.
      discZ('trim', [0, h * 0.42, zf - 0.008], 0.024, 0.016, { segments: 20, plan: false }),
      ...rodPathSafe('trim', [[0, h * 0.42, zf - 0.01], [0, h * 0.6, zf - 0.015], [0.03, h - 0.02, zf - 0.08], [0.02, h - 0.02, -d / 2 + 0.06], [-0.05, h * 0.82, -d / 2 + 0.03]], 0.018),
      // Carry handle and buttons on top.
      span('body', [-0.018, 0.018], [h * 0.7, h * 0.86], [-d / 2 + 0.06, -d / 2 + 0.08], { bevel: 0.008, plan: false }),
      span('accent', [-0.06, -0.025], [h * 0.7, h * 0.715], [-d / 2 + 0.03, -d / 2 + 0.07], { bevel: 0.004, plan: false }),
      span('accent', [0.025, 0.06], [h * 0.7, h * 0.715], [-d / 2 + 0.03, -d / 2 + 0.07], { bevel: 0.004, plan: false }),
      // Exhaust grille on the back.
      span('accent', [-0.06, 0.06], [0.07, 0.12], [-d / 2 - 0.0005, -d / 2 + 0.004], o),
    ];
    // Big rear wheels and a front castor.
    for (const s of [-1, 1]) {
      parts.push(cylX('trim', [s * (w / 2 - 0.012), 0.065, -d / 2 + 0.075], 0.065, 0.024, { segments: 28, plan: false }));
      parts.push(cylX('accent', [s * (w / 2 - 0.0005), 0.065, -d / 2 + 0.075], 0.03, 0.002, { segments: 20, plan: false }));
    }
    parts.push(sphere('trim', [0, 0.018, zf - 0.06], 0.018, o));
    return parts;
  },
  brand: brand('Hitachi', 'CV-SF16A', 'Bagless canister vacuum, 1600 W', 'https://www.dienmayxanh.com/may-hut-bui/hitachi-cv-sf16a', [
    ['Size (W × D × H)', '239 × 298 × 214 mm'],
    ['Weight', '4.4 kg'],
    ['Dust cup', '0.6 L, bagless'],
    ['Cord', '5.2 m'],
  ]),
});

/** Hose as a chain of rods with ball joints. */
function rodPathSafe(slot: string, pts: V3[], r: number): Part[] {
  const out: Part[] = [];
  for (let i = 0; i + 1 < pts.length; i++) out.push(rod(slot, pts[i], pts[i + 1], r, { segments: 14, plan: false }));
  for (let i = 1; i + 1 < pts.length; i++) out.push(sphere(slot, pts[i], r, o));
  return out;
}

// ---------------------------------------------------------------------------
// Robot vacuums and their docks
// ---------------------------------------------------------------------------

const ROBOT_TAGS = ['branded', 'vietnam', 'robot hút bụi', 'robot lau nhà', 'robot vacuum', 'robot mop', 'cleaning', 'smart home'];

/**
 * Round robot vacuum, front +z, centred at (x, z): moulded shell, top cover with its seam, a
 * LiDAR turret (cap, window band), buttons, front bumper, cliff-sensor window and a three-arm side
 * brush peeking out at the front corner.
 */
function robotVac(x: number, z: number, R: number, H: number, s = { body: 'body', top: 'top', dark: 'dark', light: 'led' }, opts: { turret?: number } = {}): Part[] {
  const th = 0.026; // turret height above the shell
  const yb = H - th; // shell top
  const parts: Part[] = [
    lathe(s.body, [x, 0.008, z], [[0, 0], [R * 0.92, 0], [R - 0.004, 0.01], [R, 0.03], [R, yb - 0.022], [R - 0.008, yb - 0.004], [R - 0.02, yb - 0.008], [0, yb - 0.008]], { segments: 48 }),
    cyl(s.top, [x, yb - 0.006, z], R - 0.018, 0.006, { segments: 48, plan: false }),
    ring(s.dark, [x, yb - 0.008, z], R - 0.019, 0.0012, o),
    // Underside skirt and wheels area.
    cyl(s.dark, [x, 0.006, z], R * 0.9, 0.012, { segments: 40, plan: false }),
    // Front bumper: a dark band round the front half.
    { ...torus(s.dark, [0, 0, 0], R - 0.0095, 0.009, { arc: Math.PI * 0.95, ...o }), position: [x, (yb - 0.022) * 0.55 + 0.012, z], rotation: [Math.PI / 2, 0, -Math.PI * 0.025] } as Part,
  ];
  // LiDAR turret.
  const tz = z + (opts.turret ?? R * 0.32);
  const tr = 0.042;
  parts.push(vcyl(s.dark, x, tz, yb - 0.008, H - 0.004, tr - 0.003, { segments: 32, plan: false }), cyl(s.top, [x, H - 0.003, tz], tr, 0.006, { segments: 32, plan: false }));
  parts.push({ ...torus(s.light, [0, 0, 0], tr - 0.002, 0.0015, { arc: Math.PI * 0.7, ...o }), position: [x, H - 0.014, tz], rotation: [Math.PI / 2, 0, Math.PI * 0.15] } as Part);
  // Buttons behind the turret.
  for (const dx of [-0.018, 0.018]) parts.push(cyl(s.dark, [x + dx, yb, tz - tr - 0.022], 0.0075, 0.003, { segments: 16, plan: false }));
  parts.push(sphere(s.light, [x, yb, tz - tr - 0.022], 0.003, o));
  // Side brush: hub and three bristle arms at the front right.
  const bx = x + R * 0.62;
  const bz = z + R * 0.62;
  parts.push(cyl(s.dark, [bx, 0.006, bz], 0.012, 0.006, { segments: 12, plan: false }));
  for (const k of range(3)) {
    const a = (k / 3) * TAU + 0.5;
    parts.push(wire(s.dark, [bx, 0.003, bz], [bx + Math.cos(a) * 0.065, 0.002, bz + Math.sin(a) * 0.065], 0.003));
  }
  return parts;
}

const robotS10 = defineItem({
  id: 'xiaomi-robot-vacuum-s10',
  name: 'Xiaomi Robot Vacuum S10 with charging dock',
  category: 'laundry',
  type: 'appliances',
  group: 'Cleaning',
  tags: [...ROBOT_TAGS, 'xiaomi', 'lidar', 'mi home', 'robot'],
  description: 'White Xiaomi LiDAR robot vacuum-mop parked on its small charging dock against the wall: round shell with a top laser turret, dark bumper and a side brush at the front.',
  ...fixed(0.35, 0.46, 0.0945),
  wallSnap: true,
  slots: [matSlot('body', 'Robot & dock', 'hx-gloss-white'), matSlot('top', 'Top cover', 'hx-matte-white'), matSlot('dark', 'Bumper, turret & brush', 'hx-matte-charcoal'), matSlot('led', 'Lights & contacts', 'hx-led-white')],
  build: ({ w, d, h }) => {
    const R = w / 2;
    const zr = d / 2 - R;
    const parts = robotVac(0, zr, R, h);
    // Dock: a small rounded block with a sloped front, contacts low on the front and a cable channel.
    const zb = -d / 2;
    parts.push(span('body', [-0.065, 0.065], [0, 0.093], [zb, zb + 0.08], { bevel: 0.02 }));
    parts.push(prism('body', [[-0.06, 0], [0.06, 0], [0.06, 0.046], [-0.06, 0.046]].map(([x, z]) => [x, zb + 0.07 + z] as V2), 0, 0.02, o));
    parts.push(span('dark', [-0.06, 0.06], [0.05, 0.09], [zb + 0.079, zb + 0.081], o));
    for (const s of [-1, 1]) parts.push(span('led', [s * 0.03 - 0.008, s * 0.03 + 0.008], [0.004, 0.008], [zb + 0.1, zb + 0.114], o));
    return parts;
  },
  brand: brand('Xiaomi', 'B106GL', 'Robot Vacuum S10', 'https://www.mi.com/vn/product/xiaomi-robot-vacuum-s10/specs/', [
    ['Robot', '350 mm round × 94.5 mm'],
    ['Dock', '≈ 130 × 126 × 93 mm'],
    ['Suction', '4000 Pa, 300 ml bin, 170 ml tank'],
  ]),
});

/** Station body helper: a tall rounded tower with a lid, a front panel and a base ramp. */
function station(p: Part[], w: number, sd: number, sh: number, zb: number, s: { body: string; top: string; dark: string; light: string }, look: { lidH: number; tanks: boolean; display: boolean; recess: number }) {
  const zf = zb + sd;
  p.push(span(s.body, [-w / 2, w / 2], [0, sh - look.lidH], [zb, zf], { bevel: 0.03 }));
  p.push(span(s.top, [-w / 2 + 0.004, w / 2 - 0.004], [sh - look.lidH, sh], [zb + 0.004, zf - 0.004], { bevel: 0.03 }));
  // Recess where the robot drives in, with the dark wash tray.
  p.push(span(s.dark, [-w / 2 + 0.035, w / 2 - 0.035], [0.012, look.recess], [zf - 0.2, zf + 0.002], { bevel: 0.01, plan: false }));
  p.push(span(s.body, [-w / 2 + 0.01, w / 2 - 0.01], [0, 0.012], [zf - 0.05, zf + 0.04], { bevel: 0.004, plan: false }));
  // Front panel seam and a lid seam.
  p.push(span(s.dark, [-w / 2 + 0.02, w / 2 - 0.02], [sh - look.lidH - 0.003, sh - look.lidH], [zf - 0.001, zf + 0.0008], o));
  if (look.tanks) for (const sx of [-1, 1]) p.push(span(s.top, [sx > 0 ? 0.004 : -w / 2 + 0.03, sx > 0 ? w / 2 - 0.03 : -0.004], [look.recess + 0.04, sh - look.lidH - 0.03], [zf - 0.002, zf + 0.0008], { bevel: 0.006, plan: false }));
  if (look.display) p.push(span(s.light, [-0.025, 0.025], [sh - look.lidH - 0.03, sh - look.lidH - 0.022], [zf, zf + 0.001], o));
  // Lid handle recess.
  p.push(span(s.dark, [-0.04, 0.04], [sh - 0.002, sh], [zf - 0.06, zf - 0.03], o));
}

const STATION_SLOTS = [matSlot('body', 'Robot & station', 'hx-gloss-white'), matSlot('top', 'Lid & covers', 'hx-matte-white'), matSlot('dark', 'Bumper, turret & tray', 'hx-matte-charcoal'), matSlot('led', 'Lights', 'hx-led-white')];

const robotX10 = defineItem({
  id: 'xiaomi-robot-vacuum-x10-plus',
  name: 'Xiaomi Robot Vacuum X10+ with base station',
  category: 'laundry',
  type: 'appliances',
  group: 'Cleaning',
  tags: [...ROBOT_TAGS, 'xiaomi', 'lidar', 'self-emptying', 'tự đổ rác', 'mop washing', 'robot'],
  description: 'White Xiaomi LiDAR robot docked in its tall all-in-one station, which empties the bin into a dust bag, washes and dries the mop pads and refills from clean and dirty water tanks under the top lid.',
  ...fixed(0.423, 0.52, 0.568),
  wallSnap: true,
  slots: STATION_SLOTS,
  build: ({ w, d, h }) => {
    const sd = 0.34;
    const zb = -d / 2;
    const p: Part[] = [];
    station(p, w, sd, h, zb, { body: 'body', top: 'top', dark: 'dark', light: 'led' }, { lidH: 0.06, tanks: true, display: true, recess: 0.12 });
    p.push(...robotVac(0, zb + sd, 0.175, 0.097));
    return p;
  },
  brand: brand('Xiaomi', 'B101GL (BHR6363EU)', 'Robot Vacuum X10+', 'https://www.mi.com/global/product/xiaomi-robot-vacuum-x10-plus/specs/', [
    ['Robot', '350 × 350 × 97 mm, 3.8 kg'],
    ['Station (W × D × H)', '423 × 340 × 568 mm, ≈ 8.3 kg'],
    ['Station', 'Auto-empty, mop washing and drying'],
  ]),
});

const roborockS8 = defineItem({
  id: 'roborock-s8-pro-ultra',
  name: 'Roborock S8 Pro Ultra with RockDock Ultra',
  category: 'laundry',
  type: 'appliances',
  group: 'Cleaning',
  tags: [...ROBOT_TAGS, 'roborock', 'lidar', 'self-emptying', 'tự đổ rác', 'mop washing', 'robot'],
  description: 'Roborock flagship robot vacuum-mop parked inside its RockDock Ultra: a squared-off dock with twin water tanks behind a front cover, a lift-up lid and a wash tray the robot backs into.',
  ...fixed(0.426, 0.5, 0.514),
  wallSnap: true,
  slots: [matSlot('body', 'Robot & dock', 'hx-gloss-black'), matSlot('top', 'Lid & covers', 'hx-matte-black'), matSlot('dark', 'Bumper, turret & tray', 'hx-matte-charcoal'), matSlot('led', 'Lights', 'hx-led-white')],
  variants: finishes(['white', 'White', { body: 'hx-gloss-white', top: 'hx-matte-white' }]),
  build: ({ w, d, h }) => {
    const sd = 0.45;
    const zb = -d / 2;
    const p: Part[] = [];
    station(p, w, sd, h, zb, { body: 'body', top: 'top', dark: 'dark', light: 'led' }, { lidH: 0.05, tanks: true, display: false, recess: 0.13 });
    p.push(...robotVac(0, d / 2 - 0.1765, 0.1765, 0.0965, undefined, { turret: 0.03 }));
    return p;
  },
  brand: brand('Roborock', 'S8 Pro Ultra', 'S8 Pro Ultra + RockDock Ultra', 'https://cellphones.com.vn/robot-hut-bui-lau-nha-roborock-s8-pro-ultra.html', [
    ['Robot', '353 × 350 × 96.5 mm, 4.8 kg'],
    ['Dock (W × D × H)', '426 × 450 × 514 mm, 9.6 kg'],
    ['Colours', 'Black, White'],
  ]),
});

const deebotT30 = defineItem({
  id: 'ecovacs-deebot-t30-omni',
  name: 'Ecovacs Deebot T30 Omni with Omni station',
  category: 'laundry',
  type: 'appliances',
  group: 'Cleaning',
  tags: [...ROBOT_TAGS, 'ecovacs', 'deebot', 'lidar', 'self-emptying', 'tự đổ rác', 'hot water mop', 'robot'],
  description: 'White Ecovacs robot vacuum-mop with its compact Omni station: a rounded tower with a glossy front, hot-water mop washing in the base tray and a dust bag under the lid.',
  ...fixed(0.409, 0.55, 0.48),
  wallSnap: true,
  slots: STATION_SLOTS,
  build: ({ w, d, h }) => {
    const sd = 0.42;
    const zb = -d / 2;
    const p: Part[] = [];
    station(p, w, sd, h, zb, { body: 'body', top: 'top', dark: 'dark', light: 'led' }, { lidH: 0.07, tanks: false, display: true, recess: 0.12 });
    // Rounded shoulders: two half-cylinders softening the front corners.
    for (const s of [-1, 1]) p.push(vcyl('body', s * (w / 2 - 0.05), zb + sd - 0.05, 0.13, h - 0.07, 0.05, { segments: 20, plan: false }));
    p.push(...robotVac(0, d / 2 - 0.1765, 0.1765, 0.099));
    return p;
  },
  brand: brand('Ecovacs', 'Deebot T30 Omni', 'Deebot T30 Omni', 'https://meta.vn/robot-hut-bui-lau-nha-ecovacs-deebot-t30-omni-p109034', [
    ['Robot', '353 × 351 × 99 mm, 4.1 kg'],
    ['Station (W × D × H)', '409 × 490 × 480 mm, 10.4 kg'],
  ]),
});

// ---------------------------------------------------------------------------
// Air purifiers, humidifiers, dehumidifier
// ---------------------------------------------------------------------------

const AIR_TAGS = ['branded', 'vietnam', 'climate', 'smart home', 'electronics'];
const PURIFIER = ['máy lọc không khí', 'air purifier', 'hepa'];

/**
 * Top outlet grille: concentric slots (rings) across a disc at height y, the top surface of the body
 * it sits in. The disc stands 0.8 mm proud of that surface (coplanar faces of two slots flicker).
 */
function radialOutlet(p: Part[], x: number, y: number, z: number, r: number, slotDark: string, slotRing: string, n = 6) {
  p.push(cyl(slotDark, [x, y - 0.0016, z], r, 0.0048, { segments: 40, plan: false }));
  for (const i of range(n)) p.push(ring(slotRing, [x, y, z], (r * (i + 1)) / (n + 0.6), 0.0018, o));
  p.push(cyl(slotRing, [x, y + 0.0005, z], r * 0.12, 0.002, { segments: 24, plan: false }));
}

const ap4Lite = defineItem({
  id: 'xiaomi-smart-air-purifier-4-lite',
  name: 'Xiaomi Smart Air Purifier 4 Lite',
  category: 'bedroom',
  type: 'electronics',
  group: 'Climate',
  tags: [...AIR_TAGS, ...PURIFIER, 'xiaomi', 'mi home'],
  description: 'Square white Xiaomi purifier column with soft corners, perforated intake on all four sides, a dark round outlet grille on top and a small LED display at the top front.',
  ...fixed(0.24, 0.24, 0.5335),
  slots: [matSlot('body', 'Body', 'hx-perforated-white'), matSlot('top', 'Top & base band', 'hx-matte-white'), matSlot('grille', 'Outlet grille', 'hx-grille-dark'), matSlot('screen', 'Display', 'hx-display')],
  build: ({ w, d, h }) => {
    const p: Part[] = [
      slab('top', 0, 0, w - 0.004, d - 0.004, 0.035, 0, 0.03),
      slab('body', 0, 0, w, d, 0.036, 0.03, h - 0.09),
      slab('top', 0, 0, w, d, 0.036, h - 0.06, 0.055, false),
      slab('top', 0, 0, w - 0.01, d - 0.01, 0.032, h - 0.007, 0.005, false),
    ];
    radialOutlet(p, 0, h - 0.002, -0.012, 0.085, 'grille', 'top');
    p.push(span('screen', [-0.025, 0.025], [h - 0.045, h - 0.022], [d / 2 - 0.001, d / 2 + 0.0008], { bevel: 0.002, plan: false }));
    p.push(cyl('screen', [0, h - 0.0012, d / 2 - 0.022], 0.006, 0.002, { segments: 16, plan: false }));
    return p;
  },
  brand: brand('Xiaomi', 'AC-M17-SC (BHR5274GL)', 'Smart Air Purifier 4 Lite', 'https://www.mi.com/vn/product/xiaomi-smart-air-purifier-4-lite/specs/', [
    ['Size (W × D × H)', '240 × 240 × 533.5 mm'],
    ['Weight', '4.8 kg'],
    ['Filter', 'HEPA, 360° intake'],
  ]),
});

const ap4Pro = defineItem({
  id: 'xiaomi-smart-air-purifier-4-pro',
  name: 'Xiaomi Smart Air Purifier 4 Pro',
  category: 'living',
  type: 'electronics',
  group: 'Climate',
  tags: [...AIR_TAGS, ...PURIFIER, 'xiaomi', 'mi home', 'oled'],
  description: 'Tall cylindrical Xiaomi purifier with a perforated 360° intake, a round OLED readout and touch keys high on the front, and a wide outlet grille on top.',
  ...fixed(0.275, 0.275, 0.68),
  slots: [matSlot('body', 'Body', 'hx-perforated-white'), matSlot('top', 'Top, panel & base', 'hx-matte-white'), matSlot('grille', 'Outlet grille', 'hx-grille-dark'), matSlot('screen', 'Display', 'hx-display')],
  build: ({ w, h }) => {
    const r = w / 2;
    const p: Part[] = [
      tower('top', 0, 0, [[0, 0], [r * 0.95, 0], [r, 0.012], [r, 0.04], [0, 0.04]], 48),
      tower('body', 0, 0, [[0, 0.04], [r, 0.04], [r, h - 0.09], [0, h - 0.09]], 48, false),
      tower('top', 0, 0, [[0, h - 0.09], [r, h - 0.09], [r, h - 0.012], [r * 0.97, h - 0.002], [0, h - 0.002]], 48, false),
      // Front panel band around the display.
      lathe('top', [0, h * 0.62, 0], [[r + 0.0015, 0], [r + 0.0015, 0.13], [r - 0.004, 0.13], [r - 0.004, 0]], { segments: 48, plan: false, rotation: [0, 0, 0] }),
      discZ('screen', [0, h * 0.62 + 0.075, r - 0.002], 0.032, 0.008, { segments: 36, plan: false }),
    ];
    for (const i of range(3)) p.push(discZ('grille', [-0.024 + i * 0.024, h * 0.62 + 0.024, r + 0.0005], 0.0045, 0.003, { segments: 12, plan: false }));
    radialOutlet(p, 0, h - 0.002, 0, r * 0.82, 'grille', 'top', 7);
    return p;
  },
  brand: brand('Xiaomi', 'AC-M15-SC (BHR8949GL)', 'Smart Air Purifier 4 Pro', 'https://fptshop.com.vn/may-loc-khong-khi/xiaomi-smart-air-purifier-4-pro-bhr8949gl-50w', [
    ['Size', '275 × 275 × 680 mm'],
    ['Weight', '≈ 6.8 kg'],
    ['Display', 'Round OLED: PM2.5, PM10, temperature, humidity'],
  ]),
});

const sharpKc = defineItem({
  id: 'sharp-kc-g40ev-w',
  name: 'Sharp KC-G40EV-W purifier & humidifier',
  category: 'bedroom',
  type: 'electronics',
  group: 'Climate',
  tags: [...AIR_TAGS, ...PURIFIER, 'sharp', 'plasmacluster', 'humidifier', 'tạo ẩm'],
  description: 'White Sharp Plasmacluster purifier-humidifier: a tall box with a rounded front, a louvred outlet across the top back, a control strip on top and the humidifier water tank slotted into the side.',
  ...fixed(0.345, 0.262, 0.631),
  wallSnap: true,
  slots: [matSlot('body', 'Body', 'hx-gloss-white'), matSlot('grille', 'Intake & outlet', 'hx-perforated-grey'), matSlot('tank', 'Water tank', 'hx-smoke'), matSlot('screen', 'Controls & lights', 'hx-display')],
  build: ({ w, d, h }) => {
    const zf = d / 2;
    const p: Part[] = [
      // Body: square back, rounded front (a prism from a rounded outline).
      prism('body', [...roundRectPoints(0, 0, w, d, 0.02, 4).filter(([, z]) => z < 0), ...range(13).map((i) => { const a = (i / 12) * Math.PI; return [Math.cos(a) * (w / 2), zf - d * 0.12 + Math.sin(a) * d * 0.12] as V2; })], 0.008, h - 0.008),
      slab('grille', 0, 0, w - 0.03, d - 0.03, 0.02, 0, 0.008, false),
      // Outlet louvres across the top back.
      span('grille', [-w / 2 + 0.03, w / 2 - 0.03], [h - 0.0015, h + 0.0], [-d / 2 + 0.02, 0.02], o),
      ...range(7).map((i) => span('body', [-w / 2 + 0.03, w / 2 - 0.03], [h - 0.004, h], [-d / 2 + 0.03 + i * 0.022, -d / 2 + 0.034 + i * 0.022], o)),
      // Control strip on the top front.
      span('screen', [-w / 2 + 0.06, w / 2 - 0.06], [h - 0.0018, h], [0.04, zf - 0.035], { bevel: 0.002, plan: false }),
      // Rear intake grille (seen from the back) and the side water tank.
      span('grille', [-w / 2 + 0.03, w / 2 - 0.03], [0.06, h - 0.1], [-d / 2 - 0.0008, -d / 2 + 0.002], o),
      span('tank', [w / 2 - 0.002, w / 2 + 0.0], [0.05, 0.3], [-d / 2 + 0.04, zf - 0.07], o),
      span('screen', [w / 2 - 0.0015, w / 2], [0.28, 0.295], [-0.02, 0.04], o),
    ];
    return p;
  },
  brand: brand('Sharp', 'KC-G40EV-W', 'Plasmacluster purifier with humidifier', 'https://meta.vn/may-loc-khong-khi-va-tao-am-sharp-kc-g40ev-w-p57417', [
    ['Size (W × D × H)', '345 × 262 × 631 mm'],
    ['Weight', '9.2 kg'],
    ['Humidifying', '400 ml/h, 2.5 L tank, rooms to 28 m²'],
  ]),
});

const daikinMck = defineItem({
  id: 'daikin-mck55tvm6',
  name: 'Daikin MCK55TVM6 purifier & humidifier',
  category: 'living',
  type: 'electronics',
  group: 'Climate',
  tags: [...AIR_TAGS, ...PURIFIER, 'daikin', 'streamer', 'humidifier', 'tạo ẩm'],
  description: 'Tall white Daikin Streamer purifier-humidifier with intake grilles on the front and both sides, a slotted outlet across the top, a display strip and a water tray at the back.',
  ...fixed(0.27, 0.27, 0.718),
  wallSnap: true,
  slots: [matSlot('body', 'Body', 'hx-gloss-white'), matSlot('grille', 'Intake grilles', 'hx-perforated-grey'), matSlot('top', 'Outlet', 'hx-matte-charcoal'), matSlot('screen', 'Display', 'hx-display')],
  build: ({ w, d, h }) => {
    const p: Part[] = [
      slab('body', 0, 0, w, d, 0.03, 0.012, h - 0.012),
      slab('top', 0, 0, w - 0.012, d - 0.012, 0.025, 0, 0.012, false),
      // Front and side intake panels.
      span('grille', [-w / 2 + 0.03, w / 2 - 0.03], [0.05, h - 0.17], [d / 2 - 0.002, d / 2 + 0.0008], o),
      span('grille', [-w / 2 - 0.0008, -w / 2 + 0.002], [0.05, h - 0.17], [-d / 2 + 0.04, d / 2 - 0.04], o),
      span('grille', [w / 2 - 0.002, w / 2 + 0.0008], [0.05, h - 0.17], [-d / 2 + 0.04, d / 2 - 0.04], o),
      // Top outlet with slots and the display strip at the front.
      span('top', [-w / 2 + 0.03, w / 2 - 0.03], [h - 0.0015, h], [-d / 2 + 0.03, d / 2 - 0.08], o),
      ...range(6).map((i) => span('body', [-w / 2 + 0.035, w / 2 - 0.035], [h - 0.003, h], [-d / 2 + 0.04 + i * 0.025, -d / 2 + 0.046 + i * 0.025], o)),
      span('screen', [-w / 2 + 0.04, w / 2 - 0.04], [h - 0.0018, h], [d / 2 - 0.065, d / 2 - 0.025], { bevel: 0.002, plan: false }),
      span('screen', [-0.04, 0.04], [h - 0.13, h - 0.11], [d / 2 - 0.001, d / 2 + 0.0008], o),
      // Water tray handle at the back.
      span('top', [-0.05, 0.05], [0.07, 0.09], [-d / 2 - 0.0008, -d / 2 + 0.002], o),
    ];
    return p;
  },
  brand: brand('Daikin', 'MCK55TVM6', 'Streamer purifier with humidifier', 'https://hoanghamobile.com/may-loc-khong-khi/may-loc-khong-khi-daikin-mck55tvm6-chinh-hang', [
    ['Size (W × D × H)', '270 × 270 × 718 mm'],
    ['Weight', '9.5 kg'],
    ['Technology', 'Streamer, HEPA, humidifying tray'],
  ]),
});

const dysonTp07 = defineItem({
  id: 'dyson-purifier-cool-tp07',
  name: 'Dyson Purifier Cool TP07',
  category: 'living',
  type: 'electronics',
  group: 'Climate',
  tags: [...AIR_TAGS, ...PURIFIER, 'dyson', 'fan', 'quạt không cánh', 'bladeless', 'air multiplier', 'tower'],
  description: 'Dyson bladeless purifier fan: a perforated round base holding the filter, an LCD on its front, and a tall open oval loop on top that projects the air, with the magnetic remote docked on the top.',
  ...fixed(0.22, 0.22, 1.05),
  slots: [matSlot('body', 'Loop & base', 'hx-gloss-white'), matSlot('metal', 'Perforated filter shroud', 'hx-perforated-silver'), matSlot('trim', 'Trim & remote', 'hx-silver'), matSlot('screen', 'Display', 'hx-display')],
  variants: finishes(['black-nickel', 'Black/Nickel', { body: 'hx-gloss-black', metal: 'hx-perforated-nickel', trim: 'hx-nickel' }]),
  build: ({ w, h }) => {
    const r = w / 2;
    const yb = 0.37; // top of the base
    const p: Part[] = [
      tower('body', 0, 0, [[0, 0], [r * 0.96, 0], [r, 0.012], [r, 0.03], [0, 0.03]], 48),
      tower('metal', 0, 0, [[0, 0.03], [r, 0.03], [r, yb - 0.03], [0, yb - 0.03]], 48, false),
      tower('body', 0, 0, [[0, yb - 0.03], [r, yb - 0.03], [r * 0.96, yb - 0.004], [r * 0.6, yb], [0, yb]], 48, false),
      span('screen', [-0.018, 0.018], [yb - 0.085, yb - 0.05], [r - 0.006, r + 0.0005], { bevel: 0.003, plan: false }),
      // Neck between the base and the loop.
      span('body', [-0.04, 0.04], [yb - 0.004, yb + 0.03], [-0.03, 0.03], { bevel: 0.015, plan: false }),
    ];
    // Loop: an upright oval ring, 204 mm wide by 120 deep across its slot.
    const lh = h - yb - 0.03;
    const lx = 0.102 - 0.014;
    const ly = lh / 2;
    const n = 24;
    for (const i of range(n)) {
      const a0 = (i / n) * TAU;
      const a1 = ((i + 1) / n) * TAU;
      const P = (a: number): V3 => [Math.cos(a) * lx, yb + 0.03 + ly + Math.sin(a) * (ly - 0.02), 0];
      p.push(rod('body', P(a0), P(a1), 0.016, { segments: 14, plan: false, scale: [1, 1, 3.4] }));
    }
    for (const i of range(n)) {
      const a = (i / n) * TAU;
      p.push(sphere('body', [Math.cos(a) * lx, yb + 0.03 + ly + Math.sin(a) * (ly - 0.02), 0], 0.016, { scale: [1, 1, 3.4], plan: false }));
    }
    // Remote docked on top of the loop.
    p.push(span('trim', [-0.02, 0.02], [h - 0.012, h], [-0.03, 0.03], { bevel: 0.005, plan: false }));
    return p;
  },
  brand: brand('Dyson', 'TP07', 'Purifier Cool', 'https://www.dyson.vn/en-VN/dyson-purifier-cool-white-silver', [
    ['Height', '1050 mm'],
    ['Base', '≈ 220 mm round; loop ≈ 204 × 120 mm'],
    ['Weight', '4.65 kg'],
    ['Colours', 'White/Silver, Black/Nickel'],
  ]),
});

const humidifier2 = defineItem({
  id: 'xiaomi-smart-humidifier-2',
  name: 'Xiaomi Smart Humidifier 2',
  category: 'bedroom',
  type: 'electronics',
  group: 'Climate',
  tags: [...AIR_TAGS, 'xiaomi', 'máy tạo ẩm', 'humidifier', 'ultrasonic', 'mist'],
  description: 'Round white Xiaomi ultrasonic humidifier: a 4.5 L top-fill tank behind a smoked window strip, the mist nozzle in the domed lid and a single button with a status light at the front.',
  ...fixed(0.19, 0.19, 0.335),
  defaultElevation: 0,
  slots: [matSlot('body', 'Body', 'hx-gloss-white'), matSlot('window', 'Water window', 'hx-smoke'), matSlot('trim', 'Nozzle & button', 'hx-silver'), matSlot('led', 'Status light', 'hx-led-white')],
  build: ({ w, h }) => {
    const r = w / 2;
    const p: Part[] = [
      tower('body', 0, 0, [[0, 0], [r * 0.92, 0], [r, 0.014], [r, h - 0.05], [r * 0.95, h - 0.02], [r * 0.75, h - 0.004], [0, h]], 48),
      // Water level window (a slim strip on the front).
      span('window', [-0.012, 0.012], [0.07, h * 0.62], [r - 0.006, r + 0.0008], { bevel: 0.003, plan: false }),
      // Mist nozzle and the fill cap.
      lathe('trim', [0, h - 0.01, -0.02], [[0, 0], [0.024, 0], [0.022, 0.012], [0.012, 0.014], [0, 0.014]].map(([x, y]) => [x, y - 0.004] as V2), { segments: 28, plan: false }),
      cyl('window', [0, h + 0.001, -0.02], 0.009, 0.002, { segments: 16, plan: false }),
      discZ('trim', [0, h * 0.72, r - 0.003], 0.011, 0.006, { segments: 20, plan: false }),
      sphere('led', [0, h * 0.72 + 0.018, r - 0.002], 0.002, o),
    ];
    return p;
  },
  brand: brand('Xiaomi', 'MJJSQ05DY (BHR6026EU)', 'Smart Humidifier 2', 'https://www.mi.com/vn/product/xiaomi-smart-humidifier-2/specs/', [
    ['Size', '190 mm round × 335 mm'],
    ['Weight', '1.57 kg'],
    ['Tank', '4.5 L, 350 ml/h'],
  ]),
});

const dehumidifier = defineItem({
  id: 'xiaomi-smart-dehumidifier-22l',
  name: 'Xiaomi Smart Dehumidifier 22L',
  category: 'laundry',
  type: 'electronics',
  group: 'Climate',
  tags: [...AIR_TAGS, 'xiaomi', 'máy hút ẩm', 'dehumidifier', 'nồm', 'humidity', 'mi home'],
  description: 'Round white Xiaomi dehumidifier tower (22 L a day, made for the nồm season): perforated intake around the body, an outlet grille and touch display on top, and a pull-out 4.5 L water tank at the front.',
  ...fixed(0.3, 0.3, 0.66),
  slots: [matSlot('body', 'Body', 'hx-gloss-white'), matSlot('intake', 'Intake', 'hx-perforated-white'), matSlot('grille', 'Outlet grille & tank handle', 'hx-grille-dark'), matSlot('screen', 'Display', 'hx-display')],
  build: ({ w, h }) => {
    const r = w / 2;
    const p: Part[] = [
      tower('body', 0, 0, [[0, 0.012], [r * 0.95, 0.012], [r, 0.03], [r, 0.26], [0, 0.26]], 48),
      tower('intake', 0, 0, [[0, 0.26], [r, 0.26], [r, h - 0.08], [0, h - 0.08]], 48, false),
      tower('body', 0, 0, [[0, h - 0.08], [r, h - 0.08], [r, h - 0.02], [r * 0.95, h - 0.002], [0, h - 0.002]], 48, false),
      cyl('grille', [0, 0.006, 0], r * 0.85, 0.012, { segments: 32, plan: false }),
      // Tank front with its finger grip.
      lathe('body', [0, 0.04, 0], [[r + 0.0012, 0], [r + 0.0012, 0.19], [r - 0.004, 0.19], [r - 0.004, 0]], { segments: 48, plan: false }),
      span('grille', [-0.04, 0.04], [0.19, 0.205], [r - 0.012, r + 0.002], { bevel: 0.004, plan: false }),
    ];
    radialOutlet(p, 0, h - 0.002, -0.025, r * 0.62, 'grille', 'body', 6);
    p.push(span('screen', [-0.04, 0.04], [h - 0.0018, h], [r * 0.62, r * 0.88], { bevel: 0.003, plan: false }));
    return p;
  },
  brand: brand('Xiaomi', 'CSJ0114DM (BHR8121TH)', 'Smart Dehumidifier 22L', 'https://www.mi.com/vn/product/xiaomi-smart-dehumidifier/specs/', [
    ['Size', '300 mm round × 660 mm'],
    ['Weight', '13.2 kg'],
    ['Capacity', '22 L/day, 4.5 L tank, hidden castors'],
  ]),
});

// ---------------------------------------------------------------------------
// Heaters
// ---------------------------------------------------------------------------

const HEAT_TAGS = ['branded', 'vietnam', 'máy sưởi', 'heater', 'winter', 'climate', 'electronics'];

const heaterS = defineItem({
  id: 'xiaomi-smart-space-heater-s',
  name: 'Xiaomi Smart Space Heater S',
  category: 'bedroom',
  type: 'electronics',
  group: 'Climate',
  tags: [...HEAT_TAGS, 'xiaomi', 'convector', 'máy sưởi đối lưu', 'mi home'],
  description: 'Low wide white Xiaomi convector heater on two splayed feet: a smooth front panel with a slotted warm-air outlet along the top and a small touch display in the top right corner.',
  ...fixed(0.78, 0.216, 0.526),
  slots: [matSlot('body', 'Panel', 'hx-gloss-white'), matSlot('grille', 'Outlet slots', 'hx-grille-dark'), matSlot('feet', 'Feet', 'hx-matte-white'), matSlot('screen', 'Display', 'hx-display')],
  build: ({ w, d, h }) => {
    const pd = 0.075;
    const p: Part[] = [
      span('body', [-w / 2, w / 2], [0.1, h], [-pd / 2, pd / 2], { bevel: 0.02 }),
      span('grille', [-w / 2 + 0.05, w / 2 - 0.05], [h - 0.0015, h], [-pd / 2 + 0.012, pd / 2 - 0.012], o),
      ...range(9).map((i) => span('body', [-w / 2 + 0.05 + i * 0.075, -w / 2 + 0.054 + i * 0.075], [h - 0.003, h], [-pd / 2 + 0.012, pd / 2 - 0.012], o)),
      span('grille', [-w / 2 + 0.05, w / 2 - 0.05], [0.1, 0.104], [-pd / 2 + 0.012, pd / 2 - 0.012], o),
      span('screen', [w / 2 - 0.12, w / 2 - 0.04], [h - 0.06, h - 0.035], [pd / 2 - 0.001, pd / 2 + 0.0008], { bevel: 0.002, plan: false }),
    ];
    // Two feet: short posts on flat oval pads.
    for (const s of [-1, 1]) {
      const x = s * (w / 2 - 0.13);
      p.push(span('feet', [x - 0.02, x + 0.02], [0.02, 0.105], [-0.015, 0.015], { bevel: 0.008, plan: false }));
      p.push(slab('feet', x, 0, 0.05, d, 0.025, 0, 0.022));
    }
    return p;
  },
  brand: brand('Xiaomi', 'BHR4037GL', 'Smart Space Heater S', 'https://cellphones.com.vn/may-suoi-dien-smart-space-heater-s.html', [
    ['Size (W × D × H)', '780 × 216 × 526 mm with feet'],
    ['Weight', '5.7 kg'],
    ['Power', 'up to 2200 W, IPX4'],
  ]),
});

const fujieOfr = defineItem({
  id: 'fujie-ofr4411',
  name: 'FujiE OFR4411 oil-filled radiator',
  category: 'bedroom',
  type: 'electronics',
  group: 'Climate',
  tags: [...HEAT_TAGS, 'fujie', 'máy sưởi dầu', 'oil heater', 'radiator', '11 fins'],
  description: 'White eleven-fin oil-filled radiator on castors, with a control box and LED temperature display on one end and a fold-down clothes-drying rack over the top.',
  ...fixed(0.51, 0.24, 0.642),
  slots: [matSlot('body', 'Fins & control box', 'hx-enamel-white'), matSlot('trim', 'Castors & rack', 'hx-silver'), matSlot('dark', 'Base & knobs', 'hx-matte-charcoal'), matSlot('screen', 'Display', 'hx-display')],
  build: ({ w, d, h }) => {
    const n = 11;
    const cw = 0.075; // control box width
    const x0 = -w / 2 + 0.01;
    const x1 = w / 2 - cw;
    const pitch = (x1 - x0) / n;
    const ft = 0.024; // fin thickness
    const fd = 0.13; // fin depth
    const y0 = 0.075;
    const y1 = h - 0.045;
    const p: Part[] = [];
    for (const i of range(n)) {
      const x = x0 + pitch * (i + 0.5);
      p.push(span('body', [x - ft / 2, x + ft / 2], [y0, y1], [-fd / 2, fd / 2], { bevel: 0.011 }));
      // Pressed channels on each fin.
      p.push(span('body', [x - ft / 2 - 0.001, x + ft / 2 + 0.001], [y0 + 0.06, y1 - 0.06], [-0.012, 0.012], { bevel: 0.006, plan: false }));
    }
    // Header pipes joining the fins top and bottom.
    p.push(cylX('body', [(x0 + x1) / 2, y0 + 0.03, 0], 0.022, x1 - x0, { segments: 20, plan: false }), cylX('body', [(x0 + x1) / 2, y1 - 0.03, 0], 0.022, x1 - x0, { segments: 20, plan: false }));
    // Control box with display and knobs.
    p.push(span('body', [x1, w / 2 - 0.005], [y0, y1 - 0.02], [-0.06, 0.06], { bevel: 0.015 }));
    p.push(span('screen', [x1 + 0.012, w / 2 - 0.017], [y1 - 0.12, y1 - 0.08], [0.0595, 0.061], o));
    for (const k of range(2)) p.push(discZ('dark', [(x1 + w / 2) / 2, y1 - 0.18 - k * 0.07, 0.062], 0.016, 0.012, { segments: 20, plan: false }));
    // Base: two cross bars with four castors.
    for (const sx of [-1, 1]) {
      const x = sx * (w / 2 - 0.1);
      p.push(span('dark', [x - 0.02, x + 0.02], [0.035, 0.05], [-d / 2 + 0.02, d / 2 - 0.02], { bevel: 0.006 }));
      for (const sz of [-1, 1]) {
        p.push(vcyl('trim', x, sz * (d / 2 - 0.035), 0.02, 0.035, 0.006, { segments: 8, plan: false }));
        p.push(cylX('dark', [x, 0.018, sz * (d / 2 - 0.035)], 0.018, 0.02, { segments: 16, plan: false }));
      }
    }
    // Drying rack: a hinged wire frame over the top.
    const ry = h - 0.006;
    p.push(rod('trim', [x0 + 0.01, ry, -d / 2 + 0.03], [x1 - 0.01, ry, -d / 2 + 0.03], 0.004, { segments: 8, plan: false }), rod('trim', [x0 + 0.01, ry, d / 2 - 0.03], [x1 - 0.01, ry, d / 2 - 0.03], 0.004, { segments: 8, plan: false }));
    for (const i of range(6)) {
      const x = x0 + 0.01 + (i / 5) * (x1 - x0 - 0.02);
      p.push(wire('trim', [x, ry, -d / 2 + 0.03], [x, ry, d / 2 - 0.03], 0.003));
    }
    for (const sx of [x0 + 0.01, x1 - 0.01]) p.push(wire('trim', [sx, ry, 0], [sx, y1 - 0.01, 0], 0.004));
    return p;
  },
  brand: brand('FujiE', 'OFR4411', 'Oil-filled radiator, 11 fins, 2500 W', 'https://fptshop.com.vn/thiet-bi-suoi-am/may-suoi-dau-fujie-11-thanh-ofr4411-2500w', [
    ['Size (W × D × H)', '510 × 240 × 642 mm'],
    ['Weight', '12.6 kg'],
    ['Power', '2500 W, 24 h timer'],
  ]),
});

// ---------------------------------------------------------------------------
// Routers & mesh Wi-Fi
// ---------------------------------------------------------------------------

const NET_TAGS = ['branded', 'vietnam', 'router', 'wifi', 'cục phát wifi', 'wifi 6', 'network', 'electronics'];

const xiaomiRouter = defineItem({
  id: 'xiaomi-router-ax3000t',
  name: 'Xiaomi Router AX3000T',
  category: 'office',
  type: 'electronics',
  group: 'Smart home',
  tags: [...NET_TAGS, 'xiaomi', 'mi router'],
  description: 'Low white Xiaomi Wi-Fi 6 router with a ventilated top, a status light at the front and four flat antennas standing up along the back.',
  ...fixed(0.172, 0.2088, 0.225),
  defaultElevation: 0.75,
  slots: [matSlot('body', 'Body', 'hx-gloss-white'), matSlot('ant', 'Antennas', 'hx-matte-white'), matSlot('vent', 'Vents & ports', 'hx-matte-charcoal'), matSlot('led', 'Status light', 'hx-led-white')],
  build: ({ w, d, h }) => {
    const bd = 0.13;
    const bz = 0.02;
    const bh = 0.045;
    const p: Part[] = [
      slab('body', 0, bz, w, bd, 0.02, 0.004, bh - 0.004),
      slab('vent', 0, bz, w - 0.04, bd - 0.04, 0.01, 0, 0.004, false),
      ...range(8).map((i) => span('vent', [-w / 2 + 0.03, w / 2 - 0.03], [bh - 0.0015, bh], [bz - bd / 2 + 0.025 + i * 0.011, bz - bd / 2 + 0.03 + i * 0.011], o)),
      sphere('led', [0, bh * 0.55, d / 2 - 0.0015], 0.002, o),
    ];
    // Four antennas on hinges along the back edge.
    for (const i of range(4)) {
      const x = -w / 2 + 0.02 + (i * (w - 0.04)) / 3;
      p.push(cylX('vent', [x, bh - 0.008, bz - bd / 2 + 0.006], 0.007, 0.022, { segments: 12, plan: false }));
      p.push(span('ant', [x - 0.009, x + 0.009], [bh, h - 0.002], [bz - bd / 2 - 0.006, bz - bd / 2 + 0.006], { bevel: 0.004, rotation: [-0.18, 0, 0], plan: false }));
    }
    // Ports on the back.
    for (const i of range(4)) p.push(span('vent', [-0.05 + i * 0.022, -0.036 + i * 0.022], [0.012, 0.026], [bz - bd / 2 - 0.0008, bz - bd / 2 + 0.002], o));
    return p;
  },
  brand: brand('Xiaomi', 'RD03 (AX3000T)', 'Router AX3000T', 'https://www.mi.com/vn/product/xiaomi-router-ax3000t/specs/', [
    ['Size (W × D × H)', '172 × 208.8 × 225 mm with antennas up'],
    ['Wi-Fi', 'Wi-Fi 6, AX3000, 4 antennas'],
  ]),
});

const archerAx73 = defineItem({
  id: 'tp-link-archer-ax73',
  name: 'TP-Link Archer AX73 router',
  category: 'office',
  type: 'electronics',
  group: 'Smart home',
  tags: [...NET_TAGS, 'tp-link', 'archer', 'gaming router'],
  description: 'Wide black TP-Link Wi-Fi 6 router with a ribbed, vented top, a row of status lights and six fold-up antennas: two on each side and two at the back.',
  ...fixed(0.2725, 0.17, 0.19),
  defaultElevation: 0.75,
  slots: [matSlot('body', 'Body', 'hx-gloss-black'), matSlot('ant', 'Antennas', 'hx-matte-black'), matSlot('vent', 'Vents & ports', 'hx-matte-charcoal'), matSlot('led', 'Status lights', 'hx-led-white')],
  build: ({ w, d, h }) => {
    const bw = w - 0.02;
    const bd = 0.1472;
    const bh = 0.0492;
    const bz = d / 2 - bd / 2;
    const p: Part[] = [
      // Body tapers towards the front; a raised ribbed top.
      prism('body', [[-bw / 2, bz - bd / 2], [bw / 2, bz - bd / 2], [bw / 2 - 0.02, bz + bd / 2], [-bw / 2 + 0.02, bz + bd / 2]], 0.006, bh - 0.012),
      prism('vent', [[-bw / 2 + 0.02, bz - bd / 2 + 0.012], [bw / 2 - 0.02, bz - bd / 2 + 0.012], [bw / 2 - 0.04, bz + bd / 2 - 0.02], [-bw / 2 + 0.04, bz + bd / 2 - 0.02]], bh - 0.012, 0.01, o),
      ...range(9).map((i) => span('body', [-bw / 2 + 0.03 + i * 0.006, bw / 2 - 0.03 - i * 0.006], [bh - 0.003, bh], [bz - bd / 2 + 0.018 + i * 0.012, bz - bd / 2 + 0.022 + i * 0.012], o)),
      slab('vent', 0, bz, bw - 0.06, bd - 0.05, 0.01, 0, 0.006, false),
    ];
    for (const i of range(6)) p.push(sphere('led', [-0.05 + i * 0.02, bh * 0.45, bz + bd / 2 - 0.0005], 0.0018, o));
    // Antennas: two per side, two at the back.
    const ants: [number, number][] = [[-w / 2 + 0.006, bz - 0.03], [-w / 2 + 0.006, bz + 0.03], [w / 2 - 0.006, bz - 0.03], [w / 2 - 0.006, bz + 0.03], [-0.05, -d / 2 + 0.006], [0.05, -d / 2 + 0.006]];
    for (const [x, z] of ants) {
      p.push(sphere('ant', [x, bh * 0.6, z], 0.008, o));
      p.push(span('ant', [x - 0.006, x + 0.006], [bh * 0.6, h], [z - 0.0055, z + 0.0055], { bevel: 0.004, plan: false }));
    }
    return p;
  },
  brand: brand('TP-Link', 'Archer AX73 (V2)', 'AX5400 dual-band Wi-Fi 6 router', 'https://www.tp-link.com/vn/home-networking/wifi-router/archer-ax73/', [
    ['Body (W × D × H)', '272.5 × 147.2 × 49.2 mm'],
    ['Antennas', '6 fixed, fold up'],
    ['Ports', '1 WAN, 4 LAN, USB 3.0'],
  ]),
});

const decoX50 = defineItem({
  id: 'tp-link-deco-x50',
  name: 'TP-Link Deco X50 mesh Wi-Fi unit',
  category: 'living',
  type: 'electronics',
  group: 'Smart home',
  tags: [...NET_TAGS, 'tp-link', 'deco', 'mesh', 'mesh wifi'],
  description: 'Small square white TP-Link mesh Wi-Fi unit with rounded corners, a vented dark top and a single status light; place one per room or floor.',
  ...fixed(0.11, 0.11, 0.114),
  defaultElevation: 0.75,
  slots: [matSlot('body', 'Body', 'hx-gloss-white'), matSlot('vent', 'Top & ports', 'hx-matte-charcoal'), matSlot('led', 'Status light', 'hx-led-white')],
  build: ({ w, d, h }) => [
    slab('body', 0, 0, w, d, 0.025, 0, h - 0.006),
    slab('vent', 0, 0, w - 0.012, d - 0.012, 0.02, h - 0.006, 0.006, false),
    ...range(5).map((i) => span('body', [-w / 2 + 0.02, w / 2 - 0.02], [h - 0.0015, h], [-d / 2 + 0.022 + i * 0.016, -d / 2 + 0.026 + i * 0.016], o)),
    sphere('led', [0, h - 0.016, d / 2 - 0.0012], 0.0022, o),
    ...range(3).map((i) => span('vent', [-0.03 + i * 0.022, -0.016 + i * 0.022], [0.012, 0.024], [-d / 2 - 0.0008, -d / 2 + 0.002], o)),
  ],
  brand: brand('TP-Link', 'Deco X50', 'AX3000 whole-home mesh Wi-Fi 6', 'https://www.tp-link.com/vn/home-networking/deco/deco-x50/', [
    ['Size (W × D × H)', '110 × 110 × 114 mm'],
    ['Ports', '3 × Gigabit'],
  ]),
});

// ---------------------------------------------------------------------------
// Small kitchen appliances
// ---------------------------------------------------------------------------

const KITCHEN_TAGS = ['branded', 'vietnam', 'kitchen', 'countertop', 'small appliance', 'đồ gia dụng'];

const kettle2 = defineItem({
  id: 'xiaomi-electric-kettle-2',
  name: 'Xiaomi Electric Kettle 2',
  category: 'kitchen',
  type: 'appliances',
  group: 'Small appliances',
  tags: [...KITCHEN_TAGS, 'xiaomi', 'ấm siêu tốc', 'bình đun', 'kettle', '1.7 lít'],
  description: 'White 1.7 L Xiaomi kettle: a smooth flared jug with a stainless-steel inner pot, a flip lid with a push button, a side handle with the switch, on a round power base.',
  ...fixed(0.227, 0.158, 0.262),
  defaultElevation: 0.9,
  slots: [matSlot('body', 'Body & handle', 'hx-gloss-white'), matSlot('base', 'Power base', 'hx-matte-white'), matSlot('trim', 'Lid button & switch', 'hx-silver'), matSlot('led', 'Indicator', 'hx-led-white')],
  build: ({ w, d, h }) => {
    const r = d / 2;
    const cx = (w / 2 - r) * -1; // jug sits left, handle to the right
    const p: Part[] = [
      tower('base', cx, 0, [[0, 0], [r * 0.98, 0], [r, 0.008], [r * 0.96, 0.022], [0, 0.022]], 40),
      tower('body', cx, 0, [[0, 0.022], [r * 0.92, 0.022], [r * 0.96, 0.03], [r * 0.9, h * 0.55], [r * 0.82, h - 0.03], [r * 0.8, h - 0.012], [0, h - 0.008]], 40, false),
      // Spout lip on the front left (away from the handle).
      span('body', [cx - r * 0.9, cx - r * 0.72], [h - 0.03, h - 0.012], [-0.018, 0.018], { bevel: 0.008, rotation: [0, 0, -0.25], plan: false }),
      // Lid and its button.
      cyl('body', [cx, h - 0.006, 0], r * 0.78, 0.008, { segments: 40, plan: false }),
      span('trim', [cx + r * 0.38, cx + r * 0.62], [h - 0.004, h], [-0.012, 0.012], { bevel: 0.004, plan: false }),
      // Handle: a tall loop on the right.
      span('body', [cx + r * 0.7, w / 2 - 0.004], [h - 0.05, h - 0.022], [-0.015, 0.015], { bevel: 0.012, plan: false }),
      span('body', [w / 2 - 0.028, w / 2], [h * 0.2, h - 0.03], [-0.016, 0.016], { bevel: 0.013, plan: false }),
      span('body', [cx + r * 0.85, w / 2 - 0.012], [h * 0.2, h * 0.2 + 0.024], [-0.014, 0.014], { bevel: 0.01, plan: false }),
      span('trim', [w / 2 - 0.026, w / 2 - 0.008], [h * 0.2 - 0.002, h * 0.2 + 0.01], [-0.008, 0.008], { bevel: 0.003, plan: false }),
      sphere('led', [w / 2 - 0.024, h * 0.22 + 0.014, 0.008], 0.002, o),
    ];
    return p;
  },
  brand: brand('Xiaomi', 'MJDSH04YM (BHR5927EU)', 'Electric Kettle 2, 1.7 L', 'https://mistore.se/en/collections/vendors/products/xiaomi-electric-kettle-2-eu', [
    ['Size (W × D × H)', '227 × 158 × 262 mm'],
    ['Weight', '1.2 kg'],
    ['Power', '1800 W, 1.7 L'],
  ]),
});

/** Drawer air fryer: rounded housing, front basket drawer with a handle, display on top. */
function airFryer({ w, d, h }: Size3, look: { round: number; window: boolean }): Part[] {
  const zf = d / 2 - 0.05; // front of the housing; the handle stands proud
  const p: Part[] = [
    slab('body', 0, (zf - d / 2) / 2, w, zf + d / 2, look.round, 0.012, h - 0.012),
    slab('trim', 0, (zf - d / 2) / 2, w - 0.02, zf + d / 2 - 0.02, look.round * 0.8, 0, 0.012, false),
    // Drawer front panel and its handle.
    span('drawer', [-w / 2 + 0.012, w / 2 - 0.012], [0.03, h * 0.58], [zf - 0.004, zf + 0.004], { bevel: 0.01, plan: false }),
    span('drawer', [-0.03, 0.03], [h * 0.22, h * 0.5], [zf, d / 2], { bevel: 0.014, plan: false }),
    span('drawer', [-0.026, 0.026], [h * 0.42, h * 0.5], [zf + 0.012, d / 2 - 0.003], { bevel: 0.01, plan: false }),
    // Display panel on the top front, the rear exhaust.
    span('screen', [-w * 0.28, w * 0.28], [h - 0.0018, h + 0.0], [zf - 0.11, zf - 0.02], { bevel: 0.003, plan: false }),
    span('trim', [-w * 0.3, w * 0.3], [h * 0.6, h * 0.85], [-d / 2 - 0.0008, -d / 2 + 0.003], o),
  ];
  if (look.window) p.push(span('screen', [-w * 0.2, w * 0.2], [h * 0.28, h * 0.45], [zf + 0.004, zf + 0.005], o));
  return p;
}

const philipsAirfryer = defineItem({
  id: 'philips-airfryer-hd9252',
  name: 'Philips Airfryer 3000 Series HD9252',
  category: 'kitchen',
  type: 'appliances',
  group: 'Small appliances',
  tags: [...KITCHEN_TAGS, 'philips', 'nồi chiên không dầu', 'air fryer', 'airfryer', '4.1 lít'],
  description: 'Black 4.1 L Philips drawer air fryer with a rounded housing, a pull-out basket with a big front handle and a touch display on the top.',
  ...fixed(0.264, 0.36, 0.295),
  defaultElevation: 0.9,
  slots: [matSlot('body', 'Housing', 'hx-gloss-black'), matSlot('drawer', 'Drawer & handle', 'hx-matte-black'), matSlot('trim', 'Feet & vents', 'hx-matte-charcoal'), matSlot('screen', 'Display', 'hx-display')],
  build: (size) => airFryer(size, { round: 0.07, window: false }),
  brand: brand('Philips', 'HD9252/90', 'Airfryer 3000 Series, 4.1 L', 'https://www.digitec.ch/en/s1/product/philips-airfryer-hd925290-410-l-fryers-13912569', [
    ['Size (W × D × H)', '264 × 360 × 295 mm'],
    ['Weight', '≈ 4.5 kg'],
    ['Capacity', '4.1 L, 1400 W'],
  ]),
});

const xiaomiAirfryer = defineItem({
  id: 'xiaomi-smart-air-fryer-6-5l',
  name: 'Xiaomi Smart Air Fryer 6.5L',
  category: 'kitchen',
  type: 'appliances',
  group: 'Small appliances',
  tags: [...KITCHEN_TAGS, 'xiaomi', 'nồi chiên không dầu', 'air fryer', '6.5 lít', 'mi home'],
  description: 'Squarish Xiaomi 6.5 L air fryer with soft corners, a viewing window in the basket drawer, a front handle and a touch display on top.',
  ...fixed(0.287, 0.389, 0.317),
  defaultElevation: 0.9,
  slots: [matSlot('body', 'Housing', 'hx-gloss-white'), matSlot('drawer', 'Drawer & handle', 'hx-matte-white'), matSlot('trim', 'Feet & vents', 'hx-matte-charcoal'), matSlot('screen', 'Display & window', 'hx-display')],
  variants: finishes(['black', 'Black', { body: 'hx-gloss-black', drawer: 'hx-matte-black' }]),
  build: (size) => airFryer(size, { round: 0.045, window: true }),
  brand: brand('Xiaomi', 'MAF10 (BHR7358EU)', 'Smart Air Fryer 6.5L', 'https://shop.halan.com/en/Xiaomi-Smart-Air-Fryer-65L-White-BHR7358EU/67f66d6cd18fa49f5a449899/p/2B', [
    ['Size (W × D × H)', '287 × 389 × 317 mm'],
    ['Weight', '5.4 kg'],
    ['Colours', 'White, Black'],
  ]),
});

const philipsBlender = defineItem({
  id: 'philips-blender-hr2041',
  name: 'Philips HR2041 blender',
  category: 'kitchen',
  type: 'appliances',
  group: 'Small appliances',
  tags: [...KITCHEN_TAGS, 'philips', 'máy xay sinh tố', 'blender', 'smoothie'],
  description: 'White Philips 450 W blender: a ribbed clear jug with a handle and a measuring cap on a compact motor base with a single dial.',
  ...fixed(0.164, 0.192, 0.377),
  defaultElevation: 0.9,
  slots: [matSlot('body', 'Motor base & lid', 'hx-gloss-white'), matSlot('jar', 'Jug', 'hx-clear'), matSlot('trim', 'Dial & blades', 'hx-silver'), matSlot('dark', 'Feet & cap', 'hx-matte-charcoal')],
  build: ({ w, d, h }) => {
    const bz = 0.01;
    const jr = 0.06;
    const p: Part[] = [
      // Motor base: a rounded block, narrower at the top.
      slab('body', 0, bz, w, w, 0.03, 0.008, 0.07),
      slab('body', 0, bz, w - 0.016, w - 0.016, 0.026, 0.078, 0.032, false),
      discZ('trim', [0, 0.055, bz + w / 2 - 0.01], 0.02, 0.014, { segments: 20, plan: false }),
      slab('dark', 0, bz, w - 0.02, w - 0.02, 0.025, 0, 0.008, false),
      // Jug: tapering, with ribs, the blade assembly and the lid.
      lathe('jar', [0, 0.11, bz], [[0, 0], [jr * 0.7, 0], [jr * 0.75, 0.03], [jr, h - 0.15], [jr * 1.02, h - 0.13], [0, h - 0.13]], { segments: 32, plan: false }),
      cyl('dark', [0, 0.118, bz], jr * 0.72, 0.016, { segments: 24, plan: false }),
      ...range(4).map((k) => wire('trim', [0, 0.14, bz], [Math.cos(k * 1.57) * 0.032, 0.142 + (k % 2) * 0.006, bz + Math.sin(k * 1.57) * 0.032], 0.003)),
      cyl('body', [0, h - 0.012, bz], jr * 1.05, 0.024, { segments: 32, plan: false }),
      cyl('dark', [0, h - 0.004, bz], 0.022, 0.008, { segments: 20, plan: false }),
      // Handle on the side.
      span('jar', [-0.012, 0.012], [0.16, h - 0.04], [bz - jr - 0.035, bz - jr - 0.012], { bevel: 0.008, plan: false }),
      rod('jar', [0, h - 0.045, bz - jr - 0.02], [0, h - 0.04, bz - jr + 0.004], 0.01, { segments: 10, plan: false }),
      rod('jar', [0, 0.17, bz - jr - 0.02], [0, 0.16, bz - jr + 0.01], 0.01, { segments: 10, plan: false }),
    ];
    for (const k of range(6)) {
      const a = (k / 6) * TAU;
      p.push(wire('jar', [Math.cos(a) * jr * 0.76, 0.145, bz + Math.sin(a) * jr * 0.76], [Math.cos(a) * jr, h - 0.135, bz + Math.sin(a) * jr], 0.0025));
    }
    void d;
    return p;
  },
  brand: brand('Philips', 'HR2041/10', 'Daily Collection blender, 450 W', 'https://www.dienmayxanh.com/may-xay-sinh-to/philips-hr2041-10', [
    ['Size (W × D × H)', '164 × 192 × 377 mm'],
    ['Power', '450 W'],
  ]),
});

// ---------------------------------------------------------------------------
// Smart speakers & displays
// ---------------------------------------------------------------------------

const SPEAKER_TAGS = ['branded', 'smart speaker', 'loa thông minh', 'smart home', 'voice assistant', 'electronics'];

const nestFabric = (...ids: string[]) =>
  finishes(
    ...([
      ['charcoal', 'Charcoal', 'hx-fabric-charcoal'],
      ['sage', 'Sage', 'hx-fabric-sage'],
      ['sand', 'Sand', 'hx-fabric-sand'],
      ['sky', 'Sky', 'hx-fabric-sky'],
      ['coral', 'Coral', 'hx-fabric-coral'],
      ['mist', 'Mist', 'hx-fabric-mist'],
    ] as const)
      .filter(([id]) => ids.includes(id))
      .map(([id, name, m]) => [id, name, { fabric: m, body: id === 'charcoal' ? 'hx-matte-charcoal' : 'hx-matte-white' }] as [string, string, Record<string, string>]),
  );

const nestAudio = defineItem({
  id: 'google-nest-audio',
  name: 'Google Nest Audio smart speaker',
  category: 'living',
  type: 'electronics',
  group: 'Smart home',
  tags: [...SPEAKER_TAGS, 'google', 'nest', 'google assistant'],
  description: 'Tall soft-edged Google smart speaker wrapped all round in recycled knit fabric, with four status lights behind the fabric and a rubber foot.',
  ...fixed(0.124, 0.078, 0.175),
  defaultElevation: 0.75,
  slots: [matSlot('fabric', 'Fabric', 'hx-fabric-chalk'), matSlot('body', 'Foot & switch', 'hx-matte-white'), matSlot('led', 'Status lights', 'hx-led-white')],
  variants: nestFabric('charcoal', 'sage', 'sand', 'sky'),
  build: ({ w, d, h }) => {
    const parts: Part[] = [
      // Fabric body: a tall rounded slab, softer at the top than at the foot.
      span('fabric', [-w / 2, w / 2], [0.006, h], [-d / 2, d / 2], { bevel: 0.034 }),
      slab('body', 0, 0, w - 0.03, d - 0.026, 0.02, 0, 0.007),
      // Mic switch and power socket on the back.
      span('body', [w / 2 - 0.03, w / 2 - 0.018], [h - 0.05, h - 0.044], [-d / 2 - 0.0005, -d / 2 + 0.004], { bevel: 0.001, plan: false }),
      cyl('body', [0, 0.03, -d / 2 + 0.003], 0.006, 0.004, { rotation: [Math.PI / 2, 0, 0], segments: 12, plan: false }),
    ];
    // Four lights in a row behind the fabric, near the top of the front.
    for (const i of range(4)) parts.push(sphere('led', [-0.0165 + i * 0.011, h - 0.045, d / 2 - 0.004], 0.0028, o));
    return parts;
  },
  brand: brand('Google', 'GA01420', 'Nest Audio', 'https://store.google.com/product/nest_audio_specs', [
    ['Size (W × D × H)', '124 × 78 × 175 mm'],
    ['Weight', '1.2 kg'],
    ['Drivers', '75 mm woofer, 19 mm tweeter'],
    ['Colours', 'Chalk, Charcoal, Sage, Sand, Sky'],
  ]),
});

const nestMini = defineItem({
  id: 'google-nest-mini-2',
  name: 'Google Nest Mini (2nd gen)',
  category: 'bedroom',
  type: 'electronics',
  group: 'Smart home',
  tags: [...SPEAKER_TAGS, 'google', 'nest mini', 'google assistant', 'bedside'],
  description: 'Small round Google speaker: a fabric-topped puck on a plastic base, with touch lights under the fabric and a wall-mount notch.',
  ...fixed(0.098, 0.098, 0.042),
  defaultElevation: 0.55,
  slots: [matSlot('fabric', 'Fabric top', 'hx-fabric-chalk'), matSlot('body', 'Base', 'hx-matte-white'), matSlot('led', 'Lights', 'hx-led-white')],
  variants: nestFabric('charcoal', 'coral', 'sky'),
  build: ({ w, h }) => {
    const r = w / 2;
    const parts: Part[] = [
      tower('body', 0, 0, [[0, 0], [r * 0.86, 0], [r * 0.97, 0.004], [r, 0.012], [r, 0.018], [0, 0.018]], 48),
      tower('fabric', 0, 0, [[0, 0.017], [r, 0.017], [r * 0.99, 0.024], [r * 0.93, h * 0.82], [r * 0.78, h * 0.96], [r * 0.5, h], [0, h]], 48, false),
      // Rubber foot ring and the wall-mount notch.
      ring('body', [0, 0.001, 0], r * 0.62, 0.0015, o),
      span('body', [-0.01, 0.01], [0.004, 0.012], [-r + 0.004, -r + 0.016], { plan: false }),
      // Mic switch on the side.
      span('body', [r - 0.004, r + 0.0005], [0.007, 0.012], [-0.006, 0.006], { bevel: 0.001, plan: false }),
    ];
    for (const i of range(4)) parts.push(sphere('led', [-0.021 + i * 0.014, h - 0.0015, 0], 0.0022, o));
    return parts;
  },
  planDetail: ({ w }) => [circle([0, 0], w * 0.3)],
  brand: brand('Google', 'H2C', 'Nest Mini, 2nd generation', 'https://store.google.com/product/google_nest_mini_specs', [
    ['Size', '98 mm diameter × 42 mm'],
    ['Weight', '181 g'],
    ['Colours', 'Chalk, Charcoal, Coral, Sky'],
  ]),
});

const nestHub = defineItem({
  id: 'google-nest-hub-2',
  name: 'Google Nest Hub (2nd gen) smart display',
  category: 'kitchen',
  type: 'electronics',
  group: 'Smart home',
  tags: [...SPEAKER_TAGS, 'google', 'nest hub', 'smart display', 'màn hình thông minh', 'photo frame'],
  description: '7-inch Google smart display: a white-framed touch screen that seems to float in front of a fabric-covered speaker base.',
  ...fixed(0.1774, 0.0697, 0.1204),
  defaultElevation: 0.9,
  slots: [matSlot('fabric', 'Speaker fabric', 'hx-fabric-chalk'), matSlot('body', 'Screen frame', 'hx-gloss-white'), matSlot('screen', 'Screen', 'hx-display'), matSlot('trim', 'Back & foot', 'hx-matte-white')],
  variants: finishes(
    ['charcoal', 'Charcoal', { fabric: 'hx-fabric-charcoal', body: 'hx-gloss-charcoal', trim: 'hx-matte-charcoal' }],
    ['sand', 'Sand', { fabric: 'hx-fabric-sand' }],
    ['mist', 'Mist', { fabric: 'hx-fabric-mist' }],
  ),
  build: ({ w, d, h }) => {
    // Speaker base: a fabric half-round lying across the back, the screen leaning on its front.
    const zb = -d / 2;
    const br = 0.034;
    const tilt = 0.26; // screen leans back ≈ 15°
    const sh = h - 0.006;
    const sd = 0.009;
    const zs = d / 2 - 0.006 - Math.sin(tilt) * sh * 0.5; // screen centre z
    const parts: Part[] = [
      cylX('fabric', [0, br, zb + br + 0.004], br, w - 0.02, { segments: 32 }),
      span('fabric', [-w / 2 + 0.012, w / 2 - 0.012], [0, 0.03], [zb + 0.01, zb + br * 2], { bevel: 0.012 }),
      span('trim', [-w / 2 + 0.03, w / 2 - 0.03], [0, 0.004], [zb + 0.012, d / 2 - 0.012], { bevel: 0.002 }),
      // Screen panel (frame and glass), tilted back.
      { ...span('body', [-w / 2, w / 2], [-sh / 2, sh / 2], [-sd / 2, sd / 2], { bevel: 0.006 }), position: [0, 0.006 + (sh / 2) * Math.cos(tilt), zs], rotation: [-tilt, 0, 0] } as Part,
      { ...span('screen', [-w / 2 + 0.012, w / 2 - 0.012], [-sh / 2 + 0.012, sh / 2 - 0.012], [-0.001, 0.001], {}), position: [0, 0.006 + (sh / 2) * Math.cos(tilt), zs + sd / 2], rotation: [-tilt, 0, 0], plan: false } as Part,
      // Ambient light sensor and camera-less top bezel dot.
      sphere('trim', [0, 0.006 + sh * Math.cos(tilt) - 0.007, zs + sd / 2 - Math.sin(tilt) * (sh / 2 - 0.007) + 0.0005], 0.0018, o),
      // Volume rocker and mic switch on the back right.
      span('trim', [w / 2 - 0.035, w / 2 - 0.022], [h * 0.62, h * 0.66], [zs - 0.03, zs - 0.024], { bevel: 0.001, plan: false }),
    ];
    return parts;
  },
  brand: brand('Google', 'GA01331', 'Nest Hub, 2nd generation', 'https://store.google.com/product/nest_hub_2nd_gen_specs', [
    ['Size (W × H × D)', '177.4 × 120.4 × 69.7 mm'],
    ['Weight', '558 g'],
    ['Screen', '7-inch touch screen, 1024 × 600'],
    ['Colours', 'Chalk, Charcoal, Sand, Mist'],
  ]),
});

const homePodMini = defineItem({
  id: 'apple-homepod-mini',
  name: 'Apple HomePod mini',
  category: 'living',
  type: 'electronics',
  group: 'Smart home',
  tags: [...SPEAKER_TAGS, 'apple', 'homepod', 'siri', 'airplay'],
  description: 'Nearly spherical Apple speaker covered in seamless acoustic mesh, with a backlit glass touch surface on its flat top.',
  ...fixed(0.0979, 0.0979, 0.0843),
  defaultElevation: 0.75,
  slots: [matSlot('mesh', 'Mesh', 'hx-mesh-white'), matSlot('top', 'Touch top', 'hx-gloss-white'), matSlot('glow', 'Siri light', 'hx-led-siri')],
  variants: finishes(
    ['midnight', 'Midnight', { mesh: 'hx-mesh-midnight', top: 'hx-gloss-charcoal' }],
    ['yellow', 'Yellow', { mesh: 'hx-mesh-yellow', top: 'hx-gloss-yellow' }],
    ['orange', 'Orange', { mesh: 'hx-mesh-orange', top: 'hx-gloss-orange' }],
    ['blue', 'Blue', { mesh: 'hx-mesh-blue', top: 'hx-gloss-blue' }],
  ),
  build: ({ w, h }) => {
    const r = w / 2;
    // Sphere of radius r cut flat at the bottom and the top.
    const prof: V2[] = [[0, 0]];
    const yc = h / 2 - 0.004;
    for (const i of range(13)) {
      const y = 0.002 + (i / 12) * (h - 0.004);
      prof.push([Math.sqrt(Math.max(0, r * r - (y - yc) ** 2)) * 0.995, y]);
    }
    prof.push([0, h - 0.002]);
    const rt = Math.sqrt(r * r - (h - 0.002 - yc) ** 2) * 0.92;
    return [
      tower('mesh', 0, 0, prof, 48),
      cyl('top', [0, h - 0.0015, 0], rt, 0.003, { segments: 40, plan: false }),
      cyl('glow', [0, h - 0.0003, 0], rt * 0.42, 0.0008, { segments: 32, plan: false }),
      ...[-1, 1].map((s) => span('top', [s * rt * 0.62 - 0.004, s * rt * 0.62 + 0.004], [h - 0.0004, h], [-0.0008, 0.0008], o)),
      cyl('top', [0, 0.001, 0], r * 0.55, 0.002, { segments: 32, plan: false }),
    ];
  },
  brand: brand('Apple', 'MY5G2 (A2374)', 'HomePod mini', 'https://www.apple.com/homepod-mini/specs/', [
    ['Size', '97.9 mm wide × 84.3 mm tall'],
    ['Weight', '345 g'],
    ['Colours', 'White, Midnight, Yellow, Orange, Blue'],
  ]),
});

const homePod = defineItem({
  id: 'apple-homepod-2',
  name: 'Apple HomePod (2nd generation)',
  category: 'living',
  type: 'electronics',
  group: 'Smart home',
  tags: [...SPEAKER_TAGS, 'apple', 'homepod', 'siri', 'airplay', 'spatial audio'],
  description: 'Rounded cylindrical Apple speaker wrapped in seamless acoustic mesh, with a recessed backlit touch surface on top.',
  ...fixed(0.142, 0.142, 0.168),
  defaultElevation: 0.75,
  slots: [matSlot('mesh', 'Mesh', 'hx-mesh-white'), matSlot('top', 'Touch top', 'hx-gloss-white'), matSlot('glow', 'Siri light', 'hx-led-siri')],
  variants: finishes(['midnight', 'Midnight', { mesh: 'hx-mesh-midnight', top: 'hx-gloss-charcoal' }]),
  build: ({ w, h }) => {
    const r = w / 2;
    return [
      tower('mesh', 0, 0, [[0, 0], [r * 0.8, 0], [r * 0.93, 0.006], [r * 0.99, 0.022], [r, 0.05], [r, h - 0.05], [r * 0.99, h - 0.024], [r * 0.95, h - 0.009], [r * 0.86, h - 0.002], [0, h - 0.002]], 56),
      cyl('top', [0, h - 0.0025, 0], r * 0.84, 0.004, { segments: 48, plan: false }),
      cyl('glow', [0, h - 0.0003, 0], r * 0.38, 0.0008, { segments: 40, plan: false }),
      ...[-1, 1].map((s) => span('top', [s * r * 0.58 - 0.005, s * r * 0.58 + 0.005], [h - 0.0004, h], [-0.001, 0.001], o)),
      cyl('top', [0, 0.001, 0], r * 0.7, 0.002, { segments: 40, plan: false }),
    ];
  },
  brand: brand('Apple', 'MQJ73 (A2825)', 'HomePod, 2nd generation', 'https://www.apple.com/homepod/specs/', [
    ['Size', '142 mm wide × 168 mm tall'],
    ['Weight', '2.3 kg'],
    ['Colours', 'White, Midnight'],
  ]),
});


// ---------------------------------------------------------------------------
// Pack
// ---------------------------------------------------------------------------

/** Seamless tile of round holes on a staggered grid (`n` per row); near-white with dark holes. */
function drawHoles(ctx: CanvasRenderingContext2D, size: number, n: number, holeShare: number) {
  ctx.fillStyle = '#ececec';
  ctx.fillRect(0, 0, size, size);
  const p = size / n;
  ctx.fillStyle = '#3a3a3a';
  for (let j = 0; j < n; j++) {
    for (let i = 0; i <= n; i++) {
      const x = (i + (j % 2) * 0.5) * p;
      const y = (j + 0.5) * p;
      for (const dx of [-size, 0, size]) {
        ctx.beginPath();
        ctx.arc(x + dx, y, p * holeShare, 0, TAU);
        ctx.fill();
      }
    }
  }
}

const fabric = (id: string, name: string, color: string) => ({ id, name, category: 'fabric' as const, color, roughness: 0.95, pattern: { id: 'weave', scale: 0.03, contrast: 0.6 } });
const mesh = (id: string, name: string, color: string) => ({ id, name, category: 'fabric' as const, color, roughness: 0.85, pattern: { id: 'hx-knit', scale: 0.02, contrast: 0.7 } });

export default definePack({
  name: 'Branded home electronics',
  version: '1.0.0',
  author: 'Neest team',
  description:
    'Fans, vacuums, robot vacuums, air purifiers, humidifiers, a dehumidifier, heaters, smart speakers, routers and small kitchen appliances from Xiaomi, Dyson, Dreame, Hitachi, Roborock, Ecovacs, Sharp, Daikin, FujiE, Google, Apple, TP-Link and Philips, at their published sizes and in the finishes they are sold in.',
  license: 'CC0 (made for Neest); brand names belong to their owners',
  items: [
    fan2,
    towerFan,
    dysonV15,
    xiaomiG11,
    dreameH12,
    hitachiCanister,
    robotS10,
    robotX10,
    roborockS8,
    deebotT30,
    ap4Lite,
    ap4Pro,
    sharpKc,
    daikinMck,
    dysonTp07,
    humidifier2,
    dehumidifier,
    heaterS,
    fujieOfr,
    nestAudio,
    nestMini,
    nestHub,
    homePodMini,
    homePod,
    xiaomiRouter,
    archerAx73,
    decoX50,
    kettle2,
    philipsAirfryer,
    xiaomiAirfryer,
    philipsBlender,
  ],
  patterns: [
    { id: 'hx-perf', name: 'Fine perforation', normalStrength: 0.9, draw: (ctx, size) => drawHoles(ctx, size, 24, 0.28) },
    {
      id: 'hx-peel',
      name: 'Moulded plastic stipple',
      normalStrength: 0.4,
      draw(ctx, size, rand) {
        ctx.fillStyle = '#e8e8e8';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < size * 6; i++) {
          const v = 215 + Math.floor(rand() * 40);
          ctx.fillStyle = `rgb(${v},${v},${v})`;
          ctx.fillRect(Math.floor(rand() * size), Math.floor(rand() * size), 2, 2);
        }
      },
    },
    {
      id: 'hx-knit',
      name: 'Acoustic knit',
      normalStrength: 0.8,
      // Interlocking rows of small loops, like the knit on smart speakers.
      draw(ctx, size) {
        ctx.fillStyle = '#d6d6d6';
        ctx.fillRect(0, 0, size, size);
        const n = 32;
        const p = size / n;
        for (let j = 0; j < n; j++) {
          for (let i = 0; i < n; i++) {
            const x = (i + (j % 2) * 0.5) * p;
            const y = (j + 0.5) * p;
            ctx.fillStyle = '#f2f2f2';
            for (const dx of [-size, 0, size]) {
              ctx.beginPath();
              ctx.ellipse(x + dx, y, p * 0.42, p * 0.3, 0, 0, TAU);
              ctx.fill();
            }
          }
        }
      },
    },
  ],
  materials: [
    { id: 'hx-gloss-white', name: 'Gloss white plastic', category: 'solid', color: '#f5f5f3', roughness: 0.22 },
    { id: 'hx-matte-white', name: 'Matte white plastic', category: 'solid', color: '#ededea', roughness: 0.55, pattern: { id: 'hx-peel', scale: 0.06, contrast: 0.5 } },
    { id: 'hx-enamel-white', name: 'White enamelled steel', category: 'metal', color: '#f1f0ec', roughness: 0.3, metalness: 0.15 },
    { id: 'hx-matte-charcoal', name: 'Charcoal plastic', category: 'solid', color: '#3a3c40', roughness: 0.55, pattern: { id: 'hx-peel', scale: 0.06, contrast: 0.6 } },
    { id: 'hx-gloss-charcoal', name: 'Gloss charcoal plastic', category: 'solid', color: '#2c2e31', roughness: 0.2 },
    { id: 'hx-matte-black', name: 'Matte black plastic', category: 'solid', color: '#1e1f22', roughness: 0.55, pattern: { id: 'hx-peel', scale: 0.06, contrast: 0.7 } },
    { id: 'hx-gloss-black', name: 'Piano black plastic', category: 'solid', color: '#141518', roughness: 0.14 },
    { id: 'hx-gloss-yellow', name: 'Gloss yellow', category: 'solid', color: '#f3d870', roughness: 0.15 },
    { id: 'hx-gloss-orange', name: 'Gloss orange', category: 'solid', color: '#f09a5a', roughness: 0.15 },
    { id: 'hx-gloss-blue', name: 'Gloss blue', category: 'solid', color: '#6382b3', roughness: 0.15 },
    { id: 'hx-blade-white', name: 'Fan blade white', category: 'solid', color: '#f3f4f4', roughness: 0.35 },
    { id: 'hx-silver', name: 'Silver-grey trim', category: 'metal', color: '#bfc2c6', roughness: 0.32, metalness: 0.6 },
    { id: 'hx-nickel', name: 'Bright nickel', category: 'metal', color: '#cfd2d6', roughness: 0.22, metalness: 0.9, pattern: { id: 'brushed', scale: 0.2, contrast: 0.5 } },
    { id: 'hx-iron', name: 'Iron grey', category: 'metal', color: '#5e636a', roughness: 0.38, metalness: 0.5 },
    { id: 'hx-dyson-yellow', name: 'Vacuum yellow', category: 'solid', color: '#f1c11f', roughness: 0.3 },
    { id: 'hx-dyson-gold', name: 'Vacuum gold', category: 'metal', color: '#c9a456', roughness: 0.3, metalness: 0.75 },
    { id: 'hx-clear', name: 'Clear polycarbonate', category: 'glass', color: '#e2ebef', roughness: 0.05, opacity: 0.32 },
    { id: 'hx-smoke', name: 'Smoked tank plastic', category: 'glass', color: '#525860', roughness: 0.08, opacity: 0.62 },
    { id: 'hx-grille-dark', name: 'Dark outlet grille', category: 'solid', color: '#2b2d30', roughness: 0.6 },
    { id: 'hx-perforated-white', name: 'Perforated white plastic', category: 'solid', color: '#f2f2f0', roughness: 0.5, pattern: { id: 'hx-perf', scale: 0.04, contrast: 0.55 } },
    { id: 'hx-perforated-grey', name: 'Perforated grey grille', category: 'solid', color: '#a8abb0', roughness: 0.5, pattern: { id: 'hx-perf', scale: 0.04, contrast: 0.7 } },
    { id: 'hx-perforated-silver', name: 'Perforated silver', category: 'metal', color: '#c8cbcf', roughness: 0.3, metalness: 0.75, pattern: { id: 'hx-perf', scale: 0.03, contrast: 0.7 } },
    { id: 'hx-perforated-nickel', name: 'Perforated nickel', category: 'metal', color: '#9da1a7', roughness: 0.28, metalness: 0.85, pattern: { id: 'hx-perf', scale: 0.03, contrast: 0.75 } },
    { id: 'hx-display', name: 'Black display glass', category: 'glass', color: '#0f1215', roughness: 0.08, metalness: 0.2, emissive: '#2b4a66', emissiveIntensity: 0.35 },
    { id: 'hx-led-white', name: 'White status light', category: 'solid', color: '#ffffff', roughness: 0.3, emissive: '#e8f4ff', emissiveIntensity: 1.6 },
    { id: 'hx-led-siri', name: 'Touch-top glow', category: 'solid', color: '#b7a6ff', roughness: 0.2, emissive: '#7f6bff', emissiveIntensity: 1.2 },
    { id: 'hx-mop', name: 'Grey microfibre roller', category: 'fabric', color: '#cfd3d7', roughness: 1, pattern: { id: 'boucle', scale: 0.05, contrast: 0.6 } },
    { id: 'hx-hitachi-blue', name: 'Deep blue appliance plastic', category: 'solid', color: '#22325a', roughness: 0.3 },
    fabric('hx-fabric-chalk', 'Chalk speaker fabric', '#e6e3dd'),
    fabric('hx-fabric-charcoal', 'Charcoal speaker fabric', '#4b4d52'),
    fabric('hx-fabric-sage', 'Sage speaker fabric', '#a7b39e'),
    fabric('hx-fabric-sand', 'Sand speaker fabric', '#e2cbb8'),
    fabric('hx-fabric-sky', 'Sky speaker fabric', '#a8c2d6'),
    fabric('hx-fabric-coral', 'Coral speaker fabric', '#e59a8a'),
    fabric('hx-fabric-mist', 'Mist speaker fabric', '#b9c9c8'),
    mesh('hx-mesh-white', 'White acoustic mesh', '#efefed'),
    mesh('hx-mesh-midnight', 'Midnight acoustic mesh', '#35383d'),
    mesh('hx-mesh-yellow', 'Yellow acoustic mesh', '#f0d36a'),
    mesh('hx-mesh-orange', 'Orange acoustic mesh', '#ee9550'),
    mesh('hx-mesh-blue', 'Blue acoustic mesh', '#5a77a8'),
  ],
});

/**
 * Branded climate (Vietnam) — five cooling and air products found in most Vietnamese homes, at their
 * published sizes.
 *
 * Split air conditioner: the Panasonic CS-XU9ZKH-8 indoor unit (wall-mounted
 * near the ceiling) and the Panasonic CU-XU9ZKH-8 outdoor unit for the balcony. Fans: Panasonic
 * F-409KB stand fan and F-60WWK five-blade ceiling fan. Air: Xiaomi Smart Air Purifier 4.
 *
 * Specs come from Vietnamese retailer listings and the makers' sites (`brand.url`). Original
 * procedural shapes: no logos or trademark artwork. Fixed products, so nothing resizes.
 */
import {
  cyl,
  defineItem,
  definePack,
  discZ,
  lathe,
  matSlot,
  range,
  rectPoly,
  ring,
  rod,
  span,
  sphere,
  torus,
  vcyl,
  type AssetBrand,
  type Part,
  type Size3,
  type V2,
} from '@/packs/kit';

const o = { plan: false };
const CEIL = 2.7;
const TAGS = ['branded', 'vietnam', 'climate', 'electronics'];

function fixed(w: number, d: number, h: number) {
  const s: Size3 = { w, d, h };
  return { defaultSize: s, minSize: s, maxSize: s, resizable: { w: false, d: false, h: false } };
}

const brand = (name: string, model: string, line: string, url: string, specs: [string, string][]): AssetBrand => ({ name, model, line, url, specs });

/**
 * Prism whose outline is a side profile ([z, y] points, z = front) extruded across the full width:
 * the cross-section of a wall-mounted air conditioner.
 */
function sideProfile(slot: string, profile: V2[], w: number, plan = true): Part {
  // Rotation z = −90° maps prism local y (extrusion) to world x and local x to world −y.
  const p: Part = { shape: 'prism', outline: profile.map(([z, y]) => [-y, z] as V2), height: w, position: [-w / 2, 0, 0], rotation: [0, 0, -Math.PI / 2], slot };
  if (!plan) p.plan = false;
  return p;
}

/**
 * Split-AC outdoor unit (condenser), front +z, built inside its box:
 *  - painted steel casing wrapping the front, top and right side, with stamped ribs on the lid, a
 *    carrying recess and a small rating plate;
 *  - the left side and back left open on the aluminium coil (fin texture) behind wire guards;
 *  - a round fan opening (bellmouth ring, dark shroud) with a four-blade swept fan and motor hub
 *    behind a domed wire grille of rings and spokes;
 *  - a valve cover on the right with two copper service valves, flare nuts and the insulated pipe
 *    run going back to the wall;
 *  - two base rails on rubber anti-vibration pads.
 * `fan` is the fan opening's centre x as a share of the width and its radius as a share of the height.
 */
function outdoorUnit({ w, d, h }: Size3, fan = { x: 0.38, r: 0.4 }): Part[] {
  const zf = d / 2 - 0.036; // casing front: the domed grille stands proud of it
  const zb = -d / 2;
  const y0 = 0.032; // casing bottom (feet below)
  const t = 0.01; // sheet thickness
  const xr = w / 2 - 0.028; // casing right edge (valve cover beyond)
  const parts: Part[] = [];
  // Casing: lid, front, right side and base pan; coil on the left and back.
  parts.push(
    span('body', [-w / 2, xr], [h - 0.014, h], [zb, zf], { bevel: 0.006 }),
    span('body', [-w / 2 + 0.004, xr], [y0, h - 0.014], [zf - t, zf], { bevel: 0.004, plan: false }),
    span('body', [xr - t, xr], [y0, h - 0.014], [zb + 0.004, zf - t], o),
    span('body', [-w / 2, xr], [y0, y0 + 0.014], [zb, zf], o),
    span('body', [-w / 2, -w / 2 + 0.016], [y0, h - 0.014], [zf - 0.03, zf], o),
    span('fins', [-w / 2 + 0.002, -w / 2 + 0.014], [y0 + 0.014, h - 0.014], [zb + 0.004, zf - 0.03], o),
    span('fins', [-w / 2 + 0.014, xr - t], [y0 + 0.014, h - 0.014], [zb + 0.002, zb + 0.022], o),
    // Dark inside, seen through the fan opening.
    span('grille', [-w / 2 + 0.016, xr - t], [y0 + 0.014, h - 0.014], [zb + 0.022, zb + 0.03], o),
  );
  // Stamped ribs on the lid and a carrying recess on the right side.
  for (const z of [zb + d * 0.3, zb + d * 0.62]) parts.push(span('body', [-w / 2 + 0.05, xr - 0.05], [h, h + 0.002], [z - 0.012, z + 0.012], { bevel: 0.001, plan: false }));
  parts.push(span('fins', [xr - 0.0005, xr + 0.001], [h * 0.74, h * 0.77], [zb + d * 0.36, zb + d * 0.64], { bevel: 0.002, plan: false }));
  // Rating plate and a thin trim line on the front right.
  const fx = -w / 2 + w * fan.x;
  const fr = h * fan.r;
  const fy = y0 + (h - y0) / 2 + 0.004;
  const px0 = fx + fr + 0.03;
  parts.push(span('fins', [px0, Math.min(xr - 0.02, px0 + 0.07)], [h * 0.16, h * 0.22], [zf, zf + 0.0015], o));
  parts.push(span('grille', [px0, xr - 0.015], [h - 0.05, h - 0.047], [zf, zf + 0.0012], o));
  // Wire guards over the exposed coil: back and left side.
  for (const x of [-0.42, -0.21, 0, 0.21, 0.42].map((k) => k * (w - 0.06) + (xr - w / 2) / 2)) parts.push(vcyl('grille', x, zb + 0.0015, y0 + 0.02, h - 0.02, 0.001, o));
  for (const y of [0.22, 0.5, 0.78].map((k) => y0 + k * (h - y0))) parts.push(rod('grille', [-w / 2 + 0.02, y, zb + 0.0015], [xr - 0.02, y, zb + 0.0015], 0.001, o));
  for (const y of [0.3, 0.7].map((k) => y0 + k * (h - y0))) parts.push(rod('grille', [-w / 2 + 0.0015, y, zb + 0.02], [-w / 2 + 0.0015, y, zf - 0.04], 0.001, o));
  // Fan opening: dark shroud, bellmouth ring.
  parts.push(discZ('grille', [fx, fy, zf + 0.0006], fr, 0.002, { segments: 48, plan: false }));
  parts.push({ ...torus('body', [0, 0, 0], fr, 0.009, o), position: [fx, fy, zf - 0.002] } as Part);
  // Fan: motor hub and four swept blades just behind the grille.
  parts.push(discZ('grille', [fx, fy, zf + 0.012], fr * 0.16, 0.022, { segments: 24, plan: false }), discZ('fins', [fx, fy, zf + 0.024], fr * 0.09, 0.006, { segments: 20, plan: false }));
  for (const k of range(4)) {
    const a = (k / 4) * Math.PI * 2 + 0.3;
    const rm = fr * 0.52;
    parts.push(
      sphere('fins', [fx + Math.cos(a) * rm, fy + Math.sin(a) * rm, zf + 0.012], 1, {
        scale: [fr * 0.4, fr * 0.2, 0.004],
        rotation: [0, 0, a + 0.55],
        plan: false,
      }),
    );
  }
  // Domed grille: rings rising towards the centre, spokes, centre badge.
  const dome = 0.012;
  const nr = 8;
  for (const i of range(nr)) {
    const r = fr * (0.16 + (0.84 * (i + 1)) / nr) - 0.004;
    parts.push({ ...torus('grille', [0, 0, 0], r, 0.0016, o), position: [fx, fy, zf + 0.02 + dome * (1 - r / fr)] } as Part);
  }
  for (const k of range(8)) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    const r0 = fr * 0.17;
    const r1 = fr - 0.004;
    parts.push(rod('grille', [fx + Math.cos(a) * r0, fy + Math.sin(a) * r0, zf + 0.02 + dome * (1 - r0 / fr)], [fx + Math.cos(a) * r1, fy + Math.sin(a) * r1, zf + 0.02], 0.0018, { segments: 6, plan: false }));
  }
  parts.push(discZ('grille', [fx, fy, zf + 0.033], fr * 0.17, 0.004, { segments: 28, plan: false }), discZ('body', [fx, fy, zf + 0.0355], fr * 0.08, 0.002, { segments: 20, plan: false }));
  // Valve cover on the right, with the service valves under it and the insulated pipe run.
  const vy0 = y0 + 0.02;
  const vy1 = y0 + (h - y0) * 0.55;
  parts.push(span('body', [xr, w / 2 - 0.002], [vy0, vy1], [zb + d * 0.15, zf - 0.02], { bevel: 0.008, plan: false }));
  for (const [k, r] of [
    [0, 0.008],
    [1, 0.011],
  ] as const) {
    const vy = vy0 + 0.035 + k * 0.05;
    const vz = zb + d * 0.1;
    parts.push(
      rod('fins', [xr - 0.01, vy, vz], [w / 2 - 0.004, vy, vz], r + 0.004, { segments: 10, plan: false }),
      rod('pipes', [w / 2 - 0.02, vy, vz], [w / 2 - 0.004, vy, vz], r + 0.008, { segments: 6, plan: false }),
      rod('pipes', [w / 2 - 0.012, vy, vz], [w / 2 - 0.012, vy - 0.02, vz], r, { segments: 10, plan: false }),
    );
  }
  // Pipes (wrapped in white insulation tape) bend down and run back to the wall.
  const by = vy0 + 0.01;
  parts.push(
    rod('body', [w / 2 - 0.016, vy0 + 0.06, zb + d * 0.1], [w / 2 - 0.016, by, zb + d * 0.1], 0.016, { segments: 12, plan: false }),
    rod('body', [w / 2 - 0.016, by, zb + d * 0.1], [w / 2 - 0.016, by, zb + 0.004], 0.016, { segments: 12, plan: false }),
    sphere('body', [w / 2 - 0.016, by, zb + d * 0.1], 0.016, o),
  );
  // Base rails on rubber pads.
  for (const s of [-1, 1]) {
    const x = s * (w / 2 - 0.1) + (xr - w / 2) / 2;
    parts.push(span('fins', [x - 0.025, x + 0.025], [0.012, y0], [zb + 0.005, zf - 0.005], { bevel: 0.002 }));
    for (const z of [zb + 0.03, zf - 0.03]) parts.push(cyl('grille', [x, 0.006, z], 0.016, 0.012, { segments: 12, plan: false }));
    parts.push(span('grille', [x - 0.008, x + 0.008], [y0 - 0.001, y0], [zf - 0.03, zf - 0.012], o));
  }
  return parts;
}

/** Wall split-AC indoor unit: rounded body, front panel, louvre flap, display window. */
function indoorUnit(w: number, d: number, h: number, look: { bulge: number; flapY: number; display: number }): Part[] {
  const zb = -d / 2;
  const zf = d / 2;
  const body: V2[] = [
    [zb, 0.02],
    [zb, h],
    [zf - 0.03, h],
    [zf - 0.008, h - 0.02],
    [zf, h * 0.6],
    [zf - look.bulge, h * 0.25],
    [zf - look.bulge - 0.03, 0.01],
    [zb + 0.02, 0],
  ];
  const parts: Part[] = [
    sideProfile('body', body, w),
    // Front panel seam, air outlet slot and the louvre flap.
    span('trim', [-w / 2 + 0.01, w / 2 - 0.01], [h * 0.58, h * 0.58 + 0.002], [zf - 0.002, zf + 0.0005], o),
    span('vent', [-w / 2 + 0.03, w / 2 - 0.03], [0.006, look.flapY], [zf - look.bulge - 0.07, zf - look.bulge - 0.02], o),
    span('body', [-w / 2 + 0.035, w / 2 - 0.035], [look.flapY - 0.006, look.flapY], [zf - look.bulge - 0.09, zf - look.bulge - 0.01], { rotation: [-0.35, 0, 0], plan: false }),
    // Display / indicator window.
    span('trim', [w / 2 - 0.12 - look.display, w / 2 - 0.12], [h * 0.36, h * 0.42], [zf - look.bulge * 0.4 - 0.001, zf - look.bulge * 0.4 + 0.002], o),
  ];
  return parts;
}

const AC_SLOTS = [matSlot('body', 'Casing', 'plastic-white'), matSlot('trim', 'Display & seams', 'solid-light-grey'), matSlot('vent', 'Air outlet', 'solid-black')];

const panaIndoor = defineItem({
  id: 'panasonic-cs-xu9zkh-8',
  name: 'Panasonic CS-XU9ZKH-8 air conditioner',
  category: 'living',
  type: 'electronics',
  group: 'Climate',
  tags: [...TAGS, 'panasonic', 'điều hòa', 'máy lạnh', 'air conditioner', 'split ac', 'inverter', 'nanoe', '1 hp'],
  description: 'Panasonic 1 HP inverter indoor unit with nanoe X air purification and a wide louvre.',
  ...fixed(0.87, 0.229, 0.295),
  mount: 'wall',
  defaultElevation: 2.15,
  slots: AC_SLOTS,
  build: ({ w, d, h }) => indoorUnit(w, d, h, { bulge: 0.012, flapY: 0.06, display: 0.07 }),
  brand: brand('Panasonic', 'CS-XU9ZKH-8 / CU-XU9ZKH-8', 'XU inverter, 1 HP', 'https://hoanghamobile.com/dieu-hoa/panasonic-inverter-1-hp-cu-cs-xu9zkh-8', [
    ['Cooling', '8,700 BTU (1 HP), rooms under 15 m²'],
    ['Indoor unit (W × H × D)', '870 × 295 × 229 mm'],
    ['Indoor weight', '10 kg'],
    ['Air', 'nanoe X'],
  ]),
});

const panaOutdoor = defineItem({
  id: 'panasonic-cu-xu9zkh-8',
  name: 'Panasonic CU-XU9ZKH-8 outdoor unit',
  category: 'outdoor',
  type: 'electronics',
  group: 'Climate',
  tags: [...TAGS, 'panasonic', 'dàn nóng', 'cục nóng', 'outdoor unit', 'condenser', 'air conditioner', 'balcony'],
  description: 'Outdoor condenser for the Panasonic XU9 split system: four-blade fan behind a domed wire grille, aluminium coil behind guards at the back and side, copper service valves under the side cover with the insulated pipe run, on rubber-padded base rails.',
  ...fixed(0.65, 0.23, 0.511),
  wallSnap: true,
  slots: [matSlot('body', 'Casing & pipe insulation', 'climate-casing'), matSlot('grille', 'Fan grille, guards & feet pads', 'metal-black-matte'), matSlot('fins', 'Coil, fan blades & rails', 'climate-coil'), matSlot('pipes', 'Copper valves', 'metal-copper')],
  build: (size) => outdoorUnit(size, { x: 0.37, r: 0.4 }),
  brand: brand('Panasonic', 'CU-XU9ZKH-8', 'XU inverter outdoor unit', 'https://hoanghamobile.com/dieu-hoa/panasonic-inverter-1-hp-cu-cs-xu9zkh-8', [
    ['Outdoor unit (W × H × D)', '650 × 511 × 230 mm'],
    ['Weight', '18 kg'],
  ]),
});

const standFan = defineItem({
  id: 'panasonic-f-409kb',
  name: 'Panasonic F-409KB stand fan',
  category: 'living',
  type: 'electronics',
  group: 'Climate',
  tags: [...TAGS, 'panasonic', 'quạt đứng', 'quạt cây', 'stand fan', 'pedestal fan', 'remote'],
  description: 'Classic Panasonic pedestal fan with a 40 cm three-blade rotor in a round cage, a remote-control base and an adjustable pole.',
  ...fixed(0.49, 0.4, 1.3),
  slots: [matSlot('body', 'Body & base', 'plastic-white'), matSlot('blade', 'Blades', 'fan-blade-blue'), matSlot('cage', 'Cage', 'metal-white-powder'), matSlot('trim', 'Controls', 'solid-mid-grey')],
  build: ({ w, d, h }) => {
    const parts: Part[] = [
      lathe('body', [0, 0, 0], [[0, 0], [0.18, 0], [0.19, 0.012], [0.16, 0.05], [0.04, 0.07], [0, 0.07]], { segments: 36, scale: [1, 1, Math.min(1, (d / 2 - 0.01) / 0.19)] }),
      span('trim', [-0.06, 0.06], [0.05, 0.065], [0.06, 0.13], { rotation: [0.35, 0, 0], plan: false }),
      vcyl('body', 0, 0, 0.07, h * 0.62, 0.016, o),
      vcyl('trim', 0, 0, h * 0.6, h * 0.66, 0.02, o),
    ];
    const cy = h - 0.245;
    const R = Math.min(w / 2 - 0.005, 0.229);
    const zc = 0.02;
    // Motor housing behind the rotor.
    parts.push(rod('body', [0, h * 0.66, -0.02], [0, cy, -0.06], 0.02, o), cyl('body', [0, cy, -0.09], 0.075, 0.12, { rotation: [Math.PI / 2, 0, 0], segments: 24, plan: false }));
    // Cage: front and back rings with spokes, a centre badge.
    for (const z of [zc - 0.06, zc + 0.06]) parts.push(torus('cage', [0, cy, z], R, 0.004, o));
    for (const k of range(16)) {
      const a = (k / 16) * Math.PI * 2;
      parts.push(rod('cage', [Math.cos(a) * R, cy + Math.sin(a) * R, zc - 0.06], [Math.cos(a) * R, cy + Math.sin(a) * R, zc + 0.06], 0.002, o));
      parts.push(rod('cage', [Math.cos(a) * R, cy + Math.sin(a) * R, zc + 0.06], [Math.cos(a) * 0.06, cy + Math.sin(a) * 0.06, zc + 0.075], 0.0015, o));
    }
    parts.push(discZ('trim', [0, cy, zc + 0.078], 0.06, 0.006, o));
    // Three blades.
    for (const k of range(3)) {
      const a = (k / 3) * Math.PI * 2 + 0.3;
      parts.push(sphere('blade', [Math.cos(a) * 0.11, cy + Math.sin(a) * 0.11, zc], 0.5, { scale: [0.17, 0.13, 0.008], rotation: [0.25, 0, a], plan: false }));
    }
    parts.push(cyl('blade', [0, cy, zc], 0.04, 0.03, { rotation: [Math.PI / 2, 0, 0], plan: false }));
    return parts;
  },
  brand: brand('Panasonic', 'F-409KB', 'Stand fan with remote', 'https://cellphones.com.vn/quat-dung-panasonic-f-409kb.html', [
    ['Size (W × H × D)', '490 × 1300 × 400 mm'],
    ['Blade diameter', '40 cm, 3 blades'],
    ['Height', 'adjustable ≈ 1.28–1.43 m'],
  ]),
});

const ceilingFan = defineItem({
  id: 'panasonic-f-60wwk',
  name: 'Panasonic F-60WWK ceiling fan',
  category: 'living',
  type: 'electronics',
  group: 'Climate',
  tags: [...TAGS, 'panasonic', 'quạt trần', 'ceiling fan', '5 cánh', 'five blade'],
  description: 'Five-blade 150 cm Panasonic ceiling fan on a short downrod, a familiar sight in Vietnamese living rooms.',
  ...fixed(1.5, 1.5, 0.42),
  mount: 'ceiling',
  defaultElevation: CEIL - 0.42,
  slots: [matSlot('body', 'Motor & rod', 'plastic-white'), matSlot('blade', 'Blades', 'plastic-white'), matSlot('trim', 'Trim', 'metal-brushed-steel')],
  build: ({ w, h }) => {
    const R = w / 2 - 0.01;
    const my = 0.12;
    const parts: Part[] = [
      lathe('body', [0, h - 0.06, 0], [[0, 0], [0.04, 0], [0.09, 0.05], [0.09, 0.06], [0, 0.06]], { segments: 28, plan: false }),
      vcyl('trim', 0, 0, my + 0.08, h - 0.05, 0.012, o),
      lathe('body', [0, my - 0.03, 0], [[0, 0], [0.06, 0], [0.13, 0.04], [0.14, 0.08], [0.1, 0.11], [0.03, 0.12], [0, 0.12]], { segments: 36 }),
      ring('trim', [0, my + 0.02, 0], 0.14, 0.004, o),
      lathe('body', [0, my - 0.07, 0], [[0, 0], [0.03, 0], [0.04, 0.04], [0, 0.04]], { segments: 20, plan: false }),
    ];
    for (const k of range(5)) {
      const a = (k / 5) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      parts.push(rod('trim', [c * 0.11, my, s * 0.11], [c * 0.22, my - 0.005, s * 0.22], 0.008, o));
      parts.push({ shape: 'box', size: [R - 0.2, 0.006, 0.14], position: [c * (0.2 + (R - 0.2) / 2), my - 0.008, s * (0.2 + (R - 0.2) / 2)], rotation: [0.12, -a, 0], slot: 'blade', plan: k === 0 });
    }
    return parts;
  },
  planDetail: ({ w }) => [rectPoly(-0.07, -0.07, 0.07, 0.07), ...range(5).map((k) => {
    const a = (k / 5) * Math.PI * 2;
    return rectPoly(Math.cos(a) * w * 0.45 - 0.03, Math.sin(a) * w * 0.45 - 0.03, Math.cos(a) * w * 0.45 + 0.03, Math.sin(a) * w * 0.45 + 0.03);
  })],
  brand: brand('Panasonic', 'F-60WWK', 'Ceiling fan, 5 blades', 'https://www.dienmayxanh.com/quat/quat-tran-panasonic-f-60wwk', [
    ['Sweep', '150 cm, 5 blades'],
    ['Power', '76 W'],
  ]),
});

const purifier = defineItem({
  id: 'xiaomi-air-purifier-4',
  name: 'Xiaomi Smart Air Purifier 4',
  category: 'living',
  type: 'electronics',
  group: 'Climate',
  tags: [...TAGS, 'xiaomi', 'máy lọc không khí', 'air purifier', 'hepa', 'smart home'],
  description: 'Cylindrical Xiaomi purifier with 360° perforated intake, a top outlet grille and a round display.',
  ...fixed(0.25, 0.25, 0.555),
  slots: [matSlot('body', 'Body', 'purifier-perforated'), matSlot('top', 'Top & display', 'plastic-white'), matSlot('grille', 'Outlet grille', 'solid-mid-grey')],
  build: ({ w, h }) => {
    const r = w / 2;
    return [
      lathe('body', [0, 0, 0], [[0, 0], [r * 0.96, 0], [r, 0.02], [r, h - 0.05], [0, h - 0.05]], { segments: 40 }),
      lathe('top', [0, h - 0.05, 0], [[0, 0], [r, 0], [r * 0.98, 0.05], [0, 0.05]], { segments: 40, plan: false }),
      // Outlet grille 0.8 mm proud of the top (a flush disc flickers against it).
      cyl('grille', [0, h - 0.0016, 0], r * 0.84, 0.0048, { segments: 40, plan: false }),
      cyl('top', [0, h - 0.06, r - 0.004], 0.03, 0.004, { rotation: [Math.PI / 2, 0, 0], plan: false }),
    ];
  },
  brand: brand('Xiaomi', 'AC-M16-SC', 'Smart Air Purifier 4', 'https://www.mi.com/uk/product/xiaomi-smart-air-purifier-4/specs/', [
    ['Size', '250 × 250 × 555 mm'],
    ['Filter', 'HEPA 3-in-1'],
    ['Smart', 'Mi Home / Google Assistant'],
  ]),
});

export default definePack({
  name: 'Branded climate (Vietnam)',
  version: '1.0.0',
  author: 'Neest team',
  description: 'Five cooling and air products common in Vietnamese homes at their published sizes: the Panasonic XU9 split air conditioner (indoor and outdoor units), Panasonic stand and ceiling fans, and the Xiaomi Smart Air Purifier 4.',
  license: 'CC0 (made for Neest); brand names belong to their owners',
  items: [panaIndoor, panaOutdoor, standFan, ceilingFan, purifier],
  patterns: [
    {
      id: 'coil-fins',
      name: 'Condenser coil fins',
      normalStrength: 0.9,
      draw(ctx, size) {
        ctx.fillStyle = '#d9dcdf';
        ctx.fillRect(0, 0, size, size);
        const n = 64;
        for (let i = 0; i < n; i++) {
          const x = (i * size) / n;
          ctx.fillStyle = '#9da3a8';
          ctx.fillRect(Math.round(x), 0, Math.max(1, Math.round(size / n / 3)), size);
        }
        // Copper return bends of the tubes, every few centimetres.
        ctx.fillStyle = '#b8bcc0';
        for (let j = 0; j < 8; j++) ctx.fillRect(0, Math.round(((j + 0.5) * size) / 8) - 1, size, 3);
      },
    },
  ],
  materials: [
    { id: 'climate-casing', name: 'Outdoor unit casing', category: 'metal', color: '#eeede8', roughness: 0.45, metalness: 0.1 },
    { id: 'climate-coil', name: 'Aluminium condenser coil', category: 'metal', color: '#ffffff', roughness: 0.4, metalness: 0.6, pattern: { id: 'coil-fins', scale: 0.12, contrast: 1 } },
    { id: 'fan-blade-blue', name: 'Translucent fan blade', category: 'solid', color: '#8fb6d8', roughness: 0.25, opacity: 0.8 },
    { id: 'purifier-perforated', name: 'Perforated white plastic', category: 'solid', color: '#f1f1ef', roughness: 0.5, pattern: { id: 'mosaic', scale: 0.02, contrast: 0.3 } },
  ],
});

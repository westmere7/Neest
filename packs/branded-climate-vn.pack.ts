/**
 * Branded climate (Vietnam) — five cooling and air products found in most Vietnamese homes, at their
 * published sizes.
 *
 * Split air conditioner: the Panasonic CS-XU9ZKH-8 indoor unit (wall-mounted
 * near the ceiling) and the Panasonic CU-XU9ZKH-8 outdoor unit for the balcony. Fans: Panasonic
 * F-409KB stand fan and F-60WWK five-blade ceiling fan. Air: Xiaomi Smart Air Purifier 4.
 *
 * The outdoor unit uses the shared condenser builder in _ac-outdoor-kit.ts (more units: branded-ac-outdoor-vn).
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
import { AC_MATERIALS, AC_PATTERNS, condenser, condenserSlots } from './_ac-outdoor-kit';

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
  description: 'Outdoor condenser for the Panasonic XU9 split system: four-blade fan behind a domed wire grille, Blue Fin coated coil behind guards at the back and side, copper service valves with flare nuts under the side cover and the insulated pipe run, on rubber-padded base rails.',
  ...fixed(0.65, 0.23, 0.511),
  wallSnap: true,
  slots: condenserSlots('climate-casing', 'climate-coil-blue'),
  build: (size) => condenser(size, { fanX: 0.37, fanR: 0.4, guard: 'rings' }),
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
  version: '1.1.0',
  author: 'Neest team',
  description: 'Five cooling and air products common in Vietnamese homes at their published sizes: the Panasonic XU9 split air conditioner (indoor and outdoor units), Panasonic stand and ceiling fans, and the Xiaomi Smart Air Purifier 4.',
  license: 'CC0 (made for Neest); brand names belong to their owners',
  items: [panaIndoor, panaOutdoor, standFan, ceilingFan, purifier],
  patterns: AC_PATTERNS,
  materials: [
    ...AC_MATERIALS,
    { id: 'fan-blade-blue', name: 'Translucent fan blade', category: 'solid', color: '#8fb6d8', roughness: 0.25, opacity: 0.8 },
    { id: 'purifier-perforated', name: 'Perforated white plastic', category: 'solid', color: '#f1f1ef', roughness: 0.5, pattern: { id: 'mosaic', scale: 0.02, contrast: 0.3 } },
  ],
});

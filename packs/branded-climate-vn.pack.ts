/**
 * Branded climate (Vietnam) — ten cooling and air products found in most Vietnamese homes, at their
 * published sizes.
 *
 * Split air conditioner: the Panasonic CS-XU9ZKH-8 indoor unit (wall-mounted
 * near the ceiling) and the Panasonic CU-XU9ZKH-8 outdoor unit for the balcony. Fans: Panasonic
 * F-409KB and Midea FS40-10NAVN(K) stand fans, the Senko BD1410 box fan, the Panasonic F-60WWK
 * five-blade ceiling fan and the F-60GFN ceiling fan with LED light. Air: Xiaomi Smart Air
 * Purifier 4, the Kangaroo KG50F100 evaporative cooler and the Panasonic FV-24CU9 ceiling exhaust
 * fan (only its grille, the part below the ceiling, is modelled).
 *
 * The outdoor unit uses the shared condenser builder in _ac-outdoor-kit.ts (more units: branded-ac-outdoor-vn).
 *
 * Specs come from Vietnamese retailer listings and the makers' sites (`brand.url`). Original
 * procedural shapes: no logos or trademark artwork. Fixed products, so nothing resizes.
 */
import {
  arcPoints,
  box,
  cells,
  circle,
  cyl,
  defineItem,
  definePack,
  discZ,
  lathe,
  line,
  matSlot,
  range,
  rectPoly,
  ring,
  rod,
  slats,
  spaced,
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
  group: 'Air conditioning',
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
  group: 'Air conditioning',
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

// ---------------------------------------------------------------------------
// Air cooler, box fan, bathroom exhaust fan, LED ceiling fan, Midea stand fan
// ---------------------------------------------------------------------------

/** Flat plate facing +z with outline `pts` ([x, y] in metres), from z to z + t. */
function facePlate(slot: string, pts: V2[], z: number, t: number): Part {
  const ys = pts.map((p) => p[1]);
  const mid = (Math.min(...ys) + Math.max(...ys)) / 2;
  const xs = pts.map((p) => p[0]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  // Prism outline lies in X/Z and extrudes along Y; rotating +90° about X turns it to face +z.
  return { shape: 'prism', outline: pts.map(([x, y]) => [x - cx, -(y - mid)] as V2), height: t, position: [cx, mid, z], rotation: [Math.PI / 2, 0, 0], slot, plan: false };
}

const kangarooCooler = defineItem({
  id: 'kangaroo-kg50f100',
  name: 'Kangaroo KG50F100 air cooler',
  category: 'electronics',
  type: 'electronics',
  group: 'Climate',
  tags: [...TAGS, 'kangaroo', 'kg50f100', 'quạt điều hòa', 'quat dieu hoa', 'máy làm mát', 'air cooler', 'evaporative cooler', 'water tank', 'cooling'],
  description: 'Tall white Kangaroo evaporative cooler with a tempered-glass front, swinging vertical louvres over the outlet, a rotary knob and push buttons, a 35-litre tank with a level window, a cooling pad at the back and four castors.',
  ...fixed(0.465, 0.35, 1.0),
  slots: [matSlot('body', 'Body & louvres', 'plastic-white'), matSlot('glass', 'Glass front', 'cooler-glass'), matSlot('pad', 'Cooling pad', 'cooling-pad'), matSlot('dark', 'Outlet, grip & castors', 'solid-black')],
  build: ({ w, d, h }) => {
    const y0 = 0.055;
    const zf = d / 2 - 0.02;
    const zg = zf + 0.008;
    const parts: Part[] = [
      // Wider base skirt holding the tank, the rounded tower above it.
      span('body', [-w / 2, w / 2], [y0, 0.17], [-d / 2, d / 2], { bevel: 0.025 }),
      span('body', [-w / 2 + 0.008, w / 2 - 0.008], [y0 + 0.02, h - 0.003], [-d / 2 + 0.008, zf], { bevel: 0.035 }),
      // Tempered-glass front over the upper body, the outlet with its swinging vertical louvres.
      span('glass', [-w / 2 + 0.035, w / 2 - 0.035], [0.43, h - 0.035], [zf - 0.002, zg], { bevel: 0.006 }),
      span('dark', [-0.13, 0.13], [0.6, 0.92], [zg - 0.001, zg + 0.002], o),
      ...slats('body', [-0.125, 0.125], [0.61, 0.91], [zg + 0.002, zg + 0.012], 9, { axis: 'x', gap: 0.55, plan: false }),
      // Controls on the glass: rotary speed knob and three push buttons.
      discZ('dark', [0.1, 0.52, zg + 0.005], 0.026, 0.01, o),
      span('body', [0.097, 0.103], [0.5, 0.54], [zg + 0.01, zg + 0.012], o),
      // Tank: drawer seam and the water-level window with marks.
      span('dark', [-w / 2 + 0.03, w / 2 - 0.03], [0.395, 0.399], [zf - 0.001, zf + 0.001], o),
      span('glass', [-0.06, 0.06], [0.22, 0.36], [zf - 0.002, zf + 0.002], { bevel: 0.003, plan: false }),
      // Carry grip at the back of the top.
      span('dark', [-0.09, 0.09], [h - 0.006, h], [-d / 2 + 0.03, -d / 2 + 0.065], { bevel: 0.002, plan: false }),
      // Honeycomb cooling pad behind a white slatted rear grille.
      span('pad', [-w / 2 + 0.05, w / 2 - 0.05], [0.22, 0.88], [-d / 2 + 0.003, -d / 2 + 0.008], o),
      ...slats('body', [-w / 2 + 0.05, w / 2 - 0.05], [0.22, 0.88], [-d / 2, -d / 2 + 0.003], 16, { axis: 'y', gap: 0.55, plan: false }),
    ];
    for (const x of [-0.12, -0.075, -0.03]) parts.push(discZ('body', [x, 0.52, zg + 0.002], 0.011, 0.004, o));
    for (const k of range(3)) parts.push(span('dark', [-0.025, 0.025], [0.25 + k * 0.035, 0.253 + k * 0.035], [zf + 0.002, zf + 0.003], o));
    // Side hand grips.
    for (const sx of [-1, 1]) {
      const x0 = sx * (w / 2 - 0.0065);
      parts.push(span('dark', [Math.min(x0, x0 - sx * 0.002), Math.max(x0, x0 - sx * 0.002)], [h - 0.16, h - 0.12], [-0.06, 0.06], o));
    }
    // Castors.
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const x = sx * (w / 2 - 0.06);
        const z = sz * (d / 2 - 0.06);
        parts.push(vcyl('dark', x, z, 0.035, y0 + 0.005, 0.012, o));
        parts.push(cyl('dark', [x, 0.024, z], 0.024, 0.02, { rotation: [0, 0, Math.PI / 2], plan: false }));
      }
    }
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w / 2 + 0.04, d / 2 - 0.02], [w / 2 - 0.04, d / 2 - 0.02])],
  brand: brand('Kangaroo', 'KG50F100', 'Air cooler, 110 W', 'https://www.dienmayxanh.com/quat-dieu-hoa/quat-dieu-hoa-kangaroo-kg50f100-110w', [
    ['Size (W × H × D)', '465 × 1000 × 350 mm'],
    ['Weight', '9.2 kg'],
    ['Power', '110 W'],
    ['Water tank', '35 L'],
    ['Airflow', '4,500 m³/h, rooms ≈ 35 m²'],
    ['Controls', 'Rotary knob and push buttons, 3 speeds'],
  ]),
});

const senkoBoxFan = defineItem({
  id: 'senko-bd1410',
  name: 'Senko BD1410 box fan',
  category: 'living',
  type: 'electronics',
  group: 'Climate',
  tags: [...TAGS, 'senko', 'bd1410', 'box fan', 'quạt hộp', 'quat hop', 'quạt hộp tản gió', 'fan', 'rotating louvre', 'cooling'],
  description: 'The classic Vietnamese box fan: a square plastic housing with a rotating radial-vane louvre (tản gió) in front of three 34 cm blades, push keys on top beside the carry grip, on two foot rails.',
  ...fixed(0.49, 0.196, 0.542),
  slots: [matSlot('body', 'Body', 'plastic-white'), matSlot('grille', 'Rotating louvre', 'box-fan-blue'), matSlot('blades', 'Blades', 'fan-blade-blue'), matSlot('knobs', 'Keys & grip', 'plastic-black')],
  build: ({ w, d, h }) => {
    const y0 = 0.025;
    const t = 0.035;
    const yTop = h - 0.01;
    const ax = w / 2 - t;
    const ayB = y0 + 0.045;
    const ayT = yTop - 0.07;
    const R = Math.min(ax, (ayT - ayB) / 2) - 0.006;
    const yc = (ayT + ayB) / 2;
    const zB = -d / 2;
    const zF = d / 2 - 0.012;
    const parts: Part[] = [
      // Square housing: top band (keys and grip), bottom band and the two side rails.
      span('body', [-w / 2, w / 2], [ayT, yTop], [zB, zF], { bevel: 0.012 }),
      span('body', [-w / 2, w / 2], [y0, ayB], [zB, zF], { bevel: 0.012 }),
      span('body', [-w / 2, -ax], [ayB, ayT], [zB, zF], { bevel: 0.006 }),
      span('body', [ax, w / 2], [ayB, ayT], [zB, zF], { bevel: 0.006 }),
      // Back plate with grille rings, the motor and the blade hub.
      span('body', [-ax, ax], [ayB, ayT], [zB + 0.004, zB + 0.016], o),
      torus('knobs', [0, yc, zB + 0.003], R * 0.5, 0.003, o),
      torus('knobs', [0, yc, zB + 0.003], R * 0.8, 0.003, o),
      discZ('body', [0, yc, zB + 0.05], R * 0.3, 0.06, o),
      cyl('blades', [0, yc, zB + 0.1], 0.035, 0.03, { rotation: [Math.PI / 2, 0, 0], plan: false }),
      // Front bezel round the opening and the rotating louvre: hub, badge and rings.
      torus('body', [0, yc, zF + 0.005], R + 0.006, 0.006, o),
      torus('grille', [0, yc, zF + 0.004], R * 0.62, 0.005, o),
      torus('grille', [0, yc, zF + 0.004], R * 0.95, 0.004, o),
      discZ('grille', [0, yc, zF + 0.003], R * 0.2, 0.012, o),
      discZ('knobs', [0, yc, zF + 0.0105], R * 0.11, 0.003, o),
      // Carry grip recessed in the top band.
      span('knobs', [-0.16, -0.03], [yTop - 0.004, yTop + 0.002], [-0.03, 0.03], o),
    ];
    // Corner fillers between the round opening and the square frame.
    for (const [sx, sy] of [[1, 1], [-1, 1], [-1, -1], [1, -1]] as V2[]) {
      const arc = arcPoints(0, 0, R + 0.004, 0, Math.PI / 2, 8).map(([cx, cz]) => [sx * cx, yc + sy * cz] as V2);
      const yEdge = sy > 0 ? ayT : ayB;
      parts.push(facePlate('body', [[sx * ax, yc], [sx * ax, yEdge], [0, yEdge], ...arc.slice().reverse()], zF - 0.012, 0.012));
    }
    for (const k of range(3)) {
      const a = (k / 3) * Math.PI * 2 + 0.4;
      parts.push(sphere('blades', [Math.cos(a) * 0.085, yc + Math.sin(a) * 0.085, zB + 0.1], 0.5, { scale: [0.16, 0.1, 0.006], rotation: [0, 0, a], plan: false }));
    }
    for (const k of range(16)) {
      const a = (k / 16) * Math.PI * 2;
      parts.push(box('grille', [Math.cos(a) * R * 0.58, yc + Math.sin(a) * R * 0.58, zF + 0.004], [R * 0.78, 0.01, 0.008], { rotation: [0, 0, a + 0.35], plan: false }));
    }
    // Push keys on top: off, three speeds and the louvre switch.
    for (const x of spaced(5, 0.04, ax - 0.02)) parts.push(span('knobs', [x - 0.011, x + 0.011], [yTop - 0.006, h], [-0.01, 0.03], { bevel: 0.003, plan: false }));
    // Foot rails.
    for (const sx of [-1, 1]) parts.push(span('body', [sx * (w / 2 - 0.07) - 0.03, sx * (w / 2 - 0.07) + 0.03], [0, y0], [-d / 2, d / 2], { bevel: 0.008, plan: false }));
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w / 2 + 0.03, d / 2 - 0.012], [w / 2 - 0.03, d / 2 - 0.012])],
  brand: brand('Senko', 'BD1410', 'Box fan with rotating louvre', 'https://cellphones.com.vn/quat-hop-senko-3-canh-bd1410-47w.html', [
    ['Size (W × H × D)', '490 × 542 × 196 mm'],
    ['Weight', '3.6 kg'],
    ['Power', '47 W'],
    ['Blades', '3, 34 cm'],
    ['Speeds', '3, push keys'],
  ]),
});

const panaExhaust = defineItem({
  id: 'panasonic-fv-24cu9',
  name: 'Panasonic FV-24CU9 ceiling exhaust fan',
  category: 'bathroom',
  type: 'electronics',
  group: 'Climate',
  tags: [...TAGS, 'panasonic', 'fv-24cu9', 'exhaust fan', 'quạt hút âm trần', 'quạt thông gió', 'quat hut', 'ventilation', 'bathroom', 'ceiling'],
  description: 'Panasonic duct-type ceiling exhaust fan for bathrooms: only its 300 mm square white grille with fine parallel louvres shows below the ceiling; the sirocco fan and Ø100 duct sit above it.',
  ...fixed(0.3, 0.3, 0.013),
  mount: 'ceiling',
  defaultElevation: CEIL - 0.013,
  slots: [matSlot('grille', 'Grille', 'plastic-white'), matSlot('vent', 'Fan chamber', 'solid-black')],
  build: ({ w, d, h }) => {
    const b = 0.028;
    const parts: Part[] = [
      // Frame of four bevelled rails round the louvre field.
      span('grille', [-w / 2, w / 2], [0, h], [-d / 2, -d / 2 + b], { bevel: 0.004 }),
      span('grille', [-w / 2, w / 2], [0, h], [d / 2 - b, d / 2], { bevel: 0.004 }),
      span('grille', [-w / 2, -w / 2 + b], [0, h], [-d / 2 + b, d / 2 - b], { bevel: 0.004 }),
      span('grille', [w / 2 - b, w / 2], [0, h], [-d / 2 + b, d / 2 - b], { bevel: 0.004 }),
      // Dark fan chamber seen between the louvres.
      span('vent', [-w / 2 + b, w / 2 - b], [h - 0.003, h], [-d / 2 + b, d / 2 - b]),
    ];
    for (const z of cells(16, -d / 2 + b, d / 2 - b)) parts.push(span('grille', [-w / 2 + b, w / 2 - b], [0.003, h - 0.003], [z - 0.0035, z + 0.0035], o));
    return parts;
  },
  planDetail: ({ w, d }) => [rectPoly(-w / 2 + 0.028, -d / 2 + 0.028, w / 2 - 0.028, d / 2 - 0.028)],
  brand: brand('Panasonic', 'FV-24CU9', 'Ceiling-mount ventilating fan, duct type', 'https://dienmaycholon.com/quat/quat-hut-am-tran-panasonic-fv24cu9', [
    ['Grille', '300 × 300 mm, 13 mm below the ceiling (Panasonic drawing)'],
    ['Ceiling cut-out', '240 × 240 mm, Ø100 mm duct'],
    ['Airflow', '140 m³/h'],
    ['Power', '10.5 W'],
    ['Weight', '2.7 kg'],
  ]),
});

/** Flat tapered fan blade from radius r0 outwards (length len), pointing at azimuth a. */
function fanBlade(slot: string, r0: number, len: number, y: number, a: number, t: number): Part {
  const pts: V2[] = [[0, -0.045], [len * 0.7, -0.075], [len * 0.93, -0.07], [len, -0.035], [len, 0.03], [len * 0.93, 0.068], [len * 0.7, 0.075], [0, 0.045]];
  const rc = r0 + len / 2;
  return { shape: 'prism', outline: pts.map(([x, z]) => [x - len / 2, z] as V2), height: t, position: [Math.cos(a) * rc, y, Math.sin(a) * rc], rotation: [0, -a, -0.02], slot };
}

const panaLedFan = defineItem({
  id: 'panasonic-f-60gfn',
  name: 'Panasonic F-60GFN ceiling fan with LED light',
  category: 'lighting',
  type: 'lighting',
  group: 'Ceiling lights',
  tags: [...TAGS, 'panasonic', 'f-60gfn', 'ceiling fan', 'quạt trần', 'quạt trần đèn', 'fan light', 'light kit', 'led', 'dc motor', '5 cánh', 'remote'],
  description: 'Panasonic 150 cm five-blade DC ceiling fan with an 18 W round LED light under its slim white motor, white PPG fibreglass blades and a short downrod.',
  ...fixed(1.5, 1.5, 0.288),
  mount: 'ceiling',
  defaultElevation: CEIL - 0.288,
  slots: [matSlot('body', 'Motor & canopy', 'plastic-white'), matSlot('blades', 'Blades', 'solid-white'), matSlot('light', 'LED light', 'light-warm')],
  light: { color: '#fff1dc', intensity: 1.3, distance: 6, y: 0.01 },
  build: ({ w, h }) => {
    const kitH = 0.045;
    const m1 = kitH + 0.09;
    const bladeY = kitH + 0.03;
    const parts: Part[] = [
      // Ceiling canopy, downrod and coupling.
      lathe('body', [0, h - 0.075, 0], [[0, 0], [0.035, 0], [0.075, 0.06], [0.08, 0.075], [0, 0.075]], { segments: 32, plan: false }),
      vcyl('body', 0, 0, m1 + 0.02, h - 0.07, 0.013, o),
      vcyl('body', 0, 0, m1 - 0.005, m1 + 0.035, 0.03, o),
      // Slim DC motor housing with a trim line.
      lathe('body', [0, kitH, 0], [[0.13, 0], [0.175, 0.012], [0.19, 0.04], [0.18, 0.07], [0.12, 0.085], [0.04, 0.09], [0, 0.09]], { segments: 40 }),
      ring('body', [0, kitH + 0.04, 0], 0.188, 0.004, o),
      // Round LED light under the motor.
      lathe('light', [0, 0, 0], [[0, 0], [0.1, 0.003], [0.15, 0.015], [0.16, 0.035], [0.155, kitH], [0, kitH]], { segments: 40, plan: false }),
      ring('body', [0, kitH - 0.002, 0], 0.158, 0.004, o),
    ];
    for (const k of range(5)) {
      const a = (k / 5) * Math.PI * 2;
      parts.push(box('body', [Math.cos(a) * 0.24, bladeY + 0.013, Math.sin(a) * 0.24], [0.14, 0.01, 0.035], { rotation: [0, -a, 0], plan: false }));
      parts.push(fanBlade('blades', 0.2, w / 2 - 0.21, bladeY, a, 0.008));
    }
    return parts;
  },
  planDetail: ({ w }) => [circle([0, 0], w / 2 - 0.01), circle([0, 0], 0.19)],
  brand: brand('Panasonic', 'F-60GFN', 'DC ceiling fan with LED light', 'https://www.dienmayxanh.com/quat-tran/quat-tran-panasonic-5-canh-f-60gfn-58w', [
    ['Sweep', '150 cm, 5 PPG fibreglass blades'],
    ['Size (W × H × D)', '1500 × 288 × 1500 mm'],
    ['Power', '58 W (fan 40 W, LED 18 W)'],
    ['Weight', '6.1 kg'],
    ['Motor', 'DC, 9 speeds, remote'],
  ]),
});

const mideaStandFan = defineItem({
  id: 'midea-fs40-10navn',
  name: 'Midea FS40-10NAVN(K) stand fan',
  category: 'electronics',
  type: 'electronics',
  group: 'Climate',
  tags: [...TAGS, 'midea', 'fs40-10navn', 'quạt đứng', 'quạt cây', 'stand fan', 'pedestal fan', 'fan', 'cooling'],
  description: 'Budget Midea pedestal fan in black: a round base with 0–3 push keys, a slim telescopic pole and three translucent blades in a fine wire cage.',
  ...fixed(0.395, 0.395, 1.305),
  slots: [matSlot('body', 'Body & base', 'plastic-black'), matSlot('blade', 'Blades', 'fan-blade-smoke'), matSlot('cage', 'Cage', 'metal-black-matte'), matSlot('trim', 'Keys & trim', 'solid-light-grey')],
  build: ({ h }) => {
    const parts: Part[] = [
      lathe('body', [0, 0, 0], [[0, 0], [0.19, 0], [0.195, 0.012], [0.17, 0.045], [0.06, 0.07], [0, 0.07]], { segments: 40 }),
      // Telescopic pole: lower tube, height clamp, upper tube.
      vcyl('body', 0, 0, 0.07, h * 0.58, 0.017, o),
      vcyl('trim', 0, 0, h * 0.56, h * 0.6, 0.021, o),
      vcyl('body', 0, 0, h * 0.6, h - 0.27, 0.012, o),
    ];
    // Push keys 0–3 on the sloping front of the base.
    for (const x of spaced(4, -0.045, 0.045)) parts.push(span('trim', [x - 0.011, x + 0.011], [0.05, 0.062], [0.1, 0.13], { rotation: [0.22, 0, 0], bevel: 0.002, plan: false }));
    const cy = h - 0.205;
    const R = 0.19;
    const zc = 0.03;
    // Tilt yoke and motor with its rear cap and oscillation knob.
    parts.push(
      rod('body', [0, h - 0.28, 0], [0, cy - 0.05, -0.1], 0.016, o),
      discZ('body', [0, cy, -0.1], 0.07, 0.11, { segments: 28, plan: false }),
      sphere('body', [0, cy, -0.155], 0.05, { scale: [1, 1, 0.5], plan: false }),
      vcyl('trim', 0, -0.12, cy + 0.06, cy + 0.085, 0.008, o),
    );
    // Cage: back and front rims, ribs, two front rings and a badge.
    for (const z of [zc - 0.055, zc + 0.055]) parts.push(torus('cage', [0, cy, z], R, 0.004, o));
    parts.push(torus('cage', [0, cy, zc + 0.062], R * 0.66, 0.002, o), torus('cage', [0, cy, zc + 0.066], R * 0.36, 0.002, o));
    for (const k of range(20)) {
      const a = (k / 20) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      parts.push(rod('cage', [c * R, cy + s * R, zc - 0.055], [c * R, cy + s * R, zc + 0.055], 0.0018, o));
      parts.push(rod('cage', [c * R, cy + s * R, zc + 0.055], [c * 0.05, cy + s * 0.05, zc + 0.07], 0.0015, o));
      parts.push(rod('cage', [c * R, cy + s * R, zc - 0.055], [c * 0.07, cy + s * 0.07, -0.06], 0.0015, o));
    }
    parts.push(discZ('trim', [0, cy, zc + 0.073], 0.05, 0.006, o));
    // Three translucent blades on a hub.
    for (const k of range(3)) {
      const a = (k / 3) * Math.PI * 2 + 0.3;
      parts.push(sphere('blade', [Math.cos(a) * 0.085, cy + Math.sin(a) * 0.085, zc], 0.5, { scale: [0.16, 0.12, 0.008], rotation: [0.25, 0, a], plan: false }));
    }
    parts.push(cyl('blade', [0, cy, zc], 0.04, 0.03, { rotation: [Math.PI / 2, 0, 0], plan: false }));
    return parts;
  },
  brand: brand('Midea', 'FS40-10NAVN(K)', 'Stand fan, 3 blades', 'https://www.dienmayxanh.com/quat/quat-dung-midea-fs40-10navn-k-55w', [
    ['Size (W × H × D)', '395 × 1085–1305 × 395 mm (shown fully raised)'],
    ['Blades', '3, 40 cm'],
    ['Power', '55 W'],
    ['Weight', '5.9 kg'],
    ['Controls', 'Push keys, 3 speeds'],
  ]),
});

export default definePack({
  name: 'Branded climate (Vietnam)',
  version: '1.2.0',
  author: 'Neest team',
  description: 'Ten cooling and air products common in Vietnamese homes at their published sizes: the Panasonic XU9 split air conditioner (indoor and outdoor units), Panasonic and Midea stand fans, the Senko BD1410 box fan, Panasonic ceiling fans (one with an LED light), the Kangaroo KG50F100 air cooler, the Panasonic FV-24CU9 bathroom exhaust fan and the Xiaomi Smart Air Purifier 4.',
  license: 'CC0 (made for Neest); brand names belong to their owners',
  items: [panaIndoor, panaOutdoor, standFan, ceilingFan, purifier, kangarooCooler, senkoBoxFan, panaExhaust, panaLedFan, mideaStandFan],
  patterns: AC_PATTERNS,
  materials: [
    ...AC_MATERIALS,
    { id: 'fan-blade-blue', name: 'Translucent fan blade', category: 'solid', color: '#8fb6d8', roughness: 0.25, opacity: 0.8 },
    { id: 'cooler-glass', name: 'Smoked tempered glass', category: 'solid', color: '#2a2e33', roughness: 0.08 },
    { id: 'cooling-pad', name: 'Cellulose cooling pad', category: 'solid', color: '#c99659', roughness: 0.95, pattern: { id: 'hex', scale: 0.05, contrast: 0.8 } },
    { id: 'box-fan-blue', name: 'Box-fan blue plastic', category: 'solid', color: '#5aa6d6', roughness: 0.4 },
    { id: 'fan-blade-smoke', name: 'Smoked fan blade', category: 'solid', color: '#5d6168', roughness: 0.25, opacity: 0.8 },
    { id: 'purifier-perforated', name: 'Perforated white plastic', category: 'solid', color: '#f1f1ef', roughness: 0.5, pattern: { id: 'mosaic', scale: 0.02, contrast: 0.3 } },
  ],
});

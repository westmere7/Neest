/**
 * AC outdoor units — generic split air-conditioner condensers in the usual sizes (9,000 to
 * 24,000 BTU wall units, a twin-fan multi-split unit, a twin-fan side-discharge VRF cabinet), a window
 * air conditioner, and the wall bracket and rooftop stand they stand on.
 *
 * The condensers share `condenser()` from `_ac-outdoor-kit.ts` with the branded units; here they
 * resize within a realistic range and offer casing and coil finishes as hand-made variants.
 */
import { defineItem, definePack, matSlot, type AssetPresetVariant, type PackItem, type Size3 } from '@/packs/kit';
import { AC_MATERIALS, AC_PATTERNS, condenser, condenserSlots, rooftopStand, wallBracket, windowUnit, type CondenserSpec } from './_ac-outdoor-kit';

const TAGS = ['air conditioner', 'climate', 'outdoor unit', 'condenser', 'dàn nóng', 'cục nóng', 'điều hòa'];

const FINISHES: AssetPresetVariant[] = [
  { id: 'ivory', name: 'Warm ivory', materials: { body: 'climate-casing-ivory' } },
  { id: 'grey', name: 'Light grey', materials: { body: 'climate-casing-grey' } },
  { id: 'charcoal', name: 'Charcoal', materials: { body: 'climate-casing-charcoal' } },
  { id: 'blue-fin', name: 'White, blue-fin coil', materials: { fins: 'climate-coil-blue' } },
  { id: 'gold-fin', name: 'White, gold-fin coil', materials: { fins: 'climate-coil-gold' } },
];

/** Size range ±`k` around the default (metres). */
function around(s: Size3, k: [number, number, number]) {
  return {
    defaultSize: s,
    minSize: { w: s.w - k[0], d: s.d - k[2], h: s.h - k[1] },
    maxSize: { w: s.w + k[0], d: s.d + k[2], h: s.h + k[1] },
    resizable: { w: true, d: true, h: true },
  };
}

function unit(id: string, name: string, size: Size3, k: [number, number, number], spec: CondenserSpec, tags: string[], description: string): PackItem {
  return defineItem({
    id,
    name,
    category: 'outdoor',
    type: 'electronics',
    group: 'Air conditioning',
    tags: [...TAGS, ...tags],
    description,
    ...around(size, k),
    wallSnap: true,
    slots: condenserSlots(),
    variants: FINISHES,
    build: (s) => condenser(s, spec),
  });
}

const unit9k = unit(
  'outdoor-unit-9000btu',
  'Compact outdoor unit, 9,000 BTU',
  { w: 0.7, d: 0.25, h: 0.48 },
  [0.08, 0.05, 0.03],
  { fanX: 0.38, fanR: 0.41, guard: 'rings' },
  ['1 hp', '9000 btu', 'split ac', 'balcony', 'small'],
  'Small wall-split condenser for a bedroom unit: a domed ring-and-spoke wire grille over a four-blade fan, aluminium coil behind guards at the side and back, the valve cover with copper valves on the right, on two base rails.',
);

const unit24k = unit(
  'outdoor-unit-24000btu',
  'Large outdoor unit, 24,000 BTU',
  { w: 0.9, d: 0.34, h: 0.7 },
  [0.08, 0.06, 0.03],
  { fanX: 0.37, fanR: 0.41, guard: 'grid', blades: 3, ribs: 3 },
  ['2.5 hp', '24000 btu', 'split ac', 'large'],
  'Big single-fan condenser for a large room: a square wire mesh guard over a three-blade fan, a deep casing with three stamped ribs on top, aluminium coil behind guards and a wide valve cover on the right.',
);

const twinMulti = unit(
  'outdoor-unit-twin-fan-multi',
  'Twin-fan multi-split outdoor unit',
  { w: 0.95, d: 0.34, h: 1.25 },
  [0.06, 0.1, 0.03],
  { fans: 2, fanX: 0.4, fanR: 0.2, guard: 'rings', dome: 0.01, ribs: 3 },
  ['multi split', 'twin fan', '36000 btu', '48000 btu', 'commercial', 'front discharge'],
  'Tall front-discharge outdoor unit for a multi-split or large ducted system: two stacked fans behind domed ring grilles, aluminium coil on the side and back, the valve cover for the pipe sets on the right, on base rails.',
);

const vrfTwin = unit(
  'outdoor-unit-side-discharge-twin',
  'Twin-fan side-discharge VRF outdoor unit',
  { w: 0.99, d: 0.34, h: 1.38 },
  [0.06, 0.08, 0.03],
  { layout: 'cabinet', fans: 2, fanR: 0.23, guard: 'rings', dome: 0.008, blades: 3, column: 0.2 },
  ['vrf', 'vrv', 'mini vrf', 'twin fan', 'side discharge', 'inverter', 'cabinet', 'commercial', '6 hp'],
  'Tall twin-fan VRF cabinet for apartments and shops: two stacked fans behind domed ring guards, coil on the side and back, the service panel, rating plate and pipe valves on the front right, on a base frame with forklift openings.',
);

const windowAc = defineItem({
  id: 'window-air-conditioner',
  name: 'Window air conditioner, 9,000 BTU',
  category: 'outdoor',
  type: 'electronics',
  group: 'Air conditioning',
  tags: ['air conditioner', 'window ac', 'window type', 'through the wall', 'máy lạnh cửa sổ', 'điều hòa cửa sổ', '9000 btu'],
  description:
    'Compact window-type air conditioner that sits through a wall or window opening: a plastic room-side front with an intake grille, top vanes, two knobs and a display; the steel chassis behind with louvred side and top vents and the condenser coil at the back.',
  ...around({ w: 0.47, d: 0.6, h: 0.36 }, [0.07, 0.05, 0.08]),
  mount: 'wall',
  defaultElevation: 1.2,
  slots: [matSlot('body', 'Steel chassis', 'climate-casing-ivory'), matSlot('front', 'Room-side front', 'plastic-white'), matSlot('grille', 'Vents & knobs', 'plastic-black'), matSlot('fins', 'Condenser coil', 'climate-coil')],
  build: (s) => windowUnit(s),
});

const bracket = defineItem({
  id: 'ac-wall-bracket',
  name: 'Outdoor unit wall bracket',
  category: 'outdoor',
  type: 'electronics',
  group: 'Air conditioning',
  tags: ['wall bracket', 'ac bracket', 'giá đỡ cục nóng', 'giá treo dàn nóng', 'mount', 'galvanised'],
  description:
    'Pair of galvanised angle-iron brackets for hanging an outdoor unit on a wall: uprights bolted on with anchor bolts, horizontal arms with diagonal braces, rubber anti-vibration pads, plastic end caps and a front tie bar.',
  defaultSize: { w: 0.8, d: 0.45, h: 0.4 },
  minSize: { w: 0.5, d: 0.32, h: 0.3 },
  maxSize: { w: 1.2, d: 0.6, h: 0.55 },
  resizable: { w: true, d: true, h: true },
  mount: 'wall',
  defaultElevation: 1.6,
  wallSnap: true,
  slots: [matSlot('steel', 'Brackets', 'climate-galvanised'), matSlot('pads', 'Rubber pads & caps', 'rubber-black'), matSlot('bolts', 'Anchor bolts', 'metal-brushed-steel')],
  variants: [
    { id: 'white', name: 'White powder-coated', materials: { steel: 'metal-white-powder' } },
    { id: 'black', name: 'Black powder-coated', materials: { steel: 'metal-black-matte' } },
  ],
  build: (s) => wallBracket(s),
});

const stand = defineItem({
  id: 'ac-rooftop-stand',
  name: 'Outdoor unit rooftop stand',
  category: 'outdoor',
  type: 'electronics',
  group: 'Air conditioning',
  tags: ['rooftop stand', 'floor stand', 'giá đặt sàn', 'chân đế dàn nóng', 'roof', 'terrace', 'galvanised'],
  description:
    'Galvanised steel stand that lifts an outdoor unit off a roof or terrace: four posts on base plates over two concrete sleepers, side rails with diagonal braces, and front and back top rails with rubber anti-vibration pads.',
  defaultSize: { w: 1.0, d: 0.5, h: 0.35 },
  minSize: { w: 0.7, d: 0.38, h: 0.25 },
  maxSize: { w: 1.4, d: 0.7, h: 0.6 },
  resizable: { w: true, d: true, h: true },
  slots: [matSlot('frame', 'Steel frame', 'climate-galvanised'), matSlot('pads', 'Rubber pads', 'rubber-black'), matSlot('base', 'Concrete sleepers', 'concrete-grey')],
  variants: [{ id: 'black', name: 'Black powder-coated', materials: { frame: 'metal-black-matte' } }],
  build: (s) => rooftopStand(s),
});

export default definePack({
  name: 'AC outdoor units',
  version: '1.0.0',
  author: 'Neest team',
  description:
    'Generic air-conditioner outdoor units from 9,000 to 24,000 BTU, a twin-fan multi-split unit, a twin-fan side-discharge VRF cabinet and a window air conditioner, plus a wall bracket and a rooftop stand to put them on.',
  license: 'CC0 (made for Neest)',
  items: [unit9k, unit24k, twinMulti, vrfTwin, windowAc, bracket, stand],
  patterns: AC_PATTERNS,
  materials: AC_MATERIALS,
});

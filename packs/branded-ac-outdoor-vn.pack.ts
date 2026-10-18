/**
 * Branded AC outdoor units (Vietnam) — split air-conditioner condensers sold in Vietnam, built to
 * their published outdoor-unit sizes (W × H × D from Vietnamese retailer listings and the makers'
 * sites, `brand.url`): wall units from 9,000 to 24,000 BTU, Daikin multi-split outdoor units, and
 * side-discharge mini-VRF cabinets with one or two fans.
 *
 * All share `condenser()` from `_ac-outdoor-kit.ts` (also used by the Panasonic CU-XU9ZKH-8 in
 * branded-climate-vn): the fan guard style, fan count and position, coil coating and casing colour
 * follow each maker's look. Original procedural shapes: no logos or trademark artwork, and the
 * label plates carry only printed lines. Fixed products, so nothing resizes.
 */
import { defineItem, definePack, type PackItem, type Size3 } from '@/packs/kit';
import { AC_MATERIALS, AC_PATTERNS, condenser, condenserSlots, type CondenserSpec } from './_ac-outdoor-kit';

const TAGS = ['branded', 'vietnam', 'climate', 'air conditioner', 'outdoor unit', 'condenser', 'dàn nóng', 'cục nóng'];

interface Unit {
  id: string;
  name: string;
  brand: string;
  model: string;
  line: string;
  url: string;
  /** Outdoor unit W × H × D in millimetres, as published. */
  mm: [number, number, number];
  /** Published weight (kg), when listed. */
  kg?: number | string;
  capacity: string;
  tags: string[];
  description: string;
  spec: CondenserSpec;
  casing?: string;
  coil?: string;
  specs?: [string, string][];
}

function unit(u: Unit): PackItem {
  const [W, H, D] = u.mm;
  const s: Size3 = { w: W / 1000, d: D / 1000, h: H / 1000 };
  return defineItem({
    id: u.id,
    name: u.name,
    category: 'outdoor',
    type: 'electronics',
    group: 'Climate',
    tags: [...TAGS, ...u.tags],
    description: u.description,
    defaultSize: s,
    minSize: s,
    maxSize: s,
    resizable: { w: false, d: false, h: false },
    wallSnap: true,
    slots: condenserSlots(u.casing, u.coil),
    build: (size) => condenser(size, u.spec),
    brand: {
      name: u.brand,
      model: u.model,
      line: u.line,
      url: u.url,
      specs: [['Outdoor unit (W × H × D)', `${W} × ${H} × ${D} mm`], ...(u.kg !== undefined ? [['Weight', `${u.kg} kg`] as [string, string]] : []), ['Capacity', u.capacity], ...(u.specs ?? [])],
    },
  });
}

const DMX = 'https://www.dienmayxanh.com/may-lanh/';

// ───────────────────────── Daikin ─────────────────────────

const daikinRkb25 = unit({
  id: 'daikin-rkb25wmvmv',
  name: 'Daikin RKB25WMVMV outdoor unit',
  brand: 'Daikin',
  model: 'RKB25WMVMV',
  line: 'FTKB inverter, 1 HP (indoor FTKB25WMVMV)',
  url: `${DMX}daikin-inverter-1-hp-ftkb25wmvmv`,
  mm: [745, 418, 270],
  kg: 19,
  capacity: '8,500 BTU (1 HP)',
  tags: ['daikin', '1 hp', '9000 btu', 'inverter'],
  description: 'Low, wide Daikin 1 HP condenser: a square black louvre grille over the fan, blue-fin coated coil behind wire guards at the side and back, the valve cover on the right, on two base rails.',
  spec: { fanX: 0.37, fanR: 0.43, guard: 'louvre', blades: 3 },
  coil: 'climate-coil-blue',
});

const daikinRkf50 = unit({
  id: 'daikin-rkf50xvmv',
  name: 'Daikin RKF50XVMV outdoor unit',
  brand: 'Daikin',
  model: 'RKF50XVMV',
  line: 'FTKF inverter, 2 HP (indoor FTKF50XVMV)',
  url: `${DMX}daikin-inverter-2-hp-ftkf50xvmv`,
  mm: [675, 550, 284],
  kg: 26,
  capacity: '17,000 BTU (2 HP)',
  tags: ['daikin', '2 hp', '18000 btu', 'inverter', 'compact'],
  description: 'Compact, tall Daikin 2 HP condenser for narrow balconies: a big fan behind a square louvre grille almost the full casing height, blue-fin coil at the side and back, valve cover and copper valves on the right.',
  spec: { fanX: 0.4, fanR: 0.43, guard: 'louvre', blades: 3 },
  coil: 'climate-coil-blue',
});

const daikinRky50 = unit({
  id: 'daikin-rky50wvmv',
  name: 'Daikin RKY50WVMV outdoor unit',
  brand: 'Daikin',
  model: 'RKY50WVMV',
  line: 'FTKY inverter, 2 HP (indoor FTKY50WVMV)',
  url: `${DMX}daikin-inverter-2-hp-ftky50wvmv`,
  mm: [845, 595, 300],
  kg: 34,
  capacity: '17,700 BTU (2 HP)',
  tags: ['daikin', '2 hp', '18000 btu', 'inverter'],
  description: 'Daikin 2 HP condenser with a fine radial wire guard over a three-blade fan, blue-fin coil behind guards on the side and back, a ribbed top panel and the service valves under the right-hand cover.',
  spec: { fanX: 0.38, fanR: 0.4, guard: 'radial', blades: 3 },
  coil: 'climate-coil-blue',
});

const daikin4mkm = unit({
  id: 'daikin-4mkm80rvmv',
  name: 'Daikin 4MKM80RVMV multi outdoor unit',
  brand: 'Daikin',
  model: '4MKM80RVMV',
  line: 'Multi NX inverter, up to 4 indoor units',
  url: 'https://meta.vn/dan-nong-1-chieu-multi-nx-daikin-4mkm80rvmv-inverter-p83286',
  mm: [930, 695, 350],
  kg: 52,
  capacity: '27,000 BTU (3 HP)',
  tags: ['daikin', 'multi', 'multi split', 'multi nx', '3 hp', '27000 btu', 'inverter'],
  description: 'Daikin Multi NX outdoor unit that runs up to four indoor units: a wide casing with a large fan behind horizontal guard bars, blue-fin coil on the side and back, and the valve cover for the pipe sets on the right.',
  spec: { fanX: 0.37, fanR: 0.41, guard: 'hbars', blades: 3, ribs: 3 },
  coil: 'climate-coil-blue',
  specs: [['Same casing', '3MKM52RVMV (18,000 BTU, 49 kg)']],
});

const daikin5mkm = unit({
  id: 'daikin-5mkm100rvmv',
  name: 'Daikin 5MKM100RVMV multi outdoor unit',
  brand: 'Daikin',
  model: '5MKM100RVMV',
  line: 'Multi NX inverter, up to 5 indoor units',
  url: 'https://meta.vn/dan-nong-dieu-hoa-1-chieu-multi-nx-daikin-5mkm100rvmv-34-000btu-inverter-p81425',
  mm: [940, 990, 320],
  kg: 79,
  capacity: '34,000 BTU (4 HP)',
  tags: ['daikin', 'multi', 'multi split', 'multi nx', 'side discharge', '4 hp', 'vrv', 'cabinet'],
  description: 'Tall side-discharge Daikin Multi NX cabinet for up to five indoor units: one big three-blade fan behind a radial wire guard, a screwed service panel and the pipe valves on the front right, on a base frame with forklift openings.',
  spec: { layout: 'cabinet', fanR: 0.34, guard: 'radial', blades: 3, column: 0.22 },
  coil: 'climate-coil-blue',
});

// ───────────────────────── Panasonic ─────────────────────────

const panaXu12 = unit({
  id: 'panasonic-cu-xu12zkh-8',
  name: 'Panasonic CU-XU12ZKH-8 outdoor unit',
  brand: 'Panasonic',
  model: 'CU-XU12ZKH-8',
  line: 'XU inverter, 1.5 HP (indoor CS-XU12ZKH-8)',
  url: 'https://hoanghamobile.com/dieu-hoa/panasonic-inverter-1-5-hp-cu-cs-xu12zkh-8',
  mm: [780, 542, 289],
  kg: 22,
  capacity: '11,900 BTU (1.5 HP)',
  tags: ['panasonic', '1.5 hp', '12000 btu', 'inverter', 'blue fin'],
  description: 'Panasonic XU 1.5 HP condenser: a domed wire grille of rings and spokes over a four-blade fan, Blue Fin coated coil behind guards, copper service valves and the insulated pipe run under the right-hand cover.',
  spec: { fanX: 0.37, fanR: 0.4, guard: 'rings' },
  coil: 'climate-coil-blue',
});

const panaN24 = unit({
  id: 'panasonic-cu-n24zkh-8',
  name: 'Panasonic CU-N24ZKH-8 outdoor unit',
  brand: 'Panasonic',
  model: 'CU-N24ZKH-8',
  line: 'N standard (non-inverter), 2.5 HP (indoor CS-N24ZKH-8)',
  url: 'https://www.panasonic.com/vn/air-solutions/detailed-page/air-conditioner/single-split-wall-mount-air-conditioner/non-inverter-cooling-only/cu-cs-n24zkh-8.html',
  mm: [824, 619, 299],
  kg: 42,
  capacity: '24,000 BTU (2.5 HP)',
  tags: ['panasonic', '2.5 hp', '24000 btu', 'non inverter'],
  description: 'Panasonic N-series 24,000 BTU fixed-speed condenser: a heavy casing with a domed ring-and-spoke grille, plain aluminium coil behind wire guards, and copper service valves under the right-hand cover.',
  spec: { fanX: 0.38, fanR: 0.41, guard: 'rings' },
});

// ───────────────────────── LG ─────────────────────────

const lgV10 = unit({
  id: 'lg-v10api1',
  name: 'LG V10API1 outdoor unit',
  brand: 'LG',
  model: 'V10API1',
  line: 'Dual Inverter, 1 HP',
  url: `${DMX}lg-v10api1`,
  mm: [822, 500, 257],
  kg: 21.7,
  capacity: '9,200 BTU (1 HP)',
  tags: ['lg', 'dual inverter', '1 hp', '9000 btu', 'gold fin'],
  description: 'LG Dual Inverter 1 HP condenser: a single spiral wire guard over the fan, gold-coated (Gold Fin) coil behind guards at the side and back, the valve cover on the right, on rubber-padded rails.',
  spec: { fanX: 0.38, fanR: 0.41, guard: 'spiral' },
  coil: 'climate-coil-gold',
});

// ───────────────────────── Casper ─────────────────────────

const casper09 = unit({
  id: 'casper-gc-09is35',
  name: 'Casper GC-09IS35 outdoor unit',
  brand: 'Casper',
  model: 'GC-09IS35',
  line: 'Inverter, 1 HP',
  url: `${DMX}casper-inverter-1-hp-gc-09is35`,
  mm: [703, 455, 233],
  kg: 16,
  capacity: '9,300 BTU (1 HP)',
  tags: ['casper', 'inverter', '1 hp', '9000 btu', 'gold fin'],
  description: 'Small, light Casper 1 HP condenser: a domed wire ring grille over a four-blade fan, golden coated coil behind guards, a compact valve cover on the right and two base rails.',
  spec: { fanX: 0.38, fanR: 0.41, guard: 'rings', dome: 0.008 },
  coil: 'climate-coil-gold',
});

// ───────────────────────── Mitsubishi ─────────────────────────

const mitsuJy50 = unit({
  id: 'mitsubishi-electric-muy-jy50vf',
  name: 'Mitsubishi Electric MUY-JY50VF outdoor unit',
  brand: 'Mitsubishi Electric',
  model: 'MUY-JY50VF',
  line: 'JY inverter, 2 HP (indoor MSY-JY50VF)',
  url: 'https://meta.vn/dieu-hoa-mitsubishi-electric-msy-jy50vf-p111103',
  mm: [780, 545, 294],
  kg: 26.5,
  capacity: '18,000 BTU (2 HP)',
  tags: ['mitsubishi', 'mitsubishi electric', 'inverter', '2 hp', '18000 btu'],
  description: 'Mitsubishi Electric 2 HP condenser in warm ivory with a diamond-pattern wire guard over a three-blade fan, louvred coil on the side and back and the service valves under the right-hand cover.',
  spec: { fanX: 0.38, fanR: 0.41, guard: 'diamond', blades: 3 },
  casing: 'climate-casing-ivory',
  coil: 'climate-coil-louvre',
});

const mitsuPumy = unit({
  id: 'mitsubishi-electric-pumy-p125vkm',
  name: 'Mitsubishi Electric PUMY-P125VKM outdoor unit',
  brand: 'Mitsubishi Electric',
  model: 'PUMY-P125VKM',
  line: 'City Multi PUMY (mini VRF), twin fan',
  url: 'https://climacom.com/en/?p=12260',
  mm: [1050, 1338, 330],
  kg: '122–125',
  capacity: '14 kW (≈ 48,000 BTU, 5 HP)',
  tags: ['mitsubishi', 'mitsubishi electric', 'city multi', 'vrf', 'mini vrf', 'twin fan', 'side discharge', 'cabinet', 'commercial'],
  description: 'Tall twin-fan Mitsubishi Electric City Multi cabinet: two stacked fans behind square mesh guards blowing out of the front, louvred coil on the side and back, a service panel with the rating plate and pipe valves on the front right, on a base frame.',
  spec: { layout: 'cabinet', fans: 2, fanR: 0.23, guard: 'grid', blades: 3, column: 0.2 },
  casing: 'climate-casing-ivory',
  coil: 'climate-coil-louvre',
  specs: [['Base', '+40 mm feet (not in the height)']],
});

// ───────────────────────── Samsung ─────────────────────────

const samsungAr13 = unit({
  id: 'samsung-ar13cyfaawknsv',
  name: 'Samsung AR13CYFAAWKNSV outdoor unit',
  brand: 'Samsung',
  model: 'AR13CYFAAWKNSV',
  line: 'WindFree inverter, 1.5 HP',
  url: `${DMX}samsung-inverter-15-hp-ar13cyfaawknsv`,
  mm: [720, 548, 265],
  kg: 22.6,
  capacity: '12,000 BTU (1.5 HP)',
  tags: ['samsung', 'windfree', 'inverter', '1.5 hp', '12000 btu'],
  description: 'Samsung WindFree 1.5 HP condenser, taller than the Digital Inverter models: a large three-blade fan behind horizontal guard bars, louvred coil, copper service valves under the right-hand cover.',
  spec: { fanX: 0.4, fanR: 0.42, guard: 'hbars', blades: 3 },
  coil: 'climate-coil-louvre',
});

const samsungDvm = unit({
  id: 'samsung-dvm-s-eco-am060fxmdgh',
  name: 'Samsung DVM S Eco AM060FXMDGH outdoor unit',
  brand: 'Samsung',
  model: 'AM060FXMDGH',
  line: 'DVM S Eco (mini VRF), twin fan',
  url: 'https://www.samsung.com/id/business/air-conditioners/ac-dvm-amxxxfxmdghtk/am060fxmdghtk/',
  mm: [940, 1210, 330],
  capacity: '6 HP (≈ 16 kW)',
  tags: ['samsung', 'dvm', 'dvm s eco', 'vrf', 'mini vrf', 'twin fan', 'side discharge', 'cabinet', 'commercial'],
  description: 'Samsung DVM S Eco mini-VRF cabinet in light grey: two stacked fans behind round guards of horizontal bars, louvred coil on the side and back, the service panel, rating plate and pipe valves on the front right, on a base frame.',
  spec: { layout: 'cabinet', fans: 2, fanR: 0.23, guard: 'hbars', blades: 3, column: 0.2 },
  casing: 'climate-casing-grey',
  coil: 'climate-coil-louvre',
  specs: [['Fan motors', '2 × 125 W']],
});

// ───────────────────────── Toshiba, Gree, Nagakawa, Sharp, MHI ─────────────────────────

const toshibaH10 = unit({
  id: 'toshiba-ras-h10c4kcvg-v',
  name: 'Toshiba RAS-H10C4KCVG-V outdoor unit',
  brand: 'Toshiba',
  model: 'RAS-H10C4KCVG-V',
  line: 'Inverter, 1 HP',
  url: `${DMX}toshiba-1-hp-inverter-ras-h10c4kcvg-v`,
  mm: [655, 530, 210],
  kg: 17,
  capacity: '9,000 BTU (1 HP)',
  tags: ['toshiba', 'inverter', '1 hp', '9000 btu', 'slim'],
  description: 'Slim Toshiba 1 HP condenser only 21 cm deep: a spiral wire guard over the fan, aluminium coil behind guards at the side and back, a narrow valve cover with copper valves on the right.',
  spec: { fanX: 0.4, fanR: 0.41, guard: 'spiral', dome: 0.004 },
});

const greeGwc09 = unit({
  id: 'gree-gwc09pb-k3d0p4',
  name: 'Gree GWC09PB-K3D0P4 outdoor unit',
  brand: 'Gree',
  model: 'GWC09PB-K3D0P4',
  line: 'Inverter, 1 HP',
  url: `${DMX}gree-gwc09pb-k3d0p4`,
  mm: [760, 550, 268],
  kg: 19.5,
  capacity: '9,000 BTU (1 HP)',
  tags: ['gree', 'inverter', '1 hp', '9000 btu', 'gold fin'],
  description: 'Gree 1 HP condenser: a spiral wire guard over a four-blade fan, golden anti-corrosion coated coil behind wire guards, the valve cover and copper valves on the right, on base rails.',
  spec: { fanX: 0.39, fanR: 0.41, guard: 'spiral' },
  coil: 'climate-coil-gold',
});

const nagakawa09 = unit({
  id: 'nagakawa-nis-c09r2h10',
  name: 'Nagakawa NIS-C09R2H10 outdoor unit',
  brand: 'Nagakawa',
  model: 'NIS-C09R2H10',
  line: 'Inverter, 1 HP',
  url: `${DMX}funiki-1-hp-hsc09tmust3-vs-nagakawa-nis-c09r2h10`,
  mm: [740, 482, 255],
  kg: 20.5,
  capacity: '9,000 BTU (1 HP)',
  tags: ['nagakawa', 'inverter', '1 hp', '9000 btu'],
  description: 'Nagakawa 1 HP inverter condenser with a square louvre grille moulded in the casing colour, aluminium coil behind wire guards, a valve cover on the right and two base rails.',
  spec: { fanX: 0.37, fanR: 0.43, guard: 'louvre', guardInBody: true },
});

const sharpX9 = unit({
  id: 'sharp-ah-x9xew',
  name: 'Sharp AH-X9XEW outdoor unit',
  brand: 'Sharp',
  model: 'AH-X9XEW',
  line: 'J-Tech Inverter, 1 HP',
  url: 'https://fptshop.com.vn/tin-tuc/dien-may/may-lanh-sharp-ah-x9xew-inverter-1-hp-173003',
  mm: [665, 495, 295],
  kg: 18,
  capacity: '9,000 BTU (1 HP)',
  tags: ['sharp', 'j-tech', 'inverter', '1 hp', '9000 btu'],
  description: 'Sharp J-Tech 1 HP condenser, short and deep: a radial wire guard over a three-blade fan, aluminium coil behind guards, copper service valves under the right-hand cover.',
  spec: { fanX: 0.4, fanR: 0.41, guard: 'radial', blades: 3 },
});

const mhiSrc25 = unit({
  id: 'mitsubishi-heavy-src25zss-w5',
  name: 'Mitsubishi Heavy SRC25ZSS-W5 outdoor unit',
  brand: 'Mitsubishi Heavy Industries',
  model: 'SRC25ZSS-W5',
  line: 'Inverter, 1 HP (indoor SRK25ZSS-W5)',
  url: 'https://meta.vn/dieu-hoa-mitsubishi-heavy-srk25zss-w5-src25zss-w5-p83438',
  mm: [780, 540, 290],
  kg: 31.5,
  capacity: '9,000 BTU (1 HP)',
  tags: ['mitsubishi heavy', 'mhi', 'inverter', '1 hp', '9000 btu'],
  description: 'Mitsubishi Heavy 1 HP inverter condenser, heavy for its class: a square wire mesh guard over the fan, louvred coil behind wire guards at the side and back, the valve cover on the right.',
  spec: { fanX: 0.38, fanR: 0.41, guard: 'grid' },
  coil: 'climate-coil-louvre',
});

export default definePack({
  name: 'Branded AC outdoor units (Vietnam)',
  version: '1.0.0',
  author: 'Neest team',
  description:
    'Eighteen air-conditioner outdoor units sold in Vietnam at their published sizes: Daikin, Panasonic, LG, Casper, Mitsubishi Electric, Samsung, Toshiba, Gree, Funiki, Nagakawa, Sharp and Mitsubishi Heavy wall units from 9,000 to 24,000 BTU, Daikin multi-split units and twin-fan mini-VRF cabinets.',
  license: 'CC0 (made for Neest); brand names belong to their owners',
  items: [
    daikinRkb25,
    daikinRkf50,
    daikinRky50,
    daikin4mkm,
    daikin5mkm,
    panaXu12,
    panaN24,
    lgV10,
    casper09,
    mitsuJy50,
    mitsuPumy,
    samsungAr13,
    samsungDvm,
    toshibaH10,
    greeGwc09,
    nagakawa09,
    sharpX9,
    mhiSrc25,
  ],
  patterns: AC_PATTERNS,
  materials: AC_MATERIALS,
});

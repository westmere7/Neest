/**
 * Branded appliances (Vietnam) — six everyday appliances from brands every Vietnamese household
 * knows, at their published sizes.
 *
 * Laundry: Electrolux EWF9024P5WB front loader and Toshiba AW-M905BV top loader. Kitchen:
 * Panasonic NR-BX410WKVN bottom-freezer fridge, Toshiba RC-18NMFVN digital rice cooker (nồi cơm
 * điện), Sharp R-205VN microwave and Karofi KAQ-U95 Pro RO water purifier.
 *
 * Also: Hafele HH-WT70A chimney hood, Philips HD2151 pressure cooker, Panasonic NB-H3203KRA oven,
 * AQUA AQR-D100FA mini fridge, Sanaky VH-2899A1 chest freezer, Philips STE3170 stand steamer,
 * Kangaroo KG31A3 water dispenser with its 19 L bottle and De'Longhi Dedica EC685 espresso machine.
 * The hood and the steamer keep their footprint but adjust in height over their published range.
 *
 * Specs come from the makers' Vietnamese sites and Vietnamese retailers (`brand.url`). Original
 * procedural shapes: no logos or trademark artwork. Fixed products: width and depth are locked,
 * appliances on feet adjust ±2 cm in height.
 */
import {
  barPull,
  box,
  cells,
  cellSpans,
  circle,
  cyl,
  defineItem,
  definePack,
  discZ,
  frame4,
  lathe,
  line,
  matSlot,
  range,
  rectPoly,
  ring,
  rod,
  rodPath,
  rodX,
  rodZ,
  roundRectPoints,
  slats,
  spaced,
  span,
  sphere,
  torus,
  vcyl,
  prism,
  type AssetBrand,
  type AssetPresetVariant,
  type Part,
  type Size3,
  type V2,
} from '@/packs/kit';

const o = { plan: false };
const TAGS = ['branded', 'vietnam', 'appliance', 'điện máy'];

function fixed(w: number, d: number, h: number) {
  const s: Size3 = { w, d, h };
  return { defaultSize: s, minSize: s, maxSize: s, resizable: { w: false, d: false, h: false } };
}

/** On levelling feet: w/d locked, height ±2 cm. */
function onFeet(w: number, d: number, h: number) {
  return { defaultSize: { w, d, h }, minSize: { w, d, h: h - 0.02 }, maxSize: { w, d, h: h + 0.02 }, resizable: { w: false, d: false } };
}

const brand = (name: string, model: string, line: string, url: string, specs: [string, string][]): AssetBrand => ({ name, model, line, url, specs });

// ---------------------------------------------------------------------------
// Laundry
// ---------------------------------------------------------------------------

const electrolux = defineItem({
  id: 'electrolux-ewf9024p5wb',
  name: 'Electrolux EWF9024P5WB front loader',
  category: 'laundry',
  type: 'appliances',
  group: 'Laundry',
  tags: [...TAGS, 'electrolux', 'máy giặt', 'máy giặt cửa trước', 'front load', 'washing machine', 'inverter', '9 kg'],
  description: '9 kg Electrolux UltimateCare 500 inverter front loader with a chrome-ringed porthole and a dial control panel.',
  ...onFeet(0.6, 0.575, 0.85),
  wallSnap: true,
  slots: [matSlot('body', 'Cabinet', 'plastic-white'), matSlot('door', 'Door ring & dial', 'metal-chrome'), matSlot('glass', 'Door glass', 'glass-tinted'), matSlot('panel', 'Control panel', 'solid-black')],
  build: ({ w, d, h }) => {
    // Cabinet front sits back so the door ring and handle stay within the published depth.
    const zf = d / 2 - 0.03;
    const cy = h * 0.47;
    const r = w * 0.27;
    return [
      span('body', [-w / 2, w / 2], [0.02, h], [-d / 2, zf - 0.01], { bevel: 0.01 }),
      ...[-1, 1].flatMap((s) => [-1, 1].map((z) => vcyl('panel', s * (w / 2 - 0.05), z * (d / 2 - 0.06), 0, 0.02, 0.015, o))),
      span('panel', [-w / 2 + 0.02, w / 2 - 0.02], [h - 0.11, h - 0.02], [zf - 0.012, zf - 0.006], o),
      span('body', [-w / 2 + 0.02, -w / 2 + 0.18], [h - 0.1, h - 0.03], [zf - 0.01, zf - 0.004], { bevel: 0.004, plan: false }),
      discZ('door', [w * 0.12, h - 0.065, zf - 0.004], 0.03, 0.02, o),
      torus('door', [0, cy, zf], r, 0.028, o),
      discZ('glass', [0, cy, zf - 0.002], r * 0.92, 0.03, o),
      discZ('body', [0, cy, zf - 0.012], r * 1.25, 0.004, o),
      span('door', [r + 0.02, r + 0.04], [cy - 0.05, cy + 0.05], [zf - 0.004, zf + 0.012], { bevel: 0.006, plan: false }),
      span('body', [-w / 2 + 0.02, w / 2 - 0.02], [0.03, 0.09], [zf - 0.011, zf - 0.006], o),
    ];
  },
  brand: brand('Electrolux', 'EWF9024P5WB', 'UltimateCare 500, 9 kg', 'https://meta.vn/may-giat-electrolux-inverter-9kg-ewf9024p5wb-p81100', [
    ['Capacity', '9 kg'],
    ['Size (H × W × D)', '850 × 600 × 575 mm'],
    ['Weight', '76 kg'],
    ['Motor', 'Inverter'],
  ]),
});

const toshibaWasher = defineItem({
  id: 'toshiba-aw-m905bv',
  name: 'Toshiba AW-M905BV top loader',
  category: 'laundry',
  type: 'appliances',
  group: 'Laundry',
  tags: [...TAGS, 'toshiba', 'máy giặt', 'máy giặt cửa trên', 'top load', 'washing machine', '8 kg'],
  description: '8 kg Toshiba top-loading washer with a smoked glass lid and a rear control panel: the classic Vietnamese washer.',
  ...onFeet(0.515, 0.525, 0.94),
  wallSnap: true,
  slots: [matSlot('body', 'Cabinet', 'plastic-white'), matSlot('lid', 'Glass lid', 'glass-tinted'), matSlot('panel', 'Control panel', 'solid-mid-grey')],
  build: ({ w, d, h }) => {
    const top = h - 0.07;
    return [
      span('body', [-w / 2, w / 2], [0.02, top], [-d / 2, d / 2], { bevel: 0.015 }),
      ...[-1, 1].flatMap((s) => [-1, 1].map((z) => vcyl('panel', s * (w / 2 - 0.05), z * (d / 2 - 0.05), 0, 0.02, 0.015, o))),
      prism('body', roundRectPoints(0, -d / 2 + 0.065, w, 0.13, 0.03, 4), top, h - top - 0.002),
      span('panel', [-w / 2 + 0.03, w / 2 - 0.03], [h - 0.002, h], [-d / 2 + 0.02, -d / 2 + 0.11], o),
      prism('lid', roundRectPoints(0, 0.06, w - 0.05, d - 0.18, 0.05, 5), top, 0.015, o),
      span('body', [-0.06, 0.06], [top, top + 0.02], [d / 2 - 0.06, d / 2 - 0.035], { bevel: 0.006, plan: false }),
    ];
  },
  brand: brand('Toshiba', 'AW-M905BV(MK)', 'Top-load washer, 8 kg', 'https://www.toshiba-lifestyle.com/vn/laundry/washer/top-load/toshiba-top-load-washer-aw-m905bv-mk', [
    ['Capacity', '8 kg'],
    ['Size', '515 × 525 × 940 mm'],
    ['Weight', '32 kg'],
  ]),
});

// ---------------------------------------------------------------------------
// Kitchen
// ---------------------------------------------------------------------------

const panaFridge = defineItem({
  id: 'panasonic-nr-bx410wkvn',
  name: 'Panasonic NR-BX410WKVN fridge',
  category: 'kitchen',
  type: 'appliances',
  group: 'Refrigeration',
  tags: [...TAGS, 'panasonic', 'tủ lạnh', 'refrigerator', 'fridge', 'bottom freezer', 'ngăn đá dưới', '368 lít'],
  description: '368 L Panasonic bottom-freezer fridge with a tall fridge door, a freezer drawer and slim vertical handles.',
  ...onFeet(0.682, 0.7, 1.625),
  wallSnap: true,
  slots: [matSlot('body', 'Cabinet & doors', 'fridge-glass-black'), matSlot('handle', 'Handles', 'metal-brushed-steel'), matSlot('trim', 'Sides & seams', 'metal-anthracite')],
  build: ({ w, d, h }) => {
    // Door fronts sit back so the handles stay within the published depth.
    const zf = d / 2 - 0.025;
    const split = h * 0.36;
    return [
      span('trim', [-w / 2, w / 2], [0.02, h], [-d / 2, zf - 0.05], { bevel: 0.01 }),
      span('body', [-w / 2, w / 2], [split + 0.004, h], [zf - 0.05, zf], { bevel: 0.006 }),
      span('body', [-w / 2, w / 2], [0.03, split - 0.004], [zf - 0.05, zf], { bevel: 0.006 }),
      span('handle', [w / 2 - 0.05, w / 2 - 0.035], [split + 0.06, split + 0.5], [zf, zf + 0.025], { bevel: 0.004, plan: false }),
      span('handle', [-w / 2 + 0.08, w / 2 - 0.08], [split - 0.05, split - 0.035], [zf, zf + 0.025], { bevel: 0.004, plan: false }),
      span('trim', [-w / 2 + 0.06, -w / 2 + 0.16], [h - 0.18, h - 0.12], [zf, zf + 0.002], o),
      span('trim', [-w / 2 + 0.02, w / 2 - 0.02], [0, 0.03], [zf - 0.06, zf - 0.02], o),
    ];
  },
  brand: brand('Panasonic', 'NR-BX410WKVN', 'Bottom-freezer refrigerator, 368 L', 'https://www.dienmayxanh.com/tu-lanh/panasonic-nr-bx410wkvn', [
    ['Capacity', '368 L'],
    ['Size (H × W × D)', '1625 × 682 × 700 mm'],
    ['Layout', 'Fridge on top, freezer drawer below'],
  ]),
});

const riceCooker = defineItem({
  id: 'toshiba-rc-18nmfvn',
  name: 'Toshiba RC-18NMFVN rice cooker',
  category: 'kitchen',
  type: 'appliances',
  group: 'Small appliances',
  tags: [...TAGS, 'toshiba', 'nồi cơm điện', 'rice cooker', 'digital', '1.8 lít', 'countertop'],
  description: 'White 1.8 L digital rice cooker (nồi cơm điện tử) with a domed lid, carry handle and a front control panel.',
  ...fixed(0.28, 0.352, 0.249),
  defaultElevation: 0.9,
  slots: [matSlot('body', 'Body', 'plastic-white'), matSlot('panel', 'Control panel', 'rice-cooker-panel'), matSlot('trim', 'Handle & vent', 'solid-mid-grey')],
  build: ({ w, d, h }) => {
    const rx = w / 2;
    const k = (d - 0.03) / w;
    return [
      lathe('body', [0, 0, -0.012], [[0, 0], [rx * 0.86, 0], [rx * 0.96, 0.02], [rx, h * 0.45], [rx * 0.97, h * 0.62], [rx * 0.84, h * 0.85], [rx * 0.5, h * 0.97], [0, h * 0.99]], { segments: 40, scale: [1, 1, k] }),
      span('panel', [-0.07, 0.07], [h * 0.22, h * 0.55], [d / 2 - 0.035, d / 2 - 0.0], { bevel: 0.012, plan: false }),
      cyl('trim', [0.05, h * 0.86, 0.0], 0.018, 0.012, o),
      rod('trim', [-rx * 0.62, h * 0.88, -0.012], [rx * 0.62, h * 0.88, -0.012], 0.007, o),
      ...[-1, 1].map((s) => rod('trim', [s * rx * 0.62, h * 0.88, -0.012], [s * rx * 0.7, h * 0.78, -0.012], 0.006, o)),
    ];
  },
  planDetail: ({ w, d }) => [rectPoly(-w / 2 + 0.02, -d / 2 + 0.02, w / 2 - 0.02, d / 2 - 0.04)],
  brand: brand('Toshiba', 'RC-18NMFVN(WT)', 'Digital rice cooker, 1.8 L', 'https://www.toshiba-lifestyle.com/vn/kitchen-appliances/cooking-appliances/rice-cooker/toshiba-digital-rice-cooker-rc-18nmfvn-wt', [
    ['Capacity', '1.8 L'],
    ['Size (W × D × H)', '280 × 352 × 249 mm'],
    ['Power', '800 W'],
    ['Programs', '10'],
  ]),
});

const microwave = defineItem({
  id: 'sharp-r-205vn',
  name: 'Sharp R-205VN microwave',
  category: 'kitchen',
  type: 'appliances',
  group: 'Small appliances',
  tags: [...TAGS, 'sharp', 'lò vi sóng', 'microwave', '20 lít', 'countertop'],
  description: '20 L Sharp countertop microwave with a dark glass door, a pull handle and two dials.',
  ...fixed(0.44, 0.338, 0.256),
  defaultElevation: 0.9,
  slots: [matSlot('body', 'Cabinet', 'metal-brushed-steel'), matSlot('door', 'Door', 'glass-tinted'), matSlot('panel', 'Control panel', 'solid-black')],
  build: ({ w, d, h }) => {
    const zf = d / 2;
    const px = w / 2 - 0.1;
    return [
      span('body', [-w / 2, w / 2], [0.01, h], [-d / 2, zf - 0.01], { bevel: 0.008 }),
      ...[-1, 1].flatMap((s) => [-1, 1].map((z) => cyl('panel', [s * (w / 2 - 0.04), 0.005, z * (d / 2 - 0.04)], 0.012, 0.01, o))),
      span('door', [-w / 2 + 0.01, px - 0.005], [0.02, h - 0.01], [zf - 0.012, zf], { bevel: 0.004 }),
      span('panel', [px, w / 2 - 0.01], [0.02, h - 0.01], [zf - 0.012, zf - 0.002]),
      ...[0.62, 0.32].map((f) => cyl('body', [(px + w / 2 - 0.01) / 2, h * f, zf + 0.006], 0.022, 0.016, { rotation: [Math.PI / 2, 0, 0], plan: false })),
      span('body', [px - 0.03, px - 0.015], [0.05, h - 0.05], [zf, zf + 0.02], { bevel: 0.004, plan: false }),
    ];
  },
  brand: brand('Sharp', 'R-205VN(S)', 'Microwave oven, 20 L', 'https://fptshop.com.vn/lo-vi-song/lo-vi-song-sharp-20-lit-r-205vn-s', [
    ['Capacity', '20 L'],
    ['Size', '439.5 × 338.2 × 256.2 mm'],
    ['Power', '800 W'],
  ]),
});

const karofi = defineItem({
  id: 'karofi-kaq-u95-pro',
  name: 'Karofi KAQ-U95 Pro water purifier',
  category: 'kitchen',
  type: 'appliances',
  group: 'Small appliances',
  tags: [...TAGS, 'karofi', 'máy lọc nước', 'water purifier', 'ro', 'hydrogen', 'under sink', 'vietnamese brand'],
  description: 'Compact 10-filter RO hydrogen water purifier from Vietnamese brand Karofi, to stand under the sink or on the counter, with its tap.',
  ...fixed(0.28, 0.212, 0.41),
  slots: [matSlot('body', 'Casing', 'plastic-white'), matSlot('panel', 'Front panel', 'glass-tinted'), matSlot('tap', 'Tap & fittings', 'metal-chrome')],
  build: ({ w, d, h }) => {
    const zf = d / 2;
    const parts: Part[] = [
      span('body', [-w / 2, w / 2], [0, h], [-d / 2, zf - 0.006], { bevel: 0.015 }),
      span('panel', [-w / 2 + 0.02, w / 2 - 0.02], [h * 0.25, h - 0.03], [zf - 0.008, zf], { bevel: 0.006 }),
      span('body', [-0.04, 0.04], [h * 0.7, h * 0.78], [zf, zf + 0.002], o),
    ];
    for (const i of range(4)) parts.push(sphere('tap', [-0.045 + i * 0.03, h * 0.62, zf + 0.002], 0.005, o));
    parts.push(span('tap', [w / 2 - 0.07, w / 2 - 0.03], [h - 0.004, h], [-d / 2 + 0.03, -d / 2 + 0.07], o));
    return parts;
  },
  planDetail: ({ w, d }) => [rectPoly(-w / 2 + 0.01, -d / 2 + 0.01, w / 2 - 0.01, d / 2 - 0.01)],
  brand: brand('Karofi', 'KAQ-U95 Pro', 'RO hydrogen water purifier, 10 filters', 'https://fptshop.com.vn/may-loc-nuoc/may-loc-nuoc-ro-hydrogen-karofi-kaq-u95-pro-10-loi', [
    ['Size', '280 × 212 × 410 mm'],
    ['Weight', '≈ 8 kg'],
    ['Filtration', 'RO, 10 stages, hydrogen'],
    ['Brand', 'Vietnamese'],
  ]),
});

// ---------------------------------------------------------------------------
// More kitchen, cooling and household appliances
// ---------------------------------------------------------------------------

/** The maker's finishes as colour variants: [id, name, { slot: material }]. */
const finishes = (...list: [string, string, Record<string, string>][]): AssetPresetVariant[] => list.map(([id, name, materials]) => ({ id, name, materials }));

/** Front-facing dial: a knob disc with a raised pointer ridge, face at depth z. */
function dial(slot: string, ridge: string, x: number, y: number, z: number, r: number, turn = 0.6): Part[] {
  const depth = Math.min(0.02, r * 0.8);
  return [
    discZ(slot, [x, y, z + depth / 2], r, depth, { segments: 24, plan: false }),
    { ...span(ridge, [-r * 0.12, r * 0.12], [0, r * 0.75], [0, 0.003]), position: [x, y, z + depth + 0.0015], rotation: [0, 0, turn], plan: false },
  ];
}

/** Flat plate of width `wid` (along X) and thickness `t`, running from a to b in the Y/Z plane ([y, z] points). */
function plateYZ(slot: string, a: V2, b: V2, wid: number, t: number): Part {
  const dy = b[0] - a[0];
  const dz = b[1] - a[1];
  return box(slot, [0, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2], [wid, t, Math.hypot(dy, dz)], { rotation: [Math.atan2(-dy, dz), 0, 0], plan: false });
}

const hafeleHood = defineItem({
  id: 'hafele-hh-wt70a',
  name: 'Hafele HH-WT70A chimney hood',
  category: 'kitchen',
  type: 'appliances',
  group: 'Cooking',
  tags: [...TAGS, 'hafele', 'hh-wt70a', 'hood', 'extractor', 'cooker hood', 'chimney', 'range hood', 'máy hút mùi', 'máy hút khói', 'áp tường', '70 cm'],
  description: '70 cm Hafele T-shape wall hood (máy hút mùi): a slim stainless canopy under a curved clear glass visor, a black glass touch strip and a telescopic stainless chimney.',
  // Fixed width and depth; the telescopic chimney sets the height (535–1000 mm).
  defaultSize: { w: 0.695, d: 0.5, h: 1.0 },
  minSize: { w: 0.695, d: 0.5, h: 0.535 },
  maxSize: { w: 0.695, d: 0.5, h: 1.0 },
  resizable: { w: false, d: false },
  mount: 'wall',
  wallSnap: true,
  defaultElevation: 1.6,
  slots: [matSlot('body', 'Canopy & chimney', 'metal-brushed-steel'), matSlot('glass', 'Glass visor', 'glass-clear'), matSlot('panel', 'Touch strip & filters', 'screen-black'), matSlot('light', 'Lights & display', 'light-warm')],
  // Two LED lamps in the canopy's underside, lighting the hob.
  light: { color: '#ffe8c2', intensity: 0.7, distance: 2, y: 0.01, z: 0.2, kind: 'spot', angle: 0.9, penumbra: 0.6 },
  build: ({ w, d, h }) => {
    const zb = -d / 2;
    const zf = d / 2;
    const t = 0.06;
    const cw = 0.26;
    const zc = zb + 0.2;
    const ym = t + (h - t) * 0.5;
    const parts: Part[] = [
      span('body', [-w / 2, w / 2], [0.004, t], [zb, zf - 0.004], { bevel: 0.004 }),
      span('panel', [-w / 2 + 0.004, w / 2 - 0.004], [0.012, t - 0.008], [zf - 0.004, zf - 0.001], o),
      // Curved clear glass visor rising from the front edge back to the chimney.
      plateYZ('glass', [t - 0.004, zf - 0.03], [t + 0.11, zf - 0.09], w - 0.04, 0.006),
      plateYZ('glass', [t + 0.11, zf - 0.09], [0.24, zc + 0.004], w - 0.04, 0.006),
      // Telescopic chimney: outer and inner sleeves.
      span('body', [-cw / 2, cw / 2], [t, ym], [zb, zc], o),
      span('body', [-cw / 2 + 0.008, cw / 2 - 0.008], [ym - 0.02, h], [zb, zc - 0.008], o),
      // Touch keys and display on the black glass strip.
      span('light', [0.12, 0.18], [0.026, 0.044], [zf - 0.001, zf], o),
      ...cells(4, -0.1, 0.06).map((x) => span('light', [x - 0.008, x + 0.008], [0.031, 0.039], [zf - 0.001, zf], o)),
    ];
    for (const [a, b] of cellSpans(2, -w / 2 + 0.03, w / 2 - 0.03)) parts.push(span('panel', [a + 0.006, b - 0.006], [0, 0.004], [zb + 0.04, zf - 0.09], o));
    for (const s of [-1, 1]) parts.push(cyl('light', [(s * w) / 4, 0.002, zf - 0.05], 0.022, 0.004, o));
    return parts;
  },
  planDetail: ({ w, d }) => [rectPoly(-0.13, -d / 2, 0.13, -d / 2 + 0.2), line([-w / 2, d / 2 - 0.03], [w / 2, d / 2 - 0.03])],
  brand: brand('Hafele', 'HH-WT70A (533.86.807)', 'T-shape wall hood, 70 cm', 'https://meta.vn/may-hut-mui-gan-hafele-hh-wt70a-533-86-807-p120513', [
    ['Size (W × D × H)', '695 × 500 × 535–1000 mm'],
    ['Suction', '750 m³/h, 3 speeds'],
    ['Power', '213 W'],
    ['Controls', 'Touch, timer'],
    ['Lights', 'LED 2 × 1.5 W'],
    ['Duct', 'Ø 150 mm'],
  ]),
});

const philipsPressureCooker = defineItem({
  id: 'philips-hd2151',
  name: 'Philips HD2151 electric pressure cooker',
  category: 'kitchen',
  type: 'appliances',
  group: 'Cooking',
  tags: [...TAGS, 'philips', 'hd2151', 'pressure cooker', 'multicooker', 'all-in-one', 'stew', 'countertop', 'digital', 'nồi áp suất điện', 'nồi áp suất', '5 lít'],
  description: '5 L Philips All-in-One pressure cooker in matt black: a round body with a domed lid and front grip, a glossy touch panel with a display and a condensation cup at the back.',
  ...fixed(0.285, 0.385, 0.262),
  defaultElevation: 0.9,
  wallSnap: true,
  slots: [matSlot('body', 'Body & lid grip', 'plastic-black'), matSlot('lid', 'Lid & keys', 'metal-anthracite'), matSlot('panel', 'Touch panel & valve', 'screen-black'), matSlot('display', 'Display', 'screen-glow')],
  build: ({ w, d, h }) => {
    const R = w / 2 - 0.005;
    const zc = -0.012;
    const yL = 0.172;
    const zp = d / 2 - 0.004;
    const parts: Part[] = [
      lathe('body', [0, 0, zc], [[0, 0], [R * 0.92, 0], [R * 0.98, 0.012], [R, 0.03], [R, yL - 0.006], [R * 0.99, yL], [0, yL]], { segments: 40 }),
      lathe('lid', [0, yL, zc], [[0, 0], [R, 0], [R, 0.014], [R * 0.93, 0.03], [R * 0.7, 0.058], [R * 0.35, 0.068], [0, 0.07]], { segments: 40, plan: false }),
      // Lid grip reaching over the front.
      span('body', [-0.035, 0.035], [0.215, 0.248], [zc + R * 0.35, zc + R + 0.03], { bevel: 0.012, plan: false }),
      // Pressure valve and float pin.
      vcyl('panel', 0.045, zc - 0.045, 0.222, h, 0.014, { segments: 16, plan: false }),
      vcyl('lid', -0.04, zc - 0.05, 0.226, 0.246, 0.006, o),
      // Front touch panel with its display.
      span('panel', [-0.085, 0.085], [0.035, 0.155], [zc + R - 0.04, zp], { bevel: 0.016, plan: false }),
      span('display', [-0.032, 0.032], [0.105, 0.135], [zp, zp + 0.002], o),
      // Condensation cup at the back.
      span('panel', [-0.028, 0.028], [0.08, 0.14], [-d / 2 + 0.002, zc - R + 0.012], { bevel: 0.01, plan: false }),
    ];
    for (const y of [0.06, 0.082]) for (const x of cells(4, -0.06, 0.06)) parts.push(span('lid', [x - 0.009, x + 0.009], [y - 0.005, y + 0.005], [zp, zp + 0.001], o));
    return parts;
  },
  planDetail: () => [circle([0, -0.012], 0.08)],
  brand: brand('Philips', 'HD2151/66', 'All-in-One pressure cooker, 5 L', 'https://meta.vn/noi-ap-suat-dien-philips-hd2151-66-5-lit-p86959', [
    ['Capacity', '5 L'],
    ['Size (L × W × H)', '385 × 285 × 262 mm'],
    ['Weight', '6.2 kg'],
    ['Power', '910–1090 W'],
    ['Controls', 'Touch panel'],
  ]),
});

const panaOven = defineItem({
  id: 'panasonic-nb-h3203kra',
  name: 'Panasonic NB-H3203KRA toaster oven',
  category: 'kitchen',
  type: 'appliances',
  group: 'Cooking',
  tags: [...TAGS, 'panasonic', 'nb-h3203kra', 'toaster oven', 'mini oven', 'countertop oven', 'bake', 'grill', 'lò nướng', 'lò nướng điện', '32 lít'],
  description: '32 L black Panasonic countertop oven (lò nướng) with a double-glazed glass door, a long silver handle and a column of three dials on the right.',
  ...fixed(0.527, 0.392, 0.343),
  defaultElevation: 0.9,
  wallSnap: true,
  slots: [matSlot('body', 'Body & door frame', 'metal-black-matte'), matSlot('glass', 'Door glass', 'glass-tinted'), matSlot('trim', 'Handle, rack & elements', 'metal-brushed-steel'), matSlot('panel', 'Knobs, panel & feet', 'plastic-black')],
  build: ({ w, d, h }) => {
    const zf = d / 2 - 0.035;
    const cpw = 0.12;
    const xc = w / 2 - cpw / 2 - 0.004;
    const cx0 = -w / 2 + 0.025;
    const cx1 = w / 2 - cpw - 0.012;
    const cy0 = 0.045;
    const cy1 = h - 0.03;
    const dcx = (cx0 + cx1) / 2;
    const ry = cy0 + (cy1 - cy0) * 0.4;
    const parts: Part[] = [
      // Hollow cabinet so the cavity shows through the door.
      span('body', [-w / 2, w / 2], [0.018, cy0], [-d / 2, zf]),
      span('body', [-w / 2, w / 2], [cy1, h], [-d / 2, zf], { bevel: 0.01 }),
      span('body', [-w / 2, cx0], [cy0, cy1], [-d / 2, zf]),
      span('body', [cx1, w / 2], [cy0, cy1], [-d / 2, zf]),
      span('body', [cx0, cx1], [cy0, cy1], [-d / 2, -d / 2 + 0.01]),
      span('panel', [cx0, cx1], [cy0, cy1], [-d / 2 + 0.01, -d / 2 + 0.013], o),
      ...[-1, 1].flatMap((s) => [-1, 1].map((z) => vcyl('panel', s * (w / 2 - 0.04), z * (d / 2 - 0.06), 0, 0.018, 0.014, o))),
      // Control column: temperature, function and timer dials.
      span('panel', [w / 2 - cpw, w / 2 - 0.006], [0.025, h - 0.012], [zf, zf + 0.004], { bevel: 0.003, plan: false }),
      ...cells(3, 0.075, h - 0.06)
        .reverse()
        .flatMap((y, i) => dial('panel', 'trim', xc, y, zf + 0.004, 0.022, -0.8 + i * 0.7)),
      // Glass door in a black frame, bar handle and crumb tray.
      span('glass', [cx0 + 0.012, cx1 - 0.012], [cy0 + 0.012, cy1 - 0.035], [zf + 0.002, zf + 0.006], o),
      ...frame4('body', [-w / 2 + 0.006, cx1 + 0.004], [0.022, h - 0.008], [zf, zf + 0.008], 0.024),
      span('body', [-w / 2 + 0.028, cx1 - 0.018], [h - 0.05, h - 0.03], [zf, zf + 0.008], o),
      ...barPull('trim', [dcx, h - 0.042, zf + 0.008], (cx1 - cx0) * 0.75, { r: 0.007, stand: 0.02 }),
      span('panel', [cx0 + 0.02, cx1 - 0.02], [0.016, 0.022], [zf, zf + 0.012], { bevel: 0.002, plan: false }),
      // Rack and heating elements inside.
      rodX('trim', cx0 + 0.005, cx1 - 0.005, ry, zf - 0.03, 0.003, o),
      rodX('trim', cx0 + 0.005, cx1 - 0.005, ry, -d / 2 + 0.03, 0.003, o),
    ];
    for (const x of spaced(Math.round((cx1 - cx0) / 0.035), cx0 + 0.015, cx1 - 0.015)) parts.push(rodZ('trim', x, ry, -d / 2 + 0.03, zf - 0.03, 0.002, o));
    for (const y of [cy0 + 0.012, cy1 - 0.012]) for (const z of [-d * 0.15, d * 0.08]) parts.push(rodX('trim', cx0 + 0.01, cx1 - 0.01, y, z, 0.004, o));
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w / 2, d / 2 - 0.035], [w / 2, d / 2 - 0.035])],
  brand: brand('Panasonic', 'NB-H3203KRA', 'Electric oven, 32 L', 'https://meta.vn/lo-nuong-panasonic-nb-h3203kra-32-lit-p70935', [
    ['Capacity', '32 L'],
    ['Size (W × H × D)', '527 × 343 × 392 mm'],
    ['Cavity', '380 × 295 × 300 mm'],
    ['Power', '1500 W'],
    ['Weight', '9.7 kg'],
    ['Door', 'Double-layer glass'],
  ]),
});

const aquaMini = defineItem({
  id: 'aqua-aqr-d100fa',
  name: 'AQUA AQR-D100FA mini fridge',
  category: 'kitchen',
  type: 'appliances',
  group: 'Refrigeration',
  tags: [...TAGS, 'aqua', 'aqr-d100fa', 'fridge', 'mini fridge', 'bar fridge', 'dorm', 'compact', 'refrigerator', 'tủ lạnh mini', 'tủ lạnh', 'phòng trọ', '90 lít'],
  description: '90 L AQUA single-door mini fridge (tủ lạnh mini) with a dark steel door, a recessed edge pull and a vented kick plate: the rented-room favourite.',
  ...onFeet(0.47, 0.444, 0.769),
  wallSnap: true,
  slots: [matSlot('body', 'Cabinet', 'metal-anthracite'), matSlot('door', 'Door', 'metal-gunmetal'), matSlot('trim', 'Handle, vent, feet & coils', 'plastic-black')],
  build: ({ w, d, h }) => {
    const footH = 0.015;
    const zf = d / 2 - 0.03;
    const parts: Part[] = [
      span('body', [-w / 2, w / 2], [footH, h], [-d / 2 + 0.02, zf], { bevel: 0.01 }),
      span('door', [-w / 2 + 0.002, w / 2 - 0.002], [footH + 0.05, h - 0.004], [zf, d / 2 - 0.004], { bevel: 0.008 }),
      // Recessed pull along the opening edge, hinge cap and badge.
      span('trim', [w / 2 - 0.03, w / 2 - 0.012], [h - 0.32, h - 0.06], [d / 2 - 0.006, d / 2 - 0.001], { bevel: 0.004, plan: false }),
      span('trim', [-w / 2 + 0.006, -w / 2 + 0.03], [h - 0.012, h - 0.001], [zf - 0.01, zf + 0.012], o),
      span('trim', [-0.03, 0.03], [h - 0.07, h - 0.06], [d / 2 - 0.004, d / 2 - 0.003], o),
      // Vented kick plate under the door.
      span('trim', [-w / 2 + 0.02, w / 2 - 0.02], [footH + 0.008, footH + 0.042], [zf - 0.004, zf + 0.006], { bevel: 0.004, plan: false }),
      ...slats('body', [-w / 2 + 0.035, w / 2 - 0.035], [footH + 0.014, footH + 0.036], [zf + 0.006, zf + 0.009], 16, { axis: 'x', gap: 0.5, plan: false }),
      ...[-1, 1].flatMap((s) => [-1, 1].map((z) => vcyl('trim', s * (w / 2 - 0.04), z * (d / 2 - 0.06), 0, footH, 0.015, o))),
      // Compressor hump and condenser coil on the back.
      span('trim', [-w * 0.3, w * 0.3], [footH, footH + 0.15], [-d / 2 + 0.004, -d / 2 + 0.02], { bevel: 0.015, plan: false }),
    ];
    const coilTop = h - 0.05;
    const coilBottom = footH + 0.19;
    for (const x of spaced(9, -w / 2 + 0.06, w / 2 - 0.06)) parts.push(vcyl('trim', x, -d / 2 + 0.01, coilBottom, coilTop, 0.003, o));
    parts.push(rodX('trim', -w / 2 + 0.05, w / 2 - 0.05, coilBottom + 0.01, -d / 2 + 0.006, 0.004, o));
    parts.push(rodX('trim', -w / 2 + 0.05, w / 2 - 0.05, coilTop - 0.01, -d / 2 + 0.006, 0.004, o));
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w / 2, d / 2 - 0.03], [w / 2, d / 2 - 0.03])],
  brand: brand('AQUA', 'AQR-D100FA(BS)', 'Mini fridge, 90 L', 'https://www.dienmayxanh.com/tu-lanh/tu-lanh-aqua-90-lit-aqr-d100fa-bs', [
    ['Capacity', '90 L (76 L fridge, 14 L freezer)'],
    ['Size (H × W × D)', '769 × 470 × 444 mm'],
    ['Weight', '18 kg'],
    ['Doors', '1, steel'],
  ]),
});

const sanakyFreezer = defineItem({
  id: 'sanaky-vh-2899a1',
  name: 'Sanaky VH-2899A1 chest freezer',
  category: 'laundry',
  type: 'appliances',
  group: 'Refrigeration',
  tags: [...TAGS, 'sanaky', 'vh-2899a1', 'freezer', 'chest freezer', 'deep freeze', 'storage', 'tủ đông', 'tủ đông 1 ngăn', 'tủ cấp đông', '280 lít', 'vietnamese brand'],
  description: '280 L Sanaky one-compartment chest freezer (tủ đông) with two lift-up lids, a front thermostat panel and four castors, from the Vietnamese brand.',
  ...fixed(1.08, 0.62, 0.845),
  wallSnap: true,
  slots: [matSlot('body', 'Cabinet', 'metal-white-powder'), matSlot('lid', 'Lids & knob', 'plastic-white'), matSlot('trim', 'Grips, seal, panel & castors', 'solid-mid-grey')],
  build: ({ w, d, h }) => {
    const wh = 0.05;
    const lidY = h - 0.07;
    const zf = d / 2 - 0.012;
    const parts: Part[] = [
      span('body', [-w / 2 + 0.004, w / 2 - 0.004], [wh, lidY - 0.008], [-d / 2 + 0.02, zf], { bevel: 0.02 }),
      span('trim', [-w / 2 + 0.01, w / 2 - 0.01], [lidY - 0.01, lidY], [-d / 2 + 0.026, zf - 0.006], o),
      // Plinth and drain plug.
      span('trim', [-w / 2 + 0.03, w / 2 - 0.03], [0.03, wh + 0.002], [-d / 2 + 0.05, zf - 0.03], o),
      discZ('trim', [-w / 2 + 0.09, wh + 0.05, zf + 0.004], 0.015, 0.008, o),
      // Thermostat panel with its dial.
      span('trim', [w / 2 - 0.2, w / 2 - 0.05], [lidY - 0.1, lidY - 0.04], [zf, zf + 0.004], { bevel: 0.004, plan: false }),
      ...dial('lid', 'trim', w / 2 - 0.09, lidY - 0.07, zf + 0.004, 0.018),
      // Compressor vent on the right side.
      ...slats('trim', [w / 2 - 0.004, w / 2 - 0.001], [0.1, 0.3], [-d / 2 + 0.08, -d / 2 + 0.32], 9, { axis: 'y', gap: 0.5, plan: false }),
    ];
    // Two lift-up lids hinged at the back, each with a front grip.
    for (const s of [-1, 1]) {
      const x: V2 = s < 0 ? [-w / 2, -0.003] : [0.003, w / 2];
      const cx = (x[0] + x[1]) / 2;
      parts.push(span('lid', x, [lidY, h], [-d / 2 + 0.01, d / 2 - 0.004], { bevel: 0.015 }));
      parts.push(span('trim', [cx - 0.12, cx + 0.12], [lidY + 0.008, lidY + 0.03], [d / 2 - 0.008, d / 2], { bevel: 0.006, plan: false }));
      parts.push(span('trim', [cx - 0.05, cx + 0.05], [lidY - 0.03, lidY + 0.02], [-d / 2, -d / 2 + 0.024], { bevel: 0.006, plan: false }));
    }
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const x = sx * (w / 2 - 0.07);
        const z = sz * (d / 2 - 0.07);
        parts.push(vcyl('trim', x, z, 0.035, wh, 0.018, o));
        parts.push(cyl('trim', [x, 0.02, z], 0.02, 0.016, { rotation: [0, 0, Math.PI / 2], plan: false }));
      }
    }
    return parts;
  },
  planDetail: ({ d }) => [line([0, -d / 2 + 0.01], [0, d / 2])],
  brand: brand('Sanaky', 'VH-2899A1', 'Chest freezer, 1 compartment, 2 lids, 280 L', 'https://meta.vn/tu-dong-1-ngan-2-canh-mo-sanaky-vh-2899a1-p74580', [
    ['Capacity', '280 L (235 L usable)'],
    ['Size (W × H × D)', '1080 × 845 × 620 mm'],
    ['Weight', '42 kg'],
    ['Power', '122.2 W'],
    ['Castors', '4, front pair locking'],
  ]),
});

const philipsSteamer = defineItem({
  id: 'philips-ste3170',
  name: 'Philips STE3170 stand steamer',
  category: 'laundry',
  type: 'appliances',
  group: 'Laundry',
  tags: [...TAGS, 'philips', 'ste3170', 'garment steamer', 'clothes steamer', 'steam', 'ironing', 'laundry', 'bàn là hơi nước đứng', 'bàn ủi hơi nước', 'bàn là cây'],
  description: 'Philips 3000 Series stand steamer: a 2 L tank in a rounded base on castors, a telescopic pole with a hanger and the tilting StyleBoard, and the steam head on its hose.',
  // Fixed footprint; the telescopic pole sets the height (1365–1720 mm).
  defaultSize: { w: 0.32, d: 0.31, h: 1.72 },
  minSize: { w: 0.32, d: 0.31, h: 1.365 },
  maxSize: { w: 0.32, d: 0.31, h: 1.72 },
  resizable: { w: false, d: false },
  slots: [matSlot('base', 'Base, board & head', 'plastic-white'), matSlot('tank', 'Water tank', 'water'), matSlot('pole', 'Pole, hanger & soleplate', 'metal-chrome'), matSlot('dark', 'Hose, dial & castors', 'plastic-black')],
  build: ({ w, d, h }) => {
    const pz = -d / 2 + 0.05;
    const hy = h - 0.07;
    const headY = 0.66;
    const bTop = hy - 0.05;
    const bH = 0.42;
    const parts: Part[] = [
      span('base', [-w / 2, w / 2], [0.03, 0.12], [-d / 2, d / 2 - 0.006], { bevel: 0.04 }),
      ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => sphere('dark', [sx * (w / 2 - 0.045), 0.016, sz * (d / 2 - 0.045)], 0.016, o))),
      span('tank', [-w / 2 + 0.03, w / 2 - 0.03], [0.12, 0.3], [-d / 2 + 0.09, d / 2 - 0.03], { bevel: 0.03 }),
      span('base', [-0.07, 0.07], [0.3, 0.312], [-d / 2 + 0.11, d / 2 - 0.05], { bevel: 0.004, plan: false }),
      // Steam-setting dial and power button on the base front.
      discZ('dark', [0, 0.075, d / 2 - 0.004], 0.028, 0.008, o),
      discZ('pole', [0.075, 0.075, d / 2 - 0.004], 0.01, 0.008, o),
      // Telescopic pole with its clamp collar.
      vcyl('pole', 0, pz, 0.12, h * 0.6, 0.015, o),
      vcyl('pole', 0, pz, h * 0.58, hy, 0.01, o),
      vcyl('dark', 0, pz, h * 0.585, h * 0.62, 0.02, o),
      // Hanger bar with curled ends and the top hook.
      rodX('pole', -w / 2 + 0.03, w / 2 - 0.03, hy, pz, 0.008, o),
      ...rodPath('pole', [[-w / 2 + 0.03, hy, pz], [-w / 2 + 0.012, hy - 0.04, pz]], 0.008),
      ...rodPath('pole', [[w / 2 - 0.03, hy, pz], [w / 2 - 0.012, hy - 0.04, pz]], 0.008),
      ...rodPath('pole', [[0, hy, pz], [0, h - 0.03, pz], [0.025, h - 0.008, pz], [0.045, h - 0.03, pz]], 0.006),
      // StyleBoard: a pressing board on a bracket, leaning back against the pole.
      span('dark', [-0.03, 0.03], [bTop - 0.08, bTop - 0.03], [pz + 0.01, pz + 0.05], { bevel: 0.006, plan: false }),
      box('base', [0, bTop - bH / 2, pz + 0.065], [0.26, bH, 0.022], { bevel: 0.008, rotation: [-0.12, 0, 0], plan: false }),
      // Steam head parked in its holder.
      span('dark', [-0.02, 0.02], [headY - 0.05, headY + 0.02], [pz + 0.01, pz + 0.04], { bevel: 0.006, plan: false }),
      span('base', [-0.06, 0.06], [headY - 0.04, headY + 0.08], [pz + 0.04, pz + 0.085], { bevel: 0.02, plan: false }),
      span('pole', [-0.05, 0.05], [headY - 0.03, headY + 0.07], [pz + 0.085, pz + 0.09], { bevel: 0.002, plan: false }),
      span('dark', [-0.012, 0.012], [headY - 0.16, headY - 0.04], [pz + 0.05, pz + 0.075], { bevel: 0.008, plan: false }),
      // Hose swooping from the base up to the head.
      ...rodPath('dark', [[w * 0.25, 0.28, -0.02], [w * 0.34, 0.4, 0.06], [w * 0.3, 0.5, 0.08], [w * 0.15, headY - 0.22, 0.06], [0, headY - 0.16, pz + 0.062]], 0.012),
    ];
    return parts;
  },
  planDetail: ({ w, d }) => [circle([0, -d / 2 + 0.05], 0.015), line([-w / 2 + 0.03, -d / 2 + 0.05], [w / 2 - 0.03, -d / 2 + 0.05])],
  brand: brand('Philips', 'STE3170/80', '3000 Series stand steamer with StyleBoard', 'https://meta.vn/ban-ui-hoi-nuoc-dung-philips-ste3170-80-p92948', [
    ['Size (W × H × D)', '320 × 1365–1720 × 310 mm'],
    ['Tank', '2 L'],
    ['Power', '1680–2000 W'],
    ['Steam', '40 g/min, 3 settings'],
    ['Weight', '4.23 kg'],
  ]),
});

const kangarooDispenser = defineItem({
  id: 'kangaroo-kg31a3',
  name: 'Kangaroo KG31A3 water dispenser with bottle',
  category: 'kitchen',
  type: 'appliances',
  group: 'Small appliances',
  tags: [...TAGS, 'kangaroo', 'kg31a3', 'water dispenser', 'water cooler', 'bottle', 'hot', 'cold', 'drinking water', 'cây nước nóng lạnh', 'cây nước úp bình', 'bình 19 lít', 'vietnamese brand'],
  description: 'White Kangaroo hot and cold water dispenser (cây nước nóng lạnh) with red and blue taps over a drip tray, a cup cabinet below and an upturned 19 L bottle on top.',
  // 274 × 303 × 1086 mm cabinet; the standard 19 L bottle (≈ 270 × 490 mm) brings it to about 1.52 m.
  ...fixed(0.274, 0.303, 1.52),
  wallSnap: true,
  slots: [matSlot('body', 'Body', 'plastic-white'), matSlot('bottle', 'Water bottle', 'vn-pet-bottle-blue'), matSlot('hot', 'Hot tap', 'plastic-red'), matSlot('cold', 'Cold tap & trim', 'plastic-blue')],
  build: ({ w, d, h }) => {
    const bodyH = 1.086;
    const rb = Math.min(w, d) / 2 - 0.003;
    const by = bodyH - 0.06;
    const bh = h - by;
    const zFront = d / 2 - 0.006;
    const zIn = d / 2 - 0.075;
    const aT = 0.8;
    const aB = 0.52;
    const parts: Part[] = [
      // Cabinet with a recessed dispensing alcove.
      span('body', [-w / 2, w / 2], [0, bodyH - 0.03], [-d / 2, zIn], { bevel: 0.02 }),
      span('body', [-w / 2, w / 2], [aT, bodyH - 0.03], [zIn - 0.02, zFront], { bevel: 0.02 }),
      span('body', [-w / 2, w / 2], [0, aB], [zIn - 0.02, zFront], { bevel: 0.02 }),
      span('body', [-w / 2, -w / 2 + 0.025], [aB - 0.01, aT + 0.01], [zIn - 0.02, zFront], { bevel: 0.008, plan: false }),
      span('body', [w / 2 - 0.025, w / 2], [aB - 0.01, aT + 0.01], [zIn - 0.02, zFront], { bevel: 0.008, plan: false }),
      // Drip tray and grate.
      span('body', [-w / 2 + 0.035, w / 2 - 0.035], [aB, aB + 0.02], [zIn, zFront + 0.002], { bevel: 0.006, plan: false }),
      ...slats('cold', [-w / 2 + 0.045, w / 2 - 0.045], [aB + 0.02, aB + 0.024], [zIn + 0.008, zFront - 0.005], 8, { axis: 'x', gap: 0.5, plan: false }),
      // Two-shelf cup cabinet door with a blue pull.
      span('body', [-w / 2 + 0.012, w / 2 - 0.012], [0.05, aB - 0.04], [zFront, zFront + 0.004], { bevel: 0.004, plan: false }),
      span('cold', [-w * 0.25, w * 0.25], [aB - 0.075, aB - 0.06], [zFront + 0.004, d / 2], { bevel: 0.003, plan: false }),
      // Indicator lights and badge strip.
      sphere('hot', [-w * 0.12, aT + 0.1, zFront], 0.007, o),
      sphere('cold', [w * 0.12, aT + 0.1, zFront], 0.007, o),
      span('cold', [-w * 0.2, w * 0.2], [aT + 0.15, aT + 0.16], [zFront - 0.002, zFront + 0.002], o),
      // Bottle seat on top.
      cyl('body', [0, bodyH - 0.015, 0], 0.095, 0.03, { segments: 32, plan: false }),
      // Upturned 19 L bottle: neck down into the seat, ribs round the waist.
      lathe('bottle', [0, by, 0], [
        [0, 0],
        [0.027, 0],
        [0.027, 0.07],
        [rb * 0.5, 0.1],
        [rb * 0.97, 0.16],
        [rb, 0.19],
        [rb, bh - 0.03],
        [rb * 0.9, bh],
        [0, bh],
      ], { segments: 40, plan: false }),
      cyl('cold', [0, bodyH + 0.006, 0], 0.03, 0.012, o),
    ];
    for (const f of [0.35, 0.55, 0.75]) parts.push(ring('bottle', [0, by + 0.19 + (bh - 0.22) * f, 0], rb - 0.002, 0.004, o));
    // Hot (red, with child lock) and cold (blue) taps.
    for (const [x, slot] of [[-w * 0.18, 'hot'], [w * 0.18, 'cold']] as const) {
      parts.push(span(slot, [x - 0.018, x + 0.018], [aT - 0.05, aT], [zIn - 0.005, zIn + 0.035], { bevel: 0.006, plan: false }));
      parts.push(span(slot, [x - 0.014, x + 0.014], [aT - 0.075, aT - 0.04], [zIn + 0.03, zIn + 0.042], { bevel: 0.004, plan: false }));
      parts.push(vcyl(slot, x, zIn + 0.012, aT - 0.07, aT - 0.05, 0.006, o));
    }
    parts.push(sphere('hot', [-w * 0.18, aT - 0.005, zIn + 0.03], 0.007, o));
    return parts;
  },
  planDetail: ({ w, d }) => [circle([0, 0], Math.min(w, d) / 2 - 0.003)],
  brand: brand('Kangaroo', 'KG31A3', 'Hot & cold water dispenser, top-loading bottle', 'https://meta.vn/cay-nuoc-nong-lanh-kangaroo-kg31a3-p52544', [
    ['Cabinet (W × D × H)', '274 × 303 × 1086 mm'],
    ['With 19 L bottle', '≈ 1.52 m tall'],
    ['Weight', '8.3 kg'],
    ['Heating / cooling', '420 W / 80 W'],
    ['Taps', '2 (hot with child lock, cold)'],
    ['Brand', 'Vietnamese'],
  ]),
});

const delonghiDedica = defineItem({
  id: 'delonghi-ec685',
  name: "De'Longhi Dedica EC685 espresso machine",
  category: 'kitchen',
  type: 'appliances',
  group: 'Small appliances',
  tags: [...TAGS, 'delonghi', "de'longhi", 'ec685', 'dedica', 'coffee', 'espresso', 'barista', 'cappuccino', 'countertop', 'máy pha cà phê', 'máy pha espresso'],
  description: "Slim 15 cm De'Longhi Dedica pump espresso machine in brushed metal, with a portafilter under the overhanging head, a steam wand at the side and a cup warmer on top.",
  ...fixed(0.149, 0.33, 0.303),
  defaultElevation: 0.9,
  wallSnap: true,
  slots: [matSlot('body', 'Body', 'metal-brushed-steel'), matSlot('trim', 'Portafilter, grate & cup warmer', 'metal-chrome'), matSlot('accent', 'Handle, buttons & knob', 'plastic-black'), matSlot('tank', 'Water tank', 'water')],
  variants: finishes(['black', 'Black (EC685.BK)', { body: 'metal-black-matte' }], ['red', 'Red (EC685.R)', { body: 'solid-red' }], ['white', 'White (EC685.W)', { body: 'metal-white-powder' }]),
  build: ({ w, d, h }) => {
    const zb = -d / 2;
    const zt = zb + 0.19;
    const top = h - 0.004;
    const y0 = h - 0.105;
    const zh = d / 2 - 0.045;
    const zg = (zt + zh) / 2 + 0.005;
    const xs = w / 2 - 0.003;
    const parts: Part[] = [
      // Rear tank, slim tower and the overhanging brew head.
      span('tank', [-w / 2 + 0.012, w / 2 - 0.012], [0.03, top - 0.012], [zb, zb + 0.05], { bevel: 0.01 }),
      span('body', [-xs, xs], [0, top], [zb + 0.045, zt], { bevel: 0.012 }),
      span('body', [-xs, xs], [y0, top], [zt - 0.01, zh], { bevel: 0.012 }),
      span('trim', [-xs + 0.01, xs - 0.01], [top, h], [zb + 0.06, zt - 0.02], o),
      ...cells(3, -0.035, 0.035).map((x) => cyl('accent', [x, top + 0.002, zh - 0.028], 0.008, 0.004, o)),
      span('trim', [-0.02, 0.02], [y0 + 0.05, y0 + 0.06], [zh, zh + 0.001], o),
      // Drip tray and grate.
      span('body', [-xs + 0.004, xs - 0.004], [0, 0.035], [zt - 0.01, d / 2 - 0.004], { bevel: 0.006 }),
      ...slats('trim', [-xs + 0.014, xs - 0.014], [0.035, 0.038], [zt + 0.005, d / 2 - 0.016], 7, { axis: 'x', gap: 0.45, plan: false }),
      // Group head, portafilter, spouts and handle.
      vcyl('trim', 0, zg, y0 - 0.018, y0, 0.032, o),
      vcyl('trim', 0, zg, y0 - 0.045, y0 - 0.018, 0.034, o),
      vcyl('trim', -0.01, zg + 0.005, y0 - 0.058, y0 - 0.045, 0.005, o),
      vcyl('trim', 0.01, zg + 0.005, y0 - 0.058, y0 - 0.045, 0.005, o),
      rod('accent', [0, y0 - 0.03, zg + 0.03], [0, y0 - 0.048, d / 2 - 0.015], 0.011, o),
      // Steam wand with its frother sleeve, and the steam knob.
      sphere('accent', [xs - 0.012, y0 + 0.02, zt + 0.012], 0.011, o),
      rod('trim', [xs - 0.012, y0 + 0.02, zt + 0.012], [xs - 0.016, 0.13, zt + 0.03], 0.0045, o),
      vcyl('accent', xs - 0.016, zt + 0.03, 0.075, 0.13, 0.009, o),
      cyl('accent', [w / 2 - 0.007, h * 0.62, zb + 0.11], 0.016, 0.014, { rotation: [0, 0, Math.PI / 2], plan: false }),
    ];
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w / 2, -d / 2 + 0.19], [w / 2, -d / 2 + 0.19])],
  brand: brand("De'Longhi", 'EC685.M', 'Dedica Style pump espresso', 'https://www.huntoffice.ie/delonghi-dedica-style-pump-espresso-coffee-machine-silver-ec685m.html', [
    ['Size (W × D × H)', '149 × 330 × 303 mm'],
    ['Weight', '4.2 kg'],
    ['Pump', '15 bar'],
    ['Power', '1300 W'],
    ['Tank', '1.1 L'],
    ['Colours', 'Silver, black, red, white'],
  ]),
});

export default definePack({
  name: 'Branded appliances (Vietnam)',
  version: '1.1.0',
  author: 'Neest team',
  description:
    'Fourteen everyday appliances from brands Vietnamese households know, at their published sizes: washers, fridges, a chest freezer, a hood, cookers, an oven, a microwave, water and coffee machines and a garment steamer.',
  license: 'CC0 (made for Neest); brand names belong to their owners',
  items: [
    electrolux,
    toshibaWasher,
    panaFridge,
    riceCooker,
    microwave,
    karofi,
    hafeleHood,
    philipsPressureCooker,
    panaOven,
    aquaMini,
    sanakyFreezer,
    philipsSteamer,
    kangarooDispenser,
    delonghiDedica,
  ],
  materials: [
    { id: 'fridge-glass-black', name: 'Black glass door', category: 'glass', color: '#1c1d20', roughness: 0.12, metalness: 0.2 },
    { id: 'rice-cooker-panel', name: 'Grey control panel', category: 'solid', color: '#5d6168', roughness: 0.3 },
    { id: 'vn-pet-bottle-blue', name: 'Blue PET water bottle', category: 'glass', color: '#9cc8e6', roughness: 0.06, opacity: 0.45 },
  ],
});

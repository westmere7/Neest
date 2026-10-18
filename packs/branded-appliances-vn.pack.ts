/**
 * Branded appliances (Vietnam) — six everyday appliances from brands every Vietnamese household
 * knows, at their published sizes.
 *
 * Laundry: Electrolux EWF9024P5WB front loader and Toshiba AW-M905BV top loader. Kitchen:
 * Panasonic NR-BX410WKVN bottom-freezer fridge, Toshiba RC-18NMFVN digital rice cooker (nồi cơm
 * điện), Sharp R-205VN microwave and Karofi KAQ-U95 Pro RO water purifier.
 *
 * Specs come from the makers' Vietnamese sites and Vietnamese retailers (`brand.url`). Original
 * procedural shapes: no logos or trademark artwork. Fixed products: width and depth are locked,
 * appliances on feet adjust ±2 cm in height.
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
  rod,
  roundRectPoints,
  span,
  sphere,
  torus,
  vcyl,
  prism,
  type AssetBrand,
  type Part,
  type Size3,
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

export default definePack({
  name: 'Branded appliances (Vietnam)',
  version: '1.0.0',
  author: 'Neest team',
  description: 'Six everyday appliances from brands Vietnamese households know, at their published sizes: Electrolux and Toshiba washers, a Panasonic fridge, a Toshiba rice cooker, a Sharp microwave and a Karofi water purifier.',
  license: 'CC0 (made for Neest); brand names belong to their owners',
  items: [electrolux, toshibaWasher, panaFridge, riceCooker, microwave, karofi],
  materials: [
    { id: 'fridge-glass-black', name: 'Black glass door', category: 'glass', color: '#1c1d20', roughness: 0.12, metalness: 0.2 },
    { id: 'rice-cooker-panel', name: 'Grey control panel', category: 'solid', color: '#5d6168', roughness: 0.3 },
  ],
});

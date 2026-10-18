/**
 * Branded washing machines — four real front loaders from Bosch, LG and Samsung, built to their
 * published dimensions.
 *
 * Washers: Bosch Serie 6 WGG254Z0GB, Samsung Bespoke AI WW11DB8B95GBU3.
 * Washer-dryer: LG FWY996WCTN4. And the LG WashTower WT1210BBF, a washer and a
 * heat-pump dryer in one tower with the controls in the middle.
 *
 * Clothes dryers: AQUA (the Vietnamese market's common models) vented AQH-V700FW, AQH-V800H SS and
 * AQH-V901K PS, and heat-pump AQH-H900G PS and AQH-H1000J PS.
 *
 * Each item carries `brand` metadata (model, line, published specs and their source). Depth is the
 * overall depth including the door, so the plan shows the real footprint. The shapes are original
 * procedural approximations: no logos or trademark artwork are drawn. Sizes are fixed products: width
 * and depth are locked and the height adjusts by ±2 cm (levelling feet).
 */
import {
  defineItem,
  definePack,
  discZ,
  legs4,
  line,
  matSlot,
  segmentText,
  span,
  sphere,
  spaced,
  torus,
  type AssetBrand,
  type Part,
  type Size3,
} from '@/packs/kit';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Detail parts: hidden from the 2D plan. */
const o = { plan: false };

const TAGS = ['washing machine', 'washer', 'máy giặt', 'laundry', 'front loader', 'appliance', 'utility'];
const DRYER_TAGS = ['washer dryer', 'washer-dryer', 'máy giặt sấy', 'dryer', '2 in 1'];

/** Fixed product: w/d locked, height ±2 cm (levelling feet). */
function sizes(w: number, d: number, h: number) {
  return {
    defaultSize: { w, d, h },
    minSize: { w: w - 0.02, d: d - 0.02, h: h - 0.02 },
    maxSize: { w: w + 0.02, d: d + 0.02, h: h + 0.02 },
    resizable: { w: false, d: false },
  };
}

const brand = (name: string, model: string, line: string, url: string, specs: [string, string][]): AssetBrand => ({
  name,
  model,
  line,
  url,
  specs,
});

const SLOT_GLASS = 'glass';
const SLOT_DISPLAY = 'display';

interface DoorSpec {
  /** Outer radius of the door. */
  R: number;
  /** 'ring': a round ring (trim) around tinted glass; 'flat': a flat dark disc door with glass inset. */
  style: 'ring' | 'flat';
  /** Ring tube radius ('ring' style). */
  tube?: number;
  /** Handle on the right of the door. */
  handle?: boolean;
}

/**
 * Porthole door centred at (0, y) on a cabinet front at zC: hinge on the left, glass bowl, ring or
 * flat frame. Slots: trim (ring, hinge, handle), glass, plus `frame` for the door disc.
 */
function door(y: number, zC: number, s: DoorSpec, frame: string): Part[] {
  const { R } = s;
  const parts: Part[] = [
    // Door disc and the glass bowl that bulges into the drum.
    discZ(frame, [0, y, zC + 0.014], R, 0.028, { segments: 48, plan: false }),
    discZ(SLOT_GLASS, [0, y, zC + 0.03], R * 0.7, 0.008, { segments: 40, plan: false }),
    sphere(SLOT_GLASS, [0, y, zC + 0.033], 1, { scale: [R * 0.6, R * 0.6, 0.014], plan: false }),
    // Hinge on the left.
    span('trim', [-R - 0.012, -R + 0.01], [y - 0.07, y - 0.035], [zC, zC + 0.02], { bevel: 0.004, plan: false }),
    span('trim', [-R - 0.012, -R + 0.01], [y + 0.035, y + 0.07], [zC, zC + 0.02], { bevel: 0.004, plan: false }),
  ];
  if (s.style === 'ring') {
    const t = s.tube ?? 0.018;
    parts.push(torus('trim', [0, y, zC + 0.03], R - t, t, o));
    parts.push(torus('trim', [0, y, zC + 0.034], R * 0.7 + 0.004, 0.005, o));
  } else {
    // Flat door: a thin bright rim and a smoked glass window.
    parts.push(torus('trim', [0, y, zC + 0.028], R - 0.004, 0.004, o));
    parts.push(torus(frame, [0, y, zC + 0.032], R * 0.7 + 0.01, 0.01, o));
  }
  if (s.handle) parts.push(span('trim', [R - 0.03, R + 0.008], [y - 0.05, y + 0.05], [zC + 0.028, zC + 0.04], { bevel: 0.008, plan: false }));
  return parts;
}

interface FasciaSpec {
  /** Fascia height. */
  panelH: number;
  /** Fascia material slot ('body' for a painted fascia, 'glass' for a black glass one). */
  slot: string;
  /** Detergent drawer width (left). 0 = no drawer. */
  drawerW: number;
  /** Programme dial centre (x) and radius; 0 radius = touch only. */
  dialX: number;
  dialR: number;
  /** Display window centre (x) and width, and its readout. */
  dispX: number;
  dispW: number;
  text: string;
  /** Touch buttons in a row right of the display. */
  buttons: number;
}

/**
 * Control fascia from y0 to y1 across the front at zC: detergent drawer, programme dial, a dark
 * display window with a lit readout and a row of buttons. Slots: the fascia slot, body (drawer),
 * trim (dial, buttons), glass (display window), display (readout).
 */
function fascia(w: number, y0: number, y1: number, zC: number, f: FasciaSpec): Part[] {
  const zF = zC + 0.012;
  const yc = (y0 + y1) / 2;
  const parts: Part[] = [span(f.slot, [-w / 2 + 0.002, w / 2 - 0.002], [y0, y1], [zC, zF], { bevel: 0.004, plan: false })];
  if (f.drawerW > 0) {
    const x0 = -w / 2 + 0.014;
    parts.push(
      span('body', [x0, x0 + f.drawerW], [y0 + 0.016, y1 - 0.014], [zF, zF + 0.008], { bevel: 0.004, plan: false }),
      span(SLOT_GLASS, [x0 + 0.02, x0 + f.drawerW - 0.02], [y0 + 0.02, y0 + 0.028], [zF + 0.007, zF + 0.0095], o),
    );
  }
  if (f.dialR > 0) {
    parts.push(
      discZ('trim', [f.dialX, yc, zF + 0.004], f.dialR + 0.004, 0.008, { segments: 32, plan: false }),
      discZ('trim', [f.dialX, yc, zF + 0.014], f.dialR, 0.014, { segments: 32, plan: false }),
      span(SLOT_GLASS, [f.dialX - 0.002, f.dialX + 0.002], [yc + f.dialR * 0.4, yc + f.dialR * 0.9], [zF + 0.021, zF + 0.022], o),
    );
  }
  const dh = Math.min(0.045, (y1 - y0) * 0.5);
  parts.push(
    span(SLOT_GLASS, [f.dispX - f.dispW / 2, f.dispX + f.dispW / 2], [yc - dh / 2, yc + dh / 2], [zF, zF + 0.0015], { bevel: 0.0007, plan: false }),
    ...segmentText(SLOT_DISPLAY, f.text, f.dispX, yc + dh * 0.05, zF + 0.0015, dh * 0.45),
  );
  const bx0 = f.dispX + f.dispW / 2 + 0.02;
  const bx1 = w / 2 - 0.03;
  if (f.buttons > 0 && bx1 > bx0) {
    for (const x of spaced(f.buttons, bx0, bx1)) parts.push(discZ('trim', [x, yc, zF + 0.0015], 0.0065, 0.003, { segments: 16, plan: false }));
    parts.push(span(SLOT_DISPLAY, [bx0 - 0.003, bx0 + 0.003], [yc + 0.012, yc + 0.0135], [zF, zF + 0.001], o));
  }
  return parts;
}

interface WasherSpec {
  fascia: FasciaSpec;
  door: DoorSpec;
  /** Material slot of the door disc ('trim' or 'glass' or 'body'). */
  doorFrame: string;
  /** Door protrudes this far in front of the cabinet (included in d). */
  doorProj: number;
  /** Worktop thickness. */
  top: number;
}

/**
 * Freestanding front loader: cabinet on four feet with a recessed kick, worktop, fascia, porthole
 * door and a service flap bottom right. Slots: body, trim, glass, display.
 */
function frontLoader({ w, d, h }: Size3, s: WasherSpec): Part[] {
  const zC = d / 2 - s.doorProj;
  const foot = 0.015;
  const yT = h - s.top;
  const yP0 = yT - 0.003 - s.fascia.panelH;
  const kick = 0.06;
  const yDoor = (kick + yP0) / 2 + 0.01;
  const parts: Part[] = [
    // Cabinet, worktop with a shadow gap under it.
    span('body', [-w / 2, w / 2], [foot, yT - 0.003], [-d / 2, zC], { bevel: 0.008 }),
    span('body', [-w / 2, w / 2], [yT, h], [-d / 2, zC + 0.006], { bevel: 0.005 }),
    span(SLOT_GLASS, [-w / 2 + 0.006, w / 2 - 0.006], [yT - 0.003, yT], [-d / 2 + 0.02, zC - 0.004], o),
    ...fascia(w, yP0, yT - 0.003, zC, s.fascia),
    ...door(yDoor, zC, s.door, s.doorFrame),
    // Service flap with the pump filter, bottom right.
    span('body', [w / 2 - 0.15, w / 2 - 0.025], [kick - 0.03, kick + 0.035], [zC, zC + 0.004], { bevel: 0.002, plan: false }),
    span(SLOT_GLASS, [w / 2 - 0.1, w / 2 - 0.075], [kick + 0.02, kick + 0.026], [zC + 0.004, zC + 0.005], o),
    // Feet and the shadow under the cabinet.
    span(SLOT_GLASS, [-w / 2 + 0.02, w / 2 - 0.02], [0.002, foot], [-d / 2 + 0.03, zC - 0.03], o),
    ...legs4('trim', w - 0.02, d - s.doorProj - 0.06, 0.01, 0, foot + 0.004, 0.035, { round: true }),
  ];
  return parts;
}

const plan = (proj: number) => ({ w, d }: Size3) => [line([-w / 2, d / 2 - proj], [w / 2, d / 2 - proj])];

const DRYER_ONLY_TAGS = ['clothes dryer', 'tumble dryer', 'dryer', 'máy sấy', 'máy sấy quần áo', 'laundry', 'appliance', 'utility', 'aqua'];

/**
 * Front-loading clothes dryer: the washer cabinet with a dryer's front. Vented dryers have no
 * drawer and a round vent spigot on the back; heat-pump dryers have a water-tank drawer at the top
 * left and a condenser grille in the kick panel. Big glass door with a lint filter in its rim.
 */
function dryer(size: Size3, s: WasherSpec & { heatPump: boolean }): Part[] {
  const { w, d } = size;
  const parts = frontLoader(size, s);
  const zC = d / 2 - s.doorProj;
  if (s.heatPump) {
    // Condenser grille: slots across the kick panel.
    for (const x of spaced(9, -w / 2 + 0.1, w / 2 - 0.2)) parts.push(span(SLOT_GLASS, [x - 0.012, x + 0.012], [0.035, 0.05], [zC, zC + 0.002], o));
  } else {
    // Exhaust spigot on the back (vented dryers duct the hot air out).
    parts.push(discZ('trim', [w / 2 - 0.13, 0.2, -d / 2 - 0.009], 0.05, 0.018, { segments: 28, plan: false }));
    parts.push(discZ(SLOT_GLASS, [w / 2 - 0.13, 0.2, -d / 2 - 0.017], 0.04, 0.004, { segments: 24, plan: false }));
  }
  return parts;
}

const SLOTS_AQUA = (body: string, bodyLabel: string, trim: string) => [
  matSlot('body', bodyLabel, body),
  matSlot('trim', 'Door ring, dial & feet', trim),
  matSlot(SLOT_GLASS, 'Door glass & display window', 'washer-smoked-glass'),
  matSlot(SLOT_DISPLAY, 'Display', 'washer-display'),
];

const SLOTS_WHITE = (ring: string, ringLabel = 'Door ring, dial & feet') => [
  matSlot('body', 'Cabinet & drawer', 'washer-white'),
  matSlot('trim', ringLabel, ring),
  matSlot(SLOT_GLASS, 'Door glass & display window', 'washer-smoked-glass'),
  matSlot(SLOT_DISPLAY, 'Display', 'washer-display'),
];

// ---------------------------------------------------------------------------
// 1. Bosch Serie 6 WGG254Z0GB — 10 kg washer, white
// ---------------------------------------------------------------------------

const boschWgg = defineItem({
  id: 'bosch-wgg254z0gb',
  name: 'Bosch Serie 6 WGG254Z0GB washing machine',
  category: 'laundry',
  type: 'appliances',
  group: 'Laundry',
  tags: [...TAGS, 'bosch', 'WGG254Z0GB', 'serie 6', '10 kg', 'white', 'i-dos'],
  ...sizes(0.598, 0.632, 0.845),
  wallSnap: true,
  description:
    'Bosch Serie 6 freestanding front-loading washing machine in white, 10 kg at 1400 rpm, with a programme dial and a display on the fascia and a silver-grey door ring.',
  brand: brand('Bosch', 'WGG254Z0GB', 'Serie 6', 'https://www.bosch-home.co.uk/en/product/laundry/washing-machines/front-load-washing-machines/WGG254Z0GB', [
    ['Capacity', '10 kg'],
    ['Spin', '1400 rpm'],
    ['Depth with door', '632 mm (1049 mm with the door open)'],
    ['Installation', 'Freestanding, fits under a worktop'],
    ['Dimensions (H × W × D)', '845 × 598 × 588 mm (body)'],
  ]),
  slots: SLOTS_WHITE('washer-silver-grey'),
  build: (s) =>
    frontLoader(s, {
      fascia: { panelH: 0.13, slot: 'body', drawerW: 0.17, dialX: -0.065, dialR: 0.032, dispX: 0.08, dispW: 0.1, text: '1:59', buttons: 4 },
      door: { R: 0.2, style: 'ring', tube: 0.022, handle: true },
      doorFrame: 'trim',
      doorProj: 0.044,
      top: 0.022,
    }),
  planDetail: plan(0.044),
});

// ---------------------------------------------------------------------------
// 4. LG FWY996WCTN4 — 9/6 kg washer-dryer, white with a black door
// ---------------------------------------------------------------------------

const lgFwy = defineItem({
  id: 'lg-fwy996wctn4',
  name: 'LG FWY996WCTN4 washer-dryer',
  category: 'laundry',
  type: 'appliances',
  group: 'Laundry',
  tags: [...TAGS, ...DRYER_TAGS, 'lg', 'FWY996WCTN4', 'turbowash', 'ai direct drive', '9 kg', 'white'],
  ...sizes(0.6, 0.62, 0.85),
  wallSnap: true,
  description:
    'LG TurboWash 360 washer-dryer in white with a black tinted door and a chrome rim: washes 9 kg and dries 6 kg, with a dial beside a black touch display.',
  brand: brand('LG', 'FWY996WCTN4', 'TurboWash 360 DUAL Dry', 'https://lg.com/uk/laundry/washer-dryers/fwy996wctn4', [
    ['Wash / dry capacity', '9 kg / 6 kg'],
    ['Spin', '1400 rpm'],
    ['Depth to the door', '620 mm'],
    ['Installation', 'Freestanding'],
    ['Dimensions (W × H × D)', '600 × 850 × 565 mm (body)'],
  ]),
  slots: [
    matSlot('body', 'Cabinet & drawer', 'washer-white'),
    matSlot('trim', 'Door rim, dial & feet', 'washer-chrome'),
    matSlot(SLOT_GLASS, 'Door, glass & display panel', 'washer-black-glass'),
    matSlot(SLOT_DISPLAY, 'Display', 'washer-display'),
  ],
  build: (s) =>
    frontLoader(s, {
      fascia: { panelH: 0.125, slot: 'body', drawerW: 0.17, dialX: -0.07, dialR: 0.033, dispX: 0.11, dispW: 0.17, text: '3:35', buttons: 0 },
      door: { R: 0.21, style: 'flat', handle: false },
      doorFrame: SLOT_GLASS,
      doorProj: 0.055,
      top: 0.02,
    }),
  planDetail: plan(0.055),
});

// ---------------------------------------------------------------------------
// 5. Samsung Bespoke AI WW11DB8B95GBU3 — 11 kg washer, black
// ---------------------------------------------------------------------------

const samsungWw = defineItem({
  id: 'samsung-ww11db8b95gbu3',
  name: 'Samsung Bespoke AI WW11DB8B95GBU3 washing machine',
  category: 'laundry',
  type: 'appliances',
  group: 'Laundry',
  tags: [...TAGS, 'samsung', 'WW11DB8B95GBU3', 'bespoke', 'bespoke ai', 'quickdrive', '11 kg', 'black'],
  ...sizes(0.6, 0.6, 0.85),
  wallSnap: true,
  description:
    'Samsung Bespoke AI QuickDrive washing machine in black, 11 kg, with auto-dosing, a large flat black glass door and an AI Control dial and display on a black glass fascia.',
  brand: brand('Samsung', 'WW11DB8B95GBU3', 'Bespoke AI Series 8', 'https://www.qualescegliere.it/lavatrice/samsung-bespoke-ai-quickdrive-ww11db8b95gbu3/', [
    ['Capacity', '11 kg'],
    ['Spin', '1400 rpm'],
    ['Features', 'QuickDrive, Auto Dispense, AI Wash'],
    ['Weight', '75 kg'],
    ['Dimensions (H × W × D)', '850 × 600 × 600 mm'],
  ]),
  slots: [
    matSlot('body', 'Cabinet & drawer', 'washer-black'),
    matSlot('trim', 'Rim, dial & feet', 'washer-dark-chrome'),
    matSlot(SLOT_GLASS, 'Door, fascia & glass', 'washer-black-glass'),
    matSlot(SLOT_DISPLAY, 'Display', 'washer-display-blue'),
  ],
  build: (s) =>
    frontLoader(s, {
      fascia: { panelH: 0.13, slot: SLOT_GLASS, drawerW: 0.18, dialX: 0.2, dialR: 0.03, dispX: 0.06, dispW: 0.16, text: '0:39', buttons: 0 },
      door: { R: 0.225, style: 'flat', handle: false },
      doorFrame: SLOT_GLASS,
      doorProj: 0.045,
      top: 0.02,
    }),
  planDetail: plan(0.045),
});

// ---------------------------------------------------------------------------
// 6. LG WashTower WT1210BBF — 12 kg washer + 10 kg heat-pump dryer tower, black
// ---------------------------------------------------------------------------

const washTower = defineItem({
  id: 'lg-washtower-wt1210bbf',
  name: 'LG WashTower WT1210BBF washer and dryer',
  category: 'laundry',
  type: 'appliances',
  group: 'Laundry',
  tags: [...TAGS, 'dryer', 'tumble dryer', 'máy sấy', 'stacked', 'laundry tower', 'lg', 'washtower', 'WT1210BBF', 'heat pump', 'black'],
  ...sizes(0.6, 0.66, 1.655),
  wallSnap: true,
  description:
    'LG WashTower: a 12 kg washer and a 10 kg heat-pump dryer built as one black tower, with a single control panel in the middle at an easy height.',
  brand: brand('LG', 'WT1210BBF', 'WashTower', 'https://www.digitec.ch/en/s1/product/lg-wt1210bbf-washer-dryers-53896472', [
    ['Washer capacity', '12 kg'],
    ['Dryer capacity', '10 kg (heat pump)'],
    ['Spin', '1400 rpm'],
    ['Installation', 'Freestanding tower'],
    ['Dimensions (H × W × D)', '1655 × 600 × 660 mm'],
  ]),
  slots: [
    matSlot('body', 'Cabinet', 'washer-black'),
    matSlot('trim', 'Door rims & feet', 'washer-dark-chrome'),
    matSlot(SLOT_GLASS, 'Doors, control panel & glass', 'washer-black-glass'),
    matSlot(SLOT_DISPLAY, 'Display', 'washer-display'),
  ],
  build: ({ w, d, h }) => {
    const proj = 0.05;
    const zC = d / 2 - proj;
    const foot = 0.015;
    const yW = 0.8; // washer top / control panel bottom
    const yD = 0.93; // dryer bottom / control panel top
    const R = 0.22;
    const zF = zC + 0.012;
    const yc = (yW + yD) / 2;
    const parts: Part[] = [
      span('body', [-w / 2, w / 2], [foot, h], [-d / 2, zC], { bevel: 0.008 }),
      // Seam lines between the units and the control band.
      span(SLOT_GLASS, [-w / 2 + 0.004, w / 2 - 0.004], [yW - 0.003, yW], [zC, zC + 0.002], o),
      span(SLOT_GLASS, [-w / 2 + 0.004, w / 2 - 0.004], [yD, yD + 0.003], [zC, zC + 0.002], o),
      // Centre control panel: black glass with the washer and dryer readouts.
      span(SLOT_GLASS, [-w / 2 + 0.006, w / 2 - 0.006], [yW + 0.006, yD - 0.006], [zC, zF], { bevel: 0.004, plan: false }),
      discZ('trim', [-w / 2 + 0.06, yc, zF + 0.002], 0.009, 0.004, { segments: 16, plan: false }),
      ...segmentText(SLOT_DISPLAY, '1:39', -0.07, yc + 0.005, zF, 0.026),
      ...segmentText(SLOT_DISPLAY, '2:15', 0.12, yc + 0.005, zF, 0.026),
      span(SLOT_DISPLAY, [0.015, 0.021], [yc - 0.02, yc + 0.02], [zF, zF + 0.001], o),
      // Washer detergent drawer under the panel, dryer water tank above it.
      span('body', [-w / 2 + 0.014, -w / 2 + 0.2], [yW - 0.11, yW - 0.02], [zC, zC + 0.008], { bevel: 0.004, plan: false }),
      span(SLOT_GLASS, [-w / 2 + 0.04, -w / 2 + 0.17], [yW - 0.105, yW - 0.098], [zC + 0.007, zC + 0.0095], o),
      span('body', [-w / 2 + 0.014, -w / 2 + 0.2], [yD + 0.02, yD + 0.09], [zC, zC + 0.008], { bevel: 0.004, plan: false }),
      span(SLOT_GLASS, [-w / 2 + 0.04, -w / 2 + 0.17], [yD + 0.08, yD + 0.087], [zC + 0.007, zC + 0.0095], o),
      // Washer and dryer doors.
      ...door(0.37, zC, { R, style: 'flat' }, SLOT_GLASS),
      ...door(yD + (h - yD) / 2 - 0.01, zC, { R, style: 'flat' }, SLOT_GLASS),
      // Service flap, feet and the shadow under the cabinet.
      span('body', [w / 2 - 0.15, w / 2 - 0.025], [0.04, 0.1], [zC, zC + 0.004], { bevel: 0.002, plan: false }),
      span(SLOT_GLASS, [-w / 2 + 0.02, w / 2 - 0.02], [0.002, foot], [-d / 2 + 0.03, zC - 0.03], o),
      ...legs4('trim', w - 0.02, d - proj - 0.06, 0.01, 0, foot + 0.004, 0.035, { round: true }),
    ];
    return parts;
  },
  planDetail: plan(0.05),
});

// ---------------------------------------------------------------------------
// AQUA clothes dryers (common in Vietnam)
// ---------------------------------------------------------------------------

const aquaV700 = defineItem({
  id: 'aqua-aqh-v700fw',
  name: 'AQUA AQH-V700FW vented dryer 7 kg',
  category: 'laundry',
  type: 'appliances',
  group: 'Laundry',
  tags: [...DRYER_ONLY_TAGS, 'AQH-V700FW', 'sấy thông hơi', 'vented', '7 kg', 'white'],
  ...sizes(0.6, 0.555, 0.82),
  wallSnap: true,
  description:
    'AQUA 7 kg vented tumble dryer in white with a large glass door, a programme knob and an LED display on a bilingual English–Vietnamese panel. Ducts warm air out through a vent at the back.',
  brand: brand('AQUA', 'AQH-V700FW', 'Vented dryer', 'https://www.dienmayxanh.com/may-say-quan-ao/aqua-aqh-v700fw', [
    ['Capacity', '7 kg'],
    ['Type', 'Vented (sấy thông hơi), 80 °C'],
    ['Controls', 'Knob, push buttons, display (English / Vietnamese)'],
    ['Door', 'Glass'],
    ['Size (H × W × D)', '820 × 600 × 555 mm, 30 kg'],
  ]),
  slots: SLOTS_AQUA('washer-white', 'Cabinet', 'washer-silver-grey'),
  build: (s) =>
    dryer(s, {
      heatPump: false,
      fascia: { panelH: 0.105, slot: 'body', drawerW: 0, dialX: -0.17, dialR: 0.034, dispX: 0.03, dispW: 0.1, text: '1:20', buttons: 3 },
      door: { R: 0.205, style: 'ring', tube: 0.02, handle: true },
      doorFrame: 'trim',
      doorProj: 0.04,
      top: 0.02,
    }),
  planDetail: plan(0.04),
});

const aquaV800 = defineItem({
  id: 'aqua-aqh-v800h-ss',
  name: 'AQUA AQH-V800H SS vented dryer 8 kg',
  category: 'laundry',
  type: 'appliances',
  group: 'Laundry',
  tags: [...DRYER_ONLY_TAGS, 'AQH-V800H', 'sấy thông hơi', 'vented', '8 kg', 'grey', 'silver'],
  ...sizes(0.6, 0.55, 0.83),
  wallSnap: true,
  description:
    'AQUA 8 kg vented tumble dryer in an elegant grey with a dark tinted door, touch keys, a programme knob and an LED display on a bilingual panel. A favourite in Vietnamese apartments for the rainy season.',
  brand: brand('AQUA', 'AQH-V800H SS', 'Vented dryer', 'https://www.dienmayxanh.com/may-say-quan-ao/may-say-thong-hoi-aqua-aqh-v800h-ss', [
    ['Capacity', '8 kg'],
    ['Type', 'Vented (sấy thông hơi), heating element, horizontal drum'],
    ['Controls', 'Touch keys, buttons, knob, LED display (English / Vietnamese)'],
    ['Colour', 'Grey'],
    ['Size (H × W × D)', '830 × 600 × 550 mm, 30 kg'],
  ]),
  slots: SLOTS_AQUA('aqua-grey', 'Cabinet', 'washer-dark-chrome'),
  build: (s) =>
    dryer(s, {
      heatPump: false,
      fascia: { panelH: 0.11, slot: SLOT_GLASS, drawerW: 0, dialX: -0.17, dialR: 0.034, dispX: 0.03, dispW: 0.11, text: '2:10', buttons: 4 },
      door: { R: 0.21, style: 'flat', handle: true },
      doorFrame: SLOT_GLASS,
      doorProj: 0.045,
      top: 0.02,
    }),
  planDetail: plan(0.045),
});

const aquaV901 = defineItem({
  id: 'aqua-aqh-v901k-ps',
  name: 'AQUA AQH-V901K PS vented dryer 9 kg',
  category: 'laundry',
  type: 'appliances',
  group: 'Laundry',
  tags: [...DRYER_ONLY_TAGS, 'AQH-V901K', 'sấy thông hơi', 'vented', '9 kg', 'black'],
  ...sizes(0.6, 0.565, 0.83),
  wallSnap: true,
  description:
    'AQUA 9 kg vented tumble dryer in black with an insulated glass door, a programme knob, buttons and an LED display on a bilingual panel; sized for families of three to five.',
  brand: brand('AQUA', 'AQH-V901K PS', 'Vented dryer', 'https://www.dienmayxanh.com/may-say-quan-ao/may-say-thong-hoi-aqua-9-kg-aqh-v901k-ps', [
    ['Capacity', '9 kg'],
    ['Type', 'Vented (sấy thông hơi)'],
    ['Controls', 'Knob, push buttons, LED display (English / Vietnamese)'],
    ['Colour', 'Black'],
    ['Size (H × W × D)', '830 × 600 × 565 mm, 30 kg'],
  ]),
  slots: SLOTS_AQUA('washer-black', 'Cabinet', 'washer-dark-chrome'),
  build: (s) =>
    dryer(s, {
      heatPump: false,
      fascia: { panelH: 0.11, slot: 'body', drawerW: 0, dialX: 0.17, dialR: 0.036, dispX: -0.1, dispW: 0.12, text: '1:45', buttons: 0 },
      door: { R: 0.215, style: 'ring', tube: 0.018, handle: true },
      doorFrame: SLOT_GLASS,
      doorProj: 0.045,
      top: 0.02,
    }),
  planDetail: plan(0.045),
});

const aquaH900 = defineItem({
  id: 'aqua-aqh-h900g-ps',
  name: 'AQUA AQH-H900G PS heat-pump dryer 9 kg',
  category: 'laundry',
  type: 'appliances',
  group: 'Laundry',
  tags: [...DRYER_ONLY_TAGS, 'AQH-H900G', 'bơm nhiệt', 'heat pump', 'heatpump', 'condenser', '9 kg', 'silver'],
  ...sizes(0.667, 0.595, 0.846),
  wallSnap: true,
  description:
    'AQUA 9 kg heat-pump dryer in silver: no vent needed, the moisture collects in the water tank at the top left; a knob and display on the panel, a big tinted door and a condenser grille in the kick panel.',
  brand: brand('AQUA', 'AQH-H900G PS', 'Heat-pump dryer', 'https://dienmaycholon.com/may-say/may-say-aqua-9-kg-aqhh900gps', [
    ['Capacity', '9 kg'],
    ['Type', 'Heat pump (bơm nhiệt), up to 56 % less energy'],
    ['Extras', 'Drying rack, 3-layer lint filter'],
    ['Colour', 'Silver'],
    ['Size (H × W × D)', '846 × 667 × 595 mm, 50 kg'],
  ]),
  slots: SLOTS_AQUA('aqua-silver', 'Cabinet', 'washer-chrome'),
  build: (s) =>
    dryer(s, {
      heatPump: true,
      fascia: { panelH: 0.115, slot: 'body', drawerW: 0.17, dialX: -0.07, dialR: 0.034, dispX: 0.1, dispW: 0.12, text: '2:45', buttons: 3 },
      door: { R: 0.22, style: 'ring', tube: 0.02, handle: true },
      doorFrame: 'trim',
      doorProj: 0.05,
      top: 0.022,
    }),
  planDetail: plan(0.05),
});

const aquaH1000 = defineItem({
  id: 'aqua-aqh-h1000j-ps',
  name: 'AQUA AQH-H1000J PS heat-pump dryer 10 kg',
  category: 'laundry',
  type: 'appliances',
  group: 'Laundry',
  tags: [...DRYER_ONLY_TAGS, 'AQH-H1000J', 'bơm nhiệt', 'heat pump', 'heatpump', 'condenser', '10 kg', 'dark silver'],
  ...sizes(0.675, 0.595, 0.845),
  wallSnap: true,
  description:
    'AQUA 10 kg heat-pump dryer in dark silver with a black glass control strip, a large door with a black frame, the water tank at the top left and a condenser grille below the door; for families of five to seven.',
  brand: brand('AQUA', 'AQH-H1000J PS', 'Heat-pump dryer', 'https://cellphones.com.vn/may-say-aqua-bom-nhiet-10kg-aqh-h1000j-ps.html', [
    ['Capacity', '10 kg'],
    ['Type', 'Heat pump (bơm nhiệt)'],
    ['Drum', 'Stainless steel, reversing tumble'],
    ['Colour', 'Dark silver'],
    ['Size (H × W × D)', '845 × 675 × 595 mm'],
  ]),
  slots: SLOTS_AQUA('aqua-graphite', 'Cabinet', 'washer-dark-chrome'),
  build: (s) =>
    dryer(s, {
      heatPump: true,
      fascia: { panelH: 0.115, slot: SLOT_GLASS, drawerW: 0.17, dialX: 0.22, dialR: 0.034, dispX: 0.03, dispW: 0.14, text: '3:05', buttons: 0 },
      door: { R: 0.225, style: 'flat', handle: true },
      doorFrame: SLOT_GLASS,
      doorProj: 0.05,
      top: 0.022,
    }),
  planDetail: plan(0.05),
});

export default definePack({
  name: 'Branded washing machines',
  version: '1.0.0',
  author: 'Neest team',
  description:
    'Real front loaders built to their published dimensions: Bosch Serie 6 and Samsung Bespoke AI washers, an LG washer-dryer, the LG WashTower, and AQUA vented and heat-pump clothes dryers common in Vietnam. Brand and spec data is in each item’s info card; no logos are drawn.',
  license: 'CC0 geometry (made for Neest); Bosch, LG, Samsung and AQUA are trademarks of their owners',
  items: [boschWgg, lgFwy, samsungWw, washTower, aquaV700, aquaV800, aquaV901, aquaH900, aquaH1000],
  materials: [
    { id: 'washer-white', name: 'Appliance white (gloss)', color: '#f5f5f2', roughness: 0.25 },
    { id: 'washer-black', name: 'Appliance black', color: '#1d1e21', roughness: 0.35, metalness: 0.2 },
    { id: 'washer-silver-grey', name: 'Silver-grey door ring', category: 'metal', color: '#9ea2a7', roughness: 0.35, metalness: 0.6 },
    { id: 'washer-chrome', name: 'Chrome finish', category: 'metal', color: '#d4d7da', roughness: 0.12, metalness: 1 },
    { id: 'washer-dark-chrome', name: 'Dark chrome', category: 'metal', color: '#5a5d63', roughness: 0.2, metalness: 0.9 },
    { id: 'washer-smoked-glass', name: 'Smoked door glass', category: 'glass', color: '#3b434b', roughness: 0.05, metalness: 0.3 },
    { id: 'washer-black-glass', name: 'Black tinted glass', category: 'glass', color: '#121417', roughness: 0.06, metalness: 0.35 },
    { id: 'washer-display', name: 'White LED readout', color: '#f0f6ff', roughness: 0.3, emissive: '#dceaff', emissiveIntensity: 1.2 },
    { id: 'aqua-grey', name: 'Appliance grey', color: '#8d9196', roughness: 0.3, metalness: 0.35 },
    { id: 'aqua-silver', name: 'Appliance silver', category: 'metal', color: '#c3c6ca', roughness: 0.28, metalness: 0.55 },
    { id: 'aqua-graphite', name: 'Appliance dark silver', category: 'metal', color: '#5f6267', roughness: 0.3, metalness: 0.5 },
    { id: 'washer-display-blue', name: 'Blue LED readout', color: '#bfe0ff', roughness: 0.3, emissive: '#57a8ff', emissiveIntensity: 1.4 },
  ],
});

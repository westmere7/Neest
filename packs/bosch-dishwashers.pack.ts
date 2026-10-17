/**
 * Bosch dishwashers — six real Bosch models, built to their published dimensions.
 *
 * Freestanding (Serie 4 60 cm inox, Serie 2 45 cm slimline white), a Serie 4 table-top compact,
 * a Serie 6 fully integrated with a kitchen door panel, a Serie 6 semi-integrated with a stainless
 * control band, and a US 800 Series with hidden top controls and a pocket handle.
 *
 * Each item carries `brand` metadata (model, line, published specs and their source). The shapes
 * are original procedural approximations: no logos or trademark artwork are drawn. Sizes are fixed
 * products, so width and depth are locked and only the height adjusts a little (levelling feet).
 */
import { defineItem, definePack, discZ, legs4, line, matSlot, span, type AssetBrand, type Part, type V2 } from '@/packs/kit';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Detail parts: hidden from the 2D plan. */
const o = { plan: false };

const TAGS = ['bosch', 'dishwasher', 'máy rửa bát', 'máy rửa chén', 'appliance', 'kitchen'];

/** Fixed product: w/d locked, height ±2 cm (levelling feet). */
function sizes(w: number, d: number, h: number) {
  return {
    defaultSize: { w, d, h },
    minSize: { w: w - 0.02, d: d - 0.02, h: h - 0.02 },
    maxSize: { w: w + 0.02, d: d + 0.02, h: h + 0.02 },
    resizable: { w: false, d: false },
  };
}

const bosch = (model: string, line: string, url: string, specs: [string, string][]): AssetBrand => ({
  name: 'Bosch',
  model,
  line,
  url,
  specs,
});

/** Seven-segment layout (a b c d e f g) for the display digits. */
const SEGMENTS: Record<string, string> = {
  '0': 'abcdef',
  '1': 'bc',
  '2': 'abdeg',
  '3': 'abcdg',
  '4': 'bcfg',
  '5': 'acdfg',
  '6': 'acdefg',
  '7': 'abc',
  '8': 'abcdefg',
  '9': 'abcdfg',
};

/**
 * Seven-segment readout (e.g. "3:15") centred at (cx, cy) on a front-facing surface at depth z,
 * digits `H` tall.
 */
function digits(slot: string, text: string, cx: number, cy: number, z: number, H: number): Part[] {
  const W = H * 0.55;
  const t = H * 0.14;
  const adv = (c: string) => (c === ':' ? H * 0.32 : W + H * 0.28);
  const total = [...text].reduce((s, c) => s + adv(c), 0) - H * 0.28;
  let x = cx - total / 2;
  const parts: Part[] = [];
  const zz: V2 = [z, z + 0.0008];
  for (const c of text) {
    if (c === ':') {
      parts.push(span(slot, [x, x + t], [cy + H * 0.12, cy + H * 0.12 + t], zz, o));
      parts.push(span(slot, [x, x + t], [cy - H * 0.12 - t, cy - H * 0.12], zz, o));
    } else {
      const seg = SEGMENTS[c] ?? '';
      const top = cy + H / 2;
      const bot = cy - H / 2;
      const S: Record<string, [V2, V2]> = {
        a: [[x, x + W], [top - t, top]],
        d: [[x, x + W], [bot, bot + t]],
        g: [[x, x + W], [cy - t / 2, cy + t / 2]],
        f: [[x, x + t], [cy, top]],
        b: [[x + W - t, x + W], [cy, top]],
        e: [[x, x + t], [bot, cy]],
        c: [[x + W - t, x + W], [bot, cy]],
      };
      for (const k of seg) parts.push(span(slot, S[k][0], S[k][1], zz, o));
    }
    x += adv(c);
  }
  return parts;
}

/** Round push/touch button on a front surface at depth z. */
const button = (slot: string, x: number, y: number, z: number, r = 0.0055): Part =>
  discZ(slot, [x, y, z + 0.0012], r, 0.0024, { segments: 20, plan: false });

interface PanelSpec {
  /** Programme buttons left of the display. */
  progs: number;
  /** Option buttons right of the display. */
  opts: number;
  /** Display window width (m). */
  dispW: number;
  /** Readout text. */
  text: string;
}

/**
 * Front control panel (freestanding / compact): power button, programme buttons with indicator
 * dots, a dark display window with a lit readout, option buttons and a larger start button.
 * Slots: 'controls' (dark glass), 'display' (lit readout and the selected indicator).
 */
function frontControls(w: number, y0: number, y1: number, z: number, p: PanelSpec): Part[] {
  const yc = (y0 + y1) / 2;
  const by = yc - (y1 - y0) * 0.1;
  const ly = yc + (y1 - y0) * 0.24;
  const dh = Math.min(0.032, (y1 - y0) * 0.5);
  const parts: Part[] = [
    // Display window with its readout.
    span('controls', [-p.dispW / 2, p.dispW / 2], [yc - dh / 2, yc + dh / 2], [z, z + 0.0015], { bevel: 0.0007, plan: false }),
    ...digits('display', p.text, 0, yc, z + 0.0015, dh * 0.5),
    // Power button (far left) and start button (far right).
    button('controls', -w / 2 + 0.035, by, z, 0.0065),
    button('controls', w / 2 - 0.038, by, z, 0.0085),
    span('display', [w / 2 - 0.043, w / 2 - 0.033], [ly, ly + 0.002], [z, z + 0.001], o),
  ];
  const leftA = -w / 2 + 0.07;
  const leftB = -p.dispW / 2 - 0.025;
  for (let i = 0; i < p.progs; i++) {
    const x = p.progs === 1 ? (leftA + leftB) / 2 : leftA + ((leftB - leftA) * i) / (p.progs - 1);
    parts.push(button('controls', x, by, z));
    parts.push(span(i === 1 ? 'display' : 'controls', [x - 0.0022, x + 0.0022], [ly - 0.0012, ly + 0.0012], [z, z + 0.001], o));
  }
  const rightA = p.dispW / 2 + 0.025;
  const rightB = w / 2 - 0.075;
  for (let i = 0; i < p.opts; i++) {
    const x = p.opts === 1 ? (rightA + rightB) / 2 : rightA + ((rightB - rightA) * i) / (p.opts - 1);
    parts.push(button('controls', x, by, z, 0.005));
  }
  return parts;
}

/**
 * Freestanding dishwasher: removable worktop, cabinet, full-width door with the control panel
 * across its top and a recessed grip under the panel, a recessed kick plate and four feet.
 * Slots: body (door, panel, kick plate), top (worktop & cabinet), controls, display.
 */
function freestanding(w: number, d: number, h: number, p: PanelSpec): Part[] {
  const wt = 0.03; // removable worktop (845 → 815 mm without it)
  const yTop = h - wt;
  const zF = d / 2 - 0.003; // door face
  const zD = zF - 0.046; // door back / cabinet front
  const kick = 0.095;
  const panelH = 0.088;
  const grip = 0.02;
  const yP0 = yTop - 0.004 - panelH;
  const xs: V2 = [-w / 2 + 0.0015, w / 2 - 0.0015];
  return [
    // Worktop with a slight front overhang and a shadow line beneath it.
    span('top', [-w / 2, w / 2], [yTop, h], [-d / 2, d / 2], { bevel: 0.004 }),
    span('controls', [-w / 2 + 0.004, w / 2 - 0.004], [yTop - 0.004, yTop], [zD, zF - 0.006], o),
    // Cabinet (sides and back).
    span('top', [-w / 2, w / 2], [0.012, yTop], [-d / 2, zD], { bevel: 0.002 }),
    // Door below the grip, the grip trough, then the control panel.
    span('body', xs, [kick + 0.004, yP0 - grip], [zD, zF], { bevel: 0.003, plan: false }),
    span('controls', [-w / 2 + 0.006, w / 2 - 0.006], [yP0 - grip, yP0], [zD, zF - 0.022], o),
    span('body', xs, [yP0 - grip, yP0 - grip + 0.004], [zD, zF - 0.02], o),
    span('body', xs, [yP0, yTop - 0.004], [zD, zF], { bevel: 0.003, plan: false }),
    // Kick plate, recessed, with a dark gap above it.
    span('body', [-w / 2 + 0.004, w / 2 - 0.004], [0.012, kick], [zD - 0.01, zF - 0.016], { bevel: 0.002, plan: false }),
    span('controls', [-w / 2 + 0.01, w / 2 - 0.01], [0.004, 0.012], [-d / 2 + 0.04, zF - 0.03], o),
    ...legs4('controls', w - 0.02, d - 0.1, 0.02, 0, 0.012, 0.03, { round: true }),
    ...frontControls(w, yP0, yTop - 0.004, zF, p),
  ];
}

/** Kitchen plinth recessed `back` behind the front face, plus the appliance base and feet. */
function plinth(slot: string, baseSlot: string, w: number, d: number, top: number, zFace: number, back = 0.055): Part[] {
  return [
    span(slot, [-w / 2, w / 2], [0, top], [zFace - back - 0.016, zFace - back], { plan: false }),
    span(baseSlot, [-w / 2 + 0.01, w / 2 - 0.01], [0.03, top], [-d / 2 + 0.02, zFace - back - 0.02], o),
    ...legs4(baseSlot, w - 0.02, d - 0.12, 0.02, 0, 0.03, 0.028, { round: true }),
  ];
}

// ---------------------------------------------------------------------------
// 1. Serie 4 SMS4HVI33E — freestanding 60 cm, silver inox
// ---------------------------------------------------------------------------

const sms4 = defineItem({
  id: 'sms4hvi33e',
  name: 'Bosch Serie 4 SMS4HVI33E dishwasher',
  category: 'kitchen',
  type: 'appliances',
  group: 'Cleaning',
  tags: [...TAGS, 'SMS4HVI33E', 'serie 4', 'freestanding', '60 cm', 'stainless', 'inox'],
  ...sizes(0.6, 0.6, 0.845),
  wallSnap: true,
  description:
    'Bosch Serie 4 freestanding 60 cm dishwasher in stainless steel (silver inox), with a control panel and display across the top of the door. Holds 13 place settings.',
  brand: bosch('SMS4HVI33E', 'Serie 4', 'https://media3.bosch-home.com/Documents/specsheet/it-IT/SMS4HVI33E.pdf', [
    ['Place settings', '13'],
    ['Energy class', 'D'],
    ['Noise class', 'C'],
    ['Net weight', '51.1 kg'],
    ['Installation', 'Freestanding'],
    ['Dimensions (H × W × D)', '845 × 600 × 600 mm'],
  ]),
  slots: [
    matSlot('body', 'Door & kick plate', 'bosch-inox'),
    matSlot('top', 'Worktop & cabinet', 'bosch-silver'),
    matSlot('controls', 'Controls & grip', 'bosch-black-glass'),
    matSlot('display', 'Display', 'bosch-display'),
  ],
  build: ({ w, d, h }) => freestanding(w, d, h, { progs: 5, opts: 3, dispW: 0.11, text: '3:15' }),
  planDetail: ({ w, d }) => [line([-w / 2, d / 2 - 0.049], [w / 2, d / 2 - 0.049])],
});

// ---------------------------------------------------------------------------
// 2. Serie 2 SPS2IKW04E — freestanding slimline 45 cm, white
// ---------------------------------------------------------------------------

const sps2 = defineItem({
  id: 'sps2ikw04e',
  name: 'Bosch Serie 2 SPS2IKW04E slimline dishwasher',
  category: 'kitchen',
  type: 'appliances',
  group: 'Cleaning',
  tags: [...TAGS, 'SPS2IKW04E', 'serie 2', 'freestanding', 'slimline', '45 cm', 'white'],
  ...sizes(0.45, 0.6, 0.845),
  wallSnap: true,
  description:
    'Bosch Serie 2 freestanding slimline dishwasher, 45 cm wide, in white, for 9 place settings. It is 845 mm high, or 815 mm with the worktop removed to fit under a counter.',
  brand: bosch('SPS2IKW04E', 'Serie 2', 'https://www.coolblue.be/en/product/873572/bosch-sps2ikw04e-freestanding.html', [
    ['Place settings', '9'],
    ['Noise', '48 dB'],
    ['Net weight', '37.8 kg'],
    ['Installation', 'Freestanding'],
    ['Dimensions (H × W × D)', '845 × 450 × 600 mm (815 mm high without worktop)'],
  ]),
  slots: [
    matSlot('body', 'Door & kick plate', 'bosch-white'),
    matSlot('top', 'Worktop & cabinet', 'bosch-white'),
    matSlot('controls', 'Controls & grip', 'bosch-charcoal'),
    matSlot('display', 'Display', 'bosch-display'),
  ],
  build: ({ w, d, h }) => freestanding(w, d, h, { progs: 4, opts: 1, dispW: 0.07, text: '2:40' }),
  planDetail: ({ w, d }) => [line([-w / 2, d / 2 - 0.049], [w / 2, d / 2 - 0.049])],
});

// ---------------------------------------------------------------------------
// 3. Serie 4 SKS62E32EU — compact table-top, white
// ---------------------------------------------------------------------------

const sks62 = defineItem({
  id: 'sks62e32eu',
  name: 'Bosch Serie 4 SKS62E32EU compact dishwasher',
  category: 'kitchen',
  type: 'appliances',
  group: 'Cleaning',
  tags: [...TAGS, 'SKS62E32EU', 'serie 4', 'compact', 'table-top', 'countertop', '55 cm', 'white'],
  ...sizes(0.551, 0.5, 0.45),
  defaultElevation: 0.9,
  wallSnap: true,
  description:
    'Bosch Serie 4 compact table-top dishwasher, 55 cm wide, in white. It stands on a worktop and takes 6 place settings, using 8 litres of water per eco cycle.',
  brand: bosch('SKS62E32EU', 'Serie 4', 'https://www.bosch-home.co.uk/product-list/SKS62E32EU', [
    ['Place settings', '6'],
    ['Energy class', 'F'],
    ['Noise', '49 dB(A)'],
    ['Water', '8.0 l per eco cycle'],
    ['Net weight', '21.3 kg'],
    ['Depth with door open', '845 mm'],
    ['Dimensions (H × W × D)', '450 × 551 × 500 mm'],
  ]),
  slots: [
    matSlot('body', 'Housing & door', 'bosch-white'),
    matSlot('controls', 'Controls, grip & feet', 'bosch-charcoal'),
    matSlot('display', 'Display', 'bosch-display'),
  ],
  build: ({ w, d, h }) => {
    const zF = d / 2 - 0.002;
    const zD = zF - 0.04;
    const foot = 0.016;
    const panelH = 0.07;
    const grip = 0.016;
    const yTop = h - 0.004;
    const yP0 = yTop - panelH;
    const xs: V2 = [-w / 2 + 0.003, w / 2 - 0.003];
    return [
      // Housing with soft edges, on four small feet.
      span('body', [-w / 2, w / 2], [foot, h], [-d / 2, zD], { bevel: 0.012 }),
      ...legs4('controls', w - 0.03, d - 0.08, 0.015, 0, foot, 0.035, { round: true }),
      // Door, grip trough, control panel.
      span('body', xs, [foot + 0.004, yP0 - grip], [zD, zF], { bevel: 0.006, plan: false }),
      span('controls', [-w / 2 + 0.01, w / 2 - 0.01], [yP0 - grip, yP0], [zD, zF - 0.018], o),
      span('body', xs, [yP0, yTop], [zD, zF], { bevel: 0.006, plan: false }),
      // Top cover's front lip over the door.
      span('body', [-w / 2 + 0.003, w / 2 - 0.003], [yTop, h], [zD - 0.01, zF - 0.004], { bevel: 0.002, plan: false }),
      ...frontControls(w, yP0, yTop, zF, { progs: 5, opts: 2, dispW: 0.075, text: '1:35' }),
    ];
  },
  planDetail: ({ w, d }) => [line([-w / 2, d / 2 - 0.042], [w / 2, d / 2 - 0.042])],
});

// ---------------------------------------------------------------------------
// 4. Serie 6 SMV6ZCX49E — fully integrated 60 cm (Zeolith)
// ---------------------------------------------------------------------------

const smv6 = defineItem({
  id: 'smv6zcx49e',
  name: 'Bosch Serie 6 SMV6ZCX49E integrated dishwasher',
  category: 'kitchen',
  type: 'appliances',
  group: 'Cleaning',
  tags: [...TAGS, 'SMV6ZCX49E', 'serie 6', 'fully integrated', 'built-in', 'zeolith', '60 cm', 'infolight'],
  ...sizes(0.598, 0.55, 0.815),
  wallSnap: true,
  description:
    'Bosch Serie 6 fully integrated 60 cm dishwasher with Zeolith drying, hidden behind a kitchen door panel. The controls sit on the top edge of the door and a red light on the floor shows while it runs.',
  brand: bosch('SMV6ZCX49E', 'Serie 6', 'https://www.bosch-home.com/mt/en/mkt-product/SMV6ZCX49E', [
    ['Place settings', '14'],
    ['Energy class', 'C'],
    ['Noise', '42 dB(A)'],
    ['Water', '9.5 l per eco cycle'],
    ['Drying', 'Zeolith'],
    ['Installation', 'Fully integrated'],
    ['Dimensions (H × W × D)', '815 × 598 × 550 mm'],
  ]),
  slots: [
    matSlot('front', 'Front panel', 'laminate-white-matte'),
    matSlot('body', 'Appliance & handle', 'bosch-inox'),
    matSlot('trim', 'Control strip & plinth', 'bosch-charcoal'),
    matSlot('info', 'InfoLight', 'bosch-infolight'),
  ],
  build: ({ w, d, h }) => {
    const zF = d / 2;
    const zP = zF - 0.019; // back of the 19 mm kitchen door panel
    const zD = zP - 0.004 - 0.03; // inner (appliance) door
    const yPl = 0.1;
    const strip = 0.012;
    const parts: Part[] = [
      // Appliance tub and inner door.
      span('body', [-w / 2, w / 2], [yPl, h], [-d / 2, zD]),
      span('body', [-w / 2 + 0.002, w / 2 - 0.002], [yPl + 0.004, h - strip], [zD, zD + 0.03], o),
      // Control strip on the top edge of the inner door: only a slim dark edge shows when closed.
      span('trim', [-w / 2 + 0.002, w / 2 - 0.002], [h - strip, h], [zD, zP + 0.003], { bevel: 0.0015, plan: false }),
      // Kitchen door panel, mounted on the inner door.
      span('front', [-w / 2 + 0.0015, w / 2 - 0.0015], [yPl + 0.004, h - strip - 0.003], [zP, zF], { bevel: 0.0015, plan: false }),
      span('body', [-0.2, 0.2], [h - 0.12, h - 0.06], [zD + 0.03, zP], o),
      // Recessed kitchen plinth, appliance base and feet.
      ...plinth('trim', 'body', w, d, yPl, zF),
      // InfoLight: the red dot it projects on the floor in front of the plinth.
      span('info', [-0.01, 0.01], [0, 0.0015], [zF - 0.035, zF - 0.022], { bevel: 0.0006, plan: false }),
    ];
    // Slim bar handle along the top of the panel (protrudes 16 mm).
    const hy = h - strip - 0.05;
    const hw = Math.min(0.32, w * 0.55);
    parts.push(
      span('body', [-hw / 2, hw / 2], [hy - 0.005, hy + 0.005], [zF + 0.008, zF + 0.016], { bevel: 0.002, plan: false }),
      span('body', [-hw / 2 + 0.01, -hw / 2 + 0.022], [hy - 0.004, hy + 0.004], [zF, zF + 0.008], o),
      span('body', [hw / 2 - 0.022, hw / 2 - 0.01], [hy - 0.004, hy + 0.004], [zF, zF + 0.008], o),
    );
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w / 2, d / 2 - 0.019], [w / 2, d / 2 - 0.019])],
});

// ---------------------------------------------------------------------------
// 5. Serie 6 SMI68NS06G — semi-integrated 60 cm, stainless control band
// ---------------------------------------------------------------------------

const smi6 = defineItem({
  id: 'smi68ns06g',
  name: 'Bosch Serie 6 SMI68NS06G semi-integrated dishwasher',
  category: 'kitchen',
  type: 'appliances',
  group: 'Cleaning',
  tags: [...TAGS, 'SMI68NS06G', 'serie 6', 'semi-integrated', 'built-in', '60 cm', 'stainless'],
  ...sizes(0.598, 0.573, 0.815),
  wallSnap: true,
  description:
    'Bosch Serie 6 semi-integrated 60 cm dishwasher: a stainless steel control band with display stays visible above a kitchen door panel. Holds 14 place settings.',
  brand: bosch('SMI68NS06G', 'Serie 6', 'https://media3.bosch-home.com/Documents/specsheet/en-GB/SMI68NS06G.pdf', [
    ['Place settings', '14'],
    ['Noise', '44 dB'],
    ['Noise class', 'B'],
    ['Installation', 'Semi-integrated'],
    ['Dimensions (H × W × D)', '815 × 598 × 573 mm'],
  ]),
  slots: [
    matSlot('front', 'Front panel', 'laminate-white-matte'),
    matSlot('panel', 'Control panel', 'bosch-inox'),
    matSlot('controls', 'Display, buttons, body & plinth', 'bosch-charcoal'),
    matSlot('display', 'Display', 'bosch-display'),
  ],
  build: ({ w, d, h }) => {
    const zF = d / 2;
    const zP = zF - 0.019;
    const zD = zP - 0.004 - 0.03;
    const yPl = 0.1;
    const bandH = 0.105;
    const yB0 = h - bandH;
    const grip = 0.016;
    const xs: V2 = [-w / 2 + 0.0015, w / 2 - 0.0015];
    const parts: Part[] = [
      span('controls', [-w / 2, w / 2], [yPl, h], [-d / 2, zD]),
      span('controls', [-w / 2 + 0.002, w / 2 - 0.002], [yPl + 0.004, yB0], [zD, zP], o),
      // Stainless control band, flush with the door panel, with a grip trough under its lip.
      span('panel', xs, [yB0, h - 0.002], [zD, zF], { bevel: 0.0025, plan: false }),
      span('panel', xs, [yB0, yB0 + 0.004], [zP - 0.002, zF + 0.002], { bevel: 0.0012, plan: false }),
      span('controls', [-w / 2 + 0.004, w / 2 - 0.004], [yB0 - grip, yB0], [zD, zP - 0.012], o),
      // Kitchen door panel.
      span('front', xs, [yPl + 0.004, yB0 - grip], [zP, zF], { bevel: 0.0015, plan: false }),
      ...plinth('controls', 'controls', w, d, yPl, zF),
      ...frontControls(w, yB0 + 0.006, h - 0.002, zF, { progs: 6, opts: 3, dispW: 0.12, text: '3:50' }),
    ];
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w / 2, d / 2 - 0.019], [w / 2, d / 2 - 0.019])],
});

// ---------------------------------------------------------------------------
// 6. 800 Series SHPM88Z75N — US 24″, stainless, pocket handle, top controls
// ---------------------------------------------------------------------------

const shpm88 = defineItem({
  id: 'shpm88z75n',
  name: 'Bosch 800 Series SHPM88Z75N dishwasher',
  category: 'kitchen',
  type: 'appliances',
  group: 'Cleaning',
  tags: [...TAGS, 'SHPM88Z75N', '800 series', '24 inch', 'built-in', 'stainless', 'pocket handle', 'infolight'],
  ...sizes(0.598, 0.603, 0.86),
  wallSnap: true,
  description:
    'Bosch 800 Series 24″ built-in dishwasher in stainless steel, with its controls hidden on the top edge of the door and a recessed pocket handle. Holds 16 place settings.',
  brand: bosch('SHPM88Z75N', '800 Series', 'https://www.bosch-home.com/us/en/product/SHPM88Z75N', [
    ['Place settings', '16'],
    ['Noise', '40 dB'],
    ['Weight', '116 lb'],
    ['Cutout', '33 7/8″ × 23 5/8″ × 24″'],
    ['Dimensions (H × W × D)', '33 7/8″ × 23 9/16″ × 23 3/4″ (860 × 598 × 603 mm)'],
  ]),
  slots: [
    matSlot('body', 'Door & toe kick', 'bosch-inox'),
    matSlot('cabinet', 'Tub & frame', 'bosch-steel'),
    matSlot('controls', 'Top controls & pocket', 'bosch-black-glass'),
    matSlot('info', 'InfoLight & readout', 'bosch-infolight'),
  ],
  build: ({ w, d, h }) => {
    const zF = d / 2;
    const zD = zF - 0.05;
    const yK = 0.1; // toe-kick height
    const yTop = h - 0.004;
    // Pocket handle: a recess across the top centre of the door.
    const pw = Math.min(0.3, w * 0.5);
    const p1 = yTop - 0.032;
    const p0 = p1 - 0.042;
    const pd = 0.024;
    const xs: V2 = [-w / 2 + 0.0015, w / 2 - 0.0015];
    const parts: Part[] = [
      // Tub/frame and the dark control strip on the door's top edge.
      span('cabinet', [-w / 2, w / 2], [yK, h], [-d / 2, zD]),
      span('controls', [-w / 2 + 0.004, w / 2 - 0.004], [yTop, h], [zD, zF - 0.003], { bevel: 0.0012, plan: false }),
      // Door around the pocket.
      span('body', xs, [yK + 0.004, p0], [zD, zF], { bevel: 0.003, plan: false }),
      span('body', xs, [p1, yTop], [zD, zF], { bevel: 0.002, plan: false }),
      span('body', [xs[0], -pw / 2], [p0 - 0.002, p1 + 0.002], [zD, zF], o),
      span('body', [pw / 2, xs[1]], [p0 - 0.002, p1 + 0.002], [zD, zF], o),
      // Pocket: stainless back, shadowed ceiling where the fingers go.
      span('body', [-pw / 2, pw / 2], [p0, p1], [zD, zF - pd], o),
      span('controls', [-pw / 2 + 0.002, pw / 2 - 0.002], [p1 - 0.008, p1], [zF - pd, zF - pd + 0.012], o),
      // Stainless toe kick, slightly recessed, over the base and feet.
      span('body', [-w / 2 + 0.004, w / 2 - 0.004], [0.006, yK], [zF - 0.04, zF - 0.025], { bevel: 0.0015, plan: false }),
      span('cabinet', [-w / 2 + 0.01, w / 2 - 0.01], [0.03, yK], [-d / 2 + 0.03, zF - 0.045], o),
      ...legs4('cabinet', w - 0.02, d - 0.12, 0.02, 0, 0.03, 0.028, { round: true }),
      // InfoLight dot on the floor.
      span('info', [-0.01, 0.01], [0, 0.0015], [zF - 0.02, zF - 0.008], { bevel: 0.0006, plan: false }),
    ];
    // Top-edge controls: a row of tiny touch keys and a short readout facing up.
    for (let i = 0; i < 7; i++) {
      const x = -w / 2 + 0.06 + i * 0.045;
      parts.push(span('cabinet', [x - 0.006, x + 0.006], [h - 0.0004, h + 0.0004], [zF - 0.03, zF - 0.022], o));
    }
    parts.push(span('info', [0.13, 0.18], [h - 0.0004, h + 0.0004], [zF - 0.032, zF - 0.02], o));
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w / 2, d / 2 - 0.05], [w / 2, d / 2 - 0.05])],
});

export default definePack({
  name: 'Bosch dishwashers',
  version: '1.0.0',
  author: 'Neest team',
  description:
    'Six real Bosch dishwashers built to their published dimensions: Serie 4 and Serie 2 freestanding, a Serie 4 table-top compact, Serie 6 fully integrated and semi-integrated, and a US 800 Series. Brand and spec data is in each item’s info card; no logos are drawn.',
  license: 'CC0 geometry (made for Neest); Bosch is a trademark of its owner',
  items: [sms4, sps2, sks62, smv6, smi6, shpm88],
  materials: [
    { id: 'bosch-inox', name: 'Bosch stainless (inox)', category: 'metal', color: '#c7cacd', roughness: 0.28, metalness: 0.9, pattern: { id: 'brushed', scale: 0.35, contrast: 0.55 } },
    { id: 'bosch-silver', name: 'Silver painted metal', category: 'metal', color: '#aeb2b6', roughness: 0.4, metalness: 0.6 },
    { id: 'bosch-steel', name: 'Galvanised steel', category: 'metal', color: '#a4a8ac', roughness: 0.45, metalness: 0.8, pattern: { id: 'brushed', scale: 0.5, contrast: 0.35 } },
    { id: 'bosch-white', name: 'Appliance white', color: '#f4f4f1', roughness: 0.3 },
    { id: 'bosch-black-glass', name: 'Black control glass', color: '#141518', roughness: 0.12, metalness: 0.3 },
    { id: 'bosch-charcoal', name: 'Charcoal plastic', color: '#2d2f32', roughness: 0.45 },
    { id: 'bosch-display', name: 'White LED readout', color: '#eef5ff', roughness: 0.3, emissive: '#d6e8ff', emissiveIntensity: 1.2 },
    { id: 'bosch-infolight', name: 'InfoLight red', color: '#ff3b30', roughness: 0.4, emissive: '#ff2414', emissiveIntensity: 2 },
  ],
});

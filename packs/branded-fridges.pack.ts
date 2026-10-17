/**
 * Branded fridges — six real refrigerators from Samsung, LG, Bosch and Liebherr, built to their
 * published dimensions.
 *
 * Side-by-side: Samsung RS68A8840S9 with an ice and water dispenser, LG GSXV91BSAE with an InstaView
 * glass panel. French door: Samsung Bespoke AI RF65DG960ESR (T-style, four doors) and LG InstaView
 * GMG960EVJE multi-door in matte black. Fridge-freezers: Bosch Serie 4 KGN392LDFG and Liebherr
 * CBNc 5723 Plus BioFresh NoFrost.
 *
 * Each item carries `brand` metadata (model, line, published specs and their source). Depth is the
 * overall depth including doors and handles, so the plan shows the real footprint. The shapes are
 * original procedural approximations: no logos or trademark artwork are drawn. Sizes are fixed
 * products: width and depth are locked and the height adjusts by ±2 cm (levelling feet).
 */
import {
  defineItem,
  definePack,
  legs4,
  line,
  matSlot,
  segmentText,
  span,
  type AssetBrand,
  type Part,
  type Size3,
  type V2,
} from '@/packs/kit';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Detail parts: hidden from the 2D plan. */
const o = { plan: false };

const TAGS = ['fridge', 'refrigerator', 'tủ lạnh', 'freezer', 'appliance', 'kitchen', 'no frost'];

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

/** A door: x and y ranges and where its handle goes. */
interface DoorRect {
  x: V2;
  y: V2;
  /** Handle along the left or right edge ('none' = handle-less). */
  handle: 'left' | 'right' | 'none';
  /** Handle length as a fraction of the door height (default 0.55), centred `handleAt` up the door. */
  handleLen?: number;
  handleAt?: number;
}

interface FridgeSpec {
  doors: DoorRect[];
  /** Door thickness. */
  doorT: number;
  /** Handles stand this far in front of the doors (included in d). */
  handleProj: number;
  /** Kick grille height at the bottom. */
  kick: number;
  /** 'bar': upright bar handles; 'grip': a recessed grip groove along the door edge. */
  handles: 'bar' | 'grip';
}

const GAP = 0.004;

/**
 * Freestanding fridge: cabinet, doors with gaps (dark gaskets show through), handles, a kick grille
 * and feet. Returns the parts and the door front depth so callers can add panels.
 * Slots: body (doors & cabinet), trim (handles), dark (gaskets, grille, glass panels).
 */
function fridge({ w, d, h }: Size3, s: FridgeSpec): { parts: Part[]; zD: number } {
  const zD = d / 2 - s.handleProj; // door fronts
  const zC = zD - s.doorT; // cabinet front
  const parts: Part[] = [
    span('body', [-w / 2, w / 2], [0.012, h], [-d / 2, zC], { bevel: 0.006 }),
    // Gasket band visible in the door gaps.
    span('dark', [-w / 2 + 0.004, w / 2 - 0.004], [s.kick, h - 0.004], [zC, zC + 0.01], o),
    // Kick grille with slots, and the feet behind it.
    span('dark', [-w / 2 + 0.006, w / 2 - 0.006], [0.012, s.kick - GAP], [zC - 0.01, zD - 0.02], { bevel: 0.003, plan: false }),
    ...legs4('dark', w - 0.04, d - s.handleProj - 0.12, 0.01, 0, 0.014, 0.04, { round: true }),
  ];
  for (let i = 0; i < 3; i++) {
    const y = 0.02 + i * ((s.kick - 0.035) / 2);
    parts.push(span('body', [-w / 2 + 0.06, w / 2 - 0.06], [y, y + 0.004], [zD - 0.021, zD - 0.019], o));
  }
  for (const dr of s.doors) {
    const x: V2 = [dr.x[0] + GAP / 2, dr.x[1] - GAP / 2];
    const y: V2 = [dr.y[0] + GAP / 2, dr.y[1] - GAP / 2];
    parts.push(span('body', x, y, [zC + 0.002, zD], { bevel: 0.006, plan: false }));
    if (dr.handle === 'none') continue;
    const dh = y[1] - y[0];
    const len = Math.min(dh - 0.06, dh * (dr.handleLen ?? 0.55));
    const yc = y[0] + dh * (dr.handleAt ?? 0.5);
    const hy: V2 = [Math.max(y[0] + 0.03, yc - len / 2), Math.min(y[1] - 0.03, yc + len / 2)];
    const edge = dr.handle === 'left' ? x[0] : x[1];
    const dir = dr.handle === 'left' ? 1 : -1;
    if (s.handles === 'grip') {
      // Recessed grip: a dark groove along the door edge with a lip.
      const gx: V2 = dir > 0 ? [edge, edge + 0.018] : [edge - 0.018, edge];
      parts.push(span('dark', gx, hy, [zD - 0.002, zD + 0.0008], o));
      continue;
    }
    // Upright bar on two standoffs, set in from the door edge.
    const xc = edge + dir * 0.045;
    const t = 0.012;
    parts.push(
      span('trim', [xc - t, xc + t], hy, [zD + s.handleProj * 0.45, zD + s.handleProj], { bevel: 0.007, plan: false }),
      span('trim', [xc - t * 0.6, xc + t * 0.6], [hy[0], hy[0] + 0.035], [zD, zD + s.handleProj * 0.5], { bevel: 0.004, plan: false }),
      span('trim', [xc - t * 0.6, xc + t * 0.6], [hy[1] - 0.035, hy[1]], [zD, zD + s.handleProj * 0.5], { bevel: 0.004, plan: false }),
    );
  }
  return { parts, zD };
}

/** Dark glass panel on a door front (InstaView, dispenser recess surround). */
const glassPanel = (x: V2, y: V2, zD: number): Part => span('dark', x, y, [zD, zD + 0.003], { bevel: 0.002, plan: false });

const plan = (proj: number, doorT: number) => ({ w, d }: Size3) => [line([-w / 2, d / 2 - proj - doorT], [w / 2, d / 2 - proj - doorT])];

// ---------------------------------------------------------------------------
// 1. Samsung RS68A8840S9 — side-by-side with ice & water dispenser
// ---------------------------------------------------------------------------

const rs68Spec = (w: number, h: number): FridgeSpec => {
  const xs = -w / 2 + w * 0.44;
  return {
    doors: [
      { x: [-w / 2, xs], y: [0.065, h - 0.004], handle: 'right', handleLen: 0.5, handleAt: 0.55 },
      { x: [xs, w / 2], y: [0.065, h - 0.004], handle: 'left', handleLen: 0.5, handleAt: 0.55 },
    ],
    doorT: 0.065,
    handleProj: 0.041,
    kick: 0.065,
    handles: 'bar',
  };
};

const samsungRs68 = defineItem({
  id: 'samsung-rs68a8840s9',
  name: 'Samsung RS68A8840S9 side-by-side fridge freezer',
  category: 'kitchen',
  type: 'appliances',
  group: 'Refrigeration',
  tags: [...TAGS, 'samsung', 'RS68A8840S9', 'side by side', 'american fridge', 'ice dispenser', 'water dispenser', 'stainless', 'inox'],
  ...sizes(0.912, 0.716, 1.78),
  wallSnap: true,
  description:
    'Samsung side-by-side American fridge freezer in silver inox, 634 litres, with SpaceMax walls and an ice and water dispenser with a display in the freezer door.',
  brand: brand('Samsung', 'RS68A8840S9', 'RS8000 SpaceMax', 'https://eprel.ec.europa.eu/informationsheet/Fiche_420364_EN.pdf', [
    ['Total capacity', '634 l'],
    ['Cooling', 'Twin Cooling Plus, No Frost'],
    ['Depth without doors', '610 mm (1165 mm with the door open)'],
    ['Installation', 'Freestanding'],
    ['Dimensions (H × W × D)', '1780 × 912 × 716 mm'],
  ]),
  slots: [
    matSlot('body', 'Doors & cabinet', 'fridge-inox'),
    matSlot('trim', 'Handles & dispenser paddle', 'fridge-handle-silver'),
    matSlot('dark', 'Gaskets, grille & dispenser', 'fridge-black-glass'),
    matSlot('display', 'Display', 'fridge-display'),
  ],
  build: (size) => {
    const { w, h } = size;
    const spec = rs68Spec(w, h);
    const { parts, zD } = fridge(size, spec);
    const xs = spec.doors[0].x[1];
    const xc = (-w / 2 + xs) / 2 - 0.01;
    // Dispenser: a dark recess with the paddle and drip tray, and the touch display above.
    const y0 = 0.98;
    const y1 = 1.32;
    parts.push(
      glassPanel([xc - 0.11, xc + 0.11], [y0, y1 + 0.09], zD),
      span('trim', [xc - 0.05, xc + 0.05], [y0 + 0.17, y0 + 0.26], [zD + 0.003, zD + 0.012], { bevel: 0.004, plan: false }),
      span('trim', [xc - 0.09, xc + 0.09], [y0 + 0.005, y0 + 0.022], [zD + 0.003, zD + 0.03], { bevel: 0.004, plan: false }),
      ...segmentText('display', '-19', xc - 0.04, y1 + 0.045, zD + 0.003, 0.022),
      ...segmentText('display', '3', xc + 0.05, y1 + 0.045, zD + 0.003, 0.022),
      span('display', [xc - 0.08, xc + 0.08], [y1 + 0.012, y1 + 0.014], [zD + 0.003, zD + 0.004], o),
    );
    return parts;
  },
  planDetail: plan(0.041, 0.065),
});

// ---------------------------------------------------------------------------
// 2. LG GSXV91BSAE — side-by-side with an InstaView glass panel
// ---------------------------------------------------------------------------

const lgGsx = defineItem({
  id: 'lg-gsxv91bsae',
  name: 'LG InstaView GSXV91BSAE side-by-side fridge freezer',
  category: 'kitchen',
  type: 'appliances',
  group: 'Refrigeration',
  tags: [...TAGS, 'lg', 'GSXV91BSAE', 'instaview', 'side by side', 'american fridge', 'stainless', 'door in door'],
  ...sizes(0.913, 0.735, 1.79),
  wallSnap: true,
  description:
    'LG InstaView side-by-side American fridge freezer in stainless steel, 635 litres. Knock twice on the tinted glass panel in the fridge door and it lights up to show inside.',
  brand: brand('LG', 'GSXV91BSAE', 'InstaView', 'https://www.lg.com/at/kuehlschraenke/lg-gsxv91bsae', [
    ['Total capacity', '635 l'],
    ['Features', 'InstaView Door-in-Door, UVnano, NatureFRESH'],
    ['Water', 'Not plumbed'],
    ['Installation', 'Freestanding'],
    ['Dimensions (W × H × D)', '913 × 1790 × 735 mm'],
  ]),
  slots: [
    matSlot('body', 'Doors & cabinet', 'fridge-inox'),
    matSlot('trim', 'Handles', 'fridge-handle-silver'),
    matSlot('dark', 'InstaView glass, gaskets & grille', 'fridge-mirror-glass'),
  ],
  build: (size) => {
    const { w, h } = size;
    const xs = -w / 2 + w * 0.45;
    const { parts, zD } = fridge(size, {
      doors: [
        { x: [-w / 2, xs], y: [0.06, h - 0.004], handle: 'right', handleLen: 0.5, handleAt: 0.55 },
        { x: [xs, w / 2], y: [0.06, h - 0.004], handle: 'left', handleLen: 0.5, handleAt: 0.55 },
      ],
      doorT: 0.07,
      handleProj: 0.05,
      kick: 0.06,
      handles: 'bar',
    });
    // InstaView: tinted glass over the upper door-in-door, framed by the door.
    parts.push(glassPanel([xs + 0.09, w / 2 - 0.035], [h * 0.42, h - 0.12], zD));
    return parts;
  },
  planDetail: plan(0.05, 0.07),
});

// ---------------------------------------------------------------------------
// 3. Samsung RF65DG960ESR — Bespoke AI T-style French door, four doors
// ---------------------------------------------------------------------------

const samsungRf65 = defineItem({
  id: 'samsung-rf65dg960esr',
  name: 'Samsung Bespoke AI RF65DG960ESR French door fridge freezer',
  category: 'kitchen',
  type: 'appliances',
  group: 'Refrigeration',
  tags: [...TAGS, 'samsung', 'RF65DG960ESR', 'bespoke', 'bespoke ai', 'french door', 't-style', '4 door', 'beverage center', 'american fridge'],
  ...sizes(0.912, 0.723, 1.83),
  wallSnap: true,
  description:
    'Samsung Bespoke AI T-style French door fridge freezer in silver, 646 litres: two fridge doors on top (the left one hides a Beverage Center with a water dispenser) over two side-by-side freezer doors.',
  brand: brand('Samsung', 'RF65DG960ESR', 'Bespoke AI RF9000D', 'https://ushl.samsung.com/es/refrigerators/french-door/rf9000d-rf9000dc-t-style-french-door-beverage-center-646l-silver-rf65dg960esref', [
    ['Total capacity', '646 l'],
    ['Features', 'Beverage Center, AutoFill water pitcher, AI Energy Mode'],
    ['Depth without doors', '610 mm (1093 mm with the doors open)'],
    ['Installation', 'Freestanding'],
    ['Dimensions (H × W × D)', '1830 × 912 × 723 mm'],
  ]),
  slots: [
    matSlot('body', 'Doors & cabinet', 'fridge-silver'),
    matSlot('trim', 'Handles', 'fridge-handle-silver'),
    matSlot('dark', 'Gaskets & grille', 'fridge-black-glass'),
  ],
  build: (size) => {
    const { w, h } = size;
    const yS = 0.06 + (h - 0.064) * 0.4;
    return fridge(size, {
      doors: [
        { x: [-w / 2, 0], y: [yS, h - 0.004], handle: 'right', handleLen: 0.62, handleAt: 0.45 },
        { x: [0, w / 2], y: [yS, h - 0.004], handle: 'left', handleLen: 0.62, handleAt: 0.45 },
        { x: [-w / 2, 0], y: [0.06, yS], handle: 'right', handleLen: 0.62, handleAt: 0.55 },
        { x: [0, w / 2], y: [0.06, yS], handle: 'left', handleLen: 0.62, handleAt: 0.55 },
      ],
      doorT: 0.07,
      handleProj: 0.043,
      kick: 0.06,
      handles: 'bar',
    }).parts;
  },
  planDetail: plan(0.043, 0.07),
});

// ---------------------------------------------------------------------------
// 4. LG GMG960EVJE — InstaView multi-door, matte black
// ---------------------------------------------------------------------------

const lgGmg = defineItem({
  id: 'lg-gmg960evje',
  name: 'LG InstaView GMG960EVJE multi-door fridge freezer',
  category: 'kitchen',
  type: 'appliances',
  group: 'Refrigeration',
  tags: [...TAGS, 'lg', 'GMG960EVJE', 'instaview', 'multi door', 'french door', '4 door', 'black', 'matte black'],
  ...sizes(0.914, 0.729, 1.792),
  wallSnap: true,
  description:
    'LG InstaView multi-door fridge freezer in matte black, 638 litres: French doors on top with a tinted InstaView panel in the right door, and two freezer drawers below.',
  brand: brand('LG', 'GMG960EVJE', 'InstaView Multi-door', 'https://www.lg.com/at/kuehlschraenke/lg-gmg960evje', [
    ['Total capacity', '638 l (364 l fridge, 274 l freezer)'],
    ['Features', 'InstaView, UVnano, Total No Frost'],
    ['Noise', '40 dB'],
    ['Installation', 'Freestanding'],
    ['Dimensions (W × H × D)', '914 × 1792 × 729 mm'],
  ]),
  slots: [
    matSlot('body', 'Doors & cabinet', 'fridge-matte-black'),
    matSlot('trim', 'Handles', 'fridge-handle-black'),
    matSlot('dark', 'InstaView glass, gaskets & grille', 'fridge-mirror-glass'),
  ],
  build: (size) => {
    const { w, h } = size;
    const yS = 0.06 + (h - 0.064) * 0.38;
    const yM = 0.06 + (yS - 0.06) / 2;
    const { parts, zD } = fridge(size, {
      doors: [
        { x: [-w / 2, 0], y: [yS, h - 0.004], handle: 'right', handleLen: 0.55, handleAt: 0.4 },
        { x: [0, w / 2], y: [yS, h - 0.004], handle: 'left', handleLen: 0.55, handleAt: 0.4 },
        { x: [-w / 2, 0], y: [yM, yS], handle: 'right', handleLen: 0.5 },
        { x: [0, w / 2], y: [yM, yS], handle: 'left', handleLen: 0.5 },
        { x: [-w / 2, 0], y: [0.06, yM], handle: 'right', handleLen: 0.5 },
        { x: [0, w / 2], y: [0.06, yM], handle: 'left', handleLen: 0.5 },
      ],
      doorT: 0.07,
      handleProj: 0.045,
      kick: 0.06,
      handles: 'bar',
    });
    parts.push(glassPanel([0.09, w / 2 - 0.035], [yS + 0.12, h - 0.1], zD));
    return parts;
  },
  planDetail: plan(0.045, 0.07),
});

// ---------------------------------------------------------------------------
// 5. Bosch Serie 4 KGN392LDFG — fridge-freezer, 60 cm, inox-look
// ---------------------------------------------------------------------------

const boschKgn = defineItem({
  id: 'bosch-kgn392ldfg',
  name: 'Bosch Serie 4 KGN392LDFG fridge freezer',
  category: 'kitchen',
  type: 'appliances',
  group: 'Refrigeration',
  tags: [...TAGS, 'bosch', 'KGN392LDFG', 'serie 4', 'fridge freezer', 'bottom freezer', '60 cm', 'inox look', 'vitafresh'],
  ...sizes(0.6, 0.665, 2.03),
  wallSnap: true,
  description:
    'Bosch Serie 4 freestanding fridge freezer, 60 cm wide and 2.03 m tall, in inox-look with upright bar handles: NoFrost freezer below and VitaFresh drawers in the fridge.',
  brand: brand('Bosch', 'KGN392LDFG', 'Serie 4', 'https://www.bosch-home.ie/en/mkt-product/fridges-and-freezers/fridge-freezers/freestanding-fridge-freezers-with-freezer-at-bottom/KGN392LDFG', [
    ['Features', 'NoFrost, VitaFresh, MultiAirflow'],
    ['Door hinge', 'Right, reversible'],
    ['Installation', 'Freestanding'],
    ['Dimensions (H × W × D)', '2030 × 600 × 665 mm'],
  ]),
  slots: [
    matSlot('body', 'Doors & cabinet', 'fridge-inox-look'),
    matSlot('trim', 'Handles', 'fridge-handle-silver'),
    matSlot('dark', 'Gaskets & grille', 'fridge-charcoal'),
  ],
  build: (size) => {
    const { w, h } = size;
    const yS = 0.75;
    return fridge(size, {
      doors: [
        { x: [-w / 2, w / 2], y: [yS, h - 0.004], handle: 'left', handleLen: 0.42, handleAt: 0.3 },
        { x: [-w / 2, w / 2], y: [0.05, yS], handle: 'left', handleLen: 0.45, handleAt: 0.8 },
      ],
      doorT: 0.065,
      handleProj: 0.035,
      kick: 0.05,
      handles: 'bar',
    }).parts;
  },
  planDetail: plan(0.035, 0.065),
});

// ---------------------------------------------------------------------------
// 6. Liebherr CBNc 5723 Plus — BioFresh NoFrost fridge-freezer, white
// ---------------------------------------------------------------------------

const liebherrCbn = defineItem({
  id: 'liebherr-cbnc-5723',
  name: 'Liebherr CBNc 5723 Plus BioFresh fridge freezer',
  category: 'kitchen',
  type: 'appliances',
  group: 'Refrigeration',
  tags: [...TAGS, 'liebherr', 'CBNc 5723', 'CBNc5723', 'biofresh', 'nofrost', 'fridge freezer', 'bottom freezer', '60 cm', 'white', 'handleless'],
  ...sizes(0.597, 0.675, 2.015),
  wallSnap: true,
  description:
    'Liebherr Plus fridge freezer in white, 2.015 m tall, with flat doors and grips recessed into their side edges. BioFresh drawers keep produce fresh longer; the freezer below is NoFrost.',
  brand: brand('Liebherr', 'CBNc 5723', 'Plus BioFresh NoFrost', 'https://assets-cdn.liebherr.com/versions/eaa663be-3ed0-4e36-bf11-95048d94adb9/original/SP_CBNc5723_001_22.pdf', [
    ['Total capacity', '360 l'],
    ['Features', 'BioFresh, NoFrost, EasyFresh'],
    ['Energy class', 'C'],
    ['Installation', 'Freestanding'],
    ['Dimensions (H × W × D)', '2015 × 597 × 675 mm'],
  ]),
  slots: [
    matSlot('body', 'Doors & cabinet', 'fridge-white'),
    matSlot('dark', 'Grips, gaskets & grille', 'fridge-charcoal'),
  ],
  build: (size) => {
    const { w, h } = size;
    const yS = 0.72;
    return fridge(size, {
      doors: [
        { x: [-w / 2, w / 2], y: [yS, h - 0.004], handle: 'left', handleLen: 0.35, handleAt: 0.25 },
        { x: [-w / 2, w / 2], y: [0.05, yS], handle: 'left', handleLen: 0.4, handleAt: 0.75 },
      ],
      doorT: 0.07,
      handleProj: 0,
      kick: 0.05,
      handles: 'grip',
    }).parts;
  },
  planDetail: plan(0, 0.07),
});

export default definePack({
  name: 'Branded fridges',
  version: '1.0.0',
  author: 'Neest team',
  description:
    'Six real fridges built to their published dimensions: Samsung and LG side-by-sides, Samsung Bespoke AI and LG InstaView French door models, and Bosch Serie 4 and Liebherr Plus fridge-freezers. Brand and spec data is in each item’s info card; no logos are drawn.',
  license: 'CC0 geometry (made for Neest); Samsung, LG, Bosch and Liebherr are trademarks of their owners',
  items: [samsungRs68, lgGsx, samsungRf65, lgGmg, boschKgn, liebherrCbn],
  materials: [
    { id: 'fridge-inox', name: 'Fridge stainless steel', category: 'metal', color: '#c4c7ca', roughness: 0.3, metalness: 0.85, pattern: { id: 'brushed', scale: 0.4, contrast: 0.5 } },
    { id: 'fridge-inox-look', name: 'Inox-look finish', category: 'metal', color: '#b9bcc0', roughness: 0.38, metalness: 0.7, pattern: { id: 'brushed', scale: 0.5, contrast: 0.35 } },
    { id: 'fridge-silver', name: 'Clean silver', category: 'metal', color: '#b3b6ba', roughness: 0.35, metalness: 0.75 },
    { id: 'fridge-matte-black', name: 'Matte black steel', category: 'metal', color: '#232427', roughness: 0.55, metalness: 0.45 },
    { id: 'fridge-white', name: 'Appliance white', color: '#f3f3f0', roughness: 0.3 },
    { id: 'fridge-handle-silver', name: 'Handle silver', category: 'metal', color: '#a9adb2', roughness: 0.22, metalness: 0.9 },
    { id: 'fridge-handle-black', name: 'Handle black', category: 'metal', color: '#2a2b2f', roughness: 0.35, metalness: 0.6 },
    { id: 'fridge-black-glass', name: 'Black glass', category: 'glass', color: '#141518', roughness: 0.1, metalness: 0.3 },
    { id: 'fridge-mirror-glass', name: 'InstaView tinted glass', category: 'glass', color: '#0f1114', roughness: 0.04, metalness: 0.6 },
    { id: 'fridge-charcoal', name: 'Charcoal plastic', color: '#2b2d31', roughness: 0.5 },
    { id: 'fridge-display', name: 'White LED readout', color: '#eef6ff', roughness: 0.3, emissive: '#d4e6ff', emissiveIntensity: 1.2 },
  ],
});

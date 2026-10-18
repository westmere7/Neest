/**
 * Branded audio — six speakers popular in Vietnam, at their published sizes.
 *
 * Portable Bluetooth: JBL Flip 6. Party / karaoke: JBL PartyBox 110 with its light
 * show, and the Acnos Acoustic 3 karaoke speaker (a Vietnamese brand). Home: Marshall Stanmore III
 * and the Samsung HW-Q600C soundbar with its wireless subwoofer.
 *
 * Original procedural shapes: fabric or tolex bodies, rings for drivers and passive radiators,
 * no logos or trademark artwork. Fixed products, so nothing resizes.
 */
import {
  cyl,
  defineItem,
  definePack,
  discZ,
  matSlot,
  prism,
  range,
  rectPoly,
  rod,
  roundRectPoints,
  span,
  sphere,
  torus,
  type AssetBrand,
  type Part,
  type Size3,
} from '@/packs/kit';

const o = { plan: false };
const TAGS = ['speaker', 'loa', 'audio', 'bluetooth', 'electronics', 'branded', 'vietnam'];

function fixed(w: number, d: number, h: number) {
  const s: Size3 = { w, d, h };
  return { defaultSize: s, minSize: s, maxSize: s, resizable: { w: false, d: false, h: false } };
}

const brand = (name: string, model: string, line: string, url: string, specs: [string, string][]): AssetBrand => ({ name, model, line, url, specs });

/** Front-facing driver: a recessed cone with a surround ring and dust cap at (x, y) on face z. */
function driver(slot: string, ringSlot: string, x: number, y: number, z: number, r: number): Part[] {
  return [
    discZ(slot, [x, y, z - 0.006], r * 0.92, 0.006, o),
    torus(ringSlot, [x, y, z - 0.002], r * 0.94, Math.max(0.002, r * 0.06), o),
    sphere(slot, [x, y, z - 0.004], r * 0.25, { scale: [1, 1, 0.5], plan: false }),
  ];
}

/** Horizontal capsule speaker (Flip / Charge): fabric tube along x with passive radiator end caps. */
function capsule(w: number, d: number, h: number, flatFoot: boolean): Part[] {
  const r = Math.min(d, h) / 2;
  const len = w - 0.012;
  const parts: Part[] = [
    cyl('fabric', [0, r, 0], r, len - 0.01, { rotation: [0, 0, Math.PI / 2], segments: 32 }),
    ...[-1, 1].map((s) => cyl('caps', [s * (len / 2 - 0.004), r, 0], r * 1.01, 0.012, { rotation: [0, 0, Math.PI / 2], segments: 32, plan: false })),
    ...[-1, 1].map((s) => cyl('radiator', [s * (len / 2 + 0.003), r, 0], r * 0.7, 0.004, { rotation: [0, 0, Math.PI / 2], segments: 28, plan: false })),
    ...[-1, 1].map((s) => torus('caps', [s * (len / 2 + 0.004), r, 0], r * 0.78, 0.003, { rotation: [0, Math.PI / 2, 0], plan: false })),
    // Rubber strip with the buttons along the top.
    span('caps', [-len * 0.18, len * 0.18], [2 * r - 0.004, 2 * r + 0.0], [-0.008, 0.008], { bevel: 0.002, plan: false }),
  ];
  if (flatFoot) parts.push(span('caps', [-len * 0.32, len * 0.32], [0, 0.008], [-r * 0.45, r * 0.45], { bevel: 0.003 }));
  return parts;
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

const flip6 = defineItem({
  id: 'jbl-flip-6',
  name: 'JBL Flip 6',
  category: 'living',
  type: 'electronics',
  group: 'TV & audio',
  tags: [...TAGS, 'jbl', 'flip 6', 'portable speaker', 'loa bluetooth'],
  description: 'Compact waterproof JBL capsule speaker with passive radiators at both ends.',
  ...fixed(0.178, 0.072, 0.068),
  slots: [matSlot('fabric', 'Fabric', 'fabric-navy'), matSlot('caps', 'Rubber ends & strip', 'rubber-black'), matSlot('radiator', 'Passive radiators', 'metal-anthracite')],
  build: ({ w, d, h }) => capsule(w, d, h, false),
  brand: brand('JBL', 'Flip 6', 'Portable Bluetooth speaker', 'https://priceoye.pk/bluetooth-speakers/compare/jbl-charge-5-portable-bluetooth-speaker-vs-jbl-flip-6-portable-bluetooth-speaker', [
    ['Size', '178 × 68 × 72 mm'],
    ['Weight', '0.55 kg'],
    ['Water and dust', 'IP67'],
  ]),
});

const partyBox = defineItem({
  id: 'jbl-partybox-110',
  name: 'JBL PartyBox 110',
  category: 'living',
  type: 'electronics',
  group: 'TV & audio',
  tags: [...TAGS, 'jbl', 'partybox', 'party speaker', 'karaoke', 'loa kéo', 'light show'],
  description: 'Upright 160 W party speaker with two woofers ringed by a pulsing light show, mic and guitar inputs for karaoke.',
  ...fixed(0.295, 0.3, 0.568),
  slots: [matSlot('body', 'Body', 'plastic-black'), matSlot('grille', 'Grille & drivers', 'metal-anthracite'), matSlot('trim', 'Handle & panel', 'rubber-black'), matSlot('light', 'Light show', 'partybox-glow')],
  build: ({ w, d, h }) => {
    const zf = d / 2;
    const parts: Part[] = [prism('body', roundRectPoints(0, 0, w, d, 0.04, 5), 0, h - 0.03), prism('trim', roundRectPoints(0, 0, w - 0.02, d - 0.02, 0.035, 5), h - 0.03, 0.03, o)];
    parts.push(span('body', [-w * 0.3, w * 0.3], [h - 0.02, h], [-0.025, 0.025], { bevel: 0.01, plan: false }));
    for (const y of [h * 0.29, h * 0.66]) {
      parts.push(torus('light', [0, y, zf - 0.002], w * 0.37, 0.006, o));
      parts.push(...driver('grille', 'trim', 0, y, zf, w * 0.33));
    }
    parts.push(span('trim', [-w * 0.32, w * 0.32], [h - 0.09, h - 0.05], [zf - 0.004, zf + 0.002], o));
    for (const x of [-0.08, -0.03, 0.03, 0.08]) parts.push(cyl('grille', [x, h - 0.07, zf + 0.003], 0.008, 0.006, { rotation: [Math.PI / 2, 0, 0], plan: false }));
    return parts;
  },
  light: { color: '#ff3cbe', intensity: 0.25, distance: 1.5, y: 0.3, z: 0.16 },
  brand: brand('JBL', 'PartyBox 110', 'PartyBox', 'https://support.jbl.com/kr/kr/speakers/speakers-bluetooth-wireless/PARTYBOX-110-.html', [
    ['Size (W × H × D)', '295 × 568 × 300 mm'],
    ['Weight', '10.84 kg'],
    ['Output', '160 W'],
    ['Inputs', 'Mic, guitar, AUX, USB'],
  ]),
});

const acnos = defineItem({
  id: 'acnos-acoustic-3',
  name: 'Acnos Acoustic 3 karaoke speaker',
  category: 'living',
  type: 'electronics',
  group: 'TV & audio',
  tags: [...TAGS, 'acnos', 'sơn ca', 'karaoke', 'loa karaoke', 'loa kéo', 'hát karaoke'],
  description: 'Wooden Vietnamese karaoke speaker (Acnos by Sơn Ca) with a 25 cm woofer, horn tweeter and carry handle: the heart of a family karaoke night.',
  ...fixed(0.355, 0.26, 0.5),
  slots: [matSlot('wood', 'Cabinet', 'wood-walnut'), matSlot('grille', 'Drivers', 'metal-anthracite'), matSlot('trim', 'Panel & handle', 'plastic-black')],
  build: ({ w, d, h }) => {
    const zf = d / 2;
    const parts: Part[] = [span('wood', [-w / 2, w / 2], [0.02, h], [-d / 2, zf - 0.01], { bevel: 0.008 }), span('trim', [-w / 2 + 0.01, w / 2 - 0.01], [0.02, h - 0.01], [zf - 0.012, zf - 0.006], o)];
    for (const s of [-1, 1]) for (const z of [-1, 1]) parts.push(cyl('trim', [s * (w / 2 - 0.04), 0.01, z * (d / 2 - 0.04)], 0.018, 0.02));
    parts.push(...driver('grille', 'trim', 0, h * 0.36, zf - 0.004, 0.125));
    parts.push(span('grille', [-0.07, 0.07], [h * 0.68, h * 0.8], [zf - 0.03, zf - 0.004], { bevel: 0.01, plan: false }), span('trim', [-0.05, 0.05], [h * 0.7, h * 0.78], [zf - 0.032, zf - 0.03], o));
    parts.push(span('trim', [-w / 2 + 0.03, w / 2 - 0.03], [h * 0.86, h * 0.95], [zf - 0.006, zf - 0.002], o));
    parts.push(rod('trim', [-0.09, h, 0], [-0.07, h + 0.0, 0], 0.008, o), span('trim', [-0.09, 0.09], [h - 0.004, h], [-0.02, 0.02], { bevel: 0.006, plan: false }));
    return parts;
  },
  brand: brand('Acnos', 'Acoustic 3', 'Karaoke speaker (Sơn Ca)', 'https://hdradio.vn/loa-acnos-acoustic-3-v26/', [
    ['Size', '500 × 355 × 260 mm'],
    ['Woofer', '25 cm'],
    ['Output', '220 W'],
    ['Brand', 'Vietnamese (Sơn Ca)'],
  ]),
});

/** Marshall-style speaker: tolex box, piped fabric grille, brass control strip and knobs on top. */
function marshall(w: number, d: number, h: number, knobs: number): Part[] {
  const zf = d / 2;
  const parts: Part[] = [
    span('tolex', [-w / 2, w / 2], [0.008, h], [-d / 2, zf - 0.008], { bevel: 0.012 }),
    span('grille', [-w / 2 + 0.012, w / 2 - 0.012], [0.02, h - 0.035], [zf - 0.012, zf], { bevel: 0.006 }),
    span('brass', [-w / 2 + 0.014, w / 2 - 0.014], [h - 0.002, h + 0.0], [zf - 0.07, zf - 0.02], { plan: false }),
    ...[-1, 1].flatMap((s) => [-1, 1].map((z) => cyl('tolex', [s * (w / 2 - 0.03), 0.004, z * (d / 2 - 0.03)], 0.012, 0.008, o))),
  ];
  // Piping round the grille.
  for (const y of [0.02, h - 0.035]) parts.push(span('brass', [-w / 2 + 0.012, w / 2 - 0.012], [y - 0.0015, y + 0.0015], [zf - 0.001, zf + 0.001], o));
  for (const i of range(knobs)) {
    const x = -w / 2 + 0.05 + i * Math.min(0.045, (w - 0.1) / Math.max(1, knobs - 1));
    parts.push(cyl('brass', [x, h + 0.008, zf - 0.045], 0.011, 0.016, { segments: 18, plan: false }));
  }
  return parts;
}

const MARSHALL_SLOTS = [matSlot('tolex', 'Tolex', 'leather-black'), matSlot('grille', 'Grille cloth', 'marshall-grille'), matSlot('brass', 'Brass panel & knobs', 'metal-brass')];

const stanmore = defineItem({
  id: 'marshall-stanmore-iii',
  name: 'Marshall Stanmore III',
  category: 'living',
  type: 'electronics',
  group: 'TV & audio',
  tags: [...TAGS, 'marshall', 'stanmore', 'home speaker', 'vintage'],
  description: 'Amp-styled Marshall home speaker in black tolex with a woven grille and brass knobs.',
  ...fixed(0.35, 0.188, 0.211),
  slots: MARSHALL_SLOTS,
  build: ({ w, d, h }) => marshall(w, d, h - 0.008, 4),
  brand: brand('Marshall', 'Stanmore III', 'Home speakers', 'https://comparisontabl.es/bluetooth-speakers/marshall-stanmore-iii-vs-marshall-acton-iii/', [
    ['Size (W × H × D)', '350 × 203 × 188 mm'],
    ['Weight', '4.25 kg'],
    ['Output', '80 W'],
  ]),
});

const soundbar = defineItem({
  id: 'samsung-hw-q600c-soundbar',
  name: 'Samsung HW-Q600C soundbar',
  category: 'living',
  type: 'electronics',
  group: 'TV & audio',
  tags: [...TAGS, 'samsung', 'soundbar', 'loa thanh', 'dolby atmos', 'tv audio'],
  description: '3.1.2-channel Dolby Atmos soundbar with a wrap-around metal grille, to sit in front of the TV.',
  ...fixed(1.03, 0.105, 0.057),
  slots: [matSlot('body', 'Body', 'plastic-black'), matSlot('grille', 'Grille', 'metal-anthracite')],
  build: ({ w, d, h }) => {
    const prof = roundRectPoints(0, 0, w, d, 0.03, 5);
    return [
      prism('body', prof, 0.004, h - 0.012),
      prism('grille', roundRectPoints(0, 0, w + 0.002, d + 0.002, 0.031, 5), 0.01, h - 0.022, o),
      prism('body', roundRectPoints(0, 0, w - 0.004, d - 0.004, 0.028, 5), h - 0.012, 0.008, o),
      ...[-1, 1].map((s) => span('body', [s * w * 0.4 - 0.03, s * w * 0.4 + 0.03], [0, 0.004], [-d / 2 + 0.02, d / 2 - 0.02], o)),
    ];
  },
  planDetail: ({ w, d }) => [rectPoly(-w / 2 + 0.02, -d / 2 + 0.01, w / 2 - 0.02, d / 2 - 0.01)],
  brand: brand('Samsung', 'HW-Q600C', 'Q-series soundbar', 'https://ee.co.uk/help/tech/device/Samsung/HW-Q600CSoundbar', [
    ['Channels', '3.1.2, Dolby Atmos'],
    ['Soundbar (W × H × D)', '1030 × 57 × 105 mm'],
    ['Weight', '3.8 kg'],
  ]),
});

const subwoofer = defineItem({
  id: 'samsung-hw-q600c-subwoofer',
  name: 'Samsung HW-Q600C subwoofer',
  category: 'living',
  type: 'electronics',
  group: 'TV & audio',
  tags: [...TAGS, 'samsung', 'subwoofer', 'loa sub', 'bass', 'soundbar'],
  description: 'The wireless subwoofer of the HW-Q600C set, with a side-firing driver behind a grille.',
  ...fixed(0.184, 0.295, 0.343),
  slots: [matSlot('body', 'Cabinet', 'plastic-black'), matSlot('grille', 'Grille', 'fabric-charcoal')],
  build: ({ w, d, h }) => {
    const parts: Part[] = [span('body', [-w / 2, w / 2], [0.01, h], [-d / 2, d / 2], { bevel: 0.006 })];
    parts.push(span('grille', [w / 2 - 0.004, w / 2 + 0.0], [0.04, h - 0.03], [-d / 2 + 0.03, d / 2 - 0.03], o));
    parts.push(...[-1, 1].flatMap((s) => [-1, 1].map((z) => cyl('body', [s * (w / 2 - 0.03), 0.005, z * (d / 2 - 0.04)], 0.015, 0.01, o))));
    parts.push(cyl('grille', [-w / 2 + 0.002, h * 0.3, -d / 2 + 0.06], 0.02, 0.004, { rotation: [0, 0, Math.PI / 2], plan: false }));
    return parts;
  },
  brand: brand('Samsung', 'PS-WC67B (HW-Q600C)', 'Q-series wireless subwoofer', 'https://ee.co.uk/help/tech/device/Samsung/HW-Q600CSoundbar', [
    ['Subwoofer (W × H × D)', '184 × 343 × 295 mm'],
    ['Weight', '5.5 kg'],
    ['Connection', 'Wireless to the soundbar'],
  ]),
});

export default definePack({
  name: 'Branded audio',
  version: '1.0.0',
  author: 'Neest team',
  description: 'Six speakers popular in Vietnam at their published sizes: JBL Flip 6 and PartyBox 110, Acnos Acoustic 3 karaoke, Marshall Stanmore III, and the Samsung HW-Q600C soundbar and subwoofer.',
  license: 'CC0 (made for Neest); brand names belong to their owners',
  items: [flip6, partyBox, acnos, stanmore, soundbar, subwoofer],
  materials: [
    { id: 'partybox-glow', name: 'Party light', color: '#ff4fc3', roughness: 0.4, emissive: '#ff3cbe', emissiveIntensity: 2.2 },
    { id: 'marshall-grille', name: 'Marshall grille cloth', category: 'fabric', color: '#2b2a28', roughness: 0.9, pattern: { id: 'weave', scale: 0.03 } },
  ],
});


/**
 * Branded tech & office (Vietnam) — the printer, monitor, console, projector, desktop PC, office
 * chair and steel filing cabinet that Vietnamese homes and offices actually buy: Canon LBP2900,
 * Samsung S24C310, Sony PS5 Slim, Epson EB-E01, Dell Vostro 3020 MT, Sihoo M57 and Hòa Phát TU4F.
 *
 * Every item is a real model at its published size (`brand.url` names the page the size and specs
 * come from). Original procedural shapes: no logos or trademark artwork, a plain plate where the
 * maker's badge sits. Fixed products, so nothing resizes; where the maker sells several finishes
 * they are offered as colour variants.
 */
import {
  defineItem,
  definePack,
  box,
  cellSpans,
  cyl,
  discZ,
  frame4,
  matSlot,
  prism,
  range,
  rectPoly,
  line,
  circle,
  rod,
  rodX,
  roundRectPoints,
  slats,
  span,
  sphere,
  torus,
  vcyl,
  type AssetBrand,
  type AssetPresetVariant,
  type PackMaterial,
  type PackPattern,
  type Part,
  type Size3,
  type V2,
  type V3,
} from '@/packs/kit';

const o = { plan: false };

function fixed(w: number, d: number, h: number) {
  const s: Size3 = { w, d, h };
  return { defaultSize: s, minSize: s, maxSize: s, resizable: { w: false, d: false, h: false } };
}

const brand = (name: string, model: string, line: string, url: string, specs: [string, string][]): AssetBrand => ({ name, model, line, url, specs });

/** The maker's finishes as colour variants: [id, name, { slot: material }]. */
const finishes = (...list: [string, string, Record<string, string>][]): AssetPresetVariant[] => list.map(([id, name, materials]) => ({ id, name, materials }));

const TAGS = ['branded', 'vietnam'];

// ---------------------------------------------------------------------------
// Canon imageCLASS LBP2900 — the office laser printer of Vietnam
// ---------------------------------------------------------------------------

/**
 * Compact ivory laser printer: a rounded body with the face-down output tray sunk into the top
 * between two side rails and a raised rear hump, the front cover that folds down into the paper
 * feed tray, a dark feed slit, side vents and the power light on the right rail.
 */
function lbp2900({ w, d, h }: Size3): Part[] {
  const zf = d / 2 - 0.014; // front face of the body above the cover
  const yt = 0.2; // output tray floor
  const xr = 0.128; // inner edge of the side rails
  const parts: Part[] = [
    span('body', [-w / 2 + 0.002, w / 2 - 0.002], [0.006, 0.19], [-d / 2 + 0.002, zf], { bevel: 0.012 }),
    // Rear hump over the fuser and the two side rails around the output tray.
    span('body', [-w / 2 + 0.002, w / 2 - 0.002], [0.18, h], [-d / 2 + 0.002, -d / 2 + 0.075], { bevel: 0.015, plan: false }),
    span('body', [-w / 2 + 0.002, -xr], [0.18, h - 0.006], [-d / 2 + 0.06, d / 2 - 0.02], { bevel: 0.012, plan: false }),
    span('body', [xr, w / 2 - 0.002], [0.18, h - 0.006], [-d / 2 + 0.06, d / 2 - 0.02], { bevel: 0.012, plan: false }),
    // Output tray floor with a printed page lying face down, and the paper stopper at its front.
    span('body', [-xr - 0.002, xr + 0.002], [0.18, yt], [-d / 2 + 0.07, d / 2 - 0.02], { plan: false }),
    span('paper', [-0.105, 0.105], [yt, yt + 0.0015], [-d / 2 + 0.078, d / 2 - 0.045], o),
    span('trim', [-0.05, 0.05], [yt, yt + 0.004], [d / 2 - 0.037, d / 2 - 0.022], { bevel: 0.0015, plan: false }),
    // Front cover (opens down into the feed tray), finger grip, feed slit.
    span('body', [-w / 2 + 0.012, w / 2 - 0.012], [0.012, 0.13], [zf, d / 2 - 0.003], { bevel: 0.01, plan: false }),
    span('trim', [-0.045, 0.045], [0.112, 0.12], [d / 2 - 0.005, d / 2], { bevel: 0.002, plan: false }),
    span('trim', [-0.14, 0.14], [0.02, 0.026], [d / 2 - 0.004, d / 2 - 0.002], o),
    // Maker's badge plate top left of the front, power light on the right rail.
    span('logo', [-w / 2 + 0.025, -w / 2 + 0.085], [0.152, 0.165], [zf, zf + 0.001], o),
    sphere('trim', [w / 2 - 0.04, h - 0.006, d / 2 - 0.05], 0.0035, o),
    // Vents on the right side; power socket and USB port at the back.
    ...slats('trim', [w / 2 - 0.002, w / 2], [0.05, 0.15], [-0.07, 0.03], 8, { axis: 'z', gap: 0.5, plan: false }),
    span('trim', [w / 2 - 0.08, w / 2 - 0.05], [0.03, 0.055], [-d / 2, -d / 2 + 0.002], o),
    span('trim', [w / 2 - 0.12, w / 2 - 0.108], [0.04, 0.05], [-d / 2, -d / 2 + 0.002], o),
  ];
  for (const x of [-w / 2 + 0.035, w / 2 - 0.035]) {
    for (const z of [-d / 2 + 0.035, zf - 0.03]) parts.push(vcyl('trim', x, z, 0, 0.0065, 0.01, { segments: 12, plan: false }));
  }
  return parts;
}

const canonLbp2900 = defineItem({
  id: 'canon-lbp2900',
  name: 'Canon LBP2900 laser printer',
  category: 'office',
  type: 'electronics',
  group: 'Computers',
  tags: [...TAGS, 'printer', 'laser printer', 'máy in', 'máy in laser', 'canon', 'lbp2900', 'imageclass', 'office'],
  description: 'Compact ivory Canon mono laser printer with the face-down output tray sunk into its top, a fold-down front paper cover and a small power light on the right rail.',
  ...fixed(0.37, 0.251, 0.217),
  // Sits on a desk top by default.
  defaultElevation: 0.75,
  wallSnap: true,
  slots: [
    matSlot('body', 'Body', 'bt-ivory'),
    matSlot('trim', 'Trim, grip & vents', 'bt-dark-grey'),
    matSlot('paper', 'Paper', 'solid-white'),
    matSlot('logo', 'Badge', 'plastic-red'),
  ],
  build: lbp2900,
  planDetail: ({ d }) => [rectPoly(-0.13, -d / 2 + 0.07, 0.13, d / 2 - 0.02)],
  brand: brand('Canon', 'LBP2900', 'imageCLASS', 'https://www.anphatpc.com.vn/may-in-laser-canon-lbp-2900_id3977.html', [
    ['Size (W × D × H)', '370 × 251 × 217 mm'],
    ['Weight', '≈ 5.7 kg (without cartridge)'],
    ['Print speed', '12 pages/min (A4), mono laser'],
    ['Resolution', '600 × 600 dpi (2400 × 600 enhanced)'],
    ['Paper input', '150 sheets + 1-sheet manual feed'],
  ]),
});

// ---------------------------------------------------------------------------
// Samsung Essential S3 S24C310 — 24" office monitor
// ---------------------------------------------------------------------------

/**
 * Borderless-on-three-sides 24" panel with a slightly thicker chin, a rounded rear housing, a
 * slim neck leaning up from a flat rounded base (tilt only).
 */
function s24c310({ w, d, h }: Size3): Part[] {
  const panelH = 0.3228;
  const y0 = h - panelH;
  const zf = d / 2 - 0.07; // screen front
  const chin = 0.018;
  const top: V3 = [0, y0 + 0.13, zf - 0.044];
  const bot: V3 = [0, 0.012, -0.045];
  const dy = top[1] - bot[1];
  const dz = top[2] - bot[2];
  const L = Math.hypot(dy, dz);
  return [
    // Panel: housing slab, glass with the thin black border, chin with the badge.
    span('body', [-w / 2, w / 2], [y0, h], [zf - 0.012, zf - 0.002], { bevel: 0.002 }),
    span('screen', [-w / 2 + 0.001, w / 2 - 0.001], [y0 + chin, h - 0.001], [zf - 0.002, zf], o),
    span('body', [-w / 2 + 0.001, w / 2 - 0.001], [y0 + 0.001, y0 + chin], [zf - 0.002, zf - 0.001], o),
    span('trim', [-0.018, 0.018], [y0 + 0.006, y0 + 0.011], [zf - 0.001, zf], o),
    sphere('trim', [w / 2 - 0.03, y0 + 0.001, zf - 0.006], 0.0018, o),
    // Rear housing with the joystick button under it, and the neck mount.
    span('body', [-w * 0.33, w * 0.33], [y0 + 0.03, y0 + 0.24], [zf - 0.0412, zf - 0.012], { bevel: 0.012, plan: false }),
    span('trim', [-0.006, 0.006], [y0 + 0.024, y0 + 0.031], [zf - 0.03, zf - 0.02], o),
    span('body', [-0.03, 0.03], [y0 + 0.1, y0 + 0.16], [zf - 0.048, zf - 0.035], { bevel: 0.006, plan: false }),
    // Neck: a flat bar leaning forward from the back of the base up to the mount.
    box('body', [0, (top[1] + bot[1]) / 2, (top[2] + bot[2]) / 2], [0.045, L, 0.016], { rotation: [Math.atan2(dz, dy), 0, 0], bevel: 0.005, plan: false }),
    // Flat rounded base.
    prism('body', roundRectPoints(0, 0, 0.23, d, 0.06, 6), 0, 0.012),
  ];
}

const samsungS24c310 = defineItem({
  id: 'samsung-s24c310',
  name: 'Samsung S24C310 24" monitor',
  category: 'electronics',
  type: 'electronics',
  group: 'Computers',
  tags: [...TAGS, 'monitor', 'screen', 'display', 'computer', 'desktop', 'màn hình', 'màn hình máy tính', 'samsung', 's24c310', 'essential s3', '24 inch'],
  description: 'Black Samsung Essential S3 24" IPS monitor, borderless on three sides with a slim chin, on a slim forward-leaning neck and flat rounded base.',
  ...fixed(0.5395, 0.2174, 0.4228),
  // Sits on a desk top by default.
  defaultElevation: 0.75,
  slots: [matSlot('screen', 'Screen', 'screen-black'), matSlot('body', 'Housing & stand', 'plastic-black'), matSlot('trim', 'Badge & button', 'bt-dark-grey')],
  build: s24c310,
  planDetail: ({ w, d }) => [line([-w / 2, d / 2 - 0.07], [w / 2, d / 2 - 0.07])],
  brand: brand('Samsung', 'LS24C310EAEXXV', 'Essential S3 (S31C)', 'https://hacom.vn/man-hinh-samsung-ls24c310eaexxv', [
    ['Size with stand (W × H × D)', '539.5 × 422.8 × 217.4 mm'],
    ['Size without stand', '539.5 × 322.8 × 41.2 mm'],
    ['Weight', '2.8 kg with stand'],
    ['Panel', '24" IPS, FHD 1920 × 1080, 75 Hz'],
    ['Inputs', 'HDMI 1.4, D-Sub'],
  ]),
});

// ---------------------------------------------------------------------------
// Sony PlayStation 5 Slim — lying flat on its horizontal feet
// ---------------------------------------------------------------------------

/**
 * PS5 Slim lying flat: white top and bottom covers, each split into a glossy end and a matte main
 * section, sandwiching the black core with its light strip; disc slot in the lower cover, power and
 * eject buttons on the core, small feet underneath.
 */
function ps5Slim({ w, d, h }: Size3): Part[] {
  const xg = -w / 2 + 0.078; // end of the glossy section
  const zc = d / 2 - 0.008; // core front
  const parts: Part[] = [
    // Black core between the covers.
    span('trim', [-w / 2 + 0.006, w / 2 - 0.006], [0.038, 0.06], [-d / 2 + 0.006, zc], { bevel: 0.004 }),
    span('led', [-w / 2 + 0.012, w / 2 - 0.012], [0.0485, 0.0505], [zc, zc + 0.001], o),
    // Power and eject buttons on the core, disc slot in the lower cover.
    span('gloss', [w / 2 - 0.06, w / 2 - 0.05], [0.041, 0.047], [zc, zc + 0.002], o),
    span('gloss', [w / 2 - 0.04, w / 2 - 0.03], [0.041, 0.047], [zc, zc + 0.002], o),
    span('trim', [w / 2 - 0.17, w / 2 - 0.05], [0.02, 0.024], [d / 2 - 0.004, d / 2], o),
  ];
  for (const [y0, y1] of [
    [0.004, 0.04],
    [0.058, h],
  ] as V2[]) {
    parts.push(
      span('gloss', [-w / 2, xg], [y0, y1], [-d / 2 + 0.002, d / 2 - 0.002], { bevel: 0.01 }),
      span('body', [xg + 0.002, w / 2], [y0, y1], [-d / 2 + 0.002, d / 2 - 0.002], { bevel: 0.01 }),
      // Seam between the glossy and the matte section.
      span('trim', [xg, xg + 0.002], [y0 + 0.002, y1 - 0.002], [-d / 2 + 0.004, d / 2 - 0.004], o),
    );
  }
  for (const x of [-w / 2 + 0.05, w / 2 - 0.05]) {
    for (const z of [-d / 2 + 0.04, d / 2 - 0.04]) parts.push(vcyl('trim', x, z, 0, 0.0045, 0.008, { segments: 12, plan: false }));
  }
  return parts;
}

const ps5 = defineItem({
  id: 'sony-ps5-slim',
  name: 'Sony PlayStation 5 Slim',
  category: 'electronics',
  type: 'electronics',
  group: 'Gaming',
  tags: [...TAGS, 'console', 'games', 'gaming', 'playstation', 'ps5', 'ps5 slim', 'sony', 'máy chơi game', 'máy ps5'],
  description: 'Sony PS5 Slim lying flat: white covers with a glossy end section around the black core and its light strip, the disc slot in the lower cover.',
  ...fixed(0.358, 0.216, 0.096),
  // Sits on a media unit by default.
  defaultElevation: 0.5,
  wallSnap: true,
  slots: [
    matSlot('body', 'Covers', 'bt-ps-matte'),
    matSlot('gloss', 'Glossy covers & buttons', 'bt-ps-gloss'),
    matSlot('trim', 'Core & feet', 'bt-ps-black'),
    matSlot('led', 'Light strip', 'bt-ps-light'),
  ],
  variants: finishes(
    ['midnight-black', 'Midnight Black covers', { body: 'bt-ps-black-matte', gloss: 'bt-ps-black-gloss' }],
    ['volcanic-red', 'Volcanic Red covers', { body: 'bt-ps-red-matte', gloss: 'bt-ps-red-gloss' }],
    ['cobalt-blue', 'Cobalt Blue covers', { body: 'bt-ps-blue-matte', gloss: 'bt-ps-blue-gloss' }],
  ),
  build: ps5Slim,
  planDetail: ({ w, d }) => [line([-w / 2 + 0.079, -d / 2], [-w / 2 + 0.079, d / 2])],
  brand: brand('Sony', 'CFI-2018A', 'PlayStation 5 Slim (disc edition)', 'https://gearvn.com/products/may-choi-game-sony-playstation-5-slim-cfi-2018a-01', [
    ['Size (W × H × D)', '358 × 96 × 216 mm (excluding projecting parts)'],
    ['Weight', '≈ 3.2 kg'],
    ['Storage', '1 TB SSD'],
    ['Drive', 'Detachable Ultra HD Blu-ray disc drive'],
  ]),
});

// ---------------------------------------------------------------------------
// Epson EB-E01 — classroom and meeting-room projector, hung from the ceiling
// ---------------------------------------------------------------------------

/**
 * White Epson 3LCD projector hung upside down under a spider bracket on a short drop pole: lens
 * with focus ring towards one side of the front, exhaust grille on the other, the control panel and
 * lens-cover lever facing down, ports at the back.
 */
function ebE01({ w, d, h }: Size3): Part[] {
  const yb = 0.004; // underside (the projector's top, upside down)
  const yt = 0.081; // top (the projector's base)
  const zf = d / 2 - 0.014; // body front; the lens barrel stands proud
  const lx = 0.075;
  const ly = 0.045;
  const pole0 = 0.1;
  const plate = h - 0.008;
  const parts: Part[] = [
    span('body', [-w / 2 + 0.002, w / 2 - 0.002], [yb, yt], [-d / 2 + 0.002, zf], { bevel: 0.014 }),
    // Lens: recessed ring, barrel, focus ring and glass.
    torus('body', [lx, ly, zf - 0.001], 0.034, 0.004, o),
    discZ('trim', [lx, ly, zf + 0.0065], 0.03, 0.013, { segments: 32, plan: false }),
    torus('trim', [lx, ly, zf + 0.008], 0.031, 0.003, o),
    discZ('lens', [lx, ly, d / 2 - 0.0005], 0.022, 0.001, { segments: 32, plan: false }),
    // Exhaust grille and IR receiver on the front.
    ...slats('trim', [-w / 2 + 0.03, -0.02], [0.02, 0.065], [zf, zf + 0.002], 12, { axis: 'x', gap: 0.5, plan: false }),
    sphere('trim', [lx - 0.06, 0.02, zf], 0.004, o),
    // Control panel and lens-cover lever, facing down now.
    span('trim', [-0.12, -0.04], [yb - 0.0015, yb], [-0.09, -0.05], o),
    span('trim', [lx - 0.015, lx + 0.015], [yb - 0.0015, yb], [zf - 0.035, zf - 0.02], o),
    // Ports at the back: power, VGA, HDMI, USB.
    span('trim', [w / 2 - 0.05, w / 2 - 0.02], [0.03, 0.055], [-d / 2, -d / 2 + 0.002], o),
    span('trim', [-0.06, -0.025], [0.03, 0.045], [-d / 2, -d / 2 + 0.002], o),
    span('trim', [-0.015, 0.002], [0.032, 0.039], [-d / 2, -d / 2 + 0.002], o),
    span('trim', [0.012, 0.024], [0.032, 0.038], [-d / 2, -d / 2 + 0.002], o),
    // Bracket: ceiling plate, telescopic drop pole with a locking collar, spider hub and arms.
    span('mount', [-0.06, 0.06], [plate, h], [-0.06, 0.06], { bevel: 0.002, plan: false }),
    vcyl('mount', 0, 0, pole0, 0.2, 0.013, { segments: 16, plan: false }),
    vcyl('mount', 0, 0, 0.19, plate, 0.017, { segments: 16, plan: false }),
    vcyl('mount', 0, 0, 0.175, 0.2, 0.021, { segments: 16, plan: false }),
    rodX('mount', 0.021, 0.04, 0.188, 0, 0.004, o),
    cyl('mount', [0, pole0, 0], 0.035, 0.012, { segments: 20, plan: false }),
  ];
  for (const [x, z] of [
    [-0.07, -0.06],
    [0.07, -0.06],
    [-0.07, 0.06],
    [0.07, 0.06],
  ] as V2[]) {
    parts.push(rod('mount', [x * 0.4, pole0, z * 0.4], [x, yt + 0.002, z], 0.005, o), cyl('mount', [x, yt + 0.002, z], 0.011, 0.004, { segments: 12, plan: false }));
  }
  // The projector's own feet, now on top.
  for (const [x, z] of [
    [-0.11, zf - 0.03],
    [0.11, zf - 0.03],
    [0, -d / 2 + 0.03],
  ] as V2[]) {
    parts.push(vcyl('trim', x, z, yt - 0.002, yt + 0.0015, 0.009, { segments: 12, plan: false }));
  }
  return parts;
}

const epsonEbE01 = defineItem({
  id: 'epson-eb-e01',
  name: 'Epson EB-E01 ceiling projector',
  category: 'electronics',
  type: 'electronics',
  group: 'TV & audio',
  tags: [...TAGS, 'projector', 'ceiling mount', 'beamer', 'máy chiếu', 'máy chiếu epson', 'treo trần', 'epson', 'eb-e01', 'meeting room'],
  description: 'White Epson EB-E01 3LCD projector hung upside down under a black spider bracket on a short drop pole, its lens and focus ring to one side of the front and the exhaust grille to the other.',
  ...fixed(0.302, 0.234, 0.3),
  mount: 'ceiling',
  defaultElevation: 2.4,
  slots: [
    matSlot('body', 'Body', 'bt-epson-white'),
    matSlot('trim', 'Lens barrel, grille & ports', 'bt-dark-grey'),
    matSlot('lens', 'Lens', 'glass-tinted'),
    matSlot('mount', 'Ceiling bracket', 'metal-black-matte'),
  ],
  build: ebE01,
  planDetail: ({ d }) => [rectPoly(0.045, d / 2 - 0.014, 0.105, d / 2)],
  brand: brand('Epson', 'EB-E01', 'EB business projectors', 'https://www.anphatpc.com.vn/may-chieu-epson-eb-e01.html', [
    ['Projector size (W × D × H)', '302 × 234 × 77 mm; shown on a 220 mm drop bracket'],
    ['Weight', '≈ 2.4 kg'],
    ['Brightness', '3,300 ANSI lumens, XGA 1024 × 768'],
    ['Contrast', '15,000:1'],
    ['Lamp life', '12,000 h (Eco)'],
  ]),
});

// ---------------------------------------------------------------------------
// Dell Vostro 3020 MT — the everyday office desktop
// ---------------------------------------------------------------------------

/**
 * Black mini-tower: steel case on four feet, a plastic front bezel with a louvred intake below,
 * slim optical drive slot, ports and the power button with its light ring up top, a round badge
 * plate, vents on the side and the power supply and I/O at the back.
 */
function vostro3020({ w, d, h }: Size3): Part[] {
  const zb = d / 2 - 0.016; // back of the bezel
  const zf = d / 2 - 0.002; // bezel front
  const parts: Part[] = [
    span('case', [-w / 2 + 0.002, w / 2 - 0.002], [0.012, h - 0.002], [-d / 2 + 0.002, zb], { bevel: 0.004 }),
    span('front', [-w / 2, w / 2], [0.008, h], [zb, zf], { bevel: 0.006, plan: false }),
    // Louvred intake on the lower front.
    ...slats('detail', [-w / 2 + 0.025, w / 2 - 0.025], [0.03, 0.17], [zf, d / 2], 14, { axis: 'y', gap: 0.6, plan: false }),
    // Slim optical drive with its eject button.
    span('detail', [-w / 2 + 0.015, w / 2 - 0.035], [h - 0.058, h - 0.048], [zf, d / 2], o),
    span('detail', [w / 2 - 0.028, w / 2 - 0.018], [h - 0.056, h - 0.05], [zf, d / 2], o),
    // Power button and its light ring.
    discZ('front', [w / 2 - 0.022, h - 0.024, zf + 0.001], 0.008, 0.002, { segments: 20, plan: false }),
    torus('led', [w / 2 - 0.022, h - 0.024, zf + 0.001], 0.0095, 0.0012, o),
    // Audio jack and USB ports.
    discZ('detail', [-w / 2 + 0.022, h - 0.024, zf + 0.0005], 0.0035, 0.001, { segments: 12, plan: false }),
    // Badge plate in the middle of the front.
    discZ('detail', [0, 0.205, zf + 0.0005], 0.013, 0.001, { segments: 28, plan: false }),
  ];
  for (const i of range(4)) {
    const x = -w / 2 + 0.038 + i * 0.018;
    parts.push(span('detail', [x, x + 0.013], [h - 0.028, h - 0.022], [zf, d / 2], o));
  }
  // Side vents near the back, power supply and I/O panel at the back.
  parts.push(
    ...slats('detail', [-w / 2, -w / 2 + 0.002], [0.05, 0.28], [-d / 2 + 0.02, -d / 2 + 0.07], 10, { axis: 'y', gap: 0.5, plan: false }),
    span('detail', [-w / 2 + 0.01, w / 2 - 0.01], [0.02, 0.105], [-d / 2, -d / 2 + 0.002], o),
    span('detail', [-w / 2 + 0.015, -w / 2 + 0.075], [0.19, h - 0.02], [-d / 2, -d / 2 + 0.002], o),
    ...slats('detail', [w / 2 - 0.06, w / 2 - 0.015], [0.12, 0.18], [-d / 2, -d / 2 + 0.002], 4, { axis: 'y', gap: 0.5, plan: false }),
  );
  for (const x of [-w / 2 + 0.02, w / 2 - 0.02]) {
    for (const z of [-d / 2 + 0.03, d / 2 - 0.04]) parts.push(vcyl('detail', x, z, 0, 0.012, 0.01, { segments: 12, plan: false }));
  }
  return parts;
}

const dellVostro3020 = defineItem({
  id: 'dell-vostro-3020-mt',
  name: 'Dell Vostro 3020 MT desktop PC',
  category: 'electronics',
  type: 'electronics',
  group: 'Computers',
  tags: [...TAGS, 'computer', 'pc', 'desktop', 'tower', 'case', 'máy tính để bàn', 'case máy tính', 'dell', 'vostro', 'vostro 3020', 'office pc'],
  description: 'Black Dell Vostro 3020 mini-tower office PC: a matte steel case with a plastic front bezel, louvred lower intake, slim optical drive slot, front ports and a power button with a light ring.',
  ...fixed(0.154, 0.292, 0.3243),
  wallSnap: true,
  slots: [
    matSlot('case', 'Case', 'metal-black-matte'),
    matSlot('front', 'Front bezel', 'plastic-black'),
    matSlot('detail', 'Vents, ports & feet', 'bt-dark-grey'),
    matSlot('led', 'Power light', 'screen-glow'),
  ],
  build: vostro3020,
  planDetail: ({ w, d }) => [line([-w / 2, d / 2 - 0.016], [w / 2, d / 2 - 0.016])],
  brand: brand('Dell', 'Vostro 3020 MT', 'Vostro 3000', 'https://hacom.vn/pc-dell-vostro-3020-i7-13700-8gb-ram-512gb-ssd-wl-bt-k-m-win11-mti72062w1-8g-512g', [
    ['Size (W × D × H)', '154 × 292 × 324.3 mm'],
    ['Weight', '≈ 7.5 kg'],
    ['Processor', '13th-gen Intel Core i3 / i5 / i7'],
    ['Power supply', '180 W'],
  ]),
});

// ---------------------------------------------------------------------------
// Sihoo M57 — the ergonomic mesh chair sold everywhere in Vietnam
// ---------------------------------------------------------------------------

/** Five-star base: tapered legs on twin-wheel castors, hub, gas-lift shroud and piston. */
function starBase(slot: string, R: number, topY: number): Part[] {
  const parts: Part[] = [];
  for (const k of range(5)) {
    const a = Math.PI / 2 + (k * 2 * Math.PI) / 5;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const L = R - 0.03;
    parts.push(box(slot, [(L / 2 + 0.02) * c, 0.085, (L / 2 + 0.02) * s], [L, 0.03, 0.045], { rotation: [0, -a, 0], bevel: 0.008 }));
    parts.push(box(slot, [(R - 0.01) * c, 0.078, (R - 0.01) * s], [0.04, 0.022, 0.04], { rotation: [0, -a, 0], bevel: 0.006, plan: false }));
    const tx = -s * 0.016;
    const tz = c * 0.016;
    parts.push(rod(slot, [R * c - tx, 0.026, R * s - tz], [R * c + tx, 0.026, R * s + tz], 0.025, { segments: 16, plan: false }));
    parts.push(span(slot, [R * c - 0.014, R * c + 0.014], [0.04, 0.066], [R * s - 0.014, R * s + 0.014], { bevel: 0.004, plan: false }));
  }
  parts.push(cyl(slot, [0, 0.088, 0], 0.05, 0.04, { rTop: 0.038, segments: 24, plan: false }));
  const shroudTop = 0.11 + (topY - 0.11) * 0.55;
  parts.push(vcyl(slot, 0, 0, 0.1, shroudTop, 0.028, { segments: 20, plan: false }));
  parts.push(vcyl('pads', 0, 0, shroudTop, topY, 0.015, { segments: 16, plan: false }));
  return parts;
}

function sihooM57({ h }: Size3): Part[] {
  const seatY = 0.46;
  const zs0 = -0.17;
  const zs1 = 0.29;
  const sx = 0.255;
  const parts: Part[] = [
    ...starBase('frame', 0.29, 0.34),
    // Synchro-tilt mechanism with the height and tilt levers.
    span('frame', [-0.1, 0.1], [0.33, 0.37], [-0.12, 0.12], { bevel: 0.008, plan: false }),
    rodX('frame', 0.1, 0.17, 0.35, 0.07, 0.005, o),
    sphere('frame', [0.175, 0.35, 0.07], 0.011, o),
    rod('frame', [-0.08, 0.355, 0.1], [-0.08, 0.34, 0.17], 0.006, o),
    // Seat: solid pan, a rim, the stretched mesh and the rolled front edge.
    span('frame', [-sx, sx], [0.385, 0.42], [zs0, zs1], { bevel: 0.012 }),
    span('frame', [-sx, sx], [0.42, seatY], [zs1 - 0.025, zs1], { bevel: 0.01, plan: false }),
    span('frame', [-sx, sx], [0.42, seatY], [zs0, zs0 + 0.025], { bevel: 0.01, plan: false }),
    span('frame', [-sx, -sx + 0.025], [0.42, seatY], [zs0 + 0.025, zs1 - 0.025], { bevel: 0.008, plan: false }),
    span('frame', [sx - 0.025, sx], [0.42, seatY], [zs0 + 0.025, zs1 - 0.025], { bevel: 0.008, plan: false }),
    span('mesh', [-sx + 0.023, sx - 0.023], [0.447, 0.451], [zs0 + 0.023, zs1 - 0.023], o),
    rodX('frame', -sx + 0.02, sx - 0.02, seatY - 0.022, zs1 - 0.008, 0.024, { segments: 16, plan: false }),
  ];
  // Back built in its own frame, leaning back from a hinge at the rear of the seat.
  const tau = 0.14;
  const c = Math.cos(tau);
  const s = Math.sin(tau);
  const hy = 0.47;
  const hz = -0.17;
  const P = (x: number, u: number, v: number): V3 => [x, hy + u * c + v * s, hz - u * s + v * c];
  const tb = (slot: string, x: V2, u: V2, v: V2, bevel: number): Part =>
    box(slot, P((x[0] + x[1]) / 2, (u[0] + u[1]) / 2, (v[0] + v[1]) / 2), [x[1] - x[0], u[1] - u[0], v[1] - v[0]], { rotation: [-tau, 0, 0], bevel, plan: false });
  const bw = 0.235;
  const u0 = 0.1;
  const u1 = 0.5;
  // S-shaped spine from the mechanism round to the back frame.
  const spineTop = P(0, 0.15, -0.045);
  parts.push(
    rod('frame', [0, 0.36, -0.1], [0, 0.4, -0.225], 0.02, { segments: 12, plan: false }),
    rod('frame', [0, 0.4, -0.225], spineTop, 0.02, { segments: 12, plan: false }),
    tb('frame', [-0.07, 0.07], [0.12, 0.2], [-0.05, -0.03], 0.01),
  );
  // Frame: side stiles, top and bottom rails, the mesh, and the lumbar pad with its knob.
  for (const side of [-1, 1]) {
    parts.push(tb('frame', side < 0 ? [-bw, -bw + 0.03] : [bw - 0.03, bw], [u0, u1], [-0.03, 0], 0.01));
  }
  parts.push(
    tb('frame', [-bw, bw], [u1 - 0.035, u1], [-0.03, 0], 0.012),
    tb('frame', [-bw + 0.02, bw - 0.02], [u0, u0 + 0.03], [-0.03, 0], 0.01),
    tb('mesh', [-bw + 0.025, bw - 0.025], [u0 + 0.025, u1 - 0.03], [-0.017, -0.013], 0),
    tb('frame', [-0.16, 0.16], [0.16, 0.25], [0.0, 0.028], 0.014),
    tb('frame', [0.165, 0.185], [0.19, 0.22], [-0.01, 0.01], 0.004),
  );
  // Headrest: a stalk up from the top rail and a curved mesh pad in a frame.
  parts.push(
    tb('frame', [-0.02, 0.02], [u1 - 0.03, 0.56], [-0.04, -0.02], 0.006),
    tb('frame', [-0.14, 0.14], [0.545, Math.min(0.63, (h - hy - 0.004) / c)], [-0.022, 0], 0.012),
    tb('mesh', [-0.125, 0.125], [0.555, 0.62], [0, 0.004], 0),
  );
  // 3D armrests: brackets under the seat, posts and PU pads.
  for (const side of [-1, 1]) {
    const ax = side * 0.27;
    const lo = Math.min(side * 0.1, ax);
    const hi = Math.max(side * 0.1, ax);
    parts.push(
      span('frame', [lo, hi], [0.365, 0.385], [-0.06, -0.005], { plan: false }),
      span('frame', [ax - 0.015, ax + 0.015], [0.365, 0.665], [-0.055, -0.01], { bevel: 0.006, plan: false }),
      span('pads', [ax - 0.04, ax + 0.04], [0.665, 0.69], [-0.14, 0.11], { bevel: 0.01 }),
    );
  }
  return parts;
}

const sihooM57Chair = defineItem({
  id: 'sihoo-m57',
  name: 'Sihoo M57 ergonomic mesh chair',
  category: 'office',
  type: 'seating',
  group: 'Desk chairs',
  tags: [...TAGS, 'chair', 'office chair', 'desk chair', 'task chair', 'swivel', 'ergonomic', 'mesh chair', 'ghế công thái học', 'ghế văn phòng', 'ghế xoay', 'sihoo', 'm57'],
  description: 'Sihoo M57 ergonomic chair: a black frame with breathable mesh back and seat, a separate lumbar pad, a 2D mesh headrest, 3D armrests with PU pads and a five-star base on castors.',
  ...fixed(0.64, 0.66, 1.1),
  slots: [matSlot('mesh', 'Mesh', 'bt-mesh-black'), matSlot('frame', 'Frame & base', 'bt-nylon-black'), matSlot('pads', 'Arm pads & gas lift', 'bt-pu-black')],
  variants: finishes(['grey', 'Grey mesh, black frame', { mesh: 'bt-mesh-grey' }]),
  build: sihooM57,
  planDetail: () =>
    range(5).map((k) => {
      const a = Math.PI / 2 + (k * 2 * Math.PI) / 5;
      return circle([0.29 * Math.cos(a), 0.29 * Math.sin(a)], 0.025);
    }),
  brand: brand('Sihoo', 'M57', 'Sihoo ergonomic', 'https://cellphones.com.vn/ghe-cong-thai-hoc-sihoo-m57.html', [
    ['Size (W × D × H)', '640 × 660 × 1100–1275 mm (shown at the lowest height)'],
    ['Seat', '510 × 460 mm, height 460–550 mm'],
    ['Weight', '18.9 kg'],
    ['Back', 'Mesh, recline to 126°, adjustable lumbar pad, 2D headrest'],
    ['Armrests', '3D, PU-covered pads'],
  ]),
});

// ---------------------------------------------------------------------------
// Hòa Phát TU4F — four-drawer steel filing cabinet (tủ hồ sơ sắt)
// ---------------------------------------------------------------------------

/**
 * Light grey powder-coated steel cabinet with four tall drawers: each front has a recessed pull with
 * a lip below and a framed label card; a central lock at the top right; a recessed plinth.
 */
function tu4f({ w, d, h }: Size3): Part[] {
  const zc = d / 2 - 0.02; // carcass front
  const zf = d / 2 - 0.003; // drawer fronts
  const plinth = 0.04;
  const parts: Part[] = [
    span('body', [-w / 2, w / 2], [plinth, h], [-d / 2, zc], { bevel: 0.003 }),
    span('recess', [-w / 2 + 0.02, w / 2 - 0.02], [0, plinth], [-d / 2 + 0.02, zc - 0.04], o),
    // Central lock in the top rail, with its key slot.
    discZ('trim', [w / 2 - 0.06, h - 0.0175, zc + 0.005], 0.009, 0.01, { segments: 20, plan: false }),
    span('recess', [w / 2 - 0.061, w / 2 - 0.059], [h - 0.023, h - 0.012], [zc + 0.01, zc + 0.011], o),
  ];
  for (const [y0, y1] of cellSpans(4, plinth + 0.005, h - 0.035)) {
    parts.push(
      span('body', [-w / 2 + 0.005, w / 2 - 0.005], [y0 + 0.002, y1 - 0.002], [zc, zf], { bevel: 0.003, plan: false }),
      // Recessed pull: the dark finger slot and the lip under it.
      span('recess', [-0.13, 0.13], [y1 - 0.05, y1 - 0.03], [zf, zf + 0.001], o),
      span('body', [-0.135, 0.135], [y1 - 0.056, y1 - 0.05], [zf, d / 2], { bevel: 0.002, plan: false }),
    );
    const ly = y1 - 0.095;
    parts.push(...frame4('trim', [-0.05, 0.05], [ly - 0.016, ly + 0.016], [zf, d / 2 - 0.0005], 0.004, o));
    parts.push(span('label', [-0.046, 0.046], [ly - 0.012, ly + 0.012], [zf, zf + 0.0015], o));
  }
  return parts;
}

const hoaPhatTu4f = defineItem({
  id: 'hoa-phat-tu4f',
  name: 'Hòa Phát TU4F steel filing cabinet',
  category: 'office',
  type: 'storage',
  group: 'Office storage',
  tags: [...TAGS, 'filing', 'cabinet', 'drawers', 'archive', 'office storage', 'tủ hồ sơ', 'tủ sắt', 'tủ hồ sơ sắt', 'tủ 4 ngăn kéo', 'hòa phát', 'hoa phat', 'tu4f'],
  description: 'Light grey powder-coated steel Hòa Phát filing cabinet with four full-extension drawers, recessed pulls with framed label cards and one central lock.',
  ...fixed(0.47, 0.62, 1.28),
  wallSnap: true,
  slots: [
    matSlot('body', 'Steel body', 'bt-hp-grey'),
    matSlot('recess', 'Pull recesses & plinth', 'bt-dark-grey'),
    matSlot('trim', 'Lock & label frames', 'metal-chrome'),
    matSlot('label', 'Labels', 'solid-white'),
  ],
  build: tu4f,
  planDetail: ({ w, d }) => [line([-w / 2, d / 2 - 0.02], [w / 2, d / 2 - 0.02])],
  brand: brand('Hòa Phát', 'TU4F', 'Nội thất Hòa Phát', 'https://www.tatmart.com/en/tu-sat-dung-file-4-ngan-keo-hoa-phat-tu4f.html', [
    ['Size (W × D × H)', '470 × 620 × 1280 mm'],
    ['Material', 'Powder-coated steel, light grey'],
    ['Drawers', '4, ball-bearing full-extension slides'],
    ['Lock', 'Central lock for all four drawers'],
  ]),
});

// ---------------------------------------------------------------------------
// Pack materials
// ---------------------------------------------------------------------------

const patterns: PackPattern[] = [
  {
    id: 'bt-mesh',
    name: 'Chair mesh',
    cutout: true,
    normalStrength: 0.5,
    // A fine see-through grid of woven threads.
    draw(ctx, size) {
      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = '#ffffff';
      const n = 16;
      const step = size / n;
      const t = Math.max(2, Math.round(step * 0.4));
      for (let i = 0; i < n; i++) {
        ctx.fillRect(Math.round(i * step), 0, t, size);
        ctx.fillRect(0, Math.round(i * step), size, t);
      }
    },
  },
];

const mesh = (id: string, name: string, color: string): PackMaterial => ({ id, name, category: 'fabric', color, roughness: 0.8, pattern: { id: 'bt-mesh', scale: 0.03, contrast: 1 } });
const plastic = (id: string, name: string, color: string, roughness: number): PackMaterial => ({ id, name, category: 'solid', color, roughness });

const materials: PackMaterial[] = [
  plastic('bt-ivory', 'Ivory printer plastic', '#ebe7dc', 0.5),
  plastic('bt-dark-grey', 'Dark grey plastic', '#3b3d41', 0.5),
  plastic('bt-epson-white', 'Projector white plastic', '#f1f1ee', 0.45),
  plastic('bt-ps-matte', 'Console matte white', '#efefed', 0.5),
  plastic('bt-ps-gloss', 'Console gloss white', '#f8f8f6', 0.12),
  plastic('bt-ps-black', 'Console gloss black', '#15161a', 0.18),
  plastic('bt-ps-black-matte', 'Midnight Black matte', '#1c1d24', 0.5),
  plastic('bt-ps-black-gloss', 'Midnight Black gloss', '#1a1b22', 0.14),
  plastic('bt-ps-red-matte', 'Volcanic Red matte', '#9c1f24', 0.5),
  plastic('bt-ps-red-gloss', 'Volcanic Red gloss', '#a3242a', 0.14),
  plastic('bt-ps-blue-matte', 'Cobalt Blue matte', '#2a4fa8', 0.5),
  plastic('bt-ps-blue-gloss', 'Cobalt Blue gloss', '#2f56b2', 0.14),
  { id: 'bt-ps-light', name: 'Console light strip', category: 'solid', color: '#cfe0ff', roughness: 0.3, emissive: '#6f9cff', emissiveIntensity: 0.9 },
  plastic('bt-nylon-black', 'Black nylon', '#1f2023', 0.5),
  { id: 'bt-pu-black', name: 'Black PU leather', category: 'leather', color: '#1c1c1e', roughness: 0.42 },
  mesh('bt-mesh-black', 'Black chair mesh', '#2a2b2e'),
  mesh('bt-mesh-grey', 'Grey chair mesh', '#9a9ca0'),
  { id: 'bt-hp-grey', name: 'Light grey powder-coated steel', category: 'metal', color: '#c8cac7', roughness: 0.55, metalness: 0.2 },
];

export default definePack({
  name: 'Branded tech & office (Vietnam)',
  version: '1.0.0',
  author: 'Neest team',
  description:
    'Office and home tech that Vietnam buys, at the published sizes: Canon LBP2900 printer, Samsung S24C310 monitor, PS5 Slim, Epson EB-E01 ceiling projector, Dell Vostro 3020 tower, Sihoo M57 chair and Hòa Phát TU4F filing cabinet.',
  license: 'CC0 (made for Neest)',
  items: [canonLbp2900, samsungS24c310, ps5, epsonEbE01, dellVostro3020, sihooM57Chair, hoaPhatTu4f],
  patterns,
  materials,
});

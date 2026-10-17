/**
 * Branded TVs — six real televisions from Samsung, LG and Sony, built to their published dimensions.
 *
 * On their own stands (placed at 50 cm, the height of a typical TV unit): Samsung S95D 65″ OLED on a
 * pedestal, LG C4 65″ OLED on a pedestal, Sony BRAVIA 8 55″ OLED and BRAVIA 9 75″ Mini LED on blade
 * feet. Wall-mounted flush: Samsung The Frame 55″ in Art Mode and LG G4 77″ OLED.
 *
 * Each item carries `brand` metadata (model, line, published specs and their source). Screens show a
 * picture (the pack's own patterns) so the sets read in thumbnails; pick "Screen glass" for a TV that
 * is off. The shapes are original procedural approximations: no logos or trademark artwork are drawn.
 * Sizes are fixed products, so nothing resizes.
 */
import {
  defineItem,
  definePack,
  line,
  matSlot,
  prism,
  rectPoly,
  rod,
  roundRectPoints,
  span,
  type AssetBrand,
  type PackPattern,
  type Part,
  type Size3,
} from '@/packs/kit';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Detail parts: hidden from the 2D plan. */
const o = { plan: false };

const TAGS = ['tv', 'television', 'tivi', 'screen', 'smart tv', 'electronics'];

/** Fixed product: nothing resizes. */
function fixed(w: number, d: number, h: number) {
  const s: Size3 = { w, d, h };
  return { defaultSize: s, minSize: s, maxSize: s, resizable: { w: false, d: false, h: false } };
}

const brand = (name: string, model: string, line: string, url: string, specs: [string, string][]): AssetBrand => ({
  name,
  model,
  line,
  url,
  specs,
});

interface PanelSpec {
  /** Panel height without the stand. */
  panelH: number;
  /** Thickness of the slim (upper) part of the panel. */
  thin: number;
  /** Deepest point of the panel, including the rear electronics housing. */
  back: number;
  /** Black border around the picture. */
  bezel: number;
  /** Logo/status strip under the picture: 'chin' adds a strip, 'edge' keeps the border even. */
  logo: 'chin' | 'edge';
}

/**
 * Flat panel with its front at zF and its bottom edge at y0: a black glass front with the picture,
 * the slim panel body, a rear electronics housing low down, and a small status light.
 * Slots: screen (picture), body (border and back), trim (status light & logo strip).
 */
function panel(w: number, y0: number, zF: number, p: PanelSpec): Part[] {
  const y1 = y0 + p.panelH;
  const chin = p.logo === 'chin' ? 0.006 : 0;
  const parts: Part[] = [
    span('body', [-w / 2, w / 2], [y0, y1], [zF - p.thin, zF - 0.0008], { bevel: Math.min(0.002, p.thin * 0.3) }),
    span('screen', [-w / 2 + p.bezel, w / 2 - p.bezel], [y0 + p.bezel + chin, y1 - p.bezel], [zF - 0.0008, zF], o),
    // Status light at the bottom edge, right of centre.
    span('trim', [0.05, 0.058], [y0 + 0.0015, y0 + 0.003], [zF - 0.0012, zF + 0.0004], o),
  ];
  if (chin > 0) parts.push(span('trim', [-0.03, 0.03], [y0 + p.bezel * 0.5, y0 + p.bezel * 0.5 + 0.003], [zF - 0.0008, zF + 0.0004], o));
  if (p.back > p.thin + 0.002) {
    // Rear housing: the electronics and speakers sit in the lower part of the back.
    const hy = y0 + p.panelH * 0.58;
    parts.push(
      span('body', [-w * 0.4, w * 0.4], [y0 + 0.02, hy], [zF - p.back, zF - p.thin], { bevel: Math.min(0.008, (p.back - p.thin) * 0.4), plan: false }),
      // Vent band and connection panel on the housing.
      span('trim', [-w * 0.3, w * 0.3], [hy - 0.05, hy - 0.035], [zF - p.back - 0.001, zF - p.back + 0.002], o),
      span('trim', [w * 0.2, w * 0.36], [y0 + 0.08, y0 + 0.2], [zF - p.back - 0.001, zF - p.back + 0.002], o),
    );
  } else {
    // Ultra-slim panel: a flat back plate with the mount and connection area.
    parts.push(span('trim', [-w * 0.15, w * 0.15], [y0 + p.panelH * 0.25, y0 + p.panelH * 0.55], [zF - p.thin - 0.001, zF - p.thin + 0.001], o));
  }
  return parts;
}

interface PedestalSpec {
  /** Base plate width and its corner radius. */
  baseW: number;
  radius: number;
  /** Base plate thickness. */
  plate: number;
  /** Neck width. */
  neckW: number;
}

/**
 * TV on a centre pedestal: a low base plate (full item depth), a neck rising behind the panel and
 * the panel with its bottom edge at h − panelH. Slots: screen, body, trim, stand.
 */
function onPedestal({ w, d, h }: Size3, p: PanelSpec, s: PedestalSpec): Part[] {
  const y0 = h - p.panelH;
  const zF = d * 0.12;
  const zN = zF - p.back;
  return [
    ...panel(w, y0, zF, p),
    // Base plate with a slimmer top deck.
    prism('stand', roundRectPoints(0, 0, s.baseW, d, s.radius), 0, s.plate * 0.6),
    span('stand', [-s.baseW / 2 + 0.01, s.baseW / 2 - 0.01], [s.plate * 0.6, s.plate], [-d / 2 + 0.012, d / 2 - 0.012], { bevel: Math.min(0.006, s.plate * 0.2), plan: false }),
    // Neck from the base up behind the panel, with a mounting plate.
    span('stand', [-s.neckW / 2, s.neckW / 2], [s.plate, y0 + p.panelH * 0.3], [zN - 0.022, zN - 0.002], { bevel: 0.006, plan: false }),
    span('stand', [-s.neckW / 2 - 0.03, s.neckW / 2 + 0.03], [y0 + p.panelH * 0.18, y0 + p.panelH * 0.32], [zN - 0.006, zN], { bevel: 0.002, plan: false }),
  ];
}

/**
 * TV on two blade feet at ±span/2: a floor blade the full item depth, an upright behind the panel and a
 * slanted brace. Slots: screen, body, trim, stand.
 */
function onFeet({ w, d, h }: Size3, p: PanelSpec, footSpan: number): Part[] {
  const y0 = h - p.panelH;
  const zF = d * 0.18;
  const zN = zF - p.back;
  const parts: Part[] = panel(w, y0, zF, p);
  const x0 = Math.min(footSpan / 2, w / 2 - 0.012);
  for (const x of [-x0 + 0.008, x0 - 0.008]) {
    parts.push(
      span('stand', [x - 0.008, x + 0.008], [0, 0.01], [-d / 2, d / 2], { bevel: 0.003 }),
      // Front lip holding the panel's bottom edge, and the upright behind it.
      span('stand', [x - 0.008, x + 0.008], [0.004, y0 + 0.012], [zF - 0.004, zF + 0.006], { bevel: 0.002, plan: false }),
      span('stand', [x - 0.008, x + 0.008], [0.004, y0 + 0.11], [zN - 0.014, zN], { bevel: 0.003, plan: false }),
      rod('stand', [x, 0.008, -d / 2 + 0.01], [x, y0 + 0.08, zN - 0.008], 0.006, o),
    );
  }
  return parts;
}

const panelPlan = (zF: number) => ({ w }: Size3) => [line([-w / 2, zF], [w / 2, zF])];

// ---------------------------------------------------------------------------
// Screen pictures (procedural, seamless). UVs start at the centre of the screen, so the
// compositions are drawn around the tile's corner (wrapped coordinates s, t in [-0.5, 0.5)).
// ---------------------------------------------------------------------------

const wrap = (v: number) => v - Math.round(v);
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);
const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** Paints a tile pixel by pixel from (s, t) → rgb 0–1, t pointing up. */
function paint(ctx: CanvasRenderingContext2D, N: number, f: (s: number, t: number, u: number) => number[]): void {
  const img = ctx.createImageData(N, N);
  for (let j = 0; j < N; j++) {
    const t = wrap(1 - (j + 0.5) / N);
    for (let i = 0; i < N; i++) {
      const u = (i + 0.5) / N;
      const c = f(wrap(u), t, u);
      const k = (j * N + i) * 4;
      img.data[k] = Math.round(Math.min(1, Math.max(0, c[0])) * 255);
      img.data[k + 1] = Math.round(Math.min(1, Math.max(0, c[1])) * 255);
      img.data[k + 2] = Math.round(Math.min(1, Math.max(0, c[2])) * 255);
      img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

const TAU = Math.PI * 2;

/** Aurora: glowing ribbons across a deep violet night (an OLED demo wallpaper). */
const auroraPattern: PackPattern = {
  id: 'screen-aurora',
  name: 'TV picture: aurora',
  colored: true,
  normalStrength: 0,
  draw: (ctx, N) =>
    paint(ctx, N, (_s, t, u) => {
      const glow = (1 + Math.cos(TAU * t)) / 2;
      let c = mix([0.02, 0.025, 0.08], [0.16, 0.07, 0.3], glow * glow);
      const ribbons: [number, number, number, number[]][] = [
        [0.06 * Math.sin(TAU * u) + 0.03 * Math.sin(2 * TAU * u + 1.3), 0.035, 1, [0.1, 0.95, 0.78]],
        [-0.05 * Math.sin(TAU * u + 2.1) + 0.025 * Math.sin(3 * TAU * u) - 0.05, 0.028, 0.9, [1, 0.3, 0.62]],
        [0.04 * Math.sin(2 * TAU * u + 0.4) + 0.08, 0.012, 0.8, [1, 0.72, 0.32]],
      ];
      for (const [cy, sig, a, col] of ribbons) {
        const g = a * Math.exp(-(((t - cy) / sig) ** 2));
        const haze = 0.25 * a * Math.exp(-(((t - cy) / (sig * 4)) ** 2));
        c = c.map((v, i) => v + col[i] * (g + haze));
      }
      return c;
    }),
};

/** Dusk: a low sun over layered hills, warm sky. */
const duskPattern: PackPattern = {
  id: 'screen-dusk',
  name: 'TV picture: dusk',
  colored: true,
  normalStrength: 0,
  draw: (ctx, N) =>
    paint(ctx, N, (s, t, u) => {
      // Sky: deep blue at the top through rose to a gold horizon.
      const sky = t > 0.02 ? mix([0.98, 0.62, 0.36], [0.2, 0.22, 0.45], smooth(0.02, 0.3, t)) : [0.98, 0.7, 0.42];
      const r = Math.hypot(s, t - 0.03);
      let c = sky.map((v, i) => v + [1, 0.85, 0.6][i] * 0.6 * Math.exp(-((r / 0.12) ** 2)));
      if (r < 0.045) c = [1, 0.95, 0.82];
      const hills: [number, number[]][] = [
        [0.02 + 0.03 * Math.sin(TAU * u + 0.5) + 0.015 * Math.sin(3 * TAU * u), [0.55, 0.36, 0.42]],
        [-0.04 + 0.035 * Math.sin(TAU * u + 2.4) + 0.012 * Math.sin(4 * TAU * u + 1), [0.33, 0.22, 0.32]],
        [-0.11 + 0.04 * Math.sin(TAU * u + 4) + 0.01 * Math.sin(5 * TAU * u), [0.16, 0.12, 0.2]],
      ];
      for (const [hy, col] of hills) if (t < hy) c = mix(col, c, 0.12 * smooth(-0.02, 0, t - hy));
      return c;
    }),
};

/** Art Mode: a mid-century abstract print in a white mat (sized to The Frame 55″). */
const frameArtPattern: PackPattern = {
  id: 'frame-art',
  name: 'TV picture: Art Mode print',
  colored: true,
  normalStrength: 0,
  draw: (ctx, N, rand) => {
    const grain = Array.from({ length: 64 }, () => rand());
    paint(ctx, N, (s, t, u) => {
      const n = grain[Math.floor(u * 64) % 64] * 0.015;
      const ax = 0.335;
      const ay = 0.178;
      if (Math.abs(s) > ax || Math.abs(t) > ay) {
        // Mat with a soft shadow along its bevelled inner edge.
        const e = Math.max(Math.abs(s) - ax, Math.abs(t) - ay);
        const shade = e < 0.004 ? 0.86 : 0.95;
        return [shade - n, shade - 0.01 - n, shade - 0.03 - n];
      }
      let c = [0.93 - n, 0.89 - n, 0.81 - n];
      const inC = (x: number, y: number, r: number) => Math.hypot(s - x, t - y) < r;
      if (t < -0.06 && inC(0.13, -0.178, 0.17)) c = [0.55, 0.62, 0.52];
      if (inC(-0.1, 0.03, 0.105)) c = [0.78, 0.42, 0.3];
      if (inC(0.2, 0.09, 0.045)) c = [0.88, 0.68, 0.36];
      if (Math.abs(t - (-0.02 + 0.06 * Math.sin(s * 9 + 0.6))) < 0.0035 && s > -0.3 && s < 0.3) c = [0.2, 0.2, 0.22];
      if (s > -0.29 && s < -0.24 && t > -0.15 && t < 0.12) c = mix(c, [0.42, 0.52, 0.62], 0.85);
      return c;
    });
  },
};

// ---------------------------------------------------------------------------
// 1. Samsung QE65S95D — 65″ OLED S95D on its pedestal stand
// ---------------------------------------------------------------------------

const s95dPanel: PanelSpec = { panelH: 0.8294, thin: 0.011, back: 0.011, bezel: 0.004, logo: 'edge' };

const s95d = defineItem({
  id: 'samsung-qe65s95d',
  name: 'Samsung S95D 65″ OLED TV (QE65S95D)',
  category: 'electronics',
  type: 'electronics',
  group: 'TV & audio',
  tags: [...TAGS, 'samsung', 'QE65S95D', 'S95D', 'oled', 'qd-oled', '65 inch', 'pedestal'],
  ...fixed(1.4435, 0.2679, 0.8944),
  defaultElevation: 0.5,
  wallSnap: true,
  description:
    'Samsung S95D 65″ QD-OLED TV on its centre pedestal stand. The panel is only 11 mm thick because the connections live in a separate One Connect box; the glare-free screen is shown on.',
  brand: brand('Samsung', 'QE65S95D', 'S95D OLED', 'https://shs.fust.ch/pd/10791715.pdf', [
    ['Screen', '65″ QD-OLED, 4K'],
    ['Panel (W × H × D)', '1443.5 × 829.4 × 11 mm'],
    ['Weight', '18.9 kg (29 kg with stand)'],
    ['VESA', '400 × 300'],
    ['Dimensions with stand (W × H × D)', '1443.5 × 894.4 × 267.9 mm'],
  ]),
  slots: [
    matSlot('screen', 'Screen', 'screen-aurora-mat'),
    matSlot('body', 'Border & back', 'tv-graphite'),
    matSlot('stand', 'Stand', 'tv-titan-silver'),
    matSlot('trim', 'Status light & vents', 'tv-black'),
  ],
  build: (s) => onPedestal(s, s95dPanel, { baseW: 0.42, radius: 0.012, plate: 0.022, neckW: 0.1 }),
  planDetail: panelPlan(0.2679 * 0.12),
});

// ---------------------------------------------------------------------------
// 2. LG OLED65C4 — 65″ OLED evo C4 on its pedestal stand
// ---------------------------------------------------------------------------

const c4Panel: PanelSpec = { panelH: 0.826, thin: 0.0045, back: 0.0451, bezel: 0.006, logo: 'chin' };

const c4 = defineItem({
  id: 'lg-oled65c4',
  name: 'LG C4 65″ OLED evo TV (OLED65C4)',
  category: 'electronics',
  type: 'electronics',
  group: 'TV & audio',
  tags: [...TAGS, 'lg', 'OLED65C4', 'C4', 'oled', 'oled evo', '65 inch', 'pedestal'],
  ...fixed(1.441, 0.23, 0.88),
  defaultElevation: 0.5,
  wallSnap: true,
  description:
    'LG OLED evo C4 65″ TV on its curved centre pedestal. The panel is a few millimetres thin at the top with the electronics in a housing low on the back, 45 mm at its deepest.',
  brand: brand('LG', 'OLED65C4', 'OLED evo C4', 'https://www.91mobiles.com/lg-oled65c4xla-65-inches-inch-4k-oled-evo-tv-price-in-india-163830?ty=specs', [
    ['Screen', '65″ OLED evo, 4K, 144 Hz'],
    ['Panel (W × H × D)', '1441 × 826 × 45.1 mm'],
    ['Weight', '16.6 kg (18.5 kg with stand)'],
    ['VESA', '300 × 200'],
    ['Dimensions with stand (W × H × D)', '1441 × 880 × 230 mm'],
  ]),
  slots: [
    matSlot('screen', 'Screen', 'screen-dusk-mat'),
    matSlot('body', 'Border & back', 'tv-black'),
    matSlot('stand', 'Stand', 'tv-graphite'),
    matSlot('trim', 'Logo, status light & vents', 'tv-titan-silver'),
  ],
  build: (s) => onPedestal(s, c4Panel, { baseW: 0.5, radius: 0.09, plate: 0.016, neckW: 0.14 }),
  planDetail: panelPlan(0.23 * 0.12),
});

// ---------------------------------------------------------------------------
// 3. Sony K-55XR80 — BRAVIA 8 55″ OLED on blade feet
// ---------------------------------------------------------------------------

const b8Panel: PanelSpec = { panelH: 0.706, thin: 0.012, back: 0.037, bezel: 0.006, logo: 'edge' };

const bravia8 = defineItem({
  id: 'sony-k-55xr80',
  name: 'Sony BRAVIA 8 55″ OLED TV (K-55XR80)',
  category: 'electronics',
  type: 'electronics',
  group: 'TV & audio',
  tags: [...TAGS, 'sony', 'bravia', 'K-55XR80', 'bravia 8', 'oled', '55 inch', 'feet'],
  ...fixed(1.223, 0.248, 0.732),
  defaultElevation: 0.5,
  wallSnap: true,
  description:
    'Sony BRAVIA 8 55″ OLED TV on its slim blade feet in the standard (wide) position, 1075 mm apart. The feet can also sit narrow or raised for a soundbar.',
  brand: brand('Sony', 'K-55XR80', 'BRAVIA 8', 'https://sony.co.nz/bravia/products/bravia-8/spec', [
    ['Screen', '55″ OLED, 4K'],
    ['Panel (W × H × D)', '1223 × 706 × 37 mm'],
    ['Stand width', '1075 mm standard, 584 mm narrow'],
    ['Weight', '17.1 kg (18 kg with stand)'],
    ['Dimensions with stand (W × H × D)', '1223 × 732 × 248 mm (786 mm high in the soundbar position)'],
  ]),
  slots: [
    matSlot('screen', 'Screen', 'screen-aurora-mat'),
    matSlot('body', 'Border & back', 'tv-black'),
    matSlot('stand', 'Feet', 'tv-dark-silver'),
    matSlot('trim', 'Status light & vents', 'tv-graphite'),
  ],
  build: (s) => onFeet(s, b8Panel, 1.075),
  planDetail: panelPlan(0.248 * 0.18),
});

// ---------------------------------------------------------------------------
// 4. Sony K-75XR90 — BRAVIA 9 75″ Mini LED on blade feet
// ---------------------------------------------------------------------------

const b9Panel: PanelSpec = { panelH: 0.96, thin: 0.03, back: 0.048, bezel: 0.007, logo: 'edge' };

const bravia9 = defineItem({
  id: 'sony-k-75xr90',
  name: 'Sony BRAVIA 9 75″ Mini LED TV (K-75XR90)',
  category: 'electronics',
  type: 'electronics',
  group: 'TV & audio',
  tags: [...TAGS, 'sony', 'bravia', 'K-75XR90', 'bravia 9', 'mini led', 'qled', '75 inch', 'feet'],
  ...fixed(1.667, 0.397, 0.972),
  defaultElevation: 0.5,
  wallSnap: true,
  description:
    'Sony BRAVIA 9 75″ Mini LED TV on blade feet at the outer edges of the panel, so it needs a TV unit at least 1.66 m wide. A deep 48 mm panel for the backlight.',
  brand: brand('Sony', 'K-75XR90', 'BRAVIA 9', 'https://galaxus.de/en/s1/product/sony-k-75xr90paep-75-bravia-9-qled-4k-2024-tv-45058119', [
    ['Screen', '75″ Mini LED (QLED), 4K'],
    ['Panel (W × H × D)', '1667 × 960 × 48 mm'],
    ['Stand width', '1657 mm'],
    ['Weight with stand', '45 kg'],
    ['Dimensions with stand (W × H × D)', '1667 × 972 × 397 mm'],
  ]),
  slots: [
    matSlot('screen', 'Screen', 'screen-dusk-mat'),
    matSlot('body', 'Border & back', 'tv-black'),
    matSlot('stand', 'Feet', 'tv-dark-silver'),
    matSlot('trim', 'Status light & vents', 'tv-graphite'),
  ],
  build: (s) => onFeet(s, b9Panel, 1.657),
  planDetail: panelPlan(0.397 * 0.18),
});

// ---------------------------------------------------------------------------
// 5. Samsung QE55LS03D — The Frame 55″, flush on the wall in Art Mode
// ---------------------------------------------------------------------------

const frame55 = defineItem({
  id: 'samsung-qe55ls03d',
  name: 'Samsung The Frame 55″ TV (QE55LS03D)',
  category: 'electronics',
  type: 'electronics',
  group: 'TV & audio',
  tags: [...TAGS, 'samsung', 'QE55LS03D', 'the frame', 'art mode', 'qled', '55 inch', 'wall mounted', 'picture frame'],
  ...fixed(1.2379, 0.0249, 0.7088),
  mount: 'wall',
  defaultElevation: 0.85,
  description:
    'Samsung The Frame 55″ QLED TV hung flush on the wall like a picture, shown in Art Mode with a print in a white mat. The bezel is a separate frame you can change; the matte screen hides reflections.',
  brand: brand('Samsung', 'QE55LS03D', 'The Frame (2024)', 'https://ee.co.uk/help/tech/device/Samsung/2024QE55LS03DAUXXUTheFrame', [
    ['Screen', '55″ QLED, 4K, matte display'],
    ['Weight', '16.9 kg'],
    ['VESA', '200 × 200'],
    ['Stand (optional)', '897.2 × 227.8 mm, 743.4 mm high with the TV'],
    ['Dimensions (W × H × D)', '1237.9 × 708.8 × 24.9 mm'],
  ]),
  slots: [
    matSlot('screen', 'Screen', 'frame-art-mat'),
    matSlot('frame', 'Bezel', 'tv-frame-black'),
    matSlot('body', 'Back', 'tv-graphite'),
  ],
  build: ({ w, d, h }) => {
    const bz = 0.016;
    const zF = d / 2;
    return [
      // Body against the wall, the screen set 3 mm back from the bezel like a framed print.
      span('body', [-w / 2 + 0.004, w / 2 - 0.004], [0.004, h - 0.004], [-d / 2, zF - 0.006]),
      span('screen', [-w / 2 + bz, w / 2 - bz], [bz, h - bz], [zF - 0.0045, zF - 0.003], o),
      // Bezel: four bars with a small chamfer step on the inside.
      span('frame', [-w / 2, w / 2], [h - bz, h], [-d / 2 + 0.002, zF], { bevel: 0.0015, plan: false }),
      span('frame', [-w / 2, w / 2], [0, bz], [-d / 2 + 0.002, zF], { bevel: 0.0015, plan: false }),
      span('frame', [-w / 2, -w / 2 + bz], [bz, h - bz], [-d / 2 + 0.002, zF], { bevel: 0.0015, plan: false }),
      span('frame', [w / 2 - bz, w / 2], [bz, h - bz], [-d / 2 + 0.002, zF], { bevel: 0.0015, plan: false }),
      span('frame', [-w / 2 + bz, w / 2 - bz], [bz, bz + 0.003], [zF - 0.004, zF - 0.002], o),
      span('frame', [-w / 2 + bz, w / 2 - bz], [h - bz - 0.003, h - bz], [zF - 0.004, zF - 0.002], o),
    ];
  },
  planDetail: ({ w, d }) => [rectPoly(-w / 2, -d / 2, w / 2, d / 2)],
});

// ---------------------------------------------------------------------------
// 6. LG OLED77G4 — 77″ OLED evo Gallery Edition, flush on the wall
// ---------------------------------------------------------------------------

const g4 = defineItem({
  id: 'lg-oled77g4',
  name: 'LG G4 77″ OLED evo TV (OLED77G4)',
  category: 'electronics',
  type: 'electronics',
  group: 'TV & audio',
  tags: [...TAGS, 'lg', 'OLED77G4', 'G4', 'gallery', 'oled', 'oled evo', '77 inch', 'wall mounted'],
  ...fixed(1.712, 0.0248, 0.982),
  mount: 'wall',
  defaultElevation: 0.65,
  description:
    'LG OLED evo G4 77″ Gallery Edition, an evenly flat 24.8 mm panel that hangs flush on its slim wall bracket with no gap. Shown with the screen on.',
  brand: brand('LG', 'OLED77G4', 'OLED evo G4', 'https://www.lg.com/uk/partners/tvs-soundbars/oled-evo/oled77g45lw/', [
    ['Screen', '77″ OLED evo with MLA, 4K, 144 Hz'],
    ['Weight', '37.4 kg'],
    ['VESA', '300 × 300'],
    ['With optional stand', '1712 × 1039 × 321 mm'],
    ['Dimensions (W × H × D)', '1712 × 982 × 24.8 mm'],
  ]),
  slots: [
    matSlot('screen', 'Screen', 'screen-aurora-mat'),
    matSlot('body', 'Border & back', 'tv-titan-silver'),
    matSlot('trim', 'Status light & bracket', 'tv-graphite'),
  ],
  build: ({ w, d, h }) => [
    span('body', [-w / 2, w / 2], [0, h], [-d / 2 + 0.004, d / 2 - 0.0008], { bevel: 0.002 }),
    span('screen', [-w / 2 + 0.005, w / 2 - 0.005], [0.006, h - 0.005], [d / 2 - 0.0008, d / 2], o),
    // Thin dark border printed under the glass, the status light and the wall bracket.
    span('trim', [0.05, 0.058], [0.0015, 0.003], [d / 2 - 0.0012, d / 2 + 0.0004], o),
    span('trim', [-w * 0.2, w * 0.2], [h * 0.3, h * 0.6], [-d / 2, -d / 2 + 0.004], o),
  ],
  planDetail: ({ w, d }) => [rectPoly(-w / 2, -d / 2, w / 2, d / 2)],
});

export default definePack({
  name: 'Branded TVs',
  version: '1.0.0',
  author: 'Neest team',
  description:
    'Six real TVs built to their published dimensions: Samsung S95D 65″ and LG C4 65″ OLEDs on pedestals, Sony BRAVIA 8 55″ and BRAVIA 9 75″ on feet, and Samsung The Frame 55″ and LG G4 77″ flush on the wall. Brand and spec data is in each item’s info card; no logos are drawn.',
  license: 'CC0 geometry (made for Neest); Samsung, LG and Sony are trademarks of their owners',
  items: [s95d, c4, bravia8, bravia9, frame55, g4],
  patterns: [auroraPattern, duskPattern, frameArtPattern],
  materials: [
    { id: 'screen-aurora-mat', name: 'TV screen: aurora picture', color: '#ffffff', roughness: 0.12, pattern: { id: 'screen-aurora', scale: 1.6 } },
    { id: 'screen-dusk-mat', name: 'TV screen: dusk picture', color: '#ffffff', roughness: 0.12, pattern: { id: 'screen-dusk', scale: 1.6 } },
    { id: 'frame-art-mat', name: 'TV screen: Art Mode print', color: '#ffffff', roughness: 0.6, pattern: { id: 'frame-art', scale: 1.206 } },
    { id: 'tv-black', name: 'TV black', color: '#121315', roughness: 0.35, metalness: 0.2 },
    { id: 'tv-graphite', name: 'TV graphite', color: '#2b2d31', roughness: 0.4, metalness: 0.5 },
    { id: 'tv-titan-silver', name: 'Titan silver metal', category: 'metal', color: '#9a9ca0', roughness: 0.32, metalness: 0.85, pattern: { id: 'brushed', scale: 0.4, contrast: 0.4 } },
    { id: 'tv-dark-silver', name: 'Dark silver metal', category: 'metal', color: '#5d6066', roughness: 0.3, metalness: 0.85 },
    { id: 'tv-frame-black', name: 'Frame bezel black', category: 'metal', color: '#1c1c1e', roughness: 0.45, metalness: 0.4 },
  ],
});

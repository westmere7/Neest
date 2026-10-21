/**
 * Branded lighting (Vietnam) — the Rạng Đông LED fittings on the ceilings of most Vietnamese
 * homes: the AT04 recessed downlight, the P06 600 × 600 panel and the LN12N round ceiling light.
 *
 * Every item is a real model sold in Vietnam at its published size (`brand.url` names the source).
 * Original procedural shapes: no logos or trademark artwork. Fixed products, so nothing resizes.
 * Ceiling fittings hang just under a 2.7 m ceiling like the library's own ceiling lights.
 */
import {
  cyl,
  defineItem,
  definePack,
  ellipsePoints,
  lathe,
  line,
  matSlot,
  poly,
  rectPoly,
  ring,
  span,
  type AssetBrand,
  type Size3,
} from '@/packs/kit';

const o = { plan: false };

function fixed(w: number, d: number, h: number) {
  const s: Size3 = { w, d, h };
  return { defaultSize: s, minSize: s, maxSize: s, resizable: { w: false, d: false, h: false } };
}

const brand = (name: string, model: string, line: string, url: string, specs: [string, string][]): AssetBrand => ({ name, model, line, url, specs });

/** Ceiling height the ceiling fittings are dimensioned for. */
const CEILING = 2.7;
/** Base elevation that puts a ceiling fitting of height `h` just under the ceiling. */
const ceilingElevation = (h: number): number => CEILING - h - 0.01;
const WARM = '#ffd9a8';
const NEUTRAL = '#fff1de';
const COOL = '#f2f4ff';

const LIGHT_TAGS = ['branded', 'vietnam', 'rạng đông', 'rang dong', 'led', 'ceiling', 'ceiling light'];

// ---------------------------------------------------------------------------
// Rạng Đông AT04 recessed downlight
// ---------------------------------------------------------------------------

const at04 = defineItem({
  id: 'rang-dong-at04-90-7w',
  name: 'Rạng Đông AT04 LED downlight 7W',
  category: 'lighting',
  type: 'lighting',
  group: 'Ceiling lights',
  tags: [...LIGHT_TAGS, 'at04', 'downlight', 'recessed', 'spot', 'pot light', 'đèn âm trần', 'den am tran', 'đèn downlight'],
  description:
    'The Rạng Đông AT04 7 W LED downlight for a 90 mm cut-out: a thin white aluminium trim ring around a frosted opal lens set into a short silver reflector collar.',
  ...fixed(0.118, 0.118, 0.04),
  mount: 'ceiling',
  defaultElevation: ceilingElevation(0.04),
  slots: [matSlot('trim', 'Trim', 'metal-white-powder'), matSlot('reflector', 'Reflector collar', 'rd-aluminium'), matSlot('light', 'Lens', 'light-warm')],
  // A wide 105° beam from the lens just above the trim's lower edge.
  light: { color: WARM, intensity: 1.2, distance: 4.5, y: 0.008, kind: 'spot', angle: 0.85, penumbra: 0.6 },
  build: ({ w, h }) => {
    const R = w / 2;
    return [
      // Trim flange against the ceiling and the skirt down to the lens.
      cyl('trim', [0, h - 0.003, 0], R, 0.006, { segments: 48 }),
      lathe('trim', [0, 0, 0], [[R * 0.8, 0], [R * 0.84, h - 0.006], [R * 0.74, h - 0.006], [R * 0.74, 0.002], [R * 0.8, 0]], { segments: 48, plan: false }),
      // Reflector collar and the frosted lens recessed a few millimetres.
      lathe('reflector', [0, 0, 0], [[R * 0.74, 0.0015], [R * 0.74, 0.012], [R * 0.66, 0.012], [R * 0.7, 0.0015]], { segments: 48, plan: false }),
      cyl('light', [0, 0.0095, 0], R * 0.67, 0.003, { segments: 40, plan: false }),
      ring('trim', [0, 0.0018, 0], R * 0.78, 0.0018, o),
    ];
  },
  planDetail: ({ w }) => [poly(ellipsePoints(0, 0, (w / 2) * 0.67, (w / 2) * 0.67)), line([-w * 0.15, 0], [w * 0.15, 0]), line([0, -w * 0.15], [0, w * 0.15])],
  brand: brand('Rạng Đông', 'D AT04L 90/7W', 'LED Downlight AT04', 'https://rangdong.com.vn/led-downlight-at04l-90-7w-pr675.html', [
    ['Size (Ø × H)', '118 × 40 mm'],
    ['Cut-out', 'Ø 90 mm'],
    ['Power', '7 W, 220 V / 50–60 Hz'],
    ['Light output', '500 lm'],
    ['Colour temperature', '3000 K / 5000 K / 6500 K'],
  ]),
});

// ---------------------------------------------------------------------------
// Rạng Đông P06 600 × 600 LED panel
// ---------------------------------------------------------------------------

const p06 = defineItem({
  id: 'rang-dong-p06-600x600-40w',
  name: 'Rạng Đông P06 LED panel 600 × 600 40W',
  category: 'lighting',
  type: 'lighting',
  group: 'Ceiling lights',
  tags: [...LIGHT_TAGS, 'p06', 'led panel', 'panel light', 'office light', '60x60', 'đèn panel', 'đèn led panel', 'den panel'],
  description:
    'The Rạng Đông P06 back-lit 600 × 600 mm LED panel: a slim white aluminium frame around a flat opal diffuser, with a shallow stepped steel back tray, for a ceiling grid or surface mounting.',
  ...fixed(0.6, 0.6, 0.035),
  mount: 'ceiling',
  defaultElevation: ceilingElevation(0.035),
  slots: [matSlot('frame', 'Frame & back tray', 'metal-white-powder'), matSlot('light', 'Diffuser', 'rd-led-cool')],
  // A flat diffuser: one very wide, soft cone from the panel face.
  light: { color: COOL, intensity: 1.5, distance: 5, y: 0.003, kind: 'spot', angle: 1.2, penumbra: 0.9 },
  build: ({ w, d, h }) => {
    const f = 0.011; // frame border
    const yb = 0.012; // frame height below the back tray
    return [
      // Back tray: a stepped box above the frame, narrower at the top.
      span('frame', [-w / 2 + 0.004, w / 2 - 0.004], [yb, h - 0.008], [-d / 2 + 0.004, d / 2 - 0.004], { bevel: 0.002 }),
      span('frame', [-w / 2 + 0.03, w / 2 - 0.03], [h - 0.009, h], [-d / 2 + 0.03, d / 2 - 0.03], { bevel: 0.002, plan: false }),
      // Frame rails around the diffuser.
      span('frame', [-w / 2, -w / 2 + f], [0, yb + 0.001], [-d / 2, d / 2], { bevel: 0.0015, plan: false }),
      span('frame', [w / 2 - f, w / 2], [0, yb + 0.001], [-d / 2, d / 2], { bevel: 0.0015, plan: false }),
      span('frame', [-w / 2 + f, w / 2 - f], [0, yb + 0.001], [-d / 2, -d / 2 + f], { bevel: 0.0015, plan: false }),
      span('frame', [-w / 2 + f, w / 2 - f], [0, yb + 0.001], [d / 2 - f, d / 2], { bevel: 0.0015, plan: false }),
      // Diffuser set 2 mm up into the frame.
      span('light', [-w / 2 + f, w / 2 - f], [0.002, yb], [-d / 2 + f, d / 2 - f], o),
    ];
  },
  planDetail: ({ w, d }) => [rectPoly(-w / 2 + 0.011, -d / 2 + 0.011, w / 2 - 0.011, d / 2 - 0.011)],
  brand: brand('Rạng Đông', 'P06 600x600/40W', 'LED Panel', 'https://rangdong.com.vn/den-led-panel-chieu-thang-60-60-40w-pr1249.html', [
    ['Size (L × W × H)', '600 × 600 × 35 mm'],
    ['Weight', '2 kg'],
    ['Power', '40 W, 150–250 V'],
    ['Light output', '3600 lm (3000 K) / 4000 lm (6500 K), CRI 80'],
    ['Beam angle / life', '105° / 25,000 h'],
  ]),
});

// ---------------------------------------------------------------------------
// Rạng Đông LN12N round ceiling light
// ---------------------------------------------------------------------------

const ln12n = defineItem({
  id: 'rang-dong-ln12n-220-18w',
  name: 'Rạng Đông LN12N round ceiling light 18W',
  category: 'lighting',
  type: 'lighting',
  group: 'Ceiling lights',
  tags: [...LIGHT_TAGS, 'ln12n', 'ln12', 'flush mount', 'ceiling lamp', 'round', 'đèn ốp trần', 'den op tran', 'ốp trần tròn'],
  description:
    'The Rạng Đông LN12N 18 W round LED ceiling light, 22 cm across: a white PC/ABS base against the ceiling and a softly domed opal PC cover with a fine joint line.',
  ...fixed(0.22, 0.22, 0.041),
  mount: 'ceiling',
  defaultElevation: ceilingElevation(0.041),
  slots: [matSlot('light', 'Opal cover', 'rd-opal-neutral'), matSlot('base', 'Base', 'plastic-white')],
  light: { color: NEUTRAL, intensity: 1.2, distance: 6, y: 0.014 },
  build: ({ w, h }) => {
    const R = w / 2;
    const yb = 0.024; // cover top / base bottom
    return [
      // Base: a shallow round tray with a chamfered rim, against the ceiling.
      lathe('base', [0, 0, 0], [[0, yb - 0.002], [R * 0.94, yb - 0.002], [R * 0.995, yb + 0.004], [R, h - 0.004], [R * 0.98, h], [0, h]], { segments: 64 }),
      // Opal cover: a soft dome tucked into the base.
      lathe(
        'light',
        [0, 0, 0],
        [
          [0, 0],
          [R * 0.55, 0.0012],
          [R * 0.8, 0.004],
          [R * 0.92, 0.009],
          [R * 0.965, 0.016],
          [R * 0.97, yb],
          [0, yb],
        ],
        { segments: 64, plan: false },
      ),
    ];
  },
  planDetail: ({ w }) => [poly(ellipsePoints(0, 0, (w / 2) * 0.6, (w / 2) * 0.6))],
  brand: brand('Rạng Đông', 'LN12N 220/18W', 'LED ốp trần LN12N', 'https://rangdong.com.vn/den-led-op-tran-tron-18w-pr1085.html', [
    ['Size (Ø × H)', '220 × 41 mm'],
    ['Power', '18 W, 150–250 V'],
    ['Light output', '1620 lm (3000 K) / 1800 lm (4000 K, 6500 K), CRI 80'],
    ['Materials', 'PC/ABS base, PC cover, IP54'],
    ['Beam angle / life', '120° / 25,000 h'],
  ]),
});

export default definePack({
  name: 'Branded lighting (Vietnam)',
  version: '1.0.0',
  author: 'Neest team',
  description:
    'Rạng Đông LED ceiling fittings found in most Vietnamese homes: the AT04 recessed downlight, the P06 600 × 600 LED panel and the LN12N round ceiling light, at their published sizes.',
  license: 'CC0 (made for Neest)',
  items: [at04, p06, ln12n],
  materials: [
    { id: 'rd-aluminium', name: 'Satin aluminium', category: 'metal', color: '#c9ccd0', roughness: 0.3, metalness: 0.9 },
    { id: 'rd-led-cool', name: 'Cool LED diffuser', category: 'solid', color: '#f7f9ff', roughness: 0.5, emissive: '#eef3ff', emissiveIntensity: 2.6 },
    { id: 'rd-opal-neutral', name: 'Opal PC cover', category: 'glass', color: '#fbf8f2', roughness: 0.4, emissive: '#fff1de', emissiveIntensity: 2.3 },
  ],
});

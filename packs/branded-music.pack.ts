/**
 * Branded musical instruments — the pianos, keyboard, guitar and drum kit that Vietnamese homes and
 * music schools actually buy: Yamaha U1J and C3X pianos, the Yamaha PSR-E383 beginner keyboard on
 * its X stand, the Yamaha F310 acoustic guitar and the Roland TD-07KV electronic drum kit.
 *
 * Every item is a real model sold in Vietnam at its published size (`brand.url` names the source).
 * Original procedural shapes: no logos or trademark artwork. Fixed products, so nothing resizes;
 * where the maker sells several finishes they are offered as colour variants.
 */
import {
  arcPoints,
  box,
  cyl,
  defineItem,
  definePack,
  discZ,
  ellipsePoints,
  lathe,
  line,
  matSlot,
  poly,
  prism,
  range,
  rectPoly,
  rod,
  rodPath,
  rodX,
  rodZ,
  span,
  sphere,
  torus,
  vcyl,
  circle,
  type AssetBrand,
  type AssetPresetVariant,
  type Part,
  type PlanStroke,
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

const add = (a: V3, b: V3, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];

const MUSIC_TAGS = ['branded', 'vietnam', 'music', 'instrument', 'nhạc cụ'];

// ---------------------------------------------------------------------------
// Keyboards
// ---------------------------------------------------------------------------

/** Full-size white key pitch (an 88-key piano is 52 × 23.5 mm = 1.22 m of keys). */
const WHITE = 0.0235;
/** White keys (counted from C = 0) that have a black key after them: C D F G A. */
const BLACK_AFTER = new Set([0, 1, 3, 4, 5]);

/**
 * A keyboard of `n` white keys starting at x0 on note `start` (0 = C, 5 = A): one white key bed
 * (tops at y0 + 0.022, fronts at zFront, `len` deep) and every black key as its own part.
 */
function keys(white: string, black: string, x0: number, n: number, start: number, y0: number, zFront: number, len: number): Part[] {
  const parts: Part[] = [span(white, [x0, x0 + n * WHITE], [y0, y0 + 0.022], [zFront - len, zFront], { bevel: 0.002, plan: false })];
  for (let i = 0; i < n - 1; i++) {
    if (!BLACK_AFTER.has((i + start) % 7)) continue;
    const cx = x0 + (i + 1) * WHITE;
    parts.push(span(black, [cx - 0.0065, cx + 0.0065], [y0 + 0.016, y0 + 0.034], [zFront - len + 0.003, zFront - len * 0.36], { bevel: 0.002, plan: false }));
  }
  return parts;
}

/** Plan symbol of a keyboard: its outline and a line at every C. */
function keysPlan(x0: number, n: number, start: number, zFront: number, len: number): PlanStroke[] {
  const out: PlanStroke[] = [rectPoly(x0, zFront - len, x0 + n * WHITE, zFront)];
  for (let i = 1; i < n; i++) if ((i + start) % 7 === 0) out.push(line([x0 + i * WHITE, zFront - len], [x0 + i * WHITE, zFront]));
  return out;
}

const PIANO_SLOTS = [
  matSlot('case', 'Case', 'ym-ebony'),
  matSlot('keys', 'White keys & sheet music', 'plastic-white'),
  matSlot('sharps', 'Black keys', 'plastic-black'),
  matSlot('metal', 'Pedals, casters & logo', 'metal-brass'),
];

const PIANO_FINISHES = finishes(['polished-white', 'Polished White (PWH)', { case: 'ym-white' }], ['polished-mahogany', 'Polished Mahogany (PM)', { case: 'ym-mahogany' }]);

// ---------------------------------------------------------------------------
// Yamaha U1J upright piano
// ---------------------------------------------------------------------------

/** Shared layout of the U1J: case front, arm width, keys. */
function u1Geom({ w, d }: Size3) {
  const zc = -d / 2 + 0.36; // front of the upper case
  const armW = (w - 52 * WHITE) / 2 - 0.004;
  return { zc, armW, ky: 0.715, zk: d / 2 - 0.025, keyLen: 0.15, x0: -26 * WHITE };
}

const yamahaU1J = defineItem({
  id: 'yamaha-u1j',
  name: 'Yamaha U1J upright piano',
  category: 'hobbies',
  type: 'activities',
  group: 'Music',
  tags: [...MUSIC_TAGS, 'yamaha', 'u1j', 'u1', 'piano', 'upright', 'đàn piano', 'piano cơ', 'đàn piano đứng', 'keys'],
  description:
    'The 121 cm Yamaha U1J in polished ebony: a tall straight-sided case with a flat lid, a fallboard with a small gold logo, a music shelf on the upper panel, square legs on toe blocks and three brass pedals.',
  ...fixed(1.52, 0.62, 1.21),
  wallSnap: true,
  slots: PIANO_SLOTS,
  variants: PIANO_FINISHES,
  build: (size) => {
    const { w, d, h } = size;
    const { zc, armW, ky, zk, keyLen, x0 } = u1Geom(size);
    const xi: V2 = [-w / 2 + armW, w / 2 - armW];
    const zb = -d / 2;
    const top = h - 0.025;
    const parts: Part[] = [
      // Upper case (back and body), the two side cheeks and the overhanging lid.
      span('case', [-w / 2 + 0.03, w / 2 - 0.03], [0.02, top], [zb, zc]),
      span('case', [-w / 2, w / 2], [top, h], [zb, zc + 0.02], { bevel: 0.008 }),
      // Plinth carrying the pedals.
      span('case', [-w / 2 + 0.03, w / 2 - 0.03], [0, 0.07], [zc - 0.02, zc + 0.03], { bevel: 0.006, plan: false }),
      // Lower (knee) panel and upper panel: shallow raised fields on the case front.
      span('case', [xi[0] + 0.03, xi[1] - 0.03], [0.1, 0.6], [zc, zc + 0.008], { bevel: 0.003, plan: false }),
      span('case', [-w / 2 + 0.06, w / 2 - 0.06], [0.89, top - 0.04], [zc, zc + 0.008], { bevel: 0.003, plan: false }),
      // Keybed, key slip and the keys.
      span('case', xi, [0.64, ky], [zc, zk], { plan: false }),
      span('case', xi, [0.655, ky + 0.012], [zk, d / 2], { bevel: 0.004, plan: false }),
      ...keys('keys', 'sharps', x0, 52, 5, ky, zk, keyLen),
      // Open fallboard (name board) behind the keys with the gold logo, and the music shelf above it.
      span('case', xi, [ky + 0.03, 0.86], [zc, zc + 0.075], { bevel: 0.006, plan: false }),
      span('metal', [-0.05, 0.05], [0.8, 0.812], [zc + 0.075, zc + 0.077], o),
      span('case', [-0.38, 0.38], [0.86, 0.876], [zc, zc + 0.07], { bevel: 0.004, plan: false }),
    ];
    // Sheet music on the shelf, leaning on the upper panel.
    const tilt = 0.12;
    for (const sx of [-1, 1]) {
      parts.push(box('keys', [sx * 0.152, 0.876 + 0.13 * Math.cos(tilt), zc + 0.05 - 0.13 * Math.sin(tilt)], [0.29, 0.26, 0.002], { rotation: [-tilt, 0, 0], plan: false }));
    }
    for (const s of [-1, 1]) {
      const xa: V2 = s < 0 ? [-w / 2, -w / 2 + armW] : [w / 2 - armW, w / 2];
      const xm = (xa[0] + xa[1]) / 2;
      parts.push(
        // Side cheek of the case, full height.
        span('case', s < 0 ? [-w / 2, -w / 2 + 0.03] : [w / 2 - 0.03, w / 2], [0, top], [zb, zc + 0.012]),
        // Arm beside the keys, a square leg under it and the toe block on the floor.
        span('case', xa, [0.63, 0.8], [zc, d / 2], { bevel: 0.014 }),
        span('case', [xm - 0.035, xm + 0.035], [0.06, 0.635], [d / 2 - 0.095, d / 2 - 0.025], { bevel: 0.006, plan: false }),
        span('case', [xa[0] + 0.02, xa[1] - 0.02], [0, 0.06], [zc - 0.02, d / 2 - 0.01], { bevel: 0.01, plan: false }),
      );
    }
    // Three pedals: soft, practice (muffler), damper.
    for (const x of [-0.075, 0, 0.075]) parts.push(span('metal', [x - 0.016, x + 0.016], [0.06, 0.072], [zc + 0.03, zc + 0.12], { bevel: 0.004, plan: false }));
    return parts;
  },
  planDetail: (size) => {
    const { zc, zk, keyLen, x0, armW } = u1Geom(size);
    return [line([-size.w / 2 + armW, zc], [size.w / 2 - armW, zc]), ...keysPlan(x0, 52, 5, zk, keyLen)];
  },
  brand: brand('Yamaha', 'U1J', 'U Series', 'https://in.yamaha.com/en/products/musical_instruments/pianos/upright_pianos/u_series/specs.html', [
    ['Size (W × D × H)', '1520 × 620 × 1210 mm'],
    ['Weight', '246 kg'],
    ['Keys', '88, soft-close fallboard'],
    ['Pedals', '3: soft, muffler (practice), damper'],
    ['Finishes', 'Polished Ebony, Polished White, Polished Mahogany'],
  ]),
});

// ---------------------------------------------------------------------------
// Yamaha C3X grand piano
// ---------------------------------------------------------------------------

/** Rim outline of the C3X: straight bass side, bentside on the treble side, round tail. */
function c3Geom({ w, d, h }: Size3) {
  const zKb = d / 2 - 0.26; // front of the case (keys and cheeks in front of it)
  const L = zKb + d / 2;
  const ct = h - 0.022;
  const A: V2 = [w / 2, zKb - 0.22 * L];
  const rT = Math.min(0.5, Math.max(0.3, w * 0.3));
  const cT: V2 = [-w / 2 + rT, -d / 2 + rT];
  const a1 = 1.5 * Math.PI + 0.85;
  const E: V2 = [cT[0] + Math.cos(a1) * rT, cT[1] + Math.sin(a1) * rT];
  const len = Math.hypot(E[0] - A[0], E[1] - A[1]);
  const ux = (E[0] - A[0]) / len;
  const uz = (E[1] - A[1]) / len;
  const C: V2 = [(A[0] + E[0]) / 2 + uz * 0.12 * w, (A[1] + E[1]) / 2 - ux * 0.12 * w];
  const bent = range(7).map((i) => {
    const t = (i + 1) / 8;
    const s = 1 - t;
    return [s * s * A[0] + 2 * s * t * C[0] + t * t * E[0], s * s * A[1] + 2 * s * t * C[1] + t * t * E[1]] as V2;
  });
  const tail = arcPoints(cT[0], cT[1], rT, a1, Math.PI, 10);
  const outline: V2[] = [[-w / 2, zKb], [w / 2, zKb], A, ...bent, ...tail];
  return { zKb, L, ct, rb: 0.69, cT, rT, outline };
}

const yamahaC3X = defineItem({
  id: 'yamaha-c3x',
  name: 'Yamaha C3X grand piano',
  category: 'hobbies',
  type: 'activities',
  group: 'Music',
  tags: [...MUSIC_TAGS, 'yamaha', 'c3x', 'c3', 'piano', 'grand', 'grand piano', 'đàn piano', 'đàn grand', 'piano cơ'],
  description:
    'The 186 cm Yamaha C3X conservatory grand in polished ebony, lid closed: curved bentside and round tail, tapered square legs on brass casters, a slim pedal lyre with three brass pedals and a small gold logo on the fallboard.',
  ...fixed(1.49, 1.86, 1.01),
  slots: PIANO_SLOTS,
  variants: PIANO_FINISHES,
  build: (size) => {
    const { w, d, h } = size;
    const { zKb, ct, rb, cT, outline } = c3Geom(size);
    const cheek = 0.13;
    const xi: V2 = [-w / 2 + cheek, w / 2 - cheek];
    const zk = d / 2 - 0.02;
    const ky = 0.7;
    // The closed lid also covers the fallboard in front of the rim.
    const lid = outline.map(([x, z], i) => (i < 2 ? ([x, z + 0.085] as V2) : ([x, z] as V2)));
    const parts: Part[] = [
      prism('case', outline, rb, ct - rb),
      prism('case', lid, ct, h - ct),
      // Keybed, key slip, keys, and the fallboard block with the logo.
      span('case', xi, [0.62, ky], [zKb, zk]),
      span('case', xi, [0.62, ky + 0.012], [zk, d / 2], { bevel: 0.004 }),
      ...keys('keys', 'sharps', -26 * WHITE, 52, 5, ky, zk, 0.15),
      span('case', xi, [ky + 0.028, ct], [zKb, zKb + 0.075], { bevel: 0.005, plan: false }),
      span('metal', [-0.05, 0.05], [0.785, 0.797], [zKb + 0.075, zKb + 0.077], o),
    ];
    for (const s of [-1, 1]) {
      parts.push(span('case', s < 0 ? [-w / 2, -w / 2 + cheek] : [w / 2 - cheek, w / 2], [0.6, 0.8], [zKb - 0.02, d / 2], { bevel: 0.015 }));
    }
    // Pedal lyre: two posts and braces up to the rim, the pedal box and three pedals.
    const zl = zKb - 0.12;
    parts.push(span('case', [-0.13, 0.13], [0.04, 0.11], [zl - 0.05, zl + 0.05], { bevel: 0.01, plan: false }));
    for (const s of [-1, 1]) {
      parts.push(
        span('case', [s * 0.07 - 0.016, s * 0.07 + 0.016], [0.11, rb], [zl - 0.016, zl + 0.016], { bevel: 0.004, plan: false }),
        rod('case', [s * 0.07, 0.13, zl - 0.03], [s * 0.05, rb, zl - 0.28], 0.009, o),
      );
    }
    for (const x of [-0.05, 0, 0.05]) parts.push(span('metal', [x - 0.013, x + 0.013], [0.06, 0.073], [zl + 0.05, zl + 0.15], { bevel: 0.004, plan: false }));
    // Three tapered square legs on brass casters.
    const legs: V2[] = [
      [-w / 2 + 0.12, zKb - 0.08],
      [w / 2 - 0.12, zKb - 0.08],
      [cT[0] + 0.1, cT[1] - 0.25],
    ];
    const lh = rb - 0.075;
    for (const [x, z] of legs) {
      parts.push(
        lathe('case', [x, 0.075, z], [[0, 0], [0.045, 0], [0.05, 0.02], [0.062, lh * 0.84], [0.085, lh * 0.88], [0.085, lh], [0, lh]], { segments: 4, rotation: [0, Math.PI / 4, 0], plan: false }),
        vcyl('metal', x, z, 0.052, 0.075, 0.034, { segments: 16, plan: false }),
        rodX('metal', x - 0.028, x + 0.028, 0.026, z, 0.026, { segments: 16, plan: false }),
      );
    }
    return parts;
  },
  planDetail: (size) => {
    const { zKb, outline } = c3Geom(size);
    return [poly(outline), ...keysPlan(-26 * WHITE, 52, 5, size.d / 2 - 0.02, 0.15), line([-size.w / 2, zKb], [size.w / 2, zKb])];
  },
  brand: brand('Yamaha', 'C3X', 'CX Series', 'https://my.yamaha.com/en/musical-instruments/pianos/products/grand-pianos/cx-series/', [
    ['Size (W × D × H)', '1490 × 1860 × 1010 mm (lid closed)'],
    ['Weight', '320 kg'],
    ['Keys', '88'],
    ['Pedals', '3: soft, sostenuto, damper'],
    ['Finishes', 'Polished Ebony, Polished White, Polished Mahogany'],
  ]),
});

// ---------------------------------------------------------------------------
// Yamaha PSR-E383 on an X stand
// ---------------------------------------------------------------------------

/** PSR-E383 body: 941 × 317 × 105 mm, resting on the stand with its base at KB0. */
const KB = { w: 0.941, d: 0.317, h: 0.105 };
const KB0 = 0.755;

const psrE383 = defineItem({
  id: 'yamaha-psr-e383',
  name: 'Yamaha PSR-E383 keyboard on stand',
  category: 'hobbies',
  type: 'activities',
  group: 'Music',
  tags: [...MUSIC_TAGS, 'yamaha', 'psr-e383', 'psr', 'keyboard', 'organ', 'đàn organ', 'đàn điện', 'digital piano', 'x stand', 'chân đàn'],
  description:
    'The black 61-key Yamaha PSR-E383 portable keyboard with round-cornered speaker grilles at both ends of the top panel, a small LCD among the buttons and its music rest, set on a double-braced X stand.',
  ...fixed(KB.w, 0.42, 1.02),
  slots: [
    matSlot('body', 'Body & black keys', 'ym-black-plastic'),
    matSlot('keys', 'White keys & song book', 'plastic-white'),
    matSlot('stand', 'Stand, grilles & buttons', 'metal-black-matte'),
    matSlot('display', 'Display', 'screen-glow'),
  ],
  build: ({ w, d }) => {
    const kd = KB.d;
    const top = KB0 + KB.h;
    const zF = kd / 2 - 0.012;
    const parts: Part[] = [
      // Body: base tub, raised control panel at the back, end cheeks beside the keys, rubber feet.
      span('body', [-w / 2, w / 2], [KB0 + 0.004, KB0 + 0.05], [-kd / 2, kd / 2], { bevel: 0.012 }),
      span('body', [-w / 2, w / 2], [KB0 + 0.03, top], [-kd / 2, -kd / 2 + 0.155], { bevel: 0.012, plan: false }),
      span('body', [-w / 2, -w / 2 + 0.047], [KB0 + 0.03, KB0 + 0.08], [-kd / 2 + 0.1, kd / 2], { bevel: 0.01, plan: false }),
      span('body', [w / 2 - 0.047, w / 2], [KB0 + 0.03, KB0 + 0.08], [-kd / 2 + 0.1, kd / 2], { bevel: 0.01, plan: false }),
      ...keys('keys', 'body', -18 * WHITE, 36, 0, KB0 + 0.046, zF, 0.14),
      // Top panel: speaker grilles at both ends, LCD in the middle, rows of buttons, volume dial.
      span('stand', [-w / 2 + 0.03, -w / 2 + 0.2], [top, top + 0.002], [-kd / 2 + 0.025, -kd / 2 + 0.13], { bevel: 0.0008, plan: false }),
      span('stand', [w / 2 - 0.2, w / 2 - 0.03], [top, top + 0.002], [-kd / 2 + 0.025, -kd / 2 + 0.13], { bevel: 0.0008, plan: false }),
      span('display', [-0.06, 0.06], [top, top + 0.0015], [-kd / 2 + 0.03, -kd / 2 + 0.075], o),
      vcyl('stand', -w / 2 + 0.23, -kd / 2 + 0.07, top, top + 0.012, 0.011, { segments: 20, plan: false }),
    ];
    for (const x of [-0.2, -0.17, -0.14, -0.11, 0.11, 0.14, 0.17, 0.2]) parts.push(span('stand', [x - 0.009, x + 0.009], [top, top + 0.004], [-kd / 2 + 0.035, -kd / 2 + 0.05], { bevel: 0.001, plan: false }));
    for (const x of [-0.08, -0.05, 0.05, 0.08]) parts.push(span('stand', [x - 0.009, x + 0.009], [top, top + 0.004], [-kd / 2 + 0.095, -kd / 2 + 0.11], { bevel: 0.001, plan: false }));
    for (const x of [-w / 2 + 0.1, w / 2 - 0.1]) for (const z of [-kd / 2 + 0.04, kd / 2 - 0.04]) parts.push(vcyl('body', x, z, KB0, KB0 + 0.006, 0.012, { segments: 12, plan: false }));
    // Music rest slotted in behind the panel, with an open song book.
    const lean = 0.18;
    const rc: V3 = [0, top + 0.072, -kd / 2 + 0.03];
    const rn: V3 = [0, Math.sin(lean), Math.cos(lean)];
    parts.push(
      box('body', rc, [0.55, 0.16, 0.008], { rotation: [-lean, 0, 0], plan: false }),
      box('keys', add(rc, rn, 0.0055), [0.4, 0.13, 0.003], { rotation: [-lean, 0, 0], plan: false }),
    );
    // Double-braced X stand: crossed legs, padded support arms, floor feet with rubber caps.
    const xa = 0.3;
    const yt = KB0 - 0.016;
    for (const z of [-0.06, 0.06]) {
      parts.push(
        rod('stand', [-xa, 0.03, z], [xa, yt, z], 0.0145, o),
        rod('stand', [xa, 0.03, z], [-xa, yt, z], 0.0145, o),
        discZ('stand', [0, (0.03 + yt) / 2, z + Math.sign(z) * 0.017], 0.02, 0.01, { segments: 16, plan: false }),
      );
    }
    for (const x of [-xa, xa]) {
      parts.push(
        rodZ('stand', x, yt, -kd / 2 + 0.03, kd / 2 - 0.03, 0.014, o),
        span('body', [x - 0.018, x + 0.018], [yt + 0.008, KB0], [-0.09, -0.04], o),
        span('body', [x - 0.018, x + 0.018], [yt + 0.008, KB0], [0.04, 0.09], o),
        rodZ('stand', x, 0.02, -d / 2 + 0.03, d / 2 - 0.03, 0.016, o),
        sphere('body', [x, 0.02, -d / 2 + 0.025], 0.02, o),
        sphere('body', [x, 0.02, d / 2 - 0.025], 0.02, o),
      );
    }
    return parts;
  },
  planDetail: () => keysPlan(-18 * WHITE, 36, 0, KB.d / 2 - 0.012, 0.14),
  brand: brand('Yamaha', 'PSR-E383', 'PSR-E Series', 'https://usa.yamaha.com/products/musical_instruments/keyboards/portable_keyboards/psr-e383/', [
    ['Keyboard (W × D × H)', '941 × 317 × 105 mm'],
    ['Overall on X stand (as modelled)', '941 × 420 × 1020 mm'],
    ['Weight', '4.4 kg (without batteries)'],
    ['Keys', '61, touch response'],
    ['Voices / speakers', '650 voices, 2 × 12 cm, 2.5 W + 2.5 W'],
  ]),
});

// ---------------------------------------------------------------------------
// Yamaha F310 acoustic guitar on a stand
// ---------------------------------------------------------------------------

/** F310 half-widths along the body (m from the tail end, metres): 412 mm wide, 505 mm long. */
const F310_BODY: V2[] = [
  [0, 0],
  [0.008, 0.07],
  [0.025, 0.125],
  [0.055, 0.168],
  [0.095, 0.196],
  [0.145, 0.206],
  [0.195, 0.2],
  [0.24, 0.18],
  [0.28, 0.152],
  [0.315, 0.14],
  [0.35, 0.146],
  [0.395, 0.152],
  [0.44, 0.147],
  [0.472, 0.128],
  [0.493, 0.1],
  [0.505, 0.065],
];

const yamahaF310 = defineItem({
  id: 'yamaha-f310',
  name: 'Yamaha F310 acoustic guitar on stand',
  category: 'hobbies',
  type: 'activities',
  group: 'Music',
  tags: [...MUSIC_TAGS, 'yamaha', 'f310', 'guitar', 'acoustic', 'đàn guitar', 'ghi ta', 'guitar acoustic', 'stand', 'giá đỡ'],
  description:
    'The Yamaha F310 dreadnought-style acoustic guitar in natural spruce with a dark pickguard, rosette, rosewood-look bridge and chrome tuners, resting on a black folding A-frame stand.',
  ...fixed(0.42, 0.44, 1.1),
  slots: [
    matSlot('top', 'Spruce top', 'ym-spruce'),
    matSlot('wood', 'Back, sides, neck & bridge', 'ym-meranti'),
    matSlot('stand', 'Stand, pickguard & rosette', 'metal-black-matte'),
    matSlot('strings', 'Strings, frets & tuners', 'metal-chrome'),
  ],
  variants: finishes(['tobacco-brown-sunburst', 'Tobacco Brown Sunburst (TBS)', { top: 'ym-sunburst' }]),
  build: ({ w, d }) => {
    const t = 0.24;
    const ct = Math.cos(t);
    const st = Math.sin(t);
    const by = 0.095;
    const bz = 0.08;
    // Point `m` metres up the guitar's axis from the tail end, `off` metres in front of the body's mid-plane.
    const at = (m: number, off = 0): V3 => [0, by + m * ct + off * st, bz - m * st + off * ct];
    const face: V3 = [Math.PI / 2 - t, 0, 0]; // cylinders and prisms: local y = face normal
    const back: V3 = [-t, 0, 0]; // boxes and tori: local y = guitar axis, local z = face normal
    const bd = 0.106;
    const mid = 0.505 / 2;
    // Body outline in the face plane as [x, -m] (prism local z runs down the guitar axis).
    const outline: V2[] = [...F310_BODY.map(([m, x]) => [x, -m] as V2), ...F310_BODY.slice(1).reverse().map(([m, x]) => [-x, -m] as V2)];
    const slab = (slot: string, off0: number, thick: number): Part => {
      const p = prism(slot, outline, 0, thick);
      return { ...p, rotation: face, position: at(mid, off0) };
    };
    const nut = 0.505 + 0.352; // 14 frets clear of the body on a 634 mm scale
    const parts: Part[] = [
      slab('wood', -bd / 2, bd - 0.004),
      slab('top', bd / 2 - 0.004, 0.004),
      // Sound hole, rosette and pickguard on the treble side.
      cyl('stand', at(0.405, bd / 2), 0.049, 0.003, { rotation: face, segments: 32, plan: false }),
      torus('stand', at(0.405, bd / 2 + 0.0005), 0.058, 0.0035, { rotation: back, plan: false }),
      { ...prism('stand', ellipsePoints(0, 0, 0.045, 0.07, 20), 0, 0.0015), rotation: face, position: add(at(0.36, bd / 2 - 0.0005), [0.072, 0, 0]) } as Part,
      // Bridge with its saddle line, neck with fingerboard, angled headstock.
      box('wood', at(0.215, bd / 2 + 0.004), [0.155, 0.03, 0.008], { rotation: back, bevel: 0.002, plan: false }),
      box('wood', at((0.49 + nut) / 2, bd / 2 - 0.008), [0.05, nut - 0.49, 0.03], { rotation: back, bevel: 0.004, plan: false }),
    ];
    const hd = t + 0.23;
    const hdir: V3 = [0, Math.cos(hd), -Math.sin(hd)];
    const hn: V3 = [0, Math.sin(hd), Math.cos(hd)];
    const h0 = at(nut, bd / 2 - 0.004);
    parts.push(box('wood', add(h0, hdir, 0.086), [0.076, 0.172, 0.016], { rotation: [-hd, 0, 0], bevel: 0.004, plan: false }));
    // Tuners: three a side, posts through the headstock with chrome buttons.
    for (const k of [0.04, 0.085, 0.13]) {
      const p = add(add(h0, hdir, k), hn, -0.006);
      for (const s of [-1, 1]) {
        parts.push(rodX('strings', s * 0.036, s * 0.058, p[1], p[2], 0.004, { segments: 8, plan: false }), sphere('strings', [s * 0.062, p[1], p[2]], 0.009, { scale: [0.5, 1, 1], plan: false }));
      }
    }
    // Frets (every other one up to the body joint) and the six strings from bridge to nut.
    for (const k of [1, 3, 5, 7, 9, 12]) {
      const m = nut - 0.634 * (1 - 2 ** (-k / 12));
      parts.push(box('strings', at(m, bd / 2 + 0.0075), [0.05 - k * 0.0006, 0.002, 0.002], { rotation: back, plan: false }));
    }
    const s0 = at(0.215, bd / 2 + 0.009);
    const s1 = at(nut, bd / 2 + 0.009);
    for (const i of range(6)) {
      const f = i / 5 - 0.5;
      parts.push(rod('strings', [f * 0.054, s0[1], s0[2]], [f * 0.036, s1[1], s1[2]], 0.0006, { segments: 4, plan: false }));
    }
    // A-frame stand: three legs from a hub, a back post up to a padded neck yoke, a padded cradle.
    const hub: V3 = [0, 0.3, bz - 0.17];
    const yoke = at(0.78, -bd / 2 - 0.012);
    const feet: V3[] = [
      [-w / 2 + 0.03, 0.012, d / 2 - 0.04],
      [w / 2 - 0.03, 0.012, d / 2 - 0.04],
      [0, 0.012, -d / 2 + 0.03],
    ];
    for (const f of feet) parts.push(rod('stand', hub, f, 0.01, o), sphere('stand', f, 0.012, o));
    parts.push(
      rod('stand', hub, yoke, 0.011, o),
      rodX('stand', -0.032, 0.032, yoke[1], yoke[2], 0.008, o),
      rod('stand', [-0.032, yoke[1], yoke[2]], [-0.032, yoke[1] + 0.05, yoke[2] + 0.012], 0.006, o),
      rod('stand', [0.032, yoke[1], yoke[2]], [0.032, yoke[1] + 0.05, yoke[2] + 0.012], 0.006, o),
    );
    for (const s of [-1, 1]) {
      const p0: V3 = [s * 0.06, 0.1, bz - 0.12];
      parts.push(rod('stand', hub, p0, 0.009, o), ...rodPath('stand', [p0, [s * 0.1, 0.08, bz + 0.06], [s * 0.1, 0.13, bz + 0.09]], 0.01));
    }
    return parts;
  },
  planDetail: () => [poly(ellipsePoints(0, 0.03, 0.2, 0.08))],
  brand: brand('Yamaha', 'F310', 'F Series', 'https://usa.yamaha.com/products/musical_instruments/guitars_basses/ac_guitars/f_fx/specs.html', [
    ['Total length', '1029 mm'],
    ['Body (L × W × D)', '505 × 412 × 96–116 mm'],
    ['Scale length', '634 mm'],
    ['Top / back & sides', 'Spruce / meranti'],
    ['Finishes', 'Natural, Tobacco Brown Sunburst'],
  ]),
});

// ---------------------------------------------------------------------------
// Roland TD-07KV electronic drum kit
// ---------------------------------------------------------------------------

/** Mesh pad: rubber rim and shell with a mesh head, axis tipped `tilt` towards the player (+z). */
function meshPad(c: V3, r: number, depth: number, tilt: number): Part[] {
  const ax: V3 = [0, Math.cos(tilt), Math.sin(tilt)];
  return [
    cyl('shell', c, r, depth, { rotation: [tilt, 0, 0], segments: 32 }),
    cyl('mesh', add(c, ax, depth / 2), r - 0.012, 0.004, { rotation: [tilt, 0, 0], segments: 32, plan: false }),
    torus('shell', add(c, ax, depth / 2), r - 0.006, 0.008, { rotation: [tilt - Math.PI / 2, 0, 0], plan: false }),
  ];
}

/** Rubber cymbal pad: a shallow cone with a raised bell, tipped towards the player. */
function cymbalPad(c: V3, r: number, tilt: number): Part[] {
  const ax: V3 = [0, Math.cos(tilt), Math.sin(tilt)];
  return [
    cyl('cymbal', c, r, 0.014, { rTop: r * 0.3, rotation: [tilt, 0, 0], segments: 32 }),
    cyl('cymbal', add(c, ax, 0.014), r * 0.24, 0.016, { rTop: r * 0.08, rotation: [tilt, 0, 0], segments: 20, plan: false }),
  ];
}

const tdLayout = {
  posts: [-0.42, 0.42],
  zp: -0.12,
  snare: [-0.27, 0.62, 0.2] as V3,
  toms: [
    [-0.17, 0.82, -0.04],
    [0.17, 0.82, -0.04],
  ] as V3[],
  floorTom: [0.43, 0.6, 0.2] as V3,
  hihat: [-0.47, 0.87, 0.2] as V3,
  crash: [-0.36, 1.12, -0.28] as V3,
  ride: [0.4, 1.04, -0.24] as V3,
};

const rolandTd07kv = defineItem({
  id: 'roland-td-07kv',
  name: 'Roland TD-07KV electronic drum kit',
  category: 'hobbies',
  type: 'activities',
  group: 'Music',
  tags: [...MUSIC_TAGS, 'roland', 'td-07kv', 'v-drums', 'drums', 'drum kit', 'electronic drums', 'trống điện', 'bộ trống', 'percussion'],
  description:
    'The Roland TD-07KV V-Drums kit on its black four-post rack: grey mesh snare and three tom pads, a kick tower, rubber hi-hat, crash and ride pads on boom arms and the TD-07 module on the left post.',
  ...fixed(1.23, 1.1, 1.2),
  slots: [
    matSlot('shell', 'Pads, kick tower & module', 'ym-black-plastic'),
    matSlot('mesh', 'Mesh heads', 'td-mesh'),
    matSlot('rack', 'Rack & hardware', 'metal-anthracite'),
    matSlot('cymbal', 'Cymbal pads & pedal', 'td-rubber'),
  ],
  build: () => {
    const L = tdLayout;
    const parts: Part[] = [];
    // Rack: two posts on splayed feet, a cross bar for the toms, side arms for snare and floor tom.
    for (const x of L.posts) {
      parts.push(vcyl('rack', x, L.zp, 0.1, 0.98, 0.016, { segments: 16, plan: false }));
      for (const dz of [-0.3, 0.3]) parts.push(rod('rack', [x, 0.14, L.zp], [x, 0.012, L.zp + dz], 0.014, o), sphere('cymbal', [x, 0.012, L.zp + dz], 0.012, o));
      parts.push(box('rack', [x, 0.7, L.zp], [0.05, 0.06, 0.05], { bevel: 0.006, plan: false }));
    }
    parts.push(rodX('rack', L.posts[0], L.posts[1], 0.7, L.zp, 0.016));
    parts.push(rodZ('rack', L.posts[0], 0.5, L.zp, L.snare[2], 0.014, o), rodZ('rack', L.posts[1], 0.5, L.zp, L.floorTom[2], 0.014, o));
    // Snare (PDX-8) and floor tom (PDX-6A) on short arms from the side bars.
    parts.push(...meshPad(L.snare, 0.13, 0.06, 0.14), rod('rack', [L.posts[0], 0.5, L.snare[2]], [L.snare[0], L.snare[1] - 0.04, L.snare[2]], 0.011, o));
    parts.push(...meshPad(L.floorTom, 0.11, 0.06, 0.2), rod('rack', [L.posts[1], 0.5, L.floorTom[2]], [L.floorTom[0], L.floorTom[1] - 0.04, L.floorTom[2]], 0.011, o));
    // Two rack toms (PDX-6A) on L-arms from the cross bar.
    for (const c of L.toms) parts.push(...meshPad(c, 0.11, 0.06, 0.4), rod('rack', [c[0] * 0.8, 0.7, L.zp], [c[0], c[1] - 0.05, c[2] - 0.02], 0.011, o));
    // Kick tower (KD-10): weighted base, sloped frame and the round pad facing the player.
    parts.push(
      span('shell', [-0.15, 0.15], [0, 0.04], [-0.22, 0.08], { bevel: 0.01 }),
      box('shell', [0, 0.2, -0.1], [0.24, 0.32, 0.05], { bevel: 0.01, rotation: [-0.25, 0, 0], plan: false }),
      discZ('shell', [0, 0.24, -0.05], 0.13, 0.05, { segments: 32, plan: false }),
      discZ('mesh', [0, 0.24, -0.023], 0.12, 0.004, { segments: 32, plan: false }),
    );
    // Hi-hat (CY-5) on a boom from the left post, and its control pedal on the floor.
    const hh = L.hihat;
    parts.push(...cymbalPad(hh, 0.125, 0.12), rod('rack', [L.posts[0], 0.9, L.zp], [hh[0], hh[1] - 0.02, hh[2]], 0.01, o));
    parts.push(span('cymbal', [-0.52, -0.42], [0.005, 0.03], [0.2, 0.5], { bevel: 0.008, plan: false }), box('cymbal', [-0.47, 0.05, 0.3], [0.08, 0.012, 0.18], { bevel: 0.004, rotation: [0.2, 0, 0], plan: false }));
    // Crash and ride (CY-8) on boom arms from the post tops.
    parts.push(...cymbalPad(L.crash, 0.15, 0.35), rod('rack', [L.posts[0], 0.97, L.zp], [L.crash[0], L.crash[1] - 0.03, L.crash[2]], 0.01, o));
    parts.push(...cymbalPad(L.ride, 0.15, 0.3), rod('rack', [L.posts[1], 0.97, L.zp], [L.ride[0], L.ride[1] - 0.03, L.ride[2]], 0.01, o));
    // TD-07 module on a holder at the left post, angled up towards the player.
    parts.push(
      rod('rack', [L.posts[0], 0.8, L.zp], [-0.33, 0.83, L.zp + 0.09], 0.008, o),
      box('shell', [-0.33, 0.86, L.zp + 0.11], [0.2, 0.13, 0.045], { bevel: 0.008, rotation: [-0.5, 0, 0], plan: false }),
    );
    return parts;
  },
  planDetail: () => {
    const L = tdLayout;
    return [
      circle([L.snare[0], L.snare[2]], 0.13),
      circle([L.floorTom[0], L.floorTom[2]], 0.11),
      circle([L.toms[0][0], L.toms[0][2]], 0.11),
      circle([L.toms[1][0], L.toms[1][2]], 0.11),
      circle([L.hihat[0], L.hihat[2]], 0.125),
      circle([L.crash[0], L.crash[2]], 0.15),
      circle([L.ride[0], L.ride[2]], 0.15),
      rectPoly(-0.15, -0.22, 0.15, 0.08),
    ];
  },
  brand: brand('Roland', 'TD-07KV', 'V-Drums', 'https://www.sweelee.com.vn/en/products/roland-v-drums-td-07kv-electronic-drum-set', [
    ['Size (W × D × H)', '1230 × 1100 × 1200 mm'],
    ['Weight', '21.7 kg'],
    ['Pads', 'PDX-8 snare, 3 × PDX-6A toms, KD-10 kick (all mesh)'],
    ['Cymbals', 'CY-5 hi-hat, 2 × CY-8 crash and ride'],
    ['Module', 'TD-07, 50 kits, 143 instruments; kick pedal not included'],
  ]),
});

export default definePack({
  name: 'Branded musical instruments',
  version: '1.0.0',
  author: 'Neest team',
  description:
    'Yamaha U1J upright and C3X grand pianos, the Yamaha PSR-E383 keyboard on its X stand, the Yamaha F310 acoustic guitar on a stand and the Roland TD-07KV electronic drum kit, at their published sizes and in the finishes they are sold in.',
  license: 'CC0 (made for Neest)',
  items: [yamahaU1J, yamahaC3X, psrE383, yamahaF310, rolandTd07kv],
  materials: [
    { id: 'ym-ebony', name: 'Polished ebony', category: 'solid', color: '#0c0c0e', roughness: 0.08, metalness: 0.1 },
    { id: 'ym-white', name: 'Polished piano white', category: 'solid', color: '#f3f1ec', roughness: 0.1 },
    { id: 'ym-mahogany', name: 'Polished mahogany', category: 'wood', color: '#4b1e15', roughness: 0.12, pattern: { id: 'wood-grain', scale: 0.8, contrast: 0.35 } },
    { id: 'ym-black-plastic', name: 'Black instrument plastic', category: 'solid', color: '#18191b', roughness: 0.45 },
    { id: 'ym-spruce', name: 'Natural spruce top', category: 'wood', color: '#d8b47c', roughness: 0.35, pattern: { id: 'wood-grain', scale: 0.25, contrast: 0.35 } },
    { id: 'ym-sunburst', name: 'Tobacco brown sunburst', category: 'wood', color: '#7a4a24', roughness: 0.3, pattern: { id: 'wood-grain', scale: 0.25, contrast: 0.45 } },
    { id: 'ym-meranti', name: 'Meranti', category: 'wood', color: '#6e4128', roughness: 0.4, pattern: { id: 'wood-grain', scale: 0.4, contrast: 0.5 } },
    { id: 'td-mesh', name: 'Grey drum mesh', category: 'fabric', color: '#55585c', roughness: 0.9, pattern: { id: 'weave', scale: 0.01, contrast: 0.6 } },
    { id: 'td-rubber', name: 'Black rubber', category: 'solid', color: '#1d1d1f', roughness: 0.85 },
  ],
});

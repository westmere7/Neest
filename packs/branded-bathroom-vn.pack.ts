/**
 * Branded bathroom (Vietnam) — twelve real products sold widely in Vietnam, built to their
 * published dimensions.
 *
 * Toilets: TOTO MS885DE2 one-piece, Caesar CD1338 two-piece, American Standard VF-0100 squat pan,
 * INAX AC-952VN wall-hung. Basins: American Standard Active 0955 wall-hung with semi-pedestal,
 * TOTO LT710CSR and Caesar L5225 counter-top, TOTO LPT236CS on a long pedestal.
 * Showers and baths: American Standard Signature WF-1772 rain column, Caesar AT0150 built-in bath.
 * Water heating: Ariston SL2 20 RS 2.5 FE storage heater (bình nóng lạnh), Panasonic DH-4RL1VW
 * instant heater (máy nước nóng trực tiếp).
 *
 * Specs come from Vietnamese retailer listings (meta.vn and others) and the makers' sites, linked in
 * each item's `brand.url`. The shapes are original procedural approximations: no logos or
 * trademark artwork are drawn. They are fixed products, so nothing resizes.
 */
import {
  circle,
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
  rectPoly,
  rod,
  rodPath,
  roundRectPoints,
  span,
  sphere,
  vcyl,
  type AssetBrand,
  type Part,
  type Size3,
  type V2,
  range,
  lerp,
} from '@/packs/kit';

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

const o = { plan: false };
const tags = (...t: string[]) => [...t, 'bathroom', 'phòng tắm', 'thiết bị vệ sinh', 'branded', 'vietnam'];

/** Points on a superellipse (n = 2 ellipse, larger n = rounder rectangle) from angle t0 to t1. */
function superPts(cx: number, cz: number, a: number, b: number, n: number, t0: number, t1: number, seg = 16): V2[] {
  return range(seg + 1).map((i) => {
    const t = lerp(t0, t1, i / seg);
    const c = Math.cos(t);
    const s = Math.sin(t);
    return [cx + a * Math.sign(c) * Math.pow(Math.abs(c), 2 / n), cz + b * Math.sign(s) * Math.pow(Math.abs(s), 2 / n)] as V2;
  });
}

/**
 * Hollow rim/wall between an outer and an inner superellipse (a basin or bath seen from above),
 * built as two half-ring prisms because a prism outline cannot have a hole. The inner shape may sit
 * further forward (czIn) as long as it stays inside the outer one.
 */
function ringPrisms(slot: string, outer: [number, number, number, number], inner: [number, number, number, number], n: number, y0: number, h: number, plan = true): Part[] {
  const [cx, cz, ao, bo] = outer;
  const [, czIn, ai, bi] = inner;
  const A = [...superPts(cx, cz, ao, bo, n, -Math.PI / 2, Math.PI / 2), ...superPts(cx, czIn, ai, bi, n, Math.PI / 2, -Math.PI / 2)];
  const B = [...superPts(cx, cz, ao, bo, n, Math.PI / 2, (3 * Math.PI) / 2), ...superPts(cx, czIn, ai, bi, n, (3 * Math.PI) / 2, Math.PI / 2)];
  return [prism(slot, A, y0, h, plan ? undefined : o), prism(slot, B, y0, h, o)];
}

/** Flat floor of a basin or bath at height y, matching an inner superellipse. */
const bowlFloor = (slot: string, cx: number, cz: number, a: number, b: number, n: number, y: number): Part => prism(slot, superPts(cx, cz, a, b, n, 0, 2 * Math.PI, 32).slice(0, -1), y, 0.01, o);

/** Fixed product: nothing resizes. */
function fixed(w: number, d: number, h: number) {
  const s: Size3 = { w, d, h };
  return { defaultSize: s, minSize: s, maxSize: s, resizable: { w: false, d: false, h: false } };
}

const brand = (name: string, model: string, line: string, url: string, specs: [string, string][]): AssetBrand => ({ name, model, line, url, specs });

interface ToiletStyle {
  /** One-piece (tank fused to the bowl) or two-piece (tank sits on the bowl's back). */
  onePiece: boolean;
  /** Smooth skirted sides hiding the trapway. */
  skirt: boolean;
  /** Corner rounding of the tank. */
  tankRound: number;
  /** Tank depth. */
  tankD: number;
  /** Seat height. */
  seatY: number;
  /** Side control knob of a mechanical bidet seat (TOTO Ecowasher). */
  bidetKnob?: boolean;
  /** Rectangular push button instead of a round one. */
  squareButton?: boolean;
}

/** A floor-standing close-coupled or one-piece toilet filling w × d × h, back against the wall. */
function toilet(w: number, d: number, h: number, s: ToiletStyle): Part[] {
  const zb = -d / 2;
  const rx = w / 2 - 0.008;
  const rz = (d - s.tankD) / 2 + 0.05;
  const bz = d / 2 - rz;
  const sy = s.seatY - 0.04;
  const prof: V2[] = s.skirt
    ? [[0, 0], [0.86, 0], [0.9, 0.02], [0.9, sy * 0.55], [0.96, sy * 0.85], [1, sy], [0.86, sy], [0.6, sy - 0.09], [0, sy - 0.13]]
    : [[0, 0], [0.58, 0], [0.62, 0.015], [0.52, 0.1], [0.56, sy * 0.45], [0.82, sy * 0.75], [0.97, sy - 0.03], [1, sy], [0.86, sy], [0.6, sy - 0.08], [0, sy - 0.12]];
  const tankY0 = s.onePiece ? sy - 0.12 : sy + 0.01;
  const tz0 = zb;
  const tz1 = zb + s.tankD;
  const tw = s.onePiece ? w - 0.02 : w - 0.03;
  const parts: Part[] = [
    lathe('ceramic', [0, 0, bz], prof, { segments: 40, scale: [rx, 1, rz] }),
    // Tank (a rounded block) with its lid.
    prism('ceramic', roundRectPoints(0, (tz0 + tz1) / 2, tw, tz1 - tz0, s.tankRound, 5), tankY0, h - 0.025 - tankY0),
    prism('ceramic', roundRectPoints(0, (tz0 + tz1) / 2 + 0.004, tw + 0.006, tz1 - tz0 + 0.008, s.tankRound + 0.003, 5), h - 0.025, 0.025, o),
    // Seat ring and closed lid.
    cyl('seat', [0, sy + 0.009, bz + 0.005], rx - 0.004, 0.018, { segments: 36, scale: [1, 1, (rz - 0.01) / (rx - 0.004)], plan: false }),
    cyl('seat', [0, sy + 0.03, bz + 0.012], rx - 0.01, 0.024, { segments: 36, rTop: rx - 0.025, scale: [1, 1, (rz - 0.02) / (rx - 0.01)], plan: false }),
    span('seat', [-0.09, 0.09], [sy, sy + 0.035], [tz1 - 0.01, tz1 + 0.04], { bevel: 0.012, plan: false }),
  ];
  if (s.onePiece) {
    // Fuse tank into the bowl's back.
    parts.push(span('ceramic', [-tw / 2 + 0.02, tw / 2 - 0.02], [0.02, tankY0 + 0.02], [tz0 + 0.02, tz1 + 0.04], { bevel: 0.03 }));
  }
  if (s.squareButton) parts.push(span('button', [-0.04, 0.04], [h - 0.002, h + 0.0], [(tz0 + tz1) / 2 - 0.022, (tz0 + tz1) / 2 + 0.022], { bevel: 0.0008, plan: false }));
  else parts.push(cyl('button', [-0.018, h - 0.001, (tz0 + tz1) / 2], 0.017, 0.004, o), cyl('button', [0.022, h - 0.001, (tz0 + tz1) / 2], 0.022, 0.004, o));
  if (s.bidetKnob) parts.push(span('seat', [rx - 0.005, rx + 0.0], [sy - 0.005, sy + 0.04], [tz1 + 0.04, tz1 + 0.11], { bevel: 0.004, plan: false }), cyl('button', [rx + 0.0, sy + 0.017, tz1 + 0.075], 0.014, 0.008, { rotation: [0, 0, Math.PI / 2], plan: false }));
  // Supply valve on the wall.
  parts.push(rod('button', [-w / 2 + 0.06, 0.18, zb], [-w / 2 + 0.06, 0.18, zb + 0.05], 0.008, o), sphere('button', [-w / 2 + 0.06, 0.18, zb + 0.05], 0.014, o), rod('button', [-w / 2 + 0.06, 0.18, zb + 0.05], [-w / 2 + 0.06, tankY0 + 0.02, zb + 0.05], 0.004, o));
  return parts;
}

const toiletPlan = ({ w, d }: Size3, tankD: number) => {
  const rz = (d - tankD) / 2 + 0.05;
  return [poly(ellipsePoints(0, d / 2 - rz + 0.01, w / 2 - 0.05, rz - 0.07)), line([-w / 2 + 0.01, -d / 2 + tankD], [w / 2 - 0.01, -d / 2 + tankD])];
};

const TOILET_SLOTS = [matSlot('ceramic', 'Ceramic', 'ceramic-white'), matSlot('seat', 'Seat & lid', 'plastic-white'), matSlot('button', 'Flush button & valve', 'metal-chrome')];

// ---------------------------------------------------------------------------
// Toilets
// ---------------------------------------------------------------------------

const totoMs885 = defineItem({
  id: 'toto-ms885de2',
  name: 'TOTO MS885DE2 one-piece toilet',
  category: 'bathroom',
  type: 'plumbing',
  group: 'Toilets',
  tags: tags('toto', 'bồn cầu 1 khối', 'bồn cầu toto', 'one-piece toilet', 'ecowasher', 'tornado flush', 'ms885'),
  description: 'Skirted one-piece TOTO toilet with Tornado flush, Cefiontect glaze and a soft-close lid with the Ecowasher non-electric bidet seat.',
  ...fixed(0.387, 0.701, 0.645),
  wallSnap: true,
  slots: TOILET_SLOTS,
  build: ({ w, d, h }) => toilet(w, d, h, { onePiece: true, skirt: true, tankRound: 0.05, tankD: 0.2, seatY: 0.4, bidetKnob: true }),
  planDetail: (s) => toiletPlan(s, 0.2),
  brand: brand('TOTO', 'MS885DE2', 'One-piece toilet with Ecowasher TCW07S', 'https://meta.vn/bon-cau-toto-1-khoi-nap-dong-em-ms885de2-p116745', [
    ['Size (D × W × H)', '701 × 387 × 645 mm'],
    ['Flush', 'Tornado, dual push 4.5 / 3 L'],
    ['Rough-in (tâm xả)', '305 mm'],
    ['Glaze', 'Cefiontect'],
    ['Seat', 'Soft-close, Ecowasher TCW07S (no power)'],
  ]),
});

const caesarCd1338 = defineItem({
  id: 'caesar-cd1338',
  name: 'Caesar CD1338 two-piece toilet',
  category: 'bathroom',
  type: 'plumbing',
  group: 'Toilets',
  tags: tags('caesar', 'bồn cầu 2 khối', 'bồn cầu caesar', 'two-piece toilet', 'close coupled', 'cd1338'),
  description: 'Classic close-coupled Caesar toilet: separate cistern on an exposed-trap bowl, with a dual push button.',
  ...fixed(0.375, 0.7, 0.745),
  wallSnap: true,
  slots: TOILET_SLOTS,
  build: ({ w, d, h }) => toilet(w, d, h, { onePiece: false, skirt: false, tankRound: 0.025, tankD: 0.18, seatY: 0.41 }),
  planDetail: (s) => toiletPlan(s, 0.18),
  brand: brand('Caesar', 'CD1338', 'Two-piece toilet', 'https://meta.vn/bon-cau-2-khoi-caesar-cd1338-p114806', [
    ['Size (D × W × H)', '700 × 375 × 745 mm'],
    ['Type', 'Two-piece (close coupled)'],
    ['Rough-in (tâm xả)', '300 mm'],
  ]),
});

// ---------------------------------------------------------------------------
// Basins
// ---------------------------------------------------------------------------

/** Pillar basin mixer standing on a deck. */
function pillarMixer(slot: string, x: number, z: number, y0: number, H: number, reach: number): Part[] {
  return [
    vcyl(slot, x, z, y0, y0 + 0.006, 0.026, o),
    vcyl(slot, x, z, y0 + 0.006, y0 + H, 0.017, o),
    rod(slot, [x, y0 + H - 0.015, z], [x, y0 + H - 0.03, z + reach], 0.011, o),
    rod(slot, [x + 0.012, y0 + H - 0.008, z], [x + 0.06, y0 + H + 0.004, z], 0.006, o),
  ];
}

const amstdActive = defineItem({
  id: 'american-standard-active-0955',
  name: 'American Standard Active wall basin',
  category: 'bathroom',
  type: 'plumbing',
  group: 'Sinks',
  tags: tags('american standard', 'lavabo treo tường', 'chậu rửa', 'wall-hung basin', 'semi-pedestal', 'chân lửng', 'active 0955'),
  description: 'Rectangular wall-hung basin with an overflow and a ceramic semi-pedestal hiding the trap, shown with a pillar mixer.',
  ...fixed(0.535, 0.48, 0.62),
  mount: 'wall',
  defaultElevation: 0.33,
  slots: [matSlot('ceramic', 'Ceramic', 'ceramic-white'), matSlot('tap', 'Tap & waste', 'metal-chrome')],
  build: ({ w, d, h }) => {
    const zb = -d / 2;
    const top = 0.492;
    const bh = 0.16;
    return [
      // Semi-pedestal against the wall.
      prism('ceramic', roundRectPoints(0, zb + 0.09, 0.2, 0.18, 0.06, 4), 0, top - bh),
      // Basin body and its sunken bowl.
      ...ringPrisms('ceramic', [0, 0, w / 2, d / 2], [0, 0.03, w / 2 - 0.05, d / 2 - 0.08], 5, top - bh, bh),
      bowlFloor('ceramic', 0, 0.03, w / 2 - 0.05, d / 2 - 0.08, 5, top - 0.12),
      lathe('ceramic', [0, top - 0.124, 0.03], [[0, 0], [0.14, 0], [0.18, 0.11], [0, 0.11]], { segments: 28, plan: false }),
      cyl('tap', [0, top - 0.118, 0.03], 0.018, 0.004, o),
      sphere('ceramic', [0, top - 0.035, zb + 0.1], 0.012, o),
      ...pillarMixer('tap', 0, zb + 0.07, top, Math.min(h - top - 0.015, 0.11), 0.09),
    ];
  },
  planDetail: ({ w, d }) => [poly(roundRectPoints(0, 0.03, w - 0.1, d - 0.16, 0.08, 4)), circle([0, -d / 2 + 0.07], 0.025)],
  brand: brand('American Standard', '0955-WT', 'Active wall-hung basin with semi-pedestal', 'https://meta.vn/chau-rua-treo-tuong-american-standard-active-0955-wt-p76951', [
    ['Size (L × W × H)', '535 × 480 × 492 mm (with semi-pedestal)'],
    ['Material', 'Vitreous china, easy-clean glaze'],
    ['Overflow', 'Yes'],
    ['Made in', 'Vietnam'],
  ]),
});

const totoLt710 = defineItem({
  id: 'toto-lt710csr',
  name: 'TOTO LT710CSR counter-top basin',
  category: 'bathroom',
  type: 'plumbing',
  group: 'Sinks',
  tags: tags('toto', 'lavabo đặt bàn', 'chậu rửa', 'counter-top basin', 'vessel', 'rectangular', 'lt710'),
  description: 'Rectangular TOTO counter-top basin with a deck for a single-hole mixer, to set on a vanity top.',
  ...fixed(0.5, 0.45, 0.4),
  defaultElevation: 0.82,
  slots: [matSlot('ceramic', 'Ceramic', 'ceramic-white'), matSlot('tap', 'Tap & waste', 'metal-chrome')],
  build: ({ w, d, h }) => {
    const bh = 0.19;
    return [
      ...ringPrisms('ceramic', [0, 0, w / 2, d / 2], [0, 0.04, w / 2 - 0.035, d / 2 - 0.085], 5, 0, bh),
      bowlFloor('ceramic', 0, 0.04, w / 2 - 0.035, d / 2 - 0.085, 5, bh - 0.13),
      cyl('tap', [0, bh - 0.128, 0.04], 0.02, 0.004, o),
      ...pillarMixer('tap', 0, -d / 2 + 0.06, bh, Math.min(h - bh - 0.015, 0.17), 0.1),
    ];
  },
  planDetail: ({ w, d }) => [poly(roundRectPoints(0, 0.04, w - 0.07, d - 0.17, 0.06, 4))],
  brand: brand('TOTO', 'LT710CSR', 'Counter-top basin', 'https://meta.vn/chau-rua-lavabo-toto-lt710csr-xw-p111844', [
    ['Size', '500 × 450 × 190 mm'],
    ['Shape', 'Rectangular'],
    ['Tap hole', 'Ø35 mm'],
  ]),
});

const caesarL5225 = defineItem({
  id: 'caesar-l5225',
  name: 'Caesar L5225 round counter-top basin',
  category: 'bathroom',
  type: 'plumbing',
  group: 'Sinks',
  tags: tags('caesar', 'lavabo đặt bàn', 'chậu rửa tròn', 'counter-top basin', 'vessel', 'round', 'l5225'),
  description: 'Deep round Caesar vessel basin with an overflow, made in Vietnam; shown with a tall vessel mixer.',
  ...fixed(0.38, 0.45, 0.42),
  defaultElevation: 0.82,
  slots: [matSlot('ceramic', 'Ceramic', 'ceramic-white'), matSlot('tap', 'Tap & waste', 'metal-chrome')],
  build: ({ w, d, h }) => {
    const r = w / 2;
    const bh = 0.14;
    const bz = d / 2 - r;
    return [
      lathe('ceramic', [0, 0, bz], [[0, 0], [r * 0.48, 0], [r * 0.52, 0.01], [r * 0.9, bh * 0.5], [r, bh * 0.96], [r * 0.97, bh], [r * 0.9, bh], [r * 0.8, bh * 0.55], [r * 0.4, bh * 0.15], [0, bh * 0.13]], { segments: 40 }),
      cyl('tap', [0, bh * 0.13 + 0.002, bz], 0.019, 0.004, o),
      sphere('ceramic', [0, bh * 0.75, bz - r * 0.84], 0.008, o),
      ...pillarMixer('tap', 0, -d / 2 + 0.03, 0, Math.min(h - 0.015, 0.4), 0.17),
    ];
  },
  planDetail: ({ w, d }) => [circle([0, d / 2 - w / 2], w * 0.44)],
  brand: brand('Caesar', 'L5225', 'Counter-top basin', 'https://meta.vn/lavabo-dat-tren-ban-caesar-l5225-p125390', [
    ['Size (W × D × H)', '380 × 380 × 140 mm'],
    ['Shape', 'Round, deep bowl'],
    ['Overflow', 'Yes'],
    ['Made in', 'Vietnam'],
  ]),
});

// ---------------------------------------------------------------------------
// Showers and water heating
// ---------------------------------------------------------------------------

/** Wall shower column: mixer at the bottom, riser, arm and overhead head, hand shower on a holder. */
function showerColumn(o2: { d: number; h: number; head: number; arm: number; square?: boolean; shelf?: boolean; mixerW: number }): Part[] {
  const { d, h, head, arm } = o2;
  const zb = -d / 2;
  const mixY = 0.05;
  const parts: Part[] = [];
  if (o2.shelf) {
    // Thermostat body with a glass-top shelf (SmartControl).
    parts.push(span('metal', [-o2.mixerW / 2, o2.mixerW / 2], [mixY - 0.035, mixY + 0.035], [zb + 0.02, zb + 0.08], { bevel: 0.03 }));
    parts.push(span('accent', [-o2.mixerW / 2 + 0.02, o2.mixerW / 2 - 0.02], [mixY + 0.035, mixY + 0.04], [zb + 0.02, zb + 0.13], { bevel: 0.002, plan: false }));
    for (const [i, x] of [-0.1, 0, 0.1].entries()) parts.push(cyl(i === 1 ? 'accent' : 'metal', [x, mixY, zb + 0.083], 0.022, 0.008, { rotation: [Math.PI / 2, 0, 0], plan: false }));
  } else {
    parts.push(rod('metal', [-o2.mixerW / 2, mixY, zb + 0.05], [o2.mixerW / 2, mixY, zb + 0.05], 0.028, { segments: 20 }));
    for (const s of [-1, 1]) parts.push(cyl('metal', [s * (o2.mixerW / 2 + 0.01), mixY, zb + 0.05], 0.03, 0.03, { rotation: [0, 0, Math.PI / 2], plan: false }), rod('metal', [s * 0.075, mixY, zb], [s * 0.075, mixY, zb + 0.05], 0.012, o));
  }
  const top = h - 0.045;
  parts.push(vcyl('metal', 0, zb + 0.05, mixY + 0.03, top, 0.012, o), rod('metal', [0, top, zb + 0.05], [0, top, zb + arm], 0.01, o));
  parts.push(rod('metal', [0, h * 0.72, zb], [0, h * 0.72, zb + 0.05], 0.008, o));
  const hz = zb + arm;
  if (o2.square) parts.push(span('metal', [-head / 2, head / 2], [top - 0.02, top - 0.006], [hz - head / 2, hz + head / 2], { bevel: 0.005, plan: false }));
  else parts.push(cyl('metal', [0, top - 0.013, hz], head / 2, 0.014, { segments: 40, plan: false }), cyl('accent', [0, top - 0.021, hz], head / 2 - 0.012, 0.002, { segments: 40, plan: false }));
  // Hand shower on its slider and the hose.
  const hy = h * 0.42;
  parts.push(span('metal', [-0.02, 0.02], [hy - 0.02, hy + 0.02], [zb + 0.06, zb + 0.085], { bevel: 0.006, plan: false }));
  parts.push(rod('metal', [0, hy - 0.08, zb + 0.095], [0, hy + 0.1, zb + 0.12], 0.012, { rTop: 0.02, plan: false }), cyl('metal', [0, hy + 0.12, zb + 0.13], 0.04, 0.03, { rotation: [1.3, 0, 0], plan: false }));
  parts.push(...rodPath('hose', [[0.05, mixY - 0.03, zb + 0.06], [0.08, -0.0 + 0.03, d / 2 - 0.05], [0.04, hy - 0.2, zb + 0.15], [0, hy - 0.08, zb + 0.095]], 0.006));
  return parts;
}

const amstdWf1772 = defineItem({
  id: 'american-standard-wf-1772',
  name: 'American Standard Signature rain shower column',
  category: 'bathroom',
  type: 'plumbing',
  group: 'Showers & tubs',
  tags: tags('american standard', 'sen cây', 'sen tắm', 'rain shower', 'shower column', 'signature', 'wf-1772'),
  description: 'Exposed rain shower column: wall mixer, adjustable riser with a 250 mm overhead head and a 110 mm hand shower.',
  ...fixed(0.3, 0.5, 1.25),
  mount: 'wall',
  defaultElevation: 0.9,
  slots: [matSlot('metal', 'Chrome', 'metal-chrome'), matSlot('accent', 'Nozzle face', 'solid-black'), matSlot('hose', 'Hose', 'metal-brushed-steel')],
  build: ({ d, h }) => showerColumn({ d, h, head: 0.25, arm: 0.36, mixerW: 0.17 }),
  brand: brand('American Standard', 'WF-1772', 'Signature shower column', 'https://meta.vn/cay-sen-phun-mua-american-standard-signature-wf-1772-p76973', [
    ['Riser length', '1000–1250 mm (adjustable)'],
    ['Overhead shower', 'Ø250 mm'],
    ['Hand shower', 'Ø110 mm'],
    ['Inlet centres', '150 mm'],
  ]),
});

const aristonSl2 = defineItem({
  id: 'ariston-sl2-20-rs',
  name: 'Ariston SL2 20 RS water heater',
  category: 'bathroom',
  type: 'plumbing',
  group: 'Water heating',
  tags: tags('ariston', 'bình nóng lạnh', 'máy nước nóng gián tiếp', 'storage water heater', 'slim', '20 lít', 'sl2'),
  description: 'Slim horizontal 20 L electric storage water heater (bình nóng lạnh) with a front dial, mounted high on the wall.',
  ...fixed(0.704, 0.301, 0.282),
  mount: 'wall',
  defaultElevation: 1.95,
  slots: [matSlot('body', 'Casing', 'plastic-white'), matSlot('trim', 'Trim & dial', 'solid-light-grey'), matSlot('pipes', 'Pipes', 'metal-chrome')],
  build: ({ w, d, h }) => {
    const zb = -d / 2;
    const r = Math.min(h, d) / 2;
    return [
      prism('body', roundRectPoints(0, 0, w, d, r * 0.95, 8), 0.0, h),
      span('trim', [-w / 2 + 0.04, w / 2 - 0.04], [0.01, h - 0.01], [d / 2 - 0.004, d / 2 + 0.002], { bevel: 0.002, plan: false }),
      discZ('trim', [w / 2 - 0.12, h / 2, d / 2 + 0.008], 0.038, 0.016, o),
      discZ('body', [w / 2 - 0.12, h / 2, d / 2 + 0.017], 0.03, 0.004, o),
      sphere('trim', [w / 2 - 0.2, h / 2 + 0.025, d / 2 + 0.003], 0.005, o),
      ...[-0.05, 0.05].map((x) => vcyl('pipes', x, zb + 0.12, -0.0, 0.006, 0.012, o)),
      span('trim', [-w / 2 + 0.05, -w / 2 + 0.12], [h - 0.01, h], [zb, zb + 0.04], o),
    ];
  },
  planDetail: ({ w, d }) => [rectPoly(-w / 2 + 0.04, -d / 2 + 0.04, w / 2 - 0.04, d / 2 - 0.04)],
  brand: brand('Ariston', 'SL2 20 RS 2.5 FE', 'Slim2 storage water heater', 'https://meta.vn/binh-nong-lanh-gian-tiep-ariston-sl2-20-rs-2-5-fe-p57786', [
    ['Capacity', '20 L'],
    ['Power', '2500 W'],
    ['Size (W × D × H)', '704 × 301 × 282 mm'],
    ['Mounting', 'Wall, horizontal'],
  ]),
});

// ---------------------------------------------------------------------------
// Everyday Vietnamese bathroom: squat pan, pedestal basin, instant heater, bath, wall-hung WC
// ---------------------------------------------------------------------------

/**
 * Like ringPrisms, with separate roundness for the outer and inner outlines. Both halves show in
 * the plan unless `plan` is false.
 */
function ringPrismsN(slot: string, outer: [number, number, number, number], nOut: number, inner: [number, number, number, number], nIn: number, y0: number, h: number, plan = true): Part[] {
  const [cx, cz, ao, bo] = outer;
  const [, czIn, ai, bi] = inner;
  const A = [...superPts(cx, cz, ao, bo, nOut, -Math.PI / 2, Math.PI / 2), ...superPts(cx, czIn, ai, bi, nIn, Math.PI / 2, -Math.PI / 2)];
  const B = [...superPts(cx, cz, ao, bo, nOut, Math.PI / 2, (3 * Math.PI) / 2), ...superPts(cx, czIn, ai, bi, nIn, (3 * Math.PI) / 2, Math.PI / 2)];
  const opt = plan ? undefined : o;
  return [prism(slot, A, y0, h, opt), prism(slot, B, y0, h, opt)];
}

/** Closed superellipse outline (for a filled prism). */
const superOutline = (cx: number, cz: number, a: number, b: number, n: number, seg = 40): V2[] => superPts(cx, cz, a, b, n, 0, 2 * Math.PI, seg).slice(0, -1);

const amstdVf0100 = defineItem({
  id: 'american-standard-vf-0100',
  name: 'American Standard VF-0100 squat toilet',
  category: 'bathroom',
  type: 'plumbing',
  group: 'Toilets',
  tags: tags('american standard', 'xí xổm', 'bồn cầu xổm', 'bệ xí xổm', 'squat toilet', 'squat pan', 'vf-0100'),
  description: 'Vitreous china squat pan (bệ xí xổm) made in Vietnam: a wide flat rim with ribbed foot treads, a narrow oval bowl and the flushing hood at the back. It is set flush into a raised tiled floor.',
  ...fixed(0.398, 0.503, 0.241),
  wallSnap: true,
  slots: [matSlot('ceramic', 'Ceramic', 'ceramic-white'), matSlot('drain', 'Outlet', 'solid-black')],
  build: ({ w, d, h }) => {
    const top = h - 0.04;
    const ft = 0.025;
    const ai = 0.1;
    const bi = d / 2 - 0.05;
    const cz = 0.01;
    const y0 = 0.03;
    const yT = top - ft - y0;
    const parts: Part[] = [
      // Flat rim around an oval opening.
      ...ringPrismsN('ceramic', [0, 0, w / 2, d / 2], 2.6, [0, cz, ai, bi], 2, top - ft, ft),
      // Bowl: tapering underside, sloping down to the outlet.
      lathe('ceramic', [0, y0, cz], [[0, 0], [0.3, 0], [0.55, yT * 0.35], [0.85, yT * 0.75], [1, yT], [0.97, yT - 0.006], [0.75, yT - 0.045], [0.45, yT - 0.085], [0.22, yT - 0.105], [0, yT - 0.11]], { segments: 36, scale: [ai, 1, bi] }),
      cyl('drain', [0, y0 + yT - 0.106, cz + 0.02], ai * 0.3, 0.006, { segments: 24, scale: [1, 1, 1.8], plan: false }),
      vcyl('ceramic', 0, cz, 0, y0 + 0.005, 0.03, o),
      // Flushing hood over the back of the bowl, with the inlet spigot behind it.
      sphere('ceramic', [0, top, -0.17], 1, { scale: [ai + 0.03, h - top, 0.075], plan: false }),
      rod('ceramic', [0, top - 0.012, -d / 2 + 0.004], [0, top - 0.012, -0.2], 0.018, o),
    ];
    // Ribbed foot treads either side of the bowl.
    for (const s of [-1, 1]) {
      for (const z of [-0.05, 0, 0.05, 0.1, 0.15]) {
        const x: V2 = s < 0 ? [-0.165, -0.115] : [0.115, 0.165];
        parts.push(span('ceramic', x, [top, top + 0.005], [z - 0.012, z + 0.012], { bevel: 0.002, plan: false }));
      }
    }
    return parts;
  },
  planDetail: () => [poly(ellipsePoints(0, 0.01, 0.1, 0.2015)), circle([0, 0.03], 0.03), line([-0.13, -0.095], [0.13, -0.095])],
  brand: brand('American Standard', 'VF-0100', 'Squat pan (bệ xí xổm)', 'http://noithatphongtamvn.com/san-pham/be-xi-xom-american-standard-vf-0100-16014', [
    ['Size (L × W × H)', '503 × 398 × 241 mm'],
    ['Drain centre (tâm xả)', '300 mm'],
    ['Flush', 'Straight-through (xả thẳng), separate valve or cistern'],
    ['Glaze', 'Anti-stick glaze'],
    ['Made in', 'Vietnam'],
  ]),
});

const totoLpt236 = defineItem({
  id: 'toto-lpt236cs',
  name: 'TOTO LPT236CS pedestal basin',
  category: 'bathroom',
  type: 'plumbing',
  group: 'Sinks',
  tags: tags('toto', 'lavabo chân dài', 'chậu rửa chân dài', 'lavabo treo tường', 'chậu rửa mặt', 'pedestal basin', 'washbasin', 'lpt236cs', 'lpt236cr'),
  description: 'Rounded-rectangle TOTO wall basin on its full-height ceramic pedestal, which hides the trap. It has a deep bowl, an overflow and a single Ø35 mm tap hole; the tap is sold separately.',
  ...fixed(0.53, 0.465, 0.81),
  wallSnap: true,
  slots: [matSlot('ceramic', 'Ceramic', 'ceramic-white'), matSlot('waste', 'Waste', 'metal-chrome'), matSlot('hole', 'Tap hole & overflow', 'solid-black')],
  build: ({ w, d, h }) => {
    const zb = -d / 2;
    const top = h - 0.002;
    const bh = 0.17;
    const y0 = top - bh;
    const inner: [number, number, number, number] = [0, 0.035, w / 2 - 0.05, d / 2 - 0.1];
    const floorY = top - 0.135;
    return [
      // Long pedestal (column) against the wall.
      lathe('ceramic', [0, 0, zb + 0.13], [[0, 0], [0.115, 0], [0.12, 0.012], [0.1, 0.05], [0.082, 0.3], [0.085, y0 - 0.05], [0.1, y0 + 0.02], [0, y0 + 0.02]], { segments: 36, scale: [1, 1, 0.8], plan: false }),
      // Basin: underside, walls and the bowl floor.
      prism('ceramic', superOutline(0, 0, w / 2 - 0.004, d / 2 - 0.004, 4), y0, 0.012),
      ...ringPrismsN('ceramic', [0, 0, w / 2, d / 2], 4, inner, 3.2, y0 + 0.003, top - y0 - 0.003, false),
      prism('ceramic', superOutline(0, inner[1], inner[2], inner[3], 3.2, 32), floorY, 0.01, o),
      cyl('waste', [0, floorY + 0.012, inner[1]], 0.021, 0.004, o),
      // Overflow slot in the front wall and the tap hole on the back deck.
      span('hole', [-0.025, 0.025], [top - 0.05, top - 0.04], [inner[1] + inner[3] - 0.008, inner[1] + inner[3] - 0.002], { bevel: 0.003, plan: false }),
      cyl('hole', [0, h - 0.0015, -0.165], 0.0175, 0.003, o),
    ];
  },
  planDetail: ({ w, d }) => [poly(superOutline(0, 0.035, w / 2 - 0.05, d / 2 - 0.1, 3.2, 32)), circle([0, -0.165], 0.0175)],
  brand: brand('TOTO', 'LPT236CS', 'Wall basin with long pedestal (chân dài)', 'https://home.gachhaiyen.com/chau-lavabo-treo-tuong-toto-lpt236cs', [
    ['Size (W × D × H)', '530 × 465 × 810 mm'],
    ['Mounting', 'Wall-hung on a full-height pedestal'],
    ['Tap hole', '1 × Ø35 mm'],
    ['Overflow', 'Yes'],
    ['Material', 'Vitreous china, anti-stain glaze'],
  ]),
});

const panasonicDh4rl1 = defineItem({
  id: 'panasonic-dh-4rl1vw',
  name: 'Panasonic DH-4RL1VW instant water heater',
  category: 'bathroom',
  type: 'plumbing',
  group: 'Water heating',
  tags: tags('panasonic', 'máy nước nóng trực tiếp', 'máy nước nóng', 'bình nóng lạnh trực tiếp', 'instant water heater', 'shower heater', 'elcb', '4500w', 'dh-4rl1vw'),
  description: 'Slim white 4.5 kW instant shower heater (máy nước nóng trực tiếp) with an ELCB. It has a power button and lamp above a large temperature knob, and the pipes enter at the bottom. The hand shower is not shown.',
  ...fixed(0.19, 0.093, 0.38),
  mount: 'wall',
  wallSnap: true,
  defaultElevation: 1.25,
  slots: [matSlot('body', 'Casing', 'plastic-white'), matSlot('panel', 'Panel & trim', 'solid-light-grey'), matSlot('metal', 'Fittings', 'metal-chrome'), matSlot('lamp', 'Lamp & test button', 'solid-red')],
  build: ({ w, d, h }) => {
    const zb = -d / 2;
    const zf = d / 2;
    const ky = 0.215;
    return [
      span('body', [-w / 2, w / 2], [0.025, h], [zb, zf - 0.016], { bevel: 0.03 }),
      // Domed front cover.
      span('body', [-w / 2 + 0.01, w / 2 - 0.01], [0.035, h - 0.012], [zf - 0.03, zf - 0.008], { bevel: 0.016, plan: false }),
      // Control window: power button with lamp, temperature knob with its pointer.
      span('panel', [-0.06, 0.06], [0.16, 0.33], [zf - 0.012, zf - 0.005], { bevel: 0.004, plan: false }),
      span('body', [-0.026, 0.026], [0.278, 0.302], [zf - 0.008, zf - 0.002], { bevel: 0.003, plan: false }),
      sphere('lamp', [0.04, 0.29, zf - 0.006], 0.004, o),
      discZ('body', [0, ky, zf - 0.006], 0.034, 0.01, { segments: 32, plan: false }),
      span('panel', [-0.003, 0.003], [ky + 0.012, ky + 0.03], [zf - 0.001, zf], o),
      // Name plate near the top and the ELCB with its test button near the bottom.
      span('panel', [-0.035, 0.035], [h - 0.04, h - 0.03], [zf - 0.01, zf - 0.006], o),
      span('panel', [-0.032, 0.032], [0.07, 0.1], [zf - 0.012, zf - 0.005], { bevel: 0.003, plan: false }),
      discZ('lamp', [0.016, 0.085, zf - 0.004], 0.006, 0.004, o),
      // Inlet, outlet and cable gland underneath.
      ...[-0.045, 0.045].flatMap((x) => [vcyl('metal', x, -0.005, 0, 0.03, 0.009, o), vcyl('metal', x, -0.005, 0, 0.012, 0.013, o)]),
      vcyl('panel', 0, -0.015, 0.006, 0.03, 0.008, o),
    ];
  },
  planDetail: ({ w, d }) => [rectPoly(-w / 2 + 0.02, -d / 2 + 0.01, w / 2 - 0.02, d / 2 - 0.02)],
  brand: brand('Panasonic', 'DH-4RL1VW', 'Instant water heater (no pump)', 'https://www.panasonic.com/vn/consumer/home-appliances/home-shower/instant-water-heater/dh-4rl1vw.html', [
    ['Power', '4500 W, 220 V'],
    ['Size (H × W × D)', '380 × 190 × 93 mm'],
    ['Weight', '2.9 kg'],
    ['Safety', 'ELCB earth-leakage breaker, flow sensor, IP25'],
    ['Controls', 'Power button, rotary temperature knob'],
  ]),
});

const caesarAt0150 = defineItem({
  id: 'caesar-at0150',
  name: 'Caesar AT0150 built-in bathtub',
  category: 'bathroom',
  type: 'plumbing',
  group: 'Showers & tubs',
  tags: tags('caesar', 'bồn tắm', 'bồn tắm xây', 'bồn tắm nằm', 'bathtub', 'built-in', 'drop-in', 'acrylic', '1.5m', 'at0150'),
  description: 'A 1.5 m white acrylic Caesar bath without legs or apron (không chân, không yếm), made to be built into a tiled surround. It has a flat rim, a sloped backrest at one end and the drain and overflow at the foot.',
  ...fixed(1.5, 0.75, 0.44),
  wallSnap: true,
  slots: [matSlot('tub', 'Acrylic', 'ceramic-white'), matSlot('metal', 'Drain & overflow', 'metal-chrome')],
  build: ({ w, d, h }) => {
    const ft = 0.03;
    const A = w / 2 - 0.075;
    const B = d / 2 - 0.07;
    const fy = 0.05;
    const wallTop = h - ft;
    const th = 0.45;
    const L = (wallTop - fy) / Math.cos(th);
    return [
      // Rim, the shell's walls and the floor.
      ...ringPrismsN('tub', [0, 0, w / 2, d / 2], 10, [0, 0, A, B], 5, wallTop, ft),
      ...ringPrismsN('tub', [0, 0, w / 2 - 0.03, d / 2 - 0.03], 6, [0, 0, A, B], 5, 0, wallTop, false),
      prism('tub', superOutline(0, 0, A, B, 5), 0, fy),
      // Sloped backrest at the head end.
      span('tub', [-A + 0.08, -A + 0.12], [(fy + wallTop) / 2 - L / 2, (fy + wallTop) / 2 + L / 2], [-B + 0.04, B - 0.04], { rotation: [0, 0, th], plan: false }),
      // Drain and overflow at the foot end.
      cyl('metal', [A - 0.15, fy + 0.002, 0], 0.03, 0.004, o),
      cyl('metal', [A - 0.002, h - 0.13, 0], 0.028, 0.006, { rotation: [0, 0, Math.PI / 2], plan: false }),
    ];
  },
  planDetail: ({ w, d }) => [poly(superOutline(0, 0, w / 2 - 0.075, d / 2 - 0.07, 5)), circle([w / 2 - 0.225, 0], 0.03), line([-w / 2 + 0.2, -d / 2 + 0.11], [-w / 2 + 0.2, d / 2 - 0.11])],
  brand: brand('Caesar', 'AT0150', 'Built-in bathtub without legs or apron', 'https://caesar.com.vn/zh/san-pham/chi-tiet/181/bon-tam-khong-chan-khong-yem-at0150', [
    ['Size (L × W × H)', '1500 × 750 × 440 mm'],
    ['Capacity', '205 L'],
    ['Material', 'Acrylic'],
    ['Installation', 'Drop-in, built into a tiled surround'],
    ['Colour', 'Pure White'],
  ]),
});

const inaxAc952 = defineItem({
  id: 'inax-ac-952vn',
  name: 'INAX AC-952VN wall-hung toilet',
  category: 'bathroom',
  type: 'plumbing',
  group: 'Toilets',
  tags: tags('inax', 'bồn cầu treo tường', 'bồn cầu inax', 'két âm tường', 'wall hung', 'concealed cistern', 'rimless', 'ac-952vn'),
  description: 'Compact rimless INAX wall-hung bowl with smooth skirted sides and a slim soft-close lid. It hangs from a concealed in-wall cistern frame; the flush plate on the wall is not shown.',
  ...fixed(0.362, 0.55, 0.363),
  mount: 'wall',
  wallSnap: true,
  defaultElevation: 0.05,
  slots: [matSlot('ceramic', 'Ceramic', 'ceramic-white'), matSlot('seat', 'Seat & lid', 'plastic-white')],
  build: ({ w, d, h }) => {
    const zb = -d / 2;
    const H = h - 0.04;
    const rx = w / 2 - 0.003;
    const rz = 0.2;
    const bz = d / 2 - rz;
    return [
      lathe('ceramic', [0, 0, bz], [[0, 0.02], [0.5, 0], [0.8, 0.04], [0.93, 0.12], [0.98, 0.22], [1, H], [0.86, H], [0.6, H - 0.08], [0, H - 0.12]], { segments: 40, scale: [rx, 1, rz] }),
      // Back of the bowl, flat against the wall.
      span('ceramic', [-0.15, 0.15], [0.07, H - 0.003], [zb, bz - rz + 0.02], { bevel: 0.03 }),
      // Seat ring, closed lid and the hinge cover.
      cyl('seat', [0, H + 0.008, bz + 0.005], rx - 0.006, 0.014, { segments: 40, scale: [1, 1, (rz - 0.01) / (rx - 0.006)], plan: false }),
      cyl('seat', [0, H + 0.026, bz + 0.01], rx - 0.01, 0.022, { segments: 40, rTop: rx - 0.025, scale: [1, 1, (rz - 0.02) / (rx - 0.01)], plan: false }),
      span('seat', [-0.1, 0.1], [H - 0.003, H + 0.03], [bz - rz - 0.02, bz - rz + 0.035], { bevel: 0.01, plan: false }),
    ];
  },
  planDetail: ({ d }) => [poly(ellipsePoints(0, d / 2 - 0.19, 0.13, 0.14)), line([-0.1, d / 2 - 0.42], [0.1, d / 2 - 0.42])],
  brand: brand('INAX', 'AC-952VN', 'Wall-hung toilet for a concealed cistern', 'https://www.inax.com.vn/vi/products/toilet/bon-cau-treo-tuong-ac-952vn/', [
    ['Size (L × W × H)', '550 × 362 × 363 mm'],
    ['Flush', 'Powerful Vortex, dual 4.5 / 3 L'],
    ['Rim', 'Rimless'],
    ['Glaze', 'Aqua Ceramic'],
    ['Lid', 'Soft-close'],
  ]),
});

export default definePack({
  name: 'Branded bathroom (Vietnam)',
  version: '1.1.0',
  author: 'Neest team',
  description:
    'Twelve bathroom products sold widely in Vietnam at their published sizes: TOTO, Caesar, INAX and American Standard toilets (including a squat pan and a wall-hung bowl); American Standard, TOTO and Caesar basins; an American Standard shower column; a Caesar built-in bath; and Ariston and Panasonic water heaters.',
  license: 'CC0 (made for Neest); brand names belong to their owners',
  items: [totoMs885, caesarCd1338, amstdVf0100, inaxAc952, amstdActive, totoLt710, caesarL5225, totoLpt236, amstdWf1772, caesarAt0150, aristonSl2, panasonicDh4rl1],
});


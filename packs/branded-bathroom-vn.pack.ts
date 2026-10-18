/**
 * Branded bathroom (Vietnam) — nine real products sold widely in Vietnam, built to their
 * published dimensions.
 *
 * Toilets: TOTO MS885DE2 one-piece, Caesar CD1338 two-piece. Basins: American
 * Standard Active 0955 wall-hung with semi-pedestal, TOTO LT710CSR and Caesar L5225 counter-top.
 * Showers: American Standard Signature WF-1772 rain column.
 * Water heating: Ariston SL2 20 RS 2.5 FE storage heater (bình nóng lạnh).
 *
 * Specs come from Vietnamese retailer listings (meta.vn) and the makers' pro catalogues, linked in
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

export default definePack({
  name: 'Branded bathroom (Vietnam)',
  version: '1.0.0',
  author: 'Neest team',
  description:
    'Seven bathroom products sold widely in Vietnam at their published sizes: TOTO and Caesar toilets; American Standard, TOTO and Caesar basins; an American Standard shower column; and an Ariston storage water heater.',
  license: 'CC0 (made for Neest); brand names belong to their owners',
  items: [totoMs885, caesarCd1338, amstdActive, totoLt710, caesarL5225, amstdWf1772, aristonSl2],
});


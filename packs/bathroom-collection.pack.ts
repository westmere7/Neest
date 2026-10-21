/**
 * Bathroom collection — 25 bathroom pieces for everyday Vietnamese and international homes.
 *
 * Fixtures (floating and open vanities with vessel basins, a corner basin, a freestanding oval
 * bath and floor filler, an alcove bath with a glass screen, a corner bath, a quadrant shower
 * enclosure and a black grid walk-in screen), the wall-side things every Vietnamese bathroom has
 * (bidet spray / vòi xịt, instant water heater, ceiling exhaust fan) and storage and accessories
 * (LED and arched mirrors, a mirror cabinet, over-toilet shelving, a leaning ladder, hamper, teak
 * stool and mat, towel shelf, corner caddy, brush set, pedal bin, column radiator).
 *
 * Original procedural shapes: lathes for basins and baths, thin boxes along arcs for curved glass,
 * one merged mesh per material.
 */
import {
  arcPoints,
  ball,
  box,
  cells,
  circle,
  clamp,
  cyl,
  defineItem,
  definePack,
  discZ,
  ellipsePoints,
  lathe,
  lerp,
  line,
  matSlot,
  poly,
  prism,
  range,
  rectPoly,
  ring,
  rod,
  rodPath,
  roundRectPoints,
  spaced,
  span,
  sphere,
  torus,
  vcyl,
  type Part,
  type V2,
  type V3,
} from '@/packs/kit';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const o = { plan: false };
const CEIL = 2.7;
const tags = (...t: string[]) => [...t, 'bathroom', 'phòng tắm', 'nhà vệ sinh'];

/** Deck mixer for a vessel basin: tall body, forward spout and a side lever. */
function vesselMixer(slot: string, x: number, z: number, y0: number, H: number, reach: number): Part[] {
  return [
    vcyl(slot, x, z, y0, y0 + 0.008, 0.026, o),
    vcyl(slot, x, z, y0 + 0.008, y0 + H, 0.016, o),
    rod(slot, [x, y0 + H - 0.012, z], [x, y0 + H - 0.03, z + reach], 0.01, o),
    vcyl(slot, x, z + reach, y0 + H - 0.05, y0 + H - 0.028, 0.011, o),
    rod(slot, [x + 0.016, y0 + H * 0.82, z], [x + 0.06, y0 + H * 0.84, z], 0.005, o),
  ];
}

/** Round vessel basin of radius r and height h standing at (x, y, z), with a drain. */
function vesselBowl(slot: string, drain: string, x: number, y: number, z: number, r: number, h: number, scaleZ = 1): Part[] {
  return [
    lathe(slot, [x, y, z], [[0, 0], [r * 0.45, 0], [r * 0.5, 0.01], [r * 0.85, h * 0.45], [r, h * 0.95], [r * 0.97, h], [r * 0.9, h], [r * 0.82, h * 0.6], [r * 0.4, h * 0.18], [0, h * 0.16]], {
      segments: 40,
      scale: [1, 1, scaleZ],
    }),
    cyl(drain, [x, y + h * 0.16 + 0.002, z], 0.02, 0.004, o),
  ];
}

/** Flat drawer front with a slim top-edge pull. */
function drawerFront(front: string, pull: string, x: [number, number], y: [number, number], z: number): Part[] {
  return [span(front, x, y, [z, z + 0.018], { bevel: 0.003 }), span(pull, [lerp(x[0], x[1], 0.3), lerp(x[0], x[1], 0.7)], [y[1] - 0.018, y[1] - 0.008], [z + 0.018, z + 0.03], { plan: false })];
}

/** Thin panels along a circular arc (curved glass, curved doors) centred at (cx, cz). */
function arcPanels(slot: string, cx: number, cz: number, r: number, a0: number, a1: number, y0: number, y1: number, t: number, n = 8): Part[] {
  return range(n).map((i) => {
    const a = lerp(a0, a1, (i + 0.5) / n);
    const segL = (2 * r * Math.sin(Math.abs(a1 - a0) / n / 2)) * 1.02;
    return box(slot, [cx + Math.cos(a) * r, (y0 + y1) / 2, cz + Math.sin(a) * r], [segL, y1 - y0, t], { rotation: [0, -a - Math.PI / 2, 0], plan: false });
  });
}

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

/** Rolled towel: a soft cylinder lying along x. */
const towelRoll = (slot: string, c: V3, len: number, r: number): Part => cyl(slot, c, r, len, { rotation: [0, 0, Math.PI / 2], segments: 16, plan: false });

/** Folded towel stack on a shelf. */
function towelStack(slot: string, x: number, y: number, z: number, w: number, d: number, n: number): Part[] {
  return range(n).map((i) => span(slot, [x - w / 2 + i * 0.004, x + w / 2 - i * 0.004], [y + i * 0.03, y + i * 0.03 + 0.028], [z - d / 2, z + d / 2], { bevel: 0.01, plan: i === 0 }));
}

// ---------------------------------------------------------------------------
// Basins and vanities
// ---------------------------------------------------------------------------

const vanityVessel = defineItem({
  id: 'floating-vanity-vessel',
  name: 'Floating vanity with vessel basin',
  category: 'bathroom',
  type: 'plumbing',
  group: 'Sinks',
  tags: tags('vanity', 'floating', 'wall-hung', 'vessel basin', 'lavabo đặt bàn', 'tủ lavabo', 'drawers'),
  description: 'Wall-hung oak vanity with two soft-close drawers, a marble top and a round vessel basin with a tall mixer.',
  defaultSize: { w: 0.8, d: 0.48, h: 1.12 },
  minSize: { w: 0.6, d: 0.42, h: 1.0 },
  maxSize: { w: 1.2, d: 0.55, h: 1.2 },
  wallSnap: true,
  slots: [matSlot('cabinet', 'Cabinet', 'wood-oak-light'), matSlot('top', 'Countertop', 'stone-marble-carrara'), matSlot('basin', 'Basin', 'ceramic-white'), matSlot('tap', 'Tap & pulls', 'metal-chrome')],
  build: ({ w, d, h }) => {
    const y0 = 0.42;
    const yTop = 0.84;
    const x0 = -w / 2;
    const x1 = w / 2;
    const zb = -d / 2;
    const zf = d / 2 - 0.02;
    const r = clamp(Math.min(w * 0.24, d * 0.42), 0.16, 0.22);
    const bz = 0.02;
    return [
      span('cabinet', [x0, x1], [y0, yTop - 0.02], [zb, zf - 0.018]),
      ...drawerFront('cabinet', 'tap', [x0 + 0.005, x1 - 0.005], [y0 + 0.005, lerp(y0, yTop - 0.02, 0.5) - 0.003], zf - 0.018),
      ...drawerFront('cabinet', 'tap', [x0 + 0.005, x1 - 0.005], [lerp(y0, yTop - 0.02, 0.5) + 0.003, yTop - 0.025], zf - 0.018),
      span('top', [x0, x1], [yTop - 0.02, yTop], [zb, d / 2]),
      ...vesselBowl('basin', 'tap', 0, yTop, bz, r, 0.13),
      ...vesselMixer('tap', 0, zb + 0.07, yTop, Math.min(h - yTop - 0.005, 0.28), Math.max(0.06, bz - zb - 0.07 + r * 0.25)),
    ];
  },
  planDetail: ({ w, d }) => [circle([0, 0.02], clamp(Math.min(w * 0.24, d * 0.42), 0.16, 0.22) * 0.9), line([-w / 2, d / 2 - 0.02], [w / 2, d / 2 - 0.02])],
});

const openDoubleVanity = defineItem({
  id: 'open-double-vanity',
  name: 'Teak double vanity with two basins',
  category: 'bathroom',
  type: 'plumbing',
  group: 'Sinks',
  tags: tags('double vanity', 'teak', 'open shelf', 'vessel basins', 'terrazzo', 'two sinks'),
  description: 'Open teak frame with a slatted towel shelf, a terrazzo top and two oval vessel basins with wall-side mixers.',
  defaultSize: { w: 1.4, d: 0.5, h: 1.12 },
  minSize: { w: 1.1, d: 0.45, h: 1.0 },
  maxSize: { w: 1.8, d: 0.55, h: 1.2 },
  wallSnap: true,
  slots: [matSlot('frame', 'Frame & shelf', 'wood-teak'), matSlot('top', 'Countertop', 'tile-terrazzo'), matSlot('basin', 'Basins', 'ceramic-white'), matSlot('tap', 'Taps', 'metal-black-matte')],
  build: ({ w, d, h }) => {
    const yTop = 0.84;
    const t = 0.04;
    const parts: Part[] = [];
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) parts.push(span('frame', [sx * (w / 2 - 0.02) - t / 2, sx * (w / 2 - 0.02) + t / 2], [0, yTop - 0.03], [sz * (d / 2 - 0.04) - t / 2, sz * (d / 2 - 0.04) + t / 2]));
    }
    parts.push(span('frame', [-w / 2 + 0.02, w / 2 - 0.02], [yTop - 0.07, yTop - 0.03], [-d / 2 + 0.02, d / 2 - 0.02]));
    for (const z of cells(6, -d / 2 + 0.05, d / 2 - 0.05)) parts.push(span('frame', [-w / 2 + 0.03, w / 2 - 0.03], [0.16, 0.18], [z - 0.025, z + 0.025], o));
    parts.push(span('frame', [-w / 2 + 0.03, w / 2 - 0.03], [0.14, 0.16], [-d / 2 + 0.03, -d / 2 + 0.06], o), span('frame', [-w / 2 + 0.03, w / 2 - 0.03], [0.14, 0.16], [d / 2 - 0.06, d / 2 - 0.03], o));
    parts.push(span('top', [-w / 2, w / 2], [yTop - 0.03, yTop], [-d / 2, d / 2], { bevel: 0.004 }));
    const r = clamp(d * 0.36, 0.15, 0.2);
    for (const x of [-w / 4, w / 4]) {
      parts.push(...vesselBowl('basin', 'tap', x, yTop, 0.03, r * 1.15, 0.13, 0.72));
      parts.push(...vesselMixer('tap', x, -d / 2 + 0.05, yTop, Math.min(h - yTop - 0.005, 0.28), 0.12));
    }
    parts.push(...towelStack('frame', -w / 4, 0.18, 0, 0.28, 0.24, 3));
    return parts;
  },
  planDetail: ({ w, d }) => {
    const r = clamp(d * 0.36, 0.15, 0.2);
    return [-w / 4, w / 4].map((x) => poly(ellipsePoints(x, 0.03, r * 1.05, r * 0.75)));
  },
});

const cornerBasin = defineItem({
  id: 'corner-basin',
  name: 'Corner wash basin',
  category: 'bathroom',
  type: 'plumbing',
  group: 'Sinks',
  tags: tags('corner basin', 'lavabo góc', 'small bathroom', 'wall-hung', 'compact'),
  description: 'Quarter-round wall-hung corner basin with a short mixer: fits the tight corner of a small Vietnamese WC.',
  defaultSize: { w: 0.42, d: 0.42, h: 0.34 },
  minSize: { w: 0.35, d: 0.35, h: 0.3 },
  maxSize: { w: 0.5, d: 0.5, h: 0.4 },
  mount: 'wall',
  defaultElevation: 0.62,
  slots: [matSlot('basin', 'Basin', 'ceramic-white'), matSlot('tap', 'Tap & trap', 'metal-chrome')],
  build: ({ w, d, h }) => {
    // Corner at the back-left (x = -w/2, z = -d/2); the bowl sweeps round to the front-right.
    const R = Math.min(w, d);
    const cx = -w / 2;
    const cz = -d / 2;
    const rimY = 0.2;
    const ri = R - 0.055;
    const band: V2[] = [...arcPoints(cx, cz, R, 0, Math.PI / 2, 14), ...arcPoints(cx, cz, ri, Math.PI / 2, 0, 12)];
    return [
      prism('basin', band, rimY - 0.13, 0.13),
      prism('basin', [[cx, cz], [cx + 0.13, cz], [cx, cz + 0.13]], rimY - 0.13, 0.13, o),
      span('basin', [cx, cx + ri], [rimY - 0.13, rimY - 0.02], [cz, cz + 0.02], o),
      span('basin', [cx, cx + 0.02], [rimY - 0.13, rimY - 0.02], [cz, cz + ri], o),
      prism('basin', [[cx, cz], ...arcPoints(cx, cz, ri + 0.002, 0, Math.PI / 2, 12)], rimY - 0.13, 0.03, o),
      lathe('basin', [cx + R * 0.38, 0.06, cz + R * 0.38], [[0, 0], [R * 0.24, 0], [R * 0.3, 0.1], [0, 0.1]], { segments: 24, plan: false }),
      vcyl('tap', cx + R * 0.33, cz + R * 0.33, 0, 0.07, 0.016, o),
      ...vesselMixer('tap', cx + 0.08, cz + 0.08, rimY, Math.min(h - rimY - 0.005, 0.13), 0.09),
    ];
  },
  planDetail: ({ w, d }) => [poly([[-w / 2, -d / 2], ...arcPoints(-w / 2, -d / 2, Math.min(w, d) - 0.06, 0, Math.PI / 2, 10)])],
});

// ---------------------------------------------------------------------------
// Baths and showers
// ---------------------------------------------------------------------------

const ovalBath = defineItem({
  id: 'freestanding-oval-bath',
  name: 'Freestanding oval bath',
  category: 'bathroom',
  type: 'plumbing',
  group: 'Showers & tubs',
  tags: tags('bathtub', 'bồn tắm', 'freestanding', 'oval', 'stone resin', 'soaking tub'),
  description: 'Seamless double-ended oval bath in matte stone resin with a slim rim and a click-clack waste.',
  defaultSize: { w: 1.7, d: 0.8, h: 0.58 },
  minSize: { w: 1.4, d: 0.7, h: 0.5 },
  maxSize: { w: 1.9, d: 0.95, h: 0.65 },
  slots: [matSlot('shell', 'Bath', 'ceramic-white'), matSlot('waste', 'Waste', 'metal-chrome')],
  build: ({ w, d, h }) => {
    const rx = w / 2;
    const k = d / w;
    return [
      lathe('shell', [0, 0, 0], [[0, 0], [rx * 0.82, 0], [rx * 0.86, h * 0.04], [rx * 0.96, h * 0.45], [rx, h * 0.97], [rx * 0.985, h], [rx * 0.93, h], [rx * 0.9, h * 0.6], [rx * 0.78, h * 0.15], [0, h * 0.12]], {
        segments: 48,
        scale: [1, 1, k],
      }),
      cyl('waste', [0, h * 0.12 + 0.002, 0], 0.035, 0.004, o),
    ];
  },
  planDetail: ({ w, d }) => [poly(ellipsePoints(0, 0, w / 2 - 0.06, d / 2 - 0.06)), circle([0, 0], 0.03)],
});

const bathFiller = defineItem({
  id: 'freestanding-bath-filler',
  name: 'Freestanding bath filler',
  category: 'bathroom',
  type: 'plumbing',
  group: 'Showers & tubs',
  tags: tags('bath tap', 'vòi bồn tắm', 'floor-mounted', 'bath filler', 'hand shower'),
  description: 'Floor-standing bath mixer with an arched spout and a hand shower on its cradle.',
  defaultSize: { w: 0.22, d: 0.3, h: 1.0 },
  minSize: { w: 0.18, d: 0.25, h: 0.85 },
  maxSize: { w: 0.28, d: 0.4, h: 1.15 },
  slots: [matSlot('metal', 'Finish', 'metal-chrome'), matSlot('hose', 'Hose', 'metal-brushed-steel')],
  build: ({ w, d, h }) => {
    const zc = -d / 2 + 0.06;
    const r = Math.min((d - 0.1) / 2, 0.1);
    const yc = h - 0.015 - r;
    const arc = arcPoints(zc + r, yc, r, Math.PI, 0, 8).map(([z, y]) => [0, y, z] as V3);
    return [
      cyl('metal', [0, 0.005, zc], 0.07, 0.01),
      vcyl('metal', 0, zc, 0.01, yc, 0.022, o),
      ...rodPath('metal', arc, 0.013),
      vcyl('metal', 0, arc[arc.length - 1][2], arc[arc.length - 1][1] - 0.06, arc[arc.length - 1][1], 0.012, o),
      rod('metal', [0.022, h * 0.62, zc], [w / 2 - 0.01, h * 0.62, zc], 0.006, o),
      vcyl('metal', -0.03, zc, h * 0.48, h * 0.54, 0.018, o),
      rod('metal', [-0.03, h * 0.54, zc], [-0.03, h * 0.72, zc + 0.02], 0.014, { rTop: 0.02, ...o }),
      ...rodPath('hose', [[-0.03, h * 0.48, zc], [-0.05, h * 0.3, zc + 0.02], [-0.03, 0.12, zc + 0.03], [-0.012, 0.03, zc]], 0.006),
    ];
  },
  planDetail: ({ d }) => [circle([0, -d / 2 + 0.06], 0.07)],
});

const alcoveBath = defineItem({
  id: 'alcove-bath-screen',
  name: 'Alcove bath with shower screen',
  category: 'bathroom',
  type: 'plumbing',
  group: 'Showers & tubs',
  tags: tags('bathtub', 'bồn tắm', 'shower bath', 'bath screen', 'alcove', 'built-in'),
  description: 'Built-in acrylic bath with a front panel, a hinged glass screen and a wall mixer with a slide rail and hand shower.',
  defaultSize: { w: 1.6, d: 0.75, h: 2.0 },
  minSize: { w: 1.4, d: 0.7, h: 1.9 },
  maxSize: { w: 1.8, d: 0.85, h: 2.1 },
  wallSnap: true,
  slots: [matSlot('tub', 'Bath', 'ceramic-white'), matSlot('panel', 'Front panel', 'ceramic-white'), matSlot('glass', 'Glass screen', 'glass-clear'), matSlot('metal', 'Taps & fittings', 'metal-chrome')],
  build: ({ w, d, h }) => {
    const H = 0.56;
    const G = Math.min(1.4, h - H - 0.03);
    const rim = 0.05;
    const x0 = -w / 2;
    const x1 = w / 2;
    const zb = -d / 2;
    const zf = d / 2;
    const xs = x1 - 0.85;
    return [
      span('panel', [x0, x1], [0, H - rim], [zf - 0.02, zf]),
      ...ringPrisms('tub', [0, 0, w / 2, d / 2], [0, 0, w / 2 - 0.07, d / 2 - 0.07], 10, 0, H),
      bowlFloor('tub', 0, 0, w / 2 - 0.07, d / 2 - 0.07, 10, H - 0.42),
      span('glass', [xs, x1 - 0.01], [H, H + G], [-d / 2 + 0.38 - 0.004, -d / 2 + 0.38 + 0.004], { ...o }),
      span('metal', [x1 - 0.025, x1 - 0.005], [H, H + G], [zb + 0.03, zb + 0.4], o),
      span('metal', [xs - 0.01, xs + 0.01], [H + 0.02, H + G - 0.02], [-d / 2 + 0.375, -d / 2 + 0.385], o),
      ...[H + 0.35, H + 1.05].map((y) => cyl('metal', [x1 - 0.02, y, -d / 2 + 0.38], 0.012, 0.03, { rotation: [0, 0, Math.PI / 2], ...o })),
      span('metal', [-0.11, 0.11], [H + 0.22, H + 0.27], [zb, zb + 0.05], { bevel: 0.01, plan: false }),
      rod('metal', [0, H + 0.22, zb + 0.05], [0, H + 0.15, zb + 0.18], 0.012, o),
      ...[-0.13, 0.13].map((x) => cyl('metal', [x, H + 0.245, zb + 0.05], 0.022, 0.03, { rotation: [Math.PI / 2, 0, 0], ...o })),
      vcyl('metal', -0.35, zb + 0.03, H + 0.35, H + 1.35, 0.011, o),
      rod('metal', [-0.35, H + 1.15, zb + 0.045], [-0.35, H + 1.32, zb + 0.08], 0.013, { rTop: 0.035, ...o }),
      ...rodPath('metal', [[-0.11, H + 0.22, zb + 0.04], [-0.22, H + 0.05, zb + 0.12], [-0.33, H + 0.4, zb + 0.12], [-0.35, H + 1.15, zb + 0.05]], 0.006),
      cyl('metal', [x0 + 0.25, H - 0.415, 0], 0.03, 0.005, o),
    ];
  },
  planDetail: ({ w, d }) => [rectPoly(-w / 2 + 0.07, -d / 2 + 0.07, w / 2 - 0.07, d / 2 - 0.07), line([w / 2 - 0.85, -d / 2 + 0.38], [w / 2, -d / 2 + 0.38])],
});

const cornerBath = defineItem({
  id: 'corner-bath',
  name: 'Corner bath',
  category: 'bathroom',
  type: 'plumbing',
  group: 'Showers & tubs',
  tags: tags('corner bathtub', 'bồn tắm góc', 'quadrant', 'acrylic'),
  description: 'Quadrant acrylic corner bath with a curved front panel and an oval basin, for square bathrooms.',
  defaultSize: { w: 1.4, d: 1.4, h: 0.6 },
  minSize: { w: 1.2, d: 1.2, h: 0.55 },
  maxSize: { w: 1.6, d: 1.6, h: 0.65 },
  wallSnap: true,
  slots: [matSlot('tub', 'Bath', 'ceramic-white'), matSlot('metal', 'Waste & handles', 'metal-chrome')],
  build: ({ w, d, h }) => {
    const R = Math.min(w, d);
    const cx = -w / 2;
    const cz = -d / 2;
    const outer: V2[] = [[cx, cz], ...arcPoints(cx, cz, R, 0, Math.PI / 2, 18)];
    // Rim: the outline minus an oval basin, as two halves either side of the diagonal.
    const bc: V2 = [cx + R * 0.42, cz + R * 0.42];
    const brx = R * 0.36;
    const brz = R * 0.22;
    const rot = Math.PI / 4;
    const oval = (a: number): V2 => {
      const x = Math.cos(a) * brx;
      const z = Math.sin(a) * brz;
      return [bc[0] + x * Math.cos(rot) - z * Math.sin(rot), bc[1] + x * Math.sin(rot) + z * Math.cos(rot)];
    };
    const ovalArc = (a0: number, a1: number) => range(13).map((i) => oval(lerp(a0, a1, i / 12)));
    const front = arcPoints(cx, cz, R, 0, Math.PI / 2, 18);
    // Split along the diagonal: the oval's major axis lies on it, so each half is a simple polygon.
    const halfA = [[cx, cz] as V2, ...front.slice(0, 10), ...ovalArc(0, -Math.PI)];
    const halfB = [[cx, cz] as V2, ...ovalArc(Math.PI, 0), ...front.slice(9)];
    return [
      prism('tub', outer, 0, 0.02),
      ...arcPanels('tub', cx, cz, R - 0.015, 0, Math.PI / 2, 0, h - 0.06, 0.03, 14),
      span('tub', [cx, cx + R - 0.03], [0, h - 0.06], [cz, cz + 0.03], o),
      span('tub', [cx, cx + 0.03], [0, h - 0.06], [cz, cz + R - 0.03], o),
      prism('tub', halfA, h - 0.06, 0.06, o),
      prism('tub', halfB, h - 0.06, 0.06, o),
      lathe('tub', [bc[0], h - 0.44, bc[1]], [[0, 0], [0.8, 0], [0.95, 0.15], [1, 0.38]], { segments: 32, scale: [brx, 1, brz], rotation: [0, -rot, 0], plan: false }),
      cyl('metal', [bc[0], h - 0.428, bc[1]], 0.03, 0.004, o),
      ...[-0.15, 0.15].map((s) => {
        const p = oval(Math.PI / 2 + s);
        return rod('metal', [p[0], h + 0.004, p[1]], [p[0] + 0.05, h + 0.004, p[1] + 0.05], 0.007, o);
      }),
    ];
  },
  planDetail: ({ w, d }) => {
    const R = Math.min(w, d);
    return [poly([[-w / 2, -d / 2], ...arcPoints(-w / 2, -d / 2, R - 0.08, 0, Math.PI / 2, 12)])];
  },
});

const quadrantShower = defineItem({
  id: 'quadrant-shower',
  name: 'Quadrant shower enclosure',
  category: 'bathroom',
  type: 'plumbing',
  group: 'Showers & tubs',
  tags: tags('shower', 'phòng tắm kính', 'cabin tắm', 'quadrant', 'sliding doors', 'curved glass', 'corner shower'),
  description: 'Curved corner shower with two fixed and two sliding glass panels on a low stone tray, with a rain head and hand shower.',
  defaultSize: { w: 0.9, d: 0.9, h: 2.0 },
  minSize: { w: 0.8, d: 0.8, h: 1.9 },
  maxSize: { w: 1.0, d: 1.0, h: 2.1 },
  wallSnap: true,
  slots: [matSlot('tray', 'Tray', 'tile-white-square'), matSlot('glass', 'Glass', 'glass-clear'), matSlot('frame', 'Frame & fittings', 'metal-chrome')],
  build: ({ w, d, h }) => {
    const cx = -w / 2;
    const cz = -d / 2;
    const R = Math.min(w, d) - 0.01;
    const trayH = 0.045;
    const parts: Part[] = [
      prism('tray', [[cx, cz], [cx + R, cz], ...arcPoints(cx, cz, R, 0, Math.PI / 2, 16).slice(1, -1), [cx, cz + R]], 0, trayH),
      cyl('frame', [cx + R * 0.35, trayH + 0.001, cz + R * 0.35], 0.04, 0.003, o),
    ];
    const rr = R - 0.03;
    const y0 = trayH;
    const y1 = h - 0.02;
    parts.push(...arcPanels('glass', cx, cz, rr, 0, 0.42, y0 + 0.01, y1, 0.006, 3), ...arcPanels('glass', cx, cz, rr, Math.PI / 2 - 0.42, Math.PI / 2, y0 + 0.01, y1, 0.006, 3));
    parts.push(...arcPanels('glass', cx, cz, rr + 0.015, 0.38, Math.PI / 4 + 0.02, y0 + 0.02, y1 - 0.02, 0.006, 4), ...arcPanels('glass', cx, cz, rr + 0.015, Math.PI / 4 - 0.02, Math.PI / 2 - 0.38, y0 + 0.02, y1 - 0.02, 0.006, 4));
    for (const y of [y0 + 0.012, y1]) parts.push(...rodPath('frame', arcPoints(cx, cz, rr + 0.008, 0, Math.PI / 2, 10).map(([x, z]) => [x, y, z] as V3), 0.008));
    for (const a of [0, Math.PI / 2]) parts.push(span('frame', [cx + Math.cos(a) * rr - 0.015, cx + Math.cos(a) * rr + 0.015], [y0, y1], [cz + Math.sin(a) * rr - 0.015, cz + Math.sin(a) * rr + 0.015], o));
    for (const a of [Math.PI / 4 - 0.12, Math.PI / 4 + 0.12]) parts.push(vcyl('frame', cx + Math.cos(a) * (rr + 0.035), cz + Math.sin(a) * (rr + 0.035), 0.95, 1.2, 0.007, o));
    // Rain head on an arm, mixer and hand shower on the side wall.
    parts.push(rod('frame', [cx + 0.01, h - 0.15, cz + 0.25], [cx + 0.3, h - 0.15, cz + 0.25], 0.009, o), cyl('frame', [cx + 0.3, h - 0.16, cz + 0.25], 0.1, 0.012, o));
    parts.push(span('frame', [cx, cx + 0.05], [1.0, 1.1], [cz + 0.2, cz + 0.34], { bevel: 0.01, plan: false }), rod('frame', [cx + 0.03, 1.4, cz + 0.45], [cx + 0.07, 1.6, cz + 0.45], 0.013, { rTop: 0.032, ...o }));
    return parts;
  },
  planDetail: ({ w, d }) => {
    const R = Math.min(w, d) - 0.04;
    return [poly(arcPoints(-w / 2, -d / 2, R, 0, Math.PI / 2, 12), false), line([-w / 2 + R * 0.3, -d / 2 + R * 0.3], [-w / 2 + R * 0.4, -d / 2 + R * 0.4])];
  },
});

const gridScreen = defineItem({
  id: 'black-grid-walk-in',
  name: 'Black grid walk-in shower',
  category: 'bathroom',
  type: 'plumbing',
  group: 'Showers & tubs',
  tags: tags('walk-in shower', 'vách kính', 'crittall', 'black frame', 'industrial', 'wet room', 'rain shower'),
  description: 'Industrial walk-in shower: a fixed glass panel with a black steel grid, a ceiling brace, a linear drain and a black rain set.',
  defaultSize: { w: 1.2, d: 0.9, h: 2.1 },
  minSize: { w: 1.0, d: 0.8, h: 2.0 },
  maxSize: { w: 1.6, d: 1.2, h: 2.4 },
  wallSnap: true,
  slots: [matSlot('floor', 'Shower floor', 'stone-slate'), matSlot('glass', 'Glass', 'glass-clear'), matSlot('frame', 'Frame & fittings', 'metal-black-matte')],
  build: ({ w, d, h }) => {
    const zg = d / 2 - 0.02;
    const gx0 = -w / 2 + 0.02;
    const gx1 = w / 2 - 0.35;
    const y1 = Math.min(h - 0.1, 2.0);
    const parts: Part[] = [
      span('floor', [-w / 2, w / 2], [0, 0.02], [-d / 2, d / 2]),
      span('frame', [-w / 2 + 0.05, w / 2 - 0.05], [0.02, 0.023], [-d / 2 + 0.06, -d / 2 + 0.12], o),
      span('glass', [gx0, gx1], [0.03, y1], [zg - 0.004, zg + 0.004], o),
      span('frame', [gx0 - 0.02, gx1], [0.02, 0.05], [zg - 0.015, zg + 0.015]),
      span('frame', [-w / 2, gx0], [0.02, y1], [zg - 0.015, zg + 0.015], o),
      rod('frame', [gx1 - 0.01, y1, zg], [gx1 - 0.01, y1, -d / 2], 0.009, o),
    ];
    for (const x of spaced(4, gx0, gx1)) parts.push(span('frame', [x - 0.012, x + 0.012], [0.03, y1], [zg - 0.008, zg + 0.008], o));
    for (const y of spaced(5, 0.04, y1)) parts.push(span('frame', [gx0, gx1], [y - 0.012, y + 0.012], [zg - 0.008, zg + 0.008], o));
    const rx = -w / 2 + 0.35;
    parts.push(vcyl('frame', rx, -d / 2 + 0.03, 0.9, y1, 0.012, o), rod('frame', [rx, y1, -d / 2 + 0.03], [rx, y1, -d / 2 + 0.35], 0.01, o), cyl('frame', [rx, y1 - 0.01, -d / 2 + 0.35], 0.13, 0.008, o));
    parts.push(span('frame', [rx - 0.07, rx + 0.07], [0.95, 1.05], [-d / 2, -d / 2 + 0.06], { bevel: 0.01, plan: false }));
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w / 2, d / 2 - 0.02], [w / 2 - 0.35, d / 2 - 0.02]), line([-w / 2 + 0.05, -d / 2 + 0.09], [w / 2 - 0.05, -d / 2 + 0.09])],
});

// ---------------------------------------------------------------------------
// Wall fittings common in Vietnamese bathrooms
// ---------------------------------------------------------------------------

const bidetSpray = defineItem({
  id: 'bidet-spray',
  name: 'Toilet bidet spray (vòi xịt)',
  category: 'bathroom',
  type: 'plumbing',
  group: 'Bathroom accessories',
  tags: tags('bidet spray', 'vòi xịt', 'vòi xịt vệ sinh', 'shattaf', 'hand bidet', 'toilet sprayer'),
  description: 'The handheld toilet spray found beside almost every toilet in Vietnam: angle valve, braided hose and the spray head on its wall holder.',
  defaultSize: { w: 0.12, d: 0.09, h: 0.5 },
  minSize: { w: 0.1, d: 0.09, h: 0.4 },
  maxSize: { w: 0.16, d: 0.12, h: 0.6 },
  mount: 'wall',
  defaultElevation: 0.25,
  slots: [matSlot('metal', 'Valve & holder', 'metal-chrome'), matSlot('head', 'Spray head', 'plastic-white'), matSlot('hose', 'Hose', 'metal-brushed-steel')],
  build: ({ w, d, h }) => {
    const zb = -d / 2;
    const hy = h - 0.07;
    return [
      discZ('metal', [-w / 2 + 0.03, 0.05, zb + 0.004], 0.025, 0.008),
      rod('metal', [-w / 2 + 0.03, 0.05, zb + 0.008], [-w / 2 + 0.03, 0.05, zb + 0.045], 0.01, o),
      vcyl('metal', -w / 2 + 0.03, zb + 0.045, 0.03, 0.07, 0.012, o),
      rod('metal', [-w / 2 + 0.03, 0.07, zb + 0.045], [-w / 2 + 0.03, 0.09, zb + 0.06], 0.006, o),
      discZ('metal', [0.02, hy, zb + 0.004], 0.018, 0.008),
      span('metal', [0.005, 0.035], [hy - 0.01, hy + 0.01], [zb + 0.008, zb + 0.035], { bevel: 0.004, plan: false }),
      rod('head', [0.02, hy - 0.05, zb + 0.04], [0.02, hy + 0.03, zb + 0.06], 0.013, { rTop: 0.016, ...o }),
      rod('head', [0.02, hy + 0.03, zb + 0.06], [0.02, hy + 0.05, zb + 0.08], 0.016, { rTop: 0.012, ...o }),
      ...rodPath('hose', [[-w / 2 + 0.03, 0.07, zb + 0.045], [-0.01, 0.02, d / 2 - 0.01], [0.03, 0.1, d / 2 - 0.02], [0.02, hy - 0.05, zb + 0.04]], 0.005),
    ];
  },
});

const instantHeater = defineItem({
  id: 'instant-water-heater',
  name: 'Instant shower water heater',
  category: 'bathroom',
  type: 'plumbing',
  group: 'Water heating',
  tags: tags('instant water heater', 'máy nước nóng trực tiếp', 'shower heater', 'electric', 'rcd'),
  description: 'Compact electric instant heater (máy nước nóng trực tiếp) with a temperature dial, slide rail and hand shower: the classic Vietnamese shower setup.',
  defaultSize: { w: 0.3, d: 0.12, h: 1.25 },
  minSize: { w: 0.25, d: 0.1, h: 1.0 },
  maxSize: { w: 0.4, d: 0.15, h: 1.4 },
  mount: 'wall',
  defaultElevation: 0.75,
  slots: [matSlot('body', 'Heater', 'plastic-white'), matSlot('accent', 'Dial & panel', 'plastic-blue'), matSlot('metal', 'Rail & shower', 'metal-chrome'), matSlot('hose', 'Hose', 'metal-brushed-steel')],
  build: ({ w, d, h }) => {
    const zb = -d / 2;
    const hw = 0.11;
    const hx = -w / 2 + hw;
    const hy0 = 0.0;
    const hy1 = 0.34;
    const rx = w / 2 - 0.035;
    return [
      span('body', [hx - hw, hx + hw], [hy0, hy1], [zb, zb + 0.085], { bevel: 0.02 }),
      span('accent', [hx - hw * 0.7, hx + hw * 0.7], [hy1 - 0.13, hy1 - 0.03], [zb + 0.084, zb + 0.088], { plan: false }),
      cyl('accent', [hx, hy1 * 0.42, zb + 0.09], 0.028, 0.016, { rotation: [Math.PI / 2, 0, 0], plan: false }),
      sphere('body', [hx + hw * 0.6, hy1 - 0.15, zb + 0.087], 0.005, o),
      ...[-0.03, 0.03].map((x) => vcyl('metal', hx + x, zb + 0.04, hy0 - 0.0, hy0 + 0.02, 0.008, o)),
      vcyl('metal', rx, zb + 0.025, 0.25, h - 0.02, 0.011, o),
      ...[0.25, h - 0.02].map((y) => rod('metal', [rx, y, zb], [rx, y, zb + 0.025], 0.012, o)),
      span('metal', [rx - 0.02, rx + 0.02], [h * 0.72, h * 0.76], [zb + 0.025, zb + 0.05], { bevel: 0.005, plan: false }),
      rod('metal', [rx, h * 0.68, zb + 0.06], [rx, h * 0.84, zb + 0.09], 0.012, { rTop: 0.03, ...o }),
      ...rodPath('hose', [[hx, hy0 + 0.01, zb + 0.045], [hx + 0.02, hy0 - 0.0, d / 2 - 0.01], [rx - 0.02, 0.15, d / 2 - 0.02], [rx, h * 0.68, zb + 0.06]], 0.006),
    ];
  },
});

const exhaustFan = defineItem({
  id: 'ceiling-exhaust-fan',
  name: 'Ceiling exhaust fan',
  category: 'bathroom',
  type: 'electronics',
  group: 'Climate',
  tags: tags('exhaust fan', 'quạt thông gió', 'quạt hút âm trần', 'ventilation', 'ceiling'),
  description: 'Square ceiling-mounted bathroom exhaust fan (quạt hút âm trần) with a louvred grille.',
  defaultSize: { w: 0.3, d: 0.3, h: 0.05 },
  minSize: { w: 0.2, d: 0.2, h: 0.04 },
  maxSize: { w: 0.4, d: 0.4, h: 0.06 },
  mount: 'ceiling',
  defaultElevation: CEIL - 0.05,
  slots: [matSlot('grille', 'Grille', 'plastic-white'), matSlot('vent', 'Vent opening', 'solid-black')],
  build: ({ w, d, h }) => {
    const parts: Part[] = [span('grille', [-w / 2, w / 2], [h - 0.012, h], [-d / 2, d / 2], { bevel: 0.004 }), span('vent', [-w / 2 + 0.03, w / 2 - 0.03], [h - 0.03, h - 0.012], [-d / 2 + 0.03, d / 2 - 0.03], o)];
    for (const z of cells(7, -d / 2 + 0.035, d / 2 - 0.035)) parts.push(span('grille', [-w / 2 + 0.03, w / 2 - 0.03], [h - 0.03, h - 0.015], [z - 0.006, z + 0.006], { rotation: [0.4, 0, 0], plan: false }));
    parts.push(span('grille', [-w / 2 + 0.02, w / 2 - 0.02], [0, h - 0.03], [-d / 2 + 0.02, d / 2 - 0.02], o));
    return parts;
  },
});

// ---------------------------------------------------------------------------
// Mirrors and storage
// ---------------------------------------------------------------------------

const ledMirror = defineItem({
  id: 'round-led-mirror',
  name: 'Round backlit LED mirror',
  category: 'bathroom',
  type: 'decor',
  group: 'Mirrors',
  tags: tags('mirror', 'gương', 'gương đèn led', 'round', 'backlit', 'led'),
  description: 'Frameless round mirror with a warm LED halo glowing on the wall behind it.',
  defaultSize: { w: 0.7, d: 0.04, h: 0.7 },
  minSize: { w: 0.5, d: 0.04, h: 0.5 },
  maxSize: { w: 1.0, d: 0.05, h: 1.0 },
  resizable: { d: false },
  mount: 'wall',
  defaultElevation: 1.1,
  slots: [matSlot('mirror', 'Mirror', 'glass-mirror'), matSlot('light', 'LED halo', 'light-warm'), matSlot('back', 'Back plate', 'metal-anthracite')],
  build: ({ w, d, h }) => {
    const r = Math.min(w, h) / 2;
    const zb = -d / 2;
    return [
      discZ('light', [0, h / 2, zb + 0.004], r - 0.01, 0.008),
      discZ('back', [0, h / 2, zb + 0.018], r - 0.03, 0.02, o),
      discZ('mirror', [0, h / 2, d / 2 - 0.003], r, 0.006, o),
    ];
  },
  light: { color: '#ffe6c4', intensity: 0.5, distance: 2.5, y: 0.35, z: 0.03 },
});

const archedMirror = defineItem({
  id: 'arched-mirror-shelf',
  name: 'Arched mirror with shelf',
  category: 'bathroom',
  type: 'decor',
  group: 'Mirrors',
  tags: tags('mirror', 'gương', 'arched', 'arch', 'brass frame', 'shelf'),
  description: 'Tall arched mirror in a slim brass frame above a small oak shelf.',
  defaultSize: { w: 0.55, d: 0.13, h: 0.95 },
  minSize: { w: 0.4, d: 0.12, h: 0.7 },
  maxSize: { w: 0.8, d: 0.15, h: 1.3 },
  mount: 'wall',
  defaultElevation: 1.0,
  slots: [matSlot('mirror', 'Mirror', 'glass-mirror'), matSlot('frame', 'Frame', 'metal-brass'), matSlot('shelf', 'Shelf', 'wood-oak-light')],
  build: ({ w, d, h }) => {
    const zb = -d / 2;
    const shelfH = 0.025;
    const my0 = shelfH + 0.04;
    const r = w / 2;
    const arch = (inset: number): V2[] => [[-r + inset, my0 + inset], [r - inset, my0 + inset], ...arcPoints(0, h - r, r - inset, 0, Math.PI, 18).map(([x, y]) => [x, y] as V2)];
    const flat = (pts: V2[], z0: number, z1: number, slot: string): Part => ({ shape: 'prism', outline: pts.map(([x, y]) => [x, -y] as V2), height: z1 - z0, position: [0, 0, z0], rotation: [Math.PI / 2, 0, 0], slot, plan: false });
    return [
      flat(arch(0), zb, zb + 0.02, 'frame'),
      flat(arch(0.012), zb + 0.016, zb + 0.024, 'mirror'),
      span('shelf', [-r, r], [0, shelfH], [zb, d / 2], { bevel: 0.004 }),
      ...[-r * 0.6, r * 0.6].map((x) => span('frame', [x - 0.006, x + 0.006], [-0.0, shelfH], [zb, zb + 0.06], o)),
    ];
  },
});

const mirrorCabinet = defineItem({
  id: 'led-mirror-cabinet',
  name: 'LED mirror cabinet',
  category: 'bathroom',
  type: 'storage',
  group: 'Bathroom & laundry storage',
  tags: tags('mirror cabinet', 'tủ gương', 'medicine cabinet', 'led', 'storage'),
  description: 'Two-door mirror cabinet with glass shelves inside and a warm LED strip lighting the basin below.',
  defaultSize: { w: 0.8, d: 0.15, h: 0.7 },
  minSize: { w: 0.6, d: 0.13, h: 0.6 },
  maxSize: { w: 1.2, d: 0.18, h: 0.8 },
  mount: 'wall',
  defaultElevation: 1.15,
  slots: [matSlot('body', 'Cabinet', 'solid-white'), matSlot('mirror', 'Mirror doors', 'glass-mirror'), matSlot('light', 'LED strip', 'light-warm')],
  build: ({ w, d, h }) => {
    const zb = -d / 2;
    const zf = d / 2;
    return [
      span('body', [-w / 2, w / 2], [0.02, h], [zb, zf - 0.012]),
      span('light', [-w / 2 + 0.03, w / 2 - 0.03], [0, 0.02], [zf - 0.06, zf - 0.03], o),
      span('body', [-w / 2, w / 2], [0, 0.02], [zb, zf - 0.06]),
      span('mirror', [-w / 2 + 0.003, -0.002], [0.02, h - 0.003], [zf - 0.012, zf], o),
      span('mirror', [0.002, w / 2 - 0.003], [0.02, h - 0.003], [zf - 0.012, zf], o),
    ];
  },
  light: { color: '#ffe6c4', intensity: 0.45, distance: 2, y: 0.0, z: 0.03, kind: 'spot', angle: 1.0, penumbra: 0.7 },
});

const overToilet = defineItem({
  id: 'over-toilet-shelving',
  name: 'Over-toilet shelving unit',
  category: 'bathroom',
  type: 'storage',
  group: 'Bathroom & laundry storage',
  tags: tags('over the toilet', 'kệ bồn cầu', 'space saver', 'shelves', 'small bathroom'),
  description: 'Freestanding white frame that straddles the toilet with three shelves and a small cabinet on top, for towels and toiletries.',
  defaultSize: { w: 0.66, d: 0.26, h: 1.75 },
  minSize: { w: 0.55, d: 0.22, h: 1.55 },
  maxSize: { w: 0.8, d: 0.3, h: 1.9 },
  wallSnap: true,
  slots: [matSlot('frame', 'Frame', 'wood-painted-white'), matSlot('shelf', 'Shelves & door', 'wood-painted-white'), matSlot('items', 'Towels & items', 'fabric-sky')],
  build: ({ w, d, h }) => {
    const t = 0.03;
    const parts: Part[] = [];
    for (const sx of [-1, 1]) for (const z of [-d / 2 + t / 2, d / 2 - t / 2]) parts.push(span('frame', [sx * (w / 2) - (sx > 0 ? t : 0), sx * (w / 2) + (sx < 0 ? t : 0)], [0, h], [z - t / 2, z + t / 2]));
    const shelves = [h * 0.55, h * 0.68, h * 0.81];
    for (const y of shelves) parts.push(span('shelf', [-w / 2 + t, w / 2 - t], [y, y + 0.018], [-d / 2, d / 2], o));
    parts.push(span('shelf', [-w / 2 + t, w / 2 - t], [h * 0.84, h], [-d / 2, d / 2 - 0.005]), span('shelf', [-w / 2 + t + 0.005, w / 2 - t - 0.005], [h * 0.845, h - 0.005], [d / 2 - 0.005, d / 2 + 0.008], o));
    parts.push(...towelStack('items', -w * 0.18, shelves[0] + 0.018, 0, 0.24, d * 0.7, 3));
    for (const [i, x] of [0.08, 0.16, 0.24].entries()) parts.push(vcyl('items', x, 0, shelves[1] + 0.018, shelves[1] + 0.1 + i * 0.02, 0.025, o));
    return parts;
  },
});

const ladderShelf = defineItem({
  id: 'leaning-ladder-shelf',
  name: 'Bamboo leaning ladder shelf',
  category: 'bathroom',
  type: 'storage',
  group: 'Bathroom & laundry storage',
  tags: tags('ladder shelf', 'kệ thang', 'bamboo', 'tre', 'towel ladder', 'leaning'),
  description: 'Leaning bamboo ladder with three shelves narrowing towards the top, for rolled towels and baskets.',
  defaultSize: { w: 0.5, d: 0.36, h: 1.5 },
  minSize: { w: 0.4, d: 0.3, h: 1.2 },
  maxSize: { w: 0.7, d: 0.45, h: 1.8 },
  wallSnap: true,
  slots: [matSlot('bamboo', 'Bamboo', 'wood-oak-light'), matSlot('items', 'Towels & baskets', 'fabric-white-cotton')],
  build: ({ w, d, h }) => {
    const parts: Part[] = [];
    const lean = d - 0.04;
    for (const sx of [-1, 1]) {
      parts.push(rod('bamboo', [sx * (w / 2 - 0.02), 0, d / 2 - 0.02], [sx * (w / 2 - 0.02), h, -d / 2 + 0.02], 0.016, { segments: 10 }));
      parts.push(rod('bamboo', [sx * (w / 2 - 0.02), 0, -d / 2 + 0.03], [sx * (w / 2 - 0.02), h * 0.98, -d / 2 + 0.02], 0.012, { segments: 8, plan: false }));
    }
    for (const [i, f] of [0.18, 0.47, 0.74].entries()) {
      const zf = d / 2 - 0.02 - lean * f;
      const sd = Math.max(0.08, zf - (-d / 2 + 0.03));
      parts.push(span('bamboo', [-w / 2 + 0.03, w / 2 - 0.03], [h * f - 0.012, h * f], [zf - sd, zf], o));
      if (i === 0) parts.push(towelRoll('items', [-0.08, h * f + 0.04, zf - sd / 2], 0.18, 0.04), towelRoll('items', [0.1, h * f + 0.04, zf - sd / 2], 0.18, 0.04));
    }
    return parts;
  },
});

const hamper = defineItem({
  id: 'wicker-laundry-hamper',
  name: 'Wicker laundry hamper',
  category: 'bathroom',
  type: 'storage',
  group: 'Baskets & boxes',
  tags: tags('laundry basket', 'giỏ đựng đồ', 'hamper', 'wicker', 'mây', 'rattan'),
  description: 'Woven rattan laundry hamper with a lid, side handles and a cotton liner.',
  defaultSize: { w: 0.45, d: 0.35, h: 0.6 },
  minSize: { w: 0.35, d: 0.28, h: 0.45 },
  maxSize: { w: 0.6, d: 0.45, h: 0.75 },
  slots: [matSlot('basket', 'Basket', 'rattan-natural'), matSlot('liner', 'Liner', 'fabric-linen')],
  build: ({ w, d, h }) => {
    const parts: Part[] = [prism('basket', roundRectPoints(0, 0, w * 0.92, d * 0.92, 0.06, 4), 0, 0.01), prism('basket', roundRectPoints(0, 0, w - 0.01, d - 0.01, 0.07, 4), 0.01, h - 0.06)];
    for (const y of spaced(5, 0.06, h - 0.1)) parts.push(prism('basket', roundRectPoints(0, 0, w, d, 0.075, 4), y, 0.012, o));
    parts.push(prism('liner', roundRectPoints(0, 0, w + 0.004, d + 0.004, 0.076, 4), h - 0.09, 0.03, o));
    parts.push(prism('basket', roundRectPoints(0, 0, w, d, 0.075, 4), h - 0.06, 0.04, o));
    parts.push(lathe('basket', [0, h - 0.02, 0], [[0, 0], [0.025, 0], [0.02, 0.02], [0, 0.02]], { segments: 12, plan: false }));
    for (const s of [-1, 1]) parts.push(torus('basket', [s * (w / 2 - 0.005), h - 0.13, 0], 0.035, 0.007, { arc: Math.PI, rotation: [0, Math.PI / 2, 0], plan: false }));
    return parts;
  },
});

const teakStool = defineItem({
  id: 'teak-shower-stool',
  name: 'Teak shower stool',
  category: 'bathroom',
  type: 'seating',
  group: 'Stools & benches',
  tags: tags('stool', 'ghế tắm', 'teak', 'shower seat', 'gỗ'),
  description: 'Slatted teak stool that is happy in the wet: a seat in the shower or a stand for towels.',
  defaultSize: { w: 0.45, d: 0.3, h: 0.45 },
  minSize: { w: 0.35, d: 0.26, h: 0.4 },
  maxSize: { w: 0.6, d: 0.36, h: 0.5 },
  slots: [matSlot('wood', 'Teak', 'wood-teak')],
  build: ({ w, d, h }) => {
    const parts: Part[] = [];
    for (const z of cells(5, -d / 2, d / 2)) parts.push(span('wood', [-w / 2, w / 2], [h - 0.022, h], [z - d / 12, z + d / 12], { bevel: 0.004 }));
    for (const sx of [-1, 1]) {
      parts.push(span('wood', [sx * (w / 2 - 0.03) - 0.02, sx * (w / 2 - 0.03) + 0.02], [0, h - 0.022], [-d / 2 + 0.02, d / 2 - 0.02]));
      parts.push(span('wood', [sx * (w / 2 - 0.03) - 0.012, sx * (w / 2 - 0.03) + 0.012], [0.12, 0.15], [-d / 2 + 0.02, d / 2 - 0.02], o));
    }
    parts.push(span('wood', [-w / 2 + 0.05, w / 2 - 0.05], [0.12, 0.15], [-0.012, 0.012], o));
    return parts;
  },
});

const teakMat = defineItem({
  id: 'teak-bath-mat',
  name: 'Slatted teak bath mat',
  category: 'bathroom',
  type: 'decor',
  group: 'Rugs',
  tags: tags('bath mat', 'thảm', 'teak', 'duckboard', 'slatted'),
  description: 'Low slatted teak duckboard to step out onto, raised on two runners so it dries fast.',
  defaultSize: { w: 0.8, d: 0.5, h: 0.035 },
  minSize: { w: 0.5, d: 0.35, h: 0.03 },
  maxSize: { w: 1.2, d: 0.7, h: 0.04 },
  slots: [matSlot('wood', 'Teak', 'wood-teak')],
  build: ({ w, d, h }) => {
    const n = Math.max(5, Math.round(d / 0.06));
    const parts: Part[] = cells(n, -d / 2, d / 2).map((z) => span('wood', [-w / 2, w / 2], [h - 0.015, h], [z - (d / n) * 0.38, z + (d / n) * 0.38], { bevel: 0.003 }));
    for (const x of [-w / 2 + 0.06, w / 2 - 0.06]) parts.push(span('wood', [x - 0.02, x + 0.02], [0, h - 0.015], [-d / 2 + 0.01, d / 2 - 0.01], o));
    return parts;
  },
});

const towelShelf = defineItem({
  id: 'towel-shelf',
  name: 'Towel shelf with rail',
  category: 'bathroom',
  type: 'plumbing',
  group: 'Bathroom accessories',
  tags: tags('towel rack', 'giá treo khăn', 'kệ khăn', 'hotel shelf', 'chrome'),
  description: 'Hotel-style chrome shelf with a towel rail underneath, with folded and hanging towels.',
  defaultSize: { w: 0.6, d: 0.24, h: 0.3 },
  minSize: { w: 0.45, d: 0.2, h: 0.25 },
  maxSize: { w: 0.8, d: 0.28, h: 0.35 },
  mount: 'wall',
  defaultElevation: 1.4,
  slots: [matSlot('metal', 'Rack', 'metal-chrome'), matSlot('towel', 'Towels', 'fabric-white-cotton')],
  build: ({ w, d, h }) => {
    const zb = -d / 2;
    const parts: Part[] = [];
    const sy = h - 0.1;
    for (const z of spaced(6, zb + 0.02, d / 2 - 0.01)) parts.push(rod('metal', [-w / 2, sy, z], [w / 2, sy, z], 0.005, { segments: 8 }));
    for (const s of [-1, 1]) {
      parts.push(discZ('metal', [s * (w / 2 - 0.03), sy, zb + 0.004], 0.022, 0.008), rod('metal', [s * (w / 2 - 0.03), sy, zb + 0.008], [s * (w / 2 - 0.03), sy, d / 2 - 0.01], 0.007, o));
      parts.push(rod('metal', [s * (w / 2 - 0.03), sy, zb + 0.05], [s * (w / 2 - 0.03), h * 0.25, zb + 0.08], 0.006, o));
    }
    parts.push(rod('metal', [-w / 2 + 0.03, h * 0.25, zb + 0.08], [w / 2 - 0.03, h * 0.25, zb + 0.08], 0.008, o));
    parts.push(...towelStack('towel', -w * 0.18, sy + 0.005, 0, 0.26, d * 0.8, 3));
    parts.push(span('towel', [-w * 0.35, w * 0.25], [0, h * 0.25 + 0.012], [zb + 0.07, zb + 0.09], { bevel: 0.005, plan: false }));
    return parts;
  },
});

const cornerCaddy = defineItem({
  id: 'corner-shower-caddy',
  name: 'Corner shower caddy',
  category: 'bathroom',
  type: 'plumbing',
  group: 'Bathroom accessories',
  tags: tags('shower caddy', 'kệ góc', 'kệ nhà tắm', 'corner shelf', 'black', 'toiletries'),
  description: 'Three-tier black wire corner shelf with shampoo bottles, soap and a sponge.',
  defaultSize: { w: 0.25, d: 0.25, h: 0.6 },
  minSize: { w: 0.2, d: 0.2, h: 0.4 },
  maxSize: { w: 0.32, d: 0.32, h: 0.8 },
  mount: 'wall',
  defaultElevation: 1.0,
  slots: [matSlot('metal', 'Shelf', 'metal-black-matte'), matSlot('bottles', 'Bottles', 'plastic-mint'), matSlot('caps', 'Caps & soap', 'plastic-white')],
  build: ({ w, d, h }) => {
    const cx = -w / 2;
    const cz = -d / 2;
    const R = Math.min(w, d);
    const parts: Part[] = [];
    const tiers = [0.02, h * 0.45, h - 0.04];
    for (const y of tiers) {
      parts.push(prism('metal', [[cx, cz], ...arcPoints(cx, cz, R, 0, Math.PI / 2, 10)], y, 0.006, { plan: y === tiers[0] }));
      parts.push(...rodPath('metal', arcPoints(cx, cz, R - 0.004, 0, Math.PI / 2, 10).map(([x, z]) => [x, y + 0.03, z] as V3), 0.003));
    }
    parts.push(vcyl('metal', cx + 0.01, cz + 0.01, 0, h, 0.006, o));
    const spots: [number, number, number, number][] = [
      [0.06, 0.05, 0.022, 0.17],
      [0.12, 0.04, 0.02, 0.14],
      [0.05, 0.11, 0.024, 0.19],
    ];
    for (const [x, z, r, bh] of spots) {
      const H = Math.min(bh, tiers[1] - tiers[0] - 0.04);
      parts.push(vcyl('bottles', cx + x, cz + z, tiers[0] + 0.006, tiers[0] + 0.006 + H, r, o), vcyl('caps', cx + x, cz + z, tiers[0] + 0.006 + H, tiers[0] + 0.03 + H, r * 0.55, o));
    }
    parts.push(span('caps', [cx + 0.05, cx + 0.12], [tiers[1] + 0.006, tiers[1] + 0.03], [cz + 0.03, cz + 0.08], { bevel: 0.008, plan: false }));
    parts.push(ball('bottles', [cx + 0.045, tiers[1] + 0.032, cz + 0.13], 0.03, { scale: [1, 0.8, 1] }));
    return parts;
  },
});

const brushSet = defineItem({
  id: 'toilet-brush-holder',
  name: 'Toilet brush holder',
  category: 'bathroom',
  type: 'plumbing',
  group: 'Bathroom accessories',
  tags: tags('toilet brush', 'chổi cọ bồn cầu', 'cọ toilet', 'holder'),
  description: 'Freestanding ceramic toilet brush pot with a slim steel-handled brush.',
  defaultSize: { w: 0.11, d: 0.11, h: 0.4 },
  minSize: { w: 0.09, d: 0.09, h: 0.32 },
  maxSize: { w: 0.14, d: 0.14, h: 0.45 },
  slots: [matSlot('pot', 'Holder', 'ceramic-white'), matSlot('handle', 'Handle', 'metal-brushed-steel')],
  build: ({ w, d, h }) => {
    const r = Math.min(w, d) / 2;
    return [lathe('pot', [0, 0, 0], [[0, 0], [r, 0], [r, 0.14], [r * 0.85, 0.15], [r * 0.82, 0.02], [0, 0.02]], { segments: 28 }), vcyl('handle', 0, 0, 0.05, h - 0.012, 0.007, o), sphere('handle', [0, h - 0.012, 0], 0.012, o)];
  },
});

const pedalBin = defineItem({
  id: 'pedal-bin',
  name: 'Pedal bin',
  category: 'bathroom',
  type: 'plumbing',
  group: 'Bathroom accessories',
  tags: tags('bin', 'thùng rác', 'pedal bin', 'trash can', 'soft close'),
  description: 'Small round steel pedal bin with a soft-close lid for the bathroom.',
  defaultSize: { w: 0.24, d: 0.28, h: 0.33 },
  minSize: { w: 0.2, d: 0.24, h: 0.27 },
  maxSize: { w: 0.3, d: 0.36, h: 0.45 },
  slots: [matSlot('body', 'Body', 'metal-brushed-steel'), matSlot('trim', 'Lid trim & pedal', 'plastic-black')],
  build: ({ w, d, h }) => {
    const r = Math.min(w, d - 0.04) / 2;
    const zc = -0.02;
    return [
      lathe('body', [0, 0.012, zc], [[0, 0], [r * 0.96, 0], [r, 0.02], [r, h - 0.05], [0, h - 0.05]], { segments: 32 }),
      cyl('trim', [0, 0.006, zc], r * 0.95, 0.012),
      lathe('body', [0, h - 0.038, zc], [[0, 0], [r * 1.01, 0], [r * 0.9, 0.025], [0, 0.038]], { segments: 32, plan: false }),
      ring('trim', [0, h - 0.038, zc], r, 0.005, o),
      span('trim', [-0.04, 0.04], [0.004, 0.02], [zc + r - 0.01, d / 2], { bevel: 0.005, plan: false }),
    ];
  },
});

const columnRadiator = defineItem({
  id: 'column-radiator',
  name: 'Vertical column radiator',
  category: 'bathroom',
  type: 'structure',
  group: 'Heating',
  tags: tags('radiator', 'towel radiator', 'heating', 'anthracite', 'vertical'),
  description: 'Tall anthracite column radiator with chrome valves, doubling as a towel warmer.',
  defaultSize: { w: 0.45, d: 0.1, h: 1.8 },
  minSize: { w: 0.3, d: 0.08, h: 1.2 },
  maxSize: { w: 0.7, d: 0.12, h: 2.0 },
  mount: 'wall',
  defaultElevation: 0.1,
  slots: [matSlot('metal', 'Radiator', 'metal-anthracite'), matSlot('valves', 'Valves', 'metal-chrome')],
  build: ({ w, d, h }) => {
    const n = Math.max(4, Math.round(w / 0.065));
    const parts: Part[] = cells(n, -w / 2, w / 2).map((x) => span('metal', [x - 0.022, x + 0.022], [0.02, h - 0.02], [-d / 2 + 0.035, d / 2 - 0.005], { bevel: 0.008 }));
    parts.push(span('metal', [-w / 2, w / 2], [0.02, 0.06], [-d / 2 + 0.035, -d / 2 + 0.06], o), span('metal', [-w / 2, w / 2], [h - 0.06, h - 0.02], [-d / 2 + 0.035, -d / 2 + 0.06], o));
    for (const y of [0.25, h - 0.25]) parts.push(...[-1, 1].map((s) => rod('metal', [s * (w / 2 - 0.05), y, -d / 2], [s * (w / 2 - 0.05), y, -d / 2 + 0.035], 0.008, o)));
    parts.push(vcyl('valves', -w / 2 + 0.03, -d / 2 + 0.05, 0, 0.05, 0.012, o), sphere('valves', [-w / 2 + 0.03, 0.06, -d / 2 + 0.05], 0.018, o), vcyl('valves', w / 2 - 0.03, -d / 2 + 0.05, 0, 0.05, 0.012, o));
    return parts;
  },
});

export default definePack({
  name: 'Bathroom collection',
  version: '1.0.0',
  author: 'Neest team',
  description:
    'Twenty-five bathroom pieces: vanities and basins, freestanding, alcove and corner baths, shower enclosures, the Vietnamese essentials (vòi xịt, instant water heater, exhaust fan), mirrors, storage and accessories.',
  license: 'CC0 (made for Neest)',
  items: [
    vanityVessel,
    openDoubleVanity,
    cornerBasin,
    ovalBath,
    bathFiller,
    alcoveBath,
    cornerBath,
    quadrantShower,
    gridScreen,
    bidetSpray,
    instantHeater,
    exhaustFan,
    ledMirror,
    archedMirror,
    mirrorCabinet,
    overToilet,
    ladderShelf,
    hamper,
    teakStool,
    teakMat,
    towelShelf,
    cornerCaddy,
    brushSet,
    pedalBin,
    columnRadiator,
  ],
});


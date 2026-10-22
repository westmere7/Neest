import type { AssetDefinition, Part, PlanStroke, Size3 } from './types';
import {
  barPull,
  cells,
  circle,
  clamp,
  cyl,
  defineAsset,
  discZ,
  ellipsePoints,
  frame4,
  knob,
  lathe,
  legs4,
  line,
  matSlot,
  poly,
  range,
  rectPoly,
  ring,
  rod,
  rodPath,
  rodX,
  rodZ,
  roundRectPoints,
  shakerFront,
  slats,
  spaced,
  span,
  sphere,
  torus,
  vcyl,
  type V2,
  type V3,
} from './parts';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Prism whose outline (`xy`, as [x, y] points) lies in the XY plane, extruded along Z over `z`.
 * Used for flat shapes seen from the front, such as rounded mirrors.
 */
function frontProfile(slot: string, xy: V2[], z: V2, plan = false): Part {
  const p: Part = {
    shape: 'prism',
    outline: xy.map(([x, y]) => [x, y] as V2),
    height: Math.max(0.002, z[1] - z[0]),
    position: [0, 0, z[1]],
    rotation: [-Math.PI / 2, 0, 0],
    slot,
  };
  if (!plan) p.plan = false;
  return p;
}

/** Deck mixer: base, round body, forward spout with outlet and a top lever pointing back. */
function mixerTap(slot: string, x: number, zt: number, yBase: number, yTop: number, reach: number): Part[] {
  const o = { plan: false };
  return [
    vcyl(slot, x, zt, yBase, yBase + 0.008, 0.024, o),
    vcyl(slot, x, zt, yBase + 0.008, yTop - 0.02, 0.015, o),
    sphere(slot, [x, yTop - 0.02, zt], 0.015, o),
    rodZ(slot, x, yTop - 0.035, zt, zt + reach, 0.009, o),
    vcyl(slot, x, zt + reach, yTop - 0.05, yTop - 0.03, 0.0105, o),
    rod(slot, [x, yTop - 0.014, zt], [x, yTop - 0.003, zt - 0.03], 0.006, o),
  ];
}

// ---------------------------------------------------------------------------
// Bidet
// ---------------------------------------------------------------------------

const bidet = defineAsset({
  id: 'bidet',
  name: 'Bidet',
  category: 'bathroom',
  type: 'plumbing',
  group: 'Toilets',
  tags: ['bidet', 'washlet', 'bathroom', 'ceramic'],
  defaultSize: { w: 0.36, d: 0.54, h: 0.52 },
  minSize: { w: 0.34, d: 0.5, h: 0.48 },
  maxSize: { w: 0.4, d: 0.6, h: 0.58 },
  wallSnap: true,
  slots: [matSlot('ceramic', 'Ceramic', 'ceramic-white'), matSlot('tap', 'Tap', 'metal-chrome')],
  build: ({ w, d, h }) => {
    const rim = h - 0.11;
    const rx = w / 2 - 0.005;
    const rz = d / 2 - 0.03;
    const bz = 0.03;
    const zt = -d / 2 + 0.06;
    const o = { plan: false };
    return [
      lathe('ceramic', [0, 0, bz], [
        [0, 0],
        [0.62, 0],
        [0.66, 0.015],
        [0.56, 0.12],
        [0.6, rim * 0.55],
        [0.85, rim * 0.82],
        [0.98, rim - 0.02],
        [1, rim],
        [0.88, rim],
        [0.75, rim - 0.06],
        [0.5, rim - 0.16],
        [0, rim - 0.18],
      ], { scale: [rx, 1, rz], segments: 36 }),
      span('ceramic', [-rx * 0.55, rx * 0.55], [rim - 0.1, rim + 0.012], [-d / 2, -d / 2 + 0.12], { bevel: 0.012 }),
      ...mixerTap('tap', 0, zt, rim + 0.012, h, 0.08),
      vcyl('tap', 0.035, zt, rim + 0.012, rim + 0.05, 0.004, o),
      sphere('tap', [0.035, rim + 0.05, zt], 0.007, o),
      cyl('tap', [0, rim - 0.177, bz], 0.018, 0.004, o),
    ];
  },
  planDetail: ({ w, d }) => [poly(ellipsePoints(0, 0.03, (w / 2) * 0.82, (d / 2 - 0.03) * 0.82)), circle([0, 0.03], 0.018)],
});

// ---------------------------------------------------------------------------
// Basins & vanities
// ---------------------------------------------------------------------------

function vanityLayout(w: number, d: number, h: number, n?: number) {
  const nn = n ?? (w >= 1.2 ? 2 : 1);
  const R = Math.min(0.2, (w / nn) * 0.36, d * 0.38);
  const bz = 0.02;
  return { ct: h - 0.25, n: nn, R, bz, zt: bz - R - 0.04, xs: cells(nn, -w / 2, w / 2) };
}

/**
 * Vanity unit. `legs`: furniture style on legs with an open towel shelf and vessel basins;
 * otherwise a plinth-based cabinet with semi-recessed basins. Slots: cabinet, top, basin, tap.
 */
function vanityParts({ w, d, h }: Size3, legs: boolean): Part[] {
  const L = vanityLayout(w, d, h, legs ? 2 : undefined);
  const o = { plan: false };
  const ft = 0.02;
  const zf = d / 2 - ft - 0.022;
  const zs = zf + ft;
  const ctop = L.ct - 0.03;
  const parts: Part[] = [span('top', [-w / 2, w / 2], [ctop, L.ct], [-d / 2, d / 2], { bevel: 0.004 })];
  let y0: number;
  if (legs) {
    // Drawer bank on four legs above an open shelf of rolled towels.
    y0 = Math.max(0.3, ctop - 0.36);
    parts.push(span('cabinet', [-w / 2, w / 2], [y0, ctop], [-d / 2, zf]));
    parts.push(...legs4('cabinet', w, zf + d / 2, 0, 0, y0, 0.045).map((p) => ({ ...p, position: [p.position[0], p.position[1], p.position[2] + (zf - d / 2) / 2] as V3 })));
    const sy = 0.11;
    parts.push(span('cabinet', [-w / 2 + 0.045, w / 2 - 0.045], [sy - 0.022, sy], [-d / 2 + 0.01, zf - 0.01], o));
    const tr = 0.045;
    const k = clamp(Math.floor((w - 0.15) / (2 * tr + 0.012)), 2, 9);
    const tx = cells(k, -w / 2 + 0.06, w / 2 - 0.06);
    const tz: V2 = [-d / 2 + 0.05, Math.min(zf - 0.02, -d / 2 + 0.36)];
    tx.forEach((x) => parts.push(rodZ('basin', x, sy + tr, tz[0], tz[1], tr, o)));
    for (let i = 0; i + 1 < tx.length; i += 2) parts.push(rodZ('basin', (tx[i] + tx[i + 1]) / 2, sy + tr * 2.7, tz[0], tz[1], tr, o));
  } else {
    y0 = 0.12;
    parts.push(span('cabinet', [-w / 2 + 0.01, w / 2 - 0.01], [0, y0], [-d / 2, zf - 0.05], o));
    parts.push(span('cabinet', [-w / 2, w / 2], [y0, ctop], [-d / 2, zf]));
  }
  // Drawers: a shallow one over a deep one in each column.
  const cols = legs ? clamp(Math.round(w / 0.5), 2, 4) : w >= 1.1 ? 2 : 1;
  const split = y0 + (ctop - y0) * 0.58;
  for (const x of cells(cols, -w / 2, w / 2)) {
    const cw = w / cols;
    const xr: V2 = [x - cw / 2, x + cw / 2];
    for (const y of [[y0, split] as V2, [split, ctop] as V2]) {
      parts.push(...shakerFront('cabinet', xr, y, zf, ft, { rail: clamp(Math.min(cw, y[1] - y[0]) * 0.14, 0.03, 0.06) }));
      parts.push(...barPull('tap', [x, y[1] - Math.min(0.06, (y[1] - y[0]) / 2), zs], clamp(cw * 0.4, 0.08, 0.2), { stand: 0.018 }));
    }
  }
  const R = L.R;
  for (const x of L.xs) {
    if (legs) {
      parts.push(
        lathe('basin', [x, L.ct, L.bz], [
          [0, 0],
          [R * 0.45, 0],
          [R * 0.8, 0.03],
          [R * 0.98, 0.08],
          [R, 0.12],
          [R - 0.01, 0.12],
          [R * 0.85, 0.075],
          [R * 0.45, 0.02],
          [0, 0.015],
        ], { segments: 40 }),
      );
      parts.push(cyl('tap', [x, L.ct + 0.017, L.bz], 0.018, 0.004, o));
    } else {
      parts.push(
        lathe('basin', [x, L.ct, L.bz], [
          [0, 0],
          [R * 0.55, 0],
          [R * 0.85, 0.03],
          [R * 0.98, 0.09],
          [R, 0.13],
          [R - 0.012, 0.13],
          [R * 0.86, 0.08],
          [R * 0.5, 0.035],
          [0, 0.03],
        ], { segments: 40 }),
      );
      parts.push(cyl('tap', [x, L.ct + 0.032, L.bz], 0.018, 0.004, o));
    }
    parts.push(...mixerTap('tap', x, L.zt, L.ct, h, R * 0.8));
  }
  // Soap dispenser on the counter where there is room.
  const sx = L.n === 2 ? 0 : (L.xs[0] + R + w / 2) / 2;
  const room = L.n === 2 ? L.xs[1] - L.xs[0] - 2 * R : w / 2 - L.xs[0] - R;
  if (room > 0.09) {
    parts.push(
      lathe('basin', [sx, L.ct, L.bz - 0.02], [
        [0, 0],
        [0.032, 0],
        [0.034, 0.09],
        [0.016, 0.11],
        [0, 0.11],
      ], { segments: 20, plan: false }),
      vcyl('tap', sx, L.bz - 0.02, L.ct + 0.11, L.ct + 0.14, 0.007, o),
      rodZ('tap', sx, L.ct + 0.135, L.bz - 0.02, L.bz + 0.015, 0.004, o),
    );
  }
  return parts;
}

function vanityPlan({ w, d, h }: Size3, legs: boolean): PlanStroke[] {
  const L = vanityLayout(w, d, h, legs ? 2 : undefined);
  const strokes: PlanStroke[] = [];
  for (const x of L.xs) {
    strokes.push(circle([x, L.bz], L.R - 0.012), circle([x, L.bz], 0.02), circle([x, L.zt], 0.014));
  }
  return strokes;
}

const VANITY_SLOTS = {
  top: matSlot('top', 'Countertop', 'stone-marble-carrara'),
  basin: matSlot('basin', 'Basin', 'ceramic-white'),
};

const vanity = defineAsset({
  id: 'vanity-basin',
  name: 'Vanity with basin',
  category: 'bathroom',
  type: 'plumbing',
  group: 'Sinks',
  tags: ['vanity', 'basin', 'sink', 'washbasin', 'bathroom cabinet'],
  defaultSize: { w: 0.8, d: 0.48, h: 1.05 },
  minSize: { w: 0.5, d: 0.38, h: 0.95 },
  maxSize: { w: 1.6, d: 0.6, h: 1.2 },
  wallSnap: true,
  slots: [matSlot('cabinet', 'Cabinet', 'wood-oak-light'), VANITY_SLOTS.top, VANITY_SLOTS.basin, matSlot('tap', 'Tap & pulls', 'metal-chrome')],
  build: (size) => vanityParts(size, false),
  planDetail: (size) => vanityPlan(size, false),
});

const vanityDouble = defineAsset({
  id: 'vanity-double',
  name: 'Double vanity',
  category: 'bathroom',
  type: 'plumbing',
  group: 'Sinks',
  tags: ['vanity', 'double', 'his and hers', 'two basins', 'vessel basin', 'washstand'],
  defaultSize: { w: 1.4, d: 0.5, h: 1.05 },
  minSize: { w: 1.2, d: 0.45, h: 0.98 },
  maxSize: { w: 2.0, d: 0.6, h: 1.15 },
  wallSnap: true,
  slots: [
    matSlot('cabinet', 'Cabinet', 'wood-walnut'),
    VANITY_SLOTS.top,
    matSlot('basin', 'Basins & towels', 'ceramic-white'),
    matSlot('tap', 'Taps & pulls', 'metal-brass'),
  ],
  build: (size) => vanityParts(size, true),
  planDetail: (size) => vanityPlan(size, true),
});

// ---------------------------------------------------------------------------
// Showers & tubs
// ---------------------------------------------------------------------------

const shower = defineAsset({
  id: 'shower-tray',
  name: 'Shower tray with glass screen',
  category: 'bathroom',
  type: 'plumbing',
  group: 'Showers & tubs',
  tags: ['shower', 'shower tray', 'screen', 'enclosure', 'rain shower'],
  defaultSize: { w: 0.9, d: 0.9, h: 2.0 },
  minSize: { w: 0.7, d: 0.7, h: 1.8 },
  maxSize: { w: 1.8, d: 1.4, h: 2.3 },
  wallSnap: true,
  slots: [
    matSlot('tray', 'Tray & bottles', 'ceramic-white'),
    matSlot('glass', 'Glass', 'glass-clear'),
    matSlot('metal', 'Fittings', 'metal-chrome'),
  ],
  build: ({ w, d, h }) => {
    const trayH = 0.04;
    const gw = clamp(w * 0.6, 0.5, w - 0.1);
    const zg = d / 2 - 0.025;
    const headZ = -d / 2 + Math.min(0.3, d * 0.35);
    const headR = Math.min(0.12, w * 0.15, d * 0.15);
    const zw = -d / 2 + 0.02;
    const hx = w / 2 - 0.12;
    const o = { plan: false };
    const parts: Part[] = [
      span('tray', [-w / 2, w / 2], [0, trayH], [-d / 2, d / 2], { bevel: 0.006 }),
      cyl('metal', [0, trayH + 0.001, 0], 0.045, 0.003, o),
      ...slats('metal', [-0.03, 0.03], [trayH + 0.002, trayH + 0.004], [-0.025, 0.025], 5, { axis: 'z', gap: 0.5, plan: false }),
      // Fixed glass screen with wall profile, bottom channel and stabiliser bar.
      span('glass', [-w / 2 + 0.02, -w / 2 + gw], [trayH, h - 0.02], [zg - 0.004, zg + 0.004]),
      span('metal', [-w / 2, -w / 2 + 0.02], [trayH, h - 0.02], [zg - 0.01, zg + 0.01], o),
      span('metal', [-w / 2 + 0.02, -w / 2 + gw], [trayH, trayH + 0.02], [zg - 0.008, zg + 0.008], o),
      rodZ('metal', -w / 2 + gw - 0.03, h - 0.03, -d / 2, zg - 0.005, 0.01, o),
      // Rain head on its riser.
      vcyl('metal', 0, zw, 0.9, h - 0.05, 0.012, o),
      rodZ('metal', 0, h - 0.05, -d / 2, headZ, 0.01, o),
      cyl('metal', [0, h - 0.065, headZ], headR, 0.012, { segments: 32, plan: false }),
      // Thermostatic mixer bar.
      rodX('metal', -0.15, 0.15, 1.0, zw + 0.03, 0.026, o),
      rodX('metal', -0.17, -0.13, 1.0, zw + 0.03, 0.03, o),
      rodX('metal', 0.13, 0.17, 1.0, zw + 0.03, 0.03, o),
      rodZ('metal', -0.1, 1.0, -d / 2, zw + 0.01, 0.012, o),
      rodZ('metal', 0.1, 1.0, -d / 2, zw + 0.01, 0.012, o),
      // Hand shower on a slide rail with its hose.
      vcyl('metal', hx, zw, 1.05, 1.75, 0.01, o),
      rodZ('metal', hx, 1.08, -d / 2, zw, 0.006, o),
      rodZ('metal', hx, 1.72, -d / 2, zw, 0.006, o),
      span('metal', [hx - 0.02, hx + 0.02], [1.5, 1.54], [zw, zw + 0.03], { bevel: 0.006, plan: false }),
      rod('metal', [hx, 1.42, zw + 0.04], [hx, 1.6, zw + 0.06], 0.013, o),
      cyl('metal', [hx, 1.62, zw + 0.075], 0.04, 0.02, { rotation: [1.2, 0, 0], segments: 24, plan: false }),
      ...rodPath('metal', [
        [hx, 1.42, zw + 0.04],
        [hx - 0.02, 1.15, zw + 0.06],
        [hx - 0.06, 1.0, zw + 0.06],
        [0.16, 1.0, zw + 0.03],
      ], 0.006),
    ];
    // Wire basket with bottles in the back-left corner.
    const bx0 = -w / 2 + 0.03;
    const by = 1.2;
    parts.push(span('metal', [bx0, bx0 + 0.2], [by, by + 0.006], [-d / 2, -d / 2 + 0.11], o));
    parts.push(rodX('metal', bx0, bx0 + 0.2, by + 0.04, -d / 2 + 0.11, 0.004, o));
    parts.push(rodX('metal', bx0, bx0 + 0.2, by + 0.015, -d / 2 + 0.11, 0.004, o));
    [0.035, 0.09, 0.15].forEach((x, i) => {
      const bh = [0.18, 0.15, 0.12][i];
      parts.push(cyl('tray', [bx0 + x, by + 0.006 + bh / 2, -d / 2 + 0.055], 0.026, bh, { segments: 18, plan: false }));
      parts.push(cyl('metal', [bx0 + x, by + 0.006 + bh + 0.012, -d / 2 + 0.055], 0.012, 0.024, o));
    });
    return parts;
  },
  planDetail: ({ w, d }) => {
    const gw = clamp(w * 0.6, 0.5, w - 0.1);
    return [
      line([-w / 2, -d / 2], [w / 2, d / 2]),
      line([-w / 2, d / 2], [w / 2, -d / 2]),
      circle([0, 0], 0.045),
      line([-w / 2, d / 2 - 0.025], [-w / 2 + gw, d / 2 - 0.025]),
    ];
  },
});

const walkInShower = defineAsset({
  id: 'shower-walk-in',
  name: 'Walk-in rain shower',
  category: 'bathroom',
  type: 'plumbing',
  group: 'Showers & tubs',
  tags: ['shower', 'walk-in', 'wet room', 'rain shower', 'linear drain', 'crittall', 'screen'],
  defaultSize: { w: 1.4, d: 0.9, h: 2.1 },
  minSize: { w: 1.0, d: 0.8, h: 2.0 },
  maxSize: { w: 2.0, d: 1.4, h: 2.4 },
  wallSnap: true,
  slots: [
    matSlot('tray', 'Floor tray', 'stone-slate'),
    matSlot('glass', 'Glass', 'glass-clear'),
    matSlot('metal', 'Frame & fittings', 'metal-black-matte'),
    matSlot('bottles', 'Bottles', 'plastic-white'),
  ],
  build: ({ w, d, h }) => {
    const trayH = 0.03;
    const gw = clamp(w * 0.6, 0.6, w - 0.4);
    const zg = d / 2 - 0.02;
    const hs = Math.min(0.3, d * 0.36, w * 0.25);
    const headZ = -d / 2 + Math.min(0.42, d * 0.5);
    const mx = 0.25;
    const o = { plan: false };
    const parts: Part[] = [
      span('tray', [-w / 2, w / 2], [0, trayH], [-d / 2, d / 2], { bevel: 0.004 }),
      // Linear drain along the back wall.
      span('metal', [-w / 2 + 0.1, w / 2 - 0.1], [trayH - 0.001, trayH + 0.002], [-d / 2 + 0.06, -d / 2 + 0.1], o),
      ...slats('tray', [-w / 2 + 0.11, w / 2 - 0.11], [trayH + 0.001, trayH + 0.003], [-d / 2 + 0.065, -d / 2 + 0.095], Math.round((w - 0.22) / 0.04), {
        axis: 'x',
        gap: 0.5,
        plan: false,
      }),
      // Framed fixed panel with glazing bars and a stabiliser to the wall.
      span('glass', [-w / 2 + 0.02, -w / 2 + gw - 0.02], [trayH + 0.02, h - 0.03], [zg - 0.004, zg + 0.004]),
      ...frame4('metal', [-w / 2, -w / 2 + gw], [trayH, h - 0.01], [zg - 0.012, zg + 0.012], 0.02),
      ...range(3).map((i) => span('metal', [-w / 2 + 0.02, -w / 2 + gw - 0.02], [trayH + ((i + 1) * (h - trayH)) / 4 - 0.008, trayH + ((i + 1) * (h - trayH)) / 4 + 0.008], [zg - 0.008, zg + 0.008], o)),
      span('metal', [-w / 2 + gw / 2 - 0.008, -w / 2 + gw / 2 + 0.008], [trayH + 0.02, h - 0.03], [zg - 0.008, zg + 0.008], o),
      rodZ('metal', -w / 2 + gw - 0.01, h - 0.03, -d / 2, zg - 0.012, 0.009, o),
      // Ceiling-arm rain head.
      rodZ('metal', 0, h - 0.04, -d / 2, headZ, 0.012, o),
      span('metal', [-hs / 2, hs / 2], [h - 0.06, h - 0.048], [headZ - hs / 2, headZ + hs / 2], { bevel: 0.004, plan: false }),
      // Concealed valve: two round controls and a hand shower on its bracket.
      span('metal', [-mx - 0.06, mx + 0.06], [0.98, 1.22], [-d / 2, -d / 2 + 0.008], { bevel: 0.003, plan: false }),
      discZ('metal', [-mx + 0.05, 1.1, -d / 2 + 0.02], 0.035, 0.024, o),
      discZ('metal', [mx - 0.05, 1.1, -d / 2 + 0.02], 0.035, 0.024, o),
      rod('metal', [0, 1.12, -d / 2 + 0.03], [0, 1.28, -d / 2 + 0.05], 0.013, o),
      cyl('metal', [0, 1.3, -d / 2 + 0.06], 0.04, 0.02, { rotation: [1.2, 0, 0], segments: 24, plan: false }),
      ...rodPath('metal', [
        [0, 1.12, -d / 2 + 0.03],
        [0.04, 0.95, -d / 2 + 0.05],
        [0.08, 1.0, -d / 2 + 0.03],
      ], 0.006),
    ];
    // Wall shelf with bottles on the open side.
    const sx: V2 = [w / 2 - 0.36, w / 2 - 0.04];
    parts.push(span('metal', sx, [1.25, 1.265], [-d / 2, -d / 2 + 0.12], { bevel: 0.003, plan: false }));
    [0.05, 0.12, 0.2, 0.27].forEach((x, i) => {
      const bh = [0.2, 0.17, 0.14, 0.18][i];
      parts.push(cyl('bottles', [sx[0] + x, 1.265 + bh / 2, -d / 2 + 0.06], 0.027, bh, { segments: 18, plan: false }));
      parts.push(cyl('metal', [sx[0] + x, 1.265 + bh + 0.012, -d / 2 + 0.06], 0.012, 0.024, o));
    });
    return parts;
  },
  planDetail: ({ w, d }) => {
    const gw = clamp(w * 0.6, 0.6, w - 0.4);
    return [
      line([-w / 2, d / 2 - 0.02], [-w / 2 + gw, d / 2 - 0.02]),
      rectPoly(-w / 2 + 0.1, -d / 2 + 0.06, w / 2 - 0.1, -d / 2 + 0.1),
      line([-w / 2, -d / 2], [w / 2, d / 2]),
    ];
  },
});

const bathtub = defineAsset({
  id: 'bathtub',
  name: 'Bathtub',
  category: 'bathroom',
  type: 'plumbing',
  group: 'Showers & tubs',
  tags: ['bath', 'tub', 'bathtub', 'soaking', 'built-in'],
  defaultSize: { w: 1.7, d: 0.75, h: 0.58 },
  minSize: { w: 1.4, d: 0.65, h: 0.45 },
  maxSize: { w: 2.0, d: 0.95, h: 0.7 },
  wallSnap: true,
  slots: [matSlot('tub', 'Tub & panel', 'ceramic-white'), matSlot('metal', 'Fittings', 'metal-chrome')],
  build: ({ w, d, h }) => {
    const te = 0.1;
    const ts = 0.07;
    const base = 0.12;
    const xi: V2 = [-w / 2 + te, w / 2 - te];
    const zi: V2 = [-d / 2 + ts, d / 2 - ts];
    const xe = w / 2 - te;
    const o = { plan: false };
    return [
      span('tub', [-w / 2, w / 2], [0.05, base], [-d / 2, d / 2]),
      span('tub', [-w / 2 + 0.01, w / 2 - 0.01], [0, 0.05], [-d / 2, d / 2 - 0.04], o),
      span('tub', [-w / 2, -w / 2 + te], [base, h], [-d / 2, d / 2], { bevel: 0.01 }),
      span('tub', [w / 2 - te, w / 2], [base, h], [-d / 2, d / 2], { bevel: 0.01 }),
      span('tub', xi, [base, h], [-d / 2, -d / 2 + ts], { bevel: 0.01 }),
      span('tub', xi, [base, h], [d / 2 - ts, d / 2], { bevel: 0.01 }),
      // Apron panel and rounded inner floor with a sloped backrest.
      span('tub', [-w / 2 + 0.03, w / 2 - 0.03], [0.07, h - 0.05], [d / 2 - 0.003, d / 2 + 0.004], { bevel: 0.003, plan: false }),
      span('tub', xi, [base, base + 0.03], zi, { bevel: 0.008, plan: false }),
      box3('tub', [xi[0] + 0.12, base + (h - base) * 0.47, 0], [0.035, (h - base) * 0.95, zi[1] - zi[0] - 0.01], [0, 0, 0.45]),
      // Drain, overflow, wall spout and two handles on the tap end.
      cyl('metal', [xe - 0.12, base + 0.032, 0], 0.025, 0.004, o),
      cyl('metal', [xe - 0.003, h - 0.13, 0], 0.03, 0.006, { rotation: [0, 0, Math.PI / 2], plan: false }),
      rodX('metal', xe - 0.13, xe, h - 0.06, 0, 0.014, o),
      vcyl('metal', xe - 0.12, 0, h - 0.085, h - 0.06, 0.016, o),
      ...[-1, 1].flatMap((s) => [
        rodX('metal', xe - 0.03, xe, h - 0.07, s * 0.1, 0.022, o),
        rod('metal', [xe - 0.03, h - 0.07, s * 0.1], [xe - 0.06, h - 0.07, s * 0.14], 0.006, o),
      ]),
    ];
  },
  planDetail: ({ w, d }) => [
    poly(roundRectPoints(0, 0, w - 0.2, d - 0.14, 0.12)),
    circle([w / 2 - 0.22, 0], 0.025),
  ],
});

/** Box with an explicit rotation (thin wrapper so the bathtub reads cleanly). */
function box3(slot: string, c: V3, s: V3, rot: V3): Part {
  return { shape: 'box', size: [s[0], s[1], s[2]], position: [c[0], c[1], c[2]], rotation: rot, slot, plan: false };
}

function clawLayout(w: number, d: number, h: number) {
  const ax = (w - 0.12) / 2;
  return { cx: -0.06, ax, az: d / 2 - 0.005, footH: 0.12, rimY: h - 0.1, tub0: 0.09, xs: w / 2 - 0.04 };
}

const clawfoot = defineAsset({
  id: 'bathtub-clawfoot',
  name: 'Clawfoot bathtub',
  category: 'bathroom',
  type: 'plumbing',
  group: 'Showers & tubs',
  tags: ['bath', 'tub', 'clawfoot', 'freestanding', 'roll top', 'victorian', 'soaking'],
  defaultSize: { w: 1.7, d: 0.78, h: 0.78 },
  minSize: { w: 1.4, d: 0.7, h: 0.7 },
  maxSize: { w: 1.9, d: 0.9, h: 0.85 },
  slots: [
    matSlot('tub', 'Tub interior & rim', 'ceramic-white'),
    matSlot('shell', 'Painted exterior', 'paint-deep-teal'),
    matSlot('metal', 'Feet & taps', 'metal-brass'),
  ],
  build: ({ w, d, h }) => {
    const L = clawLayout(w, d, h);
    const H = L.rimY - L.tub0;
    const tube = 0.022;
    const o = { plan: false };
    const sc: V3 = [L.ax, 1, L.az];
    const parts: Part[] = [
      lathe('shell', [L.cx, L.tub0, 0], [
        [0, 0],
        [0.7, 0],
        [0.78, 0.04],
        [0.9, H * 0.35],
        [0.97, H * 0.75],
        [1, H],
      ], { scale: sc, segments: 48 }),
      lathe('tub', [L.cx, L.tub0, 0], [
        [0.985, H],
        [0.95, H * 0.8],
        [0.88, H * 0.35],
        [0.7, 0.07],
        [0.4, 0.05],
        [0, 0.05],
      ], { scale: sc, segments: 48, plan: false }),
      ring('tub', [L.cx, L.rimY, 0], L.ax - tube, tube, { zScale: (L.az - tube) / (L.ax - tube), plan: false }),
      cyl('metal', [L.cx + L.ax * 0.3, L.tub0 + 0.052, 0], 0.024, 0.004, o),
    ];
    // Claw-and-ball feet.
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const x = L.cx + sx * L.ax * 0.68;
        const z = sz * L.az * 0.5;
        parts.push(sphere('metal', [x, 0.028, z], 0.028, o));
        parts.push(
          lathe('metal', [x, 0.03, z], [
            [0, 0],
            [0.02, 0],
            [0.026, 0.03],
            [0.022, 0.05],
            [0.042, L.footH - 0.01],
            [0, L.footH - 0.01],
          ], { segments: 16, plan: false }),
        );
        parts.push(ring('metal', [x, 0.045, z], 0.028, 0.008, { plan: false }));
      }
    }
    // Freestanding floor mixer with gooseneck spout, cross handles and a hand shower.
    const R = 0.07;
    const t2 = 0.013;
    const yc = h - R - t2;
    parts.push(
      vcyl('metal', L.xs, 0, 0, 0.01, 0.034, o),
      vcyl('metal', L.xs, 0, 0.01, yc, 0.016, o),
      torus('metal', [L.xs - R, yc, 0], R, t2, { arc: Math.PI, plan: false }),
      vcyl('metal', L.xs - 2 * R, 0, yc - 0.04, yc, 0.015, o),
      rodZ('metal', L.xs, L.rimY - 0.05, -0.05, 0.05, 0.009, o),
      vcyl('metal', L.xs, 0.05, L.rimY - 0.05, L.rimY - 0.02, 0.008, o),
      vcyl('metal', L.xs, -0.05, L.rimY - 0.05, L.rimY - 0.02, 0.008, o),
      rodX('metal', L.xs - 0.02, L.xs + 0.02, L.rimY - 0.018, 0.05, 0.005, o),
      rodX('metal', L.xs - 0.02, L.xs + 0.02, L.rimY - 0.018, -0.05, 0.005, o),
      rodZ('metal', L.xs, L.rimY - 0.15, 0, 0.045, 0.007, o),
      vcyl('metal', L.xs, 0.05, L.rimY - 0.28, L.rimY - 0.13, 0.012, o),
      sphere('metal', [L.xs, L.rimY - 0.12, 0.05], 0.022, { scale: [1, 0.7, 1], plan: false }),
    );
    return parts;
  },
  planDetail: ({ w, d, h }) => {
    const L = clawLayout(w, d, h);
    return [
      poly(ellipsePoints(L.cx, 0, L.ax * 0.9, L.az * 0.88)),
      circle([L.cx + L.ax * 0.3, 0], 0.024),
      circle([L.xs, 0], 0.034),
    ];
  },
});

// ---------------------------------------------------------------------------
// Accessories
// ---------------------------------------------------------------------------

const towelRail = defineAsset({
  id: 'towel-rail',
  name: 'Heated towel rail',
  category: 'bathroom',
  type: 'plumbing',
  group: 'Bathroom accessories',
  tags: ['towel rail', 'towel warmer', 'ladder', 'radiator', 'towel'],
  defaultSize: { w: 0.5, d: 0.1, h: 0.8 },
  minSize: { w: 0.3, d: 0.06, h: 0.4 },
  maxSize: { w: 1.0, d: 0.15, h: 1.8 },
  mount: 'wall',
  defaultElevation: 0.4,
  slots: [matSlot('metal', 'Finish', 'metal-chrome'), matSlot('towel', 'Towel', 'fabric-white-cotton')],
  build: ({ w, d, h }) => {
    const zp = d / 2 - 0.02;
    const px = w / 2 - 0.015;
    const n = clamp(Math.round(h / 0.08), 3, 16);
    const o = { plan: false };
    const ys = spaced(n, 0.04, h - 0.04);
    const parts: Part[] = [vcyl('metal', -px, zp, 0.03, h, 0.015), vcyl('metal', px, zp, 0.03, h, 0.015)];
    ys.forEach((y, i) => parts.push(rodX('metal', -px, px, y, zp, 0.01, { plan: i === n - 1 })));
    for (const x of [-px, px]) {
      for (const y of [0.1, h - 0.1]) parts.push(rodZ('metal', x, y, -d / 2, zp, 0.008, o));
      // Valve caps at the foot of each column.
      parts.push(vcyl('metal', x, zp, 0, 0.03, 0.012, o));
      parts.push(sphere('metal', [x, 0.015, zp], 0.016, { scale: [1, 0.6, 1], plan: false }));
    }
    // A towel folded over a bar about two-thirds of the way up.
    const j = Math.max(1, Math.floor(n * 0.66));
    const yt = ys[j];
    const tw = (w - 0.03) * 0.72;
    const len = Math.min(0.32, yt - 0.04);
    parts.push(
      rodX('towel', -tw / 2, tw / 2, yt + 0.004, zp, 0.016, o),
      span('towel', [-tw / 2, tw / 2], [yt - len, yt + 0.006], [zp + 0.011, zp + 0.019], { bevel: 0.003, plan: false }),
      span('towel', [-tw / 2, tw / 2], [yt - len * 0.65, yt + 0.006], [zp - 0.019, zp - 0.011], { bevel: 0.003, plan: false }),
      span('towel', [-tw / 2, tw / 2], [yt - len + 0.03, yt - len + 0.045], [zp + 0.017, zp + 0.021], o),
    );
    return parts;
  },
});

const towelLadder = defineAsset({
  id: 'towel-ladder',
  name: 'Towel ladder',
  category: 'bathroom',
  type: 'plumbing',
  group: 'Bathroom accessories',
  tags: ['towel ladder', 'blanket ladder', 'leaning', 'towels', 'rack'],
  defaultSize: { w: 0.5, d: 0.35, h: 1.7 },
  minSize: { w: 0.4, d: 0.25, h: 1.2 },
  maxSize: { w: 0.7, d: 0.45, h: 2.0 },
  wallSnap: true,
  slots: [
    matSlot('wood', 'Ladder', 'wood-oak-light'),
    matSlot('towel', 'Bath towel', 'fabric-white-cotton'),
    matSlot('towel2', 'Hand towel', 'fabric-sky'),
  ],
  build: ({ w, d, h }) => {
    const r = 0.016;
    const zb = d / 2 - 0.03;
    const zt = -d / 2 + 0.025;
    const zAt = (y: number) => zb + ((zt - zb) * y) / h;
    const xr = w / 2 - r - 0.005;
    const n = clamp(Math.round((h - 0.2) / 0.3), 3, 7);
    const ys = spaced(n, 0.25, h - 0.12);
    const gap = ys[1] - ys[0];
    const o = { plan: false };
    const parts: Part[] = [];
    for (const x of [-xr, xr]) {
      parts.push(rod('wood', [x, r, zb], [x, h - 0.01, zt], r));
      parts.push(cyl('wood', [x, 0.006, zb], r * 1.1, 0.012, { rTop: r, plan: false }));
    }
    for (const y of ys) parts.push(rodX('wood', -xr, xr, y, zAt(y), 0.011, o));
    const towel = (slot: string, y: number, tw: number, len: number) => {
      const z = zAt(y);
      parts.push(
        rodX(slot, -tw / 2, tw / 2, y + 0.002, z, 0.02, o),
        span(slot, [-tw / 2, tw / 2], [y - len, y + 0.004], [z + 0.012, z + 0.024], { bevel: 0.005, plan: false }),
        span(slot, [-tw / 2, tw / 2], [y - len * 0.7, y + 0.004], [z - 0.024, z - 0.012], { bevel: 0.005, plan: false }),
        span(slot, [-tw / 2 + 0.005, tw / 2 - 0.005], [y - len + 0.03, y - len + 0.05], [z + 0.022, z + 0.027], o),
      );
    };
    towel('towel', ys[n - 2], 2 * xr - 0.06, gap * 0.85);
    towel('towel2', ys[1], 2 * xr - 0.14, Math.min(gap * 0.7, ys[1] - 0.04));
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w / 2 + 0.02, d / 2 - 0.03], [w / 2 - 0.02, d / 2 - 0.03])],
});

const bathMat = defineAsset({
  id: 'bath-mat',
  name: 'Bath mat',
  category: 'bathroom',
  type: 'decor',
  group: 'Rugs',
  tags: ['bath mat', 'rug', 'chenille', 'bathroom rug', 'mat'],
  defaultSize: { w: 0.8, d: 0.5, h: 0.015 },
  minSize: { w: 0.5, d: 0.4, h: 0.01 },
  maxSize: { w: 1.2, d: 0.8, h: 0.03 },
  slots: [matSlot('mat', 'Pile', 'fabric-white-cotton'), matSlot('border', 'Border', 'fabric-sky')],
  build: ({ w, d, h }) => {
    const r = Math.min(0.06, w * 0.15, d * 0.15);
    const fw = w - 0.06;
    const fd = d - 0.06;
    const parts: Part[] = [
      { ...prismAt('border', roundRectPoints(0, 0, w, d, r), 0, h * 0.5), plan: true },
      prismAt('mat', roundRectPoints(0, 0, fw, fd, r * 0.6), 0, h * 0.7),
    ];
    // Chenille bobbles over the field.
    const nx = clamp(Math.round((fw - 0.02) / 0.07), 3, 12);
    const nz = clamp(Math.round((fd - 0.02) / 0.07), 2, 8);
    const br = (Math.min((fw - 0.02) / nx, (fd - 0.02) / nz) / 2) * 0.92;
    for (const x of cells(nx, -fw / 2 + 0.01, fw / 2 - 0.01)) {
      for (const z of cells(nz, -fd / 2 + 0.01, fd / 2 - 0.01)) {
        parts.push(sphere('mat', [x, h * 0.65, z], br, { scale: [1, (h * 0.35) / br, 1], plan: false }));
      }
    }
    return parts;
  },
  planDetail: ({ w, d }) => [poly(roundRectPoints(0, 0, w - 0.06, d - 0.06, Math.min(0.06, w * 0.15, d * 0.15) * 0.6))],
});

/** Prism from an [x, z] outline (already centred), from y0 up `height`; hidden from the plan. */
function prismAt(slot: string, outline: V2[], y0: number, height: number): Part {
  return { shape: 'prism', outline, height: Math.max(0.002, height), position: [0, y0, 0], slot, plan: false };
}

const rollStand = defineAsset({
  id: 'toilet-roll-stand',
  name: 'Toilet roll stand',
  category: 'bathroom',
  type: 'plumbing',
  group: 'Bathroom accessories',
  tags: ['toilet roll', 'toilet paper', 'holder', 'stand', 'reserve'],
  defaultSize: { w: 0.22, d: 0.2, h: 0.68 },
  minSize: { w: 0.18, d: 0.16, h: 0.55 },
  maxSize: { w: 0.26, d: 0.26, h: 0.8 },
  slots: [matSlot('metal', 'Stand', 'metal-black-matte'), matSlot('paper', 'Paper', 'solid-white')],
  build: ({ w, d, h }) => {
    const px = -w / 2 + 0.06;
    const rr = 0.055;
    const rw = 0.1;
    const ry = h - 0.08;
    const base = 0.015;
    const o = { plan: false };
    const n = clamp(Math.floor((ry - rr - 0.03 - base) / 0.105), 1, 4);
    const parts: Part[] = [
      cyl('metal', [0, base / 2, 0], Math.min(w, d) / 2 - 0.004, base, { segments: 32 }),
      cyl('metal', [0, base + 0.004, 0], Math.min(w, d) / 2 - 0.02, 0.008, { rTop: Math.min(w, d) / 2 - 0.03, plan: false }),
      vcyl('metal', px, 0, base, h - 0.02, 0.009, o),
      sphere('metal', [px, h - 0.015, 0], 0.014, o),
      // Holder arm with the roll in use.
      rodX('metal', px, px + 0.03 + rw, ry, 0, 0.006, o),
      rod('paper', [px + 0.025, ry, 0], [px + 0.025 + rw, ry, 0], rr, { segments: 28, plan: false }),
      rod('metal', [px + 0.022, ry, 0], [px + 0.028 + rw, ry, 0], 0.021, o),
      // A loose sheet hanging from the front.
      span('paper', [px + 0.03, px + 0.02 + rw], [ry - 0.12, ry], [rr - 0.002, rr + 0.001], o),
    ];
    // Spare rolls threaded on the post.
    for (let i = 0; i < n; i++) {
      const y = base + 0.012 + i * 0.105;
      parts.push(cyl('paper', [px, y + 0.05, 0], rr, 0.1, { segments: 28, plan: false }));
      parts.push(cyl('metal', [px, y + 0.1005, 0], 0.021, 0.002, o));
    }
    return parts;
  },
  planDetail: ({ w }) => [circle([-w / 2 + 0.06, 0], 0.055)],
});

const medicineCabinet = defineAsset({
  id: 'medicine-cabinet',
  name: 'Mirrored medicine cabinet',
  category: 'bathroom',
  type: 'storage',
  group: 'Bathroom & laundry storage',
  tags: ['medicine cabinet', 'mirror cabinet', 'bathroom cabinet', 'wall cabinet', 'mirror'],
  defaultSize: { w: 0.6, d: 0.14, h: 0.7 },
  minSize: { w: 0.4, d: 0.12, h: 0.5 },
  maxSize: { w: 0.9, d: 0.18, h: 0.9 },
  mount: 'wall',
  defaultElevation: 1.15,
  slots: [
    matSlot('body', 'Cabinet', 'laminate-white-matte'),
    matSlot('mirror', 'Mirror doors', 'glass-mirror'),
    matSlot('items', 'Cup & bottles', 'ceramic-sage'),
    matSlot('accent', 'Toothbrushes & caps', 'plastic-mint'),
  ],
  build: ({ w, d, h }) => {
    const ft = 0.018;
    const zf = d / 2 - ft;
    const niche = Math.min(0.13, h * 0.2);
    const t = 0.016;
    const ih = niche - t - 0.012;
    const o = { plan: false };
    const parts: Part[] = [
      span('body', [-w / 2, w / 2], [niche, h], [-d / 2, zf]),
      span('body', [-w / 2, w / 2], [0, t], [-d / 2, d / 2 - 0.004], { bevel: 0.003, plan: false }),
      span('body', [-w / 2, -w / 2 + t], [t, niche], [-d / 2, d / 2 - 0.004], o),
      span('body', [w / 2 - t, w / 2], [t, niche], [-d / 2, d / 2 - 0.004], o),
      span('body', [-w / 2 + t, w / 2 - t], [t, niche], [-d / 2, -d / 2 + 0.006], o),
    ];
    const n = w >= 0.55 ? 2 : 1;
    for (const [x0, x1] of cells(n, -w / 2, w / 2).map((c) => [c - w / n / 2, c + w / n / 2] as V2)) {
      parts.push(span('body', [x0 + 0.002, x1 - 0.002], [niche + 0.002, h - 0.002], [zf, d / 2 - 0.002], { bevel: 0.004, plan: false }));
      parts.push(span('mirror', [x0 + 0.014, x1 - 0.014], [niche + 0.014, h - 0.014], [d / 2 - 0.003, d / 2], o));
    }
    // Toothbrush cup, toothbrushes and a couple of bottles in the open niche.
    const cx = -w / 4;
    const cz = -d / 2 + d * 0.5;
    const ch = Math.min(0.08, ih * 0.75);
    parts.push(cyl('items', [cx, t + ch / 2, cz], 0.028, ch, { rTop: 0.032, segments: 20, plan: false }));
    for (const s of [-1, 1]) {
      const top: V3 = [cx + s * 0.018, t + ih, cz + s * 0.004];
      parts.push(rod('accent', [cx + s * 0.006, t + 0.01, cz], top, 0.0045, o));
      parts.push(span('accent', [top[0] - 0.005, top[0] + 0.005], [top[1] - 0.02, top[1]], [top[2] - 0.004, top[2] + 0.008], { bevel: 0.002, plan: false }));
    }
    for (const [i, x] of [w / 8, w / 4].entries()) {
      const bh = ih * (i === 0 ? 0.9 : 0.7);
      parts.push(cyl('items', [x, t + bh / 2, cz], 0.02, bh, { segments: 16, plan: false }));
      parts.push(cyl('accent', [x, t + bh + 0.006, cz], 0.009, 0.012, o));
    }
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w / 2, -d / 2], [w / 2, d / 2]), line([-w / 2, d / 2], [w / 2, -d / 2])],
});

const tallCabinet = defineAsset({
  id: 'bathroom-tall-cabinet',
  name: 'Tall bathroom cabinet',
  category: 'bathroom',
  type: 'storage',
  group: 'Bathroom & laundry storage',
  tags: ['bathroom cabinet', 'tall', 'linen cupboard', 'tallboy', 'towels', 'basket'],
  defaultSize: { w: 0.4, d: 0.33, h: 1.7 },
  minSize: { w: 0.3, d: 0.28, h: 1.4 },
  maxSize: { w: 0.6, d: 0.4, h: 1.9 },
  wallSnap: true,
  slots: [
    matSlot('cabinet', 'Cabinet', 'wood-painted-white'),
    matSlot('handle', 'Knobs & legs', 'metal-brass'),
    matSlot('basket', 'Basket', 'rattan-natural'),
    matSlot('towels', 'Towels', 'fabric-sky'),
  ],
  build: ({ w, d, h }) => {
    const legH = 0.1;
    const t = 0.018;
    const ft = 0.02;
    const zf = d / 2 - ft - 0.03;
    const zs = zf + ft;
    const drawer: V2 = [legH, legH + t + 0.2];
    const niche: V2 = [drawer[1] + t, drawer[1] + t + 0.32];
    const door: V2 = [niche[1] + t, h - 0.035];
    const X: V2 = [-w / 2, w / 2];
    const o = { plan: false };
    const parts: Part[] = [
      span('cabinet', X, [legH, drawer[1]], [-d / 2, zf]),
      span('cabinet', X, [niche[1], h - 0.035], [-d / 2, zf]),
      span('cabinet', X, [drawer[1], niche[1] + t], [-d / 2, -d / 2 + 0.008], o),
      span('cabinet', [-w / 2, -w / 2 + t], [drawer[1], niche[1] + t], [-d / 2, zs], o),
      span('cabinet', [w / 2 - t, w / 2], [drawer[1], niche[1] + t], [-d / 2, zs], o),
      span('cabinet', [-w / 2 + t, w / 2 - t], [drawer[1], niche[0]], [-d / 2, zs], o),
      span('cabinet', [-w / 2 + t, w / 2 - t], [niche[1], niche[1] + t], [-d / 2, zs], o),
      span('cabinet', [-w / 2 - 0.0, w / 2], [h - 0.035, h], [-d / 2, zs + 0.012], { bevel: 0.005, plan: false }),
      ...shakerFront('cabinet', X, drawer, zf, ft, { rail: 0.05 }),
      ...knob('handle', [0, (drawer[0] + drawer[1]) / 2, zs], 0.015),
      ...shakerFront('cabinet', X, door, zf, ft, { rail: 0.06 }),
      ...knob('handle', [w / 2 - 0.05, door[0] + 0.12, zs], 0.015),
    ];
    for (const x of [-w / 2 + 0.03, w / 2 - 0.03]) {
      for (const z of [-d / 2 + 0.03, zf - 0.03]) parts.push(vcyl('handle', x, z, 0, legH, 0.011, { rTop: 0.016, plan: false }));
    }
    // Woven basket with rolled towels on top.
    const bx: V2 = [-w / 2 + t + 0.02, w / 2 - t - 0.02];
    const bz: V2 = [-d / 2 + 0.03, zf - 0.01];
    const by = niche[0];
    parts.push(span('basket', bx, [by, by + 0.16], bz, { bevel: 0.012, plan: false }));
    parts.push(...slats('basket', [bx[0] - 0.003, bx[1] + 0.003], [by + 0.02, by + 0.15], [bz[0] - 0.003, bz[1] + 0.003], 4, { axis: 'y', gap: 0.6, plan: false }));
    const tr = 0.038;
    const nt = clamp(Math.floor((bx[1] - bx[0]) / (2 * tr + 0.006)), 2, 4);
    for (const x of cells(nt, bx[0], bx[1])) parts.push(rodZ('towels', x, by + 0.16 + tr - 0.012, bz[0] + 0.02, bz[1] - 0.02, tr, o));
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w / 2, d / 2 - 0.05], [w / 2, d / 2 - 0.05])],
});

const bathroomMirror = defineAsset({
  id: 'bathroom-mirror',
  name: 'Bathroom mirror',
  category: 'bathroom',
  type: 'decor',
  group: 'Mirrors',
  tags: ['mirror', 'vanity mirror', 'wall mirror', 'bathroom', 'rounded'],
  defaultSize: { w: 0.6, d: 0.03, h: 0.8 },
  minSize: { w: 0.3, d: 0.02, h: 0.3 },
  maxSize: { w: 1.8, d: 0.06, h: 1.4 },
  mount: 'wall',
  defaultElevation: 1.1,
  slots: [matSlot('glass', 'Mirror', 'glass-mirror'), matSlot('frame', 'Frame', 'metal-black-matte')],
  build: ({ w, d, h }) => {
    const f = Math.min(0.018, w * 0.05, h * 0.05);
    const r = Math.min(0.08, w * 0.15, h * 0.15);
    return [
      span('frame', [-w / 2 + r, w / 2 - r], [h * 0.3, h * 0.7], [-d / 2, -d / 2 + 0.004]),
      frontProfile('frame', roundRectPoints(0, h / 2, w, h, r), [-d / 2, d / 2 - 0.002]),
      frontProfile('glass', roundRectPoints(0, h / 2, w - 2 * f, h - 2 * f, Math.max(0.002, r - f)), [d / 2 - 0.004, d / 2]),
    ];
  },
});

export const BATHROOM_ASSETS: AssetDefinition[] = [
  bidet,
  vanity,
  vanityDouble,
  shower,
  walkInShower,
  bathtub,
  clawfoot,
  towelRail,
  towelLadder,
  rollStand,
  medicineCabinet,
  tallCabinet,
  bathMat,
  bathroomMirror,
];

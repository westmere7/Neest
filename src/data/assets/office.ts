import type { AssetDefinition, Part, PlanStroke, Size3 } from './types';
import {
  barPull,
  bookRow,
  box,
  cellSpans,
  circle,
  clamp,
  cyl,
  defineAsset,
  fronts,
  frame4,
  knob,
  lathe,
  line,
  matSlot,
  pillow,
  poly,
  range,
  rectPoly,
  rng,
  rod,
  rodPath,
  rodX,
  shakerFront,
  span,
  sphere,
  vcyl,
  type FrontSpec,
  type V2,
  type V3,
} from './parts';

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

/** Corners of a w×d rectangle centred at (cx, cz), turned by `a` about the vertical axis. */
function turnedRect(cx: number, cz: number, w: number, d: number, a: number): V2[] {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const pts: V2[] = [
    [-w / 2, -d / 2],
    [w / 2, -d / 2],
    [w / 2, d / 2],
    [-w / 2, d / 2],
  ];
  // Matches box rotation [0, a, 0]: x' = x cos a + z sin a, z' = -x sin a + z cos a.
  return pts.map(([x, z]) => [cx + x * c + z * s, cz - x * s + z * c] as V2);
}

/**
 * Flat desk-top props that stay within 2 cm of the top surface at `y`: a closed notebook with an
 * elastic band and a pen lying beside it.
 */
function notebookAndPen(coverSlot: string, penSlot: string, c: V2, y: number, turn: number): Part[] {
  const [x, z] = c;
  const rot: V3 = [0, turn, 0];
  return [
    box(coverSlot, [x, y + 0.006, z], [0.15, 0.012, 0.21], { rotation: rot, bevel: 0.002, plan: false }),
    box(penSlot, [x + 0.05 * Math.cos(turn), y + 0.0125, z - 0.05 * Math.sin(turn)], [0.008, 0.002, 0.212], {
      rotation: rot,
      plan: false,
    }),
    rod(penSlot, [x + 0.1, y + 0.005, z - 0.07], [x + 0.115, y + 0.005, z + 0.07], 0.0045, { plan: false }),
  ];
}

/** Coffee mug (body + handle) standing at `c` on surface height y. */
function mug(slot: string, c: V2, y: number, r = 0.04, hgt = 0.095): Part[] {
  return [
    lathe(
      slot,
      [c[0], y, c[1]],
      [
        [0, 0],
        [r * 0.92, 0],
        [r, hgt * 0.08],
        [r, hgt],
        [r * 0.9, hgt],
        [r * 0.9, hgt * 0.15],
        [0, hgt * 0.15],
      ],
      { segments: 20, plan: false },
    ),
    box(slot, [c[0] + r + 0.012, y + hgt * 0.55, c[1]], [0.028, 0.05, 0.009], { bevel: 0.004, plan: false }),
  ];
}

// ---------------------------------------------------------------------------
// Desks
// ---------------------------------------------------------------------------

const ITEMS = matSlot('items', 'Desk pad & accessories', 'leather-tan');

function deskLayout({ w, d, h }: Size3) {
  const t = 0.028;
  const leg = 0.04;
  const legX = w / 2 - 0.03 - leg / 2;
  const legZ = d / 2 - 0.03 - leg / 2;
  const pedW = w >= 1.15 ? clamp(w * 0.28, 0.38, 0.45) : 0;
  const pedX1 = legX - leg / 2 - 0.012;
  const pedX0 = pedX1 - pedW;
  const kneeX0 = -legX + leg / 2 + 0.02;
  const kneeX1 = pedW > 0 ? pedX0 - 0.02 : legX - leg / 2 - 0.02;
  const cx = (kneeX0 + kneeX1) / 2;
  const padW = Math.min(0.72, (kneeX1 - kneeX0) * 0.85);
  const padD = Math.min(0.32, d * 0.45);
  const padZ1 = d / 2 - 0.05;
  return { t, leg, legX, legZ, pedW, pedX0, pedX1, kneeX0, kneeX1, cx, padW, padD, padZ1, yU: h - t };
}

const desk = defineAsset({
  id: 'desk',
  name: 'Desk',
  category: 'office',
  type: 'surfaces',
  group: 'Desks',
  tags: ['desk', 'workstation', 'writing desk', 'table', 'work'],
  defaultSize: { w: 1.4, d: 0.7, h: 0.75 },
  minSize: { w: 0.8, d: 0.5, h: 0.65 },
  maxSize: { w: 2.4, d: 1.0, h: 1.25 },
  wallSnap: true,
  slots: [matSlot('top', 'Top & drawers', 'wood-oak-light'), matSlot('frame', 'Frame & pulls', 'metal-black-matte'), ITEMS],
  build: (size) => {
    const { w, d, h } = size;
    const L = deskLayout(size);
    const { leg, legX, legZ, yU } = L;
    const parts: Part[] = [span('top', [-w / 2, w / 2], [yU, h], [-d / 2, d / 2], { bevel: 0.004 })];
    // Frame: four legs with levelling feet, side aprons, a back rail and low side stretchers.
    for (const x of [-legX, legX]) {
      for (const z of [-legZ, legZ]) {
        parts.push(span('frame', [x - leg / 2, x + leg / 2], [0.008, yU], [z - leg / 2, z + leg / 2], { plan: false }));
        parts.push(vcyl('frame', x, z, 0, 0.008, 0.016, { plan: false }));
      }
      parts.push(span('frame', [x - 0.012, x + 0.012], [yU - 0.06, yU], [-legZ, legZ], { plan: false }));
      parts.push(span('frame', [x - 0.01, x + 0.01], [0.12, 0.145], [-legZ, legZ], { plan: false }));
    }
    parts.push(span('frame', [-legX, legX], [yU - 0.06, yU], [-legZ - 0.012, -legZ + 0.008], { plan: false }));
    // Cable tray hung under the back of the top, with a cable dropping down the rear leg.
    const tw = Math.min(0.8, w * 0.5) / 2;
    const tz0 = -d / 2 + 0.07;
    const tz1 = tz0 + 0.11;
    const ty = yU - 0.11;
    parts.push(
      span('frame', [-tw, tw], [ty, ty + 0.003], [tz0, tz1], { plan: false }),
      span('frame', [-tw, tw], [ty, ty + 0.06], [tz1 - 0.003, tz1], { plan: false }),
      span('frame', [-tw, tw], [ty, ty + 0.045], [tz0, tz0 + 0.003], { plan: false }),
      span('top', [-tw + 0.05, -tw + 0.35], [ty + 0.003, ty + 0.04], [tz0 + 0.02, tz0 + 0.07], { plan: false }),
      ...rodPath(
        'frame',
        [
          [tw - 0.02, ty + 0.02, tz0 + 0.04],
          [legX - 0.05, ty - 0.08, -legZ + 0.03],
          [legX - 0.04, 0.01, -legZ + 0.03],
        ],
        0.004,
      ),
    );
    // Slim pencil drawer centred over the knee space.
    const dw = Math.min(0.55, (L.kneeX1 - L.kneeX0) * 0.6) / 2;
    const zf = d / 2 - 0.035;
    parts.push(
      span('top', [L.cx - dw, L.cx + dw], [yU - 0.07, yU], [tz1 + 0.02, zf], { plan: false }),
      span('top', [L.cx - dw, L.cx + dw], [yU - 0.072, yU - 0.003], [zf, zf + 0.016], { bevel: 0.002, plan: false }),
      ...barPull('frame', [L.cx, yU - 0.037, zf + 0.016], Math.min(0.14, dw), { stand: 0.018, r: 0.004 }),
    );
    // Hanging two-drawer pedestal on the right of wider desks.
    if (L.pedW > 0) {
      const py0 = yU - 0.34;
      parts.push(span('top', [L.pedX0, L.pedX1], [py0, yU], [tz1 + 0.01, zf], { plan: false }));
      const specs: FrontSpec[] = cellSpans(2, py0, yU - 0.002).map((y) => ({ x: [L.pedX0, L.pedX1] as V2, y }));
      parts.push(...fronts('top', 'frame', specs, zf, 0.016, 0));
      for (const [, y1] of cellSpans(2, py0, yU - 0.002)) {
        parts.push(...barPull('frame', [(L.pedX0 + L.pedX1) / 2, y1 - 0.04, zf + 0.016], 0.14, { stand: 0.02, r: 0.0045 }));
      }
    }
    // Desk pad, notebook and pen on top.
    const padZ0 = L.padZ1 - L.padD;
    parts.push(span('items', [L.cx - L.padW / 2, L.cx + L.padW / 2], [h, h + 0.003], [padZ0, L.padZ1], { bevel: 0.001, plan: false }));
    if (L.padW > 0.4) {
      parts.push(...notebookAndPen('frame', 'items', [L.cx - L.padW / 2 + 0.12, (padZ0 + L.padZ1) / 2], h + 0.003, 0.22));
    }
    return parts;
  },
  planDetail: (size) => {
    const L = deskLayout(size);
    const z0 = L.padZ1 - L.padD;
    const strokes: PlanStroke[] = [rectPoly(L.cx - L.padW / 2, z0, L.cx + L.padW / 2, L.padZ1)];
    if (L.padW > 0.4) strokes.push(poly(turnedRect(L.cx - L.padW / 2 + 0.12, (z0 + L.padZ1) / 2, 0.15, 0.21, 0.22)));
    return strokes;
  },
});

function deskLLayout({ w, d, h }: Size3) {
  const t = 0.025;
  const zm = -d / 2 + Math.min(0.7, d * 0.55);
  const rw = clamp(w * 0.35, 0.45, 0.6);
  const pedW = clamp(w * 0.22, 0.3, 0.42);
  const pedX0 = -w / 2 + 0.09;
  const pedX1 = pedX0 + pedW;
  const padX0 = pedX1 + 0.05;
  const padX1 = Math.min(padX0 + 0.75, w / 2 - 0.08);
  const padD = Math.min(0.32, (zm + d / 2) * 0.5);
  return { t, zm, rw, pedX0, pedX1, padX0, padX1, padD, yU: h - t };
}

const deskL = defineAsset({
  id: 'desk-l-shaped',
  name: 'L-shaped corner desk',
  category: 'office',
  type: 'surfaces',
  group: 'Desks',
  tags: ['desk', 'corner desk', 'l-shape', 'workstation', 'office'],
  defaultSize: { w: 1.6, d: 1.4, h: 0.75 },
  minSize: { w: 1.1, d: 1.0, h: 0.65 },
  maxSize: { w: 2.4, d: 2.0, h: 0.8 },
  wallSnap: true,
  slots: [matSlot('top', 'Top & pedestal', 'laminate-white-matte'), matSlot('frame', 'Legs & pulls', 'metal-anthracite'), ITEMS],
  build: (size) => {
    const { w, d, h } = size;
    const L = deskLLayout(size);
    const { t, zm, rw, yU } = L;
    const lt = 0.05;
    const legs: V2[] = [
      [-w / 2 + 0.05, -d / 2 + 0.05],
      [-w / 2 + 0.05, zm - 0.05],
      [w / 2 - 0.05, -d / 2 + 0.05],
      [w / 2 - 0.05, d / 2 - 0.05],
      [w / 2 - rw + 0.05, d / 2 - 0.05],
    ];
    const parts: Part[] = [
      span('top', [-w / 2, w / 2], [h - t, h], [-d / 2, zm], { bevel: 0.003 }),
      span('top', [w / 2 - rw, w / 2], [h - t, h], [zm, d / 2], { bevel: 0.003 }),
    ];
    for (const [x, z] of legs) {
      parts.push(span('frame', [x - lt / 2, x + lt / 2], [0.01, yU], [z - lt / 2, z + lt / 2], { plan: false }));
      parts.push(span('frame', [x - lt / 2 - 0.004, x + lt / 2 + 0.004], [0, 0.01], [z - lt / 2 - 0.004, z + lt / 2 + 0.004], { plan: false }));
    }
    // Perforated modesty panel along the back and a return-side rail.
    parts.push(span('frame', [-w / 2 + 0.08, w / 2 - 0.08], [yU - 0.32, yU - 0.02], [-d / 2 + 0.03, -d / 2 + 0.036], { plan: false }));
    parts.push(span('frame', [w / 2 - 0.036, w / 2 - 0.03], [yU - 0.32, yU - 0.02], [-d / 2 + 0.08, d / 2 - 0.08], { plan: false }));
    // Cable tray behind the work zone with a power strip in it.
    const ty = yU - 0.12;
    const tz0 = -d / 2 + 0.05;
    const tz1 = tz0 + 0.11;
    const tx0 = L.pedX1 + 0.05;
    const tx1 = w / 2 - 0.1;
    parts.push(
      span('frame', [tx0, tx1], [ty, ty + 0.003], [tz0, tz1], { plan: false }),
      span('frame', [tx0, tx1], [ty, ty + 0.06], [tz1 - 0.003, tz1], { plan: false }),
      span('top', [tx0 + 0.04, Math.min(tx1 - 0.02, tx0 + 0.34)], [ty + 0.003, ty + 0.04], [tz0 + 0.02, tz0 + 0.07], { plan: false }),
    );
    // Floor-standing three-drawer pedestal under the left end.
    const zp = zm - 0.03;
    parts.push(span('top', [L.pedX0, L.pedX1], [0.02, yU - 0.01], [-d / 2 + 0.07, zp], { plan: false }));
    const rows = cellSpans(3, 0.03, yU - 0.012);
    parts.push(...fronts('top', 'frame', rows.map((y) => ({ x: [L.pedX0, L.pedX1] as V2, y })), zp, 0.016, 0));
    for (const [, y1] of rows) {
      parts.push(...barPull('frame', [(L.pedX0 + L.pedX1) / 2, y1 - 0.04, zp + 0.016], Math.min(0.16, L.pedX1 - L.pedX0 - 0.08), { stand: 0.02, r: 0.0045 }));
    }
    // Desk pad across the corner, notebook on the return.
    const pz1 = zm - 0.05;
    parts.push(span('items', [L.padX0, L.padX1], [h, h + 0.003], [pz1 - L.padD, pz1], { bevel: 0.001, plan: false }));
    parts.push(...notebookAndPen('frame', 'items', [w / 2 - rw / 2 - 0.04, (zm + d / 2) / 2], h, -0.3));
    return parts;
  },
  planDetail: (size) => {
    const L = deskLLayout(size);
    const pz1 = L.zm - 0.05;
    return [
      rectPoly(L.padX0, pz1 - L.padD, L.padX1, pz1),
      poly(turnedRect(size.w / 2 - L.rw / 2 - 0.04, (L.zm + size.d / 2) / 2, 0.15, 0.21, -0.3)),
    ];
  },
});

const deskExecutive = defineAsset({
  id: 'desk-executive',
  name: 'Executive desk',
  category: 'office',
  type: 'surfaces',
  group: 'Desks',
  tags: ['desk', 'executive', 'pedestal desk', 'partners desk', 'study', 'leather top', 'traditional'],
  defaultSize: { w: 1.8, d: 0.85, h: 0.76 },
  minSize: { w: 1.4, d: 0.7, h: 0.72 },
  maxSize: { w: 2.4, d: 1.0, h: 0.8 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Wood', 'wood-walnut'),
    matSlot('inlay', 'Leather inlay', 'leather-cognac'),
    matSlot('handle', 'Brass pulls', 'metal-brass'),
    matSlot('props', 'Papers', 'solid-white'),
  ],
  build: ({ w, d, h }) => {
    const yA = h - 0.055;
    const pw = clamp(w * 0.24, 0.4, 0.5);
    const zf = d / 2 - 0.06;
    const parts: Part[] = [
      span('body', [-w / 2, w / 2], [h - 0.035, h - 0.003], [-d / 2, d / 2], { bevel: 0.008 }),
      span('body', [-w / 2 + 0.012, w / 2 - 0.012], [yA, h - 0.035], [-d / 2 + 0.012, d / 2 - 0.012], { plan: false }),
      span('inlay', [-w / 2 + 0.09, w / 2 - 0.09], [h - 0.005, h], [-d / 2 + 0.09, d / 2 - 0.09], { bevel: 0.0015, plan: false }),
    ];
    // Twin pedestals on moulded plinths, three raised-panel drawers each.
    const pedestals: V2[] = [
      [-w / 2 + 0.03, -w / 2 + 0.03 + pw],
      [w / 2 - 0.03 - pw, w / 2 - 0.03],
    ];
    for (const [x0, x1] of pedestals) {
      parts.push(span('body', [x0 - 0.012, x1 + 0.012], [0, 0.085], [-d / 2 + 0.018, zf + 0.03], { bevel: 0.006, plan: false }));
      parts.push(span('body', [x0, x1], [0.085, yA], [-d / 2 + 0.03, zf], { plan: false }));
      const rows: V2[] = [[yA - 0.15, yA], ...cellSpans(2, 0.095, yA - 0.15)];
      for (const [y0, y1] of rows) {
        parts.push(...shakerFront('body', [x0 + 0.01, x1 - 0.01], [y0, y1], zf, 0.02, { rail: 0.045, recess: 0.008 }));
        parts.push(...barPull('handle', [(x0 + x1) / 2, y1 - Math.min(0.06, (y1 - y0) / 2), zf + 0.02], 0.12, { stand: 0.02, r: 0.005 }));
      }
    }
    // Centre drawer and raised-panel modesty board between the pedestals.
    const kx0 = pedestals[0][1] + 0.01;
    const kx1 = pedestals[1][0] - 0.01;
    parts.push(span('body', [kx0, kx1], [yA - 0.1, yA], [-d / 2 + 0.2, zf], { plan: false }));
    parts.push(...shakerFront('body', [kx0, kx1], [yA - 0.1, yA], zf, 0.02, { rail: 0.03, recess: 0.006 }));
    parts.push(...barPull('handle', [(kx0 + kx1) / 2, yA - 0.05, zf + 0.02], 0.16, { stand: 0.02, r: 0.005 }));
    parts.push(span('body', [kx0 - 0.01, kx1 + 0.01], [0.12, yA - 0.1], [-d / 2 + 0.04, -d / 2 + 0.06], { plan: false }));
    parts.push(...shakerFront('body', [kx0, kx1], [0.14, yA - 0.12], -d / 2 + 0.06, 0.015, { rail: 0.06, recess: 0.007 }));
    // Papers and a fountain pen on the leather.
    const cx = w * 0.12;
    const cz = d * 0.08;
    parts.push(
      box('props', [cx, h + 0.0015, cz], [0.21, 0.003, 0.297], { rotation: [0, 0.12, 0], plan: false }),
      box('props', [cx + 0.03, h + 0.0045, cz + 0.01], [0.21, 0.003, 0.297], { rotation: [0, -0.08, 0], plan: false }),
      rod('handle', [cx + 0.15, h + 0.006, cz - 0.06], [cx + 0.19, h + 0.006, cz + 0.08], 0.0055, { plan: false }),
      box('inlay', [-w * 0.22, h + 0.009, d * 0.05], [0.16, 0.018, 0.23], { rotation: [0, -0.15, 0], bevel: 0.003, plan: false }),
    );
    return parts;
  },
  planDetail: ({ w, d }) => [
    rectPoly(-w / 2 + 0.09, -d / 2 + 0.09, w / 2 - 0.09, d / 2 - 0.09),
    poly(turnedRect(w * 0.12, d * 0.08, 0.21, 0.297, 0.12)),
    poly(turnedRect(-w * 0.22, d * 0.05, 0.16, 0.23, -0.15)),
  ],
});

const deskStanding = defineAsset({
  id: 'desk-standing',
  name: 'Standing desk',
  category: 'office',
  type: 'surfaces',
  group: 'Desks',
  tags: ['desk', 'standing desk', 'sit stand', 'height adjustable', 'ergonomic', 'workstation'],
  defaultSize: { w: 1.4, d: 0.7, h: 1.05 },
  minSize: { w: 1.0, d: 0.6, h: 0.7 },
  maxSize: { w: 2.0, d: 0.8, h: 1.25 },
  wallSnap: true,
  slots: [
    matSlot('top', 'Top', 'wood-oak-light'),
    matSlot('frame', 'Frame', 'metal-white-powder'),
    matSlot('trim', 'Feet, controls & cables', 'plastic-black'),
    ITEMS,
  ],
  build: ({ w, d, h }) => {
    const t = 0.025;
    const yU = h - t;
    const lx = w / 2 - Math.min(0.2, w * 0.14);
    const parts: Part[] = [span('top', [-w / 2, w / 2], [yU, h], [-d / 2, d / 2], { bevel: 0.006 })];
    for (const x of [-lx, lx]) {
      // T-foot with levellers, two-stage telescopic column, top bracket.
      parts.push(span('frame', [x - 0.035, x + 0.035], [0.012, 0.05], [-d / 2 + 0.03, d / 2 - 0.03], { bevel: 0.01, plan: false }));
      for (const z of [-d / 2 + 0.06, d / 2 - 0.06]) parts.push(vcyl('trim', x, z, 0, 0.012, 0.018, { plan: false }));
      parts.push(span('frame', [x - 0.04, x + 0.04], [0.05, yU * 0.55], [-0.035, 0.035], { bevel: 0.006, plan: false }));
      parts.push(span('frame', [x - 0.034, x + 0.034], [yU * 0.55, yU - 0.03], [-0.029, 0.029], { bevel: 0.005, plan: false }));
      parts.push(span('trim', [x - 0.041, x + 0.041], [yU * 0.55 - 0.012, yU * 0.55], [-0.036, 0.036], { plan: false }));
      parts.push(span('frame', [x - 0.03, x + 0.03], [yU - 0.03, yU], [-d / 2 + 0.06, d / 2 - 0.06], { plan: false }));
    }
    // Cross rail with the motor housing, cable tray and a cable spine to the floor.
    parts.push(span('frame', [-lx, lx], [yU - 0.04, yU], [-0.02, 0.02], { plan: false }));
    parts.push(span('trim', [-0.1, 0.1], [yU - 0.06, yU - 0.04], [-0.03, 0.03], { bevel: 0.006, plan: false }));
    const tz0 = -d / 2 + 0.05;
    const tz1 = tz0 + 0.1;
    const tw = Math.min(0.55, lx - 0.08);
    parts.push(
      span('frame', [-tw, tw], [yU - 0.1, yU - 0.097], [tz0, tz1], { plan: false }),
      span('frame', [-tw, tw], [yU - 0.1, yU - 0.04], [tz1 - 0.003, tz1], { plan: false }),
      span('frame', [-tw, tw], [yU - 0.1, yU - 0.055], [tz0, tz0 + 0.003], { plan: false }),
    );
    const spineX = lx - 0.09;
    const vert = clamp(Math.round((yU - 0.1) / 0.09), 5, 12);
    for (const [y0, y1] of cellSpans(vert, 0.004, yU - 0.1)) {
      parts.push(span('trim', [spineX - 0.022, spineX + 0.022], [y0 + 0.004, y1 - 0.004], [tz0 + 0.02, tz0 + 0.06], { bevel: 0.006, plan: false }));
    }
    // Memory keypad with a lit display under the front right edge.
    const kx = w / 2 - 0.22;
    parts.push(
      span('trim', [kx - 0.07, kx + 0.07], [yU - 0.03, yU], [d / 2 - 0.08, d / 2 - 0.01], { bevel: 0.006, plan: false }),
      span('frame', [kx - 0.06, kx - 0.025], [yU - 0.022, yU - 0.008], [d / 2 - 0.012, d / 2 - 0.007], { plan: false }),
      ...[-0.005, 0.015, 0.035, 0.055].map((bx) => cyl('frame', [kx + bx, yU - 0.015, d / 2 - 0.009], 0.006, 0.004, { rotation: [Math.PI / 2, 0, 0], plan: false })),
    );
    // Desk mat and notebook.
    const padW = Math.min(0.8, w * 0.55);
    const padD = Math.min(0.32, d * 0.45);
    parts.push(span('items', [-padW / 2, padW / 2], [h, h + 0.003], [d / 2 - 0.05 - padD, d / 2 - 0.05], { bevel: 0.001, plan: false }));
    parts.push(...notebookAndPen('trim', 'trim', [-padW / 2 + 0.12, d / 2 - 0.05 - padD / 2], h + 0.003, 0.35));
    return parts;
  },
  planDetail: ({ w, d }) => {
    const padW = Math.min(0.8, w * 0.55);
    const padD = Math.min(0.32, d * 0.45);
    return [
      rectPoly(-padW / 2, d / 2 - 0.05 - padD, padW / 2, d / 2 - 0.05),
      poly(turnedRect(-padW / 2 + 0.12, d / 2 - 0.05 - padD / 2, 0.15, 0.21, 0.35)),
    ];
  },
});

const deskHutch = defineAsset({
  id: 'desk-hutch',
  name: 'Desk with hutch',
  category: 'office',
  type: 'surfaces',
  group: 'Desks',
  tags: ['desk', 'hutch', 'secretary', 'bureau', 'shelves', 'study', 'homework'],
  defaultSize: { w: 1.2, d: 0.6, h: 1.7 },
  minSize: { w: 0.9, d: 0.5, h: 1.4 },
  maxSize: { w: 1.6, d: 0.75, h: 2.0 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Carcass', 'wood-painted-white'),
    matSlot('top', 'Worktop', 'wood-oak-light'),
    matSlot('handle', 'Knobs & pen pot', 'metal-brass'),
    matSlot('books', 'Books', 'book-mix'),
  ],
  build: ({ w, d, h }) => {
    const deskY = 0.75;
    const t = 0.025;
    const st = 0.02;
    const hd = Math.min(0.28, d * 0.45);
    const zh = -d / 2 + hd;
    const parts: Part[] = [
      span('top', [-w / 2 + 0.005, w / 2 - 0.005], [deskY - t, deskY], [-d / 2, d / 2], { bevel: 0.004 }),
      // Panel ends and a back stretcher.
      span('body', [-w / 2, -w / 2 + st], [0, deskY - t], [-d / 2, d / 2 - 0.01], { plan: false }),
      span('body', [w / 2 - st, w / 2], [0, deskY - t], [-d / 2, d / 2 - 0.01], { plan: false }),
      span('body', [-w / 2 + st, w / 2 - st], [deskY - t - 0.25, deskY - t], [-d / 2 + 0.01, -d / 2 + 0.028], { plan: false }),
      // Hutch: sides, back, crown.
      span('body', [-w / 2, -w / 2 + st], [deskY, h - 0.03], [-d / 2, zh], { plan: false }),
      span('body', [w / 2 - st, w / 2], [deskY, h - 0.03], [-d / 2, zh], { plan: false }),
      span('body', [-w / 2 + st, w / 2 - st], [deskY, h - 0.03], [-d / 2, -d / 2 + 0.01], { plan: false }),
      span('body', [-w / 2, w / 2], [h - 0.03, h], [-d / 2, zh + 0.015], { bevel: 0.004, plan: false }),
    ];
    // Centre drawer under the worktop.
    const dw = Math.min(0.35, (w - 0.05) * 0.35);
    const zf = d / 2 - 0.03;
    parts.push(span('body', [-dw, dw], [deskY - t - 0.11, deskY - t], [-d / 2 + 0.05, zf], { plan: false }));
    parts.push(...shakerFront('body', [-dw, dw], [deskY - t - 0.11, deskY - t - 0.002], zf, 0.018, { rail: 0.035 }));
    for (const x of [-dw * 0.5, dw * 0.5]) parts.push(...knob('handle', [x, deskY - t - 0.055, zf + 0.018], 0.012));
    // Hutch shelves: a tall open bay above the worktop, then rows of cubbies.
    const yS1 = deskY + clamp((h - deskY) * 0.42, 0.3, 0.45);
    const innerTop = h - 0.03;
    const rows = clamp(Math.floor((innerTop - yS1) / 0.3), 1, 2);
    const rowSpans = cellSpans(rows, yS1, innerTop);
    const cols = clamp(Math.round(w / 0.45), 2, 3);
    const colSpans = cellSpans(cols, -w / 2 + st, w / 2 - st);
    parts.push(span('body', [-w / 2 + st, w / 2 - st], [yS1 - st, yS1], [-d / 2 + 0.01, zh], { plan: false }));
    for (const [, y1] of rowSpans.slice(0, -1)) {
      parts.push(span('body', [-w / 2 + st, w / 2 - st], [y1 - st / 2, y1 + st / 2], [-d / 2 + 0.01, zh], { plan: false }));
    }
    for (const [x0] of colSpans.slice(1)) {
      parts.push(span('body', [x0 - st / 2, x0 + st / 2], [yS1, innerTop], [-d / 2 + 0.01, zh], { plan: false }));
    }
    rowSpans.forEach(([ry0, ry1], r) => {
      const y0 = ry0 + (r === 0 ? 0 : st / 2);
      const y1 = ry1 - (r === rows - 1 ? 0 : st / 2);
      colSpans.forEach(([cx0, cx1], c) => {
        const x0 = cx0 + (c === 0 ? 0 : st / 2);
        const x1 = cx1 - (c === cols - 1 ? 0 : st / 2);
        const k = r * cols + c;
        if (k === cols - 1) {
          // One cubby with a little shaker door.
          parts.push(...shakerFront('body', [x0, x1], [y0, y1], zh, 0.016, { rail: 0.035 }));
          parts.push(...knob('handle', [x0 + 0.035, (y0 + y1) / 2, zh + 0.016], 0.011));
        } else {
          const bh = Math.min(0.24, y1 - y0 - 0.03);
          parts.push(...bookRow('books', [x0, x1], y0, -d / 2 + 0.02, bh, Math.min(0.2, hd - 0.04), 31 + k * 7, { fill: k % 2 ? 0.55 : 0.8, lean: true }));
        }
      });
    });
    // On the worktop: a mug, a pen pot with pencils and two books lying flat.
    const frontZone = (zh + d / 2) / 2;
    parts.push(...mug('body', [w / 2 - 0.16, frontZone - 0.04], deskY));
    parts.push(cyl('handle', [-w / 2 + 0.12, deskY + 0.05, zh + 0.07], 0.035, 0.1, { segments: 20, plan: false }));
    const rand = rng(5);
    for (const i of range(4)) {
      const a = (i / 4) * Math.PI * 2;
      const bx = -w / 2 + 0.12 + Math.cos(a) * 0.015;
      const bz = zh + 0.07 + Math.sin(a) * 0.015;
      parts.push(rod('books', [bx, deskY + 0.02, bz], [bx + Math.cos(a) * 0.03, deskY + 0.17 + rand() * 0.03, bz + Math.sin(a) * 0.03], 0.004, { plan: false }));
    }
    parts.push(
      box('books', [-w / 2 + 0.3, deskY + 0.014, zh + 0.11], [0.17, 0.028, 0.24], { rotation: [0, 0.1, 0], plan: false }),
      box('books', [-w / 2 + 0.3, deskY + 0.04, zh + 0.11], [0.15, 0.024, 0.21], { rotation: [0, -0.06, 0], plan: false }),
    );
    return parts;
  },
  planDetail: ({ w, d }) => {
    const hd = Math.min(0.28, d * 0.45);
    return [line([-w / 2, -d / 2 + hd], [w / 2, -d / 2 + hd]), circle([w / 2 - 0.16, (-d / 2 + hd + d / 2) / 2 - 0.04], 0.04)];
  },
});

// ---------------------------------------------------------------------------
// Chairs
// ---------------------------------------------------------------------------

const STAR_ANGLES = [0, 1, 2, 3, 4].map((k) => Math.PI / 2 + (k * 2 * Math.PI) / 5);
const starRadius = (w: number, d: number): number => Math.min(w, d) / 2 - 0.03;

/**
 * Five-star swivel base: tapered legs on twin-wheel casters, a hub, the black gas-lift shroud and
 * chrome piston up to the tilt mechanism at `topY`. Legs/hub use `baseSlot`, the rest `frameSlot`.
 */
function swivelBase(baseSlot: string, frameSlot: string, R: number, topY: number): Part[] {
  const parts: Part[] = [];
  for (const a of STAR_ANGLES) {
    const c = Math.cos(a);
    const s = Math.sin(a);
    const L = R - 0.03;
    parts.push(box(baseSlot, [(L / 2 + 0.02) * c, 0.085, (L / 2 + 0.02) * s], [L, 0.03, 0.045], { rotation: [0, -a, 0], bevel: 0.008 }));
    parts.push(box(baseSlot, [(R - 0.01) * c, 0.08, (R - 0.01) * s], [0.04, 0.025, 0.04], { rotation: [0, -a, 0], bevel: 0.006, plan: false }));
    // Twin-wheel caster with its swivel stem.
    parts.push(vcyl(frameSlot, R * c, R * s, 0.05, 0.07, 0.008, { plan: false }));
    const tx = -s * 0.016;
    const tz = c * 0.016;
    parts.push(rod(frameSlot, [R * c - tx, 0.026, R * s - tz], [R * c + tx, 0.026, R * s + tz], 0.025, { segments: 16, plan: false }));
    parts.push(span(frameSlot, [R * c - 0.014, R * c + 0.014], [0.04, 0.055], [R * s - 0.014, R * s + 0.014], { bevel: 0.004, plan: false }));
  }
  parts.push(cyl(baseSlot, [0, 0.085, 0], 0.055, 0.045, { rTop: 0.04, segments: 24, plan: false }));
  const pistonTop = topY;
  const shroudTop = 0.11 + (pistonTop - 0.11) * 0.55;
  parts.push(vcyl(frameSlot, 0, 0, 0.1, shroudTop, 0.03, { segments: 20, plan: false }));
  parts.push(vcyl(baseSlot, 0, 0, shroudTop, pistonTop, 0.016, { plan: false }));
  return parts;
}

const chairGaming = defineAsset({
  id: 'chair-gaming',
  name: 'Gaming chair',
  category: 'office',
  type: 'seating',
  group: 'Desk chairs',
  tags: ['chair', 'gaming chair', 'racing chair', 'desk chair', 'swivel', 'esports'],
  defaultSize: { w: 0.7, d: 0.7, h: 1.32 },
  minSize: { w: 0.6, d: 0.6, h: 1.15 },
  maxSize: { w: 0.8, d: 0.8, h: 1.45 },
  slots: [
    matSlot('upholstery', 'Upholstery', 'leather-black'),
    matSlot('accent', 'Accent panels', 'solid-red'),
    matSlot('frame', 'Shell & arms', 'plastic-black'),
    matSlot('base', 'Base', 'metal-black-matte'),
  ],
  build: ({ w, d, h }) => {
    const R = starRadius(w, d);
    const seatY = clamp(h * 0.36, 0.44, 0.52);
    const bw = Math.min(0.56, w - 0.12);
    const zb0 = -d / 2 + 0.17;
    const zs1 = d / 2 - 0.03;
    const parts: Part[] = swivelBase('base', 'base', R, seatY - 0.12);
    parts.push(span('frame', [-0.11, 0.11], [seatY - 0.12, seatY - 0.08], [-0.13, 0.13], { bevel: 0.008, plan: false }));
    parts.push(rodX('frame', 0.11, 0.18, seatY - 0.1, 0.08, 0.006, { plan: false }));
    // Bucket seat: flat centre, raised side bolsters with accent strips.
    parts.push(span('frame', [-bw / 2 + 0.02, bw / 2 - 0.02], [seatY - 0.09, seatY - 0.065], [zb0 - 0.01, zs1 - 0.01], { bevel: 0.01 }));
    parts.push(span('upholstery', [-bw * 0.33, bw * 0.33], [seatY - 0.07, seatY], [zb0 - 0.02, zs1], { bevel: 0.022 }));
    for (const side of [-1, 1]) {
      const xi = side * bw * 0.33;
      const xo = side * bw / 2;
      parts.push(span('upholstery', [Math.min(xi, xo), Math.max(xi, xo)], [seatY - 0.075, seatY + 0.04], [zb0 - 0.02, zs1], { bevel: 0.035 }));
      const sx = side * (bw * 0.33 + 0.012);
      parts.push(span('accent', [sx - 0.01, sx + 0.01], [seatY + 0.005, seatY + 0.03], [zb0, zs1 - 0.02], { bevel: 0.006, plan: false }));
    }
    // Reclined racing back built in its own tilted frame (hinge at the seat's rear edge).
    const tau = 0.1;
    const c = Math.cos(tau);
    const s = Math.sin(tau);
    const Hb = (h - 0.015 - seatY + 0.09 * s) / c;
    const P = (x: number, y: number, z: number): V3 => [x, seatY + y * c + z * s, zb0 - y * s + z * c];
    const tb = (slot: string, x: V2, y: V2, z: V2, bevel: number): Part =>
      box(slot, P((x[0] + x[1]) / 2, (y[0] + y[1]) / 2, (z[0] + z[1]) / 2), [x[1] - x[0], y[1] - y[0], z[1] - z[0]], {
        rotation: [-tau, 0, 0],
        bevel,
        plan: false,
      });
    parts.push(
      tb('frame', [-bw / 2 + 0.01, bw / 2 - 0.01], [0.0, Hb - 0.02], [-0.09, -0.07], 0.01),
      tb('upholstery', [-bw * 0.3, bw * 0.3], [0.04, Hb - 0.22], [-0.075, 0], 0.025),
      tb('upholstery', [-bw * 0.32, bw * 0.32], [Hb - 0.22, Hb], [-0.075, 0], 0.035),
    );
    for (const side of [-1, 1]) {
      const span2 = (a: number, b: number): V2 => [Math.min(side * a, side * b), Math.max(side * a, side * b)];
      parts.push(
        tb('upholstery', span2(bw * 0.32, bw / 2), [0.02, Hb * 0.62], [-0.085, 0.045], 0.035),
        tb('upholstery', span2(bw * 0.32, bw * 0.44), [Hb * 0.62, Hb - 0.22], [-0.085, 0.02], 0.03),
        tb('accent', span2(bw * 0.3, bw * 0.34), [0.06, Hb - 0.24], [-0.07, 0.006], 0.008),
        tb('frame', span2(0.05, 0.1), [Hb - 0.085, Hb - 0.055], [-0.003, 0.004], 0.003),
      );
    }
    // Neck and lumbar pillows strapped to the back.
    const neck = P(0, Hb - 0.15, 0.045);
    const lumbar = P(0, 0.2, 0.05);
    parts.push(pillow('upholstery', neck, 0.26, 0.13, 0.08, { lean: tau }));
    parts.push(pillow('accent', lumbar, 0.3, 0.15, 0.09, { lean: tau }));
    // Recline brackets and padded 4D arms.
    for (const side of [-1, 1]) {
      const ax = side * (bw / 2 + 0.012);
      parts.push(span('frame', [ax - 0.012, ax + 0.012], [seatY - 0.09, seatY + 0.07], [zb0 - 0.06, zb0 + 0.04], { bevel: 0.006, plan: false }));
      const px = side * (bw / 2 + 0.02);
      parts.push(span('frame', [Math.min(side * 0.11, px), Math.max(side * 0.11, px)], [seatY - 0.11, seatY - 0.09], [-0.03, 0.03], { plan: false }));
      parts.push(span('frame', [px - 0.016, px + 0.016], [seatY - 0.11, seatY + 0.2], [-0.03, 0.03], { bevel: 0.006, plan: false }));
      parts.push(span('upholstery', [px - 0.04, px + 0.04], [seatY + 0.2, seatY + 0.235], [-0.12, 0.13], { bevel: 0.014 }));
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const R = starRadius(w, d);
    return STAR_ANGLES.map((a) => circle([R * Math.cos(a), R * Math.sin(a)], 0.025));
  },
});

// ---------------------------------------------------------------------------
// Lamp, storage and accessories
// ---------------------------------------------------------------------------

function taskLampLayout(w: number, d: number, h: number) {
  const baseR = Math.min(w / 2, d * 0.22, 0.09);
  const zb = -d / 2 + baseR;
  const shadeR = Math.min(w / 2, 0.075);
  const shadeH = Math.min(0.13, h * 0.3);
  const zh = d / 2 - shadeR;
  const yHead = h - 0.02;
  return { baseR, zb, shadeR, shadeH, zh, yHead, shadeBottom: yHead - 0.01 - shadeH };
}

const taskLamp = defineAsset({
  id: 'task-lamp',
  name: 'Desk task lamp',
  category: 'office',
  type: 'lighting',
  group: 'Table lamps',
  tags: ['lamp', 'desk lamp', 'task light', 'reading', 'anglepoise'],
  defaultSize: { w: 0.18, d: 0.45, h: 0.55 },
  minSize: { w: 0.14, d: 0.3, h: 0.35 },
  maxSize: { w: 0.3, d: 0.7, h: 0.9 },
  // Sits on a desk top by default.
  defaultElevation: 0.75,
  slots: [matSlot('base', 'Body', 'metal-black-matte'), matSlot('light', 'Diffuser', 'light-warm')],
  light: (() => {
    const L = taskLampLayout(0.18, 0.45, 0.55);
    return { color: '#ffd9a8', intensity: 0.8, distance: 2.5, y: L.shadeBottom, z: L.zh, kind: 'spot' as const, angle: 0.6, penumbra: 0.5 };
  })(),
  build: ({ w, d, h }) => {
    const L = taskLampLayout(w, d, h);
    const pivot: V3 = [0, 0.05, L.zb];
    const elbow: V3 = [0, h * 0.78, L.zb + (L.zh - L.zb) * 0.2];
    const head: V3 = [0, L.yHead, L.zh];
    const parts: Part[] = [
      // Weighted stepped base with a rocker switch.
      lathe(
        'base',
        [0, 0, L.zb],
        [
          [0, 0],
          [L.baseR, 0],
          [L.baseR, 0.014],
          [L.baseR * 0.82, 0.024],
          [L.baseR * 0.35, 0.03],
          [0, 0.03],
        ],
        { segments: 32 },
      ),
      span('base', [-0.01, 0.01], [0.012, 0.03], [L.zb + L.baseR * 0.55, L.zb + L.baseR * 0.55 + 0.022], { bevel: 0.003, plan: false }),
      // Yoke and pivot knuckle.
      span('base', [-0.017, -0.011], [0.025, 0.065], [L.zb - 0.013, L.zb + 0.013], { plan: false }),
      span('base', [0.011, 0.017], [0.025, 0.065], [L.zb - 0.013, L.zb + 0.013], { plan: false }),
      rodX('base', -0.024, 0.024, pivot[1], pivot[2], 0.009, { plan: false }),
      rodX('base', -0.018, 0.018, elbow[1], elbow[2], 0.013, { plan: false }),
      rodX('base', -0.016, 0.016, head[1], head[2], 0.011, { plan: false }),
    ];
    // Twin-rod arms with balance springs alongside.
    for (const x of [-0.008, 0.008]) {
      parts.push(rod('base', [x, pivot[1], pivot[2]], [x, elbow[1], elbow[2]], 0.0045, { plan: false }));
      parts.push(rod('base', [x, elbow[1], elbow[2]], [x, head[1], head[2]], 0.0045, { plan: false }));
    }
    const sx = 0.02;
    parts.push(rod('base', [sx, pivot[1] + 0.04, pivot[2] + 0.005], [sx, (pivot[1] + elbow[1]) / 2, (pivot[2] + elbow[2]) / 2], 0.004, { plan: false }));
    parts.push(rod('base', [-sx, elbow[1] - 0.005, elbow[2] + 0.01], [-sx, (elbow[1] + head[1]) / 2, (elbow[2] + head[2]) / 2], 0.004, { plan: false }));
    // Conical shade with a rolled rim, socket cap and the glowing diffuser.
    parts.push(
      cyl('base', [0, L.yHead - 0.01 - L.shadeH / 2, L.zh], L.shadeR, L.shadeH, { rTop: L.shadeR * 0.4, segments: 32 }),
      cyl('base', [0, L.yHead - 0.004, L.zh], L.shadeR * 0.32, 0.016, { segments: 20, plan: false }),
      cyl('base', [0, L.shadeBottom + 0.003, L.zh], L.shadeR + 0.002, 0.006, { segments: 32, plan: false }),
      cyl('light', [0, L.shadeBottom + 0.004, L.zh], L.shadeR - 0.008, 0.004, { segments: 32, plan: false }),
    );
    return parts;
  },
});

const pinboard = defineAsset({
  id: 'pinboard',
  name: 'Cork pinboard',
  category: 'office',
  type: 'storage',
  group: 'Office storage',
  tags: ['pinboard', 'cork board', 'notice board', 'memo board', 'bulletin board', 'notes'],
  defaultSize: { w: 0.9, d: 0.03, h: 0.6 },
  minSize: { w: 0.4, d: 0.02, h: 0.3 },
  maxSize: { w: 1.8, d: 0.05, h: 1.2 },
  mount: 'wall',
  defaultElevation: 1.05,
  slots: [
    matSlot('frame', 'Frame', 'wood-oak-light'),
    matSlot('cork', 'Cork', 'cork'),
    matSlot('notes', 'Notes & photos', 'paper-art'),
    matSlot('pins', 'Pins', 'plastic-red'),
  ],
  build: ({ w, d, h }) => {
    const ft = Math.min(0.03, w * 0.06, h * 0.08);
    const zFront = d / 2 - 0.006;
    const zCork = d / 2 - 0.014;
    const parts: Part[] = [
      span('cork', [-w / 2 + 0.004, w / 2 - 0.004], [0.004, h - 0.004], [-d / 2, zCork]),
      ...frame4('frame', [-w / 2, w / 2], [0, h], [-d / 2, zFront], ft, { plan: true }),
    ];
    const nx = clamp(Math.round((w - 2 * ft) / 0.2), 1, 8);
    const ny = clamp(Math.round((h - 2 * ft) / 0.18), 1, 5);
    const rand = rng(11);
    const xs = cellSpans(nx, -w / 2 + ft + 0.01, w / 2 - ft - 0.01);
    const ys = cellSpans(ny, ft + 0.01, h - ft - 0.01);
    for (const [y0, y1] of ys) {
      for (const [x0, x1] of xs) {
        if (rand() < 0.3) continue;
        const cw = x1 - x0;
        const ch = y1 - y0;
        const big = rand() < 0.3;
        const nw = Math.min(cw * 0.8, big ? 0.15 : 0.09);
        const nh = Math.min(ch * 0.8, big ? 0.11 : 0.09);
        const cx = (x0 + x1) / 2 + (rand() - 0.5) * (cw - nw) * 0.6;
        const cy = (y0 + y1) / 2 + (rand() - 0.5) * (ch - nh) * 0.6;
        const tilt = (rand() - 0.5) * 0.25;
        parts.push(box('notes', [cx, cy, zCork + 0.001], [nw, nh, 0.002], { rotation: [0, 0, tilt], plan: false }));
        parts.push(sphere('pins', [cx, cy + nh * 0.36, zCork + 0.006], 0.005, { plan: false }));
      }
    }
    return parts;
  },
});

const globeDesk = defineAsset({
  id: 'globe-desk',
  name: 'Desk globe',
  category: 'office',
  type: 'activities',
  group: 'Knowledge',
  tags: ['globe', 'world', 'map', 'geography', 'study', 'ornament'],
  defaultSize: { w: 0.32, d: 0.32, h: 0.45 },
  minSize: { w: 0.2, d: 0.2, h: 0.28 },
  maxSize: { w: 0.5, d: 0.5, h: 0.7 },
  // Sits on a desk top by default.
  defaultElevation: 0.75,
  slots: [
    matSlot('base', 'Stand', 'wood-walnut'),
    matSlot('meridian', 'Meridian', 'metal-brass'),
    matSlot('globe', 'Oceans', 'ceramic-blue'),
    matSlot('land', 'Continents', 'solid-green'),
  ],
  build: ({ w, d, h }) => {
    const m = Math.min(w, d);
    const baseR = m / 2 * 0.62;
    const R = Math.max(0.05, Math.min(m / 2 - 0.035, (h - 0.12) / 2));
    const Rm = R + 0.012;
    const yc = h - Rm - 0.008;
    const tilt = 0.41;
    const ax: V3 = [Math.sin(tilt), Math.cos(tilt), 0];
    const ux: V3 = [-Math.cos(tilt), Math.sin(tilt), 0];
    const at = (t: number, r: number): V3 => [
      r * (Math.sin(t) * ax[0] + Math.cos(t) * ux[0]),
      yc + r * (Math.sin(t) * ax[1] + Math.cos(t) * ux[1]),
      0,
    ];
    const south = at(-Math.PI / 2, Rm);
    const parts: Part[] = [
      lathe(
        'base',
        [0, 0, 0],
        [
          [0, 0],
          [baseR, 0],
          [baseR, 0.012],
          [baseR * 0.8, 0.022],
          [baseR * 0.35, 0.03],
          [baseR * 0.22, 0.05],
          [0, 0.05],
        ],
        { segments: 28 },
      ),
      // Turned stem up to the meridian's south end.
      rod('base', [0, 0.045, 0], south, 0.012, { plan: false }),
      sphere('meridian', south, 0.012, { plan: false }),
      sphere('globe', [0, yc, 0], R, { plan: false }),
      // Axis pins.
      sphere('meridian', [ax[0] * (R + 0.006), yc + ax[1] * (R + 0.006), 0], 0.007, { plan: false }),
      sphere('meridian', [-ax[0] * (R + 0.006), yc - ax[1] * (R + 0.006), 0], 0.007, { plan: false }),
    ];
    // Half meridian ring as a chain of short rods.
    const seg = 14;
    const pts = range(seg + 1).map((i) => at(-Math.PI / 2 + (i / seg) * Math.PI, Rm));
    parts.push(...rodPath('meridian', pts, 0.0045));
    // Continents: clusters of shallow bumps on the sphere surface.
    const rand = rng(23);
    const centres: [number, number][] = [
      [0.6, 0.5],
      [0.9, -0.4],
      [2.6, 0.6],
      [2.9, -0.1],
      [3.5, 0.4],
      [4.6, 0.7],
      [5.4, -0.5],
      [1.8, -0.9],
    ];
    for (const [lon0, lat0] of centres) {
      const n = 3 + Math.floor(rand() * 2);
      for (let i = 0; i < n; i++) {
        const lon = lon0 + (rand() - 0.5) * 0.6;
        const lat = clamp(lat0 + (rand() - 0.5) * 0.5, -1.3, 1.3);
        const br = R * (0.18 + rand() * 0.1);
        const rr = R - br * 0.72;
        // Positions in the globe's own frame (Y = polar axis), then tilted with the axis.
        const lx = rr * Math.cos(lat) * Math.cos(lon);
        const ly = rr * Math.sin(lat);
        const lz = rr * Math.cos(lat) * Math.sin(lon);
        const wx = lx * Math.cos(tilt) + ly * Math.sin(tilt);
        const wy = -lx * Math.sin(tilt) + ly * Math.cos(tilt);
        parts.push(sphere('land', [wx, yc + wy, lz], br, { plan: false }));
      }
    }
    return parts;
  },
  planDetail: ({ w, d, h }) => {
    const m = Math.min(w, d);
    const R = Math.max(0.05, Math.min(m / 2 - 0.035, (h - 0.12) / 2));
    return [circle([0, 0], R)];
  },
});

export const OFFICE_ASSETS: AssetDefinition[] = [
  desk,
  deskL,
  deskExecutive,
  deskStanding,
  deskHutch,
  chairGaming,
  taskLamp,
  pinboard,
  globeDesk,
];

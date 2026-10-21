import type { AssetDefinition, Part, PlanStroke, Size3 } from './types';
import {
  barPull,
  cellSpans,
  cells,
  circle,
  clamp,
  cyl,
  defineAsset,
  discZ,
  ellipsePoints,
  frame4,
  lathe,
  legs4,
  lerp,
  line,
  matSlot,
  mirrorZ,
  poly,
  rectPoly,
  ring,
  rng,
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

/** Standard kitchen joinery dimensions (metres). */
const PLINTH = 0.1;
const TOP_T = 0.04;
const FRONT_T = 0.02;
const HANDLE_D = 0.025;
/** Carcass front plane for a unit of depth d (fronts + handles sit in front of it). */
const faceZ = (d: number): number => d / 2 - FRONT_T - HANDLE_D;

const FRONT_SLOT = matSlot('front', 'Fronts & carcass', 'laminate-white-matte');
const WORKTOP_SLOT = matSlot('worktop', 'Worktop', 'stone-marble-carrara');
const HANDLE_SLOT = matSlot('handle', 'Handles', 'metal-brushed-steel');

// ---------------------------------------------------------------------------
// Shared joinery helpers
// ---------------------------------------------------------------------------

interface Pull {
  x: number;
  y: number;
  len: number;
  vertical?: boolean;
}

const shakerRail = (x: V2, y: V2): number => clamp(Math.min(x[1] - x[0], y[1] - y[0]) * 0.14, 0.035, 0.07);

/** Shaker door/drawer front whose back face is at `zFace`, with an optional bar pull. */
function cabinetFront(x: V2, y: V2, zFace: number, pull: Pull | null, slot = 'front', handleSlot = 'handle'): Part[] {
  const parts = shakerFront(slot, x, y, zFace, FRONT_T, { rail: shakerRail(x, y) });
  if (pull) {
    parts.push(...barPull(handleSlot, [pull.x, pull.y, zFace + FRONT_T], pull.len, { vertical: pull.vertical, stand: 0.02 }));
  }
  return parts;
}

const drawerPull = (x: V2, y: V2): Pull => ({
  x: (x[0] + x[1]) / 2,
  y: (y[0] + y[1]) / 2,
  len: clamp((x[1] - x[0]) * 0.4, 0.1, 0.32),
});

/** Vertical pull near the opening edge of a door, close to its top or bottom. */
function doorPull(x: V2, y: V2, side: 'l' | 'r', near: 'top' | 'bottom'): Pull {
  const len = clamp((y[1] - y[0]) * 0.3, 0.08, 0.16);
  const inset = Math.min(0.04, (x[1] - x[0]) * 0.15);
  return {
    x: side === 'l' ? x[0] + inset : x[1] - inset,
    y: near === 'top' ? y[1] - 0.05 - len / 2 : y[0] + 0.05 + len / 2,
    len,
    vertical: true,
  };
}

/** One door (or a pair above 0.65 m) across [x0, x1]; paired pulls meet in the middle. */
function doorRow(x0: number, x1: number, y: V2, zFace: number, near: 'top' | 'bottom', handleSlot = 'handle'): Part[] {
  const n = x1 - x0 > 0.65 ? 2 : 1;
  return cellSpans(n, x0, x1).flatMap((x, i) =>
    cabinetFront(x, y, zFace, doorPull(x, y, n === 2 && i === 1 ? 'l' : 'r', near), 'front', handleSlot),
  );
}

/** Recessed plinth + carcass box from the plinth up to `carcassTop`. */
function baseShell(w: number, d: number, carcassTop: number): Part[] {
  const zf = faceZ(d);
  return [
    span('front', [-w / 2 + 0.004, w / 2 - 0.004], [0, PLINTH], [-d / 2, zf - 0.05], { plan: false }),
    span('front', [-w / 2, w / 2], [PLINTH, carcassTop], [-d / 2, zf]),
  ];
}

/** Worktop with a rectangular cut-out [cx0, cx1] × [cz0, cz1] (four slabs around the hole). */
function worktopAround(w: number, d: number, y: V2, cx: V2, cz: V2): Part[] {
  const parts: Part[] = [];
  const o = { bevel: 0.003 };
  if (cx[0] > -w / 2 + 0.001) parts.push(span('worktop', [-w / 2, cx[0]], y, [-d / 2, d / 2], o));
  if (cx[1] < w / 2 - 0.001) parts.push(span('worktop', [cx[1], w / 2], y, [-d / 2, d / 2], o));
  if (cz[0] > -d / 2 + 0.001) parts.push(span('worktop', cx, y, [-d / 2, cz[0]], o));
  if (cz[1] < d / 2 - 0.001) parts.push(span('worktop', cx, y, [cz[1], d / 2], o));
  return parts;
}

/** Cornice strip along the top front edge of a wall or tall unit. */
const cornice = (w: number, d: number, y: V2): Part =>
  span('front', [-w / 2, w / 2], y, [-d / 2, faceZ(d) + FRONT_T + 0.008], { bevel: 0.004, plan: false });

/** Swap x and z on plain boxes, turning a front that faces +z into one that faces +x. */
function swapXZ(parts: Part[]): Part[] {
  return parts.map((p) =>
    p.shape === 'box'
      ? { ...p, position: [p.position[2], p.position[1], p.position[0]], size: [p.size[2], p.size[1], p.size[0]] }
      : p,
  );
}

/** Bar pull on a front facing +x whose surface is at c[0]. */
function pullX(slot: string, c: V3, len: number, vertical: boolean): Part[] {
  const [x, y, z] = c;
  const st = 0.02;
  const r = 0.0055;
  const half = len / 2;
  const inset = Math.min(0.015, half * 0.3);
  const at = (s: number, k: number): V3 => (vertical ? [x + k, y + s, z] : [x + k, y, z + s]);
  return [
    rod(slot, at(-half, st), at(half, st), r, { plan: false }),
    rod(slot, at(-half + inset, 0), at(-half + inset, st), r * 0.8, { plan: false }),
    rod(slot, at(half - inset, 0), at(half - inset, st), r * 0.8, { plan: false }),
  ];
}

/**
 * Prism whose cross-section (`yz`, as [y, z] points) lies in the YZ plane, extruded along X over
 * `x`. Used for wedge shapes such as sloped hood canopies.
 */
function sideProfile(slot: string, yz: V2[], x: V2, plan = false): Part {
  const p: Part = {
    shape: 'prism',
    outline: yz.map(([y, z]) => [y, z] as V2),
    height: Math.max(0.002, x[1] - x[0]),
    position: [x[1], 0, 0],
    rotation: [0, 0, Math.PI / 2],
    slot,
  };
  if (!plan) p.plan = false;
  return p;
}

/**
 * Oven-style door: a slab with an inset window, a thin trim around the window and a long bar
 * handle along the top. The door's back face is at `zFace`.
 */
function applianceDoor(x: V2, y: V2, zFace: number, doorSlot: string, trimSlot: string, windowSlot: string): Part[] {
  const [x0, x1] = x;
  const [y0, y1] = y;
  const zs = zFace + FRONT_T;
  const wx: V2 = [x0 + 0.05, x1 - 0.05];
  const wy: V2 = [y0 + Math.min(0.06, (y1 - y0) * 0.15), y1 - Math.min(0.1, (y1 - y0) * 0.26)];
  return [
    span(doorSlot, [x0 + 0.0015, x1 - 0.0015], [y0 + 0.0015, y1 - 0.0015], [zFace, zs], { bevel: 0.004, plan: false }),
    span(windowSlot, wx, wy, [zs, zs + 0.002], { plan: false }),
    ...frame4(trimSlot, wx, wy, [zs, zs + 0.004], 0.008),
    ...barPull(trimSlot, [(x0 + x1) / 2, y1 - Math.min(0.045, (y1 - y0) * 0.12), zs], (x1 - x0) * 0.7, { stand: 0.02 }),
  ];
}

/**
 * Gooseneck mixer tap rising from `yBase` at (x, zt) to `yTop`, with its spout reaching `reach`
 * towards the front and a side lever. Hidden from the plan.
 */
export function gooseneckTap(slot: string, x: number, zt: number, yBase: number, yTop: number, reach: number): Part[] {
  const R = reach / 2;
  const tube = 0.011;
  const yc = yTop - R - tube;
  const o = { plan: false };
  return [
    vcyl(slot, x, zt, yBase, yBase + 0.012, 0.026, o),
    vcyl(slot, x, zt, yBase + 0.012, yc, 0.015, o),
    torus(slot, [x, yc, zt + R], R, tube, { rotation: [0, Math.PI / 2, 0], arc: Math.PI, plan: false }),
    vcyl(slot, x, zt + 2 * R, yc - 0.04, yc, tube, o),
    vcyl(slot, x, zt + 2 * R, yc - 0.052, yc - 0.04, 0.0135, o),
    sphere(slot, [x + 0.016, yBase + 0.1, zt], 0.012, o),
    rod(slot, [x + 0.016, yBase + 0.1, zt], [x + 0.075, yBase + 0.125, zt + 0.01], 0.0055, o),
  ];
}

// ---------------------------------------------------------------------------
// Cabinets
// ---------------------------------------------------------------------------

const baseCabinet = defineAsset({
  id: 'kitchen-base-cabinet',
  name: 'Kitchen base cabinet',
  category: 'kitchen',
  type: 'surfaces',
  group: 'Counters & cabinets',
  tags: ['cabinet', 'base unit', 'cupboard', 'counter', 'worktop', 'drawer', 'shaker'],
  defaultSize: { w: 0.6, d: 0.6, h: 0.9 },
  minSize: { w: 0.3, d: 0.45, h: 0.7 },
  maxSize: { w: 1.2, d: 0.7, h: 1.0 },
  wallSnap: true,
  slots: [FRONT_SLOT, WORKTOP_SLOT, HANDLE_SLOT],
  build: ({ w, d, h }) => {
    const y1 = h - TOP_T;
    const zf = faceZ(d);
    const drawerH = clamp((y1 - PLINTH) * 0.2, 0.12, 0.18);
    const X: V2 = [-w / 2, w / 2];
    const top: V2 = [y1 - drawerH, y1];
    return [
      ...baseShell(w, d, y1),
      span('worktop', X, [y1, h], [-d / 2, d / 2], { bevel: 0.004 }),
      ...cabinetFront(X, top, zf, drawerPull(X, top)),
      ...doorRow(-w / 2, w / 2, [PLINTH, y1 - drawerH], zf, 'top'),
    ];
  },
  planDetail: ({ w, d }) => [line([-w / 2, faceZ(d)], [w / 2, faceZ(d)])],
});

const wallCabinet = defineAsset({
  id: 'kitchen-wall-cabinet',
  name: 'Kitchen wall cabinet',
  category: 'kitchen',
  type: 'storage',
  group: 'Kitchen cabinets',
  tags: ['cabinet', 'wall unit', 'upper cabinet', 'cupboard', 'shaker'],
  defaultSize: { w: 0.6, d: 0.35, h: 0.72 },
  minSize: { w: 0.3, d: 0.25, h: 0.3 },
  maxSize: { w: 1.2, d: 0.45, h: 1.0 },
  mount: 'wall',
  defaultElevation: 1.45,
  slots: [FRONT_SLOT, HANDLE_SLOT],
  build: ({ w, d, h }) => {
    const zf = faceZ(d);
    const cr = Math.min(0.03, h * 0.08);
    return [
      span('front', [-w / 2, w / 2], [0, h - cr], [-d / 2, zf]),
      cornice(w, d, [h - cr, h]),
      ...doorRow(-w / 2, w / 2, [0, h - cr], zf, 'bottom'),
    ];
  },
  // High-level units are crossed through on plans.
  planDetail: ({ w, d }) => [line([-w / 2, -d / 2], [w / 2, d / 2]), line([-w / 2, d / 2], [w / 2, -d / 2])],
});

const tallCabinet = defineAsset({
  id: 'kitchen-tall-cabinet',
  name: 'Tall pantry cabinet',
  category: 'kitchen',
  type: 'storage',
  group: 'Kitchen cabinets',
  tags: ['pantry', 'larder', 'tall unit', 'cupboard', 'cabinet', 'shaker'],
  defaultSize: { w: 0.6, d: 0.6, h: 2.2 },
  minSize: { w: 0.3, d: 0.45, h: 1.6 },
  maxSize: { w: 1.2, d: 0.7, h: 2.5 },
  wallSnap: true,
  slots: [FRONT_SLOT, HANDLE_SLOT],
  build: ({ w, d, h }) => {
    const zf = faceZ(d);
    const cr = 0.03;
    const split = PLINTH + (h - PLINTH - cr) * 0.62;
    return [
      ...baseShell(w, d, h - cr),
      cornice(w, d, [h - cr, h]),
      ...doorRow(-w / 2, w / 2, [PLINTH, split], zf, 'top'),
      ...doorRow(-w / 2, w / 2, [split, h - cr], zf, 'bottom'),
    ];
  },
  planDetail: ({ w, d }) => [line([-w / 2, faceZ(d)], [w / 2, faceZ(d)])],
});

const island = defineAsset({
  id: 'kitchen-island',
  name: 'Kitchen island',
  category: 'kitchen',
  type: 'surfaces',
  group: 'Counters & cabinets',
  tags: ['island', 'breakfast bar', 'counter', 'waterfall', 'peninsula'],
  defaultSize: { w: 1.8, d: 0.9, h: 0.92 },
  minSize: { w: 1.0, d: 0.6, h: 0.85 },
  maxSize: { w: 3.0, d: 1.4, h: 1.1 },
  slots: [WORKTOP_SLOT, matSlot('front', 'Fronts', 'laminate-sage'), HANDLE_SLOT],
  build: ({ w, d, h }) => {
    const t = 0.04;
    const overhang = clamp(d * 0.33, 0.2, 0.35);
    const zc = d / 2 - overhang;
    const xi: V2 = [-w / 2 + t, w / 2 - t];
    const yTop = h - t;
    const parts: Part[] = [
      span('worktop', [-w / 2, w / 2], [yTop, h], [-d / 2, d / 2], { bevel: 0.004 }),
      span('worktop', [-w / 2, -w / 2 + t], [0, yTop + 0.002], [-d / 2, d / 2], { bevel: 0.003 }),
      span('worktop', [w / 2 - t, w / 2], [0, yTop + 0.002], [-d / 2, d / 2], { bevel: 0.003 }),
      span('front', xi, [PLINTH, yTop], [-d / 2 + FRONT_T + HANDLE_D, zc]),
      span('front', xi, [0, PLINTH], [-d / 2 + 0.08, zc - 0.02], { plan: false }),
    ];
    // Drawers face the cook on the back (-z); the overhang at +z gives knee space for stools.
    const cols = cellSpans(clamp(Math.round((w - 2 * t) / 0.6), 1, 5), xi[0], xi[1]);
    const fr: Part[] = [];
    for (const x of cols) {
      const dr: V2 = [yTop - 0.2, yTop];
      const lo: V2 = [PLINTH, yTop - 0.2];
      fr.push(...cabinetFront(x, dr, faceZ(d), drawerPull(x, dr)));
      fr.push(...cabinetFront(x, lo, faceZ(d), { ...drawerPull(x, lo), y: lo[1] - 0.06 }));
      // Panelling on the seating side.
      parts.push(...shakerFront('front', x, [PLINTH, yTop], zc, 0.015, { rail: 0.06 }));
    }
    // Build on the +z side, then mirror onto the back face.
    parts.push(...mirrorZ(fr));
    // Footrest rail for the stools.
    const zr = Math.min(zc + 0.12, d / 2 - 0.03);
    parts.push(rodX('handle', xi[0] + 0.04, xi[1] - 0.04, 0.22, zr, 0.012, { plan: false }));
    for (const x of spaced(cols.length + 1, xi[0] + 0.08, xi[1] - 0.08)) {
      parts.push(rodZ('handle', x, 0.22, zc + 0.015, zr, 0.008, { plan: false }));
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const z = d / 2 - clamp(d * 0.33, 0.2, 0.35);
    return [line([-w / 2 + 0.04, z], [w / 2 - 0.04, z])];
  },
});

const CORNER_ARM = 0.6;

const cornerCabinet = defineAsset({
  id: 'kitchen-corner-cabinet',
  name: 'Corner base cabinet',
  category: 'kitchen',
  type: 'surfaces',
  group: 'Counters & cabinets',
  tags: ['corner', 'l-shaped', 'base unit', 'cabinet', 'counter', 'blind corner', 'worktop'],
  defaultSize: { w: 1.0, d: 1.0, h: 0.9 },
  minSize: { w: 0.9, d: 0.9, h: 0.8 },
  maxSize: { w: 1.2, d: 1.2, h: 1.0 },
  wallSnap: true,
  slots: [FRONT_SLOT, WORKTOP_SLOT, HANDLE_SLOT],
  build: ({ w, d, h }) => {
    const A = CORNER_ARM;
    const y1 = h - TOP_T;
    const zfB = -d / 2 + A - FRONT_T - HANDLE_D;
    const xfL = -w / 2 + A - FRONT_T - HANDLE_D;
    const drawerH = clamp((y1 - PLINTH) * 0.2, 0.12, 0.18);
    const top: V2 = [y1 - drawerH, y1];
    const low: V2 = [PLINTH, y1 - drawerH];
    const xB: V2 = [xfL + FRONT_T, w / 2];
    const zL: V2 = [zfB + FRONT_T, d / 2];
    const ySide = (zL[0] + zL[1]) / 2;
    const dp = doorPull(zL, low, 'r', 'top');
    return [
      span('front', [-w / 2, w / 2], [0, PLINTH], [-d / 2, zfB - 0.05], { plan: false }),
      span('front', [-w / 2, xfL - 0.05], [0, PLINTH], [zfB - 0.05, d / 2], { plan: false }),
      span('front', [-w / 2, w / 2], [PLINTH, y1], [-d / 2, zfB]),
      span('front', [-w / 2, xfL], [PLINTH, y1], [zfB, d / 2]),
      // Worktop in two rectangles so the plan reads as an L.
      span('worktop', [-w / 2, w / 2], [y1, h], [-d / 2, -d / 2 + A], { bevel: 0.004 }),
      span('worktop', [-w / 2, -w / 2 + A], [y1, h], [-d / 2 + A - 0.004, d / 2], { bevel: 0.004 }),
      // Back run (faces +z).
      ...cabinetFront(xB, top, zfB, drawerPull(xB, top)),
      ...cabinetFront(xB, low, zfB, doorPull(xB, low, 'r', 'top')),
      // Side run (faces +x).
      ...swapXZ(shakerFront('front', zL, top, xfL, FRONT_T, { rail: shakerRail(zL, top) })),
      ...swapXZ(shakerFront('front', zL, low, xfL, FRONT_T, { rail: shakerRail(zL, low) })),
      ...pullX('handle', [xfL + FRONT_T, (top[0] + top[1]) / 2, ySide], clamp((zL[1] - zL[0]) * 0.4, 0.1, 0.32), false),
      ...pullX('handle', [xfL + FRONT_T, dp.y, dp.x], dp.len, true),
    ];
  },
  planDetail: ({ w, d }) => {
    const zfB = -d / 2 + CORNER_ARM - FRONT_T - HANDLE_D;
    const xfL = -w / 2 + CORNER_ARM - FRONT_T - HANDLE_D;
    return [line([xfL, zfB], [w / 2, zfB]), line([xfL, zfB], [xfL, d / 2])];
  },
});

// ---------------------------------------------------------------------------
// Wet & hot units
// ---------------------------------------------------------------------------

const TAP_H = 0.27;

function sinkLayout(w: number, d: number, h: number) {
  const top = h - TAP_H;
  const drainer = w >= 0.95;
  const bw = drainer ? clamp(w * 0.5, 0.4, 0.6) : clamp(w - 0.2, 0.3, 0.8);
  const bx = drainer ? -w / 2 + 0.08 + bw / 2 : 0;
  const bd = clamp(d - 0.2, 0.3, 0.42);
  const bz = 0.03;
  return {
    top,
    drainer,
    bw,
    bx,
    bd,
    bz,
    bz0: bz - bd / 2,
    bz1: bz + bd / 2,
    zt: bz - bd / 2 - 0.045,
    dx: [bx + bw / 2 + 0.04, w / 2 - 0.05] as V2,
  };
}

const sinkUnit = defineAsset({
  id: 'kitchen-sink-unit',
  name: 'Sink unit',
  category: 'kitchen',
  type: 'plumbing',
  group: 'Sinks',
  tags: ['sink', 'basin', 'tap', 'faucet', 'base unit', 'kitchen sink', 'drainer'],
  defaultSize: { w: 0.8, d: 0.6, h: 0.9 + TAP_H },
  minSize: { w: 0.6, d: 0.5, h: 1.0 },
  maxSize: { w: 1.2, d: 0.7, h: 1.3 },
  wallSnap: true,
  slots: [
    FRONT_SLOT,
    WORKTOP_SLOT,
    matSlot('sink', 'Sink', 'metal-brushed-steel'),
    matSlot('tap', 'Tap & handles', 'metal-chrome'),
  ],
  build: ({ w, d, h }) => {
    const L = sinkLayout(w, d, h);
    const zf = faceZ(d);
    const yt0 = L.top - TOP_T;
    const yb = L.top - 0.2; // basin floor
    const wt = 0.008;
    const fl = 0.014; // flange
    const bx: V2 = [L.bx - L.bw / 2, L.bx + L.bw / 2];
    const bzr: V2 = [L.bz0, L.bz1];
    const yr: V2 = [L.top - 0.003, L.top + 0.002];
    const tilt = 0.12;
    const o = { plan: false };
    const parts: Part[] = [
      span('front', [-w / 2 + 0.004, w / 2 - 0.004], [0, PLINTH], [-d / 2, zf - 0.05], o),
      span('front', [-w / 2, w / 2], [PLINTH, yb - 0.01], [-d / 2, zf]),
      span('front', [-w / 2, -w / 2 + 0.018], [yb - 0.01, yt0], [-d / 2, zf], o),
      span('front', [w / 2 - 0.018, w / 2], [yb - 0.01, yt0], [-d / 2, zf], o),
      span('front', [-w / 2 + 0.018, w / 2 - 0.018], [yb - 0.01, yt0], [-d / 2, -d / 2 + 0.018], o),
      ...worktopAround(w, d, [yt0, L.top], [bx[0] - fl, bx[1] + fl], [bzr[0] - fl, bzr[1] + fl]),
      // Rim flange.
      span('sink', [bx[0] - fl, bx[1] + fl], yr, [bzr[0] - fl, bzr[0]], o),
      span('sink', [bx[0] - fl, bx[1] + fl], yr, [bzr[1], bzr[1] + fl], o),
      span('sink', [bx[0] - fl, bx[0]], yr, bzr, o),
      span('sink', [bx[1], bx[1] + fl], yr, bzr, o),
      // Bowl.
      span('sink', bx, [yb, yb + wt], bzr, o),
      span('sink', [bx[0], bx[0] + wt], [yb, yr[0]], bzr, o),
      span('sink', [bx[1] - wt, bx[1]], [yb, yr[0]], bzr, o),
      span('sink', [bx[0] + wt, bx[1] - wt], [yb, yr[0]], [L.bz0, L.bz0 + wt], o),
      span('sink', [bx[0] + wt, bx[1] - wt], [yb, yr[0]], [L.bz1 - wt, L.bz1], o),
      cyl('sink', [L.bx, yb + wt + 0.002, L.bz], 0.042, 0.004, o),
      ring('tap', [L.bx, yb + wt + 0.005, L.bz], 0.03, 0.004, o),
      cyl('tap', [L.bx, yb + wt + 0.005, L.bz], 0.014, 0.006, o),
      ...gooseneckTap('tap', L.bx, L.zt, L.top, h - 0.004, clamp(L.bd * 0.5, 0.14, 0.18)),
      // False drawer (tilt panel) and doors.
      ...cabinetFront([-w / 2, w / 2], [yt0 - tilt, yt0], zf, null),
      ...doorRow(-w / 2, w / 2, [PLINTH, yt0 - tilt], zf, 'top', 'tap'),
    ];
    if (L.drainer) {
      const dz: V2 = [bzr[0] - fl, bzr[1] + fl];
      parts.push(span('sink', L.dx, [L.top, L.top + 0.004], dz, { bevel: 0.0015, plan: false }));
      parts.push(
        ...slats('sink', [L.dx[0] + 0.02, L.dx[1] - 0.02], [L.top + 0.004, L.top + 0.007], [dz[0] + 0.03, dz[1] - 0.03], Math.round((L.dx[1] - L.dx[0] - 0.04) / 0.03), {
          axis: 'x',
          gap: 0.55,
          plan: false,
        }),
      );
    }
    return parts;
  },
  planDetail: ({ w, d, h }) => {
    const L = sinkLayout(w, d, h);
    const strokes: PlanStroke[] = [
      poly(roundRectPoints(L.bx, L.bz, L.bw - 0.02, L.bd - 0.02, 0.05)),
      circle([L.bx, L.bz], 0.035),
      circle([L.bx, L.zt], 0.02),
    ];
    if (L.drainer) {
      for (const x of spaced(4, L.dx[0] + 0.03, L.dx[1] - 0.03)) strokes.push(line([x, L.bz0 + 0.02], [x, L.bz1 - 0.02]));
    }
    return strokes;
  },
});

function hobLayout(w: number, d: number) {
  const hw = Math.min(w - 0.06, 0.58);
  const hd = Math.min(d - 0.1, 0.52);
  const r = Math.min(hw, hd) * 0.19;
  const burners: [number, number, number][] =
    hw >= 0.5
      ? [
          [-hw / 4, -hd / 4, r],
          [hw / 4, -hd / 4, r * 0.8],
          [-hw / 4, hd / 4, r * 0.8],
          [hw / 4, hd / 4, r],
        ]
      : [
          [0, -hd / 4, Math.min(r * 1.2, hd / 4 - 0.01)],
          [0, hd / 4, Math.min(r, hd / 4 - 0.01)],
        ];
  return { hw, hd, burners };
}

const cooktopUnit = defineAsset({
  id: 'kitchen-cooktop',
  name: 'Cooktop & oven unit',
  category: 'kitchen',
  type: 'appliances',
  group: 'Cooking',
  tags: ['hob', 'cooktop', 'stove', 'oven', 'range', 'cooker', 'induction'],
  defaultSize: { w: 0.6, d: 0.6, h: 0.9 },
  minSize: { w: 0.45, d: 0.5, h: 0.8 },
  maxSize: { w: 1.0, d: 0.7, h: 1.0 },
  wallSnap: true,
  slots: [
    FRONT_SLOT,
    WORKTOP_SLOT,
    matSlot('hob', 'Hob & oven glass', 'screen-black'),
    matSlot('metal', 'Metal trim', 'metal-brushed-steel'),
  ],
  build: ({ w, d, h }) => {
    const { hw, hd, burners } = hobLayout(w, d);
    const zf = faceZ(d);
    const zs = zf + FRONT_T;
    const yt0 = h - TOP_T;
    const ovenTop = yt0 - 0.1;
    const drawerTop = PLINTH + 0.14;
    const X: V2 = [-w / 2, w / 2];
    const o = { plan: false };
    const parts: Part[] = [
      ...baseShell(w, d, yt0),
      ...worktopAround(w, d, [yt0, h], [-hw / 2, hw / 2], [-hd / 2, hd / 2]),
      span('hob', [-hw / 2, hw / 2], [h - 0.045, h + 0.004], [-hd / 2, hd / 2], { bevel: 0.003 }),
    ];
    for (const [x, z, r] of burners) {
      parts.push(ring('metal', [x, h + 0.004, z], r, 0.0025, o));
      parts.push(ring('metal', [x, h + 0.004, z], r * 0.55, 0.0025, o));
    }
    // Touch slider between the zones (or beside them on a narrow hob).
    const sx = burners.length === 4 ? 0 : hw / 2 - 0.035;
    parts.push(span('metal', [sx - 0.008, sx + 0.008], [h + 0.004, h + 0.006], [-hd / 2 + 0.06, hd / 2 - 0.06], o));
    for (const z of spaced(3, -hd / 2 + 0.04, hd / 2 - 0.04)) {
      parts.push(cyl('metal', [sx + 0.02, h + 0.005, z], 0.006, 0.003, o));
    }
    // Control fascia with knobs and a clock display.
    const ky = (ovenTop + yt0) / 2;
    parts.push(span('metal', [-w / 2 + 0.0015, w / 2 - 0.0015], [ovenTop + 0.0015, yt0 - 0.0015], [zf, zs], { bevel: 0.003, plan: false }));
    parts.push(span('hob', [-0.05, 0.05], [ky - 0.018, ky + 0.018], [zs, zs + 0.003], o));
    for (const x of [-w / 2 + 0.07, -w / 2 + 0.14, w / 2 - 0.14, w / 2 - 0.07]) {
      parts.push(discZ('hob', [x, ky, zs + 0.011], 0.017, 0.022, o));
      parts.push(span('metal', [x - 0.003, x + 0.003], [ky - 0.013, ky + 0.013], [zs + 0.021, zs + 0.024], o));
    }
    parts.push(...applianceDoor(X, [drawerTop, ovenTop], zf, 'metal', 'metal', 'hob'));
    parts.push(...cabinetFront(X, [PLINTH, drawerTop], zf, drawerPull(X, [PLINTH, drawerTop]), 'front', 'metal'));
    return parts;
  },
  planDetail: ({ w, d }) => {
    const { hw, hd, burners } = hobLayout(w, d);
    const strokes: PlanStroke[] = [rectPoly(-hw / 2, -hd / 2, hw / 2, hd / 2)];
    for (const [x, z, r] of burners) {
      strokes.push(circle([x, z], r));
      strokes.push(circle([x, z], r * 0.55));
    }
    return strokes;
  },
});

const ovenTower = defineAsset({
  id: 'kitchen-oven-tower',
  name: 'Oven tower',
  category: 'kitchen',
  type: 'appliances',
  group: 'Cooking',
  tags: ['oven', 'microwave', 'tall unit', 'housing', 'appliance', 'built-in'],
  defaultSize: { w: 0.6, d: 0.6, h: 2.2 },
  minSize: { w: 0.55, d: 0.55, h: 1.8 },
  maxSize: { w: 0.9, d: 0.7, h: 2.5 },
  wallSnap: true,
  slots: [FRONT_SLOT, matSlot('appliance', 'Appliance glass', 'screen-black'), matSlot('handle', 'Handles & trim', 'metal-brushed-steel')],
  build: ({ w, d, h }) => {
    const zf = faceZ(d);
    const zs = zf + FRONT_T;
    const X: V2 = [-w / 2, w / 2];
    const cr = 0.03;
    const o = { plan: false };
    const dr: V2 = [PLINTH, 0.45];
    const parts: Part[] = [
      ...baseShell(w, d, h - cr),
      cornice(w, d, [h - cr, h]),
      ...cabinetFront(X, dr, zf, { ...drawerPull(X, dr), y: dr[1] - 0.05 }),
      ...applianceDoor(X, [0.45, 0.97], zf, 'appliance', 'handle', 'appliance'),
      // Control strip between the two ovens.
      span('appliance', [-w / 2 + 0.0015, w / 2 - 0.0015], [0.9715, 1.0485], [zf, zs], { bevel: 0.003, plan: false }),
      span('front', [-0.05, 0.05], [0.995, 1.025], [zs, zs + 0.002], o),
      ...applianceDoor(X, [1.05, 1.5], zf, 'appliance', 'handle', 'appliance'),
      ...doorRow(-w / 2, w / 2, [1.5, h - cr], zf, 'bottom'),
    ];
    for (const x of [-w / 2 + 0.07, -w / 2 + 0.13, w / 2 - 0.13, w / 2 - 0.07]) {
      parts.push(discZ('handle', [x, 1.01, zs + 0.01], 0.016, 0.02, o));
    }
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w / 2, faceZ(d)], [w / 2, faceZ(d)])],
});

// ---------------------------------------------------------------------------
// Refrigeration
// ---------------------------------------------------------------------------

const FRIDGE_SLOTS = [
  matSlot('body', 'Body & doors', 'metal-brushed-steel'),
  matSlot('handle', 'Handles', 'metal-chrome'),
  matSlot('seal', 'Door seals & grille', 'rubber-black'),
];

/** Fridge freezer: door gaskets, bar handles, kick grille, optional bottom freezer drawers and dispenser. */
function fridgeParts({ w, d, h }: Size3, frenchMin: number, drawers: number, dispenser: boolean): Part[] {
  const doorT = 0.05;
  const handleD = 0.035;
  const zf = d / 2 - doorT - handleD;
  const zs = zf + doorT;
  const foot = 0.02;
  const kick = 0.07;
  const y0 = foot + kick;
  const freezer = h > 1.2 ? (h - y0) * 0.33 : 0;
  const ySplit = y0 + freezer;
  const stand = handleD - 0.012;
  const o = { plan: false };
  const parts: Part[] = [
    span('body', [-w / 2, w / 2], [foot, h], [-d / 2, zf], { bevel: 0.012 }),
    ...legs4('handle', w, d - 2 * (doorT + handleD), 0.03, 0, foot, 0.04, { round: true }),
    span('seal', [-w / 2 + 0.02, w / 2 - 0.02], [foot + 0.008, y0 - 0.006], [zf, zf + 0.006], o),
    ...slats('body', [-w / 2 + 0.04, w / 2 - 0.04], [foot + 0.02, y0 - 0.018], [zf + 0.006, zf + 0.01], Math.round((w - 0.08) / 0.03), {
      axis: 'x',
      gap: 0.5,
      plan: false,
    }),
  ];
  const door = (x: V2, y: V2) =>
    parts.push(
      span('seal', [x[0] + 0.002, x[1] - 0.002], [y[0] + 0.002, y[1] - 0.002], [zf, zf + 0.014], o),
      span('body', [x[0] + 0.006, x[1] - 0.006], [y[0] + 0.006, y[1] - 0.004], [zf + 0.005, zs], { bevel: 0.008, plan: false }),
    );
  const french = w >= frenchMin;
  const upper: V2[] = french ? cellSpans(2, -w / 2, w / 2) : [[-w / 2, w / 2]];
  const hLen = clamp((h - ySplit) * 0.4, 0.15, 0.6);
  upper.forEach(([x0, x1], i) => {
    door([x0, x1], [ySplit, h]);
    const hx = french && i === 1 ? x0 + 0.045 : x1 - 0.045;
    const hy = freezer > 0 ? ySplit + 0.1 + hLen / 2 : h - 0.1 - hLen / 2;
    parts.push(...barPull('handle', [hx, hy, zs], hLen, { vertical: true, r: 0.01, stand }));
  });
  if (freezer > 0) {
    for (const [ya, yb] of cellSpans(drawers, y0, ySplit)) {
      door([-w / 2, w / 2], [ya, yb]);
      parts.push(...barPull('handle', [0, yb - 0.05, zs], w * 0.55, { r: 0.009, stand }));
    }
  }
  if (dispenser && french) {
    // Water & ice dispenser recessed into the left door.
    const [x0, x1] = upper[0];
    const dw = Math.min(0.2, (x1 - x0) * 0.5);
    const dx = (x0 + x1) / 2 - 0.02;
    const dh = Math.min(0.32, (h - ySplit) * 0.35);
    const dy = ySplit + (h - ySplit) * 0.36;
    parts.push(
      span('seal', [dx - dw / 2, dx + dw / 2], [dy, dy + dh], [zs - 0.002, zs + 0.002], { bevel: 0.006, plan: false }),
      span('handle', [dx - dw * 0.28, dx + dw * 0.28], [dy + dh * 0.4, dy + dh * 0.72], [zs, zs + 0.01], { bevel: 0.003, plan: false }),
      span('handle', [dx - dw * 0.4, dx + dw * 0.4], [dy + 0.008, dy + 0.022], [zs, zs + 0.016], { bevel: 0.003, plan: false }),
      span('body', [dx - dw * 0.35, dx + dw * 0.35], [dy + dh - 0.05, dy + dh - 0.02], [zs + 0.002, zs + 0.004], o),
    );
  } else {
    // Temperature display near the top of the door.
    const [x0, x1] = upper[upper.length - 1];
    const cx = (x0 + x1) / 2;
    parts.push(span('seal', [cx - 0.05, cx + 0.05], [h - 0.12, h - 0.075], [zs - 0.002, zs + 0.002], { bevel: 0.004, plan: false }));
    parts.push(span('handle', [cx - 0.03, cx + 0.03], [h - 0.105, h - 0.09], [zs + 0.002, zs + 0.003], o));
  }
  return parts;
}

const fridgePlan = ({ w, d }: Size3): PlanStroke[] => {
  const zf = d / 2 - 0.085;
  return [line([-w / 2, zf], [w / 2, zf])];
};

const fridge = defineAsset({
  id: 'fridge',
  name: 'Fridge freezer',
  category: 'kitchen',
  type: 'appliances',
  group: 'Refrigeration',
  tags: ['fridge', 'refrigerator', 'freezer', 'appliance', 'cooler'],
  defaultSize: { w: 0.7, d: 0.7, h: 1.85 },
  minSize: { w: 0.5, d: 0.55, h: 0.8 },
  maxSize: { w: 1.0, d: 0.8, h: 2.1 },
  wallSnap: true,
  slots: FRIDGE_SLOTS,
  build: (size) => fridgeParts(size, 0.85, 1, false),
  planDetail: fridgePlan,
});

const fridgeFrench = defineAsset({
  id: 'fridge-french-door',
  name: 'French-door fridge',
  category: 'kitchen',
  type: 'appliances',
  group: 'Refrigeration',
  tags: ['fridge', 'refrigerator', 'french door', 'american', 'side by side', 'ice dispenser', 'appliance'],
  defaultSize: { w: 0.9, d: 0.75, h: 1.8 },
  minSize: { w: 0.8, d: 0.65, h: 1.7 },
  maxSize: { w: 1.0, d: 0.85, h: 1.95 },
  wallSnap: true,
  slots: FRIDGE_SLOTS,
  build: (size) => fridgeParts(size, 0, 2, true),
  planDetail: fridgePlan,
});

/** Wine bottle lying on its side, neck towards the front, centred at (x, y, z). */
function lyingBottle(slot: string, x: number, y: number, z: number, r: number, len: number): Part {
  const prof: V2[] = [
    [0, 0],
    [r, 0],
    [r, len * 0.62],
    [r * 0.8, len * 0.72],
    [r * 0.36, len * 0.8],
    [r * 0.36, len],
    [0, len],
  ];
  return lathe(slot, [x, y - len / 2, z], prof, { segments: 14, rotation: [Math.PI / 2, 0, 0], plan: false });
}

const wineCooler = defineAsset({
  id: 'wine-cooler',
  name: 'Wine cooler',
  category: 'kitchen',
  type: 'appliances',
  group: 'Refrigeration',
  tags: ['wine', 'wine fridge', 'cooler', 'bottles', 'under counter', 'drinks'],
  defaultSize: { w: 0.6, d: 0.57, h: 0.82 },
  minSize: { w: 0.3, d: 0.5, h: 0.8 },
  maxSize: { w: 0.6, d: 0.6, h: 0.9 },
  wallSnap: true,
  slots: [
    matSlot('frame', 'Body & frame', 'metal-anthracite'),
    matSlot('glass', 'Door glass', 'glass-tinted'),
    matSlot('racks', 'Wooden racks', 'wood-oak-natural'),
    matSlot('bottles', 'Bottles', 'paint-forest'),
  ],
  build: ({ w, d, h }) => {
    const t = 0.03;
    const zf = d / 2 - 0.045;
    const zs = zf + 0.025;
    const kick = 0.1;
    const top = h - 0.04;
    const xi: V2 = [-w / 2 + t, w / 2 - t];
    const o = { plan: false };
    const parts: Part[] = [
      span('frame', [-w / 2, -w / 2 + t], [0, h], [-d / 2, zf]),
      span('frame', [w / 2 - t, w / 2], [0, h], [-d / 2, zf]),
      span('frame', xi, [top, h], [-d / 2, zf]),
      span('frame', xi, [0, kick], [-d / 2, zf]),
      span('frame', xi, [kick, top], [-d / 2, -d / 2 + t], o),
      ...slats('frame', [-w / 2 + 0.04, w / 2 - 0.04], [0.025, kick - 0.025], [zf, zf + 0.006], Math.round((w - 0.08) / 0.025), {
        axis: 'x',
        gap: 0.5,
        plan: false,
      }),
      // Glazed door.
      ...frame4('frame', [-w / 2, w / 2], [kick + 0.004, h - 0.002], [zf, zs], 0.035),
      span('glass', [-w / 2 + 0.035, w / 2 - 0.035], [kick + 0.039, h - 0.037], [zf + 0.008, zf + 0.016], o),
      ...barPull('frame', [w / 2 - 0.018, (kick + h) / 2 + 0.05, zs], Math.min(0.35, (h - kick) * 0.5), {
        vertical: true,
        stand: 0.012,
        r: 0.006,
      }),
    ];
    // Racks of bottles lying neck-out.
    const rows = clamp(Math.floor((top - kick - 0.02) / 0.1), 2, 8);
    const rowH = (top - kick) / rows;
    const r = Math.min(0.036, rowH / 2 - 0.012);
    const len = 0.3;
    const zc = zf - 0.035 - len / 2;
    const nb = clamp(Math.floor((xi[1] - xi[0] - 0.01) / 0.078), 1, 8);
    for (let i = 0; i < rows; i++) {
      const yb = kick + i * rowH + 0.004;
      parts.push(span('racks', xi, [yb, yb + 0.008], [-d / 2 + t, zf - 0.012], o));
      parts.push(span('racks', xi, [yb, yb + 0.025], [zf - 0.032, zf - 0.012], o));
      for (const x of cells(nb, xi[0], xi[1])) parts.push(lyingBottle('bottles', x, yb + 0.008 + r, zc, r, len));
    }
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w / 2, d / 2 - 0.045], [w / 2, d / 2 - 0.045])],
});

// ---------------------------------------------------------------------------
// Cleaning & laundry appliances
// ---------------------------------------------------------------------------

const dishwasher = defineAsset({
  id: 'dishwasher',
  name: 'Dishwasher',
  category: 'kitchen',
  type: 'appliances',
  group: 'Cleaning',
  tags: ['dishwasher', 'appliance', 'dishes', 'under counter'],
  defaultSize: { w: 0.6, d: 0.6, h: 0.85 },
  minSize: { w: 0.45, d: 0.55, h: 0.8 },
  maxSize: { w: 0.6, d: 0.65, h: 0.9 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Body & door', 'metal-brushed-steel'),
    matSlot('panel', 'Control panel', 'screen-black'),
    matSlot('handle', 'Handle & buttons', 'metal-chrome'),
  ],
  build: ({ w, d, h }) => {
    const zf = d / 2 - 0.035;
    const zs = zf + 0.02;
    const ct = h - 0.1;
    const o = { plan: false };
    const parts: Part[] = [
      span('body', [-w / 2, w / 2], [0.08, h], [-d / 2, zf]),
      span('panel', [-w / 2 + 0.01, w / 2 - 0.01], [0.012, 0.08], [-d / 2 + 0.05, zf - 0.03], o),
      ...legs4('handle', w - 0.04, d - 0.15, 0.02, 0, 0.012, 0.03, { round: true }),
      span('body', [-w / 2 + 0.002, w / 2 - 0.002], [0.08, ct], [zf, zs], { bevel: 0.004, plan: false }),
      span('panel', [-w / 2 + 0.002, w / 2 - 0.002], [ct + 0.002, h - 0.005], [zf, zs], { bevel: 0.003, plan: false }),
      span('body', [w / 2 - 0.17, w / 2 - 0.06], [ct + 0.03, h - 0.035], [zs, zs + 0.002], o),
      ...barPull('handle', [0, ct - 0.035, zs], w * 0.6, { stand: 0.01, r: 0.005 }),
    ];
    for (const x of spaced(5, -w / 2 + 0.05, -w / 2 + 0.17)) {
      parts.push(discZ('handle', [x, (ct + h) / 2, zs + 0.002], 0.007, 0.004, o));
    }
    return parts;
  },
});

/**
 * Front-loading washer or dryer built from y0 up `uh`: porthole door with chrome ring, control
 * fascia with display, dial and buttons, and a detergent/water drawer. Slots: body, door, trim.
 */
export function frontLoaderParts(kind: 'washer' | 'dryer', w: number, d: number, y0: number, uh: number): Part[] {
  const zf = d / 2 - 0.04;
  const foot = y0 === 0 ? 0.02 : 0;
  const top = y0 + uh;
  const o = { plan: false };
  const R = Math.min(w * 0.32, (uh - 0.2) * 0.38);
  const yc = y0 + foot + (uh - 0.16) * 0.47;
  const parts: Part[] = [
    span('body', [-w / 2, w / 2], [y0 + foot, top], [-d / 2, zf], { bevel: 0.012 }),
    // Fascia, drawer and controls.
    span('body', [-w / 2 + 0.004, w / 2 - 0.004], [top - 0.14, top - 0.006], [zf, zf + 0.008], { bevel: 0.003, plan: false }),
    span('body', [-w / 2 + 0.02, -w / 2 + 0.2], [top - 0.12, top - 0.025], [zf + 0.008, zf + 0.02], { bevel: 0.004, plan: false }),
    span('trim', [-w / 2 + 0.08, -w / 2 + 0.14], [top - 0.04, top - 0.033], [zf + 0.02, zf + 0.024], o),
    span('door', [-0.05, 0.07], [top - 0.1, top - 0.05], [zf + 0.008, zf + 0.011], o),
    discZ('trim', [w / 2 - 0.075, top - 0.075, zf + 0.016], 0.032, 0.016, o),
    span('body', [w / 2 - 0.08, w / 2 - 0.07], [top - 0.1, top - 0.05], [zf + 0.024, zf + 0.028], o),
    // Porthole door.
    torus('trim', [0, yc, zf + 0.02], R, 0.02, o),
    discZ('door', [0, yc, zf + 0.015], R - 0.005, 0.026, o),
    span('trim', [R - 0.005, R + 0.025], [yc - 0.04, yc + 0.04], [zf + 0.01, zf + 0.034], { bevel: 0.006, plan: false }),
    span('trim', [-R - 0.035, -R + 0.005], [yc + 0.03, yc + 0.06], [zf, zf + 0.018], o),
    span('trim', [-R - 0.035, -R + 0.005], [yc - 0.06, yc - 0.03], [zf, zf + 0.018], o),
  ];
  for (const x of spaced(4, -0.045, 0.065)) parts.push(discZ('trim', [x, top - 0.122, zf + 0.011], 0.008, 0.008, o));
  if (foot > 0) parts.push(...legs4('trim', w, d - 0.1, 0.04, 0, foot, 0.04, { round: true }));
  if (kind === 'washer') {
    // Bulging glass bowl and service flap.
    parts.push(sphere('door', [0, yc, zf + 0.025], 1, { scale: [R * 0.72, R * 0.72, 0.018], plan: false }));
    parts.push(span('body', [w / 2 - 0.13, w / 2 - 0.02], [y0 + foot + 0.025, y0 + foot + 0.1], [zf, zf + 0.006], { bevel: 0.002, plan: false }));
    parts.push(discZ('trim', [w / 2 - 0.075, y0 + foot + 0.062, zf + 0.008], 0.025, 0.006, o));
  } else {
    // Flat door with inner drum ring and a condenser vent grille.
    parts.push(torus('body', [0, yc, zf + 0.03], R * 0.72, 0.012, o));
    parts.push(
      ...slats('trim', [-w / 2 + 0.08, w / 2 - 0.08], [y0 + foot + 0.03, y0 + foot + 0.09], [zf, zf + 0.005], Math.round((w - 0.16) / 0.025), {
        axis: 'x',
        gap: 0.5,
        plan: false,
      }),
    );
  }
  return parts;
}

const frontLoaderPlan = ({ w, d }: Size3): PlanStroke[] => [line([-w / 2, d / 2 - 0.04], [w / 2, d / 2 - 0.04])];

const washingMachine = defineAsset({
  id: 'washing-machine',
  name: 'Washing machine',
  category: 'laundry',
  type: 'appliances',
  group: 'Laundry',
  tags: ['washer', 'laundry', 'washing machine', 'appliance', 'utility'],
  defaultSize: { w: 0.6, d: 0.6, h: 0.85 },
  minSize: { w: 0.5, d: 0.45, h: 0.8 },
  maxSize: { w: 0.65, d: 0.7, h: 0.9 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Body', 'laminate-white-gloss'),
    matSlot('door', 'Door glass', 'glass-tinted'),
    matSlot('trim', 'Door ring & dial', 'metal-chrome'),
  ],
  build: ({ w, d, h }) => frontLoaderParts('washer', w, d, 0, h),
  planDetail: frontLoaderPlan,
});

// ---------------------------------------------------------------------------
// Range cooker & hood
// ---------------------------------------------------------------------------

/** Burner layout [x, z, r] on a range hob: 2×2, 2+wok+2, or 3×2 depending on width. */
function rangeBurners(w: number, d: number): [number, number, number][] {
  const x0 = -w / 2 + 0.04;
  const x1 = w / 2 - 0.04;
  const z0 = -d / 2 + 0.07;
  const z1 = d / 2 - 0.04;
  const zs = cells(2, z0, z1);
  const out: [number, number, number][] = [];
  const cols = w >= 1.05 ? 3 : w >= 0.85 ? 3 : 2;
  const cs = cells(cols, x0, x1);
  const cw = (x1 - x0) / cols;
  const r = Math.min(cw * 0.26, (z1 - z0) * 0.14, 0.055);
  cs.forEach((x, i) => {
    if (cols === 3 && w < 1.05 && i === 1) out.push([x, (z0 + z1) / 2, Math.min(r * 1.35, cw * 0.36)]);
    else zs.forEach((z, j) => out.push([x, z, r * (j === 0 ? 0.85 : 1)]));
  });
  return out;
}

const rangeCooker = defineAsset({
  id: 'range-cooker',
  name: 'Range cooker',
  category: 'kitchen',
  type: 'appliances',
  group: 'Cooking',
  tags: ['range', 'cooker', 'stove', 'gas hob', 'oven', 'freestanding', 'aga'],
  defaultSize: { w: 0.9, d: 0.6, h: 1.0 },
  minSize: { w: 0.6, d: 0.55, h: 0.95 },
  maxSize: { w: 1.2, d: 0.7, h: 1.1 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Enamel body', 'laminate-navy'),
    matSlot('iron', 'Hob & grates', 'metal-black-matte'),
    matSlot('metal', 'Knobs & rail', 'metal-brass'),
    matSlot('glass', 'Oven windows', 'screen-black'),
  ],
  build: ({ w, d, h }) => {
    const hobY = Math.min(0.92, h - 0.06);
    const zf = d / 2 - 0.035;
    const zs = zf + 0.022;
    const plinthH = 0.08;
    const panel: V2 = [hobY - 0.13, hobY - 0.035];
    const drawer: V2 = [plinthH, plinthH + 0.15];
    const ovenY: V2 = [drawer[1], panel[0]];
    const o = { plan: false };
    const burners = rangeBurners(w, d);
    const parts: Part[] = [
      span('iron', [-w / 2 + 0.02, w / 2 - 0.02], [0, plinthH], [-d / 2, zf - 0.03], o),
      span('body', [-w / 2, w / 2], [plinthH, hobY - 0.035], [-d / 2, zf]),
      span('iron', [-w / 2, w / 2], [hobY - 0.035, hobY], [-d / 2, d / 2 - 0.004], { bevel: 0.004 }),
      span('body', [-w / 2 + 0.004, w / 2 - 0.004], panel, [zf, zf + 0.012], { bevel: 0.003, plan: false }),
      span('body', [-w / 2, w / 2], [hobY - 0.005, h], [-d / 2, -d / 2 + 0.03], { bevel: 0.006, plan: false }),
    ];
    // Burners: brass crowns with black caps under cast-iron grates.
    for (const [x, z, r] of burners) {
      parts.push(cyl('metal', [x, hobY + 0.006, z], r, 0.012, { plan: false, segments: 20 }));
      parts.push(cyl('iron', [x, hobY + 0.016, z], r * 0.72, 0.008, { plan: false, segments: 20 }));
    }
    const gx0 = -w / 2 + 0.03;
    const gx1 = w / 2 - 0.03;
    const gz0 = -d / 2 + 0.045;
    const gz1 = d / 2 - 0.02;
    const gy = hobY + 0.026;
    for (const z of spaced(3, gz0, gz1)) parts.push(rodX('iron', gx0, gx1, gy, z, 0.005, o));
    for (const x of spaced(burners.length > 4 ? 4 : 3, gx0, gx1)) parts.push(rodZ('iron', x, gy, gz0, gz1, 0.005, o));
    // Frying pan on the front-left burner.
    const [px, , pr0] = burners[1];
    const pz = burners[1][1];
    const pr = Math.min(0.1, Math.max(pr0 * 1.6, 0.07), px + w / 2 - 0.02);
    parts.push(
      lathe('iron', [px, gy + 0.005, pz], [
        [0, 0],
        [pr * 0.85, 0],
        [pr, 0.035],
        [pr * 0.95, 0.035],
        [pr * 0.8, 0.006],
        [0, 0.006],
      ], { segments: 28, plan: false }),
      rod('iron', [px + pr * 0.7, gy + 0.03, pz + pr * 0.7], [Math.min(px + pr + 0.08, w / 2 - 0.01), gy + 0.035, Math.min(pz + pr + 0.06, d / 2 - 0.01)], 0.008, o),
    );
    // Knobs along the fascia.
    const nOvens = w >= 0.85 ? 2 : 1;
    const ky = (panel[0] + panel[1]) / 2;
    for (const x of spaced(burners.length + nOvens, -w / 2 + 0.06, w / 2 - 0.06)) {
      parts.push(discZ('metal', [x, ky, zf + 0.014], 0.026, 0.004, o));
      parts.push(discZ('metal', [x, ky, zf + 0.026], 0.018, 0.022, o));
      parts.push(span('iron', [x - 0.0025, x + 0.0025], [ky + 0.006, ky + 0.016], [zf + 0.036, zf + 0.0375], o));
    }
    // Oven doors with windows.
    const ovens: V2[] = nOvens === 2 ? [[-w / 2 + 0.01, -w / 2 + 0.01 + (w - 0.02) * 0.6], [-w / 2 + 0.01 + (w - 0.02) * 0.6, w / 2 - 0.01]] : [[-w / 2 + 0.01, w / 2 - 0.01]];
    for (const [x0, x1] of ovens) {
      parts.push(span('body', [x0 + 0.003, x1 - 0.003], [ovenY[0] + 0.004, ovenY[1] - 0.004], [zf, zs], { bevel: 0.007, plan: false }));
      parts.push(span('glass', [x0 + 0.05, x1 - 0.05], [ovenY[0] + 0.06, ovenY[1] - 0.09], [zs, zs + 0.003], o));
    }
    // Towel rail across the doors, and the storage drawer.
    const ry = ovenY[1] - 0.04;
    parts.push(rodX('metal', -w / 2 + 0.03, w / 2 - 0.03, ry, d / 2 - 0.012, 0.011, o));
    for (const x of spaced(nOvens + 1, -w / 2 + 0.05, w / 2 - 0.05)) parts.push(rodZ('metal', x, ry, zs, d / 2 - 0.012, 0.007, o));
    parts.push(span('body', [-w / 2 + 0.013, w / 2 - 0.013], [drawer[0] + 0.004, drawer[1] - 0.004], [zf, zs], { bevel: 0.007, plan: false }));
    parts.push(...barPull('metal', [0, (drawer[0] + drawer[1]) / 2, zs], Math.min(0.3, w * 0.35), { stand: 0.012 }));
    return parts;
  },
  planDetail: ({ w, d }) => {
    const strokes: PlanStroke[] = rangeBurners(w, d).map(([x, z, r]) => circle([x, z], r));
    strokes.push(line([-w / 2, d / 2 - 0.035], [w / 2, d / 2 - 0.035]));
    return strokes;
  },
});

const rangeHood = defineAsset({
  id: 'range-hood',
  name: 'Chimney extractor hood',
  category: 'kitchen',
  type: 'appliances',
  group: 'Cooking',
  tags: ['hood', 'extractor', 'cooker hood', 'chimney', 'vent', 'range hood'],
  defaultSize: { w: 0.9, d: 0.5, h: 0.95 },
  minSize: { w: 0.6, d: 0.4, h: 0.6 },
  maxSize: { w: 1.2, d: 0.6, h: 1.15 },
  mount: 'wall',
  defaultElevation: 1.6,
  slots: [
    matSlot('body', 'Hood', 'metal-brushed-steel'),
    matSlot('filter', 'Filters & buttons', 'metal-anthracite'),
    matSlot('light', 'Lights', 'light-warm'),
  ],
  // Lamps in the canopy's underside, lighting the hob.
  light: { color: '#ffe8c2', intensity: 0.7, distance: 2, y: 0.01, z: 0.08, kind: 'spot', angle: 0.9, penumbra: 0.6 },
  build: ({ w, d, h }) => {
    const baseH = 0.06;
    const slopeH = clamp(h * 0.22, 0.12, 0.22);
    const cw = clamp(w * 0.32, 0.22, 0.34);
    const cd = clamp(d * 0.55, 0.2, 0.3);
    const y1 = baseH + slopeH;
    const ym = y1 + (h - y1) * 0.5;
    const nf = clamp(Math.round((w - 0.06) / 0.3), 2, 4);
    const o = { plan: false };
    const parts: Part[] = [
      span('body', [-w / 2, w / 2], [0.004, baseH], [-d / 2, d / 2], { bevel: 0.006 }),
      sideProfile('body', [
        [baseH - 0.002, -d / 2],
        [baseH - 0.002, d / 2 - 0.012],
        [y1, -d / 2 + cd],
        [y1, -d / 2],
      ], [-w / 2 + 0.004, w / 2 - 0.004]),
      span('body', [-cw / 2, cw / 2], [y1 - 0.002, ym], [-d / 2, -d / 2 + cd], o),
      span('body', [-cw / 2 + 0.006, cw / 2 - 0.006], [ym - 0.01, h], [-d / 2, -d / 2 + cd - 0.006], o),
    ];
    for (const [a, b] of cellSpans(nf, -w / 2 + 0.03, w / 2 - 0.03)) {
      parts.push(span('filter', [a + 0.006, b - 0.006], [0, 0.005], [-d / 2 + 0.04, d / 2 - 0.11], o));
    }
    for (const s of [-1, 1]) parts.push(cyl('light', [(s * w) / 4, 0.002, d / 2 - 0.055], 0.024, 0.004, o));
    for (const x of spaced(4, -0.06, 0.06)) parts.push(span('filter', [x - 0.01, x + 0.01], [0.022, 0.038], [d / 2 - 0.001, d / 2 + 0.002], o));
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w / 2, -d / 2], [w / 2, d / 2]), line([-w / 2, d / 2], [w / 2, -d / 2])],
});

// ---------------------------------------------------------------------------
// Small appliances
// ---------------------------------------------------------------------------

const microwave = defineAsset({
  id: 'microwave',
  name: 'Microwave',
  category: 'kitchen',
  type: 'appliances',
  group: 'Small appliances',
  tags: ['microwave', 'oven', 'countertop', 'appliance', 'reheat'],
  defaultSize: { w: 0.5, d: 0.38, h: 0.3 },
  minSize: { w: 0.45, d: 0.33, h: 0.26 },
  maxSize: { w: 0.6, d: 0.45, h: 0.35 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Body', 'metal-brushed-steel'),
    matSlot('glass', 'Window & panel', 'screen-black'),
    matSlot('display', 'Display', 'screen-glow'),
    matSlot('buttons', 'Buttons & feet', 'plastic-black'),
  ],
  build: ({ w, d, h }) => {
    const zf = d / 2 - 0.012;
    const cpw = clamp(w * 0.22, 0.09, 0.13);
    const xc = w / 2 - cpw / 2 - 0.004;
    const dx: V2 = [-w / 2 + 0.006, w / 2 - cpw - 0.006];
    const o = { plan: false };
    const parts: Part[] = [
      span('body', [-w / 2, w / 2], [0.012, h], [-d / 2, zf], { bevel: 0.012 }),
      span('body', dx, [0.02, h - 0.012], [zf, zf + 0.008], { bevel: 0.004, plan: false }),
      span('glass', [dx[0] + 0.035, dx[1] - 0.05], [0.055, h - 0.05], [zf + 0.008, zf + 0.01], o),
      span('buttons', [dx[1] - 0.032, dx[1] - 0.018], [0.07, h - 0.07], [zf + 0.008, d / 2], { bevel: 0.004, plan: false }),
      span('glass', [w / 2 - cpw - 0.002, w / 2 - 0.006], [0.02, h - 0.012], [zf, zf + 0.006], { bevel: 0.003, plan: false }),
      span('display', [xc - cpw * 0.35, xc + cpw * 0.35], [h - 0.06, h - 0.035], [zf + 0.006, zf + 0.008], o),
      discZ('buttons', [xc, 0.06, zf + 0.012], Math.min(0.022, cpw * 0.25), 0.012, o),
      ...slats('glass', [w / 2 - 0.001, w / 2 + 0.002], [h - 0.12, h - 0.05], [-d / 2 + 0.05, -d / 2 + 0.2], 8, { axis: 'z', gap: 0.5, plan: false }),
    ];
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) parts.push(cyl('buttons', [sx * (w / 2 - 0.05), 0.006, sz * (d / 2 - 0.06)], 0.012, 0.012, o));
    }
    for (const y of cells(3, 0.095, h - 0.075)) {
      for (const x of cells(3, xc - cpw * 0.36, xc + cpw * 0.36)) {
        parts.push(span('buttons', [x - 0.009, x + 0.009], [y - 0.006, y + 0.006], [zf + 0.006, zf + 0.009], o));
      }
    }
    return parts;
  },
});

const coffeeMachine = defineAsset({
  id: 'coffee-machine',
  name: 'Espresso machine',
  category: 'kitchen',
  type: 'appliances',
  group: 'Small appliances',
  tags: ['coffee', 'espresso', 'barista', 'cappuccino', 'countertop', 'appliance'],
  defaultSize: { w: 0.3, d: 0.38, h: 0.4 },
  minSize: { w: 0.26, d: 0.32, h: 0.36 },
  maxSize: { w: 0.4, d: 0.45, h: 0.45 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Body', 'metal-brushed-steel'),
    matSlot('accent', 'Handles & knobs', 'plastic-black'),
    matSlot('cups', 'Cups', 'ceramic-white'),
  ],
  build: ({ w, d, h }) => {
    const zt = -d / 2 + d * 0.5;
    const headTop = h - 0.055;
    const headY0 = h - 0.16;
    const zh = d / 2 - 0.03;
    const zg = (zt + zh) / 2;
    const o = { plan: false };
    const parts: Part[] = [
      span('body', [-w / 2, w / 2], [0, headY0 + 0.01], [-d / 2, zt], { bevel: 0.015 }),
      span('body', [-w / 2, w / 2], [headY0, headTop], [-d / 2, zh], { bevel: 0.014 }),
      // Drip tray and grate.
      span('body', [-w / 2 + 0.012, w / 2 - 0.012], [0, 0.03], [zt - 0.01, d / 2 - 0.008], { bevel: 0.004, plan: false }),
      ...slats('accent', [-w / 2 + 0.025, w / 2 - 0.025], [0.03, 0.034], [zt + 0.01, d / 2 - 0.02], Math.round((w - 0.05) / 0.016), {
        axis: 'x',
        gap: 0.45,
        plan: false,
      }),
      // Cup rail on top with two warming cups.
      rodX('body', -w / 2 + 0.015, w / 2 - 0.015, headTop + 0.012, -d / 2 + 0.015, 0.004, o),
      rodX('body', -w / 2 + 0.015, w / 2 - 0.015, headTop + 0.012, zh - 0.02, 0.004, o),
      rodZ('body', -w / 2 + 0.015, headTop + 0.012, -d / 2 + 0.015, zh - 0.02, 0.004, o),
      rodZ('body', w / 2 - 0.015, headTop + 0.012, -d / 2 + 0.015, zh - 0.02, 0.004, o),
      cyl('cups', [-w * 0.18, headTop + 0.025, -0.02], 0.028, 0.05, { rTop: 0.022, plan: false }),
      cyl('cups', [w * 0.18, headTop + 0.025, -0.02], 0.028, 0.05, { rTop: 0.022, plan: false }),
      // Group head, portafilter and spouts.
      vcyl('body', 0, zg, headY0 - 0.03, headY0, 0.04, o),
      vcyl('body', 0, zg, headY0 - 0.055, headY0 - 0.03, 0.036, o),
      rod('accent', [0, headY0 - 0.045, zg + 0.03], [0, headY0 - 0.06, d / 2 - 0.012], 0.011, o),
      vcyl('body', -0.012, zg, headY0 - 0.07, headY0 - 0.055, 0.005, o),
      vcyl('body', 0.012, zg, headY0 - 0.07, headY0 - 0.055, 0.005, o),
      // Espresso cup on its saucer.
      cyl('cups', [0, 0.037, zg], 0.045, 0.006, { segments: 24, plan: false }),
      cyl('cups', [0, 0.065, zg], 0.026, 0.05, { rTop: 0.03, plan: false }),
      torus('cups', [0.034, 0.068, zg], 0.012, 0.004, o),
      // Steam wand, knobs, gauge and buttons.
      rod('body', [w / 2 - 0.04, headY0 - 0.005, zt + 0.02], [w / 2 - 0.03, 0.09, zt + 0.06], 0.005, o),
      discZ('accent', [w / 2 - 0.05, (headY0 + headTop) / 2, zh + 0.008], 0.015, 0.016, o),
      discZ('body', [0, (headY0 + headTop) / 2, zh + 0.004], 0.024, 0.008, o),
      discZ('cups', [0, (headY0 + headTop) / 2, zh + 0.009], 0.019, 0.004, o),
      span('accent', [-0.0015, 0.0015], [(headY0 + headTop) / 2, (headY0 + headTop) / 2 + 0.015], [zh + 0.011, zh + 0.012], o),
      discZ('accent', [-w / 2 + 0.045, (headY0 + headTop) / 2 + 0.015, zh + 0.004], 0.008, 0.008, o),
      discZ('accent', [-w / 2 + 0.045, (headY0 + headTop) / 2 - 0.015, zh + 0.004], 0.008, 0.008, o),
    ];
    return parts;
  },
});

const toaster = defineAsset({
  id: 'toaster',
  name: 'Toaster',
  category: 'kitchen',
  type: 'appliances',
  group: 'Small appliances',
  tags: ['toaster', 'toast', 'bread', 'breakfast', 'countertop', 'appliance'],
  defaultSize: { w: 0.28, d: 0.18, h: 0.2 },
  minSize: { w: 0.24, d: 0.16, h: 0.18 },
  maxSize: { w: 0.42, d: 0.22, h: 0.22 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Body', 'paint-sage'),
    matSlot('trim', 'Chrome trim', 'metal-chrome'),
    matSlot('toast', 'Toast', 'wood-pine'),
    matSlot('dark', 'Slots & buttons', 'plastic-black'),
  ],
  build: ({ w, d, h }) => {
    const bodyTop = h - 0.05;
    const xb: V2 = [-w / 2 + 0.02, w / 2 - 0.02];
    const slotX: V2[] = w >= 0.36 ? cellSpans(2, xb[0] + 0.02, xb[1] - 0.02).map(([a, b]) => [a + 0.012, b - 0.012] as V2) : [[xb[0] + 0.035, xb[1] - 0.035]];
    const zf = d / 2 - 0.005;
    const o = { plan: false };
    const parts: Part[] = [
      span('trim', [-w / 2 + 0.015, w / 2 - 0.015], [0.006, 0.024], [-d / 2 + 0.008, d / 2 - 0.008], { bevel: 0.006 }),
      span('body', xb, [0.02, bodyTop], [-d / 2 + 0.005, zf], { bevel: 0.015 }),
      span('trim', [-w * 0.3, w * 0.3], [0.024, 0.032], [zf - 0.008, zf + 0.002], o),
      // Lever in its track on the right end, browning dial and buttons on the front.
      span('dark', [w / 2 - 0.0215, w / 2 - 0.0185], [0.05, bodyTop - 0.03], [-0.008, 0.008], o),
      span('trim', [w / 2 - 0.02, w / 2], [bodyTop - 0.06, bodyTop - 0.045], [-0.016, 0.016], { bevel: 0.004, plan: false }),
      discZ('trim', [w * 0.18, 0.075, zf + 0.006], 0.015, 0.012, o),
      discZ('dark', [-w * 0.12, 0.07, zf + 0.003], 0.007, 0.006, o),
      discZ('dark', [-w * 0.2, 0.07, zf + 0.003], 0.007, 0.006, o),
    ];
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) parts.push(cyl('dark', [sx * (w / 2 - 0.04), 0.003, sz * (d / 2 - 0.035)], 0.008, 0.006, o));
    }
    for (const [x0, x1] of slotX) {
      for (const z of [-d * 0.16, d * 0.16]) {
        parts.push(span('dark', [x0, x1], [bodyTop - 0.004, bodyTop + 0.001], [z - 0.009, z + 0.009], o));
        parts.push(span('toast', [x0 + 0.01, x1 - 0.01], [bodyTop - 0.05, h - 0.012], [z - 0.0065, z + 0.0065], { bevel: 0.005, plan: false }));
        parts.push(rodX('toast', x0 + 0.016, x1 - 0.016, h - 0.012, z, 0.0085, o));
      }
    }
    return parts;
  },
});

const kettle = defineAsset({
  id: 'kettle',
  name: 'Kettle',
  category: 'kitchen',
  type: 'appliances',
  group: 'Small appliances',
  tags: ['kettle', 'tea', 'boil', 'hot water', 'countertop', 'appliance'],
  defaultSize: { w: 0.22, d: 0.16, h: 0.25 },
  minSize: { w: 0.18, d: 0.14, h: 0.22 },
  maxSize: { w: 0.26, d: 0.2, h: 0.3 },
  wallSnap: true,
  slots: [matSlot('body', 'Body', 'metal-brushed-steel'), matSlot('handle', 'Base & handle', 'plastic-black')],
  build: ({ w, d, h }) => {
    const R = Math.min(d / 2 - 0.006, w * 0.3);
    const x0 = -w * 0.04;
    const baseH = 0.022;
    const bh = h - baseH - 0.035;
    return [
      cyl('handle', [x0, baseH / 2, 0], R + 0.004, baseH, { segments: 32 }),
      lathe('body', [x0, baseH, 0], [
        [0, 0],
        [R * 0.92, 0],
        [R, 0.012],
        [R, bh * 0.55],
        [R * 0.92, bh * 0.85],
        [R * 0.72, bh],
        [0, bh],
      ], { segments: 32, plan: false }),
      cyl('handle', [x0, baseH + bh + 0.006, 0], R * 0.7, 0.012, { rTop: R * 0.62, plan: false }),
      sphere('handle', [x0, baseH + bh + 0.02, 0], 0.012, { scale: [1.3, 0.8, 1.3], plan: false }),
      // Water window, spout and handle.
      span('handle', [x0 - 0.008, x0 + 0.008], [baseH + 0.03, baseH + bh * 0.6], [R - 0.006, R + 0.002], { bevel: 0.003, plan: false }),
      rod('body', [x0 - R * 0.85, baseH + bh * 0.4, 0], [-w / 2 + 0.012, baseH + bh * 0.78, 0], 0.016, { rTop: 0.009, plan: false }),
      ...rodPath('handle', [
        [x0 + R * 0.8, baseH + 0.04, 0],
        [w / 2 - 0.012, baseH + 0.07, 0],
        [w / 2 - 0.012, h - 0.04, 0],
        [x0 + R * 0.5, h - 0.012, 0],
      ], 0.012),
      span('handle', [x0 + R * 0.75, x0 + R * 0.95], [baseH + 0.005, baseH + 0.02], [-0.008, 0.008], { bevel: 0.003, plan: false }),
    ];
  },
});

const standMixer = defineAsset({
  id: 'stand-mixer',
  name: 'Stand mixer',
  category: 'kitchen',
  type: 'appliances',
  group: 'Small appliances',
  tags: ['mixer', 'baking', 'stand mixer', 'bowl', 'countertop', 'appliance'],
  defaultSize: { w: 0.24, d: 0.36, h: 0.36 },
  minSize: { w: 0.2, d: 0.3, h: 0.32 },
  maxSize: { w: 0.3, d: 0.42, h: 0.42 },
  wallSnap: true,
  slots: [matSlot('body', 'Body', 'plastic-red'), matSlot('metal', 'Bowl & trim', 'metal-brushed-steel')],
  build: ({ w, d, h }) => {
    const baseH = 0.045;
    const headH = 0.11;
    const hw = Math.min(w - 0.04, 0.17);
    const cx = Math.min(0.055, w / 2 - 0.03);
    const colZ: V2 = [-d / 2 + 0.01, -d / 2 + 0.12];
    const rb = Math.min(w / 2 - 0.012, 0.11);
    const zb = Math.min(d / 2 - rb - 0.01, colZ[1] + rb + 0.02);
    const hy0 = h - headH;
    const bowlH = Math.min(hy0 - baseH - 0.03, 0.17);
    const o = { plan: false };
    return [
      span('body', [-w / 2 + 0.02, w / 2 - 0.02], [0, baseH], [-d / 2, d / 2 - 0.01], { bevel: 0.006 }),
      span('body', [-cx, cx], [baseH - 0.005, hy0 + 0.02], colZ, { bevel: 0.012, plan: false }),
      // Motor head: an elliptical capsule along z.
      rodZ('body', 0, hy0 + headH / 2, -d / 2 + headH / 2, d / 2 - 0.015 - headH / 2, headH / 2, { scale: [hw / headH, 1, 1], segments: 28, plan: false }),
      sphere('body', [0, hy0 + headH / 2, d / 2 - 0.015 - headH / 2], headH / 2, { scale: [hw / headH, 1, 1], plan: false }),
      sphere('body', [0, hy0 + headH / 2, -d / 2 + headH / 2], headH / 2, { scale: [hw / headH, 1, 1], plan: false }),
      rodZ('metal', 0, hy0 + headH / 2, colZ[1] + 0.03, colZ[1] + 0.042, headH / 2 + 0.002, { scale: [(hw + 0.004) / (headH + 0.004), 1, 1], segments: 28, plan: false }),
      discZ('metal', [0, hy0 + headH / 2, d / 2 - 0.011], 0.025, 0.008, o),
      span('metal', [-rb * 0.7, rb * 0.7], [baseH, baseH + 0.01], [zb - rb * 0.7, zb + rb * 0.7], o),
      lathe('metal', [0, baseH + 0.01, zb], [
        [0, 0],
        [rb * 0.45, 0],
        [rb * 0.5, 0.012],
        [rb * 0.92, bowlH * 0.55],
        [rb, bowlH],
        [rb * 0.96, bowlH],
        [rb * 0.88, bowlH * 0.55],
        [rb * 0.45, 0.02],
        [0, 0.02],
      ], { segments: 32, plan: false }),
      torus('metal', [rb * 0.95, baseH + 0.01 + bowlH * 0.6, zb], 0.025, 0.006, { rotation: [0, Math.PI / 2, 0], plan: false }),
      vcyl('metal', 0, zb, baseH + 0.08, hy0, 0.006, o),
      span('metal', [-0.03, 0.03], [baseH + 0.035, baseH + 0.1], [zb - 0.004, zb + 0.004], { bevel: 0.003, plan: false }),
      span('metal', [cx - 0.004, cx + 0.018], [hy0 - 0.03, hy0 - 0.02], [colZ[0] + 0.03, colZ[0] + 0.045], o),
    ];
  },
});

// ---------------------------------------------------------------------------
// Kitchen storage & tabletop
// ---------------------------------------------------------------------------

/** Kitchen shelf clutter along a shelf: glass jars of dry goods, canisters, upright plates and mugs. */
function shelfClutter(x: V2, y0: number, zBack: number, zFront: number, maxH: number, seed: number, budget: number): Part[] {
  const rand = rng(seed);
  const parts: Part[] = [];
  const depth = zFront - zBack;
  const zc = (zBack + zFront) / 2;
  const o = { plan: false };
  let cx = x[0] + 0.02;
  while (parts.length + 4 <= budget) {
    const kind = Math.floor(rand() * 4);
    if (kind === 0) {
      // Glass jar with grains / pasta and a wooden lid.
      const r = Math.min(0.045, depth / 2 - 0.01);
      const jh = Math.min(maxH - 0.02, lerp(0.12, 0.2, rand()));
      if (cx + 2 * r > x[1]) break;
      parts.push(
        lathe('jars', [cx + r, y0, zc], [
          [0, 0],
          [r, 0],
          [r, jh * 0.85],
          [r * 0.82, jh * 0.9],
          [r * 0.82, jh - 0.012],
        ], { segments: 18, plan: false }),
        cyl('shelf', [cx + r, y0 + jh * 0.33, zc], r * 0.86, jh * 0.62, o),
        cyl('shelf', [cx + r, y0 + jh - 0.008, zc], r * 0.88, 0.016, o),
      );
      cx += 2 * r;
    } else if (kind === 1) {
      // Ceramic canister with a knob lid.
      const r = Math.min(0.05, depth / 2 - 0.01);
      const ch = Math.min(maxH - 0.03, lerp(0.1, 0.16, rand()));
      if (cx + 2 * r > x[1]) break;
      parts.push(
        cyl('ceramics', [cx + r, y0 + ch / 2, zc], r, ch, { segments: 20, plan: false }),
        cyl('ceramics', [cx + r, y0 + ch + 0.005, zc], r * 1.02, 0.01, o),
        sphere('ceramics', [cx + r, y0 + ch + 0.016, zc], 0.01, o),
      );
      cx += 2 * r;
    } else if (kind === 2) {
      // Plate standing against the wall.
      const r = Math.min(0.11, maxH / 2 - 0.01, (depth - 0.02) * 1.4);
      if (cx + 2 * r > x[1]) break;
      parts.push(
        cyl('ceramics', [cx + r, y0 + r, zBack + 0.03], r, 0.014, { rotation: [Math.PI / 2 - 0.16, 0, 0], segments: 28, plan: false }),
      );
      cx += 2 * r;
    } else {
      // Mug.
      const r = 0.038;
      if (cx + 2 * r + 0.02 > x[1] || maxH < 0.11) {
        cx += 0.02;
        continue;
      }
      parts.push(
        cyl('ceramics', [cx + r, y0 + 0.045, zc], r, 0.09, { segments: 20, plan: false }),
        torus('ceramics', [cx + 2 * r + 0.006, y0 + 0.047, zc], 0.022, 0.006, o),
      );
      cx += 2 * r + 0.02;
    }
    cx += lerp(0.02, 0.06, rand());
    if (cx > x[1] - 0.06) break;
  }
  return parts;
}

const openShelf = defineAsset({
  id: 'kitchen-open-shelf',
  name: 'Kitchen open shelf with jars',
  category: 'kitchen',
  type: 'storage',
  group: 'Kitchen cabinets',
  tags: ['open shelf', 'shelving', 'jars', 'pantry', 'floating shelf', 'mugs', 'plates'],
  defaultSize: { w: 0.9, d: 0.25, h: 0.55 },
  minSize: { w: 0.4, d: 0.18, h: 0.3 },
  maxSize: { w: 1.6, d: 0.3, h: 0.8 },
  mount: 'wall',
  defaultElevation: 1.45,
  slots: [
    matSlot('shelf', 'Shelves & lids', 'wood-oak-natural'),
    matSlot('brackets', 'Brackets & rail', 'metal-black-matte'),
    matSlot('ceramics', 'Crockery', 'ceramic-white'),
    matSlot('jars', 'Glass jars', 'glass-clear'),
  ],
  build: ({ w, d, h }) => {
    const n = h >= 0.45 ? 2 : 1;
    const t = 0.028;
    const y0 = 0.1;
    const pitch = (h - y0) / n;
    const zb = -d / 2;
    const nb = w > 1.2 ? 3 : 2;
    const bx = spaced(nb, -w / 2 + 0.1, w / 2 - 0.1);
    const o = { plan: false };
    const parts: Part[] = [];
    for (let i = 0; i < n; i++) {
      const ys = y0 + i * pitch;
      parts.push(span('shelf', [-w / 2, w / 2], [ys, ys + t], [zb, d / 2], { bevel: 0.004, plan: i === 0 }));
      for (const x of bx) {
        parts.push(span('brackets', [x - 0.01, x + 0.01], [ys - 0.09, ys], [zb, zb + 0.008], o));
        parts.push(span('brackets', [x - 0.01, x + 0.01], [ys - 0.008, ys], [zb, d / 2 - 0.03], o));
        parts.push(rod('brackets', [x, ys - 0.08, zb + 0.008], [x, ys - 0.008, zb + Math.min(0.12, d - 0.05)], 0.004, o));
      }
      const budget = Math.floor((130 - n * (1 + 3 * nb) - 14) / n);
      parts.push(...shelfClutter([-w / 2 + 0.02, w / 2 - 0.02], ys + t, zb + 0.01, d / 2 - 0.015, pitch - t - 0.01, 11 + i * 7, budget));
    }
    // Rail under the bottom shelf with hanging mugs and a wooden spoon.
    const ry = 0.06;
    const rz = zb + 0.045;
    parts.push(rodX('brackets', -w / 2 + 0.06, w / 2 - 0.06, ry, rz, 0.005, o));
    for (const x of [-w / 2 + 0.06, w / 2 - 0.06]) parts.push(rodZ('brackets', x, ry, zb, rz, 0.004, o));
    const hooks = spaced(clamp(Math.floor((w - 0.2) / 0.16), 1, 4), -w / 2 + 0.14, w / 2 - 0.14);
    hooks.forEach((x, i) => {
      if (i % 2 === 0) {
        parts.push(cyl('ceramics', [x, 0.025, rz + 0.01], 0.03, 0.05, { segments: 18, plan: false }));
        parts.push(torus('ceramics', [x + 0.034, 0.035, rz + 0.01], 0.016, 0.005, o));
        parts.push(rod('brackets', [x + 0.034, 0.05, rz + 0.01], [x + 0.034, ry, rz], 0.002, o));
      } else {
        parts.push(rod('shelf', [x, ry - 0.005, rz + 0.008], [x, 0.03, rz + 0.012], 0.005, o));
        parts.push(sphere('shelf', [x, 0.02, rz + 0.012], 0.02, { scale: [1, 1.4, 0.45], plan: false }));
      }
    });
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w / 2, -d / 2], [w / 2, d / 2]), line([-w / 2, d / 2], [w / 2, -d / 2])],
});

const trolley = defineAsset({
  id: 'kitchen-trolley',
  name: 'Kitchen trolley',
  category: 'kitchen',
  type: 'storage',
  group: 'Kitchen cabinets',
  tags: ['trolley', 'cart', 'kitchen cart', 'butcher block', 'wheels', 'serving'],
  defaultSize: { w: 0.6, d: 0.4, h: 0.85 },
  minSize: { w: 0.45, d: 0.35, h: 0.75 },
  maxSize: { w: 0.9, d: 0.5, h: 0.95 },
  slots: [
    matSlot('top', 'Butcher-block top', 'wood-oak-natural'),
    matSlot('frame', 'Frame & trays', 'metal-white-powder'),
    matSlot('wheels', 'Castors', 'rubber-black'),
    matSlot('items', 'Bowls & jars', 'ceramic-sage'),
  ],
  build: ({ w, d, h }) => {
    const wr = 0.03;
    const castH = 0.07;
    const pt = 0.022;
    const px = w / 2 - 0.05;
    const pz = d / 2 - 0.03;
    const o = { plan: false };
    const tt = h - 0.018; // top surface (a chopping board sits on it)
    const parts: Part[] = [span('top', [-w / 2, w / 2 - 0.03], [tt - 0.035, tt], [-d / 2, d / 2], { bevel: 0.006 })];
    for (const x of [-px, px]) {
      for (const z of [-pz, pz]) {
        parts.push(span('frame', [x - pt / 2, x + pt / 2], [castH, tt - 0.035], [z - pt / 2, z + pt / 2], { bevel: 0.004, plan: false }));
        parts.push(span('frame', [x - 0.012, x + 0.012], [wr, castH], [z - 0.012, z + 0.012], o));
        parts.push(rod('wheels', [x - 0.012, wr, z], [x + 0.012, wr, z], wr, o));
      }
    }
    // Handle bar on the right end.
    parts.push(rodZ('frame', w / 2 - 0.012, tt - 0.075, -pz + 0.03, pz - 0.03, 0.011, o));
    for (const z of [-pz + 0.03, pz - 0.03]) parts.push(rodX('frame', px, w / 2 - 0.012, tt - 0.075, z, 0.007, o));
    // Two trays with lips.
    const trays = [castH + 0.05, castH + (h - castH) * 0.48];
    for (const y of trays) {
      parts.push(span('frame', [-px, px], [y, y + 0.012], [-pz, pz], o));
      parts.push(span('frame', [-px, px], [y, y + 0.035], [-pz, -pz + 0.006], o));
      parts.push(span('frame', [-px, px], [y, y + 0.035], [pz - 0.006, pz], o));
    }
    const mid = trays[1] + 0.012;
    const low = trays[0] + 0.012;
    // Stacked bowls on the middle tray, canisters below, chopping board on top.
    const br = Math.min(0.1, pz - 0.01, px * 0.5);
    for (let i = 0; i < 3; i++) {
      parts.push(
        lathe('items', [-px * 0.45, mid + i * 0.025, 0], [
          [0, 0],
          [br * 0.5, 0],
          [br * (0.92 - i * 0.04), 0.045],
          [br * (0.86 - i * 0.04), 0.045],
          [br * 0.45, 0.006],
          [0, 0.006],
        ], { segments: 24, plan: false }),
      );
    }
    parts.push(cyl('items', [px * 0.5, mid + 0.07, 0], Math.min(0.05, pz - 0.02), 0.14, { segments: 20, plan: false }));
    parts.push(rod('top', [px * 0.5, mid + 0.1, 0], [px * 0.5 + 0.03, mid + 0.24, 0.01], 0.005, o));
    parts.push(rod('top', [px * 0.5, mid + 0.1, 0], [px * 0.5 - 0.02, mid + 0.23, -0.015], 0.005, o));
    for (const x of spaced(3, -px + 0.07, px - 0.07)) {
      parts.push(cyl('items', [x, low + 0.06, 0], Math.min(0.055, pz - 0.02), 0.12, { segments: 20, plan: false }));
      parts.push(cyl('top', [x, low + 0.125, 0], Math.min(0.056, pz - 0.02), 0.01, o));
    }
    parts.push(span('top', [-w * 0.3, w * 0.05], [tt, h], [-d * 0.3, d * 0.25], { bevel: 0.004, plan: false }));
    return parts;
  },
});

const fruitBowl = defineAsset({
  id: 'fruit-bowl',
  name: 'Fruit bowl',
  category: 'kitchen',
  type: 'decor',
  group: 'Candles & tabletop',
  tags: ['fruit', 'bowl', 'apples', 'bananas', 'lemons', 'tabletop', 'centrepiece'],
  defaultSize: { w: 0.3, d: 0.3, h: 0.14 },
  minSize: { w: 0.24, d: 0.24, h: 0.11 },
  maxSize: { w: 0.4, d: 0.4, h: 0.18 },
  slots: [
    matSlot('bowl', 'Bowl', 'wood-walnut'),
    matSlot('red', 'Apples', 'plastic-red'),
    matSlot('yellow', 'Bananas & lemons', 'plastic-yellow'),
    matSlot('green', 'Grapes & stems', 'plant-leaf'),
  ],
  build: ({ w, d, h }) => {
    const s = Math.min(w, d) / 0.3;
    const k = h / 0.14;
    const rs = Math.min(s, k);
    const R = Math.min(w, d) / 2 - 0.005;
    const o = { plan: false };
    const at = (x: number, y: number, z: number): V3 => [x * s, y * k, z * s];
    const parts: Part[] = [
      lathe('bowl', [0, 0, 0], [
        [0, 0],
        [R * 0.38, 0],
        [R * 0.4, 0.012 * k],
        [R * 0.75, 0.035 * k],
        [R, 0.07 * k],
        [R * 0.95, 0.072 * k],
        [R * 0.7, 0.04 * k],
        [0, 0.02 * k],
      ], { segments: 36 }),
    ];
    const apples: V3[] = [at(-0.05, 0.06, 0.04), at(0.055, 0.062, 0.03), at(0.0, 0.065, -0.06)];
    for (const c of apples) {
      parts.push(sphere('red', c, 0.036 * rs, { scale: [1, 0.9, 1], plan: false }));
      parts.push(rod('green', [c[0], c[1] + 0.028 * rs, c[2]], [c[0] + 0.004, c[1] + 0.042 * rs, c[2]], 0.002, o));
    }
    for (const c of [at(-0.06, 0.06, -0.035), at(0.06, 0.07, -0.045)]) {
      parts.push(sphere('yellow', c, 0.03 * rs, { scale: [1.25, 0.95, 0.95], plan: false }));
    }
    // Grapes spilling over the front.
    parts.push(...(() => {
      const g: Part[] = [];
      const rand = rng(5);
      for (let i = 0; i < 9; i++) {
        g.push(sphere('green', [(0.02 + (rand() - 0.5) * 0.05) * s, (0.06 + rand() * 0.035) * k, (0.075 + (rand() - 0.5) * 0.04) * s], 0.012 * rs, o));
      }
      return g;
    })());
    // Two bananas lying across the top.
    for (const [i, y] of [0.098, 0.115].entries()) {
      parts.push(
        torus('yellow', [(-0.01 + i * 0.012) * s, y * k, (0.02 - i * 0.015) * s], 0.075 * rs, 0.016 * rs, {
          arc: 1.5,
          rotation: [Math.PI / 2, 0, 2.3 + i * 0.25],
          plan: false,
        }),
      );
    }
    return parts;
  },
  planDetail: ({ w, d }) => [poly(ellipsePoints(0, 0, Math.min(w, d) * 0.34, Math.min(w, d) * 0.34))],
});

export const KITCHEN_ASSETS: AssetDefinition[] = [
  baseCabinet,
  wallCabinet,
  tallCabinet,
  cornerCabinet,
  island,
  sinkUnit,
  cooktopUnit,
  ovenTower,
  rangeCooker,
  rangeHood,
  fridge,
  fridgeFrench,
  wineCooler,
  dishwasher,
  washingMachine,
  microwave,
  coffeeMachine,
  toaster,
  kettle,
  standMixer,
  openShelf,
  trolley,
  fruitBowl,
];

/**
 * L-shaped desks — corner desks built like the real thing, each with a left- and a right-hand return.
 *
 * Every desk has a main run along the back wall and a return down one side wall (the corner sits at the
 * back left; the right-hand versions are mirrored and listed right after). The runs keep a sensible
 * depth (60–70 cm main, 50–60 cm return) while the overall width and depth resize.
 *
 * - Steel-frame oak: solid oak top on 50 mm black steel tube legs with levelling feet, end frames,
 *   a perimeter rail, an X brace at the back, a cable tray and two grommets.
 * - Gaming: carbon-weave top with a full desk mat, a monitor riser on three posts, T-legs with long feet,
 *   a headphone hook, a cable tray and RGB strips under the riser and the front edge (it glows).
 * - Executive: 40 mm walnut top with a leather writing inlay, a full-height end panel, modesty panels and a
 *   three-drawer pedestal (pencil, box and file drawers with raised fields and brass bar pulls).
 * - Dual-motor standing: a motor in each of the two three-stage lifting columns, an L frame, long feet,
 *   a keypad that shows the height, a control box and a cable spine; resize the height to raise it.
 * - Compact corner: two 50 cm runs with a 45° inner corner, a two-shelf tower, a corner monitor riser.
 * - Built-in: fitted between walls, with a floor-to-ceiling bookcase tower, a drawer cabinet under the
 *   return and oak wall shelves above both runs.
 */
import {
  bookRow,
  clamp,
  cyl,
  defineItem,
  definePack,
  matSlot,
  prism,
  range,
  rod,
  rodPath,
  segmentText,
  span,
  type PackItem,
  type PackMaterial,
  type Part,
  type Size3,
} from '@/packs/kit';

type V2 = [number, number];
const o = { plan: false } as const;
const desk = { category: 'office' as const, type: 'surfaces' as const, group: 'Desks' };

const materials: PackMaterial[] = [
  { id: 'carbon-weave', name: 'Carbon-fibre weave', category: 'solid', color: '#28292c', roughness: 0.32, pattern: { id: 'weave', scale: 0.025, contrast: 0.4 } },
  { id: 'desk-mat', name: 'Desk mat cloth', category: 'fabric', color: '#2e3034', roughness: 0.95, pattern: { id: 'weave', scale: 0.03, contrast: 0.25 } },
  { id: 'rgb-violet', name: 'RGB strip, violet', category: 'solid', color: '#8a63ff', roughness: 0.4, emissive: '#8a63ff', emissiveIntensity: 1.3 },
  { id: 'rgb-cyan', name: 'RGB strip, cyan', category: 'solid', color: '#3fd6ff', roughness: 0.4, emissive: '#3fd6ff', emissiveIntensity: 1.3 },
  { id: 'rgb-red', name: 'RGB strip, red', category: 'solid', color: '#ff3b4a', roughness: 0.4, emissive: '#ff3b4a', emissiveIntensity: 1.3 },
];

// ───────────── Shared geometry ─────────────

/** L layout: main run along the back (depth rd), return down the left (width rw); inner corner at (xi, zi). */
function geom({ w, d }: Size3, ys: number, rd0: number, rw0: number) {
  const rd = clamp(rd0, 0.42, d - 0.35);
  const rw = clamp(rw0, 0.42, w - 0.45);
  return { w, d, ys, rd, rw, xi: -w / 2 + rw, zi: -d / 2 + rd };
}
type G = ReturnType<typeof geom>;

/** The two top boards of an L. */
const lTop = (slot: string, g: G, t: number, bevel: number, xEnd = g.w / 2): Part[] => [
  span(slot, [-g.w / 2, xEnd], [g.ys - t, g.ys], [-g.d / 2, g.zi], { bevel }),
  span(slot, [-g.w / 2, g.xi], [g.ys - t, g.ys], [g.zi, g.d / 2], { bevel }),
];

/** A cable grommet ring sitting 0.5 mm proud of the top. */
const grommet = (slot: string, x: number, z: number, ys: number): Part => cyl(slot, [x, ys - 0.0015, z], 0.03, 0.004, { segments: 20, ...o });

/** Sheet-steel cable tray hung under the back of the main run. */
function cableTray(slot: string, x: V2, z0: number, yb: number): Part[] {
  return [
    span(slot, x, [yb - 0.14, yb - 0.136], [z0, z0 + 0.12], o),
    span(slot, x, [yb - 0.14, yb - 0.075], [z0 + 0.116, z0 + 0.12], o),
    span(slot, x, [yb - 0.14, yb - 0.1], [z0, z0 + 0.004], o),
    ...[x[0] + 0.04, x[1] - 0.04].map((xx) => span(slot, [xx - 0.012, xx + 0.012], [yb - 0.1, yb], [z0, z0 + 0.003], o)),
  ];
}

/** A bar pull on a front facing +x (drawers under a return), centred at (x face, y, z). */
function pullX(slot: string, x: number, y: number, z: number, len: number): Part[] {
  const st = 0.028;
  return [rod(slot, [x + st, y, z - len / 2], [x + st, y, z + len / 2], 0.0055, o), rod(slot, [x, y, z - len / 2 + 0.015], [x + st, y, z - len / 2 + 0.015], 0.0045, o), rod(slot, [x, y, z + len / 2 - 0.015], [x + st, y, z + len / 2 - 0.015], 0.0045, o)];
}

/** Drawer fronts facing +x over z, stacked by `ys` (bottom to top); raised fields on the deeper ones. */
function drawersX(front: string, handle: string, xF: number, z: V2, ys: number[], field: boolean): Part[] {
  const parts: Part[] = [];
  const zc = (z[0] + z[1]) / 2;
  for (const i of range(ys.length - 1)) {
    const [y0, y1] = [ys[i] + 0.002, ys[i + 1] - 0.002];
    parts.push(span(front, [xF, xF + 0.02], [y0, y1], [z[0] + 0.003, z[1] - 0.003], { bevel: 0.002, plan: false }));
    const deep = y1 - y0 > 0.16;
    if (field && deep) parts.push(span(front, [xF + 0.02, xF + 0.025], [y0 + 0.045, y1 - 0.1], [z[0] + 0.05, z[1] - 0.05], { bevel: 0.002, plan: false }));
    parts.push(...pullX(handle, xF + 0.02, deep ? y1 - 0.055 : (y0 + y1) / 2, zc, Math.min(0.2, (z[1] - z[0]) * 0.5)));
  }
  return parts;
}

function mirrorX(parts: Part[]): Part[] {
  return parts.map((p) => {
    const q: Part = { ...p, position: [-p.position[0], p.position[1], p.position[2]] };
    if (p.rotation) q.rotation = [p.rotation[0], -p.rotation[1], -p.rotation[2]];
    if (q.shape === 'prism') q.outline = q.outline.map(([x, z]) => [-x, z] as V2).reverse();
    return q;
  });
}

// ───────────── Steel-frame oak ─────────────

function steelOak(size: Size3): Part[] {
  const g = geom(size, size.h - 0.002, 0.65, 0.6);
  const { w, d, xi, zi, ys } = g;
  const t = 0.028;
  const yb = ys - t;
  const s = 0.05;
  const parts: Part[] = lTop('top', g, t, 0.004);
  const leg = (x: number, z: number) => parts.push(span('frame', [x - s / 2, x + s / 2], [0.012, yb], [z - s / 2, z + s / 2], { bevel: 0.003, plan: false }), cyl('frame', [x, 0.006, z], 0.017, 0.012, { segments: 12, ...o }));
  const xr = w / 2 - 0.06;
  const xl = -w / 2 + 0.06;
  const zb = -d / 2 + 0.06;
  const zf = d / 2 - 0.06;
  leg(xr, zb);
  leg(xr, zi - 0.06);
  leg(xl, zb);
  leg(xl, zf);
  leg(xi - 0.06, zf);
  const rail = (x: V2, z: V2, y: V2) => parts.push(span('frame', x, y, z, { bevel: 0.002, plan: false }));
  // End frames: a rail under the top and a foot stretcher between each pair of end legs.
  for (const y of [[yb - 0.05, yb], [0.07, 0.11]] as V2[]) {
    rail([xr - 0.02, xr + 0.02], [zb, zi - 0.06], y);
    rail([xl, xi - 0.06], [zf - 0.02, zf + 0.02], y);
  }
  // Perimeter rail under the top.
  rail([xl, xr], [zb - 0.02, zb + 0.02], [yb - 0.05, yb]);
  rail([xl - 0.02, xl + 0.02], [zb, zf], [yb - 0.05, yb]);
  rail([xi - 0.06, xr], [zi - 0.1, zi - 0.06], [yb - 0.05, yb]);
  rail([xi - 0.1, xi - 0.06], [zi - 0.06, zf], [yb - 0.05, yb]);
  // X brace across the back.
  parts.push(rod('frame', [xl + 0.03, 0.12, zb], [xr - 0.03, yb - 0.06, zb], 0.007, o), rod('frame', [xl + 0.03, yb - 0.06, zb], [xr - 0.03, 0.12, zb], 0.007, o));
  parts.push(...cableTray('frame', [Math.max(xi, -0.1), w / 2 - 0.16], -d / 2 + 0.09, yb - 0.05));
  parts.push(grommet('frame', w / 2 - 0.25, -d / 2 + 0.08, ys), grommet('frame', -w / 2 + 0.16, -d / 2 + 0.16, ys));
  return parts;
}

// ───────────── Gaming ─────────────

function gaming(size: Size3): Part[] {
  const ys = size.h - 0.14;
  const g = geom(size, ys, 0.65, 0.6);
  const { w, d, xi, zi } = g;
  const t = 0.025;
  const yb = ys - t;
  const parts: Part[] = lTop('top', g, t, 0.006);
  // Full-width desk mat with stitched edges.
  const mat: [V2, V2, V2] = [[-w / 2 + 0.03, w / 2 - 0.03], [ys, ys + 0.003], [-d / 2 + 0.27, zi - 0.025]];
  parts.push(span('mat', mat[0], mat[1], mat[2], { bevel: 0.001, plan: false }));
  for (const [a, b] of [
    [[mat[0][0] + 0.006, mat[2][0] + 0.006], [mat[0][1] - 0.006, mat[2][0] + 0.006]],
    [[mat[0][0] + 0.006, mat[2][1] - 0.006], [mat[0][1] - 0.006, mat[2][1] - 0.006]],
    [[mat[0][0] + 0.006, mat[2][0] + 0.006], [mat[0][0] + 0.006, mat[2][1] - 0.006]],
    [[mat[0][1] - 0.006, mat[2][0] + 0.006], [mat[0][1] - 0.006, mat[2][1] - 0.006]],
  ] as [V2, V2][])
    parts.push(rod('mat', [a[0], ys + 0.003, a[1]], [b[0], ys + 0.003, b[1]], 0.0016, o));
  // Monitor riser on three posts, with a light strip under its front edge.
  const rz: V2 = [-d / 2 + 0.02, -d / 2 + 0.25];
  parts.push(span('top', [-w / 2 + 0.04, w / 2 - 0.04], [ys + 0.115, ys + 0.135], rz, { bevel: 0.004, plan: false }));
  for (const x of [-w / 2 + 0.07, 0, w / 2 - 0.07]) parts.push(span('frame', [x - 0.015, x + 0.015], [ys, ys + 0.115], [rz[0] + 0.03, rz[1] - 0.03], { bevel: 0.003, plan: false }));
  parts.push(span('light', [-w / 2 + 0.09, w / 2 - 0.09], [ys + 0.111, ys + 0.115], [rz[1] - 0.016, rz[1] - 0.006], o));
  parts.push(span('light', [xi + 0.03, w / 2 - 0.05], [yb - 0.004, yb], [zi - 0.02, zi - 0.008], o));
  // T-legs with long feet: right end, return end and an L-foot in the corner.
  const zcM = (-d / 2 + zi) / 2;
  const xcR = (-w / 2 + xi) / 2;
  const post = (x: number, z: number) => parts.push(span('frame', [x - 0.03, x + 0.03], [0.045, yb], [z - 0.025, z + 0.025], { bevel: 0.004, plan: false }));
  const foot = (x: V2, z: V2) => parts.push(span('frame', x, [0.01, 0.048], z, { bevel: 0.01, plan: false }));
  const pad = (x: number, z: number) => parts.push(cyl('frame', [x, 0.005, z], 0.018, 0.01, { segments: 10, ...o }));
  post(w / 2 - 0.07, zcM);
  foot([w / 2 - 0.1, w / 2 - 0.04], [-d / 2 + 0.03, zi - 0.03]);
  pad(w / 2 - 0.07, -d / 2 + 0.06);
  pad(w / 2 - 0.07, zi - 0.06);
  post(xcR, d / 2 - 0.07);
  foot([-w / 2 + 0.03, xi - 0.03], [d / 2 - 0.1, d / 2 - 0.04]);
  pad(-w / 2 + 0.06, d / 2 - 0.07);
  pad(xi - 0.06, d / 2 - 0.07);
  post(-w / 2 + 0.07, -d / 2 + 0.07);
  foot([-w / 2 + 0.03, -w / 2 + 0.36], [-d / 2 + 0.04, -d / 2 + 0.1]);
  foot([-w / 2 + 0.04, -w / 2 + 0.1], [-d / 2 + 0.1, -d / 2 + 0.36]);
  // Beams under the top and brackets over each post.
  const beam = (x: V2, z: V2) => parts.push(span('frame', x, [yb - 0.045, yb], z, { bevel: 0.003, plan: false }));
  beam([-w / 2 + 0.05, w / 2 - 0.05], [-d / 2 + 0.05, -d / 2 + 0.09]);
  beam([-w / 2 + 0.05, -w / 2 + 0.09], [-d / 2 + 0.09, d / 2 - 0.05]);
  beam([w / 2 - 0.1, w / 2 - 0.04], [-d / 2 + 0.09, zi - 0.03]);
  beam([-w / 2 + 0.09, xi - 0.03], [d / 2 - 0.1, d / 2 - 0.04]);
  // Headphone hook under the right front corner, cable tray at the back.
  parts.push(...rodPath('frame', [[w / 2 - 0.15, yb, zi - 0.07], [w / 2 - 0.15, yb - 0.09, zi - 0.07], [w / 2 - 0.15, yb - 0.09, zi - 0.025], [w / 2 - 0.15, yb - 0.072, zi - 0.016]], 0.005));
  parts.push(...cableTray('frame', [Math.max(xi, -0.2), w / 2 - 0.2], -d / 2 + 0.1, yb - 0.045));
  return parts;
}

// ───────────── Executive ─────────────

function executive(size: Size3): Part[] {
  const g = geom(size, size.h - 0.002, 0.75, 0.6);
  const { w, d, xi, zi, ys } = g;
  const t = 0.04;
  const yb = ys - t;
  const parts: Part[] = lTop('top', g, t, 0.006);
  // Leather writing inlay on the main run.
  parts.push(span('inlay', [Math.max(xi + 0.06, -w / 2 + 0.3), w / 2 - 0.12], [ys, ys + 0.0015], [-d / 2 + 0.13, zi - 0.1], o));
  parts.push(grommet('handles', w / 2 - 0.2, -d / 2 + 0.07, ys), grommet('handles', -w / 2 + 0.14, -d / 2 + 0.14, ys));
  // Full-height end panel on the right and modesty panels along both walls.
  parts.push(span('body', [w / 2 - 0.045, w / 2 - 0.01], [0, yb], [-d / 2 + 0.015, zi - 0.015], { bevel: 0.003 }));
  parts.push(span('body', [-w / 2 + 0.05, w / 2 - 0.045], [0.24, yb], [-d / 2 + 0.04, -d / 2 + 0.058], o));
  const pz: V2 = [d / 2 - 0.46, d / 2 - 0.012];
  parts.push(span('body', [-w / 2 + 0.032, -w / 2 + 0.05], [0.24, yb], [-d / 2 + 0.04, pz[0]], o));
  // Three-drawer pedestal under the end of the return, drawers facing into the corner.
  const xF = xi - 0.045;
  parts.push(span('body', [-w / 2 + 0.015, xF], [0, yb], pz, { bevel: 0.002 }));
  parts.push(...drawersX('body', 'handles', xF, pz, [0.075, 0.39, 0.6, yb - 0.008], true));
  return parts;
}

// ───────────── Dual-motor standing ─────────────

function standing(size: Size3): Part[] {
  const g = geom(size, size.h, 0.7, 0.6);
  const { w, d, xi, zi, ys } = g;
  const t = 0.025;
  const yb = ys - t;
  const parts: Part[] = lTop('top', g, t, 0.008);
  const zcM = (-d / 2 + zi) / 2;
  const xcR = (-w / 2 + xi) / 2;
  const motorTop = yb - 0.035;
  const colTop = motorTop - 0.06;
  const L = colTop - 0.045;
  /** A three-stage lifting column at (x, z); `alongZ` = its long side and foot run front to back. */
  const column = (x: number, z: number, alongZ: boolean, foot: V2) => {
    const st = (a: number, b: number, y: V2) => parts.push(span('frame', alongZ ? [x - b / 2, x + b / 2] : [x - a / 2, x + a / 2], y, alongZ ? [z - a / 2, z + a / 2] : [z - b / 2, z + b / 2], { bevel: 0.004, plan: false }));
    const a = 0.045 + L * 0.42;
    const b = a + L * 0.32;
    st(0.095, 0.065, [0.045, a]);
    st(0.085, 0.057, [a - 0.05, b]);
    st(0.075, 0.049, [b - 0.05, colTop]);
    // Motor housing on top of the column, under the bracket.
    parts.push(span('motor', alongZ ? [x - 0.04, x + 0.04] : [x - 0.055, x + 0.055], [colTop, motorTop], alongZ ? [z - 0.055, z + 0.055] : [z - 0.04, z + 0.04], { bevel: 0.006, plan: false }));
    // Foot and levelling pads.
    parts.push(span('frame', alongZ ? [x - 0.035, x + 0.035] : foot, [0.012, 0.045], alongZ ? foot : [z - 0.035, z + 0.035], { bevel: 0.01, plan: false }));
    for (const f of [foot[0] + 0.03, foot[1] - 0.03]) parts.push(cyl('motor', alongZ ? [x, 0.006, f] : [f, 0.006, z], 0.018, 0.012, { segments: 10, ...o }));
    // Bracket under the top.
    parts.push(span('frame', alongZ ? [x - 0.035, x + 0.035] : [foot[0] + 0.01, foot[1] - 0.01], [motorTop, yb], alongZ ? [foot[0] + 0.01, foot[1] - 0.01] : [z - 0.035, z + 0.035], { bevel: 0.003, plan: false }));
  };
  column(w / 2 - 0.12, zcM, true, [-d / 2 + 0.03, zi - 0.03]);
  column(xcR, d / 2 - 0.12, false, [-w / 2 + 0.03, xi - 0.03]);
  // L frame: a beam along the main run and one down the return, meeting in the corner.
  parts.push(span('frame', [-w / 2 + 0.05, w / 2 - 0.155], [yb - 0.04, yb], [zcM - 0.025, zcM + 0.025], { bevel: 0.003, plan: false }));
  parts.push(span('frame', [xcR - 0.025, xcR + 0.025], [yb - 0.04, yb], [zcM + 0.025, d / 2 - 0.155], { bevel: 0.003, plan: false }));
  parts.push(span('frame', [-w / 2 + 0.05, -w / 2 + 0.25], [yb - 0.006, yb], [-d / 2 + 0.05, zcM + 0.12], o));
  // Control box, keypad with a height readout, cable spine down to the floor.
  parts.push(span('motor', [-0.05, 0.17], [yb - 0.04, yb], [-d / 2 + 0.06, -d / 2 + 0.13], { bevel: 0.006, plan: false }));
  const kx: V2 = [w / 2 - 0.34, w / 2 - 0.2];
  parts.push(span('motor', kx, [yb - 0.032, yb], [zi - 0.06, zi - 0.006], { bevel: 0.004, plan: false }));
  parts.push(...segmentText('frame', (size.h * 100).toFixed(1), kx[0] + 0.035, yb - 0.016, zi - 0.006, 0.011));
  for (const i of range(4)) {
    const x = kx[0] + 0.07 + i * 0.016;
    parts.push(span('frame', [x - 0.005, x + 0.005], [yb - 0.021, yb - 0.011], [zi - 0.006, zi - 0.003], o));
  }
  const n = Math.max(3, Math.floor((yb - 0.06) / 0.075));
  for (const i of range(n)) {
    const y0 = 0.01 + (i * (yb - 0.06)) / n;
    const step = (yb - 0.06) / n;
    parts.push(cyl('motor', [0.06 + 0.035 * Math.sin((i / n) * Math.PI), y0 + step / 2, -d / 2 + 0.1], 0.018, step * 0.9, { segments: 10, ...o }));
  }
  parts.push(...cableTray('frame', [Math.max(xi, 0.2), w / 2 - 0.2], -d / 2 + 0.05, yb - 0.04));
  return parts;
}

// ───────────── Compact corner ─────────────

function compact(size: Size3): Part[] {
  const ys = size.h - 0.14;
  const g = geom(size, ys, 0.5, 0.5);
  const { w, d, xi, zi } = g;
  const t = 0.025;
  const yb = ys - t;
  const c = Math.min(0.18, (w - g.rw) * 0.3, (d - g.rd) * 0.3);
  const parts: Part[] = [...lTop('top', g, t, 0.003), prism('top', [[xi, zi], [xi + c, zi], [xi, zi + c]], yb, t)];
  // Two-shelf tower under the right end.
  const tx: V2 = [w / 2 - 0.34, w / 2 - 0.01];
  parts.push(span('frame', [tx[0], tx[0] + 0.018], [0, yb], [-d / 2 + 0.01, zi - 0.01], { bevel: 0.002 }), span('frame', [tx[1] - 0.018, tx[1]], [0, yb], [-d / 2 + 0.01, zi - 0.01], { bevel: 0.002 }));
  for (const y of [0.04, 0.33]) parts.push(span('frame', [tx[0] + 0.018, tx[1] - 0.018], [y, y + 0.018], [-d / 2 + 0.018, zi - 0.02], o));
  parts.push(span('frame', [tx[0] + 0.018, tx[1] - 0.018], [0.04, yb], [-d / 2 + 0.01, -d / 2 + 0.018], o));
  // Panel leg at the end of the return, a corner leg and back rails.
  parts.push(span('frame', [-w / 2 + 0.01, xi - 0.01], [0, yb], [d / 2 - 0.028, d / 2 - 0.01], { bevel: 0.002 }));
  parts.push(span('frame', [-w / 2 + 0.02, -w / 2 + 0.06], [0, yb], [-d / 2 + 0.02, -d / 2 + 0.06], o));
  parts.push(span('frame', [-w / 2 + 0.06, tx[0]], [yb - 0.08, yb], [-d / 2 + 0.02, -d / 2 + 0.036], o), span('frame', [-w / 2 + 0.02, -w / 2 + 0.036], [yb - 0.08, yb], [-d / 2 + 0.06, d / 2 - 0.028], o));
  // Corner monitor riser: a triangular shelf on two low panels.
  const r = Math.min(0.46, g.rd - 0.02, g.rw - 0.02);
  parts.push(span('frame', [-w / 2 + 0.01, -w / 2 + r - 0.06], [ys, ys + 0.11], [-d / 2 + 0.01, -d / 2 + 0.026], o));
  parts.push(span('frame', [-w / 2 + 0.01, -w / 2 + 0.026], [ys, ys + 0.11], [-d / 2 + 0.026, -d / 2 + r - 0.06], o));
  parts.push(prism('top', [[-w / 2 + 0.008, -d / 2 + 0.008], [-w / 2 + r, -d / 2 + 0.008], [-w / 2 + 0.008, -d / 2 + r]], ys + 0.11, 0.018, o));
  return parts;
}

// ───────────── Built-in with bookcase ─────────────

function builtIn(size: Size3): Part[] {
  const { h } = size;
  const g = geom(size, 0.75, 0.6, 0.55);
  const { w, d, xi, ys, rd } = g;
  const t = 0.03;
  const yb = ys - t;
  const tw = 0.45;
  const parts: Part[] = lTop('top', g, t, 0.003, w / 2 - tw);
  // Bookcase tower to the ceiling at the right end.
  const x0 = w / 2 - tw;
  const zT: V2 = [-d / 2, -d / 2 + rd];
  parts.push(span('body', [x0, x0 + 0.018], [0, h], zT), span('body', [w / 2 - 0.018, w / 2], [0, h], zT));
  parts.push(span('body', [x0 + 0.018, w / 2 - 0.018], [h - 0.018, h], zT));
  parts.push(span('body', [x0 + 0.018, w / 2 - 0.018], [0, 0.08], [zT[0] + 0.02, zT[1] - 0.03], o));
  parts.push(span('body', [x0 + 0.018, w / 2 - 0.018], [0.08, h - 0.018], [zT[0], zT[0] + 0.008], o));
  const nShelf = Math.max(3, Math.round((h - 0.1) / 0.34));
  const levels = range(nShelf).map((i) => 0.08 + ((h - 0.098 - 0.08) * i) / nShelf);
  for (const y of levels) parts.push(span('top', [x0 + 0.018, w / 2 - 0.018], [y, y + 0.022], [zT[0] + 0.008, zT[1] - 0.02], o));
  // Books on three of the shelves.
  const gap = (h - 0.098 - 0.08) / nShelf;
  for (const [k, i] of [1, 3, 4].filter((i) => i < nShelf).entries()) parts.push(...bookRow('books', [x0 + 0.03, w / 2 - 0.03], levels[i] + 0.022, zT[0] + 0.012, Math.min(0.28, gap - 0.05), Math.min(0.22, rd - 0.1), 7 + k * 11, { fill: k === 1 ? 0.55 : 0.85, minW: 0.026, maxW: 0.05, lean: k === 1 }));
  // Wall battens under the desk top.
  parts.push(span('body', [-w / 2, x0], [yb - 0.04, yb], [-d / 2, -d / 2 + 0.02], o));
  const cz: V2 = [d / 2 - 0.45, d / 2];
  parts.push(span('body', [-w / 2, -w / 2 + 0.02], [yb - 0.04, yb], [-d / 2 + 0.02, cz[0]], o));
  // Drawer cabinet under the return, fronts facing into the corner.
  const xF = xi - 0.022;
  parts.push(span('body', [-w / 2, xF], [0, yb], cz, { bevel: 0.002 }));
  parts.push(...drawersX('body', 'handles', xF, cz, [0.08, 0.3, 0.52, yb - 0.006], false));
  // Oak wall shelves above both runs.
  for (const y of [1.25, 1.62].filter((y) => y < h - 0.12)) {
    parts.push(span('top', [-w / 2, x0], [y - 0.025, y], [-d / 2, -d / 2 + 0.26], o));
    parts.push(span('top', [-w / 2, -w / 2 + 0.24], [y - 0.025, y], [-d / 2 + 0.26, d / 2 - 0.15], o));
  }
  return parts;
}

// ───────────── Items ─────────────

type Finish = [name: string, ...materials: string[]];
interface DeskSpec {
  id: string;
  name: string;
  description: string;
  tags: string[];
  size: Size3;
  min: Size3;
  max: Size3;
  slots: [id: string, label: string][];
  finishes: Finish[];
  build: (s: Size3) => Part[];
  light?: PackItem['light'];
}

const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const S3 = (w: number, d: number, h: number): Size3 => ({ w, d, h });

/** A left-hand desk and its mirrored right-hand version (listed right after it). */
function lPair(p: DeskSpec): PackItem[] {
  const [first, ...rest] = p.finishes;
  const base = {
    ...desk,
    defaultSize: p.size,
    minSize: p.min,
    maxSize: p.max,
    wallSnap: true,
    tags: ['l-shaped desk', 'corner desk', 'bàn chữ l', ...p.tags],
    slots: p.slots.map(([id, label], i) => matSlot(id, label, first[i + 1])),
    variants: rest.map(([name, ...mats]) => ({ id: slug(name), name, materials: Object.fromEntries(p.slots.map(([id], i) => [id, mats[i]])) })),
  };
  const left = defineItem({ ...base, id: `${p.id}-left`, name: `${p.name}, return left`, description: `${p.description} The return is on the left.`, build: p.build, light: p.light });
  const right = defineItem({
    ...base,
    id: `${p.id}-right`,
    name: `${p.name}, return right`,
    description: `${p.description} The return is on the right.`,
    variantOf: left.id,
    build: (s) => mirrorX(p.build(s)),
    light: p.light && { ...p.light, x: -(p.light.x ?? 0) },
  });
  return [left, right];
}

const items: PackItem[] = [
  ...lPair({
    id: 'steel-frame-oak-l-desk',
    name: 'Steel-frame oak L desk',
    description: 'A solid oak L desk on a black steel tube frame: levelling feet, welded end frames, an X brace at the back, a cable tray and two cable grommets.',
    tags: ['steel frame', 'oak', 'industrial', 'home office', 'workstation'],
    size: S3(1.7, 1.4, 0.75),
    min: S3(1.3, 1.1, 0.72),
    max: S3(2.4, 2.0, 0.78),
    slots: [['top', 'Top'], ['frame', 'Steel frame']],
    finishes: [
      ['Oak & black steel', 'wood-oak-natural', 'metal-black-matte'],
      ['Walnut & black steel', 'wood-walnut', 'metal-black-matte'],
      ['Light oak & white', 'wood-oak-light', 'metal-white-powder'],
      ['Smoked oak & gunmetal', 'wood-dark-stain', 'metal-gunmetal'],
      ['Acacia & bronze', 'wood-acacia', 'metal-bronze'],
    ],
    build: steelOak,
  }),
  ...lPair({
    id: 'gaming-l-desk-riser',
    name: 'Gaming L desk with riser and RGB',
    description: 'A carbon-weave gaming L desk with a full desk mat, a monitor riser on three posts, T-legs on long feet, a headphone hook, a cable tray and glowing RGB strips under the riser and the front edge.',
    tags: ['gaming desk', 'bàn gaming', 'monitor riser', 'rgb', 'streamer', 'esports'],
    size: S3(1.6, 1.2, 0.9),
    min: S3(1.3, 1.0, 0.84),
    max: S3(2.2, 1.8, 0.95),
    slots: [['top', 'Top & riser'], ['frame', 'Frame'], ['mat', 'Desk mat'], ['light', 'Light strips']],
    finishes: [
      ['Carbon & violet', 'carbon-weave', 'metal-black-matte', 'desk-mat', 'rgb-violet'],
      ['Carbon & red', 'carbon-weave', 'metal-black-matte', 'fabric-charcoal', 'rgb-red'],
      ['White & cyan', 'laminate-white-matte', 'metal-white-powder', 'fabric-wool-grey', 'rgb-cyan'],
      ['Walnut & cyan', 'laminate-walnut', 'metal-black-matte', 'desk-mat', 'rgb-cyan'],
    ],
    build: gaming,
    light: { color: '#8a63ff', intensity: 0.35, distance: 1.6, y: 0.86, x: 0, z: -0.32 },
  }),
  ...lPair({
    id: 'executive-l-desk',
    name: 'Executive L desk with drawer pedestal',
    description: 'A 40 mm walnut executive desk with a leather writing inlay, a full-height end panel, modesty panels and a pencil, box and file drawer pedestal with raised fields and brass bar pulls.',
    tags: ['executive desk', 'bàn giám đốc', 'pedestal', 'drawers', 'walnut', 'leather inlay'],
    size: S3(1.9, 1.7, 0.75),
    min: S3(1.5, 1.4, 0.72),
    max: S3(2.4, 2.1, 0.78),
    slots: [['top', 'Top'], ['body', 'Panels & pedestal'], ['inlay', 'Writing inlay'], ['handles', 'Pulls & grommets']],
    finishes: [
      ['Walnut & black leather', 'wood-walnut', 'wood-walnut', 'leather-black', 'metal-brass'],
      ['Oak & cognac leather', 'wood-oak-natural', 'wood-oak-natural', 'leather-cognac', 'metal-brass'],
      ['Mahogany & oxblood', 'wood-mahogany', 'wood-mahogany', 'leather-burgundy', 'metal-gold'],
      ['Ebony & chrome', 'wood-ebony', 'wood-ebony', 'leather-smooth-black', 'metal-chrome'],
      ['White & tan', 'laminate-white-matte', 'laminate-white-matte', 'leather-tan', 'metal-brushed-steel'],
    ],
    build: executive,
  }),
  ...lPair({
    id: 'dual-motor-standing-l-desk',
    name: 'Dual-motor standing L desk',
    description: 'A sit-stand L desk with a motor in each of its two three-stage lifting columns, an L frame, long feet, a keypad that reads the height, a control box and a cable spine; resize the height from 65 to 128 cm to raise it.',
    tags: ['standing desk', 'sit stand', 'bàn nâng hạ', 'electric', 'height adjustable', 'ergonomic', 'dual motor'],
    size: S3(1.8, 1.5, 0.74),
    min: S3(1.4, 1.1, 0.65),
    max: S3(2.2, 1.9, 1.28),
    slots: [['top', 'Top'], ['frame', 'Columns & frame'], ['motor', 'Motors, keypad & pads']],
    finishes: [
      ['Oak & white', 'laminate-oak', 'metal-white-powder', 'plastic-black'],
      ['Walnut & black', 'laminate-walnut', 'metal-black-matte', 'plastic-black'],
      ['Bamboo & grey', 'wood-bamboo', 'metal-anthracite', 'plastic-black'],
      ['White & white', 'laminate-white-matte', 'metal-white-powder', 'plastic-white'],
      ['Black & black', 'laminate-black', 'metal-black-matte', 'plastic-black'],
    ],
    build: standing,
  }),
  ...lPair({
    id: 'compact-corner-desk',
    name: 'Compact corner desk with shelf tower',
    description: 'A small corner desk of two 50 cm deep runs joined by a 45° inner corner, with a two-shelf tower under one end and a triangular monitor riser in the corner.',
    tags: ['compact desk', 'small desk', 'bàn góc', 'student desk', 'bedroom', 'small space'],
    size: S3(1.2, 1.2, 0.89),
    min: S3(1.0, 1.0, 0.85),
    max: S3(1.6, 1.6, 0.93),
    slots: [['top', 'Top & riser'], ['frame', 'Panels & shelves']],
    finishes: [
      ['Oak & white', 'laminate-oak', 'laminate-white-matte'],
      ['Walnut & black', 'laminate-walnut', 'laminate-black'],
      ['Sage & white', 'laminate-sage', 'laminate-white-matte'],
      ['Grey & greige', 'laminate-grey', 'laminate-greige'],
      ['Pink & white', 'laminate-pink', 'laminate-white-matte'],
    ],
    build: compact,
  }),
  ...lPair({
    id: 'built-in-l-desk-bookcase',
    name: 'Built-in L desk with bookcase and wall shelves',
    description: 'A fitted L desk between walls: an oak top running into a floor-to-ceiling bookcase tower, a drawer cabinet under the return and oak wall shelves above both runs.',
    tags: ['built-in desk', 'fitted', 'bookcase', 'study', 'bàn liền tủ', 'home office', 'shelves'],
    size: S3(2.2, 1.6, 2.1),
    min: S3(1.8, 1.2, 1.9),
    max: S3(3.0, 2.2, 2.4),
    slots: [['body', 'Carcass & panels'], ['top', 'Top & shelves'], ['handles', 'Pulls'], ['books', 'Books']],
    finishes: [
      ['White & oak', 'paint-warm-white', 'wood-oak-natural', 'metal-brass', 'book-mix'],
      ['Sage & oak', 'paint-sage', 'wood-oak-light', 'metal-brass', 'book-mix'],
      ['Navy & walnut', 'paint-navy', 'wood-walnut', 'metal-brass', 'book-mix'],
      ['Charcoal & oak', 'paint-charcoal', 'wood-oak-natural', 'metal-black-matte', 'book-mix'],
      ['Greige & walnut', 'paint-greige', 'wood-walnut', 'metal-champagne', 'book-mix'],
    ],
    build: builtIn,
  }),
];

export default definePack({
  name: 'L-shaped desks',
  version: '1.0.0',
  author: 'Neest',
  description: 'Detailed corner desks with left- and right-hand returns: steel-frame oak, gaming, executive, dual-motor standing, compact and built-in.',
  license: 'CC0-1.0',
  items,
  materials,
});

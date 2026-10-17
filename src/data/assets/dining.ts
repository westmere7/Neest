import type { AssetDefinition, Part, PlanStroke } from './types';
import {
  barPull,
  box,
  cells,
  cellSpans,
  clamp,
  cushion,
  cyl,
  defineAsset,
  discZ,
  ellipsePoints,
  frame4,
  knob,
  lathe,
  legs4,
  lerp,
  line,
  matSlot,
  pillow,
  poly,
  prism,
  range,
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
  span,
  sphere,
  torus,
  tufts,
  turnedLeg,
  vcyl,
  type V2,
  type V3,
} from './parts';

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

/** Point a fraction `t` of the way from a to b. */
const along = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** Plank seams across a table top made of `n` boards spread along Z, between x0 and x1. */
function plankSeams(x0: number, x1: number, d: number, n: number): PlanStroke[] {
  return cellSpans(n, -d / 2, d / 2)
    .slice(1)
    .map(([z]) => line([x0, z], [x1, z]));
}

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

const tableRect = defineAsset({
  id: 'dining-table-rect',
  name: 'Rectangular dining table',
  category: 'dining',
  type: 'surfaces',
  group: 'Dining tables',
  tags: ['table', 'dining table', 'kitchen table', 'rectangular'],
  defaultSize: { w: 1.6, d: 0.9, h: 0.75 },
  minSize: { w: 0.8, d: 0.6, h: 0.65 },
  maxSize: { w: 3.0, d: 1.2, h: 0.8 },
  slots: [matSlot('top', 'Top', 'wood-oak-light'), matSlot('legs', 'Legs & apron', 'wood-oak-light')],
  build: ({ w, d, h }) => {
    const t = 0.035;
    const leg = 0.06;
    const inset = 0.05;
    const apronH = 0.08;
    const at = 0.02;
    const ox = w / 2 - inset; // outer face of legs
    const oz = d / 2 - inset;
    const ya: [number, number] = [h - t - apronH, h - t];
    const be = Math.min(0.07, w * 0.06);
    const nP = clamp(Math.round(d / 0.15), 3, 8);
    const o = { plan: false };
    const lc = ox - leg / 2; // leg centre x
    const parts: Part[] = [
      ...slats('top', [-w / 2 + be, w / 2 - be], [h - t, h], [-d / 2, d / 2], nP, { axis: 'z', gap: 0.015, bevel: 0.004 }),
      span('top', [-w / 2, -w / 2 + be], [h - t, h], [-d / 2, d / 2], { bevel: 0.004 }),
      span('top', [w / 2 - be, w / 2], [h - t, h], [-d / 2, d / 2], { bevel: 0.004 }),
      ...legs4('legs', w, d, inset, 0, h - t, leg),
      span('legs', [-ox + leg, ox - leg], ya, [oz - at, oz], o),
      span('legs', [-ox + leg, ox - leg], ya, [-oz, -oz + at], o),
      span('legs', [ox - at, ox], ya, [-oz + leg, oz - leg], o),
      span('legs', [-ox, -ox + at], ya, [-oz + leg, oz - leg], o),
      // Beading along the long aprons.
      rodX('legs', -ox + leg, ox - leg, ya[0] + 0.008, oz - 0.002, 0.006, o),
      rodX('legs', -ox + leg, ox - leg, ya[0] + 0.008, -oz + 0.002, 0.006, o),
      // H-stretcher.
      span('legs', [-lc - 0.015, -lc + 0.015], [0.1, 0.14], [-oz + leg, oz - leg], o),
      span('legs', [lc - 0.015, lc + 0.015], [0.1, 0.14], [-oz + leg, oz - leg], o),
      span('legs', [-lc + 0.015, lc - 0.015], [0.11, 0.14], [-0.015, 0.015], o),
    ];
    // Corner blocks inside the apron.
    for (const fx of [-1, 1]) {
      for (const fz of [-1, 1]) {
        parts.push(
          box('legs', [fx * (ox - leg - 0.02), ya[1] - 0.03, fz * (oz - leg - 0.02)], [0.06, 0.05, 0.025], {
            rotation: [0, fx * fz * (Math.PI / 4), 0],
            plan: false,
          }),
        );
      }
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const be = Math.min(0.07, w * 0.06);
    const nP = clamp(Math.round(d / 0.15), 3, 8);
    return [
      line([-w / 2 + be, -d / 2], [-w / 2 + be, d / 2]),
      line([w / 2 - be, -d / 2], [w / 2 - be, d / 2]),
      ...plankSeams(-w / 2 + be, w / 2 - be, d, nP),
    ];
  },
});

const tableRound = defineAsset({
  id: 'dining-table-round',
  name: 'Round dining table',
  category: 'dining',
  type: 'surfaces',
  group: 'Dining tables',
  tags: ['table', 'dining table', 'round', 'pedestal', 'farmhouse'],
  defaultSize: { w: 1.1, d: 1.1, h: 0.75 },
  minSize: { w: 0.7, d: 0.7, h: 0.65 },
  maxSize: { w: 1.6, d: 1.6, h: 0.8 },
  slots: [matSlot('top', 'Top', 'laminate-white-matte'), matSlot('base', 'Pedestal', 'metal-white-powder')],
  build: ({ w, d, h }) => {
    const zs = d / w;
    const sz: V3 = [1, 1, zs];
    const t = 0.035;
    const R = w / 2;
    const apron = 0.07;
    const hc = h - t - apron;
    const o = { plan: false };
    const parts: Part[] = [
      cyl('top', [0, h - t / 2, 0], R - t / 2, t, { scale: sz, segments: 56 }),
      ring('top', [0, h - t / 2, 0], R - t / 2, t / 2, { zScale: zs, plan: false }),
      cyl('top', [0, h - t - apron / 2, 0], R * 0.7, apron, { scale: sz, segments: 48, plan: false }),
      // Turned column.
      lathe(
        'base',
        [0, 0, 0],
        [
          [0, 0],
          [0.11, 0],
          [0.11, 0.03],
          [0.07, 0.06],
          [0.055, hc * 0.22],
          [0.085, hc * 0.36],
          [0.05, hc * 0.6],
          [0.055, hc * 0.84],
          [0.085, hc * 0.92],
          [0.085, hc],
          [0, hc],
        ],
        { segments: 32, plan: false },
      ),
    ];
    // Four swept feet with toe pads.
    const L = Math.min(w, d) * 0.3;
    for (const k of range(4)) {
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      parts.push(box('base', [c * (L / 2 + 0.04), 0.05, s * (L / 2 + 0.04)], [L, 0.07, 0.07], { rotation: [0, -a, 0], bevel: 0.015, ...o }));
      parts.push(cyl('base', [c * (L + 0.02), 0.01, s * (L + 0.02)], 0.035, 0.02, o));
    }
    return parts;
  },
  planDetail: ({ w, d }) => [poly(ellipsePoints(0, 0, w / 2 - 0.035, d / 2 - 0.035, 40))],
});

const tableTrestle = defineAsset({
  id: 'dining-table-trestle',
  name: 'Farmhouse trestle table',
  category: 'dining',
  type: 'surfaces',
  group: 'Dining tables',
  tags: ['table', 'dining table', 'farmhouse', 'trestle', 'rustic', 'planked'],
  defaultSize: { w: 2.0, d: 0.95, h: 0.76 },
  minSize: { w: 1.4, d: 0.8, h: 0.72 },
  maxSize: { w: 3.0, d: 1.1, h: 0.78 },
  slots: [
    matSlot('top', 'Top', 'wood-pine'),
    matSlot('base', 'Base', 'wood-painted-white'),
    matSlot('runner', 'Table runner', 'fabric-linen'),
  ],
  build: ({ w, d, h }) => {
    const t = 0.04;
    const be = 0.07;
    const nP = clamp(Math.round(d / 0.16), 3, 8);
    const tx = w / 2 - clamp(w * 0.16, 0.25, 0.45);
    const yu = h - t;
    const rw = Math.min(0.34, d * 0.4);
    const o = { plan: false };
    const parts: Part[] = [
      ...slats('top', [-w / 2 + be, w / 2 - be], [h - t, h], [-d / 2, d / 2], nP, { axis: 'z', gap: 0.012, bevel: 0.004 }),
      span('top', [-w / 2, -w / 2 + be], [h - t, h], [-d / 2, d / 2], { bevel: 0.005 }),
      span('top', [w / 2 - be, w / 2], [h - t, h], [-d / 2, d / 2], { bevel: 0.005 }),
      span('runner', [-w * 0.36, w * 0.36], [h, h + 0.003], [-rw / 2, rw / 2], o),
      span('base', [-tx, tx], [yu - 0.09, yu], [d / 2 - 0.13, d / 2 - 0.11], o),
      span('base', [-tx, tx], [yu - 0.09, yu], [-d / 2 + 0.11, -d / 2 + 0.13], o),
      span('base', [-tx, tx], [0.24, 0.32], [-0.035, 0.035], { bevel: 0.004, plan: false }),
    ];
    for (const s of [-1, 1]) {
      const x = s * tx;
      parts.push(span('base', [x - 0.045, x + 0.045], [0.012, 0.085], [-d / 2 + 0.06, d / 2 - 0.06], { bevel: 0.012, plan: false }));
      for (const fz of [-1, 1]) {
        const z = fz * (d / 2 - 0.11);
        parts.push(span('base', [x - 0.045, x + 0.045], [0, 0.012], [z - 0.05, z + 0.05], o));
        parts.push(rod('base', [x, yu - 0.26, fz * 0.06], [x, yu - 0.07, fz * (d / 2 - 0.18)], 0.018, o));
      }
      parts.push(span('base', [x - 0.05, x + 0.05], [0.085, yu - 0.07], [-0.065, 0.065], { bevel: 0.006, plan: false }));
      parts.push(span('base', [x - 0.045, x + 0.045], [yu - 0.07, yu], [-d / 2 + 0.08, d / 2 - 0.08], { bevel: 0.008, plan: false }));
      // Through tenon with a wedge peg.
      const xt: V2 = s < 0 ? [x - 0.11, x - 0.05] : [x + 0.05, x + 0.11];
      parts.push(span('base', xt, [0.25, 0.31], [-0.025, 0.025], { bevel: 0.003, plan: false }));
      const xp = s * (tx + 0.08);
      parts.push(span('base', [xp - 0.008, xp + 0.008], [0.23, 0.335], [-0.012, 0.012], o));
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const be = 0.07;
    const nP = clamp(Math.round(d / 0.16), 3, 8);
    const rw = Math.min(0.34, d * 0.4);
    return [
      line([-w / 2 + be, -d / 2], [-w / 2 + be, d / 2]),
      line([w / 2 - be, -d / 2], [w / 2 - be, d / 2]),
      ...plankSeams(-w / 2 + be, w / 2 - be, d, nP),
      rectPoly(-w * 0.36, -rw / 2, w * 0.36, rw / 2),
    ];
  },
});

const tablePedestal = defineAsset({
  id: 'dining-table-pedestal',
  name: 'Tulip pedestal table',
  category: 'dining',
  type: 'surfaces',
  group: 'Dining tables',
  tags: ['table', 'dining table', 'tulip', 'pedestal', 'round', 'oval', 'marble', 'mid-century'],
  defaultSize: { w: 1.2, d: 1.2, h: 0.75 },
  minSize: { w: 0.8, d: 0.8, h: 0.72 },
  maxSize: { w: 2.0, d: 1.2, h: 0.78 },
  slots: [matSlot('top', 'Top', 'stone-marble-carrara'), matSlot('base', 'Base', 'metal-white-powder')],
  build: ({ w, d, h }) => {
    const zs = d / w;
    const sz: V3 = [1, 1, zs];
    const R = w / 2;
    const t = 0.03;
    const yt = h - t;
    const rb = w * 0.27;
    return [
      lathe(
        'top',
        [0, yt, 0],
        [
          [0, 0],
          [R - 0.015, 0],
          [R, 0.012],
          [R, t - 0.006],
          [R - 0.008, t],
          [0, t],
        ],
        { scale: sz, segments: 64 },
      ),
      // One-piece tulip base: flared foot, slim stem, cupped top.
      lathe(
        'base',
        [0, 0, 0],
        [
          [0, 0],
          [rb, 0],
          [rb, 0.01],
          [rb * 0.92, 0.025],
          [rb * 0.6, 0.07],
          [rb * 0.3, 0.16],
          [0.06, 0.3],
          [0.05, yt * 0.6],
          [0.065, yt - 0.1],
          [0.13, yt - 0.03],
          [0.17, yt],
          [0, yt],
        ],
        { scale: sz, segments: 48, plan: false },
      ),
      ring('base', [0, 0.004, 0], rb - 0.004, 0.004, { zScale: zs, plan: false }),
    ];
  },
  planDetail: ({ w, d }) => [poly(ellipsePoints(0, 0, w * 0.27, d * 0.27, 32))],
});

const barTable = defineAsset({
  id: 'bar-table',
  name: 'Bar / high table',
  category: 'dining',
  type: 'surfaces',
  group: 'Dining tables',
  tags: ['bar table', 'high table', 'counter', 'poseur', 'trestle'],
  defaultSize: { w: 1.2, d: 0.6, h: 1.05 },
  minSize: { w: 0.6, d: 0.4, h: 0.9 },
  maxSize: { w: 2.4, d: 0.9, h: 1.15 },
  slots: [matSlot('top', 'Top', 'wood-walnut'), matSlot('frame', 'Frame', 'metal-black-matte')],
  build: ({ w, d, h }) => {
    const t = 0.035;
    const tx = w / 2 - Math.min(0.12, w * 0.15);
    const nP = clamp(Math.round(d / 0.15), 3, 6);
    const o = { plan: false };
    const parts: Part[] = [
      ...slats('top', [-w / 2, w / 2], [h - t, h], [-d / 2, d / 2], nP, { axis: 'z', gap: 0.015, bevel: 0.004 }),
    ];
    for (const x of [-tx, tx]) {
      parts.push(span('frame', [x - 0.03, x + 0.03], [0.03, h - t], [-0.03, 0.03], o));
      parts.push(span('frame', [x - 0.03, x + 0.03], [0.008, 0.03], [-d / 2 + 0.04, d / 2 - 0.04], { bevel: 0.004, plan: false }));
      parts.push(span('frame', [x - 0.03, x + 0.03], [h - t - 0.03, h - t], [-d / 2 + 0.06, d / 2 - 0.06], o));
      for (const fz of [-1, 1]) {
        parts.push(cyl('frame', [x, 0.004, fz * (d / 2 - 0.06)], 0.022, 0.008, o));
        parts.push(rod('frame', [x, h - t - 0.2, fz * 0.03], [x, h - t - 0.03, fz * (d / 2 - 0.1)], 0.01, o));
      }
    }
    parts.push(rodX('frame', -tx, tx, 0.3, 0, 0.013, o));
    parts.push(rodX('frame', -tx, tx, h - t - 0.015, 0, 0.012, o));
    return parts;
  },
  planDetail: ({ w, d }) => plankSeams(-w / 2, w / 2, d, clamp(Math.round(d / 0.15), 3, 6)),
});

// ---------------------------------------------------------------------------
// Chairs & stools
// ---------------------------------------------------------------------------

const chair = defineAsset({
  id: 'dining-chair',
  name: 'Dining chair',
  category: 'dining',
  type: 'seating',
  group: 'Dining chairs',
  tags: ['chair', 'seat', 'dining chair', 'kitchen chair', 'seating'],
  defaultSize: { w: 0.46, d: 0.52, h: 0.82 },
  minSize: { w: 0.38, d: 0.42, h: 0.7 },
  maxSize: { w: 0.6, d: 0.65, h: 1.1 },
  slots: [matSlot('frame', 'Frame', 'wood-oak-light'), matSlot('seat', 'Seat pad', 'fabric-linen')],
  build: ({ w, d, h }) => {
    const seatTop = clamp(h * 0.56, 0.4, 0.48);
    const seatT = 0.05;
    const ys = seatTop - seatT;
    const lt = 0.035;
    const inset = 0.012;
    const lx = w / 2 - inset - lt / 2;
    const zf = d / 2 - inset - lt / 2;
    const zr = -d / 2 + inset + lt / 2;
    const rake = 0.02;
    const zp = (y: number) => zr + 0.004 - (rake * y) / h;
    const o = { plan: false };
    const parts: Part[] = [];
    for (const x of [-lx, lx]) {
      parts.push(turnedLeg('frame', x, zf, 0, ys, lt * 0.55, { style: 'taper' }));
      parts.push(rod('frame', [x, 0, zp(0)], [x, h - 0.012, zp(h)], lt / 2, o));
      parts.push(sphere('frame', [x, h - 0.012, zp(h)], lt / 2, o));
      parts.push(rodZ('frame', x, 0.16, zr, zf, 0.009, o));
      parts.push(span('frame', [x - 0.01, x + 0.01], [ys - 0.07, ys], [zr + lt / 2, zf - lt / 2], o));
    }
    parts.push(span('frame', [-lx + lt / 2, lx - lt / 2], [ys - 0.07, ys], [zf - 0.01, zf + 0.01], o));
    parts.push(span('frame', [-lx + lt / 2, lx - lt / 2], [ys - 0.07, ys], [zr - 0.01, zr + 0.01], o));
    parts.push(rodX('frame', -lx, lx, 0.22, zf, 0.009, o));
    // Upholstered seat pad with piping.
    parts.push(cushion('seat', [-w / 2 + 0.005, w / 2 - 0.005], [ys, seatTop], [zr + lt / 2, d / 2], { softness: 0.3 }));
    parts.push(rodX('seat', -w / 2 + 0.03, w / 2 - 0.03, ys + 0.012, d / 2 - 0.006, 0.005, o));
    // Back: crest rail, lower rail and vertical splats.
    const crest: V2 = [h - 0.13, h - 0.03];
    parts.push(
      span('frame', [-lx, lx], crest, [zp(h - 0.08) - 0.0125, zp(h - 0.08) + 0.0125], { bevel: 0.006, plan: false }),
    );
    let yLow = seatTop + 0.03;
    if (crest[0] > seatTop + 0.2) {
      parts.push(span('frame', [-lx, lx], [seatTop + 0.1, seatTop + 0.13], [zp(seatTop) - 0.01, zp(seatTop) + 0.01], o));
      yLow = seatTop + 0.13;
    }
    const ns = w > 0.5 ? 4 : 3;
    for (const x of cells(ns, -lx + lt / 2, lx - lt / 2)) {
      const zm = zp((yLow + crest[0]) / 2);
      parts.push(span('frame', [x - 0.012, x + 0.012], [yLow, crest[0]], [zm - 0.007, zm + 0.007], { bevel: 0.003, plan: false }));
    }
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w / 2 + 0.03, -d / 2 + 0.03], [w / 2 - 0.03, -d / 2 + 0.03])],
});

const chairWindsor = defineAsset({
  id: 'dining-chair-windsor',
  name: 'Windsor chair',
  category: 'dining',
  type: 'seating',
  group: 'Dining chairs',
  tags: ['windsor', 'chair', 'dining chair', 'spindle', 'farmhouse', 'wood'],
  defaultSize: { w: 0.5, d: 0.5, h: 0.95 },
  minSize: { w: 0.44, d: 0.44, h: 0.85 },
  maxSize: { w: 0.6, d: 0.6, h: 1.05 },
  slots: [matSlot('frame', 'Wood', 'wood-cherry'), matSlot('pad', 'Seat pad', 'fabric-sky')],
  build: ({ w, d, h }) => {
    const seatY = 0.44;
    const st = 0.04;
    const z0 = -d / 2 + 0.03;
    const z1 = d / 2 - 0.01;
    const o = { plan: false };
    const parts: Part[] = [
      prism('frame', roundRectPoints(0, (z0 + z1) / 2, w - 0.02, z1 - z0, Math.min(0.12, (w - 0.02) / 2)), seatY - st, st),
      rodX('frame', -w / 2 + 0.08, w / 2 - 0.08, seatY - 0.012, z1 - 0.012, 0.012, o),
      cushion('pad', [-w / 2 + 0.06, w / 2 - 0.06], [seatY, seatY + 0.03], [z0 + 0.07, z1 - 0.03], { softness: 0.45, plan: false }),
    ];
    // Splayed turned legs with an H-stretcher.
    const legs: Record<string, [V3, V3]> = {};
    for (const fx of [-1, 1]) {
      for (const fz of [-1, 1]) {
        const top: V3 = [fx * (w / 2 - 0.09), seatY - st, fz > 0 ? d / 2 - 0.1 : -d / 2 + 0.12];
        const bot: V3 = [fx * (w / 2 - 0.035), 0, fz > 0 ? d / 2 - 0.04 : -d / 2 + 0.04];
        legs[`${fx}${fz}`] = [bot, top];
        parts.push(rod('frame', bot, top, 0.015, { rTop: 0.02, plan: false }));
        parts.push(sphere('frame', along(bot, top, 0.62), 0.022, { scale: [1, 0.7, 1], plan: false }));
      }
    }
    const mids: V3[] = [];
    for (const fx of [-1, 1]) {
      const [fb, ft] = legs[`${fx}1`];
      const [bb, bt] = legs[`${fx}-1`];
      const a = along(fb, ft, 0.35);
      const b = along(bb, bt, 0.35);
      parts.push(rod('frame', a, b, 0.01, o));
      mids.push(along(a, b, 0.5));
    }
    parts.push(rod('frame', mids[0], mids[1], 0.01, o));
    // Bow back with spindles.
    const bx = w / 2 - 0.07;
    const zs = -d / 2 + 0.08;
    const zt = -d / 2 + 0.025;
    const H = h - 0.016 - seatY;
    parts.push(
      ...rodPath(
        'frame',
        range(11).map((k) => {
          const th = (Math.PI * k) / 10;
          return [-bx * Math.cos(th), seatY + H * Math.sin(th), zs + (zt - zs) * Math.sin(th)] as V3;
        }),
        0.014,
      ),
    );
    const n = clamp(Math.round((2 * bx) / 0.055), 5, 9);
    for (const x of cells(n, -bx * 0.92, bx * 0.92)) {
      const s = Math.sqrt(1 - (x / bx) ** 2);
      parts.push(rod('frame', [x, seatY, zs + 0.004], [x, seatY + H * s - 0.01, zs + (zt - zs) * s], 0.0065, o));
    }
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w / 2 + 0.07, -d / 2 + 0.08], [w / 2 - 0.07, -d / 2 + 0.08])],
});

const chairUpholstered = defineAsset({
  id: 'dining-chair-upholstered',
  name: 'Upholstered dining chair',
  category: 'dining',
  type: 'seating',
  group: 'Dining chairs',
  tags: ['chair', 'dining chair', 'upholstered', 'parsons', 'tufted', 'nailhead'],
  defaultSize: { w: 0.5, d: 0.58, h: 0.95 },
  minSize: { w: 0.44, d: 0.5, h: 0.85 },
  maxSize: { w: 0.6, d: 0.68, h: 1.1 },
  slots: [
    matSlot('upholstery', 'Upholstery', 'fabric-cream'),
    matSlot('legs', 'Legs', 'wood-walnut'),
    matSlot('studs', 'Nailheads', 'metal-brass'),
  ],
  build: ({ w, d, h }) => {
    const seatTop = clamp(h * 0.5, 0.45, 0.5);
    const seatB = seatTop - 0.1;
    const backT = 0.07;
    const lean = 0.12;
    const o = { plan: false };
    const parts: Part[] = [
      cushion('upholstery', [-w / 2 + 0.005, w / 2 - 0.005], [seatB, seatTop], [-d / 2 + 0.06, d / 2 - 0.005], { softness: 0.22 }),
      rodX('upholstery', -w / 2 + 0.03, w / 2 - 0.03, seatTop - 0.014, d / 2 - 0.014, 0.006, o),
    ];
    for (const x of cells(clamp(Math.round((w - 0.06) / 0.028), 8, 20), -w / 2 + 0.03, w / 2 - 0.03)) {
      parts.push(sphere('studs', [x, seatB + 0.016, d / 2 - 0.004], 0.006, { scale: [1, 1, 0.6], plan: false }));
    }
    // Raked, diamond-tufted back.
    const by: V2 = [seatTop - 0.03, h - 0.006];
    const yc = (by[0] + by[1]) / 2;
    const zc = -d / 2 + 0.075;
    parts.push(box('upholstery', [0, yc, zc], [w - 0.02, by[1] - by[0], backT], { rotation: [-lean, 0, 0], bevel: 0.025 }));
    const faceZ = (y: number) => zc + backT / 2 / Math.cos(lean) - (y - yc) * Math.tan(lean);
    const x0 = -w / 2 + 0.06;
    const x1 = w / 2 - 0.06;
    const cw = (x1 - x0) / 3;
    for (const [j, y] of cells(3, seatTop + 0.12, h - 0.08).entries()) {
      const xr: V2 = j % 2 === 0 ? [x0, x1] : [x0 + cw / 2, x1 - cw / 2];
      parts.push(...tufts('upholstery', xr, [y, y], faceZ(y) - 0.003, j % 2 === 0 ? 3 : 2, 1, { r: 0.01 }));
    }
    for (const s of [-1, 1]) {
      parts.push(turnedLeg('legs', s * (w / 2 - 0.04), d / 2 - 0.045, 0, seatB, 0.022, { style: 'taper' }));
      parts.push(rod('legs', [s * (w / 2 - 0.04), 0, -d / 2 + 0.025], [s * (w / 2 - 0.04), seatB, -d / 2 + 0.08], 0.014, { rTop: 0.02, plan: false }));
    }
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w / 2 + 0.01, -d / 2 + 0.11], [w / 2 - 0.01, -d / 2 + 0.11])],
});

const chairBentwood = defineAsset({
  id: 'dining-chair-bentwood',
  name: 'Bentwood café chair',
  category: 'dining',
  type: 'seating',
  group: 'Dining chairs',
  tags: ['bentwood', 'cafe chair', 'bistro chair', 'thonet', 'cane', 'dining chair'],
  defaultSize: { w: 0.43, d: 0.52, h: 0.88 },
  minSize: { w: 0.4, d: 0.48, h: 0.82 },
  maxSize: { w: 0.5, d: 0.58, h: 0.95 },
  slots: [matSlot('frame', 'Bentwood', 'wood-dark-stain'), matSlot('seat', 'Cane seat', 'rattan-natural')],
  build: ({ w, d, h }) => {
    const rs = Math.min(w / 2 - 0.01, d * 0.42);
    const zc = d / 2 - rs - 0.01;
    const seatY = 0.45;
    const r = 0.012;
    const o = { plan: false };
    const parts: Part[] = [
      cyl('seat', [0, seatY - 0.01, zc], rs - 0.01, 0.018, { segments: 40 }),
      ring('frame', [0, seatY - 0.012, zc], rs - 0.012, 0.012, o),
      ring('frame', [0, seatY - 0.05, zc], rs - 0.04, 0.011, o),
    ];
    const xa = Math.min(0.17, w / 2 - 0.04);
    const xi = xa * 0.55;
    const zBackTop = -d / 2 + 0.025;
    const ring20: V3[] = [];
    for (const s of [-1, 1]) {
      // Front leg.
      const fb: V3 = [s * (w / 2 - 0.03), 0, Math.min(d / 2 - 0.03, zc + rs * 0.85)];
      const ft: V3 = [s * rs * 0.6, seatY - 0.05, zc + rs * 0.6];
      parts.push(rod('frame', fb, ft, r, { rTop: 0.016, plan: false }));
      // Back leg sweeping up into the outer back loop.
      const bb: V3 = [s * (w / 2 - 0.05), 0, -d / 2 + 0.03];
      const bs: V3 = [s * rs * 0.62, seatY - 0.05, zc - rs * 0.75];
      const yTopPost = h - 0.012 - xa;
      parts.push(
        ...rodPath(
          'frame',
          [bb, bs, [s * rs * 0.62, seatY + 0.05, zc - rs * 0.82], [s * xa, seatY + 0.2, -d / 2 + 0.05], [s * xa, yTopPost, zBackTop]],
          r,
        ),
      );
      // Inner loop posts.
      parts.push(...rodPath('frame', [[s * xi, seatY, zc - rs * 0.85], [s * xi, seatY + 0.2, -d / 2 + 0.05], [s * xi, h - 0.16 - xi, zBackTop + 0.01]], 0.009));
      ring20.push(along(fb, ft, 0.2 / (seatY - 0.05)), along(bb, bs, 0.2 / (seatY - 0.05)));
    }
    // Arcs closing the two back loops.
    const arc = (rad: number, cy: number, z: number, rr: number) =>
      rodPath(
        'frame',
        range(9).map((k) => {
          const th = (Math.PI * k) / 8;
          return [rad * Math.cos(th), cy + rad * Math.sin(th), z] as V3;
        }),
        rr,
      );
    parts.push(...arc(xa, h - 0.012 - xa, zBackTop, r));
    parts.push(...arc(xi, h - 0.16 - xi, zBackTop + 0.01, 0.009));
    // Leg ring joining all four legs.
    const [lf, lb, rf, rb] = ring20;
    parts.push(...rodPath('frame', [lf, rf, rb, lb, lf], 0.008));
    return parts;
  },
  planDetail: ({ w, d }) => {
    const rs = Math.min(w / 2 - 0.01, d * 0.42);
    return [poly(ellipsePoints(0, d / 2 - rs - 0.01, rs - 0.03, rs - 0.03, 24))];
  },
});

const chairShell = defineAsset({
  id: 'dining-chair-shell',
  name: 'Moulded shell chair',
  category: 'dining',
  type: 'seating',
  group: 'Dining chairs',
  tags: ['shell chair', 'moulded chair', 'eiffel', 'dowel legs', 'mid-century', 'dining chair'],
  defaultSize: { w: 0.47, d: 0.55, h: 0.81 },
  minSize: { w: 0.44, d: 0.5, h: 0.78 },
  maxSize: { w: 0.52, d: 0.6, h: 0.86 },
  slots: [
    matSlot('shell', 'Shell', 'plastic-white'),
    matSlot('legs', 'Dowel legs', 'wood-oak-light'),
    matSlot('wire', 'Wire base', 'metal-black-matte'),
  ],
  build: ({ w, d, h }) => {
    const seatY = 0.44;
    const zb = -d / 2 + 0.06;
    const o = { plan: false };
    const parts: Part[] = [
      span('shell', [-w / 2 + 0.02, w / 2 - 0.02], [seatY - 0.012, seatY], [zb, d / 2 - 0.015], { bevel: 0.005 }),
      rodX('shell', -w / 2 + 0.04, w / 2 - 0.04, seatY - 0.012, d / 2 - 0.02, 0.014, o),
      rodX('shell', -w / 2 + 0.06, w / 2 - 0.06, seatY, zb, 0.02, o),
    ];
    for (const s of [-1, 1]) parts.push(rodZ('shell', s * (w / 2 - 0.03), seatY + 0.004, zb + 0.03, d / 2 - 0.04, 0.014, o));
    // Curved back from yawed panels.
    const bh = h - 0.01 - seatY;
    const yc = seatY + bh / 2;
    const k = 5;
    const amax = 0.75;
    const Rb = (w / 2 - 0.03) / Math.sin(amax);
    const segW = (Rb * 2 * amax) / k + 0.012;
    for (const a of cells(k, -amax, amax)) {
      parts.push(
        box('shell', [Rb * Math.sin(a), yc, -d / 2 + 0.04 + Rb * (1 - Math.cos(a))], [segW, bh, 0.012], {
          rotation: [-0.2, -a, 0],
          bevel: 0.005,
          plan: false,
        }),
      );
    }
    // Dowel legs with an Eiffel-style wire cradle.
    const zm = 0.02;
    const leg = (fx: number, fz: number): [V3, V3] => [
      [fx * (w / 2 - 0.03), 0, fz * (d / 2 - 0.04)],
      [fx * 0.13, seatY - 0.04, zm + fz * 0.14],
    ];
    const L = { lf: leg(-1, 1), rf: leg(1, 1), lb: leg(-1, -1), rb: leg(1, -1) };
    for (const [bot, top] of Object.values(L)) {
      parts.push(rod('legs', bot, top, 0.014, { rTop: 0.017, plan: false }));
      parts.push(cyl('wire', [bot[0], 0.004, bot[2]], 0.016, 0.008, o));
    }
    parts.push(span('wire', [-0.14, 0.14], [seatY - 0.045, seatY - 0.012], [zm - 0.14, zm + 0.14], o));
    const brace = (a: [V3, V3], b: [V3, V3]) => {
      parts.push(rod('wire', along(a[0], a[1], 0.3), along(b[0], b[1], 0.9), 0.004, o));
      parts.push(rod('wire', along(b[0], b[1], 0.3), along(a[0], a[1], 0.9), 0.004, o));
    };
    brace(L.lf, L.lb);
    brace(L.rf, L.rb);
    brace(L.lf, L.rf);
    brace(L.lb, L.rb);
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w / 2 + 0.03, -d / 2 + 0.06], [w / 2 - 0.03, -d / 2 + 0.06])],
});

const barStool = defineAsset({
  id: 'bar-stool',
  name: 'Bar stool',
  category: 'dining',
  type: 'seating',
  group: 'Stools & benches',
  tags: ['stool', 'bar stool', 'counter stool', 'seating', 'high chair'],
  defaultSize: { w: 0.42, d: 0.42, h: 0.76 },
  minSize: { w: 0.32, d: 0.32, h: 0.55 },
  maxSize: { w: 0.55, d: 0.55, h: 0.9 },
  slots: [matSlot('seat', 'Seat', 'wood-oak-light'), matSlot('frame', 'Frame', 'metal-black-matte')],
  build: ({ w, d, h }) => {
    const R = w / 2;
    const sz = d / w;
    const seatT = 0.04;
    const yTop = h - seatT;
    const rb = R - 0.02;
    const rt = R * 0.62;
    const o = { plan: false };
    const parts: Part[] = [
      lathe(
        'seat',
        [0, yTop, 0],
        [
          [0, 0],
          [R * 0.9, 0],
          [R, seatT * 0.5],
          [R * 0.98, seatT],
          [R * 0.7, seatT * 0.78],
          [0, seatT * 0.7],
        ],
        { scale: [1, 1, sz], segments: 40 },
      ),
      cyl('frame', [0, yTop - 0.006, 0], rt + 0.02, 0.012, { scale: [1, 1, sz], segments: 32, plan: false }),
    ];
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      const c = Math.cos(a);
      const s = Math.sin(a) * sz;
      parts.push(rod('frame', [rb * c, 0, rb * s], [rt * c, yTop, rt * s], 0.012, o));
      parts.push(cyl('frame', [rb * c, 0.006, rb * s], 0.016, 0.012, o));
    }
    for (const yr of [h * 0.33, h * 0.62]) {
      const rho = rb + (rt - rb) * (yr / yTop);
      parts.push(ring('frame', [0, yr, 0], rho, yr < h * 0.5 ? 0.011 : 0.007, { zScale: sz, plan: false }));
    }
    return parts;
  },
  planDetail: ({ w, d }) => [poly(ellipsePoints(0, 0, w * 0.35, d * 0.35, 24))],
});

const counterStool = defineAsset({
  id: 'counter-stool-backed',
  name: 'Counter stool with back',
  category: 'dining',
  type: 'seating',
  group: 'Stools & benches',
  tags: ['counter stool', 'bar stool', 'backrest', 'kitchen island', 'stool', 'seating'],
  defaultSize: { w: 0.45, d: 0.48, h: 0.92 },
  minSize: { w: 0.4, d: 0.42, h: 0.82 },
  maxSize: { w: 0.52, d: 0.55, h: 1.08 },
  slots: [matSlot('seat', 'Seat & back', 'leather-tan'), matSlot('frame', 'Frame', 'metal-black-matte')],
  build: ({ w, d, h }) => {
    const seatTop = clamp(h * 0.7, 0.6, 0.78);
    const seatB = seatTop - 0.06;
    const r = 0.012;
    const o = { plan: false };
    const parts: Part[] = [
      span('frame', [-w / 2 + 0.05, w / 2 - 0.05], [seatB - 0.02, seatB], [-d / 2 + 0.05, d / 2 - 0.05], o),
      cushion('seat', [-w / 2 + 0.01, w / 2 - 0.01], [seatB, seatTop], [-d / 2 + 0.03, d / 2 - 0.005], { softness: 0.35 }),
      rodX('seat', -w / 2 + 0.04, w / 2 - 0.04, (seatB + seatTop) / 2, d / 2 - 0.008, 0.004, o),
    ];
    const at: Record<string, [V3, V3]> = {};
    for (const fx of [-1, 1]) {
      for (const fz of [-1, 1]) {
        const bot: V3 = [fx * (w / 2 - 0.02 - r), 0, fz * (d / 2 - 0.02 - r)];
        const top: V3 = [fx * (w / 2 - 0.06), seatB - 0.02, fz * (d / 2 - 0.06)];
        at[`${fx}${fz}`] = [bot, top];
        parts.push(rod('frame', bot, top, r, o));
        parts.push(cyl('frame', [bot[0], 0.006, bot[2]], 0.016, 0.012, o));
      }
    }
    // Footrest ring and lower stretchers.
    const loop = (y: number, rr: number) => {
      const p = (k: string) => {
        const [b, t] = at[k];
        return along(b, t, y / (seatB - 0.02));
      };
      parts.push(...rodPath('frame', [p('-11'), p('11'), p('1-1'), p('-1-1'), p('-11')], rr));
    };
    loop(0.28, 0.011);
    loop(0.12, 0.007);
    // Back posts and a curved padded backrest.
    for (const s of [-1, 1]) {
      parts.push(rod('frame', [s * (w / 2 - 0.06), seatB - 0.02, -d / 2 + 0.06], [s * (w / 2 - 0.07), h - 0.06, -d / 2 + 0.025], 0.011, o));
    }
    const Rb = 0.42 * w;
    for (const a of [-0.35, 0, 0.35]) {
      parts.push(
        box('seat', [Rb * Math.sin(a), h - 0.08, -d / 2 + 0.03 + Rb * (1 - Math.cos(a))], [Rb * 0.35 + 0.012, 0.14, 0.035], {
          rotation: [0, -a, 0],
          bevel: 0.012,
          plan: false,
        }),
      );
    }
    return parts;
  },
  planDetail: ({ w, d }) => [rectPoly(-w / 2 + 0.03, -d / 2 + 0.05, w / 2 - 0.03, d / 2 - 0.02)],
});

const bench = defineAsset({
  id: 'bench',
  name: 'Dining bench',
  category: 'dining',
  type: 'seating',
  group: 'Stools & benches',
  tags: ['bench', 'seat', 'seating', 'dining bench', 'hallway'],
  defaultSize: { w: 1.4, d: 0.38, h: 0.46 },
  minSize: { w: 0.6, d: 0.28, h: 0.35 },
  maxSize: { w: 2.4, d: 0.5, h: 0.55 },
  slots: [matSlot('wood', 'Wood', 'wood-oak-light')],
  build: ({ w, d, h }) => {
    const t = 0.04;
    const lx = w / 2 - Math.min(0.1, w * 0.12);
    const n = clamp(Math.round(d / 0.12), 2, 4);
    const yc = h - t - 0.03;
    const o = { plan: false };
    const parts: Part[] = [
      ...slats('wood', [-w / 2, w / 2], [h - t, h], [-d / 2, d / 2], n, { axis: 'z', gap: 0.04, bevel: 0.004 }),
      span('wood', [-lx + 0.022, lx - 0.022], [0.12, 0.16], [-0.02, 0.02], o),
    ];
    for (const s of [-1, 1]) {
      const x = s * lx;
      parts.push(span('wood', [x - 0.03, x + 0.03], [yc, h - t], [-d / 2 + 0.02, d / 2 - 0.02], o));
      for (const z of [-d / 2 + 0.05, d / 2 - 0.05]) {
        parts.push(span('wood', [x - 0.022, x + 0.022], [0, yc], [z - 0.022, z + 0.022], { bevel: 0.003, plan: false }));
      }
      parts.push(span('wood', [x - 0.015, x + 0.015], [0.1, 0.17], [-d / 2 + 0.05, d / 2 - 0.05], o));
      // Through tenon of the long stretcher, with a wedge.
      const xt: V2 = s < 0 ? [x - 0.045, x - 0.015] : [x + 0.015, x + 0.045];
      parts.push(span('wood', xt, [0.125, 0.155], [-0.016, 0.016], o));
      parts.push(span('wood', [s * (lx + 0.03) - 0.005, s * (lx + 0.03) + 0.005], [0.11, 0.17], [-0.008, 0.008], o));
    }
    return parts;
  },
  planDetail: ({ w, d }) => plankSeams(-w / 2, w / 2, d, clamp(Math.round(d / 0.12), 2, 4)),
});

const banquette = defineAsset({
  id: 'banquette-corner',
  name: 'Corner banquette',
  category: 'dining',
  type: 'seating',
  group: 'Stools & benches',
  tags: ['banquette', 'corner bench', 'breakfast nook', 'built-in seating', 'booth', 'l-shape'],
  defaultSize: { w: 1.8, d: 1.4, h: 0.9 },
  minSize: { w: 1.2, d: 1.0, h: 0.8 },
  maxSize: { w: 3.0, d: 2.4, h: 1.05 },
  wallSnap: true,
  slots: [
    matSlot('upholstery', 'Cushions', 'fabric-navy'),
    matSlot('base', 'Base & panelling', 'wood-painted-white'),
    matSlot('pillows', 'Throw pillows', 'fabric-blush'),
  ],
  build: ({ w, d, h }) => {
    const sd = clamp(Math.min(w, d) * 0.32, 0.45, 0.55);
    const seatB = 0.4;
    const seatTop = 0.47;
    const wp = 0.04;
    const bc = 0.12;
    const lean = 0.12;
    const capH = 0.03;
    const zB = -d / 2;
    const xL = -w / 2;
    const o = { plan: false };
    const parts: Part[] = [
      span('base', [xL, w / 2], [0.08, seatB], [zB, zB + sd]),
      span('base', [xL, xL + sd], [0.08, seatB], [zB + sd, d / 2]),
      span('base', [xL, w / 2 - 0.04], [0, 0.08], [zB, zB + sd - 0.04], o),
      span('base', [xL, xL + sd - 0.04], [0, 0.08], [zB + sd - 0.04, d / 2 - 0.04], o),
      span('base', [xL, w / 2], [seatB, h - capH], [zB, zB + wp], o),
      span('base', [xL, xL + wp], [seatB, h - capH], [zB + wp, d / 2], o),
      span('base', [xL, w / 2], [h - capH, h], [zB, zB + wp + 0.02], { bevel: 0.004, plan: false }),
      span('base', [xL, xL + wp + 0.02], [h - capH, h], [zB + wp + 0.02, d / 2], { bevel: 0.004, plan: false }),
    ];
    // Raised panels on the base fronts.
    for (const [xa, xb] of cellSpans(clamp(Math.round((w - sd) / 0.55), 1, 6), xL + sd, w / 2)) {
      parts.push(span('base', [xa + 0.05, xb - 0.05], [0.13, seatB - 0.05], [zB + sd, zB + sd + 0.008], o));
    }
    for (const [za, zb] of cellSpans(clamp(Math.round((d - sd) / 0.55), 1, 5), zB + sd, d / 2)) {
      parts.push(span('base', [xL + sd, xL + sd + 0.008], [0.13, seatB - 0.05], [za + 0.05, zb - 0.05], o));
    }
    // Seat cushions (the back run owns the corner square).
    const nB = clamp(Math.round((w - wp) / 0.6), 1, 6);
    for (const [xa, xb] of cellSpans(nB, xL + wp, w / 2)) {
      parts.push(cushion('upholstery', [xa + 0.004, xb - 0.004], [seatB, seatTop], [zB + wp, zB + sd], { softness: 0.3, plan: false }));
    }
    const nL = clamp(Math.round((d - sd) / 0.6), 1, 5);
    for (const [za, zb] of cellSpans(nL, zB + sd, d / 2)) {
      parts.push(cushion('upholstery', [xL + wp, xL + sd], [seatB, seatTop], [za + 0.004, zb - 0.004], { softness: 0.3, plan: false }));
    }
    // Back cushions leaning against both walls.
    const by: V2 = [seatTop - 0.01, h - capH - 0.04];
    const yc = (by[0] + by[1]) / 2;
    const bhh = by[1] - by[0];
    for (const [xa, xb] of cellSpans(clamp(Math.round((w - wp - bc) / 0.55), 1, 6), xL + wp + bc, w / 2)) {
      parts.push(
        box('upholstery', [(xa + xb) / 2, yc, zB + wp + bc / 2], [xb - xa - 0.008, bhh, bc], {
          rotation: [-lean, 0, 0],
          bevel: bc * 0.35,
          plan: false,
        }),
      );
    }
    for (const [za, zb] of cellSpans(clamp(Math.round((d - wp) / 0.55), 1, 5), zB + wp, d / 2)) {
      parts.push(
        box('upholstery', [xL + wp + bc / 2, yc, (za + zb) / 2], [bc, bhh, zb - za - 0.008], {
          rotation: [0, 0, lean],
          bevel: bc * 0.35,
          plan: false,
        }),
      );
    }
    // Throw pillows: two in the corner, one at each end.
    const ps = clamp(by[1] - seatTop, 0.24, 0.38);
    const py = seatTop + ps * 0.45;
    parts.push(pillow('pillows', [xL + wp + bc + 0.2, py, zB + wp + bc + 0.1], ps, ps * 0.95, 0.14, { lean: 0.3, turn: 0.6 }));
    parts.push(pillow('pillows', [w / 2 - 0.25, py, zB + wp + bc + 0.07], ps * 0.95, ps * 0.9, 0.14, { lean: 0.3, turn: -0.2 }));
    parts.push(
      sphere('pillows', [xL + wp + bc + 0.07, py, d / 2 - 0.25], 0.5, { scale: [0.14, ps * 0.9, ps * 0.95], rotation: [0, 0, 0.3], plan: false }),
    );
    return parts;
  },
  planDetail: ({ w, d }) => {
    const sd = clamp(Math.min(w, d) * 0.32, 0.45, 0.55);
    const wp = 0.04;
    const bc = 0.12;
    const xL = -w / 2;
    const zB = -d / 2;
    const nB = clamp(Math.round((w - wp) / 0.6), 1, 6);
    const nL = clamp(Math.round((d - sd) / 0.6), 1, 5);
    return [
      line([xL + wp + bc, zB + wp + bc], [w / 2, zB + wp + bc]),
      line([xL + wp + bc, zB + wp + bc], [xL + wp + bc, d / 2]),
      ...cellSpans(nB, xL + wp, w / 2)
        .slice(1)
        .map(([x]) => line([x, zB + wp + bc], [x, zB + sd])),
      ...cellSpans(nL, zB + sd, d / 2).map(([z]) => line([xL + wp + bc, z], [xL + sd, z])),
    ];
  },
});

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

const chinaCabinet = defineAsset({
  id: 'china-cabinet',
  name: 'China cabinet',
  category: 'dining',
  type: 'storage',
  group: 'Sideboards & cabinets',
  tags: ['china cabinet', 'hutch', 'dresser', 'display cabinet', 'glass doors', 'crockery'],
  defaultSize: { w: 1.1, d: 0.45, h: 2.0 },
  minSize: { w: 0.7, d: 0.38, h: 1.6 },
  maxSize: { w: 1.8, d: 0.55, h: 2.3 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Cabinet', 'wood-painted-white'),
    matSlot('glass', 'Glass', 'glass-clear'),
    matSlot('china', 'China', 'ceramic-white'),
    matSlot('handles', 'Handles', 'metal-brass'),
  ],
  build: ({ w, d, h }) => {
    const lowH = 0.86;
    const pt = 0.02;
    const ft = 0.02;
    const du = Math.max(0.25, d * 0.7);
    const zf = d / 2;
    const zu = -d / 2 + du;
    const crownH = 0.08;
    const o = { plan: false };
    const parts: Part[] = [
      span('body', [-w / 2 + 0.02, w / 2 - 0.02], [0, 0.08], [-d / 2, zf - 0.03], o),
      span('body', [-w / 2, w / 2], [0.08, lowH - 0.03], [-d / 2, zf - ft]),
      span('body', [-w / 2, w / 2], [lowH - 0.03, lowH], [-d / 2, zf], { bevel: 0.004 }),
    ];
    // Lower cabinet: a row of drawers over panelled doors.
    const nC = w > 1.3 ? 3 : 2;
    const yd: V2 = [lowH - 0.03 - 0.16, lowH - 0.035];
    const yDoor: V2 = [0.09, yd[0] - 0.005];
    for (const [i, [xa, xb]] of cellSpans(nC, -w / 2 + 0.02, w / 2 - 0.02).entries()) {
      const xc = (xa + xb) / 2;
      parts.push(span('body', [xa + 0.003, xb - 0.003], yd, [zf - ft, zf], o));
      parts.push(...barPull('handles', [xc, (yd[0] + yd[1]) / 2, zf], Math.min(0.1, (xb - xa) * 0.4), { stand: 0.012, r: 0.005 }));
      parts.push(...shakerFront('body', [xa, xb], yDoor, zf - ft, ft, { rail: 0.055 }));
      const kx = i < nC / 2 ? xb - 0.035 : xa + 0.035;
      parts.push(...knob('handles', [nC === 3 && i === 1 ? xc : kx, yDoor[1] - 0.08, zf], 0.008));
    }
    // Upper hutch.
    const yTopIn = h - crownH - pt;
    parts.push(span('body', [-w / 2 + 0.02, -w / 2 + 0.02 + pt], [lowH, h - crownH], [-d / 2, zu], o));
    parts.push(span('body', [w / 2 - 0.02 - pt, w / 2 - 0.02], [lowH, h - crownH], [-d / 2, zu], o));
    parts.push(span('body', [-w / 2 + 0.02 + pt, w / 2 - 0.02 - pt], [lowH, h - crownH], [-d / 2, -d / 2 + 0.01], o));
    parts.push(span('body', [-w / 2 + 0.02, w / 2 - 0.02], [yTopIn, h - crownH], [-d / 2, zu], o));
    parts.push(span('body', [-w / 2, w / 2], [h - crownH, h - crownH + 0.03], [-d / 2, zu + 0.03], { bevel: 0.004, plan: false }));
    parts.push(span('body', [-w / 2 + 0.01, w / 2 - 0.01], [h - crownH + 0.03, h], [-d / 2, zu + 0.02], { bevel: 0.006, plan: false }));
    // Shelves of plates and cups.
    const H = yTopIn - lowH;
    const xin: V2 = [-w / 2 + 0.04 + pt, w / 2 - 0.04 - pt];
    const nPl = clamp(Math.floor((w - 0.2) / 0.2), 2, 5);
    for (const k of range(3)) {
      const y0 = lowH + (k * H) / 3 + (k > 0 ? 0.009 : 0);
      if (k > 0) parts.push(span('body', xin, [y0 - 0.018, y0], [-d / 2 + 0.01, zu - 0.03], o));
      const pr = Math.min(0.11, (H / 3 - 0.05) / 2);
      const xs = cells(nPl, xin[0], xin[1]);
      for (const x of xs) {
        parts.push(cyl('china', [x, y0 + pr + 0.004, -d / 2 + 0.035], pr, 0.012, { rotation: [Math.PI / 2 - 0.15, 0, 0], segments: 28, plan: false }));
      }
      for (const x of xs.slice(1).map((x, i) => (x + xs[i]) / 2)) {
        parts.push(
          lathe('china', [x, y0, -d / 2 + 0.035 + Math.min(0.1, du * 0.4)], [[0, 0], [0.025, 0], [0.04, Math.min(0.07, pr)], [0.036, Math.min(0.07, pr)], [0, 0.01]], {
            segments: 20,
            plan: false,
          }),
        );
      }
    }
    // Glazed doors with divided lights.
    const nD = w > 1.2 ? 3 : 2;
    const yg: V2 = [lowH + 0.01, h - crownH - 0.005];
    for (const [i, [xa, xb]] of cellSpans(nD, -w / 2 + 0.02, w / 2 - 0.02).entries()) {
      const x: V2 = [xa + 0.003, xb - 0.003];
      const xm = (x[0] + x[1]) / 2;
      parts.push(...frame4('body', x, yg, [zu, zu + 0.022], 0.045));
      parts.push(span('glass', [x[0] + 0.04, x[1] - 0.04], [yg[0] + 0.04, yg[1] - 0.04], [zu + 0.008, zu + 0.012], o));
      parts.push(span('body', [xm - 0.008, xm + 0.008], [yg[0] + 0.045, yg[1] - 0.045], [zu + 0.012, zu + 0.018], o));
      for (const f of [1 / 3, 2 / 3]) {
        const y = lerp(yg[0], yg[1], f);
        parts.push(span('body', [x[0] + 0.045, x[1] - 0.045], [y - 0.008, y + 0.008], [zu + 0.012, zu + 0.018], o));
      }
      const kx = i < nD / 2 ? x[1] - 0.025 : x[0] + 0.025;
      parts.push(...knob('handles', [nD === 3 && i === 1 ? x[0] + 0.025 : kx, lowH + 0.3, zu + 0.022], 0.008));
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const zu = -d / 2 + Math.max(0.25, d * 0.7);
    return [line([-w / 2 + 0.02, zu], [w / 2 - 0.02, zu])];
  },
});

const barCart = defineAsset({
  id: 'bar-cart',
  name: 'Bar cart',
  category: 'dining',
  type: 'storage',
  group: 'Sideboards & cabinets',
  tags: ['bar cart', 'drinks trolley', 'serving cart', 'trolley', 'brass', 'cocktail'],
  defaultSize: { w: 0.8, d: 0.45, h: 0.85 },
  minSize: { w: 0.6, d: 0.38, h: 0.75 },
  maxSize: { w: 1.1, d: 0.55, h: 0.95 },
  slots: [
    matSlot('frame', 'Frame', 'metal-brass'),
    matSlot('shelves', 'Trays', 'glass-mirror'),
    matSlot('bottles', 'Bottles & glasses', 'glass-tinted'),
    matSlot('wheels', 'Wheels', 'rubber-black'),
  ],
  build: ({ w, d, h }) => {
    const pr = 0.011;
    const wr = 0.07;
    const yLow = 0.22;
    const yTop = clamp(h - 0.14, 0.55, 0.78);
    const xL = -w / 2 + 0.05;
    const xR = w / 2 - 0.05;
    const zP = d / 2 - 0.04;
    const o = { plan: false };
    const parts: Part[] = [];
    for (const z of [-zP, zP]) {
      parts.push(vcyl('frame', xL, z, wr, yTop + 0.03, pr, o));
      parts.push(vcyl('frame', xR, z, 0.05, h - 0.012, pr, o));
      // Big wheel at the left end, swivel caster at the right.
      const zw = Math.sign(z) * (d / 2 - 0.012);
      parts.push(torus('wheels', [xL, wr, zw], wr - 0.012, 0.012, o));
      parts.push(discZ('frame', [xL, wr, zw], wr - 0.016, 0.01, { segments: 24, plan: false }));
      parts.push(discZ('frame', [xL, wr, zw], 0.02, 0.022, o));
      parts.push(cyl('frame', [xR, 0.045, z], 0.014, 0.012, o));
      parts.push(cyl('wheels', [xR, 0.025, z], 0.025, 0.018, { rotation: [0, 0, Math.PI / 2], plan: false }));
    }
    parts.push(rodZ('frame', xL, wr, -d / 2 + 0.02, d / 2 - 0.02, 0.006, o));
    parts.push(rodZ('frame', xR, h - 0.012, -zP, zP, 0.011, o));
    // Two mirrored trays with galleries.
    for (const y of [yLow, yTop]) {
      parts.push(span('shelves', [xL, xR], [y, y + 0.008], [-zP, zP], { plan: y === yTop }));
      for (const z of [-zP, zP]) parts.push(rodX('frame', xL, xR, y + 0.035, z, 0.005, o));
      for (const x of [xL, xR]) parts.push(rodZ('frame', x, y + 0.035, -zP, zP, 0.005, o));
      parts.push(rodX('frame', xL, xR, y + 0.004, zP, 0.006, o));
      parts.push(rodX('frame', xL, xR, y + 0.004, -zP, 0.006, o));
    }
    // Bottles on the lower tray.
    const rand = rng(5);
    const room = yTop - (yLow + 0.008) - 0.03;
    const n = clamp(Math.floor((xR - xL - 0.1) / 0.1), 2, 8);
    for (const [i, x] of cells(n, xL + 0.05, xR - 0.05).entries()) {
      const bh = Math.min(room, lerp(0.22, 0.32, rand()));
      const br = lerp(0.03, 0.038, rand());
      const z = (i % 2 === 1 ? 0.06 : -0.04) * Math.min(1, d / 0.45);
      const y0 = yLow + 0.008;
      const square = i % 3 === 2;
      const prof: V2[] = square
        ? [[0, 0], [br * 1.2, 0], [br * 1.2, bh * 0.7], [br * 0.5, bh * 0.78], [br * 0.4, bh * 0.92], [0, bh * 0.92]]
        : [[0, 0], [br, 0], [br, bh * 0.6], [br * 0.4, bh * 0.75], [br * 0.33, bh * 0.94], [0, bh * 0.94]];
      parts.push(lathe('bottles', [x, y0, z], prof, { segments: square ? 4 : 20, plan: false }));
      parts.push(vcyl('frame', x, z, y0 + bh * (square ? 0.9 : 0.92), y0 + bh, square ? br * 0.55 : br * 0.36, o));
    }
    // Glasses, an ice bucket and a shaker on top.
    const y1 = yTop + 0.008;
    const top = h - y1 - 0.01;
    for (const x of [xR - 0.06, xR - 0.13, xR - 0.2]) {
      parts.push(lathe('bottles', [x, y1, 0.04], [[0, 0], [0.03, 0], [0.034, 0.09], [0.031, 0.09], [0.027, 0.008], [0, 0.008]], { segments: 18, plan: false }));
    }
    parts.push(lathe('frame', [xL + 0.1, y1, -0.03], [[0, 0], [0.055, 0], [0.07, Math.min(0.13, top)], [0.066, Math.min(0.13, top)], [0, Math.min(0.1, top)]], { segments: 24, plan: false }));
    parts.push(
      lathe('frame', [xL + 0.2, y1, 0.05], [[0, 0], [0.035, 0], [0.04, Math.min(0.12, top) * 0.7], [0.022, Math.min(0.12, top) * 0.9], [0.012, Math.min(0.12, top)], [0, Math.min(0.12, top)]], {
        segments: 20,
        plan: false,
      }),
    );
    return parts;
  },
  planDetail: ({ w, d }) => [rectPoly(-w / 2 + 0.05, -d / 2 + 0.04, w / 2 - 0.05, d / 2 - 0.04)],
});

export const DINING_ASSETS: AssetDefinition[] = [
  tableRect,
  tableRound,
  tableTrestle,
  tablePedestal,
  barTable,
  chair,
  chairWindsor,
  chairUpholstered,
  chairBentwood,
  chairShell,
  barStool,
  counterStool,
  bench,
  banquette,
  chinaCabinet,
  barCart,
];

/**
 * Sage shaker kitchen: an L kitchen in the colours of a reference photo (2026-11-04), sampled and
 * white-balanced against its white walls: sage green shaker base units with tan leather tab pulls, a
 * white terrazzo worktop and end pier, cream shaker wall cabinets with small brass knobs, a reeded-glass
 * wall cabinet, a slim black hood, a pale mint vertical stack-tile splashback and an oak floating shelf
 * with an LED strip, plus the styling on it (chopping boards, a copper pot, a bud vase with mandarins).
 * The ready-made group "Sage shaker L kitchen with oak bar" (src/data/groups/readyGroups.ts) puts it
 * together with the oak waterfall bar and white bentwood chairs from the library.
 */
import { box, clamp, cyl, defineItem, definePack, knob, lathe, matSlot, range, rod, shakerFront, span, sphere, torus, type Part, type V2, type V3 } from '@/packs/kit';

const PLINTH = 0.1;
const TOP_T = 0.03;
const FRONT_T = 0.02;
/** Base fronts sit this far behind the worktop edge (the leather tabs stand in front of them). */
const TAB_ROOM = 0.012;
/** Wall cabinet fronts sit this far back, so the knobs stay within the cabinet's depth. */
const KNOB_ROOM = 0.03;
/** Height of the sink unit's tap above the worktop (the unit's box includes it). */
const TAP_H = 0.52;
const o = { plan: false };

const FRONT = matSlot('front', 'Fronts & carcass', 'sage-lacquer');
const WORKTOP = matSlot('worktop', 'Worktop', 'terrazzo-white');
const TAB = matSlot('pull', 'Leather tab pulls', 'leather-tab');
const UPPER = matSlot('front', 'Fronts & carcass', 'cream-lacquer');
const KNOB = matSlot('knob', 'Knobs', 'metal-brass');

/** A tan leather tab pull hanging from a screw at `c` (on a front whose face is at c[2]), `len` long. */
function leatherTab(slot: string, c: V3, len = 0.075): Part[] {
  const [x, y, z] = c;
  const t = 0.005;
  return [
    // The strap: folded over, so it stands a little proud at the bottom.
    span(slot, [x - 0.012, x + 0.012], [y - len, y], [z, z + t], { ...o, bevel: 0.002 }),
    span(slot, [x - 0.012, x + 0.012], [y - len, y - len + 0.012], [z + t, z + t + 0.006], { ...o, bevel: 0.003 }),
    // Screw head.
    cyl('pull', [x, y - 0.012, z + t + 0.001], 0.004, 0.003, { ...o, rotation: [Math.PI / 2, 0, 0] }),
  ];
}

/** Base carcass, recessed plinth and terrazzo worktop (1 cm front overhang). */
function baseBody(w: number, d: number, h: number): Part[] {
  const zf = d / 2 - TAB_ROOM - FRONT_T;
  return [
    span('front', [-w / 2, w / 2], [PLINTH, h - TOP_T], [-d / 2, zf]),
    span('front', [-w / 2 + 0.004, w / 2 - 0.004], [0, PLINTH], [-d / 2, zf - 0.05]),
    span('worktop', [-w / 2, w / 2], [h - TOP_T, h], [-d / 2, d / 2], { bevel: 0.003 }),
  ];
}

/** Shaker doors across [x0, x1] (one, or two meeting in the middle) with leather tabs near the top of the opening edge. */
function baseDoors(x0: number, x1: number, d: number, h: number, single: 'left' | 'right' | null = null): Part[] {
  const face = d / 2 - TAB_ROOM;
  const zf = face - FRONT_T;
  const y: V2 = [PLINTH + 0.004, h - TOP_T - 0.004];
  const ty = y[1] - 0.05;
  const out: Part[] = [];
  const two = !single && x1 - x0 > 0.5;
  if (two) {
    const m = (x0 + x1) / 2;
    out.push(...shakerFront('front', [x0, m], y, zf, FRONT_T, { rail: 0.065 }), ...shakerFront('front', [m, x1], y, zf, FRONT_T, { rail: 0.065 }));
    out.push(...leatherTab('pull', [m - 0.035, ty, face]), ...leatherTab('pull', [m + 0.035, ty, face]));
  } else {
    out.push(...shakerFront('front', [x0, x1], y, zf, FRONT_T, { rail: 0.065 }));
    const tx = single === 'left' ? x0 + 0.035 : x1 - 0.035;
    out.push(...leatherTab('pull', [tx, ty, face]));
  }
  return out;
}

const BASE_SIZE = { min: { w: 0.3, d: 0.5, h: 0.8 }, max: { w: 1.2, d: 0.7, h: 0.95 } };
const TAGS = ['sage', 'shaker', 'green kitchen', 'leather pull', 'terrazzo', 'tủ bếp xanh', 'tủ bếp tân cổ điển'];

const baseDoorUnit = defineItem({
  id: 'base-door-unit',
  name: 'Sage shaker base cupboard with leather tabs',
  category: 'kitchen',
  type: 'surfaces',
  group: 'Counters & cabinets',
  tags: ['base cabinet', 'cupboard', ...TAGS],
  description:
    'A sage green shaker base cupboard with one door (narrow) or a pair (from 50 cm), tan leather tab pulls near the top, a recessed plinth and a white terrazzo worktop.',
  defaultSize: { w: 0.8, d: 0.6, h: 0.9 },
  minSize: BASE_SIZE.min,
  maxSize: BASE_SIZE.max,
  wallSnap: true,
  price: { vnd: 6_500_000, estimate: true },
  slots: [FRONT, WORKTOP, TAB],
  build: ({ w, d, h }) => [...baseBody(w, d, h), ...baseDoors(-w / 2, w / 2, d, h)],
});

const blindCorner = defineItem({
  id: 'blind-corner-unit',
  name: 'Sage shaker blind corner base unit',
  category: 'kitchen',
  type: 'surfaces',
  group: 'Counters & cabinets',
  tags: ['corner cabinet', 'blind corner', ...TAGS],
  description:
    'The corner of an L kitchen: a sage base carcass under the terrazzo worktop with a shaker blind panel on its front, for the other run to butt against.',
  defaultSize: { w: 0.6, d: 0.6, h: 0.9 },
  minSize: { w: 0.5, d: 0.5, h: 0.8 },
  maxSize: { w: 1.1, d: 0.7, h: 0.95 },
  wallSnap: true,
  price: { vnd: 4_200_000, estimate: true },
  slots: [FRONT, WORKTOP],
  build: ({ w, d, h }) => [...baseBody(w, d, h), ...shakerFront('front', [-w / 2, w / 2], [PLINTH + 0.004, h - TOP_T - 0.004], d / 2 - TAB_ROOM - FRONT_T, FRONT_T, { rail: 0.065 })],
});

/** A stainless inset double sink in the worktop (top at h) over the cut-out x0..x1, z0..z1. */
function doubleSink(x0: number, x1: number, z0: number, z1: number, h: number): Part[] {
  const rim = 0.025;
  const depth = 0.19;
  const mid = (x0 + x1) / 2;
  const out: Part[] = [
    // Rim round both bowls and the bridge between them.
    span('sink', [x0, x1], [h, h + 0.004], [z0, z0 + rim], o),
    span('sink', [x0, x1], [h, h + 0.004], [z1 - rim, z1], o),
    span('sink', [x0, x0 + rim], [h, h + 0.004], [z0, z1], o),
    span('sink', [x1 - rim, x1], [h, h + 0.004], [z0, z1], o),
    span('sink', [mid - 0.02, mid + 0.02], [h - 0.02, h + 0.004], [z0, z1], o),
  ];
  for (const [a, b] of [
    [x0 + rim, mid - 0.02],
    [mid + 0.02, x1 - rim],
  ] as V2[]) {
    const zb: V2 = [z0 + rim, z1 - rim];
    out.push(
      span('sink', [a, b], [h - depth, h - depth + 0.004], zb, o),
      span('sink', [a, a + 0.003], [h - depth, h], zb, o),
      span('sink', [b - 0.003, b], [h - depth, h], zb, o),
      span('sink', [a, b], [h - depth, h], [zb[0], zb[0] + 0.003], o),
      span('sink', [a, b], [h - depth, h], [zb[1] - 0.003, zb[1]], o),
      cyl('sink', [(a + b) / 2, h - depth + 0.006, (zb[0] + zb[1]) / 2], 0.035, 0.004, o),
    );
  }
  return out;
}

/** A chrome pull-down spring tap standing at (x, z) on the worktop (top at y0). */
function springTap(x: number, z: number, y0: number): Part[] {
  const top = y0 + 0.46;
  const reach = 0.2;
  const out: Part[] = [
    cyl('sink', [x, y0 + 0.012, z], 0.028, 0.024, o),
    rod('sink', [x, y0 + 0.02, z], [x, y0 + 0.1, z], 0.016, o),
    // Lever on the side.
    rod('sink', [x + 0.012, y0 + 0.085, z], [x + 0.06, y0 + 0.11, z], 0.005, o),
    // Upright with the coil spring round it.
    rod('sink', [x, y0 + 0.1, z], [x, top, z], 0.007, o),
  ];
  for (const i of range(16)) out.push(torus('sink', [x, y0 + 0.14 + i * 0.016, z], 0.016, 0.0028, { ...o, rotation: [Math.PI / 2, 0, 0] }));
  // Arc over to the spray head, which hangs down over the sink.
  const arc: V3[] = range(9).map((i) => {
    const a = (i / 8) * Math.PI;
    return [x, top + Math.sin(a) * 0.05, z + (1 - Math.cos(a)) * (reach / 2)];
  });
  for (let i = 0; i < arc.length - 1; i++) out.push(rod('sink', arc[i], arc[i + 1], 0.007, o));
  const end = arc[arc.length - 1];
  out.push(rod('sink', end, [end[0], end[1] - 0.14, end[2]], 0.011, o), cyl('sink', [end[0], end[1] - 0.15, end[2]], 0.017, 0.03, o));
  return out;
}

const sinkUnit = defineItem({
  id: 'sink-unit',
  name: 'Sage shaker double sink unit with spring tap',
  category: 'kitchen',
  type: 'plumbing',
  group: 'Sinks',
  tags: ['sink', 'double sink', 'pull-down tap', 'spring tap', 'chậu rửa đôi', ...TAGS],
  description:
    'A sage shaker sink base with two doors and leather tabs, an inset double-bowl stainless sink in the white terrazzo worktop and a chrome pull-down tap with a coil spring.',
  // Height includes the tap (52 cm over a 90 cm worktop).
  defaultSize: { w: 1.0, d: 0.6, h: 0.9 + TAP_H },
  minSize: { w: 0.8, d: 0.55, h: 0.8 + TAP_H },
  maxSize: { w: 1.4, d: 0.7, h: 0.95 + TAP_H },
  wallSnap: true,
  price: { vnd: 13_500_000, estimate: true },
  services: { water: 'hot', drain: 'waste' },
  slots: [FRONT, WORKTOP, TAB, matSlot('sink', 'Sink & tap', 'metal-brushed-steel')],
  build: ({ w, d, h: full }) => {
    const h = full - TAP_H;
    const sw = clamp(w - 0.2, 0.6, 0.86);
    const z0 = -d / 2 + 0.13;
    const z1 = d / 2 - 0.06;
    const x0 = -sw / 2;
    const x1 = sw / 2;
    const zf = d / 2 - TAB_ROOM - FRONT_T;
    // The carcass stops under the bowls; its sides and back carry on up to the worktop.
    const under = h - 0.22;
    return [
      span('front', [-w / 2, w / 2], [PLINTH, under], [-d / 2, zf]),
      span('front', [-w / 2, -w / 2 + 0.018], [under, h - TOP_T], [-d / 2, zf]),
      span('front', [w / 2 - 0.018, w / 2], [under, h - TOP_T], [-d / 2, zf]),
      span('front', [-w / 2 + 0.018, w / 2 - 0.018], [under, h - TOP_T], [-d / 2, -d / 2 + 0.018]),
      span('front', [-w / 2 + 0.004, w / 2 - 0.004], [0, PLINTH], [-d / 2, zf - 0.05]),
      // Worktop round the sink cut-out.
      span('worktop', [-w / 2, w / 2], [h - TOP_T, h], [-d / 2, z0], { bevel: 0.002 }),
      span('worktop', [-w / 2, w / 2], [h - TOP_T, h], [z1, d / 2], { bevel: 0.002 }),
      span('worktop', [-w / 2, x0], [h - TOP_T, h], [z0, z1]),
      span('worktop', [x1, w / 2], [h - TOP_T, h], [z0, z1]),
      ...doubleSink(x0, x1, z0, z1, h),
      ...springTap(0.06, -d / 2 + 0.07, h),
      ...baseDoors(-w / 2, w / 2, d, h),
    ];
  },
});

const hobUnit = defineItem({
  id: 'hob-drawer-unit',
  name: 'Sage shaker hob unit with three drawers',
  category: 'kitchen',
  type: 'appliances',
  group: 'Cooking',
  tags: ['hob', 'induction hob', 'drawers', 'bếp từ', ...TAGS],
  description:
    'A black glass induction hob in the white terrazzo worktop over three sage shaker drawers (a shallow one over two deep pan drawers), each with a centred leather tab.',
  defaultSize: { w: 0.8, d: 0.6, h: 0.9 },
  minSize: { w: 0.6, d: 0.55, h: 0.8 },
  maxSize: { w: 1.0, d: 0.7, h: 0.95 },
  wallSnap: true,
  price: { vnd: 16_000_000, estimate: true },
  services: { power: 'dedicated' },
  slots: [FRONT, WORKTOP, TAB, matSlot('hob', 'Hob glass', 'screen-black')],
  build: ({ w, d, h }) => {
    const zf = d / 2 - TAB_ROOM - FRONT_T;
    const y0 = PLINTH + 0.004;
    const y1 = h - TOP_T - 0.004;
    const shallow = 0.17;
    const rest = (y1 - y0 - shallow) / 2;
    const rows: V2[] = [
      [y1 - shallow, y1],
      [y0 + rest, y1 - shallow],
      [y0, y0 + rest],
    ];
    const hw = Math.min(0.37, w / 2 - 0.03);
    const hz: V2 = [-d / 2 + 0.06, d / 2 - 0.07];
    const out: Part[] = [...baseBody(w, d, h), span('hob', [-hw, hw], [h, h + 0.005], hz, o)];
    // Two round zones and a flex zone, and the touch strip at the front.
    out.push(
      torus('worktop', [-hw / 2, h + 0.0055, (hz[0] + hz[1]) / 2 - 0.02], 0.1, 0.0015, { ...o, rotation: [Math.PI / 2, 0, 0] }),
      torus('worktop', [hw / 2, h + 0.0055, (hz[0] + hz[1]) / 2 + 0.02], 0.085, 0.0015, { ...o, rotation: [Math.PI / 2, 0, 0] }),
      span('worktop', [-0.08, 0.08], [h + 0.005, h + 0.0058], [hz[1] - 0.035, hz[1] - 0.03], o),
    );
    for (const y of rows) {
      out.push(...shakerFront('front', [-w / 2, w / 2], y, zf, FRONT_T, { rail: 0.055 }));
      out.push(...leatherTab('pull', [0, y[1] - 0.035, d / 2 - TAB_ROOM], 0.06));
    }
    return out;
  },
});

const terrazzoPier = defineItem({
  id: 'terrazzo-end-pier',
  name: 'White terrazzo counter end pier',
  category: 'kitchen',
  type: 'surfaces',
  group: 'Counters & cabinets',
  tags: ['terrazzo', 'end panel', 'counter end', 'pier', 'đá terrazzo'],
  description:
    'A solid white terrazzo block that closes a counter run: the worktop carries on over it and down its sides, and a breakfast bar can butt against its face.',
  defaultSize: { w: 0.45, d: 0.6, h: 0.9 },
  minSize: { w: 0.1, d: 0.3, h: 0.7 },
  maxSize: { w: 1.0, d: 0.8, h: 1.1 },
  wallSnap: true,
  price: { vnd: 3_800_000, estimate: true },
  slots: [WORKTOP],
  build: ({ w, d, h }) => [span('worktop', [-w / 2, w / 2], [0, h], [-d / 2, d / 2], { bevel: 0.004 })],
});

/** Cream shaker wall cabinet body and doors with small knobs at the bottom of the opening edges. */
function wallBody(w: number, d: number, h: number): Part[] {
  const zf = d / 2 - KNOB_ROOM - FRONT_T;
  return [span('front', [-w / 2, w / 2], [0, h], [-d / 2, zf])];
}

const wallCabinet = defineItem({
  id: 'wall-cabinet',
  name: 'Cream shaker wall cabinet with brass knobs',
  category: 'kitchen',
  type: 'storage',
  group: 'Kitchen cabinets',
  tags: ['wall cabinet', 'upper cabinet', 'cream', 'shaker', 'tủ bếp trên'],
  description: 'A tall warm-cream shaker wall cabinet, one door when narrow or a pair from 50 cm, with small brass knobs low on the opening edges.',
  defaultSize: { w: 0.8, d: 0.35, h: 0.9 },
  minSize: { w: 0.3, d: 0.3, h: 0.4 },
  maxSize: { w: 1.2, d: 0.4, h: 1.2 },
  mount: 'wall',
  defaultElevation: 1.5,
  price: { vnd: 4_800_000, estimate: true },
  slots: [UPPER, KNOB],
  build: ({ w, d, h }) => {
    const face = d / 2 - KNOB_ROOM;
    const zf = face - FRONT_T;
    const y: V2 = [0.004, h - 0.004];
    const ky = 0.07;
    const out = wallBody(w, d, h);
    if (w > 0.5) {
      out.push(...shakerFront('front', [-w / 2, 0], y, zf, FRONT_T, { rail: 0.06 }), ...shakerFront('front', [0, w / 2], y, zf, FRONT_T, { rail: 0.06 }));
      out.push(...knob('knob', [-0.035, ky, face], 0.011), ...knob('knob', [0.035, ky, face], 0.011));
    } else {
      out.push(...shakerFront('front', [-w / 2, w / 2], y, zf, FRONT_T, { rail: 0.06 }), ...knob('knob', [w / 2 - 0.035, ky, face], 0.011));
    }
    return out;
  },
});

const reededCabinet = defineItem({
  id: 'reeded-glass-wall-cabinet',
  name: 'Cream wall cabinet with reeded glass door',
  category: 'kitchen',
  type: 'storage',
  group: 'Kitchen cabinets',
  tags: ['wall cabinet', 'reeded glass', 'fluted glass', 'glass door', 'cream', 'kính sọc'],
  description:
    'A cream wall cabinet whose framed door holds horizontally reeded glass, showing the shapes of the plates and jars on its shelf, with a small brass knob.',
  defaultSize: { w: 0.6, d: 0.35, h: 0.9 },
  minSize: { w: 0.3, d: 0.3, h: 0.4 },
  maxSize: { w: 1.0, d: 0.4, h: 1.2 },
  mount: 'wall',
  defaultElevation: 1.5,
  price: { vnd: 5_600_000, estimate: true },
  slots: [UPPER, KNOB, matSlot('glass', 'Reeded glass', 'reeded-glass'), matSlot('dishes', 'Plates & jars', 'ceramic-white')],
  build: ({ w, d, h }) => {
    const zb = -d / 2;
    const face = d / 2 - KNOB_ROOM;
    const zf = face - FRONT_T;
    const rail = 0.06;
    const out: Part[] = [
      // Sides, top, bottom, back and a shelf (open box behind the glass).
      span('front', [-w / 2, -w / 2 + 0.018], [0, h], [zb, zf]),
      span('front', [w / 2 - 0.018, w / 2], [0, h], [zb, zf]),
      span('front', [-w / 2, w / 2], [0, 0.018], [zb, zf]),
      span('front', [-w / 2, w / 2], [h - 0.018, h], [zb, zf]),
      span('front', [-w / 2, w / 2], [0, h], [zb, zb + 0.008]),
      span('front', [-w / 2 + 0.018, w / 2 - 0.018], [h / 2 - 0.009, h / 2 + 0.009], [zb + 0.008, zf - 0.01], o),
      // Door frame and the glass in it.
      span('front', [-w / 2, -w / 2 + rail], [0, h], [zf, face], o),
      span('front', [w / 2 - rail, w / 2], [0, h], [zf, face], o),
      span('front', [-w / 2 + rail, w / 2 - rail], [h - rail, h], [zf, face], o),
      span('front', [-w / 2 + rail, w / 2 - rail], [0, rail], [zf, face], o),
      span('glass', [-w / 2 + rail, w / 2 - rail], [rail, h - rail], [zf + 0.006, zf + 0.012], o),
      ...knob('knob', [w / 2 - 0.035, 0.07, face], 0.011),
    ];
    // Plates and jars on both shelves, blurred by the glass.
    const pr = Math.min(0.11, w / 4 - 0.02, h / 4 - 0.04);
    const jh = Math.min(0.14, h / 2 - 0.06);
    for (const y0 of [0.018, h / 2 + 0.009]) {
      out.push(cyl('dishes', [-w / 4, y0 + pr + 0.01, zb + 0.06], pr, 0.012, { ...o, rotation: [Math.PI / 2 - 0.15, 0, 0] }));
      out.push(cyl('dishes', [w / 8, y0 + jh / 2, -0.02], Math.min(0.045, w / 10), jh, o));
    }
    return out;
  },
});

const slimHood = defineItem({
  id: 'slim-black-hood',
  name: 'Slim black under-cabinet hood',
  category: 'kitchen',
  type: 'appliances',
  group: 'Cooking',
  tags: ['hood', 'extractor', 'cooker hood', 'slim hood', 'máy hút mùi âm tủ'],
  description: 'A slim matte black hood fitted under a wall cabinet, with a slanted front visor, a light strip under it and push buttons on the edge.',
  defaultSize: { w: 0.7, d: 0.5, h: 0.12 },
  minSize: { w: 0.5, d: 0.4, h: 0.08 },
  maxSize: { w: 0.9, d: 0.6, h: 0.2 },
  mount: 'wall',
  defaultElevation: 1.38,
  price: { vnd: 4_500_000, estimate: true },
  services: { power: 'plug' },
  slots: [matSlot('body', 'Body', 'metal-black-matte'), matSlot('trim', 'Buttons & grille', 'metal-brushed-steel'), matSlot('glow', 'Light strip', 'hood-light')],
  build: ({ w, d, h }) => {
    // The visor: a lip at the bottom of the front and a plate sloping back up to the body's top.
    const lip = h * 0.35;
    const run = 0.09;
    const slope = Math.atan2(run, h - lip);
    const len = Math.hypot(run, h - lip);
    return [
      span('body', [-w / 2, w / 2], [lip, h], [-d / 2, d / 2 - run]),
      span('body', [-w / 2, w / 2], [0, lip], [d / 2 - 0.1, d / 2]),
      box('body', [0, (lip + h) / 2, d / 2 - run / 2], [w, len, 0.012], { ...o, rotation: [-slope, 0, 0] }),
      span('trim', [-w / 2 + 0.05, w / 2 - 0.05], [h * 0.35 - 0.004, h * 0.35], [-d / 2 + 0.03, d / 2 - 0.12], o),
      span('glow', [-w / 2 + 0.1, w / 2 - 0.1], [h * 0.35 - 0.006, h * 0.35 - 0.002], [d / 2 - 0.16, d / 2 - 0.13], o),
      ...range(3).map((i) => cyl('trim', [w / 2 - 0.16 + i * 0.035, lip * 0.5, d / 2 - 0.003], 0.006, 0.004, { ...o, rotation: [Math.PI / 2, 0, 0] })),
    ];
  },
});

const splashback = defineItem({
  id: 'mint-stack-tile-splashback',
  name: 'Pale mint vertical stack-tile splashback',
  category: 'kitchen',
  type: 'structure',
  group: 'Built-ins',
  tags: ['splashback', 'backsplash', 'tiles', 'stack bond', 'mint', 'gạch ốp bếp'],
  description: 'A run of pale mint glazed tiles laid vertically in a stack bond on the wall between worktop and wall cabinets.',
  defaultSize: { w: 2.4, d: 0.012, h: 0.6 },
  minSize: { w: 0.3, d: 0.008, h: 0.2 },
  maxSize: { w: 6, d: 0.03, h: 2.4 },
  mount: 'wall',
  defaultElevation: 0.9,
  slots: [matSlot('tile', 'Tiles', 'mint-stack-tile')],
  build: ({ w, d, h }) => [span('tile', [-w / 2, w / 2], [0, h], [-d / 2, d / 2])],
});

const oakShelf = defineItem({
  id: 'oak-led-shelf',
  name: 'Oak floating shelf with LED, plant and coffee',
  category: 'kitchen',
  type: 'storage',
  group: 'Kitchen cabinets',
  tags: ['floating shelf', 'oak shelf', 'led shelf', 'kệ gỗ', 'kệ treo tường'],
  description: 'A thick oak floating shelf with a warm LED strip glowing under it, styled with a small potted plant and a bag of coffee.',
  defaultSize: { w: 0.6, d: 0.24, h: 0.32 },
  minSize: { w: 0.3, d: 0.18, h: 0.3 },
  maxSize: { w: 1.6, d: 0.35, h: 0.4 },
  mount: 'wall',
  defaultElevation: 1.45,
  price: { vnd: 1_400_000, estimate: true },
  slots: [
    matSlot('shelf', 'Shelf', 'wood-white-oak'),
    matSlot('glow', 'LED strip', 'shelf-led'),
    matSlot('plant', 'Plant', 'plant-leaf'),
    matSlot('pot', 'Pot & coffee bag', 'kraft-paper'),
  ],
  build: ({ w, d }) => {
    const t = 0.045;
    const out: Part[] = [
      span('shelf', [-w / 2, w / 2], [0.004, 0.004 + t], [-d / 2, d / 2], { bevel: 0.003 }),
      span('glow', [-w / 2 + 0.02, w / 2 - 0.02], [0, 0.004], [d / 2 - 0.05, d / 2 - 0.035], o),
      // Plant: a small pot with a bushy top.
      lathe('pot', [-w / 2 + 0.11, t, 0], [[0, 0], [0.05, 0], [0.06, 0.1], [0, 0.1]], o),
    ];
    for (const [dx, dy, dz, r] of [
      [0, 0.16, 0, 0.07],
      [-0.05, 0.14, 0.02, 0.05],
      [0.05, 0.15, -0.02, 0.05],
      [0.01, 0.21, 0.01, 0.045],
    ])
      out.push(sphere('plant', [-w / 2 + 0.11 + dx, t + dy, dz], r, o));
    // Coffee bag, standing.
    out.push(span('pot', [-w / 2 + 0.22, -w / 2 + 0.31], [t, t + 0.16], [-0.04, 0.02], { ...o, bevel: 0.006 }));
    return out;
  },
});

const boards = defineItem({
  id: 'leaning-boards-utensils',
  name: 'Leaning chopping boards and utensil crock',
  category: 'kitchen',
  type: 'decor',
  group: 'Candles & tabletop',
  tags: ['chopping board', 'cutting board', 'utensils', 'crock', 'thớt'],
  description: 'A round and a paddle wooden chopping board leaning on the splashback, a ceramic crock of wooden spoons and a glass oil bottle, for a worktop corner.',
  defaultSize: { w: 0.5, d: 0.2, h: 0.48 },
  minSize: { w: 0.4, d: 0.15, h: 0.4 },
  maxSize: { w: 0.7, d: 0.3, h: 0.6 },
  slots: [matSlot('wood', 'Boards & spoons', 'wood-white-oak'), matSlot('crock', 'Crock', 'ceramic-white'), matSlot('glass', 'Bottle', 'glass-clear')],
  build: ({ w, d, h }) => {
    const lean: V3 = [-0.18, 0, 0];
    const zb = -d / 2 + 0.03;
    return [
      { ...cyl('wood', [-w / 2 + 0.16, 0.15, zb], 0.15, 0.02, o), rotation: [Math.PI / 2 + lean[0], 0, 0] } as Part,
      span('wood', [-w / 2 + 0.06, -w / 2 + 0.26], [0.02, h - 0.12], [zb + 0.02, zb + 0.035], { ...o, rotation: lean, bevel: 0.008 }),
      cyl('wood', [-w / 2 + 0.16, h - 0.08, zb + 0.04], 0.012, 0.06, { ...o, rotation: lean }),
      lathe('crock', [w / 2 - 0.16, 0, 0.01], [[0, 0], [0.05, 0], [0.052, 0.14], [0, 0.14]]),
      ...range(4).map((i) => rod('wood', [w / 2 - 0.17 + i * 0.008, 0.05, 0.01], [w / 2 - 0.2 + i * 0.025, 0.3, i % 2 ? 0.0 : 0.02], 0.005, o)),
      lathe('glass', [w / 2 - 0.05, 0, 0.02], [[0, 0], [0.03, 0], [0.03, 0.15], [0.012, 0.19], [0.012, 0.23], [0, 0.23]], o),
    ];
  },
});

const copperPot = defineItem({
  id: 'copper-casserole',
  name: 'Copper casserole with lid',
  category: 'kitchen',
  type: 'decor',
  group: 'Candles & tabletop',
  tags: ['copper pot', 'casserole', 'pan', 'nồi đồng'],
  description: 'A polished copper casserole with a domed lid, a brass knob and two side handles, to stand on the hob.',
  defaultSize: { w: 0.32, d: 0.24, h: 0.17 },
  minSize: { w: 0.24, d: 0.18, h: 0.12 },
  maxSize: { w: 0.42, d: 0.32, h: 0.24 },
  price: { vnd: 1_900_000, estimate: true },
  slots: [matSlot('copper', 'Copper', 'metal-copper'), matSlot('knob', 'Knob & handles', 'metal-brass')],
  build: ({ w, d, h }) => {
    const r = Math.min(d / 2, w / 2 - 0.04);
    const hb = h * 0.6;
    return [
      lathe('copper', [0, 0, 0], [[0, 0], [r * 0.92, 0], [r, hb * 0.2], [r, hb], [0, hb]]),
      lathe('copper', [0, hb, 0], [[0, 0], [r * 1.01, 0], [r * 0.8, h * 0.25], [0, h * 0.3]], o),
      sphere('knob', [0, hb + h * 0.33, 0], r * 0.12, o),
      ...[-1, 1].map((s) => torus('knob', [s * (r + 0.015), hb * 0.8, 0], 0.018, 0.005, { ...o, rotation: [0, Math.PI / 2, 0] })),
    ];
  },
});

const budVase = defineItem({
  id: 'bud-vase-mandarins',
  name: 'Glass bud vase with dried grass and mandarins',
  category: 'dining',
  type: 'decor',
  group: 'Candles & tabletop',
  tags: ['vase', 'dried grass', 'mandarins', 'table styling', 'bình hoa', 'quả quýt'],
  description: 'A tall smoked-glass bud vase with a few stems of dried feather grass, three mandarins and a small black candle cup, for a bar or table top.',
  defaultSize: { w: 0.4, d: 0.2, h: 0.55 },
  minSize: { w: 0.3, d: 0.15, h: 0.4 },
  maxSize: { w: 0.6, d: 0.3, h: 0.7 },
  slots: [matSlot('glass', 'Vase', 'smoked-glass'), matSlot('grass', 'Dried grass', 'dried-grass'), matSlot('fruit', 'Mandarins', 'mandarin'), matSlot('cup', 'Candle cup', 'plastic-black')],
  build: ({ w, d, h }) => {
    const vx = 0;
    const out: Part[] = [lathe('glass', [vx, 0, 0], [[0, 0], [0.045, 0], [0.05, 0.05], [0.025, 0.16], [0.016, 0.22], [0, 0.22]])];
    // Stems with feathery plumes, fanning out.
    for (const [ax, az, len] of [
      [-0.12, 0.05, 0.42],
      [0.06, -0.04, 0.46],
      [0.18, 0.02, 0.38],
    ]) {
      const tip: V3 = [vx + ax * len, Math.min(h - 0.04, 0.2 + len * 0.8), az * len];
      out.push(rod('grass', [vx, 0.18, 0], tip, 0.0025, o));
      out.push(sphere('grass', [tip[0], tip[1] - 0.03, tip[2]], 0.02, { ...o, scale: [0.8, 2.4, 0.8] }));
    }
    for (const [dx, dz] of [
      [-w / 2 + 0.05, 0.02],
      [-w / 2 + 0.11, -0.02],
      [-w / 2 + 0.08, d / 2 - 0.035],
    ])
      out.push(sphere('fruit', [dx, 0.028, dz], 0.03, { ...o, scale: [1, 0.85, 1] }));
    out.push(cyl('cup', [w / 2 - 0.06, 0.045, 0.02], 0.035, 0.09, o));
    return out;
  },
});

export default definePack({
  name: 'Sage shaker kitchen',
  version: '1.0.0',
  author: 'Neest team',
  description:
    'An L kitchen in exact colours from a reference: sage shaker base units with leather tab pulls, white terrazzo worktop and end pier, cream shaker and reeded-glass wall cabinets, a slim black hood, a pale mint stack-tile splashback, an oak LED shelf and the styling around them.',
  license: 'CC0 (made for Neest)',
  patterns: [
    {
      // White terrazzo with fine chips: mostly charcoal and grey, a few warm beige ones.
      id: 'fine-terrazzo',
      name: 'Fine white terrazzo',
      normalStrength: 0.15,
      draw(ctx, size, rand) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);
        const n = Math.round((size * size) / 260);
        for (let i = 0; i < n; i++) {
          const x = rand() * size;
          const y = rand() * size;
          const k = rand();
          const r = (k < 0.08 ? 2.4 : k < 0.4 ? 1.5 : 0.9) * (size / 512) * (0.7 + rand() * 0.6);
          const tone = rand();
          ctx.fillStyle = tone < 0.45 ? '#3b3a38' : tone < 0.8 ? '#8f8c86' : '#c9b69b';
          const ry = r * (0.6 + rand() * 0.5);
          const turn = rand() * Math.PI;
          // Drawn again across every tile edge it touches, so the texture repeats seamlessly.
          for (const dx of [-size, 0, size])
            for (const dy of [-size, 0, size]) {
              ctx.beginPath();
              ctx.ellipse(x + dx, y + dy, r, ry, turn, 0, Math.PI * 2);
              ctx.fill();
            }
        }
      },
    },
    {
      // Vertical tiles 1:2 in a stack bond (no offset): 4 × 2 tiles per square, light grout lines.
      id: 'stack-bond',
      name: 'Vertical stack-bond tiles',
      normalStrength: 0.7,
      draw(ctx, size, rand) {
        const cols = 4;
        const rows = 2;
        const tw = size / cols;
        const th = size / rows;
        const g = Math.max(3, Math.round(size / 110));
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);
        for (let r = 0; r < rows; r++)
          for (let c = 0; c < cols; c++) {
            const v = Math.round(214 + rand() * 14);
            ctx.fillStyle = `rgb(${v},${v},${v})`;
            ctx.fillRect(c * tw + g / 2, r * th + g / 2, tw - g, th - g);
            // A soft glaze highlight down one side of each tile.
            ctx.fillStyle = 'rgba(255,255,255,0.18)';
            ctx.fillRect(c * tw + g, r * th + g, tw * 0.18, th - 2 * g);
          }
      },
    },
  ],
  items: [baseDoorUnit, blindCorner, sinkUnit, hobUnit, terrazzoPier, wallCabinet, reededCabinet, slimHood, splashback, oakShelf, boards, copperPot, budVase],
  materials: [
    // Colours sampled from the reference, white-balanced against its white walls, then set so they render
    // as in the photo next to the cream uppers (the 3D view lights fronts about 1.4x brighter).
    { id: 'sage-lacquer', name: 'Sage green shaker lacquer', category: 'paint', color: '#5f6d55', roughness: 0.6 },
    { id: 'cream-lacquer', name: 'Warm cream shaker lacquer', category: 'paint', color: '#f1ece2', roughness: 0.6 },
    { id: 'terrazzo-white', name: 'White terrazzo', category: 'stone', color: '#efece6', roughness: 0.3, pattern: { id: 'fine-terrazzo', scale: 0.3 } },
    { id: 'mint-stack-tile', name: 'Pale mint stack tile', category: 'tile', color: '#d2e6c2', roughness: 0.16, pattern: { id: 'stack-bond', scale: 0.3 } },
    { id: 'bar-oak', name: 'Warm oak veneer', category: 'wood', color: '#b8925f', roughness: 0.55, pattern: { id: 'wood-grain', scale: 0.6 }, photo: { set: 'oak-veneer' } },
    { id: 'leather-tab', name: 'Tan leather', category: 'fabric', color: '#553a26', roughness: 0.6, photo: { set: 'leather', scale: 0.4 } },
    { id: 'reeded-glass', name: 'Reeded glass', category: 'glass', color: '#e8ece6', roughness: 0.12, opacity: 0.5, pattern: { id: 'fluted', scale: 0.08, rotation: 90 } },
    { id: 'smoked-glass', name: 'Smoked glass', category: 'glass', color: '#8a8378', roughness: 0.08, opacity: 0.55 },
    { id: 'dried-grass', name: 'Dried feather grass', category: 'solid', color: '#d9c7a4', roughness: 0.95 },
    { id: 'mandarin', name: 'Mandarin peel', category: 'solid', color: '#e7781f', roughness: 0.55 },
    { id: 'kraft-paper', name: 'Kraft paper', category: 'solid', color: '#a77d52', roughness: 0.9 },
    { id: 'hood-light', name: 'Hood light', category: 'solid', color: '#fff4dc', roughness: 0.5, emissive: '#fff1d6', emissiveIntensity: 1.2 },
    { id: 'shelf-led', name: 'Warm LED strip', category: 'solid', color: '#fff2d8', roughness: 0.5, emissive: '#ffe2b0', emissiveIntensity: 1.6 },
  ],
});

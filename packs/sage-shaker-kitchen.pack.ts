/**
 * Sage shaker kitchen: an L kitchen in the colours of a reference photo (2026-11-04), sampled and
 * white-balanced against its white walls: sage green shaker base units with tan leather tab pulls, a
 * white terrazzo worktop and end pier, cream shaker wall cabinets with small brass knobs, a reeded-glass
 * wall cabinet, a slim black hood, a pale mint vertical stack-tile splashback and an oak floating shelf
 * with an LED strip, plus the styling on it (chopping boards, a copper pot, a bud vase with mandarins).
 * The ready-made group "Sage shaker L kitchen with oak bar" (src/data/groups/readyGroups.ts) puts it
 * together with the oak waterfall bar and white bentwood chairs from the library.
 */
import {
  box,
  clamp,
  cyl,
  defineItem,
  definePack,
  knob,
  lathe,
  matSlot,
  range,
  rod,
  shakerFront,
  span,
  sphere,
  torus,
  type AssetModelVariant,
  type AssetParam,
  type AssetPresetVariant,
  type ParamValues,
  type Part,
  type PlanStroke,
  type Size3,
  type V2,
  type V3,
} from '@/packs/kit';

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

// ---------------------------------------------------------------------------
// Parametric L-shaped Sage & Cream Shaker Kitchen (independent X & Z arm lengths,
// no dining bar/table and no fridge)
// ---------------------------------------------------------------------------

const L_BASE = matSlot('base', 'Base cabinets', 'sage-lacquer');
const L_UPPER = matSlot('upper', 'Upper cabinets', 'cream-lacquer');
const L_WORKTOP = matSlot('worktop', 'Worktop & waterfall end', 'terrazzo-white');
const L_TILE = matSlot('tile', 'Splashback tiles', 'mint-stack-tile');

const L_BASE_FIXTURE_SLOTS = [
  matSlot('pull', 'Leather tab pulls', 'leather-tab'),
  matSlot('appliance', 'Sink & slim hood', 'metal-black-matte'),
  matSlot('hob', 'Induction hob glass', 'screen-black'),
  matSlot('shield', 'Splatter guard glass', 'tempered-glass'),
  matSlot('steel', 'Spring tap & trim', 'metal-brushed-steel'),
  matSlot('brass', 'Knobs & rivets', 'metal-brass'),
];

const L_UPPER_CLEAN_SLOTS = [
  ...L_BASE_FIXTURE_SLOTS,
  matSlot('glass', 'Reeded glass', 'reeded-glass'),
  matSlot('glow', 'Under-cabinet & hood LED', 'shelf-led'),
];

const L_VARIANTS: AssetPresetVariant[] = [
  {
    id: 'warm-cream',
    name: 'All warm cream & subway tile',
    materials: { base: 'cream-lacquer', upper: 'cream-lacquer', worktop: 'terrazzo-white', tile: 'tile-subway-white' },
  },
  {
    id: 'forest-marble',
    name: 'Forest green & Carrara marble',
    materials: { base: 'paint-forest', upper: 'cream-lacquer', worktop: 'stone-marble-carrara', tile: 'tile-subway-white' },
  },
  {
    id: 'dusty-blue',
    name: 'Dusty blue & cream',
    materials: { base: 'paint-dusty-blue', upper: 'cream-lacquer', worktop: 'terrazzo-white', tile: 'tile-white-square' },
  },
  {
    id: 'oak-cream',
    name: 'Warm oak & cream',
    materials: { base: 'bar-oak', upper: 'cream-lacquer', worktop: 'terrazzo-white', tile: 'mint-stack-tile' },
  },
];

type HobPlacement = 'main' | 'return';

/** Clear worktop margin (20 cm) between the outer edge of the induction hob and the open end of the counter. */
const HOB_OUTER_MARGIN = 0.2;

interface LKitchenGeo {
  w: number;
  d: number;
  h: number;
  cd: number;
  yw: number;
  uDrop: number;
  endW: number;
  upperD: number;
  yUpper0: number;
  yUpperTop: number;
  zCorner: number;
  zEnd: number;
  prep: V2 | null;
  sink: V2;
  hob: V2;
  tail: V2 | null;
  mainHobGlass: V2;
  returnOuter: V2 | null;
  returnHob: V2;
  returnInner: V2 | null;
  returnHobGlass: V2;
  holeX: V2;
  holeZ: V2;
}

const numParam = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

function lKitchenGeo({ w, d, h }: Size3, params?: ParamValues): LKitchenGeo {
  const cd = clamp(numParam(params?.counterDepth, 0.6), 0.5, Math.min(0.72, w - 0.48, d - 0.95));
  const yw = clamp(numParam(params?.worktopHeight, 0.89), 0.8, Math.min(0.96, h - 0.95));
  const uDrop = clamp(numParam(params?.upperDrop, 0.56), 0.45, Math.min(0.72, h - yw - 0.5));
  const endPier = params?.endPier === true;
  const endW = endPier ? Math.min(0.36, Math.max(0.18, (d - cd) * 0.2)) : 0.035;
  const upperD = Math.min(0.35, cd - 0.12);

  const yUpper0 = yw + uDrop;
  const yUpperTop = h;

  const zCorner = -d / 2 + cd;
  const zEnd = d / 2 - endW;
  const sideLen = Math.max(0.7, zEnd - zCorner);

  let prep: V2 | null = null;
  let sink: V2;
  let hob: V2;
  const tail: V2 | null = null;

  if (sideLen < 1.7) {
    const zMid = zCorner + sideLen * 0.465;
    sink = [zCorner, zMid];
    hob = [zMid, zEnd];
  } else {
    const hobW = clamp(sideLen * 0.4, 0.76, 0.9);
    const sinkW = clamp((sideLen - hobW) * 0.65, 0.64, 0.96);
    const prepW = sideLen - hobW - sinkW;
    prep = [zCorner, zCorner + prepW];
    sink = [zCorner + prepW, zEnd - hobW];
    hob = [zEnd - hobW, zEnd];
  }

  const hobZ1 = Math.min(d / 2 - HOB_OUTER_MARGIN, zEnd - 0.03);
  const rightPad = hob[1] - hobZ1;
  const hobSpan = hob[1] - hob[0];
  const maxAvailZ = Math.max(0.28, hobZ1 - (hob[0] + 0.03));
  const hobLenZ = clamp(Math.max(hobSpan - 2 * rightPad, 0.42), 0.28, Math.min(0.62, maxAvailZ));
  const mainHobGlass: V2 = [hobZ1 - hobLenZ, hobZ1];

  // Return-arm bays along rx ∈ [-w/2, w/2 - cd] (outer front tip at -w/2, inner L-corner at w/2 - cd).
  const xStart = -w / 2;
  const xBackEnd = w / 2 - cd;
  const hobX0 = xStart + HOB_OUTER_MARGIN;
  const maxHobX = Math.max(0.24, xBackEnd - 0.02 - hobX0);
  const hobLenX = Math.min(0.6, maxHobX);
  const returnHobGlass: V2 = [hobX0, hobX0 + hobLenX];

  const outerCabEnd = xStart + 0.18;
  const idealDrawerEnd = returnHobGlass[1] + 0.02;
  let returnOuter: V2 | null = null;
  let returnHob: V2;
  let returnInner: V2 | null = null;
  if (xBackEnd - idealDrawerEnd >= 0.24) {
    returnOuter = [xStart, outerCabEnd];
    returnHob = [outerCabEnd, idealDrawerEnd];
    returnInner = [idealDrawerEnd, xBackEnd];
  } else if (xBackEnd - outerCabEnd >= 0.28) {
    returnOuter = [xStart, outerCabEnd];
    returnHob = [outerCabEnd, xBackEnd];
  } else {
    returnHob = [xStart, xBackEnd];
  }

  const sinkSpan = sink[1] - sink[0];
  const sinkHoleW = clamp(sinkSpan - 0.14, 0.44, 0.78);
  const sinkCenter = (sink[0] + sink[1]) / 2;
  const holeZ: V2 = [sinkCenter - sinkHoleW / 2, sinkCenter + sinkHoleW / 2];
  const holeX: V2 = [w / 2 - cd + 0.075, w / 2 - 0.125];

  return {
    w,
    d,
    h,
    cd,
    yw,
    uDrop,
    endW,
    upperD,
    yUpper0,
    yUpperTop,
    zCorner,
    zEnd,
    prep,
    sink,
    hob,
    tail,
    mainHobGlass,
    returnOuter,
    returnHob,
    returnInner,
    returnHobGlass,
    holeX,
    holeZ,
  };
}

function lKitchenParams(hand: 'left' | 'right'): AssetParam[] {
  const sgn = hand === 'left' ? 1 : -1;
  return [
    {
      id: 'counterDepth',
      label: 'Counter depth',
      kind: 'length',
      default: 0.6,
      min: 0.5,
      max: 0.72,
      step: 0.01,
      handle: (size, p) => {
        const g = lKitchenGeo({ w: size.d, d: size.w, h: size.h }, p);
        const rxBackMid = (-g.w / 2 + (g.w / 2 - g.cd)) / 2;
        return { at: [sgn * (-g.d / 2 + g.cd + 0.01), g.yw - TOP_T / 2, -rxBackMid], dir: [sgn, 0, 0] };
      },
    },
    {
      id: 'worktopHeight',
      label: 'Worktop height',
      kind: 'length',
      default: 0.89,
      min: 0.8,
      max: 0.96,
      step: 0.01,
      handle: (size, p) => {
        const g = lKitchenGeo({ w: size.d, d: size.w, h: size.h }, p);
        return { at: [sgn * ((g.zCorner + g.zEnd) / 2), g.yw, -size.d / 2 + g.cd + 0.01], dir: [0, 1, 0] };
      },
    },
    {
      id: 'upperDrop',
      label: 'Splashback height',
      kind: 'length',
      default: 0.56,
      min: 0.45,
      max: 0.72,
      step: 0.01,
      handle: (size, p) => {
        const g = lKitchenGeo({ w: size.d, d: size.w, h: size.h }, p);
        return { at: [sgn * ((g.sink[0] + g.sink[1]) / 2), g.yUpper0, -size.d / 2 + g.upperD + 0.01], dir: [0, 1, 0] };
      },
    },
    {
      id: 'endPier',
      label: 'Thick terrazzo end pier',
      kind: 'toggle',
      default: false,
    },
  ];
}

/** Equal door intervals across [a, b] with a 3 mm reveal between doors. */
function splitDoors(a: number, b: number, count: number): V2[] {
  const n = Math.max(1, count);
  const step = (b - a) / n;
  const gap = 0.002;
  return range(n).map((i) => [a + i * step + gap, a + (i + 1) * step - gap] as V2);
}

/** Three stacked horizontal drawer intervals [bottom, middle, top]: a shallow cutlery drawer over two deep pan drawers. */
function drawerRows([y0, y1]: V2): V2[] {
  const gap = 0.006;
  const total = y1 - y0;
  const topH = clamp(total * 0.22, 0.135, 0.175);
  const deepH = (total - topH - 2 * gap) / 2;
  return [
    [y0, y0 + deepH],
    [y0 + deepH + gap, y1 - topH - gap],
    [y1 - topH, y1],
  ];
}

/** Shaker door frames facing +z (front rail face at `zFace`, recessed backing sheet behind). */
function shakerRunZ(slot: string, xRange: V2, yRange: V2, zFace: number, count: number): Part[] {
  const doors = splitDoors(xRange[0], xRange[1], count);
  const out: Part[] = [
    span(slot, [xRange[0] + 0.002, xRange[1] - 0.002], [yRange[0] + 0.002, yRange[1] - 0.002], [zFace - FRONT_T, zFace - 0.006], o),
  ];
  for (const [x0, x1] of doors) {
    const r = clamp(Math.min(x1 - x0, yRange[1] - yRange[0]) * 0.15, 0.036, 0.06);
    out.push(
      span(slot, [x0, x1], [yRange[1] - r, yRange[1]], [zFace - 0.006, zFace], o),
      span(slot, [x0, x1], [yRange[0], yRange[0] + r], [zFace - 0.006, zFace], o),
      span(slot, [x0, x0 + r], [yRange[0] + r, yRange[1] - r], [zFace - 0.006, zFace], o),
      span(slot, [x1 - r, x1], [yRange[0] + r, yRange[1] - r], [zFace - 0.006, zFace], o),
    );
  }
  return out;
}

/** Three stacked horizontal Shaker drawer fronts facing +z (front rail face at `zFace`, full-depth horizontal shadow reveals). */
function shakerDrawersZ(slot: string, xRange: V2, yRange: V2, zFace: number): Part[] {
  const x0 = xRange[0] + 0.002;
  const x1 = xRange[1] - 0.002;
  const out: Part[] = [];
  for (const [ry0, ry1] of drawerRows(yRange)) {
    const r = clamp(Math.min(x1 - x0, ry1 - ry0) * 0.24, 0.032, 0.052);
    out.push(
      span(slot, [x0 + r, x1 - r], [ry0 + r, ry1 - r], [zFace - FRONT_T, zFace - 0.006], o),
      span(slot, [x0, x1], [ry1 - r, ry1], [zFace - FRONT_T, zFace], o),
      span(slot, [x0, x1], [ry0, ry0 + r], [zFace - FRONT_T, zFace], o),
      span(slot, [x0, x0 + r], [ry0 + r, ry1 - r], [zFace - FRONT_T, zFace], o),
      span(slot, [x1 - r, x1], [ry0 + r, ry1 - r], [zFace - FRONT_T, zFace], o),
    );
  }
  return out;
}

/** Shaker door frames facing -x (front rail face at `xFace`, recessed backing sheet behind). */
function shakerFramesOnlyX(slot: string, doors: V2[], yRange: V2, xFace: number): Part[] {
  const out: Part[] = [];
  for (const [z0, z1] of doors) {
    const r = clamp(Math.min(z1 - z0, yRange[1] - yRange[0]) * 0.15, 0.036, 0.06);
    out.push(
      span(slot, [xFace, xFace + 0.006], [yRange[1] - r, yRange[1]], [z0, z1], o),
      span(slot, [xFace, xFace + 0.006], [yRange[0], yRange[0] + r], [z0, z1], o),
      span(slot, [xFace, xFace + 0.006], [yRange[0] + r, yRange[1] - r], [z0, z0 + r], o),
      span(slot, [xFace, xFace + 0.006], [yRange[0] + r, yRange[1] - r], [z1 - r, z1], o),
    );
  }
  return out;
}

/** Three stacked horizontal Shaker drawer fronts facing -x (front rail face at `xFace`, full-depth horizontal shadow reveals). */
function shakerDrawersX(slot: string, zRange: V2, yRange: V2, xFace: number): Part[] {
  const z0 = zRange[0] + 0.002;
  const z1 = zRange[1] - 0.002;
  const out: Part[] = [];
  for (const [ry0, ry1] of drawerRows(yRange)) {
    const r = clamp(Math.min(z1 - z0, ry1 - ry0) * 0.24, 0.032, 0.052);
    out.push(
      span(slot, [xFace + 0.006, xFace + FRONT_T], [ry0 + r, ry1 - r], [z0 + r, z1 - r], o),
      span(slot, [xFace, xFace + FRONT_T], [ry1 - r, ry1], [z0, z1], o),
      span(slot, [xFace, xFace + FRONT_T], [ry0, ry0 + r], [z0, z1], o),
      span(slot, [xFace, xFace + FRONT_T], [ry0 + r, ry1 - r], [z0, z0 + r], o),
      span(slot, [xFace, xFace + FRONT_T], [ry0 + r, ry1 - r], [z1 - r, z1], o),
    );
  }
  return out;
}

/** Leather tab pull on a door facing -x (front face at `xFace`). */
function leatherTabX(xFace: number, yTop: number, z: number, len = 0.072): Part[] {
  const t = 0.005;
  return [
    span('pull', [xFace - 0.0005 - t, xFace - 0.0005], [yTop - len, yTop], [z - 0.012, z + 0.012], { ...o, bevel: 0.002 }),
    sphere('brass', [xFace - 0.0005 - t - 0.0025, yTop - 0.012, z], 0.0035, o),
  ];
}

/** Leather tab pull on a door facing +z (front face at `zFace`). */
function leatherTabZ(x: number, yTop: number, zFace: number, len = 0.072): Part[] {
  const t = 0.005;
  return [
    span('pull', [x - 0.012, x + 0.012], [yTop - len, yTop], [zFace + 0.0005, zFace + 0.0005 + t], { ...o, bevel: 0.002 }),
    sphere('brass', [x, yTop - 0.012, zFace + 0.0005 + t + 0.0025], 0.0035, o),
  ];
}

/** Horizontal leather strap pull centred on a drawer facing -x (front face at `xFace`). */
function drawerPullX(xFace: number, yTop: number, zCenter: number, halfLen = 0.042): Part[] {
  const t = 0.005;
  const yc = yTop - 0.026;
  return [
    span('pull', [xFace - 0.0005 - t, xFace - 0.0005], [yc - 0.01, yc + 0.01], [zCenter - halfLen, zCenter + halfLen], {
      ...o,
      bevel: 0.002,
    }),
    sphere('brass', [xFace - 0.0005 - t - 0.0025, yc, zCenter - halfLen + 0.011], 0.0035, o),
    sphere('brass', [xFace - 0.0005 - t - 0.0025, yc, zCenter + halfLen - 0.011], 0.0035, o),
  ];
}

/** Horizontal leather strap pull centred on a drawer facing +z (front face at `zFace`). */
function drawerPullZ(xCenter: number, yTop: number, zFace: number, halfLen = 0.042): Part[] {
  const t = 0.005;
  const yc = yTop - 0.026;
  return [
    span('pull', [xCenter - halfLen, xCenter + halfLen], [yc - 0.01, yc + 0.01], [zFace + 0.0005, zFace + 0.0005 + t], {
      ...o,
      bevel: 0.002,
    }),
    sphere('brass', [xCenter - halfLen + 0.011, yc, zFace + 0.0005 + t + 0.0025], 0.0035, o),
    sphere('brass', [xCenter + halfLen - 0.011, yc, zFace + 0.0005 + t + 0.0025], 0.0035, o),
  ];
}

/** Small brass round knob on an upper door facing -x (front face at `xFace`). */
const brassKnobX = (xFace: number, y: number, z: number): Part => sphere('brass', [xFace - 0.011, y, z], 0.01, o);

/** Core architectural L-cabinetry, worktop (with sink cut-out) and vertical stack-tile splashback. */
function buildLKitchenShell(size: Size3, params?: ParamValues, hobPlacement: HobPlacement = 'main'): Part[] {
  const g = lKitchenGeo(size, params);
  const {
    w,
    d,
    cd,
    yw,
    yUpper0,
    yUpperTop,
    zCorner,
    zEnd,
    prep,
    sink,
    hob,
    tail,
    returnOuter,
    returnHob,
    returnInner,
    holeX,
    holeZ,
  } = g;
  const parts: Part[] = [];

  const yBaseTop = yw - TOP_T;
  const yFrontRange: V2 = [PLINTH + 0.004, yBaseTop - 0.004];
  const zBackFace = -d / 2 + cd - TAB_ROOM;
  const xSideFace = w / 2 - cd + TAB_ROOM;
  const xUFace = w / 2 - g.upperD + KNOB_ROOM;

  // 1. Return-arm base carcass, recessed plinth, and Shaker doors (or 3-tier horizontal hob drawers when hobPlacement === 'return').
  const xBackEnd = w / 2 - cd;
  const backClear = Math.max(0.35, xBackEnd - -w / 2);
  parts.push(
    span('base', [-w / 2, xBackEnd], [PLINTH, yBaseTop], [-d / 2, zBackFace - FRONT_T]),
    span('base', [-w / 2 + 0.004, xBackEnd], [0, PLINTH], [-d / 2, zBackFace - FRONT_T - 0.045], o),
  );
  if (hobPlacement === 'main') {
    const backDoorCount = clamp(Math.round(backClear / 0.55), 1, 5);
    parts.push(...shakerRunZ('base', [-w / 2 + 0.002, xBackEnd - 0.002], yFrontRange, zBackFace, backDoorCount));
  } else {
    if (returnOuter && returnOuter[1] - returnOuter[0] > 0.12) {
      const n = clamp(Math.round((returnOuter[1] - returnOuter[0]) / 0.52), 1, 2);
      parts.push(...shakerRunZ('base', [returnOuter[0] + 0.002, returnOuter[1] - 0.002], yFrontRange, zBackFace, n));
    }
    parts.push(...shakerDrawersZ('base', returnHob, yFrontRange, zBackFace));
    if (returnInner && returnInner[1] - returnInner[0] > 0.12) {
      const n = clamp(Math.round((returnInner[1] - returnInner[0]) / 0.52), 1, 5);
      parts.push(...shakerRunZ('base', [returnInner[0] + 0.002, returnInner[1] - 0.002], yFrontRange, zBackFace, n));
    }
  }

  // 2. Corner + main-arm base carcasses (stopping below sink bowls in the sink bay), plinth & Shaker fronts.
  const underSink = yw - 0.22;
  parts.push(
    span('base', [xSideFace + FRONT_T, w / 2], [PLINTH, yBaseTop], [-d / 2, sink[0]]),
    span('base', [xSideFace + FRONT_T, w / 2], [PLINTH, underSink], [sink[0], sink[1]], o),
    span('base', [xSideFace + FRONT_T, w / 2], [PLINTH, yBaseTop], [sink[1], zEnd]),
    span('base', [xSideFace + FRONT_T + 0.045, w / 2 - 0.004], [0, PLINTH], [zCorner - 0.02, zEnd - 0.004], o),
  );

  const prepDoorCount = prep ? clamp(Math.round((prep[1] - prep[0]) / 0.52), 1, 4) : 0;
  if (hobPlacement === 'main') {
    const preHobDoors: V2[] = [];
    if (prep) preHobDoors.push(...splitDoors(prep[0], prep[1], prepDoorCount));
    preHobDoors.push(...splitDoors(sink[0], sink[1], sink[1] - sink[0] >= 0.56 ? 2 : 1));
    parts.push(
      span('base', [xSideFace + 0.006, xSideFace + FRONT_T], [PLINTH + 0.006, yBaseTop - 0.006], [zCorner + 0.004, hob[0] - 0.003], o),
      ...shakerFramesOnlyX('base', preHobDoors, yFrontRange, xSideFace),
      ...shakerDrawersX('base', hob, yFrontRange, xSideFace),
    );
    if (tail && tail[1] - tail[0] > 0.12) {
      const tailDoors = splitDoors(tail[0], tail[1], clamp(Math.round((tail[1] - tail[0]) / 0.52), 1, 2));
      parts.push(
        span('base', [xSideFace + 0.006, xSideFace + FRONT_T], [PLINTH + 0.006, yBaseTop - 0.006], [tail[0] + 0.003, zEnd - 0.004], o),
        ...shakerFramesOnlyX('base', tailDoors, yFrontRange, xSideFace),
      );
    }
  } else {
    const sideBaseDoors: V2[] = [];
    if (prep) sideBaseDoors.push(...splitDoors(prep[0], prep[1], prepDoorCount));
    sideBaseDoors.push(...splitDoors(sink[0], sink[1], sink[1] - sink[0] >= 0.56 ? 2 : 1));
    sideBaseDoors.push(...splitDoors(hob[0], hob[1], hob[1] - hob[0] >= 0.56 ? 2 : 1));
    if (tail && tail[1] - tail[0] > 0.12) {
      sideBaseDoors.push(...splitDoors(tail[0], tail[1], clamp(Math.round((tail[1] - tail[0]) / 0.52), 1, 2)));
    }
    parts.push(
      span('base', [xSideFace + 0.006, xSideFace + FRONT_T], [PLINTH + 0.006, yBaseTop - 0.006], [zCorner + 0.004, zEnd - 0.004], o),
      ...shakerFramesOnlyX('base', sideBaseDoors, yFrontRange, xSideFace),
    );
  }

  // 3. White terrazzo L-shaped worktop (with sink cut-out) and waterfall end / pier.
  parts.push(
    span('worktop', [-w / 2, xBackEnd], [yBaseTop, yw], [-d / 2, zCorner], { bevel: 0.002 }),
    span('worktop', [xBackEnd, w / 2], [yBaseTop, yw], [-d / 2, holeZ[0]], { bevel: 0.002 }),
    span('worktop', [xBackEnd, w / 2], [yBaseTop, yw], [holeZ[1], d / 2], { bevel: 0.002 }),
    span('worktop', [xBackEnd, holeX[0]], [yBaseTop, yw], holeZ, { bevel: 0.002 }),
    span('worktop', [holeX[1], w / 2], [yBaseTop, yw], holeZ, { bevel: 0.002 }),
    span('worktop', [xBackEnd, w / 2], [0, yBaseTop], [zEnd, d / 2], { bevel: 0.002, plan: false }),
  );

  // 4. Pale mint vertical stack-bond splashbacks on both walls, flush to the outer counter edges.
  parts.push(
    span('tile', [-w / 2, w / 2 - 0.012], [yw + 0.001, yUpper0 - 0.001], [-d / 2, -d / 2 + 0.012], o),
    span('tile', [w / 2 - 0.012, w / 2], [yw + 0.001, yUpper0 - 0.001], [-d / 2, d / 2], o),
  );

  // 5. Single reachable row of warm cream shaker upper cabinets along the main wall (no high ceiling bridge tier).
  const cornerUpperCount = clamp(Math.round((sink[0] - -d / 2) / 0.52), 1, 5);
  const hobUpperCount = hob[1] - hob[0] >= 0.56 ? 2 : 1;
  const tailUpperCount = tail && tail[1] - tail[0] > 0.12 ? clamp(Math.round((tail[1] - tail[0]) / 0.52), 1, 2) : 0;

  // Upper tier: corner+prep solid bay.
  const cornerMainDoors = splitDoors(-d / 2, sink[0], cornerUpperCount);
  parts.push(
    span('upper', [xUFace + FRONT_T, w / 2], [yUpper0, yUpperTop], [-d / 2, sink[0]], o),
    span('upper', [xUFace + 0.006, xUFace + FRONT_T], [yUpper0 + 0.005, yUpperTop - 0.005], [-d / 2 + 0.004, sink[0] - 0.004], o),
    ...shakerFramesOnlyX('upper', cornerMainDoors, [yUpper0 + 0.004, yUpperTop - 0.004], xUFace),
  );

  // Upper tier: open cabinet over the sink with TWO stacked horizontal frames for reeded glass.
  const tBox = 0.018;
  const yGlassMid = (yUpper0 + yUpperTop) / 2;
  const gRail = clamp((yUpperTop - yUpper0) * 0.075, 0.036, 0.052);
  const sz0 = sink[0] + 0.002;
  const sz1 = sink[1] - 0.002;
  parts.push(
    span('upper', [xUFace + FRONT_T, w / 2], [yUpper0, yUpper0 + tBox], [sink[0], sink[1]], o),
    span('upper', [xUFace + FRONT_T, w / 2], [yUpperTop - tBox, yUpperTop], [sink[0], sink[1]], o),
    span('upper', [xUFace + FRONT_T, w / 2], [yGlassMid - tBox / 2, yGlassMid + tBox / 2], [sink[0] + tBox, sink[1] - tBox], o),
    span('upper', [xUFace + FRONT_T, w / 2], [yUpper0 + tBox, yUpperTop - tBox], [sink[0], sink[0] + tBox], o),
    span('upper', [xUFace + FRONT_T, w / 2], [yUpper0 + tBox, yUpperTop - tBox], [sink[1] - tBox, sink[1]], o),
    span('upper', [w / 2 - 0.01, w / 2], [yUpper0 + tBox, yUpperTop - tBox], [sink[0] + tBox, sink[1] - tBox], o),
  );
  for (const [gy0, gy1] of [
    [yUpper0 + 0.004, yGlassMid - 0.002],
    [yGlassMid + 0.002, yUpperTop - 0.004],
  ] as V2[]) {
    parts.push(
      span('upper', [xUFace, xUFace + FRONT_T], [gy1 - gRail, gy1], [sz0, sz1], o),
      span('upper', [xUFace, xUFace + FRONT_T], [gy0, gy0 + gRail], [sz0, sz1], o),
      span('upper', [xUFace, xUFace + FRONT_T], [gy0 + gRail, gy1 - gRail], [sz0, sz0 + gRail], o),
      span('upper', [xUFace, xUFace + FRONT_T], [gy0 + gRail, gy1 - gRail], [sz1 - gRail, sz1], o),
    );
  }

  // Upper tier: hob bay (raised 48 mm for the slim black hood when hob is on the main arm, full height otherwise) + optional tail bay.
  const yHobUpper0 = hobPlacement === 'main' ? yUpper0 + 0.048 : yUpper0;
  const hobMainDoors = splitDoors(hob[0], hob[1], hobUpperCount);
  parts.push(
    span('upper', [xUFace + FRONT_T, w / 2], [yHobUpper0, yUpperTop], [hob[0], hob[1]], o),
    span('upper', [xUFace + 0.006, xUFace + FRONT_T], [yHobUpper0 + 0.005, yUpperTop - 0.005], [hob[0] + 0.004, hob[1] - 0.004], o),
    ...shakerFramesOnlyX('upper', hobMainDoors, [yHobUpper0 + 0.004, yUpperTop - 0.004], xUFace),
  );

  if (tail && tailUpperCount) {
    const tailMainDoors = splitDoors(tail[0], tail[1], tailUpperCount);
    parts.push(
      span('upper', [xUFace + FRONT_T, w / 2], [yUpper0, yUpperTop], [tail[0], tail[1]], o),
      span('upper', [xUFace + 0.006, xUFace + FRONT_T], [yUpper0 + 0.005, yUpperTop - 0.005], [tail[0] + 0.004, tail[1] - 0.004], o),
      ...shakerFramesOnlyX('upper', tailMainDoors, [yUpper0 + 0.004, yUpperTop - 0.004], xUFace),
    );
  }

  return parts;
}

/** Clean built-in kitchen fixtures & hardware (pulls, sink, tap, hob, plus optional upper fixtures & slim hood). */
function buildLKitchenFixtures(
  size: Size3,
  params: ParamValues | undefined,
  opts: { withUppers: boolean; hobPlacement?: HobPlacement },
): Part[] {
  const hobPlacement: HobPlacement = opts.hobPlacement ?? 'main';
  const g = lKitchenGeo(size, params);
  const {
    w,
    d,
    cd,
    yw,
    uDrop,
    yUpper0,
    yUpperTop,
    zEnd,
    prep,
    sink,
    hob,
    tail,
    mainHobGlass,
    returnOuter,
    returnHob,
    returnInner,
    returnHobGlass,
    holeX,
    holeZ,
  } = g;
  const out: Part[] = [];

  const yBaseTop = yw - TOP_T;
  const yFrontRange: V2 = [PLINTH + 0.004, yBaseTop - 0.004];
  const zBackFace = -d / 2 + cd - TAB_ROOM;
  const xSideFace = w / 2 - cd + TAB_ROOM;
  const xUFace = w / 2 - g.upperD + KNOB_ROOM;
  const xBackEnd = w / 2 - cd;

  // 1. Leather tab pulls on hinged doors and centred horizontal leather strap pulls on the 3-drawer hob unit.
  const tabY = yBaseTop - 0.036;
  const addBackTabs = (rangeX: V2, count: number) => {
    const ds = splitDoors(rangeX[0], rangeX[1], count);
    ds.forEach(([x0, x1], i) => {
      const tx = ds.length > 1 && i % 2 === 0 && i + 1 < ds.length ? x1 - 0.035 : x0 + 0.035;
      out.push(...leatherTabZ(tx, tabY, zBackFace));
    });
  };
  if (hobPlacement === 'main') {
    const backClear = Math.max(0.35, xBackEnd - -w / 2);
    const backDoorCount = clamp(Math.round(backClear / 0.55), 1, 5);
    addBackTabs([-w / 2 + 0.002, xBackEnd - 0.002], backDoorCount);
  } else {
    if (returnOuter && returnOuter[1] - returnOuter[0] > 0.12) {
      addBackTabs([returnOuter[0] + 0.002, returnOuter[1] - 0.002], clamp(Math.round((returnOuter[1] - returnOuter[0]) / 0.52), 1, 2));
    }
    const hobCenterX = (returnHob[0] + returnHob[1]) / 2;
    for (const [, ry1] of drawerRows(yFrontRange)) {
      out.push(...drawerPullZ(hobCenterX, ry1, zBackFace));
    }
    if (returnInner && returnInner[1] - returnInner[0] > 0.12) {
      addBackTabs([returnInner[0] + 0.002, returnInner[1] - 0.002], clamp(Math.round((returnInner[1] - returnInner[0]) / 0.52), 1, 5));
    }
  }

  const addSideTabs = (rangeZ: V2, count: number) => {
    const ds = splitDoors(rangeZ[0], rangeZ[1], count);
    ds.forEach(([z0, z1], i) => {
      const tz = ds.length > 1 && i % 2 === 0 && i + 1 < ds.length ? z1 - 0.035 : z0 + 0.035;
      out.push(...leatherTabX(xSideFace, tabY, tz));
    });
  };
  if (prep) addSideTabs(prep, clamp(Math.round((prep[1] - prep[0]) / 0.52), 1, 4));
  addSideTabs(sink, sink[1] - sink[0] >= 0.56 ? 2 : 1);
  if (hobPlacement === 'main') {
    const hobCenterZ = (hob[0] + hob[1]) / 2;
    for (const [, ry1] of drawerRows(yFrontRange)) {
      out.push(...drawerPullX(xSideFace, ry1, hobCenterZ));
    }
  } else {
    addSideTabs(hob, hob[1] - hob[0] >= 0.56 ? 2 : 1);
  }
  if (tail && tail[1] - tail[0] > 0.12) addSideTabs(tail, clamp(Math.round((tail[1] - tail[0]) / 0.52), 1, 2));

  // 2. Upper cabinet knobs, reeded glass panes & under-cabinet LED (only when upper cabinets are present).
  if (opts.withUppers) {
    const cornerUpperCount = clamp(Math.round((sink[0] - -d / 2) / 0.52), 1, 5);
    const hobUpperCount = hob[1] - hob[0] >= 0.56 ? 2 : 1;
    const tailUpperCount = tail && tail[1] - tail[0] > 0.12 ? clamp(Math.round((tail[1] - tail[0]) / 0.52), 1, 2) : 0;

    const addKnobsX = (rangeZ: V2, count: number, ky: number) => {
      const ds = splitDoors(rangeZ[0], rangeZ[1], count);
      ds.forEach(([z0, z1], i) => {
        const kz = ds.length > 1 && i % 2 === 0 && i + 1 < ds.length ? z1 - 0.035 : z0 + 0.035;
        out.push(brassKnobX(xUFace, ky, kz));
      });
    };
    addKnobsX([-d / 2, sink[0]], cornerUpperCount, yUpper0 + 0.065);
    addKnobsX(hob, hobUpperCount, hobPlacement === 'main' ? yUpper0 + 0.11 : yUpper0 + 0.065);
    if (tail && tailUpperCount) addKnobsX(tail, tailUpperCount, yUpper0 + 0.065);

    const yGlassMid = (yUpper0 + yUpperTop) / 2;
    const gRail = clamp((yUpperTop - yUpper0) * 0.075, 0.036, 0.052);
    for (const [gy0, gy1] of [
      [yUpper0 + 0.004, yGlassMid - 0.002],
      [yGlassMid + 0.002, yUpperTop - 0.004],
    ] as V2[]) {
      out.push(
        span(
          'glass',
          [xUFace + 0.007, xUFace + 0.013],
          [gy0 + gRail - 0.003, gy1 - gRail + 0.003],
          [sink[0] + gRail - 0.002, sink[1] - gRail + 0.002],
          o,
        ),
        brassKnobX(xUFace, gy0 + gRail * 0.5, (sink[0] + sink[1]) / 2),
      );
    }

    const ledZEnd = hobPlacement === 'main' ? hob[0] - 0.02 : zEnd - 0.04;
    out.push(
      span('glow', [w / 2 - g.upperD + 0.05, w / 2 - g.upperD + 0.07], [yUpper0 - 0.005, yUpper0 - 0.001], [-d / 2 + 0.04, ledZEnd], o),
    );
  }

  // 3. Undermount matte-black double sink + brushed-steel pull-down spring faucet.
  const zBowlMid = (holeZ[0] + holeZ[1]) / 2;
  const sinkFloor = yw - 0.195;
  const sinkTop = yBaseTop - 0.001;
  out.push(
    span('appliance', [holeX[0] - 0.004, holeX[1] + 0.004], [sinkFloor, sinkTop], [zBowlMid - 0.014, zBowlMid + 0.014], o),
  );
  for (const [bz0, bz1] of [
    [holeZ[0], zBowlMid - 0.014],
    [zBowlMid + 0.014, holeZ[1]],
  ] as V2[]) {
    out.push(
      span('appliance', [holeX[0] - 0.004, holeX[1] + 0.004], [sinkFloor, sinkFloor + 0.006], [bz0 - 0.004, bz1 + 0.004], o),
      span('appliance', [holeX[0] - 0.005, holeX[0] + 0.001], [sinkFloor, sinkTop], [bz0, bz1], o),
      span('appliance', [holeX[1] - 0.001, holeX[1] + 0.005], [sinkFloor, sinkTop], [bz0, bz1], o),
      span('appliance', holeX, [sinkFloor, sinkTop], [bz0 - 0.005, bz0 + 0.001], o),
      span('appliance', holeX, [sinkFloor, sinkTop], [bz1 - 0.001, bz1 + 0.005], o),
      cyl('steel', [(holeX[0] + holeX[1]) / 2, sinkFloor + 0.009, (bz0 + bz1) / 2], 0.032, 0.004, o),
    );
  }

  const tapX = (holeX[1] + w / 2) / 2;
  const tapZ = zBowlMid - 0.03;
  const tapY0 = yw + 0.001;
  const tapTop = Math.min(yw + 0.4, yUpper0 - 0.075);
  const reach = Math.min(0.19, tapX - (holeX[0] + holeX[1]) / 2);
  out.push(
    cyl('steel', [tapX, tapY0 + 0.014, tapZ], 0.026, 0.028, o),
    rod('steel', [tapX, tapY0 + 0.024, tapZ], [tapX, tapY0 + 0.1, tapZ], 0.015, o),
    rod('steel', [tapX, tapY0 + 0.08, tapZ + 0.01], [tapX, tapY0 + 0.11, tapZ + 0.06], 0.005, o),
    rod('steel', [tapX, tapY0 + 0.1, tapZ], [tapX, tapTop, tapZ], 0.0065, o),
  );
  const springCount = 9;
  const springStep = Math.max(0.012, (tapTop - (tapY0 + 0.13)) / (springCount + 1));
  for (const i of range(springCount)) {
    out.push(torus('steel', [tapX, tapY0 + 0.13 + i * springStep, tapZ], 0.015, 0.0028, { ...o, rotation: [Math.PI / 2, 0, 0] }));
  }
  const tapArc: V3[] = range(6).map((i) => {
    const a = (i / 5) * Math.PI;
    return [tapX - (1 - Math.cos(a)) * (reach / 2), tapTop + Math.sin(a) * 0.045, tapZ];
  });
  for (let i = 0; i < tapArc.length - 1; i++) out.push(rod('steel', tapArc[i], tapArc[i + 1], 0.0065, o));
  const spoutEnd = tapArc[tapArc.length - 1];
  out.push(
    rod('steel', spoutEnd, [spoutEnd[0], spoutEnd[1] - 0.11, spoutEnd[2]], 0.01, o),
    cyl('steel', [spoutEnd[0], spoutEnd[1] - 0.125, spoutEnd[2]], 0.016, 0.028, o),
  );

  // 4. Black glass induction hob (20 cm from the open counter edge) + 1-sided tempered glass oil-splatter shield (+ slim hood when hob is on main arm with uppers).
  const shieldH = Math.min(0.45, uDrop - 0.055);
  const yShieldTop = yw + shieldH;
  if (hobPlacement === 'main') {
    const hobLenZ = mainHobGlass[1] - mainHobGlass[0];
    const hobMidZ = (mainHobGlass[0] + mainHobGlass[1]) / 2;
    const hx0 = w / 2 - cd + 0.07;
    const hx1 = w / 2 - 0.07;
    const hxc = (hx0 + hx1) / 2;
    const rSmall = Math.min(0.085, hobLenZ * 0.19, (hx1 - hx0) * 0.26);
    const rLarge = Math.min(0.095, hobLenZ * 0.21, (hx1 - hx0) * 0.28);
    const ctrlHalf = Math.min(0.07, hobLenZ * 0.25);
    out.push(
      span('hob', [hx0, hx1], [yw + 0.001, yw + 0.006], mainHobGlass, o),
      torus('steel', [hxc - 0.02, yw + 0.0072, hobMidZ - hobLenZ * 0.24], rSmall, 0.0015, { ...o, rotation: [Math.PI / 2, 0, 0] }),
      torus('steel', [hxc + 0.02, yw + 0.0072, hobMidZ + hobLenZ * 0.24], rLarge, 0.0015, { ...o, rotation: [Math.PI / 2, 0, 0] }),
      span('steel', [hx0 + 0.03, hx0 + 0.036], [yw + 0.0065, yw + 0.0078], [hobMidZ - ctrlHalf, hobMidZ + ctrlHalf], o),
      // 1-sided tempered glass oil-splatter shield on the open outer end (+d/2) in brushed-steel U-channels.
      span('steel', [w / 2 - cd + 0.02, w / 2 - 0.013], [yw + 0.001, yw + 0.013], [d / 2 - 0.018, d / 2 - 0.004], o),
      span('steel', [w / 2 - 0.025, w / 2 - 0.013], [yw + 0.013, yShieldTop - 0.006], [d / 2 - 0.018, d / 2 - 0.004], o),
      span('shield', [w / 2 - cd + 0.016, w / 2 - 0.019], [yw + 0.006, yShieldTop], [d / 2 - 0.015, d / 2 - 0.007], {
        ...o,
        bevel: 0.0015,
      }),
    );

    if (opts.withUppers) {
      const hoodX0 = w / 2 - Math.min(0.49, cd - 0.05);
      const hoodX1 = w / 2 - 0.002;
      const hoodY0 = yUpper0 - 0.052;
      const hoodY1 = yUpper0 + 0.045;
      const hoodZ: V2 = [hob[0] + 0.003, hob[1] - 0.003];
      const hoodMidZ = (hoodZ[0] + hoodZ[1]) / 2;
      const visorRun = 0.085;
      const visorLip = hoodY0 + 0.034;
      const visorSlope = Math.atan2(visorRun, hoodY1 - visorLip);
      const visorLen = Math.hypot(visorRun, hoodY1 - visorLip);
      out.push(
        span('appliance', [hoodX0 + visorRun, hoodX1], [visorLip, hoodY1], hoodZ, o),
        span('appliance', [hoodX0, hoodX0 + 0.095], [hoodY0, visorLip], hoodZ, o),
        box('appliance', [hoodX0 + visorRun / 2, (visorLip + hoodY1) / 2, hoodMidZ], [0.012, visorLen, hoodZ[1] - hoodZ[0]], {
          ...o,
          rotation: [0, 0, -visorSlope],
        }),
        span('steel', [hoodX0 + 0.12, hoodX1 - 0.03], [visorLip - 0.004, visorLip - 0.001], [hoodZ[0] + 0.05, hoodZ[1] - 0.05], o),
        span('glow', [hoodX0 + 0.095, hoodX0 + 0.115], [visorLip - 0.005, visorLip - 0.0015], [hoodZ[0] + 0.09, hoodZ[1] - 0.09], o),
      );
    }
  } else {
    const hobLenX = returnHobGlass[1] - returnHobGlass[0];
    const hobMidX = (returnHobGlass[0] + returnHobGlass[1]) / 2;
    const hz0 = -d / 2 + 0.07;
    const hz1 = -d / 2 + cd - 0.07;
    const hzc = (hz0 + hz1) / 2;
    const rSmall = Math.min(0.085, hobLenX * 0.19, (hz1 - hz0) * 0.26);
    const rLarge = Math.min(0.095, hobLenX * 0.21, (hz1 - hz0) * 0.28);
    const ctrlHalf = Math.min(0.07, hobLenX * 0.25);
    out.push(
      span('hob', returnHobGlass, [yw + 0.001, yw + 0.006], [hz0, hz1], o),
      torus('steel', [hobMidX - hobLenX * 0.24, yw + 0.0072, hzc - 0.015], rSmall, 0.0015, { ...o, rotation: [Math.PI / 2, 0, 0] }),
      torus('steel', [hobMidX + hobLenX * 0.24, yw + 0.0072, hzc + 0.015], rLarge, 0.0015, { ...o, rotation: [Math.PI / 2, 0, 0] }),
      span('steel', [hobMidX - ctrlHalf, hobMidX + ctrlHalf], [yw + 0.0065, yw + 0.0078], [hz1 - 0.036, hz1 - 0.03], o),
      // 1-sided tempered glass oil-splatter shield on the open outer end (-w/2) in brushed-steel U-channels.
      span('steel', [-w / 2 + 0.004, -w / 2 + 0.018], [yw + 0.001, yw + 0.013], [-d / 2 + 0.013, -d / 2 + cd - 0.02], o),
      span('steel', [-w / 2 + 0.004, -w / 2 + 0.018], [yw + 0.013, yShieldTop - 0.006], [-d / 2 + 0.013, -d / 2 + 0.025], o),
      span('shield', [-w / 2 + 0.007, -w / 2 + 0.015], [yw + 0.006, yShieldTop], [-d / 2 + 0.019, -d / 2 + cd - 0.016], {
        ...o,
        bevel: 0.0015,
      }),
    );
  }

  return out;
}

function eulerRotate([x0, y0, z0]: V3, [ax, ay, az]: V3): V3 {
  let x = x0;
  let y = y0;
  let z = z0;
  [x, y] = [x * Math.cos(az) - y * Math.sin(az), x * Math.sin(az) + y * Math.cos(az)];
  [x, z] = [x * Math.cos(ay) + z * Math.sin(ay), -x * Math.sin(ay) + z * Math.cos(ay)];
  [y, z] = [y * Math.cos(ax) - z * Math.sin(ax), y * Math.sin(ax) + z * Math.cos(ax)];
  return [x, y, z];
}

function composeRyPos90(rot: V3): V3 {
  const ccw = ([x, y, z]: V3): V3 => [z, y, -x];
  const c0 = ccw(eulerRotate([1, 0, 0], rot));
  const c1 = ccw(eulerRotate([0, 1, 0], rot));
  const c2 = ccw(eulerRotate([0, 0, 1], rot));
  const m02 = clamp(c2[0], -1, 1);
  const ay = Math.asin(m02);
  if (Math.abs(m02) < 0.9999999) {
    return [Math.atan2(-c2[1], c2[2]), ay, Math.atan2(-c1[0], c0[0])];
  }
  return [Math.atan2(c1[2], c1[1]), ay, 0];
}

/**
 * Pure +90° rigid rotation around +Y (`(rx, ry, rz) ↦ (rz, ry, -rx)`), placing the corner at back-left `(-w/2, -d/2)`
 * so the main cooking/sink/upper-cabinet arm runs along `-z` (`Width = w`) facing `+z` and the return arm
 * runs down `-x` (`Depth = d`) facing `+x` — preserving exact reference chirality while facing the 3D camera openly.
 */
function rotatePartsCCW90(parts: Part[]): Part[] {
  return parts.map((p): Part => {
    const pos: V3 = [p.position[2], p.position[1], -p.position[0]];
    if (p.shape === 'box' && !p.rotation && !p.scale) {
      return { ...p, position: pos, size: [p.size[2], p.size[1], p.size[0]] };
    }
    const q: Part = { ...p, position: pos };
    if (p.rotation) {
      q.rotation = composeRyPos90(p.rotation);
    } else if (p.shape === 'box' || p.shape === 'torus') {
      q.rotation = [0, Math.PI / 2, 0];
    }
    if (q.shape === 'prism') {
      q.outline = q.outline.map(([x, z]) => [z, -x] as V2);
      delete q.rotation;
    }
    return q;
  });
}

function mirrorPartsX(parts: Part[]): Part[] {
  return parts.map((p) => {
    const q: Part = { ...p, position: [-p.position[0], p.position[1], p.position[2]] };
    if (p.rotation) q.rotation = [p.rotation[0], -p.rotation[1], -p.rotation[2]];
    if (q.shape === 'prism') q.outline = q.outline.map(([x, z]) => [-x, z] as V2).reverse();
    return q;
  });
}

function orientLParts(parts: Part[], hand: 'left' | 'right'): Part[] {
  const ccw = rotatePartsCCW90(parts);
  return hand === 'left' ? ccw : mirrorPartsX(ccw);
}

function lKitchenPlanDetail(
  size: Size3,
  params: ParamValues | undefined,
  hand: 'left' | 'right',
  hobPlacement: HobPlacement = 'main',
): PlanStroke[] {
  const g = lKitchenGeo({ w: size.d, d: size.w, h: size.h }, params);
  const { w, d, cd, holeX, holeZ, mainHobGlass, returnHobGlass } = g;
  const zBowlMid = (holeZ[0] + holeZ[1]) / 2;

  const rawStrokes: PlanStroke[] = [
    // Double sink bowls & drains.
    {
      kind: 'poly',
      closed: true,
      points: [
        [holeX[0], holeZ[0]],
        [holeX[1], holeZ[0]],
        [holeX[1], zBowlMid - 0.014],
        [holeX[0], zBowlMid - 0.014],
      ],
    },
    {
      kind: 'poly',
      closed: true,
      points: [
        [holeX[0], zBowlMid + 0.014],
        [holeX[1], zBowlMid + 0.014],
        [holeX[1], holeZ[1]],
        [holeX[0], holeZ[1]],
      ],
    },
    { kind: 'circle', c: [(holeX[0] + holeX[1]) / 2, (holeZ[0] + zBowlMid - 0.014) / 2], r: 0.028 },
    { kind: 'circle', c: [(holeX[0] + holeX[1]) / 2, (zBowlMid + 0.014 + holeZ[1]) / 2], r: 0.028 },
  ];

  if (hobPlacement === 'main') {
    const hobLenZ = mainHobGlass[1] - mainHobGlass[0];
    const hobMidZ = (mainHobGlass[0] + mainHobGlass[1]) / 2;
    const hx0 = w / 2 - cd + 0.07;
    const hx1 = w / 2 - 0.07;
    const hxc = w / 2 - cd / 2;
    const rSmall = Math.min(0.08, hobLenZ * 0.18, (hx1 - hx0) * 0.24);
    const rLarge = Math.min(0.09, hobLenZ * 0.2, (hx1 - hx0) * 0.26);
    rawStrokes.push(
      {
        kind: 'poly',
        closed: true,
        points: [
          [hx0, mainHobGlass[0]],
          [hx1, mainHobGlass[0]],
          [hx1, mainHobGlass[1]],
          [hx0, mainHobGlass[1]],
        ],
      },
      { kind: 'circle', c: [hxc - 0.02, hobMidZ - hobLenZ * 0.24], r: rSmall },
      { kind: 'circle', c: [hxc + 0.02, hobMidZ + hobLenZ * 0.24], r: rLarge },
      // 1-sided outer glass splatter shield in plan.
      { kind: 'line', a: [w / 2 - cd + 0.016, d / 2 - 0.011], b: [w / 2 - 0.013, d / 2 - 0.011] },
    );
  } else {
    const hobLenX = returnHobGlass[1] - returnHobGlass[0];
    const hobMidX = (returnHobGlass[0] + returnHobGlass[1]) / 2;
    const hz0 = -d / 2 + 0.07;
    const hz1 = -d / 2 + cd - 0.07;
    const hzc = (hz0 + hz1) / 2;
    const rSmall = Math.min(0.08, hobLenX * 0.18, (hz1 - hz0) * 0.24);
    const rLarge = Math.min(0.09, hobLenX * 0.2, (hz1 - hz0) * 0.26);
    rawStrokes.push(
      {
        kind: 'poly',
        closed: true,
        points: [
          [returnHobGlass[0], hz0],
          [returnHobGlass[1], hz0],
          [returnHobGlass[1], hz1],
          [returnHobGlass[0], hz1],
        ],
      },
      { kind: 'circle', c: [hobMidX - hobLenX * 0.24, hzc - 0.015], r: rSmall },
      { kind: 'circle', c: [hobMidX + hobLenX * 0.24, hzc + 0.015], r: rLarge },
      // 1-sided outer glass splatter shield in plan.
      { kind: 'line', a: [-w / 2 + 0.011, -d / 2 + 0.013], b: [-w / 2 + 0.011, -d / 2 + cd - 0.016] },
    );
  }

  const sgn = hand === 'left' ? 1 : -1;
  const mapPt = ([rx, rz]: V2): V2 => [sgn * rz, -rx];
  return rawStrokes.map((s): PlanStroke => {
    if (s.kind === 'line') return { kind: 'line', a: mapPt(s.a), b: mapPt(s.b) };
    if (s.kind === 'circle') return { kind: 'circle', c: mapPt(s.c), r: s.r };
    return { kind: 'poly', closed: s.closed, points: s.points.map(mapPt) };
  });
}

function lKitchenModels(hand: 'left' | 'right'): AssetModelVariant[] {
  const buildReturnShell = (size: Size3, params?: ParamValues) =>
    orientLParts(buildLKitchenShell({ w: size.d, d: size.w, h: size.h }, params, 'return'), hand);
  const returnPlan = (size: Size3, params?: ParamValues) => lKitchenPlanDetail(size, params, hand, 'return');

  return [
    {
      id: 'clean',
      name: 'With upper cabinets',
      slots: L_UPPER_CLEAN_SLOTS,
      props: (size, params) =>
        orientLParts(
          buildLKitchenFixtures({ w: size.d, d: size.w, h: size.h }, params, { withUppers: true, hobPlacement: 'main' }),
          hand,
        ),
    },
    {
      id: 'side-hob',
      name: 'Hob on side arm, with uppers',
      slots: L_UPPER_CLEAN_SLOTS,
      build: buildReturnShell,
      planDetail: returnPlan,
      props: (size, params) =>
        orientLParts(
          buildLKitchenFixtures({ w: size.d, d: size.w, h: size.h }, params, { withUppers: true, hobPlacement: 'return' }),
          hand,
        ),
    },
    {
      id: 'no-uppers',
      name: 'No upper cabinets',
      hide: ['upper'],
      slots: L_BASE_FIXTURE_SLOTS,
      props: (size, params) =>
        orientLParts(
          buildLKitchenFixtures({ w: size.d, d: size.w, h: size.h }, params, { withUppers: false, hobPlacement: 'main' }),
          hand,
        ),
    },
    {
      id: 'side-hob-no-uppers',
      name: 'Hob on side arm, no uppers',
      hide: ['upper'],
      slots: L_BASE_FIXTURE_SLOTS,
      build: buildReturnShell,
      planDetail: returnPlan,
      props: (size, params) =>
        orientLParts(
          buildLKitchenFixtures({ w: size.d, d: size.w, h: size.h }, params, { withUppers: false, hobPlacement: 'return' }),
          hand,
        ),
    },
  ];
}

const lKitchen = defineItem({
  id: 'l-kitchen',
  name: 'Sage & cream shaker L-shaped kitchen',
  category: 'kitchen',
  type: 'surfaces',
  group: 'Counters & cabinets',
  tags: [
    'l kitchen',
    'l-shaped kitchen',
    'corner kitchen',
    'bếp chữ l',
    'tủ bếp chữ l',
    'reeded glass',
    ...TAGS,
  ],
  description:
    'Parametric L-shaped sage & warm-cream shaker kitchen without fridge, dining bar or wall shelves, with a three-drawer horizontal shaker base under the induction hob: resize Width and Depth independently, or switch Model to move the hob onto the side arm or omit the upper cabinet row.',
  defaultSize: { w: 2.85, d: 1.75, h: 2.22 },
  minSize: { w: 1.85, d: 1.2, h: 1.95 },
  maxSize: { w: 4.2, d: 3.6, h: 2.6 },
  wallSnap: true,
  price: { vnd: 48_000_000, estimate: true },
  services: { water: 'hot', drain: 'waste', power: 'dedicated' },
  slots: [L_BASE, L_UPPER, L_WORKTOP, L_TILE],
  variants: L_VARIANTS,
  models: lKitchenModels('left'),
  params: lKitchenParams('left'),
  build: (size, params) => orientLParts(buildLKitchenShell({ w: size.d, d: size.w, h: size.h }, params, 'main'), 'left'),
  planDetail: (size, params) => lKitchenPlanDetail(size, params, 'left', 'main'),
});

const lKitchenRightReturn = defineItem({
  id: 'l-kitchen-right',
  name: 'Sage & cream shaker L-shaped kitchen (right return)',
  variantOf: 'l-kitchen',
  category: 'kitchen',
  type: 'surfaces',
  group: 'Counters & cabinets',
  tags: [
    'l kitchen',
    'l-shaped kitchen',
    'corner kitchen',
    'bếp chữ l',
    'tủ bếp chữ l',
    'reeded glass',
    ...TAGS,
  ],
  description:
    'Mirrored parametric L-shaped sage & warm-cream shaker kitchen without fridge, dining bar or wall shelves, with a three-drawer horizontal shaker base under the induction hob: resize Width and Depth independently, or switch Model to move the hob onto the right return arm or omit the upper cabinet row.',
  defaultSize: { w: 2.85, d: 1.75, h: 2.22 },
  minSize: { w: 1.85, d: 1.2, h: 1.95 },
  maxSize: { w: 4.2, d: 3.6, h: 2.6 },
  wallSnap: true,
  price: { vnd: 48_000_000, estimate: true },
  services: { water: 'hot', drain: 'waste', power: 'dedicated' },
  slots: [L_BASE, L_UPPER, L_WORKTOP, L_TILE],
  variants: L_VARIANTS,
  models: lKitchenModels('right'),
  params: lKitchenParams('right'),
  build: (size, params) => orientLParts(buildLKitchenShell({ w: size.d, d: size.w, h: size.h }, params, 'main'), 'right'),
  planDetail: (size, params) => lKitchenPlanDetail(size, params, 'right', 'main'),
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
            const v = Math.round(226 + rand() * 14);
            ctx.fillStyle = `rgb(${v},${v},${v})`;
            ctx.fillRect(c * tw + g / 2, r * th + g / 2, tw - g, th - g);
            // A soft glaze highlight down one side of each tile.
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.fillRect(c * tw + g, r * th + g, tw * 0.18, th - 2 * g);
          }
      },
    },
  ],
  items: [
    lKitchen,
    lKitchenRightReturn,
    baseDoorUnit,
    blindCorner,
    sinkUnit,
    hobUnit,
    terrazzoPier,
    wallCabinet,
    reededCabinet,
    slimHood,
    splashback,
    oakShelf,
    boards,
    copperPot,
    budVase,
  ],
  materials: [
    // Colours sampled from the reference, white-balanced against its white walls, then set so they render
    // as in the photo next to the cream uppers (the 3D view lights fronts about 1.4x brighter).
    { id: 'sage-lacquer', name: 'Sage green shaker lacquer', category: 'paint', color: '#5f6d55', roughness: 0.6 },
    { id: 'cream-lacquer', name: 'Warm cream shaker lacquer', category: 'paint', color: '#f1ece2', roughness: 0.6 },
    { id: 'terrazzo-white', name: 'White terrazzo', category: 'stone', color: '#efece6', roughness: 0.3, pattern: { id: 'fine-terrazzo', scale: 0.3 } },
    {
      id: 'mint-stack-tile',
      name: 'Pale mint green tile (gạch thẻ xanh nhạt)',
      category: 'tile',
      color: '#b6ded5',
      roughness: 0.14,
      pattern: { id: 'stack-bond', scale: 0.3 },
    },
    { id: 'bar-oak', name: 'Warm oak veneer', category: 'wood', color: '#b8925f', roughness: 0.55, pattern: { id: 'wood-grain', scale: 0.6 }, photo: { set: 'oak-veneer' } },
    { id: 'leather-tab', name: 'Tan leather', category: 'fabric', color: '#553a26', roughness: 0.6, photo: { set: 'leather', scale: 0.4 } },
    { id: 'reeded-glass', name: 'Reeded glass', category: 'glass', color: '#e8ece6', roughness: 0.12, opacity: 0.5, pattern: { id: 'fluted', scale: 0.08, rotation: 90 } },
    { id: 'tempered-glass', name: 'Tempered clear glass (kính chắn dầu)', category: 'glass', color: '#cfe4e2', roughness: 0.05, opacity: 0.36 },
    { id: 'smoked-glass', name: 'Smoked glass', category: 'glass', color: '#8a8378', roughness: 0.08, opacity: 0.55 },
    { id: 'dried-grass', name: 'Dried feather grass', category: 'solid', color: '#d9c7a4', roughness: 0.95 },
    { id: 'mandarin', name: 'Mandarin peel', category: 'solid', color: '#e7781f', roughness: 0.55 },
    { id: 'kraft-paper', name: 'Kraft paper', category: 'solid', color: '#a77d52', roughness: 0.9 },
    { id: 'hood-light', name: 'Hood light', category: 'solid', color: '#fff4dc', roughness: 0.5, emissive: '#fff1d6', emissiveIntensity: 1.2 },
    { id: 'shelf-led', name: 'Warm LED strip', category: 'solid', color: '#fff2d8', roughness: 0.5, emissive: '#ffe2b0', emissiveIntensity: 1.6 },
  ],
});

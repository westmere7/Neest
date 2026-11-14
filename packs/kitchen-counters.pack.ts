/**
 * Kitchen counters — base units, counter runs, islands and sink units built from one parametric
 * counter: a row of bays (doors, drawers, open shelves, pull-outs, oven, dishwasher, hob, sinks)
 * under a worktop with real openings for the sinks.
 *
 * Sizes follow common kitchen modules: 90 cm worktop height, 60 cm deep, 10 cm plinth; units are
 * 15–120 cm wide and counter runs 1.8–3.6 m. Sink units include the tap in their height (as the
 * built-in sink unit does). Slots: fronts, worktop, handles & taps, and the sink or appliance.
 */
import {
  box,
  clamp,
  cyl,
  defineItem,
  definePack,
  matSlot,
  range,
  rod,
  span,
  sphere,
  torus,
  type AssetModelVariant,
  type AssetParam,
  type AssetPresetVariant,
  type PackItem,
  type PackMaterial,
  type ParamValues,
  type Part,
  type PlanStroke,
  type Size3,
  type V2,
  type V3,
} from '@/packs/kit';

type BayKind = 'door' | 'doors' | 'drawers3' | 'drawers2' | 'drawer-door' | 'open' | 'pullout' | 'oven' | 'dishwasher' | 'sink' | 'sink2' | 'sink-drainer' | 'hob' | 'blank';
interface Bay {
  kind: BayKind;
  /** Relative width. */
  w: number;
}
type Front = 'slab' | 'shaker' | 'handleless';
interface CounterStyle {
  bays: Bay[];
  front?: Front;
  /** Sink look: inset (rim on the worktop), undermount, apron (farmhouse) or a sink with drainer. */
  sink?: 'inset' | 'undermount' | 'apron';
  /** Worktop overhang at the back (islands with seating), metres. */
  overhang?: number;
  /** Tiled masonry counter (Vietnamese bếp xây): tiled front instead of the plinth. */
  masonry?: boolean;
  /** Tap above the worktop (sink units). */
  tap?: boolean;
  /** Slot for hob and oven parts (runs that also have a sink use the sink slot). */
  applianceSlot?: string;
}

const o = { plan: false };
const TAP_H = 0.32;
const WT = 0.035;
const PLINTH = 0.1;
const FRONT_T = 0.019;

function layout(size: Size3, s: CounterStyle) {
  const top = s.tap ? size.h - TAP_H : size.h;
  const zBack = -size.d / 2 + (s.overhang ?? 0);
  const zFace = size.d / 2 - 0.025 - FRONT_T;
  const total = s.bays.reduce((a, b) => a + b.w, 0);
  let x = -size.w / 2;
  const bays = s.bays.map((b) => {
    const bw = (size.w * b.w) / total;
    const r = { ...b, x0: x, x1: x + bw };
    x += bw;
    return r;
  });
  return { top, zBack, zFace, bays, y0: s.masonry ? 0 : PLINTH, yTop: top - WT };
}

type Hole = { x0: number; x1: number; z0: number; z1: number };

/** Worktop slab with rectangular openings (cut as strips around them). */
function worktop(size: Size3, top: number, holes: Hole[]): Part[] {
  const parts: Part[] = [];
  const z0 = -size.d / 2;
  const z1 = size.d / 2;
  const y: [number, number] = [top - WT, top];
  const sorted = [...holes].sort((a, b) => a.x0 - b.x0);
  let x = -size.w / 2;
  for (const h of sorted) {
    if (h.x0 > x + 1e-4) parts.push(span('worktop', [x, h.x0], y, [z0, z1]));
    parts.push(span('worktop', [h.x0, h.x1], y, [z0, h.z0]), span('worktop', [h.x0, h.x1], y, [h.z1, z1], o));
    x = h.x1;
  }
  if (size.w / 2 > x + 1e-4) parts.push(span('worktop', [x, size.w / 2], y, [z0, z1]));
  return parts;
}

/** Sink bowl hanging in an opening: floor, four walls, a rim (inset) and a drain. */
function bowl(slot: string, h: Hole, top: number, depth: number, rim: boolean): Part[] {
  const t = 0.008;
  const yb = top - WT - depth;
  const parts: Part[] = [
    span(slot, [h.x0, h.x1], [yb, yb + t], [h.z0, h.z1], o),
    span(slot, [h.x0, h.x0 + t], [yb, top - WT], [h.z0, h.z1], o),
    span(slot, [h.x1 - t, h.x1], [yb, top - WT], [h.z0, h.z1], o),
    span(slot, [h.x0, h.x1], [yb, top - WT], [h.z0, h.z0 + t], o),
    span(slot, [h.x0, h.x1], [yb, top - WT], [h.z1 - t, h.z1], o),
    cyl('handle', [(h.x0 + h.x1) / 2, yb + t + 0.002, (h.z0 + h.z1) / 2], 0.035, 0.004, { segments: 16, ...o }),
  ];
  if (rim) {
    const r = 0.012;
    parts.push(
      span(slot, [h.x0 - r, h.x1 + r], [top - 0.002, top], [h.z0 - r, h.z0], o),
      span(slot, [h.x0 - r, h.x1 + r], [top - 0.002, top], [h.z1, h.z1 + r], o),
      span(slot, [h.x0 - r, h.x0], [top - 0.002, top], [h.z0, h.z1], o),
      span(slot, [h.x1, h.x1 + r], [top - 0.002, top], [h.z0, h.z1], o),
    );
  }
  return parts;
}

/** Gooseneck mixer tap at (x, z) on the worktop, spout reaching forward `reach`. */
function tap(x: number, z: number, top: number, height: number, reach: number): Part[] {
  const hb = Math.min(height, TAP_H - 0.02);
  return [
    cyl('handle', [x, top + 0.02, z], 0.026, 0.04, { segments: 16, ...o }),
    rod('handle', [x, top + 0.04, z], [x, top + hb * 0.82, z], 0.013, { segments: 12, ...o }),
    rod('handle', [x, top + hb * 0.82, z], [x, top + hb, z + reach * 0.35], 0.012, { segments: 12, ...o }),
    rod('handle', [x, top + hb, z + reach * 0.35], [x, top + hb * 0.88, z + reach], 0.011, { segments: 12, ...o }),
    rod('handle', [x, top + hb * 0.88, z + reach], [x, top + hb * 0.72, z + reach], 0.01, { segments: 12, ...o }),
    rod('handle', [x + 0.03, top + 0.06, z], [x + 0.075, top + 0.09, z], 0.006, o),
  ];
}

function handle(s: CounterStyle, x: number, y: number, z: number, len: number, vertical: boolean): Part[] {
  if (s.front === 'handleless') return [];
  return vertical
    ? [span('handle', [x - 0.006, x + 0.006], [y - len / 2, y + len / 2], [z, z + 0.022], o)]
    : [span('handle', [x - len / 2, x + len / 2], [y - 0.006, y + 0.006], [z, z + 0.022], o)];
}

/** One door or drawer front (slab, shaker frame or handleless with a top groove). */
function front(s: CounterStyle, x: [number, number], y: [number, number], zFace: number): Part[] {
  const g = 0.0015;
  const x0 = x[0] + g;
  const x1 = x[1] - g;
  const y0 = y[0] + g;
  const y1 = y[1] - (s.front === 'handleless' ? 0.025 : g);
  const parts: Part[] = [span('front', [x0, x1], [y0, y1], [zFace, zFace + FRONT_T], o)];
  if (s.front === 'shaker' && x1 - x0 > 0.14 && y1 - y0 > 0.12) {
    const r = Math.min(0.06, (x1 - x0) * 0.2, (y1 - y0) * 0.25);
    const zf = zFace + FRONT_T;
    parts.push(
      span('front', [x0, x1], [y1 - r, y1], [zf, zf + 0.006], o),
      span('front', [x0, x1], [y0, y0 + r], [zf, zf + 0.006], o),
      span('front', [x0, x0 + r], [y0 + r, y1 - r], [zf, zf + 0.006], o),
      span('front', [x1 - r, x1], [y0 + r, y1 - r], [zf, zf + 0.006], o),
    );
  }
  return parts;
}

function counterParts(size: Size3, s: CounterStyle): Part[] {
  const L = layout(size, s);
  const ap = s.applianceSlot ?? 'appliance';
  const parts: Part[] = [];
  const zf = L.zFace;
  const zh = zf + FRONT_T + (s.front === 'shaker' ? 0.006 : 0);
  const holes: Hole[] = [];
  // Plinth (recessed) or tiled masonry face.
  if (s.masonry) parts.push(span('worktop', [-size.w / 2, size.w / 2], [0, 0.06], [L.zBack, zf + FRONT_T], o));
  else parts.push(span('front', [-size.w / 2 + 0.005, size.w / 2 - 0.005], [0, PLINTH], [L.zBack + 0.02, zf - 0.04]));
  for (const b of L.bays) {
    const x: [number, number] = [b.x0, b.x1];
    const bw = b.x1 - b.x0;
    const xc = (b.x0 + b.x1) / 2;
    const y0 = L.y0;
    const y1 = L.yTop;
    // Carcass: solid, or open panels for shelves.
    if (b.kind === 'open') {
      const t = 0.018;
      parts.push(
        span('front', [b.x0, b.x0 + t], [y0, y1], [L.zBack, zf + FRONT_T]),
        span('front', [b.x1 - t, b.x1], [y0, y1], [L.zBack, zf + FRONT_T]),
        span('front', x, [y0, y0 + t], [L.zBack, zf + FRONT_T], o),
        span('front', x, [y0, y1], [L.zBack, L.zBack + t], o),
        span('front', [b.x0 + t, b.x1 - t], [(y0 + y1) / 2 - t / 2, (y0 + y1) / 2 + t / 2], [L.zBack + t, zf + FRONT_T - 0.01], o),
      );
      continue;
    }
    // Sink bays stop below the bowl, so the opening shows the bowl and not the cabinet's top.
    const isSink = b.kind === 'sink' || b.kind === 'sink2' || b.kind === 'sink-drainer';
    parts.push(span(s.masonry ? 'worktop' : 'front', x, [y0, isSink ? Math.max(y0 + 0.05, y1 - 0.27) : y1], [L.zBack, zf], { plan: true }));
    const H = y1 - y0;
    switch (b.kind) {
      case 'door':
      case 'pullout':
        parts.push(...front(s, x, [y0, y1], zf), ...handle(s, b.kind === 'pullout' ? xc : b.x1 - 0.05, y1 - 0.12, zh, 0.16, true));
        break;
      case 'doors':
      case 'sink':
      case 'sink2':
      case 'sink-drainer':
        for (const [a, c, hx] of [
          [b.x0, xc, xc - 0.05],
          [xc, b.x1, xc + 0.05],
        ] as const)
          parts.push(...front(s, [a, c], [y0, y1], zf), ...handle(s, hx, y1 - 0.12, zh, 0.16, true));
        break;
      case 'drawers3': {
        const cuts = [y0, y0 + H * 0.4, y0 + H * 0.75, y1];
        for (const i of range(3)) parts.push(...front(s, x, [cuts[i], cuts[i + 1]], zf), ...handle(s, xc, cuts[i + 1] - Math.min(0.06, (cuts[i + 1] - cuts[i]) / 2), zh, Math.min(0.32, bw * 0.5), false));
        break;
      }
      case 'drawers2':
      case 'hob': {
        const cuts = [y0, y0 + H * 0.5, y1];
        for (const i of range(2)) parts.push(...front(s, x, [cuts[i], cuts[i + 1]], zf), ...handle(s, xc, cuts[i + 1] - 0.06, zh, Math.min(0.32, bw * 0.5), false));
        break;
      }
      case 'drawer-door': {
        const cut = y1 - 0.16;
        parts.push(...front(s, x, [cut, y1], zf), ...handle(s, xc, y1 - 0.06, zh, Math.min(0.28, bw * 0.5), false));
        parts.push(...front(s, x, [y0, cut], zf), ...handle(s, b.x1 - 0.05, cut - 0.1, zh, 0.16, true));
        break;
      }
      case 'oven': {
        const cut = y1 - 0.1;
        parts.push(...front(s, x, [y0, y0 + 0.13], zf), ...handle(s, xc, y0 + 0.08, zh, Math.min(0.3, bw * 0.5), false));
        parts.push(span(ap, [b.x0 + 0.01, b.x1 - 0.01], [y0 + 0.14, cut], [zf, zf + 0.022], o));
        parts.push(span(ap, [b.x0 + 0.01, b.x1 - 0.01], [cut + 0.004, y1 - 0.004], [zf, zf + 0.02], o));
        parts.push(rod('handle', [b.x0 + 0.06, cut - 0.05, zf + 0.05], [b.x1 - 0.06, cut - 0.05, zf + 0.05], 0.009, o));
        for (const k of range(3)) parts.push(cyl('handle', [b.x0 + bw * (0.25 + k * 0.25), (cut + y1) / 2, zf + 0.026], 0.014, 0.012, { rotation: [Math.PI / 2, 0, 0], segments: 12, ...o }));
        break;
      }
      case 'dishwasher':
        parts.push(...front(s, x, [y0, y1], zf), ...handle(s, xc, y1 - 0.06, zh, Math.min(0.36, bw * 0.55), false));
        break;
      case 'blank':
        parts.push(...front(s, x, [y0, y1], zf));
        break;
    }
    // Sinks and hob on the worktop.
    const zc = (L.zBack + size.d / 2) / 2 - 0.01;
    if (b.kind === 'sink' || b.kind === 'sink2' || b.kind === 'sink-drainer') {
      const zd: [number, number] = [zc - 0.2, zc + 0.2];
      const rim = s.sink !== 'undermount' && s.sink !== 'apron';
      const slot = 'sink';
      if (b.kind === 'sink') {
        const hb: Hole = { x0: xc - Math.min(0.38, bw / 2 - 0.08), x1: xc + Math.min(0.38, bw / 2 - 0.08), z0: zd[0], z1: zd[1] };
        holes.push(hb);
        parts.push(...bowl(slot, hb, L.top, s.sink === 'apron' ? 0.23 : 0.2, rim));
        if (s.sink === 'apron') parts.push(span(slot, [hb.x0 - 0.02, hb.x1 + 0.02], [L.top - WT - 0.24, L.top - 0.002], [zf, zf + FRONT_T + 0.004], o));
      } else if (b.kind === 'sink2') {
        const half = Math.min(0.36, bw / 2 - 0.06);
        const h1: Hole = { x0: xc - half - 0.01, x1: xc - 0.015, z0: zd[0], z1: zd[1] };
        const h2: Hole = { x0: xc + 0.015, x1: xc + half * 0.75, z0: zd[0], z1: zd[1] };
        holes.push(h1, h2);
        parts.push(...bowl(slot, h1, L.top, 0.2, rim), ...bowl(slot, h2, L.top, 0.16, rim));
        if (rim) parts.push(span(slot, [h1.x1, h2.x0], [L.top - 0.002, L.top], [zd[0], zd[1]], o));
      } else {
        // Bowl plus a grooved draining board (Vietnamese chậu rửa inox with drainer).
        const hb: Hole = { x0: b.x0 + 0.06, x1: xc + 0.05, z0: zd[0], z1: zd[1] };
        holes.push(hb);
        parts.push(...bowl(slot, hb, L.top, 0.2, true));
        parts.push(span(slot, [xc + 0.07, b.x1 - 0.05], [L.top - 0.003, L.top], [zd[0] - 0.012, zd[1] + 0.012], o));
        for (const k of range(6)) {
          const gx = xc + 0.1 + ((b.x1 - 0.08 - xc - 0.1) * k) / 5;
          parts.push(span('handle', [gx - 0.003, gx + 0.003], [L.top - 0.004, L.top - 0.001], [zd[0] + 0.03, zd[1] - 0.03], o));
        }
      }
      if (s.tap) parts.push(...tap(b.kind === 'sink-drainer' ? (b.x0 + 0.06 + xc + 0.05) / 2 : xc, Math.max(zd[0] - 0.05, L.zBack + 0.03), L.top, 0.3, 0.2));
    }
    if (b.kind === 'hob') {
      const hw = Math.min(0.29, bw / 2 - 0.02);
      parts.push(span(ap, [xc - hw, xc + hw], [L.top, L.top + 0.005], [zc - 0.25, zc + 0.25], o));
    }
  }
  parts.push(...worktop(size, L.top, holes));
  return parts;
}

function counterPlan(size: Size3, s: CounterStyle): PlanStroke[] {
  const L = layout(size, s);
  const out: PlanStroke[] = [];
  for (const b of L.bays.slice(1)) out.push({ kind: 'line', a: [b.x0, L.zFace], b: [b.x0, size.d / 2] });
  const zc = (L.zBack + size.d / 2) / 2 - 0.01;
  for (const b of L.bays) {
    const xc = (b.x0 + b.x1) / 2;
    const bw = b.x1 - b.x0;
    if (b.kind === 'sink') {
      const hw = Math.min(0.38, bw / 2 - 0.08);
      out.push({ kind: 'poly', points: [[xc - hw, zc - 0.2], [xc + hw, zc - 0.2], [xc + hw, zc + 0.2], [xc - hw, zc + 0.2]], closed: true });
    }
    if (b.kind === 'sink2' || b.kind === 'sink-drainer') out.push({ kind: 'poly', points: [[b.x0 + 0.06, zc - 0.2], [xc + 0.05, zc - 0.2], [xc + 0.05, zc + 0.2], [b.x0 + 0.06, zc + 0.2]], closed: true });
    if (b.kind === 'hob') for (const [dx, dz] of [[-0.12, -0.1], [0.12, -0.1], [-0.12, 0.1], [0.12, 0.1]]) out.push({ kind: 'circle', c: [xc + dx, zc + dz], r: 0.08 });
  }
  return out;
}

// ───────────── Materials ─────────────

const materials: PackMaterial[] = [
  { id: 'hob-glass', name: 'Black ceramic glass', category: 'glass', color: '#141516', roughness: 0.08 },
  { id: 'oven-glass', name: 'Oven glass & steel', category: 'solid', color: '#1d1f22', roughness: 0.15, metalness: 0.3 },
  { id: 'granite-composite-black', name: 'Black granite composite', category: 'stone', color: '#2a2a2b', roughness: 0.6, pattern: { id: 'granite', scale: 0.25, contrast: 0.35 } },
  { id: 'fireclay-white', name: 'White fireclay', category: 'solid', color: '#f3f1ec', roughness: 0.25 },
  { id: 'stainless-sink', name: 'Brushed stainless sink', category: 'metal', color: '#c9ccce', roughness: 0.35, metalness: 1, pattern: { id: 'brushed', scale: 0.3, contrast: 0.4 } },
  { id: 'acrylic-gloss-white', name: 'White acrylic gloss', category: 'laminate', color: '#f4f4f2', roughness: 0.12 },
  { id: 'melamine-wood', name: 'Wood-grain melamine (MFC)', category: 'laminate', color: '#b58a5c', roughness: 0.55, pattern: { id: 'wood-grain', scale: 0.6, contrast: 0.6 } },
];

// ───────────── Items ─────────────

type Fin = [name: string, front: string, worktop: string, handle: string];
const FINISHES: Fin[] = [
  ['White matte & marble', 'laminate-white-matte', 'stone-marble-carrara', 'metal-brushed-steel'],
  ['Sage & quartz', 'laminate-sage', 'stone-quartz-white', 'metal-brass'],
  ['Navy & white quartz', 'laminate-navy', 'stone-quartz-white', 'metal-brass'],
  ['Oak & concrete', 'laminate-oak', 'laminate-grey', 'metal-black-matte'],
  ['Black & oak', 'laminate-black', 'wood-oak-natural', 'metal-black-matte'],
  ['Walnut & black granite', 'laminate-walnut', 'stone-granite', 'metal-black-matte'],
  ['Wood melamine & granite', 'melamine-wood', 'stone-granite', 'metal-brushed-steel'],
  ['White gloss acrylic', 'acrylic-gloss-white', 'stone-quartz-white', 'metal-chrome'],
];

interface CounterSpec {
  id: string;
  name: string;
  style: CounterStyle;
  size: Size3;
  min: Size3;
  max: Size3;
  group?: 'Counters & cabinets' | 'Kitchen cabinets' | 'Sinks';
  /** Room the item is listed under (default kitchen). */
  category?: 'kitchen' | 'laundry';
  tags: string[];
  description: string;
  fourth?: [id: 'sink' | 'appliance', label: string, material: string];
  finishes?: Fin[];
}

const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function counter(p: CounterSpec): PackItem {
  const fins = p.finishes ?? FINISHES;
  const [first, ...rest] = fins;
  return defineItem({
    id: p.id,
    name: p.name,
    category: p.category ?? 'kitchen',
    type: p.group === 'Sinks' ? 'plumbing' : 'surfaces',
    group: p.group ?? 'Counters & cabinets',
    tags: ['kitchen', 'counter', 'cabinet', 'worktop', 'tủ bếp', ...p.tags],
    description: p.description,
    defaultSize: p.size,
    minSize: p.min,
    maxSize: p.max,
    wallSnap: !p.style.overhang,
    slots: [
      matSlot('front', p.style.masonry ? 'Doors' : 'Fronts & carcass', first[1]),
      matSlot('worktop', p.style.masonry ? 'Worktop & tiles' : 'Worktop', first[2]),
      matSlot('handle', p.style.tap ? 'Handles & tap' : 'Handles', first[3]),
      ...(p.fourth ? [matSlot(p.fourth[0], p.fourth[1], p.fourth[2])] : []),
    ],
    variants: rest.map(([name, f, w, h]) => ({ id: slug(name), name, materials: { front: f, worktop: w, handle: h } })),
    build: (size) => counterParts(size, p.style),
    planDetail: (size) => counterPlan(size, p.style),
  });
}

const S = (w: number, d: number, h: number): Size3 => ({ w, d, h });
const unit = (w: number, minW: number, maxW: number) => ({ size: S(w, 0.6, 0.9), min: S(minW, 0.5, 0.8), max: S(maxW, 0.7, 0.96) });
const sinkUnit = (w: number, minW: number, maxW: number) => ({ size: S(w, 0.6, 0.9 + TAP_H), min: S(minW, 0.5, 0.8 + TAP_H), max: S(maxW, 0.7, 0.96 + TAP_H) });
const SINK: ['sink', string, string] = ['sink', 'Sink', 'stainless-sink'];
const HOB: ['appliance', string, string] = ['appliance', 'Hob glass', 'hob-glass'];
const OVEN: ['appliance', string, string] = ['appliance', 'Oven front', 'oven-glass'];
const VN_MASONRY: Fin[] = [
  ['White tiles & granite', 'laminate-white-matte', 'tile-white-square', 'metal-brushed-steel'],
  ['Green subway & oak doors', 'laminate-oak', 'tile-subway-green', 'metal-brushed-steel'],
  ['Cement tiles & sage doors', 'laminate-sage', 'tile-cement-classic', 'metal-brass'],
  ['Terrazzo & white doors', 'laminate-white-gloss', 'tile-terrazzo', 'metal-chrome'],
];

// ───────────── Straight Sage & Cream Shaker Kitchen Run (run-240-sink-hob) ─────────────

const SHAKER_TOP_T = 0.03;
const SHAKER_FRONT_T = 0.02;
const SHAKER_TAB_ROOM = 0.012;
const SHAKER_KNOB_ROOM = 0.03;
const HOB_OUTER_MARGIN = 0.2;

const RUN_FRONT = matSlot('front', 'Base cabinets', 'sage-shaker-kitchen:sage-lacquer');
const RUN_UPPER = matSlot('upper', 'Upper cabinets', 'sage-shaker-kitchen:cream-lacquer');
const RUN_WORKTOP = matSlot('worktop', 'Worktop & waterfall ends', 'sage-shaker-kitchen:terrazzo-white');
const RUN_TILE = matSlot('tile', 'Splashback tiles', 'sage-shaker-kitchen:mint-stack-tile');

const RUN_BASE_FIXTURE_SLOTS = [
  matSlot('pull', 'Leather tab pulls', 'sage-shaker-kitchen:leather-tab'),
  matSlot('appliance', 'Sink & slim hood', 'metal-black-matte'),
  matSlot('hob', 'Induction hob glass', 'screen-black'),
  matSlot('shield', 'Splatter guard frosted glass', 'sage-shaker-kitchen:tempered-glass'),
  matSlot('shieldBase', 'Splatter guard white mount', 'sage-shaker-kitchen:shield-base-white'),
  matSlot('steel', 'Spring tap & trim', 'metal-brushed-steel'),
  matSlot('brass', 'Knobs & rivets', 'metal-brass'),
];

const RUN_UPPER_CLEAN_SLOTS = [
  ...RUN_BASE_FIXTURE_SLOTS,
  matSlot('glass', 'Reeded glass', 'sage-shaker-kitchen:reeded-glass'),
  matSlot('glow', 'Under-cabinet & hood LED', 'sage-shaker-kitchen:shelf-led'),
];

const RUN_VARIANTS: AssetPresetVariant[] = [
  {
    id: 'warm-cream',
    name: 'All warm cream & subway tile',
    materials: {
      front: 'sage-shaker-kitchen:cream-lacquer',
      upper: 'sage-shaker-kitchen:cream-lacquer',
      worktop: 'sage-shaker-kitchen:terrazzo-white',
      tile: 'tile-subway-white',
    },
  },
  {
    id: 'forest-marble',
    name: 'Forest green & Carrara marble',
    materials: {
      front: 'paint-forest',
      upper: 'sage-shaker-kitchen:cream-lacquer',
      worktop: 'stone-marble-carrara',
      tile: 'tile-subway-white',
    },
  },
  {
    id: 'dusty-blue',
    name: 'Dusty blue & cream',
    materials: {
      front: 'paint-dusty-blue',
      upper: 'sage-shaker-kitchen:cream-lacquer',
      worktop: 'sage-shaker-kitchen:terrazzo-white',
      tile: 'tile-white-square',
    },
  },
  {
    id: 'oak-cream',
    name: 'Warm oak & cream',
    materials: {
      front: 'sage-shaker-kitchen:bar-oak',
      upper: 'sage-shaker-kitchen:cream-lacquer',
      worktop: 'sage-shaker-kitchen:terrazzo-white',
      tile: 'sage-shaker-kitchen:mint-stack-tile',
    },
  },
];

const numParam = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

interface Run240Geo {
  w: number;
  d: number;
  h: number;
  yw: number;
  uDrop: number;
  upperD: number;
  yUpper0: number;
  yUpperTop: number;
  xStart: number;
  xEnd: number;
  prep: V2;
  sink: V2;
  hob: V2;
  hobGlassX: V2;
  holeX: V2;
  holeZ: V2;
}

function run240Geo({ w, d, h }: Size3, params?: ParamValues): Run240Geo {
  const yw = clamp(numParam(params?.worktopHeight, 0.89), Math.min(0.8, h * 0.45), Math.min(0.96, h - 0.55));
  const uDrop = clamp(
    numParam(params?.upperDrop, 0.56),
    Math.min(0.45, Math.max(0.18, (h - yw) * 0.45)),
    Math.min(0.72, Math.max(0.2, h - yw - 0.35)),
  );
  const endPier = params?.endPier === true;
  const endW = endPier ? Math.min(0.36, Math.max(0.18, w * 0.12)) : 0.035;
  const upperD = Math.min(0.35, d - 0.12);

  const yUpper0 = yw + uDrop;
  const yUpperTop = h;

  const xStart = -w / 2 + 0.035;
  const xEnd = w / 2 - endW;
  const runLen = Math.max(0.9, xEnd - xStart);

  const hobW = clamp(runLen * 0.34, 0.64, 0.9);
  const sinkW = clamp((runLen - hobW) * 0.54, 0.58, 0.94);
  const prepW = Math.max(0.24, runLen - hobW - sinkW);
  const prep: V2 = [xStart, xStart + prepW];
  const sink: V2 = [prep[1], xEnd - hobW];
  const hob: V2 = [xEnd - hobW, xEnd];

  const hobX1 = Math.min(w / 2 - HOB_OUTER_MARGIN, xEnd - 0.03);
  const rightPad = hob[1] - hobX1;
  const hobSpan = hob[1] - hob[0];
  const maxAvailX = Math.max(0.28, hobX1 - (hob[0] + 0.03));
  const hobLenX = clamp(Math.max(hobSpan - 2 * rightPad, 0.42), 0.28, Math.min(0.62, maxAvailX));
  const hobGlassX: V2 = [hobX1 - hobLenX, hobX1];

  const sinkSpan = sink[1] - sink[0];
  const sinkHoleW = clamp(sinkSpan - 0.14, 0.44, 0.78);
  const sinkCenter = (sink[0] + sink[1]) / 2;
  const holeX: V2 = [sinkCenter - sinkHoleW / 2, sinkCenter + sinkHoleW / 2];
  const holeZ: V2 = [-d / 2 + 0.125, d / 2 - 0.075];

  return {
    w,
    d,
    h,
    yw,
    uDrop,
    upperD,
    yUpper0,
    yUpperTop,
    xStart,
    xEnd,
    prep,
    sink,
    hob,
    hobGlassX,
    holeX,
    holeZ,
  };
}

function run240Params(): AssetParam[] {
  return [
    {
      id: 'worktopHeight',
      label: 'Worktop height',
      kind: 'length',
      default: 0.89,
      min: 0.8,
      max: 0.96,
      step: 0.01,
      handle: (size, p) => {
        const g = run240Geo(size, p);
        return { at: [0, g.yw, size.d / 2 + 0.01], dir: [0, 1, 0] };
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
        const g = run240Geo(size, p);
        return { at: [(g.sink[0] + g.sink[1]) / 2, g.yUpper0, -size.d / 2 + g.upperD + 0.01], dir: [0, 1, 0] };
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

function splitDoors(a: number, b: number, count: number): V2[] {
  const n = Math.max(1, count);
  const step = (b - a) / n;
  const gap = 0.002;
  return range(n).map((i) => [a + i * step + gap, a + (i + 1) * step - gap] as V2);
}

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

function shakerFramesOnlyZ(slot: string, doors: V2[], yRange: V2, zFace: number): Part[] {
  const out: Part[] = [];
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

function shakerDrawersZ(slot: string, xRange: V2, yRange: V2, zFace: number): Part[] {
  const x0 = xRange[0] + 0.002;
  const x1 = xRange[1] - 0.002;
  const out: Part[] = [];
  for (const [ry0, ry1] of drawerRows(yRange)) {
    const r = clamp(Math.min(x1 - x0, ry1 - ry0) * 0.24, 0.032, 0.052);
    out.push(
      span(slot, [x0 + r, x1 - r], [ry0 + r, ry1 - r], [zFace - SHAKER_FRONT_T, zFace - 0.006], o),
      span(slot, [x0, x1], [ry1 - r, ry1], [zFace - SHAKER_FRONT_T, zFace], o),
      span(slot, [x0, x1], [ry0, ry0 + r], [zFace - SHAKER_FRONT_T, zFace], o),
      span(slot, [x0, x0 + r], [ry0 + r, ry1 - r], [zFace - SHAKER_FRONT_T, zFace], o),
      span(slot, [x1 - r, x1], [ry0 + r, ry1 - r], [zFace - SHAKER_FRONT_T, zFace], o),
    );
  }
  return out;
}

function leatherTabZ(x: number, yTop: number, zFace: number, len = 0.072): Part[] {
  const t = 0.005;
  return [
    span('pull', [x - 0.012, x + 0.012], [yTop - len, yTop], [zFace + 0.0005, zFace + 0.0005 + t], { ...o, bevel: 0.002 }),
    sphere('brass', [x, yTop - 0.012, zFace + 0.0005 + t + 0.0025], 0.0035, o),
  ];
}

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

const brassKnobZ = (x: number, y: number, zFace: number): Part => sphere('brass', [x, y, zFace + 0.011], 0.01, o);

function panelZY(slot: string, pts: V2[], xc: number, t: number): Part {
  const zs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  return {
    shape: 'prism',
    outline: pts.map(([z, y]) => [z - cz, -(y - cy)] as V2),
    height: t,
    position: [xc + t / 2, cy, cz],
    rotation: [Math.PI / 2, 0, Math.PI / 2],
    slot,
    plan: false,
  };
}

function buildRun240Shell(size: Size3, params?: ParamValues): Part[] {
  const g = run240Geo(size, params);
  const { w, d, yw, yUpper0, yUpperTop, upperD, xStart, xEnd, prep, sink, hob, holeX, holeZ } = g;
  const parts: Part[] = [];

  const yBaseTop = yw - SHAKER_TOP_T;
  const yFrontRange: V2 = [PLINTH + 0.004, yBaseTop - 0.004];
  const zFrontFace = d / 2 - SHAKER_TAB_ROOM;
  const zUFace = -d / 2 + upperD - SHAKER_KNOB_ROOM;
  const underSink = yw - 0.22;

  // 1. Base carcasses (stopping below sink bowls in the sink bay), recessed plinth & Shaker fronts.
  parts.push(
    span('front', [xStart + 0.001, sink[0]], [PLINTH, yBaseTop - 0.001], [-d / 2 + 0.002, zFrontFace - SHAKER_FRONT_T]),
    span('front', [sink[0], sink[1]], [PLINTH, underSink], [-d / 2 + 0.002, zFrontFace - SHAKER_FRONT_T], o),
    span('front', [sink[1], xEnd - 0.001], [PLINTH, yBaseTop - 0.001], [-d / 2 + 0.002, zFrontFace - SHAKER_FRONT_T]),
    span('front', [xStart + 0.002, xEnd - 0.002], [0.001, PLINTH - 0.001], [-d / 2 + 0.002, zFrontFace - SHAKER_FRONT_T - 0.045], o),
  );

  const prepDoorCount = clamp(Math.round((prep[1] - prep[0]) / 0.52), 1, 3);
  const preHobDoors: V2[] = [
    ...splitDoors(prep[0], prep[1], prepDoorCount),
    ...splitDoors(sink[0], sink[1], sink[1] - sink[0] >= 0.56 ? 2 : 1),
  ];
  parts.push(
    span(
      'front',
      [xStart + 0.003, hob[0] - 0.003],
      [PLINTH + 0.006, yBaseTop - 0.006],
      [zFrontFace - SHAKER_FRONT_T, zFrontFace - 0.006],
      o,
    ),
    ...shakerFramesOnlyZ('front', preHobDoors, yFrontRange, zFrontFace),
    ...shakerDrawersZ('front', hob, yFrontRange, zFrontFace),
  );

  // 2. White terrazzo worktop (with double-sink cut-out) and waterfall ends.
  parts.push(
    span('worktop', [-w / 2, holeX[0]], [yBaseTop, yw], [-d / 2, d / 2], { bevel: 0.002 }),
    span('worktop', [holeX[1], w / 2], [yBaseTop, yw], [-d / 2, d / 2], { bevel: 0.002 }),
    span('worktop', holeX, [yBaseTop, yw], [-d / 2, holeZ[0]], { bevel: 0.002 }),
    span('worktop', holeX, [yBaseTop, yw], [holeZ[1], d / 2], { bevel: 0.002 }),
    span('worktop', [-w / 2, xStart], [0, yBaseTop], [-d / 2, d / 2], { bevel: 0.002, plan: false }),
    span('worktop', [xEnd, w / 2], [0, yBaseTop], [-d / 2, d / 2], { bevel: 0.002, plan: false }),
  );

  // 3. Pale mint vertical stack-bond splashback along the back wall.
  parts.push(span('tile', [-w / 2, w / 2], [yw + 0.001, yUpper0 - 0.001], [-d / 2, -d / 2 + 0.012], o));

  // 4. Warm cream shaker upper cabinets: left solid bay, central reeded-glass sink bay, right raised hood bay.
  const leftUpperCount = clamp(Math.round((sink[0] - -w / 2) / 0.52), 1, 3);
  const hobUpperCount = w / 2 - hob[0] >= 0.56 ? 2 : 1;
  const leftUpperDoors = splitDoors(-w / 2 + 0.002, sink[0], leftUpperCount);
  parts.push(
    span('upper', [-w / 2 + 0.001, sink[0]], [yUpper0, yUpperTop], [-d / 2 + 0.001, zUFace - SHAKER_FRONT_T], o),
    span(
      'upper',
      [-w / 2 + 0.005, sink[0] - 0.004],
      [yUpper0 + 0.005, yUpperTop - 0.005],
      [zUFace - SHAKER_FRONT_T, zUFace - 0.006],
      o,
    ),
    ...shakerFramesOnlyZ('upper', leftUpperDoors, [yUpper0 + 0.004, yUpperTop - 0.004], zUFace),
  );

  const tBox = 0.018;
  const yGlassMid = (yUpper0 + yUpperTop) / 2;
  const gRail = clamp((yUpperTop - yUpper0) * 0.075, 0.036, 0.052);
  const sx0 = sink[0] + 0.002;
  const sx1 = sink[1] - 0.002;
  parts.push(
    span('upper', [sink[0], sink[1]], [yUpper0, yUpper0 + tBox], [-d / 2 + 0.001, zUFace - SHAKER_FRONT_T], o),
    span('upper', [sink[0], sink[1]], [yUpperTop - tBox, yUpperTop], [-d / 2 + 0.001, zUFace - SHAKER_FRONT_T], o),
    span('upper', [sink[0] + tBox, sink[1] - tBox], [yGlassMid - tBox / 2, yGlassMid + tBox / 2], [-d / 2 + 0.001, zUFace - SHAKER_FRONT_T], o),
    span('upper', [sink[0], sink[0] + tBox], [yUpper0 + tBox, yUpperTop - tBox], [-d / 2 + 0.001, zUFace - SHAKER_FRONT_T], o),
    span('upper', [sink[1] - tBox, sink[1]], [yUpper0 + tBox, yUpperTop - tBox], [-d / 2 + 0.001, zUFace - SHAKER_FRONT_T], o),
    span('upper', [sink[0] + tBox, sink[1] - tBox], [yUpper0 + tBox, yUpperTop - tBox], [-d / 2 + 0.001, -d / 2 + 0.011], o),
  );
  for (const [gy0, gy1] of [
    [yUpper0 + 0.004, yGlassMid - 0.002],
    [yGlassMid + 0.002, yUpperTop - 0.004],
  ] as V2[]) {
    parts.push(
      span('upper', [sx0, sx1], [gy1 - gRail, gy1], [zUFace - SHAKER_FRONT_T, zUFace], o),
      span('upper', [sx0, sx1], [gy0, gy0 + gRail], [zUFace - SHAKER_FRONT_T, zUFace], o),
      span('upper', [sx0, sx0 + gRail], [gy0 + gRail, gy1 - gRail], [zUFace - SHAKER_FRONT_T, zUFace], o),
      span('upper', [sx1 - gRail, sx1], [gy0 + gRail, gy1 - gRail], [zUFace - SHAKER_FRONT_T, zUFace], o),
    );
  }

  const yHobUpper0 = yUpper0 + 0.048;
  const hobUpperDoors = splitDoors(hob[0], w / 2 - 0.002, hobUpperCount);
  parts.push(
    span('upper', [hob[0], w / 2 - 0.001], [yHobUpper0, yUpperTop], [-d / 2 + 0.001, zUFace - SHAKER_FRONT_T], o),
    span(
      'upper',
      [hob[0] + 0.004, w / 2 - 0.005],
      [yHobUpper0 + 0.005, yUpperTop - 0.005],
      [zUFace - SHAKER_FRONT_T, zUFace - 0.006],
      o,
    ),
    ...shakerFramesOnlyZ('upper', hobUpperDoors, [yHobUpper0 + 0.004, yUpperTop - 0.004], zUFace),
  );

  return parts;
}

function buildRun240Fixtures(size: Size3, params: ParamValues | undefined, opts: { withUppers: boolean }): Part[] {
  const g = run240Geo(size, params);
  const { w, d, yw, yUpper0, yUpperTop, upperD, prep, sink, hob, hobGlassX, holeX, holeZ } = g;
  const out: Part[] = [];

  const yBaseTop = yw - SHAKER_TOP_T;
  const yFrontRange: V2 = [PLINTH + 0.004, yBaseTop - 0.004];
  const zFrontFace = d / 2 - SHAKER_TAB_ROOM;
  const zUFace = -d / 2 + upperD - SHAKER_KNOB_ROOM;

  // 1. Leather tab pulls on hinged doors and centred horizontal leather strap pulls on the 3-drawer hob unit.
  const tabY = yBaseTop - 0.036;
  const addBaseTabs = (rangeX: V2, count: number) => {
    const ds = splitDoors(rangeX[0], rangeX[1], count);
    ds.forEach(([x0, x1], i) => {
      const tx = ds.length > 1 && i % 2 === 0 && i + 1 < ds.length ? x1 - 0.035 : x0 + 0.035;
      out.push(...leatherTabZ(tx, tabY, zFrontFace));
    });
  };
  addBaseTabs(prep, clamp(Math.round((prep[1] - prep[0]) / 0.52), 1, 3));
  addBaseTabs(sink, sink[1] - sink[0] >= 0.56 ? 2 : 1);
  const hobCenterX = (hob[0] + hob[1]) / 2;
  for (const [, ry1] of drawerRows(yFrontRange)) {
    out.push(...drawerPullZ(hobCenterX, ry1, zFrontFace));
  }

  // 2. Upper cabinet brass knobs, reeded glass panes & under-cabinet LED strip.
  if (opts.withUppers) {
    const leftUpperCount = clamp(Math.round((sink[0] - -w / 2) / 0.52), 1, 3);
    const hobUpperCount = w / 2 - hob[0] >= 0.56 ? 2 : 1;
    const addKnobsZ = (rangeX: V2, count: number, ky: number) => {
      const ds = splitDoors(rangeX[0], rangeX[1], count);
      ds.forEach(([x0, x1], i) => {
        const kx = ds.length > 1 && i % 2 === 0 && i + 1 < ds.length ? x1 - 0.035 : x0 + 0.035;
        out.push(brassKnobZ(kx, ky, zUFace));
      });
    };
    addKnobsZ([-w / 2 + 0.002, sink[0]], leftUpperCount, yUpper0 + 0.065);
    addKnobsZ([hob[0], w / 2 - 0.002], hobUpperCount, yUpper0 + 0.11);

    const yGlassMid = (yUpper0 + yUpperTop) / 2;
    const gRail = clamp((yUpperTop - yUpper0) * 0.075, 0.036, 0.052);
    for (const [gy0, gy1] of [
      [yUpper0 + 0.004, yGlassMid - 0.002],
      [yGlassMid + 0.002, yUpperTop - 0.004],
    ] as V2[]) {
      out.push(
        span(
          'glass',
          [sink[0] + gRail - 0.002, sink[1] - gRail + 0.002],
          [gy0 + gRail - 0.003, gy1 - gRail + 0.003],
          [zUFace - SHAKER_FRONT_T + 0.007, zUFace - SHAKER_FRONT_T + 0.013],
          o,
        ),
        brassKnobZ((sink[0] + sink[1]) / 2, gy0 + gRail * 0.5, zUFace),
      );
    }

    out.push(
      span('glow', [-w / 2 + 0.04, hob[0] - 0.02], [yUpper0 - 0.005, yUpper0 - 0.001], [-d / 2 + upperD - 0.07, -d / 2 + upperD - 0.05], o),
    );
  }

  // 3. Undermount matte-black double sink + brushed-steel pull-down spring faucet.
  const xBowlMid = (holeX[0] + holeX[1]) / 2;
  const sinkFloor = yw - 0.195;
  const sinkTop = yBaseTop - 0.001;
  out.push(
    span('appliance', [xBowlMid - 0.014, xBowlMid + 0.014], [sinkFloor, sinkTop], [holeZ[0] - 0.004, holeZ[1] + 0.004], o),
  );
  for (const [bx0, bx1] of [
    [holeX[0], xBowlMid - 0.014],
    [xBowlMid + 0.014, holeX[1]],
  ] as V2[]) {
    out.push(
      span('appliance', [bx0 - 0.004, bx1 + 0.004], [sinkFloor, sinkFloor + 0.006], [holeZ[0] - 0.004, holeZ[1] + 0.004], o),
      span('appliance', [bx0 - 0.005, bx0 + 0.001], [sinkFloor, sinkTop], holeZ, o),
      span('appliance', [bx1 - 0.001, bx1 + 0.005], [sinkFloor, sinkTop], holeZ, o),
      span('appliance', [bx0, bx1], [sinkFloor, sinkTop], [holeZ[0] - 0.005, holeZ[0] + 0.001], o),
      span('appliance', [bx0, bx1], [sinkFloor, sinkTop], [holeZ[1] - 0.001, holeZ[1] + 0.005], o),
      cyl('steel', [(bx0 + bx1) / 2, sinkFloor + 0.009, (holeZ[0] + holeZ[1]) / 2], 0.032, 0.004, o),
    );
  }

  const tapX = xBowlMid + 0.03;
  const tapZ = (-d / 2 + holeZ[0]) / 2;
  const tapY0 = yw + 0.001;
  const tapTop = Math.min(yw + 0.4, yUpper0 - 0.075);
  const reach = Math.min(0.19, (holeZ[0] + holeZ[1]) / 2 - tapZ);
  out.push(
    cyl('steel', [tapX, tapY0 + 0.014, tapZ], 0.026, 0.028, o),
    rod('steel', [tapX, tapY0 + 0.024, tapZ], [tapX, tapY0 + 0.1, tapZ], 0.015, o),
    rod('steel', [tapX + 0.01, tapY0 + 0.08, tapZ], [tapX + 0.06, tapY0 + 0.11, tapZ], 0.005, o),
    rod('steel', [tapX, tapY0 + 0.1, tapZ], [tapX, tapTop, tapZ], 0.0065, o),
  );
  const springCount = 9;
  const springStep = Math.max(0.012, (tapTop - (tapY0 + 0.13)) / (springCount + 1));
  for (const i of range(springCount)) {
    out.push(torus('steel', [tapX, tapY0 + 0.13 + i * springStep, tapZ], 0.015, 0.0028, { ...o, rotation: [Math.PI / 2, 0, 0] }));
  }
  const tapArc: V3[] = range(6).map((i) => {
    const a = (i / 5) * Math.PI;
    return [tapX, tapTop + Math.sin(a) * 0.045, tapZ + (1 - Math.cos(a)) * (reach / 2)];
  });
  for (let i = 0; i < tapArc.length - 1; i++) out.push(rod('steel', tapArc[i], tapArc[i + 1], 0.0065, o));
  const spoutEnd = tapArc[tapArc.length - 1];
  out.push(
    rod('steel', spoutEnd, [spoutEnd[0], spoutEnd[1] - 0.11, spoutEnd[2]], 0.01, o),
    cyl('steel', [spoutEnd[0], spoutEnd[1] - 0.125, spoutEnd[2]], 0.016, 0.028, o),
  );

  // 4. Black glass induction hob + slim matte-black under-cabinet extractor hood.
  const hobLenX = hobGlassX[1] - hobGlassX[0];
  const hobMidX = (hobGlassX[0] + hobGlassX[1]) / 2;
  const hz0 = -d / 2 + 0.07;
  const hz1 = d / 2 - 0.07;
  const hzc = (hz0 + hz1) / 2;
  const rSmall = Math.min(0.085, hobLenX * 0.19, (hz1 - hz0) * 0.26);
  const rLarge = Math.min(0.095, hobLenX * 0.21, (hz1 - hz0) * 0.28);
  const ctrlHalf = Math.min(0.07, hobLenX * 0.25);
  out.push(
    span('hob', hobGlassX, [yw + 0.001, yw + 0.006], [hz0, hz1], o),
    torus('steel', [hobMidX - hobLenX * 0.24, yw + 0.0072, hzc - 0.015], rSmall, 0.0015, { ...o, rotation: [Math.PI / 2, 0, 0] }),
    torus('steel', [hobMidX + hobLenX * 0.24, yw + 0.0072, hzc + 0.015], rLarge, 0.0015, { ...o, rotation: [Math.PI / 2, 0, 0] }),
    span('steel', [hobMidX - ctrlHalf, hobMidX + ctrlHalf], [yw + 0.0065, yw + 0.0078], [hz1 - 0.036, hz1 - 0.03], o),
  );

  if (opts.withUppers) {
    const hoodZ0 = -d / 2 + 0.002;
    const hoodZ1 = -d / 2 + Math.min(0.49, d - 0.05);
    const hoodY0 = yUpper0 - 0.052;
    const hoodY1 = yUpper0 + 0.045;
    const hoodX: V2 = [hob[0] + 0.003, w / 2 - 0.003];
    const hoodMidX = (hoodX[0] + hoodX[1]) / 2;
    const visorRun = 0.085;
    const visorLip = hoodY0 + 0.034;
    const visorSlope = Math.atan2(visorRun, hoodY1 - visorLip);
    const visorLen = Math.hypot(visorRun, hoodY1 - visorLip);
    out.push(
      span('appliance', hoodX, [visorLip, hoodY1], [hoodZ0, hoodZ1 - visorRun], o),
      span('appliance', hoodX, [hoodY0, visorLip], [hoodZ1 - 0.095, hoodZ1], o),
      box('appliance', [hoodMidX, (visorLip + hoodY1) / 2, hoodZ1 - visorRun / 2], [hoodX[1] - hoodX[0], visorLen, 0.012], {
        ...o,
        rotation: [-visorSlope, 0, 0],
      }),
      span('steel', [hoodX[0] + 0.05, hoodX[1] - 0.05], [visorLip - 0.004, visorLip - 0.001], [hoodZ0 + 0.03, hoodZ1 - 0.12], o),
      span('glow', [hoodX[0] + 0.09, hoodX[1] - 0.09], [visorLip - 0.005, visorLip - 0.0015], [hoodZ1 - 0.115, hoodZ1 - 0.095], o),
    );
  }

  // 5. Top-chamfered frosted glass splatter shields in white base shoes at BOTH open ends of the counter,
  // rising flush to the top of the splashback tiles / underside of the upper cabinets (yUpper0 - 1 mm).
  const yGlass0 = yw + 0.007;
  const yShieldTop = yUpper0 - 0.001;
  const shieldH = yShieldTop - yw;
  const rzWall = -d / 2 + 0.014;
  const rzFront = d / 2 - 0.014;
  const glassW = rzFront - rzWall;
  const chamfer = clamp(Math.min(glassW - Math.max(0, upperD - 0.014), glassW * 0.28, shieldH * 0.3), 0.09, 0.165);
  const shieldOutline: V2[] = [
    [rzWall, yGlass0],
    [rzFront, yGlass0],
    [rzFront, yShieldTop - chamfer],
    [rzFront - chamfer, yShieldTop],
    [rzWall, yShieldTop],
  ];

  out.push(
    // Left open end (-w/2): white base shoe + 8 mm frosted glass chamfered on the top-front corner.
    span('shieldBase', [-w / 2 + 0.004, -w / 2 + 0.018], [yw + 0.001, yw + 0.015], [rzWall - 0.001, rzFront + 0.003], {
      ...o,
      bevel: 0.002,
    }),
    panelZY('shield', shieldOutline, -w / 2 + 0.011, 0.008),
    // Right open end (+w/2): matching white base shoe + 8 mm frosted glass chamfered on the top-front corner.
    span('shieldBase', [w / 2 - 0.018, w / 2 - 0.004], [yw + 0.001, yw + 0.015], [rzWall - 0.001, rzFront + 0.003], {
      ...o,
      bevel: 0.002,
    }),
    panelZY('shield', shieldOutline, w / 2 - 0.019, 0.008),
  );

  return out;
}

function run240PlanDetail(size: Size3, params?: ParamValues): PlanStroke[] {
  const g = run240Geo(size, params);
  const { w, d, holeX, holeZ, hobGlassX } = g;
  const xBowlMid = (holeX[0] + holeX[1]) / 2;
  const hobLenX = hobGlassX[1] - hobGlassX[0];
  const hobMidX = (hobGlassX[0] + hobGlassX[1]) / 2;
  const hz0 = -d / 2 + 0.07;
  const hz1 = d / 2 - 0.07;
  const hzc = (hz0 + hz1) / 2;
  const rSmall = Math.min(0.08, hobLenX * 0.18, (hz1 - hz0) * 0.24);
  const rLarge = Math.min(0.09, hobLenX * 0.2, (hz1 - hz0) * 0.26);

  return [
    // Double sink bowls & drains.
    {
      kind: 'poly',
      closed: true,
      points: [
        [holeX[0], holeZ[0]],
        [xBowlMid - 0.014, holeZ[0]],
        [xBowlMid - 0.014, holeZ[1]],
        [holeX[0], holeZ[1]],
      ],
    },
    {
      kind: 'poly',
      closed: true,
      points: [
        [xBowlMid + 0.014, holeZ[0]],
        [holeX[1], holeZ[0]],
        [holeX[1], holeZ[1]],
        [xBowlMid + 0.014, holeZ[1]],
      ],
    },
    { kind: 'circle', c: [(holeX[0] + xBowlMid - 0.014) / 2, (holeZ[0] + holeZ[1]) / 2], r: 0.028 },
    { kind: 'circle', c: [(xBowlMid + 0.014 + holeX[1]) / 2, (holeZ[0] + holeZ[1]) / 2], r: 0.028 },
    // Induction hob & cooking zones.
    {
      kind: 'poly',
      closed: true,
      points: [
        [hobGlassX[0], hz0],
        [hobGlassX[1], hz0],
        [hobGlassX[1], hz1],
        [hobGlassX[0], hz1],
      ],
    },
    { kind: 'circle', c: [hobMidX - hobLenX * 0.24, hzc - 0.015], r: rSmall },
    { kind: 'circle', c: [hobMidX + hobLenX * 0.24, hzc + 0.015], r: rLarge },
    // Frosted glass splatter shields on both open ends of the counter in plan.
    { kind: 'line', a: [-w / 2 + 0.011, -d / 2 + 0.014], b: [-w / 2 + 0.011, d / 2 - 0.014] },
    { kind: 'line', a: [w / 2 - 0.011, -d / 2 + 0.014], b: [w / 2 - 0.011, d / 2 - 0.014] },
  ];
}

const run240Models: AssetModelVariant[] = [
  {
    id: 'clean',
    name: 'With upper cabinets',
    slots: RUN_UPPER_CLEAN_SLOTS,
    props: (size, params) => buildRun240Fixtures(size, params, { withUppers: true }),
  },
  {
    id: 'no-uppers',
    name: 'No upper cabinets',
    hide: ['upper'],
    slots: RUN_BASE_FIXTURE_SLOTS,
    props: (size, params) => buildRun240Fixtures(size, params, { withUppers: false }),
  },
];

const run240SinkHob: PackItem = defineItem({
  id: 'run-240-sink-hob',
  name: 'Counter run 2.4 m with sink & hob',
  category: 'kitchen',
  type: 'surfaces',
  group: 'Counters & cabinets',
  tags: [
    'kitchen',
    'counter',
    'cabinet',
    'worktop',
    'tủ bếp',
    'counter run',
    'sink',
    'hob',
    'kitchen line',
    'sage',
    'shaker',
    'reeded glass',
    'splashback',
  ],
  description:
    'A straight sage & warm-cream shaker kitchen run with pale mint vertical stack-tile splashback, top-chamfered frosted glass splatter shields in white base shoes at both ends, an undermount double sink with pull-down spring tap, a 3-drawer induction hob bay, and cream shaker & reeded-glass upper cabinets with a slim black hood and LED strip.',
  defaultSize: S(2.8, 0.6, 2.22),
  minSize: S(1.8, 0.5, 1.95),
  maxSize: S(3.6, 0.72, 2.6),
  wallSnap: true,
  slots: [RUN_FRONT, RUN_UPPER, RUN_WORKTOP, RUN_TILE],
  variants: RUN_VARIANTS,
  models: run240Models,
  params: run240Params(),
  build: (size, params) => buildRun240Shell(size, params),
  planDetail: (size, params) => run240PlanDetail(size, params),
});

const items: PackItem[] = [
  // Single base units.
  counter({ id: 'base-doors-90', name: 'Base unit, two doors', style: { bays: [{ kind: 'doors', w: 1 }] }, ...unit(0.9, 0.6, 1.2), tags: ['base unit', 'double door', '90 cm'], description: 'A wide kitchen base unit with a pair of doors, 60–120 cm.' }),
  counter({ id: 'base-pan-drawers', name: 'Base unit, two pan drawers', style: { bays: [{ kind: 'drawers2', w: 1 }] }, ...unit(0.8, 0.5, 1.2), tags: ['pan drawers', 'deep drawers', 'pots'], description: 'A base unit with two deep pan drawers for pots and pans.' }),
  counter({ id: 'base-drawer-door', name: 'Base unit, drawer over door', style: { bays: [{ kind: 'drawer-door', w: 1 }] }, ...unit(0.5, 0.3, 0.6), tags: ['drawer', 'door', 'combo'], description: 'A base unit with a top drawer over a single door, the most common module.' }),
  counter({ id: 'base-pullout-narrow', name: 'Narrow pull-out base unit', style: { bays: [{ kind: 'pullout', w: 1 }] }, ...unit(0.2, 0.15, 0.3), tags: ['pull-out', 'bottle rack', 'spice pull-out', 'narrow'], description: 'A narrow 15–30 cm pull-out for bottles, oils and spices.' }),
  counter({ id: 'base-open-shelves', name: 'Open shelf base unit', style: { bays: [{ kind: 'open', w: 1 }] }, ...unit(0.4, 0.3, 0.9), tags: ['open shelf', 'end unit', 'cookbooks'], description: 'An open base unit with a middle shelf, for the end of a run or cookbooks.' }),
  counter({ id: 'base-oven-housing', name: 'Base unit with built-in oven', style: { bays: [{ kind: 'oven', w: 1 }] }, ...unit(0.6, 0.6, 0.6), tags: ['oven', 'built-in oven', 'under-counter oven'], description: 'A 60 cm housing with a built-in oven, its control strip and a drawer below.', fourth: OVEN }),
  counter({ id: 'base-dishwasher', name: 'Integrated dishwasher panel', style: { bays: [{ kind: 'dishwasher', w: 1 }] }, ...unit(0.6, 0.45, 0.6), tags: ['dishwasher', 'integrated', 'panel'], description: 'A fully integrated dishwasher behind a matching door panel, 45 or 60 cm.' }),
  counter({ id: 'base-hob-unit', name: 'Hob unit with pan drawers', style: { bays: [{ kind: 'hob', w: 1 }] }, ...unit(0.8, 0.6, 0.9), tags: ['hob', 'induction', 'cooktop', 'pan drawers'], description: 'A base unit with an induction hob set into the worktop and two pan drawers underneath.', fourth: HOB }),
  counter({ id: 'base-handleless-drawers', name: 'Handleless drawer unit', style: { bays: [{ kind: 'drawers3', w: 1 }], front: 'handleless' }, ...unit(0.8, 0.4, 1.2), tags: ['handleless', 'push to open', 'modern'], description: 'A modern handleless base unit with grip grooves above three drawers.' }),
  // Counter runs.
  counter({
    id: 'run-180-sink',
    name: 'Counter run 1.8 m with sink',
    style: { bays: [{ kind: 'drawer-door', w: 0.5 }, { kind: 'sink', w: 0.8 }, { kind: 'drawers3', w: 0.5 }], tap: true },
    ...sinkUnit(1.8, 1.5, 2.4),
    tags: ['counter run', 'sink', 'compact kitchen', 'apartment'],
    description: 'A compact 1.8 m counter for an apartment: drawers, an inset sink with a mixer tap, and a door unit.',
    fourth: SINK,
  }),
  run240SinkHob,
  counter({
    id: 'run-300-full',
    name: 'Counter run 3.0 m with oven, hob & sink',
    style: { bays: [{ kind: 'pullout', w: 0.3 }, { kind: 'oven', w: 0.6 }, { kind: 'drawers3', w: 0.6 }, { kind: 'sink2', w: 1.0 }, { kind: 'drawer-door', w: 0.5 }], tap: true, front: 'shaker', applianceSlot: 'sink' },
    ...sinkUnit(3.0, 2.6, 3.6),
    tags: ['counter run', 'double sink', 'oven', 'shaker', 'full kitchen'],
    description: 'A 3 m shaker kitchen run: spice pull-out, built-in stainless oven, drawers, a double-bowl sink with tap and a door unit.',
    fourth: ['sink', 'Sink & oven', 'stainless-sink'],
  }),
  counter({
    id: 'run-handleless-240',
    name: 'Handleless counter run 2.4 m',
    style: { bays: [{ kind: 'drawers3', w: 0.8 }, { kind: 'drawers2', w: 0.8 }, { kind: 'drawers3', w: 0.8 }], front: 'handleless' },
    ...unit(2.4, 1.8, 3.0),
    tags: ['counter run', 'handleless', 'drawers', 'modern'],
    description: 'A sleek 2.4 m handleless run of drawer units under one long worktop.',
  }),
  counter({
    id: 'masonry-counter-vn',
    name: 'Tiled masonry counter (bếp xây) with sink',
    style: { bays: [{ kind: 'doors', w: 0.9 }, { kind: 'sink-drainer', w: 1.0 }, { kind: 'doors', w: 0.9 }], masonry: true, tap: true },
    ...sinkUnit(2.4, 1.8, 3.2),
    tags: ['bếp xây', 'masonry', 'tiled counter', 'vietnamese kitchen', 'stainless sink', 'drainer'],
    description: 'A Vietnamese-style built masonry counter faced in tiles, with a stainless sink and drainer and cabinet doors below.',
    fourth: SINK,
    finishes: VN_MASONRY,
  }),
  // Islands and peninsulas.
  counter({
    id: 'island-sink-seating',
    name: 'Island with sink & seating overhang',
    style: { bays: [{ kind: 'drawers3', w: 0.6 }, { kind: 'sink', w: 0.8 }, { kind: 'doors', w: 0.6 }], tap: true, overhang: 0.3 },
    size: S(2.0, 1.0, 0.9 + TAP_H),
    min: S(1.6, 0.9, 0.8 + TAP_H),
    max: S(3.0, 1.2, 0.96 + TAP_H),
    tags: ['island', 'sink', 'breakfast bar', 'seating', 'overhang'],
    description: 'A kitchen island with an inset sink and tap, drawers and doors, and a 30 cm worktop overhang at the back for stools.',
    fourth: SINK,
  }),
  counter({
    id: 'island-hob',
    name: 'Island with hob',
    style: { bays: [{ kind: 'drawers3', w: 0.6 }, { kind: 'hob', w: 0.8 }, { kind: 'drawers3', w: 0.6 }], overhang: 0.25 },
    size: S(2.0, 1.0, 0.9),
    min: S(1.6, 0.9, 0.8),
    max: S(3.0, 1.2, 0.96),
    tags: ['island', 'hob', 'cooktop', 'cooking island'],
    description: 'A cooking island with an induction hob between drawer units and a back overhang (pair it with an island hood).',
    fourth: HOB,
  }),
  counter({
    id: 'peninsula-breakfast-bar',
    name: 'Peninsula with breakfast bar',
    style: { bays: [{ kind: 'doors', w: 0.6 }, { kind: 'drawers3', w: 0.6 }], overhang: 0.35 },
    size: S(1.4, 0.95, 0.9),
    min: S(1.0, 0.85, 0.8),
    max: S(2.2, 1.1, 0.96),
    tags: ['peninsula', 'breakfast bar', 'overhang', 'seating'],
    description: 'A peninsula counter with base units on the kitchen side and a 35 cm breakfast-bar overhang on the other.',
  }),
  // Sink units.
  counter({ id: 'sink-undermount-quartz', name: 'Undermount sink unit, quartz top', group: 'Sinks', style: { bays: [{ kind: 'sink', w: 1 }], tap: true, sink: 'undermount' }, ...sinkUnit(0.9, 0.7, 1.2), tags: ['sink', 'undermount', 'quartz', 'seamless'], description: 'A sink unit with a stainless bowl mounted under a quartz worktop for a clean edge.', fourth: SINK, finishes: [FINISHES[1], FINISHES[0], FINISHES[2], FINISHES[7]] }),
  counter({ id: 'sink-drainer-vn', name: 'Sink unit with drainer (chậu rửa 1 hố)', group: 'Sinks', style: { bays: [{ kind: 'sink-drainer', w: 1 }], tap: true }, ...sinkUnit(1.0, 0.8, 1.2), tags: ['sink', 'drainer', 'draining board', 'chậu rửa', 'stainless', 'vietnamese'], description: 'A stainless sink with a grooved draining board, very common in Vietnamese kitchens, on a two-door unit.', fourth: SINK }),
  counter({ id: 'sink-granite-black', name: 'Black granite composite sink unit', group: 'Sinks', style: { bays: [{ kind: 'sink', w: 1 }], tap: true }, ...sinkUnit(0.8, 0.6, 1.0), tags: ['sink', 'granite composite', 'black sink', 'modern'], description: 'A sink unit with a matte black granite-composite bowl and a black mixer tap.', fourth: ['sink', 'Sink', 'granite-composite-black'], finishes: [['Oak & concrete', 'laminate-oak', 'laminate-grey', 'metal-black-matte'], FINISHES[0], FINISHES[4], FINISHES[5]] }),
  counter({ id: 'sink-bar-prep-45', name: 'Bar / prep sink unit', group: 'Sinks', style: { bays: [{ kind: 'sink', w: 1 }], tap: true, sink: 'undermount' }, ...sinkUnit(0.45, 0.4, 0.6), tags: ['bar sink', 'prep sink', 'small sink', 'island'], description: 'A narrow 45 cm prep or bar sink with a small undermount bowl, for islands and bars.', fourth: SINK }),
  counter({ id: 'sink-laundry-counter', name: 'Laundry counter with deep sink', group: 'Sinks', category: 'laundry', style: { bays: [{ kind: 'sink', w: 0.7 }, { kind: 'open', w: 0.6 }], tap: true }, ...sinkUnit(1.3, 1.0, 1.8), tags: ['laundry', 'utility', 'deep sink', 'open shelf', 'washing machine space'], description: 'A laundry counter with a deep sink unit and an open bay beside it for baskets or a washing machine.', fourth: SINK }),
];

export default definePack({
  name: 'Kitchen counters',
  version: '1.0.0',
  author: 'Neest',
  description: 'Kitchen base units, counter runs, islands and sink units at standard module sizes.',
  license: 'CC0-1.0',
  materials,
  items,
});

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
  cyl,
  defineItem,
  definePack,
  matSlot,
  range,
  rod,
  span,
  type PackItem,
  type PackMaterial,
  type Part,
  type PlanStroke,
  type Size3,
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
  counter({
    id: 'run-240-sink-hob',
    name: 'Counter run 2.4 m with sink & hob',
    style: { bays: [{ kind: 'drawers3', w: 0.6 }, { kind: 'sink', w: 0.8 }, { kind: 'dishwasher', w: 0.6 }, { kind: 'hob', w: 0.8 }], tap: true, applianceSlot: 'sink' },
    ...sinkUnit(2.8, 2.2, 3.4),
    tags: ['counter run', 'sink', 'hob', 'dishwasher', 'kitchen line'],
    description: 'A 2.8 m kitchen line: drawers, an inset sink with tap, an integrated dishwasher and a stainless hob over pan drawers.',
    fourth: ['sink', 'Sink & hob', 'stainless-sink'],
  }),
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

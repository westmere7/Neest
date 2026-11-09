/**
 * Arch-groove shoe cabinet: a tall entry cabinet with cream doors carrying routed grooves (pill-shaped
 * on the upper doors, arch-topped on the lower ones) and round black knobs, an open oak niche with an
 * LED strip under its top and a vertical oak fin, and an open gap underneath for everyday shoes.
 * Everything is a shape setting: the shoe gap, the niche's height and position, doors per row, the
 * groove inset, the fin and whether the sides run down to the floor.
 */
import {
  clamp,
  defineItem,
  definePack,
  knob,
  line,
  matSlot,
  range,
  span,
  sphere,
  type AssetParam,
  type ParamValues,
  type Part,
  type PlanStroke,
  type Size3,
} from '@/packs/kit';

type V2 = [number, number];

/** Carcass board, door thickness, gap round the doors, the knobs' room in front of the doors. */
const T = 0.018;
const DT = 0.02;
const GAP = 0.003;
const KNOB_ROOM = 0.03;
/** Routed groove: depth and width. */
const GD = 0.006;
const GW = 0.012;
/** Back panel and the niche's oak lining. */
const BACK = 0.006;
const LINE = 0.008;

/** A flat panel in the x/y plane from an outline, `t` thick from z0 towards the front. */
function panelXY(slot: string, pts: V2[], z0: number, t: number, plan = false): Part {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  return {
    shape: 'prism',
    outline: pts.map(([x, y]) => [x - cx, -(y - cy)] as V2),
    height: t,
    position: [cx, cy, z0],
    rotation: [Math.PI / 2, 0, 0],
    slot,
    plan,
  };
}

/** Points on a circular arc (centre cx, cy) from angle a0 to a1, both ends included. */
const arc = (cx: number, cy: number, r: number, a0: number, a1: number, n = 14): V2[] =>
  range(n + 1).map((i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as V2;
  });

/** Drops points that repeat the one before (and a last that repeats the first). */
function dedupe(pts: V2[]): V2[] {
  const out: V2[] = [];
  for (const p of pts) {
    const q = out[out.length - 1];
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-5) out.push(p);
  }
  if (out.length > 2 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) < 1e-5) out.pop();
  return out;
}

const num = (p: ParamValues | undefined, k: string, v: number) => (typeof p?.[k] === 'number' && Number.isFinite(p[k]) ? (p[k] as number) : v);
const flag = (p: ParamValues | undefined, k: string, v: boolean) => (typeof p?.[k] === 'boolean' ? (p[k] as boolean) : v);

/** The cabinet's layout for a size and settings, everything clamped to fit. */
function geo({ w, d, h }: Size3, p?: ParamValues) {
  const zb = -d / 2;
  const zf = d / 2 - KNOB_ROOM;
  const y0 = clamp(num(p, 'kick', 0.2), 0, Math.max(0, h - 0.9));
  const nh = clamp(num(p, 'nicheHeight', 0.4), 0.15, Math.max(0.15, h - y0 - 0.55));
  const nb = clamp(num(p, 'nicheBottom', 1.05), y0 + 0.25, Math.max(y0 + 0.25, h - 0.3 - nh));
  const nt = nb + nh;
  const n = clamp(Math.round(num(p, 'doors', 2)), 1, 4);
  const xi0 = -w / 2 + T;
  const xi1 = w / 2 - T;
  const dw = (xi1 - xi0 - (n + 1) * GAP) / n;
  const lower: V2 = [y0 + T + GAP, nb - T - GAP];
  const upper: V2 = [nt + T + GAP, h - T - GAP];
  const shortest = Math.min(dw, lower[1] - lower[0], upper[1] - upper[0]);
  const inset = clamp(num(p, 'groove', 0.07), 0.02, Math.max(0.02, shortest / 2 - GW - 0.02));
  const doorX = range(n).map((i) => [xi0 + GAP + i * (dw + GAP), xi0 + GAP + i * (dw + GAP) + dw] as V2);
  const finX = xi1 - LINE - (xi1 - xi0) * 0.2;
  return { w, d, h, zb, zf, y0, nb, nt, nh, n, xi0, xi1, dw, lower, upper, inset, doorX, finX, fin: flag(p, 'fin', false), sides: flag(p, 'sides', true), shoes: flag(p, 'shoes', true) };
}

/**
 * One door with a routed groove `inset` in from its edges: a pill (round top and bottom) or an arch
 * (round top, flat bottom). The groove is a recess in the door's own finish: a back slab with the
 * frame round the groove and the panel inside it standing proud of it.
 */
function grooveDoor([x0, x1]: V2, [y0, y1]: V2, zf: number, inset: number, pill: boolean): Part[] {
  const a0 = x0 + inset;
  const a1 = x1 - inset;
  const b0 = y0 + inset;
  const b1 = y1 - inset;
  const cx = (a0 + a1) / 2;
  const ro = Math.max(GW + 0.01, Math.min((a1 - a0) / 2, pill ? (b1 - b0) / 2 : b1 - b0));
  const ri = ro - GW;
  const ys = b1 - ro; // centre of the top curve
  const yb = pill ? b0 + ro : b0; // centre of the bottom curve (pill), or the groove's floor
  const zg = zf - GD;
  const parts: Part[] = [
    span('body', [x0, x1], [y0, y1], [zf - DT, zg]),
    span('body', [x0, a0], [y0, y1], [zg, zf], { plan: false }),
    span('body', [a1, x1], [y0, y1], [zg, zf], { plan: false }),
    panelXY('body', dedupe([[a0, y1], [a1, y1], ...arc(cx, ys, ro, 0, Math.PI)]), zg, GD),
    pill ? panelXY('body', dedupe([[a1, y0], [a0, y0], ...arc(cx, yb, ro, Math.PI, 2 * Math.PI)]), zg, GD) : span('body', [a0, a1], [y0, b0], [zg, zf], { plan: false }),
  ];
  const inner: V2[] = pill
    ? [...arc(cx, ys, ri, 0, Math.PI), ...arc(cx, yb, ri, Math.PI, 2 * Math.PI)]
    : [[a0 + GW, b0 + GW], [a1 - GW, b0 + GW], ...arc(cx, Math.max(ys, b0 + GW), ri, 0, Math.PI)];
  parts.push(panelXY('body', dedupe(inner), zg, GD));
  return parts;
}

/**
 * Pairs of low sneakers standing in the shoe bay, toes to the front: uppers in the cabinet's finish, soles in the
 * knobs' black. As many pairs as fit, up to three.
 */
function shoesInBay(g: ReturnType<typeof geo>): Part[] {
  if (g.y0 < 0.1) return [];
  const span01 = g.xi1 - g.xi0;
  const pairs = clamp(Math.floor(span01 / 0.3), 1, 3);
  const sw = 0.09;
  const sh = 0.08;
  const st = 0.024;
  const z1 = g.zf - 0.005;
  const z0 = z1 - Math.min(0.27, z1 - g.zb - 0.02);
  const parts: Part[] = [];
  for (const i of range(pairs)) {
    const cx = g.xi0 + (span01 * (i + 0.5)) / pairs;
    for (const x of [cx - sw / 2 - 0.007, cx + sw / 2 + 0.007]) {
      const r = sw / 2 - 0.006;
      parts.push(
        span('knob', [x - sw / 2, x + sw / 2], [0, st], [z0, z1], { bevel: 0.008, plan: false }),
        span('body', [x - r, x + r], [st, sh], [z0 + 0.005, z1 - 0.07], { bevel: 0.012, plan: false }),
        sphere('body', [x, st + 0.005, z1 - 0.07], r, { scale: [1, ((sh - st) * 0.5) / r, 1.5], plan: false }),
      );
    }
  }
  return parts;
}

function buildShoeCabinet(size: Size3, p?: ParamValues): Part[] {
  const g = geo(size, p);
  const { w, h, zb, zf, y0, nb, nt, xi0, xi1 } = g;
  const ySide = g.sides ? 0 : y0;
  const parts: Part[] = [
    // Carcass.
    span('body', [-w / 2, xi0], [ySide, h], [zb, zf]),
    span('body', [xi1, w / 2], [ySide, h], [zb, zf]),
    span('body', [xi0, xi1], [h - T, h], [zb, zf]),
    span('body', [xi0, xi1], [y0, y0 + T], [zb, zf]),
    span('body', [xi0, xi1], [y0 + T, h - T], [zb, zb + BACK], { plan: false }),
    // Oak niche: floor and top boards, back and side linings.
    span('wood', [xi0, xi1], [nb - T, nb], [zb + BACK, zf]),
    span('wood', [xi0, xi1], [nt, nt + T], [zb + BACK, zf]),
    span('wood', [xi0, xi1], [nb, nt], [zb + BACK, zb + BACK + LINE], { plan: false }),
    span('wood', [xi0, xi0 + LINE], [nb, nt], [zb + BACK + LINE, zf], { plan: false }),
    span('wood', [xi1 - LINE, xi1], [nb, nt], [zb + BACK + LINE, zf], { plan: false }),
    // LED strip under the niche's top, towards the front.
    span('light', [xi0 + LINE + 0.01, xi1 - LINE - 0.01], [nt - 0.01, nt - 0.001], [zf - 0.06, zf - 0.04], { plan: false }),
  ];
  if (g.shoes) parts.push(...shoesInBay(g));
  if (g.fin) parts.push(span('wood', [g.finX - 0.012, g.finX + 0.012], [nb, nt], [zb + BACK + LINE, zf - 0.004], { plan: false }));
  // Doors: pill grooves above the niche, arch grooves below it; knobs by the meeting edges.
  g.doorX.forEach(([x0, x1], i) => {
    const right = g.n === 1 || i < g.n / 2 || (g.n % 2 === 1 && i === (g.n - 1) / 2);
    const kx = right ? x1 - 0.04 : x0 + 0.04;
    for (const [ys, pill] of [[g.lower, false], [g.upper, true]] as const) {
      if (ys[1] - ys[0] < 0.12) continue;
      parts.push(...grooveDoor([x0, x1], ys, zf, g.inset, pill));
      const ky = pill ? ys[0] + Math.min(0.09, (ys[1] - ys[0]) / 3) : ys[1] - Math.min(0.09, (ys[1] - ys[0]) / 3);
      parts.push(...knob('knob', [kx, ky, zf], 0.012));
    }
  });
  return parts;
}

function shoePlan(size: Size3, p?: ParamValues): PlanStroke[] {
  const g = geo(size, p);
  const strokes: PlanStroke[] = [line([g.xi0, g.zf], [g.xi1, g.zf])];
  for (const [, x1] of g.doorX.slice(0, -1)) strokes.push(line([x1 + GAP / 2, g.zf], [x1 + GAP / 2, g.zf - 0.05]));
  return strokes;
}

const at = (pick: (g: ReturnType<typeof geo>) => { at: [number, number, number]; dir: [number, number, number] }): AssetParam['handle'] => (size, p) => pick(geo(size, p));

const shoeParams: AssetParam[] = [
  { id: 'kick', label: 'Open shoe gap', kind: 'length', default: 0.2, min: 0, max: 0.4, step: 0.01, hint: 'Open space under the cabinet for everyday shoes', handle: at((g) => ({ at: [0, g.y0, g.zf + 0.01], dir: [0, 1, 0] })) },
  { id: 'nicheBottom', label: 'Niche height from floor', kind: 'length', default: 1.05, min: 0.3, max: 2.4, step: 0.01, handle: at((g) => ({ at: [-g.w / 4, g.nb, g.zf + 0.01], dir: [0, 1, 0] })) },
  { id: 'nicheHeight', label: 'Niche opening height', kind: 'length', default: 0.4, min: 0.15, max: 0.9, step: 0.01, handle: at((g) => ({ at: [g.w / 4, g.nt, g.zf + 0.01], dir: [0, 1, 0] })) },
  { id: 'doors', label: 'Doors per row', kind: 'count', default: 2, min: 1, max: 4, step: 1 },
  { id: 'groove', label: 'Groove inset', kind: 'length', default: 0.07, min: 0.02, max: 0.25, step: 0.005, hint: 'How far the routed groove sits in from the door edges', handle: at((g) => ({ at: [g.doorX[0][0] + g.inset, (g.upper[0] + g.upper[1]) / 2, g.zf + 0.005], dir: [1, 0, 0] })) },
  { id: 'fin', label: 'Oak fin in the niche', kind: 'toggle', default: false },
  { id: 'sides', label: 'Sides down to the floor', kind: 'toggle', default: true, hint: 'Off: the cabinet floats over the shoe gap' },
  { id: 'shoes', label: 'Shoes in the bay', kind: 'toggle', default: true, hint: 'Up to three pairs of sneakers in the open bay' },
];

const archShoeCabinet = defineItem({
  id: 'arch-groove-shoe-cabinet',
  name: 'Arch-groove shoe cabinet with oak niche',
  category: 'storage',
  type: 'storage',
  group: 'Hallway storage',
  tags: ['shoe cabinet', 'entry cabinet', 'hallway', 'arch', 'groove', 'routed', 'niche', 'led', 'oak', 'tủ giày', 'tủ giày cửa vòm'],
  description:
    'Tall entry shoe cabinet: cream doors with routed grooves (pill-shaped above, arch-topped below) and black knobs, an open oak niche with an LED strip, and an open shoe bay between its sides at the bottom with three pairs of sneakers. In the shape editor, set the shoe bay height, the shoes, the niche height and position, doors per row, the groove inset, an oak fin in the niche and whether the sides reach the floor.',
  defaultSize: { w: 1.0, d: 0.38, h: 2.4 },
  minSize: { w: 0.45, d: 0.28, h: 1.2 },
  maxSize: { w: 2.4, d: 0.6, h: 2.8 },
  slots: [
    matSlot('body', 'Cabinet, doors & shoes', 'paint-warm-white'),
    matSlot('wood', 'Niche & fin', 'wood-oak-light'),
    matSlot('light', 'LED strip', 'light-warm'),
    matSlot('knob', 'Knobs & shoe soles', 'metal-black-matte'),
  ],
  variants: [
    { id: 'cream', name: 'Cream & oak', materials: { body: 'paint-cream' } },
    { id: 'sage', name: 'Sage & oak', materials: { body: 'paint-sage' } },
    { id: 'greige', name: 'Greige & walnut', materials: { body: 'paint-greige', wood: 'wood-walnut' } },
  ],
  // A soft glow in the niche, under the LED strip at the default niche height (1.05 m + 0.4 m).
  light: { color: '#ffd9a8', intensity: 0.3, distance: 1.2, y: 1.42, z: 0.1 },
  params: shoeParams,
  build: (size, p) => buildShoeCabinet(size, p),
  planDetail: (size, p) => shoePlan(size, p),
});

export default definePack({
  name: 'Arch-groove shoe cabinet',
  version: '1.0.0',
  author: 'Neest team',
  description: 'A tall entry shoe cabinet with routed arch grooves on its doors, an oak niche with an LED strip and an open shoe gap underneath; fully shape-editable.',
  license: 'CC0 (made for Neest)',
  items: [archShoeCabinet],
});

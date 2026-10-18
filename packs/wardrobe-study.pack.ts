/**
 * Wardrobe & study wall — a built-in bedroom combo (reference: a Saigon serviced apartment).
 *
 * Left: an oak shelf tower with LED-lit open shelves over a closed base, and a study desk that runs
 * out from it with a rounded waterfall end and two apron drawers. Middle: a white shaker wardrobe
 * with tall doors, brass bar pulls and a top cabinet. Right: a narrow column with a rounded outer
 * corner and an open oak corner niche (with a socket) between a top and a bottom cupboard.
 *
 * The desk sits on the left; place the item mirrored to put it on the right. Door count follows
 * the wardrobe width.
 */
import {
  barPull,
  clamp,
  defineItem,
  definePack,
  knob,
  line,
  matSlot,
  prism,
  range,
  rng,
  shakerFront,
  span,
  type Part,
  type PlanStroke,
  type Size3,
  type V2,
} from '@/packs/kit';

/** Detail box (hidden from the plan) spanning x/y/z ranges, with an optional bevel. */
const sp = (slot: string, x: V2, y: V2, z: V2, bevel = 0): Part => span(slot, x, y, z, { bevel, plan: false });

/** Plan outline of a rectangle whose front-right (+x, +z) corner is rounded with radius r. */
function roundedCorner(x0: number, x1: number, z0: number, z1: number, r: number, seg = 16): V2[] {
  const pts: V2[] = [
    [x0, z0],
    [x1, z0],
  ];
  for (const i of range(seg + 1)) {
    const a = (i / seg) * (Math.PI / 2);
    pts.push([x1 - r + Math.cos(a) * r, z1 - r + Math.sin(a) * r]);
  }
  pts.push([x0, z1]);
  return pts;
}

/** A shape seen from the side: `pts` are [z, y], extruded `t` along +x from x. */
function sidePlate(slot: string, pts: V2[], x: number, t: number): Part {
  const zs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  return {
    shape: 'prism',
    outline: pts.map(([z, y]) => [-(y - cy), z - cz] as V2),
    height: t,
    position: [x, cy, cz],
    rotation: [0, 0, -Math.PI / 2],
    slot,
    plan: false,
  };
}

/**
 * The layout shared by the 3D build and the plan detail. Without the desk the item is only as deep as
 * the wardrobe, less the 3 cm the pulls and knobs stand out.
 */
function layout(w: number, d: number, h: number, desk = true) {
  const x0 = -w / 2;
  const x1 = w / 2;
  const zb = -d / 2;
  const D = desk ? clamp(d - 0.75, 0.45, 0.6) : d - 0.032;
  const zf = zb + D;
  const ov = desk ? 0.04 : 0; // the desk overhangs the tower on its outer side
  const tw = clamp(w * 0.25, 0.42, 0.6);
  const rw = clamp(w * 0.2, 0.34, 0.45);
  const xt0 = x0 + ov;
  const xt1 = xt0 + tw;
  const xr0 = x1 - rw;
  const n = clamp(Math.round((xr0 - xt1) / 0.55), 2, 4);
  const yU = h - clamp(h * 0.2, 0.4, 0.5);
  const deskH = Math.min(0.76, h * 0.33);
  return { x0, x1, zb, zf, D, tw, xt0, xt1, xr0, n, yU, deskH, dw: tw + ov };
}

/** The whole wall; `desk` = false leaves out the desk that runs forward from the tower. */
function buildWall({ w, d, h }: Size3, desk: boolean): Part[] {
    const L = layout(w, d, h, desk);
    const { x1, zb, zf, xt0, xt1, xr0, n, yU, deskH, dw } = L;
    const x0 = L.x0;
    const t = 0.018;
    const zc = zf - 0.02; // carcass face; fronts are 2 cm proud of it
    const plinth = 0.06;
    const parts: Part[] = [];

    // ── Oak shelf tower ─────────────────────────────────────────────────────
    parts.push(
      span('oak', [xt0, xt0 + t], [0, h], [zb, zc]),
      span('oak', [xt1 - t, xt1], [0, h], [zb, zc]),
      span('oak', [xt0 + t, xt1 - t], [yU, h], [zb, zc]),
      sp('oak', [xt0 + 0.002, xt1 - 0.002], [yU + 0.002, h - 0.002], [zc, zf], 0.002),
      sp('oak', [xt0 + t, xt1 - t], [deskH, yU], [zb, zb + 0.012]),
      // Closed base under the desk.
      sp('oak', [xt0 + t, xt1 - t], [0.01, deskH - 0.035], [zc - 0.02, zc]),
    );
    // Open shelves with a warm LED strip under each front edge (and under the cabinet above).
    const shelfYs = range(2).map((i) => deskH + ((yU - deskH) * (i + 1)) / 3);
    for (const y of shelfYs) parts.push(sp('oak', [xt0 + t, xt1 - t], [y - 0.025, y], [zb + 0.012, zc - 0.005], 0.002));
    for (const y of [...shelfYs.map((s) => s - 0.025), yU]) {
      parts.push(sp('light', [xt0 + t + 0.01, xt1 - t - 0.01], [y - 0.006, y], [zc - 0.06, zc - 0.045]));
    }

    // ── Desk running out from the tower ─────────────────────────────────────
    const R = 0.08;
    const top = 0.035;
    const zEnd = d / 2;
    // Niche floor inside the tower: it continues as the desk top, or stays as a ledge without the desk.
    parts.push(sp('oak', [xt0 + t, xt1 - t], [deskH - top, deskH], [zb + 0.012, zc]));
    if (desk) {
      parts.push(
        // Top and end panel tuck 1 cm into the bend so the joints don't show.
        span('oak', [x0, x0 + dw], [deskH - top, deskH], [zc, zEnd - R + 0.01], { bevel: 0.004 }),
        span('oak', [x0, x0 + dw], [0, deskH - R + 0.01], [zEnd - top, zEnd], { bevel: 0.004 }),
      );
      // Waterfall bend between the top and the end panel (fine steps: prism sides are flat-shaded).
      const seg = 24;
      const bend: V2[] = [];
      for (const i of range(seg + 1)) {
        const a = Math.PI / 2 - (i / seg) * (Math.PI / 2);
        bend.push([zEnd - R + Math.cos(a) * R, deskH - R + Math.sin(a) * R]);
      }
      for (const i of range(seg + 1)) {
        const a = (i / seg) * (Math.PI / 2);
        bend.push([zEnd - R + Math.cos(a) * (R - top), deskH - R + Math.sin(a) * (R - top)]);
      }
      parts.push(sidePlate('oak', bend, x0, dw));
      // Apron drawers, opening toward the room (+x), with a finger gap under the top.
      const dz0 = zc + 0.02;
      const dz1 = zEnd - top - 0.01;
      parts.push(sp('oak', [x0 + 0.06, x0 + dw - 0.024], [deskH - 0.16, deskH - top], [dz0, dz1]));
      const dm = (dz0 + dz1) / 2;
      for (const [a, b] of [
        [dz0, dm - 0.0015],
        [dm + 0.0015, dz1],
      ] as V2[]) {
        parts.push(sp('oak', [x0 + dw - 0.024, x0 + dw - 0.006], [deskH - 0.155, deskH - top - 0.014], [a, b], 0.003));
      }
    }

    // ── White shaker wardrobe ───────────────────────────────────────────────
    const xw0 = xt1;
    const xw1 = xr0;
    parts.push(
      span('white', [xw0, xw1], [plinth, h], [zb, zc]),
      sp('white', [xw0 + 0.01, xw1], [0, plinth], [zb, zc - 0.03]),
    );
    const dW = (xw1 - xw0) / n;
    for (const i of range(n)) {
      const a = xw0 + i * dW;
      const b = a + dW;
      parts.push(...shakerFront('white', [a, b], [plinth, yU], zc, 0.02, { rail: 0.07 }));
      parts.push(...shakerFront('white', [a, b], [yU, h], zc, 0.02, { rail: 0.065 }));
      // Doors pair up; the pull goes on the meeting edge (a lone last door opens from its left).
      const lone = n % 2 === 1 && i === n - 1;
      const px = i % 2 === 0 && !lone ? b - 0.045 : a + 0.045;
      parts.push(...barPull('metal', [px, Math.min(1.1, yU * 0.58), zf], 0.24, { vertical: true, r: 0.0045, stand: 0.022 }));
      parts.push(...knob('white', [px, yU + 0.06, zf], 0.013));
    }

    // ── Right column: rounded corner, open oak corner niche ────────────────
    const rr = Math.min(0.12, (x1 - xr0) * 0.35);
    const yB = clamp(h * 0.22, 0.45, 0.55);
    const xf = x1 - rr; // fronts end where the rounded corner begins
    const nicheTop = yU - 0.03;
    for (const [y0, y1, kY] of [
      [0, yB, yB - 0.06],
      [yU, h, yU + 0.06],
    ] as [number, number, number][]) {
      parts.push(prism('white', roundedCorner(xf, x1, zb, zf, rr), y0, y1 - y0));
      const base = y0 === 0 ? plinth : y0;
      parts.push(span('white', [xr0, xf], [base, y1], [zb, zc]));
      parts.push(...shakerFront('white', [xr0, xf], [base, y1], zc, 0.02, { rail: 0.06 }));
      parts.push(...knob('white', [xr0 + 0.05, kY, zf], 0.013));
    }
    parts.push(sp('white', [xr0, xf], [0, plinth], [zb, zc - 0.03]));
    // Oak niche: bottom, top, back and the lining on the wardrobe side.
    const nicheOutline = roundedCorner(xr0, x1, zb, zf, rr);
    parts.push(
      { ...prism('oak', nicheOutline, yB, 0.03), plan: false },
      { ...prism('oak', nicheOutline, nicheTop, 0.03), plan: false },
      sp('oak', [xr0, x1 - 0.01], [yB + 0.03, nicheTop], [zb, zb + 0.015]),
      sp('oak', [xr0, xr0 + 0.012], [yB + 0.03, nicheTop], [zb + 0.015, zf - 0.005]),
    );
    // Double socket on the niche back.
    const sx = (xr0 + x1) / 2 - 0.02;
    const sy = Math.min(yB + 0.32, nicheTop - 0.1);
    parts.push(
      sp('white', [sx - 0.04, sx + 0.04], [sy - 0.06, sy + 0.06], [zb + 0.015, zb + 0.024], 0.004),
      sp('white', [sx - 0.025, sx + 0.025], [sy - 0.045, sy + 0.045], [zb + 0.024, zb + 0.028], 0.003),
    );

    return parts;
}

function wallPlan({ w, d, h }: Size3, desk: boolean): PlanStroke[] {
  const { x0, x1, zb, zf, xt1, xr0, n, dw } = layout(w, d, h, desk);
  const out: PlanStroke[] = desk ? [line([x0 + dw, zf], [x0 + dw, d / 2]), line([x0, zf], [x0 + dw, zf])] : [];
  const dW = (xr0 - xt1) / n;
  for (const i of range(n + 1)) out.push(line([xt1 + i * dW, zf - 0.02], [xt1 + i * dW, zf]));
  out.push(line([xr0, zb], [xr0, zf]), line([xt1, zb], [xt1, zf]), line([xt1, zf], [x1 - 0.12, zf]));
  return out;
}

const slots = [
  matSlot('oak', 'Oak tower & desk', 'laminate-oak'),
  matSlot('white', 'Wardrobe fronts', 'shaker-cream'),
  matSlot('metal', 'Pulls', 'metal-brass'),
  matSlot('light', 'Shelf LEDs', 'led-warm-strip'),
];

const studyWall = defineItem({
  id: 'wardrobe-study-wall',
  name: 'Wardrobe with study desk & corner niche',
  category: 'bedroom',
  type: 'storage',
  group: 'Wardrobes',
  tags: ['wardrobe', 'desk', 'study', 'built-in', 'shaker', 'oak', 'shelves', 'led', 'niche', 'combo', 'tủ quần áo', 'bàn học', 'vietnamese', 'apartment'],
  defaultSize: { w: 2.0, d: 1.75, h: 2.4 },
  minSize: { w: 1.7, d: 1.3, h: 2.1 },
  maxSize: { w: 3.0, d: 2.1, h: 2.7 },
  wallSnap: true,
  slots,
  light: { color: '#ffcf8a', intensity: 0.35, distance: 2.2, y: 1.3 },
  build: (s) => buildWall(s, true),
  planDetail: (s) => wallPlan(s, true),
});

/** The same wall without the desk: only as deep as the wardrobe, the tower keeps a ledge at desk height. */
const towerWall = defineItem({
  id: 'wardrobe-shelf-tower-niche',
  name: 'Wardrobe with oak shelf tower & corner niche',
  category: 'bedroom',
  type: 'storage',
  group: 'Wardrobes',
  tags: ['wardrobe', 'built-in', 'shaker', 'oak', 'shelves', 'led', 'niche', 'shelf tower', 'tủ quần áo', 'vietnamese', 'apartment'],
  description:
    'A built-in bedroom wall without a desk: an oak shelf tower with LED-lit open shelves and a ledge over a closed base, a white shaker wardrobe with brass pulls, and a rounded column with an open oak corner niche.',
  defaultSize: { w: 2.0, d: 0.63, h: 2.4 },
  minSize: { w: 1.7, d: 0.5, h: 2.1 },
  maxSize: { w: 3.0, d: 0.66, h: 2.7 },
  wallSnap: true,
  slots: [matSlot('oak', 'Oak tower & niche', 'laminate-oak'), ...slots.slice(1)],
  light: { color: '#ffcf8a', intensity: 0.35, distance: 2.2, y: 1.3 },
  build: (s) => buildWall(s, false),
  planDetail: (s) => wallPlan(s, false),
});

const TAU = Math.PI * 2;

function paint(ctx: CanvasRenderingContext2D, size: number, value: (u: number, v: number, x: number, y: number) => number): void {
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const g = Math.round(Math.min(1, Math.max(0, value(x / size, y / size, x, y))) * 255);
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = g;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

export default definePack({
  name: 'Wardrobe & study wall',
  version: '1.0.0',
  author: 'Neest team',
  description: 'Built-in bedroom wall: oak shelf tower and study desk, white shaker wardrobe and a rounded corner niche.',
  license: 'CC0 (made for Neest)',
  items: [studyWall, towerWall],
  patterns: [
    {
      id: 'satin-lacquer',
      name: 'Satin lacquer',
      normalStrength: 0.12,
      draw(ctx, size, rand) {
        // Faint roller texture of sprayed, sanded lacquer on MDF.
        const ph = range(3).map(() => rand() * TAU);
        const r = rng(Math.floor(rand() * 1e6));
        const noise = new Float32Array(size * size).map(() => r());
        paint(ctx, size, (u, v, x, y) => 0.96 + Math.sin(v * TAU * 9 + Math.sin(u * TAU * 2 + ph[0]) * 0.8) * 0.006 + Math.sin(u * TAU * 3 + ph[1]) * 0.005 + (noise[y * size + x] - 0.5) * 0.025);
      },
    },
  ],
  materials: [
    { id: 'shaker-cream', name: 'Cream shaker lacquer', category: 'solid', color: '#ece7dd', roughness: 0.5, pattern: { id: 'satin-lacquer', scale: 0.6, contrast: 0.6 } },
    { id: 'led-warm-strip', name: 'Warm LED strip', color: '#ffe2b0', roughness: 0.3, emissive: '#ffc874', emissiveIntensity: 2.2 },
  ],
});

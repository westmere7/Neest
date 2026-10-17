import type { AssetDefinition, Part, PlanStroke, Size3 } from './types';
import { dressBed, dressPlan, type BedDress } from './bedroom';
import {
  barPull,
  box,
  cells,
  cellSpans,
  circle,
  clamp,
  cushion,
  cyl,
  defineAsset,
  discZ,
  frame4,
  knob,
  lathe,
  line,
  matSlot,
  pillow,
  poly,
  pot,
  range,
  rectPoly,
  ring,
  rng,
  rod,
  rodPath,
  rodX,
  rodZ,
  shakerFront,
  slats,
  span,
  spaced,
  sphere,
  torus,
  turnedLeg,
  vcyl,
  type V2,
  type V3,
} from './parts';

// Kids & nursery: cots, kids beds, toys, play furniture.

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

/** Sitting teddy bear facing +z, `s` ≈ 0.66 × its height, resting on `base`. */
function teddy(slot: string, base: V3, s: number, noseSlot = slot): Part[] {
  const [x, y, z] = base;
  const o = { plan: false };
  return [
    sphere(slot, [x, y + 0.47 * s, z], 0.42 * s, { scale: [1, 1.1, 0.9], plan: false }),
    sphere(slot, [x, y + 1.15 * s, z + 0.03 * s], 0.32 * s, o),
    sphere(slot, [x - 0.24 * s, y + 1.4 * s, z], 0.11 * s, o),
    sphere(slot, [x + 0.24 * s, y + 1.4 * s, z], 0.11 * s, o),
    sphere(slot, [x, y + 1.08 * s, z + 0.3 * s], 0.13 * s, { scale: [1, 0.8, 0.8], plan: false }),
    sphere(noseSlot, [x, y + 1.12 * s, z + 0.4 * s], 0.04 * s, o),
    sphere(slot, [x - 0.38 * s, y + 0.6 * s, z + 0.12 * s], 0.13 * s, { scale: [1, 1.7, 1], plan: false }),
    sphere(slot, [x + 0.38 * s, y + 0.6 * s, z + 0.12 * s], 0.13 * s, { scale: [1, 1.7, 1], plan: false }),
    sphere(slot, [x - 0.22 * s, y + 0.15 * s, z + 0.3 * s], 0.15 * s, { scale: [1, 1, 1.6], plan: false }),
    sphere(slot, [x + 0.22 * s, y + 0.15 * s, z + 0.3 * s], 0.15 * s, { scale: [1, 1, 1.6], plan: false }),
  ];
}

/** Block-letter strokes in a unit square [-0.5, 0.5]², y up: [x0, y0, x1, y1]. */
const GLYPHS: Record<string, [number, number, number, number][]> = {
  A: [[-0.35, -0.45, 0, 0.45], [0, 0.45, 0.35, -0.45], [-0.18, -0.08, 0.18, -0.08]],
  B: [[-0.3, -0.45, -0.3, 0.45], [-0.3, 0.45, 0.2, 0.45], [-0.3, 0, 0.2, 0], [-0.3, -0.45, 0.25, -0.45], [0.2, 0.45, 0.2, 0], [0.25, 0, 0.25, -0.45]],
  C: [[0.35, 0.45, -0.35, 0.45], [-0.35, 0.45, -0.35, -0.45], [-0.35, -0.45, 0.35, -0.45]],
  D: [[-0.3, -0.45, -0.3, 0.45], [-0.3, 0.45, 0.1, 0.45], [0.1, 0.45, 0.32, 0.2], [0.32, 0.2, 0.32, -0.2], [0.32, -0.2, 0.1, -0.45], [0.1, -0.45, -0.3, -0.45]],
  E: [[-0.3, -0.45, -0.3, 0.45], [-0.3, 0.45, 0.3, 0.45], [-0.3, 0, 0.2, 0], [-0.3, -0.45, 0.3, -0.45]],
  F: [[-0.3, -0.45, -0.3, 0.45], [-0.3, 0.45, 0.3, 0.45], [-0.3, 0, 0.2, 0]],
  G: [[0.35, 0.45, -0.35, 0.45], [-0.35, 0.45, -0.35, -0.45], [-0.35, -0.45, 0.35, -0.45], [0.35, -0.45, 0.35, 0], [0.35, 0, 0.05, 0]],
  H: [[-0.3, -0.45, -0.3, 0.45], [0.3, -0.45, 0.3, 0.45], [-0.3, 0, 0.3, 0]],
  I: [[0, -0.45, 0, 0.45]],
  J: [[0.25, 0.45, 0.25, -0.45], [0.25, -0.45, -0.3, -0.45], [-0.3, -0.45, -0.3, -0.15]],
  K: [[-0.3, -0.45, -0.3, 0.45], [-0.3, 0, 0.3, 0.45], [-0.3, 0, 0.3, -0.45]],
  L: [[-0.3, 0.45, -0.3, -0.45], [-0.3, -0.45, 0.3, -0.45]],
  M: [[-0.35, -0.45, -0.35, 0.45], [-0.35, 0.45, 0, 0], [0, 0, 0.35, 0.45], [0.35, 0.45, 0.35, -0.45]],
  N: [[-0.3, -0.45, -0.3, 0.45], [-0.3, 0.45, 0.3, -0.45], [0.3, -0.45, 0.3, 0.45]],
  O: [[-0.3, -0.45, -0.3, 0.45], [-0.3, 0.45, 0.3, 0.45], [0.3, 0.45, 0.3, -0.45], [0.3, -0.45, -0.3, -0.45]],
  P: [[-0.3, -0.45, -0.3, 0.45], [-0.3, 0.45, 0.3, 0.45], [0.3, 0.45, 0.3, 0], [0.3, 0, -0.3, 0]],
  Q: [[-0.3, -0.45, -0.3, 0.45], [-0.3, 0.45, 0.3, 0.45], [0.3, 0.45, 0.3, -0.45], [0.3, -0.45, -0.3, -0.45], [0.05, -0.15, 0.4, -0.48]],
  R: [[-0.3, -0.45, -0.3, 0.45], [-0.3, 0.45, 0.3, 0.45], [0.3, 0.45, 0.3, 0], [0.3, 0, -0.3, 0], [-0.05, 0, 0.3, -0.45]],
  S: [[0.3, 0.45, -0.3, 0.45], [-0.3, 0.45, -0.3, 0], [-0.3, 0, 0.3, 0], [0.3, 0, 0.3, -0.45], [0.3, -0.45, -0.3, -0.45]],
  T: [[-0.35, 0.45, 0.35, 0.45], [0, 0.45, 0, -0.45]],
  U: [[-0.3, 0.45, -0.3, -0.45], [-0.3, -0.45, 0.3, -0.45], [0.3, -0.45, 0.3, 0.45]],
  V: [[-0.35, 0.45, 0, -0.45], [0, -0.45, 0.35, 0.45]],
  W: [[-0.4, 0.45, -0.2, -0.45], [-0.2, -0.45, 0, 0.1], [0, 0.1, 0.2, -0.45], [0.2, -0.45, 0.4, 0.45]],
  X: [[-0.35, 0.45, 0.35, -0.45], [-0.35, -0.45, 0.35, 0.45]],
  Y: [[-0.35, 0.45, 0, 0], [0.35, 0.45, 0, 0], [0, 0, 0, -0.45]],
  Z: [[-0.3, 0.45, 0.3, 0.45], [0.3, 0.45, -0.3, -0.45], [-0.3, -0.45, 0.3, -0.45]],
};
const ALPHABET = Object.keys(GLYPHS);

/** A raised letter on a front-facing (XY) surface between depths z0 and z1. */
function glyphXY(slot: string, ch: string, cx: number, cy: number, size: number, z: V2): Part[] {
  const stroke = size * 0.15;
  return (GLYPHS[ch] ?? []).map(([x0, y0, x1, y1]) => {
    const len = Math.hypot(x1 - x0, y1 - y0) * size + stroke;
    return box(slot, [cx + ((x0 + x1) / 2) * size, cy + ((y0 + y1) / 2) * size, (z[0] + z[1]) / 2], [len, stroke, z[1] - z[0]], {
      rotation: [0, 0, Math.atan2(y1 - y0, x1 - x0)],
      plan: false,
    });
  });
}

/** A raised letter lying flat (readable from the front: letter-up is -z) between heights y0 and y1. */
function glyphFlat(slot: string, ch: string, cx: number, cz: number, size: number, y: V2): Part[] {
  const stroke = size * 0.15;
  return (GLYPHS[ch] ?? []).map(([x0, y0, x1, y1]) => {
    const len = Math.hypot(x1 - x0, y1 - y0) * size + stroke;
    const ang = Math.atan2(-(y1 - y0), x1 - x0);
    return box(slot, [cx + ((x0 + x1) / 2) * size, (y[0] + y[1]) / 2, cz - ((y0 + y1) / 2) * size], [len, y[1] - y[0], stroke], {
      rotation: [0, -ang, 0],
      plan: false,
    });
  });
}

function glyphFlatPlan(ch: string, cx: number, cz: number, size: number): PlanStroke[] {
  return (GLYPHS[ch] ?? []).map(([x0, y0, x1, y1]) => line([cx + x0 * size, cz - y0 * size], [cx + x1 * size, cz - y1 * size]));
}

// ---------------------------------------------------------------------------
// Nursery
// ---------------------------------------------------------------------------

const crib = defineAsset({
  id: 'crib',
  name: 'Baby cot',
  category: 'kids',
  type: 'beds',
  group: 'Cots & kids beds',
  tags: ['crib', 'cot', 'baby', 'nursery', 'infant', 'bars'],
  defaultSize: { w: 1.26, d: 0.68, h: 0.95 },
  minSize: { w: 1.0, d: 0.58, h: 0.85 },
  maxSize: { w: 1.45, d: 0.8, h: 1.05 },
  wallSnap: true,
  slots: [
    matSlot('frame', 'Frame', 'wood-painted-white'),
    matSlot('mattress', 'Mattress & sheet', 'fabric-white-cotton'),
    matSlot('blanket', 'Blanket', 'fabric-sky'),
    matSlot('toy', 'Teddy', 'fabric-mustard'),
  ],
  build: ({ w, d, h }) => {
    const p = 0.045;
    const parts: Part[] = [];
    for (const x of [-w / 2 + p / 2, w / 2 - p / 2]) {
      for (const z of [-d / 2 + p / 2, d / 2 - p / 2]) {
        parts.push(span('frame', [x - p / 2, x + p / 2], [0, h], [z - p / 2, z + p / 2], { bevel: 0.01 }));
      }
      // End panel with an arched top.
      const R = d / 2 - p;
      const ya = h - 0.03 - R;
      parts.push(
        span('frame', [x - 0.01, x + 0.01], [Math.min(0.15, ya - R), ya], [-R, R], { plan: false }),
        rod('frame', [x - 0.01, ya, 0], [x + 0.01, ya, 0], R, { segments: 32, plan: false }),
      );
    }
    // Long sides: rounded top rail, bottom rail and bars.
    const bars = Math.round((w - 2 * p) / 0.07);
    for (const z of [-d / 2 + p / 2, d / 2 - p / 2]) {
      parts.push(
        rodX('frame', -w / 2 + p, w / 2 - p, h - 0.045, z, 0.02, { plan: false }),
        span('frame', [-w / 2 + p, w / 2 - p], [0.2, 0.26], [z - 0.015, z + 0.015], { plan: false }),
        ...slats('frame', [-w / 2 + p, w / 2 - p], [0.26, h - 0.06], [z - 0.011, z + 0.011], bars, { gap: 0.6, plan: false }),
      );
    }
    // Mattress base, mattress, folded blanket and the under-cot drawer.
    const mx: V2 = [-w / 2 + p + 0.005, w / 2 - p - 0.005];
    const mz: V2 = [-d / 2 + p + 0.005, d / 2 - p - 0.005];
    parts.push(
      span('frame', [-w / 2 + p, w / 2 - p], [0.26, 0.28], [-d / 2 + p, d / 2 - p], { plan: false }),
      cushion('mattress', mx, [0.28, 0.4], mz, { softness: 0.2, plan: false }),
      cushion('blanket', [w * 0.08, mx[1] - 0.02], [0.395, 0.425], [mz[0] + 0.02, mz[1] - 0.02], { softness: 0.4, plan: false }),
      cushion('blanket', [w * 0.14, mx[1] - 0.03], [0.42, 0.445], [mz[0] + 0.03, mz[1] - 0.06], { softness: 0.4, plan: false }),
      span('frame', [-w / 2 + p, w / 2 - p], [0.03, 0.18], [-d / 2 + p, d / 2 - 0.04], { plan: false }),
      ...shakerFront('frame', [-w / 2 + p, w / 2 - p], [0.03, 0.19], d / 2 - 0.04, 0.018, { rail: 0.035 }),
      ...knob('frame', [-w / 4, 0.11, d / 2 - 0.022], 0.012),
      ...knob('frame', [w / 4, 0.11, d / 2 - 0.022], 0.012),
    );
    parts.push(...teddy('toy', [-w / 2 + p + 0.16, 0.4, -0.04], 0.11, 'blanket'));
    return parts;
  },
  planDetail: ({ w, d }) => {
    const p = 0.045;
    return [
      rectPoly(-w / 2 + p, -d / 2 + p, w / 2 - p, d / 2 - p),
      line([w * 0.08, -d / 2 + p + 0.03], [w * 0.08, d / 2 - p - 0.03]),
      circle([-w / 2 + p + 0.16, -0.02], 0.06),
    ];
  },
});

const changingTable = defineAsset({
  id: 'changing-table',
  name: 'Changing table',
  category: 'kids',
  type: 'kids',
  group: 'Nursery',
  tags: ['changing table', 'baby', 'nursery', 'changer', 'dresser', 'baskets'],
  defaultSize: { w: 0.9, d: 0.55, h: 1.0 },
  minSize: { w: 0.7, d: 0.45, h: 0.9 },
  maxSize: { w: 1.2, d: 0.7, h: 1.12 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Body', 'wood-painted-white'),
    matSlot('pad', 'Changing pad', 'fabric-sky'),
    matSlot('metal', 'Handles', 'metal-brass'),
    matSlot('basket', 'Baskets', 'rattan-natural'),
  ],
  build: ({ w, d, h }) => {
    const topY = h - 0.1;
    const topT = 0.025;
    const t = 0.02;
    const zC = d / 2 - 0.05;
    const zF = zC + 0.018;
    const xi: V2 = [-w / 2 + t, w / 2 - t];
    const yD1 = topY - topT;
    const drawerH = clamp((yD1 - 0.08) * 0.22, 0.14, 0.19);
    const yD0 = yD1 - 2 * drawerH;
    const parts: Part[] = [
      span('body', [-w / 2, w / 2], [yD1, topY], [-d / 2, d / 2], { bevel: 0.006 }),
      span('body', [-w / 2, -w / 2 + t], [0, yD1], [-d / 2, zF], { plan: false }),
      span('body', [w / 2 - t, w / 2], [0, yD1], [-d / 2, zF], { plan: false }),
      span('body', xi, [0.06, yD1], [-d / 2, -d / 2 + 0.015], { plan: false }),
      span('body', xi, [0.06, 0.08], [-d / 2 + 0.015, zF], { plan: false }),
      span('body', xi, [0, 0.06], [-d / 2 + 0.03, zC - 0.02], { plan: false }),
      span('body', xi, [yD0 - 0.02, yD0], [-d / 2 + 0.015, zF], { plan: false }),
      // Guard rails around the changing top.
      span('body', [-w / 2, w / 2], [topY, h], [-d / 2, -d / 2 + 0.02], { bevel: 0.006, plan: false }),
      span('body', [-w / 2, -w / 2 + 0.02], [topY, h], [-d / 2 + 0.02, d / 2 - 0.02], { bevel: 0.006, plan: false }),
      span('body', [w / 2 - 0.02, w / 2], [topY, h], [-d / 2 + 0.02, d / 2 - 0.02], { bevel: 0.006, plan: false }),
      // Contoured pad with raised edges.
      cushion('pad', [-w / 2 + 0.025, w / 2 - 0.025], [topY, topY + 0.05], [-d / 2 + 0.025, d / 2 - 0.02], { softness: 0.4, plan: false }),
      rodX('pad', -w / 2 + 0.04, w / 2 - 0.04, topY + 0.055, -d / 2 + 0.055, 0.03, { plan: false }),
      rodX('pad', -w / 2 + 0.04, w / 2 - 0.04, topY + 0.055, d / 2 - 0.05, 0.03, { plan: false }),
    ];
    for (const y of cellSpans(2, yD0, yD1)) {
      parts.push(...shakerFront('body', xi, y, zC, 0.018, { rail: 0.035 }));
      parts.push(...barPull('metal', [0, (y[0] + y[1]) / 2, zF], Math.min(0.16, w * 0.2), { r: 0.005, stand: 0.022 }));
    }
    // Woven baskets on the open bottom shelf.
    const nb = clamp(Math.round((w - 0.04) / 0.42), 1, 3);
    const bh = Math.min(0.24, yD0 - 0.13);
    for (const [xa, xb] of cellSpans(nb, xi[0], xi[1])) {
      const cx = (xa + xb) / 2;
      parts.push(
        span('basket', [xa + 0.015, xb - 0.015], [0.08, 0.08 + bh], [-d / 2 + 0.04, d / 2 - 0.07], { bevel: 0.012, plan: false }),
        span('basket', [xa + 0.01, xb - 0.01], [0.08 + bh - 0.03, 0.08 + bh], [-d / 2 + 0.035, d / 2 - 0.065], { bevel: 0.01, plan: false }),
        span('pad', [cx - 0.04, cx + 0.04], [0.08 + bh - 0.065, 0.08 + bh - 0.04], [d / 2 - 0.066, d / 2 - 0.06], { plan: false }),
      );
    }
    return parts;
  },
  planDetail: ({ w, d }) => [
    rectPoly(-w / 2 + 0.025, -d / 2 + 0.025, w / 2 - 0.025, d / 2 - 0.02),
    line([-w / 2 + 0.04, -d / 2 + 0.085], [w / 2 - 0.04, -d / 2 + 0.085]),
    line([-w / 2 + 0.04, d / 2 - 0.08], [w / 2 - 0.04, d / 2 - 0.08]),
  ],
});

const gliderChair = defineAsset({
  id: 'chair-nursing-glider',
  name: 'Nursing glider chair',
  category: 'kids',
  type: 'seating',
  group: 'Living chairs',
  tags: ['glider', 'rocking chair', 'nursing chair', 'nursery', 'armchair'],
  defaultSize: { w: 0.75, d: 0.85, h: 1.05 },
  minSize: { w: 0.65, d: 0.75, h: 0.95 },
  maxSize: { w: 0.9, d: 1.0, h: 1.15 },
  slots: [
    matSlot('upholstery', 'Upholstery', 'fabric-cream'),
    matSlot('frame', 'Glider base', 'wood-oak-light'),
    matSlot('pillow', 'Pillow & muslin', 'fabric-blush'),
  ],
  build: ({ w, d, h }) => {
    const armW = 0.12;
    const armTop = 0.62;
    const seatY = 0.46;
    const rx = w / 2 - 0.05;
    const parts: Part[] = [];
    for (const sx of [-1, 1]) {
      const x = sx * rx;
      parts.push(span('frame', [x - 0.02, x + 0.02], [0, 0.04], [-d / 2 + 0.02, d / 2 - 0.02], { bevel: 0.01 }));
      for (const sz of [-1, 1]) {
        const z = sz * (d / 2 - 0.15);
        parts.push(rod('frame', [x, 0.04, z], [x, 0.2, z + 0.03], 0.012, { plan: false }));
      }
      // Padded arm with a rolled top.
      const xa: V2 = sx < 0 ? [-w / 2 + 0.01, -w / 2 + 0.01 + armW] : [w / 2 - 0.01 - armW, w / 2 - 0.01];
      parts.push(cushion('upholstery', xa, [0.2, armTop - armW / 2], [-d / 2 + 0.1, d / 2 - 0.04], { softness: 0.35 }));
      parts.push(rodZ('upholstery', (xa[0] + xa[1]) / 2, armTop - armW / 2, -d / 2 + 0.1, d / 2 - 0.02, armW / 2, { segments: 20, plan: false }));
    }
    const x0 = -w / 2 + 0.01 + armW;
    const x1 = w / 2 - 0.01 - armW;
    const bh = h - 0.5;
    parts.push(
      rodX('frame', -rx, rx, 0.025, -(d / 2 - 0.12), 0.014, { plan: false }),
      rodX('frame', -rx, rx, 0.025, d / 2 - 0.12, 0.014, { plan: false }),
      span('frame', [-w / 2 + 0.03, w / 2 - 0.03], [0.17, 0.2], [-d / 2 + 0.06, d / 2 - 0.06], { plan: false }),
      span('upholstery', [x0, x1], [0.2, 0.34], [-d / 2 + 0.12, d / 2 - 0.05], { plan: false }),
      cushion('upholstery', [x0 + 0.005, x1 - 0.005], [0.34, seatY], [-d / 2 + 0.22, d / 2 - 0.03], { softness: 0.35, plan: false }),
      rodX('upholstery', x0 + 0.02, x1 - 0.02, seatY - 0.012, d / 2 - 0.035, 0.006, { plan: false }),
      cushion('upholstery', [-w / 2 + 0.02, w / 2 - 0.02], [0.2, h - 0.01], [-d / 2 + 0.02, -d / 2 + 0.12], { softness: 0.4 }),
      box('upholstery', [0, 0.48 + bh / 2, -d / 2 + 0.2], [x1 - x0 - 0.02, bh, 0.16], { rotation: [-0.12, 0, 0], bevel: 0.05, plan: false }),
      pillow('pillow', [0, 0.6, -d / 2 + 0.33], Math.min(0.42, x1 - x0 - 0.1), 0.26, 0.13, { lean: 0.2 }),
      // Muslin cloth folded over the right arm.
      span('pillow', [x1 - 0.005, w / 2 - 0.005], [armTop - 0.12, armTop + 0.008], [0, 0.16], { bevel: 0.004, plan: false }),
    );
    return parts;
  },
  planDetail: ({ w, d }) => {
    const x0 = -w / 2 + 0.13;
    const x1 = w / 2 - 0.13;
    return [rectPoly(x0, -d / 2 + 0.22, x1, d / 2 - 0.03), line([x0, -d / 2 + 0.12], [x1, -d / 2 + 0.12])];
  },
});

// ---------------------------------------------------------------------------
// Kids beds
// ---------------------------------------------------------------------------

function bunkGeom({ w, d, h }: Size3) {
  const p = 0.07;
  const yU = clamp(h - 0.6, 0.9, 1.25);
  const base: Omit<BedDress, 'y0' | 'top' | 'yMax' | 'duvet'> = {
    axis: 'x',
    across: [-d / 2 + p, d / 2 - p],
    along: [-w / 2 + p, w / 2 - p],
    pillows: 1,
    bedding: 'bedding',
    overhang: 0.015,
  };
  return {
    p,
    yU,
    xL: w / 2 - p - 0.42,
    lower: { ...base, y0: 0.26, top: 0.42, yMax: yU - 0.18, duvet: 'duvet' } as BedDress,
    upper: { ...base, y0: yU - 0.02, top: yU + 0.14, yMax: h, duvet: 'accent' } as BedDress,
  };
}

/** Corner posts, an upper bunk frame with guard rails and a front ladder (shared by bunk and loft beds). */
function highBedFrame({ w, d, h }: Size3, p: number, yU: number, xL: number): Part[] {
  const parts: Part[] = [];
  for (const x of [-w / 2 + p / 2, w / 2 - p / 2]) {
    for (const z of [-d / 2 + p / 2, d / 2 - p / 2]) {
      parts.push(span('frame', [x - p / 2, x + p / 2], [0, h], [z - p / 2, z + p / 2], { bevel: 0.01 }));
    }
    parts.push(
      ...slats('frame', [x - 0.012, x + 0.012], [yU, h - 0.03], [-d / 2 + p, d / 2 - p], 3, { axis: 'y', gap: 0.45, plan: false }),
    );
  }
  const xi: V2 = [-w / 2 + p, w / 2 - p];
  const back: V2 = [-d / 2 + 0.01, -d / 2 + 0.05];
  const front: V2 = [d / 2 - 0.05, d / 2 - 0.01];
  parts.push(
    span('frame', xi, [yU - 0.16, yU], back, { plan: false }),
    span('frame', xi, [yU - 0.16, yU], front, { plan: false }),
    span('frame', xi, [yU - 0.04, yU - 0.02], [-d / 2 + p, d / 2 - p], { plan: false }),
    // Guard rails: full at the back, stopping at the ladder at the front.
    span('frame', xi, [h - 0.09, h - 0.03], back, { bevel: 0.006, plan: false }),
    span('frame', xi, [yU + 0.17, yU + 0.22], back, { plan: false }),
    span('frame', [xi[0], xL], [h - 0.09, h - 0.03], front, { bevel: 0.006, plan: false }),
    span('frame', [xi[0], xL], [yU + 0.17, yU + 0.22], front, { plan: false }),
    span('frame', [xL - 0.04, xL], [yU, h - 0.03], front, { plan: false }),
    // Ladder: a stile plus rungs into the corner post.
    span('frame', [xL, xL + 0.045], [0, yU + 0.24], [d / 2 - 0.045, d / 2], { bevel: 0.006, plan: false }),
  );
  for (const y of spaced(Math.max(3, Math.round(yU / 0.27)), 0.28, yU + 0.14)) {
    parts.push(rodX('frame', xL + 0.045, xi[1], y, d / 2 - 0.022, 0.016, { plan: false }));
  }
  return parts;
}

const bedBunk = defineAsset({
  id: 'bed-bunk',
  name: 'Bunk bed',
  category: 'kids',
  type: 'beds',
  group: 'Bunk & loft beds',
  tags: ['bunk bed', 'kids', 'siblings', 'ladder', 'double decker', 'space saving'],
  defaultSize: { w: 2.06, d: 1.0, h: 1.65 },
  minSize: { w: 1.95, d: 0.9, h: 1.5 },
  maxSize: { w: 2.2, d: 1.25, h: 1.85 },
  wallSnap: true,
  slots: [
    matSlot('frame', 'Frame', 'wood-pine'),
    matSlot('bedding', 'Sheets & pillows', 'fabric-white-cotton'),
    matSlot('duvet', 'Lower duvet', 'fabric-navy'),
    matSlot('accent', 'Upper duvet', 'fabric-mustard'),
  ],
  build: (size) => {
    const { w, d } = size;
    const g = bunkGeom(size);
    const parts = highBedFrame(size, g.p, g.yU, g.xL);
    const xi: V2 = [-w / 2 + g.p, w / 2 - g.p];
    // Lower bunk rails, deck and end boards.
    parts.push(
      span('frame', xi, [0.14, 0.3], [-d / 2 + 0.01, -d / 2 + 0.05], { plan: false }),
      span('frame', xi, [0.14, 0.3], [d / 2 - 0.05, d / 2 - 0.01], { plan: false }),
      span('frame', xi, [0.24, 0.26], [-d / 2 + g.p, d / 2 - g.p], { plan: false }),
    );
    for (const x of [-w / 2 + g.p / 2, w / 2 - g.p / 2]) {
      parts.push(...slats('frame', [x - 0.012, x + 0.012], [0.3, g.yU - 0.2], [-d / 2 + g.p, d / 2 - g.p], 3, { axis: 'y', gap: 0.45, plan: false }));
    }
    parts.push(...dressBed(g.lower), ...dressBed(g.upper));
    return parts;
  },
  planDetail: (size) => {
    const g = bunkGeom(size);
    return [...dressPlan(g.upper), line([g.xL, size.d / 2 - 0.022], [size.w / 2 - g.p, size.d / 2 - 0.022])];
  },
});

function loftGeom({ w, d, h }: Size3) {
  const p = 0.07;
  const yU = h - 0.55;
  const xL = w / 2 - p - 0.42;
  const dress: BedDress = {
    axis: 'x',
    across: [-d / 2 + p, d / 2 - p],
    along: [-w / 2 + p, w / 2 - p],
    y0: yU - 0.02,
    top: yU + 0.14,
    yMax: h,
    pillows: 1,
    bedding: 'bedding',
    duvet: 'duvet',
    overhang: 0.015,
  };
  return { p, yU, xL, dress, dx: [-w / 2 + p, xL - 0.06] as V2, dz: [-d / 2 + 0.02, -d / 2 + Math.min(0.62, d - 0.25)] as V2 };
}

const bedLoft = defineAsset({
  id: 'bed-loft-desk',
  name: 'Loft bed with desk',
  category: 'kids',
  type: 'beds',
  group: 'Bunk & loft beds',
  tags: ['loft bed', 'high sleeper', 'desk', 'study', 'kids', 'teen', 'space saving'],
  defaultSize: { w: 2.06, d: 1.0, h: 1.85 },
  minSize: { w: 1.95, d: 0.9, h: 1.7 },
  maxSize: { w: 2.2, d: 1.2, h: 2.0 },
  wallSnap: true,
  slots: [
    matSlot('frame', 'Frame & lamp', 'wood-painted-white'),
    matSlot('desk', 'Desk & shelf', 'wood-oak-light'),
    matSlot('bedding', 'Sheets & paper', 'fabric-white-cotton'),
    matSlot('duvet', 'Duvet & bins', 'fabric-sky'),
  ],
  build: (size) => {
    const { w, d } = size;
    const g = loftGeom(size);
    const parts = highBedFrame(size, g.p, g.yU, g.xL);
    for (const x of [-w / 2 + g.p / 2, w / 2 - g.p / 2]) {
      parts.push(span('frame', [x - 0.012, x + 0.012], [0.08, 0.14], [-d / 2 + g.p, d / 2 - g.p], { plan: false }));
    }
    // Desk tucked under the bed: top, side panels, modesty panel and a drawer.
    const [dx0, dx1] = g.dx;
    const [dz0, dz1] = g.dz;
    const dTop = 0.75;
    parts.push(
      span('desk', [dx0, dx1], [dTop - 0.03, dTop], [dz0, dz1], { bevel: 0.006, plan: false }),
      span('desk', [dx0, dx0 + 0.025], [0, dTop - 0.03], [dz0, dz1 - 0.02], { plan: false }),
      span('desk', [dx1 - 0.025, dx1], [0, dTop - 0.03], [dz0, dz1 - 0.02], { plan: false }),
      span('desk', [dx0 + 0.025, dx1 - 0.025], [0.3, dTop - 0.03], [dz0, dz0 + 0.018], { plan: false }),
    );
    const drw: V2 = [dx1 - 0.025 - Math.min(0.4, (dx1 - dx0) * 0.4), dx1 - 0.025];
    parts.push(span('desk', drw, [0.6, dTop - 0.03], [dz0 + 0.018, dz1 - 0.04], { plan: false }));
    parts.push(...shakerFront('desk', drw, [0.6, dTop - 0.032], dz1 - 0.04, 0.018, { rail: 0.03 }));
    parts.push(...knob('frame', [(drw[0] + drw[1]) / 2, 0.66, dz1 - 0.022], 0.011));
    // Wall shelf with storage bins.
    const sy = dTop + (g.yU - 0.16 - dTop) * 0.55;
    const cs = Math.min(0.16, g.yU - 0.16 - sy - 0.05);
    parts.push(span('desk', [dx0 + 0.025, dx1 - 0.025], [sy, sy + 0.02], [-d / 2 + 0.02, -d / 2 + 0.2], { plan: false }));
    for (const cx of [dx0 + 0.13, dx0 + 0.32]) {
      parts.push(span('duvet', [cx - cs / 2 - 0.01, cx + cs / 2 + 0.01], [sy + 0.02, sy + 0.02 + cs], [-d / 2 + 0.03, -d / 2 + 0.19], { bevel: 0.01, plan: false }));
    }
    // Desk lamp, notebook and pencil cup.
    const lh = Math.max(0.12, Math.min(0.32, g.yU - 0.16 - dTop - 0.06));
    const lx = dx0 + 0.1;
    const lz = dz1 - 0.12;
    parts.push(
      cyl('frame', [lx, dTop + 0.01, lz], 0.06, 0.02, { plan: false }),
      rod('frame', [lx, dTop + 0.02, lz], [lx + 0.04, dTop + lh, lz - 0.03], 0.008, { plan: false }),
      rod('frame', [lx + 0.04, dTop + lh, lz - 0.03], [lx + 0.16, dTop + lh - 0.04, lz], 0.008, { plan: false }),
      cyl('frame', [lx + 0.17, dTop + lh - 0.08, lz], 0.06, 0.07, { rTop: 0.025, plan: false }),
      box('bedding', [(dx0 + dx1) / 2, dTop + 0.007, dz1 - 0.15], [0.21, 0.014, 0.28], { rotation: [0, -0.2, 0], plan: false }),
      cyl('duvet', [dx1 - 0.12, dTop + 0.05, dz0 + 0.25], 0.035, 0.1, { plan: false }),
      vcyl('bedding', dx1 - 0.13, dz0 + 0.25, dTop + 0.05, dTop + 0.15, 0.004, { plan: false }),
      vcyl('desk', dx1 - 0.11, dz0 + 0.24, dTop + 0.05, dTop + 0.14, 0.004, { plan: false }),
    );
    parts.push(...dressBed(g.dress));
    return parts;
  },
  planDetail: (size) => {
    const g = loftGeom(size);
    return [
      ...dressPlan(g.dress),
      rectPoly(g.dx[0], g.dz[0], g.dx[1], g.dz[1]),
      line([g.xL, size.d / 2 - 0.022], [size.w / 2 - g.p, size.d / 2 - 0.022]),
    ];
  },
});

function toddlerGeom({ w, d, h }: Size3) {
  const R = Math.min(w / 2 - 0.06, h * 0.32);
  const R2 = R * 0.7;
  const dress: BedDress = {
    across: [-w / 2 + 0.035, w / 2 - 0.035],
    along: [-d / 2 + 0.035, d / 2 - 0.035],
    y0: 0.12,
    top: 0.25,
    yMax: h,
    pillows: 1,
    bedding: 'bedding',
    duvet: 'duvet',
    accent: 'toy',
    overhang: 0.012,
  };
  return { R, R2, hbTop: h - R, fTop: Math.min(0.36, h - R2 - 0.02), dress };
}

const bedToddler = defineAsset({
  id: 'bed-toddler',
  name: 'Toddler bed',
  category: 'kids',
  type: 'beds',
  group: 'Cots & kids beds',
  tags: ['toddler bed', 'junior bed', 'kids', 'guard rail', 'low bed'],
  defaultSize: { w: 0.78, d: 1.46, h: 0.7 },
  minSize: { w: 0.7, d: 1.36, h: 0.58 },
  maxSize: { w: 0.9, d: 1.66, h: 0.85 },
  wallSnap: true,
  slots: [
    matSlot('frame', 'Frame', 'wood-painted-white'),
    matSlot('bedding', 'Sheets & pillow', 'fabric-white-cotton'),
    matSlot('duvet', 'Duvet', 'fabric-blush'),
    matSlot('toy', 'Teddy & cushion', 'fabric-mustard'),
  ],
  build: (size) => {
    const { w, d, h } = size;
    const g = toddlerGeom(size);
    const gY = Math.min(0.42, h - 0.1);
    const parts: Part[] = [
      // Headboard and footboard with arched tops; a moon on the headboard.
      span('frame', [-w / 2, w / 2], [0, g.hbTop], [-d / 2, -d / 2 + 0.025]),
      discZ('frame', [0, g.hbTop, -d / 2 + 0.0125], g.R, 0.025, { segments: 40, plan: false }),
      discZ('toy', [0, g.hbTop, -d / 2 + 0.03], g.R * 0.35, 0.01, { plan: false }),
      span('frame', [-w / 2, w / 2], [0, g.fTop], [d / 2 - 0.025, d / 2]),
      discZ('frame', [0, g.fTop, d / 2 - 0.0125], g.R2, 0.025, { segments: 40, plan: false }),
      // Side rails and slat deck.
      span('frame', [-w / 2, -w / 2 + 0.03], [0.06, 0.2], [-d / 2 + 0.025, d / 2 - 0.025], { bevel: 0.006 }),
      span('frame', [w / 2 - 0.03, w / 2], [0.06, 0.2], [-d / 2 + 0.025, d / 2 - 0.025], { bevel: 0.006 }),
      span('frame', [-w / 2 + 0.03, w / 2 - 0.03], [0.1, 0.12], [-d / 2 + 0.025, d / 2 - 0.025], { plan: false }),
    ];
    // Guard rails near the head on both sides.
    for (const sx of [-1, 1]) {
      const x = sx * (w / 2 - 0.015);
      parts.push(rodZ('frame', x, gY, -d / 2 + 0.06, -d / 2 + 0.62, 0.016, { plan: false }));
      for (const z of spaced(4, -d / 2 + 0.07, -d / 2 + 0.61)) parts.push(vcyl('frame', x, z, 0.2, gY, 0.011, { plan: false }));
    }
    parts.push(...dressBed(g.dress));
    parts.push(...teddy('toy', [w / 2 - 0.17, 0.29, -d / 2 + 0.78], 0.09, 'duvet'));
    return parts;
  },
  planDetail: (size) => {
    const g = toddlerGeom(size);
    return [...dressPlan(g.dress), circle([size.w / 2 - 0.17, -size.d / 2 + 0.8], 0.05)];
  },
});

function carGeom({ w, d, h }: Size3) {
  const bx = w / 2 - 0.07;
  const dress: BedDress = {
    across: [-bx + 0.05, bx - 0.05],
    along: [-d / 2 + 0.17, d / 2 - 0.33],
    y0: 0.16,
    top: 0.32,
    yMax: h,
    pillows: 1,
    bedding: 'bedding',
    duvet: 'duvet',
    overhang: 0,
  };
  return { bx, dress };
}

const bedRaceCar = defineAsset({
  id: 'bed-race-car',
  name: 'Race-car bed',
  category: 'kids',
  type: 'beds',
  group: 'Cots & kids beds',
  tags: ['car bed', 'race car', 'kids', 'novelty bed', 'racing'],
  defaultSize: { w: 1.08, d: 2.16, h: 0.62 },
  minSize: { w: 0.98, d: 2.0, h: 0.52 },
  maxSize: { w: 1.2, d: 2.35, h: 0.75 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Car body', 'plastic-red'),
    matSlot('trim', 'Tyres & stripes', 'rubber-black'),
    matSlot('bedding', 'Sheets, lights & hubs', 'fabric-white-cotton'),
    matSlot('duvet', 'Duvet', 'fabric-navy'),
  ],
  build: (size) => {
    const { w, d, h } = size;
    const { bx, dress } = carGeom(size);
    const a = Math.atan2(0.14, 0.32);
    const hl = Math.hypot(0.32, 0.14);
    const hc: V3 = [0, 0.37, d / 2 - 0.18];
    const parts: Part[] = [
      span('body', [-bx, bx], [0.06, 0.16], [-d / 2 + 0.02, d / 2 - 0.02], { plan: false }),
      cushion('body', [-bx, -bx + 0.05], [0.06, 0.44], [-d / 2 + 0.02, d / 2 - 0.02], { softness: 0.4 }),
      cushion('body', [bx - 0.05, bx], [0.06, 0.44], [-d / 2 + 0.02, d / 2 - 0.02], { softness: 0.4 }),
      // Rear block at the head, nose and sloping bonnet at the foot.
      cushion('body', [-bx, bx], [0.06, 0.5], [-d / 2, -d / 2 + 0.15], { softness: 0.3 }),
      cushion('body', [-bx, bx], [0.06, 0.32], [d / 2 - 0.32, d / 2], { softness: 0.45 }),
      box('body', hc, [2 * bx - 0.02, 0.05, hl], { rotation: [a, 0, 0], bevel: 0.02, plan: false }),
      span('trim', [-0.18, 0.18], [0.13, 0.24], [d / 2 - 0.006, d / 2 + 0.002], { plan: false }),
      // Exhaust pipes.
      rodZ('trim', -0.2, 0.12, -d / 2 - 0.005, -d / 2 + 0.06, 0.025, { plan: false }),
      rodZ('trim', 0.2, 0.12, -d / 2 - 0.005, -d / 2 + 0.06, 0.025, { plan: false }),
      // Spoiler wing on two struts, with end plates.
      span('body', [-bx, bx], [h - 0.035, h], [-d / 2, -d / 2 + 0.18], { bevel: 0.01, plan: false }),
      span('trim', [-0.27, -0.23], [0.48, h - 0.035], [-d / 2 + 0.07, -d / 2 + 0.11], { plan: false }),
      span('trim', [0.23, 0.27], [0.48, h - 0.035], [-d / 2 + 0.07, -d / 2 + 0.11], { plan: false }),
      span('body', [-bx - 0.012, -bx], [h - 0.11, h], [-d / 2, -d / 2 + 0.2], { plan: false }),
      span('body', [bx, bx + 0.012], [h - 0.11, h], [-d / 2, -d / 2 + 0.2], { plan: false }),
    ];
    // Racing stripes on the bonnet, headlights.
    const n: V3 = [0, Math.cos(a) * 0.026, Math.sin(a) * 0.026];
    for (const sx of [-1, 1]) {
      parts.push(box('trim', [sx * 0.08, hc[1] + n[1], hc[2] + n[2]], [0.06, 0.004, hl - 0.04], { rotation: [a, 0, 0], plan: false }));
      parts.push(discZ('bedding', [sx * (bx - 0.12), 0.22, d / 2 - 0.004], 0.04, 0.012, { plan: false }));
    }
    // Side stripes, number roundels and wheels.
    const zW = d / 2 - 0.38;
    for (const sx of [-1, 1]) {
      const x = sx * bx;
      parts.push(
        span('trim', [Math.min(x, x + sx * 0.003), Math.max(x, x + sx * 0.003)], [0.4, 0.42], [-d / 2 + 0.15, d / 2 - 0.32], { plan: false }),
        rod('bedding', [x, 0.27, 0.05], [x + sx * 0.004, 0.27, 0.05], 0.085, { plan: false }),
        span('trim', [Math.min(x + sx * 0.004, x + sx * 0.006), Math.max(x + sx * 0.004, x + sx * 0.006)], [0.22, 0.32], [0.04, 0.06], { plan: false }),
      );
      for (const z of [-zW, zW]) {
        parts.push(
          rodX('trim', sx * (w / 2 - 0.065), sx * (w / 2 - 0.005), 0.17, z, 0.17, { segments: 28 }),
          rodX('bedding', sx * (w / 2 - 0.012), sx * (w / 2 - 0.002), 0.17, z, 0.085, { plan: false }),
          sphere('body', [sx * (w / 2 - 0.006), 0.17, z], 0.02, { plan: false }),
        );
      }
    }
    parts.push(...dressBed(dress));
    return parts;
  },
  planDetail: (size) => {
    const { w, d } = size;
    const { bx, dress } = carGeom(size);
    return [
      ...dressPlan(dress),
      line([-bx, d / 2 - 0.34], [bx, d / 2 - 0.34]),
      line([-bx, -d / 2 + 0.15], [bx, -d / 2 + 0.15]),
      line([-0.08, d / 2 - 0.34], [-0.08, d / 2 - 0.02]),
      line([0.08, d / 2 - 0.34], [0.08, d / 2 - 0.02]),
      rectPoly(w / 2 - 0.065, d / 2 - 0.55, w / 2 - 0.005, d / 2 - 0.21),
      rectPoly(-w / 2 + 0.005, d / 2 - 0.55, -w / 2 + 0.065, d / 2 - 0.21),
    ];
  },
});

// ---------------------------------------------------------------------------
// Kids furniture
// ---------------------------------------------------------------------------

const toyChest = defineAsset({
  id: 'toy-chest',
  name: 'Toy chest',
  category: 'kids',
  type: 'kids',
  group: 'Kids furniture',
  tags: ['toy box', 'toy chest', 'storage', 'kids', 'abc'],
  defaultSize: { w: 0.8, d: 0.45, h: 0.5 },
  minSize: { w: 0.5, d: 0.35, h: 0.35 },
  maxSize: { w: 1.2, d: 0.6, h: 0.65 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Box', 'wood-painted-white'),
    matSlot('lid', 'Lid, plinth & handles', 'laminate-sage'),
    matSlot('accentA', 'Letter tiles 1', 'plastic-yellow'),
    matSlot('accentB', 'Letter tiles 2', 'plastic-blue'),
  ],
  build: ({ w, d, h }) => {
    const yL = h - 0.055;
    const zP = d / 2 - 0.02;
    const parts: Part[] = [
      span('lid', [-w / 2 + 0.005, w / 2 - 0.005], [0, 0.05], [-d / 2 + 0.005, d / 2 - 0.01], { bevel: 0.01 }),
      span('body', [-w / 2 + 0.01, w / 2 - 0.01], [0.05, yL], [-d / 2 + 0.01, zP], { bevel: 0.012, plan: false }),
      span('lid', [-w / 2, w / 2], [yL, h], [-d / 2, d / 2], { bevel: 0.02 }),
      span('lid', [-0.07, 0.07], [yL - 0.012, yL], [zP - 0.002, zP + 0.012], { bevel: 0.004, plan: false }),
    ];
    // Rope handles on the ends.
    for (const sx of [-1, 1]) {
      parts.push(
        torus('lid', [sx * (w / 2 - 0.004), yL - 0.08, 0], 0.04, 0.011, { rotation: [0, Math.PI / 2, 0], plan: false }),
        span('lid', [sx * (w / 2 - 0.01) - 0.003, sx * (w / 2 - 0.01) + 0.003], [yL - 0.1, yL - 0.06], [-0.06, 0.06], { plan: false }),
      );
    }
    // Raised letter tiles on the front.
    const n = clamp(Math.floor((w - 0.06) / 0.2), 2, 5);
    const s = Math.min(0.16, (w - 0.08) / n - 0.035, yL - 0.11);
    const cy = (0.05 + yL) / 2;
    for (const [i, cx] of cells(n, -w / 2 + 0.04, w / 2 - 0.04).entries()) {
      const tile = i % 2 === 0 ? 'accentA' : 'accentB';
      const letter = i % 2 === 0 ? 'accentB' : 'accentA';
      parts.push(span(tile, [cx - s / 2, cx + s / 2], [cy - s / 2, cy + s / 2], [zP, zP + 0.012], { bevel: 0.008, plan: false }));
      parts.push(...glyphXY(letter, 'ABCDE'[i], cx, cy, s * 0.62, [zP + 0.012, zP + 0.018]));
    }
    return parts;
  },
  planDetail: ({ w, d }) => [rectPoly(-w / 2 + 0.02, -d / 2 + 0.02, w / 2 - 0.02, d / 2 - 0.02)],
});

function tableSetGeom({ w, d, h }: Size3) {
  return { tw: w - 0.52, th: Math.min(0.5, h - 0.08), dd: Math.min(d - 0.02, 0.62), seatY: 0.3 };
}

const kidsTableSet = defineAsset({
  id: 'kids-table-set',
  name: 'Kids table and chairs',
  category: 'kids',
  type: 'kids',
  group: 'Kids furniture',
  tags: ['kids table', 'play table', 'chairs', 'activity table', 'craft'],
  defaultSize: { w: 1.2, d: 0.62, h: 0.58 },
  minSize: { w: 0.95, d: 0.5, h: 0.52 },
  maxSize: { w: 1.7, d: 0.9, h: 0.65 },
  slots: [
    matSlot('frame', 'Table top & seats trim', 'wood-oak-light'),
    matSlot('legs', 'Legs', 'plastic-mint'),
    matSlot('chairs', 'Chairs', 'plastic-yellow'),
    matSlot('paper', 'Paper & crayons', 'paper-art'),
  ],
  build: (size) => {
    const { w, h } = size;
    const g = tableSetGeom(size);
    const parts: Part[] = [
      span('frame', [-g.tw / 2, g.tw / 2], [g.th - 0.028, g.th], [-g.dd / 2, g.dd / 2], { bevel: 0.012 }),
      span('frame', [-g.tw / 2 + 0.04, g.tw / 2 - 0.04], [g.th - 0.07, g.th - 0.028], [-g.dd / 2 + 0.04, g.dd / 2 - 0.04], { plan: false }),
    ];
    for (const x of [-g.tw / 2 + 0.05, g.tw / 2 - 0.05]) {
      for (const z of [-g.dd / 2 + 0.05, g.dd / 2 - 0.05]) parts.push(turnedLeg('legs', x, z, 0, g.th - 0.028, 0.026, { style: 'taper' }));
    }
    // Drawing paper, crayons and a crayon tub.
    const pw = Math.min(0.3, g.tw * 0.5);
    const px = -g.tw * 0.1;
    parts.push(
      box('paper', [px, g.th + 0.001, 0.02], [pw, 0.002, 0.21], { rotation: [0, 0.25, 0], plan: false }),
      cyl('chairs', [px + 0.03, g.th + 0.003, 0.01], 0.03, 0.002, { plan: false }),
      rod('chairs', [g.tw * 0.15, g.th + 0.006, 0.05], [g.tw * 0.15 + 0.08, g.th + 0.006, 0.08], 0.005, { plan: false }),
      rod('legs', [g.tw * 0.12, g.th + 0.006, 0.12], [g.tw * 0.12 + 0.09, g.th + 0.006, 0.1], 0.005, { plan: false }),
      cyl('legs', [g.tw / 2 - 0.08, g.th + 0.03, -g.dd / 2 + 0.08], 0.035, 0.06, { plan: false }),
      vcyl('chairs', g.tw / 2 - 0.09, -g.dd / 2 + 0.07, g.th + 0.04, g.th + 0.085, 0.005, { plan: false }),
      vcyl('paper', g.tw / 2 - 0.07, -g.dd / 2 + 0.085, g.th + 0.04, g.th + 0.08, 0.005, { plan: false }),
      vcyl('frame', g.tw / 2 - 0.08, -g.dd / 2 + 0.095, g.th + 0.04, g.th + 0.075, 0.005, { plan: false }),
    );
    // Two little chairs facing the table from each end.
    for (const sx of [-1, 1]) {
      const cx = sx * (w / 2 - 0.16);
      parts.push(cushion('chairs', [cx - 0.14, cx + 0.14], [g.seatY - 0.03, g.seatY], [-0.14, 0.14], { softness: 0.3 }));
      for (const lx of [-0.11, 0.11]) {
        for (const lz of [-0.11, 0.11]) {
          parts.push(rod('legs', [cx + lx, g.seatY - 0.03, lz], [cx + lx * 1.12, 0, lz * 1.12], 0.014, { plan: false }));
        }
      }
      const xb = sx * (w / 2 - 0.035);
      const xt = sx * (w / 2 - 0.022);
      for (const z of [-0.11, 0.11]) parts.push(rod('chairs', [xb, g.seatY, z], [xt, h - 0.1, z], 0.012, { plan: false }));
      parts.push(
        span('chairs', [Math.min(xt - 0.012, xt + 0.012), Math.max(xt - 0.012, xt + 0.012)], [h - 0.16, h - 0.04], [-0.13, 0.13], { bevel: 0.01, plan: false }),
        rodZ('chairs', xt, h - 0.04, -0.13, 0.13, 0.013, { plan: false }),
      );
    }
    return parts;
  },
  planDetail: ({ w }) => [
    line([-(w / 2 - 0.022), -0.13], [-(w / 2 - 0.022), 0.13]),
    line([w / 2 - 0.022, -0.13], [w / 2 - 0.022, 0.13]),
  ],
});

function displayGeom({ w, d, h }: Size3) {
  const binH = 0.22;
  const tierD = Math.min(0.1, d * 0.35);
  const n = clamp(Math.round((h - binH - 0.08) / 0.2), 2, 5);
  const y0 = binH + 0.04;
  const gap = (h - 0.04 - y0) / n;
  return {
    binH,
    tierD,
    n,
    gap,
    tiers: range(n).map((i) => y0 + i * gap),
    bookMax: Math.min(0.25, gap - 0.035),
    nb: Math.max(1, Math.floor((w - 0.06) / 0.21)),
    zBack: -d / 2 + 0.012,
  };
}

const bookDisplay = defineAsset({
  id: 'kids-book-display',
  name: 'Front-facing book display',
  category: 'kids',
  type: 'kids',
  group: 'Kids furniture',
  tags: ['book display', 'bookshelf', 'kids', 'reading nook', 'toy bin', 'library'],
  defaultSize: { w: 0.8, d: 0.3, h: 0.9 },
  minSize: { w: 0.5, d: 0.25, h: 0.65 },
  maxSize: { w: 1.4, d: 0.4, h: 1.3 },
  wallSnap: true,
  slots: [
    matSlot('frame', 'Frame', 'wood-painted-white'),
    matSlot('ledges', 'Ledges & bin', 'laminate-sage'),
    matSlot('books', 'Books', 'book-mix'),
    matSlot('toys', 'Toys', 'plastic-yellow'),
  ],
  build: (size) => {
    const { w, d, h } = size;
    const g = displayGeom(size);
    const t = 0.018;
    const xi: V2 = [-w / 2 + t, w / 2 - t];
    const zLip = g.zBack + g.tierD;
    const parts: Part[] = [
      span('frame', xi, [0.02, h - 0.005], [-d / 2, g.zBack], { plan: false }),
      span('frame', xi, [0.02, 0.04], [g.zBack, d / 2 - 0.005], { plan: false }),
      span('ledges', xi, [0.02, g.binH * 0.65], [d / 2 - 0.018, d / 2], { bevel: 0.005, plan: false }),
    ];
    for (const sx of [-1, 1]) {
      const x: V2 = sx < 0 ? [-w / 2, -w / 2 + t] : [w / 2 - t, w / 2];
      parts.push(
        span('frame', x, [0, g.binH + 0.03], [-d / 2, d / 2], { bevel: 0.004 }),
        span('frame', x, [g.binH + 0.03, h], [-d / 2, zLip + 0.012], { bevel: 0.004, plan: false }),
      );
    }
    // Toys in the bottom bin.
    const rand = rng(5);
    const bz = (g.zBack + d / 2 - 0.018) / 2;
    const toyN = Math.max(2, Math.round(w / 0.2));
    for (const [i, x] of cells(toyN, xi[0] + 0.01, xi[1] - 0.01).entries()) {
      const slot = i % 2 === 0 ? 'toys' : 'ledges';
      if (i === 1) {
        parts.push(sphere('toys', [x, 0.04 + 0.065, bz], 0.065, { plan: false }));
      } else {
        const s = 0.07;
        parts.push(box(slot, [x, 0.04 + s / 2, bz + (rand() - 0.5) * 0.04], [s, s, s], { rotation: [0, (rand() - 0.5) * 0.8, 0], bevel: 0.006, plan: false }));
        if (i % 3 === 0) parts.push(box('books', [x, 0.04 + s * 1.5, bz], [s, s, s], { rotation: [0, rand() * 0.6, 0], bevel: 0.006, plan: false }));
      }
    }
    // Tiers: shelf, front lip and front-facing books leaning back.
    for (const [ti, y] of g.tiers.entries()) {
      parts.push(
        span('ledges', xi, [y, y + 0.015], [g.zBack, zLip], { plan: false }),
        span('ledges', xi, [y + 0.015, y + 0.05], [zLip, zLip + 0.012], { bevel: 0.004, plan: false }),
      );
      const brand = rng(17 + ti);
      for (const cx of cells(g.nb, xi[0], xi[1])) {
        const bw = Math.min(0.19, (xi[1] - xi[0]) / g.nb - 0.02) * (0.85 + 0.15 * brand());
        const bh = g.bookMax * (0.75 + 0.25 * brand());
        const bt = 0.012 + 0.008 * brand();
        const lean = clamp(Math.atan2(g.tierD - 0.035, bh), 0.05, 0.6);
        const zb = zLip - bt / 2 - 0.003;
        parts.push(
          box('books', [cx + (brand() - 0.5) * 0.02, y + 0.015 + (bh / 2) * Math.cos(lean), zb - (bh / 2) * Math.sin(lean)], [bw, bh, bt], {
            rotation: [-lean, 0, 0],
            plan: false,
          }),
        );
      }
    }
    return parts;
  },
  planDetail: (size) => {
    const g = displayGeom(size);
    const { w, d } = size;
    const z = g.zBack + g.tierD + 0.012;
    return [line([-w / 2 + 0.018, z], [w / 2 - 0.018, z]), line([-w / 2 + 0.018, d / 2 - 0.018], [w / 2 - 0.018, d / 2 - 0.018])];
  },
});

// ---------------------------------------------------------------------------
// Toys
// ---------------------------------------------------------------------------

const playKitchen = defineAsset({
  id: 'play-kitchen',
  name: 'Play kitchen',
  category: 'kids',
  type: 'kids',
  group: 'Toys',
  tags: ['play kitchen', 'toy kitchen', 'pretend play', 'kids', 'oven', 'sink'],
  defaultSize: { w: 0.8, d: 0.32, h: 0.95 },
  minSize: { w: 0.6, d: 0.28, h: 0.8 },
  maxSize: { w: 1.2, d: 0.45, h: 1.1 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Cabinet', 'wood-painted-white'),
    matSlot('accent', 'Doors & backsplash', 'laminate-sage'),
    matSlot('metal', 'Taps, knobs & pots', 'metal-brushed-steel'),
    matSlot('dark', 'Hob & oven window', 'plastic-black'),
  ],
  build: ({ w, d, h }) => {
    const cy = clamp(h * 0.55, 0.45, 0.55);
    const zC = d / 2 - 0.03;
    const zF = zC + 0.018;
    const xm = -w / 2 + w * 0.52;
    const ox: V2 = [-w / 2 + 0.02, xm - 0.01];
    const oy: V2 = [0.06, cy - 0.07];
    const sxr: V2 = [xm + 0.01, w / 2 - 0.02];
    const parts: Part[] = [
      span('body', [-w / 2, w / 2], [0.03, cy - 0.025], [-d / 2, zC], { plan: false }),
      span('body', [-w / 2 + 0.02, w / 2 - 0.02], [0, 0.03], [-d / 2 + 0.02, zC - 0.02], { plan: false }),
      span('body', [-w / 2, w / 2], [cy - 0.025, cy], [-d / 2, d / 2], { bevel: 0.006 }),
      // Oven door with window and handle, and a knob panel above it.
      ...frame4('accent', ox, oy, [zC, zF], 0.04),
      span('dark', [ox[0] + 0.04, ox[1] - 0.04], [oy[0] + 0.04, oy[1] - 0.04], [zC, zF - 0.006], { plan: false }),
      ...barPull('metal', [(ox[0] + ox[1]) / 2, oy[1] - 0.022, zF], Math.min(0.2, (ox[1] - ox[0]) * 0.6), { stand: 0.018, r: 0.006 }),
      span('dark', [ox[0], ox[1]], [cy - 0.068, cy - 0.027], [zC, zC + 0.002], { plan: false }),
      // Cupboard under the sink.
      ...shakerFront('accent', sxr, oy, zC, 0.018, { rail: 0.035 }),
      ...knob('metal', [sxr[0] + 0.04, (oy[0] + oy[1]) / 2 + 0.05, zF], 0.012),
    ];
    for (const kx of cells(3, ox[0] + 0.03, ox[1] - 0.03)) parts.push(...knob('metal', [kx, cy - 0.047, zC + 0.002], 0.011));
    // Two burners with a pot on one.
    const burners = cells(2, -w / 2 + 0.02, xm - 0.02);
    for (const bx of burners) {
      parts.push(ring('dark', [bx, cy + 0.004, 0], 0.055, 0.008), cyl('dark', [bx, cy + 0.002, 0], 0.035, 0.004, { plan: false }));
    }
    const b0 = burners[0];
    parts.push(
      lathe('metal', [b0, cy + 0.006, 0], [
        [0, 0],
        [0.05, 0],
        [0.055, 0.065],
        [0.05, 0.065],
      ], { plan: false }),
      cyl('metal', [b0, cy + 0.074, 0], 0.056, 0.006, { rTop: 0.03, plan: false }),
      sphere('dark', [b0, cy + 0.083, 0], 0.01, { plan: false }),
      rodX('metal', b0 + 0.055, b0 + 0.09, cy + 0.05, 0, 0.006, { plan: false }),
    );
    // Sink basin and tap.
    const sk = (xm + w / 2) / 2;
    const sr = Math.min(0.08, (w / 2 - xm) / 2 - 0.03, d / 2 - 0.05);
    const tz = -d / 2 + 0.04;
    parts.push(
      pot('metal', [sk, cy - 0.055, 0.01], sr, 0.06, 'bowl', { plan: false }),
      vcyl('metal', sk, tz, cy, cy + 0.12, 0.01, { plan: false }),
      rod('metal', [sk, cy + 0.12, tz], [sk, cy + 0.12, tz + 0.08], 0.009, { plan: false }),
      rod('metal', [sk, cy + 0.12, tz + 0.08], [sk, cy + 0.095, tz + 0.08], 0.008, { plan: false }),
      sphere('metal', [sk - 0.045, cy + 0.03, tz], 0.015, { plan: false }),
      sphere('metal', [sk + 0.045, cy + 0.03, tz], 0.015, { plan: false }),
    );
    // Hutch: backsplash, sides, shelves, jars, a clock and hanging utensils.
    const ys = cy + (h - cy) * 0.62;
    parts.push(
      span('accent', [-w / 2 + 0.018, w / 2 - 0.018], [cy, h - 0.02], [-d / 2, -d / 2 + 0.015], { plan: false }),
      span('body', [-w / 2, -w / 2 + 0.018], [cy, h], [-d / 2, -d / 2 + 0.14], { bevel: 0.004, plan: false }),
      span('body', [w / 2 - 0.018, w / 2], [cy, h], [-d / 2, -d / 2 + 0.14], { bevel: 0.004, plan: false }),
      span('body', [-w / 2, w / 2], [h - 0.02, h], [-d / 2, -d / 2 + 0.15], { bevel: 0.004, plan: false }),
      span('body', [-w / 2 + 0.018, w / 2 - 0.018], [ys, ys + 0.015], [-d / 2 + 0.015, -d / 2 + 0.11], { plan: false }),
    );
    const jh = Math.max(0.02, Math.min(0.07, h - 0.02 - (ys + 0.015) - 0.02));
    for (const jx of cells(2, -w / 2 + 0.04, xm - 0.04)) {
      parts.push(
        cyl('accent', [jx, ys + 0.015 + jh / 2, -d / 2 + 0.06], 0.025, jh, { plan: false }),
        cyl('metal', [jx, ys + 0.015 + jh + 0.004, -d / 2 + 0.06], 0.027, 0.008, { plan: false }),
      );
    }
    const clockY = (ys + 0.015 + h - 0.02) / 2;
    const cr = Math.max(0.02, Math.min(0.05, (h - 0.02 - ys - 0.015) / 2 - 0.008));
    parts.push(
      discZ('body', [sk, clockY, -d / 2 + 0.02], cr, 0.008, { plan: false }),
      torus('metal', [sk, clockY, -d / 2 + 0.024], cr, 0.005, { plan: false }),
      span('dark', [sk - 0.002, sk + 0.002], [clockY, clockY + cr * 0.7], [-d / 2 + 0.024, -d / 2 + 0.027], { plan: false }),
      span('dark', [sk, sk + cr * 0.5], [clockY - 0.002, clockY + 0.002], [-d / 2 + 0.024, -d / 2 + 0.027], { plan: false }),
    );
    const ru = cy + (ys - cy) * 0.75;
    const uz = -d / 2 + 0.03;
    const [u0, u1, u2] = cells(3, -w / 2 + 0.06, xm - 0.08);
    parts.push(
      rodX('metal', -w / 2 + 0.04, xm - 0.06, ru, uz, 0.005, { plan: false }),
      rod('metal', [u0, ru, uz], [u0, ru - 0.1, uz], 0.004, { plan: false }),
      box('metal', [u0, ru - 0.12, uz], [0.035, 0.04, 0.004], { plan: false }),
      rod('metal', [u1, ru, uz], [u1, ru - 0.09, uz], 0.004, { plan: false }),
      sphere('metal', [u1, ru - 0.105, uz + 0.008], 0.02, { plan: false }),
      rod('metal', [u2, ru, uz], [u2, ru - 0.07, uz], 0.004, { plan: false }),
      sphere('metal', [u2, ru - 0.1, uz], 0.018, { scale: [1, 1.6, 1], plan: false }),
    );
    return parts;
  },
  planDetail: ({ w, d }) => {
    const xm = -w / 2 + w * 0.52;
    const sr = Math.min(0.08, (w / 2 - xm) / 2 - 0.03, d / 2 - 0.05);
    return [
      ...cells(2, -w / 2 + 0.02, xm - 0.02).map((bx) => circle([bx, 0], 0.055)),
      circle([(xm + w / 2) / 2, 0.01], sr),
      line([-w / 2, -d / 2 + 0.15], [w / 2, -d / 2 + 0.15]),
    ];
  },
});

function houseGeom({ w, h }: Size3) {
  const t = 0.015;
  const hw = w / 2;
  const rh = Math.min(0.3, w * 0.32, h * 0.3);
  const th = Math.atan2(rh, hw);
  const wallTop = h - rh - t * Math.cos(th) - 0.003;
  const levels = clamp(Math.floor((wallTop - 0.03) / 0.28), 2, 3);
  const levelY = range(levels + 1).map((k) => 0.03 + (k * (wallTop - 0.03)) / levels);
  return { t, hw, rh, th, L: Math.hypot(hw, rh), wallTop, levels, levelY };
}

/** Miniature furniture for dollhouse room `kind` spanning x, sitting on y0, backed at z0. */
function miniRoom(kind: number, x: V2, y0: number, z0: number): Part[] {
  const cx = (x[0] + x[1]) / 2;
  const rw = x[1] - x[0];
  const o = { plan: false };
  switch (kind % 5) {
    case 0:
      return [
        span('furniture', [cx - rw * 0.3, cx + rw * 0.3], [y0, y0 + 0.05], [z0, z0 + 0.15], o),
        span('walls', [cx - rw * 0.22, cx + rw * 0.22], [y0 + 0.05, y0 + 0.068], [z0 + 0.005, z0 + 0.04], { bevel: 0.005, plan: false }),
      ];
    case 1:
      return [
        span('furniture', [cx - 0.05, cx + 0.05], [y0 + 0.055, y0 + 0.065], [z0 + 0.05, z0 + 0.13], o),
        vcyl('furniture', cx, z0 + 0.09, y0, y0 + 0.055, 0.008, o),
        span('floors', [cx - 0.09, cx - 0.06], [y0, y0 + 0.045], [z0 + 0.07, z0 + 0.11], o),
        span('floors', [cx + 0.06, cx + 0.09], [y0, y0 + 0.045], [z0 + 0.07, z0 + 0.11], o),
      ];
    case 2:
      return [
        span('furniture', [cx - rw * 0.3, cx + rw * 0.3], [y0, y0 + 0.035], [z0, z0 + 0.07], { bevel: 0.006, plan: false }),
        span('furniture', [cx - rw * 0.3, cx + rw * 0.3], [y0 + 0.035, y0 + 0.075], [z0, z0 + 0.02], { bevel: 0.006, plan: false }),
        span('roof', [cx - rw * 0.25, cx + rw * 0.25], [y0, y0 + 0.003], [z0 + 0.09, z0 + 0.17], o),
      ];
    case 3:
      return [
        span('walls', [cx - rw * 0.3, cx + rw * 0.3], [y0, y0 + 0.05], [z0, z0 + 0.08], { bevel: 0.012, plan: false }),
        span('furniture', [cx - rw * 0.26, cx + rw * 0.26], [y0 + 0.042, y0 + 0.048], [z0 + 0.01, z0 + 0.07], o),
      ];
    default:
      return [
        span('furniture', [x[0] + 0.01, x[1] - 0.01], [y0, y0 + 0.07], [z0, z0 + 0.05], o),
        span('walls', [x[0] + 0.01, x[1] - 0.01], [y0 + 0.07, y0 + 0.078], [z0, z0 + 0.055], o),
      ];
  }
}

const dollhouse = defineAsset({
  id: 'dollhouse',
  name: 'Dollhouse',
  category: 'kids',
  type: 'kids',
  group: 'Toys',
  tags: ['dollhouse', 'dolls house', 'toy house', 'pretend play', 'miniature'],
  defaultSize: { w: 0.8, d: 0.35, h: 1.0 },
  minSize: { w: 0.6, d: 0.28, h: 0.75 },
  maxSize: { w: 1.2, d: 0.5, h: 1.35 },
  wallSnap: true,
  slots: [
    matSlot('walls', 'Walls', 'wood-painted-white'),
    matSlot('roof', 'Roof & shutters', 'paint-blush'),
    matSlot('floors', 'Floors & base', 'wood-oak-light'),
    matSlot('furniture', 'Mini furniture', 'plastic-mint'),
  ],
  build: (size) => {
    const { w, d, h } = size;
    const g = houseGeom(size);
    const parts: Part[] = [
      span('floors', [-w / 2, w / 2], [0, 0.03], [-d / 2, d / 2], { bevel: 0.005 }),
      span('walls', [-w / 2 + g.t, w / 2 - g.t], [0.03, g.wallTop], [-d / 2, -d / 2 + g.t], { plan: false }),
      span('walls', [-w / 2, -w / 2 + g.t], [0.03, g.wallTop], [-d / 2, d / 2 - 0.01], { plan: false }),
      span('walls', [w / 2 - g.t, w / 2], [0.03, g.wallTop], [-d / 2, d / 2 - 0.01], { plan: false }),
      rodZ('roof', 0, g.wallTop + g.rh + g.t * Math.cos(g.th) * 0.5, -d / 2, d / 2, 0.012, { plan: false }),
      torus('roof', [0, g.wallTop + g.rh * 0.3, -d / 2 + g.t + 0.002], Math.min(0.045, g.rh * 0.18), 0.008, { plan: false }),
    ];
    // Gable roof panels.
    for (const sx of [-1, 1]) {
      parts.push(
        box('roof', [sx * (g.hw / 2 + (g.t / 2) * Math.sin(g.th)), g.wallTop + g.rh / 2 + (g.t / 2) * Math.cos(g.th), 0], [g.L, g.t, d], {
          rotation: [0, 0, -sx * g.th],
          plan: false,
        }),
      );
    }
    // Stepped back gable and chimney.
    for (const i of range(3)) {
      const hwid = g.hw * (1 - (i + 0.6) / 3);
      parts.push(span('walls', [-hwid, hwid], [g.wallTop + (i * g.rh) / 3, g.wallTop + ((i + 1) * g.rh) / 3], [-d / 2, -d / 2 + g.t], { plan: false }));
    }
    const chx = g.hw * 0.5;
    const yr = g.wallTop + g.rh * 0.5;
    parts.push(span('roof', [chx - 0.03, chx + 0.03], [yr - 0.03, Math.min(h, yr + 0.14)], [-d / 2 + 0.05, -d / 2 + 0.11], { plan: false }));
    // Floors, partitions, rooms and windows.
    const z0 = -d / 2 + g.t + 0.008;
    for (const k of range(g.levels)) {
      const yk = g.levelY[k + 1];
      parts.push(span('floors', [-w / 2 + g.t, w / 2 - g.t], [yk - 0.012, yk], [-d / 2 + g.t, d / 2 - 0.01], { plan: false }));
      const yb = g.levelY[k] + (k === 0 ? 0 : 0);
      const ry = yk - 0.012 - yb;
      parts.push(span('walls', [-0.006, 0.006], [yb, yk - 0.012], [-d / 2 + g.t, -d / 2 + g.t + (d - g.t) * 0.5], { plan: false }));
      for (const [side, rx] of [
        [0, [-w / 2 + g.t, -0.006]],
        [1, [0.006, w / 2 - g.t]],
      ] as [number, V2][]) {
        const rcx = (rx[0] + rx[1]) / 2;
        const wy: V2 = [yb + ry * 0.35, yb + ry * 0.75];
        const xo = side === 0 ? -w / 2 : w / 2;
        parts.push(
          ...miniRoom(k * 2 + side, rx, yb, z0),
          span('roof', [rcx - 0.045, rcx + 0.045], wy, [-d / 2 + g.t, -d / 2 + g.t + 0.004], { plan: false }),
          span('walls', [rcx - 0.004, rcx + 0.004], wy, [-d / 2 + g.t + 0.004, -d / 2 + g.t + 0.007], { plan: false }),
          span('roof', [xo - 0.003, xo + 0.003], wy, [-0.055, 0.055], { plan: false }),
          span('walls', [xo - 0.005, xo + 0.005], [(wy[0] + wy[1]) / 2 - 0.004, (wy[0] + wy[1]) / 2 + 0.004], [-0.055, 0.055], { plan: false }),
        );
      }
    }
    return parts;
  },
  planDetail: ({ w, d }) => [line([0, -d / 2], [0, d / 2]), rectPoly(-w / 2 + 0.015, -d / 2 + 0.015, w / 2 - 0.015, d / 2 - 0.01)],
});

const rockingHorse = defineAsset({
  id: 'rocking-horse',
  name: 'Rocking horse',
  category: 'kids',
  type: 'kids',
  group: 'Toys',
  tags: ['rocking horse', 'ride-on', 'toy', 'pony', 'nursery'],
  defaultSize: { w: 0.36, d: 0.95, h: 0.75 },
  minSize: { w: 0.3, d: 0.75, h: 0.6 },
  maxSize: { w: 0.48, d: 1.15, h: 0.9 },
  slots: [
    matSlot('horse', 'Horse', 'wood-painted-white'),
    matSlot('mane', 'Mane, tail & eyes', 'fabric-charcoal'),
    matSlot('saddle', 'Saddle & reins', 'solid-red'),
    matSlot('rockers', 'Rockers & handles', 'wood-walnut'),
  ],
  build: ({ w, d, h }) => {
    const sx = w / 0.36;
    const sy = h / 0.75;
    const sz = d / 0.95;
    const sm = Math.min(sx, sy, sz);
    const P = (x: number, y: number, z: number): V3 => [x * sx, y * sy, z * sz];
    const rx = w / 2 - 0.03;
    const yR = (z: number) => 0.03 + 0.543 * z * z;
    const parts: Part[] = [];
    for (const s of [-1, 1]) {
      const pts = spaced(9, -0.44, 0.44).map((z) => [s * rx, yR(z) * sy, z * sz] as V3);
      parts.push(...rodPath('rockers', pts, 0.02, { plan: true }));
      for (const z of [-0.44, 0.44]) parts.push(sphere('rockers', [s * rx, yR(z) * sy, z * sz], 0.022, { plan: false }));
      // Legs from rockers to the body.
      for (const lz of [-0.26, 0.26]) {
        parts.push(rod('horse', [s * rx * 0.9, yR(lz) * sy + 0.01, lz * sz], P(s * 0.06, 0.38, lz * 0.65), 0.022, { plan: false }));
      }
      // Stirrups, reins and eyes.
      parts.push(
        rod('saddle', P(s * 0.1, 0.53, -0.03), P(s * 0.115, 0.37, -0.03), 0.005, { plan: false }),
        torus('rockers', P(s * 0.115, 0.35, -0.03), 0.02, 0.005, { rotation: [0, Math.PI / 2, 0], plan: false }),
        rod('saddle', P(s * 0.045, 0.6, 0.42), P(s * 0.06, 0.56, 0.07), 0.005, { plan: false }),
        sphere('mane', P(s * 0.044, 0.665, 0.35), 0.01, { plan: false }),
        sphere('mane', P(s * 0.02, 0.585, 0.455), 0.006, { plan: false }),
        cyl('horse', P(s * 0.025, 0.705, 0.31), 0.014 * sm, 0.05 * sy, { rTop: 0.002, plan: false }),
      );
    }
    for (const z of [-0.3, 0.3]) parts.push(rodX('rockers', -rx, rx, yR(z) * sy + 0.01, z * sz, 0.014, { plan: false }));
    // Body, neck and head.
    parts.push(
      sphere('horse', P(0, 0.44, 0), 0.5, { scale: [0.2 * sx, 0.2 * sy, 0.52 * sz] }),
      rod('horse', P(0, 0.48, 0.15), P(0, 0.62, 0.28), 0.05 * sm, { plan: false }),
      box('horse', P(0, 0.63, 0.36), [0.085 * sx, 0.095 * sy, 0.2 * sz], { rotation: [0.55, 0, 0], bevel: 0.025, plan: false }),
    );
    // Mane, forelock and tail.
    for (const t of spaced(6, 0, 1)) {
      parts.push(sphere('mane', P(0, 0.7 - 0.2 * t, 0.29 - 0.16 * t), 0.028 * sm, { scale: [0.5, 1, 1], plan: false }));
    }
    parts.push(
      sphere('mane', P(0, 0.715, 0.34), 0.02 * sm, { plan: false }),
      rod('mane', P(0, 0.46, -0.25), P(0, 0.26, -0.36), 0.015 * sm, { rTop: 0.04 * sm, plan: false }),
    );
    // Saddle, pommel, handles and footrest.
    parts.push(
      box('saddle', P(0, 0.535, -0.03), [0.2 * sx, 0.035 * sy, 0.2 * sz], { bevel: 0.012, plan: false }),
      sphere('saddle', P(0, 0.56, 0.06), 0.022 * sm, { plan: false }),
      rodX('rockers', -0.1 * sx, 0.1 * sx, 0.65 * sy, 0.33 * sz, 0.012, { plan: false }),
      rodX('rockers', -0.15 * sx, 0.15 * sx, 0.3 * sy, 0.12 * sz, 0.012, { plan: false }),
    );
    return parts;
  },
  planDetail: ({ w, d }) => {
    const rx = w / 2 - 0.03;
    const z = (0.44 * d) / 0.95;
    return [line([-rx, -z], [-rx, z]), line([rx, -z], [rx, z])];
  },
});

function teepeeGeom({ w, d, h }: Size3) {
  const R = Math.min(w, d) / 2 - 0.03;
  const ch = h * 0.78;
  const rT = R * 0.08;
  const phi = Math.atan2(R - rT, ch);
  return { R, ch, rT, phi, dl: (ch * 0.55) / Math.cos(phi), dw: R * 0.62 };
}

const playTeepee = defineAsset({
  id: 'play-teepee',
  name: 'Play teepee',
  category: 'kids',
  type: 'kids',
  group: 'Toys',
  tags: ['teepee', 'tipi', 'play tent', 'reading nook', 'kids'],
  defaultSize: { w: 1.2, d: 1.2, h: 1.7 },
  minSize: { w: 0.9, d: 0.9, h: 1.35 },
  maxSize: { w: 1.6, d: 1.6, h: 2.1 },
  slots: [
    matSlot('canvas', 'Canvas', 'fabric-cream'),
    matSlot('poles', 'Poles', 'wood-pine'),
    matSlot('accent', 'Trim & cushion', 'fabric-blush'),
    matSlot('shade', 'Doorway', 'fabric-charcoal'),
  ],
  build: (size) => {
    const { h } = size;
    const g = teepeeGeom(size);
    const rAt = (y: number) => g.R - (g.R - g.rT) * (y / g.ch);
    const yb = g.ch * 0.58;
    const parts: Part[] = [
      cyl('canvas', [0, g.ch / 2, 0], g.R, g.ch, { rTop: g.rT, segments: 6 }),
      cyl('accent', [0, 0.06, 0], g.R + 0.004, 0.12, { rTop: rAt(0.12) + 0.004, segments: 6, plan: false }),
      cyl('accent', [0, yb + 0.025, 0], rAt(yb) + 0.004, 0.05, { rTop: rAt(yb + 0.05) + 0.004, segments: 6, plan: false }),
      ring('accent', [0, g.ch * 0.97, 0], g.rT + 0.03, 0.01, { plan: false }),
    ];
    // Poles through the apex (none on the front edge, where the door is).
    const k = (h - 0.01) / g.ch;
    for (const i of range(5)) {
      const a = ((i + 1) * Math.PI) / 3;
      const bx = 0.96 * g.R * Math.sin(a);
      const bz = 0.96 * g.R * Math.cos(a);
      parts.push(rod('poles', [bx, 0, bz], [bx * (1 - k), h - 0.01, bz * (1 - k)], 0.018, { plan: false }));
    }
    // Doorway on the front edge with rolled, tied-back flaps.
    const s = g.dl / 2;
    const c = Math.cos(g.phi);
    const sn = Math.sin(g.phi);
    parts.push(box('shade', [0, s * c + 0.006 * sn, g.R - s * sn + 0.006 * c], [g.dw, g.dl, 0.008], { rotation: [-g.phi, 0, 0], plan: false }));
    for (const sx of [-1, 1]) {
      parts.push(
        rod('canvas', [sx * (g.dw / 2 + 0.01), 0.03, g.R - 0.0], [sx * g.dw * 0.25, g.dl * c, g.R - g.dl * sn + 0.01], 0.03, { rTop: 0.015, plan: false }),
        sphere('accent', [sx * g.dw * 0.38, g.dl * c * 0.55, g.R - g.dl * 0.55 * sn + 0.02], 0.02, { plan: false }),
      );
    }
    parts.push(pillow('accent', [0, 0.06, g.R - 0.16], Math.min(0.45, g.R), 0.12, 0.3));
    return parts;
  },
  planDetail: (size) => {
    const g = teepeeGeom(size);
    const hex = range(6).map((i) => [g.R * Math.sin((i * Math.PI) / 3), g.R * Math.cos((i * Math.PI) / 3)] as V2);
    return [poly(hex), circle([0, 0], g.rT + 0.03), line([-g.dw / 2, g.R - 0.02], [g.dw / 2, g.R - 0.02])];
  },
});

const MAT_SLOTS = ['red', 'yellow', 'blue', 'green'];

function matGrid({ w, d }: Size3) {
  return { nx: clamp(Math.round(w / 0.3), 1, 6), nz: clamp(Math.round(d / 0.3), 1, 5) };
}

const playMat = defineAsset({
  id: 'play-mat',
  name: 'Alphabet play mat',
  category: 'kids',
  type: 'kids',
  group: 'Toys',
  tags: ['play mat', 'foam mat', 'alphabet', 'puzzle mat', 'floor', 'nursery'],
  defaultSize: { w: 1.8, d: 1.2, h: 0.015 },
  minSize: { w: 0.6, d: 0.6, h: 0.01 },
  maxSize: { w: 3.0, d: 3.0, h: 0.025 },
  resizable: { h: false },
  slots: [
    matSlot('red', 'Red tiles', 'plastic-red'),
    matSlot('yellow', 'Yellow tiles', 'plastic-yellow'),
    matSlot('blue', 'Blue tiles', 'plastic-blue'),
    matSlot('green', 'Green tiles', 'plastic-green'),
  ],
  build: (size) => {
    const { w, d, h } = size;
    const { nx, nz } = matGrid(size);
    const parts: Part[] = [];
    for (const [j, [z0, z1]] of cellSpans(nz, -d / 2, d / 2).entries()) {
      for (const [i, [x0, x1]] of cellSpans(nx, -w / 2, w / 2).entries()) {
        const k = j * nx + i;
        parts.push(span(MAT_SLOTS[(i + 2 * j) % 4], [x0 + 0.0015, x1 - 0.0015], [0, h * 0.8], [z0 + 0.0015, z1 - 0.0015], { bevel: 0.002 }));
        const sz = Math.min(x1 - x0, z1 - z0) * 0.55;
        parts.push(...glyphFlat(MAT_SLOTS[(i + 2 * j + 2) % 4], ALPHABET[k % 26], (x0 + x1) / 2, (z0 + z1) / 2, sz, [h * 0.8, h]));
      }
    }
    return parts;
  },
  planDetail: (size) => {
    const { w, d } = size;
    const { nx, nz } = matGrid(size);
    const strokes: PlanStroke[] = [];
    for (const [x] of cellSpans(nx, -w / 2, w / 2).slice(1)) strokes.push(line([x, -d / 2], [x, d / 2]));
    for (const [z] of cellSpans(nz, -d / 2, d / 2).slice(1)) strokes.push(line([-w / 2, z], [w / 2, z]));
    for (const [j, [z0, z1]] of cellSpans(nz, -d / 2, d / 2).entries()) {
      for (const [i, [x0, x1]] of cellSpans(nx, -w / 2, w / 2).entries()) {
        const sz = Math.min(x1 - x0, z1 - z0) * 0.55;
        strokes.push(...glyphFlatPlan(ALPHABET[(j * nx + i) % 26], (x0 + x1) / 2, (z0 + z1) / 2, sz));
      }
    }
    return strokes;
  },
});

const BLOCK_SLOTS = ['red', 'yellow', 'blue', 'wood'];

function blockGeom({ w, d }: Size3) {
  const s = clamp(Math.min(w, d) * 0.18, 0.045, 0.075);
  return { s, ball: [w * 0.28, -d * 0.24] as V2 };
}

const toyBlocks = defineAsset({
  id: 'toy-blocks',
  name: 'Toy block tower',
  category: 'kids',
  type: 'kids',
  group: 'Toys',
  tags: ['building blocks', 'toy blocks', 'wooden blocks', 'tower', 'toys'],
  defaultSize: { w: 0.45, d: 0.4, h: 0.38 },
  minSize: { w: 0.3, d: 0.3, h: 0.22 },
  maxSize: { w: 0.8, d: 0.8, h: 0.6 },
  slots: [
    matSlot('red', 'Red blocks & ball', 'plastic-red'),
    matSlot('yellow', 'Yellow blocks', 'plastic-yellow'),
    matSlot('blue', 'Blue blocks', 'plastic-blue'),
    matSlot('wood', 'Natural blocks', 'wood-pine'),
  ],
  build: (size) => {
    const { w, d, h } = size;
    const { s, ball } = blockGeom(size);
    const rand = rng(7);
    const parts: Part[] = [];
    // Tower topped with a triangular roof block.
    const tx = -w * 0.12;
    const tz = -d * 0.1;
    const levels = Math.max(1, Math.floor((h - 0.9 * s - 0.003) / s));
    for (const l of range(levels)) {
      const jx = (rand() - 0.5) * s * 0.12;
      const jz = (rand() - 0.5) * s * 0.12;
      parts.push(
        box(BLOCK_SLOTS[l % 4], [tx + jx, l * s + s / 2, tz + jz], [s, s, s], {
          rotation: [0, (rand() - 0.5) * 0.5, 0],
          bevel: s * 0.08,
          plan: l === 0,
        }),
      );
    }
    const r = 0.6 * s;
    parts.push(cyl(BLOCK_SLOTS[levels % 4], [tx, levels * s + 0.5 * r, tz], r, s, { segments: 3, rotation: [-Math.PI / 2, 0, 0], plan: false }));
    // A short stack with a pillar block.
    const sx = w * 0.2;
    const sz = d * 0.18;
    parts.push(
      box('wood', [sx, s / 2, sz], [s, s, s], { rotation: [0, 0.3, 0], bevel: s * 0.08 }),
      vcyl('blue', sx, sz, s, 2 * s, 0.4 * s, { plan: false }),
      sphere('red', [ball[0], 0.6 * s, ball[1]], 0.6 * s),
    );
    // Scattered blocks on the floor.
    const taken: V2[] = [
      [tx, tz],
      [sx, sz],
      ball,
    ];
    const want = clamp(Math.round((w * d) / 0.025), 3, 12);
    let placed = 0;
    for (let i = 0; i < 60 && placed < want; i++) {
      const x = (rand() * 2 - 1) * (w / 2 - 0.75 * s);
      const z = (rand() * 2 - 1) * (d / 2 - 0.75 * s);
      if (taken.some(([ax, az]) => Math.hypot(ax - x, az - z) < 1.3 * s)) continue;
      taken.push([x, z]);
      const slot = BLOCK_SLOTS[placed % 4];
      parts.push(
        rand() < 0.25
          ? rodX(slot, x - s / 2, x + s / 2, 0.4 * s, z, 0.4 * s)
          : box(slot, [x, s / 2, z], [s, s, s], { rotation: [0, rand() * 1.5, 0], bevel: s * 0.08 }),
      );
      placed++;
    }
    return parts;
  },
  planDetail: (size) => {
    const { s, ball } = blockGeom(size);
    return [circle(ball, 0.6 * s)];
  },
});

function easelGeom({ d, h }: Size3) {
  const zb = d / 2 - 0.03;
  const H = h - 0.02;
  return { zb, H, phi: Math.atan2(zb, H), zf: (y: number) => zb * (1 - y / H) };
}

const kidsEasel = defineAsset({
  id: 'kids-easel',
  name: 'Kids art easel',
  category: 'kids',
  type: 'activities',
  group: 'Creative',
  tags: ['easel', 'chalkboard', 'art', 'painting', 'drawing', 'kids'],
  defaultSize: { w: 0.62, d: 0.55, h: 1.2 },
  minSize: { w: 0.45, d: 0.45, h: 0.95 },
  maxSize: { w: 0.8, d: 0.7, h: 1.4 },
  slots: [
    matSlot('frame', 'Frame & back board', 'wood-pine'),
    matSlot('board', 'Chalkboard', 'chalkboard'),
    matSlot('paper', 'Paper & chalk', 'paper-art'),
    matSlot('paint', 'Paint pots & drawing', 'plastic-yellow'),
  ],
  build: (size) => {
    const { w, h } = size;
    const g = easelGeom(size);
    const c = Math.cos(g.phi);
    const sn = Math.sin(g.phi);
    const front: V3 = [-g.phi, 0, 0];
    const back: V3 = [g.phi, 0, 0];
    /** Point at height y on the front plane, offset n along its outward normal. */
    const F = (y: number, n = 0): V3 => [0, y + n * sn, g.zf(y) + n * c];
    const parts: Part[] = [rodX('frame', -w / 2 + 0.008, w / 2 - 0.008, g.H, 0, 0.02, { plan: false })];
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        parts.push(rod('frame', [sx * (w / 2 - 0.025), 0, sz * g.zb], [sx * (w / 2 - 0.025), g.H, 0], 0.018));
      }
    }
    // Chalkboard (front) and back board, each with top and bottom rails.
    const yb0 = Math.max(0.42, h * 0.38);
    const yb1 = g.H - 0.1;
    const yc = (yb0 + yb1) / 2;
    const len = (yb1 - yb0) / c;
    parts.push(
      box('board', F(yc), [w - 0.09, len, 0.012], { rotation: front, plan: false }),
      box('frame', F(yb1), [w - 0.06, 0.03, 0.02], { rotation: front, plan: false }),
      box('frame', F(yb0), [w - 0.06, 0.03, 0.02], { rotation: front, plan: false }),
      box('frame', [0, yc, -g.zf(yc)], [w - 0.09, len, 0.012], { rotation: back, plan: false }),
      box('paper', [0, yc + 0.04 + 0.009 * sn, -g.zf(yc + 0.04) - 0.009 * c], [w * 0.5, len * 0.6, 0.003], { rotation: back, plan: false }),
    );
    // Paper roll at the top with a sheet pulled down over the board, and a sunny drawing on it.
    const ry = g.H - 0.05;
    parts.push(rodX('paper', -w / 2 + 0.06, w / 2 - 0.06, ry, g.zf(ry) + 0.035, 0.028, { plan: false }));
    for (const sx of [-1, 1]) parts.push(rodZ('frame', sx * (w / 2 - 0.05), ry, g.zf(ry), g.zf(ry) + 0.035, 0.008, { plan: false }));
    const yp0 = Math.max(yb0 + 0.05, yb1 - 0.32);
    const yp1 = g.H - 0.06;
    const yp = (yp0 + yp1) / 2;
    parts.push(box('paper', F(yp, 0.01), [w * 0.62, (yp1 - yp0) / c, 0.003], { rotation: front, plan: false }));
    const ys = yp0 + (yp1 - yp0) * 0.65;
    parts.push(
      cyl('paint', [-w * 0.1, ys + 0.013 * sn, g.zf(ys) + 0.013 * c], 0.035, 0.003, { rotation: [Math.PI / 2 - g.phi, 0, 0], plan: false }),
      box('board', F(yp0 + 0.04, 0.013), [w * 0.45, 0.012, 0.003], { rotation: front, plan: false }),
    );
    // Tray with paint pots and chalk.
    const yt = yb0 - 0.02;
    const trayD = Math.min(0.09, size.d / 2 - g.zf(yt) - 0.012);
    const tz0 = g.zf(yt) - 0.01;
    parts.push(
      span('frame', [-w / 2 + 0.04, w / 2 - 0.04], [yt - 0.015, yt], [tz0, g.zf(yt) + trayD], { plan: false }),
      rodX('frame', -w / 2 + 0.04, w / 2 - 0.04, yt + 0.006, g.zf(yt) + trayD - 0.006, 0.006, { plan: false }),
    );
    const pz = g.zf(yt) + trayD / 2;
    for (const px of cells(3, -w / 2 + 0.08, 0.02)) parts.push(cyl('paint', [px, yt + 0.025, pz], 0.018, 0.05, { plan: false }));
    parts.push(
      rodX('paper', 0.06, 0.12, yt + 0.006, pz - 0.01, 0.005, { plan: false }),
      rodX('paper', 0.08, 0.15, yt + 0.006, pz + 0.012, 0.005, { plan: false }),
    );
    // Storage shelf between the legs with a supply box and a paper stack.
    const sy = 0.18;
    parts.push(
      span('frame', [-w / 2 + 0.04, w / 2 - 0.04], [sy, sy + 0.015], [-g.zf(sy) + 0.02, g.zf(sy) - 0.02], { plan: false }),
      span('paint', [-0.12, 0.04], [sy + 0.015, sy + 0.075], [-0.06, 0.06], { bevel: 0.006, plan: false }),
      span('paper', [0.07, Math.min(0.2, w / 2 - 0.06)], [sy + 0.015, sy + 0.04], [-0.08, 0.08], { plan: false }),
    );
    return parts;
  },
  planDetail: (size) => {
    const { w } = size;
    const g = easelGeom(size);
    const y = Math.max(0.42, size.h * 0.38);
    return [line([-w / 2 + 0.04, g.zf(y)], [w / 2 - 0.04, g.zf(y)]), line([-w / 2 + 0.04, -g.zf(y)], [w / 2 - 0.04, -g.zf(y)])];
  },
});

export const KIDS_ASSETS: AssetDefinition[] = [
  crib,
  changingTable,
  gliderChair,
  bedBunk,
  bedLoft,
  bedToddler,
  bedRaceCar,
  toyChest,
  kidsTableSet,
  bookDisplay,
  playKitchen,
  dollhouse,
  rockingHorse,
  playTeepee,
  playMat,
  toyBlocks,
  kidsEasel,
];

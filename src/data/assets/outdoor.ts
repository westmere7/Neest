import type { AssetDefinition, Part, Size3 } from './types';
import { PLANT_SPECIES } from './plantSpecies';
import {
  blobCluster,
  box,
  cellSpans,
  cells,
  circle,
  clamp,
  cushion,
  cyl,
  defineAsset,
  discZ,
  foliage,
  fronts,
  lathe,
  leaf,
  legs4,
  line,
  matSlot,
  pillow,
  pot,
  range,
  rectPoly,
  ring,
  rng,
  rod,
  rodPath,
  rodX,
  rodZ,
  slats,
  span,
  spaced,
  sphere,
  torus,
  vcyl,
  type FrontSpec,
  type PartOpts,
  type V2,
  type V3,
} from './parts';

// Balcony & outdoor: patio furniture, grills, planters, outdoor lighting.

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

const add = (a: V3, b: V3, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];

/** Board from a to b in a plane of constant x: `tx` wide (x) and `tz` thick. */
function beamYZ(slot: string, a: V3, b: V3, tx: number, tz: number, opts?: PartOpts): Part {
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  return box(slot, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], [tx, Math.hypot(dy, dz), tz], {
    ...opts,
    rotation: [Math.atan2(dz, dy), 0, 0],
  });
}

/** Board from a to b in a plane of constant z: `tz` deep (z) and `tx` thick. */
function beamXY(slot: string, a: V3, b: V3, tx: number, tz: number, opts?: PartOpts): Part {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  return box(slot, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], [tx, Math.hypot(dx, dy), tz], {
    ...opts,
    rotation: [0, 0, Math.atan2(-dx, dy)],
  });
}

const TO_X: V3 = [0, 0, Math.PI / 2];

// ---------------------------------------------------------------------------
// Outdoor tables
// ---------------------------------------------------------------------------

const patioTable = defineAsset({
  id: 'patio-table',
  name: 'Patio dining table',
  category: 'outdoor',
  type: 'surfaces',
  group: 'Outdoor tables',
  tags: ['patio', 'garden', 'outdoor', 'dining table', 'teak', 'table'],
  defaultSize: { w: 1.6, d: 0.9, h: 0.75 },
  minSize: { w: 0.9, d: 0.8, h: 0.7 },
  maxSize: { w: 2.4, d: 1.1, h: 0.78 },
  slots: [matSlot('wood', 'Teak top', 'wood-teak'), matSlot('frame', 'Aluminium frame', 'metal-anthracite')],
  build: ({ w, d, h }) => {
    const tt = 0.035;
    const b = 0.06;
    const n = Math.max(4, Math.round((d - 2 * b) / 0.095));
    return [
      // Breadboard frame around slatted boards
      span('wood', [-w / 2, w / 2], [h - tt, h], [-d / 2, -d / 2 + b], { bevel: 0.006 }),
      span('wood', [-w / 2, w / 2], [h - tt, h], [d / 2 - b, d / 2], { bevel: 0.006 }),
      span('wood', [-w / 2, -w / 2 + b], [h - tt, h], [-d / 2 + b, d / 2 - b], { bevel: 0.006 }),
      span('wood', [w / 2 - b, w / 2], [h - tt, h], [-d / 2 + b, d / 2 - b], { bevel: 0.006 }),
      ...slats('wood', [-w / 2 + b, w / 2 - b], [h - tt + 0.004, h - 0.002], [-d / 2 + b, d / 2 - b], n, {
        axis: 'z',
        gap: 0.12,
        bevel: 0.004,
        plan: false,
      }),
      // Apron, legs and the parasol hole
      span('frame', [-w / 2 + 0.08, w / 2 - 0.08], [h - 0.1, h - tt], [-d / 2 + 0.08, -d / 2 + 0.1], { plan: false }),
      span('frame', [-w / 2 + 0.08, w / 2 - 0.08], [h - 0.1, h - tt], [d / 2 - 0.1, d / 2 - 0.08], { plan: false }),
      span('frame', [-w / 2 + 0.08, -w / 2 + 0.1], [h - 0.1, h - tt], [-d / 2 + 0.1, d / 2 - 0.1], { plan: false }),
      span('frame', [w / 2 - 0.1, w / 2 - 0.08], [h - 0.1, h - tt], [-d / 2 + 0.1, d / 2 - 0.1], { plan: false }),
      ...legs4('frame', w, d, 0.04, 0, h - tt, 0.05),
      ring('frame', [0, h - 0.004, 0], 0.025, 0.006, { plan: false }),
    ];
  },
  planDetail: ({ w, d }) => {
    const b = 0.06;
    const n = Math.max(4, Math.round((d - 2 * b) / 0.095));
    return [
      rectPoly(-w / 2 + b, -d / 2 + b, w / 2 - b, d / 2 - b),
      ...cellSpans(n, -d / 2 + b, d / 2 - b)
        .slice(1)
        .map(([z]) => line([-w / 2 + b, z], [w / 2 - b, z])),
      circle([0, 0], 0.03),
    ];
  },
});

/** Bistro chair facing ±x (s = -1 sits on the left facing +x). Built in chair space (u across, v forwards). */
function bistroChair(s: number, cx: number, h: number): Part[] {
  const X = (v: number) => cx - s * v;
  const P = (u: number, y: number, v: number): V3 => [X(v), y, u];
  const sp = (slot: string, u: V2, y: V2, v: V2): Part => {
    const xa = X(v[0]);
    const xb = X(v[1]);
    return span(slot, [Math.min(xa, xb), Math.max(xa, xb)], y, u, { bevel: 0.004, plan: false });
  };
  const lean = 0.14;
  const parts: Part[] = [];
  for (const u of [-0.18, 0.18]) {
    parts.push(
      rod('frame', P(u, 0.005, 0.19), P(u * 0.95, 0.43, 0.15), 0.011, { plan: false }),
      ...rodPath('frame', [P(u, 0.005, -0.19), P(u * 0.95, 0.43, -0.15), P(u * 0.92, h - 0.015, -0.21)], 0.011),
      rod('frame', P(u * 0.95, 0.42, -0.15), P(u * 0.95, 0.42, 0.17), 0.008, { plan: false }),
    );
  }
  parts.push(
    rod('frame', P(-0.17, 0.42, 0.16), P(0.17, 0.42, 0.16), 0.008, { plan: false }),
    rod('frame', P(-0.17, 0.12, 0.17), P(0.17, 0.12, 0.17), 0.007, { plan: false }),
  );
  // Slatted seat
  for (const [v0, v1] of cellSpans(5, -0.16, 0.2)) parts.push(sp('wood', [-0.19, 0.19], [0.43, 0.45], [v0 + 0.005, v1 - 0.005]));
  // Three curved back slats, leaning with the back posts
  const backV = (y: number) => -0.15 - ((y - 0.43) / (h - 0.45)) * 0.06;
  for (const y of spaced(3, h - 0.2, h - 0.06)) {
    parts.push(box('wood', [X(backV(y)), y, 0], [0.014, 0.05, 0.34], { rotation: [0, 0, -s * lean], plan: false }));
  }
  // The footprint seat block
  parts.push(span('wood', [Math.min(X(-0.2), X(0.2)), Math.max(X(-0.2), X(0.2))], [0.4, 0.43], [-0.2, 0.2], { plan: true }));
  return parts;
}

const bistroSet = defineAsset({
  id: 'bistro-set',
  name: 'Bistro table set',
  category: 'outdoor',
  type: 'surfaces',
  group: 'Outdoor tables',
  tags: ['bistro', 'balcony', 'cafe', 'patio', 'outdoor', 'table and chairs'],
  defaultSize: { w: 1.5, d: 0.7, h: 0.88 },
  minSize: { w: 1.3, d: 0.6, h: 0.82 },
  maxSize: { w: 1.8, d: 0.8, h: 0.95 },
  slots: [
    matSlot('frame', 'Metal frame', 'metal-black-matte'),
    matSlot('wood', 'Slats', 'wood-teak'),
    matSlot('top', 'Mosaic top', 'tile-mosaic-blue'),
    matSlot('accent', 'Espresso cups', 'ceramic-white'),
  ],
  build: ({ w, d, h }) => {
    const topY = 0.72;
    const r = Math.min(0.3, d / 2 - 0.03);
    const parts: Part[] = [
      vcyl('top', 0, 0, topY - 0.02, topY, r),
      ring('frame', [0, topY - 0.01, 0], r, 0.012, { plan: false }),
      vcyl('frame', 0, 0, 0.12, topY - 0.02, 0.022, { plan: false }),
      ...bistroChair(-1, -(w / 2 - 0.22), h),
      ...bistroChair(1, w / 2 - 0.22, h),
    ];
    for (const a of [Math.PI / 2, Math.PI / 2 + (2 * Math.PI) / 3, Math.PI / 2 + (4 * Math.PI) / 3]) {
      const f: V3 = [Math.cos(a) * r * 0.8, 0.01, Math.sin(a) * r * 0.8];
      parts.push(rod('frame', [0, 0.14, 0], f, 0.012, { plan: false }), sphere('frame', f, 0.016, { plan: false }));
    }
    // Two espresso cups on saucers
    for (const x of [-0.12, 0.12]) {
      parts.push(
        vcyl('accent', x, 0.04, topY, topY + 0.008, 0.055, { plan: false }),
        lathe('accent', [x, topY + 0.008, 0.04], [
          [0, 0],
          [0.022, 0],
          [0.03, 0.05],
          [0.026, 0.05],
          [0.018, 0.012],
          [0, 0.012],
        ], { segments: 16, plan: false }),
        torus('accent', [x + Math.sign(x) * 0.035, topY + 0.035, 0.04], 0.011, 0.003, { plan: false }),
      );
    }
    return parts;
  },
  planDetail: ({ d }) => [circle([0, 0], Math.min(0.3, d / 2 - 0.03))],
});

const picnicTable = defineAsset({
  id: 'picnic-table',
  name: 'Picnic table',
  category: 'outdoor',
  type: 'surfaces',
  group: 'Outdoor tables',
  tags: ['picnic', 'garden', 'outdoor', 'bench', 'table', 'wooden'],
  defaultSize: { w: 1.8, d: 1.5, h: 0.75 },
  minSize: { w: 1.2, d: 1.3, h: 0.7 },
  maxSize: { w: 2.4, d: 1.7, h: 0.8 },
  slots: [
    matSlot('wood', 'Wood', 'wood-pine'),
    matSlot('metal', 'Bolts', 'metal-brushed-steel'),
    matSlot('cloth', 'Table runner', 'fabric-terracotta'),
  ],
  build: ({ w, d, h }) => {
    const tw = clamp(d * 0.48, 0.6, 0.8);
    const by = 0.45;
    const bw = 0.26;
    const bz = d / 2 - 0.02 - bw / 2;
    const fx = w / 2 - clamp(w * 0.15, 0.22, 0.4);
    const rw = Math.min(0.32, w * 0.2);
    const parts: Part[] = [
      ...slats('wood', [-w / 2, w / 2], [h - 0.04, h], [-tw / 2, tw / 2], 5, { axis: 'z', gap: 0.06, bevel: 0.006 }),
      span('wood', [-0.025, 0.025], [h - 0.09, h - 0.04], [-tw / 2 + 0.03, tw / 2 - 0.03], { plan: false }),
      // Runner laid over the middle, hanging over both edges
      span('cloth', [-rw, rw], [h - 0.001, h + 0.003], [-tw / 2 - 0.004, tw / 2 + 0.004], { plan: false }),
      span('cloth', [-rw, rw], [h - 0.16, h], [tw / 2, tw / 2 + 0.004], { plan: false }),
      span('cloth', [-rw, rw], [h - 0.16, h], [-tw / 2 - 0.004, -tw / 2], { plan: false }),
    ];
    for (const s of [-1, 1]) {
      parts.push(...slats('wood', [-w / 2 + 0.02, w / 2 - 0.02], [by - 0.04, by], [s * bz - bw / 2, s * bz + bw / 2], 2, {
        axis: 'z',
        gap: 0.06,
        bevel: 0.006,
      }));
      const x = s * fx;
      parts.push(
        // Cleat, bench bearer, splayed legs and a diagonal brace
        span('wood', [x - 0.025, x + 0.025], [h - 0.09, h - 0.04], [-tw / 2 + 0.03, tw / 2 - 0.03], { plan: false }),
        span('wood', [x - 0.025, x + 0.025], [by - 0.12, by - 0.04], [-d / 2 + 0.03, d / 2 - 0.03], { plan: false }),
        beamYZ('wood', [x + s * 0.05, 0.03, -(d / 2 - 0.25)], [x + s * 0.05, h - 0.09, -(tw / 2 - 0.12)], 0.05, 0.1, { plan: false }),
        beamYZ('wood', [x + s * 0.05, 0.03, d / 2 - 0.25], [x + s * 0.05, h - 0.09, tw / 2 - 0.12], 0.05, 0.1, { plan: false }),
        beamXY('wood', [x, by - 0.1, 0], [s * 0.05, h - 0.09, 0], 0.04, 0.08, { plan: false }),
      );
      for (const z of [-1, 1]) {
        parts.push(
          discZ('metal', [x + s * 0.08, by - 0.08, z * (d / 2 - 0.25 - 0.12)], 0.012, 0.01, { rotation: TO_X, plan: false }),
          discZ('metal', [x + s * 0.08, h - 0.065, z * (tw / 2 - 0.14)], 0.012, 0.01, { rotation: TO_X, plan: false }),
        );
      }
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const tw = clamp(d * 0.48, 0.6, 0.8);
    return [rectPoly(-w / 2, -tw / 2, w / 2, tw / 2), line([-w / 2, 0], [w / 2, 0])];
  },
});

// ---------------------------------------------------------------------------
// Outdoor seating
// ---------------------------------------------------------------------------

const patioChair = defineAsset({
  id: 'patio-chair',
  name: 'Patio chair',
  category: 'outdoor',
  type: 'seating',
  group: 'Outdoor seating',
  tags: ['patio', 'garden', 'outdoor', 'chair', 'armchair', 'dining'],
  defaultSize: { w: 0.58, d: 0.62, h: 0.88 },
  minSize: { w: 0.5, d: 0.55, h: 0.8 },
  maxSize: { w: 0.65, d: 0.7, h: 0.95 },
  slots: [
    matSlot('frame', 'Frame', 'metal-anthracite'),
    matSlot('wood', 'Teak arms & slats', 'wood-teak'),
    matSlot('cushion', 'Cushions', 'fabric-cream'),
  ],
  build: ({ w, d, h }) => {
    const sh = 0.44;
    const zb = -d / 2 + 0.04;
    const zf = d / 2 - 0.04;
    const xo = w / 2 - 0.03;
    const armY = Math.min(0.64, h - 0.15);
    const b0: V2 = [sh - 0.04, zb + 0.08];
    const b1: V2 = [h - 0.02, zb];
    const lean = Math.atan2(b0[1] - b1[1], b1[0] - b0[0]);
    const zAt = (y: number) => b0[1] + ((y - b0[0]) / (b1[0] - b0[0])) * (b1[1] - b0[1]);
    const n: V3 = [0, Math.sin(lean), Math.cos(lean)];
    const parts: Part[] = [];
    for (const s of [-1, 1]) {
      const x = s * xo;
      parts.push(
        rod('frame', [x, 0.01, zf - 0.02], [x, armY, zf - 0.04], 0.016, { plan: false }),
        rod('frame', [x, 0.01, zb + 0.02], [x, b0[0], b0[1]], 0.016, { plan: false }),
        rod('frame', [x, b0[0], b0[1]], [x, b1[0], b1[1]], 0.016, { plan: false }),
        rodZ('frame', x, sh - 0.04, b0[1], zf - 0.03, 0.014, { plan: false }),
        rodZ('frame', x, armY, zAt(armY), zf - 0.04, 0.014, { plan: false }),
        span('wood', [x - 0.03, x + 0.03], [armY + 0.012, armY + 0.032], [zAt(armY) - 0.01, zf - 0.01], { bevel: 0.008, plan: false }),
        sphere('frame', [x, 0.01, zf - 0.02], 0.012, { plan: false }),
        sphere('frame', [x, 0.01, zb + 0.02], 0.012, { plan: false }),
      );
    }
    parts.push(
      rodX('frame', -xo, xo, sh - 0.04, zf - 0.03, 0.012, { plan: false }),
      rodX('frame', -xo, xo, h - 0.03, zAt(h - 0.03), 0.012, { plan: false }),
      ...slats('wood', [-xo + 0.02, xo - 0.02], [sh - 0.04, sh - 0.015], [b0[1], zf - 0.03], 6, { axis: 'z', gap: 0.15, plan: false }),
      cushion('cushion', [-xo + 0.025, xo - 0.025], [sh - 0.015, sh + 0.04], [b0[1] + 0.02, zf - 0.02], { softness: 0.4 }),
    );
    // Back slats and a back cushion following the reclined back
    for (const y of spaced(3, sh + 0.12, h - 0.08)) {
      parts.push(box('wood', [0, y, zAt(y)], [2 * xo - 0.03, 0.05, 0.016], { rotation: [-lean, 0, 0], plan: false }));
    }
    const yc = (sh + h) / 2;
    parts.push(
      box('cushion', add([0, yc, zAt(yc)], n, 0.04), [2 * xo - 0.08, h - sh - 0.16, 0.06], { rotation: [-lean, 0, 0], bevel: 0.025, plan: false }),
    );
    return parts;
  },
});

const sunLounger = defineAsset({
  id: 'sun-lounger',
  name: 'Sun lounger',
  category: 'outdoor',
  type: 'seating',
  group: 'Outdoor seating',
  tags: ['sun lounger', 'deck chair', 'chaise', 'pool', 'outdoor', 'sunbed'],
  defaultSize: { w: 0.7, d: 2.0, h: 0.85 },
  minSize: { w: 0.6, d: 1.8, h: 0.7 },
  maxSize: { w: 0.8, d: 2.1, h: 1.0 },
  slots: [
    matSlot('wood', 'Frame', 'wood-teak'),
    matSlot('cushion', 'Cushions', 'fabric-white-cotton'),
    matSlot('accent', 'Pillow & towel', 'fabric-sky'),
    matSlot('metal', 'Wheels & fittings', 'metal-brushed-steel'),
  ],
  build: ({ w, d, h }) => {
    const by = 0.32;
    const zh = -d / 2 + Math.min(0.75, d * 0.38);
    const Lb = zh + d / 2 - 0.04;
    const ang = Math.asin(clamp((h - by - 0.08) / Lb, 0.2, 0.95));
    const along: V3 = [0, Math.sin(ang), -Math.cos(ang)];
    const n: V3 = [0, Math.cos(ang), Math.sin(ang)];
    const hinge: V3 = [0, by - 0.05, zh];
    const rx = w / 2 - 0.04;
    const parts: Part[] = [
      // Bed slats and cushion
      ...slats('wood', [-w / 2 + 0.07, w / 2 - 0.07], [by - 0.06, by - 0.04], [zh + 0.01, d / 2 - 0.03], Math.round((d / 2 - zh) / 0.08), {
        axis: 'z',
        gap: 0.25,
        plan: false,
      }),
      cushion('cushion', [-w / 2 + 0.06, w / 2 - 0.06], [by - 0.04, by + 0.03], [zh + 0.02, d / 2 - 0.02], { softness: 0.45 }),
      // Raised backrest with its cushion and support strut
      box('wood', add(hinge, along, Lb / 2), [w - 0.14, 0.03, Lb], { rotation: [ang, 0, 0], plan: false }),
      box('cushion', add(add(hinge, along, Lb / 2), n, 0.05), [w - 0.14, 0.06, Lb - 0.04], { rotation: [ang, 0, 0], bevel: 0.025, plan: false }),
      rod('metal', [0, by - 0.08, zh - Lb * 0.55 * Math.cos(ang)], add(add(hinge, along, Lb * 0.55), n, -0.02), 0.012, { plan: false }),
      pillow('accent', add(add(hinge, along, Lb * 0.75), n, 0.12), Math.min(0.42, w - 0.2), 0.12, 0.09, { lean: Math.PI / 2 - ang }),
      // Rolled towel at the foot end
      rodX('accent', -w / 2 + 0.12, w / 2 - 0.12, by + 0.07, d / 2 - 0.15, 0.04, { plan: false }),
      // Frame rails across the ends
      span('wood', [-rx, rx], [by - 0.12, by - 0.04], [d / 2 - 0.05, d / 2], { bevel: 0.01, plan: false }),
      span('wood', [-rx, rx], [by - 0.12, by - 0.04], [-d / 2 + 0.02, -d / 2 + 0.07], { bevel: 0.01, plan: false }),
      rodX('metal', -w / 2 + 0.03, w / 2 - 0.03, 0.09, -d / 2 + 0.1, 0.012, { plan: false }),
    ];
    for (const s of [-1, 1]) {
      const x = s * rx;
      parts.push(
        span('wood', [x - 0.04, x + 0.04], [by - 0.12, by - 0.04], [-d / 2 + 0.02, d / 2], { bevel: 0.01 }),
        span('wood', [x - 0.025, x + 0.025], [0, by - 0.12], [d / 2 - 0.08, d / 2 - 0.02], { plan: false }),
        span('wood', [x - 0.025, x + 0.025], [0, by - 0.12], [zh - 0.03, zh + 0.03], { plan: false }),
        span('wood', [x - 0.025, x + 0.025], [0.09, by - 0.12], [-d / 2 + 0.07, -d / 2 + 0.13], { plan: false }),
        cyl('metal', [s * (w / 2 - 0.03), 0.09, -d / 2 + 0.1], 0.09, 0.04, { rotation: TO_X, plan: false }),
      );
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const zh = -d / 2 + Math.min(0.75, d * 0.38);
    return [line([-w / 2 + 0.06, zh], [w / 2 - 0.06, zh])];
  },
});

const hammockStand = defineAsset({
  id: 'hammock-stand',
  name: 'Hammock with stand',
  category: 'outdoor',
  type: 'seating',
  group: 'Outdoor seating',
  tags: ['hammock', 'garden', 'outdoor', 'relax', 'swing', 'lounge'],
  defaultSize: { w: 3.0, d: 1.2, h: 1.2 },
  minSize: { w: 2.6, d: 1.0, h: 1.0 },
  maxSize: { w: 3.6, d: 1.4, h: 1.4 },
  slots: [
    matSlot('frame', 'Stand', 'metal-anthracite'),
    matSlot('fabric', 'Hammock', 'fabric-terracotta'),
    matSlot('wood', 'Spreader bars', 'wood-teak'),
    matSlot('rope', 'Ropes & pillow', 'fabric-cream'),
  ],
  build: ({ w, d, h }) => {
    const hx = w / 2 - 0.06;
    const fx = w / 2 - 0.45;
    const sx = w / 2 - 0.6;
    const yS = h - 0.42;
    const sag = clamp(yS - 0.45, 0.1, 0.35);
    const bedW = Math.min(0.95, d - 0.25);
    const yAt = (x: number) => yS - sag * (1 - (x / sx) ** 2);
    const parts: Part[] = [rodX('frame', -fx, fx, 0.05, 0, 0.035)];
    // Sagging fabric bed
    const xs = spaced(9, -sx, sx);
    for (let i = 0; i < xs.length - 1; i++) {
      const a: V3 = [xs[i], yAt(xs[i]), 0];
      const b: V3 = [xs[i + 1], yAt(xs[i + 1]), 0];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      parts.push(
        box('fabric', [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0], [len + 0.01, 0.012, bedW], {
          rotation: [0, 0, Math.atan2(b[1] - a[1], b[0] - a[0])],
        }),
      );
    }
    // Pillow at the head end
    const px = -sx + 0.3;
    parts.push(pillow('rope', [px, yAt(px) + 0.06, 0], 0.28, 0.1, Math.min(0.5, bedW - 0.1)));
    for (const s of [-1, 1]) {
      const hook: V3 = [s * hx, h - 0.08, 0];
      parts.push(
        rodZ('frame', s * fx, 0.04, -d / 2 + 0.04, d / 2 - 0.04, 0.035),
        rod('frame', [s * fx, 0.06, 0], [s * hx, h - 0.05, 0], 0.035, { plan: false }),
        torus('frame', [s * hx, h - 0.1, 0], 0.025, 0.006, { plan: false }),
        rodZ('wood', s * sx, yS, -bedW / 2 - 0.03, bedW / 2 + 0.03, 0.016, { plan: false }),
      );
      for (const z of spaced(4, -bedW / 2, bedW / 2)) {
        parts.push(rod('rope', hook, [s * sx, yS, z], 0.004, { plan: false }));
      }
      for (const z of [-1, 1]) parts.push(sphere('frame', [s * fx, 0.04, z * (d / 2 - 0.04)], 0.04, { plan: false }));
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const sx = w / 2 - 0.6;
    const bedW = Math.min(0.95, d - 0.25);
    return [rectPoly(-sx, -bedW / 2, sx, bedW / 2), line([-w / 2 + 0.06, 0], [-sx, 0]), line([sx, 0], [w / 2 - 0.06, 0])];
  },
});

const outdoorSofa = defineAsset({
  id: 'outdoor-sofa',
  name: 'Outdoor sofa',
  category: 'outdoor',
  type: 'seating',
  group: 'Outdoor seating',
  tags: ['outdoor sofa', 'rattan', 'wicker', 'patio', 'garden', 'lounge', 'couch'],
  defaultSize: { w: 2.0, d: 0.85, h: 0.75 },
  minSize: { w: 1.4, d: 0.75, h: 0.65 },
  maxSize: { w: 2.8, d: 1.0, h: 0.85 },
  wallSnap: true,
  slots: [
    matSlot('frame', 'Woven frame', 'rattan-natural'),
    matSlot('cushion', 'Cushions', 'fabric-cream'),
    matSlot('accent', 'Throw pillows', 'fabric-mustard'),
    matSlot('legs', 'Feet', 'metal-anthracite'),
  ],
  build: (size) => {
    const { w, d, h } = size;
    const g = sofaGeom(size);
    const parts: Part[] = [
      span('frame', [-w / 2, w / 2], [g.legH, g.deck], [-d / 2, d / 2], { bevel: 0.02 }),
      span('frame', [-w / 2, w / 2], [g.deck - 0.02, h - 0.08], [-d / 2, g.zb], { bevel: 0.02 }),
      ...legs4('legs', w, d, 0.03, 0, g.legH, 0.05),
    ];
    for (const xa of [[-w / 2, g.x0] as V2, [g.x1, w / 2] as V2]) {
      parts.push(span('frame', xa, [g.deck - 0.02, g.armTop], [g.zb, d / 2], { bevel: 0.02 }));
      // Woven bands on the arm faces
      for (const y of spaced(3, g.legH + 0.06, g.armTop - 0.06)) {
        parts.push(span('frame', [xa[0] - 0.004, xa[1] + 0.004], [y - 0.008, y + 0.008], [g.zb + 0.02, d / 2 + 0.004], { plan: false }));
      }
    }
    for (const [xa, xb] of cellSpans(g.seats, g.x0, g.x1)) {
      parts.push(
        cushion('cushion', [xa + 0.005, xb - 0.005], [g.deck, g.seatTop], [g.zb, d / 2 - 0.01], { softness: 0.3, plan: false }),
        cushion('cushion', [xa + 0.01, xb - 0.01], [g.seatTop - 0.01, h - 0.02], [g.zb, g.zb + 0.16], { softness: 0.3, plan: false }),
      );
    }
    const ph = clamp(h - g.seatTop - 0.06, 0.2, 0.34);
    for (const s of [-1, 1]) {
      parts.push(
        pillow('accent', [s * (g.x1 - 0.22), g.seatTop + ph / 2 - 0.03, g.zb + 0.2], 0.4, ph, 0.13, { lean: 0.25, turn: -s * 0.2 }),
      );
    }
    return parts;
  },
  planDetail: (size) => {
    const g = sofaGeom(size);
    return [
      line([g.x0, g.zb], [g.x1, g.zb]),
      ...cellSpans(g.seats, g.x0, g.x1)
        .slice(1)
        .map(([x]) => line([x, g.zb + 0.16], [x, size.d / 2 - 0.01])),
    ];
  },
});

function sofaGeom({ w, d, h }: Size3) {
  const armW = 0.16;
  const seatTop = clamp(h * 0.58, 0.38, 0.45);
  const x0 = -w / 2 + armW;
  const x1 = w / 2 - armW;
  return {
    legH: 0.06,
    seatTop,
    deck: seatTop - 0.12,
    armTop: Math.min(h - 0.1, seatTop + 0.18),
    x0,
    x1,
    zb: -d / 2 + 0.16,
    seats: clamp(Math.round((x1 - x0) / 0.62), 1, 4),
  };
}

/** Egg-shaped basket radius at fraction s (0 = bottom, 1 = top). */
const eggR = (R: number, s: number) => R * Math.pow(Math.sin(Math.PI * clamp(s, 0, 1)), 0.75) * (1 - 0.18 * s);
/** Half-angle of the front opening at fraction s. */
const eggOpen = (s: number) => (s > 0.25 && s < 0.92 ? 1.25 * Math.pow(Math.sin((Math.PI * (s - 0.25)) / 0.67), 0.6) : 0);

const hangingEggChair = defineAsset({
  id: 'hanging-egg-chair',
  name: 'Hanging egg chair',
  category: 'outdoor',
  type: 'seating',
  group: 'Outdoor seating',
  tags: ['egg chair', 'hanging chair', 'swing', 'rattan', 'wicker', 'cocoon', 'balcony'],
  defaultSize: { w: 1.05, d: 1.05, h: 1.95 },
  minSize: { w: 0.9, d: 0.9, h: 1.8 },
  maxSize: { w: 1.2, d: 1.2, h: 2.1 },
  slots: [
    matSlot('frame', 'Stand', 'metal-anthracite'),
    matSlot('weave', 'Wicker basket', 'rattan-natural'),
    matSlot('cushion', 'Cushions', 'fabric-cream'),
    matSlot('accent', 'Throw pillow', 'fabric-terracotta'),
  ],
  build: ({ w, d, h }) => {
    const R = Math.min(w, d) / 2 - 0.08;
    const zc = 0.05;
    const yB = 0.2;
    const yT = h - 0.32;
    const Hc = yT - yB;
    const P = (s: number, t: number): V3 => {
      const r = eggR(R, s);
      return [r * Math.cos(t), yB + s * Hc, zc + r * Math.sin(t)];
    };
    const parts: Part[] = [];
    // Horizontal wicker rings, open at the front where you climb in
    for (const s of [0.08, 0.17, 0.27, 0.39, 0.51, 0.63, 0.75, 0.87]) {
      const a = eggOpen(s);
      if (a === 0) {
        parts.push(ring('weave', [0, yB + s * Hc, zc], eggR(R, s), 0.012, { plan: false }));
      } else {
        const t0 = Math.PI / 2 + a;
        parts.push(...rodPath('weave', range(8).map((i) => P(s, t0 + ((2 * Math.PI - 2 * a) * i) / 7)), 0.012));
      }
    }
    // Vertical ribs around the back, short ones under the seat at the front
    const ss = [0, 0.15, 0.3, 0.5, 0.7, 0.85, 1];
    for (const t of spaced(7, Math.PI / 2 + 1.3, Math.PI / 2 + 2 * Math.PI - 1.3)) {
      parts.push(...rodPath('weave', ss.map((s) => P(s, t)), 0.008));
    }
    for (const t of [Math.PI / 2 - 0.6, Math.PI / 2, Math.PI / 2 + 0.6]) {
      parts.push(...rodPath('weave', [0, 0.13, 0.25].map((s) => P(s, t)), 0.008));
    }
    // Cushions
    const ys = yB + 0.27 * Hc;
    const rs = eggR(R, 0.27) * 0.85;
    parts.push(
      sphere('cushion', [0, ys + 0.03, zc], 0.5, { scale: [2 * rs, 0.13, 2 * rs], plan: false }),
      pillow('cushion', [0, ys + 0.36, zc - eggR(R, 0.5) * 0.62], 0.55, 0.5, 0.14, { lean: 0.25 }),
      pillow('accent', [0.1, ys + 0.2, zc - eggR(R, 0.45) * 0.3], 0.32, 0.3, 0.12, { lean: 0.35, turn: -0.3 }),
    );
    // C-stand: round base, post arching over the top, chain and spring
    parts.push(
      vcyl('frame', 0, 0, 0, 0.035, Math.min(w, d) / 2 - 0.06),
      ...rodPath(
        'frame',
        [
          [0, 0.03, -d / 2 + 0.06],
          [0, h * 0.6, -d / 2 + 0.04],
          [0, h - 0.25, -d / 2 + 0.08],
          [0, h - 0.08, -d / 2 + 0.25],
          [0, h - 0.04, zc - 0.05],
          [0, h - 0.06, zc + 0.03],
        ],
        0.03,
      ),
      cyl('frame', [0, h - 0.12, zc], 0.018, 0.06, { plan: false }),
      rod('frame', [0, h - 0.15, zc], [0, yT, zc], 0.006, { plan: false }),
    );
    return parts;
  },
  planDetail: ({ w, d }) => [circle([0, 0.05], Math.min(w, d) / 2 - 0.08)],
});

const gardenBench = defineAsset({
  id: 'garden-bench',
  name: 'Garden bench',
  category: 'outdoor',
  type: 'seating',
  group: 'Outdoor seating',
  tags: ['garden bench', 'bench', 'park bench', 'outdoor', 'teak', 'seating'],
  defaultSize: { w: 1.5, d: 0.62, h: 0.85 },
  minSize: { w: 1.0, d: 0.55, h: 0.75 },
  maxSize: { w: 2.0, d: 0.7, h: 0.95 },
  wallSnap: true,
  slots: [matSlot('wood', 'Wood', 'wood-teak'), matSlot('cushion', 'Cushion & pillow', 'fabric-olive')],
  build: ({ w, d, h }) => {
    const sy = 0.45;
    const armW = 0.07;
    const zf = d / 2 - 0.03;
    const zb = -d / 2 + 0.04;
    const tilt = 0.14;
    // Back foot far enough forward that the reclined top stays inside the footprint.
    const z0 = Math.max(zb + 0.03, -d / 2 + 0.035 + (h - sy) * Math.tan(tilt));
    const backZ = (y: number) => z0 - (y - sy) * Math.tan(tilt);
    const ay = sy + 0.22;
    const xi: V2 = [-w / 2 + armW, w / 2 - armW];
    const rail = (y: number, hh: number) =>
      box('wood', [0, y, backZ(y)], [xi[1] - xi[0], hh, 0.035], { rotation: [-tilt, 0, 0], plan: false });
    const lowY = sy + 0.1;
    const topY = h - 0.05;
    const nb = Math.max(4, Math.round((xi[1] - xi[0] - 0.1) / 0.09));
    const parts: Part[] = [
      ...slats('wood', xi, [sy - 0.03, sy], [zb + 0.01, zf], 5, { axis: 'z', gap: 0.12, bevel: 0.005 }),
      span('wood', xi, [sy - 0.1, sy - 0.03], [zf - 0.04, zf], { plan: false }),
      span('wood', xi, [sy - 0.1, sy - 0.03], [zb, zb + 0.04], { plan: false }),
      rail(lowY, 0.06),
      rail(topY, 0.08),
    ];
    // Back slats between the rails
    const ym = (lowY + 0.03 + topY - 0.04) / 2;
    const bl = (topY - 0.04 - (lowY + 0.03)) / Math.cos(tilt);
    for (const x of cells(nb, xi[0] + 0.05, xi[1] - 0.05)) {
      parts.push(box('wood', [x, ym, backZ(ym)], [0.045, bl, 0.02], { rotation: [-tilt, 0, 0], plan: false }));
    }
    for (const s of [-1, 1]) {
      const x = s * (w / 2 - armW / 2);
      parts.push(
        span('wood', [x - armW / 2, x + armW / 2], [0, ay], [zf - 0.06, zf], { plan: false }),
        span('wood', [x - armW / 2, x + armW / 2], [0, sy], [zb, zb + 0.06], { plan: false }),
        beamYZ('wood', [x, sy - 0.02, z0], [x, h - 0.005, backZ(h - 0.005)], armW, 0.05, { plan: false }),
        span('wood', [x - 0.04, x + 0.04], [ay - 0.03, ay], [backZ(ay) - 0.01, zf - 0.01], { bevel: 0.008 }),
        rodX('wood', x - 0.04, x + 0.04, ay - 0.025, zf - 0.02, 0.03, { plan: false }),
        span('wood', [x - 0.02, x + 0.02], [0.1, 0.15], [zb, zf], { plan: false }),
      );
    }
    // A seat pad on one end and a pillow leaning on the back at the other
    parts.push(
      cushion('cushion', [xi[1] - Math.min(0.45, (xi[1] - xi[0]) / 2), xi[1] - 0.04], [sy, sy + 0.05], [zb + 0.06, zf - 0.04], {
        softness: 0.4,
        plan: false,
      }),
      pillow('cushion', [xi[0] + 0.22, sy + 0.15, backZ(sy + 0.15) + 0.09], 0.36, 0.3, 0.12, { lean: 0.25, turn: 0.15 }),
    );
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w / 2 + 0.07, -d / 2 + 0.05], [w / 2 - 0.07, -d / 2 + 0.05])],
});

// ---------------------------------------------------------------------------
// Outdoor cooking
// ---------------------------------------------------------------------------

function kettleGeom({ w, d, h }: Size3) {
  const R = Math.min(0.29, w / 2 - 0.06, d / 2 - 0.04);
  const by = h * 0.69;
  return { R, by, lh: h - by - 0.06 };
}

const bbqKettle = defineAsset({
  id: 'bbq-kettle',
  name: 'Kettle barbecue',
  category: 'outdoor',
  type: 'appliances',
  group: 'Outdoor cooking',
  tags: ['barbecue', 'bbq', 'grill', 'kettle grill', 'charcoal', 'outdoor cooking'],
  defaultSize: { w: 0.7, d: 0.65, h: 1.05 },
  minSize: { w: 0.55, d: 0.5, h: 0.95 },
  maxSize: { w: 0.8, d: 0.75, h: 1.1 },
  slots: [
    matSlot('body', 'Enamel bowl & lid', 'metal-black-matte'),
    matSlot('metal', 'Legs & fittings', 'metal-chrome'),
    matSlot('handles', 'Handles & wheels', 'plastic-black'),
  ],
  build: (size) => {
    const { R, by, lh } = kettleGeom(size);
    const bowl: V2[] = range(9).map((i) => {
      const t = (i / 8) * (Math.PI / 2);
      return [R * Math.sin(t), R * 0.85 * (1 - Math.cos(t))];
    });
    const dome: V2[] = [
      ...range(9).map((i) => {
        const t = (i / 8) * (Math.PI / 2);
        return [(R + 0.004) * Math.cos(t), lh * Math.sin(t)] as V2;
      }),
      [0, lh],
    ];
    const hy = by + lh * 0.75 + 0.05;
    const hz = R * 0.6;
    const parts: Part[] = [
      lathe('body', [0, by - R * 0.85, 0], bowl, { segments: 28 }),
      lathe('body', [0, by, 0], dome, { segments: 28, plan: false }),
      vcyl('metal', 0, 0, by + lh - 0.012, by + lh + 0.006, 0.05, { plan: false }),
      // Lid handle on two standoffs
      rodX('handles', -0.07, 0.07, hy, hz, 0.014, { plan: false }),
      rod('metal', [-0.06, by + lh * 0.72, R * 0.62], [-0.06, hy, hz], 0.006, { plan: false }),
      rod('metal', [0.06, by + lh * 0.72, R * 0.62], [0.06, hy, hz], 0.006, { plan: false }),
      discZ('metal', [0, by + lh * 0.45, Math.cos(Math.asin(0.45)) * R + 0.004], 0.025, 0.008, { plan: false }),
      // Ash catcher and leg ring
      vcyl('metal', 0, 0, 0.16, 0.2, R * 0.5, { rTop: R * 0.55, plan: false }),
      ring('metal', [0, 0.24, 0], R * 0.62, 0.006, { plan: false }),
    ];
    // Side handles on the bowl, with tongs hanging from the right one
    for (const s of [-1, 1]) parts.push(rodX('handles', s * R, s * (R + 0.045), by - 0.04, 0, 0.012, { plan: false }));
    parts.push(
      rod('metal', [R + 0.03, by - 0.05, 0.01], [R + 0.03, by - 0.35, 0.03], 0.004, { plan: false }),
      rod('metal', [R + 0.03, by - 0.05, -0.01], [R + 0.03, by - 0.35, -0.03], 0.004, { plan: false }),
    );
    // Three legs; the back two carry wheels on an axle
    const feet: V2[] = [Math.PI / 2, Math.PI / 2 + (2 * Math.PI) / 3, Math.PI / 2 + (4 * Math.PI) / 3].map((a) => [Math.cos(a), Math.sin(a)]);
    for (const [i, [c, s]] of feet.entries()) {
      const fr = R * 0.92;
      const fy = i === 0 ? 0.01 : 0.06;
      parts.push(rod('metal', [c * R * 0.55, by - R * 0.6, s * R * 0.55], [c * fr, fy, s * fr], 0.012, { plan: false }));
      if (i === 0) parts.push(sphere('handles', [c * fr, 0.015, s * fr], 0.015, { plan: false }));
      else parts.push(cyl('handles', [c * fr, 0.06, s * fr], 0.06, 0.03, { rotation: TO_X, plan: false }));
    }
    parts.push(rodX('metal', feet[1][0] * R * 0.92, feet[2][0] * R * 0.92, 0.06, feet[1][1] * R * 0.92, 0.006, { plan: false }));
    return parts;
  },
  planDetail: (size) => [circle([0, 0], kettleGeom(size).R * 0.7)],
});

function grillGeom({ w, d, h }: Size3) {
  const cw = Math.min(w - 0.5, 0.95);
  const sh = 0.86;
  return { cw, sh, lr: Math.min(0.2, h - sh - 0.12), zc: -0.02, knobs: clamp(Math.round(cw / 0.18), 3, 6), d };
}

const bbqGas = defineAsset({
  id: 'bbq-gas',
  name: 'Gas grill',
  category: 'outdoor',
  type: 'appliances',
  group: 'Outdoor cooking',
  tags: ['barbecue', 'bbq', 'gas grill', 'grill', 'outdoor kitchen', 'outdoor cooking'],
  defaultSize: { w: 1.3, d: 0.6, h: 1.15 },
  minSize: { w: 1.0, d: 0.5, h: 1.05 },
  maxSize: { w: 1.7, d: 0.7, h: 1.25 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Cart & shelves', 'metal-black-matte'),
    matSlot('lid', 'Hood', 'metal-brushed-steel'),
    matSlot('handles', 'Handles', 'metal-chrome'),
    matSlot('knobs', 'Knobs & wheels', 'plastic-black'),
  ],
  build: (size) => {
    const { w, d } = size;
    const { cw, sh, lr, zc, knobs } = grillGeom(size);
    const ly = sh + 0.09;
    const doors: FrontSpec[] = cellSpans(2, -cw / 2 - 0.02, cw / 2 + 0.02).map(([x0, x1]) => ({
      x: [x0, x1] as V2,
      y: [0.15, sh - 0.14] as V2,
      handle: { kind: 'bar-h' as const, y: sh - 0.2 },
    }));
    const bx = cw / 2 + 0.02;
    const parts: Part[] = [
      // Cart with doors, cook box and rounded hood
      span('body', [-bx, bx], [0.12, sh - 0.12], [-d / 2 + 0.04, d / 2 - 0.06]),
      ...fronts('body', 'handles', doors, d / 2 - 0.06, 0.018, 0.028),
      span('body', [-cw / 2, cw / 2], [sh - 0.12, ly], [-d / 2 + 0.04, d / 2 - 0.08], { bevel: 0.01, plan: false }),
      rodX('lid', -cw / 2, cw / 2, ly, zc, lr, { plan: false }),
      rodX('handles', -cw / 2 + 0.08, cw / 2 - 0.08, ly + lr * 0.55, zc + lr * 0.84 + 0.04, 0.012, { plan: false }),
      discZ('knobs', [0, ly + lr * 0.5, zc + lr * 0.87 + 0.002], 0.025, 0.01, { plan: false }),
      // Control panel with burner knobs
      span('body', [-cw / 2, cw / 2], [sh - 0.12, sh + 0.02], [d / 2 - 0.08, d / 2 - 0.04], { bevel: 0.006, plan: false }),
    ];
    for (const s of [-1, 1]) {
      parts.push(
        rod('handles', [s * (cw / 2 - 0.08), ly + lr * 0.5, zc + lr * 0.85], [s * (cw / 2 - 0.08), ly + lr * 0.55, zc + lr * 0.84 + 0.04], 0.006, { plan: false }),
        // Side shelf on a bracket
        span('body', s < 0 ? [-w / 2, -bx] : [bx, w / 2], [sh - 0.03, sh], [-d / 2 + 0.06, d / 2 - 0.08], { bevel: 0.005 }),
        rod('body', [s * bx, sh - 0.25, 0], [s * (w / 2 - 0.05), sh - 0.03, 0], 0.01, { plan: false }),
      );
      for (const z of [-d / 2 + 0.1, d / 2 - 0.14]) {
        parts.push(cyl('knobs', [s * (cw / 2 - 0.04), 0.06, z], 0.06, 0.035, { rotation: TO_X, plan: false }));
      }
    }
    for (const x of cells(knobs, -cw / 2, cw / 2)) {
      parts.push(discZ('knobs', [x, sh - 0.05, d / 2 - 0.025], 0.025, 0.03, { plan: false }));
    }
    // Side burner on the right shelf, tools hanging off the left one
    const sbx = (bx + w / 2) / 2;
    parts.push(
      ring('lid', [sbx, sh + 0.005, -0.02], Math.min(0.08, (w / 2 - bx) / 2 - 0.02), 0.008, { plan: false }),
      vcyl('knobs', sbx, -0.02, sh, sh + 0.01, 0.025, { plan: false }),
    );
    for (const [i, x] of spaced(2, -w / 2 + 0.06, -bx - 0.06).entries()) {
      parts.push(
        rod('handles', [x, sh - 0.03, d / 2 - 0.09], [x, sh - 0.3, d / 2 - 0.09], 0.005, { plan: false }),
        span('handles', [x - 0.03, x + 0.03], [sh - 0.36, sh - 0.3], [d / 2 - 0.095, d / 2 - 0.085], { plan: false }),
        span('knobs', [x - 0.008, x + 0.008], [sh - 0.2 - i * 0.02, sh - 0.06], [d / 2 - 0.1, d / 2 - 0.08], { plan: false }),
      );
    }
    return parts;
  },
  planDetail: (size) => {
    const { w, d } = size;
    const { cw } = grillGeom(size);
    const bx = cw / 2 + 0.02;
    return [rectPoly(-cw / 2, -d / 2 + 0.04, cw / 2, d / 2 - 0.08), circle([(bx + w / 2) / 2, -0.02], Math.min(0.08, (w / 2 - bx) / 2 - 0.02))];
  },
});

const firePit = defineAsset({
  id: 'fire-pit',
  name: 'Fire pit',
  category: 'outdoor',
  type: 'decor',
  group: 'Fireplaces',
  tags: ['fire pit', 'campfire', 'bonfire', 'garden', 'outdoor', 'stone'],
  defaultSize: { w: 1.0, d: 1.0, h: 0.6 },
  minSize: { w: 0.7, d: 0.7, h: 0.45 },
  maxSize: { w: 1.4, d: 1.4, h: 0.8 },
  slots: [
    matSlot('stone', 'Stone ring', 'stone-slate'),
    matSlot('metal', 'Fire bowl', 'metal-black-matte'),
    matSlot('wood', 'Logs', 'wood-dark-stain'),
    matSlot('light', 'Flames', 'light-candle'),
  ],
  light: { color: '#ff9a4a', intensity: 1.4, distance: 5, y: 0.35 },
  build: ({ w, d, h }) => {
    const R = Math.min(w, d) / 2;
    const sd = clamp(R * 0.24, 0.08, 0.14);
    const Rm = R - sd / 2 - 0.01;
    const n = clamp(Math.round((2 * Math.PI * Rm) / 0.24), 8, 20);
    const hl = ((Math.PI * Rm) / n) * 0.96;
    const wallTop = clamp(h * 0.55, 0.22, 0.4);
    const ch = (wallTop - 0.04) / 2;
    const ri = Rm - sd / 2;
    const parts: Part[] = [];
    // Two staggered courses of stones and a flat cap course
    for (let c = 0; c < 3; c++) {
      const off = c === 1 ? 0.5 : 0;
      const y0 = c * ch;
      const hh = c === 2 ? 0.04 : ch;
      for (let i = 0; i < n; i++) {
        const phi = ((i + off) / n) * Math.PI * 2;
        parts.push(
          box('stone', [Rm * Math.sin(phi), y0 + hh / 2, Rm * Math.cos(phi)], [2 * hl - 0.008, hh - 0.006, c === 2 ? sd + 0.015 : sd], {
            rotation: [0, phi, 0],
            bevel: 0.012,
          }),
        );
      }
    }
    // Fire bowl, grate, logs, embers and flames
    const lh = Math.min(0.3, h - 0.2);
    parts.push(
      vcyl('metal', 0, 0, 0, 0.06, ri, { plan: false }),
      ring('metal', [0, 0.09, 0], ri * 0.7, 0.01, { plan: false }),
    );
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.3;
      parts.push(
        rod('wood', [Math.cos(a) * ri * 0.75, 0.08, Math.sin(a) * ri * 0.75], [Math.cos(a) * 0.04, 0.08 + lh, Math.sin(a) * 0.04], 0.035, {
          plan: false,
        }),
      );
    }
    parts.push(
      rodX('wood', -ri * 0.6, ri * 0.6, 0.1, ri * 0.35, 0.04, { plan: false }),
      ...blobCluster('light', [0, 0.1, 0], Math.min(0.12, ri * 0.4), 5, 3),
      sphere('light', [0, 0.1 + (h - 0.14) / 2, 0], 0.5, { scale: [0.16, h - 0.14, 0.16], plan: false }),
      sphere('light', [0.06, 0.1 + (h - 0.24) / 2, 0.04], 0.5, { scale: [0.1, h - 0.24, 0.1], plan: false }),
      sphere('light', [-0.06, 0.1 + (h - 0.3) / 2, -0.03], 0.5, { scale: [0.09, h - 0.3, 0.09], plan: false }),
    );
    return parts;
  },
  planDetail: ({ w, d }) => {
    const R = Math.min(w, d) / 2;
    const sd = clamp(R * 0.24, 0.08, 0.14);
    return [circle([0, 0], R - sd - 0.01)];
  },
});

// ---------------------------------------------------------------------------
// Shade, plants, storage, lighting, leisure
// ---------------------------------------------------------------------------

const parasol = defineAsset({
  id: 'parasol',
  name: 'Parasol',
  category: 'outdoor',
  type: 'surfaces',
  group: 'Outdoor tables',
  tags: ['parasol', 'umbrella', 'sunshade', 'patio', 'garden', 'outdoor', 'shade'],
  defaultSize: { w: 2.7, d: 2.7, h: 2.5 },
  minSize: { w: 2.0, d: 2.0, h: 2.2 },
  maxSize: { w: 3.5, d: 3.5, h: 2.8 },
  slots: [
    matSlot('canopy', 'Canopy', 'fabric-cream'),
    matSlot('pole', 'Pole & ribs', 'wood-teak'),
    matSlot('base', 'Base', 'concrete-grey'),
  ],
  build: ({ w, d, h }) => {
    const R = Math.min(w, d) / 2 - 0.01;
    const yT = h - 0.1;
    const yE = h - 0.55;
    const run = yE - 0.4;
    const parts: Part[] = [
      lathe('canopy', [0, yE, 0], [
        [0, 0.1],
        [R, 0],
        [R, 0.02],
        [0.05, yT - yE],
        [0, yT - yE + 0.01],
      ], { segments: 8 }),
      vcyl('pole', 0, 0, 0.08, yT, 0.022, { plan: false }),
      sphere('pole', [0, yT + 0.03, 0], 0.03, { plan: false }),
      vcyl('pole', 0, 0, run - 0.05, run + 0.05, 0.035, { plan: false }),
      // Crank handle
      rodX('pole', 0.02, 0.09, 1.1, 0, 0.008, { plan: false }),
      vcyl('pole', 0.09, 0, 1.06, 1.1, 0.012, { plan: false }),
      // Weighted base
      span('base', [-0.25, 0.25], [0, 0.08], [-0.25, 0.25], { bevel: 0.02, plan: false }),
      vcyl('base', 0, 0, 0.08, 0.2, 0.05, { rTop: 0.035, plan: false }),
    ];
    const Rm = R * Math.cos(Math.PI / 8);
    const edge = 2 * R * Math.sin(Math.PI / 8);
    for (let i = 0; i < 8; i++) {
      const phi = (i * Math.PI) / 4;
      const tip: V3 = [0.96 * R * Math.sin(phi), yE + 0.008, 0.96 * R * Math.cos(phi)];
      const mid: V3 = [0.5 * R * Math.sin(phi), (yE + yT) / 2 - 0.02, 0.5 * R * Math.cos(phi)];
      const pm = phi + Math.PI / 8;
      parts.push(
        rod('pole', [0, yT - 0.06, 0], tip, 0.008, { plan: false }),
        rod('pole', [0, run, 0], mid, 0.007, { plan: false }),
        box('canopy', [Rm * Math.sin(pm), yE - 0.04, Rm * Math.cos(pm)], [edge * 0.95, 0.09, 0.006], { rotation: [0, pm, 0], plan: false }),
      );
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const R = Math.min(w, d) / 2 - 0.01;
    return [rectPoly(-0.25, -0.25, 0.25, 0.25), ...range(8).map((i) => line([0, 0], [R * Math.sin((i * Math.PI) / 4), R * Math.cos((i * Math.PI) / 4)]))];
  },
});

const planterHerbs = defineAsset({
  id: 'planter-herbs',
  name: 'Herb planter (basil, parsley, chives)',
  category: 'plants',
  type: 'plants',
  group: 'Herbs & edibles',
  plant: PLANT_SPECIES['herb-trio'],
  tags: ['herbs', 'planter', 'raised bed', 'kitchen garden', 'balcony', 'basil'],
  description: 'A pine raised planter with three kitchen herbs side by side: bushy sweet basil, flat-leaf parsley and a clump of chives.',
  defaultSize: { w: 1.0, d: 0.4, h: 0.75 },
  minSize: { w: 0.6, d: 0.3, h: 0.4 },
  maxSize: { w: 1.8, d: 0.6, h: 0.9 },
  slots: [
    matSlot('wood', 'Planter', 'wood-pine'),
    matSlot('soil', 'Soil', 'plant-soil'),
    matSlot('herbs', 'Herbs', 'plant-leaf'),
    matSlot('herbs2', 'Light herbs', 'plant-leaf-light'),
  ],
  build: ({ w, d, h }) => {
    const tt = h - 0.2;
    const tb = Math.max(0.0, tt - 0.25);
    const p = 0.045;
    const iw = w / 2 - p;
    const nb = Math.max(2, Math.round((tt - tb) / 0.09));
    const parts: Part[] = [
      span('wood', [-iw, iw], [tb, tb + 0.02], [-d / 2 + 0.03, d / 2 - 0.03], { plan: false }),
      ...slats('wood', [-iw, iw], [tb, tt], [d / 2 - 0.022, d / 2], nb, { axis: 'y', gap: 0.06, bevel: 0.004 }),
      ...slats('wood', [-iw, iw], [tb, tt], [-d / 2, -d / 2 + 0.022], nb, { axis: 'y', gap: 0.06, bevel: 0.004 }),
      ...slats('wood', [-w / 2 + 0.003, -w / 2 + 0.025], [tb, tt], [-d / 2 + p, d / 2 - p], nb, { axis: 'y', gap: 0.06, plan: false }),
      ...slats('wood', [w / 2 - 0.025, w / 2 - 0.003], [tb, tt], [-d / 2 + p, d / 2 - p], nb, { axis: 'y', gap: 0.06, plan: false }),
      span('wood', [-w / 2, w / 2], [tt, tt + 0.02], [d / 2 - 0.04, d / 2], { bevel: 0.004, plan: false }),
      span('wood', [-w / 2, w / 2], [tt, tt + 0.02], [-d / 2, -d / 2 + 0.04], { bevel: 0.004, plan: false }),
      span('soil', [-iw, iw], [tt - 0.06, tt - 0.03], [-d / 2 + 0.025, d / 2 - 0.025], { plan: false }),
    ];
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        parts.push(span('wood', [sx * (w / 2 - p / 2) - p / 2, sx * (w / 2 - p / 2) + p / 2], [0, tt + 0.01], [sz * (d / 2 - p / 2) - p / 2, sz * (d / 2 - p / 2) + p / 2], { bevel: 0.004 }));
      }
    }
    // A row of herbs: broad-leaved basil alternating with fine rosemary
    const n = clamp(Math.round((w - 0.08) / 0.22), 2, 7);
    const cr = Math.min(0.11, (2 * iw) / n / 2, d / 2 - 0.04);
    const fh = h - (tt - 0.03) - 0.01;
    for (const [i, x] of cells(n, -iw, iw).entries()) {
      const broad = i % 2 === 0;
      parts.push(
        ...foliage(broad ? 'herbs' : 'herbs2', [x, tt - 0.03, 0], cr, broad ? fh * 0.8 : fh, broad ? 9 : 11, 50 + i, {
          leafWid: broad ? Math.min(0.05, cr * 0.5) : 0.012,
          spread: broad ? 0.75 : 0.3,
        }),
      );
    }
    // Plant labels in the soil
    for (const x of [cells(n, -iw, iw)[0] + cr * 0.6, cells(n, -iw, iw)[n - 1] - cr * 0.6]) {
      parts.push(
        vcyl('wood', x, d / 2 - 0.06, tt - 0.05, tt + 0.07, 0.004, { plan: false }),
        span('wood', [x - 0.025, x + 0.025], [tt + 0.04, tt + 0.08], [d / 2 - 0.064, d / 2 - 0.056], { plan: false }),
      );
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const n = clamp(Math.round((w - 0.08) / 0.22), 2, 7);
    const iw = w / 2 - 0.045;
    const cr = Math.min(0.11, (2 * iw) / n / 2, d / 2 - 0.04);
    return [rectPoly(-iw, -d / 2 + 0.025, iw, d / 2 - 0.025), ...cells(n, -iw, iw).map((x) => circle([x, 0], cr * 0.8))];
  },
});

const hotTub = defineAsset({
  id: 'hot-tub',
  name: 'Hot tub',
  category: 'outdoor',
  type: 'plumbing',
  group: 'Showers & tubs',
  tags: ['hot tub', 'spa', 'jacuzzi', 'whirlpool', 'outdoor', 'garden'],
  defaultSize: { w: 2.1, d: 2.1, h: 0.95 },
  minSize: { w: 1.8, d: 1.8, h: 0.8 },
  maxSize: { w: 2.4, d: 2.4, h: 1.0 },
  slots: [
    matSlot('cabinet', 'Cabinet', 'wood-teak'),
    matSlot('shell', 'Acrylic shell', 'plastic-white'),
    matSlot('water', 'Water', 'water'),
    matSlot('accent', 'Pillows & jets', 'plastic-black'),
  ],
  build: ({ w, d, h }) => {
    const wall = 0.22;
    const rimY = h - 0.05;
    const floorY = 0.25;
    const wy = h - 0.2;
    const xi = w / 2 - wall;
    const zi = d / 2 - wall;
    const lt = 0.012;
    const parts: Part[] = [
      // Cabinet walls and floor
      span('cabinet', [-w / 2, w / 2], [0, rimY], [-d / 2, -zi], { bevel: 0.03 }),
      span('cabinet', [-w / 2, w / 2], [0, rimY], [zi, d / 2], { bevel: 0.03 }),
      span('cabinet', [-w / 2, -xi], [0, rimY], [-zi, zi], { bevel: 0.03 }),
      span('cabinet', [xi, w / 2], [0, rimY], [-zi, zi], { bevel: 0.03 }),
      span('cabinet', [-xi, xi], [0, floorY - 0.03], [-zi, zi], { plan: false }),
      // Moulded rim, interior lining and floor
      span('shell', [-w / 2 + 0.01, w / 2 - 0.01], [rimY, h], [-d / 2 + 0.01, -zi + 0.02], { bevel: 0.02, plan: false }),
      span('shell', [-w / 2 + 0.01, w / 2 - 0.01], [rimY, h], [zi - 0.02, d / 2 - 0.01], { bevel: 0.02, plan: false }),
      span('shell', [-w / 2 + 0.01, -xi + 0.02], [rimY, h], [-zi + 0.02, zi - 0.02], { bevel: 0.02, plan: false }),
      span('shell', [xi - 0.02, w / 2 - 0.01], [rimY, h], [-zi + 0.02, zi - 0.02], { bevel: 0.02, plan: false }),
      span('shell', [-xi, xi], [floorY - 0.03, floorY], [-zi, zi], { plan: false }),
      span('shell', [-xi, xi], [floorY, rimY], [-zi, -zi + lt], { plan: false }),
      span('shell', [-xi, xi], [floorY, rimY], [zi - lt, zi], { plan: false }),
      span('shell', [-xi, -xi + lt], [floorY, rimY], [-zi, zi], { plan: false }),
      span('shell', [xi - lt, xi], [floorY, rimY], [-zi, zi], { plan: false }),
      // Lounger along the left, a seat in the front-right corner
      span('shell', [-xi + lt, -xi + 0.5], [floorY, floorY + 0.15], [-zi + 0.47, zi - lt], { bevel: 0.05, plan: false }),
      span('shell', [xi - 0.45, xi - lt], [floorY, floorY + 0.28], [zi - 0.45, zi - lt], { bevel: 0.05, plan: false }),
      span('water', [-xi + lt, xi - lt], [floorY, wy], [-zi + lt, zi - lt], { plan: false }),
      // Control panel on the rim
      span('accent', [xi - 0.25, xi - 0.05], [h - 0.004, h + 0.004], [zi + 0.06, zi + 0.16], { bevel: 0.002, plan: false }),
    ];
    // Bucket seats along the back with jets and headrest pillows
    for (const [x0, x1] of cellSpans(3, -xi + lt, xi - lt)) {
      const xm = (x0 + x1) / 2;
      parts.push(
        span('shell', [x0 + 0.02, x1 - 0.02], [floorY, floorY + 0.28], [-zi + lt, -zi + 0.43], { bevel: 0.05, plan: false }),
        span('accent', [xm - 0.15, xm + 0.15], [h - 0.12, h - 0.01], [-zi - 0.03, -zi + 0.06], { bevel: 0.03, plan: false }),
      );
      for (const dx of [-0.08, 0.08]) parts.push(discZ('accent', [xm + dx, floorY + 0.42, -zi + lt + 0.004], 0.022, 0.008, { plan: false }));
    }
    // Vertical cladding boards on all four sides
    const nx = Math.round((w - 0.1) / 0.12);
    const nz = Math.round((d - 0.1) / 0.12);
    for (const s of [-1, 1]) {
      parts.push(
        ...slats('cabinet', [-w / 2 + 0.05, w / 2 - 0.05], [0.04, rimY - 0.03], s < 0 ? [-d / 2 - 0.006, -d / 2] : [d / 2, d / 2 + 0.006], nx, {
          axis: 'x',
          gap: 0.1,
          plan: false,
        }),
        ...slats('cabinet', s < 0 ? [-w / 2 - 0.006, -w / 2] : [w / 2, w / 2 + 0.006], [0.04, rimY - 0.03], [-d / 2 + 0.05, d / 2 - 0.05], nz, {
          axis: 'z',
          gap: 0.1,
          plan: false,
        }),
      );
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const xi = w / 2 - 0.22;
    const zi = d / 2 - 0.22;
    return [rectPoly(-xi, -zi, xi, zi), line([-xi, -zi + 0.43], [xi, -zi + 0.43]), line([-xi + 0.5, -zi + 0.47], [-xi + 0.5, zi])];
  },
});

const bicycle = defineAsset({
  id: 'bicycle',
  name: 'Bicycle',
  category: 'outdoor',
  type: 'activities',
  group: 'Bikes & scooters',
  tags: ['bicycle', 'bike', 'cycling', 'city bike', 'outdoor', 'hallway'],
  defaultSize: { w: 1.75, d: 0.6, h: 1.05 },
  minSize: { w: 1.6, d: 0.5, h: 0.95 },
  maxSize: { w: 1.9, d: 0.7, h: 1.15 },
  wallSnap: true,
  slots: [
    matSlot('frame', 'Frame', 'plastic-mint'),
    matSlot('tyres', 'Tyres, grips & saddle', 'rubber-black'),
    matSlot('metal', 'Rims, spokes & chain', 'metal-chrome'),
    matSlot('basket', 'Basket', 'rattan-natural'),
  ],
  build: ({ w, d, h }) => {
    const tube = 0.018;
    const R = clamp((w - 1.0) / 2 - tube, 0.28, 0.34);
    const Rt = R + tube;
    const xr = -w / 2 + Rt;
    const xf = w / 2 - Rt;
    const L = xf - xr;
    const Ry = Rt;
    const sy = Math.min(Ry + 0.52, h - 0.15);
    const B: V3 = [xr + 0.4 * L, Ry - 0.06, 0];
    const S: V3 = [xr + 0.3 * L, sy, 0];
    const Ht: V3 = [xf - 0.2 * L, sy - 0.02, 0];
    const Hb: V3 = [xf - 0.17 * L, sy - 0.17, 0];
    const hy = Math.min(Ht[1] + 0.1, h - 0.03);
    const hb: V3 = [Ht[0] + 0.05, hy, 0];
    const hw = Math.min(0.28, d / 2 - 0.03);
    const parts: Part[] = [];
    // Wheels: tyre, rim, hub and spokes
    for (const cx of [xr, xf]) {
      parts.push(
        torus('tyres', [cx, Ry, 0], R, tube),
        torus('metal', [cx, Ry, 0], R - tube - 0.006, 0.008, { plan: false }),
        discZ('metal', [cx, Ry, 0], 0.025, 0.1, { plan: false }),
      );
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const z = i % 2 === 0 ? 0.03 : -0.03;
        parts.push(rod('metal', [cx, Ry, z], [cx + Math.cos(a) * (R - 0.03), Ry + Math.sin(a) * (R - 0.03), 0], 0.002, { plan: false }));
      }
    }
    // Frame and fork
    const A: V3 = [xr, Ry, 0];
    const F: V3 = [xf, Ry, 0];
    parts.push(
      rod('frame', B, S, 0.017, { plan: false }),
      rod('frame', S, Ht, 0.016, { plan: false }),
      rod('frame', B, Hb, 0.02, { plan: false }),
      rod('frame', Hb, Ht, 0.022, { plan: false }),
    );
    for (const z of [-0.035, 0.035]) {
      parts.push(
        rod('frame', [A[0], A[1], z], [B[0], B[1], z * 0.6], 0.011, { plan: false }),
        rod('frame', [A[0], A[1], z], [S[0], S[1] - 0.03, z * 0.4], 0.01, { plan: false }),
        rod('frame', [Hb[0], Hb[1], z * 0.8], [F[0], F[1], z * 1.3], 0.012, { plan: false }),
      );
    }
    // Stem, handlebar, grips, bell; seat post and saddle
    parts.push(
      rod('metal', Ht, hb, 0.014, { plan: false }),
      rodZ('metal', hb[0], hy, -hw, hw, 0.012),
      rodZ('tyres', hb[0], hy, hw - 0.1, hw, 0.017, { plan: false }),
      rodZ('tyres', hb[0], hy, -hw, -hw + 0.1, 0.017, { plan: false }),
      sphere('metal', [hb[0], hy + 0.02, hw - 0.13], 0.02, { plan: false }),
      rod('metal', S, [S[0] - 0.03, sy + 0.1, 0], 0.013, { plan: false }),
      sphere('tyres', [S[0] - 0.04, sy + 0.12, 0], 0.5, { scale: [0.26, 0.06, 0.15], plan: false }),
    );
    // Crank, pedals and chain
    parts.push(
      discZ('metal', [B[0], B[1], 0.045], 0.1, 0.008, { plan: false }),
      discZ('metal', [xr, Ry, 0.045], 0.04, 0.008, { plan: false }),
      rod('metal', [B[0], B[1] + 0.1, 0.045], [xr, Ry + 0.04, 0.045], 0.004, { plan: false }),
      rod('metal', [B[0], B[1] - 0.1, 0.045], [xr, Ry - 0.04, 0.045], 0.004, { plan: false }),
      // Kickstand
      rod('metal', [B[0] - 0.05, B[1], -0.03], [B[0] - 0.2, 0.005, -0.12], 0.008, { plan: false }),
    );
    for (const s of [-1, 1]) {
      const a = s > 0 ? -0.5 : Math.PI - 0.5;
      const e: V3 = [B[0] + 0.17 * Math.cos(a), B[1] + 0.17 * Math.sin(a), s * 0.06];
      parts.push(
        rod('metal', [B[0], B[1], s * 0.06], e, 0.01, { plan: false }),
        box('tyres', [e[0], e[1], s * 0.1], [0.09, 0.025, 0.08], { bevel: 0.006, plan: false }),
      );
    }
    // Wicker basket on the handlebars
    const bx = Math.min(hb[0] + 0.17, w / 2 - 0.13);
    parts.push(
      span('basket', [bx - 0.12, bx + 0.12], [hy - 0.15, hy + 0.02], [-0.15, 0.15], { bevel: 0.015, plan: false }),
      ring('basket', [bx, hy + 0.02, 0], 0.12, 0.01, { zScale: 1.25, plan: false }),
    );
    return parts;
  },
});

const lanternOutdoor = defineAsset({
  id: 'lantern-outdoor',
  name: 'Outdoor lantern',
  category: 'outdoor',
  type: 'lighting',
  group: 'Outdoor & string lights',
  tags: ['lantern', 'candle', 'outdoor light', 'garden', 'patio', 'hurricane'],
  defaultSize: { w: 0.3, d: 0.3, h: 0.6 },
  minSize: { w: 0.2, d: 0.2, h: 0.4 },
  maxSize: { w: 0.45, d: 0.45, h: 1.0 },
  slots: [
    matSlot('frame', 'Frame', 'metal-black-matte'),
    matSlot('glass', 'Glass', 'glass-clear'),
    matSlot('candle', 'Candle', 'ceramic-white'),
    matSlot('light', 'Flame', 'light-candle'),
  ],
  light: { color: '#ffb35c', intensity: 0.9, distance: 3.5, y: 0.26 },
  build: ({ w, d, h }) => {
    const s = Math.min(w, d);
    const half = s / 2 - 0.02;
    const k = h / 0.6;
    const b0 = 0.06 * k;
    const top = h - 0.17 * k;
    const ym = (b0 + top) / 2;
    const ch = (top - b0) * 0.45;
    const cr = Math.min(0.045, half * 0.45);
    const p = 0.009;
    const parts: Part[] = [
      span('frame', [-s / 2 + 0.01, s / 2 - 0.01], [0, 0.03 * k], [-s / 2 + 0.01, s / 2 - 0.01], { bevel: 0.004 }),
      span('frame', [-half - 0.005, half + 0.005], [0.03 * k, b0], [-half - 0.005, half + 0.005], { bevel: 0.003 }),
      span('glass', [-half + 0.008, half - 0.008], [b0, top], [-half + 0.008, half - 0.008], { plan: false }),
      // Stepped roof and ring handle
      span('frame', [-s / 2, s / 2], [top, top + 0.025 * k], [-s / 2, s / 2], { bevel: 0.004, plan: false }),
      span('frame', [-half * 0.75, half * 0.75], [top + 0.025 * k, top + 0.065 * k], [-half * 0.75, half * 0.75], { bevel: 0.004, plan: false }),
      span('frame', [-half * 0.4, half * 0.4], [top + 0.065 * k, top + 0.095 * k], [-half * 0.4, half * 0.4], { bevel: 0.004, plan: false }),
      sphere('frame', [0, top + 0.1 * k, 0], 0.012, { plan: false }),
      torus('frame', [0, h - 0.035 * k, 0], 0.03 * k, 0.006, { plan: false }),
      // Candle on a dish, wick and flame
      vcyl('frame', 0, 0, b0, b0 + 0.008, cr + 0.015, { plan: false }),
      vcyl('candle', 0, 0, b0 + 0.008, b0 + 0.008 + ch, cr, { plan: false }),
      vcyl('frame', 0, 0, b0 + 0.008 + ch, b0 + 0.018 + ch, 0.002, { plan: false }),
      sphere('light', [0, b0 + ch + 0.04, 0], 0.5, { scale: [0.022, 0.05, 0.022], plan: false }),
    ];
    // Corner posts, top frame and a mid muntin on every face
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        parts.push(span('frame', [sx * half - p, sx * half + p], [b0, top], [sz * half - p, sz * half + p], { plan: false }));
      }
      parts.push(
        span('frame', [-half, half], [top - 0.012, top], [sx * half - 0.006, sx * half + 0.006], { plan: false }),
        span('frame', [sx * half - 0.006, sx * half + 0.006], [top - 0.012, top], [-half, half], { plan: false }),
        span('frame', [-half, half], [ym - 0.005, ym + 0.005], [sx * half - 0.004, sx * half + 0.004], { plan: false }),
        span('frame', [sx * half - 0.004, sx * half + 0.004], [ym - 0.005, ym + 0.005], [-half, half], { plan: false }),
      );
    }
    return parts;
  },
});

const deckBox = defineAsset({
  id: 'deck-box',
  name: 'Deck storage box',
  category: 'outdoor',
  type: 'storage',
  group: 'Baskets & boxes',
  tags: ['deck box', 'storage', 'cushion box', 'garden', 'patio', 'chest', 'outdoor'],
  defaultSize: { w: 1.3, d: 0.6, h: 0.65 },
  minSize: { w: 0.8, d: 0.45, h: 0.5 },
  maxSize: { w: 1.8, d: 0.8, h: 0.85 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Panels & lid', 'wood-dark-stain'),
    matSlot('trim', 'Handles & feet', 'plastic-black'),
    matSlot('accent', 'Gardening gloves', 'fabric-olive'),
  ],
  build: ({ w, d, h }) => {
    const lidY = h - 0.1;
    const lt = h - 0.03;
    const nb = Math.max(3, Math.round((lidY - 0.07) / 0.1));
    const parts: Part[] = [
      span('body', [-w / 2 + 0.01, w / 2 - 0.01], [0.03, lidY], [-d / 2 + 0.01, d / 2 - 0.01], { bevel: 0.01 }),
      // Plank cladding on front and ends
      ...slats('body', [-w / 2 + 0.04, w / 2 - 0.04], [0.05, lidY - 0.02], [d / 2 - 0.01, d / 2], nb, { axis: 'y', gap: 0.08, bevel: 0.003, plan: false }),
      ...slats('body', [-w / 2, -w / 2 + 0.01], [0.05, lidY - 0.02], [-d / 2 + 0.04, d / 2 - 0.04], nb, { axis: 'y', gap: 0.08, plan: false }),
      ...slats('body', [w / 2 - 0.01, w / 2], [0.05, lidY - 0.02], [-d / 2 + 0.04, d / 2 - 0.04], nb, { axis: 'y', gap: 0.08, plan: false }),
      // Lid with a planked top
      span('body', [-w / 2, w / 2], [lidY, lt], [-d / 2, d / 2], { bevel: 0.012 }),
      ...slats('body', [-w / 2 + 0.05, w / 2 - 0.05], [lt - 0.004, lt + 0.006], [-d / 2 + 0.05, d / 2 - 0.05], Math.max(3, Math.round((d - 0.1) / 0.1)), {
        axis: 'z',
        gap: 0.08,
        plan: false,
      }),
      // Latch with padlock, hinges
      span('trim', [-0.04, 0.04], [lidY - 0.06, lidY + 0.02], [d / 2, d / 2 + 0.012], { bevel: 0.003, plan: false }),
      span('trim', [-0.015, 0.015], [lidY - 0.1, lidY - 0.06], [d / 2 + 0.002, d / 2 + 0.016], { bevel: 0.003, plan: false }),
      torus('trim', [0, lidY - 0.05, d / 2 + 0.009], 0.012, 0.003, { plan: false }),
    ];
    for (const s of [-1, 1]) {
      parts.push(
        span('trim', [s * w * 0.3 - 0.05, s * w * 0.3 + 0.05], [lidY - 0.02, lidY + 0.02], [-d / 2 - 0.008, -d / 2], { plan: false }),
        span('trim', s < 0 ? [-w / 2 - 0.01, -w / 2] : [w / 2, w / 2 + 0.01], [lidY - 0.12, lidY - 0.09], [-0.08, 0.08], { bevel: 0.003, plan: false }),
      );
      for (const z of [-1, 1]) {
        parts.push(span('trim', [s * (w / 2 - 0.06) - 0.04, s * (w / 2 - 0.06) + 0.04], [0, 0.03], [z * (d / 2 - 0.06) - 0.04, z * (d / 2 - 0.06) + 0.04], { plan: false }));
      }
    }
    // A pair of gardening gloves left on the lid
    for (const [x, turn] of [
      [w * 0.15, 0.4],
      [w * 0.15 + 0.09, 0.2],
    ] as V2[]) {
      parts.push(
        sphere('accent', [x, lt + 0.012, 0], 0.5, { scale: [0.1, 0.02, 0.17], rotation: [0, turn, 0], plan: false }),
        box('accent', [x - Math.sin(turn) * 0.1, lt + 0.012, Math.cos(turn) * 0.1], [0.08, 0.02, 0.05], { rotation: [0, turn, 0], bevel: 0.008, plan: false }),
      );
    }
    return parts;
  },
});

const pottedBayTree = defineAsset({
  id: 'potted-bay-tree',
  name: 'Potted bay tree',
  category: 'plants',
  type: 'plants',
  group: 'Outdoor plants',
  plant: PLANT_SPECIES['laurus-nobilis'],
  tags: ['bay tree', 'topiary', 'laurel', 'standard', 'potted plant', 'terrace', 'entrance'],
  description: 'A bay laurel trained as a lollipop standard, with a clipped ball of dark glossy leaves on a straight trunk in a terracotta pot.',
  defaultSize: { w: 0.55, d: 0.55, h: 1.6 },
  minSize: { w: 0.4, d: 0.4, h: 1.0 },
  maxSize: { w: 0.8, d: 0.8, h: 2.2 },
  slots: [
    matSlot('pot', 'Pot', 'terracotta-pot'),
    matSlot('leaves', 'Leaves', 'plant-leaf-dark'),
    matSlot('trunk', 'Trunk', 'wood-walnut'),
    matSlot('soil', 'Soil', 'plant-soil'),
  ],
  build: ({ w, d, h }) => {
    const m = Math.min(w, d);
    const pr = Math.min(0.2, m * 0.38);
    const ph = Math.min(0.4, h * 0.22);
    const cr = Math.min(m / 2 - 0.01, (h - ph - 0.2) / 2, 0.42);
    const cy = h - cr;
    const parts: Part[] = [
      pot('pot', [0, 0, 0], pr, ph, 'urn'),
      vcyl('soil', 0, 0, ph - 0.04, ph - 0.02, pr * 0.86, { plan: false }),
      vcyl('trunk', 0, 0, ph - 0.04, cy, 0.022, { rTop: 0.015, plan: false }),
      rod('trunk', [0, cy - cr * 0.5, 0], [cr * 0.35, cy - cr * 0.1, 0.05], 0.01, { plan: false }),
      rod('trunk', [0, cy - cr * 0.4, 0], [-cr * 0.3, cy, -0.06], 0.01, { plan: false }),
      // Clipped ball crown with leaves poking out of its surface
      ...blobCluster('leaves', [0, cy, 0], cr, 16, 7),
      // Low underplanting spilling over the rim
      ...foliage('leaves', [0, ph - 0.03, 0], pr * 0.95, 0.1, 6, 21, { spread: 1, leafWid: 0.03 }),
    ];
    const rand = rng(17);
    const ll = cr * 0.22;
    for (let i = 0; i < 14; i++) {
      const az = rand() * Math.PI * 2;
      const tilt = 0.4 + rand() * 1.6;
      const dir: V3 = [Math.sin(tilt) * Math.cos(az), Math.cos(tilt), Math.sin(tilt) * Math.sin(az)];
      parts.push(leaf('leaves', add([0, cy, 0], dir, cr * 0.72), ll, ll * 0.45, az, tilt));
    }
    return parts;
  },
  planDetail: ({ w, d, h }) => {
    const m = Math.min(w, d);
    const ph = Math.min(0.4, h * 0.22);
    return [circle([0, 0], Math.min(m / 2 - 0.01, (h - ph - 0.2) / 2, 0.42))];
  },
});

export const OUTDOOR_ASSETS: AssetDefinition[] = [
  patioTable,
  patioChair,
  sunLounger,
  hammockStand,
  bbqKettle,
  bbqGas,
  parasol,
  outdoorSofa,
  bistroSet,
  planterHerbs,
  hotTub,
  firePit,
  hangingEggChair,
  gardenBench,
  picnicTable,
  bicycle,
  lanternOutdoor,
  deckBox,
  pottedBayTree,
];

/**
 * Wooden seating — solid-wood stools, chairs, benches and a porch swing, each built the way a
 * joiner would: splayed legs with through-tenons and wedges, pegged aprons, staggered stretchers,
 * dadoed treads, bolted pivots and woven rush.
 *
 * Vietnamese café stools (ghế đẩu, low and tall), a ladder-back chair with a rush seat, an
 * Adirondack chair, a mid-century teak armchair, a porch swing on an A-frame stand, a piano bench
 * with a lift top, a two-step stool, a child's high chair, a saddle-seat bar stool and a slatted
 * folding chair.
 */
import {
  arcPoints,
  box,
  cells,
  cellSpans,
  clamp,
  cushion,
  cyl,
  defineItem,
  definePack,
  lathe,
  lerp,
  line,
  matSlot,
  pillow,
  prism,
  range,
  rod,
  rodPath,
  rodX,
  rodZ,
  roundRectPoints,
  spaced,
  span,
  sphere,
  torus,
  turnedLeg,
  vcyl,
  type Part,
  type Size3,
  type V2,
  type V3,
} from '@/packs/kit';

// ── Shared helpers ───────────────────────────────────────────────────────────

const TAU = Math.PI * 2;

/** Detail box (hidden from the plan) spanning x/y/z ranges, with an optional bevel. */
const sp = (slot: string, x: V2, y: V2, z: V2, bevel = 0): Part => span(slot, x, y, z, { bevel, plan: false });

/** Length of a → b and the Euler rotation that points a part's local +y along it (as `rod` does). */
function dirRot(a: V3, b: V3): { len: number; rot: V3 } {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz) || 0.002;
  return { len, rot: [Math.atan2(dz / len, dy / len), 0, Math.atan2(-dx / len, Math.hypot(dy, dz) / len)] };
}

/**
 * Square-section member from a to b (a box version of `rod`). For a mostly vertical member `tx` is
 * its thickness along x and `tz` along z. Hidden from the plan unless `plan` is set.
 */
function stick(slot: string, a: V3, b: V3, tx: number, tz = tx, opts?: { bevel?: number; plan?: boolean }): Part {
  const { len, rot } = dirRot(a, b);
  return box(slot, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], [tx, len, tz], {
    rotation: rot,
    bevel: opts?.bevel,
    plan: opts?.plan ?? false,
  });
}

/** A board seen from the side: `pts` are [z, y], extruded `t` along +x from x. */
function sidePlate(slot: string, pts: V2[], x: number, t: number, plan = false): Part {
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
    plan,
  };
}

/**
 * Plan outline of a rail bent backwards between two posts: its front edge runs from x = −hw to hw
 * at depth `z` at the ends and `bow` further back in the middle; it is `t` thick.
 */
function bowBand(hw: number, z: number, bow: number, t: number, n = 10): V2[] {
  const front: V2[] = range(n + 1).map((i) => {
    const x = -hw + (2 * hw * i) / n;
    const s = x / hw;
    return [x, z - bow * (1 - s * s)];
  });
  return [...front, ...front.map(([x, zz]) => [x, zz - t] as V2).reverse()];
}

/** Mirrors a plan outline across x = 0 when `s` is negative. */
const mirrorX = (pts: V2[], s: number): V2[] => (s < 0 ? pts.map(([x, z]) => [-x, z] as V2).reverse() : pts);

// Rotation matrices (row-major 3 × 3) for chain links that twist about their own axis.
type M3 = number[];
const mat3 = (a: M3, b: M3): M3 =>
  range(9).map((i) => {
    const r = Math.floor(i / 3);
    const c = i % 3;
    return a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
  });
const rotX = (t: number): M3 => [1, 0, 0, 0, Math.cos(t), -Math.sin(t), 0, Math.sin(t), Math.cos(t)];
const rotY = (t: number): M3 => [Math.cos(t), 0, Math.sin(t), 0, 1, 0, -Math.sin(t), 0, Math.cos(t)];
const rotZ = (t: number): M3 => [Math.cos(t), -Math.sin(t), 0, Math.sin(t), Math.cos(t), 0, 0, 0, 1];
/** Euler angles (three.js 'XYZ', the order parts use) of a rotation matrix. */
function eulerXYZ(m: M3): V3 {
  const y = Math.asin(clamp(m[2], -1, 1));
  if (Math.abs(m[2]) < 0.9999999) return [Math.atan2(-m[5], m[8]), y, Math.atan2(-m[1], m[0])];
  return [Math.atan2(m[7], m[4]), y, 0];
}

/** A chain of interlocking oval links from a to b (at most `maxLinks`), alternate links turned 90°. */
function chain(slot: string, a: V3, b: V3, maxLinks: number): Part[] {
  const { len, rot } = dirRot(a, b);
  const n = clamp(Math.round(len / 0.055), 2, maxLinks);
  const pitch = len / n;
  const R = 0.011;
  const tube = 0.0035;
  const sy = (pitch * 0.68) / (R + tube);
  const base = mat3(rotX(rot[0]), rotZ(rot[2]));
  const twisted = eulerXYZ(mat3(base, rotY(Math.PI / 2)));
  return range(n).map((i) => {
    const t = (i + 0.5) / n;
    return torus(slot, [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)], R, tube, {
      rotation: i % 2 ? twisted : rot,
      scale: [1, sy, 1],
      plan: false,
    });
  });
}

// ── Café stools (ghế đẩu) ────────────────────────────────────────────────────

/**
 * Vietnamese café stool: a two-board plank seat overhanging four splayed square legs whose tops
 * come through the seat as wedged tenons; pegged aprons and staggered stretchers.
 */
function cafeStool({ w, d, h }: Size3, tall: boolean): Part[] {
  const parts: Part[] = [];
  const ts = clamp(h * 0.065, 0.026, 0.036);
  const yU = h - ts;
  const t = tall ? 0.038 : 0.034;
  const ov = 0.022;
  const xt = w / 2 - ov - t / 2;
  const zt = d / 2 - ov - t / 2;
  const xb = Math.min(w / 2 - t / 2 - 0.004, xt + (tall ? 0.03 : 0.02));
  const zb = Math.min(d / 2 - t / 2 - 0.004, zt + (tall ? 0.03 : 0.02));
  const xAt = (y: number) => lerp(xb, xt, y / yU);
  const zAt = (y: number) => lerp(zb, zt, y / yU);

  // Seat: two boards with a hairline seam.
  parts.push(
    span('seat', [-w / 2, w / 2], [yU, h], [-d / 2, -0.001], { bevel: 0.005 }),
    span('seat', [-w / 2, w / 2], [yU, h], [0.001, d / 2], { bevel: 0.005 }),
  );
  const k = t * 0.36;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = sx * xt;
      const z = sz * zt;
      parts.push(stick('frame', [sx * xb, 0, sz * zb], [x, yU, z], t, t, { bevel: 0.003 }));
      // Through-tenon showing on the seat, split by a contrasting wedge.
      parts.push(sp('frame', [x - k, x + k], [h - 0.004, h + 0.001], [z - k, z + k]));
      parts.push(sp('seat', [x - k, x + k], [h - 0.003, h + 0.0016], [z - 0.0018, z + 0.0018]));
    }
  }
  // Aprons under the seat, tenoned into the legs and pinned with pegs.
  const ah = tall ? 0.06 : 0.05;
  const ya = yU - ah / 2;
  const xa = xAt(ya);
  const za = zAt(ya);
  for (const s of [-1, 1]) {
    parts.push(sp('frame', [-xa, xa], [yU - ah, yU], [s * za - 0.009, s * za + 0.009]));
    parts.push(sp('frame', [s * xa - 0.009, s * xa + 0.009], [yU - ah, yU], [-za, za]));
  }
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      parts.push(cyl('seat', [sx * xa, ya, sz * (za + t / 2)], 0.0045, 0.004, { rotation: [Math.PI / 2, 0, 0], plan: false }));
      parts.push(cyl('seat', [sx * (xa + t / 2), ya, sz * za], 0.0045, 0.004, { rotation: [0, 0, Math.PI / 2], plan: false }));
    }
  }
  // Stretchers: the side ones sit a little higher so the mortises don't meet.
  const rings = tall ? [clamp(h * 0.27, 0.14, 0.22), h * 0.56] : [clamp(h * 0.26, 0.07, 0.13)];
  for (const [i, y] of rings.entries()) {
    const ys = y + 0.035;
    for (const s of [-1, 1]) {
      const fr = tall && i === 0 && s === 1 ? 0.015 : 0.011; // the tall stool's front footrest is chunkier
      parts.push(sp('frame', [-xAt(y), xAt(y)], [y - fr, y + fr], [s * zAt(y) - fr, s * zAt(y) + fr], 0.002));
      parts.push(sp('frame', [s * xAt(ys) - 0.011, s * xAt(ys) + 0.011], [ys - 0.011, ys + 0.011], [-zAt(ys), zAt(ys)], 0.002));
    }
  }
  return parts;
}

const lowCafeStool = defineItem({
  id: 'cafe-stool-low',
  name: 'Low café stool (ghế đẩu)',
  category: 'living',
  type: 'seating',
  group: 'Stools & benches',
  tags: ['stool', 'cafe stool', 'café', 'ghế đẩu', 'ghe dau', 'plant stand', 'side table', 'wooden stool', 'vietnamese', 'acacia', 'gỗ tràm'],
  defaultSize: { w: 0.3, d: 0.3, h: 0.42 },
  minSize: { w: 0.24, d: 0.24, h: 0.26 },
  maxSize: { w: 0.42, d: 0.42, h: 0.5 },
  slots: [matSlot('seat', 'Seat & pegs', 'acacia-varnish'), matSlot('frame', 'Legs & rails', 'acacia-varnish')],
  build: (size) => cafeStool(size, false),
  planDetail: ({ w }) => [line([-w / 2, 0], [w / 2, 0])],
});

const tallCafeStool = defineItem({
  id: 'cafe-stool-tall',
  name: 'Tall café stool (ghế đẩu cao)',
  category: 'dining',
  type: 'seating',
  group: 'Stools & benches',
  tags: ['stool', 'tall stool', 'cafe stool', 'café', 'ghế đẩu', 'ghe dau cao', 'plant stand', 'wooden stool', 'vietnamese', 'rosewood'],
  defaultSize: { w: 0.34, d: 0.34, h: 0.62 },
  minSize: { w: 0.28, d: 0.28, h: 0.5 },
  maxSize: { w: 0.44, d: 0.44, h: 0.78 },
  slots: [matSlot('seat', 'Seat & pegs', 'acacia-varnish'), matSlot('frame', 'Legs & rails', 'rosewood-dark')],
  build: (size) => cafeStool(size, true),
  planDetail: ({ w }) => [line([-w / 2, 0], [w / 2, 0])],
});

// ── Ladder-back chair with a rush seat ───────────────────────────────────────

const ladderBack = defineItem({
  id: 'ladder-back-rush-chair',
  name: 'Ladder-back chair with rush seat',
  category: 'dining',
  type: 'seating',
  group: 'Dining chairs',
  tags: ['ladder back', 'ladderback', 'rush seat', 'woven seat', 'shaker', 'farmhouse', 'country chair', 'dining chair', 'cherry', 'ghế gỗ'],
  defaultSize: { w: 0.47, d: 0.46, h: 1.02 },
  minSize: { w: 0.42, d: 0.4, h: 0.9 },
  maxSize: { w: 0.56, d: 0.54, h: 1.12 },
  slots: [matSlot('frame', 'Frame', 'wood-cherry'), matSlot('rush', 'Rush seat', 'rush-natural')],
  build: ({ w, d, h }) => {
    const parts: Part[] = [];
    const seat = clamp(h * 0.45, 0.42, 0.48);
    const r = 0.018;
    const xf = w / 2 - 0.026; // front legs
    const xb = w / 2 - 0.068; // back posts: the seat is a trapezoid, wider at the front
    const zf = d / 2 - 0.028;
    const rake = clamp(h * 0.055, 0.04, 0.065);
    const zb = -d / 2 + 0.024 + rake;
    const fin = 0.05;
    const top = h - fin;
    const zTop = zb - rake;
    const zPost = (y: number) => (y <= seat ? zb : lerp(zb, zTop, (y - seat) / (top - seat)));

    for (const s of [-1, 1]) {
      // Front legs swell slightly towards the seat and end in a small dome.
      parts.push(vcyl('frame', s * xf, zf, 0, seat + 0.03, r * 0.85, { rTop: r, plan: false }));
      parts.push(sphere('frame', [s * xf, seat + 0.03, zf], r, { scale: [1, 0.55, 1], plan: false }));
      // Back posts: straight to the seat, then raked back, topped with turned finials.
      parts.push(
        ...rodPath(
          'frame',
          [
            [s * xb, 0, zb],
            [s * xb, seat, zb],
            [s * xb, top, zTop],
          ],
          r,
        ),
      );
      parts.push(
        lathe(
          'frame',
          [s * xb, top - 0.004, zTop],
          [
            [0, 0],
            [r * 0.95, 0],
            [r * 1.05, 0.008],
            [r * 0.6, 0.018],
            [r * 0.95, 0.03],
            [r * 0.72, 0.045],
            [0, fin + 0.003],
          ],
          { segments: 16, plan: false },
        ),
      );
    }

    // Rush seat: cords rolled over the four seat rails, a woven deck and the X where the four
    // woven quarters meet.
    const ry = seat - 0.008;
    const corners: V3[] = [
      [-xf, ry, zf],
      [xf, ry, zf],
      [xb, ry, zb],
      [-xb, ry, zb],
    ];
    for (const i of range(4)) parts.push(rod('rush', corners[i], corners[(i + 1) % 4], 0.02, { plan: false }));
    parts.push(
      prism(
        'rush',
        [
          [-xf, zf],
          [xf, zf],
          [xb, zb],
          [-xb, zb],
        ],
        seat - 0.026,
        0.036,
      ),
    );
    const zc = (zf + zb) / 2;
    for (const c of corners) {
      parts.push(rod('rush', [c[0] * 0.9, seat + 0.01, lerp(zc, c[2], 0.9)], [0, seat + 0.013, zc], 0.0055, { plan: false }));
    }

    // Turned rungs: one at the front, one at the back, two staggered on each side.
    parts.push(rodX('frame', -xf, xf, 0.19, zf, 0.014, { plan: false }));
    parts.push(rodX('frame', -xb, xb, 0.16, zb, 0.012, { plan: false }));
    for (const s of [-1, 1]) {
      for (const y of [0.13, 0.27]) parts.push(rod('frame', [s * xf, y, zf], [s * xb, y, zb], 0.012, { plan: false }));
    }

    // Graduated ladder slats, bent backwards in plan, deeper towards the top.
    const n = h >= 1.0 ? 4 : 3;
    const hs = range(n).map((k) => 0.048 + 0.007 * k);
    const y0 = seat + 0.17;
    const y1 = top - 0.03;
    const gap = (y1 - y0 - hs.reduce((a, b) => a + b, 0)) / (n - 1);
    let y = y0;
    for (const k of range(n)) {
      const zm = zPost(y + hs[k] / 2);
      parts.push(prism('frame', bowBand(xb - r * 0.4, zm + 0.006, 0.014, 0.012), y, hs[k], { plan: false }));
      y += hs[k] + gap;
    }
    return parts;
  },
});

// ── Adirondack chair ─────────────────────────────────────────────────────────

const adirondack = defineItem({
  id: 'adirondack-chair',
  name: 'Adirondack chair',
  category: 'outdoor',
  type: 'seating',
  group: 'Outdoor seating',
  tags: ['adirondack', 'muskoka', 'garden chair', 'deck chair', 'fan back', 'slatted', 'cedar', 'porch', 'balcony', 'ghế gỗ ngoài trời'],
  defaultSize: { w: 0.76, d: 0.9, h: 0.95 },
  minSize: { w: 0.66, d: 0.8, h: 0.85 },
  maxSize: { w: 0.88, d: 1.0, h: 1.05 },
  slots: [matSlot('frame', 'Frame & arms', 'cedar-weathered'), matSlot('slats', 'Seat & back slats', 'cedar-weathered'), matSlot('bolts', 'Carriage bolts', 'metal-brushed-steel')],
  build: ({ w, d, h }) => {
    const parts: Part[] = [];
    const zF = d / 2 - 0.035;
    const seatF = clamp(h * 0.38, 0.33, 0.4); // top of the stringers at the front
    const zS = -d / 2 + d * 0.42; // where the seat ends and the stringers dive to the floor
    const seatB = seatF - (zF - zS) * 0.2;
    const zT = -d / 2 + 0.02;
    const armY = clamp(h * 0.62, 0.54, 0.64);
    const aw = clamp(w * 0.17, 0.12, 0.15);
    const xLo = w / 2 - aw * 0.3; // outer face of the front legs
    const xSo = xLo - 0.032; // outer face of the stringers
    const xSi = xSo - 0.032;

    // Stringers: the long side boards that run from the seat front down to the floor at the back.
    const prof: V2[] = [
      [zF, seatF],
      [zS, seatB],
      [zT, 0],
      [zT + 0.17, 0],
      [zF, seatF - 0.13],
    ];
    parts.push(sidePlate('frame', prof, xSi, 0.032, true), sidePlate('frame', prof, -xSo, 0.032, true));
    parts.push(sp('frame', [-xSi, xSi], [seatF - 0.13, seatF - 0.035], [zF - 0.022, zF]));

    // Seat slats following the stringers' gentle slope.
    const slope = Math.atan2(seatF - seatB, zF - zS);
    const ns = 6;
    const za = zF - 0.025;
    const zb = zS + 0.035;
    const sdep = Math.min(0.075, (za - zb) / (ns - 1) / Math.cos(slope) - 0.012);
    for (const i of range(ns)) {
      const z = lerp(za, zb, i / (ns - 1));
      const y = seatF - (zF - z) * Math.tan(slope);
      const c: V3 = [0, y + Math.cos(slope) * 0.01, z - Math.sin(slope) * 0.01];
      parts.push(box('slats', c, [2 * xSo - 0.002, 0.02, sdep], { rotation: [-slope, 0, 0], bevel: 0.005 }));
    }

    // Front legs with carriage bolts through the stringers, and curved brackets under the arms.
    const zL0 = zF - 0.17;
    const zL1 = zF - 0.085;
    const zLm = (zL0 + zL1) / 2;
    const yStr = seatF - (zF - zLm) * Math.tan(slope);
    for (const s of [-1, 1]) {
      parts.push(span('frame', s > 0 ? [xSo, xLo] : [-xLo, -xSo], [0, armY], [zL0, zL1], { bevel: 0.003, plan: false }));
      for (const [dz, dy] of [
        [-0.02, 0.035],
        [0.02, 0.085],
      ]) {
        parts.push(sphere('bolts', [s * (xLo + 0.0005), yStr - dy, zLm + dz], 0.009, { scale: [0.45, 1, 1], plan: false }));
      }
      const cz = zL1 + 0.07;
      const cy = armY - 0.15;
      const rz = cz - (zL0 + 0.01);
      const bracket: V2[] = [[zL0 + 0.01, armY], ...range(9).map((i) => {
        const a = Math.PI / 2 + (i / 8) * (Math.PI / 2);
        return [cz + rz * Math.cos(a), cy + 0.15 * Math.sin(a)] as V2;
      })];
      parts.push(sidePlate('frame', bracket, s > 0 ? xLo : -xLo - 0.02, 0.02));
    }

    // Fan back: slats leaning back, spreading out towards the top, cut to an arc.
    const yb0 = seatB - 0.09;
    const zb0 = zS - 0.03;
    const zTop = -d / 2 + 0.035;
    const yTop = h - 0.012;
    const lean = Math.atan2(zb0 - zTop, yTop - yb0);
    const zOn = (y: number) => zb0 - (y - yb0) * Math.tan(lean);
    const nb = w >= 0.82 ? 7 : 5;
    const xi = w / 2 - aw; // inner edge of the arms
    const bw = clamp(xi * 0.27, 0.055, 0.075);
    const pArm = (armY - yb0) / (yTop - yb0);
    const xB = xSi * 0.5;
    const xT = Math.min(w / 2 - bw / 2 - 0.02, xB + (xi - bw / 2 - 0.01 - xB) / pArm);
    const spread = (p: number) => lerp(xB, xT, p);
    for (const i of range(nb)) {
      const f = (i / (nb - 1)) * 2 - 1;
      const yt = yTop - 0.11 * f * f;
      const p = (yt - yb0) / (yTop - yb0);
      parts.push(stick('slats', [f * xB, yb0, zb0], [f * spread(p), yt, zOn(yt)], bw, 0.018, { bevel: 0.004, plan: true }));
    }
    // Battens behind the slats, leaning with them: one low, one under the arms, one high.
    const behind = (y: number, off: number): V3 => [0, y - off * Math.sin(lean), zOn(y) - off * Math.cos(lean)];
    const pU = 0.6 + 0.4 * pArm;
    const yU = lerp(yb0, yTop, pU);
    const yA = armY - 0.035;
    for (const [y, len, hh, tt] of [
      [yb0 + 0.05, 2 * xSi, 0.08, 0.022],
      [yA, w - 0.03, 0.07, 0.024],
      [yU, 2 * (spread(pU) + bw / 2), 0.06, 0.02],
    ]) {
      parts.push(box('frame', behind(y, 0.009 + tt / 2), [len, hh, tt], { rotation: [-lean, 0, 0], bevel: 0.003, plan: false }));
    }

    // Wide flat arms with rounded front ends, resting on the legs and the arm batten.
    const armBack = behind(yA, 0.033)[2] - 0.012;
    const ar = aw / 2;
    for (const s of [-1, 1]) {
      const pts: V2[] = [[xi, armBack], [w / 2, armBack], ...arcPoints(xi + ar, d / 2 - ar - 0.002, ar, 0, Math.PI, 10)];
      parts.push(prism('frame', mirrorX(pts, s), armY, 0.022));
    }
    return parts;
  },
});

// ── Mid-century teak armchair ────────────────────────────────────────────────

const teakArmchair = defineItem({
  id: 'mid-century-teak-armchair',
  name: 'Mid-century teak armchair',
  category: 'living',
  type: 'seating',
  group: 'Living chairs',
  tags: ['armchair', 'lounge chair', 'mid-century', 'danish', 'teak', 'floating arms', 'cushions', 'scandinavian', 'retro', 'ghế bành gỗ'],
  defaultSize: { w: 0.68, d: 0.78, h: 0.78 },
  minSize: { w: 0.6, d: 0.68, h: 0.7 },
  maxSize: { w: 0.84, d: 0.92, h: 0.92 },
  slots: [matSlot('wood', 'Teak frame', 'teak-oiled'), matSlot('cushion', 'Cushions', 'cushion-oatmeal'), matSlot('webbing', 'Rubber webbing', 'rubber-black')],
  build: ({ w, d, h }) => {
    const parts: Part[] = [];
    const xs = w / 2 - 0.045; // centre line of the side frames
    const railY = clamp(h * 0.36, 0.25, 0.32);
    const armY = clamp(h * 0.72, 0.52, 0.62); // underside of the arms
    const zFf = d / 2 - 0.05;
    const zFt = d / 2 - 0.085;
    const zBf = -d / 2 + 0.05;
    const zBk = -d / 2 + 0.14; // back leg at the seat rail
    const postTop = h - 0.012;
    const zPt = -d / 2 + 0.03;
    const zFront = (y: number) => lerp(zFf, zFt, y / (armY - 0.016));
    const zPost = (y: number) => lerp(zBk, zPt, (y - railY) / (postTop - railY));

    for (const s of [-1, 1]) {
      const x = s * xs;
      // Tapered legs: the back leg kicks out behind and carries on up as the raked back post.
      parts.push(rod('wood', [x, 0, zFf], [x, armY - 0.016, zFt], 0.013, { rTop: 0.02, plan: false }));
      parts.push(rod('wood', [x, 0, zBf], [x, railY, zBk], 0.013, { rTop: 0.02, plan: false }));
      parts.push(rod('wood', [x, railY, zBk], [x, postTop, zPt], 0.02, { rTop: 0.016, plan: false }));
      parts.push(sp('wood', [x - 0.014, x + 0.014], [railY - 0.045, railY + 0.015], [zBk, zFront(railY)], 0.003));
      // The arm floats on a slim dowel above the front leg and butts into the back post.
      parts.push(vcyl('wood', x, zFt, armY - 0.02, armY, 0.011, { plan: false }));
      const wf = 0.035;
      const wb = 0.022;
      const zA0 = zPost(armY);
      const pts: V2[] = [[xs - wb, zA0], [xs + wb, zA0], ...arcPoints(xs, d / 2 - 0.004 - wf, wf, 0, Math.PI, 10)];
      parts.push(prism('wood', mirrorX(pts, s), armY, 0.024));
    }
    // Seat rails with rubber webbing straps between them.
    const zfr = zFront(railY);
    parts.push(sp('wood', [-xs, xs], [railY - 0.05, railY + 0.012], [zfr - 0.012, zfr + 0.012], 0.003));
    parts.push(sp('wood', [-xs, xs], [railY - 0.04, railY + 0.012], [zBk - 0.012, zBk + 0.012], 0.003));
    for (const x of spaced(4, -xs + 0.08, xs - 0.08)) parts.push(sp('webbing', [x - 0.025, x + 0.025], [railY + 0.012, railY + 0.016], [zBk, zfr]));
    // Back rails bent backwards between the posts: a low rail and the crest.
    for (const [y, hh] of [
      [railY + 0.14, 0.05],
      [h - 0.085, 0.065],
    ]) {
      parts.push(prism('wood', bowBand(xs - 0.012, zPost(y + hh / 2) + 0.011, 0.018, 0.022), y, hh, { plan: false }));
    }
    // Loose seat and back cushions; the back cushion leans on the rails and has two rows of buttons.
    parts.push(cushion('cushion', [-xs + 0.024, xs - 0.024], [railY + 0.016, railY + 0.12], [zBk + 0.02, d / 2 - 0.045], { softness: 0.3 }));
    const lean = Math.atan2(zBk - zPt, postTop - railY);
    const yc0 = railY + 0.125;
    const yc1 = h - 0.035;
    const yc = (yc0 + yc1) / 2;
    const L = (yc1 - yc0) / Math.cos(lean);
    const bt = 0.09;
    // Rests against the rails' front faces (they bow back by 18 mm in the middle).
    const zc = zPost(yc) + 0.011 - 0.006 + bt / 2 / Math.cos(lean) + 0.004;
    parts.push(box('cushion', [0, yc, zc], [2 * (xs - 0.03), L, bt], { rotation: [-lean, 0, 0], bevel: 0.03, plan: false }));
    for (const v of [-0.17, 0.17]) {
      for (const u of [-0.13, 0, 0.13]) {
        const ly = v * L;
        const c: V3 = [u * (w / 0.68), yc + ly * Math.cos(lean) + (bt / 2 - 0.004) * Math.sin(lean), zc - ly * Math.sin(lean) + (bt / 2 - 0.004) * Math.cos(lean)];
        parts.push(sphere('cushion', c, 0.011, { scale: [1, 1, 0.5], rotation: [-lean, 0, 0], plan: false }));
      }
    }
    return parts;
  },
});

// ── Porch swing on an A-frame stand ──────────────────────────────────────────

const porchSwing = defineItem({
  id: 'porch-swing-a-frame',
  name: 'Porch swing on A-frame stand',
  category: 'outdoor',
  type: 'seating',
  group: 'Outdoor seating',
  tags: ['porch swing', 'swing bench', 'a-frame', 'garden swing', 'chain', 'patio', 'veranda', 'slatted', 'xích đu', 'xich du'],
  defaultSize: { w: 2.4, d: 1.4, h: 2.1 },
  minSize: { w: 2.0, d: 1.2, h: 1.9 },
  maxSize: { w: 2.9, d: 1.7, h: 2.4 },
  slots: [
    matSlot('frame', 'A-frame stand', 'cedar-weathered'),
    matSlot('swing', 'Swing bench', 'wood-painted-white'),
    matSlot('chain', 'Chains & eye bolts', 'metal-anthracite'),
    matSlot('cushion', 'Seat cushion & pillows', 'cushion-oatmeal'),
  ],
  build: ({ w, d, h }) => {
    const parts: Part[] = [];
    const xe = w / 2 - 0.06;
    const beamH = 0.14;
    const yApex = h - beamH;
    const zFoot = d / 2 - 0.06;
    const legY0 = 0.05;
    const zLeg = (y: number) => lerp(zFoot, 0.045, (y - legY0) / (yApex - legY0));

    // Stand: a top beam on two A-frames, each with a skid, a tie and a gusset at the apex.
    parts.push(span('frame', [-w / 2, w / 2], [yApex, h], [-0.045, 0.045], { bevel: 0.004 }));
    const yt = clamp(h * 0.36, 0.6, 0.85);
    for (const s of [-1, 1]) {
      const x = s * xe;
      parts.push(span('frame', [x - 0.04, x + 0.04], [0, legY0 + 0.01], [-d / 2, d / 2], { bevel: 0.004 }));
      for (const sz of [-1, 1]) parts.push(stick('frame', [x, legY0, sz * zFoot], [x, yApex, sz * 0.045], 0.07, 0.08, { bevel: 0.004 }));
      const xt = x - s * 0.055;
      parts.push(sp('frame', [xt - 0.02, xt + 0.02], [yt - 0.05, yt + 0.05], [-zLeg(yt) - 0.06, zLeg(yt) + 0.06], 0.003));
      parts.push(
        sidePlate(
          'frame',
          [
            [-0.25, yApex - 0.42],
            [0.25, yApex - 0.42],
            [0.08, yApex],
            [-0.08, yApex],
          ],
          s > 0 ? x + 0.035 : x - 0.053,
          0.018,
        ),
      );
    }

    // Swing bench.
    const ys = 0.47;
    const hs = Math.min(0.8, xe - 0.035 - 0.22);
    const sd = clamp(d * 0.42, 0.52, 0.64);
    const zf = sd / 2;
    const zb = -sd / 2;
    const yr = ys - 0.1;
    parts.push(sp('swing', [-hs, hs], [yr, ys - 0.022], [zf - 0.035, zf], 0.004));
    parts.push(sp('swing', [-hs, hs], [yr, ys - 0.022], [zb + 0.04, zb + 0.075], 0.004));
    for (const s of [-1, 1]) parts.push(sp('swing', s > 0 ? [hs - 0.035, hs] : [-hs, -hs + 0.035], [yr, ys - 0.022], [zb + 0.04, zf], 0.004));
    const nSlat = Math.round((zf - zb - 0.05) / 0.085);
    for (const [a, b] of cellSpans(nSlat, zb + 0.05, zf)) parts.push(span('swing', [-hs, hs], [ys - 0.022, ys], [a + 0.005, b - 0.005], { bevel: 0.004 }));
    // Raked back: posts, two rails and a row of flat spindles.
    const yBt = ys + clamp(h * 0.25, 0.45, 0.55);
    const zBb = zb + 0.065;
    const zBt = zb;
    const zBack = (y: number) => lerp(zBb, zBt, (y - yr) / (yBt - yr));
    const lean = Math.atan2(zBb - zBt, yBt - yr);
    for (const s of [-1, 1]) parts.push(stick('swing', [s * (hs - 0.02), yr, zBb], [s * (hs - 0.02), yBt, zBt], 0.04, 0.045, { bevel: 0.004 }));
    const ri = hs - 0.04;
    for (const [y, hh] of [
      [ys + 0.07, 0.06],
      [yBt - 0.045, 0.07],
    ]) {
      parts.push(box('swing', [0, y, zBack(y)], [2 * ri, hh, 0.03], { rotation: [-lean, 0, 0], bevel: 0.004, plan: false }));
    }
    const m = clamp(Math.round((2 * ri) / 0.1), 6, 14);
    const sy0 = ys + 0.1;
    const sy1 = yBt - 0.08;
    for (const x of cells(m, -ri, ri)) parts.push(stick('swing', [x, sy0, zBack(sy0)], [x, sy1, zBack(sy1)], 0.05, 0.016, { bevel: 0.003 }));
    // Arms on front posts.
    const ya = ys + 0.23;
    for (const s of [-1, 1]) {
      parts.push(span('swing', s > 0 ? [hs - 0.075, hs] : [-hs, -hs + 0.075], [ya, ya + 0.025], [zBack(ya) - 0.01, zf + 0.01], { bevel: 0.004 }));
      parts.push(sp('swing', s > 0 ? [hs - 0.045, hs - 0.005] : [-hs + 0.005, -hs + 0.045], [yr, ya], [zf - 0.06, zf - 0.02], 0.003));
    }
    // Cushion and two pillows.
    parts.push(cushion('cushion', [-hs + 0.05, hs - 0.05], [ys, ys + 0.06], [zBack(ys) + 0.03, zf - 0.005], { softness: 0.4, plan: false }));
    for (const s of [-1, 1]) {
      const py = ys + 0.06 + 0.17;
      parts.push(pillow('cushion', [s * hs * 0.55, py, zBack(py) + 0.085], 0.38, 0.34, 0.12, { lean: lean + 0.1 }));
    }

    // Hanging: an eye bolt in the beam, a chain down to a ring, two chains to the arm's ends.
    const yHook = yApex - 0.012;
    for (const s of [-1, 1]) {
      const x = s * (hs - 0.035);
      const front: V3 = [x, ya + 0.025, zf - 0.04];
      const back: V3 = [x, ya + 0.025, zBack(ya)];
      const ringP: V3 = [x, Math.min(yHook - 0.25, ya + 0.43), (front[2] + back[2]) / 2];
      parts.push(torus('chain', [x, yHook - 0.018, 0], 0.016, 0.005, { rotation: [0, Math.PI / 2, 0], plan: false }));
      parts.push(torus('chain', ringP, 0.028, 0.006, { rotation: [0, Math.PI / 2, 0], plan: false }));
      parts.push(...chain('chain', [x, yHook - 0.034, 0], [x, ringP[1] + 0.028, ringP[2]], 12));
      const below: V3 = [x, ringP[1] - 0.028, ringP[2]];
      parts.push(...chain('chain', below, front, 8), ...chain('chain', below, back, 8));
    }
    return parts;
  },
});

// ── Piano bench with a lift top ──────────────────────────────────────────────

const pianoBench = defineItem({
  id: 'piano-bench-lift-top',
  name: 'Piano bench with lift top',
  category: 'hobbies',
  type: 'seating',
  group: 'Stools & benches',
  tags: ['piano bench', 'piano stool', 'music', 'lift top', 'storage bench', 'sheet music', 'tufted', 'ebony', 'ghế đàn piano'],
  defaultSize: { w: 0.76, d: 0.36, h: 0.5 },
  minSize: { w: 0.56, d: 0.3, h: 0.45 },
  maxSize: { w: 1.0, d: 0.45, h: 0.56 },
  slots: [matSlot('wood', 'Case & legs', 'piano-black'), matSlot('pad', 'Seat pad', 'leather-black'), matSlot('metal', 'Hinge & ferrules', 'metal-brass')],
  build: ({ w, d, h }) => {
    const parts: Part[] = [];
    const pad = clamp(h * 0.07, 0.025, 0.04);
    const lid = 0.026;
    const yLt = h - pad;
    const yL0 = yLt - lid;
    const yB0 = yL0 - clamp(h * 0.24, 0.1, 0.14); // underside of the music box
    const bx = w / 2 - 0.016;
    const bz = d / 2 - 0.016;
    const t = 0.044;
    const lx = bx - t / 2;
    const lz = bz - t / 2;
    // Legs: square corner posts in the box, turned and tapered below, on brass ferrules.
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const x = sx * lx;
        const z = sz * lz;
        parts.push(sp('wood', [x - t / 2, x + t / 2], [yB0, yL0 - 0.001], [z - t / 2, z + t / 2], 0.002));
        parts.push(turnedLeg('wood', x, z, 0.03, yB0, t / 2, { style: 'taper' }));
        parts.push(vcyl('metal', x, z, 0, 0.032, (t / 2) * 0.58, { rTop: (t / 2) * 0.6, segments: 16, plan: false }));
      }
    }
    // Music box: panels set 4 mm back between the posts, with a bead along the bottom edge.
    const pz = bz - 0.004;
    const px = bx - 0.004;
    const ix = lx - t / 2;
    const iz = lz - t / 2;
    for (const s of [-1, 1]) {
      parts.push(sp('wood', [-ix, ix], [yB0, yL0 - 0.001], s > 0 ? [pz - 0.016, pz] : [-pz, -pz + 0.016]));
      parts.push(sp('wood', s > 0 ? [px - 0.016, px] : [-px, -px + 0.016], [yB0, yL0 - 0.001], [-iz, iz]));
      parts.push(rodX('wood', -ix, ix, yB0 + 0.006, s * (pz + 0.001), 0.006, { plan: false }));
      parts.push(rodZ('wood', s * (px + 0.001), yB0 + 0.006, -iz, iz, 0.006, { plan: false }));
    }
    // Lid with a rounded edge, piano hinge at the back and a small brass lifting plate at the front.
    parts.push(span('wood', [-w / 2, w / 2], [yL0, yLt], [-d / 2, d / 2], { bevel: 0.008 }));
    parts.push(sp('metal', [-bx + 0.03, bx - 0.03], [yL0 - 0.014, yL0 + 0.003], [-pz - 0.002, -pz]));
    parts.push(rodX('metal', -bx + 0.03, bx - 0.03, yL0, -pz - 0.003, 0.0035, { plan: false }));
    parts.push(sp('metal', [-0.035, 0.035], [yL0 - 0.004, yL0], [pz, d / 2 - 0.004]));
    // Buttoned seat pad.
    parts.push(cushion('pad', [-w / 2 + 0.022, w / 2 - 0.022], [yLt - 0.004, h], [-d / 2 + 0.022, d / 2 - 0.022], { softness: 0.45, plan: false }));
    const nx = clamp(Math.round(w / 0.2), 3, 5);
    for (const x of cells(nx, -w / 2 + 0.04, w / 2 - 0.04)) {
      for (const z of [-(d / 2 - 0.022) * 0.45, (d / 2 - 0.022) * 0.45]) parts.push(sphere('pad', [x, h - 0.004, z], 0.007, { scale: [1, 0.6, 1], plan: false }));
    }
    // H-stretcher.
    const ys = 0.11;
    for (const sx of [-1, 1]) parts.push(sp('wood', [sx * lx - 0.011, sx * lx + 0.011], [ys - 0.013, ys + 0.013], [-lz, lz], 0.003));
    parts.push(sp('wood', [-lx, lx], [ys - 0.011, ys + 0.011], [-0.011, 0.011], 0.003));
    return parts;
  },
});

// ── Two-step stool ───────────────────────────────────────────────────────────

const stepStool = defineItem({
  id: 'two-step-stool',
  name: 'Two-step wooden step stool',
  category: 'kitchen',
  type: 'seating',
  group: 'Stools & benches',
  tags: ['step stool', 'steps', 'kitchen steps', 'library steps', 'two step', 'through tenon', 'handhold', 'ghế bậc', 'thang gỗ'],
  defaultSize: { w: 0.42, d: 0.44, h: 0.46 },
  minSize: { w: 0.34, d: 0.36, h: 0.36 },
  maxSize: { w: 0.6, d: 0.56, h: 0.6 },
  slots: [matSlot('wood', 'Sides & rails', 'honey-pine'), matSlot('treads', 'Treads & tenons', 'walnut-oiled'), matSlot('grip', 'Grip strips', 'rubber-black')],
  build: ({ w, d, h }) => {
    const parts: Part[] = [];
    const t = 0.022;
    const tr = 0.024;
    const y1 = h * 0.5;
    const zFront = d / 2 - 0.022;
    const zBack = -d / 2 + 0.008;
    const zMid = lerp(-d / 2, d / 2, 0.47);
    const xi = w / 2 - t;
    // Stepped sides with an arched cut-out between the feet.
    const foot = 0.05;
    const archH = clamp(h * 0.16, 0.05, 0.09);
    const prof: V2[] = [
      [zFront, 0],
      [zFront, y1],
      [zMid, y1],
      [zMid, h],
      [zBack, h],
      [zBack, 0],
      ...range(13).map((i) => [lerp(zBack + foot, zFront - foot, i / 12), archH * Math.sin((Math.PI * i) / 12)] as V2),
    ];
    parts.push(sidePlate('wood', prof, xi, t, true), sidePlate('wood', prof, -w / 2, t, true));

    // Treads housed in the sides; the top one has a hand-hold slot.
    parts.push(span('treads', [-xi, xi], [y1 - tr, y1], [zMid, d / 2], { bevel: 0.004 }));
    const uz0 = -d / 2;
    const uz1 = zMid + 0.022;
    const hx = Math.min(0.06, xi * 0.4);
    const hz0 = -d / 2 + 0.045;
    const hz1 = -d / 2 + 0.075;
    const yt: V2 = [h - tr, h];
    parts.push(
      span('treads', [-xi, xi], yt, [hz1, uz1]),
      span('treads', [-xi, xi], yt, [uz0, hz0]),
      span('treads', [-xi, -hx], yt, [hz0, hz1]),
      span('treads', [hx, xi], yt, [hz0, hz1]),
    );
    // Through-tenons of both treads showing on the outside of the sides.
    for (const [z0, z1, ty] of [
      [zMid, zFront, y1],
      [zBack, zMid, h],
    ]) {
      for (const f of [0.25, 0.75]) {
        const zc = lerp(z0, z1, f);
        const hl = (z1 - z0) * 0.14;
        for (const s of [-1, 1]) {
          parts.push(sp('treads', s > 0 ? [w / 2 - 0.001, w / 2 + 0.002] : [-w / 2 - 0.002, -w / 2 + 0.001], [ty - tr + 0.004, ty - 0.004], [zc - hl, zc + hl]));
        }
      }
    }
    // Riser, stretchers and aprons.
    parts.push(
      sp('wood', [-xi, xi], [y1, h - tr], [zMid - 0.018, zMid]),
      sp('wood', [-xi, xi], [0.04, 0.11], [zBack, zBack + 0.02]),
      sp('wood', [-xi, xi], [y1 - tr - 0.06, y1 - tr], [zFront - 0.02, zFront]),
      sp('wood', [-xi, xi], [h - tr - 0.07, h - tr], [zBack, zBack + 0.02]),
    );
    // Rubber grip strips.
    for (const [z0, z1, top] of [
      [zMid + 0.02, d / 2 - 0.02, y1],
      [hz1 + 0.012, uz1 - 0.012, h],
    ]) {
      for (const z of cells(3, z0, z1)) parts.push(sp('grip', [-xi + 0.03, xi - 0.03], [top, top + 0.0025], [z - 0.006, z + 0.006]));
    }
    return parts;
  },
});

// ── Child's high chair ───────────────────────────────────────────────────────

const highChair = defineItem({
  id: 'wooden-high-chair',
  name: "Child's wooden high chair",
  category: 'kids',
  type: 'seating',
  group: 'Dining chairs',
  tags: ['high chair', 'highchair', 'baby chair', 'toddler', 'feeding chair', 'tray', 'kids', 'beech', 'ghế ăn dặm', 'ghe an dam'],
  defaultSize: { w: 0.52, d: 0.56, h: 0.98 },
  minSize: { w: 0.46, d: 0.5, h: 0.9 },
  maxSize: { w: 0.6, d: 0.66, h: 1.05 },
  slots: [matSlot('frame', 'Frame & seat', 'beech-natural'), matSlot('tray', 'Tray', 'wood-painted-white'), matSlot('pad', 'Seat pad', 'fabric-sky')],
  build: ({ w, d, h }) => {
    const parts: Part[] = [];
    const seatY = clamp(h * 0.56, 0.5, 0.58);
    const zc = -0.03 * (d / 0.56);
    const sw = clamp(w * 0.29, 0.14, 0.17); // half seat width
    const sdh = clamp(d * 0.23, 0.11, 0.14); // half seat depth
    const lt = 0.032;
    const yLt = seatY - 0.024;
    const xt = sw - 0.02;
    const zt = sdh - 0.02;
    const xb = w / 2 - 0.026;
    const zb = d / 2 - 0.026;
    const xAt = (y: number) => lerp(xb, xt, y / yLt);
    const zAt = (sz: number, y: number) => lerp(sz * zb, zc + sz * zt, y / yLt);

    // Widely splayed legs, seat, aprons, stretchers and an adjustable footrest.
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) parts.push(stick('frame', [sx * xb, 0, sz * zb], [sx * xt, yLt, zc + sz * zt], lt, lt, { bevel: 0.003 }));
    }
    parts.push(span('frame', [-sw, sw], [seatY - 0.024, seatY], [zc - sdh, zc + sdh], { bevel: 0.006 }));
    const ya = yLt - 0.025;
    for (const s of [-1, 1]) {
      parts.push(sp('frame', [-xAt(ya), xAt(ya)], [yLt - 0.05, yLt], [zAt(s, ya) - 0.009, zAt(s, ya) + 0.009]));
      parts.push(sp('frame', [s * xAt(ya) - 0.009, s * xAt(ya) + 0.009], [yLt - 0.05, yLt], [zAt(-1, ya), zAt(1, ya)]));
    }
    for (const s of [-1, 1]) {
      const y = 0.14;
      parts.push(sp('frame', [-xAt(y), xAt(y)], [y - 0.011, y + 0.011], [zAt(s, y) - 0.011, zAt(s, y) + 0.011], 0.002));
      const y2 = 0.2;
      parts.push(sp('frame', [s * xAt(y2) - 0.011, s * xAt(y2) + 0.011], [y2 - 0.011, y2 + 0.011], [zAt(-1, y2), zAt(1, y2)], 0.002));
    }
    const yf = clamp(seatY - 0.26, 0.24, 0.32);
    parts.push(span('frame', [-xAt(yf) - 0.012, xAt(yf) + 0.012], [yf - 0.018, yf], [zAt(1, yf) - 0.05, zAt(1, yf) + 0.02], { bevel: 0.003, plan: false }));

    // Back: raked turned posts with ball finials, a low rail, the crest and three spindles.
    const zBp = zc - sdh + 0.016;
    const yTop = h - 0.02;
    const zBack = (y: number) => lerp(zBp, zBp - 0.04, (y - seatY + 0.01) / (yTop - seatY + 0.01));
    const px = sw - 0.016;
    for (const s of [-1, 1]) {
      parts.push(rod('frame', [s * px, seatY - 0.01, zBp], [s * px, yTop, zBp - 0.04], 0.016, { plan: false }));
      parts.push(sphere('frame', [s * px, yTop + 0.002, zBp - 0.04], 0.018, { plan: false }));
    }
    const bow = 0.015;
    const rails: V2[] = [
      [seatY + 0.13, 0.03],
      [h - 0.12, 0.07],
    ];
    for (const [y, hh] of rails) parts.push(prism('frame', bowBand(px, zBack(y + hh / 2) + 0.01, bow, 0.02), y, hh, { plan: false }));
    const sy0 = seatY + 0.16;
    const sy1 = h - 0.12;
    for (const x of [-0.06, 0, 0.06]) {
      const k = bow * (1 - (x / px) ** 2);
      parts.push(rod('frame', [x, sy0, zBack(sy0) - k], [x, sy1, zBack(sy1) - k], 0.008, { plan: false }));
    }
    // Arms on turned spindles, a tray with a rolled rim resting on them, and a crotch post.
    const yArm = seatY + 0.2;
    for (const s of [-1, 1]) {
      parts.push(span('frame', [s * sw - 0.018, s * sw + 0.018], [yArm, yArm + 0.02], [zBack(yArm), zc + sdh + 0.03], { bevel: 0.004 }));
      parts.push(vcyl('frame', s * px, zc + sdh - 0.018, seatY, yArm, 0.012, { plan: false }));
    }
    const tw = sw + 0.07;
    const tz0 = zc + sdh - 0.04;
    const tz1 = d / 2 - 0.004;
    const ty = yArm + 0.02;
    const tt = 0.016;
    parts.push(prism('tray', roundRectPoints(0, (tz0 + tz1) / 2, 2 * tw, tz1 - tz0, 0.04, 4), ty, tt));
    const rr = 0.007;
    const ry = ty + tt + rr * 0.6;
    const rc = 0.04;
    parts.push(rodX('tray', -tw + rc, tw - rc, ry, tz1 - rr, rr, { plan: false }));
    for (const s of [-1, 1]) parts.push(rodZ('tray', s * (tw - rr), ry, tz0 + 0.02, tz1 - rc, rr, { plan: false }));
    parts.push(torus('tray', [tw - rc, ry, tz1 - rc], rc - rr, rr, { arc: Math.PI / 2, rotation: [Math.PI / 2, 0, 0], plan: false }));
    parts.push(torus('tray', [-(tw - rc), ry, tz1 - rc], rc - rr, rr, { arc: Math.PI / 2, rotation: [Math.PI / 2, 0, Math.PI / 2], plan: false }));
    parts.push(vcyl('frame', 0, zc + sdh - 0.02, seatY, ty, 0.014, { plan: false }));
    parts.push(cushion('pad', [-sw + 0.03, sw - 0.03], [seatY, seatY + 0.025], [zc - sdh + 0.035, zc + sdh - 0.03], { softness: 0.45, plan: false }));
    return parts;
  },
});

// ── Saddle-seat bar stool ────────────────────────────────────────────────────

const saddleStool = defineItem({
  id: 'saddle-seat-bar-stool',
  name: 'Saddle-seat bar stool',
  category: 'kitchen',
  type: 'seating',
  group: 'Stools & benches',
  tags: ['bar stool', 'counter stool', 'saddle seat', 'carved seat', 'walnut', 'splayed legs', 'wedged tenon', 'kitchen island', 'ghế quầy bar'],
  defaultSize: { w: 0.42, d: 0.4, h: 0.76 },
  minSize: { w: 0.36, d: 0.34, h: 0.6 },
  maxSize: { w: 0.5, d: 0.48, h: 0.84 },
  slots: [
    matSlot('seat', 'Seat', 'walnut-oiled'),
    matSlot('legs', 'Legs & stretchers', 'walnut-oiled'),
    matSlot('wedges', 'Tenon wedges', 'wood-ash-white'),
    matSlot('metal', 'Ferrules & kick plate', 'metal-brass'),
  ],
  build: ({ w, d, h }) => {
    const parts: Part[] = [];
    const rx = (w / 2) * 0.86;
    const rz = (d / 2) * 0.9;
    // Saddle outline: pinched at the front sides, leaving a pommel at the front centre.
    const outline = (k: number): V2[] =>
      range(40).map((i) => {
        const a = (i / 40) * TAU;
        const c = Math.cos(a);
        const s = Math.sin(a);
        const pinch = 1 - 0.55 * Math.max(0, s) * c * c;
        return [k * rx * c * pinch, k * rz * s * pinch * (s < 0 ? 0.95 : 1)] as V2;
      });
    const sT = 0.042;
    parts.push(prism('seat', outline(1), h - sT, sT - 0.012));
    parts.push(prism('seat', outline(0.93), h - 0.012, 0.006, { plan: false }));
    parts.push(sphere('seat', [0, h - 0.012, rz * 0.62], 0.5, { scale: [0.07, 0.022, rz * 0.6], plan: false }));
    parts.push(sphere('seat', [0, h - 0.012, -rz * 0.6], 0.5, { scale: [rx, 0.02, rz * 0.45], plan: false }));

    // Round tapered legs splayed on both axes, wedged through the seat.
    const yU = h - sT;
    const tx = rx * 0.58;
    const tz = rz * 0.58;
    const fx = w / 2 - 0.024;
    const fz = d / 2 - 0.024;
    const legAt = (sx: number, sz: number, y: number): V3 => [sx * lerp(fx, tx, y / yU), y, sz * lerp(fz, tz, y / yU)];
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        parts.push(rod('legs', legAt(sx, sz, 0), legAt(sx, sz, yU + 0.02), 0.0135, { rTop: 0.019, plan: false }));
        parts.push(rod('metal', legAt(sx, sz, 0), legAt(sx, sz, 0.03), 0.0155, { plan: false }));
        const [x, , z] = legAt(sx, sz, h - 0.007);
        parts.push(vcyl('legs', x, z, h - 0.009, h - 0.0048, 0.012, { plan: false }));
        parts.push(sp('wedges', [x - 0.012, x + 0.012], [h - 0.009, h - 0.0045], [z - 0.0016, z + 0.0016]));
      }
    }
    // Stretchers: a stout front footrest with a brass kick plate, then back and (higher) sides.
    const yF = clamp(h * 0.3, 0.18, 0.26);
    const yS = yF + 0.08;
    for (const sz of [-1, 1]) parts.push(rod('legs', legAt(-1, sz, yF), legAt(1, sz, yF), sz > 0 ? 0.015 : 0.012, { plan: false }));
    const fa = legAt(1, 1, yF);
    parts.push(rodX('metal', -fa[0] * 0.55, fa[0] * 0.55, yF, fa[2], 0.0165, { plan: false }));
    for (const sx of [-1, 1]) parts.push(rod('legs', legAt(sx, -1, yS), legAt(sx, 1, yS), 0.012, { plan: false }));
    return parts;
  },
});

// ── Slatted folding chair ────────────────────────────────────────────────────

const foldingChair = defineItem({
  id: 'slatted-folding-chair',
  name: 'Slatted wooden folding chair',
  category: 'outdoor',
  type: 'seating',
  group: 'Outdoor seating',
  tags: ['folding chair', 'slatted chair', 'bistro', 'balcony', 'garden', 'teak', 'foldable', 'brass bolts', 'ghế xếp gỗ', 'ghe xep'],
  defaultSize: { w: 0.45, d: 0.52, h: 0.82 },
  minSize: { w: 0.4, d: 0.46, h: 0.76 },
  maxSize: { w: 0.52, d: 0.6, h: 0.9 },
  slots: [matSlot('wood', 'Frame', 'teak-oiled'), matSlot('slats', 'Slats', 'teak-oiled'), matSlot('metal', 'Pivot bolts', 'metal-brass')],
  build: ({ w, d, h }) => {
    const parts: Part[] = [];
    const seat = clamp(h * 0.55, 0.42, 0.48);
    // Outer frame: front legs running straight up into the back posts.
    const hA = h - 0.012;
    const zA0 = d / 2 - 0.045;
    const zA1 = -d / 2 + 0.05;
    const zA = (y: number) => lerp(zA0, zA1, y / hA);
    // Inner frame: rear legs running forward to under the seat front.
    const hB = seat - 0.04;
    const zB0 = -d / 2 + 0.03;
    const zB1 = d / 2 - 0.07;
    const zB = (y: number) => lerp(zB0, zB1, y / hB);
    const xA = w / 2 - 0.018;
    const xB = w / 2 - 0.05;
    const xR = w / 2 - 0.078;
    // Where the two frames cross (side view): the main pivot.
    const kA = (zA1 - zA0) / hA;
    const kB = (zB1 - zB0) / hB;
    const yX = (zB0 - zA0) / (kA - kB);
    const zX = zA(yX);
    const ySp = seat - 0.04;
    for (const s of [-1, 1]) {
      parts.push(stick('wood', [s * xA, 0, zA0], [s * xA, hA, zA1], 0.024, 0.04, { bevel: 0.004 }));
      parts.push(stick('wood', [s * xB, 0, zB0], [s * xB, hB, zB1], 0.024, 0.036, { bevel: 0.004 }));
      parts.push(sp('wood', [s * xR - 0.012, s * xR + 0.012], [seat - 0.06, seat - 0.018], [zA(ySp) - 0.02, d / 2 - 0.02], 0.003));
      // Brass bolts with washers: the cross pivot, the seat pivot on the outer frame, the pin on the rear legs.
      parts.push(rodX('metal', s * (xB - 0.012), s * (w / 2 - 0.003), yX, zX, 0.0055, { plan: false }));
      parts.push(rodX('metal', s * (w / 2 - 0.006), s * (w / 2 - 0.001), yX, zX, 0.011, { plan: false }));
      parts.push(rodX('metal', s * xR, s * (w / 2 - 0.003), ySp, zA(ySp), 0.0055, { plan: false }));
      parts.push(rodX('metal', s * (w / 2 - 0.006), s * (w / 2 - 0.001), ySp, zA(ySp), 0.011, { plan: false }));
      parts.push(rodX('metal', s * xR, s * xB, seat - 0.045, zB1 - 0.01, 0.005, { plan: false }));
    }
    // Seat: rails front and back, five slats.
    parts.push(sp('wood', [-xR, xR], [seat - 0.05, seat - 0.018], [zA(ySp) - 0.012, zA(ySp) + 0.012]));
    parts.push(sp('wood', [-xR, xR], [seat - 0.06, seat - 0.018], [d / 2 - 0.04, d / 2 - 0.02]));
    for (const [a, b] of cellSpans(5, zA(seat) - 0.03, d / 2 - 0.012)) {
      parts.push(span('slats', [-(w / 2 - 0.064), w / 2 - 0.064], [seat - 0.018, seat], [a + 0.004, b - 0.004], { bevel: 0.003 }));
    }
    // Back: three slats leaning with the posts, the top one deeper.
    const lean = Math.atan2(zA0 - zA1, hA);
    for (const [y, hh] of [
      [hA - 0.05, 0.085],
      [hA - 0.16, 0.06],
      [hA - 0.25, 0.06],
    ]) {
      parts.push(box('slats', [0, y, zA(y)], [2 * (w / 2 - 0.03), hh, 0.016], { rotation: [-lean, 0, 0], bevel: 0.003 }));
    }
    // Low stretchers tying each frame together.
    parts.push(rodX('wood', -xA + 0.012, xA - 0.012, 0.1, zA(0.1), 0.011, { plan: false }));
    parts.push(rodX('wood', -xB + 0.012, xB - 0.012, 0.09, zB(0.09), 0.011, { plan: false }));
    return parts;
  },
});

// ── Textures ─────────────────────────────────────────────────────────────────

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

/** Smooth value noise on an nx × ny lattice that wraps, so it tiles seamlessly. */
function wrapNoise(nx: number, ny: number, rand: () => number): (u: number, v: number) => number {
  const g = new Float32Array(nx * ny).map(() => rand());
  const at = (i: number, j: number) => g[(((j % ny) + ny) % ny) * nx + (((i % nx) + nx) % nx)];
  return (u, v) => {
    const x = u * nx;
    const y = v * ny;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const sx = (x - x0) * (x - x0) * (3 - 2 * (x - x0));
    const sy = (y - y0) * (y - y0) * (3 - 2 * (y - y0));
    const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
    const bot = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
    return top + (bot - top) * sy;
  };
}

/** Pore streaks: the average of a few neighbours along the grain (x), wrapping at the tile edge. */
function poreField(size: number, rand: () => number): (x: number, y: number) => number {
  const raw = new Float32Array(size * size).map(() => rand());
  return (x, y) => {
    const r = y * size;
    return (raw[r + x] + raw[r + ((x + 1) % size)] + raw[r + ((x + 2) % size)] + raw[r + ((x + 3) % size)]) / 4;
  };
}

export default definePack({
  name: 'Wooden seating',
  version: '1.0.0',
  author: 'Neest team',
  description:
    'Solid-wood seating with real joinery: Vietnamese café stools (ghế đẩu), a ladder-back rush chair, an Adirondack chair, a mid-century teak armchair, a porch swing on an A-frame, a piano bench, a step stool, a high chair, a saddle-seat bar stool and a folding chair.',
  license: 'CC0 (made for Neest)',
  items: [lowCafeStool, tallCafeStool, ladderBack, adirondack, teakArmchair, porchSwing, pianoBench, stepStool, highChair, saddleStool, foldingChair],
  patterns: [
    {
      id: 'straight-grain',
      name: 'Straight wood grain',
      normalStrength: 0.35,
      draw(ctx, size, rand) {
        // Growth rings seen edge-on: soft earlywood rising to a sharp latewood line, drifting gently.
        const ph = range(4).map(() => rand() * TAU);
        const wob = wrapNoise(4, 6, rand);
        const tone = wrapNoise(3, 5, rand);
        const pores = poreField(size, rand);
        paint(ctx, size, (u, v, x, y) => {
          const drift = Math.sin(u * TAU + ph[0]) * 0.18 + (wob(u, v) - 0.5) * 0.5;
          const ring = v * 13 + drift + Math.sin(v * TAU * 2 + ph[1]) * 0.35;
          const late = Math.pow(ring - Math.floor(ring), 5);
          const fine = Math.pow(Math.abs(Math.sin((v * 47 + drift * 2.5 + ph[2]) * Math.PI)), 18);
          return 0.86 - late * 0.2 - fine * 0.05 + (tone(u, v) - 0.5) * 0.08 + (pores(x, y) - 0.5) * 0.08;
        });
      },
    },
    {
      id: 'teak-figure',
      name: 'Oiled teak figure',
      normalStrength: 0.3,
      draw(ctx, size, rand) {
        // Wavy interlocked grain with ribbon stripes and dark, oily mineral streaks.
        const ph = range(4).map(() => rand() * TAU);
        const wob = wrapNoise(3, 5, rand);
        const streak = wrapNoise(2, 14, rand);
        const pores = poreField(size, rand);
        paint(ctx, size, (u, v, x, y) => {
          const drift = Math.sin(u * TAU * 2 + ph[0]) * 0.25 + (wob(u, v) - 0.5) * 0.8;
          const ring = v * 9 + drift * 1.6 + Math.sin(v * TAU * 3 + ph[1]) * 0.4;
          const lines = Math.pow(0.5 + 0.5 * Math.sin(ring * TAU), 8);
          const ribbon = Math.sin(v * TAU * 5 + Math.sin(u * TAU + ph[2]) * 0.6) * 0.035;
          const s = streak(u, v);
          const oil = Math.min(1, Math.max(0, (s - 0.55) / 0.25)) * 0.14;
          return 0.84 - lines * 0.14 + ribbon - oil + (pores(x, y) - 0.5) * 0.1;
        });
      },
    },
    {
      id: 'rush-weave',
      name: 'Twisted rush cord',
      normalStrength: 1.0,
      draw(ctx, size, rand) {
        // Rows of twisted rush cords with diagonal twist lines and a dark groove between cords.
        const n = 12;
        const tone = range(n).map(() => rand());
        const twistPh = range(n).map(() => rand());
        const pores = poreField(size, rand);
        paint(ctx, size, (u, v, x, y) => {
          const c = v * n;
          const k = Math.floor(c) % n;
          const f = c - Math.floor(c);
          const round = Math.sin(Math.PI * f);
          const twist = Math.pow(0.5 + 0.5 * Math.sin(TAU * (u * 30 + f * 0.9 + twistPh[k])), 3);
          let val = 0.5 + 0.38 * round - 0.1 * twist * round + (tone[k] - 0.5) * 0.08 + (pores(x, y) - 0.5) * 0.05;
          if (f < 0.06 || f > 0.94) val -= 0.12;
          return val;
        });
      },
    },
  ],
  materials: [
    { id: 'teak-oiled', name: 'Oiled teak', category: 'wood', color: '#a8713f', roughness: 0.42, pattern: { id: 'teak-figure', scale: 0.55, contrast: 0.9 } },
    { id: 'walnut-oiled', name: 'Oiled walnut', category: 'wood', color: '#6a4630', roughness: 0.45, pattern: { id: 'straight-grain', scale: 0.5 } },
    { id: 'honey-pine', name: 'Honey pine', category: 'wood', color: '#d9a865', roughness: 0.55, pattern: { id: 'straight-grain', scale: 0.7, contrast: 0.85 } },
    { id: 'rosewood-dark', name: 'Dark rosewood (gỗ cẩm)', category: 'wood', color: '#4b2417', roughness: 0.35, pattern: { id: 'straight-grain', scale: 0.4 } },
    { id: 'acacia-varnish', name: 'Varnished acacia (gỗ tràm)', category: 'wood', color: '#a0622f', roughness: 0.38, pattern: { id: 'straight-grain', scale: 0.45 } },
    { id: 'cedar-weathered', name: 'Weathered cedar', category: 'wood', color: '#b38a62', roughness: 0.75, pattern: { id: 'straight-grain', scale: 0.8, contrast: 0.9 } },
    { id: 'beech-natural', name: 'Natural beech', category: 'wood', color: '#e0bf92', roughness: 0.5, pattern: { id: 'straight-grain', scale: 0.5, contrast: 0.6 } },
    { id: 'piano-black', name: 'Piano black lacquer', category: 'wood', color: '#121010', roughness: 0.1 },
    { id: 'rush-natural', name: 'Natural rush', category: 'fabric', color: '#b39b5c', roughness: 0.85, pattern: { id: 'rush-weave', scale: 0.16 } },
    { id: 'cushion-oatmeal', name: 'Oatmeal cushion fabric', category: 'fabric', color: '#cdbd9f', roughness: 0.95, pattern: { id: 'weave', scale: 0.12, contrast: 0.6 } },
    { id: 'rubber-black', name: 'Black rubber', category: 'solid', color: '#242322', roughness: 0.9 },
  ],
});

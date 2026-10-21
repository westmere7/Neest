/**
 * Sofas — sixteen detailed sofas and couches, each with hand-picked finish variants.
 *
 * One parametric builder covers the classic silhouettes: track, rolled, flared, tuxedo, Bridgewater,
 * round and wooden-frame arms; loose, tight, button-tufted, channel-tufted, camel and pillow backs;
 * legs (tapered, turned, bun, block, hairpin, sled, cone), skirts and plinths; chaise sectionals.
 * A curved sofa has its own builder. Slots: upholstery (frame), cushions (seat and back cushions),
 * throw pillows, and legs/frame wood or metal.
 */
import {
  clamp,
  containParts,
  cushion,
  cyl,
  defineItem,
  definePack,
  matSlot,
  pillow,
  plantBox,
  range,
  rod,
  span,
  sphere,
  tufts,
  turnedLeg,
  type PackItem,
  type Part,
  type PlanStroke,
  type Size3,
} from '@/packs/kit';

type Arm = 'track' | 'rolled' | 'flared' | 'tuxedo' | 'bridgewater' | 'round' | 'wood' | 'none';
type Back = 'loose' | 'tight' | 'tufted' | 'channel' | 'camel' | 'pillow';
type Leg = 'taper' | 'turned' | 'bun' | 'block' | 'hairpin' | 'sled' | 'cone' | 'none';

interface SofaStyle {
  seats: number;
  arm: Arm;
  back: Back;
  base: 'legs' | 'skirt' | 'plinth';
  leg?: Leg;
  seatTop?: number;
  /** One long seat cushion instead of `seats` cushions. */
  bench?: boolean;
  /** Throw pillows (0–4). */
  pillows?: number;
  /** Buttons on the arms too (Chesterfield). */
  tuftArms?: boolean;
  /** Brass nailheads along the arm fronts. */
  nailheads?: boolean;
  /** Chaise extension on one end (sectional); the main seat depth is `mainD`. */
  chaise?: 'left' | 'right';
  mainD?: number;
  /** Low floor sofa: no legs, seat close to the floor. */
  floor?: boolean;
  /** Recliner seams and a raised headrest. */
  recliner?: boolean;
}

const o = { plan: false };

/** A square throw pillow, plump at the edges, leaning back by `lean` and turned by `turn`. */
const throwPillow = (c: [number, number, number], size: number, lean: number, turn: number): Part =>
  cushion('pillows', [c[0] - size / 2, c[0] + size / 2], [c[1] - size / 2, c[1] + size / 2], [c[2] - 0.065, c[2] + 0.065], { softness: 0.45, rotation: [-lean, turn, 0], plan: false });
const ARM_W: Record<Arm, number> = { track: 0.16, rolled: 0.2, flared: 0.16, tuxedo: 0.17, bridgewater: 0.15, round: 0.24, wood: 0.07, none: 0 };
const LEG_H: Record<Leg, number> = { taper: 0.15, turned: 0.12, bun: 0.06, block: 0.08, hairpin: 0.18, sled: 0.14, cone: 0.13, none: 0.02 };

function frameOf(size: Size3, s: SofaStyle) {
  const { w, d, h } = size;
  const legH = s.floor ? 0 : s.base === 'legs' ? LEG_H[s.leg ?? 'taper'] : s.base === 'plinth' ? 0.06 : 0.02;
  const armW = Math.min(ARM_W[s.arm], w * 0.12);
  const seatTop = s.floor ? clamp(h * 0.4, 0.22, 0.3) : clamp(s.seatTop ?? 0.44, legH + 0.2, h * 0.62);
  const cushT = s.floor ? 0.1 : 0.13;
  const deckTop = seatTop - cushT;
  const backT = s.arm === 'wood' ? 0.07 : 0.17;
  const armTop = s.arm === 'tuxedo' ? h - 0.015 : s.arm === 'bridgewater' ? Math.min(h - 0.1, seatTop + 0.15) : Math.min(h - 0.06, seatTop + (s.floor ? 0.15 : 0.21));
  const mainD = s.chaise ? Math.min(s.mainD ?? 0.95, d - 0.45) : d;
  return { w, d, h, legH, armW, seatTop, cushT, deckTop, backT, armTop, mainD, z0: -d / 2, zb: -d / 2 + backT };
}

function legs(f: ReturnType<typeof frameOf>, s: SofaStyle, zFrontAt: (x: number) => number): Part[] {
  const style = s.leg ?? 'taper';
  if (s.base !== 'legs' || style === 'none' || f.legH <= 0) return [];
  const parts: Part[] = [];
  const inX = f.w / 2 - 0.07;
  const xs = f.w > 2.3 ? [-inX, 0, inX] : [-inX, inX];
  const zBack = f.z0 + 0.07;
  for (const x of xs) {
    for (const z of [zBack, zFrontAt(x) - 0.07]) {
      if (x === 0 && z !== zBack) continue;
      if (style === 'taper') parts.push(cyl('legs', [x, f.legH / 2, z], 0.018, f.legH, { rTop: 0.026, segments: 12, ...o }));
      else if (style === 'turned' || style === 'bun') parts.push(turnedLeg('legs', x, z, 0, f.legH, style === 'bun' ? 0.045 : 0.028, { style: style === 'bun' ? 'bun' : 'spindle' }));
      else if (style === 'block') parts.push(span('legs', [x - 0.035, x + 0.035], [0, f.legH], [z - 0.035, z + 0.035], { bevel: 0.005, ...o }));
      else if (style === 'cone') parts.push(cyl('legs', [x, f.legH / 2, z], 0.015, f.legH, { rTop: 0.03, segments: 14, ...o }));
      else if (style === 'hairpin') {
        parts.push(rod('legs', [x - 0.02, f.legH, z - 0.03], [x, 0.004, z], 0.005, o), rod('legs', [x + 0.02, f.legH, z + 0.03], [x, 0.004, z], 0.005, o));
      }
    }
  }
  if (style === 'sled') {
    for (const x of [-inX, inX]) {
      const zf = zFrontAt(x) - 0.06;
      parts.push(rod('legs', [x, 0.008, zBack - 0.02], [x, 0.008, zf], 0.008, o), rod('legs', [x, 0.008, zBack - 0.02], [x, f.legH, zBack - 0.02], 0.008, o), rod('legs', [x, 0.008, zf], [x, f.legH, zf], 0.008, o));
    }
  }
  return parts;
}

function arm(f: ReturnType<typeof frameOf>, s: SofaStyle, side: 1 | -1, zFront: number): Part[] {
  if (s.arm === 'none') return [];
  const parts: Part[] = [];
  const xo = side * f.w / 2;
  const xi = side * (f.w / 2 - f.armW);
  const x: [number, number] = side === 1 ? [xi, xo] : [xo, xi];
  const y0 = s.base === 'legs' ? f.legH : s.floor ? 0 : 0.02;
  const zf = s.arm === 'bridgewater' ? zFront - 0.06 : zFront;
  switch (s.arm) {
    case 'track':
    case 'tuxedo':
      parts.push(span('upholstery', x, [y0, f.armTop], [f.z0, zf], { bevel: s.arm === 'tuxedo' ? 0.02 : 0.035 }));
      break;
    case 'flared': {
      parts.push(span('upholstery', x, [y0, f.armTop - 0.07], [f.z0, zf], { bevel: 0.02 }));
      // A flared top that rolls outward a little.
      parts.push(span('upholstery', [x[0] + side * 0.01, x[1] + side * 0.012].sort((a, b) => a - b) as [number, number], [f.armTop - 0.08, f.armTop], [f.z0, zf], { bevel: 0.03 }));
      break;
    }
    case 'rolled':
    case 'bridgewater': {
      const r = Math.min(f.armW * 0.5, 0.1);
      parts.push(span('upholstery', x, [y0, f.armTop - r], [f.z0, zf], { bevel: 0.015 }));
      const cx = xo - side * r;
      parts.push(cyl('upholstery', [cx, f.armTop - r, (f.z0 + zf) / 2], r, zf - f.z0 - 0.002, { rotation: [Math.PI / 2, 0, 0], segments: 20 }));
      // Front scroll panel.
      parts.push(cyl('upholstery', [cx, f.armTop - r, zf - 0.008], r * 0.82, 0.014, { rotation: [Math.PI / 2, 0, 0], segments: 20, ...o }));
      break;
    }
    case 'round': {
      // Pillowy oversized arm: a soft block with a rounded top.
      parts.push(cushion('upholstery', x, [y0, f.armTop], [f.z0, zf], { softness: 0.45 }));
      break;
    }
    case 'wood': {
      const t = f.armW;
      const xc = (x[0] + x[1]) / 2;
      for (const z of [f.z0 + t / 2, zf - t / 2]) parts.push(span('legs', [xc - t / 2, xc + t / 2], [0, f.armTop], [z - t / 2, z + t / 2], { bevel: 0.006 }));
      parts.push(span('legs', [xc - t / 2 - 0.01, xc + t / 2 + 0.01], [f.armTop - 0.025, f.armTop], [f.z0, zf], { bevel: 0.006 }));
      parts.push(span('legs', [xc - t / 2, xc + t / 2], [f.legH + 0.12, f.legH + 0.17], [f.z0 + t, zf - t], o));
      // Spindles between the posts.
      for (const i of range(4)) {
        const z = f.z0 + t + ((zf - f.z0 - 2 * t) * (i + 1)) / 5;
        parts.push(span('legs', [xc - 0.012, xc + 0.012], [f.legH + 0.17, f.armTop - 0.025], [z - 0.012, z + 0.012], o));
      }
      break;
    }
  }
  if (s.tuftArms && s.arm !== 'wood') {
    parts.push(...tufts('upholstery', [xi - side * 0.002 - 0.001, xi - side * 0.001].sort((a, b) => a - b) as [number, number], [y0 + 0.2, f.armTop - 0.08], (f.z0 + zf) / 2, 1, 2, { r: 0.009 }).map((p) => ({ ...p, position: [xi - side * 0.004, p.position[1], p.position[2]] as [number, number, number] })));
    for (const z of [f.z0 + (zf - f.z0) * 0.3, f.z0 + (zf - f.z0) * 0.65]) parts.push(sphere('upholstery', [xo + (side === 1 ? -0.006 : 0.006), (y0 + f.armTop) / 2, z], 0.009, o));
  }
  if (s.nailheads && s.arm !== 'wood') {
    for (const i of range(7)) parts.push(sphere('legs', [xo - side * (f.armW * (0.12 + (0.76 * i) / 6)), y0 + 0.05, zf - 0.004], 0.006, o));
  }
  return parts;
}

function sofaParts(size: Size3, s: SofaStyle): Part[] {
  const f = frameOf(size, s);
  const parts: Part[] = [];
  const chaiseW = s.chaise ? clamp(f.w * 0.36, 0.75, 1.0) : 0;
  const zFrontMain = f.z0 + f.mainD - 0.01;
  const zFrontAll = f.d / 2 - 0.01;
  const inChaise = (x: number) => (s.chaise === 'left' ? x < -f.w / 2 + chaiseW : s.chaise === 'right' ? x > f.w / 2 - chaiseW : false);
  const zFrontAt = (x: number) => (inChaise(x) ? zFrontAll : zFrontMain);
  const armL = s.chaise === 'left' ? 0 : f.armW;
  const armR = s.chaise === 'right' ? 0 : f.armW;
  const xs0 = -f.w / 2 + armL;
  const xs1 = f.w / 2 - armR;
  const yBase = s.base === 'legs' ? f.legH : s.floor ? 0 : 0.02;

  // Deck (frame under the seat), skirt or plinth.
  parts.push(span('upholstery', [xs0, xs1], [yBase, f.deckTop], [f.z0, zFrontMain], { bevel: 0.015 }));
  if (s.chaise) {
    const cx: [number, number] = s.chaise === 'left' ? [-f.w / 2, -f.w / 2 + chaiseW] : [f.w / 2 - chaiseW, f.w / 2];
    parts.push(span('upholstery', cx, [yBase, f.deckTop], [zFrontMain - 0.05, zFrontAll], { bevel: 0.015 }));
  }
  if (s.base === 'skirt') parts.push(span('upholstery', [-f.w / 2 + 0.004, f.w / 2 - 0.004], [0.015, yBase + 0.17], [f.z0 + 0.004, zFrontMain + 0.006], { bevel: 0.004, ...o }));
  if (s.base === 'plinth' && !s.floor) parts.push(span('legs', [-f.w / 2 + 0.05, f.w / 2 - 0.05], [0, 0.065], [f.z0 + 0.05, zFrontMain - 0.05], o));

  // Back frame.
  const backTop = s.back === 'loose' || s.back === 'pillow' ? f.h - 0.16 : s.back === 'camel' ? f.h - 0.1 : f.h - 0.02;
  const bx: [number, number] = [-f.w / 2 + (s.arm === 'tuxedo' ? 0 : f.armW * 0.4), f.w / 2 - (s.arm === 'tuxedo' ? 0 : f.armW * 0.4)];
  if (s.arm === 'wood') {
    // Wooden back: top rail, bottom rail and slats.
    parts.push(span('legs', [-f.w / 2 + f.armW, f.w / 2 - f.armW], [f.h - 0.06, f.h - 0.01], [f.z0, f.z0 + f.backT], { bevel: 0.006 }));
    parts.push(span('legs', [-f.w / 2 + f.armW, f.w / 2 - f.armW], [f.deckTop - 0.02, f.deckTop + 0.04], [f.z0, f.z0 + f.backT], o));
    for (const i of range(9)) {
      const x = -f.w / 2 + f.armW + ((f.w - 2 * f.armW) * (i + 1)) / 10;
      parts.push(span('legs', [x - 0.018, x + 0.018], [f.deckTop + 0.04, f.h - 0.06], [f.z0 + 0.015, f.z0 + f.backT - 0.015], o));
    }
  } else parts.push(span('upholstery', bx, [f.deckTop, backTop], [f.z0, f.zb], { bevel: s.back === 'tight' || s.back === 'tufted' ? 0.03 : 0.02 }));
  if (s.back === 'camel') {
    const hump = Math.min(0.12, f.h - backTop - 0.005);
    parts.push(sphere('upholstery', [0, backTop - 0.02, (f.z0 + f.zb) / 2], 0.5, { scale: [f.w * 0.42, (hump + 0.02) * 2, f.backT * 0.98] }));
  }

  // Seat cushions.
  const backCush = s.back === 'loose' || s.back === 'pillow' || s.arm === 'wood' ? (s.back === 'pillow' ? 0.24 : 0.18) : s.back === 'channel' ? 0.09 : 0.06;
  const zs = f.zb + backCush * 0.75;
  const n = s.bench ? 1 : Math.max(1, s.seats);
  const gap = 0.006;
  const cw = (xs1 - xs0) / n;
  for (const i of range(n)) {
    const xa = xs0 + i * cw + (i ? gap / 2 : 0);
    const xb = xs0 + (i + 1) * cw - (i < n - 1 ? gap / 2 : 0);
    const zf = s.chaise && inChaise((xa + xb) / 2) ? zFrontAll : zFrontMain;
    parts.push(cushion('cushions', [xa, xb], [f.deckTop, f.seatTop], [zs, zf], { softness: 0.32 }));
    if (s.recliner) parts.push(span('cushions', [xa + 0.03, xb - 0.03], [f.deckTop - 0.04, f.deckTop + 0.01], [zf - 0.02, zf + 0.004], o));
  }
  if (s.chaise) {
    // The chaise cushion runs forward from the main seat.
    const cx: [number, number] = s.chaise === 'left' ? [-f.w / 2 + 0.01, -f.w / 2 + chaiseW - 0.004] : [f.w / 2 - chaiseW + 0.004, f.w / 2 - 0.01];
    parts.push(cushion('cushions', cx, [f.deckTop, f.seatTop], [zFrontMain + 0.004, zFrontAll], { softness: 0.32 }));
  }

  // Back cushions.
  const bTop = f.h - 0.02;
  const nb = s.bench && s.back === 'loose' ? 2 : n;
  const bw = (xs1 - xs0) / nb;
  if (s.back === 'loose' || s.arm === 'wood') {
    for (const i of range(nb)) {
      const xa = xs0 + i * bw + 0.004;
      const xb = xs0 + (i + 1) * bw - 0.004;
      parts.push(cushion('cushions', [xa, xb], [f.seatTop - 0.01, s.arm === 'wood' ? f.h - 0.08 : bTop], [f.zb - 0.01, f.zb + backCush], { softness: 0.42, rotation: [-0.1, 0, 0] }));
      if (s.recliner) parts.push(cushion('cushions', [xa + 0.04, xb - 0.04], [bTop - 0.16, bTop - 0.005], [f.zb + backCush - 0.02, f.zb + backCush + 0.04], { softness: 0.45 }));
    }
  } else if (s.back === 'pillow') {
    for (const i of range(nb)) {
      const cx = xs0 + (i + 0.5) * bw;
      parts.push(pillow('cushions', [cx, (f.seatTop + bTop) / 2 + 0.02, f.zb + backCush / 2], bw * 0.98, bTop - f.seatTop - 0.02, backCush, { lean: 0.15 }));
    }
  } else if (s.back === 'channel') {
    const k = Math.max(5, Math.round((bx[1] - bx[0]) / 0.2));
    const cwc = (bx[1] - bx[0]) / k;
    for (const i of range(k)) parts.push(cyl('cushions', [bx[0] + (i + 0.5) * cwc, (f.seatTop + bTop) / 2, f.zb + 0.035], cwc * 0.5, bTop - f.seatTop - 0.02, { scale: [1, 1, 0.07 / cwc], segments: 12 }));
  } else if (s.back === 'tufted' || s.back === 'tight' || s.back === 'camel') {
    parts.push(cushion('cushions', [bx[0] + (s.arm === 'tuxedo' ? f.armW : 0.02), bx[1] - (s.arm === 'tuxedo' ? f.armW : 0.02)], [f.seatTop - 0.02, backTop - 0.03], [f.zb - 0.01, f.zb + 0.06], { softness: 0.4 }));
    if (s.back === 'tufted') {
      const x: [number, number] = [bx[0] + (s.arm === 'tuxedo' ? f.armW : 0.02) + 0.06, bx[1] - (s.arm === 'tuxedo' ? f.armW : 0.02) - 0.06];
      parts.push(...tufts('cushions', x, [f.seatTop + 0.08, backTop - 0.08], f.zb + 0.062, Math.max(4, Math.round((x[1] - x[0]) / 0.2)), 2, { diamond: true, r: 0.01 }));
    }
  }

  // Arms.
  if (armL) parts.push(...arm(f, s, -1, zFrontAt(-f.w / 2 + 0.01)));
  if (armR) parts.push(...arm(f, s, 1, zFrontAt(f.w / 2 - 0.01)));
  if (s.chaise) {
    // The open chaise end still has a low back corner piece.
    const cx: [number, number] = s.chaise === 'left' ? [-f.w / 2, -f.w / 2 + 0.06] : [f.w / 2 - 0.06, f.w / 2];
    parts.push(span('upholstery', cx, [yBase, f.deckTop + 0.04], [f.z0, zFrontAll], { bevel: 0.01, ...o }));
  }

  // Throw pillows by the arms.
  const np = clamp(s.pillows ?? 0, 0, 4);
  for (const i of range(np)) {
    const side = i % 2 === 0 ? -1 : 1;
    const inner = i >= 2;
    const x = side * (f.w / 2 - Math.max(armL, armR, 0.05) - (inner ? 0.42 : 0.22));
    parts.push(throwPillow([x, f.seatTop + 0.21, f.zb + backCush + 0.08], 0.42, 0.28, side * (inner ? 0.12 : 0.3)));
  }
  parts.push(...legs(f, s, zFrontAt));
  return containParts(parts, plantBox(size));
}

function sofaPlan(size: Size3, s: SofaStyle): PlanStroke[] {
  const f = frameOf(size, s);
  const n = s.bench ? 1 : Math.max(1, s.seats);
  const armL = s.chaise === 'left' ? 0 : f.armW;
  const armR = s.chaise === 'right' ? 0 : f.armW;
  const xs0 = -f.w / 2 + armL;
  const cw = (f.w / 2 - armR - xs0) / n;
  const zf = f.z0 + f.mainD - 0.01;
  return [
    { kind: 'line', a: [xs0, f.zb], b: [f.w / 2 - armR, f.zb] },
    ...range(n - 1).map((i): PlanStroke => ({ kind: 'line', a: [xs0 + (i + 1) * cw, f.zb + 0.05], b: [xs0 + (i + 1) * cw, zf] })),
  ];
}

// ───────────── Curved sofa ─────────────

function curvedParts(size: Size3): Part[] {
  const { w, d, h } = size;
  const half = 1.0; // half the arc angle (rad)
  const R = w / 2 / Math.sin(half) - 0.02;
  const zc = -d / 2 + R;
  const seatTop = clamp(h * 0.55, 0.38, 0.44);
  const deck = seatTop - 0.13;
  const depth = Math.min(0.85, d * 0.8);
  const k = 7;
  const parts: Part[] = [];
  const at = (r: number, a: number, y: number): [number, number, number] => [r * Math.sin(a), y, zc - r * Math.cos(a)];
  for (const i of range(k)) {
    const a = -half + ((i + 0.5) * 2 * half) / k;
    const seg = 2 * half / k;
    const rBack = R - 0.09;
    const rSeat = R - 0.18 - (depth - 0.18) / 2;
    const tw = (r: number) => 2 * r * Math.sin(seg / 2) + 0.012;
    parts.push(span('upholstery', [-tw(rBack) / 2, tw(rBack) / 2], [0.05, h - 0.02], [-0.09, 0.09], { bevel: 0.03, rotation: [0, -a, 0] }));
    parts[parts.length - 1].position = at(rBack, a, (0.05 + h - 0.02) / 2);
    parts.push(span('upholstery', [-tw(rSeat) / 2, tw(rSeat) / 2], [0.05, deck], [-(depth - 0.18) / 2, (depth - 0.18) / 2], { bevel: 0.01, rotation: [0, -a, 0], plan: false }));
    parts[parts.length - 1].position = at(rSeat, a, (0.05 + deck) / 2);
    parts.push(cushion('cushions', [-tw(rSeat) / 2 + 0.004, tw(rSeat) / 2 - 0.004], [deck, seatTop], [-(depth - 0.18) / 2, (depth - 0.18) / 2], { softness: 0.4, rotation: [0, -a, 0], plan: false }));
    parts[parts.length - 1].position = at(rSeat, a, (deck + seatTop) / 2);
  }
  // Recessed plinth along the arc.
  for (const i of range(k)) {
    const a = -half + ((i + 0.5) * 2 * half) / k;
    const r = R - depth / 2;
    const tw = 2 * r * Math.sin(half / k) + 0.01;
    parts.push(span('legs', [-tw / 2, tw / 2], [0, 0.05], [-(depth - 0.1) / 2, (depth - 0.1) / 2], { rotation: [0, -a, 0], plan: false }));
    parts[parts.length - 1].position = at(r, a, 0.025);
  }
  for (const side of [-1, 1]) parts.push(throwPillow(at(R - 0.3, side * half * 0.62, seatTop + 0.21), 0.42, 0.25, -side * half * 0.62));
  return containParts(parts, plantBox(size));
}

// ───────────── Items ─────────────

type V = [name: string, upholstery: string, cushions: string, pillows: string, legs: string];
interface SofaSpec {
  id: string;
  name: string;
  style?: SofaStyle;
  size: Size3;
  min: Size3;
  max: Size3;
  tags: string[];
  description: string;
  legsLabel?: string;
  /** First entry is the default finish. */
  finishes: V[];
  build?: (s: Size3) => Part[];
}

const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function sofa(p: SofaSpec): PackItem {
  const [first, ...rest] = p.finishes;
  const style = p.style;
  return defineItem({
    id: p.id,
    name: p.name,
    category: 'living',
    type: 'seating',
    group: 'Sofas & loveseats',
    tags: ['sofa', 'couch', 'seating', 'living room', 'ghế sofa', ...p.tags],
    description: p.description,
    defaultSize: p.size,
    minSize: p.min,
    maxSize: p.max,
    wallSnap: true,
    slots: [matSlot('upholstery', 'Upholstery', first[1]), matSlot('cushions', 'Cushions', first[2]), matSlot('pillows', 'Throw pillows', first[3]), matSlot('legs', p.legsLabel ?? 'Legs', first[4])],
    variants: rest.map(([name, u, c, pl, l]) => ({ id: slug(name), name, materials: { upholstery: u, cushions: c, pillows: pl, legs: l } })),
    build: p.build ?? ((size) => sofaParts(size, style!)),
    planDetail: style ? (size) => sofaPlan(size, style) : undefined,
  });
}

const S = (w: number, d: number, h: number): Size3 => ({ w, d, h });

const items: PackItem[] = [
  sofa({
    id: 'english-roll-arm',
    name: 'English roll-arm sofa',
    style: { seats: 3, arm: 'rolled', back: 'tight', base: 'legs', leg: 'turned', pillows: 2, seatTop: 0.45 },
    size: S(2.1, 0.92, 0.84),
    min: S(1.6, 0.85, 0.78),
    max: S(2.6, 1.0, 0.92),
    tags: ['english', 'roll arm', 'rolled arm', 'traditional', 'turned legs', 'tight back'],
    description: 'A traditional English sofa: low rolled arms, a tight upholstered back, three loose seat cushions and turned walnut front legs.',
    finishes: [
      ['Linen & walnut', 'fabric-linen', 'fabric-linen', 'fabric-linen-rust', 'wood-walnut'],
      ['Sage linen & oak', 'fabric-linen-sage', 'fabric-linen-sage', 'fabric-cream', 'wood-oak-light'],
      ['Navy & mahogany', 'fabric-navy', 'fabric-navy', 'fabric-mustard', 'wood-mahogany'],
      ['Floral & cream', 'fabric-floral-print', 'fabric-floral-print', 'fabric-cream', 'wood-painted-white'],
      ['Charcoal wool & ebony', 'fabric-charcoal', 'fabric-charcoal', 'fabric-blush', 'wood-ebony'],
    ],
  }),
  sofa({
    id: 'lawson',
    name: 'Lawson sofa with loose back cushions',
    style: { seats: 3, arm: 'track', back: 'loose', base: 'legs', leg: 'block', pillows: 2 },
    size: S(2.2, 0.95, 0.86),
    min: S(1.6, 0.85, 0.78),
    max: S(2.8, 1.05, 0.95),
    tags: ['lawson', 'loose back', 'track arm', 'family sofa', 'block legs'],
    description: 'A deep family sofa with arms lower than the back, three plump loose back cushions and three seat cushions on block feet.',
    finishes: [
      ['Grey wool & oak', 'fabric-wool-grey', 'fabric-wool-grey', 'fabric-mustard', 'wood-oak-light'],
      ['Oat bouclé & walnut', 'fabric-boucle-oat', 'fabric-boucle-oat', 'fabric-linen-rust', 'wood-walnut'],
      ['Navy & black', 'fabric-navy', 'fabric-navy', 'fabric-cream', 'metal-black-matte'],
      ['Olive corduroy & teak', 'fabric-corduroy-olive', 'fabric-corduroy-olive', 'fabric-cream', 'wood-teak'],
      ['Cream & ash', 'fabric-cream', 'fabric-cream', 'fabric-linen-sage', 'wood-ash-white'],
    ],
  }),
  sofa({
    id: 'bridgewater-skirted',
    name: 'Bridgewater sofa with skirt',
    style: { seats: 3, arm: 'bridgewater', back: 'loose', base: 'skirt', pillows: 4 },
    size: S(2.15, 0.94, 0.86),
    min: S(1.6, 0.85, 0.8),
    max: S(2.6, 1.05, 0.94),
    tags: ['bridgewater', 'skirted', 'cottage', 'country', 'slipcover', 'low arms'],
    description: 'A relaxed Bridgewater sofa: low rolled arms set back from the front, loose back cushions, a dressmaker skirt and four throw pillows.',
    finishes: [
      ['White cotton & blue pillows', 'fabric-white-cotton', 'fabric-white-cotton', 'fabric-sky', 'fabric-white-cotton'],
      ['Linen & rust pillows', 'fabric-linen', 'fabric-linen', 'fabric-linen-rust', 'fabric-linen'],
      ['Sage & cream', 'fabric-linen-sage', 'fabric-linen-sage', 'fabric-cream', 'fabric-linen-sage'],
      ['Floral print', 'fabric-floral-print', 'fabric-cream', 'fabric-blush', 'fabric-floral-print'],
    ],
    legsLabel: 'Skirt trim',
  }),
  sofa({
    id: 'cloud-deep',
    name: 'Cloud sofa, extra deep',
    style: { seats: 3, arm: 'round', back: 'pillow', base: 'plinth', pillows: 2, seatTop: 0.42 },
    size: S(2.6, 1.12, 0.76),
    min: S(2.0, 1.0, 0.7),
    max: S(3.4, 1.25, 0.84),
    tags: ['cloud', 'deep seat', 'oversized', 'modern', 'boucle', 'plinth', 'lounge'],
    description: 'An oversized deep-seat sofa with pillowy round arms, huge feather back pillows and a hidden plinth base, in bouclé.',
    finishes: [
      ['Cream bouclé', 'fabric-boucle', 'fabric-boucle', 'fabric-boucle-oat', 'wood-dark-stain'],
      ['Oat bouclé', 'fabric-boucle-oat', 'fabric-boucle-oat', 'fabric-linen-rust', 'wood-dark-stain'],
      ['White cotton', 'fabric-white-cotton', 'fabric-white-cotton', 'fabric-linen-sage', 'wood-dark-stain'],
      ['Grey wool', 'fabric-wool-grey', 'fabric-wool-grey', 'fabric-cream', 'metal-black-matte'],
    ],
    legsLabel: 'Plinth',
  }),
  sofa({
    id: 'curved-boucle',
    name: 'Curved bouclé sofa',
    size: S(2.6, 1.25, 0.78),
    min: S(2.0, 1.05, 0.72),
    max: S(3.2, 1.45, 0.86),
    tags: ['curved', 'crescent', 'round', 'boucle', 'modern', 'statement', 'plinth'],
    description: 'A sculptural crescent-shaped sofa in seven upholstered sections with a continuous curved back and a recessed plinth.',
    build: curvedParts,
    finishes: [
      ['Cream bouclé', 'fabric-boucle', 'fabric-boucle', 'fabric-boucle-oat', 'wood-dark-stain'],
      ['Oat bouclé', 'fabric-boucle-oat', 'fabric-boucle-oat', 'fabric-velvet-rust', 'wood-dark-stain'],
      ['Green velvet', 'fabric-velvet-green', 'fabric-velvet-green', 'fabric-velvet-blush', 'metal-brass'],
      ['Blush velvet', 'fabric-velvet-blush', 'fabric-velvet-blush', 'fabric-cream', 'metal-brass'],
    ],
    legsLabel: 'Plinth',
  }),
  sofa({
    id: 'floor-sofa',
    name: 'Low floor sofa (sofa bệt)',
    style: { seats: 3, arm: 'track', back: 'loose', base: 'plinth', floor: true, pillows: 2 },
    size: S(2.0, 0.9, 0.62),
    min: S(1.4, 0.8, 0.55),
    max: S(2.6, 1.0, 0.7),
    tags: ['floor sofa', 'sofa bệt', 'low sofa', 'japanese', 'korean', 'apartment', 'small space'],
    description: 'A low floor sofa that sits right on the floor, popular in Vietnamese, Korean and Japanese apartments: a seat about 26 cm high and loose back cushions.',
    finishes: [
      ['Grey linen', 'fabric-wool-grey', 'fabric-wool-grey', 'fabric-mustard', 'fabric-wool-grey'],
      ['Cream & sage', 'fabric-cream', 'fabric-cream', 'fabric-linen-sage', 'fabric-cream'],
      ['Navy & cream', 'fabric-navy', 'fabric-navy', 'fabric-cream', 'fabric-navy'],
      ['Terracotta', 'fabric-terracotta', 'fabric-terracotta', 'fabric-cream', 'fabric-terracotta'],
    ],
    legsLabel: 'Base',
  }),
  sofa({
    id: 'wooden-frame-sofa',
    name: 'Wooden frame sofa (sofa gỗ)',
    style: { seats: 3, arm: 'wood', back: 'loose', base: 'legs', leg: 'none', pillows: 2, seatTop: 0.44 },
    size: S(1.95, 0.8, 0.86),
    min: S(1.5, 0.72, 0.8),
    max: S(2.4, 0.9, 0.95),
    tags: ['wooden sofa', 'sofa gỗ', 'indochine', 'solid wood', 'slatted', 'vietnamese', 'cushions'],
    description: 'A solid wood sofa with slatted arms and back, common in Vietnamese homes, softened by loose seat and back cushions.',
    finishes: [
      ['Teak & cream cushions', 'fabric-cream', 'fabric-cream', 'fabric-linen-rust', 'wood-teak'],
      ['Ironwood & sage', 'fabric-linen-sage', 'fabric-linen-sage', 'fabric-cream', 'wood-ironwood'],
      ['Rosewood & red', 'fabric-terracotta', 'fabric-terracotta', 'fabric-mustard', 'wood-rosewood'],
      ['Acacia & grey', 'fabric-wool-grey', 'fabric-wool-grey', 'fabric-mustard', 'wood-acacia'],
      ['Oak & white', 'fabric-white-cotton', 'fabric-white-cotton', 'fabric-sky', 'wood-oak-light'],
    ],
    legsLabel: 'Wood frame',
  }),
  sofa({
    id: 'leather-recliner-sofa',
    name: 'Leather recliner sofa, 3-seat',
    style: { seats: 3, arm: 'track', back: 'loose', base: 'plinth', recliner: true, pillows: 0, seatTop: 0.47 },
    size: S(2.15, 1.0, 1.02),
    min: S(1.9, 0.95, 0.96),
    max: S(2.4, 1.1, 1.08),
    tags: ['recliner', 'reclining sofa', 'leather', 'home theatre', 'power recliner', 'headrest'],
    description: 'A plush three-seat recliner in leather with padded headrests, thick track arms and footrest seams on each seat.',
    finishes: [
      ['Black leather', 'leather-smooth-black', 'leather-smooth-black', 'leather-smooth-black', 'metal-black-matte'],
      ['Brown leather', 'leather-cognac', 'leather-cognac', 'leather-cognac', 'metal-black-matte'],
      ['Grey fabric', 'fabric-wool-grey', 'fabric-wool-grey', 'fabric-wool-grey', 'metal-black-matte'],
      ['Cream leather', 'leather-white', 'leather-white', 'leather-white', 'metal-black-matte'],
    ],
    legsLabel: 'Base',
  }),
  sofa({
    id: 'channel-velvet',
    name: 'Channel-tufted velvet sofa',
    style: { seats: 2, arm: 'round', back: 'channel', base: 'plinth', bench: true, pillows: 2, seatTop: 0.43 },
    size: S(2.1, 0.9, 0.78),
    min: S(1.6, 0.82, 0.72),
    max: S(2.6, 1.0, 0.86),
    tags: ['channel tufted', 'velvet', '70s', 'retro', 'glam', 'plinth', 'bench seat'],
    description: 'A 70s-style sofa with vertical channel tufting on the back, rounded arms, a bench seat and a recessed plinth.',
    finishes: [
      ['Rust velvet', 'fabric-velvet-rust', 'fabric-velvet-rust', 'fabric-velvet-mustard', 'wood-dark-stain'],
      ['Mustard velvet', 'fabric-velvet-mustard', 'fabric-velvet-mustard', 'fabric-velvet-teal', 'wood-dark-stain'],
      ['Teal velvet', 'fabric-velvet-teal', 'fabric-velvet-teal', 'fabric-velvet-blush', 'metal-brass'],
      ['Navy velvet', 'fabric-velvet-navy', 'fabric-velvet-navy', 'fabric-velvet-rust', 'metal-brass'],
    ],
    legsLabel: 'Plinth',
  }),
  sofa({
    id: 'modular-four-seat',
    name: 'Modular 4-seat sofa on sled legs',
    style: { seats: 4, arm: 'track', back: 'loose', base: 'legs', leg: 'sled', pillows: 2 },
    size: S(2.9, 0.98, 0.82),
    min: S(2.4, 0.9, 0.76),
    max: S(3.6, 1.1, 0.9),
    tags: ['modular', '4-seat', 'large sofa', 'sled legs', 'metal frame', 'modern'],
    description: 'A long four-seat modular sofa with slim track arms, loose cushions and a steel sled base at each end.',
    finishes: [
      ['Grey & chrome', 'fabric-wool-grey', 'fabric-wool-grey', 'fabric-mustard', 'metal-chrome'],
      ['Cream & black', 'fabric-cream', 'fabric-cream', 'fabric-linen-rust', 'metal-black-matte'],
      ['Olive & steel', 'fabric-olive', 'fabric-olive', 'fabric-cream', 'metal-brushed-steel'],
      ['Navy & brass', 'fabric-navy', 'fabric-navy', 'fabric-mustard', 'metal-brass'],
    ],
  }),
];

export default definePack({
  name: 'Sofas',
  version: '1.0.0',
  author: 'Neest',
  description: 'Detailed sofas and couches in classic and modern silhouettes, each with finish variants.',
  license: 'CC0-1.0',
  items,
});

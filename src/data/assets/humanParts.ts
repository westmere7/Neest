/**
 * People: posable, correctly proportioned human figures built from plain parts.
 *
 * `humanFigure(body, pose)` builds a figure at its real stature from anthropometric proportions
 * (segment lengths as fractions of stature, after Drillis & Contini; children get a larger head and
 * shorter legs), poses it with joint angles and returns parts standing on the floor, centred on the
 * footprint, plus its exact size. Four material slots: `skin`, `hair` (also eyes and shoes), `top`
 * and `bottoms` (under a dress, `bottoms` is the shoes). `HUMAN_POSES` holds ready poses (standing, walking, sitting on a chair,
 * a sofa or the floor, squatting, kneeling, lying on the back, side or front, cooking, washing up,
 * at the mirror, on the phone, reaching…). Re-exported by `@/packs/kit`.
 *
 * Body axes: +x = the person's left, +y = up, +z = the way they face. Angles are radians.
 */
import { rod, sphere, type V2, type V3 } from './parts';
import { euler, fromCols, groupBounds, scaleAbout, vadd, vcross, vdot, vlen, vmul, vnorm, vsub } from './plantParts';
import type { Part, Size3 } from './types';

export type HumanSex = 'female' | 'male';
export type HumanAge = 'adult' | 'senior' | 'teen' | 'child' | 'toddler';
export type HairStyle = 'crop' | 'short' | 'curly' | 'bob' | 'long' | 'ponytail' | 'bun' | 'bald';
export type TopStyle = 'tee' | 'long-sleeve' | 'tank' | 'jacket' | 'dress' | 'ao-dai';
export type BottomStyle = 'trousers' | 'shorts' | 'skirt' | 'none';
export type FootStyle = 'shoes' | 'slippers' | 'barefoot';

export interface HumanBody {
  /** Standing height in metres (barefoot). */
  stature: number;
  sex: HumanSex;
  age?: HumanAge;
  /** Girth: 1 = average, 0.9 slim, 1.15 heavy. */
  build?: number;
  hair?: HairStyle;
  /** `dress` is knee length; `ao-dai` is the long Vietnamese tunic, worn over trousers. */
  top?: TopStyle;
  bottoms?: BottomStyle;
  feet?: FootStyle;
}

/**
 * One limb. Legs: `flex` raises the thigh forward (π/2 = level), `abd` swings it out sideways,
 * `turn` rotates the leg about the vertical (knee outward), `bend` bends the knee and `ankle`
 * points the toes down. Arms: `flex` raises the arm forward, `abd` sideways, `bend` bends the elbow
 * (the forearm swings forward and up) and `turn` swings the forearm in towards the body.
 * `shin` / `foot` override the shin and foot directions (given for the left leg in pelvis axes;
 * mirrored for the right) for folded poses such as sitting cross-legged.
 */
export interface LimbPose {
  flex?: number;
  abd?: number;
  turn?: number;
  bend?: number;
  ankle?: number;
  shin?: V3;
  foot?: V3;
}

export interface HumanPose {
  /** Whole body: `pitch` tips it forward (+) or back (−π/2 = lying on the back, head to −z). */
  pitch?: number;
  /** Whole body roll about the spine before pitching (π/2 with pitch −π/2 = lying on the side). */
  roll?: number;
  yaw?: number;
  /** Torso relative to the pelvis: forward bend, side bend, turn. */
  lean?: number;
  tilt?: number;
  twist?: number;
  /** Head: `pitch` + looks down. */
  head?: { pitch?: number; yaw?: number; roll?: number };
  legL?: LimbPose;
  legR?: LimbPose;
  armL?: LimbPose;
  armR?: LimbPose;
}

export interface HumanFigure {
  parts: Part[];
  /** Exact size of the posed figure (its item box at scale 1). */
  size: Size3;
  /** Height of the underside of the pelvis above the floor: the seat height a sitting pose needs. */
  seatHeight: number;
}

type Frame = [V3, V3, V3];
const DOWN: V3 = [0, -1, 0];
const rotX = (v: V3, a: number): V3 => [v[0], v[1] * Math.cos(a) - v[2] * Math.sin(a), v[1] * Math.sin(a) + v[2] * Math.cos(a)];
const rotY = (v: V3, a: number): V3 => [v[0] * Math.cos(a) + v[2] * Math.sin(a), v[1], -v[0] * Math.sin(a) + v[2] * Math.cos(a)];
const rotZ = (v: V3, a: number): V3 => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a), v[2]];
/** Tips a vector towards the front (+z) by `a`. */
const fwd = (v: V3, a: number): V3 => rotX(v, -a);
const frameOf = (r: (v: V3) => V3): Frame => [r([1, 0, 0]), r([0, 1, 0]), r([0, 0, 1])];
const apply = (f: Frame, v: V3): V3 => vadd(vadd(vmul(f[0], v[0]), vmul(f[1], v[1])), vmul(f[2], v[2]));
const compose = (f: Frame, g: Frame): Frame => [apply(f, g[0]), apply(f, g[1]), apply(f, g[2])];
const rotOf = (f: Frame): V3 => euler(fromCols(f[0], f[1], f[2]));

/** Frame with Y along `y` and Z as close as possible to `zHint`. */
function frameAlong(y: V3, zHint: V3): Frame {
  const Y = vnorm(y);
  let Z = vsub(zHint, vmul(Y, vdot(zHint, Y)));
  if (vlen(Z) < 1e-6) Z = Math.abs(Y[1]) < 0.9 ? vsub([0, 1, 0], vmul(Y, Y[1])) : vsub([0, 0, 1], vmul(Y, Y[2]));
  Z = vnorm(Z);
  return [vcross(Y, Z), Y, Z];
}

/** Ellipsoid of full size `size` (along the frame's X, Y, Z) centred at `c`. */
function blob(slot: string, c: V3, f: Frame, size: V3, plan = false): Part {
  return sphere(slot, c, 0.5, { scale: size, rotation: rotOf(f), plan });
}

/** Lathe along the frame's Y from `origin` (profile y values are measured from it). */
function latheAt(slot: string, origin: V3, f: Frame, profile: V2[], zScale: number, plan = true): Part {
  const ys = profile.map((p) => p[1]);
  const mid = (Math.min(...ys) + Math.max(...ys)) / 2;
  return {
    shape: 'lathe',
    profile: profile.map(([r, y]) => [Math.max(0, r), y - mid] as V2),
    segments: 20,
    position: vadd(origin, vmul(f[1], mid)),
    rotation: rotOf(f),
    scale: [1, 1, zScale],
    slot,
    plan,
  };
}

function boxAt(slot: string, c: V3, f: Frame, size: V3, bevel: number, plan = true): Part {
  return { shape: 'box', size, bevel: Math.min(bevel, 0.45 * Math.min(...size)), position: c, rotation: rotOf(f), slot, plan };
}

/** Proportions by age: leg length, head size, torso length and width factors. */
const AGE: Record<HumanAge, { leg: number; head: number; width: number }> = {
  adult: { leg: 1, head: 1, width: 1 },
  senior: { leg: 0.99, head: 1.02, width: 1.02 },
  teen: { leg: 1, head: 1.07, width: 0.94 },
  child: { leg: 0.95, head: 1.25, width: 0.95 },
  toddler: { leg: 0.85, head: 1.5, width: 1.02 },
};

/** World directions of a pose: body frames and unit vectors along each limb segment. */
export interface HumanPoseTargets {
  /** Pelvis, chest and head frames as [X (left), Y (up), Z (front)] axes. */
  P: [V3, V3, V3];
  C: [V3, V3, V3];
  H: [V3, V3, V3];
  armL: { upper: V3; fore: V3 };
  armR: { upper: V3; fore: V3 };
  legL: { thigh: V3; shin: V3; foot: V3 };
  legR: { thigh: V3; shin: V3; foot: V3 };
}

/**
 * Where a pose points every body part. Shared by the procedural figure and by the people bake
 * (tools/bake-people.mjs), which aims the bones of a rigged character along the same directions.
 */
export function humanPoseTargets(pose: HumanPose = {}): HumanPoseTargets {
  const P = frameOf((v) => rotY(rotX(rotY(v, pose.roll ?? 0), pose.pitch ?? 0), pose.yaw ?? 0));
  const C = compose(P, frameOf((v) => rotY(rotZ(rotX(v, pose.lean ?? 0), pose.tilt ?? 0), pose.twist ?? 0)));
  const hp = pose.head ?? {};
  const H = compose(C, frameOf((v) => rotY(rotZ(rotX(v, hp.pitch ?? 0), -(hp.roll ?? 0)), hp.yaw ?? 0)));
  const arm = (s: number) => {
    const a = (s === 1 ? pose.armL : pose.armR) ?? {};
    const local = (v: V3) => rotZ(v, s * (a.abd ?? 0.06));
    return {
      upper: apply(C, local(fwd(DOWN, a.flex ?? 0))),
      fore: apply(C, local(rotY(fwd(DOWN, (a.flex ?? 0) + (a.bend ?? 0.12)), -s * (a.turn ?? 0)))),
    };
  };
  const leg = (s: number) => {
    const l = (s === 1 ? pose.legL : pose.legR) ?? {};
    const local = (v: V3) => rotZ(rotY(v, s * (l.turn ?? 0)), s * (l.abd ?? 0.03));
    const mirror = (v: V3): V3 => vnorm([v[0] * s, v[1], v[2]]);
    const flex = l.flex ?? 0;
    const bend = l.bend ?? 0.02;
    return {
      thigh: apply(P, local(fwd(DOWN, flex))),
      shin: l.shin ? apply(P, mirror(l.shin)) : apply(P, local(fwd(DOWN, flex - bend))),
      foot: l.foot ? apply(P, mirror(l.foot)) : apply(P, local(fwd(DOWN, flex - bend + Math.PI / 2 - (l.ankle ?? 0)))),
    };
  };
  return { P, C, H, armL: arm(1), armR: arm(-1), legL: leg(1), legR: leg(-1) };
}

/** Builds a posed figure (see the module comment). */
export function humanFigure(body: HumanBody, pose: HumanPose = {}): HumanFigure {
  const H = body.stature;
  const fem = body.sex === 'female';
  const age = AGE[body.age ?? 'adult'];
  const bw = body.build ?? 1;
  const top = body.top ?? 'tee';
  const bottoms = body.bottoms ?? (top === 'dress' ? 'none' : 'trousers');
  const feet = body.feet ?? 'shoes';
  // Shoes share the hair slot (fixed per figure), or the second slot under a dress.
  const shoeSlot = top === 'dress' ? 'bottoms' : 'hair';
  const hair = body.hair ?? (fem ? 'long' : 'short');
  // Torso fills what legs, neck and head leave of the stature.
  const tK = (1 - 0.039 * age.leg - 0.491 * age.leg - 0.182 * age.head) / 0.288;
  const armK = (age.leg + tK) / 2;
  const wK = age.width;
  const u = (f: number) => f * H;

  const thighL = u(0.245 * age.leg);
  const shankL = u(0.246 * age.leg);
  const uaL = u(0.186 * armK);
  const faL = u(0.146 * armK);
  const waistY = u(0.1 * tK);
  const hw = u(0.088 * age.head);
  const hh = u(0.125 * age.head);
  const hd = u(0.105 * age.head);

  const T = humanPoseTargets(pose);
  const { P, C } = T;
  const Hf = T.H;

  const parts: Part[] = [];
  const W = apply(P, [0, waistY, 0]);
  const dressLike = top === 'dress' || top === 'ao-dai';
  const legsStraight = (pose.legL?.flex ?? 0) < 0.35 && (pose.legR?.flex ?? 0) < 0.35 && (pose.legL?.flex ?? 0) > -0.35 && (pose.legR?.flex ?? 0) > -0.35;
  const skirtLathe = (bottoms === 'skirt' || dressLike) && legsStraight && Math.abs(pose.pitch ?? 0) < 0.6;

  // ── Pelvis and hips ──
  const pelvisSlot = top === 'dress' ? 'top' : bottoms === 'none' ? 'skin' : 'bottoms';
  const pelvisProfile: V2[] = (
    fem
      ? [
          [0.06, -0.06],
          [0.09, -0.035],
          [0.104, 0],
          [0.1, 0.04],
          [0.085, 0.08],
          [0.075, 0.1 * tK + 0.004],
        ]
      : [
          [0.055, -0.06],
          [0.085, -0.035],
          [0.097, 0],
          [0.095, 0.04],
          [0.085, 0.08],
          [0.081, 0.1 * tK + 0.004],
        ]
  ).map(([r, y]) => [u(r) * wK * bw, u(y)] as V2);
  parts.push(latheAt(pelvisSlot, [0, 0, 0], P, pelvisProfile, fem ? 0.7 : 0.66));
  // The top hangs over the waistband (a jacket lower, a dress is all one piece).
  if (top !== 'dress' && top !== 'ao-dai') {
    const low = top === 'jacket' ? -0.03 : 0.035;
    const prof = pelvisProfile.filter(([, y]) => y >= u(low) - 1e-9).map(([r, y]) => [r * 1.05, y] as V2);
    if (prof[0][1] > u(low)) prof.unshift([pelvisProfile.find(([, y]) => y >= u(low))![0] * 1.05, u(low)]);
    parts.push(latheAt('top', [0, 0, 0], P, prof, fem ? 0.72 : 0.68, false));
  }
  if (skirtLathe) {
    // Skirt, dress or áo dài panels hanging straight from the hips.
    const hem = top === 'ao-dai' ? -(thighL + shankL * 0.55) : top === 'dress' ? -thighL * 0.9 : -thighL * 0.8;
    const r0 = pelvisProfile[2][0] * 1.06;
    const flare = top === 'ao-dai' ? 1.05 : 1.3;
    parts.push(
      latheAt(
        top === 'dress' || top === 'ao-dai' ? 'top' : 'bottoms',
        [0, 0, 0],
        P,
        [
          [r0 * flare, hem],
          [r0 * (1 + (flare - 1) * 0.5), hem * 0.5],
          [r0, 0],
          [pelvisProfile[3][0] * 1.05, u(0.04)],
        ],
        top === 'ao-dai' ? 0.55 : 0.8,
      ),
    );
  }

  // ── Chest ──
  const chestProfile: V2[] = (
    fem
      ? [
          [0.074, 0],
          [0.08, 0.05],
          [0.088, 0.11],
          [0.09, 0.15],
          [0.082, 0.178],
          [0.05, 0.193],
          [0.028, 0.198],
        ]
      : [
          [0.081, 0],
          [0.088, 0.05],
          [0.1, 0.11],
          [0.104, 0.15],
          [0.095, 0.178],
          [0.06, 0.196],
          [0.03, 0.2],
        ]
  ).map(([r, y]) => [u(r) * wK * bw, u(y) * tK] as V2);
  parts.push(latheAt('top', W, C, chestProfile, fem ? 0.62 : 0.6));
  const at = (v: V3) => vadd(W, apply(C, v));
  if (fem && body.age !== 'child' && body.age !== 'toddler') {
    for (const s of [1, -1]) parts.push(sphere('top', at([s * u(0.038) * wK, u(0.12) * tK, u(0.024) * bw]), u(0.025) * wK * Math.sqrt(bw), { plan: false }));
  }

  // ── Neck and head ──
  const neckBase = at([0, u(0.188) * tK, -u(0.004)]);
  const neckTop = vadd(neckBase, vmul(Hf[1], u(0.045) * (body.age === 'toddler' || body.age === 'child' ? 0.75 : 1)));
  parts.push(rod('skin', neckBase, neckTop, u(fem ? 0.023 : 0.027) * wK * Math.sqrt(bw), { segments: 12, plan: false }));
  const hc = vadd(neckTop, apply(Hf, [0, hh * 0.42, hd * 0.06]));
  const hpos = (v: V3) => vadd(hc, apply(Hf, v));
  parts.push(blob('skin', hc, Hf, [hw, hh, hd], true));
  parts.push(sphere('skin', hpos([0, -0.05 * hh, 0.49 * hd]), 0.075 * hw, { scale: [1, 1.25, 1], rotation: rotOf(Hf), plan: false }));
  for (const s of [1, -1]) {
    parts.push(blob('skin', hpos([s * 0.49 * hw, 0.02 * hh, -0.03 * hd]), Hf, [0.12 * hw, 0.27 * hh, 0.2 * hd]));
    parts.push(sphere('hair', hpos([s * 0.2 * hw, 0.06 * hh, 0.445 * hd]), 0.048 * hw, { plan: false }));
  }
  // Hair.
  const cap = (c: V3, size: V3) => parts.push(blob('hair', hpos(c), Hf, size, true));
  if (hair === 'crop') cap([0, 0.19 * hh, -0.05 * hd], [1.05 * hw, 0.72 * hh, 1.04 * hd]);
  else if (hair === 'curly') cap([0, 0.16 * hh, -0.05 * hd], [1.24 * hw, 0.92 * hh, 1.2 * hd]);
  else if (hair !== 'bald') cap([0, 0.15 * hh, -0.06 * hd], [1.09 * hw, 0.8 * hh, 1.07 * hd]);
  if (hair === 'bob') cap([0, -0.1 * hh, -0.15 * hd], [1.14 * hw, 0.9 * hh, 0.9 * hd]);
  if (hair === 'long') cap([0, -0.62 * hh, -0.33 * hd], [0.98 * hw, 1.55 * hh, 0.44 * hd]);
  if (hair === 'ponytail') {
    parts.push(sphere('hair', hpos([0, 0.12 * hh, -0.5 * hd]), 0.14 * hw, { plan: false }));
    parts.push(rod('hair', hpos([0, 0.1 * hh, -0.52 * hd]), hpos([0, -0.6 * hh, -0.66 * hd]), 0.12 * hw, { rTop: 0.05 * hw, segments: 10, plan: false }));
  }
  if (hair === 'bun') parts.push(sphere('hair', hpos([0, 0.36 * hh, -0.4 * hd]), 0.27 * hw, { plan: false }));

  // ── Arms ──
  const longSleeve = top === 'long-sleeve' || top === 'jacket' || top === 'ao-dai';
  const shortSleeve = top === 'tee' || top === 'dress';
  for (const s of [1, -1]) {
    const { upper, fore } = s === 1 ? T.armL : T.armR;
    const sh = at([s * u(fem ? 0.096 : 0.108) * wK * Math.sqrt(bw), u(0.163) * tK, -u(0.006)]);
    const el = vadd(sh, vmul(upper, uaL));
    const wr = vadd(el, vmul(fore, faL));
    const r0 = u(fem ? 0.02 : 0.023) * wK * bw;
    const r1 = u(fem ? 0.0155 : 0.017) * wK * Math.sqrt(bw);
    const rw = u(fem ? 0.0105 : 0.012) * wK;
    parts.push(sphere(top === 'tank' ? 'skin' : 'top', sh, u(fem ? 0.022 : 0.025) * wK * bw, { plan: false }));
    if (longSleeve) {
      parts.push(rod('top', sh, el, r0 * 1.16, { rTop: r1 * 1.2, segments: 12 }));
      parts.push(sphere('top', el, r1 * 1.2, { plan: false }));
      parts.push(rod('top', el, wr, r1 * 1.18, { rTop: rw * 1.45, segments: 12 }));
    } else {
      parts.push(rod('skin', sh, el, r0, { rTop: r1, segments: 12 }));
      if (shortSleeve) parts.push(rod('top', vsub(sh, vmul(upper, uaL * 0.05)), vadd(sh, vmul(upper, uaL * 0.48)), r0 * 1.32, { rTop: r0 * 1.22, segments: 12, plan: false }));
      parts.push(sphere('skin', el, r1, { plan: false }));
      parts.push(rod('skin', el, wr, r1, { rTop: rw, segments: 12 }));
    }
    // Hand, a little flattened, palm facing the body.
    const hf = frameAlong(fore, vmul(apply(C, [s, 0, 0]), -1));
    parts.push(blob('skin', vadd(wr, vmul(fore, u(0.043) * armK)), hf, [u(0.046) * armK * wK, u(0.092) * armK, u(0.024) * armK * wK]));
  }

  // ── Legs ──
  const trousers = bottoms === 'trousers' || top === 'ao-dai';
  for (const s of [1, -1]) {
    const { thigh, shin, foot: footDir } = s === 1 ? T.legL : T.legR;
    const hip = apply(P, [s * u(fem ? 0.056 : 0.052) * wK * Math.sqrt(bw), 0, 0]);
    const knee = vadd(hip, vmul(thigh, thighL));
    const ankle = vadd(knee, vmul(shin, shankL));
    const rT = u(fem ? 0.037 : 0.035) * wK * bw;
    const rK = u(0.022) * wK * Math.sqrt(bw);
    const rC = u(0.026) * wK * Math.sqrt(bw);
    const rA = u(0.0125) * wK;
    const skirtCover = !skirtLathe && (bottoms === 'skirt' || top === 'dress' || top === 'ao-dai');
    const coverSlot = top === 'dress' || top === 'ao-dai' ? 'top' : 'bottoms';
    if (trousers && !skirtCover) {
      parts.push(rod('bottoms', vsub(hip, vmul(thigh, u(0.02))), knee, rT * 1.12, { rTop: rK * 1.3, segments: 12 }));
    } else {
      parts.push(rod('skin', hip, knee, rT, { rTop: rK, segments: 12 }));
      if (bottoms === 'shorts') parts.push(rod('bottoms', vsub(hip, vmul(thigh, u(0.02))), vadd(hip, vmul(thigh, thighL * 0.55)), rT * 1.2, { rTop: rT * 1.12, segments: 12, plan: false }));
      if (skirtCover) parts.push(rod(coverSlot, vsub(hip, vmul(thigh, u(0.02))), vadd(hip, vmul(thigh, thighL * (top === 'ao-dai' ? 1.05 : 0.85))), rT * 1.25, { rTop: rT * 1.32, segments: 12, plan: false }));
    }
    const shinSlot = trousers ? 'bottoms' : 'skin';
    parts.push(sphere(shinSlot, knee, trousers ? rK * 1.3 : rK, { plan: false }));
    if (trousers) parts.push(rod('bottoms', knee, ankle, rK * 1.3, { rTop: u(0.021) * wK, segments: 12 }));
    else {
      const calf = vadd(knee, vmul(shin, shankL * 0.3));
      parts.push(rod('skin', knee, calf, rK, { rTop: rC, segments: 12 }), rod('skin', calf, ankle, rC, { rTop: rA, segments: 12 }));
    }
    // Foot: Z along the foot, Y up towards the knee.
    const F = frameAlong(vmul(shin, -1), footDir);
    const fl = u(0.152) * age.leg;
    const fc = vadd(vadd(ankle, vmul(F[2], fl * 0.3)), vmul(F[1], -u(0.018) * age.leg));
    if (feet === 'shoes') parts.push(boxAt(shoeSlot, vadd(fc, vmul(F[1], -u(0.002))), F, [u(0.052) * wK, u(0.042) * age.leg, fl * 1.06], u(0.016)));
    else {
      parts.push(blob('skin', fc, F, [u(0.046) * wK, u(0.034) * age.leg, fl]));
      if (feet === 'slippers') parts.push(boxAt(shoeSlot, vadd(fc, vmul(F[1], -u(0.018) * age.leg)), F, [u(0.054) * wK, u(0.01), fl * 1.04], u(0.004)));
    }
  }

  // ── Stand on the floor, centred on the footprint ──
  const b = groupBounds(parts);
  const shift: V3 = [-(b.min[0] + b.max[0]) / 2, -b.min[1], -(b.min[2] + b.max[2]) / 2];
  const placed = parts.map((p) => ({ ...p, position: vadd(p.position, shift) }));
  const ceil = (v: number) => Math.ceil(v * 1000) / 1000;
  const seat = vadd(apply(P, [0, -u(0.06), 0]), shift)[1];
  return { parts: placed, size: { w: ceil(b.max[0] - b.min[0]), d: ceil(b.max[2] - b.min[2]), h: ceil(b.max[1] - b.min[1]) }, seatHeight: Math.max(0, seat) };
}

/** Scales a figure built at its real size uniformly so it fits the item box `size`. */
export function fitHuman(fig: HumanFigure, size: Size3): Part[] {
  const k = Math.min(size.w / fig.size.w, size.d / fig.size.d, size.h / fig.size.h);
  return Math.abs(k - 1) < 1e-6 ? fig.parts : scaleAbout(fig.parts, [0, 0, 0], k * 0.999);
}

const legs = (both: LimbPose, r?: LimbPose) => ({ legL: both, legR: r ?? both });
const arms = (both: LimbPose, r?: LimbPose) => ({ armL: both, armR: r ?? both });

/** Ready poses; combine or tweak them (they are plain data). */
export const HUMAN_POSES = {
  stand: { ...arms({ abd: 0.08, bend: 0.15 }), ...legs({ abd: 0.04 }) },
  'stand-arms-crossed': { ...arms({ flex: 0.25, abd: 0.05, bend: 1.95, turn: 1.25 }, { flex: 0.3, abd: 0.05, bend: 1.85, turn: 1.4 }), ...legs({ abd: 0.06 }) },
  'stand-hands-on-hips': { ...arms({ abd: 0.5, flex: -0.2, bend: 1.2, turn: 2.0 }), ...legs({ abd: 0.07 }) },
  'stand-wave': { armL: { abd: 0.08, bend: 0.15 }, armR: { abd: 1.3, flex: 0.15, bend: 1.55, turn: -1.45 }, ...legs({ abd: 0.04 }), head: { roll: 0.08 } },
  walk: {
    legL: { flex: 0.35, bend: 0.08, ankle: -0.1 },
    legR: { flex: -0.25, bend: 0.4, ankle: 0.25 },
    armL: { flex: -0.3, bend: 0.25, abd: 0.07 },
    armR: { flex: 0.32, bend: 0.45, abd: 0.07 },
    lean: 0.04,
  },
  'phone-call': { armL: { abd: 0.08, bend: 0.2 }, armR: { flex: 0.45, abd: 0.35, bend: 2.55, turn: 0.55 }, ...legs({ abd: 0.05 }), head: { roll: 0.12, pitch: 0.05 } },
  'phone-scroll': { ...arms({ flex: 0.42, abd: 0.08, bend: 1.45, turn: 0.55 }), ...legs({ abd: 0.05 }), head: { pitch: 0.5 } },
  'reach-up': { armL: { abd: 0.1, bend: 0.2 }, armR: { flex: 2.85, abd: 0.12, bend: 0.12 }, ...legs({ abd: 0.05, ankle: 0.45 }), head: { pitch: -0.45 }, lean: -0.05 },
  'stretch-arms-up': { ...arms({ flex: 2.95, abd: 0.15, bend: 0.1, turn: 0.2 }), ...legs({ abd: 0.06 }), head: { pitch: -0.15 } },
  stoop: { ...arms({ flex: 0.15, abd: 0.08, bend: 0.4 }), ...legs({ abd: 0.05, flex: 0.12, bend: 0.25 }), lean: 0.32, head: { pitch: -0.3 } },
  'cook-stir': {
    armL: { flex: 0.55, abd: 0.12, bend: 1.15, turn: 0.45 },
    armR: { flex: 0.72, abd: 0.12, bend: 0.85, turn: 0.35 },
    ...legs({ abd: 0.05 }),
    lean: 0.12,
    head: { pitch: 0.38 },
  },
  'chop-vegetables': { armL: { flex: 0.5, abd: 0.1, bend: 1.2, turn: 0.55 }, armR: { flex: 0.6, abd: 0.08, bend: 1.0, turn: 0.25 }, ...legs({ abd: 0.05 }), lean: 0.15, head: { pitch: 0.5 } },
  'wash-dishes': { ...arms({ flex: 0.62, abd: 0.08, bend: 0.85, turn: 0.45 }), ...legs({ abd: 0.05 }), lean: 0.2, head: { pitch: 0.45 } },
  'mirror-hair': { armL: { flex: 0.35, abd: 0.15, bend: 1.4, turn: 0.6 }, armR: { flex: 1.35, abd: 0.75, bend: 2.35, turn: 0.45 }, ...legs({ abd: 0.05 }), head: { pitch: -0.05, roll: 0.1 } },
  'mirror-brush-teeth': { armL: { abd: 0.08, bend: 0.25 }, armR: { flex: 0.95, abd: 0.12, bend: 2.15, turn: 0.75 }, ...legs({ abd: 0.06 }), lean: 0.12, head: { pitch: 0.05 } },
  'sit-chair': { ...legs({ flex: 1.57, bend: 1.57, abd: 0.08 }), ...arms({ flex: 0.4, abd: 0.1, bend: 0.75, turn: 0.15 }), lean: 0.02 },
  'sit-desk-typing': { ...legs({ flex: 1.57, bend: 1.5, abd: 0.07 }), ...arms({ flex: 0.5, abd: 0.12, bend: 1.25, turn: 0.28 }), lean: 0.1, head: { pitch: 0.12 } },
  'sit-eating': {
    ...legs({ flex: 1.57, bend: 1.5, abd: 0.08 }),
    armL: { flex: 0.45, abd: 0.15, bend: 1.4, turn: 0.45 },
    armR: { flex: 0.65, abd: 0.15, bend: 2.0, turn: 0.6 },
    lean: 0.12,
    head: { pitch: 0.2 },
  },
  'sit-sofa-relaxed': { pitch: -0.3, ...legs({ flex: 1.35, bend: 1.3, abd: 0.12 }), armL: { flex: 0.15, abd: 0.4, bend: 0.5 }, armR: { flex: 0.45, abd: 0.12, bend: 1.05, turn: 0.35 }, head: { pitch: 0.2 } },
  'sit-cross-legged': {
    legL: { flex: 1.45, turn: 0.9, abd: 0.05, shin: [-0.93, -0.06, 0.36], foot: [-0.35, 0.1, 0.93] },
    legR: { flex: 1.45, turn: 0.9, abd: 0.05, shin: [-0.9, -0.24, 0.36], foot: [-0.35, 0.05, 0.93] },
    ...arms({ flex: 0.55, abd: 0.25, bend: 0.4, turn: 0.1 }),
    lean: 0.02,
  },
  'sit-hug-knees': { pitch: -0.18, ...legs({ flex: 2.25, bend: 2.55, abd: 0.08, ankle: 0.2 }), ...arms({ flex: 1.05, abd: 0.22, bend: 1.0, turn: 1.0 }), lean: 0.25, head: { pitch: 0.15 } },
  'sit-legs-out': { pitch: -0.08, ...legs({ flex: 1.5, abd: 0.4, bend: 0.15, ankle: -0.2 }), ...arms({ flex: 0.6, abd: 0.25, bend: 0.6, turn: 0.2 }), lean: 0.12 },
  kneel: { ...legs({ flex: 1.55, bend: 3.0, abd: 0.07, ankle: 1.75 }), ...arms({ flex: 0.45, abd: 0.1, bend: 0.75, turn: 0.35 }), lean: -0.02 },
  squat: { pitch: 0.35, ...legs({ flex: 2.65, bend: 2.0, abd: 0.22, turn: 0.35, ankle: 0.3 }), ...arms({ flex: 1.2, abd: 0.15, bend: 0.55, turn: 0.2 }), lean: 0.2, head: { pitch: -0.4 } },
  'lie-back': { pitch: -Math.PI / 2, ...legs({ flex: 0.05, bend: 0.06, abd: 0.06, ankle: 0.6 }), armL: { abd: 0.18, bend: 0.2 }, armR: { flex: 0.35, abd: 0.05, bend: 1.25, turn: 0.65 }, head: { pitch: 0.12 } },
  'lie-side': {
    pitch: -Math.PI / 2,
    roll: Math.PI / 2,
    legL: { flex: 0.75, bend: 1.0, abd: 0.02, ankle: 0.4 },
    legR: { flex: 0.95, bend: 1.3, abd: 0.0, ankle: 0.4 },
    armL: { flex: 0.6, abd: 0.0, bend: 0.6, turn: 0.2 },
    armR: { flex: 1.45, abd: 0.0, bend: 1.4, turn: 0.2 },
    head: { roll: -0.2 },
  },
  'lie-front-reading': {
    pitch: Math.PI / 2,
    yaw: Math.PI,
    lean: -0.55,
    ...legs({ bend: 1.35, abd: 0.08, ankle: 0.9 }, { bend: 0.9, abd: 0.08, ankle: 0.9 }),
    ...arms({ flex: 1.95, abd: 0.25, bend: 0.75, turn: 0.45 }),
    head: { pitch: 0.35 },
  },
} satisfies Record<string, HumanPose>;

export type HumanPoseId = keyof typeof HUMAN_POSES;

/** Number of parts a figure has (for budgeting): about 45. */
export const humanPartCount = (body: HumanBody, pose: HumanPose = {}): number => humanFigure(body, pose).parts.length;

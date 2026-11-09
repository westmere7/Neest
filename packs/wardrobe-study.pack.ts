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
  dedupe,
  defineItem,
  definePack,
  knob,
  lathe,
  line,
  matSlot,
  prism,
  range,
  rng,
  rod,
  shakerFront,
  span,
  sphere,
  vcyl,
  type AssetModelVariant,
  type AssetParam,
  type ParamValues,
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
  // Without the desk: 40 cm oak shelf tower on one end and 35 cm side-entry column on the other.
  const tw = desk ? clamp(w * 0.25, 0.42, 0.6) : 0.4;
  const rw = desk ? clamp(w * 0.2, 0.34, 0.45) : 0.35;
  const xt0 = x0 + ov;
  const xt1 = xt0 + tw;
  const xr0 = x1 - rw;
  const n = clamp(Math.round((xr0 - xt1) / 0.55), 2, 4);
  const yU = h - clamp(h * 0.2, 0.4, 0.5);
  const deskH = Math.min(0.76, h * 0.33);
  return { x0, x1, zb, zf, D, tw, xt0, xt1, xr0, n, yU, deskH, dw: tw + ov };
}

/** The whole wall; `desk` = false leaves out the desk; `sideHookRack` builds the side-entry pin-hook & 2-tier slipper column. */
function buildWall({ w, d, h }: Size3, desk: boolean, sideHookRack = false): Part[] {
    const L = layout(w, d, h, desk);
    const { x1, zb, zf, xt0, xt1, xr0, n, yU, deskH, dw } = L;
    const x0 = L.x0;
    const t = 0.018;
    const zc = zf - 0.02; // carcass face; fronts are 2 cm proud of it
    const plinth = 0.06;
    const parts: Part[] = [];

    // ── Oak shelf tower ─────────────────────────────────────────────────────
    parts.push(span('oak', [xt0, xt0 + t], [0, h], [zb, zc]), span('oak', [xt1 - t, xt1], [0, h], [zb, zc]));
    if (desk) {
      parts.push(
        span('oak', [xt0 + t, xt1 - t], [yU, h], [zb, zc]),
        sp('oak', [xt0 + 0.002, xt1 - 0.002], [yU + 0.002, h - 0.002], [zc, zf], 0.002),
        sp('oak', [xt0 + t, xt1 - t], [deskH, yU], [zb, zb + 0.012]),
        // Closed base under the desk.
        sp('oak', [xt0 + t, xt1 - t], [0.01, deskH - 0.035], [zc - 0.02, zc]),
      );
    } else {
      // Slim tower: the top is an open niche too (a shelf at the cabinet line, the top board above), and
      // the base is a cabinet with an oak door and a brass knob.
      parts.push(
        span('oak', [xt0 + t, xt1 - t], [h - t, h], [zb, zc]),
        sp('oak', [xt0 + t, xt1 - t], [yU - 0.025, yU], [zb + 0.012, zc - 0.005], 0.002),
        sp('oak', [xt0 + t, xt1 - t], [deskH, h - t], [zb, zb + 0.012]),
        sp('oak', [xt0 + t, xt1 - t], [0.01, deskH - 0.035], [zb, zb + 0.012]),
        sp('oak', [xt0 + t + 0.002, xt1 - t - 0.002], [0.012, deskH - 0.039], [zc - 0.02, zc], 0.002),
        sp('light', [xt0 + t + 0.01, xt1 - t - 0.01], [h - t - 0.006, h - t], [zc - 0.06, zc - 0.045]),
        ...knob('metal', [xt1 - t - 0.04, deskH - 0.1, zc], 0.012),
      );
    }
    // Open shelves with a warm LED strip under each front edge (and under the cabinet above).
    const shelfYs = range(2).map((i) => deskH + ((yU - deskH) * (i + 1)) / 3);
    for (const y of shelfYs) parts.push(sp('oak', [xt0 + t, xt1 - t], [y - 0.025, y], [zb + 0.012, zc - 0.005], 0.002));
    for (const y of [...shelfYs.map((s) => s - 0.025), desk ? yU : yU - 0.025]) {
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

    // ── Right column: rounded corner, open oak corner niche or side-entry pin-hook & slipper rack ──
    const rr = Math.min(0.12, (x1 - xr0) * 0.35);
    const yB = clamp(h * 0.22, 0.45, 0.55);
    const xf = x1 - rr; // fronts end where the rounded corner begins
    const nicheTop = yU - 0.03;
    const nicheOutline = roundedCorner(xr0, x1, zb, zf, rr);

    if (!sideHookRack) {
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
    } else {
      // Top cupboard (yU .. h) keeps its rounded corner and shaker door; everything below opens to the +x side.
      parts.push(
        prism('white', roundedCorner(xf, x1, zb, zf, rr), yU, h - yU),
        span('white', [xr0, xf], [yU, h], [zb, zc]),
        ...shakerFront('white', [xr0, xf], [yU, h], zc, 0.02, { rail: 0.06 }),
        ...knob('white', [xr0 + 0.05, yU + 0.06, zf], 0.013),
      );

      // Recessed rounded plinth at floor level.
      parts.push({
        ...prism('white', roundedCorner(xr0 + 0.01, x1 - 0.014, zb, zf - 0.024, Math.max(0.02, rr - 0.02)), 0, plinth),
        plan: false,
      });

      const deckT = 0.022;
      const ySlip0 = plinth + deckT;
      const yMid = (ySlip0 + yB - 0.016) / 2;
      const xWall = xr0 + 0.014;
      const xFromOak = xWall + 0.001;

      // Seamless curved white front wall (bed side) for both the lower 2-tier slipper bay and upper pin-hook alcove.
      parts.push(
        { ...prism('oak', nicheOutline, plinth, deckT), plan: false },
        { ...prism('white', frontBand(xr0 + 0.002, x1, zf, rr, 0, t), ySlip0, yB - ySlip0), plan: false },
        { ...prism('oak', frontBand(xFromOak, x1, zf, rr, t + 0.001, t + 0.008), ySlip0 + 0.001, yB - ySlip0 - 0.002), plan: false },
        { ...prism('oak', nicheOutline, yB, 0.03), plan: false },
        { ...prism('white', frontBand(xr0 + 0.002, x1, zf, rr, 0, t), yB + 0.03, nicheTop - (yB + 0.03)), plan: false },
        { ...prism('oak', frontBand(xFromOak, x1, zf, rr, t + 0.001, t + 0.008), yB + 0.031, nicheTop - (yB + 0.032)), plan: false },
        { ...prism('oak', nicheOutline, nicheTop, 0.03), plan: false },
      );

      // Oak back & inner walls (35 cm inward depth from x1) + middle shelf dividing the bottom into 2 slipper tiers.
      const innerShelfOutline = roundedCorner(xWall, x1 - 0.004, zb + 0.015, zf - t - 0.009, Math.max(0.015, rr - t - 0.009));
      parts.push(
        sp('oak', [xr0 + 0.001, x1 - 0.008], [ySlip0 - 0.002, yB + 0.002], [zb + 0.001, zb + 0.015]),
        sp('oak', [xr0 + 0.001, xWall], [ySlip0 - 0.002, yB + 0.002], [zb + 0.015, zf - t - 0.005]),
        { ...prism('oak', innerShelfOutline, yMid, 0.016), plan: false },
        sp('oak', [xr0 + 0.001, x1 - 0.008], [yB + 0.028, nicheTop + 0.002], [zb + 0.001, zb + 0.015]),
        sp('oak', [xr0 + 0.001, xWall], [yB + 0.028, nicheTop + 0.002], [zb + 0.015, zf - t - 0.005]),
      );

      // Horizontal oak peg rail & 3 cylindrical pin hooks (móc dạng pin) mounted on the inner wall.
      const yPin = nicheTop - 0.135;
      const zRail0 = zb + 0.028;
      const zRail1 = zf - rr - 0.006;
      parts.push(sp('oak', [xWall, xWall + 0.016], [yPin - 0.03, yPin + 0.03], [zRail0, zRail1], 0.003));
      const zP0 = zRail0 + 0.062;
      const zP2 = zRail1 - 0.052;
      for (const zh of [zP0, (zP0 + zP2) / 2, zP2]) {
        parts.push(
          rod('metal', [xWall + 0.017, yPin, zh], [xWall + 0.123, yPin, zh], 0.008, { segments: 12, plan: false }),
          rod('oak', [xWall + 0.124, yPin, zh], [xWall + 0.143, yPin, zh], 0.021, { segments: 18, plan: false }),
        );
      }
    }

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

// ── Model: the corner niche closed at the front, as a quick hanging spot ─────────

const CLOTHES_A = matSlot('clothes', 'Hanging clothes', 'fabric-linen');
const CLOTHES_B = matSlot('clothes2', 'Hanging clothes, dark', 'fabric-navy');
const TOWER_SLIPPER_A = matSlot('slippers1', 'Slippers (upper tier)', 'fabric-cream');
const TOWER_SLIPPER_B = matSlot('slippers2', 'Slippers (lower tier)', 'fabric-linen-sage');

/**
 * Band along the column's front (z = zf) from `xFrom` round its rounded corner to where the side begins,
 * between `o0` and `o1` in from the outer face.
 */
function frontBand(xFrom: number, x1: number, zf: number, rr: number, o0: number, o1: number, seg = 16): V2[] {
  const cx = x1 - rr;
  const cz = zf - rr;
  const outer: V2[] = [[xFrom, zf - o0]];
  const inner: V2[] = [];
  for (const i of range(seg + 1)) {
    const a = Math.PI / 2 - (i / seg) * (Math.PI / 2);
    outer.push([cx + Math.cos(a) * (rr - o0), cz + Math.sin(a) * (rr - o0)]);
    inner.push([cx + Math.cos(a) * (rr - o1), cz + Math.sin(a) * (rr - o1)]);
  }
  return [...outer, ...inner.reverse(), [xFrom, zf - o1]];
}

/** A flat shape facing front/back: `pts` are [x, y], extruded `t` along +z from z0. */
function frontPlate(slot: string, pts: V2[], z0: number, t: number): Part {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  return { shape: 'prism', outline: pts.map(([x, y]) => [x - cx, -(y - cy)] as V2), height: t, position: [cx, cy, z0], rotation: [Math.PI / 2, 0, 0], slot, plan: false };
}

/**
 * The niche closed at the front by a wall that follows the rounded corner (white outside, oak inside), so
 * it opens only on the side; a brass rail along that side with wooden hangers and a few garments.
 */
function closedNiche({ w, d, h }: Size3, desk: boolean): Part[] {
  const L = layout(w, d, h, desk);
  const { x1, zb, zf, xr0, yU } = L;
  const t = 0.018;
  const rr = Math.min(0.12, (x1 - xr0) * 0.35);
  const yB = clamp(h * 0.22, 0.45, 0.55);
  const y0 = yB + 0.03;
  const nicheTop = yU - 0.03;
  // Starts just past the oak lining on the wardrobe side.
  const xFrom = xr0 + 0.013;
  const parts: Part[] = [
    { ...prism('white', frontBand(xFrom, x1, zf, rr, 0, t), y0, nicheTop - y0), plan: false },
    { ...prism('oak', frontBand(xFrom, x1, zf, rr, t + 0.001, t + 0.007), y0 + 0.001, nicheTop - y0 - 0.002), plan: false },
  ];
  // Rail from the back to the new front wall, along the open side, a little under the niche top.
  const xc = (xFrom + x1) / 2;
  const za = zb + 0.03;
  const zz = zf - t - 0.012;
  const yRail = nicheTop - 0.07;
  parts.push(rod('metal', [xc, yRail, za], [xc, yRail, zz], 0.008, { segments: 12, plan: false }));
  // Garments on wooden hangers: shoulders and a straight hem, two colours, varied lengths.
  const lengths = [0.78, 0.62, 0.92, 0.56, 0.84];
  const zs = range(lengths.length).map((i) => za + 0.07 + ((zz - za - 0.14) * i) / (lengths.length - 1));
  const half = Math.min(0.17, (x1 - xFrom) / 2 - 0.012);
  const yTop = yRail - 0.045;
  zs.forEach((z, i) => {
    const len = Math.min(lengths[i], yTop - (y0 + 0.06));
    const tk = 0.028;
    const shape: V2[] = [
      [xc - half, yTop - 0.06],
      [xc - 0.05, yTop],
      [xc + 0.05, yTop],
      [xc + half, yTop - 0.06],
      [xc + half + 0.008, yTop - len],
      [xc - half - 0.008, yTop - len],
    ];
    parts.push(
      frontPlate(i % 2 === 0 ? 'clothes' : 'clothes2', shape, z - tk / 2, tk),
      // Hanger: a bar along the shoulders and a hook up over the rail.
      rod('oak', [xc - half + 0.02, yRail - 0.035, z], [xc + half - 0.02, yRail - 0.035, z], 0.007, { segments: 8, plan: false }),
      rod('metal', [xc, yRail - 0.035, z], [xc, yRail + 0.012, z], 0.0025, { segments: 6, plan: false }),
    );
  });
  return parts;
}

/** Elliptical arc helper in 2D. */
const arc2 = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n: number): V2[] =>
  range(n + 1).map((i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry] as V2;
  });

/** Open-toe indoor slipper oriented along X (toes pointing -x into the side-entry slipper shelf). */
function sidewaysSlipper(slot: string, cx: number, cz: number, y0: number, len: number, wid: number, footSide: -1 | 1): Part[] {
  const soleH = 0.016;
  const fore = arc2(-len * 0.05, footSide * wid * 0.025, len * 0.45, wid * 0.49, Math.PI / 2, 1.5 * Math.PI, 8);
  const heel = arc2(len * 0.11, -footSide * wid * 0.02, len * 0.39, wid * 0.41, -Math.PI / 2, Math.PI / 2, 8);
  const strapOuter = arc2(cz, y0 + soleH - 0.003, wid * 0.49, 0.036, 0, Math.PI, 10);
  const strapInner = arc2(cz, y0 + soleH - 0.001, wid * 0.36, 0.023, Math.PI, 0, 10);
  return [
    { ...prism(slot, dedupe([...fore, ...heel]), y0 + 0.001, soleH), position: [cx, y0 + 0.001, cz], plan: false },
    sidePlate(slot, dedupe([...strapOuter, ...strapInner]), cx - len * 0.34, len * 0.36),
  ];
}

/**
 * Two casual worn outfits (shirt + trousers each) draped from the pin hooks in the 35 cm side alcove,
 * plus two fixed-size pairs of indoor slippers on the 2-tier side-opening slipper rack below.
 */
function towerSideHooksAndSlippers({ w, d, h }: Size3): Part[] {
  const { x1, zb, zf, xr0, yU } = layout(w, d, h, false);
  const rr = Math.min(0.12, (x1 - xr0) * 0.35);
  const yB = clamp(h * 0.22, 0.45, 0.55);
  const nicheTop = yU - 0.03;
  const xWall = xr0 + 0.014;
  const yPin = nicheTop - 0.135;
  const zRail0 = zb + 0.028;
  const zRail1 = zf - rr - 0.006;
  const zP0 = zRail0 + 0.062;
  const zP2 = zRail1 - 0.052;
  const zP1 = (zP0 + zP2) / 2;
  const pinStep = zP1 - zP0;

  const availDrop = yPin - (yB + 0.055);
  const hw = clamp(pinStep * 0.44, 0.044, 0.076);
  const parts: Part[] = [];

  const legProf = (H: number): V2[] => [
    [0, Math.min(0.05, H * 0.16)],
    [0.68, Math.min(0.04, H * 0.13)],
    [0.76, 0],
    [0.92, 0],
    [0.98, H * 0.45],
    [1, H * 0.85],
    [0.85, H],
    [0, H],
  ];

  // 2 worn outfits (smoothly draped shirt + two tubular trouser legs) on the first two pins; front pin stays bare.
  const outfits: [number, string, string, number, number][] = [
    [zP0, 'clothes2', 'clothes', 0.63, 0.92],
    [zP1, 'clothes', 'clothes2', 0.57, 0.85],
  ];
  for (const [zh, topSlot, botSlot, fTop, fBot] of outfits) {
    const topL = Math.min(fTop, availDrop * 0.65);
    const botL = Math.min(fBot, availDrop * 0.91);
    const shirtProf: V2[] = [
      [0, -topL * 0.84],
      [0.62, -topL * 0.86],
      [0.72, -topL],
      [0.88, -topL],
      [0.98, -topL * 0.72],
      [1, -topL * 0.45],
      [0.86, -topL * 0.2],
      [0.52, -topL * 0.07],
      [0.28, 0],
      [0, 0],
    ];
    const yLegTop = yPin - topL * 0.72;
    const yLegBot = yPin - botL;
    const legH1 = yLegTop - (yLegBot + 0.014);
    const legH2 = yLegTop - yLegBot;
    const rzLeg = hw * 0.39;

    parts.push(
      // Trouser waistband loop on the inner brass stem + two softly tapered hollow-cuff trouser legs below.
      sp(botSlot, [xWall + 0.028, xWall + 0.062], [yPin - 0.11, yPin + 0.015], [zh - 0.022, zh + 0.022], 0.006),
      lathe(botSlot, [xWall + 0.18, yLegBot + 0.014, zh - hw * 0.44], legProf(legH1), {
        segments: 22,
        scale: [0.044, 1, rzLeg],
        rotation: [0, 0, -0.04],
        plan: false,
      }),
      lathe(botSlot, [xWall + 0.192, yLegBot, zh + hw * 0.44], legProf(legH2), {
        segments: 22,
        scale: [0.046, 1, rzLeg],
        rotation: [0, 0, -0.05],
        plan: false,
      }),
      // Softly draped shirt/jacket gathered right behind the round oak pin button head.
      lathe(topSlot, [xWall + 0.104, yPin + 0.012, zh], shirtProf, {
        segments: 28,
        scale: [0.082, 1, hw],
        rotation: [0, 0, 0.14],
        plan: false,
      }),
    );
  }

  // 2 pairs of fixed-size indoor slippers on the 2-tier side-opening slipper rack below.
  const plinth = 0.06;
  const ySlip0 = plinth + 0.022;
  const yMid = (ySlip0 + yB - 0.016) / 2;
  const sLen = 0.236;
  const sWid = 0.088;
  const sepZ = sWid / 2 + 0.006;
  const cxSlip = x1 - 0.032 - sLen / 2;
  const czSlip = (zb + 0.025 + (zf - rr - 0.01)) / 2;

  parts.push(
    ...sidewaysSlipper('slippers1', cxSlip, czSlip - sepZ, yMid + 0.016, sLen, sWid, -1),
    ...sidewaysSlipper('slippers1', cxSlip + 0.005, czSlip + sepZ, yMid + 0.016, sLen, sWid, 1),
    ...sidewaysSlipper('slippers2', cxSlip + 0.004, czSlip - sepZ, ySlip0, sLen, sWid, -1),
    ...sidewaysSlipper('slippers2', cxSlip, czSlip + sepZ, ySlip0, sLen, sWid, 1),
  );

  return parts;
}

const NICHE_MODELS = (desk: boolean): AssetModelVariant[] => [
  { id: 'open-niche', name: 'Open corner niche' },
  { id: 'hanging-niche', name: 'Closed front, hanging rail', slots: [CLOTHES_A, CLOTHES_B], props: (s) => closedNiche(s, desk) },
];

const TOWER_WALL_MODELS: AssetModelVariant[] = [
  {
    id: 'hanging-niche',
    name: 'Side pin hooks & 2-tier slipper rack',
    slots: [CLOTHES_A, CLOTHES_B, TOWER_SLIPPER_A, TOWER_SLIPPER_B],
    build: (s) => buildWall(s, false, true),
    props: (s) => towerSideHooksAndSlippers(s),
  },
  {
    id: 'side-rack-empty',
    name: 'Side pin hooks & slipper rack, empty',
    build: (s) => buildWall(s, false, true),
  },
  { id: 'open-niche', name: 'Open corner niche & base cabinet' },
];

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
  models: NICHE_MODELS(true),
});

/** The same wall without the desk: 40 cm oak shelf tower, shaker wardrobe, and 35 cm side-entry pin-hook & 2-tier slipper column. */
const towerWall = defineItem({
  id: 'wardrobe-shelf-tower-niche',
  name: 'Wardrobe with oak shelf tower & corner niche',
  category: 'bedroom',
  type: 'storage',
  group: 'Wardrobes',
  tags: ['wardrobe', 'built-in', 'shaker', 'oak', 'shelves', 'led', 'niche', 'shelf tower', 'coat hooks', 'slippers', 'tủ quần áo', 'vietnamese', 'apartment'],
  description:
    'A built-in bedroom wall without a desk: a 40 cm oak tower with LED-lit open shelves up to the ceiling over a cabinet with an oak door, a wide white shaker wardrobe with brass pulls, and a 35 cm rounded column with side-entry pin hooks for two worn outfits over a two-tier slipper rack.',
  defaultSize: { w: 2.0, d: 0.63, h: 2.4 },
  minSize: { w: 1.7, d: 0.5, h: 2.1 },
  maxSize: { w: 3.0, d: 0.66, h: 2.7 },
  wallSnap: true,
  slots: [matSlot('oak', 'Oak tower & niche', 'laminate-oak'), ...slots.slice(1)],
  light: { color: '#ffcf8a', intensity: 0.35, distance: 2.2, y: 1.3 },
  build: (s) => buildWall(s, false),
  planDetail: (s) => wallPlan(s, false),
  models: TOWER_WALL_MODELS,
});

// ── Standalone modular curved-waterfall add-on desk ─────────────────────────────

/**
 * Standalone version of the curved-waterfall oak desk so users can butt its flat left end (-x)
 * seamlessly against any wardrobe, bookcase or cabinet (or Flip/mirror to attach on the right)
 * while resizing width, depth and height freely.
 */
type ModularDeskMode = 'drawers' | 'pouf-stool' | 'oak-drawers' | 'no-stool' | 'plain' | 'slim';

function buildModularDesk({ w, d, h }: Size3, mode: ModularDeskMode = 'drawers'): Part[] {
  const x0 = -w / 2;
  const x1 = w / 2;
  const z0 = -d / 2;
  const z1 = d / 2;
  const top = clamp(h * 0.047, 0.028, 0.035);
  const R = clamp(Math.min(w * 0.18, h * 0.18), top + 0.015, 0.08);
  const xTopEnd = x1 - R + 0.01;
  const topLen = xTopEnd - x0;

  // Quarter-circle waterfall bend between the horizontal top and vertical floor leg.
  const seg = 24;
  const bend: V2[] = [];
  for (const i of range(seg + 1)) {
    const a = Math.PI / 2 - (i / seg) * (Math.PI / 2);
    bend.push([x1 - R + Math.cos(a) * R, h - R + Math.sin(a) * R]);
  }
  for (const i of range(seg + 1)) {
    const a = (i / seg) * (Math.PI / 2);
    bend.push([x1 - R + Math.cos(a) * (R - top), h - R + Math.sin(a) * (R - top)]);
  }

  const parts: Part[] = [
    // Rotated 90° around Y so wood-veneer grain (along local V) runs lengthwise along the desk (+x).
    {
      shape: 'box',
      size: [d, top, topLen],
      position: [(x0 + xTopEnd) / 2, h - top / 2, 0],
      rotation: [0, Math.PI / 2, 0],
      bevel: 0.004,
      slot: 'oak',
    },
    // Smooth 24-step curved waterfall corner (included in 2D plan so the full w × d footprint is covered).
    { ...frontPlate('oak', bend, z0, d), plan: undefined },
    // Full-depth vertical waterfall leg down to the floor; tucks 1 cm into the bend.
    sp('oak', [x1 - top, x1], [0, h - R + 0.01], [z0, z1], 0.004),
  ];

  const apronDrop = clamp(h * 0.215, 0.095, 0.16);
  const yBot = h - apronDrop;

  if (mode !== 'slim') {
    const hasDrawers = mode === 'drawers' || mode === 'pouf-stool' || mode === 'oak-drawers' || mode === 'no-stool';
    const zBack = z0 + clamp(d * 0.07, 0.022, 0.042);

    if (!hasDrawers) {
      const zFront = z1 - clamp(d * 0.08, 0.024, 0.044);
      parts.push(sp('oak', [x0, x1 - top + 0.004], [yBot, h - top + 0.004], [zBack, zFront]));
    } else {
      const doorT = 0.018;
      const frameT = 0.012;
      // Inset drawer fronts 2.8 cm behind z1 so round brass knobs sit flush within the desk depth.
      const zFrontFace = z1 - 0.028;
      const zCarcass = zFrontFace - doorT;
      const zSurround = zFrontFace + 0.003;
      const yDoorBot = yBot + frameT + 0.003;
      const yDoorTop = h - top - 0.004;
      const dyBend = Math.max(0, yDoorTop - (h - R));
      const rIn = R - top;
      const xBendInner = dyBend < rIn ? x1 - R + Math.sqrt(rIn * rIn - dyBend * dyBend) : x1 - top;
      const rightCheekInner = Math.min(x1 - top - frameT, xBendInner - 0.006);

      // Oak drawer box carcass + perimeter surround cheeks & bottom lip framing the inset drawers.
      parts.push(
        sp('oak', [x0, x1 - top + 0.004], [yBot, h - top + 0.004], [zBack, zCarcass]),
        sp('oak', [x0, x1 - top + 0.004], [yBot, yBot + frameT], [zCarcass, zSurround]),
        sp('oak', [x0, x0 + frameT], [yBot + frameT, h - top + 0.004], [zCarcass, zSurround]),
        sp('oak', [rightCheekInner, x1 - top + 0.004], [yBot + frameT, h - top - 0.006], [zCarcass, zSurround]),
      );

      // Two side-by-side drawers with two centered round brass knobs (1 drawer only on ultra-narrow <52 cm widths).
      const nD = w < 0.52 ? 1 : 2;
      const dx0 = x0 + frameT + 0.003;
      const dx1 = rightCheekInner - 0.003;
      const gap = 0.004;
      const cellW = (dx1 - dx0 - gap * (nD - 1)) / nD;
      const doorH = yDoorTop - yDoorBot;
      const frontBevel = Math.min(0.003, doorH * 0.2, (doorT - 0.002) * 0.3);
      const frontSlot = mode === 'oak-drawers' ? 'oak' : 'front';
      const kr = clamp(apronDrop * 0.08, 0.0085, 0.012);
      const ky = (yDoorBot + yDoorTop) / 2;

      for (const i of range(nD)) {
        const a = dx0 + i * (cellW + gap);
        parts.push(
          sp(frontSlot, [a, a + cellW], [yDoorBot, yDoorTop], [zCarcass + 0.002, zFrontFace], frontBevel),
          ...knob('knob', [a + cellW / 2, ky, zFrontFace - 0.002], kr),
        );
      }
    }
  }

  // Width-invariant round upholstered vanity stool with wooden legs tucked under the desk.
  const stoolStyle = mode === 'drawers' || mode === 'oak-drawers' ? 'legged' : mode === 'pouf-stool' ? 'pouf' : 'none';
  if (stoolStyle !== 'none') {
    const kx0 = x0 + 0.024;
    const kx1 = x1 - top - 0.024;
    const clearW = kx1 - kx0;
    const cx = (kx0 + kx1) / 2;
    const sr = Math.min(0.168, clearW * 0.43, d * 0.42);
    const cz = Math.min(0.02, z1 - sr - 0.012);
    const sh = clamp(yBot - 0.125, 0.24, 0.435);

    if (stoolStyle === 'legged') {
      const legH = sh * 0.41;
      const lr = clamp(sr * 0.088, 0.011, 0.015);
      // Solid oak under-seat frame ring
      parts.push(
        lathe(
          'oak',
          [cx, legH - 0.006, cz],
          [
            [0, 0],
            [sr * 0.82, 0],
            [sr * 0.85, 0.022],
            [0, 0.022],
          ],
          { segments: 24, plan: false },
        ),
      );
      // 4 splayed solid-oak legs + cross stretchers
      for (const k of range(4)) {
        const ang = Math.PI / 4 + (k * Math.PI) / 2;
        const cs = Math.cos(ang);
        const sn = Math.sin(ang);
        const bx = cx + cs * sr * 0.72;
        const bz = cz + sn * sr * 0.72;
        parts.push(
          rod('oak', [cx + cs * sr * 0.56, legH + 0.008, cz + sn * sr * 0.56], [bx, 0.011, bz], lr, { plan: false }),
          rod('oak', [bx, 0.001, bz], [bx, 0.013, bz], lr * 0.92, { plan: false }),
        );
      }
      const c45 = Math.SQRT1_2 * sr * 0.646;
      const yCross = legH * 0.46;
      parts.push(
        rod('oak', [cx - c45, yCross, cz - c45], [cx + c45, yCross, cz + c45], lr * 0.65, { plan: false }),
        rod('oak', [cx - c45, yCross + 0.003, cz + c45], [cx + c45, yCross + 0.003, cz - c45], lr * 0.65, { plan: false }),
      );
      // Plush double-tier upholstered round pouf seat (2 mm above oak ring to avoid coplanarity)
      const ySeat0 = legH + 0.018;
      const ch = sh - ySeat0;
      parts.push(
        lathe(
          'stool',
          [cx, ySeat0, cz],
          [
            [0, 0],
            [sr * 0.84, 0],
            [sr * 0.96, ch * 0.08],
            [sr, ch * 0.22],
            [sr * 0.97, ch * 0.36],
            [sr * 0.89, ch * 0.46],
            [sr * 0.97, ch * 0.57],
            [sr, ch * 0.72],
            [sr * 0.95, ch * 0.86],
            [sr * 0.82, ch * 0.95],
            [sr * 0.52, ch * 0.99],
            [0, ch],
          ],
          { segments: 28, plan: false },
        ),
      );
    } else {
      // 3-tier chubby stacked pouf on 4 turned solid-oak bun legs
      const bunH = Math.min(0.052, sh * 0.13);
      for (const k of range(4)) {
        const ang = Math.PI / 4 + (k * Math.PI) / 2;
        const bx = cx + Math.cos(ang) * sr * 0.6;
        const bz = cz + Math.sin(ang) * sr * 0.6;
        parts.push(
          lathe(
            'oak',
            [bx, 0.001, bz],
            [
              [0, 0],
              [0.016, 0],
              [0.024, bunH * 0.45],
              [0.021, bunH],
              [0, bunH],
            ],
            { segments: 14, plan: false },
          ),
        );
      }
      const yPouf0 = bunH + 0.003;
      const ph = sh - yPouf0;
      parts.push(
        lathe(
          'stool',
          [cx, yPouf0, cz],
          [
            [0, 0],
            [sr * 0.82, 0],
            [sr * 0.97, ph * 0.07],
            [sr, ph * 0.17],
            [sr * 0.96, ph * 0.26],
            [sr * 0.85, ph * 0.32],
            [sr * 0.96, ph * 0.39],
            [sr, ph * 0.49],
            [sr * 0.96, ph * 0.58],
            [sr * 0.85, ph * 0.64],
            [sr * 0.96, ph * 0.72],
            [sr, ph * 0.83],
            [sr * 0.93, ph * 0.92],
            [sr * 0.76, ph * 0.97],
            [sr * 0.45, ph * 0.995],
            [0, ph],
          ],
          { segments: 28, plan: false },
        ),
      );
    }
  }

  return parts;
}

function modularDeskPlan({ w, d, h }: Size3): PlanStroke[] {
  const top = clamp(h * 0.047, 0.028, 0.035);
  return [line([w / 2 - top, -d / 2], [w / 2 - top, d / 2])];
}

const modularDesk = defineItem({
  id: 'modular-waterfall-cabinet-desk',
  name: 'Modular curved-waterfall add-on desk',
  category: 'office',
  type: 'surfaces',
  group: 'Desks',
  description:
    'A standalone 35 mm oak add-on vanity/study desk with two white under-desk drawers with brass knobs, a round upholstered legged stool tucked underneath, a flat butt-joint end for pairing flush against any cabinet, and a curved waterfall leg.',
  tags: [
    'desk',
    'waterfall desk',
    'modular desk',
    'add-on desk',
    'cabinet desk',
    'return desk',
    'vanity desk',
    'drawers',
    'stool',
    'pouf',
    'bedroom',
    'study',
    'oak',
    'bàn ghép tủ',
    'bàn học',
    'bàn làm việc',
    'bàn trang điểm',
    'bàn nối tủ',
    'bàn có ngăn kéo',
    'ghế đôn',
  ],
  defaultSize: { w: 1.15, d: 0.55, h: 0.75 },
  minSize: { w: 0.45, d: 0.35, h: 0.42 },
  maxSize: { w: 2.5, d: 0.95, h: 1.15 },
  resizable: { w: true, d: true, h: true },
  wallSnap: true,
  price: { vnd: 3_900_000, estimate: true },
  slots: [
    matSlot('oak', 'Desk & stool legs', 'laminate-oak'),
    matSlot('front', 'Drawer fronts', 'laminate-white-matte'),
    matSlot('knob', 'Drawer knobs', 'metal-brass'),
    matSlot('stool', 'Stool upholstery', 'fabric-boucle'),
  ],
  build: (s) => buildModularDesk(s, 'drawers'),
  planDetail: modularDeskPlan,
  models: [
    { id: 'drawers', name: 'White drawers, knobs & legged stool' },
    { id: 'pouf-stool', name: 'With 3-tier pouf stool on bun legs', build: (s) => buildModularDesk(s, 'pouf-stool') },
    { id: 'oak-drawers', name: 'Oak drawers, knobs & legged stool', hide: ['front'], build: (s) => buildModularDesk(s, 'oak-drawers') },
    { id: 'no-stool', name: 'Drawers & knobs (no stool)', hide: ['stool'], build: (s) => buildModularDesk(s, 'no-stool') },
    { id: 'plain', name: 'Plain apron (no drawers or stool)', hide: ['front', 'knob', 'stool'], build: (s) => buildModularDesk(s, 'plain') },
    { id: 'slim', name: 'Slim top (no apron or stool)', hide: ['front', 'knob', 'stool'], build: (s) => buildModularDesk(s, 'slim') },
  ],
  variants: [
    { id: 'mustard-stool', name: 'Mustard velvet stool', materials: { stool: 'fabric-velvet-mustard' } },
    { id: 'oak-mustard', name: 'Light oak & mustard velvet', materials: { oak: 'wood-oak-light', front: 'wood-oak-light', stool: 'fabric-velvet-mustard' } },
    { id: 'light-oak', name: 'Light oak & oat bouclé', materials: { oak: 'wood-oak-light', stool: 'fabric-boucle-oat' } },
    { id: 'white-oak', name: 'White oak & blush velvet', materials: { oak: 'wood-white-oak', stool: 'fabric-velvet-blush' } },
    { id: 'walnut', name: 'Walnut & cream bouclé', materials: { oak: 'wood-walnut', stool: 'fabric-boucle' } },
    { id: 'smoked-oak', name: 'Smoked oak', materials: { oak: 'wood-smoked-oak', stool: 'fabric-boucle-oat' } },
    { id: 'shaker-cream', name: 'Cream lacquer', materials: { oak: 'shaker-cream', front: 'shaker-cream', stool: 'fabric-velvet-mustard' } },
    { id: 'warm-white', name: 'Warm white', materials: { oak: 'laminate-white-matte', front: 'laminate-white-matte', stool: 'fabric-boucle' } },
    { id: 'sage-green', name: 'Sage green', materials: { oak: 'laminate-sage', stool: 'fabric-boucle-sage' } },
  ],
});

// ── Standalone curved-waterfall bar table with 3-tier upper shelf hutch ──────────

function hutchTableGeo({ w, d, h }: Size3, params?: ParamValues) {
  const t = 0.018;
  const backT = 0.012;
  const rawTableH = typeof params?.tableHeight === 'number' ? params.tableHeight : 0.81;
  const tableH = clamp(rawTableH, 0.68, h - 0.48);
  const topT = clamp(tableH * 0.044, 0.028, 0.035);
  const R = clamp(Math.min(d * 0.12, tableH * 0.16), topT + 0.015, 0.08);
  const rawSd = typeof params?.shelfDepth === 'number' ? params.shelfDepth : 0.28;
  const sd = clamp(rawSd, 0.18, d - 0.32);

  const clearTotal = Math.max(0.3, h - tableH - 3 * t);
  const rawBay1 = typeof params?.bottomBayHeight === 'number' ? params.bottomBayHeight : 0.31;
  const bay1 = clamp(rawBay1, 0.1, clearTotal - 0.2);
  const rawBay2 = typeof params?.midBayHeight === 'number' ? params.midBayHeight : 0.29;
  const bay2 = clamp(rawBay2, 0.1, clearTotal - bay1 - 0.07);

  const yShelf1 = tableH + bay1;
  const yShelf2 = yShelf1 + t + bay2;
  const bay3 = Math.max(0.05, h - t - (yShelf2 + t));
  return { w, d, h, t, backT, tableH, topT, R, sd, bay1, bay2, bay3, yShelf1, yShelf2 };
}

const HUTCH_TABLE_PARAMS: AssetParam[] = [
  {
    id: 'tableHeight',
    label: 'Table height',
    kind: 'length',
    default: 0.81,
    min: 0.72,
    max: 1.02,
    step: 0.01,
    handle: (s, p) => {
      const g = hutchTableGeo(s, p);
      return { at: [0, g.tableH, s.d / 2 - 0.24], dir: [0, 1, 0] };
    },
  },
  {
    id: 'shelfDepth',
    label: 'Shelf depth',
    kind: 'length',
    default: 0.28,
    min: 0.2,
    max: 0.46,
    step: 0.01,
    handle: (s, p) => {
      const g = hutchTableGeo(s, p);
      return { at: [0, g.yShelf1 + g.t / 2, -s.d / 2 + g.sd], dir: [0, 0, 1] };
    },
  },
  {
    id: 'bottomBayHeight',
    label: 'Bottom bay height',
    kind: 'length',
    default: 0.31,
    min: 0.2,
    max: 0.46,
    step: 0.01,
    handle: (s, p) => {
      const g = hutchTableGeo(s, p);
      return { at: [-s.w * 0.16, g.yShelf1, -s.d / 2 + g.sd], dir: [0, 1, 0] };
    },
  },
  {
    id: 'midBayHeight',
    label: 'Middle bay height',
    kind: 'length',
    default: 0.29,
    min: 0.18,
    max: 0.44,
    step: 0.01,
    handle: (s, p) => {
      const g = hutchTableGeo(s, p);
      return { at: [s.w * 0.16, g.yShelf2, -s.d / 2 + g.sd], dir: [0, 1, 0] };
    },
  },
];

function buildWaterfallHutchTable(size: Size3, params?: ParamValues): Part[] {
  const g = hutchTableGeo(size, params);
  const { w, d, h, t, backT, tableH, topT, R, sd, yShelf1, yShelf2 } = g;
  const x0 = -w / 2;
  const x1 = w / 2;
  const z0 = -d / 2;
  const z1 = d / 2;
  const zf = z0 + sd;

  // Quarter-circle curved waterfall bend at the front (+z) end of the bar table.
  const seg = 24;
  const bend: V2[] = [];
  for (const i of range(seg + 1)) {
    const a = Math.PI / 2 - (i / seg) * (Math.PI / 2);
    bend.push([z1 - R + Math.cos(a) * R, tableH - R + Math.sin(a) * R]);
  }
  for (const i of range(seg + 1)) {
    const a = (i / seg) * (Math.PI / 2);
    bend.push([z1 - R + Math.cos(a) * (R - topT), tableH - R + Math.sin(a) * (R - topT)]);
  }

  return [
    // 1. Curved-waterfall bar table (curved front waterfall leg + straight square-cornered wall-end support leg under the hutch).
    span('oak', [x0, x1], [tableH - topT, tableH], [z0, z1 - R + 0.01], { bevel: 0.004 }),
    { ...sidePlate('oak', bend, x0, w), plan: undefined },
    sp('oak', [x0, x1], [0, tableH - R + 0.01], [z1 - topT, z1], 0.004),
    sp('oak', [x0, x1], [0, tableH - topT + 0.004], [z0, z0 + topT], 0.004),

    // 2. Three-compartment open shelf hutch standing on the wall end (-z) of the bar table.
    sp('oak', [x0, x0 + t], [tableH, h], [z0, zf], 0.002),
    sp('oak', [x1 - t, x1], [tableH, h], [z0, zf], 0.002),
    sp('oak', [x0 + t, x1 - t], [h - t, h], [z0, zf], 0.002),
    sp('oak', [x0 + t, x1 - t], [yShelf1, yShelf1 + t], [z0 + 0.017, zf - 0.003], 0.002),
    sp('oak', [x0 + t, x1 - t], [yShelf2, yShelf2 + t], [z0 + 0.017, zf - 0.003], 0.002),
    sp('back', [x0 + t + 0.001, x1 - t - 0.001], [tableH + 0.002, h - t - 0.001], [z0 + 0.003, z0 + 0.003 + backT]),
  ];
}

function waterfallHutchPlan(size: Size3, params?: ParamValues): PlanStroke[] {
  const { w, d, t, topT, sd } = hutchTableGeo(size, params);
  const z0 = -d / 2;
  const zf = z0 + sd;
  return [
    line([-w / 2, zf], [w / 2, zf]),
    line([-w / 2 + t, z0], [-w / 2 + t, zf]),
    line([w / 2 - t, z0], [w / 2 - t, zf]),
    line([-w / 2, d / 2 - topT], [w / 2, d / 2 - topT]),
  ];
}

const HUTCH_DECOR_SLOTS = [
  matSlot('glass', 'Dry-goods glass jars', 'glass-clear'),
  matSlot('lid', 'Acacia lids & tray', 'wood-acacia'),
  matSlot('grain', 'Oats & dry grains', 'fabric-boucle-oat'),
  matSlot('kraft', 'Kraft dry-food bag', 'leather-cognac'),
  matSlot('bean', 'Coffee beans & stems', 'leather-chocolate'),
  matSlot('ceramic', 'Cream ceramics & books', 'ceramic-cream'),
  matSlot('sage', 'Sage tea tin & vase', 'ceramic-sage'),
  matSlot('wicker', 'Woven pantry basket', 'wicker-fine'),
  matSlot('accent', 'Tabletop fruit', 'terracotta-pot'),
];

function dryGoodsJar(
  cx: number,
  cz: number,
  y0: number,
  r: number,
  jarH: number,
  fillSlot: 'grain' | 'bean' | 'kraft',
  fillFrac: number,
): Part[] {
  const lidH = clamp(jarH * 0.09, 0.01, 0.016);
  const fillTop = Math.max(y0 + 0.008, y0 + jarH * fillFrac);
  return [
    vcyl('glass', cx, cz, y0, y0 + jarH, r, { segments: 20, plan: false }),
    vcyl(fillSlot, cx, cz, y0 + 0.004, fillTop, Math.max(0.008, r - 0.004), { segments: 18, plan: false }),
    vcyl('lid', cx, cz, y0 + jarH + 0.001, y0 + jarH + 0.001 + lidH, r + 0.002, { segments: 20, plan: false }),
    vcyl('lid', cx, cz, y0 + jarH + 0.001 + lidH, y0 + jarH + 0.001 + lidH + 0.007, r * 0.28, { segments: 14, plan: false }),
  ];
}

function buildWaterfallHutchProps(size: Size3, params?: ParamValues): Part[] {
  const g = hutchTableGeo(size, params);
  const { w, d, t, tableH, R, sd, bay1, bay2, bay3, yShelf1, yShelf2 } = g;
  const innerW = Math.max(0.2, w - 2 * t);
  const zIn0 = -d / 2 + 0.022;
  const zIn1 = -d / 2 + sd - 0.01;
  const innerD = Math.max(0.12, zIn1 - zIn0);
  const zMid = (zIn0 + zIn1) / 2;
  const parts: Part[] = [];

  // ── 1. Middle compartment (ngăn giữa): glass dry-goods jars, kraft pouch & sage tea tin ──
  const yMid0 = yShelf1 + t + 0.0015;
  const rJar = clamp(innerW * 0.076, 0.021, 0.041);
  const zJarBack = zIn0 + rJar + 0.012;
  const zJarFront = Math.min(zIn1 - rJar - 0.006, zJarBack + innerD * 0.16);

  parts.push(
    ...dryGoodsJar(-innerW * 0.34, zJarBack, yMid0, rJar, clamp(bay2 * 0.68, 0.06, 0.195), 'grain', 0.76),
    ...dryGoodsJar(-innerW * 0.13, zJarFront, yMid0, rJar * 0.94, clamp(bay2 * 0.54, 0.052, 0.155), 'bean', 0.7),
    ...dryGoodsJar(innerW * 0.07, zJarBack + 0.006, yMid0, rJar * 1.03, clamp(bay2 * 0.42, 0.045, 0.12), 'kraft', 0.64),
  );

  // Stand-up kraft dry-goods pouch + round sage ceramic tea caddy on the right side of the middle shelf.
  const pouchW = clamp(innerW * 0.18, 0.054, 0.1);
  const pouchD = clamp(innerD * 0.28, 0.032, 0.054);
  const pouchH = clamp(bay2 * 0.62, 0.055, 0.175);
  const px = innerW * 0.3;
  const pz0 = zIn0 + 0.008;
  const pz1 = pz0 + pouchD;
  parts.push(
    sp('kraft', [px - pouchW / 2, px + pouchW / 2], [yMid0, yMid0 + pouchH * 0.88], [pz0, pz1], 0.006),
    sp('kraft', [px - pouchW * 0.48, px + pouchW * 0.48], [yMid0 + pouchH * 0.86, yMid0 + pouchH], [pz0 + pouchD * 0.32, pz1 - pouchD * 0.32], 0.002),
    sp(
      'ceramic',
      [px - pouchW * 0.32, px + pouchW * 0.32],
      [yMid0 + pouchH * 0.24, yMid0 + pouchH * 0.62],
      [pz1 + 0.001, pz1 + 0.0028],
    ),
  );

  const rTin = clamp(innerW * 0.058, 0.018, 0.032);
  const tinH = clamp(bay2 * 0.36, 0.04, 0.098);
  const tx = innerW * 0.33;
  const tz = Math.min(zIn1 - rTin - 0.006, pz1 + rTin + 0.018);
  if (tz - rTin > pz1 + 0.004) {
    parts.push(
      vcyl('sage', tx, tz, yMid0, yMid0 + tinH, rTin, { segments: 18, plan: false }),
      vcyl('lid', tx, tz, yMid0 + tinH + 0.001, yMid0 + tinH + 0.011, rTin + 0.0015, { segments: 18, plan: false }),
    );
  }

  // ── 2. Top compartment (ngăn trên): woven rattan basket, stacked cookbooks & sage bud vase ──
  const yTop0 = yShelf2 + t + 0.0015;
  const bskW = clamp(innerW * 0.37, 0.11, 0.21);
  const bskD = clamp(innerD * 0.68, 0.085, 0.185);
  const bskH = clamp(bay3 * 0.52, 0.028, 0.13);
  const bx = -innerW * 0.23;
  parts.push(
    sp('wicker', [bx - bskW / 2, bx + bskW / 2], [yTop0, yTop0 + bskH * 0.86], [zMid - bskD / 2, zMid + bskD / 2], 0.012),
    sp('wicker', [bx - bskW / 2 - 0.002, bx + bskW / 2 + 0.002], [yTop0 + bskH * 0.82, yTop0 + bskH], [zMid - bskD / 2 - 0.002, zMid + bskD / 2 + 0.002], 0.006),
  );

  const bkW = clamp(innerW * 0.32, 0.095, 0.175);
  const bkD = clamp(innerD * 0.62, 0.08, 0.165);
  const bkH = clamp(bay3 * 0.085, 0.006, 0.02);
  const rx = innerW * 0.23;
  const yBk1Top = yTop0 + bkH;
  const yBk2Bot = yBk1Top + 0.001;
  const yBk2Top = yBk2Bot + bkH * 0.92;
  const vaseY0 = yBk2Top + 0.0012;
  const vaseH = clamp(bay3 * 0.45, 0.022, 0.115);
  const vr = clamp(innerW * 0.058, 0.017, 0.032);
  parts.push(
    sp('ceramic', [rx - bkW / 2, rx + bkW / 2], [yTop0, yBk1Top], [zMid - bkD / 2, zMid + bkD / 2], 0.003),
    sp('kraft', [rx - bkW * 0.45, rx + bkW * 0.45], [yBk2Bot, yBk2Top], [zMid - bkD * 0.46, zMid + bkD * 0.46], 0.003),
    lathe(
      'sage',
      [rx, vaseY0, zMid],
      [
        [0, 0],
        [vr * 0.68, 0],
        [vr, vaseH * 0.32],
        [vr * 0.88, vaseH * 0.62],
        [vr * 0.42, vaseH * 0.84],
        [vr * 0.52, vaseH],
        [Math.max(0.004, vr * 0.38), vaseH],
      ],
      { segments: 20, plan: false },
    ),
  );

  // ── 3. Bottom compartment (ngăn dưới): compact bamboo tea tray with ceramic teapot & 2 cups ──
  const yBot0 = tableH + 0.0015;
  const trW = clamp(innerW * 0.42, 0.125, 0.23);
  const trD = clamp(innerD * 0.68, 0.085, 0.18);
  const trH = 0.012;
  const trx = innerW * 0.21;
  const yOnTray = yBot0 + trH + 0.0012;
  const potR = clamp(trW * 0.19, 0.022, 0.04);
  const potH = clamp(bay1 * 0.34, 0.042, 0.098);
  const cupR = clamp(trW * 0.11, 0.014, 0.024);
  const cupH = clamp(bay1 * 0.18, 0.026, 0.052);
  parts.push(
    sp('lid', [trx - trW / 2, trx + trW / 2], [yBot0, yBot0 + trH], [zMid - trD / 2, zMid + trD / 2], 0.003),
    lathe(
      'ceramic',
      [trx - trW * 0.18, yOnTray, zMid],
      [
        [0, 0],
        [potR * 0.72, 0],
        [potR, potH * 0.45],
        [potR * 0.76, potH * 0.88],
        [potR * 0.56, potH],
        [0, potH],
      ],
      { segments: 20, plan: false },
    ),
    vcyl('lid', trx - trW * 0.18, zMid, yOnTray + potH + 0.001, yOnTray + potH + 0.01, potR * 0.58, { segments: 16, plan: false }),
    vcyl('ceramic', trx + trW * 0.22, zMid - trD * 0.18, yOnTray, yOnTray + cupH, cupR, { rTop: cupR * 1.08, segments: 16, plan: false }),
    vcyl('ceramic', trx + trW * 0.22, zMid + trD * 0.2, yOnTray, yOnTray + cupH, cupR, { rTop: cupR * 1.08, segments: 16, plan: false }),
  );

  // ── 4. Open waterfall tabletop: shallow ceramic centerpiece bowl with 3 mandarins/persimmons ──
  const openZ0 = -d / 2 + sd + 0.08;
  const openZ1 = d / 2 - R - 0.06;
  if (openZ1 - openZ0 >= 0.22) {
    const bowlZ = openZ0 + (openZ1 - openZ0) * 0.48;
    const br = clamp(Math.min(w * 0.21, (openZ1 - openZ0) * 0.22), 0.055, 0.105);
    const bh = 0.032;
    const yb0 = tableH + 0.0015;
    const fr = clamp(br * 0.28, 0.016, 0.028);
    const fy = yb0 + 0.011 + fr * 0.78;
    parts.push(
      lathe(
        'ceramic',
        [0, yb0, bowlZ],
        [
          [0, 0],
          [br * 0.45, 0],
          [br * 0.52, bh * 0.22],
          [br * 0.88, bh * 0.62],
          [br, bh],
          [br * 0.91, bh],
          [br * 0.72, bh * 0.42],
          [0, bh * 0.3],
        ],
        { segments: 24, plan: false },
      ),
    );
    for (const [fx, fz] of [
      [-fr * 0.92, bowlZ - fr * 0.55],
      [fr * 0.96, bowlZ - fr * 0.42],
      [0.004, bowlZ + fr * 0.82],
    ] as V2[]) {
      parts.push(
        sphere('accent', [fx, fy, fz], fr, { scale: [1, 0.78, 1], plan: false }),
        vcyl('bean', fx, fz, fy + fr * 0.76, fy + fr * 0.76 + 0.005, 0.0022, { segments: 8, plan: false }),
      );
    }
  }

  return parts;
}

const waterfallBarHutchTable = defineItem({
  id: 'waterfall-bar-shelf-table',
  name: 'Curved-waterfall bar table with 3-tier shelf hutch',
  category: 'kitchen',
  type: 'surfaces',
  group: 'Dining tables',
  description:
    'A standalone 35 mm oak curved-waterfall breakfast bar and dining peninsula table with a straight wall-end support leg under an integrated 3-compartment open shelf hutch, available empty or styled with airtight dry-goods jars, tea canisters and tabletop ceramics.',
  tags: [
    'bar table',
    'breakfast bar',
    'peninsula table',
    'waterfall table',
    'dining table',
    'shelf hutch',
    '3-tier shelf',
    'pantry shelf',
    'dry goods',
    'oak',
    'bàn bar',
    'bàn đảo',
    'bàn ăn',
    'bàn kèm kệ',
    'kệ 3 ngăn',
    'bàn gỗ thác nước',
    'đồ khô',
  ],
  defaultSize: { w: 0.55, d: 1.35, h: 1.75 },
  minSize: { w: 0.38, d: 0.8, h: 1.35 },
  maxSize: { w: 1.0, d: 2.4, h: 2.65 },
  resizable: { w: true, d: true, h: true },
  wallSnap: true,
  price: { vnd: 6_500_000, estimate: true },
  slots: [
    matSlot('oak', 'Table & 3-tier shelf', 'laminate-oak'),
    matSlot('back', 'Shelf back panel', 'laminate-oak'),
  ],
  params: HUTCH_TABLE_PARAMS,
  build: buildWaterfallHutchTable,
  planDetail: waterfallHutchPlan,
  models: [
    {
      id: 'styled',
      name: 'With dry goods & decor',
      slots: HUTCH_DECOR_SLOTS,
      props: buildWaterfallHutchProps,
    },
    {
      id: 'empty',
      name: 'Empty',
    },
  ],
  variants: [
    { id: 'light-oak', name: 'Light oak', materials: { oak: 'wood-oak-light', back: 'wood-oak-light' } },
    { id: 'oak-cream-back', name: 'Oak & cream back', materials: { back: 'shaker-cream' } },
    { id: 'oak-sage-back', name: 'Oak & sage back', materials: { back: 'laminate-sage' } },
    { id: 'white-oak', name: 'White oak', materials: { oak: 'wood-white-oak', back: 'wood-white-oak' } },
    { id: 'walnut', name: 'Walnut', materials: { oak: 'wood-walnut', back: 'wood-walnut' } },
    { id: 'smoked-oak', name: 'Smoked oak', materials: { oak: 'wood-smoked-oak', back: 'wood-smoked-oak' } },
    { id: 'shaker-cream', name: 'Cream lacquer', materials: { oak: 'shaker-cream', back: 'shaker-cream' } },
    { id: 'warm-white', name: 'Warm white', materials: { oak: 'laminate-white-matte', back: 'laminate-white-matte' } },
  ],
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
  version: '1.3.0',
  author: 'Neest team',
  description:
    'Built-in bedroom wall: oak shelf tower and study desk, white shaker wardrobe, rounded corner niche, standalone modular waterfall add-on desk and curved-waterfall bar table with 3-tier shelf hutch.',
  license: 'CC0 (made for Neest)',
  items: [studyWall, towerWall, modularDesk, waterfallBarHutchTable],
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

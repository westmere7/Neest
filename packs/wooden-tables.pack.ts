/**
 * Wooden tables & desks — solid-wood pieces with real joinery: a live-edge walnut slab dining table
 * with butterfly keys on black steel trapezoid legs, a monkey-pod (me tây) slab coffee table on
 * hairpins, an oak gateleg drop-leaf table (one leaf up on its swung-out gate, one hanging), a
 * carpenter's workbench with a face vise and a tool rack, a mahogany writing bureau with its
 * fall-front open, an Indochine rosewood tea table with mother-of-pearl inlay, a wine-barrel side
 * table, a teak tea trolley on spoked wheels, a sawhorse trestle desk, a tripod tray-top table and
 * an extendable oak dining table with its centre leaf in.
 */
import {
  arcPoints,
  box,
  circle,
  clamp,
  cyl,
  defineItem,
  definePack,
  discZ,
  knob,
  lathe,
  line,
  matSlot,
  prism,
  range,
  rectPoly,
  rng,
  rod,
  rodPath,
  rodX,
  rodZ,
  span,
  sphere,
  torus,
  turnedLeg,
  vcyl,
  type Part,
  type V2,
  type V3,
} from '@/packs/kit';

const TAU = Math.PI * 2;

// ── Shared helpers ───────────────────────────────────────────────────────────

/** Detail box (hidden from the plan) spanning x/y/z ranges, with an optional bevel. */
const sp = (slot: string, x: V2, y: V2, z: V2, bevel = 0): Part => span(slot, x, y, z, { bevel, plan: false });

/** A flat shape seen from the front: `pts` are [x, y], extruded `t` along +z from z. */
function facePlate(slot: string, pts: V2[], z: number, t: number, plan = false): Part {
  const ys = pts.map((p) => p[1]);
  const xs = pts.map((p) => p[0]);
  const mid = (Math.min(...ys) + Math.max(...ys)) / 2;
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const part: Part = {
    shape: 'prism',
    outline: pts.map(([x, y]) => [x - cx, -(y - mid)] as V2),
    height: t,
    position: [cx, mid, z],
    rotation: [Math.PI / 2, 0, 0],
    slot,
  };
  if (!plan) part.plan = false;
  return part;
}

/** A flat shape seen from the side: `pts` are [z, y], extruded `t` along +x from x. */
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

/** A square-section board from a to b (its long axis), `sx` × `sz` in cross-section. */
function beam(slot: string, a: V3, b: V3, sx: number, sz: number, plan = false): Part {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz);
  const rx = Math.atan2(dz / len, dy / len);
  const rz = Math.atan2(-dx / len, Math.hypot(dy, dz) / len);
  return box(slot, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], [sx, len, sz], { rotation: [rx, 0, rz], plan });
}

type M3 = number[]; // row-major 3 × 3
const mat3 = (a: M3, b: M3): M3 =>
  range(9).map((i) => {
    const r = Math.floor(i / 3);
    const c = i % 3;
    return a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
  });
const rotX = (t: number): M3 => [1, 0, 0, 0, Math.cos(t), -Math.sin(t), 0, Math.sin(t), Math.cos(t)];
const rotY = (t: number): M3 => [Math.cos(t), 0, Math.sin(t), 0, 1, 0, -Math.sin(t), 0, Math.cos(t)];
/** Euler angles (three.js 'XYZ' order, the order parts use) for a rotation matrix. */
function eulerXYZ(m: M3): V3 {
  const y = Math.asin(clamp(m[2], -1, 1));
  if (Math.abs(m[2]) < 0.9999999) return [Math.atan2(-m[5], m[8]), y, Math.atan2(-m[1], m[0])];
  return [Math.atan2(m[7], m[4]), y, 0];
}

/**
 * Smooth deterministic wobble in [0, 1] over t. With `periodic` the frequencies are whole numbers,
 * so w(0) = w(1) and closed outlines join up.
 */
function wobble(seed: number, terms = 5, periodic = false): (t: number) => number {
  const r = rng(seed);
  const ws = range(terms).map((i) => ({ f: periodic ? 1 + i : 0.8 + i * 1.3 + r() * 0.9, p: r() * TAU, a: 1 / (1 + i * 0.7) }));
  const sum = ws.reduce((s, q) => s + q.a, 0);
  return (t) => 0.5 + (0.5 * ws.reduce((s, q) => s + q.a * Math.sin(q.f * TAU * t + q.p), 0)) / sum;
}

/** Bow-tie (butterfly key) outline centred at (cx, cz), long axis along z. */
function bowTie(cx: number, cz: number, len: number, wid: number): V2[] {
  const hl = len / 2;
  const hw = wid / 2;
  const wn = wid * 0.2;
  return [
    [cx - hw, cz - hl],
    [cx + hw, cz - hl],
    [cx + wn, cz],
    [cx + hw, cz + hl],
    [cx - hw, cz + hl],
    [cx - wn, cz],
  ];
}

/** A crack filled with black epoxy, running in from (x0, z0) along -x for `len`, tapering. */
function crackOutline(x0: number, z0: number, len: number, width: number, seed: number): { pts: V2[]; mid: (t: number) => number } {
  const r = rng(seed);
  const ph = r() * TAU;
  const mid = (t: number) => z0 + 0.012 * Math.sin(t * 5.3 + ph) + 0.006 * Math.sin(t * 11 + ph * 2);
  const n = 10;
  const top: V2[] = [];
  const bot: V2[] = [];
  for (const i of range(n + 1)) {
    const t = i / n;
    const half = (width / 2) * (1 - t * 0.85) + 0.0004;
    top.push([x0 - len * t, mid(t) + half]);
    bot.push([x0 - len * t, mid(t) - half]);
  }
  return { pts: [...top, ...bot.reverse()], mid };
}

// ── 1. Live-edge walnut slab dining table ────────────────────────────────────

/** Slab with sawn ends at ±w/2 and natural edges inset up to `m` from ±d/2; `extra` shrinks the edges. */
function slabOutline(w: number, d: number, m: number, seed: number, extra = 0, n = 36): V2[] {
  const f = wobble(seed, 6);
  const b = wobble(seed + 101, 6);
  const front: V2[] = [];
  const back: V2[] = [];
  for (const i of range(n + 1)) {
    const t = i / n;
    const x = -w / 2 + w * t;
    // The tree tapers a little towards one end; the edges meander on top of that.
    front.push([x, d / 2 - m * (0.1 + 0.62 * f(t) + 0.28 * t) - extra]);
    back.push([x, -d / 2 + m * (0.1 + 0.7 * b(t) + 0.2 * t) + extra]);
  }
  return [...front, ...back.reverse()];
}

/** Black steel trapezoid leg frame in the z/y plane at x: narrow top rail, wide foot. */
function trapezoidFrame(slot: string, x: number, yTop: number, zt: number, zb: number, tx: number, tz: number): Part[] {
  const glide = 0.008;
  const parts: Part[] = [
    sp(slot, [x - tx / 2, x + tx / 2], [yTop - tz, yTop], [-zt, zt]),
    sp(slot, [x - tx / 2, x + tx / 2], [glide, glide + tz], [-zb, zb]),
  ];
  for (const s of [-1, 1]) {
    parts.push(beam(slot, [x, glide + tz / 2, s * (zb - tz / 2)], [x, yTop - tz / 2, s * (zt - tz / 2)], tx, tz));
    parts.push(vcyl(slot, x, s * (zb - 0.04), 0, glide, 0.013, { plan: false }));
  }
  return parts;
}

const slabDining = defineItem({
  id: 'walnut-slab-dining-table',
  name: 'Live-edge walnut slab dining table',
  category: 'dining',
  type: 'surfaces',
  group: 'Dining tables',
  tags: ['live edge', 'slab', 'walnut', 'butterfly key', 'bow tie', 'trapezoid legs', 'steel', 'industrial', 'dining table', 'bàn gỗ nguyên tấm', 'bàn ăn', 'vietnamese'],
  defaultSize: { w: 2.2, d: 0.95, h: 0.76 },
  minSize: { w: 1.4, d: 0.75, h: 0.72 },
  maxSize: { w: 3.2, d: 1.15, h: 0.78 },
  slots: [
    matSlot('slab', 'Walnut slab', 'walnut-slab'),
    matSlot('steel', 'Trapezoid legs', 'metal-black-matte'),
    matSlot('keys', 'Butterfly keys', 'maple-key'),
    matSlot('resin', 'Epoxy-filled crack', 'black-epoxy'),
  ],
  build: ({ w, d, h }) => {
    const t = 0.055;
    const m = clamp(d * 0.07, 0.04, 0.075);
    const parts: Part[] = [
      // Top two thirds of the slab carry the live edge; the underside is undercut like a real log.
      prism('slab', slabOutline(w, d, m, 11), h - t * 0.62, t * 0.62),
      prism('slab', slabOutline(w, d, m, 11, 0.014), h - t, t * 0.38 + 0.001, { plan: false }),
    ];
    // A check (crack) running in from the right end, stabilised with black epoxy and two keys.
    const cl = Math.min(0.5, w * 0.22);
    const zc = -d * 0.06;
    const crack = crackOutline(w / 2, zc, cl, 0.007, 5);
    parts.push(prism('resin', crack.pts, h - 0.006, 0.0063, { plan: false }));
    for (const tk of [0.22, 0.62]) {
      parts.push(prism('keys', bowTie(w / 2 - cl * tk, crack.mid(tk), 0.11, 0.05), h - 0.005, 0.0055, { plan: false }));
    }
    // A second, smaller key across a short check near the left end.
    parts.push(prism('keys', bowTie(-w / 2 + 0.16, d * 0.12, 0.09, 0.042), h - 0.005, 0.0055, { plan: false }));
    // Steel flat-bar battens let into the underside keep the slab flat.
    for (const sx of [-1, 1]) {
      parts.push(sp('steel', [sx * w * 0.2 - 0.025, sx * w * 0.2 + 0.025], [h - t - 0.008, h - t + 0.001], [-(d / 2 - m - 0.07), d / 2 - m - 0.07]));
    }
    // Trapezoid legs.
    const xl = w / 2 - clamp(w * 0.11, 0.18, 0.32);
    const zt = d / 2 - m - 0.08;
    const zb = d / 2 - 0.035;
    for (const sx of [-1, 1]) parts.push(...trapezoidFrame('steel', sx * xl, h - t, zt, zb, 0.07, 0.04));
    return parts;
  },
});

// ── 2. Live-edge monkey-pod slab coffee table on hairpins ────────────────────

/** Whole-slab outline: a rounded rectangle whose edge wanders inward by up to `amp` of its radius. */
function cookieOutline(a: number, b: number, amp: number, seed: number, shrink = 0, n = 64): V2[] {
  const f = wobble(seed, 6, true);
  const pw = 2 / 3.2;
  return range(n).map((i) => {
    const phi = (i / n) * TAU;
    const c = Math.cos(phi);
    const s = Math.sin(phi);
    const k = 1 - amp * f(i / n) - shrink;
    return [a * k * Math.sign(c) * Math.pow(Math.abs(c), pw), b * k * Math.sign(s) * Math.pow(Math.abs(s), pw)] as V2;
  });
}

/** Two-prong hairpin leg from a plate under the top down to a U-bend on the floor. */
function hairpin(slot: string, x: number, z: number, yTop: number, sx: number, sz: number): Part[] {
  const xb = x + sx * 0.035;
  const zb = z + sz * 0.035;
  const ux = 0.7071;
  const uz = 0.7071 * sz * sx;
  const P = (o: number, y: number, bx: number, bz: number): V3 => [bx + o * ux, y, bz + o * uz];
  const pts: V3[] = [
    P(-0.045, yTop - 0.006, x, z),
    P(-0.013, 0.03, xb, zb),
    P(-0.009, 0.013, xb, zb),
    P(0, 0.006, xb, zb),
    P(0.009, 0.013, xb, zb),
    P(0.013, 0.03, xb, zb),
    P(0.045, yTop - 0.006, x, z),
  ];
  return [...rodPath(slot, pts, 0.0055), sp(slot, [x - 0.05, x + 0.05], [yTop - 0.006, yTop], [z - 0.05, z + 0.05])];
}

const slabCoffee = defineItem({
  id: 'monkey-pod-slab-coffee-table',
  name: 'Live-edge monkey-pod coffee table',
  category: 'living',
  type: 'surfaces',
  group: 'Coffee tables',
  tags: ['live edge', 'slab', 'monkey pod', 'suar', 'acacia', 'hairpin legs', 'coffee table', 'organic', 'bàn trà', 'gỗ me tây', 'me tây nguyên tấm', 'vietnamese'],
  defaultSize: { w: 1.3, d: 0.72, h: 0.42 },
  minSize: { w: 0.9, d: 0.5, h: 0.35 },
  maxSize: { w: 1.8, d: 1.0, h: 0.48 },
  slots: [
    matSlot('slab', 'Slab', 'monkey-pod'),
    matSlot('steel', 'Hairpin legs', 'metal-black-matte'),
    matSlot('resin', 'Epoxy & bark inclusion', 'black-epoxy'),
  ],
  build: ({ w, d, h }) => {
    const t = 0.06;
    const a = w / 2;
    const b = d / 2;
    const parts: Part[] = [
      prism('slab', cookieOutline(a, b, 0.09, 23), h - t * 0.6, t * 0.6),
      prism('slab', cookieOutline(a, b, 0.09, 23, 0.035), h - t, t * 0.4 + 0.001, { plan: false }),
    ];
    // A bark inclusion near the back edge, filled flush with black epoxy.
    const ib = rng(7);
    const inc: V2[] = range(14).map((i) => {
      const ang = (i / 14) * TAU;
      const rr = 1 + (ib() - 0.5) * 0.5;
      return [-a * 0.42 + Math.cos(ang) * 0.05 * rr, -b * 0.6 + Math.sin(ang) * 0.014 * rr] as V2;
    });
    parts.push(prism('resin', inc, h - 0.004, 0.0044, { plan: false }));
    // A short end check with an epoxy fill and a bow-tie key of the same wood.
    const crack = crackOutline(a * 0.86, 0.02 * b, Math.min(0.2, a * 0.3), 0.005, 9);
    parts.push(prism('resin', crack.pts, h - 0.005, 0.0053, { plan: false }));
    parts.push(prism('slab', bowTie(a * 0.86 - Math.min(0.2, a * 0.3) * 0.4, crack.mid(0.4), 0.08, 0.036), h - 0.004, 0.0046, { plan: false }));
    // Hairpins, splayed out towards the corners.
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) parts.push(...hairpin('steel', sx * a * 0.66, sz * b * 0.52, h - t, sx, sz));
    }
    return parts;
  },
});

// ── 3. Gateleg drop-leaf table ───────────────────────────────────────────────

/** Gateleg layout: an oval top, the bed between two leaves; the back leaf hangs, the front is up. */
function gatelegLayout(w: number, d: number, h: number) {
  const tT = 0.022;
  const avail = d - tT - 0.006;
  const L = Math.min(avail * 0.55, h - 0.28);
  const Db = avail - L;
  const zb0 = -d / 2 + tT + 0.006;
  const zb1 = zb0 + Db;
  const zc = (zb0 + zb1) / 2;
  const rx = w / 2;
  const rz = Db / 2 + L;
  const phi0 = Math.asin(Db / 2 / rz);
  const phi1 = Math.asin((Db / 2 + 0.002) / rz);
  const E = (phi: number): V2 => [rx * Math.cos(phi), zc + rz * Math.sin(phi)];
  return { tT, L, Db, zb0, zb1, zc, rx, rz, phi0, phi1, E };
}

const gateleg = defineItem({
  id: 'gateleg-drop-leaf-table',
  name: 'Gateleg drop-leaf table',
  category: 'dining',
  type: 'surfaces',
  group: 'Dining tables',
  tags: ['gateleg', 'gate leg', 'drop leaf', 'oval', 'turned legs', 'oak', 'antique', 'folding table', 'small space', 'bàn gấp', 'bàn ăn gấp cánh'],
  defaultSize: { w: 1.1, d: 1.0, h: 0.74 },
  minSize: { w: 0.7, d: 0.7, h: 0.7 },
  maxSize: { w: 1.6, d: 1.3, h: 0.78 },
  slots: [
    matSlot('top', 'Top & leaves', 'aged-oak'),
    matSlot('wood', 'Legs, gates & frame', 'aged-oak'),
    matSlot('brass', 'Drawer knob', 'metal-brass'),
  ],
  build: ({ w, d, h }) => {
    const { tT, L, Db, zb0, zb1, rx, phi0, phi1, E, rz } = gatelegLayout(w, d, h);
    const yU = h - tT;
    const parts: Part[] = [];
    // Bed (fixed centre) and the raised front leaf.
    const bed: V2[] = [...range(11).map((i) => E(-phi0 + (2 * phi0 * i) / 10)), ...range(11).map((i) => E(Math.PI - phi0 + (2 * phi0 * i) / 10))];
    parts.push(prism('top', bed, yU, tT));
    parts.push(prism('top', range(25).map((i) => E(phi1 + ((Math.PI - 2 * phi1) * i) / 24)), yU, tT));
    // The back leaf hangs straight down from its rule joint.
    const hang: V2[] = range(25).map((i) => {
      const phi = phi1 + ((Math.PI - 2 * phi1) * i) / 24;
      return [rx * Math.cos(phi), h - (rz * Math.sin(phi) - Db / 2)] as V2;
    });
    parts.push(facePlate('top', hang, zb0 - tT - 0.003, tT, true));

    // Frame: four turned legs, aprons, low turned stretchers.
    const hw = rx * Math.cos(phi0);
    const xl = hw - 0.06;
    const zlb = zb0 + 0.045;
    const zlf = zb1 - 0.045;
    const r = 0.024;
    for (const x of [-xl, xl]) for (const z of [zlb, zlf]) parts.push(turnedLeg('wood', x, z, 0, yU, r, { style: 'spindle' }));
    const ay: V2 = [yU - 0.1, yU];
    parts.push(sp('wood', [-xl, xl], ay, [zlb - 0.01, zlb + 0.01]), sp('wood', [-xl, xl], ay, [zlf - 0.01, zlf + 0.01]));
    parts.push(sp('wood', [-xl - 0.01, -xl + 0.01], ay, [zlb, zlf]), sp('wood', [xl - 0.01, xl + 0.01], ay, [zlb, zlf]));
    // End drawer with a brass knob.
    const zm = (zlb + zlf) / 2;
    const dw = Math.max(0.08, zlf - zlb - 0.1);
    parts.push(sp('wood', [xl + 0.01, xl + 0.022], [yU - 0.085, yU - 0.015], [zm - dw / 2, zm + dw / 2], 0.003));
    parts.push(rod('brass', [xl + 0.022, yU - 0.05, zm], [xl + 0.032, yU - 0.05, zm], 0.005, { plan: false }));
    parts.push(sphere('brass', [xl + 0.04, yU - 0.05, zm], 0.011, { scale: [0.7, 1, 1], plan: false }));
    const ys = 0.1;
    for (const z of [zlb, zlf]) {
      parts.push(rodX('wood', -xl, xl, ys, z, 0.013, { plan: false }));
      parts.push(sphere('wood', [-xl * 0.5, ys, z], 0.019, { scale: [1.5, 1, 1], plan: false }));
      parts.push(sphere('wood', [xl * 0.5, ys, z], 0.019, { scale: [1.5, 1, 1], plan: false }));
    }
    for (const x of [-xl, xl]) parts.push(rodZ('wood', x, ys, zlb, zlf, 0.013, { plan: false }));

    // Front gate swung out under the raised leaf: pivot stile, rails and a turned gate leg.
    const Lg = Math.min(L * 0.62, 0.42);
    parts.push(rod('wood', [0, ys, zlf], [0, yU - 0.1, zlf], 0.016, { plan: false }));
    parts.push(turnedLeg('wood', 0, zlf + Lg, 0, yU, r * 0.92, { style: 'spindle' }));
    parts.push(sp('wood', [-0.012, 0.012], [yU - 0.09, yU - 0.05], [zlf, zlf + Lg]));
    parts.push(sp('wood', [-0.012, 0.012], [ys - 0.015, ys + 0.015], [zlf, zlf + Lg]));
    // Back gate folded flat into the frame line.
    const Lb = Math.min(Lg, xl - 0.08);
    parts.push(rod('wood', [0, ys, zlb + 0.022], [0, yU - 0.1, zlb + 0.022], 0.016, { plan: false }));
    parts.push(turnedLeg('wood', -Lb, zlb + 0.022, 0, yU - 0.1, r * 0.92, { style: 'spindle' }));
    parts.push(sp('wood', [-Lb, 0], [yU - 0.16, yU - 0.12], [zlb + 0.01, zlb + 0.034]));
    parts.push(sp('wood', [-Lb, 0], [ys + 0.02, ys + 0.05], [zlb + 0.01, zlb + 0.034]));
    // Knuckle hinges where the leaves meet the bed.
    for (const x of [-hw * 0.5, hw * 0.5]) {
      parts.push(sp('brass', [x - 0.03, x + 0.03], [yU - 0.003, yU], [zb1 - 0.02, zb1 + 0.02]));
      parts.push(sp('brass', [x - 0.03, x + 0.03], [yU - 0.04, yU], [zb0 - 0.003, zb0]));
    }
    return parts;
  },
  planDetail: ({ w, d, h }) => {
    const { zb1, zb0, phi0, rx } = gatelegLayout(w, d, h);
    const hw = rx * Math.cos(phi0);
    return [line([-hw, zb1], [hw, zb1]), line([-hw, zb0], [hw, zb0])];
  },
});

// ── 4. Carpenter's workbench ─────────────────────────────────────────────────

const workbench = defineItem({
  id: 'carpenters-workbench',
  name: "Carpenter's workbench with tool rack",
  category: 'hobbies',
  type: 'activities',
  group: 'Creative',
  tags: ['workbench', 'woodworking', 'carpenter', 'joiner', 'vise', 'vice', 'tool rack', 'chisels', 'saw', 'plane', 'garage', 'workshop', 'bàn mộc', 'bàn thợ mộc'],
  defaultSize: { w: 1.8, d: 0.8, h: 1.6 },
  minSize: { w: 1.3, d: 0.65, h: 1.3 },
  maxSize: { w: 2.4, d: 0.95, h: 2.0 },
  slots: [
    matSlot('top', 'Bench top & chop', 'beech-block'),
    matSlot('frame', 'Base & rack', 'aged-oak'),
    matSlot('metal', 'Vise screw & blades', 'metal-brushed-steel'),
    matSlot('accent', 'Handles & dog holes', 'wood-dark-stain'),
  ],
  build: ({ w, d, h }) => {
    const th = clamp(h - 0.7, 0.72, 0.9);
    const tt = 0.07;
    const x0 = -w / 2;
    const x1 = w / 2;
    const zb = -d / 2;
    const zf = d / 2 - 0.09; // front edge of the top (the vise sits proud of it)
    const zt0 = zb + 0.045; // back edge of the top (rack posts behind it)
    const parts: Part[] = [];

    // Laminated top with a deep front apron.
    parts.push(span('top', [x0, x1], [th - tt, th], [zt0, zf], { bevel: 0.004 }));
    parts.push(sp('top', [x0, x1], [th - 0.22, th - tt], [zf - 0.04, zf], 0.003));

    // Base: legs on sole feet, wedged through-tenoned stretchers, end rails and a slatted shelf.
    const ls = 0.085;
    const xl = w / 2 - 0.2;
    const zlb = zt0 + 0.1;
    const zlf = zf - 0.1;
    for (const sx of [-1, 1]) {
      const x = sx * xl;
      parts.push(sp('frame', [x - ls / 2 - 0.005, x + ls / 2 + 0.005], [0, 0.08], [zlb - 0.1, zlf + 0.1], 0.006));
      for (const z of [zlb, zlf]) parts.push(sp('frame', [x - ls / 2, x + ls / 2], [0.08, th - tt], [z - ls / 2, z + ls / 2], 0.003));
      parts.push(sp('frame', [x - 0.025, x + 0.025], [th - tt - 0.11, th - tt], [zlb, zlf]));
      parts.push(sp('frame', [x - 0.025, x + 0.025], [0.14, 0.22], [zlb, zlf]));
    }
    const yS: V2 = [0.25, 0.32];
    for (const z of [zlb, zlf]) {
      parts.push(sp('frame', [-xl, xl], yS, [z - 0.022, z + 0.022]));
      for (const sx of [-1, 1]) {
        const xo = sx * (xl + ls / 2);
        const xe = xo + sx * 0.026;
        parts.push(sp('frame', [Math.min(xo, xe), Math.max(xo, xe)], [yS[0] + 0.012, yS[1] - 0.012], [z - 0.012, z + 0.012]));
        parts.push(sp('accent', [Math.min(xo, xe) + 0.001, Math.max(xo, xe) + 0.0005], [yS[0] + 0.014, yS[1] - 0.014], [z - 0.0025, z + 0.0025]));
      }
    }
    const nShelf = clamp(Math.round((zlf - zlb - ls) / 0.11), 3, 6);
    const sw = (zlf - zlb - ls) / nShelf;
    for (const i of range(nShelf)) {
      const z = zlb + ls / 2 + i * sw;
      parts.push(sp('frame', [-xl + ls / 2, xl - ls / 2], [0.22, 0.238], [z + 0.003, z + sw - 0.003], 0.002));
    }

    // Face vise on the front left: chop, steel screw, hub, tommy bar and guide bars.
    const cx = x0 + 0.24;
    const vy = th - 0.1;
    parts.push(span('top', [cx - 0.2, cx + 0.2], [th - 0.22, th], [zf, zf + 0.05], { bevel: 0.004 }));
    parts.push(rodZ('metal', cx, vy, zf - 0.04, zf + 0.085, 0.014, { plan: false }));
    parts.push(rodZ('metal', cx, vy, zf + 0.05, zf + 0.078, 0.028, { plan: false }));
    parts.push(rodX('accent', cx - 0.16, cx + 0.16, vy, zf + 0.068, 0.011, { plan: false }));
    for (const s of [-1, 1]) {
      parts.push(sphere('accent', [cx + s * 0.165, vy, zf + 0.068], 0.017, { plan: false }));
      parts.push(rodZ('metal', cx + s * 0.15, th - 0.17, zf - 0.03, zf + 0.06, 0.01, { plan: false }));
    }
    // Dog holes along the front edge, one in the chop, and a brass dog raised in it.
    parts.push(vcyl('accent', cx + 0.1, zf + 0.025, th - 0.002, th + 0.0006, 0.01, { plan: false }));
    parts.push(sp('metal', [cx + 0.09, cx + 0.11], [th - 0.01, th + 0.025], [zf + 0.015, zf + 0.035]));
    for (let x = x0 + 0.55; x < x1 - 0.06; x += 0.14) parts.push(vcyl('accent', x, zf - 0.045, th - 0.002, th + 0.0006, 0.01, { plan: false }));

    // Tool rack: two posts bolted to the back edge, a back board, a top shelf on brackets.
    for (const [xa, xb] of [
      [x0, x0 + 0.05],
      [x1 - 0.05, x1],
    ] as V2[]) {
      parts.push(span('frame', [xa, xb], [th - 0.16, h - 0.025], [zb, zt0]));
      parts.push(sidePlate('frame', [[zt0, h - 0.025], [zb + 0.17, h - 0.025], [zt0, h - 0.14]], (xa + xb) / 2 - 0.015, 0.03));
    }
    parts.push(sp('frame', [x0 + 0.05, x1 - 0.05], [th, h - 0.025], [zb + 0.008, zb + 0.026]));
    parts.push(span('frame', [x0, x1], [h - 0.025, h], [zb, zb + 0.17], { bevel: 0.003 }));
    const zr = zb + 0.043; // tools hang in front of the board
    const yr = th + clamp((h - th) * 0.55, 0.2, 0.5);
    // Chisel rail with five chisels.
    parts.push(sp('frame', [x0 + 0.08, x0 + 0.38], [yr - 0.03, yr], [zb + 0.026, zb + 0.06], 0.003));
    for (const i of range(5)) {
      const x = x0 + 0.12 + i * 0.055;
      const bw = 0.006 + i * 0.003;
      parts.push(vcyl('accent', x, zr, yr, yr + 0.1, 0.012, { rTop: 0.014, plan: false }));
      parts.push(sp('metal', [x - bw, x + bw], [yr - 0.13 - i * 0.008, yr], [zr - 0.003, zr + 0.003]));
    }
    // Claw hammer hanging on two pegs.
    const xm = x0 + 0.5;
    parts.push(rod('accent', [xm, yr - 0.27, zr], [xm, yr, zr], 0.012, { plan: false }));
    parts.push(sp('metal', [xm - 0.055, xm + 0.05], [yr, yr + 0.03], [zr - 0.012, zr + 0.012]));
    for (const s of [-1, 1]) parts.push(rodZ('accent', xm + s * 0.022, yr - 0.006, zb + 0.026, zb + 0.065, 0.006, { plan: false }));
    // Try square on a peg (top right) and a handsaw on two pegs (bottom right).
    parts.push(sp('accent', [x1 - 0.32, x1 - 0.12], [yr + 0.05, yr + 0.075], [zr - 0.01, zr + 0.01]));
    parts.push(sp('metal', [x1 - 0.145, x1 - 0.12], [yr - 0.1, yr + 0.05], [zr - 0.002, zr + 0.002]));
    parts.push(rodZ('accent', x1 - 0.3, yr + 0.085, zb + 0.026, zb + 0.065, 0.006, { plan: false }));
    const xh = x1 - 0.55;
    const yc = th + 0.12;
    parts.push(
      facePlate(
        'metal',
        [
          [xh, yc - 0.06],
          [xh + 0.45, yc - 0.06],
          [xh + 0.45, yc - 0.005],
          [xh, yc + 0.06],
        ],
        zr - 0.001,
        0.002,
      ),
    );
    parts.push(sp('accent', [xh - 0.1, xh + 0.01], [yc - 0.055, yc + 0.065], [zr - 0.011, zr + 0.011], 0.012));
    parts.push(rodZ('accent', xh - 0.045, yc + 0.03, zb + 0.026, zb + 0.065, 0.006, { plan: false }));
    parts.push(rodZ('accent', xh + 0.38, yc - 0.068, zb + 0.026, zb + 0.065, 0.006, { plan: false }));

    // On the bench: a wooden jack plane and a joiner's mallet.
    const px = x1 - 0.45;
    const pz = zf - 0.2;
    parts.push(sp('top', [px - 0.13, px + 0.13], [th, th + 0.055], [pz - 0.03, pz + 0.03], 0.008));
    parts.push(box('metal', [px + 0.01, th + 0.07, pz], [0.005, 0.06, 0.046], { rotation: [0, 0, 0.8], plan: false }));
    parts.push(box('frame', [px + 0.025, th + 0.07, pz], [0.012, 0.05, 0.03], { rotation: [0, 0, 0.8], plan: false }));
    parts.push(rod('accent', [px - 0.07, th + 0.05, pz], [px - 0.1, th + 0.115, pz], 0.012, { plan: false }));
    parts.push(sphere('accent', [px + 0.085, th + 0.065, pz], 0.016, { plan: false }));
    const mx = x0 + 0.68;
    const mz = zf - 0.32;
    parts.push(sp('top', [mx - 0.065, mx + 0.065], [th, th + 0.075], [mz - 0.04, mz + 0.04], 0.006));
    parts.push(rod('frame', [mx, th + 0.035, mz + 0.04], [mx + 0.03, th + 0.022, mz + 0.27], 0.013, { plan: false }));
    return parts;
  },
  planDetail: ({ w, d }) => {
    const zf = d / 2 - 0.09;
    const cx = -w / 2 + 0.24;
    return [rectPoly(cx - 0.2, zf, cx + 0.2, zf + 0.05), line([-w / 2, -d / 2 + 0.17], [w / 2, -d / 2 + 0.17])];
  },
});

// ── 5. Writing bureau with the fall-front open ───────────────────────────────

function bureauLayout(w: number, d: number, h: number) {
  const X0 = -w / 2 + 0.014;
  const X1 = w / 2 - 0.014;
  const zb = -d / 2;
  const feetH = 0.1;
  const plinth = 0.03;
  const yP = feetH + plinth;
  const yw = clamp(h * 0.72, 0.7, 0.8); // writing surface
  const rise = h - 0.02 - yw;
  let Dc = 0.55;
  let Tt = 0.2;
  for (const _i of range(60)) {
    Tt = clamp(Dc * 0.45, 0.17, 0.24);
    if (Dc + Math.hypot(Dc - Tt, rise) + 0.004 <= d || Dc <= 0.3) break;
    Dc -= 0.005;
  }
  const zf = zb + Dc;
  const zt = zb + Tt;
  const Lf = Math.hypot(zf - zt, rise) - 0.005;
  return { X0, X1, zb, feetH, plinth, yP, yw, Dc, Tt, zf, zt, Lf };
}

/** Brass bail pull: back plate and a hanging half-ring, on a front whose face is at z. */
function bailPull(slot: string, x: number, y: number, z: number): Part[] {
  return [
    sp(slot, [x - 0.03, x + 0.03], [y - 0.008, y + 0.016], [z, z + 0.003], 0.001),
    torus(slot, [x, y + 0.006, z + 0.007], 0.02, 0.0028, { arc: Math.PI, rotation: [0, 0, Math.PI], plan: false }),
  ];
}

const bureau = defineItem({
  id: 'writing-bureau',
  name: 'Writing bureau with fall-front',
  category: 'office',
  type: 'surfaces',
  group: 'Desks',
  tags: ['bureau', 'secretary desk', 'secretaire', 'writing desk', 'slant front', 'fall front', 'pigeonholes', 'drawers', 'mahogany', 'antique', 'leather', 'bàn viết', 'bàn làm việc cổ điển'],
  defaultSize: { w: 0.95, d: 0.85, h: 1.06 },
  minSize: { w: 0.75, d: 0.72, h: 0.98 },
  maxSize: { w: 1.25, d: 0.98, h: 1.15 },
  slots: [
    matSlot('wood', 'Carcass & drawers', 'mahogany'),
    matSlot('interior', 'Interior fittings', 'satinwood'),
    matSlot('leather', 'Writing leather', 'writing-leather'),
    matSlot('brass', 'Brass pulls & hinges', 'metal-brass'),
  ],
  build: ({ w, d, h }) => {
    const L = bureauLayout(w, d, h);
    const { X0, X1, zb, feetH, plinth, yP, yw, zf, zt, Lf } = L;
    const t = 0.018;
    const parts: Part[] = [];

    // Carcass: slant-topped sides, back, bottom, writing bed and top.
    const side: V2[] = [
      [zb, yP],
      [zf, yP],
      [zf, yw],
      [zt, h - 0.02],
      [zb, h - 0.02],
    ];
    parts.push({ ...sidePlate('wood', side, X0, t), plan: true }, { ...sidePlate('wood', side, X1 - t, t), plan: true });
    parts.push(sp('wood', [X0 + t, X1 - t], [yP, h - 0.02], [zb, zb + 0.008]));
    parts.push(sp('wood', [X0 + t, X1 - t], [yP, yP + t], [zb + 0.008, zf]));
    parts.push(sp('wood', [X0 + t, X1 - t], [yw - 0.02, yw], [zb + 0.008, zf]));
    parts.push(span('wood', [X0, X1], [h - 0.02, h], [zb, zt + 0.006], { bevel: 0.004 }));

    // Base moulding and ogee bracket feet.
    parts.push(sp('wood', [-w / 2, w / 2], [feetH, feetH + plinth], [zf - 0.01, zf + 0.012], 0.006));
    parts.push(sp('wood', [-w / 2, -w / 2 + 0.03], [feetH, feetH + plinth], [zb, zf + 0.012], 0.006));
    parts.push(sp('wood', [w / 2 - 0.03, w / 2], [feetH, feetH + plinth], [zb, zf + 0.012], 0.006));
    const ogee = (n = 8): V2[] =>
      range(n + 1).map((i) => {
        const u = i / n;
        return [0.05 + 0.12 * u, 0.012 + 0.07 * (0.5 - 0.5 * Math.cos(Math.PI * u)) + 0.01 * Math.sin(TAU * u)] as V2;
      });
    const footFront = (s: number): V2[] => {
      const pts: V2[] = [[0, 0], ...ogee(), [0.17, feetH], [0, feetH]].map(([a, y]) => [s * (w / 2 - a), y] as V2);
      return s > 0 ? pts : pts.reverse();
    };
    parts.push(facePlate('wood', footFront(-1), zf - 0.01, 0.022), facePlate('wood', footFront(1), zf - 0.01, 0.022));
    const footSide = (front: boolean): V2[] => [[0, 0], ...ogee(), [0.17, feetH], [0, feetH]].map(([a, y]) => [front ? zf + 0.012 - a : zb + a, y] as V2);
    for (const x of [-w / 2, w / 2 - 0.022]) parts.push(sidePlate('wood', footSide(true), x, 0.022), sidePlate('wood', footSide(false), x, 0.022));

    // Drawers: a loper row (two short drawers between the lopers), then three graduated long ones.
    const zd: V2 = [zf - 0.02, zf - 0.002];
    const hl = 0.075;
    const yl1 = yw - 0.02;
    const yl0 = yl1 - hl;
    const lw = 0.055;
    for (const s of [-1, 1]) {
      const xa = s < 0 ? X0 + t : X1 - t - lw;
      // Loper pulled out to carry the open flap, with a small brass knob.
      parts.push(sp('wood', [xa + 0.002, xa + lw - 0.002], [yl1 - 0.06, yl1], [zf - 0.3, zf + Lf * 0.5], 0.002));
      parts.push(...knob('brass', [xa + lw / 2, yl1 - 0.03, zf + Lf * 0.5], 0.008));
    }
    const xi0 = X0 + t + lw;
    const xi1 = X1 - t - lw;
    for (const [xa, xb] of [
      [xi0, -0.003],
      [0.003, xi1],
    ] as V2[]) {
      parts.push(sp('wood', [xa + 0.003, xb - 0.003], [yl0 + 0.003, yl1 - 0.003], zd, 0.003));
      parts.push(...knob('brass', [(xa + xb) / 2, (yl0 + yl1) / 2, zf - 0.002], 0.011));
    }
    parts.push(sp('wood', [X0 + t, X1 - t], [yl0 - 0.015, yl0], [zf - 0.02, zf]));
    const yd0 = yP + t;
    const yd1 = yl0 - 0.015;
    const weights = [0.38, 0.33, 0.29];
    let y = yd0;
    for (const [i, k] of weights.entries()) {
      const hh = (yd1 - yd0 - 0.015 * 2) * k;
      const ya = y;
      const yb = y + hh;
      parts.push(sp('wood', [X0 + t + 0.003, X1 - t - 0.003], [ya + 0.003, yb - 0.003], zd, 0.004));
      const ym = (ya + yb) / 2;
      const off = (X1 - X0) * 0.27;
      parts.push(...bailPull('brass', -off, ym, zf - 0.002), ...bailPull('brass', off, ym, zf - 0.002));
      parts.push(sp('brass', [-0.012, 0.012], [ym - 0.012, ym + 0.012], [zf - 0.002, zf + 0.0005]));
      if (i < weights.length - 1) parts.push(sp('wood', [X0 + t, X1 - t], [yb, yb + 0.015], [zf - 0.02, zf]));
      y = yb + 0.015;
    }

    // The fall-front lies open on the lopers: leather writing surface and two flap hinges.
    parts.push(span('wood', [X0 + t + 0.002, X1 - t - 0.002], [yw - 0.02, yw], [zf, zf + Lf], { bevel: 0.003 }));
    parts.push(sp('leather', [X0 + t + 0.035, X1 - t - 0.035], [yw, yw + 0.0015], [zf + 0.035, zf + Lf - 0.035]));
    for (const s of [-1, 1]) parts.push(sp('brass', [s * (X1 - X0) * 0.3 - 0.03, s * (X1 - X0) * 0.3 + 0.03], [yw, yw + 0.0012], [zf - 0.014, zf + 0.014]));
    parts.push(sp('brass', [-0.012, 0.012], [yw, yw + 0.0012], [zf + Lf - 0.03, zf + Lf - 0.008]));

    // Interior fittings: small drawers, pigeonholes with arched valances and a prospect door.
    const zi = zt - 0.008;
    const zib = zb + 0.008;
    const yf0 = yw;
    const yf1 = h - 0.02;
    const Fh = yf1 - yf0;
    const dw = clamp((X1 - X0 - 2 * t) * 0.22, 0.14, 0.24);
    const hd = clamp(Fh * 0.3, 0.06, 0.09);
    const vh = clamp(Fh * 0.14, 0.025, 0.04);
    for (const s of [-1, 1]) {
      parts.push(sp('interior', [s * dw / 2 - 0.004, s * dw / 2 + 0.004], [yf0, yf1], [zib, zi]));
      const xa = s < 0 ? X0 + t : dw / 2 + 0.004;
      const xb = s < 0 ? -dw / 2 - 0.004 : X1 - t;
      const sw = xb - xa;
      const nd = sw > 0.3 ? 2 : 1;
      for (const k of range(nd)) {
        const da = xa + (k * sw) / nd;
        const db = xa + ((k + 1) * sw) / nd;
        parts.push(sp('interior', [da + 0.002, db - 0.002], [yf0 + 0.002, yf0 + hd - 0.002], [zi - 0.012, zi], 0.002));
        parts.push(...knob('brass', [(da + db) / 2, yf0 + hd / 2, zi], 0.006));
      }
      parts.push(sp('interior', [xa, xb], [yf0 + hd, yf0 + hd + 0.008], [zib, zi]));
      const np = clamp(Math.round(sw / 0.085), 2, 5);
      for (const k of range(np - 1)) {
        const x = xa + ((k + 1) * sw) / np;
        parts.push(sp('interior', [x - 0.003, x + 0.003], [yf0 + hd + 0.008, yf1], [zib, zi - 0.004]));
      }
      const val: V2[] = [
        [xa, yf1],
        [xb, yf1],
      ];
      for (const i of range(np * 8 + 1).reverse()) {
        const u = (i / 8) % 1;
        const x = xa + (i * sw) / (np * 8);
        val.push([x, yf1 - vh + vh * 0.65 * Math.pow(Math.sin(Math.PI * (i % 8 === 0 && i > 0 ? 0 : u)), 0.6)]);
      }
      parts.push(facePlate('interior', val, zi - 0.012, 0.008));
    }
    parts.push(sp('interior', [-dw / 2 + 0.006, dw / 2 - 0.006], [yf0 + 0.004, yf1 - 0.004], [zi - 0.014, zi], 0.003));
    parts.push(sp('wood', [-dw / 2 + 0.025, dw / 2 - 0.025], [yf0 + 0.03, yf1 - 0.03], [zi, zi + 0.002]));
    parts.push(...knob('brass', [dw / 2 - 0.035, (yf0 + yf1) / 2, zi + 0.002], 0.007));
    return parts;
  },
  planDetail: ({ w, d, h }) => {
    const { X0, X1, zf } = bureauLayout(w, d, h);
    return [line([X0, zf], [X1, zf])];
  },
});

// ── 6. Indochine rosewood tea table (bàn trà) ────────────────────────────────

/** Petal (pointed lens) outline from the centre outward at angle `a`. */
function petal(cx: number, cz: number, a: number, r0: number, len: number, wid: number): V2[] {
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const pts: V2[] = [];
  for (const i of range(9)) {
    const t = (i / 8) * Math.PI;
    const along = r0 + (len * (1 - Math.cos(t))) / 2;
    const half = (wid / 2) * Math.sin(t) * (1.15 - (0.5 * (1 - Math.cos(t))) / 2);
    pts.push([cx + ca * along - sa * half, cz + sa * along + ca * half]);
  }
  for (const i of range(7)) {
    const t = Math.PI - ((i + 1) / 8) * Math.PI;
    const along = r0 + (len * (1 - Math.cos(t))) / 2;
    const half = (wid / 2) * Math.sin(t) * (1.15 - (0.5 * (1 - Math.cos(t))) / 2);
    pts.push([cx + ca * along + sa * half, cz + sa * along - ca * half]);
  }
  return pts;
}

const indochine = defineItem({
  id: 'indochine-tea-table',
  name: 'Indochine rosewood tea table',
  category: 'living',
  type: 'surfaces',
  group: 'Coffee tables',
  tags: ['indochine', 'tea table', 'coffee table', 'rosewood', 'carved', 'mother of pearl', 'inlay', 'lotus', 'bàn trà', 'bàn trà gỗ', 'đông dương', 'khảm trai', 'gỗ hương', 'vietnamese'],
  defaultSize: { w: 1.2, d: 0.65, h: 0.46 },
  minSize: { w: 0.8, d: 0.5, h: 0.38 },
  maxSize: { w: 1.6, d: 0.9, h: 0.52 },
  slots: [
    matSlot('wood', 'Rosewood frame', 'rosewood'),
    matSlot('panel', 'Top panel & shelf', 'rosewood-burl'),
    matSlot('inlay', 'Mother-of-pearl inlay', 'mother-of-pearl'),
  ],
  build: ({ w, d, h }) => {
    const tt = 0.035;
    const yT = h - tt;
    const fw = clamp(Math.min(w, d) * 0.11, 0.05, 0.085);
    const parts: Part[] = [];

    // Frame-and-panel top: four rails around a recessed burl panel.
    parts.push(span('wood', [-w / 2, w / 2], [yT, h], [d / 2 - fw, d / 2], { bevel: 0.007 }));
    parts.push(span('wood', [-w / 2, w / 2], [yT, h], [-d / 2, -d / 2 + fw], { bevel: 0.007 }));
    parts.push(span('wood', [-w / 2, -w / 2 + fw], [yT, h], [-d / 2 + fw, d / 2 - fw], { bevel: 0.007 }));
    parts.push(span('wood', [w / 2 - fw, w / 2], [yT, h], [-d / 2 + fw, d / 2 - fw], { bevel: 0.007 }));
    const py = h - 0.008;
    const pw = w / 2 - fw;
    const pd = d / 2 - fw;
    parts.push(span('panel', [-pw, pw], [yT + 0.004, py], [-pd, pd]));

    // Mother-of-pearl: a lotus in the centre, crescent clouds in the corners, a stringing line.
    const iy = py - 0.001;
    const ih = 0.0016;
    const pl = Math.min(pw, pd) * 0.42;
    for (const i of range(8)) parts.push(prism('inlay', petal(0, 0, (i / 8) * TAU + Math.PI / 8, pl * 0.22, pl * 0.78, pl * 0.36), iy, ih, { plan: false }));
    parts.push(vcyl('inlay', 0, 0, iy, iy + ih, pl * 0.18, { segments: 20, plan: false }));
    for (const i of range(8)) {
      const a = (i / 8) * TAU;
      parts.push(vcyl('inlay', Math.cos(a) * pl * 1.18, Math.sin(a) * pl * 1.18, iy, iy + ih, pl * 0.045, { segments: 10, plan: false }));
    }
    const cr = Math.min(pw, pd) * 0.18;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const ccx = sx * (pw - 0.035 - cr * 0.6);
        const ccz = sz * (pd - 0.035 - cr * 0.6);
        const a0 = Math.atan2(-sz, -sx) - 1.3;
        const outer = arcPoints(ccx, ccz, cr, a0, a0 + 2.6, 10);
        const inner = arcPoints(ccx + Math.cos(a0 + 1.3) * cr * 0.3, ccz + Math.sin(a0 + 1.3) * cr * 0.3, cr * 0.82, a0 + 2.6, a0, 10);
        parts.push(prism('inlay', [...outer, ...inner], iy, ih, { plan: false }));
      }
    }
    const si = 0.022;
    parts.push(sp('inlay', [-pw + si, pw - si], [iy, iy + ih], [pd - si - 0.003, pd - si]));
    parts.push(sp('inlay', [-pw + si, pw - si], [iy, iy + ih], [-pd + si, -pd + si + 0.003]));
    parts.push(sp('inlay', [-pw + si, -pw + si + 0.003], [iy, iy + ih], [-pd + si, pd - si]));
    parts.push(sp('inlay', [pw - si - 0.003, pw - si], [iy, iy + ih], [-pd + si, pd - si]));

    // Legs with inward-turned horse-hoof feet.
    const lt = clamp(w * 0.045, 0.045, 0.06);
    const li = 0.03;
    const xl = w / 2 - li - lt / 2;
    const zl = d / 2 - li - lt / 2;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        parts.push(sp('wood', [sx * xl - lt / 2, sx * xl + lt / 2], [0.055, yT], [sz * zl - lt / 2, sz * zl + lt / 2], 0.004));
        const fx = sx * (xl - 0.008);
        const fz = sz * (zl - 0.008);
        parts.push(sp('wood', [fx - lt * 0.55, fx + lt * 0.55], [0, 0.065], [fz - lt * 0.55, fz + lt * 0.55], 0.014));
        parts.push(sp('wood', [sx * xl - lt * 0.58, sx * xl + lt * 0.58], [0.06, 0.072], [sz * zl - lt * 0.58, sz * zl + lt * 0.58], 0.004));
      }
    }

    // Carved aprons with a curved cloud-collar edge and a central pendant, plus a medallion.
    const dA = clamp(h * 0.2, 0.065, 0.1);
    const depth = (u: number, rel: number, half: number) =>
      dA * (0.42 + 0.58 * Math.pow(u, 5)) + dA * 0.38 * Math.exp(-Math.pow(rel / (half * 0.08), 2)) + dA * 0.14 * Math.exp(-Math.pow((u - 0.7) / 0.045, 2));
    const apron = (half: number): V2[] => {
      const pts: V2[] = [
        [-half, yT],
        [half, yT],
      ];
      const n = 40;
      for (const i of range(n + 1)) {
        const x = half - (2 * half * i) / n;
        pts.push([x, yT - depth(Math.abs(x) / half, x, half)]);
      }
      return pts;
    };
    const ax = xl - lt / 2;
    const az = zl - lt / 2;
    const ft = d / 2 - li - 0.006;
    const st = w / 2 - li - 0.006;
    parts.push(facePlate('wood', apron(ax), ft - 0.02, 0.02), facePlate('wood', apron(ax), -ft, 0.02));
    const sideApron = apron(az).map(([z, y]) => [z, y] as V2);
    parts.push(sidePlate('wood', sideApron, st - 0.02, 0.02), sidePlate('wood', sideApron, -st, 0.02));
    const my = yT - dA * 0.3;
    const mr = dA * 0.24;
    for (const s of [-1, 1]) {
      parts.push(discZ('panel', [0, my, s * (ft + 0.003)], mr, 0.006, { segments: 24, plan: false }));
      parts.push(torus('wood', [0, my, s * (ft + 0.003)], mr * 1.12, 0.0035, { plan: false }));
      parts.push(cyl('panel', [s * (st + 0.003), my, 0], mr * 0.8, 0.006, { segments: 24, rotation: [0, 0, Math.PI / 2], plan: false }));
    }

    // Box stretchers carrying a lower shelf panel.
    const ys = clamp(h * 0.2, 0.07, 0.11);
    const zs = zl;
    parts.push(sp('wood', [-ax, ax], [ys, ys + 0.028], [zs - 0.011, zs + 0.011]), sp('wood', [-ax, ax], [ys, ys + 0.028], [-zs - 0.011, -zs + 0.011]));
    parts.push(sp('wood', [xl - 0.011, xl + 0.011], [ys, ys + 0.028], [-az, az]), sp('wood', [-xl - 0.011, -xl + 0.011], [ys, ys + 0.028], [-az, az]));
    parts.push(sp('panel', [-ax, ax], [ys + 0.012, ys + 0.022], [-az, az]));
    // Short carved struts between the shelf rails and the aprons, front and back.
    for (const s of [-1, 1]) {
      for (const x of [-ax * 0.45, ax * 0.45]) parts.push(sp('wood', [x - 0.009, x + 0.009], [ys + 0.028, yT - depth(0.45, x, ax) + 0.005], [s * zs - 0.008, s * zs + 0.008], 0.003));
    }
    return parts;
  },
});

// ── 7. Wine-barrel side table ────────────────────────────────────────────────

const barrel = defineItem({
  id: 'wine-barrel-side-table',
  name: 'Wine barrel side table',
  category: 'living',
  type: 'surfaces',
  group: 'End tables',
  tags: ['wine barrel', 'cask', 'barrique', 'oak barrel', 'staves', 'hoops', 'side table', 'end table', 'rustic', 'bar', 'thùng rượu gỗ', 'bàn thùng rượu'],
  defaultSize: { w: 0.6, d: 0.6, h: 0.68 },
  minSize: { w: 0.42, d: 0.42, h: 0.45 },
  maxSize: { w: 0.75, d: 0.75, h: 1.0 },
  slots: [
    matSlot('staves', 'Oak staves', 'barrel-oak'),
    matSlot('hoops', 'Steel hoops', 'metal-anthracite'),
    matSlot('head', 'Barrel head', 'barrel-head'),
  ],
  build: ({ w, d, h }) => {
    const R = Math.min(w, d) / 2;
    const tS = 0.022;
    const Rm = R - 0.024;
    const Re = Rm * 0.85;
    const rAt = (y: number) => Re + (Rm - Re) * (1 - Math.pow((2 * y) / h - 1, 2));
    const n = clamp(Math.round((TAU * Rm) / 0.09), 14, 26);
    const segs = 4;
    const parts: Part[] = [];
    for (const i of range(n)) {
      const th = Math.PI / 2 + (i * TAU) / n;
      for (const s of range(segs)) {
        const y0 = (h * s) / segs;
        const y1 = (h * (s + 1)) / segs;
        const r0 = rAt(y0);
        const r1 = rAt(y1);
        const rc = (r0 + r1) / 2;
        const a = Math.atan2(r1 - r0, y1 - y0);
        // Stretch each segment 4 mm past its inner joints so neighbouring segments overlap.
        const eb = s === 0 ? 0 : 0.004;
        const et = s === segs - 1 ? 0 : 0.004;
        const len = Math.hypot(y1 - y0, r1 - r0) + eb + et;
        const yc = (y0 + y1) / 2 + ((et - eb) / 2) * Math.cos(a);
        parts.push({
          shape: 'box',
          size: [(TAU * rc) / n - 0.003, len, tS],
          position: [rc * Math.cos(th), yc, rc * Math.sin(th)],
          rotation: eulerXYZ(mat3(rotY(Math.PI / 2 - th), rotX(a))),
          slot: 'staves',
          ...(s === 1 ? {} : { plan: false }),
        });
      }
    }
    // Hoops: two chime hoops near the ends and two quarter hoops over the stave joints.
    const bh = clamp(h * 0.065, 0.03, 0.055);
    const hoopAt = (yc: number) => {
      const ya = yc - bh / 2;
      const yb = yc + bh / 2;
      const ri = (y: number) => rAt(y) + tS / 2 - 0.002;
      const ro = (y: number) => rAt(y) + tS / 2 + 0.0065;
      parts.push(
        lathe(
          'hoops',
          [0, ya, 0],
          [
            [ri(ya), 0],
            [ro(ya), 0],
            [ro(yc), bh / 2],
            [ro(yb), bh],
            [ri(yb), bh],
          ],
          { segments: 40, plan: false },
        ),
      );
      for (const k of [-1, 1]) {
        const a = Math.PI / 2 + k * 0.5;
        parts.push(sphere('hoops', [Math.cos(a) * ro(yc), yc, Math.sin(a) * ro(yc)], 0.0045, { plan: false }));
      }
    };
    for (const f of [0.08, 0.25, 0.75, 0.92]) hoopAt(clamp(h * f, bh / 2 + 0.02, h - bh / 2 - 0.02));
    // Head boards set into the croze just below the chime.
    const yh = h - 0.028;
    const Rh = rAt(yh - 0.015) - tS / 2 + 0.002;
    const nb = 5;
    for (const k of range(nb)) {
      const xa = -Rh + (k * 2 * Rh) / nb + 0.001;
      const xb = -Rh + ((k + 1) * 2 * Rh) / nb - 0.001;
      const steps = 8;
      const top: V2[] = range(steps + 1).map((j) => {
        const x = xa + ((xb - xa) * j) / steps;
        return [x, Math.sqrt(Math.max(0, Rh * Rh - x * x))] as V2;
      });
      const bot: V2[] = top.map(([x, z]) => [x, -z] as V2).reverse();
      parts.push(prism('head', [...top, ...bot], yh - 0.03, 0.03, { plan: false }));
    }
    // Oak bung in the belly, facing front.
    const yb = h * 0.5;
    parts.push(rod('head', [0, yb, rAt(yb) - 0.004], [0, yb, rAt(yb) + tS / 2 + 0.008], 0.02, { plan: false }));
    parts.push(rod('hoops', [0, yb, rAt(yb) + tS / 2 - 0.002], [0, yb, rAt(yb) + tS / 2 + 0.002], 0.026, { plan: false }));
    return parts;
  },
  planDetail: ({ w, d }) => [circle([0, 0], Math.min(w, d) / 2 - 0.024 * 2)],
});

// ── 8. Teak tea trolley on spoked wheels ─────────────────────────────────────

const trolley = defineItem({
  id: 'teak-tea-trolley',
  name: 'Teak tea trolley with spoked wheels',
  category: 'dining',
  type: 'storage',
  group: 'Sideboards & cabinets',
  tags: ['tea trolley', 'serving trolley', 'serving cart', 'tea cart', 'teak', 'mid-century', 'wheels', 'tea set', 'teapot', 'xe đẩy gỗ', 'xe đẩy trà'],
  defaultSize: { w: 0.85, d: 0.48, h: 0.78 },
  minSize: { w: 0.65, d: 0.4, h: 0.65 },
  maxSize: { w: 1.1, d: 0.6, h: 0.9 },
  slots: [
    matSlot('wood', 'Teak frame & trays', 'wood-teak'),
    matSlot('tyre', 'Rubber tyres', 'rubber-black'),
    matSlot('metal', 'Brass axle & ferrules', 'metal-brass'),
    matSlot('ceramic', 'Tea set', 'ceramic-white'),
  ],
  build: ({ w, d, h }) => {
    const R = clamp(h * 0.15, 0.09, 0.13);
    const wt = 0.022;
    const zW = d / 2 - wt / 2;
    const zF = d / 2 - wt - 0.006 - 0.015;
    const xW = w / 2 - R;
    const ps = 0.035;
    const xH = -w / 2 + 0.04;
    const yTop = clamp(h - 0.13, 0.5, 0.72);
    const yBot = clamp(h * 0.3, 0.2, 0.3);
    const parts: Part[] = [];
    for (const s of [-1, 1]) {
      const z = s * zF;
      const zz: V2 = [z - 0.015, z + 0.015];
      // Handle-end post on a brass ferrule; wheel-end post down to the axle.
      parts.push(span('wood', [xH - ps / 2, xH + ps / 2], [0.035, h - 0.035], zz, { bevel: 0.004 }));
      parts.push(vcyl('metal', xH, z, 0, 0.035, 0.016, { plan: false }));
      parts.push(span('wood', [xW - ps / 2, xW + ps / 2], [R - 0.02, yTop + 0.02], zz, { bevel: 0.004 }));
      // Tray rails, standing 2 cm above the tray boards as a gallery.
      parts.push(sp('wood', [xH + ps / 2, xW - ps / 2], [yTop - 0.032, yTop + 0.02], zz, 0.004));
      parts.push(sp('wood', [xH + ps / 2, xW - ps / 2], [yBot - 0.032, yBot + 0.02], zz, 0.004));
      // Spoked wheel: rubber tyre, wooden felloe, eight spokes and a turned hub.
      parts.push(torus('tyre', [xW, R, s * zW], R - 0.009, 0.009, { plan: false }));
      parts.push(torus('wood', [xW, R, s * zW], R - 0.024, 0.0075, { plan: false }));
      parts.push(discZ('wood', [xW, R, s * zW], 0.026, wt, { segments: 20, plan: false }));
      for (const k of range(8)) {
        const a = (k / 8) * TAU;
        parts.push(rod('wood', [xW + Math.cos(a) * 0.022, R + Math.sin(a) * 0.022, s * zW], [xW + Math.cos(a) * (R - 0.028), R + Math.sin(a) * (R - 0.028), s * zW], 0.0055, { plan: false }));
      }
    }
    parts.push(rodZ('metal', xW, R, -zW, zW, 0.008, { plan: false }));
    parts.push(rodZ('wood', xH, h - 0.02, -zF - 0.015, zF + 0.015, 0.017, { plan: false }));
    // Trays with low end lips.
    for (const y of [yTop, yBot]) {
      parts.push(span('wood', [xH + ps / 2, xW - ps / 2], [y - 0.012, y], [-zF + 0.015, zF - 0.015]));
      parts.push(sp('wood', [xH + ps / 2, xH + ps / 2 + 0.012], [y, y + 0.025], [-zF + 0.015, zF - 0.015], 0.003));
      parts.push(sp('wood', [xW - ps / 2 - 0.012, xW - ps / 2], [y, y + 0.025], [-zF + 0.015, zF - 0.015], 0.003));
    }
    // A tea set on the top tray: teapot, two cups on saucers.
    const mid = (xH + xW) / 2;
    const tx = mid - 0.09;
    parts.push(
      lathe(
        'ceramic',
        [tx, yTop, 0],
        [
          [0, 0],
          [0.045, 0],
          [0.066, 0.035],
          [0.064, 0.068],
          [0.042, 0.092],
          [0.03, 0.096],
          [0, 0.096],
        ],
        { segments: 28, plan: false },
      ),
    );
    parts.push(sphere('ceramic', [tx, yTop + 0.104, 0], 0.012, { scale: [1, 0.8, 1], plan: false }));
    parts.push(rod('ceramic', [tx + 0.055, yTop + 0.035, 0], [tx + 0.105, yTop + 0.085, 0], 0.011, { rTop: 0.006, plan: false }));
    parts.push(torus('ceramic', [tx - 0.068, yTop + 0.055, 0], 0.026, 0.006, { arc: Math.PI, rotation: [0, 0, Math.PI / 2], plan: false }));
    for (const [cxo, czo] of [
      [0.1, -0.07],
      [0.13, 0.06],
    ] as V2[]) {
      const cx = mid + cxo;
      const cz = czo * (d / 0.48);
      parts.push(vcyl('ceramic', cx, cz, yTop, yTop + 0.008, 0.055, { rTop: 0.06, segments: 24, plan: false }));
      parts.push(
        lathe(
          'ceramic',
          [cx, yTop + 0.008, cz],
          [
            [0, 0],
            [0.022, 0],
            [0.036, 0.03],
            [0.042, 0.05],
            [0.038, 0.05],
          ],
          { segments: 20, plan: false },
        ),
      );
    }
    return parts;
  },
  planDetail: ({ w, d, h }) => {
    const R = clamp(h * 0.15, 0.09, 0.13);
    return [line([w / 2 - 2 * R, d / 2 - 0.011], [w / 2, d / 2 - 0.011]), line([w / 2 - 2 * R, -d / 2 + 0.011], [w / 2, -d / 2 + 0.011])];
  },
});

// ── 9. Sawhorse trestle desk ─────────────────────────────────────────────────

const sawhorseDesk = defineItem({
  id: 'sawhorse-trestle-desk',
  name: 'Sawhorse trestle desk',
  category: 'office',
  type: 'surfaces',
  group: 'Desks',
  tags: ['sawhorse', 'trestle', 'desk', 'plywood', 'pine', 'studio', 'workshop desk', 'scandinavian', 'bàn làm việc', 'bàn chân ngựa'],
  defaultSize: { w: 1.6, d: 0.75, h: 0.75 },
  minSize: { w: 1.1, d: 0.6, h: 0.7 },
  maxSize: { w: 2.4, d: 0.95, h: 0.8 },
  slots: [
    matSlot('top', 'Plywood top', 'wood-plywood'),
    matSlot('horse', 'Sawhorses', 'wood-teak'),
  ],
  build: ({ w, d, h }) => {
    const tt = 0.025;
    const yb = h - tt;
    const xs = w / 2 - clamp(w * 0.14, 0.2, 0.3);
    const bh = 0.07;
    const zt = d / 2 - 0.05;
    const zl = d / 2 - 0.1;
    const parts: Part[] = [span('top', [-w / 2, w / 2], [yb, h], [-d / 2, d / 2], { bevel: 0.003 })];
    for (const sx of [-1, 1]) {
      const x = sx * xs;
      // Beam, with cleats under the top locating it either side.
      parts.push(sp('horse', [x - 0.0225, x + 0.0225], [yb - bh, yb], [-zt, zt], 0.003));
      for (const s of [-1, 1]) parts.push(sp('horse', [x + s * 0.0235, x + s * 0.0435], [yb - 0.02, yb], [-zt + 0.06, zt - 0.06]));
      // Splayed A-legs notched into the beam.
      const legX = (side: number, y: number) => x + side * (0.03 + 0.1 * ((yb - bh / 2 - y) / (yb - bh / 2 - 0.008)));
      for (const sz of [-1, 1]) {
        const z = sz * zl;
        for (const side of [-1, 1]) parts.push(beam('horse', [legX(side, 0.008), 0.008, z], [legX(side, yb - bh / 2), yb - bh / 2, z], 0.045, 0.07));
        // Plywood gusset tying both legs to the beam on the outer face.
        const ylo = yb - bh - 0.17;
        const yhi = yb - 0.012;
        const g: V2[] = [
          [legX(-1, ylo) - 0.012, ylo],
          [legX(1, ylo) + 0.012, ylo],
          [legX(1, yhi) + 0.012, yhi],
          [legX(-1, yhi) - 0.012, yhi],
        ];
        parts.push(facePlate('top', g, sz > 0 ? z + 0.035 : z - 0.035 - 0.012, 0.012));
      }
      // Spreaders between the front and back legs on each side.
      for (const side of [-1, 1]) {
        const xc = legX(side, 0.3) - side * 0.0325;
        parts.push(sp('horse', [xc - 0.01, xc + 0.01], [0.27, 0.33], [-zl - 0.035, zl + 0.035], 0.002));
      }
    }
    return parts;
  },
});

// ── 10. Tripod tray-top side table ───────────────────────────────────────────

const tripod = defineItem({
  id: 'tripod-tray-table',
  name: 'Tripod tray-top wine table',
  category: 'living',
  type: 'surfaces',
  group: 'End tables',
  tags: ['tripod table', 'tray top', 'wine table', 'pedestal', 'turned column', 'snake feet', 'walnut', 'georgian', 'side table', 'plant stand', 'bàn tròn ba chân', 'bàn trà nhỏ', 'đôn kê chậu cây'],
  defaultSize: { w: 0.5, d: 0.5, h: 0.62 },
  minSize: { w: 0.36, d: 0.36, h: 0.52 },
  maxSize: { w: 0.7, d: 0.7, h: 0.85 },
  slots: [
    matSlot('top', 'Dished top', 'walnut-slab'),
    matSlot('wood', 'Column & feet', 'wood-walnut'),
  ],
  build: ({ w, d, h }) => {
    const R = Math.min(w, d) / 2;
    const tr = R - 0.003;
    const yT0 = h - 0.028;
    // Dished top: a one-piece floor (planar grain) inside a turned, moulded rim.
    const parts: Part[] = [
      prism('top', arcPoints(0, 0, tr - 0.016, 0, TAU * (47 / 48), 47), yT0, 0.013),
      lathe(
        'wood',
        [0, yT0, 0],
        [
          [tr - 0.02, 0],
          [tr - 0.012, 0],
          [tr, 0.008],
          [tr, 0.02],
          [tr - 0.004, 0.028],
          [tr - 0.014, 0.028],
          [tr - 0.018, 0.016],
          [tr - 0.02, 0.012],
        ],
        { segments: 48 },
      ),
    ];
    // Bearers and a square block under the top.
    parts.push(sp('wood', [-0.022, 0.022], [yT0 - 0.022, yT0], [-tr * 0.72, tr * 0.72], 0.004));
    parts.push(sp('wood', [-0.055, 0.055], [yT0 - 0.05, yT0 - 0.022], [-0.055, 0.055], 0.004));
    // Turned column: urn base, ring, slender shaft, collar.
    const y0 = 0.14;
    const H = yT0 - 0.05 - y0;
    parts.push(
      lathe(
        'wood',
        [0, y0, 0],
        [
          [0, 0],
          [0.042, 0],
          [0.046, 0.03],
          [0.05, 0.085],
          [0.043, 0.125],
          [0.03, 0.155],
          [0.026, 0.172],
          [0.035, 0.188],
          [0.024, 0.205],
          [0.021, H * 0.78],
          [0.03, H * 0.82],
          [0.02, H * 0.86],
          [0.024, H * 0.96],
          [0.034, H],
          [0, H],
        ],
        { segments: 24, plan: false },
      ),
    );
    // Three snake feet, one pointing to the front, ending in pad feet.
    const Rf = R - 0.008;
    for (const i of range(3)) {
      const a = Math.PI / 2 + (i * TAU) / 3;
      const P = (rho: number, y: number): V3 => [Math.cos(a) * rho, y, Math.sin(a) * rho];
      const pts: V3[] = [P(0.03, y0 + 0.11), P(0.075, y0 + 0.05), P(0.13, y0 - 0.025), P(Rf * 0.72, 0.045), P(Rf - 0.026, 0.03)];
      for (const k of range(pts.length - 1)) parts.push(rod('wood', pts[k], pts[k + 1], 0.019 - k * 0.002, { rTop: 0.017 - k * 0.002, plan: false }));
      parts.push(sphere('wood', P(Rf - 0.024, 0.016), 0.022, { scale: [1, 0.7, 1], plan: false }));
    }
    return parts;
  },
  planDetail: ({ w, d }) => [circle([0, 0], Math.min(w, d) / 2 - 0.02)],
});

// ── 11. Extendable oak dining table ──────────────────────────────────────────

/** Right half of a rounded-end top: from the leaf seam at xi to the end at xo. */
function topEnd(xi: number, xo: number, D: number, r: number): V2[] {
  return [
    [xi, -D / 2],
    ...arcPoints(xo - r, -D / 2 + r, r, -Math.PI / 2, 0, 6),
    ...arcPoints(xo - r, D / 2 - r, r, 0, Math.PI / 2, 6),
    [xi, D / 2],
  ];
}

const extendable = defineItem({
  id: 'extendable-oak-dining-table',
  name: 'Extendable oak dining table',
  category: 'dining',
  type: 'surfaces',
  group: 'Dining tables',
  tags: ['extendable', 'extending', 'extension leaf', 'butterfly leaf', 'oak', 'dining table', 'mid-century', 'scandinavian', 'bàn ăn mở rộng', 'bàn ăn kéo dài'],
  defaultSize: { w: 2.0, d: 0.95, h: 0.75 },
  minSize: { w: 1.5, d: 0.8, h: 0.72 },
  maxSize: { w: 2.8, d: 1.1, h: 0.78 },
  slots: [
    matSlot('top', 'Top & leaf', 'white-oak'),
    matSlot('frame', 'Legs & aprons', 'white-oak'),
    matSlot('metal', 'Extension runners', 'metal-brushed-steel'),
  ],
  build: ({ w, d, h }) => {
    const tt = 0.03;
    const yT = h - tt;
    const lw = clamp(w * 0.22, 0.4, 0.55);
    const g = 0.0015;
    const r = clamp(d * 0.1, 0.06, 0.12);
    const right = topEnd(lw / 2 + g, w / 2, d, r);
    const left = right.map(([x, z]) => [-x, z] as V2).reverse();
    const parts: Part[] = [prism('top', right, yT, tt), prism('top', left, yT, tt), span('top', [-lw / 2 + g, lw / 2 - g], [yT, h], [-d / 2, d / 2], { bevel: 0.002 })];
    // Tapered square legs, set in under the rounded ends.
    const ai = 0.06;
    const xl = w / 2 - ai - 0.03;
    const zl = d / 2 - ai - 0.03;
    for (const x of [-xl, xl]) {
      for (const z of [-zl, zl]) parts.push(cyl('frame', [x, yT / 2, z], 0.025, yT, { rTop: 0.04, segments: 4, rotation: [0, Math.PI / 4, 0], plan: false }));
    }
    // Aprons, split at the seams so the leaf carries its own short aprons.
    const ay: V2 = [yT - 0.085, yT];
    const za = d / 2 - ai - 0.008;
    for (const s of [-1, 1]) {
      const zz: V2 = s > 0 ? [za - 0.022, za] : [-za, -za + 0.022];
      parts.push(sp('frame', [lw / 2 + g, xl - 0.03], ay, zz), sp('frame', [-xl + 0.03, -lw / 2 - g], ay, zz), sp('frame', [-lw / 2 + g, lw / 2 - g], ay, zz));
      const xa = s * (w / 2 - ai - 0.008);
      parts.push(sp('frame', s > 0 ? [xa - 0.022, xa] : [xa, xa + 0.022], ay, [-zl + 0.03, zl - 0.03]));
    }
    // Steel extension runners under the leaf, and the leaf's dowels at its seams.
    const xr = Math.min(xl - 0.06, lw / 2 + 0.35);
    for (const s of [-1, 1]) {
      const z = s * (d / 2 - ai - 0.13);
      parts.push(sp('metal', [-xr, xr], [yT - 0.05, yT - 0.012], [z - 0.018, z + 0.018]));
    }
    // Large tables get a centre support leg pair under the leaf.
    if (w >= 2.3) {
      for (const z of [-zl, zl]) parts.push(cyl('frame', [0, yT / 2, z * 0.6], 0.022, yT, { rTop: 0.032, segments: 4, rotation: [0, Math.PI / 4, 0], plan: false }));
      parts.push(sp('frame', [-0.02, 0.02], [0.1, 0.14], [-zl * 0.6, zl * 0.6]));
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const lw = clamp(w * 0.22, 0.4, 0.55);
    return [line([-lw / 2, -d / 2], [-lw / 2, d / 2]), line([lw / 2, -d / 2], [lw / 2, d / 2])];
  },
});

// ── Textures ─────────────────────────────────────────────────────────────────

/** Fills a seamless near-white tile from a value function of tile coordinates in [0, 1). */
function paint(ctx: CanvasRenderingContext2D, size: number, value: (u: number, v: number, x: number, y: number) => number) {
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = Math.round(Math.min(1, Math.max(0, value(x / size, y / size, x, y))) * 255);
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** Tileable smooth value noise on an n × n lattice. */
function valueNoise(n: number, rand: () => number): (u: number, v: number) => number {
  const g = new Float32Array(n * n).map(() => rand());
  const at = (i: number, j: number) => g[(((j % n) + n) % n) * n + (((i % n) + n) % n)];
  return (u, v) => {
    const x = u * n;
    const y = v * n;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const sx = (x - x0) * (x - x0) * (3 - 2 * (x - x0));
    const sy = (y - y0) * (y - y0) * (3 - 2 * (y - y0));
    const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
    const bot = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
    return top + (bot - top) * sy;
  };
}

export default definePack({
  name: 'Wooden tables & desks',
  version: '1.0.0',
  author: 'Neest team',
  description:
    'Solid-wood tables and desks with real joinery: live-edge walnut and monkey-pod slabs, a gateleg drop-leaf table, a carpenter’s workbench, a writing bureau, an Indochine tea table, a wine-barrel table, a tea trolley, a sawhorse desk, a tripod table and an extendable dining table.',
  license: 'CC0 (made for Neest)',
  items: [slabDining, slabCoffee, gateleg, workbench, bureau, indochine, barrel, trolley, sawhorseDesk, tripod, extendable],
  patterns: [
    {
      id: 'slab-figure',
      name: 'Slab figure (cathedral grain)',
      normalStrength: 0.35,
      draw(ctx, size, rand) {
        // Growth rings cut at a shallow angle show as nested arches ("cathedrals") along the board.
        const ph = range(4).map(() => rand() * TAU);
        const warp = valueNoise(5, rand);
        const warp2 = valueNoise(13, rand);
        const tone = valueNoise(4, rand);
        const grain = new Float32Array(size * size).map(() => rand());
        paint(ctx, size, (u, v, x, y) => {
          const arch = 0.06 * Math.cos(TAU * u + ph[0]) + 0.025 * Math.cos(TAU * 2 * u + ph[1]) + 0.012 * Math.sin(TAU * 3 * u + ph[2]);
          const wv = (warp(u, v) - 0.5) * 0.11 + (warp2(u, v) - 0.5) * 0.025;
          const t = v * 13 + (arch + wv) * 13;
          const late = Math.pow(0.5 + 0.5 * Math.sin(TAU * t), 7);
          const pores = Math.pow(Math.abs(Math.sin(TAU * (v * 90 + (arch + wv) * 40))), 20);
          return 0.86 - late * 0.13 - pores * 0.06 + (tone(u, v) - 0.5) * 0.14 + Math.sin(TAU * (u + v) + ph[3]) * 0.015 + (grain[y * size + x] - 0.5) * 0.05;
        });
      },
    },
    {
      id: 'rosewood-grain',
      name: 'Rosewood streaks',
      normalStrength: 0.25,
      draw(ctx, size, rand) {
        // Dense, wavy dark streaks with broader dark bands, as in Vietnamese gỗ hương / trắc.
        const ph = range(6).map(() => rand() * TAU);
        const flecks = new Float32Array(size * size).map(() => rand());
        paint(ctx, size, (u, v, x, y) => {
          const wav = 0.35 * Math.sin(TAU * u + ph[0]) + 0.15 * Math.sin(TAU * 2 * u + ph[1]) + 0.12 * Math.sin(TAU * 3 * v + ph[2]);
          const lines = Math.pow(Math.abs(Math.sin(TAU * (v * 23 + wav))), 6);
          const band = Math.pow(0.5 + 0.5 * Math.sin(TAU * (v * 3 + 0.25 * Math.sin(TAU * u + ph[3]))), 5);
          const fine = Math.pow(Math.abs(Math.sin(TAU * (v * 71 + wav * 2.5 + 0.2 * Math.sin(TAU * 2 * u + ph[4])))), 14);
          return 0.88 - lines * 0.16 - band * 0.22 - fine * 0.06 + (flecks[y * size + x] - 0.5) * 0.04;
        });
      },
    },
    {
      id: 'oak-ray',
      name: 'Oak with ray fleck',
      normalStrength: 0.45,
      draw(ctx, size, rand) {
        // Straight oak grain, open pores, silvery ray flecks and soft weathering.
        const ph = range(5).map(() => rand() * TAU);
        const weather = valueNoise(6, rand);
        const flecks = range(70).map(() => ({ u: rand(), v: rand(), l: 0.02 + rand() * 0.05, t: 0.003 + rand() * 0.004, k: 0.05 + rand() * 0.07 }));
        const noise = new Float32Array(size * size).map(() => rand());
        paint(ctx, size, (u, v, x, y) => {
          const wav = 0.12 * Math.sin(TAU * u + ph[0]) + 0.05 * Math.sin(TAU * 3 * u + ph[1]);
          const lines = Math.pow(Math.abs(Math.sin(TAU * (v * 17 + wav + 0.1 * Math.sin(TAU * 2 * v + ph[2])))), 10);
          const pores = Math.pow(Math.abs(Math.sin(TAU * (v * 53 + wav * 2))), 24);
          let val = 0.85 - lines * 0.17 - pores * 0.08 + (weather(u, v) - 0.5) * 0.12;
          for (const f of flecks) {
            let du = Math.abs(u - f.u);
            let dv = Math.abs(v - f.v);
            du = Math.min(du, 1 - du);
            dv = Math.min(dv, 1 - dv);
            if (du < f.l && dv < f.t) val += f.k * (1 - du / f.l);
          }
          return val + (noise[y * size + x] - 0.5) * 0.05;
        });
      },
    },
    {
      id: 'butcher-block',
      name: 'Laminated butcher block',
      normalStrength: 0.35,
      draw(ctx, size, rand) {
        // Eight glued-up strips of varying tone, each with its own grain, and fine glue lines.
        const n = 8;
        const tones = range(n).map(() => 0.74 + rand() * 0.2);
        const ph = range(n).map(() => rand() * TAU);
        const noise = new Float32Array(size * size).map(() => rand());
        paint(ctx, size, (u, v, x, y) => {
          const k = Math.min(n - 1, Math.floor(v * n));
          const fv = v * n - k;
          const g = Math.pow(Math.abs(Math.sin(TAU * (fv * 4 + 0.25 * Math.sin(TAU * u + ph[k]) + 0.1 * Math.sin(TAU * 3 * u + ph[(k + 3) % n])))), 8);
          let val = tones[k] - g * 0.1;
          if (fv < 0.012 || fv > 0.988) val -= 0.14;
          return val + (noise[y * size + x] - 0.5) * 0.04;
        });
      },
    },
  ],
  materials: [
    { id: 'walnut-slab', name: 'Walnut slab', category: 'wood', color: '#5e3d27', roughness: 0.42, pattern: { id: 'slab-figure', scale: 0.9 } },
    { id: 'monkey-pod', name: 'Monkey-pod (me tây) slab', category: 'wood', color: '#9a6638', roughness: 0.38, pattern: { id: 'slab-figure', scale: 0.9, contrast: 1.15 } },
    { id: 'maple-key', name: 'Maple butterfly key', category: 'wood', color: '#e2c9a0', roughness: 0.45, pattern: { id: 'wood-grain', scale: 0.3, contrast: 0.6 } },
    { id: 'black-epoxy', name: 'Black epoxy', color: '#141210', roughness: 0.15 },
    { id: 'aged-oak', name: 'Aged oak', category: 'wood', color: '#7d5532', roughness: 0.45, pattern: { id: 'oak-ray', scale: 0.7, contrast: 0.85 } },
    { id: 'white-oak', name: 'White oak', category: 'wood', color: '#b68e60', roughness: 0.5, pattern: { id: 'oak-ray', scale: 0.9, contrast: 0.8 } },
    { id: 'barrel-oak', name: 'Weathered barrel oak', category: 'wood', color: '#8e6a4a', roughness: 0.75, pattern: { id: 'oak-ray', scale: 0.6, contrast: 1.1, rotation: 90 } },
    { id: 'barrel-head', name: 'Barrel head oak', category: 'wood', color: '#a07a52', roughness: 0.7, pattern: { id: 'oak-ray', scale: 0.5 } },
    { id: 'beech-block', name: 'Beech butcher block', category: 'wood', color: '#d4a874', roughness: 0.55, pattern: { id: 'butcher-block', scale: 0.5 } },
    { id: 'rosewood', name: 'Rosewood (gỗ hương)', category: 'wood', color: '#5a2a18', roughness: 0.35, pattern: { id: 'rosewood-grain', scale: 0.6 } },
    { id: 'rosewood-burl', name: 'Rosewood burl panel', category: 'wood', color: '#6b3520', roughness: 0.3, pattern: { id: 'slab-figure', scale: 0.35, contrast: 1.2 } },
    { id: 'mahogany', name: 'Mahogany', category: 'wood', color: '#5a2c1a', roughness: 0.38, pattern: { id: 'rosewood-grain', scale: 0.9, contrast: 0.45 } },
    { id: 'satinwood', name: 'Satinwood', category: 'wood', color: '#d8b47a', roughness: 0.4, pattern: { id: 'wood-grain', scale: 0.5, contrast: 0.7 } },
    { id: 'writing-leather', name: 'Green writing leather', category: 'leather', color: '#2f4a35', roughness: 0.7, pattern: { id: 'leather', scale: 0.2, contrast: 0.6 } },
    { id: 'mother-of-pearl', name: 'Mother-of-pearl', color: '#efe9de', roughness: 0.15, metalness: 0.15, pattern: { id: 'marble', scale: 0.08, contrast: 0.5 } },
  ],
});

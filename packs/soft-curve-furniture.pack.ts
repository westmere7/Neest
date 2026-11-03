/**
 * Soft-curve furniture & lighting — sculptural, rounded pieces in walnut, oak, bouclé and velvet:
 * a racetrack dining table on a stacked-sphere pedestal, an oval-back dining chair, a floating leaf
 * pendant, a dome wall sconce, a low arched-leg tea table, a palm-leaf ceiling fan, a fluted oval
 * coffee table, a floating rounded vanity shelf, a shouldered mirror, a stacked donut pouf and a
 * walnut bed with a rolled, channel-quilted velvet headboard.
 *
 * Everything is built from the item's real size: curves are computed in metres, and repeated
 * elements (flutes, channels, leaf strips, frame segments) are counted from the size.
 * Coordinates: x across (w), y up (h), z depth (d), front +z; wall items have their back at -z.
 */
import {
  cellSpans,
  clamp,
  containParts,
  cushion,
  cyl,
  dedupe,
  defineItem,
  definePack,
  ellipsePoints,
  frame4,
  knob,
  lathe,
  lerp,
  line,
  matSlot,
  plantBox,
  prism,
  range,
  rod,
  rodX,
  roundRectPoints,
  span,
  sphere,
  torus,
  turnedLeg,
  type PackMaterial,
  type PackPattern,
  type Part,
  type PlanStroke,
  type Size3,
  type V2,
  type V3,
} from '@/packs/kit';

const o = { plan: false } as const;
const CEILING = 2.7;
const WARM = '#ffd9a8';
/** Final guard: nudges anything that pokes out back into the item box. */
const keep = (parts: Part[], size: Size3) => containParts(parts, plantBox(size));

// ───────────── Shared helpers ─────────────

/** Pill (racetrack) outline in plan, w along x and d along z. */
const stadium = (w: number, d: number, seg = 10): V2[] => roundRectPoints(0, 0, w, d, Math.min(w, d) / 2, seg);

/**
 * A slab with eased edges: a thin inset underside, the main body and a thin inset top skin, so the
 * edge reads as softly rounded. `outline(inset)` returns the plan outline shrunk by `inset`.
 */
function easedSlab(slot: string, outline: (inset: number) => V2[], y0: number, t: number, ease = 0.006): Part[] {
  return [
    prism(slot, outline(ease), y0, ease, o),
    prism(slot, outline(0), y0 + ease - 0.0005, t - 2 * ease + 0.001),
    prism(slot, outline(ease * 0.9), y0 + t - ease, ease, o),
  ];
}

/** Flat panel in the front (X/Y) plane from [x, y] points, extruded from z0 to z0 + t. */
function panelXY(slot: string, pts: V2[], z0: number, t: number, plan = false): Part {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const part: Part = { shape: 'prism', outline: pts.map(([x, y]) => [x - cx, -(y - cy)] as V2), height: t, position: [cx, cy, z0], rotation: [Math.PI / 2, 0, 0], slot };
  if (!plan) part.plan = false;
  return part;
}

/** Flat panel in the side (Z/Y) plane from [z, y] points, `t` thick, centred on x = xc. */
function panelZY(slot: string, pts: V2[], xc: number, t: number, plan = false): Part {
  const zs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  // Rz(90°) then Rx(90°): outline x → world z, outline z → world -y, extrusion → world -x.
  const part: Part = { shape: 'prism', outline: pts.map(([z, y]) => [z - cz, -(y - cy)] as V2), height: t, position: [xc + t / 2, cy, cz], rotation: [Math.PI / 2, 0, Math.PI / 2], slot };
  if (!plan) part.plan = false;
  return part;
}

/** Points on an elliptical arc in a 2D plane, endpoints included. */
const arc = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n: number): V2[] =>
  range(n + 1).map((i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry] as V2;
  });

/** `n` points spread evenly by arc length around a closed outline. */
function alongOutline(pts: V2[], n: number): V2[] {
  const seg = pts.map((p, i) => Math.hypot(pts[(i + 1) % pts.length][0] - p[0], pts[(i + 1) % pts.length][1] - p[1]));
  const per = seg.reduce((s, v) => s + v, 0);
  const out: V2[] = [];
  let i = 0;
  let acc = 0;
  for (const k of range(n)) {
    const target = (k * per) / n;
    while (acc + seg[i] < target && i < pts.length - 1) acc += seg[i++];
    const f = seg[i] > 0 ? (target - acc) / seg[i] : 0;
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
  }
  return out;
}

const perimeter = (pts: V2[]) => pts.reduce((s, p, i) => s + Math.hypot(pts[(i + 1) % pts.length][0] - p[0], pts[(i + 1) % pts.length][1] - p[1]), 0);

// ───────────── 1. Racetrack table on a stacked-sphere pedestal ─────────────

/** One sculptural pedestal at x: half-dome foot, ball, thin disc, second ball and a collar up to H. */
function spherePedestal(x: number, H: number, Rb: number): Part[] {
  const sink = 0.008;
  const fh = H * 0.19;
  const b1 = H * 0.36;
  const dk = Math.max(0.016, H * 0.028);
  const b2 = H * 0.3;
  const parts: Part[] = [];
  // Half-dome foot (quarter-ellipse profile).
  parts.push(lathe('base', [x, 0, 0], [[0, 0], ...arc(0, 0, Rb, fh, 0, Math.PI / 2, 10).map(([r, y]) => [Math.max(0, r), y] as V2)], { segments: 40 }));
  let y = fh - sink;
  const ball = (hh: number, rMax: number) => {
    const r = Math.min(hh / 2, rMax);
    parts.push(sphere('base', [x, y + hh / 2, 0], r, { scale: [1, hh / 2 / r, 1], plan: false }));
    y += hh - sink;
  };
  ball(b1, Rb * 0.62);
  parts.push(cyl('base', [x, y + dk / 2, 0], Rb * 0.74, dk, { segments: 40, plan: false }));
  y += dk - sink / 2;
  ball(b2, Rb * 0.55);
  // Collar under the top, with a slightly flared rim.
  const yc = Math.min(y, H - 0.03);
  parts.push(cyl('base', [x, (yc + H - 0.012) / 2, 0], Rb * 0.4, H - 0.012 - yc, { segments: 32, plan: false }));
  parts.push(cyl('base', [x, H - 0.006, 0], Rb * 0.46, 0.012, { rTop: Rb * 0.5, segments: 32, plan: false }));
  return parts;
}

const spherePedestalTable = defineItem({
  id: 'sphere-pedestal-table',
  name: 'Racetrack dining table on a stacked-sphere pedestal',
  category: 'dining',
  type: 'surfaces',
  group: 'Dining tables',
  tags: ['dining table', 'racetrack', 'oval', 'pill', 'walnut', 'pedestal', 'sculptural', 'spheres', 'bàn ăn'],
  description:
    'A walnut racetrack dining table with softly eased edges on a sculptural cream pedestal stacked from a half-dome foot, a ball, a thin disc, a second ball and a collar. Long tables stand on two pedestals.',
  defaultSize: { w: 1.4, d: 0.8, h: 0.75 },
  minSize: { w: 1.0, d: 0.7, h: 0.72 },
  maxSize: { w: 2.4, d: 1.1, h: 0.78 },
  slots: [matSlot('top', 'Top', 'wood-walnut'), matSlot('base', 'Pedestal', 'venetian-white')],
  variants: [
    { id: 'oak-travertine', name: 'White oak & travertine', materials: { top: 'wood-white-oak', base: 'stone-travertine' } },
    { id: 'smoked-sand', name: 'Smoked oak & sand plaster', materials: { top: 'wood-smoked-oak', base: 'tadelakt-sand' } },
    { id: 'marble-top', name: 'Beige marble top', materials: { top: 'stone-marble-beige', base: 'limewash-warm' } },
  ],
  build: (size) => {
    const { w, d, h } = size;
    const t = 0.04;
    const H = h - t;
    const parts: Part[] = easedSlab('top', (i) => stadium(w - 2 * i, d - 2 * i, 12), H, t, 0.007);
    const Rb = clamp(d * 0.3, 0.19, 0.3);
    // One pedestal, or two under the round ends of a long table.
    const xs = w - d >= 0.85 ? [-(w - d) * 0.42, (w - d) * 0.42] : [0];
    for (const x of xs) parts.push(...spherePedestal(x, H, Rb));
    return keep(parts, size);
  },
});

// ───────────── 2. Oval-back dining chair ─────────────

const ovalBackChair = defineItem({
  id: 'oval-back-dining-chair',
  name: 'Oval-back upholstered dining chair',
  category: 'dining',
  type: 'seating',
  group: 'Dining chairs',
  tags: ['dining chair', 'oval back', 'upholstered', 'walnut', 'boucle', 'mid-century', 'ghế ăn'],
  description: 'A walnut dining chair with square-section legs and an H-stretcher, a padded seat cushion and a large oval upholstered back held between two back posts.',
  defaultSize: { w: 0.5, d: 0.55, h: 0.85 },
  minSize: { w: 0.44, d: 0.48, h: 0.78 },
  maxSize: { w: 0.58, d: 0.62, h: 0.95 },
  slots: [matSlot('frame', 'Frame', 'wood-walnut'), matSlot('upholstery', 'Upholstery', 'fabric-boucle')],
  variants: [
    { id: 'mustard', name: 'Mustard velvet', materials: { upholstery: 'fabric-velvet-mustard' } },
    { id: 'sage-oak', name: 'Sage velvet on oak', materials: { upholstery: 'fabric-velvet-sage', frame: 'wood-white-oak' } },
    { id: 'cognac', name: 'Cognac leather on smoked oak', materials: { upholstery: 'leather-cognac', frame: 'wood-smoked-oak' } },
  ],
  build: (size) => {
    const { w, d, h } = size;
    const t = 0.034;
    const seatTop = clamp(h * 0.54, 0.42, 0.48);
    const sy = seatTop - 0.055;
    const xo = w / 2;
    const zf = d / 2;
    const zb = -d / 2;
    const bev = { bevel: 0.004 };
    const parts: Part[] = [];
    // Oval back: centre and size from what is left above the seat.
    const ow = w - 2 * t - 0.024;
    const y1 = h - 0.01;
    const oh = Math.min(0.4, ow * 0.85, y1 - seatTop - 0.035);
    const yc = y1 - oh / 2;
    const postTop = Math.min(yc + oh * 0.2, h - t * 0.6);
    for (const s of [-1, 1]) {
      const x0 = s < 0 ? -xo : xo - t;
      // Front leg, back leg rising into the back post (with a round cap).
      parts.push(span('frame', [x0, x0 + t], [0, sy], [zf - t, zf], bev));
      parts.push(span('frame', [x0, x0 + t], [0, postTop], [zb, zb + t], bev));
      parts.push(sphere('frame', [x0 + t / 2, postTop, zb + t / 2], t * 0.49, o));
      // Side apron and side stretcher.
      parts.push(span('frame', [x0 + 0.004, x0 + t - 0.004], [sy - 0.075, sy], [zb + t, zf - t], o));
      parts.push(span('frame', [x0 + 0.007, x0 + t - 0.007], [0.13, 0.155], [zb + t, zf - t], o));
      // Dowel joining the post to the oval at its widest.
      parts.push(rodX('frame', s * (xo - t), s * (ow / 2 - 0.012), yc, zb + 0.0175, 0.008, { segments: 10, plan: false }));
    }
    // Front and back aprons, centre stretcher of the H.
    parts.push(span('frame', [-xo + t, xo - t], [sy - 0.075, sy], [zf - t + 0.004, zf - 0.004], o));
    parts.push(span('frame', [-xo + t, xo - t], [sy - 0.075, sy], [zb + 0.004, zb + t - 0.004], o));
    parts.push(span('frame', [-xo + t, xo - t], [0.133, 0.152], [-0.011, 0.011], o));
    // Seat cushion.
    parts.push(span('upholstery', [-xo + 0.006, xo - 0.006], [sy, seatTop], [zb + t + 0.004, zf - 0.002], { bevel: 0.022 }));
    // Oval back: an upholstered oval slab, a smaller padded layer on its face (planar fabric, no
    // sphere pole) and a fine piping round the edge.
    const zs = zb + 0.005;
    parts.push(panelXY('upholstery', ellipsePoints(0, yc, ow / 2, oh / 2, 48), zs, 0.04));
    parts.push(panelXY('upholstery', ellipsePoints(0, yc, ow / 2 - 0.012, oh / 2 - 0.012, 48), zs + 0.039, 0.012));
    parts.push(panelXY('upholstery', ellipsePoints(0, yc, ow / 2 - 0.03, oh / 2 - 0.03, 48), zs + 0.05, 0.007));
    parts.push(torus('upholstery', [0, yc, zs + 0.04], oh / 2, 0.005, { scale: [ow / oh, 1, 1], plan: false }));
    return keep(parts, size);
  },
});

// ───────────── 3. Floating leaf pendant ─────────────

/** Leaf pendant geometry shared by the build and the light position. */
function leafGeom({ w, d }: Size3) {
  const L = w - 0.02;
  const D = d - 0.02;
  return { L, D, half: L / 2, zMid: -D * 0.06, curl: clamp(L * 0.07, 0.03, 0.12), yBase: 0.05 };
}

/** Leaf half-width at u ∈ [0, 1] along the leaf; `p` shifts the widest point. */
const leafShape = (u: number, p: number) => Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(clamp(u, 0, 1), p))), 0.7);

const LEAF_DEFAULT: Size3 = { w: 1.0, d: 0.5, h: 1.0 };

const leafPendant = defineItem({
  id: 'leaf-pendant',
  name: 'Floating leaf pendant',
  category: 'lighting',
  type: 'lighting',
  group: 'Ceiling lights',
  tags: ['pendant', 'leaf', 'paper shade', 'linen', 'sculptural', 'dining light', 'đèn thả', 'đèn lá'],
  description:
    'A wide, shallow linen shade shaped like a curling leaf, folded softly along its midrib and floating on two fine wires from a slim brass canopy, with a warm LED glow tucked underneath.',
  defaultSize: LEAF_DEFAULT,
  minSize: { w: 0.6, d: 0.3, h: 0.5 },
  maxSize: { w: 1.6, d: 0.9, h: 1.8 },
  mount: 'ceiling',
  defaultElevation: CEILING - LEAF_DEFAULT.h,
  slots: [matSlot('shade', 'Shade', 'fabric-linen'), matSlot('metal', 'Canopy & wires', 'metal-brass'), matSlot('light', 'LED glow', 'light-warm')],
  light: { color: WARM, intensity: 1.1, distance: 4.5, y: 0.004, z: leafGeom(LEAF_DEFAULT).zMid },
  variants: [
    { id: 'white-paper', name: 'White cotton shade', materials: { shade: 'fabric-white-cotton' } },
    { id: 'black-fittings', name: 'Black fittings', materials: { metal: 'metal-black-matte' } },
    { id: 'woven', name: 'Woven bamboo shade', materials: { shade: 'bamboo-woven' } },
  ],
  build: (size) => {
    const { h } = size;
    const { L, D, half, zMid, curl, yBase } = leafGeom(size);
    const t = 0.004;
    const fold = 0.13;
    // Midrib curve: tips curl up, one end a little higher than the other.
    const ys = (x: number) => yBase + curl * ((x / half) ** 2 + 0.35 * (x / half) + 0.031);
    const slope = (x: number) => (curl * (2 * (x / half) + 0.35)) / half;
    const front = (u: number) => D * 0.56 * leafShape(u, 0.85);
    const back = (u: number) => D * 0.44 * leafShape(u, 1.18);
    const parts: Part[] = [];
    // The leaf: strips across its length, each half tilted up from the midrib (a soft fold).
    const n = clamp(Math.round(L / 0.07), 8, 20);
    for (const i of range(n)) {
      const xa = -half + (i * L) / n;
      const xb = xa + L / n;
      const xc = (xa + xb) / 2;
      const ua = i / n;
      const ub = (i + 1) / n;
      const th = Math.atan(slope(xc));
      const halves: [V2[], number][] = [
        [dedupe([[xa - xc, 0], [xb - xc, 0], [xb - xc, front(ub)], [xa - xc, front(ua)]]), -fold],
        [dedupe([[xa - xc, 0], [xa - xc, -back(ua)], [xb - xc, -back(ub)], [xb - xc, 0]]), fold],
      ];
      for (const [outline, a] of halves) if (outline.length >= 3) parts.push({ shape: 'prism', outline, height: t, position: [xc, ys(xc), zMid], rotation: [a, 0, th], slot: 'shade' });
    }
    // LED housing and glowing lens under the middle of the leaf.
    const yTop = ys(0) + 0.002;
    parts.push(cyl('metal', [0, (0.012 + yTop) / 2, zMid], 0.032, yTop - 0.012, { segments: 24, plan: false }));
    parts.push(cyl('light', [0, 0.008, zMid], 0.026, 0.008, { segments: 24, plan: false }));
    // Slim linear canopy, two fine suspension wires with grippers and a thin power cord.
    const xw = L * 0.3;
    parts.push(span('metal', [-xw - 0.04, xw + 0.04], [h - 0.02, h], [zMid - 0.028, zMid + 0.028], { bevel: 0.008, plan: false }));
    for (const x of [-xw, xw]) {
      const ya = ys(x) + t;
      parts.push(rod('metal', [x, ya, zMid], [x, h - 0.02, zMid], 0.0012, { segments: 6, plan: false }));
      parts.push(cyl('metal', [x, ya + 0.016, zMid], 0.0035, 0.022, { segments: 8, plan: false }));
    }
    parts.push(rod('metal', [0, ys(0) + t, zMid], [0, h - 0.02, zMid], 0.0018, { segments: 6, plan: false }));
    return keep(parts, size);
  },
});

// ───────────── 4. Dome wall sconce ─────────────

function domeGeom({ w, d, h }: Size3) {
  const R = Math.min(w, h) / 2;
  const pt = clamp(d * 0.12, 0.012, 0.02);
  const Rd = R * 0.78;
  const dz = Math.min(Rd, d - pt - 0.012);
  const collar = Math.max(0.006, d - pt - dz);
  return { R, pt, Rd, dz, collar, z0: -d / 2 + pt + collar };
}

const DOME_DEFAULT: Size3 = { w: 0.22, d: 0.14, h: 0.22 };

const domeSconce = defineItem({
  id: 'dome-wall-sconce',
  name: 'Dome wall sconce',
  category: 'lighting',
  type: 'lighting',
  group: 'Wall lights',
  tags: ['wall light', 'sconce', 'dome', 'opal glass', 'black', 'bedside', 'đèn tường', 'đèn gắn tường'],
  description: 'A round black backplate with a short collar and a fine ring holding a half-dome opal glass shade that glows softly towards the room.',
  defaultSize: DOME_DEFAULT,
  minSize: { w: 0.14, d: 0.09, h: 0.14 },
  maxSize: { w: 0.4, d: 0.25, h: 0.4 },
  mount: 'wall',
  defaultElevation: 1.8,
  wallSnap: true,
  slots: [matSlot('body', 'Backplate & ring', 'metal-black-matte'), matSlot('light', 'Opal shade', 'light-warm')],
  light: (() => {
    const g = domeGeom(DOME_DEFAULT);
    return { color: WARM, intensity: 0.6, distance: 3, y: DOME_DEFAULT.h / 2, z: g.z0 + g.dz * 0.4 };
  })(),
  variants: [
    { id: 'brass', name: 'Brass', materials: { body: 'metal-brass' } },
    { id: 'white', name: 'White', materials: { body: 'metal-white-powder' } },
  ],
  build: (size) => {
    const { d, h } = size;
    const { R, pt, Rd, dz, collar, z0 } = domeGeom(size);
    const yc = h / 2;
    const zb = -d / 2;
    // Backplate (a disc facing the room) and the collar that holds the shade.
    const parts: Part[] = [
      cyl('body', [0, yc, zb + pt / 2], R, pt, { rotation: [Math.PI / 2, 0, 0], segments: 40 }),
      cyl('body', [0, yc, zb + pt + collar / 2], Rd + 0.004, collar + 0.001, { rotation: [Math.PI / 2, 0, 0], segments: 40, plan: false }),
      torus('body', [0, yc, z0], Rd + 0.002, Math.min(0.005, Rd * 0.06), o),
    ];
    // Half-dome shade: a lathe turned to face +z (profile from the rim to the crown).
    const dome = lathe('light', [0, 0, 0], arc(0, 0, Rd, dz, 0, Math.PI / 2, 12).map(([r, y]) => [Math.max(0, r), y] as V2), { segments: 40, plan: false });
    dome.position = [0, yc, z0 + dz / 2];
    dome.rotation = [Math.PI / 2, 0, 0];
    parts.push(dome);
    return keep(parts, size);
  },
});

// ───────────── 5. Low round tea table with arched legs ─────────────

/** Panel outline [along, y] L long and H tall with an arched opening cut up from the floor. */
function archPanel(L: number, H: number): V2[] {
  const legW = clamp(L * 0.15, 0.06, 0.12);
  const a = L / 2 - legW;
  const open = H - clamp(H * 0.2, 0.05, 0.09);
  const ry = Math.min(a, open - 0.02);
  const ys = open - ry;
  return dedupe([[-L / 2, 0], [-a, 0], [-a, ys], ...arc(0, ys, a, ry, Math.PI, 0, 18), [a, ys], [a, 0], [L / 2, 0], [L / 2, H], [-L / 2, H]]);
}

const archedTeaTable = defineItem({
  id: 'arched-leg-tea-table',
  name: 'Low round tea table with arched legs',
  category: 'living',
  type: 'surfaces',
  group: 'Coffee tables',
  tags: ['tea table', 'coffee table', 'round', 'low table', 'oak', 'arched', 'floor seating', 'bàn trà'],
  description: 'A low round oak tea table for floor sitting: a thick top with an eased edge on two crossing oak panels, each cut with a soft arch so the base reads as four arched legs.',
  defaultSize: { w: 0.9, d: 0.9, h: 0.38 },
  minSize: { w: 0.6, d: 0.6, h: 0.3 },
  maxSize: { w: 1.2, d: 1.2, h: 0.5 },
  slots: [matSlot('top', 'Top', 'wood-oak-light'), matSlot('base', 'Base', 'wood-oak-light')],
  variants: [
    { id: 'walnut', name: 'Walnut', materials: { top: 'wood-walnut', base: 'wood-walnut' } },
    { id: 'smoked', name: 'Smoked oak', materials: { top: 'wood-smoked-oak', base: 'wood-smoked-oak' } },
    { id: 'white-oak-dark-base', name: 'White oak on dark base', materials: { top: 'wood-white-oak', base: 'wood-dark-stain' } },
  ],
  build: (size) => {
    const { w, d, h } = size;
    const t = 0.03;
    const H = h - t;
    const pt = clamp(Math.min(w, d) * 0.035, 0.024, 0.04);
    const parts: Part[] = easedSlab('top', (i) => ellipsePoints(0, 0, w / 2 - i, d / 2 - i, 64), H, t, 0.006);
    parts.push(panelXY('base', archPanel(w * 0.76, H), -pt / 2, pt, true));
    parts.push(panelZY('base', archPanel(d * 0.76, H), 0, pt, true));
    return keep(parts, size);
  },
});

// ───────────── 6. Palm-leaf ceiling fan ─────────────

const FAN_DEFAULT: Size3 = { w: 1.3, d: 1.3, h: 0.45 };

const palmLeafFan = defineItem({
  id: 'palm-leaf-fan',
  name: 'Ceiling fan with rattan palm-leaf blades',
  category: 'living',
  type: 'electronics',
  group: 'Climate',
  tags: ['ceiling fan', 'fan', 'palm leaf', 'rattan', 'tropical', 'colonial', 'quạt trần', 'quạt lá'],
  description: 'A tropical ceiling fan with five pointed palm-leaf blades of woven rattan on dark wooden spines and arms, a turned dark wood motor housing with a brass band, a downrod and a canopy.',
  defaultSize: FAN_DEFAULT,
  minSize: { w: 1.0, d: 1.0, h: 0.32 },
  maxSize: { w: 1.6, d: 1.6, h: 0.8 },
  mount: 'ceiling',
  defaultElevation: CEILING - FAN_DEFAULT.h,
  slots: [matSlot('body', 'Housing, spines & arms', 'wood-dark-stain'), matSlot('blades', 'Blades', 'rattan-natural'), matSlot('trim', 'Band & rod', 'metal-brass')],
  variants: [
    { id: 'woven-bamboo', name: 'Woven bamboo blades', materials: { blades: 'bamboo-woven' } },
    { id: 'walnut-black', name: 'Walnut & black', materials: { body: 'wood-walnut', trim: 'metal-black-matte' } },
    { id: 'fine-wicker', name: 'Fine wicker on light oak', materials: { blades: 'wicker-fine', body: 'wood-oak-light' } },
  ],
  build: (size) => {
    const { w, d, h } = size;
    const R = Math.min(w, d) / 2 - 0.005;
    const rh = clamp(R * 0.15, 0.08, 0.11);
    const yb = 0.1;
    const hTop = 0.18;
    const parts: Part[] = [
      // Canopy and downrod.
      lathe('body', [0, h - 0.07, 0], [[0.03, 0], [0.06, 0.03], [0.075, 0.06], [0.075, 0.07]], { segments: 32 }),
      rod('trim', [0, hTop - 0.01, 0], [0, h - 0.065, 0], 0.013, { segments: 12, plan: false }),
      // Turned motor housing with a brass band, and a finial underneath.
      lathe('body', [0, 0.03, 0], [[rh * 0.45, 0], [rh * 0.85, 0.02], [rh, 0.055], [rh, 0.1], [rh * 0.8, 0.13], [rh * 0.35, hTop - 0.03]], { segments: 40 }),
      torus('trim', [0, 0.115, 0], rh * 0.99, 0.006, { rotation: [Math.PI / 2, 0, 0], plan: false }),
      sphere('body', [0, Math.max(0.03, rh * 0.3 + 0.001), 0], rh * 0.42, { scale: [1, 0.7, 1], plan: false }),
    ];
    // Five leaf blades: pointed outline, woven panel on an arm, a wooden spine along the middle.
    const r0 = rh + clamp(R * 0.12, 0.06, 0.1);
    const Lb = R - r0;
    const Wb = Lb * 0.44;
    const pitch = 0.16;
    const outline: V2[] = [];
    const nS = 14;
    for (const k of range(nS + 1)) {
      const s = k / nS;
      outline.push([(Wb / 2) * Math.pow(Math.sin(Math.PI * Math.pow(s, 0.8)), 0.75), s * Lb - Lb / 2]);
    }
    for (const k of range(nS + 1).reverse()) outline.push([-outline[k][0], outline[k][1]]);
    const blade = dedupe(outline);
    for (const k of range(5)) {
      const a = (k * 2 * Math.PI) / 5;
      const dir: V2 = [Math.sin(a), Math.cos(a)];
      const at = (r: number, y: number): V3 => [dir[0] * r, y, dir[1] * r];
      const c = at(r0 + Lb / 2, yb);
      parts.push({ shape: 'prism', outline: blade, height: 0.008, position: c, rotation: [0, a, pitch], slot: 'blades' });
      parts.push(rod('body', at(r0 - 0.01, yb + 0.012), at(R - 0.04, yb + 0.01), 0.006, { segments: 8, plan: false }));
      // Flat arm from the housing under the blade root.
      const ra = rh * 0.85;
      const rb = r0 + Math.min(0.1, Lb * 0.25);
      const m = at((ra + rb) / 2, yb - 0.008);
      parts.push({ shape: 'box', size: [0.032, 0.014, rb - ra], bevel: 0.004, position: m, rotation: [0, a, 0], slot: 'body', plan: false });
    }
    return keep(parts, size);
  },
});

// ───────────── 7. Oval fluted drum coffee table ─────────────

const flutedOvalTable = defineItem({
  id: 'fluted-oval-coffee-table',
  name: 'Oval fluted drum coffee table',
  category: 'living',
  type: 'surfaces',
  group: 'Coffee tables',
  tags: ['coffee table', 'oval', 'fluted', 'reeded', 'drum', 'oak', 'japandi', 'bàn trà'],
  description: 'An oval oak coffee table whose top rests on a drum of close vertical reeds, standing on a recessed plinth so the base seems to float.',
  defaultSize: { w: 1.0, d: 0.6, h: 0.4 },
  minSize: { w: 0.7, d: 0.45, h: 0.3 },
  maxSize: { w: 1.4, d: 0.9, h: 0.48 },
  slots: [matSlot('top', 'Top', 'wood-white-oak'), matSlot('base', 'Fluted base', 'wood-white-oak')],
  variants: [
    { id: 'walnut', name: 'Walnut', materials: { top: 'wood-walnut', base: 'wood-walnut' } },
    { id: 'marble-oak', name: 'Marble top on oak', materials: { top: 'stone-marble-beige' } },
    { id: 'plaster', name: 'Oak on plaster drum', materials: { base: 'venetian-white' } },
  ],
  build: (size) => {
    const { w, d, h } = size;
    const t = 0.032;
    const H = h - t;
    const parts: Part[] = easedSlab('top', (i) => ellipsePoints(0, 0, w / 2 - i, d / 2 - i, 64), H, t, 0.006);
    const rx = w * 0.36;
    const rz = d * 0.36;
    const fr = 0.017;
    const pl = 0.035;
    // Recessed plinth and the core of the drum.
    parts.push(prism('base', ellipsePoints(0, 0, rx - 0.03, rz - 0.03, 48), 0, pl + 0.002));
    parts.push(prism('base', ellipsePoints(0, 0, rx - fr * 0.8, rz - fr * 0.8, 48), pl, H - pl, o));
    // Reeds, counted from the drum's perimeter.
    const ring = ellipsePoints(0, 0, rx - fr, rz - fr, 96);
    const n = clamp(Math.round(perimeter(ring) / (fr * 2.15)), 16, 120);
    for (const [x, z] of alongOutline(ring, n)) parts.push(cyl('base', [x, (pl + H) / 2, z], fr, H - pl, { segments: 10, plan: false }));
    return keep(parts, size);
  },
});

// ───────────── 8. Floating rounded vanity shelf ─────────────

const vanityShelf = defineItem({
  id: 'floating-vanity-shelf',
  name: 'Floating rounded vanity shelf with two drawers',
  category: 'bedroom',
  type: 'surfaces',
  group: 'Vanity & dressing tables',
  tags: ['vanity', 'dressing table', 'floating shelf', 'wall-hung', 'walnut', 'drawers', 'rounded', 'bàn trang điểm'],
  description: 'A wall-hung walnut dressing shelf with fully rounded ends, two drawers with brass knobs and a shadow gap underneath so it seems to float.',
  defaultSize: { w: 0.6, d: 0.3, h: 0.15 },
  minSize: { w: 0.4, d: 0.22, h: 0.1 },
  maxSize: { w: 1.4, d: 0.45, h: 0.25 },
  mount: 'wall',
  defaultElevation: 0.6,
  wallSnap: true,
  slots: [matSlot('body', 'Body', 'wood-walnut'), matSlot('fronts', 'Drawer fronts', 'wood-walnut'), matSlot('knobs', 'Knobs', 'metal-brass')],
  variants: [
    { id: 'white-oak', name: 'White oak', materials: { body: 'wood-white-oak', fronts: 'wood-white-oak' } },
    { id: 'smoked-black', name: 'Smoked oak, black knobs', materials: { body: 'wood-smoked-oak', fronts: 'wood-smoked-oak', knobs: 'metal-black-matte' } },
    { id: 'cream', name: 'Cream plaster front', materials: { fronts: 'venetian-white' } },
  ],
  build: (size) => {
    const { w, d, h } = size;
    const db = d - 0.03;
    const zc = -d / 2 + db / 2;
    const r = Math.min(db / 2, w * 0.3);
    const out = (i: number) => roundRectPoints(0, zc, w - 2 * i, db - 2 * i, Math.max(0.005, r - i), 10);
    const gap = Math.min(0.014, h * 0.1);
    // Shadow gap at the bottom, then the body with eased top edge.
    const parts: Part[] = [prism('body', out(0.012), 0, gap + 0.001, o), prism('body', out(0), gap, h - gap - 0.005), prism('body', out(0.004), h - 0.005, 0.005, o)];
    // Two drawers across the flat front.
    const zf = -d / 2 + db;
    const x0 = -w / 2 + r;
    const x1 = w / 2 - r;
    for (const [a, b] of cellSpans(2, x0, x1)) {
      parts.push(span('fronts', [a + 0.0015, b - 0.0015], [gap + 0.006, h - 0.012], [zf - 0.01, zf + 0.003], { bevel: 0.0015, plan: false }));
      parts.push(...knob('knobs', [(a + b) / 2, (gap + h) / 2, zf + 0.003], clamp(h * 0.07, 0.007, 0.011)));
    }
    return keep(parts, size);
  },
});

// ───────────── 9. Wood-framed mirror with curved shoulders ─────────────

/** Mirror outline [x, y] offset inwards by `i`: straight sides, rounded shoulders and an arched crown. */
function shoulderOutline(W: number, H: number, i: number): V2[] {
  const rs = clamp(W * 0.14, 0.035, 0.14);
  let ry = clamp(W * 0.28, 0.06, 0.3);
  ry = Math.min(ry, H * 0.65 - rs);
  const rx = W / 2 - rs;
  const ys = H - rs - ry;
  const yt = ys + rs;
  return [
    [-W / 2 + i, i],
    [W / 2 - i, i],
    ...arc(rx, ys, rs - i, rs - i, 0, Math.PI / 2, 6),
    [rx - i, yt - i],
    ...arc(0, yt, rx - i, ry - i, 0, Math.PI, 18),
    [-rx + i, yt - i],
    ...arc(-rx, ys, rs - i, rs - i, Math.PI / 2, Math.PI, 6),
  ];
}

const shoulderedMirror = defineItem({
  id: 'shouldered-mirror',
  name: 'Wood-framed mirror with curved shoulders',
  category: 'bedroom',
  type: 'decor',
  group: 'Mirrors',
  tags: ['mirror', 'wall mirror', 'vintage', 'arched', 'shoulders', 'walnut', 'gương', 'gương treo tường'],
  description: 'A tall wall mirror with a vintage outline: rounded shoulders stepping up to a softly arched crown, in a slim walnut frame.',
  defaultSize: { w: 0.5, d: 0.03, h: 0.8 },
  minSize: { w: 0.3, d: 0.02, h: 0.45 },
  maxSize: { w: 1.0, d: 0.06, h: 1.8 },
  mount: 'wall',
  defaultElevation: 1.0,
  wallSnap: true,
  slots: [matSlot('frame', 'Frame', 'wood-walnut'), matSlot('glass', 'Mirror', 'glass-mirror')],
  variants: [
    { id: 'oak', name: 'Light oak', materials: { frame: 'wood-oak-light' } },
    { id: 'brass', name: 'Brass frame', materials: { frame: 'metal-brass' } },
    { id: 'black', name: 'Black frame', materials: { frame: 'metal-black-matte' } },
  ],
  build: (size) => {
    const { w, d, h } = size;
    const fw = clamp(w * 0.05, 0.018, 0.035);
    const outer = shoulderOutline(w, h, 0);
    const inner = shoulderOutline(w, h, fw);
    const parts: Part[] = [
      panelXY('frame', dedupe(outer), -d / 2, d - 0.008, true),
      panelXY('glass', dedupe(inner), d / 2 - 0.008, 0.004),
    ];
    // Raised frame rim: one quad per outline segment between the outer and inner edges.
    for (const k of range(outer.length)) {
      const q = dedupe([outer[k], outer[(k + 1) % outer.length], inner[(k + 1) % inner.length], inner[k]]);
      if (q.length >= 3) parts.push(panelXY('frame', q, d / 2 - 0.012, 0.012));
    }
    return keep(parts, size);
  },
});

// ───────────── 10. Stacked donut pouf ─────────────

const donutPouf = defineItem({
  id: 'stacked-donut-pouf',
  name: 'Stacked donut pouf',
  category: 'living',
  type: 'seating',
  group: 'Ottomans & poufs',
  tags: ['pouf', 'ottoman', 'stacked', 'donut', 'velvet', 'boucle', 'playful', 'đôn', 'ghế đôn'],
  description: 'A playful pouf of three stacked, piped cushions shaped like soft doughnuts: two mustard velvet rings on a cream bouclé base, raised on tiny wooden bun feet.',
  defaultSize: { w: 0.45, d: 0.45, h: 0.5 },
  minSize: { w: 0.35, d: 0.35, h: 0.35 },
  maxSize: { w: 0.7, d: 0.7, h: 0.6 },
  slots: [matSlot('top', 'Top cushions', 'fabric-velvet-mustard'), matSlot('base', 'Base cushion', 'fabric-boucle'), matSlot('feet', 'Feet', 'wood-walnut')],
  variants: [
    { id: 'sage-oat', name: 'Sage & oat', materials: { top: 'fabric-velvet-sage', base: 'fabric-boucle-oat' } },
    { id: 'rust', name: 'Rust velvet', materials: { top: 'fabric-velvet-rust' } },
    { id: 'all-boucle', name: 'All bouclé', materials: { top: 'fabric-boucle-oat', feet: 'wood-oak-light' } },
  ],
  build: (size) => {
    const { w, d, h } = size;
    const m = Math.min(w, d) / 2;
    const sx = w / 2 / m;
    const sz = d / 2 / m;
    const fh = clamp(h * 0.07, 0.025, 0.04);
    const ov = 0.02;
    const total = h - fh + 0.005 + 2 * ov;
    const layers: [string, number, number][] = [
      ['base', 0.36, 1],
      ['top', 0.33, 0.96],
      ['top', 0.31, 0.93],
    ];
    const parts: Part[] = [];
    let y = fh - 0.005;
    for (const [i, [slot, frac, k]] of layers.entries()) {
      const hv = (total * frac) / 2;
      const Ro = m * k - 0.002;
      const rt = Ro * 0.45;
      const R = Ro - rt;
      const yc = y + hv;
      // Doughnut ring, flattened to the layer height; a soft fill in its hole (a dimple on top).
      parts.push(torus(slot, [0, yc, 0], R, rt, { rotation: [Math.PI / 2, 0, 0], scale: [sx, sz, hv / rt], plan: i === 0 }));
      const top = i === layers.length - 1;
      parts.push(sphere(slot, [0, yc - (top ? hv * 0.2 : 0), 0], 1, { scale: [R * sx, hv * (top ? 0.75 : 0.9), R * sz], plan: false }));
      // Piping round the widest point.
      parts.push(torus(slot, [0, yc, 0], Ro - 0.004, 0.0045, { rotation: [Math.PI / 2, 0, 0], scale: [sx, sz, 1], plan: false }));
      if (top) parts.push(sphere(slot, [0, yc + hv * 0.52, 0], Math.min(0.016, R * 0.25), { scale: [1, 0.55, 1], plan: false }));
      y = yc + hv - ov;
    }
    // Tiny bun feet.
    for (const a of [0.25, 0.75, 1.25, 1.75]) parts.push(turnedLeg('feet', Math.cos(a * Math.PI) * m * 0.55 * sx, Math.sin(a * Math.PI) * m * 0.55 * sz, 0, fh, clamp(m * 0.11, 0.018, 0.03), { style: 'bun' }));
    return keep(parts, size);
  },
});

// ───────────── 11. Walnut bed with rolled velvet headboard ─────────────

/** Pillow height that keeps a leaning pillow, sunk 3 cm into the mattress, within `avail` of height. */
const fitPillow = (avail: number, want: number, t: number, lean: number) => clamp((avail - t * Math.sin(lean)) / Math.cos(lean), 0.1, want);
/** Centre height of a leaning pillow sitting 3 cm into a mattress whose top is at `top`. */
const pillowY = (top: number, ph: number, t: number, lean: number) => top - 0.03 + (ph * Math.cos(lean) + t * Math.sin(lean)) / 2;

const rolledBed = defineItem({
  id: 'rolled-headboard-bed',
  name: 'Walnut bed with rolled velvet headboard',
  category: 'bedroom',
  type: 'beds',
  group: 'Beds',
  tags: ['bed', 'queen bed', 'walnut', 'velvet headboard', 'channel tufted', 'bolster', 'mid-century', 'giường'],
  description:
    'A low walnut platform bed with a raised lip around the mattress and a headboard of horizontal channel-quilted mustard velvet under a rolled bolster, dressed with white sheets, pillows and a folded throw.',
  defaultSize: { w: 1.75, d: 2.15, h: 1.05 },
  minSize: { w: 1.15, d: 2.05, h: 0.85 },
  maxSize: { w: 2.15, d: 2.3, h: 1.3 },
  wallSnap: true,
  slots: [matSlot('frame', 'Frame', 'wood-walnut'), matSlot('headboard', 'Headboard', 'fabric-velvet-mustard'), matSlot('bedding', 'Sheets & pillows', 'fabric-white-cotton'), matSlot('throw', 'Throw & cushion', 'fabric-linen')],
  variants: [
    { id: 'sage', name: 'Sage velvet', materials: { headboard: 'fabric-velvet-sage', throw: 'fabric-linen-sage' } },
    { id: 'oak-boucle', name: 'Oak & oat bouclé', materials: { frame: 'wood-white-oak', headboard: 'fabric-boucle-oat', throw: 'fabric-teddy-cream' } },
    { id: 'rust', name: 'Rust velvet', materials: { headboard: 'fabric-velvet-rust', throw: 'fabric-linen-rust' } },
  ],
  build: (size) => {
    const { w, d, h } = size;
    const z0 = -d / 2;
    const lipT = 0.05;
    const side = 0.075;
    const plinth = 0.07;
    const deck = 0.22;
    const lipTop = 0.29;
    const back = 0.03;
    const hbT = 0.12;
    const zH = z0 + hbT;
    const parts: Part[] = [
      // Recessed plinth, platform and the raised lip at the sides and foot.
      span('frame', [-w / 2 + 0.08, w / 2 - 0.08], [0, plinth + 0.002], [z0 + back + 0.06, d / 2 - 0.08], o),
      span('frame', [-w / 2, w / 2], [plinth, deck], [z0 + back, d / 2], { bevel: 0.01 }),
      span('frame', [-w / 2, -w / 2 + lipT], [deck - 0.01, lipTop], [zH, d / 2], { bevel: 0.012, plan: false }),
      span('frame', [w / 2 - lipT, w / 2], [deck - 0.01, lipTop], [zH, d / 2], { bevel: 0.012, plan: false }),
      span('frame', [-w / 2 + lipT - 0.005, w / 2 - lipT + 0.005], [deck - 0.01, lipTop], [d / 2 - lipT, d / 2], { bevel: 0.012, plan: false }),
      // Walnut headboard back.
      span('frame', [-w / 2, w / 2], [plinth, h - 0.03], [z0, z0 + back], { bevel: 0.008 }),
    ];
    // Rolled bolster along the top with piped ends.
    const rB = 0.072;
    const zB = z0 + back + rB * 0.85;
    parts.push(rodX('headboard', -w / 2 + 0.004, w / 2 - 0.004, h - rB, zB, rB, { segments: 28, plan: false }));
    for (const s of [-1, 1]) parts.push(torus('headboard', [s * (w / 2 - 0.006), h - rB, zB], rB - 0.006, 0.005, { rotation: [0, Math.PI / 2, 0], plan: false }));
    // Horizontal channels, counted from the height under the bolster.
    const yt = h - 2 * rB + 0.02;
    const nC = clamp(Math.round((yt - deck) / 0.1), 3, 10);
    for (const [a, b] of cellSpans(nC, deck, yt)) parts.push(span('headboard', [-w / 2 + 0.012, w / 2 - 0.012], [a - 0.004, b + 0.004], [z0 + back - 0.002, zH], { bevel: (b - a) * 0.4, plan: false }));

    // Bedding: mattress, duvet with a turned-down sheet, pillows, a lumbar cushion and a folded throw.
    const a0 = -w / 2 + side;
    const a1 = w / 2 - side;
    const l0 = zH + 0.005;
    const l1 = d / 2 - lipT - 0.02;
    const top = deck + 0.22;
    const mw = a1 - a0;
    const ov = 0.025;
    parts.push(span('bedding', [a0, a1], [deck, top], [l0, l1], { bevel: 0.04 }));
    const fold = l0 + clamp((l1 - l0) * 0.27, 0.4, 0.6);
    const drop = lipTop + 0.012;
    const sd = { bevel: 0.006, plan: false };
    parts.push(
      span('bedding', [a0 - ov * 0.6, a1 + ov * 0.6], [top - 0.012, top + 0.05], [fold, l1 + ov * 0.6], { bevel: 0.024, plan: false }),
      span('bedding', [a0 - ov, a0 - ov + 0.016], [drop, top + 0.035], [fold + 0.03, l1 + ov - 0.01], sd),
      span('bedding', [a1 + ov - 0.016, a1 + ov], [drop, top + 0.035], [fold + 0.03, l1 + ov - 0.01], sd),
      span('bedding', [a0 - ov + 0.01, a1 + ov - 0.01], [drop, top + 0.035], [l1 + ov - 0.016, l1 + ov], sd),
      span('bedding', [a0 - ov * 0.8, a1 + ov * 0.8], [top + 0.035, top + 0.085], [fold, fold + 0.22], { bevel: 0.022, plan: false }),
      span('bedding', [a0 - 0.004, a1 + 0.004], [top + 0.075, top + 0.093], [fold + 0.02, fold + 0.12], { bevel: 0.008, plan: false }),
    );
    // Pillows: rectangular sleeping pillows standing against the headboard, kept under its top,
    // with two square accent cushions leaning in front of them.
    const n = mw >= 1.15 ? 2 : 1;
    const pw = n === 1 ? Math.min(0.66, mw - 0.1) : Math.min(0.7, mw / n - 0.04);
    const avail = h - top + 0.03 - 0.01;
    const xs = range(n).map((i) => a0 + ((i + 0.5) * mw) / n);
    /** A soft rectangular cushion standing on the mattress, its back leaning towards the head by `lean`. */
    const standing = (slot: string, x: number, zBack: number, cw: number, ch: number, ct: number, lean: number, turn = 0): number => {
      const depth = ct * Math.cos(lean) + ch * Math.sin(lean);
      const zc = zBack + depth / 2;
      parts.push(cushion(slot, [x - cw / 2, x + cw / 2], [pillowY(top, ch, ct, lean) - ch / 2, pillowY(top, ch, ct, lean) + ch / 2], [zc - ct / 2, zc + ct / 2], { softness: 0.45, rotation: [-lean, turn, 0], plan: false }));
      return zBack + depth;
    };
    const pLean = 0.3;
    const ph = fitPillow(avail, 0.48, 0.15, pLean);
    let zFront = l0;
    for (const x of xs) zFront = standing('bedding', x, l0 + 0.005, pw, ph, 0.15, pLean);
    const cLean = 0.26;
    const cs = Math.min(0.45, mw * 0.27, fitPillow(avail - 0.04, 0.45, 0.12, cLean));
    for (const sx of [-1, 1]) standing('throw', sx * Math.min(cs * 0.56, mw / 4), zFront - 0.04, cs, cs, 0.12, cLean, sx * 0.12);
    // Throw folded across the foot, hanging down both sides.
    const tl: V2 = [l1 - Math.min(0.52, (l1 - l0) * 0.27), l1 - 0.16];
    const td = Math.max(lipTop + 0.02, top - 0.17);
    parts.push(
      span('throw', [a0 - ov - 0.006, a1 + ov + 0.006], [top + 0.045, top + 0.072], tl, { bevel: 0.01, plan: false }),
      span('throw', [a0 - ov - 0.02, a0 - ov - 0.006], [td, top + 0.072], tl, { bevel: 0.005, plan: false }),
      span('throw', [a1 + ov + 0.006, a1 + ov + 0.02], [td, top + 0.072], tl, { bevel: 0.005, plan: false }),
    );
    return keep(parts, size);
  },
});

// ───────────── 12. Wall-backed peninsula dining table on turned bead leg ─────────────

const wallPeninsulaBeadTable = defineItem({
  id: 'wall-peninsula-bead-table',
  name: 'Wall-backed peninsula dining table on turned bead leg',
  category: 'dining',
  type: 'surfaces',
  group: 'Dining tables',
  wallSnap: true,
  tags: [
    'dining table',
    'peninsula table',
    'breakfast table',
    'wall table',
    'half-oval',
    'sage green',
    'pastel',
    'turned leg',
    'pedestal',
    'kitchen',
    'bàn ăn',
    'bàn ăn sát tường',
    'bàn bán đảo',
    'bàn ăn nhỏ',
  ],
  description:
    'A compact wall-backed peninsula dining table with a flat wall edge, generously rounded front corners, a rounded-bottom wall support panel and a sculptural white turned pedestal leg with a central bead orb.',
  defaultSize: { w: 0.8, d: 1.25, h: 0.76 },
  minSize: { w: 0.65, d: 0.9, h: 0.72 },
  maxSize: { w: 1.15, d: 1.85, h: 0.92 },
  price: { vnd: 4_800_000, estimate: true },
  slots: [matSlot('top', 'Top & wall panel', 'laminate-sage'), matSlot('base', 'Turned pedestal leg', 'paint-satin-white')],
  variants: [
    { id: 'cream-white', name: 'Cream lacquer & white', materials: { top: 'laminate-cream', base: 'paint-satin-white' } },
    { id: 'butter-white', name: 'Butter yellow & white', materials: { top: 'paint-butter', base: 'paint-satin-white' } },
    { id: 'pink-white', name: 'Dusty pink & white', materials: { top: 'laminate-pink', base: 'paint-satin-white' } },
    { id: 'oak-white', name: 'Light oak & warm white', materials: { top: 'wood-oak-light', base: 'paint-warm-white' } },
    { id: 'walnut-cream', name: 'Walnut & cream plaster', materials: { top: 'wood-walnut', base: 'venetian-white' } },
    { id: 'marble-white', name: 'Beige marble & white', materials: { top: 'stone-marble-beige', base: 'paint-satin-white' } },
  ],
  build: (size) => {
    const { w, d, h } = size;
    const topT = 0.036;
    const H = h - topT;

    // Flat back edge against the wall (-z), generously rounded front corners (+z).
    const rFrontBase = Math.min(0.145, w * 0.23, d * 0.22);
    const peninsulaOutline = (inset: number): V2[] => {
      const x1 = w / 2 - inset;
      const z0 = -d / 2 + inset;
      const z1 = d / 2 - inset;
      const rb = Math.max(0.002, 0.005 - inset);
      const rf = Math.max(0.015, rFrontBase - inset);
      return [
        ...arc(-x1 + rb, z0 + rb, rb, rb, Math.PI, Math.PI * 1.5, 2),
        ...arc(x1 - rb, z0 + rb, rb, rb, -Math.PI / 2, 0, 2),
        ...arc(x1 - rf, z1 - rf, rf, rf, 0, Math.PI / 2, 12),
        ...arc(-x1 + rf, z1 - rf, rf, rf, Math.PI / 2, Math.PI, 12),
      ];
    };
    const parts: Part[] = easedSlab('top', peninsulaOutline, H, topT, 0.006);

    // Matching wall-end vertical support panel with generously rounded bottom corners.
    const pw = clamp(w * 0.72, 0.42, w - 0.14);
    const yP0 = 0.004;
    const yP1 = H + 0.008;
    const rPanel = Math.min(0.09, pw * 0.24, (yP1 - yP0) * 0.25);
    const panelOutline = (inset: number): V2[] => {
      const xh = pw / 2 - inset;
      const y0 = yP0 + inset;
      const rr = Math.max(0.01, rPanel - inset);
      return [
        [-xh, yP1],
        [xh, yP1],
        ...arc(xh - rr, y0 + rr, rr, rr, 0, -Math.PI / 2, 10),
        ...arc(-xh + rr, y0 + rr, rr, rr, -Math.PI / 2, -Math.PI, 10),
      ];
    };
    const zBack = -d / 2 + 0.002;
    parts.push(
      panelXY('top', panelOutline(0.0025), zBack, 0.003),
      panelXY('top', panelOutline(0), zBack + 0.003, 0.026),
      panelXY('top', panelOutline(0.0025), zBack + 0.029, 0.003),
      span('top', [-pw / 2 + rPanel + 0.02, pw / 2 - rPanel - 0.02], [0, yP0], [zBack + 0.006, zBack + 0.026], o),
      span('top', [-pw / 2 + 0.025, pw / 2 - 0.025], [H - 0.042, H + 0.006], [zBack + 0.028, zBack + 0.085], o),
    );

    // Sculptural turned white pedestal leg near the front: tall tapered lower cone, central sphere orb
    // around 60% height, tall upper inverted conical flare and sub-top mounting plate.
    const rFoot = clamp(Math.min(w, d) * 0.132, 0.09, 0.118);
    const zPed = d / 2 - Math.max(rFoot + 0.12, d * 0.19);
    const rNeck = rFoot * 0.39;
    const yW1 = H * 0.52;
    const yW2 = H * 0.685;
    const yOrb = (yW1 + yW2) / 2;
    const halfBand = (yW2 - yW1) / 2;
    const rSphere = Math.hypot(rNeck, halfBand);
    const thMax = Math.asin(clamp(halfBand / rSphere, -0.98, 0.98));
    const orbProfile: V2[] = range(17).map((i) => {
      const th = -thMax + (2 * thMax * i) / 16;
      return [rSphere * Math.cos(th), yOrb + rSphere * Math.sin(th)] as V2;
    });
    const rTopCone = rFoot * 0.9;
    const rPlate = rFoot * 1.1;
    const profile: V2[] = [
      [0, 0],
      [rFoot - 0.003, 0],
      [rFoot, 0.005],
      ...orbProfile,
      [rTopCone, H - 0.013],
      [rPlate, H - 0.011],
      [rPlate, H - 0.002],
      [rPlate - 0.004, H + 0.003],
      [0, H + 0.003],
    ];
    parts.push(lathe('base', [0, 0, zPed], profile, { segments: 36, plan: false }));

    return keep(parts, size);
  },
});

// ───────────── 13. Rounded-corner full-length wall mirror ─────────────

function buildRoundedWallMirror(size: Size3, rimStyle: 'slim' | 'wide' | 'micro' = 'slim'): Part[] {
  const { w, d, h } = size;
  const z0 = -d / 2;
  const z1 = d / 2;
  const r = clamp(Math.min(w, h) * 0.095, 0.02, 0.044);
  const wantBezel =
    rimStyle === 'wide'
      ? clamp(Math.min(w, h) * 0.058, 0.018, 0.028)
      : rimStyle === 'micro'
        ? clamp(Math.min(w, h) * 0.012, 0.004, 0.006)
        : clamp(Math.min(w, h) * 0.024, 0.008, 0.013);
  const bezel = Math.min(wantBezel, r - 0.004);

  const cleatT = clamp(d * 0.12, 0.002, 0.005);
  const rimRecess = clamp(d * 0.16, 0.003, 0.007);
  const glassT = clamp(d * 0.12, 0.0025, 0.004);
  const lipT = Math.min(0.0015, rimRecess * 0.4);
  const zGlassFront = z1 - rimRecess;
  const zGlassBack = zGlassFront - glassT;
  const zBody0 = z0 + cleatT - 0.0005;
  const zBody1 = zGlassBack + 0.001;

  const seg = 8;
  const outer = roundRectPoints(0, h / 2, w, h, r, seg);
  const outerEase = roundRectPoints(0, h / 2, w - 0.0024, h - 0.0024, Math.max(0.002, r - 0.0012), seg);
  const inner = roundRectPoints(0, h / 2, w - 2 * bezel, h - 2 * bezel, Math.max(0.003, r - bezel), seg);

  const parts: Part[] = [
    // Concealed wall-mounting cleat so the outer frame floats slightly proud of the wall.
    span('frame', [-w / 2 + r + 0.01, w / 2 - r - 0.01], [r + 0.02, h - r - 0.02], [z0, z0 + cleatT], o),
    // Full wrap-around backing body (drives the 2D plan footprint).
    panelXY('frame', outer, zBody0, zBody1 - zBody0, true),
    // Recessed mirror glass pane inside the raised perimeter rim.
    panelXY('mirror', inner, zGlassBack, glassT),
  ];

  const zRim0 = zGlassBack - 0.002;
  const zRim1 = z1 - lipT + 0.0005;
  for (const k of range(outer.length)) {
    const kn = (k + 1) % outer.length;
    parts.push(panelXY('frame', [outer[k], outer[kn], inner[kn], inner[k]], zRim0, zRim1 - zRim0));
    parts.push(panelXY('frame', [outerEase[k], outerEase[kn], inner[kn], inner[k]], z1 - lipT, lipT));
  }

  return keep(parts, size);
}

function roundedWallMirrorPlan({ w, d }: Size3): PlanStroke[] {
  return [line([-w / 2 + 0.012, d / 2 - 0.005], [w / 2 - 0.012, d / 2 - 0.005])];
}

const roundedRectWallMirror = defineItem({
  id: 'rounded-rect-wall-mirror',
  name: 'Rounded-corner full-length wall mirror',
  category: 'bedroom',
  type: 'decor',
  group: 'Mirrors',
  mount: 'wall',
  defaultElevation: 0.35,
  wallSnap: true,
  resizable: { w: true, d: true, h: true },
  tags: [
    'mirror',
    'wall mirror',
    'full length mirror',
    'dressing mirror',
    'vanity mirror',
    'rounded rectangle',
    'slim frame',
    'wood frame',
    'white frame',
    'bedroom',
    'hallway',
    'gương',
    'gương treo tường',
    'gương toàn thân',
    'gương soi',
  ],
  description:
    'A tall, slim wall-mounted full-length mirror with softly rounded corners and a recessed glass pane inside a sleek wrap-around frame; resize width and height freely and switch between matte black, white, oak, walnut and pastel finishes.',
  defaultSize: { w: 0.42, d: 0.035, h: 1.5 },
  minSize: { w: 0.25, d: 0.02, h: 0.45 },
  maxSize: { w: 1.2, d: 0.07, h: 2.2 },
  price: { vnd: 1_800_000, estimate: true },
  slots: [matSlot('frame', 'Frame', 'metal-black-matte'), matSlot('mirror', 'Mirror', 'glass-mirror')],
  build: (s) => buildRoundedWallMirror(s, 'slim'),
  planDetail: roundedWallMirrorPlan,
  models: [
    { id: 'slim-rim', name: 'Slim rim' },
    { id: 'wood-frame', name: 'Wider frame bezel', build: (s) => buildRoundedWallMirror(s, 'wide') },
    { id: 'micro-rim', name: 'Minimal micro-rim', build: (s) => buildRoundedWallMirror(s, 'micro') },
  ],
  variants: [
    { id: 'satin-white', name: 'Satin white', materials: { frame: 'paint-satin-white' } },
    { id: 'cream-lacquer', name: 'Cream lacquer', materials: { frame: 'laminate-cream' } },
    { id: 'light-oak', name: 'Light oak', materials: { frame: 'wood-oak-light' } },
    { id: 'natural-oak', name: 'Oak veneer', materials: { frame: 'laminate-oak' } },
    { id: 'walnut', name: 'Walnut', materials: { frame: 'wood-walnut' } },
    { id: 'sage-green', name: 'Sage green', materials: { frame: 'laminate-sage' } },
    { id: 'buttercream', name: 'Buttercream', materials: { frame: 'paint-butter' } },
    { id: 'dusty-pink', name: 'Dusty pink', materials: { frame: 'laminate-pink' } },
    { id: 'brushed-brass', name: 'Brushed brass', materials: { frame: 'metal-brass' } },
  ],
});

// ───────────── 14. Curved-waterfall shoe cabinet with towel cubby top ─────────────

/** Counter-clockwise [x, y] outline with radius `r` at 3 corners and `rTR` at the top-right (+x, +y) corner. */
function doorRectXY(x0: number, x1: number, y0: number, y1: number, r: number, rTR: number, seg = 4): V2[] {
  return [
    ...arc(x0 + r, y0 + r, r, r, Math.PI, 1.5 * Math.PI, seg),
    ...arc(x1 - r, y0 + r, r, r, -0.5 * Math.PI, 0, seg),
    ...arc(x1 - rTR, y1 - rTR, rTR, rTR, 0, 0.5 * Math.PI, seg),
    ...arc(x0 + r, y1 - r, r, r, 0.5 * Math.PI, Math.PI, seg),
  ];
}

/** Quarter-circle waterfall band in [x, y] around (cx, cy) from +y (π/2) to +x (0). */
function waterfallBendXY(cx: number, cy: number, rOut: number, rIn: number, seg = 20): V2[] {
  return [...arc(cx, cy, rOut, rOut, Math.PI / 2, 0, seg), ...arc(cx, cy, rIn, rIn, 0, Math.PI / 2, seg)];
}

/** Lengthwise-grained horizontal board (rotated 90° around Y so wood grain runs along X). */
function grainedTop(slot: string, x0: number, x1: number, y0: number, y1: number, d: number, zc = 0, plan = true): Part {
  const part: Part = {
    shape: 'box',
    size: [d, y1 - y0, x1 - x0],
    position: [(x0 + x1) / 2, (y0 + y1) / 2, zc],
    rotation: [0, Math.PI / 2, 0],
    bevel: 0.002,
    slot,
  };
  if (!plan) part.plan = false;
  return part;
}

/** Asymmetric left/right contoured footbed outline in local [x, z] (heel at -len/2, toe at +len/2). */
function slipperFootOutline(wid: number, len: number, side: -1 | 1): V2[] {
  const fore = arc(side * wid * 0.025, len * 0.05, wid * 0.49, len * 0.45, 0, Math.PI, 8);
  const heel = arc(-side * wid * 0.02, -len * 0.11, wid * 0.41, len * 0.39, Math.PI, Math.PI * 2, 8);
  return dedupe([...fore, ...heel]);
}

/** Single open-toe indoor slide slipper (cushioned footbed + hollow arched instep strap), fixed width & height. */
function buildSingleSlipper(slot: string, cx: number, cz: number, y0: number, wid: number, len: number, side: -1 | 1): Part[] {
  const soleH = 0.016;
  const strapOuter = arc(cx, y0 + soleH - 0.003, wid * 0.49, 0.036, 0, Math.PI, 10);
  const strapInner = arc(cx, y0 + soleH - 0.001, wid * 0.36, 0.023, Math.PI, 0, 10);
  const zStrap0 = cz - len * 0.02;
  const strapLen = len * 0.36;
  return [
    { ...prism(slot, slipperFootOutline(wid, len, side), y0 + 0.001, soleH), position: [cx, y0 + 0.001, cz], plan: false },
    panelXY(slot, dedupe([...strapOuter, ...strapInner]), zStrap0, strapLen, false),
  ];
}

/**
 * Two pairs of indoor house slippers tucked into the open floor bay under the cabinet.
 * Width, height and pair spacing are completely independent of `w` so horizontal scaling never stretches them.
 */
function floorIndoorSlippers({ d }: Size3): Part[] {
  const z1 = d / 2;
  const wid1 = 0.092;
  const len1 = Math.min(0.25, d - 0.042);
  const cz1 = z1 - 0.014 - len1 / 2;

  const wid2 = 0.086;
  const len2 = Math.min(0.234, d - 0.048);
  const cz2 = z1 - 0.022 - len2 / 2;

  const cxPair1 = -0.114;
  const cxPair2 = 0.114;
  const sep1 = wid1 / 2 + 0.005;
  const sep2 = wid2 / 2 + 0.005;

  return [
    ...buildSingleSlipper('slippers1', cxPair1 - sep1, cz1, 0, wid1, len1, -1),
    ...buildSingleSlipper('slippers1', cxPair1 + sep1, cz1 + 0.005, 0, wid1, len1, 1),
    ...buildSingleSlipper('slippers2', cxPair2 - sep2, cz2 + 0.004, 0, wid2, len2, -1),
    ...buildSingleSlipper('slippers2', cxPair2 + sep2, cz2, 0, wid2, len2, 1),
  ];
}

/** Single structured shoe (sneaker or loafer) of fixed width `wid`, for interior cabinet shelves. */
function buildShelfShoe(
  soleSlot: string,
  upperSlot: string,
  cx: number,
  cz: number,
  y0: number,
  wid: number,
  len: number,
  maxH: number,
  side: -1 | 1,
  style: 'sneaker' | 'loafer',
): Part[] {
  const soleH = style === 'sneaker' ? 0.014 : 0.009;
  const hw = wid * 0.42;
  const vampH = Math.min(style === 'sneaker' ? 0.046 : 0.038, maxH * 0.62);
  const collarH = Math.min(style === 'sneaker' ? 0.074 : 0.054, maxH);
  return [
    { ...prism(soleSlot, slipperFootOutline(wid, len, side), y0 + 0.001, soleH), position: [cx, y0 + 0.001, cz], plan: false },
    cushion(upperSlot, [cx - hw, cx + hw], [y0 + soleH - 0.001, y0 + vampH], [cz - len * 0.1, cz + len * 0.44], { softness: 0.42, plan: false }),
    cushion(upperSlot, [cx - hw * 0.96, cx + hw * 0.96], [y0 + soleH - 0.001, y0 + collarH], [cz - len * 0.45, cz + len * 0.08], {
      softness: 0.38,
      plan: false,
    }),
  ];
}

const SLIPPER_CREAM = matSlot('slippers1', 'Indoor slippers (pair 1)', 'fabric-cream');
const SLIPPER_SAGE = matSlot('slippers2', 'Indoor slippers (pair 2)', 'fabric-linen-sage');
const SHOE_TAN = matSlot('shoes', 'Tan leather shoes', 'leather-tan');
const SHOE_WHITE = matSlot('soles', 'Sneakers & soles', 'leather-white');
const SHOE_BLACK = matSlot('darkShoes', 'Black loafers', 'leather-smooth-black');

function buildShoeTowelCabinet(size: Size3, openLeftDoor = false): Part[] {
  const { w, d, h } = size;
  const x0 = -w / 2;
  const x1 = w / 2;
  const z0 = -d / 2;
  const z1 = d / 2;

  // ── 1. Lower curved-waterfall shoe cabinet (0 .. yBaseTop) ──
  const yBaseTop = clamp(h * 0.69, 0.7, 1.02);
  const yShoe = clamp(yBaseTop * 0.19, 0.13, 0.19);
  const t = 0.02;
  const R = clamp(Math.min(w * 0.13, yBaseTop * 0.12), t + 0.025, 0.095);
  const zf = z1 - 0.004; // inset door face
  const doorT = 0.018;
  const zDoor0 = zf - doorT;

  const carcassOutline: V2[] = [
    [x0 + t - 0.002, yShoe + t - 0.002],
    [x1 - t + 0.002, yShoe + t - 0.002],
    ...arc(x1 - R, yBaseTop - R, R - t + 0.002, R - t + 0.002, 0, Math.PI / 2, 12),
    [x0 + t - 0.002, yBaseTop - t + 0.002],
  ];

  const parts: Part[] = [
    // Left full-depth gable down to floor.
    span('oak', [x0, x0 + t], [0, yBaseTop - t + 0.002], [z0, z1], { bevel: 0.002 }),
    // Lengthwise-grained top board flowing into the right waterfall curve.
    grainedTop('oak', x0, x1 - R + 0.008, yBaseTop - t, yBaseTop, d, 0, true),
    // Smooth 20-step curved waterfall top-right corner.
    panelXY('oak', waterfallBendXY(x1 - R, yBaseTop - R, R, R - t, 20), z0, d, true),
    // Right vertical waterfall gable down to floor.
    span('oak', [x1 - t, x1], [0, yBaseTop - R + 0.008], [z0, z1], { bevel: 0.002, plan: false }),
    // Open bottom everyday-shoe bay back panel & bottom frame rail under the doors.
    span('oak', [x0 + t - 0.002, x1 - t + 0.002], [0, yShoe + 0.004], [z0, z0 + 0.016], o),
    span('oak', [x0 + t - 0.002, x1 - t + 0.002], [yShoe, yShoe + t], [z0, z1 - 0.002], { bevel: 0.0015, plan: false }),
  ];

  if (!openLeftDoor) {
    // Closed state: recessed interior cabinet carcass behind the inset doors.
    parts.push(panelXY('oak', dedupe(carcassOutline), z0, zDoor0 - 0.002 - z0));
  } else {
    // Open-door state: hollow oak interior back panel + 2 shelves forming 3 shoe tiers.
    const zBackFront = z0 + 0.016;
    const zShelfFront = zDoor0 - 0.008;
    parts.push(panelXY('oak', dedupe(carcassOutline), z0, 0.016));

    const yBotInner = yShoe + t;
    const yTopInner = yBaseTop - t;
    const ts = 0.015;
    const tierH = (yTopInner - yBotInner - 2 * ts) / 3;
    const yS1 = yBotInner + tierH;
    const yS2 = yS1 + ts + tierH;
    parts.push(
      span('oak', [x0 + t - 0.002, x1 - t + 0.002], [yS1, yS1 + ts], [zBackFront - 0.002, zShelfFront], { bevel: 0.0015, plan: false }),
      span('oak', [x0 + t - 0.002, x1 - t + 0.002], [yS2, yS2 + ts], [zBackFront - 0.002, zShelfFront], { bevel: 0.0015, plan: false }),
    );

    // Populate the 3 tiers with fixed-width shoes & slippers (more pairs fit when widened, never stretched).
    const tierYs = [yBotInner, yS1 + ts, yS2 + ts];
    const shoeL = Math.min(0.238, zShelfFront - zBackFront - 0.014);
    const czShoe = zShelfFront - 0.008 - shoeL / 2;
    const shoeW = 0.082;
    const shoeSep = shoeW / 2 + 0.005;
    const innerW = w - 2 * t - 0.028;
    const nPairs = clamp(Math.floor((innerW + 0.02) / 0.205), 2, 4);
    const xStart = x0 + t + 0.016 + shoeSep + shoeW / 2;
    const xEnd = x1 - t - 0.016 - shoeSep - shoeW / 2;
    const maxShoeH = Math.max(0.052, tierH - 0.024);

    for (const tIdx of range(3)) {
      const yT = tierYs[tIdx];
      for (const pIdx of range(nPairs)) {
        const px = nPairs === 1 ? 0 : xStart + ((xEnd - xStart) * pIdx) / (nPairs - 1);
        if (tIdx === 2) {
          // Top tier: casual low-top sneakers with crisp white soles.
          const up = pIdx % 2 === 0 ? 'shoes' : pIdx % 3 === 1 ? 'soles' : 'darkShoes';
          const sl = up === 'soles' ? 'darkShoes' : 'soles';
          parts.push(
            ...buildShelfShoe(sl, up, px - shoeSep, czShoe, yT, shoeW, shoeL, maxShoeH, -1, 'sneaker'),
            ...buildShelfShoe(sl, up, px + shoeSep, czShoe, yT, shoeW, shoeL, maxShoeH, 1, 'sneaker'),
          );
        } else if (tIdx === 1) {
          // Middle tier: smart leather loafers.
          const up = pIdx % 2 === 0 ? 'darkShoes' : 'shoes';
          const sl = up === 'darkShoes' ? 'soles' : 'darkShoes';
          parts.push(
            ...buildShelfShoe(sl, up, px - shoeSep, czShoe, yT, shoeW * 0.96, shoeL * 0.97, maxShoeH, -1, 'loafer'),
            ...buildShelfShoe(sl, up, px + shoeSep, czShoe, yT, shoeW * 0.96, shoeL * 0.97, maxShoeH, 1, 'loafer'),
          );
        } else {
          // Bottom interior tier: guest slide sandals & slippers.
          const slot = pIdx % 2 === 0 ? 'slippers2' : 'slippers1';
          parts.push(
            ...buildSingleSlipper(slot, px - shoeSep, czShoe, yT, shoeW * 1.02, shoeL * 0.96, -1),
            ...buildSingleSlipper(slot, px + shoeSep, czShoe, yT, shoeW * 1.02, shoeL * 0.96, 1),
          );
        }
      }
    }
  }

  // Inset shaker doors with rounded inner corners; rightmost door hugs the curved waterfall corner.
  const nDoors = w >= 1.05 ? 3 : 2;
  const dx0 = x0 + t + 0.0025;
  const dx1 = x1 - t - 0.0025;
  const dy0 = yShoe + t + 0.0025;
  const dy1 = yBaseTop - t - 0.0025;
  const dGap = 0.003;
  const dW = (dx1 - dx0 - dGap * (nDoors - 1)) / nDoors;
  const rail = clamp(dW * 0.13, 0.03, 0.044);

  for (const i of range(nDoors)) {
    const a = dx0 + i * (dW + dGap);
    const b = a + dW;

    if (openLeftDoor && i === 0) {
      // Left shaker door swung open ~78° outward on its left hinge, revealing the 3 shoe tiers.
      const ry = -1.36;
      const c = Math.cos(ry);
      const s = Math.sin(ry);
      const hx = a + 0.004;
      const hz = zf - 0.002;
      const pt = (u: number, y: number, v: number): V3 => [hx + u * c + v * s, y, hz - u * s + v * c];
      const openBox = (slot: string, u0: number, u1: number, yA: number, yB: number, v0: number, v1: number): Part => ({
        shape: 'box',
        size: [u1 - u0, yB - yA, v1 - v0],
        position: pt((u0 + u1) / 2, (yA + yB) / 2, (v0 + v1) / 2),
        rotation: [0, ry, 0],
        bevel: 0.0015,
        slot,
        plan: false,
      });

      parts.push(
        openBox('doors', rail - 0.002, dW - rail + 0.002, dy0 + rail - 0.002, dy1 - rail + 0.002, -doorT + 0.004, -0.004),
        openBox('doors', 0, rail, dy0, dy1, -doorT, 0),
        openBox('doors', dW - rail, dW, dy0, dy1, -doorT, 0),
        openBox('doors', rail, dW - rail, dy1 - rail, dy1, -doorT, 0),
        openBox('doors', rail, dW - rail, dy0, dy0 + rail, -doorT, 0),
      );
      // Concealed metal cup hinges near top and bottom of the open door.
      for (const hy of [dy0 + 0.085, dy1 - 0.085]) {
        parts.push(openBox('metal', 0.002, 0.016, hy - 0.016, hy + 0.016, -doorT - 0.004, -doorT + 0.001));
      }
      // Brass knob on the outer face of the swung-open door.
      const uk = dW - rail * 0.55;
      const yk = dy1 - rail * 0.62;
      parts.push(
        rod('metal', pt(uk, yk, 0.0005), pt(uk, yk, 0.011), 0.0033, { plan: false }),
        sphere('metal', pt(uk, yk, 0.0155), 0.0095, { scale: [1, 1, 0.7], rotation: [0, ry, 0], plan: false }),
      );
      continue;
    }

    const isRightmost = i === nDoors - 1;
    const rOutTR = isRightmost ? Math.max(0.008, R - t - 0.0025) : 0.004;
    const rInTR = isRightmost ? Math.max(0.012, rOutTR - rail) : 0.014;
    const dOuter = doorRectXY(a, b, dy0, dy1, 0.004, rOutTR, 4);
    const dInner = doorRectXY(a + rail, b - rail, dy0 + rail, dy1 - rail, 0.014, rInTR, 4);

    parts.push(panelXY('doors', dOuter, zDoor0, doorT - 0.006));
    for (const k of range(dOuter.length)) {
      const kn = (k + 1) % dOuter.length;
      parts.push(panelXY('doors', [dOuter[k], dOuter[kn], dInner[kn], dInner[k]], zf - 0.006, 0.006));
    }

    // Small round brass knob near the top meeting stile, matching the reference photo.
    const lone = nDoors % 2 === 1 && i === nDoors - 1;
    const kx = i % 2 === 0 && !lone ? b - rail * 0.55 : a + rail * 0.55;
    const ky = dy1 - rail * 0.62;
    parts.push(...knob('metal', [kx, ky, zf + 0.0005], 0.0095));
  }

  // ── 2. Upper open divided cubby organiser for bath towels (yBaseTop .. h) ──
  const setbackX = clamp(R * 0.72, 0.045, 0.07);
  const xCub1 = x1 - setbackX;
  const zCub1 = z1 - clamp(d * 0.08, 0.02, 0.032);
  const dCub = zCub1 - z0;
  const zCubMid = (z0 + zCub1) / 2;
  const tc = 0.018;
  const cubbyH = h - yBaseTop;
  const rCub = clamp(Math.min((xCub1 - x0) * 0.12, cubbyH * 0.2), tc + 0.016, 0.058);

  const cubBackOutline: V2[] = [
    [x0 + tc - 0.002, yBaseTop - 0.002],
    [xCub1 - tc + 0.002, yBaseTop - 0.002],
    ...arc(xCub1 - rCub, h - rCub, rCub - tc + 0.002, rCub - tc + 0.002, 0, Math.PI / 2, 10),
    [x0 + tc - 0.002, h - tc + 0.002],
  ];

  parts.push(
    span('oak', [x0, x0 + tc], [yBaseTop - 0.002, h - tc + 0.002], [z0, zCub1], { bevel: 0.002, plan: false }),
    grainedTop('oak', x0, xCub1 - rCub + 0.006, h - tc, h, dCub, zCubMid, false),
    panelXY('oak', waterfallBendXY(xCub1 - rCub, h - rCub, rCub, rCub - tc, 16), z0, dCub, false),
    span('oak', [xCub1 - tc, xCub1], [yBaseTop - 0.006, h - rCub + 0.006], [z0, zCub1], { bevel: 0.002, plan: false }),
    panelXY('oak', dedupe(cubBackOutline), z0, 0.014, false),
  );

  const ix0 = x0 + tc;
  const ix1 = xCub1 - tc;
  const iy0 = yBaseTop;
  const iy1 = h - tc;
  const iz0 = z0 + 0.014;
  const iz1 = zCub1 - 0.004;
  const td = 0.015;

  const nCols = clamp(Math.round((ix1 - ix0) / 0.23), 2, 4);
  const nRows = clamp(Math.round((iy1 - iy0) / 0.19), 2, 4);
  const colW = (ix1 - ix0 - td * (nCols - 1)) / nCols;
  const rowH = (iy1 - iy0 - td * (nRows - 1)) / nRows;

  for (const rIdx of range(nRows - 1)) {
    const sy = iy0 + (rIdx + 1) * rowH + rIdx * td;
    parts.push(span('oak', [ix0 - 0.002, ix1 + 0.002], [sy, sy + td], [iz0, iz1], { bevel: 0.0015, plan: false }));
  }
  for (const cIdx of range(nCols - 1)) {
    const sx = ix0 + (cIdx + 1) * colW + cIdx * td;
    parts.push(span('oak', [sx, sx + td], [iy0 - 0.002, iy1 + 0.002], [iz0, iz1 - 0.002], { bevel: 0.0015, plan: false }));
  }

  // ── 3. Folded & rolled plush bath towels inside the cubbies ──
  const zMid = (iz0 + iz1) / 2;
  const tDepth = Math.max(0.08, iz1 - iz0 - 0.024);

  for (const rIdx of range(nRows)) {
    const cy0 = iy0 + rIdx * (rowH + td);
    const cy1 = cy0 + rowH;
    for (const cIdx of range(nCols)) {
      const cx0 = ix0 + cIdx * (colW + td);
      const cx1 = cx0 + colW;
      const xc = (cx0 + cx1) / 2;
      const cw = cx1 - cx0;

      if ((cIdx + rIdx) % 2 === 0) {
        // Neatly stacked folded bath towels.
        const tw = Math.max(0.06, cw - 0.026);
        const nStack = rowH >= 0.165 ? 3 : 2;
        const th = Math.min(0.036, (rowH - 0.026) / nStack);
        for (const k of range(nStack)) {
          const ty0 = cy0 + 0.0015 + k * (th + 0.002);
          const inset = k * 0.003;
          parts.push(
            span('towels', [xc - tw / 2 + inset, xc + tw / 2 - inset], [ty0, ty0 + th], [zMid - tDepth / 2, zMid + tDepth / 2], {
              bevel: Math.min(0.012, th * 0.38),
              plan: false,
            }),
          );
        }
      } else {
        // Spa-rolled bath towels oriented front-to-back (2 on the shelf + 1 nestled on top when room allows).
        const rr = Math.min(cw * 0.21, (rowH - 0.02) * 0.27, 0.042);
        const dx = rr + 0.003;
        const yBot = cy0 + rr + 0.0015;
        for (const s of [-1, 1]) {
          parts.push({ ...cyl('towels', [xc + s * dx, yBot, zMid], rr, tDepth, { segments: 18, plan: false }), rotation: [Math.PI / 2, 0, 0] });
        }
        const yTopRoll = yBot + rr * 1.72;
        if (yTopRoll + rr <= cy1 - 0.012) {
          parts.push({ ...cyl('towels', [xc, yTopRoll, zMid], rr * 0.96, tDepth, { segments: 18, plan: false }), rotation: [Math.PI / 2, 0, 0] });
        }
      }
    }
  }

  return parts;
}

const shoeTowelCabinet = defineItem({
  id: 'curved-shoe-towel-cubby-cabinet',
  name: 'Curved-waterfall shoe cabinet with towel cubbies',
  category: 'bathroom',
  type: 'storage',
  group: 'Hallway storage',
  wallSnap: true,
  resizable: { w: true, d: true, h: true },
  tags: [
    'shoe cabinet',
    'slippers',
    'house slippers',
    'towel storage',
    'bath towels',
    'cubby shelf',
    'curved cabinet',
    'waterfall edge',
    'oak',
    'entryway',
    'bedroom',
    'bathroom',
    'tủ giày',
    'dép đi trong nhà',
    'tủ khăn tắm',
    'tủ chia ô',
    'kệ khăn tắm',
  ],
  description:
    'A waist-height oak shoe cabinet with two pairs of indoor slippers in the open floor bay, inset shaker doors with brass knobs (including an open-door three-tier shoe storage option) and a smooth curved waterfall right side, topped by a divided cubby organiser stacked with plush bath towels.',
  defaultSize: { w: 0.8, d: 0.36, h: 1.36 },
  minSize: { w: 0.55, d: 0.28, h: 1.05 },
  maxSize: { w: 1.4, d: 0.55, h: 1.85 },
  price: { vnd: 5_400_000, estimate: true },
  slots: [
    matSlot('oak', 'Cabinet & cubbies', 'laminate-oak'),
    matSlot('doors', 'Cabinet doors', 'laminate-oak'),
    matSlot('metal', 'Knobs', 'metal-brass'),
    matSlot('towels', 'Bath towels', 'fabric-terry-white'),
  ],
  models: [
    {
      id: 'with-towels',
      name: 'With towels & slippers',
      slots: [SLIPPER_CREAM, SLIPPER_SAGE],
      props: (size) => floorIndoorSlippers(size),
    },
    {
      id: 'open-door',
      name: 'Open door, 3 shoe tiers',
      slots: [SLIPPER_CREAM, SLIPPER_SAGE, SHOE_TAN, SHOE_WHITE, SHOE_BLACK],
      reach: { front: 0.52 },
      build: (size) => buildShoeTowelCabinet(size, true),
      props: (size) => floorIndoorSlippers(size),
    },
    { id: 'empty', name: 'Empty cubbies', hide: ['towels'] },
  ],
  variants: [
    { id: 'oak-cream', name: 'Oak & cream doors', materials: { doors: 'laminate-cream' } },
    { id: 'light-oak', name: 'Light oak & oat towels', materials: { oak: 'wood-oak-light', doors: 'wood-oak-light', towels: 'fabric-boucle-oat' } },
    { id: 'oak-white', name: 'Oak & satin white doors', materials: { oak: 'wood-oak-light', doors: 'paint-satin-white' } },
    { id: 'oak-sage', name: 'Oak & sage green doors', materials: { doors: 'laminate-sage', towels: 'fabric-waffle-white' } },
    { id: 'all-sage', name: 'Sage green & oat', materials: { oak: 'laminate-sage', doors: 'laminate-sage', towels: 'fabric-boucle-oat' } },
    { id: 'cream-lacquer', name: 'Cream lacquer', materials: { oak: 'laminate-cream', doors: 'laminate-cream', towels: 'fabric-linen-sage' } },
    { id: 'walnut', name: 'Walnut & oat towels', materials: { oak: 'wood-walnut', doors: 'wood-walnut', towels: 'fabric-boucle-oat' } },
    { id: 'satin-white', name: 'Satin white', materials: { oak: 'paint-satin-white', doors: 'paint-satin-white', metal: 'metal-black-matte', towels: 'fabric-linen-sage' } },
  ],
  planDetail: ({ w, d, h }) => {
    const yBaseTop = clamp(h * 0.69, 0.7, 1.02);
    const R = clamp(Math.min(w * 0.13, yBaseTop * 0.12), 0.045, 0.095);
    const setbackX = clamp(R * 0.72, 0.045, 0.07);
    const zCub1 = d / 2 - clamp(d * 0.08, 0.02, 0.032);
    return [line([-w / 2, zCub1], [w / 2 - setbackX, zCub1]), line([w / 2 - setbackX, -d / 2], [w / 2 - setbackX, zCub1])];
  },
  build: (size) => buildShoeTowelCabinet(size, false),
});

// ───────────── 15. Horizontal sage watercolor hills wall painting ─────────────

const sstep = (e0: number, e1: number, x: number): number => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

function ih2(ix: number, iy: number, seed: number): number {
  let h = (Math.imul(ix | 0, 0x27d4eb2d) ^ Math.imul(iy | 0, 0x165667b1) ^ (seed | 0)) | 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function vnoise2(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const n00 = ih2(ix, iy, seed);
  const n10 = ih2(ix + 1, iy, seed);
  const n01 = ih2(ix, iy + 1, seed);
  const n11 = ih2(ix + 1, iy + 1, seed);
  return lerp(lerp(n00, n10, sx), lerp(n01, n11, sx), sy);
}

function fbm2(x: number, y: number, seed: number): number {
  return (
    0.57 * vnoise2(x, y, seed) +
    0.29 * vnoise2(x * 2.03 + 11.7, y * 2.03 + 5.3, seed + 37) +
    0.14 * vnoise2(x * 4.11 + 23.1, y * 4.11 + 17.9, seed + 73)
  );
}

const ART_PAD = 0.04;
const ART_SPAN = 1 - 2 * ART_PAD;

/**
 * Procedural cold-pressed watercolor & hand-torn deckle-paper layered sage hills artwork.
 * Rolled by half the tile (matching `paintings.pack.ts`) with a 4% clamped edge margin so an
 * unscaled `ART_SPAN × ART_SPAN` box stretched to `cw × ch` renders edge-to-edge with zero seams.
 */
function drawSageHillsWatercolor(ctx: CanvasRenderingContext2D, size: number): void {
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const half = size >> 1;
  const aa = 1.35 / (size * ART_SPAN);

  const U = new Float32Array(size);
  const Y1 = new Float32Array(size);
  const D1 = new Float32Array(size);
  const Y2G = new Float32Array(size);
  const Y2 = new Float32Array(size);
  const Y3 = new Float32Array(size);
  const D3 = new Float32Array(size);
  const Y4A = new Float32Array(size);
  const Y4BL = new Float32Array(size);
  const Y4B = new Float32Array(size);
  const Y5 = new Float32Array(size);
  const STREAK = new Float32Array(size);

  for (let x = 0; x < size; x++) {
    const u = clamp((x / size - ART_PAD) / ART_SPAN, 0, 1);
    U[x] = u;

    // 1. Backmost pale celadon ridge with hand-torn white fibrous deckle crest
    const tear1 = (fbm2(u * 26, 1.7, 101) - 0.5) * 0.011 + (vnoise2(u * 96, 3.1, 102) - 0.5) * 0.0042;
    Y1[x] = 0.352 - 0.034 * Math.exp(-(((u - 0.35) / 0.27) ** 2)) + 0.116 * u ** 1.85 + 0.006 * Math.sin(u * 9.2 + 0.5) + tear1;
    D1[x] = (0.0065 + 0.0055 * sstep(0.2, 0.85, u)) * (0.74 + 0.58 * fbm2(u * 38, 5.2, 103));

    // 2. Smooth mint-sage ridge + translucent apple-sage watercolor brush glaze above it
    const y2 = 0.458 + 0.068 * (1 - u) ** 2.3 - 0.007 * Math.sin(u * Math.PI) + (fbm2(u * 18, 7.3, 201) - 0.5) * 0.0035;
    Y2[x] = y2;
    const env2 =
      Math.max(0, Math.sin(clamp((u - 0.15) / 0.72, 0, 1) * Math.PI)) *
      (0.54 + 0.58 * Math.exp(-(((u - 0.68) / 0.14) ** 2)));
    Y2G[x] = y2 - env2 * (0.04 + 0.01 * (fbm2(u * 22, 9.1, 205) - 0.5));

    // 3. Warm oat-parchment olive S-wave with prominent white torn-paper deckle edge
    const tear3 = (fbm2(u * 29, 11.4, 301) - 0.5) * 0.009 + (vnoise2(u * 105, 13.7, 302) - 0.5) * 0.0036;
    Y3[x] =
      0.516 -
      0.016 * Math.exp(-(((u - 0.1) / 0.095) ** 2)) +
      0.008 * Math.exp(-(((u - 0.28) / 0.1) ** 2)) -
      0.012 * Math.exp(-(((u - 0.51) / 0.12) ** 2)) +
      0.092 * (Math.max(0, u - 0.45) / 0.55) ** 1.52 +
      tear3;
    D3[x] = (0.006 + 0.0052 * sstep(0.06, 0.36, u)) * (0.72 + 0.62 * fbm2(u * 40, 14.8, 303));

    // 4a. Lower-left muted olive-khaki diagonal torn paper fold
    Y4A[x] = 0.688 - 0.22 * u + 0.007 * Math.sin(u * 14) + (fbm2(u * 32, 16.1, 401) - 0.5) * 0.0085;

    // 4b. Lush mid-ground botanical moss hill + upper wet chartreuse-moss watercolor bloom
    const y4b =
      0.588 +
      0.246 * Math.max(0, 1 - u / 0.55) ** 2.15 +
      (0.014 * Math.max(0, u - 0.65)) / 0.35 +
      (fbm2(u * 22, 19.3, 411) - 0.5) * 0.0042;
    Y4B[x] = y4b;
    const env4 =
      Math.max(0, Math.sin(clamp((u - 0.36) / 0.47, 0, 1) * Math.PI)) *
      (0.46 + 0.68 * Math.exp(-(((u - 0.73) / 0.095) ** 2)));
    Y4BL[x] = y4b - env4 * (0.025 + 0.006 * (fbm2(u * 28, 21.7, 415) - 0.5));

    // 5. Foreground deep botanical forest-sage dome
    Y5[x] =
      0.678 +
      0.184 * Math.max(0, 1 - u / 0.68) ** 1.95 +
      0.016 * (Math.max(0, u - 0.68) / 0.32) ** 1.6 +
      (fbm2(u * 16, 25.4, 501) - 0.5) * 0.0035;

    // Vertical wet watercolor brush-wash modulation across x
    STREAK[x] =
      (fbm2(u * 19, 31.2, 601) - 0.5) * 0.9 +
      0.38 * Math.exp(-(((u - 0.72) / 0.065) ** 2)) -
      0.18 * Math.exp(-(((u - 0.63) / 0.04) ** 2));
  }

  for (let y = 0; y < size; y++) {
    const v = clamp((y / size - ART_PAD) / ART_SPAN, 0, 1);
    const ty = (y + half) % size;
    for (let x = 0; x < size; x++) {
      const u = U[x];
      const tx = (x + half) % size;

      // Cold-pressed cotton paper tooth & broad watercolor granulation
      const tooth = vnoise2(u * 155, v * 105, 701) - 0.5;
      const cloud = fbm2(u * 7.5, v * 6.2, 709) - 0.5;
      const brushV = vnoise2(u * 36, v * 6.5, 719) - 0.5;

      // Base warm creamy off-white watercolor paper sky (#fafaf6)
      let r = 250.5 - v * 3.5 + tooth * 3.2 + cloud * 2.2;
      let g = 250.5 - v * 3.2 + tooth * 3.2 + cloud * 2.2;
      let b = 246.0 - v * 4.2 + tooth * 3.0 + cloud * 2.4;

      // Subtle lifted-paper shadow cast by Layer 1 onto the sky
      const y1 = Y1[x];
      if (v > y1 - 0.015 && v < y1 + aa) {
        const sh = sstep(y1 - 0.015, y1, v) * (1 - sstep(y1 - aa, y1 + aa, v));
        r -= sh * 14;
        g -= sh * 13;
        b -= sh * 13;
      }

      // Layer 1: Pale misty-celadon watercolor ridge + raw white torn-paper deckle crest
      if (v > y1 - aa) {
        const cov = sstep(y1 - aa, y1 + aa, v);
        const d1 = D1[x];
        const intoWash = sstep(y1 + d1 * 0.48, y1 + d1 * 1.4, v);
        const depth1 = clamp((v - y1) / 0.2, 0, 1);
        const wr = lerp(215, 198, u * 0.55 + depth1 * 0.45) + cloud * 10 + tooth * 4.8;
        const wg = lerp(226, 213, u * 0.5 + depth1 * 0.5) + cloud * 9 + tooth * 4.5;
        const wb = lerp(203, 185, u * 0.55 + depth1 * 0.45) + cloud * 10 + tooth * 4.8;
        const lr = lerp(252.0 + tooth * 2.5, wr, intoWash);
        const lg = lerp(252.5 + tooth * 2.5, wg, intoWash);
        const lb = lerp(249.0 + tooth * 2.5, wb, intoWash);
        r = lerp(r, lr, cov);
        g = lerp(g, lg, cov);
        b = lerp(b, lb, cov);
      }

      // Layer 2a: Translucent pale spring-apple watercolor brush halo
      const y2g = Y2G[x];
      const y2 = Y2[x];
      if (y2g < y2 - 0.001 && v > y2g - aa) {
        const cov = sstep(y2g - aa, y2g + aa * 1.4, v);
        const rim = Math.exp(-(((v - y2g - 0.002) / 0.004) ** 2)) * 0.24;
        const alpha = cov * clamp(0.56 + rim + cloud * 0.12, 0, 0.78);
        const gr = 179 - rim * 20 + cloud * 8 + tooth * 4;
        const gg = 211 - rim * 11 + cloud * 7 + tooth * 4;
        const gb = 162 - rim * 20 + cloud * 8 + tooth * 4;
        r = lerp(r, gr, alpha);
        g = lerp(g, gg, alpha);
        b = lerp(b, gb, alpha);
      }

      // Layer 2b: Smooth mint-sage watercolor ridge
      if (v > y2 - aa) {
        const cov = sstep(y2 - aa, y2 + aa, v);
        const rim2 = Math.exp(-(((v - y2 - 0.0018) / 0.0032) ** 2));
        const midPool = Math.exp(-(((u - 0.66) / 0.2) ** 2));
        const lr = lerp(175, 152, midPool * 0.78) - rim2 * 13 + cloud * 9 + brushV * 5.5 + tooth * 4.5;
        const lg = lerp(203, 187, midPool * 0.72) - rim2 * 9 + cloud * 8 + brushV * 5 + tooth * 4.2;
        const lb = lerp(164, 143, midPool * 0.78) - rim2 * 13 + cloud * 9 + brushV * 5.5 + tooth * 4.5;
        r = lerp(r, lr, cov);
        g = lerp(g, lg, cov);
        b = lerp(b, lb, cov);
      }

      // Overlap drop shadow cast by Layer 3's torn deckle onto Layer 2
      const y3 = Y3[x];
      if (v > y3 - 0.013 && v < y3 + aa) {
        const sh = sstep(y3 - 0.013, y3, v) * (1 - sstep(y3 - aa, y3 + aa, v));
        r -= sh * 19;
        g -= sh * 17;
        b -= sh * 17;
      }

      // Layer 3: Warm oat-parchment olive S-wave + crisp white hand-torn deckle crest
      if (v > y3 - aa) {
        const cov = sstep(y3 - aa, y3 + aa, v);
        const d3 = D3[x];
        const intoWash = sstep(y3 + d3 * 0.48, y3 + d3 * 1.35, v);
        const depth3 = clamp((v - y3) / 0.18, 0, 1);
        const crestShade = Math.exp(-(((v - y3 - d3 * 1.5) / 0.018) ** 2)) * sstep(0.15, 0.55, u) * (1 - sstep(0.65, 0.95, u));
        const wr = lerp(196, 173, u * 0.42 + depth3 * 0.36) - crestShade * 14 + cloud * 10 + brushV * 5.5 + tooth * 4.8;
        const wg = lerp(203, 184, u * 0.4 + depth3 * 0.36) - crestShade * 12 + cloud * 9 + brushV * 5 + tooth * 4.5;
        const wb = lerp(172, 151, u * 0.44 + depth3 * 0.36) - crestShade * 14 + cloud * 10 + brushV * 5.5 + tooth * 4.8;
        const lr = lerp(251.0 + tooth * 2.5, wr, intoWash);
        const lg = lerp(251.5 + tooth * 2.5, wg, intoWash);
        const lb = lerp(246.5 + tooth * 2.5, wb, intoWash);
        r = lerp(r, lr, cov);
        g = lerp(g, lg, cov);
        b = lerp(b, lb, cov);
      }

      // Layer 4a: Lower-left muted olive-khaki diagonal torn fold
      const y4a = Y4A[x];
      if (u < 0.46 && v > y4a - 0.009) {
        if (v < y4a + aa) {
          const sh = sstep(y4a - 0.009, y4a, v) * (1 - sstep(y4a - aa, y4a + aa, v));
          r -= sh * 18;
          g -= sh * 17;
          b -= sh * 17;
        }
        if (v > y4a - aa) {
          const cov = sstep(y4a - aa, y4a + aa, v);
          const tearRim = sstep(y4a, y4a + 0.005, v);
          const wr = lerp(151, 132, clamp((v - y4a) / 0.16, 0, 1) * 0.6 + u * 0.7) + cloud * 9 + tooth * 4.8;
          const wg = lerp(164, 148, clamp((v - y4a) / 0.16, 0, 1) * 0.6 + u * 0.7) + cloud * 8.5 + tooth * 4.5;
          const wb = lerp(129, 114, clamp((v - y4a) / 0.16, 0, 1) * 0.6 + u * 0.7) + cloud * 9 + tooth * 4.8;
          r = lerp(r, lerp(222, wr, tearRim), cov);
          g = lerp(g, lerp(226, wg, tearRim), cov);
          b = lerp(b, lerp(206, wb, tearRim), cov);
        }
      }

      // Layer 4b bloom: Fresh wet chartreuse-moss watercolor bloom above Layer 4b
      const y4bl = Y4BL[x];
      const y4b = Y4B[x];
      if (y4bl < y4b - 0.001 && v > y4bl - aa) {
        const cov = sstep(y4bl - aa, y4bl + aa * 1.3, v);
        const rim = Math.exp(-(((v - y4bl - 0.0018) / 0.0035) ** 2)) * 0.25;
        const alpha = cov * clamp(0.62 + rim + cloud * 0.1, 0, 0.82);
        const br = 128 - rim * 16 + cloud * 8 + tooth * 4;
        const bg = 171 - rim * 10 + cloud * 7 + tooth * 4;
        const bb = 104 - rim * 16 + cloud * 8 + tooth * 4;
        r = lerp(r, br, alpha);
        g = lerp(g, bg, alpha);
        b = lerp(b, bb, alpha);
      }

      // Layer 4b: Lush mid-ground botanical moss-green hill
      if (v > y4b - aa) {
        const cov = sstep(y4b - aa, y4b + aa, v);
        const rim4 = Math.exp(-(((v - y4b - 0.0016) / 0.003) ** 2));
        const strk = STREAK[x];
        const lr = lerp(116, 98, sstep(0.15, 0.78, u)) - strk * 18 - rim4 * 13 + cloud * 10 + brushV * 6 + tooth * 5;
        const lg = lerp(150, 134, sstep(0.15, 0.78, u)) - strk * 15 - rim4 * 10 + cloud * 9 + brushV * 5.5 + tooth * 4.8;
        const lb = lerp(97, 83, sstep(0.15, 0.78, u)) - strk * 16 - rim4 * 13 + cloud * 10 + brushV * 6 + tooth * 5;
        r = lerp(r, lr, cov);
        g = lerp(g, lg, cov);
        b = lerp(b, lb, cov);
      }

      // Subtle translucent corner overlap on the far right crest of Layer 4b
      if (u > 0.89 && v > y4b && v < y5Ref(U[x], Y5[x])) {
        const rw = sstep(0.9, 0.99, u) * (1 - sstep(y4b + 0.02, y4b + 0.085, v)) * 0.22;
        r = lerp(r, 162, rw);
        g = lerp(g, 184, rw);
        b = lerp(b, 146, rw);
      }

      // Layer 5: Foreground deep botanical forest-sage dome with vertical wet-wash brush streaks
      const y5 = Y5[x];
      if (v > y5 - aa) {
        const cov = sstep(y5 - aa, y5 + aa, v);
        const depth5 = clamp((v - y5) / Math.max(0.08, 1 - y5), 0, 1);
        const rim5 = Math.exp(-(((v - y5 - 0.0018) / 0.0035) ** 2));
        const strk = STREAK[x];
        const leftShade = (1 - sstep(0.0, 0.38, u)) * 0.48;
        const dryLift = Math.max(0, vnoise2(u * 48 + 3.1, v * 11 + 8.4, 809) - 0.68) * 24 * sstep(0.25, 0.85, depth5);
        const lr =
          lerp(86, 50, depth5 * 0.78 + leftShade * 0.34) -
          strk * 15 -
          rim5 * 10 +
          dryLift * 0.9 +
          cloud * 9.5 +
          brushV * 6.5 +
          tooth * 5.2;
        const lg =
          lerp(124, 85, depth5 * 0.75 + leftShade * 0.3) -
          strk * 13 -
          rim5 * 8 +
          dryLift +
          cloud * 8.5 +
          brushV * 6.0 +
          tooth * 5.0;
        const lb =
          lerp(75, 45, depth5 * 0.78 + leftShade * 0.34) -
          strk * 14 -
          rim5 * 10 +
          dryLift * 0.85 +
          cloud * 9.5 +
          brushV * 6.5 +
          tooth * 5.2;
        r = lerp(r, lr, cov);
        g = lerp(g, lg, cov);
        b = lerp(b, lb, cov);
      }

      const idx = (ty * size + tx) * 4;
      data[idx] = clamp(Math.round(r), 0, 255);
      data[idx + 1] = clamp(Math.round(g), 0, 255);
      data[idx + 2] = clamp(Math.round(b), 0, 255);
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

const y5Ref = (_u: number, y5: number): number => y5;

const packPatterns: PackPattern[] = [
  {
    id: 'sage-hills-watercolor',
    name: 'Sage watercolor hills',
    colored: true,
    normalStrength: 0.16,
    draw: drawSageHillsWatercolor,
  },
];

const packMaterials: PackMaterial[] = [
  {
    id: 'sage-hills-art',
    name: 'Sage watercolor hills canvas',
    category: 'solid',
    color: '#ffffff',
    roughness: 0.86,
    pattern: { id: 'sage-hills-watercolor', scale: 1, contrast: 1 },
  },
];

type PaintingFrameStyle = 'float' | 'matted' | 'canvas';

function sageArtPanel(cw: number, ch: number, cy: number, z0: number, z1: number): Part {
  const half = ART_SPAN / 2;
  return {
    ...span('art', [-half, half], [-half, half], [z0, z1], o),
    position: [0, cy, (z0 + z1) / 2],
    scale: [cw / ART_SPAN, ch / ART_SPAN, 1],
  };
}

function buildSageHillsPainting({ w, d, h }: Size3, style: PaintingFrameStyle): Part[] {
  const z0 = -d / 2;
  const z1 = d / 2;
  const s = Math.min(w, h);

  if (style === 'canvas') {
    return keep(
      [
        span('mat', [-w / 2, w / 2], [0, h], [z0, z1 - 0.002], { bevel: 0.002, plan: true }),
        sageArtPanel(Math.max(0.06, w - 0.003), Math.max(0.06, h - 0.003), h / 2, z1 - 0.005, z1),
      ],
      { w, d, h },
    );
  }

  if (style === 'matted') {
    const f = clamp(s * 0.028, 0.014, 0.026);
    const matW = clamp(s * 0.105, 0.036, 0.085);
    const cw = Math.max(0.08, w - 2 * (f + matW));
    const ch = Math.max(0.08, h - 2 * (f + matW));
    const zMatFront = z1 - 0.006;
    return keep(
      [
        ...frame4('frame', [-w / 2, w / 2], [0, h], [z0, z1], f, { plan: true }),
        span('frame', [-w / 2 + f, w / 2 - f], [f, h - f], [z0, z0 + 0.005], o),
        span('mat', [-w / 2 + f + 0.002, w / 2 - f - 0.002], [f + 0.002, h - f - 0.002], [z0 + 0.0065, zMatFront - 0.006], o),
        ...frame4('mat', [-w / 2 + f, w / 2 - f], [f, h - f], [zMatFront - 0.004, zMatFront], matW, o),
        sageArtPanel(cw + 0.004, ch + 0.004, h / 2, zMatFront - 0.0075, zMatFront - 0.0045),
      ],
      { w, d, h },
    );
  }

  // Default 'float': slim Scandinavian L-section gallery float frame with shadow reveal
  const t = clamp(s * 0.02, 0.009, 0.018);
  const gap = clamp(s * 0.011, 0.005, 0.009);
  const cw = Math.max(0.08, w - 2 * (t + gap));
  const ch = Math.max(0.08, h - 2 * (t + gap));
  const zBack = z0 + 0.005;
  const zArtFront = z1 - 0.003;
  return keep(
    [
      ...frame4('frame', [-w / 2, w / 2], [0, h], [z0, z1], t, { plan: true }),
      span('frame', [-w / 2 + t, w / 2 - t], [t, h - t], [z0, zBack], o),
      span('mat', [-cw / 2 - 0.0015, cw / 2 + 0.0015], [h / 2 - ch / 2 - 0.0015, h / 2 + ch / 2 + 0.0015], [zBack + 0.0015, zArtFront - 0.002], o),
      sageArtPanel(cw, ch, h / 2, zArtFront - 0.005, zArtFront),
    ],
    { w, d, h },
  );
}

const sageWatercolorHillsPainting = defineItem({
  id: 'sage-watercolor-hills-painting',
  name: 'Horizontal sage watercolor hills painting',
  category: 'decor',
  type: 'decor',
  group: 'Landscape paintings',
  mount: 'wall',
  wallSnap: true,
  defaultElevation: 1.35,
  resizable: { w: true, d: true, h: true },
  tags: [
    'painting',
    'wall art',
    'landscape painting',
    'horizontal painting',
    'watercolor',
    'sage green',
    'rolling hills',
    'torn paper',
    'minimalist art',
    'botanical',
    'framed art',
    'living room',
    'bedroom',
    'tranh',
    'tranh treo tường',
    'tranh ngang',
    'tranh chữ nhật ngang',
    'tranh phong cảnh',
    'tranh màu nước',
  ],
  description:
    'A serene horizontal wall painting of layered sage, celadon and deep moss-green watercolor hills with hand-torn white deckle-paper edges against a warm off-white cotton paper sky; resize freely and choose a slim gallery float frame, white museum mat or frameless canvas.',
  defaultSize: { w: 1.2, d: 0.04, h: 0.75 },
  minSize: { w: 0.45, d: 0.025, h: 0.28 },
  maxSize: { w: 2.4, d: 0.07, h: 1.5 },
  price: { vnd: 1_450_000, estimate: true },
  slots: [
    matSlot('frame', 'Frame', 'wood-oak-light'),
    matSlot('mat', 'Mat & canvas edge', 'fabric-white-cotton'),
    matSlot('art', 'Artwork', 'sage-hills-art'),
  ],
  models: [
    { id: 'gallery-float', name: 'Slim gallery float frame' },
    { id: 'matted-frame', name: 'Framed with white museum mat', build: (s) => buildSageHillsPainting(s, 'matted') },
    { id: 'frameless-canvas', name: 'Frameless gallery canvas', hide: ['frame'], build: (s) => buildSageHillsPainting(s, 'canvas') },
  ],
  variants: [
    { id: 'natural-oak', name: 'Oak veneer', materials: { frame: 'laminate-oak' } },
    { id: 'satin-white', name: 'Satin white', materials: { frame: 'paint-satin-white' } },
    { id: 'matte-black', name: 'Matte black', materials: { frame: 'metal-black-matte' } },
    { id: 'walnut', name: 'Walnut', materials: { frame: 'wood-walnut' } },
    { id: 'brushed-brass', name: 'Brushed brass', materials: { frame: 'metal-brass' } },
    { id: 'cream-lacquer', name: 'Cream lacquer', materials: { frame: 'laminate-cream' } },
    { id: 'sage-green', name: 'Sage green', materials: { frame: 'laminate-sage' } },
    { id: 'buttercream', name: 'Buttercream', materials: { frame: 'paint-butter' } },
  ],
  planDetail: ({ w, d, h }) => {
    const t = clamp(Math.min(w, h) * 0.02, 0.009, 0.018);
    return [line([-w / 2 + t, d / 2 - 0.003], [w / 2 - t, d / 2 - 0.003])];
  },
  build: (s) => buildSageHillsPainting(s, 'float'),
});

export default definePack({
  name: 'Soft-curve furniture & lighting',
  version: '1.3.0',
  author: 'Neest',
  description:
    'Sculptural, rounded pieces in walnut, oak, bouclé and velvet: a stacked-sphere pedestal table, a wall-backed peninsula table on a turned bead leg, an oval-back chair, a leaf pendant, a dome sconce, an arched tea table, a palm-leaf fan, a fluted oval coffee table, a floating vanity shelf, a shouldered mirror, a rounded-corner full-length wall mirror, a curved-waterfall shoe & towel cubby cabinet, a horizontal sage watercolor hills wall painting, a donut pouf and a rolled-headboard bed. All resize freely.',
  license: 'CC0-1.0',
  patterns: packPatterns,
  materials: packMaterials,
  items: [
    spherePedestalTable,
    wallPeninsulaBeadTable,
    ovalBackChair,
    leafPendant,
    domeSconce,
    archedTeaTable,
    palmLeafFan,
    flutedOvalTable,
    vanityShelf,
    shoulderedMirror,
    roundedRectWallMirror,
    shoeTowelCabinet,
    sageWatercolorHillsPainting,
    donutPouf,
    rolledBed,
  ],
});

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
  knob,
  lathe,
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
  type Part,
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

export default definePack({
  name: 'Soft-curve furniture & lighting',
  version: '1.0.0',
  author: 'Neest',
  description:
    'Sculptural, rounded pieces in walnut, oak, bouclé and velvet: a stacked-sphere pedestal table, an oval-back chair, a leaf pendant, a dome sconce, an arched tea table, a palm-leaf fan, a fluted oval coffee table, a floating vanity shelf, a shouldered mirror, a donut pouf and a rolled-headboard bed. All resize freely.',
  license: 'CC0-1.0',
  items: [spherePedestalTable, ovalBackChair, leafPendant, domeSconce, archedTeaTable, palmLeafFan, flutedOvalTable, vanityShelf, shoulderedMirror, donutPouf, rolledBed],
});

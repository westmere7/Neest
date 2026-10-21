/**
 * Soft-curve kitchen & storage — rounded, quietly detailed joinery for kitchens and living spaces:
 * a breakfast-bar peninsula with a fully rounded, V-groove panelled end; a peninsula with open end
 * shelves; a floor-to-ceiling cabinet with a quarter-round corner and a lit walnut niche; a drum
 * ceiling extractor; a cluster of handmade wall plates; a bouclé bar stool; a three-tier layered
 * pendant; an arch-beaded sideboard and a wardrobe with arched door panels inset in oak.
 *
 * Everything is built from the item's real size: curves are computed in metres (they stay circular
 * and only shrink when space runs out) and doors, drawers, boards, plates and vent slots are counted
 * from the width and height. Coordinates: x across (w), y up (h), z depth (d), front = +z.
 */
import {
  barPull,
  cellSpans,
  clamp,
  cyl,
  defineItem,
  definePack,
  knob,
  lathe,
  matSlot,
  mirrorZ,
  prism,
  range,
  ring,
  rng,
  rod,
  span,
  sphere,
  torus,
  box,
  type PackMaterial,
  type Part,
} from '@/packs/kit';

type V2 = [number, number];
const o = { plan: false };
const CEILING = 2.7;
const WARM = '#ffd9a8';
/** Shadow gap between neighbouring doors and drawers. */
const GAP = 0.003;

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

/** A flat panel in the X/Y (front) plane from [x, y] points, extruded from z0 to z0 + t. */
function panelXY(slot: string, pts: V2[], z0: number, t: number): Part {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  return {
    shape: 'prism',
    outline: pts.map(([x, y]) => [x - cx, -(y - cy)] as V2),
    height: t,
    position: [cx, cy, z0],
    rotation: [Math.PI / 2, 0, 0],
    slot,
    plan: false,
  };
}

/** Points on an elliptical arc (centre cx, cy; radii rx, ry) from angle a0 to a1, endpoints included. */
const arc = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 16): V2[] =>
  range(n + 1).map((i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry] as V2;
  });

/** Drops repeated consecutive points (zero-length edges break the extrusion). */
const dedupe = (pts: V2[]): V2[] =>
  pts.filter((p, i) => {
    const q = pts[(i + pts.length - 1) % pts.length];
    return Math.abs(p[0] - q[0]) > 1e-5 || Math.abs(p[1] - q[1]) > 1e-5;
  });

/** Plan outline [x, z]: a slab running to x1 whose left end is a half-round of radius r centred at (cx, cz). */
const halfRoundEnd = (cx: number, x1: number, cz: number, r: number): V2[] =>
  dedupe([[x1, cz - r], [x1, cz + r], ...arc(cx, cz, r, r, Math.PI / 2, (3 * Math.PI) / 2, 24)]);

/** Plan outline [x, z]: a rectangle whose front-right corner (+x, +z) is a quarter-round of radius r. */
function quarterRound(x0: number, x1: number, z0: number, z1: number, r: number): V2[] {
  const rr = clamp(r, 0.004, Math.min(x1 - x0, z1 - z0) - 0.002);
  return dedupe([[x0, z0], [x1, z0], [x1, z1 - rr], ...arc(x1 - rr, z1 - rr, rr, rr, 0, Math.PI / 2, 12), [x0, z1]]);
}

/** Rectangle with a semicircular top, as [x, y] points (front plane). */
function archPoints(x0: number, x1: number, y0: number, y1: number, n = 16): V2[] {
  const r = (x1 - x0) / 2;
  return dedupe([[x0, y0], [x1, y0], ...arc((x0 + x1) / 2, y1 - r, r, r, 0, Math.PI, n)]);
}

/** Knob on a front facing -z (the kitchen side of a peninsula), on the surface at depth z. */
const backKnob = (slot: string, x: number, y: number, z: number, r: number) => mirrorZ(knob(slot, [x, y, -z], r));

// ---------------------------------------------------------------------------
// Materials (handmade glazes for the wall plates; photo scans with a procedural fallback)
// ---------------------------------------------------------------------------

const materials: PackMaterial[] = [
  {
    id: 'terracotta-glaze',
    name: 'Terracotta glaze (mottled)',
    category: 'solid',
    color: '#b8694a',
    roughness: 0.32,
    pattern: { id: 'limewash', scale: 0.4, contrast: 0.55 },
    photo: { set: 'cloudy-plaster', scale: 0.45, contrast: 0.55 },
  },
  {
    id: 'cream-glaze',
    name: 'Speckled cream glaze',
    category: 'solid',
    color: '#ece3d1',
    roughness: 0.28,
    pattern: { id: 'terrazzo', scale: 0.25, contrast: 0.25 },
    photo: { set: 'aggregate', scale: 0.35, contrast: 0.35 },
  },
  {
    id: 'sand-glaze',
    name: 'Sand glaze (speckled)',
    category: 'solid',
    color: '#d6b38c',
    roughness: 0.3,
    pattern: { id: 'terrazzo', scale: 0.25, contrast: 0.3 },
    photo: { set: 'aggregate', scale: 0.35, contrast: 0.45 },
  },
];

// ---------------------------------------------------------------------------
// 1. Rounded-end breakfast bar peninsula
// ---------------------------------------------------------------------------

const roundedPeninsula = defineItem({
  id: 'rounded-end-peninsula',
  name: 'Rounded-end breakfast bar peninsula',
  category: 'kitchen',
  type: 'surfaces',
  group: 'Counters & cabinets',
  tags: ['peninsula', 'breakfast bar', 'kitchen island', 'rounded end', 'v-groove', 'panelled', 'quartz', 'bán đảo bếp', 'quầy bar'],
  description:
    'A counter-height breakfast bar peninsula whose free end is a full half-round, clad in vertical V-groove boards, with a quartz top following the curve, a recessed toe kick and cupboards with brass knobs on the kitchen side.',
  defaultSize: { w: 1.6, d: 0.65, h: 1.05 },
  minSize: { w: 1.0, d: 0.5, h: 0.9 },
  maxSize: { w: 3.0, d: 0.9, h: 1.15 },
  slots: [matSlot('body', 'Body & panelling', 'paint-cream'), matSlot('top', 'Worktop', 'stone-quartz-white'), matSlot('knobs', 'Knobs', 'metal-brass')],
  variants: [
    { id: 'walnut', name: 'Walnut body', materials: { body: 'wood-walnut' } },
    { id: 'white-oak', name: 'White oak & terrazzo', materials: { body: 'wood-white-oak', top: 'tile-terrazzo-beige' } },
    { id: 'sage-marble', name: 'Sage & Carrara', materials: { body: 'paint-sage', top: 'stone-marble-carrara' } },
  ],
  build: ({ w, d, h }) => {
    const tt = 0.03; // quartz thickness
    const kick = 0.1; // toe-kick height
    const tf = 0.018; // board / door thickness
    const yb = h - tt; // underside of the top
    const zb0 = -d / 2 + 0.03; // kitchen-side face (3 cm overhang, room for knobs)
    const zb1 = d / 2 - 0.035; // seating-side face (3.5 cm overhang)
    const R = (zb1 - zb0) / 2; // half-round end of the body
    const zc = (zb0 + zb1) / 2;
    const cx = -w / 2 + d / 2; // the top's rounded end shares this centre, so it overhangs evenly
    const parts: Part[] = [
      prism('top', halfRoundEnd(cx, w / 2, 0, d / 2), yb, tt),
      // Carcass core inside the boards, and the recessed toe kick following the curve.
      prism('body', halfRoundEnd(cx, w / 2, zc, R - tf), kick, yb - kick),
      prism('body', halfRoundEnd(cx, w / 2, zc, R - 0.06), 0, kick, o),
    ];
    // V-groove boards: eased edges meeting in a fine V. Straight run on the seating side…
    const runL = w / 2 - cx;
    const nRun = Math.max(1, Math.round(runL / 0.09));
    for (const [x0, x1] of cellSpans(nRun, cx, w / 2)) parts.push(span('body', [x0 + 0.0005, x1 - 0.0005], [kick, yb - 0.001], [zb1 - tf, zb1], { bevel: 0.003, plan: false }));
    // …and staves around the half-round end, each tangent to the curve.
    const nEnd = Math.max(6, Math.round((Math.PI * R) / 0.08));
    const da = Math.PI / nEnd;
    const bw = 2 * R * Math.tan(da / 2) - 0.001;
    for (const k of range(nEnd)) {
      const a = Math.PI / 2 + (k + 0.5) * da;
      const rc = R - tf / 2;
      parts.push(box('body', [cx + Math.cos(a) * rc, (kick + yb - 0.001) / 2, zc + Math.sin(a) * rc], [bw, yb - 0.001 - kick, tf], { bevel: 0.003, rotation: [0, Math.PI / 2 - a, 0], plan: false }));
    }
    // Kitchen side (-z): a drawer row over cupboard doors, with brass knobs.
    const nd = Math.max(1, Math.round(runL / 0.5));
    const yDr = yb - 0.17;
    for (const [i, [x0, x1]] of cellSpans(nd, cx, w / 2).entries()) {
      const xs: V2 = [x0 + GAP / 2, x1 - GAP / 2];
      parts.push(
        span('body', xs, [yDr + GAP / 2, yb - GAP / 2], [zb0, zb0 + tf], { bevel: 0.002, plan: false }),
        span('body', xs, [kick + GAP / 2, yDr - GAP / 2], [zb0, zb0 + tf], { bevel: 0.002, plan: false }),
        ...backKnob('knobs', (x0 + x1) / 2, (yDr + yb) / 2, zb0, 0.012),
        ...backKnob('knobs', i % 2 === 0 ? x1 - 0.05 : x0 + 0.05, yDr - 0.07, zb0, 0.012),
      );
    }
    return parts;
  },
});

// ---------------------------------------------------------------------------
// 2. Kitchen peninsula with open end shelves
// ---------------------------------------------------------------------------

const openEndPeninsula = defineItem({
  id: 'open-end-peninsula',
  name: 'Kitchen peninsula with open end shelves',
  category: 'kitchen',
  type: 'surfaces',
  group: 'Counters & cabinets',
  tags: ['peninsula', 'kitchen island', 'open shelves', 'drawers', 'sage', 'quartz', 'bán đảo bếp', 'kệ mở'],
  description:
    'A run of base cabinets with deep drawers on the front and an open end of three oak-lined shelves facing out, in sage paint with a white quartz top, brass bar pulls and a recessed plinth.',
  defaultSize: { w: 1.4, d: 0.6, h: 0.9 },
  minSize: { w: 0.8, d: 0.5, h: 0.8 },
  maxSize: { w: 3.0, d: 0.75, h: 1.0 },
  slots: [
    matSlot('body', 'Cabinet & fronts', 'paint-sage'),
    matSlot('top', 'Worktop', 'stone-quartz-white'),
    matSlot('shelf', 'Open shelves', 'wood-white-oak'),
    matSlot('pulls', 'Pulls', 'metal-brass'),
  ],
  variants: [
    { id: 'cream', name: 'Cream & oak', materials: { body: 'paint-cream', shelf: 'wood-oak-light' } },
    { id: 'walnut', name: 'Walnut & marble', materials: { body: 'wood-walnut', shelf: 'wood-walnut', top: 'stone-marble-beige' } },
    { id: 'smoked', name: 'Smoked oak & black', materials: { body: 'wood-smoked-oak', shelf: 'wood-smoked-oak', pulls: 'metal-black-matte' } },
  ],
  build: ({ w, d, h }) => {
    const tt = 0.03;
    const kick = 0.1;
    const tf = 0.019;
    const yb = h - tt;
    const zf = d / 2 - 0.03; // front faces (the top overhangs 3 cm)
    const zc = zf - tf; // carcass front behind the fronts
    const z0 = -d / 2 + 0.005; // back panel
    const ew = clamp(w * 0.24, 0.26, 0.4); // open end bay
    const xs0 = -w / 2 + 0.012; // the end cheeks, just inside the top
    const xe = xs0 + ew; // divider between the open bay and the drawers
    const parts: Part[] = [
      span('top', [-w / 2, w / 2], [yb, h], [-d / 2, d / 2], { bevel: 0.004 }),
      span('body', [xe, w / 2], [kick, yb], [z0, zc]),
      // Plinth, recessed under the fronts and the open end.
      span('body', [xs0 + 0.05, w / 2], [0, kick], [z0, zc - 0.05], o),
      // Open bay: front and back cheeks, an oak-lined back and three shelves.
      span('body', [xs0, xe], [kick, yb], [zf - tf, zf]),
      span('body', [xs0, xe], [kick, yb], [z0, z0 + tf]),
      span('shelf', [xe - 0.006, xe], [kick + tf, yb], [z0 + tf, zf - tf], o),
    ];
    const sx: V2 = [xs0 + 0.01, xe - 0.006];
    const sz: V2 = [z0 + tf, zf - tf];
    const H = yb - kick - tf;
    for (const k of range(3)) {
      const y = kick + (k * H) / 3;
      parts.push(span('shelf', sx, [y, y + tf], sz, o));
    }
    // Drawers: three graduated rows, columns counted from the width.
    const bw = w / 2 - xe;
    const nc = Math.max(1, Math.round(bw / 0.6));
    const cuts = [kick, kick + (yb - kick) * 0.42, kick + (yb - kick) * 0.74, yb];
    for (const [x0, x1] of cellSpans(nc, xe, w / 2)) {
      const len = clamp((x1 - x0) * 0.4, 0.1, 0.26);
      for (const r of range(3)) {
        const y0 = cuts[r] + GAP / 2;
        const y1 = cuts[r + 1] - GAP / 2;
        parts.push(span('body', [x0 + GAP / 2, x1 - GAP / 2], [y0, y1], [zc, zf], { bevel: 0.002, plan: false }));
        parts.push(...barPull('pulls', [(x0 + x1) / 2, y1 - Math.min(0.06, (y1 - y0) / 2), zf], len, { stand: 0.02, r: 0.005 }));
      }
    }
    return parts;
  },
});

// ---------------------------------------------------------------------------
// 3. Rounded-corner tall cabinet with open niche
// ---------------------------------------------------------------------------

const roundedTall = defineItem({
  id: 'rounded-tall-cabinet',
  name: 'Rounded-corner tall cabinet with open niche',
  category: 'kitchen',
  type: 'storage',
  group: 'Kitchen cabinets',
  tags: ['tall cabinet', 'pantry', 'larder', 'rounded corner', 'quarter round', 'niche', 'walnut', 'tủ kịch trần', 'tủ bo góc'],
  description:
    'A floor-to-ceiling cabinet whose outer front corner is a full quarter-round, with flat painted doors and small brass knobs, an open walnut-lined niche at counter height lit by a warm LED strip, a drawer below it, a top cupboard and a recessed plinth.',
  defaultSize: { w: 0.9, d: 0.6, h: 2.6 },
  minSize: { w: 0.6, d: 0.45, h: 2.0 },
  maxSize: { w: 1.5, d: 0.7, h: 3.0 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Cabinet & doors', 'paint-sage'),
    matSlot('niche', 'Niche lining', 'wood-walnut'),
    matSlot('knobs', 'Knobs', 'metal-brass'),
    matSlot('glow', 'LED strip', 'light-warm'),
  ],
  variants: [
    { id: 'cream', name: 'Cream & walnut', materials: { body: 'paint-cream' } },
    { id: 'white-oak', name: 'White oak & smoked oak', materials: { body: 'wood-white-oak', niche: 'wood-smoked-oak' } },
    { id: 'warm-white', name: 'Warm white & oak', materials: { body: 'paint-warm-white', niche: 'wood-oak-light' } },
  ],
  build: ({ w, d, h }) => {
    const pk = 0.1; // plinth height
    const tf = 0.02; // door thickness
    const zF = d / 2 - 0.026; // door faces (knobs stand proud in front)
    const r = clamp(0.18, 0.06, Math.min(w * 0.3, d * 0.4)); // quarter-round corner
    const xq = w / 2 - r; // where the flat doors end and the curve begins
    // Carcass plan: flat front set back by the door thickness, the curved corner flush with the doors.
    const carcass = dedupe([[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, zF - r], ...arc(xq, zF - r, r, r, 0, Math.PI / 2, 12), [xq, zF - tf], [-w / 2, zF - tf]]);
    const yN0 = 0.95; // niche floor (worktop height)
    const yN1 = yN0 + clamp((h - yN0) * 0.3, 0.35, 0.55);
    const yD = yN0 - 0.2; // drawer under the niche
    const parts: Part[] = [
      prism('body', quarterRound(-w / 2, w / 2 - 0.05, -d / 2, zF - 0.05, r - 0.05), 0, pk, o),
      prism('body', carcass, pk, yN0 - pk),
      prism('body', carcass, yN1, h - yN1),
    ];
    // Niche: the curved corner runs through as a column, a side and back close the rest.
    const xa = -w / 2 + 0.02;
    const zNb = -d / 2 + 0.02;
    parts.push(
      prism('body', dedupe([[xq, -d / 2], [w / 2, -d / 2], [w / 2, zF - r], ...arc(xq, zF - r, r, r, 0, Math.PI / 2, 12)]), yN0, yN1 - yN0),
      span('body', [-w / 2, xa], [yN0, yN1], [-d / 2, zF]),
      span('body', [xa, xq], [yN0, yN1], [-d / 2, zNb], o),
    );
    // Walnut lining (floor, ceiling, back, sides) set 3 mm behind the door faces, and a LED strip.
    const lt = 0.012;
    const zl = zF - 0.003;
    parts.push(
      span('niche', [xa, xq], [yN0, yN0 + lt], [zNb, zl], o),
      span('niche', [xa, xq], [yN1 - lt, yN1], [zNb, zl], o),
      span('niche', [xa, xq], [yN0 + lt, yN1 - lt], [zNb, zNb + lt], o),
      span('niche', [xa, xa + lt], [yN0 + lt, yN1 - lt], [zNb + lt, zl], o),
      span('niche', [xq - lt, xq], [yN0 + lt, yN1 - lt], [zNb + lt, zl], o),
      span('glow', [xa + lt + 0.01, xq - lt - 0.01], [yN1 - lt - 0.009, yN1 - lt - 0.001], [zl - 0.05, zl - 0.035], o),
    );
    // Doors across the flat part of the front, counted from the width; knobs on the meeting edges.
    const nD = Math.max(1, Math.ceil((xq + w / 2) / 0.6 - 0.05));
    const cols = cellSpans(nD, -w / 2, xq);
    const door = (x0: number, x1: number, y0: number, y1: number) => span('body', [x0 + GAP / 2, x1 - GAP / 2], [y0 + GAP / 2, y1 - GAP / 2], [zF - tf, zF], { bevel: 0.002, plan: false });
    const knobX = (i: number, x0: number, x1: number) => (nD === 1 || i % 2 === 0 ? x1 - 0.045 : x0 + 0.045);
    // Upper section: tall doors, and a separate top cupboard when there is room.
    const yTop = h - yN1 > 1.15 ? h - clamp((h - yN1) * 0.28, 0.3, 0.5) : h;
    for (const [i, [x0, x1]] of cols.entries()) {
      parts.push(door(x0, x1, pk, yD), ...knob('knobs', [knobX(i, x0, x1), yD - 0.07, zF], 0.011));
      parts.push(door(x0, x1, yN1, yTop), ...knob('knobs', [knobX(i, x0, x1), yN1 + 0.08, zF], 0.011));
      if (yTop < h) parts.push(door(x0, x1, yTop, h), ...knob('knobs', [knobX(i, x0, x1), yTop + 0.07, zF], 0.011));
    }
    // One wide drawer under the niche.
    parts.push(door(-w / 2, xq, yD, yN0));
    const nk = xq + w / 2 > 0.6 ? 2 : 1;
    for (const k of range(nk)) parts.push(...knob('knobs', [-w / 2 + ((k + 0.5) * (xq + w / 2)) / nk, (yD + yN0) / 2, zF], 0.011));
    return parts;
  },
});

// ---------------------------------------------------------------------------
// 4. Drum ceiling extractor hood
// ---------------------------------------------------------------------------

const drumHood = defineItem({
  id: 'drum-ceiling-hood',
  name: 'Drum ceiling extractor hood',
  category: 'kitchen',
  type: 'appliances',
  group: 'Cooking',
  tags: ['cooker hood', 'island hood', 'extractor', 'cylinder', 'drum', 'ceiling hood', 'máy hút mùi', 'máy hút mùi đảo'],
  description:
    'A white drum extractor that hangs from the ceiling over an island hob: two rings of slot vents near the top, a flush steel filter disc and a warm LED ring underneath, on a short ceiling collar.',
  defaultSize: { w: 0.38, d: 0.38, h: 0.6 },
  minSize: { w: 0.3, d: 0.3, h: 0.35 },
  maxSize: { w: 0.5, d: 0.5, h: 1.2 },
  mount: 'ceiling',
  defaultElevation: CEILING - 0.6,
  slots: [
    matSlot('body', 'Body', 'metal-white-powder'),
    matSlot('vents', 'Vents & seams', 'metal-anthracite'),
    matSlot('filter', 'Filter', 'metal-brushed-steel'),
    matSlot('light', 'LED ring', 'light-warm'),
  ],
  light: { color: WARM, intensity: 1.1, distance: 3.5, y: 0.006, kind: 'spot', angle: 0.9, penumbra: 0.7 },
  variants: [
    { id: 'black', name: 'Matte black', materials: { body: 'metal-black-matte' } },
    { id: 'steel', name: 'Brushed steel', materials: { body: 'metal-brushed-steel', filter: 'metal-anthracite' } },
    { id: 'brass', name: 'Brushed brass', materials: { body: 'metal-brass', vents: 'metal-black-matte' } },
  ],
  build: ({ w, d, h }) => {
    const R = Math.min(w, d) / 2 - 0.002;
    const collar = clamp(h * 0.08, 0.03, 0.06);
    const yTop = h - collar;
    const lip = 0.01; // the drum stops short of the bottom: filter and LED ring are flush inside
    const parts: Part[] = [
      cyl('body', [0, (lip + yTop) / 2, 0], R, yTop - lip, { segments: 48 }),
      cyl('body', [0, h - collar / 2, 0], R * 0.6, collar, { segments: 32, plan: false }),
      cyl('filter', [0, 0.006, 0], R * 0.8, 0.006, { segments: 48, plan: false }),
      cyl('vents', [0, 0.002, 0], R * 0.08, 0.002, { segments: 16, plan: false }),
      ring('light', [0, 0.006, 0], R * 0.885, 0.0045, o),
      // Seam between the drum and its bottom cap.
      ring('vents', [0, 0.05, 0], R, 0.0012, o),
    ];
    // Concentric grooves on the filter.
    for (const k of [0.25, 0.45, 0.65]) parts.push(ring('vents', [0, 0.0025, 0], R * k, 0.0014, o));
    // Rings of slot vents near the top, counted from the circumference.
    const nv = clamp(Math.round((2 * Math.PI * R) / 0.03), 18, 40);
    const rows = h >= 0.45 ? 2 : 1;
    for (const j of range(rows)) {
      const y = yTop - 0.045 - j * 0.06;
      for (const k of range(nv)) {
        const a = ((k + (j % 2) * 0.5) / nv) * Math.PI * 2;
        parts.push(box('vents', [Math.cos(a) * (R - 0.001), y, Math.sin(a) * (R - 0.001)], [0.007, 0.042, 0.004], { rotation: [0, Math.PI / 2 - a, 0], plan: false }));
      }
    }
    return parts;
  },
});

// ---------------------------------------------------------------------------
// 5. Ceramic wall plate cluster
// ---------------------------------------------------------------------------

/** A handmade plate facing the front: foot ring, dished well, raised rim and a centre boss (lathe along z). */
function plate(slot: string, cx: number, cy: number, z0: number, R: number, depth: number): Part {
  const s = depth / 0.026;
  const Rf = R * 0.55;
  const prof: V2[] = [
    [0, 0.004],
    [Rf - 0.006, 0.004],
    [Rf - 0.004, 0],
    [Rf + 0.004, 0],
    [R * 0.9, 0.012],
    [R, 0.019],
    [R, 0.023],
    [R * 0.975, 0.026],
    [R * 0.9, 0.022],
    [R * 0.82, 0.015],
    [R * 0.5, 0.0115],
    [R * 0.2, 0.0125],
    [R * 0.15, 0.016],
    [R * 0.1, 0.018],
    [0, 0.0185],
  ].map(([r, y]) => [r, y * s] as V2);
  // Lathe around y, turned so its axis points to the front; the helper re-centres on mid-depth.
  const p = lathe(slot, [0, 0, 0], prof, { rotation: [Math.PI / 2, 0, 0], segments: 40 });
  p.position = [cx, cy, z0 + p.position[1]];
  return p;
}

const plateCluster = defineItem({
  id: 'wall-plate-cluster',
  name: 'Ceramic wall plate cluster',
  category: 'decor',
  type: 'decor',
  group: 'Wall art',
  tags: ['wall plates', 'ceramic', 'handmade', 'plate wall', 'terracotta', 'gallery wall', 'đĩa gốm', 'trang trí tường'],
  description:
    'A loose grid of handmade stoneware plates for a kitchen or dining wall, in terracotta, speckled cream and sand glazes, each with a raised rim, a shallow dished well and a centre boss. The number of plates follows the size.',
  defaultSize: { w: 1.4, d: 0.05, h: 0.5 },
  minSize: { w: 0.3, d: 0.03, h: 0.2 },
  maxSize: { w: 2.4, d: 0.08, h: 1.0 },
  mount: 'wall',
  defaultElevation: 1.4,
  wallSnap: true,
  slots: [matSlot('terracotta', 'Terracotta plates', 'terracotta-glaze'), matSlot('cream', 'Cream plates', 'cream-glaze'), matSlot('sand', 'Sand plates', 'sand-glaze')],
  variants: [
    { id: 'blue-white', name: 'Blue & white', materials: { terracotta: 'ceramic-blue', cream: 'ceramic-white', sand: 'tile-azulejo-floral' } },
    { id: 'sage', name: 'Sage & cream', materials: { terracotta: 'ceramic-sage', sand: 'ceramic-cream' } },
    { id: 'rustic', name: 'Rustic terracotta', materials: { terracotta: 'tile-terracotta-rustic', cream: 'tile-terrazzo-beige' } },
  ],
  build: ({ w, d, h }) => {
    const cols = clamp(Math.round(w / 0.45), 1, 6);
    const rows = clamp(Math.round(h / 0.25), 1, 4);
    const cw = w / cols;
    const ch = h / rows;
    const depth = Math.min(0.03, d - 0.003);
    const rand = rng(11);
    const slots = ['terracotta', 'cream', 'sand'];
    const parts: Part[] = [];
    for (const r of range(rows)) {
      for (const c of range(cols)) {
        // Mixed sizes, nudged off the grid within their cell so the cluster looks hung by hand.
        const R = (Math.min(cw, ch) / 2) * (0.74 + 0.22 * rand()) - 0.004;
        const sx = cw / 2 - R - 0.005;
        const sy = ch / 2 - R - 0.005;
        const x = -w / 2 + (c + 0.5) * cw + sx * (rand() * 1.6 - 0.8);
        const y = (r + 0.5) * ch + sy * (rand() * 1.6 - 0.8);
        parts.push(plate(slots[(c + r * 2) % 3], x, y, -d / 2, R, depth));
      }
    }
    return parts;
  },
});

// ---------------------------------------------------------------------------
// 6. Round bouclé-top bar stool
// ---------------------------------------------------------------------------

const boucleStool = defineItem({
  id: 'boucle-bar-stool',
  name: 'Round bouclé-top bar stool',
  category: 'kitchen',
  type: 'seating',
  group: 'Stools & benches',
  tags: ['bar stool', 'counter stool', 'boucle', 'round seat', 'footrest', 'black steel', 'ghế bar', 'ghế quầy'],
  description:
    'A bar stool with a thick round bouclé cushion on four slightly splayed black steel tube legs joined by a round footring. Lower it to about 65 cm for counter height.',
  defaultSize: { w: 0.4, d: 0.4, h: 0.75 },
  minSize: { w: 0.32, d: 0.32, h: 0.55 },
  maxSize: { w: 0.5, d: 0.5, h: 0.85 },
  slots: [matSlot('seat', 'Cushion', 'fabric-boucle'), matSlot('frame', 'Frame', 'metal-black-matte')],
  variants: [
    { id: 'oat-brass', name: 'Oat bouclé & brass', materials: { seat: 'fabric-boucle-oat', frame: 'metal-brass' } },
    { id: 'sage', name: 'Sage bouclé', materials: { seat: 'fabric-boucle-sage' } },
    { id: 'charcoal', name: 'Charcoal bouclé', materials: { seat: 'fabric-boucle-charcoal' } },
    { id: 'rust', name: 'Rust bouclé & anthracite', materials: { seat: 'fabric-boucle-rust', frame: 'metal-anthracite' } },
  ],
  build: ({ w, d, h }) => {
    const R = Math.min(w, d) / 2;
    const ch = clamp(h * 0.11, 0.06, 0.09); // cushion thickness
    const ys = h - ch; // cushion underside
    const pan = 0.012;
    const yl = ys - pan; // top of the legs
    const lr = 0.0105; // leg tube radius
    const rTop = R * 0.6;
    const rBot = R - lr - 0.004;
    const rAt = (y: number) => rBot + ((rTop - rBot) * y) / yl;
    // Domed cushion with rounded edges.
    const e = Math.min(0.022, ch / 3);
    const prof: V2[] = [
      [0, 0],
      [R - e, 0],
      ...arc(R - e, e, e, e, -Math.PI / 2, 0, 4).slice(1),
      ...arc(R - e, ch - 0.008 - e, e, e, 0, Math.PI / 2, 5),
      [R * 0.55, ch - 0.002],
      [0, ch],
    ];
    const parts: Part[] = [
      lathe('seat', [0, ys, 0], dedupe(prof), { segments: 40 }),
      cyl('frame', [0, ys - pan / 2, 0], R * 0.7, pan, { segments: 32, plan: false }),
      ring('frame', [0, yl - 0.03, 0], rAt(yl - 0.03), 0.006, o),
    ];
    // Splayed legs on the diagonals, with glides.
    for (const k of range(4)) {
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      const [c, s] = [Math.cos(a), Math.sin(a)];
      parts.push(rod('frame', [c * rBot, 0.01, s * rBot], [c * rTop, yl, s * rTop], lr, { segments: 12 }));
      parts.push(cyl('frame', [c * rBot, 0.005, s * rBot], lr * 1.15, 0.01, { segments: 12, plan: false }));
    }
    // Footring a seat's drop below the cushion.
    const yf = clamp(h - 0.47, 0.16, 0.4);
    parts.push(ring('frame', [0, yf, 0], rAt(yf), 0.008, o));
    return parts;
  },
});

// ---------------------------------------------------------------------------
// 7. Three-tier layered pendant
// ---------------------------------------------------------------------------

/** One curved shade band: a closed shell (outside) and a warm liner just inside it. */
function shade(yb: number, yt: number, rb: number, rt: number, t: number): Part[] {
  const n = 12;
  const curve = range(n + 1).map((i) => {
    const u = i / n;
    return [rt + (rb - rt) * Math.cos((u * Math.PI) / 2), yb + (yt - yb) * u] as V2;
  });
  // Bottom rim outwards, up the outside, top rim inwards, back down the inside.
  const shell: V2[] = [[rb - t, yb], ...curve, ...curve.slice().reverse().map(([r, y]) => [r - t, y] as V2)];
  // The liner runs top to bottom so it faces the axis (seen from inside).
  const liner = curve
    .slice()
    .reverse()
    .map(([r, y]) => [r - t - 0.0015, y] as V2);
  return [lathe('shade', [0, 0, 0], shell, { segments: 48 }), lathe('inner', [0, 0, 0], liner, { segments: 48, plan: false })];
}

const tieredPendant = defineItem({
  id: 'tiered-pendant',
  name: 'Three-tier layered pendant',
  category: 'lighting',
  type: 'lighting',
  group: 'Ceiling lights',
  tags: ['pendant', 'layered pendant', 'tiered shades', 'dining light', 'island light', 'glare-free', 'đèn thả', 'đèn thả bàn ăn'],
  description:
    'A pendant of three stacked, curved concentric shades getting smaller towards the top, white outside and warm brass inside, so the bulb is hidden and light spills softly between the tiers; on a cord from a round canopy.',
  defaultSize: { w: 0.5, d: 0.5, h: 1.0 },
  minSize: { w: 0.3, d: 0.3, h: 0.5 },
  maxSize: { w: 0.8, d: 0.8, h: 2.0 },
  mount: 'ceiling',
  defaultElevation: CEILING - 1.0,
  slots: [
    matSlot('shade', 'Shades (outside)', 'metal-white-powder'),
    matSlot('inner', 'Shades (inside)', 'metal-brass'),
    matSlot('frame', 'Cord, stem & canopy', 'metal-white-powder'),
    matSlot('light', 'Bulb', 'light-warm'),
  ],
  light: { color: WARM, intensity: 1.3, distance: 5, y: 0.075 },
  variants: [
    { id: 'black-brass', name: 'Black & brass', materials: { shade: 'metal-black-matte', frame: 'metal-black-matte' } },
    { id: 'all-white', name: 'All white', materials: { inner: 'paint-warm-white' } },
    { id: 'sage', name: 'Sage', materials: { shade: 'paint-sage', inner: 'paint-cream', frame: 'metal-brass' } },
  ],
  build: ({ w, d, h }) => {
    const R = Math.min(w, d) / 2 - 0.003;
    const Hs = clamp(Math.min(h - 0.12, R * 1.7), 0.15, 0.7); // height of the shade stack
    const t = 0.003;
    const tiers: [number, number, number, number][] = [
      [0, 0.36 * Hs, R, 0.64 * R],
      [0.3 * Hs, 0.68 * Hs, 0.56 * R, 0.34 * R],
      [0.62 * Hs, Hs, 0.3 * R, 0.07 * R],
    ];
    const parts: Part[] = tiers.flatMap(([yb, yt, rb, rt]) => shade(yb, yt, rb, rt, t));
    // Stem down the axis to the bulb, spokes holding the lower two tiers.
    const by = 0.17 * Hs;
    const br = Math.min(0.045, R * 0.2);
    parts.push(
      sphere('light', [0, by, 0], br, o),
      cyl('frame', [0, by + br + 0.012, 0], 0.014, 0.03, { segments: 16, plan: false }),
      rod('frame', [0, by + br + 0.027, 0], [0, Hs - 0.003, 0], 0.004, { segments: 8, plan: false }),
      cyl('frame', [0, Hs + 0.012, 0], 0.022, 0.024, { segments: 20, plan: false }),
      rod('frame', [0, Hs + 0.024, 0], [0, h - 0.025, 0], 0.0025, { segments: 6, plan: false }),
      cyl('frame', [0, h - 0.0125, 0], 0.06, 0.025, { segments: 32, plan: false }),
    );
    for (const [yb, yt, rb, rt] of tiers.slice(0, 2)) {
      // Spokes just under the top rim, reaching the liner.
      const y = yt - 0.006;
      const u = (y - yb) / (yt - yb);
      const rIn = rt + (rb - rt) * Math.cos((u * Math.PI) / 2) - t - 0.004;
      for (const k of range(3)) {
        const a = (k * 2 * Math.PI) / 3 + Math.PI / 6;
        parts.push(rod('frame', [0, y, 0], [Math.cos(a) * rIn, y, Math.sin(a) * rIn], 0.0022, { segments: 6, plan: false }));
      }
    }
    return parts;
  },
});

// ---------------------------------------------------------------------------
// 8. Arch-groove sideboard
// ---------------------------------------------------------------------------

const archSideboard = defineItem({
  id: 'arch-groove-sideboard',
  name: 'Arch-groove sideboard',
  category: 'dining',
  type: 'storage',
  group: 'Sideboards & cabinets',
  tags: ['sideboard', 'credenza', 'arch', 'beading', 'cream lacquer', 'marble top', 'tủ buffet', 'tủ vòm'],
  description:
    'A low sideboard with two to six doors, each carrying a raised arch-shaped bead routed into its face, small brass knobs, a beige marble top and a recessed plinth. Doors are counted from the width.',
  defaultSize: { w: 1.8, d: 0.45, h: 0.85 },
  minSize: { w: 0.9, d: 0.35, h: 0.6 },
  maxSize: { w: 3.0, d: 0.6, h: 1.0 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Cabinet', 'paint-cream'),
    matSlot('fronts', 'Doors', 'paint-cream'),
    matSlot('top', 'Top', 'stone-marble-beige'),
    matSlot('knobs', 'Knobs', 'metal-brass'),
  ],
  variants: [
    { id: 'sage', name: 'Sage & quartz', materials: { body: 'paint-sage', fronts: 'paint-sage', top: 'stone-quartz-white' } },
    { id: 'walnut', name: 'Walnut', materials: { body: 'wood-walnut', fronts: 'wood-walnut', top: 'stone-quartz-white' } },
    { id: 'white-oak', name: 'White oak & terrazzo', materials: { body: 'wood-white-oak', fronts: 'wood-white-oak', top: 'tile-terrazzo-beige' } },
  ],
  build: ({ w, d, h }) => {
    const tt = 0.025;
    const pk = 0.08;
    const tf = 0.02;
    const zF = d / 2 - 0.026; // door faces (the top overhangs, knobs stand proud)
    const yb = h - tt;
    const parts: Part[] = [
      span('top', [-w / 2, w / 2], [yb, h], [-d / 2, d / 2], { bevel: 0.003 }),
      span('body', [-w / 2 + 0.01, w / 2 - 0.01], [pk, yb], [-d / 2 + 0.01, zF - tf]),
      span('body', [-w / 2 + 0.04, w / 2 - 0.04], [0, pk], [-d / 2 + 0.02, zF - tf - 0.04], o),
    ];
    const n = clamp(Math.round(w / 0.45), 2, 6);
    const y0 = pk + GAP;
    const y1 = yb - GAP;
    const bead = 0.0045; // bead tube radius
    const zb = zF + 0.001; // bead centre plane: it stands 5.5 mm proud of the door
    for (const [x0, x1] of cellSpans(n, -w / 2 + 0.01, w / 2 - 0.01)) {
      const dw = x1 - x0;
      const cx = (x0 + x1) / 2;
      parts.push(span('fronts', [x0 + GAP / 2, x1 - GAP / 2], [y0, y1], [zF - tf, zF], { bevel: 0.002, plan: false }));
      // Arch bead: two legs, a sill and a semicircular head.
      const m = clamp(dw * 0.15, 0.035, 0.07);
      const yA0 = y0 + m * 1.2;
      const yA1 = y1 - m;
      const ra = Math.min(dw / 2 - m, (yA1 - yA0) * 0.5);
      const yc = yA1 - ra;
      parts.push(
        torus('fronts', [cx, yc, zb], ra, bead, { arc: Math.PI, plan: false }),
        rod('fronts', [cx - ra, yA0, zb], [cx - ra, yc, zb], bead, { segments: 8, plan: false }),
        rod('fronts', [cx + ra, yA0, zb], [cx + ra, yc, zb], bead, { segments: 8, plan: false }),
        rod('fronts', [cx - ra, yA0, zb], [cx + ra, yA0, zb], bead, { segments: 8, plan: false }),
        ...knob('knobs', [cx, yc - Math.min(0.06, (yc - yA0) * 0.3), zF], 0.011),
      );
    }
    return parts;
  },
});

// ---------------------------------------------------------------------------
// 9. Wardrobe with arched door panels
// ---------------------------------------------------------------------------

const archWardrobe = defineItem({
  id: 'arched-panel-wardrobe',
  name: 'Wardrobe with arched door panels',
  category: 'bedroom',
  type: 'storage',
  group: 'Wardrobes',
  tags: ['wardrobe', 'built-in wardrobe', 'arched doors', 'arch panel', 'oak frame', 'floor to ceiling', 'tủ quần áo', 'tủ áo vòm'],
  description:
    'A floor-to-ceiling wardrobe with an oak carcass and oak door frames holding cream panels whose upper end is a round arch, tall brass bar handles, separate top cupboards and a recessed plinth. Doors are counted from the width.',
  defaultSize: { w: 1.2, d: 0.6, h: 2.6 },
  minSize: { w: 0.6, d: 0.5, h: 2.1 },
  maxSize: { w: 3.0, d: 0.7, h: 3.0 },
  wallSnap: true,
  slots: [matSlot('oak', 'Carcass & door frames', 'wood-white-oak'), matSlot('panels', 'Door panels', 'paint-cream'), matSlot('handles', 'Handles', 'metal-brass')],
  variants: [
    { id: 'walnut', name: 'Walnut & cream', materials: { oak: 'wood-walnut' } },
    { id: 'smoked-sage', name: 'Smoked oak & sage', materials: { oak: 'wood-smoked-oak', panels: 'paint-sage' } },
    { id: 'light-oak', name: 'Light oak & warm white', materials: { oak: 'wood-oak-light', panels: 'paint-warm-white', handles: 'metal-black-matte' } },
  ],
  build: ({ w, d, h }) => {
    const side = 0.02;
    const pk = 0.08;
    const tD = 0.022; // door thickness
    const zF = d / 2 - 0.035; // door faces (bar handles stand proud)
    const zB = zF - tD - 0.003; // carcass front behind the doors
    const xi: V2 = [-w / 2 + side, w / 2 - side];
    const tc = clamp(h - 2.15, 0.28, 0.5); // top cupboards
    const ym = h - 0.025 - tc; // rail between the wardrobe doors and the top cupboards
    const parts: Part[] = [
      span('oak', [-w / 2, -w / 2 + side], [0, h], [-d / 2, zF]),
      span('oak', [w / 2 - side, w / 2], [0, h], [-d / 2, zF]),
      span('oak', xi, [h - 0.025, h], [-d / 2, zF]),
      span('oak', xi, [pk, h - 0.025], [-d / 2, zB], o),
      span('oak', xi, [pk, pk + 0.02], [zB, zF], o),
      span('oak', xi, [ym - 0.01, ym + 0.01], [zB, zF], o),
      span('oak', xi, [0, pk], [-d / 2, zF - 0.05], o),
    ];
    const n = clamp(Math.round(w / 0.5), 1, 6);
    // Handle side: doors meet in pairs; a lone (or last odd) door opens from its left stile.
    const handleRight = (i: number) => n === 1 || (i % 2 === 0 && i + 1 < n);
    const zP: V2 = [zF - tD + 0.002, zF - 0.008]; // panels sit 8 mm back in the frame
    const yd0 = pk + 0.02 + GAP;
    const yd1 = ym - 0.01 - GAP;
    for (const [i, [a, b]] of cellSpans(n, xi[0], xi[1]).entries()) {
      const x0 = a + GAP / 2;
      const x1 = b - GAP / 2;
      const st = clamp((x1 - x0) * 0.16, 0.05, 0.09);
      const xa = x0 + st;
      const xb = x1 - st;
      const ra = (xb - xa) / 2;
      const ys = yd1 - st - ra; // arch spring line
      const hx = handleRight(i) ? x1 - st / 2 : x0 + st / 2;
      // Main door: stiles, bottom rail, an arched head rail, and the cream panel behind it.
      parts.push(
        span('oak', [x0, xa], [yd0, ys], [zF - tD, zF], o),
        span('oak', [xb, x1], [yd0, ys], [zF - tD, zF], o),
        span('oak', [xa, xb], [yd0, yd0 + st], [zF - tD, zF], o),
        panelXY('oak', dedupe([[x0, ys], [x0, yd1], [x1, yd1], [x1, ys], ...arc((xa + xb) / 2, ys, ra, ra, 0, Math.PI, 16)]), zF - tD, tD),
        panelXY('panels', archPoints(xa - 0.01, xb + 0.01, yd0 + st - 0.01, ys + ra + 0.01), zP[0], zP[1] - zP[0]),
        ...barPull('handles', [hx, clamp(1.05, yd0 + 0.25, ys - 0.1), zF], 0.32, { vertical: true }),
      );
      // Top cupboard door: a plain frame and panel.
      const t0 = ym + 0.01 + GAP;
      const t1 = h - 0.025 - GAP;
      const rt = Math.min(st, (t1 - t0) * 0.25);
      parts.push(
        span('oak', [x0, xa], [t0, t1], [zF - tD, zF], o),
        span('oak', [xb, x1], [t0, t1], [zF - tD, zF], o),
        span('oak', [xa, xb], [t0, t0 + rt], [zF - tD, zF], o),
        span('oak', [xa, xb], [t1 - rt, t1], [zF - tD, zF], o),
        span('panels', [xa - 0.01, xb + 0.01], [t0 + rt - 0.01, t1 - rt + 0.01], zP, o),
        ...barPull('handles', [hx, t0 + Math.min(0.1, (t1 - t0) / 2), zF], 0.12, { vertical: true }),
      );
    }
    return parts;
  },
});

export default definePack({
  name: 'Soft-curve kitchen & storage',
  version: '1.0.0',
  author: 'Neest',
  description:
    'Rounded, finely detailed joinery and accents: a half-round V-groove breakfast bar, an open-end peninsula, a quarter-round tall cabinet with a lit walnut niche, a drum ceiling hood, handmade wall plates, a bouclé bar stool, a three-tier pendant, an arch-beaded sideboard and an arched-panel wardrobe. Every curve and count is rebuilt from the real size.',
  license: 'CC0-1.0',
  materials,
  items: [roundedPeninsula, openEndPeninsula, roundedTall, drumHood, plateCluster, boucleStool, tieredPendant, archSideboard, archWardrobe],
});

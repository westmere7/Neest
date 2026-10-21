/**
 * Curved built-ins — soft, arched joinery and plasterwork from warm modern apartments: an arched
 * limewash feature panel, banquettes with a stone ledge or scalloped arch-top cushions, a tiled
 * column with wrap-around oak shelves, a tongue-and-groove ceiling with an LED cove, an arched fin
 * partition, an arched-panel headboard wall, a half-moon shelf wall, a bead-column shelf tower, a
 * curved-bay display wall, a cubby bookcase with an arched niche, an LED step platform, a wavy
 * ceiling soffit and an oak-framed glass partition with an arched doorway.
 *
 * Everything is built from the item's real size: arches stay circular (flattening only when the
 * opening gets too short), and shelves, cubbies, cushions, boards, drawers, doors, mullions and
 * beads are counted from the size. Coordinates: x across (w), y up (h), z depth (d), front = +z.
 */
import {
  barPull,
  cellSpans,
  cells,
  clamp,
  cyl,
  dedupe,
  defineItem,
  definePack,
  knob,
  line,
  matSlot,
  poly,
  prism,
  range,
  rectPoly,
  ring,
  spaced,
  span,
  sphere,
  vcyl,
  type Part,
  type Size3,
} from '@/packs/kit';

type V2 = [number, number];
const o = { plan: false };
const CEILING = 2.7;

// ───────────── Shared geometry ─────────────

/** A flat panel in the X/Y (front) plane from [x, y] points, extruded from z0 to z0 + t. */
function panelXY(slot: string, pts: V2[], z0: number, t: number, plan = false): Part {
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
    plan,
  };
}

/** Points on an elliptical arc (centre cx, cy; radii rx, ry) from angle a0 to a1, endpoints included. */
const arc = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 16): V2[] =>
  range(n + 1).map((i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry] as V2;
  });

/** A round-top opening: centre x, half-width rx, rise ry and the springing line ys. */
interface Arch {
  cx: number;
  rx: number;
  ry: number;
  ys: number;
}

/**
 * The arch over x0..x1 whose crown is at y1: a semicircle (radius = half the width), flattened into
 * a half-ellipse only when the rise would take more than `flat` of the height y0..y1.
 */
function archOf(x0: number, x1: number, y0: number, y1: number, flat = 0.7): Arch {
  const rx = (x1 - x0) / 2;
  const ry = Math.max(0.005, Math.min(rx, (y1 - y0) * flat));
  return { cx: (x0 + x1) / 2, rx, ry, ys: y1 - ry };
}

/** Round-top shape as [x, y] points: straight sides from y0 up to the springing line, the arch on top. */
function archXY(a: Arch, y0: number, inset = 0, n = 18): V2[] {
  const rx = a.rx - inset;
  const ry = a.ry - inset;
  return dedupe([[a.cx - rx, y0], [a.cx + rx, y0], ...arc(a.cx, a.ys, rx, ry, 0, Math.PI, n)]);
}

/** The wall above an arch up to yt (yt above the crown): concave underside, as [x, y] points. */
function spandrelXY(a: Arch, yt: number, n = 18): V2[] {
  return dedupe([[a.cx - a.rx, yt], ...arc(a.cx, a.ys, a.rx, a.ry, Math.PI, 0, n), [a.cx + a.rx, yt]]);
}

/** A band `b` wide just inside the arch: the curved head only, or with legs down to y0. */
function archBandXY(a: Arch, b: number, y0?: number, n = 18): V2[] {
  const outer = arc(a.cx, a.ys, a.rx, a.ry, Math.PI, 0, n);
  const inner = arc(a.cx, a.ys, a.rx - b, a.ry - b, 0, Math.PI, n);
  if (y0 === undefined) return dedupe([...outer, ...inner]);
  return dedupe([[a.cx - a.rx, y0], ...outer, [a.cx + a.rx, y0], [a.cx + a.rx - b, y0], ...inner, [a.cx - a.rx + b, y0]]);
}

/** Plan outline [x, z] of a rectangle with back corners of radius rb and front corners of radius rf. */
function roundRect2(x0: number, x1: number, z0: number, z1: number, rb: number, rf: number, n = 6): V2[] {
  return dedupe([
    ...arc(x1 - rf, z1 - rf, rf, rf, 0, Math.PI / 2, n),
    ...arc(x0 + rf, z1 - rf, rf, rf, Math.PI / 2, Math.PI, n),
    ...arc(x0 + rb, z0 + rb, rb, rb, Math.PI, 1.5 * Math.PI, n),
    ...arc(x1 - rb, z0 + rb, rb, rb, 1.5 * Math.PI, 2 * Math.PI, n),
  ]);
}

/** Plan outline [x, z] filling a back corner (back face at z0, side face at x0) with a concave cove of radius r; dir +1 = the bay lies towards +x. */
function coveFill(x0: number, z0: number, r: number, dir: 1 | -1): V2[] {
  const a0 = dir > 0 ? Math.PI : 0;
  const a1 = dir > 0 ? 1.5 * Math.PI : -0.5 * Math.PI;
  return dedupe([[x0, z0], ...arc(x0 + dir * r, z0 + r, r, r, a0, a1, 8)]);
}

/**
 * A cabinet door x0..x1 × y0..y1 (face at z1) with a routed arch outline: a back slab, and in a
 * 4 mm front layer an arch-shaped centre panel and a surround (stiles, bottom rail, arched head)
 * kept a groove `gw` apart, so the slab shows through as a fine arched line.
 */
function archDoor(slot: string, x0: number, x1: number, y0: number, y1: number, z1: number, t: number, m = 0.05, gw = 0.006): Part[] {
  const zf = z1 - 0.004;
  const ox0 = x0 + m - gw;
  const ox1 = x1 - m + gw;
  const yb = y0 + m - gw;
  const a = archOf(ox0, ox1, yb, y1 - m + gw, 0.6);
  return [
    span(slot, [x0, x1], [y0, y1], [z1 - t, zf]),
    span(slot, [x0, ox0], [y0, y1], [zf, z1], o),
    span(slot, [ox1, x1], [y0, y1], [zf, z1], o),
    span(slot, [ox0, ox1], [y0, yb], [zf, z1], o),
    panelXY(slot, spandrelXY(a, y1), zf, 0.004),
    panelXY(slot, archXY(a, yb + gw, gw), zf, 0.004),
  ];
}

const GLOW = matSlot('glow', 'LED strip', 'light-warm');
const COOL_LED = { id: 'cool-led', name: 'Cool white LED', materials: { glow: 'light-cool' } };

// ───────────── 1. Arched feature wall panel ─────────────

const archedBackdrop = defineItem({
  id: 'arched-wall-backdrop',
  name: 'Arched feature wall panel',
  category: 'construction',
  type: 'structure',
  group: 'Portals & arches',
  tags: ['arch', 'feature wall', 'arched panel', 'limewash', 'accent wall', 'backdrop', 'mảng tường vòm'],
  description:
    'A tall round-top plaster panel standing a few centimetres proud of the wall in clay limewash, with a thin shadow reveal around its edge: frames a banquette, console or bed.',
  defaultSize: { w: 1.4, d: 0.04, h: 2.2 },
  minSize: { w: 0.5, d: 0.02, h: 1.0 },
  maxSize: { w: 3.0, d: 0.1, h: 3.4 },
  mount: 'wall',
  defaultElevation: 0,
  wallSnap: true,
  slots: [matSlot('panel', 'Plaster panel', 'limewash-terracotta'), matSlot('reveal', 'Shadow-gap reveal', 'metal-black-matte')],
  variants: [
    { id: 'sage', name: 'Sage limewash', materials: { panel: 'limewash-sage' } },
    { id: 'sand', name: 'Sand tadelakt', materials: { panel: 'tadelakt-sand' } },
    { id: 'warm', name: 'Warm limewash', materials: { panel: 'limewash-warm' } },
    { id: 'venetian', name: 'White Venetian & brass reveal', materials: { panel: 'venetian-white', reveal: 'metal-brass' } },
  ],
  build: ({ w, d, h }) => {
    const rv = Math.min(0.012, d * 0.35);
    const g = Math.min(0.012, w * 0.02);
    const face = Math.min(0.003, (d - rv) * 0.2);
    const outer = archOf(-w / 2, w / 2, 0, h);
    return [
      // Recessed backer a little smaller than the panel: the shadow reveal.
      panelXY('reveal', archXY(archOf(-w / 2 + g, w / 2 - g, 0, h - g), 0, 0, 24), -d / 2, rv),
      panelXY('panel', archXY(outer, 0, 0, 28), -d / 2 + rv, d - rv - face, true),
      // A 4 mm smaller face layer reads as an eased, hand-plastered arris.
      panelXY('panel', archXY(outer, 0, 0.004, 28), d / 2 - face, face),
    ];
  },
});

// ───────────── 2. Banquette with stone ledge ─────────────

const stoneLedgeBanquette = defineItem({
  id: 'stone-ledge-banquette',
  name: 'Built-in banquette with stone ledge',
  category: 'dining',
  type: 'seating',
  group: 'Stools & benches',
  tags: ['banquette', 'built-in seating', 'bench', 'dining nook', 'stone ledge', 'travertine', 'ghế băng'],
  description:
    'A wall-to-wall built-in banquette: knobbed drawers in a plastered base over a recessed toe kick, split seat cushions and tall upholstered back cushions, topped by a 3 cm honed stone ledge on a plastered box.',
  defaultSize: { w: 1.8, d: 0.6, h: 1.05 },
  minSize: { w: 0.9, d: 0.5, h: 0.9 },
  maxSize: { w: 4.0, d: 0.75, h: 1.3 },
  wallSnap: true,
  slots: [
    matSlot('base', 'Plastered base & box', 'plaster-stucco-white'),
    matSlot('fabric', 'Upholstery', 'fabric-boucle-oat'),
    matSlot('ledge', 'Stone ledge', 'stone-marble-beige'),
    matSlot('pulls', 'Drawer knobs', 'metal-brass'),
  ],
  variants: [
    { id: 'sage-travertine', name: 'Sage velvet & travertine', materials: { fabric: 'fabric-velvet-sage', ledge: 'stone-travertine' } },
    { id: 'linen-limewash', name: 'Linen on warm limewash', materials: { fabric: 'fabric-linen', base: 'limewash-warm' } },
    { id: 'rust-terrazzo', name: 'Rust velvet & terrazzo', materials: { fabric: 'fabric-velvet-rust', ledge: 'tile-terrazzo-beige', base: 'limewash-terracotta' } },
  ],
  build: ({ w, d, h }) => {
    const toe = 0.08;
    const deck = 0.36;
    const seatT = 0.1;
    const lt = 0.03;
    const bd = clamp(d * 0.2, 0.1, 0.16);
    const backT = 0.09;
    const zb = -d / 2;
    const zf = d / 2 - 0.045;
    const zs = zb + bd + backT;
    const parts: Part[] = [
      span('base', [-w / 2, w / 2], [0, toe], [zb, d / 2 - 0.07], o),
      span('base', [-w / 2, w / 2], [toe, deck], [zb, zf]),
      // Plastered box behind the back cushions, carrying the stone ledge.
      span('base', [-w / 2, w / 2], [deck, h - lt], [zb, zb + bd]),
      span('ledge', [-w / 2, w / 2], [h - lt, h], [zb, zb + bd + 0.045], { bevel: 0.004 }),
    ];
    // Drawers with 3 mm shadow gaps and a knob each.
    for (const [a, b] of cellSpans(clamp(Math.round(w / 0.6), 1, 7), -w / 2, w / 2)) {
      parts.push(span('base', [a + 0.0015, b - 0.0015], [toe + 0.004, deck - 0.004], [zf, zf + 0.02], o));
      parts.push(...knob('pulls', [(a + b) / 2, (toe + deck) / 2 + 0.02, zf + 0.02], 0.011));
    }
    // Seat cushions split about every metre; tall back cushions about every 65 cm.
    for (const [a, b] of cellSpans(clamp(Math.round(w / 1.0), 1, 4), -w / 2, w / 2)) {
      parts.push(span('fabric', [a + 0.003, b - 0.003], [deck, deck + seatT], [zs, d / 2 - 0.005], { bevel: 0.03, plan: false }));
    }
    for (const [a, b] of cellSpans(clamp(Math.round(w / 0.65), 1, 6), -w / 2, w / 2)) {
      parts.push(span('fabric', [a + 0.002, b - 0.002], [deck, h - lt - 0.06], [zb + bd, zs], { bevel: 0.035, plan: false }));
    }
    return parts;
  },
});

// ───────────── 3. Scalloped banquette ─────────────

const scallopedBanquette = defineItem({
  id: 'scalloped-banquette',
  name: 'Banquette with scalloped arch-top cushions',
  category: 'dining',
  type: 'seating',
  group: 'Stools & benches',
  tags: ['banquette', 'scalloped', 'arch cushions', 'velvet', 'dining nook', 'built-in seating', 'ghế băng'],
  description:
    'A painted plinth bench with one long seat cushion and a row of separately upholstered arch-top back cushions, each with a covered button, standing free against the wall like scallops.',
  defaultSize: { w: 2.0, d: 0.6, h: 0.95 },
  minSize: { w: 0.8, d: 0.5, h: 0.8 },
  maxSize: { w: 4.0, d: 0.75, h: 1.2 },
  wallSnap: true,
  slots: [matSlot('base', 'Plinth & back board', 'limewash-warm'), matSlot('fabric', 'Back cushions', 'fabric-velvet-sage'), matSlot('seat', 'Seat cushion', 'fabric-velvet-sage')],
  variants: [
    { id: 'mustard', name: 'Mustard velvet', materials: { fabric: 'fabric-velvet-mustard', seat: 'fabric-velvet-mustard' } },
    { id: 'oat-boucle', name: 'Oat bouclé on white', materials: { fabric: 'fabric-boucle-oat', seat: 'fabric-boucle-oat', base: 'plaster-stucco-white' } },
    { id: 'rust-terracotta', name: 'Rust velvet & terracotta', materials: { fabric: 'fabric-velvet-rust', seat: 'fabric-linen', base: 'limewash-terracotta' } },
  ],
  build: ({ w, d, h }) => {
    const toe = 0.08;
    const deck = 0.38;
    const seatT = 0.1;
    const board = 0.02;
    const backT = 0.075;
    const face = 0.015;
    const zb = -d / 2;
    const zc = zb + board;
    const zs = zc + backT + face;
    const cols = cellSpans(clamp(Math.round(w / 0.4), 2, 10), -w / 2, w / 2);
    const springing = archOf(cols[0][0] + 0.004, cols[0][1] - 0.004, deck, h).ys;
    const parts: Part[] = [
      span('base', [-w / 2, w / 2], [0, toe], [zb, d / 2 - 0.07], o),
      span('base', [-w / 2, w / 2], [toe, deck], [zb, d / 2 - 0.012], { bevel: 0.006 }),
      // Back board up to where the arches spring: the scallops stand free against the wall.
      span('base', [-w / 2, w / 2], [deck, springing], [zb, zc], o),
    ];
    for (const [a, b] of cols) {
      const arch = archOf(a + 0.004, b - 0.004, deck, h);
      parts.push(
        panelXY('fabric', archXY(arch, deck), zc, backT),
        // A slightly smaller front layer rounds the cushion's edge.
        panelXY('fabric', archXY(arch, deck, 0.014), zc + backT, face),
        sphere('fabric', [arch.cx, arch.ys, zs], 0.012, o),
      );
    }
    for (const [a, b] of cellSpans(w > 2.6 ? 2 : 1, -w / 2, w / 2)) {
      parts.push(span('seat', [a + 0.004, b - 0.004], [deck, deck + seatT], [zs, d / 2 - 0.004], { bevel: 0.035 }));
    }
    return parts;
  },
});

// ───────────── 4. Tiled column with wrap-around shelves ─────────────

const tiledPillar = defineItem({
  id: 'tiled-pillar-shelves',
  name: 'Tiled column with wrap-around oak shelves',
  category: 'construction',
  type: 'structure',
  group: 'Columns',
  tags: ['column', 'pillar', 'tiled', 'zellige', 'wrap-around shelf', 'oak shelf', 'cột ốp gạch'],
  description:
    'A square floor-to-ceiling column clad in glazed tiles with slim brass edge trims, and two thick oak shelves with rounded corners wrapping its front and both sides at different heights.',
  defaultSize: { w: 0.85, d: 0.65, h: 2.7 },
  minSize: { w: 0.5, d: 0.4, h: 2.2 },
  maxSize: { w: 1.4, d: 1.2, h: 3.6 },
  slots: [matSlot('tiles', 'Tiles', 'tile-zellige-green'), matSlot('shelf', 'Shelves', 'wood-white-oak'), matSlot('trim', 'Tile edge trims', 'metal-brass')],
  variants: [
    { id: 'sage-square', name: 'Sage square tile', materials: { tiles: 'tile-square-sage' } },
    { id: 'white-walnut', name: 'White subway & walnut', materials: { tiles: 'tile-subway-white', shelf: 'wood-walnut', trim: 'metal-black-matte' } },
    { id: 'terrazzo', name: 'Terrazzo & smoked oak', materials: { tiles: 'tile-terrazzo-beige', shelf: 'wood-smoked-oak' } },
  ],
  build: ({ w, d, h }) => {
    // The shelves take a band around the column; the column is what is left.
    const sd = clamp(Math.min(w * 0.22, d * 0.3), 0.1, 0.24);
    const cw = w - 2 * sd;
    const zb = -d / 2;
    const zc = d / 2 - sd;
    const tr = 0.005;
    const st = 0.05;
    const parts: Part[] = [span('tiles', [-cw / 2, cw / 2], [0, h], [zb + tr, zc])];
    for (const x of [-cw / 2, cw / 2]) for (const z of [zb + tr, zc]) parts.push(vcyl('trim', x, z, 0, h - 0.002, tr, { segments: 8, plan: false }));
    const r = 0.03;
    const z0 = zb + 0.03;
    const u: V2[] = dedupe([
      [-w / 2, z0],
      [-cw / 2, z0],
      [-cw / 2, zc],
      [cw / 2, zc],
      [cw / 2, z0],
      [w / 2, z0],
      ...arc(w / 2 - r, d / 2 - r, r, r, 0, Math.PI / 2, 6),
      ...arc(-w / 2 + r, d / 2 - r, r, r, Math.PI / 2, Math.PI, 6),
    ]);
    for (const y of [h * 0.35, h * 0.62]) parts.push(prism('shelf', u, y - st, st));
    return parts;
  },
});

// ───────────── 5. Tongue-and-groove ceiling with LED cove ─────────────

const shiplapCeiling = defineItem({
  id: 'shiplap-ceiling-cove',
  name: 'Tongue-and-groove ceiling panel with LED cove frame',
  category: 'construction',
  type: 'structure',
  group: 'Beams & ceilings',
  tags: ['ceiling', 'tongue and groove', 'shiplap', 'LED cove', 'bulkhead', 'downlights', 'trần gỗ', 'đèn hắt'],
  description:
    'A raised field of painted tongue-and-groove boards with V-grooves, framed by a plasterboard bulkhead whose inner edge hides a warm LED cove, with a grid of recessed downlights in the boards.',
  defaultSize: { w: 2.8, d: 2.4, h: 0.25 },
  minSize: { w: 1.2, d: 1.0, h: 0.12 },
  maxSize: { w: 6.0, d: 6.0, h: 0.5 },
  mount: 'ceiling',
  defaultElevation: CEILING - 0.25,
  slots: [matSlot('frame', 'Bulkhead', 'paint-warm-white'), matSlot('boards', 'Boards', 'paint-warm-white'), GLOW, matSlot('trim', 'Downlight rims', 'metal-white-powder')],
  variants: [
    { id: 'oak', name: 'White oak boards', materials: { boards: 'wood-white-oak' } },
    { id: 'cedar', name: 'Cedar boards', materials: { boards: 'wood-cedar-planks', trim: 'metal-black-matte' } },
    { id: 'sage', name: 'Sage painted boards', materials: { boards: 'paint-sage' } },
    COOL_LED,
  ],
  build: ({ w, d, h }) => {
    const bw = clamp(Math.min(w, d) * 0.12, 0.2, 0.45);
    const xi = w / 2 - bw;
    const zi = d / 2 - bw;
    const cw = Math.min(0.07, bw * 0.4);
    const lip = Math.min(0.02, h * 0.15);
    const up = Math.min(0.045, h * 0.35);
    const ut = 0.012;
    const top = h - Math.min(0.03, h * 0.2);
    const yb = top - 0.018;
    const parts: Part[] = [
      // Perimeter bulkhead and the ceiling backing above the boards.
      span('frame', [-w / 2, w / 2], [0, h], [zi, d / 2]),
      span('frame', [-w / 2, w / 2], [0, h], [-d / 2, -zi]),
      span('frame', [-w / 2, -xi], [0, h], [-zi, zi]),
      span('frame', [xi, w / 2], [0, h], [-zi, zi]),
      span('frame', [-xi, xi], [top, h], [-zi, zi], o),
      // Cove: a ledge along the bulkhead's inner edge with an upstand hiding the LED strip.
      span('frame', [-xi, xi], [0, lip], [zi - cw, zi], o),
      span('frame', [-xi, xi], [0, lip], [-zi, -zi + cw], o),
      span('frame', [-xi, -xi + cw], [0, lip], [-zi + cw, zi - cw], o),
      span('frame', [xi - cw, xi], [0, lip], [-zi + cw, zi - cw], o),
      span('frame', [-xi + cw - ut, xi - cw + ut], [lip, lip + up], [zi - cw, zi - cw + ut], o),
      span('frame', [-xi + cw - ut, xi - cw + ut], [lip, lip + up], [-zi + cw - ut, -zi + cw], o),
      span('frame', [-xi + cw - ut, -xi + cw], [lip, lip + up], [-zi + cw, zi - cw], o),
      span('frame', [xi - cw, xi - cw + ut], [lip, lip + up], [-zi + cw, zi - cw], o),
      span('glow', [-xi + cw, xi - cw], [lip, lip + 0.01], [zi - 0.016, zi - 0.004], o),
      span('glow', [-xi + cw, xi - cw], [lip, lip + 0.01], [-zi + 0.004, -zi + 0.016], o),
      span('glow', [-xi + 0.004, -xi + 0.016], [lip, lip + 0.01], [-zi + cw, zi - cw], o),
      span('glow', [xi - 0.016, xi - 0.004], [lip, lip + 0.01], [-zi + cw, zi - cw], o),
    ];
    // Boards running front to back; the bevelled edges meet in V-grooves.
    for (const [a, b] of cellSpans(clamp(Math.round((2 * xi) / 0.12), 3, 60), -xi, xi)) {
      parts.push(span('boards', [a + 0.0015, b - 0.0015], [yb, top], [-zi, zi], { bevel: 0.004, plan: false }));
    }
    // Recessed downlights in a grid about a metre apart.
    for (const x of cells(clamp(Math.round((2 * xi) / 1.2), 1, 4), -xi, xi)) {
      for (const z of cells(clamp(Math.round((2 * zi) / 1.2), 1, 3), -zi, zi)) {
        parts.push(ring('trim', [x, yb - 0.003, z], 0.04, 0.006, o), cyl('glow', [x, yb - 0.002, z], 0.034, 0.008, o));
      }
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const bw = clamp(Math.min(w, d) * 0.12, 0.2, 0.45);
    return [rectPoly(-w / 2 + bw, -d / 2 + bw, w / 2 - bw, d / 2 - bw)];
  },
});

// ───────────── 6. Arched fin partition ─────────────

const archedScreen = defineItem({
  id: 'arched-screen-partition',
  name: 'Slim partition with tall arched openings',
  category: 'construction',
  type: 'structure',
  group: 'Partitions',
  tags: ['partition', 'arched openings', 'fin wall', 'room divider', 'bed and desk', 'vách ngăn vòm'],
  description:
    'A thin floor-to-ceiling fin wall pierced by one to three tall round-top openings over oak sills: separates a bed from a desk or a hall from a living room without closing it off.',
  defaultSize: { w: 1.2, d: 0.08, h: 2.7 },
  minSize: { w: 0.5, d: 0.05, h: 2.1 },
  maxSize: { w: 4.0, d: 0.2, h: 3.6 },
  slots: [matSlot('wall', 'Wall', 'plaster-stucco-white'), matSlot('sill', 'Sills', 'wood-white-oak')],
  variants: [
    { id: 'oak', name: 'Solid oak', materials: { wall: 'wood-white-oak', sill: 'wood-walnut' } },
    { id: 'warm', name: 'Warm limewash', materials: { wall: 'limewash-warm' } },
    { id: 'sage', name: 'Sage limewash', materials: { wall: 'limewash-sage', sill: 'wood-smoked-oak' } },
    { id: 'venetian', name: 'Venetian plaster', materials: { wall: 'venetian-white' } },
  ],
  build: ({ w, d, h }) => {
    const n = clamp(Math.floor((w - 0.1) / 0.45), 1, 3);
    const post = clamp(w * 0.08, 0.08, 0.16);
    const ow = (w - (n + 1) * post) / n;
    const y0 = 0.12;
    const st = 0.02;
    const yt = h - clamp(h * 0.1, 0.2, 0.45);
    const parts: Part[] = [span('wall', [-w / 2, w / 2], [0, y0], [-d / 2, d / 2])];
    for (const i of range(n + 1)) {
      const x = -w / 2 + i * (ow + post);
      parts.push(span('wall', [x, x + post], [y0, h], [-d / 2, d / 2]));
    }
    for (const i of range(n)) {
      const xa = -w / 2 + post + i * (ow + post);
      parts.push(
        panelXY('wall', spandrelXY(archOf(xa, xa + ow, y0 + st, yt, 0.6), h, 24), -d / 2, d),
        span('sill', [xa, xa + ow], [y0, y0 + st], [-d / 2, d / 2], o),
      );
    }
    return parts;
  },
});

// ───────────── 7. Arched-panel headboard wall ─────────────

const archedHeadboard = defineItem({
  id: 'arched-headboard-wall',
  name: 'Arched-panel headboard wall',
  category: 'bedroom',
  type: 'structure',
  group: 'Built-ins',
  tags: ['headboard', 'arched panels', 'upholstered', 'oak', 'boucle', 'headboard wall', 'đầu giường'],
  description:
    'A bed-wide oak backboard with a row of arch-top upholstered panels, each framed by a slim oak bead, under a narrow oak ledge with a warm LED strip beneath it.',
  defaultSize: { w: 2.0, d: 0.08, h: 1.2 },
  minSize: { w: 0.9, d: 0.05, h: 0.8 },
  maxSize: { w: 3.2, d: 0.15, h: 1.8 },
  wallSnap: true,
  slots: [matSlot('wood', 'Oak board, beads & ledge', 'wood-white-oak'), matSlot('fabric', 'Panels', 'fabric-boucle'), GLOW],
  variants: [
    { id: 'walnut-linen', name: 'Walnut & linen', materials: { wood: 'wood-walnut', fabric: 'fabric-linen' } },
    { id: 'smoked-oat', name: 'Smoked oak & oat bouclé', materials: { wood: 'wood-smoked-oak', fabric: 'fabric-boucle-oat' } },
    { id: 'sage', name: 'Oak & sage velvet', materials: { fabric: 'fabric-velvet-sage' } },
  ],
  build: ({ w, d, h }) => {
    const lt = 0.03;
    const zb = -d / 2;
    const zp = zb + Math.max(0.018, d * 0.4);
    const pt = d / 2 - 0.01 - zp;
    const zt = zp + pt * 0.75;
    const m = clamp(w * 0.035, 0.04, 0.08);
    const gap = 0.05;
    const bead = 0.018;
    const y0 = clamp(h * 0.12, 0.1, 0.2);
    const y1 = h - lt - clamp(h * 0.06, 0.05, 0.1);
    const parts: Part[] = [
      span('wood', [-w / 2, w / 2], [0, h - lt], [zb, zp]),
      span('wood', [-w / 2, w / 2], [h - lt, h], [zb, d / 2], { bevel: 0.004 }),
      span('glow', [-w / 2 + m, w / 2 - m], [h - lt - 0.009, h - lt - 0.001], [zp + 0.001, zp + 0.011], o),
    ];
    for (const [a, b] of cellSpans(clamp(Math.round(w / 0.5), 2, 6), -w / 2 + m - gap / 2, w / 2 - m + gap / 2)) {
      const arch = archOf(a + gap / 2, b - gap / 2, y0, y1, 0.9);
      parts.push(
        // Oak bead: arched band with legs, and a bottom rail.
        panelXY('wood', archBandXY(arch, bead, y0), zp - 0.003, zt - zp + 0.003),
        span('wood', [arch.cx - arch.rx, arch.cx + arch.rx], [y0 - bead, y0], [zp - 0.003, zt], o),
        // Upholstered panel inside the bead, domed by a smaller front layer.
        panelXY('fabric', archXY(arch, y0, bead), zp, pt * 0.6),
        panelXY('fabric', archXY(arch, y0 + 0.012, bead + 0.012), zp + pt * 0.6, pt * 0.4),
      );
    }
    return parts;
  },
});

// ───────────── 8. Half-moon shelf wall ─────────────

/** The painted moon: a circle of radius R (0.45 w), cut flat at the bottom when the item is shorter than it. */
function moonGeo({ w, h }: Size3) {
  const R = Math.min(w * 0.45, h);
  const cy = h >= 2 * R ? h / 2 : h - R;
  const yb = Math.max(0, cy - R);
  const pts: V2[] =
    cy - R >= 0
      ? arc(0, cy, R, R, 0, 2 * Math.PI, 56).slice(0, -1)
      : arc(0, cy, R, R, Math.asin(-cy / R), Math.PI - Math.asin(-cy / R), 48);
  return { pts, yb, yt: Math.min(h, cy + R) };
}

const halfMoonShelves = defineItem({
  id: 'half-moon-shelf-wall',
  name: 'Painted half-moon wall feature with floating shelves',
  category: 'living',
  type: 'storage',
  group: 'Bookcases & shelves',
  tags: ['half moon', 'painted circle', 'floating shelves', 'limewash', 'feature wall', 'kệ treo', 'wall shelves'],
  description:
    'A large limewash half-moon painted a few millimetres proud of the wall, crossed by two floating oak shelves, the upper one shorter and offset; taller sizes turn the moon into a full circle.',
  defaultSize: { w: 1.4, d: 0.22, h: 0.8 },
  minSize: { w: 0.6, d: 0.12, h: 0.3 },
  maxSize: { w: 3.0, d: 0.35, h: 2.4 },
  mount: 'wall',
  defaultElevation: 1.0,
  wallSnap: true,
  slots: [matSlot('paint', 'Painted moon', 'limewash-terracotta'), matSlot('shelf', 'Shelves', 'wood-oak-light')],
  variants: [
    { id: 'sand', name: 'Sand tadelakt', materials: { paint: 'tadelakt-sand' } },
    { id: 'sage-walnut', name: 'Sage & walnut', materials: { paint: 'limewash-sage', shelf: 'wood-walnut' } },
    { id: 'warm-white-oak', name: 'Warm limewash & white oak', materials: { paint: 'limewash-warm', shelf: 'wood-white-oak' } },
  ],
  build: (size) => {
    const { w, d } = size;
    const { pts, yb, yt } = moonGeo(size);
    const hh = yt - yb;
    const st = Math.min(0.035, hh * 0.08);
    const y1 = yb + hh * 0.3;
    const y2 = yb + hh * 0.66;
    return [
      panelXY('paint', pts, -d / 2, 0.006),
      span('shelf', [-w / 2, w / 2], [y1 - st, y1], [-d / 2 + 0.002, d / 2], { bevel: 0.004 }),
      span('shelf', [-w * 0.12, w / 2], [y2 - st, y2], [-d / 2 + 0.002, d / 2], { bevel: 0.004 }),
    ];
  },
});

// ───────────── 9. Bead-column shelf tower ─────────────

const beadTower = defineItem({
  id: 'bead-column-shelf-tower',
  name: 'Floating shelf tower on bead columns with arched cubby',
  category: 'living',
  type: 'storage',
  group: 'Bookcases & shelves',
  tags: ['shelves', 'floating shelves', 'beads', 'arched cubby', 'pet nook', 'oak', 'LED', 'kệ gỗ'],
  description:
    'A low oak cabinet with an arched cut-out cubby and a cushion (a pet nook), under floating oak shelves counted from the height, each carried at its front corner by a column of stacked wooden beads and lit underneath.',
  defaultSize: { w: 0.6, d: 0.35, h: 2.2 },
  minSize: { w: 0.4, d: 0.25, h: 1.4 },
  maxSize: { w: 1.2, d: 0.5, h: 2.8 },
  wallSnap: true,
  slots: [matSlot('wood', 'Cabinet & shelves', 'wood-oak-light'), matSlot('beads', 'Bead columns', 'wood-white-oak'), GLOW, matSlot('cushion', 'Nook cushion', 'fabric-boucle-oat')],
  variants: [
    { id: 'walnut', name: 'Walnut', materials: { wood: 'wood-walnut', beads: 'wood-walnut' } },
    { id: 'smoked', name: 'Smoked oak & sage', materials: { wood: 'wood-smoked-oak', beads: 'wood-smoked-oak', cushion: 'fabric-velvet-sage' } },
    { id: 'white-oak-mustard', name: 'White oak & mustard', materials: { wood: 'wood-white-oak', cushion: 'fabric-velvet-mustard' } },
  ],
  build: ({ w, d, h }) => {
    const cabH = clamp(h * 0.27, 0.45, 0.7);
    const t = 0.018;
    const toe = 0.05;
    const zb = -d / 2;
    const zf = d / 2;
    const top = cabH - 0.03;
    const ow = clamp(w * 0.6, 0.25, 0.6);
    const yo = toe + t;
    const arch = archOf(-ow / 2, ow / 2, yo, top - 0.06, 0.8);
    const parts: Part[] = [
      span('wood', [-w / 2 + 0.03, w / 2 - 0.03], [0, toe], [zb, zf - 0.04], o),
      span('wood', [-w / 2, w / 2], [toe, top], [zb, zb + t]),
      span('wood', [-w / 2, -w / 2 + t], [toe, top], [zb + t, zf - t]),
      span('wood', [w / 2 - t, w / 2], [toe, top], [zb + t, zf - t]),
      span('wood', [-w / 2 + t, w / 2 - t], [toe, yo], [zb + t, zf - t], o),
      span('wood', [-w / 2, w / 2], [top, cabH], [zb, zf], { bevel: 0.004 }),
      // Front with the arched cut-out: two stiles, a rail under the opening and the arched head.
      span('wood', [-w / 2, -ow / 2], [toe, top], [zf - t, zf], o),
      span('wood', [ow / 2, w / 2], [toe, top], [zf - t, zf], o),
      span('wood', [-ow / 2, ow / 2], [toe, yo], [zf - t, zf], o),
      panelXY('wood', spandrelXY(arch, top), zf - t, t),
      span('cushion', [-ow / 2 + 0.015, ow / 2 - 0.015], [yo, yo + 0.05], [zb + t + 0.01, zf - t - 0.01], { bevel: 0.02, plan: false }),
    ];
    // Floating shelves; a bead column under each one's front right corner, an LED strip beneath.
    const n = clamp(Math.round((h - cabH - 0.25) / 0.38), 3, 5);
    const st = 0.04;
    const br0 = clamp(Math.min(w, d) * 0.06, 0.018, 0.03);
    const bx = w / 2 - br0 - 0.012;
    const bz = zf - br0 - 0.012;
    let below = cabH;
    for (const k of range(n)) {
      const yTop = cabH + ((h - cabH) * (k + 1)) / n;
      const yBot = yTop - st;
      parts.push(
        span('wood', [-w / 2, w / 2], [yBot, yTop], [zb, zf], { bevel: 0.005, plan: false }),
        span('glow', [-w / 2 + 0.03, bx - br0 - 0.02], [yBot - 0.008, yBot - 0.001], [zf - 0.05, zf - 0.036], o),
      );
      const m = Math.max(1, Math.round((yBot - below) / (2 * br0)));
      const br = (yBot - below) / (2 * m);
      for (const j of range(m)) parts.push(sphere('beads', [bx, below + br * (2 * j + 1), bz], br, o));
      below = yTop;
    }
    return parts;
  },
});

// ───────────── 10. Curved-bay display wall ─────────────

const curvedBayWall = defineItem({
  id: 'curved-bay-display-wall',
  name: 'Curved-bay display wall over arched-door cabinets',
  category: 'living',
  type: 'storage',
  group: 'Bookcases & shelves',
  tags: ['display wall', 'built-in shelves', 'curved', 'arched doors', 'walnut shelves', 'quartz', 'tủ kệ âm tường'],
  description:
    'Floor-to-ceiling cream joinery: tall open bays with coved back corners and lit walnut shelves that follow the curve, over base cabinets with routed arch doors, walnut knobs and a quartz top.',
  defaultSize: { w: 3.0, d: 0.45, h: 2.7 },
  minSize: { w: 1.6, d: 0.35, h: 2.1 },
  maxSize: { w: 5.0, d: 0.6, h: 3.4 },
  wallSnap: true,
  slots: [matSlot('joinery', 'Joinery', 'paint-warm-white'), matSlot('shelf', 'Shelves & knobs', 'wood-walnut'), matSlot('top', 'Worktop', 'stone-quartz-white'), GLOW],
  variants: [
    { id: 'sage', name: 'Sage joinery', materials: { joinery: 'paint-sage' } },
    { id: 'white-oak', name: 'White oak shelves', materials: { shelf: 'wood-white-oak', top: 'stone-marble-beige' } },
    { id: 'terrazzo', name: 'Greige & terrazzo', materials: { joinery: 'paint-greige', top: 'tile-terrazzo-beige', shelf: 'wood-smoked-oak' } },
  ],
  build: ({ w, d, h }) => {
    const zb = -d / 2;
    const baseH = clamp(h * 0.32, 0.75, 0.9);
    const toe = 0.1;
    const tt = 0.03;
    const du = clamp(d * 0.7, 0.25, d - 0.06);
    const zu = zb + du;
    const zk = zb + 0.02;
    const topY = h - clamp(h * 0.06, 0.12, 0.2);
    const ft = 0.04;
    const zd = d / 2 - 0.025;
    const parts: Part[] = [
      span('joinery', [-w / 2, w / 2], [0, toe], [zb, d / 2 - 0.08], o),
      span('joinery', [-w / 2, w / 2], [toe, baseH - tt], [zb, zd - 0.02]),
      span('top', [-w / 2, w / 2], [baseH - tt, baseH], [zb, d / 2], { bevel: 0.003 }),
      span('joinery', [-w / 2, w / 2], [baseH, h], [zb, zk]),
      span('joinery', [-w / 2, w / 2], [topY, h], [zk, zu], o),
    ];
    // Base cabinets: doors with a routed arch, knobs paired at the meeting edges.
    for (const [i, [a, b]] of cellSpans(clamp(Math.round(w / 0.5), 2, 8), -w / 2, w / 2).entries()) {
      parts.push(...archDoor('joinery', a + 0.0015, b - 0.0015, toe + 0.004, baseH - tt - 0.004, zd, 0.02));
      parts.push(...knob('shelf', [i % 2 === 0 ? b - 0.024 : a + 0.024, (toe + baseH) / 2 + 0.05, zd], 0.011));
    }
    // Open bays between fins.
    const nb = clamp(Math.round(w / 1.0), 2, 4);
    const bayW = (w - (nb + 1) * ft) / nb;
    const rc = clamp(bayW * 0.25, 0.05, Math.min(0.2, (du - 0.02) * 0.6));
    const rf = 0.03;
    const zs = zu - 0.015;
    const ns = clamp(Math.round((topY - baseH) / 0.42) - 1, 1, 4);
    for (const i of range(nb + 1)) {
      const x = -w / 2 + i * (bayW + ft);
      parts.push(span('joinery', [x, x + ft], [baseH, topY], [zk, zu], { bevel: 0.008 }));
    }
    for (const i of range(nb)) {
      const xa = -w / 2 + ft + i * (bayW + ft);
      const xb = xa + bayW;
      // Concave coves in the bay's back corners, and shelves that follow them.
      parts.push(prism('joinery', coveFill(xa, zk, rc, 1), baseH, topY - baseH, o), prism('joinery', coveFill(xb, zk, rc, -1), baseH, topY - baseH, o));
      const outline = roundRect2(xa, xb, zk, zs, rc, rf);
      for (const y of spaced(ns + 2, baseH, topY).slice(1, -1)) {
        parts.push(prism('shelf', outline, y - 0.018, 0.036, o), span('glow', [xa + rf + 0.01, xb - rf - 0.01], [y - 0.026, y - 0.019], [zs - 0.045, zs - 0.033], o));
      }
      // A puck light in the header over each bay.
      parts.push(cyl('glow', [(xa + xb) / 2, topY - 0.001, (zk + zu) / 2], 0.03, 0.008, o));
    }
    return parts;
  },
});

// ───────────── 11. Cubby bookcase with arched niche ─────────────

const cubbyBookcase = defineItem({
  id: 'cubby-bookcase-arch',
  name: 'Cubby bookcase wall with central arched niche',
  category: 'living',
  type: 'storage',
  group: 'Bookcases & shelves',
  tags: ['bookcase', 'cubbies', 'arched niche', 'built-in', 'oak', 'drawers', 'tủ sách'],
  description:
    'An oak bookcase wall with a grid of open cubbies either side of a full-height round-top niche lined in limewash plaster with one floating shelf, over a row of drawers with bar pulls on a recessed plinth.',
  defaultSize: { w: 3.0, d: 0.4, h: 2.4 },
  minSize: { w: 1.6, d: 0.28, h: 1.8 },
  maxSize: { w: 4.8, d: 0.55, h: 3.0 },
  wallSnap: true,
  slots: [matSlot('wood', 'Oak', 'wood-oak-light'), matSlot('niche', 'Niche plaster', 'limewash-warm'), matSlot('pulls', 'Drawer pulls', 'metal-black-matte')],
  variants: [
    { id: 'walnut-sage', name: 'Walnut & sage niche', materials: { wood: 'wood-walnut', niche: 'limewash-sage', pulls: 'metal-brass' } },
    { id: 'white-oak-terracotta', name: 'White oak & terracotta niche', materials: { wood: 'wood-white-oak', niche: 'limewash-terracotta' } },
    { id: 'smoked-brass', name: 'Smoked oak & brass', materials: { wood: 'wood-smoked-oak', niche: 'tadelakt-sand', pulls: 'metal-brass' } },
  ],
  build: ({ w, d, h }) => {
    const t = 0.025;
    const td = 0.02;
    const toe = 0.06;
    const yD = toe + clamp(h * 0.11, 0.2, 0.3);
    const y0 = yD + td;
    const nw = clamp(w * 0.3, 0.55, 1.1);
    const zb = -d / 2;
    const zk = zb + 0.012;
    const arch = archOf(-nw / 2, nw / 2, y0, h - t - 0.06, 0.5);
    const parts: Part[] = [
      span('wood', [-w / 2 + t, w / 2 - t], [0, toe], [zb, d / 2 - 0.05], o),
      span('wood', [-w / 2, -w / 2 + t], [0, h], [zb, d / 2]),
      span('wood', [w / 2 - t, w / 2], [0, h], [zb, d / 2]),
      span('wood', [-w / 2 + t, w / 2 - t], [h - t, h], [zb, d / 2]),
      span('wood', [-w / 2 + t, w / 2 - t], [yD, h - t], [zb, zk], o),
      span('wood', [-w / 2 + t, w / 2 - t], [toe, yD], [zb, d / 2 - 0.04]),
      span('wood', [-w / 2 + t, w / 2 - t], [yD, y0], [zk, d / 2], o),
      // Central niche: side walls, plaster back, the arched head and a floating shelf.
      span('wood', [-nw / 2 - t, -nw / 2], [y0, h - t], [zk, d / 2], o),
      span('wood', [nw / 2, nw / 2 + t], [y0, h - t], [zk, d / 2], o),
      panelXY('niche', archXY(arch, y0), zk + 0.002, 0.008),
      panelXY('wood', spandrelXY(arch, h - t, 24), zk, d / 2 - zk),
      span('wood', [-nw / 2, nw / 2], [y0 + (arch.ys - y0) * 0.45, y0 + (arch.ys - y0) * 0.45 + 0.03], [zk + 0.01, d / 2 - 0.02], o),
    ];
    // Cubby grids either side of the niche.
    const rows = clamp(Math.round((h - t - y0) / 0.34), 3, 8);
    for (const [a, b] of [
      [-w / 2 + t, -nw / 2 - t],
      [nw / 2 + t, w / 2 - t],
    ] as V2[]) {
      const cols = clamp(Math.round((b - a) / 0.36), 1, 5);
      for (const x of spaced(cols + 1, a, b).slice(1, -1)) parts.push(span('wood', [x - td / 2, x + td / 2], [y0, h - t], [zk, d / 2], o));
      for (const y of spaced(rows + 1, y0, h - t).slice(1, -1)) parts.push(span('wood', [a, b], [y - td / 2, y + td / 2], [zk, d / 2], o));
    }
    // Drawers set 2 cm into the carcass, each with a bar pull.
    for (const [a, b] of cellSpans(clamp(Math.round((w - 2 * t) / 0.6), 2, 8), -w / 2 + t, w / 2 - t)) {
      parts.push(span('wood', [a + 0.0015, b - 0.0015], [toe + 0.003, yD - 0.003], [d / 2 - 0.04, d / 2 - 0.02], o));
      parts.push(...barPull('pulls', [(a + b) / 2, (toe + yD) / 2, d / 2 - 0.02], Math.min(0.16, (b - a) * 0.35), { stand: 0.018 }));
    }
    return parts;
  },
});

// ───────────── 12. LED step platform ─────────────

/** Depth of the front step and the platform's front edge. */
const stepGeo = ({ d }: Size3) => {
  const sd = clamp(d * 0.15, 0.25, 0.4);
  return { sd, zP: d / 2 - sd };
};

const ledPlatform = defineItem({
  id: 'led-step-platform',
  name: 'Two-step timber platform with LED glow',
  category: 'construction',
  type: 'structure',
  group: 'Built-ins',
  tags: ['platform', 'raised floor', 'step', 'LED', 'tatami', 'sàn bục', 'study platform', 'bed platform'],
  description:
    'A raised timber floor platform with a full-width intermediate step: each oak nosing overhangs slightly with a warm LED strip tucked underneath, and the deck is laid in wide panels (or tatami mats).',
  defaultSize: { w: 2.6, d: 2.0, h: 0.35 },
  minSize: { w: 1.0, d: 0.9, h: 0.2 },
  maxSize: { w: 5.0, d: 4.0, h: 0.6 },
  slots: [matSlot('deck', 'Deck', 'wood-oak-light'), matSlot('nosing', 'Nosings & step', 'wood-white-oak'), matSlot('riser', 'Risers', 'paint-warm-white'), GLOW],
  variants: [
    { id: 'tatami', name: 'Tatami top', materials: { deck: 'tatami-mat' } },
    { id: 'walnut', name: 'Walnut', materials: { deck: 'wood-walnut', nosing: 'wood-walnut', riser: 'wood-walnut' } },
    { id: 'terrazzo', name: 'Terrazzo & oak', materials: { deck: 'tile-terrazzo-beige', riser: 'tile-terrazzo-beige' } },
    COOL_LED,
  ],
  build: (size) => {
    const { w, d, h } = size;
    const { zP } = stepGeo(size);
    const tt = Math.min(0.03, h * 0.12);
    const ov = 0.02;
    const nw = 0.07;
    const hs = h / 2;
    const parts: Part[] = [
      span('riser', [-w / 2, w / 2], [0, h - tt], [-d / 2, zP - ov]),
      span('nosing', [-w / 2, w / 2], [h - tt, h], [zP - nw, zP], { bevel: 0.004 }),
      span('glow', [-w / 2 + 0.02, w / 2 - 0.02], [h - tt - 0.012, h - tt - 0.001], [zP - ov + 0.001, zP - ov + 0.011], o),
      // The intermediate step: riser block, oak tread with an overhanging nosing and its LED.
      span('riser', [-w / 2, w / 2], [0, hs - tt], [zP - ov, d / 2 - ov]),
      span('nosing', [-w / 2, w / 2], [hs - tt, hs], [zP - ov, d / 2], { bevel: 0.004 }),
      span('glow', [-w / 2 + 0.02, w / 2 - 0.02], [hs - tt - 0.012, hs - tt - 0.001], [d / 2 - ov + 0.001, d / 2 - ov + 0.011], o),
    ];
    // Deck panels (about 90 cm wide, the size of a tatami mat) with fine grooves between them.
    for (const [a, b] of cellSpans(clamp(Math.round(w / 0.9), 1, 6), -w / 2, w / 2)) {
      parts.push(span('deck', [a + 0.001, b - 0.001], [h - tt, h], [-d / 2, zP - nw], { bevel: 0.003, plan: false }));
    }
    return parts;
  },
  planDetail: (size) => [line([-size.w / 2, stepGeo(size).zP], [size.w / 2, stepGeo(size).zP])],
});

// ───────────── 13. Wavy ceiling soffit ─────────────

/** The soffit's wavy free edge (right to left), pushed inwards by `c` along its normal. */
function waveEdge({ w, d }: Size3, c: number): V2[] {
  const k = clamp(Math.round(w / 1.2), 1, 8);
  const A = Math.min(0.25, d * 0.2);
  const n = clamp(k * 20, 24, 120);
  return range(n + 1).map((i) => {
    const u = 1 - i / n;
    const ph = 2 * Math.PI * k * u;
    const dz = (-A * Math.sin(ph) * 2 * Math.PI * k) / w;
    const len = Math.hypot(dz, 1);
    return [clamp(-w / 2 + u * w + (c * dz) / len, -w / 2, w / 2), d / 2 - A * (1 - Math.cos(ph)) - c / len] as V2;
  });
}

const wavySoffit = defineItem({
  id: 'wavy-ceiling-soffit',
  name: 'Wavy ceiling soffit with LED cove',
  category: 'construction',
  type: 'structure',
  group: 'Beams & ceilings',
  tags: ['soffit', 'wavy', 'curved ceiling', 'LED cove', 'bulkhead', 'downlights', 'trần thạch cao', 'trần lượn sóng'],
  description:
    'A plasterboard drop along a wall whose free edge swings in smooth S-curves, with a recessed warm LED strip following the wavy edge and a row of downlights in the band.',
  defaultSize: { w: 3.6, d: 1.2, h: 0.18 },
  minSize: { w: 1.2, d: 0.5, h: 0.08 },
  maxSize: { w: 8.0, d: 3.0, h: 0.5 },
  mount: 'ceiling',
  defaultElevation: CEILING - 0.18,
  wallSnap: true,
  slots: [matSlot('frame', 'Plasterboard', 'paint-warm-white'), GLOW, matSlot('trim', 'Downlight rims', 'metal-white-powder')],
  variants: [
    { id: 'venetian', name: 'Venetian plaster', materials: { frame: 'venetian-white' } },
    { id: 'warm', name: 'Warm limewash', materials: { frame: 'limewash-warm' } },
    { id: 'black-rims', name: 'Black downlights', materials: { trim: 'metal-black-matte' } },
    COOL_LED,
  ],
  build: (size) => {
    const { w, d, h } = size;
    const cw = Math.min(0.06, d * 0.1);
    const lip = Math.min(0.05, h * 0.4);
    const back: V2[] = [
      [-w / 2, -d / 2],
      [w / 2, -d / 2],
    ];
    const parts: Part[] = [
      prism('frame', [...back, ...waveEdge(size, 0)], lip, h - lip),
      // The lower layer is set back from the edge: a rebate that holds the LED strip.
      prism('frame', [...back, ...waveEdge(size, cw)], 0, lip, o),
      prism('glow', [...waveEdge(size, cw * 0.3), ...waveEdge(size, cw * 0.7).reverse()], lip - 0.008, 0.007, o),
    ];
    const k = clamp(Math.round(w / 1.2), 1, 8);
    const A = Math.min(0.25, d * 0.2);
    for (const x of cells(clamp(Math.round(w / 1.0), 1, 8), -w / 2, w / 2)) {
      const edge = d / 2 - A * (1 - Math.cos((2 * Math.PI * k * (x + w / 2)) / w)) - cw;
      const z = (-d / 2 + edge) / 2;
      parts.push(ring('trim', [x, 0.003, z], 0.04, 0.005, o), cyl('glow', [x, 0.003, z], 0.033, 0.008, o));
    }
    return parts;
  },
  planDetail: (size) => [poly(waveEdge(size, Math.min(0.06, size.d * 0.1)), false)],
});

// ───────────── 14. Arched oak-framed glass partition ─────────────

const archedGlassPartition = defineItem({
  id: 'arched-glass-partition',
  name: 'Arched oak-framed glass partition on a half wall',
  category: 'construction',
  type: 'structure',
  group: 'Partitions',
  tags: ['partition', 'glass wall', 'arched doorway', 'oak frame', 'half wall', 'room divider', 'vách kính'],
  description:
    'A plastered half wall with an oak cap and oak-framed glazing above, divided by mullions and a transom, ending in a full-height round-top doorway lined in oak.',
  defaultSize: { w: 3.0, d: 0.12, h: 2.7 },
  minSize: { w: 1.6, d: 0.08, h: 2.2 },
  maxSize: { w: 6.0, d: 0.25, h: 3.4 },
  slots: [matSlot('wall', 'Plaster', 'plaster-stucco-white'), matSlot('oak', 'Oak frame & lining', 'wood-white-oak'), matSlot('glass', 'Glass', 'glass-clear')],
  variants: [
    { id: 'reeded', name: 'Reeded glass', materials: { glass: 'glass-reeded' } },
    { id: 'black-steel', name: 'Black frame', materials: { oak: 'metal-black-matte' } },
    { id: 'walnut-limewash', name: 'Walnut & warm limewash', materials: { oak: 'wood-walnut', wall: 'limewash-warm' } },
  ],
  build: ({ w, d, h }) => {
    const e = 0.003;
    const zw: V2 = [-d / 2 + e, d / 2 - e];
    const fz: V2 = [-Math.min(0.035, d / 2 - 0.01), Math.min(0.035, d / 2 - 0.01)];
    const hw = 0.9;
    const capT = 0.04;
    const ft = 0.05;
    const ftr = 0.04;
    const lt = 0.025;
    // Doorway at the right end: end wall, opening, then an oak post closing the glazing.
    const ep = clamp(w * 0.04, 0.1, 0.2);
    const dw = clamp(w * 0.3, 0.8, 1.0);
    const xd1 = w / 2 - ep;
    const xd0 = xd1 - dw;
    const xg = xd0 - 0.07;
    const dh = clamp(Math.min(h - 0.35, 2.45), 1.9, h - 0.12);
    const door = archOf(xd0, xd1, 0, dh, 0.4);
    const parts: Part[] = [
      span('wall', [-w / 2, xg], [0, hw - capT], zw),
      span('oak', [-w / 2, xg], [hw - capT, hw], [-d / 2, d / 2], { bevel: 0.004 }),
      span('wall', [xd1, w / 2], [0, h], zw),
      panelXY('wall', spandrelXY(door, h, 24), zw[0], zw[1] - zw[0]),
      span('oak', [xg, xd0], [0, h], [-d / 2, d / 2]),
      // Oak lining: jambs and the arched head, 3 mm proud of the plaster.
      span('oak', [xd0, xd0 + lt], [0, door.ys], [-d / 2, d / 2], o),
      span('oak', [xd1 - lt, xd1], [0, door.ys], [-d / 2, d / 2], o),
      panelXY('oak', archBandXY(door, lt, undefined, 24), -d / 2, d),
      // Glazing frame over the half wall.
      span('oak', [-w / 2, -w / 2 + ft], [hw, h], fz, o),
      span('oak', [-w / 2 + ft, xg], [h - ft, h], fz, o),
      span('oak', [-w / 2 + ft, xg], [hw, hw + ftr], fz, o),
    ];
    const x0 = -w / 2 + ft;
    const panes = clamp(Math.round((xg - x0) / 0.75), 1, 8);
    for (const x of spaced(panes + 1, x0, xg).slice(1, -1)) parts.push(span('oak', [x - ftr / 2, x + ftr / 2], [hw + ftr, h - ft], fz, o));
    if (door.ys - hw > 0.45 && h - door.ys > 0.35) parts.push(span('oak', [x0, xg], [door.ys - ftr / 2, door.ys + ftr / 2], fz, o));
    // Panes run 1 cm into the stiles, mullions and post.
    for (const [a, b] of cellSpans(panes, x0, xg)) parts.push(span('glass', [a - 0.01, b + 0.01], [hw + ftr - 0.008, h - ft + 0.008], [-0.004, 0.004], o));
    return parts;
  },
  planDetail: ({ w, d }) => {
    const xd1 = w / 2 - clamp(w * 0.04, 0.1, 0.2);
    const xd0 = xd1 - clamp(w * 0.3, 0.8, 1.0);
    return [line([xd0, -d / 2], [xd1, -d / 2]), line([xd0, d / 2], [xd1, d / 2])];
  },
});

export default definePack({
  name: 'Curved built-ins',
  version: '1.0.0',
  author: 'Neest team',
  description:
    'Soft, arched joinery and plasterwork: an arched feature panel, stone-ledge and scalloped banquettes, a tiled column with wrap-around shelves, a tongue-and-groove LED-cove ceiling, an arched fin partition, an arched-panel headboard wall, a half-moon shelf wall, a bead-column shelf tower, a curved-bay display wall, a cubby bookcase with an arched niche, an LED step platform, a wavy ceiling soffit and an arched glass partition. All resize freely; arches, counts and spacing are rebuilt for every size.',
  license: 'CC0 (made for Neest)',
  items: [
    archedBackdrop,
    stoneLedgeBanquette,
    scallopedBanquette,
    tiledPillar,
    shiplapCeiling,
    archedScreen,
    archedHeadboard,
    halfMoonShelves,
    beadTower,
    curvedBayWall,
    cubbyBookcase,
    ledPlatform,
    wavySoffit,
    archedGlassPartition,
  ],
});

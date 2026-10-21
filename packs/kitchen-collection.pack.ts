/**
 * Kitchen collection — a big, matching range of kitchen cabinetry, sinks, hobs and accessories.
 *
 * Every unit shares the same joinery: 0.1 m recessed plinth, 40 mm worktop (top at 0.9 m on base
 * units), 0.6 m deep base units and 0.35 m deep wall units hung at 1.45 m, fronts on one plane, so
 * the pieces line up when placed side by side. Fronts come as shaker, slab, handleless (J-pull) or
 * glazed; worktops have shaped front edges; pulls, hinges and the contents behind glass are modelled.
 *
 * Pack patterns: quartz speckle (worktops, granite and dry goods), end-grain butcher block, matte
 * lacquer (painted fronts) and brushed stainless (steel and brass).
 */
import {
  barPull,
  blobCluster,
  bookRow,
  cells,
  cellSpans,
  circle,
  clamp,
  cyl,
  defineItem,
  definePack,
  discZ,
  foliage,
  frame4,
  knob,
  lathe,
  legs4,
  line,
  matSlot,
  mirrorZ,
  poly,
  pot,
  prism,
  range,
  rectPoly,
  ring,
  rng,
  rod,
  rodX,
  rodZ,
  shakerFront,
  slats,
  spaced,
  span,
  sphere,
  torus,
  turnedLeg,
  vcyl,
  type Part,
  type PartOpts,
  type PlanStroke,
  type V2,
  type V3,
} from '@/packs/kit';

// ---------------------------------------------------------------------------
// Shared joinery dimensions (metres) and helpers
// ---------------------------------------------------------------------------

const PLINTH = 0.1;
const TOP_T = 0.04;
const FRONT_T = 0.02;
const PULL_D = 0.025;
/** Carcass front plane for a unit of depth d: fronts and pulls sit in front of it. */
const faceZ = (d: number): number => d / 2 - FRONT_T - PULL_D;
const NP: PartOpts = { plan: false };

const FRONT = matSlot('front', 'Fronts & carcass', 'lacquer-sage');
const WORKTOP = matSlot('worktop', 'Worktop', 'quartz-white');
const BRASS = matSlot('handle', 'Handles', 'antique-brass');

type Edge = 'square' | 'eased' | 'bullnose' | 'ogee';
type Style = 'shaker' | 'slab';
type PullKind = 'cup' | 'bar' | 'knob';

/**
 * Worktop slab over x × z between heights y with a shaped front (+z) edge. `cut` leaves a hole
 * for a sink or hob; when the hole reaches the front edge the nosing stops either side of it.
 */
function worktop(slot: string, x: V2, y: V2, z: V2, edge: Edge, cut?: { x: V2; z: V2 }): Part[] {
  const t = y[1] - y[0];
  const r = edge === 'bullnose' ? t / 2 : edge === 'ogee' ? t * 0.3 : 0;
  const zE = z[1] - r;
  const bevel = edge === 'eased' ? Math.min(0.008, t * 0.25) : 0.0015;
  const parts: Part[] = [];
  const slab = (sx: V2, sz: V2) => {
    if (sx[1] - sx[0] > 0.002 && sz[1] - sz[0] > 0.002) parts.push(span(slot, sx, y, sz, { bevel }));
  };
  if (cut) {
    slab([x[0], cut.x[0]], [z[0], zE]);
    slab([cut.x[1], x[1]], [z[0], zE]);
    slab(cut.x, [z[0], cut.z[0]]);
    slab(cut.x, [cut.z[1], zE]);
  } else slab(x, [z[0], zE]);
  if (r > 0) {
    const runs: V2[] = cut && cut.z[1] >= zE - 0.001 ? [[x[0], cut.x[0]], [cut.x[1], x[1]]] : [x];
    for (const [a, b] of runs) {
      if (b - a < 0.002) continue;
      if (edge === 'bullnose') parts.push(rodX(slot, a, b, (y[0] + y[1]) / 2, zE, r, NP));
      else {
        // Ogee: a rounded upper roll over a set-back lower bead.
        parts.push(rodX(slot, a, b, y[1] - r, zE, r, NP));
        parts.push(rodX(slot, a, b, y[0] + t * 0.22, zE - t * 0.08, t * 0.22, NP));
      }
    }
  }
  return parts;
}

/** Recessed plinth and the carcass box of a base unit up to `top`. */
function baseCarcass(w: number, d: number, top: number, slot = 'front', plinthSlot = slot): Part[] {
  const zf = faceZ(d);
  return [
    span(plinthSlot, [-w / 2 + 0.004, w / 2 - 0.004], [0, PLINTH], [-d / 2, zf - 0.05], NP),
    span(slot, [-w / 2, w / 2], [PLINTH, top], [-d / 2, zf]),
  ];
}

const railFor = (x: V2, y: V2): number => clamp(Math.min(x[1] - x[0], y[1] - y[0]) * 0.14, 0.03, 0.065);

/** A door or drawer front whose back face is at `zf`. */
function panel(style: Style, slot: string, x: V2, y: V2, zf: number): Part[] {
  if (style === 'shaker') return shakerFront(slot, x, y, zf, FRONT_T, { rail: railFor(x, y) });
  return [span(slot, [x[0] + 0.0015, x[1] - 0.0015], [y[0] + 0.0015, y[1] - 0.0015], [zf, zf + FRONT_T], { bevel: 0.002, plan: false })];
}

/** Handleless front: a slab with an aluminium J-pull channel along its top edge. */
function jFront(slot: string, chSlot: string, x: V2, y: V2, zf: number): Part[] {
  const g = 0.032;
  const xa: V2 = [x[0] + 0.0015, x[1] - 0.0015];
  return [
    span(slot, xa, [y[0] + 0.0015, y[1] - g], [zf, zf + FRONT_T], { bevel: 0.0015, plan: false }),
    span(chSlot, xa, [y[1] - g, y[1] - 0.0015], [zf, zf + 0.004], NP),
    span(chSlot, xa, [y[1] - g, y[1] - g + 0.003], [zf, zf + FRONT_T], NP),
    span(chSlot, xa, [y[1] - g, y[1] - g + 0.012], [zf + FRONT_T - 0.003, zf + FRONT_T], NP),
  ];
}

/** Half-moon cup pull hanging from a small back plate; `c` lies on the front surface. */
function cupPull(slot: string, c: V3, len: number): Part[] {
  const [x, y, z] = c;
  const r = len / 2;
  return [
    span(slot, [x - r - 0.006, x + r + 0.006], [y - 0.002, y + 0.01], [z, z + 0.004], { bevel: 0.0015, plan: false }),
    torus(slot, [x, y, z + 0.011], r, 0.0055, { arc: Math.PI, rotation: [0, 0, Math.PI], scale: [1, 0.55, 1.5], plan: false }),
  ];
}

/** Pulls for a drawer front (two cup pulls or knobs on wide drawers, one long bar otherwise). */
function drawerPulls(kind: PullKind, slot: string, x: V2, y: V2, zs: number): Part[] {
  const wd = x[1] - x[0];
  const py = y[1] - Math.min(0.065, (y[1] - y[0]) / 2);
  const xs = kind !== 'bar' && wd > 0.75 ? [x[0] + wd / 4, x[1] - wd / 4] : [(x[0] + x[1]) / 2];
  return xs.flatMap((px) =>
    kind === 'cup'
      ? cupPull(slot, [px, py, zs], clamp(wd * 0.16, 0.07, 0.1))
      : kind === 'knob'
        ? knob(slot, [px, py, zs], 0.011)
        : barPull(slot, [px, py, zs], clamp(wd * 0.42, 0.1, 0.4), { stand: 0.02 }),
  );
}

/** One door (or a pair above 0.65 m) across x with pulls near the opening edges. */
function doors(style: Style, slot: string, pullSlot: string, x: V2, y: V2, zf: number, near: 'top' | 'bottom', kind: PullKind = 'bar'): Part[] {
  const n = x[1] - x[0] > 0.65 ? 2 : 1;
  const zs = zf + FRONT_T;
  return cellSpans(n, x[0], x[1]).flatMap((dx, i) => {
    const onLeft = n === 2 && i === 1;
    const inset = Math.min(0.035, (dx[1] - dx[0]) * 0.15);
    const px = onLeft ? dx[0] + inset : dx[1] - inset;
    const len = clamp((y[1] - y[0]) * 0.3, 0.08, 0.16);
    const py = near === 'top' ? y[1] - 0.05 - len / 2 : y[0] + 0.05 + len / 2;
    const pull =
      kind === 'knob'
        ? knob(pullSlot, [px, near === 'top' ? y[1] - 0.06 : y[0] + 0.06, zs], 0.011)
        : barPull(pullSlot, [px, py, zs], len, { vertical: true, stand: 0.02 });
    return [...panel(style, slot, dx, y, zf), ...pull];
  });
}

/** Rotate plain parts (no rotation of their own) by `a` about the vertical axis, then move them to `at`. */
function placeY(parts: Part[], a: number, at: V3): Part[] {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return parts.map((p) => {
    const [x, y, z] = p.position;
    const q: Part = { ...p, position: [at[0] + x * c + z * s, at[1] + y, at[2] - x * s + z * c] };
    q.rotation = [0, a, 0];
    return q;
  });
}

/** Swap x and z on plain boxes, turning a front that faces +z into one that faces +x. */
function swapXZ(parts: Part[]): Part[] {
  return parts.map((p) =>
    p.shape === 'box' ? { ...p, position: [p.position[2], p.position[1], p.position[0]], size: [p.size[2], p.size[1], p.size[0]] } : p,
  );
}

/** Mirror plain boxes left to right (x → -x). */
const mirrorX = (parts: Part[]): Part[] => parts.map((p) => ({ ...p, position: [-p.position[0], p.position[1], p.position[2]] }));

/** A flat shape facing the front (+z): `pts` are [x, y] in metres, `t` thick from depth z. */
function facePlate(slot: string, pts: V2[], z: number, t: number): Part {
  const ys = pts.map((p) => p[1]);
  const mid = (Math.min(...ys) + Math.max(...ys)) / 2;
  const xs = pts.map((p) => p[0]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  return {
    shape: 'prism',
    outline: pts.map(([x, y]) => [x - cx, -(y - mid)] as V2),
    height: t,
    position: [cx, mid, z],
    rotation: [Math.PI / 2, 0, 0],
    slot,
    plan: false,
  };
}

/** Prism whose cross-section (`yz`, as [y, z] points) is extruded along X over `x` (sloped canopies). */
function sideProfile(slot: string, yz: V2[], x: V2): Part {
  return {
    shape: 'prism',
    outline: yz.map(([y, z]) => [y, z] as V2),
    height: Math.max(0.002, x[1] - x[0]),
    position: [x[1], 0, 0],
    rotation: [0, 0, Math.PI / 2],
    slot,
    plan: false,
  };
}

// ---------------------------------------------------------------------------
// Small kitchenware
// ---------------------------------------------------------------------------

function plateStack(slot: string, x: number, y0: number, z: number, r: number, n: number): Part[] {
  const t = 0.014;
  const prof: V2[] = [
    [0, 0],
    [r * 0.55, 0],
    [r * 0.6, 0.004],
    [r, t * 0.85],
    [r * 0.96, t],
    [r * 0.62, t * 0.5],
    [0, t * 0.5],
  ];
  return range(n).map((i) => lathe(slot, [x, y0 + i * t, z], prof, { segments: 28, plan: false }));
}

function mug(slot: string, x: number, y0: number, z: number, r: number, h: number, side = 1): Part[] {
  return [
    lathe(slot, [x, y0, z], [
      [0, 0],
      [r * 0.9, 0],
      [r, h * 0.08],
      [r, h],
      [r * 0.88, h],
      [r * 0.88, h * 0.12],
      [0, h * 0.12],
    ], { segments: 20, plan: false }),
    torus(slot, [x + side * (r + h * 0.14), y0 + h * 0.52, z], h * 0.22, h * 0.055, NP),
  ];
}

function wineGlass(slot: string, x: number, y0: number, z: number, gh: number): Part {
  const r = gh * 0.21;
  return lathe(slot, [x, y0, z], [
    [0, 0],
    [r * 0.85, 0],
    [r * 0.85, gh * 0.02],
    [r * 0.12, gh * 0.06],
    [r * 0.1, gh * 0.45],
    [r * 0.8, gh * 0.58],
    [r, gh * 0.78],
    [r * 0.9, gh],
    [r * 0.84, gh],
    [r * 0.9, gh * 0.8],
    [r * 0.7, gh * 0.62],
    [0, gh * 0.56],
  ], { segments: 20, plan: false });
}

function tumbler(slot: string, x: number, y0: number, z: number, r: number, h: number): Part {
  return lathe(slot, [x, y0, z], [
    [0, 0],
    [r * 0.85, 0],
    [r, h],
    [r * 0.9, h],
    [r * 0.76, h * 0.1],
    [0, h * 0.1],
  ], { segments: 18, plan: false });
}

/** Glass storage jar with its contents and a lid, standing at (x, y0, z). */
function jar(glass: string, goods: string, lid: string, x: number, y0: number, z: number, r: number, h: number, fill: number): Part[] {
  const fh = Math.max(0.01, (h - 0.012) * fill);
  return [
    cyl(glass, [x, y0 + h / 2, z], r, h, { segments: 20, plan: false }),
    cyl(goods, [x, y0 + 0.004 + fh / 2, z], r - 0.004, fh, { segments: 16, plan: false }),
    cyl(lid, [x, y0 + h + 0.007, z], r + 0.002, 0.014, { segments: 20, plan: false }),
  ];
}

/** Gooseneck kitchen mixer with a pull-down spray head and side lever. */
function gooseneck(slot: string, x: number, zt: number, yBase: number, yTop: number, reach: number): Part[] {
  const R = reach / 2;
  const tube = 0.012;
  const yc = yTop - R - tube;
  return [
    vcyl(slot, x, zt, yBase, yBase + 0.014, 0.027, NP),
    vcyl(slot, x, zt, yBase + 0.014, yc, 0.016, NP),
    torus(slot, [x, yc, zt + R], R, tube, { rotation: [0, Math.PI / 2, 0], arc: Math.PI, plan: false }),
    vcyl(slot, x, zt + 2 * R, yc - 0.06, yc, 0.017, { rTop: tube, plan: false }),
    vcyl(slot, x, zt + 2 * R, yc - 0.066, yc - 0.06, 0.013, NP),
    sphere(slot, [x + 0.019, yBase + 0.09, zt], 0.012, NP),
    rod(slot, [x + 0.019, yBase + 0.09, zt], [x + 0.07, yBase + 0.12, zt + 0.01], 0.0055, NP),
  ];
}

/** Two-handled bridge tap: pillars with cross handles joined by a bridge, swan-neck spout. */
function bridgeTap(slot: string, zt: number, yBase: number, yTop: number, reach: number): Part[] {
  const bx = 0.1;
  const yBr = yBase + 0.075;
  const R = reach / 2;
  const tube = 0.011;
  const yc = yTop - R - tube;
  const parts: Part[] = [
    rodX(slot, -bx, bx, yBr, zt, 0.012, NP),
    vcyl(slot, 0, zt, yBr, yc, 0.013, NP),
    torus(slot, [0, yc, zt + R], R, tube, { rotation: [0, Math.PI / 2, 0], arc: Math.PI, plan: false }),
    vcyl(slot, 0, zt + 2 * R, yc - 0.03, yc, tube, NP),
    vcyl(slot, 0, zt + 2 * R, yc - 0.042, yc - 0.03, 0.015, NP),
  ];
  for (const s of [-1, 1]) {
    const x = s * bx;
    const yh = yBr + 0.072;
    parts.push(
      vcyl(slot, x, zt, yBase, yBase + 0.012, 0.024, NP),
      vcyl(slot, x, zt, yBase + 0.012, yBr + 0.05, 0.014, NP),
      vcyl(slot, x, zt, yBr + 0.05, yBr + 0.064, 0.019, { rTop: 0.013, plan: false }),
      vcyl(slot, x, zt, yBr + 0.064, yh + 0.008, 0.007, NP),
      rodX(slot, x - 0.034, x + 0.034, yh, zt, 0.0045, NP),
      rodZ(slot, x, yh, zt - 0.032, zt + 0.032, 0.0045, NP),
      sphere(slot, [x, yh + 0.009, zt], 0.008, NP),
    );
  }
  return parts;
}

/** Undermount sink bowl: floor, four walls and a waste strainer. */
function basin(slot: string, wasteSlot: string, x: V2, z: V2, yTop: number, depth: number): Part[] {
  const wt = 0.006;
  const yb = yTop - depth;
  const cx = (x[0] + x[1]) / 2;
  const cz = (z[0] + z[1]) / 2;
  return [
    span(slot, x, [yb, yb + wt], z, NP),
    span(slot, [x[0], x[0] + wt], [yb, yTop], z, NP),
    span(slot, [x[1] - wt, x[1]], [yb, yTop], z, NP),
    span(slot, [x[0] + wt, x[1] - wt], [yb, yTop], [z[0], z[0] + wt], NP),
    span(slot, [x[0] + wt, x[1] - wt], [yb, yTop], [z[1] - wt, z[1]], NP),
    cyl(slot, [cx, yb + wt + 0.002, cz], 0.045, 0.004, NP),
    ring(wasteSlot, [cx, yb + wt + 0.005, cz], 0.034, 0.0035, NP),
    cyl(wasteSlot, [cx, yb + wt + 0.005, cz], 0.012, 0.006, NP),
  ];
}

// ---------------------------------------------------------------------------
// Base units
// ---------------------------------------------------------------------------

const baseDrawers = defineItem({
  id: 'base-drawer-unit',
  name: 'Three-drawer base unit',
  category: 'kitchen',
  type: 'surfaces',
  group: 'Counters & cabinets',
  tags: ['drawers', 'base unit', 'pan drawers', 'shaker', 'cup pulls', 'worktop', 'cabinet'],
  defaultSize: { w: 0.6, d: 0.6, h: 0.9 },
  minSize: { w: 0.3, d: 0.45, h: 0.8 },
  maxSize: { w: 1.2, d: 0.7, h: 1.0 },
  wallSnap: true,
  slots: [FRONT, WORKTOP, matSlot('handle', 'Cup pulls', 'antique-brass')],
  build: ({ w, d, h }) => {
    const y1 = h - TOP_T;
    const zf = faceZ(d);
    const X: V2 = [-w / 2, w / 2];
    const top = clamp((y1 - PLINTH) * 0.2, 0.12, 0.17);
    const mid = (y1 - PLINTH - top) * 0.44;
    const rows: V2[] = [
      [y1 - top, y1],
      [y1 - top - mid, y1 - top],
      [PLINTH, y1 - top - mid],
    ];
    const parts: Part[] = [...baseCarcass(w, d, y1), ...worktop('worktop', X, [y1, h], [-d / 2, d / 2], 'bullnose')];
    for (const y of rows) parts.push(...panel('shaker', 'front', X, y, zf), ...drawerPulls('cup', 'handle', X, y, zf + FRONT_T));
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w / 2, faceZ(d)], [w / 2, faceZ(d)])],
});

const baseHandleless = defineItem({
  id: 'base-handleless',
  name: 'Handleless base cabinet',
  category: 'kitchen',
  type: 'surfaces',
  group: 'Counters & cabinets',
  tags: ['handleless', 'j-pull', 'gola', 'modern', 'slab', 'base unit', 'cabinet', 'worktop'],
  defaultSize: { w: 0.6, d: 0.6, h: 0.9 },
  minSize: { w: 0.3, d: 0.45, h: 0.8 },
  maxSize: { w: 1.2, d: 0.7, h: 1.0 },
  wallSnap: true,
  slots: [
    matSlot('front', 'Fronts & carcass', 'lacquer-charcoal'),
    matSlot('worktop', 'Worktop', 'granite-black'),
    matSlot('channel', 'J-pull channels & plinth', 'stainless'),
  ],
  build: ({ w, d, h }) => {
    const y1 = h - TOP_T;
    const zf = faceZ(d);
    const X: V2 = [-w / 2, w / 2];
    const top = clamp((y1 - PLINTH) * 0.2, 0.13, 0.17);
    const parts: Part[] = [
      ...baseCarcass(w, d, y1, 'front', 'channel'),
      ...worktop('worktop', X, [y1, h], [-d / 2, d / 2], 'square'),
      ...jFront('front', 'channel', X, [y1 - top, y1], zf),
    ];
    const n = w > 0.65 ? 2 : 1;
    for (const dx of cellSpans(n, -w / 2, w / 2)) parts.push(...jFront('front', 'channel', dx, [PLINTH, y1 - top], zf));
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w / 2, faceZ(d)], [w / 2, faceZ(d)])],
});

// ---------------------------------------------------------------------------
// Wall units
// ---------------------------------------------------------------------------

type ShelfKind = 'plates' | 'mugs' | 'glasses';

/** Crockery for one cell of a glazed cabinet: x across, standing on y0, depth z, `ch` headroom. */
function crockeryCell(kind: ShelfKind, x: V2, y0: number, z: V2, ch: number, i: number): Part[] {
  const cx = (x[0] + x[1]) / 2;
  const cw = x[1] - x[0];
  const dz = z[1] - z[0];
  const zc = (z[0] + z[1]) / 2;
  if (ch < 0.05) return [];
  if (kind === 'plates') {
    if (i % 2 === 1) {
      // Platter leaning against the back with nested bowls in front.
      const pr = Math.min(0.13, ch / 2 - 0.005, cw / 2 - 0.01);
      const tilt = 0.14;
      const br = Math.min(0.06, dz * 0.25, cw / 2 - 0.02);
      const bh = Math.min(0.05, ch * 0.3);
      return [
        cyl('dishes', [cx, y0 + pr * Math.cos(tilt) + 0.002, z[0] + 0.01 + pr * Math.sin(tilt)], pr, 0.012, {
          rotation: [Math.PI / 2 - tilt, 0, 0],
          segments: 32,
          plan: false,
        }),
        pot('dishes', [cx, y0, z[1] - br - 0.01], br, bh, 'bowl', NP),
        pot('dishes', [cx, y0 + bh * 0.45, z[1] - br - 0.01], br * 1.08, bh, 'bowl', NP),
      ];
    }
    const pr = Math.min(0.1, dz / 2 - 0.008, cw / 2 - 0.01);
    const n = clamp(Math.floor(Math.min(ch - 0.01, 0.085) / 0.014), 1, 6);
    return plateStack('dishes', cx, y0, zc, pr, n);
  }
  if (kind === 'mugs') {
    const r = Math.min(0.04, cw * 0.13, dz / 2 - 0.025);
    const mh = Math.min(0.095, ch - 0.01);
    return [...mug('dishes', cx - cw * 0.22, y0, zc, r, mh, 1), ...mug('dishes', cx + cw * 0.2, y0, zc + 0.01, r, mh, -1)];
  }
  const gh = Math.min(0.2, ch - 0.01);
  return cells(3, x[0], x[1]).map((gx, j) =>
    (i + j) % 2 === 0 ? wineGlass('glass', gx, y0, zc, gh) : tumbler('glass', gx, y0, zc, Math.min(0.035, cw / 8), Math.min(0.11, ch - 0.01)),
  );
}

const glassWall = defineItem({
  id: 'base-glass-wall-unit',
  name: 'Glass-front wall cabinet',
  category: 'kitchen',
  type: 'storage',
  group: 'Kitchen cabinets',
  tags: ['glass', 'glazed', 'display', 'wall unit', 'upper cabinet', 'crockery', 'dishes', 'glasses'],
  defaultSize: { w: 0.8, d: 0.35, h: 0.72 },
  minSize: { w: 0.4, d: 0.28, h: 0.45 },
  maxSize: { w: 1.2, d: 0.45, h: 1.0 },
  mount: 'wall',
  defaultElevation: 1.45,
  slots: [FRONT, matSlot('glass', 'Door glass & glasses', 'glass-clear'), matSlot('dishes', 'Crockery', 'ceramic-white'), matSlot('handle', 'Knobs & hinges', 'antique-brass')],
  build: ({ w, d, h }) => {
    const zb = -d / 2;
    const zf = faceZ(d);
    const zs = zf + FRONT_T;
    const t = 0.018;
    const cr = Math.min(0.035, h * 0.06);
    const lr = Math.min(0.03, h * 0.05);
    const y0 = lr;
    const y1 = h - cr;
    const xi: V2 = [-w / 2 + t, w / 2 - t];
    const parts: Part[] = [
      span('front', [-w / 2, -w / 2 + t], [y0, y1], [zb, zf]),
      span('front', [w / 2 - t, w / 2], [y0, y1], [zb, zf]),
      span('front', xi, [y0, y0 + t], [zb, zf], NP),
      span('front', xi, [y1 - t, y1], [zb, zf], NP),
      span('front', xi, [y0 + t, y1 - t], [zb, zb + 0.008], NP),
      span('front', [-w / 2, w / 2], [y1, h], [zb, zs + 0.006], { bevel: 0.004, plan: false }),
      span('front', [-w / 2, w / 2], [0, y0], [zb, zs], { bevel: 0.002, plan: false }),
    ];
    const nShelf = h >= 0.6 ? 2 : 1;
    const ia = y0 + t;
    const ib = y1 - t;
    const pitch = (ib - ia) / (nShelf + 1);
    const zi: V2 = [zb + 0.008, zf - 0.008];
    const shelfYs = range(nShelf).map((i) => ia + pitch * (i + 1));
    for (const ys of shelfYs) parts.push(span('front', xi, [ys - 0.009, ys + 0.009], [zi[0], zi[1] - 0.006], NP));
    // Crockery: plates at the bottom, mugs in the middle, glasses at the top.
    const groups = cellSpans(Math.max(1, Math.floor((xi[1] - xi[0]) / 0.24)), xi[0] + 0.01, xi[1] - 0.01);
    for (let k = 0; k <= nShelf; k++) {
      const yb = k === 0 ? ia : shelfYs[k - 1] + 0.009;
      const yt = (k === nShelf ? ib : shelfYs[k] - 0.009) - 0.01;
      const kind: ShelfKind = k === 0 ? 'plates' : k === nShelf ? 'glasses' : 'mugs';
      groups.forEach((gx, i) => parts.push(...crockeryCell(kind, gx, yb, zi, yt - yb, i)));
    }
    // Glazed doors with glazing bars at the shelf heights, barrel hinges and knobs.
    const nd = w > 0.65 ? 2 : 1;
    cellSpans(nd, -w / 2, w / 2).forEach((dx, i) => {
      const fr = Math.min(0.05, (dx[1] - dx[0]) * 0.16);
      const ox: V2 = [dx[0] + 0.0015, dx[1] - 0.0015];
      const oy: V2 = [y0 + 0.0015, y1 - 0.0015];
      const gx: V2 = [ox[0] + fr, ox[1] - fr];
      const gy: V2 = [oy[0] + fr, oy[1] - fr];
      parts.push(...frame4('front', ox, oy, [zf, zs], fr));
      parts.push(span('glass', gx, gy, [zf + 0.007, zf + 0.011], NP));
      for (const ys of shelfYs) parts.push(span('front', gx, [ys - 0.007, ys + 0.007], [zf + 0.011, zs - 0.004], NP));
      const hingeLeft = i === 0;
      const hx = hingeLeft ? ox[0] : ox[1];
      for (const hy of [oy[1] - fr - 0.03, oy[0] + fr + 0.03]) parts.push(vcyl('handle', hx, zs - 0.004, hy - 0.025, hy + 0.025, 0.0045, NP));
      const kx = hingeLeft ? ox[1] - fr / 2 : ox[0] + fr / 2;
      parts.push(...knob('handle', [kx, oy[0] + fr + 0.03, zs], 0.011));
    });
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w / 2, -d / 2], [w / 2, d / 2]), line([-w / 2, d / 2], [w / 2, -d / 2])],
});

/** Back depth of a standard 0.35 m wall unit's carcass (its front plane, measured from the wall). */
const WALL_ARM = 0.35 - FRONT_T - PULL_D;

const cornerWall = defineItem({
  id: 'wall-corner-unit',
  name: 'Corner wall cabinet',
  category: 'kitchen',
  type: 'storage',
  group: 'Kitchen cabinets',
  tags: ['corner', 'diagonal', 'wall unit', 'upper cabinet', 'shaker', 'angled door'],
  defaultSize: { w: 0.6, d: 0.6, h: 0.72 },
  minSize: { w: 0.5, d: 0.5, h: 0.4 },
  maxSize: { w: 0.9, d: 0.9, h: 1.0 },
  mount: 'wall',
  defaultElevation: 1.45,
  slots: [FRONT, matSlot('handle', 'Knob & hinges', 'antique-brass')],
  build: ({ w, d, h }) => {
    // Sits in a left-hand corner: back (-z) and left (-x) against the walls, front cut on a diagonal.
    const A = Math.min(WALL_ARM, Math.min(w, d) - 0.15);
    const cr = Math.min(0.035, h * 0.06);
    const lr = Math.min(0.03, h * 0.05);
    const q1: V2 = [w / 2, -d / 2 + A];
    const q2: V2 = [-w / 2 + A, d / 2];
    const L = Math.hypot(q2[0] - q1[0], q2[1] - q1[1]);
    const nx = (q2[1] - q1[1]) / L;
    const nz = (q1[0] - q2[0]) / L;
    const outline = (off: number): V2[] => [
      [-w / 2, -d / 2],
      [w / 2, -d / 2],
      [w / 2, q1[1] - off / nz],
      [q2[0] - off / nx, d / 2],
      [-w / 2, d / 2],
    ];
    const parts: Part[] = [
      prism('front', outline(FRONT_T), lr, h - cr - lr),
      prism('front', outline(0), 0, lr, NP),
      prism('front', outline(0), h - cr, cr, NP),
    ];
    // Shaker door on the diagonal, built facing +z then turned to face the room.
    const Ld = L - 0.008;
    const dy: V2 = [lr + 0.0015, h - cr - 0.0015];
    const local: Part[] = [
      ...shakerFront('front', [-Ld / 2, Ld / 2], dy, -FRONT_T / 2, FRONT_T, { rail: railFor([0, Ld], dy), gap: 0 }),
      span('handle', [Ld / 2 - 0.05, Ld / 2 - 0.04], [dy[0] + 0.065, dy[0] + 0.075], [FRONT_T / 2, FRONT_T / 2 + 0.012], NP),
      sphere('handle', [Ld / 2 - 0.045, dy[0] + 0.07, FRONT_T / 2 + 0.017], 0.012, { scale: [1, 1, 0.7], plan: false }),
      vcyl('handle', -Ld / 2 + 0.002, FRONT_T / 2 - 0.004, dy[1] - 0.09, dy[1] - 0.04, 0.0045, NP),
      vcyl('handle', -Ld / 2 + 0.002, FRONT_T / 2 - 0.004, dy[0] + 0.04, dy[0] + 0.09, 0.0045, NP),
    ];
    const mx = (q1[0] + q2[0]) / 2;
    const mz = (q1[1] + q2[1]) / 2;
    parts.push(...placeY(local, Math.atan2(nx, nz), [mx - (nx * FRONT_T) / 2, 0, mz - (nz * FRONT_T) / 2]));
    return parts;
  },
  planDetail: ({ w, d }) => {
    const A = Math.min(WALL_ARM, Math.min(w, d) - 0.15);
    const q1: V2 = [w / 2, -d / 2 + A];
    const q2: V2 = [-w / 2 + A, d / 2];
    return [line(q1, q2), line([-w / 2, -d / 2], [(q1[0] + q2[0]) / 2, (q1[1] + q2[1]) / 2])];
  },
});

const openCorner = defineItem({
  id: 'open-corner-shelves',
  name: 'Open corner shelf unit',
  category: 'kitchen',
  type: 'storage',
  group: 'Kitchen cabinets',
  tags: ['open shelves', 'corner', 'quarter round', 'end unit', 'wall shelf', 'display', 'plant'],
  defaultSize: { w: 0.32, d: 0.32, h: 0.72 },
  minSize: { w: 0.22, d: 0.22, h: 0.4 },
  maxSize: { w: 0.45, d: 0.45, h: 1.0 },
  mount: 'wall',
  defaultElevation: 1.45,
  slots: [
    matSlot('shelf', 'Shelves', 'wood-oak-natural'),
    matSlot('panel', 'Back panels', 'lacquer-sage'),
    matSlot('items', 'Crockery & pots', 'ceramic-white'),
    matSlot('plant', 'Herbs', 'plant-leaf'),
  ],
  build: ({ w, d, h }) => {
    const t = 0.018;
    const cx = -w / 2;
    const cz = -d / 2;
    const arc = (rx: number, rz: number, rev = false): V2[] => {
      const pts = range(11).map((i) => {
        const a = (i / 10) * (Math.PI / 2);
        return [cx + Math.cos(a) * rx, cz + Math.sin(a) * rz] as V2;
      });
      return rev ? pts.reverse() : pts;
    };
    const rx = w - 0.002;
    const rz = d - 0.002;
    const quarter: V2[] = [[cx, cz], ...arc(rx, rz)];
    const lip: V2[] = [...arc(rx, rz), ...arc(rx - 0.012, rz - 0.012, true)];
    const parts: Part[] = [span('panel', [-w / 2, w / 2], [0, h], [-d / 2, -d / 2 + t]), span('panel', [-w / 2, -w / 2 + t], [0, h], [-d / 2 + t, d / 2])];
    const n = clamp(Math.round(h / 0.24), 2, 4);
    const ys = spaced(n + 1, 0, h - t);
    ys.forEach((y, k) => {
      parts.push(prism('shelf', quarter, y, t, { plan: k === 0 }));
      if (k < n) parts.push(prism('shelf', lip, y + t, 0.02, NP));
    });
    for (let k = 0; k < n; k++) {
      const y0 = ys[k] + t;
      const ch = ys[k + 1] - y0 - 0.012;
      [0.38, 1.18].forEach((a, j) => {
        const x = cx + Math.cos(a) * rx * 0.55;
        const z = cz + Math.sin(a) * rz * 0.55;
        const s = Math.min(0.045, Math.min(w, d) * 0.14);
        const kind = (k + j * 2) % 4;
        if (kind === 0) parts.push(...mug('items', x, y0, z, s * 0.85, Math.min(0.09, ch), j === 0 ? 1 : -1));
        else if (kind === 1) {
          const ph = Math.min(0.08, ch * 0.4);
          parts.push(pot('items', [x, y0, z], s, ph, 'taper', NP));
          parts.push(...foliage('plant', [x, y0 + ph * 0.9, z], s * 1.4, Math.max(0.03, Math.min(0.16, ch - ph)), 7, 40 + k * 3 + j));
        } else if (kind === 2) {
          const jh = Math.min(0.13, ch - 0.02);
          parts.push(cyl('items', [x, y0 + jh / 2, z], s, jh, { segments: 20, plan: false }));
          parts.push(cyl('shelf', [x, y0 + jh + 0.006, z], s * 1.04, 0.012, { segments: 20, plan: false }));
          parts.push(sphere('shelf', [x, y0 + jh + 0.016, z], 0.008, NP));
        } else {
          const bh = Math.min(0.045, ch * 0.4);
          parts.push(pot('items', [x, y0, z], s * 1.1, bh, 'bowl', NP), pot('items', [x, y0 + bh * 0.5, z], s * 1.2, bh, 'bowl', NP));
        }
      });
    }
    return parts;
  },
  planDetail: ({ w, d }) =>
    [poly(range(11).map((i) => {
      const a = (i / 10) * (Math.PI / 2);
      return [-w / 2 + Math.cos(a) * (w - 0.002), -d / 2 + Math.sin(a) * (d - 0.002)] as V2;
    }), false)],
});

// ---------------------------------------------------------------------------
// Sinks
// ---------------------------------------------------------------------------

const FARM_TAP = 0.3;

function farmLayout(w: number, d: number, h: number) {
  const top = h - FARM_TAP;
  const sw = Math.min(w - 0.08, 0.84);
  return { top, sx: [-sw / 2, sw / 2] as V2, ys0: top - 0.25, zA: d / 2 - 0.012, zB: -d / 2 + 0.075 };
}

const farmhouseSink = defineItem({
  id: 'sink-base-farmhouse',
  name: 'Farmhouse sink unit',
  category: 'kitchen',
  type: 'plumbing',
  group: 'Sinks',
  tags: ['farmhouse', 'belfast', 'butler sink', 'apron front', 'fireclay', 'bridge tap', 'sink', 'country'],
  defaultSize: { w: 0.9, d: 0.6, h: 0.9 + FARM_TAP },
  minSize: { w: 0.75, d: 0.55, h: 1.1 },
  maxSize: { w: 1.2, d: 0.7, h: 1.3 },
  wallSnap: true,
  slots: [FRONT, matSlot('worktop', 'Worktop', 'butcher-block'), matSlot('sink', 'Fireclay sink', 'fireclay'), matSlot('tap', 'Tap & pulls', 'antique-brass')],
  build: ({ w, d, h }) => {
    const { top, sx, ys0, zA, zB } = farmLayout(w, d, h);
    const yt0 = top - TOP_T;
    const zf = faceZ(d);
    const wt = 0.025;
    const X: V2 = [-w / 2, w / 2];
    const stile = (x: V2): Part[] => (x[1] - x[0] > 0.1 ? panel('shaker', 'front', x, [ys0 - 0.01, yt0], zf) : panel('slab', 'front', x, [ys0 - 0.01, yt0], zf));
    const parts: Part[] = [
      span('front', [-w / 2 + 0.004, w / 2 - 0.004], [0, PLINTH], [-d / 2, zf - 0.05], NP),
      span('front', X, [PLINTH, ys0 - 0.01], [-d / 2, zf]),
      span('front', [-w / 2, sx[0]], [ys0 - 0.01, yt0], [-d / 2, zf], NP),
      span('front', [sx[1], w / 2], [ys0 - 0.01, yt0], [-d / 2, zf], NP),
      ...stile([-w / 2, sx[0] - 0.002]),
      ...stile([sx[1] + 0.002, w / 2]),
      ...worktop('worktop', X, [yt0, top], [-d / 2, d / 2], 'eased', { x: [sx[0] - 0.002, sx[1] + 0.002], z: [zB, d / 2] }),
      // Fireclay basin with a thick apron front.
      span('sink', sx, [ys0, ys0 + wt], [zB, zA], { bevel: 0.006 }),
      span('sink', [sx[0], sx[0] + wt], [ys0, top - 0.004], [zB, zA], { bevel: 0.006, plan: false }),
      span('sink', [sx[1] - wt, sx[1]], [ys0, top - 0.004], [zB, zA], { bevel: 0.006, plan: false }),
      span('sink', [sx[0] + wt, sx[1] - wt], [ys0, top - 0.004], [zB, zB + wt], NP),
      span('sink', sx, [ys0, top - 0.004], [zA - 0.032, zA], { bevel: 0.01, plan: false }),
      cyl('tap', [0, ys0 + wt + 0.002, (zB + zA) / 2 - 0.03], 0.042, 0.004, NP),
      ring('tap', [0, ys0 + wt + 0.005, (zB + zA) / 2 - 0.03], 0.03, 0.004, NP),
      ...bridgeTap('tap', -d / 2 + 0.035, top, h - 0.004, clamp((zB + zA) / 2 - (-d / 2 + 0.035), 0.14, 0.24)),
      ...doors('shaker', 'front', 'tap', X, [PLINTH, ys0 - 0.012], zf, 'top'),
    ];
    return parts;
  },
  planDetail: ({ w, d, h }) => {
    const { sx, zA, zB } = farmLayout(w, d, h);
    return [
      rectPoly(sx[0] + 0.025, zB + 0.025, sx[1] - 0.025, zA - 0.032),
      circle([0, (zB + zA) / 2 - 0.03], 0.035),
      line([-0.1, -d / 2 + 0.035], [0.1, -d / 2 + 0.035]),
    ];
  },
});

const SINK_TAP = 0.27;

function doubleLayout(w: number, d: number, h: number) {
  const top = h - SINK_TAP;
  const bd = clamp(d - 0.2, 0.3, 0.42);
  const bz: V2 = [0.03 - bd / 2, 0.03 + bd / 2];
  const total = Math.min(w - 0.16, 0.86);
  const drainer = w - total >= 0.36;
  const x0 = drainer ? -w / 2 + 0.08 : -total / 2;
  const mw = total * 0.57;
  return {
    top,
    bz,
    drainer,
    b1: [x0, x0 + mw] as V2,
    b2: [x0 + mw + 0.05, x0 + total] as V2,
    dx: [x0 + total + 0.04, w / 2 - 0.05] as V2,
    zt: bz[0] - 0.045,
  };
}

const doubleSink = defineItem({
  id: 'sink-double',
  name: 'Double-bowl sink unit',
  category: 'kitchen',
  type: 'plumbing',
  group: 'Sinks',
  tags: ['double sink', 'two bowl', 'undermount', 'stainless', 'gooseneck', 'pull-down tap', 'drainer', 'sink'],
  defaultSize: { w: 1.2, d: 0.6, h: 0.9 + SINK_TAP },
  minSize: { w: 0.8, d: 0.5, h: 1.05 },
  maxSize: { w: 1.5, d: 0.7, h: 1.3 },
  wallSnap: true,
  slots: [FRONT, WORKTOP, matSlot('sink', 'Sink & drainer', 'stainless'), matSlot('tap', 'Tap & pulls', 'antique-brass')],
  build: ({ w, d, h }) => {
    const L = doubleLayout(w, d, h);
    const { top, bz, b1, b2 } = L;
    const yt0 = top - TOP_T;
    const zf = faceZ(d);
    const depth = 0.2;
    const X: V2 = [-w / 2, w / 2];
    const yc = top - depth - 0.012;
    const parts: Part[] = [
      span('front', [-w / 2 + 0.004, w / 2 - 0.004], [0, PLINTH], [-d / 2, zf - 0.05], NP),
      span('front', X, [PLINTH, yc], [-d / 2, zf]),
      span('front', [-w / 2, -w / 2 + 0.018], [yc, yt0], [-d / 2, zf], NP),
      span('front', [w / 2 - 0.018, w / 2], [yc, yt0], [-d / 2, zf], NP),
      span('front', [-w / 2 + 0.018, w / 2 - 0.018], [yc, yt0], [-d / 2, -d / 2 + 0.018], NP),
      ...worktop('worktop', X, [yt0, top], [-d / 2, d / 2], 'bullnose', { x: [b1[0], b2[1]], z: bz }),
      span('worktop', [b1[1], b2[0]], [yt0, top], bz, NP),
      ...basin('sink', 'tap', b1, bz, top - 0.002, depth),
      ...basin('sink', 'tap', b2, bz, top - 0.002, depth - 0.04),
      ...gooseneck('tap', (b1[0] + b1[1]) / 2, L.zt, top, h - 0.004, clamp((bz[1] - bz[0]) * 0.5, 0.14, 0.2)),
      // Soap pump beside the tap.
      vcyl('tap', (b2[0] + b2[1]) / 2, L.zt, top, top + 0.01, 0.018, NP),
      vcyl('tap', (b2[0] + b2[1]) / 2, L.zt, top + 0.01, top + 0.075, 0.01, NP),
      rod('tap', [(b2[0] + b2[1]) / 2, top + 0.07, L.zt], [(b2[0] + b2[1]) / 2, top + 0.07, L.zt + 0.05], 0.004, NP),
      ...panel('shaker', 'front', X, [yt0 - 0.13, yt0], zf),
      ...doors('shaker', 'front', 'tap', X, [PLINTH, yt0 - 0.13], zf, 'top'),
    ];
    if (L.drainer) {
      const dz: V2 = [bz[0] + 0.01, bz[1] - 0.01];
      parts.push(span('sink', L.dx, [top - 0.001, top + 0.004], dz, { bevel: 0.0015, plan: false }));
      parts.push(
        ...slats('sink', [L.dx[0] + 0.02, L.dx[1] - 0.02], [top + 0.004, top + 0.007], [dz[0] + 0.03, dz[1] - 0.03], Math.max(2, Math.round((L.dx[1] - L.dx[0] - 0.04) / 0.03)), {
          axis: 'x',
          gap: 0.55,
          plan: false,
        }),
      );
    }
    return parts;
  },
  planDetail: ({ w, d, h }) => {
    const L = doubleLayout(w, d, h);
    const strokes: PlanStroke[] = [
      rectPoly(L.b1[0], L.bz[0], L.b1[1], L.bz[1]),
      rectPoly(L.b2[0], L.bz[0], L.b2[1], L.bz[1]),
      circle([(L.b1[0] + L.b1[1]) / 2, (L.bz[0] + L.bz[1]) / 2], 0.035),
      circle([(L.b2[0] + L.b2[1]) / 2, (L.bz[0] + L.bz[1]) / 2], 0.035),
    ];
    if (L.drainer) for (const x of spaced(4, L.dx[0] + 0.03, L.dx[1] - 0.03)) strokes.push(line([x, L.bz[0] + 0.04], [x, L.bz[1] - 0.04]));
    return strokes;
  },
});

// ---------------------------------------------------------------------------
// Cooking
// ---------------------------------------------------------------------------

/** Three graduated pan drawers between the plinth and `y1`. */
function panDrawers(w: number, d: number, y1: number, pullSlot: string): Part[] {
  const zf = faceZ(d);
  const X: V2 = [-w / 2, w / 2];
  const top = clamp((y1 - PLINTH) * 0.2, 0.12, 0.16);
  const mid = (y1 - PLINTH - top) * 0.45;
  const rows: V2[] = [
    [y1 - top, y1],
    [y1 - top - mid, y1 - top],
    [PLINTH, y1 - top - mid],
  ];
  return rows.flatMap((y) => [...panel('shaker', 'front', X, y, zf), ...drawerPulls('bar', pullSlot, X, y, zf + FRONT_T)]);
}

function inductionLayout(w: number, d: number) {
  return { hw: Math.min(w - 0.08, 0.78), hd: Math.min(d - 0.1, 0.52) };
}

const inductionHob = defineItem({
  id: 'hob-induction',
  name: 'Induction hob unit',
  category: 'kitchen',
  type: 'appliances',
  group: 'Cooking',
  tags: ['induction', 'hob', 'cooktop', 'flex zone', 'glass', 'pan drawers', 'base unit'],
  defaultSize: { w: 0.8, d: 0.6, h: 0.9 },
  minSize: { w: 0.6, d: 0.5, h: 0.8 },
  maxSize: { w: 1.0, d: 0.7, h: 1.0 },
  wallSnap: true,
  slots: [FRONT, WORKTOP, matSlot('hob', 'Hob glass', 'screen-black'), matSlot('handle', 'Pulls & zone markings', 'stainless')],
  build: ({ w, d, h }) => {
    const { hw, hd } = inductionLayout(w, d);
    const y1 = h - TOP_T;
    const X: V2 = [-w / 2, w / 2];
    const ym = h + 0.0012;
    const mark = (x: V2, z: V2): Part => span('handle', x, [h + 0.0006, ym], z, NP);
    const parts: Part[] = [
      ...baseCarcass(w, d, y1),
      ...worktop('worktop', X, [y1, h], [-d / 2, d / 2], 'bullnose', { x: [-hw / 2, hw / 2], z: [-hd / 2, hd / 2] }),
      span('hob', [-hw / 2, hw / 2], [h - 0.05, h + 0.0006], [-hd / 2, hd / 2], { bevel: 0.002 }),
      ...panDrawers(w, d, y1, 'handle'),
    ];
    const za = -hd / 2 + 0.035;
    const zb = hd / 2 - 0.085;
    if (hw >= 0.66) {
      // Flex zone on the left (two linked squares), two round zones on the right.
      const fx: V2 = [-hw / 2 + 0.045, -0.03];
      const zm = (za + zb) / 2;
      const s = 0.0025;
      for (const z of [za, zm, zb]) parts.push(mark(fx, [z - s, z + s]));
      parts.push(mark([fx[0] - s, fx[0] + s], [za, zb]), mark([fx[1] - s, fx[1] + s], [za, zb]));
      const rx = hw / 4 + 0.02;
      const r1 = Math.min(0.09, (zb - za) / 4 + 0.01, hw / 4 - 0.03);
      for (const [z, r] of [
        [za + r1 + 0.005, r1 * 0.85],
        [zb - r1, r1],
      ] as V2[]) {
        parts.push(ring('handle', [rx, ym, z], r, 0.0016, NP), ring('handle', [rx, ym, z], r * 0.55, 0.0016, NP));
      }
    } else {
      const r = Math.min(0.085, hw / 4 - 0.02, (zb - za) / 4);
      for (const x of [-hw / 4, hw / 4]) {
        for (const z of [za + r, zb - r]) parts.push(ring('handle', [x, ym, z], r, 0.0016, NP), ring('handle', [x, ym, z], r * 0.55, 0.0016, NP));
      }
    }
    // Touch slider and zone selectors along the front of the glass.
    const zc = hd / 2 - 0.045;
    parts.push(mark([-hw * 0.28, hw * 0.12], [zc - 0.003, zc + 0.003]));
    for (const x of spaced(4, -hw * 0.42, -hw * 0.32)) parts.push(cyl('handle', [x, h + 0.0009, zc], 0.006, 0.0006, NP));
    parts.push(ring('handle', [hw / 2 - 0.05, ym, zc], 0.012, 0.0016, NP), ring('handle', [hw / 2 - 0.1, ym, zc], 0.009, 0.0016, NP));
    return parts;
  },
  planDetail: ({ w, d }) => {
    const { hw, hd } = inductionLayout(w, d);
    return [rectPoly(-hw / 2, -hd / 2, hw / 2, hd / 2), line([-w / 2, faceZ(d)], [w / 2, faceZ(d)])];
  },
});

const GRATE_H = 0.04;

function gasLayout(w: number, d: number) {
  const hw = Math.min(w - 0.06, 0.88);
  const hd = Math.min(d - 0.08, 0.52);
  const za = -hd / 2 + 0.03;
  const zb = hd / 2 - 0.09;
  const colX = hw * 0.335;
  const row: V2 = [za + (zb - za) * 0.25, za + (zb - za) * 0.75];
  const rS = Math.min(0.036, (zb - za) * 0.16);
  const rM = Math.min(0.046, (zb - za) * 0.2);
  const rW = Math.min(0.066, hw * 0.075, (zb - za) * 0.3);
  // [x, z, radius]
  const burners: V3[] = [
    [-colX, row[0], rM],
    [-colX, row[1], rS],
    [0, (za + zb) / 2, rW],
    [colX, row[0], rS],
    [colX, row[1], rM],
  ];
  return { hw, hd, za, zb, burners };
}

const gasHob = defineItem({
  id: 'hob-gas',
  name: 'Gas hob unit',
  category: 'kitchen',
  type: 'appliances',
  group: 'Cooking',
  tags: ['gas', 'hob', 'stove', 'burners', 'wok burner', 'cast iron', 'grates', 'cooktop', 'range'],
  defaultSize: { w: 0.9, d: 0.6, h: 0.9 + GRATE_H },
  minSize: { w: 0.75, d: 0.55, h: 0.84 },
  maxSize: { w: 1.2, d: 0.7, h: 1.04 },
  wallSnap: true,
  slots: [FRONT, WORKTOP, matSlot('hob', 'Hob, burners & pulls', 'stainless'), matSlot('grate', 'Grates, caps & knobs', 'cast-iron')],
  build: ({ w, d, h }) => {
    const { hw, hd, zb, burners } = gasLayout(w, d);
    const yw = h - GRATE_H;
    const y1 = yw - TOP_T;
    const pt = yw + 0.008;
    const gy = pt + 0.021;
    const X: V2 = [-w / 2, w / 2];
    const parts: Part[] = [
      ...baseCarcass(w, d, y1),
      ...worktop('worktop', X, [y1, yw], [-d / 2, d / 2], 'bullnose'),
      span('hob', [-hw / 2, hw / 2], [yw, pt], [-hd / 2, hd / 2], { bevel: 0.003 }),
      ...panDrawers(w, d, y1, 'hob'),
    ];
    // Burners: aluminium crowns under black enamel caps; the wok burner has a triple crown.
    for (const [x, z, r] of burners) {
      parts.push(vcyl('hob', x, z, pt, pt + 0.01, r, { segments: 24, plan: false }));
      parts.push(vcyl('grate', x, z, pt + 0.01, pt + 0.016, r * 0.8, { segments: 24, plan: false }));
      if (r > 0.055) {
        parts.push(vcyl('hob', x, z, pt + 0.016, pt + 0.021, r * 0.48, { segments: 20, plan: false }));
        parts.push(vcyl('grate', x, z, pt + 0.021, pt + 0.025, r * 0.32, { segments: 20, plan: false }));
      }
    }
    // Three cast-iron grate sections: frame on little feet, with fingers reaching to each burner.
    const gz: V2 = [-hd / 2 + 0.015, zb + 0.02];
    const sections: { x: V2; b: V3[] }[] = [
      { x: [-hw / 2 + 0.012, -hw * 0.168 - 0.003], b: [burners[0], burners[1]] },
      { x: [-hw * 0.168 + 0.003, hw * 0.168 - 0.003], b: [burners[2]] },
      { x: [hw * 0.168 + 0.003, hw / 2 - 0.012], b: [burners[3], burners[4]] },
    ];
    const gr = 0.0055;
    for (const s of sections) {
      parts.push(rodX('grate', s.x[0], s.x[1], gy, gz[0], gr, NP), rodX('grate', s.x[0], s.x[1], gy, gz[1], gr, NP));
      parts.push(rodZ('grate', s.x[0], gy, gz[0], gz[1], gr, NP), rodZ('grate', s.x[1], gy, gz[0], gz[1], gr, NP));
      for (const x of s.x) for (const z of gz) parts.push(vcyl('grate', x, z, pt, gy, 0.006, NP));
      const edges = s.b.length === 2 ? [gz[0], (s.b[0][1] + s.b[1][1]) / 2, gz[1]] : [gz[0], gz[1]];
      if (s.b.length === 2) parts.push(rodX('grate', s.x[0], s.x[1], gy, edges[1], gr, NP));
      s.b.forEach(([x, z, r], i) => {
        const inner = r * 0.55;
        parts.push(rodX('grate', s.x[0], x - inner, gy, z, gr, NP), rodX('grate', x + inner, s.x[1], gy, z, gr, NP));
        parts.push(rodZ('grate', x, gy, edges[i], z - inner, gr, NP), rodZ('grate', x, gy, z + inner, edges[i + 1], gr, NP));
      });
    }
    // Five control knobs along the front of the hob plate.
    const zk = hd / 2 - 0.045;
    for (const x of spaced(5, -hw * 0.36, hw * 0.36)) {
      parts.push(vcyl('hob', x, zk, pt, pt + 0.003, 0.024, NP));
      parts.push(vcyl('grate', x, zk, pt + 0.003, pt + 0.025, 0.017, { rTop: 0.015, plan: false }));
      parts.push(span('hob', [x - 0.0025, x + 0.0025], [pt + 0.025, pt + 0.0265], [zk - 0.013, zk - 0.003], NP));
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const { hw, hd, burners } = gasLayout(w, d);
    const strokes: PlanStroke[] = [rectPoly(-hw / 2, -hd / 2, hw / 2, hd / 2)];
    for (const [x, z, r] of burners) strokes.push(circle([x, z], r), circle([x, z], r * 0.5));
    for (const x of spaced(5, -hw * 0.36, hw * 0.36)) strokes.push(circle([x, hd / 2 - 0.045], 0.017));
    return strokes;
  },
});

const ovenTower = defineItem({
  id: 'oven-microwave-tower',
  name: 'Oven and microwave tower',
  category: 'kitchen',
  type: 'appliances',
  group: 'Cooking',
  tags: ['oven', 'microwave', 'tall unit', 'housing', 'warming drawer', 'built-in', 'appliance tower'],
  defaultSize: { w: 0.6, d: 0.6, h: 2.2 },
  minSize: { w: 0.56, d: 0.55, h: 1.9 },
  maxSize: { w: 0.9, d: 0.7, h: 2.5 },
  wallSnap: true,
  slots: [FRONT, matSlot('glass', 'Appliance glass', 'screen-black'), matSlot('steel', 'Appliance steel', 'stainless'), BRASS],
  build: ({ w, d, h }) => {
    const zf = faceZ(d);
    const zs = zf + FRONT_T;
    const X: V2 = [-w / 2, w / 2];
    const XI: V2 = [-w / 2 + 0.0015, w / 2 - 0.0015];
    const cr = 0.03;
    const dr: V2 = [PLINTH, 0.42];
    const parts: Part[] = [
      ...baseCarcass(w, d, h - cr),
      span('front', [-w / 2, w / 2], [h - cr, h], [-d / 2, zs + 0.008], { bevel: 0.004, plan: false }),
      // Deep pan drawer.
      ...panel('shaker', 'front', X, dr, zf),
      ...drawerPulls('cup', 'handle', X, dr, zs),
      // Warming drawer.
      span('steel', XI, [0.4215, 0.5585], [zf, zs], { bevel: 0.003, plan: false }),
      span('glass', [-w / 2 + 0.03, w / 2 - 0.03], [0.44, 0.47], [zs, zs + 0.002], NP),
      ...barPull('steel', [0, 0.525, zs], w * 0.55, { stand: 0.02 }),
      // Oven: control panel over a glazed door with a long bar handle.
      span('glass', XI, [1.08, 1.1585], [zf, zs], { bevel: 0.003, plan: false }),
      span('steel', [-0.05, 0.05], [1.105, 1.135], [zs, zs + 0.002], NP),
      span('steel', XI, [0.5615, 1.0785], [zf, zs], { bevel: 0.004, plan: false }),
      span('glass', [-w / 2 + 0.06, w / 2 - 0.06], [0.62, 0.99], [zs, zs + 0.002], NP),
      ...frame4('steel', [-w / 2 + 0.055, w / 2 - 0.055], [0.615, 0.995], [zs, zs + 0.004], 0.008),
      ...barPull('steel', [0, 1.04, zs], w * 0.72, { stand: 0.02 }),
      // Microwave: black glass fascia, framed door window, keypad and display.
      span('glass', XI, [1.1615, 1.5585], [zf, zs], { bevel: 0.003, plan: false }),
    ];
    for (const x of [-w / 2 + 0.07, w / 2 - 0.07]) {
      parts.push(discZ('steel', [x, 1.12, zs + 0.01], 0.018, 0.02, NP));
      parts.push(span('glass', [x - 0.002, x + 0.002], [1.125, 1.136], [zs + 0.02, zs + 0.022], NP));
    }
    const doorR = -w / 2 + (w - 0.03) * 0.72;
    parts.push(...frame4('steel', [-w / 2 + 0.03, doorR], [1.19, 1.53], [zs, zs + 0.004], 0.014));
    parts.push(...barPull('steel', [doorR - 0.022, 1.36, zs + 0.004], 0.24, { vertical: true, stand: 0.016, r: 0.005 }));
    const kx: V2 = [doorR + 0.02, w / 2 - 0.025];
    parts.push(span('steel', kx, [1.47, 1.51], [zs, zs + 0.002], NP));
    for (const y of [1.42, 1.38, 1.34]) {
      for (const x of cells(3, kx[0], kx[1])) parts.push(span('steel', [x - 0.009, x + 0.009], [y - 0.008, y + 0.008], [zs, zs + 0.003], { bevel: 0.002, plan: false }));
    }
    // Top storage door(s).
    parts.push(...doors('shaker', 'front', 'handle', X, [1.56, h - cr], zf, 'bottom'));
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w / 2, faceZ(d)], [w / 2, faceZ(d)])],
});

// ---------------------------------------------------------------------------
// Storage units
// ---------------------------------------------------------------------------

const pantryPullout = defineItem({
  id: 'pantry-pullout',
  name: 'Pull-out pantry cabinet',
  category: 'kitchen',
  type: 'storage',
  group: 'Kitchen cabinets',
  tags: ['pantry', 'pull-out', 'larder', 'tall unit', 'jars', 'baskets', 'narrow'],
  // Depth beyond 0.6 m shows how far the pull-out is drawn out (0.6 = closed).
  defaultSize: { w: 0.3, d: 0.85, h: 2.1 },
  minSize: { w: 0.2, d: 0.5, h: 1.6 },
  maxSize: { w: 0.45, d: 1.1, h: 2.4 },
  wallSnap: true,
  slots: [FRONT, matSlot('frame', 'Pull-out frame, lids & pull', 'metal-chrome'), matSlot('jars', 'Glass jars', 'glass-clear'), matSlot('goods', 'Dry goods', 'dry-goods')],
  build: ({ w, d, h }) => {
    const cD = Math.min(d, 0.6);
    const ext = Math.max(0, d - 0.6);
    const zb = -d / 2;
    const zFace0 = zb + cD - FRONT_T - PULL_D;
    const zF = zFace0 + ext;
    const t = 0.018;
    const xi: V2 = [-w / 2 + t, w / 2 - t];
    const parts: Part[] = [
      span('front', [-w / 2 + 0.004, w / 2 - 0.004], [0, PLINTH], [zb, zFace0 - 0.05], NP),
      span('front', [-w / 2, -w / 2 + t], [PLINTH, h], [zb, zFace0]),
      span('front', [w / 2 - t, w / 2], [PLINTH, h], [zb, zFace0]),
      span('front', xi, [h - t, h], [zb, zFace0], NP),
      span('front', xi, [PLINTH, PLINTH + t], [zb, zFace0], NP),
      span('front', xi, [PLINTH + t, h - t], [zb, zb + 0.008], NP),
      ...shakerFront('front', [-w / 2, w / 2], [PLINTH, h], zF, FRONT_T, { rail: clamp(w * 0.2, 0.04, 0.065) }),
      ...barPull('frame', [0, h * 0.62, zF + FRONT_T], 0.3, { vertical: true, stand: 0.02 }),
    ];
    // Pull-out frame: rear post, top rail and wire baskets of jars.
    const L = Math.min(0.5, cD - 0.08);
    const bz: V2 = [zF - L + 0.02, zF - 0.002];
    const bx: V2 = [xi[0] + 0.012, xi[1] - 0.012];
    const y0 = PLINTH + t + 0.03;
    const y1 = h - t - 0.05;
    parts.push(span('frame', [-0.012, 0.012], [y0 - 0.02, y1 + 0.02], [zF - L, zF - L + 0.02], NP));
    parts.push(rodZ('frame', 0, y1 + 0.01, zF - L + 0.02, zF, 0.008, NP));
    const n = clamp(Math.round((y1 - y0) / 0.34), 3, 6);
    const pitch = (y1 - y0) / n;
    const nj = clamp(Math.floor((bz[1] - bz[0]) / 0.1), 2, 5);
    const jr = Math.min(0.042, (bx[1] - bx[0]) / 2 - 0.006, (bz[1] - bz[0]) / nj / 2 - 0.006);
    const rand = rng(7);
    for (let i = 0; i < n; i++) {
      const yb = y0 + i * pitch;
      parts.push(span('frame', bx, [yb, yb + 0.004], bz, NP));
      parts.push(rodZ('frame', bx[0], yb + 0.07, bz[0], bz[1], 0.003, NP), rodZ('frame', bx[1], yb + 0.07, bz[0], bz[1], 0.003, NP));
      parts.push(rodX('frame', bx[0], bx[1], yb + 0.07, bz[0] + 0.003, 0.003, NP));
      for (const z of cells(nj, bz[0], bz[1])) {
        const jh = Math.min(pitch - 0.06, 0.09 + rand() * 0.09);
        parts.push(...jar('jars', 'goods', 'frame', 0, yb + 0.004, z, jr, jh, 0.45 + rand() * 0.45));
      }
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const cD = Math.min(d, 0.6);
    const z = -d / 2 + cD - FRONT_T - PULL_D;
    return [line([-w / 2, z], [w / 2, z])];
  },
});

const applianceGarage = defineItem({
  id: 'appliance-garage',
  name: 'Appliance garage',
  category: 'kitchen',
  type: 'storage',
  group: 'Kitchen cabinets',
  tags: ['appliance garage', 'tambour', 'roller door', 'countertop', 'toaster', 'worktop cabinet'],
  defaultSize: { w: 0.6, d: 0.38, h: 0.45 },
  minSize: { w: 0.45, d: 0.3, h: 0.35 },
  maxSize: { w: 1.0, d: 0.5, h: 0.6 },
  defaultElevation: 0.9,
  wallSnap: true,
  slots: [
    FRONT,
    matSlot('door', 'Roller door & bread', 'wood-oak-natural'),
    matSlot('appliance', 'Toaster & canister', 'stainless'),
    matSlot('detail', 'Handle & toaster trim', 'metal-black-matte'),
  ],
  build: ({ w, d, h }) => {
    const t = 0.018;
    const zb = -d / 2;
    const xi: V2 = [-w / 2 + t, w / 2 - t];
    const zd: V2 = [d / 2 - 0.03, d / 2 - 0.012];
    const yOpen = t + (h - 2 * t) * 0.55;
    const parts: Part[] = [
      span('front', [-w / 2, -w / 2 + t], [0, h - t], [zb, d / 2], { bevel: 0.003 }),
      span('front', [w / 2 - t, w / 2], [0, h - t], [zb, d / 2], { bevel: 0.003 }),
      span('front', [-w / 2, w / 2], [h - t, h], [zb, d / 2], { bevel: 0.004 }),
      span('front', xi, [0, t], [zb, d / 2], NP),
      span('front', xi, [t, h - t], [zb, zb + 0.008], NP),
      // Tambour (roller) door, rolled two-fifths of the way up, with a lip pull.
      ...slats('door', xi, [yOpen, h - t], zd, Math.max(3, Math.round((h - t - yOpen) / 0.024)), { axis: 'y', gap: 0.08, bevel: 0.003, plan: false }),
      span('detail', [-w * 0.18, w * 0.18], [yOpen + 0.004, yOpen + 0.016], [zd[1], zd[1] + 0.01], { bevel: 0.003, plan: false }),
    ];
    // Toaster with a slice of bread popping up.
    const iz: V2 = [zb + 0.012, zd[0] - 0.008];
    const zc = (iz[0] + iz[1]) / 2;
    const tw = Math.min(0.28, (xi[1] - xi[0]) * 0.55);
    const td = Math.min(0.17, iz[1] - iz[0] - 0.02);
    const th = Math.min(0.19, h - 2 * t - 0.08);
    const tx = xi[0] + 0.03 + tw / 2;
    const ty0 = t + 0.01;
    const ty1 = ty0 + th;
    parts.push(span('appliance', [tx - tw / 2, tx + tw / 2], [ty0, ty1], [zc - td / 2, zc + td / 2], { bevel: 0.025, plan: false }));
    for (const fx of [tx - tw / 2 + 0.03, tx + tw / 2 - 0.03]) parts.push(span('detail', [fx - 0.012, fx + 0.012], [t, ty0], [zc - td / 2 + 0.02, zc + td / 2 - 0.02], NP));
    for (const sz of [zc - td * 0.2, zc + td * 0.2]) parts.push(span('detail', [tx - tw * 0.36, tx + tw * 0.36], [ty1 - 0.002, ty1 + 0.001], [sz - 0.011, sz + 0.011], NP));
    parts.push(span('door', [tx - tw * 0.3, tx + tw * 0.3], [ty1 - 0.05, ty1 + 0.035], [zc - td * 0.2 - 0.007, zc - td * 0.2 + 0.007], { bevel: 0.006, plan: false }));
    parts.push(span('detail', [tx + tw * 0.28, tx + tw * 0.4], [ty0 + th * 0.55, ty0 + th * 0.62], [zc + td / 2, zc + td / 2 + 0.012], NP));
    parts.push(discZ('detail', [tx - tw * 0.3, ty0 + th * 0.35, zc + td / 2 + 0.005], 0.012, 0.01, NP));
    // Canister beside it when there's room, and a chopping board against the back.
    const free: V2 = [tx + tw / 2 + 0.02, xi[1] - 0.01];
    if (free[1] - free[0] > 0.12) {
      const cr = Math.min(0.055, (free[1] - free[0]) / 2 - 0.005, (iz[1] - iz[0]) / 2 - 0.01);
      const ch = Math.min(0.2, h - 2 * t - 0.05);
      const cx = (free[0] + free[1]) / 2;
      parts.push(cyl('appliance', [cx, t + ch / 2, zc + 0.01], cr, ch, { segments: 24, plan: false }));
      parts.push(cyl('detail', [cx, t + ch + 0.008, zc + 0.01], cr * 1.02, 0.016, { segments: 24, plan: false }));
      parts.push(sphere('detail', [cx, t + ch + 0.02, zc + 0.01], 0.01, NP));
    }
    const bh = Math.min(0.3, h - 2 * t - 0.03);
    parts.push(box3('door', [(xi[0] + xi[1]) / 2 + 0.05, t + bh / 2, zb + 0.03], [Math.min(0.24, (xi[1] - xi[0]) * 0.5), bh, 0.014], 0.12));
    return parts;
  },
});

/** Box leaning back by `lean` radians (e.g. a chopping board against a wall). */
function box3(slot: string, c: V3, s: V3, lean: number): Part {
  return { ...span(slot, [c[0] - s[0] / 2, c[0] + s[0] / 2], [c[1] - s[1] / 2, c[1] + s[1] / 2], [c[2] - s[2] / 2, c[2] + s[2] / 2], { bevel: 0.003, plan: false }), rotation: [-lean, 0, 0] };
}

// ---------------------------------------------------------------------------
// Island, cart and nook table
// ---------------------------------------------------------------------------

const islandBar = defineItem({
  id: 'island-breakfast',
  name: 'Kitchen island with breakfast bar',
  category: 'kitchen',
  type: 'surfaces',
  group: 'Counters & cabinets',
  tags: ['island', 'breakfast bar', 'overhang', 'seating', 'turned legs', 'beadboard', 'cookbooks', 'counter'],
  defaultSize: { w: 2.0, d: 1.0, h: 0.9 },
  minSize: { w: 1.2, d: 0.85, h: 0.85 },
  maxSize: { w: 3.0, d: 1.3, h: 1.05 },
  slots: [
    matSlot('worktop', 'Worktop', 'quartz-white'),
    matSlot('front', 'Cabinetry & legs', 'lacquer-navy'),
    BRASS,
    matSlot('books', 'Cookbooks', 'book-mix'),
  ],
  build: ({ w, d, h }) => {
    const yTop = h - TOP_T;
    const bodyD = clamp(d - 0.3, 0.45, 0.62);
    const zCook = -d / 2 + FRONT_T + PULL_D;
    const zSeat = -d / 2 + bodyD;
    const bx: V2 = [-w / 2 + 0.04, w / 2 - 0.04];
    const lx = w / 2 - 0.06;
    const lz = d / 2 - 0.06;
    const n = clamp(Math.round((bx[1] - bx[0]) / 0.7), 1, 4);
    const cols = cellSpans(n, bx[0], bx[1]);
    const bay = n >= 3 ? cols[n - 1] : null;
    const solid: V2 = bay ? [bx[0], bay[0]] : bx;
    const parts: Part[] = [
      span('worktop', [-w / 2, w / 2], [yTop, h], [-d / 2, d / 2], { bevel: 0.01 }),
      span('front', solid, [PLINTH, yTop], [zCook, zSeat]),
      span('front', [bx[0] + 0.03, bx[1] - 0.03], [0, PLINTH], [zCook + 0.05, zSeat - 0.03], NP),
      // Beadboard and a base rail on the seating side.
      ...slats('front', bx, [PLINTH + 0.06, yTop], [zSeat, zSeat + 0.012], Math.round((bx[1] - bx[0]) / 0.1), { axis: 'x', gap: 0.1, plan: false }),
      span('front', bx, [PLINTH, PLINTH + 0.06], [zSeat, zSeat + 0.018], NP),
      // Turned legs carrying the overhang, aprons and a brass footrest.
      span('front', [-lx + 0.04, lx - 0.04], [yTop - 0.09, yTop], [lz - 0.012, lz + 0.012], NP),
      rodX('handle', -lx + 0.03, lx - 0.03, 0.24, lz, 0.011, NP),
    ];
    for (const s of [-1, 1]) {
      parts.push(turnedLeg('front', s * lx, lz, 0, yTop - 0.1, 0.045, { style: 'spindle', plan: true }));
      parts.push(span('front', [s * lx - 0.04, s * lx + 0.04], [yTop - 0.1, yTop], [lz - 0.04, lz + 0.04], NP));
      parts.push(span('front', [s * lx - 0.012, s * lx + 0.012], [yTop - 0.09, yTop], [zSeat, lz - 0.04], NP));
    }
    // Shaker end panels.
    const end = swapXZ(shakerFront('front', [-d / 2 + PULL_D, zSeat], [0, yTop], bx[1], 0.015, { rail: 0.07 }));
    parts.push(...end, ...mirrorX(end));
    // Cook side (-z): drawers and doors built facing +z, then mirrored.
    const zf = faceZ(d);
    const fr: Part[] = [];
    cols.forEach((x, i) => {
      if (bay && i === n - 1) return;
      const top = 0.15;
      if (i % 2 === 0) {
        const mid = (yTop - PLINTH - top) * 0.45;
        for (const y of [
          [yTop - top, yTop],
          [yTop - top - mid, yTop - top],
          [PLINTH, yTop - top - mid],
        ] as V2[]) fr.push(...panel('shaker', 'front', x, y, zf), ...drawerPulls('cup', 'handle', x, y, zf + FRONT_T));
      } else {
        fr.push(...panel('shaker', 'front', x, [yTop - top, yTop], zf), ...drawerPulls('cup', 'handle', x, [yTop - top, yTop], zf + FRONT_T));
        fr.push(...doors('shaker', 'front', 'handle', x, [PLINTH, yTop - top], zf, 'top', 'knob'));
      }
    });
    if (bay) {
      // Open bay of cookbooks at the end of the cook side.
      const back = zf - 0.3;
      fr.push(span('front', bay, [PLINTH, yTop], [-zSeat, back], NP));
      fr.push(span('front', [bay[0], bay[0] + 0.018], [PLINTH, yTop], [back, d / 2 - PULL_D]));
      const sx: V2 = [bay[0] + 0.018, bay[1]];
      const shelfYs = [PLINTH, PLINTH + (yTop - PLINTH) / 2];
      for (const [k, y] of shelfYs.entries()) {
        fr.push(span('front', sx, [y, y + 0.02], [back, d / 2 - PULL_D], NP));
        const room = (k === 0 ? shelfYs[1] : yTop) - y - 0.035;
        fr.push(...bookRow('books', [sx[0] + 0.01, sx[1] - 0.01], y + 0.02, back, Math.min(0.28, room), Math.min(0.22, d / 2 - PULL_D - back - 0.02), 11 + k * 5, { fill: 0.8, lean: true, minW: 0.028, maxW: 0.055 }));
      }
    }
    parts.push(...mirrorZ(fr));
    return parts;
  },
  planDetail: ({ w, d }) => {
    const zSeat = -d / 2 + clamp(d - 0.3, 0.45, 0.62);
    return [line([-w / 2 + 0.04, zSeat], [w / 2 - 0.04, zSeat]), line([-w / 2 + 0.04, -d / 2 + 0.045], [w / 2 - 0.04, -d / 2 + 0.045])];
  },
});

const butcherCart = defineItem({
  id: 'butcher-block-cart',
  name: 'Butcher block cart',
  category: 'kitchen',
  type: 'surfaces',
  group: 'Counters & cabinets',
  tags: ['butcher block', 'cart', 'trolley', 'end grain', 'chopping', 'casters', 'baskets', 'prep station'],
  defaultSize: { w: 0.7, d: 0.45, h: 0.9 },
  minSize: { w: 0.5, d: 0.35, h: 0.8 },
  maxSize: { w: 1.2, d: 0.7, h: 0.95 },
  slots: [
    matSlot('block', 'Butcher block top', 'butcher-block'),
    matSlot('frame', 'Frame & shelf', 'stainless'),
    matSlot('basket', 'Baskets', 'rattan-natural'),
    matSlot('metal', 'Casters, pull & towel bar', 'metal-black-matte'),
  ],
  build: ({ w, d, h }) => {
    const topT = 0.065;
    const yT = h - topT;
    const casterH = 0.075;
    const lx = w / 2 - 0.07;
    const lz = d / 2 - 0.045;
    const lt = 0.035;
    const shelfY = 0.16;
    const parts: Part[] = [
      span('block', [-w / 2, w / 2], [yT, h], [-d / 2, d / 2], { bevel: 0.008 }),
      span('frame', [-lx, lx], [shelfY, shelfY + 0.015], [-lz, lz], { bevel: 0.002, plan: false }),
      // Aprons with a drawer at the front.
      span('frame', [-lx, lx], [yT - 0.12, yT], [lz - lt / 2, lz + lt / 2 - 0.01], NP),
      span('frame', [-lx, lx], [yT - 0.12, yT], [-lz - lt / 2, -lz + lt / 2], NP),
      span('frame', [-lx - lt / 2, -lx + lt / 2], [yT - 0.12, yT], [-lz, lz], NP),
      span('frame', [lx - lt / 2, lx + lt / 2], [yT - 0.12, yT], [-lz, lz], NP),
      span('frame', [-lx * 0.7, lx * 0.7], [yT - 0.112, yT - 0.008], [lz + lt / 2 - 0.01, lz + lt / 2 + 0.006], { bevel: 0.002, plan: false }),
      ...cupPull('metal', [0, yT - 0.05, lz + lt / 2 + 0.006], 0.08),
      // Towel bar under the left overhang.
      rodZ('metal', -w / 2 + 0.022, yT - 0.06, -d / 2 + 0.07, d / 2 - 0.07, 0.007, NP),
    ];
    for (const z of [-d / 2 + 0.07, d / 2 - 0.07]) parts.push(rodX('metal', -lx - lt / 2, -w / 2 + 0.022, yT - 0.06, z, 0.005, NP));
    for (const x of [-lx, lx]) {
      for (const z of [-lz, lz]) {
        parts.push(span('frame', [x - lt / 2, x + lt / 2], [casterH, yT], [z - lt / 2, z + lt / 2], { bevel: 0.004 }));
        parts.push(span('metal', [x - 0.02, x + 0.02], [0.05, casterH], [z - 0.022, z + 0.022], { bevel: 0.004, plan: false }));
        parts.push(cyl('metal', [x, 0.03, z], 0.03, 0.022, { rotation: [0, 0, Math.PI / 2], segments: 18, plan: false }));
      }
    }
    // Woven baskets on the bottom shelf.
    const nb = w > 0.9 ? 3 : 2;
    const bh = Math.min(0.2, yT - 0.12 - shelfY - 0.08);
    for (const [a, b] of cellSpans(nb, -lx + lt / 2 + 0.01, lx - lt / 2 - 0.01)) {
      const bz: V2 = [-lz + lt / 2 + 0.01, lz - lt / 2 - 0.01];
      parts.push(span('basket', [a + 0.012, b - 0.012], [shelfY + 0.015, shelfY + 0.015 + bh], bz, { bevel: 0.02, plan: false }));
      parts.push(span('basket', [a + 0.006, b - 0.006], [shelfY + 0.015 + bh - 0.022, shelfY + 0.015 + bh], [bz[0] - 0.006, bz[1] + 0.006], { bevel: 0.009, plan: false }));
    }
    return parts;
  },
  planDetail: ({ w, d }) => [rectPoly(-w / 2 + 0.05, -d / 2 + 0.03, w / 2 - 0.05, d / 2 - 0.03)],
});

const nookTable = defineItem({
  id: 'breakfast-nook-table',
  name: 'Breakfast nook table',
  category: 'dining',
  type: 'surfaces',
  group: 'Dining tables',
  tags: ['breakfast', 'nook', 'pedestal', 'round table', 'bistro', 'kitchen table', 'oval'],
  defaultSize: { w: 0.9, d: 0.9, h: 0.75 },
  minSize: { w: 0.6, d: 0.6, h: 0.7 },
  maxSize: { w: 1.4, d: 1.2, h: 0.78 },
  slots: [
    matSlot('top', 'Table top', 'wood-oak-natural'),
    matSlot('base', 'Pedestal', 'lacquer-sage'),
    matSlot('caps', 'Foot caps', 'antique-brass'),
  ],
  build: ({ w, d, h }) => {
    const R = w / 2;
    const sz = d / w;
    const tt = 0.032;
    const m = Math.min(w, d) / 2;
    const colTop = h - tt - 0.02;
    const H = colTop - 0.07;
    const parts: Part[] = [
      cyl('top', [0, h - tt / 2, 0], R - 0.012, tt, { rTop: R, segments: 48, scale: [1, 1, sz] }),
      cyl('top', [0, h - tt - 0.025, 0], R * 0.8, 0.05, { segments: 40, scale: [1, 1, sz], plan: false }),
      cyl('base', [0, colTop + 0.01, 0], 0.13, 0.02, { segments: 24, plan: false }),
      lathe('base', [0, 0.07, 0], [
        [0, 0],
        [0.095, 0],
        [0.1, 0.02],
        [0.065, 0.06],
        [0.048, H * 0.22],
        [0.072, H * 0.36],
        [0.052, H * 0.48],
        [0.042, H * 0.75],
        [0.062, H * 0.9],
        [0.08, H],
        [0, H],
      ], { segments: 24, plan: false }),
    ];
    // Four splayed feet on brass caps.
    const rf = ((m - 0.05) / Math.SQRT1_2) * 0.85;
    for (const k of range(4)) {
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      parts.push(box3Y('base', [(c * rf) / 2, 0.05, (s * rf) / 2], [rf, 0.055, 0.065], a));
      parts.push(cyl('caps', [c * (rf - 0.035), 0.012, s * (rf - 0.035)], 0.024, 0.024, { segments: 16, plan: false }));
    }
    return parts;
  },
});

/** Box turned `a` radians about the vertical axis so its length (x) points along (cos a, sin a). */
function box3Y(slot: string, c: V3, s: V3, a: number): Part {
  return { ...span(slot, [c[0] - s[0] / 2, c[0] + s[0] / 2], [c[1] - s[1] / 2, c[1] + s[1] / 2], [c[2] - s[2] / 2, c[2] + s[2] / 2], { bevel: 0.012, plan: false }), rotation: [0, -a, 0] };
}

// ---------------------------------------------------------------------------
// Wall accessories
// ---------------------------------------------------------------------------

const plateRack = defineItem({
  id: 'plate-rack',
  name: 'Wall plate rack',
  category: 'kitchen',
  type: 'storage',
  group: 'Kitchen cabinets',
  tags: ['plate rack', 'dish rack', 'wall rack', 'plates', 'dowels', 'cups', 'country'],
  defaultSize: { w: 0.6, d: 0.27, h: 0.55 },
  minSize: { w: 0.35, d: 0.18, h: 0.35 },
  maxSize: { w: 1.2, d: 0.32, h: 0.8 },
  mount: 'wall',
  defaultElevation: 1.5,
  slots: [
    matSlot('wood', 'Rack', 'wood-oak-natural'),
    matSlot('plates', 'Plates', 'ceramic-white'),
    matSlot('accent', 'Accent crockery', 'ceramic-blue'),
  ],
  build: ({ w, d, h }) => {
    const t = 0.02;
    const zb = -d / 2;
    const ledge = 0.03;
    const xi: V2 = [-w / 2 + t, w / 2 - t];
    const pr = clamp(Math.min((d - 0.03) / 2, (h - t - ledge - 0.04) / 2), 0.06, 0.12);
    const yShelf = ledge + 2 * pr + 0.025;
    const hasShelf = h - t - yShelf >= 0.1;
    const zc = (zb + 0.012 + d / 2) / 2;
    const parts: Part[] = [
      span('wood', [-w / 2, -w / 2 + t], [0, h], [zb, d / 2], { bevel: 0.004 }),
      span('wood', [w / 2 - t, w / 2], [0, h], [zb, d / 2], { bevel: 0.004 }),
      span('wood', [-w / 2, w / 2], [h - t, h], [zb, d / 2], { bevel: 0.004, plan: false }),
      span('wood', xi, [0, 0.018], [zb, d / 2], NP),
      span('wood', xi, [0.018, ledge], [d / 2 - 0.012, d / 2], NP),
      span('wood', xi, [ledge + pr * 1.4, ledge + pr * 1.4 + 0.035], [zb, zb + 0.012], NP),
    ];
    const n = clamp(Math.floor((xi[1] - xi[0] - 0.02) / 0.045), 2, 22);
    const xs = spaced(n + 1, xi[0] + 0.01, xi[1] - 0.01);
    for (const x of xs) {
      parts.push(vcyl('wood', x, d / 2 - 0.012, ledge, ledge + pr * 0.9, 0.005, NP));
      parts.push(vcyl('wood', x, zb + 0.016, ledge, hasShelf ? yShelf : h - t, 0.005, NP));
    }
    for (let i = 0; i < n; i++) {
      const x = (xs[i] + xs[i + 1]) / 2;
      parts.push(cyl(i % 3 === 1 ? 'accent' : 'plates', [x, ledge + pr + 0.002, zc], pr, 0.012, { rotation: [0, 0, Math.PI / 2], segments: 32, plan: false }));
    }
    if (hasShelf) {
      parts.push(span('wood', xi, [yShelf, yShelf + 0.016], [zb, d / 2], NP));
      parts.push(rodX('wood', xi[0], xi[1], yShelf + 0.05, d / 2 - 0.01, 0.005, NP));
      const mh = Math.min(0.09, h - t - yShelf - 0.03);
      const nc = clamp(Math.floor((xi[1] - xi[0]) / 0.12), 1, 8);
      cells(nc, xi[0], xi[1]).forEach((x, i) => parts.push(...mug(i % 2 === 0 ? 'accent' : 'plates', x - 0.01, yShelf + 0.016, zc, 0.036, mh, 1)));
    }
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w / 2, -d / 2], [w / 2, d / 2]), line([-w / 2, d / 2], [w / 2, -d / 2])],
});

const spiceRack = defineItem({
  id: 'spice-rack',
  name: 'Spice rack',
  category: 'kitchen',
  type: 'storage',
  group: 'Kitchen cabinets',
  tags: ['spices', 'herbs', 'jars', 'wall rack', 'spice jars', 'cork lids'],
  defaultSize: { w: 0.45, d: 0.09, h: 0.42 },
  minSize: { w: 0.25, d: 0.07, h: 0.25 },
  maxSize: { w: 0.9, d: 0.14, h: 0.7 },
  mount: 'wall',
  defaultElevation: 1.0,
  slots: [
    matSlot('wood', 'Rack & cork lids', 'wood-oak-natural'),
    matSlot('glass', 'Jars', 'glass-clear'),
    matSlot('spice', 'Spices', 'spice-paprika'),
    matSlot('herbs', 'Herbs', 'dried-herbs'),
  ],
  build: ({ w, d, h }) => {
    const t = 0.012;
    const zb = -d / 2;
    const xi: V2 = [-w / 2 + t, w / 2 - t];
    const tiers = clamp(Math.round((h - 0.04) / 0.13), 2, 5);
    const pitch = (h - t) / tiers;
    const r = Math.min(0.022, (d - 0.03) / 2);
    const jh = Math.min(0.085, pitch - t - 0.03);
    const zc = zb + 0.008 + r + 0.003;
    const per = clamp(Math.min(Math.floor((xi[1] - xi[0] - 0.01) / (2 * r + 0.012)), Math.floor(36 / tiers)), 1, 14);
    const rand = rng(23);
    const parts: Part[] = [
      span('wood', [-w / 2, -w / 2 + t], [0, h], [zb, d / 2], { bevel: 0.003 }),
      span('wood', [w / 2 - t, w / 2], [0, h], [zb, d / 2], { bevel: 0.003 }),
      span('wood', xi, [0, h], [zb, zb + 0.008], NP),
      span('wood', [-w / 2, w / 2], [h - t, h], [zb, d / 2], { bevel: 0.003, plan: false }),
    ];
    for (let k = 0; k < tiers; k++) {
      const y = k * pitch;
      parts.push(span('wood', xi, [y, y + t], [zb, d / 2], NP));
      parts.push(rodX('wood', xi[0], xi[1], y + t + 0.035, d / 2 - 0.006, 0.004, NP));
      for (const x of cells(per, xi[0], xi[1])) {
        parts.push(...jar('glass', rand() < 0.55 ? 'spice' : 'herbs', 'wood', x, y + t, zc, r, jh, 0.5 + rand() * 0.4));
      }
    }
    return parts;
  },
});

const potRail = defineItem({
  id: 'pot-rail',
  name: 'Pot rail with utensils',
  category: 'kitchen',
  type: 'storage',
  group: 'Kitchen cabinets',
  tags: ['pot rail', 'hanging rail', 'pans', 'utensils', 'ladle', 'whisk', 'copper', 's-hooks'],
  defaultSize: { w: 0.9, d: 0.14, h: 0.5 },
  minSize: { w: 0.5, d: 0.12, h: 0.35 },
  maxSize: { w: 1.6, d: 0.2, h: 0.7 },
  mount: 'wall',
  defaultElevation: 1.0,
  slots: [
    matSlot('rail', 'Rail & hooks', 'metal-black-matte'),
    matSlot('pans', 'Copper pans', 'metal-copper'),
    matSlot('utensil', 'Steel utensils', 'stainless'),
    matSlot('wood', 'Wooden handles & spoons', 'wood-walnut'),
  ],
  build: ({ w, d, h }) => {
    const k = clamp((h - 0.06) / 0.44, 0.6, 1.2);
    const ry = h - 0.035;
    const rz = -d / 2 + 0.055;
    const zw = -d / 2;
    const parts: Part[] = [rodX('rail', -w / 2 + 0.02, w / 2 - 0.02, ry, rz, 0.008, NP)];
    for (const s of [-1, 1]) {
      const x = s * (w / 2 - 0.06);
      parts.push(discZ('rail', [x, ry, zw + 0.004], 0.022, 0.008));
      parts.push(rodZ('rail', x, ry, zw + 0.008, rz, 0.006, NP));
      parts.push(sphere('rail', [s * (w / 2 - 0.016), ry, rz], 0.012, NP));
    }
    type Kind = 'pan' | 'ladle' | 'whisk' | 'saucepan' | 'spatula' | 'spoon';
    const widths: Record<Kind, number> = { pan: 0.22, ladle: 0.08, whisk: 0.08, saucepan: 0.18, spatula: 0.085, spoon: 0.065 };
    const order: Kind[] = ['pan', 'ladle', 'whisk', 'saucepan', 'spatula', 'spoon'];
    let cursor = -w / 2 + 0.07;
    let idx = 0;
    for (let tries = 0; tries < 40; tries++) {
      const kind = order[idx % order.length];
      idx++;
      const iw = widths[kind] * k;
      if (cursor + iw > w / 2 - 0.07) {
        if (tries > order.length * 2) break;
        continue;
      }
      const x = cursor + iw / 2;
      cursor += iw;
      const yH = ry - 0.05;
      parts.push(torus('rail', [x, ry - 0.016, rz], 0.012, 0.0025, NP), torus('rail', [x, ry - 0.04, rz], 0.01, 0.0025, NP));
      if (kind === 'pan' || kind === 'saucepan') {
        const pr = (kind === 'pan' ? 0.095 : 0.075) * k;
        const pd = (kind === 'pan' ? 0.045 : 0.075) * k;
        const hl = (kind === 'pan' ? 0.16 : 0.13) * k;
        const pzc = zw + 0.004 + pd / 2;
        parts.push(rod('rail', [x, yH, rz], [x, yH - hl, pzc], 0.007, NP));
        parts.push(discZ('pans', [x, yH - hl - pr, pzc], pr, pd, { segments: 28, plan: false }));
        parts.push(discZ('utensil', [x, yH - hl - pr, pzc + pd / 2], pr * 0.88, 0.003, { segments: 28, plan: false }));
        parts.push(torus('pans', [x, yH - hl - pr, pzc + pd / 2], pr * 0.97, 0.004, NP));
      } else if (kind === 'ladle') {
        parts.push(rod('utensil', [x, yH, rz], [x, yH - 0.24 * k, rz], 0.0045, NP));
        parts.push(sphere('utensil', [x, yH - 0.265 * k, rz + 0.012], 0.034 * k, { scale: [1, 0.8, 0.9], plan: false }));
      } else if (kind === 'whisk') {
        parts.push(rod('wood', [x, yH, rz], [x, yH - 0.1 * k, rz], 0.008, NP));
        for (const j of range(3)) {
          parts.push(torus('utensil', [x, yH - 0.17 * k, rz], 0.033 * k, 0.0014, { scale: [1, 2, 1], rotation: [0, (j * Math.PI) / 3, 0], plan: false }));
        }
      } else if (kind === 'spatula') {
        parts.push(rod('wood', [x, yH, rz], [x, yH - 0.15 * k, rz], 0.007, NP));
        parts.push(rod('utensil', [x, yH - 0.15 * k, rz], [x, yH - 0.19 * k, rz], 0.004, NP));
        parts.push(span('utensil', [x - 0.034 * k, x + 0.034 * k], [yH - 0.29 * k, yH - 0.19 * k], [rz - 0.0015, rz + 0.0015], NP));
      } else {
        parts.push(rod('wood', [x, yH, rz], [x, yH - 0.2 * k, rz], 0.006, NP));
        parts.push(sphere('wood', [x, yH - 0.235 * k, rz], 0.026 * k, { scale: [1, 1.45, 0.4], plan: false }));
      }
    }
    return parts;
  },
});

/** Knife blade outlines as [u, v]: u across the blade (0 = spine, 1 = edge), v down its length. */
interface KnifeKind {
  blade: V2[];
  len: number;
  wid: number;
  handle: number;
}

const KNIVES: KnifeKind[] = [
  // Chef's knife
  { blade: [[0, 0], [1, 0], [1, 0.5], [0.82, 0.78], [0.45, 0.94], [0.06, 1], [0, 0.92]], len: 0.2, wid: 0.045, handle: 0.12 },
  // Bread knife
  { blade: [[0, 0], [1, 0], [1, 0.94], [0.6, 1], [0, 0.97]], len: 0.21, wid: 0.028, handle: 0.12 },
  // Santoku
  { blade: [[0, 0], [1, 0], [1, 1], [0.6, 0.96], [0.22, 0.84], [0, 0.7]], len: 0.17, wid: 0.045, handle: 0.115 },
  // Paring knife
  { blade: [[0, 0], [1, 0], [0.92, 0.6], [0.45, 1], [0, 0.94]], len: 0.09, wid: 0.02, handle: 0.1 },
  // Cleaver
  { blade: [[0, 0], [1, 0], [1, 1], [0, 1]], len: 0.17, wid: 0.075, handle: 0.11 },
  // Utility knife
  { blade: [[0, 0], [1, 0], [1, 0.62], [0.6, 0.9], [0.1, 1], [0, 0.95]], len: 0.13, wid: 0.026, handle: 0.105 },
];

const knifeStrip = defineItem({
  id: 'knife-strip',
  name: 'Magnetic knife strip',
  category: 'kitchen',
  type: 'storage',
  group: 'Kitchen cabinets',
  tags: ['knives', 'magnetic', 'knife rack', 'chef knife', 'cleaver', 'santoku', 'wall strip'],
  defaultSize: { w: 0.45, d: 0.045, h: 0.36 },
  minSize: { w: 0.3, d: 0.04, h: 0.3 },
  maxSize: { w: 0.8, d: 0.06, h: 0.45 },
  mount: 'wall',
  defaultElevation: 1.12,
  slots: [
    matSlot('strip', 'Strip', 'wood-walnut'),
    matSlot('blade', 'Blades', 'stainless'),
    matSlot('handle', 'Knife handles', 'wood-ebony'),
    matSlot('rivet', 'Rivets & screws', 'metal-chrome'),
  ],
  build: ({ w, d, h }) => {
    const k = h / 0.36;
    const ys = h * 0.55;
    const zw = -d / 2;
    const zs = zw + 0.02;
    const parts: Part[] = [span('strip', [-w / 2, w / 2], [ys - 0.024, ys + 0.024], [zw, zs], { bevel: 0.005 })];
    for (const s of [-1, 1]) parts.push(discZ('rivet', [s * (w / 2 - 0.025), ys, zs], 0.005, 0.002, NP));
    const n = clamp(Math.floor((w - 0.04) / 0.07), 2, 9);
    const order = [0, 2, 4, 1, 5, 3, 0, 1, 2];
    const slotW = (w - 0.04) / n;
    cells(n, -w / 2 + 0.02, w / 2 - 0.02).forEach((cx, i) => {
      const kn = KNIVES[order[i % order.length]];
      const bw = Math.min(kn.wid, slotW - 0.012);
      const len = kn.len * k;
      const hl = kn.handle * k;
      const yb = ys + 0.03 * k;
      const hw = Math.min(0.024, bw * 0.55 + 0.008);
      const hx = cx + bw / 2 - hw / 2;
      parts.push(facePlate('blade', kn.blade.map(([u, v]) => [cx + bw * (0.5 - u), yb - v * len] as V2), zs + 0.001, 0.002));
      parts.push(span('blade', [hx - hw / 2, hx + hw / 2], [yb, yb + 0.012 * k], [zs + 0.001, zs + 0.017], { bevel: 0.003, plan: false }));
      parts.push(span('handle', [hx - hw / 2, hx + hw / 2], [yb + 0.012 * k, yb + 0.012 * k + hl], [zs + 0.003, zs + 0.019], { bevel: 0.006, plan: false }));
      for (const f of [0.3, 0.72]) parts.push(discZ('rivet', [hx, yb + 0.012 * k + hl * f, zs + 0.019], 0.003, 0.002, NP));
    });
    return parts;
  },
});

// ---------------------------------------------------------------------------
// Countertop and freestanding storage
// ---------------------------------------------------------------------------

const dishRack = defineItem({
  id: 'dish-drying-rack',
  name: 'Dish drying rack',
  category: 'kitchen',
  type: 'storage',
  group: 'Kitchen cabinets',
  tags: ['dish rack', 'drainer', 'drying rack', 'plates', 'cutlery caddy', 'countertop', 'wire'],
  defaultSize: { w: 0.46, d: 0.34, h: 0.3 },
  minSize: { w: 0.32, d: 0.26, h: 0.22 },
  maxSize: { w: 0.7, d: 0.42, h: 0.36 },
  defaultElevation: 0.9,
  slots: [
    matSlot('wire', 'Wire rack & cutlery', 'metal-chrome'),
    matSlot('tray', 'Drip tray & caddy', 'plastic-white'),
    matSlot('dishes', 'Plates', 'ceramic-white'),
    matSlot('cups', 'Cups', 'ceramic-sage'),
  ],
  build: ({ w, d, h }) => {
    const trayH = 0.022;
    const y0 = trayH + 0.012;
    const yr = y0 + Math.min(0.11, h * 0.38);
    const bx: V2 = [-w / 2 + 0.015, w / 2 - 0.015];
    const bz: V2 = [-d / 2 + 0.015, d / 2 - 0.015];
    const r = 0.0028;
    const parts: Part[] = [span('tray', [-w / 2, w / 2], [0, trayH], [-d / 2, d / 2], { bevel: 0.008 })];
    for (const x of bx) {
      for (const z of bz) {
        parts.push(vcyl('wire', x, z, trayH, y0, 0.004, NP));
        parts.push(vcyl('wire', x, z, y0, yr, r, NP));
      }
    }
    for (const z of spaced(6, bz[0], bz[1])) parts.push(rodX('wire', bx[0], bx[1], y0, z, r, NP));
    for (const x of bx) parts.push(rodZ('wire', x, y0, bz[0], bz[1], r, NP), rodZ('wire', x, yr, bz[0], bz[1], r, NP));
    for (const z of bz) {
      parts.push(rodX('wire', bx[0], bx[1], yr, z, r, NP));
      for (const x of spaced(clamp(Math.round((bx[1] - bx[0]) / 0.05), 3, 12), bx[0] + 0.03, bx[1] - 0.03)) parts.push(vcyl('wire', x, z, y0, yr, r * 0.8, NP));
    }
    // Plate tines and plates on edge on the left; cutlery caddy and cups on the right.
    const px: V2 = [bx[0] + 0.02, bx[0] + (bx[1] - bx[0]) * 0.62];
    const nPl = clamp(Math.floor((px[1] - px[0]) / 0.04), 2, 12);
    const tx = spaced(nPl + 1, px[0], px[1]);
    for (const x of tx) for (const z of [bz[0] + 0.04, bz[1] - 0.04]) parts.push(vcyl('wire', x, z, y0, y0 + 0.08, r, NP));
    const pr = Math.min(0.11, (bz[1] - bz[0]) / 2 - 0.01, (h - y0) / 2 - 0.008);
    const zc = (bz[0] + bz[1]) / 2;
    for (let i = 0; i < nPl; i++) {
      if (i % 3 === 2) continue;
      const x = (tx[i] + tx[i + 1]) / 2;
      parts.push(cyl('dishes', [x, y0 + pr + 0.003, zc], pr, 0.01, { rotation: [0, 0, Math.PI / 2 + (i % 2 === 0 ? 0.06 : -0.06)], segments: 32, plan: false }));
    }
    const cx: V2 = [px[1] + 0.02, bx[1] - 0.01];
    const cw = cx[1] - cx[0];
    if (cw > 0.06) {
      const cz: V2 = [bz[1] - 0.1, bz[1] - 0.01];
      const ch = Math.min(0.12, h - y0 - 0.07);
      const ct = 0.004;
      parts.push(
        span('tray', cx, [y0, y0 + ct], cz, NP),
        span('tray', [cx[0], cx[0] + ct], [y0, y0 + ch], cz, NP),
        span('tray', [cx[1] - ct, cx[1]], [y0, y0 + ch], cz, NP),
        span('tray', cx, [y0, y0 + ch], [cz[0], cz[0] + ct], NP),
        span('tray', cx, [y0, y0 + ch], [cz[1] - ct, cz[1]], NP),
      );
      const rand = rng(5);
      for (const j of range(5)) {
        const x = cx[0] + cw * (0.2 + 0.6 * rand());
        const z = cz[0] + 0.02 + 0.05 * rand();
        parts.push(rod('wire', [x, y0 + 0.01, z], [x + (rand() - 0.5) * 0.02, y0 + ch + 0.035 + j * 0.006, z + (rand() - 0.5) * 0.02], 0.0035, NP));
      }
      const mr = Math.min(0.036, cw / 2 - 0.012);
      const mh = Math.min(0.09, h - y0 - 0.01);
      parts.push(cyl('cups', [(cx[0] + cx[1]) / 2, y0 + mh / 2, bz[0] + 0.05], mr, mh, { rTop: mr * 0.88, segments: 20, plan: false }));
      parts.push(torus('cups', [(cx[0] + cx[1]) / 2 - mr - 0.012, y0 + mh * 0.48, bz[0] + 0.05], mh * 0.2, mh * 0.05, NP));
    }
    return parts;
  },
});

const pantryShelving = defineItem({
  id: 'pantry-shelving',
  name: 'Pantry shelving with jars',
  category: 'kitchen',
  type: 'storage',
  group: 'Kitchen cabinets',
  tags: ['pantry', 'larder', 'shelving', 'jars', 'crates', 'tins', 'bottles', 'open shelves'],
  defaultSize: { w: 0.9, d: 0.4, h: 1.9 },
  minSize: { w: 0.6, d: 0.3, h: 1.2 },
  maxSize: { w: 1.5, d: 0.6, h: 2.4 },
  wallSnap: true,
  slots: [
    matSlot('shelf', 'Shelves, crates & lids', 'wood-oak-natural'),
    matSlot('frame', 'Frame & tins', 'metal-black-matte'),
    matSlot('jars', 'Glass jars & bottles', 'glass-clear'),
    matSlot('goods', 'Dry goods & produce', 'dry-goods'),
  ],
  build: ({ w, d, h }) => {
    const pt = 0.03;
    const st = 0.028;
    const n = clamp(Math.round((h - 0.15) / 0.36), 3, 6);
    const yS = spaced(n + 1, 0.1, h - st);
    const xi: V2 = [-w / 2 + pt + 0.01, w / 2 - pt - 0.01];
    const zi: V2 = [-d / 2 + 0.02, d / 2 - 0.02];
    const iw = xi[1] - xi[0];
    const zc = (zi[0] + zi[1]) / 2;
    const parts: Part[] = [...legs4('frame', w, d, 0, 0, h, pt, { plan: true })];
    yS.forEach((y, i) => parts.push(span('shelf', [-w / 2 + 0.002, w / 2 - 0.002], [y, y + st], [-d / 2 + 0.002, d / 2 - 0.002], { bevel: 0.003, plan: i === 0 })));
    parts.push(rod('frame', [-w / 2 + pt, yS[1], -d / 2 + pt / 2], [w / 2 - pt, yS[n], -d / 2 + pt / 2], 0.004, NP));
    parts.push(rod('frame', [w / 2 - pt, yS[1], -d / 2 + pt / 2], [-w / 2 + pt, yS[n], -d / 2 + pt / 2], 0.004, NP));
    const budget = Math.floor((140 - parts.length) / n);
    const rand = rng(91);
    for (let k = 0; k < n; k++) {
      const y0 = yS[k] + st;
      const ch = yS[k + 1] - y0 - 0.015;
      if (k === 0) {
        // Wooden crates of produce.
        const count = Math.min(Math.max(1, Math.floor(iw / 0.36)), Math.floor(budget / 8));
        const cd = Math.min(0.36, zi[1] - zi[0]);
        const crh = Math.min(0.2, ch - 0.06);
        for (const [a, b] of cellSpans(count, xi[0], xi[1])) {
          const cx: V2 = [a + 0.015, b - 0.015];
          const cz: V2 = [zc - cd / 2, zc + cd / 2];
          const c = 0.012;
          parts.push(
            span('shelf', cx, [y0, y0 + crh], [cz[0], cz[0] + c], NP),
            span('shelf', cx, [y0, y0 + crh * 0.7], [cz[1] - c, cz[1]], NP),
            span('shelf', [cx[0], cx[0] + c], [y0, y0 + crh], cz, NP),
            span('shelf', [cx[1] - c, cx[1]], [y0, y0 + crh], cz, NP),
          );
          const pr = Math.min(cx[1] - cx[0], cd) * 0.32;
          parts.push(...blobCluster('goods', [(cx[0] + cx[1]) / 2, y0 + crh * 0.55, zc], Math.min(pr, crh * 0.6), 4, 17 + k));
        }
      } else if (k % 2 === 1) {
        // Big jars of dry goods.
        const jr = Math.min(0.06, (zi[1] - zi[0]) / 2 - 0.01);
        const count = Math.min(Math.floor(iw / (2 * jr + 0.025)), Math.floor(budget / 3));
        for (const x of cells(count, xi[0], xi[1])) {
          const jh = Math.min(ch - 0.02, 0.16 + rand() * 0.12);
          parts.push(...jar('jars', 'goods', 'shelf', x, y0, zc, jr, jh, 0.4 + rand() * 0.5));
        }
      } else {
        // Tins and oil bottles.
        const count = Math.min(Math.floor(iw / 0.11), Math.floor(budget / 2));
        cells(count, xi[0], xi[1]).forEach((x, i) => {
          if (i % 2 === 0) {
            const th = Math.min(ch - 0.03, 0.14 + rand() * 0.06);
            parts.push(cyl('frame', [x, y0 + th / 2, zc], 0.042, th, { segments: 20, plan: false }));
            parts.push(cyl('shelf', [x, y0 + th + 0.008, zc], 0.044, 0.016, { segments: 20, plan: false }));
          } else {
            const bh = Math.min(ch - 0.01, 0.26 + rand() * 0.05);
            const br = 0.032;
            parts.push(lathe('jars', [x, y0, zc], [
              [0, 0],
              [br, 0],
              [br, bh * 0.62],
              [br * 0.4, bh * 0.82],
              [br * 0.32, bh],
              [0, bh],
            ], { segments: 18, plan: false }));
            parts.push(cyl('goods', [x, y0 + bh * 0.28, zc], br - 0.004, bh * 0.5, { segments: 16, plan: false }));
          }
        });
      }
    }
    return parts;
  },
});

const recyclingBin = defineItem({
  id: 'kitchen-bin',
  name: 'Pull-out recycling bin unit',
  category: 'kitchen',
  type: 'storage',
  group: 'Kitchen cabinets',
  tags: ['bin', 'recycling', 'waste', 'pull-out', 'rubbish', 'trash', 'base unit', 'worktop'],
  // Depth beyond 0.6 m shows how far the bin drawer is pulled out (0.6 = closed).
  defaultSize: { w: 0.6, d: 0.9, h: 0.9 },
  minSize: { w: 0.4, d: 0.5, h: 0.8 },
  maxSize: { w: 0.9, d: 1.0, h: 1.0 },
  wallSnap: true,
  slots: [FRONT, WORKTOP, matSlot('bins', 'Bins', 'recycling-green'), matSlot('metal', 'Pulls, drawer sides & lids', 'stainless')],
  build: ({ w, d, h }) => {
    const cD = Math.min(d, 0.6);
    const ext = Math.max(0, d - 0.6);
    const zb = -d / 2;
    const zFace0 = zb + cD - FRONT_T - PULL_D;
    const zF = zFace0 + ext;
    const y1 = h - TOP_T;
    const topH = clamp((y1 - PLINTH) * 0.2, 0.12, 0.16);
    const t = 0.018;
    const X: V2 = [-w / 2, w / 2];
    const xi: V2 = [-w / 2 + t, w / 2 - t];
    const dy: V2 = [PLINTH, y1 - topH];
    const parts: Part[] = [
      span('front', [-w / 2 + 0.004, w / 2 - 0.004], [0, PLINTH], [zb, zFace0 - 0.05], NP),
      span('front', [-w / 2, -w / 2 + t], [PLINTH, y1], [zb, zFace0]),
      span('front', [w / 2 - t, w / 2], [PLINTH, y1], [zb, zFace0]),
      span('front', xi, [PLINTH, PLINTH + t], [zb, zFace0], NP),
      span('front', xi, [PLINTH + t, y1], [zb, zb + t], NP),
      span('front', xi, [y1 - topH, y1], [zb, zFace0], NP),
      ...worktop('worktop', X, [y1, h], [zb, zb + cD], 'bullnose'),
      ...panel('shaker', 'front', X, [y1 - topH, y1], zFace0),
      ...drawerPulls('bar', 'metal', X, [y1 - topH, y1], zFace0 + FRONT_T),
      ...panel('shaker', 'front', X, dy, zF),
      ...drawerPulls('bar', 'metal', X, [dy[1] - 0.13, dy[1]], zF + FRONT_T),
    ];
    // Drawer box with three lidded bins.
    const L = Math.min(0.5, cD - 0.07);
    const dx: V2 = [xi[0] + 0.008, xi[1] - 0.008];
    const yb = PLINTH + t + 0.01;
    parts.push(
      span('metal', [dx[0], dx[0] + 0.012], [yb, yb + 0.16], [zF - L, zF], NP),
      span('metal', [dx[1] - 0.012, dx[1]], [yb, yb + 0.16], [zF - L, zF], NP),
      span('metal', dx, [yb, yb + 0.008], [zF - L, zF], NP),
      span('metal', dx, [yb, yb + 0.16], [zF - L, zF - L + 0.012], NP),
    );
    const nb = w >= 0.55 ? 3 : 2;
    const bh = dy[1] - yb - 0.008 - 0.04;
    const bz: V2 = [zF - L + 0.022, zF - 0.012];
    for (const [a, b] of cellSpans(nb, dx[0] + 0.014, dx[1] - 0.014)) {
      const bx: V2 = [a + 0.005, b - 0.005];
      const cx = (a + b) / 2;
      const top = yb + 0.008 + bh;
      const s = Math.min(0.04, (b - a) * 0.25);
      const my = yb + 0.008 + bh * 0.6;
      parts.push(
        span('bins', bx, [yb + 0.008, top], bz, { bevel: 0.012, plan: false }),
        span('metal', [bx[0] - 0.003, bx[1] + 0.003], [top, top + 0.012], [bz[0] - 0.003, bz[1] + 0.003], { bevel: 0.004, plan: false }),
        span('metal', [cx - 0.03, cx + 0.03], [top + 0.012, top + 0.02], [bz[1] - 0.035, bz[1] - 0.015], { bevel: 0.002, plan: false }),
        facePlate('metal', [[cx - s, my - s * 0.6], [cx + s, my - s * 0.6], [cx, my + s * 0.85]], bz[1], 0.002),
      );
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const z = -d / 2 + Math.min(d, 0.6) - FRONT_T - PULL_D;
    return [line([-w / 2, z], [w / 2, z])];
  },
});

// ---------------------------------------------------------------------------
// Island extractor hood
// ---------------------------------------------------------------------------

const islandHood = defineItem({
  id: 'hood-island',
  name: 'Island extractor hood',
  category: 'kitchen',
  type: 'appliances',
  group: 'Cooking',
  tags: ['hood', 'extractor', 'island hood', 'cooker hood', 'chimney', 'ceiling', 'vent', 'stainless'],
  defaultSize: { w: 0.9, d: 0.6, h: 1.0 },
  minSize: { w: 0.6, d: 0.45, h: 0.6 },
  maxSize: { w: 1.2, d: 0.8, h: 1.3 },
  mount: 'ceiling',
  defaultElevation: 1.7,
  slots: [matSlot('body', 'Hood', 'stainless'), matSlot('filter', 'Filters & buttons', 'metal-anthracite'), matSlot('light', 'Hob lights', 'light-warm')],
  light: { color: '#ffe8c2', intensity: 0.9, distance: 2.2, y: 0.01 },
  build: ({ w, d, h }) => {
    const cb = Math.min(0.05, h * 0.08);
    const ct = Math.min(cb + 0.2, h * 0.35);
    const cw = Math.min(0.32, w * 0.36);
    const cd = Math.min(0.26, d * 0.5);
    const yMid = ct + (h - ct) * 0.5;
    const parts: Part[] = [
      span('body', [-w / 2, w / 2], [0.003, cb], [-d / 2, d / 2], { bevel: 0.004 }),
      sideProfile('body', [
        [cb, -d / 2 + 0.006],
        [cb, d / 2 - 0.006],
        [ct, cd / 2],
        [ct, -cd / 2],
      ], [-w / 2 + 0.006, w / 2 - 0.006]),
      span('body', [-cw / 2, cw / 2], [ct, yMid + 0.02], [-cd / 2, cd / 2]),
      span('body', [-cw / 2 - 0.006, cw / 2 + 0.006], [yMid, h - 0.01], [-cd / 2 - 0.006, cd / 2 + 0.006], NP),
      span('body', [-cw / 2 - 0.03, cw / 2 + 0.03], [h - 0.01, h], [-cd / 2 - 0.03, cd / 2 + 0.03], NP),
    ];
    // Baffle filters underneath, warm LED spots along the front, buttons on the front edge.
    const nf = w > 0.8 ? 3 : 2;
    for (const [a, b] of cellSpans(nf, -w / 2 + 0.04, w / 2 - 0.04)) {
      parts.push(...slats('filter', [a + 0.006, b - 0.006], [0, 0.005], [-d / 2 + 0.04, d / 2 - 0.1], 7, { axis: 'x', gap: 0.18, plan: false }));
    }
    for (const x of spaced(nf === 3 ? 4 : 2, -w * 0.36, w * 0.36)) parts.push(cyl('light', [x, 0.0025, d / 2 - 0.055], 0.022, 0.005, NP));
    for (const x of spaced(4, w / 2 - 0.2, w / 2 - 0.08)) parts.push(discZ('filter', [x, cb / 2 + 0.0015, d / 2 - 0.001], 0.006, 0.004, NP));
    return parts;
  },
  planDetail: ({ w, d }) => {
    const cw = Math.min(0.32, w * 0.36);
    const cd = Math.min(0.26, d * 0.5);
    return [rectPoly(-cw / 2, -cd / 2, cw / 2, cd / 2), line([-w / 2, -d / 2], [-cw / 2, -cd / 2]), line([w / 2, -d / 2], [cw / 2, -cd / 2]), line([-w / 2, d / 2], [-cw / 2, cd / 2]), line([w / 2, d / 2], [cw / 2, cd / 2])];
  },
});

// ---------------------------------------------------------------------------
// Procedural patterns
// ---------------------------------------------------------------------------

type Field = Float32Array;

/** Seamless value noise on an nx × ny lattice that wraps across the tile, in [-1, 1]. */
function tileNoise(size: number, nx: number, ny: number, rand: () => number): Field {
  const lat = new Float32Array(nx * ny);
  for (let i = 0; i < lat.length; i++) lat[i] = rand() * 2 - 1;
  const out = new Float32Array(size * size);
  const ease = (t: number) => t * t * (3 - 2 * t);
  const xi0 = new Int32Array(size);
  const xi1 = new Int32Array(size);
  const xt = new Float32Array(size);
  for (let x = 0; x < size; x++) {
    const fx = (x / size) * nx;
    const i0 = Math.floor(fx);
    xi0[x] = i0 % nx;
    xi1[x] = (i0 + 1) % nx;
    xt[x] = ease(fx - i0);
  }
  for (let y = 0; y < size; y++) {
    const fy = (y / size) * ny;
    const j0 = Math.floor(fy);
    const ty = ease(fy - j0);
    const r0 = (j0 % ny) * nx;
    const r1 = ((j0 + 1) % ny) * nx;
    for (let x = 0; x < size; x++) {
      const a = lat[r0 + xi0[x]] + (lat[r0 + xi1[x]] - lat[r0 + xi0[x]]) * xt[x];
      const b = lat[r1 + xi0[x]] + (lat[r1 + xi1[x]] - lat[r1 + xi0[x]]) * xt[x];
      out[y * size + x] = a + (b - a) * ty;
    }
  }
  return out;
}

/** Adds `dv` inside an anti-aliased disc of radius r at (cx, cy), wrapping around the tile edges. */
function stamp(f: Field, size: number, cx: number, cy: number, r: number, dv: number): void {
  const r0 = Math.ceil(r + 1);
  const bx = Math.floor(cx);
  const by = Math.floor(cy);
  for (let dy = -r0; dy <= r0; dy++) {
    for (let dx = -r0; dx <= r0; dx++) {
      const px = bx + dx;
      const py = by + dy;
      const c = clamp(r - Math.hypot(px + 0.5 - cx, py + 0.5 - cy) + 0.5, 0, 1);
      if (c <= 0) continue;
      f[(((py % size) + size) % size) * size + (((px % size) + size) % size)] += dv * c;
    }
  }
}

/** Writes a luminance field to the canvas. */
function paint(ctx: CanvasRenderingContext2D, size: number, f: Field): void {
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = Math.round(clamp(f[i], 0, 1) * 255);
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

export default definePack({
  name: 'Kitchen collection',
  version: '1.0.0',
  author: 'Neest team',
  description:
    'A big matching kitchen range: shaker, handleless and glazed units, farmhouse and double sinks, induction and five-burner gas hobs, an oven tower, pull-outs, an island with breakfast bar and plenty of wall accessories.',
  license: 'CC0 (made for Neest)',
  items: [
    baseDrawers,
    baseHandleless,
    glassWall,
    cornerWall,
    openCorner,
    farmhouseSink,
    doubleSink,
    inductionHob,
    gasHob,
    ovenTower,
    pantryPullout,
    applianceGarage,
    islandBar,
    butcherCart,
    plateRack,
    spiceRack,
    potRail,
    knifeStrip,
    dishRack,
    pantryShelving,
    recyclingBin,
    islandHood,
    nookTable,
  ],
  patterns: [
    {
      id: 'quartz-speckle',
      name: 'Quartz speckle',
      normalStrength: 0.15,
      // Engineered-stone look: soft clouding, dark mineral grains, grey aggregate and bright chips.
      draw(ctx, size, rand) {
        const f = new Float32Array(size * size).fill(0.86);
        const cloud = tileNoise(size, 4, 4, rand);
        const fine = tileNoise(size, 32, 32, rand);
        for (let i = 0; i < f.length; i++) f[i] += cloud[i] * 0.035 + fine[i] * 0.015;
        const s = size / 512;
        const n = Math.round(1500 * s * s);
        for (let k = 0; k < n; k++) {
          const x = rand() * size;
          const y = rand() * size;
          const kind = rand();
          if (kind < 0.62) stamp(f, size, x, y, (0.5 + rand() * 1.1) * s, -(0.25 + rand() * 0.35));
          else if (kind < 0.9) stamp(f, size, x, y, (1 + rand() * 2.2) * s, -(0.08 + rand() * 0.12));
          else stamp(f, size, x, y, (0.6 + rand() * 1.2) * s, 0.14);
        }
        paint(ctx, size, f);
      },
    },
    {
      id: 'end-grain',
      name: 'End-grain butcher block',
      normalStrength: 0.5,
      // Staggered end-grain blocks: each with its own tone and growth rings, dark glue lines between.
      draw(ctx, size, rand) {
        const cols = 4;
        const rows = 6;
        const bw = size / cols;
        const bh = size / rows;
        const blocks = Array.from({ length: cols * rows }, () => ({
          tone: 0.76 + rand() * 0.2,
          px: rand() * 2.4 - 0.7,
          py: rand() * 2.4 - 0.7,
          freq: 7 + rand() * 6,
          phase: rand() * Math.PI * 2,
        }));
        const pores = tileNoise(size, 128, 128, rand);
        const soft = tileNoise(size, 8, 8, rand);
        const f = new Float32Array(size * size);
        for (let y = 0; y < size; y++) {
          const row = Math.floor(y / bh);
          const shift = (row % 2) * (bw / 2);
          const v = (y - row * bh) / bh;
          for (let x = 0; x < size; x++) {
            const xs = (x + shift) % size;
            const col = Math.floor(xs / bw);
            const u = (xs - col * bw) / bw;
            const b = blocks[row * cols + col];
            const dr = Math.hypot((u - b.px) * bw, (v - b.py) * bh) / bw;
            const ringV = Math.pow(0.5 + 0.5 * Math.sin(dr * b.freq * Math.PI * 2 + b.phase), 5);
            const edge = Math.min(Math.min(u, 1 - u) * bw, Math.min(v, 1 - v) * bh);
            const i = y * size + x;
            let val = b.tone - ringV * 0.1 + pores[i] * 0.035 + soft[i] * 0.02;
            if (edge < 1.6) val -= 0.2 * (1 - edge / 1.6);
            f[i] = val;
          }
        }
        paint(ctx, size, f);
      },
    },
    {
      id: 'matte-lacquer',
      name: 'Matte lacquer',
      normalStrength: 0.12,
      // Very fine orange-peel texture and faint brush-out of a spray-lacquered panel.
      draw(ctx, size, rand) {
        const a = tileNoise(size, 48, 48, rand);
        const b = tileNoise(size, 6, 6, rand);
        const c = tileNoise(size, 128, 128, rand);
        const f = new Float32Array(size * size);
        for (let i = 0; i < f.length; i++) f[i] = 0.93 + a[i] * 0.018 + b[i] * 0.012 + c[i] * 0.008;
        paint(ctx, size, f);
      },
    },
    {
      id: 'brushed-stainless',
      name: 'Brushed stainless',
      normalStrength: 0.2,
      // Long horizontal brushing streaks with a few finer scratches.
      draw(ctx, size, rand) {
        const s1 = tileNoise(size, 2, Math.min(size, 192), rand);
        const s2 = tileNoise(size, 6, Math.min(size, 512), rand);
        const f = new Float32Array(size * size);
        for (let i = 0; i < f.length; i++) f[i] = 0.84 + s1[i] * 0.05 + s2[i] * 0.03;
        const scratches = Math.round(50 * (size / 512));
        for (let k = 0; k < scratches; k++) {
          const y0 = rand() * size;
          const x0 = rand() * size;
          const len = size * (0.2 + rand() * 0.5);
          const slope = (rand() - 0.5) * 0.01;
          const dv = rand() < 0.5 ? 0.06 : -0.05;
          for (let t = 0; t < len; t++) {
            const x = Math.floor(x0 + t) % size;
            const y = ((Math.floor(y0 + t * slope) % size) + size) % size;
            f[y * size + x] += dv;
          }
        }
        paint(ctx, size, f);
      },
    },
  ],
  materials: [
    { id: 'quartz-white', name: 'Speckled white quartz', category: 'stone', color: '#eeebe5', roughness: 0.22, pattern: { id: 'quartz-speckle', scale: 0.45 } },
    { id: 'quartz-concrete', name: 'Concrete grey quartz', category: 'stone', color: '#b5b1aa', roughness: 0.3, pattern: { id: 'quartz-speckle', scale: 0.5, contrast: 0.8 } },
    { id: 'granite-black', name: 'Black galaxy granite', category: 'stone', color: '#34353a', roughness: 0.18, pattern: { id: 'quartz-speckle', scale: 0.3 } },
    { id: 'butcher-block', name: 'Maple end-grain block', category: 'wood', color: '#c58e57', roughness: 0.62, pattern: { id: 'end-grain', scale: 0.32 } },
    { id: 'butcher-block-walnut', name: 'Walnut end-grain block', category: 'wood', color: '#7a5236', roughness: 0.6, pattern: { id: 'end-grain', scale: 0.32 } },
    { id: 'lacquer-sage', name: 'Sage matte lacquer', category: 'paint', color: '#8fa08a', roughness: 0.62, pattern: { id: 'matte-lacquer', scale: 0.6 } },
    { id: 'lacquer-navy', name: 'Navy matte lacquer', category: 'paint', color: '#2c3a52', roughness: 0.6, pattern: { id: 'matte-lacquer', scale: 0.6 } },
    { id: 'lacquer-warm-white', name: 'Warm white matte lacquer', category: 'paint', color: '#ece6da', roughness: 0.62, pattern: { id: 'matte-lacquer', scale: 0.6 } },
    { id: 'lacquer-charcoal', name: 'Charcoal matte lacquer', category: 'paint', color: '#3a3b3d', roughness: 0.58, pattern: { id: 'matte-lacquer', scale: 0.6 } },
    { id: 'lacquer-clay', name: 'Clay matte lacquer', category: 'paint', color: '#c4a189', roughness: 0.62, pattern: { id: 'matte-lacquer', scale: 0.6 } },
    { id: 'stainless', name: 'Brushed stainless steel', category: 'metal', color: '#c4c8cb', roughness: 0.32, metalness: 0.85, pattern: { id: 'brushed-stainless', scale: 0.35 } },
    { id: 'antique-brass', name: 'Antique brushed brass', category: 'metal', color: '#b08d4f', roughness: 0.36, metalness: 0.85, pattern: { id: 'brushed-stainless', scale: 0.2, contrast: 0.7 } },
    { id: 'fireclay', name: 'Glazed fireclay', category: 'solid', color: '#f4f2ec', roughness: 0.16 },
    { id: 'cast-iron', name: 'Enamelled cast iron', category: 'metal', color: '#1f2022', roughness: 0.5, metalness: 0.4 },
    { id: 'dry-goods', name: 'Pantry dry goods', category: 'solid', color: '#c99752', roughness: 0.9, pattern: { id: 'quartz-speckle', scale: 0.06 } },
    { id: 'spice-paprika', name: 'Ground paprika', category: 'solid', color: '#b24a26', roughness: 0.95, pattern: { id: 'quartz-speckle', scale: 0.04 } },
    { id: 'dried-herbs', name: 'Dried herbs', category: 'solid', color: '#6f7a3c', roughness: 0.95, pattern: { id: 'quartz-speckle', scale: 0.04 } },
    { id: 'recycling-green', name: 'Recycling bin green', category: 'solid', color: '#4d7f5a', roughness: 0.55 },
  ],
});

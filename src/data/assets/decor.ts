import type { AssetDefinition, Part, Size3 } from './types';
import { PLANT_SPECIES } from './plantSpecies';
import { GOLDEN, bladeLeaf, containParts, fitGroup, knotWidth, plantBox, polar, strapWidth, vadd, vmul } from './plantParts';
import {
  blobCluster,
  box,
  cells,
  circle,
  clamp,
  cushion as softBlock,
  cyl,
  defineAsset,
  discZ,
  ellipsePoints,
  frame4,
  lathe,
  lerp,
  line,
  matSlot,
  pillow,
  poly,
  pot,
  range,
  rectPoly,
  ring,
  rng,
  rod,
  rodPath,
  rodX,
  rodZ,
  span,
  sphere,
  torus,
  vcyl,
  arcPoints,
  type V2,
  type V3,
} from './parts';

/** Top of a ceiling-hung item (just under a 2.7 m ceiling). */
const CEILING_TOP = 2.69;

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

/** Box limits a leaf must stay inside: x ∈ [-hx, hx], y ∈ [0, y1], z ∈ [-hz, hz]. */
interface Lim {
  hx: number;
  hz: number;
  y1: number;
}

const limOf = ({ w, d, h }: Size3): Lim => ({ hx: w / 2, hz: d / 2, y1: h });

interface BladeFrame {
  /** Rotation matrix rows. */
  M: number[][];
  /** Equivalent three.js XYZ Euler angles. */
  rot: V3;
  /** Unit direction of the blade's length. */
  dir: V3;
}

/**
 * Orientation of a flat blade whose length points at azimuth `psi` (0 = +z, π/2 = +x) tilted
 * `theta` from vertical (θ > π/2 droops below horizontal). Unlike parts.leaf the blade's width
 * always stays horizontal, so leaves read as flat in every direction.
 */
function bladeFrame(psi: number, theta: number): BladeFrame {
  const C = Math.cos(psi);
  const S = Math.sin(psi);
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  // M = Ry(psi) · Rx(theta), decomposed into XYZ Euler angles.
  const M = [
    [C, S * s, S * c],
    [0, c, -s],
    [-S, C * s, C * c],
  ];
  const m13 = clamp(M[0][2], -1, 1);
  const rot: V3 =
    Math.abs(m13) < 0.9999999
      ? [Math.atan2(-M[1][2], M[2][2]), Math.asin(m13), Math.atan2(-M[0][1], M[0][0])]
      : [Math.atan2(M[2][1], M[1][1]), Math.asin(m13), 0];
  return { M, rot, dir: [S * s, c, C * s] };
}

/** Largest scale (≤ 1) that keeps a blade starting at `base` inside `lim`. */
function fitK(base: V3, len: number, wid: number, thick: number, f: BladeFrame, lim: Lim): number {
  const half = [wid / 2, len / 2, thick / 2];
  const pad = 0.003;
  const lo = [-lim.hx + pad, pad, -lim.hz + pad];
  const hi = [lim.hx - pad, lim.y1 - pad, lim.hz - pad];
  let k = 1;
  for (const i of [0, 1, 2]) {
    const e = f.M[i].reduce((sum, m, j) => sum + Math.abs(m) * half[j], 0);
    const off = (f.dir[i] * len) / 2;
    if (off + e > 1e-9) k = Math.min(k, (hi[i] - base[i]) / (off + e));
    if (off - e < -1e-9) k = Math.min(k, (lo[i] - base[i]) / (off - e));
  }
  return clamp(k, 0.05, 1);
}

/** Flat leaf/petal/frond blade (ellipsoid) from `base`, shrunk to fit inside `lim`. */
function blade(
  slot: string,
  base: V3,
  len: number,
  wid: number,
  psi: number,
  theta: number,
  lim: Lim,
  opts?: { thick?: number; k?: number },
): Part {
  const f = bladeFrame(psi, theta);
  const thick = opts?.thick ?? Math.max(0.004, wid * 0.1);
  const k = opts?.k ?? fitK(base, len, wid, thick, f, lim);
  const L = len * k;
  return sphere(slot, [base[0] + (f.dir[0] * L) / 2, base[1] + (f.dir[1] * L) / 2, base[2] + (f.dir[2] * L) / 2], 0.5, {
    scale: [wid * k, L, thick * k],
    rotation: f.rot,
    plan: false,
  });
}

/** Point at fraction `t` (0–1) of the total length along a polyline. */
function alongPath(pts: V3[], t: number): V3 {
  const segs = range(pts.length - 1).map((i) => Math.hypot(...([0, 1, 2].map((k) => pts[i + 1][k] - pts[i][k]) as V3)));
  let rest = clamp(t, 0, 1) * segs.reduce((a, b) => a + b, 0);
  for (const [i, L] of segs.entries()) {
    if (rest <= L || i === segs.length - 1) {
      const u = L > 0 ? clamp(rest / L, 0, 1) : 0;
      return [0, 1, 2].map((k) => lerp(pts[i][k], pts[i + 1][k], u)) as V3;
    }
    rest -= L;
  }
  return pts[pts.length - 1];
}

type PotStyle = 'taper' | 'cylinder' | 'bowl' | 'urn' | 'belly';
const SOIL_FRACTION: Record<PotStyle, number> = { taper: 0.86, cylinder: 0.88, bowl: 0.84, urn: 0.8, belly: 0.58 };

/** Planter pot with a disc of soil just below its rim. */
function potted(potSlot: string, soilSlot: string, base: V3, r: number, ph: number, style: PotStyle): Part[] {
  return [
    pot(potSlot, base, r, ph, style),
    cyl(soilSlot, [base[0], base[1] + ph * 0.9, base[2]], r * SOIL_FRACTION[style], 0.012, { segments: 24, plan: false }),
  ];
}

/** Candle-flame teardrop of radius `r` and height `fh` standing at `base`. */
function flame(slot: string, base: V3, r: number, fh: number): Part {
  return lathe(
    slot,
    base,
    [
      [0, 0],
      [r * 0.8, fh * 0.12],
      [r, fh * 0.35],
      [r * 0.6, fh * 0.7],
      [0, fh],
    ],
    { segments: 16, plan: false },
  );
}

/** Clock hand / dial marker: a bar from the centre (cx, cy) pointing at clock angle `a` (0 = 12 o'clock). */
function hand(slot: string, cx: number, cy: number, z: number, a: number, len: number, wid: number, tail: number, depth: number): Part {
  const r = len / 2 - tail;
  return box(slot, [cx + Math.sin(a) * r, cy + Math.cos(a) * r, z], [wid, len, depth], {
    rotation: [0, 0, -a],
    plan: false,
  });
}

/**
 * Flat plate facing the front (+z) from an outline in [x, y] (y = height), spanning depth
 * z0 … z0 + thick. Built as a prism tipped onto its back.
 */
function wallPlate(slot: string, outline: V2[], z0: number, thick: number, opts?: { plan?: boolean }): Part {
  const xs = outline.map((p) => p[0]);
  const ys = outline.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const part: Part = {
    shape: 'prism',
    outline: outline.map(([x, y]) => [x - cx, y - cy] as V2),
    height: Math.max(0.002, thick),
    position: [cx, cy, z0 + thick],
    rotation: [-Math.PI / 2, 0, 0],
    slot,
  };
  if (opts?.plan === false) part.plan = false;
  return part;
}

/** Round-topped arch outline (bottom at y0, half-width a, arch centre at yc). */
const archOutline = (a: number, y0: number, yc: number): V2[] => [[-a, y0], [a, y0], ...arcPoints(0, yc, a, 0, Math.PI, 20)];

// ---------------------------------------------------------------------------
// Rugs
// ---------------------------------------------------------------------------

/** Fringe strands along both short (x) ends of a rug between x1 and the edge. */
function fringe(slot: string, w: number, d: number, h: number, inner: number): Part[] {
  const n = clamp(Math.round(d / 0.045), 5, 34);
  const parts: Part[] = [];
  for (const z of cells(n, -d / 2 + 0.02, d / 2 - 0.02)) {
    parts.push(span(slot, [inner, w / 2], [0, Math.max(0.002, h * 0.45)], [z - 0.0045, z + 0.0045], { plan: false }));
    parts.push(span(slot, [-w / 2, -inner], [0, Math.max(0.002, h * 0.45)], [z - 0.0045, z + 0.0045], { plan: false }));
  }
  return parts;
}

/** Thin raised line (inset rectangle) drawn on top of a rug at height y. */
function rugLine(slot: string, x: V2, z: V2, y: number, t: number): Part[] {
  const o = { plan: false };
  const yy: V2 = [y, y + 0.0008];
  return [
    span(slot, x, yy, [z[0], z[0] + t], o),
    span(slot, x, yy, [z[1] - t, z[1]], o),
    span(slot, [x[0], x[0] + t], yy, [z[0] + t, z[1] - t], o),
    span(slot, [x[1] - t, x[1]], yy, [z[0] + t, z[1] - t], o),
  ];
}

const rugRect = defineAsset({
  id: 'rug-rect',
  name: 'Rectangular rug',
  category: 'decor',
  type: 'decor',
  group: 'Rugs',
  tags: ['rug', 'carpet', 'mat', 'runner', 'textile'],
  defaultSize: { w: 2.0, d: 1.4, h: 0.01 },
  minSize: { w: 0.6, d: 0.4, h: 0.005 },
  maxSize: { w: 5.0, d: 4.0, h: 0.04 },
  slots: [matSlot('rug', 'Rug field', 'rug-berber'), matSlot('trim', 'Border & fringe', 'fabric-cream')],
  build: ({ w, d, h }) => {
    const fr = Math.min(0.05, w * 0.04);
    const x0 = -w / 2 + fr;
    const x1 = w / 2 - fr;
    const b = Math.min(0.1, d * 0.08);
    const t = b * 0.18;
    return [
      span('trim', [x0, x1], [0, h * 0.92], [-d / 2, d / 2]),
      span('rug', [x0 + b, x1 - b], [0, h], [-d / 2 + b, d / 2 - b], { plan: false }),
      ...rugLine('trim', [x0 + b * 1.6, x1 - b * 1.6], [-d / 2 + b * 1.6, d / 2 - b * 1.6], h, t),
      ...fringe('trim', w, d, h, x1),
    ];
  },
  planDetail: ({ w, d }) => {
    const fr = Math.min(0.05, w * 0.04);
    const b = Math.min(0.1, d * 0.08);
    return [rectPoly(-w / 2 + fr + b, -d / 2 + b, w / 2 - fr - b, d / 2 - b)];
  },
});

const rugRound = defineAsset({
  id: 'rug-round',
  name: 'Round rug',
  category: 'decor',
  type: 'decor',
  group: 'Rugs',
  tags: ['rug', 'carpet', 'round', 'circular', 'mat'],
  defaultSize: { w: 1.6, d: 1.6, h: 0.01 },
  minSize: { w: 0.6, d: 0.6, h: 0.005 },
  maxSize: { w: 4.0, d: 4.0, h: 0.04 },
  slots: [matSlot('rug', 'Rug', 'rug-jute'), matSlot('trim', 'Border & medallion', 'rug-wool-cream')],
  build: ({ w, d, h }) => {
    const zs = d / w;
    const R = w / 2;
    const b = Math.min(0.1, R * 0.12);
    const scale: V3 = [1, 1, zs];
    return [
      cyl('trim', [0, h * 0.45, 0], R, h * 0.9, { scale, segments: 64 }),
      cyl('rug', [0, h / 2, 0], R - b, h, { scale, segments: 64, plan: false }),
      cyl('trim', [0, (h + 0.002) / 2, 0], R * 0.36, h + 0.002, { scale, segments: 48, plan: false }),
      cyl('rug', [0, (h + 0.004) / 2, 0], R * 0.24, h + 0.004, { scale, segments: 48, plan: false }),
      // Flat stripe ring half way out.
      torus('trim', [0, h, 0], R * 0.66, Math.min(0.012, R * 0.02), {
        rotation: [Math.PI / 2, 0, 0],
        scale: [1, zs, 0.12],
        plan: false,
      }),
    ];
  },
  planDetail: ({ w, d }) => {
    const b = Math.min(0.1, Math.min(w, d) * 0.06);
    return [poly(ellipsePoints(0, 0, w / 2 - b, d / 2 - b, 48)), poly(ellipsePoints(0, 0, w * 0.18, d * 0.18, 32))];
  },
});

const rugRunner = defineAsset({
  id: 'rug-runner',
  name: 'Runner rug',
  category: 'decor',
  type: 'decor',
  group: 'Rugs',
  tags: ['runner', 'hallway rug', 'kilim', 'long rug', 'corridor', 'textile'],
  defaultSize: { w: 2.5, d: 0.8, h: 0.01 },
  minSize: { w: 1.2, d: 0.5, h: 0.005 },
  maxSize: { w: 5.0, d: 1.2, h: 0.03 },
  slots: [matSlot('rug', 'Field', 'rug-blue-geometric'), matSlot('trim', 'Border & fringe', 'fabric-cream')],
  build: ({ w, d, h }) => {
    const fr = Math.min(0.06, w * 0.03);
    const x0 = -w / 2 + fr;
    const x1 = w / 2 - fr;
    const bw = clamp(d * 0.08, 0.03, 0.08);
    const parts: Part[] = [
      span('trim', [x0, x1], [0, h * 0.9], [-d / 2, d / 2]),
      span('rug', [x0 + bw, x1 - bw], [0, h], [-d / 2 + bw, d / 2 - bw], { plan: false }),
      ...rugLine('trim', [x0 + bw * 1.6, x1 - bw * 1.6], [-d / 2 + bw * 1.6, d / 2 - bw * 1.6], h, bw * 0.22),
      ...fringe('trim', w, d, h, x1),
    ];
    // Row of diamond medallions down the length.
    const s = Math.max(0.05, (d / 2 - 2 * bw) / 0.75);
    const nD = clamp(Math.round((x1 - x0 - 2 * bw) / 0.6), 1, 8);
    for (const cx of cells(nD, x0 + bw * 2, x1 - bw * 2)) {
      parts.push(
        box('trim', [cx, h + 0.0006, 0], [s, 0.0012, s], { rotation: [0, Math.PI / 4, 0], plan: false }),
        box('rug', [cx, h + 0.0015, 0], [s * 0.5, 0.0012, s * 0.5], { rotation: [0, Math.PI / 4, 0], plan: false }),
      );
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const fr = Math.min(0.06, w * 0.03);
    const x0 = -w / 2 + fr;
    const x1 = w / 2 - fr;
    const bw = clamp(d * 0.08, 0.03, 0.08);
    const r = (Math.max(0.05, (d / 2 - 2 * bw) / 0.75) / 2) * Math.SQRT2;
    const nD = clamp(Math.round((x1 - x0 - 2 * bw) / 0.6), 1, 8);
    return [
      rectPoly(x0 + bw, -d / 2 + bw, x1 - bw, d / 2 - bw),
      ...cells(nD, x0 + bw * 2, x1 - bw * 2).map((cx) =>
        poly([
          [cx - r, 0],
          [cx, -r],
          [cx + r, 0],
          [cx, r],
        ]),
      ),
    ];
  },
});

// ---------------------------------------------------------------------------
// Soft furnishings
// ---------------------------------------------------------------------------

const curtains = defineAsset({
  id: 'curtains',
  name: 'Curtains (pair)',
  category: 'decor',
  type: 'decor',
  group: 'Curtains & blinds',
  tags: ['curtains', 'drapes', 'window', 'textile', 'blinds'],
  defaultSize: { w: 2.4, d: 0.18, h: 2.55 },
  minSize: { w: 0.8, d: 0.12, h: 1.2 },
  maxSize: { w: 5.0, d: 0.3, h: 3.2 },
  mount: 'wall',
  defaultElevation: 0.03,
  slots: [matSlot('fabric', 'Fabric', 'fabric-linen'), matSlot('rod', 'Rod, rings & finials', 'metal-black-matte')],
  build: ({ w, d, h }) => {
    const pw = clamp(w * 0.22, 0.25, 0.9);
    const n = clamp(Math.round(pw / 0.08), 3, 8);
    const rp = (pw / n / 2) * 1.15;
    const wave = 0.012;
    const sz = Math.min(1.6, (d / 2 - wave - 0.02) / rp);
    const yRod = h - 0.025;
    const parts: Part[] = [
      rodX('rod', -w / 2 + 0.05, w / 2 - 0.05, yRod, 0, 0.012),
      // Ball finials with collars.
      sphere('rod', [-w / 2 + 0.025, yRod, 0], 0.025, { plan: false }),
      sphere('rod', [w / 2 - 0.025, yRod, 0], 0.025, { plan: false }),
      rodX('rod', -w / 2 + 0.045, -w / 2 + 0.06, yRod, 0, 0.016, { plan: false }),
      rodX('rod', w / 2 - 0.06, w / 2 - 0.045, yRod, 0, 0.016, { plan: false }),
    ];
    for (const bx of [-w / 2 + 0.15, w / 2 - 0.15]) {
      parts.push(
        span('rod', [bx - 0.01, bx + 0.01], [h - 0.04, h - 0.01], [-d / 2 + 0.008, 0], { plan: false }),
        discZ('rod', [bx, h - 0.025, -d / 2 + 0.004], 0.022, 0.008, { plan: false }),
      );
    }
    // Two gathered panels drawn open at the sides; each pleat is a flattened cylinder hung on a ring.
    for (const x0 of [-w / 2 + 0.07, w / 2 - 0.07 - pw]) {
      cells(n, x0, x0 + pw).forEach((x, i) => {
        parts.push(
          vcyl('fabric', x, i % 2 === 0 ? -wave : wave, 0.01, h - 0.05, rp, {
            scale: [1, 1, sz],
            segments: 16,
          }),
          torus('rod', [x, yRod, 0], 0.02, 0.004, { rotation: [0, Math.PI / 2, 0], plan: false }),
        );
      });
      // Tie-back cinching the panel.
      const r = pw / 2 + 0.005;
      const t = 0.012;
      parts.push(
        ring('fabric', [x0 + pw / 2, h * 0.42, 0], r, t, { zScale: (d / 2 - 0.005) / (r + t), plan: false }),
      );
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const pw = clamp(w * 0.22, 0.25, 0.9);
    return [
      line([-w / 2 + 0.03, 0], [w / 2 - 0.03, 0]),
      rectPoly(-w / 2 + 0.07, -d / 2 + 0.02, -w / 2 + 0.07 + pw, d / 2 - 0.02),
      rectPoly(w / 2 - 0.07 - pw, -d / 2 + 0.02, w / 2 - 0.07, d / 2 - 0.02),
    ];
  },
});

const blindRoller = defineAsset({
  id: 'blind-roller',
  name: 'Roller blind',
  category: 'decor',
  type: 'decor',
  group: 'Curtains & blinds',
  tags: ['roller blind', 'blind', 'window', 'shade', 'blackout'],
  defaultSize: { w: 1.2, d: 0.08, h: 1.5 },
  minSize: { w: 0.4, d: 0.05, h: 0.6 },
  maxSize: { w: 3.0, d: 0.15, h: 2.6 },
  mount: 'wall',
  defaultElevation: 0.9,
  slots: [matSlot('fabric', 'Blind fabric', 'fabric-linen'), matSlot('cassette', 'Cassette & bar', 'metal-white-powder')],
  build: ({ w, d, h }) => {
    const z0 = -d / 2;
    const cH = Math.min(0.08, d);
    const zf = Math.min(d / 2 - 0.012, z0 + d * 0.6);
    const xc = w / 2 - 0.012;
    return [
      span('cassette', [-w / 2 + 0.015, w / 2 - 0.015], [h - cH, h], [z0 + 0.008, d / 2], { bevel: 0.006 }),
      span('cassette', [-w / 2, -w / 2 + 0.015], [h - cH - 0.005, h], [z0, d / 2], { bevel: 0.004, plan: false }),
      span('cassette', [w / 2 - 0.015, w / 2], [h - cH - 0.005, h], [z0, d / 2], { bevel: 0.004, plan: false }),
      span('fabric', [-w / 2 + 0.03, w / 2 - 0.03], [0.03, h - cH], [zf - 0.0015, zf + 0.0015], { plan: false }),
      span('cassette', [-w / 2 + 0.025, w / 2 - 0.025], [0.012, 0.035], [zf - 0.008, zf + 0.008], { bevel: 0.004 }),
      torus('cassette', [0, 0.01, zf + 0.009], 0.007, 0.0018, { plan: false }),
      // Bead chain loop on the right.
      vcyl('cassette', xc - 0.004, zf + 0.008, h * 0.35, h - cH, 0.0015, { plan: false }),
      vcyl('cassette', xc + 0.004, zf + 0.008, h * 0.35, h - cH, 0.0015, { plan: false }),
      sphere('cassette', [xc, h * 0.35, zf + 0.008], 0.006, { plan: false }),
    ];
  },
  planDetail: ({ w, d }) => {
    const zf = Math.min(d / 2 - 0.012, -d / 2 + d * 0.6);
    return [line([-w / 2 + 0.03, zf], [w / 2 - 0.03, zf])];
  },
});

const throwCushion = defineAsset({
  id: 'cushion',
  name: 'Throw cushion',
  category: 'decor',
  type: 'decor',
  group: 'Cushions & throws',
  tags: ['cushion', 'pillow', 'throw pillow', 'textile', 'scatter'],
  defaultSize: { w: 0.45, d: 0.16, h: 0.45 },
  minSize: { w: 0.25, d: 0.08, h: 0.25 },
  maxSize: { w: 0.8, d: 0.3, h: 0.8 },
  // Rests on a sofa seat by default.
  defaultElevation: 0.42,
  slots: [matSlot('fabric', 'Fabric', 'fabric-mustard'), matSlot('piping', 'Piping & button', 'fabric-cream')],
  build: ({ w, d, h }) => {
    const pr = clamp(Math.min(w, h) * 0.012, 0.004, 0.008);
    const cy = h / 2;
    const ex = w / 2 - pr;
    const ey = h / 2 - pr;
    const o = { plan: false };
    const parts: Part[] = [
      box('fabric', [0, cy, 0], [w - 2 * pr, h - 2 * pr, d * 0.45], { bevel: d * 0.2 }),
      sphere('fabric', [0, cy, 0], 0.5, { scale: [w * 0.94, h * 0.94, d] }),
      rodX('piping', -ex, ex, cy + ey, 0, pr, o),
      rodX('piping', -ex, ex, cy - ey, 0, pr, o),
      vcyl('piping', -ex, 0, cy - ey, cy + ey, pr, o),
      vcyl('piping', ex, 0, cy - ey, cy + ey, pr, o),
      sphere('piping', [0, cy, d / 2 - 0.005], 0.011, { scale: [1, 1, 0.6], plan: false }),
      sphere('piping', [0, cy, -d / 2 + 0.005], 0.011, { scale: [1, 1, 0.6], plan: false }),
    ];
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) parts.push(sphere('piping', [sx * ex, cy + sy * ey, 0], pr * 1.3, o));
    return parts;
  },
});

const throwBlanket = defineAsset({
  id: 'throw-blanket',
  name: 'Folded throw blanket',
  category: 'decor',
  type: 'decor',
  group: 'Cushions & throws',
  tags: ['throw', 'blanket', 'plaid', 'textile', 'folded'],
  defaultSize: { w: 0.5, d: 0.35, h: 0.08 },
  minSize: { w: 0.25, d: 0.2, h: 0.02 },
  maxSize: { w: 1.2, d: 0.8, h: 0.2 },
  slots: [matSlot('fabric', 'Fabric', 'fabric-wool-grey')],
  build: ({ w, d, h }) => {
    const lh = h / 4;
    const fl = Math.min(0.04, d * 0.12);
    const parts: Part[] = range(4).map((i) => {
      const off = i % 2 === 0 ? -0.008 : 0.008;
      return span('fabric', [-w / 2 + 0.008 + off, w / 2 - 0.008 + off], [i * lh, (i + 1) * lh - 0.001], [-d / 2, d / 2 - fl], {
        bevel: Math.min(0.01, lh * 0.4),
      });
    });
    // Rolled fold edges alternating sides.
    for (const i of [0, 1, 2]) {
      const x = i % 2 === 0 ? w / 2 - lh : -w / 2 + lh;
      parts.push(rodZ('fabric', x, (i + 1) * lh, -d / 2 + lh, d / 2 - fl - lh, lh, { plan: false }));
    }
    // Tassel fringe on the top layer.
    const n = clamp(Math.round(w / 0.025), 6, 40);
    for (const x of cells(n, -w / 2 + 0.02, w / 2 - 0.02)) {
      parts.push(span('fabric', [x - 0.003, x + 0.003], [3 * lh + lh * 0.3, 3 * lh + lh * 0.6], [d / 2 - fl, d / 2], { plan: false }));
    }
    return parts;
  },
});

const floorCushion = defineAsset({
  id: 'floor-cushion',
  name: 'Floor cushion',
  category: 'decor',
  type: 'decor',
  group: 'Cushions & throws',
  tags: ['floor cushion', 'pouf', 'zabuton', 'meditation', 'tufted', 'seat pad'],
  defaultSize: { w: 0.7, d: 0.7, h: 0.18 },
  minSize: { w: 0.45, d: 0.45, h: 0.1 },
  maxSize: { w: 1.1, d: 1.1, h: 0.3 },
  slots: [matSlot('fabric', 'Cover', 'fabric-terracotta'), matSlot('piping', 'Piping & tufts', 'fabric-cream')],
  build: ({ w, d, h }) => {
    const pr = clamp(h * 0.06, 0.006, 0.012);
    const ex = w / 2 - pr;
    const ez = d / 2 - pr;
    const bev = Math.min(0.45 * h, ex - 0.02, ez - 0.02);
    const ys = h * 0.5;
    const o = { plan: false };
    const parts: Part[] = [
      softBlock('fabric', [-ex, ex], [0, h * 0.85], [-ez, ez], { softness: 0.45 }),
      pillow('fabric', [0, h * 0.68, 0], w * 0.9, h * 0.6, d * 0.9),
      // Waist piping: straight runs plus quarter-circle corners.
      rodX('piping', -ex + bev, ex - bev, ys, ez, pr, o),
      rodX('piping', -ex + bev, ex - bev, ys, -ez, pr, o),
      rodZ('piping', ex, ys, -ez + bev, ez - bev, pr, o),
      rodZ('piping', -ex, ys, -ez + bev, ez - bev, pr, o),
    ];
    const corners: [number, number, number][] = [
      [1, 1, 0],
      [-1, 1, Math.PI / 2],
      [-1, -1, Math.PI],
      [1, -1, (3 * Math.PI) / 2],
    ];
    for (const [sx, sz, a] of corners) {
      parts.push(
        torus('piping', [sx * (ex - bev), ys, sz * (ez - bev)], bev, pr, {
          rotation: [Math.PI / 2, 0, a],
          arc: Math.PI / 2,
          plan: false,
        }),
      );
    }
    // Tufting buttons following the domed top.
    const nx = clamp(Math.round(w / 0.25), 2, 4);
    const nz = clamp(Math.round(d / 0.25), 2, 4);
    for (const x of cells(nx, -w * 0.3, w * 0.3)) {
      for (const z of cells(nz, -d * 0.3, d * 0.3)) {
        const q = 1 - (x / (w * 0.45)) ** 2 - (z / (d * 0.45)) ** 2;
        const y = h * 0.68 + h * 0.3 * Math.sqrt(Math.max(0, q)) - 0.004;
        parts.push(sphere('piping', [x, Math.min(y, h - 0.006), z], 0.012, { scale: [1, 0.5, 1], plan: false }));
      }
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const nx = clamp(Math.round(w / 0.25), 2, 4);
    const nz = clamp(Math.round(d / 0.25), 2, 4);
    return cells(nx, -w * 0.3, w * 0.3).flatMap((x) => cells(nz, -d * 0.3, d * 0.3).map((z) => circle([x, z], 0.012)));
  },
});

// ---------------------------------------------------------------------------
// Plants
// ---------------------------------------------------------------------------

const plantPotted = defineAsset({
  id: 'plant-potted',
  name: 'Spider plant',
  category: 'plants',
  type: 'plants',
  group: 'Indoor plants',
  plant: PLANT_SPECIES['chlorophytum-comosum'],
  tags: ['spider plant', 'chlorophytum', 'airplane plant', 'striped leaves', 'pet safe', 'plantlets', 'tall pot'],
  description: 'A variegated spider plant in a tall white planter: arching cream-striped leaves and runners hung with baby plantlets.',
  defaultSize: { w: 0.45, d: 0.45, h: 0.9 },
  minSize: { w: 0.2, d: 0.2, h: 0.3 },
  maxSize: { w: 1.0, d: 1.0, h: 1.6 },
  slots: [
    matSlot('pot', 'Pot & saucer', 'ceramic-white'),
    matSlot('leaf', 'Leaves', 'plant-leaf'),
    matSlot('soil', 'Soil', 'plant-soil'),
    matSlot('leafDark', 'Leaf stripes', 'paint-cream'),
  ],
  build: (size) => {
    const { w, d, h } = size;
    const m = Math.min(w, d) / 2;
    const box = plantBox(size);
    const potR = m * 0.5;
    const potH = clamp(h * 0.42, 0.1, 0.5);
    const by = potH * 0.9;
    const k = clamp(h / 0.9, 0.5, 1.6);
    const parts: Part[] = [cyl('pot', [0, 0.006, 0], potR * 0.82, 0.012, { segments: 32 }), ...potted('pot', 'soil', [0, 0.012, 0], potR, potH - 0.012, 'cylinder')];
    const rand = rng(17);
    const crown: V3 = [0, by + 0.01, 0];
    // Arching strap leaves: a green blade with a narrower, thicker cream stripe down the middle.
    for (const i of range(18)) {
      const az = i * GOLDEN;
      const len = 0.36 * k * lerp(0.6, 1, rand());
      const tilt = lerp(0.15, 0.85, rand());
      const o = { segs: 3, bend: lerp(0.9, 1.5, rand()), roll: (rand() - 0.5) * 0.4, twist: (rand() - 0.5) * 0.3, samples: 4 };
      const green = bladeLeaf('leaf', crown, len, strapWidth(0.02 * k, 0.75, 0.5), az, tilt, { ...o, thick: 0.002, plan: i < 4 });
      const stripe = bladeLeaf('leafDark', crown, len * 0.97, strapWidth(0.008 * k, 0.7, 0.5), az, tilt, { ...o, thick: 0.0032 });
      parts.push(...fitGroup([...green.parts, ...stripe.parts], crown, box));
    }
    // Two runners with baby plantlets hanging over the pot rim.
    for (const r of range(2)) {
      const a = r * Math.PI + 0.6;
      const p1 = polar(potR + 0.06 * k, a, by + 0.08 * k);
      const p2 = polar(Math.min(m - 0.04, potR + 0.14 * k), a + 0.2, Math.max(0.08, by - 0.18 * k));
      const g: Part[] = [rod('leaf', crown, p1, 0.0025, { segments: 5, plan: false }), rod('leaf', p1, p2, 0.0022, { segments: 5, plan: false })];
      for (const j of range(6)) {
        g.push(...bladeLeaf('leaf', p2, 0.07 * k, strapWidth(0.012 * k, 0.6, 0.5), j * 1.05 + a, lerp(0.7, 1.4, (j % 3) / 2), { segs: 1, thick: 0.002 }).parts);
      }
      parts.push(...fitGroup(g, crown, box));
    }
    return containParts(parts, box);
  },
  planDetail: ({ w, d }) => [circle([0, 0], (Math.min(w, d) / 2) * 0.5), poly(ellipsePoints(0, 0, (Math.min(w, d) / 2) * 0.9, (Math.min(w, d) / 2) * 0.9, 18))],
});

const plantLarge = defineAsset({
  id: 'plant-large',
  name: 'Corn plant (dracaena)',
  category: 'plants',
  type: 'plants',
  group: 'Indoor plants',
  plant: PLANT_SPECIES['dracaena-fragrans'],
  tags: ['corn plant', 'dracaena fragrans', 'janet craig', 'floor plant', 'low light', 'canes', 'woven basket'],
  description: "Dracaena fragrans 'Janet Craig': three bark canes of staggered heights topped with rosettes of glossy, arching strap leaves, in a woven basket.",
  defaultSize: { w: 0.8, d: 0.8, h: 1.8 },
  minSize: { w: 0.4, d: 0.4, h: 1.0 },
  maxSize: { w: 1.5, d: 1.5, h: 2.6 },
  slots: [
    matSlot('pot', 'Basket', 'rug-jute'),
    matSlot('leaf', 'Leaves', 'plant-leaf-dark'),
    matSlot('trunk', 'Canes', 'wood-dark-stain'),
    matSlot('soil', 'Soil', 'plant-soil'),
  ],
  build: (size) => {
    const { w, d, h } = size;
    const m = Math.min(w, d) / 2;
    const box = plantBox(size);
    const k = clamp(h / 1.8, 0.6, 1.4);
    const potR = m * 0.45;
    const potH = clamp(h * 0.2, 0.22, 0.42);
    const parts: Part[] = [...potted('pot', 'soil', [0, 0, 0], potR, potH, 'cylinder')];
    // Woven bands and a rolled rim on the basket.
    for (const f of [0.25, 0.5, 0.75]) parts.push(ring('pot', [0, potH * f, 0], potR - 0.006, 0.006, { plan: false }));
    parts.push(ring('pot', [0, potH - 0.009, 0], potR - 0.009, 0.009, { plan: false }));
    const rand = rng(29);
    const canes: [number, number][] = [
      [0.44, 0.3],
      [0.62, 2.4],
      [0.8, 4.4],
    ];
    for (const [ci, [f, a]] of canes.entries()) {
      const base = polar(potR * 0.3, a, potH * 0.85);
      const top = vadd(polar(potR * 0.35, a + 0.2), [0, h * f - 0.12 * k, 0]);
      const r = 0.032 * k * (1 - ci * 0.12);
      parts.push(rod('trunk', base, top, r, { rTop: r * 0.9, segments: 10, plan: false }), cyl('trunk', top, r * 0.92, 0.012, { segments: 10, plan: false }));
      // Rings left on the cane by old leaves.
      for (const q of [0.3, 0.55, 0.8]) parts.push(ring('trunk', vadd(base, vmul(vadd(top, vmul(base, -1)), q)), r * 1.02, 0.003, { plan: false }));
      for (const i of range(10)) {
        const az = i * GOLDEN + ci;
        const tilt = lerp(0.2, 1.1, (i % 5) / 4) + (rand() - 0.5) * 0.15;
        const len = 0.5 * k * lerp(0.75, 1, rand());
        const blade = bladeLeaf(
          'leaf',
          top,
          len,
          knotWidth(0.075 * k, [
            [0, 0.45],
            [0.2, 0.95],
            [0.6, 1],
            [0.9, 0.55],
            [1, 0],
          ]),
          az,
          tilt,
          { segs: 2, bend: lerp(0.5, 1.1, rand()), fold: 0.18, roll: (rand() - 0.5) * 0.4, thick: 0.003, samples: 5, plan: ci === 2 && i < 3 },
        );
        parts.push(...fitGroup(blade.parts, top, box));
      }
    }
    return containParts(parts, box);
  },
  planDetail: ({ w, d }) => {
    const m = Math.min(w, d) / 2;
    return [circle([0, 0], m * 0.45), poly(ellipsePoints(0, 0, m * 0.9, m * 0.9, 24))];
  },
});

const plantMonstera = defineAsset({
  id: 'plant-monstera',
  name: 'Monstera',
  category: 'plants',
  type: 'plants',
  group: 'Indoor plants',
  plant: PLANT_SPECIES['monstera-deliciosa'],
  tags: ['monstera', 'swiss cheese plant', 'houseplant', 'tropical', 'big leaves'],
  description: 'A Swiss cheese plant with large split, holed leaves on long stalks, climbing a moss pole in a white ceramic pot.',
  defaultSize: { w: 0.7, d: 0.7, h: 1.0 },
  minSize: { w: 0.4, d: 0.4, h: 0.5 },
  maxSize: { w: 1.3, d: 1.3, h: 1.8 },
  slots: [
    matSlot('pot', 'Pot', 'ceramic-white'),
    matSlot('leaf', 'Leaves', 'plant-leaf-dark'),
    matSlot('stems', 'Stems', 'plant-leaf'),
    matSlot('soil', 'Soil & moss pole', 'plant-soil'),
  ],
  build: (size) => {
    const { w, d, h } = size;
    const m = Math.min(w, d) / 2;
    const lim = limOf(size);
    const potR = m * 0.42;
    const potH = clamp(h * 0.28, 0.12, 0.34);
    const sy = potH * 0.9;
    const parts: Part[] = [
      ...potted('pot', 'soil', [0, 0, 0], potR, potH, 'cylinder'),
      vcyl('soil', 0, -potR * 0.3, sy, Math.min(h * 0.7, h - 0.05), 0.02, { plan: false }),
    ];
    const rand = rng(31);
    for (const i of range(9)) {
      const psi = i * 2.39996 + rand() * 0.3;
      const rho = lerp(0.12, 0.5, rand()) * m;
      const P: V3 = [Math.sin(psi) * rho, lerp(sy + (h - sy) * 0.3, h * 0.86, rand()), Math.cos(psi) * rho];
      const len = m * 0.62;
      parts.push(
        rod('stems', [Math.sin(psi) * potR * 0.25, sy, Math.cos(psi) * potR * 0.25], P, 0.006, { plan: false }),
        blade('leaf', P, len, len * 0.85, psi, lerp(1.2, 1.55, rand()), lim, { thick: 0.012 }),
      );
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const m = Math.min(w, d) / 2;
    return [circle([0, 0], m * 0.42), poly(ellipsePoints(0, 0, m * 0.9, m * 0.9, 24))];
  },
});

const plantFiddleLeaf = defineAsset({
  id: 'plant-fiddle-leaf',
  name: 'Fiddle-leaf fig',
  category: 'plants',
  type: 'plants',
  group: 'Trees',
  plant: PLANT_SPECIES['ficus-lyrata'],
  tags: ['fiddle leaf fig', 'ficus lyrata', 'indoor tree', 'houseplant', 'big leaves'],
  description: 'A fiddle-leaf fig trained as a small tree: a bare trunk topped with big, violin-shaped, dark glossy leaves, in a black glazed pot.',
  defaultSize: { w: 0.6, d: 0.6, h: 1.7 },
  minSize: { w: 0.4, d: 0.4, h: 1.0 },
  maxSize: { w: 1.0, d: 1.0, h: 2.4 },
  slots: [
    matSlot('pot', 'Pot', 'ceramic-black'),
    matSlot('leaf', 'Leaves', 'plant-leaf-dark'),
    matSlot('trunk', 'Trunk', 'wood-dark-stain'),
    matSlot('soil', 'Soil', 'plant-soil'),
  ],
  build: (size) => {
    const { w, d, h } = size;
    const m = Math.min(w, d) / 2;
    const lim = limOf(size);
    const potR = m * 0.5;
    const potH = clamp(h * 0.18, 0.2, 0.36);
    const parts: Part[] = [
      ...potted('pot', 'soil', [0, 0, 0], potR, potH, 'cylinder'),
      ...rodPath(
        'trunk',
        [
          [0, potH * 0.85, 0],
          [0.015, h * 0.4, 0.01],
          [-0.01, h * 0.65, -0.005],
          [0, h * 0.82, 0],
        ],
        0.016,
      ),
    ];
    const N = clamp(Math.round(h * 13), 13, 30);
    const rand = rng(5);
    const len0 = clamp(h * 0.15, 0.16, 0.3);
    for (const i of range(N)) {
      const t = i / (N - 1);
      const len = len0 * lerp(0.8, 1.05, rand());
      const theta = lerp(1.25, 0.45, t) + (rand() - 0.5) * 0.2;
      parts.push(blade('leaf', [0, lerp(h * 0.36, h * 0.82, t), 0], len, len * 0.62, i * 2.39996, theta, lim, { thick: 0.01 }));
    }
    parts.push(blade('leaf', [0, h * 0.82, 0], len0 * 0.7, len0 * 0.4, 0, 0.1, lim, { thick: 0.01 }));
    return parts;
  },
  planDetail: ({ w, d }) => {
    const m = Math.min(w, d) / 2;
    return [circle([0, 0], m * 0.5), poly(ellipsePoints(0, 0, m * 0.85, m * 0.85, 24))];
  },
});

const plantSnake = defineAsset({
  id: 'plant-snake',
  name: 'Snake plant',
  category: 'plants',
  type: 'plants',
  group: 'Indoor plants',
  plant: PLANT_SPECIES['dracaena-trifasciata'],
  tags: ['snake plant', 'sansevieria', "mother-in-law's tongue", 'houseplant', 'upright'],
  description: "Snake plant 'Laurentii': stiff upright sword leaves with yellow edges, in a white ceramic pot.",
  defaultSize: { w: 0.35, d: 0.35, h: 0.8 },
  minSize: { w: 0.2, d: 0.2, h: 0.4 },
  maxSize: { w: 0.6, d: 0.6, h: 1.3 },
  slots: [
    matSlot('pot', 'Pot', 'ceramic-white'),
    matSlot('leaf', 'Leaves', 'plant-leaf-dark'),
    matSlot('edge', 'Leaf edges', 'plant-leaf-light'),
    matSlot('soil', 'Soil', 'plant-soil'),
  ],
  build: (size) => {
    const { w, d, h } = size;
    const m = Math.min(w, d) / 2;
    const lim = limOf(size);
    const potR = m * 0.62;
    const potH = clamp(h * 0.28, 0.1, 0.3);
    const sy = potH * 0.9;
    const parts: Part[] = [...potted('pot', 'soil', [0, 0, 0], potR, potH, 'cylinder')];
    const N = clamp(Math.round(m * 50), 7, 14);
    const wid = clamp(m * 0.28, 0.035, 0.07);
    const thick = 0.012;
    const rand = rng(13);
    for (const i of range(N)) {
      const psi = i * 2.39996 + rand() * 0.4;
      const r0 = potR * 0.55 * Math.sqrt(rand());
      const base: V3 = [Math.sin(psi) * r0, sy, Math.cos(psi) * r0];
      const theta = lerp(0.04, 0.3, rand());
      const len = (h - sy) * lerp(0.55, 1, rand());
      const k = fitK(base, len, wid * 1.15, thick, bladeFrame(psi, theta), lim);
      parts.push(
        blade('edge', base, len, wid * 1.15, psi, theta, lim, { thick: thick * 0.6, k }),
        blade('leaf', base, len, wid, psi, theta, lim, { thick, k }),
      );
    }
    return parts;
  },
  planDetail: ({ w, d }) => [circle([0, 0], (Math.min(w, d) / 2) * 0.62)],
});

const plantCactus = defineAsset({
  id: 'plant-cactus',
  name: 'Peruvian apple cactus',
  category: 'plants',
  type: 'plants',
  group: 'Succulents & cacti',
  plant: PLANT_SPECIES['cereus-repandus'],
  tags: ['cactus', 'cereus', 'peruvian apple cactus', 'column cactus', 'succulent', 'terracotta', 'pet safe'],
  description: 'A branching column cactus with ribbed green stems and a pink bloom, in a terracotta pot.',
  defaultSize: { w: 0.3, d: 0.3, h: 0.7 },
  minSize: { w: 0.15, d: 0.15, h: 0.3 },
  maxSize: { w: 0.6, d: 0.6, h: 1.6 },
  slots: [
    matSlot('pot', 'Pot', 'terracotta-pot'),
    matSlot('cactus', 'Cactus', 'plant-leaf'),
    matSlot('soil', 'Soil', 'plant-soil'),
    matSlot('flower', 'Flowers', 'plant-flower-pink'),
  ],
  build: ({ w, d, h }) => {
    const m = Math.min(w, d) / 2;
    const potR = m * 0.62;
    const potH = clamp(h * 0.24, 0.08, 0.26);
    const y0 = potH * 0.9;
    const cr = clamp(m * 0.28, 0.025, 0.1);
    const top = h - cr;
    const o = { plan: false };
    const parts: Part[] = [
      ...potted('pot', 'soil', [0, 0, 0], potR, potH, 'taper'),
      vcyl('cactus', 0, 0, y0, top, cr, { segments: 16 }),
      sphere('cactus', [0, top, 0], cr, o),
    ];
    for (const k of range(8)) {
      const a = (k * Math.PI) / 4;
      parts.push(vcyl('cactus', Math.cos(a) * cr * 0.9, Math.sin(a) * cr * 0.9, y0, top, cr * 0.2, o));
    }
    const ar = cr * 0.62;
    const H = h - y0;
    const xr = Math.min(m - ar - 0.005, cr + ar * 2.2);
    const arm = (side: number, reach: number, yS: number, rise: number) => {
      const yE = Math.max(yS, Math.min(h - ar, yS + rise));
      parts.push(
        rod('cactus', [0, yS, 0], [side * reach, yS, 0], ar, o),
        sphere('cactus', [side * reach, yS, 0], ar, o),
        vcyl('cactus', side * reach, 0, yS, yE, ar, o),
        sphere('cactus', [side * reach, yE, 0], ar, o),
      );
    };
    arm(-1, xr, y0 + H * 0.35, H * 0.32);
    arm(1, xr * 0.85, y0 + H * 0.5, H * 0.22);
    for (const k of range(3)) {
      const a = k * 2.1;
      parts.push(sphere('flower', [Math.cos(a) * cr * 0.45, h - cr * 0.3, Math.sin(a) * cr * 0.45], cr * 0.28, { scale: [1, 0.6, 1], plan: false }));
    }
    return parts;
  },
  planDetail: ({ w, d }) => [circle([0, 0], (Math.min(w, d) / 2) * 0.62)],
});

const plantSucculents = defineAsset({
  id: 'plant-succulents',
  name: 'Succulent trio',
  category: 'plants',
  type: 'plants',
  group: 'Succulents & cacti',
  plant: PLANT_SPECIES['succulent-trio'],
  tags: ['succulents', 'echeveria', 'aloe', 'windowsill', 'tabletop', 'trio'],
  description: 'Three small succulents on a light oak tray: a blue-grey echeveria rosette, a clump of finger mammillaria and a small aloe.',
  defaultSize: { w: 0.4, d: 0.16, h: 0.16 },
  minSize: { w: 0.25, d: 0.1, h: 0.08 },
  maxSize: { w: 0.8, d: 0.3, h: 0.3 },
  slots: [
    matSlot('pot', 'Pots', 'ceramic-white'),
    matSlot('leaf', 'Succulents', 'plant-leaf-light'),
    matSlot('soil', 'Soil', 'plant-soil'),
    matSlot('tray', 'Tray', 'wood-oak-light'),
  ],
  build: (size) => {
    const { w, d, h } = size;
    const lim = limOf(size);
    const tH = 0.012;
    const parts: Part[] = [span('tray', [-w / 2, w / 2], [0, tH], [-d / 2, d / 2], { bevel: 0.004 })];
    const n = clamp(Math.round(w / 0.13), 2, 5);
    const cw = (w - 0.02) / n;
    const pr = Math.min(cw * 0.42, d / 2 - 0.012);
    const ph = clamp(h * 0.4, 0.035, 0.1);
    const styles: PotStyle[] = ['cylinder', 'bowl', 'taper'];
    cells(n, -w / 2 + 0.01, w / 2 - 0.01).forEach((x, i) => {
      parts.push(...potted('pot', 'soil', [x, tH, 0], pr, ph, styles[i % 3]));
      const sy = tH + ph * 0.9 + 0.004;
      const base: V3 = [x, sy, 0];
      if (i % 3 === 0) {
        // Echeveria rosette.
        for (const j of range(8)) parts.push(blade('leaf', base, pr * 0.95, pr * 0.5, (j * Math.PI) / 4, 1.2, lim, { thick: pr * 0.22 }));
        for (const j of range(5)) {
          parts.push(blade('leaf', base, pr * 0.6, pr * 0.4, (j * 2 * Math.PI) / 5 + 0.3, 0.7, lim, { thick: pr * 0.2 }));
        }
        parts.push(sphere('leaf', [x, sy + pr * 0.12, 0], pr * 0.18, { plan: false }));
      } else if (i % 3 === 1) {
        // Ribbed cactus ball.
        const br = Math.max(0.01, Math.min(pr * 0.75, (h - sy) / 2 - 0.002));
        parts.push(sphere('leaf', [x, sy + br * 0.9, 0], br, { plan: false }));
        for (const j of range(3)) {
          parts.push(torus('leaf', [x, sy + br * 0.9, 0], br * 0.97, br * 0.07, { rotation: [0, (j * Math.PI) / 3, 0], plan: false }));
        }
      } else {
        // Aloe spikes.
        for (const j of range(7)) {
          parts.push(
            blade('leaf', base, Math.min(h - sy, pr * 2.2), pr * 0.3, (j * 2 * Math.PI) / 7, lerp(0.25, 0.65, (j % 3) / 2), lim, {
              thick: pr * 0.15,
            }),
          );
        }
      }
    });
    return parts;
  },
  planDetail: ({ w, d }) => {
    const n = clamp(Math.round(w / 0.13), 2, 5);
    const pr = Math.min(((w - 0.02) / n) * 0.42, d / 2 - 0.012);
    return cells(n, -w / 2 + 0.01, w / 2 - 0.01).map((x) => circle([x, 0], pr));
  },
});

const plantHangingPothos = defineAsset({
  id: 'plant-hanging-pothos',
  name: 'Hanging pothos',
  category: 'plants',
  type: 'plants',
  group: 'Hanging plants',
  plant: PLANT_SPECIES['epipremnum-aureum'],
  tags: ['pothos', 'hanging plant', 'macrame', 'trailing', 'vines', 'devils ivy'],
  description: 'Golden pothos trailing long vines of heart-shaped leaves from a white pot in a jute macramé hanger.',
  defaultSize: { w: 0.45, d: 0.45, h: 1.0 },
  minSize: { w: 0.3, d: 0.3, h: 0.5 },
  maxSize: { w: 0.8, d: 0.8, h: 1.8 },
  mount: 'ceiling',
  defaultElevation: CEILING_TOP - 1.0,
  slots: [
    matSlot('pot', 'Pot', 'ceramic-white'),
    matSlot('leaf', 'Foliage', 'plant-leaf'),
    matSlot('rope', 'Macramé hanger', 'rug-jute'),
    matSlot('soil', 'Soil', 'plant-soil'),
  ],
  build: (size) => {
    const { w, d, h } = size;
    const m = Math.min(w, d) / 2;
    const lim = limOf(size);
    const potR = Math.min(m * 0.5, 0.14);
    const potH = clamp(h * 0.18, 0.1, 0.18);
    const yP1 = h * 0.64;
    const yP0 = yP1 - potH;
    const top = h - 0.055;
    const o = { plan: false };
    const tl = Math.min(0.12, yP0 * 0.4);
    const parts: Part[] = [
      torus('rope', [0, h - 0.022, 0], 0.016, 0.004, o),
      sphere('rope', [0, top, 0], 0.016, o),
      ...potted('pot', 'soil', [0, yP0, 0], potR, potH, 'bowl'),
      sphere('rope', [0, yP0 - 0.025, 0], 0.014, o),
      vcyl('rope', 0, 0, yP0 - 0.03 - tl, yP0 - 0.03, 0.01, { rTop: 0.005, plan: false }),
    ];
    for (const k of range(4)) {
      const a = (k * Math.PI) / 2 + Math.PI / 4;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const rim: V3 = [c * (potR + 0.004), yP1, s * (potR + 0.004)];
      const knot: V3 = [rim[0] * 0.55, lerp(top, yP1, 0.55), rim[2] * 0.55];
      parts.push(
        ...rodPath(
          'rope',
          [[0, top, 0], knot, rim, [c * potR * 0.9, yP0 + potH * 0.4, s * potR * 0.9], [0, yP0 - 0.025, 0]],
          0.004,
        ),
        sphere('rope', knot, 0.009, o),
      );
    }
    const V = clamp(Math.round(m * 16), 5, 9);
    const ll = clamp(m * 0.22, 0.05, 0.08);
    const rand = rng(23);
    for (const j of range(V)) {
      const a = (2 * Math.PI * j) / V + 0.3;
      const S = Math.sin(a);
      const C = Math.cos(a);
      const yE = lerp(0.03, Math.max(0.05, yP0 * 0.7), rand());
      const r1 = potR + 0.03;
      const r2 = Math.min(m - 0.02, potR + 0.05);
      const pts: V3[] = [
        [S * potR * 0.95, yP1 + 0.005, C * potR * 0.95],
        [S * r1, yP1 - 0.03, C * r1],
        [S * r2, lerp(yP1, yE, 0.55), C * r2],
        [S * r2 * 0.92, yE, C * r2 * 0.92],
      ];
      parts.push(...rodPath('leaf', pts, 0.0025));
      for (const q of range(5)) {
        const P = alongPath(pts, 0.2 + q * 0.2);
        parts.push(blade('leaf', P, ll, ll * 0.75, a + (q % 2 ? 0.9 : -0.9), lerp(1.7, 2.3, rand()), lim, { thick: 0.004 }));
      }
    }
    for (const q of range(8)) {
      const a = (q * Math.PI) / 4;
      parts.push(
        blade('leaf', [Math.sin(a) * potR * 0.5, yP1 - 0.005, Math.cos(a) * potR * 0.5], ll * 1.1, ll * 0.8, a, 1.1, lim, { thick: 0.004 }),
      );
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const m = Math.min(w, d) / 2;
    return [circle([0, 0], Math.min(m * 0.5, 0.14)), poly(ellipsePoints(0, 0, m * 0.85, m * 0.85, 24))];
  },
});

const plantKentiaPalm = defineAsset({
  id: 'plant-kentia-palm',
  name: 'Kentia palm in a sage pot',
  category: 'plants',
  type: 'plants',
  group: 'Indoor plants',
  plant: PLANT_SPECIES['howea-forsteriana'],
  tags: ['kentia', 'palm', 'howea', 'tropical', 'fronds', 'indoor tree'],
  description: 'A Kentia palm with arching fronds of drooping leaflets on dark stalks, in a sage-glazed pot.',
  defaultSize: { w: 1.0, d: 1.0, h: 1.8 },
  minSize: { w: 0.6, d: 0.6, h: 1.0 },
  maxSize: { w: 1.6, d: 1.6, h: 2.6 },
  slots: [
    matSlot('pot', 'Pot', 'ceramic-sage'),
    matSlot('leaf', 'Leaflets', 'plant-leaf'),
    matSlot('stems', 'Stems', 'plant-leaf-dark'),
    matSlot('soil', 'Soil', 'plant-soil'),
  ],
  build: (size) => {
    const { w, d, h } = size;
    const m = Math.min(w, d) / 2;
    const lim = limOf(size);
    const potR = m * 0.36;
    const potH = clamp(h * 0.2, 0.22, 0.42);
    const sy = potH * 0.9;
    const H = h - sy;
    const parts: Part[] = [...potted('pot', 'soil', [0, 0, 0], potR, potH, 'cylinder')];
    const rand = rng(17);
    const lf = clamp(m * 0.4, 0.14, 0.32);
    for (const f of range(7)) {
      const psi = (f * 2 * Math.PI) / 7 + rand() * 0.4;
      const S = Math.sin(psi);
      const C = Math.cos(psi);
      const centre = f === 0;
      const tall = centre ? 1 : lerp(0.65, 0.95, rand());
      const reach = (m - 0.04) * (centre ? 0.25 : lerp(0.75, 1, rand()));
      const pts: V3[] = [
        [S * potR * 0.15, sy, C * potR * 0.15],
        [S * reach * 0.12, sy + H * 0.45 * tall, C * reach * 0.12],
        [S * reach * 0.5, sy + H * 0.88 * tall, C * reach * 0.5],
        [S * reach, sy + H * (centre ? 0.98 : 0.68) * tall, C * reach],
      ];
      parts.push(...rodPath('stems', pts, 0.006));
      for (const q of range(5)) {
        const t = 0.35 + q * 0.15;
        const P = alongPath(pts, t);
        for (const side of [-1, 1]) {
          parts.push(blade('leaf', P, lf * (1 - 0.4 * (t - 0.35)), 0.035, psi + side * 1.25, centre ? 0.9 : 1.95, lim, { thick: 0.004 }));
        }
      }
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const m = Math.min(w, d) / 2;
    return [circle([0, 0], m * 0.36), poly(ellipsePoints(0, 0, m * 0.92, m * 0.92, 24))];
  },
});

const plantOliveTree = defineAsset({
  id: 'plant-olive-tree',
  name: 'Olive tree',
  category: 'plants',
  type: 'plants',
  group: 'Trees',
  plant: PLANT_SPECIES['olea-europaea'],
  tags: ['olive tree', 'mediterranean', 'indoor tree', 'standard tree', 'terracotta'],
  description: 'A small olive tree with a twisted trunk and a crown of narrow silver-green leaves, in a terracotta pot.',
  defaultSize: { w: 0.7, d: 0.7, h: 1.6 },
  minSize: { w: 0.4, d: 0.4, h: 0.9 },
  maxSize: { w: 1.2, d: 1.2, h: 2.4 },
  slots: [
    matSlot('pot', 'Pot', 'terracotta-pot'),
    matSlot('leaf', 'Foliage', 'plant-leaf-light'),
    matSlot('trunk', 'Trunk', 'wood-dark-stain'),
    matSlot('soil', 'Soil', 'plant-soil'),
  ],
  build: ({ w, d, h }) => {
    const m = Math.min(w, d) / 2;
    const potR = m * 0.5;
    const potH = clamp(h * 0.22, 0.2, 0.42);
    const sy = potH * 0.9;
    const fork: V3 = [0.015, h * 0.5, 0.01];
    const parts: Part[] = [
      ...potted('pot', 'soil', [0, 0, 0], potR, potH, 'urn'),
      ...rodPath(
        'trunk',
        [
          [0, sy, 0],
          [0.03, sy + h * 0.12, 0.01],
          [-0.02, h * 0.38, -0.01],
          fork,
        ],
        0.028,
      ),
    ];
    const rc = Math.min(m * 0.6, h * 0.25);
    parts.push(rod('trunk', fork, [0, h - rc, 0], 0.016, { plan: false }), ...blobCluster('leaf', [0, h - rc, 0], rc, 12, 3));
    for (const k of range(3)) {
      const a = (k * 2 * Math.PI) / 3 + 0.5;
      const rs = rc * 0.62;
      const dist = Math.min(m - rs - 0.01, rc * 0.9);
      const c: V3 = [Math.sin(a) * dist, h - rc * 1.25, Math.cos(a) * dist];
      parts.push(
        rod('trunk', fork, [c[0] * 0.7, c[1] - rs * 0.3, c[2] * 0.7], 0.012, { plan: false }),
        ...blobCluster('leaf', c, rs, 7, 10 + k),
      );
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const m = Math.min(w, d) / 2;
    return [circle([0, 0], m * 0.5), poly(ellipsePoints(0, 0, m * 0.9, m * 0.9, 24))];
  },
});

const plantOrchid = defineAsset({
  id: 'plant-orchid',
  name: 'Pink moth orchid',
  category: 'plants',
  type: 'plants',
  group: 'Indoor plants',
  plant: PLANT_SPECIES['phalaenopsis-pink'],
  tags: ['orchid', 'phalaenopsis', 'flowers', 'tabletop', 'blooms'],
  description: 'A pink moth orchid: broad leathery leaves at the base and an arching staked stem of pink blooms, in a white pot of bark.',
  defaultSize: { w: 0.3, d: 0.2, h: 0.55 },
  minSize: { w: 0.15, d: 0.12, h: 0.3 },
  maxSize: { w: 0.45, d: 0.35, h: 0.9 },
  slots: [
    matSlot('pot', 'Pot', 'ceramic-white'),
    matSlot('leaf', 'Leaves & stem', 'plant-leaf-dark'),
    matSlot('flowers', 'Blooms', 'plant-flower-pink'),
    matSlot('soil', 'Bark & stake', 'plant-soil'),
  ],
  build: (size) => {
    const { w, d, h } = size;
    const m = Math.min(w, d) / 2;
    const lim = limOf(size);
    const potR = Math.min(m * 0.75, 0.07);
    const potH = clamp(h * 0.25, 0.08, 0.16);
    const sy = potH * 0.9;
    const parts: Part[] = [...potted('pot', 'soil', [0, 0, 0], potR, potH, 'cylinder')];
    const ll = Math.min((w / 2) * 0.95, 0.2);
    const leaves: V2[] = [
      [Math.PI / 2, 1.2],
      [-Math.PI / 2, 1.25],
      [Math.PI / 2 + 0.5, 1.3],
      [-Math.PI / 2 - 0.45, 1.15],
    ];
    for (const [psi, theta] of leaves) parts.push(blade('leaf', [0, sy + 0.005, 0], ll, ll * 0.36, psi, theta, lim, { thick: 0.008 }));
    const fr = clamp(m * 0.22, 0.022, 0.045);
    const xs0 = -potR * 0.3;
    const xr = w / 2 - fr - 0.01;
    parts.push(vcyl('soil', xs0, -0.012, sy, h * 0.7, 0.003, { plan: false }));
    const pts: V3[] = [
      [xs0, sy, 0],
      [xs0, h * 0.66, -0.005],
      [lerp(xs0, xr, 0.45), h - fr * 1.3 - 0.005, 0.01],
      [xr, h * 0.82 - fr, 0.02],
    ];
    parts.push(...rodPath('leaf', pts, 0.0025));
    for (const q of range(5)) {
      const c = alongPath(pts, 0.45 + q * 0.13);
      const f = fr * (1 - q * 0.08);
      const cz = c[2] + 0.008;
      parts.push(
        sphere('flowers', [c[0], c[1], cz], 0.5, { scale: [f * 2, f * 1.25, f * 0.35], plan: false }),
        sphere('flowers', [c[0], c[1], cz - 0.002], 0.5, { scale: [f, f * 2.1, f * 0.3], plan: false }),
        sphere('flowers', [c[0], c[1] - f * 0.3, cz + f * 0.2], 0.5, { scale: [f * 0.5, f * 0.6, f * 0.5], plan: false }),
      );
    }
    parts.push(sphere('flowers', alongPath(pts, 1), fr * 0.3, { plan: false }));
    return parts;
  },
  planDetail: ({ w, d }) => [circle([0, 0], Math.min((Math.min(w, d) / 2) * 0.75, 0.07))],
});

// ---------------------------------------------------------------------------
// Wall art, mirrors & clocks
// ---------------------------------------------------------------------------

const artwork = defineAsset({
  id: 'artwork-framed',
  name: 'Framed artwork',
  category: 'decor',
  type: 'decor',
  group: 'Wall art',
  tags: ['art', 'picture', 'frame', 'print', 'poster', 'painting'],
  defaultSize: { w: 0.7, d: 0.03, h: 0.5 },
  minSize: { w: 0.2, d: 0.02, h: 0.2 },
  maxSize: { w: 2.4, d: 0.08, h: 1.8 },
  mount: 'wall',
  defaultElevation: 1.3,
  slots: [
    matSlot('frame', 'Frame', 'wood-oak-light'),
    matSlot('mat', 'Mount', 'paint-pure-white'),
    matSlot('art', 'Artwork', 'paper-art'),
  ],
  build: ({ w, d, h }) => {
    const f = clamp(Math.min(w, h) * 0.05, 0.015, 0.05);
    const m = Math.min(w, h) * 0.09;
    const lip = Math.min(0.008, f * 0.3);
    const zm = d / 2 - Math.min(0.012, d * 0.5);
    return [
      ...frame4('frame', [-w / 2, w / 2], [0, h], [-d / 2, d / 2], f, { plan: true }),
      ...frame4('frame', [-w / 2 + f, w / 2 - f], [f, h - f], [-d / 2, zm + 0.004], lip),
      span('mat', [-w / 2 + f + lip, w / 2 - f - lip], [f + lip, h - f - lip], [-d / 2, zm], { plan: false }),
      // Bevel-cut window in the mount, with the print sitting inside it.
      ...frame4('mat', [-w / 2 + f + m - 0.004, w / 2 - f - m + 0.004], [f + m - 0.004, h - f - m + 0.004], [zm, zm + 0.002], 0.004),
      span('art', [-w / 2 + f + m, w / 2 - f - m], [f + m, h - f - m], [zm, zm + 0.0015], { plan: false }),
    ];
  },
});

/** Normalised gallery-wall layout: x/y ranges in 0–1 of the set's width/height. */
const GALLERY: { x: V2; y: V2; wood: boolean; mat: boolean }[] = [
  { x: [0, 0.27], y: [0.42, 1], wood: false, mat: true },
  { x: [0.3, 0.62], y: [0.6, 1], wood: true, mat: false },
  { x: [0.65, 0.82], y: [0.72, 1], wood: false, mat: true },
  { x: [0.85, 1], y: [0.5, 0.9], wood: true, mat: true },
  { x: [0, 0.2], y: [0, 0.37], wood: true, mat: false },
  { x: [0.23, 0.62], y: [0, 0.55], wood: false, mat: true },
  { x: [0.65, 0.82], y: [0.3, 0.67], wood: true, mat: true },
  { x: [0.65, 1], y: [0, 0.25], wood: false, mat: false },
];

const artGalleryWall = defineAsset({
  id: 'art-gallery-wall',
  name: 'Gallery wall set',
  category: 'decor',
  type: 'decor',
  group: 'Wall art',
  tags: ['gallery wall', 'frames', 'prints', 'photos', 'collage', 'art set'],
  defaultSize: { w: 1.6, d: 0.04, h: 1.1 },
  minSize: { w: 0.9, d: 0.02, h: 0.6 },
  maxSize: { w: 3.0, d: 0.08, h: 2.0 },
  mount: 'wall',
  defaultElevation: 1.0,
  slots: [
    matSlot('frame', 'Black frames', 'metal-black-matte'),
    matSlot('frame2', 'Wood frames', 'wood-oak-light'),
    matSlot('mat', 'Mounts', 'paint-pure-white'),
    matSlot('art', 'Prints', 'paper-art'),
  ],
  build: ({ w, d, h }) => {
    const parts: Part[] = [];
    for (const g of GALLERY) {
      const X: V2 = [-w / 2 + g.x[0] * w, -w / 2 + g.x[1] * w];
      const Y: V2 = [g.y[0] * h, g.y[1] * h];
      const fw = X[1] - X[0];
      const fh = Y[1] - Y[0];
      const f = clamp(Math.min(fw, fh) * 0.07, 0.012, 0.03);
      const slot = g.wood ? 'frame2' : 'frame';
      parts.push(...frame4(slot, X, Y, [-d / 2, d / 2], f, { plan: true }));
      const zb = d / 2 - Math.min(0.008, d * 0.4);
      if (g.mat) {
        const mm = Math.min(fw, fh) * 0.13;
        parts.push(
          span('mat', [X[0] + f, X[1] - f], [Y[0] + f, Y[1] - f], [-d / 2, zb], { plan: false }),
          span('art', [X[0] + f + mm, X[1] - f - mm], [Y[0] + f + mm, Y[1] - f - mm], [zb, zb + 0.0015], { plan: false }),
        );
      } else {
        parts.push(span('art', [X[0] + f, X[1] - f], [Y[0] + f, Y[1] - f], [-d / 2, zb], { plan: false }));
      }
    }
    return parts;
  },
});

const artCanvasLarge = defineAsset({
  id: 'art-canvas-large',
  name: 'Large canvas',
  category: 'decor',
  type: 'decor',
  group: 'Wall art',
  tags: ['canvas', 'abstract', 'painting', 'statement art', 'modern art'],
  defaultSize: { w: 1.2, d: 0.04, h: 0.9 },
  minSize: { w: 0.5, d: 0.02, h: 0.4 },
  maxSize: { w: 2.4, d: 0.08, h: 1.8 },
  mount: 'wall',
  defaultElevation: 1.1,
  slots: [
    matSlot('canvas', 'Canvas', 'paint-warm-white'),
    matSlot('paint1', 'Colour 1', 'paint-terracotta'),
    matSlot('paint2', 'Colour 2', 'paint-deep-teal'),
    matSlot('paint3', 'Colour 3', 'paint-ochre'),
  ],
  build: ({ w, d, h }) => {
    const zf = d / 2;
    const s = Math.min(w, h);
    const o = { plan: false };
    const layer = (k: number): V2 => [zf + 0.0005 * k, zf + 0.0005 * k + 0.0015];
    return [
      span('canvas', [-w / 2, w / 2], [0, h], [-d / 2, d / 2], { bevel: 0.003 }),
      span('paint2', [-w * 0.42, -w * 0.05], [h * 0.1, h * 0.46], layer(0), o),
      discZ('paint1', [w * 0.14, h * 0.56, zf + 0.0018], s * 0.26, 0.0016, { segments: 48, plan: false }),
      span('paint3', [-w * 0.3, w * 0.4], [h * 0.72, h * 0.77], layer(2), o),
      discZ('paint2', [-w * 0.27, h * 0.76, zf + 0.0038], s * 0.08, 0.0016, { segments: 32, plan: false }),
      span('paint1', [w * 0.3, w * 0.44], [h * 0.08, h * 0.4], layer(1), o),
      box('paint3', [-w * 0.12, h * 0.3, zf + 0.0045], [s * 0.36, s * 0.035, 0.0015], { rotation: [0, 0, 0.55], plan: false }),
      box('paint3', [w * 0.05, h * 0.24, zf + 0.0045], [s * 0.22, s * 0.025, 0.0015], { rotation: [0, 0, -0.35], plan: false }),
      discZ('canvas', [w * 0.14, h * 0.56, zf + 0.0042], s * 0.1, 0.0016, { segments: 32, plan: false }),
    ];
  },
});

const mirrorRound = defineAsset({
  id: 'mirror-round',
  name: 'Round wall mirror',
  category: 'decor',
  type: 'decor',
  group: 'Mirrors',
  tags: ['mirror', 'round', 'circle', 'hallway', 'bathroom', 'brass'],
  defaultSize: { w: 0.6, d: 0.03, h: 0.6 },
  minSize: { w: 0.3, d: 0.02, h: 0.3 },
  maxSize: { w: 1.2, d: 0.06, h: 1.2 },
  mount: 'wall',
  defaultElevation: 1.3,
  slots: [matSlot('frame', 'Frame', 'metal-brass'), matSlot('mirror', 'Mirror glass', 'glass-mirror')],
  build: ({ w, d, h }) => {
    const R = w / 2;
    const ys = h / w;
    const t = Math.min(clamp(Math.min(w, h) * 0.025, 0.008, 0.02), d / 2 - 0.001);
    const z0 = -d / 2;
    const disc = (slot: string, z: number, r: number, depth: number, plan: boolean): Part =>
      cyl(slot, [0, h / 2, z], r, depth, { rotation: [Math.PI / 2, 0, 0], scale: [1, 1, ys], segments: 48, plan });
    return [
      disc('frame', z0 + 0.004, R - t, 0.008, true),
      disc('mirror', z0 + 0.01, R - t * 1.2, 0.004, false),
      torus('frame', [0, h / 2, z0 + t], R - t, t, { scale: [1, ys, 1] }),
      torus('frame', [0, h / 2, z0 + t], R - t * 2.3, t * 0.35, { scale: [1, ys, 1], plan: false }),
    ];
  },
  planDetail: ({ w, d }) => [line([-w / 2, -d / 2 + 0.012], [w / 2, -d / 2 + 0.012])],
});

const mirrorSunburst = defineAsset({
  id: 'mirror-sunburst',
  name: 'Sunburst mirror',
  category: 'decor',
  type: 'decor',
  group: 'Mirrors',
  tags: ['sunburst', 'starburst', 'mirror', 'mid-century', 'brass', 'statement'],
  defaultSize: { w: 0.8, d: 0.05, h: 0.8 },
  minSize: { w: 0.4, d: 0.03, h: 0.4 },
  maxSize: { w: 1.4, d: 0.1, h: 1.4 },
  mount: 'wall',
  defaultElevation: 1.4,
  slots: [matSlot('frame', 'Rays & frame', 'metal-brass'), matSlot('mirror', 'Mirror glass', 'glass-mirror')],
  build: ({ w, d, h }) => {
    const Rx = w / 2;
    const Ry = h / 2;
    const m = Math.min(Rx, Ry);
    const rm = m * 0.42;
    const z0 = -d / 2;
    const cy = h / 2;
    const tb = Math.min(0.014, rm * 0.08, (d - 0.004) / 2);
    const rr = clamp(m * 0.012, 0.003, 0.008);
    const tipR = clamp(m * 0.03, 0.006, 0.02);
    const zr = z0 + 0.008;
    const parts: Part[] = [
      discZ('frame', [0, cy, z0 + 0.006], rm * 1.1, 0.012, { segments: 48 }),
      discZ('mirror', [0, cy, z0 + 0.014], rm * 0.9, 0.004, { segments: 48, plan: false }),
      torus('frame', [0, cy, z0 + 0.004 + tb], rm * 0.95, tb, { plan: false }),
    ];
    const N = 32;
    for (const k of range(N)) {
      const a = (2 * Math.PI * k) / N;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const long = k % 2 === 0;
      const frac = long ? 1 : 0.62;
      const pad = tipR + 0.005;
      const end: V3 = [c * lerp(rm * 1.05, Rx - pad, frac), cy + s * lerp(rm * 1.05, Ry - pad, frac), zr];
      parts.push(rod('frame', [c * rm * 1.05, cy + s * rm * 1.05, zr], end, long ? rr : rr * 0.7, { plan: false }));
      if (long) parts.push(sphere('frame', end, tipR, { plan: false }));
    }
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w / 2, -d / 2 + 0.01], [w / 2, -d / 2 + 0.01])],
});

const mirrorArched = defineAsset({
  id: 'mirror-arched',
  name: 'Arched wall mirror',
  category: 'decor',
  type: 'decor',
  group: 'Mirrors',
  tags: ['arched mirror', 'arch', 'full length', 'window mirror', 'hallway', 'bedroom'],
  defaultSize: { w: 0.7, d: 0.03, h: 1.4 },
  minSize: { w: 0.4, d: 0.02, h: 0.8 },
  maxSize: { w: 1.2, d: 0.06, h: 2.2 },
  mount: 'wall',
  defaultElevation: 0.5,
  slots: [matSlot('frame', 'Frame', 'metal-black-matte'), matSlot('mirror', 'Mirror glass', 'glass-mirror')],
  build: ({ w, d, h }) => {
    const a = w / 2;
    const yc = h - a;
    const f = clamp(w * 0.04, 0.018, 0.04);
    const backT = d * 0.35;
    const z0 = -d / 2;
    const tr = Math.min(f / 2, (d - backT) / 2 - 0.001);
    const zr = d / 2 - tr;
    const ag = a - f * 0.6;
    const o = { plan: false };
    const arc: V3[] = range(17).map((i) => {
      const t = (Math.PI * i) / 16;
      return [Math.cos(t) * (a - tr), yc + Math.sin(t) * (a - tr), zr];
    });
    return [
      wallPlate('frame', archOutline(a, 0, yc), z0, backT),
      wallPlate('mirror', archOutline(ag, f * 0.6, yc), z0 + backT, 0.003, o),
      vcyl('frame', -a + tr, zr, tr, yc, tr, o),
      vcyl('frame', a - tr, zr, tr, yc, tr, o),
      rodX('frame', -a + tr, a - tr, tr, zr, tr, o),
      sphere('frame', [-a + tr, tr, zr], tr, o),
      sphere('frame', [a - tr, tr, zr], tr, o),
      ...rodPath('frame', arc, tr),
      // Window-pane muntins.
      vcyl('frame', 0, zr, tr, h - tr, tr * 0.5, o),
      rodX('frame', -a + tr, a - tr, yc, zr, tr * 0.5, o),
    ];
  },
  planDetail: ({ w, d }) => [line([-w / 2, -d / 2 + 0.01], [w / 2, -d / 2 + 0.01])],
});

const clockWall = defineAsset({
  id: 'clock-wall',
  name: 'Wall clock',
  category: 'decor',
  type: 'decor',
  group: 'Clocks',
  tags: ['clock', 'wall clock', 'time', 'kitchen', 'station clock'],
  defaultSize: { w: 0.4, d: 0.05, h: 0.4 },
  minSize: { w: 0.2, d: 0.03, h: 0.2 },
  maxSize: { w: 0.9, d: 0.1, h: 0.9 },
  mount: 'wall',
  defaultElevation: 1.7,
  slots: [
    matSlot('case', 'Case', 'metal-black-matte'),
    matSlot('face', 'Dial', 'paint-pure-white'),
    matSlot('hands', 'Hands & markers', 'solid-black'),
    matSlot('second', 'Second hand', 'solid-red'),
  ],
  build: ({ w, d, h }) => {
    const R = Math.min(w, h) / 2;
    const cy = h / 2;
    const z0 = -d / 2;
    const t = Math.min(clamp(R * 0.07, 0.008, 0.025), d / 2 - 0.002);
    const bodyD = d * 0.6;
    const zf = z0 + bodyD + 0.002;
    const parts: Part[] = [
      discZ('case', [0, cy, z0 + bodyD / 2], R - t * 0.5, bodyD, { segments: 48 }),
      torus('case', [0, cy, d / 2 - t], R - t, t, { plan: false }),
      discZ('face', [0, cy, z0 + bodyD + 0.001], R - t * 1.5, 0.002, { segments: 48, plan: false }),
    ];
    for (const k of range(12)) {
      const big = k % 3 === 0;
      const len = big ? R * 0.14 : R * 0.07;
      const rr = R - t * 2 - R * 0.04;
      parts.push(hand('hands', 0, cy, zf + 0.001, (k * Math.PI) / 6, len, big ? R * 0.035 : R * 0.018, -(rr - len), 0.002));
    }
    parts.push(
      hand('hands', 0, cy, zf + 0.004, ((10 + 10 / 60) * Math.PI) / 6, R * 0.55, R * 0.05, R * 0.08, 0.003),
      hand('hands', 0, cy, zf + 0.007, (10 / 60) * 2 * Math.PI, R * 0.8, R * 0.035, R * 0.08, 0.003),
      hand('second', 0, cy, zf + 0.01, 0.6 * 2 * Math.PI, R * 0.95, R * 0.012, R * 0.15, 0.002),
      discZ('hands', [0, cy, zf + 0.012], R * 0.04, 0.006, { plan: false }),
    );
    return parts;
  },
  planDetail: ({ w, h, d }) => {
    const R = Math.min(w, h) / 2;
    return [line([-R, -d / 2 + 0.01], [R, -d / 2 + 0.01])];
  },
});

const clockGrandfather = defineAsset({
  id: 'clock-grandfather',
  name: 'Grandfather clock',
  category: 'decor',
  type: 'decor',
  group: 'Clocks',
  tags: ['grandfather clock', 'longcase', 'pendulum', 'antique', 'heirloom'],
  defaultSize: { w: 0.5, d: 0.28, h: 2.0 },
  minSize: { w: 0.4, d: 0.22, h: 1.7 },
  maxSize: { w: 0.7, d: 0.4, h: 2.3 },
  wallSnap: true,
  slots: [
    matSlot('wood', 'Case', 'wood-walnut'),
    matSlot('face', 'Dial', 'paint-warm-white'),
    matSlot('metal', 'Brass', 'metal-brass'),
    matSlot('glass', 'Glass', 'glass-clear'),
  ],
  build: ({ w, d, h }) => {
    const z0 = -d / 2;
    const yB = h * 0.2;
    const yT = h * 0.68;
    const yH = h * 0.93;
    const tw = w * 0.78;
    const zt = d / 2 - 0.06;
    const o = { plan: false };
    const parts: Part[] = [
      // Plinth, base box with raised panel, and a moulded cap.
      span('wood', [-w / 2, w / 2], [0, 0.05], [z0, d / 2], { bevel: 0.006 }),
      span('wood', [-w / 2 + 0.015, w / 2 - 0.015], [0.05, yB - 0.03], [z0, d / 2 - 0.015]),
      span('wood', [-w / 2 + 0.06, w / 2 - 0.06], [0.1, yB - 0.08], [d / 2 - 0.015, d / 2 - 0.005], { bevel: 0.004, plan: false }),
      span('wood', [-w / 2 + 0.005, w / 2 - 0.005], [yB - 0.03, yB], [z0, d / 2 - 0.005], { bevel: 0.006, plan: false }),
      // Trunk with a glazed door showing the pendulum and weights.
      span('wood', [-tw / 2, tw / 2], [yB, yT], [z0, zt], o),
      ...frame4('wood', [-tw / 2, tw / 2], [yB, yT], [zt, zt + 0.03], 0.04),
      span('glass', [-tw / 2 + 0.04, tw / 2 - 0.04], [yB + 0.04, yT - 0.04], [zt + 0.02, zt + 0.024], o),
      rod('metal', [0, yT - 0.06, zt + 0.012], [0, yB + 0.18, zt + 0.012], 0.004, o),
      discZ('metal', [0, yB + 0.15, zt + 0.012], Math.min(0.07, tw * 0.25), 0.008, { segments: 32, plan: false }),
    ];
    for (const [x, yw] of [
      [-tw * 0.28, yT - 0.3],
      [tw * 0.28, yT - 0.36],
      [-tw * 0.1, yT - 0.24],
    ]) {
      parts.push(
        vcyl('metal', x, zt + 0.006, yw + 0.12, yT - 0.04, 0.0015, o),
        vcyl('metal', x, zt + 0.006, yw - 0.06, yw + 0.12, 0.02, { segments: 16, plan: false }),
      );
    }
    // Hood with brass pillars, glazed dial door and crown.
    const zd = d / 2 - 0.025;
    const Rd = Math.min(w * 0.32, (yH - yT) * 0.4);
    const cy = (yT + yH) / 2;
    parts.push(
      span('wood', [-w / 2 + 0.01, w / 2 - 0.01], [yT, yH], [z0, zd], o),
      discZ('face', [0, cy, zd + 0.002], Rd, 0.004, { segments: 40, plan: false }),
      torus('metal', [0, cy, zd + 0.006], Rd * 0.9, 0.004, o),
      hand('metal', 0, cy, zd + 0.007, ((10 + 10 / 60) * Math.PI) / 6, Rd * 0.5, Rd * 0.06, Rd * 0.06, 0.002),
      hand('metal', 0, cy, zd + 0.009, (10 / 60) * 2 * Math.PI, Rd * 0.75, Rd * 0.045, Rd * 0.06, 0.002),
      discZ('metal', [0, cy, zd + 0.011], Rd * 0.06, 0.004, o),
      ...frame4('wood', [-w / 2 + 0.04, w / 2 - 0.04], [yT + 0.02, yH - 0.02], [d / 2 - 0.008, d / 2], 0.015),
      span('glass', [-w / 2 + 0.055, w / 2 - 0.055], [yT + 0.035, yH - 0.035], [d / 2 - 0.006, d / 2 - 0.003], o),
      vcyl('metal', -(w / 2 - 0.025), d / 2 - 0.014, yT + 0.02, yH - 0.02, 0.012, o),
      vcyl('metal', w / 2 - 0.025, d / 2 - 0.014, yT + 0.02, yH - 0.02, 0.012, o),
      span('wood', [-w / 2, w / 2], [yH, yH + 0.03], [z0, d / 2], { bevel: 0.008, plan: false }),
      span('wood', [-w / 2 + 0.03, w / 2 - 0.03], [yH + 0.03, h - 0.05], [z0, d / 2 - 0.02], { bevel: 0.01, plan: false }),
      sphere('metal', [0, h - 0.025, 0], 0.025, o),
      sphere('metal', [-(w / 2 - 0.06), h - 0.068, 0], 0.018, o),
      sphere('metal', [w / 2 - 0.06, h - 0.068, 0], 0.018, o),
    );
    for (const k of range(12)) {
      parts.push(hand('metal', 0, cy, zd + 0.005, (k * Math.PI) / 6, Rd * 0.1, Rd * 0.03, -(Rd * 0.72), 0.002));
    }
    return parts;
  },
  planDetail: ({ w, d }) => [rectPoly(-w * 0.39, -d / 2, w * 0.39, d / 2 - 0.03)],
});

// ---------------------------------------------------------------------------
// Ornaments & tabletop
// ---------------------------------------------------------------------------

const vase = defineAsset({
  id: 'vase',
  name: 'Vase with stems',
  category: 'decor',
  type: 'decor',
  group: 'Ornaments',
  tags: ['vase', 'flowers', 'stems', 'ceramic', 'centrepiece'],
  defaultSize: { w: 0.3, d: 0.3, h: 0.6 },
  minSize: { w: 0.1, d: 0.1, h: 0.15 },
  maxSize: { w: 0.6, d: 0.6, h: 1.2 },
  slots: [
    matSlot('vase', 'Vase', 'ceramic-white'),
    matSlot('stems', 'Stems & leaves', 'plant-leaf'),
    matSlot('blooms', 'Blooms', 'plant-flower-pink'),
  ],
  build: (size) => {
    const { w, d, h } = size;
    const lim = limOf(size);
    const m = Math.min(w, d) / 2;
    const R = m * 0.55;
    const vh = h * 0.5;
    const br = clamp(Math.min(m * 0.2, h / 10), 0.01, 0.05);
    const ll = clamp(m * 0.4, 0.02, 0.07);
    const parts: Part[] = [
      lathe(
        'vase',
        [0, 0, 0],
        [
          [0, 0],
          [R * 0.5, 0],
          [R * 0.52, vh * 0.03],
          [R * 0.9, vh * 0.2],
          [R, vh * 0.45],
          [R * 0.7, vh * 0.78],
          [R * 0.32, vh * 0.9],
          [R * 0.36, vh * 0.97],
          [R * 0.4, vh],
          [R * 0.33, vh],
        ],
        { segments: 32 },
      ),
    ];
    const tips: [number, number, number][] = [
      [-0.6, 0.15, 0.92],
      [0.62, -0.2, 0.84],
      [0.05, 0.6, 1.0],
      [0.3, -0.65, 0.95],
      [-0.35, -0.45, 0.78],
      [0.55, 0.45, 0.88],
    ];
    const N: V3 = [0, vh * 0.85, 0];
    for (const [u, v, fy] of tips) {
      const x = u * (w / 2 - br * 1.6);
      const z = v * (d / 2 - br * 1.6);
      const ty = clamp(fy * h, vh + br * 2, h - br * 1.3);
      const tip: V3 = [x, ty - br * 0.6, z];
      const P: V3 = [lerp(N[0], tip[0], 0.55), lerp(N[1], tip[1], 0.55), lerp(N[2], tip[2], 0.55)];
      parts.push(
        rod('stems', N, tip, clamp(m * 0.02, 0.002, 0.004), { plan: false }),
        sphere('blooms', [x, ty, z], br, { scale: [1, 0.75, 1], plan: false }),
        sphere('blooms', [x, ty + br * 0.45, z], br * 0.55, { plan: false }),
        blade('stems', P, ll, ll * 0.4, Math.atan2(x, z) + 0.6, 1.0, lim, { thick: 0.003 }),
      );
    }
    return parts;
  },
  planDetail: ({ w, d }) => [circle([0, 0], (Math.min(w, d) / 2) * 0.55)],
});

const books = defineAsset({
  id: 'books-stack',
  name: 'Stack of books',
  category: 'decor',
  type: 'decor',
  group: 'Ornaments',
  tags: ['books', 'stack', 'coffee table books', 'reading', 'magazines'],
  defaultSize: { w: 0.3, d: 0.23, h: 0.14 },
  minSize: { w: 0.15, d: 0.12, h: 0.03 },
  maxSize: { w: 0.5, d: 0.4, h: 0.4 },
  slots: [
    matSlot('books', 'Covers', 'book-mix'),
    matSlot('pages', 'Pages', 'paint-warm-white'),
    matSlot('accent', 'Accent covers', 'fabric-navy'),
  ],
  build: ({ w, d, h }) => {
    const n = clamp(Math.round(h / 0.035), 1, 12);
    const t = h / n;
    const fw = [1, 0.9, 0.96, 0.85, 0.93, 0.88];
    const fd = [1, 0.92, 0.85, 0.95, 0.9, 0.97];
    const ang = [0, 0.09, -0.06, 0.14, -0.1, 0.05];
    const parts: Part[] = [];
    for (const i of range(n)) {
      const a = ang[i % 6];
      const bw = w * fw[i % 6];
      const bd = d * fd[i % 6];
      const c = Math.cos(a);
      const s = Math.sin(a);
      // Shrink rotated books so their footprint stays inside the bounding box.
      const k = Math.min(1, w / (bw * Math.abs(c) + bd * Math.abs(s)), d / (bw * Math.abs(s) + bd * Math.abs(c)));
      const W = bw * k;
      const D = bd * k;
      const T = t - 0.001;
      const y0 = t * i;
      const bt = Math.min(0.003, T * 0.15);
      const cover = i % 3 === 1 ? 'accent' : 'books';
      // Local (x, z) offset → object space for a rotation of `a` about Y.
      const at = (lx: number, y: number, lz: number): V3 => [lx * c + lz * s, y, -lx * s + lz * c];
      const o = { rotation: [0, a, 0] as V3, plan: i === 0 };
      parts.push(
        box(cover, at(0, y0 + bt / 2, 0), [W, bt, D], o),
        box(cover, at(0, y0 + T - bt / 2, 0), [W, bt, D], { ...o, plan: false }),
        box(cover, at(0, y0 + T / 2, D / 2 - bt / 2), [W, T, bt], { ...o, plan: false }),
        box('pages', at(0, y0 + T / 2, (0.003 - bt) / 2), [W - 0.006, Math.max(0.002, T - 2 * bt), D - bt - 0.003], {
          ...o,
          plan: false,
        }),
      );
    }
    return parts;
  },
});

const sculptureAbstract = defineAsset({
  id: 'sculpture-abstract',
  name: 'Abstract sculpture',
  category: 'decor',
  type: 'decor',
  group: 'Ornaments',
  tags: ['sculpture', 'abstract', 'art object', 'ring', 'bronze', 'statue'],
  defaultSize: { w: 0.3, d: 0.2, h: 0.5 },
  minSize: { w: 0.15, d: 0.1, h: 0.2 },
  maxSize: { w: 0.8, d: 0.6, h: 1.6 },
  slots: [matSlot('sculpture', 'Sculpture', 'metal-brass'), matSlot('base', 'Plinth', 'stone-marble-nero')],
  build: ({ w, d, h }) => {
    const bh = clamp(h * 0.1, 0.03, 0.1);
    const H = h - bh;
    const ay = 0.4;
    const ro = Math.min(w / 2 / 1.01, d / 2 / 0.6, H * 0.32);
    const rt = ro * 0.22;
    const yNeck = bh + H * 0.15;
    const yR = yNeck + ro;
    const so = Math.max(0.005, Math.min(ro * 0.45, (h - yR - ro) / 3.1));
    const o = { plan: false };
    return [
      span('base', [-w * 0.4, w * 0.4], [0, bh], [-d * 0.4, d * 0.4], { bevel: 0.004 }),
      vcyl('sculpture', 0, 0, bh, yNeck + rt * 0.5, Math.max(0.006, rt * 0.6), { rTop: Math.max(0.005, rt * 0.4), plan: false }),
      torus('sculpture', [0, yR, 0], ro - rt, rt, { rotation: [0, ay, 0], plan: false }),
      sphere('sculpture', [(ro - 2 * rt) * 0.3, yR - (ro - 2 * rt) * 0.45, 0], rt * 0.9, o),
      sphere('sculpture', [0, yR + ro + so * 1.5, 0], so, { scale: [1, 1.6, 1], plan: false }),
    ];
  },
  planDetail: ({ w, d }) => [rectPoly(-w * 0.4, -d * 0.4, w * 0.4, d * 0.4)],
});

const CANDLE_FRACTIONS = [0.92, 0.65, 0.8, 0.55, 0.72];

const candleSet = defineAsset({
  id: 'candle-set',
  name: 'Candle set',
  category: 'decor',
  type: 'decor',
  group: 'Candles & tabletop',
  tags: ['candles', 'pillar candles', 'tealight', 'cosy', 'hygge', 'centrepiece'],
  defaultSize: { w: 0.3, d: 0.15, h: 0.25 },
  minSize: { w: 0.15, d: 0.08, h: 0.1 },
  maxSize: { w: 0.6, d: 0.3, h: 0.45 },
  slots: [
    matSlot('wax', 'Candles', 'fabric-cream'),
    matSlot('holder', 'Holders & tray', 'metal-brass'),
    matSlot('light', 'Flames', 'light-candle'),
  ],
  light: { color: '#ffb46b', intensity: 0.35, distance: 2, y: 0.22 },
  build: ({ w, d, h }) => {
    const tH = 0.012;
    const n = clamp(Math.round(w / 0.09), 2, 5);
    const cr = Math.min(((w - 0.02) / n) * 0.4, d * 0.32, 0.04);
    const fl = clamp(h * 0.12, 0.02, 0.04);
    const maxC = h - tH - fl - 0.016;
    const parts: Part[] = [span('holder', [-w / 2, w / 2], [0, tH], [-d / 2, d / 2], { bevel: 0.005 })];
    cells(n, -w / 2 + 0.01, w / 2 - 0.01).forEach((x, i) => {
      const ch = maxC * CANDLE_FRACTIONS[i % 5];
      const yTop = tH + 0.008 + ch;
      parts.push(
        cyl('holder', [x, tH + 0.004, 0], cr * 1.25, 0.008, { segments: 24, plan: false }),
        vcyl('wax', x, 0, tH + 0.008, yTop, cr, { segments: 20, plan: false }),
        ring('wax', [x, yTop, 0], cr * 0.8, Math.min(0.004, cr * 0.15), { plan: false }),
        vcyl('holder', x, 0, yTop - 0.004, yTop + 0.008, 0.0012, { plan: false }),
        flame('light', [x, yTop + 0.006, 0], Math.min(0.009, cr * 0.4), fl),
      );
    });
    return parts;
  },
  planDetail: ({ w, d }) => {
    const n = clamp(Math.round(w / 0.09), 2, 5);
    const cr = Math.min(((w - 0.02) / n) * 0.4, d * 0.32, 0.04);
    return cells(n, -w / 2 + 0.01, w / 2 - 0.01).map((x) => circle([x, 0], cr));
  },
});

const trayDecor = defineAsset({
  id: 'tray-decor',
  name: 'Decorative tray',
  category: 'decor',
  type: 'decor',
  group: 'Candles & tabletop',
  tags: ['tray', 'coffee table styling', 'vignette', 'ottoman tray', 'serving tray'],
  defaultSize: { w: 0.45, d: 0.3, h: 0.12 },
  minSize: { w: 0.25, d: 0.18, h: 0.05 },
  maxSize: { w: 0.8, d: 0.5, h: 0.25 },
  slots: [
    matSlot('tray', 'Tray', 'wood-walnut'),
    matSlot('handles', 'Handles', 'metal-brass'),
    matSlot('objects', 'Objects', 'ceramic-white'),
    matSlot('book', 'Book', 'book-mix'),
  ],
  build: ({ w, d, h }) => {
    const hw = 0.035;
    const tx0 = -w / 2 + hw;
    const tx1 = w / 2 - hw;
    const rimH = Math.min(0.035, h * 0.4);
    const ft = 0.01;
    const o = { plan: false };
    const parts: Part[] = [
      span('tray', [tx0, tx1], [0, ft], [-d / 2, d / 2], { bevel: 0.004 }),
      span('tray', [tx0, tx1], [ft, rimH], [-d / 2, -d / 2 + 0.01], { bevel: 0.003, plan: false }),
      span('tray', [tx0, tx1], [ft, rimH], [d / 2 - 0.01, d / 2], { bevel: 0.003, plan: false }),
      span('tray', [tx0, tx0 + 0.01], [ft, rimH], [-d / 2 + 0.01, d / 2 - 0.01], { bevel: 0.003, plan: false }),
      span('tray', [tx1 - 0.01, tx1], [ft, rimH], [-d / 2 + 0.01, d / 2 - 0.01], { bevel: 0.003, plan: false }),
    ];
    for (const s of [-1, 1]) {
      const xe = s * (w / 2 - 0.008);
      const xi = s * (w / 2 - hw);
      const yh = rimH * 0.6;
      parts.push(
        rodZ('handles', xe, yh, -d * 0.18, d * 0.18, 0.006, o),
        rodX('handles', Math.min(xe, xi), Math.max(xe, xi), yh, -d * 0.18, 0.005, o),
        rodX('handles', Math.min(xe, xi), Math.max(xe, xi), yh, d * 0.18, 0.005, o),
      );
    }
    // A little vignette: two books, a bud vase, a candle jar and a bowl of pebbles.
    const iw = tx1 - tx0 - 0.02;
    const avail = h - ft;
    const bt = Math.min(0.025, avail * 0.2);
    const bx0 = tx0 + 0.015;
    const bw = iw * 0.38;
    parts.push(
      span('book', [bx0, bx0 + bw], [ft, ft + bt], [-d * 0.3, d * 0.3], o),
      box('book', [bx0 + bw / 2, ft + bt * 1.5, 0], [bw * 0.8, bt * 0.95, d * 0.48], { rotation: [0, 0.12, 0], plan: false }),
    );
    const vr = Math.min(d * 0.12, 0.04, iw * 0.1);
    parts.push(pot('objects', [tx0 + 0.01 + iw * 0.56, ft, -d * 0.12], vr, Math.min(avail * 0.85, 0.15), 'urn', o));
    const jr = Math.min(d * 0.12, 0.035, iw * 0.1);
    const jx = tx0 + 0.01 + iw * 0.86;
    const jh = Math.min(avail * 0.5, 0.08);
    parts.push(
      vcyl('objects', jx, d * 0.12, ft, ft + jh, jr, { segments: 20, plan: false }),
      vcyl('book', jx, d * 0.12, ft + jh, ft + jh + Math.min(0.012, avail * 0.08), jr * 1.02, { segments: 20, plan: false }),
    );
    const br = Math.min(d * 0.13, iw * 0.09);
    const bxx = tx0 + 0.01 + iw * 0.6;
    const bh = Math.min(avail * 0.4, br * 0.9);
    parts.push(pot('objects', [bxx, ft, d * 0.22], br, bh, 'bowl', o));
    for (const [dx, dz] of [
      [-0.3, 0],
      [0.3, 0.1],
      [0, -0.3],
    ]) {
      parts.push(sphere('handles', [bxx + dx * br, ft + bh * 0.8, d * 0.22 + dz * br], br * 0.3, { scale: [1, 0.6, 1], plan: false }));
    }
    return parts;
  },
  planDetail: ({ w, d }) => [rectPoly(-w / 2 + 0.045, -d / 2 + 0.01, w / 2 - 0.045, d / 2 - 0.01)],
});

// ---------------------------------------------------------------------------
// Screens & fireplaces
// ---------------------------------------------------------------------------

function screenPoints({ w, d }: Size3): V2[] {
  const n = clamp(Math.round(w / 0.5), 3, 6);
  const zz = d / 2 - 0.03;
  return range(n + 1).map((i) => [lerp(-w / 2 + 0.03, w / 2 - 0.03, i / n), i % 2 === 0 ? -zz : zz] as V2);
}

const screenFolding = defineAsset({
  id: 'screen-folding',
  name: 'Folding screen',
  category: 'decor',
  type: 'decor',
  group: 'Screens & dividers',
  tags: ['folding screen', 'room divider', 'paravent', 'rattan', 'privacy'],
  defaultSize: { w: 1.5, d: 0.45, h: 1.75 },
  minSize: { w: 0.9, d: 0.25, h: 1.2 },
  maxSize: { w: 2.6, d: 0.7, h: 2.1 },
  slots: [
    matSlot('frame', 'Frame', 'wood-oak-natural'),
    matSlot('panel', 'Panels', 'rattan-natural'),
    matSlot('hinge', 'Hinges & glides', 'metal-brass'),
  ],
  build: (size) => {
    const { h } = size;
    const P = screenPoints(size);
    const ft = 0.025;
    const sw = 0.04;
    const g = 0.012;
    const yMid = h * 0.62;
    const parts: Part[] = [];
    for (const i of range(P.length - 1)) {
      const [ax, az] = P[i];
      const [bx, bz] = P[i + 1];
      const L = Math.hypot(bx - ax, bz - az);
      const ux = (bx - ax) / L;
      const uz = (bz - az) / L;
      const ry = -Math.atan2(bz - az, bx - ax);
      // Box along the panel from s0 to s1 (metres from its start), y0 to y1, thickness t.
      const seg = (slot: string, s0: number, s1: number, y0: number, y1: number, t: number, plan = false): Part =>
        box(slot, [ax + (ux * (s0 + s1)) / 2, (y0 + y1) / 2, az + (uz * (s0 + s1)) / 2], [s1 - s0, y1 - y0, t], {
          rotation: [0, ry, 0],
          plan,
        });
      const i0 = g + sw;
      const i1 = L - g - sw;
      parts.push(
        seg('frame', g, g + sw, 0.02, h, ft, true),
        seg('frame', L - g - sw, L - g, 0.02, h, ft, true),
        seg('frame', i0, i1, h - 0.05, h, ft),
        seg('frame', i0, i1, 0.02, 0.1, ft),
        seg('frame', i0, i1, yMid - 0.015, yMid + 0.015, ft),
        seg('panel', i0, i1, 0.1, yMid - 0.015, ft * 0.4),
        seg('panel', i0, i1, yMid + 0.015, h - 0.05, ft * 0.4),
        seg('hinge', g + sw * 0.25, g + sw * 0.75, 0, 0.02, ft * 0.8),
        seg('hinge', L - g - sw * 0.75, L - g - sw * 0.25, 0, 0.02, ft * 0.8),
      );
    }
    for (const [x, z] of P.slice(1, -1)) {
      for (const yy of [0.25, 0.6, 0.9]) parts.push(vcyl('hinge', x, z, h * yy - 0.03, h * yy + 0.03, 0.008, { plan: false }));
    }
    return parts;
  },
  planDetail: (size) => [poly(screenPoints(size), false)],
});

const fireplace = defineAsset({
  id: 'fireplace',
  name: 'Fireplace with mantel',
  category: 'decor',
  type: 'decor',
  group: 'Fireplaces',
  tags: ['fireplace', 'mantel', 'hearth', 'fire', 'chimney breast', 'cosy'],
  defaultSize: { w: 1.4, d: 0.35, h: 1.15 },
  minSize: { w: 1.0, d: 0.25, h: 0.9 },
  maxSize: { w: 2.2, d: 0.6, h: 1.5 },
  wallSnap: true,
  slots: [
    matSlot('surround', 'Surround & mantel', 'stone-marble-carrara'),
    matSlot('firebox', 'Firebox & logs', 'metal-anthracite'),
    matSlot('hearth', 'Hearth', 'stone-slate'),
    matSlot('light', 'Fire', 'light-candle'),
  ],
  light: { color: '#ff9440', intensity: 1.2, distance: 4, y: 0.25 },
  build: ({ w, d, h }) => {
    const z0 = -d / 2;
    const hearthH = 0.04;
    const sd = Math.min(0.2, d * 0.6);
    const zs = z0 + sd;
    const shelfY0 = h - 0.05;
    const ow = clamp(w * 0.5, 0.5, 1.0);
    const oh = clamp(h * 0.58, 0.5, 0.8);
    const oy1 = hearthH + oh;
    const px0 = -w / 2 + 0.04;
    const o = { plan: false };
    const parts: Part[] = [
      span('hearth', [-w / 2 + 0.05, w / 2 - 0.05], [0, hearthH], [z0, d / 2], { bevel: 0.005 }),
      span('surround', [-w / 2 + 0.02, w / 2 - 0.02], [shelfY0 - 0.03, shelfY0], [z0, Math.min(d / 2, zs + 0.015)], { bevel: 0.008, plan: false }),
      span('surround', [-w / 2, w / 2], [shelfY0, h], [z0, Math.min(d / 2, zs + 0.06)], { bevel: 0.01 }),
      span('surround', [px0, w / 2 - 0.04], [oy1, shelfY0 - 0.03], [z0, zs]),
      span('surround', [-0.08, 0.08], [oy1 + 0.02, shelfY0 - 0.05], [zs, zs + 0.01], o),
      // Firebox: back, cheeks, lintel and floor.
      span('firebox', [-ow / 2, ow / 2], [hearthH, oy1], [z0, z0 + 0.02], o),
      span('firebox', [-ow / 2, -ow / 2 + 0.02], [hearthH, oy1], [z0, zs], o),
      span('firebox', [ow / 2 - 0.02, ow / 2], [hearthH, oy1], [z0, zs], o),
      span('firebox', [-ow / 2, ow / 2], [oy1 - 0.02, oy1], [z0, zs], o),
      span('firebox', [-ow / 2, ow / 2], [hearthH, hearthH + 0.005], [z0, zs], o),
    ];
    // Pilasters with plinth blocks, raised faces and capitals.
    for (const s of [-1, 1]) {
      const xa = s < 0 ? px0 : ow / 2;
      const xb = s < 0 ? -ow / 2 : w / 2 - 0.04;
      parts.push(
        span('surround', [xa, xb], [hearthH, oy1], [z0, zs]),
        span('surround', [xa - 0.01, xb + 0.01], [hearthH, hearthH + 0.08], [z0, zs + 0.012], { bevel: 0.004, plan: false }),
        span('surround', [xa + 0.025, xb - 0.025], [hearthH + 0.1, oy1 - 0.08], [zs, zs + 0.006], o),
        span('surround', [xa - 0.008, xb + 0.008], [oy1 - 0.05, oy1], [z0, zs + 0.012], { bevel: 0.004, plan: false }),
      );
    }
    // Grate, logs and flames.
    const gy = hearthH + 0.06;
    const lr = Math.min(0.04, sd * 0.18);
    for (const zz of [z0 + sd * 0.35, z0 + sd * 0.65]) {
      parts.push(rodX('firebox', -ow * 0.3, ow * 0.3, gy, zz, 0.006, o));
      for (const x of [-ow * 0.28, ow * 0.28]) parts.push(vcyl('firebox', x, zz, hearthH + 0.005, gy, 0.006, o));
    }
    parts.push(
      rodX('firebox', -ow * 0.28, ow * 0.25, gy + lr, z0 + sd * 0.4, lr, o),
      rodX('firebox', -ow * 0.22, ow * 0.3, gy + lr, z0 + sd * 0.7, lr * 0.9, o),
      rod('firebox', [-ow * 0.2, gy + lr * 2.6, z0 + sd * 0.65], [ow * 0.22, gy + lr * 2.6, z0 + sd * 0.4], lr * 0.85, o),
    );
    const fy = gy + lr * 1.6;
    const maxF = oy1 - 0.04 - fy;
    [0.55, 0.85, 0.7, 0.45].forEach((f, i) => {
      const x = cells(4, -ow * 0.25, ow * 0.25)[i];
      parts.push(flame('light', [x, fy, z0 + sd * (0.45 + 0.1 * (i % 2))], Math.min(0.045, ow * 0.06), Math.max(0.03, maxF * f)));
    });
    return parts;
  },
  planDetail: ({ w, d }) => {
    const z0 = -d / 2;
    const sd = Math.min(0.2, d * 0.6);
    const ow = clamp(w * 0.5, 0.5, 1.0);
    return [rectPoly(-ow / 2, z0 + 0.02, ow / 2, z0 + sd), line([-w / 2 + 0.05, z0 + sd + 0.06], [w / 2 - 0.05, z0 + sd + 0.06])];
  },
});

export const DECOR_ASSETS: AssetDefinition[] = [
  rugRect,
  rugRound,
  rugRunner,
  curtains,
  blindRoller,
  plantPotted,
  plantLarge,
  plantMonstera,
  plantFiddleLeaf,
  plantSnake,
  plantCactus,
  plantSucculents,
  plantHangingPothos,
  plantKentiaPalm,
  plantOliveTree,
  plantOrchid,
  artwork,
  artGalleryWall,
  artCanvasLarge,
  mirrorRound,
  mirrorSunburst,
  mirrorArched,
  clockWall,
  clockGrandfather,
  vase,
  books,
  sculptureAbstract,
  candleSet,
  trayDecor,
  screenFolding,
  fireplace,
  throwCushion,
  throwBlanket,
  floorCushion,
];

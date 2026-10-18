import type { Part } from './types';

/**
 * Coplanar faces between an item's parts: two flat faces on the same plane, facing the same way and
 * overlapping, are drawn at the same depth and flicker against each other ("z-fighting") as the
 * camera moves, worst between parts of different slots (different colours). A grille disc whose top
 * sits exactly on the body's top, a label flush with the panel it is on.
 *
 * Only axis-aligned flat faces are considered: box faces, cylinder and prism caps, and horizontal
 * steps of lathe profiles, on parts whose rotation (if any) is a multiple of 90°. Faces resting on
 * the floor (facing down at y = 0) are never seen and are ignored.
 */

type Vec3 = [number, number, number];

interface Face {
  part: number;
  slot: string;
  /** Axis of the normal (0 x, 1 y, 2 z) and its direction. */
  axis: 0 | 1 | 2;
  sign: 1 | -1;
  plane: number;
  /** Extent on the two other axes, in axis order. */
  a: [number, number];
  b: [number, number];
}

export interface CoplanarClash {
  parts: [number, number];
  slots: [string, string];
  axis: 'x' | 'y' | 'z';
  sign: 1 | -1;
  plane: number;
  /** Overlapping area (m²). */
  area: number;
}

/** Faces closer than this (metres) count as coplanar. */
export const COPLANAR_EPS = 0.0003;
/** Overlaps smaller than this (m², ≈ 5 × 5 mm) are too small to notice. */
export const COPLANAR_MIN_AREA = 25e-6;

function rotate(v: Vec3, [ax, ay, az]: Vec3): Vec3 {
  let [x, y, z] = v;
  [x, y] = [x * Math.cos(az) - y * Math.sin(az), x * Math.sin(az) + y * Math.cos(az)];
  [x, z] = [x * Math.cos(ay) + z * Math.sin(ay), -x * Math.sin(ay) + z * Math.cos(ay)];
  [y, z] = [y * Math.cos(ax) - z * Math.sin(ax), y * Math.sin(ax) + z * Math.cos(ax)];
  return [x, y, z];
}

const quarterTurns = (r: Vec3 | undefined) =>
  !r || r.every((v) => Math.abs(v / (Math.PI / 2) - Math.round(v / (Math.PI / 2))) < 1e-6);

/** Local flat faces: normal axis/sign, plane offset and a rectangle (two corners) on it. */
function localFaces(p: Part): { axis: 0 | 1 | 2; sign: 1 | -1; corners: Vec3[] }[] {
  const rect = (axis: 0 | 1 | 2, sign: 1 | -1, plane: number, ha: [number, number], hb: [number, number]) => {
    const [i, j] = axis === 0 ? [1, 2] : axis === 1 ? [0, 2] : [0, 1];
    const corners: Vec3[] = [];
    for (const u of ha) {
      for (const v of hb) {
        const c: Vec3 = [0, 0, 0];
        c[axis] = plane;
        c[i] = u;
        c[j] = v;
        corners.push(c);
      }
    }
    return { axis, sign, corners };
  };
  switch (p.shape) {
    case 'box': {
      const h = p.size.map((s) => s / 2) as Vec3;
      const out = [];
      for (const axis of [0, 1, 2] as const) {
        const [i, j] = axis === 0 ? [1, 2] : axis === 1 ? [0, 2] : [0, 1];
        for (const sign of [1, -1] as const) out.push(rect(axis, sign, sign * h[axis], [-h[i], h[i]], [-h[j], h[j]]));
      }
      return out;
    }
    case 'cylinder': {
      // A disc, approximated by the square inscribed in it (so rim-to-rim contact is not flagged).
      const k = Math.SQRT1_2;
      const out = [];
      if (p.radiusTop > 1e-4) out.push(rect(1, 1, p.height / 2, [-p.radiusTop * k, p.radiusTop * k], [-p.radiusTop * k, p.radiusTop * k]));
      if (p.radiusBottom > 1e-4) out.push(rect(1, -1, -p.height / 2, [-p.radiusBottom * k, p.radiusBottom * k], [-p.radiusBottom * k, p.radiusBottom * k]));
      return out;
    }
    case 'prism': {
      const xs = p.outline.map((q) => q[0]);
      const zs = p.outline.map((q) => q[1]);
      const ha: [number, number] = [Math.min(...xs), Math.max(...xs)];
      const hb: [number, number] = [Math.min(...zs), Math.max(...zs)];
      return [rect(1, 1, p.height, ha, hb), rect(1, -1, 0, ha, hb)];
    }
    case 'lathe': {
      const out = [];
      const k = Math.SQRT1_2;
      for (let n = 0; n + 1 < p.profile.length; n++) {
        const [r0, y0] = p.profile[n];
        const [r1, y1] = p.profile[n + 1];
        if (Math.abs(y1 - y0) > 1e-7 || Math.abs(r1 - r0) < 1e-4) continue;
        // Profiles run bottom to top: stepping inwards is an upward face, outwards a downward one.
        const r = Math.max(r0, r1) * k;
        out.push(rect(1, r1 < r0 ? 1 : -1, y0, [-r, r], [-r, r]));
      }
      return out;
    }
    default:
      return [];
  }
}

function worldFaces(p: Part, index: number): Face[] {
  if (!quarterTurns(p.rotation)) return [];
  const s = p.scale ?? [1, 1, 1];
  const out: Face[] = [];
  for (const f of localFaces(p)) {
    const pts = f.corners.map((c) => {
      const scaled: Vec3 = [c[0] * s[0], c[1] * s[1], c[2] * s[2]];
      const r = p.rotation ? rotate(scaled, p.rotation) : scaled;
      return [r[0] + p.position[0], r[1] + p.position[1], r[2] + p.position[2]] as Vec3;
    });
    const n0: Vec3 = [0, 0, 0];
    n0[f.axis] = f.sign * Math.sign(s[f.axis] || 1);
    const n = p.rotation ? rotate(n0, p.rotation) : n0;
    const axis = ([0, 1, 2] as const).find((k) => Math.abs(n[k]) > 0.5)!;
    const [i, j] = axis === 0 ? [1, 2] : axis === 1 ? [0, 2] : [0, 1];
    const span = (k: number): [number, number] => [Math.min(...pts.map((q) => q[k])), Math.max(...pts.map((q) => q[k]))];
    const face: Face = { part: index, slot: p.slot, axis, sign: n[axis] > 0 ? 1 : -1, plane: pts[0][axis], a: span(i), b: span(j) };
    if (face.axis === 1 && face.sign === -1 && face.plane < 0.001) continue;
    out.push(face);
  }
  return out;
}

const overlap = (p: [number, number], q: [number, number]) => Math.max(0, Math.min(p[1], q[1]) - Math.max(p[0], q[0]));

/** Coplanar, same-facing, overlapping faces between parts of different slots. */
export function coplanarClashes(parts: Part[], opts: { sameSlot?: boolean } = {}): CoplanarClash[] {
  const faces = parts.flatMap((p, i) => worldFaces(p, i));
  // Bucket by axis, direction and plane so the pair search stays small.
  const buckets = new Map<string, Face[]>();
  const keyOf = (f: Face, plane: number) => `${f.axis}${f.sign}:${Math.round(plane / COPLANAR_EPS)}`;
  for (const f of faces) {
    const k = keyOf(f, f.plane);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(f);
  }
  const out: CoplanarClash[] = [];
  const seen = new Set<string>();
  for (const f of faces) {
    for (const d of [-1, 0, 1]) {
      for (const g of buckets.get(keyOf(f, f.plane + d * COPLANAR_EPS)) ?? []) {
        if (g.part <= f.part || (g.slot === f.slot && !opts.sameSlot)) continue;
        if (Math.abs(g.plane - f.plane) > COPLANAR_EPS) continue;
        const area = overlap(f.a, g.a) * overlap(f.b, g.b);
        if (area < COPLANAR_MIN_AREA) continue;
        const id = `${f.part}/${g.part}/${f.axis}${f.sign}${Math.round(f.plane * 1e4)}`;
        if (seen.has(id)) continue;
        seen.add(id);
        out.push({ parts: [f.part, g.part], slots: [f.slot, g.slot], axis: 'xyz'[f.axis] as 'x' | 'y' | 'z', sign: f.sign, plane: f.plane, area });
      }
    }
  }
  return out;
}

import { isDividerWall } from '@/domain/model/schema';
import * as THREE from 'three';
import type { Project, Vec2, WallSideFinish } from '@/domain/model/schema';
import type { WallGeometry } from '@/domain/geometry/walls';
import { pointAt, slicePath } from '@/domain/geometry/wallPath';
import { add, dist, leftNormal, scale } from '@/domain/geometry/vec';
import type { MaterialRegistry } from './materialRegistry';

import { EXTRAS_DEPTH_BIAS, EXTRAS_DEPTH_SLOPE, biasDepth } from './depthBias';

/**
 * Everything a wall shows besides its solid body:
 * - mouldings and finish bands on each face (skirting, cornice, dado/picture rail, wainscot or
 *   tiled band), interrupted where an opening cuts through their height;
 * - the cap of a half wall;
 * - glass walls (frame, mullions, glazing) and railings (posts, handrail, glass or bar infill),
 *   which have no solid body at all.
 * Built as one mesh per material, in plan space (x, z) like the wall itself.
 */

export interface WallExtrasContext {
  project: Project;
  registry: MaterialRegistry;
  shadows?: boolean;
}

type HeightFn = (s: number) => number;

/** Collects quads (any orientation) and emits a flat-shaded, box-UV'd geometry. */
class Quads {
  pos: number[] = [];
  /** Adds a quad a-b-c-d, wound so its normal points away from `inside`. */
  quad(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, inside: THREE.Vector3) {
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    if (n.lengthSq() < 1e-14) n.subVectors(c, a).cross(new THREE.Vector3().subVectors(d, a));
    const centre = new THREE.Vector3().add(a).add(b).add(c).add(d).multiplyScalar(0.25);
    const flip = n.dot(centre.sub(inside)) < 0;
    const order = flip ? [a, d, c, b] : [a, b, c, d];
    for (const [i, j, k] of [
      [0, 1, 2],
      [0, 2, 3],
    ]) {
      for (const v of [order[i], order[j], order[k]]) this.pos.push(v.x, v.y, v.z);
    }
  }
  geometry(): THREE.BufferGeometry | null {
    if (!this.pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.computeVertexNormals();
    // Box-projected UVs in metres (matches textured wall finishes).
    const p = g.getAttribute('position');
    const n = g.getAttribute('normal');
    const uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) {
      const ax = Math.abs(n.getX(i));
      const ay = Math.abs(n.getY(i));
      const az = Math.abs(n.getZ(i));
      if (ay >= ax && ay >= az) {
        uv[i * 2] = p.getX(i);
        uv[i * 2 + 1] = p.getZ(i);
      } else {
        uv[i * 2] = ax > az ? p.getZ(i) : p.getX(i);
        uv[i * 2 + 1] = p.getY(i);
      }
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.computeBoundingSphere();
    return g;
  }
}

const V = (p: Vec2, y: number) => new THREE.Vector3(p.x, y, p.y);

/** Arc-length position along the wall of each vertex of a polyline covering [s0, s1]. */
function vertexS(pts: Vec2[], s0: number, s1: number): number[] {
  const L = [0];
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + dist(pts[i - 1], pts[i]));
  const total = L[L.length - 1] || 1;
  return L.map((l) => s0 + ((s1 - s0) * l) / total);
}

/**
 * Closed prism between two matching polylines A and B (same vertex count) running along the wall
 * from s0 to s1, from lo(s) up to hi(s).
 */
function prismAlong(q: Quads, A: Vec2[], B: Vec2[], s0: number, s1: number, lo: HeightFn, hi: HeightFn) {
  const n = Math.min(A.length, B.length);
  if (n < 2) return;
  const S = vertexS(A, s0, s1);
  const at = (P: Vec2[], i: number, top: boolean) => V(P[i], top ? hi(S[i]) : lo(S[i]));
  for (let i = 0; i < n - 1; i++) {
    const c = [
      at(A, i, false),
      at(A, i + 1, false),
      at(B, i + 1, false),
      at(B, i, false),
      at(A, i, true),
      at(A, i + 1, true),
      at(B, i + 1, true),
      at(B, i, true),
    ];
    const inside = c.reduce((s, v) => s.add(v), new THREE.Vector3()).multiplyScalar(1 / 8);
    q.quad(c[0], c[1], c[5], c[4], inside); // A face
    q.quad(c[3], c[2], c[6], c[7], inside); // B face
    q.quad(c[4], c[5], c[6], c[7], inside); // top
    q.quad(c[0], c[1], c[2], c[3], inside); // bottom
    if (i === 0) q.quad(c[0], c[3], c[7], c[4], inside);
    if (i === n - 2) q.quad(c[1], c[2], c[6], c[5], inside);
  }
}

/** A strip centred on the wall's centreline: half-width `hw` across the wall, from s0 to s1 along it. */
function centreStrip(
  q: Quads,
  g: WallGeometry,
  s0: number,
  s1: number,
  hw: number,
  lo: HeightFn,
  hi: HeightFn,
) {
  const a = Math.max(0, s0);
  const b = Math.min(g.path.length, s1);
  if (b - a < 1e-4) return;
  prismAlong(q, slicePath(g.path, a, b, hw), slicePath(g.path, a, b, -hw), a, b, lo, hi);
}

/** Offsets a face polyline outward (away from the wall core) by `d`, using the wall normal at each vertex. */
function offsetFace(g: WallGeometry, pts: Vec2[], s0: number, s1: number, side: 1 | -1, d: number): Vec2[] {
  const S = vertexS(pts, s0, s1);
  return pts.map((p, i) => add(p, scale(leftNormal(pointAt(g.path, S[i]).tangent), side * d)));
}

/** Intervals of [0, L] where no opening gap overlaps the height range [lo, hi]. */
function freeIntervals(
  g: WallGeometry,
  lo: number,
  hi: number,
  from = 0,
  to = g.path.length,
): [number, number][] {
  const blocks = g.spans
    .filter((sp) => sp.sill < hi - 1e-4 && sp.head > lo + 1e-4)
    .map((sp) => [sp.s0, sp.s1] as [number, number]);
  blocks.sort((x, y) => x[0] - y[0]);
  const out: [number, number][] = [];
  let cur = from;
  for (const [a, b] of blocks) {
    if (a > cur + 1e-4) out.push([cur, Math.min(a, to)]);
    cur = Math.max(cur, b);
  }
  if (to > cur + 1e-4) out.push([cur, to]);
  return out.filter(([a, b]) => b - a > 1e-3);
}

/** A moulding/band on one face: proud of the face by `depth`, between lo(s) and hi(s), skipping openings. */
function faceLayer(
  q: Quads,
  g: WallGeometry,
  side: 1 | -1,
  depth: number,
  lo: HeightFn,
  hi: HeightFn,
  cut?: number,
) {
  const L = g.path.length;
  const top = (s: number) => (cut !== undefined ? Math.min(hi(s), cut) : hi(s));
  const minLo = Math.min(lo(0), lo(L));
  const maxHi = Math.max(top(0), top(L));
  if (maxHi - minLo < 1e-4) return;
  for (const [a, b] of freeIntervals(g, minLo, maxHi)) {
    const face = g.edge(a, b, side);
    const out = offsetFace(g, face, a, b, side, depth);
    prismAlong(q, face, out, a, b, lo, top);
  }
}

/** Builds the trims for one face. */
function addFinishes(
  get: (id: string) => Quads,
  g: WallGeometry,
  side: 1 | -1,
  f: WallSideFinish,
  cut?: number,
) {
  const z0 = g.z0;
  const below = (y: number) => cut === undefined || y < cut - 1e-4;
  const band = f.band;
  if (band && below(z0)) {
    const hiB = (s: number) => Math.min(z0 + band.height, g.topAt(s));
    faceLayer(get(band.materialId), g, side, band.depth, () => z0, hiB, cut);
    if (band.cap && below(z0 + band.height - 0.03)) {
      faceLayer(get(band.materialId), g, side, band.depth + 0.014, (s) => hiB(s) - 0.03, hiB, cut);
    }
  }
  const sk = f.skirting;
  if (sk && below(z0)) {
    // Skirting stands proud of any band behind it.
    faceLayer(
      get(sk.materialId),
      g,
      side,
      sk.depth + (band ? band.depth : 0),
      () => z0,
      (s) => Math.min(z0 + sk.height, g.topAt(s)),
      cut,
    );
  }
  const rail = f.rail;
  if (rail) {
    const lo = z0 + rail.y - rail.height / 2;
    if (below(lo))
      faceLayer(
        get(rail.materialId),
        g,
        side,
        rail.depth + (band && rail.y <= band.height ? band.depth : 0),
        () => lo,
        (s) => Math.min(lo + rail.height, g.topAt(s)),
        cut,
      );
  }
  const co = f.cornice;
  if (co) {
    const lo = (s: number) => g.topAt(s) - co.height;
    if (below(Math.min(lo(0), lo(g.path.length))))
      faceLayer(get(co.materialId), g, side, co.depth, lo, g.topAt, cut);
  }
}

/** Evenly spaced positions in (a, b) no further apart than `max`, excluding the ends. */
function divisions(a: number, b: number, max: number): number[] {
  const n = Math.max(1, Math.ceil((b - a) / max));
  const out: number[] = [];
  for (let i = 1; i < n; i++) out.push(a + ((b - a) * i) / n);
  return out;
}

/**
 * Where a wall is actually visible along its path: a wall that butts into another (a T-junction) or
 * ends inside a thicker one starts and ends at that wall's face, not at the node in its middle.
 * Frames, posts and rails stay within this range, so they never run into (and fight with) the
 * wall they meet.
 */
function visibleRange(g: WallGeometry): [number, number] {
  const L = g.path.length;
  const t0 = g.path.samples[0].tangent;
  const t1 = g.path.samples[g.path.samples.length - 1].tangent;
  const a = g.path.samples[0].p;
  const b = g.path.samples[g.path.samples.length - 1].p;
  const along = (p: { x: number; y: number }, o: { x: number; y: number }, t: { x: number; y: number }) =>
    (p.x - o.x) * t.x + (p.y - o.y) * t.y;
  const s0 = Math.max(0, Math.min(along(g.startLeft, a, t0), along(g.startRight, a, t0)));
  const s1 = Math.max(0, Math.min(along(b, g.endLeft, t1), along(b, g.endRight, t1)));
  return s0 + s1 < L - 0.05 ? [s0, L - s1] : [0, L];
}

/** A piece's range clipped to the wall's visible range (null when nothing is left). */
function clipPiece(g: WallGeometry, s0: number, s1: number): [number, number] | null {
  const [v0, v1] = visibleRange(g);
  const a = Math.max(s0, v0);
  const b = Math.min(s1, v1);
  return b - a > 0.01 ? [a, b] : null;
}

function addGlassWall(frame: Quads, glass: Quads, g: WallGeometry, cut?: number) {
  const hw = Math.min(g.h, 0.035);
  const post = 0.05;
  for (const raw of g.pieces) {
    const clipped = clipPiece(g, raw.s0, raw.s1);
    if (!clipped) continue;
    const pc = { ...raw, s0: clipped[0], s1: clipped[1] };
    const lo = pc.z0;
    const hiRaw = (s: number) => (pc.kind === 'below' ? pc.z1 : g.topAt(s));
    const hi = (s: number) => (cut !== undefined ? Math.min(hiRaw(s), cut) : hiRaw(s));
    if (Math.max(hi(pc.s0), hi(pc.s1)) - lo < 0.02) continue;
    const rail = Math.min(0.05, (hi(pc.s0) - lo) / 4);
    centreStrip(
      frame,
      g,
      pc.s0,
      pc.s1,
      hw,
      () => lo,
      () => lo + rail,
    );
    if (cut === undefined || hiRaw(pc.s0) <= cut)
      centreStrip(frame, g, pc.s0, pc.s1, hw, (s) => hi(s) - rail, hi);
    for (const s of [pc.s0 + post / 2, pc.s1 - post / 2, ...divisions(pc.s0, pc.s1, 1.2)]) {
      centreStrip(frame, g, s - post / 2, s + post / 2, hw, () => lo, hi);
    }
    centreStrip(
      glass,
      g,
      pc.s0,
      pc.s1,
      0.006,
      () => lo + rail,
      (s) => hi(s) - rail,
    );
  }
}

function addRailing(frame: Quads, infill: Quads, g: WallGeometry, glassInfill: boolean, cut?: number) {
  const hiRaw = g.topAt;
  const hi = (s: number) => (cut !== undefined ? Math.min(hiRaw(s), cut) : hiRaw(s));
  for (const raw of g.planPieces) {
    const clipped = clipPiece(g, raw.s0, raw.s1);
    if (!clipped) continue;
    const pc = { ...raw, s0: clipped[0], s1: clipped[1] };
    const lo = pc.z0;
    const ends = [pc.s0 + 0.03, pc.s1 - 0.03];
    const posts = [ends[0], ...divisions(ends[0], ends[1], 1.4), ends[1]];
    for (const s of posts) centreStrip(frame, g, s - 0.025, s + 0.025, 0.025, () => lo, hi);
    // Handrail along the top (only when it is below the cut).
    if (cut === undefined || Math.min(hiRaw(pc.s0), hiRaw(pc.s1)) <= cut) {
      centreStrip(frame, g, pc.s0, pc.s1, 0.03, (s) => hiRaw(s) - 0.045, hiRaw);
    }
    if (glassInfill) {
      centreStrip(
        frame,
        g,
        pc.s0,
        pc.s1,
        0.03,
        () => lo,
        () => lo + 0.06,
      );
      for (let i = 0; i < posts.length - 1; i++) {
        centreStrip(
          infill,
          g,
          posts[i] + 0.04,
          posts[i + 1] - 0.04,
          0.006,
          () => lo + 0.06,
          (s) => hi(s) - 0.07,
        );
      }
    } else {
      centreStrip(
        frame,
        g,
        pc.s0,
        pc.s1,
        0.015,
        () => lo + 0.08,
        () => lo + 0.11,
      );
      for (let i = 0; i < posts.length - 1; i++) {
        for (const s of divisions(posts[i], posts[i + 1], 0.11))
          centreStrip(
            infill,
            g,
            s - 0.007,
            s + 0.007,
            0.007,
            () => lo + 0.11,
            (x) => hi(x) - 0.045,
          );
      }
    }
  }
}

function addHalfWallCap(q: Quads, g: WallGeometry, cut?: number) {
  const over = 0.02;
  for (const pc of g.planPieces) {
    if (cut !== undefined && Math.min(g.topAt(pc.s0), g.topAt(pc.s1)) > cut) continue;
    const left = offsetFace(g, pc.left, pc.s0, pc.s1, 1, over);
    const right = offsetFace(g, pc.right, pc.s0, pc.s1, -1, over);
    prismAlong(
      q,
      left,
      right,
      pc.s0,
      pc.s1,
      (s) => g.topAt(s) - 0.035,
      (s) => g.topAt(s) + 0.005,
    );
  }
}

/** True when a wall needs an extras group (anything beyond a plain solid body). */
export function wallHasExtras(g: WallGeometry): boolean {
  const w = g.wall;
  if (isDividerWall(w)) return false;
  if (w.style && w.style !== 'solid') return true;
  const f = w.finishes;
  const any = (x?: WallSideFinish) => !!x && !!(x.skirting || x.cornice || x.rail || x.band);
  return any(f?.left) || any(f?.right);
}

/** Stable key of everything the extras depend on (rebuild only when it changes). */
export function wallExtrasKey(g: WallGeometry, cut?: number): string {
  const r = (n: number) => Math.round(n * 1000);
  const spans = g.spans.map((s) => `${r(s.s0)},${r(s.s1)},${r(s.sill)},${r(s.head)}`).join(';');
  const edge = [g.startLeft, g.startRight, g.endLeft, g.endRight].map((p) => `${r(p.x)},${r(p.y)}`).join(';');
  const w = g.wall;
  return `${cut ?? ''}|${w.style ?? ''}|${w.thickness}|${w.height}|${w.heightEnd ?? ''}|${w.baseElevation}|${JSON.stringify(w.finishes ?? null)}|${w.materials.top}|${w.styleMaterialId ?? ''}|${JSON.stringify(w.curve)}|${JSON.stringify(w.curveEnd ?? null)}|${edge}|${spans}`;
}

/** The extras group for a wall, or null when it has none. Caller disposes geometries (see disposeWallExtras). */
export function buildWallExtras(g: WallGeometry, ctx: WallExtrasContext, cut?: number): THREE.Group | null {
  if (!wallHasExtras(g)) return null;
  const w = g.wall;
  const byMat = new Map<string, Quads>();
  const get = (id: string) => {
    let q = byMat.get(id);
    if (!q) byMat.set(id, (q = new Quads()));
    return q;
  };
  const style = w.style ?? 'solid';
  if (style === 'solid' || style === 'half') {
    if (w.finishes?.left) addFinishes(get, g, 1, w.finishes.left, cut);
    if (w.finishes?.right) addFinishes(get, g, -1, w.finishes.right, cut);
    if (style === 'half') addHalfWallCap(get(w.materials.top), g, cut);
  } else if (style === 'glass') {
    addGlassWall(get(w.materials.top), get(w.styleMaterialId ?? 'glass-clear'), g, cut);
  } else {
    const glassInfill = style === 'railing-glass';
    addRailing(
      get(w.materials.top),
      get(w.styleMaterialId ?? (glassInfill ? 'glass-clear' : w.materials.top)),
      g,
      glassInfill,
      cut,
    );
  }
  const group = new THREE.Group();
  group.userData = { kind: 'wall', id: w.id };
  const shadows = ctx.shadows ?? true;
  for (const [id, q] of byMat) {
    const geo = q.geometry();
    if (!geo) continue;
    const mesh = new THREE.Mesh(geo, ctx.registry.get(ctx.project, id));
    mesh.castShadow = shadows;
    mesh.receiveShadow = shadows;
    mesh.userData = { kind: 'wall', id: w.id };
    // Trim loses depth ties: where a frame, rail or moulding meets an object or wall it is the part
    // buried inside (a glass frame running into a column), so the other surface shows.
    biasDepth(mesh, EXTRAS_DEPTH_BIAS, EXTRAS_DEPTH_SLOPE);
    group.add(mesh);
  }
  return group.children.length ? group : null;
}

export function disposeWallExtras(group: THREE.Group | null): void {
  group?.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) m.geometry.dispose();
  });
}

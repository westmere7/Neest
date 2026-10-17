import type { Project, Vec2 } from '../model/schema';
import {
  cleanPolygon,
  isSelfIntersecting,
  labelPoint,
  offsetPolygonEdges,
  pointInPolygon,
  polygonArea,
  polygonPerimeter,
  signedArea,
  type Polygon,
} from './polygon';
import { buildWallPath } from './wallPath';
import { angleOf, dist, sub } from './vec';

/** A closed region of the wall network, detected as a bounded planar face. */
export interface RoomFace {
  /** Deterministic key derived from the sorted boundary vertices. */
  key: string;
  /** Centreline boundary (positive signed area). */
  centerline: Polygon;
  /** Boundary inset by each wall's half thickness: the clear floor polygon. */
  inner: Polygon;
  /** Clear-floor holes (e.g. free-standing wall islands inside the room). */
  holes: Polygon[];
  wallIds: string[];
  area: number;
  perimeter: number;
  label: Vec2;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  /** True when the inset failed and the centreline polygon is used instead. */
  degraded: boolean;
}

interface HalfEdge {
  from: string;
  to: string;
  wallId: string;
  angle: number;
}

const MIN_ROOM_AREA = 0.04;

/**
 * Detects rooms as bounded faces of the planar wall graph. Dangling wall
 * stubs are pruned first; islands become holes of their enclosing room.
 */
export function detectRoomFaces(project: Pick<Project, 'walls' | 'nodes'>): RoomFace[] {
  const pos = new Map<string, Vec2>();
  const halfThickness = new Map<string, number>();
  const adjacency = new Map<string, HalfEdge[]>();
  const addEdge = (u: string, v: string, wallId: string) => {
    if (u === v) return;
    const pu = pos.get(u)!;
    const pv = pos.get(v)!;
    if (dist(pu, pv) < 1e-6) return;
    if (!adjacency.has(u)) adjacency.set(u, []);
    if (!adjacency.has(v)) adjacency.set(v, []);
    // Ignore duplicate edges between the same vertices.
    if (adjacency.get(u)!.some((e) => e.to === v)) return;
    adjacency.get(u)!.push({ from: u, to: v, wallId, angle: angleOf(sub(pv, pu)) });
    adjacency.get(v)!.push({ from: v, to: u, wallId, angle: angleOf(sub(pu, pv)) });
  };

  for (const n of Object.values(project.nodes)) pos.set(n.id, { x: n.x, y: n.y });
  for (const w of Object.values(project.walls)) {
    const a = project.nodes[w.a];
    const b = project.nodes[w.b];
    if (!a || !b) continue;
    halfThickness.set(w.id, w.thickness / 2);
    const path = buildWallPath(a, b, w.curve);
    if (path.samples.length === 2) {
      addEdge(w.a, w.b, w.id);
    } else {
      let prev = w.a;
      for (let i = 1; i < path.samples.length - 1; i++) {
        const vid = `${w.id}#${i}`;
        pos.set(vid, path.samples[i].p);
        addEdge(prev, vid, w.id);
        prev = vid;
      }
      addEdge(prev, w.b, w.id);
    }
  }

  // Prune filaments (dangling stubs) iteratively.
  let pruned = true;
  while (pruned) {
    pruned = false;
    for (const [vid, edges] of adjacency) {
      if (edges.length <= 1) {
        for (const e of edges) {
          const back = adjacency.get(e.to);
          if (back) adjacency.set(e.to, back.filter((x) => x.to !== vid));
        }
        adjacency.delete(vid);
        pruned = true;
      }
    }
  }

  for (const edges of adjacency.values()) edges.sort((x, y) => x.angle - y.angle);

  const visited = new Set<string>();
  const ek = (e: HalfEdge) => `${e.from}>${e.to}`;
  const loops: { verts: string[]; walls: string[] }[] = [];
  for (const edges of adjacency.values()) {
    for (const start of edges) {
      if (visited.has(ek(start))) continue;
      const verts: string[] = [];
      const walls: string[] = [];
      let e: HalfEdge | undefined = start;
      let guard = 0;
      while (e && !visited.has(ek(e)) && guard++ < 100000) {
        visited.add(ek(e));
        verts.push(e.from);
        walls.push(e.wallId);
        const out: HalfEdge[] = adjacency.get(e.to) ?? [];
        const from: string = e.from;
        const idx = out.findIndex((x) => x.to === from);
        if (idx < 0) break;
        e = out[(idx - 1 + out.length) % out.length];
      }
      if (verts.length >= 3) loops.push({ verts, walls });
    }
  }

  const bounded: { poly: Polygon; walls: string[]; verts: string[] }[] = [];
  const outers: { poly: Polygon; walls: string[] }[] = [];
  for (const loop of loops) {
    const poly = loop.verts.map((v) => pos.get(v)!);
    const a = signedArea(poly);
    if (a > MIN_ROOM_AREA) bounded.push({ poly, walls: loop.walls, verts: loop.verts });
    else if (a < 0) outers.push({ poly, walls: loop.walls });
  }

  // Assign each component outer boundary that sits inside a bounded face as a hole.
  const holesFor = new Map<number, { poly: Polygon; walls: string[] }[]>();
  for (const o of outers) {
    const probe = o.poly[0];
    let bestIdx = -1;
    let bestArea = Infinity;
    bounded.forEach((f, i) => {
      if (f.poly.some((p) => dist(p, probe) < 1e-9)) return;
      const area = polygonArea(f.poly);
      if (area < bestArea && pointInPolygon(probe, f.poly)) {
        bestArea = area;
        bestIdx = i;
      }
    });
    if (bestIdx >= 0) {
      if (!holesFor.has(bestIdx)) holesFor.set(bestIdx, []);
      holesFor.get(bestIdx)!.push(o);
    }
  }

  return bounded.map((f, i) => {
    const holeLoops = holesFor.get(i) ?? [];
    let degraded = false;
    const insetLoop = (poly: Polygon, walls: string[], expectPositive: boolean) => {
      const inset = cleanPolygon(offsetPolygonEdges(poly, walls.map((w) => -(halfThickness.get(w) ?? 0))));
      const ok =
        inset.length >= 3 &&
        !isSelfIntersecting(inset) &&
        (expectPositive ? signedArea(inset) > 0 : signedArea(inset) < 0);
      if (!ok) degraded = true;
      return ok ? inset : poly;
    };
    const inner = insetLoop(f.poly, f.walls, true);
    const holes = holeLoops.map((h) => insetLoop(h.poly, h.walls, false));
    const area = Math.max(0, polygonArea(inner) - holes.reduce((s, h) => s + polygonArea(h), 0));
    const perimeter = polygonPerimeter(inner) + holes.reduce((s, h) => s + polygonPerimeter(h), 0);
    const xs = inner.map((p) => p.x);
    const ys = inner.map((p) => p.y);
    const wallIds = [...new Set([...f.walls, ...holeLoops.flatMap((h) => h.walls)])].sort();
    const key = [...f.verts].sort().join('|');
    return {
      key,
      centerline: f.poly,
      inner,
      holes,
      wallIds,
      area,
      perimeter,
      label: labelPoint(inner, holes),
      bounds: { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) },
      degraded,
    };
  });
}

export function pointInFace(p: Vec2, face: RoomFace): boolean {
  return pointInPolygon(p, face.centerline) && !face.holes.some((h) => pointInPolygon(p, h));
}

export function jaccard(a: string[], b: string[]): number {
  if (!a.length && !b.length) return 0;
  const sa = new Set(a);
  let inter = 0;
  for (const x of b) if (sa.has(x)) inter++;
  return inter / (sa.size + b.length - inter);
}

/**
 * Matches detected faces to stored room records by anchor containment and
 * boundary-wall overlap. Returns face index → room id.
 */
export function matchFacesToRooms(
  faces: RoomFace[],
  rooms: Project['rooms'],
): Map<number, string> {
  const pairs: { fi: number; rid: string; score: number }[] = [];
  const records = Object.values(rooms);
  faces.forEach((f, fi) => {
    for (const r of records) {
      const inside = pointInFace(r.anchor, f) ? 1 : 0;
      const score = inside + jaccard(f.wallIds, r.boundaryWallIds);
      if (score >= 0.34) pairs.push({ fi, rid: r.id, score });
    }
  });
  pairs.sort((x, y) => y.score - x.score || x.fi - y.fi || x.rid.localeCompare(y.rid));
  const usedF = new Set<number>();
  const usedR = new Set<string>();
  const out = new Map<number, string>();
  for (const p of pairs) {
    if (usedF.has(p.fi) || usedR.has(p.rid)) continue;
    usedF.add(p.fi);
    usedR.add(p.rid);
    out.set(p.fi, p.rid);
  }
  return out;
}

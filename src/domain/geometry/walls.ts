import { isDividerWall, type Opening, type Project, type Vec2, type WallNode, type WallSegment } from '../model/schema';
import type { Polygon } from './polygon';
import { signedArea } from './polygon';
import { buildWallPath, pointAt, slicePath, type WallPath } from './wallPath';
import { add, angleDelta, angleOf, dist, dot, leftNormal, lineIntersection, scale, sub } from './vec';

/** Minimum distance between an opening and a wall end/junction corner. */
export const OPENING_END_MARGIN = 0.02;

export interface OpeningSpan {
  id: string;
  s0: number;
  s1: number;
  center: number;
  sill: number;
  head: number;
  /** True when the stored position/width had to be clamped to fit the wall. */
  clamped: boolean;
}

export interface WallPiece {
  s0: number;
  s1: number;
  z0: number;
  z1: number;
  /** Left edge points from s0 to s1. */
  left: Vec2[];
  /** Right edge points from s0 to s1. */
  right: Vec2[];
  kind: 'solid' | 'below' | 'above';
  /** True when the piece's s0 end is the wall's start (a mitred or capped end). */
  atStart: boolean;
  atEnd: boolean;
}

export interface WallGeometry {
  wall: WallSegment;
  path: WallPath;
  /** Half thickness. */
  h: number;
  startLeft: Vec2;
  startRight: Vec2;
  endLeft: Vec2;
  endRight: Vec2;
  /** Full left and right edges from start corner to end corner. */
  left: Vec2[];
  right: Vec2[];
  footprint: Polygon;
  /** Arc-length range in which openings may be placed. */
  clearStart: number;
  clearEnd: number;
  spans: OpeningSpan[];
  /** Plan-view solid intervals (no opening) as polygons. */
  planPieces: WallPiece[];
  /** 3D pieces: full-height solid intervals plus below-sill/above-head pieces. */
  pieces: WallPiece[];
  startFree: boolean;
  endFree: boolean;
  z0: number;
  /** Top height at the wall start (node a). For level walls this is the top everywhere. */
  z1: number;
  /** Top height at arc length s (differs from z1 only for sloped walls). */
  topAt: (s: number) => number;
  sloped: boolean;
  /** One face of the wall (+1 left, -1 right) between arc lengths s0 and s1, using mitred end corners. */
  edge: (s0: number, s1: number, side: 1 | -1) => Vec2[];
}

export interface JunctionHub {
  nodeId: string;
  polygon: Polygon;
  z0: number;
  z1: number;
}

export interface WallNetwork {
  walls: Map<string, WallGeometry>;
  hubs: JunctionHub[];
  /** Wall ids per node. */
  nodeWalls: Map<string, string[]>;
}

interface EndInfo {
  wallId: string;
  atStart: boolean;
  dir: Vec2;
  h: number;
  angle: number;
  oLeft?: Vec2;
  oRight?: Vec2;
  beveled?: boolean;
}

const MITER_LIMIT = 6;

export function wallPathFor(wall: WallSegment, nodes: Record<string, WallNode>): WallPath | null {
  const a = nodes[wall.a];
  const b = nodes[wall.b];
  if (!a || !b) return null;
  return buildWallPath(a, b, wall.curve, wall.curveEnd);
}

export function wallLength(wall: WallSegment, nodes: Record<string, WallNode>): number {
  return wallPathFor(wall, nodes)?.length ?? 0;
}

/** Map of node id → incident wall ids (in insertion order). */
export function buildNodeWalls(project: Pick<Project, 'walls'>): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const w of Object.values(project.walls)) {
    if (!m.has(w.a)) m.set(w.a, []);
    if (!m.has(w.b)) m.set(w.b, []);
    m.get(w.a)!.push(w.id);
    if (w.b !== w.a) m.get(w.b)!.push(w.id);
  }
  return m;
}

/** Computes mitred/joined wall outlines, opening spans, and junction hubs. */
export function computeWallNetwork(project: Pick<Project, 'walls' | 'nodes' | 'openings'>): WallNetwork {
  const paths = new Map<string, WallPath>();
  for (const w of Object.values(project.walls)) {
    const p = wallPathFor(w, project.nodes);
    if (p && p.length > 1e-6) paths.set(w.id, p);
  }
  const nodeWalls = buildNodeWalls(project);
  const corners = new Map<string, { left: Vec2; right: Vec2; free: boolean }>();
  const hubs: JunctionHub[] = [];

  for (const [nodeId, wallIds] of nodeWalls) {
    const node = project.nodes[nodeId];
    if (!node) continue;
    const ends: EndInfo[] = [];
    // Invisible room dividers take no part in the junction: the built walls mitre as if they were
    // not there, and the dividers just get square ends (no hub, no free end cap).
    const dividerEnds: EndInfo[] = [];
    for (const wid of wallIds) {
      const w = project.walls[wid];
      const path = paths.get(wid);
      if (!w || !path) continue;
      const atStart = w.a === nodeId;
      const smp = atStart ? path.samples[0] : path.samples[path.samples.length - 1];
      const dir = atStart ? smp.tangent : scale(smp.tangent, -1);
      (isDividerWall(w) ? dividerEnds : ends).push({ wallId: wid, atStart, dir, h: w.thickness / 2, angle: angleOf(dir) });
    }
    for (const e of dividerEnds) {
      const ln = leftNormal(e.dir);
      const left = add(node, scale(ln, e.h));
      const right = add(node, scale(ln, -e.h));
      corners.set(`${e.wallId}:${e.atStart ? 's' : 'e'}`, { left: e.atStart ? left : right, right: e.atStart ? right : left, free: false });
    }
    if (ends.length === 0) continue;
    ends.sort((x, y) => x.angle - y.angle);
    const N: Vec2 = node;
    if (ends.length === 1) {
      const e = ends[0];
      const ln = leftNormal(e.dir);
      e.oLeft = add(N, scale(ln, e.h));
      e.oRight = add(N, scale(ln, -e.h));
    } else {
      for (let i = 0; i < ends.length; i++) {
        const E = ends[i];
        const F = ends[(i + 1) % ends.length];
        const gap = ends.length === 2 && i === 1 ? angleDelta(E.angle, F.angle) : angleDelta(E.angle, F.angle);
        const eRightPt = add(N, scale(leftNormal(E.dir), -E.h));
        const fLeftPt = add(N, scale(leftNormal(F.dir), F.h));
        const nearParallel = gap < 0.02 || Math.abs(gap - Math.PI) < 0.02 || gap > Math.PI * 2 - 0.02;
        let X: Vec2 | null = null;
        if (!nearParallel) X = lineIntersection(eRightPt, E.dir, fLeftPt, F.dir);
        if (X && dist(X, N) <= MITER_LIMIT * Math.max(E.h, F.h)) {
          E.oRight = X;
          F.oLeft = X;
        } else {
          E.oRight = eRightPt;
          F.oLeft = fLeftPt;
          if (!nearParallel || gap < 0.02) {
            E.beveled = true;
            F.beveled = true;
          }
        }
      }
    }
    // T-junctions: a wall running straight through the node (two collinear ends of the same
    // thickness) stays one continuous surface with square, flush ends, and every other wall butts
    // against its face. Mitring the through-wall instead left slanted ends and a triangular hub
    // between them, which showed as a spike in the plan and hairline seams in 3D.
    const through = ends.length >= 3 ? throughPair(ends) : null;
    if (through) {
      const [a, b] = through;
      for (const e of [a, b]) {
        const ln = leftNormal(e.dir);
        e.oLeft = add(N, scale(ln, e.h));
        e.oRight = add(N, scale(ln, -e.h));
        e.beveled = false;
      }
      const an = leftNormal(a.dir);
      for (const e of ends) {
        if (e === a || e === b) continue;
        const side = Math.sign(dot(e.dir, an)) || 1;
        const face = add(N, scale(an, side * a.h));
        const ln = leftNormal(e.dir);
        const l = lineIntersection(add(N, scale(ln, e.h)), e.dir, face, a.dir);
        const r = lineIntersection(add(N, scale(ln, -e.h)), e.dir, face, a.dir);
        if (l && r && dist(l, N) <= MITER_LIMIT * Math.max(a.h, e.h) && dist(r, N) <= MITER_LIMIT * Math.max(a.h, e.h)) {
          e.oLeft = l;
          e.oRight = r;
          e.beveled = false;
        }
      }
    }
    for (const e of ends) {
      const key = `${e.wallId}:${e.atStart ? 's' : 'e'}`;
      // Oriented left/right (leaving the node) → global left/right (a→b).
      const left = e.atStart ? e.oLeft! : e.oRight!;
      const right = e.atStart ? e.oRight! : e.oLeft!;
      corners.set(key, { left, right, free: ends.length === 1 });
    }
    // Branches on both sides of a through-wall would each need their own fill; only build a hub when
    // the junction isn't a clean T (or cross) on a straight wall.
    if (!through && (ends.length >= 3 || (ends.length === 2 && ends.some((e) => e.beveled)))) {
      const poly: Vec2[] = [];
      for (const e of ends) {
        for (const p of [e.oLeft!, e.oRight!]) {
          if (!poly.length || dist(poly[poly.length - 1], p) > 1e-6) poly.push(p);
        }
      }
      if (poly.length > 2 && dist(poly[0], poly[poly.length - 1]) < 1e-6) poly.pop();
      if (poly.length >= 3 && Math.abs(signedArea(poly)) > 1e-7) {
        let z0 = Infinity;
        let z1 = -Infinity;
        for (const e of ends) {
          const w = project.walls[e.wallId];
          z0 = Math.min(z0, w.baseElevation);
          z1 = Math.max(z1, w.baseElevation + w.height);
        }
        hubs.push({ nodeId, polygon: poly, z0, z1 });
      }
    }
  }

  const openingsByWall = new Map<string, Opening[]>();
  for (const o of Object.values(project.openings)) {
    if (!openingsByWall.has(o.wallId)) openingsByWall.set(o.wallId, []);
    openingsByWall.get(o.wallId)!.push(o);
  }

  const walls = new Map<string, WallGeometry>();
  for (const w of Object.values(project.walls)) {
    const path = paths.get(w.id);
    if (!path) continue;
    const cs = corners.get(`${w.id}:s`);
    const ce = corners.get(`${w.id}:e`);
    if (!cs || !ce) continue;
    walls.set(w.id, buildWallGeometry(w, path, cs, ce, openingsByWall.get(w.id) ?? []));
  }
  return { walls, hubs, nodeWalls };
}

function buildWallGeometry(
  wall: WallSegment,
  path: WallPath,
  cs: { left: Vec2; right: Vec2; free: boolean },
  ce: { left: Vec2; right: Vec2; free: boolean },
  openings: Opening[],
): WallGeometry {
  const h = wall.thickness / 2;
  const L = path.length;
  const startT = path.samples[0].tangent;
  const endT = path.samples[path.samples.length - 1].tangent;
  // Corners may extend along the wall past its node; openings must stay clear of them.
  const startExt = Math.max(0, dot(sub(cs.left, path.a), startT), dot(sub(cs.right, path.a), startT));
  const endExt = Math.max(0, dot(sub(path.b, ce.left), endT), dot(sub(path.b, ce.right), endT));
  const clearStart = Math.min(L / 2, startExt + OPENING_END_MARGIN);
  const clearEnd = Math.max(L / 2, L - endExt - OPENING_END_MARGIN);
  const z0 = wall.baseElevation;
  const z1 = wall.baseElevation + wall.height;
  const zEnd = wall.baseElevation + (wall.heightEnd ?? wall.height);
  const sloped = Math.abs(zEnd - z1) > 1e-6;
  const topAt = (s: number) => (sloped ? z1 + ((zEnd - z1) * Math.min(Math.max(s, 0), L)) / L : z1);

  const spans = computeOpeningSpans(openings, clearStart, clearEnd, z0, z1, sloped ? topAt : undefined);

  const edgeAt = (s: number, side: 1 | -1): Vec2 => {
    if (s <= 1e-9) return side === 1 ? cs.left : cs.right;
    if (s >= L - 1e-9) return side === 1 ? ce.left : ce.right;
    const { p, tangent } = pointAt(path, s);
    return add(p, scale(leftNormal(tangent), side * h));
  };
  const edgeSlice = (s0: number, s1: number, side: 1 | -1): Vec2[] => {
    const pts = slicePath(path, s0, s1, side * h);
    pts[0] = edgeAt(s0, side);
    pts[pts.length - 1] = edgeAt(s1, side);
    return pts;
  };
  const makePiece = (s0: number, s1: number, pz0: number, pz1: number, kind: WallPiece['kind']): WallPiece => ({
    s0,
    s1,
    z0: pz0,
    z1: pz1,
    left: edgeSlice(s0, s1, 1),
    right: edgeSlice(s0, s1, -1),
    kind,
    atStart: s0 <= 1e-9,
    atEnd: s1 >= L - 1e-9,
  });

  // Breakpoints along the wall; each interval is either solid or an opening gap.
  const breaks = new Set<number>([0, L]);
  for (const sp of spans) {
    breaks.add(sp.s0);
    breaks.add(sp.s1);
  }
  const sorted = [...breaks].sort((x, y) => x - y);
  const pieces: WallPiece[] = [];
  const planPieces: WallPiece[] = [];
  let solidStart: number | null = null;
  for (let i = 0; i < sorted.length - 1; i++) {
    const s0 = sorted[i];
    const s1 = sorted[i + 1];
    if (s1 - s0 < 1e-6) continue;
    const m = (s0 + s1) / 2;
    const covering = spans.filter((sp) => sp.s0 <= m && sp.s1 >= m);
    if (covering.length === 0) {
      if (solidStart === null) solidStart = s0;
      continue;
    }
    if (solidStart !== null) {
      pieces.push(makePiece(solidStart, s0, z0, z1, 'solid'));
      planPieces.push(makePiece(solidStart, s0, z0, z1, 'solid'));
      solidStart = null;
    }
    const gapBottom = Math.min(...covering.map((c) => c.sill));
    const gapTop = Math.max(...covering.map((c) => c.head));
    if (gapBottom > z0 + 1e-4) pieces.push(makePiece(s0, s1, z0, gapBottom, 'below'));
    if (gapTop < Math.max(topAt(s0), topAt(s1)) - 1e-4) pieces.push(makePiece(s0, s1, gapTop, z1, 'above'));
  }
  if (solidStart !== null) {
    pieces.push(makePiece(solidStart, L, z0, z1, 'solid'));
    planPieces.push(makePiece(solidStart, L, z0, z1, 'solid'));
  }

  const left = edgeSlice(0, L, 1);
  const right = edgeSlice(0, L, -1);
  return {
    wall,
    path,
    h,
    startLeft: cs.left,
    startRight: cs.right,
    endLeft: ce.left,
    endRight: ce.right,
    left,
    right,
    footprint: [...left, ...[...right].reverse()],
    clearStart,
    clearEnd,
    spans,
    planPieces,
    pieces,
    startFree: cs.free,
    endFree: ce.free,
    z0,
    z1,
    topAt,
    sloped,
    edge: edgeSlice,
  };
}

/** Clamps openings into the wall's clear range and returns their spans. */
export function computeOpeningSpans(
  openings: Opening[],
  clearStart: number,
  clearEnd: number,
  z0: number,
  z1: number,
  /** Top height along the wall for sloped walls (the opening head stays below it). */
  topAt?: (s: number) => number,
): OpeningSpan[] {
  const avail = Math.max(0, clearEnd - clearStart);
  return openings
    .map((o) => {
      const width = Math.min(o.width, avail);
      const lo = clearStart + width / 2;
      const hi = clearEnd - width / 2;
      const center = Math.min(Math.max(o.offset, lo), Math.max(lo, hi));
      const top = topAt ? Math.min(topAt(center - width / 2), topAt(center + width / 2)) : z1;
      const sill = Math.max(z0, Math.min(o.sillHeight, top - 0.05));
      const head = Math.min(top, sill + o.height);
      return {
        id: o.id,
        s0: center - width / 2,
        s1: center + width / 2,
        center,
        sill,
        head,
        clamped: width < o.width - 1e-6 || Math.abs(center - o.offset) > 1e-6,
      };
    })
    .filter((sp) => sp.s1 - sp.s0 > 1e-4)
    .sort((x, y) => x.s0 - y.s0);
}

/** The valid centre-offset range for an opening of `width` on a wall geometry. */
export function openingOffsetRange(geom: WallGeometry, width: number): [number, number] {
  const lo = geom.clearStart + width / 2;
  const hi = geom.clearEnd - width / 2;
  return hi < lo ? [(lo + hi) / 2, (lo + hi) / 2] : [lo, hi];
}

/** Polygon for a wall piece in plan (left edge then reversed right edge). */
export function piecePolygon(piece: WallPiece): Polygon {
  return [...piece.left, ...[...piece.right].reverse()];
}

/** Outward-facing midpoint and normal of a wall side, for dimensions and labels. */
export function wallSideInfo(geom: WallGeometry, side: 'left' | 'right') {
  const { p, tangent } = pointAt(geom.path, geom.path.length / 2);
  const n = leftNormal(tangent);
  const sign = side === 'left' ? 1 : -1;
  return { point: add(p, scale(n, sign * geom.h)), normal: scale(n, sign), tangent };
}

/**
 * The two ends at a junction that form one straight wall passing through it (opposite directions,
 * same thickness within a millimetre), the thickest such pair; null when there is none.
 */
function throughPair(ends: EndInfo[]): [EndInfo, EndInfo] | null {
  let best: [EndInfo, EndInfo] | null = null;
  for (let i = 0; i < ends.length; i++)
    for (let j = i + 1; j < ends.length; j++) {
      const a = ends[i];
      const b = ends[j];
      if (Math.abs(a.h - b.h) > 0.0005) continue;
      if (Math.abs(angleDelta(a.angle, b.angle) - Math.PI) > 0.01) continue;
      if (!best || a.h > best[0].h) best = [a, b];
    }
  return best;
}

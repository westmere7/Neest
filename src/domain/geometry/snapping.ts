import type { Project, Vec2 } from '../model/schema';
import type { WallNetwork } from './walls';
import { projectOnPath, pointAt } from './wallPath';
import { add, angleOf, closestPointOnSegment, dist, fromAngle, lineIntersection, round, sub } from './vec';

export type SnapKind = 'node' | 'midpoint' | 'wall' | 'edge' | 'guide' | 'angle' | 'grid' | 'none';

export interface SnapGuide {
  a: Vec2;
  b: Vec2;
}

export interface SnapResult {
  point: Vec2;
  kind: SnapKind;
  label: string;
  /** Node or wall id the point snapped to. */
  refId?: string;
  /** Arc length along the wall for 'wall'/'midpoint' snaps. */
  s?: number;
  guides: SnapGuide[];
}

export interface SnapSettingsLike {
  grid: boolean;
  geometry: boolean;
  angle: boolean;
  guides: boolean;
}

export interface SnapContext {
  project: Pick<Project, 'nodes' | 'walls'>;
  network: WallNetwork;
  /** Hit threshold in world units (a constant screen distance divided by zoom). */
  tol: number;
  settings: SnapSettingsLike;
  gridSize: number;
  /** Previous point of the gesture, for angle constraints. */
  anchor?: Vec2 | null;
  /** Angle increment in radians when constraining (default 45°). */
  angleStep?: number;
  /** Force the angle constraint regardless of proximity (e.g. Shift held). */
  forceAngle?: boolean;
  excludeNodes?: Set<string>;
  excludeWalls?: Set<string>;
  /** Additional point targets (e.g. the start of the current wall chain). */
  extraPoints?: Vec2[];
  /** Also snap to wall faces (inner/outer edges). */
  edges?: boolean;
}

const LABELS: Record<SnapKind, string> = {
  node: 'Endpoint',
  midpoint: 'Midpoint',
  wall: 'On wall',
  edge: 'Wall face',
  guide: 'Alignment',
  angle: 'Angle',
  grid: 'Grid',
  none: '',
};

const result = (point: Vec2, kind: SnapKind, extra: Partial<SnapResult> = {}): SnapResult => ({
  point,
  kind,
  label: LABELS[kind],
  guides: [],
  ...extra,
});

/** Resolves the best snap target for a pointer position. Pure and deterministic. */
export function snapPoint(p: Vec2, ctx: SnapContext): SnapResult {
  const { tol, settings, project, network } = ctx;
  const exN = ctx.excludeNodes ?? new Set<string>();
  const exW = ctx.excludeWalls ?? new Set<string>();
  // Direction of the angle constraint from the anchor, when it applies at this pointer position.
  const angleDir = (): Vec2 | null => {
    if (!ctx.anchor || !(settings.angle || ctx.forceAngle)) return null;
    const v = sub(p, ctx.anchor);
    const l = Math.hypot(v.x, v.y);
    if (l <= 1e-6) return null;
    const step = ctx.angleStep ?? Math.PI / 4;
    const ang = angleOf(v);
    const snapped = Math.round(ang / step) * step;
    const ok = ctx.forceAngle || Math.abs(snapped - ang) <= Math.max(Math.atan2(tol, l), (3 * Math.PI) / 180);
    return ok ? fromAngle(snapped) : null;
  };

  if (settings.geometry) {
    // 1. Endpoints / nodes.
    let best: { id?: string; p: Vec2; d: number } | null = null;
    for (const n of Object.values(project.nodes)) {
      if (exN.has(n.id)) continue;
      const d = dist(n, p);
      if (d <= tol && (!best || d < best.d)) best = { id: n.id, p: { x: n.x, y: n.y }, d };
    }
    for (const q of ctx.extraPoints ?? []) {
      const d = dist(q, p);
      if (d <= tol && (!best || d < best.d)) best = { p: q, d };
    }
    if (best) return result(best.p, 'node', { refId: best.id });

    // 2. Wall midpoints.
    let bestMid: { id: string; p: Vec2; d: number; s: number } | null = null;
    for (const g of network.walls.values()) {
      if (exW.has(g.wall.id) || exN.has(g.wall.a) || exN.has(g.wall.b)) continue;
      const m = pointAt(g.path, g.path.length / 2).p;
      const d = dist(m, p);
      if (d <= tol && (!bestMid || d < bestMid.d)) bestMid = { id: g.wall.id, p: m, d, s: g.path.length / 2 };
    }
    if (bestMid) return result(bestMid.p, 'midpoint', { refId: bestMid.id, s: bestMid.s });

    // 3. Wall centrelines (T-junctions) and faces.
    let bestWall: { id: string; p: Vec2; d: number; s: number; kind: SnapKind; line: [Vec2, Vec2] } | null = null;
    for (const g of network.walls.values()) {
      if (exW.has(g.wall.id) || exN.has(g.wall.a) || exN.has(g.wall.b)) continue;
      const proj = projectOnPath(g.path, p);
      if (proj.dist <= tol && (!bestWall || proj.dist < bestWall.d))
        bestWall = { id: g.wall.id, p: proj.point, d: proj.dist, s: proj.s, kind: 'wall', line: [proj.point, add(proj.point, proj.tangent)] };
      if (ctx.edges) {
        for (const edge of [g.left, g.right]) {
          for (let i = 0; i < edge.length - 1; i++) {
            const cp = closestPointOnSegment(p, edge[i], edge[i + 1]);
            if (cp.dist <= tol && (!bestWall || cp.dist < bestWall.d))
              bestWall = { id: g.wall.id, p: cp.point, d: cp.dist, s: proj.s, kind: 'edge', line: [edge[i], edge[i + 1]] };
          }
        }
      }
    }
    if (bestWall) {
      // Constrained to an angle from the anchor: land where that ray crosses the wall or face, so the
      // line stays straight and still ends exactly on it.
      const dir = angleDir();
      if (dir && ctx.anchor) {
        const [q0, q1] = bestWall.line;
        const hit = lineIntersection(ctx.anchor, dir, q0, sub(q1, q0));
        if (hit && dist(hit, p) <= tol * 2) {
          return result(hit, bestWall.kind, { refId: bestWall.id, s: bestWall.s, guides: [{ a: ctx.anchor, b: hit }] });
        }
      }
      return result(bestWall.p, bestWall.kind, { refId: bestWall.id, s: bestWall.s });
    }
  }

  const guidePoints: Vec2[] = [];
  if (settings.guides) {
    for (const n of Object.values(project.nodes)) if (!exN.has(n.id)) guidePoints.push(n);
    for (const q of ctx.extraPoints ?? []) guidePoints.push(q);
  }
  const findGuide = (axis: 'x' | 'y', value: number, excludeNear?: Vec2) => {
    let best: Vec2 | null = null;
    let bestD = tol;
    for (const g of guidePoints) {
      if (excludeNear && dist(g, excludeNear) < 1e-9) continue;
      const d = Math.abs(g[axis] - value);
      if (d <= bestD) {
        bestD = d;
        best = g;
      }
    }
    return best;
  };

  // 4. Angle constraint relative to the anchor.
  if (ctx.anchor && (settings.angle || ctx.forceAngle)) {
    const a = ctx.anchor;
    const v = sub(p, a);
    const l = Math.hypot(v.x, v.y);
    if (l > 1e-6) {
      const step = ctx.angleStep ?? Math.PI / 4;
      const ang = angleOf(v);
      const snapped = Math.round(ang / step) * step;
      const tolAngle = Math.atan2(tol, l);
      if (ctx.forceAngle || Math.abs(snapped - ang) <= Math.max(tolAngle, (3 * Math.PI) / 180)) {
        const dir = fromAngle(snapped);
        let length = l * Math.cos(snapped - ang);
        // Alignment guides along the constrained ray.
        if (settings.guides) {
          const onRay = add(a, { x: dir.x * length, y: dir.y * length });
          const gx = Math.abs(dir.x) > 1e-6 ? findGuide('x', onRay.x, a) : null;
          const gy = Math.abs(dir.y) > 1e-6 ? findGuide('y', onRay.y, a) : null;
          const g = gx ?? gy;
          if (g) {
            const hit = gx
              ? lineIntersection(a, dir, { x: gx.x, y: 0 }, { x: 0, y: 1 })
              : lineIntersection(a, dir, { x: 0, y: gy!.y }, { x: 1, y: 0 });
            if (hit) {
              return result(hit, 'guide', { guides: [{ a: g, b: hit }] });
            }
          }
        }
        if (settings.grid && ctx.gridSize > 0) length = round(length, ctx.gridSize);
        const point = add(a, { x: dir.x * length, y: dir.y * length });
        return result(point, 'angle', { guides: [{ a, b: point }] });
      }
    }
  }

  // 5. Alignment guides + grid.
  const gx = settings.guides ? findGuide('x', p.x) : null;
  const gy = settings.guides ? findGuide('y', p.y) : null;
  const point = {
    x: gx ? gx.x : settings.grid ? round(p.x, ctx.gridSize) : p.x,
    y: gy ? gy.y : settings.grid ? round(p.y, ctx.gridSize) : p.y,
  };
  const guides: SnapGuide[] = [];
  if (gx) guides.push({ a: gx, b: point });
  if (gy) guides.push({ a: gy, b: point });
  if (guides.length) return result(point, 'guide', { guides });
  if (settings.grid) return result(point, 'grid');
  return result(point, 'none');
}

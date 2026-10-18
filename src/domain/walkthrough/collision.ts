import { isDividerWall } from '@/domain/model/schema';
import type { Project, Vec2 } from '../model/schema';
import type { WallNetwork } from '../geometry/walls';
import type { RoomFace } from '../geometry/rooms';
import { rectPolygon, pointInPolygon, polygonArea } from '../geometry/polygon';
import { closestPointOnSegment, dist } from '../geometry/vec';

/** Body height range checked for walkthrough collisions (metres above floor). */
const BODY_MIN = 0.35;
const BODY_MAX = 1.75;

export interface Collider {
  a: Vec2;
  b: Vec2;
}

/**
 * 2D collision segments for first-person walking: wall pieces that intersect
 * the body height range (so door openings are passable but window sills are
 * not) plus outlines of furniture taller than a low step.
 */
export function buildColliders(project: Project, network: WallNetwork): Collider[] {
  const out: Collider[] = [];
  const addPoly = (poly: Vec2[]) => {
    for (let i = 0; i < poly.length; i++) out.push({ a: poly[i], b: poly[(i + 1) % poly.length] });
  };
  for (const g of network.walls.values()) {
    if (g.wall.hidden || isDividerWall(g.wall)) continue;
    for (const pc of g.pieces) {
      if (pc.z1 < BODY_MIN || pc.z0 > BODY_MAX) continue;
      addPoly([...pc.left, ...[...pc.right].reverse()]);
    }
  }
  for (const h of network.hubs) addPoly(h.polygon);
  for (const o of Object.values(project.objects)) {
    if (o.hidden || o.height < 0.3 || o.elevation > 1.2 || o.elevation + o.height < BODY_MIN) continue;
    addPoly(rectPolygon(o.x, o.y, o.width, o.depth, o.rotation));
  }
  return out;
}

/** Moves a circle of `radius` out of all colliders (a few relaxation passes). */
export function resolveCollisions(p: Vec2, radius: number, colliders: Collider[], iterations = 4): Vec2 {
  let q = { ...p };
  for (let it = 0; it < iterations; it++) {
    let moved = false;
    for (const c of colliders) {
      const cp = closestPointOnSegment(q, c.a, c.b);
      if (cp.dist < radius) {
        const d = cp.dist < 1e-6 ? { x: 0, y: 0 } : { x: (q.x - cp.point.x) / cp.dist, y: (q.y - cp.point.y) / cp.dist };
        if (d.x === 0 && d.y === 0) continue;
        const push = radius - cp.dist;
        q = { x: q.x + d.x * push, y: q.y + d.y * push };
        moved = true;
      }
    }
    if (!moved) break;
  }
  return q;
}

/**
 * Moves from p by delta with collision, sub-stepping so fast movement cannot
 * tunnel through thin walls.
 */
export function moveWithCollisions(p: Vec2, delta: Vec2, radius: number, colliders: Collider[]): Vec2 {
  const len = Math.hypot(delta.x, delta.y);
  const steps = Math.max(1, Math.ceil(len / (radius * 0.5)));
  let q = p;
  for (let i = 0; i < steps; i++) {
    q = resolveCollisions({ x: q.x + delta.x / steps, y: q.y + delta.y / steps }, radius, colliders);
  }
  return q;
}

/** Default first-person start: the saved spawn, else the centre of the largest room. */
export function defaultSpawn(project: Project, faces: RoomFace[]): { p: Vec2; angle: number } {
  if (project.guest.spawn) return { p: project.guest.spawn, angle: project.guest.spawnAngle };
  let best: RoomFace | null = null;
  for (const f of faces) if (!best || f.area > best.area) best = f;
  if (best) return { p: best.label, angle: -Math.PI / 2 };
  return { p: { x: 0, y: 0 }, angle: 0 };
}

export function insideAnyRoom(p: Vec2, faces: RoomFace[]): boolean {
  return faces.some((f) => pointInPolygon(p, f.inner) && polygonArea(f.inner) > 0 && dist(p, f.label) >= 0);
}

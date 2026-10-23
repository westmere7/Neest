import type { Vec2 } from '../model/schema';
import { closestPointOnSegment } from '../geometry/vec';

/** A wall or furniture edge the walker cannot cross. Kept free of the schema so the guest viewer stays small. */
export interface Collider {
  a: Vec2;
  b: Vec2;
}

/** Moves a circle of `radius` out of all colliders (a few relaxation passes). */
export function resolveCollisions(p: Vec2, radius: number, colliders: Collider[], iterations = 4): Vec2 {
  let q = { ...p };
  for (let it = 0; it < iterations; it++) {
    let moved = false;
    for (const c of colliders) {
      const cp = closestPointOnSegment(q, c.a, c.b);
      if (cp.dist < radius) {
        const d =
          cp.dist < 1e-6
            ? { x: 0, y: 0 }
            : { x: (q.x - cp.point.x) / cp.dist, y: (q.y - cp.point.y) / cp.dist };
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

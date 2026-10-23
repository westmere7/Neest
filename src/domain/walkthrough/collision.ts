import { isDividerWall } from '@/domain/model/schema';
import type { Project, Vec2 } from '../model/schema';
import type { WallNetwork } from '../geometry/walls';
import type { RoomFace } from '../geometry/rooms';
import { rectPolygon, pointInPolygon, polygonArea } from '../geometry/polygon';
import { dist } from '../geometry/vec';
import { isObjectHidden } from '../commands/itemLayers';
import type { Collider } from './move';

export { moveWithCollisions, resolveCollisions, type Collider } from './move';

/** Body height range checked for walkthrough collisions (metres above floor). */
const BODY_MIN = 0.35;
const BODY_MAX = 1.75;

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
    if (isObjectHidden(project, o) || o.height < 0.3 || o.elevation > 1.2 || o.elevation + o.height < BODY_MIN) continue;
    addPoly(rectPolygon(o.x, o.y, o.width, o.depth, o.rotation));
  }
  return out;
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

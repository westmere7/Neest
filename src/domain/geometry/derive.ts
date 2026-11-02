import { isDividerWall, type Project, type Room, type Vec2 } from '../model/schema';
import { computeDiagnostics, type Diagnostic } from '../validation/diagnostics';
import { detectRoomFaces, matchFacesToRooms, type RoomFace } from './rooms';
import { computeWallNetwork, type JunctionHub, type WallNetwork } from './walls';
import { add, boundsOf, leftNormal, scale, unionBounds, type Bounds } from './vec';
import { pointInPolygon, rectPolygon } from './polygon';
import { pointAt } from './wallPath';

/** Everything the 2D/3D views and exports derive from the persisted model. */
export interface DerivedPlan {
  network: WallNetwork;
  faces: RoomFace[];
  /** Room record per face (null when the face has not been reconciled yet). */
  faceRooms: (Room | null)[];
  roomFaces: Map<string, RoomFace>;
  diagnostics: Diagnostic[];
  bounds: Bounds | null;
}

// Memoise on the identity of the structural sub-trees. Immer keeps unchanged
// sub-trees referentially stable, so object or material edits never trigger
// wall/room recomputation.
let netCache: { walls: unknown; nodes: unknown; openings: unknown; value: WallNetwork } | null = null;
let faceCache: { walls: unknown; nodes: unknown; value: RoomFace[] } | null = null;
let derivedCache: { project: Project; value: DerivedPlan } | null = null;

export function getWallNetwork(project: Project): WallNetwork {
  if (
    netCache &&
    netCache.walls === project.walls &&
    netCache.nodes === project.nodes &&
    netCache.openings === project.openings
  )
    return netCache.value;
  const value = computeWallNetwork(project);
  netCache = { walls: project.walls, nodes: project.nodes, openings: project.openings, value };
  return value;
}

export function getRoomFaces(project: Pick<Project, 'walls' | 'nodes'>): RoomFace[] {
  if (faceCache && faceCache.walls === project.walls && faceCache.nodes === project.nodes) return faceCache.value;
  const value = detectRoomFaces(project);
  faceCache = { walls: project.walls, nodes: project.nodes, value };
  return value;
}

export function derivePlan(project: Project): DerivedPlan {
  if (derivedCache && derivedCache.project === project) return derivedCache.value;
  const network = getWallNetwork(project);
  const faces = getRoomFaces(project);
  const match = matchFacesToRooms(faces, project.rooms);
  const faceRooms = faces.map((_, i) => {
    const id = match.get(i);
    return id ? project.rooms[id] ?? null : null;
  });
  const roomFaces = new Map<string, RoomFace>();
  faceRooms.forEach((r, i) => r && roomFaces.set(r.id, faces[i]));
  const diagnostics = computeDiagnostics(project, network, faces);
  const value: DerivedPlan = {
    network,
    faces,
    faceRooms,
    roomFaces,
    diagnostics,
    bounds: planBounds(project, network),
  };
  derivedCache = { project, value };
  return value;
}

export function planBounds(project: Project, network: WallNetwork): Bounds | null {
  let b: Bounds | null = null;
  for (const g of network.walls.values()) b = unionBounds(b, boundsOf(g.footprint));
  for (const o of Object.values(project.objects)) {
    b = unionBounds(b, boundsOf(rectPolygon(o.x, o.y, o.width, o.depth, o.rotation)));
  }
  return b;
}

/**
 * IDs of the external walls of a plan (cut when cutaway is set to "External walls only").
 * Uses walls explicitly typed as `exterior` when the plan has any; otherwise falls back to
 * non-partition room boundary walls whose outer face looks outside the building.
 */
export function externalWallIds(derived: Pick<DerivedPlan, 'network' | 'faces'>): Set<string> {
  const walls = [...derived.network.walls.values()].filter((g) => !isDividerWall(g.wall) && !g.wall.hidden);
  const explicit = walls.filter((g) => g.wall.role === 'exterior');
  if (explicit.length > 0) return new Set(explicit.map((g) => g.wall.id));
  if (derived.faces.length === 0) {
    return new Set(walls.filter((g) => g.wall.role !== 'partition').map((g) => g.wall.id));
  }
  const roomWalls = new Set(derived.faces.flatMap((f) => f.wallIds));
  const insideAnyRoom = (p: Vec2) => derived.faces.some((f) => pointInPolygon(p, f.centerline));
  const out = new Set<string>();
  for (const g of walls) {
    if (g.wall.role === 'partition' || !roomWalls.has(g.wall.id)) continue;
    const { p, tangent } = pointAt(g.path, g.path.length / 2);
    const n = leftNormal(tangent);
    const step = g.h + 0.05;
    const leftIn = insideAnyRoom(add(p, scale(n, step)));
    const rightIn = insideAnyRoom(add(p, scale(n, -step)));
    if (!leftIn || !rightIn) out.add(g.wall.id);
  }
  return out;
}

/** Whether a junction hub touches an external wall (and is therefore cut in external-only cutaway). */
export function isHubExternal(
  hub: JunctionHub,
  network: Pick<WallNetwork, 'nodeWalls'>,
  externalIds: ReadonlySet<string>,
): boolean {
  return (network.nodeWalls.get(hub.nodeId) ?? []).some((id) => externalIds.has(id));
}

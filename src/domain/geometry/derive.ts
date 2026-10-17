import type { Project, Room } from '../model/schema';
import { computeDiagnostics, type Diagnostic } from '../validation/diagnostics';
import { detectRoomFaces, matchFacesToRooms, type RoomFace } from './rooms';
import { computeWallNetwork, type WallNetwork } from './walls';
import { boundsOf, unionBounds, type Bounds } from './vec';
import { rectPolygon } from './polygon';

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

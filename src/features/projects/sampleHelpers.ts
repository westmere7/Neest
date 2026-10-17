import type { Vec2 } from '@/domain/model/schema';
import { addOpening, assignMaterial, placeObject } from '@/domain/commands/entities';
import type { AddOpeningArgs } from '@/domain/commands/entities';
import type { D } from '@/domain/commands/walls';
import { buildWallPath, projectOnPath } from '@/domain/geometry/wallPath';
import { ASSETS_BY_ID } from '@/data/assets/catalog';

/** Helpers for building sample projects through the command layer. */

/** Finds the wall passing through p and the arc-length offset of p along it. */
export function wallAt(d: D, p: Vec2): { wallId: string; offset: number } | null {
  let best: { wallId: string; offset: number; dist: number } | null = null;
  for (const w of Object.values(d.walls)) {
    const path = buildWallPath(d.nodes[w.a], d.nodes[w.b], w.curve);
    const proj = projectOnPath(path, p);
    if (proj.dist < 0.05 && (!best || proj.dist < best.dist)) best = { wallId: w.id, offset: proj.s, dist: proj.dist };
  }
  return best;
}

export function opening(d: D, p: Vec2, args: Omit<AddOpeningArgs, 'wallId' | 'offset'>) {
  const hit = wallAt(d, p);
  if (hit) addOpening(d, { ...args, wallId: hit.wallId, offset: hit.offset });
}

/** Places catalogue items (unknown asset ids are skipped). Rotation follows the plan convention. */
export function placeFurniture(d: D, list: Furn[]) {
  for (const f of list) {
    const asset = ASSETS_BY_ID[f.asset];
    if (!asset) continue;
    placeObject(d, {
      assetId: asset.id,
      x: f.x,
      y: f.y,
      rotation: ((f.rot ?? 0) + Math.PI * 4) % (Math.PI * 2),
      width: f.w ?? asset.defaultSize.w,
      depth: f.d ?? asset.defaultSize.d,
      height: f.h ?? asset.defaultSize.h,
      elevation: f.elevation ?? asset.defaultElevation,
      materials: f.materials,
    });
  }
}

export interface Furn {
  asset: string;
  x: number;
  y: number;
  rot?: number;
  w?: number;
  d?: number;
  h?: number;
  elevation?: number;
  materials?: Record<string, string>;
}

/** Gives the side of the wall through `wallPoint` that faces `inside` a finish. */
export function paintWallFacing(d: D, wallPoint: Vec2, inside: Vec2, materialId: string) {
  const hit = wallAt(d, wallPoint);
  if (!hit) return;
  const w = d.walls[hit.wallId];
  const path = buildWallPath(d.nodes[w.a], d.nodes[w.b], w.curve);
  const proj = projectOnPath(path, inside);
  const n = { x: proj.tangent.y, y: -proj.tangent.x };
  const side = (inside.x - proj.point.x) * n.x + (inside.y - proj.point.y) * n.y >= 0 ? 'left' : 'right';
  assignMaterial(d, [{ kind: 'wall-side', wallId: w.id, side }], materialId);
}


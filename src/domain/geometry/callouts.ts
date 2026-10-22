import type { Callout, CalloutTarget, Project, Vec2 } from '../model/schema';
import type { DerivedPlan } from './derive';
import { labelPoint, polygonArea, polygonCentroid, rectPolygon } from './polygon';

/** Where a callout's leader starts: a plan point plus the height the 3D leader starts at. */
export interface CalloutAnchor {
  x: number;
  y: number;
  /** Height in metres (top of an item, the floor for rooms and areas, the stored height for spots). */
  z: number;
  /** Plan outline to highlight (item footprint, room floor, drawn area); none for a spot. */
  outline: Vec2[] | null;
}

/**
 * Resolves a callout target against the current plan. Items and rooms are followed live, so a
 * callout stays on its item when the item moves. Returns null when the target no longer exists.
 */
export function calloutAnchor(project: Pick<Project, 'objects' | 'rooms'>, derived: DerivedPlan | null, target: CalloutTarget): CalloutAnchor | null {
  switch (target.kind) {
    case 'point':
      return { x: target.x, y: target.y, z: target.z, outline: null };
    case 'object': {
      const o = project.objects[target.objectId];
      if (!o) return null;
      return { x: o.x, y: o.y, z: o.elevation + o.height, outline: rectPolygon(o.x, o.y, o.width, o.depth, o.rotation) };
    }
    case 'room': {
      const r = project.rooms[target.roomId];
      if (!r) return null;
      const face = derived?.roomFaces.get(r.id);
      if (face) {
        const p = labelPoint(face.inner, face.holes);
        return { x: p.x, y: p.y, z: 0, outline: face.inner };
      }
      return { x: r.anchor.x, y: r.anchor.y, z: 0, outline: null };
    }
    case 'region': {
      const c = polygonCentroid(target.points);
      return { x: c.x, y: c.y, z: 0, outline: target.points };
    }
  }
}

/** Where the label sits on the plan: anchor + offset. */
export function calloutLabelPoint(anchor: Pick<CalloutAnchor, 'x' | 'y'>, c: Pick<Callout, 'offset'>): Vec2 {
  return { x: anchor.x + c.offset.x, y: anchor.y + c.offset.y };
}

/** Area of a region target in m² (0 for other targets). */
export function calloutRegionArea(target: CalloutTarget): number {
  return target.kind === 'region' ? polygonArea(target.points) : 0;
}

import type { Callout, CalloutTarget, Project, Vec2 } from '../model/schema';
import type { DerivedPlan } from './derive';
import { labelPoint, polygonArea, polygonCentroid, rectPolygon } from './polygon';
import { rotate } from './vec';

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
    case 'general':
      return null;
    case 'point':
      return { x: target.x, y: target.y, z: target.z, outline: null };
    case 'object': {
      const o = project.objects[target.objectId];
      if (!o) return null;
      const off = target.dx || target.dy ? rotate({ x: target.dx ?? 0, y: target.dy ?? 0 }, o.rotation) : { x: 0, y: 0 };
      return {
        x: Math.round((o.x + off.x) * 1000) / 1000,
        y: Math.round((o.y + off.y) * 1000) / 1000,
        z: Math.round(Math.max(0, o.elevation + o.height + (target.dz ?? 0)) * 1000) / 1000,
        outline: rectPolygon(o.x, o.y, o.width, o.depth, o.rotation),
      };
    }
    case 'room': {
      const r = project.rooms[target.roomId];
      if (!r) return null;
      const dx = target.dx ?? 0;
      const dy = target.dy ?? 0;
      const dz = Math.max(0, target.dz ?? 0);
      const face = derived?.roomFaces.get(r.id);
      if (face) {
        const p = labelPoint(face.inner, face.holes);
        return { x: p.x + dx, y: p.y + dy, z: dz, outline: face.inner };
      }
      return { x: r.anchor.x + dx, y: r.anchor.y + dy, z: dz, outline: null };
    }
    case 'region': {
      const c = polygonCentroid(target.points);
      return {
        x: c.x + (target.dx ?? 0),
        y: c.y + (target.dy ?? 0),
        z: Math.max(0, target.dz ?? 0),
        outline: target.points,
      };
    }
  }
}

/**
 * Moves the spot (anchor point) a callout points to in plan/3D space while preserving its target
 * association (spot, item, room, or area). When `keepLabel` is true, adjusts `c.offset` so the 2D
 * label box stays stationary while the leader tip moves.
 */
export function setCalloutAnchorPoint(
  project: Pick<Project, 'objects' | 'rooms'>,
  derived: DerivedPlan | null,
  c: Callout,
  next: { x?: number; y?: number; z?: number },
  keepLabel = true,
): void {
  const prev = calloutAnchor(project, derived, c.target);
  if (!prev) return;
  const r3 = (n: number) => Math.round(n * 1000) / 1000;
  const nx = r3(next.x ?? prev.x);
  const ny = r3(next.y ?? prev.y);
  const nz = Math.max(0, r3(next.z ?? prev.z));
  if (keepLabel) {
    c.offset = {
      x: r3(c.offset.x + (prev.x - nx)),
      y: r3(c.offset.y + (prev.y - ny)),
    };
  }
  switch (c.target.kind) {
    case 'general':
      return;
    case 'point':
      c.target = { kind: 'point', x: nx, y: ny, z: nz };
      return;
    case 'object': {
      const o = project.objects[c.target.objectId];
      if (!o) return;
      const local = rotate({ x: nx - o.x, y: ny - o.y }, -o.rotation);
      c.target = {
        kind: 'object',
        objectId: o.id,
        dx: r3(local.x),
        dy: r3(local.y),
        dz: r3(nz - (o.elevation + o.height)),
      };
      return;
    }
    case 'room': {
      const base = calloutAnchor(project, derived, { kind: 'room', roomId: c.target.roomId });
      if (!base) return;
      c.target = {
        kind: 'room',
        roomId: c.target.roomId,
        dx: r3(nx - base.x),
        dy: r3(ny - base.y),
        dz: r3(nz - base.z),
      };
      return;
    }
    case 'region': {
      const base = polygonCentroid(c.target.points);
      c.target = {
        kind: 'region',
        points: c.target.points,
        dx: r3(nx - base.x),
        dy: r3(ny - base.y),
        dz: r3(nz),
      };
      return;
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

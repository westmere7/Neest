import { isDividerWall, isPassageKind, isWindowKind, type Project } from '../model/schema';
import type { DerivedPlan } from './derive';
import { boundsOf, unionBounds, type Bounds } from './vec';

/** Headline numbers of a plan, as shown in the Inspector's Overview and the guest viewer's info panel. */
export interface PlanOverview {
  rooms: { name: string; area: number }[];
  floorArea: number;
  items: number;
  doors: number;
  windows: number;
  wallLength: number;
  /** Outer size of the walls only (furniture outside, e.g. on a terrace, does not count). */
  shell: Bounds | null;
}

export function planOverview(
  project: Pick<Project, 'objects' | 'openings'>,
  derived: Pick<DerivedPlan, 'faces' | 'faceRooms' | 'network'>,
): PlanOverview {
  const walls = [...derived.network.walls.values()].filter((g) => !isDividerWall(g.wall));
  const openings = Object.values(project.openings);
  return {
    rooms: derived.faces.flatMap((f, i) => {
      const r = derived.faceRooms[i];
      return r ? [{ name: r.name, area: f.area }] : [];
    }),
    floorArea: derived.faces.reduce((s, f) => s + f.area, 0),
    items: Object.keys(project.objects).length,
    doors: openings.filter((o) => !isWindowKind(o.kind) && !isPassageKind(o.kind)).length,
    windows: openings.filter((o) => isWindowKind(o.kind)).length,
    wallLength: walls.reduce((s, g) => s + g.path.length, 0),
    shell: walls.reduce<Bounds | null>((b, g) => unionBounds(b, boundsOf(g.footprint)), null),
  };
}

import type { Project } from '@/domain/model/schema';
import type { DerivedPlan } from '@/domain/geometry/derive';
import { pointAt } from '@/domain/geometry/wallPath';
import type { SelItem } from '@/state/editorStore';

/** Plan bounds (x, y) and height range (z) of what is selected. */
export interface SelectionBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

/** Bounds of the selection, or null when nothing selected has a place (Focus camera). */
export function selectionBounds(project: Project, derived: DerivedPlan, selection: SelItem[]): SelectionBounds | null {
  const b: SelectionBounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity };
  const add = (x: number, y: number, z0: number, z1: number) => {
    b.minX = Math.min(b.minX, x);
    b.maxX = Math.max(b.maxX, x);
    b.minY = Math.min(b.minY, y);
    b.maxY = Math.max(b.maxY, y);
    b.minZ = Math.min(b.minZ, z0);
    b.maxZ = Math.max(b.maxZ, z1);
  };
  for (const s of selection) {
    if (s.kind === 'object') {
      const o = project.objects[s.id];
      if (!o) continue;
      const c = Math.cos(o.rotation);
      const n = Math.sin(o.rotation);
      for (const [lx, lz] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ])
        add(o.x + (lx * o.width * c - lz * o.depth * n) / 2, o.y + (lx * o.width * n + lz * o.depth * c) / 2, o.elevation, o.elevation + o.height);
    } else if (s.kind === 'opening') {
      const o = project.openings[s.id];
      const g = o && derived.network.walls.get(o.wallId);
      if (!o || !g) continue;
      for (const t of [o.offset - o.width / 2, o.offset + o.width / 2]) {
        const p = pointAt(g.path, Math.min(Math.max(t, 0), g.path.length)).p;
        add(p.x, p.y, o.sillHeight, o.sillHeight + o.height);
      }
    } else if (s.kind === 'wall') {
      const g = derived.network.walls.get(s.id);
      if (!g) continue;
      const z0 = g.wall.baseElevation ?? 0;
      for (const p of g.footprint) add(p.x, p.y, z0, z0 + g.wall.height);
    } else if (s.kind === 'room') {
      const f = derived.roomFaces.get(s.id);
      if (!f) continue;
      for (const p of f.inner) add(p.x, p.y, 0, 0);
    } else if (s.kind === 'node') {
      const n = project.nodes[s.id];
      if (n) add(n.x, n.y, 0, 0);
    }
  }
  return Number.isFinite(b.minX) ? b : null;
}

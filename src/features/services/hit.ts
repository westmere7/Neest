import type { Project, Vec2 } from '@/domain/model/schema';
import type { DerivedPlan } from '@/domain/geometry/derive';
import { serviceItems, servicePointAt, type ServiceLinkInfo } from '@/domain/geometry/services';
import { SERVICE_POINTS, neededSystems, type ServiceSystem } from '@/domain/model/services';
import { closestPointOnSegment, dist } from '@/domain/geometry/vec';
import { pointInPolygon, rectPolygon } from '@/domain/geometry/polygon';
import type { SelItem } from '@/state/editorStore';
import { POINT_PX, RUN_PX } from './ServicesSvg';
import { needsOfProject, servicesState } from './needs';

const shownAll: Record<ServiceSystem, boolean> = { power: true, water: true, drain: true };

/**
 * What is under the pointer in Services mode: points first, then runs, then the items that need
 * services. Walls, rooms and other items are not pickable there.
 */
export function hitServices(project: Project, derived: DerivedPlan, p: Vec2, px: number, shown = shownAll): SelItem | null {
  const tol = 6 * px;
  let best: { id: string; d: number } | null = null;
  for (const pt of Object.values(project.servicePoints ?? {})) {
    if (!shown[SERVICE_POINTS[pt.kind].system]) continue;
    const d = dist(servicePointAt(derived, pt), p);
    const r = POINT_PX * px * (SERVICE_POINTS[pt.kind].source ? 1.35 : 1);
    if (d <= r + 2 * px && (!best || d < best.d)) best = { id: pt.id, d };
  }
  if (best) return { kind: 'service', id: best.id };
  for (const r of Object.values(project.serviceRuns ?? {})) {
    if (!shown[r.system]) continue;
    const reach = tol + (RUN_PX[r.system] / 2) * px;
    for (let i = 1; i < r.points.length; i++) {
      const d = closestPointOnSegment(p, r.points[i - 1], r.points[i]).dist;
      if (d <= reach && (!best || d < best.d)) best = { id: r.id, d };
    }
  }
  if (best) return { kind: 'run', id: best.id };
  let item: { id: string; area: number } | null = null;
  for (const { o, needs } of serviceItems(project, needsOfProject(project))) {
    if (!neededSystems(needs).some((s) => shown[s])) continue;
    if (!pointInPolygon(p, rectPolygon(o.x, o.y, o.width + tol * 2, o.depth + tol * 2, o.rotation))) continue;
    const area = o.width * o.depth;
    if (!item || area < item.area) item = { id: o.id, area };
  }
  return item ? { kind: 'object', id: item.id } : null;
}

/** The dashed item connection under the pointer (right-click → Disconnect). */
export function hitServiceLink(project: Project, derived: DerivedPlan, p: Vec2, px: number, shown = shownAll): ServiceLinkInfo | null {
  let best: { l: ServiceLinkInfo; d: number } | null = null;
  for (const l of servicesState(project, derived).links) {
    if (!shown[l.system]) continue;
    const d = closestPointOnSegment(p, l.from, l.to).dist;
    if (d <= 5 * px && (!best || d < best.d)) best = { l, d };
  }
  return best?.l ?? null;
}

/** Points and runs fully inside a box (marquee in Services mode). */
export function marqueeServices(project: Project, derived: DerivedPlan, a: Vec2, b: Vec2, shown = shownAll): SelItem[] {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  const inside = (q: Vec2) => q.x >= minX && q.x <= maxX && q.y >= minY && q.y <= maxY;
  const out: SelItem[] = [];
  for (const pt of Object.values(project.servicePoints ?? {})) if (shown[SERVICE_POINTS[pt.kind].system] && inside(servicePointAt(derived, pt))) out.push({ kind: 'service', id: pt.id });
  for (const r of Object.values(project.serviceRuns ?? {})) if (shown[r.system] && r.points.every(inside)) out.push({ kind: 'run', id: r.id });
  return out;
}

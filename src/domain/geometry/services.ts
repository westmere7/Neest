import type { PlacedObject, Project, ServicePoint, ServiceRun, Vec2 } from '../model/schema';
import { isDividerWall } from '../model/schema';
import {
  SERVICE_POINTS,
  SERVICE_SYSTEMS,
  needReach,
  neededSystems,
  needLabel,
  pointForNeed,
  pointsMeeting,
  type AssetServices,
  type ServiceHost,
  type ServicePointKind,
  type ServiceSystem,
} from '../model/services';
import type { DerivedPlan } from './derive';
import { pointInFace } from './rooms';
import { projectOnPath } from './wallPath';
import { add, dist, dot, leftNormal, rotate, scale, sub } from './vec';
import { isObjectHidden } from '../commands/itemLayers';

/** What a placed item needs (from its library item); undefined = nothing. Keeps this module free of the asset registry. */
export type NeedsOf = (o: PlacedObject) => AssetServices | undefined;

/** Wall points sit this far inside the wall face (they are in the wall). */
const IN_WALL = 0.012;
/** Floor runs run this far under the floor surface; ceiling runs this far above the ceiling. */
export const FLOOR_RUN_DEPTH = 0.04;
export const CEILING_RUN_GAP = 0.04;
/** A run end this close (plan) to a point connects to it. */
export const RUN_CONNECT = 0.15;
/** A hand-picked connection holds up to this far; beyond it the item falls back to automatic. */
export const PIN_REACH = 4;

// ───────────────────────── Placement ─────────────────────────

export interface WallFace {
  /** Point just inside the face. */
  p: Vec2;
  wallId: string;
  /** Direction the face looks (radians, plan). */
  rotation: number;
  /** Distance from the query point to the wall centre line. */
  d: number;
}

/** The nearest wall face within `range` of `p` (measured from the face), for points that sit in walls. */
export function wallFaceAt(derived: DerivedPlan, p: Vec2, range: number, onlyWall?: string): WallFace | null {
  let best: WallFace | null = null;
  for (const g of derived.network.walls.values()) {
    if (isDividerWall(g.wall) || g.wall.hidden) continue;
    if (onlyWall && g.wall.id !== onlyWall) continue;
    const proj = projectOnPath(g.path, p);
    if (proj.dist > g.h + range) continue;
    const n0 = leftNormal(proj.tangent);
    const side = dot(sub(p, proj.point), n0) >= 0 ? 1 : -1;
    const n = scale(n0, side);
    const face: WallFace = { p: add(proj.point, scale(n, Math.max(0, g.h - IN_WALL))), wallId: g.wall.id, rotation: Math.atan2(n.y, n.x), d: proj.dist };
    if (!best || face.d < best.d) best = face;
  }
  return best;
}

export interface ServicePlacement {
  x: number;
  y: number;
  host: ServiceHost;
  wallId: string | null;
  rotation: number;
  valid: boolean;
  /** Why it can't go here. */
  reason?: string;
}

/**
 * Where a point of `kind` lands for the pointer at `p`: wall points snap into the nearest wall face
 * (kinds that also allow the floor fall back to it away from walls); floor and ceiling points stay
 * where they are. Drainage is floor only. `host` forces one host.
 */
export function placeServicePoint(derived: DerivedPlan, kind: ServicePointKind, p: Vec2, host?: ServiceHost, range = 0.7): ServicePlacement {
  const hosts = SERVICE_POINTS[kind].hosts;
  const want = host && hosts.includes(host) ? host : hosts[0];
  if (want === 'wall') {
    const face = wallFaceAt(derived, p, range);
    if (face) return { x: face.p.x, y: face.p.y, host: 'wall', wallId: face.wallId, rotation: face.rotation, valid: true };
    if (!host && hosts.includes('floor')) return { x: p.x, y: p.y, host: 'floor', wallId: null, rotation: 0, valid: true };
    return { x: p.x, y: p.y, host: 'wall', wallId: null, rotation: 0, valid: false, reason: 'Point at a wall: this goes in a wall' };
  }
  return { x: p.x, y: p.y, host: want, wallId: null, rotation: 0, valid: true };
}

/** A point's plan position and facing as drawn: wall points follow their wall's face when it moves. */
export function servicePointAt(derived: DerivedPlan, pt: ServicePoint): { x: number; y: number; rotation: number } {
  if (pt.host === 'wall' && pt.wallId) {
    const face = wallFaceAt(derived, pt, 2, pt.wallId);
    if (face) return { x: face.p.x, y: face.p.y, rotation: face.rotation };
  }
  return { x: pt.x, y: pt.y, rotation: pt.rotation };
}

/** Ceiling height over a plan point (room ceiling, else its lowest wall, else the default wall height). */
export function ceilingAt(project: Project, derived: DerivedPlan, p: Vec2): number {
  let best: { h: number; area: number } | null = null;
  derived.faces.forEach((face, i) => {
    if (!pointInFace(p, face) || (best && face.area >= best.area)) return;
    const room = derived.faceRooms[i];
    let h = room?.ceilingHeight ?? null;
    if (!h) {
      const hs = face.wallIds
        .map((id) => project.walls[id])
        .filter((w) => w && !isDividerWall(w))
        .map((w) => w.baseElevation + w.height);
      h = hs.length ? Math.min(...hs) : project.settings.defaultWall.height;
    }
    best = { h, area: face.area };
  });
  return (best as { h: number } | null)?.h ?? project.settings.defaultWall.height;
}

/** Height of a point above the floor in 3D. */
export function pointElevation(project: Project, derived: DerivedPlan, pt: ServicePoint): number {
  if (pt.host === 'floor') return 0;
  if (pt.host === 'ceiling') return ceilingAt(project, derived, pt);
  return pt.height;
}

// ───────────────────────── Runs ─────────────────────────

export function runLength(run: Pick<ServiceRun, 'points'>): number {
  let l = 0;
  for (let i = 1; i < run.points.length; i++) l += dist(run.points[i - 1], run.points[i]);
  return l;
}

/** Height a run travels at. */
export function runElevation(project: Project, derived: DerivedPlan, run: ServiceRun): number {
  if (run.level === 'floor') return -FLOOR_RUN_DEPTH;
  if (run.level === 'ceiling') return ceilingAt(project, derived, run.points[0]) + CEILING_RUN_GAP;
  return run.height;
}

/** The point of `system` a run end at `p` connects to, if any. */
export function pointNear(project: Project, derived: DerivedPlan, p: Vec2, system: ServiceSystem, tol = RUN_CONNECT): ServicePoint | null {
  let best: { pt: ServicePoint; d: number } | null = null;
  for (const pt of Object.values(project.servicePoints ?? {})) {
    if (SERVICE_POINTS[pt.kind].system !== system) continue;
    const d = dist(servicePointAt(derived, pt), p);
    if (d <= tol && (!best || d < best.d)) best = { pt, d };
  }
  return best?.pt ?? null;
}

/**
 * A run in 3D: its plan polyline at the run's height, with a drop (or rise) at each end to the
 * point it connects to.
 */
export function runPath3D(project: Project, derived: DerivedPlan, run: ServiceRun): [number, number, number][] {
  const y = runElevation(project, derived, run);
  const path: [number, number, number][] = run.points.map((p) => [p.x, y, p.y]);
  const ends = [0, run.points.length - 1];
  for (const i of ends) {
    const pt = pointNear(project, derived, run.points[i], run.system);
    if (!pt) continue;
    const at = servicePointAt(derived, pt);
    const z = pointElevation(project, derived, pt);
    if (Math.abs(z - y) < 0.01 && dist(at, run.points[i]) < 0.01) continue;
    const drop: [number, number, number][] = [
      [at.x, y, at.y],
      [at.x, z, at.y],
    ];
    if (i === 0) path.unshift(...drop.reverse());
    else path.push(...drop);
  }
  return path;
}

// ───────────────────────── Item connections ─────────────────────────

/** Distance from `p` to an item's footprint (0 inside). */
export function distToItem(o: Pick<PlacedObject, 'x' | 'y' | 'width' | 'depth' | 'rotation'>, p: Vec2): number {
  const l = rotate(sub(p, o), -o.rotation);
  const dx = Math.max(0, Math.abs(l.x) - o.width / 2);
  const dy = Math.max(0, Math.abs(l.y) - o.depth / 2);
  return Math.hypot(dx, dy);
}

/** Where a connection leaves an item: the point of its outline nearest `toward` (pulled a little inside). */
export function itemPort(o: Pick<PlacedObject, 'x' | 'y' | 'width' | 'depth' | 'rotation'>, toward: Vec2): Vec2 {
  const l = rotate(sub(toward, o), -o.rotation);
  const hw = Math.max(0, o.width / 2 - 0.04);
  const hd = Math.max(0, o.depth / 2 - 0.04);
  const c = { x: Math.max(-hw, Math.min(hw, l.x)), y: Math.max(-hd, Math.min(hd, l.y)) };
  return add(rotate(c, o.rotation), o);
}

export interface ServiceLinkInfo {
  objectId: string;
  system: ServiceSystem;
  pointId: string;
  /** Item end and point end (plan). */
  from: Vec2;
  to: Vec2;
  /** Chosen by hand rather than the nearest in reach. */
  manual: boolean;
  distance: number;
}

export interface ServiceNeedState {
  objectId: string;
  system: ServiceSystem;
  /** What it needs, in words. */
  need: string;
  /** Met by a connection to a point, or by a run that ends at the item. */
  met: boolean;
  link: ServiceLinkInfo | null;
  /** A run of the system ends at (or in) the item. */
  byRun: boolean;
}

export interface ServicesState {
  links: ServiceLinkInfo[];
  needs: ServiceNeedState[];
  /** Point id → items it serves. */
  serves: Map<string, string[]>;
}

/** Items that need services (shown in Services mode), skipping hidden ones. */
export function serviceItems(project: Project, needsOf: NeedsOf): { o: PlacedObject; needs: AssetServices }[] {
  const out: { o: PlacedObject; needs: AssetServices }[] = [];
  if (!project.layers.furniture.visible) return out;
  for (const o of Object.values(project.objects)) {
    if (isObjectHidden(project, o)) continue;
    const needs = needsOf(o);
    if (needs && neededSystems(needs).length) out.push({ o, needs });
  }
  return out;
}

/**
 * Every item's connections and unmet needs. Per need: the point picked by hand (while within
 * `PIN_REACH`), else the nearest compatible point within reach that the user has not disconnected.
 * A run of the system ending at the item also meets it.
 */
export function resolveServices(project: Project, derived: DerivedPlan, needsOf: NeedsOf): ServicesState {
  const pts = Object.values(project.servicePoints ?? {}).map((pt) => ({ pt, at: servicePointAt(derived, pt) }));
  const runs = Object.values(project.serviceRuns ?? {});
  const links: ServiceLinkInfo[] = [];
  const needs: ServiceNeedState[] = [];
  const serves = new Map<string, string[]>();
  // An appliance outlet is its own circuit: it serves one item.
  const taken = new Set<string>();
  for (const { o, needs: n } of serviceItems(project, needsOf)) {
    for (const system of neededSystems(n)) {
      const ok = new Set(pointsMeeting(system, n));
      const own = o.serviceLinks?.[system];
      const skip = new Set(own?.skip ?? []);
      let link: ServiceLinkInfo | null = null;
      const make = (e: (typeof pts)[number], manual: boolean, d: number): ServiceLinkInfo => ({
        objectId: o.id,
        system,
        pointId: e.pt.id,
        from: itemPort(o, e.at),
        to: { x: e.at.x, y: e.at.y },
        manual,
        distance: d,
      });
      if (own?.pin) {
        const e = pts.find((x) => x.pt.id === own.pin);
        if (e && SERVICE_POINTS[e.pt.kind].system === system) {
          const d = distToItem(o, e.at);
          if (d <= PIN_REACH) link = make(e, true, d);
        }
      }
      if (!link) {
        const reach = needReach(system, n);
        let best: { e: (typeof pts)[number]; d: number } | null = null;
        for (const e of pts) {
          if (!ok.has(e.pt.kind) || skip.has(e.pt.id) || taken.has(e.pt.id)) continue;
          const d = distToItem(o, e.at);
          if (d <= reach && (!best || d < best.d)) best = { e, d };
        }
        if (best) link = make(best.e, false, best.d);
      }
      const byRun = runs.some(
        (r) => r.system === system && [r.points[0], r.points[r.points.length - 1]].some((p) => distToItem(o, p) <= RUN_CONNECT),
      );
      if (link) {
        links.push(link);
        if (project.servicePoints[link.pointId]?.kind === 'dedicated') taken.add(link.pointId);
        const list = serves.get(link.pointId) ?? [];
        list.push(o.id);
        serves.set(link.pointId, list);
      }
      needs.push({ objectId: o.id, system, need: needLabel(system, n), met: !!link || byRun, link, byRun });
    }
  }
  return { links, needs, serves };
}

/** Compatible points for one need, nearest first, within `max` metres (for "Connect to…"). */
export function compatiblePoints(project: Project, derived: DerivedPlan, o: PlacedObject, system: ServiceSystem, needs: AssetServices, max = PIN_REACH): { pt: ServicePoint; d: number }[] {
  const ok = new Set(pointsMeeting(system, needs));
  return Object.values(project.servicePoints ?? {})
    .filter((pt) => SERVICE_POINTS[pt.kind].system === system)
    .map((pt) => ({ pt, d: distToItem(o, servicePointAt(derived, pt)), fits: ok.has(pt.kind) }))
    .filter((x) => x.d <= max)
    .sort((a, b) => Number(b.fits) - Number(a.fits) || a.d - b.d)
    .map(({ pt, d }) => ({ pt, d }));
}

// ───────────────────────── Suggestions ─────────────────────────

export type ServicePointInput = Omit<ServicePoint, 'id' | 'label' | 'note'> & Partial<Pick<ServicePoint, 'label' | 'note'>>;

/** Height of a socket or water point for an item: by the item when it hangs high, counter height over worktops, else low. */
function heightFor(o: PlacedObject, system: ServiceSystem): number {
  if (o.elevation >= 0.5) return Math.min(2.6, o.elevation + Math.min(o.height, 0.6) / 2);
  if (system === 'power' && o.height >= 0.8 && o.height <= 1.0 && o.depth >= 0.5) return 1.1;
  return system === 'water' ? 0.5 : 0.3;
}

/** A point that would meet one unmet need of an item ("Add missing points"), or null when none fits nearby. */
export function suggestPoint(derived: DerivedPlan, o: PlacedObject, system: ServiceSystem, needs: AssetServices): ServicePointInput | null {
  const kind = pointForNeed(system, needs);
  const info = SERVICE_POINTS[kind];
  const back = add(o, rotate({ x: 0, y: -o.depth * 0.25 }, o.rotation));
  if (info.hosts[0] === 'floor') {
    const at = kind === 'floor-drain' ? { x: o.x, y: o.y } : back;
    return { kind, x: at.x, y: at.y, host: 'floor', wallId: null, height: 0, rotation: 0 };
  }
  if (kind === 'light' && (o.elevation >= 1.6 || o.elevation + o.height >= 2.2)) {
    return { kind, x: o.x, y: o.y, host: 'ceiling', wallId: null, height: 0, rotation: 0 };
  }
  // Nearest wall to the item's back, then to its centre.
  const reach = Math.max(o.width, o.depth) / 2 + 1.2;
  const face = wallFaceAt(derived, back, reach) ?? wallFaceAt(derived, o, reach);
  if (face) {
    // Beside the item along the wall, so it is not hidden behind tall units.
    return { kind, x: face.p.x, y: face.p.y, host: 'wall', wallId: face.wallId, height: heightFor(o, system), rotation: face.rotation };
  }
  if (info.hosts.includes('floor')) return { kind, x: back.x, y: back.y, host: 'floor', wallId: null, height: 0, rotation: 0 };
  return null;
}

// ───────────────────────── Routing ─────────────────────────

export type ServiceRunInput = Omit<ServiceRun, 'id' | 'label'> & Partial<Pick<ServiceRun, 'label'>>;

/** Whether some run of the point's system starts or ends at it. */
export function pointHasRun(project: Project, derived: DerivedPlan, pt: ServicePoint): boolean {
  const at = servicePointAt(derived, pt);
  const system = SERVICE_POINTS[pt.kind].system;
  return Object.values(project.serviceRuns ?? {}).some(
    (r) => r.system === system && (dist(r.points[0], at) <= RUN_CONNECT || dist(r.points[r.points.length - 1], at) <= RUN_CONNECT),
  );
}

/**
 * Runs for every point that has none, chained like circuits: points join the network of their
 * system one at a time, nearest first, each with a right-angled run to the nearest point already on
 * it (starting from its main: Power in, Water in or Waste out). Ceiling points chain in the
 * ceiling; the rest run in the floor.
 */
export function routeToSources(project: Project, derived: DerivedPlan): ServiceRunInput[] {
  const out: ServiceRunInput[] = [];
  const all = Object.values(project.servicePoints ?? {});
  const manhattan = (a: Vec2, b: Vec2) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  for (const system of SERVICE_SYSTEMS) {
    const mine = all.filter((p) => SERVICE_POINTS[p.kind].system === system);
    const sources = mine.filter((p) => SERVICE_POINTS[p.kind].source);
    if (!sources.length) continue;
    // On the network: sources and points that already have a run (as plan spots, by level).
    const net: { p: Vec2; ceiling: boolean }[] = mine
      .filter((p) => SERVICE_POINTS[p.kind].source || pointHasRun(project, derived, p))
      .map((p) => ({ p: servicePointAt(derived, p), ceiling: p.host === 'ceiling' }));
    const todo = mine.filter((p) => !SERVICE_POINTS[p.kind].source && !pointHasRun(project, derived, p)).map((pt) => ({ pt, at: servicePointAt(derived, pt) }));
    while (todo.length) {
      // The waiting point closest to the network joins next (Prim's), so chains stay short.
      let best: { i: number; to: Vec2; d: number } | null = null;
      todo.forEach((t, i) => {
        const ceiling = t.pt.host === 'ceiling';
        // Ceiling points chain to ceiling points (or the source); the rest to the rest.
        for (const n of net) {
          if (n.ceiling !== ceiling && !sources.some((s) => dist(servicePointAt(derived, s), n.p) < 1e-6)) continue;
          const d = manhattan(t.at, n.p);
          if (!best || d < best.d) best = { i, to: n.p, d };
        }
      });
      if (!best) break;
      const { i, to } = best as { i: number; to: Vec2; d: number };
      const { pt, at } = todo.splice(i, 1)[0];
      const corner = Math.abs(to.x - at.x) > Math.abs(to.y - at.y) ? { x: to.x, y: at.y } : { x: at.x, y: to.y };
      const points = [{ x: at.x, y: at.y }, corner, { x: to.x, y: to.y }].filter((p, k, arr) => k === 0 || dist(p, arr[k - 1]) > 0.02);
      net.push({ p: at, ceiling: pt.host === 'ceiling' });
      if (points.length < 2) continue;
      out.push({ system, level: pt.host === 'ceiling' ? 'ceiling' : 'floor', hot: false, points, height: 0.3 });
    }
  }
  return out;
}

/** Nearest point on a wall centre line within `tol` (wall runs are drawn inside walls). */
export function wallCentreAt(derived: DerivedPlan, p: Vec2, tol: number): { p: Vec2; wallId: string } | null {
  let best: { p: Vec2; wallId: string; d: number } | null = null;
  for (const g of derived.network.walls.values()) {
    if (isDividerWall(g.wall) || g.wall.hidden) continue;
    const proj = projectOnPath(g.path, p);
    if (proj.dist <= g.h + tol && (!best || proj.dist < best.d)) best = { p: proj.point, wallId: g.wall.id, d: proj.dist };
  }
  return best ? { p: best.p, wallId: best.wallId } : null;
}

/** Totals for the Services panel: points per kind and run length per system. */
export function servicesSummary(project: Project): { points: Partial<Record<ServicePointKind, number>>; lengths: Record<ServiceSystem, number>; hot: number } {
  const points: Partial<Record<ServicePointKind, number>> = {};
  for (const pt of Object.values(project.servicePoints ?? {})) points[pt.kind] = (points[pt.kind] ?? 0) + 1;
  const lengths: Record<ServiceSystem, number> = { power: 0, water: 0, drain: 0 };
  let hot = 0;
  for (const r of Object.values(project.serviceRuns ?? {})) {
    const l = runLength(r);
    lengths[r.system] += l;
    if (r.system === 'water' && r.hot) hot += l;
  }
  return { points, lengths, hot };
}

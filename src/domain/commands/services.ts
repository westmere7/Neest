import type { Project, ServicePoint, ServiceRun, Vec2 } from '../model/schema';
import { ServicePointSchema, ServiceRunSchema } from '../model/schema';
import { SERVICE_POINTS, SERVICE_SYSTEM_INFO, type ServiceSystem } from '../model/services';
import { newId } from '../model/ids';
import type { DerivedPlan } from '../geometry/derive';
import { current, isDraft } from 'immer';
import { derivePlan } from '../geometry/derive';
import { RUN_CONNECT, placeServicePoint, resolveServices, routeToSources, suggestPoint, type NeedsOf, type ServicePointInput, type ServiceRunInput } from '../geometry/services';
import { dist } from '../geometry/vec';
import type { D } from './walls';

/** Adds a services point and returns its id. */
export function addServicePoint(d: D, input: ServicePointInput): string {
  const id = newId('svc');
  d.servicePoints ??= {};
  d.servicePoints[id] = ServicePointSchema.parse({ ...input, id });
  return id;
}

export function updateServicePoint(d: D, id: string, patch: Partial<Omit<ServicePoint, 'id'>>): void {
  const p = d.servicePoints?.[id];
  if (!p) return;
  Object.assign(p, patch);
  // Drainage stays in the floor; every kind keeps to a host it allows.
  const hosts = SERVICE_POINTS[p.kind].hosts;
  if (!hosts.includes(p.host)) p.host = hosts[0];
  if (p.host !== 'wall') p.wallId = null;
}

/** Adds a services run (drain runs are kept in the floor) and returns its id. */
export function addServiceRun(d: D, input: ServiceRunInput): string {
  const id = newId('run');
  d.serviceRuns ??= {};
  const run = ServiceRunSchema.parse({ ...input, id });
  fixRun(run);
  d.serviceRuns[id] = run;
  return id;
}

export function updateServiceRun(d: D, id: string, patch: Partial<Omit<ServiceRun, 'id'>>): void {
  const r = d.serviceRuns?.[id];
  if (!r) return;
  Object.assign(r, patch);
  fixRun(r);
}

function fixRun(r: ServiceRun): void {
  const levels = SERVICE_SYSTEM_INFO[r.system].levels;
  if (!levels.includes(r.level)) r.level = levels[0];
  if (r.system !== 'water') r.hot = false;
}

/**
 * Moves points by `delta` from their positions in `base`. Wall points slide along walls and step
 * onto another wall they are moved to; away from every wall they stay at their last wall position.
 * Floor and ceiling points never leave the rooms.
 */
export function moveServicePoints(d: D, derived: DerivedPlan, base: Record<string, Vec2>, delta: Vec2): void {
  for (const [id, b] of Object.entries(base)) {
    const p = d.servicePoints?.[id];
    if (!p) continue;
    const target = { x: b.x + delta.x, y: b.y + delta.y };
    if (p.host === 'wall') {
      const at = placeServicePoint(derived, p.kind, target, 'wall', 0.9);
      if (!at.valid) continue;
      p.x = at.x;
      p.y = at.y;
      p.wallId = at.wallId;
      p.rotation = at.rotation;
    } else if (placeServicePoint(derived, p.kind, target, p.host).valid) {
      // Floor and ceiling points stay inside rooms: outside one they keep their last spot.
      p.x = target.x;
      p.y = target.y;
    }
  }
}

/** Moves whole runs by `delta` from their vertices in `base`. */
export function moveServiceRuns(d: D, base: Record<string, Vec2[]>, delta: Vec2): void {
  for (const [id, pts] of Object.entries(base)) {
    const r = d.serviceRuns?.[id];
    if (r) r.points = pts.map((p) => ({ x: p.x + delta.x, y: p.y + delta.y }));
  }
}

export function setRunVertex(d: D, id: string, index: number, p: Vec2): void {
  const r = d.serviceRuns?.[id];
  if (r && r.points[index]) r.points[index] = { x: p.x, y: p.y };
}

/** Adds a bend after vertex `index`. */
export function insertRunVertex(d: D, id: string, index: number, p: Vec2): void {
  const r = d.serviceRuns?.[id];
  if (r && index >= 0 && index < r.points.length - 1 && r.points.length < 200) r.points.splice(index + 1, 0, { x: p.x, y: p.y });
}

/** Removes a bend (a run keeps at least its two ends). */
export function removeRunVertex(d: D, id: string, index: number): void {
  const r = d.serviceRuns?.[id];
  if (r && r.points.length > 2 && r.points[index]) r.points.splice(index, 1);
}

/**
 * Deletes the points and runs among `ids` and forgets connections to deleted points. A deleted
 * point takes the runs that end at it along; the points those runs led to are linked again to the
 * nearest point still on their network, so no wiring or pipe is left hanging.
 */
export function deleteServices(d: D, ids: string[]): void {
  const gone = new Set<string>();
  const relink = new Set<string>();
  for (const id of ids) {
    const pt = d.servicePoints?.[id];
    if (pt) {
      const system = SERVICE_POINTS[pt.kind].system;
      for (const r of Object.values(d.serviceRuns ?? {})) {
        if (r.system !== system) continue;
        const ends = [r.points[0], r.points[r.points.length - 1]];
        const at = ends.findIndex((e) => dist(e, pt) <= RUN_CONNECT);
        if (at < 0) continue;
        // The point at the other end loses this run.
        const other = ends[1 - at];
        for (const q of Object.values(d.servicePoints)) if (q.id !== id && SERVICE_POINTS[q.kind].system === system && dist(other, q) <= RUN_CONNECT) relink.add(q.id);
        delete d.serviceRuns[r.id];
      }
      delete d.servicePoints[id];
      gone.add(id);
    }
    if (d.serviceRuns?.[id]) delete d.serviceRuns[id];
  }
  for (const id of gone) relink.delete(id);
  if (gone.size) pruneServiceLinks(d, gone);
  if (relink.size) {
    const p = (isDraft(d) ? current(d) : d) as Project;
    for (const r of routeToSources(p, derivePlan(p), relink)) addServiceRun(d, r);
  }
}

/** Drops connection overrides that name missing points. */
export function pruneServiceLinks(d: D, gone?: Set<string>): void {
  const exists = (id: string) => (gone ? !gone.has(id) : !!d.servicePoints?.[id]);
  for (const o of Object.values(d.objects)) {
    const links = o.serviceLinks;
    if (!links) continue;
    for (const sys of Object.keys(links) as ServiceSystem[]) {
      const l = links[sys];
      if (!l) continue;
      if (l.pin && !exists(l.pin)) l.pin = null;
      l.skip = l.skip.filter(exists);
      if (!l.pin && !l.skip.length) delete links[sys];
    }
    if (!Object.keys(links).length) delete o.serviceLinks;
  }
}

/** Copies of points and runs shifted by `offset`; returns the new ids. */
export function duplicateServices(d: D, ids: string[], offset: Vec2): string[] {
  const out: string[] = [];
  for (const id of ids) {
    const p = d.servicePoints?.[id];
    if (p) {
      const nid = newId('svc');
      d.servicePoints[nid] = { ...JSON.parse(JSON.stringify(p)), id: nid, x: p.x + offset.x, y: p.y + offset.y };
      out.push(nid);
      continue;
    }
    const r = d.serviceRuns?.[id];
    if (r) {
      const nid = newId('run');
      d.serviceRuns[nid] = { ...JSON.parse(JSON.stringify(r)), id: nid, points: r.points.map((q) => ({ x: q.x + offset.x, y: q.y + offset.y })) };
      out.push(nid);
    }
  }
  return out;
}

/** Connects an item's need to a chosen point (it stays connected while within reach). */
export function connectService(d: D, objectId: string, system: ServiceSystem, pointId: string): void {
  const o = d.objects[objectId];
  if (!o) return;
  o.serviceLinks ??= {};
  const l = (o.serviceLinks[system] ??= { pin: null, skip: [] });
  l.pin = pointId;
  l.skip = l.skip.filter((x) => x !== pointId);
}

/** Disconnects an item's need from a point: automatic connection skips that point from now on. */
export function disconnectService(d: D, objectId: string, system: ServiceSystem, pointId: string): void {
  const o = d.objects[objectId];
  if (!o) return;
  o.serviceLinks ??= {};
  const l = (o.serviceLinks[system] ??= { pin: null, skip: [] });
  if (l.pin === pointId) l.pin = null;
  if (!l.skip.includes(pointId)) l.skip = [...l.skip, pointId].slice(-50);
}

/** Back to fully automatic connections for the given items (all systems, or one). */
export function resetServiceLinks(d: D, objectIds: string[], system?: ServiceSystem): void {
  for (const id of objectIds) {
    const o = d.objects[id];
    if (!o?.serviceLinks) continue;
    if (system) delete o.serviceLinks[system];
    if (!system || !Object.keys(o.serviceLinks).length) delete o.serviceLinks;
  }
}

/** Ids of every point and run (Select all in Services mode). */
export const allServiceIds = (p: Pick<Project, 'servicePoints' | 'serviceRuns'>) => [...Object.keys(p.servicePoints ?? {}), ...Object.keys(p.serviceRuns ?? {})];

/**
 * Adds a point for every unmet need (of the items in `only`, or all), one at a time: each new point
 * may already serve the next item, so neighbours share a socket instead of getting one each. Returns
 * how many were added.
 */
export function addMissingServicePoints(d: D, needsOf: NeedsOf, only?: ReadonlySet<string>): number {
  let added = 0;
  const skip = new Set<string>();
  for (let guard = 0; guard < 500; guard++) {
    const p = (isDraft(d) ? current(d) : d) as Project;
    const derived = derivePlan(p);
    const next = resolveServices(p, derived, needsOf).needs.find(
      (n) => !n.met && (!only || only.has(n.objectId)) && !skip.has(`${n.objectId}:${n.system}`),
    );
    if (!next) break;
    const o = p.objects[next.objectId];
    const needs = needsOf(o);
    const input = needs ? suggestPoint(derived, o, next.system, needs) : null;
    if (!input) {
      skip.add(`${next.objectId}:${next.system}`);
      continue;
    }
    const id = addServicePoint(d, input);
    const after = (isDraft(d) ? current(d) : d) as Project;
    const met = resolveServices(after, derivePlan(after), needsOf).needs.some((n) => n.objectId === next.objectId && n.system === next.system && n.met);
    if (met) added++;
    else {
      // The point would not reach the item (e.g. the nearest wall is too far): leave the need for the user.
      delete d.servicePoints[id];
      skip.add(`${next.objectId}:${next.system}`);
    }
  }
  return added;
}

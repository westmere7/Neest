import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import '@/packs/loader';
import { createEmptyProject } from '../model/defaults';
import type { AssetServices } from '../model/services';
import { SERVICE_POINTS, formatServices, parseServices } from '../model/services';
import type { PlacedObject, Project } from '../model/schema';
import { migrateProject } from '@/storage/migrations';
import { derivePlan } from '../geometry/derive';
import {
  placeServicePoint,
  resolveServices,
  routeToSources,
  runPath3D,
  servicePointAt,
  suggestPoint,
  type NeedsOf,
} from '../geometry/services';
import type { D } from './walls';
import { addRectangleWalls } from './walls';
import { deleteEntities, duplicateEntities, placeObject, reconcileRooms } from './entities';
import { addOption, switchOption } from './options';
import {
  addServicePoint,
  addServiceRun,
  connectService,
  disconnectService,
  moveServicePoints,
  resetServiceLinks,
  updateServicePoint,
} from './services';
import { ASSET_CATALOG, ASSETS_BY_ID, ITEM_SERVICES_MAP } from '@/data/assets/catalog';

const edit = (p: Project, fn: (d: D) => void): Project => produce(p, fn);
const W = { thickness: 0.2, height: 2.7, role: 'interior' as const };

/** A 4 × 3 m room (walls 0.2 thick, centre lines on the rectangle) with a "dishwasher" against the top wall. */
function room(): { p: Project; dw: string } {
  let dw = '';
  const p = edit(createEmptyProject(), (d) => {
    addRectangleWalls(d, { x: 0, y: 0 }, { x: 4, y: 3 }, W);
    reconcileRooms(d);
    dw = placeObject(d, { assetId: 'bosch-dishwashers:sms4hvi33e', x: 1, y: 0.4, width: 0.6, depth: 0.6, height: 0.85 });
  });
  return { p, dw };
}

const DISHWASHER: AssetServices = { power: 'dedicated', water: 'cold', drain: 'waste' };
const needsOf: NeedsOf = (o: PlacedObject) => (o.assetId.includes('dishwasher') ? DISHWASHER : undefined);

describe('services catalogue', () => {
  it('reads and writes the compact needs form, and rejects typos', () => {
    expect(parseServices('power:dedicated water drain')).toEqual(DISHWASHER);
    expect(parseServices('water:hot drain:soil')).toEqual({ water: 'hot', drain: 'soil' });
    expect(formatServices({ power: 'plug', water: 'hot' })).toBe('power water:hot');
    expect(() => parseServices('power:nuclear')).toThrow(/Unknown service token/);
    expect(() => parseServices('gas')).toThrow();
  });

  it('keeps drainage in the floor', () => {
    for (const k of ['floor-drain', 'waste', 'toilet-outlet', 'stack'] as const) expect(SERVICE_POINTS[k].hosts).toEqual(['floor']);
  });

  it('gives every library item its needs, and every needs entry a library item', () => {
    for (const id of Object.keys(ITEM_SERVICES_MAP)) expect(ASSETS_BY_ID[id], id).toBeTruthy();
    const needs = (id: string) => ASSETS_BY_ID[id]?.services;
    expect(needs('bosch-dishwashers:sms4hvi33e')).toEqual(DISHWASHER);
    expect(needs('branded-bathroom-vn:toto-ms885de2')).toMatchObject({ water: 'cold', drain: 'soil' });
    expect(needs('branded-bathroom-vn:ariston-sl2-20-rs')).toMatchObject({ power: 'dedicated', water: 'hot' });
    expect(needs('kitchen-counters:run-240-sink-hob')).toEqual({ power: 'dedicated', water: 'hot', drain: 'waste' });
    expect(needs('dining-chair')).toBeUndefined();
    // Whole shelves: TVs, lamps and AC units need power, toilets a soil outlet, washers all three.
    for (const a of ASSET_CATALOG) {
      if (a.group === 'Toilets' && a.id !== 'bidet') expect(a.services?.drain, a.id).toBe('soil');
      if (a.group === 'TV & audio' && /tv/i.test(a.name)) expect(a.services?.power, a.id).toBeTruthy();
      if (a.group === 'Ceiling lights' && !/solar|candle/i.test(a.name)) expect(a.services?.power, a.id).toBeTruthy();
      if (a.group === 'Laundry' && /washing machine|washer|loader/i.test(a.name) && !/\bmat\b/i.test(a.name)) expect(a.services, a.id).toMatchObject({ power: 'dedicated', water: 'cold', drain: 'waste' });
    }
  });
});

describe('services placement', () => {
  it('puts wall points inside the nearest wall face and drains in the floor', () => {
    const { p } = room();
    const derived = derivePlan(p);
    // Near the top wall (centre line y = 0, inner face y = 0.1), from inside the room.
    const s = placeServicePoint(derived, 'socket', { x: 2, y: 0.4 });
    expect(s).toMatchObject({ host: 'wall', valid: true });
    expect(s.y).toBeGreaterThan(0.05);
    expect(s.y).toBeLessThan(0.1);
    // Facing into the room (+y).
    expect(Math.sin(s.rotation)).toBeCloseTo(1, 5);
    // Away from walls a socket becomes a floor box; a switch can't go there.
    expect(placeServicePoint(derived, 'socket', { x: 2, y: 1.5 })).toMatchObject({ host: 'floor', valid: true });
    expect(placeServicePoint(derived, 'switch', { x: 2, y: 1.5 }).valid).toBe(false);
    // Drains stay where they are, in the floor, even next to a wall.
    expect(placeServicePoint(derived, 'floor-drain', { x: 2, y: 0.2 })).toMatchObject({ host: 'floor', x: 2, y: 0.2 });
    // A host the kind doesn't allow is not used.
    let id = '';
    let q = edit(p, (d) => {
      id = addServicePoint(d, { kind: 'waste', x: 1, y: 1, host: 'floor', wallId: null, height: 0, rotation: 0 });
    });
    q = edit(q, (d) => updateServicePoint(d, id, { host: 'wall' }));
    expect(q.servicePoints[id].host).toBe('floor');
  });

  it('slides wall points along walls when moved and keeps them on a wall', () => {
    const { p } = room();
    const derived = derivePlan(p);
    const pl = placeServicePoint(derived, 'socket', { x: 1, y: 0.3 });
    let id = '';
    let q = edit(p, (d) => {
      id = addServicePoint(d, { kind: 'socket', ...pl, height: 0.3 });
    });
    const base = { [id]: servicePointAt(derived, q.servicePoints[id]) };
    q = edit(q, (d) => moveServicePoints(d, derived, base, { x: 1.5, y: 0.2 }));
    expect(q.servicePoints[id].x).toBeCloseTo(2.5, 5);
    expect(q.servicePoints[id].y).toBeLessThan(0.1);
    // Dragged to the middle of the room it stays on its last wall position.
    const before = { ...q.servicePoints[id] };
    q = edit(q, (d) => moveServicePoints(d, derived, { [id]: servicePointAt(derived, q.servicePoints[id]) }, { x: 0, y: 1.4 }));
    expect(q.servicePoints[id]).toMatchObject({ x: before.x, y: before.y });
  });
});

describe('item connections', () => {
  it('connects each need to the nearest compatible point in reach, and drops it out of reach', () => {
    const r0 = room();
    let p = r0.p;
    const dw = r0.dw;
    let derived = derivePlan(p);
    let s = resolveServices(p, derived, needsOf);
    expect(s.needs.filter((n) => n.objectId === dw).map((n) => n.met)).toEqual([false, false, false]);
    let socket = '';
    let plainSocket = '';
    let water = '';
    let drain = '';
    p = edit(p, (d) => {
      plainSocket = addServicePoint(d, { kind: 'socket', ...placeServicePoint(derived, 'socket', { x: 0.5, y: 0.3 }), height: 0.3 });
      socket = addServicePoint(d, { kind: 'dedicated', ...placeServicePoint(derived, 'dedicated', { x: 1.6, y: 0.3 }), height: 0.3 });
      water = addServicePoint(d, { kind: 'water-cold', ...placeServicePoint(derived, 'water-cold', { x: 1.2, y: 0.3 }), height: 0.5 });
      drain = addServicePoint(d, { kind: 'waste', x: 1, y: 0.3, host: 'floor', wallId: null, height: 0, rotation: 0 });
    });
    derived = derivePlan(p);
    s = resolveServices(p, derived, needsOf);
    const by = (sys: string) => s.links.find((l) => l.objectId === dw && l.system === sys);
    // A plain socket can't serve a dedicated-circuit appliance.
    expect(by('power')?.pointId).toBe(socket);
    expect(by('water')?.pointId).toBe(water);
    expect(by('drain')?.pointId).toBe(drain);
    expect(s.serves.get(socket)).toEqual([dw]);
    expect(s.serves.get(plainSocket)).toBeUndefined();
    // Moved across the room: out of reach, the needs are unmet again.
    const far = edit(p, (d) => {
      d.objects[dw].x = 3.4;
      d.objects[dw].y = 2.4;
    });
    expect(resolveServices(far, derived, needsOf).needs.filter((n) => n.met)).toHaveLength(0);
  });

  it('disconnecting skips that point, connecting by hand pins one, reset goes back to automatic', () => {
    const r0 = room();
    let p = r0.p;
    const dw = r0.dw;
    const derived = derivePlan(p);
    let a = '';
    let b = '';
    p = edit(p, (d) => {
      a = addServicePoint(d, { kind: 'dedicated', ...placeServicePoint(derived, 'dedicated', { x: 1.2, y: 0.3 }), height: 0.3 });
      b = addServicePoint(d, { kind: 'dedicated', ...placeServicePoint(derived, 'dedicated', { x: 2.2, y: 0.3 }), height: 0.3 });
    });
    const power = (q: Project) => resolveServices(q, derivePlan(q), needsOf).links.find((l) => l.system === 'power');
    expect(power(p)?.pointId).toBe(a);
    // Disconnect from the nearest: the next one in reach takes over.
    p = edit(p, (d) => disconnectService(d, dw, 'power', a));
    expect(power(p)?.pointId).toBe(b);
    p = edit(p, (d) => disconnectService(d, dw, 'power', b));
    expect(power(p)).toBeUndefined();
    // Connect by hand to a skipped point.
    p = edit(p, (d) => connectService(d, dw, 'power', a));
    expect(power(p)).toMatchObject({ pointId: a, manual: true });
    p = edit(p, (d) => resetServiceLinks(d, [dw]));
    expect(p.objects[dw].serviceLinks).toBeUndefined();
    expect(power(p)?.pointId).toBe(a);
    // Deleting a point forgets it in the item's overrides.
    p = edit(p, (d) => disconnectService(d, dw, 'power', b));
    p = edit(p, (d) => deleteEntities(d, [b]));
    expect(p.objects[dw].serviceLinks).toBeUndefined();
    expect(p.servicePoints[b]).toBeUndefined();
  });

  it('suggests points that meet the needs (wall sockets and water, floor drain)', () => {
    const r0 = room();
    let p = r0.p;
    const dw = r0.dw;
    const derived = derivePlan(p);
    const o = p.objects[dw];
    const sugg = (['power', 'water', 'drain'] as const).map((sys) => suggestPoint(derived, o, sys, DISHWASHER)!);
    expect(sugg.map((x) => x.kind)).toEqual(['dedicated', 'water-cold', 'waste']);
    expect(sugg.map((x) => x.host)).toEqual(['wall', 'wall', 'floor']);
    p = edit(p, (d) => {
      for (const x of sugg) addServicePoint(d, x);
    });
    expect(resolveServices(p, derivePlan(p), needsOf).needs.every((n) => n.met)).toBe(true);
  });
});

describe('runs', () => {
  it('routes points without a run to the nearest source and drops to the point in 3D', () => {
    let { p } = room();
    const derived = derivePlan(p);
    p = edit(p, (d) => {
      addServicePoint(d, { kind: 'panel', ...placeServicePoint(derived, 'panel', { x: 3.7, y: 1.5 }), height: 1.6 });
      addServicePoint(d, { kind: 'socket', ...placeServicePoint(derived, 'socket', { x: 1, y: 0.3 }), height: 0.3 });
      addServicePoint(d, { kind: 'waste', x: 1, y: 1, host: 'floor', wallId: null, height: 0, rotation: 0 });
    });
    const runs = routeToSources(p, derivePlan(p));
    // Only power has a source.
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ system: 'power', level: 'floor' });
    let id = '';
    p = edit(p, (d) => {
      id = addServiceRun(d, runs[0]);
    });
    expect(routeToSources(p, derivePlan(p))).toHaveLength(0);
    const path = runPath3D(p, derivePlan(p), p.serviceRuns[id]);
    // Starts at the socket (0.3 up), drops into the floor, ends rising to the panel at 1.6.
    expect(path[0][1]).toBeCloseTo(0.3, 5);
    expect(path[path.length - 1][1]).toBeCloseTo(1.6, 5);
    expect(Math.min(...path.map((q) => q[1]))).toBeLessThan(0);
    // Drain runs stay in the floor.
    p = edit(p, (d) => {
      id = addServiceRun(d, { system: 'drain', level: 'wall', hot: true, points: [{ x: 0, y: 0 }, { x: 1, y: 0 }], height: 0.3 });
    });
    expect(p.serviceRuns[id]).toMatchObject({ level: 'floor', hot: false });
  });

  it('chains points like a circuit: each joins the nearest point already connected', () => {
    let p = room().p;
    const derived = derivePlan(p);
    p = edit(p, (d) => {
      addServicePoint(d, { kind: 'panel', ...placeServicePoint(derived, 'panel', { x: 0.3, y: 1.5 }), height: 1.6 });
      for (const x of [1, 2, 3]) addServicePoint(d, { kind: 'light', x, y: 1.5, host: 'ceiling', wallId: null, height: 0, rotation: 0 });
    });
    const runs = routeToSources(p, derivePlan(p));
    expect(runs).toHaveLength(3);
    expect(runs.every((r) => r.level === 'ceiling')).toBe(true);
    // 0.9 + 1 + 1 m of cable, not 0.9 + 1.9 + 2.9 back to the panel each time.
    const total = runs.reduce((s, r) => s + r.points.slice(1).reduce((t, q, i) => t + Math.hypot(q.x - r.points[i].x, q.y - r.points[i].y), 0), 0);
    expect(total).toBeLessThan(3.1);
  });

  it('duplicates and deletes with the selection, belongs to each layout option and survives repair', () => {
    let { p } = room();
    let pt = '';
    let run = '';
    p = edit(p, (d) => {
      pt = addServicePoint(d, { kind: 'floor-drain', x: 1, y: 1, host: 'floor', wallId: null, height: 0, rotation: 0 });
      run = addServiceRun(d, { system: 'drain', level: 'floor', hot: false, points: [{ x: 1, y: 1 }, { x: 2, y: 1 }], height: 0 });
    });
    let copies: string[] = [];
    p = edit(p, (d) => {
      copies = duplicateEntities(d, [pt, run], { x: 0.3, y: 0.3 });
    });
    expect(copies).toHaveLength(2);
    expect(p.servicePoints[copies[0]]).toMatchObject({ x: 1.3, y: 1.3 });
    expect(p.serviceRuns[copies[1]].points[0]).toEqual({ x: 1.3, y: 1.3 });
    p = edit(p, (d) => deleteEntities(d, copies));
    expect(Object.keys(p.servicePoints)).toEqual([pt]);
    // A "same walls, no furniture" option keeps the building's services; a blank one has none.
    let opt = '';
    p = edit(p, (d) => {
      opt = addOption(d, 'shell');
    });
    expect(Object.keys(p.servicePoints)).toEqual([pt]);
    p = edit(p, (d) => void addOption(d, 'blank'));
    expect(p.servicePoints).toEqual({});
    p = edit(p, (d) => {
      switchOption(d, opt);
    });
    expect(Object.keys(p.serviceRuns)).toEqual([run]);
    // Older files load without services; a wall point whose wall is gone keeps its spot.
    const raw = JSON.parse(JSON.stringify(p));
    delete raw.servicePoints;
    expect(migrateProject(raw).project.servicePoints).toEqual({});
    const raw2 = JSON.parse(JSON.stringify(p));
    raw2.servicePoints.x1 = { id: 'x1', kind: 'socket', x: 0, y: 0, host: 'wall', wallId: 'w_missing' };
    expect(migrateProject(raw2).project.servicePoints.x1).toMatchObject({ wallId: null, height: 0.3, label: '' });
  });
});

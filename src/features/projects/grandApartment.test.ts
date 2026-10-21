import { describe, expect, it } from 'vitest';
import '@/packs/loader';
import { ProjectSchema, type PlacedObject, type Vec2 } from '@/domain/model/schema';
import { computeWallNetwork } from '@/domain/geometry/walls';
import { detectRoomFaces, pointInFace } from '@/domain/geometry/rooms';
import { derivePlan } from '@/domain/geometry/derive';
import { rectPolygon } from '@/domain/geometry/polygon';
import { setNodePositions } from '@/domain/commands/walls';
import { ASSETS_BY_ID } from '@/data/assets/catalog';
import { useProjectStore } from '@/state/projectStore';
import { buildDxf, parseDxfPairs } from '@/features/exports/dxf';
import { buildSheet, defaultSheetOptions } from '@/features/exports/sheet';
import { buildReport } from '@/features/exports/report';
import { buildGrandApartmentProject } from './grandApartmentProject';
import { SAMPLES } from './demoProject';

/** Separating-axis test for two convex polygons (touching edges do not count). */
function overlaps(a: Vec2[], b: Vec2[], eps = 0.01): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const nx = poly[(i + 1) % poly.length].y - poly[i].y;
      const ny = poly[i].x - poly[(i + 1) % poly.length].x;
      const len = Math.hypot(nx, ny);
      const pa = a.map((v) => (v.x * nx + v.y * ny) / len);
      const pb = b.map((v) => (v.x * nx + v.y * ny) / len);
      if (Math.max(...pa) - eps <= Math.min(...pb) || Math.max(...pb) - eps <= Math.min(...pa)) return false;
    }
  }
  return true;
}

const footprint = (o: PlacedObject) => rectPolygon(o.x, o.y, o.width, o.depth, o.rotation);

const ROOMS = [
  'En-suite',
  'Family bathroom',
  'Guest room',
  'Hall & foyer',
  "Kids' room",
  'Living, dining & kitchen',
  'Master bedroom',
  'Pantry & laundry',
  'Study',
  'Walk-in closet',
];

describe('grand apartment stress sample', () => {
  const p = buildGrandApartmentProject();

  it('is registered as a sample and validates against the schema', () => {
    expect(SAMPLES.some((s) => s.id === 'grand')).toBe(true);
    expect(ProjectSchema.safeParse(JSON.parse(JSON.stringify(p))).success).toBe(true);
  });

  it('has ten named rooms totalling about 200 m²', () => {
    const faces = detectRoomFaces(p);
    expect(faces).toHaveLength(10);
    expect(Object.values(p.rooms).map((r) => r.name).sort()).toEqual(ROOMS);
    const total = faces.reduce((s, f) => s + f.area, 0);
    expect(total).toBeGreaterThan(195);
    expect(total).toBeLessThan(215);
    expect(faces.every((f) => !f.degraded)).toBe(true);
  });

  it('fits all 28 openings, three of them on the curved bay', () => {
    expect(Object.keys(p.openings)).toHaveLength(28);
    const net = computeWallNetwork(p);
    for (const g of net.walls.values()) for (const sp of g.spans) expect(sp.clamped, sp.id).toBe(false);
    const bay = [...net.walls.values()].find((g) => g.wall.role === 'exterior' && g.path.control);
    expect(bay?.spans.length).toBe(3);
  });

  it('is densely decorated with known assets, nothing colliding or poking through walls', () => {
    const d = derivePlan(p);
    expect(d.diagnostics.filter((x) => x.level === 'error')).toEqual([]);
    const objects = Object.values(p.objects);
    expect(objects.length).toBeGreaterThanOrEqual(200);
    for (const o of objects) expect(ASSETS_BY_ID[o.assetId], o.assetId).toBeDefined();
    expect(objects.filter((o) => ['decor', 'lighting'].includes(ASSETS_BY_ID[o.assetId].category)).length).toBeGreaterThanOrEqual(80);
    const faces = detectRoomFaces(p);
    const solid = objects.filter((o) => {
      const a = ASSETS_BY_ID[o.assetId];
      return a.mount === 'floor' && o.elevation === 0 && o.height > 0.3 && a.category !== 'decor';
    });
    for (const o of solid) for (const v of footprint(o)) expect(faces.some((f) => pointInFace(v, f)), `${o.assetId} at ${o.x},${o.y}`).toBe(true);
    for (let i = 0; i < solid.length; i++)
      for (let j = i + 1; j < solid.length; j++)
        expect(overlaps(footprint(solid[i]), footprint(solid[j])), `${solid[i].assetId} vs ${solid[j].assetId}`).toBe(false);
  });

  it('derives the full plan quickly enough for interactive editing', () => {
    const runs = 10;
    const t0 = performance.now();
    for (let i = 0; i < runs; i++) derivePlan({ ...p, walls: { ...p.walls }, nodes: { ...p.nodes } });
    expect((performance.now() - t0) / runs).toBeLessThan(120);
  });

  it('exports DXF, a scaled sheet and a summary without errors', () => {
    const pairs = parseDxfPairs(buildDxf(p, { unit: 'mm', furniture: true, dimensions: true, labels: true, rooms: true }));
    expect(pairs.at(-1)).toEqual({ code: 0, value: 'EOF' });
    const sheet = buildSheet(p, { ...defaultSheetOptions(p), paper: 'A2', scale: 50 });
    expect(sheet.warnings).toEqual([]);
    expect(buildReport(p).totals.rooms).toBe(10);
  });

  it('survives heavy editing: a whole-plan drag, mass delete, undo and redo', () => {
    const store = useProjectStore.getState();
    store.load(p);
    const count = Object.keys(p.objects).length;
    store.begin('Shift everything');
    for (let i = 1; i <= 10; i++) {
      useProjectStore.getState().preview((d) => {
        const pos: Record<string, Vec2> = {};
        for (const n of Object.values(p.nodes)) pos[n.id] = { x: n.x + i * 0.01, y: n.y };
        setNodePositions(d, pos);
      });
    }
    useProjectStore.getState().commit();
    expect(detectRoomFaces(useProjectStore.getState().project!)).toHaveLength(10);
    useProjectStore.getState().execute('Delete all furniture', (d) => {
      for (const id of Object.keys(d.objects)) delete d.objects[id];
    });
    useProjectStore.getState().undo();
    expect(Object.keys(useProjectStore.getState().project!.objects)).toHaveLength(count);
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().project).toBe(p);
    useProjectStore.getState().redo();
    expect(Object.values(useProjectStore.getState().project!.rooms).map((r) => r.name).sort()).toEqual(ROOMS);
  });
});

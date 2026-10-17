import { describe, expect, it } from 'vitest';
import { ProjectSchema, type PlacedObject, type Vec2 } from '@/domain/model/schema';
import { derivePlan } from '@/domain/geometry/derive';
import { rectPolygon } from '@/domain/geometry/polygon';
import { ASSETS_BY_ID } from '@/data/assets/catalog';
import { buildDemoProject, buildStudioProject, SAMPLES } from './demoProject';

/** Separating-axis test for two convex polygons (touching edges do not count). */
function overlaps(a: Vec2[], b: Vec2[], eps = 0.01): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i];
      const q = poly[(i + 1) % poly.length];
      const nx = q.y - p.y;
      const ny = p.x - q.x;
      const len = Math.hypot(nx, ny);
      const proj = (pts: Vec2[]) => pts.map((v) => (v.x * nx + v.y * ny) / len);
      const pa = proj(a);
      const pb = proj(b);
      if (Math.max(...pa) - eps <= Math.min(...pb) || Math.max(...pb) - eps <= Math.min(...pa)) return false;
    }
  }
  return true;
}

const footprint = (o: PlacedObject) => rectPolygon(o.x, o.y, o.width, o.depth, o.rotation);

/** Free-standing floor items that must not intersect each other. */
function solidFloorItems(objects: PlacedObject[]) {
  return objects.filter((o) => {
    const a = ASSETS_BY_ID[o.assetId];
    return a && a.mount === 'floor' && o.elevation === 0 && o.height > 0.3 && a.category !== 'decor';
  });
}

describe('sample projects', () => {
  it('lists the samples', () => {
    expect(SAMPLES.map((s) => s.id)).toEqual(['apartment', 'studio', 'loft']);
  });

  it('builds the studio as a single 9 m × 4.5 m room', () => {
    const p = buildStudioProject();
    expect(ProjectSchema.safeParse(JSON.parse(JSON.stringify(p))).success).toBe(true);
    const d = derivePlan(p);
    expect(d.faces).toHaveLength(1);
    const f = d.faces[0];
    expect(f.bounds.maxX - f.bounds.minX).toBeCloseTo(9, 6);
    expect(f.bounds.maxY - f.bounds.minY).toBeCloseTo(4.5, 6);
    expect(f.area).toBeCloseTo(40.5, 6);
    expect(d.faceRooms[0]?.name).toBe('Studio');
    expect(Object.keys(p.openings)).toHaveLength(5);
    expect(d.diagnostics).toEqual([]);
  });

  it('furnishes the studio with every asset inside the room and no colliding furniture', () => {
    const p = buildStudioProject();
    const objects = Object.values(p.objects);
    expect(objects.length).toBeGreaterThanOrEqual(30);
    for (const o of objects) {
      expect(ASSETS_BY_ID[o.assetId], o.assetId).toBeDefined();
      for (const v of footprint(o)) {
        expect(v.x, `${o.assetId} x`).toBeGreaterThanOrEqual(-0.01);
        expect(v.x, `${o.assetId} x`).toBeLessThanOrEqual(9.01);
        expect(v.y, `${o.assetId} y`).toBeGreaterThanOrEqual(-0.01);
        expect(v.y, `${o.assetId} y`).toBeLessThanOrEqual(4.51);
      }
    }
    const solid = solidFloorItems(objects);
    for (let i = 0; i < solid.length; i++)
      for (let j = i + 1; j < solid.length; j++)
        expect(overlaps(footprint(solid[i]), footprint(solid[j])), `${solid[i].assetId} vs ${solid[j].assetId}`).toBe(false);
  });

  it('keeps the apartment sample valid', () => {
    const p = buildDemoProject();
    const d = derivePlan(p);
    expect(d.faces).toHaveLength(6);
    expect(d.diagnostics).toEqual([]);
    expect(ProjectSchema.safeParse(JSON.parse(JSON.stringify(p))).success).toBe(true);
  });
});

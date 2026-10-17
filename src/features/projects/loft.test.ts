import { describe, expect, it } from 'vitest';
import { ProjectSchema } from '@/domain/model/schema';
import { computeWallNetwork } from '@/domain/geometry/walls';
import { detectRoomFaces } from '@/domain/geometry/rooms';
import { derivePlan } from '@/domain/geometry/derive';
import { setNodePositions } from '@/domain/commands/walls';
import { ASSETS_BY_ID } from '@/data/assets/catalog';
import { useProjectStore } from '@/state/projectStore';
import { buildDxf, parseDxfPairs } from '@/features/exports/dxf';
import { buildSheet, defaultSheetOptions } from '@/features/exports/sheet';
import { buildReport } from '@/features/exports/report';
import { buildLoftProject } from './loftProject';
import { SAMPLES } from './demoProject';

describe('complex loft stress sample', () => {
  const p = buildLoftProject();

  it('is registered as a sample and validates against the schema', () => {
    expect(SAMPLES.some((s) => s.id === 'loft')).toBe(true);
    expect(ProjectSchema.safeParse(JSON.parse(JSON.stringify(p))).success).toBe(true);
  });

  it('has a complex shell with curved and angled walls and many openings', () => {
    const walls = Object.values(p.walls);
    expect(walls.filter((w) => w.curve).length).toBe(2);
    expect(walls.length).toBeGreaterThanOrEqual(20);
    expect(Object.keys(p.openings).length).toBe(16);
    const net = computeWallNetwork(p);
    // Every opening fits its wall (none clamped), including the three on the curved bay.
    for (const g of net.walls.values()) for (const sp of g.spans) expect(sp.clamped, sp.id).toBe(false);
    const curved = [...net.walls.values()].find((g) => g.wall.role === 'exterior' && g.path.control);
    expect(curved?.spans.length).toBe(3);
    expect(net.hubs.length).toBeGreaterThan(3); // T-junctions and the crossing divider
  });

  it('detects four named rooms totalling about 100 m²', () => {
    const faces = detectRoomFaces(p);
    expect(faces).toHaveLength(4);
    const names = Object.values(p.rooms).map((r) => r.name).sort();
    expect(names).toEqual(['Bathroom', 'Loft', 'Pantry & laundry', 'Walk-in closet']);
    const total = faces.reduce((s, f) => s + f.area, 0);
    expect(total).toBeGreaterThan(95);
    expect(total).toBeLessThan(105);
    expect(faces.every((f) => !f.degraded)).toBe(true);
  });

  it('reports no geometry errors and uses only known assets', () => {
    const d = derivePlan(p);
    expect(d.diagnostics.filter((x) => x.level === 'error')).toEqual([]);
    expect(Object.keys(p.objects).length).toBeGreaterThanOrEqual(100);
    for (const o of Object.values(p.objects)) expect(ASSETS_BY_ID[o.assetId], o.assetId).toBeDefined();
  });

  it('derives the full plan quickly enough for interactive editing', () => {
    // Fresh structural objects defeat the memo so each run recomputes everything.
    const runs = 10;
    const t0 = performance.now();
    for (let i = 0; i < runs; i++) {
      const copy = { ...p, walls: { ...p.walls }, nodes: { ...p.nodes } };
      derivePlan(copy);
    }
    const perRun = (performance.now() - t0) / runs;
    expect(perRun).toBeLessThan(60);
  });

  it('exports DXF, a scaled sheet and a summary without errors', () => {
    const dxf = buildDxf(p, { unit: 'mm', furniture: true, dimensions: true, labels: true, rooms: true });
    const pairs = parseDxfPairs(dxf);
    expect(pairs.filter((x) => x.code === 0 && x.value === 'ARC').length).toBeGreaterThan(3);
    expect(pairs.at(-1)).toEqual({ code: 0, value: 'EOF' });
    const sheet = buildSheet(p, { ...defaultSheetOptions(p), paper: 'A2', scale: 50 });
    expect(sheet.warnings).toEqual([]);
    expect(sheet.svg.length).toBeGreaterThan(50_000);
    const report = buildReport(p);
    expect(report.totals.rooms).toBe(4);
  });

  it('survives heavy editing: mass moves, deletes, undo and redo', () => {
    const store = useProjectStore.getState();
    store.load(p);
    const objectCount = Object.keys(p.objects).length;
    // Drag every node 10 cm as one gesture (transient previews + one commit).
    store.begin('Shift everything');
    for (let i = 1; i <= 10; i++) {
      useProjectStore.getState().preview((d) => {
        const pos: Record<string, { x: number; y: number }> = {};
        for (const n of Object.values(p.nodes)) pos[n.id] = { x: n.x + i * 0.01, y: n.y };
        setNodePositions(d, pos);
      });
    }
    useProjectStore.getState().commit();
    expect(detectRoomFaces(useProjectStore.getState().project!)).toHaveLength(4);
    useProjectStore.getState().execute('Delete all furniture', (d) => {
      for (const id of Object.keys(d.objects)) delete d.objects[id];
    });
    expect(Object.keys(useProjectStore.getState().project!.objects)).toHaveLength(0);
    useProjectStore.getState().undo();
    expect(Object.keys(useProjectStore.getState().project!.objects)).toHaveLength(objectCount);
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().project).toBe(p);
    useProjectStore.getState().redo();
    useProjectStore.getState().redo();
    expect(Object.keys(useProjectStore.getState().project!.objects)).toHaveLength(0);
    // Room identities survive the round trip.
    expect(Object.values(useProjectStore.getState().project!.rooms).map((r) => r.name).sort()).toContain('Loft');
  });
});

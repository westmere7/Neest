import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { produce } from 'immer';
import { createEmptyProject } from '@/domain/model/defaults';
import { ProjectSchema, type Project } from '@/domain/model/schema';
import { WALL_PRESETS } from '@/domain/model/wallPresets';
import { addWallChain, flipWall, splitWallAt, type D } from '@/domain/commands/walls';
import { addOpening, assignMaterial, materialUsage } from '@/domain/commands/entities';
import { computeWallNetwork, type WallGeometry } from '@/domain/geometry/walls';
import { MaterialRegistry } from './materialRegistry';
import { buildWallGeometry, wallGeometryKey } from './builders';
import { buildWallExtras, wallHasExtras } from './wallExtras';

const W = { thickness: 0.12, height: 2.7, role: 'interior' as const };

function project(fn: (d: D) => void): Project {
  return produce(createEmptyProject(), fn);
}

/** One straight 4 m wall along +x, optionally with a door at 2 m. */
function wall(patch: (d: D, id: string) => void = () => {}, door = false): { p: Project; g: WallGeometry } {
  const p = project((d) => {
    const [id] = addWallChain(d, [{ x: 0, y: 0 }, { x: 4, y: 0 }], W);
    if (door) addOpening(d, { wallId: id, kind: 'door-single', offset: 2 });
    patch(d, id);
  });
  const g = [...computeWallNetwork(p).walls.values()][0];
  return { p, g };
}

const box = (o: THREE.Object3D) => new THREE.Box3().setFromObject(o);
const ctx = (p: Project) => ({ project: p, registry: new MaterialRegistry(), shadows: false });

describe('sloped wall tops', () => {
  it('slopes the top linearly and keeps the bottom level', () => {
    const { g } = wall((d, id) => (d.walls[id].heightEnd = 1.2));
    expect(g.sloped).toBe(true);
    expect(g.topAt(0)).toBeCloseTo(2.7, 6);
    expect(g.topAt(4)).toBeCloseTo(1.2, 6);
    expect(g.topAt(2)).toBeCloseTo(1.95, 6);
    const geo = buildWallGeometry(g)!;
    geo.computeBoundingBox();
    expect(geo.boundingBox!.max.y).toBeCloseTo(2.7, 3);
    expect(geo.boundingBox!.min.y).toBeCloseTo(0, 6);
    // The far end of the wall is low.
    const pos = geo.getAttribute('position');
    let maxYAtEnd = 0;
    for (let i = 0; i < pos.count; i++) if (pos.getX(i) > 3.99) maxYAtEnd = Math.max(maxYAtEnd, pos.getY(i));
    expect(maxYAtEnd).toBeCloseTo(1.2, 3);
    expect(wallGeometryKey(g)).not.toBe(wallGeometryKey(wall().g));
  });

  it('keeps openings below a sloped top', () => {
    const { g } = wall((d, id) => (d.walls[id].heightEnd = 2.0), true);
    const sp = g.spans[0];
    expect(sp.head).toBeLessThanOrEqual(g.topAt(sp.s1) + 1e-9);
  });

  it('keeps the slope line when splitting and swaps ends when flipping', () => {
    const p = project((d) => {
      const [id] = addWallChain(d, [{ x: 0, y: 0 }, { x: 4, y: 0 }], W);
      d.walls[id].heightEnd = 1.1;
      d.walls[id].finishes = { left: { skirting: { height: 0.1, depth: 0.01, materialId: 'paint-satin-white' }, cornice: null, rail: null, band: null } };
      splitWallAt(d, id, 2);
      flipWall(d, id);
    });
    const walls = Object.values(p.walls);
    expect(walls).toHaveLength(2);
    const flipped = walls.find((w) => w.finishes?.right)!;
    // First half: 2.7 → 1.9, flipped: height 1.9 at its new start, 2.7 at its end; finishes moved to the right face.
    expect(flipped.height).toBeCloseTo(1.9, 6);
    expect(flipped.heightEnd).toBeCloseTo(2.7, 6);
    expect(flipped.finishes?.left).toBeUndefined();
    const other = walls.find((w) => w !== flipped)!;
    expect(other.height).toBeCloseTo(1.9, 6);
    expect(other.heightEnd).toBeCloseTo(1.1, 6);
    expect(ProjectSchema.safeParse(JSON.parse(JSON.stringify(p))).success).toBe(true);
  });
});

describe('wall extras', () => {
  it('has no extras for a plain wall', () => {
    const { p, g } = wall();
    expect(wallHasExtras(g)).toBe(false);
    expect(buildWallExtras(g, ctx(p))).toBeNull();
  });

  it('builds skirting proud of the face and interrupted by a door', () => {
    const { p, g } = wall((d, id) => {
      d.walls[id].finishes = { left: { skirting: { height: 0.1, depth: 0.015, materialId: 'paint-satin-white' }, cornice: null, rail: null, band: null } };
    }, true);
    const grp = buildWallExtras(g, ctx(p))!;
    expect(grp).not.toBeNull();
    const b = box(grp);
    expect(b.max.y).toBeCloseTo(0.1, 4);
    // Left of +x in plan (+y down) is -y; the skirting sits outside the wall face at -0.06.
    expect(b.min.z).toBeLessThan(-0.06 - 0.01);
    // No skirting vertex inside the door span.
    const span = g.spans[0];
    let inDoor = 0;
    grp.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const pos = m.geometry.getAttribute('position');
      for (let i = 0; i < pos.count; i++) if (pos.getX(i) > span.s0 + 0.01 && pos.getX(i) < span.s1 - 0.01) inDoor++;
    });
    expect(inDoor).toBe(0);
  });

  it('builds a cornice under the top and a band with a cap', () => {
    const { p, g } = wall((d, id) => {
      d.walls[id].finishes = {
        right: {
          skirting: null,
          rail: null,
          cornice: { height: 0.08, depth: 0.05, materialId: 'paint-satin-white' },
          band: { height: 0.9, depth: 0.015, materialId: 'wood-painted-white', cap: true },
        },
      };
    });
    const b = box(buildWallExtras(g, ctx(p))!);
    expect(b.max.y).toBeCloseTo(2.7, 4);
    expect(b.min.y).toBeCloseTo(0, 4);
    expect(b.max.z).toBeGreaterThan(0.06 + 0.04);
  });

  it('respects the cutaway height', () => {
    const { p, g } = wall((d, id) => {
      d.walls[id].finishes = { left: { skirting: null, rail: null, band: null, cornice: { height: 0.08, depth: 0.05, materialId: 'paint-satin-white' } } };
    });
    expect(buildWallExtras(g, ctx(p), 1.2)).toBeNull();
  });

  it.each(['glass', 'railing-glass', 'railing-bars', 'half'] as const)('builds a %s wall', (style) => {
    const { p, g } = wall((d, id) => {
      d.walls[id].style = style;
      if (style !== 'glass' && style !== 'half') d.walls[id].height = 1.05;
    });
    const grp = buildWallExtras(g, ctx(p))!;
    expect(grp.children.length).toBeGreaterThan(0);
    const b = box(grp);
    expect(b.min.x).toBeGreaterThanOrEqual(-0.1);
    expect(b.max.x).toBeLessThanOrEqual(4.1);
    expect(b.max.y).toBeLessThanOrEqual(g.z1 + 0.01);
    // Glass walls and railings have no solid body; half walls do.
    expect(buildWallGeometry(g) === null).toBe(style !== 'half');
  });

  it('makes trims and infill reassignable materials', () => {
    const p = project((d) => {
      const [id] = addWallChain(d, [{ x: 0, y: 0 }, { x: 4, y: 0 }], W);
      d.walls[id].style = 'glass';
      d.walls[id].styleMaterialId = 'glass-clear';
      d.walls[id].finishes = { left: { skirting: { height: 0.1, depth: 0.015, materialId: 'paint-satin-white' }, cornice: null, rail: null, band: null } };
      assignMaterial(d, [{ kind: 'wall-trim', wallId: id, side: 'left', part: 'skirting' }], 'wood-oak-light');
      assignMaterial(d, [{ kind: 'wall-style', wallId: id }], 'glass-frosted');
    });
    const w = Object.values(p.walls)[0];
    expect(w.finishes?.left?.skirting?.materialId).toBe('wood-oak-light');
    expect(w.styleMaterialId).toBe('glass-frosted');
    expect(materialUsage(p, 'wood-oak-light')).toEqual([{ kind: 'wall-trim', wallId: w.id, side: 'left', part: 'skirting' }]);
    expect(p.materials['glass-frosted']).toBeDefined();
  });
});

describe('wall presets', () => {
  it.each(WALL_PRESETS.map((p) => [p.id, p] as const))('%s draws a valid wall', (_id, preset) => {
    const p = project((d) => {
      addWallChain(d, [{ x: 0, y: 0 }, { x: 3, y: 0 }], {
        thickness: preset.thickness,
        height: preset.height ?? 2.7,
        role: preset.role,
        style: preset.style,
        styleMaterialId: preset.styleMaterialId,
        finishes: preset.finishes,
        ...(preset.materials ? { materials: { left: 'paint-warm-white', right: 'paint-warm-white', top: 'plaster-white', ...preset.materials } } : {}),
      });
    });
    expect(ProjectSchema.safeParse(JSON.parse(JSON.stringify(p))).success).toBe(true);
    const g = [...computeWallNetwork(p).walls.values()][0];
    const body = buildWallGeometry(g);
    const extras = buildWallExtras(g, ctx(p));
    // Invisible room dividers build nothing at all; every other preset builds a body or extras.
    if (preset.style === 'separator') expect([body, extras]).toEqual([null, null]);
    else expect(body !== null || extras !== null).toBe(true);
  });
});

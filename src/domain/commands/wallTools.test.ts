import { describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { createEmptyProject } from '../model/defaults';
import type { Project, Vec2 } from '../model/schema';
import { addOpening, reconcileRooms } from './entities';
import { addWallChain, findNodeNear, type D } from './walls';
import { canJoinAtNode, extendWall, findExtension, freeEnds, joinWallsAtNode, matchWallFinishes, trimWall } from './wallTools';
import { detectRoomFaces } from '../geometry/rooms';
import { dist } from '../geometry/vec';

const W = { thickness: 0.1, height: 2.7, role: 'interior' as const };

function edit(p: Project, fn: (d: D) => void): Project {
  return produce(p, (d) => {
    fn(d);
    reconcileRooms(d);
  });
}

const wallBetween = (p: Project, u: Vec2, v: Vec2) =>
  Object.values(p.walls).find((w) => {
    const a = p.nodes[w.a];
    const b = p.nodes[w.b];
    return (dist(a, u) < 1e-6 && dist(b, v) < 1e-6) || (dist(a, v) < 1e-6 && dist(b, u) < 1e-6);
  });

describe('extend', () => {
  // A long wall along y = 0 and a stub coming up from below that stops 1 m short of it.
  const base = edit(createEmptyProject(), (d) => {
    addWallChain(d, [{ x: 0, y: 0 }, { x: 6, y: 0 }], W);
    addWallChain(d, [{ x: 3, y: 4 }, { x: 3, y: 1 }], W);
  });
  const stub = wallBetween(base, { x: 3, y: 4 }, { x: 3, y: 1 })!;

  it('finds the wall the free end would hit', () => {
    const t = findExtension(base, stub.id, 'b')!;
    expect(t.distance).toBeCloseTo(1, 9);
    expect(t.to.x).toBeCloseTo(3, 9);
    expect(t.to.y).toBeCloseTo(0, 9);
    expect(t.targetWallId).not.toBeNull();
    // Extending the other end goes away from everything.
    expect(findExtension(base, stub.id, 'a')).toBeNull();
  });

  it('forms a T-junction', () => {
    const p = edit(base, (d) => {
      expect(extendWall(d, stub.id, 'b')).toBe(true);
    });
    expect(Object.keys(p.walls)).toHaveLength(3);
    const junction = findNodeNear(p, { x: 3, y: 0 })!;
    expect(junction).not.toBeNull();
    expect(Object.values(p.walls).filter((w) => w.a === junction || w.b === junction)).toHaveLength(3);
    expect(dist(p.nodes[p.walls[stub.id].a], p.nodes[p.walls[stub.id].b])).toBeCloseTo(4, 9);
  });

  it('keeps openings in place when the moving end is node a', () => {
    let doorId = '';
    const p0 = edit(createEmptyProject(), (d) => {
      addWallChain(d, [{ x: 0, y: 0 }, { x: 6, y: 0 }], W);
      // Drawn from the free end towards the far end: node a is the end that moves.
      addWallChain(d, [{ x: 3, y: 1 }, { x: 3, y: 5 }], W);
    });
    const w = wallBetween(p0, { x: 3, y: 1 }, { x: 3, y: 5 })!;
    const p1 = edit(p0, (d) => {
      doorId = addOpening(d, { wallId: w.id, offset: 2, kind: 'door-single' })!;
    });
    const before = p1.openings[doorId].offset;
    const p2 = edit(p1, (d) => {
      expect(extendWall(d, w.id, 'a')).toBe(true);
    });
    const o = p2.openings[doorId];
    expect(o.offset).toBeCloseTo(before + 1, 9);
    expect(o.wallId).toBe(w.id);
  });

  it('meets a collinear wall end ahead', () => {
    const p0 = edit(createEmptyProject(), (d) => {
      addWallChain(d, [{ x: 0, y: 0 }, { x: 2, y: 0 }], W);
      addWallChain(d, [{ x: 3, y: 0 }, { x: 5, y: 0 }], W);
    });
    const left = wallBetween(p0, { x: 0, y: 0 }, { x: 2, y: 0 })!;
    const t = findExtension(p0, left.id, 'b')!;
    expect(t.targetNodeId).not.toBeNull();
    expect(t.distance).toBeCloseTo(1, 9);
    const p = edit(p0, (d) => void extendWall(d, left.id, 'b'));
    expect(Object.keys(p.nodes)).toHaveLength(3);
  });

  it('closes a gap into a room', () => {
    const p = edit(createEmptyProject(), (d) => {
      addWallChain(d, [{ x: 0, y: 3 }, { x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }], W);
      addWallChain(d, [{ x: 4.5, y: 3 }, { x: 1, y: 3 }], W);
    });
    expect(detectRoomFaces(p)).toHaveLength(0);
    const bottom = wallBetween(p, { x: 4, y: 3 }, { x: 1, y: 3 }) ?? Object.values(p.walls).find((w) => freeEnds(p, w.id).includes('b'))!;
    const p2 = edit(p, (d) => void extendWall(d, bottom.id, 'b'));
    expect(detectRoomFaces(p2)).toHaveLength(1);
  });

  it('ignores curved walls and targets beyond the limit', () => {
    const p = edit(createEmptyProject(), (d) => {
      addWallChain(d, [{ x: 0, y: 0 }, { x: 4, y: 0 }], { ...W, curves: [{ x: 2, y: -1 }] });
      addWallChain(d, [{ x: 0.5, y: 2 }, { x: 0.5, y: 40 }], W);
      addWallChain(d, [{ x: -5, y: -0.5 }, { x: 5, y: -0.5 }], W);
    });
    const curved = Object.values(p.walls).find((w) => w.curve)!;
    expect(findExtension(p, curved.id, 'a')).toBeNull();
    const far = wallBetween(p, { x: 0.5, y: 2 }, { x: 0.5, y: 40 })!;
    // The curve x = 4t, y = -2t(1 - t) crosses x = 0.5 at t = 1/8, y = -0.21875: 2.21875 m from (0.5, 2).
    const t = findExtension(p, far.id, 'a')!;
    expect(t.targetWallId).toBe(curved.id);
    expect(t.distance).toBeCloseTo(2.21875, 3);
    const p2 = edit(p, (d) => void extendWall(d, far.id, 'a'));
    expect(Object.values(p2.walls).filter((w) => w.curve)).toHaveLength(2);
    expect(findExtension(p, far.id, 'a', 2)).toBeNull();
  });
});

describe('trim', () => {
  it('deletes the dangling overhang past a junction and heals the wall it crossed', () => {
    const p0 = edit(createEmptyProject(), (d) => {
      addWallChain(d, [{ x: 0, y: 0 }, { x: 6, y: 0 }], W);
      // Crosses the first wall: an overhang of 1 m above y = 0.
      addWallChain(d, [{ x: 3, y: 4 }, { x: 3, y: -1 }], W);
    });
    expect(Object.keys(p0.walls)).toHaveLength(4);
    const overhang = wallBetween(p0, { x: 3, y: 0 }, { x: 3, y: -1 })!;
    expect(freeEnds(p0, overhang.id)).toHaveLength(1);
    const p = edit(p0, (d) => {
      expect(trimWall(d, overhang.id)).toBe(true);
    });
    expect(Object.keys(p.walls)).toHaveLength(3);
    expect(findNodeNear(p, { x: 3, y: -1 })).toBeNull();
  });

  it('refuses walls without a free end', () => {
    const p0 = edit(createEmptyProject(), (d) => {
      addWallChain(d, [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }], { ...W, closed: true });
    });
    const id = Object.keys(p0.walls)[0];
    edit(p0, (d) => {
      expect(trimWall(d, id)).toBe(false);
    });
  });
});

describe('join', () => {
  it('joins two collinear walls with different thicknesses, keeping openings in place', () => {
    let doorA = '';
    let doorB = '';
    const p0 = edit(createEmptyProject(), (d) => {
      addWallChain(d, [{ x: 0, y: 0 }, { x: 4, y: 0 }], W);
      // Second wall drawn backwards and thinner.
      addWallChain(d, [{ x: 6, y: 0 }, { x: 4, y: 0 }], { ...W, thickness: 0.08 });
    });
    const wA = wallBetween(p0, { x: 0, y: 0 }, { x: 4, y: 0 })!;
    const wB = wallBetween(p0, { x: 6, y: 0 }, { x: 4, y: 0 })!;
    const p1 = edit(p0, (d) => {
      doorA = addOpening(d, { wallId: wA.id, offset: 1, kind: 'door-single' })!;
      // 0.9 m from node a of wB (x = 6), i.e. at x = 5.1.
      doorB = addOpening(d, { wallId: wB.id, offset: 0.9, kind: 'window-single', width: 0.8 })!;
    });
    const xOf = (p: Project, id: string) => {
      const o = p.openings[id];
      const w = p.walls[o.wallId];
      const a = p.nodes[w.a];
      const b = p.nodes[w.b];
      const L = dist(a, b);
      return a.x + ((b.x - a.x) * o.offset) / L;
    };
    const xa = xOf(p1, doorA);
    const xb = xOf(p1, doorB);
    const node = findNodeNear(p1, { x: 4, y: 0 })!;
    expect(canJoinAtNode(p1, node)).toBe(true);
    let survivor: string | null = null;
    const p2 = edit(p1, (d) => {
      survivor = joinWallsAtNode(d, node);
    });
    expect(survivor).toBe(wA.id);
    expect(Object.keys(p2.walls)).toHaveLength(1);
    expect(p2.walls[wA.id].thickness).toBeCloseTo(0.1, 9);
    expect(p2.nodes[node]).toBeUndefined();
    expect(p2.openings[doorA].wallId).toBe(wA.id);
    expect(p2.openings[doorB].wallId).toBe(wA.id);
    expect(xOf(p2, doorA)).toBeCloseTo(xa, 6);
    expect(xOf(p2, doorB)).toBeCloseTo(xb, 6);
  });

  it('joins when the longer wall comes second', () => {
    const p0 = edit(createEmptyProject(), (d) => {
      addWallChain(d, [{ x: 0, y: 0 }, { x: 1, y: 0 }], { ...W, thickness: 0.2 });
      addWallChain(d, [{ x: 1, y: 0 }, { x: 5, y: 0 }], W);
    });
    const long = wallBetween(p0, { x: 1, y: 0 }, { x: 5, y: 0 })!;
    let doorId = '';
    const p1 = edit(p0, (d) => {
      doorId = addOpening(d, { wallId: long.id, offset: 2, kind: 'door-single' })!;
    });
    const p2 = edit(p1, (d) => void joinWallsAtNode(d, findNodeNear(d, { x: 1, y: 0 })!));
    const w = p2.walls[long.id];
    expect(Object.keys(p2.walls)).toEqual([long.id]);
    expect(w.thickness).toBeCloseTo(0.1, 9);
    expect(dist(p2.nodes[w.a], { x: 0, y: 0 })).toBeLessThan(1e-9);
    // Opening was 2 m from x = 1, so it is now 3 m from x = 0.
    expect(p2.openings[doorId].offset).toBeCloseTo(3, 9);
  });

  it('uses the regular heal for matching walls', () => {
    const p0 = edit(createEmptyProject(), (d) => {
      addWallChain(d, [{ x: 0, y: 0 }, { x: 2, y: 0 }], W);
      addWallChain(d, [{ x: 2, y: 0 }, { x: 5, y: 0 }], W);
    });
    const p = edit(p0, (d) => {
      expect(joinWallsAtNode(d, findNodeNear(d, { x: 2, y: 0 })!)).not.toBeNull();
    });
    expect(Object.keys(p.walls)).toHaveLength(1);
  });

  it('refuses corners, curves and T-junctions', () => {
    const p = edit(createEmptyProject(), (d) => {
      addWallChain(d, [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }], W);
      addWallChain(d, [{ x: 10, y: 0 }, { x: 12, y: 0 }], { ...W, curves: [{ x: 11, y: 1 }] });
      addWallChain(d, [{ x: 12, y: 0 }, { x: 14, y: 0 }], W);
    });
    expect(canJoinAtNode(p, findNodeNear(p, { x: 4, y: 0 })!)).toBe(false);
    expect(canJoinAtNode(p, findNodeNear(p, { x: 12, y: 0 })!)).toBe(false);
    edit(p, (d) => {
      expect(joinWallsAtNode(d, findNodeNear(d, { x: 4, y: 0 })!)).toBeNull();
    });
  });
});

describe('matchWallFinishes', () => {
  it('copies materials and finishes from the first wall', () => {
    const p0 = edit(createEmptyProject(), (d) => {
      addWallChain(d, [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }], W);
    });
    const [a, b] = Object.keys(p0.walls);
    const p = edit(p0, (d) => {
      d.walls[a].materials.left = 'brick-red';
      d.walls[a].finishes = { left: { skirting: { height: 0.1, depth: 0.015, materialId: 'paint-satin-white' }, cornice: null, rail: null, band: null } };
      matchWallFinishes(d, a, [a, b]);
    });
    expect(p.walls[b].materials.left).toBe('brick-red');
    expect(p.walls[b].finishes?.left?.skirting?.height).toBeCloseTo(0.1, 9);
    expect(p.walls[b].finishes).not.toBe(p.walls[a].finishes);
  });
});

import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { createEmptyProject } from '../model/defaults';
import type { Project } from '../model/schema';
import { buildWallPath, pointAt } from '../geometry/wallPath';
import { addWallChain, cornerArc, maxCornerRadius, roundCorner, setCornerRadius, sharedNode, unroundCorner, type D } from './walls';

const W = { thickness: 0.1, height: 2.7, role: 'interior' as const };
const edit = (p: Project, fn: (d: D) => void): Project => produce(p, fn);

/** An L: (0,2)→(0,0)→(3,0), with a door on the long wall. */
function ell() {
  const p = edit(createEmptyProject(), (d) => {
    addWallChain(d, [
      { x: 0, y: 2 },
      { x: 0, y: 0 },
      { x: 3, y: 0 },
    ], W);
  });
  const corner = Object.values(p.nodes).find((n) => n.x === 0 && n.y === 0)!.id;
  const long = Object.values(p.walls).find((w) => p.nodes[w.b].x === 3 || p.nodes[w.a].x === 3)!.id;
  const withDoor = edit(p, (d) => {
    d.openings.o1 = { id: 'o1', wallId: long, kind: 'door-hinged', offset: 2, width: 0.8, height: 2.1, sillHeight: 0, swingSide: 'left', hinge: 'start', openAngle: 0 } as never;
  });
  return { p: withDoor, corner, long };
}

describe('roundCorner', () => {
  it('joins two straight walls with a tangent circular arc', () => {
    const { p, corner } = ell();
    const short = Object.keys(p.walls).find((id) => sharedNode(p, id, Object.keys(p.walls).find((x) => x !== id)!) === corner)!;
    expect(short).toBeTruthy();
    let arcId: string | null = null;
    const q = edit(p, (d) => void (arcId = roundCorner(d, corner, 0.5)));
    expect(arcId).not.toBeNull();
    expect(q.nodes[corner]).toBeUndefined();
    const arc = q.walls[arcId!];
    expect(arc.curve && arc.curveEnd).toBeTruthy();
    const path = buildWallPath(q.nodes[arc.a], q.nodes[arc.b], arc.curve, arc.curveEnd);
    // Ends 0.5 m from the corner on each wall; the middle of a quarter circle of radius 0.5
    // centred at (0.5, 0.5) is 0.5·(1 − 1/√2) from each wall.
    const ends = [q.nodes[arc.a], q.nodes[arc.b]].map((n) => [n.x, n.y].map((v) => Math.round(v * 1000) / 1000));
    expect(ends).toEqual(expect.arrayContaining([[0, 0.5], [0.5, 0]]));
    const mid = pointAt(path, path.length / 2).p;
    const k = 0.5 * (1 - Math.SQRT1_2);
    expect(mid.x).toBeCloseTo(k, 2);
    expect(mid.y).toBeCloseTo(k, 2);
    expect(Object.keys(q.walls)).toHaveLength(3);
  });

  it('keeps openings in place and caps the radius to the shorter wall', () => {
    const { p, corner, long } = ell();
    expect(maxCornerRadius(p, corner)).toBeCloseTo(1.95, 5);
    const q = edit(p, (d) => void roundCorner(d, corner, 0.5));
    // The door stayed 2 m from the old corner: its wall now starts 0.5 m along.
    const w = q.walls[long];
    const start = q.nodes[w.a].x === 3 ? q.nodes[w.b] : q.nodes[w.a];
    expect(start.x).toBeCloseTo(0.5, 6);
    // The wall runs from the corner, so the door's offset from its (moved) start shrank by 0.5 m.
    expect(w.a).toBe(start.id);
    expect(q.openings.o1.offset).toBeCloseTo(1.5, 6);
    const big = edit(p, (d) => void roundCorner(d, corner, 10));
    const arc = Object.values(big.walls).find((x) => x.curve)!;
    expect(Math.min(...[big.nodes[arc.a], big.nodes[arc.b]].map((n) => Math.max(n.x, n.y)))).toBeCloseTo(1.95, 5);
  });

  it('changes the radius of a rounded corner afterwards', () => {
    const { p, corner } = ell();
    let arcId = '';
    const q = edit(p, (d) => void (arcId = roundCorner(d, corner, 0.5)!));
    expect(cornerArc(q, arcId)?.radius).toBeCloseTo(0.5, 6);
    const r = edit(q, (d) => void expect(setCornerRadius(d, arcId, 0.8)).toBe(true));
    const c = cornerArc(r, arcId)!;
    expect(c.radius).toBeCloseTo(0.8, 6);
    expect(c.corner.x).toBeCloseTo(0, 6);
    expect(c.corner.y).toBeCloseTo(0, 6);
    // The door 2 m from the corner stays there.
    expect(r.openings.o1.offset).toBeCloseTo(1.2, 6);
    const mid = pointAt(buildWallPath(r.nodes[r.walls[arcId].a], r.nodes[r.walls[arcId].b], r.walls[arcId].curve, r.walls[arcId].curveEnd), 0);
    expect(Math.hypot(mid.p.x, mid.p.y)).toBeCloseTo(0.8, 6);
  });

  it('reverts a rounded corner to the sharp one', () => {
    const { p, corner } = ell();
    let arcId = '';
    const q = edit(p, (d) => void (arcId = roundCorner(d, corner, 0.5)!));
    const r = edit(q, (d) => void expect(unroundCorner(d, arcId)).not.toBeNull());
    expect(Object.keys(r.walls)).toHaveLength(2);
    expect(Object.keys(r.nodes)).toHaveLength(3);
    expect(Object.values(r.nodes).some((n) => n.x === 0 && n.y === 0)).toBe(true);
    expect(r.openings.o1.offset).toBeCloseTo(2, 6);
    expect(Object.values(r.walls).every((w) => !w.curve)).toBe(true);
  });

  it('refuses corners it cannot round', () => {
    const p = edit(createEmptyProject(), (d) => {
      addWallChain(d, [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ], W);
    });
    const mid = Object.values(p.nodes).find((n) => n.x === 1)!.id;
    expect(maxCornerRadius(p, mid)).toBeNull();
    expect(produce(p, (d) => void expect(roundCorner(d, mid, 0.3)).toBeNull())).toBe(p);
  });
});

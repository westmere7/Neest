import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { createEmptyProject } from '../model/defaults';
import type { Project } from '../model/schema';
import { buildWallPath, pointAt } from '../geometry/wallPath';
import { addWallChain, fitCurveToJoins, flipCurve, flipWall, joinTangent, setCurveHandles, setNodePositions, splitWallAt, type D } from './walls';

const W = { thickness: 0.1, height: 2.7, role: 'interior' as const };
const edit = (p: Project, fn: (d: D) => void): Project => produce(p, fn);
const path = (p: Project, id: string) => {
  const w = p.walls[id];
  return buildWallPath(p.nodes[w.a], p.nodes[w.b], w.curve, w.curveEnd);
};

/** Two perpendicular walls, (0,0)→(2,0) and (3,1)→(3,3), joined by a curved wall (2,0)→(3,1). */
function corner(two: boolean) {
  let curveId = '';
  const p = edit(createEmptyProject(), (d) => {
    addWallChain(d, [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
    ], W);
    addWallChain(d, [
      { x: 3, y: 1 },
      { x: 3, y: 3 },
    ], W);
    const before = new Set(Object.keys(d.walls));
    addWallChain(d, [
      { x: 2, y: 0 },
      { x: 3, y: 1 },
    ], { ...W, curves: [{ x: 2.2, y: 0.8 }] });
    curveId = Object.keys(d.walls).find((id) => !before.has(id))!;
    if (two) setCurveHandles(d, curveId, true);
  });
  return { p, curveId };
}

describe('curved wall handles', () => {
  it('finds the tangent of the walls joined at each end', () => {
    const { p, curveId } = corner(false);
    const ta = joinTangent(p, curveId, 'a')!;
    const tb = joinTangent(p, curveId, 'b')!;
    expect(ta.x).toBeCloseTo(1);
    expect(ta.y).toBeCloseTo(0);
    expect(tb.x).toBeCloseTo(0);
    expect(tb.y).toBeCloseTo(1);
  });

  it('fits one handle to the corner where the joined walls meet', () => {
    const { p, curveId } = corner(false);
    const q = edit(p, (d) => void fitCurveToJoins(d, curveId));
    expect(q.walls[curveId].curve).toEqual({ x: 3, y: 0 });
    const g = path(q, curveId);
    expect(g.samples[0].tangent.x).toBeCloseTo(1);
    expect(g.samples[g.samples.length - 1].tangent.y).toBeCloseTo(1);
  });

  it('fits two handles to a near-perfect quarter circle between perpendicular walls', () => {
    const { p, curveId } = corner(true);
    const q = edit(p, (d) => void fitCurveToJoins(d, curveId));
    const g = path(q, curveId);
    // Centre (2, 1), radius 1: every sample within 0.1 mm of the circle.
    for (const s of g.samples) expect(Math.abs(Math.hypot(s.p.x - 2, s.p.y - 1) - 1)).toBeLessThan(1e-3);
    expect(g.length).toBeCloseTo(Math.PI / 2, 2);
    expect(g.samples[0].tangent.x).toBeCloseTo(1);
    expect(g.samples[g.samples.length - 1].tangent.y).toBeCloseTo(1);
  });

  it('switches between one and two handles without changing the shape', () => {
    const { p, curveId } = corner(false);
    const one = path(p, curveId);
    const q = edit(p, (d) => setCurveHandles(d, curveId, true));
    expect(q.walls[curveId].curveEnd).toBeTruthy();
    const two = path(q, curveId);
    for (const t of [0.25, 0.5, 0.75]) {
      const a = pointAt(one, one.length * t).p;
      const b = pointAt(two, two.length * t).p;
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(0.005);
    }
    const back = edit(q, (d) => setCurveHandles(d, curveId, false));
    expect(back.walls[curveId].curveEnd).toBeNull();
    expect(back.walls[curveId].curve!.x).toBeCloseTo(p.walls[curveId].curve!.x);
    expect(back.walls[curveId].curve!.y).toBeCloseTo(p.walls[curveId].curve!.y);
  });

  it('splits a two-handle curve into two curves on the same line', () => {
    const { p, curveId } = corner(true);
    const fitted = edit(p, (d) => void fitCurveToJoins(d, curveId));
    const L = path(fitted, curveId).length;
    const q = edit(fitted, (d) => void splitWallAt(d, curveId, L / 2));
    const parts = Object.values(q.walls).filter((w) => w.curve && w.curveEnd);
    expect(parts).toHaveLength(2);
    for (const w of parts) for (const s of buildWallPath(q.nodes[w.a], q.nodes[w.b], w.curve, w.curveEnd).samples) expect(Math.abs(Math.hypot(s.p.x - 2, s.p.y - 1) - 1)).toBeLessThan(2e-3);
  });

  it('keeps both handles when nodes move, swaps them when the wall is reversed, and mirrors them', () => {
    const { p, curveId } = corner(true);
    const w0 = p.walls[curveId];
    const moved = edit(p, (d) => setNodePositions(d, { [w0.b]: { x: 4, y: 1 } }));
    expect(moved.walls[curveId].curveEnd).not.toEqual(w0.curveEnd);
    const flipped = edit(p, (d) => flipWall(d, curveId));
    expect(flipped.walls[curveId].curve).toEqual(w0.curveEnd);
    expect(flipped.walls[curveId].curveEnd).toEqual(w0.curve);
    const mirrored = edit(p, (d) => flipCurve(d, curveId));
    const m = mirrored.walls[curveId].curve!;
    // Mirror of a point across the chord (2,0)→(3,1) stays the same distance from the chord.
    const side = (q: { x: number; y: number }) => (q.x - 2) * 1 - (q.y - 0) * 1;
    expect(Math.sign(side(m))).toBe(-Math.sign(side(w0.curve!)));
  });

  it('turns a pointed arch into a round circular arc through its ends and peak', async () => {
    const { makeCircularArc } = await import('./walls');
    let id = '';
    const p = edit(createEmptyProject(), (d) => {
      addWallChain(d, [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
      ], { ...W, curves: [{ x: 2, y: -3 }] });
      id = Object.keys(d.walls)[0];
    });
    const peak = pointAt(path(p, id), path(p, id).length / 2).p;
    const q = edit(p, (d) => void makeCircularArc(d, id));
    expect(q.walls[id].curveEnd).toBeTruthy();
    // Circle through (0,0), the peak (2,-1.5) and (4,0): centre (2, 0.5833), radius 2.0833.
    const R = 2 + 1 / 12;
    for (const s of path(q, id).samples) expect(Math.abs(Math.hypot(s.p.x - 2, s.p.y - 7 / 12) - R) / R).toBeLessThan(0.006);
    const newPeak = pointAt(path(q, id), path(q, id).length / 2).p;
    expect(newPeak.x).toBeCloseTo(peak.x, 2);
    expect(newPeak.y).toBeCloseTo(peak.y, 1);
  });

  it('sets both handle lengths as a fraction of the span', async () => {
    const { curveHandleFraction, setCurveHandleFraction } = await import('./walls');
    const { p, curveId } = corner(true);
    const q = edit(p, (d) => setCurveHandleFraction(d, curveId, 0.8));
    expect(curveHandleFraction(q, curveId)).toBeCloseTo(0.8);
  });

  it('straightening clears both handles', async () => {
    const { updateWalls } = await import('./walls');
    const { p, curveId } = corner(true);
    const q = edit(p, (d) => updateWalls(d, [curveId], { curve: null }));
    expect(q.walls[curveId].curve).toBeNull();
    expect(q.walls[curveId].curveEnd).toBeNull();
  });
});

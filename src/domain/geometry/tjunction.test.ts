import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { createEmptyProject } from '../model/defaults';
import { addWallChain } from '../commands/walls';
import type { D } from '../commands/walls';
import type { Project } from '../model/schema';
import { computeWallNetwork } from './walls';

const edit = (p: Project, fn: (d: D) => void): Project => produce(p, fn);

/** An exterior wall split at (4, 2) with an interior wall branching off to the left. */
function tee() {
  return edit(createEmptyProject(), (d) => {
    addWallChain(d, [{ x: 4, y: 0 }, { x: 4, y: 2 }, { x: 4, y: 4 }], { closed: false, thickness: 0.24, height: 2.7, role: 'exterior' });
    addWallChain(d, [{ x: 4, y: 2 }, { x: 1, y: 2 }], { closed: false, thickness: 0.1, height: 2.7, role: 'interior' });
  });
}

describe('T-junctions', () => {
  it('keep the straight wall flush and butt the branch against its face, with no hub', () => {
    const p = tee();
    const net = computeWallNetwork(p);
    expect(net.hubs).toHaveLength(0);
    const ys: number[] = [];
    let branchX: number[] = [];
    for (const g of net.walls.values()) {
      const pts = g.footprint ?? [];
      if (g.wall.thickness > 0.2) {
        // Both halves of the straight wall end square at y = 2 on both faces (x = 3.88 and 4.12).
        const atJoint = pts.filter((q) => Math.abs(q.y - 2) < 1e-6);
        expect(atJoint.map((q) => +q.x.toFixed(3)).sort()).toEqual([3.88, 4.12]);
        ys.push(...atJoint.map((q) => q.y));
      } else {
        branchX = pts.filter((q) => q.x > 3).map((q) => +q.x.toFixed(3));
      }
    }
    expect(ys).toHaveLength(4);
    // The branch ends on the straight wall's inner face.
    expect(branchX.length).toBeGreaterThan(0);
    for (const x of branchX) expect(x).toBe(3.88);
  });
});

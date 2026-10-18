import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { createEmptyProject } from '../model/defaults';
import { addWallChain, swapWallFaces } from './walls';

describe('swapWallFaces', () => {
  it('trades the side materials and trims but keeps the direction', () => {
    const p = produce(createEmptyProject(), (d) => {
      addWallChain(d, [
        { x: 0, y: 0 },
        { x: 3, y: 0 },
      ], { thickness: 0.1, height: 2.7, role: 'interior' });
      const w = Object.values(d.walls)[0];
      w.materials.left = 'paint-sage';
      w.materials.right = 'tile-white-square';
      w.finishes = { left: { skirting: { height: 0.1, depth: 0.015, materialId: 'paint-satin-white' }, cornice: null, rail: null, band: null } };
    });
    const id = Object.keys(p.walls)[0];
    const q = produce(p, (d) => swapWallFaces(d, id));
    const w = q.walls[id];
    expect([w.a, w.b]).toEqual([p.walls[id].a, p.walls[id].b]);
    expect(w.materials.left).toBe('tile-white-square');
    expect(w.materials.right).toBe('paint-sage');
    expect(w.finishes?.left).toBeUndefined();
    expect(w.finishes?.right?.skirting?.height).toBe(0.1);
  });
});

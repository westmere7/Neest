import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { createEmptyProject } from '../model/defaults';
import type { Project } from '../model/schema';
import { addWallChain, setWallStyle, type D } from './walls';

const edit = (p: Project, fn: (d: D) => void): Project => produce(p, fn);

function oneWall(height: number) {
  let id = '';
  const p = edit(createEmptyProject(), (d) => {
    id = addWallChain(d, [{ x: 0, y: 0 }, { x: 3, y: 0 }], { thickness: 0.1, height, role: 'interior' })[0];
  });
  return { p, id };
}

describe('wall construction style', () => {
  it('a railing lowers the wall and switching back restores its height', () => {
    const { p, id } = oneWall(2.9);
    const rail = edit(p, (d) => setWallStyle(d, [id], 'railing-glass'));
    expect(rail.walls[id].height).toBe(1.05);
    expect(rail.walls[id].fullHeight).toBe(2.9);
    for (const back of ['solid', 'glass'] as const) {
      const q = edit(rail, (d) => setWallStyle(d, [id], back));
      expect(q.walls[id].height).toBe(2.9);
      expect(q.walls[id].fullHeight).toBeUndefined();
    }
  });

  it('switching between low styles keeps the remembered height', () => {
    const { p, id } = oneWall(2.7);
    const q = edit(p, (d) => {
      setWallStyle(d, [id], 'half');
      setWallStyle(d, [id], 'railing-bars');
      setWallStyle(d, [id], 'solid');
    });
    expect(q.walls[id].height).toBe(2.7);
    expect(q.walls[id].style).toBeUndefined();
  });

  it('a low wall drawn as a railing gets the default wall height when made solid', () => {
    const { p, id } = oneWall(1.0);
    const q = edit(p, (d) => {
      setWallStyle(d, [id], 'railing-glass');
      setWallStyle(d, [id], 'solid');
    });
    expect(q.walls[id].height).toBe(p.settings.defaultWall.height);
  });
});

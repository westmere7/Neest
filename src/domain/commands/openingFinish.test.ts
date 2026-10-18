import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { createEmptyProject } from '../model/defaults';
import { DOOR_FINISHES, WINDOW_FINISHES } from '../model/openingFinishes';
import type { Project } from '../model/schema';
import { MATERIAL_CATALOG_BY_ID } from '@/data/materials/catalog';
import { addWallChain, type D } from './walls';
import { addOpening, applyOpeningFinish, updateOpening } from './entities';

const edit = (p: Project, fn: (d: D) => void): Project => produce(p, fn);

function setup() {
  let door = '';
  let win = '';
  let glassDoor = '';
  const p = edit(createEmptyProject(), (d) => {
    addWallChain(d, [
      { x: 0, y: 0 },
      { x: 6, y: 0 },
    ], { thickness: 0.1, height: 2.7, role: 'interior' });
    const wall = Object.keys(d.walls)[0];
    door = addOpening(d, { wallId: wall, kind: 'door-single', offset: 1, width: 0.8 })!;
    win = addOpening(d, { wallId: wall, kind: 'window-single', offset: 3, width: 1 })!;
    glassDoor = addOpening(d, { wallId: wall, kind: 'door-single', offset: 5, width: 0.8 })!;
    updateOpening(d, glassDoor, { panelMaterialId: 'glass-clear' });
  });
  return { p, door, win, glassDoor };
}

describe('door and window finishes', () => {
  it('every finish uses catalogue materials', () => {
    for (const f of [...DOOR_FINISHES, ...WINDOW_FINISHES]) {
      expect(MATERIAL_CATALOG_BY_ID[f.frame], f.id).toBeDefined();
      if (f.panel) expect(MATERIAL_CATALOG_BY_ID[f.panel], f.id).toBeDefined();
    }
    expect(WINDOW_FINISHES.every((f) => !f.panel)).toBe(true);
  });

  it('sets frame and leaf on doors, only the frame on windows, and keeps glass leaves', () => {
    const { p, door, win, glassDoor } = setup();
    const q = edit(p, (d) => applyOpeningFinish(d, [door, win, glassDoor], { frame: 'metal-black-matte', panel: 'wood-oak-light' }));
    expect(q.openings[door]).toMatchObject({ frameMaterialId: 'metal-black-matte', panelMaterialId: 'wood-oak-light' });
    expect(q.openings[win].frameMaterialId).toBe('metal-black-matte');
    expect(q.openings[win].panelMaterialId).toBe(p.openings[win].panelMaterialId);
    expect(q.openings[glassDoor].panelMaterialId).toBe('glass-clear');
    expect(q.materials['wood-oak-light']).toBeDefined();
  });

  it('places a new opening in a chosen finish and carries saved project materials', () => {
    const own = { ...structuredClone(MATERIAL_CATALOG_BY_ID['wood-walnut']), color: '#123456' };
    let id = '';
    const p = edit(createEmptyProject(), (d) => {
      addWallChain(d, [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
      ], { thickness: 0.1, height: 2.7, role: 'interior' });
      id = addOpening(d, { wallId: Object.keys(d.walls)[0], kind: 'door-single', offset: 1, finish: { materials: { frame: 'wood-walnut', panel: 'wood-walnut' }, defs: { 'wood-walnut': own } } })!;
    });
    const o = p.openings[id];
    expect(o.frameMaterialId).toBe(o.panelMaterialId);
    // The edited walnut differs from the catalogue one, so it is added under a new id.
    expect(o.frameMaterialId).not.toBe('wood-walnut');
    expect(p.materials[o.frameMaterialId].color).toBe('#123456');
  });
});

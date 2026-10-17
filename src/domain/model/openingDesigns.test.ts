import { describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { createEmptyProject } from './defaults';
import { DOOR_DESIGN_IDS, isPassageKind, isWindowKind, OpeningDesignSchema, OpeningKindSchema, OpeningSchema, WINDOW_DESIGN_IDS, type OpeningDesign, type OpeningKind } from './schema';
import {
  defaultDesign,
  designFitsKind,
  designPatch,
  designsForKind,
  doorLeafLayout,
  leafCells,
  OPENING_DESIGNS,
  OPENING_DESIGNS_BY_ID,
  resolveOpeningDesign,
  sashGlazing,
} from './openingDesigns';
import { addWallChain } from '../commands/walls';
import { addOpening, setOpeningDesign } from '../commands/entities';
import { migrateProject } from '@/storage/migrations';
import { MATERIAL_CATALOG_BY_ID } from '@/data/materials/catalog';

const KINDS = OpeningKindSchema.options as OpeningKind[];

function projectWith(kind: OpeningKind, design?: OpeningDesign) {
  let id = '';
  const project = produce(createEmptyProject(), (d) => {
    const [wallId] = addWallChain(d, [{ x: 0, y: 0 }, { x: 6, y: 0 }], { thickness: 0.2, height: 2.7, role: 'interior' });
    id = addOpening(d, { wallId, kind, offset: 3, design })!;
  });
  return { project, id };
}

describe('opening designs: catalogue', () => {
  it('lists every schema design once, with a label and a family matching its id list', () => {
    expect(OPENING_DESIGNS.map((d) => d.id).sort()).toEqual([...OpeningDesignSchema.options].sort());
    for (const id of DOOR_DESIGN_IDS) expect(OPENING_DESIGNS_BY_ID[id].family).toBe('door');
    for (const id of WINDOW_DESIGN_IDS) expect(OPENING_DESIGNS_BY_ID[id].family).toBe('window');
    for (const d of OPENING_DESIGNS) expect(d.label.length).toBeGreaterThan(0);
    expect(DOOR_DESIGN_IDS.length).toBeGreaterThanOrEqual(12);
    expect(WINDOW_DESIGN_IDS.length).toBeGreaterThanOrEqual(10);
  });

  it('suggests only catalogue materials, and the glass the builder uses exists', () => {
    for (const d of OPENING_DESIGNS) if (d.material) expect(MATERIAL_CATALOG_BY_ID[d.material]).toBeDefined();
    for (const id of ['glass-clear', 'glass-frosted', 'glass-reeded']) expect(MATERIAL_CATALOG_BY_ID[id]?.category).toBe('glass');
  });

  it('offers door designs to doors, window designs to windows, nothing to passages', () => {
    for (const kind of KINDS) {
      const list = designsForKind(kind);
      if (isPassageKind(kind)) expect(list).toHaveLength(0);
      else if (isWindowKind(kind)) {
        expect(list.length).toBeGreaterThanOrEqual(5);
        expect(list.every((d) => d.family === 'window')).toBe(true);
      } else {
        expect(list.length).toBeGreaterThanOrEqual(7);
        expect(list.every((d) => d.family === 'door')).toBe(true);
      }
      // The default look of every kind is one of its offered designs.
      for (const style of ['flush', 'panel', 'glazed'] as const) {
        const def = defaultDesign(kind, style);
        if (isPassageKind(kind)) expect(def).toBeNull();
        else expect(designFitsKind(def!, kind)).toBe(true);
      }
    }
    // French doors are glazed only; arched/round windows skip layouts that need a rectangle.
    expect(designsForKind('door-french').every((d) => d.style === 'glazed')).toBe(true);
    expect(designFitsKind('win-transom', 'window-arched')).toBe(false);
    expect(designFitsKind('win-bars-v', 'window-round')).toBe(false);
    expect(designFitsKind('flush', 'window-single')).toBe(false);
  });

  it('resolves the looks openings had before designs existed', () => {
    expect(resolveOpeningDesign({ kind: 'door-single', style: 'flush' })).toBe('flush');
    expect(resolveOpeningDesign({ kind: 'door-single', style: 'panel' })).toBe('panel-2');
    expect(resolveOpeningDesign({ kind: 'door-single', style: 'glazed' })).toBe('lite-full');
    expect(resolveOpeningDesign({ kind: 'door-barn', style: 'panel' })).toBe('ledged');
    expect(resolveOpeningDesign({ kind: 'door-sliding', style: 'panel' })).toBe('lite-full');
    expect(resolveOpeningDesign({ kind: 'door-french', style: 'flush' })).toBe('lites-divided');
    expect(resolveOpeningDesign({ kind: 'window-double', style: 'glazed' })).toBe('win-plain');
    expect(resolveOpeningDesign({ kind: 'passage', style: 'flush' })).toBeNull();
    // A design that does not fit the kind falls back to the default.
    expect(resolveOpeningDesign({ kind: 'door-french', style: 'glazed', design: 'louvred' })).toBe('lites-divided');
    expect(resolveOpeningDesign({ kind: 'door-pivot', style: 'flush', design: 'reeded' })).toBe('reeded');
  });
});

describe('opening designs: layouts', () => {
  const sizes = [
    [0.9, 2.0],
    [0.3, 2.0],
    [0.7, 2.6],
    [1.1, 0.9],
  ];
  for (const id of DOOR_DESIGN_IDS) {
    it(`door leaf "${id}" tiles the leaf exactly and keeps details inside it`, () => {
      for (const [w, h] of sizes) {
        const layout = doorLeafLayout(id, w, h, { brace: true });
        const cells = leafCells(layout, w, h);
        const area = cells.reduce((s, c) => s + (c.x1 - c.x0) * (c.y1 - c.y0), 0);
        expect(area).toBeCloseTo(w * h, 6);
        for (const r of [...cells, ...layout.bars, ...layout.flutes, ...layout.louvres, ...layout.battens]) {
          expect(r.x0).toBeGreaterThanOrEqual(-1e-9);
          expect(r.y0).toBeGreaterThanOrEqual(-1e-9);
          expect(r.x1).toBeLessThanOrEqual(w + 1e-9);
          expect(r.y1).toBeLessThanOrEqual(h + 1e-9);
          expect(r.x1).toBeGreaterThan(r.x0);
          expect(r.y1).toBeGreaterThan(r.y0);
        }
        const style = OPENING_DESIGNS_BY_ID[id].style;
        if (style === 'glazed' && w >= 0.7) expect(cells.some((c) => c.type === 'lite')).toBe(true);
        if (style !== 'glazed') expect(cells.some((c) => c.type === 'lite')).toBe(false);
        if (id === 'groove-v' || id === 'groove-h' || id === 'ledged') expect(cells.filter((c) => c.type === 'groove').length).toBeGreaterThan(0);
        if (id === 'shaker' || id.startsWith('panel-') || id === 'reeded') expect(cells.some((c) => c.type === 'recess')).toBe(true);
        if (id === 'flush') expect(cells).toHaveLength(1);
      }
    });
  }

  it('keeps window glazing bars and frosted panes inside the glass', () => {
    for (const id of WINDOW_DESIGN_IDS) {
      for (const [gw, gh] of [
        [0.5, 1.0],
        [1.3, 1.2],
        [0.2, 0.3],
      ]) {
        const g = sashGlazing(id, gw, gh, 0.5);
        for (const r of [...g.bars, ...(g.frosted ? [g.frosted] : [])]) {
          expect(r.x0).toBeGreaterThanOrEqual(-1e-9);
          expect(r.y0).toBeGreaterThanOrEqual(-1e-9);
          expect(r.x1).toBeLessThanOrEqual(gw + 1e-9);
          expect(r.y1).toBeLessThanOrEqual(gh + 1e-9);
        }
      }
    }
    expect(sashGlazing('win-grid-2x2', 1, 1, 1).bars).toHaveLength(2);
    // A pair of casements splits a 2 × 2 grid into one column each.
    expect(sashGlazing('win-grid-2x2', 0.5, 1, 0.5).bars).toHaveLength(1);
    expect(sashGlazing('win-frosted-low', 0.6, 1).frosted).not.toBeNull();
  });
});

describe('opening designs: schema, commands and old projects', () => {
  it('accepts designs, keeps them optional, and drops unknown values instead of failing', () => {
    const base = { id: 'door_1', wallId: 'w_1', kind: 'door-single', offset: 1, width: 0.9, height: 2.1, sillHeight: 0, frameMaterialId: 'a', panelMaterialId: 'b' };
    expect(OpeningSchema.parse({ ...base, design: 'reeded' }).design).toBe('reeded');
    const plain = OpeningSchema.parse(base);
    expect('design' in plain).toBe(false);
    expect(plain.style).toBe('flush');
    expect(OpeningSchema.parse({ ...base, design: 'gothic-tracery' }).design).toBeUndefined();
  });

  it('loads an old project (style "panel", no design) unchanged', () => {
    const { project, id } = projectWith('door-double');
    const raw = JSON.parse(JSON.stringify(project));
    raw.openings[id].style = 'panel';
    delete raw.openings[id].design;
    const before = structuredClone(raw.openings[id]);
    const { project: loaded, warnings } = migrateProject(raw);
    expect(warnings).toEqual([]);
    expect(loaded.openings[id]).toEqual(before);
    expect('design' in loaded.openings[id]).toBe(false);
    expect(resolveOpeningDesign(loaded.openings[id])).toBe('panel-2');
  });

  it('round-trips a design through save and load, and survives a newer unknown design', () => {
    const { project, id } = projectWith('window-double', 'win-grid-3x2');
    const raw = JSON.parse(JSON.stringify(project));
    expect(migrateProject(raw).project.openings[id].design).toBe('win-grid-3x2');
    raw.openings[id].design = 'win-from-the-future';
    const loaded = migrateProject(raw).project.openings[id];
    expect(loaded.design).toBeUndefined();
    expect(resolveOpeningDesign(loaded)).toBe('win-plain');
  });

  it('inserts with a design and its suggested material, and ignores designs that do not fit', () => {
    const steel = projectWith('door-single', 'steel-grid');
    const o = steel.project.openings[steel.id];
    expect(o.design).toBe('steel-grid');
    expect(o.style).toBe('glazed');
    expect(o.panelMaterialId).toBe('metal-black-matte');
    expect(steel.project.materials['metal-black-matte']).toBeDefined();
    const wrong = projectWith('door-single', 'win-grid-2x2');
    expect(wrong.project.openings[wrong.id].design).toBeUndefined();
  });

  it('restores the default leaf when leaving a design whose material is still in use', () => {
    const { project, id } = projectWith('door-single', 'alu-clear');
    expect(project.openings[id].panelMaterialId).toBe('metal-anthracite');
    const next = produce(project, (d) => setOpeningDesign(d, [id], 'shaker'));
    expect(next.openings[id].design).toBe('shaker');
    expect(next.openings[id].style).toBe('panel');
    expect(next.openings[id].panelMaterialId).toBe(createEmptyProject().materials['paint-satin-white'].id);
    // A material the user chose themselves is kept.
    const custom = produce(project, (d) => {
      d.openings[id].panelMaterialId = 'wood-oak-natural';
      setOpeningDesign(d, [id], 'flush');
    });
    expect(custom.openings[id].panelMaterialId).toBe('wood-oak-natural');
    // Window designs set the frame material.
    expect(designPatch({ kind: 'window-single', style: 'glazed', panelMaterialId: 'glass-clear', frameMaterialId: 'metal-anthracite' }, 'win-tilt-turn').frameMaterialId).toBe('plastic-upvc-white');
  });
});

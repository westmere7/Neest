import { produce } from 'immer';
import { afterEach, describe, expect, it } from 'vitest';
import { createEmptyProject } from '@/domain/model/defaults';
import { ProjectSchema, type Project } from '@/domain/model/schema';
import type { D } from '@/domain/commands/walls';
import { duplicateEntities, placeObject, setObjectModel } from '@/domain/commands/entities';
import { migrateProject } from '@/storage/migrations';
import { defineAsset, matSlot, span } from './parts';
import { assetPlan, getObjectAsset, objectSlotMaterialId } from './registry';
import {
  RETIRED_MODEL_ITEMS,
  assetModels,
  clearModelExtensions,
  currentItem,
  resolveModel,
  setModelExtensions,
  storedModelId,
  upgradeRetiredItem,
  withAllModels,
  withModel,
} from './models';
import type { Part, Size3 } from './types';

const edit = (p: Project, fn: (d: D) => void): Project => produce(p, fn);

/** A shelf with books built in, and a model that adds a vase above its top. */
const shelf = defineAsset({
  id: 'test-shelf',
  name: 'Test shelf',
  category: 'living',
  type: 'storage',
  group: 'Bookcases & shelves',
  tags: ['test'],
  defaultSize: { w: 1, d: 0.3, h: 1 },
  slots: [matSlot('frame', 'Frame', 'wood-oak-light'), matSlot('books', 'Books', 'book-mix')],
  build: ({ w, d, h }) => [span('frame', [-w / 2, w / 2], [0, h], [-d / 2, -d / 2 + 0.02]), span('books', [-w / 4, w / 4], [0.1, 0.3], [-d / 2, 0], { plan: false })],
  models: [
    { id: 'full', name: 'Full' },
    { id: 'empty', name: 'Empty', hide: ['books'] },
    {
      id: 'vase',
      name: 'With vase',
      slots: [matSlot('vase', 'Vase', 'ceramic-white')],
      // plan: true on purpose: props never reach the outline anyway.
      props: (s: Size3): Part[] => [span('vase', [-0.05, 0.05], [s.h, s.h + 0.3], [-0.05, 0.05])],
    },
  ],
  source: { name: 'test', license: 'test' },
} as Parameters<typeof defineAsset>[0]);

const plain = defineAsset({
  id: 'test-plain',
  name: 'Plain box',
  category: 'living',
  type: 'storage',
  group: 'Bookcases & shelves',
  tags: ['test'],
  defaultSize: { w: 1, d: 1, h: 1 },
  slots: [matSlot('body', 'Body', 'wood-oak-light')],
  build: ({ w, d, h }) => [span('body', [-w / 2, w / 2], [0, h], [-d / 2, d / 2])],
} as Parameters<typeof defineAsset>[0]);

afterEach(() => clearModelExtensions());

describe('model variants', () => {
  it('lists models only for items with two or more, default first', () => {
    expect(assetModels(plain)).toEqual([]);
    expect(assetModels(shelf).map((m) => m.id)).toEqual(['full', 'empty', 'vase']);
    expect(resolveModel(shelf, undefined)?.id).toBe('full');
    expect(resolveModel(shelf, 'nope')?.id).toBe('full');
    expect(resolveModel(shelf, 'empty')?.id).toBe('empty');
    expect(resolveModel(plain, 'empty')).toBeNull();
  });

  it('stores nothing for the default model or an unknown one', () => {
    expect(storedModelId(shelf, 'full')).toBeUndefined();
    expect(storedModelId(shelf, 'nope')).toBeUndefined();
    expect(storedModelId(shelf, 'empty')).toBe('empty');
    expect(storedModelId(plain, 'empty')).toBeUndefined();
  });

  it('builds each model: hidden slots go, props are added but never in the outline', () => {
    const size = { w: 1, d: 0.3, h: 1 };
    expect(withModel(shelf, 'full')).toBe(shelf);
    expect(withModel(plain, 'x')).toBe(plain);
    const empty = withModel(shelf, 'empty');
    expect(empty.id).toBe('test-shelf@model:empty');
    expect(empty.build(size).map((p) => p.slot)).toEqual(['frame']);
    expect(empty.slots.map((s) => s.id)).toEqual(['frame']);
    const vase = withModel(shelf, 'vase');
    const parts = vase.build(size);
    expect(parts.map((p) => p.slot)).toEqual(['frame', 'books', 'vase']);
    expect(parts[2].plan).toBe(false);
    expect(vase.slots.map((s) => s.id)).toEqual(['frame', 'books', 'vase']);
    // Same outline as the item itself, whatever the model.
    const outline = (a: typeof shelf) => JSON.stringify(assetPlan(a, size).shapes.map((s) => s.points));
    expect(outline(vase)).toBe(outline(shelf));
    expect(outline(empty)).toBe(outline(shelf));
    // Memoised per asset and model.
    expect(withModel(shelf, 'vase')).toBe(vase);
  });

  it('survives props that throw', () => {
    const bad = defineAsset({ ...plain, id: 'test-bad', models: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B', props: () => { throw new Error('nope'); } }] } as Parameters<typeof defineAsset>[0]);
    const warn = console.warn;
    console.warn = () => {};
    try {
      expect(withModel(bad, 'b').build(bad.defaultSize)).toHaveLength(1);
    } finally {
      console.warn = warn;
    }
  });

  it('lets a source add models to another item, the item itself first', () => {
    setModelExtensions('pack-a', { 'test-plain': { original: 'Bare', models: [{ id: 'styled', name: 'Styled', props: () => [span('body', [-0.1, 0.1], [1, 1.2], [-0.1, 0.1])] }] } });
    expect(assetModels(plain).map((m) => [m.id, m.name])).toEqual([
      ['original', 'Bare'],
      ['styled', 'Styled'],
    ]);
    expect(withModel(plain, 'original')).toBe(plain);
    expect(withModel(plain, 'styled').build(plain.defaultSize)).toHaveLength(2);
    // Replacing a source's extensions drops the old ones.
    setModelExtensions('pack-a', {});
    expect(assetModels(plain)).toEqual([]);
    expect(withModel(plain, 'styled')).toBe(plain);
  });

  it('exports a thumbnail asset per model', () => {
    expect(withAllModels([plain, shelf]).map((a) => a.id)).toEqual(['test-plain', 'test-shelf', 'test-shelf@model:empty', 'test-shelf@model:vase']);
  });

  it('resolves slot defaults of model-only slots for placed items', () => {
    const obj = { assetId: 'test-shelf', model: 'vase', materials: {} } as unknown as Parameters<typeof objectSlotMaterialId>[0];
    expect(objectSlotMaterialId(obj, shelf, 'vase')).toBe('ceramic-white');
    expect(objectSlotMaterialId(obj, withModel(shelf, 'vase'), 'vase')).toBe('ceramic-white');
  });
});

describe('placed items and models', () => {
  it('places, switches and duplicates items with a model; the schema keeps it', () => {
    let id = '';
    let p = edit(createEmptyProject(), (d) => {
      id = placeObject(d, { assetId: 'bookcase', x: 0, y: 0, width: 0.8, depth: 0.3, height: 1.8, model: 'empty' });
    });
    expect(p.objects[id].model).toBe('empty');
    p = edit(p, (d) => setObjectModel(d, [id], undefined));
    expect('model' in p.objects[id]).toBe(false);
    p = edit(p, (d) => setObjectModel(d, [id], 'styled'));
    expect(p.objects[id].model).toBe('styled');
    // Size and place never change with the model.
    expect([p.objects[id].width, p.objects[id].depth, p.objects[id].height]).toEqual([0.8, 0.3, 1.8]);
    let copies: string[] = [];
    p = edit(p, (d) => {
      copies = duplicateEntities(d, [id], { x: 0.5, y: 0 });
    });
    expect(p.objects[copies[0]].model).toBe('styled');
    expect(ProjectSchema.parse(JSON.parse(JSON.stringify(p))).objects[id].model).toBe('styled');
  });

  it('shows an unknown model as the default model', () => {
    const p = edit(createEmptyProject(), (d) => void placeObject(d, { assetId: 'test-x', x: 0, y: 0, width: 1, depth: 1, height: 1, model: 'gone' }));
    const obj = Object.values(p.objects)[0];
    expect(getObjectAsset(p, { ...obj, assetId: 'bookcase' })?.id).toBe('bookcase');
  });

  it('moves retired version items onto the original item and model when a project loads', () => {
    expect(currentItem('model-variants:bookcase-empty')).toEqual({ assetId: 'bookcase', model: 'empty' });
    expect(currentItem('model-variants:sideboard-styled')).toEqual({ assetId: 'sideboard', model: 'styled', dh: 0.55 });
    expect(currentItem('bookcase', 'empty')).toEqual({ assetId: 'bookcase', model: 'empty' });
    const o = { assetId: 'model-variants:sideboard-styled', height: 1.35 } as { assetId: string; model?: string; height: number };
    expect(upgradeRetiredItem(o)).toBe(true);
    expect(o).toEqual({ assetId: 'sideboard', model: 'styled', height: 0.8 });
    expect(upgradeRetiredItem(o)).toBe(false);

    let a = '';
    let b = '';
    const p = edit(createEmptyProject(), (d) => {
      a = placeObject(d, { assetId: 'model-variants:bookcase-empty', x: 0, y: 0, width: 0.8, depth: 0.3, height: 1.8 });
      b = placeObject(d, { assetId: 'model-variants:dining-table-round-set', x: 2, y: 0, width: 1, depth: 1, height: 0.88 });
    });
    const { project, warnings } = migrateProject(JSON.parse(JSON.stringify(p)));
    expect(project.objects[a]).toMatchObject({ assetId: 'bookcase', model: 'empty', height: 1.8 });
    expect(project.objects[b]).toMatchObject({ assetId: 'dining-table-round', model: 'styled', height: 0.75 });
    expect(warnings.some((w) => w.includes('model variant'))).toBe(true);
    for (const [id, r] of Object.entries(RETIRED_MODEL_ITEMS)) if (id.startsWith('model-variants:')) expect(r.model).toMatch(/^(empty|styled)$/);
    // Look-alike branded items map to the one kept, with no model.
    const o2 = { assetId: 'branded-laptops:acer-nitro-v-15', model: 'x', height: 0.02 } as { assetId: string; model?: string; height: number };
    expect(upgradeRetiredItem(o2)).toBe(true);
    expect(o2).toEqual({ assetId: 'branded-laptops:macbook-pro-14-m4', height: 0.02 });
  });
});

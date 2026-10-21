import { describe, expect, it } from 'vitest';
import './loader';
import { ASSET_CATALOG, ASSETS_BY_ID } from '@/data/assets/catalog';
import { describeAssetChecks } from '@/data/assets/assetChecks';
import { MATERIAL_CATALOG, MATERIAL_CATALOG_BY_ID } from '@/data/materials/catalog';
import { patternInfo } from '@/data/materials/patterns';
import { photoEntry } from '@/features/materials/photoTextures';
import { applyPacks, installedPacks } from './runtime';
import { definePack, span, matSlot } from './kit';
import { packVersion } from './events';
import { RETIRED_MODEL_ITEMS, assetModels, withModel } from '@/data/assets/models';
import { assetPlan } from '@/data/assets/registry';

const packItems = ASSET_CATALOG.filter((a) => a.pack);

describe('content packs', () => {
  it('loads every pack in /packs without errors', () => {
    const packs = installedPacks();
    expect(packs.length).toBeGreaterThan(0);
    for (const p of packs) expect(p.errors, p.id).toEqual([]);
  });

  it('adds the Halloween pack items, materials, pattern and bitmaps under its namespace', () => {
    const halloween = installedPacks().find((p) => p.id === 'halloween');
    expect(halloween).toMatchObject({ name: 'Halloween', textures: 2, patterns: 1 });
    expect(halloween!.items).toBeGreaterThanOrEqual(10);
    const lantern = ASSETS_BY_ID['halloween:jack-o-lantern'];
    expect(lantern.pack).toMatchObject({ id: 'halloween', name: 'Halloween' });
    expect(lantern.source.name).toContain('Halloween pack');
    // Local material ids are namespaced in the item's slots.
    expect(lantern.slots.find((s) => s.id === 'skin')?.defaultMaterial).toBe('halloween:pumpkin-orange');
    expect(MATERIAL_CATALOG_BY_ID['halloween:pumpkin-orange'].texture?.patternId).toBe('halloween:pumpkin-ribs');
    expect(patternInfo('halloween:pumpkin-ribs')?.name).toBe('Pumpkin ribs');
    const stone = MATERIAL_CATALOG_BY_ID['halloween:mossy-stone'];
    expect(stone.photo?.setId).toBe('halloween:mossy-stone');
    expect(photoEntry('halloween:mossy-stone')?.maps.color).toMatch(/^data:image\/png;base64,/);
  });

  it('replaces (never duplicates) pack content when packs reload, and notifies', () => {
    const before = ASSET_CATALOG.length;
    const v = packVersion();
    const extra = definePack({
      name: 'Test',
      items: [
        {
          id: 'crate',
          name: 'Test crate',
          category: 'storage',
          type: 'storage',
          group: 'Baskets & boxes',
          tags: ['crate'],
          defaultSize: { w: 0.5, d: 0.5, h: 0.5 },
          slots: [matSlot('wood', 'Wood', 'wood-pine')],
          build: ({ w, d, h }) => [span('wood', [-w / 2, w / 2], [0, h], [-d / 2, d / 2])],
        },
        {
          id: 'broken',
          name: 'Broken item',
          category: 'decor',
          type: 'decor',
          group: 'Ornaments',
          tags: ['oops'],
          defaultSize: { w: 0.3, d: 0.3, h: 0.3 },
          slots: [matSlot('body', 'Body', 'solid-red')],
          build: () => {
            throw new Error('boom');
          },
        },
      ],
    });
    const modules = { '/packs/test-pack.pack.ts': { default: extra } };
    applyPacks(modules);
    expect(packVersion()).toBe(v + 1);
    expect(ASSET_CATALOG.filter((a) => a.pack).map((a) => a.id).sort()).toEqual(['test-pack:broken', 'test-pack:crate']);
    // A throwing build falls back to a box instead of breaking the app.
    expect(ASSETS_BY_ID['test-pack:broken'].build({ w: 1, d: 1, h: 1 })).toHaveLength(1);
    expect(MATERIAL_CATALOG.some((m) => m.id.startsWith('halloween:'))).toBe(false);
    applyPacks(modules);
    expect(ASSET_CATALOG.filter((a) => a.pack)).toHaveLength(2);
    // Restore the real packs.
    applyPacks(Object.fromEntries(Object.entries(import.meta.glob(['/packs/*.pack.ts', '!/packs/_*'], { eager: true }))));
    expect(ASSET_CATALOG.length).toBe(before);
  });
});

describe('retired items', () => {
  it('point at items that exist, and are gone themselves', () => {
    for (const [id, r] of Object.entries(RETIRED_MODEL_ITEMS)) {
      expect(ASSETS_BY_ID[id], id).toBeUndefined();
      expect(ASSETS_BY_ID[r.assetId], `${id} → ${r.assetId}`).toBeDefined();
      if (r.model) expect(assetModels(ASSETS_BY_ID[r.assetId]).map((m) => m.id), id).toContain(r.model);
    }
  });
});

describe('pack models', () => {
  it('turns the model-variants pack into models of the original items', () => {
    expect(ASSET_CATALOG.some((a) => a.id.startsWith('model-variants:'))).toBe(false);
    const bookcase = ASSETS_BY_ID.bookcase;
    expect(assetModels(bookcase).map((m) => [m.id, m.name])).toEqual([
      ['original', 'Filled'],
      ['empty', 'Empty'],
    ]);
    const size = bookcase.defaultSize;
    expect(withModel(bookcase, 'empty').build(size).some((p) => p.slot === 'books')).toBe(false);
    const sideboard = ASSETS_BY_ID.sideboard;
    const styled = withModel(sideboard, 'styled');
    const parts = styled.build(sideboard.defaultSize);
    // Props stand on the top, above the item's box, but the outline is the bare item's.
    expect(Math.max(...parts.map((p) => p.position[1]))).toBeGreaterThan(sideboard.defaultSize.h);
    expect(JSON.stringify(assetPlan(styled, sideboard.defaultSize).shapes)).toBe(JSON.stringify(assetPlan(sideboard, sideboard.defaultSize).shapes));
  });

  it('gives filled storage and vanities a Filled (default) and an Empty model', () => {
    for (const id of ['styled-storage:styled-display-cabinet', 'styled-storage:open-wardrobe-clothes', 'beauty:hollywood-vanity-set-up']) {
      const a = ASSETS_BY_ID[id];
      expect(assetModels(a).map((m) => m.id), id).toEqual(['filled', 'empty']);
      const full = withModel(a, 'filled').build(a.defaultSize).length;
      const bare = withModel(a, 'empty').build(a.defaultSize).length;
      expect(full, id).toBeGreaterThan(bare + 5);
      // Content slots only belong to the Filled model.
      expect(withModel(a, 'empty').slots.length, id).toBeLessThan(withModel(a, 'filled').slots.length);
    }
  });

  it('reports badly formed models and keeps the good ones', () => {
    const modules = {
      '/packs/test-models.pack.ts': {
        default: definePack({
          name: 'Test models',
          items: [
            {
              id: 'box',
              name: 'Box',
              category: 'storage',
              type: 'storage',
              group: 'Baskets & boxes',
              tags: ['box'],
              defaultSize: { w: 0.5, d: 0.5, h: 0.5 },
              slots: [matSlot('wood', 'Wood', 'wood-pine')],
              build: ({ w, d, h }) => [span('wood', [-w / 2, w / 2], [0, h], [-d / 2, d / 2])],
              models: [
                { id: 'a', name: 'A' },
                { id: 'a', name: 'Again' },
                { id: 'Bad Id', name: 'Bad' },
                { id: 'b', name: 'B' },
              ],
            },
          ],
          models: { bookcase: { original: 'Full', models: [{ id: 'bare', name: 'Bare', hide: ['books'] }] }, 'side-table': { original: '', models: [] } },
        }),
      },
    };
    try {
      applyPacks(modules);
      const p = installedPacks().find((x) => x.id === 'test-models')!;
      expect(p.errors.length).toBe(3);
      expect(assetModels(ASSETS_BY_ID['test-models:box']).map((m) => m.id)).toEqual(['a', 'b']);
      expect(assetModels(ASSETS_BY_ID.bookcase).map((m) => m.id)).toEqual(['original', 'bare']);
    } finally {
      applyPacks(Object.fromEntries(Object.entries(import.meta.glob(['/packs/*.pack.ts', '!/packs/_*'], { eager: true }))));
    }
    expect(assetModels(ASSETS_BY_ID.bookcase).map((m) => m.id)).toEqual(['original', 'empty']);
  });
});

describeAssetChecks(packItems);
// Built-in items that packs gave models: every model keeps the item's outline and size.
describe('built-in items with pack models', () => {
  describeAssetChecks(ASSET_CATALOG.filter((a) => !a.pack && assetModels(a).length));
});

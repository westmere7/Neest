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

describeAssetChecks(packItems);

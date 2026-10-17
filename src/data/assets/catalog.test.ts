import { describe, expect, it } from 'vitest';
import { ASSET_CATALOG, ASSET_CATEGORY_LABELS, ASSET_CATEGORY_ORDER, ASSET_TYPE_LABELS, ASSET_TYPE_ORDER, ASSETS_BY_ID } from './catalog';
import { describeAssetChecks, worldBounds } from './assetChecks';
import type { AssetCategory, AssetType, Part } from './types';

const MIN_PER_CATEGORY: Record<Exclude<AssetCategory, 'custom'>, number> = {
  construction: 4,
  living: 8,
  bedroom: 7,
  kids: 8,
  dining: 5,
  kitchen: 8,
  bathroom: 6,
  laundry: 5,
  office: 4,
  hobbies: 8,
  outdoor: 8,
  storage: 3,
  lighting: 5,
  decor: 7,
  electronics: 4,
  generic: 2,
};

describe('asset catalogue', () => {
  it('has at least 48 assets with unique ids', () => {
    expect(ASSET_CATALOG.length).toBeGreaterThanOrEqual(48);
    const ids = ASSET_CATALOG.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('indexes every asset by id', () => {
    expect(Object.keys(ASSETS_BY_ID)).toHaveLength(ASSET_CATALOG.length);
    for (const a of ASSET_CATALOG) expect(ASSETS_BY_ID[a.id]).toBe(a);
  });

  it.each(Object.entries(MIN_PER_CATEGORY))(
    'has at least the minimum number of %s assets',
    (category, min) => {
      expect(ASSET_CATALOG.filter((a) => a.category === category).length).toBeGreaterThanOrEqual(min);
    },
  );

  it('labels every category and orders all but custom', () => {
    const categories = Object.keys(MIN_PER_CATEGORY) as AssetCategory[];
    for (const c of [...categories, 'custom' as const]) expect(ASSET_CATEGORY_LABELS[c]).toBeTruthy();
    expect(ASSET_CATEGORY_LABELS.custom).toBe('Imported models');
    expect(ASSET_CATEGORY_ORDER).not.toContain('custom');
    expect([...ASSET_CATEGORY_ORDER].sort()).toEqual([...categories].sort());
    for (const a of ASSET_CATALOG) expect(ASSET_CATEGORY_ORDER).toContain(a.category);
  });

  it('labels and orders every type', () => {
    expect(Object.keys(ASSET_TYPE_LABELS).sort()).toEqual([...ASSET_TYPE_ORDER].sort());
    const used = new Set<AssetType>(ASSET_CATALOG.map((a) => a.type));
    for (const t of used) expect(ASSET_TYPE_ORDER).toContain(t);
  });

  it('has no duplicate names', () => {
    const names = ASSET_CATALOG.map((a) => a.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });
});

describeAssetChecks(ASSET_CATALOG);

describe('parametric behaviour', () => {
  const countSlot = (parts: Part[], slot: string) => parts.filter((p) => p.slot === slot).length;

  it('beds use one pillow below 1.2 m wide and two above', () => {
    for (const id of ['bed-single', 'bed-double', 'bed-queen', 'bed-king']) {
      const bed = ASSETS_BY_ID[id];
      const narrow = bed.build({ ...bed.defaultSize, w: 1.0 });
      const wide = bed.build({ ...bed.defaultSize, w: 1.6 });
      expect(countSlot(wide, 'bedding') - countSlot(narrow, 'bedding')).toBe(1);
      expect(bed.planDetail?.(bed.defaultSize).length).toBeGreaterThan(0);
    }
  });

  it('sofas keep a fixed arm width and stretch the seat', () => {
    const sofa = ASSETS_BY_ID['sofa-3-seat'];
    const armWidth = (w: number) => {
      const parts = sofa.build({ ...sofa.defaultSize, w });
      const arms = parts
        .map(worldBounds)
        .filter((b) => Math.abs(b.min[0] + w / 2) < 1e-6 && b.max[0] - b.min[0] < w / 2);
      expect(arms.length).toBeGreaterThan(0);
      return arms[0].max[0] - arms[0].min[0];
    };
    expect(armWidth(1.6)).toBeCloseTo(armWidth(3.2), 6);
    const seats = (w: number) => countSlot(sofa.build({ ...sofa.defaultSize, w }), 'upholstery');
    expect(seats(3.2)).toBeGreaterThan(seats(1.6));
  });

  it('table legs stay in the corners when resized', () => {
    const table = ASSETS_BY_ID['dining-table-rect'];
    for (const w of [0.8, 3.0]) {
      const legs = table
        .build({ ...table.defaultSize, w })
        .filter((p) => p.slot === 'legs' && p.shape === 'box' && p.plan === false)
        .map(worldBounds)
        .filter((b) => b.min[1] === 0);
      expect(legs).toHaveLength(4);
      for (const b of legs)
        expect(Math.max(Math.abs(b.min[0]), Math.abs(b.max[0]))).toBeCloseTo(w / 2 - 0.05, 6);
    }
  });

  it('wall cabinets hang at worktop splashback height', () => {
    const wall = ASSETS_BY_ID['kitchen-wall-cabinet'];
    expect(wall.mount).toBe('wall');
    expect(wall.defaultElevation).toBeCloseTo(1.45, 2);
  });
});

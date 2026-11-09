import { describe, expect, it } from 'vitest';
import './loader';
import { ASSET_CATALOG, ASSETS_BY_ID } from '@/data/assets/catalog';
import { describeAssetChecks, worldBounds } from '@/data/assets/assetChecks';
import { MATERIAL_CATALOG, MATERIAL_CATALOG_BY_ID } from '@/data/materials/catalog';
import { patternInfo } from '@/data/materials/patterns';
import { photoEntry } from '@/features/materials/photoTextures';
import { applyPacks, installedPacks } from './runtime';
import { definePack, span, matSlot } from './kit';
import { packVersion } from './events';
import { RETIRED_MODEL_ITEMS, assetModels, withModel } from '@/data/assets/models';
import { assetPlan } from '@/data/assets/registry';
import { createEmptyProject } from '@/domain/model/defaults';
import { repairProject } from '@/storage/migrations';

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

  it('keeps indoor slippers fixed-size across widths and offers an open-door 3-tier shoe variant', () => {
    const cab = ASSETS_BY_ID['soft-curve-furniture:curved-shoe-towel-cubby-cabinet'];
    expect(assetModels(cab).map((m) => m.id)).toEqual(['with-towels', 'open-door', 'empty']);

    const defLook = withModel(cab, 'with-towels');
    const slippersAt = (w: number) =>
      defLook
        .build({ w, d: cab.defaultSize.d, h: cab.defaultSize.h })
        .filter((p) => p.slot === 'slippers1' || p.slot === 'slippers2');
    const sNarrow = slippersAt(0.55);
    const sDefault = slippersAt(0.8);
    const sWide = slippersAt(1.4);
    expect(sDefault.length).toBe(8);
    expect(sNarrow).toEqual(sDefault);
    expect(sWide).toEqual(sDefault);

    const openLook = withModel(cab, 'open-door');
    const openParts = openLook.build(cab.defaultSize);
    expect(openParts.some((p) => p.slot === 'shoes')).toBe(true);
    expect(openParts.some((p) => p.slot === 'soles')).toBe(true);
    expect(openParts.some((p) => p.slot === 'darkShoes')).toBe(true);
    expect(Math.max(...openParts.map((p) => worldBounds(p).max[2]))).toBeGreaterThan(cab.defaultSize.d / 2 + 0.25);
  });

  it('gives wardrobe-shelf-tower-niche a 40 cm oak tower and 35 cm side-entry pin-hook & 2-tier slipper column', () => {
    const wall = ASSETS_BY_ID['wardrobe-study:wardrobe-shelf-tower-niche'];
    expect(assetModels(wall).map((m) => m.id)).toEqual(['hanging-niche', 'side-rack-empty', 'open-niche']);

    // Check 40 cm tower (x0 + 0.4) and 35 cm right column (x1 - 0.35) in the 2D plan detail strokes.
    const size = { w: 1.92, d: 0.63, h: 2.21 };
    const strokes = wall.planDetail?.(size) ?? [];
    const verticalXs = strokes
      .filter((s): s is Extract<typeof s, { kind: 'line' }> => s.kind === 'line' && Math.abs(s.a[0] - s.b[0]) < 1e-6 && Math.abs(s.a[1] - s.b[1]) > 0.3)
      .map((s) => Number(s.a[0].toFixed(4)));
    expect(verticalXs).toContain(Number((-size.w / 2 + 0.4).toFixed(4)));
    expect(verticalXs).toContain(Number((size.w / 2 - 0.35).toFixed(4)));

    const sideLook = withModel(wall, 'hanging-niche');
    const parts = sideLook.build(size);
    expect(parts.filter((p) => p.slot === 'slippers1').length).toBe(4);
    expect(parts.filter((p) => p.slot === 'slippers2').length).toBe(4);
    expect(parts.some((p) => p.slot === 'clothes')).toBe(true);
    expect(parts.some((p) => p.slot === 'clothes2')).toBe(true);
  });

  it('adds a raised curved rim on the dining ledge of corner-portal-half-wall', () => {
    const portal = ASSETS_BY_ID['portal-frames:corner-portal-half-wall'];
    const size = portal.defaultSize;
    const shelfMaxY = (modelId: string) =>
      Math.max(
        ...withModel(portal, modelId)
          .build(size)
          .filter((p) => p.slot === 'shelf')
          .map((p) => worldBounds(p).max[1]),
      );
    // Dining ledge inside & outside rise ~9.5 cm above the 1.0 m tabletop; plain half-wall cap stays at 1.0 m.
    expect(shelfMaxY('ledge-inside')).toBeCloseTo(1.095, 3);
    expect(shelfMaxY('ledge-outside')).toBeCloseTo(1.095, 3);
    expect(shelfMaxY('half-wall')).toBeCloseTo(1.0, 3);
  });

  it('lets corner-portal-half-wall shrink below 2 m and resize both outer side walls freely', () => {
    const portal = ASSETS_BY_ID['portal-frames:corner-portal-half-wall'];
    expect(portal.minSize!.w).toBeLessThanOrEqual(1.5);
    expect(portal.minSize!.d).toBeLessThanOrEqual(1.5);

    const open = withModel(portal, 'open');
    const size = { w: 2.0, d: 1.9, h: 2.7 };
    const wallWidths = (legA: number, legB: number) => {
      const parts = open.build(size, { legA, legB });
      // Floor-standing vertical leg boxes (plan !== false, touching y = 0).
      const legs = parts.filter((p) => p.slot === 'frame' && p.plan !== false).map(worldBounds).filter((b) => b.min[1] < 0.01);
      // Run A leg sits at +w/2 (+1.0), Run B leg sits at +d/2 (+0.95).
      const wallA = legs.find((b) => Math.abs(b.max[0] - size.w / 2) < 1e-4)!;
      const wallB = legs.find((b) => Math.abs(b.max[2] - size.d / 2) < 1e-4)!;
      return { a: wallA.max[0] - wallA.min[0], b: wallB.max[2] - wallB.min[2] };
    };

    expect(wallWidths(0.06, 0.06)).toEqual({ a: expect.closeTo(0.06, 4), b: expect.closeTo(0.06, 4) });
    // Exceeds both the former 40 % run cap (~0.65 m / ~0.61 m) and the former 0.8 m parameter ceiling.
    expect(wallWidths(1.2, 1.1)).toEqual({ a: expect.closeTo(1.2, 4), b: expect.closeTo(1.1, 4) });
  });

  it('gives modular-waterfall-cabinet-desk white drawers with 2 knobs and a width-invariant legged stool', () => {
    const desk = ASSETS_BY_ID['wardrobe-study:modular-waterfall-cabinet-desk'];
    expect(assetModels(desk).map((m) => m.id)).toEqual([
      'drawers',
      'pouf-stool',
      'oak-drawers',
      'no-stool',
      'plain',
      'slim',
    ]);
    expect(desk.slots.find((s) => s.id === 'front')?.defaultMaterial).toBe('laminate-white-matte');
    expect(desk.slots.find((s) => s.id === 'knob')?.defaultMaterial).toBe('metal-brass');

    const parts88 = desk.build({ w: 0.88, d: 0.4, h: 0.73 });
    expect(parts88.filter((p) => p.slot === 'front').length).toBe(2);
    // Each round knob builds 2 parts (stem rod + cap sphere) -> 4 knob parts for 2 drawers.
    expect(parts88.filter((p) => p.slot === 'knob').length).toBe(4);
    expect(parts88.some((p) => p.slot === 'stool')).toBe(true);

    // Stool diameter stays constant (~33.6 cm) even when scaling desk width from 0.88 m to 1.8 m.
    const stoolWidth = (w: number) => {
      const sp = desk.build({ w, d: 0.55, h: 0.75 }).find((p) => p.slot === 'stool')!;
      const b = worldBounds(sp);
      return b.max[0] - b.min[0];
    };
    expect(stoolWidth(0.88)).toBeCloseTo(stoolWidth(1.8), 4);
    expect(withModel(desk, 'no-stool').build(desk.defaultSize).some((p) => p.slot === 'stool')).toBe(false);
    expect(withModel(desk, 'plain').build(desk.defaultSize).some((p) => p.slot === 'front')).toBe(false);
  });

  it('builds balcony-window-double-curtains with sliding glass window and double curtains only (no balcony railing)', () => {
    const win = ASSETS_BY_ID['curtain-collection:balcony-window-double-curtains'];
    expect(assetModels(win).map((m) => m.id)).toEqual(['parted-open', 'closed-glass', 'sheer-drawn', 'all-drawn']);

    const defParts = win.build(win.defaultSize);
    expect(defParts.filter((p) => p.slot === 'sheer').length).toBe(2);
    expect(defParts.filter((p) => p.slot === 'blackout').length).toBe(2);
    expect(defParts.some((p) => p.slot === 'glass')).toBe(true);
    // Window frame sits flush to the back wall (-d/2 + 4 mm), with no exterior railing balusters.
    const closedParts = withModel(win, 'closed-glass').build(win.defaultSize);
    expect(defParts.length).toBe(closedParts.length);
    // Sheer-drawn merges the sheer into a single continuous wave sheet across the width.
    const sheerDrawnParts = withModel(win, 'sheer-drawn').build(win.defaultSize);
    expect(sheerDrawnParts.filter((p) => p.slot === 'sheer').length).toBe(1);
  });

  it('builds the horizontal sage watercolor hills wall painting with procedural art and 3 frame models', () => {
    const art = ASSETS_BY_ID['soft-curve-furniture:sage-watercolor-hills-painting'];
    expect(art).toBeDefined();
    expect(art.mount).toBe('wall');
    expect(art.defaultSize.w).toBeGreaterThan(art.defaultSize.h);
    expect(art.resizable).toEqual({ w: true, d: true, h: true });
    expect(MATERIAL_CATALOG_BY_ID['soft-curve-furniture:sage-hills-art']?.texture?.patternId).toBe(
      'soft-curve-furniture:sage-hills-watercolor',
    );
    expect(patternInfo('soft-curve-furniture:sage-hills-watercolor')?.colored).toBe(true);
    expect(assetModels(art).map((m) => m.id)).toEqual(['gallery-float', 'matted-frame', 'frameless-canvas']);

    const floatParts = art.build(art.defaultSize);
    expect(floatParts.some((p) => p.slot === 'frame')).toBe(true);
    expect(floatParts.some((p) => p.slot === 'art')).toBe(true);

    const mattedParts = withModel(art, 'matted-frame').build({ w: 1.8, d: 0.045, h: 0.9 });
    expect(mattedParts.filter((p) => p.slot === 'mat').length).toBeGreaterThanOrEqual(5);

    const canvasParts = withModel(art, 'frameless-canvas').build({ w: 1.5, d: 0.035, h: 0.8 });
    expect(canvasParts.some((p) => p.slot === 'frame')).toBe(false);
    expect(canvasParts.some((p) => p.slot === 'art')).toBe(true);
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

  it('builds the over-washer open wood shelf in both left and right tall-bay layouts with top-load clearance and empty model', () => {
    const left = ASSETS_BY_ID['laundry-storage:over-washer-wood-shelf'];
    const right = ASSETS_BY_ID['laundry-storage:over-washer-wood-shelf-right'];
    expect(left.mount).toBe('wall');
    expect(left.defaultElevation).toBeGreaterThanOrEqual(1.42);
    expect(right.variantOf).toBe(left.id);
    expect(assetModels(left).map((m) => m.id)).toEqual(['filled', 'empty']);

    const leftParts = left.build(left.defaultSize);
    const rightParts = right.build(right.defaultSize);
    const avgX = (ps: typeof leftParts, slot: string) => {
      const hit = ps.filter((p) => p.slot === slot);
      return hit.reduce((s, p) => s + p.position[0], 0) / hit.length;
    };
    // Left item keeps basket + detergent bottle on the -x side; mirrored right item places them on +x.
    expect(avgX(leftParts, 'basket')).toBeLessThan(-0.05);
    expect(avgX(leftParts, 'bottle')).toBeLessThan(0.02);
    expect(avgX(rightParts, 'basket')).toBeGreaterThan(0.02);
    expect(avgX(rightParts, 'bottle')).toBeGreaterThan(0.1);

    const empty = withModel(left, 'empty').build(left.defaultSize);
    expect(empty.every((p) => p.slot === 'wood')).toBe(true);
    expect(empty.length).toBe(9);
  });

  it('resizes both arms of sage-shaker-kitchen:l-kitchen independently, uses 3 horizontal drawers under the hob in both options, and keeps only the 4 clean model variants on both versions', () => {
    const leftReturn = ASSETS_BY_ID['sage-shaker-kitchen:l-kitchen'];
    const rightReturn = ASSETS_BY_ID['sage-shaker-kitchen:l-kitchen-right'];
    expect(leftReturn).toBeDefined();
    expect(rightReturn).toBeDefined();
    expect(rightReturn.variantOf).toBe(leftReturn.id);
    expect(leftReturn.wallSnap).toBe(true);
    const expectedModels = ['clean', 'side-hob', 'no-uppers', 'side-hob-no-uppers'];
    expect(assetModels(leftReturn).map((m) => m.id)).toEqual(expectedModels);
    expect(assetModels(rightReturn).map((m) => m.id)).toEqual(expectedModels);

    const decorSlots = new Set(['copper', 'oak', 'ceramic', 'plant', 'kraft']);

    for (const [item, hand] of [
      [leftReturn, 'left'],
      [rightReturn, 'right'],
    ] as const) {
      const clean = withModel(item, 'clean');
      const sideHob = withModel(item, 'side-hob');
      const noUppers = withModel(item, 'no-uppers');
      const sideHobNoUppers = withModel(item, 'side-hob-no-uppers');

      const sz = item.defaultSize;
      const defClean = clean.build(sz);
      const defSideHob = sideHob.build(sz);
      const defNoUppers = noUppers.build(sz);
      const defSideHobNoUppers = sideHobNoUppers.build(sz);

      // Every model is strictly clean: no styling props (copper pot, oak boards/shelves, ceramic crock/dishes, plant, kraft bags).
      for (const ps of [defClean, defSideHob, defNoUppers, defSideHobNoUppers]) {
        expect(ps.some((p) => decorSlots.has(p.slot))).toBe(false);
        expect(ps.some((p) => p.slot === 'hob')).toBe(true);
      }

      // Upper-cabinet models include a single reachable upper cabinet row (h = 2.22 m, all upper knobs below 1.95 m, no high ceiling bridge tier), reeded glass & LED; no-uppers models omit uppers, glass & hood.
      expect(sz.h).toBe(2.22);
      expect(defClean.some((p) => p.slot === 'upper')).toBe(true);
      expect(defClean.some((p) => p.slot === 'glass' && p.shape === 'box')).toBe(true);
      expect(Math.max(...defClean.filter((p) => p.slot === 'brass').map((p) => worldBounds(p).max[1]))).toBeLessThan(1.95);
      expect(defSideHob.some((p) => p.slot === 'upper')).toBe(true);
      expect(defSideHob.some((p) => p.slot === 'glass' && p.shape === 'box')).toBe(true);
      expect(Math.max(...defSideHob.filter((p) => p.slot === 'brass').map((p) => worldBounds(p).max[1]))).toBeLessThan(1.95);
      expect(defNoUppers.some((p) => p.slot === 'upper' || p.slot === 'glass' || p.slot === 'glow')).toBe(false);
      expect(Math.max(...defNoUppers.map((p) => worldBounds(p).max[1]))).toBeLessThan(1.55);
      expect(defSideHobNoUppers.some((p) => p.slot === 'upper' || p.slot === 'glass' || p.slot === 'glow')).toBe(false);
      expect(Math.max(...defSideHobNoUppers.map((p) => worldBounds(p).max[1]))).toBeLessThan(1.55);

      // Option 1 (default main-arm hob): hob sits on the main back arm (z < -d/2 + 0.60) with 3 stacked horizontal drawer pulls directly below it.
      const mainHobBox = worldBounds(defClean.find((p) => p.slot === 'hob')!);
      expect(mainHobBox.max[2]).toBeLessThan(-sz.d / 2 + 0.6);
      const mainHobCenterX = (mainHobBox.min[0] + mainHobBox.max[0]) / 2;
      const mainDrawerPullYs = defClean
        .filter((p) => p.slot === 'pull' && Math.abs(p.position[0] - mainHobCenterX) < 0.08)
        .map((p) => Math.round(p.position[1] * 100));
      expect(new Set(mainDrawerPullYs).size).toBe(3);

      // Option 2 (side-arm hob): hob moves onto the L-return arm (z > -d/2 + 0.60, x on the return side) with 3 stacked horizontal drawer pulls below it.
      const sideHobBox = worldBounds(defSideHob.find((p) => p.slot === 'hob')!);
      expect(sideHobBox.min[2]).toBeGreaterThan(-sz.d / 2 + 0.6);
      if (hand === 'left') expect(sideHobBox.max[0]).toBeLessThan(-sz.w / 2 + 0.6);
      else expect(sideHobBox.min[0]).toBeGreaterThan(sz.w / 2 - 0.6);
      const sideHobCenterZ = (sideHobBox.min[2] + sideHobBox.max[2]) / 2;
      const sideDrawerPullYs = defSideHob
        .filter((p) => p.slot === 'pull' && Math.abs(p.position[2] - sideHobCenterZ) < 0.08)
        .map((p) => Math.round(p.position[1] * 100));
      expect(new Set(sideDrawerPullYs).size).toBe(3);

      // 2D plan strokes move the burner circles from the main arm onto the L-return arm too.
      const mainCircles = assetPlan(clean, sz).strokes.filter((s) => s.kind === 'circle' && s.r > 0.05);
      const sideCircles = assetPlan(sideHob, sz).strokes.filter((s) => s.kind === 'circle' && s.r > 0.05);
      expect(mainCircles).toHaveLength(2);
      expect(sideCircles).toHaveLength(2);
      for (const c of mainCircles) if (c.kind === 'circle') expect(c.c[1]).toBeLessThan(-sz.d / 2 + 0.6);
      for (const c of sideCircles) if (c.kind === 'circle') expect(c.c[1]).toBeGreaterThan(-sz.d / 2 + 0.6);

      // Both hob versions maintain a 20 cm margin from the hob to the outer counter edge and mount top-chamfered frosted glass splatter shields in white base shoes at BOTH open ends of the L-counter.
      for (const testSize of [sz, { w: 2.4, d: 1.2, h: 2.22 }]) {
        const checkBothEndShields = (ps: ReturnType<typeof clean.build>, planStrokes: ReturnType<typeof assetPlan>['strokes']) => {
          const shieldParts = ps.filter((p) => p.slot === 'shield');
          const shieldBounds = shieldParts.map(worldBounds);
          const tileTop = Math.max(...ps.filter((p) => p.slot === 'tile').map((p) => worldBounds(p).max[1]));
          const baseBounds = ps.filter((p) => p.slot === 'shieldBase').map(worldBounds);
          expect(shieldParts).toHaveLength(2);
          expect(baseBounds).toHaveLength(2);
          for (const sp of shieldParts) {
            expect(sp.shape).toBe('prism');
            if (sp.shape === 'prism') expect(sp.outline).toHaveLength(5);
          }
          // Both shields reach the full height of the splashback tiles / underside of the upper cabinets (~1.449 m at default).
          for (const sb of shieldBounds) {
            expect(sb.max[1]).toBeCloseTo(tileTop, 3);
          }
          // One shield sits at the open end of the return arm (+d/2), and the other at the open end of the main arm (±w/2).
          expect(shieldBounds.some((b) => testSize.d / 2 - b.max[2] < 0.02)).toBe(true);
          expect(baseBounds.some((b) => testSize.d / 2 - b.max[2] < 0.02 && b.min[1] > 0.88 && b.max[1] < 0.92)).toBe(true);
          if (hand === 'left') {
            expect(shieldBounds.some((b) => testSize.w / 2 - b.max[0] < 0.02)).toBe(true);
            expect(baseBounds.some((b) => testSize.w / 2 - b.max[0] < 0.02 && b.min[1] > 0.88 && b.max[1] < 0.92)).toBe(true);
          } else {
            expect(shieldBounds.some((b) => b.min[0] - -testSize.w / 2 < 0.02)).toBe(true);
            expect(baseBounds.some((b) => b.min[0] - -testSize.w / 2 < 0.02 && b.min[1] > 0.88 && b.max[1] < 0.92)).toBe(true);
          }
          expect(planStrokes.filter((s) => s.kind === 'line')).toHaveLength(2);
        };

        for (const m of [clean, noUppers]) {
          const ps = m.build(testSize);
          const hb = worldBounds(ps.find((p) => p.slot === 'hob')!);
          if (hand === 'left') {
            expect(testSize.w / 2 - hb.max[0]).toBeCloseTo(0.2, 4);
          } else {
            expect(hb.min[0] - -testSize.w / 2).toBeCloseTo(0.2, 4);
          }
          checkBothEndShields(ps, assetPlan(m, testSize).strokes);
        }
        for (const m of [sideHob, sideHobNoUppers]) {
          const ps = m.build(testSize);
          const hb = worldBounds(ps.find((p) => p.slot === 'hob')!);
          expect(testSize.d / 2 - hb.max[2]).toBeCloseTo(0.2, 4);
          checkBothEndShields(ps, assetPlan(m, testSize).strokes);
        }
      }
    }

    // Open interior floor space has no dining table/bar or standalone fridge.
    const clean = withModel(leftReturn, 'clean');
    const openCornerParts = clean.build(leftReturn.defaultSize).filter((p) => {
      const b = worldBounds(p);
      return b.min[0] > -leftReturn.defaultSize.w / 2 + 0.62 && b.min[2] > -leftReturn.defaultSize.d / 2 + 0.62;
    });
    expect(openCornerParts).toEqual([]);

    // Measure return-arm worktop Z span + X depth and main-arm upper cabinet X span + Z depth.
    const armMetrics = (w: number, d: number) => {
      const ps = clean.build({ w, d, h: 2.22 });
      const returnTop = ps.find(
        (p) => p.slot === 'worktop' && p.shape === 'box' && worldBounds(p).max[2] > -d / 2 + 0.65,
      )!;
      const rtb = worldBounds(returnTop);
      const uppers = ps.filter((p) => p.slot === 'upper');
      const upperXSpan =
        Math.max(...uppers.map((p) => worldBounds(p).max[0])) -
        Math.min(...uppers.map((p) => worldBounds(p).min[0]));
      const upperZDepth =
        Math.max(...uppers.map((p) => worldBounds(p).max[2])) -
        Math.min(...uppers.map((p) => worldBounds(p).min[2]));
      return {
        returnZSpan: rtb.max[2] - rtb.min[2],
        returnXDepth: rtb.max[0] - rtb.min[0],
        upperXSpan,
        upperZDepth,
        upperCount: uppers.length,
      };
    };

    // Editing Width (w: 2.1 -> 3.9) lengthens the main cooking/upper arm while keeping the return arm unchanged.
    const wShort = armMetrics(2.1, 1.75);
    const wLong = armMetrics(3.9, 1.75);
    expect(wLong.upperXSpan - wShort.upperXSpan).toBeCloseTo(1.8, 2);
    expect(wLong.upperCount).toBeGreaterThan(wShort.upperCount);
    expect(wLong.upperZDepth).toBeCloseTo(wShort.upperZDepth, 4);
    expect(wLong.returnZSpan).toBeCloseTo(wShort.returnZSpan, 4);
    expect(wLong.returnXDepth).toBeCloseTo(wShort.returnXDepth, 4);

    // Editing Depth (d: 1.35 -> 3.2) lengthens the left return arm while keeping the main upper arm unchanged.
    const dShort = armMetrics(2.85, 1.35);
    const dLong = armMetrics(2.85, 3.2);
    expect(dLong.returnZSpan - dShort.returnZSpan).toBeCloseTo(1.85, 2);
    expect(dLong.returnXDepth).toBeCloseTo(dShort.returnXDepth, 4);
    expect(dLong.upperXSpan).toBeCloseTo(dShort.upperXSpan, 4);
    expect(dLong.upperZDepth).toBeCloseTo(dShort.upperZDepth, 4);
  });

  it('builds wardrobe-study:waterfall-bar-shelf-table as a standalone curved-waterfall bar table with a 3-tier shelf hutch and styled/empty models', () => {
    const item = ASSETS_BY_ID['wardrobe-study:waterfall-bar-shelf-table'];
    expect(item).toBeDefined();
    expect(item.variantOf).toBeUndefined();
    expect(item.wallSnap).toBe(true);
    expect(assetModels(item).map((m) => m.id)).toEqual(['styled', 'empty']);

    const sz = item.defaultSize;
    const styledParts = withModel(item, 'styled').build(sz);
    const emptyParts = withModel(item, 'empty').build(sz);

    // Empty has only the structural oak & back-panel joinery (zero decor slots).
    expect(emptyParts.every((p) => p.slot === 'oak' || p.slot === 'back')).toBe(true);

    // Full-width oak slab legs touch the floor at BOTH ends: curved waterfall at +d/2 and straight square-cornered leg flush with -d/2 under the hutch.
    const floorLegs = emptyParts
      .filter((p) => p.slot === 'oak' && worldBounds(p).min[1] <= 0.005)
      .map(worldBounds);
    expect(floorLegs).toHaveLength(2);
    expect(floorLegs.some((b) => Math.abs(b.max[2] - sz.d / 2) < 0.005 && b.max[0] - b.min[0] > sz.w - 0.01)).toBe(true);
    expect(floorLegs.some((b) => Math.abs(b.min[2] - -sz.d / 2) < 0.005 && b.max[0] - b.min[0] > sz.w - 0.01)).toBe(true);
    // Only the front (+z) end uses a curved waterfall prism; the wall (-z) corner under the hutch stays square.
    const bends = emptyParts.filter((p) => p.shape === 'prism').map(worldBounds);
    expect(bends).toHaveLength(1);
    expect(bends[0].min[2]).toBeGreaterThan(0);

    // Two intermediate horizontal shelf boards between the tabletop (0.81 m) and top cap (1.75 m) create 3 compartments.
    const innerShelves = emptyParts.filter((p) => {
      const b = worldBounds(p);
      return p.slot === 'oak' && b.max[1] - b.min[1] < 0.03 && b.min[1] > 0.85 && b.max[1] < sz.h - 0.05;
    });
    expect(innerShelves).toHaveLength(2);
    const [shelf1, shelf2] = innerShelves.map(worldBounds).sort((a, b) => a.min[1] - b.min[1]);

    // Styled stocks dry-goods glass jars + grain/bean fills in the middle compartment (between shelf1 and shelf2).
    const midGlassJars = styledParts.filter((p) => {
      const b = worldBounds(p);
      return p.slot === 'glass' && b.min[1] > shelf1.max[1] && b.max[1] < shelf2.min[1];
    });
    expect(midGlassJars).toHaveLength(3);
    expect(
      styledParts.some((p) => {
        const b = worldBounds(p);
        return (p.slot === 'grain' || p.slot === 'bean') && b.min[1] > shelf1.max[1] && b.max[1] < shelf2.min[1];
      }),
    ).toBe(true);

    // Styled also includes top-bay rattan basket & tabletop centerpiece fruit.
    expect(styledParts.some((p) => p.slot === 'wicker' && worldBounds(p).min[1] > shelf2.max[1])).toBe(true);
    expect(styledParts.some((p) => p.slot === 'accent')).toBe(true);
  });

  it('gives mint-stack-tile a cool blue-undertone mint glaze and upgrades stale #d2e6c2 project copies', () => {
    const mint = MATERIAL_CATALOG_BY_ID['sage-shaker-kitchen:mint-stack-tile'];
    expect(mint).toBeDefined();
    const r = Number.parseInt(mint.color.slice(1, 3), 16);
    const g = Number.parseInt(mint.color.slice(3, 5), 16);
    const b = Number.parseInt(mint.color.slice(5, 7), 16);
    // Cool architectural mint: green is dominant and blue is substantially stronger than red (no yellowish cast).
    expect(g).toBeGreaterThan(b);
    expect(b - r).toBeGreaterThanOrEqual(24);

    const shield = MATERIAL_CATALOG_BY_ID['sage-shaker-kitchen:tempered-glass'];
    const shieldBase = MATERIAL_CATALOG_BY_ID['sage-shaker-kitchen:shield-base-white'];
    expect(shield).toBeDefined();
    expect(shield.opacity).toBeGreaterThanOrEqual(0.7);
    expect(shield.roughness).toBeGreaterThanOrEqual(0.35);
    expect(shieldBase).toBeDefined();
    expect(shieldBase.color.toLowerCase()).toBe('#f7f7f4');

    const p = createEmptyProject();
    p.materials[mint.id] = { ...mint, color: '#d2e6c2', roughness: 0.16 };
    p.materials[shield.id] = { ...shield, color: '#cfe4e2', roughness: 0.05, opacity: 0.36 };
    p.materials.mat_custom = { ...mint, id: 'mat_custom', catalogId: mint.id, color: '#a8d8cd', roughness: 0.2 };
    p.objects.obj_k1 = {
      id: 'obj_k1',
      assetId: 'sage-shaker-kitchen:l-kitchen',
      name: null,
      x: 0,
      y: 0,
      rotation: 0,
      width: 2.4,
      depth: 1.2,
      height: 2.6,
      elevation: 0,
      mirrored: false,
      locked: false,
      hidden: false,
      materials: {},
    };
    p.objects.obj_k2 = { ...p.objects.obj_k1, id: 'obj_k2', height: 2.4 };
    const repaired = repairProject(p).project;
    expect(repaired.materials[mint.id].color).toBe(mint.color);
    expect(repaired.materials[mint.id].roughness).toBe(mint.roughness);
    expect(repaired.materials[shield.id].color).toBe(shield.color);
    expect(repaired.materials[shield.id].opacity).toBe(shield.opacity);
    expect(repaired.materials[shield.id].roughness).toBe(shield.roughness);
    // User-customised colours and heights are preserved; unedited 2.6 m ceiling-tier kitchens drop to 2.22 m.
    expect(repaired.materials.mat_custom.color).toBe('#a8d8cd');
    expect(repaired.objects.obj_k1.height).toBe(2.22);
    expect(repaired.objects.obj_k2.height).toBe(2.4);
  });

  it('builds the tall vacuum niche shelf with a floorless vacuum bay and 1 upper white-basket cubby', () => {
    const shelf = ASSETS_BY_ID['laundry-storage:vacuum-niche-basket-shelf'];
    expect(shelf).toBeDefined();
    expect(shelf.slots.find((s) => s.id === 'basket')?.defaultMaterial).toBe('laundry-storage:white-basket-weave');

    const withBasket = withModel(shelf, 'with-basket');
    const empty = withModel(shelf, 'empty');
    const parts = withBasket.build(shelf.defaultSize);

    // Divider shelf sits >= 1.28 m above the floor at default height so both cordless stick vacuums (<= 1.26 m)
    // and robot vacuum stations (<= 0.43 m wide x 0.57 m tall) fit inside the open-bottom bay.
    const divider = parts[3];
    const divBounds = worldBounds(divider);
    expect(divBounds.min[1]).toBeGreaterThan(1.28);
    expect(shelf.defaultSize.w - 0.036).toBeGreaterThan(0.43);

    // No bottom floor board or front plinth obstructs the robot vacuum bay between the two side panels.
    const lowMiddleParts = parts.filter((p) => {
      const b = worldBounds(p);
      return b.min[1] < 0.5 && b.max[0] > -shelf.defaultSize.w / 2 + 0.025 && b.min[0] < shelf.defaultSize.w / 2 - 0.025;
    });
    expect(lowMiddleParts).toEqual([]);

    // Upper cubby contains 1 centred white basket in 'with-basket' and none in 'empty'.
    const basketParts = parts.filter((p) => p.slot === 'basket' || p.slot === 'trim');
    expect(basketParts.length).toBeGreaterThan(8);
    for (const bp of basketParts) {
      const b = worldBounds(bp);
      expect(b.min[1]).toBeGreaterThan(divBounds.max[1]);
      expect(b.max[1]).toBeLessThan(shelf.defaultSize.h - 0.018);
    }
    expect(empty.build(shelf.defaultSize).some((p) => p.slot === 'basket' || p.slot === 'trim')).toBe(false);

    // Resizing down to 1.36 m keeps the 32 cm upper basket cubby and leaves > 1.0 m clearance for robot docks.
    const compactParts = withBasket.build({ w: 0.45, d: 0.48, h: 1.36 });
    expect(worldBounds(compactParts[3]).min[1]).toBeGreaterThan(1.0);
  });

  it('independently resizes the left wall, right wall and top drop on arched-wall-portal without moving the opposite side', () => {
    const wall = ASSETS_BY_ID['portal-frames:arched-wall-portal'];
    expect(wall).toBeDefined();
    expect(wall.group).toBe('Portals & arches');
    expect(wall.params?.map((p) => p.id)).toEqual(['leftWall', 'rightWall', 'head', 'rL', 'rR']);

    const size = wall.defaultSize; // 3.0 x 0.12 x 2.7
    // Plan detail traces the clear opening from xl to xr across the front/back soffit edges.
    const openingSpan = (p?: Record<string, number>) => {
      const s = wall.planDetail!(size, p)[0];
      expect(s.kind).toBe('line');
      if (s.kind !== 'line') throw new Error('expected line');
      return [s.a[0], s.b[0]] as const;
    };

    const [xl0, xr0] = openingSpan();
    expect(xl0).toBeCloseTo(-1.5 + 0.22, 5);
    expect(xr0).toBeCloseTo(1.5 - 0.55, 5);

    // Widening the left wall past 30 % (to 1.4 m) moves xl right while keeping xr untouched.
    const [xlWideL, xrWideL] = openingSpan({ leftWall: 1.4 });
    expect(xlWideL).toBeCloseTo(-1.5 + 1.4, 5);
    expect(xrWideL).toBeCloseTo(xr0, 5);

    // Widening the right wall past 30 % (to 1.6 m) moves xr left while keeping xl untouched.
    const [xlWideR, xrWideR] = openingSpan({ rightWall: 1.6 });
    expect(xlWideR).toBeCloseTo(xl0, 5);
    expect(xrWideR).toBeCloseTo(1.5 - 1.6, 5);

    // Pushing both side walls to 4.0 m still preserves >= 0.28 m clear opening width.
    const [xlMax, xrMax] = openingSpan({ leftWall: 4.0, rightWall: 4.0 });
    expect(xrMax - xlMax).toBeCloseTo(0.28, 5);

    // Lowering the top wall drop (e.g. head = 1.4 m) pulls the arch crown down well below the 0.85 m default cap.
    const lowTopParts = wall.build(size, { head: 1.4, rL: 0, rR: 0 });
    const coreLeg = lowTopParts.find((p) => p.shape === 'box' && p.slot === 'frame' && Math.abs(p.position[2]) < 1e-4)!;
    expect(worldBounds(coreLeg).max[1]).toBeCloseTo(2.7 - 1.4, 5);

    // Flush and plain-flush models rebuild cleanly with edited side walls and top drop.
    for (const modelId of ['stepped', 'flush', 'plain-flush', 'sidelight']) {
      const m = withModel(wall, modelId);
      const built = m.build({ w: 1.6, d: 0.12, h: 2.5 }, { leftWall: 0.35, rightWall: 0.45, head: 0.7 });
      expect(built.length).toBeGreaterThan(0);
    }
  });
});

describeAssetChecks(packItems);
// Built-in items that packs gave models: every model keeps the item's outline and size.
describe('built-in items with pack models', () => {
  describeAssetChecks(ASSET_CATALOG.filter((a) => !a.pack && assetModels(a).length));
});

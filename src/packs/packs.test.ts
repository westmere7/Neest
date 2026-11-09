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

      // Upper-cabinet models include uppers, reeded glass & LED; no-uppers models omit uppers, glass & hood.
      expect(defClean.some((p) => p.slot === 'upper')).toBe(true);
      expect(defClean.some((p) => p.slot === 'glass' && p.shape === 'box')).toBe(true);
      expect(defSideHob.some((p) => p.slot === 'upper')).toBe(true);
      expect(defSideHob.some((p) => p.slot === 'glass' && p.shape === 'box')).toBe(true);
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
      const ps = clean.build({ w, d, h: 2.6 });
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
});

describeAssetChecks(packItems);
// Built-in items that packs gave models: every model keeps the item's outline and size.
describe('built-in items with pack models', () => {
  describeAssetChecks(ASSET_CATALOG.filter((a) => !a.pack && assetModels(a).length));
});

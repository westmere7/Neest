import { describe, expect, it } from 'vitest';
import '@/packs/loader';
import { MATERIAL_CATALOG_BY_ID } from '@/data/materials/catalog';
import { ASSET_CATALOG, ASSETS_BY_ID } from './catalog';
import { FAMILY_THEMES, THEMES, assetVariants, hsl, isGreen, matchingVariant, materialOverrides, sameFinish, slotFamily, userVariantsFor } from './variants';

const assets = ASSET_CATALOG.filter((a) => a.category !== 'custom');

describe('colour variant families', () => {
  it('only names catalogue materials in the theme tables', () => {
    for (const [family, themes] of Object.entries(FAMILY_THEMES)) {
      for (const t of THEMES) expect(MATERIAL_CATALOG_BY_ID[themes[t]], `${family}.${t} → ${themes[t]}`).toBeDefined();
    }
  });

  it('reads colours', () => {
    expect(hsl('#ff0000').h).toBeCloseTo(0);
    expect(hsl('#00ff00').h).toBeCloseTo(120);
    expect(isGreen('#2d5426')).toBe(true);
    expect(isGreen('#c2453b')).toBe(false);
    expect(isGreen('#888888')).toBe(false);
  });
});

describe('generated colour variants', () => {
  it('gives most items variants, and none to branded products', () => {
    const withVariants = assets.filter((a) => assetVariants(a).length > 0);
    expect(withVariants.length / assets.length).toBeGreaterThan(0.6);
    for (const a of assets.filter((x) => x.brand)) expect(assetVariants(a), a.id).toEqual([]);
  });

  it.each(assets.filter((a) => assetVariants(a).length).map((a) => [a.id, a] as const))('%s has valid, distinct variants', (_id, asset) => {
    const vs = assetVariants(asset);
    // Hand-made sets (asset.variants) are curated: more of them, and they may vary any slot.
    const preset = Boolean(asset.variants?.length);
    expect(vs[0].id).toBe('original');
    expect(vs[0].materials).toEqual({});
    expect(vs.length).toBeGreaterThanOrEqual(2);
    expect(vs.length).toBeLessThanOrEqual(preset ? 10 : 7);
    expect(new Set(vs.map((v) => v.id)).size).toBe(vs.length);
    const slots = new Set(asset.slots.map((s) => s.id));
    const keys = new Set<string>();
    for (const v of vs) {
      for (const [slot, id] of Object.entries(v.materials)) {
        expect(slots.has(slot), `${v.id}: slot ${slot}`).toBe(true);
        expect(MATERIAL_CATALOG_BY_ID[id], `${v.id}: ${slot} → ${id}`).toBeDefined();
        expect(id).not.toBe(asset.slots.find((s) => s.id === slot)!.defaultMaterial);
        // Lights, glass and fixed slots never change.
        if (!preset) expect(slotFamily(asset, slot), `${v.id}: ${slot} is fixed`).not.toBeNull();
      }
      const key = JSON.stringify(Object.entries(v.materials).sort());
      expect(keys.has(key), `duplicate ${v.id}`).toBe(false);
      keys.add(key);
      expect(v.swatch.length).toBeGreaterThan(0);
      expect(v.name.length).toBeGreaterThan(0);
    }
  });

  it('keeps foliage green and plant trunks, soil and stems as they are', () => {
    const plants = assets.filter((a) => a.type === 'plants');
    expect(plants.length).toBeGreaterThan(20);
    for (const a of plants) {
      for (const v of assetVariants(a)) {
        for (const [slot, id] of Object.entries(v.materials)) {
          const fam = slotFamily(a, slot);
          expect(['foliage', 'flower', 'pottery'], `${a.id} ${slot}`).toContain(fam);
          if (fam === 'foliage') expect(isGreen(MATERIAL_CATALOG_BY_ID[id].color), `${a.id} ${slot} → ${id}`).toBe(true);
        }
      }
    }
  });

  it('keeps sanitary ceramic, glass and lights fixed', () => {
    const toilet = ASSETS_BY_ID['toilet'];
    expect(slotFamily(toilet, 'ceramic')).toBeNull();
    expect(assetVariants(toilet)).toEqual([]);
    for (const a of assets) {
      for (const s of a.slots) {
        const m = MATERIAL_CATALOG_BY_ID[s.defaultMaterial];
        if (m?.emissive || m?.category === 'glass') expect(slotFamily(a, s.id), `${a.id} ${s.id}`).toBeNull();
      }
    }
  });

  it('coordinates wood, fabric and metal by theme on a sofa or chair', () => {
    const seat = assets.find((a) => a.type === 'seating' && a.slots.some((s) => slotFamily(a, s.id) === 'fabric') && a.slots.some((s) => slotFamily(a, s.id) === 'wood'));
    expect(seat).toBeDefined();
    const dark = assetVariants(seat!).find((v) => v.id === 'dark')!;
    const fabricSlot = seat!.slots.find((s) => slotFamily(seat!, s.id) === 'fabric')!.id;
    const woodSlot = seat!.slots.find((s) => slotFamily(seat!, s.id) === 'wood')!.id;
    expect(dark.materials[fabricSlot] ?? seat!.slots.find((s) => s.id === fabricSlot)!.defaultMaterial).toBe('fabric-charcoal');
    expect(dark.materials[woodSlot] ?? seat!.slots.find((s) => s.id === woodSlot)!.defaultMaterial).toBe('wood-walnut');
  });
});

describe('user variants and matching', () => {
  const sofa = assets.find((a) => assetVariants(a).length > 2 && a.slots.length >= 2)!;

  it('lists saved variants, dropping unknown slots and materials', () => {
    const slot = sofa.slots[0].id;
    const vs = userVariantsFor(sofa, [
      { id: 'a', name: 'Mine', materials: { [slot]: 'paint-navy', nope: 'paint-navy' } },
      { id: 'b', name: 'Custom', materials: { [slot]: 'mat_custom' }, defs: { mat_custom: { ...MATERIAL_CATALOG_BY_ID['paint-navy'], id: 'mat_custom', name: 'Custom navy' } } },
      { id: 'c', name: 'Gone', materials: { [slot]: 'mat_missing' } },
    ]);
    expect(vs.map((v) => v.id)).toEqual(['user:a', 'user:b', 'user:c']);
    expect(vs[0].materials).toEqual({ [slot]: 'paint-navy' });
    expect(vs[1].materials).toEqual({ [slot]: 'mat_custom' });
    expect(vs[2].materials).toEqual({});
    expect(vs.every((v) => v.user)).toBe(true);
  });

  it('matches an object finish to its variant', () => {
    const vs = assetVariants(sofa);
    const v = vs[2];
    expect(matchingVariant(sofa, { ...v.materials }, vs)?.id).toBe(v.id);
    expect(matchingVariant(sofa, {}, vs)?.id).toBe('original');
    const defaults = Object.fromEntries(sofa.slots.map((s) => [s.id, s.defaultMaterial]));
    expect(sameFinish(sofa, defaults, {})).toBe(true);
    expect(materialOverrides(sofa, defaults)).toEqual({});
  });

  it('has no variants for branded items even when saved', () => {
    const branded = assets.find((a) => a.brand)!;
    expect(userVariantsFor(branded, [{ id: 'x', name: 'x', materials: {} }])).toEqual([]);
  });
});

describe('applying variants to a project', async () => {
  const { produce } = await import('immer');
  const { createEmptyProject } = await import('@/domain/model/defaults');
  const { applyObjectVariant, placeObject, prepareVariantMaterials } = await import('@/domain/commands/entities');
  const chair = ASSETS_BY_ID['dining-chair'];
  const base = () =>
    produce(createEmptyProject(), (d) => {
      placeObject(d, { assetId: chair.id, x: 0, y: 0, width: chair.defaultSize.w, depth: chair.defaultSize.d, height: chair.defaultSize.h });
    });

  it('sets exactly the variant materials and copies catalogue materials in', () => {
    const p0 = base();
    const id = Object.keys(p0.objects)[0];
    const dark = assetVariants(chair).find((v) => v.id === 'dark')!;
    const p1 = produce(p0, (d) => applyObjectVariant(d, [id], dark.materials));
    expect(p1.objects[id].materials).toEqual(dark.materials);
    for (const m of Object.values(dark.materials)) expect(p1.materials[m]).toBeDefined();
    const p2 = produce(p1, (d) => applyObjectVariant(d, [id], {}));
    expect(p2.objects[id].materials).toEqual({});
  });

  it('adds carried materials, under a new id when that id already means something else here', () => {
    const navy = MATERIAL_CATALOG_BY_ID['paint-navy'];
    const edited = { ...navy, color: '#112233' };
    const custom = { ...navy, id: 'mat_mine', name: 'Mine', color: '#445566' };
    const p0 = produce(base(), (d) => {
      d.materials['paint-navy'] = { ...navy, color: '#998877' }; // this project edited its navy differently
    });
    let ids: Record<string, string> = {};
    const p1 = produce(p0, (d) => {
      ids = prepareVariantMaterials(d, { frame: 'paint-navy', seat: 'mat_mine' }, { 'paint-navy': edited, mat_mine: custom });
    });
    expect(ids.seat).toBe('mat_mine');
    expect(p1.materials['mat_mine'].color).toBe('#445566');
    expect(ids.frame).not.toBe('paint-navy');
    expect(p1.materials[ids.frame].color).toBe('#112233');
    expect(p1.materials['paint-navy'].color).toBe('#998877');
    // Same definition already present: reused, not duplicated.
    const p2 = produce(p1, (d) => {
      ids = prepareVariantMaterials(d, { seat: 'mat_mine' }, { mat_mine: custom });
    });
    expect(ids.seat).toBe('mat_mine');
    expect(Object.keys(p2.materials).length).toBe(Object.keys(p1.materials).length);
  });
});

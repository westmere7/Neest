import { describe, expect, it } from 'vitest';
import '@/packs/loader';
import { MATERIAL_CATALOG_BY_ID } from '@/data/materials/catalog';
import { ASSET_CATALOG, ASSETS_BY_ID } from './catalog';
import { LOOKS, ROLE_FALLBACK, TONES, archetypeOf, materialKind, slotRoles, type Role } from './variantLooks';
import { assetVariants, hsl, isGreen, matchingVariant, materialOverrides, sameFinish, userVariantsFor } from './variants';

const assets = ASSET_CATALOG.filter((a) => a.category !== 'custom');
const generated = assets.filter((a) => !a.variants?.length && !a.brand);
const mat = (id: string) => MATERIAL_CATALOG_BY_ID[id];

/** Every generated variant of every item with the role of each slot it changes. */
function* changes() {
  for (const a of generated) {
    const arche = archetypeOf(a);
    const roles = slotRoles(a, arche);
    for (const v of assetVariants(a).slice(1)) {
      for (const [slot, id] of Object.entries(v.materials)) {
        const i = a.slots.findIndex((s) => s.id === slot);
        yield { asset: a, arche, variant: v, slot, role: roles[i], from: a.slots[i].defaultMaterial, to: id };
      }
    }
  }
}

describe('tones and looks', () => {
  it('only names catalogue materials in the tone table', () => {
    for (const [tone, kinds] of Object.entries(TONES)) {
      for (const [kind, id] of Object.entries(kinds)) expect(mat(id!), `${tone}.${kind} → ${id}`).toBeDefined();
    }
  });

  it('writes looks with known tones and at most seven per archetype', () => {
    for (const [arche, looks] of Object.entries(LOOKS)) {
      expect(looks.length, arche).toBeGreaterThanOrEqual(4);
      expect(new Set(looks.map((l) => l.id)).size, arche).toBe(looks.length);
      for (const l of looks) {
        for (const [role, tones] of Object.entries(l.roles)) {
          for (const t of Array.isArray(tones) ? tones : [tones]) expect(TONES[t], `${arche}/${l.id}: ${role} → ${t}`).toBeDefined();
        }
      }
    }
    for (const [role, alt] of Object.entries(ROLE_FALLBACK)) expect(role).not.toBe(alt);
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
  it('gives most items variants, and branded products only the finishes the maker sells', () => {
    const withVariants = assets.filter((a) => assetVariants(a).length > 0);
    expect(withVariants.length / assets.length).toBeGreaterThan(0.7);
    for (const a of assets.filter((x) => x.brand)) {
      const vs = assetVariants(a);
      if (!a.variants?.length) expect(vs, a.id).toEqual([]);
      else for (const v of vs.slice(1)) expect(a.variants.some((p) => p.id === v.id), `${a.id}: ${v.id} is not a factory finish`).toBe(true);
    }
  });

  it.each(assets.filter((a) => assetVariants(a).length).map((a) => [a.id, a] as const))('%s has valid, distinct, well-named variants', (_id, asset) => {
    const vs = assetVariants(asset);
    // Hand-made sets (asset.variants) are curated: more of them, and they may vary any slot.
    const preset = Boolean(asset.variants?.length);
    const roles = slotRoles(asset, archetypeOf(asset));
    expect(vs[0].id).toBe('original');
    expect(vs[0].materials).toEqual({});
    expect(vs.length).toBeGreaterThanOrEqual(2);
    expect(vs.length).toBeLessThanOrEqual(preset ? 10 : 7);
    expect(new Set(vs.map((v) => v.id)).size).toBe(vs.length);
    if (!preset) expect(new Set(vs.map((v) => v.name)).size, vs.map((v) => v.name).join(' | ')).toBe(vs.length);
    const slots = new Set(asset.slots.map((s) => s.id));
    const keys = new Set<string>();
    for (const v of vs) {
      for (const [slot, id] of Object.entries(v.materials)) {
        expect(slots.has(slot), `${v.id}: slot ${slot}`).toBe(true);
        expect(mat(id), `${v.id}: ${slot} → ${id}`).toBeDefined();
        expect(id).not.toBe(asset.slots.find((s) => s.id === slot)!.defaultMaterial);
        // Lights, glass, props and other fixed slots never change.
        if (!preset) expect(roles[asset.slots.findIndex((s) => s.id === slot)], `${v.id}: ${slot} is fixed`).not.toBeNull();
      }
      const key = JSON.stringify(Object.entries(v.materials).sort());
      expect(keys.has(key), `duplicate ${v.id}`).toBe(false);
      keys.add(key);
      expect(v.swatch.length).toBeGreaterThan(0);
      expect(v.name.trim().length).toBeGreaterThan(0);
    }
  });

  it('keeps sheets and bedding white, cream or light grey', () => {
    let n = 0;
    for (const c of changes()) {
      if (c.role !== 'sheets') continue;
      n++;
      expect(hsl(mat(c.to).color).l, `${c.asset.id} ${c.variant.id}: ${c.slot} → ${c.to}`).toBeGreaterThan(0.72);
    }
    expect(n).toBeGreaterThan(5);
  });

  it('dresses a bed sensibly: white sheets, a coloured duvet, a frame that suits it', () => {
    const bed = ASSETS_BY_ID['bed-double'];
    const vs = assetVariants(bed);
    const navy = vs.find((v) => v.id === 'walnut-navy')!;
    expect(navy.materials).toMatchObject({ frame: 'wood-walnut', duvet: 'fabric-navy' });
    expect(navy.materials.bedding ?? 'fabric-white-cotton').toBe('fabric-white-cotton');
    for (const v of vs) expect(hsl(mat(v.materials.bedding ?? 'fabric-white-cotton').color).l).toBeGreaterThan(0.72);
  });

  it('gives appliances and electronics only the finishes they are sold in', () => {
    const ok = new Set(['metal-brushed-steel', 'metal-stainless-polished', 'metal-black-matte', 'metal-white-powder', 'metal-anthracite', 'metal-chrome', 'metal-gunmetal', 'metal-brass']);
    for (const c of changes()) {
      if (c.arche !== 'appliance' || mat(c.to).category !== 'metal') continue;
      // Brass only for small handles on a coloured range or fridge.
      if (c.to === 'metal-brass') expect(c.role, `${c.asset.id}: ${c.slot}`).toBe('hardware');
      expect(ok.has(c.to), `${c.asset.id} ${c.variant.id}: ${c.slot} → ${c.to}`).toBe(true);
    }
  });

  it('gives taps and bathroom metalwork real tap finishes', () => {
    const ok = new Set(['metal-chrome', 'metal-brass', 'metal-black-matte', 'metal-gunmetal', 'metal-brushed-steel', 'metal-bronze']);
    for (const c of changes()) {
      if (c.role !== 'tap') continue;
      expect(ok.has(c.to), `${c.asset.id} ${c.variant.id}: ${c.slot} → ${c.to}`).toBe(true);
    }
  });

  it('never paints a live-edge slab, a carved piece or traditional hardwood', () => {
    for (const id of ['wooden-tables:walnut-slab-dining-table', 'wooden-tables:indochine-tea-table', 'wooden-tables:wine-barrel-side-table', 'chinese-home:porcelain-floor-vase']) {
      const a = ASSETS_BY_ID[id];
      if (!a) continue;
      for (const v of assetVariants(a)) {
        for (const [slot, m] of Object.entries(v.materials)) {
          const from = materialKind(mat(a.slots.find((s) => s.id === slot)!.defaultMaterial));
          if (from === 'grain' || from === 'planks') expect(mat(m).category, `${id} ${v.id}: ${slot} → ${m}`).toBe('wood');
        }
      }
    }
  });

  it('keeps food, props and colour-coded parts as they are', () => {
    const fixed: Record<string, string[]> = {
      'play-mat': ['red', 'yellow', 'blue', 'green'],
      'toy-blocks': ['red', 'yellow', 'blue'],
      'foosball-table': ['red', 'blue', 'field'],
      'fruit-bowl': ['red', 'yellow', 'green'],
      'chess-table': ['white', 'black', 'board'],
      'art-canvas-large': ['paint1', 'paint2', 'paint3'],
      'artwork-framed': ['mat', 'art'],
      'clothes-rail': ['clothesA', 'clothesB'],
    };
    for (const [id, slots] of Object.entries(fixed)) {
      const a = ASSETS_BY_ID[id];
      expect(a, id).toBeDefined();
      for (const v of assetVariants(a)) for (const s of slots) expect(v.materials[s], `${id} ${v.id}: ${s}`).toBeUndefined();
    }
  });

  it('keeps plant leaves and trunks; only pots and multi-colour flowers change', () => {
    const plants = assets.filter((a) => a.type === 'plants');
    expect(plants.length).toBeGreaterThan(20);
    for (const a of plants) {
      const roles = slotRoles(a, 'plant');
      for (const v of assetVariants(a)) {
        for (const slot of Object.keys(v.materials)) {
          const role: Role | null = roles[a.slots.findIndex((s) => s.id === slot)];
          expect(['pot', 'flower'], `${a.id} ${slot}`).toContain(role);
        }
      }
    }
  });

  it('keeps sanitary ceramic, glass and lights fixed', () => {
    const toilet = ASSETS_BY_ID['toilet'];
    expect(slotRoles(toilet, archetypeOf(toilet))[toilet.slots.findIndex((s) => s.id === 'ceramic')]).toBeNull();
    for (const a of assets) {
      const roles = slotRoles(a, archetypeOf(a));
      a.slots.forEach((s, i) => {
        const m = mat(s.defaultMaterial);
        if (m?.emissive || m?.category === 'glass') expect(roles[i], `${a.id} ${s.id}`).toBeNull();
      });
    }
  });

  it('names a look after what it does on the item', () => {
    // A sofa on metal legs takes brass, not oak, in the "Sage & oak" look.
    const sofa = assetVariants(ASSETS_BY_ID['sofa-3-seat']).find((v) => v.id === 'sage-oak')!;
    expect(sofa.materials.legs).toBe('metal-brass');
    expect(sofa.name).toBe('Sage & brass');
    // A leather Chesterfield takes leather, never fabric.
    for (const v of assetVariants(ASSETS_BY_ID['sofa-chesterfield'])) {
      if (v.materials.upholstery) expect(mat(v.materials.upholstery).category).toBe('leather');
    }
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
    const look = assetVariants(chair)[1];
    const p1 = produce(p0, (d) => applyObjectVariant(d, [id], look.materials));
    expect(p1.objects[id].materials).toEqual(look.materials);
    for (const m of Object.values(look.materials)) expect(p1.materials[m]).toBeDefined();
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

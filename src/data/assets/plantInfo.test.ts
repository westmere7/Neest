import { describe, expect, it } from 'vitest';
import '@/packs/loader';
import { ASSET_CATALOG, ASSETS_BY_ID } from './catalog';
import { PLANT_SPECIES } from './plantSpecies';
import { checkPlantInfo, plantLightText, plantLowest, plantMatureSize, plantSearchText, plantSizeRange, plantTempRange } from './plantInfo';
import type { PlantInfo } from './types';
import { applyPacks, installedPacks } from '@/packs/runtime';
import { definePack, matSlot, span } from '@/packs/kit';

const GUIDE: PlantInfo = {
  botanical: 'Ficus lyrata',
  family: 'Moraceae',
  light: ['bright-indirect', 'direct-sun'],
  spot: 'Within 1 m of a bright window',
  avoid: 'Radiators and draughts',
  rooms: ['Living room'],
  water: { summer: 'Every 7–10 days', winter: 'Every 2–3 weeks', sign: 'Top 5 cm dry' },
  humidity: { level: 'average', note: '40–60 %' },
  temperature: { min: 16, max: 27, lowest: 12 },
  soil: 'Chunky mix',
  repot: 'Every 2 years',
  feed: 'Monthly in summer',
  height: [1.5, 3],
  spread: [0.6, 1.2],
  growth: 'moderate',
  pets: { safe: false, note: 'Toxic sap' },
  difficulty: 'moderate',
};

describe('plant care guide helpers', () => {
  it('formats temperatures in °C first, or °F first for imperial projects', () => {
    expect(plantTempRange(GUIDE.temperature, 'm')).toBe('16–27 °C (61–81 °F)');
    expect(plantTempRange(GUIDE.temperature, 'ft')).toBe('61–81 °F (16–27 °C)');
    expect(plantLowest(GUIDE.temperature, 'cm')).toBe('Not below 12 °C (54 °F)');
    expect(plantLowest(GUIDE.temperature, 'in')).toBe('Not below 54 °F (12 °C)');
  });

  it('formats mature sizes in friendly units', () => {
    expect(plantSizeRange([0.3, 0.6], 'm')).toBe('30–60 cm');
    expect(plantSizeRange([1.5, 3], 'mm')).toBe('1.5–3 m');
    expect(plantSizeRange([0.3, 0.6], 'ft')).toBe('12–24 in');
    expect(plantSizeRange([1.5, 3], 'ft')).toBe('4.9–9.8 ft');
    expect(plantMatureSize(GUIDE, 'm')).toBe('1.5–3 m tall, 0.6–1.2 m wide');
  });

  it('describes light levels brightest first', () => {
    expect(plantLightText(['bright-indirect', 'direct-sun'])).toBe('Direct sun to bright indirect');
    expect(plantLightText(['low', 'medium', 'bright-indirect'])).toBe('Bright indirect to low light');
    expect(plantLightText(['medium'])).toBe('Medium light');
  });

  it('makes plants findable by botanical name, light, pets and rooms', () => {
    const text = plantSearchText({ ...GUIDE, pets: { safe: true, note: 'Non-toxic' }, light: ['low'] }).toLowerCase();
    for (const word of ['ficus lyrata', 'low light', 'pet safe', 'living room']) expect(text).toContain(word);
  });

  it('accepts a complete guide and reports what is wrong with a broken one', () => {
    expect(checkPlantInfo(GUIDE)).toEqual([]);
    expect(checkPlantInfo(null)).toHaveLength(1);
    const broken = { ...GUIDE, light: ['moonlight'], temperature: { min: 20, max: 10, lowest: 5 }, height: [2, 1], pets: { note: 'x' } };
    const errors = checkPlantInfo(broken);
    expect(errors.some((e) => e.startsWith('light'))).toBe(true);
    expect(errors.some((e) => e.startsWith('temperature'))).toBe(true);
    expect(errors.some((e) => e.startsWith('height'))).toBe(true);
    expect(errors.some((e) => e.startsWith('pets'))).toBe(true);
  });
});

describe('houseplants pack', () => {
  const plants = ASSET_CATALOG.filter((a) => a.pack?.id === 'houseplants');

  it('loads 25+ plants without errors, all on plant shelves', () => {
    expect(installedPacks().find((p) => p.id === 'houseplants')?.errors).toEqual([]);
    expect(plants.length).toBeGreaterThanOrEqual(25);
    for (const p of plants) {
      expect(p.type, p.id).toBe('plants');
      expect(p.category, p.id).toBe('plants');
    }
    expect(new Set(plants.map((p) => p.group))).toEqual(new Set(['Trees', 'Indoor plants', 'Succulents & cacti', 'Hanging plants']));
  });

  it.each(plants.map((p) => [p.id, p] as const))('%s has a complete care guide', (_id, asset) => {
    expect(asset.plant).toBeDefined();
    expect(checkPlantInfo(asset.plant)).toEqual([]);
    expect(asset.description?.length).toBeGreaterThan(20);
  });

  it('covers every light level, both pet-safety answers and all difficulties', () => {
    const guides = plants.map((p) => p.plant!);
    for (const level of ['direct-sun', 'bright-indirect', 'medium', 'low'] as const) expect(guides.some((g) => g.light.includes(level))).toBe(true);
    expect(guides.some((g) => g.pets.safe)).toBe(true);
    expect(guides.some((g) => !g.pets.safe)).toBe(true);
    for (const d of ['easy', 'moderate', 'demanding'] as const) expect(guides.some((g) => g.difficulty === d)).toBe(true);
  });

  it('hangs ceiling plants with their top at the ceiling', () => {
    const hangingPlants = plants.filter((p) => p.mount === 'ceiling');
    expect(hangingPlants.length).toBeGreaterThanOrEqual(3);
  });

  it('keeps every plant cheap to draw (under 160 parts at the largest size)', () => {
    for (const p of plants) expect(p.build(p.maxSize ?? p.defaultSize).length, p.id).toBeLessThanOrEqual(160);
  });
});

describe('pack loader and plant info', () => {
  it('drops a malformed care guide but keeps the item', () => {
    const modules = Object.fromEntries(Object.entries(import.meta.glob(['/packs/*.pack.ts', '!/packs/_*'], { eager: true })));
    const spec = definePack({
      name: 'Plant test',
      items: [
        {
          id: 'pot',
          name: 'Test pot',
          category: 'plants',
          type: 'plants',
          group: 'Indoor plants',
          tags: ['pot'],
          defaultSize: { w: 0.3, d: 0.3, h: 0.3 },
          slots: [matSlot('pot', 'Pot', 'terracotta-pot')],
          build: ({ w, d, h }) => [span('pot', [-w / 2, w / 2], [0, h], [-d / 2, d / 2])],
          plant: { ...GUIDE, temperature: { min: 30, max: 10, lowest: 0 } },
        },
        {
          id: 'ok',
          name: 'Good plant',
          category: 'plants',
          type: 'plants',
          group: 'Indoor plants',
          tags: ['ok'],
          defaultSize: { w: 0.3, d: 0.3, h: 0.3 },
          slots: [matSlot('pot', 'Pot', 'terracotta-pot')],
          build: ({ w, d, h }) => [span('pot', [-w / 2, w / 2], [0, h], [-d / 2, d / 2])],
          plant: GUIDE,
        },
      ],
    });
    try {
      const [loaded] = applyPacks({ '/packs/plant-test.pack.ts': { default: spec } });
      expect(ASSETS_BY_ID['plant-test:pot']).toBeDefined();
      expect(ASSETS_BY_ID['plant-test:pot'].plant).toBeUndefined();
      expect(ASSETS_BY_ID['plant-test:ok'].plant?.botanical).toBe('Ficus lyrata');
      expect(loaded.errors.join(' ')).toMatch(/plant info ignored.*temperature/);
    } finally {
      applyPacks(modules);
    }
  });
});


describe('plant species database and the Plants section', () => {
  it.each(Object.entries(PLANT_SPECIES))('species %s is a complete guide', (_id, info) => {
    expect(checkPlantInfo(info)).toEqual([]);
  });
  const all = ASSET_CATALOG.filter((a) => a.category !== 'custom');
  it('keeps every plant in Plants & flowers with a species guide', () => {
    const plants = all.filter((a) => a.type === 'plants' || a.category === 'plants');
    expect(plants.length).toBeGreaterThan(90);
    const species = new Set<PlantInfo>(Object.values(PLANT_SPECIES));
    for (const a of plants) {
      expect(a.category, `${a.id} category`).toBe('plants');
      expect(a.type, `${a.id} type`).toBe('plants');
      expect(a.plant, `${a.id} needs plant: PLANT_SPECIES[...]`).toBeDefined();
      expect(checkPlantInfo(a.plant!), a.id).toEqual([]);
      expect(species.has(a.plant!), `${a.id} plant info must come from PLANT_SPECIES`).toBe(true);
    }
  });
  it('has no plant info, and no plant-named items, outside the Plants section', () => {
    const plantName = /\b(potted plant|houseplant|cactus|succulents?|bonsai|terrarium|bouquet|fern|orchid|monstera|palm tree|flowers? in)\b/i;
    for (const a of all.filter((x) => x.category !== 'plants')) {
      expect(a.plant, `${a.id} has plant info but is not in Plants`).toBeUndefined();
      expect(plantName.test(a.name), `${a.id} (${a.name}) looks like a plant: put it in category 'plants'`).toBe(false);
    }
  });
});

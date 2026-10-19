import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@/packs/loader';
import { MaterialSchema } from '@/domain/model/schema';
import { createEmptyProject } from '@/domain/model/defaults';
import { CATALOG_PHOTO_IDS, MATERIAL_CATALOG, MATERIAL_CATALOG_BY_ID } from '@/data/materials/catalog';
import { PHOTO_SETS, PHOTO_SETS_BY_ID } from '@/data/materials/photoSets';
import { TEXTURE_PATTERNS } from '@/data/materials/patterns';
import { migrateProject } from '@/storage/migrations';
import { MaterialRegistry } from '@/features/scene-3d/materialRegistry';
import { photoGain, PHOTO_TARGET_LINEAR } from '@/features/materials/photoTextures';

const TEXTURES = path.resolve(__dirname, '../../../public/textures');

describe('photo texture sets', () => {
  it('lists unique, well-formed CC0 sets', () => {
    expect(PHOTO_SETS.length).toBeGreaterThan(20);
    expect(new Set(PHOTO_SETS.map((s) => s.id)).size).toBe(PHOTO_SETS.length);
    for (const s of PHOTO_SETS) {
      expect(s.id).toMatch(/^[a-z0-9-]+$/);
      expect(['ambientcg', 'polyhaven']).toContain(s.source);
      expect(s.assetId.length).toBeGreaterThan(0);
      expect(s.size).toBeGreaterThan(0.05);
      expect([1024, 2048]).toContain(s.resolution);
    }
  });

  it('maps catalogue materials to existing sets and keeps their procedural fallback', () => {
    expect(CATALOG_PHOTO_IDS.length).toBeGreaterThan(40);
    for (const id of CATALOG_PHOTO_IDS) {
      const m = MATERIAL_CATALOG_BY_ID[id];
      expect(m, `catalogue material ${id}`).toBeDefined();
      expect(m.photo, id).not.toBeNull();
      expect(PHOTO_SETS_BY_ID[m.photo!.setId], `${id} → ${m.photo!.setId}`).toBeDefined();
      expect(m.photo!.scale).toBeGreaterThan(0);
      expect(m.photo!.enabled).toBe(true);
      if (m.texture) expect(TEXTURE_PATTERNS[m.texture.patternId]).toBeDefined();
      expect(m.source.license).toMatch(/CC0/);
      expect(m.source.url).toMatch(/^https:\/\/(ambientcg\.com|polyhaven\.com)\/a\//);
    }
    // Every set is used by at least one material (catalogue or content pack: packs/*.pack.ts `photo`).
    const used = new Set(MATERIAL_CATALOG.flatMap((m) => (m.photo ? [m.photo.setId] : [])));
    for (const s of PHOTO_SETS) expect(used.has(s.id), `unused set ${s.id}`).toBe(true);
  });

  it('keeps the downloaded files and manifest consistent (when present)', () => {
    const file = path.join(TEXTURES, 'manifest.json');
    if (!existsSync(file)) return; // files are optional: the app falls back to procedural textures
    const manifest = JSON.parse(readFileSync(file, 'utf8')) as {
      sets: Record<string, { assetId: string; license: string; url: string; maps: Record<string, string>; meanLinear: number[]; bytes: number }>;
    };
    let total = 0;
    for (const s of PHOTO_SETS) {
      const e = manifest.sets[s.id];
      expect(e, `manifest entry ${s.id}`).toBeDefined();
      expect(e.assetId).toBe(s.assetId);
      expect(e.license).toMatch(/^CC0/);
      expect(e.url).toMatch(/^https:\/\//);
      expect(e.meanLinear).toHaveLength(3);
      expect(e.maps.color).toBe('color.webp');
      for (const f of Object.values(e.maps)) {
        const p = path.join(TEXTURES, s.id, f);
        expect(existsSync(p), p).toBe(true);
        total += statSync(p).size;
      }
    }
    expect(total).toBeLessThan(60 * 1024 * 1024);
  });
});

describe('photo colour normalisation', () => {
  it('brings the photo average to the procedural tile average', () => {
    const g = photoGain({ meanLinear: [0.3, 0.15, 0.06] });
    expect(g[0] * 0.3).toBeCloseTo(PHOTO_TARGET_LINEAR);
    expect(g[1] * 0.15).toBeCloseTo(PHOTO_TARGET_LINEAR);
    expect(g[2] * 0.06).toBeCloseTo(PHOTO_TARGET_LINEAR);
    expect(Math.max(...photoGain({ meanLinear: [0, 0, 0] }))).toBeLessThanOrEqual(24);
  });
});

describe('photo references in projects', () => {
  it('defaults to no photo for materials saved without one', () => {
    const { photo: _p, ...old } = MATERIAL_CATALOG_BY_ID['solid-white'];
    expect(MaterialSchema.parse(old).photo).toBeNull();
  });

  it('gives older catalogue copies their photo texture on load, but respects edits', () => {
    const p = createEmptyProject({ name: 'Photo migration' });
    const raw = JSON.parse(JSON.stringify(p)) as Record<string, unknown>;
    const strip = (id: string, patch: Record<string, unknown> = {}) => {
      const { photo: _p, ...m } = { ...MATERIAL_CATALOG_BY_ID[id], ...patch };
      return m;
    };
    raw.materials = {
      'wood-oak-natural': strip('wood-oak-natural'),
      'wood-walnut': strip('wood-walnut', { texture: { patternId: 'marble', scale: 1, rotation: 0, contrast: 1 } }),
      mat_override: strip('wood-oak-natural', { id: 'mat_override', catalogId: null, overrideOf: 'wood-oak-natural', name: 'Oak (override)' }),
      'tile-checker': { ...MATERIAL_CATALOG_BY_ID['tile-checker'], photo: null },
      'tile-terrazzo': { ...MATERIAL_CATALOG_BY_ID['tile-terrazzo'], photo: { ...MATERIAL_CATALOG_BY_ID['tile-terrazzo'].photo!, enabled: false } },
    };
    const { project } = migrateProject(raw);
    expect(project.materials['wood-oak-natural'].photo).toEqual(MATERIAL_CATALOG_BY_ID['wood-oak-natural'].photo);
    expect(project.materials['wood-walnut'].photo).toBeNull(); // pattern changed by the user
    expect(project.materials.mat_override.photo?.setId).toBe('oak-planks');
    expect(project.materials['tile-checker'].photo?.setId).toBe('checker-marble'); // null = never set
    expect(project.materials['tile-terrazzo'].photo?.enabled).toBe(false); // switched to procedural: kept
  });
});

describe('material registry without photo files', () => {
  // jsdom has no 2D canvas and reports getContext as not implemented.
  beforeEach(() => void vi.spyOn(console, 'error').mockImplementation(() => undefined));
  afterEach(() => void vi.restoreAllMocks());

  it('falls back to the procedural/flat material and keeps the base colour', () => {
    const reg = new MaterialRegistry();
    const project = { materials: {} };
    const mat = reg.get(project, 'wood-oak-natural');
    expect(mat.userData.neestPhoto).toBe(false);
    expect(mat.roughnessMap).toBeNull();
    expect(`#${mat.color.getHexString()}`).toBe(MATERIAL_CATALOG_BY_ID['wood-oak-natural'].color);
    // In-place updates still reach the shared instance.
    const edited = { ...MATERIAL_CATALOG_BY_ID['wood-oak-natural'], color: '#123456', photo: { ...MATERIAL_CATALOG_BY_ID['wood-oak-natural'].photo!, enabled: false } };
    reg.sync({ materials: { 'wood-oak-natural': edited } });
    expect(reg.get({ materials: { 'wood-oak-natural': edited } }, 'wood-oak-natural')).toBe(mat);
    expect(`#${mat.color.getHexString()}`).toBe('#123456');
    reg.dispose();
  });
});

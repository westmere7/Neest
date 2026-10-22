import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import '@/packs/loader';
import { ASSET_CATALOG, ASSET_GROUPS } from './catalog';
import { MATERIAL_CATALOG } from '@/data/materials/catalog';
import LEGACY_COPLANAR from './legacyCoplanar.json';
import ITEM_DESCRIPTIONS from './itemDescriptions.json';
import { coplanarClashes } from './coplanar';
import { assetModels, withModel } from './models';

/**
 * House rules for library content (built-in and /packs), so items added later by people or agents
 * keep the same structure. KNOWLEDGEBASE.md §12 "Asset rules" and packs/README.md explain each one;
 * describeAssetChecks (catalog.test.ts, packs.test.ts) covers geometry, slots and lights.
 */
const items = ASSET_CATALOG.filter((a) => a.category !== 'custom');
const packFile = (id: string) => (id.includes(':') ? id.split(':')[0] : null);
const root = path.resolve(__dirname, '../../..');
const readJson = (p: string) => (existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as Record<string, unknown>) : null);

describe('asset rules', () => {
  it('ids are lowercase kebab-case and names are unique within a room', () => {
    const seen = new Map<string, string>();
    for (const a of items) {
      const local = a.id.split(':').pop()!;
      expect(local, a.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      const key = `${a.category}|${a.name.toLowerCase()}`;
      expect(seen.get(key), `${a.id} has the same name as ${seen.get(key)} in ${a.category}`).toBeUndefined();
      seen.set(key, a.id);
    }
  });

  it('every item has at least three search tags and a description', () => {
    // New items define `description` themselves; older ones take it from itemDescriptions.json.
    for (const a of items) {
      expect((a.description?.trim().length ?? 0) >= 20, `${a.id} needs a one- or two-sentence description (20+ characters)`).toBe(true);
      expect(new Set(a.tags.map((t) => t.toLowerCase())).size, `${a.id} needs 3+ distinct tags`).toBeGreaterThanOrEqual(3);
    }
    const ids = new Set(items.map((a) => a.id));
    expect(Object.keys(ITEM_DESCRIPTIONS).filter((id) => !ids.has(id)), 'ids in itemDescriptions.json that no longer exist').toEqual([]);
  });

  it('parts of different slots never share a face plane (they flicker in 3D)', () => {
    // A grille disc whose top is level with the body's top, a label flush with its panel: lift the
    // smaller part 1 mm proud (see coplanar.ts). Items from before this rule are listed in
    // legacyCoplanar.json; the list may only shrink.
    const legacy = new Set<string>(LEGACY_COPLANAR);
    for (const a of items) {
      const looks = [a, ...assetModels(a).map((m) => withModel(a, m.id))];
      const clashes = looks.flatMap((l) => coplanarClashes(l.build(l.defaultSize)).map((c) => ({ id: l.id, ...c })));
      if (legacy.has(a.id)) {
        expect(clashes.length, `${a.id} no longer has coplanar parts: remove it from legacyCoplanar.json`).toBeGreaterThan(0);
        continue;
      }
      const c = clashes[0];
      expect(c, c && `${c.id}: parts #${c.parts[0]} ('${c.slots[0]}') and #${c.parts[1]} ('${c.slots[1]}') share the plane ${c.axis} = ${c.plane.toFixed(4)}`).toBeUndefined();
    }
    const ids = new Set(items.map((a) => a.id));
    expect(LEGACY_COPLANAR.filter((id) => !ids.has(id)), 'ids in legacyCoplanar.json that no longer exist').toEqual([]);
  });

  it('plants, flowers and other vegetation always have a description', () => {
    for (const a of items.filter((x) => x.category === 'plants')) expect(a.description?.trim().length ?? 0, a.id).toBeGreaterThanOrEqual(20);
  });

  it('versions of an item (variantOf) point to an existing item on the same shelf', () => {
    const byId = new Map(items.map((a) => [a.id, a]));
    for (const a of items.filter((x) => x.variantOf)) {
      const base = byId.get(a.variantOf!);
      expect(base, `${a.id}: variantOf ${a.variantOf} does not exist`).toBeDefined();
      expect(`${base!.category}|${base!.group}`, `${a.id} should sit on the same shelf as ${a.variantOf}`).toBe(`${a.category}|${a.group}`);
    }
  });

  it('shelves (groups) belong to the item type', () => {
    for (const a of items) expect(ASSET_GROUPS[a.type] ?? [], `${a.id}: group '${a.group}' is not in ASSET_GROUPS.${a.type}`).toContain(a.group);
  });

  it('branded packs only hold real models with brand info', () => {
    for (const a of items) {
      const pack = packFile(a.id);
      if (pack?.startsWith('branded-')) expect(a.brand, `${a.id} is in a branded pack but has no brand { name, model }`).toBeDefined();
      if (!a.brand) continue;
      expect(a.brand.name.trim(), a.id).not.toBe('');
      expect(a.brand.model.trim(), `${a.id} needs the exact model number`).not.toBe('');
      expect(a.name.toLowerCase(), `${a.id}: the name should start with or include the maker`).toContain(a.brand.name.toLowerCase().split(' ')[0]);
    }
  });

  it('items whose name mentions a brand carry brand info', () => {
    const brandWords = /\b(samsung|lg|sony|panasonic|toshiba|daikin|macbook|imac|ipad|iphone|dell|asus|lenovo|toto|inax|grohe|bosch|xiaomi|electrolux|jbl)\b/i;
    for (const a of items) if (!a.brand) expect(brandWords.test(a.name), `${a.id} (${a.name}) names a brand: add brand { name, model } or rename it`).toBe(false);
  });

  it('every item has a shipped thumbnail (npm run thumbs)', () => {
    const m = readJson(path.join(root, 'public/thumbs/manifest.json')) as { items: Record<string, { file: string }> } | null;
    expect(m, 'public/thumbs/manifest.json is missing: run npm run thumbs').not.toBeNull();
    const missing = items.filter((a) => !m!.items[a.id] || !existsSync(path.join(root, 'public/thumbs', m!.items[a.id].file))).map((a) => a.id);
    expect(missing, 'items without a pre-rendered thumbnail: run npm run thumbs').toEqual([]);
  });

  it('every textured material has a shipped swatch (npm run thumbs)', () => {
    const m = readJson(path.join(root, 'public/swatches/manifest.json')) as { ids: Record<string, string>; files: Record<string, { file: string }> } | null;
    expect(m, 'public/swatches/manifest.json is missing: run npm run thumbs').not.toBeNull();
    const textured = MATERIAL_CATALOG.filter((x) => x.texture || x.photo?.enabled);
    const missing = textured.filter((x) => {
      const fp = m!.ids[x.id];
      return !fp || !m!.files[fp] || !existsSync(path.join(root, 'public/swatches', m!.files[fp].file));
    });
    expect(
      missing.map((x) => x.id),
      'materials without a pre-rendered swatch: run npm run thumbs',
    ).toEqual([]);
  });
});

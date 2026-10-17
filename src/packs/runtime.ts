import type { MaterialDefinition } from '@/domain/model/schema';
import { MaterialCategorySchema } from '@/domain/model/schema';
import { MATERIAL_CATALOG, MATERIAL_CATALOG_BY_ID } from '@/data/materials/catalog';
import { setPackPatterns, type TexturePattern } from '@/data/materials/patterns';
import { setPackPhotoSets, type PhotoManifestEntry } from '@/features/materials/photoTextures';
import { ASSET_CATALOG, ASSET_CATEGORY_ORDER, ASSET_TYPE_ORDER, ASSETS_BY_ID } from '@/data/assets/catalog';
import { defineAsset } from '@/data/assets/parts';
import type { AssetCategory, AssetDefinition, AssetType, Part, Size3 } from '@/data/assets/types';
import type { PackSpec } from './kit';
import { notifyPacksChanged } from './events';

/**
 * Merges content packs (/packs/<pack-id>.pack.ts) into the built-in catalogues. Pack ids are
 * namespaced as `<pack-id>:<local id>` so packs never clash with the built-in library or each
 * other. Called again on every hot update, it replaces everything a previous call added.
 * A broken pack or item is reported (console + pack info) and skipped, never fatal.
 */

export interface LoadedPack {
  id: string;
  name: string;
  version?: string;
  author?: string;
  description?: string;
  license: string;
  items: number;
  materials: number;
  patterns: number;
  textures: number;
  /** Problems found while loading (the rest of the pack still loads). */
  errors: string[];
}

let loaded: LoadedPack[] = [];

/** Packs currently installed (in folder order). */
export const installedPacks = (): LoadedPack[] => loaded;

const FOLDER_ID = /^[a-z0-9][a-z0-9-]*$/;
const LOCAL_ID = /^[a-z0-9][a-z0-9-]*$/;
const CATEGORIES = new Set<string>(ASSET_CATEGORY_ORDER);
const TYPES = new Set<string>(ASSET_TYPE_ORDER);

/** Pack id from a glob key such as '/packs/halloween.pack.ts'. */
export const packFolder = (path: string): string => (path.split('/').pop() ?? path).replace(/\.pack\.ts$/, '');

function removeAll(): void {
  for (let i = ASSET_CATALOG.length - 1; i >= 0; i--) if (ASSET_CATALOG[i].pack) ASSET_CATALOG.splice(i, 1);
  for (const id of Object.keys(ASSETS_BY_ID)) if (id.includes(':')) delete ASSETS_BY_ID[id];
  for (let i = MATERIAL_CATALOG.length - 1; i >= 0; i--) if (MATERIAL_CATALOG[i].id.includes(':')) MATERIAL_CATALOG.splice(i, 1);
  for (const id of Object.keys(MATERIAL_CATALOG_BY_ID)) if (id.includes(':')) delete MATERIAL_CATALOG_BY_ID[id];
}

/** Box standing in for an item whose build() threw, so a broken pack item stays visible and selectable. */
const fallbackParts = ({ w, d, h }: Size3, slot: string): Part[] => [
  { shape: 'box', size: [Math.max(w, 0.01), Math.max(h, 0.01), Math.max(d, 0.01)], position: [0, h / 2, 0], slot },
];

export function applyPacks(modules: Record<string, unknown>): LoadedPack[] {
  removeAll();
  const items: AssetDefinition[] = [];
  const materials: MaterialDefinition[] = [];
  const patterns: TexturePattern[] = [];
  const photoSets: PhotoManifestEntry[] = [];
  const result: LoadedPack[] = [];

  for (const path of Object.keys(modules).sort()) {
    const folder = packFolder(path);
    const spec = (modules[path] as { default?: PackSpec } | undefined)?.default;
    const errors: string[] = [];
    const report = (msg: string) => errors.push(msg);
    if (!FOLDER_ID.test(folder)) {
      console.warn(`[packs] Skipped "${folder}": pack file names must be lowercase letters, digits and dashes (e.g. halloween.pack.ts).`);
      continue;
    }
    if (!spec || typeof spec !== 'object' || !Array.isArray(spec.items)) {
      console.warn(`[packs] Skipped "${folder}": pack.ts must \`export default definePack({ name, items, … })\`.`);
      continue;
    }
    const ns = (local: string) => `${folder}:${local}`;
    const license = spec.license?.trim() || 'Pack licence not specified';
    const sourceName = `${spec.name || folder} pack${spec.author ? ` by ${spec.author}` : ''}`;
    // Embedded textures by name; a material may also give a data:/https: URL directly.
    const files: Record<string, string> = { ...(spec.textures ?? {}) };
    const texture = (ref: string | undefined): string | undefined =>
      ref ? (files[ref] ?? (/^(data:image\/|https?:)/.test(ref) ? ref : undefined)) : undefined;

    // Patterns
    const localPatterns = new Set<string>();
    for (const p of spec.patterns ?? []) {
      if (!LOCAL_ID.test(p.id ?? '') || typeof p.draw !== 'function') {
        report(`Pattern "${p.id}" needs a lowercase id and a draw() function.`);
        continue;
      }
      localPatterns.add(p.id);
      patterns.push({ id: ns(p.id), name: p.name || p.id, normalStrength: p.normalStrength ?? 0.4, colored: p.colored, draw: p.draw });
    }

    // Materials
    const localMats = new Set((spec.materials ?? []).map((m) => m.id));
    const matId = (id: string) => (localMats.has(id) ? ns(id) : id);
    let materialCount = 0;
    for (const m of spec.materials ?? []) {
      if (!LOCAL_ID.test(m.id ?? '')) {
        report(`Material "${m.id}" needs a lowercase id (letters, digits, dashes).`);
        continue;
      }
      const category = MaterialCategorySchema.safeParse(m.category ?? 'solid');
      let photo: MaterialDefinition['photo'] = null;
      if (m.image) {
        const color = texture(m.image.color);
        const normal = texture(m.image.normal);
        const roughness = texture(m.image.roughness);
        if (!color) report(`Material "${m.id}": texture "${m.image.color}" is not in the pack's textures.`);
        else {
          const setId = ns(m.id);
          photoSets.push({
            id: setId,
            name: m.name,
            source: 'pack',
            assetId: m.image.color,
            url: '',
            license,
            size: m.image.scale,
            resolution: 0,
            maps: {
              color,
              ...(normal ? { normal } : {}),
              ...(roughness ? { roughness } : {}),
            },
            // Neutral average → gain 1: the bitmap shows as painted under a white base colour.
            meanLinear: [0.6, 0.6, 0.6],
            meanColor: '#cbcbcb',
            meanRoughness: null,
            bytes: 0,
          });
          photo = { setId, scale: m.image.scale, rotation: m.image.rotation ?? 0, contrast: m.image.contrast ?? 1, enabled: true };
        }
      }
      if (m.pattern && !localPatterns.has(m.pattern.id) && m.pattern.id.includes(':')) report(`Material "${m.id}": unknown pattern "${m.pattern.id}".`);
      materials.push({
        id: ns(m.id),
        name: m.name,
        category: category.success ? category.data : 'solid',
        color: m.color,
        roughness: m.roughness ?? 0.6,
        metalness: m.metalness ?? 0,
        opacity: m.opacity ?? 1,
        emissive: m.emissive ?? null,
        emissiveIntensity: m.emissiveIntensity ?? (m.emissive ? 1.5 : 0),
        texture: m.pattern
          ? {
              patternId: localPatterns.has(m.pattern.id) ? ns(m.pattern.id) : m.pattern.id,
              scale: m.pattern.scale,
              rotation: m.pattern.rotation ?? 0,
              contrast: m.pattern.contrast ?? 1,
            }
          : null,
        photo,
        overrideOf: null,
        catalogId: ns(m.id),
        source: { name: sourceName, license },
      });
      materialCount++;
    }

    // Items
    const info = { id: folder, name: spec.name || folder, ...(spec.version ? { version: spec.version } : {}), ...(spec.author ? { author: spec.author } : {}) };
    const seen = new Set<string>();
    let itemCount = 0;
    for (const item of spec.items) {
      try {
        if (!LOCAL_ID.test(item.id ?? '') || seen.has(item.id)) throw new Error('needs a unique lowercase id (letters, digits, dashes)');
        if (!item.slots?.length) throw new Error('needs at least one material slot');
        seen.add(item.id);
        const category: AssetCategory = CATEGORIES.has(item.category) ? item.category : 'decor';
        const type: AssetType = TYPES.has(item.type) ? item.type : 'misc';
        if (category !== item.category) report(`Item "${item.id}": unknown category "${item.category}", shown under Decor.`);
        const firstSlot = item.slots[0].id;
        let warned = false;
        const def = defineAsset({
          ...item,
          id: ns(item.id),
          category,
          type,
          group: item.group || 'Ornaments',
          slots: item.slots.map((s) => ({ ...s, defaultMaterial: matId(s.defaultMaterial) })),
          build: (size) => {
            try {
              const parts = item.build(size);
              if (!Array.isArray(parts) || parts.length === 0) throw new Error('build() returned no parts');
              return parts;
            } catch (e) {
              if (!warned) console.warn(`[packs] ${folder}:${item.id} build failed:`, e);
              warned = true;
              return fallbackParts(size, firstSlot);
            }
          },
          planDetail: item.planDetail
            ? (size) => {
                try {
                  return item.planDetail!(size);
                } catch {
                  return [];
                }
              }
            : undefined,
        });
        items.push({ ...def, source: { name: sourceName, license }, pack: info });
        itemCount++;
      } catch (e) {
        report(`Item "${item?.id}": ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    for (const msg of errors) console.warn(`[packs] ${folder}: ${msg}`);
    result.push({
      ...info,
      description: spec.description,
      license,
      items: itemCount,
      materials: materialCount,
      patterns: patterns.filter((p) => p.id.startsWith(`${folder}:`)).length,
      textures: Object.keys(files).length,
      errors,
    });
  }

  for (const m of materials) {
    MATERIAL_CATALOG.push(m);
    MATERIAL_CATALOG_BY_ID[m.id] = m;
  }
  for (const a of items) {
    ASSET_CATALOG.push(a);
    ASSETS_BY_ID[a.id] = a;
  }
  setPackPatterns(patterns);
  setPackPhotoSets(photoSets);
  loaded = result;
  notifyPacksChanged();
  return result;
}

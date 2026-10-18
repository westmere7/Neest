import type { AssetDefinition } from '@/data/assets/types';
import { MATERIAL_CATALOG_BY_ID } from '@/data/materials/catalog';
import { patternInfo } from '@/data/materials/patterns';

/**
 * Bump when the thumbnail renderer changes (camera, lights, size, encoding) or when built-in
 * material/pattern code changes in a way that should re-render every thumbnail.
 */
export const THUMB_VERSION = 1;

const cache = new WeakMap<AssetDefinition, string>();

/** 64-bit FNV-1a style hash as 16 hex chars (two 32-bit lanes with different seeds). */
export function fingerprintHash(text: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b ^ c, 0x5bd1e995) ^ (b >>> 15);
  }
  return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
}

const round = (_k: string, v: unknown) => (typeof v === 'number' ? Math.round(v * 1e4) / 1e4 : v);

/**
 * What a thumbnail depends on: the asset's parts at its default size, its default materials and
 * the code of any procedural pattern they use. Equal fingerprints mean an identical picture, so a
 * thumbnail rendered once (in a pre-generated file or in IndexedDB) can be reused until the item
 * itself changes. Null when the asset cannot be built.
 */
export function thumbFingerprint(asset: AssetDefinition): string | null {
  const hit = cache.get(asset);
  if (hit) return hit;
  let parts: unknown;
  try {
    parts = asset.build(asset.defaultSize);
  } catch {
    return null;
  }
  const materials = asset.slots.map((s) => {
    const m = MATERIAL_CATALOG_BY_ID[s.defaultMaterial];
    const pattern = m?.texture ? patternInfo(m.texture.patternId) : undefined;
    return { slot: s.id, id: s.defaultMaterial, m: m ?? null, draw: pattern ? String(pattern.draw) : null };
  });
  const fp = fingerprintHash(JSON.stringify({ v: THUMB_VERSION, size: asset.defaultSize, parts, materials, model: asset.model?.hash ?? null }, round));
  cache.set(asset, fp);
  return fp;
}

/** File-system safe name for an asset id (pack ids contain ':'). */
export const thumbFileName = (id: string): string => `${id.replace(/[^a-z0-9-]+/gi, '_')}.webp`;

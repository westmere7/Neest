/**
 * Pack authoring kit — everything a content pack (one file: /packs/<pack-id>.pack.ts) needs.
 *
 *   import { definePack, defineItem, span, cushion, … } from '@/packs/kit';
 *   export default definePack({ name: 'Halloween', items: [...], materials: [...] });
 *
 * See /packs/README.md for the full guide. The pack id is the file name; ids of items,
 * materials, patterns and textures are local to the pack (items become `<pack>:<id>`).
 */
import type { MaterialCategory } from '@/domain/model/schema';
import type { AssetSpec } from '@/data/assets/parts';

export * from '@/data/assets/parts';
export type { AssetBrand, AssetCategory, AssetType, Part, PlanStroke, Size3, MaterialSlot } from '@/data/assets/types';

/** An item (furniture/object) in a pack: the same fields as a built-in asset. */
export type PackItem = AssetSpec;

/** Identity helper with type checking for pack items. */
export const defineItem = (item: PackItem): PackItem => item;

/** A material a pack adds to the material library. */
export interface PackMaterial {
  /** Local id; slots refer to it by this id (built-in material ids work too). */
  id: string;
  name: string;
  /** Library shelf; defaults to 'solid'. */
  category?: MaterialCategory;
  /** Base colour (multiplies the texture). Use #ffffff to show a bitmap texture as painted. */
  color: string;
  roughness?: number;
  metalness?: number;
  opacity?: number;
  /** Glow colour; required for an item's 'light' slot. */
  emissive?: string;
  emissiveIntensity?: number;
  /** Procedural texture: a built-in pattern id or one of this pack's `patterns`. `scale` = metres per tile. */
  pattern?: { id: string; scale: number; contrast?: number; rotation?: number };
  /** Bitmap texture: names from this pack's `textures` (or data:/https: URLs). `scale` = metres per tile. */
  image?: { color: string; normal?: string; roughness?: string; scale: number; contrast?: number; rotation?: number };
}

/** A procedural texture drawn on a square canvas. Draw near-white luminance unless `colored`. */
export interface PackPattern {
  id: string;
  name: string;
  /** Relief strength for the derived normal map (0–1.5). */
  normalStrength?: number;
  /** true = the tile has its own colours (otherwise it is tinted by the material colour). */
  colored?: boolean;
  /** Must tile seamlessly; use `rand` (deterministic) instead of Math.random. */
  draw(ctx: CanvasRenderingContext2D, size: number, rand: () => number): void;
}

export interface PackSpec {
  /** Display name, e.g. "Halloween". */
  name: string;
  version?: string;
  author?: string;
  description?: string;
  /** Licence for the pack's content (shown in item/material info). */
  license?: string;
  items: PackItem[];
  materials?: PackMaterial[];
  /**
   * Bitmap textures embedded in the pack file, by name → image data URL
   * ("data:image/png;base64,…", also jpeg/webp). Keeps a pack to a single file.
   */
  textures?: Record<string, string>;
  patterns?: PackPattern[];
}

/** Identity helper with type checking; a pack module must `export default definePack({...})`. */
export const definePack = (spec: PackSpec): PackSpec => spec;

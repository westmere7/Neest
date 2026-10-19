import data from './photoSets.json';

/**
 * Curated CC0 photo texture sets (ambientCG, Poly Haven). The list is shared
 * with tools/fetch-textures.mjs, which downloads each set into
 * public/textures/<id>/ and writes public/textures/manifest.json with the
 * measured average colour/roughness the renderer needs. The app works without
 * the files: materials then keep their procedural texture.
 */
export interface PhotoSet {
  id: string;
  name: string;
  source: 'ambientcg' | 'polyhaven';
  /** Asset id in the source library. */
  assetId: string;
  /** Metres covered by one texture tile. */
  size: number;
  /** Pixels per side of the stored maps. */
  resolution: number;
  /** Download resolution when it differs from `resolution` (ambientCG; a `tile` cut needs detail). */
  sourceResolution?: number;
  /** Flattens the normal map (0 = flat, 1 = as scanned), e.g. a small leaf scaled up to a houseplant leaf. */
  normalStrength?: number;
  /** Cut a repeating tile out of a photo that is not one (see cutTile in tools/fetch-textures.mjs). */
  tile?: { rotate?: number; x: number; y: number; w: number; h: number; blendY?: number; rollX?: number };
}

export const PHOTO_SETS: PhotoSet[] = data.sets as PhotoSet[];

export const PHOTO_SETS_BY_ID: Record<string, PhotoSet> = Object.fromEntries(PHOTO_SETS.map((s) => [s.id, s]));

export const PHOTO_SOURCE_NAMES: Record<PhotoSet['source'], string> = { ambientcg: 'ambientCG', polyhaven: 'Poly Haven' };

export function photoSetUrl(set: PhotoSet): string {
  return set.source === 'polyhaven' ? `https://polyhaven.com/a/${set.assetId}` : `https://ambientcg.com/a/${set.assetId}`;
}

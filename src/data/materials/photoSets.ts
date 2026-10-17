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
}

export const PHOTO_SETS: PhotoSet[] = data.sets as PhotoSet[];

export const PHOTO_SETS_BY_ID: Record<string, PhotoSet> = Object.fromEntries(PHOTO_SETS.map((s) => [s.id, s]));

export const PHOTO_SOURCE_NAMES: Record<PhotoSet['source'], string> = { ambientcg: 'ambientCG', polyhaven: 'Poly Haven' };

export function photoSetUrl(set: PhotoSet): string {
  return set.source === 'polyhaven' ? `https://polyhaven.com/a/${set.assetId}` : `https://ambientcg.com/a/${set.assetId}`;
}

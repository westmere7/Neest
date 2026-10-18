import type { MaterialDefinition } from '@/domain/model/schema';
import { patternInfo } from '@/data/materials/patterns';
import { fingerprintHash } from '@/features/library/thumbFingerprint';
import { getPhotoManifest, loadPhotoManifest, notifyPhotos, photoEntry, photoSwatchUrl, preloadPhotoSets, wantsPhoto } from './photoTextures';

/**
 * Pre-rendered material swatches (`npm run thumbs` writes them to public/swatches/).
 *
 * A swatch is keyed by a fingerprint of what it shows (colour, pattern code and contrast, or the
 * photo set, crop and tint), not by material id, so a project's copy of a catalogue material,
 * or any material that looks the same, reuses the shipped file. When the manifest is missing or
 * a fingerprint has no file, `swatchBackground` draws the swatch at runtime as before.
 */
export const SWATCH_VERSION = 1;
/** Pixel size of a swatch tile (the runtime renderer uses the same). */
export const SWATCH_SIZE = 96;

export type SwatchMaterial = Pick<MaterialDefinition, 'texture' | 'color'> & Partial<Pick<MaterialDefinition, 'photo'>>;

interface SwatchManifest {
  version: number;
  /** fingerprint → file; `tile` = a pattern tile shown repeated (else a photo crop shown as cover). */
  files: Record<string, { file: string; tile: boolean }>;
  /** Catalogue material id → fingerprint at generation time (the coverage index). */
  ids: Record<string, string>;
}

let manifest: SwatchManifest | null | undefined;
let manifestPromise: Promise<SwatchManifest | null> | null = null;

const canLoad = (): boolean => typeof window !== 'undefined' && typeof fetch === 'function' && import.meta.env?.MODE !== 'test';

function loadSwatchManifest(): Promise<SwatchManifest | null> {
  if (manifestPromise) return manifestPromise;
  if (!canLoad()) {
    manifest = null;
    return (manifestPromise = Promise.resolve(null));
  }
  manifestPromise = fetch(`${import.meta.env.BASE_URL}swatches/manifest.json`)
    .then(async (r) => (r.ok ? ((await r.json()) as SwatchManifest) : null))
    .catch(() => null)
    .then((m) => {
      manifest = m && m.version === SWATCH_VERSION && m.files ? m : null;
      // Swatch components re-render on photo notifications.
      notifyPhotos();
      return manifest;
    });
  return manifestPromise;
}

const drawHash = new Map<string, string>();
/** Hash of a pattern's drawing code, so editing a pattern re-renders its swatches. */
function patternHash(id: string): string {
  let h = drawHash.get(id);
  if (h === undefined) {
    const p = patternInfo(id);
    h = p ? fingerprintHash(String(p.draw)) : 'none';
    drawHash.set(id, h);
  }
  return h;
}

const fpCache = new Map<string, string | null>();

/**
 * Fingerprint of the swatch a material shows when everything has loaded, or null when it has no
 * texture (flat colour, metal and glass swatches are plain CSS) or its photo set is not known yet.
 */
export function swatchFingerprint(m: SwatchMaterial): string | null {
  const photo = wantsPhoto({ photo: m.photo ?? null });
  let key: string;
  if (photo) {
    const entry = photoEntry(photo.setId);
    if (!entry) return null;
    key = JSON.stringify(['photo', SWATCH_VERSION, m.color, photo.setId, photo.scale, photo.contrast, entry.meanLinear, entry.bytes, entry.maps.swatch ?? entry.maps.color]);
  } else if (m.texture) {
    key = JSON.stringify(['tile', SWATCH_VERSION, m.color, m.texture.patternId, m.texture.contrast, patternHash(m.texture.patternId)]);
  } else return null;
  let fp = fpCache.get(key);
  if (fp === undefined) {
    fp = fingerprintHash(key);
    if (fpCache.size > 2000) fpCache.clear();
    fpCache.set(key, fp);
  }
  return fp;
}

/** The shipped swatch for this material, when the manifest has its exact fingerprint. */
export function shippedSwatch(m: SwatchMaterial): { url: string; tile: boolean } | null {
  if (manifest === undefined) void loadSwatchManifest();
  if (!manifest) return null;
  // Photo fingerprints need the texture manifest; ask for it so they resolve once it arrives.
  if (m.photo?.enabled && getPhotoManifest() === undefined) return null;
  const fp = swatchFingerprint(m);
  const entry = fp ? manifest.files[fp] : undefined;
  return entry ? { url: `${import.meta.env.BASE_URL}swatches/${entry.file}`, tile: entry.tile } : null;
}

/**
 * Renders swatches for the generator script (in the browser): one WebP data URL per distinct
 * fingerprint, plus the id → fingerprint index. Waits for every photo set's swatch image.
 */
export async function renderSwatchesForExport(
  materials: (SwatchMaterial & { id: string })[],
  tint: (m: SwatchMaterial, size: number) => string | null,
): Promise<{ ids: Record<string, string>; files: { fp: string; tile: boolean; dataUrl: string }[] }> {
  await loadPhotoManifest();
  const sets = materials.map((m) => wantsPhoto({ photo: m.photo ?? null })?.setId).filter((s): s is string => Boolean(s));
  await preloadPhotoSets(new Set(sets), ['swatch'], 20_000);
  // Pack bitmap sets (paintings, halloween…) have no swatch map: their swatch is cut from the colour map.
  const colourOnly = sets.filter((s) => !photoEntry(s)?.maps.swatch);
  if (colourOnly.length) await preloadPhotoSets(new Set(colourOnly), ['color'], 20_000);
  const ids: Record<string, string> = {};
  const files = new Map<string, { fp: string; tile: boolean; dataUrl: string }>();
  for (const m of materials) {
    const fp = swatchFingerprint(m);
    if (!fp) continue;
    ids[m.id] = fp;
    if (files.has(fp)) continue;
    const photo = wantsPhoto({ photo: m.photo ?? null });
    const src = photo ? photoSwatchUrl({ photo, color: m.color }, SWATCH_SIZE) : tint(m, SWATCH_SIZE);
    if (!src) {
      delete ids[m.id];
      continue;
    }
    files.set(fp, { fp, tile: !photo, dataUrl: await reencode(src) });
  }
  return { ids, files: [...files.values()] };
}

async function reencode(src: string): Promise<string> {
  const img = new Image();
  img.src = src;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  c.getContext('2d')!.drawImage(img, 0, 0);
  return c.toDataURL('image/webp', 0.9);
}

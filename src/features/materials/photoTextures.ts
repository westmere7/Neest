import type { MaterialDefinition, PhotoTextureRef } from '@/domain/model/schema';

/**
 * Runtime side of the CC0 photo textures (files in public/textures/, fetched by
 * `npm run textures`). The manifest is loaded once; when it or a set's images
 * are missing (static host without the files, tests, offline before first
 * use) callers fall back to the procedural texture.
 *
 * Colour model: photo maps keep their own pixels, and the renderer multiplies
 * them by `materialColour × gain`, where `gain = TARGET / photoMean` per channel
 * (linear). The rendered average therefore matches a procedural tile's
 * (≈ 0.8 × base colour in sRGB), so the base colour keeps tinting the material
 * and several materials can share one photo set.
 */

/** `swatch` is a 256 px copy of the colour map for pickers. */
export type PhotoMap = 'color' | 'normal' | 'roughness' | 'swatch';

export interface PhotoManifestEntry {
  id: string;
  name: string;
  source: string;
  assetId: string;
  url: string;
  license: string;
  size: number;
  resolution: number;
  maps: Partial<Record<PhotoMap, string>>;
  /** Average linear RGB of the colour map. */
  meanLinear: [number, number, number];
  /** Average colour of the colour map (sRGB hex). */
  meanColor: string;
  /** Average roughness-map value (green channel), or null without a map. */
  meanRoughness: number | null;
  bytes: number;
}

export interface PhotoManifest {
  version: number;
  sets: Record<string, PhotoManifestEntry>;
}

/** Linear value a procedural near-white tile averages (sRGB ≈ 0.8). */
export const PHOTO_TARGET_LINEAR = 0.6;
const MAX_GAIN = 24;

const baseUrl = (): string => {
  const b = (import.meta.env?.BASE_URL as string | undefined) ?? '/';
  return b.endsWith('/') ? b : `${b}/`;
};
/** URL of one map file. Content-pack sets store ready-made URLs (bundled pack textures). */
export const photoFileUrl = (setId: string, file: string): string =>
  /^(\/|[a-z]+:)/i.test(file) ? file : `${baseUrl()}textures/${setId}/${file}`;

// ───────────── Content-pack sets ─────────────

/** Bitmap textures from content packs (`<pack>:<material>` ids), merged with the manifest. */
const packSets = new Map<string, PhotoManifestEntry>();

/** Replaces the content-pack photo sets and forgets their loaded images (packs reload live). */
export function setPackPhotoSets(entries: PhotoManifestEntry[]): void {
  packSets.clear();
  for (const e of entries) packSets.set(e.id, e);
  for (const k of [...images.keys()]) if (k.includes(':')) images.delete(k);
  for (const k of [...swatchCache.keys()]) if (k.includes(':')) swatchCache.delete(k);
  for (const id of [...failedSets]) if (id.includes(':')) failedSets.delete(id);
  notify();
}

/** Manifest or pack entry for a set id. */
function setEntry(m: PhotoManifest | null | undefined, setId: string): PhotoManifestEntry | undefined {
  return packSets.get(setId) ?? m?.sets[setId];
}

// ───────────── Manifest ─────────────

let manifest: PhotoManifest | null | undefined;
let manifestPromise: Promise<PhotoManifest | null> | null = null;
let version = 0;
const listeners = new Set<() => void>();

function notify() {
  version++;
  for (const fn of [...listeners]) fn();
}

/** Subscribe to photo-texture availability changes (manifest/images loaded or failed). */
export function subscribePhotos(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export const photoVersion = (): number => version;

const canLoad = (): boolean =>
  typeof window !== 'undefined' && typeof fetch === 'function' && typeof Image !== 'undefined' && import.meta.env?.MODE !== 'test';

/** Loads the manifest once. Resolves null when photo textures are unavailable. */
export function loadPhotoManifest(): Promise<PhotoManifest | null> {
  if (manifestPromise) return manifestPromise;
  if (!canLoad()) {
    manifest = null;
    manifestPromise = Promise.resolve(null);
    return manifestPromise;
  }
  manifestPromise = fetch(`${baseUrl()}textures/manifest.json`, { cache: 'no-cache' })
    .then(async (r) => {
      if (!r.ok) return null;
      const json = (await r.json()) as PhotoManifest;
      return json && typeof json === 'object' && json.sets ? json : null;
    })
    .catch(() => null)
    .then((m) => {
      manifest = m;
      notify();
      return m;
    });
  return manifestPromise;
}

/** The manifest if loaded: `undefined` = still loading (and starts loading), `null` = unavailable. */
export function getPhotoManifest(): PhotoManifest | null | undefined {
  if (manifest === undefined) void loadPhotoManifest();
  return manifest;
}

export function photoEntry(setId: string | null | undefined): PhotoManifestEntry | null {
  if (!setId) return null;
  return packSets.get(setId) ?? getPhotoManifest()?.sets[setId] ?? null;
}

/** The material's photo reference when it is switched on (files may still be missing). */
export function wantsPhoto(m: Pick<MaterialDefinition, 'photo'>): PhotoTextureRef | null {
  return m.photo && m.photo.enabled ? m.photo : null;
}

// ───────────── Images ─────────────

type ImageState = { status: 'loading'; promise: Promise<HTMLImageElement | null> } | { status: 'ready'; image: HTMLImageElement } | { status: 'failed' };
const images = new Map<string, ImageState>();
const failedSets = new Set<string>();

export const photoSetFailed = (setId: string): boolean => failedSets.has(setId);

/** Loaded image of one map of a set, or null (still loading → `pending` is true). */
export function photoImage(setId: string, map: PhotoMap): { image: HTMLImageElement | null; pending: boolean } {
  const key = `${setId}/${map}`;
  const st = images.get(key);
  if (st?.status === 'ready') return { image: st.image, pending: false };
  if (st?.status === 'failed') return { image: null, pending: false };
  if (st?.status === 'loading') return { image: null, pending: true };
  const pack = packSets.get(setId);
  const m = pack ? null : getPhotoManifest();
  if (!pack && m === undefined) return { image: null, pending: true };
  const file = (pack ?? m?.sets[setId])?.maps[map];
  if (!file || !canLoad()) {
    images.set(key, { status: 'failed' });
    return { image: null, pending: false };
  }
  void loadPhotoImage(setId, map);
  return { image: null, pending: true };
}

/** Loads one map image (cached). Resolves null on failure. */
export function loadPhotoImage(setId: string, map: PhotoMap): Promise<HTMLImageElement | null> {
  const key = `${setId}/${map}`;
  const st = images.get(key);
  if (st?.status === 'ready') return Promise.resolve(st.image);
  if (st?.status === 'failed') return Promise.resolve(null);
  if (st?.status === 'loading') return st.promise;
  const promise = loadPhotoManifest().then(async (m) => {
    const file = setEntry(m, setId)?.maps[map];
    if (!file || !canLoad()) {
      images.set(key, { status: 'failed' });
      return null;
    }
    try {
      const img = new Image();
      img.decoding = 'async';
      img.crossOrigin = 'anonymous';
      img.src = photoFileUrl(setId, file);
      await img.decode();
      images.set(key, { status: 'ready', image: img });
      return img;
    } catch {
      images.set(key, { status: 'failed' });
      if (map === 'color') failedSets.add(setId);
      return null;
    } finally {
      notify();
    }
  });
  images.set(key, { status: 'loading', promise });
  return promise;
}

/** Waits until the given sets' maps have loaded or failed (with a timeout). */
export async function preloadPhotoSets(setIds: Iterable<string>, maps: PhotoMap[] = ['color', 'normal', 'roughness'], timeoutMs = 8000): Promise<void> {
  const m = await loadPhotoManifest();
  if (!m && !packSets.size) return;
  const jobs: Promise<unknown>[] = [];
  for (const id of new Set(setIds)) for (const map of maps) if (setEntry(m, id)?.maps[map]) jobs.push(loadPhotoImage(id, map));
  if (!jobs.length) return;
  await Promise.race([Promise.all(jobs), new Promise((r) => setTimeout(r, timeoutMs))]);
}

// ───────────── Colour maths & baking ─────────────

const srgbToLinear = (v: number): number => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const linearToSrgb = (v: number): number => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);
let toLinear: Float32Array | null = null;
let toSrgb: Uint8ClampedArray | null = null;
function luts() {
  if (!toLinear || !toSrgb) {
    toLinear = new Float32Array(256);
    for (let i = 0; i < 256; i++) toLinear[i] = srgbToLinear(i / 255);
    toSrgb = new Uint8ClampedArray(4096);
    for (let i = 0; i < 4096; i++) toSrgb[i] = Math.round(linearToSrgb(i / 4095) * 255);
  }
  return { toLinear, toSrgb };
}

export const hexToLinear = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [srgbToLinear(((n >> 16) & 255) / 255), srgbToLinear(((n >> 8) & 255) / 255), srgbToLinear((n & 255) / 255)];
};

/** Per-channel (linear) factor that brings the photo's average to a procedural tile's average. */
export function photoGain(entry: Pick<PhotoManifestEntry, 'meanLinear'>): [number, number, number] {
  return entry.meanLinear.map((m) => Math.min(MAX_GAIN, PHOTO_TARGET_LINEAR / Math.max(m, 1e-4))) as [number, number, number];
}

/**
 * Draws a colour map into a canvas of `size` px: pixels are blended toward the
 * photo's average by (1 − contrast) and, when `tint` is given (linear RGB),
 * multiplied by `tint × gain` — i.e. what the renderer shows. Without a tint
 * only the contrast blend is applied (the gain then stays in the material colour).
 */
export function bakePhotoCanvas(
  image: CanvasImageSource & { width: number; height: number },
  entry: Pick<PhotoManifestEntry, 'meanLinear'>,
  size: number,
  contrast: number,
  tint: [number, number, number] | null,
): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, size, size);
  const k = Math.min(1, Math.max(0, contrast));
  if (k >= 0.995 && !tint) return c;
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  const { toLinear: L, toSrgb: S } = luts();
  const mean = entry.meanLinear;
  const gain = photoGain(entry);
  const f = tint ? [tint[0] * gain[0], tint[1] * gain[1], tint[2] * gain[2]] : [1, 1, 1];
  for (let i = 0; i < d.length; i += 4) {
    for (let ch = 0; ch < 3; ch++) {
      const v = (mean[ch] + (L[d[i + ch]] - mean[ch]) * k) * f[ch];
      d[i + ch] = S[Math.max(0, Math.min(4095, Math.round(v * 4095)))];
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// ───────────── Swatches ─────────────

const swatchCache = new Map<string, string | null>();

/**
 * Data URL of a material's photo colour map tinted like the renderer shows it,
 * or null when the material has no active photo or it is not loaded yet
 * (loading starts; subscribe with `subscribePhotos` to re-render).
 */
export function photoSwatchUrl(m: Pick<MaterialDefinition, 'photo' | 'color'>, size = 96): string | null {
  const ref = wantsPhoto(m);
  if (!ref) return null;
  const entry = photoEntry(ref.setId);
  if (!entry) return null;
  const key = `${ref.setId}|${m.color}|${ref.contrast.toFixed(2)}|${size}`;
  const hit = swatchCache.get(key);
  if (hit !== undefined) return hit;
  const { image } = photoImage(ref.setId, entry.maps.swatch ? 'swatch' : 'color');
  if (!image) return null;
  let url: string | null = null;
  try {
    // Show roughly a 60 cm square, or the whole tile when it is smaller.
    const src = cropForSwatch(image, ref.scale);
    const canvas = bakePhotoCanvas(src, entry, size, ref.contrast, hexToLinear(m.color));
    url = canvas ? canvas.toDataURL('image/jpeg', 0.85) : null;
  } catch {
    url = null;
  }
  if (swatchCache.size > 400) swatchCache.clear();
  swatchCache.set(key, url);
  return url;
}

function cropForSwatch(image: HTMLImageElement, scale: number): HTMLCanvasElement | HTMLImageElement {
  const frac = Math.min(1, 0.6 / Math.max(scale, 0.01));
  if (frac >= 0.98 || typeof document === 'undefined') return image;
  const px = Math.max(16, Math.round(image.width * frac));
  const c = document.createElement('canvas');
  c.width = px;
  c.height = px;
  c.getContext('2d')?.drawImage(image, 0, 0, px, px, 0, 0, px, px);
  return c;
}

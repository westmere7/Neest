import { useEffect, useRef, useState, type RefObject } from 'react';
import type { AssetDefinition } from '@/data/assets/types';
import { dropPackKeys, subscribePacks } from '@/packs/events';
import { getDb } from '@/storage/indexeddb/db';
import { thumbFileName, thumbFingerprint } from './thumbFingerprint';

/**
 * Library thumbnails, rendered once and reused.
 *
 * A card asks for its thumbnail only when it scrolls into view. The URL comes from, in order:
 *  1. this session's memory cache;
 *  2. a pre-generated file in `public/thumbs/` (`npm run thumbs`), when the manifest's
 *     fingerprint matches the asset's current definition;
 *  3. IndexedDB (`thumbs` table), from an earlier render in this browser;
 *  4. a fresh render in one offscreen WebGL renderer (loaded on demand), one at a time and
 *     yielding between items, then stored in IndexedDB for next time.
 * When WebGL is unavailable the card keeps its 2D plan symbol, so there are never broken
 * thumbnails. Fingerprints change when an item's parts, materials or pattern code change, so a
 * pack edited live re-renders only the items that actually changed.
 */
const cache = new Map<string, string | null>();
// Content packs reload live: forget their URLs (fingerprints decide what really re-renders).
subscribePacks(() => dropPackKeys(cache));
const listeners = new Map<string, Set<() => void>>();
const queue: AssetDefinition[] = [];
let running = false;
let disabled = false;

interface Manifest {
  version: number;
  items: Record<string, { file: string; fp: string }>;
}
let manifest: Promise<Manifest | null> | null = null;
function loadManifest(): Promise<Manifest | null> {
  manifest ??= fetch(`${import.meta.env.BASE_URL}thumbs/manifest.json`)
    .then((r) => (r.ok ? (r.json() as Promise<Manifest>) : null))
    .catch(() => null);
  return manifest;
}

function publish(id: string, url: string | null) {
  cache.set(id, url);
  listeners.get(id)?.forEach((fn) => fn());
}

/** Shipped file or stored render for this exact fingerprint, else null. */
async function lookup(asset: AssetDefinition, fp: string): Promise<string | null> {
  const m = await loadManifest();
  const entry = m?.items[asset.id];
  if (entry && entry.fp === fp) return `${import.meta.env.BASE_URL}thumbs/${entry.file}`;
  try {
    const rec = await getDb().thumbs.get(asset.id);
    if (rec && rec.fp === fp) return URL.createObjectURL(rec.image);
  } catch {
    // IndexedDB unavailable (private mode, tests): render instead.
  }
  return null;
}

async function store(asset: AssetDefinition, fp: string, dataUrl: string) {
  try {
    const image = await (await fetch(dataUrl)).blob();
    await getDb().thumbs.put({ id: asset.id, fp, image, createdAt: Date.now() });
  } catch {
    // Not fatal: the thumbnail is just rendered again next session.
  }
}

async function pump() {
  if (running) return;
  running = true;
  try {
    const { renderAssetThumbnail } = await import('@/features/scene-3d/thumbnailRenderer');
    while (queue.length) {
      const asset = queue.shift()!;
      // Skip items whose cards went away before their turn.
      if (cache.has(asset.id) || !listeners.get(asset.id)?.size) continue;
      const fp = thumbFingerprint(asset);
      let url: string | null = null;
      try {
        url = renderAssetThumbnail(asset);
      } catch {
        url = null;
      }
      if (url === null && !cache.size) disabled = true;
      publish(asset.id, url);
      if (url && fp) void store(asset, fp, url);
      // Yield to keep the UI responsive.
      await new Promise((r) => setTimeout(r, 0));
      if (disabled) break;
    }
  } catch {
    disabled = true;
  } finally {
    running = false;
  }
}

async function request(asset: AssetDefinition) {
  const fp = thumbFingerprint(asset);
  if (fp) {
    const url = await lookup(asset, fp);
    if (url) return publish(asset.id, url);
  }
  if (cache.has(asset.id) || disabled) return;
  if (!queue.some((a) => a.id === asset.id)) queue.push(asset);
  void pump();
}

/**
 * Thumbnail URL for a library card, or null while unavailable (show the plan symbol). Attach the
 * returned ref to the card so the thumbnail is only fetched or rendered once it is on screen.
 */
export function useAssetThumbnail<T extends Element>(asset: AssetDefinition): [RefObject<T | null>, string | null] {
  const ref = useRef<T | null>(null);
  const [url, setUrl] = useState<string | null>(() => cache.get(asset.id) ?? null);
  useEffect(() => {
    if (asset.category === 'custom' || disabled || typeof document === 'undefined' || import.meta.env.MODE === 'test') return;
    if (cache.has(asset.id)) {
      setUrl(cache.get(asset.id) ?? null);
      return;
    }
    const fn = () => setUrl(cache.get(asset.id) ?? null);
    if (!listeners.has(asset.id)) listeners.set(asset.id, new Set());
    listeners.get(asset.id)!.add(fn);
    const el = ref.current;
    let io: IntersectionObserver | null = null;
    if (el && typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(
        (entries) => {
          if (!entries.some((e) => e.isIntersecting)) return;
          io?.disconnect();
          void request(asset);
        },
        { rootMargin: '200px' },
      );
      io.observe(el);
    } else void request(asset);
    return () => {
      io?.disconnect();
      listeners.get(asset.id)?.delete(fn);
    };
  }, [asset]);
  return [ref, url];
}

/**
 * For `npm run thumbs` (tools/generate-thumbs.mjs): renders the given assets in this page and
 * returns their fingerprints and images. Not used by the app itself.
 */
export async function renderThumbsForExport(assets: AssetDefinition[]): Promise<{ id: string; file: string; fp: string; dataUrl: string }[]> {
  const { renderAssetThumbnail } = await import('@/features/scene-3d/thumbnailRenderer');
  const out: { id: string; file: string; fp: string; dataUrl: string }[] = [];
  for (const a of assets) {
    const fp = thumbFingerprint(a);
    const dataUrl = fp ? renderAssetThumbnail(a) : null;
    if (fp && dataUrl) out.push({ id: a.id, file: thumbFileName(a.id), fp, dataUrl });
  }
  return out;
}

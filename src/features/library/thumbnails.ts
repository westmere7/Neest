import { useEffect, useState } from 'react';
import type { AssetDefinition } from '@/data/assets/types';
import { dropPackKeys, subscribePacks } from '@/packs/events';

/**
 * Lazily rendered 3D thumbnails for library items. Rendering happens in a
 * single offscreen WebGL renderer (loaded on demand) and results are cached
 * as data URLs for the session. When WebGL is unavailable the library falls
 * back to the 2D plan symbol, so there are never broken thumbnails.
 */
const cache = new Map<string, string | null>();
// Content packs reload live: re-render their thumbnails.
subscribePacks(() => dropPackKeys(cache));
const listeners = new Map<string, Set<() => void>>();
const queue: AssetDefinition[] = [];
let running = false;
let disabled = false;

async function pump() {
  if (running) return;
  running = true;
  try {
    const { renderAssetThumbnail } = await import('@/features/scene-3d/thumbnailRenderer');
    while (queue.length) {
      const asset = queue.shift()!;
      if (cache.has(asset.id)) continue;
      let url: string | null = null;
      try {
        url = renderAssetThumbnail(asset);
      } catch {
        url = null;
      }
      if (url === null && !cache.size) disabled = true;
      cache.set(asset.id, url);
      listeners.get(asset.id)?.forEach((fn) => fn());
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

export function useAssetThumbnail(asset: AssetDefinition): string | null {
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
    if (!queue.some((a) => a.id === asset.id)) queue.push(asset);
    void pump();
    return () => {
      listeners.get(asset.id)?.delete(fn);
    };
  }, [asset]);
  return url;
}

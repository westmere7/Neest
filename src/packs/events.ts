import { useSyncExternalStore } from 'react';

/**
 * Change notifications for content packs (no other imports, so any module can
 * subscribe without creating import cycles). Caches keyed by pack ids — which
 * always contain a ':' (`<pack>:<id>`) — drop those entries when notified.
 */
let version = 0;
const listeners = new Set<() => void>();

export const packVersion = (): number => version;

export function subscribePacks(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function notifyPacksChanged(): void {
  version++;
  for (const fn of [...listeners]) fn();
}

/** True for ids that belong to a content pack (`<pack>:<id>`). */
export const isPackId = (id: string): boolean => id.includes(':');

/** Deletes every cache entry whose key mentions a pack id. */
export function dropPackKeys<V>(cache: Map<string, V>, onDrop?: (value: V) => void): void {
  for (const [k, v] of cache) {
    if (!k.includes(':')) continue;
    onDrop?.(v);
    cache.delete(k);
  }
}

/** Re-renders the calling component whenever packs are added, edited or removed. */
export function usePackVersion(): number {
  return useSyncExternalStore(subscribePacks, packVersion, packVersion);
}

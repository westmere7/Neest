import type { MaterialDefinition } from '@/domain/model/schema';
import { renderPattern } from '@/data/materials/patterns';
import { photoSwatchUrl } from './photoTextures';

const urlCache = new Map<string, string | null>();

/**
 * PNG data URL of a material's texture tile multiplied by its base colour —
 * used for 2D floor patterns, swatches and SVG/PNG exports. Returns null for
 * untextured materials or when canvas rendering is unavailable.
 */
export function tintedPatternUrl(m: Pick<MaterialDefinition, 'texture' | 'color'>, size = 128): string | null {
  if (!m.texture) return null;
  const key = `${m.texture.patternId}|${m.color}|${m.texture.contrast}|${size}`;
  if (urlCache.has(key)) return urlCache.get(key)!;
  let url: string | null = null;
  try {
    const src = renderPattern(m.texture.patternId, size, m.texture.contrast);
    if (src && typeof document !== 'undefined') {
      const c = document.createElement('canvas');
      c.width = size;
      c.height = size;
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.drawImage(src, 0, 0, size, size);
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = m.color;
        ctx.fillRect(0, 0, size, size);
        url = c.toDataURL('image/png');
      }
    }
  } catch {
    url = null;
  }
  if (urlCache.size > 300) urlCache.clear();
  urlCache.set(key, url);
  return url;
}

/**
 * CSS background for a material swatch: the tinted photo texture when it is on
 * and loaded, else the procedural texture, else a flat colour. Components that
 * show swatches should re-render on `subscribePhotos` (photos load async).
 */
export function swatchBackground(m: Pick<MaterialDefinition, 'texture' | 'color' | 'opacity' | 'metalness'> & Partial<Pick<MaterialDefinition, 'photo'>>): string {
  const base = m.color;
  const photo = m.photo ? photoSwatchUrl({ photo: m.photo, color: m.color }) : null;
  if (photo) return `url(${photo}) center / cover, ${base}`;
  const url = tintedPatternUrl(m, 96);
  if (url) return `url(${url}) center / 64px 64px, ${base}`;
  if (m.metalness > 0.6) return `linear-gradient(135deg, ${base} 0%, #ffffff55 45%, ${base} 60%, #00000033 100%), ${base}`;
  if (m.opacity < 0.9)
    return `linear-gradient(135deg, ${base}aa 0%, #ffffff88 50%, ${base}aa 100%), repeating-conic-gradient(#ccc 0 25%, #fff 0 50%) 0 0 / 10px 10px`;
  return base;
}

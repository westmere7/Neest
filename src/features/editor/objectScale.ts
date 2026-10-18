import type { PlacedObject } from '@/domain/model/schema';
import type { AssetDefinition } from '@/data/assets/types';

type Dims = { w: number; d: number; h: number };

/** An item's size as a percentage of its default size (by its first resizable side). */
export function scalePct(o: Pick<PlacedObject, 'width' | 'depth' | 'height'>, asset: AssetDefinition): number {
  const s = asset.defaultSize;
  if (asset.resizable.w) return (o.width / s.w) * 100;
  if (asset.resizable.d) return (o.depth / s.d) * 100;
  return (o.height / s.h) * 100;
}

/** Whether an item can be scaled at all. */
export const canScale = (asset: AssetDefinition): boolean => asset.resizable.w || asset.resizable.d || asset.resizable.h;

/**
 * The item scaled by `k` keeping its proportions (only its resizable sides), with `k` limited so no
 * side leaves its min–max range (the asset's limits unless given).
 */
export function scaledSize(
  o: Pick<PlacedObject, 'width' | 'depth' | 'height'>,
  asset: AssetDefinition,
  k: number,
  min: Dims = asset.minSize ?? { w: 0.02, d: 0.02, h: 0.02 },
  max: Dims = asset.maxSize ?? { w: 30, d: 30, h: 12 },
): Partial<Pick<PlacedObject, 'width' | 'depth' | 'height'>> {
  const axes = [
    ['w', 'width', o.width],
    ['d', 'depth', o.depth],
    ['h', 'height', o.height],
  ] as const;
  const live = axes.filter(([a]) => asset.resizable[a]);
  let lo = 0;
  let hi = Infinity;
  for (const [a, , v] of live) {
    lo = Math.max(lo, min[a] / v);
    hi = Math.min(hi, max[a] / v);
  }
  const f = Math.min(hi, Math.max(lo, k));
  const round = (v: number) => Math.round(v * 10000) / 10000;
  return Object.fromEntries(live.map(([, key, v]) => [key, round(v * f)]));
}

import type { AssetPrice } from './types';

/** VND with Vietnamese thousands separators: 12990000 → "12.990.000 ₫"; estimates get "≈ " in front. */
export function formatVnd(price: AssetPrice): string {
  const digits = String(Math.round(price.vnd)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${price.estimate ? '≈ ' : ''}${digits} ₫`;
}

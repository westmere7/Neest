/**
 * Walkthrough speed set with the mouse wheel: each notch scales the walking (or flying) speed by √2,
 * scrolling up goes faster. Shared by the editor walkthrough and the guest viewer.
 */

/** Base speeds in metres per second (before Shift/run). */
export const WALK_SPEED = 1.5;
export const FLY_SPEED = 2.5;

/** Speed multiplier range: ¼× to 4× when walking, ¼× to 8× when flying. */
export const SPEED_MIN = 0.25;
export const WALK_SPEED_MAX = 4;
export const FLY_SPEED_MAX = 8;

/** One wheel notch toward faster (`notches` > 0) or slower, snapped to the √2 ladder and clamped. */
export function stepSpeed(scale: number, notches: number, max: number): number {
  const step = Math.round(Math.log2(Math.max(scale, 1e-6)) * 2) + Math.round(notches);
  const lo = Math.round(Math.log2(SPEED_MIN) * 2);
  const hi = Math.round(Math.log2(max) * 2);
  return 2 ** (Math.min(hi, Math.max(lo, step)) / 2);
}

/** Short label for a multiplier, e.g. "1.4×", "0.5×", "2×". */
export function formatSpeed(scale: number): string {
  const v = scale >= 1 ? Math.round(scale * 10) / 10 : Math.round(scale * 100) / 100;
  return `${v}×`;
}

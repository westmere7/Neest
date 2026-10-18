import type { Vec2 } from '../model/schema';
import { round } from './vec';

/**
 * Shift-drag axis lock: a move keeps to one plan axis from where the drag started.
 * The lock follows the axis the pointer has moved furthest along, and only switches once
 * the other axis clearly leads (`AXIS_SWITCH_RATIO`), so a wobble near 45° does not flicker.
 */
export type LockAxis = 'x' | 'y';

/** The other axis must lead by this factor (≈ 51° from the locked axis) before the lock switches. */
export const AXIS_SWITCH_RATIO = 1.25;

/** Within this distance of the line a snapped point still counts as on it (metres). */
export const ON_AXIS_TOL = 0.01;

export function chooseLockAxis(delta: Vec2, current: LockAxis | null, ratio = AXIS_SWITCH_RATIO): LockAxis {
  const ax = Math.abs(delta.x);
  const ay = Math.abs(delta.y);
  if (current === 'x') return ay > ax * ratio ? 'y' : 'x';
  if (current === 'y') return ax > ay * ratio ? 'x' : 'y';
  return ay > ax ? 'y' : 'x';
}

/** The part of `delta` along `axis`. */
export function lockDelta(delta: Vec2, axis: LockAxis): Vec2 {
  return axis === 'x' ? { x: delta.x, y: 0 } : { x: 0, y: delta.y };
}

/** Grid-snap a moved point along the locked axis only; the locked coordinate stays at `base`'s. */
export function snapOnAxis(target: Vec2, base: Vec2, axis: LockAxis | null, step: number): Vec2 {
  if (!axis) return { x: round(target.x, step), y: round(target.y, step) };
  return axis === 'x' ? { x: round(target.x, step), y: base.y } : { x: base.x, y: round(target.y, step) };
}

/** True when `p` lies on the line through `base` along `axis` (null = no lock, always true). */
export function onAxis(p: Vec2, base: Vec2, axis: LockAxis | null, tol = ON_AXIS_TOL): boolean {
  if (!axis) return true;
  return Math.abs(axis === 'x' ? p.y - base.y : p.x - base.x) <= tol;
}

/** A guide segment through `origin` along `axis`, `half` long each way. */
export function axisGuide(origin: Vec2, axis: LockAxis, half: number): { a: Vec2; b: Vec2 } {
  return axis === 'x'
    ? { a: { x: origin.x - half, y: origin.y }, b: { x: origin.x + half, y: origin.y } }
    : { a: { x: origin.x, y: origin.y - half }, b: { x: origin.x, y: origin.y + half } };
}

/** Status-bar text. The plan's y axis is the 3D view's z axis. */
export function axisLockLabel(axis: LockAxis, view: '2d' | '3d' = '2d'): string {
  return `Locked to ${axis === 'x' ? 'X' : view === '3d' ? 'Z' : 'Y'} axis`;
}

/**
 * Per-gesture lock state. `apply(delta, on)` returns the constrained delta while `on` (Shift held)
 * and the raw delta otherwise; releasing Shift forgets the axis, so pressing it again picks afresh.
 */
export function createAxisLock() {
  let axis: LockAxis | null = null;
  return {
    get axis() {
      return axis;
    },
    apply(delta: Vec2, on: boolean): Vec2 {
      if (!on) {
        axis = null;
        return delta;
      }
      axis = chooseLockAxis(delta, axis);
      return lockDelta(delta, axis);
    },
  };
}

export type AxisLockState = ReturnType<typeof createAxisLock>;

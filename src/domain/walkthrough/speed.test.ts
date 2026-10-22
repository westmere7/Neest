import { describe, expect, it } from 'vitest';
import { FLY_SPEED_MAX, formatSpeed, SPEED_MIN, stepSpeed, WALK_SPEED_MAX } from './speed';

describe('walkthrough speed', () => {
  it('steps by √2 per wheel notch, faster on scroll up', () => {
    expect(stepSpeed(1, 1, WALK_SPEED_MAX)).toBeCloseTo(Math.SQRT2, 9);
    expect(stepSpeed(1, 2, WALK_SPEED_MAX)).toBeCloseTo(2, 9);
    expect(stepSpeed(1, -2, WALK_SPEED_MAX)).toBeCloseTo(0.5, 9);
    // Back and forth returns exactly to 1×.
    expect(stepSpeed(stepSpeed(1, 3, WALK_SPEED_MAX), -3, WALK_SPEED_MAX)).toBe(1);
  });

  it('clamps to ¼× and to the walk or fly maximum', () => {
    let s = 1;
    for (let i = 0; i < 20; i++) s = stepSpeed(s, -1, WALK_SPEED_MAX);
    expect(s).toBe(SPEED_MIN);
    for (let i = 0; i < 20; i++) s = stepSpeed(s, 1, WALK_SPEED_MAX);
    expect(s).toBe(WALK_SPEED_MAX);
    expect(stepSpeed(WALK_SPEED_MAX, 1, FLY_SPEED_MAX)).toBeCloseTo(4 * Math.SQRT2, 9);
    expect(stepSpeed(FLY_SPEED_MAX, 5, FLY_SPEED_MAX)).toBe(FLY_SPEED_MAX);
  });

  it('labels multipliers briefly', () => {
    expect(formatSpeed(1)).toBe('1×');
    expect(formatSpeed(Math.SQRT2)).toBe('1.4×');
    expect(formatSpeed(0.25)).toBe('0.25×');
    expect(formatSpeed(1 / Math.SQRT2)).toBe('0.71×');
  });
});

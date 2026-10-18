import { describe, expect, it } from 'vitest';
import { axisGuide, axisLockLabel, chooseLockAxis, createAxisLock, lockDelta, onAxis, snapOnAxis } from './axisLock';

describe('chooseLockAxis', () => {
  it('starts on the axis the pointer moved furthest along', () => {
    expect(chooseLockAxis({ x: 3, y: 1 }, null)).toBe('x');
    expect(chooseLockAxis({ x: -0.2, y: -1 }, null)).toBe('y');
    expect(chooseLockAxis({ x: -2, y: 1.9 }, null)).toBe('x');
  });

  it('keeps the current axis near 45° and switches once the other clearly leads', () => {
    expect(chooseLockAxis({ x: 1, y: 1.1 }, 'x')).toBe('x');
    expect(chooseLockAxis({ x: 1, y: 1.2 }, 'x')).toBe('x');
    expect(chooseLockAxis({ x: 1, y: 1.3 }, 'x')).toBe('y');
    expect(chooseLockAxis({ x: 1.2, y: -1 }, 'y')).toBe('y');
    expect(chooseLockAxis({ x: -1.3, y: 1 }, 'y')).toBe('x');
  });

  it('stays put when the pointer is back at the start', () => {
    expect(chooseLockAxis({ x: 0, y: 0 }, 'y')).toBe('y');
    expect(chooseLockAxis({ x: 0, y: 0 }, null)).toBe('x');
  });
});

describe('lockDelta', () => {
  it('keeps only the locked component, sign included', () => {
    expect(lockDelta({ x: -2, y: 0.4 }, 'x')).toEqual({ x: -2, y: 0 });
    expect(lockDelta({ x: 0.4, y: -2 }, 'y')).toEqual({ x: 0, y: -2 });
  });
});

describe('createAxisLock', () => {
  it('locks while on, follows a clear change of direction, and forgets the axis when released', () => {
    const lock = createAxisLock();
    expect(lock.apply({ x: 0.5, y: 0.1 }, true)).toEqual({ x: 0.5, y: 0 });
    expect(lock.axis).toBe('x');
    // A wobble towards y does not flip the lock …
    expect(lock.apply({ x: 0.5, y: 0.55 }, true)).toEqual({ x: 0.5, y: 0 });
    // … a clear turn does.
    expect(lock.apply({ x: 0.5, y: 1.5 }, true)).toEqual({ x: 0, y: 1.5 });
    expect(lock.axis).toBe('y');
    // Shift released: free move, no axis.
    expect(lock.apply({ x: 0.7, y: 0.6 }, false)).toEqual({ x: 0.7, y: 0.6 });
    expect(lock.axis).toBeNull();
    // Pressed again: picks afresh from the whole drag.
    lock.apply({ x: 0.7, y: 0.6 }, true);
    expect(lock.axis).toBe('x');
  });
});

describe('snapOnAxis', () => {
  it('snaps only the free coordinate and keeps the locked one exactly', () => {
    const base = { x: 1.234, y: 5.678 };
    expect(snapOnAxis({ x: 2.26, y: 5.678 }, base, 'x', 0.05)).toEqual({ x: 2.25, y: 5.678 });
    const p = snapOnAxis({ x: 1.234, y: 3.33 }, base, 'y', 0.1);
    expect(p.x).toBe(1.234);
    expect(p.y).toBeCloseTo(3.3, 9);
  });

  it('snaps both coordinates without a lock', () => {
    const p = snapOnAxis({ x: 1.26, y: 2.74 }, { x: 0, y: 0 }, null, 0.5);
    expect(p).toEqual({ x: 1.5, y: 2.5 });
  });
});

describe('onAxis', () => {
  it('accepts points on the locked line within tolerance', () => {
    const base = { x: 1, y: 2 };
    expect(onAxis({ x: 4, y: 2.005 }, base, 'x')).toBe(true);
    expect(onAxis({ x: 4, y: 2.2 }, base, 'x')).toBe(false);
    expect(onAxis({ x: 1, y: -3 }, base, 'y')).toBe(true);
    expect(onAxis({ x: 9, y: 9 }, base, null)).toBe(true);
  });
});

describe('axisGuide and labels', () => {
  it('draws a segment through the origin along the axis', () => {
    expect(axisGuide({ x: 1, y: 2 }, 'x', 10)).toEqual({ a: { x: -9, y: 2 }, b: { x: 11, y: 2 } });
    expect(axisGuide({ x: 1, y: 2 }, 'y', 1)).toEqual({ a: { x: 1, y: 1 }, b: { x: 1, y: 3 } });
  });

  it('names the plan y axis Z in 3D', () => {
    expect(axisLockLabel('x')).toBe('Locked to X axis');
    expect(axisLockLabel('y')).toBe('Locked to Y axis');
    expect(axisLockLabel('y', '3d')).toBe('Locked to Z axis');
  });
});

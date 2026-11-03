import { describe, expect, it } from 'vitest';
import { MAC_WHEEL_STEP, createWheelClassifier, macWheelSteps, wheelDelta } from './trackpad';

const wheel = (init: WheelEventInit) => new WheelEvent('wheel', init);

describe('wheel input', () => {
  it('treats line and page deltas as a mouse wheel and converts them to pixels', () => {
    const c = createWheelClassifier();
    // Firefox reports a mouse notch as 3 lines once deltaMode is read.
    const line = wheel({ deltaY: 3, deltaMode: 1 });
    expect(c.classify(line, 0)).toBe('wheel');
    expect(wheelDelta(line).y).toBeCloseTo(100);
    expect(wheelDelta(wheel({ deltaY: -1, deltaMode: 2 })).y).toBe(-800);
    // Pixel deltas pass through unchanged.
    expect(wheelDelta(wheel({ deltaX: 12.5, deltaY: -40 }))).toEqual({ x: 12.5, y: -40 });
  });

  it('tells a mouse notch from a trackpad swipe and a pinch', () => {
    const c = createWheelClassifier();
    expect(c.classify(wheel({ deltaY: 100 }), 0)).toBe('wheel');
    expect(c.classify(wheel({ deltaY: 4.5 }), 1000)).toBe('trackpad');
    expect(c.classify(wheel({ deltaY: 6, ctrlKey: true }), 2000)).toBe('pinch');
  });

  it('reads a macOS mouse wheel (Chrome, Safari, Edge) as a wheel with a normal notch size', () => {
    const c = createWheelClassifier();
    // Slow notches: one step each.
    for (const [i, dy] of [MAC_WHEEL_STEP, -MAC_WHEEL_STEP, MAC_WHEEL_STEP].entries()) {
      const e = wheel({ deltaY: dy });
      expect(c.classify(e, 1000 + i * 300)).toBe('wheel');
      expect(wheelDelta(e)).toEqual({ x: 0, y: Math.sign(dy) * 100 });
    }
    // A fast spin: macOS accelerates into multiples, events ~20 ms apart; still a wheel, capped at 3 notches.
    let t = 5000;
    for (const k of [1, 2, 4, 9]) {
      const e = wheel({ deltaY: -MAC_WHEEL_STEP * k });
      expect(c.classify(e, (t += 20))).toBe('wheel');
      expect(wheelDelta(e).y).toBe(-100 * Math.min(k, 3));
    }
    // Shift + wheel arrives as horizontal scroll on macOS.
    const shifted = wheel({ deltaX: MAC_WHEEL_STEP, shiftKey: true });
    expect(c.classify(shifted, 9000)).toBe('wheel');
    expect(wheelDelta(shifted)).toEqual({ x: 100, y: 0 });
    expect(macWheelSteps(wheel({ deltaY: MAC_WHEEL_STEP * 3 }))).toBe(3);
  });

  it('keeps trackpad swipes (and diagonal or integer pixel streams) as trackpad', () => {
    const c = createWheelClassifier();
    expect(c.classify(wheel({ deltaY: 4 }), 0)).toBe('trackpad');
    expect(c.classify(wheel({ deltaY: 2.5, deltaX: 1 }), 1000)).toBe('trackpad');
    // Both axes moving is never a mouse notch, even with the macOS step size.
    expect(c.classify(wheel({ deltaY: MAC_WHEEL_STEP, deltaX: MAC_WHEEL_STEP }), 2000)).toBe('trackpad');
    expect(macWheelSteps(wheel({ deltaY: 4 }))).toBe(0);
    expect(macWheelSteps(wheel({ deltaY: MAC_WHEEL_STEP * 1.5 }))).toBe(0);
    expect(macWheelSteps(wheel({ deltaY: 1, deltaMode: 1 }))).toBe(0);
    // Pixel deltas that are not macOS notches pass through unchanged.
    expect(wheelDelta(wheel({ deltaY: 4 }))).toEqual({ x: 0, y: 4 });
  });
});

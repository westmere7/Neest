import { beforeEach, describe, expect, it } from 'vitest';
import { MAC_WHEEL_STEP, createWheelClassifier, macWheelSteps, resetScrollDeviceMemory, setScrollDevice, wheelDelta } from './trackpad';

const wheel = (init: WheelEventInit) => new WheelEvent('wheel', init);

describe('wheel input', () => {
  beforeEach(() => {
    resetScrollDeviceMemory();
    setScrollDevice('auto');
  });

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

  it('reads a Logitech wheel on macOS (notches mixed with smooth in-between steps) as a wheel all through', () => {
    const c = createWheelClassifier();
    // A scroll that starts with smooth steps before the first notch, events ~16 ms apart.
    const stream = [1.5, 2.75, MAC_WHEEL_STEP, 6.3, MAC_WHEEL_STEP * 2, 3.1, 0.9];
    const first = stream.map((dy, i) => c.classify(wheel({ deltaY: dy }), 1000 + i * 16));
    // Before any proof the first steps go with the old guess, but from the first notch on it is a wheel.
    expect(first.slice(2)).toEqual(['wheel', 'wheel', 'wheel', 'wheel', 'wheel']);
    // The next scroll (after a pause) is a wheel from its very first smooth step: the device is known.
    const next = [1.25, 2.5, 5.1, 2.2].map((dy, i) => c.classify(wheel({ deltaY: dy }), 3000 + i * 16));
    expect(next).toEqual(['wheel', 'wheel', 'wheel', 'wheel']);
    // Another view's classifier knows it too (one device per page).
    expect(createWheelClassifier().classify(wheel({ deltaY: 3.3 }), 5000)).toBe('wheel');
  });

  it('keeps one reading per gesture; only a diagonal step turns a wheel gesture into a trackpad swipe', () => {
    const c = createWheelClassifier();
    // A trackpad swipe: never switches to a wheel mid-way, even on a large straight step.
    const swipe = [[0.5, 1], [0, 3], [0, 60], [0, 12]].map(([x, y], i) => c.classify(wheel({ deltaX: x, deltaY: y }), 100 + i * 16));
    expect(swipe).toEqual(['trackpad', 'trackpad', 'trackpad', 'trackpad']);
    // After a mouse notch, a later gesture that turns out diagonal is a trackpad again from that step on.
    expect(c.classify(wheel({ deltaY: MAC_WHEEL_STEP }), 2000)).toBe('wheel');
    expect(c.classify(wheel({ deltaY: 2 }), 4000)).toBe('wheel');
    expect(c.classify(wheel({ deltaY: 2, deltaX: 1 }), 4016)).toBe('trackpad');
    expect(c.classify(wheel({ deltaY: 3 }), 4032)).toBe('trackpad');
    // A pinch proves a trackpad too.
    expect(c.classify(wheel({ deltaY: 2, ctrlKey: true }), 6000)).toBe('pinch');
    expect(c.classify(wheel({ deltaY: 5 }), 8000)).toBe('trackpad');
  });

  it('follows the Scrolling setting when it is not automatic', () => {
    const c = createWheelClassifier();
    setScrollDevice('mouse');
    expect(c.classify(wheel({ deltaY: 1.5, deltaX: 0.5 }), 0)).toBe('wheel');
    setScrollDevice('trackpad');
    expect(c.classify(wheel({ deltaY: 100 }), 1000)).toBe('trackpad');
    // Pinches and line-mode wheels are what they are whatever the setting.
    expect(c.classify(wheel({ deltaY: 2, ctrlKey: true }), 2000)).toBe('pinch');
    expect(c.classify(wheel({ deltaY: 3, deltaMode: 1 }), 3000)).toBe('wheel');
  });
});

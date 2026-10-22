import { describe, expect, it } from 'vitest';
import { createWheelClassifier, wheelDelta } from './trackpad';

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
});

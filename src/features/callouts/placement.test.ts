import { describe, expect, it } from 'vitest';
import { inView, placeNoteLabels, screenBounds, type ScreenRect } from './placement';

const hit = (a: ScreenRect, b: ScreenRect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const view = { w: 1000, h: 700 };

describe('3D note label layout', () => {
  it('keeps labels apart when there is room', () => {
    // Five notes on nearly the same spot.
    const items = [0, 1, 2, 3, 4].map((i) => ({ id: `n${i}`, anchor: { x: 500 + i, y: 400 }, prefer: { x: 500 + i * 3, y: 300 }, w: 160, h: 60 }));
    const out = placeNoteLabels(items, view, { mode: 'close' });
    for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) expect(hit(out[i].rect, out[j].rect), `${i} ${j}`).toBe(false);
    for (const p of out) {
      expect(p.rect.x).toBeGreaterThanOrEqual(0);
      expect(p.rect.y + p.rect.h).toBeLessThanOrEqual(view.h);
    }
  });

  it('leaves a label where it is when nothing is in the way, with the leader meeting its nearest edge', () => {
    const [p] = placeNoteLabels([{ id: 'a', anchor: { x: 300, y: 500 }, prefer: { x: 300, y: 300 }, w: 120, h: 40 }], view, { mode: 'close' });
    expect(p.rect).toEqual({ x: 240, y: 260, w: 120, h: 40 });
    expect(p.attach).toEqual({ x: 300, y: 300 });
  });

  it('moves labels off the building in "clear of the walls"', () => {
    const building = { x: 300, y: 200, w: 400, h: 300 };
    const items = [
      { id: 'a', anchor: { x: 400, y: 350 }, prefer: { x: 400, y: 320 }, w: 140, h: 50 },
      { id: 'b', anchor: { x: 600, y: 420 }, prefer: { x: 600, y: 400 }, w: 140, h: 50 },
    ];
    const clear = placeNoteLabels(items, view, { mode: 'clear', obstacle: building });
    for (const p of clear) expect(hit(p.rect, building)).toBe(false);
    // Other modes ignore the building.
    const close = placeNoteLabels(items, view, { mode: 'close', obstacle: building });
    expect(close.some((p) => hit(p.rect, building))).toBe(true);
  });

  it('tells what is in view and bounds projected points', () => {
    expect(inView({ x: 10, y: 10 }, view)).toBe(true);
    expect(inView({ x: -50, y: 10 }, view)).toBe(false);
    expect(inView({ x: 500, y: 900 }, view)).toBe(false);
    expect(screenBounds([{ x: 1, y: 5 }, null, { x: 9, y: 2 }])).toEqual({ x: 1, y: 2, w: 8, h: 3 });
    expect(screenBounds([null])).toBeNull();
  });
});

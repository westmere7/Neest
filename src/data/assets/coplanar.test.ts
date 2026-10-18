import { describe, expect, it } from 'vitest';
import { box, cyl, discZ } from './parts';
import { coplanarClashes } from './coplanar';

describe('coplanarClashes', () => {
  it('flags a disc whose top is level with the body top, in another slot', () => {
    const parts = [box('body', [0, 0.25, 0], [0.3, 0.5, 0.3]), cyl('grille', [0, 0.498, 0], 0.1, 0.004)];
    expect(coplanarClashes(parts)).toMatchObject([{ parts: [0, 1], slots: ['body', 'grille'], axis: 'y', sign: 1 }]);
  });

  it('accepts the disc once it stands proud, or in the same slot unless asked', () => {
    expect(coplanarClashes([box('body', [0, 0.25, 0], [0.3, 0.5, 0.3]), cyl('grille', [0, 0.4996, 0], 0.1, 0.0048)])).toEqual([]);
    const same = [box('body', [0, 0.25, 0], [0.3, 0.5, 0.3]), cyl('body', [0, 0.498, 0], 0.1, 0.004)];
    expect(coplanarClashes(same)).toEqual([]);
    expect(coplanarClashes(same, { sameSlot: true })).toHaveLength(1);
  });

  it('follows quarter-turn rotations and ignores faces resting on the floor', () => {
    // A front label flush with the box front (z = 0.15).
    const label = discZ('label', [0, 0.25, 0.148], 0.05, 0.004);
    expect(coplanarClashes([box('body', [0, 0.25, 0], [0.3, 0.5, 0.3]), label])).toMatchObject([{ axis: 'z', sign: 1 }]);
    expect(coplanarClashes([box('body', [0, 0.25, 0], [0.3, 0.5, 0.3]), box('feet', [0, 0.01, 0], [0.2, 0.02, 0.2])])).toEqual([]);
  });
});

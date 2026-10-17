import { describe, expect, it } from 'vitest';
import type { PlacedObject } from '@/domain/model/schema';
import type { AssetDefinition } from './types';
import { resolveObjectLights } from './lights';

const asset = {
  defaultSize: { w: 1, d: 0.5, h: 2 },
  light: { color: '#ffeedd', intensity: 1, distance: 4, y: 1.5, x: 0.3, z: 0.1, kind: 'spot', dir: [0, -1, 1] },
} as unknown as AssetDefinition;

const obj = (patch: Partial<PlacedObject> = {}): PlacedObject =>
  ({ id: 'o1', assetId: 'a', name: null, x: 2, y: 3, elevation: 0.5, rotation: 0, width: 1, depth: 0.5, height: 2, mirrored: false, materials: {}, locked: false, hidden: false, ...patch }) as PlacedObject;

const near = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 6));

describe('resolveObjectLights', () => {
  it('places the bulb in world space at the default size', () => {
    const [l] = resolveObjectLights(obj(), asset);
    near(l.position, [2.3, 2, 3.1]);
    near(l.dir, [0, -Math.SQRT1_2, Math.SQRT1_2]);
    expect(l.kind).toBe('spot');
  });

  it('scales the bulb position with the placed size', () => {
    const [l] = resolveObjectLights(obj({ width: 2, height: 3 }), asset);
    near(l.position, [2.6, 2.75, 3.1]);
  });

  it('mirrors and turns with the object like the scene group (rotation.y = -rotation)', () => {
    const [m] = resolveObjectLights(obj({ mirrored: true }), asset);
    near(m.position, [1.7, 2, 3.1]);
    // A quarter turn: three.js Ry(-π/2) maps local +x to +z and local +z to -x.
    const [r] = resolveObjectLights(obj({ rotation: Math.PI / 2 }), asset);
    near(r.position, [2 - 0.1, 2, 3 + 0.3]);
    near(r.dir, [-Math.SQRT1_2, -Math.SQRT1_2, 0]);
  });

  it('emits one light per head and nothing when hidden', () => {
    const multi = { ...asset, light: { ...asset.light!, heads: [{ y: 1 }, { y: 1.2, x: -0.2 }] } } as AssetDefinition;
    expect(resolveObjectLights(obj(), multi).map((l) => l.key)).toEqual(['o1#0', 'o1#1']);
    expect(resolveObjectLights(obj({ hidden: true }), asset)).toEqual([]);
  });
});

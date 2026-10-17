import { describe, expect, it } from 'vitest';
import { ASSET_CATALOG } from '@/data/assets/catalog';
import type { AssetDefinition } from '@/data/assets/types';
import { thumbFileName, thumbFingerprint } from './thumbFingerprint';

const base = ASSET_CATALOG.find((a) => a.id === 'table-lamp')!;

describe('thumbFingerprint', () => {
  it('is stable for the same definition and differs between assets', () => {
    const copy = { ...base } as AssetDefinition;
    expect(thumbFingerprint(copy)).toBe(thumbFingerprint(base));
    expect(thumbFingerprint(base)).toMatch(/^[0-9a-f]{16}$/);
    const fps = new Set(ASSET_CATALOG.slice(0, 80).map((a) => thumbFingerprint(a)));
    expect(fps.size).toBe(80);
  });

  it('changes when the geometry or a default material changes', () => {
    const moved = { ...base, build: (s: AssetDefinition['defaultSize']) => base.build({ ...s, h: s.h * 1.1 }) } as AssetDefinition;
    expect(thumbFingerprint(moved)).not.toBe(thumbFingerprint(base));
    const recoloured = { ...base, slots: base.slots.map((s, i) => (i ? s : { ...s, defaultMaterial: 'metal-brass' })) } as AssetDefinition;
    expect(thumbFingerprint(recoloured)).not.toBe(thumbFingerprint(base));
  });

  it('makes file-safe names for pack ids', () => {
    expect(thumbFileName('cafe-dining:cafe-monstera')).toBe('cafe-dining_cafe-monstera.webp');
  });
});

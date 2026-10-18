import { describe, expect, it } from 'vitest';
import '@/packs/loader';
import { getAsset } from '@/data/assets/registry';
import { ASSET_GROUPS } from '@/data/assets/catalog';
import { savedGroupAsset } from '@/features/library/savedGroupAssets';
import { READY_GROUP_SHELVES, READY_GROUP_SPECS, buildReadyGroup, readyGroupById, readyGroups } from './readyGroups';

describe('ready-made groups', () => {
  it('has a good number of groups on known shelves', () => {
    expect(READY_GROUP_SPECS.length).toBeGreaterThanOrEqual(30);
    for (const s of READY_GROUP_SPECS) expect(READY_GROUP_SHELVES, s.id).toContain(s.shelf);
    for (const shelf of READY_GROUP_SHELVES) expect(READY_GROUP_SPECS.some((s) => s.shelf === shelf), shelf).toBe(true);
  });

  it('uses unique ids and names and real descriptions', () => {
    expect(new Set(READY_GROUP_SPECS.map((s) => s.id)).size).toBe(READY_GROUP_SPECS.length);
    expect(new Set(READY_GROUP_SPECS.map((s) => s.name.toLowerCase())).size).toBe(READY_GROUP_SPECS.length);
    for (const s of READY_GROUP_SPECS) {
      expect(s.id, s.id).toMatch(/^ready-[a-z0-9-]+$/);
      expect(s.name.length, s.id).toBeLessThanOrEqual(60);
      expect(s.description.length, s.id).toBeGreaterThanOrEqual(60);
      expect(s.description.length, s.id).toBeLessThanOrEqual(500);
    }
  });

  it('only references items that exist (built-in or packs)', () => {
    for (const s of READY_GROUP_SPECS) for (const it of s.items) expect(getAsset(null, it.a), `${s.id}: ${it.a}`).not.toBeNull();
  });

  it('builds every group centred on its footprint at a sensible size', () => {
    for (const s of READY_GROUP_SPECS) {
      const g = buildReadyGroup(s);
      expect(g.items.length, s.id).toBe(s.items.length);
      expect(g.size.w, s.id).toBeGreaterThan(0.3);
      expect(g.size.w, s.id).toBeLessThan(6);
      expect(g.size.d, s.id).toBeLessThan(4);
      for (const it of g.items) {
        expect(Math.abs(it.dx), `${s.id}: ${it.assetId}`).toBeLessThanOrEqual(g.size.w / 2 + 1e-6);
        expect(Math.abs(it.dy), `${s.id}: ${it.assetId}`).toBeLessThanOrEqual(g.size.d / 2 + 1e-6);
      }
    }
  });

  it('shows up as library items with the description and its shelf', () => {
    const g = readyGroupById('ready-queen-bedroom')!;
    expect(readyGroups()).toContain(g);
    const a = savedGroupAsset(g);
    expect(a.id).toBe('savedgroup:ready-queen-bedroom');
    expect(a.description).toBe(g.description);
    expect(a.group).toBe('Bedroom setups');
    expect(a.category).toBe('bedroom');
    expect(a.build({ w: 1, d: 1, h: 1 }).length).toBeGreaterThan(5);
    // Shelves are the Groups tab's own, not catalogue groups.
    expect(Object.values(ASSET_GROUPS).flat()).not.toContain('Bedroom setups');
  });
});

describe('group names from contents', () => {
  it('spots generic names', async () => {
    const { isGenericGroupName } = await import('@/features/editor/groups');
    for (const n of ['Group 1', 'group 12', 'Group of 4 items', 'Group of 1 item']) expect(isGenericGroupName(n), n).toBe(true);
    for (const n of ['Reading corner', 'Group dinner', 'Queen bed with nightstands']) expect(isGenericGroupName(n), n).toBe(false);
  });

  it('names a group after its largest items', async () => {
    const { smartGroupName } = await import('@/features/editor/groups');
    const name = smartGroupName([
      { assetId: 'coffee-table', width: 1.2, depth: 0.6 },
      { assetId: 'sofa-3-seat', width: 2.2, depth: 0.92 },
      { assetId: 'side-table', width: 0.45, depth: 0.45 },
      { assetId: 'table-lamp', width: 0.32, depth: 0.32 },
    ]);
    expect(name).toBe('3-seat sofa & coffee table + 2 more');
    expect(smartGroupName([{ assetId: 'dining-chair', width: 0.46, depth: 0.52 }, { assetId: 'dining-chair', width: 0.46, depth: 0.52 }])).toBe('Dining chair + 1 more');
  });
});

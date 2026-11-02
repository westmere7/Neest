import { describe, expect, it } from 'vitest';
import '@/packs/loader';
import { ASSET_CATALOG, ASSETS_BY_ID } from './catalog';
import {
  ALL_FURNITURE_CATEGORIES,
  ITEM_CATEGORIES,
  ROOM_CATEGORIES,
  furnitureCategoriesOf,
  primaryItemCategoryOf,
} from './furnitureCategories';

describe('furnitureCategories multi-category classification', () => {
  it('assigns every catalogue item (built-in and pack) to at least one item category', () => {
    expect(ASSET_CATALOG.length).toBeGreaterThan(1200);
    for (const a of ASSET_CATALOG) {
      const m = furnitureCategoriesOf(a);
      expect(m.items.length, `${a.id} (${a.name}) should have >=1 item category`).toBeGreaterThanOrEqual(1);
      expect(m.items).toContain(primaryItemCategoryOf(a));
    }
  });

  it('populates every defined room and item category with real items', () => {
    const counts = new Map<string, number>();
    for (const c of ALL_FURNITURE_CATEGORIES) counts.set(c.id, 0);
    for (const a of ASSET_CATALOG) {
      const m = furnitureCategoriesOf(a);
      for (const id of m.all) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    for (const c of ROOM_CATEGORIES) {
      expect(counts.get(c.id), `${c.id} should not be empty`).toBeGreaterThan(15);
    }
    for (const c of ITEM_CATEGORIES) {
      expect(counts.get(c.id), `${c.id} should not be empty`).toBeGreaterThan(0);
    }
  });

  it('classifies multi-purpose and cross-room items into multiple categories naturally', () => {
    // Sofa beds / daybeds belong to both Living room & Bedroom AND both Sofas & chairs & Beds
    const sofaBeds = ASSET_CATALOG.filter((a) => a.group === 'Daybeds & sofa beds');
    expect(sofaBeds.length).toBeGreaterThan(0);
    for (const sb of sofaBeds) {
      const m = furnitureCategoriesOf(sb);
      expect(m.rooms).toContain('room:living');
      expect(m.rooms).toContain('room:bedroom');
      expect(m.items).toContain('item:beds');
      expect(m.items).toContain('item:seating');
    }

    // Kitchen sink counters belong to Kitchen, Tables & desks, Cabinets, and Bath & sinks
    const sinkCounters = ASSET_CATALOG.filter(
      (a) => a.group === 'Counters & cabinets' && Boolean(a.services?.water || a.services?.drain),
    );
    expect(sinkCounters.length).toBeGreaterThan(0);
    for (const sc of sinkCounters) {
      const m = furnitureCategoriesOf(sc);
      expect(m.rooms).toContain('room:kitchen');
      expect(m.items).toContain('item:tables');
      expect(m.items).toContain('item:storage');
      expect(m.items).toContain('item:plumbing');
    }

    // Indoor split AC belongs to Living room, Bedroom & Office AND both Appliances & Electronics
    const indoorAc = ASSETS_BY_ID['branded-climate-vn:panasonic-cs-xu9zkh-8'];
    expect(indoorAc).toBeDefined();
    if (indoorAc) {
      const m = furnitureCategoriesOf(indoorAc);
      expect(m.rooms).toEqual(expect.arrayContaining(['room:living', 'room:bedroom', 'room:office']));
      expect(m.items).toEqual(expect.arrayContaining(['item:appliances', 'item:electronics']));
    }

    // Soft-curve avocado L-desks belong to Study & office, Bedroom, Kids & nursery, and Tables & desks
    for (const id of ['l-desks:soft-curve-avocado-l-desk-left', 'l-desks:soft-curve-avocado-l-desk-right']) {
      const lDesk = ASSETS_BY_ID[id];
      expect(lDesk).toBeDefined();
      const m = furnitureCategoriesOf(lDesk);
      expect(m.rooms).toEqual(expect.arrayContaining(['room:office', 'room:bedroom', 'room:kids']));
      expect(m.items).toContain('item:tables');
    }

    // Wall-backed peninsula dining table belongs to Dining, Kitchen, and Tables & desks
    const penTable = ASSETS_BY_ID['soft-curve-furniture:wall-peninsula-bead-table'];
    expect(penTable).toBeDefined();
    const pm = furnitureCategoriesOf(penTable);
    expect(pm.rooms).toEqual(expect.arrayContaining(['room:dining', 'room:kitchen']));
    expect(pm.items).toContain('item:tables');

    // Modular curved-waterfall add-on desk belongs to Study & office, Bedroom, Tables & desks, and Cabinets
    const modDesk = ASSETS_BY_ID['wardrobe-study:modular-waterfall-cabinet-desk'];
    expect(modDesk).toBeDefined();
    const mm = furnitureCategoriesOf(modDesk);
    expect(mm.rooms).toEqual(expect.arrayContaining(['room:office', 'room:bedroom']));
    expect(mm.items).toEqual(expect.arrayContaining(['item:tables', 'item:storage']));

    // Rounded-corner full-length wall mirror belongs to Bedroom, Living room, Bathroom, and Decor & art
    const wallMirror = ASSETS_BY_ID['soft-curve-furniture:rounded-rect-wall-mirror'];
    expect(wallMirror).toBeDefined();
    const wm = furnitureCategoriesOf(wallMirror);
    expect(wm.rooms).toEqual(expect.arrayContaining(['room:bedroom', 'room:living', 'room:bathroom']));
    expect(wm.items).toContain('item:decor');

    // Curved-waterfall shoe cabinet with towel cubbies belongs to Bathroom, Living room, Bedroom, and Cabinets
    const shoeTowel = ASSETS_BY_ID['soft-curve-furniture:curved-shoe-towel-cubby-cabinet'];
    expect(shoeTowel).toBeDefined();
    const stm = furnitureCategoriesOf(shoeTowel);
    expect(stm.rooms).toEqual(expect.arrayContaining(['room:bathroom', 'room:living', 'room:bedroom']));
    expect(stm.items).toContain('item:storage');
  });
});

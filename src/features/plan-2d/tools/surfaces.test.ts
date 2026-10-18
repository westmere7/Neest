import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { createEmptyProject } from '@/domain/model/defaults';
import { placeObject } from '@/domain/commands/entities';
import { ASSETS_BY_ID } from '@/data/assets/catalog';
import { canStandOnSurfaces, movedElevation, surfaceUnder } from './surfaces';

const table = ASSETS_BY_ID['dining-table-rect'];
const lamp = ASSETS_BY_ID['table-lamp'];
const sofa = ASSETS_BY_ID['sofa-3-seat'];

function withTable() {
  let tableId = '';
  let lampId = '';
  const p = produce(createEmptyProject(), (d) => {
    const s = table.defaultSize;
    tableId = placeObject(d, { assetId: table.id, x: 2, y: 2, width: s.w, depth: s.d, height: s.h, rotation: Math.PI / 2 });
    lampId = placeObject(d, { assetId: lamp.id, x: 5, y: 5, width: lamp.defaultSize.w, depth: lamp.defaultSize.d, height: lamp.defaultSize.h });
  });
  return { p, tableId, lampId };
}

describe('surface placement', () => {
  it('lets small items stand on furniture, not sofas or tables', () => {
    expect(canStandOnSurfaces(lamp, lamp.defaultSize)).toBe(true);
    expect(canStandOnSurfaces(sofa, sofa.defaultSize)).toBe(false);
    expect(canStandOnSurfaces(table, table.defaultSize)).toBe(false);
  });

  it('finds the table top under a point, and nothing beside the table', () => {
    const { p } = withTable();
    const top = surfaceUnder(p, lamp, lamp.defaultSize, 2, 2);
    expect(top).not.toBeNull();
    expect(top!).toBeGreaterThan(0.6);
    expect(top!).toBeLessThanOrEqual(table.defaultSize.h + 0.001);
    expect(surfaceUnder(p, lamp, lamp.defaultSize, 4, 4)).toBeNull();
  });

  it('lifts a moved item onto the table and drops it back off', () => {
    const { p, lampId, tableId } = withTable();
    const onTable = movedElevation(p, lampId, 2, 2);
    expect(onTable).toBeCloseTo(surfaceUnder(p, lamp, lamp.defaultSize, 2, 2)!, 6);
    const lifted = produce(p, (d) => {
      d.objects[lampId].x = 2;
      d.objects[lampId].y = 2;
      d.objects[lampId].elevation = onTable!;
    });
    expect(movedElevation(lifted, lampId, 4, 4)).toBe(lamp.defaultElevation);
    // The table itself never stands on anything.
    expect(movedElevation(p, tableId, 5, 5)).toBeUndefined();
  });
});

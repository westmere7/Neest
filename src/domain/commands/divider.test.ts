import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { createEmptyProject } from '../model/defaults';
import type { Project } from '../model/schema';
import { detectRoomFaces } from '../geometry/rooms';
import { computeWallNetwork } from '../geometry/walls';
import { buildColliders } from '../walkthrough/collision';
import { addOpening, reconcileRooms } from './entities';
import { addWallChain, setWallStyle, type D } from './walls';

const edit = (p: Project, fn: (d: D) => void): Project => produce(p, fn);

/** A 4 × 3 m room (0.1 m walls) split at x = 2 by an invisible divider. */
function splitRoom(divider = true) {
  let div = '';
  const p = edit(createEmptyProject(), (d) => {
    addWallChain(d, [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }], { closed: true, thickness: 0.1, height: 2.7, role: 'interior' });
    div = addWallChain(d, [{ x: 2, y: 0 }, { x: 2, y: 3 }], { thickness: 0.02, height: 2.7, role: 'partition' })[0];
    if (divider) setWallStyle(d, [div], 'separator');
    reconcileRooms(d);
  });
  return { p, div };
}

describe('invisible room dividers', () => {
  it('split a room into two whose floors meet on the divider centre line', () => {
    const { p } = splitRoom();
    const faces = detectRoomFaces(p);
    expect(faces).toHaveLength(2);
    // Together exactly the undivided clear area (3.9 × 2.9): no strip lost under the divider.
    expect(faces.reduce((s, f) => s + f.area, 0)).toBeCloseTo(3.9 * 2.9, 6);
    expect(Object.keys(p.rooms)).toHaveLength(2);
  });

  it('leave the built walls as if the divider were not there (no hubs, same outline)', () => {
    const { p } = splitRoom();
    const net = computeWallNetwork(p);
    expect(net.hubs).toHaveLength(0);
    const plain = edit(createEmptyProject(), (d) => {
      addWallChain(d, [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }], { closed: true, thickness: 0.1, height: 2.7, role: 'interior' });
    });
    const area = (n: ReturnType<typeof computeWallNetwork>) =>
      [...n.walls.values()].filter((g) => !g.wall.style).reduce((s, g) => s + g.path.length * g.h * 2, 0);
    expect(area(net)).toBeCloseTo(area(computeWallNetwork(plain)), 6);
    // A built wall in the same place butts against the straight walls: T-junctions need no hub.
    expect(computeWallNetwork(splitRoom(false).p).hubs).toHaveLength(0);
  });

  it('refuse doors and windows, and lose them when a wall becomes a divider', () => {
    const { p, div } = splitRoom(false);
    let door: string | null = null;
    const q = edit(p, (d) => {
      door = addOpening(d, { wallId: div, kind: 'door-single', offset: 1.5 });
    });
    expect(door).toBeTruthy();
    const r = edit(q, (d) => setWallStyle(d, [div], 'separator'));
    expect(Object.keys(r.openings)).toHaveLength(0);
    expect(r.walls[div].thickness).toBeLessThanOrEqual(0.05);
    edit(r, (d) => {
      expect(addOpening(d, { wallId: div, kind: 'door-single', offset: 1.5 })).toBeNull();
    });
  });

  it('do not block the walkthrough', () => {
    const withDivider = buildColliders(splitRoom().p, computeWallNetwork(splitRoom().p)).length;
    const withWall = buildColliders(splitRoom(false).p, computeWallNetwork(splitRoom(false).p)).length;
    expect(withDivider).toBeLessThan(withWall);
    const outlineOnly = edit(createEmptyProject(), (d) => {
      addWallChain(d, [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }], { closed: true, thickness: 0.1, height: 2.7, role: 'interior' });
    });
    // Splitting the outline walls at the divider ends adds collinear pieces, not obstacles.
    expect(withDivider).toBeGreaterThanOrEqual(buildColliders(outlineOnly, computeWallNetwork(outlineOnly)).length);
  });
});

describe('wall types', () => {
  it('group walls by type, dividers apart', async () => {
    const { wallTypeGroups } = await import('@/features/editor/WallTypes');
    const { p } = splitRoom();
    const groups = wallTypeGroups(p);
    expect(groups.map((g) => [g.key, g.walls.length])).toEqual([
      ['interior', 6],
      ['divider', 1],
    ]);
  });

  it('give every wall of a type one material through a multi-wall target', async () => {
    const { assignMaterial, getTargetMaterialId } = await import('./entities');
    const { p } = splitRoom();
    const ids = Object.values(p.walls)
      .filter((w) => w.role === 'interior')
      .map((w) => w.id);
    const q = edit(p, (d) => assignMaterial(d, [{ kind: 'walls-side', wallIds: ids, side: 'left' }], 'paint-sage'));
    for (const id of ids) expect(q.walls[id].materials.left).toBe('paint-sage');
    expect(getTargetMaterialId(q, { kind: 'walls-side', wallIds: ids, side: 'left' })).toBe('paint-sage');
    expect(q.materials['paint-sage']).toBeDefined();
  });
});

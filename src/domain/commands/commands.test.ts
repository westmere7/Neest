import { describe, expect, it, beforeEach } from 'vitest';
import { produce } from 'immer';
import { createEmptyProject } from '../model/defaults';
import type { Project } from '../model/schema';
import { ProjectSchema } from '../model/schema';
import {
  addRectangleWalls,
  addWallChain,
  deleteWalls,
  setNodePositions,
  setWallLength,
  settleNode,
  splitWallAt,
  type D,
} from './walls';
import { addOpening, deleteEntities, reconcileRooms, updateOpening } from './entities';
import { detectRoomFaces } from '../geometry/rooms';
import { computeWallNetwork } from '../geometry/walls';
import { dist } from '../geometry/vec';
import { useProjectStore } from '@/state/projectStore';

const W = { thickness: 0.1, height: 2.7, role: 'interior' as const };

function edit(p: Project, fn: (d: D) => void): Project {
  return produce(p, (d) => {
    fn(d);
    reconcileRooms(d);
  });
}

const wallCount = (p: Project) => Object.keys(p.walls).length;

describe('wall drawing', () => {
  it('creates a connected chain sharing nodes', () => {
    const p = edit(createEmptyProject(), (d) => {
      addWallChain(d, [
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 2 },
      ], W);
    });
    expect(wallCount(p)).toBe(2);
    expect(Object.keys(p.nodes)).toHaveLength(3);
  });

  it('detects a rectangle room with inner (clear) area', () => {
    const p = edit(createEmptyProject(), (d) => {
      addRectangleWalls(d, { x: 0, y: 0 }, { x: 4, y: 3 }, W);
    });
    const faces = detectRoomFaces(p);
    expect(faces).toHaveLength(1);
    expect(faces[0].area).toBeCloseTo(3.9 * 2.9, 5);
    expect(faces[0].perimeter).toBeCloseTo(2 * (3.9 + 2.9), 5);
    expect(Object.keys(p.rooms)).toHaveLength(1);
  });

  it('detects an L-shaped (concave) room with correct area', () => {
    const p = edit(createEmptyProject(), (d) => {
      addWallChain(
        d,
        [
          { x: 0, y: 0 },
          { x: 4, y: 0 },
          { x: 4, y: 2 },
          { x: 2, y: 2 },
          { x: 2, y: 4 },
          { x: 0, y: 4 },
        ],
        { ...W, thickness: 0.2, closed: true },
      );
    });
    const faces = detectRoomFaces(p);
    expect(faces).toHaveLength(1);
    // Centreline area 12 m²; clear area with 0.1 m inset on every edge.
    // Outer bbox shrinks to 3.8 x 3.8 minus the notch 1.8 x 1.8 (notch grows by 0.1 on two sides).
    expect(faces[0].area).toBeCloseTo(3.8 * 3.8 - 2.0 * 2.0 + 0, 1);
    expect(faces[0].degraded).toBe(false);
  });

  it('shares a wall between adjacent rooms without duplicating it', () => {
    const p = edit(createEmptyProject(), (d) => {
      addRectangleWalls(d, { x: 0, y: 0 }, { x: 3, y: 3 }, W);
      addRectangleWalls(d, { x: 3, y: 0 }, { x: 6, y: 3 }, W);
    });
    expect(wallCount(p)).toBe(7);
    const faces = detectRoomFaces(p);
    expect(faces).toHaveLength(2);
  });

  it('splits an existing wall at a T-junction', () => {
    const p = edit(createEmptyProject(), (d) => {
      addRectangleWalls(d, { x: 0, y: 0 }, { x: 6, y: 3 }, W);
      addWallChain(d, [
        { x: 3, y: 0 },
        { x: 3, y: 3 },
      ], W);
    });
    expect(wallCount(p)).toBe(7);
    expect(detectRoomFaces(p)).toHaveLength(2);
  });

  it('inserts a junction where a new wall crosses an existing one', () => {
    const p = edit(createEmptyProject(), (d) => {
      addWallChain(d, [
        { x: 0, y: 1 },
        { x: 4, y: 1 },
      ], W);
      addWallChain(d, [
        { x: 2, y: -1 },
        { x: 2, y: 3 },
      ], W);
    });
    expect(wallCount(p)).toBe(4);
    const centre = Object.values(p.nodes).find((n) => dist(n, { x: 2, y: 1 }) < 1e-6);
    expect(centre).toBeDefined();
  });

  it('handles narrow corridors between rooms', () => {
    const p = edit(createEmptyProject(), (d) => {
      addRectangleWalls(d, { x: 0, y: 0 }, { x: 8, y: 1 }, W);
      addRectangleWalls(d, { x: 0, y: 1 }, { x: 4, y: 4 }, W);
      addRectangleWalls(d, { x: 4, y: 1 }, { x: 8, y: 4 }, W);
    });
    const faces = detectRoomFaces(p);
    expect(faces).toHaveLength(3);
    const corridor = faces.find((f) => Math.abs(f.bounds.maxY - f.bounds.minY - 0.9) < 1e-6);
    expect(corridor).toBeDefined();
    expect(corridor!.area).toBeCloseTo(7.9 * 0.9, 5);
  });

  it('ignores dangling stubs when detecting rooms', () => {
    const p = edit(createEmptyProject(), (d) => {
      addRectangleWalls(d, { x: 0, y: 0 }, { x: 4, y: 4 }, W);
      addWallChain(d, [
        { x: 0, y: 2 },
        { x: 1.5, y: 2 },
      ], W);
    });
    const faces = detectRoomFaces(p);
    expect(faces).toHaveLength(1);
    expect(faces[0].area).toBeCloseTo(3.9 * 3.9, 5);
  });

  it('treats a free-standing island room as a hole of the enclosing room', () => {
    const p = edit(createEmptyProject(), (d) => {
      addRectangleWalls(d, { x: 0, y: 0 }, { x: 6, y: 6 }, W);
      addRectangleWalls(d, { x: 2, y: 2 }, { x: 4, y: 4 }, W);
    });
    const faces = detectRoomFaces(p);
    expect(faces).toHaveLength(2);
    const outer = faces.find((f) => f.holes.length === 1)!;
    expect(outer).toBeDefined();
    expect(outer.area).toBeCloseTo(5.9 * 5.9 - 2.1 * 2.1, 5);
  });
});

describe('wall editing', () => {
  let base: Project;
  beforeEach(() => {
    base = edit(createEmptyProject(), (d) => {
      addRectangleWalls(d, { x: 0, y: 0 }, { x: 4, y: 3 }, W);
    });
  });

  it('keeps attached walls connected when a node moves', () => {
    const corner = Object.values(base.nodes).find((n) => n.x === 4 && n.y === 0)!;
    const p = edit(base, (d) => setNodePositions(d, { [corner.id]: { x: 5, y: -1 } }));
    const attached = Object.values(p.walls).filter((w) => w.a === corner.id || w.b === corner.id);
    expect(attached).toHaveLength(2);
    expect(p.nodes[corner.id]).toMatchObject({ x: 5, y: -1 });
    expect(detectRoomFaces(p)).toHaveLength(1);
  });

  it('sets an exact wall length by moving the far end along the wall', () => {
    const top = Object.values(base.walls).find((w) => {
      const a = base.nodes[w.a];
      const b = base.nodes[w.b];
      return a.y === 0 && b.y === 0;
    })!;
    const p = edit(base, (d) => setWallLength(d, top.id, 5, 'start'));
    const a = p.nodes[top.a];
    const b = p.nodes[top.b];
    expect(dist(a, b)).toBeCloseTo(5);
    expect(a).toMatchObject(base.nodes[top.a]);
  });

  it('splits a wall and reassigns openings by position', () => {
    const top = Object.values(base.walls).find((w) => base.nodes[w.a].y === 0 && base.nodes[w.b].y === 0)!;
    const a = base.nodes[top.a];
    let doorNear = '';
    let doorFar = '';
    let p = edit(base, (d) => {
      const fromA = (x: number) => Math.abs(x - a.x);
      doorNear = addOpening(d, { wallId: top.id, kind: 'door-single', offset: fromA(1), width: 0.8 })!;
      doorFar = addOpening(d, { wallId: top.id, kind: 'window-single', offset: fromA(3), width: 0.6 })!;
    });
    const nearOffset = p.openings[doorNear].offset;
    const farOffset = p.openings[doorFar].offset;
    let newWall = '';
    p = edit(p, (d) => {
      const before = new Set(Object.keys(d.walls));
      splitWallAt(d, top.id, 2);
      newWall = Object.keys(d.walls).find((k) => !before.has(k))!;
    });
    expect(wallCount(p)).toBe(5);
    expect(p.openings[doorNear].wallId).toBe(top.id);
    expect(p.openings[doorNear].offset).toBeCloseTo(nearOffset);
    expect(p.openings[doorFar].wallId).toBe(newWall);
    expect(p.openings[doorFar].offset).toBeCloseTo(farOffset - 2);
  });

  it('never splits through an opening', () => {
    const top = Object.values(base.walls).find((w) => base.nodes[w.a].y === 0 && base.nodes[w.b].y === 0)!;
    let door = '';
    let p = edit(base, (d) => {
      door = addOpening(d, { wallId: top.id, kind: 'door-single', offset: 2, width: 1 })!;
    });
    p = edit(p, (d) => {
      splitWallAt(d, top.id, 2.2);
    });
    const o = p.openings[door];
    const w = p.walls[o.wallId];
    const len = dist(p.nodes[w.a], p.nodes[w.b]);
    expect(o.offset - o.width / 2).toBeGreaterThanOrEqual(-1e-9);
    expect(o.offset + o.width / 2).toBeLessThanOrEqual(len + 1e-9);
  });

  it('clamps openings near wall ends and junctions', () => {
    const top = Object.values(base.walls).find((w) => base.nodes[w.a].y === 0 && base.nodes[w.b].y === 0)!;
    let id = '';
    const p = edit(base, (d) => {
      id = addOpening(d, { wallId: top.id, kind: 'door-single', offset: 0, width: 0.9 })!;
    });
    const g = computeWallNetwork(p).walls.get(top.id)!;
    const o = p.openings[id];
    expect(o.offset - o.width / 2).toBeGreaterThanOrEqual(g.clearStart - 1e-9);
    const p2 = edit(p, (d) => updateOpening(d, id, { offset: 100 }));
    expect(p2.openings[id].offset + p2.openings[id].width / 2).toBeLessThanOrEqual(g.clearEnd + 1e-9);
  });

  it('cuts real gaps for multiple openings in one wall', () => {
    const top = Object.values(base.walls).find((w) => base.nodes[w.a].y === 0 && base.nodes[w.b].y === 0)!;
    const p = edit(base, (d) => {
      addOpening(d, { wallId: top.id, kind: 'door-single', offset: 1, width: 0.8 });
      addOpening(d, { wallId: top.id, kind: 'window-single', offset: 3, width: 0.8 });
    });
    const g = computeWallNetwork(p).walls.get(top.id)!;
    const solids = g.pieces.filter((x) => x.kind === 'solid');
    expect(solids).toHaveLength(3);
    expect(g.pieces.filter((x) => x.kind === 'below')).toHaveLength(1); // window sill
    expect(g.pieces.filter((x) => x.kind === 'above')).toHaveLength(2); // both lintels
    expect(g.planPieces).toHaveLength(3);
  });

  it('merges a dragged endpoint onto another node', () => {
    let p = edit(base, (d) => {
      addWallChain(d, [
        { x: 6, y: 0 },
        { x: 6, y: 3 },
      ], W);
    });
    const loose = Object.values(p.nodes).find((n) => n.x === 6 && n.y === 0)!;
    const target = Object.values(p.nodes).find((n) => n.x === 4 && n.y === 0)!;
    p = edit(p, (d) => {
      setNodePositions(d, { [loose.id]: { x: 4, y: 0 } });
      settleNode(d, loose.id);
    });
    expect(p.nodes[loose.id]).toBeUndefined();
    expect(Object.values(p.walls).filter((w) => w.a === target.id || w.b === target.id)).toHaveLength(3);
  });

  it('heals a split wall when the partition that required it is deleted', () => {
    let p = edit(base, (d) => {
      addWallChain(d, [
        { x: 2, y: 0 },
        { x: 2, y: 3 },
      ], W);
    });
    expect(wallCount(p)).toBe(7);
    const partition = Object.values(p.walls).find((w) => {
      const a = p.nodes[w.a];
      const b = p.nodes[w.b];
      return a.x === 2 && b.x === 2;
    })!;
    p = edit(p, (d) => deleteWalls(d, [partition.id]));
    expect(wallCount(p)).toBe(4);
    expect(detectRoomFaces(p)).toHaveLength(1);
  });

  it('deletes a room by removing only walls exclusive to it', () => {
    let p = edit(createEmptyProject(), (d) => {
      addRectangleWalls(d, { x: 0, y: 0 }, { x: 3, y: 3 }, W);
      addRectangleWalls(d, { x: 3, y: 0 }, { x: 6, y: 3 }, W);
    });
    const faces = detectRoomFaces(p);
    expect(faces).toHaveLength(2);
    const rightRoom = Object.values(p.rooms).find((r) => r.anchor.x > 3)!;
    p = edit(p, (d) => deleteEntities(d, [rightRoom.id]));
    expect(detectRoomFaces(p)).toHaveLength(1);
    expect(wallCount(p)).toBe(4);
  });
});

describe('room identity', () => {
  it('keeps room names when walls move', () => {
    let p = edit(createEmptyProject(), (d) => {
      addRectangleWalls(d, { x: 0, y: 0 }, { x: 4, y: 3 }, W);
    });
    const room = Object.values(p.rooms)[0];
    p = produce(p, (d) => {
      d.rooms[room.id].name = 'Kitchen';
    });
    const corner = Object.values(p.nodes).find((n) => n.x === 4 && n.y === 3)!;
    const corner2 = Object.values(p.nodes).find((n) => n.x === 4 && n.y === 0)!;
    p = edit(p, (d) =>
      setNodePositions(d, { [corner.id]: { x: 7, y: 3 }, [corner2.id]: { x: 7, y: 0 } }),
    );
    expect(Object.values(p.rooms)).toHaveLength(1);
    expect(Object.values(p.rooms)[0].name).toBe('Kitchen');
  });

  it('keeps the original record on the side containing its anchor when split', () => {
    let p = edit(createEmptyProject(), (d) => {
      addRectangleWalls(d, { x: 0, y: 0 }, { x: 6, y: 3 }, W);
    });
    const room = Object.values(p.rooms)[0];
    p = produce(p, (d) => {
      d.rooms[room.id].name = 'Living';
    });
    p = edit(p, (d) => {
      addWallChain(d, [
        { x: 1, y: 0 },
        { x: 1, y: 3 },
      ], W);
    });
    const rooms = Object.values(p.rooms);
    expect(rooms).toHaveLength(2);
    expect(rooms.find((r) => r.name === 'Living')).toBeDefined();
  });
});

describe('history', () => {
  it('undoes and redoes commands and clears redo after a new edit', () => {
    const store = useProjectStore.getState();
    store.load(createEmptyProject());
    store.execute('Draw room', (d) => addRectangleWalls(d, { x: 0, y: 0 }, { x: 4, y: 3 }, W));
    expect(wallCount(useProjectStore.getState().project!)).toBe(4);
    expect(Object.keys(useProjectStore.getState().project!.rooms)).toHaveLength(1);
    useProjectStore.getState().undo();
    expect(wallCount(useProjectStore.getState().project!)).toBe(0);
    useProjectStore.getState().redo();
    expect(wallCount(useProjectStore.getState().project!)).toBe(4);
    useProjectStore.getState().undo();
    useProjectStore.getState().execute('Wall', (d) =>
      addWallChain(d, [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ], W),
    );
    expect(useProjectStore.getState().future).toHaveLength(0);
  });

  it('collapses a drag gesture into one undo step', () => {
    const store = useProjectStore.getState();
    store.load(createEmptyProject());
    store.execute('Draw room', (d) => addRectangleWalls(d, { x: 0, y: 0 }, { x: 4, y: 3 }, W));
    const p0 = useProjectStore.getState().project!;
    const n = Object.values(p0.nodes)[0];
    useProjectStore.getState().begin('Move node');
    for (let i = 1; i <= 20; i++) {
      useProjectStore.getState().preview((d) => setNodePositions(d, { [n.id]: { x: n.x - i * 0.01, y: n.y } }));
    }
    useProjectStore.getState().commit();
    expect(useProjectStore.getState().past).toHaveLength(2);
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().project!.nodes[n.id].x).toBe(n.x);
  });
});

describe('schema', () => {
  it('validates a project round-trip through JSON', () => {
    const p = edit(createEmptyProject({ name: 'Test' }), (d) => {
      addRectangleWalls(d, { x: 0, y: 0 }, { x: 4, y: 3 }, W);
    });
    const parsed = ProjectSchema.safeParse(JSON.parse(JSON.stringify(p)));
    expect(parsed.success).toBe(true);
  });

  it('rejects invalid geometry values', () => {
    const p = createEmptyProject();
    const bad = { ...p, nodes: { n_1: { id: 'n_1', x: 'nope', y: 0 } } };
    expect(ProjectSchema.safeParse(bad).success).toBe(false);
  });
});

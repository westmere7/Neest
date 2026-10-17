import { produce } from 'immer';
import type { Project, RoomType, Vec2 } from '@/domain/model/schema';
import { createEmptyProject } from '@/domain/model/defaults';
import { assignMaterial, reconcileRooms } from '@/domain/commands/entities';
import { addWallChain, updateWalls } from '@/domain/commands/walls';
import { detectRoomFaces, pointInFace } from '@/domain/geometry/rooms';
import { opening, paintWallFacing, placeFurniture, wallAt, type Furn } from './sampleHelpers';

const H = 0.125; // half the exterior wall thickness
const K = H * (Math.SQRT2 - 1); // centreline shift where the 45° chamfer meets the orthogonal walls
const EXT = { thickness: 0.25, height: 3.0, role: 'exterior' as const };
const INT = { thickness: 0.1, height: 2.6, role: 'interior' as const };

const R = Math.PI;
const DOWN = 0; // front faces +y (backs onto a wall at the top of the plan)
const UP = R; // front faces -y
const LEFT = -R / 2; // front faces +x (backs onto a wall on the left)
const RIGHT = R / 2; // front faces -x

/**
 * Stress-test sample: a ≈100 m² open-plan loft with an irregular shell
 * (curved bay, 45° chamfered corner), an angled bathroom pod, walk-in
 * closet, pantry, a half-height wall, crossing low dividers, a curved glass
 * partition, 16 openings (three on the curved wall) and ~120 furnishings.
 * Clear inside outline: 12.5 × 8.0 m plus a 1 m-deep curved bay, minus a
 * 1.5 m chamfer — about 101.5 m² gross.
 */
export function buildLoftProject(): Project {
  const base = createEmptyProject({ name: 'Complex loft 100 m² (stress test)', wallHeight: 3.0 });
  return produce(base, (d) => {
    // ── Shell (centrelines sit half a wall outside the clear outline) ──
    addWallChain(
      d,
      [
        { x: -H, y: -H },
        { x: 3.2, y: -H },
        { x: 7.2, y: -H },
        { x: 12.5 + H, y: -H },
        { x: 12.5 + H, y: 6.5 + K },
        { x: 11.0 + K, y: 8.0 + H },
        { x: -H, y: 8.0 + H },
      ],
      { ...EXT, closed: true, curves: [null, { x: 5.2, y: -H - 2.0 }, null, null, null, null, null] },
    );

    // ── Partitions ──
    // Bathroom pod with an angled entrance corner.
    addWallChain(d, [{ x: -H, y: 5.3 }, { x: 2.4, y: 5.3 }, { x: 3.0, y: 5.9 }, { x: 3.0, y: 8.0 + H }], INT);
    // Walk-in closet (starts on the bathroom wall: T-junction).
    addWallChain(d, [{ x: 3.0, y: 6.1 }, { x: 4.6, y: 6.1 }, { x: 4.6, y: 8.0 + H }], INT);
    // Pantry & laundry in the top-right corner.
    addWallChain(d, [{ x: 10.9, y: -H }, { x: 10.9, y: 1.6 }, { x: 12.5 + H, y: 1.6 }], INT);
    // Half-height headboard wall (dangling stub).
    addWallChain(d, [{ x: -H, y: 3.6 }, { x: 1.8, y: 3.6 }], { ...INT, height: 1.2 });
    // Crossing low dividers (creates a free-standing junction).
    addWallChain(d, [{ x: 6.4, y: 5.7 }, { x: 8.4, y: 5.7 }], { ...INT, height: 1.1, thickness: 0.08 });
    addWallChain(d, [{ x: 7.4, y: 4.9 }, { x: 7.4, y: 6.5 }], { ...INT, height: 1.1, thickness: 0.08 });
    // Curved frosted-glass partition around the office nook (free end leaves an entrance).
    addWallChain(d, [{ x: 9.0, y: 8.0 + H }, { x: 11.3, y: 4.6 }], {
      thickness: 0.06,
      height: 2.2,
      role: 'partition',
      curves: [{ x: 9.0, y: 4.6 }],
      materials: { left: 'glass-frosted', right: 'glass-frosted', top: 'metal-black-matte' },
    });
    reconcileRooms(d);

    // ── Openings ──
    const top = (x: number) => ({ x, y: -H });
    const bottom = (x: number) => ({ x, y: 8.0 + H });
    const left = (y: number) => ({ x: -H, y });
    const right = (y: number) => ({ x: 12.5 + H, y });
    opening(d, bottom(6.2), { kind: 'door-single', width: 1.0, swingSide: 'right', hinge: 'start' }); // entry
    opening(d, { x: 1.7, y: 5.3 }, { kind: 'door-single', width: 0.8, swingSide: 'right' }); // bathroom
    opening(d, { x: 3.8, y: 6.1 }, { kind: 'door-single', width: 0.8, swingSide: 'right' }); // closet
    opening(d, { x: 10.9, y: 0.9 }, { kind: 'door-single', width: 0.7, swingSide: 'left' }); // pantry
    // Bay windows on the curved wall (points on the Bézier centreline at t = 0.2, 0.5, 0.8).
    opening(d, { x: 4.0, y: -0.765 }, { kind: 'window-single', width: 0.8, height: 1.6, sillHeight: 0.7 });
    opening(d, { x: 5.2, y: -1.125 }, { kind: 'window-fixed', width: 1.2, height: 1.9, sillHeight: 0.5 });
    opening(d, { x: 6.4, y: -0.765 }, { kind: 'window-single', width: 0.8, height: 1.6, sillHeight: 0.7 });
    opening(d, top(1.6), { kind: 'window-double', width: 1.3, height: 1.5, sillHeight: 0.95 });
    opening(d, top(8.8), { kind: 'window-double', width: 1.4, height: 1.6, sillHeight: 0.9 });
    opening(d, top(11.7), { kind: 'window-single', width: 0.6, height: 0.9, sillHeight: 1.3 });
    opening(d, right(4.0), { kind: 'window-double', width: 1.2, height: 1.2, sillHeight: 1.2 });
    opening(d, right(5.6), { kind: 'window-single', width: 0.8, height: 1.4, sillHeight: 0.9 });
    opening(d, { x: (12.5 + H + 11.0 + K) / 2, y: (6.5 + K + 8.0 + H) / 2 }, { kind: 'window-fixed', width: 1.2, height: 1.8, sillHeight: 0.6 });
    opening(d, bottom(1.5), { kind: 'window-single', width: 0.6, height: 0.8, sillHeight: 1.4 });
    opening(d, bottom(8.6), { kind: 'window-double', width: 1.2, height: 1.5, sillHeight: 0.9 });
    opening(d, left(4.45), { kind: 'window-double', width: 1.0, height: 1.4, sillHeight: 0.9 });

    // ── Rooms & finishes ──
    const rooms: { p: Vec2; name: string; type: RoomType; floor: string }[] = [
      { p: { x: 6.0, y: 3.0 }, name: 'Loft', type: 'living', floor: 'wood-herringbone' },
      { p: { x: 1.2, y: 6.6 }, name: 'Bathroom', type: 'bathroom', floor: 'tile-terrazzo' },
      { p: { x: 3.8, y: 7.2 }, name: 'Walk-in closet', type: 'storage', floor: 'wood-oak-light' },
      { p: { x: 11.7, y: 0.8 }, name: 'Pantry & laundry', type: 'laundry', floor: 'tile-checker' },
    ];
    const faces = detectRoomFaces(d as Project);
    for (const spec of rooms) {
      const face = faces.find((f) => pointInFace(spec.p, f));
      const room = face && Object.values(d.rooms).find((r) => pointInFace(r.anchor, face));
      if (!room) continue;
      room.name = spec.name;
      room.type = spec.type;
      assignMaterial(d, [{ kind: 'room-floor', roomId: room.id }], spec.floor);
    }
    paintWallFacing(d, left(1.95), { x: 1, y: 1.95 }, 'paint-deep-teal'); // bed wall
    paintWallFacing(d, { x: 3.8, y: 6.1 }, { x: 3.8, y: 7 }, 'paint-sage-teal'); // closet
    paintWallFacing(d, { x: 4.6, y: 7.0 }, { x: 3.8, y: 7 }, 'paint-sage-teal');
    paintWallFacing(d, { x: 1.0, y: 5.3 }, { x: 1.0, y: 6.5 }, 'tile-zellige-green'); // bathroom
    paintWallFacing(d, left(6.6), { x: 1.0, y: 6.6 }, 'tile-zellige-green');
    paintWallFacing(d, right(3.3), { x: 11, y: 3.3 }, 'tile-subway-white'); // kitchen
    const stub = wallAt(d, { x: 1.0, y: 3.6 });
    if (stub) updateWalls(d, [stub.wallId], { materials: { left: 'wood-walnut', right: 'wood-walnut', top: 'wood-walnut' } });

    // ── Furnishings ──
    const olive = { upholstery: 'fabric-olive' };
    const items: Furn[] = [
      // Sleeping zone
      { asset: 'rug-rect', x: 1.5, y: 1.95, rot: RIGHT, w: 2.8, d: 2.0 },
      { asset: 'bed-king', x: 1.07, y: 1.95, rot: LEFT },
      { asset: 'bedside-table', x: 0.205, y: 0.745, rot: LEFT },
      { asset: 'bedside-table', x: 0.205, y: 3.155, rot: LEFT },
      { asset: 'table-lamp', x: 0.21, y: 0.745, rot: LEFT },
      { asset: 'table-lamp', x: 0.21, y: 3.155, rot: LEFT },
      { asset: 'bench', x: 2.37, y: 1.95, rot: LEFT },
      { asset: 'dresser', x: 1.6, y: 0.245, rot: DOWN },
      { asset: 'vase', x: 1.3, y: 0.25, rot: DOWN, w: 0.2, d: 0.2, h: 0.4, elevation: 0.85 },
      { asset: 'books-stack', x: 1.9, y: 0.25, rot: DOWN, elevation: 0.85 },
      { asset: 'artwork-framed', x: 0.02, y: 1.95, rot: LEFT, w: 1.4, h: 0.7, elevation: 1.35 },
      { asset: 'wall-sconce', x: 0.1, y: 0.745, rot: LEFT },
      { asset: 'wall-sconce', x: 0.1, y: 3.155, rot: LEFT },
      { asset: 'air-conditioner', x: 0.5, y: 0.115, rot: DOWN },
      { asset: 'plant-large', x: 2.6, y: 0.55 },
      { asset: 'plant-potted', x: 2.55, y: 3.3 },
      { asset: 'partition-slatted', x: 3.0, y: 2.6, rot: RIGHT },
      { asset: 'ceiling-light', x: 1.5, y: 1.9 },
      // Reading corner behind the half-height wall
      { asset: 'armchair', x: 0.555, y: 4.45, rot: LEFT, materials: olive },
      { asset: 'radiator', x: 0.055, y: 4.45, rot: LEFT },
      { asset: 'side-table', x: 1.25, y: 4.95, materials: { base: 'metal-brass', top: 'stone-marble-carrara' } },
      { asset: 'floor-lamp', x: 1.25, y: 3.95 },
      { asset: 'artwork-framed', x: 0.75, y: 5.235, rot: UP, elevation: 1.4 },
      // Living with curved bay
      { asset: 'rug-rect', x: 5.2, y: 2.6, w: 3.2, d: 2.4, materials: { rug: 'rug-wool-cream' } },
      { asset: 'sofa-corner-l', x: 5.4, y: 3.95, rot: UP },
      { asset: 'coffee-table', x: 5.2, y: 2.45 },
      { asset: 'books-stack', x: 4.95, y: 2.45, elevation: 0.4 },
      { asset: 'vase', x: 5.5, y: 2.45, w: 0.2, d: 0.2, h: 0.35, elevation: 0.4 },
      { asset: 'armchair', x: 3.75, y: 2.2, rot: LEFT - 0.35, materials: olive },
      { asset: 'armchair', x: 6.75, y: 2.0, rot: RIGHT + 0.35, materials: olive },
      { asset: 'side-table', x: 3.75, y: 3.05, materials: { base: 'metal-brass' } },
      { asset: 'pouf-round', x: 4.2, y: 1.2 },
      { asset: 'floor-lamp', x: 7.0, y: 2.85 },
      { asset: 'tv-stand', x: 5.2, y: -0.4, rot: DOWN },
      { asset: 'tv-wall', x: 5.2, y: -0.45, rot: DOWN, elevation: 0.82 },
      { asset: 'soundbar', x: 5.2, y: -0.33, rot: DOWN, elevation: 0.8 },
      { asset: 'speaker-floor', x: 4.3, y: -0.3, rot: DOWN },
      { asset: 'speaker-floor', x: 6.1, y: -0.3, rot: DOWN },
      { asset: 'plant-potted', x: 3.55, y: 0.25 },
      { asset: 'plant-potted', x: 6.85, y: 0.25 },
      { asset: 'cushion', x: 4.8, y: 4.1, rot: UP },
      { asset: 'cushion', x: 5.6, y: 4.1, rot: UP },
      { asset: 'cushion', x: 6.3, y: 4.2, rot: UP },
      { asset: 'throw-blanket', x: 4.4, y: 3.6, elevation: 0.45 },
      { asset: 'ceiling-light', x: 5.2, y: 2.6 },
      { asset: 'partition-glass', x: 7.25, y: 1.2, rot: RIGHT },
      // Dining
      { asset: 'dining-table-rect', x: 8.6, y: 2.2, w: 1.8, d: 0.95 },
      { asset: 'dining-chair', x: 8.0, y: 1.445, rot: DOWN },
      { asset: 'dining-chair', x: 8.6, y: 1.445, rot: DOWN },
      { asset: 'dining-chair', x: 9.2, y: 1.445, rot: DOWN },
      { asset: 'dining-chair', x: 8.0, y: 2.955, rot: UP },
      { asset: 'dining-chair', x: 8.6, y: 2.955, rot: UP },
      { asset: 'dining-chair', x: 9.2, y: 2.955, rot: UP },
      { asset: 'pendant-linear', x: 8.6, y: 2.2 },
      { asset: 'sideboard', x: 8.0, y: 0.23 },
      { asset: 'vase', x: 7.5, y: 0.23, w: 0.25, d: 0.25, h: 0.5, elevation: 0.78 },
      { asset: 'plant-large', x: 10.4, y: 0.5 },
      { asset: 'column-round', x: 9.5, y: 0.9, h: 3.0 },
      { asset: 'column-square', x: 7.4, y: 4.5, h: 3.0 },
      // Kitchen along the right wall + island
      { asset: 'fridge', x: 12.145, y: 2.05, rot: RIGHT },
      { asset: 'kitchen-oven-tower', x: 12.195, y: 2.7, rot: RIGHT },
      { asset: 'kitchen-cooktop', x: 12.195, y: 3.3, rot: RIGHT },
      { asset: 'kitchen-sink-unit', x: 12.195, y: 4.0, rot: RIGHT },
      { asset: 'dishwasher', x: 12.195, y: 4.7, rot: RIGHT },
      { asset: 'kitchen-wall-cabinet', x: 12.32, y: 3.3, rot: RIGHT },
      { asset: 'kitchen-island', x: 10.4, y: 3.6, rot: RIGHT },
      { asset: 'bar-stool', x: 9.7, y: 3.1, rot: LEFT },
      { asset: 'bar-stool', x: 9.7, y: 3.6, rot: LEFT },
      { asset: 'bar-stool', x: 9.7, y: 4.1, rot: LEFT },
      { asset: 'pendant-lamp', x: 10.4, y: 3.2 },
      { asset: 'pendant-lamp', x: 10.4, y: 4.0 },
      { asset: 'vase', x: 10.4, y: 3.6, w: 0.25, d: 0.25, h: 0.45, elevation: 0.92 },
      // Pantry & laundry
      { asset: 'shelving-unit', x: 12.295, y: 0.8, rot: RIGHT },
      { asset: 'washing-machine', x: 11.3, y: 0.305 },
      { asset: 'generic-wall-cabinet', x: 11.3, y: 0.155, elevation: 1.4 },
      { asset: 'ceiling-light', x: 11.7, y: 0.8 },
      // Office nook behind the curved glass
      { asset: 'desk-l-shaped', x: 11.4, y: 6.0, rot: UP },
      { asset: 'office-chair', x: 11.4, y: 4.95, rot: DOWN },
      { asset: 'monitor', x: 11.4, y: 6.2, rot: UP },
      { asset: 'task-lamp', x: 12.0, y: 6.3, rot: UP },
      { asset: 'filing-cabinet', x: 10.4, y: 6.9 },
      { asset: 'bookcase', x: 9.9, y: 7.835, rot: UP },
      { asset: 'books-stack', x: 9.75, y: 7.85, rot: UP, elevation: 1.2 },
      { asset: 'floor-fan', x: 10.8, y: 7.5 },
      { asset: 'curtains', x: 12.41, y: 5.6, rot: RIGHT, w: 1.2 },
      { asset: 'ceiling-light', x: 11.0, y: 6.2 },
      { asset: 'air-conditioner', x: 12.385, y: 7.0 - 0.2, rot: RIGHT },
      // Entry
      { asset: 'shoe-cabinet', x: 5.15, y: 7.875, rot: UP },
      { asset: 'wall-shelf', x: 5.15, y: 7.875, rot: UP, elevation: 1.45 },
      { asset: 'artwork-framed', x: 5.15, y: 7.985, rot: UP, elevation: 1.75 },
      { asset: 'plant-large', x: 7.6, y: 7.3 },
      { asset: 'radiator', x: 8.6, y: 7.945, rot: UP },
      { asset: 'wall-sconce', x: 6.95, y: 7.9, rot: UP },
      { asset: 'ceiling-light', x: 6.2, y: 7.2 },
      { asset: 'rug-round', x: 6.2, y: 6.9, w: 1.2, d: 1.2 },
      // Bathroom pod
      { asset: 'bathtub', x: 0.86, y: 7.62, rot: UP },
      { asset: 'shower-tray', x: 0.455, y: 5.805 },
      { asset: 'toilet', x: 0.345, y: 6.75, rot: LEFT },
      { asset: 'vanity-basin', x: 2.705, y: 6.8, rot: RIGHT },
      { asset: 'bathroom-mirror', x: 2.935, y: 6.8, rot: RIGHT },
      { asset: 'towel-rail', x: 2.9, y: 7.6, rot: RIGHT },
      { asset: 'plant-potted', x: 2.1, y: 7.75, w: 0.3, d: 0.3, h: 0.6 },
      { asset: 'ceiling-light', x: 1.5, y: 6.6 },
      // Walk-in closet
      { asset: 'wardrobe', x: 4.245, y: 7.3, rot: RIGHT },
      { asset: 'drawer-unit', x: 3.33, y: 7.7, rot: LEFT },
      { asset: 'ceiling-light', x: 3.8, y: 7.1 },
      // Extra lighting across the loft
      { asset: 'ceiling-light', x: 3.8, y: 4.4 },
      { asset: 'ceiling-light', x: 9.0, y: 4.6 },
      { asset: 'ceiling-light', x: 8.6, y: 6.6 },
      { asset: 'wall-sconce', x: 12.4, y: 1.9, rot: RIGHT },
    ];
    placeFurniture(d, items);

    d.render.wallDisplay = 'cutaway';
    d.render.cutawayHeight = 1.4;
    d.cameras.push(
      { id: 'cam_overview', name: 'Overview', projection: 'perspective', position: [13.6, 13.2, 15.4], target: [6.2, 0, 3.8], fov: 45, zoom: 1, wallDisplay: 'cutaway' },
      { id: 'cam_bay', name: 'Living bay', projection: 'perspective', position: [5.6, 1.5, 5.5], target: [5.0, 1.0, -0.6], fov: 62, zoom: 1, wallDisplay: 'full' },
      { id: 'cam_kitchen', name: 'Kitchen & dining', projection: 'perspective', position: [6.4, 1.6, 4.6], target: [11.5, 1.0, 2.6], fov: 60, zoom: 1, wallDisplay: 'full' },
      { id: 'cam_office', name: 'Office nook', projection: 'perspective', position: [8.4, 1.6, 6.2], target: [12.0, 1.0, 6.6], fov: 60, zoom: 1, wallDisplay: 'full' },
      { id: 'cam_bed', name: 'Sleeping area', projection: 'perspective', position: [3.9, 1.6, 3.4], target: [0.4, 0.9, 1.6], fov: 62, zoom: 1, wallDisplay: 'full' },
    );
    d.guest.startCameraId = 'cam_overview';
    d.guest.spawn = { x: 6.2, y: 7.3 };
    d.guest.spawnAngle = -Math.PI / 2;
  });
}

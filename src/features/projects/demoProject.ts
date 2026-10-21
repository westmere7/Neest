import { produce } from 'immer';
import type { Project, RoomType, Vec2 } from '@/domain/model/schema';
import { createEmptyProject } from '@/domain/model/defaults';
import { assignMaterial, reconcileRooms } from '@/domain/commands/entities';
import { addRectangleWalls, addWallChain } from '@/domain/commands/walls';
import { detectRoomFaces, pointInFace } from '@/domain/geometry/rooms';
import { buildWallPath, projectOnPath } from '@/domain/geometry/wallPath';
import { opening, paintWallFacing, placeFurniture, type Furn } from './sampleHelpers';
import { buildLoftProject } from './loftProject';
import { buildGrandApartmentProject } from './grandApartmentProject';

const EXT = { thickness: 0.25, height: 2.7, role: 'exterior' as const };
const INT = { thickness: 0.12, height: 2.7, role: 'interior' as const };

/**
 * A furnished two-bedroom apartment (~80 m²) built entirely through the
 * command layer, so it is a normal editable project — not a static image.
 */
export function buildDemoProject(): Project {
  const base = createEmptyProject({ name: 'Sample apartment' });
  return produce(base, (d) => {
    // Shell.
    addRectangleWalls(d, { x: 0, y: 0 }, { x: 11, y: 8 }, EXT);
    // Partitions.
    addWallChain(d, [{ x: 4.2, y: 0 }, { x: 4.2, y: 6 }], INT);
    addWallChain(d, [{ x: 0, y: 4.4 }, { x: 4.2, y: 4.4 }], INT);
    addWallChain(d, [{ x: 2.6, y: 4.4 }, { x: 2.6, y: 8 }], INT);
    addWallChain(d, [{ x: 2.6, y: 6 }, { x: 4.2, y: 6 }], INT);
    addWallChain(d, [{ x: 4.2, y: 5 }, { x: 11, y: 5 }], INT);
    addWallChain(d, [{ x: 7.6, y: 5 }, { x: 7.6, y: 8 }], INT);
    reconcileRooms(d);

    // Doors.
    opening(d, { x: 5.9, y: 8 }, { kind: 'door-single', width: 1.0, swingSide: 'right', hinge: 'end' });
    opening(d, { x: 4.2, y: 3.7 }, { kind: 'door-single', width: 0.85, swingSide: 'right', hinge: 'end' });
    opening(d, { x: 2.6, y: 7.0 }, { kind: 'door-single', width: 0.8, swingSide: 'right' });
    opening(d, { x: 3.4, y: 6 }, { kind: 'door-single', width: 0.7, swingSide: 'right' });
    opening(d, { x: 5.9, y: 5 }, { kind: 'passage', width: 1.3 });
    opening(d, { x: 7.6, y: 5.8 }, { kind: 'door-single', width: 0.85, swingSide: 'left' });
    // Windows.
    opening(d, { x: 6.2, y: 0 }, { kind: 'window-double', width: 1.4, height: 1.5, sillHeight: 0.8 });
    opening(d, { x: 9.3, y: 0 }, { kind: 'window-double', width: 1.4, height: 1.5, sillHeight: 0.8 });
    opening(d, { x: 11, y: 2.4 }, { kind: 'door-sliding', width: 2.0 });
    opening(d, { x: 2.1, y: 0 }, { kind: 'window-double', width: 1.3, height: 1.4, sillHeight: 0.85 });
    opening(d, { x: 0, y: 2.2 }, { kind: 'window-single', width: 0.8, height: 1.3, sillHeight: 0.9 });
    opening(d, { x: 0, y: 6.3 }, { kind: 'window-single', width: 0.6, height: 0.8, sillHeight: 1.4 });
    opening(d, { x: 11, y: 6.5 }, { kind: 'window-double', width: 1.2, height: 1.4, sillHeight: 0.85 });
    opening(d, { x: 9.3, y: 8 }, { kind: 'window-single', width: 0.9, height: 1.4, sillHeight: 0.85 });

    // Name and finish the detected rooms.
    const rooms: { p: Vec2; name: string; type: RoomType; floor: string; wall?: string }[] = [
      { p: { x: 2, y: 2 }, name: 'Main bedroom', type: 'bedroom', floor: 'wood-oak-wide', wall: 'paint-sage' },
      { p: { x: 7, y: 2 }, name: 'Living & kitchen', type: 'living', floor: 'wood-herringbone' },
      { p: { x: 1.3, y: 6 }, name: 'Bathroom', type: 'bathroom', floor: 'tile-terrazzo', wall: 'tile-subway-white' },
      { p: { x: 3.4, y: 5.2 }, name: 'Storage', type: 'storage', floor: 'laminate-grey' },
      { p: { x: 5.9, y: 7 }, name: 'Hallway', type: 'hall', floor: 'wood-oak-natural' },
      { p: { x: 9.3, y: 6.5 }, name: 'Bedroom', type: 'bedroom', floor: 'wood-oak-wide', wall: 'paint-dusty-blue' },
    ];
    const faces = detectRoomFaces(d as Project);
    for (const spec of rooms) {
      const room = Object.values(d.rooms).find((r) => {
        const f = faces.find((x) => pointInFace(r.anchor, x));
        return f && pointInFace(spec.p, f);
      });
      if (!room) continue;
      room.name = spec.name;
      room.type = spec.type;
      assignMaterial(d, [{ kind: 'room-floor', roomId: room.id }], spec.floor);
      if (spec.wall) {
        const face = faces.find((x) => pointInFace(spec.p, x));
        if (face) {
          // Paint the wall sides facing into this room.
          for (const wid of face.wallIds) {
            const w = d.walls[wid];
            const path = buildWallPath(d.nodes[w.a], d.nodes[w.b], w.curve, w.curveEnd);
            const proj = projectOnPath(path, spec.p);
            const n = { x: proj.tangent.y, y: -proj.tangent.x };
            const side = (spec.p.x - proj.point.x) * n.x + (spec.p.y - proj.point.y) * n.y >= 0 ? 'left' : 'right';
            assignMaterial(d, [{ kind: 'wall-side', wallId: wid, side }], spec.wall);
          }
        }
      }
    }

    // Furniture (only assets present in the catalogue are placed).
    const R = Math.PI;
    const furniture: Furn[] = [
      // Living
      { asset: 'rug-rect', x: 6.0, y: 3.2, w: 2.4, d: 1.7 },
      { asset: 'sofa-3-seat', x: 6.0, y: 4.45, rot: R },
      { asset: 'coffee-table', x: 6.0, y: 3.25 },
      { asset: 'armchair', x: 4.95, y: 2.6, rot: -R / 2 - 0.35 },
      { asset: 'media-console', x: 6.0, y: 0.38 },
      { asset: 'tv-wall', x: 6.0, y: 0.18, materials: {} },
      { asset: 'floor-lamp', x: 7.35, y: 4.5 },
      { asset: 'plant-large', x: 4.65, y: 4.5 },
      // Kitchen & dining
      { asset: 'kitchen-base-cabinet', x: 8.45, y: 0.43, w: 0.6 },
      { asset: 'kitchen-sink-unit', x: 9.25, y: 0.43 },
      { asset: 'kitchen-base-cabinet', x: 10.05, y: 0.43, w: 0.6 },
      { asset: 'kitchen-cooktop', x: 10.53, y: 1.35, rot: R / 2 },
      { asset: 'fridge', x: 10.5, y: 3.3, rot: R / 2 },
      { asset: 'kitchen-island', x: 9.3, y: 2.25 },
      { asset: 'bar-stool', x: 8.85, y: 2.95, rot: R },
      { asset: 'bar-stool', x: 9.75, y: 2.95, rot: R },
      { asset: 'dining-table-round', x: 8.6, y: 4.05 },
      { asset: 'dining-chair', x: 8.6, y: 3.45 },
      { asset: 'dining-chair', x: 8.0, y: 4.1, rot: -R / 2 },
      { asset: 'dining-chair', x: 9.2, y: 4.1, rot: R / 2 },
      { asset: 'pendant-lamp', x: 8.6, y: 4.05 },
      // Main bedroom
      { asset: 'bed-queen', x: 2.1, y: 3.2, rot: R },
      { asset: 'bedside-table', x: 1.05, y: 3.95, rot: R },
      { asset: 'bedside-table', x: 3.15, y: 3.95, rot: R },
      { asset: 'wardrobe', x: 0.43, y: 1.2, rot: R / 2 },
      { asset: 'rug-round', x: 2.1, y: 1.4 },
      { asset: 'armchair', x: 3.5, y: 0.75, rot: R },
      // Bathroom
      { asset: 'bathtub', x: 0.5, y: 6.4, rot: R / 2 },
      { asset: 'toilet', x: 2.2, y: 7.55, rot: R },
      { asset: 'vanity-basin', x: 1.55, y: 4.73 },
      { asset: 'towel-rail', x: 2.45, y: 5.4, rot: -R / 2 },
      // Bedroom 2
      { asset: 'bed-single', x: 10.35, y: 6.6, rot: R / 2 },
      { asset: 'desk', x: 8.4, y: 7.55, rot: R },
      { asset: 'branded-tech-vn:sihoo-m57', x: 8.4, y: 7.0 },
      { asset: 'bookcase', x: 7.85, y: 6.6, rot: -R / 2 },
      // Hall
      { asset: 'shoe-cabinet', x: 4.55, y: 7.6, rot: R },
      { asset: 'plant-potted', x: 7.2, y: 7.6 },
    ];
    placeFurniture(d, furniture);

    d.cameras.push(
      {
        id: 'cam_overview',
        name: 'Overview',
        projection: 'perspective',
        position: [14.5, 13, 17],
        target: [5.5, 0, 4],
        fov: 45,
        zoom: 1,
        wallDisplay: null,
      },
      {
        id: 'cam_living',
        name: 'Living room',
        projection: 'perspective',
        position: [4.75, 1.6, 0.9],
        target: [10.2, 0.85, 3.6],
        fov: 60,
        zoom: 1,
        wallDisplay: 'full',
      },
    );
    d.guest.startCameraId = 'cam_overview';
    d.guest.spawn = { x: 5.9, y: 7.3 };
    d.guest.spawnAngle = -Math.PI / 2;
  });
}

/**
 * A single 9.00 × 4.50 m studio (clear inside dimensions, 40.5 m²), furnished
 * in three zones: sleeping (left), living (centre), kitchen & dining (right).
 * Exterior walls are 25 cm thick; their centrelines sit 12.5 cm outside the
 * clear room so the measured floor area is exactly 9 × 4.5 m.
 */
export function buildStudioProject(): Project {
  const base = createEmptyProject({ name: 'Studio room 9 × 4.5 m' });
  const h = EXT.thickness / 2;
  return produce(base, (d) => {
    addRectangleWalls(d, { x: -h, y: -h }, { x: 9 + h, y: 4.5 + h }, EXT);
    reconcileRooms(d);
    const top = (x: number) => ({ x, y: -h });
    const bottom = (x: number) => ({ x, y: 4.5 + h });
    const right = (y: number) => ({ x: 9 + h, y });

    // Openings.
    opening(d, bottom(7.6), { kind: 'door-single', width: 0.9, swingSide: 'right', hinge: 'start' });
    opening(d, top(1.0), { kind: 'window-double', width: 1.4, height: 1.4, sillHeight: 0.9 });
    opening(d, top(6.9), { kind: 'window-fixed', width: 2.0, height: 1.7, sillHeight: 0.6 });
    opening(d, bottom(4.85), { kind: 'window-double', width: 1.6, height: 1.4, sillHeight: 0.9 });
    opening(d, right(1.7), { kind: 'window-single', width: 0.8, height: 1.0, sillHeight: 1.2 });

    // Room record and finishes.
    const room = Object.values(d.rooms)[0];
    if (room) {
      room.name = 'Studio';
      room.type = 'living';
      assignMaterial(d, [{ kind: 'room-floor', roomId: room.id }], 'wood-oak-wide');
    }
    paintWallFacing(d, { x: -h, y: 2.25 }, { x: 1, y: 2.25 }, 'paint-sage');
    paintWallFacing(d, right(2.25), { x: 8, y: 2.25 }, 'tile-subway-white');

    const R = Math.PI;
    const LEFT = -R / 2; // front faces +x (backs onto the left wall)
    const RIGHT = R / 2; // front faces -x (backs onto the right wall)
    placeFurniture(d, [
      // Sleeping zone (x 0–3.1)
      { asset: 'rug-rect', x: 1.5, y: 2.25, rot: RIGHT, w: 2.6, d: 1.8 },
      { asset: 'bed-queen', x: 1.07, y: 2.25, rot: LEFT },
      { asset: 'bedside-table', x: 0.205, y: 1.145, rot: LEFT },
      { asset: 'bedside-table', x: 0.205, y: 3.355, rot: LEFT },
      { asset: 'table-lamp', x: 0.21, y: 1.145, rot: LEFT },
      { asset: 'table-lamp', x: 0.21, y: 3.355, rot: LEFT },
      { asset: 'artwork-framed', x: 0.02, y: 2.25, rot: LEFT, w: 1.2, h: 0.6 },
      { asset: 'wardrobe', x: 2.6, y: 0.305 },
      { asset: 'curtains', x: 1.0, y: 0.095, w: 1.8 },
      { asset: 'dresser', x: 2.0, y: 4.255, rot: R },
      { asset: 'ceiling-light', x: 1.5, y: 2.25 },
      // Living zone (x 3.2–6.0)
      { asset: 'bookcase', x: 3.65, y: 0.165 },
      { asset: 'media-console', x: 5.05, y: 0.215 },
      { asset: 'tv-wall', x: 5.05, y: 0.035 },
      { asset: 'rug-rect', x: 4.85, y: 2.9, w: 2.4, d: 1.7 },
      { asset: 'sofa-3-seat', x: 4.85, y: 4.035, rot: R },
      { asset: 'coffee-table', x: 4.85, y: 2.85 },
      { asset: 'armchair', x: 3.55, y: 2.35, rot: -R / 2 - 0.35 },
      { asset: 'plant-large', x: 3.1, y: 4.05 },
      { asset: 'floor-lamp', x: 6.2, y: 4.2 },
      { asset: 'ceiling-light', x: 4.85, y: 2.3 },
      // Kitchen along the right wall (x 8.4–9)
      { asset: 'fridge', x: 8.645, y: 0.355, rot: RIGHT },
      { asset: 'kitchen-base-cabinet', x: 8.695, y: 1.0, rot: RIGHT },
      { asset: 'kitchen-sink-unit', x: 8.695, y: 1.7, rot: RIGHT },
      { asset: 'dishwasher', x: 8.695, y: 2.4, rot: RIGHT },
      { asset: 'kitchen-cooktop', x: 8.695, y: 3.0, rot: RIGHT },
      { asset: 'kitchen-base-cabinet', x: 8.695, y: 3.6, rot: RIGHT },
      { asset: 'kitchen-wall-cabinet', x: 8.82, y: 2.4, rot: RIGHT },
      { asset: 'kitchen-wall-cabinet', x: 8.82, y: 3.0, rot: RIGHT },
      { asset: 'kitchen-wall-cabinet', x: 8.82, y: 3.6, rot: RIGHT },
      // Dining
      { asset: 'dining-table-rect', x: 6.8, y: 2.3, rot: RIGHT },
      { asset: 'dining-chair', x: 6.05, y: 1.9, rot: LEFT },
      { asset: 'dining-chair', x: 6.05, y: 2.7, rot: LEFT },
      { asset: 'dining-chair', x: 7.55, y: 1.9, rot: RIGHT },
      { asset: 'dining-chair', x: 7.55, y: 2.7, rot: RIGHT },
      { asset: 'pendant-linear', x: 6.8, y: 2.3, rot: RIGHT },
      { asset: 'plant-potted', x: 8.7, y: 4.2 },
    ]);

    d.cameras.push(
      { id: 'cam_overview', name: 'Overview', projection: 'perspective', position: [9.6, 10.8, 11.0], target: [4.5, 0, 2.25], fov: 45, zoom: 1, wallDisplay: null },
      { id: 'cam_kitchen', name: 'Towards the kitchen', projection: 'perspective', position: [2.4, 1.6, 3.7], target: [8.5, 1.0, 1.2], fov: 62, zoom: 1, wallDisplay: 'full' },
      { id: 'cam_bed', name: 'Towards the bed', projection: 'perspective', position: [8.0, 1.6, 4.0], target: [0.8, 0.8, 2.0], fov: 62, zoom: 1, wallDisplay: 'full' },
    );
    d.guest.startCameraId = 'cam_overview';
    d.guest.spawn = { x: 7.6, y: 3.9 };
    d.guest.spawnAngle = -Math.PI / 2;
  });
}

export interface SampleDefinition {
  id: string;
  name: string;
  description: string;
  build: () => Project;
}

/** Sample projects offered in the launcher. */
export const SAMPLES: SampleDefinition[] = [
  {
    id: 'apartment',
    name: 'Two-bedroom apartment',
    description: '6 rooms · 80 m² · fully furnished',
    build: buildDemoProject,
  },
  {
    id: 'studio',
    name: 'Studio room 9 × 4.5 m',
    description: 'One open room · 40.5 m² · sleep, live, cook & dine',
    build: buildStudioProject,
  },
  {
    id: 'loft',
    name: 'Complex loft 100 m² (stress test)',
    description: 'Curved bay, chamfer, 4 rooms, 16 openings, ~120 items',
    build: buildLoftProject,
  },
  {
    id: 'grand',
    name: 'Grand apartment 200 m² (stress test)',
    description: '10 rooms, piano bay, 28 openings, ~200 items',
    build: buildGrandApartmentProject,
  },
];


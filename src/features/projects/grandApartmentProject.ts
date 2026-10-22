import { produce } from 'immer';
import type { Project, RoomType, Vec2 } from '@/domain/model/schema';
import { createEmptyProject } from '@/domain/model/defaults';
import { assignMaterial, reconcileRooms } from '@/domain/commands/entities';
import { addWallChain } from '@/domain/commands/walls';
import { detectRoomFaces, pointInFace } from '@/domain/geometry/rooms';
import { opening, paintWallFacing, placeFurniture, type Furn } from './sampleHelpers';

const H = 0.125; // half the exterior wall thickness
const K = H * (Math.SQRT2 - 1); // centreline shift where the 45° chamfer meets the orthogonal walls
const EXT = { thickness: 0.25, height: 3.0, role: 'exterior' as const };
const INT = { thickness: 0.1, height: 3.0, role: 'interior' as const };

// Clear inside outline: 18.0 × 11.6 m, plus a curved bay (x 8–13) and minus a 1.5 m chamfer.
const W = 18.0;
const D = 11.6;

const R = Math.PI;
const DOWN = 0; // front faces +y (backs onto a wall at the top of the plan)
const UP = R; // front faces -y
const LEFT = -R / 2; // front faces +x (backs onto a wall on the left)
const RIGHT = R / 2; // front faces -x

/**
 * Stress-test sample: a ≈205 m² family apartment with ten rooms — an 80 m² living, dining and kitchen
 * room with a curved bay (grand piano), a master suite (en-suite, walk-in closet), kids' room, guest
 * room, study, family bathroom, pantry & laundry and an L-shaped hall opening into the foyer —
 * 28 openings and about 200 furnishings, most of them decor (art, plants, lamps, textiles, books).
 */
export function buildGrandApartmentProject(): Project {
  const base = createEmptyProject({ name: 'Grand apartment 200 m² (stress test)', wallHeight: 3.0 });
  return produce(base, (d) => {
    // ── Shell (centrelines sit half a wall outside the clear outline) ──
    addWallChain(
      d,
      [
        { x: -H, y: -H },
        { x: 8.0, y: -H },
        { x: 13.0, y: -H },
        { x: W + H, y: -H },
        { x: W + H, y: 10.1 + K },
        { x: 16.5 + K, y: D + H },
        { x: -H, y: D + H },
      ],
      { ...EXT, closed: true, curves: [null, { x: 10.5, y: -H - 2.0 }, null, null, null, null, null] },
    );

    // ── Partitions ──
    // Bedroom wing boundary, full depth.
    addWallChain(d, [{ x: 5.0, y: -H }, { x: 5.0, y: D + H }], INT);
    // Hall | living room, then living room | hall and guest room.
    addWallChain(d, [{ x: 6.4, y: -H }, { x: 6.4, y: 7.4 }, { x: W + H, y: 7.4 }], INT);
    // Master bedroom | en-suite & closet | kids' room, and en-suite | closet.
    addWallChain(d, [{ x: -H, y: 4.6 }, { x: 5.0, y: 4.6 }], INT);
    addWallChain(d, [{ x: -H, y: 7.4 }, { x: 5.0, y: 7.4 }], INT);
    addWallChain(d, [{ x: 3.2, y: 4.6 }, { x: 3.2, y: 7.4 }], INT);
    // Guest room | hall & bathroom.
    addWallChain(d, [{ x: 13.0, y: 7.4 }, { x: 13.0, y: D + H }], INT);
    // Study (left of the foyer) and family bathroom (right of it); the foyer opens into the hall.
    addWallChain(d, [{ x: 5.0, y: 8.8 }, { x: 8.6, y: 8.8 }, { x: 8.6, y: D + H }], INT);
    addWallChain(d, [{ x: 13.0, y: 8.8 }, { x: 11.0, y: 8.8 }, { x: 11.0, y: D + H }], INT);
    // Pantry & laundry in the kitchen corner.
    addWallChain(d, [{ x: 15.6, y: -H }, { x: 15.6, y: 2.4 }, { x: W + H, y: 2.4 }], INT);
    reconcileRooms(d);

    // ── Openings ──
    const top = (x: number) => ({ x, y: -H });
    const bottom = (x: number) => ({ x, y: D + H });
    const left = (y: number) => ({ x: -H, y });
    const right = (y: number) => ({ x: W + H, y });
    // Doors and passages
    opening(d, bottom(9.8), { kind: 'door-single', width: 1.0, swingSide: 'left', hinge: 'start', height: 2.3 }); // entry
    opening(d, { x: 5.0, y: 3.6 }, { kind: 'door-single', width: 0.9, swingSide: 'left' }); // master bedroom
    opening(d, { x: 1.6, y: 4.6 }, { kind: 'door-pocket', width: 0.8 }); // en-suite
    opening(d, { x: 4.1, y: 4.6 }, { kind: 'door-single', width: 0.7, swingSide: 'right' }); // closet
    opening(d, { x: 5.0, y: 8.1 }, { kind: 'door-single', width: 0.9, swingSide: 'right' }); // kids' room
    opening(d, { x: 7.6, y: 8.8 }, { kind: 'door-single', width: 0.8, swingSide: 'right' }); // study
    opening(d, { x: 12.0, y: 8.8 }, { kind: 'door-single', width: 0.7, swingSide: 'right' }); // family bathroom
    opening(d, { x: 13.0, y: 8.1 }, { kind: 'door-single', width: 0.8, swingSide: 'left' }); // guest room
    opening(d, { x: 16.8, y: 2.4 }, { kind: 'door-barn', width: 0.8 }); // pantry
    opening(d, { x: 6.4, y: 4.2 }, { kind: 'passage', width: 1.6, height: 2.4 }); // hall → living
    opening(d, { x: 9.8, y: 7.4 }, { kind: 'passage-arched', width: 1.6, height: 2.5 }); // foyer → living
    // Windows on the curved bay (points on the Bézier centreline at t = 0.2, 0.5, 0.8).
    opening(d, { x: 9.0, y: -0.765 }, { kind: 'window-tall', width: 0.9 });
    opening(d, { x: 10.5, y: -1.125 }, { kind: 'window-tall', width: 1.4 });
    opening(d, { x: 12.0, y: -0.765 }, { kind: 'window-tall', width: 0.9 });
    opening(d, top(2.5), { kind: 'window-double', width: 1.6, height: 1.5, sillHeight: 0.8 }); // master
    opening(d, top(5.7), { kind: 'window-single', width: 0.6, height: 1.0, sillHeight: 1.3 }); // hall end
    opening(d, top(7.2), { kind: 'window-single', width: 0.8, height: 1.6, sillHeight: 0.6 }); // living
    opening(d, top(14.3), { kind: 'window-double', width: 1.4, height: 1.1, sillHeight: 1.05 }); // kitchen
    opening(d, top(17.5), { kind: 'window-single', width: 0.6, height: 0.8, sillHeight: 1.4 }); // pantry
    opening(d, right(4.9), { kind: 'window-double', width: 1.2, height: 1.1, sillHeight: 1.05 }); // above the sink
    opening(d, right(8.8), { kind: 'window-double', width: 1.2, height: 1.4, sillHeight: 0.9 }); // guest room
    opening(d, { x: (W + H + 16.5 + K) / 2, y: (10.1 + K + D + H) / 2 }, { kind: 'window-fixed', width: 1.2, height: 1.8, sillHeight: 0.5 }); // chamfer
    opening(d, bottom(14.6), { kind: 'window-double', width: 1.4, height: 1.4, sillHeight: 0.9 }); // guest room
    opening(d, bottom(12.0), { kind: 'window-single', width: 0.6, height: 0.8, sillHeight: 1.4 }); // family bathroom
    opening(d, bottom(6.8), { kind: 'window-double', width: 1.2, height: 1.4, sillHeight: 0.9 }); // study
    opening(d, bottom(2.5), { kind: 'window-double', width: 1.4, height: 1.4, sillHeight: 0.9 }); // kids' room
    opening(d, left(9.5), { kind: 'window-double', width: 1.2, height: 1.4, sillHeight: 0.9 }); // kids' room
    opening(d, left(6.0), { kind: 'window-single', width: 0.6, height: 0.8, sillHeight: 1.4 }); // en-suite

    // ── Rooms & finishes ──
    const rooms: { p: Vec2; name: string; type: RoomType; floor: string }[] = [
      { p: { x: 11.0, y: 4.0 }, name: 'Living, dining & kitchen', type: 'living', floor: 'wood-oak-wide' },
      { p: { x: 2.5, y: 0.6 }, name: 'Master bedroom', type: 'bedroom', floor: 'wood-herringbone' },
      { p: { x: 1.6, y: 5.2 }, name: 'En-suite', type: 'bathroom', floor: 'stone-marble-carrara' },
      { p: { x: 4.1, y: 5.2 }, name: 'Walk-in closet', type: 'storage', floor: 'wood-oak-light' },
      { p: { x: 2.5, y: 8.6 }, name: "Kids' room", type: 'bedroom', floor: 'laminate-oak' },
      { p: { x: 5.7, y: 2.0 }, name: 'Hall & foyer', type: 'hall', floor: 'stone-travertine' },
      { p: { x: 6.0, y: 9.5 }, name: 'Study', type: 'office', floor: 'wood-walnut' },
      { p: { x: 12.0, y: 9.5 }, name: 'Family bathroom', type: 'bathroom', floor: 'tile-terrazzo' },
      { p: { x: 14.0, y: 10.8 }, name: 'Guest room', type: 'bedroom', floor: 'wood-oak-natural' },
      { p: { x: 16.2, y: 1.8 }, name: 'Pantry & laundry', type: 'laundry', floor: 'tile-checker' },
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
    paintWallFacing(d, left(2.3), { x: 1, y: 2.3 }, 'paint-deep-teal'); // master bed wall
    paintWallFacing(d, left(6.6), { x: 1, y: 6.6 }, 'tile-zellige-green'); // en-suite
    paintWallFacing(d, { x: 1.6, y: 7.4 }, { x: 1.6, y: 6.5 }, 'tile-zellige-green');
    paintWallFacing(d, { x: 2.5, y: 7.4 }, { x: 2.5, y: 8.5 }, 'paint-dusty-blue'); // kids' room
    paintWallFacing(d, { x: 5.0, y: 10.2 }, { x: 6, y: 10.2 }, 'paint-forest'); // study
    paintWallFacing(d, { x: 11.0, y: 10.2 }, { x: 12, y: 10.2 }, 'tile-mosaic-blue'); // family bathroom
    paintWallFacing(d, { x: 8.6, y: 10.2 }, { x: 9.8, y: 10.2 }, 'paint-terracotta'); // foyer
    paintWallFacing(d, { x: 15.3, y: 7.4 }, { x: 15.3, y: 8.5 }, 'paint-blush'); // guest bed wall
    paintWallFacing(d, { x: 6.4, y: 1.6 }, { x: 7.5, y: 1.6 }, 'paint-charcoal'); // fireplace wall
    paintWallFacing(d, right(4.9), { x: 17, y: 4.9 }, 'tile-subway-white'); // kitchen
    paintWallFacing(d, { x: 12.4, y: 7.4 }, { x: 12.4, y: 6.5 }, 'paint-sage'); // dining

    // ── Furnishings ──
    const items: Furn[] = [
      // Master bedroom (x 0–4.95, y 0–4.55)
      { asset: 'rug-rect', x: 1.6, y: 2.3, rot: RIGHT, w: 2.8, d: 2.0, materials: { rug: 'rug-wool-cream' } },
      { asset: 'bed-king', x: 1.07, y: 2.3, rot: LEFT, materials: { upholstery: 'fabric-velvet-teal' } },
      { asset: 'bedside-table', x: 0.205, y: 1.1, rot: LEFT },
      { asset: 'bedside-table', x: 0.205, y: 3.5, rot: LEFT },
      { asset: 'table-lamp', x: 0.21, y: 1.1, rot: LEFT },
      { asset: 'table-lamp', x: 0.21, y: 3.5, rot: LEFT },
      { asset: 'wall-sconce', x: 0.1, y: 1.1, rot: LEFT },
      { asset: 'wall-sconce', x: 0.1, y: 3.5, rot: LEFT },
      { asset: 'art-canvas-large', x: 0.02, y: 2.3, rot: LEFT, elevation: 1.3 },
      { asset: 'cushion', x: 0.35, y: 1.95, rot: LEFT, elevation: 0.55 },
      { asset: 'cushion', x: 0.35, y: 2.65, rot: LEFT, elevation: 0.55 },
      { asset: 'throw-blanket', x: 1.8, y: 2.3, rot: LEFT, elevation: 0.55 },
      { asset: 'bench-bed-end', x: 2.45, y: 2.3, rot: LEFT },
      { asset: 'dresser', x: 4.71, y: 1.0, rot: RIGHT },
      { asset: 'mirror-round', x: 4.93, y: 1.0, rot: RIGHT, elevation: 1.3 },
      { asset: 'vase', x: 4.71, y: 0.7, rot: RIGHT, w: 0.18, d: 0.18, h: 0.35, elevation: 0.85 },
      { asset: 'candle-set', x: 4.71, y: 1.3, rot: RIGHT, elevation: 0.85 },
      { asset: 'plant-fiddle-leaf', x: 4.55, y: 2.2 },
      { asset: 'chair-slipper', x: 3.75, y: 0.55, rot: DOWN, materials: { upholstery: 'fabric-velvet-blush' } },
      { asset: 'curtains', x: 2.5, y: 0.09, rot: DOWN, w: 2.0 },
      { asset: 'branded-climate-vn:panasonic-cs-xu9zkh-8', x: 0.6, y: 0.11, rot: DOWN },
      { asset: 'chandelier', x: 2.4, y: 2.3 },
      // En-suite (x 0–3.15, y 4.65–7.35)
      { asset: 'bathtub-clawfoot', x: 1.0, y: 6.96, rot: UP },
      { asset: 'vanity-double', x: 2.9, y: 6.1, rot: RIGHT },
      { asset: 'bathroom-mirror', x: 3.13, y: 6.1, rot: RIGHT, w: 1.2 },
      { asset: 'branded-bathroom-vn:inax-ac-952vn', x: 0.28, y: 5.3, rot: LEFT },
      { asset: 'towel-ladder', x: 2.35, y: 7.17, rot: UP },
      { asset: 'bath-mat', x: 1.0, y: 6.3 },
      { asset: 'candle-set', x: 1.75, y: 6.96, rot: UP, elevation: 0.78 },
      { asset: 'plant-hanging-pothos', x: 0.5, y: 6.9 },
      { asset: 'ceiling-light', x: 1.6, y: 6.0 },
      // Walk-in closet (x 3.25–4.95, y 4.65–7.35)
      { asset: 'wardrobe', x: 4.65, y: 5.7, rot: RIGHT },
      { asset: 'wardrobe', x: 4.65, y: 6.75, rot: RIGHT },
      { asset: 'clothes-rail', x: 3.48, y: 6.3, rot: LEFT },
      { asset: 'mirror-floor', x: 4.0, y: 7.19, rot: UP },
      { asset: 'ceiling-light', x: 4.1, y: 6.0 },
      // Kids' room (x 0–4.95, y 7.45–11.6)
      { asset: 'bed-bunk', x: 1.2, y: 7.95, rot: DOWN },
      { asset: 'artwork-framed', x: 0.02, y: 8.4, rot: LEFT, elevation: 1.8 },
      { asset: 'rug-round', x: 2.6, y: 9.6, w: 1.8, d: 1.8, materials: { rug: 'rug-blue-geometric' } },
      { asset: 'kids-table-set', x: 2.6, y: 9.6 },
      { asset: 'play-teepee', x: 0.75, y: 10.75 },
      { asset: 'toy-chest', x: 2.5, y: 11.375, rot: UP },
      { asset: 'toy-blocks', x: 1.9, y: 10.85 },
      { asset: 'floor-cushion', x: 3.6, y: 11.0 },
      { asset: 'rocking-horse', x: 4.2, y: 9.9 },
      { asset: 'kids-book-display', x: 4.8, y: 10.6, rot: RIGHT },
      { asset: 'plant-snake', x: 4.6, y: 11.3 },
      { asset: 'curtains', x: 2.5, y: 11.51, rot: UP, w: 1.8, materials: { fabric: 'fabric-sky' } },
      { asset: 'branded-climate-vn:panasonic-f-60gfn', x: 2.5, y: 9.5 },
      // Study (x 5.05–8.55, y 8.85–11.6)
      { asset: 'rug-rect', x: 6.6, y: 10.2, materials: { rug: 'rug-berber' } },
      { asset: 'desk-executive', x: 5.48, y: 10.2, rot: LEFT },
      { asset: 'branded-tech-vn:sihoo-m57', x: 6.25, y: 10.2, rot: RIGHT },
      { asset: 'branded-tech-vn:samsung-s24c310', x: 5.3, y: 10.2, rot: LEFT, elevation: 0.76 },
      { asset: 'task-lamp', x: 5.25, y: 9.55, rot: LEFT, elevation: 0.76 },
      { asset: 'globe-desk', x: 5.3, y: 10.85, rot: LEFT, elevation: 0.76 },
      { asset: 'bookcase', x: 8.39, y: 9.6, rot: RIGHT },
      { asset: 'bookcase', x: 8.39, y: 10.55, rot: RIGHT },
      { asset: 'books-stack', x: 8.39, y: 9.6, rot: RIGHT, elevation: 1.9 },
      { asset: 'armchair-wingback', x: 7.4, y: 11.0, rot: UP, materials: { upholstery: 'fabric-velvet-green' } },
      { asset: 'floor-lamp', x: 8.2, y: 11.3 },
      { asset: 'branded-tech-vn:hoa-phat-tu4f', x: 6.6, y: 9.17, rot: DOWN },
      { asset: 'branded-tech-vn:canon-lbp2900', x: 6.6, y: 9.17, rot: DOWN, elevation: 1.28 },
      { asset: 'pinboard', x: 6.0, y: 8.87, rot: DOWN },
      { asset: 'plant-snake', x: 5.3, y: 11.35 },
      { asset: 'curtains', x: 6.8, y: 11.51, rot: UP, w: 1.6 },
      { asset: 'ceiling-light', x: 6.8, y: 10.2 },
      // Family bathroom (x 11.05–12.95, y 8.85–11.6)
      { asset: 'shower-walk-in', x: 11.75, y: 11.15, rot: UP },
      { asset: 'branded-bathroom-vn:caesar-cd1338', x: 11.39, y: 9.9, rot: LEFT },
      { asset: 'vanity-basin', x: 12.71, y: 9.9, rot: RIGHT },
      { asset: 'bathroom-mirror', x: 12.93, y: 9.9, rot: RIGHT },
      { asset: 'towel-rail', x: 11.06, y: 10.45, rot: LEFT },
      { asset: 'plant-succulents', x: 12.71, y: 9.65, rot: RIGHT, elevation: 1.05 },
      { asset: 'ceiling-light', x: 12.0, y: 10.0 },
      // Foyer (x 8.65–10.95, y 8.85–11.6)
      { asset: 'rug-runner', x: 9.8, y: 10.2, rot: RIGHT, w: 2.0 },
      { asset: 'console-table', x: 8.83, y: 10.0, rot: LEFT },
      { asset: 'mirror-arched', x: 8.67, y: 10.0, rot: LEFT, elevation: 0.9 },
      { asset: 'vase', x: 8.83, y: 9.7, rot: LEFT, w: 0.22, d: 0.22, h: 0.45, elevation: 0.8 },
      { asset: 'tray-decor', x: 8.83, y: 10.25, rot: LEFT, elevation: 0.8 },
      { asset: 'shoe-cabinet', x: 8.77, y: 11.1, rot: LEFT },
      { asset: 'hall-tree', x: 10.74, y: 10.0, rot: RIGHT },
      { asset: 'umbrella-stand', x: 10.7, y: 11.2 },
      { asset: 'plant-potted', x: 10.6, y: 9.1 },
      { asset: 'pendant-globe-cluster', x: 9.8, y: 10.2 },
      // Hall (x 5.05–6.35 up to y 8.75, then x 6.4–12.95 at y 7.45–8.75)
      { asset: 'rug-runner', x: 5.7, y: 1.8, rot: RIGHT },
      { asset: 'rug-runner', x: 5.7, y: 6.2, rot: RIGHT, w: 2.2 },
      { asset: 'art-gallery-wall', x: 6.33, y: 1.8, rot: RIGHT },
      { asset: 'clock-grandfather', x: 6.21, y: 6.6, rot: RIGHT },
      { asset: 'wall-sconce', x: 5.1, y: 1.2, rot: LEFT },
      { asset: 'wall-sconce', x: 5.1, y: 5.5, rot: LEFT },
      { asset: 'radiator', x: 5.1, y: 6.6, rot: LEFT },
      { asset: 'plant-snake', x: 5.25, y: 0.3 },
      { asset: 'artwork-framed', x: 7.5, y: 7.47, rot: DOWN, elevation: 1.35 },
      { asset: 'picture-light', x: 7.5, y: 7.52, rot: DOWN },
      { asset: 'artwork-framed', x: 11.6, y: 7.47, rot: DOWN, elevation: 1.35 },
      { asset: 'picture-light', x: 11.6, y: 7.52, rot: DOWN },
      { asset: 'ceiling-light', x: 5.7, y: 1.5 },
      { asset: 'ceiling-light', x: 5.7, y: 5.5 },
      { asset: 'ceiling-light', x: 8.0, y: 8.1 },
      { asset: 'ceiling-light', x: 11.5, y: 8.1 },
      // Pantry & laundry (x 15.65–18, y 0–2.35)
      { asset: 'branded-washers:lg-washtower-wt1210bbf', x: 16.0, y: 0.31, rot: DOWN },
      { asset: 'utility-sink', x: 16.7, y: 0.275, rot: DOWN },
      { asset: 'shelving-unit', x: 17.8, y: 1.2, rot: RIGHT },
      { asset: 'broom-cupboard', x: 15.88, y: 1.6, rot: LEFT },
      { asset: 'laundry-basket', x: 16.9, y: 1.0 },
      { asset: 'ceiling-light', x: 16.8, y: 1.2 },
      // Guest room (x 13.05–18, y 7.45–11.6, chamfered corner)
      { asset: 'rug-rect', x: 15.3, y: 9.3, w: 2.6, d: 1.8, materials: { rug: 'rug-jute' } },
      { asset: 'bed-queen', x: 15.3, y: 8.52, rot: DOWN },
      { asset: 'bedside-table', x: 14.2, y: 7.65, rot: DOWN },
      { asset: 'bedside-table', x: 16.4, y: 7.65, rot: DOWN },
      { asset: 'table-lamp-mushroom', x: 14.2, y: 7.65, rot: DOWN },
      { asset: 'table-lamp-mushroom', x: 16.4, y: 7.65, rot: DOWN },
      { asset: 'artwork-framed', x: 15.3, y: 7.47, rot: DOWN, w: 1.2, h: 0.6, elevation: 1.3 },
      { asset: 'cushion', x: 15.0, y: 7.75, rot: DOWN, elevation: 0.55 },
      { asset: 'cushion', x: 15.6, y: 7.75, rot: DOWN, elevation: 0.55 },
      { asset: 'bench-bed-end', x: 15.3, y: 9.82, rot: DOWN },
      { asset: 'armoire', x: 13.35, y: 10.3, rot: LEFT },
      { asset: 'vanity-dressing-table', x: 15.9, y: 11.375, rot: UP },
      { asset: 'chair-slipper', x: 15.9, y: 10.75, rot: DOWN },
      { asset: 'plant-olive-tree', x: 17.3, y: 9.9 },
      { asset: 'curtains', x: 17.91, y: 8.8, rot: RIGHT, w: 1.6 },
      { asset: 'curtains', x: 14.6, y: 11.51, rot: UP, w: 1.8 },
      { asset: 'pendant-rattan', x: 15.3, y: 9.2 },
      // Living (x 6.45–11.6, bay above y 0)
      { asset: 'rug-rect', x: 8.6, y: 1.7, rot: RIGHT, w: 3.2, d: 2.4, materials: { rug: 'rug-berber' } },
      { asset: 'fireplace', x: 6.63, y: 1.6, rot: LEFT },
      { asset: 'branded-tvs:samsung-qe55ls03d', x: 6.48, y: 1.6, rot: LEFT, elevation: 1.45 },
      { asset: 'candle-set', x: 6.63, y: 1.1, rot: LEFT, elevation: 1.15 },
      { asset: 'vase', x: 6.63, y: 2.1, rot: LEFT, w: 0.2, d: 0.2, h: 0.4, elevation: 1.15 },
      { asset: 'speaker-floor', x: 6.6, y: 0.55, rot: LEFT },
      { asset: 'speaker-floor', x: 6.6, y: 2.65, rot: LEFT },
      { asset: 'sofa-3-seat', x: 9.85, y: 1.7, rot: RIGHT, materials: { upholstery: 'fabric-boucle' } },
      { asset: 'cushion', x: 10.1, y: 1.0, rot: RIGHT },
      { asset: 'cushion', x: 10.1, y: 1.7, rot: RIGHT },
      { asset: 'cushion', x: 10.1, y: 2.4, rot: RIGHT },
      { asset: 'throw-blanket', x: 9.9, y: 2.5, rot: RIGHT, elevation: 0.45 },
      { asset: 'console-table', x: 10.5, y: 1.7, rot: RIGHT },
      { asset: 'table-lamp', x: 10.5, y: 1.25, rot: RIGHT, elevation: 0.8 },
      { asset: 'books-stack', x: 10.5, y: 1.9, rot: RIGHT, elevation: 0.8 },
      { asset: 'branded-home-electronics:google-nest-audio', x: 10.5, y: 2.2, rot: RIGHT, elevation: 0.8 },
      { asset: 'coffee-table', x: 8.4, y: 1.7, rot: RIGHT },
      { asset: 'books-stack', x: 8.4, y: 1.45, rot: RIGHT, elevation: 0.4 },
      { asset: 'candle-set', x: 8.4, y: 2.0, rot: RIGHT, elevation: 0.4 },
      { asset: 'armchair', x: 8.6, y: 0.3, rot: DOWN, materials: { upholstery: 'fabric-mustard' } },
      { asset: 'armchair', x: 8.4, y: 3.2, rot: UP, materials: { upholstery: 'fabric-mustard' } },
      { asset: 'side-table', x: 9.85, y: 0.3, materials: { base: 'metal-brass', top: 'stone-marble-carrara' } },
      { asset: 'floor-lamp-tripod', x: 10.0, y: 3.2 },
      { asset: 'plant-monstera', x: 7.1, y: 3.0 },
      { asset: 'branded-music:yamaha-c3x', x: 11.6, y: 0.6 },
      { asset: 'curtains', x: 7.2, y: 0.09, rot: DOWN, w: 1.2 },
      { asset: 'chandelier', x: 8.6, y: 1.7 },
      // Reading corner and bar along the hall wall
      { asset: 'bookcase', x: 7.2, y: 7.19, rot: UP },
      { asset: 'bookcase', x: 8.15, y: 7.19, rot: UP },
      { asset: 'books-stack', x: 7.2, y: 7.19, rot: UP, elevation: 1.9 },
      { asset: 'sculpture-abstract', x: 8.15, y: 7.19, rot: UP, elevation: 1.9, h: 0.35 },
      { asset: 'chair-egg', x: 7.4, y: 6.0, rot: UP },
      { asset: 'floor-lamp', x: 6.75, y: 6.75 },
      { asset: 'chess-table', x: 8.6, y: 5.6 },
      { asset: 'pouf-round', x: 9.3, y: 5.6 },
      { asset: 'art-canvas-large', x: 6.47, y: 6.0, rot: LEFT, elevation: 1.2 },
      { asset: 'bar-cart', x: 11.2, y: 7.1, rot: UP },
      { asset: 'ceiling-light', x: 8.8, y: 5.6 },
      { asset: 'branded-home-electronics:xiaomi-robot-vacuum-s10', x: 10.3, y: 6.6 },
      // Dining (table along y between living and kitchen)
      { asset: 'rug-rect', x: 12.4, y: 4.6, rot: RIGHT, w: 3.0, d: 2.6, materials: { rug: 'rug-jute' } },
      { asset: 'dining-table-trestle', x: 12.4, y: 4.6, rot: RIGHT },
      { asset: 'dining-chair-upholstered', x: 11.6, y: 4.0, rot: LEFT },
      { asset: 'dining-chair-upholstered', x: 11.6, y: 4.6, rot: LEFT },
      { asset: 'dining-chair-upholstered', x: 11.6, y: 5.2, rot: LEFT },
      { asset: 'dining-chair-upholstered', x: 13.2, y: 4.0, rot: RIGHT },
      { asset: 'dining-chair-upholstered', x: 13.2, y: 4.6, rot: RIGHT },
      { asset: 'dining-chair-upholstered', x: 13.2, y: 5.2, rot: RIGHT },
      { asset: 'dining-chair-upholstered', x: 12.4, y: 3.25, rot: DOWN },
      { asset: 'dining-chair-upholstered', x: 12.4, y: 5.95, rot: UP },
      { asset: 'vase', x: 12.4, y: 4.6, w: 0.25, d: 0.25, h: 0.45, elevation: 0.76 },
      { asset: 'candle-set', x: 12.4, y: 4.15, rot: RIGHT, elevation: 0.76 },
      { asset: 'pendant-linear', x: 12.4, y: 4.6, rot: RIGHT },
      { asset: 'sideboard', x: 12.4, y: 7.125, rot: UP },
      { asset: 'vase', x: 11.9, y: 7.125, w: 0.22, d: 0.22, h: 0.5, elevation: 0.78 },
      { asset: 'plant-orchid', x: 12.9, y: 7.125, rot: UP, elevation: 0.78 },
      { asset: 'art-canvas-large', x: 12.4, y: 7.33, rot: UP, elevation: 1.3 },
      // Kitchen: run along the right wall, base units under the top window, island with stools
      { asset: 'branded-fridges:samsung-rf65dg960esr', x: 17.625, y: 2.9, rot: RIGHT },
      { asset: 'kitchen-oven-tower', x: 17.7, y: 3.65, rot: RIGHT },
      { asset: 'kitchen-base-cabinet', x: 17.7, y: 4.25, rot: RIGHT },
      { asset: 'kitchen-sink-unit', x: 17.7, y: 4.95, rot: RIGHT },
      { asset: 'bosch-dishwashers:sms4hvi33e', x: 17.7, y: 5.65, rot: RIGHT },
      { asset: 'kitchen-cooktop', x: 17.7, y: 6.25, rot: RIGHT },
      { asset: 'kitchen-base-cabinet', x: 17.7, y: 6.85, rot: RIGHT },
      { asset: 'branded-appliances-vn:hafele-hh-wt70a', x: 17.75, y: 6.25, rot: RIGHT },
      { asset: 'kitchen-wall-cabinet', x: 17.825, y: 7.05, rot: RIGHT },
      { asset: 'branded-appliances-vn:delonghi-ec685', x: 17.8, y: 4.25, rot: RIGHT, elevation: 0.9 },
      { asset: 'branded-home-electronics:xiaomi-electric-kettle-2', x: 17.8, y: 6.75, rot: RIGHT, elevation: 0.9 },
      { asset: 'toaster', x: 17.8, y: 7.1, rot: RIGHT, elevation: 0.9 },
      { asset: 'wine-cooler', x: 13.3, y: 0.285, rot: DOWN },
      { asset: 'kitchen-base-cabinet', x: 13.9, y: 0.3, rot: DOWN },
      { asset: 'kitchen-base-cabinet', x: 14.5, y: 0.3, rot: DOWN },
      { asset: 'kitchen-base-cabinet', x: 15.1, y: 0.3, rot: DOWN },
      { asset: 'kitchen-open-shelf', x: 13.3, y: 0.125, rot: DOWN, w: 0.6 },
      { asset: 'branded-appliances-vn:sharp-r-205vn', x: 15.1, y: 0.25, rot: DOWN, elevation: 0.9 },
      { asset: 'plant-succulents', x: 14.3, y: 0.15, rot: DOWN, elevation: 0.9 },
      { asset: 'kitchen-island', x: 15.6, y: 5.0, rot: RIGHT, materials: { top: 'stone-marble-nero' } },
      { asset: 'counter-stool-backed', x: 14.7, y: 4.4, rot: LEFT },
      { asset: 'counter-stool-backed', x: 14.7, y: 5.0, rot: LEFT },
      { asset: 'counter-stool-backed', x: 14.7, y: 5.6, rot: LEFT },
      { asset: 'fruit-bowl', x: 15.6, y: 5.0, elevation: 0.92 },
      { asset: 'stand-mixer', x: 15.6, y: 4.35, rot: RIGHT, elevation: 0.92 },
      { asset: 'pendant-lamp', x: 15.6, y: 4.6 },
      { asset: 'pendant-lamp', x: 15.6, y: 5.4 },
      { asset: 'track-spotlights', x: 16.9, y: 4.9, rot: RIGHT },
      { asset: 'plant-kentia-palm', x: 14.0, y: 1.6 },
      { asset: 'ceiling-light', x: 14.3, y: 2.6 },
    ];
    placeFurniture(d, items);

    d.render.wallDisplay = 'cutaway';
    d.render.cutawayHeight = 1.4;
    d.cameras.push(
      { id: 'cam_overview', name: 'Overview', projection: 'perspective', position: [19.5, 19.0, 22.0], target: [9.0, 0, 5.8], fov: 45, zoom: 1, wallDisplay: 'cutaway' },
      { id: 'cam_living', name: 'Living & piano bay', projection: 'perspective', position: [11.2, 1.6, 6.2], target: [7.0, 1.0, 1.0], fov: 62, zoom: 1, wallDisplay: 'full' },
      { id: 'cam_kitchen', name: 'Kitchen & dining', projection: 'perspective', position: [9.8, 1.6, 6.4], target: [17.5, 1.0, 3.8], fov: 60, zoom: 1, wallDisplay: 'full' },
      { id: 'cam_master', name: 'Master bedroom', projection: 'perspective', position: [4.4, 1.6, 4.2], target: [0.4, 0.9, 2.0], fov: 62, zoom: 1, wallDisplay: 'full' },
      { id: 'cam_kids', name: "Kids' room", projection: 'perspective', position: [4.4, 1.6, 7.8], target: [0.8, 0.8, 10.6], fov: 62, zoom: 1, wallDisplay: 'full' },
      { id: 'cam_guest', name: 'Guest room', projection: 'perspective', position: [13.6, 1.6, 11.0], target: [16.4, 0.9, 7.8], fov: 62, zoom: 1, wallDisplay: 'full' },
    );
    d.guest.startCameraId = 'cam_overview';
    d.guest.spawn = { x: 9.8, y: 10.9 };
    d.guest.spawnAngle = -Math.PI / 2;
  });
}

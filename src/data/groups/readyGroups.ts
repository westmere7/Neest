import { getAsset } from '@/data/assets/registry';
import type { AssetCategory } from '@/data/assets/types';
import { packVersion } from '@/packs/events';
import type { SavedGroup } from '@/state/uiStores';

/**
 * Ready-made groups shipped with Neest: furnished setups (bedrooms, kitchens, dining sets…) shown in
 * the library's Groups tab next to the user's own saved groups and placed the same way (as a new
 * group, turned with the ghost). Each item is written in plan metres around the group: the back of
 * the setup is the top edge (y = 0, against a wall), its front faces +y. Rotation follows the plan
 * convention: 0 = front faces +y, π = faces −y, −π/2 = faces +x, π/2 = faces −x. Sizes and
 * elevations default to the item's own; pack items work too (`<pack>:<id>`).
 */
interface ReadyItem {
  a: string;
  x: number;
  y: number;
  r?: number;
  w?: number;
  d?: number;
  h?: number;
  e?: number;
  m?: Record<string, string>;
  /** Mirrored (left-right) item. */
  mi?: boolean;
}

export interface ReadyGroupSpec {
  id: string;
  name: string;
  shelf: string;
  room: AssetCategory;
  description: string;
  items: ReadyItem[];
}

const PI = Math.PI;
const UP = PI;
const FACE_RIGHT = -PI / 2; // front faces +x
const FACE_LEFT = PI / 2; // front faces −x
const OAK = 'wood-oak-light';
const QZ = 'stone-quartz-white';
const SAGE = 'paint-sage';
const PRINT = { frame: OAK, liner: 'paintings:museum-mount' };

const BED = 'Bedroom setups';
const KIDS = 'Kids rooms';
const LIVING = 'Living room setups';
const KITCHEN = 'Kitchens';
const DINING = 'Dining sets';
const BATH = 'Bathrooms';
const OFFICE = 'Home office';
const BALCONY = 'Balcony setups';
const ENTRY = 'Entry & hallway';

export const READY_GROUP_SPECS: ReadyGroupSpec[] = [
  // ───────── Bedrooms ─────────
  {
    id: 'ready-queen-bedroom',
    name: 'Queen bed with nightstands & lamps',
    shelf: BED,
    room: 'bedroom',
    description:
      'A queen bed centred on the wall, matching bedside tables with lamps, a framed print above the headboard and a rug under the foot of the bed. Needs about 2.6 × 2.4 m.',
    items: [
      { a: 'bed-queen', x: 0, y: 1.065 },
      { a: 'bedside-table', x: -1.09, y: 0.2 },
      { a: 'bedside-table', x: 1.09, y: 0.2 },
      { a: 'table-lamp', x: -1.09, y: 0.2, e: 0.5 },
      { a: 'table-lamp', x: 1.09, y: 0.2, e: 0.5 },
      { a: 'artwork-framed', x: 0, y: 0.015, w: 1.0, h: 0.6, e: 1.3 },
      { a: 'rug-rect', x: 0, y: 1.65, w: 2.4, d: 1.6 },
    ],
  },
  {
    id: 'ready-japandi-bedroom',
    name: 'Japandi platform bed with floating nightstands',
    shelf: BED,
    room: 'bedroom',
    description:
      'A low oak platform bed in linen, wall-hung oak nightstands with mushroom lamps, a Hiroshige print above the bed and a snake plant. Calm and uncluttered; about 2.8 × 2.2 m.',
    items: [
      {
        a: 'bed-platform',
        x: 0,
        y: 1.1,
        m: { frame: OAK, bedding: 'fabric-linen', duvet: 'bedroom-collection:linen-oat', throw: 'fabric-linen-sage' },
      },
      {
        a: 'bedroom-collection:floating-nightstand',
        x: -1.15,
        y: 0.16,
        w: 0.45,
        d: 0.3,
        m: { body: OAK, front: OAK },
      },
      {
        a: 'bedroom-collection:floating-nightstand',
        x: 1.15,
        y: 0.16,
        w: 0.45,
        d: 0.3,
        m: { body: OAK, front: OAK },
      },
      { a: 'table-lamp-mushroom', x: -1.15, y: 0.15, w: 0.25, d: 0.25, h: 0.3, e: 0.66 },
      { a: 'table-lamp-mushroom', x: 1.15, y: 0.15, w: 0.25, d: 0.25, h: 0.3, e: 0.66 },
      { a: 'paintings:hiroshige-kanbara-evening-snow', x: 0, y: 0.015, e: 1.2, m: PRINT },
      { a: 'houseplants:snake-plant', x: 1.6, y: 0.3, w: 0.35, d: 0.35 },
    ],
  },
  {
    id: 'ready-king-bedroom-bench',
    name: 'King bed with bed-end bench',
    shelf: BED,
    room: 'bedroom',
    description:
      'A king bed with bedside tables and lamps on both sides and an upholstered bench at its foot. A generous master-bedroom layout for walls of 3 m or more.',
    items: [
      { a: 'bed-king', x: 0, y: 1.065 },
      { a: 'bedside-table', x: -1.19, y: 0.2 },
      { a: 'bedside-table', x: 1.19, y: 0.2 },
      { a: 'table-lamp', x: -1.19, y: 0.2, e: 0.5 },
      { a: 'table-lamp', x: 1.19, y: 0.2, e: 0.5 },
      { a: 'bench-bed-end', x: 0, y: 2.38 },
    ],
  },
  {
    id: 'ready-lived-in-bed',
    name: 'Lived-in linen bed with book & slippers',
    shelf: BED,
    room: 'bedroom',
    description:
      'A rumpled linen bed that looks slept in, a bedside table with a book left open and reading glasses, and slippers by the bed. Good for renders that should not look staged.',
    items: [
      { a: 'bedroom-collection:lived-in-king-bed', x: 0, y: 1.075, w: 1.6, d: 2.15 },
      { a: 'bedside-table', x: -1.05, y: 0.2 },
      { a: 'bedside-table', x: 1.05, y: 0.2 },
      { a: 'table-lamp-mushroom', x: -1.05, y: 0.15, w: 0.25, d: 0.25, h: 0.3, e: 0.5 },
      { a: 'lived-in:open-book-glasses', x: 1.05, y: 0.2, r: 0.3, w: 0.3, d: 0.21, e: 0.5 },
      { a: 'lived-in:house-slippers', x: 0.95, y: 1.6, r: FACE_LEFT + 0.2 },
    ],
  },
  {
    id: 'ready-wardrobe-wall',
    name: 'Sliding wardrobe & dresser wall',
    shelf: BED,
    room: 'bedroom',
    description:
      'A wide sliding-door wardrobe next to a chest of drawers with a round mirror above it. Lines one wall of a bedroom; about 2.9 m long and 0.65 m deep.',
    items: [
      { a: 'cabinets-wardrobes:wardrobe-sliding', x: -0.55, y: 0.32, m: { body: OAK, door: OAK } },
      { a: 'dresser', x: 0.9, y: 0.24, m: { body: OAK } },
      { a: 'mirror-round', x: 0.9, y: 0.015, w: 0.6, h: 0.6, e: 1.25 },
      { a: 'vase', x: 1.2, y: 0.2, w: 0.2, d: 0.2, h: 0.4, e: 0.85 },
    ],
  },
  {
    id: 'ready-dressing-corner',
    name: 'Dressing table corner',
    shelf: BED,
    room: 'bedroom',
    description:
      'A dressing table with its mirror, a round pouf to sit on, a floor lamp for even light and an orchid. Fits a 1.6 m stretch of wall.',
    items: [
      { a: 'vanity-dressing-table', x: 0, y: 0.225 },
      { a: 'pouf-round', x: 0, y: 0.75, w: 0.42, d: 0.42 },
      { a: 'floor-lamp', x: 0.75, y: 0.3 },
      { a: 'plant-orchid', x: -0.35, y: 0.22, e: 0.75 },
    ],
  },
  {
    id: 'ready-guest-single',
    name: 'Single guest bed with side table',
    shelf: BED,
    room: 'bedroom',
    description:
      'A single bed against the wall with a bedside table, a lamp and a small framed print. Fits a box room or a study that doubles as a guest room.',
    items: [
      { a: 'bed-single', x: 0, y: 1.04 },
      { a: 'bedside-table', x: 0.75, y: 0.2 },
      { a: 'table-lamp', x: 0.75, y: 0.2, e: 0.5 },
      { a: 'artwork-framed', x: 0, y: 0.015, w: 0.6, h: 0.45, e: 1.3 },
    ],
  },
  {
    id: 'ready-daybed-reading',
    name: 'Daybed reading corner',
    shelf: BED,
    room: 'bedroom',
    description:
      'A trundle daybed along the wall with floating shelves above, a reading lamp and a side table for tea. Sleeps a guest when pulled out.',
    items: [
      { a: 'daybed-trundle', x: 0, y: 0.475 },
      { a: 'shelving:floating-shelf-set', x: 0, y: 0.11, e: 1.25 },
      { a: 'lighting-collection:reading-floor-lamp', x: 1.3, y: 0.3 },
      { a: 'side-table', x: 1.3, y: 0.8, w: 0.4, d: 0.4 },
      { a: 'lived-in:coffee-mugs-pair', x: 1.3, y: 0.8, w: 0.26, d: 0.14, e: 0.55 },
    ],
  },
  // ───────── Kids ─────────
  {
    id: 'ready-bunk-room',
    name: 'Bunk beds with toy chest & rug',
    shelf: KIDS,
    room: 'kids',
    description:
      'Bunk beds for two along the wall, a toy chest beside them and a round play rug with building blocks. A shared kids’ room in under 3 × 2.5 m.',
    items: [
      { a: 'bed-bunk', x: 0, y: 0.5 },
      { a: 'toy-chest', x: 1.5, y: 0.225 },
      { a: 'rug-round', x: 0.3, y: 1.65, w: 1.4, d: 1.4 },
      { a: 'toy-blocks', x: 0.6, y: 1.55 },
    ],
  },
  {
    id: 'ready-nursery',
    name: 'Nursery with crib, changer & glider',
    shelf: KIDS,
    room: 'kids',
    description:
      'A crib against the wall, a changing table next to it and a nursing glider angled towards the cot, all on a soft round rug.',
    items: [
      { a: 'crib', x: 0, y: 0.34 },
      { a: 'changing-table', x: 1.3, y: 0.275 },
      { a: 'chair-nursing-glider', x: -1.25, y: 0.75, r: -0.5 },
      { a: 'rug-round', x: 0, y: 1.25, w: 1.6, d: 1.6 },
    ],
  },
  {
    id: 'ready-play-corner',
    name: 'Kids play corner with teepee',
    shelf: KIDS,
    room: 'kids',
    description:
      'A play mat with a teepee to hide in, a small table and chairs for drawing, a front-facing book display and a pile of blocks.',
    items: [
      { a: 'play-mat', x: 0, y: 0.95 },
      { a: 'play-teepee', x: -0.45, y: 0.65 },
      { a: 'kids-table-set', x: 0.55, y: 1.25, w: 1.0, d: 0.55 },
      { a: 'kids-book-display', x: 0.6, y: 0.15 },
      { a: 'toy-blocks', x: -0.6, y: 1.5 },
    ],
  },
  {
    id: 'ready-loft-study',
    name: 'Loft bed with study desk',
    shelf: KIDS,
    room: 'kids',
    description:
      'A loft bed with a built-in desk underneath and a desk chair: sleeping and homework in one footprint, for small rooms.',
    items: [
      { a: 'bed-loft-desk', x: 0, y: 0.5 },
      { a: 'office-chair', x: 0.3, y: 1.15, r: UP },
    ],
  },
  // ───────── Living ─────────
  {
    id: 'ready-sofa-lounge',
    name: 'Three-seat sofa, coffee table & rug',
    shelf: LIVING,
    room: 'living',
    description:
      'A classic living setup: a three-seat sofa on a rug, a coffee table with mugs and magazines, a side table with a lamp and a floor lamp on the other side.',
    items: [
      { a: 'sofa-3-seat', x: 0, y: 0.46 },
      { a: 'rug-rect', x: 0, y: 1.2, w: 2.6, d: 1.8 },
      { a: 'coffee-table', x: 0, y: 1.4 },
      { a: 'lived-in:coffee-mugs-pair', x: -0.25, y: 1.4, e: 0.4 },
      { a: 'lived-in:magazine-stack', x: 0.3, y: 1.42, r: 0.3, e: 0.4 },
      { a: 'side-table', x: 1.4, y: 0.35 },
      { a: 'table-lamp', x: 1.4, y: 0.35, e: 0.55 },
      { a: 'floor-lamp', x: -1.4, y: 0.3 },
    ],
  },
  {
    id: 'ready-corner-sofa',
    name: 'L-shaped corner sofa lounge',
    shelf: LIVING,
    room: 'living',
    description:
      'An L-shaped corner sofa with a round coffee table, a large rug and a floor lamp. Seats five; needs about 3 × 2.8 m.',
    items: [
      { a: 'sofa-corner-l', x: 0, y: 0.8 },
      { a: 'rug-rect', x: -0.1, y: 1.75, w: 2.6, d: 2.0 },
      { a: 'coffee-table-round', x: -0.3, y: 2.1 },
      { a: 'floor-lamp', x: 1.6, y: 0.3 },
      { a: 'cushion', x: -0.9, y: 0.2, e: 0.42 },
    ],
  },
  {
    id: 'ready-tv-wall',
    name: 'TV wall with media console',
    shelf: LIVING,
    room: 'living',
    description:
      'A wall-mounted TV above a long oak media console with a soundbar, floating shelves to one side and a snake plant on the other.',
    items: [
      { a: 'media-console', x: 0, y: 0.21, m: { body: OAK } },
      { a: 'tv-wall', x: 0, y: 0.03, e: 1.05 },
      { a: 'soundbar', x: 0, y: 0.25, e: 0.5 },
      { a: 'shelving:floating-shelf-set', x: -1.35, y: 0.11, e: 1.1 },
      { a: 'plant-snake', x: 1.2, y: 0.2 },
      { a: 'books-stack', x: 0.6, y: 0.22, e: 0.5 },
    ],
  },
  {
    id: 'ready-reading-nook',
    name: 'Reading nook with armchair & bookcase',
    shelf: LIVING,
    room: 'living',
    description:
      'A lounge armchair with a throw and an ottoman, a floor lamp behind the shoulder, a side table with an open book and a full bookcase.',
    items: [
      { a: 'armchair', x: 0, y: 0.5 },
      { a: 'throw-blanket', x: 0.1, y: 0.5, e: 0.45 },
      { a: 'ottoman', x: 0, y: 1.25, w: 0.6, d: 0.45 },
      { a: 'floor-lamp', x: 0.65, y: 0.25 },
      { a: 'side-table', x: -0.65, y: 0.4 },
      { a: 'lived-in:open-book-glasses', x: -0.65, y: 0.4, w: 0.3, d: 0.21, e: 0.55 },
      { a: 'bookcase', x: -1.35, y: 0.16 },
    ],
  },
  {
    id: 'ready-japandi-lounge',
    name: 'Japandi lounge with olive tree',
    shelf: LIVING,
    room: 'living',
    description:
      'An oak-frame sofa in natural linen on a bouclé rug, a round oak coffee table, a tripod floor lamp and an olive tree. Light woods, soft neutrals, nothing extra.',
    items: [
      {
        a: 'sofas:wooden-frame-sofa',
        x: 0,
        y: 0.4,
        m: {
          upholstery: 'fabric-linen',
          cushions: 'fabric-linen',
          pillows: 'fabric-boucle',
          legs: 'wood-oak-natural',
        },
      },
      { a: 'rug-rect', x: 0, y: 1.15, w: 2.2, d: 1.6, m: { rug: 'fabric-boucle' } },
      { a: 'coffee-table-round', x: 0, y: 1.25, w: 0.8, d: 0.8, m: { top: OAK, legs: OAK } },
      { a: 'floor-lamp-tripod', x: 1.25, y: 0.3, w: 0.5, d: 0.5 },
      { a: 'houseplants:olive-tree', x: -1.4, y: 0.35, w: 0.6, d: 0.6 },
    ],
  },
  {
    id: 'ready-armchair-pair',
    name: 'Pair of armchairs with side table',
    shelf: LIVING,
    room: 'living',
    description:
      'Two lounge armchairs angled towards each other around a side table with a lamp, on a round rug. A conversation corner by a window.',
    items: [
      { a: 'armchair', x: -0.6, y: 0.5, r: -0.3 },
      { a: 'armchair', x: 0.6, y: 0.5, r: 0.3 },
      { a: 'side-table', x: 0, y: 0.3 },
      { a: 'table-lamp', x: 0, y: 0.3, e: 0.55 },
      { a: 'rug-round', x: 0, y: 0.85, w: 1.8, d: 1.8 },
    ],
  },
  {
    id: 'ready-console-gallery',
    name: 'Console table with gallery wall',
    shelf: LIVING,
    room: 'living',
    description:
      'A slim console table styled with a lamp, a vase and books, under a gallery wall of framed prints. Works in a hallway or behind a sofa.',
    items: [
      { a: 'console-table', x: 0, y: 0.175 },
      { a: 'art-gallery-wall', x: 0, y: 0.02, e: 1.05 },
      { a: 'table-lamp', x: -0.4, y: 0.17, e: 0.8 },
      { a: 'vase', x: 0.38, y: 0.17, w: 0.2, d: 0.2, h: 0.4, e: 0.8 },
      { a: 'books-stack', x: 0.05, y: 0.17, e: 0.8 },
    ],
  },
  // ───────── Kitchens ─────────
  {
    id: 'ready-kitchen-run',
    name: 'Kitchen run with fridge, sink & hob',
    shelf: KITCHEN,
    room: 'kitchen',
    description:
      'A 2.8 m counter run with drawers, a sink, a dishwasher and a hob, wall cabinets and a chimney hood above, and a fridge at the end. With a kettle, dish soap and condiments in use. About 3.5 m long.',
    items: [
      {
        a: 'kitchen-counters:run-240-sink-hob',
        x: 0,
        y: 0.3,
        w: 2.8,
        m: { front: OAK, worktop: QZ, handle: 'metal-black-matte' },
      },
      { a: 'fridge', x: -1.75, y: 0.35 },
      { a: 'kitchen-wall-cabinet', x: -1.1, y: 0.175, e: 1.45, m: { front: 'paint-satin-white' } },
      { a: 'kitchen-wall-cabinet', x: -0.5, y: 0.175, e: 1.45, m: { front: 'paint-satin-white' } },
      { a: 'kitchen-wall-cabinet', x: 0.1, y: 0.175, e: 1.45, m: { front: 'paint-satin-white' } },
      { a: 'range-hood', x: 1.0, y: 0.25, w: 0.8, e: 1.6 },
      { a: 'kettle', x: -1.2, y: 0.25, e: 0.9 },
      { a: 'lived-in:dish-soap-sponge', x: -0.1, y: 0.1, e: 0.9 },
      { a: 'lived-in:cooking-condiments', x: 1.3, y: 0.1, r: 0, w: 0.28, d: 0.12, e: 0.9 },
    ],
  },
  {
    id: 'ready-sage-kitchen-peninsula',
    name: 'Sage kitchen with peninsula & stools',
    shelf: KITCHEN,
    room: 'kitchen',
    description:
      'Sage-green fronts with brass handles and a white quartz top, a black French-door fridge, a peninsula with two counter stools and a cement-tile floor inlay. Inspired by Vietnamese new-build apartments.',
    items: [
      {
        a: 'fridge-french-door',
        x: -1.6,
        y: 0.36,
        w: 0.9,
        d: 0.72,
        m: { body: 'metal-black-matte', handle: 'metal-black-matte' },
      },
      {
        a: 'kitchen-counters:run-240-sink-hob',
        x: 0,
        y: 0.3,
        w: 2.3,
        m: { front: SAGE, worktop: QZ, handle: 'metal-brass' },
      },
      { a: 'kitchen-wall-cabinet', x: -0.85, y: 0.175, e: 1.45, m: { front: SAGE, handle: 'metal-brass' } },
      { a: 'kitchen-wall-cabinet', x: -0.25, y: 0.175, e: 1.45, m: { front: SAGE, handle: 'metal-brass' } },
      { a: 'range-hood', x: 0.82, y: 0.25, w: 0.66, e: 1.6, m: { body: 'metal-white-powder' } },
      {
        a: 'kitchen-counters:peninsula-breakfast-bar',
        x: 0.675,
        y: 1.1,
        r: FACE_LEFT,
        w: 1.0,
        d: 0.95,
        m: { front: SAGE, worktop: QZ, handle: 'metal-brass' },
      },
      { a: 'counter-stool-backed', x: 1.45, y: 0.9, r: FACE_LEFT },
      { a: 'counter-stool-backed', x: 1.45, y: 1.35, r: FACE_LEFT },
      {
        a: 'rug-rect',
        x: -0.45,
        y: 1.15,
        w: 1.5,
        d: 1.0,
        m: { rug: 'tile-cement-classic', trim: 'tile-cement-classic' },
      },
      { a: 'fruit-bowl', x: 0.6, y: 1.25, e: 0.9 },
    ],
  },
  {
    id: 'ready-masonry-kitchen-vn',
    name: 'Vietnamese masonry kitchen (bếp xây)',
    shelf: KITCHEN,
    room: 'kitchen',
    description:
      'A tiled masonry counter with a stainless sink and drainer, a rice cooker and everyday condiments, and a fridge beside it: the typical Vietnamese home kitchen.',
    items: [
      { a: 'kitchen-counters:masonry-counter-vn', x: 0, y: 0.3 },
      { a: 'asian-everyday:rice-cooker', x: -0.9, y: 0.25, w: 0.3, d: 0.3, h: 0.25, e: 0.9 },
      { a: 'lived-in:cooking-condiments', x: 0.95, y: 0.1, w: 0.3, d: 0.12, e: 0.9 },
      { a: 'fridge', x: 1.6, y: 0.35 },
    ],
  },
  {
    id: 'ready-kitchen-island',
    name: 'Kitchen island with three stools',
    shelf: KITCHEN,
    room: 'kitchen',
    description:
      'A freestanding kitchen island with a row of three bar stools on the seating side, a pendant trio above and a fruit bowl on the worktop.',
    items: [
      { a: 'kitchen-island', x: 0, y: 0.45 },
      { a: 'bar-stool', x: -0.55, y: 1.15, r: UP },
      { a: 'bar-stool', x: 0, y: 1.15, r: UP },
      { a: 'bar-stool', x: 0.55, y: 1.15, r: UP },
      { a: 'lighting-collection:island-pendant-trio', x: 0, y: 0.45 },
      { a: 'fruit-bowl', x: 0.4, y: 0.4, e: 0.92 },
    ],
  },
  {
    id: 'ready-coffee-corner',
    name: 'Coffee corner',
    shelf: KITCHEN,
    room: 'kitchen',
    description:
      'Two base cabinets with an espresso machine, a kettle and two mugs, under an open shelf of jars. A breakfast station for a dining nook or an office.',
    items: [
      { a: 'kitchen-base-cabinet', x: -0.3, y: 0.3, m: { front: OAK } },
      { a: 'kitchen-base-cabinet', x: 0.3, y: 0.3, m: { front: OAK } },
      { a: 'coffee-machine', x: -0.3, y: 0.24, e: 0.9 },
      { a: 'kettle', x: 0.12, y: 0.22, e: 0.9 },
      { a: 'lived-in:coffee-mugs-pair', x: 0.38, y: 0.4, w: 0.24, d: 0.12, e: 0.9 },
      { a: 'kitchen-open-shelf', x: 0, y: 0.125, e: 1.45 },
    ],
  },
  // ───────── Dining ─────────
  {
    id: 'ready-round-dining-four',
    name: 'Round dining table for four',
    shelf: DINING,
    room: 'dining',
    description:
      'A round table with four chairs and a pendant lamp centred above it, a fruit bowl on the table. Compact; needs a 2.6 m square.',
    items: [
      { a: 'dining-table-round', x: 0, y: 0 },
      { a: 'dining-chair', x: 0, y: -0.75 },
      { a: 'dining-chair', x: 0, y: 0.75, r: UP },
      { a: 'dining-chair', x: -0.75, y: 0, r: FACE_RIGHT },
      { a: 'dining-chair', x: 0.75, y: 0, r: FACE_LEFT },
      { a: 'pendant-lamp', x: 0, y: 0 },
      { a: 'fruit-bowl', x: 0, y: 0, e: 0.75 },
    ],
  },
  {
    id: 'ready-six-seat-dining',
    name: 'Six-seat dining table with linear pendant',
    shelf: DINING,
    room: 'dining',
    description:
      'A 1.8 m table with three chairs on each side and a linear pendant above. For family dinners; needs about 3 × 2.3 m.',
    items: [
      { a: 'dining-table-rect', x: 0, y: 0, w: 1.8 },
      ...[-0.6, 0, 0.6].flatMap((x) => [
        { a: 'dining-chair', x, y: -0.68 },
        { a: 'dining-chair', x, y: 0.68, r: UP },
      ]),
      { a: 'pendant-linear', x: 0, y: 0 },
    ],
  },
  {
    id: 'ready-banquette-nook',
    name: 'Banquette dining nook',
    shelf: DINING,
    room: 'dining',
    description:
      'A wall bench with soft sage back cushions, a white quartz table and three upholstered chairs in grey and green velvet, under two woven pendants. Seats five against one wall.',
    items: [
      { a: 'bench', x: 0, y: 0.225, w: 1.6, d: 0.45, m: { wood: OAK } },
      ...[-0.6, -0.2, 0.2, 0.6].map((x) => ({
        a: 'cushion',
        x,
        y: 0.08,
        w: 0.38,
        d: 0.14,
        h: 0.42,
        e: 0.47,
        m: { fabric: 'fabric-linen-sage', piping: 'fabric-linen-sage' },
      })),
      { a: 'dining-table-rect', x: 0, y: 0.85, w: 1.5, d: 0.8, m: { top: QZ, legs: OAK } },
      {
        a: 'dining-chair-upholstered',
        x: -0.5,
        y: 1.6,
        r: UP,
        m: { upholstery: 'fabric-wool-grey', legs: OAK },
      },
      {
        a: 'dining-chair-upholstered',
        x: 0,
        y: 1.62,
        r: UP + 0.1,
        m: { upholstery: 'fabric-velvet-green', legs: OAK },
      },
      {
        a: 'dining-chair-upholstered',
        x: 0.5,
        y: 1.6,
        r: UP,
        m: { upholstery: 'fabric-wool-grey', legs: OAK },
      },
      { a: 'pendant-rattan', x: -0.4, y: 0.85, w: 0.32, d: 0.32 },
      { a: 'pendant-rattan', x: 0.4, y: 0.85, w: 0.32, d: 0.32 },
    ],
  },
  {
    id: 'ready-dinner-served',
    name: 'Family dinner on the table',
    shelf: DINING,
    room: 'dining',
    description:
      'A dining table for four with dinner served: rice, salmon and soup at every place, shared dishes in the middle, one chair pushed back. Makes renders feel lived in.',
    items: [
      { a: 'dining-table-rect', x: 0, y: 0, w: 1.6, d: 0.9 },
      { a: 'dining-chair', x: -0.4, y: -0.65 },
      { a: 'dining-chair', x: 0.4, y: -0.65 },
      { a: 'dining-chair', x: -0.4, y: 0.65, r: UP },
      { a: 'dining-chair', x: 0.45, y: 0.78, r: UP - 0.25 },
      { a: 'lived-in:dinner-place-setting', x: -0.4, y: -0.27 },
      { a: 'lived-in:dinner-place-setting', x: 0.4, y: -0.27 },
      { a: 'lived-in:dinner-place-setting', x: -0.4, y: 0.27, r: UP },
      { a: 'lived-in:dinner-place-setting', x: 0.4, y: 0.27, r: UP },
      { a: 'lived-in:shared-family-dishes', x: 0, y: 0, w: 0.55, d: 0.26 },
    ],
  },
  {
    id: 'ready-bistro-two',
    name: 'Café table for two',
    shelf: DINING,
    room: 'dining',
    description:
      'A small round table with two bentwood café chairs and two coffees. Fits a kitchen corner or a wide window bay.',
    items: [
      { a: 'dining-table-round', x: 0, y: 0, w: 0.7, d: 0.7 },
      { a: 'dining-chair-bentwood', x: -0.55, y: 0, r: FACE_RIGHT },
      { a: 'dining-chair-bentwood', x: 0.55, y: 0.05, r: FACE_LEFT + 0.2 },
      { a: 'lived-in:coffee-mugs-pair', x: 0, y: 0, w: 0.26, d: 0.14, e: 0.75 },
    ],
  },
  // ───────── Bathrooms ─────────
  {
    id: 'ready-vanity-wall',
    name: 'Vanity with LED mirror & towels',
    shelf: BATH,
    room: 'bathroom',
    description:
      'A floating oak vanity with a vessel basin, a round backlit mirror, toothbrushes and soap on the counter, a towel rail beside it and a teak bath mat.',
    items: [
      { a: 'bathroom-collection:floating-vanity-vessel', x: 0, y: 0.24, m: { cabinet: OAK } },
      { a: 'bathroom-collection:round-led-mirror', x: 0, y: 0.02, w: 0.6, h: 0.6, e: 1.15 },
      { a: 'lived-in:toiletries-set', x: 0.2, y: 0.12, w: 0.24, d: 0.11, e: 0.86 },
      { a: 'towel-rail', x: 0.75, y: 0.05, e: 0.9 },
      { a: 'bathroom-collection:teak-bath-mat', x: 0, y: 0.85, w: 0.6, d: 0.4 },
    ],
  },
  {
    id: 'ready-compact-shower-room',
    name: 'Compact shower room',
    shelf: BATH,
    room: 'bathroom',
    description:
      'A shower tray with a glass screen, a toilet with a bidet spray (vòi xịt) and a pedestal basin with a mirror, side by side along one 2.3 m wall.',
    items: [
      { a: 'shower-tray', x: -0.75, y: 0.45 },
      { a: 'toilet', x: 0.2, y: 0.34 },
      { a: 'bathroom-collection:bidet-spray', x: 0.48, y: 0.05, e: 0.25 },
      { a: 'basin-pedestal', x: 0.85, y: 0.225 },
      { a: 'bathroom-mirror', x: 0.85, y: 0.015, w: 0.5, h: 0.7, e: 1.15 },
    ],
  },
  {
    id: 'ready-bath-corner',
    name: 'Bathtub corner with towel ladder',
    shelf: BATH,
    room: 'bathroom',
    description:
      'A full-size bathtub against the wall with candles on the rim, a towel ladder leaning beside it and a teak mat to step out onto.',
    items: [
      { a: 'bathtub', x: 0, y: 0.375 },
      { a: 'candle-set', x: 0.65, y: 0.12, w: 0.24, d: 0.12, h: 0.2, e: 0.58 },
      { a: 'towel-ladder', x: 1.15, y: 0.2 },
      { a: 'bathroom-collection:teak-bath-mat', x: 0, y: 1.0, w: 0.7, d: 0.42 },
    ],
  },
  // ───────── Home office ─────────
  {
    id: 'ready-desk-setup',
    name: 'Desk with monitor & task chair',
    shelf: OFFICE,
    room: 'office',
    description:
      'A 1.4 m desk with a monitor, a task lamp and a little succulent, a mobile drawer unit, a pinboard above and an ergonomic office chair.',
    items: [
      { a: 'desk', x: 0, y: 0.35 },
      { a: 'monitor', x: -0.1, y: 0.15, e: 0.75 },
      { a: 'task-lamp', x: 0.55, y: 0.15, e: 0.75 },
      { a: 'plant-succulents', x: -0.5, y: 0.12, w: 0.25, d: 0.12, h: 0.12, e: 0.75 },
      { a: 'drawer-unit', x: 0.95, y: 0.3 },
      { a: 'pinboard', x: 0, y: 0.015, w: 0.8, h: 0.5, e: 1.3 },
      { a: 'office-chair', x: 0, y: 1.0, r: UP },
    ],
  },
  {
    id: 'ready-work-nook',
    name: 'Compact work nook',
    shelf: OFFICE,
    room: 'office',
    description:
      'A 1 m desk with a laptop and lamp, floating shelves above it and a desk chair. Fits a bedroom corner or an alcove.',
    items: [
      { a: 'desk', x: 0, y: 0.275, w: 1.0, d: 0.55 },
      { a: 'laptop', x: 0, y: 0.25, e: 0.75 },
      { a: 'task-lamp', x: 0.38, y: 0.12, e: 0.75 },
      { a: 'shelving:floating-shelf-set', x: 0, y: 0.11, e: 1.2, w: 0.9 },
      { a: 'office-chair', x: 0, y: 0.85, r: UP },
    ],
  },
  {
    id: 'ready-executive-office',
    name: 'Executive desk with bookcases',
    shelf: OFFICE,
    room: 'office',
    description:
      'A large executive desk facing the room with a chair, two tall bookcases on the wall behind and a plant in the corner. For a dedicated study.',
    items: [
      { a: 'bookcase', x: -0.55, y: 0.16 },
      { a: 'bookcase', x: 0.55, y: 0.16 },
      { a: 'office-chair', x: 0, y: 0.75 },
      { a: 'desk-executive', x: 0, y: 1.4, r: UP },
      { a: 'plant-large', x: 1.45, y: 0.45 },
    ],
  },
  // ───────── Balcony ─────────
  {
    id: 'ready-balcony-bistro',
    name: 'Balcony bistro set with plants',
    shelf: BALCONY,
    room: 'outdoor',
    description:
      'A folding bistro table and two chairs between an olive tree and a potted plant. Fits a 1.2 m deep balcony.',
    items: [
      { a: 'bistro-set', x: 0, y: 0.35 },
      { a: 'houseplants:olive-tree', x: 1.15, y: 0.35, w: 0.6, d: 0.6 },
      { a: 'plant-potted', x: -1.05, y: 0.25 },
    ],
  },
  {
    id: 'ready-laundry-balcony',
    name: 'Laundry balcony',
    shelf: BALCONY,
    room: 'outdoor',
    description:
      'A washing machine with a laundry basket next to it and a clothes drying rack: where the washing is done in most Vietnamese apartments.',
    items: [
      { a: 'washing-machine', x: -0.75, y: 0.3 },
      { a: 'laundry-basket', x: -0.2, y: 0.22 },
      { a: 'drying-rack', x: 0.85, y: 0.35, w: 1.2, d: 0.5 },
    ],
  },
  // ───────── Entry ─────────
  {
    id: 'ready-entry-getabako',
    name: 'Entry with shoe cabinet & mirror',
    shelf: ENTRY,
    room: 'storage',
    description:
      'A low shoe cabinet with house slippers, a round mirror above it, wall hooks for bags and a pair of sneakers kicked off by the door.',
    items: [
      { a: 'japanese-home:getabako', x: 0, y: 0.18 },
      { a: 'mirror-round', x: 0, y: 0.015, w: 0.55, h: 0.55, e: 1.35 },
      { a: 'wall-hooks', x: 0.85, y: 0.04, e: 1.45 },
      { a: 'lived-in:sneakers-pair', x: -0.25, y: 0.62 },
      { a: 'umbrella-stand', x: -0.7, y: 0.18 },
    ],
  },
  {
    id: 'ready-hall-bench',
    name: 'Hall bench with coat stand',
    shelf: ENTRY,
    room: 'storage',
    description:
      'A slatted shoe bench to sit on while putting shoes on, wall hooks above it, a coat stand in the corner and slippers ready by the door.',
    items: [
      { a: 'wooden-storage:slatted-shoe-bench', x: 0, y: 0.18 },
      { a: 'wall-hooks', x: 0, y: 0.04, e: 1.4 },
      { a: 'coat-stand', x: 0.85, y: 0.3 },
      { a: 'lived-in:house-slippers', x: -0.3, y: 0.62 },
    ],
  },
];

// ───────── L-shaped kitchens (generated) ─────────

const L_KITCHENS = 'L-shaped kitchens';

/** Base modules of an L-kitchen leg: asset, width along the run, and whether it is full height. */
const MODULES = {
  drawer: { a: 'kitchen-collection:base-drawer-unit', w: 0.6 },
  base: { a: 'kitchen-base-cabinet', w: 0.6 },
  hl: { a: 'kitchen-collection:base-handleless', w: 0.6 },
  sink: { a: 'kitchen-sink-unit', w: 0.8 },
  sink2: { a: 'kitchen-collection:sink-double', w: 1.2 },
  farmsink: { a: 'kitchen-collection:sink-base-farmhouse', w: 0.9 },
  hob: { a: 'kitchen-collection:hob-induction', w: 0.8 },
  gas: { a: 'kitchen-collection:hob-gas', w: 0.9 },
  cooktop: { a: 'kitchen-cooktop', w: 0.6 },
  tall: { a: 'kitchen-tall-cabinet', w: 0.6, tall: true },
  oven: { a: 'kitchen-collection:oven-microwave-tower', w: 0.6, tall: true },
  pantry: { a: 'kitchen-collection:pantry-pullout', w: 0.3, tall: true },
  fridge: { a: 'fridge', w: 0.7, tall: true },
} as const;
type ModKey = keyof typeof MODULES;
const SINKS = new Set<ModKey>(['sink', 'sink2', 'farmsink']);
const HOBS = new Set<ModKey>(['hob', 'gas', 'cooktop']);

interface LKitchen {
  id: string;
  name: string;
  about: string;
  /** Long leg along the back wall, then the short leg down the side wall, both from the corner out. */
  a: ModKey[];
  b: ModKey[];
  front: string;
  worktop: string;
  handle: string;
  upper: 'cabinets' | 'glass' | 'shelves';
  upperFront?: string;
  fridge?: string;
  hood?: 'chimney' | 'cylinder';
  /** Corner on the right (the short leg runs down the right-hand wall). */
  right?: boolean;
  extras?: ReadyItem[];
}

interface Spot {
  x: number;
  y: number;
  r: number;
  w: number;
}

/**
 * An L-shaped kitchen: a 1 m blind-corner cupboard in the back-left corner, the long leg along the
 * back wall and the short leg down the left wall (mirrored with `right`). Every base module gets a
 * wall cupboard (or glass cupboard, or open shelf) above it, except the hob, which gets a hood, and
 * full-height units. The corner gets a corner wall unit and two fillers. A soap bottle goes by the
 * sink, condiments by the hob and a kettle on the first free worktop.
 */
function lKitchen(k: LKitchen): ReadyGroupSpec {
  const fin = { front: k.front, worktop: k.worktop, handle: k.handle, channel: k.handle };
  const up = { front: k.upperFront ?? k.front, handle: k.handle };
  const items: ReadyItem[] = [];
  const UP_E = 1.45;
  items.push({ a: 'kitchen-corner-cabinet', x: 0.5, y: 0.5, m: fin });
  if (k.upper === 'shelves')
    items.push({
      a: 'kitchen-collection:open-corner-shelves',
      x: 0.16,
      y: 0.16,
      e: UP_E,
      m: { panel: k.upperFront ?? k.front },
    });
  else {
    items.push({ a: 'kitchen-collection:wall-corner-unit', x: 0.3, y: 0.3, e: UP_E, m: up });
    items.push({ a: 'kitchen-wall-cabinet', x: 0.8, y: 0.175, w: 0.4, e: UP_E, m: up });
    items.push({ a: 'kitchen-wall-cabinet', x: 0.175, y: 0.8, w: 0.4, r: FACE_RIGHT, e: UP_E, m: up });
  }
  const spots: { sink?: Spot; hob?: Spot; free?: Spot } = {};
  const leg = (mods: ModKey[], alongX: boolean): number => {
    let s = 1.0;
    for (const key of mods) {
      const mod = MODULES[key];
      const c = s + mod.w / 2;
      const r = alongX ? 0 : FACE_RIGHT;
      const at = (depth: number) => (alongX ? { x: c, y: depth } : { x: depth, y: c });
      const isTall = 'tall' in mod;
      const m = key === 'fridge' ? { body: k.fridge ?? 'metal-brushed-steel' } : fin;
      items.push({ a: mod.a, ...at(0.3), r, w: mod.w, d: key === 'fridge' ? 0.66 : 0.6, m });
      if (SINKS.has(key) && !spots.sink) spots.sink = { ...at(0.12), r, w: mod.w };
      if (HOBS.has(key) && !spots.hob) spots.hob = { ...at(0.12), r, w: mod.w };
      if (!isTall && !SINKS.has(key) && !HOBS.has(key) && !spots.free)
        spots.free = { ...at(0.25), r, w: mod.w };
      if (!isTall) {
        if (HOBS.has(key)) {
          items.push(
            k.hood === 'cylinder'
              ? { a: 'soft-modern-home:cylinder-wall-cooker-hood', ...at(0.2), r }
              : { a: 'range-hood', ...at(0.25), r, w: Math.min(0.9, mod.w) },
          );
        } else if (k.upper === 'glass')
          items.push({
            a: 'kitchen-collection:base-glass-wall-unit',
            ...at(0.175),
            r,
            w: mod.w,
            e: UP_E,
            m: up,
          });
        else if (k.upper === 'shelves')
          items.push({ a: 'kitchen-open-shelf', ...at(0.125), r, w: mod.w, e: 1.5 });
        else items.push({ a: 'kitchen-wall-cabinet', ...at(0.175), r, w: mod.w, e: UP_E, m: up });
      }
      s += mod.w;
    }
    return s;
  };
  const lenA = leg(k.a, true);
  const lenB = leg(k.b, false);
  if (k.upper !== 'shelves')
    items.push({
      a: 'lighting-collection:under-cabinet-led',
      x: 1.0 + Math.min(1.2, lenA - 1.2) / 2 + 0.05,
      y: 0.33,
      w: Math.min(1.2, lenA - 1.2),
      e: 1.43,
    });
  // Along a leg: offset `t` metres from the module centre towards its far end.
  const along = (p: Spot, t: number) => (p.r ? { x: p.x, y: p.y + t } : { x: p.x + t, y: p.y });
  if (spots.sink)
    items.push({
      a: 'lived-in:dish-soap-sponge',
      ...along(spots.sink, spots.sink.w / 2 - 0.12),
      r: spots.sink.r,
      w: 0.2,
      d: 0.09,
      e: 0.9,
    });
  if (spots.hob)
    items.push({
      a: 'lived-in:cooking-condiments',
      ...along(spots.hob, spots.hob.w / 2 - 0.16),
      r: spots.hob.r,
      w: 0.28,
      d: 0.12,
      e: 0.9,
    });
  if (spots.free) items.push({ a: 'kettle', ...along(spots.free, 0), r: spots.free.r, e: 0.9 });
  items.push(...(k.extras ?? []));
  // Right-handed: mirror across the vertical axis (the corner cupboard itself is mirrored too).
  const out = k.right
    ? items.map((it) => ({
        ...it,
        x: -it.x,
        r: it.r ? -it.r : it.r,
        mi: it.a === 'kitchen-corner-cabinet' ? true : it.mi,
      }))
    : items;
  const m1 = (v: number) => (Math.round(v * 10) / 10).toFixed(1);
  return {
    id: k.id,
    name: k.name,
    shelf: L_KITCHENS,
    room: 'kitchen',
    description: `${k.about} Legs of ${m1(lenA)} m and ${m1(lenB)} m.`,
    items: out,
  };
}

const L_KITCHEN_SPECS: ReadyGroupSpec[] = [
  lKitchen({
    id: 'ready-l-oak-white',
    name: 'L kitchen in oak & white',
    about:
      'Light oak base cupboards with black handles, a white quartz worktop and white wall cupboards; sink and induction hob on the long leg with the fridge at its end, an oven tower closing the short leg.',
    a: ['drawer', 'sink', 'base', 'hob', 'fridge'],
    b: ['base', 'drawer', 'oven'],
    front: OAK,
    worktop: QZ,
    handle: 'metal-black-matte',
    upper: 'cabinets',
    upperFront: 'paint-satin-white',
    fridge: 'metal-white-powder',
  }),
  lKitchen({
    id: 'ready-l-oak-white-right',
    name: 'L kitchen in oak & white, corner right',
    about:
      'The oak and white L kitchen with the corner on the right-hand side, for rooms where the side wall is on the right.',
    a: ['drawer', 'sink', 'base', 'hob', 'fridge'],
    b: ['base', 'drawer', 'oven'],
    front: OAK,
    worktop: QZ,
    handle: 'metal-black-matte',
    upper: 'cabinets',
    upperFront: 'paint-satin-white',
    fridge: 'metal-white-powder',
    right: true,
  }),
  lKitchen({
    id: 'ready-l-sage-brass',
    name: 'Sage L kitchen with glass wall cupboards',
    about:
      'Sage lacquer fronts with antique brass handles, a fireclay farmhouse sink, glass-fronted wall cupboards showing the crockery and a tall larder cupboard; the fridge closes the short leg.',
    a: ['drawer', 'farmsink', 'base', 'hob', 'tall'],
    b: ['base', 'base', 'fridge'],
    front: SAGE,
    worktop: QZ,
    handle: 'metal-brass',
    upper: 'glass',
    fridge: 'metal-black-matte',
  }),
  lKitchen({
    id: 'ready-l-navy-shaker',
    name: 'Navy shaker L kitchen with gas hob',
    about:
      'Deep navy cupboards with brass handles under a Carrara marble worktop, white wall cupboards, a double sink, a gas hob under a chimney hood, an oven tower and a tall pantry cupboard.',
    a: ['drawer', 'sink2', 'base', 'gas'],
    b: ['drawer', 'oven', 'tall'],
    front: 'paint-navy',
    worktop: 'stone-marble-carrara',
    handle: 'metal-brass',
    upper: 'cabinets',
    upperFront: 'paint-satin-white',
  }),
  lKitchen({
    id: 'ready-l-handleless-white',
    name: 'Handleless white L kitchen',
    about:
      'Flat matt white handleless cupboards with finger channels, a white quartz top and matching wall cupboards: a quiet, modern kitchen with the fridge on the short leg.',
    a: ['hl', 'sink', 'hl', 'hob'],
    b: ['hl', 'fridge'],
    front: 'laminate-white-matte',
    worktop: QZ,
    handle: 'metal-brushed-steel',
    upper: 'cabinets',
    fridge: 'metal-white-powder',
  }),
  lKitchen({
    id: 'ready-l-compact',
    name: 'Compact L kitchenette',
    about:
      'The smallest useful L: a corner cupboard, a sink and a two-zone cooktop on one side, a base cupboard and a fridge on the other. For studios and small apartments.',
    a: ['sink', 'cooktop'],
    b: ['base', 'fridge'],
    front: OAK,
    worktop: QZ,
    handle: 'metal-black-matte',
    upper: 'cabinets',
    upperFront: 'paint-satin-white',
    hood: 'cylinder',
    fridge: 'metal-white-powder',
  }),
  lKitchen({
    id: 'ready-l-black-walnut',
    name: 'Black & walnut L kitchen',
    about:
      'Matt black cupboards with brass handles and a walnut worktop, walnut wall cupboards, an oven tower at the end of the long leg and a tall cupboard beside a black fridge.',
    a: ['drawer', 'sink', 'drawer', 'hob', 'oven'],
    b: ['base', 'drawer', 'tall', 'fridge'],
    front: 'paint-soft-black',
    worktop: 'wood-walnut',
    handle: 'metal-brass',
    upper: 'cabinets',
    upperFront: 'wood-walnut',
    fridge: 'metal-black-matte',
  }),
  lKitchen({
    id: 'ready-l-black-walnut-right',
    name: 'Black & walnut L kitchen, corner right',
    about:
      'The black and walnut L kitchen with the corner on the right-hand side, for rooms where the side wall is on the right.',
    a: ['drawer', 'sink', 'drawer', 'hob', 'oven'],
    b: ['base', 'drawer', 'tall', 'fridge'],
    front: 'paint-soft-black',
    worktop: 'wood-walnut',
    handle: 'metal-brass',
    upper: 'cabinets',
    upperFront: 'wood-walnut',
    fridge: 'metal-black-matte',
    right: true,
  }),
  lKitchen({
    id: 'ready-l-terracotta-shelves',
    name: 'Terracotta L kitchen with open shelves',
    about:
      'Terracotta cupboards with brass handles, a farmhouse sink, a cylinder hood and open oak shelves of jars and crockery instead of wall cupboards, with a spice rack on the side wall.',
    a: ['drawer', 'farmsink', 'hob'],
    b: ['base', 'drawer'],
    front: 'paint-terracotta',
    worktop: QZ,
    handle: 'metal-brass',
    upper: 'shelves',
    upperFront: 'paint-cream',
    hood: 'cylinder',
    extras: [{ a: 'kitchen-collection:spice-rack', x: 0.045, y: 2.0, r: FACE_RIGHT, e: 1.05 }],
  }),
  lKitchen({
    id: 'ready-l-greige-concrete',
    name: 'Greige L kitchen with concrete top',
    about:
      'Handleless greige cupboards under a concrete worktop, a double sink, an oven tower, a pull-out pantry and a fridge: an industrial-soft family kitchen.',
    a: ['hl', 'sink2', 'hl', 'hob', 'oven'],
    b: ['hl', 'hl', 'pantry', 'fridge'],
    front: 'paint-greige',
    worktop: 'concrete-grey',
    handle: 'metal-black-matte',
    upper: 'cabinets',
  }),
  lKitchen({
    id: 'ready-l-butter-oak',
    name: 'Butter-yellow L kitchen with oak top',
    about:
      'Soft butter-yellow cupboards with brass handles and a solid oak worktop, matching wall cupboards and a cylinder hood: a cheerful small L.',
    a: ['drawer', 'sink', 'hob'],
    b: ['base', 'base'],
    front: 'paint-butter',
    worktop: 'wood-oak-natural',
    handle: 'metal-brass',
    upper: 'cabinets',
    hood: 'cylinder',
  }),
  lKitchen({
    id: 'ready-l-grey-oak-large',
    name: 'Large grey-oak L kitchen',
    about:
      'A big L in grey oak with a Carrara worktop: double sink, plenty of drawers, induction hob, a tall cupboard at the end of the long leg, an oven tower and a fridge on the short leg.',
    a: ['drawer', 'sink2', 'base', 'drawer', 'hob', 'tall'],
    b: ['base', 'drawer', 'oven', 'fridge'],
    front: 'wood-grey-oak',
    worktop: 'stone-marble-carrara',
    handle: 'metal-black-matte',
    upper: 'cabinets',
  }),
  lKitchen({
    id: 'ready-l-forest-green',
    name: 'Forest-green L kitchen with gas hob',
    about:
      'Forest-green cupboards with brass handles and a white quartz worktop, glass-fronted wall cupboards, a gas hob under a chimney hood and a fridge on the short leg.',
    a: ['drawer', 'sink', 'base', 'gas'],
    b: ['drawer', 'fridge'],
    front: 'paint-forest',
    worktop: QZ,
    handle: 'metal-brass',
    upper: 'glass',
    fridge: 'metal-black-matte',
  }),
  lKitchen({
    id: 'ready-l-vietnamese',
    name: 'Vietnamese apartment L kitchen',
    about:
      'The typical new-apartment kitchen in Vietnam: white cupboards, a granite worktop, a double sink with a dish rack, a gas hob under a chimney hood, a rice cooker and the fridge on the short leg.',
    a: ['base', 'sink2', 'base', 'gas'],
    b: ['base', 'base', 'fridge'],
    front: 'laminate-white-matte',
    worktop: 'stone-granite',
    handle: 'metal-brushed-steel',
    upper: 'cabinets',
    extras: [
      { a: 'kitchen-collection:dish-drying-rack', x: 2.6, y: 0.22, e: 0.9 },
      { a: 'asian-everyday:rice-cooker', x: 0.3, y: 1.3, w: 0.3, d: 0.3, h: 0.25, e: 0.9 },
    ],
  }),
];
READY_GROUP_SPECS.push(...L_KITCHEN_SPECS);

// ───────── Desk setups ─────────

READY_GROUP_SPECS.push(
  {
    id: 'ready-l-desk-workstation',
    name: 'L-desk workstation with mesh chair',
    shelf: OFFICE,
    room: 'office',
    description: 'An L-shaped corner desk with a monitor, keyboard and notebook, a task lamp and an ergonomic mesh chair. Fits a 1.6 × 1.4 m corner plus room to pull the chair out.',
    items: [
      { a: 'workspace:l-desk-corner-left', x: 0, y: 0.7 },
      { a: 'monitor', x: 0.3, y: 0.18, e: 0.75 },
      { a: 'workspace:desk-essentials', x: 0.3, y: 0.42, e: 0.75 },
      { a: 'task-lamp', x: 0.68, y: 0.15, e: 0.75 },
      { a: 'workspace:ergonomic-mesh-chair', x: 0.3, y: 1.0, r: UP },
    ],
  },
  {
    id: 'ready-gaming-corner',
    name: 'Gaming corner with two monitors',
    shelf: OFFICE,
    room: 'office',
    description: 'A black gaming L desk with two monitors on its raised shelf, an RGB strip, keyboard and mouse, and a racing-style gaming chair.',
    items: [
      { a: 'workspace:l-desk-gaming', x: 0, y: 0.6 },
      { a: 'monitor', x: 0.08, y: 0.13, e: 0.87 },
      { a: 'monitor', x: 0.56, y: 0.13, e: 0.87 },
      { a: 'workspace:desk-essentials', x: 0.32, y: 0.42, e: 0.75, m: { device: 'workspace:nylon-black' } },
      { a: 'chair-gaming', x: 0.32, y: 1.0, r: UP },
    ],
  },
  {
    id: 'ready-standing-desk-setup',
    name: 'Standing desk setup',
    shelf: OFFICE,
    room: 'office',
    description: 'An electric sit-stand desk with a monitor, keyboard and notebook, an ergonomic mesh chair for the sitting hours and a plant beside it.',
    items: [
      { a: 'workspace:standing-desk-electric', x: 0, y: 0.35 },
      { a: 'monitor', x: 0, y: 0.15, e: 0.74 },
      { a: 'workspace:desk-essentials', x: 0, y: 0.42, e: 0.74 },
      { a: 'workspace:ergonomic-mesh-chair', x: 0, y: 1.0, r: UP },
      { a: 'houseplants:zz-plant', x: 0.95, y: 0.25, w: 0.45, d: 0.45 },
    ],
  },
);

// ───────── Pet corners ─────────

const PETS = 'Pet corners';

READY_GROUP_SPECS.push(
  {
    id: 'ready-lovebird-corner',
    name: 'Lovebird corner',
    shelf: PETS,
    room: 'pets',
    description: 'A modular wire cage with a pair of lovebirds (green and blue) on the perch, a wooden play stand for time out of the cage and a snake plant. About 2 × 0.6 m along a wall.',
    items: [
      { a: 'pets:modular-bird-cage', x: 0, y: 0.185 },
      { a: 'pets:lovebird', x: -0.23, y: 0.185, e: 0.458 },
      { a: 'pets:lovebird', x: -0.13, y: 0.185, r: 0.4, e: 0.458, m: { body: 'pets:lovebird-blue', face: 'pets:white-plastic' } },
      { a: 'pets:bird-play-stand', x: 0.85, y: 0.3 },
      { a: 'houseplants:snake-plant', x: -0.65, y: 0.25, w: 0.35, d: 0.35 },
    ],
  },
  {
    id: 'ready-cat-corner',
    name: 'Cat corner',
    shelf: PETS,
    room: 'pets',
    description: 'A tall cat tree with a condo and hammock, a litter cabinet with a cat asleep on top, tilted bowls and a water fountain, and a felt cave to hide in.',
    items: [
      { a: 'pets:cat-tree-tall', x: 0, y: 0.25 },
      { a: 'pets:cat-litter-cabinet', x: 1.0, y: 0.25 },
      { a: 'pets:sleeping-cat', x: 1.05, y: 0.25, r: -0.3, e: 0.6 },
      { a: 'pets:cat-bowls-tilted', x: -0.62, y: 0.15 },
      { a: 'pets:pet-water-fountain', x: -0.62, y: 0.42 },
      { a: 'pets:cat-felt-cave', x: -0.55, y: 0.95 },
    ],
  },
  {
    id: 'ready-dog-corner',
    name: 'Dog corner',
    shelf: PETS,
    room: 'pets',
    description: 'A bolster dog bed against the wall, a raised double bowl beside it and a basket of toys: everything a dog needs in about 2.4 × 0.8 m.',
    items: [
      { a: 'pets:dog-bed-bolster', x: 0, y: 0.36 },
      { a: 'pets:raised-double-dog-bowl', x: 0.85, y: 0.15 },
      { a: 'pets:dog-toy-basket', x: -0.8, y: 0.17 },
    ],
  },
);

/** Shelf order in the Groups tab. */
export const READY_GROUP_SHELVES = [
  BED,
  LIVING,
  KITCHEN,
  L_KITCHENS,
  DINING,
  BATH,
  KIDS,
  OFFICE,
  PETS,
  BALCONY,
  ENTRY,
];

/** Footprint half-extents of an item turned by `r`. */
function extents(w: number, d: number, r: number): [number, number] {
  const c = Math.abs(Math.cos(r));
  const s = Math.abs(Math.sin(r));
  return [(w * c + d * s) / 2, (w * s + d * c) / 2];
}

/** Turns a spec into a saved group (items relative to the footprint centre). Unknown items are skipped. */
export function buildReadyGroup(spec: ReadyGroupSpec): SavedGroup {
  const items: SavedGroup['items'] = [];
  const boxes: [number, number, number, number][] = [];
  for (const it of spec.items) {
    const a = getAsset(null, it.a);
    if (!a) continue;
    const w = it.w ?? a.defaultSize.w;
    const d = it.d ?? a.defaultSize.d;
    const h = it.h ?? a.defaultSize.h;
    const r = it.r ?? 0;
    const [ex, ey] = extents(w, d, r);
    boxes.push([it.x - ex, it.y - ey, it.x + ex, it.y + ey]);
    items.push({
      assetId: a.id,
      name: null,
      dx: it.x,
      dy: it.y,
      elevation: it.e ?? a.defaultElevation,
      rotation: ((r % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI),
      width: w,
      depth: d,
      height: h,
      mirrored: Boolean(it.mi),
      materials: { ...(it.m ?? {}) },
    });
  }
  const x0 = Math.min(...boxes.map((b) => b[0]));
  const y0 = Math.min(...boxes.map((b) => b[1]));
  const x1 = Math.max(...boxes.map((b) => b[2]));
  const y1 = Math.max(...boxes.map((b) => b[3]));
  const cx = boxes.length ? (x0 + x1) / 2 : 0;
  const cy = boxes.length ? (y0 + y1) / 2 : 0;
  for (const it of items) {
    it.dx -= cx;
    it.dy -= cy;
  }
  return {
    id: spec.id,
    name: spec.name,
    description: spec.description,
    shelf: spec.shelf,
    room: spec.room,
    createdAt: 0,
    items,
    size: boxes.length ? { w: x1 - x0, d: y1 - y0 } : { w: 0.5, d: 0.5 },
  };
}

let cache: { version: number; groups: SavedGroup[]; byId: Map<string, SavedGroup> } | null = null;

/** Every ready-made group (rebuilt when content packs change, so pack items resolve). */
export function readyGroups(): SavedGroup[] {
  const v = packVersion();
  if (!cache || cache.version !== v) {
    const groups = READY_GROUP_SPECS.map(buildReadyGroup).filter((g) => g.items.length >= 2);
    cache = { version: v, groups, byId: new Map(groups.map((g) => [g.id, g])) };
  }
  return cache.groups;
}

export const readyGroupById = (id: string): SavedGroup | undefined => {
  readyGroups();
  return cache?.byId.get(id);
};

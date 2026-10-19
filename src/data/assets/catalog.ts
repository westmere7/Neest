/**
 * Built-in procedural asset catalogue.
 *
 * Every asset is original, generated from primitive parts at runtime (no external models), and
 * fully parametric: `build(size)` re-lays out its parts for any size within min/max. Individual
 * categories live in sibling modules; shared authoring helpers are in ./parts.ts.
 *
 * Browsing follows the Sims "Buy mode" idea: shop by room (`category`) or by type (`type`), with
 * each listing split into shelves (`group`).
 */
import type { AssetCategory, AssetDefinition, AssetType } from './types';
import { BATHROOM_ASSETS } from './bathroom';
import { BEDROOM_ASSETS } from './bedroom';
import { CONSTRUCTION_ASSETS } from './construction';
import { DECOR_ASSETS } from './decor';
import { DINING_ASSETS } from './dining';
import { ELECTRONICS_ASSETS } from './electronics';
import { GENERIC_ASSETS } from './generic';
import { HOBBIES_ASSETS } from './hobbies';
import { KIDS_ASSETS } from './kids';
import { KITCHEN_ASSETS } from './kitchen';
import { LAUNDRY_ASSETS } from './laundry';
import { LIGHTING_ASSETS } from './lighting';
import { LIVING_ASSETS } from './living';
import { OFFICE_ASSETS } from './office';
import { OUTDOOR_ASSETS } from './outdoor';
import { STORAGE_ASSETS } from './storage';

export const ASSET_CATALOG: AssetDefinition[] = [
  ...LIVING_ASSETS,
  ...BEDROOM_ASSETS,
  ...KIDS_ASSETS,
  ...DINING_ASSETS,
  ...KITCHEN_ASSETS,
  ...BATHROOM_ASSETS,
  ...LAUNDRY_ASSETS,
  ...OFFICE_ASSETS,
  ...HOBBIES_ASSETS,
  ...OUTDOOR_ASSETS,
  ...STORAGE_ASSETS,
  ...LIGHTING_ASSETS,
  ...DECOR_ASSETS,
  ...ELECTRONICS_ASSETS,
  ...CONSTRUCTION_ASSETS,
  ...GENERIC_ASSETS,
];

export const ASSETS_BY_ID: Record<string, AssetDefinition> = Object.fromEntries(
  ASSET_CATALOG.map((a) => [a.id, a]),
);

/** A built-in asset by id (packs use it through the kit to build versions of library items). */
const BUILT_IN_BY_ID = new Map(ASSET_CATALOG.map((a) => [a.id, a]));
export const builtInAsset = (id: string): AssetDefinition | undefined => BUILT_IN_BY_ID.get(id);

/**
 * Special entry in `render.hiddenCategories`: hides every ceiling-mounted item (pendants, fans,
 * ceiling lights…) whatever its room, while their light keeps shining.
 */
export const CEILING_CATEGORY = 'ceiling';

/** Whether an asset is hidden by the render settings' category filter. */
export function isAssetHidden(asset: Pick<AssetDefinition, 'category' | 'mount'> | null | undefined, hidden: readonly string[]): boolean {
  if (!asset || !hidden.length) return false;
  return hidden.includes(asset.category) || (asset.mount === 'ceiling' && hidden.includes(CEILING_CATEGORY));
}

export const ASSET_CATEGORY_LABELS: Record<AssetCategory, string> = {
  living: 'Living room',
  bedroom: 'Bedroom',
  kids: 'Kids & nursery',
  dining: 'Dining',
  kitchen: 'Kitchen',
  bathroom: 'Bathroom',
  laundry: 'Laundry & utility',
  office: 'Study & office',
  hobbies: 'Hobbies & fitness',
  pets: 'Pets',
  outdoor: 'Balcony & outdoor',
  storage: 'Storage',
  lighting: 'Lighting',
  decor: 'Decor',
  plants: 'Plants & flowers',
  electronics: 'Electronics',
  people: 'People',
  construction: 'Structure',
  generic: 'Basic shapes',
  custom: 'Imported models',
};

/** Display order for the asset library (imported 'custom' models are listed separately). */
export const ASSET_CATEGORY_ORDER: AssetCategory[] = [
  'living',
  'bedroom',
  'kids',
  'dining',
  'kitchen',
  'bathroom',
  'laundry',
  'office',
  'hobbies',
  'pets',
  'outdoor',
  'storage',
  'lighting',
  'decor',
  'plants',
  'electronics',
  'people',
  'construction',
  'generic',
];

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  seating: 'Seating',
  beds: 'Beds',
  surfaces: 'Tables & surfaces',
  storage: 'Storage',
  appliances: 'Appliances',
  plumbing: 'Plumbing',
  lighting: 'Lighting',
  decor: 'Decorations',
  plants: 'Plants',
  electronics: 'Electronics',
  activities: 'Hobbies & skills',
  pets: 'Pets',
  kids: 'Kids',
  people: 'People',
  structure: 'Structure',
  misc: 'Basic shapes',
};

export const ASSET_TYPE_ORDER: AssetType[] = [
  'seating',
  'beds',
  'surfaces',
  'storage',
  'appliances',
  'plumbing',
  'lighting',
  'decor',
  'plants',
  'electronics',
  'activities',
  'pets',
  'kids',
  'people',
  'structure',
  'misc',
];

/**
 * Shelves within each type, in display order. Assets name one of these as their `group`;
 * listings show shelves in this order (unknown groups sort last, alphabetically).
 */
export const ASSET_GROUPS: Record<AssetType, string[]> = {
  seating: [
    'Sofas & loveseats',
    'Living chairs',
    'Ottomans & poufs',
    'Dining chairs',
    'Stools & benches',
    'Desk chairs',
    'Outdoor seating',
  ],
  beds: ['Beds', 'Wall beds', 'Bunk & loft beds', 'Daybeds & sofa beds', 'Cots & kids beds'],
  surfaces: [
    'Coffee tables',
    'End tables',
    'Console tables',
    'Nightstands',
    'Dining tables',
    'Counters & cabinets',
    'Desks',
    'Vanity & dressing tables',
    'Outdoor tables',
  ],
  storage: [
    'Wardrobes',
    'Dressers & chests',
    'Bookcases & shelves',
    'Sideboards & cabinets',
    'Media units',
    'Kitchen cabinets',
    'Office storage',
    'Hallway storage',
    'Baskets & boxes',
  ],
  appliances: ['Cooking', 'Refrigeration', 'Cleaning', 'Laundry', 'Small appliances', 'Outdoor cooking'],
  plumbing: ['Toilets', 'Sinks', 'Showers & tubs', 'Bathroom accessories', 'Water heating'],
  lighting: ['Ceiling lights', 'Floor lamps', 'Table lamps', 'Wall lights', 'Outdoor & string lights'],
  decor: [
    'Rugs',
    'Wall art',
    'Abstract paintings',
    'Landscape paintings',
    'Animal paintings',
    'Mirrors',
    'Clocks',
    'Curtains & blinds',
    'Cushions & throws',
    'Ornaments',
    'Candles & tabletop',
    'Beauty & makeup',
    'Screens & dividers',
    'Fireplaces',
  ],
  people: ['Standing', 'Sitting', 'Lying down', 'Kitchen & chores', 'Grooming', 'Exercise & leisure', 'Children'],
  plants: ['Indoor plants', 'Trees', 'Succulents & cacti', 'Hanging plants', 'Wall & vertical gardens', 'Terrariums & moss', 'Herbs & edibles', 'Cut & dried flowers', 'Outdoor plants'],
  electronics: ['TV & audio', 'Computers', 'Gaming', 'Climate', 'Smart home'],
  activities: ['Music', 'Fitness', 'Games', 'Creative', 'Knowledge'],
  pets: ['Bird cages', 'Bird accessories', 'Pet birds & animals', 'Dog beds & crates', 'Cat furniture', 'Feeding & care'],
  kids: ['Toys', 'Kids furniture', 'Nursery'],
  structure: ['Columns', 'Partitions', 'Heating', 'Built-ins', 'Stairs & steps'],
  misc: ['Basic shapes', 'Imported models'],
};

/** Sort key for a group within its type (known groups first, in ASSET_GROUPS order). */
export function groupRank(type: AssetType, group: string): number {
  const i = ASSET_GROUPS[type]?.indexOf(group) ?? -1;
  return i < 0 ? 1000 : i;
}

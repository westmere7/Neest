/**
 * Built-in procedural asset catalogue.
 *
 * Every asset is original, generated from primitive parts at runtime (no external models), and
 * fully parametric: `build(size)` re-lays out its parts for any size within min/max. Individual
 * categories live in sibling modules; shared authoring helpers are in ./parts.ts.
 */
import type { AssetCategory, AssetDefinition } from './types';
import { BATHROOM_ASSETS } from './bathroom';
import { BEDROOM_ASSETS } from './bedroom';
import { CONSTRUCTION_ASSETS } from './construction';
import { DECOR_ASSETS } from './decor';
import { DINING_ASSETS } from './dining';
import { ELECTRONICS_ASSETS } from './electronics';
import { GENERIC_ASSETS } from './generic';
import { KITCHEN_ASSETS } from './kitchen';
import { LIGHTING_ASSETS } from './lighting';
import { LIVING_ASSETS } from './living';
import { OFFICE_ASSETS } from './office';
import { STORAGE_ASSETS } from './storage';

export const ASSET_CATALOG: AssetDefinition[] = [
  ...LIVING_ASSETS,
  ...BEDROOM_ASSETS,
  ...DINING_ASSETS,
  ...KITCHEN_ASSETS,
  ...BATHROOM_ASSETS,
  ...OFFICE_ASSETS,
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

export const ASSET_CATEGORY_LABELS: Record<AssetCategory, string> = {
  living: 'Living room',
  bedroom: 'Bedroom',
  dining: 'Dining',
  kitchen: 'Kitchen',
  bathroom: 'Bathroom',
  office: 'Office',
  storage: 'Storage',
  lighting: 'Lighting',
  decor: 'Decor',
  electronics: 'Electronics',
  construction: 'Construction',
  generic: 'Basic shapes',
  custom: 'Imported models',
};

/** Display order for the asset library (imported 'custom' models are listed separately). */
export const ASSET_CATEGORY_ORDER: AssetCategory[] = [
  'living',
  'bedroom',
  'dining',
  'kitchen',
  'bathroom',
  'office',
  'storage',
  'lighting',
  'decor',
  'electronics',
  'construction',
  'generic',
];

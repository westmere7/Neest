/**
 * Built-in parametric asset contract.
 *
 * Local object space: origin at the centre of the footprint at floor/base level.
 *   x ∈ [-w/2, w/2]  — width (left → right as seen from the front)
 *   z ∈ [-d/2, d/2]  — depth; +z is the FRONT of the object (the side a person uses)
 *   y ∈ [0, h]       — height above the object's base elevation
 * In plan view at rotation 0 the front faces +y (down the screen). Back = -z.
 *
 * Parts are positioned by their centre. All values are metres / radians.
 */

/** The room an asset is sold for ("shop by room"). */
export type AssetCategory =
  | 'construction'
  | 'living'
  | 'bedroom'
  | 'kids'
  | 'dining'
  | 'kitchen'
  | 'bathroom'
  | 'laundry'
  | 'office'
  | 'hobbies'
  | 'outdoor'
  | 'storage'
  | 'lighting'
  | 'decor'
  | 'electronics'
  | 'generic'
  | 'custom';

/** What an asset is ("shop by type"), independent of the room. */
export type AssetType =
  | 'seating'
  | 'beds'
  | 'surfaces'
  | 'storage'
  | 'appliances'
  | 'plumbing'
  | 'lighting'
  | 'decor'
  | 'plants'
  | 'electronics'
  | 'activities'
  | 'kids'
  | 'structure'
  | 'misc';

export interface Size3 {
  w: number;
  d: number;
  h: number;
}

export type PartShape =
  /** Axis-aligned box of size [x, y, z] (before rotation). Optional bevel radius for rounded edges. */
  | { shape: 'box'; size: [number, number, number]; bevel?: number }
  /** Vertical cylinder/cone along local Y. */
  | { shape: 'cylinder'; radiusTop: number; radiusBottom: number; height: number; segments?: number }
  | { shape: 'sphere'; radius: number }
  /** Torus lying in the XY plane (rotate [Math.PI/2,0,0] to lay it flat). */
  | { shape: 'torus'; radius: number; tube: number; arc?: number }
  /** Surface of revolution around local Y; profile points are [radius, y] from bottom to top. */
  | { shape: 'lathe'; profile: [number, number][]; segments?: number }
  /** Prism: outline in the X/Z plane (top-down [x, z] points), extruded from y=0 to y=height. */
  | { shape: 'prism'; outline: [number, number][]; height: number };

export type Part = PartShape & {
  /** Centre position [x, y, z] in local object space. For 'prism', the outline origin at its base. */
  position: [number, number, number];
  /** Euler XYZ rotation in radians. */
  rotation?: [number, number, number];
  /** Non-uniform scale applied after the shape is built. */
  scale?: [number, number, number];
  /** Material slot id (must exist in the asset's `slots`). */
  slot: string;
  /** Include in the derived 2D plan footprint (default true). */
  plan?: boolean;
};

/** Extra 2D plan detail drawn on top of the derived footprint, in local [x, z] coords. */
export type PlanStroke =
  | { kind: 'line'; a: [number, number]; b: [number, number] }
  | { kind: 'circle'; c: [number, number]; r: number }
  | { kind: 'poly'; points: [number, number][]; closed?: boolean };

export interface MaterialSlot {
  id: string;
  label: string;
  /** Id of a material in the built-in material catalogue. */
  defaultMaterial: string;
}

export interface AssetDefinition {
  id: string;
  name: string;
  category: AssetCategory;
  /** Function type for "shop by type" browsing. */
  type: AssetType;
  /** Shelf within the type/room listing, e.g. "Sofas & loveseats" (see ASSET_GROUPS). */
  group: string;
  tags: string[];
  defaultSize: Size3;
  minSize?: Size3;
  maxSize?: Size3;
  resizable: { w: boolean; d: boolean; h: boolean };
  mount: 'floor' | 'wall' | 'ceiling';
  /** Default base elevation in metres (e.g. wall cabinets, wall lights). */
  defaultElevation: number;
  slots: MaterialSlot[];
  build: (size: Size3) => Part[];
  planDetail?: (size: Size3) => PlanStroke[];
  /** Optional emitted light (balanced and high render quality, and the path tracer). */
  light?: AssetLight;
  /** Optional one- or two-sentence description shown in the library's info card. */
  description?: string;
  /** Set for models of a real, branded product (shown in the library's info card). */
  brand?: AssetBrand;
  /** Placement behaviour: snap the back (-z) against walls when placed nearby. */
  wallSnap?: boolean;
  source: { name: string; license: string };
  /** Set for items that come from a content pack in /packs (shown in the item's info). */
  pack?: AssetPackInfo;
}

/**
 * Light emitted by a fixture. Positions are in object space at the asset's default size (x right,
 * y up from the base, z to the front) and scale with the placed item, so a taller lamp keeps its
 * bulb in the shade. They turn and mirror with the item.
 */
export interface AssetLight {
  color: string;
  /** Luminous intensity per bulb/head (candela-like scene units; ~0.5 table lamp … ~2 chandelier). */
  intensity: number;
  /** Range in metres (the light fades to nothing at this distance). */
  distance: number;
  /** Bulb height above the item's base. */
  y: number;
  /** Bulb offset across (x) and to the front (z) of the item's centre; default 0. */
  x?: number;
  z?: number;
  /** 'point' (default) glows all round; 'spot' shines a cone along `dir` (downlights, track and reading lights). */
  kind?: 'point' | 'spot';
  /** Spot direction in object space; default straight down. */
  dir?: [number, number, number];
  /** Spot cone half-angle in radians (default 0.6) and soft edge 0–1 (default 0.4). */
  angle?: number;
  penumbra?: number;
  /** Several bulbs or heads (track heads, chandelier arms, up/down sconces): each is its own light and replaces x/y/z/dir. */
  heads?: { x?: number; y: number; z?: number; dir?: [number, number, number] }[];
}

/** A real product an asset models: maker, model number and its published specs. */
export interface AssetBrand {
  /** Maker, e.g. "Bosch". */
  name: string;
  /** Exact model number, e.g. "SMS4HVI33E". */
  model: string;
  /** Product line or series, e.g. "Serie 4". */
  line?: string;
  /** Where the specs come from (manufacturer page or spec sheet). */
  url?: string;
  /** Published specs as label/value pairs, e.g. ["Place settings", "13"]. */
  specs?: [string, string][];
}

export interface AssetPackInfo {
  /** Pack folder name (item ids are `<id>:<local id>`). */
  id: string;
  name: string;
  version?: string;
  author?: string;
}

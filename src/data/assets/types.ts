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

export type AssetCategory =
  | 'construction'
  | 'living'
  | 'bedroom'
  | 'dining'
  | 'kitchen'
  | 'bathroom'
  | 'office'
  | 'storage'
  | 'lighting'
  | 'decor'
  | 'electronics'
  | 'generic'
  | 'custom';

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
  /** Optional emitted light, used in higher render quality. */
  light?: { color: string; intensity: number; distance: number; y: number };
  /** Placement behaviour: snap the back (-z) against walls when placed nearby. */
  wallSnap?: boolean;
  source: { name: string; license: string };
}

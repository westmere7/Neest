import { z } from 'zod';

/**
 * Neest project schema.
 *
 * Coordinate convention (documented in README):
 * - Canonical unit is the metre. All lengths, positions, and sizes are metres.
 * - Plan space is 2D (x, y) with +x to the right (east) and +y downward (south)
 *   on screen, matching SVG. Angles are radians measured from +x toward +y
 *   (clockwise as seen on screen).
 * - World 3D space maps plan (x, y) to three.js (x, z) with +Y up. Elevations are
 *   3D Y values. A plan rotation θ becomes a three.js Y rotation of -θ.
 */

export const SCHEMA_VERSION = 1;
export const PROJECT_FORMAT = 'neest-project';

const num = z.number().finite();
const Id = z.string().min(1).max(80);
const HexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const Vec2Schema = z.object({ x: num, y: num });
export const Vec3TupleSchema = z.tuple([num, num, num]);

export const LengthUnitSchema = z.enum(['mm', 'cm', 'm', 'in', 'ft']);
export const AreaUnitSchema = z.enum(['m2', 'ft2']);
export const WallRoleSchema = z.enum(['exterior', 'interior', 'partition']);

export const WallNodeSchema = z.object({ id: Id, x: num, y: num });

export const WallMaterialsSchema = z.object({ left: Id, right: Id, top: Id });

/**
 * How a wall is built. 'solid' (default) and 'half' (solid with an overhanging cap) are
 * masonry/drywall; 'glass' is a framed glass wall with mullions; the railings are balustrades.
 */
export const WallStyleSchema = z.enum(['solid', 'half', 'glass', 'railing-glass', 'railing-bars']);

/** A moulding running along a wall face (skirting at the floor, cornice at the top). */
export const WallTrimSchema = z.object({
  height: num.min(0.005).max(1),
  /** How far it stands proud of the wall face. */
  depth: num.min(0.002).max(0.2),
  materialId: Id,
});

/** A rail (dado or picture rail) at a height above the wall base. */
export const WallRailSchema = WallTrimSchema.extend({
  /** Height of the rail's centre above the wall base. */
  y: num.min(0).max(12),
});

/** A lower band in another finish: wainscoting, panelling or a tiled dado. */
export const WallBandSchema = z.object({
  /** Top of the band above the wall base. */
  height: num.min(0.05).max(12),
  /** 0.002 ≈ paint/tile, 0.015+ ≈ timber panelling. */
  depth: num.min(0.001).max(0.1),
  materialId: Id,
  /** Adds a small capping rail along the top of the band. */
  cap: z.boolean().default(false),
});

/** Trim and finish layers on one face of a wall. */
export const WallSideFinishSchema = z.object({
  skirting: WallTrimSchema.nullable().default(null),
  cornice: WallTrimSchema.nullable().default(null),
  rail: WallRailSchema.nullable().default(null),
  band: WallBandSchema.nullable().default(null),
});

export const WallSegmentSchema = z.object({
  id: Id,
  a: Id,
  b: Id,
  thickness: num.min(0.02).max(2),
  height: num.min(0.2).max(12),
  baseElevation: num.min(-2).max(12).default(0),
  role: WallRoleSchema.default('interior'),
  /** Quadratic Bézier control point for curved walls, or null for straight walls. */
  curve: Vec2Schema.nullable().default(null),
  materials: WallMaterialsSchema,
  locked: z.boolean().default(false),
  hidden: z.boolean().default(false),
  /** Construction style; absent = 'solid'. */
  style: WallStyleSchema.optional(),
  /** Height at node b for a sloped top (height applies at node a); absent/null = level. */
  heightEnd: num.min(0.2).max(12).nullable().optional(),
  /** Glazing / railing infill material for glass and railing styles (frames use materials.top). */
  styleMaterialId: Id.optional(),
  /** Mouldings and finish bands per face. */
  finishes: z
    .object({ left: WallSideFinishSchema.optional(), right: WallSideFinishSchema.optional() })
    .optional(),
});

export const OpeningKindSchema = z.enum([
  'door-single',
  'door-double',
  'door-sliding',
  'door-pocket',
  'door-bifold',
  'door-barn',
  'door-french',
  'door-pivot',
  'passage',
  'passage-arched',
  'passage-moon',
  'window-single',
  'window-double',
  'window-fixed',
  'window-sliding',
  'window-arched',
  'window-round',
  'window-tall',
]);

/** Decorative/security bars in front of a window. */
export const WindowGrilleSchema = z.enum(['none', 'bars', 'grid']);

export const OpeningStyleSchema = z.enum(['flush', 'panel', 'glazed']);

/** Door leaf designs (see domain/model/openingDesigns.ts for what each looks like and where it applies). */
export const DOOR_DESIGN_IDS = [
  'flush',
  'shaker',
  'panel-2',
  'panel-5',
  'groove-v',
  'groove-h',
  'reeded',
  'ledged',
  'louvred',
  'lite-half',
  'lite-side',
  'lite-3h',
  'lite-full',
  'lites-divided',
  'ribbed-glass',
  'alu-clear',
  'alu-frosted',
  'steel-grid',
] as const;

/** Window designs: frame profile plus glazing layout. */
export const WINDOW_DESIGN_IDS = [
  'win-plain',
  'win-slim',
  'win-steel',
  'win-tilt-turn',
  'win-transom',
  'win-asym',
  'win-grid-2x2',
  'win-grid-3x2',
  'win-bars-v',
  'win-bars-h',
  'win-frosted-low',
  'win-reeded',
] as const;

/**
 * The visual design of a door or window, separate from its kind (how it opens). Values are only
 * ever added. An unknown value (from a newer build) loads as "no design" instead of failing.
 */
export const OpeningDesignSchema = z.enum([...DOOR_DESIGN_IDS, ...WINDOW_DESIGN_IDS]);

export const OpeningSchema = z.object({
  id: Id,
  wallId: Id,
  kind: OpeningKindSchema,
  /** Distance from the wall's start node (a) along its centreline to the opening centre. */
  offset: num.min(0),
  width: num.min(0.2).max(6),
  height: num.min(0.2).max(6),
  sillHeight: num.min(0).max(4),
  /** Side of the wall the leaf swings toward (relative to a→b direction). */
  swingSide: z.enum(['left', 'right']).default('left'),
  /** Which end of the opening carries the hinge (lower or higher offset). */
  hinge: z.enum(['start', 'end']).default('start'),
  /** 3D presentation only: how far doors/casements are opened, in degrees. */
  openAngle: num.min(0).max(100).default(0),
  /** Coarse look (flush/panel/glazed). Kept in step with `design` when one is set. */
  style: OpeningStyleSchema.default('flush'),
  /** Leaf / sash design; absent = derived from `style` and the kind (`resolveOpeningDesign`). */
  design: OpeningDesignSchema.optional().catch(undefined),
  frameMaterialId: Id,
  panelMaterialId: Id,
  /** Doors: glazed fanlight above the door (inside the opening height). */
  transom: z.boolean().optional(),
  /** Windows: bars or a grid in front of the glass. */
  grille: WindowGrilleSchema.optional(),
  /** Windows: louvred shutters on the outside (opposite the swing side). */
  shutters: z.boolean().optional(),
  /** Architrave/casing trim around the opening on both faces. */
  casing: z.boolean().optional(),
  /** Doors: a threshold strip on the floor. */
  threshold: z.boolean().optional(),
});

export const RoomTypeSchema = z.enum([
  'living',
  'bedroom',
  'kitchen',
  'dining',
  'bathroom',
  'wc',
  'hall',
  'office',
  'storage',
  'laundry',
  'balcony',
  'other',
]);

export const RoomSchema = z.object({
  id: Id,
  name: z.string().max(80),
  type: RoomTypeSchema.default('other'),
  /** Identity hint: a point inside the room's face at last reconciliation. */
  anchor: Vec2Schema,
  /** Identity hint: wall ids bounding the room at last reconciliation (derived, disposable). */
  boundaryWallIds: z.array(Id).default([]),
  floorMaterialId: Id,
  ceilingMaterialId: Id,
  showCeiling: z.boolean().default(true),
  /** Ceiling height override in metres; null = derived from bounding walls. */
  ceilingHeight: num.min(1).max(12).nullable().default(null),
  showLabel: z.boolean().default(true),
  /** Offset of the label from the derived room label point. */
  labelOffset: Vec2Schema.default({ x: 0, y: 0 }),
});

export const PlacedObjectSchema = z.object({
  id: Id,
  assetId: Id,
  name: z.string().max(80).nullable().default(null),
  x: num,
  y: num,
  elevation: num.min(-1).max(12).default(0),
  rotation: num.default(0),
  width: num.min(0.01).max(30),
  depth: num.min(0.01).max(30),
  height: num.min(0.005).max(12),
  mirrored: z.boolean().default(false),
  /** Material slot → material id. Slots missing here fall back to the asset default. */
  materials: z.record(z.string(), Id).default({}),
  locked: z.boolean().default(false),
  hidden: z.boolean().default(false),
});

export const MaterialCategorySchema = z.enum([
  'paint',
  'plaster',
  'wood',
  'tile',
  'stone',
  'metal',
  'glass',
  'fabric',
  'leather',
  'rug',
  'laminate',
  'solid',
]);

export const TextureRefSchema = z.object({
  /** Procedural pattern id from the built-in texture library. */
  patternId: Id,
  /** Size of one texture tile in metres. */
  scale: num.min(0.01).max(20),
  /** Rotation of the texture in degrees. */
  rotation: num.default(0),
  /** Strength of the pattern's light/dark variation (0..1). */
  contrast: num.min(0).max(1).default(1),
});

/**
 * Photo texture (CC0 PBR maps in public/textures/<setId>/, fetched by
 * `npm run textures`). Rendered on top of the base colour with the same multiply
 * model as procedural textures; the procedural `texture` stays the fallback when
 * the photo files are missing or `enabled` is false.
 */
export const PhotoTextureRefSchema = z.object({
  /** Set id from src/data/materials/photoSets.json. */
  setId: Id,
  /** Size of one photo tile in metres. */
  scale: num.min(0.01).max(20),
  /** Rotation of the photo texture in degrees. */
  rotation: num.default(0),
  /** Strength of the photo's light/dark variation and relief (0..1). */
  contrast: num.min(0).max(1).default(1),
  /** Use the photo maps (true) or the procedural texture (false). */
  enabled: z.boolean().default(true),
});

export const LicenseSchema = z.object({
  name: z.string(),
  license: z.string(),
  url: z.string().optional(),
});

export const MaterialSchema = z.object({
  id: Id,
  name: z.string().min(1).max(80),
  category: MaterialCategorySchema,
  color: HexColor,
  roughness: num.min(0).max(1),
  metalness: num.min(0).max(1),
  opacity: num.min(0.05).max(1).default(1),
  emissive: HexColor.nullable().default(null),
  emissiveIntensity: num.min(0).max(20).default(0),
  texture: TextureRefSchema.nullable().default(null),
  /** Optional photo texture; older projects get it from the catalogue on load (storage/migrations). */
  photo: PhotoTextureRefSchema.nullable().default(null),
  /** When set, this material is an unlinked per-instance override of another material. */
  overrideOf: Id.nullable().default(null),
  /** Catalogue entry this material was created from, if any. */
  catalogId: Id.nullable().default(null),
  source: LicenseSchema.default({ name: 'Neest', license: 'Original (procedural)' }),
});

export const CustomAssetSchema = z.object({
  id: Id,
  name: z.string().min(1).max(80),
  category: z.literal('custom').default('custom'),
  /** Key of the binary GLB blob in local asset storage. */
  blobId: Id,
  fileName: z.string().max(200),
  byteSize: num.min(0),
  /** Native bounding-box size of the imported model in metres. */
  size: z.object({ w: num.min(0.001), d: num.min(0.001), h: num.min(0.001) }),
  /** Convex hull of the top-down footprint in normalised (-0.5..0.5) coordinates. */
  footprint: z.array(Vec2Schema).default([]),
  importedAt: num,
  license: z.string().max(200).nullable().default(null),
});

export const WallDisplaySchema = z.enum(['full', 'cutaway', 'fade', 'hidden']);

export const CameraPresetSchema = z.object({
  id: Id,
  name: z.string().min(1).max(80),
  projection: z.enum(['perspective', 'orthographic']).default('perspective'),
  position: Vec3TupleSchema,
  target: Vec3TupleSchema,
  fov: num.min(10).max(120).default(50),
  zoom: num.min(0.01).max(1000).default(1),
  wallDisplay: WallDisplaySchema.nullable().default(null),
});

export const RenderSettingsSchema = z.object({
  quality: z.enum(['draft', 'balanced', 'high', 'ultra']).default('balanced'),
  exposure: num.min(0.1).max(4).default(1),
  /** Hours (6–20) used to derive sun elevation and warmth. */
  timeOfDay: num.min(5).max(21).default(14),
  sunAzimuth: num.min(0).max(360).default(135),
  sunIntensity: num.min(0).max(10).default(2.2),
  /** Sun colour on top of the time-of-day tint: -1 cool (overcast blue) … 0 natural … 1 warm (golden). */
  sunWarmth: num.min(-1).max(1).default(0),
  envIntensity: num.min(0).max(4).default(0.9),
  shadows: z.boolean().default(true),
  background: HexColor.default('#dfe3e6'),
  wallDisplay: WallDisplaySchema.default('full'),
  cutawayHeight: num.min(0.3).max(5).default(1.2),
  showCeilings: z.boolean().default(false),
  showRoomLabels: z.boolean().default(false),
  hiddenCategories: z.array(z.string()).default([]),
});

export const ProjectSettingsSchema = z.object({
  units: LengthUnitSchema.default('m'),
  precision: z.number().int().min(0).max(3).default(2),
  areaUnit: AreaUnitSchema.default('m2'),
  gridSize: num.min(0.01).max(5).default(0.1),
  defaultWall: z
    .object({
      thickness: num.min(0.02).max(2),
      height: num.min(0.2).max(12),
      role: WallRoleSchema,
    })
    .default({ thickness: 0.12, height: 2.7, role: 'interior' }),
  exteriorThickness: num.min(0.02).max(2).default(0.3),
  showRoomLabels: z.boolean().default(true),
  showRoomAreas: z.boolean().default(true),
  dimensions: z
    .object({
      overall: z.boolean(),
      walls: z.boolean(),
      rooms: z.boolean(),
    })
    .default({ overall: true, walls: false, rooms: true }),
});

export const LayerStateSchema = z.object({ visible: z.boolean(), locked: z.boolean() });

export const LayersSchema = z
  .object({
    construction: LayerStateSchema,
    furniture: LayerStateSchema,
    annotations: LayerStateSchema,
  })
  .default({
    construction: { visible: true, locked: false },
    furniture: { visible: true, locked: false },
    annotations: { visible: true, locked: false },
  });

export const GuestSettingsSchema = z
  .object({
    startCameraId: Id.nullable(),
    spawn: Vec2Schema.nullable(),
    spawnAngle: num,
  })
  .default({ startCameraId: null, spawn: null, spawnAngle: 0 });

export const ProjectSchema = z.object({
  format: z.literal(PROJECT_FORMAT).default(PROJECT_FORMAT),
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: Id,
  name: z.string().min(1).max(120),
  createdAt: num,
  updatedAt: num,
  settings: ProjectSettingsSchema,
  nodes: z.record(Id, WallNodeSchema).default({}),
  walls: z.record(Id, WallSegmentSchema).default({}),
  openings: z.record(Id, OpeningSchema).default({}),
  rooms: z.record(Id, RoomSchema).default({}),
  objects: z.record(Id, PlacedObjectSchema).default({}),
  materials: z.record(Id, MaterialSchema).default({}),
  customAssets: z.record(Id, CustomAssetSchema).default({}),
  cameras: z.array(CameraPresetSchema).default([]),
  render: RenderSettingsSchema.default({}),
  layers: LayersSchema,
  guest: GuestSettingsSchema,
});

export type Vec2 = z.infer<typeof Vec2Schema>;
export type Vec3Tuple = z.infer<typeof Vec3TupleSchema>;
export type LengthUnit = z.infer<typeof LengthUnitSchema>;
export type AreaUnit = z.infer<typeof AreaUnitSchema>;
export type WallRole = z.infer<typeof WallRoleSchema>;
export type WallNode = z.infer<typeof WallNodeSchema>;
export type WallSegment = z.infer<typeof WallSegmentSchema>;
export type WallSide = 'left' | 'right';
export type OpeningKind = z.infer<typeof OpeningKindSchema>;
export type OpeningStyle = z.infer<typeof OpeningStyleSchema>;
export type OpeningDesign = z.infer<typeof OpeningDesignSchema>;
export type DoorDesign = (typeof DOOR_DESIGN_IDS)[number];
export type WindowDesign = (typeof WINDOW_DESIGN_IDS)[number];
export type Opening = z.infer<typeof OpeningSchema>;
export type RoomType = z.infer<typeof RoomTypeSchema>;
export type Room = z.infer<typeof RoomSchema>;
export type PlacedObject = z.infer<typeof PlacedObjectSchema>;
export type MaterialCategory = z.infer<typeof MaterialCategorySchema>;
export type TextureRef = z.infer<typeof TextureRefSchema>;
export type PhotoTextureRef = z.infer<typeof PhotoTextureRefSchema>;
export type MaterialDefinition = z.infer<typeof MaterialSchema>;
export type CustomAsset = z.infer<typeof CustomAssetSchema>;
export type WallStyle = z.infer<typeof WallStyleSchema>;
export type WallTrim = z.infer<typeof WallTrimSchema>;
export type WallRail = z.infer<typeof WallRailSchema>;
export type WallBand = z.infer<typeof WallBandSchema>;
export type WallSideFinish = z.infer<typeof WallSideFinishSchema>;
export type WindowGrille = z.infer<typeof WindowGrilleSchema>;
export type WallDisplay = z.infer<typeof WallDisplaySchema>;
export type CameraPreset = z.infer<typeof CameraPresetSchema>;
export type RenderSettings = z.infer<typeof RenderSettingsSchema>;
export type ProjectSettings = z.infer<typeof ProjectSettingsSchema>;
export type Layers = z.infer<typeof LayersSchema>;
export type Project = z.infer<typeof ProjectSchema>;

export const isDoorKind = (k: OpeningKind) => k.startsWith('door') || k.startsWith('passage');
export const isPassageKind = (k: OpeningKind) => k.startsWith('passage');
export const isWindowKind = (k: OpeningKind) => k.startsWith('window');

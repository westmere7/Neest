import type { MaterialCategory, MaterialDefinition, TextureRef } from '@/domain/model/schema';

/**
 * Starter material catalogue. All textures are procedural patterns generated
 * in-browser by src/data/materials/patterns.ts — original work with no
 * third-party licence requirements. Entries are copied into a project when
 * first used, so every project stays self-contained.
 */

const SRC = { name: 'Neest starter library', license: 'Original (procedural, CC0-compatible)' };

type Def = {
  id: string;
  name: string;
  category: MaterialCategory;
  color: string;
  roughness: number;
  metalness?: number;
  opacity?: number;
  emissive?: string;
  emissiveIntensity?: number;
  texture?: Omit<TextureRef, 'rotation' | 'contrast'> & Partial<Pick<TextureRef, 'rotation' | 'contrast'>>;
};

const tex = (patternId: string, scale: number, contrast = 1, rotation = 0): Def['texture'] => ({
  patternId,
  scale,
  contrast,
  rotation,
});

const DEFS: Def[] = [
  // Paint & wall finishes
  { id: 'paint-warm-white', name: 'Warm white paint', category: 'paint', color: '#eeebe4', roughness: 0.9, texture: tex('paint', 1.2, 0.35) },
  { id: 'paint-pure-white', name: 'Pure white paint', category: 'paint', color: '#f6f6f3', roughness: 0.88, texture: tex('paint', 1.2, 0.3) },
  { id: 'paint-ceiling-white', name: 'Ceiling white', category: 'paint', color: '#f3f2ee', roughness: 0.95 },
  { id: 'paint-satin-white', name: 'Satin white trim', category: 'paint', color: '#f1f0ec', roughness: 0.45 },
  { id: 'paint-greige', name: 'Greige', category: 'paint', color: '#cfc6b8', roughness: 0.9, texture: tex('paint', 1.2, 0.35) },
  { id: 'paint-sage', name: 'Sage green', category: 'paint', color: '#a8b5a0', roughness: 0.9, texture: tex('paint', 1.2, 0.35) },
  { id: 'paint-dusty-blue', name: 'Dusty blue', category: 'paint', color: '#8fa3b5', roughness: 0.9, texture: tex('paint', 1.2, 0.35) },
  { id: 'paint-terracotta', name: 'Terracotta', category: 'paint', color: '#c4775a', roughness: 0.9, texture: tex('paint', 1.2, 0.35) },
  { id: 'paint-charcoal', name: 'Charcoal', category: 'paint', color: '#3c3f42', roughness: 0.85, texture: tex('paint', 1.2, 0.3) },
  { id: 'paint-ochre', name: 'Ochre', category: 'paint', color: '#d2a24c', roughness: 0.9, texture: tex('paint', 1.2, 0.35) },
  { id: 'paint-blush', name: 'Blush', category: 'paint', color: '#e3c3b8', roughness: 0.9, texture: tex('paint', 1.2, 0.35) },
  { id: 'paint-forest', name: 'Forest green', category: 'paint', color: '#3f5747', roughness: 0.85, texture: tex('paint', 1.2, 0.3) },
  { id: 'paint-deep-teal', name: 'Deep teal', category: 'paint', color: '#1a4d46', roughness: 0.85, texture: tex('paint', 1.2, 0.3) },
  { id: 'paint-sage-teal', name: 'Sage teal', category: 'paint', color: '#6fb3a0', roughness: 0.88, texture: tex('paint', 1.2, 0.3) },

  // Plaster, concrete, masonry
  { id: 'plaster-light', name: 'Light plaster', category: 'plaster', color: '#e4dfd6', roughness: 0.95, texture: tex('plaster', 2, 0.8) },
  { id: 'plaster-white', name: 'White plaster', category: 'plaster', color: '#efece6', roughness: 0.95, texture: tex('plaster', 2, 0.5) },
  { id: 'concrete-grey', name: 'Board concrete', category: 'plaster', color: '#a19e98', roughness: 0.92, texture: tex('concrete', 2, 1) },
  { id: 'microcement', name: 'Microcement', category: 'plaster', color: '#bdb6aa', roughness: 0.75, texture: tex('plaster', 2.5, 1) },
  { id: 'brick-white', name: 'Painted brick', category: 'plaster', color: '#e8e2d8', roughness: 0.95, texture: tex('brick', 0.9, 1) },
  { id: 'brick-red', name: 'Red brick', category: 'plaster', color: '#a85a43', roughness: 0.95, texture: tex('brick', 0.9, 1) },

  // Wood & veneer
  { id: 'wood-oak-natural', name: 'Natural oak planks', category: 'wood', color: '#c49a6c', roughness: 0.6, texture: tex('wood-planks', 1.6, 1) },
  { id: 'wood-oak-light', name: 'Light oak', category: 'wood', color: '#d8b98d', roughness: 0.55, texture: tex('wood-grain', 1, 0.9) },
  { id: 'wood-walnut', name: 'Walnut', category: 'wood', color: '#6b4a33', roughness: 0.5, texture: tex('wood-grain', 1, 1) },
  { id: 'wood-ash-white', name: 'White ash', category: 'wood', color: '#e2d3bd', roughness: 0.55, texture: tex('wood-grain', 1, 0.8) },
  { id: 'wood-herringbone', name: 'Oak herringbone', category: 'wood', color: '#be9266', roughness: 0.55, texture: tex('herringbone', 1.2, 1) },
  { id: 'wood-dark-stain', name: 'Dark stained wood', category: 'wood', color: '#4a3426', roughness: 0.45, texture: tex('wood-grain', 1, 1) },
  { id: 'wood-plywood', name: 'Birch plywood', category: 'wood', color: '#d9bd94', roughness: 0.6, texture: tex('wood-grain', 1.2, 0.6) },
  { id: 'wood-oak-wide', name: 'Wide oak boards', category: 'wood', color: '#b88c5f', roughness: 0.6, texture: tex('wood-planks-wide', 2.4, 1) },

  // Tile & mosaic
  { id: 'tile-white-square', name: 'White square tile', category: 'tile', color: '#f2f1ec', roughness: 0.25, texture: tex('tile-square', 0.6, 1) },
  { id: 'tile-subway-white', name: 'White subway tile', category: 'tile', color: '#efeee9', roughness: 0.2, texture: tex('subway', 0.6, 1) },
  { id: 'tile-hex-terracotta', name: 'Terracotta hex tile', category: 'tile', color: '#b9694a', roughness: 0.6, texture: tex('hex', 0.45, 1) },
  { id: 'tile-large-grey', name: 'Large grey porcelain', category: 'tile', color: '#a9a9a5', roughness: 0.4, texture: tex('tile-large', 1.2, 1) },
  { id: 'tile-checker', name: 'Checkerboard tile', category: 'tile', color: '#e8e6e0', roughness: 0.3, texture: tex('checker', 0.6, 1) },
  { id: 'tile-terrazzo', name: 'Terrazzo', category: 'tile', color: '#dad4ca', roughness: 0.35, texture: tex('terrazzo', 0.8, 1) },
  { id: 'tile-mosaic-blue', name: 'Blue mosaic', category: 'tile', color: '#6e93a8', roughness: 0.25, texture: tex('mosaic', 0.3, 1) },
  { id: 'tile-zellige-green', name: 'Green zellige', category: 'tile', color: '#4f7a68', roughness: 0.2, texture: tex('subway', 0.5, 1) },

  // Natural stone
  { id: 'stone-marble-carrara', name: 'Carrara marble', category: 'stone', color: '#ecebe7', roughness: 0.2, texture: tex('marble', 1.4, 1) },
  { id: 'stone-marble-nero', name: 'Nero marble', category: 'stone', color: '#3a3a3d', roughness: 0.2, texture: tex('marble', 1.4, 1) },
  { id: 'stone-travertine', name: 'Travertine', category: 'stone', color: '#d7c7a8', roughness: 0.6, texture: tex('travertine', 1.2, 1) },
  { id: 'stone-slate', name: 'Slate', category: 'stone', color: '#555a5e', roughness: 0.7, texture: tex('slate', 1, 1) },
  { id: 'stone-granite', name: 'Speckled granite', category: 'stone', color: '#8d8b88', roughness: 0.35, texture: tex('granite', 0.6, 1) },

  // Metal
  { id: 'metal-brushed-steel', name: 'Brushed steel', category: 'metal', color: '#b9bcbf', roughness: 0.35, metalness: 1, texture: tex('brushed', 0.4, 0.6) },
  { id: 'metal-chrome', name: 'Chrome', category: 'metal', color: '#e4e6e8', roughness: 0.08, metalness: 1 },
  { id: 'metal-brass', name: 'Brushed brass', category: 'metal', color: '#c9a45c', roughness: 0.3, metalness: 1, texture: tex('brushed', 0.4, 0.5) },
  { id: 'metal-anthracite', name: 'Anthracite metal', category: 'metal', color: '#3a3d40', roughness: 0.45, metalness: 0.7 },
  { id: 'metal-black-matte', name: 'Matte black metal', category: 'metal', color: '#1f2023', roughness: 0.6, metalness: 0.6 },
  { id: 'metal-copper', name: 'Copper', category: 'metal', color: '#b87350', roughness: 0.3, metalness: 1 },
  { id: 'metal-white-powder', name: 'White powder-coat', category: 'metal', color: '#eeeeec', roughness: 0.5, metalness: 0.3 },

  // Glass
  { id: 'glass-clear', name: 'Clear glass', category: 'glass', color: '#dcebf0', roughness: 0.05, opacity: 0.22 },
  { id: 'glass-frosted', name: 'Frosted glass', category: 'glass', color: '#e8eef0', roughness: 0.45, opacity: 0.65 },
  { id: 'glass-tinted', name: 'Smoked glass', category: 'glass', color: '#7d8a8c', roughness: 0.08, opacity: 0.45 },
  { id: 'glass-mirror', name: 'Mirror', category: 'glass', color: '#dfe6e9', roughness: 0.02, metalness: 1 },

  // Fabric & upholstery
  { id: 'fabric-linen', name: 'Natural linen', category: 'fabric', color: '#d8d0c2', roughness: 0.95, texture: tex('weave', 0.15, 0.7) },
  { id: 'fabric-boucle', name: 'Cream bouclé', category: 'fabric', color: '#eae4d8', roughness: 1, texture: tex('boucle', 0.2, 0.9) },
  { id: 'fabric-velvet-green', name: 'Green velvet', category: 'fabric', color: '#375a4a', roughness: 0.8, texture: tex('weave', 0.1, 0.35) },
  { id: 'fabric-wool-grey', name: 'Grey wool', category: 'fabric', color: '#8e8e8c', roughness: 0.95, texture: tex('weave', 0.12, 0.6) },
  { id: 'fabric-navy', name: 'Navy weave', category: 'fabric', color: '#2e3a55', roughness: 0.9, texture: tex('weave', 0.12, 0.6) },
  { id: 'fabric-mustard', name: 'Mustard weave', category: 'fabric', color: '#c99a3b', roughness: 0.9, texture: tex('weave', 0.12, 0.6) },
  { id: 'fabric-terracotta', name: 'Rust weave', category: 'fabric', color: '#b5694c', roughness: 0.9, texture: tex('weave', 0.12, 0.6) },
  { id: 'fabric-olive', name: 'Olive weave', category: 'fabric', color: '#6b7a2e', roughness: 0.92, texture: tex('weave', 0.12, 0.55) },
  { id: 'fabric-white-cotton', name: 'White cotton', category: 'fabric', color: '#f2f0eb', roughness: 0.95, texture: tex('weave', 0.1, 0.35) },

  // Leather
  { id: 'leather-cognac', name: 'Cognac leather', category: 'leather', color: '#8e5530', roughness: 0.55, texture: tex('leather', 0.25, 0.8) },
  { id: 'leather-black', name: 'Black leather', category: 'leather', color: '#2a2725', roughness: 0.5, texture: tex('leather', 0.25, 0.8) },
  { id: 'leather-tan', name: 'Tan leather', category: 'leather', color: '#b68a5e', roughness: 0.55, texture: tex('leather', 0.25, 0.8) },

  // Rugs & woven
  { id: 'rug-jute', name: 'Jute', category: 'rug', color: '#c2a57a', roughness: 1, texture: tex('jute', 0.25, 1) },
  { id: 'rug-wool-cream', name: 'Cream wool rug', category: 'rug', color: '#e6dfd2', roughness: 1, texture: tex('boucle', 0.3, 0.6) },
  { id: 'rug-berber', name: 'Berber stripe', category: 'rug', color: '#ddd3c3', roughness: 1, texture: tex('rug-stripes', 1, 1) },
  { id: 'rug-blue-geometric', name: 'Blue geometric rug', category: 'rug', color: '#5a7896', roughness: 1, texture: tex('rug-geometric', 1.2, 1) },

  // Laminate & composites
  { id: 'laminate-white-gloss', name: 'White gloss laminate', category: 'laminate', color: '#f4f4f2', roughness: 0.18 },
  { id: 'laminate-white-matte', name: 'White matte laminate', category: 'laminate', color: '#efefec', roughness: 0.6 },
  { id: 'laminate-oak', name: 'Oak-effect laminate', category: 'laminate', color: '#cca77b', roughness: 0.5, texture: tex('wood-grain', 1, 0.7) },
  { id: 'laminate-grey', name: 'Grey laminate', category: 'laminate', color: '#a3a39f', roughness: 0.5 },
  { id: 'laminate-black', name: 'Black laminate', category: 'laminate', color: '#2b2b2d', roughness: 0.4 },
  { id: 'laminate-sage', name: 'Sage laminate', category: 'laminate', color: '#8f9e8a', roughness: 0.55 },
  { id: 'laminate-navy', name: 'Navy laminate', category: 'laminate', color: '#2f3d52', roughness: 0.5 },

  // Solid colours & utility surfaces
  { id: 'solid-white', name: 'White', category: 'solid', color: '#f4f4f2', roughness: 0.6 },
  { id: 'solid-black', name: 'Black', category: 'solid', color: '#1c1c1e', roughness: 0.6 },
  { id: 'solid-light-grey', name: 'Light grey', category: 'solid', color: '#d9d9d6', roughness: 0.6 },
  { id: 'solid-mid-grey', name: 'Mid grey', category: 'solid', color: '#8c8c88', roughness: 0.6 },
  { id: 'solid-red', name: 'Signal red', category: 'solid', color: '#c2453b', roughness: 0.5 },
  { id: 'solid-yellow', name: 'Sun yellow', category: 'solid', color: '#e8b84a', roughness: 0.5 },
  { id: 'solid-blue', name: 'Cobalt', category: 'solid', color: '#3f6fb0', roughness: 0.5 },
  { id: 'solid-green', name: 'Leaf green', category: 'solid', color: '#4f8a5b', roughness: 0.5 },
  { id: 'ceramic-white', name: 'White ceramic', category: 'solid', color: '#f4f2ee', roughness: 0.12 },
  { id: 'plant-leaf', name: 'Foliage', category: 'solid', color: '#4e7a3e', roughness: 0.75 },
  { id: 'plant-soil', name: 'Soil', category: 'solid', color: '#4a3a2c', roughness: 1 },
  { id: 'screen-black', name: 'Screen glass', category: 'solid', color: '#101113', roughness: 0.1, metalness: 0.2 },
  { id: 'light-warm', name: 'Warm light diffuser', category: 'solid', color: '#fff4e0', roughness: 0.6, emissive: '#ffe2b0', emissiveIntensity: 2.5 },
  { id: 'paper-art', name: 'Art print', category: 'solid', color: '#d9c9a8', roughness: 0.8, texture: tex('art', 0.8, 1) },
  { id: 'book-mix', name: 'Book spines', category: 'solid', color: '#c9b8a0', roughness: 0.8, texture: tex('books', 0.4, 1) },
];

export const MATERIAL_CATALOG: MaterialDefinition[] = DEFS.map((d) => ({
  id: d.id,
  name: d.name,
  category: d.category,
  color: d.color,
  roughness: d.roughness,
  metalness: d.metalness ?? 0,
  opacity: d.opacity ?? 1,
  emissive: d.emissive ?? null,
  emissiveIntensity: d.emissiveIntensity ?? 0,
  texture: d.texture ? { rotation: 0, contrast: 1, ...d.texture } : null,
  overrideOf: null,
  catalogId: d.id,
  source: SRC,
}));

export const MATERIAL_CATALOG_BY_ID: Record<string, MaterialDefinition> = Object.fromEntries(
  MATERIAL_CATALOG.map((m) => [m.id, m]),
);

export const MATERIAL_CATEGORY_LABELS: Record<MaterialCategory, string> = {
  paint: 'Paint & wall finishes',
  plaster: 'Plaster, concrete & masonry',
  wood: 'Wood & veneer',
  tile: 'Tile & mosaic',
  stone: 'Marble & stone',
  metal: 'Metal',
  glass: 'Glass & mirror',
  fabric: 'Fabric & upholstery',
  leather: 'Leather',
  rug: 'Rugs & woven',
  laminate: 'Laminate & composite',
  solid: 'Solid colours',
};

/** Default material ids used for new geometry. */
export const DEFAULT_MATERIALS = {
  wallInterior: 'paint-warm-white',
  wallExterior: 'plaster-light',
  wallTop: 'plaster-white',
  floor: 'wood-oak-natural',
  wetFloor: 'tile-large-grey',
  ceiling: 'paint-ceiling-white',
  doorFrame: 'paint-satin-white',
  doorPanel: 'paint-satin-white',
  windowFrame: 'metal-anthracite',
  glass: 'glass-clear',
  fallback: 'solid-light-grey',
} as const;

/** Fallback used when a referenced material is missing (never silently invisible). */
export const FALLBACK_MATERIAL: MaterialDefinition = {
  ...MATERIAL_CATALOG_BY_ID['solid-light-grey'],
  id: '__fallback__',
  name: 'Missing material',
};

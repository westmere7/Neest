import type { MaterialCategory, MaterialDefinition, PhotoTextureRef, TextureRef } from '@/domain/model/schema';
import { PHOTO_SETS_BY_ID, PHOTO_SOURCE_NAMES, photoSetUrl } from './photoSets';

/**
 * Starter material catalogue. Every textured material has a procedural pattern
 * generated in-browser by src/data/materials/patterns.ts (original work), and
 * many also map to a CC0 photo texture set (`PHOTOS` below, files fetched by
 * `npm run textures`). The procedural pattern is the fallback whenever the photo
 * files are missing. Entries are copied into a project when first used, so
 * every project stays self-contained.
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
  { id: 'glass-reeded', name: 'Reeded glass', category: 'glass', color: '#e2ecef', roughness: 0.3, opacity: 0.5 },
  { id: 'glass-block', name: 'Glass block', category: 'glass', color: '#cfe2e8', roughness: 0.15, opacity: 0.75, texture: tex('tile-square', 0.2, 0.9) },
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
  { id: 'plastic-upvc-white', name: 'White uPVC', category: 'solid', color: '#f3f3f0', roughness: 0.32 },
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

  // Furniture library extras (kids, outdoor, hobbies, soft furnishings)
  { id: 'fabric-blush', name: 'Blush weave', category: 'fabric', color: '#d9a9a0', roughness: 0.92, texture: tex('weave', 0.12, 0.55) },
  { id: 'fabric-charcoal', name: 'Charcoal weave', category: 'fabric', color: '#3c3d40', roughness: 0.92, texture: tex('weave', 0.12, 0.6) },
  { id: 'fabric-cream', name: 'Cream twill', category: 'fabric', color: '#ece4d4', roughness: 0.95, texture: tex('weave', 0.1, 0.45) },
  { id: 'fabric-sky', name: 'Sky blue cotton', category: 'fabric', color: '#9cbfd6', roughness: 0.92, texture: tex('weave', 0.1, 0.45) },
  { id: 'fabric-velvet-blush', name: 'Blush velvet', category: 'fabric', color: '#c98f8a', roughness: 0.78, texture: tex('weave', 0.08, 0.3) },
  { id: 'fabric-velvet-navy', name: 'Navy velvet', category: 'fabric', color: '#283453', roughness: 0.78, texture: tex('weave', 0.08, 0.3) },
  { id: 'fabric-velvet-teal', name: 'Teal velvet', category: 'fabric', color: '#1f5a52', roughness: 0.78, texture: tex('weave', 0.08, 0.3) },
  { id: 'mattress-white', name: 'Mattress ticking', category: 'fabric', color: '#f3f1ec', roughness: 0.95, texture: tex('weave', 0.06, 0.3) },
  { id: 'felt-grey', name: 'Grey felt', category: 'fabric', color: '#9a9a96', roughness: 1 },
  { id: 'rattan-natural', name: 'Natural rattan', category: 'wood', color: '#c9a26b', roughness: 0.85, texture: tex('jute', 0.08, 0.9) },
  { id: 'wood-cherry', name: 'Cherry', category: 'wood', color: '#8a4b2d', roughness: 0.5, texture: tex('wood-grain', 0.8, 0.7) },
  { id: 'wood-teak', name: 'Teak', category: 'wood', color: '#9a6a3c', roughness: 0.6, texture: tex('wood-grain', 0.8, 0.75) },
  { id: 'wood-pine', name: 'Pine', category: 'wood', color: '#d9b88a', roughness: 0.6, texture: tex('wood-grain', 0.8, 0.8) },
  { id: 'wood-ebony', name: 'Ebonised wood', category: 'wood', color: '#2a211c', roughness: 0.45, texture: tex('wood-grain', 0.8, 0.4) },
  { id: 'wood-painted-white', name: 'White painted wood', category: 'wood', color: '#efece6', roughness: 0.5, texture: tex('wood-grain', 0.8, 0.15) },
  { id: 'cork', name: 'Cork', category: 'solid', color: '#b88a5a', roughness: 0.95, texture: tex('granite', 0.15, 0.8) },
  { id: 'plastic-white', name: 'White plastic', category: 'solid', color: '#f2f2ef', roughness: 0.35 },
  { id: 'plastic-black', name: 'Black plastic', category: 'solid', color: '#222224', roughness: 0.4 },
  { id: 'plastic-red', name: 'Red plastic', category: 'solid', color: '#d0473c', roughness: 0.35 },
  { id: 'plastic-yellow', name: 'Yellow plastic', category: 'solid', color: '#f0c040', roughness: 0.35 },
  { id: 'plastic-blue', name: 'Blue plastic', category: 'solid', color: '#3d74c6', roughness: 0.35 },
  { id: 'plastic-green', name: 'Green plastic', category: 'solid', color: '#58a35e', roughness: 0.35 },
  { id: 'plastic-pink', name: 'Pink plastic', category: 'solid', color: '#f0a6b8', roughness: 0.35 },
  { id: 'plastic-mint', name: 'Mint plastic', category: 'solid', color: '#9fd8c4', roughness: 0.35 },
  { id: 'rubber-black', name: 'Black rubber', category: 'solid', color: '#1d1d1d', roughness: 0.9 },
  { id: 'chalkboard', name: 'Chalkboard', category: 'solid', color: '#2f3a35', roughness: 0.9 },
  { id: 'terracotta-pot', name: 'Terracotta', category: 'solid', color: '#b8643f', roughness: 0.85 },
  { id: 'ceramic-sage', name: 'Sage glaze', category: 'solid', color: '#9fb39c', roughness: 0.2 },
  { id: 'ceramic-black', name: 'Black glaze', category: 'solid', color: '#2a2a2a', roughness: 0.2 },
  { id: 'ceramic-blue', name: 'Blue glaze', category: 'solid', color: '#3e5f8a', roughness: 0.15 },
  { id: 'paper-shade', name: 'Paper shade', category: 'solid', color: '#f3ead8', roughness: 0.9 },
  { id: 'plant-leaf-dark', name: 'Dark foliage', category: 'solid', color: '#2f5a33', roughness: 0.7 },
  { id: 'plant-leaf-light', name: 'Fresh foliage', category: 'solid', color: '#7ea34f', roughness: 0.7 },
  { id: 'plant-flower-pink', name: 'Pink blossom', category: 'solid', color: '#e58aa5', roughness: 0.7 },
  { id: 'plant-flower-yellow', name: 'Yellow blossom', category: 'solid', color: '#f2c84b', roughness: 0.7 },
  { id: 'water', name: 'Water', category: 'glass', color: '#6fb5d6', roughness: 0.05, opacity: 0.55 },
  { id: 'screen-glow', name: 'Lit screen', category: 'solid', color: '#1b2a3a', roughness: 0.1, emissive: '#4a7ab0', emissiveIntensity: 0.6 },
  { id: 'light-cool', name: 'Cool light diffuser', category: 'solid', color: '#f4f8ff', roughness: 0.6, emissive: '#dfe9ff', emissiveIntensity: 2.5 },
  { id: 'light-candle', name: 'Candle flame', category: 'solid', color: '#ffd9a0', roughness: 0.6, emissive: '#ffb060', emissiveIntensity: 3 },
  // ── Expanded library (2026-10) ──────────────────────────────────────────
  // More paint colours
  { id: 'paint-navy', name: 'Hale navy', category: 'paint', color: '#2f3e55', roughness: 0.85, texture: tex('paint', 1.2, 0.3) },
  { id: 'paint-olive', name: 'Olive', category: 'paint', color: '#7a7a52', roughness: 0.88, texture: tex('paint', 1.2, 0.35) },
  { id: 'paint-clay', name: 'Clay', category: 'paint', color: '#b98a6e', roughness: 0.9, texture: tex('paint', 1.2, 0.35) },
  { id: 'paint-lavender', name: 'Lavender grey', category: 'paint', color: '#b8aec9', roughness: 0.9, texture: tex('paint', 1.2, 0.35) },
  { id: 'paint-butter', name: 'Butter yellow', category: 'paint', color: '#efdfa8', roughness: 0.9, texture: tex('paint', 1.2, 0.35) },
  { id: 'paint-mint', name: 'Pale mint', category: 'paint', color: '#c3dccb', roughness: 0.9, texture: tex('paint', 1.2, 0.35) },
  { id: 'paint-mushroom', name: 'Mushroom', category: 'paint', color: '#a99b8b', roughness: 0.9, texture: tex('paint', 1.2, 0.35) },
  { id: 'paint-oxblood', name: 'Oxblood', category: 'paint', color: '#6b2c2c', roughness: 0.85, texture: tex('paint', 1.2, 0.3) },
  { id: 'paint-stone-grey', name: 'Stone grey', category: 'paint', color: '#9a9b97', roughness: 0.9, texture: tex('paint', 1.2, 0.35) },
  { id: 'paint-powder-pink', name: 'Powder pink', category: 'paint', color: '#ead2cf', roughness: 0.9, texture: tex('paint', 1.2, 0.35) },
  { id: 'paint-cobalt', name: 'Cobalt blue', category: 'paint', color: '#2f5ea8', roughness: 0.85, texture: tex('paint', 1.2, 0.3) },
  { id: 'paint-jade', name: 'Jade', category: 'paint', color: '#4f8f7c', roughness: 0.88, texture: tex('paint', 1.2, 0.3) },
  { id: 'paint-mustard', name: 'Mustard', category: 'paint', color: '#c9a03a', roughness: 0.9, texture: tex('paint', 1.2, 0.35) },
  { id: 'paint-soft-black', name: 'Soft black', category: 'paint', color: '#2a2b2e', roughness: 0.85, texture: tex('paint', 1.2, 0.3) },
  { id: 'paint-sky', name: 'Sky blue', category: 'paint', color: '#c7dbe8', roughness: 0.9, texture: tex('paint', 1.2, 0.35) },
  { id: 'paint-cream', name: 'Cream', category: 'paint', color: '#f1e8d6', roughness: 0.9, texture: tex('paint', 1.2, 0.35) },

  // Wallpaper (shown in the paint shelf, tinted by the colour)
  { id: 'wallpaper-stripe-sage', name: 'Sage stripe wallpaper', category: 'paint', color: '#c9d3bd', roughness: 0.8, texture: tex('wallpaper-stripes', 0.6, 1) },
  { id: 'wallpaper-stripe-blue', name: 'Blue stripe wallpaper', category: 'paint', color: '#c4d1df', roughness: 0.8, texture: tex('wallpaper-stripes', 0.6, 1) },
  { id: 'wallpaper-damask-gold', name: 'Gold damask wallpaper', category: 'paint', color: '#d9c99c', roughness: 0.6, texture: tex('wallpaper-damask', 0.64, 1) },
  { id: 'wallpaper-damask-grey', name: 'Grey damask wallpaper', category: 'paint', color: '#b9bbbd', roughness: 0.6, texture: tex('wallpaper-damask', 0.64, 1) },
  { id: 'wallpaper-deco-teal', name: 'Teal art deco wallpaper', category: 'paint', color: '#86aaa1', roughness: 0.7, texture: tex('wallpaper-deco', 0.6, 1) },
  { id: 'wallpaper-deco-blush', name: 'Blush art deco wallpaper', category: 'paint', color: '#e2c3bb', roughness: 0.7, texture: tex('wallpaper-deco', 0.6, 1) },
  { id: 'grasscloth-natural', name: 'Natural grasscloth wallpaper', category: 'paint', color: '#cdb892', roughness: 0.95, texture: tex('wallpaper-grasscloth', 0.9, 1) },
  { id: 'grasscloth-indigo', name: 'Indigo grasscloth wallpaper', category: 'paint', color: '#4f5c76', roughness: 0.95, texture: tex('wallpaper-grasscloth', 0.9, 1) },
  { id: 'wallpaper-tropical', name: 'Tropical leaf wallpaper', category: 'paint', color: '#ffffff', roughness: 0.75, texture: tex('wallpaper-botanical', 1.4, 1) },
  { id: 'wallpaper-floral', name: 'Ditsy floral wallpaper', category: 'paint', color: '#ffffff', roughness: 0.75, texture: tex('wallpaper-floral', 0.7, 1) },
  { id: 'wallpaper-woodchip', name: 'Woodchip wallpaper', category: 'paint', color: '#f1efea', roughness: 0.95, texture: tex('plaster', 1, 0.7) },

  // Plaster finishes
  { id: 'limewash-warm', name: 'Warm limewash', category: 'plaster', color: '#e7dccb', roughness: 0.95, texture: tex('limewash', 2.2, 1) },
  { id: 'limewash-grey', name: 'Grey limewash', category: 'plaster', color: '#c5c2ba', roughness: 0.95, texture: tex('limewash', 2.2, 1) },
  { id: 'limewash-terracotta', name: 'Terracotta limewash', category: 'plaster', color: '#c58c6e', roughness: 0.95, texture: tex('limewash', 2.2, 1) },
  { id: 'limewash-sage', name: 'Sage limewash', category: 'plaster', color: '#a9b49d', roughness: 0.95, texture: tex('limewash', 2.2, 1) },
  { id: 'venetian-white', name: 'White Venetian plaster', category: 'plaster', color: '#ece8e0', roughness: 0.3, texture: tex('venetian', 2, 1) },
  { id: 'venetian-grey', name: 'Grey Venetian plaster', category: 'plaster', color: '#a9a6a0', roughness: 0.3, texture: tex('venetian', 2, 1) },
  { id: 'tadelakt-sand', name: 'Sand tadelakt', category: 'plaster', color: '#d8c4a2', roughness: 0.35, texture: tex('venetian', 1.6, 0.9) },
  { id: 'plaster-rough-white', name: 'Rough painted plaster', category: 'plaster', color: '#eeeae3', roughness: 0.95, texture: tex('plaster', 2, 1) },

  // Wood: parquet, panels and Vietnamese furniture woods
  { id: 'wood-chevron-oak', name: 'Oak chevron parquet', category: 'wood', color: '#c49a6c', roughness: 0.55, texture: tex('chevron', 1.6, 1) },
  { id: 'wood-chevron-smoked', name: 'Smoked oak chevron', category: 'wood', color: '#7d5c42', roughness: 0.55, texture: tex('chevron', 1.6, 1) },
  { id: 'wood-versailles', name: 'Versailles parquet', category: 'wood', color: '#c9a173', roughness: 0.5, texture: tex('parquet-basket', 2, 1) },
  { id: 'wood-basketweave', name: 'Basketweave parquet', category: 'wood', color: '#9a6b45', roughness: 0.5, texture: tex('parquet-basket', 1.5, 1) },
  { id: 'wood-diagonal-parquet', name: 'Diagonal parquet', category: 'wood', color: '#b88a5c', roughness: 0.5, texture: tex('chevron', 2, 0.8, 45) },
  { id: 'wood-herringbone-dark', name: 'Dark herringbone', category: 'wood', color: '#6e4a30', roughness: 0.5, texture: tex('herringbone', 1.2, 1) },
  { id: 'wood-dark-oak-planks', name: 'Dark oak planks', category: 'wood', color: '#6b4a33', roughness: 0.55, texture: tex('wood-planks', 1.6, 1) },
  { id: 'wood-grey-oak', name: 'Grey washed oak', category: 'wood', color: '#a39a8e', roughness: 0.6, texture: tex('wood-planks', 1.6, 0.8) },
  { id: 'wood-whitewashed', name: 'Whitewashed planks', category: 'wood', color: '#e6dccd', roughness: 0.6, texture: tex('wood-planks', 1.6, 0.6) },
  { id: 'wood-bamboo', name: 'Bamboo', category: 'wood', color: '#cdb478', roughness: 0.55, texture: tex('wood-slats', 0.9, 0.5) },
  { id: 'wood-fluted-oak', name: 'Fluted oak panel', category: 'wood', color: '#c49a6c', roughness: 0.55, texture: tex('fluted', 0.36, 1) },
  { id: 'wood-fluted-walnut', name: 'Fluted walnut panel', category: 'wood', color: '#6b4a33', roughness: 0.5, texture: tex('fluted', 0.36, 1) },
  { id: 'wood-slats-oak', name: 'Oak slat panel', category: 'wood', color: '#c8a172', roughness: 0.6, texture: tex('wood-slats', 0.5, 1) },
  { id: 'wood-slats-walnut', name: 'Walnut slat panel', category: 'wood', color: '#5f4330', roughness: 0.55, texture: tex('wood-slats', 0.5, 1) },
  { id: 'wood-acacia', name: 'Acacia (gỗ keo)', category: 'wood', color: '#a46d3f', roughness: 0.55, texture: tex('wood-grain', 0.8, 0.9) },
  { id: 'wood-rosewood', name: 'Rosewood (gỗ hương)', category: 'wood', color: '#6a2f22', roughness: 0.4, texture: tex('wood-grain', 0.8, 0.8) },
  { id: 'wood-mahogany', name: 'Mahogany', category: 'wood', color: '#7a3b28', roughness: 0.45, texture: tex('wood-grain', 0.8, 0.8) },
  { id: 'wood-ironwood', name: 'Ironwood (gỗ lim)', category: 'wood', color: '#4e3424', roughness: 0.45, texture: tex('wood-grain', 0.7, 0.8) },
  { id: 'cane-natural', name: 'Rattan cane webbing', category: 'wood', color: '#d6b480', roughness: 0.8, texture: tex('cane', 0.2, 1) },
  { id: 'wicker-fine', name: 'Fine wicker', category: 'wood', color: '#c7a578', roughness: 0.85, texture: tex('jute', 0.1, 0.9) },

  // Tiles
  { id: 'tile-cement-classic', name: 'Gạch bông cement tile', category: 'tile', color: '#ffffff', roughness: 0.55, texture: tex('cement-tile', 0.4, 1) },
  { id: 'tile-terracotta-rustic', name: 'Rustic terracotta (Bát Tràng)', category: 'tile', color: '#b8643f', roughness: 0.85, texture: tex('terracotta-tile', 1.2, 1) },
  { id: 'tile-fishscale-teal', name: 'Teal fish-scale tile', category: 'tile', color: '#4f8f86', roughness: 0.15, texture: tex('fishscale', 0.6, 1) },
  { id: 'tile-fishscale-white', name: 'White fish-scale tile', category: 'tile', color: '#eeeeea', roughness: 0.15, texture: tex('fishscale', 0.6, 1) },
  { id: 'tile-penny-white', name: 'White penny mosaic', category: 'tile', color: '#f0f0ec', roughness: 0.2, texture: tex('penny', 0.3, 1) },
  { id: 'tile-penny-charcoal', name: 'Charcoal penny mosaic', category: 'tile', color: '#4a4b4e', roughness: 0.25, texture: tex('penny', 0.3, 1) },
  { id: 'tile-azulejo-border', name: 'Blue painted tiles (border)', category: 'tile', color: '#dbe4f3', roughness: 0.15, texture: tex('tile-square', 0.9, 1) },
  { id: 'tile-azulejo-floral', name: 'Blue painted tiles (floral)', category: 'tile', color: '#dbe4f3', roughness: 0.15, texture: tex('tile-square', 0.9, 1) },
  { id: 'tile-terrazzo-colour', name: 'Colourful terrazzo', category: 'tile', color: '#efebe5', roughness: 0.3, texture: tex('terrazzo', 1, 1) },
  { id: 'tile-subway-green', name: 'Bottle-green subway tile', category: 'tile', color: '#5f8a74', roughness: 0.12, texture: tex('subway', 0.6, 1) },
  { id: 'tile-subway-black', name: 'Black subway tile', category: 'tile', color: '#2f3032', roughness: 0.15, texture: tex('subway', 0.6, 1) },
  { id: 'tile-square-sage', name: 'Sage square tile', category: 'tile', color: '#a9b8a2', roughness: 0.2, texture: tex('tile-square', 0.6, 1) },

  // Stone
  { id: 'stone-onyx-white', name: 'White onyx', category: 'stone', color: '#efeae4', roughness: 0.15, texture: tex('marble', 2, 0.7) },
  { id: 'stone-marble-beige', name: 'Crema beige marble', category: 'stone', color: '#e2d6c3', roughness: 0.2, texture: tex('marble', 2, 0.8) },
  { id: 'stone-marble-green', name: 'Verde marble', category: 'stone', color: '#3f5a4c', roughness: 0.2, texture: tex('marble', 1.6, 1) },
  { id: 'stone-quartz-white', name: 'White quartz', category: 'stone', color: '#f2f1ee', roughness: 0.25, texture: tex('granite', 0.6, 0.35) },

  // Metal finishes
  { id: 'metal-gold', name: 'Polished gold', category: 'metal', color: '#d4af37', roughness: 0.22, metalness: 1 },
  { id: 'metal-champagne', name: 'Champagne aluminium', category: 'metal', color: '#c8b48e', roughness: 0.35, metalness: 0.85, texture: tex('brushed', 0.4, 0.35) },
  { id: 'metal-bronze', name: 'Antique bronze', category: 'metal', color: '#8c6a4a', roughness: 0.4, metalness: 1, texture: tex('brushed', 0.4, 0.5) },
  { id: 'metal-gunmetal', name: 'Gunmetal', category: 'metal', color: '#4a4d52', roughness: 0.35, metalness: 1, texture: tex('brushed', 0.4, 0.6) },
  { id: 'metal-rose-gold', name: 'Rose gold', category: 'metal', color: '#c99a86', roughness: 0.25, metalness: 1 },
  { id: 'metal-stainless-polished', name: 'Polished stainless', category: 'metal', color: '#d8dadc', roughness: 0.15, metalness: 1 },

  // Fabric
  { id: 'fabric-linen-sage', name: 'Sage linen', category: 'fabric', color: '#a7b39c', roughness: 0.95, texture: tex('weave', 0.15, 0.7) },
  { id: 'fabric-linen-rust', name: 'Rust linen', category: 'fabric', color: '#b06a48', roughness: 0.95, texture: tex('weave', 0.15, 0.7) },
  { id: 'fabric-boucle-oat', name: 'Oat bouclé', category: 'fabric', color: '#d9cfbf', roughness: 1, texture: tex('boucle', 0.2, 0.9) },
  { id: 'fabric-velvet-mustard', name: 'Mustard velvet', category: 'fabric', color: '#c6942f', roughness: 0.78, texture: tex('weave', 0.08, 0.3) },
  { id: 'fabric-velvet-rust', name: 'Rust velvet', category: 'fabric', color: '#9c4a32', roughness: 0.78, texture: tex('weave', 0.08, 0.3) },
  { id: 'fabric-corduroy-olive', name: 'Olive corduroy', category: 'fabric', color: '#6b6f3e', roughness: 0.9, texture: tex('fluted', 0.03, 0.8) },
  { id: 'fabric-corduroy-camel', name: 'Camel corduroy', category: 'fabric', color: '#b78b5c', roughness: 0.9, texture: tex('fluted', 0.03, 0.8) },
  { id: 'fabric-damask-cream', name: 'Cream damask', category: 'fabric', color: '#e9dfc8', roughness: 0.7, texture: tex('wallpaper-damask', 0.3, 0.8) },
  { id: 'fabric-floral-print', name: 'Floral print cotton', category: 'fabric', color: '#ffffff', roughness: 0.9, texture: tex('wallpaper-floral', 0.35, 1) },

  // Leather
  { id: 'leather-smooth-black', name: 'Smooth black leather', category: 'leather', color: '#262423', roughness: 0.4, texture: tex('leather', 0.25, 0.5) },
  { id: 'leather-white', name: 'White leather', category: 'leather', color: '#e9e4dc', roughness: 0.45, texture: tex('leather', 0.25, 0.6) },
  { id: 'leather-burgundy', name: 'Burgundy leather', category: 'leather', color: '#5e2328', roughness: 0.45, texture: tex('leather', 0.25, 0.8) },
  { id: 'leather-olive', name: 'Olive leather', category: 'leather', color: '#5e5f3a', roughness: 0.5, texture: tex('leather', 0.25, 0.8) },
  { id: 'suede-sand', name: 'Sand suede', category: 'leather', color: '#c9ad86', roughness: 0.95, texture: tex('boucle', 0.12, 0.25) },

  // Rugs and carpet
  { id: 'carpet-grey', name: 'Grey carpet', category: 'rug', color: '#8e8f91', roughness: 1, texture: tex('boucle', 0.3, 0.5) },
  { id: 'carpet-navy', name: 'Navy carpet', category: 'rug', color: '#33405a', roughness: 1, texture: tex('boucle', 0.3, 0.5) },
  { id: 'carpet-beige', name: 'Beige carpet', category: 'rug', color: '#cfc2ac', roughness: 1, texture: tex('boucle', 0.3, 0.5) },
  { id: 'rug-sisal', name: 'Sisal', category: 'rug', color: '#bfa77d', roughness: 1, texture: tex('jute', 0.18, 1) },
  { id: 'rug-cement-tile', name: 'Tile-print rug', category: 'rug', color: '#ffffff', roughness: 1, texture: tex('cement-tile', 0.5, 0.8) },

  // Laminate and composites
  { id: 'laminate-walnut', name: 'Walnut-effect laminate', category: 'laminate', color: '#6e4c34', roughness: 0.45, texture: tex('wood-grain', 1, 0.7) },
  { id: 'laminate-fluted-white', name: 'Fluted white MDF', category: 'laminate', color: '#f0efeb', roughness: 0.55, texture: tex('fluted', 0.3, 0.7) },
  { id: 'laminate-greige', name: 'Greige matte laminate', category: 'laminate', color: '#c9c2b6', roughness: 0.6 },
  { id: 'laminate-pink', name: 'Dusty pink laminate', category: 'laminate', color: '#e2c1bc', roughness: 0.55 },
  { id: 'laminate-olive', name: 'Olive laminate', category: 'laminate', color: '#7c7f5a', roughness: 0.55 },
  { id: 'laminate-gloss-grey', name: 'Grey gloss laminate', category: 'laminate', color: '#8d8f93', roughness: 0.15 },
  { id: 'laminate-terrazzo', name: 'Terrazzo-effect laminate', category: 'laminate', color: '#ece8e2', roughness: 0.4, texture: tex('terrazzo', 0.8, 0.8) },

  // Colour-variant palette (2026-10-19): light grey bedding, grey and cream velvets and bouclé, cream and
  // forest-green cabinetry, a cream glaze — finishes the per-object looks in data/assets/variantLooks.ts use.
  { id: 'fabric-dove-grey', name: 'Dove grey cotton', category: 'fabric', color: '#c6c5c1', roughness: 0.95, texture: tex('weave', 0.1, 0.5) },
  { id: 'fabric-stone', name: 'Stone weave', category: 'fabric', color: '#b3a998', roughness: 0.95, texture: tex('weave', 0.12, 0.6) },
  { id: 'fabric-forest', name: 'Forest green weave', category: 'fabric', color: '#3d5345', roughness: 0.92, texture: tex('weave', 0.12, 0.6) },
  { id: 'fabric-boucle-grey', name: 'Grey bouclé', category: 'fabric', color: '#b4b0a9', roughness: 1, texture: tex('boucle', 0.2, 0.9) },
  { id: 'fabric-boucle-sage', name: 'Sage bouclé', category: 'fabric', color: '#a2ab93', roughness: 1, texture: tex('boucle', 0.2, 0.9) },
  { id: 'fabric-boucle-charcoal', name: 'Charcoal bouclé', category: 'fabric', color: '#5b5a58', roughness: 1, texture: tex('boucle', 0.2, 0.9) },
  { id: 'fabric-boucle-rust', name: 'Rust bouclé', category: 'fabric', color: '#ad6e4e', roughness: 1, texture: tex('boucle', 0.2, 0.9) },
  { id: 'fabric-velvet-grey', name: 'Grey velvet', category: 'fabric', color: '#717378', roughness: 0.78, texture: tex('weave', 0.08, 0.3) },
  { id: 'fabric-velvet-oat', name: 'Oat velvet', category: 'fabric', color: '#c7b79e', roughness: 0.78, texture: tex('weave', 0.08, 0.3) },
  { id: 'fabric-velvet-sage', name: 'Sage velvet', category: 'fabric', color: '#7c8b6f', roughness: 0.78, texture: tex('weave', 0.08, 0.3) },
  { id: 'laminate-cream', name: 'Cream matte laminate', category: 'laminate', color: '#ebe3d2', roughness: 0.6 },
  { id: 'laminate-forest', name: 'Forest green laminate', category: 'laminate', color: '#3e5245', roughness: 0.55 },
  { id: 'ceramic-cream', name: 'Cream glaze', category: 'solid', color: '#e8dfcd', roughness: 0.25 },

  // Scanned-texture library (2026-10-19): finishes that come with a real photo scan
  { id: 'plaster-stucco-white', name: 'White stucco', category: 'plaster', color: '#ece9e2', roughness: 0.95, texture: tex('plaster', 2, 1) },
  { id: 'wood-white-oak', name: 'White oak', category: 'wood', color: '#d6bf9c', roughness: 0.55, texture: tex('wood-grain', 1, 0.8) },
  { id: 'wood-maple', name: 'Maple', category: 'wood', color: '#e2c9a0', roughness: 0.5, texture: tex('wood-grain', 1, 0.6) },
  { id: 'wood-smoked-oak', name: 'Smoked oak', category: 'wood', color: '#7a6352', roughness: 0.55, texture: tex('wood-grain', 1, 0.9) },
  { id: 'wood-cedar-planks', name: 'Japanese cedar planks', category: 'wood', color: '#c48a5a', roughness: 0.6, texture: tex('wood-planks', 1.2, 0.8, 90) },
  { id: 'bamboo-woven', name: 'Woven bamboo', category: 'wood', color: '#c9a66e', roughness: 0.8, texture: tex('jute', 0.1, 0.9) },
  { id: 'laminate-oak-planks', name: 'Oak-effect laminate floor', category: 'laminate', color: '#c9a57a', roughness: 0.45, texture: tex('wood-planks', 1.6, 0.8) },
  { id: 'tile-granite-dark', name: 'Dark granite floor tile', category: 'tile', color: '#4b4c4e', roughness: 0.35, texture: tex('tile-large', 1.2, 1) },
  { id: 'tile-stone-cream', name: 'Cream stone floor tile', category: 'tile', color: '#e3d8c4', roughness: 0.4, texture: tex('tile-large', 1.2, 0.8) },
  { id: 'tile-mosaic-cream', name: 'Cream rounded mosaic', category: 'tile', color: '#e9e4da', roughness: 0.3, texture: tex('mosaic', 0.3, 1) },
  { id: 'fabric-herringbone-grey', name: 'Grey herringbone wool', category: 'fabric', color: '#8a8984', roughness: 0.95, texture: tex('weave', 0.12, 0.6) },
  { id: 'fabric-teddy-cream', name: 'Cream teddy fleece', category: 'fabric', color: '#e9e0cf', roughness: 1, texture: tex('boucle', 0.2, 0.9) },
  { id: 'fabric-terry-white', name: 'White terry towelling', category: 'fabric', color: '#f1efea', roughness: 1, texture: tex('boucle', 0.15, 0.4) },
  { id: 'fabric-waffle-white', name: 'White waffle cotton', category: 'fabric', color: '#efebe3', roughness: 0.95, texture: tex('weave', 0.1, 0.5) },
  { id: 'fabric-hessian', name: 'Natural hessian', category: 'fabric', color: '#b89a6c', roughness: 1, texture: tex('jute', 0.2, 1) },
];

/**
 * Catalogue material → photo texture set. `scale` = metres per photo tile
 * (defaults to the set's real-world size); `contrast` softens busy photos.
 * Several materials share a set: the base colour tints it (multiply model).
 */
const PHOTOS: Record<string, { set: string; scale?: number; contrast?: number; rotation?: number }> = {
  // Plaster, concrete, masonry
  'plaster-light': { set: 'plaster', contrast: 0.8 },
  'plaster-white': { set: 'plaster', contrast: 0.6 },
  'concrete-grey': { set: 'board-concrete' },
  microcement: { set: 'microcement' },
  'brick-white': { set: 'brick-painted' },
  'brick-red': { set: 'brick-red' },
  // Wood & veneer
  'wood-oak-natural': { set: 'oak-planks' },
  'wood-oak-light': { set: 'oak-veneer', scale: 1.2 },
  'wood-walnut': { set: 'walnut-veneer', scale: 1.2 },
  'wood-ash-white': { set: 'ash-wood' },
  'wood-herringbone': { set: 'oak-herringbone' },
  'wood-dark-stain': { set: 'walnut-veneer', scale: 1.2 },
  'wood-plywood': { set: 'birch-wood' },
  'wood-oak-wide': { set: 'oak-wide-boards' },
  'wood-cherry': { set: 'cherry-wood' },
  'wood-teak': { set: 'teak-veneer' },
  'wood-pine': { set: 'pine-wood' },
  'wood-ebony': { set: 'walnut-veneer', scale: 1.2, contrast: 0.6 },
  'wood-painted-white': { set: 'painted-wood', contrast: 0.6 },
  'laminate-oak': { set: 'oak-veneer', scale: 1.2, contrast: 0.8 },
  'rattan-natural': { set: 'rattan' },
  // Tile & mosaic
  'tile-white-square': { set: 'tile-square' },
  'tile-subway-white': { set: 'tile-glazed-subway', scale: 0.7 },
  'tile-hex-terracotta': { set: 'tile-hex', scale: 1.8 },
  'tile-large-grey': { set: 'porcelain-large', scale: 3.2 },
  'tile-checker': { set: 'checker-marble' },
  'tile-terrazzo': { set: 'terrazzo' },
  'tile-mosaic-blue': { set: 'tile-mosaic', scale: 0.5, contrast: 0.8 },
  'tile-zellige-green': { set: 'tile-glazed-subway', scale: 0.7 },
  // Natural stone
  'stone-marble-carrara': { set: 'marble-white' },
  'stone-marble-nero': { set: 'marble-black' },
  'stone-travertine': { set: 'travertine' },
  'stone-slate': { set: 'slate-floor' },
  'stone-granite': { set: 'granite' },
  // Metal
  'metal-brushed-steel': { set: 'brushed-metal', contrast: 0.7 },
  'metal-brass': { set: 'brushed-metal', contrast: 0.6 },
  // Fabric & upholstery
  'fabric-linen': { set: 'linen' },
  'fabric-boucle': { set: 'boucle', scale: 0.35 },
  'fabric-velvet-green': { set: 'velvet' },
  'fabric-velvet-blush': { set: 'velvet' },
  'fabric-velvet-navy': { set: 'velvet' },
  'fabric-velvet-teal': { set: 'velvet' },
  'fabric-wool-grey': { set: 'upholstery-weave' },
  'fabric-navy': { set: 'upholstery-weave' },
  'fabric-mustard': { set: 'upholstery-weave' },
  'fabric-terracotta': { set: 'upholstery-weave' },
  'fabric-olive': { set: 'upholstery-weave' },
  'fabric-blush': { set: 'upholstery-weave' },
  'fabric-charcoal': { set: 'upholstery-weave' },
  'fabric-white-cotton': { set: 'cotton' },
  'fabric-cream': { set: 'cotton' },
  'fabric-sky': { set: 'cotton' },
  'mattress-white': { set: 'cotton', contrast: 0.6 },
  'felt-grey': { set: 'felt' },
  // Leather
  'leather-cognac': { set: 'leather' },
  'leather-black': { set: 'leather' },
  'leather-tan': { set: 'leather' },
  // Rugs & woven
  'rug-jute': { set: 'jute-weave' },
  'rug-wool-cream': { set: 'wool-carpet' },
  // Other
  cork: { set: 'cork' },
  // Expanded library (2026-10)
  'wallpaper-woodchip': { set: 'woodchip-wallpaper' },
  'plaster-rough-white': { set: 'painted-plaster' },
  'wood-versailles': { set: 'versailles-parquet' },
  'wood-basketweave': { set: 'basketweave-parquet' },
  'wood-diagonal-parquet': { set: 'diagonal-parquet' },
  'wood-herringbone-dark': { set: 'herringbone-dark' },
  'wood-dark-oak-planks': { set: 'dark-oak-planks' },
  'wood-grey-oak': { set: 'dark-oak-planks', contrast: 0.7 },
  'wood-bamboo': { set: 'bamboo-panel' },
  'wicker-fine': { set: 'wicker-fine' },
  'tile-azulejo-border': { set: 'azulejo-border' },
  'tile-azulejo-floral': { set: 'azulejo-floral' },
  'tile-terrazzo-colour': { set: 'terrazzo-colour' },
  'stone-onyx-white': { set: 'onyx-white' },
  'stone-marble-beige': { set: 'marble-beige' },
  'leather-smooth-black': { set: 'leather-smooth' },
  'leather-white': { set: 'leather-smooth', contrast: 0.7 },
  'carpet-grey': { set: 'carpet-plain' },
  'carpet-navy': { set: 'carpet-plain' },
  'carpet-beige': { set: 'carpet-plain' },
  // Colour-variant palette (2026-10-19)
  'fabric-dove-grey': { set: 'cotton' },
  'fabric-stone': { set: 'upholstery-weave' },
  'fabric-forest': { set: 'upholstery-weave' },
  'fabric-boucle-grey': { set: 'boucle', scale: 0.35 },
  'fabric-boucle-sage': { set: 'boucle', scale: 0.35 },
  'fabric-boucle-charcoal': { set: 'boucle', scale: 0.35 },
  'fabric-boucle-rust': { set: 'boucle', scale: 0.35 },
  'fabric-velvet-grey': { set: 'velvet' },
  'fabric-velvet-oat': { set: 'velvet' },
  'fabric-velvet-sage': { set: 'velvet' },
  // Scanned sets (2026-10-19): Poly Haven scans, ambientCG photogrammetry/photo sets only
  'limewash-warm': { set: 'cloudy-plaster', scale: 2 },
  'limewash-grey': { set: 'cloudy-plaster', scale: 2 },
  'limewash-terracotta': { set: 'cloudy-plaster', scale: 2 },
  'limewash-sage': { set: 'cloudy-plaster', scale: 2 },
  'venetian-white': { set: 'polished-plaster', contrast: 0.55 },
  'venetian-grey': { set: 'polished-plaster', contrast: 0.55 },
  'tadelakt-sand': { set: 'polished-plaster', scale: 1.6, contrast: 0.5 },
  'plaster-stucco-white': { set: 'white-stucco' },
  'wood-rosewood': { set: 'rosewood-veneer' },
  'wood-mahogany': { set: 'sapele-veneer' },
  'wood-acacia': { set: 'smoked-walnut-veneer' },
  'wood-ironwood': { set: 'black-walnut-veneer' },
  'wood-white-oak': { set: 'white-oak-veneer' },
  'wood-maple': { set: 'maple-veneer' },
  'wood-smoked-oak': { set: 'smoked-oak-veneer' },
  'wood-whitewashed': { set: 'oak-planks-clean', contrast: 0.6 },
  'wood-cedar-planks': { set: 'cedar-planks' },
  'bamboo-woven': { set: 'bamboo-weave' },
  'laminate-oak-planks': { set: 'laminate-planks' },
  'laminate-walnut': { set: 'walnut-veneer', scale: 1.2, contrast: 0.8 },
  'tile-terracotta-rustic': { set: 'terracotta-floor' },
  'tile-subway-green': { set: 'tile-glazed-subway', scale: 0.7 },
  'tile-subway-black': { set: 'tile-glazed-subway', scale: 0.7 },
  'tile-square-sage': { set: 'tile-square' },
  'tile-granite-dark': { set: 'granite-tiles' },
  'tile-stone-cream': { set: 'marble-tiles' },
  'tile-mosaic-cream': { set: 'square-mosaic' },
  'stone-quartz-white': { set: 'aggregate', scale: 0.6, contrast: 0.45 },
  'fabric-linen-sage': { set: 'rough-linen' },
  'fabric-linen-rust': { set: 'rough-linen' },
  'fabric-boucle-oat': { set: 'boucle', scale: 0.35 },
  'fabric-velvet-mustard': { set: 'velvet' },
  'fabric-velvet-rust': { set: 'velvet' },
  'fabric-corduroy-olive': { set: 'corduroy' },
  'fabric-corduroy-camel': { set: 'corduroy' },
  'fabric-damask-cream': { set: 'jacquard' },
  'fabric-herringbone-grey': { set: 'herringbone-wool' },
  'fabric-teddy-cream': { set: 'teddy-fleece' },
  'fabric-terry-white': { set: 'terry-cloth' },
  'fabric-waffle-white': { set: 'waffle-cotton' },
  'fabric-hessian': { set: 'hessian' },
  'leather-burgundy': { set: 'leather' },
  'leather-olive': { set: 'leather' },
  'suede-sand': { set: 'suede' },
  'rug-sisal': { set: 'sisal-weave' },
  // Plants: a scanned leaf blade (midrib on the tile edge, like leaf UVs) and potting soil
  'plant-leaf': { set: 'leaf-blade', scale: 0.12, contrast: 0.4 },
  'plant-leaf-dark': { set: 'leaf-blade', scale: 0.12, contrast: 0.4 },
  'plant-leaf-light': { set: 'leaf-blade', scale: 0.12, contrast: 0.4 },
  'plant-soil': { set: 'potting-soil', scale: 0.35 },
};

/**
 * Sets whose Substance-generated source was swapped for a scan with a different real-world
 * tile size (2026-10-19). Saved materials still at an old default scale (`from`: the old set
 * size or catalogue scale) get the new one when a project loads (`migrateProject`), so older
 * projects show the scan at its real size; scales a user changed are kept.
 */
export const PHOTO_SCALE_UPDATES: Record<string, [from: number, to: number][]> = {
  'oak-planks': [[1.8, 2]],
  'oak-wide-boards': [[1.9, 1.7]],
  'oak-herringbone': [[1.8, 3.4]],
  'dark-oak-planks': [[2, 2.03]],
  'ash-wood': [[0.8, 1]],
  'birch-wood': [[0.8, 0.5]],
  'porcelain-large': [[2.4, 1.8], [4.8, 3.2]],
  'tile-mosaic': [[1, 0.75], [0.4, 0.5]],
  'tile-hex': [[0.45, 2.3], [1.2, 1.8]],
  'marble-beige': [[2, 1]],
  terrazzo: [[1.2, 0.65]],
  'brick-painted': [[1.05, 1.1]],
  'brick-red': [[1.05, 1]],
  'woodchip-wallpaper': [[1, 2]],
  'leather-smooth': [[0.5, 0.3]],
};

function photoFor(id: string): PhotoTextureRef | null {
  const p = PHOTOS[id];
  const set = p && PHOTO_SETS_BY_ID[p.set];
  if (!p || !set) return null;
  return { setId: set.id, scale: p.scale ?? set.size, rotation: p.rotation ?? 0, contrast: p.contrast ?? 1, enabled: true };
}

function sourceFor(id: string): MaterialDefinition['source'] {
  const set = PHOTOS[id] && PHOTO_SETS_BY_ID[PHOTOS[id].set];
  if (!set) return SRC;
  return {
    name: `Neest starter library · photo: ${PHOTO_SOURCE_NAMES[set.source]} ${set.assetId}`,
    license: 'CC0 1.0 (photo texture); procedural fallback original',
    url: photoSetUrl(set),
  };
}

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
  photo: photoFor(d.id),
  overrideOf: null,
  catalogId: d.id,
  source: sourceFor(d.id),
}));

/** Material ids mapped to photo sets (exported for tests). */
export const CATALOG_PHOTO_IDS: string[] = Object.keys(PHOTOS);

export const MATERIAL_CATALOG_BY_ID: Record<string, MaterialDefinition> = Object.fromEntries(
  MATERIAL_CATALOG.map((m) => [m.id, m]),
);

export const MATERIAL_CATEGORY_LABELS: Record<MaterialCategory, string> = {
  paint: 'Paint & wallpaper',
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

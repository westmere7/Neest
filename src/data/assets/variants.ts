import type { MaterialDefinition } from '@/domain/model/schema';
import { MATERIAL_CATALOG, MATERIAL_CATALOG_BY_ID } from '@/data/materials/catalog';
import { dropPackKeys, subscribePacks } from '@/packs/events';
import type { AssetDefinition, Part } from './types';

/**
 * Colour variants: ready-made material combinations for an item, like the colour swatches of
 * Sims buy mode.
 *
 * Each material slot is sorted into a family (wood, fabric, metal, foliage…) from its label and its
 * default material, or kept fixed (glass, lights, screens, soil, sanitary ceramic, printed art).
 * Six coordinated themes then pick one material per family, so a variant is a matching set — dark
 * wood with charcoal fabric and black metal — rather than a random mix. Foliage only moves between
 * greens and flowers between flower colours, so a plant never turns red. Branded products keep their
 * real finishes and get no variants.
 *
 * Users can also save their own combination of an edited item (`UserVariant`, kept in preferences);
 * it carries copies of any project-only materials so it works in other projects too.
 */

export interface AssetVariant {
  /** 'original', a theme id, or `user:<id>`. */
  id: string;
  name: string;
  /** Slot → material id for every slot that differs from the asset defaults. */
  materials: Record<string, string>;
  /** Colours for the swatch, most visible slot first. */
  swatch: string[];
  /** Saved by the user (can be deleted). */
  user?: boolean;
}

/** A variant the user saved from an edited item. */
export interface UserVariant {
  id: string;
  name: string;
  materials: Record<string, string>;
  /** Copies of materials that are not in the catalogue (project edits), by id. */
  defs?: Record<string, MaterialDefinition>;
}

export type MaterialFamily =
  | 'wood'
  | 'planks'
  | 'painted'
  | 'fabric'
  | 'velvet'
  | 'leather'
  | 'metal'
  | 'stone'
  | 'pottery'
  | 'plastic'
  | 'rug'
  | 'foliage'
  | 'flower';

export const THEMES = ['natural', 'dark', 'light', 'warm', 'cool', 'bold'] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_LABELS: Record<Theme, string> = {
  natural: 'Natural',
  dark: 'Dark',
  light: 'Light',
  warm: 'Warm',
  cool: 'Cool',
  bold: 'Bold',
};

/** Catalogue materials per family and theme (every id must exist in the catalogue; tests check). */
export const FAMILY_THEMES: Record<Exclude<MaterialFamily, 'foliage' | 'flower'>, Record<Theme, string>> = {
  wood: { natural: 'wood-oak-light', dark: 'wood-walnut', light: 'wood-ash-white', warm: 'wood-acacia', cool: 'wood-plywood', bold: 'wood-ebony' },
  planks: { natural: 'wood-oak-natural', dark: 'wood-dark-oak-planks', light: 'wood-whitewashed', warm: 'wood-oak-wide', cool: 'wood-grey-oak', bold: 'wood-herringbone-dark' },
  painted: { natural: 'laminate-white-matte', dark: 'laminate-black', light: 'wood-painted-white', warm: 'laminate-greige', cool: 'laminate-sage', bold: 'laminate-navy' },
  fabric: { natural: 'fabric-linen', dark: 'fabric-charcoal', light: 'fabric-cream', warm: 'fabric-terracotta', cool: 'fabric-navy', bold: 'fabric-mustard' },
  velvet: { natural: 'fabric-velvet-green', dark: 'fabric-velvet-navy', light: 'fabric-velvet-blush', warm: 'fabric-velvet-rust', cool: 'fabric-velvet-teal', bold: 'fabric-velvet-mustard' },
  leather: { natural: 'leather-cognac', dark: 'leather-black', light: 'leather-white', warm: 'leather-tan', cool: 'leather-olive', bold: 'leather-burgundy' },
  metal: { natural: 'metal-brushed-steel', dark: 'metal-black-matte', light: 'metal-chrome', warm: 'metal-brass', cool: 'metal-gunmetal', bold: 'metal-copper' },
  stone: { natural: 'stone-marble-carrara', dark: 'stone-marble-nero', light: 'stone-quartz-white', warm: 'stone-travertine', cool: 'stone-granite', bold: 'stone-marble-green' },
  pottery: { natural: 'terracotta-pot', dark: 'ceramic-black', light: 'ceramic-white', warm: 'terracotta-pot', cool: 'ceramic-sage', bold: 'ceramic-blue' },
  plastic: { natural: 'plastic-white', dark: 'plastic-black', light: 'plastic-mint', warm: 'plastic-yellow', cool: 'plastic-blue', bold: 'plastic-red' },
  rug: { natural: 'rug-jute', dark: 'carpet-navy', light: 'rug-wool-cream', warm: 'rug-berber', cool: 'rug-blue-geometric', bold: 'rug-cement-tile' },
};

// ───────────── Colour helpers ─────────────

function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h.slice(0, 6), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Hue (degrees), saturation and lightness (HSL) of a hex colour. */
export function hsl(hex: string): { h: number; s: number; l: number } {
  const [r, g, b] = hexRgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d < 1e-6) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s, l };
}

/** A green that reads as foliage: hue 70–170°, not grey. */
export const isGreen = (hex: string): boolean => {
  const c = hsl(hex);
  return c.h >= 70 && c.h <= 170 && c.s >= 0.12 && c.l > 0.06 && c.l < 0.85;
};

// ───────────── Slot classification ─────────────

const FIXED_WORDS =
  /\bskin\b|\bhair\b|\beyes?\b|soil|gravel|\bgrit\b|\bsand\b|water|screen|display|glass|mirror|\blens|bulb|flame|\bwick|\bbooks?\b|\bart\b|artwork|canvas|\bprints?\b|picture|photo|label|\bdials?\b|button|\bled\b|\blights?\b|\blamps?\b|\bcords?\b|cable|\bwires?\b|\bchains?\b|\bropes?\b|hinge|\btyres?\b|\btires?\b|\bsoles?\b|\bink\b|paper|chalk|\bice\b|snow|food|fruit|cake|bread|candle|\bkeys\b|keyboard|\bvents?\b|grille|outlet|drain|spout|basket|wicker|rattan|\bcane\b|mattress|bedding/;
const FOLIAGE_WORDS = /leaf|leaves|foliage|frond|fern|moss|grass|needles|leaflet|hedge|shrub|\bivy\b|vines?\b|succulent|cactus|pearls|\bpads\b|rosette/;
const FLOWER_WORDS = /flower|petal|bloom|blossom|spathe|tulip|\broses?\b|\blil(y|ies)\b|orchid|hydrangea|sunflower|lavender/;
const MULTICOLOUR_FLOWERS = /orchid|phalaenopsis|tulip|\broses?\b|hydrangea|violet|wildflower|bouquet|hyacinth|anthurium|kalanchoe|cyclamen|geranium|petunia|window box|\bflowers\b/;
const SINGLE_COLOUR_FLOWERS = /peace lily|spathiphyllum|sunflower|lavender|bird of paradise|strelitzia|frangipani|cherry blossom/;
const POT_WORDS =/\bpots?\b|planter|vase|\burns?\b|\bjars?\b|\bjugs?\b|\bbowl/;

/** Appliances and electronics: realistic finishes only (no brass fridges). */
const APPLIANCE_METAL: Record<Theme, string> = {
  natural: 'metal-brushed-steel',
  dark: 'metal-black-matte',
  light: 'metal-white-powder',
  warm: 'metal-brushed-steel',
  cool: 'metal-anthracite',
  bold: 'metal-stainless-polished',
};

const materialOf = (id: string): MaterialDefinition | undefined => MATERIAL_CATALOG_BY_ID[id];
const PLANK_PATTERNS = new Set(['wood-planks', 'wood-planks-wide', 'herringbone', 'chevron', 'parquet-basket']);

/** Family of one slot of an asset, or null when the slot keeps its material. */
export function slotFamily(asset: AssetDefinition, slotId: string): MaterialFamily | null {
  const slot = asset.slots.find((s) => s.id === slotId);
  if (!slot) return null;
  const m = materialOf(slot.defaultMaterial);
  if (!m) return null;
  if (m.emissive || slotId === 'light') return null;
  const words = `${slot.id} ${slot.label}`.toLowerCase();
  const mid = m.id.toLowerCase();
  if (FOLIAGE_WORDS.test(words) && isGreen(m.color)) return 'foliage';
  // Flowers change colour only on species sold in many colours (orchids, tulips, roses…); a peace lily stays white.
  if (FLOWER_WORDS.test(words)) return MULTICOLOUR_FLOWERS.test(`${asset.id} ${asset.name} ${asset.tags.join(' ')}`.toLowerCase()) && !SINGLE_COLOUR_FLOWERS.test(`${asset.id} ${asset.name}`.toLowerCase()) && !(m.color.toLowerCase() === '#ffffff' && m.texture) ? 'flower' : null;
  if (FIXED_WORDS.test(words)) return null;
  // Plants vary only their leaves, flowers and pots (never trunks, stems or stands).
  if (asset.type === 'plants') return POT_WORDS.test(words) && !['fabric', 'wood', 'glass', 'metal'].includes(m.category) ? 'pottery' : null;
  // Printed or multi-coloured patterns (art, books, wallpaper prints) and photo-like bitmaps keep their look.
  if (m.texture && m.color.toLowerCase() === '#ffffff') return null;
  if (m.category === 'glass' || m.category === 'tile') return null;
  const sanitary = asset.type === 'plumbing' || asset.category === 'bathroom';
  if (POT_WORDS.test(words) && m.category !== 'wood' && m.category !== 'fabric' && m.category !== 'metal') return 'pottery';
  switch (m.category) {
    case 'wood':
      if (/rattan|wicker|cane|bamboo|cork/.test(mid)) return null;
      if (mid === 'wood-painted-white') return 'painted';
      return m.texture && PLANK_PATTERNS.has(m.texture.patternId) ? 'planks' : 'wood';
    case 'fabric':
      return /velvet/.test(mid) ? 'velvet' : /mattress|felt/.test(mid) ? null : 'fabric';
    case 'leather':
      return 'leather';
    case 'metal':
      return 'metal';
    case 'stone':
      return /terracotta|ceramic|glaze/.test(mid) ? 'pottery' : 'stone';
    case 'rug':
      return 'rug';
    case 'laminate':
    case 'paint':
      return 'painted';
    case 'plaster':
      return null;
    case 'solid': {
      if (/^ceramic-|terracotta|glaze/.test(mid)) return sanitary ? null : 'pottery';
      if (/^plastic-/.test(mid)) return 'plastic';
      if (/^solid-(white|black|light-grey|mid-grey)$/.test(mid)) return sanitary ? null : 'painted';
      return null;
    }
  }
  return null;
}

// ───────────── Foliage and flowers ─────────────

let pools: { foliage: MaterialDefinition[]; flower: MaterialDefinition[] } | null = null;
subscribePacks(() => {
  pools = null;
});
const foliagePool = (): MaterialDefinition[] => (pools ??= { foliage: computeFoliage(), flower: computeFlowers() }).foliage;
const flowerPool = (): MaterialDefinition[] => (pools ??= { foliage: computeFoliage(), flower: computeFlowers() }).flower;

/** Patterns that make a leaf a particular species (stripes, bands, variegation): never swapped in. */
const SPECIES_PATTERN = /stripe|band|zebra|variegat|cream|silver|gold|margin/;

const computeFoliage = (): MaterialDefinition[] =>
  MATERIAL_CATALOG.filter((m) => {
    if (m.emissive || /^solid-/.test(m.id)) return false;
    const text = `${m.id} ${m.name}`.toLowerCase();
    if (!/leaf|foliage|frond|fern|palm/.test(text) || /stem|stalk|trunk|vein|edge|underside|marking/.test(text)) return false;
    if (m.texture && (SPECIES_PATTERN.test(m.texture.patternId) || m.color.toLowerCase() === '#ffffff')) return false;
    const c = hsl(m.color);
    return c.h >= 80 && c.h <= 160 && c.s >= 0.2 && c.l > 0.08 && c.l < 0.7;
  });

const computeFlowers = (): MaterialDefinition[] =>
  MATERIAL_CATALOG.filter((m) => {
    if (m.emissive) return false;
    if (!/flower|petal|blossom|bloom|spathe|orchid|tulip|rose|lily|lavender|hydrangea|strelitzia/.test(`${m.id} ${m.name}`.toLowerCase())) return false;
    const c = hsl(m.color);
    return c.s > 0.25 || c.l > 0.85;
  });

const packOf = (id: string): string => (id.includes(':') ? id.split(':')[0] : '');

/** A green for a theme: darker, lighter, yellower or bluer than the default, preferring the item's own pack. */
function pickFoliage(defaultId: string, theme: Theme): string {
  const base = materialOf(defaultId);
  if (!base || theme === 'natural' || theme === 'bold') return defaultId;
  const b = hsl(base.color);
  const pool = foliagePool().filter((m) => m.id !== defaultId);
  const want = (m: MaterialDefinition): number | null => {
    const c = hsl(m.color);
    const dh = c.h - b.h;
    const dl = c.l - b.l;
    switch (theme) {
      case 'dark':
        return dl < -0.04 ? -dl * 2 - Math.abs(dh) / 180 : null;
      case 'light':
        return dl > 0.04 ? dl * 2 - Math.abs(dh) / 180 : null;
      case 'warm':
        return dh < -8 ? -dh / 60 - Math.abs(dl) : null;
      case 'cool':
        return dh > 8 ? dh / 60 - Math.abs(dl) : null;
    }
    return null;
  };
  let best: { id: string; score: number } | null = null;
  for (const m of pool) {
    const w = want(m);
    if (w === null) continue;
    const c = hsl(m.color);
    // Stay a believable sibling: limited jumps in lightness and saturation.
    if (Math.abs(c.l - b.l) > 0.22 || Math.abs(c.s - b.s) > 0.35) continue;
    // Same leaf texture first (veins stay veins), then the same pack.
    const sameTex = (m.texture?.patternId ?? '') === (base.texture?.patternId ?? '') ? 1 : 0;
    const score = sameTex * 1.5 + (packOf(m.id) === packOf(defaultId) ? 0.5 : 0) + Math.min(w, 0.8);
    if (!best || score > best.score) best = { id: m.id, score };
  }
  return best?.id ?? defaultId;
}

function pickFlower(defaultId: string, theme: Theme): string {
  const pool = flowerPool();
  const pick = (test: (h: { h: number; s: number; l: number }) => boolean) => pool.find((m) => m.id !== defaultId && test(hsl(m.color)))?.id ?? defaultId;
  switch (theme) {
    case 'light':
      return pick((c) => c.l > 0.85);
    case 'warm':
      return pick((c) => (c.h < 50 || c.h > 330) && c.s > 0.4);
    case 'cool':
      return pick((c) => c.h > 240 && c.h < 330 && c.s > 0.25);
    case 'bold':
      return pick((c) => c.h >= 40 && c.h < 70 && c.s > 0.5);
    default:
      return defaultId;
  }
}

// ───────────── Generation ─────────────

/** Rough visible area per slot at the default size (sum over parts of their box surface). */
function slotWeights(asset: AssetDefinition): Record<string, number> {
  const w: Record<string, number> = {};
  let parts: Part[] = [];
  try {
    parts = asset.build(asset.defaultSize);
  } catch {
    parts = [];
  }
  for (const p of parts) {
    let a: number;
    switch (p.shape) {
      case 'box':
        a = 2 * (p.size[0] * p.size[1] + p.size[1] * p.size[2] + p.size[0] * p.size[2]);
        break;
      case 'cylinder':
        a = 2 * Math.PI * Math.max(p.radiusTop, p.radiusBottom) * p.height;
        break;
      case 'sphere':
        a = 4 * Math.PI * p.radius * p.radius;
        break;
      case 'torus':
        a = 4 * Math.PI * Math.PI * p.radius * p.tube;
        break;
      case 'lathe': {
        const r = Math.max(...p.profile.map((q) => q[0]));
        const ys = p.profile.map((q) => q[1]);
        a = 2 * Math.PI * r * (Math.max(...ys) - Math.min(...ys) + r);
        break;
      }
      case 'prism': {
        const xs = p.outline.map((q) => q[0]);
        const zs = p.outline.map((q) => q[1]);
        a = 2 * (Math.max(...xs) - Math.min(...xs)) * (Math.max(...zs) - Math.min(...zs));
        break;
      }
    }
    const s = p.scale ?? [1, 1, 1];
    w[p.slot] = (w[p.slot] ?? 0) + a * Math.abs(s[0] * s[1] * s[2]) ** (2 / 3);
  }
  return w;
}

const colorOf = (id: string, defs?: Record<string, MaterialDefinition>): string => {
  const m = defs?.[id] ?? materialOf(id);
  if (!m) return '#cccccc';
  return m.color.toLowerCase() === '#ffffff' && m.texture ? '#e6e1d8' : m.color;
};

/** Swatch colours of a full slot → material map, heaviest visible slots first (at most three). */
export function swatchColors(asset: AssetDefinition, materials: Record<string, string>, defs?: Record<string, MaterialDefinition>): string[] {
  const weights = slotWeightsCached(asset);
  const slots = [...asset.slots].sort((a, b) => (weights[b.id] ?? 0) - (weights[a.id] ?? 0));
  const out: string[] = [];
  for (const s of slots) {
    const c = colorOf(materials[s.id] ?? s.defaultMaterial, defs);
    if (!out.includes(c)) out.push(c);
    if (out.length === 3) break;
  }
  return out;
}

const weightCache = new Map<string, Record<string, number>>();
const variantCache = new Map<string, AssetVariant[]>();
subscribePacks(() => {
  dropPackKeys(weightCache);
  dropPackKeys(variantCache);
});

function slotWeightsCached(asset: AssetDefinition): Record<string, number> {
  let w = weightCache.get(asset.id);
  if (!w) {
    w = slotWeights(asset);
    weightCache.set(asset.id, w);
  }
  return w;
}

/** True for assets that keep their own finishes (branded products and imported models). */
export const hasFixedFinish = (asset: AssetDefinition): boolean => !!asset.brand || asset.category === 'custom';

/**
 * The built-in colour variants of an asset: the original first, then up to six themes that change
 * at least one slot. Empty for branded and imported items and for items with nothing to vary.
 */
export function assetVariants(asset: AssetDefinition): AssetVariant[] {
  const hit = variantCache.get(asset.id);
  if (hit) return hit;
  const out = buildVariants(asset);
  variantCache.set(asset.id, out);
  return out;
}

function buildVariants(asset: AssetDefinition): AssetVariant[] {
  if (hasFixedFinish(asset)) return [];
  if (asset.variants?.length) return presetVariants(asset);
  const families = asset.slots.map((s) => [s, slotFamily(asset, s.id)] as const).filter(([, f]) => f !== null);
  if (!families.length) return [];
  const original: AssetVariant = { id: 'original', name: 'Original', materials: {}, swatch: swatchColors(asset, {}) };
  const out: AssetVariant[] = [original];
  const seen = new Set<string>(['']);
  for (const theme of THEMES) {
    const materials: Record<string, string> = {};
    for (const [slot, family] of families) {
      const appliance = family === 'metal' && (asset.type === 'appliances' || asset.type === 'electronics');
      const id =
        family === 'foliage'
          ? pickFoliage(slot.defaultMaterial, theme)
          : family === 'flower'
            ? pickFlower(slot.defaultMaterial, theme)
            : appliance
              ? APPLIANCE_METAL[theme]
              : FAMILY_THEMES[family!][theme];
      if (id !== slot.defaultMaterial && materialOf(id)) materials[slot.id] = id;
    }
    const key = Object.keys(materials)
      .sort()
      .map((k) => `${k}=${materials[k]}`)
      .join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: theme, name: variantName(asset, materials, THEME_LABELS[theme]), materials, swatch: swatchColors(asset, materials) });
  }
  return out.length > 1 ? out : [];
}

/** Hand-made variants (`asset.variants`): unknown slots and materials are skipped. */
function presetVariants(asset: AssetDefinition): AssetVariant[] {
  const slots = new Set(asset.slots.map((s) => s.id));
  const out: AssetVariant[] = [{ id: 'original', name: 'Original', materials: {}, swatch: swatchColors(asset, {}) }];
  for (const v of asset.variants ?? []) {
    const materials = Object.fromEntries(
      Object.entries(v.materials).filter(([slot, id]) => slots.has(slot) && materialOf(id) && asset.slots.find((s) => s.id === slot)?.defaultMaterial !== id),
    );
    if (!Object.keys(materials).length || out.some((o) => o.id === v.id)) continue;
    out.push({ id: v.id, name: v.name, materials, swatch: swatchColors(asset, materials) });
  }
  return out.length > 1 ? out : [];
}

/** "Dark · Walnut, Charcoal weave": the theme plus the materials of the two most visible changed slots. */
function variantName(asset: AssetDefinition, materials: Record<string, string>, theme: string): string {
  const weights = slotWeightsCached(asset);
  const names = Object.keys(materials)
    .sort((a, b) => (weights[b] ?? 0) - (weights[a] ?? 0))
    .slice(0, 2)
    .map((slot) => materialOf(materials[slot])?.name)
    .filter((n, i, all): n is string => !!n && all.indexOf(n) === i);
  return names.length ? `${theme} · ${names.join(', ')}` : theme;
}

/** User variants as swatch-ready variants (materials that no longer exist are dropped). */
export function userVariantsFor(asset: AssetDefinition, saved: UserVariant[] | undefined): AssetVariant[] {
  if (hasFixedFinish(asset) || !saved?.length) return [];
  const slots = new Set(asset.slots.map((s) => s.id));
  return saved.map((u) => {
    const materials = Object.fromEntries(Object.entries(u.materials).filter(([slot, id]) => slots.has(slot) && (materialOf(id) || u.defs?.[id])));
    return { id: `user:${u.id}`, name: u.name, materials, swatch: swatchColors(asset, materials, u.defs), user: true };
  });
}

/** Slot overrides of an object that differ from the asset defaults. */
export function materialOverrides(asset: AssetDefinition, materials: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of asset.slots) {
    const id = materials[s.id];
    if (id && id !== s.defaultMaterial) out[s.id] = id;
  }
  return out;
}

/** True when two slot → material maps describe the same finish (defaults filled in). */
export function sameFinish(asset: AssetDefinition, a: Record<string, string>, b: Record<string, string>): boolean {
  return asset.slots.every((s) => (a[s.id] ?? s.defaultMaterial) === (b[s.id] ?? s.defaultMaterial));
}

/** The variant (built-in or user) matching an object's current materials, if any. */
export function matchingVariant(asset: AssetDefinition, materials: Record<string, string>, variants: AssetVariant[]): AssetVariant | undefined {
  return variants.find((v) => sameFinish(asset, v.materials, materials));
}

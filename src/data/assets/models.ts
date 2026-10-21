import type { AssetDefinition, AssetModelVariant, MaterialSlot, Part } from './types';
import { subscribePacks } from '@/packs/events';

/**
 * Model variants: one item, several looks of its contents — a bookcase full or empty, a wardrobe
 * with or without clothes, a sideboard bare or styled. Unlike colour variants they change parts,
 * not materials; unlike separate items (`variantOf`) they keep the same item, size and outline.
 *
 * An asset lists its own `models` (the first is the default), and content packs can add models to
 * any other item (`setModelExtensions`): the unmodified item then becomes the first model, under
 * the name the pack gives it. A placed object picks one with `PlacedObject.model`.
 *
 * `withModel` returns the asset as that model builds it. Props a model adds are forced out of the
 * plan outline (`plan: false`); the object's box, collisions and dimensions never depend on them.
 */

/** Models added to an item by a pack, with the name of the item's own (unmodified) look. */
export interface ModelExtension {
  /** Name of the unmodified item as a model, e.g. "Styled" when the pack adds "Empty". */
  original: string;
  models: AssetModelVariant[];
}

/** Id of the implicit model that is an extended item exactly as built. */
export const ORIGINAL_MODEL = 'original';

const extensions = new Map<string, Map<string, ModelExtension>>();
let derived = new WeakMap<AssetDefinition, Map<string, AssetDefinition>>();
// Content packs reload live: derived assets are rebuilt from the new definitions.
subscribePacks(() => {
  derived = new WeakMap();
});

/** Replaces the models a source (a pack) adds to other items: asset id → extension. */
export function setModelExtensions(source: string, byAsset: Record<string, ModelExtension>): void {
  for (const m of extensions.values()) m.delete(source);
  for (const [assetId, ext] of Object.entries(byAsset)) {
    if (!extensions.has(assetId)) extensions.set(assetId, new Map());
    extensions.get(assetId)!.set(source, ext);
  }
  for (const [k, m] of extensions) if (!m.size) extensions.delete(k);
  derived = new WeakMap();
}

/** Removes every source's model extensions (tests, pack reloads). */
export function clearModelExtensions(): void {
  extensions.clear();
  derived = new WeakMap();
}

/** The model variants of an asset (default first), or [] when it has fewer than two. */
export function assetModels(asset: AssetDefinition | null | undefined): AssetModelVariant[] {
  if (!asset) return [];
  const own = asset.models ?? [];
  const ext = extensions.get(asset.id);
  if (!ext?.size) return own.length >= 2 ? own : [];
  const added = [...ext.values()].flatMap((e) => e.models);
  const list = own.length ? [...own] : [{ id: ORIGINAL_MODEL, name: [...ext.values()][0].original }];
  for (const m of added) if (!list.some((x) => x.id === m.id)) list.push(m);
  return list.length >= 2 ? list : [];
}

/** The model a placed item uses: `id` when the asset has it, else the default (first) one. */
export function resolveModel(asset: AssetDefinition | null | undefined, id?: string | null): AssetModelVariant | null {
  const list = assetModels(asset);
  if (!list.length) return null;
  return list.find((m) => m.id === id) ?? list[0];
}

/** Model id to store on a placed item: undefined for the default model or an item without models. */
export function storedModelId(asset: AssetDefinition | null | undefined, id?: string | null): string | undefined {
  const list = assetModels(asset);
  const m = list.find((x) => x.id === id);
  return m && m !== list[0] ? m.id : undefined;
}

const changesNothing = (m: AssetModelVariant) => !m.hide?.length && !m.props && !m.slots?.length;

/** Material slots of an asset across all its models (for slot defaults of any placed model). */
export function allModelSlots(asset: AssetDefinition): MaterialSlot[] {
  const out = [...asset.slots];
  for (const m of assetModels(asset)) for (const s of m.slots ?? []) if (!out.some((x) => x.id === s.id)) out.push(s);
  return out;
}

/** Default material of a slot of an asset, looking in its models' own slots too. */
export function slotDefaultMaterial(asset: AssetDefinition | null | undefined, slot: string): string | undefined {
  if (!asset) return undefined;
  return asset.slots.find((s) => s.id === slot)?.defaultMaterial ?? allModelSlots(asset).find((s) => s.id === slot)?.defaultMaterial;
}

/**
 * The asset as built in model `id` (default model when absent or unknown): its own parts minus the
 * model's hidden slots, plus the model's props (never in the plan outline). Items without models,
 * and the unmodified model, return the asset itself. Derived assets get the id `<id>@model:<model>`.
 */
export function withModel(asset: AssetDefinition, id?: string | null): AssetDefinition;
export function withModel(asset: AssetDefinition | null, id?: string | null): AssetDefinition | null;
export function withModel(asset: AssetDefinition | null, id?: string | null): AssetDefinition | null {
  if (!asset) return null;
  const m = resolveModel(asset, id);
  if (!m || changesNothing(m)) return asset;
  let byModel = derived.get(asset);
  if (!byModel) derived.set(asset, (byModel = new Map()));
  const hit = byModel.get(m.id);
  if (hit) return hit;
  const hide = new Set(m.hide ?? []);
  const own = new Set((m.slots ?? []).map((s) => s.id));
  const slots = [...asset.slots.filter((s) => !hide.has(s.id) || own.has(s.id)), ...(m.slots ?? []).filter((s) => !asset.slots.some((x) => x.id === s.id))];
  let warned = false;
  const props = (size: Parameters<AssetDefinition['build']>[0]): Part[] => {
    if (!m.props) return [];
    try {
      const parts = m.props(size);
      return Array.isArray(parts) ? parts.map((p) => (p.plan === false ? p : { ...p, plan: false })) : [];
    } catch (e) {
      if (!warned) console.warn(`[models] ${asset.id} model "${m.id}" props failed:`, e);
      warned = true;
      return [];
    }
  };
  const def: AssetDefinition = {
    ...asset,
    id: `${asset.id}@model:${m.id}`,
    slots,
    models: undefined,
    build: (size) => {
      const base = hide.size ? asset.build(size).filter((p) => !hide.has(p.slot)) : asset.build(size);
      return [...base, ...props(size)];
    },
  };
  byModel.set(m.id, def);
  return def;
}

/** Every asset as each of its models builds it (thumbnail export): the assets plus their model looks. */
export function withAllModels(assets: AssetDefinition[]): AssetDefinition[] {
  const out: AssetDefinition[] = [];
  const seen = new Set<string>();
  for (const a of assets) {
    for (const v of [a, ...assetModels(a).map((m) => withModel(a, m.id))]) {
      if (seen.has(v.id)) continue;
      seen.add(v.id);
      out.push(v);
    }
  }
  return out;
}

/**
 * Separate "version" items retired in favour of model variants: old asset id → the item and model
 * that replace it (project loading rewrites placed items; see storage/migrations). `dh` is the
 * height the old item added above the furniture for its props (models do not count props).
 */
export const RETIRED_MODEL_ITEMS: Record<
  string,
  { assetId: string; model?: string; dh?: number; keepModel?: boolean; size?: { w: number; d: number; h: number } }
> = {
  'model-variants:bookcase-empty': { assetId: 'bookcase', model: 'empty' },
  'model-variants:shelf-ladder-empty': { assetId: 'shelf-ladder', model: 'empty' },
  'model-variants:shelving-unit-empty': { assetId: 'shelving-unit', model: 'empty' },
  'model-variants:cube-storage-baskets-only': { assetId: 'cube-storage', model: 'empty' },
  'model-variants:coffee-table-glass-clear': { assetId: 'coffee-table-glass', model: 'empty' },
  'model-variants:console-table-bare': { assetId: 'console-table', model: 'empty' },
  'model-variants:tables-nesting-bare': { assetId: 'tables-nesting', model: 'empty' },
  'model-variants:desk-hutch-empty': { assetId: 'desk-hutch', model: 'empty' },
  'model-variants:bedside-table-bare': { assetId: 'bedside-table', model: 'empty' },
  'model-variants:china-cabinet-empty': { assetId: 'china-cabinet', model: 'empty' },
  'model-variants:display-cabinet-empty': { assetId: 'display-cabinet', model: 'empty' },
  'model-variants:bar-cart-no-bottles': { assetId: 'bar-cart', model: 'empty' },
  'model-variants:wine-rack-empty': { assetId: 'wine-rack', model: 'empty' },
  'model-variants:dining-table-trestle-no-runner': { assetId: 'dining-table-trestle', model: 'empty' },
  'model-variants:picnic-table-no-cloth': { assetId: 'picnic-table', model: 'empty' },
  'model-variants:utility-sink-empty': { assetId: 'utility-sink', model: 'empty' },
  'model-variants:dining-table-rect-set': { assetId: 'dining-table-rect', model: 'styled', dh: 0.19 },
  'model-variants:dining-table-round-set': { assetId: 'dining-table-round', model: 'styled', dh: 0.13 },
  'model-variants:dining-table-pedestal-set': { assetId: 'dining-table-pedestal', model: 'styled', dh: 0.13 },
  'model-variants:patio-table-set': { assetId: 'patio-table', model: 'styled', dh: 0.19 },
  'model-variants:coffee-table-round-styled': { assetId: 'coffee-table-round', model: 'styled', dh: 0.3 },
  'model-variants:side-table-styled': { assetId: 'side-table', model: 'styled', dh: 0.5 },
  'model-variants:sideboard-styled': { assetId: 'sideboard', model: 'styled', dh: 0.55 },
  'model-variants:media-console-styled': { assetId: 'media-console', model: 'styled', dh: 0.32 },
  'model-variants:dresser-styled': { assetId: 'dresser', model: 'styled', dh: 0.3 },
  'model-variants:kitchen-base-cabinet-styled': { assetId: 'kitchen-base-cabinet', model: 'styled', dh: 0.24 },
  'model-variants:kitchen-island-styled': { assetId: 'kitchen-island', model: 'styled', dh: 0.32 },
  // Branded items that looked the same as another one (no model: the replacement as it is).
  'branded-laptops:acer-nitro-v-15': { assetId: 'branded-laptops:macbook-pro-14-m4' },
  'branded-laptops:lenovo-loq-15irx9': { assetId: 'branded-laptops:macbook-pro-14-m4' },
  'branded-washers:miele-wwd320-wcs': { assetId: 'branded-washers:bosch-wgg254z0gb' },
  'branded-washers:miele-wtd160-wcs': { assetId: 'branded-washers:bosch-wgg254z0gb' },
  'bosch-dishwashers:shpm88z75n': { assetId: 'bosch-dishwashers:sms4hvi33e' },
  'branded-audio:jbl-charge-5': { assetId: 'branded-audio:jbl-flip-6' },
  'branded-audio:marshall-acton-iii': { assetId: 'branded-audio:marshall-stanmore-iii' },
  'branded-bathroom-vn:inax-ac-902vn': { assetId: 'branded-bathroom-vn:toto-ms885de2' },
  'branded-bathroom-vn:grohe-euphoria-smartcontrol-310': { assetId: 'branded-bathroom-vn:american-standard-wf-1772' },
  'branded-climate-vn:daikin-ftkb25xvmv': { assetId: 'branded-climate-vn:panasonic-cs-xu9zkh-8' },
  // Look-alike items removed on 2026-10-21 (same shape and look as the item kept). Placed items keep their
  // size, materials and, where the kept item has it, their model.
  'styled-storage:styled-bookcase': { assetId: 'bookcase', keepModel: true },
  'styled-storage:styled-ladder-shelf': { assetId: 'shelf-ladder', keepModel: true },
  'sofas:chesterfield-tufted': { assetId: 'sofa-chesterfield', keepModel: true },
  'couches:chesterfield-rolled-arm': { assetId: 'sofa-chesterfield', keepModel: true },
  'sofas:mid-century-tufted-bench': { assetId: 'sofa-mid-century', keepModel: true },
  'sofas:sectional-chaise-right': { assetId: 'couches:chaise-sectional-piped-right', keepModel: true },
  'sofas:sectional-chaise-left': { assetId: 'couches:chaise-sectional-piped-left', keepModel: true },
  'sofas:camelback': { assetId: 'couches:camelback-show-wood', keepModel: true },
  'sofas:tuxedo': { assetId: 'couches:tufted-tuxedo-3-seat', keepModel: true },
  'sofas:track-arm-loveseat': { assetId: 'couches:piped-track-arm-2-seat', keepModel: true },
  'kitchen-counters:base-shaker-doors': { assetId: 'kitchen-counters:base-doors-90', keepModel: true },
  'kitchen-counters:base-door-60': { assetId: 'kitchen-base-cabinet', keepModel: true },
  'kitchen-counters:base-drawers-3': { assetId: 'kitchen-collection:base-drawer-unit', keepModel: true },
  'kitchen-counters:sink-farmhouse-shaker': { assetId: 'kitchen-collection:sink-base-farmhouse', keepModel: true },
  'kitchen-counters:sink-inset-80': { assetId: 'kitchen-sink-unit', keepModel: true },
  'kitchen-counters:sink-double-bowl-120': { assetId: 'kitchen-collection:sink-double', keepModel: true },
  'branded-home-electronics:xiaomi-smart-standing-fan-2-lite': { assetId: 'branded-home-electronics:xiaomi-smart-standing-fan-2', keepModel: true },
  'branded-home-electronics:xiaomi-smart-standing-fan-2-pro': { assetId: 'branded-home-electronics:xiaomi-smart-standing-fan-2', keepModel: true },
  'kitchen-collection:oven-microwave-tower': { assetId: 'kitchen-oven-tower', keepModel: true },
  'cabinets-wardrobes:vitrine': { assetId: 'display-cabinet', keepModel: true },
  'shelving:over-toilet-shelf': { assetId: 'bathroom-collection:over-toilet-shelving', keepModel: true },
  'structures:built-in-wardrobe-wall': { assetId: 'cabinets-wardrobes:wardrobe-builtin', keepModel: true },
  'branded-home-electronics:dyson-v12-detect-slim': { assetId: 'branded-home-electronics:dyson-v15-detect', keepModel: true },
  'branded-washers:aqua-aqh-v800h-ss': { assetId: 'branded-washers:aqua-aqh-v700fw', keepModel: true },
  'branded-washers:aqua-aqh-v901k-ps': { assetId: 'branded-washers:aqua-aqh-v700fw', keepModel: true },
  'branded-washers:aqua-aqh-h1000j-ps': { assetId: 'branded-washers:aqua-aqh-h900g-ps', keepModel: true },
  'branded-laptops:macbook-air-13-m3': { assetId: 'branded-laptops:macbook-pro-14-m4', keepModel: true },
  'workspace:computer-desk-hutch': { assetId: 'desk-hutch', keepModel: true },
  'bedroom-collection:hollywood-vanity': { assetId: 'beauty:hollywood-vanity-set-up', keepModel: true },
  'ac-outdoor-units:outdoor-unit-12000btu': { assetId: 'ac-outdoor-units:outdoor-unit-9000btu', keepModel: true },
  'ac-outdoor-units:outdoor-unit-18000btu': { assetId: 'ac-outdoor-units:outdoor-unit-9000btu', keepModel: true },
  // Generic items converted into the real product most common in Vietnam (2026-10-21). Branded items have one
  // published size, so placed items take it (`size`).
  'range-hood': { assetId: 'branded-appliances-vn:hafele-hh-wt70a' },
  'appliances:pressure-cooker': { assetId: 'branded-appliances-vn:philips-hd2151', size: { w: 0.285, d: 0.385, h: 0.262 } },
  'appliances:toaster-oven': { assetId: 'branded-appliances-vn:panasonic-nb-h3203kra', size: { w: 0.527, d: 0.392, h: 0.343 } },
  'appliances:mini-fridge': { assetId: 'branded-appliances-vn:aqua-aqr-d100fa' },
  'appliances:chest-freezer': { assetId: 'branded-appliances-vn:sanaky-vh-2899a1', size: { w: 1.08, d: 0.62, h: 0.845 } },
  'appliances:garment-steamer': { assetId: 'branded-appliances-vn:philips-ste3170' },
  'asian-everyday:water-dispenser': { assetId: 'branded-appliances-vn:kangaroo-kg31a3', size: { w: 0.274, d: 0.303, h: 1.52 } },
  'coffee-machine': { assetId: 'branded-appliances-vn:delonghi-ec685', size: { w: 0.149, d: 0.33, h: 0.303 } },
  'asian-everyday:air-cooler': { assetId: 'branded-climate-vn:kangaroo-kg50f100', size: { w: 0.465, d: 0.35, h: 1 } },
  'asian-everyday:floor-fan-box': { assetId: 'branded-climate-vn:senko-bd1410', size: { w: 0.49, d: 0.196, h: 0.542 } },
  'bathroom-collection:ceiling-exhaust-fan': { assetId: 'branded-climate-vn:panasonic-fv-24cu9', size: { w: 0.3, d: 0.3, h: 0.013 } },
  'ceiling-fan-light': { assetId: 'branded-climate-vn:panasonic-f-60gfn', size: { w: 1.5, d: 1.5, h: 0.288 } },
  'floor-fan': { assetId: 'branded-climate-vn:midea-fs40-10navn', size: { w: 0.395, d: 0.395, h: 1.305 } },
  'basin-pedestal': { assetId: 'branded-bathroom-vn:toto-lpt236cs', size: { w: 0.53, d: 0.465, h: 0.81 } },
  'toilet-wall-hung': { assetId: 'branded-bathroom-vn:inax-ac-952vn', size: { w: 0.362, d: 0.55, h: 0.363 } },
  'printer': { assetId: 'branded-tech-vn:canon-lbp2900', size: { w: 0.37, d: 0.251, h: 0.217 } },
  'monitor': { assetId: 'branded-tech-vn:samsung-s24c310', size: { w: 0.5395, d: 0.2174, h: 0.4228 } },
  'game-console': { assetId: 'branded-tech-vn:sony-ps5-slim', size: { w: 0.358, d: 0.216, h: 0.096 } },
  'projector-ceiling': { assetId: 'branded-tech-vn:epson-eb-e01', size: { w: 0.302, d: 0.234, h: 0.3 } },
  'computer-tower': { assetId: 'branded-tech-vn:dell-vostro-3020-mt', size: { w: 0.154, d: 0.292, h: 0.3243 } },
  'office-chair': { assetId: 'branded-tech-vn:sihoo-m57', size: { w: 0.64, d: 0.66, h: 1.1 } },
  'filing-cabinet': { assetId: 'branded-tech-vn:hoa-phat-tu4f', size: { w: 0.47, d: 0.62, h: 1.28 } },
  'piano-upright': { assetId: 'branded-music:yamaha-u1j', size: { w: 1.52, d: 0.62, h: 1.21 } },
  'piano-grand': { assetId: 'branded-music:yamaha-c3x', size: { w: 1.49, d: 1.86, h: 1.01 } },
  'keyboard-stand': { assetId: 'branded-music:yamaha-psr-e383', size: { w: 0.941, d: 0.42, h: 1.02 } },
  'guitar-stand': { assetId: 'branded-music:yamaha-f310', size: { w: 0.42, d: 0.44, h: 1.1 } },
  'drum-kit': { assetId: 'branded-music:roland-td-07kv', size: { w: 1.23, d: 1.1, h: 1.2 } },
  'vietnamese-home:honda-scooter': { assetId: 'branded-vehicles-vn:honda-vision-2025', size: { w: 1.925, d: 0.686, h: 1.126 } },
  'bicycle': { assetId: 'branded-vehicles-vn:thong-nhat-new-26', size: { w: 1.77, d: 0.62, h: 1.06 } },
  'lighting-collection:led-panel': { assetId: 'branded-lighting-vn:rang-dong-p06-600x600-40w', size: { w: 0.6, d: 0.6, h: 0.035 } },
};

/** The item and model to use for an asset id, following retired version items to their replacement. */
export function currentItem(assetId: string, model?: string): { assetId: string; model?: string; dh?: number } {
  const r = RETIRED_MODEL_ITEMS[assetId];
  if (!r) return { assetId, ...(model ? { model } : {}) };
  const m = r.model ?? (r.keepModel ? model : undefined);
  return { assetId: r.assetId, ...(m ? { model: m } : {}), ...(r.dh ? { dh: r.dh } : {}) };
}

/** Moves a placed item off a retired item onto its replacement (and model, if any); true when changed. */
export function upgradeRetiredItem(o: { assetId: string; model?: string; width?: number; depth?: number; height: number }): boolean {
  const r = RETIRED_MODEL_ITEMS[o.assetId];
  if (!r) return false;
  o.assetId = r.assetId;
  if (r.model) o.model = r.model;
  else if (!r.keepModel) delete o.model;
  if (r.dh) o.height = Math.max(0.005, Math.round((o.height - r.dh) * 1e4) / 1e4);
  if (r.size) {
    o.width = r.size.w;
    o.depth = r.size.d;
    o.height = r.size.h;
  }
  return true;
}

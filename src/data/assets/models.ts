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
export const RETIRED_MODEL_ITEMS: Record<string, { assetId: string; model?: string; dh?: number }> = {
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
};

/** The item and model to use for an asset id, following retired version items to their replacement. */
export function currentItem(assetId: string, model?: string): { assetId: string; model?: string; dh?: number } {
  const r = RETIRED_MODEL_ITEMS[assetId];
  return r ? { assetId: r.assetId, ...(r.model ? { model: r.model } : {}), ...(r.dh ? { dh: r.dh } : {}) } : { assetId, ...(model ? { model } : {}) };
}

/** Moves a placed item off a retired item onto its replacement (and model, if any); true when changed. */
export function upgradeRetiredItem(o: { assetId: string; model?: string; height: number }): boolean {
  const r = RETIRED_MODEL_ITEMS[o.assetId];
  if (!r) return false;
  o.assetId = r.assetId;
  if (r.model) o.model = r.model;
  else delete o.model;
  if (r.dh) o.height = Math.max(0.005, Math.round((o.height - r.dh) * 1e4) / 1e4);
  return true;
}

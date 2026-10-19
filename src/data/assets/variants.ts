import type { MaterialDefinition } from '@/domain/model/schema';
import { MATERIAL_CATALOG, MATERIAL_CATALOG_BY_ID } from '@/data/materials/catalog';
import { dropPackKeys, subscribePacks } from '@/packs/events';
import type { AssetDefinition, Part } from './types';
import { LEAD_ROLES, LOOKS, ROLE_FALLBACK, TONES, archetypeOf, hsl, lookName, materialKind, resolveTone, slotRoles, toneAllowed, toneLabel, type Look, type Role } from './variantLooks';

export { archetypeOf, hsl, isGreen, slotRole } from './variantLooks';

/**
 * Colour variants: ready-made material combinations for an item, like the colour swatches of
 * Sims buy mode.
 *
 * Generated variants come from curated looks per kind of object (variantLooks.ts): a bed gets
 * "Hotel white", "Sage & oak" or "Walnut & navy" with its sheets kept light; a kitchen unit gets
 * painted or oak fronts with a worktop and pulls that suit them; a tap gets the finishes taps are
 * sold in. Each slot plays a role (frame, top, fronts, hardware, upholstery, sheets…) and a look
 * gives each role a tone that resolves to a material of the slot's own kind. Props, colour-coded
 * parts, prints, glass and lights never change. Branded products keep their real finishes; items
 * with hand-made `variants` show exactly those.
 *
 * Users can also save their own combination of an edited item (`UserVariant`, kept in preferences);
 * it carries copies of any project-only materials so it works in other projects too.
 */

export interface AssetVariant {
  /** 'original', a look id, or `user:<id>`. */
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

const materialOf = (id: string): MaterialDefinition | undefined => MATERIAL_CATALOG_BY_ID[id];

// ───────────── Flowers ─────────────

let flowers: MaterialDefinition[] | null = null;
subscribePacks(() => {
  flowers = null;
});

const flowerPool = (): MaterialDefinition[] =>
  (flowers ??= MATERIAL_CATALOG.filter((m) => {
    if (m.emissive) return false;
    if (!/flower|petal|blossom|bloom|spathe|orchid|tulip|rose|lily|lavender|hydrangea|strelitzia/.test(`${m.id} ${m.name}`.toLowerCase())) return false;
    const c = hsl(m.color);
    return c.s > 0.25 || c.l > 0.85;
  }));

/** A flower colour for a look: white, warm reds, cool pinks and purples, or bold yellows. */
function pickFlower(defaultId: string, tone: NonNullable<Look['flower']>): string {
  const pick = (test: (h: { h: number; s: number; l: number }) => boolean) => flowerPool().find((m) => m.id !== defaultId && test(hsl(m.color)))?.id ?? defaultId;
  switch (tone) {
    case 'light':
      return pick((c) => c.l > 0.85);
    case 'warm':
      return pick((c) => (c.h < 30 || c.h > 330) && c.s > 0.4);
    case 'cool':
      return pick((c) => c.h > 240 && c.h < 330 && c.s > 0.25);
    case 'bold':
      return pick((c) => c.h >= 40 && c.h < 70 && c.s > 0.5);
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

/** Most looks an item shows next to its original. */
export const MAX_LOOKS = 6;

/**
 * The built-in colour variants of an asset: the original first, then the looks of its kind of
 * object that change one of its main slots. Branded items offer only the finishes the maker sells
 * (their hand-made `variants`); imported items and items with nothing to vary get none.
 */
export function assetVariants(asset: AssetDefinition): AssetVariant[] {
  const hit = variantCache.get(asset.id);
  if (hit) return hit;
  const out = buildVariants(asset);
  variantCache.set(asset.id, out);
  return out;
}

/** Tones a look gives a role, falling back to a related role (seat → upholstery, legs → frame…). */
function tonesFor(look: Look, role: Role): string | string[] | undefined {
  if (role === 'foliage' || role === 'flower') return undefined;
  const own = look.roles[role];
  if (own !== undefined) return own;
  const alt = ROLE_FALLBACK[role];
  return alt && alt !== 'foliage' && alt !== 'flower' ? look.roles[alt] : undefined;
}

/** Two materials that look the same (a pack's satin stainless and the catalogue's brushed steel). */
function nearlySame(a: MaterialDefinition | undefined, b: MaterialDefinition | undefined): boolean {
  if (!a || !b || materialKind(a) !== materialKind(b)) return false;
  const pa = parseInt(a.color.slice(1, 7), 16);
  const pb = parseInt(b.color.slice(1, 7), 16);
  const d = Math.max(...[16, 8, 0].map((sh) => Math.abs(((pa >> sh) & 255) - ((pb >> sh) & 255)) / 255));
  return d < 0.05;
}

/** True when an appliance's own body is a colour, so retro looks (cream, sage, red…) make sense. */
function colourfulBody(slots: { role: Role; material?: MaterialDefinition }[], weights: Record<string, number>, ids: string[]): boolean {
  let best: MaterialDefinition | undefined;
  let bestW = -1;
  slots.forEach((s, i) => {
    if ((s.role === 'body' || s.role === 'frame') && (weights[ids[i]] ?? 0) > bestW) {
      bestW = weights[ids[i]] ?? 0;
      best = s.material;
    }
  });
  if (!best || best.category === 'metal') return false;
  const c = hsl(best.color);
  return c.s > 0.2 && c.l > 0.15 && c.l < 0.9;
}

function buildVariants(asset: AssetDefinition): AssetVariant[] {
  if (asset.variants?.length && asset.category !== 'custom') return presetVariants(asset);
  if (hasFixedFinish(asset)) return [];
  const arche = archetypeOf(asset);
  if (arche === 'none') return [];
  const roles = slotRoles(asset, arche);
  const slots = asset.slots
    .map((slot, i) => {
      const material = materialOf(slot.defaultMaterial);
      return { slot, material, kind: materialKind(material), role: roles[i] };
    })
    .filter((s): s is typeof s & { role: Role } => s.role !== null);
  if (!slots.length) return [];
  const weights = slotWeightsCached(asset);
  // The slots that make an item's look: the most visible ones it can change (three on busy items).
  // Props and trimmings (crockery on a shelf, a throw, piping) never decide it.
  const body = slots.filter((s) => s.role !== 'crockery' && s.role !== 'accent' && s.role !== 'trim');
  const ranked = body.length ? body : slots;
  const total = ranked.reduce((sum, s) => sum + (weights[s.slot.id] ?? 0), 0);
  const main = new Set(
    [...ranked]
      .sort((a, b) => (weights[b.slot.id] ?? 0) - (weights[a.slot.id] ?? 0))
      .slice(0, ranked.length >= 4 ? 3 : 2)
      .map((s) => s.slot.id),
  );
  const retroOk = arche === 'appliance' && colourfulBody(slots, weights, slots.map((s) => s.slot.id));
  // The roles that carry a look on this item: a bed's duvet, a sofa's upholstery, a table's top — or,
  // for cabinets, lamps, objects, kitchens and rugs, any of their main parts (a shelving unit's frame
  // or its shelves). The most visible of them names the look when its other words drop out.
  const several = arche === 'storage' || arche === 'lighting' || arche === 'tech-light' || arche === 'object' || arche === 'kitchen' || arche === 'rug';
  const first = LEAD_ROLES[arche].find((r) => slots.some((s) => s.role === r));
  const leadRoles = new Set<Role>(several ? LEAD_ROLES[arche].filter((r) => slots.some((s) => s.role === r)) : first ? [first] : []);
  const lead = leadRoles.size ? [...leadRoles][0] : undefined;
  const out: AssetVariant[] = [{ id: 'original', name: 'Original', materials: {}, swatch: swatchColors(asset, {}) }];
  const seen = new Set<string>(['']);
  for (const look of LOOKS[arche]) {
    if (out.length > MAX_LOOKS) break;
    if (look.retro && !retroOk) continue;
    if (look.requires && !slots.some((s) => s.role === look.requires && s.kind && resolveTone(look.roles[look.requires as Exclude<Role, 'foliage' | 'flower'>], s.kind))) continue;
    const materials: Record<string, string> = {};
    const used: { tones: string[]; tone?: string }[] = [];
    let leadFits = !lead;
    let leadTone: string | undefined;
    for (const s of slots) {
      let id: string | undefined;
      if (s.role === 'flower' || !s.kind) {
        // Flowers pick a colour of their own; `used` stays aligned with `slots`.
        id = s.role === 'flower' && look.flower ? pickFlower(s.slot.defaultMaterial, look.flower) : undefined;
        used.push({ tones: [] });
        if (id && leadRoles.has(s.role)) leadFits = true;
      } else {
        const offered = tonesFor(look, s.role);
        const tones = offered === undefined ? [] : Array.isArray(offered) ? offered : [offered];
        const tone = tones.find((t) => {
          const m = TONES[t]?.[s.kind!];
          return !!m && !!materialOf(m) && toneAllowed(asset, t, s.kind!);
        });
        if (tone) id = TONES[tone][s.kind];
        used.push({ tones, tone });
        if (tone && leadRoles.has(s.role)) {
          leadFits = true;
          leadTone ??= tone;
        }
      }
      if (id && id !== s.slot.defaultMaterial && materialOf(id) && !nearlySame(s.material, materialOf(id))) materials[s.slot.id] = id;
    }
    // The look's lead colour has to fit the item (no "Sage & oak" without anything sage) and change it:
    // a sofa look that keeps the upholstery and only swaps the feet is not worth a swatch.
    if (!leadFits) continue;
    if (lead && !slots.some((s) => leadRoles.has(s.role) && materials[s.slot.id])) continue;
    const changed = Object.keys(materials);
    if (!changed.length) continue;
    // A look must recolour one of the main slots or its lead part (or most of the surface), not just a knob.
    const weight = changed.reduce((sum, id) => sum + (weights[id] ?? 0), 0);
    const leadChanged = slots.some((s) => leadRoles.has(s.role) && materials[s.slot.id]);
    if (!leadChanged && !changed.some((id) => main.has(id)) && weight < 0.3 * total) continue;
    const key = changed
      .sort()
      .map((k) => `${k}=${materials[k]}`)
      .join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    let name = lookName(look.name, used);
    if (!name) name = leadTone ? toneLabel(leadTone).replace(/^./, (c) => c.toUpperCase()) : look.name;
    // Two looks that read the same ("Black" and "Black"): drop the second when it only differs in a
    // small part, otherwise name the finish that tells them apart.
    const twin = out.find((v) => v.name === name);
    if (twin) {
      const finish = (v: Record<string, string>, id: string, def: string) => v[id] ?? def;
      const diff = slots.filter((s) => finish(materials, s.slot.id, s.slot.defaultMaterial) !== finish(twin.materials, s.slot.id, s.slot.defaultMaterial));
      if (!diff.some((s) => main.has(s.slot.id))) continue;
      const s = diff[0];
      const tone = used[slots.indexOf(s)]?.tone;
      const label = tone && !name.toLowerCase().includes(toneLabel(tone)) ? toneLabel(tone) : (materialOf(finish(materials, s.slot.id, s.slot.defaultMaterial))?.name ?? '').toLowerCase();
      if (label) name = `${name} & ${label}`;
    }
    out.push({ id: look.id, name, materials, swatch: swatchColors(asset, materials) });
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

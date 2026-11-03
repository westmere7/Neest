import type { ItemEdits, PartEdit } from '@/domain/model/schema';
import { partBounds } from './plantParts';
import type { AssetDefinition, ParamValues, Part, PlanStroke, Size3 } from './types';

/**
 * Shape editing of placed items (the shape editor, "edit mode"): an item's own shape settings
 * (`AssetDefinition.params`), its sections (the spaces between dividers and fixed shelves, found in
 * its parts) and its single parts (move, resize, hide). Pure: the 3D view, the plan, collisions and
 * exports see the result through `withEdits`, a derived asset with its own id (`<id>@shape:<hash>`),
 * so every cache keyed by asset id keeps edited and unedited items apart. An item without edits is
 * its asset, unchanged.
 *
 * Order: build at the size with the settings → sections → part edits. Parts keep their index
 * through every step; a part edit only applies while the part at its index has the same shape and
 * finish slot (`sig`), so a resize that changes the part list cannot move an edit onto another part.
 */

type V3 = [number, number, number];
type Axis = 0 | 1 | 2;

/**
 * Kinds and shelves of items made of sub-items worth editing (from a pass over the whole library,
 * 2026-11-03): building parts and built furniture. `except` leaves out shelves where it makes no
 * sense (radiators, baskets, parasols, gas-lift chairs, poufs, hammocks); `only` keeps just those.
 * Lighting, decor, plants, people, appliances, electronics, plumbing, pets and basic shapes are out.
 */
const EDITABLE: Partial<Record<AssetDefinition['type'], { except?: string[]; only?: string[] }>> = {
  structure: { except: ['Heating'] },
  storage: { except: ['Baskets & boxes'] },
  surfaces: { except: ['Outdoor tables'] },
  beds: {},
  seating: { except: ['Desk chairs', 'Ottomans & poufs', 'Outdoor seating'] },
  kids: { only: ['Kids furniture'] },
};

/**
 * Whether an item has the shape editor: building parts and non-branded built furniture (see
 * `EDITABLE`). Never branded products, shipped meshes, imported models or saved groups.
 */
export function canEditShape(asset: AssetDefinition | null | undefined): asset is AssetDefinition {
  if (!asset || asset.brand || asset.model || asset.category === 'custom' || asset.id.startsWith('savedgroup:')) return false;
  const rule = EDITABLE[asset.type];
  if (!rule) return false;
  if (rule.only) return rule.only.includes(asset.group);
  return !rule.except?.includes(asset.group);
}

/** Below this an extent counts as a panel's thickness: such parts move with a section edge but keep their size. */
const THIN = 0.05;
/** Smallest section a divider or shelf can be moved to leave. */
export const MIN_SECTION = 0.06;

/** A part's identity for edits: its shape and finish slot. */
export const partSig = (p: Part): string => `${p.shape}:${p.slot}`;

function rotXYZ(v: V3, [ax, ay, az]: V3): V3 {
  let [x, y, z] = v;
  [x, y] = [x * Math.cos(az) - y * Math.sin(az), x * Math.sin(az) + y * Math.cos(az)];
  [x, z] = [x * Math.cos(ay) + z * Math.sin(ay), -x * Math.sin(ay) + z * Math.cos(ay)];
  [y, z] = [y * Math.cos(ax) - z * Math.sin(ax), y * Math.sin(ax) + z * Math.cos(ax)];
  return [x, y, z];
}

/** The part's own axis that lies (most nearly) along item axis `axis`. */
function localAxisFor(p: Part, axis: Axis): Axis {
  if (!p.rotation) return axis;
  let best: Axis = 0;
  let bestDot = -1;
  for (const i of [0, 1, 2] as Axis[]) {
    const e: V3 = [0, 0, 0];
    e[i] = 1;
    const d = Math.abs(rotXYZ(e, p.rotation)[axis]);
    if (d > bestDot) {
      bestDot = d;
      best = i;
    }
  }
  return best;
}

/** The part stretched by `k` along its own axis `i` (about its own origin); sizes are changed in place where the shape allows, so textures keep their scale. */
function stretchLocal(p: Part, i: Axis, k: number): Part {
  switch (p.shape) {
    case 'box': {
      const size = [...p.size] as V3;
      size[i] = Math.max(0.002, size[i] * k);
      return { ...p, size };
    }
    case 'prism':
      if (i === 1) return { ...p, height: Math.max(0.002, p.height * k) };
      return { ...p, outline: p.outline.map(([x, z]) => (i === 0 ? [x * k, z] : [x, z * k]) as [number, number]) };
    case 'cylinder':
      if (i === 1) return { ...p, height: Math.max(0.002, p.height * k) };
      break;
  }
  const scale = [...(p.scale ?? [1, 1, 1])] as V3;
  scale[i] *= k;
  return { ...p, scale };
}

function shift(p: Part, axis: Axis, by: number): Part {
  if (!by) return p;
  const position = [...p.position] as V3;
  position[axis] += by;
  return { ...p, position };
}

/** The part refitted along item axis `axis` so it spans [n0, n1] (it spanned [a0, a1]). */
function fitAxis(p: Part, axis: Axis, a0: number, a1: number, n0: number, n1: number): Part {
  const len = a1 - a0;
  if (len < 1e-6) return shift(p, axis, (n0 + n1) / 2 - (a0 + a1) / 2);
  const k = Math.max(0.002, n1 - n0) / len;
  const q = Math.abs(k - 1) > 1e-9 ? stretchLocal(p, localAxisFor(p, axis), k) : p;
  const b = partBounds(q);
  return shift(q, axis, n0 - b.min[axis]);
}

/** Piecewise-linear map through control points (`from` → `to`, both ascending, same length). */
function piecewise(from: number[], to: number[]): (v: number) => number {
  return (v) => {
    if (v <= from[0]) return v + (to[0] - from[0]);
    for (let i = 1; i < from.length; i++) {
      if (v <= from[i]) {
        const t = (v - from[i - 1]) / Math.max(1e-9, from[i] - from[i - 1]);
        return to[i - 1] + t * (to[i] - to[i - 1]);
      }
    }
    return v + (to[to.length - 1] - from[from.length - 1]);
  };
}

/** Merges nearby positions (one divider can be several parts and edges) and drops those at the ends. */
function cluster(values: number[], lo: number, hi: number): number[] {
  const sorted = values.filter((v) => v > lo + 0.08 && v < hi - 0.08).sort((a, b) => a - b);
  const out: number[][] = [];
  for (const v of sorted) {
    const last = out[out.length - 1];
    if (last && v - last[0] < 0.05) last.push(v);
    else out.push([v]);
  }
  return out.map((g) => g.reduce((s, v) => s + v, 0) / g.length);
}

/**
 * The item's section edges, found in its parts: across (x) the centres of upright panels that stand
 * most of the item's height and depth (dividers between compartments), up (y) the centres of flat
 * panels across most of its width and depth (fixed shelves, the floor of a top box). Only panels in
 * the finish of the item's own end panels (x) or top and bottom (y) count, so props such as hanging
 * clothes or folded towels never become dividers. Across, the side edges of the item's tall body
 * parts (those in its plan outline) count too: where a niche, a carcass block or an arm begins. End
 * panels, tops and bottoms are the fixed ends.
 */
export function detectSections(parts: Part[], size: Size3): { x: number[]; y: number[] } {
  const xs: { v: number; slot: string }[] = [];
  const ys: { v: number; slot: string }[] = [];
  const endX = new Set<string>();
  const endY = new Set<string>();
  for (const p of parts) {
    const b = partBounds(p);
    const dx = b.max[0] - b.min[0];
    const dy = b.max[1] - b.min[1];
    const dz = b.max[2] - b.min[2];
    if (dz < 0.3 * size.d) continue;
    if (p.plan !== false && dy >= 0.4 * size.h && dx > THIN && dx < 0.9 * size.w) xs.push({ v: b.min[0], slot: '' }, { v: b.max[0], slot: '' });
    if (dx <= THIN && dy >= 0.55 * size.h) {
      const c = (b.min[0] + b.max[0]) / 2;
      if (Math.abs(Math.abs(c) - size.w / 2) <= 0.08) endX.add(p.slot);
      else xs.push({ v: c, slot: p.slot });
    }
    if (dy <= THIN && dx >= 0.35 * size.w) {
      const c = (b.min[1] + b.max[1]) / 2;
      if (c <= 0.08 + 0.12 || c >= size.h - 0.08) endY.add(p.slot);
      if (c > 0.08 && c < size.h - 0.08) ys.push({ v: c, slot: p.slot });
    }
  }
  return {
    x: cluster(xs.filter((q) => q.slot === '' || endX.has(q.slot)).map((q) => q.v), -size.w / 2, size.w / 2),
    y: cluster(ys.filter((q) => endY.has(q.slot)).map((q) => q.v), 0, size.h),
  };
}

const AXIS_INDEX = { x: 0, y: 1 } as const;
const axisRange = (axis: 'x' | 'y', size: Size3): [number, number] => (axis === 'x' ? [-size.w / 2, size.w / 2] : [0, size.h]);

/** Section edges after the edits (the detected ones when the edit no longer fits the item). */
export function editedSectionEdges(detected: number[], edit: { n: number; d: number[] } | undefined, lo: number, hi: number): number[] {
  if (!edit || edit.n !== detected.length) return detected;
  const out = detected.map((v, i) => v + (edit.d[i] ?? 0));
  // Keep the order and the smallest section, whatever was stored.
  for (let i = 0; i < out.length; i++) out[i] = Math.max(out[i], (i ? out[i - 1] : lo) + MIN_SECTION);
  for (let i = out.length - 1; i >= 0; i--) out[i] = Math.min(out[i], (i < out.length - 1 ? out[i + 1] : hi) - MIN_SECTION);
  return out;
}

/** Parts remapped along an axis so each section edge moves from `from` to `to`; thin parts move, others stretch with their section. */
function remap(parts: Part[], axis: Axis, from: number[], to: number[], lo: number, hi: number): Part[] {
  const src = [lo, ...from, hi];
  const dst = [lo, ...to, hi];
  const f = piecewise(src, dst);
  return parts.map((p) => {
    const b = partBounds(p);
    const a0 = b.min[axis];
    const a1 = b.max[axis];
    if (a1 - a0 <= THIN) {
      // Thin parts at an edge (a divider, an end panel, a hinge) go with it rigidly; others keep their place in their section.
      const c = (a0 + a1) / 2;
      let k = 0;
      for (let i = 1; i < src.length; i++) if (Math.abs(src[i] - c) < Math.abs(src[k] - c)) k = i;
      return shift(p, axis, Math.abs(src[k] - c) <= 0.06 ? dst[k] - src[k] : f(c) - c);
    }
    const exact = p.shape === 'prism' ? remapOutline(p, axis, f) : null;
    if (exact) return exact;
    const n0 = f(a0);
    const n1 = f(a1);
    if (Math.abs(n0 - a0) < 1e-9 && Math.abs(n1 - a1) < 1e-9) return p;
    return fitAxis(p, axis, a0, a1, n0, n1);
  });
}

/**
 * A prism remapped point by point (an arch or a portal frame is one outline: its legs and opening
 * move with their section edges instead of the whole outline stretching). Only where the outline lies
 * along the axis: across (x) unless the prism turns about y or z; up (y) for an upright panel
 * (turned a quarter about x). Null when the prism is turned some other way.
 */
function remapOutline(p: Part & { shape: 'prism' }, axis: Axis, f: (v: number) => number): Part | null {
  const [rx, ry, rz] = p.rotation ?? [0, 0, 0];
  if (Math.abs(ry) > 1e-9 || Math.abs(rz) > 1e-9 || p.scale?.some((k) => k !== 1)) return null;
  const [px, py] = p.position;
  if (axis === 0) return { ...p, outline: p.outline.map(([x, z]) => [f(px + x) - px, z] as [number, number]) };
  if (axis !== 1) return null;
  const quarter = Math.abs(Math.abs(rx) - Math.PI / 2) < 1e-6;
  if (!quarter) return null;
  // Turned +90° about x the outline's z points down (item y = py - z); turned -90° it points up.
  const sgn = rx > 0 ? -1 : 1;
  return { ...p, outline: p.outline.map(([x, z]) => [x, sgn * (f(py + sgn * z) - py)] as [number, number]) };
}

/** The item's settings: stored values over the defaults (values of unknown or wrong-typed settings are dropped). */
export function resolveParams(asset: AssetDefinition, values: ParamValues | undefined): ParamValues | undefined {
  if (!asset.params?.length || !values) return undefined;
  const out: ParamValues = {};
  for (const p of asset.params) {
    const v = values[p.id];
    if (v === undefined || typeof v !== typeof p.default) continue;
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) continue;
      out[p.id] = Math.min(p.max ?? Infinity, Math.max(p.min ?? -Infinity, v));
    } else if (p.kind === 'choice' && !p.options?.some((o) => o.value === v)) continue;
    else out[p.id] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

/** A part after its edit: resized about its centre (`grow`, metres along the item's axes), then moved. */
export function applyPartEdit(p: Part, e: PartEdit | undefined): Part {
  if (!e) return p;
  let q = p;
  if (e.grow)
    for (const axis of [0, 1, 2] as Axis[]) {
      if (!e.grow[axis]) continue;
      const b = partBounds(q);
      const c = (b.min[axis] + b.max[axis]) / 2;
      const len = Math.max(0.005, b.max[axis] - b.min[axis] + e.grow[axis]);
      q = fitAxis(q, axis, b.min[axis], b.max[axis], c - len / 2, c + len / 2);
    }
  if (e.move) for (const axis of [0, 1, 2] as Axis[]) q = shift(q, axis, e.move[axis]);
  return q;
}

/** One part of an edited item: where it is in the item's part list, and whether it is hidden or edited. */
export interface EditedPart {
  index: number;
  part: Part;
  /** The part before its own edit (after settings and sections). */
  base: Part;
  hidden: boolean;
  edited: boolean;
}

/** The item's parts before part edits: built with its settings, sections applied. */
function baseParts(asset: AssetDefinition, size: Size3, edits: ItemEdits | undefined): Part[] {
  const params = resolveParams(asset, edits?.params);
  let parts = params ? asset.build(size, params) : asset.build(size);
  const s = edits?.sections;
  if (s?.x || s?.y) {
    const found = detectSections(parts, size);
    for (const axis of ['x', 'y'] as const) {
      const edit = s[axis];
      if (!edit) continue;
      const [lo, hi] = axisRange(axis, size);
      const to = editedSectionEdges(found[axis], edit, lo, hi);
      if (to.some((v, i) => Math.abs(v - found[axis][i]) > 1e-9)) parts = remap(parts, AXIS_INDEX[axis], found[axis], to, lo, hi);
    }
  }
  return parts;
}

/** Every part of the item at a size with its edits (hidden parts included, flagged). Falls back to the unedited parts if anything goes wrong. */
export function editedParts(asset: AssetDefinition, size: Size3, edits: ItemEdits | undefined): EditedPart[] {
  let base: Part[];
  try {
    base = baseParts(asset, size, edits);
  } catch (e) {
    console.warn(`[edits] ${asset.id}: shape settings failed, built as is`, e);
    base = asset.build(size);
  }
  return base.map((p, index) => {
    const e = edits?.parts?.[String(index)];
    const fits = !!e && e.sig === partSig(p);
    let part = p;
    if (fits) {
      try {
        part = applyPartEdit(p, e);
      } catch {
        part = p;
      }
    }
    return { index, part, base: p, hidden: fits && !!e!.hidden, edited: fits };
  });
}

/** Section edges of the item as edited, for the editor: positions now, as found, and the axis range. */
export function sectionInfo(asset: AssetDefinition, size: Size3, edits: ItemEdits | undefined): Record<'x' | 'y', { edges: number[]; found: number[]; lo: number; hi: number }> {
  const params = resolveParams(asset, edits?.params);
  const found = detectSections(params ? asset.build(size, params) : asset.build(size), size);
  const out = {} as Record<'x' | 'y', { edges: number[]; found: number[]; lo: number; hi: number }>;
  for (const axis of ['x', 'y'] as const) {
    const [lo, hi] = axisRange(axis, size);
    out[axis] = { edges: editedSectionEdges(found[axis], edits?.sections?.[axis], lo, hi), found: found[axis], lo, hi };
  }
  return out;
}

/** Whether edits change anything (no settings, no section moves, no part edits). */
export function isEmptyEdits(e: ItemEdits | undefined | null): boolean {
  if (!e) return true;
  const params = e.params && Object.keys(e.params).length > 0;
  const sections = (['x', 'y'] as const).some((a) => e.sections?.[a]?.d.some((v) => Math.abs(v) > 1e-9));
  const parts = e.parts && Object.keys(e.parts).length > 0;
  return !params && !sections && !parts;
}

const isZero = (v: V3 | undefined) => !v || v.every((x) => Math.abs(x) < 1e-9);

/**
 * Edits as stored: settings at their default, untouched sections and empty part edits are dropped;
 * null when nothing is left (the item is its asset again).
 */
export function cleanEdits(asset: AssetDefinition, e: ItemEdits | undefined | null): ItemEdits | null {
  if (!e) return null;
  const out: ItemEdits = {};
  const params: ParamValues = {};
  for (const p of asset.params ?? []) {
    const v = e.params?.[p.id];
    if (v === undefined || typeof v !== typeof p.default) continue;
    if (typeof v === 'number' ? Math.abs(v - (p.default as number)) > 1e-9 : v !== p.default) params[p.id] = v;
  }
  if (Object.keys(params).length) out.params = params;
  for (const axis of ['x', 'y'] as const) {
    const s = e.sections?.[axis];
    if (s && s.d.some((v) => Math.abs(v) > 1e-9)) (out.sections ??= {})[axis] = { n: s.n, d: [...s.d] };
  }
  const parts: Record<string, PartEdit> = {};
  for (const [k, pe] of Object.entries(e.parts ?? {})) {
    const keep: PartEdit = { sig: pe.sig };
    if (!isZero(pe.move)) keep.move = pe.move;
    if (!isZero(pe.grow)) keep.grow = pe.grow;
    if (pe.hidden) keep.hidden = true;
    if (keep.move || keep.grow || keep.hidden) parts[k] = keep;
  }
  if (Object.keys(parts).length) out.parts = parts;
  return isEmptyEdits(out) ? null : out;
}

/** Stable text of edits (sorted keys), the cache key of a derived asset. */
function stableKey(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableKey).join(',')}]`;
  if (v && typeof v === 'object')
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${k}:${stableKey((v as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  return typeof v === 'number' ? String(Math.round(v * 1e6) / 1e6) : JSON.stringify(v);
}

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

const derivedByAsset = new WeakMap<AssetDefinition, Map<string, AssetDefinition>>();

/**
 * The asset as an item with these edits builds it, or the asset itself when there are none or the
 * item cannot be shape-edited. Derived assets get the id `<id>@shape:<hash>` and are cached.
 */
export function withEdits(asset: AssetDefinition, edits: ItemEdits | undefined | null): AssetDefinition;
export function withEdits(asset: AssetDefinition | null, edits: ItemEdits | undefined | null): AssetDefinition | null;
export function withEdits(asset: AssetDefinition | null, edits: ItemEdits | undefined | null): AssetDefinition | null {
  if (!asset || !edits || isEmptyEdits(edits) || !canEditShape(asset)) return asset;
  const key = stableKey(edits);
  let byKey = derivedByAsset.get(asset);
  if (!byKey) derivedByAsset.set(asset, (byKey = new Map()));
  const hit = byKey.get(key);
  if (hit) return hit;
  if (byKey.size > 200) byKey.clear();
  const params = resolveParams(asset, edits.params);
  const planDetail = asset.planDetail;
  const def: AssetDefinition = {
    ...asset,
    id: `${asset.id}@shape:${hash(key)}`,
    build: (size) => editedParts(asset, size, edits)
      .filter((p) => !p.hidden)
      .map((p) => p.part),
    planDetail: planDetail
      ? (size) => {
          const strokes = params ? planDetail(size, params) : planDetail(size);
          const x = edits.sections?.x ? sectionInfo(asset, size, edits).x : null;
          if (!x || x.edges.every((v, i) => Math.abs(v - x.found[i]) < 1e-9)) return strokes;
          const f = piecewise([x.lo, ...x.found, x.hi], [x.lo, ...x.edges, x.hi]);
          const px = ([a, b]: [number, number]): [number, number] => [f(a), b];
          return strokes.map((s): PlanStroke =>
            s.kind === 'line' ? { ...s, a: px(s.a), b: px(s.b) } : s.kind === 'circle' ? { ...s, c: px(s.c) } : { ...s, points: s.points.map(px) },
          );
        }
      : undefined,
  };
  byKey.set(key, def);
  return def;
}

/** A part's name in the editor: its finish slot's label and its number among that slot's parts. */
export function partLabels(asset: AssetDefinition, parts: Part[]): string[] {
  const seen = new Map<string, number>();
  const count = new Map<string, number>();
  for (const p of parts) count.set(p.slot, (count.get(p.slot) ?? 0) + 1);
  return parts.map((p) => {
    const n = (seen.get(p.slot) ?? 0) + 1;
    seen.set(p.slot, n);
    const label = asset.slots.find((s) => s.id === p.slot)?.label ?? p.slot;
    return count.get(p.slot)! > 1 ? `${label} ${n}` : label;
  });
}

/** Item-space bounds of a part (for the editor's fields). */
export function partBox(p: Part): { min: V3; max: V3; size: V3; centre: V3 } {
  const b = partBounds(p);
  return {
    min: b.min,
    max: b.max,
    size: [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]],
    centre: [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2],
  };
}

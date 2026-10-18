import type { Project } from '@/domain/model/schema';
import { getAsset } from '@/data/assets/registry';
import { partBounds } from '@/data/assets/plantParts';
import type { AssetDefinition, Part, Size3 } from '@/data/assets/types';

/**
 * Surface placement: small items placed or moved over a table, desk, counter, cabinet or appliance
 * stand on its top instead of the floor.
 *
 * The top is found at the exact spot under the item's centre from the supporting item's own parts
 * (never a model's props): a counter's tap, a hob or an L-desk's empty corner only count where they
 * are. Only items small enough to stand on furniture take part, and only furniture tops between
 * 15 cm and 1.6 m count as surfaces.
 */

const SUPPORT_TYPES = new Set(['surfaces', 'storage', 'appliances', 'electronics']);
const NOT_ON_SURFACES = new Set(['beds', 'seating', 'surfaces', 'structure', 'people', 'plumbing']);

/** Whether an item of this kind and size can stand on furniture. */
export function canStandOnSurfaces(asset: AssetDefinition, size: Size3): boolean {
  if (asset.mount !== 'floor' || NOT_ON_SURFACES.has(asset.type) || asset.id.startsWith('savedgroup:')) return false;
  return size.w <= 1.0 && size.d <= 1.0 && size.h <= 1.1;
}

const partsCache = new Map<string, Part[]>();
function partsAt(asset: AssetDefinition, size: Size3): Part[] {
  const key = `${asset.id}|${size.w.toFixed(4)}|${size.d.toFixed(4)}|${size.h.toFixed(4)}`;
  let parts = partsCache.get(key);
  if (!parts) {
    try {
      parts = asset.build(size);
    } catch {
      parts = [];
    }
    if (partsCache.size > 300) partsCache.clear();
    partsCache.set(key, parts);
  }
  return parts;
}

/**
 * Elevation of the surface under (x, y) for an item of `size`, or null when it stands on the floor.
 * `ignore` leaves out the items being moved.
 */
export function surfaceUnder(project: Project, asset: AssetDefinition, size: Size3, x: number, y: number, ignore: ReadonlySet<string> = new Set()): number | null {
  if (!canStandOnSurfaces(asset, size)) return null;
  let best: number | null = null;
  for (const o of Object.values(project.objects)) {
    if (o.hidden || ignore.has(o.id)) continue;
    const top = o.elevation + o.height;
    if (top < 0.15 || top > 1.6 || (best !== null && top <= best)) continue;
    // Quick reject by the footprint, in the item's own frame (plan +y is its front, +z).
    const dx = x - o.x;
    const dy = y - o.y;
    const c = Math.cos(-o.rotation);
    const s = Math.sin(-o.rotation);
    let lx = dx * c - dy * s;
    const lz = dx * s + dy * c;
    if (o.mirrored) lx = -lx;
    if (Math.abs(lx) > o.width / 2 || Math.abs(lz) > o.depth / 2) continue;
    const support = getAsset(project, o.assetId);
    if (!support || !SUPPORT_TYPES.has(support.type) || support.category === 'custom') continue;
    // The highest part of the support right under the point (its own parts, not a model's props).
    let h: number | null = null;
    for (const p of partsAt(support, { w: o.width, d: o.depth, h: o.height })) {
      const b = partBounds(p);
      // A little slack, so a point on the seam between two boards still finds them.
      const e = 0.003;
      if (lx < b.min[0] - e || lx > b.max[0] + e || lz < b.min[2] - e || lz > b.max[2] + e) continue;
      if (h === null || b.max[1] > h) h = b.max[1];
    }
    if (h === null || h < 0.15) continue;
    const at = o.elevation + h;
    if (at > 1.6) continue;
    if (best === null || at > best) best = Math.round(at * 1000) / 1000;
  }
  return best;
}

/**
 * Elevation for an item being moved to (x, y): onto the surface there, back to its usual height
 * when it leaves the surface it stood on, otherwise unchanged. `base` is the project as it was when
 * the move started. Undefined for items that never stand on surfaces.
 */
export function movedElevation(base: Project, objId: string, x: number, y: number): number | undefined {
  const start = base.objects[objId];
  if (!start) return undefined;
  const asset = getAsset(base, start.assetId);
  if (!asset) return undefined;
  const size = { w: start.width, d: start.depth, h: start.height };
  if (!canStandOnSurfaces(asset, size)) return undefined;
  const ignore = new Set([objId]);
  const on = surfaceUnder(base, asset, size, x, y, ignore);
  if (on !== null) return on;
  const was = surfaceUnder(base, asset, size, start.x, start.y, ignore);
  if (was !== null && Math.abs(was - start.elevation) < 0.02) return asset.defaultElevation;
  return start.elevation;
}

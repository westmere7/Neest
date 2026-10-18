import * as THREE from 'three';
import type { AssetDefinition, Part, PlanStroke } from '@/data/assets/types';
import { getAsset, setAssetResolver } from '@/data/assets/registry';
import { partBounds } from '@/data/assets/plantParts';
import { usePrefsStore, type SavedGroup } from '@/state/uiStores';

/**
 * Saved groups as library items: a group (prefs `savedGroups`) becomes a read-only asset with the
 * id `savedgroup:<id>` whose parts are every member's parts moved and turned into place, each
 * member keeping its own finishes (slots `<index>:<slot>`). The library shows it like any item
 * (3D thumbnail, info card, place tool ghost with rotation, drag and drop); placing it creates the
 * real items as a new group (`placeSavedGroup`). Registered as an extra resolver of `getAsset`.
 */
export const SAVED_GROUP_PREFIX = 'savedgroup:';

const cache = new WeakMap<SavedGroup, AssetDefinition>();

/** Applies a member's plan rotation (θ, three.js yaw −θ) and offset to one of its parts. */
function placePart(p: Part, rot: number, dx: number, dy: number, elev: number, slot: string): Part {
  const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -rot);
  const pos = new THREE.Vector3(...p.position).applyQuaternion(yaw);
  const q = yaw.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...(p.rotation ?? [0, 0, 0]))));
  const e = new THREE.Euler().setFromQuaternion(q, 'XYZ');
  return { ...p, slot, position: [pos.x + dx, pos.y + elev, pos.z + dy], rotation: [e.x, e.y, e.z] };
}

export function savedGroupAsset(g: SavedGroup): AssetDefinition {
  const hit = cache.get(g);
  if (hit) return hit;
  const slots: AssetDefinition['slots'] = [];
  const parts: Part[] = [];
  g.items.forEach((it, i) => {
    const a = getAsset(null, it.assetId);
    if (!a || a.id.startsWith(SAVED_GROUP_PREFIX)) return;
    for (const s of a.slots) slots.push({ id: `${i}:${s.id}`, label: `${a.name}: ${s.label}`, defaultMaterial: it.materials[s.id] ?? s.defaultMaterial });
    let built: Part[] = [];
    try {
      built = a.build({ w: it.width, d: it.depth, h: it.height });
    } catch {
      built = [];
    }
    for (const p of built) parts.push(placePart(p, it.rotation, it.dx, it.dy, it.elevation, `${i}:${p.slot}`));
  });
  // Recentre on the footprint and stand on the floor.
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const p of parts) {
    const b = partBounds(p);
    for (const k of [0, 1, 2]) {
      min[k] = Math.min(min[k], b.min[k]);
      max[k] = Math.max(max[k], b.max[k]);
    }
  }
  const ok = parts.length > 0 && Number.isFinite(min[0]);
  const shift = ok ? [-(min[0] + max[0]) / 2, -Math.min(0, min[1]), -(min[2] + max[2]) / 2] : [0, 0, 0];
  const placed = parts.map((p) => ({ ...p, position: [p.position[0] + shift[0], p.position[1] + shift[1], p.position[2] + shift[2]] as [number, number, number] }));
  const size = ok ? { w: Math.max(0.05, max[0] - min[0]), d: Math.max(0.05, max[2] - min[2]), h: Math.max(0.05, max[1] - Math.min(0, min[1])) } : { w: g.size.w, d: g.size.d, h: 1 };
  const def: AssetDefinition = {
    id: `${SAVED_GROUP_PREFIX}${g.id}`,
    name: g.name,
    category: 'living',
    type: 'misc',
    group: 'Saved groups',
    tags: ['saved group', 'group', ...g.items.map((it) => getAsset(null, it.assetId)?.name.toLowerCase() ?? '')].filter(Boolean),
    description: `Your saved group of ${g.items.length} items. Placing it adds them as a new group.`,
    defaultSize: size,
    minSize: size,
    maxSize: size,
    resizable: { w: false, d: false, h: false },
    mount: 'floor',
    defaultElevation: 0,
    slots: slots.length ? slots : [{ id: 'none', label: 'None', defaultMaterial: 'solid-white' }],
    build: () => placed,
    planDetail: (): PlanStroke[] => [],
    source: { name: 'Saved group', license: 'Your own' },
  };
  cache.set(g, def);
  return def;
}

/** Library items for every saved group. */
export const savedGroupAssets = (groups: SavedGroup[]): AssetDefinition[] => groups.map(savedGroupAsset);

/** The saved group behind a `savedgroup:<id>` asset id, if any. */
export function savedGroupOf(assetId: string): SavedGroup | undefined {
  if (!assetId.startsWith(SAVED_GROUP_PREFIX)) return undefined;
  const id = assetId.slice(SAVED_GROUP_PREFIX.length);
  return usePrefsStore.getState().savedGroups.find((g) => g.id === id);
}

setAssetResolver((id) => {
  const g = savedGroupOf(id);
  return g ? savedGroupAsset(g) : null;
});

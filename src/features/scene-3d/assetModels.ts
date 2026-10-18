import * as THREE from 'three';
import { useSyncExternalStore } from 'react';
import type { AssetDefinition } from '@/data/assets/types';

/**
 * Shipped meshes for assets (`AssetDefinition.model`, e.g. the baked people in public/models).
 *
 * A model file holds one mesh per material slot, named by slot id, positions and indices only.
 * It is fetched on first use; until it arrives (or when it is missing, offline before first use,
 * or in tests) the asset's procedural parts are shown instead. Loaded geometry gets smooth
 * normals and box-projected UVs in metres, so fabric and other textures tile as on parts.
 */
type Slots = { slot: string; geometry: THREE.BufferGeometry }[];
const loaded = new Map<string, Slots | null>();
const pending = new Map<string, Promise<Slots | null>>();
const listeners = new Set<() => void>();
let version = 0;

const canLoad = (): boolean => typeof window !== 'undefined' && typeof fetch === 'function' && import.meta.env?.MODE !== 'test';
const keyOf = (asset: AssetDefinition) => (asset.model ? `${asset.model.url}#${asset.model.hash}` : '');

export function subscribeAssetModels(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export const assetModelsVersion = (): number => version;
/** Re-renders when a model finishes loading. */
export const useAssetModelsVersion = (): number => useSyncExternalStore(subscribeAssetModels, assetModelsVersion, assetModelsVersion);

/** Adds UVs projected along each vertex normal's dominant axis (metres, like part geometry). */
function boxUVs(g: THREE.BufferGeometry) {
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(nor.getX(i));
    const ay = Math.abs(nor.getY(i));
    const az = Math.abs(nor.getZ(i));
    const [u, v] = ax >= ay && ax >= az ? [pos.getZ(i), pos.getY(i)] : ay >= az ? [pos.getX(i), pos.getZ(i)] : [pos.getX(i), pos.getY(i)];
    uv[i * 2] = u;
    uv[i * 2 + 1] = v;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

async function fetchModel(asset: AssetDefinition): Promise<Slots | null> {
  if (!asset.model || !canLoad()) return null;
  try {
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
    const base = (import.meta.env.BASE_URL as string) || '/';
    const gltf = await new GLTFLoader().loadAsync(`${base.endsWith('/') ? base : base + '/'}${asset.model.url}?v=${asset.model.hash}`);
    const out: Slots = [];
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const slot = mesh.name.replace(/_\d+$/, '');
      if (!asset.slots.some((s) => s.id === slot)) return;
      const g = mesh.geometry.clone();
      g.applyMatrix4(mesh.matrixWorld);
      for (const name of Object.keys(g.attributes)) if (name !== 'position') g.deleteAttribute(name);
      g.computeVertexNormals();
      boxUVs(g);
      g.computeBoundingBox();
      g.computeBoundingSphere();
      g.userData.cached = true;
      out.push({ slot, geometry: g });
    });
    return out.length ? out : null;
  } catch (e) {
    console.warn(`[models] ${asset.id}: ${asset.model.url} failed to load`, e);
    return null;
  }
}

/** Starts (or joins) loading an asset's model; resolves when it is ready or has failed. */
export function loadAssetModel(asset: AssetDefinition): Promise<void> {
  const key = keyOf(asset);
  if (!key || loaded.has(key)) return Promise.resolve();
  let p = pending.get(key);
  if (!p) {
    p = fetchModel(asset).then((slots) => {
      loaded.set(key, slots);
      pending.delete(key);
      version++;
      for (const fn of [...listeners]) fn();
      return slots;
    });
    pending.set(key, p);
  }
  return p.then(() => undefined);
}

/** Loads the models of several assets (thumbnails, exports). */
export const preloadAssetModels = (assets: Iterable<AssetDefinition>): Promise<void> =>
  Promise.all([...assets].filter((a) => a.model).map(loadAssetModel)).then(() => undefined);

/**
 * The model's slot geometries in its own size (standing on y = 0, centred), or null while it is
 * loading (loading starts) or unavailable.
 */
export function assetModelSlots(asset: AssetDefinition): Slots | null {
  const key = keyOf(asset);
  if (!key) return null;
  if (!loaded.has(key)) {
    void loadAssetModel(asset);
    return null;
  }
  return loaded.get(key) ?? null;
}

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { blobRepository } from '@/storage/indexeddb/db';

const cache = new Map<string, Promise<THREE.Object3D | null>>();

/** Parses a GLB ArrayBuffer into a scene graph (no network, no object URLs). */
export function parseGlb(data: ArrayBuffer): Promise<THREE.Object3D> {
  return new Promise((resolve, reject) => {
    new GLTFLoader().parse(
      data,
      '',
      (gltf) => resolve(gltf.scene),
      (err) => reject(err instanceof Error ? err : new Error('Invalid glTF data')),
    );
  });
}

/** Loads and caches an imported model from local blob storage. Resolves null if missing or invalid. */
export function loadCustomModel(blobId: string): Promise<THREE.Object3D | null> {
  let p = cache.get(blobId);
  if (!p) {
    p = (async () => {
      const blob = await blobRepository.get(blobId);
      if (!blob) return null;
      try {
        return await parseGlb(await blob.data.arrayBuffer());
      } catch {
        return null;
      }
    })();
    cache.set(blobId, p);
  }
  return p;
}

/** Resolves all imported models referenced by a project. */
export async function loadProjectModels(customAssets: Record<string, { blobId: string }>): Promise<Map<string, THREE.Object3D>> {
  const out = new Map<string, THREE.Object3D>();
  await Promise.all(
    Object.values(customAssets).map(async (a) => {
      const m = await loadCustomModel(a.blobId);
      if (m) out.set(a.blobId, m);
    }),
  );
  return out;
}

export function forgetCustomModel(blobId: string) {
  cache.delete(blobId);
}

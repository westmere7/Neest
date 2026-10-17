import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { AssetDefinition } from '@/data/assets/types';
import { ASSET_CATALOG } from '@/data/assets/catalog';
import { MATERIAL_CATALOG_BY_ID } from '@/data/materials/catalog';
import { preloadPhotoSets } from '@/features/materials/photoTextures';
import { buildAssetPreview } from './builders';
import { sharedRegistry } from './sceneRuntime';

const SIZE = 192;

// Thumbnails render synchronously, so load the photo maps used by default furniture
// finishes before the first one (bounded wait; missing files mean procedural textures).
await preloadPhotoSets(
  ASSET_CATALOG.flatMap((a) => a.slots.flatMap((slot) => MATERIAL_CATALOG_BY_ID[slot.defaultMaterial]?.photo?.setId ?? [])),
  undefined,
  6000,
);
let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let failed = false;

function setup(): boolean {
  if (renderer) return true;
  if (failed) return false;
  try {
    const canvas = document.createElement('canvas');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(SIZE, SIZE, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.9;
    const key = new THREE.DirectionalLight('#ffffff', 1.6);
    key.position.set(3, 5, 4);
    scene.add(key, new THREE.HemisphereLight('#ffffff', '#b8b2a6', 0.5));
    return true;
  } catch {
    failed = true;
    renderer = null;
    return false;
  }
}

/** Renders a three-quarter view of an asset at its default size. Returns a PNG data URL or null. */
export function renderAssetThumbnail(asset: AssetDefinition): string | null {
  if (!setup() || !renderer || !scene) return null;
  const group = buildAssetPreview(asset, null, sharedRegistry);
  const box = new THREE.Box3().setFromObject(group);
  if (box.isEmpty()) return null;
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.length() / 2, 0.05);
  const camera = new THREE.PerspectiveCamera(30, 1, radius / 50, radius * 20);
  const dir = new THREE.Vector3(0.75, 0.62, 1).normalize();
  const distance = radius / Math.sin((camera.fov * Math.PI) / 360) * 1.05;
  camera.position.copy(center).addScaledVector(dir, distance);
  camera.lookAt(center);
  scene.add(group);
  renderer.setClearColor(0x000000, 0);
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL('image/png');
  scene.remove(group);
  return url;
}

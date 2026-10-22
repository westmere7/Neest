import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import type { Project } from '@/domain/model/schema';
import { derivePlan } from '@/domain/geometry/derive';
import { getAsset } from '@/data/assets/registry';
import {
  buildCeiling,
  buildFloor,
  buildHubGeometry,
  buildObject,
  buildWallGeometry,
  wallMaterials,
  type BuildContext,
} from '@/features/scene-3d/builders';
import { buildWallExtras } from '@/features/scene-3d/wallExtras';
import { buildOpening } from '@/features/scene-3d/openingBuilder';
import { MaterialRegistry } from '@/features/scene-3d/materialRegistry';
import { loadProjectModels } from '@/features/scene-3d/customModels';
import { isObjectHidden } from '@/domain/commands/itemLayers';

export interface SceneExportOptions {
  ceilings: boolean;
  furniture: boolean;
}

/**
 * Builds a standalone three.js scene from the project (walls with real
 * openings, floors, optional ceilings, doors/windows, furniture, imported
 * models). Uses the same builders as the live 3D view. Photo textures are
 * baked into canvases (embedded by the exporter, never referenced by URL);
 * materials whose photo files are unavailable keep their procedural texture.
 */
export async function buildExportScene(project: Project, o: SceneExportOptions): Promise<{ root: THREE.Group; registry: MaterialRegistry }> {
  const derived = derivePlan(project);
  const registry = new MaterialRegistry();
  registry.normalMaps = false;
  registry.bakePhotoSize = 1024;
  const models = await loadProjectModels(project.customAssets);
  const ctx: BuildContext = { project, registry, customModels: models, shadows: false };
  const root = new THREE.Group();
  root.name = project.name;
  const walls = new THREE.Group();
  walls.name = 'Walls';
  for (const g of derived.network.walls.values()) {
    if (g.wall.hidden) continue;
    const geo = buildWallGeometry(g);
    if (geo) {
      const mesh = new THREE.Mesh(geo, wallMaterials(project, g, registry));
      mesh.name = `Wall ${g.wall.id}`;
      walls.add(mesh);
    }
    // Trims, half-wall caps, glass walls and railings.
    const extras = buildWallExtras(g, { project, registry, shadows: false });
    if (extras) {
      extras.name = `Wall details ${g.wall.id}`;
      walls.add(extras);
    }
  }
  for (const h of derived.network.hubs) {
    const geo = buildHubGeometry(h);
    if (geo) walls.add(new THREE.Mesh(geo, registry.get(project, 'plaster-white')));
  }
  root.add(walls);
  const openings = new THREE.Group();
  openings.name = 'Doors & windows';
  for (const g of derived.network.walls.values()) {
    if (g.wall.hidden) continue;
    for (const sp of g.spans) {
      const op = project.openings[sp.id];
      if (op) {
        const grp = buildOpening(op, g, sp, ctx);
        grp.name = op.kind;
        openings.add(grp);
      }
    }
  }
  root.add(openings);
  const rooms = new THREE.Group();
  rooms.name = 'Rooms';
  derived.faces.forEach((f, i) => {
    const r = derived.faceRooms[i];
    rooms.add(buildFloor(f, r, ctx));
    if (o.ceilings && r?.showCeiling !== false) rooms.add(buildCeiling(f, r, ctx));
  });
  root.add(rooms);
  if (o.furniture) {
    const furn = new THREE.Group();
    furn.name = 'Furniture';
    for (const obj of Object.values(project.objects)) {
      if (isObjectHidden(project, obj)) continue;
      const g = buildObject(obj, ctx);
      g.name = obj.name ?? getAsset(project, obj.assetId)?.name ?? obj.assetId;
      furn.add(g);
    }
    root.add(furn);
  }
  // Materials update in place once their photo maps have loaded (or failed → procedural).
  await registry.whenPhotosReady();
  root.updateMatrixWorld(true);
  return { root, registry };
}

/** Binary glTF (GLB) of the project scene. */
export async function exportGlb(project: Project, o: SceneExportOptions): Promise<ArrayBuffer> {
  const { root, registry } = await buildExportScene(project, o);
  const scene = new THREE.Scene();
  scene.add(root);
  try {
    const exporter = new GLTFExporter();
    const result = await exporter.parseAsync(scene, { binary: true, onlyVisible: true, maxTextureSize: 1024 });
    if (!(result instanceof ArrayBuffer)) throw new Error('GLB export did not produce binary data.');
    return result;
  } finally {
    disposeTree(root);
    registry.dispose();
  }
}

export function disposeTree(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    // Part geometries are shared and cached; only dispose unique (non-cached) ones is not tracked,
    // so dispose everything except geometries flagged as cached via userData.
    if (m.isMesh && !m.geometry.userData.cached) m.geometry.dispose();
  });
}

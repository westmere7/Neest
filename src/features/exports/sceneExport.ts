import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
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
import { guestLayerId } from '@/domain/walkthrough/guest';

export interface SceneExportOptions {
  ceilings: boolean;
  furniture: boolean;
  /** Also build the walls cut at this height (for a cutaway view in the guest viewer). */
  cutaway?: number;
  /** Largest embedded texture in px (default 1024). */
  textureSize?: 512 | 1024 | 2048;
  /** Embed normal and roughness maps (default: colour maps only). */
  surfaceDetail?: boolean;
  /** Also include items on hidden item layers (each item layer is its own group either way). */
  hiddenLayers?: boolean;
}

/**
 * `userData.neestRole` of the top-level groups (kept in the GLB as glTF extras), so the guest viewer
 * can switch walls, ceilings and clipping without knowing the plan.
 */
export type SceneRole = 'walls' | 'walls-cut' | 'wall-details' | 'openings' | 'rooms' | 'ceilings' | 'furniture';

function roleGroup(name: string, role: SceneRole): THREE.Group {
  const g = new THREE.Group();
  g.name = name;
  g.userData.neestRole = role;
  return g;
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
  registry.normalMaps = !!o.surfaceDetail;
  registry.exportDetail = !!o.surfaceDetail;
  registry.bakePhotoSize = o.textureSize ?? 1024;
  const models = await loadProjectModels(project.customAssets);
  const ctx: BuildContext = { project, registry, customModels: models, shadows: false };
  const root = new THREE.Group();
  root.name = project.name;
  const buildWalls = (group: THREE.Group, cut?: number) => {
    for (const g of derived.network.walls.values()) {
      if (g.wall.hidden) continue;
      const geo = buildWallGeometry(g, cut);
      if (geo) {
        const mesh = new THREE.Mesh(geo, wallMaterials(project, g, registry));
        mesh.name = `Wall ${g.wall.id}`;
        group.add(mesh);
      }
    }
    for (const h of derived.network.hubs) {
      const geo = buildHubGeometry(h, cut);
      if (geo) group.add(new THREE.Mesh(geo, registry.get(project, 'plaster-white')));
    }
    root.add(group);
  };
  buildWalls(roleGroup('Walls', 'walls'));
  if (o.cutaway !== undefined) buildWalls(roleGroup('Walls (cutaway)', 'walls-cut'), o.cutaway);
  // Trims, half-wall caps, glass walls and railings.
  const details = roleGroup('Wall details', 'wall-details');
  for (const g of derived.network.walls.values()) {
    if (g.wall.hidden) continue;
    const extras = buildWallExtras(g, { project, registry, shadows: false });
    if (extras) {
      extras.name = `Wall details ${g.wall.id}`;
      details.add(extras);
    }
  }
  root.add(details);
  const openings = roleGroup('Doors & windows', 'openings');
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
  const rooms = roleGroup('Rooms', 'rooms');
  const ceilings = roleGroup('Ceilings', 'ceilings');
  derived.faces.forEach((f, i) => {
    const r = derived.faceRooms[i];
    rooms.add(buildFloor(f, r, ctx));
    if (o.ceilings && r?.showCeiling !== false) ceilings.add(buildCeiling(f, r, ctx));
  });
  root.add(rooms);
  if (ceilings.children.length) root.add(ceilings);
  if (o.furniture) {
    const furn = roleGroup('Furniture', 'furniture');
    // One group per item layer (`userData.neestLayer`, '' = Unassigned) so viewers can show and hide layers.
    const layers = new Map<string, THREE.Group>();
    for (const obj of Object.values(project.objects)) {
      if (obj.hidden || (!o.hiddenLayers && isObjectHidden(project, obj))) continue;
      const id = guestLayerId(project, obj);
      let lg = layers.get(id);
      if (!lg) {
        lg = new THREE.Group();
        lg.name = project.itemLayers.find((l) => l.id === id)?.name ?? 'Unassigned';
        lg.userData.neestLayer = id;
        layers.set(id, lg);
        furn.add(lg);
      }
      const g = buildObject(obj, ctx);
      g.name = obj.name ?? getAsset(project, obj.assetId)?.name ?? obj.assetId;
      lg.add(g);
    }
    root.add(furn);
  }
  // Materials update in place once their photo maps have loaded (or failed → procedural). Exports wait
  // longer than the live view: a slow or throttled tab must not ship procedural stand-ins.
  await registry.whenPhotosReady(60000);
  root.updateMatrixWorld(true);
  return { root, registry };
}

/**
 * Indexes the geometry the builders leave unindexed (each vertex stored once instead of once per
 * triangle; the look is identical). Detailed furniture shrinks several times. Returns a cleanup.
 */
function indexGeometries(root: THREE.Object3D): () => void {
  const merged = new Map<THREE.BufferGeometry, THREE.BufferGeometry>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || m.geometry.index || !m.geometry.getAttribute('position')) return;
    let g = merged.get(m.geometry);
    if (!g) {
      g = mergeVertices(m.geometry);
      g.userData = {};
      merged.set(m.geometry, g);
    }
    m.geometry = g;
  });
  return () => {
    for (const [orig, g] of merged) {
      g.dispose();
      if (!orig.userData.cached) orig.dispose();
    }
  };
}

/** Binary glTF (GLB) of the project scene. */
export async function exportGlb(project: Project, o: SceneExportOptions): Promise<ArrayBuffer> {
  const { root, registry } = await buildExportScene(project, o);
  const scene = new THREE.Scene();
  scene.add(root);
  const unindex = indexGeometries(root);
  try {
    const exporter = new GLTFExporter();
    const result = await exporter.parseAsync(scene, { binary: true, onlyVisible: true, maxTextureSize: o.textureSize ?? 1024 });
    if (!(result instanceof ArrayBuffer)) throw new Error('GLB export did not produce binary data.');
    return result;
  } finally {
    unindex();
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

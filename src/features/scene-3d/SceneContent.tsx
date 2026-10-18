import { useEffect, useMemo, useRef, useState } from 'react';
import { isAssetHidden } from '@/data/assets/catalog';
import { useAssetModelsVersion } from './assetModels';
import * as THREE from 'three';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { PlacedObject, Project, RenderSettings, WallDisplay } from '@/domain/model/schema';
import type { DerivedPlan } from '@/domain/geometry/derive';
import type { JunctionHub, WallGeometry } from '@/domain/geometry/walls';
import { pointAt } from '@/domain/geometry/wallPath';
import { formatArea, formatLength } from '@/domain/model/units';
import { getAsset } from '@/data/assets/registry';
import {
  buildCeiling,
  buildFloor,
  buildHubGeometry,
  buildObject,
  buildWallGeometry,
  wallGeometryKey,
  wallMaterials,
  type BuildContext,
} from './builders';
import type { MaterialRegistry } from './materialRegistry';
import { loadProjectModels } from './customModels';
import { buildWallExtras, disposeWallExtras, wallExtrasKey, wallHasExtras } from './wallExtras';
import { buildOpening } from './openingBuilder';
import { usePackVersion } from '@/packs/events';
import { LampLights } from './LampLights';

export interface SceneOptions {
  wallDisplay: WallDisplay;
  cutawayHeight: number;
  showCeilings: boolean;
  showRoomLabels: boolean;
  showDimensions: boolean;
  quality: RenderSettings['quality'];
  shadows: boolean;
  hiddenCategories: string[];
  /** Hide everything above eye level except walls (used by walkthrough to keep ceilings). */
  interactive: boolean;
  selectedIds?: Set<string>;
  onPick?: (kind: 'wall' | 'object' | 'opening' | 'room', id: string, e: ThreeEvent<MouseEvent>) => void;
  onObjectPointerDown?: (obj: PlacedObject, e: ThreeEvent<PointerEvent>) => void;
}

/** Sun direction from time of day (hours) and azimuth (degrees, 0 = north/-y, clockwise). */
const WARMEST = new THREE.Color('#ff9a52');
const COOLEST = new THREE.Color('#bcd2ff');

export function sunFromSettings(r: Pick<RenderSettings, 'timeOfDay' | 'sunAzimuth' | 'sunIntensity'> & { sunWarmth?: number }) {
  const t = Math.min(1, Math.max(0, (r.timeOfDay - 6) / 14));
  const elevation = Math.max(4, 64 * Math.sin(Math.PI * t)) * (Math.PI / 180);
  const az = (r.sunAzimuth * Math.PI) / 180;
  const dir = new THREE.Vector3(Math.sin(az) * Math.cos(elevation), Math.sin(elevation), -Math.cos(az) * Math.cos(elevation));
  const warm = new THREE.Color('#ffc58f');
  const noon = new THREE.Color('#fffcf7');
  const color = warm.lerp(noon, Math.min(1, Math.sin(elevation) * 1.6));
  // User warmth on top of the time-of-day tint.
  const w = Math.max(-1, Math.min(1, r.sunWarmth ?? 0));
  if (w > 0) color.lerp(WARMEST, w * 0.75);
  else if (w < 0) color.lerp(COOLEST, -w * 0.75);
  const intensity = r.sunIntensity * (0.35 + 0.65 * Math.sin(elevation));
  return { dir, color, intensity, elevation };
}

export function Lighting({ project, derived, shadows, quality }: { project: Project; derived: DerivedPlan; shadows: boolean; quality: RenderSettings['quality'] }) {
  const { gl, scene } = useThree();
  const r = project.render;
  const lightRef = useRef<THREE.DirectionalLight>(null);
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const env = pmrem.fromScene(room, 0.04).texture;
    scene.environment = env;
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
      room.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) m.geometry.dispose();
      });
    };
  }, [gl, scene]);
  useEffect(() => {
    scene.environmentIntensity = r.envIntensity;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = r.exposure;
    gl.localClippingEnabled = true; // used by cutaway openings
  }, [scene, gl, r.envIntensity, r.exposure]);
  const b = derived.bounds ?? { minX: -5, minY: -5, maxX: 5, maxY: 5 };
  const cx = (b.minX + b.maxX) / 2;
  const cz = (b.minY + b.maxY) / 2;
  const sun = sunFromSettings(r);
  // The shadow area covers the plan plus how far a wall-height shadow reaches at this sun
  // elevation (long morning/evening shadows were cut off at the plan's edge).
  const reach = Math.min(14, (2.8 * Math.sqrt(Math.max(0, 1 - sun.dir.y * sun.dir.y))) / Math.max(0.12, sun.dir.y));
  const radius = Math.max(4, Math.hypot(b.maxX - b.minX, b.maxY - b.minY) / 2 + 1.5) + reach;
  const pos = sun.dir.clone().multiplyScalar(radius * 2.5).add(new THREE.Vector3(cx, 0, cz));
  const mapSize = quality === 'high' || quality === 'ultra' ? 4096 : quality === 'balanced' ? 2048 : 1024;
  useEffect(() => {
    const l = lightRef.current;
    if (!l) return;
    l.target.position.set(cx, 0, cz);
    l.target.updateMatrixWorld();
    const cam = l.shadow.camera;
    cam.left = -radius;
    cam.right = radius;
    cam.top = radius;
    cam.bottom = -radius;
    cam.near = 0.5;
    cam.far = radius * 6;
    cam.updateProjectionMatrix();
    l.shadow.mapSize.set(mapSize, mapSize);
    l.shadow.map?.dispose();
    l.shadow.map = null as unknown as THREE.WebGLRenderTarget;
    l.shadow.bias = -0.0004;
    l.shadow.normalBias = 0.025;
    l.shadow.radius = quality === 'ultra' ? 4 : quality === 'high' ? 3 : 2;
  }, [cx, cz, radius, mapSize, quality]);
  return (
    <>
      <hemisphereLight args={['#f7f9fb', '#888c90', 0.35 * r.envIntensity]} />
      <directionalLight ref={lightRef} position={pos} color={sun.color} intensity={sun.intensity} castShadow={shadows} />
      <LampLights project={project} quality={quality} />
    </>
  );
}

// ───────────────────────── Walls ─────────────────────────

function WallMesh({
  g,
  project,
  registry,
  cut,
  fade,
  center,
  shadows,
  onPick,
}: {
  g: WallGeometry;
  project: Project;
  registry: MaterialRegistry;
  cut?: number;
  fade: boolean;
  center: THREE.Vector3;
  shadows: boolean;
  onPick?: SceneOptions['onPick'];
}) {
  const key = wallGeometryKey(g, cut);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const geometry = useMemo(() => buildWallGeometry(g, cut), [key]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  const mats = wallMaterials(project, g, registry);
  const matKey = `${g.wall.materials.left}|${g.wall.materials.right}|${g.wall.materials.top}`;
  const faded = useMemo(
    () =>
      fade
        ? mats.map((m) => {
            const c = (m as THREE.MeshStandardMaterial).clone();
            fadeCopy(c);
            c.userData.srcOpacity = (m as THREE.MeshStandardMaterial).opacity;
            return c;
          })
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fade, matKey, project.materials],
  );
  useEffect(() => () => faded?.forEach((m) => m.dispose()), [faded]);
  const meshRef = useRef<THREE.Mesh>(null);
  const mid = useMemo(() => {
    const { p, tangent } = pointAt(g.path, g.path.length / 2);
    return { p: new THREE.Vector3(p.x, 0, p.y), n: new THREE.Vector3(tangent.y, 0, -tangent.x) };
  }, [g]);
  useFrame(({ camera }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    if (!faded) {
      if (mesh.material !== mats) mesh.material = mats;
      return;
    }
    faded.forEach((c, i) => followSource(c, mats[i], fadeCopy));
    // Fade walls that stand between the camera and the plan centre.
    const toCam = new THREE.Vector3(camera.position.x - mid.p.x, 0, camera.position.z - mid.p.z);
    const toCenter = new THREE.Vector3(center.x - mid.p.x, 0, center.z - mid.p.z);
    const camSide = Math.sign(toCam.dot(mid.n));
    const centerSide = Math.sign(toCenter.dot(mid.n));
    const near = camSide !== 0 && camSide !== centerSide && camera.position.y < 40;
    const want = near ? faded : mats;
    if (mesh.material !== want) mesh.material = want;
  });
  if (!geometry) return null;
  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={mats}
      castShadow={shadows}
      receiveShadow={shadows}
      userData={{ kind: 'wall', id: g.wall.id }}
      onClick={
        onPick
          ? (e) => {
              if (e.delta > 4) return;
              e.stopPropagation();
              onPick('wall', g.wall.id, e);
            }
          : undefined
      }
      onContextMenu={
        onPick
          ? (e: ThreeEvent<MouseEvent>) => {
              e.stopPropagation();
              onPick('wall', g.wall.id, e);
            }
          : undefined
      }
    />
  );
}

/** Mouldings, half-wall caps, glass walls and railings (see wallExtras.ts). */
function WallExtrasNode({
  g,
  project,
  registry,
  cut,
  shadows,
  onPick,
}: {
  g: WallGeometry;
  project: Project;
  registry: MaterialRegistry;
  cut?: number;
  shadows: boolean;
  onPick?: SceneOptions['onPick'];
}) {
  const key = wallExtrasKey(g, cut);
  // Rebuild when the wall's extras change or materials are edited (materials resolve at build time).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const group = useMemo(() => buildWallExtras(g, { project, registry, shadows }, cut), [key, shadows, project.materials]);
  useEffect(() => () => disposeWallExtras(group), [group]);
  if (!group) return null;
  return (
    <primitive
      object={group}
      onClick={
        onPick
          ? (e: ThreeEvent<MouseEvent>) => {
              if (e.delta > 4) return;
              e.stopPropagation();
              onPick('wall', g.wall.id, e);
            }
          : undefined
      }
      onContextMenu={
        onPick
          ? (e: ThreeEvent<MouseEvent>) => {
              e.stopPropagation();
              onPick('wall', g.wall.id, e);
            }
          : undefined
      }
    />
  );
}

function HubMesh({ hub, material, cut, shadows }: { hub: JunctionHub; material: THREE.Material; cut?: number; shadows: boolean }) {
  const key = `${hub.polygon.map((p) => `${p.x.toFixed(4)},${p.y.toFixed(4)}`).join(';')}|${hub.z0}|${hub.z1}|${cut}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const geometry = useMemo(() => buildHubGeometry(hub, cut), [key]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  if (!geometry) return null;
  return <mesh geometry={geometry} material={material} castShadow={shadows} receiveShadow={shadows} />;
}

// ───────────────────────── Objects, openings, rooms ─────────────────────────

function ObjectNode({ obj, ctx, modelsVersion, onPick, onPointerDown }: {
  obj: PlacedObject;
  ctx: BuildContext;
  modelsVersion: number;
  onPick?: SceneOptions['onPick'];
  onPointerDown?: SceneOptions['onObjectPointerDown'];
}) {
  const packs = usePackVersion();
  const assetModels = useAssetModelsVersion();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const group = useMemo(() => buildObject(obj, ctx), [obj, modelsVersion, ctx.shadows, ctx.project.customAssets, packs, assetModels]);
  return (
    <primitive
      object={group}
      onClick={
        onPick
          ? (e: ThreeEvent<MouseEvent>) => {
              if (e.delta > 4) return;
              e.stopPropagation();
              onPick('object', obj.id, e);
            }
          : undefined
      }
      onContextMenu={
        onPick
          ? (e: ThreeEvent<MouseEvent>) => {
              e.stopPropagation();
              onPick('object', obj.id, e);
            }
          : undefined
      }
      onPointerDown={onPointerDown ? (e: ThreeEvent<PointerEvent>) => onPointerDown(obj, e) : undefined}
    />
  );
}

const fadeCopy = (c: THREE.Material) => {
  c.transparent = true;
  c.opacity = 0.14;
  c.depthWrite = false;
};

/**
 * Keeps a derived copy (cutaway-clipped or faded) in step with its source
 * material after in-place updates: linked edits and photo maps that finish
 * loading after the copy was made. `keep` re-applies the copy's own overrides.
 */
function followSource(copy: THREE.Material, src: THREE.Material, keep: (c: THREE.Material) => void): void {
  const a = copy as THREE.MeshStandardMaterial;
  const b = src as THREE.MeshStandardMaterial;
  if (!a.isMeshStandardMaterial || !b.isMeshStandardMaterial) return;
  if (
    a.map === b.map &&
    a.normalMap === b.normalMap &&
    a.roughnessMap === b.roughnessMap &&
    a.color.equals(b.color) &&
    a.roughness === b.roughness &&
    a.metalness === b.metalness &&
    a.emissive.equals(b.emissive) &&
    a.emissiveIntensity === b.emissiveIntensity &&
    a.userData.srcOpacity === b.opacity
  )
    return;
  const maps = `${!!a.map}${!!a.normalMap}${!!a.roughnessMap}${a.transparent}`;
  a.copy(b);
  keep(a);
  a.userData.srcOpacity = b.opacity;
  if (maps !== `${!!a.map}${!!a.normalMap}${!!a.roughnessMap}${a.transparent}`) a.needsUpdate = true;
}

/** Clipped copies of materials for cutaway views (cached per source material and cut height). */
const clippedMaterials = new Map<string, { src: THREE.Material; copy: THREE.Material; cut: number }>();
const clipTo = (cut: number) => (c: THREE.Material) => {
  c.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, -1, 0), cut)];
  c.clipShadows = true;
};
function clippedMaterial(m: THREE.Material, cut: number): THREE.Material {
  const key = `${m.uuid}|${cut.toFixed(3)}`;
  let c = clippedMaterials.get(key);
  if (!c) {
    const copy = m.clone();
    clipTo(cut)(copy);
    copy.userData.srcOpacity = (m as THREE.MeshStandardMaterial).opacity;
    c = { src: m, copy, cut };
    clippedMaterials.set(key, c);
  }
  return c.copy;
}
/** Per frame: clipped copies follow their source materials (cheap reference/colour checks). */
function ClippedMaterialSync() {
  useFrame(() => {
    for (const c of clippedMaterials.values()) followSource(c.copy, c.src, clipTo(c.cut));
  });
  return null;
}

function OpeningNode({ g, spanId, project, ctx, cut, onPick }: { g: WallGeometry; spanId: string; project: Project; ctx: BuildContext; cut?: number; onPick?: SceneOptions['onPick'] }) {
  const o = project.openings[spanId];
  const span = g.spans.find((s) => s.id === spanId)!;
  // Arched/round openings fill their corners with the wall's own finishes, so wall materials are part of the key.
  const key = `${wallGeometryKey(g)}|${span.s0}|${span.s1}|${g.wall.materials.left}|${g.wall.materials.right}|${g.wall.materials.top}`;
  const group = useMemo(() => {
    const grp = buildOpening(o, g, span, ctx);
    // Cutaway: frames, leaves and glass are cut at the same height as the walls.
    if (cut !== undefined)
      grp.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) mesh.material = Array.isArray(mesh.material) ? mesh.material.map((m) => clippedMaterial(m, cut)) : clippedMaterial(mesh.material, cut);
      });
    return grp;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o, key, ctx.shadows, cut, cut !== undefined ? project.materials : null]);
  return (
    <primitive
      object={group}
      onClick={
        onPick
          ? (e: ThreeEvent<MouseEvent>) => {
              if (e.delta > 4) return;
              e.stopPropagation();
              onPick('opening', o.id, e);
            }
          : undefined
      }
      onContextMenu={
        onPick
          ? (e: ThreeEvent<MouseEvent>) => {
              e.stopPropagation();
              onPick('opening', o.id, e);
            }
          : undefined
      }
    />
  );
}

function RoomSlabs({ derived, ctx, showCeilings, onPick }: { derived: DerivedPlan; ctx: BuildContext; showCeilings: boolean; onPick?: SceneOptions['onPick'] }) {
  const floors = useMemo(
    () => derived.faces.map((f, i) => buildFloor(f, derived.faceRooms[i], ctx)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [derived.faces, derived.faceRooms.map((r) => `${r?.id}:${r?.floorMaterialId}`).join(), ctx.shadows],
  );
  const ceilings = useMemo(
    () =>
      showCeilings
        ? derived.faces
            .map((f, i) => (derived.faceRooms[i]?.showCeiling === false ? null : buildCeiling(f, derived.faceRooms[i], ctx)))
            .filter((x): x is THREE.Mesh => !!x)
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showCeilings, derived.faces, derived.faceRooms.map((r) => `${r?.id}:${r?.ceilingMaterialId}:${r?.ceilingHeight}:${r?.showCeiling}`).join(), ctx.project.walls],
  );
  useEffect(() => () => floors.forEach((m) => m.geometry.dispose()), [floors]);
  useEffect(() => () => ceilings.forEach((m) => m.geometry.dispose()), [ceilings]);
  return (
    <>
      {floors.map((m, i) => (
        <primitive
          key={`f${i}`}
          object={m}
          onClick={
            onPick && m.userData.id
              ? (e: ThreeEvent<MouseEvent>) => {
                  if (e.delta > 4) return;
                  e.stopPropagation();
                  onPick('room', m.userData.id as string, e);
                }
              : undefined
          }
          onContextMenu={
            onPick && m.userData.id
              ? (e: ThreeEvent<MouseEvent>) => {
                  e.stopPropagation();
                  onPick('room', m.userData.id as string, e);
                }
              : undefined
          }
        />
      ))}
      {ceilings.map((m, i) => (
        <primitive key={`c${i}`} object={m} />
      ))}
    </>
  );
}

function textSprite(lines: { text: string; size: number; weight: number; color: string }[]): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const scale = 2;
  const pad = 14;
  let w = 0;
  let h = pad;
  if (ctx) {
    for (const l of lines) {
      ctx.font = `${l.weight} ${l.size * scale}px Inter, system-ui, sans-serif`;
      w = Math.max(w, ctx.measureText(l.text).width);
      h += l.size * scale * 1.3;
    }
  }
  canvas.width = Math.ceil(w + pad * 2);
  canvas.height = Math.ceil(h + pad);
  if (ctx) {
    ctx.fillStyle = 'rgba(28,30,32,0.78)';
    const r = 14;
    ctx.beginPath();
    ctx.roundRect?.(0, 0, canvas.width, canvas.height, r);
    ctx.fill();
    let y = pad;
    for (const l of lines) {
      ctx.font = `${l.weight} ${l.size * scale}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = l.color;
      ctx.textBaseline = 'top';
      ctx.textAlign = 'center';
      ctx.fillText(l.text, canvas.width / 2, y);
      y += l.size * scale * 1.3;
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
  const sprite = new THREE.Sprite(mat);
  const k = 0.0032;
  sprite.scale.set(canvas.width * k, canvas.height * k, 1);
  sprite.renderOrder = 10;
  return sprite;
}

function Labels({ project, derived, rooms, dims }: { project: Project; derived: DerivedPlan; rooms: boolean; dims: boolean }) {
  const u = project.settings;
  const sprites = useMemo(() => {
    const out: THREE.Sprite[] = [];
    if (typeof document === 'undefined') return out;
    if (rooms)
      derived.faces.forEach((f, i) => {
        const r = derived.faceRooms[i];
        const s = textSprite([
          { text: r?.name ?? 'Room', size: 15, weight: 600, color: '#f4f2ed' },
          { text: formatArea(f.area, u.areaUnit, u.precision), size: 12, weight: 400, color: '#c9c5bd' },
        ]);
        s.position.set(f.label.x, 1.2, f.label.y);
        out.push(s);
      });
    if (dims)
      for (const g of derived.network.walls.values()) {
        if (g.path.length < 0.4) continue;
        const { p } = pointAt(g.path, g.path.length / 2);
        const s = textSprite([{ text: formatLength(g.path.length, u.units, u.precision), size: 12, weight: 600, color: '#9cc6f2' }]);
        s.position.set(p.x, g.z1 + 0.2, p.y);
        s.scale.multiplyScalar(0.8);
        out.push(s);
      }
    return out;
  }, [derived, rooms, dims, u.units, u.precision, u.areaUnit]);
  useEffect(
    () => () =>
      sprites.forEach((s) => {
        s.material.map?.dispose();
        s.material.dispose();
      }),
    [sprites],
  );
  return (
    <>
      {sprites.map((s, i) => (
        <primitive key={i} object={s} />
      ))}
    </>
  );
}

/** Everything generated from the project model. Shared by the editor 3D view and guest view. */
export function SceneContent({ project, derived, registry, options }: { project: Project; derived: DerivedPlan; registry: MaterialRegistry; options: SceneOptions }) {
  const [models, setModels] = useState<{ map: Map<string, THREE.Object3D>; version: number }>({ map: new Map(), version: 0 });
  const customKey = Object.values(project.customAssets)
    .map((a) => a.blobId)
    .join();
  useEffect(() => {
    let alive = true;
    if (!customKey) return;
    void loadProjectModels(project.customAssets).then((map) => {
      if (alive) setModels((m) => ({ map, version: m.version + 1 }));
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customKey]);

  const packs = usePackVersion();
  useEffect(() => registry.sync(project), [registry, project.materials, project, packs]);

  const shadows = options.shadows && options.quality !== 'draft';
  const ctx = useMemo<BuildContext>(
    () => ({ project, registry, customModels: models.map, shadows }),
    [project, registry, models.map, shadows],
  );
  const cut = options.wallDisplay === 'cutaway' ? options.cutawayHeight : undefined;
  const b = derived.bounds;
  const center = useMemo(() => new THREE.Vector3(b ? (b.minX + b.maxX) / 2 : 0, 0, b ? (b.minY + b.maxY) / 2 : 0), [b]);
  const constructionVisible = project.layers.construction.visible;
  const hubMat = registry.get(project, 'plaster-white');
  const objects = Object.values(project.objects).filter((o) => {
    if (o.hidden || !project.layers.furniture.visible) return false;
    // Lights of hidden items still shine (LampLights reads every object).
    return !isAssetHidden(getAsset(project, o.assetId), options.hiddenCategories);
  });
  return (
    <group name="neest-plan">
      <ClippedMaterialSync />
      {constructionVisible && options.wallDisplay !== 'hidden' && (
        <group name="walls">
          {[...derived.network.walls.values()]
            .filter((g) => !g.wall.hidden)
            .map((g) => (
              <WallMesh
                key={g.wall.id}
                g={g}
                project={project}
                registry={registry}
                cut={cut}
                fade={options.wallDisplay === 'fade'}
                center={center}
                shadows={shadows}
                onPick={options.onPick}
              />
            ))}
          {[...derived.network.walls.values()]
            .filter((g) => !g.wall.hidden && wallHasExtras(g))
            .map((g) => (
              <WallExtrasNode key={`x-${g.wall.id}`} g={g} project={project} registry={registry} cut={cut} shadows={shadows} onPick={options.onPick} />
            ))}
          {derived.network.hubs.map((h) => (
            <HubMesh key={h.nodeId} hub={h} material={hubMat} cut={cut} shadows={shadows} />
          ))}
        </group>
      )}
      {constructionVisible && (
        <group name="openings">
          {[...derived.network.walls.values()]
            .filter((g) => !g.wall.hidden)
            .flatMap((g) => g.spans.map((sp) => <OpeningNode key={sp.id} g={g} spanId={sp.id} project={project} ctx={ctx} cut={cut} onPick={options.onPick} />))}
        </group>
      )}
      <group name="rooms">
        <RoomSlabs derived={derived} ctx={ctx} showCeilings={options.showCeilings} onPick={options.onPick} />
      </group>
      <group name="objects">
        {objects.map((o) => (
          <ObjectNode key={o.id} obj={o} ctx={ctx} modelsVersion={models.version} onPick={options.onPick} onPointerDown={options.onObjectPointerDown} />
        ))}
      </group>
      {(options.showRoomLabels || options.showDimensions) && <Labels project={project} derived={derived} rooms={options.showRoomLabels} dims={options.showDimensions} />}
    </group>
  );
}


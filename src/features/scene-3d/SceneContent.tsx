import { useEffect, useMemo, useRef, useState } from 'react';
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
  buildOpening,
  buildWallGeometry,
  wallGeometryKey,
  wallMaterials,
  type BuildContext,
} from './builders';
import type { MaterialRegistry } from './materialRegistry';
import { loadProjectModels } from './customModels';

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
export function sunFromSettings(r: Pick<RenderSettings, 'timeOfDay' | 'sunAzimuth' | 'sunIntensity'>) {
  const t = Math.min(1, Math.max(0, (r.timeOfDay - 6) / 14));
  const elevation = Math.max(4, 64 * Math.sin(Math.PI * t)) * (Math.PI / 180);
  const az = (r.sunAzimuth * Math.PI) / 180;
  const dir = new THREE.Vector3(Math.sin(az) * Math.cos(elevation), Math.sin(elevation), -Math.cos(az) * Math.cos(elevation));
  const warm = new THREE.Color('#ffc58f');
  const noon = new THREE.Color('#fff6ea');
  const color = warm.lerp(noon, Math.min(1, Math.sin(elevation) * 1.6));
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
  const radius = Math.max(4, Math.hypot(b.maxX - b.minX, b.maxY - b.minY) / 2 + 1.5);
  const sun = sunFromSettings(r);
  const pos = sun.dir.clone().multiplyScalar(radius * 2.5).add(new THREE.Vector3(cx, 0, cz));
  const mapSize = quality === 'high' ? 4096 : quality === 'balanced' ? 2048 : 1024;
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
    l.shadow.radius = quality === 'high' ? 3 : 2;
  }, [cx, cz, radius, mapSize, quality]);
  return (
    <>
      <hemisphereLight args={['#f4f1ea', '#8a8378', 0.35 * r.envIntensity]} />
      <directionalLight ref={lightRef} position={pos} color={sun.color} intensity={sun.intensity} castShadow={shadows} />
      <LampLights project={project} enabled={quality === 'high'} />
    </>
  );
}

/** Point lights for lamp assets (high quality only, capped for performance). */
function LampLights({ project, enabled }: { project: Project; enabled: boolean }) {
  if (!enabled) return null;
  const lamps: { o: PlacedObject; light: NonNullable<ReturnType<typeof getAsset>>['light'] }[] = [];
  for (const o of Object.values(project.objects)) {
    if (o.hidden) continue;
    const a = getAsset(project, o.assetId);
    if (a?.light && lamps.length < 8) lamps.push({ o, light: a.light });
  }
  return (
    <>
      {lamps.map(({ o, light }) => (
        <pointLight key={o.id} position={[o.x, o.elevation + light!.y, o.y]} color={light!.color} intensity={light!.intensity} distance={light!.distance} decay={2} />
      ))}
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
            c.transparent = true;
            c.opacity = 0.14;
            c.depthWrite = false;
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const group = useMemo(() => buildObject(obj, ctx), [obj, modelsVersion, ctx.shadows, ctx.project.customAssets]);
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
      onPointerDown={onPointerDown ? (e: ThreeEvent<PointerEvent>) => onPointerDown(obj, e) : undefined}
    />
  );
}

/** Clipped copies of materials for cutaway views (cached per source material and cut height). */
const clippedMaterials = new Map<string, THREE.Material>();
function clippedMaterial(m: THREE.Material, cut: number): THREE.Material {
  const key = `${m.uuid}|${cut.toFixed(3)}`;
  let c = clippedMaterials.get(key);
  if (!c) {
    c = m.clone();
    c.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, -1, 0), cut)];
    c.clipShadows = true;
    clippedMaterials.set(key, c);
  }
  return c;
}

function OpeningNode({ g, spanId, project, ctx, cut, onPick }: { g: WallGeometry; spanId: string; project: Project; ctx: BuildContext; cut?: number; onPick?: SceneOptions['onPick'] }) {
  const o = project.openings[spanId];
  const span = g.spans.find((s) => s.id === spanId)!;
  const key = `${wallGeometryKey(g)}|${span.s0}|${span.s1}`;
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

  useEffect(() => registry.sync(project), [registry, project.materials, project]);

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
    const cat = getAsset(project, o.assetId)?.category;
    return !cat || !options.hiddenCategories.includes(cat);
  });
  return (
    <group name="neest-plan">
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
      {options.selectedIds && <SelectionBoxes project={project} derived={derived} ids={options.selectedIds} />}
    </group>
  );
}

function SelectionBoxes({ project, derived, ids }: { project: Project; derived: DerivedPlan; ids: Set<string> }) {
  const boxes: THREE.Box3[] = [];
  for (const id of ids) {
    const o = project.objects[id];
    if (o) {
      const hw = Math.abs(Math.cos(o.rotation)) * o.width / 2 + Math.abs(Math.sin(o.rotation)) * o.depth / 2;
      const hd = Math.abs(Math.sin(o.rotation)) * o.width / 2 + Math.abs(Math.cos(o.rotation)) * o.depth / 2;
      boxes.push(new THREE.Box3(new THREE.Vector3(o.x - hw, o.elevation, o.y - hd), new THREE.Vector3(o.x + hw, o.elevation + o.height, o.y + hd)));
    }
    const g = derived.network.walls.get(id);
    if (g) {
      const xs = g.footprint.map((p) => p.x);
      const ys = g.footprint.map((p) => p.y);
      boxes.push(new THREE.Box3(new THREE.Vector3(Math.min(...xs), g.z0, Math.min(...ys)), new THREE.Vector3(Math.max(...xs), g.z1, Math.max(...ys))));
    }
  }
  return (
    <>
      {boxes.map((b, i) => (
        <box3Helper key={i} args={[b, new THREE.Color('#2a8a78')]} />
      ))}
    </>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { Vec2 } from '@/domain/model/schema';
import { derivePlan } from '@/domain/geometry/derive';
import { snapPoint, type SnapContext } from '@/domain/geometry/snapping';
import { dist } from '@/domain/geometry/vec';
import { normalizeRotation, updateObjects } from '@/domain/commands/entities';
import { formatAngle, formatLength } from '@/domain/model/units';
import { getAsset } from '@/data/assets/registry';
import { OPENING_PRESETS } from '@/domain/model/defaults';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore, type ToolId } from '@/state/editorStore';
import { planKeyRouter } from '@/features/plan-2d/PlanCanvas';
import { createCurveTool, createMeasureTool, createRoomTool, createSplitTool, createWallTool } from '@/features/plan-2d/tools/drawTools';
import { createOpeningTool, createPlaceTool } from '@/features/plan-2d/tools/placeTools';
import type { GhostObject, PointerInfo, Tool, ToolEnv, ToolOverlay } from '@/features/plan-2d/tools/types';
import { buildObject, partGeometry } from './builders';
import { sharedRegistry } from './sceneRuntime';

/** Tools available directly in the 3D view (selection uses mesh picking instead). */
export const TOOLS_3D: ToolId[] = ['select', 'wall', 'curve', 'room', 'opening', 'split', 'measure', 'place'];

const ACCENT = '#2a8a78'; // brand teal, bright enough to read over floors
const SNAP = '#d0a650'; // brass

/** World size of one screen pixel at a point, for constant on-screen snap tolerances. */
export function worldPerPixel(camera: THREE.Camera, point: THREE.Vector3, viewportHeight: number): number {
  if ((camera as THREE.OrthographicCamera).isOrthographicCamera) {
    const o = camera as THREE.OrthographicCamera;
    return (o.top - o.bottom) / o.zoom / Math.max(1, viewportHeight);
  }
  const p = camera as THREE.PerspectiveCamera;
  const d = camera.position.distanceTo(point);
  return (2 * d * Math.tan((p.fov * Math.PI) / 360)) / Math.max(1, viewportHeight);
}

/**
 * Runs the plan drafting tools inside the 3D view: pointer positions are
 * projected onto the floor (or onto wall surfaces for doors/windows/splits)
 * and fed to the same tool implementations, so snapping, typed lengths,
 * commands and undo behave exactly as in 2D. Previews render in 3D.
 */
export function ToolBridge3D({ enabled }: { enabled: boolean }) {
  const gl = useThree((s) => s.gl);
  const get = useThree((s) => s.get);
  const tool = useEditorStore((s) => s.tool);
  const [overlay, setOverlay] = useState<ToolOverlay | null>(null);
  const pxRef = useRef(0.01);
  const tools = useMemo<Partial<Record<ToolId, Tool>>>(
    () => ({
      wall: createWallTool(),
      curve: createCurveTool(),
      room: createRoomTool(),
      opening: createOpeningTool(),
      place: createPlaceTool(),
      measure: createMeasureTool(),
      split: createSplitTool(),
    }),
    [],
  );
  const active = enabled ? tools[tool] : undefined;

  const env = useMemo<ToolEnv>(
    () => ({
      project: () => useProjectStore.getState().project!,
      derived: () => derivePlan(useProjectStore.getState().project!),
      editor: () => useEditorStore.getState(),
      px: () => pxRef.current,
      tol: () => pxRef.current * 9,
      snap: (p: Vec2, extra?: Partial<SnapContext>) => {
        const proj = useProjectStore.getState().project!;
        const ed = useEditorStore.getState();
        return snapPoint(p, {
          project: proj,
          network: derivePlan(proj).network,
          tol: pxRef.current * 13,
          settings: ed.snap,
          gridSize: proj.settings.gridSize,
          ...extra,
        });
      },
      setOverlay,
      setHint: (hint) => useEditorStore.getState().set({ hint }),
      setSnapLabel: (snapLabel) => {
        if (useEditorStore.getState().snapLabel !== snapLabel) useEditorStore.getState().set({ snapLabel });
      },
      setCursor: (c) => {
        gl.domElement.style.cursor = c;
      },
      finish: () => useEditorStore.getState().setTool('select'),
    }),
    [gl],
  );

  // Keyboard routing and hints while a 3D tool is active.
  useEffect(() => {
    if (!active) return;
    gl.domElement.style.cursor = active.cursor;
    useEditorStore.getState().set({ hint: `${active.hint} Right-drag to orbit, middle-drag to pan.` });
    planKeyRouter.current = (e) => active.onKeyDown?.(e, env) ?? false;
    planKeyRouter.cancel = () => active.cancel?.(env) ?? false;
    return () => {
      active.cancel?.(env);
      setOverlay(null);
      gl.domElement.style.cursor = '';
      if (planKeyRouter.current) planKeyRouter.current = null;
      planKeyRouter.cancel = null;
    };
  }, [active, env, gl]);

  // Pointer → plan-space projection.
  useEffect(() => {
    if (!active) return;
    const el = gl.domElement;
    const raycaster = new THREE.Raycaster();
    const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const toInfo = (e: PointerEvent | MouseEvent): PointerInfo | null => {
      const rect = el.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      const { camera, scene, size } = get();
      raycaster.setFromCamera(ndc, camera);
      let hit: THREE.Vector3 | null = null;
      if (tool === 'opening' || tool === 'split') {
        const walls = scene.getObjectByName('walls');
        const hits = walls ? raycaster.intersectObject(walls, true) : [];
        if (hits.length) hit = hits[0].point.clone();
      }
      if (!hit) {
        const p = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(floor, p)) hit = p;
      }
      if (!hit) return null;
      pxRef.current = worldPerPixel(camera, hit, size.height);
      return {
        world: { x: hit.x, y: hit.z },
        screen: { x: e.clientX - rect.left, y: e.clientY - rect.top },
        button: e.button,
        shift: e.shiftKey,
        alt: e.altKey,
        mod: e.ctrlKey || e.metaKey,
        pointerType: 'pointerType' in e ? (e as PointerEvent).pointerType : 'mouse',
      };
    };
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const i = toInfo(e);
      if (i) active.onPointerDown?.(i, env);
    };
    const onMove = (e: PointerEvent) => {
      const i = toInfo(e);
      if (!i) return;
      useEditorStore.getState().set({ cursor: i.world });
      active.onPointerMove?.(i, env);
    };
    const onUp = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const i = toInfo(e);
      if (i) active.onPointerUp?.(i, env);
    };
    const onDbl = (e: MouseEvent) => {
      const i = toInfo(e);
      if (i) active.onDoubleClick?.(i, env);
    };
    const onLeave = () => useEditorStore.getState().set({ cursor: null });
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('dblclick', onDbl);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('dblclick', onDbl);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, [active, env, gl, get, tool]);

  return (
    <>
      {overlay && <ToolOverlay3D overlay={overlay} />}
      <Measurements3D />
    </>
  );
}

// ───────────────────────── 3D previews ─────────────────────────

const previewMat = new THREE.MeshStandardMaterial({ color: ACCENT, transparent: true, opacity: 0.38, depthWrite: false, roughness: 0.6 });
const invalidMat = new THREE.MeshStandardMaterial({ color: '#e5574a', transparent: true, opacity: 0.4, depthWrite: false });
const splitMat = new THREE.MeshBasicMaterial({ color: '#e5574a', transparent: true, opacity: 0.85, depthTest: false });

function Prism({ points, y0, height, material }: { points: Vec2[]; y0: number; height: number; material: THREE.Material }) {
  const key = points.map((p) => `${p.x.toFixed(4)},${p.y.toFixed(4)}`).join(';') + `|${height}`;
  const geometry = useMemo(
    () => partGeometry({ shape: 'prism', outline: points.map((p) => [p.x, p.y] as [number, number]), height, position: [0, 0, 0], slot: '' }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  return <mesh geometry={geometry} material={material} position={[0, y0, 0]} renderOrder={5} raycast={() => null} />;
}

function Segment({ a, b, color, y = 0.02, dashed }: { a: Vec2; b: Vec2; color: string; y?: number; dashed?: boolean }) {
  const line = useMemo(() => {
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(a.x, y, a.y), new THREE.Vector3(b.x, y, b.y)]);
    const m = dashed
      ? new THREE.LineDashedMaterial({ color, dashSize: 0.12, gapSize: 0.08, depthTest: false, transparent: true })
      : new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true });
    const l = new THREE.Line(g, m);
    if (dashed) l.computeLineDistances();
    l.renderOrder = 10;
    l.raycast = () => undefined;
    return l;
  }, [a.x, a.y, b.x, b.y, color, y, dashed]);
  useEffect(
    () => () => {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    },
    [line],
  );
  return <primitive object={line} />;
}

function Label3D({ p, text, y = 0.05, accent }: { p: Vec2; text: string; y?: number; accent?: boolean }) {
  return (
    <Html position={[p.x, y, p.y]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
      <div className={`label3d${accent ? ' accent' : ''}`}>{text}</div>
    </Html>
  );
}

const ghostMaterials = new WeakMap<THREE.Material, THREE.Material>();
function ghostOf(m: THREE.Material): THREE.Material {
  let g = ghostMaterials.get(m);
  if (!g) {
    g = m.clone();
    g.transparent = true;
    g.opacity = Math.min(0.62, m.opacity);
    g.depthWrite = false;
    ghostMaterials.set(m, g);
  }
  return g;
}

/** The real 3D model of the item being placed, semi-transparent, following the cursor. */
function GhostObject3D({ ghost }: { ghost: GhostObject }) {
  const project = useProjectStore((s) => s.project!);
  const asset = getAsset(project, ghost.assetId);
  const group = useMemo(() => {
    const g = buildObject(
      {
        id: '__ghost__',
        assetId: ghost.assetId,
        name: null,
        x: 0,
        y: 0,
        elevation: 0,
        rotation: 0,
        width: ghost.width,
        depth: ghost.depth,
        height: ghost.height,
        mirrored: false,
        materials: {},
        locked: false,
        hidden: false,
      },
      { project, registry: sharedRegistry, shadows: false },
    );
    g.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.material = Array.isArray(m.material) ? m.material.map(ghostOf) : ghostOf(m.material);
        m.raycast = () => undefined;
        m.renderOrder = 4;
      }
    });
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ghost.assetId, ghost.width, ghost.depth, ghost.height]);
  const elevation = asset?.defaultElevation ?? 0;
  return (
    <group position={[ghost.x, elevation, ghost.y]} rotation={[0, -ghost.rotation, 0]}>
      <primitive object={group} position={[0, 0, 0]} rotation={[0, 0, 0]} />
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.006 - elevation, 0]} renderOrder={3} raycast={() => null}>
        <planeGeometry args={[ghost.width, ghost.depth]} />
        <meshBasicMaterial color={ACCENT} transparent opacity={0.22} depthWrite={false} />
      </mesh>
    </group>
  );
}

function ToolOverlay3D({ overlay }: { overlay: ToolOverlay }) {
  const project = useProjectStore((s) => s.project!);
  const wallH = project.settings.defaultWall.height;
  const els: React.ReactNode[] = [];
  overlay.wallPreviews?.forEach((poly, i) => els.push(<Prism key={`wp${i}`} points={poly} y0={0} height={wallH} material={previewMat} />));
  overlay.lines?.forEach((l, i) => els.push(<Segment key={`l${i}`} a={l.a} b={l.b} color={l.kind === 'guide' ? SNAP : ACCENT} dashed={l.kind === 'guide'} />));
  overlay.dims?.forEach((d, i) => {
    const mid = { x: (d.a.x + d.b.x) / 2, y: (d.a.y + d.b.y) / 2 };
    els.push(
      <group key={`d${i}`}>
        <Segment a={d.a} b={d.b} color={ACCENT} y={0.03} />
        <Label3D p={mid} text={d.text} y={wallH + 0.25} accent />
      </group>,
    );
  });
  overlay.labels?.forEach((l, i) => els.push(<Label3D key={`lb${i}`} p={l.p} text={l.text} y={0.3} />));
  if (overlay.snap) {
    els.push(
      <mesh key="snap" position={[overlay.snap.p.x, 0.03, overlay.snap.p.y]} rotation-x={-Math.PI / 2} renderOrder={12} raycast={() => null}>
        <ringGeometry args={[0.05, 0.09, 24]} />
        <meshBasicMaterial color={SNAP} depthTest={false} transparent />
      </mesh>,
    );
  }
  if (overlay.ghostObject) els.push(<GhostObject3D key="ghost" ghost={overlay.ghostObject} />);
  if (overlay.ghostOpening) {
    const preset = OPENING_PRESETS[useEditorStore.getState().openingKind];
    const sill = preset.sill;
    const head = Math.min(wallH, preset.sill + preset.height);
    els.push(
      <Prism key="gop" points={overlay.ghostOpening.pts} y0={sill - 0.01} height={head - sill + 0.02} material={overlay.ghostOpening.valid ? previewMat : invalidMat} />,
    );
  }
  if (overlay.splitMarker) {
    const { a, b } = overlay.splitMarker;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    els.push(
      <mesh key="split" position={[mid.x, wallH / 2, mid.y]} renderOrder={12} material={splitMat} raycast={() => null} rotation={[0, -Math.atan2(b.y - a.y, b.x - a.x), 0]}>
        <boxGeometry args={[dist(a, b), wallH + 0.1, 0.02]} />
      </mesh>,
    );
  }
  if (overlay.curveHandle) {
    const { a, b, c, mid } = overlay.curveHandle;
    els.push(
      <group key="curve">
        <Segment a={a} b={c} color={SNAP} dashed />
        <Segment a={c} b={b} color={SNAP} dashed />
        <mesh position={[mid.x, 0.05, mid.y]} raycast={() => null}>
          <sphereGeometry args={[0.07, 16, 12]} />
          <meshBasicMaterial color={ACCENT} />
        </mesh>
      </group>,
    );
  }
  if (overlay.numeric) els.push(<Label3D key="num" p={overlay.numeric.p} text={`${overlay.numeric.label}: ${overlay.numeric.value}`} y={0.4} accent />);
  return <group name="tool-overlay">{els}</group>;
}

function Measurements3D() {
  const measurements = useEditorStore((s) => s.measurements);
  const settings = useProjectStore((s) => s.project!.settings);
  return (
    <>
      {measurements.map((m) => (
        <group key={m.id}>
          <Segment a={m.a} b={m.b} color={SNAP} y={0.04} />
          <Label3D p={{ x: (m.a.x + m.b.x) / 2, y: (m.a.y + m.b.y) / 2 }} text={formatLength(dist(m.a, m.b), settings.units, settings.precision)} y={0.15} />
        </group>
      ))}
    </>
  );
}

// ───────────────────────── Transform gizmo ─────────────────────────

/** True when the pointer ray passes through a gizmo handle (handles take priority over scene objects). */
export function hitsGizmo(e: { intersections: THREE.Intersection[] }): boolean {
  return e.intersections.some((i) => {
    for (let o: THREE.Object3D | null = i.object; o; o = o.parent) if (o.name === 'neest-gizmo') return true;
    return false;
  });
}

const AXIS_COLORS = { x: '#e5574a', y: '#4fb36a', z: '#4a8fe5' } as const;
type Axis = 'x' | 'y' | 'z';

/** Parameter along the line (p + t·a) closest to the ray (o + s·d). */
function closestOnLine(o: THREE.Vector3, d: THREE.Vector3, p: THREE.Vector3, a: THREE.Vector3): number | null {
  const w0 = o.clone().sub(p);
  const b = a.dot(d);
  const denom = 1 - b * b;
  if (Math.abs(denom) < 1e-4) return null; // looking straight down the axis
  return (a.dot(w0) - b * d.dot(w0)) / denom;
}

const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });

const gizmoMaterials = new Map<string, THREE.MeshBasicMaterial>();
function gizmoMat(color: string, hot: boolean): THREE.MeshBasicMaterial {
  const key = `${color}|${hot}`;
  let m = gizmoMaterials.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({
      color: hot ? new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.35) : new THREE.Color(color),
      depthTest: false,
      transparent: true,
      opacity: hot ? 1 : 0.92,
    });
    gizmoMaterials.set(key, m);
  }
  return m;
}

/** Unit-length arrow along +Y (shaft + cone); oriented and scaled by the parent. */
function ArrowShape({ color, hot }: { color: string; hot: boolean }) {
  const mat = gizmoMat(color, hot);
  const r = hot ? 1.35 : 1;
  return (
    <>
      <mesh position={[0, 0.38, 0]} material={mat} renderOrder={20}>
        <cylinderGeometry args={[0.022 * r, 0.022 * r, 0.76, 10]} />
      </mesh>
      <mesh position={[0, 0.87, 0]} material={mat} renderOrder={20}>
        <coneGeometry args={[0.075 * r, 0.24, 18]} />
      </mesh>
      {/* Fatter hit target: rendered with no colour/depth so it stays raycastable but invisible. */}
      <mesh position={[0, 0.5, 0]} material={hitMat}>
        <cylinderGeometry args={[0.09, 0.09, 1, 8]} />
      </mesh>
    </>
  );
}

/**
 * Transform gizmo for selected furniture: X/Z arrows slide along the floor,
 * the Y arrow changes elevation, the centre disc moves freely, and the ring
 * rotates. Arrows keep a constant on-screen size. Snaps to the grid (Alt for
 * free movement); each drag is a single undo step.
 */
export function TransformGizmo({ controlsRef }: { controlsRef: React.MutableRefObject<OrbitControlsImpl | null> }) {
  const project = useProjectStore((s) => s.project!);
  const selection = useEditorStore((s) => s.selection);
  const gl = useThree((s) => s.gl);
  const get = useThree((s) => s.get);
  const [hot, setHot] = useState<string | null>(null);
  const [readout, setReadout] = useState<string | null>(null);
  const scaled = useRef<THREE.Group[]>([]);
  const centerRef = useRef(new THREE.Vector3());

  const objs = selection
    .filter((s) => s.kind === 'object')
    .map((s) => project.objects[s.id])
    .filter((o): o is NonNullable<typeof o> => !!o && !o.locked);
  const locked = project.layers.furniture.locked;
  const n = objs.length;
  const cx = n ? objs.reduce((a, o) => a + o.x, 0) / n : 0;
  const cz = n ? objs.reduce((a, o) => a + o.y, 0) / n : 0;
  const base = n ? Math.min(...objs.map((o) => o.elevation)) : 0;
  const top = n ? Math.max(...objs.map((o) => o.elevation + o.height)) : 0;
  centerRef.current.set(cx, base, cz);

  // Constant on-screen size for the handles.
  useFrame(() => {
    const { camera, size } = get();
    const k = worldPerPixel(camera, centerRef.current, size.height) * 95;
    for (const g of scaled.current) g.scale.setScalar(k);
  });

  if (!n || locked) return null;
  const single = n === 1 ? objs[0] : null;
  const ringR = single ? Math.max(single.width, single.depth) / 2 + 0.22 : 0.3;
  const units = project.settings;

  const startDrag = (e: ThreeEvent<PointerEvent>, mode: Axis | 'free' | 'rotate') => {
    console.debug('[gizmo] down', mode, e.button);
    if (e.button !== 0) return;
    e.stopPropagation();
    const ids = objs.map((o) => o.id);
    const start = new Map(objs.map((o) => [o.id, { x: o.x, y: o.y, e: o.elevation, r: o.rotation }]));
    const grid = project.settings.gridSize;
    const raycaster = new THREE.Raycaster();
    const el = gl.domElement;
    const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(base + 0.02));
    const axisDir = mode === 'x' ? new THREE.Vector3(1, 0, 0) : mode === 'z' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
    const axisOrigin = mode === 'y' ? new THREE.Vector3(cx, top, cz) : new THREE.Vector3(cx, base, cz);
    const t0 = mode === 'x' || mode === 'y' || mode === 'z' ? closestOnLine(e.ray.origin, e.ray.direction, axisOrigin, axisDir) : null;
    const hit0 = new THREE.Vector3();
    e.ray.intersectPlane(floor, hit0);
    const a0 = Math.atan2(hit0.z - cz, hit0.x - cx);
    if (controlsRef.current) controlsRef.current.enabled = false;
    useProjectStore
      .getState()
      .begin(mode === 'rotate' ? 'Rotate object' : mode === 'y' ? 'Change elevation' : n > 1 ? 'Move objects' : 'Move object');
    setHot(mode);
    const move = (ev: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      raycaster.setFromCamera(
        new THREE.Vector2(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1),
        get().camera,
      );
      const ray = raycaster.ray;
      const snap = !ev.altKey && useEditorStore.getState().snap.grid;
      if (mode === 'rotate' && single) {
        const p = new THREE.Vector3();
        if (!ray.intersectPlane(floor, p)) return;
        let rot = start.get(single.id)!.r + (Math.atan2(p.z - cz, p.x - cx) - a0);
        if (!ev.altKey) rot = Math.round(rot / (Math.PI / 12)) * (Math.PI / 12);
        rot = normalizeRotation(rot);
        setReadout(formatAngle(rot));
        useProjectStore.getState().preview((d) => updateObjects(d, [single.id], { rotation: rot }));
        return;
      }
      if (mode === 'free') {
        const p = new THREE.Vector3();
        if (!ray.intersectPlane(floor, p)) return;
        let dx = p.x - hit0.x;
        let dz = p.z - hit0.z;
        if (snap) {
          dx = Math.round((cx + dx) / (grid / 2)) * (grid / 2) - cx;
          dz = Math.round((cz + dz) / (grid / 2)) * (grid / 2) - cz;
        }
        setReadout(`Δ ${formatLength(Math.hypot(dx, dz), units.units, units.precision)}`);
        useProjectStore.getState().preview((d) => {
          for (const id of ids) {
            const s0 = start.get(id)!;
            d.objects[id].x = s0.x + dx;
            d.objects[id].y = s0.y + dz;
          }
        });
        return;
      }
      if (t0 === null) return;
      const t = closestOnLine(ray.origin, ray.direction, axisOrigin, axisDir);
      if (t === null) return;
      let delta = t - t0;
      if (mode === 'y') {
        if (snap) delta = Math.round((base + delta) / 0.05) * 0.05 - base;
        delta = Math.max(-base, delta);
        setReadout(`Elevation ${formatLength(base + delta, units.units, units.precision)}`);
        useProjectStore.getState().preview((d) => {
          for (const id of ids) d.objects[id].elevation = Math.max(0, start.get(id)!.e + delta);
        });
        return;
      }
      const c0 = mode === 'x' ? cx : cz;
      if (snap) delta = Math.round((c0 + delta) / (grid / 2)) * (grid / 2) - c0;
      setReadout(`${mode === 'x' ? 'Δx' : 'Δz'} ${delta >= 0 ? '+' : '−'}${formatLength(Math.abs(delta), units.units, units.precision)}`);
      useProjectStore.getState().preview((d) => {
        for (const id of ids) {
          const s0 = start.get(id)!;
          if (mode === 'x') d.objects[id].x = s0.x + delta;
          else d.objects[id].y = s0.y + delta;
        }
      });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      useProjectStore.getState().commit();
      setHot(null);
      setReadout(null);
      if (controlsRef.current) controlsRef.current.enabled = true;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const hover = (id: string) => ({
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      setHot((h) => h ?? id);
      gl.domElement.style.cursor = id === 'rotate' ? 'grab' : 'move';
    },
    onPointerOut: () => {
      setHot((h) => (h === id ? null : h));
      gl.domElement.style.cursor = '';
    },
  });
  scaled.current = [];
  const keep = (g: THREE.Group | null) => {
    if (g) scaled.current.push(g);
  };

  return (
    <group name="neest-gizmo" userData={{ helper: true }}>
      {/* X arrow (east) */}
      <group position={[cx + ringR, base + 0.03, cz]} rotation={[0, 0, -Math.PI / 2]} ref={keep} onPointerDown={(e) => startDrag(e, 'x')} {...hover('x')}>
        <ArrowShape color={AXIS_COLORS.x} hot={hot === 'x'} />
      </group>
      {/* Z arrow (towards the bottom of the plan) */}
      <group position={[cx, base + 0.03, cz + ringR]} rotation={[Math.PI / 2, 0, 0]} ref={keep} onPointerDown={(e) => startDrag(e, 'z')} {...hover('z')}>
        <ArrowShape color={AXIS_COLORS.z} hot={hot === 'z'} />
      </group>
      {/* Y arrow (elevation) */}
      <group position={[cx, top + 0.04, cz]} ref={keep} onPointerDown={(e) => startDrag(e, 'y')} {...hover('y')}>
        <ArrowShape color={AXIS_COLORS.y} hot={hot === 'y'} />
      </group>
      {/* Centre disc: free move on the floor */}
      <group position={[cx, base + 0.03, cz]} ref={keep} onPointerDown={(e) => startDrag(e, 'free')} {...hover('free')}>
        <mesh rotation-x={-Math.PI / 2} material={gizmoMat('#f2efe9', hot === 'free')} renderOrder={21}>
          <circleGeometry args={[0.11, 28]} />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.001, 0]} material={gizmoMat(ACCENT, hot === 'free')} renderOrder={22}>
          <ringGeometry args={[0.07, 0.11, 28]} />
        </mesh>
      </group>
      {single && (
        <group position={[cx, base + 0.025, cz]} rotation={[0, -single.rotation, 0]}>
          <mesh rotation-x={-Math.PI / 2} onPointerDown={(e) => startDrag(e, 'rotate')} {...hover('rotate')} material={gizmoMat(ACCENT, hot === 'rotate')} renderOrder={19}>
            <torusGeometry args={[ringR, hot === 'rotate' ? 0.04 : 0.026, 10, 72]} />
          </mesh>
          <mesh position={[0, 0, ringR]} rotation-x={-Math.PI / 2} material={gizmoMat(ACCENT, true)} renderOrder={19} raycast={() => null}>
            <circleGeometry args={[0.06, 20]} />
          </mesh>
        </group>
      )}
      {readout && (
        <Html position={[cx, top + 0.6, cz]} center style={{ pointerEvents: 'none' }}>
          <div className="label3d accent">{readout}</div>
        </Html>
      )}
    </group>
  );
}

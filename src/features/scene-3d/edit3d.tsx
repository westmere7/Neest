import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { Vec2 } from '@/domain/model/schema';
import { derivePlan } from '@/domain/geometry/derive';
import { snapPoint, type SnapContext } from '@/domain/geometry/snapping';
import { dist } from '@/domain/geometry/vec';
import { axisLockLabel, createAxisLock, snapOnAxis, type LockAxis } from '@/domain/geometry/axisLock';
import { pointAt, projectOnPath } from '@/domain/geometry/wallPath';
import { openingOffsetRange } from '@/domain/geometry/walls';
import { normalizeRotation, updateObjects } from '@/domain/commands/entities';
import { formatAngle, formatLength } from '@/domain/model/units';
import { getAsset } from '@/data/assets/registry';
import { OPENING_PRESETS } from '@/domain/model/defaults';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore, type ToolId } from '@/state/editorStore';
import { planKeyRouter } from '@/features/plan-2d/PlanCanvas';
import { createCurveTool, createMeasureTool, createRoomTool, createSplitTool, createWallTool } from '@/features/plan-2d/tools/drawTools';
import { createCalloutTool } from '@/features/plan-2d/tools/calloutTool';
import { createRunTool, createServicePointTool } from '@/features/plan-2d/tools/serviceTools';
import { SERVICE_POINTS } from '@/domain/model/services';
import { pointElevation, servicePointAt } from '@/domain/geometry/services';
import { moveServicePoints, updateServicePoint } from '@/domain/commands/services';
import { runColor } from '@/features/services/ServicesSvg';
import { createOpeningTool, createPlaceTool } from '@/features/plan-2d/tools/placeTools';
import { createExtendTool } from '@/features/plan-2d/tools/extendTool';
import type { GhostObject, PointerInfo, Tool, ToolEnv, ToolOverlay } from '@/features/plan-2d/tools/types';
import { buildObject, partGeometry } from './builders';
import { sharedRegistry } from './sceneRuntime';
import { canScale, scalePct, scaledSize } from '@/features/editor/objectScale';
import { isObjectLocked } from '@/domain/commands/itemLayers';

/** Tools available directly in the 3D view (selection uses mesh picking instead). */
export const TOOLS_3D: ToolId[] = ['select', 'pan', 'wall', 'curve', 'room', 'opening', 'split', 'extend', 'measure', 'place', 'callout', 'service', 'run'];

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
      extend: createExtendTool(),
      callout: createCalloutTool(),
      service: createServicePointTool(),
      run: createRunTool(),
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
    if (!enabled) return;
    if (!active) {
      gl.domElement.style.cursor = tool === 'pan' ? 'grab' : '';
      useEditorStore.getState().set({
        hint:
          tool === 'pan'
            ? 'Drag or Shift-swipe to pan · two-finger swipe or Shift-drag to orbit · pinch or scroll to zoom.'
            : 'Drag or two-finger swipe to orbit · Shift-swipe or Space-drag to pan · pinch or scroll to zoom.',
      });
      return () => {
        gl.domElement.style.cursor = '';
      };
    }
    gl.domElement.style.cursor = active.cursor;
    useEditorStore
      .getState()
      .set({ hint: `${active.hint} Two-finger swipe or Alt-drag to orbit, Space-drag to pan.` });
    const keys = (e: KeyboardEvent) => active.onKeyDown?.(e, env) ?? false;
    const cancel = () => active.cancel?.(env) ?? false;
    planKeyRouter.current = keys;
    planKeyRouter.cancel = cancel;
    return () => {
      active.cancel?.(env);
      setOverlay(null);
      gl.domElement.style.cursor = '';
      // Only our own handlers: the plan may have registered its tool since (split view, view switches).
      if (planKeyRouter.current === keys) planKeyRouter.current = null;
      if (planKeyRouter.cancel === cancel) planKeyRouter.cancel = null;
    };
  }, [enabled, active, tool, env, gl]);

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
      if (tool === 'opening' || tool === 'split' || tool === 'extend') {
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
        ...(ghost.model ? { model: ghost.model } : {}),
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
  const elevation = ghost.elevation ?? asset?.defaultElevation ?? 0;
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
  if (overlay.runPreview) {
    const rp = overlay.runPreview;
    const y = rp.level === 'floor' ? 0.01 : rp.level === 'ceiling' ? wallH - 0.02 : useEditorStore.getState().runHeight;
    rp.points.slice(1).forEach((p, i) => els.push(<Segment key={`rp${i}`} a={rp.points[i]} b={p} color={runColor(rp)} y={y} />));
  }
  if (overlay.ghostService) {
    const g = overlay.ghostService;
    const y = g.host === 'floor' ? 0.02 : g.host === 'ceiling' ? wallH - 0.02 : SERVICE_POINTS[g.kind].height;
    els.push(
      <mesh key="gsvc" position={[g.x, y, g.y]} renderOrder={12} raycast={() => null}>
        <sphereGeometry args={[0.05, 16, 12]} />
        <meshBasicMaterial color={g.valid ? '#ffffff' : '#ff3b5c'} depthTest={false} transparent opacity={0.85} />
      </mesh>,
    );
  }
  if (overlay.ghostOpening) {
    const ed = useEditorStore.getState();
    const preset = OPENING_PRESETS[ed.openingKind];
    // A Duplicate shows the original's sill and height.
    const tpl = ed.openingTemplate?.kind === ed.openingKind ? ed.openingTemplate : null;
    const sill = tpl ? tpl.sillHeight : preset.sill;
    const head = Math.min(wallH, sill + (tpl ? tpl.height : preset.height));
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

const AXIS_COLORS = { x: '#ff2a1f', y: '#12d14b', z: '#1f74ff' } as const;
/** The gizmo's ring, centre disc and scale square: a vivid teal. */
const GIZMO_TEAL = '#00d4a6';
type Axis = 'x' | 'y' | 'z';

const lockGuideMats = {
  x: new THREE.LineBasicMaterial({ color: AXIS_COLORS.x, transparent: true, opacity: 0.85, depthTest: false }),
  y: new THREE.LineBasicMaterial({ color: AXIS_COLORS.z, transparent: true, opacity: 0.85, depthTest: false }),
};

/**
 * Feedback for a Shift-locked 3D move: a thin line along the locked axis (the gizmo's arrow colour)
 * through the moved item, and "Locked to … axis" in the status bar. Call `clear()` when the drag ends.
 */
export function axisLockFeedback3D(scene: THREE.Scene) {
  const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-60, 0, 0), new THREE.Vector3(60, 0, 0)]);
  const line = new THREE.Line(geo, lockGuideMats.x);
  line.name = 'axis-lock-guide';
  line.renderOrder = 30;
  line.userData.helper = true;
  line.raycast = () => {};
  const setLabel = (snapLabel: string | null) => {
    if (useEditorStore.getState().snapLabel !== snapLabel) useEditorStore.getState().set({ snapLabel });
  };
  return {
    update(axis: LockAxis | null, origin: Vec2, y: number, extra: string | null = null) {
      if (axis) {
        line.material = lockGuideMats[axis];
        line.position.set(origin.x, y, origin.y);
        line.rotation.set(0, axis === 'x' ? 0 : -Math.PI / 2, 0);
        if (!line.parent) scene.add(line);
      } else line.removeFromParent();
      setLabel([axis && axisLockLabel(axis, '3d'), extra].filter(Boolean).join(' · ') || null);
    },
    clear() {
      line.removeFromParent();
      geo.dispose();
      setLabel(null);
    },
  };
}

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
      opacity: 1,
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
 * Gizmo for a selected door or window: an arrow at each side, along the wall, at mid-height.
 * Dragging either slides the opening along its wall (it cannot leave the wall), snapped to half the
 * grid (Alt for free), within the part of the wall it fits in. Windows also get an arrow on top that
 * raises or lowers the sill (5 cm steps). One undo step per drag.
 */
function OpeningGizmo({ openingId, controlsRef }: { openingId: string; controlsRef: React.MutableRefObject<OrbitControlsImpl | null> }) {
  const project = useProjectStore((s) => s.project!);
  const gl = useThree((s) => s.gl);
  const get = useThree((s) => s.get);
  const [hot, setHot] = useState<string | null>(null);
  const [readout, setReadout] = useState<string | null>(null);
  const centerRef = useRef(new THREE.Vector3());
  const scaled = useRef<THREE.Group[]>([]);
  const o = project.openings[openingId];
  const g = useMemo(() => (o ? derivePlan(project).network.walls.get(o.wallId) : undefined), [project, o]);
  const at = g && o ? pointAt(g.path, Math.min(Math.max(o.offset, 0), g.path.length)) : null;
  const midY = o ? o.sillHeight + o.height / 2 : 0;
  if (at) centerRef.current.set(at.p.x, midY, at.p.y);
  useFrame(() => {
    const { camera, size } = get();
    const k = worldPerPixel(camera, centerRef.current, size.height) * 80;
    for (const m of scaled.current) m.scale.setScalar(k);
  });
  const wall = o ? project.walls[o.wallId] : undefined;
  if (!o || !g || !at || !wall || wall.locked || project.layers.construction.locked) return null;
  const units = project.settings;
  const tangent = new THREE.Vector3(at.tangent.x, 0, at.tangent.y).normalize();

  const isWindow = o.kind.startsWith('window');
  const up = new THREE.Vector3(0, 1, 0);
  const startDrag = (e: ThreeEvent<PointerEvent>, side: 'a' | 'b' | 'sill') => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const origin = centerRef.current.clone();
    const axis = side === 'sill' ? up : tangent;
    const t0 = closestOnLine(e.ray.origin, e.ray.direction, origin, axis);
    if (t0 === null) return;
    const offset0 = o.offset;
    const sill0 = o.sillHeight;
    const maxSill = Math.max(0, wall.height - o.height - 0.02);
    const [lo, hi] = openingOffsetRange(g, o.width);
    const grid = project.settings.gridSize;
    const raycaster = new THREE.Raycaster();
    const el = gl.domElement;
    if (controlsRef.current) controlsRef.current.enabled = false;
    useProjectStore.getState().begin(side === 'sill' ? 'Change sill height' : isWindow ? 'Move window' : 'Move door');
    setHot(side);
    const move = (ev: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      raycaster.setFromCamera(
        new THREE.Vector2(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1),
        get().camera,
      );
      const t = closestOnLine(raycaster.ray.origin, raycaster.ray.direction, origin, axis);
      if (t === null) return;
      if (side === 'sill') {
        let sill = sill0 + (t - t0);
        if (!ev.altKey && useEditorStore.getState().snap.grid) sill = Math.round(sill / 0.05) * 0.05;
        sill = Math.min(Math.max(sill, 0), maxSill);
        setReadout(`Sill ${formatLength(sill, units.units, units.precision)}`);
        useProjectStore.getState().preview((d) => {
          if (d.openings[openingId]) d.openings[openingId].sillHeight = sill;
        });
        return;
      }
      // Onto the wall's own path (curved walls bend away from the tangent line).
      const p = origin.clone().addScaledVector(tangent, t - t0);
      let s = g.path.control ? projectOnPath(g.path, { x: p.x, y: p.z }).s : offset0 + (t - t0);
      if (!ev.altKey && useEditorStore.getState().snap.grid) s = Math.round(s / (grid / 2)) * (grid / 2);
      s = Math.min(Math.max(s, lo), Math.max(lo, hi));
      setReadout(`${formatLength(s - o.width / 2, units.units, units.precision)} from wall start`);
      useProjectStore.getState().preview((d) => {
        if (d.openings[openingId]) d.openings[openingId].offset = s;
      });
    };
    const done = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', done);
      useProjectStore.getState().commit();
      setHot(null);
      setReadout(null);
      if (controlsRef.current) controlsRef.current.enabled = true;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', done);
  };

  scaled.current = [];
  const keep = (m: THREE.Group | null) => {
    if (m) scaled.current.push(m);
  };
  const yaw = -Math.atan2(tangent.z, tangent.x);
  const reach = o.width / 2 + 0.08;
  return (
    <group name="neest-gizmo" userData={{ helper: true }}>
      {(['a', 'b'] as const).map((side) => {
        const sign = side === 'a' ? -1 : 1;
        return (
          <group
            key={side}
            position={[at.p.x + tangent.x * reach * sign, midY, at.p.y + tangent.z * reach * sign]}
            rotation={[0, yaw + (side === 'a' ? Math.PI : 0), 0]}
            onPointerDown={(e) => startDrag(e, side)}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHot((h) => h ?? side);
              gl.domElement.style.cursor = 'ew-resize';
            }}
            onPointerOut={() => {
              setHot((h) => (h === side ? null : h));
              gl.domElement.style.cursor = '';
            }}
          >
            <group rotation={[0, 0, -Math.PI / 2]} ref={keep}>
              <ArrowShape color={AXIS_COLORS.x} hot={hot === 'a' || hot === 'b'} />
            </group>
          </group>
        );
      })}
      {isWindow && (
        <group
          position={[at.p.x, o.sillHeight + o.height + 0.06, at.p.y]}
          ref={keep}
          onPointerDown={(e) => startDrag(e, 'sill')}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHot((h) => h ?? 'sill');
            gl.domElement.style.cursor = 'ns-resize';
          }}
          onPointerOut={() => {
            setHot((h) => (h === 'sill' ? null : h));
            gl.domElement.style.cursor = '';
          }}
        >
          <ArrowShape color={AXIS_COLORS.y} hot={hot === 'sill'} />
        </group>
      )}
      {readout && (
        <Html position={[at.p.x, o.sillHeight + o.height + (isWindow ? 0.6 : 0.35), at.p.y]} center style={{ pointerEvents: 'none' }}>
          <div className="label3d accent">{readout}</div>
        </Html>
      )}
    </group>
  );
}

/**
 * Small gizmo for a selected services point (Services mode, 3D). A wall point gets an arrow each
 * way along its wall (it slides along walls, stepping onto another wall it reaches) and one up for
 * its height (5 cm steps); floor and ceiling points get X and Z arrows (they stay inside rooms).
 * Grid-snapped unless Alt; one undo step per drag.
 */
function ServicePointGizmo({ pointId, controlsRef }: { pointId: string; controlsRef: React.MutableRefObject<OrbitControlsImpl | null> }) {
  const project = useProjectStore((s) => s.project!);
  const gl = useThree((s) => s.gl);
  const get = useThree((s) => s.get);
  const [hot, setHot] = useState<string | null>(null);
  const [readout, setReadout] = useState<string | null>(null);
  const groupRef = useRef<THREE.Group>(null);
  const centerRef = useRef(new THREE.Vector3());
  const pt = project.servicePoints?.[pointId];
  const derived = useMemo(() => derivePlan(project), [project]);
  const at = pt ? servicePointAt(derived, pt) : null;
  const y = pt ? pointElevation(project, derived, pt) : 0;
  if (at) centerRef.current.set(at.x, y, at.y);
  useFrame(() => {
    const { camera, size } = get();
    groupRef.current?.scale.setScalar(worldPerPixel(camera, centerRef.current, size.height) * 52);
  });
  if (!pt || !at) return null;
  const units = project.settings;
  const wall = pt.host === 'wall';
  // Along the wall: perpendicular to the direction the point faces.
  const tangent = new THREE.Vector3(-Math.sin(at.rotation), 0, Math.cos(at.rotation));
  const up = new THREE.Vector3(0, 1, 0);
  const X = new THREE.Vector3(1, 0, 0);
  const Z = new THREE.Vector3(0, 0, 1);
  // Each arrow: where it points, and the axis (shared by its pair) a drag moves along.
  const axes: { key: string; group: string; dir: THREE.Vector3; axis: THREE.Vector3; color: string }[] = wall
    ? [
        { key: 'a', group: 'wall', dir: tangent, axis: tangent, color: AXIS_COLORS.x },
        { key: 'b', group: 'wall', dir: tangent.clone().negate(), axis: tangent, color: AXIS_COLORS.x },
        { key: 'h', group: 'h', dir: up, axis: up, color: AXIS_COLORS.y },
      ]
    : [
        { key: 'x+', group: 'x', dir: X, axis: X, color: AXIS_COLORS.x },
        { key: 'x-', group: 'x', dir: X.clone().negate(), axis: X, color: AXIS_COLORS.x },
        { key: 'z+', group: 'z', dir: Z, axis: Z, color: AXIS_COLORS.z },
        { key: 'z-', group: 'z', dir: Z.clone().negate(), axis: Z, color: AXIS_COLORS.z },
      ];
  const hotGroup = axes.find((a) => a.key === hot)?.group;

  const startDrag = (e: ThreeEvent<PointerEvent>, axis: THREE.Vector3, height: boolean) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const origin = centerRef.current.clone();
    const t0 = closestOnLine(e.ray.origin, e.ray.direction, origin, axis);
    if (t0 === null) return;
    const base = { [pointId]: { x: at.x, y: at.y } };
    const h0 = pt.height;
    const raycaster = new THREE.Raycaster();
    const el = gl.domElement;
    if (controlsRef.current) controlsRef.current.enabled = false;
    useProjectStore.getState().begin(height ? 'Point height' : 'Move point');
    const move = (ev: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1), get().camera);
      const t = closestOnLine(raycaster.ray.origin, raycaster.ray.direction, origin, axis);
      if (t === null) return;
      const snap = !ev.altKey && useEditorStore.getState().snap.grid;
      if (height) {
        let h = Math.min(6, Math.max(0, h0 + (t - t0)));
        if (snap) h = Math.round(h / 0.05) * 0.05;
        setReadout(`Height ${formatLength(h, units.units, units.precision)}`);
        useProjectStore.getState().preview((d) => updateServicePoint(d, pointId, { height: h }));
        return;
      }
      const step = units.gridSize / 2;
      let along = t - t0;
      if (snap) along = Math.round(along / step) * step;
      setReadout(formatLength(Math.abs(along), units.units, units.precision));
      useProjectStore.getState().preview((d) => moveServicePoints(d, derived, base, { x: axis.x * along, y: axis.z * along }));
    };
    const done = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', done);
      useProjectStore.getState().commit();
      setHot(null);
      setReadout(null);
      if (controlsRef.current) controlsRef.current.enabled = true;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', done);
  };

  // Orients ArrowShape (built along +Y) to a direction.
  const quat = (dir: THREE.Vector3) => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  return (
    <group name="neest-gizmo" userData={{ helper: true }}>
      <group ref={groupRef} position={[at.x, y, at.y]}>
        {axes.map((a) => {
          const isHot = hotGroup === a.group;
          return (
            <group
              key={a.key}
              position={a.dir.clone().multiplyScalar(0.32).toArray()}
              quaternion={quat(a.dir)}
              onPointerDown={(e) => {
                setHot(a.key);
                startDrag(e, a.axis, a.group === 'h');
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                setHot((h) => h ?? a.key);
                gl.domElement.style.cursor = a.key === 'h' ? 'ns-resize' : 'move';
              }}
              onPointerOut={() => {
                setHot((h) => (h === a.key ? null : h));
                gl.domElement.style.cursor = '';
              }}
            >
              <ArrowShape color={a.color} hot={isHot} />
            </group>
          );
        })}
      </group>
      {readout && (
        <Html position={[at.x, y + 0.35, at.y]} center style={{ pointerEvents: 'none' }}>
          <div className="label3d accent">{readout}</div>
        </Html>
      )}
    </group>
  );
}

type ResizeAxis = 'rx' | 'rz' | 'ry';
/** The item size an arrow's resize tab changes: X and Z take whichever of width/depth lines up with them. */
function resizeKey(rotation: number, m: ResizeAxis): 'width' | 'depth' | 'height' {
  if (m === 'ry') return 'height';
  const alongX = Math.abs(Math.cos(rotation)) >= Math.abs(Math.sin(rotation));
  return (m === 'rx') === alongX ? 'width' : 'depth';
}
const RESIZE_LABEL = { width: 'Width', depth: 'Depth', height: 'Height' } as const;

/** Four-way move icon lying flat: a teal disc with a white cross of arrows. */
function MoveIcon({ hot }: { hot: boolean }) {
  const k = hot ? 1.2 : 1;
  const mark = gizmoMat('#ffffff', true);
  const head = (a: number) => (
    <mesh key={a} position={[Math.cos(a) * 0.09, Math.sin(a) * 0.09, 0]} rotation={[0, 0, a]} material={mark} renderOrder={23} raycast={() => null}>
      <circleGeometry args={[0.045, 3]} />
    </mesh>
  );
  return (
    <group scale={k} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh material={gizmoMat(GIZMO_TEAL, hot)} renderOrder={21}>
        <circleGeometry args={[0.15, 32]} />
      </mesh>
      <group position={[0, 0, 0.002]}>
        <mesh material={mark} renderOrder={22} raycast={() => null}>
          <planeGeometry args={[0.17, 0.026]} />
        </mesh>
        <mesh material={mark} renderOrder={22} raycast={() => null}>
          <planeGeometry args={[0.026, 0.17]} />
        </mesh>
        {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map(head)}
      </group>
    </group>
  );
}

/** Proportional-scale tile: a square with a diagonal two-headed mark (corner to corner), lying flat. */
function ScaleTile({ hot }: { hot: boolean }) {
  const k = hot ? 1.2 : 1;
  const mark = gizmoMat('#ffffff', true);
  return (
    <group scale={k} rotation={[0, -Math.PI / 4, 0]}>
      <mesh rotation-x={-Math.PI / 2} material={gizmoMat(GIZMO_TEAL, hot)} renderOrder={23}>
        <planeGeometry args={[0.26, 0.26]} />
      </mesh>
      <group rotation={[-Math.PI / 2, 0, Math.PI / 4]} position={[0, 0.002, 0]}>
        <mesh material={mark} renderOrder={24} raycast={() => null}>
          <planeGeometry args={[0.03, 0.2]} />
        </mesh>
        <mesh position={[0, 0.1, 0]} rotation={[0, 0, Math.PI / 2]} material={mark} renderOrder={24} raycast={() => null}>
          <circleGeometry args={[0.05, 3]} />
        </mesh>
        <mesh position={[0, -0.1, 0]} rotation={[0, 0, -Math.PI / 2]} material={mark} renderOrder={24} raycast={() => null}>
          <circleGeometry args={[0.05, 3]} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * Two-headed resize arrow on the move arrow's own line, just behind it (the arrow's frame points
 * along +y, so this runs from -0.1 to -0.62): same colour, thinner, with a head at each end.
 */
function ResizeArrow({ color, hot }: { color: string; hot: boolean }) {
  const mat = gizmoMat(color, hot);
  const r = hot ? 1.35 : 1;
  return (
    <>
      <mesh position={[0, -0.36, 0]} material={mat} renderOrder={20}>
        <cylinderGeometry args={[0.016 * r, 0.016 * r, 0.34, 8]} />
      </mesh>
      <mesh position={[0, -0.16, 0]} material={mat} renderOrder={20}>
        <coneGeometry args={[0.055 * r, 0.12, 14]} />
      </mesh>
      <mesh position={[0, -0.56, 0]} rotation={[0, 0, Math.PI]} material={mat} renderOrder={20}>
        <coneGeometry args={[0.055 * r, 0.12, 14]} />
      </mesh>
      <mesh position={[0, -0.36, 0]} material={hitMat}>
        <cylinderGeometry args={[0.08, 0.08, 0.52, 8]} />
      </mesh>
    </>
  );
}

/**
 * Transform gizmo for selected furniture: X/Z arrows slide along the floor,
 * the Y arrow changes elevation, the centre icon moves freely, the ring
 * rotates (a whole selection turns about its centre) and the tile outside the ring scales a single item proportionally (5 %
 * steps; Alt for free scaling). Behind each arrow, on its line, a two-headed arrow resizes a single item:
 * X and Z change the width or depth (whichever lines up with the arrow), the up arrow's tab the height.
 * The face on the arrow's side moves and the opposite face stays put; Alt resizes from the centre.
 * Sizes snap to 1 cm and keep to the item's limits. Handles keep a constant on-screen size. Snaps to
 * the grid (Alt for free movement); each drag is a single undo step.
 */
export function TransformGizmo({ controlsRef }: { controlsRef: React.MutableRefObject<OrbitControlsImpl | null> }) {
  const project = useProjectStore((s) => s.project!);
  const selection = useEditorStore((s) => s.selection);
  const gl = useThree((s) => s.gl);
  const get = useThree((s) => s.get);
  const scene = useThree((s) => s.scene);
  const [hot, setHot] = useState<string | null>(null);
  const [readout, setReadout] = useState<string | null>(null);
  const [tip, setTip] = useState<{ text: string; at: THREE.Vector3 } | null>(null);
  const scaled = useRef<THREE.Group[]>([]);
  const centerRef = useRef(new THREE.Vector3());

  const openingSel = selection.length === 1 && selection[0].kind === 'opening' ? project.openings[selection[0].id] : null;
  const objs = selection
    .filter((s) => s.kind === 'object')
    .map((s) => project.objects[s.id])
    .filter((o): o is NonNullable<typeof o> => !!o && !isObjectLocked(project, o));
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

  if (openingSel) return <OpeningGizmo openingId={openingSel.id} controlsRef={controlsRef} />;
  if (selection.length === 1 && selection[0].kind === 'service' && project.servicePoints?.[selection[0].id])
    return <ServicePointGizmo pointId={selection[0].id} controlsRef={controlsRef} />;
  if (!n || locked) return null;
  const single = n === 1 ? objs[0] : null;
  // The ring wraps the item, or the whole selection (every item's far corner) for a group.
  const ringR = single
    ? Math.max(single.width, single.depth) / 2 + 0.22
    : Math.max(0.3, ...objs.map((o) => Math.hypot(o.x - cx, o.y - cz) + Math.hypot(o.width, o.depth) / 2)) + 0.22;
  const units = project.settings;

  const scaleAsset = single ? getAsset(project, single.assetId) : null;
  const scalable = !!scaleAsset && canScale(scaleAsset) && !project.customAssets[single!.assetId];
  // Per-axis resize grips, for the dimensions the item lets you change.
  const resizable = single && scaleAsset && !project.customAssets[single.assetId] ? scaleAsset.resizable : null;

  const startDrag = (e: ThreeEvent<PointerEvent>, mode: Axis | 'free' | 'rotate' | 'scale' | ResizeAxis) => {
    console.debug('[gizmo] down', mode, e.button);
    if (e.button !== 0) return;
    e.stopPropagation();
    const ids = objs.map((o) => o.id);
    const start = new Map(objs.map((o) => [o.id, { x: o.x, y: o.y, e: o.elevation, r: o.rotation, w: o.width, d: o.depth, h: o.height }]));
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
    const r0 = Math.max(0.05, Math.hypot(hit0.x - cx, hit0.z - cz));
    // The free move keeps to one axis while Shift is held.
    const resizing = !!single && (mode === 'rx' || mode === 'rz' || mode === 'ry');
    const grip = resizing
      ? { origin: new THREE.Vector3(cx, mode === 'ry' ? top : base, cz), dir: new THREE.Vector3(mode === 'rx' ? 1 : 0, mode === 'ry' ? 1 : 0, mode === 'rz' ? 1 : 0) }
      : null;
    const g0 = grip ? closestOnLine(e.ray.origin, e.ray.direction, grip.origin, grip.dir) : null;
    const lock = createAxisLock();
    const lockFx = mode === 'free' ? axisLockFeedback3D(scene) : null;
    if (controlsRef.current) controlsRef.current.enabled = false;
    useProjectStore
      .getState()
      .begin(
        mode === 'rotate'
          ? n > 1
            ? 'Rotate objects'
            : 'Rotate object'
          : mode === 'scale'
            ? 'Scale object'
            : mode === 'rx' || mode === 'rz' || mode === 'ry'
              ? `Change ${RESIZE_LABEL[resizeKey(single?.rotation ?? 0, mode)].toLowerCase()}`
              : mode === 'y'
                ? 'Change elevation'
                : n > 1
                  ? 'Move objects'
                  : 'Move object',
      );
    setHot(mode);
    setTip(null);
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
      if (mode === 'rotate') {
        // A group turns about its centre: positions swing round it, each item turns by the same angle.
        const p = new THREE.Vector3();
        if (!ray.intersectPlane(floor, p)) return;
        let da = Math.atan2(p.z - cz, p.x - cx) - a0;
        if (!ev.altKey) da = Math.round(da / (Math.PI / 12)) * (Math.PI / 12);
        const c = Math.cos(da);
        const sn = Math.sin(da);
        setReadout(`Rotate ${da >= 0 ? '+' : '−'}${Math.round((Math.abs(da) * 180) / Math.PI)}°`);
        useProjectStore.getState().preview((d) => {
          for (const id of ids) {
            const s0 = start.get(id)!;
            const dx = s0.x - cx;
            const dz = s0.y - cz;
            const o = d.objects[id];
            o.x = cx + dx * c - dz * sn;
            o.y = cz + dx * sn + dz * c;
            o.rotation = normalizeRotation(s0.r + da);
          }
        });
        return;
      }
      if (mode === 'scale' && single && scaleAsset) {
        const p = new THREE.Vector3();
        if (!ray.intersectPlane(floor, p)) return;
        let k = Math.hypot(p.x - cx, p.z - cz) / r0;
        const s0 = start.get(single.id)!;
        const pct0 = scalePct({ width: s0.w, depth: s0.d, height: s0.h }, scaleAsset);
        // Snap the resulting size to 5 % of the default size.
        if (!ev.altKey) k = Math.max(0.05, Math.round((pct0 * k) / 5) * 5) / pct0;
        const next = scaledSize({ width: s0.w, depth: s0.d, height: s0.h }, scaleAsset, k);
        setReadout(`Scale ${Math.round(scalePct({ width: next.width ?? s0.w, depth: next.depth ?? s0.d, height: next.height ?? s0.h }, scaleAsset))}%`);
        useProjectStore.getState().preview((d) => updateObjects(d, [single.id], next));
        return;
      }
      if (grip && g0 !== null && single && scaleAsset && (mode === 'rx' || mode === 'rz' || mode === 'ry')) {
        const t = closestOnLine(ray.origin, ray.direction, grip.origin, grip.dir);
        if (t === null) return;
        const s0 = start.get(single.id)!;
        const key = resizeKey(s0.r, mode);
        const dim = key === 'width' ? 'w' : key === 'depth' ? 'd' : 'h';
        const size0 = s0[dim];
        // One-sided: the size grows by the drag; from the centre (Alt) by twice the drag.
        const centred = ev.altKey && mode !== 'ry';
        let size = size0 + (t - g0) * (centred ? 2 : 1);
        const lo = scaleAsset.minSize?.[dim] ?? 0.02;
        const hi = scaleAsset.maxSize?.[dim] ?? 20;
        size = Math.min(hi, Math.max(lo, Math.round(size * 100) / 100));
        const grow = size - size0;
        setReadout(`${RESIZE_LABEL[key]} ${formatLength(size, units.units, units.precision)}`);
        useProjectStore.getState().preview((d) => {
          const o = d.objects[single.id];
          o[key] = size;
          // Keep the opposite face where it was: the centre moves by half the growth.
          if (!centred && mode !== 'ry') {
            o.x = s0.x + (grip.dir.x * grow) / 2;
            o.y = s0.y + (grip.dir.z * grow) / 2;
          }
        });
        return;
      }
      if (mode === 'free') {
        const p = new THREE.Vector3();
        if (!ray.intersectPlane(floor, p)) return;
        const moved = lock.apply({ x: p.x - hit0.x, y: p.z - hit0.z }, ev.shiftKey);
        let dx = moved.x;
        let dz = moved.y;
        if (snap) {
          const c = snapOnAxis({ x: cx + dx, y: cz + dz }, { x: cx, y: cz }, lock.axis, grid / 2);
          dx = c.x - cx;
          dz = c.y - cz;
        }
        lockFx?.update(lock.axis, { x: cx, y: cz }, base + 0.02);
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
      lockFx?.clear();
      setHot(null);
      setReadout(null);
      if (controlsRef.current) controlsRef.current.enabled = true;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const tipText = (id: string): string => {
    switch (id) {
      case 'x':
      case 'z':
        return `Move along ${id.toUpperCase()}`;
      case 'y':
        return 'Raise or lower';
      case 'free':
        return 'Move · Shift: one axis · Alt: no snapping';
      case 'rotate':
        return n > 1 ? 'Rotate the selection · Alt: any angle' : 'Rotate · Alt: any angle';
      case 'scale':
        return 'Scale proportionally · Alt: no 5 % steps';
      default: {
        const key = resizeKey(single?.rotation ?? 0, id as ResizeAxis);
        return `Resize ${RESIZE_LABEL[key].toLowerCase()}${id === 'ry' ? '' : ' · Alt: from the centre'}`;
      }
    }
  };
  const hover = (id: string) => ({
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      setHot((h) => h ?? id);
      setTip({ text: tipText(id), at: e.point.clone() });
      gl.domElement.style.cursor = id === 'rotate' ? 'grab' : id === 'scale' ? 'nesw-resize' : id === 'rx' ? 'ew-resize' : id === 'rz' || id === 'ry' ? 'ns-resize' : 'move';
    },
    onPointerMove: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      setTip((t) => (t && t.text === tipText(id) ? { text: t.text, at: e.point.clone() } : t));
    },
    onPointerOut: () => {
      setHot((h) => (h === id ? null : h));
      setTip((t) => (t && t.text === tipText(id) ? null : t));
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
        {single && resizable?.[resizeKey(single!.rotation, 'rx') === 'width' ? 'w' : resizeKey(single!.rotation, 'rx') === 'depth' ? 'd' : 'h'] && (
          <group onPointerDown={(e) => startDrag(e, 'rx')} {...hover('rx')}>
            <ResizeArrow color={AXIS_COLORS.x} hot={hot === 'rx'} />
          </group>
        )}
      </group>
      {/* Z arrow (towards the bottom of the plan) */}
      <group position={[cx, base + 0.03, cz + ringR]} rotation={[Math.PI / 2, 0, 0]} ref={keep} onPointerDown={(e) => startDrag(e, 'z')} {...hover('z')}>
        <ArrowShape color={AXIS_COLORS.z} hot={hot === 'z'} />
        {single && resizable?.[resizeKey(single!.rotation, 'rz') === 'width' ? 'w' : resizeKey(single!.rotation, 'rz') === 'depth' ? 'd' : 'h'] && (
          <group onPointerDown={(e) => startDrag(e, 'rz')} {...hover('rz')}>
            <ResizeArrow color={AXIS_COLORS.z} hot={hot === 'rz'} />
          </group>
        )}
      </group>
      {/* Y arrow (elevation) */}
      <group position={[cx, top + 0.04, cz]} ref={keep} onPointerDown={(e) => startDrag(e, 'y')} {...hover('y')}>
        <ArrowShape color={AXIS_COLORS.y} hot={hot === 'y'} />
        {single && resizable?.[resizeKey(single!.rotation, 'ry') === 'width' ? 'w' : resizeKey(single!.rotation, 'ry') === 'depth' ? 'd' : 'h'] && (
          <group onPointerDown={(e) => startDrag(e, 'ry')} {...hover('ry')}>
            <ResizeArrow color={AXIS_COLORS.y} hot={hot === 'ry'} />
          </group>
        )}
      </group>
      {/* Centre: four-way move icon, free move on the floor */}
      <group position={[cx, base + 0.03, cz]} ref={keep} onPointerDown={(e) => startDrag(e, 'free')} {...hover('free')}>
        <MoveIcon hot={hot === 'free'} />
      </group>
      {n > 0 && (
        <group position={[cx, base + 0.025, cz]} rotation={[0, -(single?.rotation ?? 0), 0]}>
          <mesh rotation-x={-Math.PI / 2} onPointerDown={(e) => startDrag(e, 'rotate')} {...hover('rotate')} material={gizmoMat(GIZMO_TEAL, hot === 'rotate')} renderOrder={19}>
            <torusGeometry args={[ringR, hot === 'rotate' ? 0.04 : 0.026, 10, 72]} />
          </mesh>
          <mesh position={[0, 0, ringR]} rotation-x={-Math.PI / 2} material={gizmoMat(GIZMO_TEAL, true)} renderOrder={19} raycast={() => null}>
            <circleGeometry args={[0.06, 20]} />
          </mesh>
          {single && scalable && (
            // Scale handle: a tile just outside the ring (front-right), clear of the rotation ring.
            <group position={[ringR * Math.SQRT1_2, 0.004, ringR * Math.SQRT1_2]} rotation={[0, Math.PI / 4, 0]} ref={keep}>
              <group position={[0, 0, 0.36]} onPointerDown={(e) => startDrag(e, 'scale')} {...hover('scale')}>
                <ScaleTile hot={hot === 'scale'} />
              </group>
            </group>
          )}
        </group>
      )}
      {tip && !readout && (
        <Html position={tip.at} style={{ pointerEvents: 'none' }} zIndexRange={[40, 30]}>
          <div className="gizmo-tip">{tip.text}</div>
        </Html>
      )}
      {readout && (
        <Html position={[cx, top + 0.6, cz]} center style={{ pointerEvents: 'none' }}>
          <div className="label3d accent">{readout}</div>
        </Html>
      )}
    </group>
  );
}

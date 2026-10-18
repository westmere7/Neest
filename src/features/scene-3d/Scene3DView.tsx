import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { openContextMenu } from '@/components/ContextMenu';
import { planContextMenuItems } from '@/features/plan-2d/contextMenu';
import * as THREE from 'three';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Footprints,
  Home,
  ImageDown,
  PanelLeftClose,
  Pencil,
  RefreshCw,
  Save,
  Trash2,
} from 'lucide-react';
import type { PlacedObject, Project, RenderSettings, WallDisplay } from '@/domain/model/schema';
import { derivePlan, type DerivedPlan } from '@/domain/geometry/derive';
import { round } from '@/domain/geometry/vec';
import {
  addCameraPreset,
  deleteCameraPreset,
  updateCameraPreset,
  withGroupMates,
} from '@/domain/commands/entities';
import { getAsset } from '@/data/assets/registry';
import { ASSET_CATEGORY_LABELS, ASSET_CATEGORY_ORDER, CEILING_CATEGORY } from '@/data/assets/catalog';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore } from '@/state/editorStore';
import { toast, useDialogStore, usePrefsStore } from '@/state/uiStores';
import { Button, IconButton, Segmented, Slider, Toggle } from '@/components/ui';
import { useIsMobile } from '@/components/hooks';
import { WALL_HUG_MOVE, hugWall } from '@/features/plan-2d/tools/placeTools';
import { FloorReflections } from './floorReflections';
import { selectionBounds } from '@/features/editor/selectionBounds';
import { WalkControls, toggleWalkFly, useWalkFly } from '@/features/walkthrough/WalkControls';
import { TouchControls } from '@/features/walkthrough/TouchControls';
import { SceneContent, Lighting, type SceneOptions } from './SceneContent';
import { PostEffects } from './PostEffects';
import { InfiniteGrid } from './InfiniteGrid';
import { GlobalIllumination } from './globalIllumination';
import { namedView, presetView, type CameraView, type NamedView } from './cameraViews';
import { liveScene, sharedRegistry } from './sceneRuntime';
import { hitsGizmo, TransformGizmo, ToolBridge3D } from './edit3d';
import { clientCompute, useCanvasMeasureFix } from './useCanvasMeasureFix';
import { floatingInsets } from '@/components/layoutInsets';
import { SceneLoading, type SceneLoadStage } from './SceneLoading';
import './scene3d.css';
import { movedElevation } from '@/features/plan-2d/tools/surfaces';

type Projection = 'perspective' | 'orthographic';

/**
 * Keeps camera + controls in sync with view requests. Pending views are
 * applied from the frame loop once the active camera has the requested
 * projection and OrbitControls has been rebuilt for it, so projection
 * switches (perspective ↔ orthographic) never drop a request.
 */
/**
 * Moves the camera's projection centre into the middle of the canvas area not
 * covered by floating panels (like map padding). Orbiting, zooming and fitted
 * views then centre on what the user can actually see, while the orbit pivot
 * stays on the model. Eases when panels open or close; cleared on unmount.
 */
function FreeAreaOffset() {
  const get = useThree((s) => s.get);
  const cur = useRef<{ x: number; y: number; cam: THREE.Camera | null }>({ x: 0, y: 0, cam: null });
  const goal = useRef({ x: 0, y: 0 });
  const frame = useRef(0);
  useFrame((_, dt) => {
    const { camera, gl, size } = get();
    const c = cur.current;
    const fresh = c.cam !== camera;
    if (fresh || frame.current++ % 6 === 0) {
      const ins = floatingInsets(gl.domElement.getBoundingClientRect());
      goal.current = { x: (ins.l - ins.r) / 2, y: (ins.t - ins.b) / 2 };
    }
    const g = goal.current;
    const k = fresh ? 1 : Math.min(1, dt * 9);
    const nx = Math.abs(g.x - c.x) < 0.1 ? g.x : c.x + (g.x - c.x) * k;
    const ny = Math.abs(g.y - c.y) < 0.1 ? g.y : c.y + (g.y - c.y) * k;
    const view = (camera as THREE.PerspectiveCamera).view;
    const stale = !view || !view.enabled || view.fullWidth !== size.width || view.fullHeight !== size.height;
    if (!fresh && !stale && nx === c.x && ny === c.y) return;
    c.x = nx;
    c.y = ny;
    c.cam = camera;
    (camera as THREE.PerspectiveCamera | THREE.OrthographicCamera).setViewOffset(
      size.width,
      size.height,
      -nx,
      -ny,
      size.width,
      size.height,
    );
  });
  useEffect(
    () => () => {
      const cam = get().camera as THREE.PerspectiveCamera | THREE.OrthographicCamera;
      cam.clearViewOffset?.();
    },
    [get],
  );
  return null;
}

/** Cheap signature of the panel insets around a canvas, to notice layout changes. */
function insetsKey(el: HTMLElement): string {
  const r = el.getBoundingClientRect();
  const i = floatingInsets(r);
  return [r.width, r.height, i.l, i.r, i.t, i.b].map(Math.round).join(',');
}

function CameraDirector({ view }: { view: { v: CameraView; nonce: number } | null }) {
  const get = useThree((s) => s.get);
  const gl = useThree((s) => s.gl);
  const anim = useRef<{
    from: THREE.Vector3;
    to: THREE.Vector3;
    tFrom: THREE.Vector3;
    tTo: THREE.Vector3;
    t: number;
  } | null>(null);
  const applied = useRef<number>(-1);
  const pending = useRef(view);
  pending.current = view;
  // For a short while after a fitted view is applied, re-frame it if the floating
  // panels are still mounting or resizing (until the user grabs the camera).
  const settle = useRef<{ until: number; key: string; moved: boolean } | null>(null);
  const reframe = useRef(false);
  const orbit = useThree((s) => s.controls) as unknown as OrbitControlsImpl | null;
  useEffect(() => {
    if (!orbit) return;
    const onStart = () => {
      if (settle.current) settle.current.moved = true;
    };
    orbit.addEventListener('start', onStart);
    return () => orbit.removeEventListener('start', onStart);
  }, [orbit]);
  useFrame((_, dt) => {
    const { camera, controls, size } = get();
    const ctrl = controls as unknown as OrbitControlsImpl | null;
    const req = pending.current;
    const st = settle.current;
    if (st && req && applied.current === req.nonce) {
      if (st.moved || performance.now() > st.until) settle.current = null;
      else if (insetsKey(gl.domElement) !== st.key) {
        reframe.current = true;
        applied.current = -1; // re-apply as a jump
      }
    }
    if (
      req &&
      applied.current !== req.nonce &&
      ctrl &&
      (ctrl as unknown as { object: THREE.Camera }).object === camera
    ) {
      const v = req.v;
      const isPersp = (camera as THREE.PerspectiveCamera).isPerspectiveCamera === true;
      if (isPersp === (v.projection === 'perspective')) {
        const first = applied.current < 0;
        if (v.fitSphere || v.fitOrtho) {
          const key = insetsKey(gl.domElement);
          settle.current =
            reframe.current && settle.current
              ? { ...settle.current, key }
              : { until: performance.now() + (first ? 1200 : 700), key, moved: false };
        } else settle.current = null;
        reframe.current = false;
        applied.current = req.nonce;
        let to = new THREE.Vector3(...v.position);
        let tTo = new THREE.Vector3(...v.target);
        if (v.fitSphere && isPersp) {
          // Frame the plan inside the part of the canvas not covered by floating panels.
          const host = gl.domElement.getBoundingClientRect();
          const ins = floatingInsets(host);
          const W = Math.max(1, host.width);
          const Hc = Math.max(1, host.height);
          const freeW = Math.max(80, W - ins.l - ins.r);
          const freeH = Math.max(80, Hc - ins.t - ins.b);
          const tanV = Math.tan((v.fov * Math.PI) / 360);
          const halfV = Math.atan(tanV * (freeH / Hc));
          const halfH = Math.atan(tanV * (W / Hc) * (freeW / W));
          const dist = (v.fitSphere.radius / Math.sin(Math.min(halfV, halfH))) * 1.06;
          const dir = new THREE.Vector3(...v.fitSphere.dir).normalize();
          const centre = new THREE.Vector3(...v.fitSphere.center);
          // FreeAreaOffset puts the projection centre in the middle of the free area,
          // so the orbit pivot stays on the plan while it is framed beside the panels.
          to = centre.clone().addScaledVector(dir, dist);
          tTo = centre.clone();
        }
        if (isPersp) {
          const pc = camera as THREE.PerspectiveCamera;
          pc.fov = v.fov;
          pc.updateProjectionMatrix();
        } else {
          const oc = camera as THREE.OrthographicCamera;
          if (v.fitOrtho) {
            const ins = floatingInsets(gl.domElement.getBoundingClientRect());
            const freeW = Math.max(80, size.width - ins.l - ins.r);
            const freeH = Math.max(80, size.height - ins.t - ins.b);
            oc.zoom = Math.max(2, Math.min(freeW / v.fitOrtho.width, freeH / v.fitOrtho.depth));
          } else oc.zoom = v.zoom;
          oc.updateProjectionMatrix();
        }
        const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        // Animate only perspective moves within the same camera; jump otherwise.
        if (reduce || first || !isPersp) {
          anim.current = null;
          camera.position.copy(to);
          ctrl.target.copy(tTo);
          ctrl.update();
        } else {
          anim.current = { from: camera.position.clone(), to, tFrom: ctrl.target.clone(), tTo, t: 0 };
        }
      }
    }
    const a = anim.current;
    if (!a || !ctrl) return;
    a.t = Math.min(1, a.t + dt / 0.5);
    const e = 1 - Math.pow(1 - a.t, 3);
    camera.position.lerpVectors(a.from, a.to, e);
    ctrl.target.lerpVectors(a.tFrom, a.tTo, e);
    ctrl.update();
    if (a.t >= 1) anim.current = null;
  });
  return null;
}

/**
 * Focus (Inspector header): the orbit pivot eases to the selection's centre and the camera closes in
 * along its current view direction until the selection fills a good part of the view.
 */
function FocusSelection() {
  const get = useThree((s) => s.get);
  const request = useEditorStore((s) => s.focusRequest);
  const anim = useRef<{ p0: THREE.Vector3; p1: THREE.Vector3; t0: THREE.Vector3; t1: THREE.Vector3; t: number } | null>(null);
  useEffect(() => {
    if (!request) return;
    const project = useProjectStore.getState().project;
    const ctrl = get().controls as unknown as OrbitControlsImpl | null;
    const camera = get().camera as THREE.PerspectiveCamera;
    if (!project || !ctrl) return;
    const b = selectionBounds(project, derivePlan(project), useEditorStore.getState().selection);
    if (!b) return;
    const centre = new THREE.Vector3((b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2, (b.minY + b.maxY) / 2);
    const radius = Math.max(0.35, 0.5 * Math.hypot(b.maxX - b.minX, b.maxY - b.minY, b.maxZ - b.minZ));
    const dir = camera.position.clone().sub(ctrl.target);
    if (dir.lengthSq() < 1e-6) dir.set(1, 1, 1);
    dir.normalize();
    const fov = camera.isPerspectiveCamera ? THREE.MathUtils.degToRad(camera.fov) : Math.PI / 4;
    const distance = Math.max(0.8, (radius / Math.sin(fov / 2)) * 1.25);
    const p1 = centre.clone().addScaledVector(dir, distance);
    p1.y = Math.max(p1.y, centre.y + 0.2);
    anim.current = { p0: camera.position.clone(), p1, t0: ctrl.target.clone(), t1: centre, t: 0 };
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) anim.current.t = 0.999;
  }, [request, get]);
  useFrame((_, dt) => {
    const a = anim.current;
    const ctrl = get().controls as unknown as OrbitControlsImpl | null;
    if (!a || !ctrl) return;
    a.t = Math.min(1, a.t + dt / 0.45);
    const e = 1 - Math.pow(1 - a.t, 3);
    get().camera.position.lerpVectors(a.p0, a.p1, e);
    ctrl.target.lerpVectors(a.t0, a.t1, e);
    ctrl.update();
    if (a.t >= 1) anim.current = null;
  });
  return null;
}

/**
 * Makes the selected furniture the orbit pivot: when the selection changes to
 * include objects, the orbit target eases to their centre and the camera pans
 * along with it (same offset, so the view direction never changes), so dragging
 * orbits around the selection and the wheel zooms toward it. Clearing the
 * selection leaves the pivot as is. Only with the "Centre camera on selection"
 * preference (off by default).
 */
function SelectionPivot() {
  const get = useThree((s) => s.get);
  const enabled = usePrefsStore((s) => s.focusSelection);
  const key = useEditorStore((s) =>
    !enabled
      ? ''
      : s.selection
          .filter((x) => x.kind === 'object')
          .map((x) => x.id)
          .sort()
          .join(','),
  );
  const anim = useRef<{ from: THREE.Vector3; to: THREE.Vector3; t: number } | null>(null);
  useEffect(() => {
    if (!key) return;
    const project = useProjectStore.getState().project;
    const ctrl = get().controls as unknown as OrbitControlsImpl | null;
    if (!project || !ctrl) return;
    const box = new THREE.Box3();
    for (const id of key.split(',')) {
      const o = project.objects[id];
      if (!o || o.hidden) continue;
      box.expandByPoint(new THREE.Vector3(o.x, o.elevation, o.y));
      box.expandByPoint(new THREE.Vector3(o.x, o.elevation + o.height, o.y));
    }
    if (box.isEmpty()) return;
    const to = box.getCenter(new THREE.Vector3());
    if (to.distanceTo(ctrl.target) < 0.01) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      get().camera.position.add(to.clone().sub(ctrl.target));
      ctrl.target.copy(to);
      ctrl.update();
      anim.current = null;
    } else anim.current = { from: ctrl.target.clone(), to, t: 0 };
  }, [key, get]);
  useFrame((_, dt) => {
    const a = anim.current;
    const ctrl = get().controls as unknown as OrbitControlsImpl | null;
    if (!a || !ctrl) return;
    a.t = Math.min(1, a.t + dt / 0.35);
    const e = 1 - Math.pow(1 - a.t, 3);
    const before = ctrl.target.clone();
    ctrl.target.lerpVectors(a.from, a.to, e);
    // Pan, don't turn: the camera moves by exactly what the pivot moved.
    get().camera.position.add(ctrl.target.clone().sub(before));
    ctrl.update();
    if (a.t >= 1) anim.current = null;
  });
  return null;
}

/** Exposes renderer/scene/camera for captures and handles helper visibility. */
function LiveBridge({ helpersRef }: { helpersRef: React.MutableRefObject<THREE.Group | null> }) {
  const { gl, scene, camera, controls } = useThree();
  useEffect(() => {
    liveScene.current = {
      gl,
      scene,
      camera,
      controlsTarget: () => (controls as unknown as OrbitControlsImpl | null)?.target ?? null,
      setHelpersVisible: (v) => {
        if (helpersRef.current) helpersRef.current.visible = v;
        scene.traverse((o) => {
          if ((o as THREE.Box3Helper).type === 'Box3Helper' || o.userData.helper) o.visible = v;
        });
      },
    };
    return () => {
      if (liveScene.current?.gl === gl) liveScene.current = null;
    };
  }, [gl, scene, camera, controls, helpersRef]);
  return null;
}

/** Drag selected furniture on the floor plane in 3D (with grid snapping and wall hugging). */
function useObjectDrag(project: Project, derived: DerivedPlan, enabled: boolean) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const latest = useRef({ project, derived });
  latest.current = { project, derived };
  const onObjectPointerDown = useCallback(
    (obj: PlacedObject, e: ThreeEvent<PointerEvent>) => {
      const live = liveScene.current;
      if (!enabled || e.button !== 0 || !live || hitsGizmo(e)) return;
      const sel = useEditorStore.getState().selection;
      if (!sel.some((s) => s.id === obj.id) || obj.locked || latest.current.project.layers.furniture.locked)
        return;
      e.stopPropagation();
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -obj.elevation);
      const hit = new THREE.Vector3();
      if (!e.ray.intersectPlane(plane, hit)) return;
      const offset = { x: obj.x - hit.x, y: obj.y - hit.z };
      // Grouped items move together (no wall hugging for a group).
      const mates = withGroupMates(latest.current.project, [obj.id]).filter(
        (id) => !latest.current.project.objects[id]?.locked,
      );
      const starts = Object.fromEntries(
        mates.map((id) => [
          id,
          { x: latest.current.project.objects[id].x, y: latest.current.project.objects[id].y },
        ]),
      );
      const raycaster = new THREE.Raycaster();
      const el = live.gl.domElement;
      let started = false;
      if (controlsRef.current) controlsRef.current.enabled = false;
      const move = (ev: PointerEvent) => {
        const rect = el.getBoundingClientRect();
        const ndc = new THREE.Vector2(
          ((ev.clientX - rect.left) / rect.width) * 2 - 1,
          -((ev.clientY - rect.top) / rect.height) * 2 + 1,
        );
        raycaster.setFromCamera(ndc, live.camera);
        const p = new THREE.Vector3();
        if (!raycaster.ray.intersectPlane(plane, p)) return;
        if (!started) {
          useProjectStore.getState().begin('Move object');
          started = true;
        }
        const { project: pr, derived: dv } = latest.current;
        let x = p.x + offset.x;
        let y = p.z + offset.y;
        const grid = pr.settings.gridSize;
        if (useEditorStore.getState().snap.grid && !ev.altKey) {
          x = round(x, grid / 2);
          y = round(y, grid / 2);
        }
        const asset = getAsset(pr, obj.assetId);
        let rotation = obj.rotation;
        if (asset && mates.length < 2 && (asset.wallSnap || asset.mount === 'wall') && !ev.altKey) {
          const h = hugWall(dv, { x, y }, obj.depth, asset.mount === 'wall' ? 0.6 : WALL_HUG_MOVE);
          if (h) {
            x = h.x;
            y = h.y;
            rotation = h.rotation;
          }
        }
        useProjectStore.getState().preview((dr) => {
          if (mates.length > 1) {
            for (const id of mates) {
              const m = dr.objects[id];
              if (m) {
                m.x = starts[id].x + (x - obj.x);
                m.y = starts[id].y + (y - obj.y);
              }
            }
            return;
          }
          const o = dr.objects[obj.id];
          if (o) {
            o.x = x;
            o.y = y;
            o.rotation = rotation;
            // Small items step onto (or off) the tables and counters they are moved over.
            const base = useProjectStore.getState().tx?.base;
            const lift = base ? movedElevation(base, obj.id, x, y) : undefined;
            if (lift !== undefined) o.elevation = lift;
          }
        });
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        if (started) useProjectStore.getState().commit();
        if (controlsRef.current) controlsRef.current.enabled = true;
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [enabled],
  );
  return { onObjectPointerDown, controlsRef };
}

/**
 * `active` false = kept mounted behind the 2D plan (see EditorShell): drawing pauses, the scene keeps
 * the project as it was when hidden (2D edits do not rebuild it) and catches up when shown again.
 */
export default function Scene3DView({ mode, active = true }: { mode: 'orbit' | 'walk'; active?: boolean }) {
  const [hiddenProject, setHiddenProject] = useState<Project | null>(null);
  const project = useProjectStore(useCallback((s) => (active || !hiddenProject ? s.project! : hiddenProject), [active, hiddenProject]));
  useEffect(() => {
    // Hiding freezes the project the scene was last built from; showing again releases it.
    if (!active) setHiddenProject(useProjectStore.getState().project);
    else setHiddenProject(null);
  }, [active]);
  const derived = useMemo(() => derivePlan(project), [project]);
  const selection = useEditorStore((s) => s.selection);
  const cameraRequest = useEditorStore((s) => s.cameraRequest);
  const chromeHidden = useEditorStore((s) => s.chromeHidden);
  const workspace = useEditorStore((s) => s.workspace);
  const tool = useEditorStore((s) => s.tool);
  const viewPanelOpen = useEditorStore((s) => s.viewPanelOpen);
  const isMobile = useIsMobile();
  useCanvasMeasureFix();
  const [projection, setProjection] = useState<Projection>('perspective');
  const [view, setView] = useState<{ v: CameraView; nonce: number } | null>(() => ({
    v: initialView(derived, project.render.fov),
    nonce: 1,
  }));
  const [showDims, setShowDims] = useState(false);
  const [showHelpers, setShowHelpers] = useState(true);
  const helpersRef = useRef<THREE.Group>(null);
  const r = project.render;
  const walk = mode === 'walk';
  sharedRegistry.normalMaps = r.quality !== 'draft';

  const goTo = useCallback((v: CameraView) => {
    setProjection(v.projection);
    setView((prev) => ({ v, nonce: (prev?.nonce ?? 0) + 1 }));
  }, []);

  useEffect(() => {
    if (!cameraRequest) return;
    const preset = project.cameras.find((c) => c.id === cameraRequest.view);
    if (preset) {
      goTo(presetView(preset));
      const wall =
        preset.wallDisplay && preset.wallDisplay !== project.render.wallDisplay ? preset.wallDisplay : null;
      const fov =
        preset.projection === 'perspective' && Math.abs(preset.fov - project.render.fov) > 0.01
          ? preset.fov
          : null;
      if (wall || fov != null)
        useProjectStore.getState().execute('Apply view', (d) => {
          if (wall) d.render.wallDisplay = wall;
          if (fov != null) d.render.fov = clampFov(fov);
        });
    } else goTo({ ...namedView(cameraRequest.view as NamedView, derived.bounds), fov: project.render.fov });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraRequest]);

  useEffect(() => {
    if (!walk && view === null) goTo(namedView('home', derived.bounds));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walk]);

  // A drafting tool is active in 3D: left button belongs to the tool, orbit moves to the right button.
  const drawing = !walk && workspace === '3d' && tool !== 'select' && tool !== 'pan';
  const drag = useObjectDrag(project, derived, !walk && !drawing);
  const selectedIds = useMemo(() => new Set(selection.map((s) => s.id)), [selection]);
  // Right-click: the same menu as in the plan, for the item under the pointer (not after a right-drag orbit/pan).
  const rightDown = useRef<{ x: number; y: number } | null>(null);
  const menuShown = useRef(0);
  const rightDragged = (ev: MouseEvent) =>
    !!rightDown.current && Math.hypot(ev.clientX - rightDown.current.x, ev.clientY - rightDown.current.y) > 5;
  const onPick = useCallback<NonNullable<SceneOptions['onPick']>>((kind, id, e) => {
    if (hitsGizmo(e)) return; // the transform gizmo owns this pointer
    const ed = useEditorStore.getState();
    const item = { kind, id } as const;
    if (e.nativeEvent.type === 'contextmenu') {
      e.nativeEvent.preventDefault();
      if (rightDragged(e.nativeEvent)) return;
      if (!ed.selection.some((s) => s.id === id)) ed.setSelection([item]);
      const items = planContextMenuItems(item, { x: e.point.x, y: e.point.z });
      if (items.length) {
        menuShown.current = e.nativeEvent.timeStamp;
        openContextMenu(e.nativeEvent.clientX, e.nativeEvent.clientY, items);
      }
      return;
    }
    if (e.shiftKey) ed.toggleSelection(item);
    else ed.setSelection([item]);
    // Double-click an item: close in on it and orbit around it.
    if (!e.shiftKey && e.nativeEvent.detail >= 2 && (kind === 'object' || kind === 'opening')) ed.requestFocus();
  }, []);

  const options: SceneOptions = {
    wallDisplay: walk ? 'full' : r.wallDisplay,
    cutawayHeight: r.cutawayHeight,
    showCeilings: walk ? true : r.showCeilings,
    showRoomLabels: !walk && r.showRoomLabels,
    showDimensions: !walk && showDims,
    quality: r.quality,
    shadows: r.shadows,
    hiddenCategories: r.hiddenCategories,
    interactive: !walk,
    selectedIds: walk || !showHelpers ? undefined : selectedIds,
    onPick: walk || drawing ? undefined : onPick,
    onObjectPointerDown: walk || drawing ? undefined : drag.onObjectPointerDown,
  };

  const dpr: [number, number] =
    r.quality === 'ultra'
      ? [1.5, 2]
      : r.quality === 'high'
        ? [1, 2]
        : r.quality === 'balanced'
          ? [1, 1.5]
          : [0.75, 1];
  // The canvas stays covered by the loading screen until the scene has compiled and drawn.
  const [ready, setReady] = useState(false);
  const [compiled, setCompiled] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  const onCompiled = useCallback(() => setCompiled(true), []);
  const [stage, setStage] = useState<SceneLoadStage>('scene');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  // Switching quality changes lights, shadows and effects, so shaders recompile. The switch shows
  // at once; drawing pauses (last frame stays) under a light overlay until they compile in the
  // background, instead of freezing the page on the next frame. A layout effect runs before that
  // frame can be drawn.
  const [switching, setSwitching] = useState<RenderSettings['quality'] | null>(null);
  const lastQuality = useRef(r.quality);
  useLayoutEffect(() => {
    if (lastQuality.current === r.quality) return;
    lastQuality.current = r.quality;
    setSwitching(r.quality);
    setCompiled(false);
    setReady(false);
    setStage('materials');
  }, [r.quality]);
  useEffect(() => {
    if (ready) setSwitching(null);
  }, [ready]);
  const exitWalk = useCallback(() => useEditorStore.getState().set({ workspace: '3d' }), []);

  return (
    <div
      className="scene3d"
      data-testid="scene-3d"
      onPointerDown={(e) => {
        if (e.button === 2) rightDown.current = { x: e.clientX, y: e.clientY };
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        // An item already opened its menu for this click; otherwise offer the empty-space menu.
        if (walk || drawing || menuShown.current === e.nativeEvent.timeStamp || rightDragged(e.nativeEvent))
          return;
        const items = planContextMenuItems(null, { x: 0, y: 0 });
        if (items.length) openContextMenu(e.clientX, e.clientY, items);
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('application/x-neest-asset')) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }
      }}
      onDrop={(e) => {
        const assetId = e.dataTransfer.getData('application/x-neest-asset');
        const live = liveScene.current;
        if (!assetId || !live) return;
        e.preventDefault();
        const rect = live.gl.domElement.getBoundingClientRect();
        const ray = new THREE.Raycaster();
        ray.setFromCamera(
          new THREE.Vector2(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            -((e.clientY - rect.top) / rect.height) * 2 + 1,
          ),
          live.camera,
        );
        const p = new THREE.Vector3();
        if (ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p))
          window.dispatchEvent(new CustomEvent('neest:drop-asset', { detail: { assetId, x: p.x, y: p.z } }));
      }}
    >
      <Canvas
        shadows={{ type: THREE.PCFSoftShadowMap, enabled: r.shadows && r.quality !== 'draft' }}
        dpr={dpr}
        gl={{
          antialias: r.quality !== 'draft',
          alpha: true,
          preserveDrawingBuffer: import.meta.env.DEV,
          powerPreference: 'high-performance',
        }}
        // Hidden behind the plan: stop drawing, but let a first load finish in the background.
        frameloop={active || !ready ? 'always' : 'never'}
        onCreated={(state) => state.setEvents({ compute: clientCompute as never })}
        onPointerMissed={(e) => {
          if (!walk && !drawing && e.button === 0) useEditorStore.getState().clearSelection();
        }}
      >
        <color attach="background" args={[r.background]} />
        {!ready && (
          <FirstFrames
            key={r.quality}
            onCompiled={onCompiled}
            onReady={onReady}
            onStage={setStage}
            onProgress={setProgress}
          />
        )}
        <PostEffects quality={r.quality} selectedIds={options.selectedIds} paused={!compiled} />
        <GlobalIllumination enabled={r.quality === 'ultra' && ready} project={project} derived={derived} />
        <FloorReflections enabled={r.quality === 'ultra'} />
        {walk || projection === 'perspective' ? (
          <PerspectiveCamera
            makeDefault
            position={view?.v.position ?? [10, 10, 10]}
            fov={walk ? r.walkFov : (view?.v.fov ?? r.fov)}
            near={walk ? 0.05 : 0.1}
            far={600}
          />
        ) : (
          <OrthographicCamera
            makeDefault
            position={view?.v.position ?? [10, 10, 10]}
            zoom={view?.v.zoom ?? 40}
            near={-200}
            far={600}
          />
        )}
        {(walk || projection === 'perspective') && <FovSync fov={walk ? r.walkFov : r.fov} />}
        {!walk && (
          <OrbitControls
            ref={drag.controlsRef as unknown as React.Ref<OrbitControlsImpl>}
            makeDefault
            enableDamping
            dampingFactor={0.12}
            maxPolarAngle={Math.PI / 2 - 0.02}
            minDistance={0.4}
            maxDistance={250}
            mouseButtons={
              drawing
                ? { LEFT: -1 as THREE.MOUSE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE }
                : { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN }
            }
          />
        )}
        {!walk && <CameraDirector view={view} />}
        {!walk && projection === 'perspective' && <NearPlaneSync bounds={derived.bounds} />}
        {!walk && <SelectionPivot />}
        {!walk && <FocusSelection />}
        {!walk && <FreeAreaOffset />}
        {walk && <WalkControls project={project} derived={derived} onExit={exitWalk} />}
        <Lighting
          project={project}
          derived={derived}
          shadows={r.shadows && r.quality !== 'draft'}
          quality={r.quality}
        />
        <SceneContent project={project} derived={derived} registry={sharedRegistry} options={options} />
        {!walk && (
          <group ref={helpersRef} visible={showHelpers}>
            <InfiniteGrid background={r.background} />
          </group>
        )}
        <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0]} receiveShadow raycast={() => null}>
          <planeGeometry args={[400, 400]} />
          <shadowMaterial
            transparent
            opacity={0.18}
            onBeforeCompile={sunShadowOnly}
            customProgramCacheKey={sunShadowKey}
          />
        </mesh>
        {/* Captures and renders need the scene on screen (a hidden one may show an older project). */}
        {active && <LiveBridge helpersRef={helpersRef} />}
        {!walk && <ToolBridge3D enabled={workspace === '3d'} />}
        {!walk && !drawing && showHelpers && <TransformGizmo controlsRef={drag.controlsRef} />}
      </Canvas>
      {!ready &&
        (switching ? (
          <div className="pane-loading scene3d-loading switching">
            Applying {QUALITY_LABELS[switching]} quality…
          </div>
        ) : (
          <SceneLoading stage={stage} progress={progress} />
        ))}
      {walk && <WalkHud onExit={exitWalk} isMobile={isMobile} />}
      {/* Mobile has no tool rail to bring a stashed panel back, so it only collapses there. Hidden
          behind the plan, the panel must not exist at all: the 2D fit measures floating panels. */}
      {active && !walk && !chromeHidden && workspace !== 'split' && (viewPanelOpen || isMobile) && (
        <ViewPanel
          project={project}
          isMobile={isMobile}
          projection={projection}
          goTo={goTo}
          showDims={showDims}
          setShowDims={setShowDims}
          showHelpers={showHelpers}
          setShowHelpers={setShowHelpers}
        />
      )}
      {active && !walk && !chromeHidden && workspace === 'split' && (
        <div className="split-3d-tools floating">
          <IconButton label="Home view" onClick={() => goTo(namedView('home', derived.bounds))}>
            <Home size={15} />
          </IconButton>
          <IconButton
            label="Walk through"
            onClick={() => useEditorStore.getState().set({ workspace: 'walk' })}
          >
            <Footprints size={15} />
          </IconButton>
        </div>
      )}
    </div>
  );
}

const QUALITY_LABELS: Record<RenderSettings['quality'], string> = {
  draft: 'Draft',
  balanced: 'Balanced',
  high: 'High',
  ultra: 'Ultra',
};

/**
 * The ground only shows the sun's shadow. Lamp lights inside the building cast shadows too
 * (High/Ultra), and from them the whole outside ground is "behind a wall": without this the
 * building's sun shadow drowned in that and light leaking out of windows drew bright bands.
 */
const SUN_SHADOW_MASK = THREE.ShaderChunk.shadowmask_pars_fragment
  .replace('#if NUM_SPOT_LIGHT_SHADOWS > 0', '#if 0')
  .replace('#if NUM_POINT_LIGHT_SHADOWS > 0', '#if 0');
function sunShadowOnly(shader: THREE.WebGLProgramParametersWithUniforms) {
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <shadowmask_pars_fragment>',
    SUN_SHADOW_MASK,
  );
}
const sunShadowKey = () => 'neest-sun-shadow-only';

/**
 * Reports when the 3D view is really showing something: the plan group has been built, every
 * material's shader is compiled and a couple of frames have been drawn. Nothing is drawn before
 * the compile finishes (PostEffects is paused): a first frame would compile every shader
 * synchronously and freeze the page, while compileAsync uses the browser's parallel shader
 * compilation and keeps the page responsive. Until then the loading screen stays over the canvas, so the
 * user never sees the blank canvas that used to appear for a few seconds after the view loaded.
 * A time limit makes sure the loading screen can never get stuck.
 */
function FirstFrames({
  onCompiled,
  onReady,
  onStage,
  onProgress,
}: {
  onCompiled: () => void;
  onReady: () => void;
  onStage: (s: SceneLoadStage) => void;
  onProgress: (p: { done: number; total: number } | null) => void;
}) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const stage = useRef<'build' | 'compile' | number>('build');
  // How long each step took (dev builds log it and keep it in window.__NEEST_LOAD__).
  const times = useRef({ t0: performance.now(), scene: 0, materials: 0, frames: 0 });
  useEffect(() => {
    const t = window.setTimeout(() => {
      onCompiled();
      onReady();
    }, 20000);
    return () => window.clearTimeout(t);
  }, [onCompiled, onReady]);
  useFrame(() => {
    const s = stage.current;
    if (s === 'build') {
      // SceneContent adds its geometry after mount; wait until the plan group is populated.
      if (!scene.getObjectByName('neest-plan')?.children.length) return invalidate();
      stage.current = 'compile';
      times.current.scene = performance.now();
      onStage('materials');
      gl.compileAsync(scene, camera)
        .catch(() => undefined)
        .then(() => uploadTextures(gl, scene, onProgress))
        .catch(() => undefined)
        .finally(() => {
          stage.current = 0;
          times.current.materials = performance.now();
          onStage('frames');
          onCompiled();
          invalidate();
        });
      return;
    }
    if (s === 'compile') return;
    stage.current = s + 1;
    if (s + 1 === 3) {
      const t = times.current;
      t.frames = performance.now();
      if (import.meta.env.DEV) {
        const ms = {
          scene: Math.round(t.scene - t.t0),
          materials: Math.round(t.materials - t.scene),
          frames: Math.round(t.frames - t.materials),
        };
        (window as unknown as { __NEEST_LOAD__?: object }).__NEEST_LOAD__ = ms;
        console.info(
          '[3d] ready: scene ' +
            ms.scene +
            ' ms · materials ' +
            ms.materials +
            ' ms · first frames ' +
            ms.frames +
            ' ms',
        );
      }
      onReady();
    } else if (s + 1 < 3) invalidate();
  });
  return null;
}

/**
 * Uploads the scene's textures to the GPU a few at a time, yielding between batches, so the first
 * frame does not upload them all at once (that froze the page for seconds on big projects) and the
 * loading screen keeps animating and counting.
 */
async function uploadTextures(
  gl: THREE.WebGLRenderer,
  scene: THREE.Scene,
  onProgress: (p: { done: number; total: number } | null) => void,
): Promise<void> {
  const KEYS = [
    'map',
    'normalMap',
    'roughnessMap',
    'metalnessMap',
    'alphaMap',
    'emissiveMap',
    'aoMap',
    'bumpMap',
  ] as const;
  const textures = new Set<THREE.Texture>();
  scene.traverse((o) => {
    const mat = (o as THREE.Mesh).material;
    if (!mat) return;
    for (const m of Array.isArray(mat) ? mat : [mat]) {
      const rec = m as unknown as Record<string, THREE.Texture | null | undefined>;
      for (const k of KEYS) {
        const t = rec[k];
        if (t?.isTexture && t.image) textures.add(t);
      }
    }
  });
  const list = [...textures];
  let slice = performance.now();
  for (const [i, t] of list.entries()) {
    gl.initTexture(t);
    if (performance.now() - slice > 24) {
      onProgress({ done: i + 1, total: list.length });
      await new Promise((r) => setTimeout(r, 0));
      slice = performance.now();
    }
  }
  onProgress(null);
}

/** The editor always opens on a view fitted to the visible canvas; Guest View uses the project's start camera. */
function initialView(derived: DerivedPlan, fov = 45): CameraView {
  return { ...namedView('home', derived.bounds), fov };
}

const clampFov = (v: number) => Math.min(110, Math.max(15, v));

/**
 * Adaptive near plane against z-fighting: depth precision depends on how far the near plane is, so
 * while the camera is outside the apartment (the usual orbit view) the near plane moves out to a
 * quarter of the distance to it — tens of times more precision, no flicker between surfaces a few
 * millimetres apart (skirting on walls, rugs on floors, doors on cabinets). Inside the rooms it
 * stays at 10 cm so nothing close is clipped.
 */
function NearPlaneSync({ bounds }: { bounds: DerivedPlan['bounds'] }) {
  useFrame(({ camera }) => {
    if (!(camera instanceof THREE.PerspectiveCamera) || !bounds) return;
    const p = camera.position;
    // Distance from the camera to the apartment's box (plan bounds, floor to a little above the ceiling).
    const dx = Math.max(bounds.minX - p.x, 0, p.x - bounds.maxX);
    const dy = Math.max(0 - p.y, 0, p.y - 4);
    const dz = Math.max(bounds.minY - p.z, 0, p.z - bounds.maxY);
    const dist = Math.hypot(dx, dy, dz);
    const near = Math.min(3, Math.max(0.1, dist * 0.25));
    if (Math.abs(near - camera.near) > camera.near * 0.08) {
      camera.near = near;
      camera.updateProjectionMatrix();
    }
  });
  return null;
}

/** Keeps the perspective camera's field of view in step with the View panel setting. */
function FovSync({ fov }: { fov: number }) {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    if (camera instanceof THREE.PerspectiveCamera && Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }, [camera, fov]);
  return null;
}

function WalkHud({ onExit, isMobile }: { onExit: () => void; isMobile: boolean }) {
  const flying = useWalkFly();
  return (
    <>
      <div className="walk-hud floating" role="status">
        {isMobile ? (
          <span>Use the left pad to move and drag on the right to look around.</span>
        ) : (
          <span>
            Click to look around · <kbd>W</kbd>
            <kbd>A</kbd>
            <kbd>S</kbd>
            <kbd>D</kbd> to move · <kbd>Shift</kbd> to run · <kbd>F</kbd> {flying ? 'walk again' : 'free-fly'}
            {flying && (
              <>
                {' '}
                · <kbd>Space</kbd>/<kbd>Q</kbd> up/down
              </>
            )}{' '}
            · <kbd>Esc</kbd> to exit
          </span>
        )}
        <Button
          size="sm"
          variant={flying ? 'primary' : 'subtle'}
          onClick={toggleWalkFly}
          data-testid="walk-fly"
        >
          {flying ? 'Flying' : 'Free-fly'}
        </Button>
        <Button size="sm" onClick={onExit}>
          Exit walkthrough
        </Button>
      </div>
      {isMobile && <TouchControls />}
    </>
  );
}

function ViewPanel({
  project,
  isMobile,
  projection,
  goTo,
  showDims,
  setShowDims,
  showHelpers,
  setShowHelpers,
}: {
  project: Project;
  isMobile: boolean;
  projection: Projection;
  goTo: (v: CameraView) => void;
  showDims: boolean;
  setShowDims: (v: boolean) => void;
  showHelpers: boolean;
  setShowHelpers: (v: boolean) => void;
}) {
  const [collapsed, setCollapsed] = useState(true);
  const open = !isMobile || !collapsed;
  const [renaming, setRenaming] = useState<string | null>(null);
  const derived = useMemo(() => derivePlan(project), [project]);
  const r = project.render;
  const setRender = (label: string, patch: Partial<RenderSettings>) =>
    useProjectStore.getState().execute(label, (d) => {
      Object.assign(d.render, patch);
    });
  const saveView = () => {
    const live = liveScene.current;
    if (!live) return;
    const cam = live.camera;
    const target = live.controlsTarget() ?? new THREE.Vector3();
    const n = project.cameras.length + 1;
    useProjectStore.getState().execute('Save camera view', (d) =>
      addCameraPreset(d, {
        name: `View ${n}`,
        projection,
        position: [cam.position.x, cam.position.y, cam.position.z],
        target: [target.x, target.y, target.z],
        fov: (cam as THREE.PerspectiveCamera).fov ?? 50,
        zoom: (cam as THREE.OrthographicCamera).zoom ?? 1,
        wallDisplay: r.wallDisplay,
      }),
    );
    toast.success('View saved', 'Find it under Saved views. It is stored with the project.');
  };
  const updateView = (id: string) => {
    const live = liveScene.current;
    if (!live) return;
    const cam = live.camera;
    const target = live.controlsTarget() ?? new THREE.Vector3();
    useProjectStore.getState().execute('Update camera view', (d) =>
      updateCameraPreset(d, id, {
        projection,
        position: [cam.position.x, cam.position.y, cam.position.z],
        target: [target.x, target.y, target.z],
        fov: (cam as THREE.PerspectiveCamera).fov ?? 50,
        zoom: (cam as THREE.OrthographicCamera).zoom ?? 1,
        wallDisplay: r.wallDisplay,
      }),
    );
  };
  return (
    <aside
      className={`view-panel floating${open ? '' : ' collapsed'}${isMobile ? ' mobile' : ''}`}
      aria-label="3D view settings"
      data-testid="view-panel"
    >
      <header>
        <h2>3D view</h2>
        {/* Desktop stashes the whole panel instead; mobile has no rail button to bring it back, so it collapses. */}
        {isMobile ? (
          <IconButton label={open ? 'Collapse' : 'Expand'} onClick={() => setCollapsed(open)}>
            {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </IconButton>
        ) : (
          <IconButton
            label="Hide panel"
            shortcut="P"
            onClick={() => useEditorStore.getState().set({ viewPanelOpen: false })}
            data-testid="stash-view-panel"
          >
            <PanelLeftClose size={15} />
          </IconButton>
        )}
      </header>
      <div className="view-quick">
        <IconButton
          label="Home view"
          onClick={() => goTo(namedView('home', derived.bounds))}
          data-testid="view-home"
        >
          <Home size={15} />
        </IconButton>
        <Button
          size="sm"
          variant="subtle"
          onClick={() => goTo(namedView('top', derived.bounds))}
          data-testid="view-top"
        >
          Top
        </Button>
        <Button size="sm" variant="subtle" onClick={() => goTo(namedView('iso', derived.bounds))}>
          Iso
        </Button>
        <Button size="sm" variant="subtle" onClick={() => goTo(namedView('perspective', derived.bounds))}>
          Persp.
        </Button>
        <IconButton
          label="Walk through"
          onClick={() => useEditorStore.getState().set({ workspace: 'walk' })}
          data-testid="enter-walk"
        >
          <Footprints size={15} />
        </IconButton>
        <IconButton
          label="Render image"
          onClick={() => useDialogStore.getState().open('render')}
          data-testid="open-render"
        >
          <ImageDown size={15} />
        </IconButton>
      </div>
      {open && (
        <div className="view-body">
          <section>
            <div className="vp-head">
              <h3>Saved views</h3>
              <Button size="sm" variant="ghost" onClick={saveView} data-testid="save-view">
                <Save size={13} /> Save current
              </Button>
            </div>
            {project.cameras.length === 0 && (
              <p className="field-hint">Frame a view you like and save it here.</p>
            )}
            {project.cameras.map((c) => (
              <div key={c.id} className="cam-row">
                {renaming === c.id ? (
                  <input
                    className="input"
                    defaultValue={c.name}
                    autoFocus
                    aria-label="View name"
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      if (e.key === 'Escape') setRenaming(null);
                    }}
                    onBlur={(e) => {
                      const name = e.target.value.trim();
                      if (name && name !== c.name)
                        useProjectStore
                          .getState()
                          .execute('Rename view', (d) => updateCameraPreset(d, c.id, { name }));
                      setRenaming(null);
                    }}
                  />
                ) : (
                  <button type="button" className="cam-name" onClick={() => goTo(presetView(c))}>
                    <Camera size={13} /> {c.name}
                    {project.guest.startCameraId === c.id && <span className="badge">Guest start</span>}
                  </button>
                )}
                <IconButton label="Rename view" onClick={() => setRenaming(c.id)}>
                  <Pencil size={13} />
                </IconButton>
                <IconButton label="Update to current camera" onClick={() => updateView(c.id)}>
                  <RefreshCw size={13} />
                </IconButton>
                <IconButton
                  label="Delete view"
                  onClick={() =>
                    useProjectStore.getState().execute('Delete view', (d) => deleteCameraPreset(d, c.id))
                  }
                >
                  <Trash2 size={13} />
                </IconButton>
              </div>
            ))}
          </section>
          <section>
            <h3>Camera</h3>
            <Slider
              label="Field of view"
              value={r.fov}
              min={20}
              max={100}
              step={1}
              format={(v) => `${Math.round(v)}° · ${Math.round(12 / Math.tan((v * Math.PI) / 360))} mm`}
              onCommit={(v) => setRender('Change field of view', { fov: v })}
            />
            <Slider
              label="Walkthrough field of view"
              value={r.walkFov}
              min={40}
              max={100}
              step={1}
              format={(v) => `${Math.round(v)}°`}
              onCommit={(v) => setRender('Change walkthrough field of view', { walkFov: v })}
            />
            <p className="field-hint">
              Wider shows more of a small room; narrower flattens perspective like a longer lens. Saved views
              keep their own.
            </p>
          </section>
          <section>
            <h3>Walls</h3>
            <Segmented<WallDisplay>
              label="Wall display"
              size="sm"
              value={r.wallDisplay}
              onChange={(v) => setRender('Change wall display', { wallDisplay: v })}
              options={[
                { value: 'full', label: 'Full' },
                { value: 'cutaway', label: 'Cutaway' },
                { value: 'fade', label: 'Fade near' },
                { value: 'hidden', label: 'Hidden' },
              ]}
            />
            {r.wallDisplay === 'cutaway' && (
              <Slider
                label="Cut height"
                value={r.cutawayHeight}
                min={0.3}
                max={3}
                step={0.05}
                format={(v) => `${v.toFixed(2)} m`}
                onCommit={(v) => setRender('Change cut height', { cutawayHeight: v })}
              />
            )}
            <Toggle
              label="Ceilings"
              checked={r.showCeilings}
              onChange={(v) => setRender('Toggle ceilings', { showCeilings: v })}
              hint="Visible from inside rooms"
            />
            <Toggle
              label="Room labels"
              checked={r.showRoomLabels}
              onChange={(v) => setRender('Toggle 3D labels', { showRoomLabels: v })}
            />
            <Toggle label="Wall dimensions" checked={showDims} onChange={setShowDims} />
            <Toggle label="Helpers (grid, selection)" checked={showHelpers} onChange={setShowHelpers} />
          </section>
          <section>
            <h3>Quality & light</h3>
            <Segmented<RenderSettings['quality']>
              label="Quality"
              size="sm"
              value={r.quality}
              onChange={(v) => setRender('Change quality', { quality: v })}
              options={[
                { value: 'draft', label: 'Draft' },
                { value: 'balanced', label: 'Balanced' },
                { value: 'high', label: 'High' },
                { value: 'ultra', label: 'Ultra' },
              ]}
            />
            <Slider
              label="Time of day"
              value={r.timeOfDay}
              min={6}
              max={20}
              step={0.25}
              format={(v) => `${Math.floor(v)}:${String(Math.round((v % 1) * 60)).padStart(2, '0')}`}
              onCommit={(v) => setRender('Change time of day', { timeOfDay: v })}
            />
            <Slider
              label="Sun direction"
              value={r.sunAzimuth}
              min={0}
              max={360}
              step={5}
              format={(v) => `${v}°`}
              onCommit={(v) => setRender('Change sun direction', { sunAzimuth: v })}
            />
            <Slider
              label="Sun strength"
              value={r.sunIntensity}
              min={0}
              max={6}
              step={0.1}
              onCommit={(v) => setRender('Change sun strength', { sunIntensity: v })}
            />
            <Slider
              label="Sun warmth"
              value={r.sunWarmth}
              min={-1}
              max={1}
              step={0.05}
              format={(v) =>
                Math.abs(v) < 0.025
                  ? 'Natural'
                  : v > 0
                    ? `Warm ${Math.round(v * 100)}%`
                    : `Cool ${Math.round(-v * 100)}%`
              }
              onCommit={(v) => setRender('Change sun warmth', { sunWarmth: v })}
            />
            <Slider
              label="Ambient light"
              value={r.envIntensity}
              min={0}
              max={2.5}
              step={0.05}
              onCommit={(v) => setRender('Change ambient light', { envIntensity: v })}
            />
            <Slider
              label="Exposure"
              value={r.exposure}
              min={0.3}
              max={2.5}
              step={0.05}
              onCommit={(v) => setRender('Change exposure', { exposure: v })}
            />
            <Toggle
              label="Shadows"
              checked={r.shadows}
              onChange={(v) => setRender('Toggle shadows', { shadows: v })}
            />
            <div className="field">
              <span className="field-label">Background</span>
              <input
                type="color"
                className="bg-color"
                value={r.background}
                aria-label="Background colour"
                onChange={(e) => setRender('Change background', { background: e.target.value })}
              />
            </div>
          </section>
          <section>
            <h3>Show categories</h3>
            <div className="chips">
              {(() => {
                const hidden = r.hiddenCategories.includes(CEILING_CATEGORY);
                return (
                  <button
                    type="button"
                    className={`chip chip-special${hidden ? '' : ' on'}`}
                    aria-pressed={!hidden}
                    title="Ceiling-mounted items in every room (pendants, ceiling lights, fans). Their light stays on when hidden."
                    data-testid="category-ceiling"
                    onClick={() =>
                      setRender(hidden ? 'Show ceiling items' : 'Hide ceiling items', {
                        hiddenCategories: hidden
                          ? r.hiddenCategories.filter((x) => x !== CEILING_CATEGORY)
                          : [...r.hiddenCategories, CEILING_CATEGORY],
                      })
                    }
                  >
                    Ceiling
                  </button>
                );
              })()}
              {ASSET_CATEGORY_ORDER.map((c) => {
                const hidden = r.hiddenCategories.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    className={`chip${hidden ? '' : ' on'}`}
                    aria-pressed={!hidden}
                    onClick={() =>
                      setRender('Toggle category', {
                        hiddenCategories: hidden
                          ? r.hiddenCategories.filter((x) => x !== c)
                          : [...r.hiddenCategories, c],
                      })
                    }
                  >
                    {ASSET_CATEGORY_LABELS[c]}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </aside>
  );
}

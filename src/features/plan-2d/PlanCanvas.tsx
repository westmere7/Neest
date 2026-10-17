import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Vec2 } from '@/domain/model/schema';
import { derivePlan } from '@/domain/geometry/derive';
import { snapPoint, type SnapContext } from '@/domain/geometry/snapping';
import type { WallGeometry } from '@/domain/geometry/walls';
import { pointAt } from '@/domain/geometry/wallPath';
import { rectPolygon } from '@/domain/geometry/polygon';
import { add, dist, leftNormal, scale } from '@/domain/geometry/vec';
import { formatLength } from '@/domain/model/units';
import { assetPlan, getAsset } from '@/data/assets/registry';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore, type ToolId } from '@/state/editorStore';
import { usePrefsStore } from '@/state/uiStores';
import { PlanDrawing, polyPath, f, Dimension, type PlanDrawOptions } from './PlanDrawing';
import { planPalette } from './palette';
import { hitTest, selectionHandles } from './hitTest';
import { createSelectTool } from './tools/selectTool';
import { createCurveTool, createMeasureTool, createRoomTool, createSplitTool, createWallTool } from './tools/drawTools';
import { createOpeningTool, createPlaceTool } from './tools/placeTools';
import type { PointerInfo, Tool, ToolEnv, ToolOverlay } from './tools/types';
import { openContextMenu } from '@/components/ContextMenu';
import { floatingInsets } from '@/components/layoutInsets';
import { planContextMenuItems } from './contextMenu';
import './plan.css';

/** Constant on-screen pointer tolerance in pixels. */
const HIT_PX = 8;
const MIN_ZOOM = 4;
const MAX_ZOOM = 3000;

/** Key handler of the active plan tool, consulted first by the editor's keyboard router. */
export const planKeyRouter: { current: ((e: KeyboardEvent) => boolean) | null; cancel: (() => boolean) | null } = {
  current: null,
  cancel: null,
};

export function PlanCanvas() {
  const project = useProjectStore((s) => s.project)!;
  const derived = useMemo(() => derivePlan(project), [project]);
  const tool = useEditorStore((s) => s.tool);
  const camera = useEditorStore((s) => s.planCamera);
  const planMode = useEditorStore((s) => s.planMode);
  const selection = useEditorStore((s) => s.selection);
  const hover = useEditorStore((s) => s.hover);
  const gridVisible = useEditorStore((s) => s.gridVisible);
  const measurements = useEditorStore((s) => s.measurements);
  const fitRequest = useEditorStore((s) => s.fitRequest);
  const chromeHidden = useEditorStore((s) => s.chromeHidden);
  const theme = usePrefsStore((s) => s.theme);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [overlay, setOverlay] = useState<ToolOverlay | null>(null);
  const [cursor, setCursor] = useState('default');
  const [panning, setPanning] = useState(false);

  const stateRef = useRef({ project, derived, camera, size });
  stateRef.current = { project, derived, camera, size };

  const tools = useMemo<Record<ToolId, Tool>>(
    () => ({
      select: createSelectTool(),
      pan: { id: 'pan', cursor: 'grab', hint: 'Drag to pan the plan.' },
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
  const activeTool = tools[tool];

  // ── Resize observer ──
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.max(50, r.width), h: Math.max(50, r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fit = useCallback(() => {
    const { derived: dv, size: sz } = stateRef.current;
    const b = dv.bounds ?? { minX: -1, minY: -1, maxX: 9, maxY: 7 };
    // Fit into the area not covered by floating panels, using the live container size.
    const host = containerRef.current?.getBoundingClientRect();
    const W = host?.width || sz.w;
    const Hh = host?.height || sz.h;
    const insets = host ? floatingInsets(host) : { l: 0, r: 0, t: 0, b: 0 };
    const margin = Math.min(56, Math.max(16, Math.min(W, Hh) * 0.06));
    const availW = Math.max(120, W - insets.l - insets.r - margin * 2);
    const availH = Math.max(120, Hh - insets.t - insets.b - margin * 2);
    const bw = Math.max(1, b.maxX - b.minX);
    const bh = Math.max(1, b.maxY - b.minY);
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(availW / bw, availH / bh)));
    const offX = (insets.l - insets.r) / 2 / zoom;
    const offY = (insets.t - insets.b) / 2 / zoom;
    useEditorStore.getState().set({ planCamera: { cx: (b.minX + b.maxX) / 2 - offX, cy: (b.minY + b.maxY) / 2 - offY, zoom } });
  }, []);

  // Fit when the project opens, then again while the floating panels finish mounting
  // (unless the user has already panned or zoomed).
  const userMoved = useRef(false);
  const fittedFor = useRef<string | null>(null);
  const ready = size.w > 60 && size.h > 60;
  useEffect(() => {
    if (!ready || fittedFor.current === project.id) return;
    fittedFor.current = project.id;
    userMoved.current = false;
    fit();
    const timers = [120, 400, 900].map((ms) => setTimeout(() => !userMoved.current && fit(), ms));
    return () => timers.forEach(clearTimeout);
  }, [ready, project.id, fit]);
  useEffect(() => {
    if (fitRequest > 0) fit();
  }, [fitRequest, fit]);

  const px = 1 / camera.zoom;
  const vb = {
    x: camera.cx - size.w / 2 / camera.zoom,
    y: camera.cy - size.h / 2 / camera.zoom,
    w: size.w / camera.zoom,
    h: size.h / camera.zoom,
  };

  const toWorld = useCallback((clientX: number, clientY: number): { world: Vec2; screen: Vec2 } => {
    const rect = svgRef.current!.getBoundingClientRect();
    const { camera: cam, size: sz } = stateRef.current;
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    return { screen: { x: sx, y: sy }, world: { x: cam.cx + (sx - sz.w / 2) / cam.zoom, y: cam.cy + (sy - sz.h / 2) / cam.zoom } };
  }, []);

  const env = useMemo<ToolEnv>(
    () => ({
      project: () => useProjectStore.getState().project!,
      derived: () => derivePlan(useProjectStore.getState().project!),
      editor: () => useEditorStore.getState(),
      px: () => 1 / useEditorStore.getState().planCamera.zoom,
      tol: () => HIT_PX / useEditorStore.getState().planCamera.zoom,
      snap: (p, extra?: Partial<SnapContext>) => {
        const proj = useProjectStore.getState().project!;
        const ed = useEditorStore.getState();
        return snapPoint(p, {
          project: proj,
          network: derivePlan(proj).network,
          tol: (HIT_PX * 1.4) / ed.planCamera.zoom,
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
      setCursor,
      finish: () => useEditorStore.getState().setTool('select'),
    }),
    [],
  );

  // Reset overlays when the tool changes; register keyboard routing.
  useEffect(() => {
    setOverlay(null);
    setCursor(activeTool.cursor);
    useEditorStore.getState().set({ hint: activeTool.hint });
    planKeyRouter.current = (e) => activeTool.onKeyDown?.(e, env) ?? false;
    planKeyRouter.cancel = () => activeTool.cancel?.(env) ?? false;
    return () => {
      activeTool.cancel?.(env);
      planKeyRouter.current = null;
      planKeyRouter.cancel = null;
    };
  }, [activeTool, env]);

  // ── Pan / zoom / touch ──
  const pointers = useRef(new Map<number, Vec2>());
  const panState = useRef<{ start: Vec2; cam: { cx: number; cy: number } } | null>(null);
  const pinchState = useRef<{ d0: number; zoom0: number; mid0: Vec2; cam0: { cx: number; cy: number } } | null>(null);
  const spaceDown = useRef(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        spaceDown.current = true;
        setCursor('grab');
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceDown.current = false;
        setCursor(tools[useEditorStore.getState().tool].cursor);
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [tools]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      userMoved.current = true;
      const cam = useEditorStore.getState().planCamera;
      const { world } = toWorld(e.clientX, e.clientY);
      if (e.shiftKey && !e.ctrlKey) {
        useEditorStore.getState().set({ planCamera: { ...cam, cx: cam.cx + e.deltaY / cam.zoom } });
        return;
      }
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
      const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, cam.zoom * factor));
      const k = cam.zoom / zoom;
      useEditorStore.getState().set({
        planCamera: { zoom, cx: world.x - (world.x - cam.cx) * k, cy: world.y - (world.y - cam.cy) * k },
      });
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [toWorld]);

  const info = (e: React.PointerEvent | React.MouseEvent): PointerInfo => {
    const { world, screen } = toWorld(e.clientX, e.clientY);
    return {
      world,
      screen,
      button: e.button,
      shift: e.shiftKey,
      alt: e.altKey,
      mod: e.ctrlKey || e.metaKey,
      pointerType: 'pointerType' in e ? (e as React.PointerEvent).pointerType : 'mouse',
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    userMoved.current = true;
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {
      /* synthetic or already-released pointer */
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      // Two-finger pinch/pan: abort any tool gesture.
      activeTool.cancel?.(env);
      panState.current = null;
      const [a, b] = [...pointers.current.values()];
      const cam = useEditorStore.getState().planCamera;
      pinchState.current = { d0: dist(a, b), zoom0: cam.zoom, mid0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, cam0: { cx: cam.cx, cy: cam.cy } };
      return;
    }
    const pi = info(e);
    const isTouchPan =
      e.pointerType === 'touch' &&
      tool === 'select' &&
      !hitTest(project, derived, pi.world, (HIT_PX * 2) / camera.zoom) &&
      !selectionHandles(project, derived, selection, px).some((h) => dist(h.p, pi.world) < (HIT_PX * 2) / camera.zoom);
    if (e.button === 1 || (e.button === 0 && (spaceDown.current || tool === 'pan' || isTouchPan))) {
      panState.current = { start: { x: e.clientX, y: e.clientY }, cam: { cx: camera.cx, cy: camera.cy } };
      setPanning(true);
      return;
    }
    if (e.button === 2) return;
    activeTool.onPointerDown?.(pi, env);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinchState.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const ps = pinchState.current;
      const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, (ps.zoom0 * dist(a, b)) / Math.max(1, ps.d0)));
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const rect = svgRef.current!.getBoundingClientRect();
      const m0 = { x: ps.mid0.x - rect.left - size.w / 2, y: ps.mid0.y - rect.top - size.h / 2 };
      const worldAtMid0 = { x: ps.cam0.cx + m0.x / ps.zoom0, y: ps.cam0.cy + m0.y / ps.zoom0 };
      const m1 = { x: mid.x - rect.left - size.w / 2, y: mid.y - rect.top - size.h / 2 };
      useEditorStore.getState().set({ planCamera: { zoom, cx: worldAtMid0.x - m1.x / zoom, cy: worldAtMid0.y - m1.y / zoom } });
      return;
    }
    if (panState.current) {
      const p = panState.current;
      const cam = useEditorStore.getState().planCamera;
      useEditorStore.getState().set({
        planCamera: { ...cam, cx: p.cam.cx - (e.clientX - p.start.x) / cam.zoom, cy: p.cam.cy - (e.clientY - p.start.y) / cam.zoom },
      });
      return;
    }
    const pi = info(e);
    useEditorStore.getState().set({ cursor: pi.world });
    activeTool.onPointerMove?.(pi, env);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pinchState.current) {
      if (pointers.current.size < 2) pinchState.current = null;
      return;
    }
    if (panState.current) {
      panState.current = null;
      setPanning(false);
      return;
    }
    if (e.button === 2) return;
    activeTool.onPointerUp?.(info(e), env);
  };

  const onDoubleClick = (e: React.MouseEvent) => activeTool.onDoubleClick?.(info(e), env);

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (activeTool.busy?.()) {
      activeTool.cancel?.(env);
      return;
    }
    const pi = info(e);
    const hit = hitTest(project, derived, pi.world, HIT_PX / camera.zoom);
    if (hit && !selection.some((s) => s.id === hit.id)) useEditorStore.getState().setSelection([hit]);
    const items = planContextMenuItems(hit, pi.world);
    if (items.length) openContextMenu(e.clientX, e.clientY, items);
  };

  const onDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/x-neest-asset')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  };
  const onDrop = (e: React.DragEvent) => {
    const assetId = e.dataTransfer.getData('application/x-neest-asset');
    if (!assetId) return;
    e.preventDefault();
    const { world } = toWorld(e.clientX, e.clientY);
    window.dispatchEvent(new CustomEvent('neest:drop-asset', { detail: { assetId, x: world.x, y: world.y } }));
  };

  const pal = planPalette(planMode, theme);
  const drawOpts = useMemo<PlanDrawOptions>(
    () => ({
      mode: planMode,
      palette: pal,
      px,
      unit: project.settings.units,
      precision: project.settings.precision,
      areaUnit: project.settings.areaUnit,
      showRoomLabels: project.settings.showRoomLabels,
      showAreas: project.settings.showRoomAreas,
      dims: project.settings.dimensions,
      showFurniture: true,
      showConstruction: true,
      showAnnotations: true,
      textures: true,
      shadows: true,
      halo: true,
      idPrefix: 'scr',
    }),
    // Quantise px so tiny zoom changes reuse the memoised drawing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [planMode, pal, Math.round(Math.log(px) * 40), project.settings],
  );

  const gridStep = useMemo(() => {
    let s = project.settings.gridSize;
    while (s * camera.zoom < 9) s *= 5;
    return s;
  }, [project.settings.gridSize, camera.zoom]);
  const majorStep = gridStep * (gridStep < 1 ? Math.round(1 / gridStep) : 10);

  return (
    <div
      ref={containerRef}
      className={`plan-canvas mode-${planMode}${chromeHidden ? ' chrome-hidden' : ''}`}
      style={{ background: pal.paper }}
      onDragOver={onDragOver}
      onDrop={onDrop}
      data-testid="plan-canvas"
    >
      <svg
        ref={svgRef}
        className="plan-svg"
        width={size.w}
        height={size.h}
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        style={{ cursor: panning ? 'grabbing' : cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => useEditorStore.getState().set({ cursor: null })}
        onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenu}
        role="application"
        aria-label="Floor plan editor canvas"
      >
        <defs>
          <pattern id="grid-minor" width={gridStep} height={gridStep} patternUnits="userSpaceOnUse">
            <path d={`M ${gridStep} 0 L 0 0 0 ${gridStep}`} fill="none" stroke={pal.grid} strokeWidth={px} />
          </pattern>
          <pattern id="grid-major" width={majorStep} height={majorStep} patternUnits="userSpaceOnUse">
            <rect width={majorStep} height={majorStep} fill="url(#grid-minor)" />
            <path d={`M ${majorStep} 0 L 0 0 0 ${majorStep}`} fill="none" stroke={pal.gridMajor} strokeWidth={px} />
          </pattern>
        </defs>
        {gridVisible && planMode !== 'presentation' && !chromeHidden && (
          <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill="url(#grid-major)" pointerEvents="none" />
        )}
        <PlanDrawing project={project} derived={derived} opts={drawOpts} />
        {!chromeHidden && (
          <SelectionLayer px={px} hoverId={hover?.id ?? null} />
        )}
        {measurements.map((m) => (
          <Dimension
            key={m.id}
            spec={{ a: m.a, b: m.b, offset: 0.0001, text: formatLength(dist(m.a, m.b), project.settings.units, project.settings.precision) }}
            px={px}
            color="var(--snap)"
            opts={{ halo: true, palette: pal }}
          />
        ))}
        {overlay && <OverlayLayer overlay={overlay} px={px} />}
      </svg>
      {overlay?.numeric && <NumericBadge overlay={overlay} camera={camera} size={size} />}
    </div>
  );
}

function NumericBadge({ overlay, camera, size }: { overlay: ToolOverlay; camera: { cx: number; cy: number; zoom: number }; size: { w: number; h: number } }) {
  const n = overlay.numeric!;
  const x = (n.p.x - camera.cx) * camera.zoom + size.w / 2;
  const y = (n.p.y - camera.cy) * camera.zoom + size.h / 2;
  return (
    <div className="numeric-badge" style={{ left: x + 16, top: y - 40 }} role="status" aria-live="polite">
      <span className="numeric-label">{n.label}</span>
      <span className="numeric-value">{n.value}</span>
      <kbd>Enter</kbd>
    </div>
  );
}

function SelectionLayer({ px, hoverId }: { px: number; hoverId: string | null }) {
  const project = useProjectStore((s) => s.project)!;
  const derived = useMemo(() => derivePlan(project), [project]);
  const selection = useEditorStore((s) => s.selection);
  const hover = useEditorStore((s) => s.hover);
  const items: ReactNode[] = [];
  const outline = (id: string, d: string, selected: boolean, dashed = false) => (
    <path
      key={`${selected ? 's' : 'h'}-${id}`}
      d={d}
      className={selected ? 'sel-outline' : 'hover-outline'}
      strokeWidth={f((selected ? 2 : 1.5) * px)}
      strokeDasharray={dashed ? `${f(6 * px)} ${f(4 * px)}` : undefined}
    />
  );
  const draw = (item: { kind: string; id: string }, selected: boolean) => {
    if (item.kind === 'wall') {
      const g = derived.network.walls.get(item.id);
      if (g) items.push(outline(item.id, polyPath(g.footprint), selected));
      if (g && selected && g.wall.locked) items.push(<LockBadge key={`lock-${item.id}`} p={g.path.samples[0].p} px={px} />);
    } else if (item.kind === 'opening') {
      const o = project.openings[item.id];
      const g = o && derived.network.walls.get(o.wallId);
      const sp = g?.spans.find((s) => s.id === item.id);
      if (g && sp) {
        const at = (s: number, off: number) => pointOnWall(g, s, off);
        const pts = [at(sp.s0, g.h + 3 * px), at(sp.s1, g.h + 3 * px), at(sp.s1, -g.h - 3 * px), at(sp.s0, -g.h - 3 * px)];
        items.push(outline(item.id, polyPath(pts), selected));
      }
    } else if (item.kind === 'object') {
      const o = project.objects[item.id];
      if (o) items.push(outline(item.id, polyPath(rectPolygon(o.x, o.y, o.width, o.depth, o.rotation)), selected, !selected));
      if (o && selected && o.locked) items.push(<LockBadge key={`lock-${item.id}`} p={{ x: o.x, y: o.y }} px={px} />);
    } else if (item.kind === 'room') {
      const face = derived.roomFaces.get(item.id);
      if (face) {
        items.push(
          <path
            key={`room-${item.id}-${selected}`}
            d={polyPath(face.inner) + face.holes.map((h) => polyPath(h)).join('')}
            className={selected ? 'sel-room' : 'hover-room'}
            fillRule="evenodd"
            strokeWidth={f(1.5 * px)}
            strokeDasharray={`${f(6 * px)} ${f(4 * px)}`}
          />,
        );
      }
    } else if (item.kind === 'node') {
      const n = project.nodes[item.id];
      if (n) items.push(<circle key={`n-${item.id}`} cx={n.x} cy={n.y} r={6 * px} className="sel-outline" strokeWidth={2 * px} />);
    }
  };
  if (hover && hoverId && !selection.some((s) => s.id === hoverId)) draw(hover, false);
  for (const s of selection) draw(s, true);

  const handles = selectionHandles(project, derived, selection, px);
  const handleEls = handles.map(({ handle, p }, i) => {
    const r = 5 * px;
    if (handle.type === 'object-rotate') {
      const o = project.objects[handle.objectId];
      const top = add({ x: o.x, y: o.y }, rotateVec({ x: 0, y: -o.depth / 2 }, o.rotation));
      return (
        <g key={i}>
          <line x1={top.x} y1={top.y} x2={p.x} y2={p.y} className="handle-line" strokeWidth={px} />
          <circle cx={p.x} cy={p.y} r={r * 1.2} className="handle rotate" strokeWidth={1.5 * px} />
        </g>
      );
    }
    if (handle.type === 'node' || handle.type === 'curve' || handle.type === 'room-label')
      return <circle key={i} cx={p.x} cy={p.y} r={r * 1.1} className={`handle ${handle.type}`} strokeWidth={1.5 * px} />;
    return <rect key={i} x={p.x - r} y={p.y - r} width={2 * r} height={2 * r} className="handle" strokeWidth={1.5 * px} />;
  });

  // Selected wall: live length dimension.
  const dims: ReactNode[] = [];
  if (selection.length === 1 && selection[0].kind === 'wall') {
    const g = derived.network.walls.get(selection[0].id);
    if (g && !g.path.control) {
      dims.push(
        <Dimension
          key="selwall"
          spec={{ a: g.path.a, b: g.path.b, offset: g.h + 22 * px, text: formatLength(g.path.length, project.settings.units, project.settings.precision) }}
          px={px}
          color="var(--accent)"
          opts={{ halo: true, palette: planPalette('draft', 'light') }}
        />,
      );
    }
  }
  return (
    <g className="selection-layer" pointerEvents="none">
      {items}
      {dims}
      {handleEls}
    </g>
  );
}

function LockBadge({ p, px }: { p: Vec2; px: number }) {
  return (
    <g transform={`translate(${p.x} ${p.y})`}>
      <rect x={-7 * px} y={-7 * px} width={14 * px} height={14 * px} rx={3 * px} className="lock-badge" />
      <path
        d={`M${-3 * px} ${-0.5 * px}V${-2.5 * px}A${3 * px} ${3 * px} 0 0 1 ${3 * px} ${-2.5 * px}V${-0.5 * px}M${-4 * px} ${-0.5 * px}H${4 * px}V${4 * px}H${-4 * px}Z`}
        className="lock-icon"
        strokeWidth={1.1 * px}
      />
    </g>
  );
}

function rotateVec(v: Vec2, a: number): Vec2 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}

function pointOnWall(g: WallGeometry, s: number, off: number): Vec2 {
  const { p, tangent } = pointAt(g.path, s);
  return add(p, scale(leftNormal(tangent), off));
}

function OverlayLayer({ overlay, px }: { overlay: ToolOverlay; px: number }) {
  const project = useProjectStore((s) => s.project)!;
  const els: ReactNode[] = [];
  overlay.wallPreviews?.forEach((poly, i) =>
    els.push(<path key={`wp${i}`} d={polyPath(poly)} className="ov-wall" strokeWidth={1.5 * px} />),
  );
  overlay.lines?.forEach((l, i) =>
    els.push(
      <line
        key={`l${i}`}
        x1={l.a.x}
        y1={l.a.y}
        x2={l.b.x}
        y2={l.b.y}
        className={`ov-line ${l.kind}`}
        strokeWidth={(l.kind === 'guide' ? 1 : 1.25) * px}
        strokeDasharray={`${5 * px} ${4 * px}`}
      />,
    ),
  );
  if (overlay.marquee) {
    const { a, b } = overlay.marquee;
    els.push(
      <rect
        key="mq"
        x={Math.min(a.x, b.x)}
        y={Math.min(a.y, b.y)}
        width={Math.abs(a.x - b.x)}
        height={Math.abs(a.y - b.y)}
        className="ov-marquee"
        strokeWidth={px}
      />,
    );
  }
  if (overlay.ghostOpening) {
    els.push(
      <path
        key="go"
        d={polyPath(overlay.ghostOpening.pts)}
        className={`ov-ghost-opening${overlay.ghostOpening.valid ? '' : ' invalid'}`}
        strokeWidth={1.5 * px}
      />,
    );
  }
  if (overlay.ghostObject) {
    const g = overlay.ghostObject;
    const asset = getAsset(project, g.assetId);
    if (asset) {
      const plan = assetPlan(asset, { w: g.width, d: g.depth, h: g.height }, project.customAssets[g.assetId]);
      els.push(
        <g key="gobj" transform={`translate(${g.x} ${g.y}) rotate(${(g.rotation * 180) / Math.PI})`} className="ov-ghost-object">
          {plan.shapes.map((s, i) => (
            <path key={i} d={polyPath(s.points)} strokeWidth={px} />
          ))}
          <line x1={0} y1={0} x2={0} y2={g.depth / 2} strokeWidth={px} className="ov-front" />
        </g>,
      );
    }
  }
  if (overlay.splitMarker) {
    const { a, b } = overlay.splitMarker;
    els.push(<line key="split" x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="ov-split" strokeWidth={2.5 * px} />);
  }
  if (overlay.curveHandle) {
    const { a, b, c, mid } = overlay.curveHandle;
    els.push(
      <g key="curve">
        <path d={`M${a.x} ${a.y}L${c.x} ${c.y}L${b.x} ${b.y}`} className="ov-line guide" strokeWidth={px} strokeDasharray={`${4 * px} ${3 * px}`} />
        <circle cx={mid.x} cy={mid.y} r={5 * px} className="handle curve" strokeWidth={1.5 * px} />
      </g>,
    );
  }
  overlay.dims?.forEach((d, i) =>
    els.push(<Dimension key={`d${i}`} spec={d} px={px} color="var(--accent)" opts={{ halo: true, palette: planPalette('draft', 'light') }} />),
  );
  if (overlay.snap) {
    const { p, kind } = overlay.snap;
    const r = 6 * px;
    let shape: ReactNode;
    if (kind === 'node') shape = <rect x={p.x - r} y={p.y - r} width={2 * r} height={2 * r} />;
    else if (kind === 'midpoint') shape = <path d={`M${p.x} ${p.y - r}L${p.x + r} ${p.y + r * 0.8}L${p.x - r} ${p.y + r * 0.8}Z`} />;
    else if (kind === 'wall' || kind === 'edge')
      shape = <path d={`M${p.x - r} ${p.y - r}L${p.x + r} ${p.y + r}M${p.x + r} ${p.y - r}L${p.x - r} ${p.y + r}`} />;
    else if (kind === 'grid') shape = <path d={`M${p.x - r * 0.7} ${p.y}H${p.x + r * 0.7}M${p.x} ${p.y - r * 0.7}V${p.y + r * 0.7}`} />;
    else shape = <circle cx={p.x} cy={p.y} r={r * 0.8} />;
    els.push(
      <g key="snap" className={`ov-snap kind-${kind}`} strokeWidth={1.6 * px}>
        {shape}
      </g>,
    );
  }
  overlay.labels?.forEach((l, i) => {
    const off = l.offset ?? { x: 12, y: 18 };
    const pos = { x: l.p.x + off.x * px, y: l.p.y + off.y * px };
    els.push(
      <g key={`lb${i}`} className="ov-label">
        <text x={pos.x} y={pos.y} fontSize={11 * px} strokeWidth={3 * px}>
          {l.text}
        </text>
      </g>,
    );
  });
  return (
    <g className="overlay-layer" pointerEvents="none">
      {els}
    </g>
  );
}

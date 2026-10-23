import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, OrthographicCamera } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { ArrowLeft, Footprints, Orbit, X } from 'lucide-react';
import type { Project } from '@/domain/model/schema';
import { derivePlan } from '@/domain/geometry/derive';
import { planOverview } from '@/domain/geometry/overview';
import { formatArea, formatLength } from '@/domain/model/units';
import { guestAutoViews, guestLayers, guestRenderQuality, guestSceneProject, guestSubtitle, guestTitle, guestViews } from '@/domain/walkthrough/guest';
import { defaultSpawn } from '@/domain/walkthrough/collision';
import { loadProject } from '@/features/projects/projectService';
import { Lighting, SceneContent } from '@/features/scene-3d/SceneContent';
import { sharedRegistry } from '@/features/scene-3d/sceneRuntime';
import { namedView, presetView, type CameraView } from '@/features/scene-3d/cameraViews';
import { Button } from '@/components/ui';
import { useIsMobile } from '@/components/hooks';
import { navigate } from '@/app/App';
import { setWalkSpeed, toggleWalkFly, useWalkFly, useWalkSpeed, WalkControls } from './WalkControls';
import { TouchControls } from './TouchControls';
import { CanvasMeasureKick, clientCompute } from '@/features/scene-3d/useCanvasMeasureFix';
import { attachTrackpadOrbit, type OrbitLike } from '@/features/scene-3d/trackpadOrbit';
// The editor's sheet has the floating chrome and loading styles; the guest route can open without the editor.
import '@/features/editor/editor.css';
import '@/features/scene-3d/scene3d.css';
import { NotesOverlay, NotesViewBridge } from '@/features/callouts/NotesOverlay';
import { FirstFrames } from '@/features/scene-3d/FirstFrames';
import { SceneLoading, type SceneLoadStage } from '@/features/scene-3d/SceneLoading';
import { formatSpeed } from '@/domain/walkthrough/speed';

function TrackpadGuestBridge() {
  const gl = useThree((s) => s.gl);
  const get = useThree((s) => s.get);
  useEffect(
    () => attachTrackpadOrbit(gl.domElement, () => (get().controls as unknown as OrbitLike | null) ?? null),
    [gl, get],
  );
  return null;
}

function ApplyView({ view }: { view: { v: CameraView; n: number } }) {
  const { camera, controls, size } = useThree();
  useEffect(() => {
    const ctrl = controls as unknown as OrbitControlsImpl | null;
    if (!ctrl) return;
    camera.position.set(...view.v.position);
    if ((camera as THREE.OrthographicCamera).isOrthographicCamera && view.v.fitOrtho) {
      (camera as THREE.OrthographicCamera).zoom = Math.min(size.width / view.v.fitOrtho.width, size.height / view.v.fitOrtho.depth);
      camera.updateProjectionMatrix();
    }
    ctrl.target.set(...view.v.target);
    ctrl.update();
  }, [view, camera, controls, size]);
  return null;
}

/** An on/off button: label plus a small switch, so it reads differently from the action buttons. */
function GuestToggle({ label, on, onChange, title, testId, tourButton }: { label: string; on: boolean; onChange: () => void; title?: string; testId?: string; tourButton?: boolean }) {
  return (
    <button type="button" className="btn btn-ghost btn-sm guest-toggle" aria-pressed={on} title={title} onClick={onChange} data-testid={testId} data-tour-button={tourButton || undefined}>
      {label}
      <span className="guest-switch" aria-hidden />
    </button>
  );
}

type FsDoc = Document & { webkitFullscreenEnabled?: boolean; webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void };
const fsDoc = () => document as FsDoc;
const isFullscreen = () => !!(fsDoc().fullscreenElement ?? fsDoc().webkitFullscreenElement);

/** Full screen state and a toggle (iPhones do not allow it for pages: `can` is false there). */
function useFullscreen(): { can: boolean; on: boolean; toggle: () => void } {
  const [on, setOn] = useState(isFullscreen);
  useEffect(() => {
    const h = () => setOn(isFullscreen());
    document.addEventListener('fullscreenchange', h);
    document.addEventListener('webkitfullscreenchange', h);
    return () => {
      document.removeEventListener('fullscreenchange', h);
      document.removeEventListener('webkitfullscreenchange', h);
    };
  }, []);
  const toggle = useCallback(() => {
    const d = fsDoc();
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
    if (isFullscreen()) void (d.exitFullscreen?.() ?? d.webkitExitFullscreen?.());
    else void (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.());
  }, []);
  return { can: !!(fsDoc().fullscreenEnabled || fsDoc().webkitFullscreenEnabled), on, toggle };
}

/** What guests have switched on (starts from the project's guest settings). */
interface GuestShow {
  cutaway: boolean;
  ceilings: boolean;
  notes: boolean;
  rooms: boolean;
  quality: Project['guest']['quality'];
  shadows: boolean;
  layers: Record<string, boolean>;
}

const initialShow = (p: Project): GuestShow => ({
  cutaway: p.guest.wallDisplay === 'cutaway',
  ceilings: p.guest.ceilings,
  notes: p.guest.notes === 'shown',
  rooms: p.guest.roomLabels,
  quality: p.guest.quality,
  shadows: p.guest.shadows,
  layers: Object.fromEntries(guestLayers(p).map((l) => [l.id, l.on])),
});

/** The project as drawn: guest overrides plus the guest's own switches (quality, shadows, item layers). */
function shownProject(source: Project, show: GuestShow): Project {
  const p = guestSceneProject(source);
  const on = (id: string, fallback: boolean) => show.layers[id] ?? fallback;
  return {
    ...p,
    render: { ...p.render, quality: guestRenderQuality(show), shadows: show.shadows },
    itemLayers: p.itemLayers.map((l) => (on(l.id, l.visible) === l.visible ? l : { ...l, visible: on(l.id, l.visible) })),
    layers: { ...p.layers, unassigned: { ...p.layers.unassigned, visible: on('', p.layers.unassigned.visible) } },
  };
}

/** Screen point → plan metres through the plan drawing's current view box. */
function screenToPlan(svg: SVGSVGElement | null | undefined, x: number, y: number): DOMPoint | null {
  const m = svg?.getScreenCTM();
  return m ? new DOMPoint(x, y).matrixTransform(m.inverse()) : null;
}

/** The floor plan drawing with pan and zoom; a click (without dragging) walks to that spot. */
function GuestPlan({ project, onWalk, here }: { project: Project; onWalk: (p: { x: number; y: number }) => void; here: { x: number; y: number } | null }) {
  const [svg, setSvg] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [vb, setVb] = useState<number[] | null>(null);
  const home = useRef<number[]>([0, 0, 10, 10]);
  useEffect(() => {
    let live = true;
    void import('@/features/exports/planExports').then(({ buildPlanImageSvg }) => {
      if (!live) return;
      const s = buildPlanImageSvg(project, { pixelsPerMetre: 60, mode: 'furnished', transparent: false, annotations: true, furniture: true, callouts: false }).svg;
      const m = s.match(/viewBox="([^"]+)"/);
      home.current = (m?.[1] ?? '0 0 10 10').split(/[\s,]+/).map(Number);
      setVb(home.current);
      setSvg(s.replace(/ width="\d+" height="\d+"/, ' width="100%" height="100%" preserveAspectRatio="xMidYMid meet"'));
    });
    return () => {
      live = false;
    };
  }, [project]);
  const svgEl = () => box.current?.querySelector('svg') ?? null;
  useEffect(() => {
    const s = svgEl();
    if (s && vb) s.setAttribute('viewBox', vb.join(' '));
    if (s && here) {
      let g = s.querySelector<SVGGElement>('g.guest-here');
      if (!g) {
        g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', 'guest-here');
        g.innerHTML = '<circle r="0.18" fill="#2e8b74" stroke="#fff" stroke-width="0.06"/>';
        s.append(g);
      }
      g.setAttribute('transform', `translate(${here.x} ${here.y})`);
    }
  });
  const toPlan = (x: number, y: number) => screenToPlan(svgEl(), x, y);
  const drag = useRef<{ x: number; y: number; moved: number } | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = screenToPlan(el.querySelector('svg'), e.clientX, e.clientY);
      if (!p) return;
      setVb((v) => {
        if (!v) return v;
        const h = home.current;
        const w = Math.min(h[2] * 4, Math.max(h[2] / 12, v[2] * Math.exp(e.deltaY * 0.0015)));
        const f = w / v[2];
        return [p.x - (p.x - v[0]) * f, p.y - (p.y - v[1]) * f, v[2] * f, v[3] * f];
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [svg]);
  return (
    <div
      ref={box}
      className="guest-plan"
      data-testid="guest-plan"
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, y: e.clientY, moved: 0 };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const a = toPlan(d.x, d.y);
        const c = toPlan(e.clientX, e.clientY);
        d.moved += Math.hypot(e.clientX - d.x, e.clientY - d.y);
        d.x = e.clientX;
        d.y = e.clientY;
        if (a && c) setVb((v) => (v ? [v[0] - (c.x - a.x), v[1] - (c.y - a.y), v[2], v[3]] : v));
      }}
      onPointerUp={(e) => {
        const d = drag.current;
        drag.current = null;
        if (!d || d.moved > 5) return;
        const p = toPlan(e.clientX, e.clientY);
        if (p) onWalk({ x: p.x, y: p.y });
      }}
      onDoubleClick={() => setVb(home.current)}
      // The markup is our own plan drawing (escaped by React's renderer).
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
    />
  );
}

/**
 * Guest View: a view-only presentation of a local project — no editing tools,
 * selection, handles or measurements. Offers saved views, a 2D plan, a
 * walkthrough with free-fly, a tour, an overview and view switches, following
 * the project's guest settings (the same ones the guest HTML export uses).
 */
export default function GuestPage({ projectId }: { projectId: string }) {
  const [source, setSource] = useState<Project | null>(null);
  const [missing, setMissing] = useState(false);
  const [walk, setWalk] = useState(false);
  const [walkAt, setWalkAt] = useState<{ x: number; y: number; angle: number; n: number } | null>(null);
  const [show, setShow] = useState<GuestShow | null>(null);
  const [panel, setPanel] = useState<{ info: boolean; view: boolean }>({ info: false, view: false });
  const [plan, setPlan] = useState(false);
  const [intro, setIntro] = useState(false);
  const [tour, setTour] = useState(false);
  const isMobile = useIsMobile();
  const fly = useWalkFly();
  const speed = useWalkSpeed();
  const { can: canFullscreen, on: fullscreen, toggle: toggleFullscreen } = useFullscreen();
  // The loading screen stays until the scene has compiled and drawn (as in the editor's 3D view).
  const [ready, setReady] = useState(false);
  const [stage, setStage] = useState<SceneLoadStage>('scene');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const onReady = useCallback(() => setReady(true), []);
  const noop = useCallback(() => {}, []);
  useEffect(() => {
    void loadProject(projectId).then((r) => {
      if (r) {
        const p = r.project;
        setSource(p);
        setShow(initialShow(p));
        setPanel({ info: p.guest.info === 'open' && !isMobile, view: false });
        setReady(false);
        setWalkSpeed(p.guest.walkSpeed);
        setIntro(p.guest.intro);
        if (!p.guest.intro) {
          if (p.guest.startMode === 'walk') setWalk(true);
          else if (p.guest.tour) setTour(true);
        }
        document.title = `${guestTitle(p)} — Guest view`;
      } else setMissing(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);
  const project = useMemo(() => (source && show ? shownProject(source, show) : null), [source, show]);
  const derived = useMemo(() => (source ? derivePlan(source) : null), [source]);
  const views = useMemo(() => {
    if (!source || !derived) return [];
    const out = guestViews(source).map((c) => ({ name: c.name, v: presetView(c) }));
    for (const n of guestAutoViews(source)) out.push({ name: n, v: namedView(n === 'Overview' ? 'home' : 'top', derived.bounds) });
    return out;
  }, [source, derived]);
  const initial = useMemo<CameraView | null>(() => {
    if (!source || !derived) return null;
    const start = source.cameras.find((c) => c.id === source.guest.startCameraId);
    return start ? presetView(start) : namedView('home', derived.bounds);
  }, [source, derived]);
  const [view, setView] = useState<{ v: CameraView; n: number } | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const notesCamera = useRef<THREE.Camera | null>(null);
  useEffect(() => {
    if (initial && !viewRef.current) setView({ v: initial, n: 1 });
  }, [initial]);
  const go = useCallback((v: CameraView) => {
    setWalk(false);
    setPlan(false);
    setView((p) => ({ v, n: (p?.n ?? 0) + 1 }));
  }, []);
  // Tour: the views in turn, slowly orbiting, until the guest takes over.
  useEffect(() => {
    if (!tour || !source || views.length < 2) return;
    let i = 0;
    go(views[0].v);
    const t = window.setInterval(() => {
      i = (i + 1) % views.length;
      go(views[i].v);
    }, source.guest.tourSeconds * 1000);
    const stop = (e: Event) => {
      if (!(e.target as HTMLElement).closest?.('[data-tour-button]')) setTour(false);
    };
    window.addEventListener('pointerdown', stop);
    window.addEventListener('keydown', stop);
    window.addEventListener('wheel', stop);
    return () => {
      window.clearInterval(t);
      window.removeEventListener('pointerdown', stop);
      window.removeEventListener('keydown', stop);
      window.removeEventListener('wheel', stop);
    };
  }, [tour, source, views, go]);
  const overview = useMemo(() => (source && derived ? planOverview(source, derived) : null), [source, derived]);
  const layers = useMemo(() => (source ? guestLayers(source) : []), [source]);

  if (missing)
    return (
      <div className="app-loading">
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
          <strong>Project not found in this browser</strong>
          <Button onClick={() => navigate('/')}>Back to projects</Button>
        </div>
      </div>
    );
  if (!source || !project || !derived || !view || !show || !overview) return <div className="app-loading">Opening guest view…</div>;
  const g = source.guest;
  const r = project.render;
  const ortho = !walk && view.v.projection === 'orthographic';
  const cut = !walk && show.cutaway;
  const notesOn = !walk && show.notes && g.notes !== 'off';
  const quality = r.quality === 'draft' ? 'draft' : r.quality;
  const shadows = r.shadows && quality !== 'draft';
  const set = (patch: Partial<GuestShow>) => setShow((s) => (s ? { ...s, ...patch } : s));
  const u = source.settings;
  const startWalk = (at?: { x: number; y: number }) => {
    setTour(false);
    setPlan(false);
    if (at) setWalkAt((w) => ({ ...at, angle: defaultSpawn(source, derived.faces).angle, n: (w?.n ?? 0) + 1 }));
    else setWalkAt(null);
    setWalk(true);
  };
  return (
    <div className="guest-page" data-testid="guest-page">
      <CanvasMeasureKick />
      {!ready && <SceneLoading stage={stage} progress={progress} />}
      <Canvas
        key={quality === 'draft' ? 'fast' : 'aa'}
        shadows={{ type: THREE.PCFSoftShadowMap, enabled: shadows }}
        dpr={quality === 'draft' ? 1 : [1, 2]}
        gl={{ antialias: quality !== 'draft' }}
        onCreated={(state) => state.setEvents({ compute: clientCompute as never })}
      >
        <color attach="background" args={[r.background]} />
        {!ready && <FirstFrames onCompiled={noop} onReady={onReady} onStage={setStage} onProgress={setProgress} />}
        {ortho ? (
          <OrthographicCamera makeDefault position={view.v.position} zoom={view.v.zoom} near={-200} far={600} />
        ) : (
          <PerspectiveCamera makeDefault position={view.v.position} fov={walk ? r.walkFov : view.v.fov} near={0.05} far={600} />
        )}
        {!walk && <OrbitControls makeDefault enableDamping maxPolarAngle={Math.PI / 2 - 0.02} autoRotate={tour && !ortho} autoRotateSpeed={0.6} />}
        {!walk && <TrackpadGuestBridge />}
        {!walk && <ApplyView view={view} />}
        {walk && (
          <WalkControls
            key={walkAt?.n ?? 0}
            project={project}
            derived={derived}
            onExit={() => setWalk(false)}
            startOverride={walkAt}
            eyeHeight={g.eyeHeight}
            fov={r.walkFov}
          />
        )}
        <Lighting project={project} derived={derived} shadows={shadows} quality={quality} />
        <SceneContent
          project={project}
          derived={derived}
          registry={sharedRegistry}
          options={{
            wallDisplay: cut ? 'cutaway' : 'full',
            cutawayHeight: g.cutawayHeight,
            showCeilings: show.ceilings && !cut,
            showRoomLabels: show.rooms && !walk,
            showDimensions: false,
            quality,
            shadows,
            hiddenCategories: r.hiddenCategories,
            interactive: false,
            showCallouts: notesOn,
          }}
        />
        <NotesViewBridge target={notesCamera} />
      </Canvas>
      <NotesOverlay project={project} derived={derived} camera={notesCamera} visible={notesOn} />
      {plan && <GuestPlan project={project} onWalk={startWalk} here={walk ? null : { x: view.v.target[0], y: view.v.target[2] }} />}
      <div className="guest-side">
        <header className="guest-head floating">
          <div>
            <strong>{guestTitle(source)}</strong>
            <span>{guestSubtitle(source)}</span>
          </div>
          <Button size="sm" variant="ghost" onClick={() => navigate(`/p/${source.id}`)}>
            <ArrowLeft size={14} /> Editor
          </Button>
        </header>
        {panel.info && g.info !== 'off' && (
          <section className="guest-panel floating" aria-label="Overview" data-testid="guest-info">
            <h2>
              Overview
              <button type="button" aria-label="Close overview" onClick={() => setPanel((p) => ({ ...p, info: false }))}>
                <X size={14} />
              </button>
            </h2>
            <dl className="guest-stats">
              {(
                [
                  ['Rooms', String(derived.faces.length)],
                  ['Floor area', formatArea(overview.floorArea, u.areaUnit, u.precision)],
                  ['Items', String(overview.items)],
                  ['Doors', String(overview.doors)],
                  ['Windows', String(overview.windows)],
                  ['Wall length', formatLength(overview.wallLength, u.units, 1)],
                ] as const
              ).map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            {overview.shell && (
              <div className="guest-row">
                <span>Overall size</span>
                <span>
                  {formatLength(overview.shell.maxX - overview.shell.minX, u.units, 2)} × {formatLength(overview.shell.maxY - overview.shell.minY, u.units, 2)}
                </span>
              </div>
            )}
            {overview.rooms.length > 0 && <hr />}
            {overview.rooms.map((rm, i) => (
              <div key={i} className="guest-row">
                <span>{rm.name}</span>
                <span>{formatArea(rm.area, u.areaUnit, 1)}</span>
              </div>
            ))}
          </section>
        )}
        {panel.view && (
          <section className="guest-panel floating" aria-label="View" data-testid="guest-view-panel">
            <h2>
              View
              <button type="button" aria-label="Close view settings" onClick={() => setPanel((p) => ({ ...p, view: false }))}>
                <X size={14} />
              </button>
            </h2>
            <div className="guest-label">Walls while orbiting</div>
            <div className="guest-seg">
              {(['full', 'cutaway'] as const).map((w) => (
                <button key={w} type="button" className={(show.cutaway ? 'cutaway' : 'full') === w ? 'on' : ''} onClick={() => set({ cutaway: w === 'cutaway' })}>
                  {w === 'full' ? 'Full' : 'Cutaway'}
                </button>
              ))}
            </div>
            <label className="guest-check">
              <input type="checkbox" checked={show.ceilings} onChange={(e) => set({ ceilings: e.target.checked })} /> Ceilings
            </label>
            {g.notes !== 'off' && Object.keys(source.callouts).length > 0 && (
              <label className="guest-check">
                <input type="checkbox" checked={show.notes} onChange={(e) => set({ notes: e.target.checked })} /> Notes
              </label>
            )}
            <label className="guest-check">
              <input type="checkbox" checked={show.rooms} onChange={(e) => set({ rooms: e.target.checked })} /> Room names
            </label>
            {layers.length > 0 && <div className="guest-label">{layers.length > 1 ? 'Item layers' : 'Items'}</div>}
            {layers.map((l) => (
              <label key={l.id} className="guest-check">
                <input type="checkbox" checked={show.layers[l.id] ?? l.on} onChange={(e) => set({ layers: { ...show.layers, [l.id]: e.target.checked } })} />
                {layers.length > 1 && l.color && <span className="guest-swatch" style={{ background: l.color }} />}
                {layers.length > 1 ? l.name : 'Furniture & fixtures'}
              </label>
            ))}
            <div className="guest-label">Quality</div>
            <div className="guest-seg">
              {(['fast', 'balanced', 'high'] as const).map((q) => (
                <button key={q} type="button" className={show.quality === q ? 'on' : ''} onClick={() => set({ quality: q })}>
                  {q === 'fast' ? 'Fast' : q === 'balanced' ? 'Balanced' : 'High'}
                </button>
              ))}
            </div>
            <label className="guest-check">
              <input type="checkbox" checked={show.shadows} onChange={(e) => set({ shadows: e.target.checked })} /> Shadows
            </label>
          </section>
        )}
      </div>
      <nav className="guest-views floating" aria-label="Views">
        {views.map((c, i) => (
          <Button key={i} size="sm" variant="ghost" onClick={() => {
              setTour(false);
              go(c.v);
            }}>
            {c.name}
          </Button>
        ))}
        {g.floorPlan && (
          <Button size="sm" variant="ghost" className={plan ? 'on' : ''} onClick={() => {
              setTour(false);
              setWalk(false);
              setPlan(!plan);
            }} data-testid="guest-plan-button">
            2D plan
          </Button>
        )}
      </nav>
      <div className="guest-bar floating">
        <Button size="sm" variant="primary" onClick={() => (walk ? setWalk(false) : startWalk())} data-testid="guest-walk">
          {walk ? <Orbit size={14} /> : <Footprints size={14} />} {walk ? 'Orbit' : 'Walk through'}
        </Button>
        <div className="guest-toggles">
          {walk && <GuestToggle label="Fly" on={fly} onChange={toggleWalkFly} title="Free-fly: move where you look, through walls (F)" testId="guest-fly" />}
          {views.length >= 2 && (
            <GuestToggle
              label="Tour"
              on={tour}
              tourButton
              title="Play the views one after another"
              onChange={() => {
                setWalk(false);
                setTour(!tour);
              }}
            />
          )}
          {g.info !== 'off' && <GuestToggle label="Info" on={panel.info} onChange={() => setPanel((p) => ({ info: !p.info, view: isMobile ? false : p.view }))} />}
          <GuestToggle label="View" on={panel.view} onChange={() => setPanel((p) => ({ view: !p.view, info: isMobile ? false : p.info }))} testId="guest-view-button" />
          {canFullscreen && <GuestToggle label="Full screen" on={fullscreen} onChange={toggleFullscreen} title="Full screen (Esc to leave)" />}
        </div>
      </div>
      <div className="walk-hud guest-hint floating" role="status">
        {plan
          ? 'Drag to pan · scroll to zoom · click a spot to walk there'
          : walk
            ? isMobile
              ? 'Left pad to move · drag right side to look'
              : fly
                ? `Flying: move where you look · Space/E up · Q/C down · wheel: speed ${formatSpeed(speed)} · F to walk · Esc to stop`
                : `Click or two-finger swipe to look · WASD or pinch to move · Shift to run · F to fly · wheel: speed ${formatSpeed(speed)} · Esc to stop`
            : isMobile
              ? 'Drag to orbit · pinch to zoom'
              : 'Drag or two-finger swipe to orbit · Shift-swipe or Space-drag to pan · pinch to zoom'}
      </div>
      {walk && isMobile && <TouchControls />}
      {intro && (
        <div className="guest-intro" role="dialog" aria-label="Welcome">
          <div className="guest-intro-card">
            <h1>{guestTitle(source)}</h1>
            {g.subtitle.trim() && <p className="guest-intro-sub">{g.subtitle.trim()}</p>}
            {g.welcome.trim() && <p className="guest-intro-text">{g.welcome.trim()}</p>}
            <Button
              variant="primary"
              autoFocus
              onClick={() => {
                setIntro(false);
                if (g.startMode === 'walk') startWalk();
                else if (g.tour) setTour(true);
              }}
            >
              {g.startMode === 'walk' ? 'Start walking' : g.tour ? 'Start the tour' : 'Start exploring'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

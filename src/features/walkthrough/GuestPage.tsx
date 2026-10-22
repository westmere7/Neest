import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, OrthographicCamera } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { ArrowLeft, Footprints, Orbit } from 'lucide-react';
import type { Project } from '@/domain/model/schema';
import { derivePlan } from '@/domain/geometry/derive';
import { loadProject } from '@/features/projects/projectService';
import { Lighting, SceneContent } from '@/features/scene-3d/SceneContent';
import { sharedRegistry } from '@/features/scene-3d/sceneRuntime';
import { namedView, presetView, type CameraView } from '@/features/scene-3d/cameraViews';
import { Button } from '@/components/ui';
import { useIsMobile } from '@/components/hooks';
import { navigate } from '@/app/App';
import { WalkControls } from './WalkControls';
import { TouchControls } from './TouchControls';
import { CanvasMeasureKick, clientCompute } from '@/features/scene-3d/useCanvasMeasureFix';
import { attachTrackpadOrbit, type OrbitLike } from '@/features/scene-3d/trackpadOrbit';
import '@/features/scene-3d/scene3d.css';
import { NotesOverlay, NotesViewBridge } from '@/features/callouts/NotesOverlay';

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

/**
 * Guest View: a view-only presentation of a local project — no editing tools,
 * selection, handles or measurements. Offers saved views and a walkthrough.
 */
export default function GuestPage({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [missing, setMissing] = useState(false);
  const [walk, setWalk] = useState(false);
  const isMobile = useIsMobile();
  useEffect(() => {
    void loadProject(projectId).then((r) => {
      if (r) {
        setProject(r.project);
        document.title = `${r.project.name} — Guest view`;
      } else setMissing(true);
    });
  }, [projectId]);
  const derived = useMemo(() => (project ? derivePlan(project) : null), [project]);
  const initial = useMemo<CameraView | null>(() => {
    if (!project || !derived) return null;
    const start = project.cameras.find((c) => c.id === project.guest.startCameraId);
    return start ? presetView(start) : namedView('home', derived.bounds);
  }, [project, derived]);
  const [view, setView] = useState<{ v: CameraView; n: number } | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const notesCamera = useRef<THREE.Camera | null>(null);
  useEffect(() => {
    if (initial && !viewRef.current) setView({ v: initial, n: 1 });
  }, [initial]);
  const go = useCallback((v: CameraView) => {
    setWalk(false);
    setView((p) => ({ v, n: (p?.n ?? 0) + 1 }));
  }, []);
  if (missing)
    return (
      <div className="app-loading">
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
          <strong>Project not found in this browser</strong>
          <Button onClick={() => navigate('/')}>Back to projects</Button>
        </div>
      </div>
    );
  if (!project || !derived || !view) return <div className="app-loading">Opening guest view…</div>;
  const r = project.render;
  const ortho = !walk && view.v.projection === 'orthographic';
  return (
    <div className="guest-page" data-testid="guest-page">
      <CanvasMeasureKick />
      <Canvas
        shadows={{ type: THREE.PCFSoftShadowMap, enabled: r.shadows }}
        dpr={[1, 2]}
        gl={{ antialias: true }}
        onCreated={(state) => state.setEvents({ compute: clientCompute as never })}
      >
        <color attach="background" args={[r.background]} />
        {ortho ? (
          <OrthographicCamera makeDefault position={view.v.position} zoom={view.v.zoom} near={-200} far={600} />
        ) : (
          <PerspectiveCamera makeDefault position={view.v.position} fov={walk ? 70 : view.v.fov} near={0.05} far={600} />
        )}
        {!walk && <OrbitControls makeDefault enableDamping maxPolarAngle={Math.PI / 2 - 0.02} />}
        {!walk && <TrackpadGuestBridge />}
        {!walk && <ApplyView view={view} />}
        {walk && <WalkControls project={project} derived={derived} onExit={() => setWalk(false)} />}
        <Lighting project={project} derived={derived} shadows={r.shadows} quality={r.quality === 'draft' ? 'balanced' : r.quality} />
        <SceneContent
          project={project}
          derived={derived}
          registry={sharedRegistry}
          options={{
            wallDisplay: walk ? 'full' : r.wallDisplay,
            cutawayHeight: r.cutawayHeight,
            showCeilings: walk || r.showCeilings,
            showRoomLabels: false,
            showDimensions: false,
            quality: r.quality === 'draft' ? 'balanced' : r.quality,
            shadows: r.shadows,
            hiddenCategories: r.hiddenCategories,
            interactive: false,
            showCallouts: !walk,
          }}
        />
        <NotesViewBridge target={notesCamera} />
      </Canvas>
      <NotesOverlay project={project} derived={derived} camera={notesCamera} visible={!walk} />
      <header className="guest-head floating">
        <div>
          <strong>{project.name}</strong>
          <span>Guest view · view only</span>
        </div>
        <Button size="sm" variant="ghost" onClick={() => navigate(`/p/${project.id}`)}>
          <ArrowLeft size={14} /> Editor
        </Button>
      </header>
      <nav className="guest-views floating" aria-label="Views">
        <Button size="sm" variant="ghost" onClick={() => go(namedView('home', derived.bounds))}>
          Overview
        </Button>
        <Button size="sm" variant="ghost" onClick={() => go(namedView('top', derived.bounds))}>
          Top
        </Button>
        {project.cameras.map((c) => (
          <Button key={c.id} size="sm" variant="ghost" onClick={() => go(presetView(c))}>
            {c.name}
          </Button>
        ))}
        <Button size="sm" variant="primary" onClick={() => setWalk(!walk)} data-testid="guest-walk">
          {walk ? <Orbit size={14} /> : <Footprints size={14} />} {walk ? 'Orbit' : 'Walk through'}
        </Button>
      </nav>
      <div className="walk-hud guest-hint floating" role="status">
        {walk
          ? isMobile
            ? 'Left pad to move · drag right side to look'
            : 'Click or two-finger swipe to look · WASD or pinch to move · Shift to run · Esc to stop'
          : isMobile
            ? 'Drag to orbit · pinch to zoom'
            : 'Drag or two-finger swipe to orbit · Shift-swipe or Space-drag to pan · pinch to zoom'}
      </div>
      {walk && isMobile && <TouchControls />}
    </div>
  );
}

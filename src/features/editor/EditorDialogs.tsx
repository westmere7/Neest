import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { AreaUnit, LengthUnit } from '@/domain/model/schema';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore } from '@/state/editorStore';
import { useDialogStore, toast } from '@/state/uiStores';
import { Dialog, PanelLoading } from '@/components/Overlays';
import { Button, LengthField, Segmented, Select, Toggle, TextField } from '@/components/ui';
import { ReplaceMaterialDialog } from '@/features/materials/MaterialUI';
import { downloadBlob, exportFilename } from '@/features/exports/neestFile';
import { SHORTCUT_LIST } from './useShortcuts';

const loadExport = () => import('@/features/exports/ExportDialog');
const ExportPanel = lazy(() => loadExport().then((m) => ({ default: m.ExportPanel })));

/** Warms the export code so the panel content is usually ready by the time it is clicked. */
export function preloadExport(): void {
  void loadExport();
}
const ImportModelDialog = lazy(() => import('@/features/library/ImportModelDialog').then((m) => ({ default: m.ImportModelDialog })));

export function EditorDialogs() {
  const open = useDialogStore((s) => s.openDialog);
  const props = useDialogStore((s) => s.dialogProps);
  const close = useDialogStore((s) => s.close);
  if (!open) return null;
  return (
    <Suspense fallback={null}>
      {open === 'export' && (
        <Dialog title="Export" onClose={close} wide="xl" testId="export-dialog">
          <Suspense fallback={<PanelLoading text="Loading export options…" />}>
            <ExportPanel onClose={close} />
          </Suspense>
        </Dialog>
      )}
      {open === 'render' && <RenderDialog onClose={close} />}
      {open === 'settings' && <SettingsDialog onClose={close} />}
      {open === 'shortcuts' && <ShortcutsDialog onClose={close} />}
      {open === 'import-model' && (
        <Suspense
          fallback={
            <Dialog title="Import 3D model" onClose={close} wide>
              <PanelLoading text="Loading importer…" />
            </Dialog>
          }
        >
          <ImportModelDialog onClose={close} />
        </Suspense>
      )}
      {open === 'mobile-info' && <MobileInfoDialog onClose={close} />}
      {open === 'replace-material' && <ReplaceMaterialDialog materialId={props.materialId as string} onClose={close} />}
    </Suspense>
  );
}

const ASPECTS = {
  '16:9': 16 / 9,
  '3:2': 3 / 2,
  '4:3': 4 / 3,
  '1:1': 1,
  '9:16': 9 / 16,
} as const;
type Aspect = keyof typeof ASPECTS;

type RenderEngine = 'realtime' | 'pathtrace';

const SAMPLE_PRESETS = [
  { value: '32', label: 'Preview · 32 samples' },
  { value: '128', label: 'Good · 128 samples' },
  { value: '512', label: 'High · 512 samples' },
  { value: '1024', label: 'Final · 1024 samples' },
];

function RenderDialog({ onClose }: { onClose: () => void }) {
  const project = useProjectStore((s) => s.project!);
  const workspace = useEditorStore((s) => s.workspace);
  const [engine, setEngine] = useState<RenderEngine>('realtime');
  const [aspect, setAspect] = useState<Aspect>('16:9');
  const [long, setLong] = useState(1920);
  const [transparent, setTransparent] = useState(false);
  const [helpers, setHelpers] = useState(false);
  const [samples, setSamples] = useState(128);
  const [bounces, setBounces] = useState(5);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ samples: number; target: number; phase: 'building' | 'tracing'; started: number } | null>(null);
  const [result, setResult] = useState<{ url: string; blob: Blob; w: number; h: number; engine: RenderEngine; samples?: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stopEarly = useRef(false);
  const liveHost = useRef<HTMLDivElement>(null);
  const ratio = ASPECTS[aspect];
  const w = ratio >= 1 ? long : Math.round(long * ratio);
  const h = ratio >= 1 ? Math.round(long / ratio) : long;
  const needs3d = workspace === 'plan';
  useEffect(
    () => () => {
      if (result) URL.revokeObjectURL(result.url);
    },
    [result],
  );
  useEffect(() => () => abortRef.current?.abort(), []);

  const show = (blob: Blob, extra: { engine: RenderEngine; samples?: number }) =>
    setResult((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return { url: URL.createObjectURL(blob), blob, w, h, ...extra };
    });

  const render = async () => {
    setBusy(true);
    try {
      if (engine === 'realtime') {
        const { captureView } = await import('@/features/scene-3d/sceneRuntime');
        show(await captureView({ width: w, height: h, transparent, includeHelpers: helpers }), { engine });
      } else {
        const { renderPathTraced } = await import('@/features/scene-3d/pathTrace');
        const ac = new AbortController();
        abortRef.current = ac;
        stopEarly.current = false;
        setResult(null);
        const started = performance.now();
        let reached = 0;
        const blob = await renderPathTraced(project, {
          width: w,
          height: h,
          samples,
          bounces,
          transparent,
          signal: ac.signal,
          stopEarly,
          onCanvas: (canvas) => {
            canvas.className = 'pt-live';
            liveHost.current?.replaceChildren(canvas);
          },
          onProgress: (p) => {
            reached = p.samples;
            setProgress({ ...p, started });
          },
        });
        show(blob, { engine, samples: reached });
        liveHost.current?.replaceChildren();
        toast.success('Path-traced render finished', `${reached} samples in ${Math.round((performance.now() - started) / 1000)} s.`);
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') toast.info('Render cancelled');
      else toast.error('Render failed', e instanceof Error ? e.message : undefined);
      liveHost.current?.replaceChildren();
    } finally {
      abortRef.current = null;
      setProgress(null);
      setBusy(false);
    }
  };

  const elapsed = progress ? (performance.now() - progress.started) / 1000 : 0;
  const eta = progress && progress.samples > 0 ? (elapsed / progress.samples) * (progress.target - progress.samples) : null;
  const tracing = busy && engine === 'pathtrace';

  return (
    <Dialog
      title="Render image"
      onClose={() => {
        abortRef.current?.abort();
        onClose();
      }}
      wide
      testId="render-dialog"
      footer={
        <>
          <Button
            onClick={() => {
              abortRef.current?.abort();
              onClose();
            }}
          >
            {tracing ? 'Cancel & close' : 'Close'}
          </Button>
          {tracing && (
            <Button onClick={() => (stopEarly.current = true)} data-testid="stop-render">
              Stop & keep image
            </Button>
          )}
          {result && !busy && (
            <Button
              onClick={() =>
                downloadBlob(
                  result.blob,
                  exportFilename(project.name, `${result.engine === 'pathtrace' ? `pathtraced-${result.samples}spp` : 'render'}-${result.w}x${result.h}`, 'png'),
                )
              }
              data-testid="download-render"
            >
              Download PNG
            </Button>
          )}
          <Button variant="primary" disabled={busy || needs3d} onClick={() => void render()} data-testid="do-render">
            {busy ? (engine === 'pathtrace' ? 'Tracing…' : 'Rendering…') : result ? 'Render again' : 'Render'}
          </Button>
        </>
      }
    >
      {needs3d ? (
        <div className="notice">
          Renders use the current 3D camera.{' '}
          <Button size="sm" onClick={() => useEditorStore.getState().set({ workspace: '3d' })}>
            Switch to 3D
          </Button>
        </div>
      ) : (
        <div className="render-grid">
          <div className="form-grid">
            <Segmented<RenderEngine>
              label="Renderer"
              value={engine}
              onChange={(v) => !busy && setEngine(v)}
              options={[
                { value: 'realtime', label: 'Real-time', title: 'Instant rasterised render (what you see in the viewport)', testId: 'engine-realtime' },
                { value: 'pathtrace', label: 'Path traced', title: 'Physically based ray tracing: soft global illumination, accurate shadows and reflections', testId: 'engine-pathtrace' },
              ]}
            />
            <Segmented label="Aspect ratio" size="sm" value={aspect} onChange={setAspect} options={Object.keys(ASPECTS).map((a) => ({ value: a as Aspect, label: a }))} />
            <Select
              label="Resolution"
              value={String(long)}
              onChange={(v) => setLong(parseInt(v, 10))}
              options={[1280, 1920, 2560, 3840].map((v) => ({ value: String(v), label: `${v}px long side` }))}
            />
            {engine === 'pathtrace' && (
              <>
                <Select label="Quality (samples per pixel)" value={String(samples)} onChange={(v) => setSamples(parseInt(v, 10))} options={SAMPLE_PRESETS} />
                <Select
                  label="Light bounces"
                  value={String(bounces)}
                  onChange={(v) => setBounces(parseInt(v, 10))}
                  options={[
                    { value: '3', label: '3 — faster, darker interiors' },
                    { value: '5', label: '5 — balanced' },
                    { value: '8', label: '8 — brightest indirect light' },
                  ]}
                />
              </>
            )}
            <Toggle label="Transparent background" checked={transparent} onChange={setTransparent} />
            {engine === 'realtime' && <Toggle label="Include helpers (grid, selection)" checked={helpers} onChange={setHelpers} />}
            <p className="export-summary">
              <strong>PNG</strong> · {w} × {h} px ·{' '}
              {engine === 'pathtrace' ? `${samples} samples, ${bounces} bounces` : `quality “${project.render.quality}”, shadows ${project.render.shadows ? 'on' : 'off'}`}
            </p>
            {progress && (
              <div className="pt-progress" role="status" aria-live="polite">
                <div className="pt-bar">
                  <span style={{ width: `${progress.phase === 'building' ? 4 : Math.min(100, (progress.samples / progress.target) * 100)}%` }} />
                </div>
                <span className="field-hint num">
                  {progress.phase === 'building'
                    ? 'Preparing geometry (building the ray-tracing acceleration structure)…'
                    : `${progress.samples} / ${progress.target} samples · ${Math.round(elapsed)} s${eta !== null ? ` · ~${Math.max(1, Math.round(eta))} s left` : ''}`}
                </span>
              </div>
            )}
            <p className="field-hint">
              {engine === 'pathtrace'
                ? 'Path tracing simulates light physically (global illumination, soft shadows, reflections, glass, glowing lamps) on your GPU in the browser — no cloud. The image refines as samples accumulate; stop any time to keep the current result. Geometry, materials and wall display match the 3D view.'
                : 'Uses the exact on-screen camera position, direction and vertical field of view; other aspect ratios widen or narrow the frame. Real-time rasterised rendering — set quality to High in the 3D panel for the best result.'}
            </p>
          </div>
          <div className="render-preview" style={{ aspectRatio: `${w} / ${h}` }}>
            <div ref={liveHost} className="pt-host" />
            {!tracing && (result ? <img src={result.url} alt="Rendered view" /> : <span className="field-hint">Preview appears here</span>)}
          </div>
        </div>
      )}
    </Dialog>
  );
}

function SettingsDialog({ onClose }: { onClose: () => void }) {
  const project = useProjectStore((s) => s.project!);
  const s = project.settings;
  const exec = useProjectStore((st) => st.execute);
  return (
    <Dialog title="Project settings" onClose={onClose} wide testId="settings-dialog">
      <div className="settings-grid">
        <section>
          <h3>Project</h3>
          <TextField label="Name" value={project.name} onCommit={(name) => exec('Rename project', (d) => void (d.name = name))} />
          <p className="field-hint">Created {new Date(project.createdAt).toLocaleString()}</p>
        </section>
        <section>
          <h3>Units & precision</h3>
          <Select<LengthUnit>
            label="Length units"
            value={s.units}
            onChange={(units) => exec('Change units', (d) => void (d.settings.units = units))}
            options={[
              { value: 'mm', label: 'Millimetres' },
              { value: 'cm', label: 'Centimetres' },
              { value: 'm', label: 'Metres' },
              { value: 'ft', label: 'Feet & inches' },
              { value: 'in', label: 'Inches' },
            ]}
          />
          <Select
            label="Display precision"
            value={String(s.precision)}
            onChange={(v) => exec('Change precision', (d) => void (d.settings.precision = parseInt(v, 10)))}
            options={[0, 1, 2, 3].map((p) => ({ value: String(p), label: `${p}` }))}
          />
          <Select<AreaUnit>
            label="Area units"
            value={s.areaUnit}
            onChange={(areaUnit) => exec('Change area units', (d) => void (d.settings.areaUnit = areaUnit))}
            options={[
              { value: 'm2', label: 'Square metres (m²)' },
              { value: 'ft2', label: 'Square feet (ft²)' },
            ]}
          />
          <LengthField label="Grid spacing" value={s.gridSize} unit={s.units} precision={3} min={0.01} max={5} onCommit={(v) => exec('Change grid', (d) => void (d.settings.gridSize = v))} />
        </section>
        <section>
          <h3>Default walls</h3>
          <LengthField label="Wall height" value={s.defaultWall.height} unit={s.units} precision={s.precision} min={0.5} max={12} onCommit={(v) => exec('Change default height', (d) => void (d.settings.defaultWall.height = v))} />
          <LengthField label="Interior thickness" value={s.defaultWall.thickness} unit={s.units} precision={s.precision} min={0.02} max={2} onCommit={(v) => exec('Change default thickness', (d) => void (d.settings.defaultWall.thickness = v))} />
          <LengthField label="Exterior thickness" value={s.exteriorThickness} unit={s.units} precision={s.precision} min={0.02} max={2} onCommit={(v) => exec('Change exterior thickness', (d) => void (d.settings.exteriorThickness = v))} />
          <p className="field-hint">Applies to new walls. Existing walls keep their values.</p>
        </section>
        <section>
          <h3>Storage</h3>
          <p className="field-hint">
            This project is saved automatically in this browser (IndexedDB). Use Export → Project file to keep a backup or move it to another device.
          </p>
          <Button
            size="sm"
            onClick={async () => {
              const { exportNeest } = await import('@/features/exports/neestFile');
              downloadBlob(await exportNeest(project), exportFilename(project.name, 'project', 'neest'));
            }}
          >
            Download backup (.neest)
          </Button>
        </section>
      </div>
    </Dialog>
  );
}

function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="Keyboard shortcuts" onClose={onClose} wide>
      <dl className="shortcut-list">
        {SHORTCUT_LIST.map((s) => (
          <div key={s.keys}>
            <dt>
              <kbd>{s.keys}</kbd>
            </dt>
            <dd>{s.action}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}

function MobileInfoDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="Drafting on a desktop" onClose={onClose}>
      <p className="confirm-text">
        On phones you can open projects, inspect the plan in 2D and 3D, walk through, select furniture or rooms, change sizes and finishes, place
        furniture and export images, walkthroughs and project files.
      </p>
      <p className="confirm-text" style={{ marginTop: 10 }}>
        Drawing and editing walls, precise dimension entry, splitting walls, and scaled drawing sheets (PDF/SVG/DXF) need a mouse and a larger screen. Open
        this project on a desktop browser — export a .neest file to move it.
      </p>
    </Dialog>
  );
}

import { useDeferredValue, useMemo, useState } from 'react';
import { Box, FileCode2, FileImage, FileJson, FileText, Footprints, Image as ImageIcon, PackageOpen, PenTool } from 'lucide-react';
import type { Project } from '@/domain/model/schema';
import { useProjectStore } from '@/state/projectStore';
import { useDialogStore, toast } from '@/state/uiStores';
import { Button, Segmented, Select, Toggle } from '@/components/ui';
import { useIsMobile } from '@/components/hooks';
import type { PlanMode } from '@/state/editorStore';
import { buildSheet, defaultSheetOptions, describeSheet, PAPER_MM, SCALE_PRESETS, type PaperSize, type SheetOptions } from './sheet';
import { buildPlanImageSvg, rasterizeSvg, sheetPixelSize, sheetToPdf, svgBlob } from './planExports';
import { downloadBlob, exportFilename, exportNeest } from './neestFile';
import { buildDxf, type DxfUnit } from './dxf';
import { buildReport } from './report';
import { PanelLoading } from '@/components/Overlays';
import './exports.css';

type Format = 'pdf' | 'svg' | 'png-sheet' | 'png-plan' | 'dxf' | 'glb' | 'render' | 'guest' | 'neest' | 'json';

const FORMATS: { id: Format; label: string; sub: string; icon: React.ReactNode; desktop: boolean }[] = [
  { id: 'pdf', label: 'Plan sheet — PDF', sub: 'Vector, to scale, print-ready', icon: <FileText size={16} />, desktop: true },
  { id: 'svg', label: 'Plan sheet — SVG', sub: 'Vector with selectable text', icon: <PenTool size={16} />, desktop: true },
  { id: 'png-sheet', label: 'Plan sheet — PNG', sub: 'Raster at chosen DPI', icon: <FileImage size={16} />, desktop: true },
  { id: 'png-plan', label: 'Plan image — PNG', sub: 'Plan only, chosen resolution', icon: <ImageIcon size={16} />, desktop: false },
  { id: 'dxf', label: 'CAD — DXF', sub: 'R12 linework, layers, labels', icon: <FileCode2 size={16} />, desktop: true },
  { id: 'glb', label: '3D model — GLB', sub: 'Geometry, transforms, materials', icon: <Box size={16} />, desktop: false },
  { id: 'render', label: '3D image — PNG', sub: 'Current camera view', icon: <ImageIcon size={16} />, desktop: false },
  { id: 'guest', label: 'Guest walkthrough — HTML', sub: 'Single file, opens offline', icon: <Footprints size={16} />, desktop: false },
  { id: 'neest', label: 'Project file — .neest', sub: 'Backup, move or share', icon: <PackageOpen size={16} />, desktop: false },
  { id: 'json', label: 'Summary — JSON', sub: 'Rooms, inventory, materials', icon: <FileJson size={16} />, desktop: false },
];

/** Export dialog body. The dialog frame lives in EditorDialogs so it opens instantly while this code loads. */
export function ExportPanel({ onClose }: { onClose: () => void }) {
  const project = useProjectStore((s) => s.project!);
  const isMobile = useIsMobile();
  const [format, setFormat] = useState<Format>(isMobile ? 'render' : 'pdf');
  const [busy, setBusy] = useState(false);
  const formats = FORMATS.filter((f) => !isMobile || !f.desktop);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error('Export failed', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="export-layout">
        <nav className="export-formats" aria-label="Export format">
          {formats.map((f) => (
            <button key={f.id} type="button" className={`export-format${format === f.id ? ' on' : ''}`} onClick={() => setFormat(f.id)} aria-pressed={format === f.id} data-testid={`export-${f.id}`}>
              <span className="ef-icon">{f.icon}</span>
              <span className="ef-text">
                <strong>{f.label}</strong>
                <span>{f.sub}</span>
              </span>
            </button>
          ))}
          {isMobile && <p className="field-hint pad">Scaled drawing sheets and DXF are available on desktop.</p>}
        </nav>
        <div className="export-options">
          {(format === 'pdf' || format === 'svg' || format === 'png-sheet') && <SheetExport project={project} format={format} busy={busy} run={run} />}
          {format === 'png-plan' && <PlanImageExport project={project} busy={busy} run={run} />}
          {format === 'dxf' && <DxfExport project={project} busy={busy} run={run} />}
          {format === 'glb' && <GlbExport project={project} busy={busy} run={run} />}
          {format === 'render' && (
            <div className="export-pane">
              <h3>3D image</h3>
              <p className="field-hint">Renders the current 3D camera at a chosen resolution and aspect ratio, with optional transparent background.</p>
              <Button
                variant="primary"
                onClick={() => {
                  onClose();
                  useDialogStore.getState().open('render');
                }}
              >
                Open render settings
              </Button>
            </div>
          )}
          {format === 'guest' && <GuestExport project={project} busy={busy} run={run} />}
          {format === 'neest' && (
            <div className="export-pane">
              <h3>Project file</h3>
              <p className="field-hint">
                A versioned <code>.neest</code> archive (ZIP with manifest) containing the full project and any imported 3D models. Import it from the
                project launcher on any device.
              </p>
              <dl className="stats num">
                <div>
                  <dt>Walls</dt>
                  <dd>{Object.keys(project.walls).length}</dd>
                </div>
                <div>
                  <dt>Objects</dt>
                  <dd>{Object.keys(project.objects).length}</dd>
                </div>
                <div>
                  <dt>Imported models</dt>
                  <dd>{Object.keys(project.customAssets).length}</dd>
                </div>
              </dl>
              <Button
                variant="primary"
                disabled={busy}
                data-testid="download-neest"
                onClick={() => run(async () => downloadBlob(await exportNeest(project), exportFilename(project.name, 'project', 'neest')))}
              >
                Download .neest
              </Button>
            </div>
          )}
          {format === 'json' && (
            <div className="export-pane">
              <h3>Summary report</h3>
              <p className="field-hint">Room areas and perimeters, door/window counts, furniture inventory and material usage as JSON.</p>
              <pre className="json-preview">{JSON.stringify(buildReport(project).totals, null, 2)}</pre>
              <Button
                variant="primary"
                disabled={busy}
                onClick={() =>
                  run(async () => downloadBlob(new Blob([JSON.stringify(buildReport(project), null, 2)], { type: 'application/json' }), exportFilename(project.name, 'summary', 'json')))
                }
              >
                Download JSON
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

interface PaneProps {
  project: Project;
  busy: boolean;
  run: (fn: () => Promise<void>) => Promise<void>;
}

function SheetExport({ project, format, busy, run }: PaneProps & { format: 'pdf' | 'svg' | 'png-sheet' }) {
  const [o, setO] = useState<SheetOptions>(() => defaultSheetOptions(project));
  const [dpi, setDpi] = useState(200);
  const set = (patch: Partial<SheetOptions>) => setO((x) => ({ ...x, ...patch }));
  const effective = useMemo<SheetOptions>(
    () => ({ ...o, textures: format === 'pdf' ? false : o.textures, halo: format !== 'pdf' }),
    [o, format],
  );
  // Build the (expensive) vector sheet after the controls have painted, and keep the last preview while options change.
  const deferred = useDeferredValue<SheetOptions | null>(effective, null);
  const sheet = useMemo(() => (deferred ? buildSheet(project, deferred) : null), [project, deferred]);
  const stale = deferred !== effective;
  const pxSize = sheet ? sheetPixelSize(sheet, dpi) : { width: 0, height: 0, clamped: false };
  const download = () =>
    run(async () => {
      if (!sheet) return;
      const name = exportFilename(project.name, `plan-1-${sheet.scale}-${o.paper}`, format === 'png-sheet' ? 'png' : format);
      if (format === 'svg') downloadBlob(svgBlob(sheet.svg), name);
      else if (format === 'pdf') downloadBlob(await sheetToPdf(sheet), name);
      else downloadBlob(await rasterizeSvg(sheet.svg, pxSize.width, pxSize.height, '#ffffff'), name);
    });
  return (
    <div className="sheet-export">
      <div className="sheet-controls">
        <div className="grid-2">
          <Select<PaperSize> label="Paper" value={o.paper} onChange={(paper) => set({ paper })} options={Object.keys(PAPER_MM).map((p) => ({ value: p as PaperSize, label: p }))} />
          <Select
            label="Orientation"
            value={o.orientation}
            onChange={(orientation) => set({ orientation })}
            options={[
              { value: 'landscape', label: 'Landscape' },
              { value: 'portrait', label: 'Portrait' },
            ]}
          />
          <Select
            label="Scale"
            value={String(o.scale)}
            onChange={(v) => set({ scale: v === 'fit' ? 'fit' : parseInt(v, 10) })}
            options={[{ value: 'fit', label: 'Fit to page' }, ...SCALE_PRESETS.map((s) => ({ value: String(s), label: `1:${s}` }))]}
          />
          <Select<PlanMode>
            label="Style"
            value={o.mode}
            onChange={(mode) => set({ mode })}
            options={[
              { value: 'draft', label: 'Technical (draft)' },
              { value: 'furnished', label: 'Furnished colour' },
              { value: 'presentation', label: 'Presentation' },
            ]}
          />
          <Select
            label="Units"
            value={o.units}
            onChange={(units) => set({ units })}
            options={[
              { value: 'mm', label: 'mm' },
              { value: 'cm', label: 'cm' },
              { value: 'm', label: 'm' },
              { value: 'ft', label: 'ft-in' },
              { value: 'in', label: 'in' },
            ]}
          />
          <Select
            label="Precision"
            value={String(o.precision)}
            onChange={(v) => set({ precision: parseInt(v, 10) })}
            options={[0, 1, 2, 3].map((p) => ({ value: String(p), label: `${p} decimals` }))}
          />
        </div>
        <div className="toggle-grid">
          <Toggle label="Overall dimensions" checked={o.overallDims} onChange={(v) => set({ overallDims: v })} />
          <Toggle label="Wall lengths" checked={o.wallDims} onChange={(v) => set({ wallDims: v })} />
          <Toggle label="Room dimensions" checked={o.roomDims} onChange={(v) => set({ roomDims: v })} />
          <Toggle label="Room names" checked={o.roomLabels} onChange={(v) => set({ roomLabels: v })} />
          <Toggle label="Room areas" checked={o.roomAreas} onChange={(v) => set({ roomAreas: v })} />
          <Toggle label="Furniture" checked={o.furniture} onChange={(v) => set({ furniture: v })} />
          <Toggle label="Title block" checked={o.titleBlock} onChange={(v) => set({ titleBlock: v })} />
          <Toggle label="Scale bar" checked={o.scaleBar} onChange={(v) => set({ scaleBar: v })} />
          <Toggle label="Legend & room schedule" checked={o.legend} onChange={(v) => set({ legend: v })} />
          {format !== 'pdf' && o.mode !== 'draft' && <Toggle label="Textured floors" checked={o.textures} onChange={(v) => set({ textures: v })} />}
        </div>
        {format === 'png-sheet' && (
          <Segmented
            label="Resolution"
            size="sm"
            value={String(dpi)}
            onChange={(v) => setDpi(parseInt(v, 10))}
            options={[96, 150, 200, 300].map((d) => ({ value: String(d), label: `${d} dpi` }))}
          />
        )}
        <div className="export-summary" data-testid="export-summary">
          <strong>{format === 'pdf' ? 'PDF' : format === 'svg' ? 'SVG' : 'PNG'}</strong> · {sheet ? describeSheet(sheet, o) : 'preparing preview…'}
          {format === 'png-sheet' && sheet && ` · ${pxSize.width} × ${pxSize.height} px${pxSize.clamped ? ' (limited by browser)' : ''}`}
          {format === 'pdf' && ' · vector linework, flat colours'}
        </div>
        {sheet?.warnings.map((w) => (
          <p key={w} className="notice" role="alert">
            {w}
          </p>
        ))}
        <Button variant="primary" onClick={download} disabled={busy || !sheet || stale} data-testid="download-sheet">
          {busy ? 'Preparing…' : `Download ${format === 'png-sheet' ? 'PNG' : format.toUpperCase()}`}
        </Button>
      </div>
      <div className="sheet-preview" aria-label="Sheet preview">
        {sheet ? (
          <div
            className="sheet-paper"
            style={{ aspectRatio: `${sheet.widthMm} / ${sheet.heightMm}`, opacity: stale ? 0.6 : 1 }}
            dangerouslySetInnerHTML={{ __html: sheet.svg.replace(/width="[^"]+mm" height="[^"]+mm"/, 'width="100%" height="100%"') }}
          />
        ) : (
          <PanelLoading text="Preparing preview…" />
        )}
      </div>
    </div>
  );
}

function PlanImageExport({ project, busy, run }: PaneProps) {
  const [ppm, setPpm] = useState(100);
  const [mode, setMode] = useState<PlanMode>('furnished');
  const [transparent, setTransparent] = useState(false);
  const [annotations, setAnnotations] = useState(true);
  const [furniture, setFurniture] = useState(true);
  const img = useMemo(() => buildPlanImageSvg(project, { pixelsPerMetre: ppm, mode, transparent, annotations, furniture }), [project, ppm, mode, transparent, annotations, furniture]);
  return (
    <div className="sheet-export">
      <div className="sheet-controls">
        <Segmented
          label="Style"
          size="sm"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'draft', label: 'Draft' },
            { value: 'furnished', label: 'Furnished' },
            { value: 'presentation', label: 'Presentation' },
          ]}
        />
        <Segmented
          label="Resolution"
          size="sm"
          value={String(ppm)}
          onChange={(v) => setPpm(parseInt(v, 10))}
          options={[50, 100, 200, 300].map((d) => ({ value: String(d), label: `${d} px/m` }))}
        />
        <Toggle label="Transparent background" checked={transparent} onChange={setTransparent} />
        <Toggle label="Labels & dimensions" checked={annotations} onChange={setAnnotations} />
        <Toggle label="Furniture" checked={furniture} onChange={setFurniture} />
        <div className="export-summary">
          <strong>PNG</strong> · {img.width} × {img.height} px
        </div>
        <Button
          variant="primary"
          disabled={busy}
          onClick={() => run(async () => downloadBlob(await rasterizeSvg(img.svg, img.width, img.height, img.background), exportFilename(project.name, `plan-${mode}`, 'png')))}
        >
          Download PNG
        </Button>
      </div>
      <div className="sheet-preview checker">
        <div className="sheet-paper plain" style={{ aspectRatio: `${img.width} / ${img.height}` }} dangerouslySetInnerHTML={{ __html: img.svg.replace(/width="\d+" height="\d+"/, 'width="100%" height="100%"') }} />
      </div>
    </div>
  );
}

function DxfExport({ project, busy, run }: PaneProps) {
  const [unit, setUnit] = useState<DxfUnit>(project.settings.units === 'ft' || project.settings.units === 'in' ? 'in' : 'mm');
  const [furniture, setFurniture] = useState(true);
  const [dimensions, setDimensions] = useState(true);
  const [labels, setLabels] = useState(true);
  const [rooms, setRooms] = useState(true);
  return (
    <div className="export-pane">
      <h3>DXF for CAD</h3>
      <p className="field-hint">
        AutoCAD R12 ASCII DXF at 1:1 in model space. Layers: A-WALL (wall faces), A-DOOR (leaves, swings), A-GLAZ (windows), A-AREA (room boundaries),
        A-ANNO-TEXT (names, areas), A-ANNO-DIMS (dimension lines and values, exploded), A-FURN (furniture outlines). Y is flipped so north is up.
      </p>
      <Segmented
        label="Drawing unit"
        size="sm"
        value={unit}
        onChange={setUnit}
        options={[
          { value: 'mm', label: 'Millimetres' },
          { value: 'cm', label: 'Centimetres' },
          { value: 'm', label: 'Metres' },
          { value: 'in', label: 'Inches' },
        ]}
      />
      <div className="toggle-grid">
        <Toggle label="Furniture outlines" checked={furniture} onChange={setFurniture} />
        <Toggle label="Wall dimensions" checked={dimensions} onChange={setDimensions} />
        <Toggle label="Room labels" checked={labels} onChange={setLabels} />
        <Toggle label="Room boundaries" checked={rooms} onChange={setRooms} />
      </div>
      <Button
        variant="primary"
        disabled={busy}
        data-testid="download-dxf"
        onClick={() =>
          run(async () => {
            const text = buildDxf(project, { unit, furniture, dimensions, labels, rooms });
            downloadBlob(new Blob([text], { type: 'application/dxf' }), exportFilename(project.name, `plan-${unit}`, 'dxf'));
          })
        }
      >
        Download DXF
      </Button>
    </div>
  );
}

function GlbExport({ project, busy, run }: PaneProps) {
  const [ceilings, setCeilings] = useState(false);
  const [furniture, setFurniture] = useState(true);
  return (
    <div className="export-pane">
      <h3>3D model (glTF binary)</h3>
      <p className="field-hint">
        Walls with real door/window openings, floors, doors and windows, furniture and imported models, with PBR colours, roughness/metalness and texture
        maps. Units are metres, Y up.
      </p>
      <div className="toggle-grid">
        <Toggle label="Ceilings" checked={ceilings} onChange={setCeilings} />
        <Toggle label="Furniture" checked={furniture} onChange={setFurniture} />
      </div>
      <Button
        variant="primary"
        disabled={busy}
        onClick={() =>
          run(async () => {
            const { exportGlb } = await import('./sceneExport');
            const buf = await exportGlb(project, { ceilings, furniture });
            downloadBlob(new Blob([buf], { type: 'model/gltf-binary' }), exportFilename(project.name, '3d-model', 'glb'));
          })
        }
      >
        {busy ? 'Building model…' : 'Download GLB'}
      </Button>
    </div>
  );
}

function GuestExport({ project, busy, run }: PaneProps) {
  const start = project.cameras.find((c) => c.id === project.guest.startCameraId);
  return (
    <div className="export-pane">
      <h3>Guest walkthrough</h3>
      <p className="field-hint">
        One self-contained HTML file with the 3D model, saved views and first-person walking. Recipients just open it in a browser — no Neest account,
        no internet connection, nothing loaded from your device.
      </p>
      <Select
        label="Opening view"
        value={project.guest.startCameraId ?? '__overview__'}
        onChange={(v) =>
          useProjectStore.getState().execute('Set guest start view', (d) => {
            d.guest.startCameraId = v === '__overview__' ? null : v;
          })
        }
        options={[{ value: '__overview__', label: 'Overview' }, ...project.cameras.map((c) => ({ value: c.id, label: c.name }))]}
      />
      <p className="field-hint">
        {start ? `Opens at “${start.name}”.` : 'Opens at an overview.'} Walk mode starts {project.guest.spawn ? 'at your chosen spot' : 'in the largest room'}. Save
        more views in the 3D panel to offer them as buttons.
      </p>
      <Button
        variant="primary"
        disabled={busy}
        data-testid="download-guest"
        onClick={() =>
          run(async () => {
            const { buildGuestHtml } = await import('./guestExport');
            const html = await buildGuestHtml(project);
            downloadBlob(new Blob([html], { type: 'text/html' }), exportFilename(project.name, 'guest-walkthrough', 'html'));
          })
        }
      >
        {busy ? 'Packaging…' : 'Download guest HTML'}
      </Button>
    </div>
  );
}

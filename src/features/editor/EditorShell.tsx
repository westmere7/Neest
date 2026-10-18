import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRightToLine,
  Box,
  Check,
  Cloud,
  Columns2,
  DoorOpen,
  Download,
  EyeOff,
  Footprints,
  Grid2x2,
  Grid3x3,
  Hand,
  LayoutDashboard,
  LibraryBig,
  Loader2,
  Magnet,
  Maximize,
  Minus,
  MousePointer2,
  Plus,
  Redo2,
  Ruler,
  Scissors,
  Settings2,
  SlidersHorizontal,
  Sofa,
  Spline,
  Square,
  Undo2,
  Waypoints,
} from 'lucide-react';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore, type PlanMode, type ToolId, type Workspace } from '@/state/editorStore';
import { useDialogStore } from '@/state/uiStores';
import { derivePlan } from '@/domain/geometry/derive';
import { formatLength } from '@/domain/model/units';
import { IconButton, Segmented, Toggle } from '@/components/ui';
import { ThemeSwitch } from '@/components/ThemeSwitch';
import { useIsMobile } from '@/components/hooks';
import { Logo } from '@/components/Logo';
import { navigate } from '@/app/App';
import { PlanCanvas } from '@/features/plan-2d/PlanCanvas';
import { LibraryPanel } from '@/features/library/LibraryPanel';
import { Inspector, projectPanelShown } from './Inspector';
import { MaterialPanel } from '@/features/materials/MaterialPanel';
import { EditorDialogs } from './EditorDialogs';
import { OptionSwitcher } from './OptionSwitcher';
import { useEditorShortcuts } from './useShortcuts';
import { useSaveStore } from '../projects/projectService';
import { preloadExport } from './EditorDialogs';
import { describeSelection } from './actions';
import { useDropAsset } from '@/features/library/useDropAsset';
import './editor.css';

const Scene3DView = lazy(() => import('@/features/scene-3d/Scene3DView'));

export function EditorShell() {
  const workspace = useEditorStore((s) => s.workspace);
  const chromeHidden = useEditorStore((s) => s.chromeHidden);
  const libraryOpen = useEditorStore((s) => s.libraryOpen);
  const libraryWidth = useEditorStore((s) => s.libraryWidth);
  const isMobile = useIsMobile();
  useEditorShortcuts(isMobile);
  useDropAsset();

  // Split view and drafting tools are desktop-only.
  useEffect(() => {
    if (isMobile) {
      const ed = useEditorStore.getState();
      if (ed.workspace === 'split') ed.set({ workspace: 'plan' });
      if (!['select', 'pan', 'place'].includes(ed.tool)) ed.setTool('select');
      ed.set({ libraryOpen: false });
    }
    // Mobile pickers open inline under their slot row; desktop uses the side panel.
    useEditorStore.getState().set({ materialPicker: null });
  }, [isMobile]);

  // Warm the export code in the background so the Export panel opens fully populated.
  useEffect(() => {
    const t = setTimeout(preloadExport, 2500);
    return () => clearTimeout(t);
  }, []);

  // The pan tool has no meaning in 3D (orbit/pan are on the mouse buttons).
  useEffect(() => {
    const ed = useEditorStore.getState();
    if (workspace === '3d' && ed.tool === 'pan') ed.setTool('select');
  }, [workspace]);

  const showPlan = workspace === 'plan' || workspace === 'split';
  const show3d = workspace === '3d' || workspace === 'split' || workspace === 'walk';

  return (
    <div
      className={`editor ws-${workspace}${chromeHidden ? ' chrome-hidden' : ''}${isMobile ? ' is-mobile' : ''}`}
      style={
        {
          '--lib-offset': libraryOpen && !isMobile && workspace === '3d' ? `${libraryWidth + 8}px` : '0px',
          '--rail-offset': !isMobile && workspace === '3d' ? 'calc(var(--rail-w) + 18px)' : '0px',
        } as React.CSSProperties
      }
    >
      <div className="workspace">
        {showPlan && (
          <div className="pane pane-plan">
            <PlanCanvas />
          </div>
        )}
        {show3d && (
          <div className="pane pane-3d">
            <Suspense fallback={<div className="pane-loading">Loading 3D view…</div>}>
              <Scene3DView mode={workspace === 'walk' ? 'walk' : 'orbit'} />
            </Suspense>
          </div>
        )}
      </div>
      {!chromeHidden && (
        <>
          <TopBar isMobile={isMobile} />
          {!isMobile && (showPlan || workspace === '3d') && <ToolRail in3d={workspace === '3d'} />}
          {libraryOpen && workspace !== 'walk' && <LibraryPanel isMobile={isMobile} />}
          {/* In the walkthrough it only shows the Project panel. */}
          <Inspector isMobile={isMobile} />
          {workspace !== 'walk' && !isMobile && <MaterialPanel />}
          {showPlan && <CanvasControls />}
          {!isMobile && <StatusBar />}
          {isMobile && <MobileBar />}
        </>
      )}
      {chromeHidden && (
        <button type="button" className="restore-ui" onClick={() => useEditorStore.getState().set({ chromeHidden: false })}>
          Show interface <kbd>Tab</kbd>
        </button>
      )}
      <EditorDialogs />
    </div>
  );
}

function SaveIndicator() {
  const { state, lastSavedAt, error, repo } = useSaveStore();
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 30000);
    return () => clearInterval(t);
  }, []);
  const time = lastSavedAt ? new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
  const label =
    state === 'saving' || state === 'pending'
      ? 'Saving…'
      : state === 'error'
        ? 'Save failed'
        : time
          ? `Saved locally ${time}`
          : 'Saved locally';
  const repoLabel = repo === 'synced' ? ' · in repo' : repo === 'pending' ? ' · syncing repo' : repo === 'error' ? ' · repo sync failed' : '';
  return (
    <span
      className={`save-indicator state-${state}`}
      role="status"
      aria-live="polite"
      title={
        state === 'error'
          ? `Changes could not be saved: ${error}. Export a .neest file to keep a copy.`
          : repo === 'off'
            ? 'Projects are stored in this browser'
            : 'Stored in this browser and mirrored to the repository projects/ folder'
      }
      data-testid="save-indicator"
    >
      {state === 'saving' || state === 'pending' ? (
        <Loader2 size={13} className="spin" />
      ) : state === 'error' ? (
        <AlertTriangle size={13} />
      ) : (
        <Check size={13} />
      )}
      <span className="save-label">
        {label}
        {repoLabel}
      </span>
    </span>
  );
}

function ProjectName() {
  const name = useProjectStore((s) => s.project!.name);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  useEffect(() => setValue(name), [name]);
  const commit = () => {
    setEditing(false);
    const v = value.trim();
    if (v && v !== name)
      useProjectStore.getState().execute('Rename project', (d) => {
        d.name = v;
      });
    else setValue(name);
  };
  return editing ? (
    <input
      className="input project-name-input"
      value={value}
      autoFocus
      maxLength={120}
      aria-label="Project name"
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') {
          setValue(name);
          setEditing(false);
        }
      }}
    />
  ) : (
    <button type="button" className="project-name" onClick={() => setEditing(true)} title="Rename project">
      {name}
    </button>
  );
}

const VIEW_OPTIONS: { value: string; label: string; title: string; mobile: boolean }[] = [
  { value: 'plan:draft', label: 'Outline', title: 'Technical outline plan (1)', mobile: true },
  { value: 'plan:furnished', label: '2D', title: '2D colour plan (2)', mobile: true },
  { value: '3d', label: '3D', title: '3D view (4)', mobile: true },
  { value: 'split', label: 'Split', title: '2D + 3D side by side (5)', mobile: false },
  { value: 'walk', label: 'Walk', title: 'First-person walkthrough', mobile: true },
];

function TopBar({ isMobile }: { isMobile: boolean }) {
  const canUndo = useProjectStore((s) => s.past.length > 0);
  const canRedo = useProjectStore((s) => s.future.length > 0);
  const undoLabel = useProjectStore((s) => s.past[s.past.length - 1]?.label);
  const redoLabel = useProjectStore((s) => s.future[0]?.label);
  const workspace = useEditorStore((s) => s.workspace);
  const planMode = useEditorStore((s) => s.planMode);
  const projectId = useProjectStore((s) => s.project!.id);
  const projectShown = useEditorStore(projectPanelShown);
  const open = useDialogStore((s) => s.open);
  const current = workspace === 'plan' ? `plan:${planMode}` : workspace;
  const setView = (v: string) => {
    const ed = useEditorStore.getState();
    if (v.startsWith('plan:')) ed.set({ workspace: 'plan', planMode: v.slice(5) as PlanMode });
    else ed.set({ workspace: v as Workspace });
  };
  return (
    <header className="topbar" data-testid="topbar">
      <div className="topbar-left">
        <div className="topbar-island floating">
          <IconButton label="All projects" onClick={() => navigate('/')} tooltipSide="bottom">
            <ArrowLeft size={17} />
          </IconButton>
          {!isMobile && <Logo size={22} />}
          <ProjectName />
          <OptionSwitcher />
          <SaveIndicator />
        </div>
      </div>
      <div className="topbar-center">
        <div className="topbar-island floating">
          <Segmented
            label="View"
            value={current}
            onChange={setView}
            size="sm"
            options={VIEW_OPTIONS.filter((o) => !isMobile || o.mobile).map((o) => ({
              value: o.value,
              label: o.label,
              title: o.title,
              testId: `view-${o.value.replace(':', '-')}`,
            }))}
          />
        </div>
      </div>
      <div className="topbar-right">
        <div className="topbar-island floating">
          <IconButton label={undoLabel ? `Undo ${undoLabel.toLowerCase()}` : 'Undo'} shortcut="Ctrl+Z" disabled={!canUndo} onClick={() => useProjectStore.getState().undo()} data-testid="undo">
            <Undo2 size={17} />
          </IconButton>
          <IconButton label={redoLabel ? `Redo ${redoLabel.toLowerCase()}` : 'Redo'} shortcut="Ctrl+Shift+Z" disabled={!canRedo} onClick={() => useProjectStore.getState().redo()} data-testid="redo">
            <Redo2 size={17} />
          </IconButton>
        </div>
        <div className="topbar-island floating">
          {!isMobile && (
            <IconButton
              label="Project overview"
              active={projectShown}
              onClick={() => {
                const ed = useEditorStore.getState();
                if (projectShown) return ed.set({ projectPanelOpen: false });
                // Bring it up even when a selection or a drawing tool's options hold its place.
                ed.set({ projectPanelOpen: true, selection: [] });
                if (ed.workspace !== 'walk' && !projectPanelShown(useEditorStore.getState())) ed.setTool('select');
              }}
              data-testid="toggle-project-panel"
            >
              <LayoutDashboard size={17} />
            </IconButton>
          )}
          {!isMobile && (
            <IconButton label="Project settings" onClick={() => open('settings')}>
              <Settings2 size={17} />
            </IconButton>
          )}
          <IconButton
            label="Export"
            shortcut="Ctrl+E"
            onClick={() => open('export')}
            onPointerEnter={preloadExport}
            onFocus={preloadExport}
            data-testid="open-export"
          >
            <Download size={17} />
          </IconButton>
          <IconButton label="Guest view" onClick={() => navigate(`/guest/${projectId}`)}>
            <Footprints size={17} />
          </IconButton>
          {!isMobile && (
            <IconButton label="Hide interface" shortcut="Tab" onClick={() => useEditorStore.getState().set({ chromeHidden: true })}>
              <EyeOff size={17} />
            </IconButton>
          )}
          {!isMobile && <ThemeSwitch />}
        </div>
      </div>
    </header>
  );
}

const NAV_TOOLS: { id: ToolId; label: string; key: string; icon: React.ReactNode }[] = [
  { id: 'select', label: 'Select & move', key: 'V', icon: <MousePointer2 size={18} /> },
  { id: 'pan', label: 'Pan', key: 'H', icon: <Hand size={18} /> },
];

const ACTION_TOOLS: { id: ToolId; label: string; key: string; icon: React.ReactNode }[] = [
  { id: 'wall', label: 'Wall', key: 'W', icon: <Waypoints size={18} /> },
  { id: 'curve', label: 'Curved wall', key: 'C', icon: <Spline size={18} /> },
  { id: 'room', label: 'Room (rectangle)', key: 'R', icon: <Square size={18} /> },
  { id: 'opening', label: 'Door & window', key: 'D', icon: <DoorOpen size={18} /> },
  { id: 'split', label: 'Split wall', key: 'S', icon: <Scissors size={18} /> },
  { id: 'extend', label: 'Extend / trim / join', key: 'E', icon: <ArrowRightToLine size={18} /> },
  { id: 'measure', label: 'Measure', key: 'M', icon: <Ruler size={18} /> },
];

const TOOLS = [...NAV_TOOLS, ...ACTION_TOOLS];

function ToolRail({ in3d }: { in3d: boolean }) {
  const tool = useEditorStore((s) => s.tool);
  const setTool = useEditorStore((s) => s.setTool);
  const libraryOpen = useEditorStore((s) => s.libraryOpen);
  const libraryTab = useEditorStore((s) => s.libraryTab);
  const buildGroup = useEditorStore((s) => s.buildGroup);
  const openingKind = useEditorStore((s) => s.openingKind);
  const viewPanelOpen = useEditorStore((s) => s.viewPanelOpen);
  const set = useEditorStore((s) => s.set);

  const inFurnitureLib = libraryOpen && (libraryTab === 'furniture' || libraryTab === 'materials');
  const inBuildGroup = (g: 'walls' | 'doors' | 'windows') =>
    libraryOpen && libraryTab === 'build' && buildGroup === g;

  return (
    <nav className="tool-rail" aria-label="Tools" data-testid="tool-rail">
      {/* Top hero: Library (Furniture & Materials) */}
      <div className="tool-rail-group floating tool-rail-hero" role="group" aria-label="Library">
        <IconButton
          label="Library"
          active={inFurnitureLib}
          tooltipSide="right"
          className="library-hero-btn"
          onClick={() => {
            if (inFurnitureLib) set({ libraryOpen: false });
            else set({ libraryOpen: true, libraryTab: 'furniture' });
          }}
        >
          <Sofa size={19} />
        </IconButton>
      </div>

      {/* Group 2: Select & Pan */}
      <div className="tool-rail-group floating" role="group" aria-label="Selection and navigation">
        {NAV_TOOLS.filter((t) => !in3d || t.id !== 'pan').map((t) => (
          <IconButton
            key={t.id}
            label={t.label}
            shortcut={t.key}
            active={tool === t.id}
            tooltipSide="right"
            onClick={() => setTool(t.id)}
            data-testid={`tool-${t.id}`}
          >
            {t.icon}
          </IconButton>
        ))}
      </div>

      {/* Group 3: Build groups & Action tools */}
      <div className="tool-rail-group floating" role="group" aria-label="Build and action tools">
        <IconButton
          label="Walls"
          shortcut="W"
          active={inBuildGroup('walls') || tool === 'wall' || tool === 'curve' || tool === 'room'}
          tooltipSide="right"
          className="rail-labeled-btn"
          onClick={() => {
            const nextTool = tool === 'wall' || tool === 'curve' || tool === 'room' ? tool : 'wall';
            setTool(nextTool);
            set({
              libraryOpen: !inBuildGroup('walls'),
              libraryTab: 'build',
              buildGroup: 'walls',
            });
          }}
          data-testid="tool-wall"
        >
          <Waypoints size={18} />
          <span className="rail-btn-label">Walls</span>
        </IconButton>
        <IconButton
          label="Doors"
          shortcut="D"
          active={inBuildGroup('doors') || (tool === 'opening' && !openingKind.startsWith('window'))}
          tooltipSide="right"
          className="rail-labeled-btn"
          onClick={() => {
            setTool('opening');
            set({
              openingKind: openingKind.startsWith('window') ? 'door-single' : openingKind,
              libraryOpen: !inBuildGroup('doors'),
              libraryTab: 'build',
              buildGroup: 'doors',
            });
          }}
          data-testid="tool-opening"
        >
          <DoorOpen size={18} />
          <span className="rail-btn-label">Doors</span>
        </IconButton>
        <IconButton
          label="Windows"
          active={inBuildGroup('windows') || (tool === 'opening' && openingKind.startsWith('window'))}
          tooltipSide="right"
          className="rail-labeled-btn"
          onClick={() => {
            setTool('opening');
            set({
              openingKind: openingKind.startsWith('window') ? openingKind : 'window-single',
              libraryOpen: !inBuildGroup('windows'),
              libraryTab: 'build',
              buildGroup: 'windows',
            });
          }}
          data-testid="tool-windows"
        >
          <Grid2x2 size={18} />
          <span className="rail-btn-label">Windows</span>
        </IconButton>
        <span className="rail-sep" />
        <IconButton
          label="Split wall"
          shortcut="S"
          active={tool === 'split'}
          tooltipSide="right"
          className="rail-labeled-btn"
          onClick={() => setTool('split')}
          data-testid="tool-split"
        >
          <Scissors size={18} />
          <span className="rail-btn-label">Split</span>
        </IconButton>
        <IconButton
          label="Extend / trim / join walls"
          shortcut="E"
          active={tool === 'extend'}
          tooltipSide="right"
          className="rail-labeled-btn"
          onClick={() => setTool('extend')}
          data-testid="tool-extend"
        >
          <ArrowRightToLine size={18} />
          <span className="rail-btn-label">Extend</span>
        </IconButton>
        <IconButton
          label="Measure"
          shortcut="M"
          active={tool === 'measure'}
          tooltipSide="right"
          className="rail-labeled-btn"
          onClick={() => setTool('measure')}
          data-testid="tool-measure"
        >
          <Ruler size={18} />
          <span className="rail-btn-label">Measure</span>
        </IconButton>
      </div>

      {/* 3D only: shows or stashes the 3D view settings panel */}
      {in3d && (
        <div className="tool-rail-group floating" role="group" aria-label="3D view">
          <IconButton
            label="3D view panel"
            shortcut="P"
            active={viewPanelOpen}
            tooltipSide="right"
            className="rail-labeled-btn"
            onClick={() => set({ viewPanelOpen: !viewPanelOpen })}
            data-testid="toggle-view-panel"
          >
            <SlidersHorizontal size={18} />
            <span className="rail-btn-label">View</span>
          </IconButton>
        </div>
      )}
    </nav>
  );
}

function CanvasControls() {
  const zoom = useEditorStore((s) => s.planCamera.zoom);
  const gridVisible = useEditorStore((s) => s.gridVisible);
  const snap = useEditorStore((s) => s.snap);
  const [snapOpen, setSnapOpen] = useState(false);
  const setZoom = (factor: number) => {
    const cam = useEditorStore.getState().planCamera;
    useEditorStore.getState().set({ planCamera: { ...cam, zoom: Math.min(3000, Math.max(4, cam.zoom * factor)) } });
  };
  const anySnap = snap.grid || snap.geometry || snap.angle || snap.guides;
  return (
    <div className="canvas-controls floating" role="toolbar" aria-label="Canvas controls">
      <IconButton label="Zoom out" onClick={() => setZoom(1 / 1.25)} tooltipSide="top">
        <Minus size={16} />
      </IconButton>
      <span className="zoom-readout num" title="Screen pixels per metre">
        {Math.round(zoom)}px/m
      </span>
      <IconButton label="Zoom in" onClick={() => setZoom(1.25)} tooltipSide="top">
        <Plus size={16} />
      </IconButton>
      <IconButton label="Fit plan" shortcut="F" onClick={() => useEditorStore.getState().requestFit()} tooltipSide="top">
        <Maximize size={16} />
      </IconButton>
      <span className="tb-sep" />
      <IconButton label="Grid" shortcut="G" active={gridVisible} onClick={() => useEditorStore.getState().set({ gridVisible: !gridVisible })} tooltipSide="top">
        <Grid3x3 size={16} />
      </IconButton>
      <div className="popover-anchor">
        <IconButton label="Snapping" active={anySnap} onClick={() => setSnapOpen(!snapOpen)} tooltipSide="top" aria-expanded={snapOpen}>
          <Magnet size={16} />
        </IconButton>
        {snapOpen && (
          <div className="popover snap-popover" role="dialog" aria-label="Snapping options">
            {(
              [
                ['grid', 'Grid', 'Snap to grid spacing'],
                ['geometry', 'Endpoints & walls', 'Nodes, midpoints, wall lines'],
                ['angle', 'Angles', '0°, 45°, 90° while drawing'],
                ['guides', 'Alignment guides', 'Line up with existing corners'],
              ] as const
            ).map(([k, label, hint]) => (
              <Toggle
                key={k}
                label={label}
                hint={hint}
                checked={snap[k]}
                onChange={(v) => useEditorStore.getState().set({ snap: { ...snap, [k]: v } })}
              />
            ))}
            <GridSizeControl />
          </div>
        )}
      </div>
    </div>
  );
}

function GridSizeControl() {
  const settings = useProjectStore((s) => s.project!.settings);
  const options = settings.units === 'ft' || settings.units === 'in' ? [0.0254, 0.0508, 0.1524, 0.3048] : [0.01, 0.05, 0.1, 0.25, 0.5];
  return (
    <div className="field">
      <span className="field-label">Grid spacing</span>
      <Segmented
        label="Grid spacing"
        size="sm"
        value={String(settings.gridSize)}
        onChange={(v) =>
          useProjectStore.getState().execute('Change grid', (d) => {
            d.settings.gridSize = parseFloat(v);
          })
        }
        options={options.map((o) => ({ value: String(o), label: formatLength(o, settings.units, 0).replace(' ', '') }))}
      />
    </div>
  );
}

function StatusBar() {
  const tool = useEditorStore((s) => s.tool);
  const hint = useEditorStore((s) => s.hint);
  const snapLabel = useEditorStore((s) => s.snapLabel);
  const cursor = useEditorStore((s) => s.cursor);
  const selection = useEditorStore((s) => s.selection);
  const workspace = useEditorStore((s) => s.workspace);
  const project = useProjectStore((s) => s.project!);
  const derived = useMemo(() => derivePlan(project), [project]);
  const diagnostics = derived.diagnostics;
  const [showDiag, setShowDiag] = useState(false);
  const u = project.settings;
  const toolLabel = TOOLS.find((t) => t.id === tool)?.label ?? (tool === 'place' ? 'Place object' : tool);
  return (
    <footer className="status-bar floating" data-testid="status-bar">
      <span className="status-tool">
        {workspace === 'walk' ? 'Walkthrough' : workspace === '3d' ? (tool === 'select' ? '3D · Select & move' : `3D · ${toolLabel}`) : toolLabel}
      </span>
      <span className="status-hint">{hint}</span>
      <span className="status-spacer" />
      {snapLabel && <span className="status-snap">⌖ {snapLabel}</span>}
      {cursor && workspace !== 'walk' && (
        <span className="status-coords num">
          x {formatLength(cursor.x, u.units, u.precision)} · y {formatLength(cursor.y, u.units, u.precision)}
        </span>
      )}
      <span className="status-sel">{describeSelection(project, selection)}</span>
      <div className="popover-anchor">
        <button
          type="button"
          className={`status-diag${diagnostics.length ? ' has' : ''}`}
          onClick={() => setShowDiag(!showDiag)}
          aria-expanded={showDiag}
          title="Geometry checks"
        >
          {diagnostics.length ? <AlertTriangle size={12} /> : <Check size={12} />}
          {diagnostics.length ? `${diagnostics.length} issue${diagnostics.length > 1 ? 's' : ''}` : 'Plan OK'}
        </button>
        {showDiag && (
          <div className="popover diag-popover" role="dialog" aria-label="Geometry issues">
            {diagnostics.length === 0 && <p className="field-hint">No geometry issues detected.</p>}
            {diagnostics.map((d) => (
              <button
                key={d.id}
                type="button"
                className="diag-item"
                onClick={() => {
                  const p = useProjectStore.getState().project!;
                  useEditorStore.getState().setSelection(
                    d.entityIds
                      .map((id) =>
                        p.walls[id] ? { kind: 'wall' as const, id } : p.openings[id] ? { kind: 'opening' as const, id } : null,
                      )
                      .filter((x): x is { kind: 'wall' | 'opening'; id: string } => !!x),
                  );
                }}
              >
                <strong>{d.message}</strong>
                {d.hint && <span>{d.hint}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
      <span className="status-units">{u.units === 'ft' ? 'ft-in' : u.units}</span>
      <span className="status-local" title="No account needed — everything is stored in this browser">
        <Cloud size={12} /> Local
      </span>
    </footer>
  );
}

function MobileBar() {
  const workspace = useEditorStore((s) => s.workspace);
  const tool = useEditorStore((s) => s.tool);
  const set = useEditorStore((s) => s.set);
  return (
    <nav className="mobile-bar floating" aria-label="Mobile tools">
      <button type="button" className={tool === 'select' && workspace !== 'walk' ? 'on' : ''} onClick={() => set({ tool: 'select', workspace: workspace === 'walk' ? '3d' : workspace })}>
        <MousePointer2 size={18} />
        <span>Select</span>
      </button>
      <button type="button" className={workspace === '3d' ? 'on' : ''} onClick={() => set({ workspace: workspace === '3d' ? 'plan' : '3d' })}>
        <Box size={18} />
        <span>{workspace === '3d' ? '2D' : '3D'}</span>
      </button>
      <button type="button" className={workspace === 'walk' ? 'on' : ''} onClick={() => set({ workspace: 'walk' })}>
        <Footprints size={18} />
        <span>Walk</span>
      </button>
      <button type="button" onClick={() => set({ libraryOpen: true, libraryTab: 'furniture', workspace: workspace === 'walk' ? 'plan' : workspace })}>
        <LibraryBig size={18} />
        <span>Add</span>
      </button>
      <button type="button" onClick={() => useDialogStore.getState().open('mobile-info')}>
        <Columns2 size={18} />
        <span>Drafting</span>
      </button>
    </nav>
  );
}


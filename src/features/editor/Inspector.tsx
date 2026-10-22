import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowLeftRight, ChevronDown, ChevronUp, Copy, Eye, EyeOff, FlipHorizontal2, Focus, LibraryBig, Lock, Minus, PanelRightClose, RotateCw, Scissors, Spline, Trash2, Unlock, X } from 'lucide-react';
import type { OpeningKind, Project, RoomType, WallRole } from '@/domain/model/schema';
import { isDividerWall, isPassageKind, isWindowKind } from '@/domain/model/schema';
import { OPENING_PRESETS, ROOM_TYPE_LABELS } from '@/domain/model/defaults';
import { formatArea, formatLength } from '@/domain/model/units';
import { derivePlan } from '@/domain/geometry/derive';
import { boundsOf, unionBounds, type Bounds } from '@/domain/geometry/vec';
import { pointAt } from '@/domain/geometry/wallPath';
import { clampOpenings, swapWallFaces, unroundCorner, cornerArc, curveHandleFraction, maxCornerRadius, roundCorner, setCornerRadius, sharedNode, fitCurveToJoins, flipCurve, joinTangent, makeCircularArc, setCurveHandleFraction, setCurveHandles, setWallAngle, setWallLength, splitWallAt, updateWalls } from '@/domain/commands/walls';
import { assignMaterial, normalizeRotation, setOpeningDesign, suggestedFloor, updateObjects, updateOpening, updateRoom } from '@/domain/commands/entities';
import { defaultDesign, designFitsKind, OPENING_DESIGNS_BY_ID, resolveOpeningDesign } from '@/domain/model/openingDesigns';
import { DEFAULT_MATERIALS } from '@/data/materials/catalog';
import { getAsset, objectSlotMaterialId } from '@/data/assets/registry';
import { ASSET_CATEGORY_LABELS } from '@/data/assets/catalog';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore, type EditorState, type ToolId } from '@/state/editorStore';
import { renderThumbnail } from '@/features/projects/projectService';
import { thumbnailSrc } from '@/features/projects/thumbnails';
import { Button, IconButton, LengthField, NumberField, Section, Select, Slider, TextField, Toggle, Segmented } from '@/components/ui';
import { MaterialSlotRow } from '@/features/materials/MaterialUI';
import { deleteSelection, duplicateSelection, flipOpening, reverseWall, rotateSelection, toggleLockSelection, describeSelection } from './actions';
import { DrawPresetSelect, WallConstruction, WallPresetPicker, WallTrims, isLightWall, LightWallFinishes } from './WallExtras';
import { WallMultiEdit } from './WallMultiEdit';
import { SelectSameTypeButton } from './WallTypes';
import { AnnotationToggles } from './AnnotationToggles';
import { CalloutInspector } from '@/features/callouts/CalloutInspector';
import { OpeningExtras } from './OpeningExtras';
import { OpeningDesignGrid } from './OpeningDesignPicker';
import { WallReferencePicker } from './WallToolExtras';
import { ObjectPreview } from './ObjectPreview';
import { PlantCare } from '@/features/library/PlantCare';
import { OpeningFinishes, OpeningToolFinish } from './OpeningFinishes';
import { ObjectVariants } from './ObjectVariants';
import { ObjectModels } from './ObjectModels';
import { scalePct, scaledSize } from './objectScale';
import { withModel } from '@/data/assets/models';

const exec = (label: string, fn: Parameters<ReturnType<typeof useProjectStore.getState>['execute']>[1]) =>
  useProjectStore.getState().execute(label, fn);

/** Drawing tools whose options take the Inspector's place. */
const TOOLS_WITH_OPTIONS: ToolId[] = ['wall', 'curve', 'room', 'opening'];

/** The Project panel is on screen: switched on, and nothing else claims the Inspector (the walkthrough has no selection). */
export const projectPanelShown = (s: Pick<EditorState, 'projectPanelOpen' | 'selection' | 'tool' | 'workspace'>) =>
  s.projectPanelOpen && (s.workspace === 'walk' || (s.selection.length === 0 && !TOOLS_WITH_OPTIONS.includes(s.tool)));

export function Inspector({ isMobile }: { isMobile: boolean }) {
  const project = useProjectStore((s) => s.project!);
  const selection = useEditorStore((s) => s.selection);
  const tool = useEditorStore((s) => s.tool);
  const workspace = useEditorStore((s) => s.workspace);
  const projectOpen = useEditorStore((s) => s.projectPanelOpen);
  const [collapsed, setCollapsed] = useState(false);
  const derived = useMemo(() => derivePlan(project), [project]);

  let title = describeSelection(project, selection);
  let body: ReactNode = null;
  let actions: ReactNode = null;
  /** Small label above a user-given name (objects, rooms), which then gets its own line below the actions. */
  let eyebrow: string | null = null;
  // The walkthrough has no selection or tools: only the Project panel can show there.
  const walk = workspace === 'walk';

  if (walk) {
    // nothing to inspect
  } else if (selection.length === 1) {
    const s = selection[0];
    if (s.kind === 'wall' && project.walls[s.id]) {
      body = <WallInspector project={project} wallId={s.id} />;
      const locked = project.walls[s.id].locked;
      actions = (
        <>
          <IconButton label={locked ? 'Unlock wall' : 'Lock wall'} shortcut="Ctrl+L" onClick={toggleLockSelection} active={locked}>
            {locked ? <Lock size={15} /> : <Unlock size={15} />}
          </IconButton>
          <IconButton label="Delete wall" shortcut="Del" onClick={() => void deleteSelection()} disabled={locked}>
            <Trash2 size={15} />
          </IconButton>
        </>
      );
    } else if (s.kind === 'opening' && project.openings[s.id]) {
      body = <OpeningInspector project={project} openingId={s.id} />;
      actions = (
        <>
          <IconButton label="Duplicate" shortcut="Ctrl+D" onClick={duplicateSelection}>
            <Copy size={15} />
          </IconButton>
          <IconButton label="Delete" shortcut="Del" onClick={() => void deleteSelection()}>
            <Trash2 size={15} />
          </IconButton>
        </>
      );
    } else if (s.kind === 'object' && project.objects[s.id]) {
      const o = project.objects[s.id];
      const asset = getAsset(project, o.assetId);
      title = o.name ?? asset?.name ?? 'Object';
      eyebrow = asset ? ASSET_CATEGORY_LABELS[asset.category] : 'Item';
      body = <ObjectInspector project={project} objectId={s.id} isMobile={isMobile} />;
      actions = (
        <>
          <IconButton
            label="Show in library"
            onClick={() => useEditorStore.getState().set({ libraryOpen: true, libraryTab: 'furniture', libraryReveal: { assetId: o.assetId, nonce: Date.now() } })}
          >
            <LibraryBig size={15} />
          </IconButton>
          <IconButton label="Duplicate" shortcut="Ctrl+D" onClick={duplicateSelection}>
            <Copy size={15} />
          </IconButton>
          <IconButton label={o.locked ? 'Unlock' : 'Lock'} shortcut="Ctrl+L" onClick={toggleLockSelection} active={o.locked}>
            {o.locked ? <Lock size={15} /> : <Unlock size={15} />}
          </IconButton>
          <IconButton label="Delete" shortcut="Del" onClick={() => void deleteSelection()} disabled={o.locked}>
            <Trash2 size={15} />
          </IconButton>
        </>
      );
    } else if (s.kind === 'room' && project.rooms[s.id]) {
      body = <RoomInspector project={project} roomId={s.id} />;
      eyebrow = 'Room';
    } else if (s.kind === 'callout' && project.callouts?.[s.id]) {
      eyebrow = 'Callout';
      body = <CalloutInspector project={project} derived={derived} id={s.id} />;
      actions = (
        <>
          <IconButton label="Duplicate" shortcut="Ctrl+D" onClick={duplicateSelection}>
            <Copy size={15} />
          </IconButton>
          <IconButton label="Delete" shortcut="Del" onClick={() => void deleteSelection()}>
            <Trash2 size={15} />
          </IconButton>
        </>
      );
    } else if (s.kind === 'node') {
      body = <p className="field-hint pad">Drag the endpoint to move it. Connected walls stay attached.</p>;
    }
  } else if (selection.length > 1) {
    body = <MultiInspector project={project} />;
    actions = (
      <IconButton label="Delete selection" shortcut="Del" onClick={() => void deleteSelection()}>
        <Trash2 size={15} />
      </IconButton>
    );
  } else if (tool === 'wall' || tool === 'curve' || tool === 'room') {
    title = tool === 'room' ? 'Room tool' : tool === 'curve' ? 'Curved wall tool' : 'Wall tool';
    body = <WallToolOptions project={project} />;
  } else if (tool === 'opening' && isMobile) {
    // Desktop: type, design and finish are chosen in the Build panel (OpeningBuildOptions).
    title = 'Door & window tool';
    body = <OpeningToolOptions />;
  }
  const isProject = !body && !isMobile && projectOpen;
  if (isProject) {
    title = 'Project';
    body = <ProjectSummary project={project} derived={derived} />;
  }

  if (!body) return null;
  if (isMobile && selection.length === 0) return null;
  // The Project panel is hidden as a whole (top-bar toggle), never collapsed.
  const folded = collapsed && !isProject;

  return (
    <aside className={`inspector floating${folded ? ' collapsed' : ''}${isMobile ? ' sheet' : ''}`} aria-label={isProject ? 'Project overview' : 'Inspector'} data-testid="inspector">
      <header className={`inspector-head${eyebrow ? ' stacked' : ''}`}>
        {eyebrow ? (
          <span className="inspector-eyebrow">{eyebrow}</span>
        ) : (
          <h2 title={title}>{title}</h2>
        )}
        <div className="inspector-actions">
          {!isProject && selection.length > 0 && (
            <IconButton label="Focus camera on selection" onClick={() => useEditorStore.getState().requestFocus()} data-testid="focus-selection">
              <Focus size={15} />
            </IconButton>
          )}
          {!folded && actions}
          {isProject ? (
            <IconButton label="Hide project panel" onClick={() => useEditorStore.getState().set({ projectPanelOpen: false })} data-testid="stash-project-panel">
              <PanelRightClose size={15} />
            </IconButton>
          ) : (
            <IconButton
              label={collapsed ? 'Expand inspector' : 'Collapse inspector'}
              onClick={() => {
                // The finish panel belongs to the Inspector's content: collapsing closes it.
                if (!collapsed) useEditorStore.getState().set({ materialPicker: null });
                setCollapsed(!collapsed);
              }}
            >
              {collapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
            </IconButton>
          )}
          {!isProject && selection.length > 0 && (
            <IconButton label="Clear selection" shortcut="Esc" onClick={() => useEditorStore.getState().clearSelection()}>
              <X size={15} />
            </IconButton>
          )}
        </div>
        {eyebrow && (
          <h2 className="inspector-title" title={title}>
            {title}
          </h2>
        )}
      </header>
      {!folded && <div className="inspector-body">{body}</div>}
    </aside>
  );
}

// ───────────────────────── Wall ─────────────────────────

const ROLE_OPTIONS: { value: WallRole; label: string }[] = [
  { value: 'exterior', label: 'Exterior (apartment boundary)' },
  { value: 'interior', label: 'Interior wall' },
  { value: 'partition', label: 'Light partition' },
];

function WallInspector({ project, wallId }: { project: Project; wallId: string }) {
  const w = project.walls[wallId];
  const derived = derivePlan(project);
  const g = derived.network.walls.get(wallId);
  const [anchor, setAnchor] = useState<'start' | 'end'>('start');
  const u = project.settings;
  const locked = w.locked || project.layers.construction.locked;
  if (!g) return <p className="field-hint pad">This wall has zero length. Delete it or drag an endpoint.</p>;
  const leftLen = g.left.reduce((s, p, i) => (i ? s + Math.hypot(p.x - g.left[i - 1].x, p.y - g.left[i - 1].y) : 0), 0);
  const rightLen = g.right.reduce((s, p, i) => (i ? s + Math.hypot(p.x - g.right[i - 1].x, p.y - g.right[i - 1].y) : 0), 0);
  const a = project.nodes[w.a];
  const b = project.nodes[w.b];
  const angle = ((Math.atan2(-(b.y - a.y), b.x - a.x) * 180) / Math.PI + 360) % 360;
  const openings = Object.values(project.openings).filter((o) => o.wallId === wallId);
  return (
    <>
      <Section title="Geometry">
        {locked && <p className="notice">This wall is locked. Unlock it to edit its geometry.</p>}
        <div className="grid-2">
          <LengthField
            label={w.curve ? 'Arc length' : 'Length'}
            value={g.path.length}
            unit={u.units}
            precision={u.precision}
            min={0.05}
            max={200}
            disabled={locked}
            testId="wall-length"
            onCommit={(v) =>
              exec('Set wall length', (d) => {
                setWallLength(d, wallId, v, anchor);
                clampOpenings(d);
              })
            }
          />
          <Select
            label="Keep fixed"
            value={anchor}
            onChange={setAnchor}
            options={[
              { value: 'start', label: 'Start point' },
              { value: 'end', label: 'End point' },
            ]}
          />
          <LengthField
            label="Thickness"
            value={w.thickness}
            unit={u.units}
            precision={u.precision}
            min={0.02}
            max={2}
            disabled={locked}
            testId="wall-thickness"
            onCommit={(v) =>
              exec('Set wall thickness', (d) => {
                updateWalls(d, [wallId], { thickness: v });
                clampOpenings(d);
              })
            }
          />
          <LengthField
            label="Height"
            value={w.height}
            unit={u.units}
            precision={u.precision}
            min={0.2}
            max={12}
            disabled={locked}
            testId="wall-height"
            onCommit={(v) => exec('Set wall height', (d) => updateWalls(d, [wallId], { height: v }))}
          />
          <LengthField
            label="Base elevation"
            value={w.baseElevation}
            unit={u.units}
            precision={u.precision}
            min={-2}
            max={12}
            disabled={locked}
            onCommit={(v) => exec('Set wall elevation', (d) => updateWalls(d, [wallId], { baseElevation: v }))}
          />
          {!w.curve && (
            <NumberField
              label="Angle"
              value={Number(angle.toFixed(1))}
              min={0}
              max={360}
              step={15}
              suffix="°"
              disabled={locked}
              onCommit={(deg) => exec('Set wall angle', (d) => setWallAngle(d, wallId, (-deg * Math.PI) / 180))}
            />
          )}
        </div>
        <Select
          label="Wall type"
          value={w.role}
          onChange={(role) => exec('Set wall type', (d) => updateWalls(d, [wallId], { role }))}
          options={ROLE_OPTIONS}
        />
        <SelectSameTypeButton project={project} wall={w} />
        <div className="wall-actions">
          <span className="field-hint num">
            Faces {formatLength(leftLen, u.units, u.precision)} · {formatLength(rightLen, u.units, u.precision)}
          </span>
          <IconButton
            label={w.curve ? 'Make straight' : 'Make curved'}
            disabled={locked}
            onClick={() =>
              exec(w.curve ? 'Straighten wall' : 'Curve wall', (d) => {
                if (w.curve) updateWalls(d, [wallId], { curve: null });
                else {
                  const mid = pointAt(g.path, g.path.length / 2);
                  const off = g.path.length * 0.25;
                  updateWalls(d, [wallId], { curve: { x: mid.p.x + mid.tangent.y * off * 2, y: mid.p.y - mid.tangent.x * off * 2 } });
                }
                clampOpenings(d);
              })
            }
          >
            {w.curve ? <Minus size={15} /> : <Spline size={15} />}
          </IconButton>
          <IconButton label="Split in half" disabled={locked} onClick={() => exec('Split wall', (d) => void splitWallAt(d, wallId, g.path.length / 2))}>
            <Scissors size={15} />
          </IconButton>
          <IconButton label="Reverse direction (each face keeps its finish)" onClick={() => reverseWall(wallId)}>
            <FlipHorizontal2 size={15} />
          </IconButton>
          <IconButton label="Swap faces (the two sides trade finishes and trims)" disabled={locked} onClick={() => exec('Swap wall faces', (d) => swapWallFaces(d, wallId))} data-testid="swap-wall-faces">
            <ArrowLeftRight size={15} />
          </IconButton>
        </div>
      </Section>
      {w.curve && (
        <Section title="Curve">
          <CornerRadiusField project={project} wallId={wallId} locked={locked} />
          <Segmented<'one' | 'two'>
            label="Handles"
            size="sm"
            value={w.curveEnd ? 'two' : 'one'}
            onChange={(v) => exec(v === 'two' ? 'Two curve handles' : 'One curve handle', (d) => setCurveHandles(d, wallId, v === 'two'))}
            options={[
              { value: 'one', label: 'One bend' },
              { value: 'two', label: 'One per end' },
            ]}
          />
          <div className="btn-row compact">
            <Button
              size="sm"
              disabled={locked || (!joinTangent(project, wallId, 'a') && !joinTangent(project, wallId, 'b'))}
              title="Bend the wall so it flows smoothly out of and into the walls joined at its ends"
              onClick={() => exec('Fit curve to joined walls', (d) => void (fitCurveToJoins(d, wallId) && clampOpenings(d)))}
            >
              Fit to joins
            </Button>
            <Button
              size="sm"
              disabled={locked}
              title="A true round arc through both ends and the current peak"
              onClick={() => exec('Make circular arc', (d) => void (makeCircularArc(d, wallId) && clampOpenings(d)))}
            >
              Circular
            </Button>
            <Button size="sm" disabled={locked} title="Mirror the bulge to the other side" onClick={() => exec('Flip curve', (d) => flipCurve(d, wallId))}>
              Flip
            </Button>
          </div>
          {w.curveEnd && (
            <Slider
              label="Fullness"
              value={Math.round((curveHandleFraction(project, wallId) ?? 0.33) * 100)}
              min={5}
              max={120}
              step={1}
              format={(v) => `${v}%`}
              onCommit={(v) => exec('Set curve fullness', (d) => { setCurveHandleFraction(d, wallId, v / 100); clampOpenings(d); })}
            />
          )}
          <p className="field-hint">Drag the handles in the plan; Alt drags without snapping.</p>
        </Section>
      )}
      <WallConstruction project={project} wallId={wallId} locked={locked} />
      {w.style === 'separator' ? null : isLightWall(w.style) ? (
        // Glass walls and railings have no faces to finish: their glazing (or bars) and frame instead.
        <Section title="Finishes">
          <LightWallFinishes wall={w} wallId={wallId} />
        </Section>
      ) : (
        <>
          <Section title="Finishes">
            <WallPresetPicker wallIds={[wallId]} />
            <MaterialSlotRow label="Left side" target={{ kind: 'wall-side', wallId, side: 'left' }} materialId={w.materials.left} testId="wall-mat-left" />
            <MaterialSlotRow label="Right side" target={{ kind: 'wall-side', wallId, side: 'right' }} materialId={w.materials.right} />
            <MaterialSlotRow label={w.style === 'half' ? 'Cap & ends' : 'Top & ends'} target={{ kind: 'wall-side', wallId, side: 'top' }} materialId={w.materials.top} />
            <Button size="sm" variant="subtle" onClick={() => exec('Match both sides', (d) => assignMaterial(d, [{ kind: 'wall-side', wallId, side: 'right' }], w.materials.left))}>
              Use left finish on both sides
            </Button>
          </Section>
          <WallTrims project={project} wallId={wallId} />
        </>
      )}
      {openings.length > 0 && (
        <Section title={`Openings (${openings.length})`}>
          {openings.map((o) => (
            <button key={o.id} type="button" className="list-row" onClick={() => useEditorStore.getState().setSelection([{ kind: 'opening', id: o.id }])}>
              {OPENING_PRESETS[o.kind].label}
              <span className="num">{formatLength(o.width, u.units, u.precision)}</span>
            </button>
          ))}
        </Section>
      )}
      <Section title="Visibility" defaultOpen={false}>
        <Toggle label="Locked" hint="Prevents accidental edits" checked={w.locked} onChange={(v) => exec(v ? 'Lock wall' : 'Unlock wall', (d) => updateWalls(d, [wallId], { locked: v }))} />
        <Toggle label="Hidden" hint="Hide from plan and 3D" checked={w.hidden} onChange={(v) => exec(v ? 'Hide wall' : 'Show wall', (d) => updateWalls(d, [wallId], { hidden: v }))} />
      </Section>
    </>
  );
}

// ───────────────────────── Opening ─────────────────────────

const OPENING_KINDS = Object.values(OPENING_PRESETS).map((p) => ({ value: p.kind, label: p.label }));

/** Door kinds whose hinge (or slide/pivot direction) can be flipped. */
const HINGED_KINDS = new Set<OpeningKind>(['door-single', 'door-pocket', 'door-bifold', 'door-barn', 'door-pivot']);

function OpeningInspector({ project, openingId }: { project: Project; openingId: string }) {
  const o = project.openings[openingId];
  const u = project.settings;
  const derived = derivePlan(project);
  const g = derived.network.walls.get(o.wallId);
  const span = g?.spans.find((s) => s.id === openingId);
  const win = isWindowKind(o.kind);
  const fromStart = span ? span.s0 : o.offset - o.width / 2;
  const fromEnd = span && g ? g.path.length - span.s1 : 0;
  const upd = (label: string, patch: Parameters<typeof updateOpening>[2]) => exec(label, (d) => updateOpening(d, openingId, patch));
  // Sliding kinds show "open" as a percentage (the 0–90 value maps to 0–100%).
  const slides = o.kind === 'door-sliding' || o.kind === 'door-pocket' || o.kind === 'door-barn';
  return (
    <>
      <Section title="Type & size">
        <Select<OpeningKind>
          label="Type"
          value={o.kind}
          onChange={(kind) => {
            const p = OPENING_PRESETS[kind];
            const switchingFamily = isWindowKind(kind) !== win;
            // Keep the design when it suits the new kind; otherwise fall back to the kind's default look.
            const keep = o.design && designFitsKind(o.design, kind) ? o.design : undefined;
            upd('Change opening type', {
              kind,
              ...(switchingFamily
                ? {
                    sillHeight: p.sill,
                    height: p.height,
                    panelMaterialId: isWindowKind(kind) ? DEFAULT_MATERIALS.glass : DEFAULT_MATERIALS.doorPanel,
                    frameMaterialId: isWindowKind(kind) ? DEFAULT_MATERIALS.windowFrame : DEFAULT_MATERIALS.doorFrame,
                  }
                : {}),
              style: keep ? OPENING_DESIGNS_BY_ID[keep].style : p.style,
              design: keep,
            });
          }}
          options={OPENING_KINDS}
        />
        <div className="grid-2">
          <LengthField label="Width" value={o.width} unit={u.units} precision={u.precision} min={0.3} max={6} testId="opening-width" onCommit={(v) => upd('Set opening width', { width: v })} />
          <LengthField label="Height" value={o.height} unit={u.units} precision={u.precision} min={0.2} max={6} onCommit={(v) => upd('Set opening height', { height: v })} />
          {(win || o.sillHeight > 0) && (
            <LengthField label="Sill height" value={o.sillHeight} unit={u.units} precision={u.precision} min={0} max={4} onCommit={(v) => upd('Set sill height', { sillHeight: v })} />
          )}
          <LengthField
            label="From wall start"
            value={fromStart}
            unit={u.units}
            precision={u.precision}
            min={0}
            max={200}
            testId="opening-offset"
            onCommit={(v) => upd('Move opening', { offset: v + o.width / 2 })}
          />
        </div>
        <p className="field-hint num">
          Distance to wall end: {formatLength(fromEnd, u.units, u.precision)}
          {span?.clamped ? ' · clamped to fit the wall' : ''}
        </p>
      </Section>
      {!win && !isPassageKind(o.kind) && (
        <Section title={slides ? 'Slide' : 'Swing'}>
          <div className="btn-row">
            <Button size="sm" onClick={() => flipOpening(openingId, 'side')}>
              Flip side ({o.swingSide})
            </Button>
            {HINGED_KINDS.has(o.kind) && (
              <Button size="sm" onClick={() => flipOpening(openingId, 'hinge')}>
                Flip hinge ({o.hinge})
              </Button>
            )}
            {o.kind === 'door-sliding' && (
              <Button size="sm" title="Which panel slides: the one at the start or the end of the wall" onClick={() => flipOpening(openingId, 'hinge')}>
                Swap panels ({o.hinge === 'start' ? 'slides from start' : 'slides from end'})
              </Button>
            )}
          </div>
          <Slider
            label="Shown open in 3D"
            value={o.openAngle}
            min={0}
            max={90}
            step={5}
            format={(v) => (slides ? `${Math.round((v / 90) * 100)}%` : `${v}°`)}
            onCommit={(v) => upd('Set door opening', { openAngle: v })}
          />
        </Section>
      )}
      {win && o.kind !== 'window-fixed' && (
        <Section title="Sash">
          <Button size="sm" onClick={() => flipOpening(openingId, 'side')}>
            Flip inside / outside
          </Button>
          <Slider label="Shown open in 3D" value={o.openAngle} min={0} max={90} step={5} format={(v) => `${v}°`} onCommit={(v) => upd('Set window opening', { openAngle: v })} />
        </Section>
      )}
      {!isPassageKind(o.kind) && (
        <Section title="Design">
          <OpeningDesignGrid
            kind={o.kind}
            value={resolveOpeningDesign(o)}
            onPick={(design) => exec(win ? 'Set window design' : 'Set door design', (d) => setOpeningDesign(d, [openingId], design))}
          />
        </Section>
      )}
      <Section title="Finishes">
        <OpeningFinishes project={project} openingId={openingId} />
        <MaterialSlotRow label="Frame" target={{ kind: 'opening-frame', openingId }} materialId={o.frameMaterialId} />
        {!isPassageKind(o.kind) && (
          <MaterialSlotRow label={win ? 'Glazing' : 'Door leaf'} target={{ kind: 'opening-panel', openingId }} materialId={o.panelMaterialId} />
        )}
      </Section>
      <OpeningExtras project={project} openingId={openingId} />
    </>
  );
}

// ───────────────────────── Object ─────────────────────────

function ObjectInspector({ project, objectId, isMobile }: { project: Project; objectId: string; isMobile: boolean }) {
  const o = project.objects[objectId];
  const asset = getAsset(project, o.assetId);
  // Finishes list the slots of the item's model (a bare model has no book or decor slots).
  const shown = withModel(asset, o.model);
  const u = project.settings;
  const upd = (label: string, patch: Parameters<typeof updateObjects>[2]) => exec(label, (d) => updateObjects(d, [objectId], patch));
  const min = asset?.minSize ?? { w: 0.02, d: 0.02, h: 0.02 };
  const max = asset?.maxSize ?? { w: 30, d: 30, h: 12 };
  const locked = o.locked || project.layers.furniture.locked;
  return (
    <>
      {!asset && (
        <p className="notice">
          {o.assetId.includes(':')
            ? `“${o.assetId}” comes from the content pack “${o.assetId.split(':')[0]}”, which isn't installed. Add that folder to /packs to see the item; a placeholder outline is shown.`
            : `The asset “${o.assetId}” is not available in this version; a placeholder outline is shown.`}
        </p>
      )}
      <Section title="Item">
        {asset && <ObjectPreview project={project} objectId={objectId} />}
        <TextField label="Label" value={o.name ?? asset?.name ?? ''} onCommit={(name) => upd('Rename object', { name })} />
        {asset && <ObjectModels project={project} objectId={objectId} asset={asset} />}
        {asset && <ObjectVariants project={project} objectId={objectId} asset={asset} />}
      </Section>
      {asset?.plant && (
        <Section title="Plant care">
          <PlantCare plant={asset.plant} units={u.units} details />
        </Section>
      )}
      <Section title="Size">
        {locked &&<p className="notice">Locked — unlock to move or resize.</p>}
        <div className="grid-3">
          <LengthField label="Width" value={o.width} unit={u.units} precision={u.precision} min={min.w} max={max.w} disabled={locked || asset?.resizable.w === false} testId="object-width" onCommit={(v) => upd('Resize object', { width: v })} />
          <LengthField label="Depth" value={o.depth} unit={u.units} precision={u.precision} min={min.d} max={max.d} disabled={locked || asset?.resizable.d === false} onCommit={(v) => upd('Resize object', { depth: v })} />
          <LengthField label="Height" value={o.height} unit={u.units} precision={u.precision} min={min.h} max={max.h} disabled={locked || asset?.resizable.h === false} onCommit={(v) => upd('Resize object', { height: v })} />
        </div>
        {asset && (
          <div className="size-scale-row">
            <NumberField
              label="Scale"
              value={Math.round(scalePct(o, asset))}
              min={1}
              max={1000}
              step={5}
              suffix="%"
              decimals={0}
              disabled={locked || !(asset.resizable.w || asset.resizable.d || asset.resizable.h)}
              onCommit={(pct) => upd('Scale object', scaledSize(o, asset, pct / Math.max(1e-6, scalePct(o, asset)), min, max))}
            />
            <Button size="sm" variant="subtle" disabled={locked} onClick={() => upd('Reset size', { width: asset.defaultSize.w, depth: asset.defaultSize.d, height: asset.defaultSize.h })}>
              Reset to default size
            </Button>
          </div>
        )}
      </Section>
      <Section title="Position">
        <div className="grid-2">
          <LengthField label="X" value={o.x} unit={u.units} precision={u.precision} min={-1000} max={1000} disabled={locked} onCommit={(v) => upd('Move object', { x: v })} />
          <LengthField label="Y" value={o.y} unit={u.units} precision={u.precision} min={-1000} max={1000} disabled={locked} onCommit={(v) => upd('Move object', { y: v })} />
          <LengthField label="Elevation" value={o.elevation} unit={u.units} precision={u.precision} min={-1} max={12} disabled={locked} onCommit={(v) => upd('Set elevation', { elevation: v })} />
          <NumberField
            label="Rotation"
            value={Number(((o.rotation * 180) / Math.PI).toFixed(1))}
            min={-360}
            max={360}
            step={15}
            suffix="°"
            disabled={locked}
            onCommit={(deg) => upd('Rotate object', { rotation: normalizeRotation((deg * Math.PI) / 180) })}
          />
        </div>
        {!isMobile && <Toggle label="Mirrored" checked={o.mirrored} onChange={(v) => upd(v ? 'Mirror object' : 'Unmirror object', { mirrored: v })} />}
      </Section>
      {shown && shown.slots.length > 0 && (
        <Section title="Finishes">
          {shown.slots.map((slot) => (
            <MaterialSlotRow
              key={slot.id}
              label={slot.label}
              target={{ kind: 'object-slot', objectId, slot: slot.id }}
              materialId={objectSlotMaterialId(o, shown, slot.id)}
            />
          ))}
        </Section>
      )}
      <Section title="More" defaultOpen={false}>
        <Toggle label="Locked" checked={o.locked} onChange={(v) => upd(v ? 'Lock object' : 'Unlock object', { locked: v })} />
        <Toggle label="Hidden" checked={o.hidden} onChange={(v) => upd(v ? 'Hide object' : 'Show object', { hidden: v })} />
        {asset && <p className="field-hint">Source: {asset.source.name} · {asset.source.license}</p>}
      </Section>
    </>
  );
}

// ───────────────────────── Room ─────────────────────────

function RoomInspector({ project, roomId }: { project: Project; roomId: string }) {
  const r = project.rooms[roomId];
  const derived = derivePlan(project);
  const face = derived.roomFaces.get(roomId);
  const u = project.settings;
  const upd = (label: string, patch: Parameters<typeof updateRoom>[2]) => exec(label, (d) => updateRoom(d, roomId, patch));
  const ceilingDefault = face ? Math.min(...face.wallIds.map((id) => project.walls[id]?.height ?? 2.7)) : 2.7;
  return (
    <>
      <Section title="Room">
        <TextField label="Name" value={r.name} onCommit={(name) => upd('Rename room', { name })} autoFocusEvent="neest:focus-name" />
        <Select<RoomType>
          label="Type"
          value={r.type}
          onChange={(type) =>
            exec('Set room type', (d) => {
              const room = d.rooms[roomId];
              const prevSuggested = suggestedFloor(room.type);
              room.type = type;
              if (room.floorMaterialId === prevSuggested) assignMaterial(d, [{ kind: 'room-floor', roomId }], suggestedFloor(type));
              if (room.name.startsWith('Room ') && ROOM_TYPE_LABELS[type]) room.name = ROOM_TYPE_LABELS[type];
            })
          }
          options={Object.entries(ROOM_TYPE_LABELS).map(([value, label]) => ({ value: value as RoomType, label }))}
        />
        {face ? (
          <dl className="stats num" data-testid="room-stats">
            <div>
              <dt>Floor area</dt>
              <dd data-testid="room-area">{formatArea(face.area, u.areaUnit, u.precision)}</dd>
            </div>
            <div>
              <dt>Perimeter</dt>
              <dd>{formatLength(face.perimeter, u.units, u.precision)}</dd>
            </div>
            <div>
              <dt>Extent</dt>
              <dd>
                {formatLength(face.bounds.maxX - face.bounds.minX, u.units, u.precision)} × {formatLength(face.bounds.maxY - face.bounds.minY, u.units, u.precision)}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="notice">This room's walls are no longer closed.</p>
        )}
        <p className="field-hint">Measured to the inner wall faces. Rooms are detected automatically from closed walls.</p>
      </Section>
      <Section title="Floor & ceiling">
        <MaterialSlotRow label="Floor" target={{ kind: 'room-floor', roomId }} materialId={r.floorMaterialId} testId="room-floor-material" />
        <MaterialSlotRow label="Ceiling" target={{ kind: 'room-ceiling', roomId }} materialId={r.ceilingMaterialId} />
        <Toggle label="Show ceiling in 3D" checked={r.showCeiling} onChange={(v) => upd('Toggle ceiling', { showCeiling: v })} />
        <LengthField
          label="Ceiling height"
          value={r.ceilingHeight ?? ceilingDefault}
          unit={u.units}
          precision={u.precision}
          min={1}
          max={12}
          hint={r.ceilingHeight == null ? 'Follows the lowest surrounding wall' : undefined}
          onCommit={(v) => upd('Set ceiling height', { ceilingHeight: v })}
        />
      </Section>
      <Section title="Label" defaultOpen={false}>
        <Toggle label="Show label in plan" checked={r.showLabel} onChange={(v) => upd('Toggle room label', { showLabel: v })} />
        <Button size="sm" variant="subtle" onClick={() => upd('Reset label position', { labelOffset: { x: 0, y: 0 } })}>
          Reset label position
        </Button>
        <p className="field-hint">Drag the round handle on the plan to move the label.</p>
      </Section>
    </>
  );
}

// ───────────────────────── Multi-selection ─────────────────────────

function MultiInspector({ project }: { project: Project }) {
  const selection = useEditorStore((s) => s.selection);
  const walls = selection.filter((s) => s.kind === 'wall' && project.walls[s.id]).map((s) => s.id);
  const objects = selection.filter((s) => s.kind === 'object').map((s) => s.id);
  const counts = selection.reduce<Record<string, number>>((acc, s) => ({ ...acc, [s.kind]: (acc[s.kind] ?? 0) + 1 }), {});
  return (
    <>
      <Section title="Selection">
        <p className="field-hint">
          {Object.entries(counts)
            .map(([k, n]) => `${n} ${k}${n > 1 ? 's' : ''}`)
            .join(' · ')}
        </p>
        <div className="btn-row">
          {objects.length > 0 && (
            <>
              <Button size="sm" onClick={duplicateSelection}>
                <Copy size={13} /> Duplicate
              </Button>
              <Button size="sm" onClick={() => rotateSelection()}>
                <RotateCw size={13} /> Rotate group
              </Button>
            </>
          )}
          <Button size="sm" onClick={toggleLockSelection}>
            <Lock size={13} /> Lock / unlock
          </Button>
        </div>
      </Section>
      {walls.length === 2 && <RoundCornerSection project={project} walls={walls} />}
      {walls.length > 0 && (
        <>
          <WallMultiEdit project={project} wallIds={walls} />
          <Section title="Wall type" defaultOpen={false}>
            <WallPresetPicker wallIds={walls} />
          </Section>
        </>
      )}
    </>
  );
}

/** A rounded corner (a curved wall between two straight walls): its radius, or back to a sharp corner. */
function CornerRadiusField({ project, wallId, locked }: { project: Project; wallId: string; locked: boolean }) {
  const c = cornerArc(project, wallId);
  if (!c || c.max <= 0.01) return null;
  const u = project.settings;
  return (
    <div className="corner-radius-row">
      <LengthField
        label="Corner radius"
        value={c.radius}
        unit={u.units}
        precision={u.precision}
        min={0.02}
        max={c.max}
        disabled={locked}
        testId="corner-radius"
        onCommit={(v) => useProjectStore.getState().execute('Set corner radius', (d) => void setCornerRadius(d, wallId, v))}
      />
      <Button
        size="sm"
        disabled={locked}
        title="Remove the rounding: the two walls meet in a sharp corner again"
        data-testid="unround-corner"
        onClick={() => {
          let walls: [string, string] | null = null;
          useProjectStore.getState().execute('Sharp corner', (d) => void (walls = unroundCorner(d, wallId)));
          if (walls) useEditorStore.getState().setSelection((walls as [string, string]).map((id) => ({ kind: 'wall' as const, id })));
        }}
      >
        Sharp corner
      </Button>
    </div>
  );
}

/** Two walls meeting at a corner: replace the corner with a curved wall of a chosen radius. */
function RoundCornerSection({ project, walls }: { project: Project; walls: string[] }) {
  const node = sharedNode(project, walls[0], walls[1]);
  const max = node ? maxCornerRadius(project, node) : null;
  const [radius, setRadius] = useState(0.5);
  if (!node || max === null) return null;
  const r = Math.min(radius, max);
  const u = project.settings;
  return (
    <Section title="Corner">
      <LengthField label="Radius" value={r} unit={u.units} precision={u.precision} min={0.02} max={max} onCommit={setRadius} />
      <div className="btn-row">
        <Button
          size="sm"
          variant="primary"
          data-testid="round-corner"
          onClick={() => {
            let arc: string | null = null;
            useProjectStore.getState().execute('Round corner', (d) => void (arc = roundCorner(d, node, r)));
            if (arc) useEditorStore.getState().setSelection([{ kind: 'wall', id: arc }]);
          }}
        >
          Round corner
        </Button>
      </div>
      <p className="field-hint">Joins the two walls with a curved wall, tangent to both. Up to {formatLength(max, u.units, 2)} here.</p>
    </Section>
  );
}

// ───────────────────────── Tool options & project summary ─────────────────────────

function WallToolOptions({ project }: { project: Project }) {
  const role = useEditorStore((s) => s.wallRole);
  const thickness = useEditorStore((s) => s.wallThickness);
  const u = project.settings;
  const effective = thickness ?? (role === 'exterior' ? u.exteriorThickness : role === 'partition' ? Math.min(0.08, u.defaultWall.thickness) : u.defaultWall.thickness);
  return (
    <Section title="New walls">
      <Segmented<WallRole>
        label="Wall type"
        value={role}
        onChange={(r) => useEditorStore.getState().set({ wallRole: r, wallThickness: null })}
        options={[
          { value: 'exterior', label: 'Exterior' },
          { value: 'interior', label: 'Interior' },
          { value: 'partition', label: 'Partition' },
        ]}
      />
      <div className="grid-2">
        <LengthField label="Thickness" value={effective} unit={u.units} precision={u.precision} min={0.02} max={2} onCommit={(v) => useEditorStore.getState().set({ wallThickness: v })} />
        <LengthField
          label="Height"
          value={u.defaultWall.height}
          unit={u.units}
          precision={u.precision}
          min={0.2}
          max={12}
          onCommit={(v) =>
            exec('Set default wall height', (d) => {
              d.settings.defaultWall.height = v;
            })
          }
        />
      </div>
      <DrawPresetSelect />
      <WallReferencePicker />
      <p className="field-hint">
        Click to place corners; walls snap to endpoints, wall lines, alignment guides and 45° angles. Type a number and press Enter for an exact
        length. Hold Shift to lock the angle.
      </p>
    </Section>
  );
}

function OpeningToolOptions() {
  const kind = useEditorStore((s) => s.openingKind);
  const doorDesign = useEditorStore((s) => s.doorDesign);
  const windowDesign = useEditorStore((s) => s.windowDesign);
  const win = isWindowKind(kind);
  const chosen = win ? windowDesign : doorDesign;
  const design = chosen && designFitsKind(chosen, kind) ? chosen : defaultDesign(kind, OPENING_PRESETS[kind].style);
  return (
    <>
      <Section title="Insert">
        <div className="opening-kinds">
          {Object.values(OPENING_PRESETS).map((p) => (
            <button
              key={p.kind}
              type="button"
              className={`chip${kind === p.kind ? ' on' : ''}`}
              onClick={() => useEditorStore.getState().set({ openingKind: p.kind })}
              aria-pressed={kind === p.kind}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="field-hint">Hover a wall and click. Doors swing toward the side of the wall you point at; flip later in the inspector.</p>
      </Section>
      {!isPassageKind(kind) && (
        <Section title={win ? 'Window design' : 'Door design'}>
          <OpeningDesignGrid kind={kind} value={design} onPick={(d) => useEditorStore.getState().set(win ? { windowDesign: d } : { doorDesign: d })} />
        </Section>
      )}
      {!isPassageKind(kind) && (
        <Section title={win ? 'Window finish' : 'Door finish'}>
          <OpeningToolFinish kind={kind} />
        </Section>
      )}
    </>
  );
}

function ProjectSummary({ project, derived }: { project: Project; derived: ReturnType<typeof derivePlan> }) {
  const u = project.settings;
  const total = derived.faces.reduce((s, f) => s + f.area, 0);
  const walls = [...derived.network.walls.values()].filter((g) => !isDividerWall(g.wall));
  const wallLength = walls.reduce((s, g) => s + g.path.length, 0);
  // Outer size of the walls only (furniture outside, e.g. on a terrace, does not count).
  const shell = walls.reduce<Bounds | null>((b, g) => unionBounds(b, boundsOf(g.footprint)), null);
  const openings = Object.values(project.openings);
  const windows = openings.filter((o) => isWindowKind(o.kind)).length;
  const doors = openings.filter((o) => !isWindowKind(o.kind) && !isPassageKind(o.kind)).length;
  const byCategory = new Map<string, number>();
  for (const o of Object.values(project.objects)) {
    const a = getAsset(project, o.assetId);
    const label = a ? ASSET_CATEGORY_LABELS[a.category] : 'Other';
    byCategory.set(label, (byCategory.get(label) ?? 0) + 1);
  }
  const categories = [...byCategory].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const setLayer = (layer: keyof Project['layers'], patch: Partial<Project['layers']['construction']>) =>
    exec('Change layer', (d) => {
      Object.assign(d.layers[layer], patch);
    });
  return (
    <>
      <Section title="Overview">
        <PlanThumb project={project} />
        <dl className="stats num">
          <div>
            <dt>Rooms</dt>
            <dd>{derived.faces.length}</dd>
          </div>
          <div>
            <dt>Floor area</dt>
            <dd>{formatArea(total, u.areaUnit, u.precision)}</dd>
          </div>
          <div>
            <dt>Items</dt>
            <dd>{Object.keys(project.objects).length}</dd>
          </div>
          <div>
            <dt>Doors</dt>
            <dd>{doors}</dd>
          </div>
          <div>
            <dt>Windows</dt>
            <dd>{windows}</dd>
          </div>
          <div>
            <dt>Wall length</dt>
            <dd>{formatLength(wallLength, u.units, 1)}</dd>
          </div>
        </dl>
        {shell && (
          <div className="list-row static">
            <span>Overall size</span>
            <span className="num">
              {formatLength(shell.maxX - shell.minX, u.units, 2)} × {formatLength(shell.maxY - shell.minY, u.units, 2)}
            </span>
          </div>
        )}
        {derived.faces.length === 0 && Object.keys(project.walls).length === 0 && (
          <div className="empty-hint">
            <strong>Start your plan</strong>
            <span>Press R and drag to draw a room, or W to draw walls corner by corner.</span>
            <div className="btn-row">
              <Button size="sm" variant="primary" onClick={() => useEditorStore.getState().setTool('room')}>
                Draw a room
              </Button>
              <Button size="sm" onClick={() => useEditorStore.getState().setTool('wall')}>
                Draw walls
              </Button>
            </div>
          </div>
        )}
        <div className="room-list">
          {derived.faces.map((f, i) => {
            const r = derived.faceRooms[i];
            if (!r) return null;
            return (
              <button key={f.key} type="button" className="list-row" onClick={() => useEditorStore.getState().setSelection([{ kind: 'room', id: r.id }])}>
                <span>{r.name}</span>
                <span className="num">{formatArea(f.area, u.areaUnit, 1)}</span>
              </button>
            );
          })}
        </div>
      </Section>
      <Section title="Annotations">
        <AnnotationToggles />
      </Section>
      <Section title="Layers">
        {(
          [
            ['construction', 'Walls & openings'],
            ['furniture', 'Furniture & fixtures'],
            ['annotations', 'Labels & dimensions'],
            ['callouts', 'Callouts'],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="layer-row">
            <span>{label}</span>
            <IconButton label={project.layers[key].visible ? `Hide ${label}` : `Show ${label}`} active={project.layers[key].visible} onClick={() => setLayer(key, { visible: !project.layers[key].visible })}>
              {project.layers[key].visible ? <Eye size={14} /> : <EyeOff size={14} />}
            </IconButton>
            {key !== 'annotations' && (
              <IconButton
                label={project.layers[key].locked ? `Unlock ${label}` : `Lock ${label}`}
                active={project.layers[key].locked}
                onClick={() => setLayer(key, { locked: !project.layers[key].locked })}
                data-testid={`lock-${key}`}
              >
                {project.layers[key].locked ? <Lock size={14} /> : <Unlock size={14} />}
              </IconButton>
            )}
          </div>
        ))}
      </Section>
      {categories.length > 0 && (
        <Section title="Items by category">
          <div className="room-list">
            {categories.map(([label, count]) => (
              <div key={label} className="list-row static">
                <span>{label}</span>
                <span className="num">{count}</span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

/** The plan picture from the project card, redrawn shortly after the plan stops changing (drags update it every frame). */
function PlanThumb({ project }: { project: Project }) {
  const [thumb, setThumb] = useState(() => ({ project, svg: renderThumbnail(project) }));
  useEffect(() => {
    if (thumb.project === project) return;
    const t = window.setTimeout(() => setThumb({ project, svg: renderThumbnail(project) }), 400);
    return () => window.clearTimeout(t);
  }, [project, thumb.project]);
  if (!thumb.svg) return null;
  return (
    <div className="project-thumb">
      <img src={thumbnailSrc(thumb.svg)} alt="Plan overview" draggable={false} />
    </div>
  );
}

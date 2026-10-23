import type { Vec2 } from '@/domain/model/schema';
import { derivePlan } from '@/domain/geometry/derive';
import { placeServicePoint, routeToSources, suggestPoint, type ServiceLinkInfo } from '@/domain/geometry/services';
import { addServicePoint, addServiceRun, connectService, disconnectService, removeRunVertex, resetServiceLinks, updateServiceRun } from '@/domain/commands/services';
import { SERVICE_POINTS, SERVICE_SYSTEM_INFO, type ServicePointKind, type ServiceSystem } from '@/domain/model/services';
import type { MenuItem } from '@/components/ContextMenu';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore, type SelItem } from '@/state/editorStore';
import { toast } from '@/state/uiStores';
import { deleteSelection, duplicateSelection, selectAll } from '@/features/editor/actions';
import { needsOfProject, servicesState } from './needs';
import { getObjectAsset } from '@/data/assets/registry';

const ps = () => useProjectStore.getState();
const es = () => useEditorStore.getState();
const SERVICE_KINDS = new Set(['service', 'run']);
const SERVICE_TOOLS = new Set(['service', 'run']);

/** Switches Services mode (X-ray view of power and plumbing) on or off. */
export function setServicesMode(on: boolean): void {
  const ed = es();
  if (ed.servicesMode === on) return;
  const tool = on ? (['select', 'pan', 'service', 'run'].includes(ed.tool) ? ed.tool : 'select') : SERVICE_TOOLS.has(ed.tool) ? 'select' : ed.tool;
  // Keep only what can be picked in the new mode (items that need services stay selected).
  const keep = (s: SelItem) => (on ? SERVICE_KINDS.has(s.kind) || s.kind === 'object' : !SERVICE_KINDS.has(s.kind));
  ed.set({ servicesMode: on, tool, selection: ed.selection.filter(keep), hover: null, hint: null, snapLabel: null });
  // The workspace may be the walkthrough: Services mode is for the plan and 3D views.
  if (on && ed.workspace === 'walk') ed.set({ workspace: '3d' });
}

export const toggleServicesMode = () => setServicesMode(!es().servicesMode);

/** Arms the point tool with a kind (Services panel). */
export function armPoint(kind: ServicePointKind): void {
  setServicesMode(true);
  es().set({ tool: 'service', serviceKind: kind, serviceHost: null });
}

/** Arms the run tool for a system. Drain runs go in the floor. */
export function armRun(system: ServiceSystem, hot = false): void {
  setServicesMode(true);
  const ed = es();
  const levels = SERVICE_SYSTEM_INFO[system].levels;
  ed.set({ tool: 'run', runSystem: system, runHot: system === 'water' && hot, runLevel: levels.includes(ed.runLevel) ? ed.runLevel : levels[0] });
}

/** Adds a point for every unmet need (of the given items, or all), next to the item; one undo step. */
export function addMissingPoints(objectIds?: string[]): number {
  const project = ps().project;
  if (!project) return 0;
  const derived = derivePlan(project);
  const needsOf = needsOfProject(project);
  const only = objectIds ? new Set(objectIds) : null;
  const todo = servicesState(project, derived).needs.filter((n) => !n.met && (!only || only.has(n.objectId)));
  const inputs = todo
    .map((n) => {
      const o = project.objects[n.objectId];
      const needs = o && needsOf(o);
      return o && needs ? suggestPoint(derived, o, n.system, needs) : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
  if (!inputs.length) {
    toast.info(todo.length ? 'No wall near enough for the missing points' : 'Every item is connected');
    return 0;
  }
  ps().execute(inputs.length === 1 ? `Add ${SERVICE_POINTS[inputs[0].kind].name.toLowerCase()}` : `Add ${inputs.length} service points`, (d) => {
    for (const i of inputs) addServicePoint(d, i);
  });
  toast.success(`Added ${inputs.length} point${inputs.length === 1 ? '' : 's'}`, 'Move them where they should go; connections follow.');
  return inputs.length;
}

/** Routes every point without a run to the nearest main (Power in, Water in, Waste out). */
export function connectToSources(): number {
  const project = ps().project;
  if (!project) return 0;
  const runs = routeToSources(project, derivePlan(project));
  if (!runs.length) {
    const sources = Object.values(project.servicePoints ?? {}).filter((p) => SERVICE_POINTS[p.kind].source).length;
    toast.info(sources ? 'Every point already has a run' : 'Add Power in, Water in or Waste out first', 'Runs are routed to the nearest one of their system.');
    return 0;
  }
  ps().execute(`Route ${runs.length} run${runs.length === 1 ? '' : 's'}`, (d) => {
    for (const r of runs) addServiceRun(d, r);
  });
  toast.success(`Routed ${runs.length} run${runs.length === 1 ? '' : 's'}`, 'Drag the bends to follow walls; double-click a run to add one.');
  return runs.length;
}

export function connect(objectId: string, system: ServiceSystem, pointId: string): void {
  ps().execute('Connect', (d) => connectService(d, objectId, system, pointId));
}

export function disconnect(link: Pick<ServiceLinkInfo, 'objectId' | 'system' | 'pointId'>): void {
  ps().execute('Disconnect', (d) => disconnectService(d, link.objectId, link.system, link.pointId));
}

export function resetConnections(objectIds: string[], system?: ServiceSystem): void {
  ps().execute('Reset connections', (d) => resetServiceLinks(d, objectIds, system));
}

/** Right-click menu in Services mode (2D and 3D). */
export function servicesMenuItems(hit: SelItem | null, world: Vec2, link: ServiceLinkInfo | null): MenuItem[] {
  const project = ps().project;
  if (!project) return [];
  const items: MenuItem[] = [];
  if (link) {
    const pt = project.servicePoints?.[link.pointId];
    const o = project.objects[link.objectId];
    return [
      { label: `Disconnect ${o?.name ?? itemName(link.objectId)} from ${pt ? SERVICE_POINTS[pt.kind].name.toLowerCase() : 'point'}`, run: () => disconnect(link) },
      { label: 'Reset this item’s connections', disabled: !o?.serviceLinks, run: () => resetConnections([link.objectId]) },
    ];
  }
  if (hit?.kind === 'service' || hit?.kind === 'run') {
    if (hit.kind === 'run') {
      const r = project.serviceRuns?.[hit.id];
      const near = r?.points.findIndex((p) => Math.hypot(p.x - world.x, p.y - world.y) < 0.15) ?? -1;
      if (r && near > 0 && near < r.points.length - 1) items.push({ label: 'Remove this bend', run: () => ps().execute('Remove bend', (d) => removeRunVertex(d, r.id, near)) });
      if (r) for (const level of SERVICE_SYSTEM_INFO[r.system].levels) items.push({ label: `Run ${level === 'wall' ? 'in the wall' : level === 'floor' ? 'in the floor' : 'in the ceiling'}`, checked: r.level === level, run: () => ps().execute('Change run', (d) => updateServiceRun(d, r.id, { level })) });
      if (r?.system === 'water') items.push({ label: 'Hot water line', checked: r.hot, run: () => ps().execute('Change run', (d) => updateServiceRun(d, r.id, { hot: !r.hot })) });
      items.push({ separator: true, label: '' });
    }
    if (hit.kind === 'service') {
      // The items this point serves: disconnect one from here.
      const served = servicesState(project, derivePlan(project)).links.filter((l) => l.pointId === hit.id);
      for (const l of served) items.push({ label: `Disconnect ${project.objects[l.objectId]?.name ?? itemName(l.objectId)}`, run: () => disconnect(l) });
      if (served.length) items.push({ separator: true, label: '' });
    }
    items.push(
      { label: 'Duplicate', shortcut: 'Ctrl+D', run: duplicateSelection },
      { separator: true, label: '' },
      { label: 'Delete', shortcut: 'Del', danger: true, run: () => void deleteSelection() },
    );
    return items;
  }
  if (hit?.kind === 'object') {
    const o = project.objects[hit.id];
    const state = servicesState(project, derivePlan(project));
    const unmet = state.needs.filter((n) => n.objectId === hit.id && !n.met).length;
    items.push(
      { label: unmet ? `Add missing point${unmet === 1 ? '' : 's'} for this item` : 'All needs connected', disabled: !unmet, run: () => void addMissingPoints([hit.id]) },
      { label: 'Reset connections', disabled: !o?.serviceLinks, run: () => resetConnections([hit.id]) },
    );
    return items;
  }
  items.push(
    { label: 'Add socket here', run: () => placeAt('socket', world) },
    { label: 'Add water point here', run: () => placeAt('water-cold', world) },
    { label: 'Add floor drain here', run: () => placeAt('floor-drain', world) },
    { separator: true, label: '' },
    { label: 'Add missing points', run: () => void addMissingPoints() },
    { label: 'Route runs to sources', run: () => void connectToSources() },
    { separator: true, label: '' },
    { label: 'Select all points & runs', shortcut: 'Ctrl+A', run: selectAll },
    { label: 'Leave Services mode', shortcut: 'U', run: () => setServicesMode(false) },
  );
  return items;
}

/** Places a point of `kind` at a plan spot (wall kinds go into the nearest wall). */
function placeAt(kind: ServicePointKind, p: Vec2): void {
  const project = ps().project;
  if (!project) return;
  const pl = placeServicePoint(derivePlan(project), kind, p, undefined, 1.2);
  if (!pl.valid) {
    toast.info(pl.reason ?? 'Can’t place this here');
    return;
  }
  const info = SERVICE_POINTS[kind];
  const id = ps().execute(`Add ${info.name.toLowerCase()}`, (d) => addServicePoint(d, { kind, x: pl.x, y: pl.y, host: pl.host, wallId: pl.wallId, height: info.height, rotation: pl.rotation }));
  if (id) es().setSelection([{ kind: 'service', id }]);
}

// Picking a building tool (rail, Build panel, shortcuts) leaves Services mode: those tools work on the normal view.
useEditorStore.subscribe((s, prev) => {
  if (s.servicesMode && s.tool !== prev.tool && !['select', 'pan', 'service', 'run'].includes(s.tool)) s.set({ servicesMode: false });
});

/** An item's shown name (its label, else its library item's name). */
function itemName(objectId: string): string {
  const project = ps().project;
  const o = project?.objects[objectId];
  return (o && project && getObjectAsset(project, o)?.name) || 'item';
}

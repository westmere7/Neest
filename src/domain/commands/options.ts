import { current, isDraft } from 'immer';
import { newId } from '../model/ids';
import type { LayoutOption, OptionPlan, Project } from '../model/schema';
import type { D } from './walls';

/**
 * Layout options (phương án): several versions of the plan inside one project. The active option's
 * plan is the project's own nodes/walls/openings/rooms/objects/groups; every other option stores its
 * plan in `options[i].plan`. Switching swaps them. Shared between options: settings, materials,
 * imported models, cameras, render, layers and guest settings. A project without `options` has one
 * implicit layout, "Option A".
 */
export const PLAN_KEYS = ['nodes', 'walls', 'openings', 'rooms', 'objects', 'groups'] as const;

export type NewOptionMode = 'duplicate' | 'shell' | 'blank';

const snapshot = <T>(x: T): T => (isDraft(x) ? (current(x) as T) : x);

/** The plan currently in the project's fields. */
function takePlan(d: D): OptionPlan {
  return {
    nodes: snapshot(d.nodes),
    walls: snapshot(d.walls),
    openings: snapshot(d.openings),
    rooms: snapshot(d.rooms),
    objects: snapshot(d.objects),
    groups: snapshot(d.groups),
  } as OptionPlan;
}

function putPlan(d: D, plan: OptionPlan): void {
  d.nodes = plan.nodes;
  d.walls = plan.walls;
  d.openings = plan.openings;
  d.rooms = plan.rooms;
  d.objects = plan.objects;
  d.groups = plan.groups;
}

/** Next free option letter: A, B… Z, then AA, AB… */
export function nextOptionName(options: Pick<LayoutOption, 'name'>[]): string {
  const used = new Set(options.map((o) => o.name.toLowerCase()));
  for (let i = 0; i < 702; i++) {
    const letters = i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(64 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26));
    const name = `Option ${letters}`;
    if (!used.has(name.toLowerCase())) return name;
  }
  return `Option ${options.length + 1}`;
}

/** Options of a project as shown in the switcher (the implicit "Option A" when there are none). */
export function listOptions(p: Pick<Project, 'options' | 'activeOptionId' | 'createdAt'>): { options: LayoutOption[]; activeId: string } {
  if (p.options?.length) return { options: p.options, activeId: p.activeOptionId ?? p.options.find((o) => !o.plan)?.id ?? p.options[0].id };
  return { options: [{ id: 'default', name: 'Option A', createdAt: p.createdAt, plan: null }], activeId: 'default' };
}

/** Turns the implicit single layout into an explicit "Option A". */
function ensureOptions(d: D): LayoutOption[] {
  if (!d.options?.length) {
    const id = newId('opt');
    d.options = [{ id, name: 'Option A', createdAt: d.createdAt, plan: null }];
    d.activeOptionId = id;
  }
  if (!d.activeOptionId || !d.options.some((o) => o.id === d.activeOptionId)) d.activeOptionId = (d.options.find((o) => !o.plan) ?? d.options[0]).id;
  return d.options;
}

/** Switches to another option: stores the current plan in the active option and loads the other. */
export function switchOption(d: D, id: string): boolean {
  const options = ensureOptions(d);
  const target = options.find((o) => o.id === id);
  if (!target || id === d.activeOptionId) return false;
  const active = options.find((o) => o.id === d.activeOptionId);
  const plan = target.plan ?? emptyPlan();
  if (active) active.plan = takePlan(d);
  putPlan(d, plan);
  target.plan = null;
  d.activeOptionId = id;
  return true;
}

const emptyPlan = (): OptionPlan => ({ nodes: {}, walls: {}, openings: {}, rooms: {}, objects: {}, groups: {} });

/**
 * Adds an option and switches to it. `duplicate` copies the current plan, `shell` keeps the walls,
 * doors, windows and rooms but no furniture, `blank` starts empty. Returns the new option's id.
 */
export function addOption(d: D, mode: NewOptionMode, name?: string): string {
  const options = ensureOptions(d);
  const cur = takePlan(d);
  const plan: OptionPlan =
    mode === 'duplicate' ? cur : mode === 'shell' ? { ...cur, objects: {}, groups: {} } : emptyPlan();
  const id = newId('opt');
  options.push({ id, name: name?.trim() || nextOptionName(options), createdAt: Date.now(), plan });
  switchOption(d, id);
  return id;
}

export function renameOption(d: D, id: string, name: string): void {
  const options = ensureOptions(d);
  const o = options.find((x) => x.id === id || (id === 'default' && x.id === d.activeOptionId));
  const v = name.trim().slice(0, 60);
  if (o && v) o.name = v;
}

/** Deletes an option (never the last one). Deleting the active option switches to a neighbour first. */
export function deleteOption(d: D, id: string): boolean {
  const options = ensureOptions(d);
  if (options.length < 2) return false;
  const i = options.findIndex((o) => o.id === id);
  if (i < 0) return false;
  if (id === d.activeOptionId) switchOption(d, options[i === 0 ? 1 : i - 1].id);
  options.splice(
    options.findIndex((o) => o.id === id),
    1,
  );
  return true;
}

/** Moves an option one place up or down in the list. */
export function moveOption(d: D, id: string, dir: -1 | 1): void {
  const options = ensureOptions(d);
  const i = options.findIndex((o) => o.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= options.length) return;
  const [o] = options.splice(i, 1);
  options.splice(j, 0, o);
}

/**
 * Runs `fn` for the active plan and then for every stored option plan (swapped into the project's
 * fields while it runs), for edits that must reach all options, such as reassigning a deleted
 * material.
 */
export function inEveryOption(d: D, fn: (d: D) => void): void {
  fn(d);
  for (const o of d.options ?? []) {
    if (!o.plan) continue;
    const active = takePlan(d);
    putPlan(d, o.plan);
    fn(d);
    o.plan = takePlan(d);
    putPlan(d, active);
  }
}

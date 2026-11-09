import type { LayoutOption, OptionPlan, Project } from '../model/schema';
import { listOptions, PLAN_KEYS } from '../commands/options';
import { applyOps, diff, type Op } from './ops';

/**
 * The shared document of a project: what every collaborator edits, independent of which layout option each
 * person is looking at. The editor works on a *view* (the `Project` shape the app has always used: the viewed
 * option's plan in the project's own fields, the others in `options[i].plan`); this module converts between
 * the two so changes can be expressed per option:
 *
 *   plans.<optionId>.<walls|nodes|…>.<recordId>.<field>   one option's plan ("default" without options)
 *   optionMeta.<optionId>.name | createdAt                option names
 *   optionOrder                                           option ids in order ([] = the implicit single layout)
 *   <every other project field>                           shared by all options (settings, materials, …)
 *
 * Which option is shown (`activeOptionId`) is per person and not part of the document.
 */
export interface ProjectDoc {
  plans: Record<string, Partial<OptionPlan>>;
  optionMeta: Record<string, { name: string; createdAt: number }>;
  optionOrder: string[];
  [shared: string]: unknown;
}

/** The plan id of a project without explicit options. */
export const DEFAULT_PLAN = 'default';

const PLAN_KEY_SET = new Set<string>(PLAN_KEYS);
const DOC_KEYS = new Set(['plans', 'optionMeta', 'optionOrder']);
const VIEW_KEYS = new Set(['options', 'activeOptionId']);
/** Plan fields every plan has (the others are optional in older files). */
const CORE_PLAN_KEYS = ['nodes', 'walls', 'openings', 'rooms', 'objects', 'groups'] as const;

/** The option a view shows. */
export const viewedOption = (p: Project): string => listOptions(p).activeId;

function planFields(p: Project): Partial<OptionPlan> {
  const plan: Record<string, unknown> = {};
  for (const k of PLAN_KEYS) if (p[k] !== undefined) plan[k] = p[k];
  return plan as Partial<OptionPlan>;
}

/** View → document. Cheap: records are shared by reference, only a few small wrapper objects are new. */
export function toDoc(p: Project): ProjectDoc {
  const doc: Record<string, unknown> = {};
  for (const k of Object.keys(p)) {
    if (PLAN_KEY_SET.has(k) || VIEW_KEYS.has(k)) continue;
    doc[k] = (p as unknown as Record<string, unknown>)[k];
  }
  const { options, activeId } = listOptions(p);
  const explicit = !!p.options?.length;
  const plans: ProjectDoc['plans'] = {};
  const optionMeta: ProjectDoc['optionMeta'] = {};
  for (const o of options) {
    plans[o.id] = o.id === activeId ? planFields(p) : (o.plan ?? {});
    if (explicit) optionMeta[o.id] = { name: o.name, createdAt: o.createdAt };
  }
  return { ...doc, plans, optionMeta, optionOrder: explicit ? options.map((o) => o.id) : [] };
}

/** A plan as stored in a view's `options[i].plan` (every key present). */
function fullPlan(plan: Partial<OptionPlan> | undefined): OptionPlan {
  return {
    nodes: {},
    walls: {},
    openings: {},
    rooms: {},
    objects: {},
    groups: {},
    callouts: {},
    servicePoints: {},
    serviceRuns: {},
    ...plan,
  } as OptionPlan;
}

/**
 * Document → view showing option `show` (or, when it no longer exists, the first option). Field order and
 * unchanged objects are taken from `prev` so saved files do not reshuffle and React keeps its memoised parts.
 */
export function fromDoc(doc: ProjectDoc, show: string, prev?: Project): Project {
  const explicit = doc.optionOrder.length > 0;
  const ids = explicit ? doc.optionOrder : [DEFAULT_PLAN];
  const active = ids.includes(show) ? show : ids[0];
  const plan = doc.plans[active] ?? {};

  let options: LayoutOption[] | undefined;
  if (explicit) {
    const built = ids.map((id) => {
      const meta = doc.optionMeta[id] ?? { name: 'Option', createdAt: 0 };
      return { id, name: meta.name, createdAt: meta.createdAt, plan: id === active ? null : (doc.plans[id] as OptionPlan | undefined) };
    });
    const old = prev?.options;
    const same =
      old?.length === built.length &&
      built.every((o, i) => {
        const q = old[i];
        return q.id === o.id && q.name === o.name && q.createdAt === o.createdAt && (o.plan === null ? q.plan === null : q.plan === o.plan);
      });
    options = same ? old : built.map((o) => ({ ...o, plan: o.plan === null ? null : o.plan === undefined ? fullPlan(undefined) : o.plan }));
  }

  const value = (k: string): unknown => {
    if (PLAN_KEY_SET.has(k)) {
      const v = (plan as Record<string, unknown>)[k];
      return v === undefined && (CORE_PLAN_KEYS as readonly string[]).includes(k) ? {} : v;
    }
    if (k === 'options') return options;
    if (k === 'activeOptionId') return explicit ? active : (prev?.activeOptionId ?? undefined);
    return doc[k];
  };
  const keys = [...(prev ? Object.keys(prev) : [])];
  for (const k of [...Object.keys(doc), ...CORE_PLAN_KEYS, ...PLAN_KEYS, 'options', 'activeOptionId']) {
    if (DOC_KEYS.has(k) || keys.includes(k)) continue;
    keys.push(k);
  }
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    const v = value(k);
    if (v !== undefined) out[k] = v;
  }
  return out as unknown as Project;
}

/** The document changes between two views (which option each shows does not count). */
export const diffProjects = (a: Project, b: Project): Op[] => diff(toDoc(a), toDoc(b));

/** True when the ops change any option's plan or the option list (not only shared fields). */
export const touchesPlans = (ops: Op[]): boolean => ops.some((o) => o.path[0] === 'plans' || o.path[0] === 'optionOrder');

/** Document fields a file edit never carries over (bookkeeping, not content). */
const MERGE_SKIP = new Set(['updatedAt']);

/**
 * Three-way merge of an edited copy (a project file someone changed) into the current version: only what changed
 * from `base` (the version that copy started from) to `edited` is applied, so newer changes in `current` that the
 * copy never saw stay. The edit wins where both changed the same property. Null when the copy changed nothing.
 */
export function mergeEdits(base: Project, edited: Project, current: Project): Project | null {
  const ops = diffProjects(base, edited).filter((o) => !MERGE_SKIP.has(o.path[0]));
  if (!ops.length) return null;
  const { doc } = applyOps(toDoc(current), ops, 'force');
  return fromDoc(doc, viewedOption(current), current);
}

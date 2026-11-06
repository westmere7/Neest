import type { Project } from '@/domain/model/schema';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore } from '@/state/editorStore';

/**
 * Group isolation (like Illustrator's isolation mode): double-click a grouped item to edit inside its
 * group. While a group is isolated (`editor.isolatedGroupId`):
 * - its items are selected, moved and edited one by one (selection is not widened to the group, and
 *   only its items can be selected: groups.ts);
 * - everything else is X-ray in 3D and faded in the plan, and cannot be picked;
 * - items placed or pasted join the group.
 * It ends with Esc (after the selection is cleared), a double-click outside the group, the banner's
 * Done, or by itself when the group goes away (ungrouped, deleted, undone), the project changes or
 * Notes / Connections mode starts.
 */

const es = () => useEditorStore.getState();

/** Ids of the items in group `groupId`. */
export function groupMembers(project: Pick<Project, 'objects'>, groupId: string): Set<string> {
  const out = new Set<string>();
  for (const o of Object.values(project.objects)) if (o.groupId === groupId) out.add(o.id);
  return out;
}

/** Whether a group with this id still has items (two or more make a group). */
export const groupExists = (project: Pick<Project, 'objects' | 'groups'>, groupId: string): boolean => groupMembers(project, groupId).size > 0 && !!project.groups?.[groupId];

const viewCache = new WeakMap<Project, { id: string; view: Project }>();

/** The project as the isolated group sees it: only the group's items (for picking in the plan). */
export function isolatedView(project: Project, groupId: string): Project {
  const hit = viewCache.get(project);
  if (hit && hit.id === groupId) return hit.view;
  const members = groupMembers(project, groupId);
  const view: Project = { ...project, objects: Object.fromEntries(Object.entries(project.objects).filter(([id]) => members.has(id))) };
  viewCache.set(project, { id: groupId, view });
  return view;
}

/** Enters isolation on a group, with one of its items selected (or none). */
export function enterIsolation(groupId: string, focusId?: string): void {
  const p = useProjectStore.getState().project;
  if (!p || !groupExists(p, groupId)) return;
  const ed = es();
  ed.set({ isolatedGroupId: groupId, hover: null });
  ed.setSelection(focusId && p.objects[focusId]?.groupId === groupId ? [{ kind: 'object', id: focusId }] : []);
}

/** Leaves isolation; the group is selected as a whole again. */
export function exitIsolation(reselect = true): void {
  const ed = es();
  const id = ed.isolatedGroupId;
  if (!id) return;
  ed.set({ isolatedGroupId: null, hover: null });
  const p = useProjectStore.getState().project;
  if (reselect && p && groupExists(p, id)) {
    const first = [...groupMembers(p, id)][0];
    ed.setSelection([{ kind: 'object', id: first }]);
  }
}

/** The group a new item should join (the isolated one), or undefined. */
export function isolationGroupFor(project: Pick<Project, 'objects' | 'groups'>): string | undefined {
  const id = es().isolatedGroupId;
  return id && groupExists(project, id) ? id : undefined;
}

/** Ends isolation by itself: the group is gone, another project is open, or Notes / Connections mode started. */
let installed = false;
export function installIsolationWatchers(): void {
  if (installed) return;
  installed = true;
  let projectId: string | null = useProjectStore.getState().project?.id ?? null;
  useProjectStore.subscribe((s) => {
    const id = es().isolatedGroupId;
    const nextId = s.project?.id ?? null;
    const switched = nextId !== projectId;
    projectId = nextId;
    if (!id) return;
    if (!s.project || switched || !groupExists(s.project, id)) exitIsolation(false);
  });
  useEditorStore.subscribe((s, prev) => {
    if (s.isolatedGroupId && ((s.notesMode && !prev.notesMode) || (s.servicesMode && !prev.servicesMode))) exitIsolation(false);
  });
}

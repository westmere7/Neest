import { Button } from '@/components/ui';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore } from '@/state/editorStore';
import { exitIsolation, groupMembers } from './isolation';

/** The pill under the top bar while a group is isolated: which group, how to leave, and Done. */
export function IsolationBanner() {
  const groupId = useEditorStore((s) => s.isolatedGroupId);
  const project = useProjectStore((s) => s.project);
  if (!groupId || !project) return null;
  const name = project.groups?.[groupId]?.name ?? 'Group';
  const count = groupMembers(project, groupId).size;
  return (
    <div className="isolation-banner floating" role="status" data-testid="isolation-banner">
      <span>
        Editing group <strong>“{name}”</strong> · {count} item{count === 1 ? '' : 's'} · Esc or double-click outside to leave
      </span>
      <Button size="sm" variant="primary" onClick={() => exitIsolation()} data-testid="isolation-done">
        Done
      </Button>
    </div>
  );
}

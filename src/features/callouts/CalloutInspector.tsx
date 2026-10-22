import { Button, Toggle } from '@/components/ui';
import type { Project } from '@/domain/model/schema';
import type { DerivedPlan } from '@/domain/geometry/derive';
import { updateCallout } from '@/domain/commands/callouts';
import { getObjectAsset } from '@/data/assets/registry';
import { useProjectStore } from '@/state/projectStore';
import { useDialogStore } from '@/state/uiStores';
import { CalloutCard } from './CalloutCard';

/** What a callout points at, in words. */
export function describeCalloutTarget(project: Project, id: string): string {
  const c = project.callouts?.[id];
  if (!c) return '';
  const t = c.target;
  if (t.kind === 'object') {
    const o = project.objects[t.objectId];
    return o ? `Points to ${o.name || getObjectAsset(project, o)?.name || 'an item'}` : 'Points to an item';
  }
  if (t.kind === 'room') return `Points to ${project.rooms[t.roomId]?.name ?? 'a room'}`;
  if (t.kind === 'region') return 'Points to an area';
  return 'Points to a spot';
}

/** Inspector body for a selected callout: its label, what it points to, visibility and Edit. */
export function CalloutInspector({ project, derived, id }: { project: Project; derived: DerivedPlan; id: string }) {
  const c = project.callouts?.[id];
  const exec = useProjectStore((s) => s.execute);
  if (!c) return null;
  return (
    <div className="pad callout-inspector">
      <p className="field-hint">{describeCalloutTarget(project, id)}</p>
      <div className="callout-preview" style={{ marginBottom: 10 }}>
        <CalloutCard project={project} derived={derived} callout={c} />
      </div>
      <Toggle label="Visible" checked={!c.hidden} onChange={(v) => exec(v ? 'Show note' : 'Hide note', (d) => updateCallout(d, id, { hidden: !v }))} />
      <div className="btn-row">
        <Button size="sm" variant="primary" onClick={() => useDialogStore.getState().open('callout', { id })} data-testid="callout-edit">
          Edit note…
        </Button>
      </div>
      <p className="field-hint">Drag the label to move it. Double-click a label to edit it.</p>
    </div>
  );
}

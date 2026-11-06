import { useMemo, useState } from 'react';
import { Dialog } from '@/components/Overlays';
import { Button, Select } from '@/components/ui';
import { CALLOUT_COLORS, type Callout, type CalloutTarget, type Project } from '@/domain/model/schema';
import { derivePlan } from '@/domain/geometry/derive';
import { calloutAnchor } from '@/domain/geometry/callouts';
import { pointInFace } from '@/domain/geometry/rooms';
import { pointInPolygon, rectPolygon } from '@/domain/geometry/polygon';
import { deleteEntities } from '@/domain/commands/entities';
import { updateCallout } from '@/domain/commands/callouts';
import { getObjectAsset } from '@/data/assets/registry';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore } from '@/state/editorStore';
import { CALLOUT_PALETTE } from './content';
import { NoteImagesEditor, addNoteImages } from './NoteImages';
import { RichNoteEditor } from './RichNoteEditor';

type TargetKind = CalloutTarget['kind'];

/** The targets a callout can switch between from where it is now: the spot, the item and room under it, its area. */
function targetChoices(project: Project, c: Callout): { kind: TargetKind; label: string; target: CalloutTarget }[] {
  const derived = derivePlan(project);
  const a = calloutAnchor(project, derived, c.target);
  const out: { kind: TargetKind; label: string; target: CalloutTarget }[] = [
    { kind: 'general', label: 'General comment', target: { kind: 'general' } },
  ];
  if (!a) {
    out.push({ kind: 'point', label: 'Spot', target: { kind: 'point', x: 0, y: 0, z: 0 } });
    return out;
  }
  const p = { x: a.x, y: a.y };
  out.push({ kind: 'point', label: 'Spot', target: c.target.kind === 'point' ? c.target : { kind: 'point', x: a.x, y: a.y, z: a.z } });
  const item =
    c.target.kind === 'object'
      ? project.objects[c.target.objectId]
      : Object.values(project.objects)
          .filter((o) => !o.hidden && pointInPolygon(p, rectPolygon(o.x, o.y, o.width, o.depth, o.rotation)))
          .sort((x, y) => x.width * x.depth - y.width * y.depth)[0];
  if (item) out.push({ kind: 'object', label: `Item: ${item.name || getObjectAsset(project, item)?.name || 'item'}`, target: { kind: 'object', objectId: item.id } });
  let room = c.target.kind === 'room' ? project.rooms[c.target.roomId] : undefined;
  if (!room)
    derived.faces.forEach((face, i) => {
      const r = derived.faceRooms[i];
      if (r && !room && pointInFace(p, face)) room = r;
    });
  if (room) out.push({ kind: 'room', label: `Room: ${room.name}`, target: { kind: 'room', roomId: room.id } });
  if (c.target.kind === 'region') out.push({ kind: 'region', label: 'Area', target: c.target });
  return out;
}

/**
 * The callout pop-up: what it points to, its note (with a small formatting toolbar and links),
 * pictures, the target's facts, and colour. Changes apply on Save as one undo step; Cancel on a
 * callout that was just placed removes it again.
 */
export function CalloutDialog({ id, isNew, onClose }: { id: string; isNew?: boolean; onClose: () => void }) {
  const project = useProjectStore((s) => s.project);
  const callout = project?.callouts?.[id];
  const [draft, setDraft] = useState<Callout | null>(() => (callout ? structuredClone(callout) : null));
  const choices = useMemo(() => (project && callout ? targetChoices(project, callout) : []), [project, callout]);
  if (!project || !callout || !draft) return null;
  // Functional update: images arrive asynchronously, after more typing may have happened.
  const set = (patch: Partial<Callout>) => setDraft((cur) => (cur ? { ...cur, ...patch } : cur));

  const close = (saved: boolean) => {
    if (!saved && isNew) {
      // A callout that was just placed and never saved is removed again.
      useProjectStore.getState().execute('Remove note', (d) => deleteEntities(d, [id]));
      useEditorStore.getState().clearSelection();
    }
    onClose();
  };
  const save = () => {
    const { id: _id, ...patch } = { ...draft, title: '', showInfo: false };
    useProjectStore.getState().execute(isNew ? 'Add note' : 'Edit note', (d) => updateCallout(d, id, patch));
    onClose();
  };
  const remove = () => {
    useProjectStore.getState().execute('Delete note', (d) => deleteEntities(d, [id]));
    useEditorStore.getState().clearSelection();
    onClose();
  };

  const kind = draft.target.kind;

  return (
    <Dialog
      title={isNew ? 'New note' : 'Edit note'}
      onClose={() => close(false)}
      testId="callout-dialog"
      footer={
        <>
          {!isNew && (
            <Button variant="ghost" onClick={remove} data-testid="callout-delete">
              Delete
            </Button>
          )}
          <span style={{ flex: 1 }} />
          <Button variant="ghost" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} data-testid="callout-save">
            Save
          </Button>
        </>
      }
    >
      <div className="callout-editor" onKeyDown={(e) => e.stopPropagation()}>
        <div className="callout-main">
          {choices.length > 1 && (
            <Select<TargetKind>
              label="Points to"
              value={kind}
              options={choices.map((c) => ({ value: c.kind, label: c.label }))}
              onChange={(k) => {
                const c = choices.find((x) => x.kind === k);
                if (c) set({ target: c.target });
              }}
            />
          )}
          <div className="field">
            <span className="field-label">Note</span>
            <RichNoteEditor
              value={draft.note}
              onChange={(note) => set({ note })}
              placeholder="Write a note… (paste or drop images to attach them)"
              onSubmit={save}
              onPasteFiles={(files) => void addNoteImages(draft.images, files).then((images) => set({ images }))}
              minHeight={130}
              autoFocus
              testId="callout-note"
            />
          </div>
          <div className="field">
            <span className="field-label">Images</span>
            <NoteImagesEditor images={draft.images} onChange={(images) => set({ images })} />
            <span className="field-hint">Shown in the note’s full view (Notes panel, Inspector), not on the plan or in 3D.</span>
          </div>
          <div className="field callout-color-row">
            <span className="field-label">Colour</span>
            <div className="callout-colors">
              {CALLOUT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  aria-pressed={draft.color === c}
                  style={{ background: CALLOUT_PALETTE[c].main }}
                  onClick={() => set({ color: c })}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

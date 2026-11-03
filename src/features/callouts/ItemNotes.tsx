import { MessageSquareText } from 'lucide-react';
import type { Project } from '@/domain/model/schema';
import { pointInPolygon, rectPolygon } from '@/domain/geometry/polygon';
import { IconButton } from '@/components/ui';
import { openContextMenu } from '@/components/ContextMenu';
import { useEditorStore } from '@/state/editorStore';
import { useDialogStore } from '@/state/uiStores';
import { createCalloutAt, spotOnItem } from '@/features/plan-2d/tools/calloutTool';
import { noteSummary } from './content';

/** Notes on an item or a room: pinned to it, or (items) spot notes standing on its footprint. */
export function notesOn(project: Project, target: { kind: 'object' | 'room'; id: string }) {
  const o = target.kind === 'object' ? project.objects[target.id] : undefined;
  const outline = o ? rectPolygon(o.x, o.y, o.width, o.depth, o.rotation) : null;
  return Object.values(project.callouts ?? {}).filter((c) => {
    const t = c.target;
    if (target.kind === 'room') return t.kind === 'room' && t.roomId === target.id;
    if (t.kind === 'object') return t.objectId === target.id;
    return t.kind === 'point' && !!outline && pointInPolygon({ x: t.x, y: t.y }, outline);
  });
}

/**
 * The note icon in an item's or room's panel header. Lit when the selection has notes: one note
 * opens its editor, several offer a menu; with none it adds a note (a spot on an item).
 */
export function NoteButton({ project, target }: { project: Project; target: { kind: 'object' | 'room'; id: string } }) {
  const notes = notesOn(project, target);
  const edit = (id: string) => useDialogStore.getState().open('callout', { id });
  const add = () => {
    const px = 1 / Math.max(1, useEditorStore.getState().planCamera.zoom);
    createCalloutAt(target.kind === 'object' ? spotOnItem(project, target.id) : { kind: 'room', roomId: target.id }, px);
  };
  const label = notes.length === 0 ? 'Add note' : notes.length === 1 ? 'Edit note' : `Notes (${notes.length})`;
  return (
    <IconButton
      label={label}
      active={notes.length > 0}
      data-testid="item-note"
      onClick={(e) => {
        if (!notes.length) return add();
        if (notes.length === 1) return edit(notes[0].id);
        const r = e.currentTarget.getBoundingClientRect();
        openContextMenu(r.left, r.bottom + 4, [
          ...notes.map((c) => ({ label: `Edit “${noteSummary(c, 32)}”${c.hidden ? ' (hidden)' : ''}`, run: () => edit(c.id) })),
          { separator: true, label: '' },
          { label: 'Add another note', run: add },
        ]);
      }}
    >
      <MessageSquareText size={15} />
    </IconButton>
  );
}

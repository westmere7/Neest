import { MessageSquareText } from 'lucide-react';
import type { Project } from '@/domain/model/schema';
import { IconButton } from '@/components/ui';
import { openContextMenu } from '@/components/ContextMenu';
import { useEditorStore } from '@/state/editorStore';
import { useDialogStore } from '@/state/uiStores';
import { createCalloutAt } from '@/features/plan-2d/tools/calloutTool';

/** Notes pinned to an item or a room. */
export function notesOn(project: Project, target: { kind: 'object' | 'room'; id: string }) {
  return Object.values(project.callouts ?? {}).filter((c) =>
    target.kind === 'object' ? c.target.kind === 'object' && c.target.objectId === target.id : c.target.kind === 'room' && c.target.roomId === target.id,
  );
}

/**
 * The note icon in an item's or room's panel header. Lit when the selection has notes: one note
 * opens its editor, several offer a menu; with none it adds a note.
 */
export function NoteButton({ project, target }: { project: Project; target: { kind: 'object' | 'room'; id: string } }) {
  const notes = notesOn(project, target);
  const edit = (id: string) => useDialogStore.getState().open('callout', { id });
  const add = () => {
    const px = 1 / Math.max(1, useEditorStore.getState().planCamera.zoom);
    createCalloutAt(target.kind === 'object' ? { kind: 'object', objectId: target.id } : { kind: 'room', roomId: target.id }, px);
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
          ...notes.map((c) => ({ label: `Edit “${c.title.trim() || 'Note'}”${c.hidden ? ' (hidden)' : ''}`, run: () => edit(c.id) })),
          { separator: true, label: '' },
          { label: 'Add another note', run: add },
        ]);
      }}
    >
      <MessageSquareText size={15} />
    </IconButton>
  );
}

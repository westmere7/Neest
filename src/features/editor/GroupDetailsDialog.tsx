import { useState } from 'react';
import { Dialog } from '@/components/Overlays';
import { Button } from '@/components/ui';
import { setGroupDetails } from '@/domain/commands/entities';
import { useProjectStore } from '@/state/projectStore';
import { usePrefsStore } from '@/state/uiStores';

/**
 * Name and description of a group: a group placed in the project (`kind: 'placed'`, undoable) or one
 * of the user's saved groups in the library (`kind: 'saved'`). Opened through the dialog store as
 * 'group-details' with `{ kind, id }`.
 */
export function GroupDetailsDialog({
  kind,
  id,
  onClose,
}: {
  kind: 'placed' | 'saved';
  id: string;
  onClose: () => void;
}) {
  const placed = useProjectStore((s) => (kind === 'placed' ? s.project?.groups?.[id] : undefined));
  const saved = usePrefsStore((s) => (kind === 'saved' ? s.savedGroups.find((g) => g.id === id) : undefined));
  const group = placed ?? saved;
  const [name, setName] = useState(group?.name ?? '');
  const [description, setDescription] = useState(group?.description ?? '');
  if (!group) return null;
  const save = () => {
    if (kind === 'placed')
      useProjectStore
        .getState()
        .execute('Edit group details', (d) => setGroupDetails(d, id, { name, description }));
    else usePrefsStore.getState().updateSavedGroup(id, { name, description });
    onClose();
  };
  return (
    <Dialog
      title={kind === 'placed' ? 'Group details' : 'Saved group details'}
      onClose={onClose}
      testId="group-details-dialog"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={!name.trim()} data-testid="group-details-save">
            Save
          </Button>
        </>
      }
    >
      <div className="group-details">
        <label className="field">
          <span className="field-label">Name</span>
          <input
            className="input"
            value={name}
            maxLength={kind === 'placed' ? 80 : 60}
            data-autofocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter' && name.trim()) save();
            }}
          />
        </label>
        <label className="field">
          <span className="field-label">Description</span>
          <textarea
            className="input group-description-input"
            value={description}
            maxLength={500}
            rows={4}
            placeholder="What the group is and how it is meant to be used (optional)"
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
          />
          <span className="field-hint">
            {kind === 'saved'
              ? 'Shown in the library info card and copied onto every placed copy.'
              : 'Kept with the group in this project; copied when you save it to the library.'}
          </span>
        </label>
      </div>
    </Dialog>
  );
}

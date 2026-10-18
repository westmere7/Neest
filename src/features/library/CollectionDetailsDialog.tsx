import { useState } from 'react';
import { Dialog } from '@/components/Overlays';
import { Button } from '@/components/ui';
import { getAsset } from '@/data/assets/registry';
import { useProjectStore } from '@/state/projectStore';
import { saveCollectionDetails, saveNewCollection } from './collections';

/**
 * Name and description of a library collection: a new one (`id` absent, optionally starting with
 * `itemId`) or an existing one. Opened through the dialog store as 'collection-details'.
 */
export function CollectionDetailsDialog({ id, itemId, onClose }: { id?: string; itemId?: string; onClose: () => void }) {
  const existing = useProjectStore((s) => (id ? s.project?.collections.find((c) => c.id === id) : undefined));
  const count = useProjectStore((s) => s.project?.collections.length ?? 0);
  const item = useProjectStore((s) => (itemId && s.project ? getAsset(s.project, itemId) : null));
  const [name, setName] = useState(existing?.name ?? `Collection ${count + 1}`);
  const [description, setDescription] = useState(existing?.description ?? '');
  if (id && !existing) return null;
  const save = () => {
    if (!name.trim()) return;
    if (existing) saveCollectionDetails(existing.id, name, description);
    else saveNewCollection(name, description, itemId);
    onClose();
  };
  return (
    <Dialog
      title={existing ? 'Collection details' : 'New collection'}
      onClose={onClose}
      testId="collection-details-dialog"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={!name.trim()} data-testid="collection-details-save">
            {existing ? 'Save' : 'Create'}
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
            maxLength={60}
            data-autofocus
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter' && name.trim()) save();
            }}
            data-testid="collection-name"
          />
        </label>
        <label className="field">
          <span className="field-label">Description</span>
          <textarea
            className="input group-description-input"
            value={description}
            maxLength={500}
            rows={3}
            placeholder="What the collection is for (optional)"
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
          />
          <span className="field-hint">
            {item ? `Starts with “${item.name}”. ` : ''}Collections belong to this project and are shared by all its options. Right-click any item or group in the
            library to add it.
          </span>
        </label>
      </div>
    </Dialog>
  );
}

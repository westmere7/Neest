import { confirmAction, toast, useDialogStore, usePrefsStore, type SavedGroup } from '@/state/uiStores';

/**
 * Saved-group actions for the library's Groups list (the cards themselves are ordinary item cards
 * built by savedGroupAssets.ts).
 */
export function editSavedGroupDetails(id: string): void {
  useDialogStore.getState().open('group-details', { kind: 'saved', id });
}

/** Copies a ready-made group into the user's saved groups (to rename, describe or delete it). */
export function copyReadyGroup(g: SavedGroup): void {
  const { shelf: _s, room: _r, ...rest } = g;
  const copy: SavedGroup = {
    ...structuredClone(rest),
    id: Date.now().toString(36),
    name: `${g.name} (copy)`.slice(0, 60),
    createdAt: Date.now(),
  };
  usePrefsStore.getState().saveGroup(copy);
  toast.success(`Copied “${g.name}”`, 'It is now under Your groups, ready to rename or describe.');
}

export async function removeSavedGroup(id: string): Promise<void> {
  const g = usePrefsStore.getState().savedGroups.find((x) => x.id === id);
  if (!g) return;
  if (
    await confirmAction({
      title: `Delete “${g.name}”?`,
      message: 'It is removed from the library. Items already placed stay.',
      confirmLabel: 'Delete',
      danger: true,
    })
  )
    usePrefsStore.getState().deleteSavedGroup(id);
}

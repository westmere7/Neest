import { confirmAction, usePrefsStore } from '@/state/uiStores';

/**
 * Saved-group actions for the library's Groups tab (the cards themselves are ordinary item cards
 * built by savedGroupAssets.ts).
 */
export function renameSavedGroupPrompt(id: string): void {
  const g = usePrefsStore.getState().savedGroups.find((x) => x.id === id);
  if (!g) return;
  const name = window.prompt('Group name', g.name);
  if (name?.trim()) usePrefsStore.getState().renameSavedGroup(id, name);
}

export async function removeSavedGroup(id: string): Promise<void> {
  const g = usePrefsStore.getState().savedGroups.find((x) => x.id === id);
  if (!g) return;
  if (await confirmAction({ title: `Delete “${g.name}”?`, message: 'It is removed from the library. Items already placed stay.', confirmLabel: 'Delete', danger: true }))
    usePrefsStore.getState().deleteSavedGroup(id);
}

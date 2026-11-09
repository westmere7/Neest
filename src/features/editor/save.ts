import { isTextEntry } from '@/components/hooks';
import { toast } from '@/state/uiStores';
import { workspaceFolder } from '@/storage/workspace';
import { useLiveStore, type LiveState } from '@/sync/live';
import { saveNow, useSaveStore } from '../projects/projectService';

/** Where a shared project's changes stand: they go to the team's server as they are made, no Save needed. */
export function teamSaveState(live: Pick<LiveState, 'status' | 'pending'>): { label: string; detail: string; ok: boolean } {
  if (live.status === 'live' && live.pending === 0)
    return { label: 'Saved to the team', detail: 'Every change goes to the team server as you make it; everyone sees it.', ok: true };
  if (live.status === 'live') return { label: 'Sending to the team…', detail: 'Your last changes are on their way to the team server.', ok: true };
  if (live.status === 'signin') return { label: 'Sign in to save to the team', detail: 'Changes stay in this browser until you sign in.', ok: false };
  if (live.status === 'error') return { label: 'Not saved to the team', detail: 'The team server refused the connection; changes stay in this browser.', ok: false };
  return { label: 'Offline · will send to the team', detail: 'Changes are kept in this browser and sent when the connection is back.', ok: false };
}

/**
 * Save (Ctrl+S / the Save button): commits a field that is being typed in (fields commit on blur), then
 * writes the project file in the repo folder (or, without one, stores it in this browser) and says so. A project
 * shared with the team is saved on the team server as it is edited: Save only says where things stand.
 */
export async function saveWithFeedback(): Promise<void> {
  const el = document.activeElement;
  if (el instanceof HTMLElement && isTextEntry(el)) {
    el.blur();
    await new Promise((r) => setTimeout(r, 0));
  }
  const live = useLiveStore.getState();
  if (live.room) {
    const team = teamSaveState(live);
    (team.ok ? toast.success : toast.warning)(team.label, team.detail);
    return;
  }
  const where = await saveNow();
  if (where === 'file') toast.success('Saved', `Written to the project file in ${workspaceFolder()}/.`);
  else if (where === 'browser') toast.success('Saved in this browser');
  else {
    const s = useSaveStore.getState();
    if (s.state === 'error' || s.repo === 'error') toast.error('Save failed', s.error ?? undefined);
  }
}

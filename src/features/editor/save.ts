import { isTextEntry } from '@/components/hooks';
import { toast } from '@/state/uiStores';
import { workspaceFolder } from '@/storage/workspace';
import { saveNow, useSaveStore } from '../projects/projectService';

/**
 * Save (Ctrl+S / the Save button): commits a field that is being typed in (fields commit on blur), then
 * writes the project file in the repo folder (or, without one, stores it in this browser) and says so.
 */
export async function saveWithFeedback(): Promise<void> {
  const el = document.activeElement;
  if (el instanceof HTMLElement && isTextEntry(el)) {
    el.blur();
    await new Promise((r) => setTimeout(r, 0));
  }
  const where = await saveNow();
  if (where === 'file') toast.success('Saved', `Written to the project file in ${workspaceFolder()}/.`);
  else if (where === 'browser') toast.success('Saved in this browser');
  else {
    const s = useSaveStore.getState();
    if (s.state === 'error' || s.repo === 'error') toast.error('Save failed', s.error ?? undefined);
  }
}

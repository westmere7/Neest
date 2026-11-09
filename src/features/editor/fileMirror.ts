import type { Project } from '@/domain/model/schema';
import { mergeEdits } from '@/domain/sync/doc';
import { migrateProject } from '@/storage/migrations';
import { preferenceRepository } from '@/storage/indexeddb/db';
import { loadFromWorkspace, onWorkspaceChange, pullWorkspaceAssets, saveToWorkspace, workspaceAvailable } from '@/storage/workspace';
import { useProjectStore } from '@/state/projectStore';
import { toast } from '@/state/uiStores';
import { useLiveStore } from '@/sync/live';
import { saveProject } from '../projects/projectService';

/**
 * The project file of a shared project, kept as a two-way mirror while it is open in a dev server (`npm run dev`):
 *
 * - the file always holds the team's current version (written a moment after any change, anyone's), so an
 *   assistant editing it (Gemini, Claude) starts from the latest;
 * - an edit to the file is merged in as this person's change and sent to the team. Only what the file changed
 *   since it was last written counts (`mergeEdits` against that version, kept in this browser), so newer changes by
 *   others are never reverted by an old copy.
 *
 * The file is a working copy, not the project of record: shared projects' files are not committed.
 */

const WRITE_DELAY_MS = 800;
const baseKey = (id: string) => `fileMirrorBase:${id}`;

export function startFileMirror(projectId: string): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  /** What the file was last written as (or read as); edits are measured from it. */
  let base: Project | null = null;
  let written = '';
  let queue: Promise<void> = Promise.resolve();
  const serial = (fn: () => Promise<void>) => {
    queue = queue.then(fn, fn).catch((e: unknown) => console.warn('File mirror:', e));
    return queue;
  };

  /** Merges edits made to the file since it was written, then writes the current version (if it changed). */
  const sync = () =>
    serial(async () => {
      if (stopped || useLiveStore.getState().status === 'off') return;
      const raw = await loadFromWorkspace(projectId).catch(() => null);
      if (raw && base) {
        const { project: file } = migrateProject(raw);
        const current = useProjectStore.getState().project;
        const merged = current && current.id === projectId ? mergeEdits(base, file, current) : null;
        if (merged) {
          await pullWorkspaceAssets(file);
          useProjectStore.getState().applyExternal(merged, 'Changes from the project file');
          await saveProject(merged, true);
          toast.info('Project file changes applied', 'They are sent to the team. Undo (Ctrl+Z) takes them back.');
        }
      }
      const now = useProjectStore.getState().project;
      if (stopped || !now || now.id !== projectId) return;
      const json = JSON.stringify(now);
      if (json === written) return;
      await saveToWorkspace(now);
      written = json;
      base = now;
      await preferenceRepository.set(baseKey(projectId), now);
    });

  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void sync();
    }, WRITE_DELAY_MS);
  };

  const unsubs: (() => void)[] = [];
  void (async () => {
    if (!(await workspaceAvailable())) return;
    // Merge only once the team's version is in (it replaces this browser's copy when the room connects).
    await new Promise<void>((resolve) => {
      if (useLiveStore.getState().status === 'live') return resolve();
      const unsub = useLiveStore.subscribe((s) => {
        if (s.status === 'live') {
          unsub();
          resolve();
        }
      });
      unsubs.push(unsub);
    });
    if (stopped) return;
    // The version the file was last written as by this browser. Without one (first time here) the file is an
    // older snapshot: it is replaced, not merged.
    base = (await preferenceRepository.get<Project>(baseKey(projectId)).catch(() => undefined)) ?? null;
    await sync();
    unsubs.push(useProjectStore.subscribe((s, prev) => s.project !== prev.project && schedule()));
    unsubs.push(onWorkspaceChange((e) => e.id === projectId && e.kind !== 'unlink' && void sync()));
  })();

  return () => {
    // The last change (still waiting for its write) goes to the file before the project closes.
    const last = timer && base ? useProjectStore.getState().project : null;
    stopped = true;
    if (timer) clearTimeout(timer);
    for (const u of unsubs) u();
    if (last && last.id === projectId)
      void serial(async () => {
        if (JSON.stringify(last) === written) return;
        await saveToWorkspace(last);
        await preferenceRepository.set(baseKey(projectId), last);
      });
  };
}

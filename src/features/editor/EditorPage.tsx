import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore } from '@/state/editorStore';
import { toast } from '@/state/uiStores';
import { ProjectImportError } from '@/storage/migrations';
import { Button } from '@/components/ui';
import { navigate } from '@/app/App';
import { loadProject, saveProject, startAutosave } from '../projects/projectService';
import { migrateProject } from '@/storage/migrations';
import { loadFromWorkspace, onWorkspaceChange, pullWorkspaceAssets, workspaceFolder } from '@/storage/workspace';
import { EditorShell } from './EditorShell';
import { pruneSelection } from './actions';

/** Loads a project from local storage, starts autosave, and renders the editor. */
export default function EditorPage({ projectId }: { projectId: string }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const project = useProjectStore((s) => s.project);

  useEffect(() => {
    let stop: (() => void) | null = null;
    let cancelled = false;
    (async () => {
      try {
        const res = await loadProject(projectId);
        if (cancelled) return;
        if (!res) {
          setStatus('missing');
          return;
        }
        useEditorStore.getState().set({ selection: [], hover: null, tool: 'select', measurements: [], fitRequest: 0 });
        useProjectStore.getState().load(res.project);
        if (res.warnings.length) toast.warning('Project repaired on load', res.warnings.join(' '));
        if (res.source === 'repo')
          toast.info(
            res.firstOpen ? 'Opened from the repo folder' : 'Loaded the newer copy from the repo',
            res.firstOpen
              ? `It is now saved in this browser too, and your edits sync back to ${workspaceFolder()}/.`
              : `${workspaceFolder()}/ had a more recent version of this project.`,
          );
        stop = startAutosave();
        setStatus('ready');
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof ProjectImportError ? e.message : 'The project could not be opened.');
        setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
      stop?.();
      useProjectStore.getState().close();
    };
  }, [projectId]);

  // Live link to the repository folder: on-disk edits (agents, git pull, editors) appear immediately.
  useEffect(() => {
    if (status !== 'ready') return;
    return onWorkspaceChange(async (e) => {
      if (e.id !== projectId) return;
      if (e.kind === 'unlink') {
        toast.info('Removed from the repo folder', 'The project file was deleted on disk; this browser copy is kept and will be written back on the next save.');
        return;
      }
      try {
        const raw = await loadFromWorkspace(projectId);
        if (!raw) return;
        const { project: incoming } = migrateProject(raw);
        const current = useProjectStore.getState().project;
        if (!current || incoming.updatedAt <= current.updatedAt) return;
        await pullWorkspaceAssets(incoming);
        useProjectStore.getState().applyExternal(incoming, 'External change (repo folder)');
        await saveProject(incoming, true, false);
        toast.info('Project updated from disk', `Changes in ${e.file} were loaded. Undo (Ctrl+Z) restores your previous version.`);
      } catch (err) {
        toast.warning('Could not load the changed project file', err instanceof Error ? err.message : undefined);
      }
    });
  }, [status, projectId]);

  // Keep the selection valid across undo/redo/deletes.
  useEffect(() => {
    if (project) pruneSelection(project);
  }, [project]);

  useEffect(() => {
    if (project) document.title = `${project.name} — Neest`;
  }, [project?.name, project]);

  if (status === 'loading' || (status === 'ready' && !project)) return <div className="app-loading">Opening project…</div>;
  if (status === 'missing' || status === 'error')
    return (
      <div className="app-loading">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', maxWidth: 420, textAlign: 'center' }}>
          <strong>{status === 'missing' ? 'Project not found in this browser' : 'Project could not be opened'}</strong>
          <span style={{ color: 'var(--text-2)' }}>
            {status === 'missing'
              ? 'Projects are stored per browser. Import a .neest file to open it here.'
              : error}
          </span>
          <Button onClick={() => navigate('/')}>
            <ArrowLeft size={15} /> Back to projects
          </Button>
        </div>
      </div>
    );
  return <EditorShell />;
}

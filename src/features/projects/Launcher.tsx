import { useCallback, useEffect, useRef, useState } from 'react';
import { Copy, Download, FolderGit2, FolderOpen, HardDrive, MoreHorizontal, Pencil, Plus, Sparkles, Trash2, Upload } from 'lucide-react';
import type { LengthUnit } from '@/domain/model/schema';
import { formatArea, parseLength } from '@/domain/model/units';
import { projectRepository } from '@/storage/indexeddb/db';
import type { ProjectSummary } from '@/storage/repository';
import { ProjectImportError } from '@/storage/migrations';
import { Button, Field, IconButton, Select } from '@/components/ui';
import { Dialog } from '@/components/Overlays';
import { openContextMenu } from '@/components/ContextMenu';
import { confirmAction, toast } from '@/state/uiStores';
import { navigate } from '@/app/App';
import { ThemeSwitch } from '@/components/ThemeSwitch';
import { Logo } from '@/components/Logo';
import {
  createDemoProject,
  createProject,
  deleteProject,
  duplicateProject,
  loadProject,
  renameProject,
  saveProject,
} from './projectService';
import { downloadBlob, exportFilename, exportNeest, importNeestFile } from '../exports/neestFile';
import { SAMPLES } from './demoProject';
import {
  listWorkspace,
  loadFromWorkspace,
  onWorkspaceChange,
  removeFromWorkspace,
  workspaceAvailable,
  workspaceFolder,
  type WorkspaceEntry,
} from '@/storage/workspace';
import { generateThumbnail, thumbnailSrc } from './thumbnails';
import { usePrefsStore } from '@/state/uiStores';
import { Toggle } from '@/components/ui';
import './launcher.css';

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.round(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} day${d > 1 ? 's' : ''} ago`;
  return new Date(ts).toLocaleDateString();
}

interface ThumbSource {
  key: string;
  load: () => Promise<unknown | null>;
  /** Called with a freshly rendered thumbnail so it can be stored. */
  persist?: (svg: string) => void;
}

/** Where a local card's preview comes from when the stored one is missing or stale. */
function thumbSource(p: ProjectSummary, r: WorkspaceEntry | undefined): ThumbSource | null {
  // A teammate's newer copy in the repo opens instead of the local one, so preview that.
  if (r && r.updatedAt > p.updatedAt + 1) return { key: `repo:${r.id}:${r.updatedAt}`, load: () => loadFromWorkspace(r.id) };
  if (p.thumbnail) return null;
  return {
    key: `local:${p.id}:${p.updatedAt}`,
    load: () => projectRepository.loadRaw(p.id),
    persist: (svg) => void projectRepository.setThumbnail(p.id, svg).catch(() => undefined),
  };
}

/** Plan preview of a project card; renders one on demand when none is stored. */
function ProjectThumb({ stored, source, empty }: { stored: string | null; source: ThumbSource | null; empty: React.ReactNode }) {
  const [rendered, setRendered] = useState<{ key: string; svg: string | null } | null>(null);
  const key = source?.key ?? null;
  const latest = useRef(source);
  latest.current = source;
  useEffect(() => {
    const src = latest.current;
    if (!key || !src) return;
    let alive = true;
    void generateThumbnail(key, src.load).then((svg) => {
      if (!alive) return;
      setRendered({ key, svg });
      if (svg) src.persist?.(svg);
    });
    return () => {
      alive = false;
    };
  }, [key]);
  const done = key !== null && rendered?.key === key;
  const svg = done ? (rendered.svg ?? stored) : stored;
  if (svg)
    return (
      <div className="thumb">
        <img src={thumbnailSrc(svg)} alt="" draggable={false} />
      </div>
    );
  if (key && !done) return <div className="thumb loading" aria-busy="true" />;
  return <div className="thumb empty">{empty}</div>;
}

export function Launcher() {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [renaming, setRenaming] = useState<ProjectSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [repo, setRepo] = useState<{ available: boolean; entries: WorkspaceEntry[] }>({ available: false, entries: [] });
  const repoSync = usePrefsStore((s) => s.repoSync);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      setProjects(await projectRepository.list());
      setError(null);
      const available = await workspaceAvailable();
      setRepo({ available, entries: available ? await listWorkspace() : [] });
    } catch (e) {
      setError(
        e instanceof Error && /indexeddb|database/i.test(e.message)
          ? 'Local storage is unavailable in this browser mode (for example a private window). Projects cannot be saved.'
          : 'Could not read local projects.',
      );
      setProjects([]);
    }
  }, []);

  useEffect(() => {
    document.title = 'Neest — Apartment planner';
    void refresh();
    // Teammates' changes (git pull) or agent edits in the repo folder show up live.
    return onWorkspaceChange(() => void refresh());
  }, [refresh]);

  const openSample = async (sampleId = 'apartment') => {
    setBusy(true);
    try {
      const id = await createDemoProject(sampleId);
      navigate(`/p/${id}`);
    } catch (e) {
      toast.error('Could not create the sample', e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const onImport = async (file: File) => {
    setBusy(true);
    try {
      const { project, warnings } = await importNeestFile(file);
      await saveProject(project);
      await refresh();
      toast.success('Project imported', warnings.length ? warnings.join(' ') : `“${project.name}” is ready to open.`);
    } catch (e) {
      const msg = e instanceof ProjectImportError ? e.message + (e.details ? ` (${e.details.join('; ')})` : '') : 'The file could not be imported.';
      toast.error('Import failed', msg);
    } finally {
      setBusy(false);
    }
  };

  const onExport = async (p: ProjectSummary) => {
    const res = await loadProject(p.id);
    if (!res) return;
    downloadBlob(await exportNeest(res.project), exportFilename(res.project.name, 'project', 'neest'));
  };

  const onDelete = async (p: ProjectSummary) => {
    const ok = await confirmAction({
      title: `Delete “${p.name}”?`,
      message: repo.entries.some((e) => e.id === p.id)
        ? `This removes the project from this browser. Its copy in ${workspaceFolder()}/ is kept (remove it there from the card menu, or with git).`
        : 'This permanently removes the project from this browser. Export it first if you want a backup.',
      confirmLabel: 'Delete project',
      danger: true,
    });
    if (!ok) return;
    await deleteProject(p.id);
    await refresh();
    toast.info('Project deleted');
  };

  const onRemoveFromRepo = async (id: string, name: string) => {
    const ok = await confirmAction({
      title: `Remove “${name}” from the repo folder?`,
      message: `Deletes its file from ${workspaceFolder()}/ (teammates will no longer receive it after they pull). The copy in this browser is kept.`,
      confirmLabel: 'Remove file',
      danger: true,
    });
    if (!ok) return;
    await removeFromWorkspace(id);
    await refresh();
  };

  const onDuplicate = async (p: ProjectSummary) => {
    await duplicateProject(p.id);
    await refresh();
    toast.success('Project duplicated');
  };

  const menuFor = (p: ProjectSummary, x: number, y: number) =>
    openContextMenu(x, y, [
      { label: 'Open', run: () => navigate(`/p/${p.id}`) },
      { label: 'Rename…', run: () => setRenaming(p) },
      { label: 'Duplicate', run: () => void onDuplicate(p) },
      { label: 'Export .neest file', run: () => void onExport(p) },
      { label: 'Open guest view', run: () => navigate(`/guest/${p.id}`) },
      ...(repo.entries.some((e) => e.id === p.id)
        ? [{ label: `Remove from ${workspaceFolder()}/ folder…`, run: () => void onRemoveFromRepo(p.id, p.name) }]
        : []),
      { separator: true, label: '' },
      { label: 'Delete…', danger: true, run: () => void onDelete(p) },
    ]);

  const empty = projects !== null && projects.length === 0;

  return (
    <div className="launcher">
      <header className="launcher-top">
        <div className="brand">
          <Logo size={30} />
          <div>
            <h1>Neest</h1>
            <span className="brand-sub">Apartment planner</span>
          </div>
        </div>
        <div className="launcher-actions">
          <Button variant="ghost" onClick={() => fileRef.current?.click()} disabled={busy}>
            <Upload size={15} /> Import
          </Button>
          {repo.available && (
            <div className="repo-toggle" title={`Mirror projects into ${workspaceFolder()}/ in the repository so teammates can open them after git pull`}>
              <FolderGit2 size={15} aria-hidden />
              <Toggle label="Sync to repo" checked={repoSync} onChange={(v) => usePrefsStore.getState().setRepoSync(v)} />
            </div>
          )}
          <ThemeSwitch />
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".neest,.json,application/zip,application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void onImport(f);
          }}
        />
      </header>

      <main className="launcher-main">
        {empty && (
          <section className="welcome" aria-labelledby="welcome-title">
            <div className="welcome-text">
              <h2 id="welcome-title">Plan your apartment, precisely.</h2>
              <p>
                Draw walls and rooms in a measured 2D plan, add doors, windows and furniture, then walk through it in 3D. Everything
                stays on this device.
              </p>
              <ol className="welcome-steps">
                <li>
                  <strong>Draw</strong> walls or drag out rooms — areas update live.
                </li>
                <li>
                  <strong>Furnish</strong> from the library and apply finishes.
                </li>
                <li>
                  <strong>Review</strong> in 3D, render views and export drawings.
                </li>
              </ol>
              <div className="welcome-cta">
                <Button variant="primary" onClick={() => void openSample('apartment')} disabled={busy} data-testid="open-sample">
                  <Sparkles size={15} /> Open the sample apartment
                </Button>
                <Button onClick={() => void openSample('studio')} disabled={busy} data-testid="open-sample-studio">
                  <Sparkles size={15} /> Studio room 9 × 4.5 m
                </Button>
                <Button onClick={() => setShowNew(true)} data-testid="new-project-empty">
                  <Plus size={15} /> Start blank
                </Button>
              </div>
            </div>
          </section>
        )}

        <section aria-labelledby="projects-title">
          <div className="section-title-row">
            <h2 id="projects-title">Your projects</h2>
            {!empty && (
              <Button
                variant="subtle"
                size="sm"
                disabled={busy}
                data-testid="samples-menu"
                onClick={(e) => {
                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  openContextMenu(
                    r.left,
                    r.bottom + 4,
                    SAMPLES.map((sm) => ({ label: `${sm.name} — ${sm.description}`, run: () => void openSample(sm.id) })),
                  );
                }}
              >
                <Sparkles size={14} /> Open a sample
              </Button>
            )}
          </div>
          {error && <div className="launcher-error" role="alert">{error}</div>}
          <div className="project-grid">
            <button type="button" className="project-card new" onClick={() => setShowNew(true)} data-testid="new-project">
              <span className="new-icon">
                <Plus size={22} />
              </span>
              <span className="new-label">New apartment</span>
              <span className="new-sub">Set units and wall defaults</span>
            </button>
            {projects === null && <div className="project-card skeleton" aria-hidden />}
            {projects?.map((p) => (
              <article
                key={p.id}
                className="project-card"
                onContextMenu={(e) => {
                  e.preventDefault();
                  menuFor(p, e.clientX, e.clientY);
                }}
              >
                <button type="button" className="card-open" onClick={() => navigate(`/p/${p.id}`)} aria-label={`Open ${p.name}`} data-testid="project-card">
                  <ProjectThumb
                    stored={p.thumbnail}
                    source={thumbSource(p, repo.entries.find((e) => e.id === p.id))}
                    empty={
                      <div className="thumb-empty">
                        <FolderOpen size={22} />
                        <span>Empty plan</span>
                      </div>
                    }
                  />
                  <div className="card-meta">
                    <h3 title={p.name}>{p.name}</h3>
                    <p className="num">
                      {p.roomCount} room{p.roomCount === 1 ? '' : 's'} · {formatArea(p.area, 'm2', 1)} · {p.objectCount} items
                    </p>
                    {(() => {
                      const r = repo.entries.find((e) => e.id === p.id);
                      if (!r) return null;
                      const newer = r.updatedAt > p.updatedAt + 1;
                      return (
                        <p className={`repo-badge${newer ? ' newer' : ''}`} title={r.file}>
                          <FolderGit2 size={11} aria-hidden /> {newer ? 'Newer version in repo — opens that one' : 'In repo folder'}
                        </p>
                      );
                    })()}
                    <p className="card-time">
                      <HardDrive size={11} aria-hidden /> Saved locally · {relativeTime(p.updatedAt)}
                    </p>
                  </div>
                </button>
                <div className="card-tools">
                  <IconButton label="Rename" onClick={() => setRenaming(p)} tooltipSide="top">
                    <Pencil size={14} />
                  </IconButton>
                  <IconButton label="Duplicate" onClick={() => void onDuplicate(p)} tooltipSide="top">
                    <Copy size={14} />
                  </IconButton>
                  <IconButton label="Export .neest" onClick={() => void onExport(p)} tooltipSide="top">
                    <Download size={14} />
                  </IconButton>
                  <IconButton label="Delete" onClick={() => void onDelete(p)} tooltipSide="top" className="danger-hover">
                    <Trash2 size={14} />
                  </IconButton>
                  <IconButton
                    label="More actions"
                    tooltipSide="top"
                    onClick={(e) => {
                      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      menuFor(p, r.left, r.bottom + 4);
                    }}
                  >
                    <MoreHorizontal size={14} />
                  </IconButton>
                </div>
              </article>
            ))}
          </div>
        </section>
        {repo.available && repo.entries.some((e) => !projects?.some((p) => p.id === e.id)) && (
          <section aria-labelledby="repo-title">
            <div className="section-title-row">
              <h2 id="repo-title">
                From the repo folder <span className="field-hint">({workspaceFolder()}/ — not opened in this browser yet)</span>
              </h2>
            </div>
            <div className="project-grid">
              {repo.entries
                .filter((e) => !projects?.some((p) => p.id === e.id))
                .map((e) => (
                  <article key={e.id} className="project-card repo-only">
                    <button type="button" className="card-open" onClick={() => navigate(`/p/${e.id}`)} aria-label={`Open ${e.name} from the repo folder`} data-testid="repo-card">
                      <ProjectThumb
                        stored={null}
                        source={{ key: `repo:${e.id}:${e.updatedAt}`, load: () => loadFromWorkspace(e.id) }}
                        empty={
                          <div className="thumb-empty">
                            <FolderGit2 size={22} />
                            <span>{e.file}</span>
                          </div>
                        }
                      />
                      <div className="card-meta">
                        <h3 title={e.name}>{e.name}</h3>
                        <p className="card-time">
                          <FolderGit2 size={11} aria-hidden /> In repo · updated {relativeTime(e.updatedAt)}
                        </p>
                      </div>
                    </button>
                    <div className="card-tools">
                      <IconButton label="Remove from repo folder" onClick={() => void onRemoveFromRepo(e.id, e.name)} tooltipSide="top" className="danger-hover">
                        <Trash2 size={14} />
                      </IconButton>
                    </div>
                  </article>
                ))}
            </div>
          </section>
        )}
        <footer className="launcher-foot">
          Projects are stored in this browser (IndexedDB) and work offline.{' '}
          {repo.available
            ? `When running from the dev server they are also mirrored to the repository ${workspaceFolder()}/ folder, so teammates get them with git pull.`
            : ''}{' '}
          Export <code>.neest</code> files to back up or move them between devices. Neest drawings are planning drawings, not certified construction documents.
        </footer>
      </main>

      {showNew && <NewProjectDialog onClose={() => setShowNew(false)} />}
      {renaming && (
        <RenameDialog
          name={renaming.name}
          onClose={() => setRenaming(null)}
          onSave={async (name) => {
            await renameProject(renaming.id, name);
            setRenaming(null);
            await refresh();
          }}
        />
      )}
    </div>
  );
}

function NewProjectDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('My apartment');
  const [units, setUnits] = useState<LengthUnit>('m');
  const [height, setHeight] = useState('2.7');
  const [interior, setInterior] = useState('0.12');
  const [exterior, setExterior] = useState('0.3');
  const [error, setError] = useState<string | null>(null);
  const create = async () => {
    const h = parseLength(height, 'm');
    const ti = parseLength(interior, 'm');
    const te = parseLength(exterior, 'm');
    if (!name.trim()) return setError('Give the project a name.');
    if (h == null || h < 1.8 || h > 6) return setError('Wall height must be between 1.8 m and 6 m.');
    if (ti == null || ti < 0.03 || ti > 0.6) return setError('Interior wall thickness must be between 3 cm and 60 cm.');
    if (te == null || te < 0.05 || te > 1) return setError('Exterior wall thickness must be between 5 cm and 1 m.');
    const id = await createProject({ name: name.trim(), units, wallHeight: h, interiorThickness: ti, exteriorThickness: te });
    navigate(`/p/${id}`);
  };
  return (
    <Dialog
      title="New apartment"
      onClose={onClose}
      testId="new-project-dialog"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => void create()} data-testid="create-project">
            Create project
          </Button>
        </>
      }
    >
      <form
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <Field label="Project name">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} data-autofocus data-testid="project-name" maxLength={120} />
        </Field>
        <Select
          label="Display units"
          value={units}
          onChange={setUnits}
          options={[
            { value: 'm', label: 'Metres (m)' },
            { value: 'cm', label: 'Centimetres (cm)' },
            { value: 'mm', label: 'Millimetres (mm)' },
            { value: 'ft', label: 'Feet & inches' },
            { value: 'in', label: 'Inches' },
          ]}
        />
        <div className="form-row-3">
          <Field label="Wall height" hint="e.g. 2.7 or 270cm">
            <input className="input num" value={height} onChange={(e) => setHeight(e.target.value)} />
          </Field>
          <Field label="Interior walls">
            <input className="input num" value={interior} onChange={(e) => setInterior(e.target.value)} />
          </Field>
          <Field label="Exterior walls">
            <input className="input num" value={exterior} onChange={(e) => setExterior(e.target.value)} />
          </Field>
        </div>
        <p className="field-hint">Lengths here accept metres or explicit units (e.g. 9ft, 12cm). You can change everything later in project settings.</p>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}

export function RenameDialog({ name, onClose, onSave }: { name: string; onClose: () => void; onSave: (name: string) => void }) {
  const [value, setValue] = useState(name);
  const ok = value.trim().length > 0;
  return (
    <Dialog
      title="Rename project"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!ok} onClick={() => ok && onSave(value.trim())}>
            Rename
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (ok) onSave(value.trim());
        }}
      >
        <Field label="Name">
          <input className="input" value={value} onChange={(e) => setValue(e.target.value)} data-autofocus maxLength={120} />
        </Field>
      </form>
    </Dialog>
  );
}

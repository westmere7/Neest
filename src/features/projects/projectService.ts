import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { create } from 'zustand';
import type { Project } from '@/domain/model/schema';
import { createEmptyProject, type NewProjectOptions } from '@/domain/model/defaults';
import { newId } from '@/domain/model/ids';
import { derivePlan } from '@/domain/geometry/derive';
import { migrateProject } from '@/storage/migrations';
import { blobRepository, projectRepository } from '@/storage/indexeddb/db';
import { useProjectStore } from '@/state/projectStore';
import { PlanDrawing } from '@/features/plan-2d/PlanDrawing';
import { printPalette } from '@/features/plan-2d/palette';
import { SAMPLES } from './demoProject';
import { loadFromWorkspace, pullWorkspaceAssets, saveToWorkspace, workspaceAvailable } from '@/storage/workspace';
import { usePrefsStore } from '@/state/uiStores';

// ───────────── Save status ─────────────

export type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export type RepoState = 'off' | 'pending' | 'synced' | 'error';

interface SaveStatus {
  state: SaveState;
  lastSavedAt: number | null;
  error: string | null;
  /** Mirror state of the repository projects/ folder (dev server only). */
  repo: RepoState;
}

export const useSaveStore = create<SaveStatus>(() => ({ state: 'idle', lastSavedAt: null, error: null, repo: 'off' }));

/** Mirrors a project into the repo folder when available and enabled. */
export async function mirrorToRepo(project: Project): Promise<void> {
  if (!usePrefsStore.getState().repoSync || !(await workspaceAvailable())) {
    useSaveStore.setState({ repo: 'off' });
    return;
  }
  useSaveStore.setState({ repo: 'pending' });
  try {
    await saveToWorkspace(project);
    useSaveStore.setState({ repo: 'synced' });
  } catch {
    useSaveStore.setState({ repo: 'error' });
  }
}

// ───────────── Thumbnails & stats ─────────────

/** Small presentation-style SVG of the plan, stored with the project metadata. */
export function renderThumbnail(project: Project): string | null {
  const derived = derivePlan(project);
  const b = derived.bounds;
  if (!b) return null;
  const pad = Math.max(b.maxX - b.minX, b.maxY - b.minY) * 0.08 + 0.2;
  const w = b.maxX - b.minX + pad * 2;
  const h = b.maxY - b.minY + pad * 2;
  const px = Math.max(w, h) / 240;
  try {
    const inner = renderToStaticMarkup(
      createElement(PlanDrawing, {
        project,
        derived,
        opts: {
          mode: 'presentation',
          palette: printPalette('presentation'),
          px,
          unit: project.settings.units,
          precision: project.settings.precision,
          areaUnit: project.settings.areaUnit,
          showRoomLabels: false,
          showAreas: false,
          dims: { overall: false, walls: false, rooms: false },
          showFurniture: true,
          showConstruction: true,
          showAnnotations: false,
          showCallouts: false,
          textures: false,
          shadows: false,
          halo: false,
          idPrefix: 'thumb',
        },
      }),
    );
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.minX - pad} ${b.minY - pad} ${w} ${h}">${inner}</svg>`;
  } catch {
    return null;
  }
}

export function projectStats(project: Project) {
  const derived = derivePlan(project);
  return {
    roomCount: derived.faces.length,
    objectCount: Object.keys(project.objects).length,
    area: derived.faces.reduce((s, f) => s + f.area, 0),
  };
}

// ───────────── Lifecycle ─────────────

export async function saveProject(project: Project, withThumbnail = true, mirror = true): Promise<void> {
  await projectRepository.save(project, {
    ...projectStats(project),
    ...(withThumbnail ? { thumbnail: renderThumbnail(project) } : {}),
  });
  if (mirror) void mirrorToRepo(project);
}

export async function createProject(opts: NewProjectOptions = {}): Promise<string> {
  const p = createEmptyProject(opts);
  await saveProject(p);
  return p.id;
}

export async function createDemoProject(sampleId = 'apartment'): Promise<string> {
  const sample = SAMPLES.find((x) => x.id === sampleId) ?? SAMPLES[0];
  const p = sample.build();
  await saveProject(p);
  return p.id;
}

export interface LoadResult {
  project: Project;
  warnings: string[];
}

export interface LoadResultWithSource extends LoadResult {
  /** 'repo' when the repository folder had a newer copy (it is imported into browser storage). */
  source: 'local' | 'repo';
  /** True when this browser had no copy before (first open of a teammate's project). */
  firstOpen?: boolean;
}

/**
 * Loads a project, preferring the repository folder's copy when it is newer
 * than the browser's (e.g. a teammate's change pulled with git).
 */
export async function loadProject(id: string): Promise<LoadResultWithSource | null> {
  const raw = await projectRepository.loadRaw(id);
  const local = raw ? migrateProject(raw) : null;
  let repo: LoadResult | null = null;
  try {
    const repoRaw = await loadFromWorkspace(id);
    repo = repoRaw ? migrateProject(repoRaw) : null;
  } catch {
    repo = null; // an invalid repo file never blocks the local copy
  }
  if (repo && (!local || repo.project.updatedAt > local.project.updatedAt + 1)) {
    const missing = await pullWorkspaceAssets(repo.project);
    await saveProject(repo.project, true, false);
    return {
      ...repo,
      warnings: [...repo.warnings, ...missing.map((m) => `Model "${m}" is missing from the repo folder.`)],
      source: 'repo',
      firstOpen: !local,
    };
  }
  return local ? { ...local, source: 'local' } : null;
}

export async function duplicateProject(id: string): Promise<string | null> {
  const res = await loadProject(id);
  if (!res) return null;
  const now = Date.now();
  const copy: Project = { ...structuredClone(res.project), id: newId('prj'), name: `${res.project.name} copy`, createdAt: now, updatedAt: now };
  await saveProject(copy);
  return copy.id;
}

export async function deleteProject(id: string): Promise<void> {
  await projectRepository.delete(id);
  try {
    await blobRepository.collectGarbage(await projectRepository.referencedBlobIds());
  } catch {
    /* garbage collection is best-effort */
  }
}

export async function renameProject(id: string, name: string): Promise<void> {
  await projectRepository.rename(id, name);
}

// ───────────── Autosave ─────────────

const AUTOSAVE_DELAY = 700;
let timer: ReturnType<typeof setTimeout> | null = null;
let thumbTimer: ReturnType<typeof setTimeout> | null = null;
let inflight: Promise<void> | null = null;
let queued = false;

async function flush(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  const { project, tx } = useProjectStore.getState();
  if (!project || tx) return;
  if (inflight) {
    queued = true;
    return inflight;
  }
  useSaveStore.setState({ state: 'saving' });
  inflight = projectRepository
    .save(project, projectStats(project))
    .then(() => {
      useSaveStore.setState({ state: 'saved', lastSavedAt: Date.now(), error: null });
      void mirrorToRepo(project);
    })
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      useSaveStore.setState({ state: 'error', error: msg.includes('Quota') ? 'Browser storage is full.' : msg });
    })
    .finally(() => {
      inflight = null;
      if (queued) {
        queued = false;
        void flush();
      }
    });
  // Thumbnails are cheap but not free: refresh them lazily.
  if (thumbTimer) clearTimeout(thumbTimer);
  thumbTimer = setTimeout(() => {
    const p = useProjectStore.getState().project;
    if (p) projectRepository.save(p, { thumbnail: renderThumbnail(p) }).catch(() => undefined);
  }, 4000);
  return inflight;
}

/**
 * Starts debounced autosave for the open project. Saves only after committed
 * edits (never on raw pointer moves, which are transient previews), and
 * flushes when the tab is hidden or closed. Returns a stop function.
 */
export function startAutosave(): () => void {
  useSaveStore.setState({ state: 'saved', lastSavedAt: Date.now(), error: null });
  const opened = useProjectStore.getState().project;
  if (opened) void mirrorToRepo(opened);
  let lastRevision = useProjectStore.getState().revision;
  const unsub = useProjectStore.subscribe((s) => {
    if (s.revision === lastRevision) return;
    lastRevision = s.revision;
    useSaveStore.setState({ state: 'pending' });
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void flush(), AUTOSAVE_DELAY);
  });
  const onHide = () => {
    if (document.visibilityState === 'hidden') void flush();
  };
  const onPageHide = () => void flush();
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', onPageHide);
  return () => {
    unsub();
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('pagehide', onPageHide);
    void flush();
  };
}

export const flushSave = flush;

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyProject } from '@/domain/model/defaults';
import type { Project } from '@/domain/model/schema';
import { useProjectStore } from '@/state/projectStore';

// The repo folder and browser storage are stand-ins: record what is written where.
const files = new Map<string, Project>();
const browser = new Map<string, Project>();
vi.mock('@/storage/workspace', () => ({
  workspaceAvailable: vi.fn(async () => true),
  listWorkspace: vi.fn(async () => [...files.values()].map((p) => ({ id: p.id, name: p.name, updatedAt: p.updatedAt, file: `${p.id}.json`, size: 1 }))),
  loadFromWorkspace: vi.fn(async (id: string) => files.get(id) ?? null),
  saveToWorkspace: vi.fn(async (p: Project) => void files.set(p.id, structuredClone(p))),
  pullWorkspaceAssets: vi.fn(async () => []),
}));
vi.mock('@/storage/indexeddb/db', () => ({
  projectRepository: {
    save: vi.fn(async (p: Project) => void browser.set(p.id, structuredClone(p))),
    loadRaw: vi.fn(async (id: string) => browser.get(id) ?? null),
  },
  blobRepository: { get: vi.fn(async () => null) },
}));

const { saveNow, saveProject, startAutosave, useSaveStore } = await import('./projectService');
const store = () => useProjectStore.getState();
const settle = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

describe('saving: browser as you go, project file only on Save', () => {
  let stop: () => void;
  beforeEach(async () => {
    files.clear();
    browser.clear();
    vi.useFakeTimers();
    store().load(createEmptyProject({ name: 'Save test' }));
    stop = startAutosave();
    await vi.runAllTimersAsync();
  });
  afterEach(() => {
    stop();
    vi.useRealTimers();
  });

  it('autosave keeps edits in the browser and never writes the repo folder', async () => {
    store().execute('Rename', (d) => void (d.name = 'Edited'));
    await vi.advanceTimersByTimeAsync(1000);
    expect(browser.get(store().project!.id)?.name).toBe('Edited');
    expect(files.size).toBe(0);
    expect(useSaveStore.getState().repo).toBe('unsaved');
  });

  it('new projects are stored in the browser only', async () => {
    const p = createEmptyProject({ name: 'Fresh' });
    await saveProject(p);
    expect(browser.has(p.id)).toBe(true);
    expect(files.has(p.id)).toBe(false);
  });

  it('Save writes the file; an edit makes it unsaved again; undo back to the saved version counts as saved', async () => {
    vi.setSystemTime(new Date('2026-11-07T10:00:00Z'));
    store().execute('Rename', (d) => void (d.name = 'First'));
    expect(await saveNow()).toBe('file');
    expect(files.get(store().project!.id)?.name).toBe('First');
    expect(useSaveStore.getState().repo).toBe('saved');

    vi.setSystemTime(new Date('2026-11-07T10:00:05Z'));
    store().execute('Rename', (d) => void (d.name = 'Second'));
    await settle();
    expect(useSaveStore.getState().repo).toBe('unsaved');
    expect(files.get(store().project!.id)?.name).toBe('First');

    store().undo();
    await settle();
    expect(useSaveStore.getState().repo).toBe('saved');
  });

  it('opening a project whose file holds the same version shows it as saved', async () => {
    stop();
    const p = store().project!;
    files.set(p.id, structuredClone(p));
    stop = startAutosave();
    await vi.runAllTimersAsync();
    expect(useSaveStore.getState().repo).toBe('saved');
  });
});

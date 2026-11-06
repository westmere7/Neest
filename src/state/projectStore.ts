import { create } from 'zustand';
import { produce, setAutoFreeze, type Draft } from 'immer';
import type { Project } from '@/domain/model/schema';
import { reconcileRooms } from '@/domain/commands/entities';

// Projects are treated as immutable snapshots; freezing them costs time on
// every edit without adding safety beyond what the command layer provides.
setAutoFreeze(false);

/** Maximum number of undo steps retained (snapshots share structure, so this stays small in memory). */
export const HISTORY_LIMIT = 200;

export interface HistoryEntry {
  project: Project;
  label: string;
  /** Coalescing key of the step (see `ExecuteOptions.coalesce`) and when it was last extended. */
  key?: string;
  at?: number;
}

/** Repeats of one change (same `coalesce` key) closer together than this merge into one undo step. */
export const COALESCE_MS = 1000;

export interface ExecuteOptions {
  /**
   * Merges this edit into the previous undo step when that step has the same key and was made less
   * than `COALESCE_MS` ago (a held arrow key nudging items, stepper clicks): one undo restores the
   * state from before the run.
   */
  coalesce?: string;
}

interface Transaction {
  base: Project;
  label: string;
}

export interface ProjectState {
  project: Project | null;
  past: HistoryEntry[];
  future: HistoryEntry[];
  tx: Transaction | null;
  /** Increments on every committed change (execute/commit/undo/redo); drives autosave. */
  revision: number;
  load(project: Project): void;
  close(): void;
  /** Applies a model edit as one undoable step. Returns the recipe's result. */
  execute<T>(label: string, recipe: (d: Draft<Project>) => T, opts?: ExecuteOptions): T | undefined;
  /** Starts a gesture (e.g. a drag) whose transient updates collapse into one undo step. */
  begin(label: string): void;
  /** Applies a transient update during a gesture (not recorded, not autosaved). */
  preview(recipe: (d: Draft<Project>) => void): void;
  /**
   * A live edit (a colour picker or slider being dragged): starts the gesture `label` unless it is
   * already the open one, then previews. `commit()` records it as one step; anything else that
   * changes the project (or undo) ends it first.
   */
  livePreview(label: string, recipe: (d: Draft<Project>) => void): void;
  /** Ends the gesture, optionally applying a final recipe, and records one undo step. */
  commit<T>(recipe?: (d: Draft<Project>) => T, label?: string): T | undefined;
  /** Cancels the gesture and restores the state from before it started. */
  cancel(): void;
  undo(): void;
  redo(): void;
  /** Replaces the project with a version changed outside the editor (repo folder). Undo restores the previous state. */
  applyExternal(project: Project, label: string): void;
}

const structuralChange = (a: Project, b: Project) => a.walls !== b.walls || a.nodes !== b.nodes;

function finalize(prev: Project, next: Project): Project {
  let out = next;
  if (structuralChange(prev, next)) out = produce(out, (d) => reconcileRooms(d));
  return produce(out, (d) => {
    d.updatedAt = Date.now();
  });
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: null,
  past: [],
  future: [],
  tx: null,
  revision: 0,

  load(project) {
    set({ project, past: [], future: [], tx: null, revision: 0 });
  },

  close() {
    set({ project: null, past: [], future: [], tx: null, revision: 0 });
  },

  execute(label, recipe, opts) {
    const { project, tx } = get();
    if (!project) return undefined;
    if (tx) get().commit();
    const base = get().project!;
    let result: ReturnType<typeof recipe> | undefined;
    const next = produce(base, (d) => {
      result = recipe(d);
    });
    if (next === base) return result;
    const final = finalize(base, next);
    const now = Date.now();
    const key = opts?.coalesce;
    set((s) => {
      const last = s.past[s.past.length - 1];
      // A repeat of the same change: keep the step's original "before" state, just refresh its time.
      if (key && last && last.key === key && s.future.length === 0 && now - (last.at ?? 0) < COALESCE_MS)
        return {
          project: final,
          past: [...s.past.slice(0, -1), { ...last, at: now }],
          revision: s.revision + 1,
        };
      return {
        project: final,
        past: [...s.past, { project: base, label, ...(key ? { key, at: now } : {}) }].slice(-HISTORY_LIMIT),
        future: [],
        revision: s.revision + 1,
      };
    });
    return result;
  },

  begin(label) {
    const { project, tx } = get();
    if (!project) return;
    if (tx) get().commit();
    set({ tx: { base: get().project!, label } });
  },

  preview(recipe) {
    const { project, tx } = get();
    if (!project || !tx) return;
    const next = produce(project, (d) => {
      recipe(d);
    });
    if (next !== project) set({ project: next });
  },

  livePreview(label, recipe) {
    const { project, tx } = get();
    if (!project) return;
    if (!tx || tx.label !== label) get().begin(label);
    get().preview(recipe);
  },

  commit(recipe, label) {
    const { project, tx } = get();
    if (!project || !tx) return undefined;
    let result: unknown;
    let next = project;
    if (recipe) {
      next = produce(project, (d) => {
        result = recipe(d);
      });
    }
    if (next === tx.base) {
      set({ tx: null, project: tx.base });
      return result as ReturnType<NonNullable<typeof recipe>>;
    }
    const final = finalize(tx.base, next);
    set((s) => ({
      project: final,
      tx: null,
      past: [...s.past, { project: tx.base, label: label ?? tx.label }].slice(-HISTORY_LIMIT),
      future: [],
      revision: s.revision + 1,
    }));
    return result as ReturnType<NonNullable<typeof recipe>>;
  },

  cancel() {
    const { tx } = get();
    if (!tx) return;
    set({ project: tx.base, tx: null });
  },

  undo() {
    const { past, project, tx } = get();
    // Undo during a drag or live edit only cancels it (the step before stays).
    if (tx) return get().cancel();
    if (!project || past.length === 0) return;
    const entry = past[past.length - 1];
    set((s) => ({
      project: entry.project,
      past: s.past.slice(0, -1),
      future: [{ project: s.project!, label: entry.label }, ...s.future],
      revision: s.revision + 1,
    }));
  },

  applyExternal(project, label) {
    const { project: cur, tx } = get();
    if (tx) get().cancel();
    if (!cur) return;
    // Revision is not bumped: the change came from storage, so autosave must not echo it back.
    set((s) => ({ project, past: [...s.past, { project: cur, label }].slice(-HISTORY_LIMIT), future: [] }));
  },

  redo() {
    const { future, project, tx } = get();
    // Redo during a drag or live edit only cancels it.
    if (tx) return get().cancel();
    if (!project || future.length === 0) return;
    const entry = future[0];
    set((s) => ({
      project: entry.project,
      future: s.future.slice(1),
      past: [...s.past, { project: s.project!, label: entry.label }].slice(-HISTORY_LIMIT),
      revision: s.revision + 1,
    }));
  },
}));

/** Non-reactive accessor for command handlers. */
export const getProject = () => useProjectStore.getState().project;

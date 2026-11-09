import { create } from 'zustand';
import { produce, setAutoFreeze, type Draft } from 'immer';
import type { Project } from '@/domain/model/schema';
import { reconcileRooms } from '@/domain/commands/entities';
import { applyOps, invert, type Op } from '@/domain/sync/ops';
import { diffProjects, fromDoc, toDoc, touchesPlans, viewedOption } from '@/domain/sync/doc';

// Projects are treated as immutable snapshots; freezing them costs time on
// every edit without adding safety beyond what the command layer provides.
setAutoFreeze(false);

/** Maximum number of undo steps retained (each keeps only the property changes it made). */
export const HISTORY_LIMIT = 200;

/**
 * One undo step: the document changes it made (see domain/sync), not a snapshot. Undo reverses them on the
 * current project, so changes made since by someone else (a teammate, a reloaded file) stay, and a property
 * someone else has changed since keeps their value.
 */
export interface HistoryEntry {
  ops: Op[];
  /** Option shown before / after the step (undo and redo go back to where a plan change was made). */
  viewBefore: string;
  viewAfter: string;
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
  /**
   * Applies document changes made by someone else (multi-user sync). Not an undo step; the server's order
   * wins, and this person's own undo then skips whatever these changed.
   */
  applyRemote(ops: Op[]): void;
  /** Listens to the document changes this person makes (edits, undo, redo, reloaded files): the sync outbox. */
  onLocalOps(listener: (ops: Op[], label: string) => void): () => void;
}

const structuralChange = (a: Project, b: Project) => a.walls !== b.walls || a.nodes !== b.nodes;

function finalize(prev: Project, next: Project): Project {
  let out = next;
  if (structuralChange(prev, next)) out = produce(out, (d) => reconcileRooms(d));
  return produce(out, (d) => {
    d.updatedAt = Date.now();
  });
}

/** Applies ops to a view's document and shows option `show` (structure shared with `prev`). */
function applyToView(prev: Project, ops: Op[], mode: 'force' | 'checked', show = viewedOption(prev)) {
  const { doc, applied } = applyOps(toDoc(prev), ops, mode);
  return { project: applied.length || show !== viewedOption(prev) ? fromDoc(doc, show, prev) : prev, applied };
}

/** A project store. The app uses one (`useProjectStore`); tests make several to play several people. */
export function createProjectStore() {
  const listeners = new Set<(ops: Op[], label: string) => void>();
  const emit = (ops: Op[], label: string) => {
    if (ops.length) for (const l of listeners) l(ops, label);
  };

  return create<ProjectState>((set, get) => {
    /**
     * Records the change from `base` to `next` as one undo step. When only the shown option changed, it just
     * shows it: switching options is per person, not an edit.
     */
    const record = (base: Project, next: Project, label: string, key?: string): void => {
      if (!diffProjects(base, next).length) {
        // Only the view changed: remembered in this browser (autosave), not an undo step or an edit.
        set((s) => ({ project: next, tx: null, revision: s.revision + 1 }));
        return;
      }
      const final = finalize(base, next);
      const ops = diffProjects(base, final);
      const now = Date.now();
      set((s) => {
        const last = s.past[s.past.length - 1];
        // A repeat of the same change: extend the step (undo reverses the whole run).
        if (key && last && last.key === key && s.future.length === 0 && now - (last.at ?? 0) < COALESCE_MS)
          return {
            project: final,
            tx: null,
            past: [...s.past.slice(0, -1), { ...last, ops: [...last.ops, ...ops], viewAfter: viewedOption(final), at: now }],
            revision: s.revision + 1,
          };
        return {
          project: final,
          tx: null,
          past: [
            ...s.past,
            { ops, label, viewBefore: viewedOption(base), viewAfter: viewedOption(final), ...(key ? { key, at: now } : {}) },
          ].slice(-HISTORY_LIMIT),
          future: [],
          revision: s.revision + 1,
        };
      });
      emit(ops, label);
    };

    return {
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
        record(base, next, label, opts?.coalesce);
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
        record(tx.base, next, label ?? tx.label);
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
        // Back to the option where the change was made, when it changed a plan.
        const show = touchesPlans(entry.ops) ? entry.viewBefore : viewedOption(project);
        const { project: next, applied } = applyToView(project, invert(entry.ops), 'checked', show);
        set((s) => ({
          project: next,
          past: s.past.slice(0, -1),
          future: [entry, ...s.future],
          revision: s.revision + 1,
        }));
        emit(applied, `Undo ${entry.label}`);
      },

      redo() {
        const { future, project, tx } = get();
        // Redo during a drag or live edit only cancels it.
        if (tx) return get().cancel();
        if (!project || future.length === 0) return;
        const entry = future[0];
        const show = touchesPlans(entry.ops) ? entry.viewAfter : viewedOption(project);
        const { project: next, applied } = applyToView(project, entry.ops, 'checked', show);
        set((s) => ({
          project: next,
          future: s.future.slice(1),
          past: [...s.past, entry].slice(-HISTORY_LIMIT),
          revision: s.revision + 1,
        }));
        emit(applied, `Redo ${entry.label}`);
      },

      applyExternal(project, label) {
        const { project: cur, tx } = get();
        if (tx) get().cancel();
        if (!cur) return;
        const before = get().project!;
        const ops = diffProjects(before, project);
        // Revision is not bumped: the change came from storage, so autosave must not echo it back.
        set((s) => ({
          project,
          past: ops.length
            ? [...s.past, { ops, label, viewBefore: viewedOption(before), viewAfter: viewedOption(project) }].slice(-HISTORY_LIMIT)
            : s.past,
          future: ops.length ? [] : s.future,
        }));
        emit(ops, label);
      },

      applyRemote(ops) {
        const { project, tx } = get();
        if (!project || !ops.length) return;
        const { project: next } = applyToView(project, ops, 'force');
        // A drag in progress keeps going on top; cancelling it returns to the base with these changes in.
        const base = tx ? applyToView(tx.base, ops, 'force').project : null;
        set((s) => ({ project: next, tx: tx && base ? { ...tx, base } : tx, revision: s.revision + 1 }));
      },

      onLocalOps(listener) {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    };
  });
}

export const useProjectStore = createProjectStore();

/** Non-reactive accessor for command handlers. */
export const getProject = () => useProjectStore.getState().project;

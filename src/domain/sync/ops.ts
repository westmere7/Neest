import { produce, type Draft } from 'immer';

/**
 * Property-level changes ("ops") between two versions of a document: the unit of undo history now and of
 * multi-user sync later. A document is a tree of plain objects (records keyed by id); arrays and other values
 * are leaves, replaced whole. Each op sets one path to `value`, or deletes it when `value` is undefined;
 * `old` is what was there before (undefined = absent), so every op can be reversed.
 */
export interface Op {
  path: string[];
  value?: unknown;
  old?: unknown;
}

export const isPlainObject = (v: unknown): v is Record<string, unknown> => {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
};

/** Structural equality for plain data (objects, arrays, primitives); identical references short-circuit. */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return Number.isNaN(a) && Number.isNaN(b);
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const bb = b as unknown[];
    return a.length === bb.length && a.every((v, i) => deepEqual(v, bb[i]));
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const ak = Object.keys(ao).filter((k) => ao[k] !== undefined);
  const bk = Object.keys(bo).filter((k) => bo[k] !== undefined);
  return ak.length === bk.length && ak.every((k) => deepEqual(ao[k], bo[k]));
}

/**
 * The ops that turn `a` into `b`. Unchanged subtrees are skipped by reference (immer keeps them shared), so
 * this costs only as much as what changed. Plain objects are compared key by key; everything else is a leaf.
 */
export function diff(a: unknown, b: unknown, path: string[] = [], out: Op[] = []): Op[] {
  if (a === b) return out;
  if (isPlainObject(a) && isPlainObject(b)) {
    for (const k of Object.keys(a)) {
      const av = a[k];
      const bv = b[k];
      if (av === bv || av === undefined) continue;
      if (bv === undefined) out.push({ path: [...path, k], old: av });
      else diff(av, bv, [...path, k], out);
    }
    for (const k of Object.keys(b)) {
      const bv = b[k];
      if (bv !== undefined && a[k] === undefined) out.push({ path: [...path, k], value: bv });
    }
    return out;
  }
  if (!deepEqual(a, b)) out.push({ path, value: b, old: a });
  return out;
}

/** The ops that undo `ops` (in reverse order). */
export const invert = (ops: Op[]): Op[] => ops.map((o) => ({ path: o.path, value: o.old, old: o.value })).reverse();

/** Reads a path (undefined when any step is missing). */
export function getAt(doc: unknown, path: string[]): unknown {
  let cur = doc;
  for (const k of path) {
    if (!isPlainObject(cur)) return undefined;
    cur = cur[k];
  }
  return cur;
}

export type ApplyMode =
  /** Server order wins: every op whose parent exists is applied (remote changes). */
  | 'force'
  /**
   * Own undo / redo: an op is applied only where the value is still what it was left as (`old` before the op
   * ran, i.e. untouched since); a property someone else changed in the meantime keeps their value.
   */
  | 'checked';

export interface ApplyResult<T> {
  doc: T;
  applied: Op[];
  skipped: Op[];
}

/**
 * Applies ops to a document (immutably; unchanged subtrees stay shared). An op whose parent record is gone
 * (deleted meanwhile) is skipped rather than recreating a partial record.
 */
export function applyOps<T>(doc: T, ops: Op[], mode: ApplyMode = 'force'): ApplyResult<T> {
  const applied: Op[] = [];
  const skipped: Op[] = [];
  const next = produce(doc, (d: Draft<T>) => {
    for (const op of ops) {
      if (!op.path.length) {
        skipped.push(op);
        continue;
      }
      let parent: unknown = d;
      for (const k of op.path.slice(0, -1)) {
        parent = isPlainObject(parent) ? parent[k] : undefined;
        if (!isPlainObject(parent)) break;
      }
      if (!isPlainObject(parent)) {
        skipped.push(op);
        continue;
      }
      const key = op.path[op.path.length - 1];
      if (mode === 'checked' && !deepEqual(parent[key], op.old)) {
        skipped.push(op);
        continue;
      }
      if (op.value === undefined) delete parent[key];
      else parent[key] = op.value;
      applied.push(op);
    }
  });
  return { doc: next, applied, skipped };
}

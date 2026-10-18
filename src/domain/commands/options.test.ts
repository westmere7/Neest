import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { createEmptyProject } from '../model/defaults';
import { ProjectSchema, type Project } from '../model/schema';
import type { D } from './walls';
import { addWallChain } from './walls';
import { deleteMaterial, duplicateMaterial, placeObject } from './entities';
import { addOption, deleteOption, listOptions, moveOption, nextOptionName, renameOption, switchOption } from './options';

const edit = (p: Project, fn: (d: D) => void): Project => produce(p, fn);

function base() {
  let obj = '';
  const p = edit(createEmptyProject(), (d) => {
    addWallChain(d, [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }], { closed: true, thickness: 0.12, height: 2.7 });
    obj = placeObject(d, { assetId: 'side-table', x: 1, y: 1, width: 0.5, depth: 0.5, height: 0.5 });
  });
  return { p, obj };
}

describe('layout options', () => {
  it('a project starts with one implicit option', () => {
    const { options, activeId } = listOptions(createEmptyProject());
    expect(options.map((o) => o.name)).toEqual(['Option A']);
    expect(activeId).toBe('default');
  });

  it('duplicates, edits and switches without touching the other option', () => {
    const { p, obj } = base();
    let b = '';
    const q = edit(p, (d) => {
      b = addOption(d, 'duplicate');
    });
    expect(q.options!.map((o) => o.name)).toEqual(['Option A', 'Option B']);
    expect(q.activeOptionId).toBe(b);
    expect(Object.keys(q.objects)).toEqual([obj]);
    // Move the table in B.
    const r = edit(q, (d) => {
      d.objects[obj].x = 3;
    });
    const a = r.options![0];
    expect(a.plan!.objects[obj].x).toBe(1);
    // Back to A: the table is where it was; B keeps its version.
    const s = edit(r, (d) => void switchOption(d, a.id));
    expect(s.objects[obj].x).toBe(1);
    expect(s.options![1].plan!.objects[obj].x).toBe(3);
    expect(s.options![0].plan).toBeNull();
    expect(ProjectSchema.safeParse(s).success).toBe(true);
  });

  it('shell keeps the walls without furniture; blank is empty', () => {
    const { p } = base();
    const shell = edit(p, (d) => void addOption(d, 'shell'));
    expect(Object.keys(shell.walls)).toHaveLength(4);
    expect(Object.keys(shell.objects)).toHaveLength(0);
    const blank = edit(p, (d) => void addOption(d, 'blank', 'Studio idea'));
    expect(Object.keys(blank.walls)).toHaveLength(0);
    expect(blank.options![1].name).toBe('Studio idea');
  });

  it('renames, reorders and deletes, never the last option', () => {
    const { p } = base();
    let q = edit(p, (d) => {
      addOption(d, 'duplicate');
      addOption(d, 'duplicate');
    });
    const [a, b, c] = q.options!;
    expect(c.name).toBe('Option C');
    q = edit(q, (d) => renameOption(d, b.id, 'Open kitchen'));
    expect(q.options![1].name).toBe('Open kitchen');
    q = edit(q, (d) => moveOption(d, c.id, -1));
    expect(q.options!.map((o) => o.id)).toEqual([a.id, c.id, b.id]);
    // Deleting the active option (C) switches to its neighbour first.
    q = edit(q, (d) => void deleteOption(d, c.id));
    expect(q.options!.map((o) => o.id)).toEqual([a.id, b.id]);
    expect(q.activeOptionId).toBe(a.id);
    expect(q.options![0].plan).toBeNull();
    q = edit(q, (d) => void deleteOption(d, b.id));
    expect(edit(q, (d) => void deleteOption(d, a.id)).options).toHaveLength(1);
  });

  it('deleting a material reassigns it in every option', () => {
    const { p, obj } = base();
    let mat = '';
    let q = edit(p, (d) => {
      mat = duplicateMaterial(d, Object.keys(d.materials)[0])!;
      d.objects[obj].materials = { top: mat };
      addOption(d, 'duplicate');
      switchOption(d, d.options![0].id);
    });
    const keep = Object.keys(p.materials)[0];
    q = edit(q, (d) => deleteMaterial(d, mat, keep));
    expect(q.objects[obj].materials.top).toBe(keep);
    expect(q.options![1].plan!.objects[obj].materials.top).toBe(keep);
  });

  it('names options A to Z, then AA', () => {
    expect(nextOptionName([{ name: 'Option A' }, { name: 'Option C' }])).toBe('Option B');
    const many = Array.from({ length: 26 }, (_, i) => ({ name: `Option ${String.fromCharCode(65 + i)}` }));
    expect(nextOptionName(many)).toBe('Option AA');
  });
});

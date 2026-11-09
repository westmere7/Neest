import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Project } from '../model/schema';
import { migrateProject } from '@/storage/migrations';
import { SAMPLES, buildDemoProject } from '@/features/projects/demoProject';
import { addOption, switchOption } from '../commands/options';
import { createProjectStore } from '@/state/projectStore';
import { applyOps, deepEqual, diff, invert } from './ops';
import { diffProjects, fromDoc, mergeEdits, toDoc, viewedOption } from './doc';

const sixty = (): Project =>
  migrateProject(JSON.parse(readFileSync(resolve(__dirname, 'fixtures/60ltn.json'), 'utf8'))).project;

/** Two people on one project: each store's changes are relayed to the other, as a sync server would. */
function pair(p: Project) {
  const a = createProjectStore();
  const b = createProjectStore();
  a.getState().load(structuredClone(p));
  b.getState().load(structuredClone(p));
  a.getState().onLocalOps((ops) => b.getState().applyRemote(structuredClone(ops)));
  b.getState().onLocalOps((ops) => a.getState().applyRemote(structuredClone(ops)));
  return { a, b };
}
const docOf = (s: ReturnType<typeof createProjectStore>) => toDoc(s.getState().project!);
const firstWall = (p: Project) => Object.values(p.walls)[0];

describe('ops', () => {
  it('diff + apply turns one document into the other, and invert turns it back', () => {
    const a = { x: { y: 1, z: [1, 2] }, gone: 'q', same: { k: 1 } };
    const b = { x: { y: 2, z: [1, 2, 3] }, same: a.same, added: { n: true } };
    const ops = diff(a, b);
    expect(ops.map((o) => o.path.join('.')).sort()).toEqual(['added', 'gone', 'x.y', 'x.z']);
    const fwd = applyOps(a, ops).doc;
    expect(fwd).toEqual(b);
    expect(fwd.same).toBe(a.same); // untouched parts stay shared
    expect(applyOps(fwd, invert(ops)).doc).toEqual(a);
  });

  it('checked mode skips a property changed since, and a record deleted since', () => {
    const doc = { walls: { w1: { t: 0.1, h: 2.7 } } };
    const ops = diff(doc, { walls: { w1: { t: 0.2, h: 2.7 } } });
    const later = { walls: { w1: { t: 0.3, h: 2.7 } } };
    const r = applyOps(later, invert(ops), 'checked');
    expect(r.doc.walls.w1.t).toBe(0.3);
    expect(r.skipped).toHaveLength(1);
    const deleted = applyOps({ walls: {} } as typeof doc, invert(ops), 'force');
    expect(deleted.doc).toEqual({ walls: {} });
  });
});

describe('project document', () => {
  it.each([...SAMPLES.map((s) => [s.id, () => s.build()] as const), ['60LTN', sixty] as const])(
    'round-trips the %s project for every option',
    (_name, build) => {
      const p = build();
      const doc = toDoc(p);
      expect(fromDoc(doc, viewedOption(p), p)).toEqual(p);
      // Showing another option and coming back changes nothing in the document.
      for (const id of Object.keys(doc.plans)) {
        const other = fromDoc(doc, id, p);
        expect(viewedOption(other)).toBe(doc.optionOrder.length ? id : viewedOption(p));
        expect(diff(doc, toDoc(other))).toEqual([]);
      }
    },
  );

  it('switching options is not a document change', () => {
    const p = sixty();
    const ids = p.options!.map((o) => o.id);
    const store = createProjectStore();
    store.getState().load(p);
    store.getState().execute('Switch', (d) => void switchOption(d, ids.find((id) => id !== viewedOption(p))!));
    expect(store.getState().past).toHaveLength(0);
    expect(viewedOption(store.getState().project!)).not.toBe(viewedOption(p));
    expect(diffProjects(p, store.getState().project!)).toEqual([]);
  });
});

describe('two people editing one project', () => {
  it('edits on different things merge and both end up with the same document', () => {
    const { a, b } = pair(buildDemoProject());
    const [w1, w2] = Object.values(a.getState().project!.walls);
    a.getState().execute('Thicker', (d) => void (d.walls[w1.id].thickness = 0.3));
    b.getState().execute('Taller', (d) => void (d.walls[w2.id].height = 3.1));
    expect(a.getState().project!.walls[w2.id].height).toBe(3.1);
    expect(b.getState().project!.walls[w1.id].thickness).toBe(0.3);
    expect(deepEqual(docOf(a), docOf(b))).toBe(true);
  });

  it("undo reverses only your own change; a property someone else changed since keeps their value", () => {
    const { a, b } = pair(buildDemoProject());
    const w = firstWall(a.getState().project!);
    a.getState().execute('A thickness', (d) => void (d.walls[w.id].thickness = 0.3));
    b.getState().execute('B height', (d) => void (d.walls[w.id].height = 3.2));
    a.getState().undo();
    expect(a.getState().project!.walls[w.id].thickness).toBe(w.thickness);
    expect(a.getState().project!.walls[w.id].height).toBe(3.2);
    // Same property: B overwrote A's value, so A's undo leaves B's.
    a.getState().execute('A again', (d) => void (d.walls[w.id].thickness = 0.4));
    b.getState().execute('B wins', (d) => void (d.walls[w.id].thickness = 0.5));
    a.getState().undo();
    expect(a.getState().project!.walls[w.id].thickness).toBe(0.5);
    expect(deepEqual(docOf(a), docOf(b))).toBe(true);
  });

  it('each person views their own option; edits land in the right option for both', () => {
    const base = sixty();
    const { a, b } = pair(base);
    const ids = base.options!.map((o) => o.id);
    const other = ids.find((id) => id !== viewedOption(base))!;
    b.getState().execute('B looks elsewhere', (d) => void switchOption(d, other));
    expect(viewedOption(a.getState().project!)).toBe(viewedOption(base));
    const w = firstWall(a.getState().project!);
    a.getState().execute('A edits its option', (d) => void (d.walls[w.id].height = 2.95));
    expect(b.getState().project!.walls[w.id]?.height).not.toBe(2.95); // B shows another option
    expect(toDoc(b.getState().project!).plans[viewedOption(base)].walls![w.id].height).toBe(2.95);
    expect(deepEqual(docOf(a), docOf(b))).toBe(true);
  });

  it('undo of an edit made in another option shows that option again', () => {
    const p = sixty();
    const store = createProjectStore();
    store.getState().load(p);
    const start = viewedOption(p);
    const w = firstWall(p);
    store.getState().execute('Edit', (d) => void (d.walls[w.id].height = 2.9));
    const other = p.options!.map((o) => o.id).find((id) => id !== start)!;
    store.getState().execute('Switch', (d) => void switchOption(d, other));
    store.getState().undo();
    expect(viewedOption(store.getState().project!)).toBe(start);
    expect(store.getState().project!.walls[w.id].height).toBe(w.height);
  });

  it('random concurrent edits from three people converge', () => {
    const p = buildDemoProject();
    const stores = [0, 1, 2].map(() => createProjectStore());
    for (const s of stores) s.getState().load(structuredClone(p));
    // A server: queues every change and delivers them later in one global order.
    const queue: { from: number; ops: ReturnType<typeof diff> }[] = [];
    stores.forEach((s, i) => s.getState().onLocalOps((ops) => queue.push({ from: i, ops: structuredClone(ops) })));
    const deliver = () => {
      while (queue.length) {
        const m = queue.shift()!;
        stores.forEach((s, i) => i !== m.from && s.getState().applyRemote(m.ops));
        // The sender also applies the server's order, so later changes to the same property win everywhere.
        stores[m.from].getState().applyRemote(m.ops);
      }
    };
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const wallIds = Object.keys(p.walls);
    for (let round = 0; round < 40; round++) {
      for (const s of stores) {
        const id = wallIds[Math.floor(rnd() * wallIds.length)];
        const r = rnd();
        if (r < 0.4) s.getState().execute('t', (d) => void (d.walls[id] && (d.walls[id].thickness = 0.1 + Math.round(rnd() * 20) / 100)));
        else if (r < 0.7) s.getState().execute('h', (d) => void (d.walls[id] && (d.walls[id].height = 2.4 + Math.round(rnd() * 10) / 10)));
        else if (r < 0.85) s.getState().undo();
        else s.getState().redo();
      }
      if (rnd() < 0.5) deliver();
    }
    deliver();
    const docs = stores.map((s) => toDoc(s.getState().project!));
    expect(deepEqual(docs[0], docs[1])).toBe(true);
    expect(deepEqual(docs[1], docs[2])).toBe(true);
  });

  it('adding an option is one step; undo removes it and shows the option from before', () => {
    const store = createProjectStore();
    const p = sixty();
    store.getState().load(p);
    store.getState().execute('Add', (d) => void addOption(d, 'duplicate'));
    expect(store.getState().project!.options).toHaveLength(p.options!.length + 1);
    store.getState().undo();
    expect(store.getState().project!.options).toHaveLength(p.options!.length);
    expect(viewedOption(store.getState().project!)).toBe(viewedOption(p));
  });
});

describe('merging an edited project file (file mirror)', () => {
  const firstId = (rec: Record<string, unknown>) => Object.keys(rec)[0];
  const edit = (p: Project, fn: (d: Project) => void): Project => {
    const d = structuredClone(p);
    fn(d);
    return d;
  };

  it('applies only what the file changed, keeping newer changes by others', () => {
    const base = sixty();
    const wall = firstId(base.walls);
    const item = firstId(base.objects);
    // The assistant moved an item in the file; meanwhile a teammate renamed the project and thickened a wall.
    const file = edit(base, (d) => {
      d.objects[item].x += 0.5;
      d.updatedAt = base.updatedAt + 1;
    });
    const current = edit(base, (d) => {
      d.name = 'Renamed by a teammate';
      d.walls[wall].thickness = 0.3;
    });
    const merged = mergeEdits(base, file, current)!;
    expect(merged.objects[item].x).toBe(base.objects[item].x + 0.5);
    expect(merged.name).toBe('Renamed by a teammate');
    expect(merged.walls[wall].thickness).toBe(0.3);
    expect(merged.updatedAt).toBe(current.updatedAt);
    expect(viewedOption(merged)).toBe(viewedOption(current));
  });

  it('changes nothing when the file is what was written', () => {
    const base = sixty();
    expect(mergeEdits(base, structuredClone(base), edit(base, (d) => void (d.name = 'x')))).toBeNull();
    expect(mergeEdits(base, edit(base, (d) => void (d.updatedAt += 5)), base)).toBeNull();
  });

  it('carries edits to another layout option than the one shown', () => {
    const base = sixty();
    const other = base.options!.find((o) => o.id !== viewedOption(base))!.id;
    // The file was edited while it showed another option (its own fields hold that option's plan).
    const shown = fromDoc(toDoc(base), other, base);
    const item = firstId(shown.objects);
    const file = edit(shown, (d) => void (d.objects[item].rotation = 1.25));
    const merged = mergeEdits(shown, file, base)!;
    expect(viewedOption(merged)).toBe(viewedOption(base));
    expect((toDoc(merged).plans[other] as { objects: Project['objects'] }).objects[item].rotation).toBe(1.25);
  });
});

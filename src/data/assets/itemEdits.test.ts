import { describe, expect, it } from 'vitest';
import '@/packs/loader';
import { ASSET_CATALOG, ASSETS_BY_ID } from './catalog';
import { assetPlan, getAsset, getObjectAsset } from './registry';
import { partBounds } from './plantParts';
import {
  canEditShape,
  cleanEdits,
  detectSections,
  editedParts,
  editsApply,
  isEmptyEdits,
  paramHandles,
  partSig,
  sectionInfo,
  withEdits,
} from './itemEdits';
import { withModel } from './models';
import type { AssetDefinition, Part, Size3 } from './types';

type V3 = [number, number, number];
import { PlacedObjectSchema, type ItemEdits } from '@/domain/model/schema';

const finite = (parts: Part[]) =>
  parts.every((p) => {
    const b = partBounds(p);
    return [...b.min, ...b.max].every(Number.isFinite);
  });

/** Every part inside the item's box (with a little slack for bevels and conservative bounds). */
const inside = (parts: Part[], { w, d, h }: Size3, slack = 0.03) =>
  parts.every((p) => {
    const b = partBounds(p);
    return b.min[0] >= -w / 2 - slack && b.max[0] <= w / 2 + slack && b.min[1] >= -slack && b.max[1] <= h + slack && b.min[2] >= -d / 2 - slack && b.max[2] <= d / 2 + slack;
  });

const all = () => ASSET_CATALOG;
/** Items edits apply to (the engine is checked on all of them; older part edits must keep working). */
const editable = () => all().filter(editsApply);
/** Items the shape editor opens on: they have components to resize. */
const withEditor = () => all().filter(canEditShape);
const byId = (id: string): AssetDefinition => ASSETS_BY_ID[id] ?? getAsset(null, id)!;

describe('which items have the shape editor', () => {
  it('edits apply to building parts and built furniture, never branded items, meshes or decor', () => {
    const list = editable();
    expect(list.length).toBeGreaterThan(300);
    expect(list.some((a) => a.brand || a.model)).toBe(false);
    const types = new Set(list.map((a) => a.type));
    expect([...types].sort()).toEqual(['beds', 'kids', 'seating', 'storage', 'structure', 'surfaces']);
    // Shelves where editing makes no sense, and kinds left out altogether.
    for (const id of ['radiator', 'laundry-basket', 'parasol', 'pouf-round', 'plant-monstera', 'floor-lamp', 'rug-rect', 'vase', 'generic-box', 'toaster'])
      expect(editsApply(byId(id)) || canEditShape(byId(id)), id).toBe(false);
    expect(all().filter((a) => a.brand).some(editsApply)).toBe(false);
  });

  it('opens only on items with components to resize: settings or compartments and levels', () => {
    const list = withEditor();
    expect(list.length).toBeGreaterThan(200);
    for (const a of list) {
      const s = detectSections(a.build(a.defaultSize), a.defaultSize);
      expect(!!a.params?.length || s.x.length + s.y.length > 0, a.id).toBe(true);
    }
    for (const id of ['portal-frames:rounded-portal', 'portal-frames:corner-portal-half-wall', 'wardrobes-fullheight:dressing-mirror-niche-wardrobe', 'bookcase', 'sofa-3-seat'])
      expect(canEditShape(byId(id)), id).toBe(true);
    // Nothing to make variants from: a plain bed, a plain wardrobe, a desk, a column.
    for (const id of ['bed-double', 'wardrobe', 'desk', 'column-square']) {
      expect(editsApply(byId(id)), id).toBe(true);
      expect(canEditShape(byId(id)), id).toBe(false);
    }
  });
});

describe('items without edits are unchanged', () => {
  it('keeps existing items exactly as they were (same asset, same parts, no stored field)', () => {
    const a = byId('wardrobe');
    expect(withEdits(a, undefined)).toBe(a);
    expect(withEdits(a, {})).toBe(a);
    expect(withEdits(a, { parts: {}, sections: { x: { n: 1, d: [0] } } })).toBe(a);
    const o = PlacedObjectSchema.parse({ id: 'o1', assetId: 'wardrobe', x: 0, y: 0, width: 1.2, depth: 0.6, height: 2 });
    expect('edits' in o).toBe(false);
    expect(getObjectAsset(null, o)).toBe(a);
    // Edits a newer or broken file wrote load as none instead of failing the project.
    const bad = PlacedObjectSchema.parse({ ...o, edits: { parts: { x: { sig: '' } } } });
    expect(bad.edits).toBeUndefined();
  });

  it('builds every editable item the same through the edit path when nothing is edited', () => {
    for (const a of editable()) {
      const size = a.defaultSize;
      const plain = a.build(size);
      const viaEdits = editedParts(a, size, undefined).map((p) => p.part);
      expect(viaEdits, a.id).toEqual(plain);
    }
  });

  it('never applies edits to items without the editor', () => {
    const lamp = byId('floor-lamp');
    expect(withEdits(lamp, { parts: { '0': { sig: partSig(lamp.build(lamp.defaultSize)[0]), hidden: true } } })).toBe(lamp);
  });
});

describe('editing every editable item', () => {
  it('moves each found divider and shelf, and edits a part, on every item without breaking it', () => {
    let withSections = 0;
    for (const a of editable()) {
      const size = a.defaultSize;
      const base = a.build(size);
      const found = detectSections(base, size);
      for (const axis of ['x', 'y'] as const) {
        found[axis].forEach((_, i) => {
          withSections++;
          const d = found[axis].map((_, j) => (j === i ? 0.04 : 0));
          const edits: ItemEdits = { sections: { [axis]: { n: found[axis].length, d } } };
          const parts = editedParts(a, size, edits).map((p) => p.part);
          expect(parts.length, a.id).toBe(base.length);
          expect(finite(parts), `${a.id} ${axis}${i}`).toBe(true);
          expect(inside(parts, size, 0.06), `${a.id} ${axis}${i} stays in its box`).toBe(true);
        });
      }
      // A part edit on the first and the last part: resized, moved and hidden.
      const last = base.length - 1;
      const edits: ItemEdits = {
        parts: {
          '0': { sig: partSig(base[0]), grow: [0.02, 0.02, 0.02], move: [0.01, 0, 0] },
          [String(last)]: { sig: partSig(base[last]), hidden: true },
        },
      };
      const out = editedParts(a, size, edits);
      expect(finite(out.map((p) => p.part)), a.id).toBe(true);
      expect(out[last].hidden || last === 0, a.id).toBe(true);
      const def = withEdits(a, edits);
      expect(def.id.startsWith(`${a.id}@shape:`), a.id).toBe(true);
      expect(def.build(size).length, a.id).toBe(last === 0 ? 0 : base.length - 1);
    }
    expect(withSections).toBeGreaterThan(100);
  });

  it('widens a wardrobe compartment by moving its divider; the wardrobe keeps its width', () => {
    const a = editable().find((x) => x.group === 'Wardrobes' && detectSections(x.build(x.defaultSize), x.defaultSize).x.length >= 1)!;
    const size = a.defaultSize;
    const info = sectionInfo(a, size, undefined);
    const edge = info.x.found[0];
    const edits: ItemEdits = { sections: { x: { n: info.x.found.length, d: info.x.found.map((_, i) => (i === 0 ? 0.15 : 0)) } } };
    expect(sectionInfo(a, size, edits).x.edges[0]).toBeCloseTo(edge + 0.15);
    const parts = editedParts(a, size, edits).map((p) => p.part);
    // The divider (a thin upright panel at the edge) moved with it, kept its thickness.
    const before = a.build(size).filter((p) => {
      const b = partBounds(p);
      return Math.abs((b.min[0] + b.max[0]) / 2 - edge) < 0.02 && b.max[0] - b.min[0] <= 0.05;
    });
    expect(before.length).toBeGreaterThan(0);
    const moved = parts.filter((p) => {
      const b = partBounds(p);
      return Math.abs((b.min[0] + b.max[0]) / 2 - (edge + 0.15)) < 0.02 && b.max[0] - b.min[0] <= 0.05;
    });
    expect(moved.length).toBe(before.length);
    const xs = parts.flatMap((p) => [partBounds(p).min[0], partBounds(p).max[0]]);
    const xs0 = a.build(size).flatMap((p) => [partBounds(p).min[0], partBounds(p).max[0]]);
    expect(Math.min(...xs)).toBeCloseTo(Math.min(...xs0), 6);
    expect(Math.max(...xs)).toBeCloseTo(Math.max(...xs0), 6);
  });

  it('finds the niche of a niche wardrobe and widens it, narrowing the compartments either side', () => {
    const a = byId('wardrobes-fullheight:dressing-mirror-niche-wardrobe');
    const size = a.defaultSize;
    const { x } = sectionInfo(a, size, undefined);
    expect(x.found.length).toBe(2);
    const niche = x.found[1] - x.found[0];
    // Wider by 20 cm: each edge moves 10 cm out.
    const edits: ItemEdits = { sections: { x: { n: 2, d: [-0.1, 0.1] } } };
    const now = sectionInfo(a, size, edits).x.edges;
    expect(now[1] - now[0]).toBeCloseTo(niche + 0.2);
    const parts = editedParts(a, size, edits).map((p) => p.part);
    const mirror = parts.find((p) => p.slot === 'mirror')!;
    const mirror0 = a.build(size).find((p) => p.slot === 'mirror')!;
    const w = (p: Part) => partBounds(p).max[0] - partBounds(p).min[0];
    // What sits in the niche stretches with it, in proportion.
    expect(w(mirror) / w(mirror0)).toBeCloseTo((now[1] - now[0]) / niche, 2);
    expect(inside(parts, size, 0.001)).toBe(true);
  });

  it("moves a portal frame's legs with its section edges (the outline is remapped point by point)", () => {
    const a = byId('portal-frames:rounded-portal');
    const size = a.defaultSize;
    const { x } = sectionInfo(a, size, undefined);
    expect(x.found.length).toBe(2);
    const base = a.build(size);
    const parts = editedParts(a, size, { sections: { x: { n: 2, d: [0.15, -0.15] } } }).map((p) => p.part);
    expect(parts).not.toEqual(base);
    expect(inside(parts, size, 0.001)).toBe(true);
    // The plan footprint keeps the item's width.
    const xs = (ps: Part[]) => ps.flatMap((p) => [partBounds(p).min[0], partBounds(p).max[0]]);
    expect(Math.min(...xs(parts))).toBeCloseTo(Math.min(...xs(base)), 6);
  });

  it('ignores a part edit once the part at its index is something else', () => {
    const a = byId('bookcase');
    const base = a.build(a.defaultSize);
    const edits: ItemEdits = { parts: { '0': { sig: 'sphere:nothing', hidden: true } } };
    expect(editedParts(a, a.defaultSize, edits).every((p) => !p.hidden && !p.edited)).toBe(true);
    expect(editedParts(a, a.defaultSize, edits).map((p) => p.part)).toEqual(base);
  });

  it('draws the edited item in the plan (a hidden part leaves the outline)', () => {
    const a = byId('desk');
    const size = a.defaultSize;
    const base = a.build(size);
    const planned = base.map((p, i) => [p, i] as const).filter(([p]) => p.plan !== false);
    const [, i] = planned[0];
    const obj = { assetId: a.id, edits: { parts: { [String(i)]: { sig: partSig(base[i]), hidden: true } } } };
    const edited = getObjectAsset(null, obj)!;
    expect(edited.id).not.toBe(a.id);
    expect(assetPlan(edited, size).shapes.length).toBe(assetPlan(a, size).shapes.length - 1);
  });
});

describe('shape settings of every item that has them', () => {
  it('defaults rebuild the item exactly; every setting at its limits builds inside the box', () => {
    const withParams = all().filter((a) => a.params?.length);
    expect(withParams.length).toBeGreaterThan(10);
    for (const a of withParams) {
      const size = a.defaultSize;
      const defaults = Object.fromEntries(a.params!.map((p) => [p.id, p.default]));
      expect(a.build(size, defaults), `${a.id} defaults`).toEqual(a.build(size));
      expect(canEditShape(a), `${a.id} has settings but no editor`).toBe(true);
      for (const p of a.params!) {
        expect(p.kind === 'toggle' || (p.min !== undefined && p.max !== undefined), `${a.id} ${p.id} needs min and max`).toBe(true);
        const values = p.kind === 'toggle' ? [true, false] : p.kind === 'choice' ? p.options!.map((o) => o.value) : [p.min!, p.max!];
        for (const v of values) {
          const parts = editedParts(a, size, { params: { [p.id]: v } }).map((x) => x.part);
          expect(parts.length > 0 && finite(parts) && inside(parts, size), `${a.id} ${p.id}=${v}`).toBe(true);
        }
      }
    }
  });
});

describe('setting handles in the 3D view', () => {
  it('every length setting of a portal has a handle that moves the way the value grows', () => {
    const items = withEditor().filter((a) => a.params?.some((p) => p.handle));
    expect(items.length).toBeGreaterThanOrEqual(18);
    for (const a of items) {
      const size = a.defaultSize;
      for (const p of a.params!.filter((x) => x.kind === 'length')) expect(!!p.handle, `${a.id} ${p.id} has no handle`).toBe(true);
      for (const { param, value, handle } of paramHandles(a, size, undefined)) {
        // The handle sits on the item (within its box, a little proud of the front face).
        const [x, y, z] = handle.at;
        expect(Math.abs(x) <= size.w / 2 + 0.02 && y >= -0.02 && y <= size.h + 0.02 && Math.abs(z) <= size.d / 2 + 0.02, `${a.id} ${param.id} at ${handle.at}`).toBe(true);
        // A little more of the value moves the handle along its direction (never against it).
        const step = Math.min(0.03 / (handle.per ?? 1), (param.max! - value) / 2);
        if (step <= 1e-4) continue;
        const next = paramHandles(a, size, { [param.id]: value + step }).find((h) => h.param.id === param.id)!;
        const moved = next.handle.at.reduce((s, v, i) => s + (v - handle.at[i]) * handle.dir[i], 0);
        expect(moved, `${a.id} ${param.id}`).toBeGreaterThanOrEqual(-1e-6);
      }
    }
  });

  it('a corner radius handle follows the radius exactly where the curve meets the soffit', () => {
    const a = byId('portal-frames:rounded-portal');
    const h0 = paramHandles(a, a.defaultSize, undefined).find((h) => h.param.id === 'rR')!;
    const h1 = paramHandles(a, a.defaultSize, { rR: h0.value + 0.1 }).find((h) => h.param.id === 'rR')!;
    expect(h1.handle.at[0] - h0.handle.at[0]).toBeCloseTo(-0.1, 6);
    expect(h1.handle.at[1]).toBeCloseTo(h0.handle.at[1], 6);
  });

  it("the corner portal's settings reach its models' half wall and ledge too", () => {
    const a = byId('portal-frames:corner-portal-half-wall');
    const size = a.defaultSize;
    for (const model of ['ledge-inside', 'ledge-outside', 'half-wall', 'open']) {
      const m = withModel(a, model);
      const plain = m.build(size);
      // Defaults change nothing (saved part edits keep pointing at the same parts).
      expect(m.build(size, Object.fromEntries(a.params!.map((p) => [p.id, p.default]))), model).toEqual(plain);
      const wide = editedParts(m, size, { params: { legA: 0.5 } }).map((p) => p.part);
      expect(wide, model).not.toEqual(plain);
      expect(wide.length, model).toBe(plain.length);
    }
  });
});

describe('shape settings (portal frames)', () => {
  const portals = () => editable().filter((a) => a.id.startsWith('portal-frames:') && a.params?.length);

  it('every portal frame offers its settings and builds inside its box at their limits', () => {
    expect(portals().length).toBeGreaterThan(10);
    for (const a of portals()) {
      const size = a.defaultSize;
      for (const p of a.params!) {
        const values = p.kind === 'toggle' ? [true, false] : [p.min!, p.max!];
        for (const v of values) {
          const parts = editedParts(a, size, { params: { [p.id]: v } }).map((x) => x.part);
          expect(parts.length, `${a.id} ${p.id}=${v}`).toBeGreaterThan(0);
          expect(finite(parts), `${a.id} ${p.id}=${v}`).toBe(true);
          expect(inside(parts, size), `${a.id} ${p.id}=${v}`).toBe(true);
        }
      }
    }
  });

  it('a wider leg changes the frame; the defaults change nothing and are not stored', () => {
    const a = byId('portal-frames:rounded-portal');
    const size = a.defaultSize;
    const leg = a.params!.find((p) => p.id === 'leg')!;
    expect(cleanEdits(a, { params: { leg: leg.default } })).toBeNull();
    const wide = editedParts(a, size, { params: { leg: 0.4 } }).map((p) => p.part);
    expect(wide).not.toEqual(a.build(size));
    // Out-of-range and wrong-typed values are clamped or ignored.
    const clamped = editedParts(a, size, { params: { leg: 99 } }).map((p) => p.part);
    expect(clamped).toEqual(editedParts(a, size, { params: { leg: leg.max! } }).map((p) => p.part));
    expect(editedParts(a, size, { params: { leg: 'wide' } }).map((p) => p.part)).toEqual(a.build(size));
  });

  it('turns the lit niches off', () => {
    const a = portals().find((x) => x.params!.some((p) => p.id === 'niche'))!;
    const on = a.build(a.defaultSize);
    const off = editedParts(a, a.defaultSize, { params: { niche: false } }).map((p) => p.part);
    expect(off.length).toBeLessThan(on.length);
  });
});

describe('model settings (arched wall portal, short wall)', () => {
  const ID = 'portal-frames:arched-wall-portal';
  const shortWall = () => withModel(byId(ID), 'short-wall');
  const lowest = (parts: Part[]) => Math.min(...parts.map((p) => partBounds(p).min[1]));

  it("only the short-wall model offers its height, after the item's own settings", () => {
    const base = byId(ID);
    expect(base.params!.some((p) => p.id === 'shortWall')).toBe(false);
    expect(withModel(base, 'flush').params!.some((p) => p.id === 'shortWall')).toBe(false);
    const ids = shortWall().params!.map((p) => p.id);
    expect(ids.at(-1)).toBe('shortWall');
    expect(ids.slice(0, -1)).toEqual(base.params!.map((p) => p.id));
  });

  it('fills the opening up to its height with an oak sill, and the lining starts on the sill', () => {
    const a = shortWall();
    const size = a.defaultSize;
    for (const h of [0.6, 0.9, 1.2]) {
      const parts = editedParts(a, size, { params: { shortWall: h } }).map((x) => x.part);
      const sill = parts.filter((p) => p.slot === 'lining' && Math.abs(partBounds(p).max[1] - h) < 1e-6);
      expect(sill.length, `sill at ${h}`).toBe(1);
      // Across the opening: the sill reaches both jambs.
      const b = partBounds(sill[0]);
      expect(b.max[0] - b.min[0]).toBeGreaterThan(1.5);
      // The lining round the opening (every lining part but the sill) starts on the sill, not the floor.
      expect(lowest(parts.filter((p) => p.slot === 'lining' && p !== sill[0]))).toBeCloseTo(h, 3);
      expect(inside(parts, size)).toBe(true);
    }
  });

  it('stays under the arch however high it is set, at small and large sizes', () => {
    const a = shortWall();
    for (const size of [a.defaultSize, { w: 1.2, d: 0.1, h: 1.9 }, { w: 6, d: 0.3, h: 3.4 }]) {
      const parts = editedParts(a, size, { params: { shortWall: 2.4 } }).map((x) => x.part);
      expect(finite(parts)).toBe(true);
      expect(inside(parts, size)).toBe(true);
      const sill = parts.filter((p) => p.slot === 'lining').map((p) => partBounds(p)).filter((b) => b.max[0] - b.min[0] > 0.3 && b.max[1] - b.min[1] < 0.05);
      expect(sill.length).toBe(1);
      expect(sill[0].max[1]).toBeLessThanOrEqual(size.h - 0.3 + 1e-6);
    }
  });

  it('has a handle on top of the wall that drags it up', () => {
    const a = shortWall();
    const h = paramHandles(a, a.defaultSize, { shortWall: 1.1 }).find((x) => x.param.id === 'shortWall')!;
    expect(h.handle.at[1]).toBeCloseTo(1.1, 6);
    expect(h.handle.dir).toEqual([0, 1, 0]);
    expect(h.value).toBe(1.1);
  });
});

describe('connected edits', () => {
  const STUDY = 'wardrobe-study:wardrobe-study-wall';
  const box = (p: Part) => partBounds(p);

  it('a niche wall carries the shelves, their lights and the back panel between the walls', () => {
    const a = byId(STUDY);
    const size = a.defaultSize;
    const base = a.build(size);
    // Part 1: the tower's right wall; parts 6, 7 shelves between the walls, 8–10 LED strips under them, 4 the back.
    const edits: ItemEdits = { parts: { '1': { sig: partSig(base[1]), move: [0.1, 0, 0] } } };
    const out = editedParts(a, size, edits);
    expect(box(out[1].part).min[0]).toBeCloseTo(box(base[1]).min[0] + 0.1, 6);
    for (const i of [6, 7]) {
      // The shelf's right end follows the wall; its left end stays on the other wall.
      expect(box(out[i].part).max[0], `shelf ${i}`).toBeCloseTo(box(base[i]).max[0] + 0.1, 6);
      expect(box(out[i].part).min[0], `shelf ${i}`).toBeCloseTo(box(base[i]).min[0], 6);
      expect(out[i].linked).toBe(true);
    }
    // Lights under the shelves stretch with them; the back panel too.
    for (const i of [8, 9, 4]) expect(box(out[i].part).max[0], `part ${i}`).toBeGreaterThan(box(base[i]).max[0] + 0.05);
    // The far wall does not move.
    expect(out[0].part).toEqual(base[0]);
    // Each part on its own when the edits say so.
    const alone = editedParts(a, size, { ...edits, detached: true });
    expect(alone[6].part).toEqual(base[6]);
    expect(alone.some((p) => p.linked)).toBe(false);
  });

  it('keeps every editable item sound when any of its parts moves or grows with its attached parts', () => {
    let spread = 0;
    let tried = 0;
    for (const a of editable()) {
      const size = a.defaultSize;
      const base = a.build(size);
      // A few parts per item: the first, a middle one and the last.
      for (const i of [...new Set([0, Math.floor(base.length / 2), base.length - 1])]) {
        for (const pe of [{ move: [0.05, 0, 0] as V3 }, { grow: [0, 0.06, 0] as V3 }, { grow: [-0.02, 0, 0.03] as V3 }]) {
          const out = editedParts(a, size, { parts: { [String(i)]: { sig: partSig(base[i]), ...pe } } });
          tried++;
          expect(out.length, a.id).toBe(base.length);
          expect(finite(out.map((p) => p.part)), `${a.id} part ${i}`).toBe(true);
          // Nothing flies off: every part stays near the item's box.
          expect(inside(out.map((p) => p.part), size, 0.2), `${a.id} part ${i}`).toBe(true);
          spread += out.filter((p) => p.linked).length / base.length;
        }
      }
    }
    // On average an edit pulls along some parts, never most of the item.
    expect(spread / tried).toBeGreaterThan(0.01);
    expect(spread / tried).toBeLessThan(0.35);
  });
});

describe('stored edits', () => {
  it('survive saving and loading (part keys, the detached flag)', () => {
    const edits = { parts: { '12': { sig: 'box:oak', move: [0, 0.1, 0] as V3 } }, detached: true };
    const o = PlacedObjectSchema.parse({ id: 'o1', assetId: 'wardrobe', x: 0, y: 0, width: 1.2, depth: 0.6, height: 2, edits });
    expect(o.edits).toEqual(edits);
  });

  it('drops what changes nothing', () => {
    const a = byId('wardrobe');
    expect(cleanEdits(a, { parts: { '1': { sig: 'box:body', move: [0, 0, 0], grow: [0, 0, 0] } }, sections: { y: { n: 2, d: [0, 0] } } })).toBeNull();
    expect(isEmptyEdits(cleanEdits(a, { parts: { '1': { sig: 'box:body', hidden: true } } }))).toBe(false);
  });
});

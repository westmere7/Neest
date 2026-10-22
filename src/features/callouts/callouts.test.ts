import { produce } from 'immer';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createEmptyProject } from '@/domain/model/defaults';
import { CalloutSchema, ProjectSchema, type Project } from '@/domain/model/schema';
import { derivePlan } from '@/domain/geometry/derive';
import { calloutAnchor } from '@/domain/geometry/callouts';
import type { D } from '@/domain/commands/walls';
import { addWallChain } from '@/domain/commands/walls';
import { deleteEntities, duplicateEntities, placeObject, reconcileRooms } from '@/domain/commands/entities';
import { addCallout, detachCallouts, updateCallout } from '@/domain/commands/callouts';
import { addOption, switchOption } from '@/domain/commands/options';
import { repairProject } from '@/storage/migrations';
import { hitTest } from '@/features/plan-2d/hitTest';
import { buildDxf } from '@/features/exports/dxf';
import { buildSheet, defaultSheetOptions } from '@/features/exports/sheet';
import { buildPlanImageSvg } from '@/features/exports/planExports';
import { buildDemoProject } from '@/features/projects/demoProject';
import { calloutInfo, calloutLines, lineText, parseInline, parseNote, safeHref, wrapRuns } from './content';
import { calloutExtent, layoutCallout, visibleCallouts } from './layout';
import { CalloutsSvg } from './CalloutsSvg';

const edit = (p: Project, fn: (d: D) => void): Project => produce(p, fn);

function base() {
  let obj = '';
  const p = edit(createEmptyProject(), (d) => {
    addWallChain(d, [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }], { closed: true, thickness: 0.12, height: 2.7, role: 'exterior' });
    reconcileRooms(d);
    obj = placeObject(d, { assetId: 'side-table', x: 1, y: 1, width: 0.5, depth: 0.4, height: 0.55 });
  });
  return { p, obj, roomId: Object.keys(p.rooms)[0] };
}

describe('callout notes', () => {
  it('keeps only web and mail links', () => {
    expect(safeHref('https://neest.app/a?b=1')).toBe('https://neest.app/a?b=1');
    expect(safeHref('www.example.com')).toBe('https://www.example.com');
    expect(safeHref('mailto:hi@example.com')).toBe('mailto:hi@example.com');
    expect(safeHref('javascript:alert(1)')).toBeNull();
    expect(safeHref('data:text/html,hi')).toBeNull();
  });

  it('parses bold, italic, links and bare URLs', () => {
    expect(parseInline('a **b** *c* _d_ [e](https://x.io) https://y.io')).toEqual([
      { text: 'a ' },
      { text: 'b', bold: true },
      { text: ' ' },
      { text: 'c', italic: true },
      { text: ' ' },
      { text: 'd', italic: true },
      { text: ' ' },
      { text: 'e', href: 'https://x.io' },
      { text: ' ' },
      { text: 'https://y.io', href: 'https://y.io' },
    ]);
    // An unsafe link keeps its text but loses the link.
    expect(parseInline('[click](javascript:alert(1))')[0].href).toBeUndefined();
  });

  it('wraps at spaces, never inside a word that changes style', () => {
    const lines = wrapRuns(parseInline('**Keep** — reupholster in *olive bouclé*.'), 34, null, 0);
    const text = lines.map((l) => l.map((r) => r.text).join(''));
    expect(text).toEqual(['Keep — reupholster in olive', 'bouclé.']);
    expect(lines[1]).toEqual([{ text: 'bouclé', italic: true }, { text: '.' }]);
    // A word longer than a line is cut.
    expect(wrapRuns([{ text: 'x'.repeat(50) }], 20, null, 0).map((l) => l[0].text.length)).toEqual([20, 20, 10]);
  });

  it('splits paragraphs, bullets and numbered items', () => {
    const blocks = parseNote('Intro\nsame paragraph\n\n- one\n* two\n1. first\n2) second');
    expect(blocks.map((b) => b.kind)).toEqual(['p', 'bullet', 'bullet', 'number', 'number']);
    expect(blocks[0].runs[0].text).toBe('Intro same paragraph');
    expect(blocks[4].n).toBe(2);
  });
});

describe('callout targets', () => {
  it('follows its item and shows its facts', () => {
    const { p, obj } = base();
    let id = '';
    const q = edit(p, (d) => {
      id = addCallout(d, { target: { kind: 'object', objectId: obj } });
    });
    const c = q.callouts[id];
    expect(c.offset).toEqual({ x: 0.9, y: -0.9 });
    expect(calloutAnchor(q, derivePlan(q), c.target)).toMatchObject({ x: 1, y: 1, z: 0.55 });
    const moved = edit(q, (d) => void (d.objects[obj].x = 2));
    expect(calloutAnchor(moved, null, c.target)?.x).toBe(2);
    const info = calloutInfo(q, null, c);
    expect(info[0]).toBeTruthy();
    expect(info.some((l) => /50/.test(l) && /40/.test(l))).toBe(true);
    // No title: the item name becomes the title line.
    expect(calloutLines(q, null, c)[0].role).toBe('title');
  });

  it('points at a room label point and an area centroid', () => {
    const { p, roomId } = base();
    let room = '';
    let area = '';
    const q = edit(p, (d) => {
      room = addCallout(d, { target: { kind: 'room', roomId } });
      area = addCallout(d, { target: { kind: 'region', points: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }, { x: 0, y: 1 }] } });
    });
    const derived = derivePlan(q);
    const r = calloutAnchor(q, derived, q.callouts[room].target)!;
    expect(r.x).toBeGreaterThan(0);
    expect(r.x).toBeLessThan(4);
    expect(r.outline?.length).toBeGreaterThanOrEqual(4);
    expect(calloutAnchor(q, derived, q.callouts[area].target)).toMatchObject({ x: 1, y: 0.5, z: 0 });
    expect(calloutInfo(q, derived, q.callouts[area]).join(' ')).toMatch(/2(\.0+)? m²/);
  });

  it('removes notes with their item and keeps notes of a deleted room as spots', () => {
    const { p, obj, roomId } = base();
    let onItem = '';
    let onRoom = '';
    let spot = '';
    const q = edit(p, (d) => {
      onItem = addCallout(d, { target: { kind: 'object', objectId: obj }, note: 'goes with the table' });
      onRoom = addCallout(d, { target: { kind: 'room', roomId }, note: 'keep me' });
      spot = addCallout(d, { target: { kind: 'point', x: 2, y: 2, z: 0 } });
    });
    const r = edit(q, (d) => deleteEntities(d, [obj]));
    expect(r.callouts[onItem]).toBeUndefined();
    expect(r.callouts[spot]).toBeDefined();
    const s = edit(r, (d) => detachCallouts(d, new Set([roomId])));
    expect(s.callouts[onRoom].target.kind).toBe('point');
    expect(s.callouts[onRoom].note).toBe('keep me');
    // Deleting a note itself removes it.
    expect(edit(s, (d) => deleteEntities(d, [spot])).callouts[spot]).toBeUndefined();
  });

  it('duplicates a spot callout with an offset', () => {
    const { p } = base();
    let id = '';
    const q = edit(p, (d) => {
      id = addCallout(d, { target: { kind: 'point', x: 1, y: 2, z: 0 }, title: 'Spot' });
    });
    let copies: string[] = [];
    const r = edit(q, (d) => {
      copies = duplicateEntities(d, [id], { x: 0.5, y: 0.5 });
    });
    const copy = Object.values(r.callouts).find((c) => c.id !== id)!;
    expect(copy.target).toMatchObject({ kind: 'point', x: 1.5, y: 2.5 });
    expect(copy.title).toBe('Spot');
    expect(copies.length).toBeGreaterThan(0);
  });

  it('belongs to its layout option', () => {
    const { p } = base();
    let id = '';
    const q = edit(p, (d) => {
      id = addCallout(d, { target: { kind: 'point', x: 1, y: 1, z: 0 } });
    });
    let b = '';
    const r = edit(q, (d) => {
      b = addOption(d, 'blank');
    });
    expect(r.activeOptionId).toBe(b);
    expect(Object.keys(r.callouts)).toEqual([]);
    const back = edit(r, (d) => void switchOption(d, r.options![0].id));
    expect(Object.keys(back.callouts)).toEqual([id]);
    expect(ProjectSchema.safeParse(back).success).toBe(true);
  });

  it('loads older projects without callouts and repairs dangling ones', () => {
    const raw = JSON.parse(JSON.stringify(createEmptyProject())) as Record<string, unknown>;
    delete raw.callouts;
    delete (raw.layers as Record<string, unknown>).callouts;
    const parsed = ProjectSchema.parse(raw);
    expect(parsed.callouts).toEqual({});
    expect(parsed.layers.callouts).toEqual({ visible: true, locked: false });
    const broken = edit(parsed, (d) => {
      addCallout(d, { target: { kind: 'object', objectId: 'obj_missing' } });
    });
    const { project, warnings } = repairProject(structuredClone(broken));
    expect(Object.keys(project.callouts)).toEqual([]);
    expect(warnings.join()).toMatch(/callout/);
  });
});

describe('callouts on the plan and in exports', () => {
  const demo = buildDemoProject();
  const derived = derivePlan(demo);

  it('the sample apartment has one callout of each kind', () => {
    expect(Object.values(demo.callouts).map((c) => c.target.kind).sort()).toEqual(['object', 'point', 'region', 'room']);
    for (const c of Object.values(demo.callouts)) expect(calloutAnchor(demo, derived, c.target)).not.toBeNull();
  });

  it('draws labels, honours the layer and per-callout visibility', () => {
    const svg = renderToStaticMarkup(createElement(CalloutsSvg, { project: demo, derived, px: 0.02, fontFamily: 'sans-serif', links: true }));
    expect(svg.match(/class="plan-callout"/g)?.length).toBe(4);
    expect(svg).toContain('Kitchen refit');
    expect(svg).toContain('href="https://');
    const hiddenLayer = edit(demo, (d) => void (d.layers.callouts.visible = false));
    expect(visibleCallouts(hiddenLayer)).toEqual([]);
    const one = Object.keys(demo.callouts)[0];
    const hiddenOne = edit(demo, (d) => updateCallout(d, one, { hidden: true }));
    expect(visibleCallouts(hiddenOne).length).toBe(3);
  });

  it('is picked by its label', () => {
    const c = Object.values(demo.callouts).find((x) => x.target.kind === 'region')!;
    const l = layoutCallout(demo, derived, c, 0.02)!;
    const hit = hitTest(demo, derived, { x: l.box.x + l.box.w / 2, y: l.box.y + l.box.h / 2 }, 0.16);
    expect(hit).toEqual({ kind: 'callout', id: c.id });
  });

  it('appears in sheets, plan images and DXF (and can be left out)', () => {
    const sheet = buildSheet(demo, defaultSheetOptions(demo));
    expect(sheet.svg).toContain('plan-callout');
    expect(sheet.svg).toContain('Kitchen refit');
    expect(buildSheet(demo, { ...defaultSheetOptions(demo), callouts: false }).svg).not.toContain('plan-callout');
    const img = buildPlanImageSvg(demo, { pixelsPerMetre: 50, mode: 'furnished', transparent: false, annotations: true, furniture: true, callouts: true });
    expect(img.svg).toContain('Kitchen refit');
    // The image grows to include labels outside the walls.
    const ext = calloutExtent(demo, derived, 1 / 55)!;
    expect(ext.minX).toBeLessThan(derived.bounds!.minX);
    const dxf = buildDxf(demo, { unit: 'mm', furniture: false, dimensions: false, labels: false, rooms: false, callouts: true });
    expect(dxf).toContain('A-ANNO-NOTE');
    expect(dxf).toContain('Kitchen refit');
    expect(dxf).toContain(lineText({ runs: [{ text: 'Extractor fan' }], role: 'title', indent: 0 }));
    expect(buildDxf(demo, { unit: 'mm', furniture: false, dimensions: false, labels: false, rooms: false, callouts: false })).not.toContain('Kitchen refit');
  });

  it('draws each note style: label look, line, end mark and highlight', () => {
    const draw = (patch: Parameters<typeof updateCallout>[2]) => {
      const one = Object.values(demo.callouts).find((c) => c.target.kind === 'object')!;
      const p = edit(demo, (d) => {
        for (const id of Object.keys(d.callouts)) if (id !== one.id) delete d.callouts[id];
        updateCallout(d, one.id, patch);
      });
      return renderToStaticMarkup(createElement(CalloutsSvg, { project: p, derived: derivePlan(p), px: 0.02, fontFamily: 'sans-serif' }));
    };
    // Defaults: card with stripe, solid leader, dot, highlighted target.
    const base = draw({});
    expect(base).toContain('<line');
    expect(base).not.toMatch(/<line[^>]*stroke-dasharray/);
    expect(base.match(/<circle/g)?.length).toBe(1);
    expect(base.match(/<path/g)?.length).toBe(1); // the target highlight
    expect(draw({ line: 'dashed' })).toMatch(/<line[^>]*stroke-dasharray/);
    expect(draw({ line: 'none' })).not.toContain('<line');
    expect(draw({ end: 'arrow' }).match(/<path/g)?.length).toBe(2);
    expect(draw({ end: 'none', highlight: false })).not.toMatch(/<circle|<path/);
    // Text-only labels have no box; filled labels use the colour and white text.
    expect(draw({ box: 'text' })).not.toContain('<rect');
    expect(draw({ box: 'solid' })).toContain('fill="#ffffff"');
    // Bigger text makes a bigger label.
    const c = Object.values(demo.callouts)[0];
    const small = layoutCallout(demo, derived, { ...c, size: 's' }, 0.02)!;
    const large = layoutCallout(demo, derived, { ...c, size: 'l' }, 0.02)!;
    expect(large.box.h).toBeGreaterThan(small.box.h);
  });

  it('older notes get the default style and DXF follows the style', () => {
    const one = Object.values(demo.callouts)[0];
    const { box, size, line, lineWeight, end, endSize, highlight, ...old } = one;
    void [box, size, line, lineWeight, end, endSize, highlight];
    expect(CalloutSchema.parse(old)).toMatchObject({ box: 'card', size: 'm', line: 'solid', lineWeight: 'regular', end: 'dot', endSize: 'm', highlight: true });
    const plain = edit(demo, (d) => {
      for (const c of Object.values(d.callouts)) Object.assign(c, { line: 'none', end: 'none', box: 'text', highlight: false });
    });
    const dxf = buildDxf(plain, { unit: 'mm', furniture: false, dimensions: false, labels: false, rooms: false, callouts: true });
    expect(dxf).toContain('Kitchen refit');
    // Text only, no leader, no end mark, no highlight: only TEXT entities on the notes layer.
    expect(dxf).not.toMatch(/\r\n0\r\n(LINE|CIRCLE|POLYLINE)\r\n8\r\nA-ANNO-NOTE/);
  });
});


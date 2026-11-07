import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { produce } from 'immer';
import { describe, expect, it, vi } from 'vitest';
import { GuestSettingsSchema, ProjectSchema, type Project } from '@/domain/model/schema';
import { buildDemoProject } from '@/features/projects/demoProject';
import { guestLayers, guestSceneProject, guestViews } from '@/domain/walkthrough/guest';
import { addItemLayer, setObjectsLayer, updateItemLayer } from '@/domain/commands/itemLayers';
import { deleteCameraPreset } from '@/domain/commands/entities';
import type { D } from '@/domain/commands/walls';
import { addOption, deleteOption, projectWithOption, renameOption, switchOption } from '@/domain/commands/options';
import { addCallout } from '@/domain/commands/callouts';
import { isCeilingItem } from '@/data/assets/catalog';
import { guestSlug } from './guestShare';

// The model needs WebGL and canvases (not in jsdom); the runtime is a build output. Both are stand-ins here.
const exportGlb = vi.fn(async (_projects: Project[], _o: unknown) => new Uint8Array([103, 108, 84, 70]).buffer);
vi.mock('./sceneExport', () => ({ exportOptionsGlb: (...a: unknown[]) => exportGlb(...(a as [Project[], unknown])) }));
vi.mock('@/generated/guest-viewer.js?raw', () => ({
  default: 'window.__viewer = true; // runtime </script> stand-in',
}));

import { buildGuestData, buildGuestHtml } from './guestExport';

const edit = (p: Project, fn: (d: D) => void): Project => produce(p, fn);

/** Every http(s) address in a text, except XML namespace names (identifiers, never loaded). */
const externalUrls = (text: string) =>
  [...text.matchAll(/https?:\/\/[^\s"'<>)\\]+/g)]
    .map((m) => m[0])
    .filter(
      (u) => !/^http:\/\/www\.w3\.org\/(2000\/svg|1999\/xhtml|1999\/xlink|XML\/1998\/namespace)/.test(u),
    );

describe('guest settings', () => {
  it('fill in defaults for older projects', () => {
    const old = GuestSettingsSchema.parse({ startCameraId: 'cam_a', spawn: null, spawnAngle: 0 });
    expect(old).toMatchObject({
      startCameraId: 'cam_a',
      title: '',
      subtitle: '',
      intro: false,
      viewIds: null,
      overviewViews: true,
      startMode: 'orbit',
      walkSpeed: 1,
      eyeHeight: 1.6,
      walkFov: null,
      notes: 'shown',
      noteImages: true,
      noteDisplay: 'icon',
      options: 'all',
      optionIds: null,
      defaultOptionId: null,
      roomLabels: false,
      ceilings: true,
      info: 'open',
      wallDisplay: 'full',
      quality: 'balanced',
      shadows: true,
      timeOfDay: null,
      background: null,
      floorPlan: true,
      hiddenItems: false,
      tour: false,
      tourSeconds: 7,
      textureSize: 1024,
      surfaceDetail: true,
    });
    expect(GuestSettingsSchema.parse(undefined).startCameraId).toBeNull();
    const p = buildDemoProject();
    const legacy = {
      ...JSON.parse(JSON.stringify(p)),
      guest: { startCameraId: null, spawn: null, spawnAngle: 0 },
    };
    expect(ProjectSchema.parse(legacy).guest.textureSize).toBe(1024);
  });

  it('rejects out-of-range values', () => {
    expect(() =>
      GuestSettingsSchema.parse({ startCameraId: null, spawn: null, spawnAngle: 0, textureSize: 300 }),
    ).toThrow();
    expect(() =>
      GuestSettingsSchema.parse({ startCameraId: null, spawn: null, spawnAngle: 0, eyeHeight: 5 }),
    ).toThrow();
  });

  it('offers the chosen views in order and forgets deleted ones', () => {
    const p = buildDemoProject();
    expect(guestViews(p).map((c) => c.id)).toEqual(['cam_overview', 'cam_living']);
    const q = edit(p, (d) => {
      d.guest.viewIds = ['cam_living', 'cam_overview'];
    });
    expect(guestViews(q).map((c) => c.id)).toEqual(['cam_living', 'cam_overview']);
    const r = edit(q, (d) => deleteCameraPreset(d, 'cam_living'));
    expect(r.guest.viewIds).toEqual(['cam_overview']);
  });

  it('applies the overrides to the scene settings', () => {
    const p = edit(buildDemoProject(), (d) => {
      Object.assign(d.guest, {
        timeOfDay: 18.5,
        background: '#101010',
        quality: 'fast',
        shadows: false,
        walkFov: 85,
        wallDisplay: 'cutaway',
        cutawayHeight: 1.4,
        ceilings: false,
      });
    });
    const s = guestSceneProject(p).render;
    expect(s).toMatchObject({
      timeOfDay: 18.5,
      background: '#101010',
      quality: 'draft',
      shadows: false,
      walkFov: 85,
      wallDisplay: 'cutaway',
      cutawayHeight: 1.4,
      showCeilings: false,
    });
    const same = guestSceneProject(buildDemoProject()).render;
    expect(same.timeOfDay).toBe(buildDemoProject().render.timeOfDay);
  });

  it('lists item layers, hidden ones only when included', () => {
    let lay = '';
    const p = edit(buildDemoProject(), (d) => {
      lay = addItemLayer(d, 'Decor', '#e0a030');
      setObjectsLayer(d, Object.keys(d.objects).slice(0, 2), lay);
      updateItemLayer(d, lay, { visible: false });
    });
    expect(guestLayers(p).map((l) => l.id)).toEqual(['']);
    const q = edit(p, (d) => {
      d.guest.hiddenItems = true;
    });
    expect(guestLayers(q)).toEqual([
      { id: lay, name: 'Decor', color: '#e0a030', on: false },
      { id: '', name: 'Unassigned', on: true },
    ]);
  });
});

describe('guest export data', () => {
  it('serialises the settings for the viewer', async () => {
    const p = edit(buildDemoProject(), (d) => {
      Object.assign(d.guest, {
        title: 'Our flat',
        subtitle: 'Draft 2',
        intro: true,
        welcome: 'Hello!\nHave a look around.',
        viewIds: ['cam_living'],
        overviewViews: false,
        startMode: 'walk',
        walkSpeed: 1.41,
        eyeHeight: 1.7,
        walkFov: 80,
        notes: 'hidden',
        roomLabels: true,
        ceilings: false,
        info: 'closed',
        wallDisplay: 'cutaway',
        cutawayHeight: 1.1,
        quality: 'high',
        shadows: false,
        tour: true,
        tourSeconds: 5,
        textureSize: 512,
        surfaceDetail: false,
      });
    });
    const data = await buildGuestData(p);
    expect(data.title).toBe('Our flat');
    expect(data.subtitle).toBe('Draft 2');
    expect(data.intro).toBe('Hello!\nHave a look around.');
    // Saved ("custom") views are omitted; only built-in Overview and Top are offered.
    expect(data.cameras.map((c) => c.name)).toEqual(['Overview', 'Top']);
    expect(data.start).toBe(0);
    expect('startView' in data).toBe(false);
    expect((await buildGuestData(edit(p, (d) => void (d.guest.startCameraId = '__top__')))).start).toBe(1);
    // The HTML viewer is orbit-only: no first-person walk settings or colliders are shipped.
    expect('startMode' in data).toBe(false);
    expect('walk' in data).toBe(false);
    expect(data.notesHidden).toBe(true);
    // By default (`guest.notes === 'shown'`), floating notes start shown so the "Show in workspace" toggle is on.
    expect((await buildGuestData(buildDemoProject())).notesHidden).toBe(false);
    // Notes open as pins unless the export says otherwise, whatever the editor's 3D view shows.
    expect(data.noteDisplay).toBe('icon');
    expect((await buildGuestData(edit(p, (d) => void (d.guest.noteDisplay = 'full')))).noteDisplay).toBe('full');
    // One layout option (the project has none of its own), opened on.
    expect(data.options.map((o) => o.name)).toEqual(['Option A']);
    expect(data.option).toBe(0);
    const [opt] = data.options;
    expect(opt.callouts.length).toBeGreaterThan(0);
    expect(opt.notes.length).toBeGreaterThanOrEqual(opt.callouts.length);
    // Floating callouts and Notes list items carry only note text, never automatic Height / size / area lines.
    for (const c of opt.callouts) {
      expect(c.lines.every((l) => l.role !== 'info')).toBe(true);
      expect(c.lines.map((l) => l.runs.map((r) => r.t).join('')).join('\n')).not.toMatch(/^Height /m);
    }
    for (const n of opt.notes) {
      expect('info' in n).toBe(false);
      expect('heading' in n).toBe(false);
    }
    expect(data.roomsOn).toBe(true);
    expect(opt.rooms.length).toBeGreaterThan(0);
    expect('colliders' in opt).toBe(false);
    expect('spawn' in opt).toBe(false);
    expect(data.ceilingsOn).toBe(false);
    expect(data.cutawayOn).toBe(true);
    expect(data.cutaway).toBe(1.1);
    expect(data.quality).toBe('high');
    expect(data.shadows).toBe(false);
    expect(data.lampBudgets?.fast).toEqual({ point: 0, spot: 0, shadows: 0 });
    expect('tour' in data).toBe(false);
    expect(opt.info?.open).toBe(false);
    expect(opt.info?.stats.map(([k]) => k)).toEqual([
      'Rooms',
      'Floor area',
      'Items',
      'Doors',
      'Windows',
      'Wall length',
    ]);
    expect(opt.info?.rooms.length).toBe(opt.rooms.length);
    expect(opt.plan).toMatch(/^<svg[^>]+viewBox="/);
    // The model is gzipped and decodes back to the GLB.
    expect(data.glbEncoding).toBe('gzip');
    const bytes = Uint8Array.from(atob(data.glb), (c) => c.charCodeAt(0));
    const glb = new Uint8Array(
      await new Response(
        new Response(bytes).body!.pipeThrough(new DecompressionStream('gzip')),
      ).arrayBuffer(),
    );
    expect(new TextDecoder().decode(glb.subarray(0, 4))).toBe('glTF');
    expect(exportGlb).toHaveBeenLastCalledWith(
      [expect.anything()],
      expect.objectContaining({ ceilings: true, cutaway: 1.1, textureSize: 512, surfaceDetail: false }),
    );
  });

  it('leaves out notes, the plan and the overview when switched off', async () => {
    const p = edit(buildDemoProject(), (d) => {
      Object.assign(d.guest, { notes: 'off', floorPlan: false, info: 'off', timeOfDay: 8 });
    });
    const data = await buildGuestData(p);
    expect(data.options[0].callouts).toEqual([]);
    expect(data.options[0].notes).toEqual([]);
    expect(data.options[0].plan).toBeNull();
    expect(data.options[0].info).toBeNull();
    expect(data.cameras.map((c) => c.name)).toEqual(['Overview', 'Top']);
    expect(data.start).toBe(0);
  });

  it('reuses the embedded model while only viewer settings change', async () => {
    const p = buildDemoProject();
    await buildGuestData(p);
    const calls = exportGlb.mock.calls.length;
    await buildGuestData(edit(p, (d) => void (d.guest.title = 'Renamed')));
    expect(exportGlb.mock.calls.length).toBe(calls);
    await buildGuestData(edit(p, (d) => void (d.guest.textureSize = 2048)));
    expect(exportGlb.mock.calls.length).toBe(calls + 1);
  });

  it('builds an HTML file that loads nothing from outside', async () => {
    const p = buildDemoProject();
    const html = await buildGuestHtml(p);
    // Note hyperlinks are links guests may click, not something the page loads.
    const links = new Set(
      (await buildGuestData(p)).options[0].notes.flatMap((n) =>
        n.blocks.flatMap((b) => b.runs.flatMap((r) => (r.h ? [r.h] : []))),
      ),
    );
    expect(links.size).toBeGreaterThan(0);
    expect(externalUrls(html).filter((u) => !links.has(u))).toEqual([]);
    // The favicon (the nest mark) is a data URL, the only <link>.
    expect(html).toMatch(/<link rel="icon" type="image\/svg\+xml" href="data:image\/svg\+xml,/);
    expect(html).not.toMatch(
      /<link\b(?![^>]*href="data:)|<script[^>]+\bsrc=|<img\b|@import|url\(\s*['"]?(https?:|\/\/)|blob:|localStorage|indexedDB/i,
    );
    // Only system fonts.
    expect(html).not.toMatch(/@font-face|fonts\.googleapis/);
    // Inline scripts cannot be cut short by text inside the data.
    expect(html.match(/<\/script>/g)?.length).toBe(2);
    // The loading screen is plain markup before the (large) data script, so it shows while the file is read.
    expect(html.indexOf('id="ng-loading"')).toBeGreaterThan(0);
    expect(html.indexOf('id="ng-loading"')).toBeLessThan(html.indexOf('NEEST_GUEST_DATA'));
    // Phones: safe areas and the narrow layout.
    expect(html).toMatch(/viewport-fit=cover/);
    expect(html).toMatch(/@media \(max-width:640px\)/);
    // Phones on their side get the compact layout too.
    expect(html).toMatch(/@media \(max-width:640px\),\(max-height:500px\)/);
    // Panel switch styling supports role="switch" (`aria-checked=true`) for the house Light/Dark toggle, and declares dark color-scheme so browser Auto Dark Mode never alters the page.
    expect(html).toMatch(/<meta name="color-scheme" content="dark">/);
    expect(html).toMatch(/color-scheme:dark/);
    expect(html).toMatch(/\[aria-checked=true\]>\.ng-switch/);
    expect(html).toMatch(/\.ng-light-switch/);
    // Compact single-line bold white project title without a card background.
    expect(html).not.toContain('.ng-title,.ng-panel');
    expect(html).toMatch(/\.ng-title\{[^}]*color:#fff[^}]*font-weight:700/);
    // The nest mark sits in front of the title, in the accent teal (the viewer draws it).
    expect(html).toMatch(/\.ng-mark\{[^}]*fill:#6fb3a0/);
  });

  it('carries selected layout options and opens on the chosen default option', async () => {
    let a = '';
    let b = '';
    let c = '';
    const p = edit(buildDemoProject(), (d) => {
      b = addOption(d, 'shell', 'Empty shell');
      c = addOption(d, 'duplicate', 'Variant C');
      a = d.options![0].id;
      renameOption(d, a, 'Furnished');
      switchOption(d, a);
    });
    expect(Object.keys(projectWithOption(p, b).objects)).toEqual([]);
    expect(projectWithOption(p, a)).toBe(p);
    const data = await buildGuestData(p);
    expect(data.options.map((o) => o.name)).toEqual(['Furnished', 'Empty shell', 'Variant C']);
    expect(data.option).toBe(0);
    const [furnished, shell] = data.options;
    // Same walls, no furniture or notes in the shell.
    expect(shell.rooms.length).toBe(furnished.rooms.length);
    expect(shell.notes).toEqual([]);
    expect(furnished.notes.length).toBeGreaterThan(0);
    expect(shell.lamps).toEqual([]);
    // One model with all three options, in order.
    const [projects] = exportGlb.mock.lastCall!;
    expect(projects.map((q) => Object.keys(q.objects).length)).toEqual([Object.keys(p.objects).length, 0, 0]);
    // Selecting a subset of options and a custom default option (different from the active one).
    const subset = edit(p, (d) => {
      d.guest.optionIds = [b, c];
      d.guest.defaultOptionId = c;
    });
    const subsetData = await buildGuestData(subset);
    expect(subsetData.options.map((o) => o.name)).toEqual(['Empty shell', 'Variant C']);
    expect(subsetData.option).toBe(1);
    // Changing only the default option reuses the embedded GLB without rebuilding.
    const callsBeforeDefaultChange = exportGlb.mock.calls.length;
    const flippedDefault = await buildGuestData(edit(subset, (d) => void (d.guest.defaultOptionId = b)));
    expect(flippedDefault.option).toBe(0);
    expect(exportGlb.mock.calls.length).toBe(callsBeforeDefaultChange);
    // Deleting a chosen default option cleans up guest.optionIds and guest.defaultOptionId.
    const afterDelete = edit(subset, (d) => void deleteOption(d, c));
    expect(afterDelete.guest.optionIds).toEqual([b]);
    expect(afterDelete.guest.defaultOptionId).toBeNull();
    // Legacy `options: 'active'` still works when `optionIds` is null.
    const onShell = edit(p, (d) => void switchOption(d, b));
    expect((await buildGuestData(onShell)).option).toBe(1);
    const only = await buildGuestData(edit(onShell, (d) => void (d.guest.options = 'active')));
    expect(only.options.map((o) => o.name)).toEqual(['Empty shell']);
    expect(only.option).toBe(0);
  });

  it('lists every note in full for the Notes panel, with its pictures unless left out', async () => {
    const src = 'data:image/webp;base64,UklGRg==';
    const p = edit(buildDemoProject(), (d) => {
      addCallout(d, {
        target: { kind: 'general' },
        note: '**Budget**\n\nA very long first paragraph that would be wrapped on a floating label but stays whole here.\n- one\n- two\n\n1. first',
        images: [{ id: 'img_1', src, w: 1600, h: 900 }],
      });
    });
    const data = await buildGuestData(p);
    const { notes, callouts } = data.options[0];
    const general = notes.find((n) => n.target === 'General')!;
    // No place in the scene: listed, without a floating label.
    expect(general.label).toBe(-1);
    expect(general.at).toBeUndefined();
    expect(general.blocks.map((b) => b.k)).toEqual(['p', 'p', 'b', 'b', 'n']);
    expect(general.blocks[1].runs[0].t).toMatch(/stays whole here\.$/);
    expect(general.images).toEqual([{ src, w: 1600, h: 900 }]);
    // Notes with a place point at their floating label.
    const placed = notes.filter((n) => n.label >= 0);
    expect(placed.length).toBe(callouts.length);
    expect(placed.every((n) => n.at?.length === 3)).toBe(true);
    // The floating labels never carry pictures.
    expect(JSON.stringify(callouts)).not.toContain('data:image');
    const without = await buildGuestData(edit(p, (d) => void (d.guest.noteImages = false)));
    expect(without.options[0].notes.find((n) => n.target === 'General')!.images).toEqual([]);
  });

  it("follows the guest Notes setting, not the editor's Notes layer", async () => {
    const p = edit(buildDemoProject(), (d) => {
      d.layers.callouts.visible = false;
      const first = Object.values(d.callouts)[0];
      first.hidden = true;
    });
    const total = Object.keys(p.callouts).length;
    const data = await buildGuestData(p);
    // Every note but the one hidden on its own, though the layer is off in the editor.
    expect(data.options[0].notes.length).toBe(total - 1);
    expect((await buildGuestData(edit(p, (d) => void (d.guest.notes = 'off')))).options[0].notes).toEqual([]);
  });

  it('names live links after the guest title, in plain letters, with part of the project id', () => {
    const p = buildDemoProject();
    const slug = guestSlug({ ...p, id: 'prj_hj93rtum5n', guest: { ...p.guest, title: 'Căn hộ Đà Nẵng — 60 m²' } });
    expect(slug).toBe('can-ho-da-nang-60-m2-tum5n');
    expect(guestSlug({ ...p, id: 'prj_x', name: '!!!', guest: { ...p.guest, title: '' } })).toMatch(/^walkthrough-[a-z0-9]+$/);
    // Every slug fits the server's rule.
    expect(/^[a-z0-9][a-z0-9-]{0,63}$/.test(guestSlug({ ...p, guest: { ...p.guest, title: 'x'.repeat(200) } }))).toBe(true);
    // Projects without a link, and a broken stored one, load with none.
    expect(GuestSettingsSchema.parse({ startCameraId: null, spawn: null, spawnAngle: 0 }).share).toBeNull();
    expect(GuestSettingsSchema.parse({ startCameraId: null, spawn: null, spawnAngle: 0, share: { slug: 'Bad Slug', url: 'x', at: 1 } }).share).toBeNull();
  });

  it('hides hanging fixtures, not the building, while orbiting', () => {
    expect(isCeilingItem({ mount: 'ceiling', type: 'lighting' })).toBe(true);
    expect(isCeilingItem({ mount: 'ceiling', type: 'appliances' })).toBe(true);
    // Beams, soffits, arches and portals are structure.
    expect(isCeilingItem({ mount: 'ceiling', type: 'structure' })).toBe(false);
    expect(isCeilingItem({ mount: 'wall', type: 'lighting' })).toBe(false);
    expect(isCeilingItem(null)).toBe(false);
  });

  const runtimePath = resolve(__dirname, '../../generated/guest-viewer.js');
  it.runIf(existsSync(runtimePath))('ships a viewer runtime that loads nothing from outside', () => {
    const runtime = readFileSync(runtimePath, 'utf8');
    expect(externalUrls(runtime)).toEqual([]);
    expect(runtime).not.toMatch(/localStorage|sessionStorage|indexedDB|importScripts/);
    // No schema library or React in the standalone viewer (keeps every exported file small).
    expect(runtime).not.toMatch(/ZodError|useSyncExternalStore/);
    // On/off controls say so (aria-pressed), and full screen is offered where allowed.
    expect(runtime).toMatch(/aria-pressed/);
    expect(runtime).toMatch(/requestFullscreen/);
    // The mouse works as in the app: middle- or right-drag pans (and the help line says so).
    expect(runtime).toContain('right- / middle-drag to pan');
    // Layout options, view drop-down + Reset view button in the bottom bar, Notes list with its picture viewer, ceiling items; no walkthrough mode, Tour switch or top-right view buttons.
    expect(runtime).toMatch(/neestOption/);
    expect(runtime).toMatch(/ng-view-select/);
    expect(runtime).toMatch(/Reset view/);
    expect(runtime).not.toMatch(/ng-views/);
    expect(runtime).not.toMatch(/Play the views one after another|Start the tour/);
    expect(runtime).toMatch(/neestCeiling/);
    expect(runtime).toMatch(/ng-lightbox/);
    expect(runtime).not.toMatch(/Walk through|Exit walkthrough|Ghost|requestPointerLock/);
    // Panel buttons are not switches (aria-expanded), notes are Off / Icons / Full (no Compact, no separate switch), long
    // notes are cut and open in full on a click, notes with pictures carry a badge, a tap hides the controls.
    expect(runtime).toMatch(/ng-pbtn/);
    expect(runtime).toMatch(/aria-expanded/);
    expect(runtime).toMatch(/Notes in the 3D view/);
    expect(runtime).not.toMatch(/Show in workspace|ng-switch-row|ng-compact/);
    expect(runtime).toMatch(/\[['"]off['"],\s*['"]Off['"]\]/);
    expect(runtime).toMatch(/ng-cut/);
    expect(runtime).toMatch(/ng-open/);
    expect(runtime).toMatch(/ng-img-badge/);
    expect(runtime).toMatch(/ng-pin/);
    expect(runtime).toMatch(/ng-immersive/);
    expect(runtime).toMatch(/ng-light-switch/);
    expect(runtime).toMatch(/House light mode/);
    expect(runtime).not.toMatch(/made with Neest/);
  });
});

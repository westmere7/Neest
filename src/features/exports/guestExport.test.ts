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

// The model needs WebGL and canvases (not in jsdom); the runtime is a build output. Both are stand-ins here.
const exportGlb = vi.fn(async () => new Uint8Array([103, 108, 84, 70]).buffer);
vi.mock('./sceneExport', () => ({ exportGlb: (...a: unknown[]) => exportGlb(...(a as [])) }));
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
    expect(data.cameras.map((c) => c.name)).toEqual(['Living room']);
    // The opening view (Overview preset) has no button but still opens the file.
    expect(data.start).toBe(-1);
    expect(data.startView?.name).toBe('Overview');
    expect(data.startMode).toBe('walk');
    expect(data.walk).toEqual({ speed: 1.41, eye: 1.7, fov: 80 });
    expect(data.notesHidden).toBe(true);
    expect(data.callouts?.length).toBeGreaterThan(0);
    expect(data.roomsOn).toBe(true);
    expect(data.rooms?.length).toBeGreaterThan(0);
    expect(data.ceilingsOn).toBe(false);
    expect(data.cutawayOn).toBe(true);
    expect(data.cutaway).toBe(1.1);
    expect(data.quality).toBe('high');
    expect(data.shadows).toBe(false);
    expect(data.lampBudgets?.fast).toEqual({ point: 0, spot: 0, shadows: 0 });
    expect(data.tour).toEqual({ seconds: 5, auto: true });
    expect(data.info?.open).toBe(false);
    expect(data.info?.stats.map(([k]) => k)).toEqual([
      'Rooms',
      'Floor area',
      'Items',
      'Doors',
      'Windows',
      'Wall length',
    ]);
    expect(data.info?.rooms.length).toBe(data.rooms?.length);
    expect(data.plan).toMatch(/^<svg[^>]+viewBox="/);
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
      expect.anything(),
      expect.objectContaining({ ceilings: true, cutaway: 1.1, textureSize: 512, surfaceDetail: false }),
    );
  });

  it('leaves out notes, the plan and the overview when switched off', async () => {
    const p = edit(buildDemoProject(), (d) => {
      Object.assign(d.guest, { notes: 'off', floorPlan: false, info: 'off', timeOfDay: 8 });
    });
    const data = await buildGuestData(p);
    expect(data.callouts).toEqual([]);
    expect(data.plan).toBeNull();
    expect(data.info).toBeNull();
    // The saved "Overview" view replaces the automatic one (no duplicate buttons).
    expect(data.cameras.map((c) => c.name)).toEqual(['Overview', 'Living room', 'Top']);
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
      (await buildGuestData(p)).callouts!.flatMap((c) =>
        c.lines.flatMap((l) => l.runs.flatMap((r) => (r.h ? [r.h] : []))),
      ),
    );
    expect(links.size).toBeGreaterThan(0);
    expect(externalUrls(html).filter((u) => !links.has(u))).toEqual([]);
    expect(html).not.toMatch(
      /<link\b|<script[^>]+\bsrc=|<img\b|@import|url\(\s*['"]?(https?:|\/\/)|blob:|localStorage|indexedDB/i,
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
  });
});

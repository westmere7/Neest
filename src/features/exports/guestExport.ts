import type { Project } from '@/domain/model/schema';
import { derivePlan } from '@/domain/geometry/derive';
import { buildColliders, defaultSpawn } from '@/domain/walkthrough/collision';
import { namedView } from '@/features/scene-3d/cameraViews';
import { sunFromSettings } from '@/features/scene-3d/SceneContent';
import type { GuestCamera, GuestData } from '@/guest-viewer/main';
import { exportGlb } from './sceneExport';

function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let out = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) out += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(out);
}

const escHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Makes inline script content safe from premature </script> termination. */
const safeScript = (s: string) => s.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');

const CSS = `
html,body{margin:0;height:100%;overflow:hidden;background:#1d1f22;font:13px/1.4 Inter,"Segoe UI",system-ui,sans-serif;color:#f2efe9}
#neest-guest{position:fixed;inset:0}
canvas{display:block;touch-action:none}
.ng-hud{position:fixed;top:12px;left:12px;right:12px;display:flex;flex-wrap:wrap;gap:10px;align-items:flex-start;justify-content:space-between;pointer-events:none}
.ng-title{display:flex;flex-direction:column;gap:2px;padding:10px 14px;border-radius:12px;background:rgba(29,31,34,.82);backdrop-filter:blur(8px);pointer-events:auto}
.ng-title strong{font-size:15px}.ng-title span{color:#b0ada7;font-size:12px}
.ng-views{display:flex;flex-wrap:wrap;gap:6px;pointer-events:auto;max-width:60vw;justify-content:flex-end}
.ng-btn{border:1px solid rgba(255,255,255,.14);background:rgba(29,31,34,.82);color:#f2efe9;border-radius:9px;padding:8px 12px;font:inherit;cursor:pointer;backdrop-filter:blur(8px)}
.ng-btn:hover{background:rgba(52,55,60,.9)}
.ng-primary{background:#6fb3a0;color:#0f2a26;border-color:transparent;font-weight:600}
.ng-primary:hover{background:#a3cfc1}
.ng-bar{position:fixed;left:50%;bottom:18px;transform:translateX(-50%)}
.ng-help{position:fixed;left:50%;bottom:70px;transform:translateX(-50%);padding:6px 12px;border-radius:8px;background:rgba(29,31,34,.7);color:#d9d6cf;font-size:12px;white-space:nowrap}
.ng-loading{position:fixed;inset:0;display:grid;place-items:center;color:#b0ada7}
.ng-stick,.ng-look{display:none}
@media (pointer:coarse){
 .ng-walking .ng-stick{display:block;position:fixed;left:24px;bottom:96px;width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.25);touch-action:none}
 .ng-knob{position:absolute;left:38px;top:38px;width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.75)}
 .ng-walking .ng-look{display:block;position:fixed;right:0;top:90px;bottom:90px;width:50%;touch-action:none}
}
@media (max-width:640px){.ng-views{max-width:100%;justify-content:flex-start}.ng-help{white-space:normal;width:86vw;text-align:center}}
`;

/**
 * Builds a single self-contained HTML file: the viewer runtime (three.js
 * included), the scene as an embedded GLB, cameras, spawn point and collision
 * outlines. It references no external files, blob URLs, or browser storage.
 */
export async function buildGuestHtml(project: Project): Promise<string> {
  const derived = derivePlan(project);
  const glb = await exportGlb(project, { ceilings: true, furniture: true });
  const { default: runtime } = await import('@/generated/guest-viewer.js?raw');
  const home = namedView('home', derived.bounds);
  const cameras: GuestCamera[] = [
    ...project.cameras.map((c) => ({ name: c.name, projection: c.projection, position: c.position, target: c.target, fov: c.fov })),
    { name: 'Overview', projection: home.projection, position: home.position, target: home.target, fov: home.fov },
    (() => {
      const t = namedView('top', derived.bounds);
      return { name: 'Top', projection: t.projection, position: t.position, target: t.target, fov: t.fov };
    })(),
  ];
  const startIdx = Math.max(0, project.cameras.findIndex((c) => c.id === project.guest.startCameraId));
  const spawn = defaultSpawn(project, derived.faces);
  const sun = sunFromSettings(project.render);
  const data: GuestData = {
    title: project.name,
    exportedAt: new Date().toISOString(),
    glb: bufferToBase64(glb),
    cameras,
    start: project.cameras.length ? startIdx : 0,
    spawn: { x: spawn.p.x, y: spawn.p.y, angle: spawn.angle },
    colliders: buildColliders(project, derived.network).map((c) => [c.a.x, c.a.y, c.b.x, c.b.y].map((v) => Math.round(v * 1000) / 1000) as [number, number, number, number]),
    bounds: derived.bounds ?? { minX: -5, minY: -5, maxX: 5, maxY: 5 },
    background: project.render.background,
    sun: { dir: [sun.dir.x, sun.dir.y, sun.dir.z], color: `#${sun.color.getHexString()}`, intensity: sun.intensity },
    envIntensity: project.render.envIntensity,
    exposure: project.render.exposure,
  };
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="generator" content="Neest">
<title>${escHtml(project.name)} — 3D walkthrough</title>
<style>${CSS}</style>
</head>
<body>
<div id="neest-guest"></div>
<noscript>This walkthrough needs JavaScript and WebGL.</noscript>
<script>window.NEEST_GUEST_DATA = ${safeScript(JSON.stringify(data))};</script>
<script>${safeScript(runtime)}</script>
</body>
</html>`;
}

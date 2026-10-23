import type { Project } from '@/domain/model/schema';
import { derivePlan } from '@/domain/geometry/derive';
import { planOverview } from '@/domain/geometry/overview';
import { formatArea, formatLength } from '@/domain/model/units';
import { buildColliders, defaultSpawn } from '@/domain/walkthrough/collision';
import { guestAutoViews, guestLayerId, guestLayers, guestSceneProject, guestSubtitle, guestTitle, guestViews } from '@/domain/walkthrough/guest';
import { isObjectHidden } from '@/domain/commands/itemLayers';
import { getAsset } from '@/data/assets/registry';
import { LAMP_BUDGET, resolveObjectLights } from '@/data/assets/lights';
import { namedView } from '@/features/scene-3d/cameraViews';
import { sunFromSettings } from '@/features/scene-3d/SceneContent';
import type { GuestCallout, GuestCamera, GuestData, GuestLamp, GuestQuality } from '@/guest-viewer/main';
import { visibleCallouts } from '@/features/callouts/layout';
import { callout3DPoints } from '@/features/callouts/Callouts3D';
import { calloutLines } from '@/features/callouts/content';
import { NOTE_LINE_WIDTH, NOTE_SIZE_SCALE, endPx, labelColors, leaderDash } from '@/features/callouts/style';
import { buildPlanImageSvg } from './planExports';
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

/** The app's loading picture: a plan that draws itself and rises into walls (see SceneLoading.tsx). */
const LOADING_ART = `<svg class="ng-art" viewBox="0 0 120 90" aria-hidden="true"><path class="ng-plan-line" d="M10 50 L60 25 L110 50 L60 75 Z"/><path class="ng-plan-line ng-plan-inner" d="M35 37.5 L85 62.5 M60 25 L60 50 L35 62.5"/><path class="ng-wall" d="M10 50 L60 25 L60 5 L10 30 Z"/><path class="ng-wall ng-w2" d="M60 25 L110 50 L110 30 L60 5 Z"/><path class="ng-wall ng-w3" d="M35 37.5 L60 25 L60 12 L35 24.5 Z"/></svg>`;

/** System fonts only: the file must not load anything. */
const FONT = 'system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif';

const CSS = `
html,body{margin:0;height:100%;overflow:hidden;background:#1d1f22;font:13px/1.4 ${FONT};color:#f2efe9;-webkit-text-size-adjust:100%}
#neest-guest{position:fixed;inset:0}
canvas{display:block;touch-action:none}
button{-webkit-tap-highlight-color:transparent}
.ng-hud{position:fixed;top:calc(12px + env(safe-area-inset-top));left:calc(12px + env(safe-area-inset-left));right:calc(12px + env(safe-area-inset-right));display:flex;flex-wrap:wrap;gap:10px;align-items:flex-start;justify-content:space-between;pointer-events:none;z-index:3}
.ng-side{display:flex;flex-direction:column;gap:8px;max-width:min(320px,calc(100vw - 24px));pointer-events:none}
.ng-title,.ng-panel{padding:10px 14px;border-radius:12px;background:rgba(29,31,34,.86);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);pointer-events:auto}
.ng-title{display:flex;flex-direction:column;gap:2px}
.ng-title strong{font-size:15px}.ng-title span{color:#b0ada7;font-size:12px}
.ng-panel{max-height:calc(100vh - 170px);overflow:auto;-webkit-overflow-scrolling:touch}
.ng-panel h2{margin:0 0 8px;font-size:12px;font-weight:600;color:#b0ada7;text-transform:uppercase;letter-spacing:.04em;display:flex;justify-content:space-between;align-items:center}
.ng-x{border:0;background:none;color:#b0ada7;font:inherit;font-size:18px;line-height:1;cursor:pointer;padding:0 4px}
.ng-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:0 0 8px}
.ng-stats div{background:rgba(255,255,255,.06);border-radius:8px;padding:6px 8px}
.ng-stats dt{color:#b0ada7;font-size:11px}.ng-stats dd{margin:0;font-weight:650;font-variant-numeric:tabular-nums}
.ng-row{display:flex;justify-content:space-between;gap:12px;padding:4px 0;font-variant-numeric:tabular-nums}
.ng-row span:last-child{color:#d9d6cf}
.ng-sep{border-top:1px solid rgba(255,255,255,.1);margin:6px 0}
.ng-check{display:flex;align-items:center;gap:8px;padding:5px 0;cursor:pointer}
.ng-check input{accent-color:#6fb3a0;margin:0;width:16px;height:16px}
.ng-swatch{width:9px;height:9px;border-radius:3px;flex:none}
.ng-seg{display:flex;gap:4px;margin:4px 0 6px}
.ng-seg button{flex:1;border:1px solid rgba(255,255,255,.14);background:transparent;color:#f2efe9;border-radius:7px;padding:6px;font:inherit;font-size:12px;cursor:pointer}
.ng-seg button.on{background:#6fb3a0;color:#0f2a26;border-color:transparent;font-weight:600}
.ng-label{color:#b0ada7;font-size:11px;margin-top:6px}
.ng-views{display:flex;flex-wrap:wrap;gap:4px;padding:4px;border-radius:12px;background:rgba(29,31,34,.82);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);pointer-events:auto;max-width:60vw;justify-content:flex-end}
.ng-views .ng-btn{background:transparent;border-color:transparent}
.ng-views .ng-btn.on{background:#f2efe9;color:#1d1f22;font-weight:600}
.ng-btn{border:1px solid rgba(255,255,255,.14);background:rgba(29,31,34,.82);color:#f2efe9;border-radius:9px;padding:8px 12px;font:inherit;cursor:pointer;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);white-space:nowrap}
.ng-btn:hover{background:rgba(52,55,60,.9)}
.ng-views .ng-btn.on:hover{background:#fff}
.ng-btn:focus-visible{outline:2px solid #a3cfc1;outline-offset:1px}
.ng-primary{background:#6fb3a0;color:#0f2a26;border-color:transparent;font-weight:600}
.ng-primary:hover{background:#a3cfc1}
.ng-toggle{display:inline-flex;align-items:center;gap:8px}
.ng-switch{position:relative;flex:none;width:26px;height:15px;border-radius:8px;background:rgba(255,255,255,.22);transition:background .15s}
.ng-switch::after{content:"";position:absolute;left:2px;top:2px;width:11px;height:11px;border-radius:50%;background:#f2efe9;transition:transform .15s}
.ng-toggle[aria-pressed=true]{border-color:rgba(111,179,160,.6)}
.ng-toggle[aria-pressed=true] .ng-switch{background:#6fb3a0}
.ng-toggle[aria-pressed=true] .ng-switch::after{transform:translateX(11px)}
.ng-bar{position:fixed;left:50%;bottom:calc(18px + env(safe-area-inset-bottom));transform:translateX(-50%);display:flex;align-items:center;gap:10px;padding:5px;border-radius:13px;background:rgba(29,31,34,.5);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);max-width:calc(100vw - 24px);z-index:3}
.ng-group{display:flex;gap:6px;align-items:center}
.ng-toggles{padding-left:10px;border-left:1px solid rgba(255,255,255,.2)}
.ng-help{position:fixed;left:50%;bottom:calc(var(--ng-bar,46px) + 30px + env(safe-area-inset-bottom));transform:translateX(-50%);padding:6px 12px;border-radius:8px;background:rgba(29,31,34,.7);color:#d9d6cf;font-size:12px;white-space:nowrap;z-index:3;pointer-events:none}
.ng-loading{position:fixed;inset:0;z-index:8;display:grid;place-items:center;background:#1d1f22;transition:opacity .35s}
.ng-loading.ng-done{opacity:0;pointer-events:none}
.ng-load-card{display:flex;flex-direction:column;align-items:center;gap:10px;padding:16px;text-align:center;max-width:86vw}
.ng-load-card strong{font-size:16px}
.ng-load-text{font-size:13px;color:#d9d6cf}
.ng-error .ng-load-text{color:#f0b3a8}.ng-error .ng-steps,.ng-error svg{display:none}
.ng-art{width:132px;height:99px;overflow:visible}
.ng-plan-line{fill:none;stroke:#6fb3a0;stroke-width:1.6;stroke-linejoin:round;stroke-linecap:round;stroke-dasharray:240;stroke-dashoffset:240;animation:ng-draw 2.4s ease infinite}
.ng-plan-inner{stroke-width:1.1;opacity:.7;animation-delay:.25s}
.ng-wall{fill:rgba(111,179,160,.18);stroke:#6fb3a0;stroke-width:1;stroke-linejoin:round;transform-box:fill-box;transform-origin:50% 100%;transform:scaleY(0);opacity:0;animation:ng-rise 2.4s ease infinite}
.ng-w2{animation-delay:.12s}.ng-w3{animation-delay:.24s}
.ng-steps{display:flex;gap:6px;margin:0;padding:0;list-style:none}
.ng-steps li{position:relative;width:28px;height:4px;overflow:hidden;border-radius:2px;background:rgba(255,255,255,.16)}
.ng-steps li.done{background:#6fb3a0}
.ng-steps li.now::after{content:"";position:absolute;inset:0;width:60%;border-radius:2px;background:#6fb3a0;animation:ng-slide 1.1s ease-in-out infinite}
@keyframes ng-draw{0%{stroke-dashoffset:240}45%,80%{stroke-dashoffset:0;opacity:1}100%{stroke-dashoffset:0;opacity:0}}
@keyframes ng-rise{0%,35%{transform:scaleY(0);opacity:0}60%,80%{transform:scaleY(1);opacity:1}100%{transform:scaleY(1);opacity:0}}
@keyframes ng-slide{from{transform:translateX(-100%)}to{transform:translateX(170%)}}
@media (prefers-reduced-motion:reduce){.ng-plan-line,.ng-wall,.ng-steps li.now::after{animation:none;stroke-dashoffset:0;transform:none;opacity:1}}
.ng-stick,.ng-look,.ng-updown{display:none}
@media (pointer:coarse){
 .ng-walking .ng-stick{display:block;position:fixed;left:calc(24px + env(safe-area-inset-left));bottom:calc(120px + env(safe-area-inset-bottom));width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.25);touch-action:none}
 .ng-knob{position:absolute;left:38px;top:38px;width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.75)}
 .ng-walking .ng-look{display:block;position:fixed;right:0;top:120px;bottom:130px;width:50%;touch-action:none}
 .ng-flying .ng-updown{display:flex;flex-direction:column;gap:12px;position:fixed;right:calc(20px + env(safe-area-inset-right));bottom:calc(140px + env(safe-area-inset-bottom));z-index:4}
 .ng-updown .ng-btn{width:54px;height:54px;padding:0;font-size:18px;touch-action:none}
}
.ng-callouts,.ng-rooms{position:fixed;inset:0;pointer-events:none;overflow:hidden}
.ng-marks{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.ng-room{position:absolute;left:0;top:0;display:flex;flex-direction:column;align-items:center;padding:3px 8px;border-radius:7px;background:rgba(29,31,34,.72);white-space:nowrap;will-change:transform}
.ng-room strong{font-size:12px;font-weight:600}.ng-room span{font-size:11px;color:#c9c5bd}
.ng-callout{position:absolute;left:0;top:0;visibility:hidden;will-change:transform;max-width:260px;width:max-content;padding:7px 10px 7px 13px;border:1px solid var(--border);border-radius:6px;background:var(--fill);color:var(--text);font-family:${FONT};line-height:1.38;box-shadow:0 2px 10px rgba(0,0,0,.18);pointer-events:auto;background-clip:padding-box;border-left:4px solid var(--main)}
.ng-box-solid,.ng-box-outline{border-left:1px solid var(--border);padding-left:10px}
.ng-box-text{border:0;box-shadow:none;padding:2px 4px;text-shadow:0 0 2px #fff,0 0 2px #fff,0 0 3px #fff}
.ng-cl-title{font-weight:650}.ng-cl-info{color:var(--info);font-size:.92em}.ng-callout a{color:var(--link)}
.ng-plan{position:fixed;inset:0;display:none;background:#f4f3ef;z-index:2;cursor:grab;touch-action:none}
.ng-plan.open{display:block}.ng-plan.drag{cursor:grabbing}
.ng-plan svg{position:absolute;inset:0;width:100%;height:100%;user-select:none;-webkit-user-select:none}
.ng-plan-hint{position:fixed;left:50%;bottom:calc(var(--ng-bar,46px) + 30px + env(safe-area-inset-bottom));transform:translateX(-50%);padding:6px 12px;border-radius:8px;background:rgba(29,31,34,.78);color:#f2efe9;font-size:12px;white-space:nowrap;pointer-events:none}
.ng-plan-mode .ng-help{display:none}
.ng-intro{position:fixed;inset:0;display:grid;place-items:center;background:rgba(15,16,18,.55);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);z-index:5;padding:16px}
.ng-intro-card{max-width:520px;width:100%;max-height:calc(100vh - 32px);overflow:auto;padding:24px 26px;border-radius:16px;background:#24272b;box-shadow:0 10px 40px rgba(0,0,0,.4);display:flex;flex-direction:column;gap:12px;box-sizing:border-box}
.ng-intro-card h1{margin:0;font-size:22px;line-height:1.2}
.ng-intro-sub{margin:0;color:#b0ada7}
.ng-intro-text{margin:0;white-space:pre-line;line-height:1.55;color:#e4e1da}
.ng-intro-card .ng-btn{align-self:flex-start;padding:10px 18px}
@media (max-width:640px){
 .ng-hud{flex-direction:column;flex-wrap:nowrap;gap:6px}
 .ng-side{max-width:100%}
 .ng-title{padding:7px 12px}.ng-title strong{font-size:14px}.ng-title span{font-size:11px}
 .ng-views{max-width:100%;flex-wrap:nowrap;overflow-x:auto;justify-content:flex-start;scrollbar-width:none;-webkit-overflow-scrolling:touch}
 .ng-views::-webkit-scrollbar,.ng-bar::-webkit-scrollbar{display:none}
 .ng-bar{left:8px;right:8px;transform:none;max-width:none;flex-wrap:wrap;justify-content:center;gap:6px;bottom:calc(8px + env(safe-area-inset-bottom))}
 .ng-group{display:contents}
 .ng-btn{padding:9px 10px}
 .ng-toggle{gap:6px}
 .ng-panel{position:fixed;left:8px;right:8px;bottom:calc(var(--ng-bar,56px) + 16px + env(safe-area-inset-bottom));max-height:48vh;z-index:4;box-shadow:0 -6px 24px rgba(0,0,0,.3)}
 .ng-help,.ng-plan-hint{white-space:normal;width:86vw;text-align:center;font-size:11px;bottom:calc(var(--ng-bar,56px) + 16px + env(safe-area-inset-bottom))}
 .ng-walking .ng-stick,.ng-flying .ng-updown{bottom:calc(var(--ng-bar,56px) + 60px + env(safe-area-inset-bottom))}
 .ng-callout{max-width:200px}
}
`;

const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** Visible callouts as plain data for the guest viewer (no app code runs there). */
function guestCallouts(project: Project, derived: ReturnType<typeof derivePlan>): GuestCallout[] {
  return visibleCallouts(project).flatMap((c) => {
    const pts = callout3DPoints(project, derived, c, project.render.notePlacement);
    if (!pts) return [];
    return [
      {
        anchor: [r3(pts.anchor.x), r3(pts.anchor.y), r3(pts.anchor.z)],
        label: [r3(pts.label.x), r3(pts.label.y), r3(pts.label.z)],
        outline: c.highlight ? pts.outline?.map((p) => [r3(p.x), r3(p.y)] as [number, number]) : undefined,
        outlineY: pts.outlineY,
        colors: (() => {
          const k = labelColors(c);
          return { main: k.main, fill: k.fill ?? 'transparent', border: k.stroke ?? 'transparent', text: k.text, info: k.info, link: k.link };
        })(),
        style: { box: c.box, scale: NOTE_SIZE_SCALE[c.size], line: c.line, lineWidth: NOTE_LINE_WIDTH[c.lineWeight] * 1.15, dash: leaderDash(c), end: c.end, endPx: endPx(c) },
        lines: calloutLines(project, derived, c).map((l) => ({
          role: l.role,
          indent: l.indent,
          runs: l.runs.map((r) => ({ t: r.text, ...(r.bold ? { b: 1 as const } : {}), ...(r.italic ? { i: 1 as const } : {}), ...(r.href ? { h: r.href } : {}) })),
        })),
      },
    ];
  });
}

/** Lamp lights of the included items, tagged with their item layer. */
function guestLamps(project: Project): GuestLamp[] {
  const out: GuestLamp[] = [];
  for (const o of Object.values(project.objects)) {
    if (o.hidden || (!project.guest.hiddenItems && isObjectHidden(project, o))) continue;
    const layer = guestLayerId(project, o);
    for (const l of resolveObjectLights(o, getAsset(project, o.assetId)))
      out.push({ kind: l.kind, color: l.color, intensity: l.intensity, distance: l.distance, p: l.position.map(r3) as [number, number, number], dir: l.dir, angle: l.angle, penumbra: l.penumbra, layer });
  }
  return out;
}

const toCamera = (v: { projection: 'perspective' | 'orthographic'; position: [number, number, number]; target: [number, number, number]; fov: number }, name: string): GuestCamera => ({
  name,
  projection: v.projection,
  position: v.position,
  target: v.target,
  fov: v.fov,
});

/** The GLB settings that change the embedded model (everything else is cheap to rebuild). */
function glbKey(project: Project): unknown[] {
  const g = project.guest;
  return [project.nodes, project.walls, project.openings, project.rooms, project.objects, project.materials, project.customAssets, project.itemLayers, project.layers, project.settings, g.cutawayHeight, g.textureSize, g.surfaceDetail, g.hiddenItems];
}

/** Gzips the model (geometry shrinks about 3×); the viewer unpacks it with the browser's DecompressionStream. */
async function gzip(buf: ArrayBuffer): Promise<{ data: ArrayBuffer; gzip: boolean }> {
  if (typeof CompressionStream === 'undefined') return { data: buf, gzip: false };
  const data = await new Response(new Response(buf).body!.pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
  return { data, gzip: true };
}

type EmbeddedGlb = { b64: string; gzip: boolean };

/** The last embedded model, so the size estimate and the download build it once. */
let glbCache: { key: unknown[]; glb: Promise<EmbeddedGlb> } | null = null;

function guestGlb(project: Project): Promise<EmbeddedGlb> {
  const key = glbKey(project);
  if (glbCache && glbCache.key.length === key.length && glbCache.key.every((k, i) => k === key[i])) return glbCache.glb;
  const g = project.guest;
  const glb = exportGlb(project, { ceilings: true, furniture: true, cutaway: g.cutawayHeight, textureSize: g.textureSize, surfaceDetail: g.surfaceDetail, hiddenLayers: g.hiddenItems })
    .then(gzip)
    .then((z) => ({ b64: bufferToBase64(z.data), gzip: z.gzip }));
  glbCache = { key, glb };
  glb.catch(() => {
    if (glbCache?.glb === glb) glbCache = null;
  });
  return glb;
}

/** Everything the viewer needs, as plain data (no app code runs in the exported file). */
export async function buildGuestData(source: Project): Promise<GuestData> {
  const project = guestSceneProject(source);
  const g = project.guest;
  const r = project.render;
  const u = project.settings;
  const derived = derivePlan(project);
  const glb = await guestGlb(source);
  const home = namedView('home', derived.bounds);
  const included = guestViews(project);
  const cameras: GuestCamera[] = [
    ...included.map((c) => toCamera(c, c.name)),
    ...guestAutoViews(project).map((n) => (n === 'Overview' ? toCamera(home, n) : toCamera(namedView('top', derived.bounds), n))),
  ];
  const startPreset = project.cameras.find((c) => c.id === g.startCameraId);
  const startView = startPreset ? toCamera(startPreset, startPreset.name) : toCamera(home, 'Overview');
  const start = startPreset ? included.indexOf(startPreset) : cameras.findIndex((c, i) => i >= included.length && c.name === 'Overview');
  const spawn = defaultSpawn(project, derived.faces);
  const sun = sunFromSettings(r);
  const ov = planOverview(project, derived);
  const budget = (q: GuestQuality) => {
    const b = LAMP_BUDGET[q === 'fast' ? 'draft' : q];
    return { point: b.point, spot: b.spot, shadows: b.shadows };
  };
  return {
    title: guestTitle(project),
    subtitle: guestSubtitle(project),
    intro: g.intro ? g.welcome.trim() : null,
    exportedAt: new Date().toISOString(),
    glb: glb.b64,
    ...(glb.gzip ? { glbEncoding: 'gzip' as const } : {}),
    cameras,
    start,
    startView,
    startMode: g.startMode,
    spawn: { x: spawn.p.x, y: spawn.p.y, angle: spawn.angle },
    walk: { speed: g.walkSpeed, eye: g.eyeHeight, fov: r.walkFov },
    colliders: buildColliders(project, derived.network).map((c) => [c.a.x, c.a.y, c.b.x, c.b.y].map(r3) as [number, number, number, number]),
    bounds: derived.bounds ?? { minX: -5, minY: -5, maxX: 5, maxY: 5 },
    background: r.background,
    sun: { dir: [sun.dir.x, sun.dir.y, sun.dir.z], color: `#${sun.color.getHexString()}`, intensity: sun.intensity },
    envIntensity: r.envIntensity,
    exposure: r.exposure,
    quality: g.quality,
    shadows: g.shadows,
    cutaway: g.cutawayHeight,
    cutawayOn: g.wallDisplay === 'cutaway',
    ceilingsOn: g.ceilings,
    lamps: guestLamps(project),
    lampBudgets: { fast: budget('fast'), balanced: budget('balanced'), high: budget('high') },
    layers: guestLayers(project),
    callouts: g.notes === 'off' ? [] : guestCallouts(project, derived),
    notesHidden: g.notes === 'hidden',
    notePlacement: r.notePlacement,
    wallTop: Math.max(0, ...Object.values(project.walls).map((w) => (w.baseElevation ?? 0) + w.height)),
    rooms: derived.faces.map((f, i) => ({ name: derived.faceRooms[i]?.name ?? 'Room', area: formatArea(f.area, u.areaUnit, u.precision), p: [r3(f.label.x), 1.2, r3(f.label.y)] })),
    roomsOn: g.roomLabels,
    info:
      g.info === 'off'
        ? null
        : {
            open: g.info === 'open',
            stats: [
              ['Rooms', String(derived.faces.length)],
              ['Floor area', formatArea(ov.floorArea, u.areaUnit, u.precision)],
              ['Items', String(ov.items)],
              ['Doors', String(ov.doors)],
              ['Windows', String(ov.windows)],
              ['Wall length', formatLength(ov.wallLength, u.units, 1)],
            ],
            size: ov.shell ? `${formatLength(ov.shell.maxX - ov.shell.minX, u.units, 2)} × ${formatLength(ov.shell.maxY - ov.shell.minY, u.units, 2)}` : undefined,
            rooms: ov.rooms.map((rm) => [rm.name, formatArea(rm.area, u.areaUnit, 1)]),
          },
    plan: g.floorPlan ? buildPlanImageSvg(project, { pixelsPerMetre: 60, mode: 'furnished', transparent: false, annotations: true, furniture: true, callouts: false }).svg : null,
    tour: { seconds: g.tourSeconds, auto: g.tour },
  };
}

/**
 * Builds a single self-contained HTML file: the viewer runtime (three.js
 * included), the scene as an embedded GLB (textures inside), cameras, spawn
 * point, colliders, lamp lights, notes, room labels, the overview numbers and
 * the floor plan drawing. It references no external files, fonts, blob URLs
 * or browser storage.
 */
export async function buildGuestHtml(project: Project): Promise<string> {
  const data = await buildGuestData(project);
  const { default: runtime } = await import('@/generated/guest-viewer.js?raw');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="generator" content="Neest">
<title>${escHtml(data.title)} — 3D walkthrough</title>
<style>${CSS}</style>
</head>
<body>
<div id="neest-guest"></div>
<div id="ng-loading" class="ng-loading" role="status" aria-live="polite"><div class="ng-load-card">${LOADING_ART}<strong>${escHtml(data.title)}</strong><span class="ng-load-text">Opening the file…</span><ol class="ng-steps"><li class="now"></li><li></li><li></li><li></li></ol></div></div>
<noscript>This walkthrough needs JavaScript and WebGL.</noscript>
<script>window.NEEST_GUEST_DATA = ${safeScript(JSON.stringify(data))};</script>
<script>${safeScript(runtime)}</script>
</body>
</html>`;
}

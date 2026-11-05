import type { Project } from '@/domain/model/schema';
import { derivePlan } from '@/domain/geometry/derive';
import { planOverview } from '@/domain/geometry/overview';
import { formatArea, formatLength } from '@/domain/model/units';
import { guestLayerId, guestLayers, guestOptions, guestSceneProject, guestSubtitle, guestTitle } from '@/domain/walkthrough/guest';
import { isObjectHidden } from '@/domain/commands/itemLayers';
import { getAsset } from '@/data/assets/registry';
import { LAMP_BUDGET, resolveObjectLights } from '@/data/assets/lights';
import { namedView } from '@/features/scene-3d/cameraViews';
import { sunFromSettings } from '@/features/scene-3d/SceneContent';
import type { GuestCallout, GuestCamera, GuestData, GuestLamp, GuestNote, GuestOption, GuestQuality, GuestRun } from '@/guest-viewer/main';
import { callout3DPoints } from '@/features/callouts/Callouts3D';
import { calloutInfo, calloutLines, noteHeading, noteTargetLabel, parseNote, type Run } from '@/features/callouts/content';
import { NOTE_LINE_WIDTH, NOTE_SIZE_SCALE, endPx, labelColors, leaderDash } from '@/features/callouts/style';
import { buildPlanImageSvg } from './planExports';
import { exportOptionsGlb } from './sceneExport';

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
.ng-btn{border:1px solid rgba(255,255,255,.14);background:rgba(29,31,34,.82);color:#f2efe9;border-radius:9px;padding:8px 12px;font:inherit;cursor:pointer;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);white-space:nowrap}
.ng-btn:hover{background:rgba(52,55,60,.9)}
.ng-btn:focus-visible{outline:2px solid #a3cfc1;outline-offset:1px}
.ng-primary{background:#6fb3a0;color:#0f2a26;border-color:transparent;font-weight:600}
.ng-primary:hover{background:#a3cfc1}
.ng-view-pick{position:relative;display:inline-flex;align-items:center;color:#0f2a26}
.ng-view-pick .ng-ico{position:absolute;left:10px;pointer-events:none}
.ng-view-select{-webkit-appearance:none;appearance:none;border:0;border-radius:9px;background:#6fb3a0;color:#0f2a26;font:inherit;font-weight:600;padding:8px 26px 8px 32px;cursor:pointer;white-space:nowrap}
.ng-view-select:hover{background:#82c2b0}
.ng-view-select:focus-visible{outline:2px solid #f2efe9;outline-offset:1px}
.ng-view-select option{background:#26292d;color:#f2efe9;font-weight:400}
.ng-view-caret{position:absolute;right:9px;top:50%;transform:translateY(-50%);font-size:12px;pointer-events:none}
.ng-toggle,.ng-pbtn,.ng-primary{display:inline-flex;align-items:center;gap:7px}
.ng-ico{width:16px;height:16px;flex:none;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.ng-pbtn.on{background:rgba(111,179,160,.24);border-color:rgba(111,179,160,.65)}
.ng-switch{position:relative;flex:none;width:26px;height:15px;border-radius:8px;background:rgba(255,255,255,.22);transition:background .15s}
.ng-switch::after{content:"";position:absolute;left:2px;top:2px;width:11px;height:11px;border-radius:50%;background:#f2efe9;transition:transform .15s}
.ng-toggle[aria-pressed=true]{border-color:rgba(111,179,160,.6)}
[aria-pressed=true]>.ng-switch{background:#6fb3a0}
[aria-pressed=true]>.ng-switch::after{transform:translateX(11px)}
.ng-note-modes{margin:4px 0 10px}
.ng-bar{position:fixed;left:50%;bottom:calc(18px + env(safe-area-inset-bottom));transform:translateX(-50%);display:flex;align-items:center;gap:10px;padding:5px;border-radius:13px;background:rgba(29,31,34,.5);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);max-width:calc(100vw - 24px);z-index:3}
.ng-group{display:flex;gap:6px;align-items:center}
.ng-group:empty{display:none}
.ng-group:not(:empty)~.ng-group:not(:empty){padding-left:10px;border-left:1px solid rgba(255,255,255,.2)}
.ng-hud,.ng-bar,.ng-help{transition:opacity .25s}
.ng-help.ng-faded{opacity:0}
.ng-immersive .ng-hud,.ng-immersive .ng-bar,.ng-immersive .ng-help,.ng-immersive .ng-panel{opacity:0;pointer-events:none!important}
.ng-immersive .ng-hud *,.ng-immersive .ng-bar *{pointer-events:none!important}
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
.ng-callouts,.ng-rooms{position:fixed;inset:0;pointer-events:none;overflow:hidden}
.ng-marks{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.ng-room{position:absolute;left:0;top:0;display:flex;flex-direction:column;align-items:center;padding:3px 8px;border-radius:7px;background:rgba(29,31,34,.72);white-space:nowrap;will-change:transform}
.ng-room strong{font-size:12px;font-weight:600}.ng-room span{font-size:11px;color:#c9c5bd}
.ng-callout{position:absolute;left:0;top:0;visibility:hidden;will-change:transform;max-width:260px;width:max-content;padding:7px 10px 7px 13px;border:1px solid var(--border);border-radius:6px;background:var(--fill);color:var(--text);font-family:${FONT};line-height:1.38;box-shadow:0 2px 10px rgba(0,0,0,.18);pointer-events:auto;background-clip:padding-box;border-left:4px solid var(--main)}
.ng-box-solid,.ng-box-outline{border-left:1px solid var(--border);padding-left:10px}
.ng-box-text{border:0;box-shadow:none;padding:2px 4px;text-shadow:0 0 2px #fff,0 0 2px #fff,0 0 3px #fff}
.ng-cl-title{font-weight:650}.ng-cl-info{color:var(--info);font-size:.92em}.ng-callout a{color:var(--link)}
.ng-callout.ng-compact{max-width:200px;font-weight:600}
.ng-callout.ng-compact>*{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ng-callout.ng-compact>*+*{display:none}
.ng-callout{z-index:2}
.ng-pin{z-index:1;position:absolute;left:0;top:0;visibility:hidden;width:26px;height:26px;margin:-34px 0 0 -13px;padding:0;display:grid;place-items:center;border:2px solid #fff;border-radius:50%;background:var(--main);color:#fff;box-shadow:0 2px 8px rgba(0,0,0,.28);cursor:pointer;pointer-events:auto}
.ng-pin::after{content:"";position:absolute;left:50%;top:100%;margin-left:-5px;border:5px solid transparent;border-top:7px solid #fff}
.ng-pin svg{width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round}
.ng-pin.open{outline:2px solid var(--main);outline-offset:2px}
.ng-callout.ng-flash{animation:ng-flash 1.6s ease}
@keyframes ng-flash{0%,40%{box-shadow:0 0 0 4px var(--main),0 2px 10px rgba(0,0,0,.18)}100%{box-shadow:0 2px 10px rgba(0,0,0,.18)}}
.ng-opts{display:flex;align-items:center;gap:4px;padding:4px;border-radius:12px;background:rgba(29,31,34,.82);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);pointer-events:auto;cursor:pointer}
.ng-opts-label{color:#b0ada7;font-size:11px;text-transform:uppercase;letter-spacing:.04em;padding:0 6px 0 8px;flex:none}
.ng-opts-wrap{position:relative;flex:1;min-width:0;display:flex}
.ng-opts-select{-webkit-appearance:none;appearance:none;flex:1;min-width:0;max-width:100%;border:0;border-radius:9px;background:#6fb3a0;color:#0f2a26;font:inherit;font-weight:600;padding:6px 30px 6px 12px;cursor:pointer;text-overflow:ellipsis;white-space:nowrap;overflow:hidden}
.ng-opts-select:hover{background:#82c2b0}
.ng-opts-select:focus-visible{outline:2px solid #a3cfc1;outline-offset:1px}
.ng-opts-select option{background:#26292d;color:#f2efe9;font-weight:400}
.ng-opts-caret{position:absolute;right:10px;top:50%;transform:translateY(-50%);color:#0f2a26;font-size:12px;pointer-events:none}
.ng-side{max-height:calc(100vh - var(--ng-bar,46px) - 50px - env(safe-area-inset-top) - env(safe-area-inset-bottom))}
.ng-side>*{flex:none}.ng-side>.ng-panel{flex:0 1 auto;min-height:0}
.ng-note-list{display:flex;flex-direction:column;gap:8px}
.ng-note{padding:8px 10px 8px 11px;border-radius:8px;background:rgba(255,255,255,.06);border-left:4px solid var(--main);line-height:1.45}
.ng-note-head{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:3px}
.ng-note-target{font-size:11px;color:#b0ada7;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ng-note-go{border:1px solid rgba(255,255,255,.18);background:transparent;color:#d9d6cf;border-radius:6px;padding:2px 8px;font:inherit;font-size:11px;cursor:pointer;flex:none}
.ng-note-go:hover{background:rgba(255,255,255,.1)}
.ng-note-title{font-weight:650}.ng-note-info{color:#b0ada7;font-size:12px}
.ng-note p{margin:4px 0}.ng-note ul,.ng-note ol{margin:4px 0;padding-left:20px}
.ng-note a{color:#a3cfc1}
.ng-note-imgs{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
.ng-note-img{width:64px;height:64px;padding:0;border:1px solid rgba(255,255,255,.18);border-radius:6px;overflow:hidden;background:#111;cursor:zoom-in}
.ng-note-img img{width:100%;height:100%;object-fit:cover;display:block}
.ng-empty{margin:0;color:#b0ada7}
.ng-lightbox{position:fixed;inset:0;z-index:9;display:none;place-items:center;background:rgba(10,11,12,.88);--lb-px:64px;--lb-py:48px}
.ng-lightbox.open{display:grid}
.ng-lightbox img{max-width:calc(100vw - 2*var(--lb-px));max-height:calc(100vh - 2*var(--lb-py));width:auto;height:auto;object-fit:contain;border-radius:6px;box-shadow:0 10px 40px rgba(0,0,0,.5)}
.ng-lightbox .ng-btn{position:fixed;font-size:20px;line-height:1;padding:8px 13px}
.ng-lb-close{top:calc(14px + env(safe-area-inset-top));right:calc(14px + env(safe-area-inset-right))}
.ng-lb-prev,.ng-lb-next{top:50%;transform:translateY(-50%);display:none}
.ng-lb-prev{left:12px}.ng-lb-next{right:12px}
.ng-lb-many .ng-lb-prev,.ng-lb-many .ng-lb-next{display:block}
.ng-lb-count{position:fixed;bottom:calc(16px + env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);color:#d9d6cf;font-size:12px}
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
/* Phones, upright or on their side: a slim title, an icon-only bar in one row, panels one at a time. */
@media (max-width:640px),(max-height:500px){
 .ng-bar{max-width:calc(100vw - 16px);flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;gap:4px;padding:4px;bottom:calc(10px + env(safe-area-inset-bottom));background:rgba(29,31,34,.62)}
 .ng-group{gap:4px}
 .ng-group:not(:empty)~.ng-group:not(:empty){padding-left:4px}
 .ng-btn{padding:9px 10px}
 .ng-bar .ng-lbl,.ng-bar .ng-switch{display:none}
 .ng-bar .ng-toggle,.ng-bar .ng-pbtn{min-width:40px;justify-content:center;padding:9px}
 .ng-bar .ng-toggle[aria-pressed=true]{background:rgba(111,179,160,.3)}
 .ng-bar .ng-ico{width:18px;height:18px}
 .ng-bar .ng-view-pick .ng-ico{left:8px;width:16px;height:16px}
 .ng-view-select{padding:9px 24px 9px 30px}
 .ng-view-caret{right:8px}
 .ng-title{padding:6px 12px}.ng-title strong{font-size:14px}.ng-title span{display:none}
 .ng-opts-label{display:none}
 .ng-bar::-webkit-scrollbar{display:none}
 .ng-callout{max-width:200px}
 .ng-lightbox{--lb-px:12px;--lb-py:56px}
}
@supports (-webkit-touch-callout:none){.ng-opts-select,.ng-view-select{font-size:16px}}
/* Phones on their side: slim top row, side panels as tall as the screen allows. */
@media (max-height:500px) and (min-width:641px){
 .ng-hud{top:calc(8px + env(safe-area-inset-top))}
 .ng-side{max-width:300px}
 .ng-panel{max-height:none;padding:8px 12px}
 .ng-help,.ng-plan-hint{font-size:11px;bottom:calc(var(--ng-bar,46px) + 18px + env(safe-area-inset-bottom))}
 .ng-intro-card{max-height:calc(100vh - 24px);padding:16px 20px}
 .ng-intro-card h1{font-size:18px}
}
@media (max-width:640px){
 .ng-hud{flex-direction:column;flex-wrap:nowrap;gap:6px}
 .ng-side{max-width:100%;flex-direction:row;flex-wrap:wrap;align-items:center;gap:6px}
 .ng-side .ng-btn{padding:7px 10px}
 .ng-bar::-webkit-scrollbar{display:none}
 .ng-panel{position:fixed;left:8px;right:8px;bottom:calc(var(--ng-bar,56px) + 16px + env(safe-area-inset-bottom));max-height:48vh;z-index:4;box-shadow:0 -6px 24px rgba(0,0,0,.3)}
 .ng-help,.ng-plan-hint{white-space:normal;width:86vw;text-align:center;font-size:11px;bottom:calc(var(--ng-bar,56px) + 16px + env(safe-area-inset-bottom))}
 .ng-callout{max-width:200px}
 .ng-lightbox{--lb-px:12px;--lb-py:56px}
}
`;

const r3 = (v: number) => Math.round(v * 1000) / 1000;

const toRuns = (runs: Run[]): GuestRun[] =>
  runs.map((r) => ({ t: r.text, ...(r.bold ? { b: 1 as const } : {}), ...(r.italic ? { i: 1 as const } : {}), ...(r.href ? { h: r.href } : {}) }));

/**
 * Visible notes as plain data for the guest viewer (no app code runs there): the floating labels (notes
 * with a place in the scene) and the Notes list (every note, its full text and, when `images`, its pictures).
 */
function guestNotes(project: Project, derived: ReturnType<typeof derivePlan>, images: boolean): { callouts: GuestCallout[]; notes: GuestNote[] } {
  const callouts: GuestCallout[] = [];
  const notes: GuestNote[] = [];
  // The guest Notes setting decides, not the editor's Notes layer (a working view); notes hidden one by one stay out.
  for (const c of Object.values(project.callouts ?? {}).filter((x) => !x.hidden)) {
    const pts = callout3DPoints(project, derived, c, project.render.notePlacement);
    const info = c.showInfo ? calloutInfo(project, derived, c) : [];
    const heading = noteHeading(c, info);
    notes.push({
      label: pts ? callouts.length : -1,
      color: labelColors(c).main,
      // With the facts shown, the name or size is already in the note: the chip says what kind it is.
      target: info.length || heading ? (({ object: 'Item', room: 'Room', region: 'Area' }) as Record<string, string>)[c.target.kind] ?? noteTargetLabel(project, c) : noteTargetLabel(project, c),
      ...(heading ? { heading } : {}),
      info,
      blocks: parseNote(c.note).map((b) => ({ k: b.kind === 'bullet' ? ('b' as const) : b.kind === 'number' ? ('n' as const) : ('p' as const), ...(b.n !== undefined ? { n: b.n } : {}), runs: toRuns(b.runs) })),
      images: images ? c.images.map((im) => ({ src: im.src, w: im.w, h: im.h })) : [],
      ...(pts ? { at: [r3(pts.anchor.x), r3(pts.anchor.y), r3(pts.anchor.z)] as [number, number, number] } : {}),
    });
    if (!pts) continue;
    callouts.push(
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
        lines: calloutLines(project, derived, c).map((l) => ({ role: l.role, indent: l.indent, runs: toRuns(l.runs) })),
      },
    );
  }
  return { callouts, notes };
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
  const shownOptionIds = guestOptions(project).options.map((o) => o.id).join(',');
  return [project.nodes, project.walls, project.openings, project.rooms, project.objects, project.materials, project.customAssets, project.itemLayers, project.layers, project.settings, project.options, project.activeOptionId, shownOptionIds, g.cutawayHeight, g.textureSize, g.surfaceDetail, g.hiddenItems];
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
  const projects = guestOptions(project).options.map((o) => o.project);
  const glb = exportOptionsGlb(projects, { ceilings: true, furniture: true, cutaway: g.cutawayHeight, textureSize: g.textureSize, surfaceDetail: g.surfaceDetail, hiddenLayers: g.hiddenItems })
    .then(gzip)
    .then((z) => ({ b64: bufferToBase64(z.data), gzip: z.gzip }));
  glbCache = { key, glb };
  glb.catch(() => {
    if (glbCache?.glb === glb) glbCache = null;
  });
  return glb;
}

/** One layout option's plan as viewer data: lamps, notes, labels, numbers and the plan drawing. */
function guestOption(name: string, source: Project): GuestOption {
  const project = guestSceneProject(source);
  const g = project.guest;
  const u = project.settings;
  const derived = derivePlan(project);
  const ov = planOverview(project, derived);
  const notes = g.notes === 'off' ? { callouts: [], notes: [] } : guestNotes(project, derived, g.noteImages);
  return {
    name,
    bounds: derived.bounds ?? { minX: -5, minY: -5, maxX: 5, maxY: 5 },
    lamps: guestLamps(project),
    layers: guestLayers(project),
    callouts: notes.callouts,
    notes: notes.notes,
    wallTop: Math.max(0, ...Object.values(project.walls).map((w) => (w.baseElevation ?? 0) + w.height)),
    rooms: derived.faces.map((f, i) => ({ name: derived.faceRooms[i]?.name ?? 'Room', area: formatArea(f.area, u.areaUnit, u.precision), p: [r3(f.label.x), 1.2, r3(f.label.y)] })),
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
  };
}

/** Everything the viewer needs, as plain data (no app code runs in the exported file). */
export async function buildGuestData(source: Project): Promise<GuestData> {
  const project = guestSceneProject(source);
  const g = project.guest;
  const r = project.render;
  const glb = await guestGlb(source);
  const sun = sunFromSettings(r);
  const budget = (q: GuestQuality) => {
    const b = LAMP_BUDGET[q === 'fast' ? 'draft' : q];
    return { point: b.point, spot: b.spot, shadows: b.shadows };
  };
  const opts = guestOptions(source);
  const options = opts.options.map((o) => guestOption(o.name, o.project));
  // The sun's shadow area and built-in views cover every included option's plan.
  const bounds = options.reduce(
    (a, o) => ({ minX: Math.min(a.minX, o.bounds.minX), minY: Math.min(a.minY, o.bounds.minY), maxX: Math.max(a.maxX, o.bounds.maxX), maxY: Math.max(a.maxY, o.bounds.maxY) }),
    options[opts.start].bounds,
  );
  const cameras: GuestCamera[] = [
    toCamera(namedView('home', bounds), 'Overview'),
    toCamera(namedView('top', bounds), 'Top'),
  ];
  const start = g.startCameraId === '__top__' ? 1 : 0;
  return {
    title: guestTitle(project),
    subtitle: guestSubtitle(project),
    intro: g.intro ? g.welcome.trim() : null,
    exportedAt: new Date().toISOString(),
    glb: glb.b64,
    ...(glb.gzip ? { glbEncoding: 'gzip' as const } : {}),
    cameras,
    start,
    bounds,
    background: r.background,
    sun: { dir: [sun.dir.x, sun.dir.y, sun.dir.z], color: `#${sun.color.getHexString()}`, intensity: sun.intensity },
    envIntensity: r.envIntensity,
    exposure: r.exposure,
    quality: g.quality,
    shadows: g.shadows,
    cutaway: g.cutawayHeight,
    cutawayOn: g.wallDisplay === 'cutaway',
    cutawayExternalOnly: g.cutawayExternalOnly,
    ceilingsOn: g.ceilings,
    lampBudgets: { fast: budget('fast'), balanced: budget('balanced'), high: budget('high') },
    notesHidden: g.notes === 'hidden',
    notePlacement: r.notePlacement,
    noteDisplay: g.noteDisplay,
    roomsOn: g.roomLabels,
    options,
    option: opts.start,
    tour: { seconds: g.tourSeconds, auto: g.tour },
  };
}

/**
 * Builds a single self-contained HTML file: the viewer runtime (three.js
 * included), the scene as an embedded GLB (textures inside, one group per
 * layout option), cameras, and for each option its lamp lights, notes (with
 * their pictures), room labels, overview numbers and floor plan drawing. It references no external files, fonts, blob URLs
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

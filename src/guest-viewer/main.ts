/**
 * Neest guest viewer runtime. Built as a standalone IIFE (vite.guest.config.ts)
 * and inlined into exported guest-view HTML files together with the scene
 * (GLB, base64) and view settings, so the file opens offline in any modern
 * browser without Neest, an account, or access to the creator's storage.
 *
 * Keep imports to small pure modules: everything here ends up in every exported file.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { attachTrackpadOrbit } from '@/features/scene-3d/trackpadOrbit';
import { wheelDelta } from '@/components/trackpad';
import {
  inView,
  placeNoteLabels,
  screenBounds,
  type LabelInput,
  type NotePlacement,
  type ScreenRect,
} from '@/features/callouts/placement';
import { arrowHead } from '@/features/callouts/style';

export interface GuestCamera {
  name: string;
  projection: 'perspective' | 'orthographic';
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}

/** A callout in the guest view: leader from `anchor` up to the label at `label` (three.js coordinates). */
export interface GuestCallout {
  anchor: [number, number, number];
  label: [number, number, number];
  /** Target outline on the floor (x, z pairs) and its height. */
  outline?: [number, number][];
  outlineY?: number;
  colors: { main: string; fill: string; border: string; text: string; info: string; link: string };
  /** Label look and text size factor, leader style, width and dashes (px), end mark and its size (px). */
  style: {
    box: 'card' | 'solid' | 'outline' | 'text';
    scale: number;
    line: 'solid' | 'dashed' | 'dotted' | 'none';
    lineWidth: number;
    dash: number[] | null;
    end: 'dot' | 'ring' | 'arrow' | 'none';
    endPx: number;
  };
  lines: {
    role: 'title' | 'info' | 'text';
    indent: number;
    runs: GuestRun[];
  }[];
}

/** A run of note text: bold, italic, a link. */
export type GuestRun = { t: string; b?: 1; i?: 1; h?: string };

/** A note in the Notes list: its full text (unwrapped) and pictures, and where it points. */
export interface GuestNote {
  /** Its floating label in the option's `callouts`, or -1 (a general note, no place in the scene). */
  label: number;
  color: string;
  /** What it points at: General, an item's or room's name, Area (size), Spot. */
  target: string;
  heading?: string;
  info: string[];
  /** Paragraphs, bullets and numbered items. */
  blocks: { k: 'p' | 'b' | 'n'; n?: number; runs: GuestRun[] }[];
  images: { src: string; w: number; h: number }[];
  /** The point it is pinned to (three.js coordinates). */
  at?: [number, number, number];
}

/** One layout option (phương án): everything that differs between options. Its model is GLB group `neestOption`. */
export interface GuestOption {
  name: string;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  lamps: GuestLamp[];
  layers: GuestItemLayer[];
  callouts: GuestCallout[];
  notes: GuestNote[];
  /** Top of the walls (for "clear of the walls" note placement). */
  wallTop: number;
  rooms: GuestRoomLabel[];
  /** Overview numbers (preformatted) and whether the panel starts open. */
  info: { open: boolean; stats: [string, string][]; size?: string; rooms: [string, string][] } | null;
  /** Floor plan drawing (SVG markup, viewBox in plan metres). */
  plan: string | null;
}

/** A room name label at `p` (three.js coordinates). */
export interface GuestRoomLabel {
  name: string;
  area: string;
  p: [number, number, number];
}

/** A lamp fixture's light (world space), as resolved by the app, and the item layer of its fixture. */
export interface GuestLamp {
  kind: 'point' | 'spot';
  color: string;
  intensity: number;
  distance: number;
  p: [number, number, number];
  dir: [number, number, number];
  angle: number;
  penumbra: number;
  layer?: string;
}

/** An item layer guests can show or hide ('' = Unassigned); the GLB groups its items under `userData.neestLayer`. */
export interface GuestItemLayer {
  id: string;
  name: string;
  color?: string;
  on: boolean;
}

export type GuestQuality = 'fast' | 'balanced' | 'high';
/** Notes floating in the view: full cards, one line each, or a pin on each spot that opens its card. */
export type NoteDisplay = 'full' | 'compact' | 'icon';
type NoteMode = NoteDisplay | 'off';
type LampBudget = { point: number; spot: number; shadows: number };

export interface GuestData {
  title: string;
  /** Line under the title. */
  subtitle?: string;
  /** Welcome card text; the card is shown when this is set (may be empty: title only). */
  intro?: string | null;
  exportedAt: string;
  /** The scene as base64 GLB, gzipped when `glbEncoding` says so. */
  glb: string;
  glbEncoding?: 'gzip';
  /** Built-in views, in order (Overview, Top). */
  cameras: GuestCamera[];
  /** Index of the opening view in `cameras`. */
  start: number;
  /** Every option's plan together (sun shadows, the orthographic views). */
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  background: string;
  sun: { dir: [number, number, number]; color: string; intensity: number };
  envIntensity: number;
  exposure: number;
  quality?: GuestQuality;
  shadows?: boolean;
  /** Height of the cutaway walls in the GLB, and whether orbiting starts with them. */
  cutaway?: number;
  cutawayOn?: boolean;
  cutawayExternalOnly?: boolean;
  ceilingsOn?: boolean;
  /** Live light pool sizes per quality (the fixtures nearest the view get them). */
  lampBudgets?: Record<GuestQuality, LampBudget>;
  /** Note labels start hidden (the guest can show them). */
  notesHidden?: boolean;
  /** Where note labels float (see placement.ts). */
  notePlacement?: NotePlacement;
  /** How notes float at first: full cards, one compact line, or pins that open the card (guests can change it). */
  noteDisplay?: NoteDisplay;
  roomsOn?: boolean;
  /** The layout options (at least one) and the one the file opens on. */
  options: GuestOption[];
  option?: number;
  /** Tour through the views: seconds per view and whether it starts by itself. */
  tour?: { seconds: number; auto: boolean };
}

declare global {
  interface Window {
    NEEST_GUEST_DATA?: GuestData;
  }
}

const QUALITY: Record<GuestQuality, { pixelRatio: number; sunMap: number }> = {
  fast: { pixelRatio: 1, sunMap: 1024 },
  balanced: { pixelRatio: 2, sunMap: 2048 },
  high: { pixelRatio: 2, sunMap: 4096 },
};

function b64ToBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

/** A labelled checkbox row. */
function check(
  label: string,
  on: boolean,
  onChange: (on: boolean) => void,
  swatch?: string,
): HTMLLabelElement {
  const row = el('label', 'ng-check');
  const box = el('input');
  box.type = 'checkbox';
  box.checked = on;
  box.onchange = () => onChange(box.checked);
  row.append(box);
  if (swatch) {
    const s = el('span', 'ng-swatch');
    s.style.background = swatch;
    row.append(s);
  }
  row.append(el('span', '', label));
  return row;
}

/** A small segmented choice. */
function segmented<T extends string>(
  options: [T, string][],
  value: T,
  onChange: (v: T) => void,
): HTMLDivElement {
  const box = el('div', 'ng-seg');
  const buttons = options.map(([v, label]) => {
    const btn = el('button', v === value ? 'on' : '', label);
    btn.type = 'button';
    btn.onclick = () => {
      buttons.forEach((x) => x.classList.toggle('on', x === btn));
      onChange(v);
    };
    box.append(btn);
    return btn;
  });
  return box;
}

/** Line icons for the bar (24 × 24, drawn with the text colour). */
const ICONS: Record<string, string> = {
  cube: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16zM3.27 6.96 12 12.01l8.73-5.05M12 22.08V12',
  tour: 'M6 4l14 8-14 8V4Z',
  full: 'M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3',
  notes: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2zM8 8h8M8 12h5',
  info: 'M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10zM12 16v-4M12 8h.01',
  view: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
};

function icon(name: string): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'ng-ico');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(SVG, 'path');
  p.setAttribute('d', ICONS[name] ?? '');
  svg.append(p);
  return svg;
}

/** A segmented choice that can also be set from outside (kept in step with another copy of it). */
function choice<T extends string>(options: [T, string][], value: T, onChange: (v: T) => void): { box: HTMLDivElement; set: (v: T) => void } {
  const box = el('div', 'ng-seg');
  const buttons = options.map(([v, label]) => {
    const btn = el('button', '', label);
    btn.type = 'button';
    btn.dataset.value = v;
    btn.onclick = () => onChange(v);
    box.append(btn);
    return btn;
  });
  const set = (v: T) => buttons.forEach((b) => b.classList.toggle('on', b.dataset.value === v));
  set(value);
  return { box, set };
}

/**
 * An on/off button: an icon, a label and a small switch (aria-pressed), for a state that is on or off
 * (tour, full screen). Buttons that open a panel are `panelBtn`s, never switches.
 */
function toggleEl(label: string, title?: string, ico?: string): { btn: HTMLButtonElement; set: (on: boolean) => void } {
  const btn = el('button', 'ng-btn ng-toggle');
  btn.type = 'button';
  if (ico) btn.append(icon(ico));
  btn.append(el('span', 'ng-lbl', label), el('span', 'ng-switch'));
  btn.title = title ?? label;
  btn.setAttribute('aria-label', label);
  const set = (on: boolean) => btn.setAttribute('aria-pressed', String(on));
  set(false);
  return { btn, set };
}

/** A button that opens a panel (Notes, Info, View): an icon and a label, lit while its panel is open. */
function panelBtn(label: string, ico: string): { btn: HTMLButtonElement; set: (open: boolean) => void } {
  const btn = el('button', 'ng-btn ng-pbtn');
  btn.type = 'button';
  btn.append(icon(ico), el('span', 'ng-lbl', label));
  btn.title = label;
  btn.setAttribute('aria-label', label);
  const set = (open: boolean) => {
    btn.setAttribute('aria-expanded', String(open));
    btn.classList.toggle('on', open);
  };
  set(false);
  return { btn, set };
}


/** Lets the browser paint (the loading screen) before a long synchronous step. Not rAF: it stalls in background tabs. */
const yieldToPaint = () => new Promise<void>((r) => setTimeout(r, 30));

const LOAD_STEPS = [
  'Opening the file',
  'Unpacking the model',
  'Building walls, rooms and furniture',
  'Preparing materials and light',
];

/**
 * The loading screen: the page's own copy (in the HTML, so it shows while the browser is still
 * reading the embedded model), or one made here. Steps advance the label and the step track.
 */
function loadingScreen(title: string) {
  let box = document.getElementById('ng-loading');
  if (!box) {
    box = el('div', 'ng-loading');
    box.id = 'ng-loading';
    box.innerHTML = `<div class="ng-load-card"><strong></strong><span class="ng-load-text"></span><ol class="ng-steps">${LOAD_STEPS.map(() => '<li></li>').join('')}</ol></div>`;
    box.querySelector('strong')!.textContent = title;
    document.body.append(box);
  }
  const text = box.querySelector('.ng-load-text');
  const items = [...box.querySelectorAll('.ng-steps li')];
  const step = (i: number) => {
    if (text) text.textContent = `${LOAD_STEPS[i]}…`;
    items.forEach((li, k) => (li.className = k < i ? 'done' : k === i ? 'now' : ''));
  };
  return {
    step,
    done: () => {
      box.classList.add('ng-done');
      setTimeout(() => box.remove(), 400);
    },
    fail: (msg: string) => {
      box.classList.add('ng-error');
      if (text) text.textContent = msg;
    },
  };
}

/** Phone-sized screens, upright (panels are sheets at the bottom) or on their side: panels open one at a time. */
const narrow = () => matchMedia('(max-width: 640px), (max-height: 500px)').matches;

const SVG = 'http://www.w3.org/2000/svg';

/** Note text runs (bold, italic, links that open in a new tab) appended to `parent`. */
function appendRuns(parent: HTMLElement, runs: GuestRun[]) {
  for (const r of runs) {
    const span: HTMLElement = r.h ? el('a') : el('span');
    span.textContent = r.t;
    if (r.b) span.style.fontWeight = '650';
    if (r.i) span.style.fontStyle = 'italic';
    if (r.h && span instanceof HTMLAnchorElement) {
      span.href = r.h;
      span.target = '_blank';
      span.rel = 'noopener noreferrer';
    }
    parent.append(span);
  }
}

function start(data: GuestData) {
  const root = document.getElementById('neest-guest') ?? document.body;
  let quality: GuestQuality = data.quality ?? 'balanced';
  let shadowsWanted = data.shadows !== false;
  const shadowsOn = () => shadowsWanted && quality !== 'fast';
  // Antialiasing is fixed when the canvas is made: on unless the file opens in Fast quality.
  const renderer = new THREE.WebGLRenderer({ antialias: quality !== 'fast' });
  renderer.setPixelRatio(Math.min(QUALITY[quality].pixelRatio, window.devicePixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = data.exposure;
  renderer.shadowMap.enabled = shadowsOn();
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // Cutaway: door/window assemblies and wall details are clipped at the cut height.
  renderer.localClippingEnabled = true;
  root.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(data.background);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = data.envIntensity;
  scene.add(new THREE.HemisphereLight('#f7f9fb', '#888c90', 0.35 * data.envIntensity));
  const b = data.bounds;
  const cx = (b.minX + b.maxX) / 2;
  const cz = (b.minY + b.maxY) / 2;
  // As in the app: the sun's shadow area covers the plan plus a wall-height shadow's reach at this elevation.
  const [sdx, sdy, sdz] = data.sun.dir;
  const reach = Math.min(14, (2.8 * Math.sqrt(Math.max(0, 1 - sdy * sdy))) / Math.max(0.12, sdy));
  const radius = Math.max(4, Math.hypot(b.maxX - b.minX, b.maxY - b.minY) / 2 + 1.5) + reach;
  const sun = new THREE.DirectionalLight(data.sun.color, data.sun.intensity);
  sun.position.set(cx + sdx * radius * 2.5, sdy * radius * 2.5, cz + sdz * radius * 2.5);
  sun.target.position.set(cx, 0, cz);
  sun.castShadow = shadowsOn();
  sun.shadow.mapSize.set(QUALITY[quality].sunMap, QUALITY[quality].sunMap);
  Object.assign(sun.shadow.camera, {
    left: -radius,
    right: radius,
    top: radius,
    bottom: -radius,
    near: 0.5,
    far: radius * 6,
  });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.025;
  scene.add(sun, sun.target);

  const persp = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.05, 600);
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, -200, 600);
  let camera: THREE.Camera = persp;
  const controls = new OrbitControls(persp, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI / 2 - 0.02;
  controls.autoRotateSpeed = 0.6;
  attachTrackpadOrbit(renderer.domElement, () => (controls.enabled ? controls : null));

  // ── Layout option shown (the option switcher changes it) ──
  let cur = Math.max(0, Math.min(data.options.length - 1, data.option ?? 0));
  let opt = data.options[cur];
  const anyOption = (fn: (o: GuestOption) => boolean) => data.options.some(fn);

  // ── What is shown (the View panel changes these) ──
  const show = {
    cutaway: !!data.cutawayOn,
    cutawayExternalOnly: !!data.cutawayExternalOnly,
    ceilings: data.ceilingsOn !== false,
    /** Pendants, ceiling lights and fans (hidden by default so the view from above stays clear). */
    ceilingItems: false,
    notes: anyOption((o) => o.callouts.length > 0) && !data.notesHidden,
    /** How notes float (off, pins, one line, full). */
    noteMode: (data.notesHidden ? 'off' : (data.noteDisplay ?? 'full')) as NoteMode,
    rooms: !!data.roomsOn,
  };
  const layerOn = new Map(data.options.flatMap((o) => o.layers.map((l) => [l.id, l.on] as const)));
  const isLayerOn = (id: string | undefined) => layerOn.get(id ?? '') ?? true;

  // ── Model: one group per layout option, with role groups, item layer groups and ceiling items ──
  const clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e6);
  const clipInt = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e6);
  type OptionModel = {
    root: THREE.Object3D;
    parts: Partial<Record<string, THREE.Object3D>>;
    layers: THREE.Object3D[];
    ceiling: THREE.Object3D[];
  };
  const optionModels: OptionModel[] = [];
  let model: THREE.Object3D | null = null;
  let ceilingCheck = null as HTMLElement | null;
  const loading = loadingScreen(data.title);
  const glbBytes = async (): Promise<ArrayBuffer> => {
    const raw = b64ToBuffer(data.glb);
    if (data.glbEncoding !== 'gzip') return raw;
    if (typeof DecompressionStream === 'undefined')
      throw new Error(
        'This browser is too old to open the model (no DecompressionStream). Please update it.',
      );
    return new Response(new Response(raw).body!.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  };
  const onModelError = (e?: unknown) =>
    loading.fail(
      e instanceof Error && /too old/.test(e.message) ? e.message : 'This file’s 3D data could not be read.',
    );
  void (async () => {
    loading.step(1);
    await yieldToPaint();
    const bytes = await glbBytes();
    loading.step(2);
    await yieldToPaint();
    const gltf = await new GLTFLoader().parseAsync(bytes, '');
    {
      const clipped = new Map<string, THREE.Material>();
      const clipCopy = (m: THREE.Material, p: THREE.Plane) => {
        const key = `${m.uuid}:${p === clip ? 'e' : 'i'}`;
        let c = clipped.get(key);
        if (!c) {
          c = m.clone();
          c.clippingPlanes = [p];
          clipped.set(key, c);
        }
        return c;
      };
      const roots: THREE.Object3D[] = [];
      gltf.scene.traverse((o) => {
        if (typeof o.userData.neestOption === 'number') roots[o.userData.neestOption as number] = o;
      });
      // A model without option groups is one option.
      if (!roots.length) roots.push(gltf.scene);
      for (const root of roots) {
        const m: OptionModel = { root, parts: {}, layers: [], ceiling: [] };
        root?.traverse((o) => {
          const role = o.userData.neestRole as string | undefined;
          if (role) m.parts[role] = o;
          if (typeof o.userData.neestLayer === 'string') m.layers.push(o);
          if (o.userData.neestCeiling) m.ceiling.push(o);
        });
        optionModels.push(m);
        for (const role of ['openings', 'wall-details']) {
          for (const child of m.parts[role]?.children ?? []) {
            const plane = child.userData.neestExt ? clip : clipInt;
            child.traverse((o) => {
              const mesh = o as THREE.Mesh;
              if (mesh.isMesh)
                mesh.material = Array.isArray(mesh.material)
                  ? mesh.material.map((x) => clipCopy(x, plane))
                  : clipCopy(mesh.material, plane);
            });
          }
        }
      }
      if (ceilingCheck && optionModels.some((m) => m.ceiling.length)) ceilingCheck.style.display = '';
      model = gltf.scene;
      scene.add(gltf.scene);
      applyShadows();
      applyVisibility();
    }
    // Compile every shader before the first frame (in parallel where the browser can), so the
    // view appears ready instead of freezing on its first frames.
    loading.step(3);
    await yieldToPaint();
    await renderer.compileAsync(scene, camera).catch(() => undefined);
    loading.done();
  })().catch(onModelError);
  /**
   * The shown option; its walls (full or cutaway), ceilings, ceiling items (hidden unless the guest
   * shows them) and item layers.
   */
  function applyVisibility() {
    optionModels.forEach((m, i) => m.root && (m.root.visible = i === cur));
    const m = optionModels[cur];
    const parts = m?.parts ?? {};
    for (const g of m?.ceiling ?? []) g.visible = show.ceilingItems;
    const cut = show.cutaway && parts['walls-cut'] ? (data.cutaway ?? 1.2) : null;
    const extOnly = cut !== null && show.cutawayExternalOnly;
    if (parts.walls) {
      parts.walls.visible = cut === null || extOnly;
      for (const c of parts.walls.children) c.visible = cut === null || !c.userData.neestExt;
    }
    if (parts['walls-cut']) {
      parts['walls-cut'].visible = cut !== null;
      if (cut !== null) for (const c of parts['walls-cut'].children) c.visible = !extOnly || !!c.userData.neestExt;
    }
    if (parts.ceilings) parts.ceilings.visible = show.ceilings && cut === null;
    clip.constant = cut ?? 1e6;
    clipInt.constant = cut !== null && !extOnly ? cut : 1e6;
    for (const g of m?.layers ?? []) g.visible = isLayerOn(g.userData.neestLayer as string);
    lampClock = 0;
    for (const s of spots) if (s.light.castShadow) s.light.shadow.needsUpdate = true;
  }
  /** Shadow casting follows the quality and the Shadows switch (materials recompile once). */
  function applyShadows() {
    const on = shadowsOn();
    renderer.shadowMap.enabled = on;
    sun.castShadow = on;
    const size = QUALITY[quality].sunMap;
    if (sun.shadow.mapSize.x !== size) {
      sun.shadow.mapSize.set(size, size);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    }
    model?.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = on;
      m.receiveShadow = on;
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) mat.needsUpdate = true;
    });
  }

  // ── Lamps: a fixed pool of lights handed to the fixtures nearest the view ──
  let lamps = opt.lamps;
  type Slot<L extends THREE.PointLight | THREE.SpotLight> = { light: L; lamp: GuestLamp | null };
  let points: Slot<THREE.PointLight>[] = [];
  let spots: Slot<THREE.SpotLight>[] = [];
  /** (Re)builds the pool for the quality; the pool size only changes here, never while moving. */
  const buildLampPool = () => {
    for (const s of points) scene.remove(s.light);
    for (const s of spots) scene.remove(s.light, s.light.target);
    [...points, ...spots].forEach((s) => s.light.dispose());
    const budget = data.lampBudgets?.[quality] ?? { point: 0, spot: 0, shadows: 0 };
    points = Array.from(
      { length: Math.min(budget.point, lamps.filter((l) => l.kind === 'point').length) },
      () => ({ light: new THREE.PointLight('#ffffff', 0, 1, 2), lamp: null }),
    );
    spots = Array.from(
      { length: Math.min(budget.spot, lamps.filter((l) => l.kind === 'spot').length) },
      (_, i) => {
        const l = new THREE.SpotLight('#ffffff', 0, 1, 0.6, 0.4, 2);
        if (shadowsOn() && i < budget.shadows) {
          l.castShadow = true;
          l.shadow.mapSize.set(1024, 1024);
          l.shadow.bias = -0.0005;
          l.shadow.normalBias = 0.02;
          l.shadow.autoUpdate = false;
          l.shadow.needsUpdate = true;
        }
        return { light: l, lamp: null };
      },
    );
    for (const s of points) scene.add(s.light);
    for (const s of spots) scene.add(s.light, s.light.target);
    lampClock = 0;
  };
  const focus = new THREE.Vector3();
  const assignLamps = <L extends THREE.PointLight | THREE.SpotLight>(
    slots: Slot<L>[],
    kind: GuestLamp['kind'],
  ) => {
    if (!slots.length) return;
    const score = (l: GuestLamp) =>
      Math.hypot(l.p[0] - focus.x, l.p[1] - focus.y, l.p[2] - focus.z) /
      Math.max(0.3, l.distance * Math.sqrt(l.intensity));
    const best = new Set(
      lamps
        .filter((l) => l.kind === kind && isLayerOn(l.layer))
        .sort((a, c) => score(a) - score(c))
        .slice(0, slots.length),
    );
    for (const s of slots) if (s.lamp && !best.has(s.lamp)) s.lamp = null;
    for (const s of slots) if (s.lamp) best.delete(s.lamp);
    for (const lamp of best) {
      const s = slots.find((x) => !x.lamp);
      if (!s) break;
      s.lamp = lamp;
      s.light.intensity = 0;
      s.light.color.set(lamp.color);
      s.light.distance = lamp.distance;
      s.light.position.set(...lamp.p);
      if ((s.light as THREE.SpotLight).isSpotLight) {
        const sp = s.light as THREE.SpotLight;
        sp.angle = lamp.angle;
        sp.penumbra = lamp.penumbra;
        sp.target.position.set(lamp.p[0] + lamp.dir[0], lamp.p[1] + lamp.dir[1], lamp.p[2] + lamp.dir[2]);
        sp.target.updateMatrixWorld();
        if (sp.castShadow) sp.shadow.needsUpdate = true;
      }
    }
  };
  let lampClock = 0;
  const updateLamps = (dt: number) => {
    if (!points.length && !spots.length) return;
    lampClock -= dt;
    if (lampClock <= 0) {
      lampClock = 0.3;
      focus.copy(controls.target);
      assignLamps(points, 'point');
      assignLamps(spots, 'spot');
    }
    for (const s of [...points, ...spots]) {
      const target = s.lamp ? s.lamp.intensity : 0;
      s.light.intensity += (target - s.light.intensity) * Math.min(1, dt * 5);
    }
  };
  buildLampPool();

  // ── HUD: title, overview and view panels on the left, views on the right, controls at the bottom ──
  const hud = el('div', 'ng-hud');
  const side = el('div', 'ng-side');
  const title = el('div', 'ng-title');
  title.append(
    el('strong', '', data.title),
    el('span', '', `${data.subtitle || 'View-only 3D walkthrough'} · made with Neest`),
  );
  side.append(title);
  // Layout options: a drop-down (the file opens on the option that was active). A native select, so
  // phones get their own picker and long option names never crowd the panel.
  let optionBox: HTMLElement | null = null;
  let optionSelect: HTMLSelectElement | null = null;
  if (data.options.length > 1) {
    const box = el('label', 'ng-opts');
    optionBox = box;
    const select = el('select', 'ng-opts-select');
    optionSelect = select;
    select.setAttribute('aria-label', 'Option');
    data.options.forEach((o, i) => {
      const opt = el('option', '', o.name);
      opt.value = String(i);
      select.append(opt);
    });
    select.onchange = () => {
      setOption(Number(select.value));
      select.blur();
    };
    // Arrow keys and letters belong to the select while it has focus.
    select.addEventListener('keydown', (e) => e.stopPropagation());
    const wrap = el('span', 'ng-opts-wrap');
    wrap.append(select, el('span', 'ng-opts-caret', '▾'));
    box.append(el('span', 'ng-opts-label', 'Option'), wrap);
    side.append(box);
  }
  const markOption = () => {
    if (optionSelect) optionSelect.value = String(cur);
  };
  markOption();
  const help = el('div', 'ng-help');
  hud.append(side);
  root.append(hud, help);
  // Bottom bar: view drop-down (where Walk through sat), on/off switches, then panel buttons.
  const bar = el('div', 'ng-bar');
  const viewGroup = el('div', 'ng-group ng-view-group');
  const toggles = el('div', 'ng-group ng-toggles');
  const panelsGroup = el('div', 'ng-group ng-panels');
  bar.append(viewGroup, toggles, panelsGroup);
  root.append(bar);

  const panel = (heading: string, onClose: () => void) => {
    const p = el('section', 'ng-panel');
    const h = el('h2', '', heading);
    const x = el('button', 'ng-x', '×');
    x.setAttribute('aria-label', `Close ${heading}`);
    x.onclick = onClose;
    h.append(x);
    p.append(h);
    side.append(p);
    return p;
  };
  const panelSetters: ((on: boolean) => void)[] = [];
  const toggleButton = (label: string, p: HTMLElement, open: boolean, ico: string) => {
    const t = panelBtn(label, ico);
    const set = (on: boolean) => {
      // On phones a panel is a sheet over the bottom of the view: one at a time.
      if (on && narrow()) panelSetters.forEach((s) => s !== set && s(false));
      p.style.display = on ? '' : 'none';
      t.set(on);
    };
    t.btn.onclick = () => set(p.style.display === 'none');
    set(open);
    panelSetters.push(set);
    panelsGroup.append(t.btn);
    return set;
  };

  let setInfo = (_on: boolean) => {};
  let setView = (_on: boolean) => {};

  // Overview numbers (of the shown option).
  let fillInfo = () => {};
  if (opt.info) {
    const info = panel('Overview', () => setInfo(false));
    const body = el('div');
    info.append(body);
    fillInfo = () => {
      body.replaceChildren();
      if (!opt.info) return;
      const dl = el('dl', 'ng-stats');
      for (const [k, v] of opt.info.stats) {
        const cell = el('div');
        cell.append(el('dt', '', k), el('dd', '', v));
        dl.append(cell);
      }
      body.append(dl);
      const row = (k: string, v: string) => {
        const r = el('div', 'ng-row');
        r.append(el('span', '', k), el('span', '', v));
        body.append(r);
      };
      if (opt.info.size) row('Overall size', opt.info.size);
      if (opt.info.rooms.length) body.append(el('div', 'ng-sep'));
      for (const [name, area] of opt.info.rooms) row(name, area);
    };
    fillInfo();
    // Phones start with it closed: it would cover the view.
    setInfo = toggleButton('Info', info, opt.info.open && !narrow(), 'info');
  }

  // ── Notes: highlights in the scene; labels, leaders and end marks laid out on screen each frame ──
  const calloutLayer = el('div', 'ng-callouts');
  const marksSvg = document.createElementNS(SVG, 'svg');
  marksSvg.setAttribute('class', 'ng-marks');
  calloutLayer.append(marksSvg);
  root.append(calloutLayer);
  const calloutGroup = new THREE.Group();
  scene.add(calloutGroup);
  type PlacedNote = {
    id: string;
    anchor: THREE.Vector3;
    label: THREE.Vector3;
    card: HTMLDivElement;
    /** Its pin ("Icons"): a click opens the card. */
    pin: HTMLButtonElement;
    line: SVGLineElement | null;
    mark: SVGElement | null;
    endPx: number;
  };
  let callouts: PlacedNote[] = [];
  /** The note opened from its pin (or Show) while notes float as pins. */
  let openNote: string | null = null;
  /** (Re)builds the shown option's labels, leaders, end marks and floor highlights. */
  const buildCallouts = () => {
    for (const n of callouts) {
      n.card.remove();
      n.pin.remove();
    }
    openNote = null;
    marksSvg.replaceChildren();
    for (const o of [...calloutGroup.children]) {
      calloutGroup.remove(o);
      const line = o as THREE.LineLoop;
      line.geometry?.dispose();
      (line.material as THREE.Material | undefined)?.dispose();
    }
    callouts = opt.callouts.map(makeCallout);
  };
  const makeCallout = (c: GuestCallout, i: number): PlacedNote => {
    const st = c.style;
    let line: SVGLineElement | null = null;
    if (st.line !== 'none') {
      line = document.createElementNS(SVG, 'line');
      line.setAttribute('stroke', c.colors.main);
      line.setAttribute('stroke-width', String(st.lineWidth));
      line.setAttribute('stroke-linecap', 'round');
      if (st.dash) line.setAttribute('stroke-dasharray', st.dash.join(' '));
      marksSvg.append(line);
    }
    let mark: SVGElement | null = null;
    if (st.end === 'dot' || st.end === 'ring') {
      mark = document.createElementNS(SVG, 'circle');
      mark.setAttribute('r', String(st.endPx));
      mark.setAttribute('fill', st.end === 'dot' ? c.colors.main : '#fff');
      mark.setAttribute('stroke', st.end === 'dot' ? '#fff' : c.colors.main);
      mark.setAttribute('stroke-width', String(st.end === 'dot' ? 1.4 : Math.max(1.6, st.endPx / 2.6)));
    } else if (st.end === 'arrow') {
      mark = document.createElementNS(SVG, 'path');
      mark.setAttribute('fill', c.colors.main);
      mark.setAttribute('stroke', '#fff');
      mark.setAttribute('stroke-width', '0.8');
    }
    if (mark) marksSvg.append(mark);
    if (c.outline && c.outline.length >= 3) {
      const y = c.outlineY ?? 0.025;
      const loop = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(c.outline.map(([x, z]) => new THREE.Vector3(x, y, z))),
        new THREE.LineDashedMaterial({ color: c.colors.main, dashSize: 0.12, gapSize: 0.08 }),
      );
      loop.computeLineDistances();
      calloutGroup.add(loop);
    }
    const card = el('div', `ng-callout ng-box-${st.box}`);
    for (const [k, v] of Object.entries(c.colors)) card.style.setProperty(`--${k}`, v);
    card.style.fontSize = `${12 * st.scale}px`;
    for (const ln of c.lines) {
      const row = el('div', `ng-cl-${ln.role}`);
      if (ln.indent) row.style.paddingLeft = `${ln.indent * 0.54}em`;
      appendRuns(row, ln.runs);
      card.append(row);
    }
    calloutLayer.append(card);
    const id = `n${i}`;
    const pin = el('button', 'ng-pin');
    pin.type = 'button';
    pin.style.setProperty('--main', c.colors.main);
    pin.setAttribute('aria-label', `Open note: ${c.lines[0]?.runs.map((r) => r.t).join('') ?? 'note'}`);
    pin.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 9h8M8 13h5"/></svg>';
    pin.onclick = (e) => {
      e.stopPropagation();
      openNote = openNote === id ? null : id;
    };
    calloutLayer.append(pin);
    return {
      id,
      anchor: new THREE.Vector3(...c.anchor),
      label: new THREE.Vector3(...c.label),
      card,
      pin,
      line,
      mark,
      endPx: st.endPx,
    };
  };
  buildCallouts();
  const projected = new THREE.Vector3();
  const toScreen = (p: THREE.Vector3) => {
    projected.copy(p).project(camera);
    if (projected.z > 1 || projected.z < -1) return null;
    return {
      x: ((projected.x + 1) / 2) * window.innerWidth,
      y: ((1 - projected.y) / 2) * window.innerHeight,
    };
  };
  const hide = (e: Element | null) => e && ((e as HTMLElement).style.visibility = 'hidden');
  const placeCallouts = () => {
    const mode = show.noteMode;
    const on = mode !== 'off';
    calloutGroup.visible = on;
    calloutLayer.style.display = on ? '' : 'none';
    if (!on) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const inputs: (LabelInput & { n: (typeof callouts)[number] })[] = [];
    /** Pins on screen: the opened card keeps clear of them (they stay on their spots). */
    const pinRects: ScreenRect[] = [];
    for (const n of callouts) {
      const a = toScreen(n.anchor);
      const l = toScreen(n.label);
      const visible = !!a && !!l && inView(a, { w, h });
      // Pins: on every spot in view; only the opened note gets its card and leader.
      if (mode === 'icon' && visible) {
        pinRects.push({ x: a!.x - 15, y: a!.y - 36, w: 30, h: 36 });
        n.pin.style.visibility = 'visible';
        n.pin.style.transform = `translate(${Math.round(a!.x)}px, ${Math.round(a!.y)}px)`;
        n.pin.classList.toggle('open', openNote === n.id);
      } else n.pin.style.visibility = 'hidden';
      n.card.classList.toggle('ng-compact', mode === 'compact');
      if (!visible || (mode === 'icon' && openNote !== n.id)) {
        [n.card, n.line, n.mark].forEach(hide);
        continue;
      }
      inputs.push({ id: n.id, n, anchor: a!, prefer: l!, w: n.card.offsetWidth, h: n.card.offsetHeight });
    }
    // The building's box on screen, kept clear of labels in "clear of the walls" mode.
    let obstacle: ScreenRect | null = null;
    if (data.notePlacement === 'clear') {
      const corners: ({ x: number; y: number } | null)[] = [];
      const ob = opt.bounds;
      for (const x of [ob.minX, ob.maxX])
        for (const y of [0, opt.wallTop || 2.7])
          for (const z of [ob.minY, ob.maxY]) corners.push(toScreen(new THREE.Vector3(x, y, z)));
      obstacle = corners.some((p) => !p) ? null : screenBounds(corners);
    }
    // Keep clear of the title at the top and the bar at the bottom.
    const placed = placeNoteLabels(
      inputs,
      { w, h },
      {
        mode: data.notePlacement ?? 'close',
        obstacle,
        avoid: pinRects,
        insets: {
          l: side.offsetHeight > 90 && w > 900 ? side.offsetWidth + 24 : 0,
          r: 0,
          t: title.offsetHeight + (optionBox ? optionBox.offsetHeight + 8 : 0) + 24,
          b: bar.offsetHeight + 24,
        },
      },
    );
    inputs.forEach(({ n, anchor: a }, i) => {
      const { rect, attach } = placed[i];
      n.card.style.transform = `translate(${Math.round(rect.x)}px, ${Math.round(rect.y)}px)`;
      // 'visible', not '': the stylesheet hides cards until they are placed.
      n.card.style.visibility = 'visible';
      if (n.line) {
        n.line.setAttribute('x1', String(a.x));
        n.line.setAttribute('y1', String(a.y));
        n.line.setAttribute('x2', String(attach.x));
        n.line.setAttribute('y2', String(attach.y));
        n.line.style.visibility = '';
      }
      if (n.mark) {
        if (n.mark.tagName === 'circle') {
          n.mark.setAttribute('cx', String(a.x));
          n.mark.setAttribute('cy', String(a.y));
        } else {
          const from = Math.hypot(attach.x - a.x, attach.y - a.y) > 1 ? attach : { x: a.x, y: a.y - 10 };
          n.mark.setAttribute(
            'd',
            arrowHead(a, from, n.endPx)
              .map((q, k) => `${k ? 'L' : 'M'}${q.x} ${q.y}`)
              .join('') + 'Z',
          );
        }
        n.mark.style.visibility = '';
      }
    });
  };

  // ── Room labels ──
  const roomLayer = el('div', 'ng-rooms');
  root.insertBefore(roomLayer, calloutLayer);
  let roomLabels: { tag: HTMLDivElement; p: THREE.Vector3 }[] = [];
  const buildRooms = () => {
    roomLayer.replaceChildren();
    roomLabels = opt.rooms.map((r) => {
      const tag = el('div', 'ng-room');
      tag.append(el('strong', '', r.name), el('span', '', r.area));
      roomLayer.append(tag);
      return { tag, p: new THREE.Vector3(...r.p) };
    });
  };
  buildRooms();
  const placeRooms = () => {
    const on = show.rooms && roomLabels.length > 0;
    roomLayer.style.display = on ? '' : 'none';
    if (!on) return;
    for (const r of roomLabels) {
      const s = toScreen(r.p);
      if (!s || !inView(s, { w: window.innerWidth, h: window.innerHeight })) {
        r.tag.style.visibility = 'hidden';
        continue;
      }
      r.tag.style.visibility = '';
      r.tag.style.transform = `translate(${Math.round(s.x)}px, ${Math.round(s.y)}px) translate(-50%, -50%)`;
    }
  };

  // ── Picture viewer: a note's pictures full size (arrows step, Esc or a click outside closes) ──
  const lightbox = el('div', 'ng-lightbox');
  lightbox.setAttribute('role', 'dialog');
  lightbox.setAttribute('aria-label', 'Note picture');
  const lbImg = el('img');
  lbImg.alt = 'Note picture';
  const lbCount = el('span', 'ng-lb-count');
  const lbBtn = (label: string, cls: string, title: string, fn: () => void) => {
    const btn = el('button', `ng-btn ${cls}`, label);
    btn.type = 'button';
    btn.setAttribute('aria-label', title);
    btn.onclick = (e) => {
      e.stopPropagation();
      fn();
    };
    return btn;
  };
  let lb: { images: GuestNote['images']; i: number } | null = null;
  const showLightbox = () => {
    if (!lb) return;
    const im = lb.images[lb.i];
    lbImg.src = im.src;
    lbImg.width = im.w;
    lbImg.height = im.h;
    lbCount.textContent = lb.images.length > 1 ? `${lb.i + 1} / ${lb.images.length}` : '';
    lightbox.classList.toggle('ng-lb-many', lb.images.length > 1);
  };
  const closeLightbox = () => {
    lb = null;
    lightbox.classList.remove('open');
    lbImg.removeAttribute('src');
  };
  const stepLightbox = (by: number) => {
    if (!lb) return;
    lb.i = (lb.i + by + lb.images.length) % lb.images.length;
    showLightbox();
  };
  const openLightbox = (images: GuestNote['images'], i: number) => {
    lb = { images, i };
    lightbox.classList.add('open');
    showLightbox();
  };
  lightbox.append(
    lbImg,
    lbCount,
    lbBtn('‹', 'ng-lb-prev', 'Previous picture', () => stepLightbox(-1)),
    lbBtn('›', 'ng-lb-next', 'Next picture', () => stepLightbox(1)),
    lbBtn('×', 'ng-lb-close', 'Close picture', closeLightbox),
  );
  lightbox.onclick = (e) => e.target === lightbox && closeLightbox();
  lbImg.onclick = (e) => e.stopPropagation();
  root.append(lightbox);
  /** Keys for the picture viewer while it is open (nothing else gets them). */
  const lightboxKey = (e: KeyboardEvent) => {
    if (!lb) return false;
    if (e.code === 'Escape') closeLightbox();
    else if (e.code === 'ArrowLeft') stepLightbox(-1);
    else if (e.code === 'ArrowRight') stepLightbox(1);
    e.preventDefault();
    return true;
  };

  // ── Notes list: every note of the shown option in full, with its pictures; Show turns the view to it ──
  let fillNotes = () => {};
  let setNotes = (_on: boolean) => {};
  /** How notes float in the view, from the Notes panel or the View panel (kept in step). */
  const noteSwitches: ((m: NoteMode) => void)[] = [];
  const setNoteMode = (m: NoteMode) => {
    show.noteMode = m;
    show.notes = m !== 'off';
    openNote = null;
    noteSwitches.forEach((s) => s(m));
  };
  const NOTE_MODES: [NoteMode, string][] = [
    ['off', 'Off'],
    ['icon', 'Icons'],
    ['compact', 'Compact'],
    ['full', 'Full'],
  ];
  const noteModeControl = () => {
    const c = choice<NoteMode>(NOTE_MODES, show.noteMode, setNoteMode);
    c.box.classList.add('ng-note-modes');
    noteSwitches.push(c.set);
    return c.box;
  };
  /** Looks at a note's spot: glides the orbit view in to it. */
  const focusNote = (n: GuestNote) => {
    if (!n.at) return;
    const at = new THREE.Vector3(...n.at);
    setTour(false);
    if (narrow()) setNotes(false);
    // Keep the side it is seen from, from above the walls, close enough to read the room around it.
    const dir = camera === persp ? persp.position.clone().sub(controls.target) : new THREE.Vector3(0.6, 1, 0.8);
    const dist = camera === persp ? Math.min(9, Math.max(5.5, dir.length() * 0.6)) : 7;
    dir.y = Math.max(dir.y, 1.3 * Math.hypot(dir.x, dir.z));
    dir.normalize();
    const pos = at.clone().addScaledVector(dir, dist);
    applyCamera(
      { name: '', projection: 'perspective', position: pos.toArray(), target: n.at, fov: camera === persp ? persp.fov : 50 },
      camera === persp,
    );
    const label = n.label >= 0 ? callouts[n.label] : undefined;
    // Pins: Show opens the note's card.
    if (label && show.noteMode === 'icon') openNote = label.id;
    if (label) {
      label.card.classList.remove('ng-flash');
      void label.card.offsetWidth;
      label.card.classList.add('ng-flash');
    }
  };
  const noteCard = (n: GuestNote) => {
    const card = el('article', 'ng-note');
    card.style.setProperty('--main', n.color);
    const head = el('div', 'ng-note-head');
    head.append(el('span', 'ng-note-target', n.target));
    if (n.at) {
      const go = el('button', 'ng-note-go', 'Show');
      go.type = 'button';
      go.title = 'Look at this note in the view';
      go.onclick = () => focusNote(n);
      head.append(go);
    }
    card.append(head);
    if (n.heading) card.append(el('div', 'ng-note-title', n.heading));
    for (const line of n.info) card.append(el('div', 'ng-note-info', line));
    let list: HTMLElement | null = null;
    for (const blk of n.blocks) {
      if (blk.k === 'p') {
        list = null;
        const p = el('p');
        appendRuns(p, blk.runs);
        card.append(p);
        continue;
      }
      const tag = blk.k === 'b' ? 'UL' : 'OL';
      if (!list || list.tagName !== tag) {
        list = el(blk.k === 'b' ? 'ul' : 'ol');
        if (blk.k === 'n' && blk.n !== undefined) list.setAttribute('start', String(blk.n));
        card.append(list);
      }
      const li = el('li');
      appendRuns(li, blk.runs);
      list.append(li);
    }
    if (!n.heading && !n.info.length && !n.blocks.length && !n.images.length) card.append(el('p', 'ng-note-info', 'Note'));
    if (n.images.length) {
      const strip = el('div', 'ng-note-imgs');
      n.images.forEach((im, i) => {
        const btn = el('button', 'ng-note-img');
        btn.type = 'button';
        btn.setAttribute('aria-label', `Open picture ${i + 1} of ${n.images.length}`);
        const img = el('img');
        img.src = im.src;
        img.alt = '';
        img.loading = 'lazy';
        btn.append(img);
        btn.onclick = () => openLightbox(n.images, i);
        strip.append(btn);
      });
      card.append(strip);
    }
    return card;
  };
  if (anyOption((o) => o.notes.length > 0)) {
    const notesPanel = panel('Notes', () => setNotes(false));
    notesPanel.classList.add('ng-notes');
    if (anyOption((o) => o.callouts.length > 0)) {
      notesPanel.append(el('div', 'ng-label', 'Notes in the 3D view'), noteModeControl());
    }
    const list = el('div', 'ng-note-list');
    notesPanel.append(list);
    fillNotes = () => {
      list.replaceChildren();
      if (!opt.notes.length) list.append(el('p', 'ng-empty', 'No notes in this option.'));
      for (const n of opt.notes) list.append(noteCard(n));
    };
    fillNotes();
    setNotes = toggleButton('Notes', notesPanel, false, 'notes');
  }

  /** Shows another layout option: its model, lamps, notes, labels, numbers and plan. */
  function setOption(i: number) {
    if (i === cur || !data.options[i]) return;
    cur = i;
    opt = data.options[i];
    lamps = opt.lamps;
    buildLampPool();
    buildCallouts();
    buildRooms();
    fillInfo();
    fillLayers();
    fillNotes();
    fillPlan();
    closeLightbox();
    markOption();
    applyVisibility();
  }

  // ── View panel: walls, ceilings, ceiling items, labels, item layers, quality ──
  let fillLayers = () => {};
  {
    const view = panel('View', () => setView(false));
    view.append(el('div', 'ng-label', 'Walls'));
    const extCheck = check('External walls only', show.cutawayExternalOnly, (on) => {
      show.cutawayExternalOnly = on;
      applyVisibility();
    });
    extCheck.style.display = show.cutaway ? '' : 'none';
    view.append(
      segmented<'full' | 'cutaway'>(
        [
          ['full', 'Full'],
          ['cutaway', 'Cutaway'],
        ],
        show.cutaway ? 'cutaway' : 'full',
        (v) => {
          show.cutaway = v === 'cutaway';
          extCheck.style.display = show.cutaway ? '' : 'none';
          applyVisibility();
        },
      ),
    );
    view.append(
      extCheck,
      check('Ceilings', show.ceilings, (on) => {
        show.ceilings = on;
        applyVisibility();
      }),
    );
    // Shown once the model is read and has some.
    ceilingCheck = check('Ceiling lights & fans', show.ceilingItems, (on) => {
      show.ceilingItems = on;
      applyVisibility();
    });
    ceilingCheck.title = 'Pendants, ceiling lights and fans';
    ceilingCheck.style.display = optionModels.some((m) => m.ceiling.length) ? '' : 'none';
    view.append(ceilingCheck);
    if (anyOption((o) => o.callouts.length > 0)) {
      view.append(el('div', 'ng-label', 'Notes in the view'), noteModeControl());
    }
    if (anyOption((o) => o.rooms.length > 0)) view.append(check('Room names', show.rooms, (on) => (show.rooms = on)));
    const layerBox = el('div');
    view.append(layerBox);
    fillLayers = () => {
      layerBox.replaceChildren();
      const layers = opt.layers;
      if (!layers.length) return;
      layerBox.append(el('div', 'ng-label', layers.length > 1 ? 'Item layers' : 'Items'));
      for (const l of layers)
        layerBox.append(
          check(
            layers.length > 1 ? l.name : 'Furniture & fixtures',
            isLayerOn(l.id),
            (on) => {
              layerOn.set(l.id, on);
              applyVisibility();
            },
            layers.length > 1 ? l.color : undefined,
          ),
        );
    };
    fillLayers();
    view.append(el('div', 'ng-label', 'Quality'));
    view.append(
      segmented<GuestQuality>(
        [
          ['fast', 'Fast'],
          ['balanced', 'Balanced'],
          ['high', 'High'],
        ],
        quality,
        (v) => {
          quality = v;
          renderer.setPixelRatio(Math.min(QUALITY[quality].pixelRatio, window.devicePixelRatio));
          buildLampPool();
          applyShadows();
        },
      ),
    );
    view.append(
      check('Shadows', shadowsWanted, (on) => {
        shadowsWanted = on;
        buildLampPool();
        applyShadows();
      }),
    );
    setView = toggleButton('View', view, false, 'view');
  }

  const resizeOrtho = () => {
    const aspect = window.innerWidth / window.innerHeight;
    const h = Math.max(b.maxY - b.minY, (b.maxX - b.minX) / aspect) * 0.62 + 1;
    ortho.left = -h * aspect;
    ortho.right = h * aspect;
    ortho.top = h;
    ortho.bottom = -h;
    ortho.updateProjectionMatrix();
  };

  // ── Views, 2D plan and tour ──
  /** A camera glide between two perspective views (tour). */
  let glide: {
    from: { p: THREE.Vector3; t: THREE.Vector3; fov: number };
    to: GuestCamera;
    start: number;
    dur: number;
  } | null = null;
  let planOpen = false;
  const plan = anyOption((o) => !!o.plan) ? el('div', 'ng-plan') : null;
  /** Index of the last built-in 3D view chosen; leaving the 2D plan returns the drop-down to it. */
  let lastViewIndex = Math.max(0, Math.min(Math.max(0, data.cameras.length - 1), data.start));
  const viewWrap = el('label', 'ng-view-pick');
  const viewSelect = el('select', 'ng-view-select');
  viewSelect.setAttribute('aria-label', 'View');
  viewSelect.title = 'Choose view';
  data.cameras.forEach((c, i) => {
    const optEl = el('option', '', c.name);
    optEl.value = String(i);
    viewSelect.append(optEl);
  });
  let planOption: HTMLOptionElement | null = null;
  if (plan) {
    planOption = el('option', '', '2D plan');
    planOption.value = 'plan';
    viewSelect.append(planOption);
  }
  const syncViewSelect = () => {
    viewSelect.value = planOpen ? 'plan' : String(lastViewIndex);
  };
  const viewCaret = el('span', 'ng-view-caret', '▾');
  viewCaret.setAttribute('aria-hidden', 'true');
  viewWrap.append(icon('cube'), viewSelect, viewCaret);
  viewGroup.append(viewWrap);
  // Arrow keys and letters belong to the select while it has focus.
  viewSelect.addEventListener('keydown', (e) => e.stopPropagation());

  const applyCamera = (c: GuestCamera, animate = false) => {
    if (planOpen) setPlan(false);
    glide = null;
    const idx = data.cameras.indexOf(c);
    if (idx >= 0) lastViewIndex = idx;
    syncViewSelect();
    if (animate && camera === persp && c.projection === 'perspective') {
      glide = {
        from: { p: persp.position.clone(), t: controls.target.clone(), fov: persp.fov },
        to: c,
        start: performance.now(),
        dur: 2200,
      };
      return;
    }
    if (c.projection === 'orthographic') {
      camera = ortho;
      resizeOrtho();
    } else {
      camera = persp;
      persp.fov = c.fov;
      persp.updateProjectionMatrix();
    }
    controls.object = camera;
    camera.position.set(...c.position);
    controls.target.set(...c.target);
    controls.update();
  };
  const glideTo = new THREE.Vector3();
  const stepGlide = () => {
    if (!glide) return false;
    const k = Math.min(1, (performance.now() - glide.start) / glide.dur);
    const e = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
    const to = glide.to;
    persp.position.lerpVectors(glide.from.p, glideTo.set(...to.position), e);
    controls.target.lerpVectors(glide.from.t, glideTo.set(...to.target), e);
    persp.fov = glide.from.fov + (to.fov - glide.from.fov) * e;
    persp.updateProjectionMatrix();
    persp.lookAt(controls.target);
    if (k >= 1) {
      glide = null;
      controls.update();
    }
    return true;
  };

  let tourOn = false;
  let tourIdx = -1;
  let tourNext = 0;
  const tourSecs = Math.max(3, data.tour?.seconds ?? 7);
  const tour = data.cameras.length >= 2 ? toggleEl('Tour', 'Play the views one after another', 'tour') : null;
  const tourBtn = tour?.btn ?? null;
  const setTour = (on: boolean) => {
    tourOn = on;
    controls.autoRotate = false;
    tour?.set(on);
    if (on) {
      if (planOpen) setPlan(false);
      tourNext = 0;
    } else glide = null;
  };
  const stepTour = (now: number) => {
    if (!tourOn || glide || now < tourNext) return;
    tourIdx = (tourIdx + 1) % data.cameras.length;
    controls.autoRotate = false;
    applyCamera(data.cameras[tourIdx], true);
    tourNext = now + tourSecs * 1000;
  };
  if (tourBtn) {
    tourBtn.onclick = () => setTour(!tourOn);
    toggles.append(tourBtn);
  }

  viewSelect.onchange = () => {
    setTour(false);
    if (viewSelect.value === 'plan') setPlan(true);
    else {
      const c = data.cameras[Number(viewSelect.value)];
      if (c) applyCamera(c);
    }
  };

  // Any hands-on input ends the tour.
  for (const ev of ['pointerdown', 'wheel', 'touchstart'] as const)
    renderer.domElement.addEventListener(ev, () => tourOn && setTour(false), { passive: true });

  // ── 2D plan: the plan drawing (of the shown option), with pan and zoom ──
  let youAreHere: SVGGElement | null = null;
  /** The drawing shown, its home view box and the current one. */
  let planSvg: SVGSVGElement | null = null;
  let home = [0, 0, 10, 10];
  let vb = [...home];
  const setVb = () => planSvg?.setAttribute('viewBox', vb.join(' '));
  /** Shows the shown option's drawing (the view box is kept when the new drawing has the same extent). */
  const fillPlan = () => {
    if (!plan) return;
    planSvg?.remove();
    planSvg = null;
    youAreHere = null;
    if (planOption) {
      planOption.disabled = !opt.plan;
      planOption.hidden = !opt.plan;
    }
    if (!opt.plan) {
      if (planOpen) setPlan(false);
      return;
    }
    const box = el('div');
    box.innerHTML = opt.plan;
    const svg = box.querySelector('svg');
    if (!svg) return;
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    const next = (svg.getAttribute('viewBox') ?? '0 0 10 10').split(/[\s,]+/).map(Number);
    if (next.some((v, i) => Math.abs(v - home[i]) > 1e-6)) vb = [...next];
    home = next;
    youAreHere = document.createElementNS(SVG, 'g');
    const dot = document.createElementNS(SVG, 'circle');
    dot.setAttribute('r', '0.18');
    dot.setAttribute('fill', '#2e8b74');
    dot.setAttribute('stroke', '#fff');
    dot.setAttribute('stroke-width', '0.06');
    youAreHere.append(dot);
    svg.append(youAreHere);
    planSvg = svg;
    plan.prepend(svg);
    setVb();
    if (planOpen) placeHere();
  };
  if (plan) {
    plan.setAttribute('role', 'img');
    plan.setAttribute('aria-label', 'Floor plan');
    plan.append(
      el('div', 'ng-plan-hint', 'Drag to pan · scroll or pinch to zoom · double-click to reset'),
    );
    const toPlan = (x: number, y: number) => {
      const m = planSvg?.getScreenCTM();
      return m ? new DOMPoint(x, y).matrixTransform(m.inverse()) : null;
    };
    const zoomAt = (x: number, y: number, k: number) => {
      const p = toPlan(x, y);
      if (!p) return;
      const w = Math.min(home[2] * 4, Math.max(home[2] / 12, vb[2] * k));
      const f = w / vb[2];
      vb = [p.x - (p.x - vb[0]) * f, p.y - (p.y - vb[1]) * f, vb[2] * f, vb[3] * f];
      setVb();
    };
    plan.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        zoomAt(e.clientX, e.clientY, Math.exp(wheelDelta(e).y * 0.0015));
      },
      { passive: false },
    );
    const ptrs = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    plan.addEventListener('pointerdown', (e) => {
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 2) {
        const [a, c] = [...ptrs.values()];
        pinch = Math.hypot(a.x - c.x, a.y - c.y);
      }
      plan.setPointerCapture(e.pointerId);
      plan.classList.add('drag');
    });
    plan.addEventListener('pointermove', (e) => {
      const prev = ptrs.get(e.pointerId);
      if (!prev) return;
      const now = { x: e.clientX, y: e.clientY };
      ptrs.set(e.pointerId, now);
      if (ptrs.size === 2) {
        const [a, c] = [...ptrs.values()];
        const d = Math.hypot(a.x - c.x, a.y - c.y);
        if (pinch > 0 && d > 0) zoomAt((a.x + c.x) / 2, (a.y + c.y) / 2, pinch / d);
        pinch = d;
        return;
      }
      const p0 = toPlan(prev.x, prev.y);
      const p1 = toPlan(now.x, now.y);
      if (!p0 || !p1) return;
      vb[0] -= p1.x - p0.x;
      vb[1] -= p1.y - p0.y;
      setVb();
    });
    const endPlanDrag = (e: PointerEvent) => {
      ptrs.delete(e.pointerId);
      if (!ptrs.size) plan.classList.remove('drag');
    };
    plan.addEventListener('pointerup', endPlanDrag);
    plan.addEventListener('pointercancel', endPlanDrag);
    plan.addEventListener('dblclick', () => {
      vb = [...home];
      setVb();
    });
    root.insertBefore(plan, hud);
  }
  /** Marks where the orbit centre is on the plan. */
  function placeHere() {
    if (!youAreHere) return;
    const p = controls.target;
    youAreHere.setAttribute('transform', `translate(${p.x} ${p.z})`);
  }
  function setPlan(on: boolean) {
    if (!plan) return;
    planOpen = on;
    plan.classList.toggle('open', on);
    document.body.classList.toggle('ng-plan-mode', on);
    syncViewSelect();
    if (on) placeHere();
  }
  fillPlan();

  const touch = matchMedia('(pointer: coarse)').matches;
  let helpTimer = 0;
  const setHelp = () => {
    // Touch screens: the hint shows for a few seconds, then gets out of the way.
    if (touch) {
      help.classList.remove('ng-faded');
      window.clearTimeout(helpTimer);
      helpTimer = window.setTimeout(() => help.classList.add('ng-faded'), 4500);
    }
    help.textContent = touch
      ? 'Drag to orbit · pinch to zoom'
      : 'Drag or two-finger swipe to orbit · Shift-swipe or right-drag to pan · pinch to zoom';
  };
  setHelp();

  // Touch: a tap on the scene (no drag) hides every control for an unobstructed view; another tap brings them back.
  let tap: { id: number; x: number; y: number; t: number } | null = null;
  let pointers = 0;
  renderer.domElement.addEventListener('pointerdown', (e) => {
    pointers++;
    tap = e.pointerType === 'touch' && pointers === 1 ? { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() } : null;
  });
  const endTap = (e: PointerEvent) => {
    pointers = Math.max(0, pointers - 1);
    const t = tap;
    tap = null;
    if (!t || t.id !== e.pointerId || e.type !== 'pointerup') return;
    if (Math.hypot(e.clientX - t.x, e.clientY - t.y) > 8 || performance.now() - t.t > 350) return;
    const hidden = document.body.classList.toggle('ng-immersive');
    if (hidden) panelSetters.forEach((s) => s(false));
  };
  window.addEventListener('pointerup', endTap);
  window.addEventListener('pointercancel', endTap);
  window.addEventListener('keydown', (e) => {
    if (lightboxKey(e)) return;
    if (e.code === 'Escape' && planOpen) setPlan(false);
    if (tourOn && e.code !== 'Escape') setTour(false);
  });
  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    persp.aspect = window.innerWidth / window.innerHeight;
    persp.updateProjectionMatrix();
    resizeOrtho();
  });

  // Full screen (where the browser allows it; iPhones do not for pages).
  const fsDoc = document as Document & {
    webkitFullscreenEnabled?: boolean;
    webkitFullscreenElement?: Element | null;
    webkitExitFullscreen?: () => void;
  };
  const fsRoot = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
  if (fsDoc.fullscreenEnabled || fsDoc.webkitFullscreenEnabled) {
    const full = toggleEl('Full screen', 'Full screen (Esc to leave)', 'full');
    const isFull = () => !!(fsDoc.fullscreenElement ?? fsDoc.webkitFullscreenElement);
    full.btn.onclick = () => {
      if (isFull()) void (fsDoc.exitFullscreen?.() ?? fsDoc.webkitExitFullscreen?.());
      else void (fsRoot.requestFullscreen?.() ?? fsRoot.webkitRequestFullscreen?.());
    };
    for (const ev of ['fullscreenchange', 'webkitfullscreenchange'])
      document.addEventListener(ev, () => full.set(isFull()));
    toggles.append(full.btn);
  }

  const begin = () => {
    if (data.tour?.auto && tourBtn) setTour(true);
  };
  applyCamera(data.cameras[data.start] ?? data.cameras[0]);
  applyVisibility();
  // ── Welcome card ──
  if (data.intro != null) {
    const intro = el('div', 'ng-intro');
    const card = el('div', 'ng-intro-card');
    card.append(el('h1', '', data.title));
    if (data.subtitle) card.append(el('p', 'ng-intro-sub', data.subtitle));
    if (data.intro) card.append(el('p', 'ng-intro-text', data.intro));
    const go = el(
      'button',
      'ng-btn ng-primary',
      data.tour?.auto ? 'Start the tour' : 'Start exploring',
    );
    go.onclick = () => {
      intro.remove();
      begin();
    };
    card.append(go);
    intro.append(card);
    root.append(intro);
    go.focus();
  } else begin();

  const clock = new THREE.Clock();
  let barHeight = -1;
  renderer.setAnimationLoop(() => {
    const dt = Math.min(0.05, clock.getDelta());
    const now = performance.now();
    if (planOpen) {
      placeHere();
      return; // The plan covers the scene: no need to draw it.
    }
    if (!stepGlide()) {
      stepTour(now);
      // Between glides the tour drifts slowly around the view.
      if (tourOn && camera === persp) controls.autoRotate = true;
      controls.update();
    }
    // Hints and sheets sit above the bottom bar, whatever its height (it wraps on phones).
    if (bar.offsetHeight !== barHeight) {
      barHeight = bar.offsetHeight;
      document.documentElement.style.setProperty('--ng-bar', `${barHeight}px`);
    }
    updateLamps(dt);
    placeCallouts();
    placeRooms();
    renderer.render(scene, camera);
  });
}

if (window.NEEST_GUEST_DATA) {
  try {
    start(window.NEEST_GUEST_DATA);
  } catch (err) {
    document.body.textContent = `This viewer could not start: ${err instanceof Error ? err.message : String(err)}. A browser with WebGL support is required.`;
  }
}

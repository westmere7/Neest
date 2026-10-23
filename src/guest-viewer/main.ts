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
import { moveWithCollisions, type Collider } from '@/domain/walkthrough/move';
import { attachTrackpadOrbit } from '@/features/scene-3d/trackpadOrbit';
import { attachSafariGesture, createWheelClassifier, wheelDelta } from '@/components/trackpad';
import {
  FLY_SPEED,
  FLY_SPEED_MAX,
  formatSpeed,
  stepSpeed,
  WALK_SPEED,
  WALK_SPEED_MAX,
} from '@/domain/walkthrough/speed';
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
    runs: { t: string; b?: 1; i?: 1; h?: string }[];
  }[];
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
  /** View buttons, in order. */
  cameras: GuestCamera[];
  /** Index of the opening view in `cameras` (-1 when it has no button). */
  start: number;
  /** The opening view (it may have no button). */
  startView?: GuestCamera;
  startMode?: 'orbit' | 'walk';
  spawn: { x: number; y: number; angle: number };
  /** Walking speed multiplier, eye height (m) and field of view (degrees). */
  walk?: { speed: number; eye: number; fov: number };
  colliders: [number, number, number, number][];
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
  ceilingsOn?: boolean;
  lamps?: GuestLamp[];
  /** Live light pool sizes per quality (the fixtures nearest the view get them). */
  lampBudgets?: Record<GuestQuality, LampBudget>;
  layers?: GuestItemLayer[];
  callouts?: GuestCallout[];
  /** Notes start hidden (the guest can show them). */
  notesHidden?: boolean;
  /** Where note labels float (see placement.ts) and the top of the walls (for "clear of the walls"). */
  notePlacement?: NotePlacement;
  wallTop?: number;
  rooms?: GuestRoomLabel[];
  roomsOn?: boolean;
  /** Overview numbers (preformatted) and whether the panel starts open. */
  info?: { open: boolean; stats: [string, string][]; size?: string; rooms: [string, string][] } | null;
  /** Floor plan drawing (SVG markup, viewBox in plan metres). */
  plan?: string | null;
  /** Tour through the views: seconds per view and whether it starts by itself. */
  tour?: { seconds: number; auto: boolean };
}

declare global {
  interface Window {
    NEEST_GUEST_DATA?: GuestData;
  }
}

/** Walker radius (m), as in the app. */
const RADIUS = 0.22;

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

/**
 * An on/off button: a label and a small switch (aria-pressed), so guests can tell it apart from
 * the action buttons (which do something once) and the view buttons (which pick one view).
 */
function toggleEl(label: string, title?: string): { btn: HTMLButtonElement; set: (on: boolean) => void } {
  const btn = el('button', 'ng-btn ng-toggle');
  btn.type = 'button';
  btn.append(el('span', '', label), el('span', 'ng-switch'));
  if (title) btn.title = title;
  const set = (on: boolean) => btn.setAttribute('aria-pressed', String(on));
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

/** Phone-sized screens: panels open one at a time, as sheets at the bottom. */
const narrow = () => matchMedia('(max-width: 640px)').matches;

const SVG = 'http://www.w3.org/2000/svg';

function start(data: GuestData) {
  const root = document.getElementById('neest-guest') ?? document.body;
  let quality: GuestQuality = data.quality ?? 'balanced';
  let shadowsWanted = data.shadows !== false;
  const shadowsOn = () => shadowsWanted && quality !== 'fast';
  const EYE = data.walk?.eye ?? 1.6;
  const WALK_FOV = data.walk?.fov ?? 70;
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

  // ── What is shown (the View panel changes these) ──
  const show = {
    cutaway: !!data.cutawayOn,
    ceilings: data.ceilingsOn !== false,
    notes: (data.callouts?.length ?? 0) > 0 && !data.notesHidden,
    rooms: !!data.roomsOn,
  };
  const layerOn = new Map((data.layers ?? []).map((l) => [l.id, l.on]));
  const isLayerOn = (id: string | undefined) => layerOn.get(id ?? '') ?? true;

  // ── Model ──
  const clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e6);
  const parts: Partial<Record<string, THREE.Object3D>> = {};
  const layerGroups: THREE.Object3D[] = [];
  let model: THREE.Object3D | null = null;
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
      const clipped = new Map<THREE.Material, THREE.Material>();
      const clipCopy = (m: THREE.Material) => {
        let c = clipped.get(m);
        if (!c) {
          c = m.clone();
          c.clippingPlanes = [clip];
          clipped.set(m, c);
        }
        return c;
      };
      gltf.scene.traverse((o) => {
        const role = o.userData.neestRole as string | undefined;
        if (role) parts[role] = o;
        if (typeof o.userData.neestLayer === 'string') layerGroups.push(o);
      });
      for (const role of ['openings', 'wall-details']) {
        parts[role]?.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh)
            m.material = Array.isArray(m.material) ? m.material.map(clipCopy) : clipCopy(m.material);
        });
      }
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
  /** Walls (full when walking or without cutaway), ceilings and item layers. */
  function applyVisibility() {
    const cut = !walking && show.cutaway && parts['walls-cut'] ? (data.cutaway ?? 1.2) : null;
    if (parts.walls) parts.walls.visible = cut === null;
    if (parts['walls-cut']) parts['walls-cut'].visible = cut !== null;
    if (parts.ceilings) parts.ceilings.visible = show.ceilings && cut === null;
    clip.constant = cut ?? 1e6;
    for (const g of layerGroups) g.visible = isLayerOn(g.userData.neestLayer as string);
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
  const lamps = data.lamps ?? [];
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
  const fwd = new THREE.Vector3();
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
      if (walking) focus.copy(persp.position).addScaledVector(persp.getWorldDirection(fwd), 2.5);
      else focus.copy(controls.target);
      assignLamps(points, 'point');
      assignLamps(spots, 'spot');
    }
    for (const s of [...points, ...spots]) {
      const target = s.lamp ? s.lamp.intensity : 0;
      s.light.intensity += (target - s.light.intensity) * Math.min(1, dt * 5);
    }
  };
  buildLampPool();

  const colliders: Collider[] = data.colliders.map(([ax, ay, bx, by]) => ({
    a: { x: ax, y: ay },
    b: { x: bx, y: by },
  }));

  // ── HUD: title, overview and view panels on the left, views on the right, actions at the bottom ──
  const hud = el('div', 'ng-hud');
  const side = el('div', 'ng-side');
  const title = el('div', 'ng-title');
  title.append(
    el('strong', '', data.title),
    el('span', '', `${data.subtitle || 'View-only 3D walkthrough'} · made with Neest`),
  );
  side.append(title);
  const views = el('div', 'ng-views');
  const modeBtn = el('button', 'ng-btn ng-primary', 'Walk through');
  const fly = toggleEl('Fly', 'Free-fly: move where you look, through walls (F)');
  fly.btn.style.display = 'none';
  const help = el('div', 'ng-help');
  hud.append(side, views);
  root.append(hud, help);
  // Bottom bar: the action on the left, on/off switches on the right.
  const bar = el('div', 'ng-bar');
  const actions = el('div', 'ng-group');
  const toggles = el('div', 'ng-group ng-toggles');
  actions.append(modeBtn);
  toggles.append(fly.btn);
  bar.append(actions, toggles);
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
  const toggleButton = (label: string, p: HTMLElement, open: boolean) => {
    const t = toggleEl(label);
    const set = (on: boolean) => {
      // On phones a panel is a sheet over the bottom of the view: one at a time.
      if (on && narrow()) panelSetters.forEach((s) => s !== set && s(false));
      p.style.display = on ? '' : 'none';
      t.set(on);
    };
    t.btn.onclick = () => set(p.style.display === 'none');
    set(open);
    panelSetters.push(set);
    toggles.append(t.btn);
    return set;
  };

  let setInfo = (_on: boolean) => {};
  let setView = (_on: boolean) => {};
  // Keyboard focus never stays on a button or checkbox, so W A S D, Space and Esc always reach the walker.
  root.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t instanceof HTMLButtonElement || t instanceof HTMLInputElement) t.blur();
  });

  // Overview numbers.
  if (data.info) {
    const info = panel('Overview', () => setInfo(false));
    const dl = el('dl', 'ng-stats');
    for (const [k, v] of data.info.stats) {
      const cell = el('div');
      cell.append(el('dt', '', k), el('dd', '', v));
      dl.append(cell);
    }
    info.append(dl);
    const row = (k: string, v: string) => {
      const r = el('div', 'ng-row');
      r.append(el('span', '', k), el('span', '', v));
      info.append(r);
    };
    if (data.info.size) row('Overall size', data.info.size);
    if (data.info.rooms.length) info.append(el('div', 'ng-sep'));
    for (const [name, area] of data.info.rooms) row(name, area);
    // Phones start with it closed: it would cover the view.
    setInfo = toggleButton('Info', info, data.info.open && !narrow());
  }

  // ── Notes: highlights in the scene; labels, leaders and end marks laid out on screen each frame ──
  const calloutLayer = el('div', 'ng-callouts');
  const marksSvg = document.createElementNS(SVG, 'svg');
  marksSvg.setAttribute('class', 'ng-marks');
  calloutLayer.append(marksSvg);
  root.append(calloutLayer);
  const calloutGroup = new THREE.Group();
  scene.add(calloutGroup);
  const callouts = (data.callouts ?? []).map((c, i) => {
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
      for (const r of ln.runs) {
        const span: HTMLElement = r.h ? el('a') : el('span');
        span.textContent = r.t;
        if (r.b) span.style.fontWeight = '650';
        if (r.i) span.style.fontStyle = 'italic';
        if (r.h && span instanceof HTMLAnchorElement) {
          span.href = r.h;
          span.target = '_blank';
          span.rel = 'noopener noreferrer';
        }
        row.append(span);
      }
      card.append(row);
    }
    calloutLayer.append(card);
    return {
      id: `n${i}`,
      anchor: new THREE.Vector3(...c.anchor),
      label: new THREE.Vector3(...c.label),
      card,
      line,
      mark,
      endPx: st.endPx,
    };
  });
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
    const on = show.notes && !walking;
    calloutGroup.visible = on;
    calloutLayer.style.display = on ? '' : 'none';
    if (!on) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const inputs: (LabelInput & { n: (typeof callouts)[number] })[] = [];
    for (const n of callouts) {
      const a = toScreen(n.anchor);
      const l = toScreen(n.label);
      if (!a || !l || !inView(a, { w, h })) {
        [n.card, n.line, n.mark].forEach(hide);
        continue;
      }
      inputs.push({ id: n.id, n, anchor: a, prefer: l, w: n.card.offsetWidth, h: n.card.offsetHeight });
    }
    // The building's box on screen, kept clear of labels in "clear of the walls" mode.
    let obstacle: ScreenRect | null = null;
    if (data.notePlacement === 'clear') {
      const corners: ({ x: number; y: number } | null)[] = [];
      for (const x of [b.minX, b.maxX])
        for (const y of [0, data.wallTop ?? 2.7])
          for (const z of [b.minY, b.maxY]) corners.push(toScreen(new THREE.Vector3(x, y, z)));
      obstacle = corners.some((p) => !p) ? null : screenBounds(corners);
    }
    // Keep clear of the title and view buttons at the top and the walk button at the bottom.
    const placed = placeNoteLabels(
      inputs,
      { w, h },
      {
        mode: data.notePlacement ?? 'close',
        obstacle,
        insets: {
          l: side.offsetHeight > 90 && w > 900 ? side.offsetWidth + 24 : 0,
          r: 0,
          t: Math.max(views.offsetHeight, title.offsetHeight) + 24,
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

  // ── Room labels (while orbiting) ──
  const roomLayer = el('div', 'ng-rooms');
  root.insertBefore(roomLayer, calloutLayer);
  const roomLabels = (data.rooms ?? []).map((r) => {
    const tag = el('div', 'ng-room');
    tag.append(el('strong', '', r.name), el('span', '', r.area));
    roomLayer.append(tag);
    return { tag, p: new THREE.Vector3(...r.p) };
  });
  const placeRooms = () => {
    const on = show.rooms && !walking && roomLabels.length > 0;
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

  // ── View panel: walls, ceilings, labels, item layers, quality ──
  {
    const view = panel('View', () => setView(false));
    view.append(el('div', 'ng-label', 'Walls while orbiting'));
    view.append(
      segmented<'full' | 'cutaway'>(
        [
          ['full', 'Full'],
          ['cutaway', 'Cutaway'],
        ],
        show.cutaway ? 'cutaway' : 'full',
        (v) => {
          show.cutaway = v === 'cutaway';
          applyVisibility();
        },
      ),
    );
    view.append(
      check('Ceilings', show.ceilings, (on) => {
        show.ceilings = on;
        applyVisibility();
      }),
    );
    if (callouts.length) view.append(check('Notes', show.notes, (on) => (show.notes = on)));
    if (roomLabels.length) view.append(check('Room names', show.rooms, (on) => (show.rooms = on)));
    const layers = data.layers ?? [];
    if (layers.length) {
      view.append(el('div', 'ng-label', layers.length > 1 ? 'Item layers' : 'Items'));
      for (const l of layers)
        view.append(
          check(
            layers.length > 1 ? l.name : 'Furniture & fixtures',
            l.on,
            (on) => {
              layerOn.set(l.id, on);
              applyVisibility();
            },
            layers.length > 1 ? l.color : undefined,
          ),
        );
    }
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
    setView = toggleButton('View', view, false);
  }

  let walking = false;
  let flying = false;
  let yaw = 0;
  let pitch = 0;
  const keys = new Set<string>();
  const move = { x: 0, y: 0 };
  const look = { dx: 0, dy: 0 };
  const wheelWalk = { fwd: 0, strafe: 0 };
  /** Walking and flying speed multipliers, set with the mouse wheel. */
  let walkSpeed = Math.min(WALK_SPEED_MAX, Math.max(0.25, data.walk?.speed ?? 1));
  let flySpeed = 1;

  const resizeOrtho = () => {
    const aspect = window.innerWidth / window.innerHeight;
    const h = Math.max(b.maxY - b.minY, (b.maxX - b.minX) / aspect) * 0.62 + 1;
    ortho.left = -h * aspect;
    ortho.right = h * aspect;
    ortho.top = h;
    ortho.bottom = -h;
    ortho.updateProjectionMatrix();
  };

  // ── Views and tour ──
  /** A camera glide between two perspective views (tour). */
  let glide: {
    from: { p: THREE.Vector3; t: THREE.Vector3; fov: number };
    to: GuestCamera;
    start: number;
    dur: number;
  } | null = null;
  /** The last view chosen; leaving the walkthrough returns to it, as in the app's Guest view. */
  let lastView: GuestCamera | null = null;
  const viewButtons: HTMLButtonElement[] = [];
  const markView = (btn: HTMLButtonElement | null) =>
    viewButtons.forEach((x) => x.classList.toggle('on', x === btn));
  const applyCamera = (c: GuestCamera, animate = false) => {
    if (walking) setWalking(false, undefined, false);
    if (planOpen) setPlan(false);
    glide = null;
    lastView = c;
    markView(viewButtons[data.cameras.indexOf(c)] ?? null);
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
  const tour = data.cameras.length >= 2 ? toggleEl('Tour', 'Play the views one after another') : null;
  const tourBtn = tour?.btn ?? null;
  const setTour = (on: boolean) => {
    tourOn = on;
    controls.autoRotate = false;
    tour?.set(on);
    if (on) {
      if (walking) setWalking(false, undefined, false);
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
    toggles.insertBefore(tourBtn, toggles.children[1] ?? null);
  }

  data.cameras.forEach((c) => {
    const btn = el('button', 'ng-btn', c.name);
    btn.onclick = () => {
      setTour(false);
      applyCamera(c);
    };
    viewButtons.push(btn);
    views.append(btn);
  });

  // Any hands-on input ends the tour.
  for (const ev of ['pointerdown', 'wheel', 'touchstart'] as const)
    renderer.domElement.addEventListener(ev, () => tourOn && setTour(false), { passive: true });

  // ── 2D plan: the plan drawing, pan and zoom; click a spot to walk there ──
  let planOpen = false;
  let youAreHere: SVGGElement | null = null;
  const plan = data.plan ? el('div', 'ng-plan') : null;
  const planBtn = plan ? el('button', 'ng-btn', '2D plan') : null;
  if (plan && planBtn && data.plan) {
    plan.setAttribute('role', 'img');
    plan.setAttribute('aria-label', 'Floor plan');
    plan.innerHTML = data.plan;
    const svg = plan.querySelector('svg');
    const hint = el(
      'div',
      'ng-plan-hint',
      'Drag to pan · scroll or pinch to zoom · click a spot to walk there',
    );
    plan.append(hint);
    if (svg) {
      svg.removeAttribute('width');
      svg.removeAttribute('height');
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      const home = (svg.getAttribute('viewBox') ?? '0 0 10 10').split(/[\s,]+/).map(Number);
      let vb = [...home];
      const setVb = () => svg.setAttribute('viewBox', vb.join(' '));
      youAreHere = document.createElementNS(SVG, 'g');
      const cone = document.createElementNS(SVG, 'path');
      cone.setAttribute('d', 'M0 0 L1.1 -0.55 A1.25 1.25 0 0 1 1.1 0.55 Z');
      cone.setAttribute('fill', 'rgba(46,139,116,.3)');
      const dot = document.createElementNS(SVG, 'circle');
      dot.setAttribute('r', '0.18');
      dot.setAttribute('fill', '#2e8b74');
      dot.setAttribute('stroke', '#fff');
      dot.setAttribute('stroke-width', '0.06');
      youAreHere.append(cone, dot);
      svg.append(youAreHere);
      const toPlan = (x: number, y: number) => {
        const m = svg.getScreenCTM();
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
      let moved = 0;
      let pinch = 0;
      plan.addEventListener('pointerdown', (e) => {
        ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (ptrs.size === 1) moved = 0;
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
          moved = 99;
          return;
        }
        const p0 = toPlan(prev.x, prev.y);
        const p1 = toPlan(now.x, now.y);
        moved += Math.hypot(now.x - prev.x, now.y - prev.y);
        if (!p0 || !p1) return;
        vb[0] -= p1.x - p0.x;
        vb[1] -= p1.y - p0.y;
        setVb();
      });
      const up = (e: PointerEvent) => {
        if (!ptrs.delete(e.pointerId)) return;
        plan.classList.remove('drag');
        if (ptrs.size || moved > 5) return;
        const p = toPlan(e.clientX, e.clientY);
        if (!p || p.x < b.minX || p.x > b.maxX || p.y < b.minY || p.y > b.maxY) return;
        setWalking(true, { x: p.x, y: p.y });
      };
      plan.addEventListener('pointerup', up);
      plan.addEventListener('pointercancel', (e) => ptrs.delete(e.pointerId));
      plan.addEventListener('dblclick', () => {
        vb = [...home];
        setVb();
      });
    }
    root.insertBefore(plan, hud);
    planBtn.onclick = () => {
      setTour(false);
      setPlan(!planOpen);
    };
    views.append(planBtn);
  }
  /** Marks where the walker (or the orbit centre) is on the plan, facing the view direction when walking. */
  const placeHere = () => {
    if (!youAreHere) return;
    const p = walking ? persp.position : controls.target;
    persp.getWorldDirection(fwd);
    const dir = walking ? (Math.atan2(fwd.z, fwd.x) * 180) / Math.PI : 0;
    youAreHere.setAttribute('transform', `translate(${p.x} ${p.z}) rotate(${dir})`);
    youAreHere.firstElementChild?.setAttribute('visibility', walking ? 'visible' : 'hidden');
  };
  function setPlan(on: boolean) {
    if (!plan) return;
    planOpen = on;
    plan.classList.toggle('open', on);
    document.body.classList.toggle('ng-plan-mode', on);
    planBtn?.classList.toggle('on', on);
    if (on) {
      if (document.pointerLockElement) document.exitPointerLock();
      markView(planBtn);
      placeHere();
    } else markView(viewButtons[data.cameras.indexOf(lastView!)] ?? null);
  }

  // Touch controls.
  const stick = el('div', 'ng-stick');
  const knob = el('span', 'ng-knob');
  stick.append(knob);
  const lookPad = el('div', 'ng-look');
  root.append(stick, lookPad);
  let stickId: number | null = null;
  stick.addEventListener('pointerdown', (e) => {
    stickId = e.pointerId;
    stick.setPointerCapture(e.pointerId);
  });
  stick.addEventListener('pointermove', (e) => {
    if (stickId !== e.pointerId) return;
    const r = stick.getBoundingClientRect();
    let x = e.clientX - (r.left + r.width / 2);
    let y = e.clientY - (r.top + r.height / 2);
    const l = Math.hypot(x, y);
    if (l > 44) {
      x = (x / l) * 44;
      y = (y / l) * 44;
    }
    knob.style.transform = `translate(${x}px, ${y}px)`;
    move.x = x / 44;
    move.y = y / 44;
  });
  const endStick = () => {
    stickId = null;
    knob.style.transform = '';
    move.x = 0;
    move.y = 0;
  };
  stick.addEventListener('pointerup', endStick);
  stick.addEventListener('pointercancel', endStick);
  let lookId: number | null = null;
  let last = { x: 0, y: 0 };
  lookPad.addEventListener('pointerdown', (e) => {
    lookId = e.pointerId;
    last = { x: e.clientX, y: e.clientY };
    lookPad.setPointerCapture(e.pointerId);
  });
  lookPad.addEventListener('pointermove', (e) => {
    if (lookId !== e.pointerId) return;
    look.dx += e.clientX - last.x;
    look.dy += e.clientY - last.y;
    last = { x: e.clientX, y: e.clientY };
  });
  lookPad.addEventListener('pointerup', () => (lookId = null));

  const touch = matchMedia('(pointer: coarse)').matches;
  const walkHelp = () =>
    flying
      ? `Flying: move where you look · Space/E up · Q/C down · wheel: speed ${formatSpeed(flySpeed)} · F to walk · Esc to exit`
      : `Click or two-finger swipe to look · W A S D or pinch to move · Shift to run · F to fly · wheel: speed ${formatSpeed(walkSpeed)} · Esc to exit`;
  const setHelp = () => {
    help.textContent = walking
      ? touch
        ? flying
          ? 'Flying: left pad moves where you look · drag right side: look'
          : 'Left pad: move · drag right side: look'
        : walkHelp()
      : touch
        ? 'Drag to orbit · pinch to zoom'
        : 'Drag or two-finger swipe to orbit · Shift-swipe or right-drag to pan · pinch to zoom';
  };
  const setFlying = (on: boolean) => {
    const was = flying;
    flying = on && walking;
    fly.set(flying);
    document.body.classList.toggle('ng-flying', flying);
    // Landing: back to eye height where you are.
    if (was && !flying && walking) persp.position.y = EYE;
    setHelp();
  };
  fly.btn.onclick = () => setFlying(!flying);
  // Touch: up and down buttons while flying (keyboards use Space/E and Q/C).
  const updown = el('div', 'ng-updown');
  for (const [label, code] of [
    ['▲', 'Space'],
    ['▼', 'KeyC'],
  ] as const) {
    const b = el('button', 'ng-btn', label);
    b.setAttribute('aria-label', code === 'Space' ? 'Fly up' : 'Fly down');
    b.addEventListener('pointerdown', (e) => {
      keys.add(code);
      b.setPointerCapture(e.pointerId);
    });
    for (const ev of ['pointerup', 'pointercancel'] as const) b.addEventListener(ev, () => keys.delete(code));
    updown.append(b);
  }
  root.append(updown);
  /**
   * Starts or stops walking; `at` walks from that plan point, keeping the current heading when already
   * walking. Stopping returns to the last view unless `restore` is false (a new view is being applied).
   */
  function setWalking(on: boolean, at?: { x: number; y: number }, restore = true) {
    const was = walking;
    walking = on;
    if (on) {
      glide = null;
      if (tourOn) setTour(false);
      if (planOpen) setPlan(false);
    }
    document.body.classList.toggle('ng-walking', on);
    modeBtn.textContent = on ? 'Exit walkthrough' : 'Walk through';
    fly.btn.style.display = on ? '' : 'none';
    controls.enabled = !on;
    if (on) {
      camera = persp;
      persp.fov = WALK_FOV;
      persp.updateProjectionMatrix();
      if (at) {
        if (!was) yaw = -data.spawn.angle - Math.PI / 2;
        persp.position.set(at.x, EYE, at.y);
      } else {
        persp.position.set(data.spawn.x, EYE, data.spawn.y);
        yaw = -data.spawn.angle - Math.PI / 2;
      }
      if (!was || !at) pitch = 0;
    } else {
      flying = false;
      if (document.pointerLockElement) document.exitPointerLock();
      if (was && restore && lastView) applyCamera(lastView);
    }
    setFlying(false);
    applyVisibility();
  }
  modeBtn.onclick = () => setWalking(!walking);
  const walkClassifier = createWheelClassifier();
  let walkDrag: { id: number; x: number; y: number; moved: boolean } | null = null;
  let suppressLockUntil = -Infinity;
  renderer.domElement.addEventListener('click', () => {
    if (
      walking &&
      !touch &&
      performance.now() >= suppressLockUntil &&
      document.pointerLockElement !== renderer.domElement
    )
      renderer.domElement.requestPointerLock();
  });
  renderer.domElement.addEventListener('pointerdown', (e) => {
    if (!walking || e.button !== 0 || document.pointerLockElement === renderer.domElement) return;
    walkDrag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
    renderer.domElement.setPointerCapture?.(e.pointerId);
  });
  window.addEventListener('pointermove', (e) => {
    if (
      !walking ||
      !walkDrag ||
      walkDrag.id !== e.pointerId ||
      document.pointerLockElement === renderer.domElement
    )
      return;
    const dx = e.clientX - walkDrag.x;
    const dy = e.clientY - walkDrag.y;
    if (Math.hypot(dx, dy) > 3) walkDrag.moved = true;
    walkDrag.x = e.clientX;
    walkDrag.y = e.clientY;
    yaw -= dx * 0.0035;
    pitch = Math.max(-1.3, Math.min(1.3, pitch - dy * 0.0035));
  });
  const endWalkDrag = (e: PointerEvent) => {
    if (!walkDrag || walkDrag.id !== e.pointerId) return;
    if (walkDrag.moved) suppressLockUntil = performance.now() + 120;
    walkDrag = null;
    renderer.domElement.releasePointerCapture?.(e.pointerId);
  };
  window.addEventListener('pointerup', endWalkDrag);
  window.addEventListener('pointercancel', endWalkDrag);
  renderer.domElement.addEventListener(
    'wheel',
    (e) => {
      if (!walking) return;
      e.preventDefault();
      const kind = walkClassifier.classify(e);
      if (kind === 'ignore') return;
      const { x: deltaX, y: deltaY } = wheelDelta(e);
      if (kind === 'pinch' || e.altKey) {
        wheelWalk.fwd += -deltaY * 0.015;
      } else if (e.shiftKey || e.metaKey) {
        wheelWalk.fwd += -deltaY * 0.008;
        wheelWalk.strafe += deltaX * 0.008;
      } else if (kind === 'trackpad') {
        yaw -= deltaX * 0.003;
        pitch = Math.max(-1.3, Math.min(1.3, pitch - deltaY * 0.003));
      } else if (deltaY) {
        // Physical mouse wheel: up = faster, down = slower (walking and flying kept apart).
        if (flying) flySpeed = stepSpeed(flySpeed, -Math.sign(deltaY), FLY_SPEED_MAX);
        else walkSpeed = stepSpeed(walkSpeed, -Math.sign(deltaY), WALK_SPEED_MAX);
        setHelp();
      }
    },
    { passive: false },
  );
  attachSafariGesture(renderer.domElement, ({ scaleRatio, rotationDeg }) => {
    if (!walking) return;
    if (Math.abs(scaleRatio - 1) > 1e-4) {
      walkClassifier.markSafariPinch();
      wheelWalk.fwd += (scaleRatio - 1) * 2.5;
    }
    if (Math.abs(rotationDeg) > 0.05) {
      yaw -= THREE.MathUtils.degToRad(rotationDeg);
    }
  });
  document.addEventListener('mousemove', (e) => {
    if (!walking || document.pointerLockElement !== renderer.domElement) return;
    yaw -= e.movementX * 0.0022;
    pitch = Math.max(-1.3, Math.min(1.3, pitch - e.movementY * 0.0022));
  });
  window.addEventListener('keydown', (e) => {
    keys.add(e.code);
    if (e.code === 'Space' && walking) e.preventDefault();
    if (e.code === 'KeyF' && walking && !e.repeat && !e.ctrlKey && !e.metaKey) setFlying(!flying);
    if (e.code === 'Escape') {
      if (planOpen) setPlan(false);
      else if (walking && !document.pointerLockElement) setWalking(false);
    }
    if (tourOn && e.code !== 'Escape') setTour(false);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
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
    const full = toggleEl('Full screen', 'Full screen (Esc to leave)');
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
    if (data.startMode === 'walk') setWalking(true);
    else if (data.tour?.auto && tourBtn) setTour(true);
  };
  applyCamera(data.startView ?? data.cameras[data.start] ?? data.cameras[0]);
  setWalking(false);
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
      data.startMode === 'walk' ? 'Start walking' : data.tour?.auto ? 'Start the tour' : 'Start exploring',
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
  const look3 = new THREE.Vector3();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(0.05, clock.getDelta());
    const now = performance.now();
    if (planOpen) {
      placeHere();
      return; // The plan covers the scene: no need to draw it.
    }
    if (walking) {
      yaw -= look.dx * 0.005;
      pitch = Math.max(-1.3, Math.min(1.3, pitch - look.dy * 0.005));
      look.dx = 0;
      look.dy = 0;
      let f =
        (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) -
        (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) -
        move.y;
      let s =
        (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) -
        (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) +
        move.x;
      const l = Math.hypot(f, s);
      if (l > 1) {
        f /= l;
        s /= l;
      }
      const wf = wheelWalk.fwd;
      const ws = wheelWalk.strafe;
      wheelWalk.fwd = 0;
      wheelWalk.strafe = 0;
      const run = keys.has('ShiftLeft') || keys.has('ShiftRight');
      if (flying) {
        // Free-fly: along the view (pitch included), up/down keys, no collisions.
        const sp = FLY_SPEED * flySpeed * (run ? 3 : 1) * dt;
        const cp = Math.cos(pitch);
        look3.set(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp);
        const vert =
          (keys.has('Space') || keys.has('KeyE') ? 1 : 0) - (keys.has('KeyQ') || keys.has('KeyC') ? 1 : 0);
        persp.position.addScaledVector(look3, f * sp + wf);
        persp.position.x += Math.cos(yaw) * (s * sp + ws);
        persp.position.z += -Math.sin(yaw) * (s * sp + ws);
        persp.position.y = Math.min(40, Math.max(0.15, persp.position.y + vert * sp));
      } else {
        const speed = WALK_SPEED * walkSpeed * (run ? 2 : 1) * dt;
        const fx = -Math.sin(yaw);
        const fz = -Math.cos(yaw);
        const dx = fx * (f * speed + wf) - fz * (s * speed + ws);
        const dz = fz * (f * speed + wf) + fx * (s * speed + ws);
        if (dx || dz) {
          const next = moveWithCollisions(
            { x: persp.position.x, y: persp.position.z },
            { x: dx, y: dz },
            RADIUS,
            colliders,
          );
          persp.position.x = next.x;
          persp.position.z = next.y;
        }
        persp.position.y = EYE;
      }
      persp.rotation.set(pitch, yaw, 0, 'YXZ');
    } else if (!stepGlide()) {
      stepTour(now);
      // Between glides the tour drifts slowly around the view.
      if (tourOn && camera === persp) controls.autoRotate = true;
      controls.update();
    }
    // Hints, sheets and touch controls sit above the bottom bar, whatever its height (it wraps on phones).
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

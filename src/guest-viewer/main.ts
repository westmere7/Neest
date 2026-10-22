/**
 * Neest guest viewer runtime. Built as a standalone IIFE (vite.guest.config.ts)
 * and inlined into exported guest-view HTML files together with the scene
 * (GLB, base64) and view settings, so the file opens offline in any modern
 * browser without Neest, an account, or access to the creator's storage.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { moveWithCollisions, type Collider } from '@/domain/walkthrough/collision';
import { attachTrackpadOrbit } from '@/features/scene-3d/trackpadOrbit';
import { attachSafariGesture, createWheelClassifier, wheelDelta } from '@/components/trackpad';

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
  colors: { main: string; fill: string; text: string };
  lines: { role: 'title' | 'info' | 'text'; indent: number; runs: { t: string; b?: 1; i?: 1; h?: string }[] }[];
}

export interface GuestData {
  title: string;
  exportedAt: string;
  glb: string;
  cameras: GuestCamera[];
  start: number;
  spawn: { x: number; y: number; angle: number };
  colliders: [number, number, number, number][];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  background: string;
  sun: { dir: [number, number, number]; color: string; intensity: number };
  envIntensity: number;
  exposure: number;
  callouts?: GuestCallout[];
}

declare global {
  interface Window {
    NEEST_GUEST_DATA?: GuestData;
  }
}

const EYE = 1.6;

function b64ToBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

function start(data: GuestData) {
  const root = document.getElementById('neest-guest') ?? document.body;
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = data.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  root.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(data.background);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = data.envIntensity;
  scene.add(new THREE.HemisphereLight('#f4f1ea', '#8a8378', 0.35 * data.envIntensity));
  const b = data.bounds;
  const cx = (b.minX + b.maxX) / 2;
  const cz = (b.minY + b.maxY) / 2;
  const radius = Math.max(4, Math.hypot(b.maxX - b.minX, b.maxY - b.minY) / 2 + 1.5);
  const sun = new THREE.DirectionalLight(data.sun.color, data.sun.intensity);
  sun.position.set(cx + data.sun.dir[0] * radius * 2.5, data.sun.dir[1] * radius * 2.5, cz + data.sun.dir[2] * radius * 2.5);
  sun.target.position.set(cx, 0, cz);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -radius, right: radius, top: radius, bottom: -radius, near: 0.5, far: radius * 6 });
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
  attachTrackpadOrbit(renderer.domElement, () => (controls.enabled ? controls : null));

  const status = el('div', 'ng-loading', 'Loading model…');
  root.appendChild(status);
  new GLTFLoader().parse(
    b64ToBuffer(data.glb),
    '',
    (gltf) => {
      gltf.scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.castShadow = true;
          m.receiveShadow = true;
        }
      });
      scene.add(gltf.scene);
      status.remove();
    },
    () => {
      status.textContent = 'This file’s 3D data could not be read.';
    },
  );

  const colliders: Collider[] = data.colliders.map(([ax, ay, bx, by]) => ({ a: { x: ax, y: ay }, b: { x: bx, y: by } }));

  // ── HUD ──
  const hud = el('div', 'ng-hud');
  const title = el('div', 'ng-title');
  title.append(el('strong', '', data.title), el('span', '', 'View-only 3D walkthrough · made with Neest'));
  const views = el('div', 'ng-views');
  const modeBtn = el('button', 'ng-btn ng-primary', 'Walk through');
  const help = el('div', 'ng-help');
  hud.append(title, views);
  root.append(hud, help);
  const bar = el('div', 'ng-bar');
  bar.append(modeBtn);
  root.append(bar);

  // ── Callouts: leaders in the scene, labels as HTML placed over the canvas each frame ──
  const calloutLayer = el('div', 'ng-callouts');
  root.append(calloutLayer);
  const calloutGroup = new THREE.Group();
  scene.add(calloutGroup);
  const callouts = (data.callouts ?? []).map((c) => {
    const anchor = new THREE.Vector3(...c.anchor);
    const label = new THREE.Vector3(...c.label);
    const lineMat = new THREE.LineBasicMaterial({ color: c.colors.main, depthTest: false, transparent: true });
    const leader = new THREE.Line(new THREE.BufferGeometry().setFromPoints([anchor, label]), lineMat);
    // Anchor dot: constant size on screen, white ring.
    const dc = document.createElement('canvas');
    dc.width = dc.height = 64;
    const g = dc.getContext('2d')!;
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(32, 32, 30, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = c.colors.main;
    g.beginPath();
    g.arc(32, 32, 23, 0, Math.PI * 2);
    g.fill();
    const tex = new THREE.CanvasTexture(dc);
    tex.colorSpace = THREE.SRGBColorSpace;
    const dot = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, sizeAttenuation: false }));
    dot.scale.set(0.02, 0.02, 1);
    dot.position.copy(anchor);
    leader.renderOrder = dot.renderOrder = 999;
    calloutGroup.add(leader, dot);
    if (c.outline && c.outline.length >= 3) {
      const y = c.outlineY ?? 0.025;
      const loop = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(c.outline.map(([x, z]) => new THREE.Vector3(x, y, z))),
        new THREE.LineDashedMaterial({ color: c.colors.main, dashSize: 0.12, gapSize: 0.08 }),
      );
      loop.computeLineDistances();
      calloutGroup.add(loop);
    }
    const card = el('div', 'ng-callout');
    card.style.setProperty('--main', c.colors.main);
    card.style.setProperty('--fill', c.colors.fill);
    card.style.setProperty('--text', c.colors.text);
    for (const line of c.lines) {
      const row = el('div', `ng-cl-${line.role}`);
      if (line.indent) row.style.paddingLeft = `${line.indent * 0.54}em`;
      for (const r of line.runs) {
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
    return { label, card };
  });
  let calloutsOn = callouts.length > 0;
  if (callouts.length) {
    const toggle = el('button', 'ng-btn', 'Hide callouts');
    toggle.onclick = () => {
      calloutsOn = !calloutsOn;
      toggle.textContent = calloutsOn ? 'Hide callouts' : 'Show callouts';
    };
    bar.append(toggle);
  }
  const projected = new THREE.Vector3();
  const placeCallouts = () => {
    const show = calloutsOn && !walking;
    calloutGroup.visible = show;
    calloutLayer.style.display = show ? '' : 'none';
    if (!show) return;
    for (const c of callouts) {
      projected.copy(c.label).project(camera);
      const visible = projected.z < 1 && projected.z > -1;
      c.card.style.display = visible ? '' : 'none';
      if (!visible) continue;
      c.card.style.left = `${((projected.x + 1) / 2) * window.innerWidth}px`;
      c.card.style.top = `${((1 - projected.y) / 2) * window.innerHeight}px`;
    }
  };

  let walking = false;
  let yaw = 0;
  let pitch = 0;
  const keys = new Set<string>();
  const move = { x: 0, y: 0 };
  const look = { dx: 0, dy: 0 };
  const wheelWalk = { fwd: 0, strafe: 0 };

  const resizeOrtho = () => {
    const aspect = window.innerWidth / window.innerHeight;
    const h = Math.max(b.maxY - b.minY, (b.maxX - b.minX) / aspect) * 0.62 + 1;
    ortho.left = -h * aspect;
    ortho.right = h * aspect;
    ortho.top = h;
    ortho.bottom = -h;
    ortho.updateProjectionMatrix();
  };

  const applyCamera = (c: GuestCamera) => {
    setWalking(false);
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

  data.cameras.forEach((c) => {
    const btn = el('button', 'ng-btn', c.name);
    btn.onclick = () => applyCamera(c);
    views.append(btn);
  });

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
  function setWalking(on: boolean) {
    walking = on;
    document.body.classList.toggle('ng-walking', on);
    modeBtn.textContent = on ? 'Exit walkthrough' : 'Walk through';
    controls.enabled = !on;
    help.textContent = on
      ? touch
        ? 'Left pad: move · drag right side: look'
        : 'Click or two-finger swipe to look · W A S D or pinch to move · Shift to run · Esc to exit'
      : touch
        ? 'Drag to orbit · pinch to zoom'
        : 'Drag or two-finger swipe to orbit · Shift-swipe or right-drag to pan · pinch to zoom';
    if (on) {
      camera = persp;
      persp.fov = 70;
      persp.updateProjectionMatrix();
      persp.position.set(data.spawn.x, EYE, data.spawn.y);
      yaw = -data.spawn.angle - Math.PI / 2;
      pitch = 0;
    } else if (document.pointerLockElement) document.exitPointerLock();
  }
  modeBtn.onclick = () => setWalking(!walking);
  const walkClassifier = createWheelClassifier();
  let walkDrag: { id: number; x: number; y: number; moved: boolean } | null = null;
  let suppressLockUntil = -Infinity;
  renderer.domElement.addEventListener('click', () => {
    if (walking && !touch && performance.now() >= suppressLockUntil && document.pointerLockElement !== renderer.domElement)
      renderer.domElement.requestPointerLock();
  });
  renderer.domElement.addEventListener('pointerdown', (e) => {
    if (!walking || e.button !== 0 || document.pointerLockElement === renderer.domElement) return;
    walkDrag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
    renderer.domElement.setPointerCapture?.(e.pointerId);
  });
  window.addEventListener('pointermove', (e) => {
    if (!walking || !walkDrag || walkDrag.id !== e.pointerId || document.pointerLockElement === renderer.domElement) return;
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
      } else {
        wheelWalk.fwd += -Math.sign(deltaY) * 0.35;
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
    if (e.code === 'Escape' && walking && !document.pointerLockElement) setWalking(false);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    persp.aspect = window.innerWidth / window.innerHeight;
    persp.updateProjectionMatrix();
    resizeOrtho();
  });

  applyCamera(data.cameras[data.start] ?? data.cameras[0]);
  setWalking(false);

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(0.05, clock.getDelta());
    if (walking) {
      yaw -= look.dx * 0.005;
      pitch = Math.max(-1.3, Math.min(1.3, pitch - look.dy * 0.005));
      look.dx = 0;
      look.dy = 0;
      let f = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - move.y;
      let s = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + move.x;
      const l = Math.hypot(f, s);
      if (l > 1) {
        f /= l;
        s /= l;
      }
      const wf = wheelWalk.fwd;
      const ws = wheelWalk.strafe;
      wheelWalk.fwd = 0;
      wheelWalk.strafe = 0;
      const speed = 1.5 * (keys.has('ShiftLeft') || keys.has('ShiftRight') ? 2 : 1) * dt;
      const fx = -Math.sin(yaw);
      const fz = -Math.cos(yaw);
      const dx = fx * (f * speed + wf) - fz * (s * speed + ws);
      const dz = fz * (f * speed + wf) + fx * (s * speed + ws);
      if (dx || dz) {
        const next = moveWithCollisions({ x: persp.position.x, y: persp.position.z }, { x: dx, y: dz }, 0.22, colliders);
        persp.position.x = next.x;
        persp.position.z = next.y;
      }
      persp.position.y = EYE;
      persp.rotation.set(pitch, yaw, 0, 'YXZ');
    } else controls.update();
    placeCallouts();
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

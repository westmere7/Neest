import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { PlacedObject, Project } from '@/domain/model/schema';
import { getAsset } from '@/data/assets/registry';
import { subscribePhotos } from '@/features/materials/photoTextures';
import { buildObject } from './builders';
import { loadCustomModel } from './customModels';
import { GI_OFF_Y } from './globalIllumination';
import { sharedRegistry } from './sceneRuntime';

/**
 * Live 3D preview of one placed object (Inspector › Item).
 *
 * One small WebGL renderer for the whole app, created on first use and never per selection or
 * per mount: its canvas moves into whichever preview host is attached (only one at a time).
 * The object is built with `buildObject`, so it has the placed item's size, mirroring and
 * material overrides, sharing the scene's cached geometries and `sharedRegistry` materials
 * (nothing here is disposed). Lighting and framing follow `thumbnailRenderer`.
 *
 * Frames are drawn only while a host is attached, on screen (IntersectionObserver) and the tab
 * is visible: ~30 fps while auto-rotating, on demand otherwise (drag, rebuild, photo maps
 * arriving). Dragging pauses auto-rotation, which resumes a few seconds after release.
 * With prefers-reduced-motion there is no auto-rotation at all. The model is drawn at GI_OFF_Y
 * (far below the floor), so the preview never shows the open apartment's bounce light.
 */

const HEIGHT = 150;
const FOV = 28;
/** Auto-rotation speed (rad/s): one turn in ~18 s. */
const AUTO_SPEED = 0.35;
const RESUME_AFTER_MS = 3000;
const AUTO_FRAME_MS = 1000 / 30;
const DEFAULT_YAW = -0.65;
const DEFAULT_PITCH = 0.5;
const PITCH_MIN = 0.05;
const PITCH_MAX = 1.25;

let gl: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
const camera = new THREE.PerspectiveCamera(FOV, 2, 0.01, 100);
/** Rotates around the model's centre; the camera and lights stay put. */
const pivot = new THREE.Group();
// Drawn far below the floor, where global illumination never applies.
pivot.position.y = GI_OFF_Y;
let failed = false;
let active: Controller | null = null;

function setup(): boolean {
  if (gl) return true;
  if (failed) return false;
  try {
    const canvas = document.createElement('canvas');
    canvas.className = 'object-preview-canvas';
    gl = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
    gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.05;
    gl.setClearColor(0x000000, 0);
    scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(gl);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    scene.environmentIntensity = 0.9;
    const key = new THREE.DirectionalLight('#ffffff', 1.6);
    key.position.set(3, 5, 4);
    scene.add(key, new THREE.HemisphereLight('#ffffff', '#b8b2a6', 0.5), pivot);
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      failed = true;
      gl = null;
      active?.fail();
    });
    // Photo maps load asynchronously; the registry swaps them into the shared materials.
    subscribePhotos(() => active?.invalidate());
    return true;
  } catch {
    failed = true;
    gl = null;
    return false;
  }
}

export type PreviewResult = 'ok' | 'fallback' | 'stale';

export interface PreviewHandle {
  /** Builds and shows an object (rebuild after size/material edits). Resolves 'fallback' when it can't be shown in 3D. */
  show(obj: PlacedObject, project: Project): Promise<PreviewResult>;
  /** Stops rendering and releases the canvas (the renderer itself is kept for the next preview). */
  detach(): void;
}

interface Options {
  reducedMotion: boolean;
  /** WebGL went away (context lost): show a 2D fallback instead. */
  onFail: () => void;
}

class Controller implements PreviewHandle {
  private yaw = DEFAULT_YAW;
  private pitch = DEFAULT_PITCH;
  private objectId: string | null = null;
  private token = 0;
  private hasModel = false;
  /** Half the model's horizontal diagonal (its footprint in any turn) and half its height. */
  private halfDiag = 0.5;
  private halfH = 0.5;
  private dirty = true;
  private attached = true;
  private onScreen = true;
  private dragging: { id: number; x: number; y: number } | null = null;
  private resumeAt = 0;
  private raf = 0;
  private lastFrame = 0;
  private resumeTimer = 0;
  private readonly cleanups: (() => void)[] = [];

  constructor(
    private readonly host: HTMLElement,
    private readonly opts: Options,
  ) {
    host.appendChild(gl!.domElement);
    this.resize();
    const ro = new ResizeObserver(() => this.resize());
    ro.observe(host);
    const io = new IntersectionObserver((entries) => {
      this.onScreen = entries.some((e) => e.isIntersecting);
      this.wake();
    });
    io.observe(host);
    const onVisibility = () => this.wake();
    document.addEventListener('visibilitychange', onVisibility);
    const down = (e: PointerEvent) => this.pointerDown(e);
    const move = (e: PointerEvent) => this.pointerMove(e);
    const up = (e: PointerEvent) => this.pointerUp(e);
    host.addEventListener('pointerdown', down);
    host.addEventListener('pointermove', move);
    host.addEventListener('pointerup', up);
    host.addEventListener('pointercancel', up);
    this.cleanups.push(
      () => ro.disconnect(),
      () => io.disconnect(),
      () => document.removeEventListener('visibilitychange', onVisibility),
      () => {
        host.removeEventListener('pointerdown', down);
        host.removeEventListener('pointermove', move);
        host.removeEventListener('pointerup', up);
        host.removeEventListener('pointercancel', up);
      },
    );
  }

  async show(obj: PlacedObject, project: Project): Promise<PreviewResult> {
    const token = ++this.token;
    const asset = getAsset(project, obj.assetId);
    if (!asset || !gl || !scene) return this.noModel();
    const custom = project.customAssets[obj.assetId];
    const customModels = new Map<string, THREE.Object3D>();
    if (custom) {
      const model = await loadCustomModel(custom.blobId);
      if (token !== this.token || !this.attached) return 'stale';
      if (!model) return this.noModel();
      customModels.set(custom.blobId, model);
    }
    // At the origin and unrotated: the preview turns it, the plan placement doesn't matter.
    const model = buildObject({ ...obj, x: 0, y: 0, elevation: 0, rotation: 0 }, { project, registry: sharedRegistry, customModels, shadows: false });
    const box = new THREE.Box3().setFromObject(model);
    if (box.isEmpty()) return this.noModel();
    const center = box.getCenter(new THREE.Vector3());
    model.position.sub(center);
    const size = box.getSize(new THREE.Vector3());
    this.halfDiag = Math.max(Math.hypot(size.x, size.z) / 2, 0.03);
    this.halfH = Math.max(size.y / 2, 0.005);
    // Compile off the main path where the driver allows it, so a new item doesn't stall a frame.
    try {
      await gl.compileAsync(model, camera, scene);
    } catch {
      // Compiles on first render instead.
    }
    if (token !== this.token || !this.attached || !gl) return 'stale';
    pivot.clear();
    pivot.add(model);
    if (obj.id !== this.objectId) {
      this.objectId = obj.id;
      this.yaw = DEFAULT_YAW;
      this.pitch = DEFAULT_PITCH;
      this.resumeAt = 0;
    }
    this.hasModel = true;
    this.invalidate();
    return 'ok';
  }

  /** Nothing to show in 3D for this object: clear the stage and let the caller draw a fallback. */
  private noModel(): PreviewResult {
    pivot.clear();
    this.hasModel = false;
    this.objectId = null;
    return 'fallback';
  }

  detach() {
    if (!this.attached) return;
    this.attached = false;
    this.token++;
    cancelAnimationFrame(this.raf);
    clearTimeout(this.resumeTimer);
    this.raf = 0;
    for (const fn of this.cleanups) fn();
    if (gl && gl.domElement.parentElement === this.host) this.host.removeChild(gl.domElement);
    if (active === this) {
      active = null;
      pivot.clear();
    }
  }

  invalidate() {
    this.dirty = true;
    this.wake();
  }

  fail() {
    this.detach();
    this.opts.onFail();
  }

  private live(): boolean {
    return this.attached && active === this && this.onScreen && !!gl && document.visibilityState === 'visible';
  }

  private autoRotating(now: number): boolean {
    return !this.opts.reducedMotion && this.hasModel && !this.dragging && now >= this.resumeAt;
  }

  private wake() {
    if (!this.raf && this.live()) this.raf = requestAnimationFrame(this.tick);
  }

  private readonly tick = (now: number) => {
    this.raf = 0;
    if (!this.live()) return;
    const auto = this.autoRotating(performance.now());
    if (auto && now - this.lastFrame >= AUTO_FRAME_MS) {
      this.yaw += (AUTO_SPEED * Math.min(now - this.lastFrame, 100)) / 1000;
      this.dirty = true;
    }
    if (this.dirty) {
      this.draw();
      this.lastFrame = now;
    }
    if (auto) this.raf = requestAnimationFrame(this.tick);
  };

  private draw() {
    if (!gl || !scene) return;
    this.dirty = false;
    pivot.rotation.y = this.yaw;
    const d = this.fitDistance();
    camera.near = d / 50;
    camera.far = d + this.halfDiag * 4 + this.halfH * 4;
    camera.updateProjectionMatrix();
    camera.position.set(0, GI_OFF_Y + Math.sin(this.pitch) * d, Math.cos(this.pitch) * d);
    camera.lookAt(0, GI_OFF_Y, 0);
    gl!.render(scene!, camera);
  }

  /**
   * Camera distance that keeps the item in frame at every turn: its footprint diagonal must fit
   * the width, its height plus the tilted footprint the height (with a margin for perspective).
   */
  private fitDistance(): number {
    const tanV = Math.tan((FOV * Math.PI) / 360);
    const tanH = tanV * camera.aspect;
    const p = this.pitch;
    const byWidth = this.halfDiag / tanH;
    const byHeight = (this.halfH * Math.cos(p) + this.halfDiag * Math.sin(p)) / tanV;
    return Math.max(byWidth, byHeight) * 1.06 + this.halfDiag * 0.3;
  }

  private resize() {
    if (!gl) return;
    const w = Math.max(1, Math.round(this.host.clientWidth));
    const h = Math.max(1, Math.round(this.host.clientHeight || HEIGHT));
    const cur = gl.getSize(new THREE.Vector2());
    if (cur.x !== w || cur.y !== h) gl.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    this.invalidate();
  }

  private pointerDown(e: PointerEvent) {
    if (e.button !== 0 || !this.hasModel) return;
    this.dragging = { id: e.pointerId, x: e.clientX, y: e.clientY };
    this.host.setPointerCapture(e.pointerId);
    this.host.classList.add('dragging');
    clearTimeout(this.resumeTimer);
    e.preventDefault();
  }

  private pointerMove(e: PointerEvent) {
    const d = this.dragging;
    if (!d || d.id !== e.pointerId) return;
    this.yaw += (e.clientX - d.x) * 0.012;
    this.pitch = Math.min(PITCH_MAX, Math.max(PITCH_MIN, this.pitch + (e.clientY - d.y) * 0.008));
    d.x = e.clientX;
    d.y = e.clientY;
    this.invalidate();
  }

  private pointerUp(e: PointerEvent) {
    if (!this.dragging || this.dragging.id !== e.pointerId) return;
    this.dragging = null;
    this.host.classList.remove('dragging');
    if (this.host.hasPointerCapture(e.pointerId)) this.host.releasePointerCapture(e.pointerId);
    this.resumeAt = performance.now() + RESUME_AFTER_MS;
    this.lastFrame = performance.now();
    if (!this.opts.reducedMotion) this.resumeTimer = window.setTimeout(() => this.wake(), RESUME_AFTER_MS + 20);
  }
}

/**
 * Puts the shared preview canvas into `host` and returns its controller, or null when WebGL is
 * unavailable. Attaching another host detaches the previous one.
 */
export function attachPreview(host: HTMLElement, opts: Options): PreviewHandle | null {
  if (!setup()) return null;
  active?.detach();
  active = new Controller(host, opts);
  return active;
}

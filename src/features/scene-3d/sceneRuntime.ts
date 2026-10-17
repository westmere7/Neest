import * as THREE from 'three';
import { MaterialRegistry } from './materialRegistry';

/** Application-wide material registry (materials are renderer-independent). */
export const sharedRegistry = new MaterialRegistry();

/** Handles to the live 3D canvas, registered by the view for captures and exports. */
export interface LiveScene {
  gl: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
  controlsTarget: () => THREE.Vector3 | null;
  /** Hide helper overlays during capture. */
  setHelpersVisible: (v: boolean) => void;
}

export const liveScene: { current: LiveScene | null } = { current: null };

export interface CaptureOptions {
  width: number;
  height: number;
  transparent: boolean;
  includeHelpers: boolean;
}

/**
 * Renders the current 3D camera view to a PNG at a chosen resolution. Uses
 * the live renderer and a clone of the live camera (same position, orientation
 * and vertical field of view) so the result matches the on-screen viewpoint;
 * only the frame's aspect ratio differs when a different ratio is requested.
 */
export async function captureView(opts: CaptureOptions): Promise<Blob> {
  const live = liveScene.current;
  if (!live) throw new Error('Open the 3D view to capture an image.');
  const { gl, scene, camera } = live;
  const max = Math.min(gl.capabilities.maxTextureSize, 8192);
  const scaleDown = Math.min(1, max / Math.max(opts.width, opts.height));
  const w = Math.round(opts.width * scaleDown);
  const h = Math.round(opts.height * scaleDown);
  const prevSize = gl.getSize(new THREE.Vector2());
  const prevRatio = gl.getPixelRatio();
  const prevBg = scene.background;
  const prevClear = gl.getClearAlpha();
  const cam = camera.clone() as THREE.PerspectiveCamera | THREE.OrthographicCamera;
  if ((cam as THREE.PerspectiveCamera).isPerspectiveCamera) {
    (cam as THREE.PerspectiveCamera).aspect = w / h;
  } else {
    const o = cam as THREE.OrthographicCamera;
    const height = o.top - o.bottom;
    o.left = (-height * (w / h)) / 2;
    o.right = (height * (w / h)) / 2;
  }
  cam.clearViewOffset(); // the editor's free-area offset is not part of the shot
  cam.updateProjectionMatrix();
  live.setHelpersVisible(opts.includeHelpers);
  try {
    gl.setPixelRatio(1);
    gl.setSize(w, h, false);
    if (opts.transparent) {
      scene.background = null;
      gl.setClearAlpha(0);
    }
    gl.render(scene, cam);
    const dataUrl = gl.domElement.toDataURL('image/png');
    const res = await fetch(dataUrl);
    return await res.blob();
  } finally {
    scene.background = prevBg;
    gl.setClearAlpha(prevClear);
    gl.setPixelRatio(prevRatio);
    gl.setSize(prevSize.x, prevSize.y, false);
    live.setHelpersVisible(true);
  }
}

// Development-only debugging hook.
if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__NEEST_LIVE__ = liveScene;

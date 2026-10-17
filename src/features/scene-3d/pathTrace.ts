import * as THREE from 'three';
import { GradientEquirectTexture, WebGLPathTracer } from 'three-gpu-pathtracer';
import type { Project } from '@/domain/model/schema';
import { getAsset } from '@/data/assets/registry';
import { liveScene } from './sceneRuntime';
import { sunFromSettings } from './SceneContent';

export interface PathTraceOptions {
  width: number;
  height: number;
  /** Target number of samples per pixel. */
  samples: number;
  /** Maximum light bounces per path. */
  bounces: number;
  transparent: boolean;
  /** Called as samples accumulate. `canvas` shows the image converging. */
  onProgress?: (info: { samples: number; target: number; phase: 'building' | 'tracing' }) => void;
  /** The renderer's canvas, so the UI can show it while it converges. */
  onCanvas?: (canvas: HTMLCanvasElement) => void;
  signal?: AbortSignal;
  /** Resolve early with the current image (keeps the samples rendered so far). */
  stopEarly?: { current: boolean };
}

/** Yields to the event loop without depending on requestAnimationFrame (paused in hidden tabs). */
const frame = () =>
  new Promise<void>((resolve) => {
    const ch = new MessageChannel();
    ch.port1.onmessage = () => resolve();
    ch.port2.postMessage(null);
  });

/**
 * Physically based, progressive GPU path tracing of the current 3D view
 * (three-gpu-pathtracer). Uses a copy of the live scene graph — the same
 * geometry, wall display mode and PBR materials as the viewport — with the
 * live camera (same position, orientation and vertical field of view), a sky
 * gradient environment, the time-of-day sun, and emissive lamp surfaces.
 * Runs locally in the browser; no cloud service.
 */
export async function renderPathTraced(project: Project, o: PathTraceOptions): Promise<Blob> {
  const live = liveScene.current;
  if (!live) throw new Error('Open the 3D view to render an image.');
  const source = live.scene.getObjectByName('neest-plan');
  if (!source) throw new Error('The 3D scene is not ready yet.');

  // ── Scene copy without helpers, labels or selection boxes ──
  const scene = new THREE.Scene();
  const root = source.clone(true);
  const strip: THREE.Object3D[] = [];
  root.traverse((obj) => {
    if ((obj as THREE.Sprite).isSprite || (obj as THREE.Box3Helper).type === 'Box3Helper' || obj.userData.helper) strip.push(obj);
  });
  strip.forEach((obj) => obj.removeFromParent());
  scene.add(root);

  // Ground so exterior light and shadows read naturally.
  const ground = new THREE.Mesh(new THREE.CircleGeometry(80, 48), new THREE.MeshStandardMaterial({ color: '#cbc6bc', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.012;
  scene.add(ground);

  // Lighting: sky gradient environment + sun + lamp point lights.
  const r = project.render;
  const sky = new GradientEquirectTexture(256);
  sky.topColor.set('#bcd5ee');
  sky.bottomColor.set('#a39d93');
  sky.exponent = 2.2;
  sky.update();
  scene.environment = sky;
  scene.environmentIntensity = Math.max(0.05, r.envIntensity * 1.15);
  scene.background = o.transparent ? null : new THREE.Color(r.background);
  const sun = sunFromSettings(r);
  const sunLight = new THREE.DirectionalLight(sun.color, sun.intensity);
  sunLight.position.copy(sun.dir.clone().multiplyScalar(50));
  sunLight.target.position.set(0, 0, 0);
  scene.add(sunLight, sunLight.target);
  let lamps = 0;
  for (const obj of Object.values(project.objects)) {
    const asset = getAsset(project, obj.assetId);
    if (!asset?.light || obj.hidden || lamps >= 16) continue;
    const pl = new THREE.PointLight(asset.light.color, asset.light.intensity * 0.6, asset.light.distance, 2);
    pl.position.set(obj.x, obj.elevation + asset.light.y, obj.y);
    scene.add(pl);
    lamps++;
  }
  scene.updateMatrixWorld(true);

  // ── Camera: identical viewpoint, requested aspect ──
  const camera = live.camera.clone() as THREE.PerspectiveCamera | THREE.OrthographicCamera;
  if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) (camera as THREE.PerspectiveCamera).aspect = o.width / o.height;
  else {
    const oc = camera as THREE.OrthographicCamera;
    const h = oc.top - oc.bottom;
    oc.left = (-h * (o.width / o.height)) / 2;
    oc.right = (h * (o.width / o.height)) / 2;
  }
  camera.clearViewOffset(); // the editor's free-area offset is not part of the render
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);

  // ── Renderer ──
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(o.width, o.height, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = r.exposure;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const max = renderer.capabilities.maxTextureSize;
  if (o.width > max || o.height > max) {
    renderer.dispose();
    throw new Error(`This GPU supports images up to ${max}px; choose a smaller resolution.`);
  }
  o.onCanvas?.(canvas);

  const tracer = new WebGLPathTracer(renderer);
  tracer.bounces = o.bounces;
  tracer.transmissiveBounces = Math.max(4, o.bounces);
  tracer.multipleImportanceSampling = true;
  tracer.filterGlossyFactor = 0.5;
  tracer.renderDelay = 0;
  tracer.fadeDuration = 0;
  tracer.minSamples = 1;
  tracer.dynamicLowRes = false;
  tracer.renderToCanvas = true;
  tracer.tiles.set(2, 2);
  tracer.textureSize.set(1024, 1024);

  try {
    o.onProgress?.({ samples: 0, target: o.samples, phase: 'building' });
    // Let the 'building' status paint, then build the BVH on the main thread (apartment scenes take ~0.1–2 s).
    await frame();
    await frame();
    tracer.setScene(scene, camera);
    let last = performance.now();
    while (tracer.samples < o.samples) {
      if (o.signal?.aborted) throw new DOMException('Render cancelled', 'AbortError');
      if (o.stopEarly?.current && tracer.samples >= 1) break;
      tracer.renderSample();
      // Yield to the browser regularly so the page stays responsive and the GPU is not monopolised.
      if (performance.now() - last > 30) {
        o.onProgress?.({ samples: Math.floor(tracer.samples), target: o.samples, phase: 'tracing' });
        await frame();
        last = performance.now();
      }
    }
    o.onProgress?.({ samples: Math.floor(tracer.samples), target: o.samples, phase: 'tracing' });
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encoding failed.'))), 'image/png'),
    );
    return blob;
  } catch (err) {
    if (!(err instanceof DOMException && err.name === 'AbortError')) console.error('[neest] path tracing failed', err);
    throw err;
  } finally {
    // Defensive cleanup: never let a disposal error mask the real failure.
    const safely = (fn: () => void) => {
      try {
        fn();
      } catch {
        /* ignore */
      }
    };
    safely(() => tracer.dispose());
    safely(() => sky.dispose());
    safely(() => ground.geometry.dispose());
    safely(() => (ground.material as THREE.Material).dispose());
    safely(() => renderer.dispose());
    safely(() => renderer.forceContextLoss());
  }
}

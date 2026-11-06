import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export type HouseLightingMode = 'light' | 'dark';

/**
 * Diffuse irradiance equivalent of Three.js's `RoomEnvironment` at `envIntensity = 1`, expressed in
 * `HemisphereLight` intensity units (`PI * ~1.45`, matching `BRDF_Lambert = irradiance / PI`).
 * Used only when a mobile/driver GPU fails to render `HalfFloatType` PMREM targets and returns black.
 */
export const IBL_HEMI_EQUIVALENT = 4.55;

export interface StudioEnvironment {
  texture: THREE.Texture | null;
  ok: boolean;
  dispose: () => void;
}

/**
 * Checks whether a generated PMREM environment map actually illuminates a `MeshStandardMaterial`
 * on the current WebGL GPU. Reads a single `UnsignedByteType` `RGBAFormat` pixel (universally
 * supported in WebGL 1 & 2 without float-readback extensions).
 */
function probeEnvironmentTexture(renderer: THREE.WebGLRenderer, env: THREE.Texture): boolean {
  const rt = new THREE.WebGLRenderTarget(1, 1, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    depthBuffer: false,
  });
  const geo = new THREE.PlaneGeometry(2, 2);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 1,
    metalness: 0,
    envMap: env,
    envMapIntensity: 1,
  });
  const probeScene = new THREE.Scene();
  probeScene.add(new THREE.Mesh(geo, mat));
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2);
  cam.position.set(0, 0, 1);
  try {
    renderer.setRenderTarget(rt);
    renderer.clear(true, false, false);
    renderer.render(probeScene, cam);
    const px = new Uint8Array(4);
    renderer.readRenderTargetPixels(rt, 0, 0, 1, 1, px);
    return px[0] + px[1] + px[2] >= 16;
  } catch {
    return false;
  } finally {
    rt.dispose();
    geo.dispose();
    mat.dispose();
  }
}

/**
 * Builds the studio `RoomEnvironment` PMREM safely across desktop and mobile GPUs (including iOS
 * Safari / Metal TBDR).
 *
 * Why we render into a `WebGLCubeRenderTarget` via `CubeCamera` before `pmrem.fromCubemap(...)`:
 * `PMREMGenerator.fromScene` allocates a `cubeUVRenderTarget` with `depthBuffer = true` and sets
 * `renderer.autoClear = false` without ever clearing the depth buffer, which on Apple's tile-based
 * Metal WebGL backend (`MTLLoadActionLoad` on an uninitialized depth buffer) can discard every
 * fragment of `RoomEnvironment` and leave `scene.environment` completely black. `CubeCamera` renders
 * each face with `autoClear = true` (`MTLLoadActionClear` on color + depth), and `fromCubemap` then
 * builds the PMREM pyramid with `depthBuffer = false`. A 1×1 pixel readback verifies the result so
 * any GPU where `HalfFloatType` FBOs fail still gets matching brightness via `resolveHouseLighting`.
 */
export function buildStudioEnvironment(renderer: THREE.WebGLRenderer): StudioEnvironment {
  const prevShadow = renderer.shadowMap.enabled;
  const prevClip = renderer.localClippingEnabled;
  const prevTone = renderer.toneMapping;
  const prevAutoClear = renderer.autoClear;
  const prevTarget = renderer.getRenderTarget();
  const prevClearColor = renderer.getClearColor(new THREE.Color());
  const prevClearAlpha = renderer.getClearAlpha();

  let pmremTarget: THREE.WebGLRenderTarget | null = null;
  let room: RoomEnvironment | null = null;
  let cubeRT: THREE.WebGLCubeRenderTarget | null = null;
  let pmrem: THREE.PMREMGenerator | null = null;

  try {
    renderer.shadowMap.enabled = false;
    renderer.localClippingEnabled = false;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.autoClear = true;
    renderer.setClearColor(0x000000, 1);

    room = new RoomEnvironment();
    cubeRT = new THREE.WebGLCubeRenderTarget(256, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      colorSpace: THREE.LinearSRGBColorSpace,
      generateMipmaps: false,
      magFilter: THREE.LinearFilter,
      minFilter: THREE.LinearFilter,
      depthBuffer: true,
    });
    const cubeCam = new THREE.CubeCamera(0.1, 100, cubeRT);
    cubeCam.update(renderer, room);

    pmrem = new THREE.PMREMGenerator(renderer);
    pmremTarget = pmrem.fromCubemap(cubeRT.texture);

    const ok = probeEnvironmentTexture(renderer, pmremTarget.texture);
    if (!ok) {
      pmremTarget.dispose();
      pmremTarget = null;
      return { texture: null, ok: false, dispose: () => {} };
    }
    const target = pmremTarget;
    return {
      texture: target.texture,
      ok: true,
      dispose: () => target.dispose(),
    };
  } catch {
    pmremTarget?.dispose();
    return { texture: null, ok: false, dispose: () => {} };
  } finally {
    room?.dispose();
    cubeRT?.dispose();
    pmrem?.dispose();
    renderer.setRenderTarget(prevTarget);
    renderer.shadowMap.enabled = prevShadow;
    renderer.localClippingEnabled = prevClip;
    renderer.toneMapping = prevTone;
    renderer.autoClear = prevAutoClear;
    renderer.setClearColor(prevClearColor, prevClearAlpha);
  }
}

export interface HouseLightParams {
  mode: HouseLightingMode;
  envOk: boolean;
  envIntensity: number;
  sunColor: string;
  sunIntensity: number;
}

export interface ResolvedHouseLight {
  environmentIntensity: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  sunColor: string;
  sunIntensity: number;
  lampGain: number;
}

/**
 * Computes consistent scene lighting for the 3D house in Light mode (daytime studio + sun) and
 * Dark mode (night-time exterior/ambient so indoor lamp fixtures stand out), without altering the
 * canvas background or the application UI theme.
 */
export function resolveHouseLighting(p: HouseLightParams): ResolvedHouseLight {
  if (p.mode === 'dark') {
    const effectiveEnv = Math.min(p.envIntensity, 0.04);
    return {
      environmentIntensity: p.envOk ? effectiveEnv : 0,
      hemiSky: '#b8cae8',
      hemiGround: '#4e525a',
      hemiIntensity: 0.14 + (p.envOk ? 0 : IBL_HEMI_EQUIVALENT * effectiveEnv),
      sunColor: '#bfd0ee',
      sunIntensity: Math.min(p.sunIntensity, 0.16),
      lampGain: 1.25,
    };
  }
  const effectiveEnv = p.envIntensity;
  return {
    environmentIntensity: p.envOk ? effectiveEnv : 0,
    hemiSky: '#f7f9fb',
    hemiGround: p.envOk ? '#888c90' : '#c8c5be',
    hemiIntensity: (p.envOk ? 0.35 : 0.35 + IBL_HEMI_EQUIVALENT) * effectiveEnv,
    sunColor: p.sunColor,
    sunIntensity: p.sunIntensity,
    lampGain: 1,
  };
}

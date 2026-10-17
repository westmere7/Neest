import { useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import type { Project } from '@/domain/model/schema';
import type { DerivedPlan } from '@/domain/geometry/derive';
import { pointInPolygon } from '@/domain/geometry/polygon';

/**
 * Cheap global illumination for Ultra: per-room irradiance probes.
 *
 * For every room a tiny cube view (32 px) is captured from inside it with the real sun, lamps and
 * finishes, and reduced to L1 spherical harmonics: the light (and its colour) arriving from each
 * direction. The probes are written into a small floor-plan texture (one cell every 40 cm, the
 * room's probe in every cell of its footprint) that every standard/physical material samples by
 * world position, adding the bounce light to its indirect diffuse. Texture filtering blends rooms
 * smoothly across doorways. Rebaked only when the project or lighting changes (debounced); per
 * frame it is one texture lookup per pixel.
 *
 * Everything the shader needs is inside the one texture (an extra row holds the grid box, the
 * grid size and the strength), so no per-material uniforms have to be kept in sync: three clones
 * material uniforms, but cloned textures share their data source and all pick up a rebake. The
 * texture never changes size (GPU texture storage is fixed once allocated): three tiles of
 * MAX_CELLS rows plus the metadata row, of which a bake uses the top-left W × H cells.
 */

const CELL = 0.4;
const MAX_CELLS = 96;
const PROBE_HEIGHT = 1.3;
/** Bounce added on top of the environment light. */
export const GI_STRENGTH = 1;
/**
 * Colour of the bounce is pushed away from grey by this factor. A probe averages a whole room,
 * so even a saturated floor only tints it a little; real colour bleeding is strongest next to
 * the coloured surface, which one probe per room cannot resolve, so the tint is exaggerated.
 */
const GI_CHROMA = 1.8;

const TEX_W = MAX_CELLS;
const TEX_H = 3 * MAX_CELLS + 1;
const META_ROW = TEX_H - 1;
const emptyData = () => new Uint16Array(TEX_W * TEX_H * 4);
const GI_TEX = new THREE.DataTexture(emptyData(), TEX_W, TEX_H, THREE.RGBAFormat, THREE.HalfFloatType);
GI_TEX.magFilter = THREE.LinearFilter;
GI_TEX.minFilter = THREE.LinearFilter;
GI_TEX.colorSpace = THREE.NoColorSpace;
GI_TEX.needsUpdate = true;
// three clones material uniforms, and a cloned texture keeps its own version counter, so clones
// would never see a rebake. Every material must share this one texture: cloning returns itself.
GI_TEX.clone = () => GI_TEX;

const GLSL = /* glsl */ `
#ifdef STANDARD
uniform sampler2D neestGI;
// Bounce light from the room probes at a view-space position and normal (0 when GI is off).
vec3 neestGIIrradiance( vec3 viewPos, vec3 viewNormal ) {
	ivec2 ts = textureSize( neestGI, 0 );
	vec4 box = texelFetch( neestGI, ivec2( 0, ts.y - 1 ), 0 );
	vec4 meta = texelFetch( neestGI, ivec2( 1, ts.y - 1 ), 0 );
	float strength = meta.x;
	if ( strength <= 0.0 ) return vec3( 0.0 );
	vec3 wp = ( inverse( viewMatrix ) * vec4( viewPos, 1.0 ) ).xyz;
	// Previews and thumbnails draw far below the floor (GI_OFF_Y) and get no bounce light.
	if ( wp.y < -100.0 ) return vec3( 0.0 );
	vec2 uv = ( wp.xz - box.xy ) / box.zw;
	if ( any( lessThan( uv, vec2( 0.0 ) ) ) || any( greaterThan( uv, vec2( 1.0 ) ) ) ) return vec3( 0.0 );
	// Used grid: meta.y × meta.z cells; tiles are ( ts.y - 1 ) / 3 rows apart.
	float TW = float( ts.x );
	float T = float( ts.y );
	float tile = float( ( ts.y - 1 ) / 3 );
	float u = ( 0.5 + uv.x * ( meta.y - 1.0 ) ) / TW;
	float v = 0.5 + uv.y * ( meta.z - 1.0 );
	vec4 t0 = texture( neestGI, vec2( u, v / T ) );
	vec4 t1 = texture( neestGI, vec2( u, ( v + tile ) / T ) );
	vec4 t2 = texture( neestGI, vec2( u, ( v + 2.0 * tile ) / T ) );
	vec3 c0 = t0.rgb;
	vec3 c1 = vec3( t0.a, t1.r, t1.g );
	vec3 c2 = vec3( t1.b, t1.a, t2.r );
	vec3 c3 = t2.gba;
	vec3 n = inverseTransformDirection( viewNormal, viewMatrix );
	vec3 e = c0 * 0.886227 + 1.023328 * ( c1 * n.y + c2 * n.z + c3 * n.x );
	e = max( e, vec3( 0.0 ) );
	float luma = dot( e, vec3( 0.2126, 0.7152, 0.0722 ) );
	e = max( vec3( luma ) + ( e - vec3( luma ) ) * ${GI_CHROMA.toFixed(2)}, vec3( 0.0 ) );
	return e * strength;
}
#endif
`;

/**
 * Adds the GI lookup to three's lighting chunks (before any material compiles). Idempotent by
 * content, not by a module flag: hot reloads re-run this module, and a second copy of the
 * function in the shader fails to compile. The uniform always points at this module's texture.
 */
function patchShaders() {
  // Always rebuilt from three's original chunks (kept on first patch), so a reload of this module
  // replaces the GI code instead of adding a second copy (which would not compile).
  const chunks = THREE.ShaderChunk as typeof THREE.ShaderChunk & { __neestOriginal?: { pars: string; maps: string } };
  chunks.__neestOriginal ??= { pars: chunks.lights_pars_begin, maps: chunks.lights_fragment_maps };
  chunks.lights_pars_begin = chunks.__neestOriginal.pars + GLSL;
  chunks.lights_fragment_maps =
    `#if defined( RE_IndirectDiffuse ) && defined( STANDARD )\n\tirradiance += neestGIIrradiance( - vViewPosition, geometryNormal );\n#endif\n` +
    chunks.__neestOriginal.maps;
  for (const lib of [THREE.ShaderLib.standard, THREE.ShaderLib.physical]) lib.uniforms.neestGI = { value: GI_TEX };
}
patchShaders();

let lastData: Uint16Array | null = null;

function upload(data: Uint16Array) {
  GI_TEX.image = { data, width: TEX_W, height: TEX_H };
  GI_TEX.needsUpdate = true;
}

/** Turns GI off (all zero, strength 0). */
function clearGI() {
  lastData = null;
  upload(emptyData());
}

/**
 * Other renderers that share three's materials (library thumbnails, the Inspector preview) must
 * not pick up the open apartment's bounce light. They draw their model at this height, which
 * the GI lookup ignores: no texture swaps or uploads, so it costs nothing per frame.
 */
export const GI_OFF_Y = -1000;

/** Kept for callers; rendering at GI_OFF_Y is what keeps GI out. */
export function withoutGI<T>(fn: () => T): T {
  return fn();
}

const half = THREE.DataUtils.toHalfFloat;

/**
 * L1 spherical harmonics (4 RGB coefficients) of a cube capture, read back synchronously.
 * Same face directions, flip and solid-angle weights as three's LightProbeGenerator, whose async
 * readback can stall indefinitely on some drivers; the cube is only 32 px, so a synchronous read
 * per face is cheap.
 */
function projectL1(gl: THREE.WebGLRenderer, rt: THREE.WebGLCubeRenderTarget): THREE.Vector3[] {
  const flip = gl.coordinateSystem === THREE.WebGLCoordinateSystem ? -1 : 1;
  const w = rt.width;
  const data = new Uint16Array(w * w * 4);
  const out = [0, 1, 2, 3].map(() => new THREE.Vector3());
  const coord = new THREE.Vector3();
  const from = THREE.DataUtils.fromHalfFloat;
  const px = 2 / w;
  let total = 0;
  for (let face = 0; face < 6; face++) {
    gl.readRenderTargetPixels(rt, 0, 0, w, w, data, face);
    for (let i = 0; i < data.length; i += 4) {
      const p = i / 4;
      const col = (1 - ((p % w) + 0.5) * px) * flip;
      const row = 1 - (Math.floor(p / w) + 0.5) * px;
      switch (face) {
        case 0: coord.set(-1 * flip, row, col * flip); break;
        case 1: coord.set(1 * flip, row, -col * flip); break;
        case 2: coord.set(col, 1, -row); break;
        case 3: coord.set(col, -1, row); break;
        case 4: coord.set(col, row, 1); break;
        default: coord.set(-col, row, -1);
      }
      const l2 = coord.lengthSq();
      const weight = 4 / (Math.sqrt(l2) * l2);
      total += weight;
      coord.normalize();
      const r = from(data[i]) * weight;
      const g = from(data[i + 1]) * weight;
      const b = from(data[i + 2]) * weight;
      // Basis: 0.282095, 0.488603 * (y, z, x), as SphericalHarmonics3.getBasisAt.
      const basis = [0.282095, 0.488603 * coord.y, 0.488603 * coord.z, 0.488603 * coord.x];
      for (let j = 0; j < 4; j++) {
        out[j].x += basis[j] * r;
        out[j].y += basis[j] * g;
        out[j].z += basis[j] * b;
      }
    }
  }
  const norm = (4 * Math.PI) / total;
  for (const c of out) c.multiplyScalar(norm);
  return out;
}

/** Captures one probe per room and writes the GI texture. */
let bakeStep = 'idle';
async function bake(gl: THREE.WebGLRenderer, scene: THREE.Scene, derived: DerivedPlan): Promise<void> {
  bakeStep = 'start';
  const faces = derived.faces.filter((f) => f.area > 0.5);
  if (!faces.length) return clearGI();
  // Capture without our own bounce (no feedback), helpers or gizmo, and without redrawing shadow maps.
  const hidden: THREE.Object3D[] = [];
  scene.traverse((o) => {
    if ((o.name === 'neest-gizmo' || o.name === 'neest-grid' || o.userData?.helper) && o.visible) hidden.push(o);
  });
  hidden.forEach((o) => (o.visible = false));
  const shadowAuto = gl.shadowMap.autoUpdate;
  // Black background: the probes measure only light bouncing off real surfaces. Ceilings are
  // usually hidden, and the grey background showing through the open top of every room would
  // otherwise make up half of each capture and wash the room's colours out.
  const background = scene.background;
  scene.background = new THREE.Color(0x000000);
  gl.shadowMap.autoUpdate = false;
  const prevTex = lastData;
  upload(emptyData());
  const rt = new THREE.WebGLCubeRenderTarget(32, { type: THREE.HalfFloatType });
  const cam = new THREE.CubeCamera(0.05, 60, rt);
  const sh: THREE.Vector3[][] = [];
  try {
    for (const f of faces) {
      cam.position.set(f.label.x, PROBE_HEIGHT, f.label.y);
      bakeStep = 'capture ' + sh.length;
      cam.update(gl, scene);
      bakeStep = 'readback ' + sh.length;
      sh.push(projectL1(gl, rt));
    }
  } finally {
    rt.dispose();
    gl.shadowMap.autoUpdate = shadowAuto;
    scene.background = background;
    hidden.forEach((o) => (o.visible = true));
    if (prevTex) upload(prevTex);
  }

  // Floor-plan grid over all rooms; each cell takes the probe of the room it lies in.
  let minX = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;
  for (const f of faces) {
    minX = Math.min(minX, f.bounds.minX);
    minZ = Math.min(minZ, f.bounds.minY);
    maxX = Math.max(maxX, f.bounds.maxX);
    maxZ = Math.max(maxZ, f.bounds.maxY);
  }
  minX -= 0.5;
  minZ -= 0.5;
  maxX += 0.5;
  maxZ += 0.5;
  const W = Math.max(2, Math.min(MAX_CELLS, Math.ceil((maxX - minX) / CELL) + 1));
  const H = Math.max(2, Math.min(MAX_CELLS, Math.ceil((maxZ - minZ) / CELL) + 1));
  const data = emptyData();
  const put = (x: number, y: number, v: [number, number, number, number]) => {
    const i = (y * TEX_W + x) * 4;
    for (let k = 0; k < 4; k++) data[i + k] = half(v[k]);
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = { x: minX + (x / (W - 1)) * (maxX - minX), y: minZ + (y / (H - 1)) * (maxZ - minZ) };
      const i = faces.findIndex((f) => pointInPolygon(p, f.centerline));
      if (i < 0) continue;
      const [c0, c1, c2, c3] = sh[i];
      put(x, y, [c0.x, c0.y, c0.z, c1.x]);
      put(x, y + MAX_CELLS, [c1.y, c1.z, c2.x, c2.y]);
      put(x, y + 2 * MAX_CELLS, [c2.z, c3.x, c3.y, c3.z]);
    }
  }
  put(0, META_ROW, [minX, minZ, maxX - minX, maxZ - minZ]);
  put(1, META_ROW, [GI_STRENGTH, W, H, 0]);
  lastData = data;
  upload(data);
  bakeStep = 'done';
}

/**
 * Bakes the room probes in Ultra quality once the view is ready, and again (debounced) whenever
 * the project or its lighting changes; switches GI off otherwise.
 */
export function GlobalIllumination({ enabled, project, derived }: { enabled: boolean; project: Project; derived: DerivedPlan }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    bakeStep = 'effect ' + String(enabled);
    if (!enabled) {
      clearGI();
      invalidate();
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      bake(gl, scene, derived)
        .catch((e) => console.warn('[neest] GI bake failed', e))
        .finally(() => !cancelled && invalidate());
    }, 700);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [enabled, project, derived, gl, scene, invalidate]);
  useEffect(() => () => clearGI(), []);
  return null;
}

/** Whether a bake is active (for tests and diagnostics). */
export const giActive = (): boolean => lastData !== null;
if (import.meta.env.DEV) (window as unknown as { __NEEST_GI__: unknown }).__NEEST_GI__ = { giActive: () => giActive(), giDebug: () => giDebug(), withoutGI, step: () => bakeStep, setStrength: (v: number) => { if (!lastData) return; const i = (META_ROW * TEX_W + 1) * 4; lastData[i] = half(v); upload(lastData); } };

/** Diagnostics: metadata and how many grid cells carry a probe. */
export function giDebug() {
  const d = (GI_TEX.image as unknown as { data: Uint16Array }).data;
  const f = THREE.DataUtils.fromHalfFloat;
  const meta = [0, 1].map((x) => Array.from(d.slice((META_ROW * TEX_W + x) * 4, (META_ROW * TEX_W + x) * 4 + 4)).map(f));
  let filled = 0;
  for (let i = 0; i < MAX_CELLS * TEX_W; i++) if (d[i * 4] !== 0) filled++;
  const lm = lastData ? [0, 1].map((x) => Array.from(lastData!.slice((META_ROW * TEX_W + x) * 4, (META_ROW * TEX_W + x) * 4 + 4)).map(f)) : null;
  return { meta, lastMeta: lm, filled, same: d === lastData, chunkPatched: THREE.ShaderChunk.lights_fragment_maps.includes('neestGIIrradiance') };
}

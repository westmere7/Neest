import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { Pass } from 'three/examples/jsm/postprocessing/Pass.js';
import type { RenderSettings } from '@/domain/model/schema';

const SELECT = new THREE.Color('#14b89a');
const SELECT_HIDDEN = new THREE.Color('#5fe0c8');
/** The item a selected note points at: amber and pulsing, so it never reads as selected itself. */
const NOTED = new THREE.Color('#ff8a00');
const NOTED_HIDDEN = new THREE.Color('#ffa024');
const OUTLINED = new Set(['object', 'opening', 'wall']);
/** Scene overlays drawn after ambient occlusion, on top of everything (the transform gizmo). */
const OVERLAY_NAMES = new Set(['neest-gizmo']);

/** Draws the overlay roots into the current buffer after the effects, with their own depth. */
class OverlayPass extends Pass {
  roots: THREE.Object3D[] = [];
  private camera: THREE.Camera;
  constructor(camera: THREE.Camera) {
    super();
    this.camera = camera;
    this.needsSwap = false;
  }
  render(renderer: THREE.WebGLRenderer, _write: THREE.WebGLRenderTarget, read: THREE.WebGLRenderTarget) {
    if (!this.roots.length) return;
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setRenderTarget(this.renderToScreen ? null : read);
    renderer.clearDepth();
    for (const r of this.roots) {
      r.visible = true;
      renderer.render(r, this.camera);
    }
    renderer.autoClear = autoClear;
  }
}

/**
 * Post-processing for the live 3D view; it takes over rendering (useFrame priority 1).
 *
 * - Ambient occlusion (GTAO) in Ultra: soft contact shadows in corners, under and around
 *   furniture. It is computed from the depth of what was actually rendered, so cutaway and faded
 *   walls (clipped or transparent) cast no occlusion, and the transform gizmo is drawn afterwards
 *   on top, untouched by it.
 * - Selection outline at every quality: a bold edge around the selected objects, openings and
 *   walls, drawn in a lighter tint where something hides them (a door or window seen through its
 *   wall, a chair behind a sofa), so the selection is always visible.
 * - Note target outline: the items a selected note points at get a second, amber pulsing outline
 *   (also seen through walls), different from the selection's.
 *
 * Rendering goes through a half-float, 4× multisampled target (with a depth texture for the AO),
 * so antialiasing and the HDR range are kept; OutputPass applies the renderer's tone mapping,
 * exposure and sRGB conversion.
 */
export function PostEffects({
  quality,
  selectedIds,
  notedIds,
  paused,
}: {
  quality: RenderSettings['quality'];
  selectedIds?: Set<string>;
  /** Items a selected note points at. */
  notedIds?: Set<string>;
  paused?: boolean;
}) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const ao = quality === 'ultra';

  const { composer, outline, noted, gtao, overlay } = useMemo(() => {
    const target = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      samples: quality === 'draft' ? 0 : 4,
      // Only with AO; passing depthTexture: undefined makes three's RenderTarget setter throw.
      ...(ao ? { depthTexture: new THREE.DepthTexture(1, 1) } : {}),
    });
    const composer = new EffectComposer(gl, target);
    composer.addPass(new RenderPass(scene, camera));
    let gtao: GTAOPass | null = null;
    if (ao) {
      gtao = new GTAOPass(scene, camera, 1, 1);
      gtao.output = GTAOPass.OUTPUT.Default;
      gtao.blendIntensity = 1;
      gtao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.5, thickness: 1, scale: 1, samples: 24 });
      gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 8, rings: 2, samples: 16 });
      composer.addPass(gtao);
    }
    const noted = new OutlinePass(new THREE.Vector2(1, 1), scene, camera);
    noted.visibleEdgeColor.copy(NOTED);
    noted.hiddenEdgeColor.copy(NOTED_HIDDEN);
    noted.edgeStrength = 10;
    noted.edgeThickness = 1.5;
    noted.edgeGlow = 0.8;
    noted.pulsePeriod = 1.6;
    noted.enabled = false;
    composer.addPass(noted);
    const outline = new OutlinePass(new THREE.Vector2(1, 1), scene, camera);
    outline.visibleEdgeColor.copy(SELECT);
    outline.hiddenEdgeColor.copy(SELECT_HIDDEN);
    outline.edgeStrength = 8;
    outline.edgeThickness = 2;
    outline.edgeGlow = 0.4;
    outline.enabled = false;
    composer.addPass(outline);
    const overlay = new OverlayPass(camera);
    composer.addPass(overlay);
    composer.addPass(new OutputPass());
    return { composer, outline, noted, gtao, overlay };
  }, [gl, scene, camera, quality, ao]);

  useEffect(() => {
    composer.setPixelRatio(gl.getPixelRatio());
    composer.setSize(size.width, size.height);
  }, [composer, gl, size]);
  useEffect(
    () => () => {
      gtao?.dispose();
      outline.dispose();
      noted.dispose();
      composer.dispose();
    },
    [composer, outline, noted, gtao],
  );

  useFrame(() => {
    // While shaders compile in the background (first load) nothing is drawn; the loading screen covers it.
    if (paused) return;
    // Outline whatever is selected: object, opening and wall groups carry { kind, id } in
    // userData. Looked up per frame because groups are rebuilt when the selection is moved or
    // edited. Overlay roots are collected in the same walk.
    const picked: THREE.Object3D[] = [];
    const overlays: THREE.Object3D[] = [];
    const notedPicked: THREE.Object3D[] = [];
    const sel = selectedIds?.size ? selectedIds : null;
    const nt = notedIds?.size ? notedIds : null;
    scene.traverse((o) => {
      if (OVERLAY_NAMES.has(o.name) && o.visible) overlays.push(o);
      const id = sel || nt ? (o.userData?.id as string | undefined) : undefined;
      if (!id || !OUTLINED.has(o.userData.kind)) return;
      if (sel?.has(id)) picked.push(o);
      if (nt?.has(id)) notedPicked.push(o);
    });
    outline.selectedObjects = picked;
    outline.enabled = picked.length > 0;
    noted.selectedObjects = notedPicked;
    noted.enabled = notedPicked.length > 0;
    // AO samples the depth the scene pass just wrote (it respects clipping and transparency).
    const depth = composer.readBuffer.depthTexture;
    if (gtao && depth && gtao.depthTexture !== depth) gtao.setGBuffer(depth);
    // Overlays are hidden for the scene, AO and outline passes and drawn last by OverlayPass.
    for (const o of overlays) o.visible = false;
    overlay.roots = overlays;
    composer.render();
    for (const o of overlays) o.visible = true;
  }, 1);
  return null;
}

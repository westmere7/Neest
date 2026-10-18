import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';

/**
 * Floor reflections (ultra quality): the scene is drawn once more per frame, mirrored in the floor
 * plane, into a half-resolution target with mipmaps. Floors draw with a copy of their material that
 * blends that image into their own shading: sharp on polished floors, blurred (a higher mip)
 * and fainter as roughness rises, nothing on matte ones, and stronger at grazing angles (Fresnel).
 *
 * Every floor slab's top is at FLOOR_Y (buildFloor), so one mirror serves all rooms.
 */

export const FLOOR_Y = 0.002;
/** Above this roughness a floor shows no reflection at all. */
const MAX_ROUGHNESS = 0.75;

const uniforms = {
  neestReflMap: { value: null as THREE.Texture | null },
  neestReflMatrix: { value: new THREE.Matrix4() },
  neestReflOn: { value: 0 },
};

/** Floor meshes drawn with a reflective copy (hidden during the mirror pass: no feedback). */
const floorMeshes = new Set<THREE.Mesh>();
export function registerReflectiveFloor(mesh: THREE.Mesh): () => void {
  floorMeshes.add(mesh);
  return () => void floorMeshes.delete(mesh);
}

function patch(shader: THREE.WebGLProgramParametersWithUniforms): void {
  Object.assign(shader.uniforms, uniforms);
  shader.vertexShader = shader.vertexShader
    .replace(
      '#include <common>',
      '#include <common>\nuniform mat4 neestReflMatrix;\nvarying vec4 vNeestRefl;',
    )
    .replace(
      '#include <project_vertex>',
      '#include <project_vertex>\nvNeestRefl = neestReflMatrix * modelMatrix * vec4( transformed, 1.0 );',
    );
  shader.fragmentShader = shader.fragmentShader
    .replace(
      '#include <common>',
      '#include <common>\nuniform sampler2D neestReflMap;\nuniform float neestReflOn;\nvarying vec4 vNeestRefl;',
    )
    .replace(
      '#include <opaque_fragment>',
      `if ( neestReflOn > 0.5 && roughnessFactor < ${MAX_ROUGHNESS.toFixed(2)} ) {
  vec2 ruv = vNeestRefl.xy / vNeestRefl.w;
  // Bumpy floors ripple the reflection a little.
  ruv += ( normal - nonPerturbedNormal ).xy * 0.03;
  float gloss = 1.0 - roughnessFactor / ${MAX_ROUGHNESS.toFixed(2)};
  vec3 refl = textureLod( neestReflMap, ruv, roughnessFactor * 9.0 ).rgb;
  float ndv = saturate( dot( normal, normalize( vViewPosition ) ) );
  float fresnel = 0.04 + 0.96 * pow( 1.0 - ndv, 5.0 );
  // Fade out towards the edges of the mirror image (nothing was drawn past them).
  vec2 edge = smoothstep( 0.0, 0.04, ruv ) * smoothstep( 1.0, 0.96, ruv );
  float k = 0.85 * fresnel * gloss * gloss * edge.x * edge.y;
  // The mirror image takes the place of that share of the floor's own shading (a dark chair
  // reflects darker), as specular reflection does.
  outgoingLight = mix( outgoingLight, refl, k );
}
#include <opaque_fragment>`,
    );
}

/** Reflective copies of floor materials, cached per source material. */
const copies = new Map<string, { src: THREE.Material; copy: THREE.Material }>();
const keep = (c: THREE.Material) => {
  c.onBeforeCompile = patch;
  c.customProgramCacheKey = () => 'neest-floor-reflect';
};

export function reflectiveMaterial(src: THREE.Material): THREE.Material {
  if (!(src as THREE.MeshStandardMaterial).isMeshStandardMaterial) return src;
  let c = copies.get(src.uuid);
  if (!c) {
    const copy = src.clone();
    keep(copy);
    c = { src, copy };
    copies.set(src.uuid, c);
  }
  return c.copy;
}

/** Per frame: copies follow in-place edits of their source (colour, maps, roughness). */
function syncCopies(): void {
  for (const { src, copy } of copies.values()) {
    const a = copy as THREE.MeshStandardMaterial;
    const b = src as THREE.MeshStandardMaterial;
    if (
      a.map === b.map &&
      a.normalMap === b.normalMap &&
      a.roughnessMap === b.roughnessMap &&
      a.color.equals(b.color) &&
      a.roughness === b.roughness &&
      a.metalness === b.metalness
    )
      continue;
    const maps = `${!!a.map}${!!a.normalMap}${!!a.roughnessMap}`;
    a.copy(b);
    keep(a);
    if (maps !== `${!!a.map}${!!a.normalMap}${!!a.roughnessMap}`) a.needsUpdate = true;
  }
}

const HIDDEN_IN_MIRROR = new Set(['neest-gizmo', 'neest-grid']);

/** The mirror pass. Mount once inside the canvas; `enabled` on ultra quality. */
export function FloorReflections({ enabled }: { enabled: boolean }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  const target = useMemo(() => {
    if (!enabled) return null;
    return new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
    });
  }, [enabled]);
  useEffect(() => {
    if (!target) return;
    target.setSize(
      Math.max(1, Math.round((size.width * dpr) / 2)),
      Math.max(1, Math.round((size.height * dpr) / 2)),
    );
  }, [target, size.width, size.height, dpr]);
  useEffect(() => {
    uniforms.neestReflMap.value = target?.texture ?? null;
    uniforms.neestReflOn.value = 0;
    return () => {
      target?.dispose();
      uniforms.neestReflMap.value = null;
      uniforms.neestReflOn.value = 0;
    };
  }, [target]);

  const tmp = useMemo(
    () => ({
      cam: new THREE.PerspectiveCamera(),
      normal: new THREE.Vector3(0, 1, 0),
      mirror: new THREE.Vector3(0, FLOOR_Y, 0),
      camPos: new THREE.Vector3(),
      rot: new THREE.Matrix4(),
      look: new THREE.Vector3(),
      view: new THREE.Vector3(),
      tgt: new THREE.Vector3(),
      plane: new THREE.Plane(),
      clip: new THREE.Vector4(),
      q: new THREE.Vector4(),
      bias: new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1),
    }),
    [],
  );

  useFrame(({ camera }) => {
    syncCopies();
    if (!target) return;
    const t = tmp;
    const persp = camera as THREE.PerspectiveCamera;
    t.camPos.setFromMatrixPosition(camera.matrixWorld);
    // Only a perspective view from above the floor sees a reflection.
    if (!persp.isPerspectiveCamera || t.camPos.y <= FLOOR_Y + 0.01 || !floorMeshes.size) {
      uniforms.neestReflOn.value = 0;
      return;
    }
    // Mirror the camera in the floor plane (as three's Reflector does).
    t.rot.extractRotation(camera.matrixWorld);
    t.look.set(0, 0, -1).applyMatrix4(t.rot).add(t.camPos);
    t.view.subVectors(t.mirror, t.camPos).reflect(t.normal).negate().add(t.mirror);
    t.tgt.subVectors(t.mirror, t.look).reflect(t.normal).negate().add(t.mirror);
    const cam = t.cam;
    cam.position.copy(t.view);
    cam.up.set(0, 1, 0).applyMatrix4(t.rot).reflect(t.normal);
    cam.lookAt(t.tgt);
    cam.near = persp.near;
    cam.far = persp.far;
    cam.updateMatrixWorld();
    cam.projectionMatrix.copy(persp.projectionMatrix);
    uniforms.neestReflMatrix.value
      .copy(t.bias)
      .multiply(cam.projectionMatrix)
      .multiply(cam.matrixWorldInverse);
    // Oblique near plane: nothing below the floor reaches the mirror image.
    t.plane.setFromNormalAndCoplanarPoint(t.normal, t.mirror).applyMatrix4(cam.matrixWorldInverse);
    t.clip.set(t.plane.normal.x, t.plane.normal.y, t.plane.normal.z, t.plane.constant);
    const e = cam.projectionMatrix.elements;
    t.q.set(
      (Math.sign(t.clip.x) + e[8]) / e[0],
      (Math.sign(t.clip.y) + e[9]) / e[5],
      -1,
      (1 + e[10]) / e[14],
    );
    t.clip.multiplyScalar(2 / t.clip.dot(t.q));
    e[2] = t.clip.x;
    e[6] = t.clip.y;
    e[10] = t.clip.z + 1 - 0.003;
    e[14] = t.clip.w;

    // Draw it without floors (they sample this target), helpers, or a shadow-map refresh.
    const hidden: THREE.Object3D[] = [];
    for (const m of floorMeshes) if (m.visible) hidden.push(m);
    scene.traverse((o) => {
      if ((HIDDEN_IN_MIRROR.has(o.name) || o.userData?.helper) && o.visible) hidden.push(o);
    });
    hidden.forEach((o) => (o.visible = false));
    const prevTarget = gl.getRenderTarget();
    const shadowAuto = gl.shadowMap.autoUpdate;
    gl.shadowMap.autoUpdate = false;
    uniforms.neestReflOn.value = 0;
    try {
      gl.setRenderTarget(target);
      gl.clear();
      gl.render(scene, cam);
    } finally {
      gl.setRenderTarget(prevTarget);
      gl.shadowMap.autoUpdate = shadowAuto;
      hidden.forEach((o) => (o.visible = true));
    }
    uniforms.neestReflOn.value = 1;
  });
  return null;
}

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { SceneLoadStage } from './SceneLoading';

/**
 * Reports when the 3D view is really showing something: the plan group has been built, every
 * material's shader is compiled and a couple of frames have been drawn. Nothing is drawn before
 * the compile finishes (PostEffects is paused): a first frame would compile every shader
 * synchronously and freeze the page, while compileAsync uses the browser's parallel shader
 * compilation and keeps the page responsive. Until then the loading screen stays over the canvas, so the
 * user never sees the blank canvas that used to appear for a few seconds after the view loaded.
 * A time limit makes sure the loading screen can never get stuck.
 */
export function FirstFrames({
  onCompiled,
  onReady,
  onStage,
  onProgress,
}: {
  onCompiled: () => void;
  onReady: () => void;
  onStage: (s: SceneLoadStage) => void;
  onProgress: (p: { done: number; total: number } | null) => void;
}) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const stage = useRef<'build' | 'compile' | number>('build');
  // How long each step took (dev builds log it and keep it in window.__NEEST_LOAD__).
  const times = useRef({ t0: performance.now(), scene: 0, materials: 0, frames: 0 });
  useEffect(() => {
    const t = window.setTimeout(() => {
      onCompiled();
      onReady();
    }, 20000);
    return () => window.clearTimeout(t);
  }, [onCompiled, onReady]);
  useFrame(() => {
    const s = stage.current;
    if (s === 'build') {
      // SceneContent adds its geometry after mount; wait until the plan group is populated.
      if (!scene.getObjectByName('neest-plan')?.children.length) return invalidate();
      stage.current = 'compile';
      times.current.scene = performance.now();
      onStage('materials');
      gl.compileAsync(scene, camera)
        .catch(() => undefined)
        .then(() => uploadTextures(gl, scene, onProgress))
        .catch(() => undefined)
        .finally(() => {
          stage.current = 0;
          times.current.materials = performance.now();
          onStage('frames');
          onCompiled();
          invalidate();
        });
      return;
    }
    if (s === 'compile') return;
    stage.current = s + 1;
    if (s + 1 === 3) {
      const t = times.current;
      t.frames = performance.now();
      if (import.meta.env.DEV) {
        const ms = {
          scene: Math.round(t.scene - t.t0),
          materials: Math.round(t.materials - t.scene),
          frames: Math.round(t.frames - t.materials),
        };
        (window as unknown as { __NEEST_LOAD__?: object }).__NEEST_LOAD__ = ms;
        console.info(
          '[3d] ready: scene ' +
            ms.scene +
            ' ms · materials ' +
            ms.materials +
            ' ms · first frames ' +
            ms.frames +
            ' ms',
        );
      }
      onReady();
    } else if (s + 1 < 3) invalidate();
  });
  return null;
}

/**
 * Uploads the scene's textures to the GPU a few at a time, yielding between batches, so the first
 * frame does not upload them all at once (that froze the page for seconds on big projects) and the
 * loading screen keeps animating and counting.
 */
async function uploadTextures(
  gl: THREE.WebGLRenderer,
  scene: THREE.Scene,
  onProgress: (p: { done: number; total: number } | null) => void,
): Promise<void> {
  const KEYS = [
    'map',
    'normalMap',
    'roughnessMap',
    'metalnessMap',
    'alphaMap',
    'emissiveMap',
    'aoMap',
    'bumpMap',
  ] as const;
  const textures = new Set<THREE.Texture>();
  scene.traverse((o) => {
    const mat = (o as THREE.Mesh).material;
    if (!mat) return;
    for (const m of Array.isArray(mat) ? mat : [mat]) {
      const rec = m as unknown as Record<string, THREE.Texture | null | undefined>;
      for (const k of KEYS) {
        const t = rec[k];
        if (t?.isTexture && t.image) textures.add(t);
      }
    }
  });
  const list = [...textures];
  let slice = performance.now();
  for (const [i, t] of list.entries()) {
    gl.initTexture(t);
    if (performance.now() - slice > 24) {
      onProgress({ done: i + 1, total: list.length });
      await new Promise((r) => setTimeout(r, 0));
      slice = performance.now();
    }
  }
  onProgress(null);
}

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { Project, RenderSettings } from '@/domain/model/schema';
import { getAsset } from '@/data/assets/registry';
import { LAMP_BUDGET, resolveObjectLights, type ResolvedLight } from '@/data/assets/lights';
import { usePackVersion } from '@/packs/events';

/** A candidate only takes a slot from an assigned light when it is clearly more relevant. */
const SWAP_MARGIN = 0.7;
/** Intensity fade rate (per second) when a light is handed to another fixture. */
const FADE_RATE = 5;

type Slot<L extends THREE.Light> = { light: L; key: string | null; target: number };

/**
 * Live lights for lamp fixtures.
 *
 * A fixed pool of point and spot lights is mounted once per quality level and handed to the
 * fixtures that matter most for the current view. The pool never changes size, because a change
 * in the number of lights makes three.js recompile every material's shader.
 *
 * Steadiness while orbiting: relevance is measured from the orbit target (which stays put while
 * the view rotates), each fixture keeps its slot for as long as it stays assigned, a fixture is
 * only replaced when another is clearly more relevant, and lights fade in and out instead of
 * popping. In high quality the first spot slots cast shadows (ultra: more spots and some points,
 * with no range cut-off); shadow maps are redrawn only when the scene or the slot's fixture changes.
 */
export function LampLights({ project, quality }: { project: Project; quality: RenderSettings['quality'] }) {
  const full = LAMP_BUDGET[quality];
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const controls = useThree((s) => s.controls) as unknown as { target?: THREE.Vector3 } | null;
  const packVersion = usePackVersion();

  const all = useMemo(() => {
    void packVersion;
    const out: ResolvedLight[] = [];
    for (const o of Object.values(project.objects)) out.push(...resolveObjectLights(o, getAsset(project, o.assetId)));
    return out;
  }, [project, packVersion]);

  // Every light in the scene is compiled into every material's shader, so the pool is no bigger
  // than the number of fixtures (capped by the quality budget). It only changes size, and the
  // shaders recompile, when the fixture count crosses a size, never while moving around.
  const nPoint = all.filter((l) => l.kind === 'point').length;
  const nSpot = all.length - nPoint;
  const budget = {
    ...full,
    point: Math.min(full.point, nPoint),
    spot: Math.min(full.spot, nSpot),
  };

  const points = useMemo<Slot<THREE.PointLight>[]>(
    () =>
      Array.from({ length: budget.point }, (_, i) => {
        const l = new THREE.PointLight('#ffffff', 0, 1, 2);
        if (i < budget.pointShadows) {
          l.castShadow = true;
          l.shadow.mapSize.set(512, 512);
          l.shadow.bias = -0.002;
          l.shadow.normalBias = 0.03;
          l.shadow.autoUpdate = false;
        }
        return { light: l, key: null, target: 0 };
      }),
    [budget.point, budget.pointShadows],
  );
  const spots = useMemo<Slot<THREE.SpotLight>[]>(
    () =>
      Array.from({ length: budget.spot }, (_, i) => {
        const l = new THREE.SpotLight('#ffffff', 0, 1, 0.6, 0.4, 2);
        if (i < budget.shadows) {
          l.castShadow = true;
          l.shadow.mapSize.set(1024, 1024);
          l.shadow.bias = -0.0005;
          l.shadow.normalBias = 0.02;
          l.shadow.autoUpdate = false;
        }
        return { light: l, key: null, target: 0 };
      }),
    [budget.spot, budget.shadows],
  );

  useEffect(() => {
    const added: THREE.Object3D[] = [...points.map((s) => s.light), ...spots.flatMap((s) => [s.light, s.light.target])];
    if (added.length) scene.add(...added);
    return () => {
      for (const o of added) scene.remove(o);
      for (const s of points) s.light.dispose();
      for (const s of spots) s.light.dispose();
    };
  }, [scene, points, spots]);

  const lastLights = useRef<ResolvedLight[] | null>(null);
  const focus = useMemo(() => new THREE.Vector3(), []);
  const fwd = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    if (!points.length && !spots.length) return;
    // Orbit target when available (steady while rotating); else a point ahead of the camera (walkthrough).
    if (controls?.target) focus.copy(controls.target);
    else focus.copy(camera.position).addScaledVector(camera.getWorldDirection(fwd), 2.5);
    const byKey = new Map(all.map((l) => [l.key, l]));
    const score = (l: ResolvedLight) =>
      Math.hypot(l.position[0] - focus.x, l.position[1] - focus.y, l.position[2] - focus.z) / Math.max(0.3, l.distance * Math.sqrt(l.intensity));
    const sceneChanged = lastLights.current !== all;
    lastLights.current = all;
    let fading = false;

    const assign = <L extends THREE.PointLight | THREE.SpotLight>(slots: Slot<L>[], kind: ResolvedLight['kind']) => {
      if (!slots.length) return;
      // Drop fixtures that no longer exist; then rank candidates by relevance.
      for (const s of slots) if (s.key && !byKey.has(s.key)) s.key = null;
      const held = new Set(slots.map((s) => s.key).filter(Boolean) as string[]);
      const candidates = all.filter((l) => l.kind === kind && !held.has(l.key)).sort((a, b) => score(a) - score(b));
      for (const c of candidates) {
        const free = slots.find((s) => !s.key);
        if (free) {
          free.key = c.key;
          continue;
        }
        // Replace the least relevant assigned fixture only with a clear margin (hysteresis).
        let worst: Slot<L> | null = null;
        for (const s of slots) if (!worst || score(byKey.get(s.key!)!) > score(byKey.get(worst.key!)!)) worst = s;
        if (worst && score(c) < score(byKey.get(worst.key!)!) * SWAP_MARGIN) worst.key = c.key;
        else break; // candidates are sorted; nobody further down can win either
      }
      for (const s of slots) {
        const l = s.key ? byKey.get(s.key) : undefined;
        const moved = !l || s.light.userData.key !== l.key || sceneChanged;
        if (l && moved) {
          s.light.userData.key = l.key;
          s.light.color.set(l.color);
          // Ultra: no cut-off, light falls off naturally over the whole view.
          s.light.distance = budget.fullRange ? 0 : l.distance;
          s.light.position.set(...l.position);
          if (s.light.castShadow) s.light.shadow.needsUpdate = true;
          if ((s.light as THREE.SpotLight).isSpotLight) {
            const sp = s.light as THREE.SpotLight;
            sp.angle = l.angle;
            sp.penumbra = l.penumbra;
            sp.target.position.set(l.position[0] + l.dir[0], l.position[1] + l.dir[1], l.position[2] + l.dir[2]);
            sp.target.updateMatrixWorld();
          }
          // A slot handed to a new fixture starts dark and fades up.
          if (s.light.userData.key !== s.light.userData.lit) s.light.intensity = 0;
          s.light.userData.lit = l.key;
        }
        s.target = l ? l.intensity : 0;
        const d = s.target - s.light.intensity;
        if (Math.abs(d) > 0.01) {
          s.light.intensity += d * Math.min(1, delta * FADE_RATE);
          fading = true;
        } else s.light.intensity = s.target;
      }
    };
    assign(points, 'point');
    assign(spots, 'spot');
    // The canvas renders on demand: keep frames coming until fades finish.
    if (fading) state.invalidate();
  });

  return null;
}

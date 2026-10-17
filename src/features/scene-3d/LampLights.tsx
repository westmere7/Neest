import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { Project, RenderSettings } from '@/domain/model/schema';
import { getAsset } from '@/data/assets/registry';
import { LAMP_BUDGET, resolveObjectLights, type ResolvedLight } from '@/data/assets/lights';
import { usePackVersion } from '@/packs/events';

const FOCUS_AHEAD = 2.5; // metres in front of the camera that count as "where you are looking"

/**
 * Live lights for lamp fixtures.
 *
 * A fixed pool of point and spot lights is mounted once per quality level and handed to the
 * fixtures nearest to where the camera looks. The pool never changes size while you move around,
 * because a change in the number of lights makes three.js recompile every material's shader.
 * Unused pool lights stay at zero intensity. In high quality the first spot lights cast shadows;
 * their shadow maps are redrawn only when the scene or the assignment changes, not every frame.
 */
export function LampLights({ project, quality }: { project: Project; quality: RenderSettings['quality'] }) {
  const budget = LAMP_BUDGET[quality];
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const packVersion = usePackVersion();

  const all = useMemo(() => {
    void packVersion;
    const out: ResolvedLight[] = [];
    for (const o of Object.values(project.objects)) out.push(...resolveObjectLights(o, getAsset(project, o.assetId)));
    return out;
  }, [project, packVersion]);

  const points = useMemo(() => Array.from({ length: budget.point }, () => new THREE.PointLight('#ffffff', 0, 1, 2)), [budget.point]);
  const spots = useMemo(
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
        return l;
      }),
    [budget.spot, budget.shadows],
  );

  useEffect(() => {
    const added: THREE.Object3D[] = [...points, ...spots.flatMap((s) => [s, s.target])];
    if (added.length) scene.add(...added);
    return () => {
      for (const o of added) scene.remove(o);
      for (const p of points) p.dispose();
      for (const s of spots) s.dispose();
    };
  }, [scene, points, spots]);

  const applied = useRef<{ sig: string; lights: unknown; pool: unknown }>({ sig: '', lights: null, pool: null });
  const focus = useMemo(() => new THREE.Vector3(), []);
  const fwd = useMemo(() => new THREE.Vector3(), []);

  // Runs before each rendered frame: cheap ranking, and the pool is only touched when the set changes.
  useFrame(() => {
    if (!points.length && !spots.length) return;
    camera.getWorldDirection(fwd);
    focus.copy(camera.position).addScaledVector(fwd, FOCUS_AHEAD);
    const score = new Map<ResolvedLight, number>();
    for (const l of all) {
      const d = Math.hypot(l.position[0] - focus.x, l.position[1] - focus.y, l.position[2] - focus.z);
      // Brighter, longer-reaching lights win ties.
      score.set(l, d / Math.max(0.3, l.distance * Math.sqrt(l.intensity)));
    }
    const pick = (kind: ResolvedLight['kind'], n: number) =>
      n ? all.filter((l) => l.kind === kind).sort((a, b) => score.get(a)! - score.get(b)!).slice(0, n) : [];
    const ps = pick('point', points.length);
    const ss = pick('spot', spots.length);
    const sig = [...ps, ...ss].map((l) => l.key).join('|');
    const a = applied.current;
    if (sig === a.sig && a.lights === all && a.pool === spots) return;
    applied.current = { sig, lights: all, pool: spots };
    points.forEach((p, i) => {
      const l = ps[i];
      p.intensity = l ? l.intensity : 0;
      if (!l) return;
      p.color.set(l.color);
      p.distance = l.distance;
      p.position.set(...l.position);
    });
    spots.forEach((s, i) => {
      const l = ss[i];
      s.intensity = l ? l.intensity : 0;
      // Shadow maps redraw once per change; idle casters skip their shadow pass.
      if (s.castShadow) s.shadow.needsUpdate = Boolean(l);
      if (!l) return;
      s.color.set(l.color);
      s.distance = l.distance;
      s.angle = l.angle;
      s.penumbra = l.penumbra;
      s.position.set(...l.position);
      s.target.position.set(l.position[0] + l.dir[0], l.position[1] + l.dir[1], l.position[2] + l.dir[2]);
      s.target.updateMatrixWorld();
    });
  });

  return null;
}

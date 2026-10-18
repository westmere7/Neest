import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { Project } from '@/domain/model/schema';
import type { DerivedPlan } from '@/domain/geometry/derive';
import { buildColliders, defaultSpawn, moveWithCollisions } from '@/domain/walkthrough/collision';

export const EYE_HEIGHT = 1.6;
const RADIUS = 0.22;
const SPEED = 1.5;

/** Shared input state so DOM overlays (touch joystick) can drive the controls. */
export const walkInput = {
  move: { x: 0, y: 0 },
  look: { dx: 0, dy: 0 },
  run: false,
};

/** Free-fly in the walkthrough (F): move where you look, up and down, through walls. */
const fly = { on: false };
const flyListeners = new Set<() => void>();
export function setWalkFly(on: boolean): void {
  if (fly.on === on) return;
  fly.on = on;
  flyListeners.forEach((fn) => fn());
}
export const toggleWalkFly = (): void => setWalkFly(!fly.on);
export function useWalkFly(): boolean {
  return useSyncExternalStore(
    (cb) => {
      flyListeners.add(cb);
      return () => void flyListeners.delete(cb);
    },
    () => fly.on,
    () => false,
  );
}
const FLY_SPEED = 2.5;

/**
 * First-person walkthrough: pointer-lock mouse look and WASD/arrow keys on
 * desktop, joystick + drag-to-look on touch. Movement collides with walls
 * (doorways are passable) and taller furniture. F switches to free-fly: move
 * along the view, Space/E up, Q/C down, no collisions; switching back lands at
 * eye height.
 */
export function WalkControls({ project, derived, onExit, startOverride }: { project: Project; derived: DerivedPlan; onExit?: () => void; startOverride?: { x: number; y: number; angle: number } | null }) {
  const { camera, gl } = useThree();
  const keys = useRef(new Set<string>());
  const yaw = useRef(0);
  const pitch = useRef(0);
  const colliders = useMemo(() => buildColliders(project, derived.network), [project, derived.network]);
  const colliderRef = useRef(colliders);
  colliderRef.current = colliders;

  // Spawn once when entering the mode.
  useEffect(() => {
    const spawn = startOverride ? { p: { x: startOverride.x, y: startOverride.y }, angle: startOverride.angle } : defaultSpawn(project, derived.faces);
    camera.position.set(spawn.p.x, EYE_HEIGHT, spawn.p.y);
    yaw.current = -spawn.angle - Math.PI / 2;
    pitch.current = 0;
    setWalkFly(false);
    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
      (camera as THREE.PerspectiveCamera).fov = 70;
      camera.near = 0.05;
      (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = gl.domElement;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      keys.current.add(e.code);
      if (e.code === 'KeyF' && !e.repeat && !e.ctrlKey && !e.metaKey) toggleWalkFly();
      if (e.code === 'Space') e.preventDefault();
      if (e.code === 'Escape' && document.pointerLockElement !== el) onExit?.();
    };
    const onKeyUp = (e: KeyboardEvent) => keys.current.delete(e.code);
    const onClick = () => {
      if (matchMedia('(pointer: fine)').matches && document.pointerLockElement !== el) el.requestPointerLock?.();
    };
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== el) return;
      yaw.current -= e.movementX * 0.0022;
      pitch.current = Math.max(-1.3, Math.min(1.3, pitch.current - e.movementY * 0.0022));
    };
    const onBlur = () => keys.current.clear();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    el.addEventListener('click', onClick);
    document.addEventListener('mousemove', onMouseMove);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      el.removeEventListener('click', onClick);
      document.removeEventListener('mousemove', onMouseMove);
      if (document.pointerLockElement === el) document.exitPointerLock?.();
    };
  }, [gl, onExit]);

  useFrame((_, dtRaw) => {
    const dt = Math.min(0.05, dtRaw);
    yaw.current -= walkInput.look.dx * 0.005;
    pitch.current = Math.max(-1.3, Math.min(1.3, pitch.current - walkInput.look.dy * 0.005));
    walkInput.look.dx = 0;
    walkInput.look.dy = 0;
    const k = keys.current;
    let fwd = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    let strafe = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    fwd += -walkInput.move.y;
    strafe += walkInput.move.x;
    const run = k.has('ShiftLeft') || k.has('ShiftRight') || walkInput.run;
    const len = Math.hypot(fwd, strafe);
    if (len > 1) {
      fwd /= len;
      strafe /= len;
    }
    if (fly.on) {
      // Free-fly: along the view (pitch included), up/down keys, no collisions.
      const sp = FLY_SPEED * (run ? 3 : 1) * dt;
      const cp = Math.cos(pitch.current);
      const look = new THREE.Vector3(-Math.sin(yaw.current) * cp, Math.sin(pitch.current), -Math.cos(yaw.current) * cp);
      const side = new THREE.Vector3(Math.cos(yaw.current), 0, -Math.sin(yaw.current));
      const vert = (k.has('Space') || k.has('KeyE') ? 1 : 0) - (k.has('KeyQ') || k.has('KeyC') ? 1 : 0);
      camera.position.addScaledVector(look, fwd * sp).addScaledVector(side, strafe * sp);
      camera.position.y = Math.min(40, Math.max(0.15, camera.position.y + vert * sp));
      camera.rotation.set(pitch.current, yaw.current, 0, 'YXZ');
      return;
    }
    const speed = SPEED * (run ? 2 : 1) * dt;
    const forward = new THREE.Vector3(-Math.sin(yaw.current), 0, -Math.cos(yaw.current));
    const right = new THREE.Vector3(-forward.z, 0, forward.x);
    const delta = forward.multiplyScalar(fwd * speed).add(right.multiplyScalar(strafe * speed));
    if (delta.lengthSq() > 0) {
      const next = moveWithCollisions({ x: camera.position.x, y: camera.position.z }, { x: delta.x, y: delta.z }, RADIUS, colliderRef.current);
      camera.position.x = next.x;
      camera.position.z = next.y;
    }
    camera.position.y = EYE_HEIGHT;
    camera.rotation.set(pitch.current, yaw.current, 0, 'YXZ');
  });
  return null;
}

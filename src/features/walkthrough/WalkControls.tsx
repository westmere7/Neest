import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { Project } from '@/domain/model/schema';
import type { DerivedPlan } from '@/domain/geometry/derive';
import { buildColliders, defaultSpawn, moveWithCollisions } from '@/domain/walkthrough/collision';
import { attachSafariGesture, createWheelClassifier } from '@/components/trackpad';

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
  const wheelMove = useRef({ fwd: 0, strafe: 0 });
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
    const classifier = createWheelClassifier();
    let drag: { id: number; x: number; y: number; moved: boolean } | null = null;
    let suppressLockUntil = -Infinity;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      keys.current.add(e.code);
      if (e.code === 'KeyF' && !e.repeat && !e.ctrlKey && !e.metaKey) toggleWalkFly();
      if (e.code === 'Space') e.preventDefault();
      if (e.code === 'Escape' && document.pointerLockElement !== el) onExit?.();
    };
    const onKeyUp = (e: KeyboardEvent) => keys.current.delete(e.code);
    const onClick = () => {
      if (performance.now() < suppressLockUntil) return;
      if (matchMedia('(pointer: fine)').matches && document.pointerLockElement !== el) el.requestPointerLock?.();
    };
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== el) return;
      yaw.current -= e.movementX * 0.0022;
      pitch.current = Math.max(-1.3, Math.min(1.3, pitch.current - e.movementY * 0.0022));
    };
    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 || document.pointerLockElement === el) return;
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
      try {
        el.setPointerCapture?.(e.pointerId);
      } catch {
        /* ignore */
      }
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!drag || drag.id !== e.pointerId || document.pointerLockElement === el) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (Math.hypot(dx, dy) > 3) drag.moved = true;
      drag.x = e.clientX;
      drag.y = e.clientY;
      yaw.current -= dx * 0.0035;
      pitch.current = Math.max(-1.3, Math.min(1.3, pitch.current - dy * 0.0035));
    };
    const onPointerUp = (e: PointerEvent) => {
      if (!drag || drag.id !== e.pointerId) return;
      if (drag.moved) suppressLockUntil = performance.now() + 120;
      drag = null;
      try {
        el.releasePointerCapture?.(e.pointerId);
      } catch {
        /* ignore */
      }
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const kind = classifier.classify(e);
      if (kind === 'ignore') return;
      if (kind === 'pinch' || e.altKey) {
        wheelMove.current.fwd += -e.deltaY * 0.015;
      } else if (e.shiftKey || e.metaKey) {
        wheelMove.current.fwd += -e.deltaY * 0.008;
        wheelMove.current.strafe += e.deltaX * 0.008;
      } else if (kind === 'trackpad') {
        yaw.current -= e.deltaX * 0.003;
        pitch.current = Math.max(-1.3, Math.min(1.3, pitch.current - e.deltaY * 0.003));
      } else {
        wheelMove.current.fwd += -Math.sign(e.deltaY) * 0.35;
      }
    };
    const detachSafari = attachSafariGesture(el, ({ scaleRatio, rotationDeg }) => {
      if (Math.abs(scaleRatio - 1) > 1e-4) {
        classifier.markSafariPinch();
        wheelMove.current.fwd += (scaleRatio - 1) * 2.5;
      }
      if (Math.abs(rotationDeg) > 0.05) {
        yaw.current -= THREE.MathUtils.degToRad(rotationDeg);
      }
    });
    const onBlur = () => {
      keys.current.clear();
      drag = null;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    el.addEventListener('click', onClick);
    el.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    document.addEventListener('mousemove', onMouseMove);
    return () => {
      detachSafari();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      el.removeEventListener('click', onClick);
      el.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      el.removeEventListener('wheel', onWheel);
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
    const wf = wheelMove.current.fwd;
    const ws = wheelMove.current.strafe;
    wheelMove.current.fwd = 0;
    wheelMove.current.strafe = 0;
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
      camera.position.addScaledVector(look, fwd * sp + wf).addScaledVector(side, strafe * sp + ws);
      camera.position.y = Math.min(40, Math.max(0.15, camera.position.y + vert * sp));
      camera.rotation.set(pitch.current, yaw.current, 0, 'YXZ');
      return;
    }
    const speed = SPEED * (run ? 2 : 1) * dt;
    const forward = new THREE.Vector3(-Math.sin(yaw.current), 0, -Math.cos(yaw.current));
    const right = new THREE.Vector3(-forward.z, 0, forward.x);
    const delta = forward.multiplyScalar(fwd * speed + wf).add(right.multiplyScalar(strafe * speed + ws));
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

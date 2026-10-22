import * as THREE from 'three';
import { attachSafariGesture, createWheelClassifier, wheelDelta } from '@/components/trackpad';
import { isEditableTarget } from '@/components/hooks';

export interface OrbitLike {
  enabled: boolean;
  object: THREE.Object3D;
  target: THREE.Vector3;
  minPolarAngle?: number;
  maxPolarAngle?: number;
  minAzimuthAngle?: number;
  maxAzimuthAngle?: number;
  minDistance?: number;
  maxDistance?: number;
  minZoom?: number;
  maxZoom?: number;
  rotateSpeed?: number;
  panSpeed?: number;
  zoomSpeed?: number;
  screenSpacePanning?: boolean;
  update: () => boolean | void;
  dispatchEvent?: (event: { type: 'start' | 'change' | 'end' }) => void;
}

export interface TrackpadOrbitOptions {
  /** True when a 3D drafting/placement tool owns plain left-clicks (Alt/Cmd-drag still orbits, Space-drag pans). */
  isDrawing?: () => boolean;
  /** True when unmodified arrow/+/- keys may navigate the camera (e.g. when no object is selected to nudge). */
  canKeyNavigate?: () => boolean;
}

const _offset = new THREE.Vector3();
const _spherical = new THREE.Spherical();
const _quat = new THREE.Quaternion();
const _quatInv = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);
const _right = new THREE.Vector3();
const _camUp = new THREE.Vector3();
const _pan = new THREE.Vector3();

/** Rotates the camera around `ctrl.target` by `(dTheta, dPhi)` radians. */
export function orbitCamera(ctrl: OrbitLike, dTheta: number, dPhi: number): void {
  const cam = ctrl.object;
  _quat.setFromUnitVectors(cam.up, _up);
  _quatInv.copy(_quat).invert();
  _offset.copy(cam.position).sub(ctrl.target).applyQuaternion(_quat);
  _spherical.setFromVector3(_offset);

  _spherical.theta -= dTheta;
  _spherical.phi -= dPhi;

  const minAz = ctrl.minAzimuthAngle ?? -Infinity;
  const maxAz = ctrl.maxAzimuthAngle ?? Infinity;
  if (Number.isFinite(minAz) && Number.isFinite(maxAz)) {
    _spherical.theta = Math.max(minAz, Math.min(maxAz, _spherical.theta));
  }
  const minPhi = Math.max(1e-4, ctrl.minPolarAngle ?? 0);
  const maxPhi = Math.min(Math.PI - 1e-4, ctrl.maxPolarAngle ?? Math.PI);
  _spherical.phi = Math.max(minPhi, Math.min(maxPhi, _spherical.phi));
  _spherical.makeSafe();

  _offset.setFromSpherical(_spherical).applyQuaternion(_quatInv);
  cam.position.copy(ctrl.target).add(_offset);
  cam.lookAt(ctrl.target);
  ctrl.update();
}

/** Pans `ctrl.object` and `ctrl.target` by `(dx, dy)` screen pixels. */
export function panCamera(
  ctrl: OrbitLike,
  viewport: { clientWidth: number; clientHeight: number },
  dx: number,
  dy: number,
): void {
  const cam = ctrl.object;
  cam.updateMatrix();
  const w = Math.max(1, viewport.clientWidth || 800);
  const h = Math.max(1, viewport.clientHeight || 600);
  const speed = ctrl.panSpeed ?? 1;
  const moveX = dx * speed;
  const moveY = dy * speed;

  let distLeft = 0;
  let distUp = 0;
  if ((cam as THREE.PerspectiveCamera).isPerspectiveCamera) {
    const pc = cam as THREE.PerspectiveCamera;
    const targetDist = cam.position.distanceTo(ctrl.target) * Math.tan(((pc.fov / 2) * Math.PI) / 180);
    distLeft = (2 * moveX * targetDist) / h;
    distUp = (2 * moveY * targetDist) / h;
  } else if ((cam as THREE.OrthographicCamera).isOrthographicCamera) {
    const oc = cam as THREE.OrthographicCamera;
    distLeft = (moveX * (oc.right - oc.left)) / oc.zoom / w;
    distUp = (moveY * (oc.top - oc.bottom)) / oc.zoom / h;
  } else {
    return;
  }

  _right.setFromMatrixColumn(cam.matrix, 0);
  if (ctrl.screenSpacePanning !== false) {
    _camUp.setFromMatrixColumn(cam.matrix, 1);
  } else {
    _camUp.crossVectors(cam.up, _right);
  }
  _pan.copy(_right).multiplyScalar(-distLeft).addScaledVector(_camUp, distUp);
  cam.position.add(_pan);
  ctrl.target.add(_pan);
  ctrl.update();
}

/** Dollies (perspective) or zooms (orthographic) by `factor` (`< 1` zooms in, `> 1` zooms out). */
export function dollyCamera(ctrl: OrbitLike, factor: number): void {
  if (!Number.isFinite(factor) || factor <= 0) return;
  const cam = ctrl.object;
  if ((cam as THREE.PerspectiveCamera).isPerspectiveCamera) {
    _offset.copy(cam.position).sub(ctrl.target);
    const dist = _offset.length();
    if (dist < 1e-6) return;
    const minD = ctrl.minDistance && ctrl.minDistance > 0 ? ctrl.minDistance : 0.4;
    const maxD = ctrl.maxDistance && Number.isFinite(ctrl.maxDistance) ? ctrl.maxDistance : 250;
    const nextDist = Math.max(minD, Math.min(maxD, dist * factor));
    _offset.multiplyScalar(nextDist / dist);
    cam.position.copy(ctrl.target).add(_offset);
    ctrl.update();
  } else if ((cam as THREE.OrthographicCamera).isOrthographicCamera) {
    const oc = cam as THREE.OrthographicCamera;
    const minZ = ctrl.minZoom && ctrl.minZoom > 0 ? ctrl.minZoom : 0.5;
    const maxZ = ctrl.maxZoom && Number.isFinite(ctrl.maxZoom) ? ctrl.maxZoom : 2000;
    oc.zoom = Math.max(minZ, Math.min(maxZ, oc.zoom / factor));
    oc.updateProjectionMatrix();
    ctrl.update();
  }
}

/**
 * Enhances a 3D viewport element and its `OrbitControls` with full Mac trackpad & keyboard-modifier support:
 * - Two-finger swipe: orbit (rotate camera)
 * - Shift / Cmd / Space + two-finger swipe: pan camera
 * - Two-finger pinch (or Option + two-finger scroll, or physical mouse wheel): smooth zoom
 * - Two-finger twist (Safari): horizontal orbit
 * - Space + 1-finger drag: pan camera (even over selected objects or while a drafting tool is active)
 * - Option (Alt) / Cmd + 1-finger drag while a drafting tool is active: orbit camera
 */
export function attachTrackpadOrbit(
  el: HTMLElement,
  getControls: () => OrbitLike | null,
  options?: TrackpadOrbitOptions,
): () => void {
  const classifier = createWheelClassifier();
  let spaceDown = false;
  let dragState: { id: number; mode: 'pan' | 'orbit'; x: number; y: number; moved: boolean } | null = null;
  let suppressClickUntil = -Infinity;

  const onWheel = (e: WheelEvent) => {
    const ctrl = getControls();
    if (!ctrl || !ctrl.enabled) return;
    e.preventDefault();
    e.stopImmediatePropagation();

    const kind = classifier.classify(e);
    if (kind === 'ignore') return;
    const { x: deltaX, y: deltaY } = wheelDelta(e);

    ctrl.dispatchEvent?.({ type: 'start' });

    const wantZoom =
      kind === 'pinch' ||
      e.altKey ||
      (kind === 'wheel' && !e.shiftKey && !e.metaKey && !spaceDown);

    const wantPan = !wantZoom && (e.shiftKey || e.metaKey || spaceDown);

    if (wantZoom) {
      const speed =
        (ctrl.zoomSpeed ?? 1) * (kind === 'pinch' ? 0.01 : kind === 'trackpad' ? 0.0045 : 0.0015);
      const dy = kind === 'wheel' ? Math.max(-160, Math.min(160, deltaY)) : deltaY;
      dollyCamera(ctrl, Math.exp(dy * speed));
    } else if (wantPan) {
      const dx = kind === 'wheel' && deltaX === 0 ? -deltaY : -deltaX;
      const dy = kind === 'wheel' && deltaX === 0 ? 0 : -deltaY;
      panCamera(ctrl, el, dx, dy);
    } else {
      const h = Math.max(120, el.clientHeight || 600);
      const speed = (ctrl.rotateSpeed ?? 1) * 0.85;
      const dTheta = ((-deltaX / h) * 2 * Math.PI) * speed;
      const dPhi = ((-deltaY / h) * 2 * Math.PI) * speed;
      orbitCamera(ctrl, dTheta, dPhi);
    }

    ctrl.dispatchEvent?.({ type: 'end' });
  };

  const detachSafari = attachSafariGesture(el, ({ scaleRatio, rotationDeg }) => {
    const ctrl = getControls();
    if (!ctrl || !ctrl.enabled) return;
    ctrl.dispatchEvent?.({ type: 'start' });
    if (Math.abs(scaleRatio - 1) > 1e-4) {
      classifier.markSafariPinch();
      dollyCamera(ctrl, 1 / scaleRatio);
    }
    if (Math.abs(rotationDeg) > 0.05) {
      orbitCamera(ctrl, THREE.MathUtils.degToRad(rotationDeg), 0);
    }
    ctrl.dispatchEvent?.({ type: 'end' });
  });

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.defaultPrevented || isEditableTarget(e.target)) return;
    if (e.code === 'Space') {
      spaceDown = true;
      return;
    }
    const ctrl = getControls();
    if (!ctrl || !ctrl.enabled) return;
    const canNav = options?.canKeyNavigate ? options.canKeyNavigate() : true;
    if (!canNav && !e.altKey) return;
    if (e.ctrlKey || e.metaKey) return;

    if (e.key === '=' || e.key === '+') {
      e.preventDefault();
      ctrl.dispatchEvent?.({ type: 'start' });
      dollyCamera(ctrl, 1 / 1.18);
      ctrl.dispatchEvent?.({ type: 'end' });
      return;
    }
    if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      ctrl.dispatchEvent?.({ type: 'start' });
      dollyCamera(ctrl, 1.18);
      ctrl.dispatchEvent?.({ type: 'end' });
      return;
    }
    if (e.key.startsWith('Arrow')) {
      e.preventDefault();
      ctrl.dispatchEvent?.({ type: 'start' });
      const sx = e.key === 'ArrowLeft' ? 1 : e.key === 'ArrowRight' ? -1 : 0;
      const sy = e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : 0;
      if (e.shiftKey || spaceDown) {
        panCamera(ctrl, el, sx * 36, sy * 36);
      } else {
        const step = 0.08 * (ctrl.rotateSpeed ?? 1);
        orbitCamera(ctrl, sx * step, sy * step);
      }
      ctrl.dispatchEvent?.({ type: 'end' });
    }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.code === 'Space') {
      spaceDown = false;
    }
  };
  const onBlur = () => {
    spaceDown = false;
    dragState = null;
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const ctrl = getControls();
    if (!ctrl || !ctrl.enabled) return;
    const drawing = options?.isDrawing?.() ?? false;
    let mode: 'pan' | 'orbit' | null = null;
    if (spaceDown) {
      mode = e.altKey ? 'orbit' : 'pan';
    } else if (drawing && (e.altKey || e.metaKey)) {
      mode = e.shiftKey ? 'pan' : 'orbit';
    }
    if (!mode) return;

    e.preventDefault();
    e.stopImmediatePropagation();
    dragState = { id: e.pointerId, mode, x: e.clientX, y: e.clientY, moved: false };
    try {
      el.setPointerCapture?.(e.pointerId);
    } catch {
      /* synthetic pointer */
    }
    ctrl.dispatchEvent?.({ type: 'start' });
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!dragState || dragState.id !== e.pointerId) return;
    const ctrl = getControls();
    if (!ctrl) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const dx = e.clientX - dragState.x;
    const dy = e.clientY - dragState.y;
    if (Math.hypot(dx, dy) > 2) dragState.moved = true;
    dragState.x = e.clientX;
    dragState.y = e.clientY;
    if (dragState.mode === 'pan') {
      panCamera(ctrl, el, dx, dy);
    } else {
      const h = Math.max(120, el.clientHeight || 600);
      const speed = ctrl.rotateSpeed ?? 1;
      orbitCamera(ctrl, ((dx / h) * 2 * Math.PI) * speed, ((dy / h) * 2 * Math.PI) * speed);
    }
  };

  const endDrag = (e: PointerEvent) => {
    if (!dragState || dragState.id !== e.pointerId) return;
    if (dragState.moved) suppressClickUntil = performance.now() + 120;
    dragState = null;
    try {
      el.releasePointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
    getControls()?.dispatchEvent?.({ type: 'end' });
  };

  const onClickCapture = (e: MouseEvent) => {
    if (performance.now() < suppressClickUntil) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  };

  el.addEventListener('wheel', onWheel, { passive: false, capture: true });
  el.addEventListener('pointerdown', onPointerDown, { capture: true });
  window.addEventListener('pointermove', onPointerMove, { capture: true });
  window.addEventListener('pointerup', endDrag, { capture: true });
  window.addEventListener('pointercancel', endDrag, { capture: true });
  el.addEventListener('click', onClickCapture, { capture: true });
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  return () => {
    detachSafari();
    el.removeEventListener('wheel', onWheel, { capture: true });
    el.removeEventListener('pointerdown', onPointerDown, { capture: true });
    window.removeEventListener('pointermove', onPointerMove, { capture: true });
    window.removeEventListener('pointerup', endDrag, { capture: true });
    window.removeEventListener('pointercancel', endDrag, { capture: true });
    el.removeEventListener('click', onClickCapture, { capture: true });
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
  };
}

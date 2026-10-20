import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { attachSafariGesture, createWheelClassifier } from '@/components/trackpad';
import { attachTrackpadOrbit, dollyCamera, orbitCamera, panCamera, type OrbitLike } from './trackpadOrbit';

function makeOrbit(ortho = false): OrbitLike {
  const cam = ortho
    ? new THREE.OrthographicCamera(-10, 10, 10, -10, -200, 600)
    : new THREE.PerspectiveCamera(45, 4 / 3, 0.1, 600);
  cam.position.set(0, 6, 10);
  const target = new THREE.Vector3(0, 0, 0);
  cam.lookAt(target);
  cam.updateMatrix();
  return {
    enabled: true,
    object: cam,
    target,
    minPolarAngle: 0.05,
    maxPolarAngle: Math.PI / 2 - 0.02,
    minDistance: 0.4,
    maxDistance: 250,
    minZoom: 0.5,
    maxZoom: 2000,
    update: vi.fn(() => {
      cam.lookAt(target);
      cam.updateMatrix();
    }),
    dispatchEvent: vi.fn(),
  };
}

describe('trackpad wheel classifier & Safari gestures', () => {
  it('distinguishes pinch, 2D trackpad swipes, momentum streams, and discrete mouse wheels', () => {
    const c = createWheelClassifier();

    // Pinch (ctrlKey: true)
    expect(c.classify(new WheelEvent('wheel', { deltaY: -8, ctrlKey: true }), 100)).toBe('pinch');

    // Discrete notched mouse wheel (line mode or large deltaY with deltaX = 0)
    expect(c.classify(new WheelEvent('wheel', { deltaY: 3, deltaMode: 1 }), 500)).toBe('wheel');
    expect(c.classify(new WheelEvent('wheel', { deltaY: 120, deltaMode: 0 }), 900)).toBe('wheel');

    // Trackpad swipe starting with small pixel delta locks subsequent momentum events into trackpad mode
    expect(c.classify(new WheelEvent('wheel', { deltaX: 0, deltaY: 6, deltaMode: 0 }), 1500)).toBe('trackpad');
    expect(c.classify(new WheelEvent('wheel', { deltaX: 0, deltaY: 64, deltaMode: 0 }), 1530)).toBe('trackpad');

    // Safari duplicate pinch suppression
    c.markSafariPinch(2000);
    expect(c.classify(new WheelEvent('wheel', { deltaY: -5, ctrlKey: true }), 2020)).toBe('ignore');
    expect(c.classify(new WheelEvent('wheel', { deltaY: -5, ctrlKey: true }), 2100)).toBe('pinch');
  });

  it('normalises Safari gesturestart / gesturechange scale ratios and rotation deltas', () => {
    const div = document.createElement('div');
    const deltas: { scaleRatio: number; rotationDeg: number }[] = [];
    const detach = attachSafariGesture(div, (d) => deltas.push({ scaleRatio: d.scaleRatio, rotationDeg: d.rotationDeg }));

    const fire = (type: string, scale: number, rotation: number) => {
      const ev = new Event(type, { cancelable: true }) as Event & { scale: number; rotation: number };
      Object.assign(ev, { scale, rotation });
      div.dispatchEvent(ev);
    };

    fire('gesturestart', 1, 0);
    fire('gesturechange', 1.25, 15);
    fire('gesturechange', 1.5, 25);
    fire('gestureend', 1.5, 25);

    expect(deltas).toHaveLength(2);
    expect(deltas[0].scaleRatio).toBeCloseTo(1.25, 5);
    expect(deltas[0].rotationDeg).toBeCloseTo(15, 5);
    expect(deltas[1].scaleRatio).toBeCloseTo(1.5 / 1.25, 5);
    expect(deltas[1].rotationDeg).toBeCloseTo(10, 5);
    detach();
  });
});

describe('3D trackpad orbit, pan, zoom & modifier drags', () => {
  it('orbits on two-finger swipe, pans on Shift-swipe, and zooms on pinch or Option-swipe', () => {
    const div = document.createElement('div');
    Object.defineProperty(div, 'clientWidth', { value: 800 });
    Object.defineProperty(div, 'clientHeight', { value: 600 });
    let drawing = false;
    const ctrl = makeOrbit();
    const detach = attachTrackpadOrbit(div, () => ctrl, { isDrawing: () => drawing });

    // 1. Two-finger swipe rotates (orbits) the camera around target without moving target
    const dist0 = ctrl.object.position.distanceTo(ctrl.target);
    div.dispatchEvent(new WheelEvent('wheel', { deltaX: -30, deltaY: -20, deltaMode: 0, cancelable: true }));
    expect(ctrl.target.length()).toBeCloseTo(0, 5);
    expect(ctrl.object.position.distanceTo(ctrl.target)).toBeCloseTo(dist0, 4);
    expect(ctrl.object.position.x).not.toBeCloseTo(0, 3);

    // 2. Shift + two-finger swipe pans both camera and target
    div.dispatchEvent(
      new WheelEvent('wheel', { deltaX: -25, deltaY: 15, shiftKey: true, deltaMode: 0, cancelable: true }),
    );
    expect(ctrl.target.length()).toBeGreaterThan(0.01);

    // 3. Pinch (ctrlKey: true) zooms in when deltaY < 0
    const distBeforePinch = ctrl.object.position.distanceTo(ctrl.target);
    div.dispatchEvent(new WheelEvent('wheel', { deltaY: -20, ctrlKey: true, deltaMode: 0, cancelable: true }));
    expect(ctrl.object.position.distanceTo(ctrl.target)).toBeLessThan(distBeforePinch);

    // 4. Option (altKey: true) + two-finger scroll zooms out when deltaY > 0
    const distAfterPinch = ctrl.object.position.distanceTo(ctrl.target);
    div.dispatchEvent(new WheelEvent('wheel', { deltaY: 30, altKey: true, deltaMode: 0, cancelable: true }));
    expect(ctrl.object.position.distanceTo(ctrl.target)).toBeGreaterThan(distAfterPinch);

    // 5. While a 3D drafting tool is active, Alt + 1-finger drag orbits the camera
    drawing = true;
    const xBeforeDrag = ctrl.object.position.x;
    const pointer = (type: string, x: number, y: number, altKey = false) =>
      Object.assign(new MouseEvent(type, { button: 0, clientX: x, clientY: y, altKey, cancelable: true }), {
        pointerId: 1,
      });
    div.dispatchEvent(pointer('pointerdown', 200, 200, true));
    window.dispatchEvent(pointer('pointermove', 280, 220, true));
    window.dispatchEvent(pointer('pointerup', 280, 220));
    expect(ctrl.object.position.x).not.toBeCloseTo(xBeforeDrag, 3);

    detach();
  });

  it('supports orthographic zoom and pan', () => {
    const ctrl = makeOrbit(true);
    const cam = ctrl.object as THREE.OrthographicCamera;
    expect(cam.zoom).toBe(1);
    dollyCamera(ctrl, 0.5);
    expect(cam.zoom).toBeCloseTo(2, 5);
    panCamera(ctrl, { clientWidth: 800, clientHeight: 600 }, 40, -20);
    expect(ctrl.target.length()).toBeGreaterThan(0.01);
    orbitCamera(ctrl, 0.2, 0.1);
    expect(ctrl.update).toHaveBeenCalled();
  });
});

/**
 * Trackpad gesture detection and Safari WebKit GestureEvent normalisation.
 *
 * On macOS (and precision touchpads), two-finger swipes emit continuous pixel-mode `wheel` events
 * (`deltaMode === 0`, with `deltaX !== 0` or small initial `deltaY`), whereas two-finger pinch
 * emits `wheel` events with `ctrlKey === true` (and in Safari also `gesturestart/change/end` with
 * `scale` and `rotation`).
 */

export type WheelKind = 'pinch' | 'trackpad' | 'wheel' | 'ignore';

export interface WheelClassifier {
  classify(e: WheelEvent, now?: number): WheelKind;
  markSafariPinch(now?: number): void;
}

/**
 * Stateful classifier that distinguishes:
 * - `'pinch'`: two-finger trackpad pinch (`ctrlKey: true`)
 * - `'trackpad'`: two-finger trackpad swipe (continuous 2D pixel stream)
 * - `'wheel'`: discrete physical mouse wheel ticks
 * - `'ignore'`: duplicate `ctrlKey` wheel event emitted alongside Safari's `gesturechange`
 */
export function createWheelClassifier(): WheelClassifier {
  let trackpadUntil = -Infinity;
  let lastWheelAt = -Infinity;
  let lastSafariScaleAt = -Infinity;

  return {
    markSafariPinch(now = performance.now()) {
      lastSafariScaleAt = now;
    },
    classify(e: WheelEvent, now = performance.now()): WheelKind {
      if (e.ctrlKey) {
        if (now - lastSafariScaleAt < 60) return 'ignore';
        return 'pinch';
      }
      const dt = now - lastWheelAt;
      lastWheelAt = now;

      // Line or page mode is always a discrete physical mouse wheel.
      if (e.deltaMode !== 0) {
        trackpadUntil = -Infinity;
        return 'wheel';
      }

      const legacy = e as WheelEvent & { wheelDeltaY?: number; wheelDeltaX?: number };
      const hasX = Math.abs(e.deltaX) > 0;
      const fractional = !Number.isInteger(e.deltaX) || !Number.isInteger(e.deltaY);
      const smallStart = Math.abs(e.deltaY) > 0 && Math.abs(e.deltaY) < 48;
      const smoothWebkit =
        typeof legacy.wheelDeltaY === 'number' &&
        legacy.wheelDeltaY !== 0 &&
        Math.abs(legacy.wheelDeltaY) % 120 !== 0;
      const rapidStream = dt > 0 && dt < 35 && Math.abs(e.deltaY) < 90;

      if (now < trackpadUntil || hasX || fractional || smallStart || smoothWebkit || rapidStream) {
        trackpadUntil = now + 260;
        return 'trackpad';
      }
      return 'wheel';
    },
  };
}

/** Pixels per wheel line: a 3-line mouse notch moves as far as Chrome's 100 px notch. */
const LINE_PX = 100 / 3;
/** Pixels per wheel page. */
const PAGE_PX = 800;

/**
 * Wheel deltas in pixels, whatever the event's `deltaMode`. Read it after `classify`: Firefox reports a
 * mouse wheel in lines (3 per notch) once `deltaMode` has been read, which would otherwise zoom ~30× slower.
 */
export function wheelDelta(e: WheelEvent): { x: number; y: number } {
  const k = e.deltaMode === 1 ? LINE_PX : e.deltaMode === 2 ? PAGE_PX : 1;
  return { x: e.deltaX * k, y: e.deltaY * k };
}

export interface SafariGestureDelta {
  scaleRatio: number;
  rotationDeg: number;
  clientX: number;
  clientY: number;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}

interface WebKitGestureEvent extends UIEvent {
  readonly scale?: number;
  readonly rotation?: number;
  readonly clientX?: number;
  readonly clientY?: number;
  readonly shiftKey?: boolean;
  readonly altKey?: boolean;
  readonly metaKey?: boolean;
}

/**
 * Attaches Safari / WebKit trackpad multi-touch gesture listeners (`gesturestart`, `gesturechange`,
 * `gestureend`) to an element, preventing whole-page browser zoom and reporting incremental pinch
 * scale ratios and two-finger rotation angles (in degrees).
 */
export function attachSafariGesture(
  el: EventTarget,
  onGesture: (delta: SafariGestureDelta) => void,
): () => void {
  let lastScale = 1;
  let lastRotation = 0;

  const onStart = (ev: Event) => {
    const e = ev as WebKitGestureEvent;
    e.preventDefault();
    lastScale = e.scale && e.scale > 0 ? e.scale : 1;
    lastRotation = e.rotation ?? 0;
  };

  const onChange = (ev: Event) => {
    const e = ev as WebKitGestureEvent;
    e.preventDefault();
    const scale = e.scale && e.scale > 0 ? e.scale : 1;
    const rotation = e.rotation ?? 0;
    const scaleRatio = lastScale > 0 ? scale / lastScale : 1;
    let rotationDeg = rotation - lastRotation;
    if (rotationDeg > 180) rotationDeg -= 360;
    else if (rotationDeg < -180) rotationDeg += 360;
    lastScale = scale;
    lastRotation = rotation;
    onGesture({
      scaleRatio,
      rotationDeg,
      clientX: e.clientX ?? 0,
      clientY: e.clientY ?? 0,
      shiftKey: !!e.shiftKey,
      altKey: !!e.altKey,
      metaKey: !!e.metaKey,
    });
  };

  const onEnd = (ev: Event) => {
    ev.preventDefault();
    lastScale = 1;
    lastRotation = 0;
  };

  const opts: AddEventListenerOptions = { passive: false };
  el.addEventListener('gesturestart', onStart, opts);
  el.addEventListener('gesturechange', onChange, opts);
  el.addEventListener('gestureend', onEnd, opts);
  return () => {
    el.removeEventListener('gesturestart', onStart, opts);
    el.removeEventListener('gesturechange', onChange, opts);
    el.removeEventListener('gestureend', onEnd, opts);
  };
}

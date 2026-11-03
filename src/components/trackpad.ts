/**
 * Trackpad gesture detection and Safari WebKit GestureEvent normalisation.
 *
 * On macOS (and precision touchpads), two-finger swipes emit continuous pixel-mode `wheel` events
 * (`deltaMode === 0`, with `deltaX !== 0` or small initial `deltaY`), whereas two-finger pinch
 * emits `wheel` events with `ctrlKey === true` (and in Safari also `gesturestart/change/end` with
 * `scale` and `rotation`).
 */

export type WheelKind = 'pinch' | 'trackpad' | 'wheel' | 'ignore';

/**
 * One physical mouse-wheel notch on macOS in Chrome, Safari and Edge: a pixel-mode `deltaY` of this
 * size (multiples of it when macOS accelerates a fast spin). Small and fractional, so without this
 * check it looks like a trackpad swipe. Mapping libraries (e.g. Mapbox GL) use the same signature.
 */
export const MAC_WHEEL_STEP = 4.000244140625;

/**
 * Notches in a pixel-mode, single-axis wheel event with the macOS mouse-wheel signature, else 0. The
 * axis is usually y; macOS turns Shift + wheel into x.
 */
export function macWheelSteps(e: Pick<WheelEvent, 'deltaMode' | 'deltaX' | 'deltaY'>): number {
  if (e.deltaMode !== 0 || (e.deltaX !== 0) === (e.deltaY !== 0)) return 0;
  const steps = Math.abs(e.deltaX || e.deltaY) / MAC_WHEEL_STEP;
  const n = Math.round(steps);
  return n >= 1 && Math.abs(steps - n) < 1e-6 ? n : 0;
}

export interface WheelClassifier {
  classify(e: WheelEvent, now?: number): WheelKind;
  markSafariPinch(now?: number): void;
}

/**
 * What scrolling comes from: `auto` tells it apart (below); `mouse` reads every scroll as a mouse wheel
 * (zoom), `trackpad` as a trackpad swipe. Settings → 3D view → Scrolling sets it in the app (for mice that
 * scroll smoothly, e.g. Logitech with Logi Options+ smooth scrolling, which no heuristic can tell apart).
 */
export type ScrollDevice = 'auto' | 'mouse' | 'trackpad';
let scrollDevice: ScrollDevice = 'auto';
export const setScrollDevice = (d: ScrollDevice): void => void (scrollDevice = d);
export const getScrollDevice = (): ScrollDevice => scrollDevice;

/** Events this close together (ms) belong to one scroll gesture. */
const GESTURE_GAP = 250;

/**
 * The device seen last for sure, shared by every classifier on the page: a mouse (a line-mode or macOS
 * notch event) or a trackpad (a pinch, a Safari gesture, a diagonal swipe). Ambiguous straight up/down
 * scrolling goes with it, so a mouse that mixes notch steps with smooth in-between steps (Logitech wheels
 * on macOS) zooms throughout instead of zooming and tilting by turns.
 */
let lastDevice: 'mouse' | 'trackpad' | null = null;

/** Test hook: forget the device seen last. */
export const resetScrollDeviceMemory = (): void => void (lastDevice = null);

/**
 * Stateful classifier that distinguishes:
 * - `'pinch'`: two-finger trackpad pinch (`ctrlKey: true`)
 * - `'trackpad'`: two-finger trackpad swipe (continuous 2D pixel stream)
 * - `'wheel'`: physical mouse wheel ticks (line/page mode, the macOS notch signature, or a smooth mouse)
 * - `'ignore'`: duplicate `ctrlKey` wheel event emitted alongside Safari's `gesturechange`
 *
 * One scroll gesture (events less than 250 ms apart) keeps one reading; it only changes on proof: a
 * diagonal event (never a mouse wheel) makes it a trackpad swipe, a notch or line event a mouse wheel.
 */
export function createWheelClassifier(): WheelClassifier {
  let lastWheelAt = -Infinity;
  let lastSafariScaleAt = -Infinity;
  let gesture: 'wheel' | 'trackpad' | null = null;

  const decide = (kind: 'wheel' | 'trackpad', now: number): WheelKind => {
    gesture = kind;
    lastWheelAt = now;
    return kind;
  };

  return {
    markSafariPinch(now = performance.now()) {
      lastSafariScaleAt = now;
      lastDevice = 'trackpad';
    },
    classify(e: WheelEvent, now = performance.now()): WheelKind {
      if (e.ctrlKey) {
        if (now - lastSafariScaleAt < 60) return 'ignore';
        lastDevice = 'trackpad';
        return 'pinch';
      }
      // Line or page mode is always a discrete physical mouse wheel; on macOS so is a notch.
      if (e.deltaMode !== 0 || macWheelSteps(e)) {
        lastDevice = 'mouse';
        return decide('wheel', now);
      }
      if (scrollDevice !== 'auto') return decide(scrollDevice === 'mouse' ? 'wheel' : 'trackpad', now);

      const diagonal = e.deltaX !== 0 && e.deltaY !== 0;
      if (diagonal) lastDevice = 'trackpad';
      const dt = now - lastWheelAt;
      // Within a gesture: keep its reading unless this event proves a trackpad.
      if (gesture && dt >= 0 && dt < GESTURE_GAP) return decide(diagonal ? 'trackpad' : gesture, now);

      // A new gesture.
      if (diagonal) return decide('trackpad', now);
      // Straight up/down or sideways only: whatever device was seen last for sure.
      if (lastDevice) return decide(lastDevice === 'mouse' ? 'wheel' : 'trackpad', now);

      const legacy = e as WheelEvent & { wheelDeltaY?: number; wheelDeltaX?: number };
      const hasX = Math.abs(e.deltaX) > 0;
      const fractional = !Number.isInteger(e.deltaX) || !Number.isInteger(e.deltaY);
      const smallStart = Math.abs(e.deltaY) > 0 && Math.abs(e.deltaY) < 48;
      const smoothWebkit =
        typeof legacy.wheelDeltaY === 'number' &&
        legacy.wheelDeltaY !== 0 &&
        Math.abs(legacy.wheelDeltaY) % 120 !== 0;
      const rapidStream = dt > 0 && dt < 35 && Math.abs(e.deltaY) < 90;
      return decide(hasX || fractional || smallStart || smoothWebkit || rapidStream ? 'trackpad' : 'wheel', now);
    },
  };
}

/** Pixels per wheel line: a 3-line mouse notch moves as far as Chrome's 100 px notch. */
const LINE_PX = 100 / 3;
/** Pixels per wheel page. */
const PAGE_PX = 800;
/** Pixels per macOS mouse-wheel notch: the same step as a Windows Chrome notch. */
const MAC_NOTCH_PX = 100;
/** Most macOS notches one event counts as (a fast spin is accelerated by the OS into big multiples). */
const MAC_NOTCH_MAX = 3;

/**
 * Wheel deltas in pixels, whatever the event's `deltaMode`. Read it after `classify`: Firefox reports a
 * mouse wheel in lines (3 per notch) once `deltaMode` has been read, which would otherwise zoom ~30× slower.
 * A macOS mouse notch (~4 px) counts as a 100 px notch, so it zooms like a wheel elsewhere instead of ~25× slower.
 */
export function wheelDelta(e: WheelEvent): { x: number; y: number } {
  const steps = macWheelSteps(e);
  if (steps) {
    const px = Math.min(steps, MAC_NOTCH_MAX) * MAC_NOTCH_PX;
    return { x: Math.sign(e.deltaX) * px, y: Math.sign(e.deltaY) * px };
  }
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

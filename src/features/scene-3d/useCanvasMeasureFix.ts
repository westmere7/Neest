import { useEffect } from 'react';

/**
 * React Three Fiber sizes its canvas with react-use-measure, which ignores
 * ResizeObserver callbacks that arrive before its own effects have run. When
 * a lazily loaded 3D view is revealed by Suspense, that first (and only)
 * callback can be dropped, leaving the canvas measured as 0×0 so the WebGL
 * root is never created. A window resize event makes the hook re-measure, so
 * we send one (twice, to cover slow first loads) after mounting.
 */
export function useCanvasMeasureFix(): void {
  useEffect(() => {
    const kick = () => window.dispatchEvent(new Event('resize'));
    const raf = requestAnimationFrame(kick);
    const t1 = setTimeout(kick, 120);
    const t2 = setTimeout(kick, 600);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);
}

/** Component form, for canvases that mount later than their parent component. */
export function CanvasMeasureKick(): null {
  useCanvasMeasureFix();
  return null;
}

interface EventComputeState {
  gl: { domElement: HTMLCanvasElement };
  pointer: { set(x: number, y: number): unknown };
  raycaster: { setFromCamera(coords: unknown, camera: unknown): void };
  camera: unknown;
}

/**
 * Pointer → NDC using client coordinates and the canvas rectangle. R3F's
 * default uses offsetX/offsetY, which disagree with the measured canvas size
 * when an ancestor is scaled with CSS (zoom/transform), sending rays to the
 * wrong place. Pass to `onCreated` as `state.setEvents({ compute: clientCompute })`.
 */
export function clientCompute(event: { clientX: number; clientY: number }, state: EventComputeState): void {
  const rect = state.gl.domElement.getBoundingClientRect();
  state.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
  state.raycaster.setFromCamera(state.pointer, state.camera);
}

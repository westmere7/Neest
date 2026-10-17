import type { CameraPreset, Vec3Tuple } from '@/domain/model/schema';
import type { Bounds } from '@/domain/geometry/vec';

export interface CameraView {
  projection: 'perspective' | 'orthographic';
  position: Vec3Tuple;
  target: Vec3Tuple;
  fov: number;
  /** Orthographic zoom (pixels per metre); recomputed to fit when `fitOrtho` is set. */
  zoom: number;
  fitOrtho?: { width: number; depth: number };
  /** Frame this sphere (world centre + radius) along `dir` when the view is applied. */
  fitSphere?: { center: Vec3Tuple; radius: number; dir: Vec3Tuple };
}

export type NamedView = 'home' | 'perspective' | 'top' | 'iso' | 'front';

/** Built-in camera views framed around the plan bounds. */
export function namedView(view: NamedView, bounds: Bounds | null): CameraView {
  const b = bounds ?? { minX: -4, minY: -4, maxX: 4, maxY: 4 };
  const cx = (b.minX + b.maxX) / 2;
  const cz = (b.minY + b.maxY) / 2;
  const w = Math.max(2, b.maxX - b.minX);
  const d = Math.max(2, b.maxY - b.minY);
  const s = Math.max(w, d);
  switch (view) {
    case 'top':
      return { projection: 'orthographic', position: [cx, 60, cz + 0.0001], target: [cx, 0, cz], fov: 45, zoom: 40, fitOrtho: { width: w * 1.15, depth: d * 1.15 } };
    case 'iso': {
      const k = s * 1.4;
      return { projection: 'orthographic', position: [cx + k, k * 0.8165, cz + k], target: [cx, 0.6, cz], fov: 45, zoom: 40, fitOrtho: { width: s * 1.55, depth: s * 1.2 } };
    }
    case 'front':
      return { projection: 'perspective', position: [cx, 1.6 + s * 0.35, cz + s * 1.35], target: [cx, 0.8, cz], fov: 45, zoom: 1 };
    case 'home':
    case 'perspective':
    default: {
      const radius = Math.hypot(w, d) / 2 + 0.6;
      const center: Vec3Tuple = [cx, 1.0, cz];
      return {
        projection: 'perspective',
        position: [cx + s * 0.55, s * 0.95 + 2, cz + s * 0.95],
        target: [cx, 0, cz],
        fov: 45,
        zoom: 1,
        fitSphere: { center, radius, dir: [0.48, 0.72, 0.5] },
      };
    }
  }
}

export function presetView(p: CameraPreset): CameraView {
  return { projection: p.projection, position: p.position, target: p.target, fov: p.fov, zoom: p.zoom };
}

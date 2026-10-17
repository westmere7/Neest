import type { PlacedObject } from '@/domain/model/schema';
import type { AssetDefinition } from './types';

/** One light of a placed fixture, in world space (x, elevation, plan y → three.js x, y, z). */
export interface ResolvedLight {
  /** Stable key: object id plus head index. */
  key: string;
  kind: 'point' | 'spot';
  color: string;
  intensity: number;
  distance: number;
  position: [number, number, number];
  /** Unit direction (spot lights only; straight down otherwise). */
  dir: [number, number, number];
  angle: number;
  penumbra: number;
}

const DOWN: [number, number, number] = [0, -1, 0];

/**
 * Scene brightness of fixtures relative to their `intensity` values. Calibrated by eye against the
 * evening ambient: at ×1 a 2.5 m ceiling spot left no visible pool on the floor; ×4 gives soft,
 * believable pools while lamps stay subtle in daylight, as real ones do.
 */
export const LAMP_GAIN = 4;

/**
 * The lights a placed object emits. Head positions scale with the object's size relative to the
 * asset's default size, mirror with it and turn with its rotation (the scene draws an object with
 * rotation.y = -obj.rotation and scale.x = -1 when mirrored).
 */
export function resolveObjectLights(obj: PlacedObject, asset: AssetDefinition | null | undefined): ResolvedLight[] {
  const L = asset?.light;
  if (!L || obj.hidden) return [];
  const def = asset.defaultSize;
  const sx = def.w > 0 ? obj.width / def.w : 1;
  const sy = def.h > 0 ? obj.height / def.h : 1;
  const sz = def.d > 0 ? obj.depth / def.d : 1;
  const m = obj.mirrored ? -1 : 1;
  const t = -obj.rotation;
  const c = Math.cos(t);
  const s = Math.sin(t);
  // Ry(t) applied to a local vector (after mirroring), as three.js does for the object's group.
  const turn = (x: number, y: number, z: number): [number, number, number] => [x * m * c + z * s, y, -(x * m) * s + z * c];
  const kind = L.kind === 'spot' ? 'spot' : 'point';
  const heads = L.heads?.length ? L.heads : [{ x: L.x, y: L.y, z: L.z, dir: L.dir }];
  return heads.map((h, i) => {
    const p = turn((h.x ?? 0) * sx, h.y * sy, (h.z ?? 0) * sz);
    const raw = h.dir ?? L.dir ?? DOWN;
    const len = Math.hypot(raw[0], raw[1], raw[2]) || 1;
    const dir = kind === 'spot' ? turn(raw[0] / len, raw[1] / len, raw[2] / len) : DOWN;
    return {
      key: `${obj.id}#${i}`,
      kind,
      color: L.color,
      intensity: L.intensity * LAMP_GAIN,
      distance: L.distance,
      position: [obj.x + p[0], obj.elevation + p[1], obj.y + p[2]],
      dir,
      angle: L.angle ?? 0.6,
      penumbra: L.penumbra ?? 0.4,
    };
  });
}

/**
 * Live lights per render quality: point and spot pools, how many spot / point slots cast shadows
 * (shadow maps redraw only when the scene changes), and whether lights keep their fixture's range
 * or reach the whole view (natural inverse-square fall-off, no cut-off). Shadow casters are capped
 * so sun + lamp shadow maps + material maps stay within 16 texture units.
 */
export const LAMP_BUDGET = {
  draft: { point: 0, spot: 0, shadows: 0, pointShadows: 0, fullRange: false },
  balanced: { point: 4, spot: 3, shadows: 0, pointShadows: 0, fullRange: false },
  high: { point: 8, spot: 6, shadows: 2, pointShadows: 0, fullRange: false },
  ultra: { point: 16, spot: 12, shadows: 4, pointShadows: 2, fullRange: true },
} as const;

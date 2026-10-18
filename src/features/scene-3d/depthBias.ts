import * as THREE from 'three';

/** Walls: always win depth ties against objects (whose slot biases stay below this). */
export const WALL_DEPTH_BIAS = -6;
/**
 * Wall trim (glass frames, railings, mouldings): drawn slightly farther, so it loses every tie. It
 * has a slope term too (pushing away is safe: a face seen edge-on only sinks further behind what
 * covers it), which keeps it losing at grazing angles where a constant offset is not enough.
 */
export const EXTRAS_DEPTH_BIAS = 3;
export const EXTRAS_DEPTH_SLOPE = 1.5;
/** Step between an item's slots, by size rank; at most 3 steps stay below the walls' bias. */
const SLOT_STEP = -1.5;

/**
 * Depth bias against z-fighting, per mesh: a constant polygon offset (a slope term only for meshes
 * pushed away — pulled nearer, a slope-scaled offset brings hidden faces seen edge-on in front of the
 * surfaces that cover them)
 * switched on only during this mesh's own draw calls, because its materials are shared with
 * other meshes. Negative `units` draw nearer (coplanar or slightly buried surfaces of other meshes
 * lose the depth tie), positive ones farther.
 */
export function biasDepth(mesh: THREE.Mesh, units: number, factor = 0): void {
  if (!units && !factor) return;
  const saved = new WeakMap<THREE.Material, [boolean, number, number]>();
  mesh.onBeforeRender = (_r, _s, _c, _g, material) => {
    saved.set(material, [material.polygonOffset, material.polygonOffsetFactor, material.polygonOffsetUnits]);
    material.polygonOffset = true;
    material.polygonOffsetFactor = factor;
    material.polygonOffsetUnits = units;
  };
  mesh.onAfterRender = (_r, _s, _c, _g, material) => {
    const prev = saved.get(material);
    if (!prev) return;
    [material.polygonOffset, material.polygonOffsetFactor, material.polygonOffsetUnits] = prev;
  };
}

/** Total triangle area of a geometry (cached on it). */
export function surfaceArea(geo: THREE.BufferGeometry): number {
  const cached = geo.userData.surfaceArea as number | undefined;
  if (cached !== undefined) return cached;
  const pos = geo.getAttribute('position');
  const idx = geo.getIndex();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = idx ? idx.count : pos.count;
  let area = 0;
  for (let i = 0; i + 2 < n; i += 3) {
    const [i0, i1, i2] = idx ? [idx.getX(i), idx.getX(i + 1), idx.getX(i + 2)] : [i, i + 1, i + 2];
    a.fromBufferAttribute(pos, i0);
    b.fromBufferAttribute(pos, i1);
    c.fromBufferAttribute(pos, i2);
    area += b.sub(a).cross(c.sub(a)).length() / 2;
  }
  geo.userData.surfaceArea = area;
  return area;
}

/**
 * Within one item, smaller slots (grilles, labels, trim, screens) win over the larger body they sit
 * on: each slot mesh gets a depth bias by its rank in surface area (the largest none).
 */
export function biasSlotsBySize(meshes: THREE.Mesh[]): void {
  if (meshes.length < 2) return;
  const ranked = [...meshes].sort((p, q) => surfaceArea(q.geometry) - surfaceArea(p.geometry));
  ranked.forEach((m, i) => biasDepth(m, Math.max(SLOT_STEP * i, WALL_DEPTH_BIAS + 1.5)));
}

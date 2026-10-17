import type { Vec2 } from '@/domain/model/schema';
import { add, angleOf, dist, leftNormal, normalize, scale, sub } from '@/domain/geometry/vec';

export interface DimensionSpec {
  a: Vec2;
  b: Vec2;
  /** Signed offset along the left normal of a→b, in world units. */
  offset: number;
  text: string;
}

export interface DimensionGeometry {
  ext1: [Vec2, Vec2];
  ext2: [Vec2, Vec2];
  line: [Vec2, Vec2];
  tick1: [Vec2, Vec2];
  tick2: [Vec2, Vec2];
  textPos: Vec2;
  /** Text rotation in degrees, kept upright. */
  textAngle: number;
  length: number;
}

/**
 * Architectural dimension: extension lines from the measured points, a
 * dimension line at `offset`, 45° tick marks, and upright text. `px` is the
 * world size of one screen pixel (or print point), keeping annotations a
 * constant visual size at any zoom or drawing scale.
 */
export function dimensionGeometry(spec: DimensionSpec, px: number): DimensionGeometry {
  const d = normalize(sub(spec.b, spec.a));
  const n = leftNormal(d);
  const sign = Math.sign(spec.offset) || 1;
  const off = scale(n, spec.offset);
  const pa = add(spec.a, off);
  const pb = add(spec.b, off);
  const gap = 3 * px;
  const over = 4 * px;
  const ext1: [Vec2, Vec2] = [add(spec.a, scale(n, sign * gap)), add(pa, scale(n, sign * over))];
  const ext2: [Vec2, Vec2] = [add(spec.b, scale(n, sign * gap)), add(pb, scale(n, sign * over))];
  const tickDir = normalize(add(d, n));
  const tk = 4 * px;
  const tick1: [Vec2, Vec2] = [add(pa, scale(tickDir, -tk)), add(pa, scale(tickDir, tk))];
  const tick2: [Vec2, Vec2] = [add(pb, scale(tickDir, -tk)), add(pb, scale(tickDir, tk))];
  let angle = (angleOf(d) * 180) / Math.PI;
  let textN = n;
  if (angle > 90.01 || angle <= -89.99) {
    angle += 180;
    textN = scale(n, -1);
  }
  if (angle > 180) angle -= 360;
  // Text sits on the outer side of the dimension line.
  const outward = sign > 0 ? n : scale(n, -1);
  // textN is the glyphs' "up" direction; baseline sits above or below the line accordingly.
  const textOffset = dotSign(outward, textN) > 0 ? 3.5 * px : -(3.5 + 8.5) * px;
  const textPos = add(add(pa, scale(sub(pb, pa), 0.5)), scale(textN, textOffset));
  return {
    ext1,
    ext2,
    line: [pa, pb],
    tick1,
    tick2,
    textPos,
    textAngle: angle,
    length: dist(spec.a, spec.b),
  };
}

const dotSign = (a: Vec2, b: Vec2) => a.x * b.x + a.y * b.y;

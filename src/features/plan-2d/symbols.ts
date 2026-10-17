import type { Opening, Vec2 } from '@/domain/model/schema';
import { pointAt } from '@/domain/geometry/wallPath';
import type { OpeningSpan, WallGeometry } from '@/domain/geometry/walls';
import { add, angleOf, leftNormal, scale } from '@/domain/geometry/vec';

/** Vector primitives shared by SVG, PDF and DXF output. Angles are plan radians. */
export type PlanPrim =
  | { t: 'line'; a: Vec2; b: Vec2; role: PrimRole; dash?: boolean }
  | { t: 'arc'; c: Vec2; r: number; start: number; end: number; role: PrimRole; dash?: boolean }
  | { t: 'poly'; pts: Vec2[]; closed: boolean; role: PrimRole; fill?: boolean };

export type PrimRole = 'opening' | 'leaf' | 'swing' | 'glass' | 'frame' | 'jamb' | 'thin';

/**
 * Builds the technical plan symbol for an opening: jambs, door leaves with
 * swing arcs, sliding panels, or window frames with glazing lines.
 */
export function openingSymbol(opening: Opening, geom: WallGeometry, span: OpeningSpan): PlanPrim[] {
  const out: PlanPrim[] = [];
  const h = geom.h;
  const mid = pointAt(geom.path, span.center);
  const T = mid.tangent;
  const N = leftNormal(T);
  const at = (s: number, off: number) => {
    const { p, tangent } = pointAt(geom.path, s);
    return add(p, scale(leftNormal(tangent), off));
  };
  const L0 = at(span.s0, h);
  const L1 = at(span.s1, h);
  const R0 = at(span.s0, -h);
  const R1 = at(span.s1, -h);
  out.push({ t: 'line', a: L0, b: R0, role: 'jamb' }, { t: 'line', a: L1, b: R1, role: 'jamb' });
  const width = span.s1 - span.s0;
  const side = opening.swingSide === 'left' ? 1 : -1;
  const sideN = scale(N, side);
  const leafT = Math.min(0.04, h);

  const leaf = (hingeS: number, toward: 1 | -1, len: number) => {
    // Hinge on the face toward the swing side; leaf drawn open at 90°.
    const H = at(hingeS, side * h);
    const tip = add(H, scale(sideN, len));
    const back = scale(T, -toward * leafT);
    out.push({ t: 'poly', pts: [H, tip, add(tip, back), add(H, back)], closed: true, role: 'leaf', fill: true });
    const closedDir = angleOf(scale(T, toward));
    const openDir = angleOf(sideN);
    // Sweep the short way between open and closed positions.
    let start = openDir;
    let end = closedDir;
    let delta = end - start;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    if (delta < 0) {
      start = closedDir;
      end = closedDir - delta;
    } else end = start + delta;
    out.push({ t: 'arc', c: H, r: len, start, end, role: 'swing' });
  };

  switch (opening.kind) {
    case 'door-single': {
      if (opening.hinge === 'start') leaf(span.s0, 1, width);
      else leaf(span.s1, -1, width);
      break;
    }
    case 'door-double': {
      leaf(span.s0, 1, width / 2);
      leaf(span.s1, -1, width / 2);
      break;
    }
    case 'door-sliding': {
      const panel = width * 0.55;
      const t = Math.min(0.035, h * 0.5);
      const o1 = h * 0.35;
      const o2 = -h * 0.35;
      const p1 = [at(span.s0, o1 + t / 2), at(span.s0 + panel, o1 + t / 2), at(span.s0 + panel, o1 - t / 2), at(span.s0, o1 - t / 2)];
      const p2 = [at(span.s1 - panel, o2 + t / 2), at(span.s1, o2 + t / 2), at(span.s1, o2 - t / 2), at(span.s1 - panel, o2 - t / 2)];
      out.push({ t: 'poly', pts: p1, closed: true, role: 'leaf', fill: true });
      out.push({ t: 'poly', pts: p2, closed: true, role: 'leaf', fill: true });
      break;
    }
    case 'passage': {
      out.push({ t: 'line', a: L0, b: L1, role: 'thin', dash: true }, { t: 'line', a: R0, b: R1, role: 'thin', dash: true });
      break;
    }
    case 'window-single':
    case 'window-double':
    case 'window-fixed':
    case 'window-sliding': {
      out.push({ t: 'line', a: L0, b: L1, role: 'frame' }, { t: 'line', a: R0, b: R1, role: 'frame' });
      if (opening.kind === 'window-sliding') {
        const g = h * 0.25;
        out.push({ t: 'line', a: at(span.s0, g), b: at(span.s0 + width * 0.55, g), role: 'glass' });
        out.push({ t: 'line', a: at(span.s1 - width * 0.55, -g), b: at(span.s1, -g), role: 'glass' });
      } else {
        const g = Math.min(0.012, h * 0.2);
        out.push({ t: 'line', a: at(span.s0, g), b: at(span.s1, g), role: 'glass' });
        out.push({ t: 'line', a: at(span.s0, -g), b: at(span.s1, -g), role: 'glass' });
        if (opening.kind === 'window-double') {
          out.push({ t: 'line', a: at(span.center, h), b: at(span.center, -h), role: 'frame' });
        }
      }
      break;
    }
  }
  void mid;
  return out;
}

/** Arc as an SVG path command string (plan coordinates, y down). */
export function arcPath(c: Vec2, r: number, start: number, end: number, f = (n: number) => n.toFixed(4)): string {
  const a = { x: c.x + Math.cos(start) * r, y: c.y + Math.sin(start) * r };
  const b = { x: c.x + Math.cos(end) * r, y: c.y + Math.sin(end) * r };
  const large = end - start > Math.PI ? 1 : 0;
  return `M${f(a.x)} ${f(a.y)}A${f(r)} ${f(r)} 0 ${large} 1 ${f(b.x)} ${f(b.y)}`;
}

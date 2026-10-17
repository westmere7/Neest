import type { Opening, Vec2 } from '@/domain/model/schema';
import { pointAt } from '@/domain/geometry/wallPath';
import type { OpeningSpan, WallGeometry } from '@/domain/geometry/walls';
import { add, angleOf, leftNormal, scale, sub } from '@/domain/geometry/vec';

/** Vector primitives shared by SVG, PDF and DXF output. Angles are plan radians. */
export type PlanPrim =
  | { t: 'line'; a: Vec2; b: Vec2; role: PrimRole; dash?: boolean }
  | { t: 'arc'; c: Vec2; r: number; start: number; end: number; role: PrimRole; dash?: boolean }
  | { t: 'poly'; pts: Vec2[]; closed: boolean; role: PrimRole; fill?: boolean };

export type PrimRole = 'opening' | 'leaf' | 'swing' | 'glass' | 'frame' | 'jamb' | 'thin';

/**
 * Builds the technical plan symbol for an opening: jambs, door leaves with
 * swing arcs, sliding/pocket/bi-fold/barn/pivot leaves, passage head lines, or
 * window frames with glazing lines; plus grille bars, shutters and casing.
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

  /** Arc about `c` sweeping the short way between two directions. */
  const sweep = (c: Vec2, r: number, dirA: Vec2, dirB: Vec2, role: PrimRole = 'swing', dash?: boolean) => {
    const a = angleOf(dirA);
    const b = angleOf(dirB);
    let start = a;
    let end = b;
    let delta = end - start;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    if (delta < 0) {
      start = b;
      end = b - delta;
    } else end = start + delta;
    out.push({ t: 'arc', c, r, start, end, role, ...(dash ? { dash } : {}) });
  };
  /** Full circle as two half arcs (a single 0–2π arc has coincident end points). */
  const circle = (c: Vec2, r: number, role: PrimRole) => {
    out.push({ t: 'arc', c, r, start: 0, end: Math.PI, role }, { t: 'arc', c, r, start: Math.PI, end: Math.PI * 2, role });
  };
  /** Line following the wall path from s0 to s1 at a normal offset (split so curved walls stay inside). */
  const pathLine = (s0: number, s1: number, off: number, role: PrimRole, dash?: boolean, n = 4) => {
    for (let i = 0; i < n; i++) {
      const a = at(s0 + ((s1 - s0) * i) / n, off);
      const b = at(s0 + ((s1 - s0) * (i + 1)) / n, off);
      out.push({ t: 'line', a, b, role, ...(dash ? { dash } : {}) });
    }
  };
  /** Thin rectangle along the wall between arc lengths s0..s1 and normal offsets o0..o1. */
  const band = (s0: number, s1: number, o0: number, o1: number, role: PrimRole, fill: boolean) => {
    out.push({ t: 'poly', pts: [at(s0, o0), at(s1, o0), at(s1, o1), at(s0, o1)], closed: true, role, fill });
  };

  const leaf = (hingeS: number, toward: 1 | -1, len: number) => {
    // Hinge on the face toward the swing side; leaf drawn open at 90°.
    const H = at(hingeS, side * h);
    const tip = add(H, scale(sideN, len));
    const back = scale(T, -toward * leafT);
    out.push({ t: 'poly', pts: [H, tip, add(tip, back), add(H, back)], closed: true, role: 'leaf', fill: true });
    // Sweep the short way between open and closed positions.
    sweep(H, len, sideN, scale(T, toward));
  };
  const win = opening.kind.startsWith('window');
  const toStart = opening.hinge === 'start';

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
    case 'door-french': {
      leaf(span.s0, 1, width / 2);
      leaf(span.s1, -1, width / 2);
      break;
    }
    case 'door-pocket': {
      // Leaf drawn dashed inside the wall on the hinge side, plus its closing path across the opening.
      const lt = Math.min(0.035, h * 0.8);
      const ps = toStart ? span.s0 : span.s1;
      const avail = toStart ? span.s0 - geom.clearStart : geom.clearEnd - span.s1;
      const len = Math.max(0, Math.min(width, avail));
      const far = toStart ? ps - len : ps + len;
      if (len > 1e-3) {
        pathLine(far, ps, lt / 2, 'leaf', true);
        pathLine(far, ps, -lt / 2, 'leaf', true);
        out.push({ t: 'line', a: at(far, lt / 2), b: at(far, -lt / 2), role: 'leaf', dash: true });
      }
      pathLine(span.s0, span.s1, 0, 'thin', true, 1);
      break;
    }
    case 'door-bifold': {
      // Zig-zag panels folding toward the hinge jamb, drawn part-open on the swing side.
      const n = width >= 1.2 - 1e-6 ? 4 : 2;
      const toward = toStart ? 1 : -1;
      const H0 = at(toStart ? span.s0 : span.s1, side * h);
      const pw = width / n;
      const th = (50 * Math.PI) / 180;
      const pts = [H0];
      for (let k = 1; k <= n; k++) pts.push(add(add(H0, scale(T, toward * k * pw * Math.cos(th))), scale(sideN, k % 2 ? pw * Math.sin(th) : 0)));
      out.push({ t: 'poly', pts, closed: false, role: 'leaf' });
      pathLine(span.s0, span.s1, side * h, 'thin', true, 1);
      break;
    }
    case 'door-barn': {
      // Leaf outside the wall face on the swing side; the rail as a thin line, the open position dashed.
      const leafW = width + 0.1;
      const stand = opening.casing ? 0.018 : 0;
      const o0 = side * (h + stand + 0.012);
      const o1 = side * (h + stand + 0.052);
      const a0 = span.s0 - 0.05;
      const a1 = span.s1 + 0.05;
      const shift = toStart ? -leafW : leafW;
      pathLine(Math.min(a0, a0 + shift) - 0.05, Math.max(a1, a1 + shift) + 0.05, side * (h + stand + 0.03), 'thin', false, 2);
      pathLine(a0 + shift, a1 + shift, o1, 'thin', true, 1);
      band(a0, a1, o0, o1, 'leaf', true);
      break;
    }
    case 'door-pivot': {
      // Leaf open at 90° about a pivot ~15 % in from the hinge jamb, with both swing arcs.
      const toward = toStart ? 1 : -1;
      const pOff = 0.15 * width;
      const P = at((toStart ? span.s0 : span.s1) + toward * pOff, 0);
      const long = width - pOff;
      const half = scale(T, leafT / 2);
      const tail = add(P, scale(sideN, -pOff));
      const tip = add(P, scale(sideN, long));
      out.push({ t: 'poly', pts: [add(tail, half), add(tip, half), sub(tip, half), sub(tail, half)], closed: true, role: 'leaf', fill: true });
      sweep(P, long, sideN, scale(T, toward));
      sweep(P, pOff, scale(sideN, -1), scale(T, -toward), 'swing', true);
      circle(P, Math.min(0.03, Math.max(0.01, h * 0.5)), 'leaf');
      break;
    }
    case 'passage':
    case 'passage-arched':
    case 'passage-moon': {
      out.push({ t: 'line', a: L0, b: L1, role: 'thin', dash: true }, { t: 'line', a: R0, b: R1, role: 'thin', dash: true });
      if (opening.kind === 'passage-moon') circle(mid.p, Math.min(width * 0.2, Math.max(h * 0.8, 0.03)), 'thin');
      break;
    }
    case 'window-single':
    case 'window-double':
    case 'window-fixed':
    case 'window-sliding':
    case 'window-arched':
    case 'window-round':
    case 'window-tall': {
      // Floor-to-ceiling windows have no sill, so no sill lines on the faces.
      if (opening.kind !== 'window-tall') out.push({ t: 'line', a: L0, b: L1, role: 'frame' }, { t: 'line', a: R0, b: R1, role: 'frame' });
      if (opening.kind === 'window-round') circle(mid.p, Math.min(width * 0.2, Math.max(h * 0.7, 0.03)), 'thin');
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

  // Options drawn on the plan. Sashes open outward, so the exterior is the swing side.
  const ext = side;
  if (win && opening.grille === 'bars') {
    const o = ext * (h + 0.04);
    pathLine(span.s0, span.s1, o, 'thin', false, 1);
    for (const s of [span.s0, span.s1]) out.push({ t: 'line', a: at(s, ext * h), b: at(s, o), role: 'thin' });
  }
  const cw = 0.07;
  if (win && opening.shutters) {
    const x0 = (opening.casing ? cw : 0) + 0.01;
    band(span.s0 - x0 - width / 2, span.s0 - x0, ext * (h + 0.005), ext * (h + 0.035), 'leaf', true);
    band(span.s1 + x0, span.s1 + x0 + width / 2, ext * (h + 0.005), ext * (h + 0.035), 'leaf', true);
  }
  if (opening.casing) {
    for (const o of [h, -h]) {
      const o1 = o + Math.sign(o) * 0.018;
      band(span.s0 - cw, span.s0 + 0.005, o, o1, 'frame', false);
      band(span.s1 - 0.005, span.s1 + cw, o, o1, 'frame', false);
    }
  }
  return out;
}

/** Arc as an SVG path command string (plan coordinates, y down). */
export function arcPath(c: Vec2, r: number, start: number, end: number, f = (n: number) => n.toFixed(4)): string {
  const a = { x: c.x + Math.cos(start) * r, y: c.y + Math.sin(start) * r };
  const b = { x: c.x + Math.cos(end) * r, y: c.y + Math.sin(end) * r };
  const large = end - start > Math.PI ? 1 : 0;
  return `M${f(a.x)} ${f(a.y)}A${f(r)} ${f(r)} 0 ${large} 1 ${f(b.x)} ${f(b.y)}`;
}

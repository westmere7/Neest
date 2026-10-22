import { describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { createEmptyProject } from '@/domain/model/defaults';
import type { Opening, OpeningKind, Vec2 } from '@/domain/model/schema';
import { OpeningKindSchema } from '@/domain/model/schema';
import { addWallChain } from '@/domain/commands/walls';
import { addOpening } from '@/domain/commands/entities';
import { computeWallNetwork } from '@/domain/geometry/walls';
import { openingSymbol, type PlanPrim } from './symbols';

const KINDS = OpeningKindSchema.options as OpeningKind[];
const T = 0.2;
const h = T / 2;

/** One 8 m wall along +x from the origin; its left normal is (0, -1), so offset = -y. */
function symbol(kind: OpeningKind, patch: Partial<Opening> = {}, width?: number) {
  let id = '';
  const project = produce(createEmptyProject(), (d) => {
    const [wallId] = addWallChain(d, [{ x: 0, y: 0 }, { x: 8, y: 0 }], { thickness: T, height: 2.7, role: 'interior' });
    id = addOpening(d, { wallId, kind, offset: 4, width })!;
    Object.assign(d.openings[id], patch);
  });
  const o = project.openings[id];
  const g = computeWallNetwork(project).walls.get(o.wallId)!;
  const span = g.spans.find((s) => s.id === id)!;
  return { prims: openingSymbol(o, g, span), span };
}

const offset = (p: Vec2) => -p.y;
const points = (prim: PlanPrim): Vec2[] =>
  prim.t === 'line' ? [prim.a, prim.b] : prim.t === 'poly' ? prim.pts : [prim.c];

describe('openingSymbol', () => {
  it('returns finite primitives for every kind, with and without options', () => {
    for (const kind of KINDS) {
      for (const patch of [{}, { casing: true, shutters: true, grille: 'bars' as const, transom: true, threshold: true }, { swingSide: 'right' as const, hinge: 'end' as const }]) {
        const { prims } = symbol(kind, patch);
        expect(prims.length, kind).toBeGreaterThan(2);
        expect(prims.filter((p) => p.role === 'jamb'), kind).toHaveLength(2);
        for (const prim of prims) {
          for (const p of points(prim)) expect(Number.isFinite(p.x) && Number.isFinite(p.y), kind).toBe(true);
          if (prim.t === 'arc') expect(prim.end).toBeGreaterThan(prim.start);
        }
      }
    }
  });

  it('draws frameless glass leaves as thin glass, other leaves as before', () => {
    for (const kind of ['door-single', 'door-double', 'door-french', 'door-sliding', 'door-pocket', 'door-barn', 'door-pivot'] as OpeningKind[]) {
      const glass = symbol(kind, { design: 'glass-frameless' }).prims;
      const timber = symbol(kind, { design: 'flush' }).prims;
      // Leaf bodies only (the pivot door's pivot marker stays a leaf-coloured circle).
      const body = (p: PlanPrim) => p.t !== 'arc';
      expect(glass.filter((p) => p.role === 'leaf' && body(p)), kind).toHaveLength(0);
      expect(glass.filter((p) => p.role === 'glass').length, kind).toBe(timber.filter((p) => p.role === 'leaf' && body(p)).length);
      expect(timber.some((p) => p.role === 'glass'), kind).toBe(false);
    }
    // Swing leaves: a 12 mm pane instead of a 40 mm slab.
    const leafOf = (prims: PlanPrim[], role: PlanPrim['role']) => prims.find((p) => p.t === 'poly' && p.role === role) as Extract<PlanPrim, { t: 'poly' }>;
    const thin = leafOf(symbol('door-single', { design: 'glass-frameless' }).prims, 'glass');
    const xs = thin.pts.map((p) => p.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(0.012, 6);
    // Framed glass designs keep the leaf symbol.
    expect(symbol('door-single', { design: 'steel-slim' }).prims.some((p) => p.role === 'leaf')).toBe(true);
  });

  it('keeps the pocket door leaf inside the wall thickness', () => {
    for (const hinge of ['start', 'end'] as const) {
      const { prims, span } = symbol('door-pocket', { hinge });
      const leaf = prims.filter((p) => p.role === 'leaf');
      expect(leaf.length).toBeGreaterThan(0);
      for (const prim of leaf) {
        expect(prim.t === 'line' && prim.dash).toBe(true);
        for (const p of points(prim)) {
          expect(Math.abs(offset(p))).toBeLessThanOrEqual(h + 1e-9);
          // Drawn in the pocket beside the opening, on the hinge side.
          if (hinge === 'start') expect(p.x).toBeLessThanOrEqual(span.s0 + 1e-9);
          else expect(p.x).toBeGreaterThanOrEqual(span.s1 - 1e-9);
        }
      }
    }
  });

  it('draws the barn door leaf outside the wall on the swing face, with its rail', () => {
    for (const swingSide of ['left', 'right'] as const) {
      const side = swingSide === 'left' ? 1 : -1;
      const { prims, span } = symbol('door-barn', { swingSide });
      const leaf = prims.filter((p) => p.role === 'leaf');
      expect(leaf).toHaveLength(1);
      for (const p of points(leaf[0])) expect(offset(p) * side).toBeGreaterThan(h);
      const xs = points(leaf[0]).map((p) => p.x);
      expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(span.s1 - span.s0);
      // Rail: thin solid lines on the same face, longer than the opening.
      const rail = prims.filter((p) => p.t === 'line' && p.role === 'thin' && !p.dash);
      expect(rail.length).toBeGreaterThan(0);
      const rx = rail.flatMap(points).map((p) => p.x);
      expect(Math.max(...rx) - Math.min(...rx)).toBeGreaterThan(2 * (span.s1 - span.s0));
      for (const p of rail.flatMap(points)) expect(offset(p) * side).toBeGreaterThan(h);
    }
  });

  it('draws bi-fold panels as a zig-zag (4 panels from 1.2 m)', () => {
    const zig = (width: number) => symbol('door-bifold', {}, width).prims.find((p) => p.t === 'poly' && p.role === 'leaf');
    const wide = zig(1.4);
    expect(wide && wide.t === 'poly' && wide.pts.length).toBe(5);
    const narrow = zig(0.9);
    expect(narrow && narrow.t === 'poly' && narrow.pts.length).toBe(3);
  });

  it('draws French doors as a double swing and the pivot door with its pivot and arcs', () => {
    expect(symbol('door-french').prims.filter((p) => p.t === 'arc' && p.role === 'swing')).toHaveLength(2);
    const pivot = symbol('door-pivot').prims;
    expect(pivot.filter((p) => p.t === 'arc' && p.role === 'swing')).toHaveLength(2);
    expect(pivot.filter((p) => p.t === 'arc' && p.role === 'leaf')).toHaveLength(2); // pivot point circle
  });

  it('marks passages with dashed head lines and the moon gate with a circle', () => {
    for (const kind of ['passage-arched', 'passage-moon'] as const) {
      expect(symbol(kind).prims.filter((p) => p.t === 'line' && p.dash)).toHaveLength(2);
    }
    expect(symbol('passage-moon').prims.filter((p) => p.t === 'arc')).toHaveLength(2);
    expect(symbol('passage-arched').prims.filter((p) => p.t === 'arc')).toHaveLength(0);
  });

  it('marks round windows with a circle and tall windows without sill lines', () => {
    expect(symbol('window-round').prims.filter((p) => p.t === 'arc')).toHaveLength(2);
    expect(symbol('window-tall').prims.filter((p) => p.role === 'frame')).toHaveLength(0);
    expect(symbol('window-arched').prims.filter((p) => p.role === 'frame')).toHaveLength(2);
  });

  it('draws bars and shutters on the exterior face and casing on both faces', () => {
    const side = 1; // swingSide left
    const base = symbol('window-single').prims.length;
    const { prims, span } = symbol('window-single', { grille: 'bars', shutters: true, casing: true });
    expect(prims.length).toBeGreaterThan(base + 4);
    const shutters = prims.filter((p) => p.t === 'poly' && p.role === 'leaf');
    expect(shutters).toHaveLength(2);
    for (const p of shutters.flatMap(points)) {
      // Exterior = swing side (sashes open outward).
      expect(offset(p) * side).toBeGreaterThan(h);
      expect(p.x <= span.s0 + 1e-9 || p.x >= span.s1 - 1e-9).toBe(true);
    }
    const casing = prims.filter((p) => p.t === 'poly' && p.role === 'frame');
    expect(casing).toHaveLength(4);
    expect(casing.some((c) => points(c).every((p) => offset(p) > 0))).toBe(true);
    expect(casing.some((c) => points(c).every((p) => offset(p) < 0))).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import {
  cleanPolygon,
  convexHull,
  isSelfIntersecting,
  labelPoint,
  offsetPolygonEdges,
  pointInPolygon,
  polygonArea,
  polygonPerimeter,
  signedArea,
  triangulate,
} from './polygon';
import { closestPointOnSegment, segmentIntersection, snapToGrid } from './vec';
import { buildWallPath, pointAt, projectOnPath, splitBezier, bezierPoint } from './wallPath';
import { formatArea, formatLength, parseLength } from '../model/units';

const L = [
  { x: 0, y: 0 },
  { x: 4, y: 0 },
  { x: 4, y: 2 },
  { x: 2, y: 2 },
  { x: 2, y: 4 },
  { x: 0, y: 4 },
];

describe('vector & segment math', () => {
  it('intersects crossing segments', () => {
    const hit = segmentIntersection({ x: 0, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }, { x: 2, y: 0 });
    expect(hit).not.toBeNull();
    expect(hit!.point.x).toBeCloseTo(1);
    expect(hit!.point.y).toBeCloseTo(1);
  });

  it('returns null for parallel and disjoint segments', () => {
    expect(segmentIntersection({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 })).toBeNull();
    expect(segmentIntersection({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: -1 }, { x: 2, y: 1 })).toBeNull();
  });

  it('projects onto segments with clamping', () => {
    const cp = closestPointOnSegment({ x: 5, y: 1 }, { x: 0, y: 0 }, { x: 4, y: 0 });
    expect(cp.t).toBe(1);
    expect(cp.dist).toBeCloseTo(Math.hypot(1, 1));
  });

  it('snaps to grid without drift', () => {
    const p = snapToGrid({ x: 0.30000000000000004, y: 1.149 }, 0.1);
    expect(p.x).toBeCloseTo(0.3, 10);
    expect(p.y).toBeCloseTo(1.1, 10);
  });
});

describe('polygons', () => {
  it('computes area and perimeter of a concave L-shape', () => {
    expect(polygonArea(L)).toBeCloseTo(12);
    expect(polygonPerimeter(L)).toBeCloseTo(16);
    expect(signedArea(L)).toBeGreaterThan(0);
  });

  it('tests point containment in concave polygons', () => {
    expect(pointInPolygon({ x: 1, y: 3 }, L)).toBe(true);
    expect(pointInPolygon({ x: 3, y: 3 }, L)).toBe(false);
  });

  it('triangulates a concave room into the correct total area', () => {
    const tris = triangulate(L);
    expect(tris.length).toBe(4);
    const area = tris.reduce((s, [a, b, c]) => s + polygonArea([L[a], L[b], L[c]]), 0);
    expect(area).toBeCloseTo(12);
  });

  it('places label points inside concave polygons', () => {
    const p = labelPoint(L);
    expect(pointInPolygon(p, L)).toBe(true);
  });

  it('insets polygon edges by per-edge distances', () => {
    const sq = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
      { x: 0, y: 4 },
    ];
    const inset = offsetPolygonEdges(sq, [-0.1, -0.1, -0.1, -0.1]);
    expect(polygonArea(inset)).toBeCloseTo(3.8 * 3.8);
    const mixed = offsetPolygonEdges(sq, [-0.15, -0.05, -0.05, -0.05]);
    expect(polygonArea(mixed)).toBeCloseTo(3.9 * 3.8);
  });

  it('detects self-intersection', () => {
    const bow = [
      { x: 0, y: 0 },
      { x: 2, y: 2 },
      { x: 2, y: 0 },
      { x: 0, y: 2 },
    ];
    expect(isSelfIntersecting(bow)).toBe(true);
    expect(isSelfIntersecting(L)).toBe(false);
  });

  it('cleans duplicate and collinear vertices', () => {
    const poly = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
      { x: 0, y: 2 },
    ];
    expect(cleanPolygon(poly)).toHaveLength(4);
  });

  it('computes convex hulls', () => {
    const hull = convexHull([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
      { x: 0, y: 2 },
    ]);
    expect(hull).toHaveLength(4);
  });
});

describe('wall paths', () => {
  it('builds straight paths with exact length', () => {
    const p = buildWallPath({ x: 0, y: 0 }, { x: 3, y: 4 }, null);
    expect(p.length).toBeCloseTo(5);
    expect(p.samples).toHaveLength(2);
    expect(pointAt(p, 2.5).p.x).toBeCloseTo(1.5);
  });

  it('approximates curved walls and projects onto them', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 4, y: 0 };
    const c = { x: 2, y: -2 };
    const p = buildWallPath(a, b, c);
    expect(p.control).not.toBeNull();
    expect(p.length).toBeGreaterThan(4);
    expect(p.length).toBeLessThan(6);
    const mid = bezierPoint(a, c, b, 0.5);
    const proj = projectOnPath(p, mid);
    expect(proj.dist).toBeLessThan(0.01);
    expect(proj.s).toBeCloseTo(p.length / 2, 1);
  });

  it('treats collinear control points as straight', () => {
    const p = buildWallPath({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 0 });
    expect(p.control).toBeNull();
  });

  it('splits Bézier curves continuously', () => {
    const a = { x: 0, y: 0 };
    const c = { x: 2, y: 3 };
    const b = { x: 4, y: 0 };
    const { first, second } = splitBezier(a, c, b, 0.3);
    const p = bezierPoint(a, c, b, 0.3);
    expect(first.b.x).toBeCloseTo(p.x);
    expect(second.a.y).toBeCloseTo(p.y);
    const q = bezierPoint(first.a, first.c, first.b, 0.5);
    const r = bezierPoint(a, c, b, 0.15);
    expect(q.x).toBeCloseTo(r.x);
    expect(q.y).toBeCloseTo(r.y);
  });
});

describe('units', () => {
  it('formats lengths in each unit', () => {
    expect(formatLength(3.2, 'm', 2)).toBe('3.20 m');
    expect(formatLength(3.2, 'cm', 0)).toBe('320 cm');
    expect(formatLength(3.2, 'mm', 2)).toBe('3200 mm');
    expect(formatLength(3.2004, 'ft', 0)).toBe(`10' 6"`);
    expect(formatLength(0.0254 * 12.5, 'in', 1)).toBe('12.5"');
  });

  it('parses user-entered lengths', () => {
    expect(parseLength('3.5', 'm')).toBeCloseTo(3.5);
    expect(parseLength('350', 'cm')).toBeCloseTo(3.5);
    expect(parseLength('350cm', 'm')).toBeCloseTo(3.5);
    expect(parseLength(`10'6"`, 'm')).toBeCloseTo(3.2004);
    expect(parseLength('10 ft 6 in', 'm')).toBeCloseTo(3.2004);
    expect(parseLength('12"', 'm')).toBeCloseTo(0.3048);
    expect(parseLength('7', 'ft')).toBeCloseTo(2.1336);
    expect(parseLength('2,5', 'm')).toBeCloseTo(2.5);
    expect(parseLength('abc', 'm')).toBeNull();
    expect(parseLength('', 'm')).toBeNull();
  });

  it('formats areas', () => {
    expect(formatArea(12.345, 'm2', 2)).toBe('12.35 m²');
    expect(formatArea(10, 'ft2', 2)).toBe('107.6 ft²');
  });
});

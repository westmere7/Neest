import { describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { createEmptyProject } from '../model/defaults';
import { addRectangleWalls } from '../commands/walls';
import { arcControlThrough, bulgePoint, findOppositeFace, offsetPolyline, signedBulge, wallFaceAt } from './drafting';
import { bezierPoint } from './wallPath';
import { computeWallNetwork } from './walls';
import { signedArea } from './polygon';
import type { Vec2 } from '../model/schema';

const close = (p: Vec2, q: Vec2, digits = 9) => {
  expect(p.x).toBeCloseTo(q.x, digits);
  expect(p.y).toBeCloseTo(q.y, digits);
};

describe('offsetPolyline', () => {
  it('offsets a single segment to its left (screen up for an eastward line)', () => {
    const out = offsetPolyline([{ x: 0, y: 0 }, { x: 4, y: 0 }], 0.5);
    close(out[0], { x: 0, y: -0.5 });
    close(out[1], { x: 4, y: -0.5 });
  });

  it('negative distances offset to the right', () => {
    const out = offsetPolyline([{ x: 0, y: 0 }, { x: 4, y: 0 }], -0.5);
    close(out[0], { x: 0, y: 0.5 });
  });

  it('joins an open L at the offset-line intersection', () => {
    // East then south (a right turn on screen): the left side is the outside of the corner.
    const out = offsetPolyline([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }], 0.1);
    expect(out).toHaveLength(3);
    close(out[0], { x: 0, y: -0.1 });
    close(out[1], { x: 4.1, y: -0.1 });
    close(out[2], { x: 4.1, y: 3 });
    // Inside of the corner.
    const inner = offsetPolyline([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }], -0.1);
    close(inner[1], { x: 3.9, y: 0.1 });
  });

  it('keeps collinear points on the offset line', () => {
    const out = offsetPolyline([{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 5, y: 0 }], 0.2);
    close(out[1], { x: 2, y: -0.2 });
  });

  it('joins non-right angles exactly (each output point is at the distance from both segments)', () => {
    const pts = [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 5, y: 2 }];
    const d = 0.15;
    const out = offsetPolyline(pts, d);
    const distToLine = (p: Vec2, a: Vec2, b: Vec2) => {
      const ab = { x: b.x - a.x, y: b.y - a.y };
      const l = Math.hypot(ab.x, ab.y);
      return Math.abs((ab.x * (p.y - a.y) - ab.y * (p.x - a.x)) / l);
    };
    expect(distToLine(out[1], pts[0], pts[1])).toBeCloseTo(d, 9);
    expect(distToLine(out[1], pts[1], pts[2])).toBeCloseTo(d, 9);
  });

  it('grows or shrinks a closed convex rectangle', () => {
    // Clockwise on screen (y down): left of each edge is outside.
    const rect = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }];
    const out = offsetPolyline(rect, 0.1, true);
    close(out[0], { x: -0.1, y: -0.1 });
    close(out[2], { x: 4.1, y: 3.1 });
    const inner = offsetPolyline(rect, -0.1, true);
    close(inner[0], { x: 0.1, y: 0.1 });
    close(inner[2], { x: 3.9, y: 2.9 });
    expect(Math.abs(signedArea(inner))).toBeCloseTo(3.8 * 2.8, 9);
  });

  it('ignores a repeated closing point', () => {
    const rect = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }, { x: 0, y: 0 }];
    expect(offsetPolyline(rect, 0.1, true)).toHaveLength(4);
  });

  it('handles a closed concave L shape', () => {
    // L-shaped outline, clockwise on screen. The reflex corner is (2, 2).
    const L = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 2 },
      { x: 2, y: 2 },
      { x: 2, y: 4 },
      { x: 0, y: 4 },
    ];
    const outside = offsetPolyline(L, 0.1, true);
    close(outside[0], { x: -0.1, y: -0.1 });
    close(outside[3], { x: 2.1, y: 2.1 });
    const inside = offsetPolyline(L, -0.1, true);
    close(inside[3], { x: 1.9, y: 1.9 });
    close(inside[1], { x: 3.9, y: 0.1 });
    // Area shrinks by perimeter × d (minus corner terms) — sanity check direction only.
    expect(Math.abs(signedArea(inside))).toBeLessThan(Math.abs(signedArea(L)));
    expect(Math.abs(signedArea(outside))).toBeGreaterThan(Math.abs(signedArea(L)));
  });

  it('clamps hairpin mitres', () => {
    const out = offsetPolyline([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 0.01 }], 0.1);
    expect(Math.hypot(out[1].x - 4, out[1].y)).toBeLessThanOrEqual(0.8 + 1e-9);
  });

  it('zero distance returns a copy', () => {
    const pts = [{ x: 1, y: 2 }, { x: 3, y: 4 }];
    const out = offsetPolyline(pts, 0);
    expect(out).toEqual(pts);
    expect(out[0]).not.toBe(pts[0]);
  });
});

describe('three-point arcs', () => {
  it('the curve passes through the third point at t = 0.5', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 4, y: 0 };
    const p = { x: 1.5, y: -1.2 };
    const c = arcControlThrough(a, b, p);
    close(c, { x: 2 * 1.5 - 2, y: -2.4 });
    close(bezierPoint(a, c, b, 0.5), p);
  });

  it('bulge points sit on the chord normal', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 4, y: 0 };
    const p = bulgePoint(a, b, 0.8);
    close(p, { x: 2, y: -0.8 });
    expect(signedBulge(a, b, p)).toBeCloseTo(0.8, 9);
    expect(signedBulge(a, b, { x: 1, y: 0.5 })).toBeCloseTo(-0.5, 9);
    close(bezierPoint(a, arcControlThrough(a, b, p), b, 0.5), p);
  });
});

describe('face-to-face measuring', () => {
  const project = produce(createEmptyProject(), (d) => {
    addRectangleWalls(d, { x: 0, y: 0 }, { x: 5, y: 3 }, { thickness: 0.2, height: 2.7, role: 'interior' });
  });
  const net = computeWallNetwork(project);

  it('finds the opposite parallel face and the clear distance', () => {
    const top = Object.values(project.walls).find((w) => {
      const a = project.nodes[w.a];
      const b = project.nodes[w.b];
      return a.y === 0 && b.y === 0;
    })!;
    // Inner face of the top wall at y = 0.1.
    const face = wallFaceAt(net, top.id, { x: 2, y: 0.1 })!;
    expect(face).not.toBeNull();
    expect(face.normal.y).toBeCloseTo(1, 9);
    const hit = findOppositeFace(net, face.point, face.normal)!;
    expect(hit.distance).toBeCloseTo(2.8, 6);
    expect(hit.point.y).toBeCloseTo(2.9, 6);
  });

  it('returns null when the first face hit is not parallel', () => {
    const hit = findOppositeFace(net, { x: 2.5, y: 1.5 }, { x: 1, y: 1 });
    expect(hit).toBeNull();
  });

  it('wallFaceAt rejects centreline points', () => {
    const w = Object.values(project.walls)[0];
    const a = project.nodes[w.a];
    const b = project.nodes[w.b];
    expect(wallFaceAt(net, w.id, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })).toBeNull();
  });
});

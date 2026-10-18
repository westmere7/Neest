import type { Project, Vec2 } from '@/domain/model/schema';
import type { DerivedPlan } from '@/domain/geometry/derive';
import { pointInPolygon, rectPolygon } from '@/domain/geometry/polygon';
import { pointInFace } from '@/domain/geometry/rooms';
import { piecePolygon } from '@/domain/geometry/walls';
import { pointAt, projectOnPath } from '@/domain/geometry/wallPath';
import { add, dist, leftNormal, rotate, scale } from '@/domain/geometry/vec';
import type { SelItem } from '@/state/editorStore';

export type Handle =
  | { type: 'node'; nodeId: string }
  /** `mid`: the bend handle of a one-handle curve (on the curve); `a` / `b`: the end handles of a two-handle curve. */
  | { type: 'curve'; wallId: string; end: 'mid' | 'a' | 'b' }
  | { type: 'opening-end'; openingId: string; end: 'start' | 'end' }
  | { type: 'object-rotate'; objectId: string }
  | { type: 'object-resize'; objectId: string; sx: -1 | 0 | 1; sy: -1 | 0 | 1 }
  | { type: 'room-label'; roomId: string };

/** World positions of handles for the current selection. */
export function selectionHandles(project: Project, derived: DerivedPlan, selection: SelItem[], px: number) {
  const out: { handle: Handle; p: Vec2 }[] = [];
  if (selection.length !== 1) {
    // Multi-selection: endpoint handles for selected walls only.
    for (const s of selection) {
      if (s.kind === 'wall') {
        const w = project.walls[s.id];
        if (w && !w.locked) {
          out.push({ handle: { type: 'node', nodeId: w.a }, p: project.nodes[w.a] });
          out.push({ handle: { type: 'node', nodeId: w.b }, p: project.nodes[w.b] });
        }
      }
    }
    return dedupe(out);
  }
  const s = selection[0];
  if (s.kind === 'wall') {
    const w = project.walls[s.id];
    const g = derived.network.walls.get(s.id);
    if (w && g && !w.locked) {
      out.push({ handle: { type: 'node', nodeId: w.a }, p: project.nodes[w.a] });
      out.push({ handle: { type: 'node', nodeId: w.b }, p: project.nodes[w.b] });
      if (w.curve && w.curveEnd) {
        out.push({ handle: { type: 'curve', wallId: w.id, end: 'a' }, p: w.curve });
        out.push({ handle: { type: 'curve', wallId: w.id, end: 'b' }, p: w.curveEnd });
      } else if (w.curve) {
        // The bend handle sits on the curve (its midpoint), where dragging moves it.
        const a = project.nodes[w.a];
        const b = project.nodes[w.b];
        out.push({ handle: { type: 'curve', wallId: w.id, end: 'mid' }, p: { x: (a.x + 2 * w.curve.x + b.x) / 4, y: (a.y + 2 * w.curve.y + b.y) / 4 } });
      }
    }
  } else if (s.kind === 'node') {
    const n = project.nodes[s.id];
    if (n) out.push({ handle: { type: 'node', nodeId: n.id }, p: n });
  } else if (s.kind === 'opening') {
    const o = project.openings[s.id];
    const g = o && derived.network.walls.get(o.wallId);
    const span = g?.spans.find((x) => x.id === o.id);
    if (o && g && span) {
      out.push({ handle: { type: 'opening-end', openingId: o.id, end: 'start' }, p: pointAt(g.path, span.s0).p });
      out.push({ handle: { type: 'opening-end', openingId: o.id, end: 'end' }, p: pointAt(g.path, span.s1).p });
    }
  } else if (s.kind === 'object') {
    const o = project.objects[s.id];
    if (o && !o.locked) {
      const c = { x: o.x, y: o.y };
      for (const sx of [-1, 0, 1] as const) {
        for (const sy of [-1, 0, 1] as const) {
          if (sx === 0 && sy === 0) continue;
          const local = { x: (sx * o.width) / 2, y: (sy * o.depth) / 2 };
          out.push({ handle: { type: 'object-resize', objectId: o.id, sx, sy }, p: add(c, rotate(local, o.rotation)) });
        }
      }
      const rotLocal = { x: 0, y: -o.depth / 2 - 22 * px };
      out.push({ handle: { type: 'object-rotate', objectId: o.id }, p: add(c, rotate(rotLocal, o.rotation)) });
    }
  } else if (s.kind === 'room') {
    const face = derived.roomFaces.get(s.id);
    const r = project.rooms[s.id];
    if (face && r) out.push({ handle: { type: 'room-label', roomId: r.id }, p: add(face.label, r.labelOffset) });
  }
  return out;
}

function dedupe(list: { handle: Handle; p: Vec2 }[]) {
  const seen = new Set<string>();
  return list.filter((h) => {
    const k = JSON.stringify(h.handle);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function hitHandle(
  handles: { handle: Handle; p: Vec2 }[],
  p: Vec2,
  tol: number,
): Handle | null {
  let best: Handle | null = null;
  let bestD = tol;
  for (const h of handles) {
    const d = dist(h.p, p);
    if (d <= bestD) {
      bestD = d;
      best = h.handle;
    }
  }
  return best;
}

export interface HitOptions {
  walls?: boolean;
  openings?: boolean;
  objects?: boolean;
  rooms?: boolean;
}

/**
 * Picks the top-most entity under a point. `tol` is a constant screen
 * distance converted to world units so picking feels the same at any zoom.
 */
export function hitTest(
  project: Project,
  derived: DerivedPlan,
  p: Vec2,
  tol: number,
  opt: HitOptions = { walls: true, openings: true, objects: true, rooms: true },
): SelItem | null {
  const constructionVisible = project.layers.construction.visible;
  // Openings first: they sit on walls and are small.
  if (opt.openings && constructionVisible) {
    for (const g of derived.network.walls.values()) {
      for (const span of g.spans) {
        const proj = projectOnPath(g.path, p);
        if (proj.s >= span.s0 - tol && proj.s <= span.s1 + tol && proj.dist <= g.h + tol) {
          return { kind: 'opening', id: span.id };
        }
      }
    }
  }
  if (opt.objects && project.layers.furniture.visible) {
    // Prefer the smallest/top-most object under the cursor.
    let best: { id: string; area: number; top: number } | null = null;
    for (const o of Object.values(project.objects)) {
      if (o.hidden) continue;
      const poly = rectPolygon(o.x, o.y, o.width + tol * 2, o.depth + tol * 2, o.rotation);
      if (!pointInPolygon(p, poly)) continue;
      const area = o.width * o.depth;
      const top = o.elevation + o.height;
      if (!best || area < best.area || (area === best.area && top > best.top)) best = { id: o.id, area, top };
    }
    if (best) {
      // Walls still win when the cursor is right on a wall and the object is big (e.g. a rug).
      const wallHit = opt.walls && constructionVisible ? hitWall(derived, p, tol) : null;
      const obj = project.objects[best.id];
      if (!wallHit || obj.width * obj.depth < 1.5) return { kind: 'object', id: best.id };
      return wallHit;
    }
  }
  if (opt.walls && constructionVisible) {
    const w = hitWall(derived, p, tol);
    if (w) return w;
  }
  if (opt.rooms) {
    // Smallest containing room (islands inside rooms).
    let best: { id: string; area: number } | null = null;
    derived.faces.forEach((face, i) => {
      const room = derived.faceRooms[i];
      if (!room) return;
      if (pointInFace(p, face) && (!best || face.area < best.area)) best = { id: room.id, area: face.area };
    });
    if (best) return { kind: 'room', id: (best as { id: string }).id };
  }
  return null;
}

function hitWall(derived: DerivedPlan, p: Vec2, tol: number): SelItem | null {
  let best: { id: string; d: number } | null = null;
  for (const g of derived.network.walls.values()) {
    if (g.wall.hidden) continue;
    const inside = g.pieces.some((pc) => pointInPolygon(p, piecePolygon(pc)));
    const proj = projectOnPath(g.path, p);
    const d = inside ? 0 : Math.max(0, proj.dist - g.h);
    if (d <= tol && (!best || d < best.d)) best = { id: g.wall.id, d };
  }
  return best ? { kind: 'wall', id: best.id } : null;
}

/** Entities fully inside a marquee rectangle. */
export function marqueeSelect(project: Project, derived: DerivedPlan, a: Vec2, b: Vec2): SelItem[] {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  const inside = (q: Vec2) => q.x >= minX && q.x <= maxX && q.y >= minY && q.y <= maxY;
  const out: SelItem[] = [];
  if (project.layers.construction.visible) {
    for (const g of derived.network.walls.values()) {
      if (!g.wall.locked && !project.layers.construction.locked && inside(g.path.a) && inside(g.path.b))
        out.push({ kind: 'wall', id: g.wall.id });
    }
    for (const g of derived.network.walls.values()) {
      for (const sp of g.spans) {
        const c = pointAt(g.path, sp.center).p;
        if (inside(c) && !out.some((x) => x.id === g.wall.id)) out.push({ kind: 'opening', id: sp.id });
      }
    }
  }
  if (project.layers.furniture.visible && !project.layers.furniture.locked) {
    for (const o of Object.values(project.objects)) {
      if (o.hidden || o.locked) continue;
      if (rectPolygon(o.x, o.y, o.width, o.depth, o.rotation).every(inside)) out.push({ kind: 'object', id: o.id });
    }
  }
  return out;
}

/** Point on a wall face at arc length s, for placing things against walls. */
export function wallFacePoint(derived: DerivedPlan, wallId: string, s: number, side: 1 | -1) {
  const g = derived.network.walls.get(wallId);
  if (!g) return null;
  const { p, tangent } = pointAt(g.path, s);
  const n = leftNormal(tangent);
  return { point: add(p, scale(n, side * g.h)), normal: scale(n, side), tangent };
}

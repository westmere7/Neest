import type { Project } from '../model/schema';
import type { RoomFace } from '../geometry/rooms';
import type { WallNetwork } from '../geometry/walls';
import { segmentIntersection } from '../geometry/vec';

export type DiagnosticLevel = 'warning' | 'error';

export interface Diagnostic {
  id: string;
  level: DiagnosticLevel;
  message: string;
  /** Plain-language suggestion for resolving the issue. */
  hint?: string;
  entityIds: string[];
}

/** Geometry/topology health checks that are surfaced in the UI instead of silently "fixing" the plan. */
export function computeDiagnostics(project: Project, network: WallNetwork, faces: RoomFace[]): Diagnostic[] {
  const out: Diagnostic[] = [];
  const walls = Object.values(project.walls);

  for (const w of walls) {
    if (!project.nodes[w.a] || !project.nodes[w.b]) {
      out.push({
        id: `missing-node:${w.id}`,
        level: 'error',
        message: 'A wall references a missing endpoint.',
        hint: 'Delete the wall and redraw it.',
        entityIds: [w.id],
      });
    } else if (!network.walls.has(w.id)) {
      out.push({
        id: `zero-wall:${w.id}`,
        level: 'warning',
        message: 'A wall has zero length.',
        hint: 'Delete it or drag one endpoint away.',
        entityIds: [w.id],
      });
    }
  }

  // Crossing walls without a shared junction break room detection.
  const segs = [...network.walls.values()].map((g) => {
    const pts = g.path.samples.map((s) => s.p);
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    return {
      id: g.wall.id,
      a: g.wall.a,
      b: g.wall.b,
      pts,
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
    };
  });
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const s = segs[i];
      const t = segs[j];
      if (s.maxX < t.minX || t.maxX < s.minX || s.maxY < t.minY || t.maxY < s.minY) continue;
      const shared = [s.a, s.b].filter((n) => n === t.a || n === t.b);
      let crossing = false;
      for (let a = 0; a < s.pts.length - 1 && !crossing; a++) {
        for (let b = 0; b < t.pts.length - 1 && !crossing; b++) {
          const hit = segmentIntersection(s.pts[a], s.pts[a + 1], t.pts[b], t.pts[b + 1]);
          if (!hit) continue;
          const atEndS = (a === 0 && hit.t < 1e-4) || (a === s.pts.length - 2 && hit.t > 1 - 1e-4);
          const atEndT = (b === 0 && hit.u < 1e-4) || (b === t.pts.length - 2 && hit.u > 1 - 1e-4);
          if (atEndS && atEndT && shared.length > 0) continue;
          if (atEndS || atEndT) {
            // An endpoint touching the middle of another wall without a junction.
            if (!(atEndS && atEndT)) crossing = true;
          } else crossing = true;
        }
      }
      if (crossing) {
        out.push({
          id: `cross:${s.id}:${t.id}`,
          level: 'warning',
          message: 'Two walls cross or touch without a junction, so rooms around them may not be detected.',
          hint: 'Use the Split tool at the crossing, or drag an endpoint onto the other wall to join them.',
          entityIds: [s.id, t.id],
        });
      }
    }
  }

  for (const g of network.walls.values()) {
    for (const sp of g.spans) {
      if (sp.clamped) {
        const o = project.openings[sp.id];
        out.push({
          id: `clamped:${sp.id}`,
          level: 'warning',
          message: `${o?.kind.startsWith('window') ? 'A window' : 'A door'} does not fit its wall position and is shown clamped.`,
          hint: 'Move it along the wall or reduce its width.',
          entityIds: [sp.id],
        });
      }
    }
    for (let i = 0; i < g.spans.length - 1; i++) {
      if (g.spans[i].s1 > g.spans[i + 1].s0 + 1e-4) {
        out.push({
          id: `overlap:${g.spans[i].id}:${g.spans[i + 1].id}`,
          level: 'warning',
          message: 'Two openings overlap on the same wall.',
          hint: 'Move one of them along the wall.',
          entityIds: [g.spans[i].id, g.spans[i + 1].id],
        });
      }
    }
  }

  for (const o of Object.values(project.openings)) {
    if (!project.walls[o.wallId]) {
      out.push({
        id: `orphan-opening:${o.id}`,
        level: 'error',
        message: 'An opening references a wall that no longer exists.',
        hint: 'Delete the opening.',
        entityIds: [o.id],
      });
    }
  }

  for (const f of faces) {
    if (f.degraded) {
      out.push({
        id: `degraded:${f.key}`,
        level: 'warning',
        message: 'A room outline is too narrow or irregular to compute its clear floor area; centreline area is shown.',
        hint: 'Check for very short walls or overlapping walls around this room.',
        entityIds: f.wallIds,
      });
    }
  }
  return out;
}

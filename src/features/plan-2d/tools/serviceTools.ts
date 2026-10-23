import type { Vec2 } from '@/domain/model/schema';
import { SERVICE_HOST_LABELS, SERVICE_POINTS, SERVICE_SYSTEM_INFO, type ServiceHost, type ServiceSystem } from '@/domain/model/services';
import { itemPort, placeServicePoint, pointNear, servicePointAt, serviceItems, wallCentreAt } from '@/domain/geometry/services';
import { addServicePoint, addServiceRun } from '@/domain/commands/services';
import { dist } from '@/domain/geometry/vec';
import { formatLength } from '@/domain/model/units';
import { neededSystems } from '@/domain/model/services';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore } from '@/state/editorStore';
import { needsOfProject } from '@/features/services/needs';
import type { PointerInfo, Tool, ToolEnv, ToolOverlay } from './types';

/** Snap distance to points and item ports, in screen px. */
const SNAP_PX = 14;

const fmt = (env: ToolEnv, m: number) => {
  const s = env.project().settings;
  return formatLength(m, s.units, s.precision);
};

/**
 * Services point tool: click to place the point kind chosen in the Services panel. Wall kinds snap
 * into the nearest wall face (sockets and water points fall back to the floor away from walls),
 * drainage goes in the floor only. Stays armed for the next point; Esc goes back to Select.
 */
export function createServicePointTool(): Tool {
  const placement = (e: PointerInfo, env: ToolEnv) => {
    const ed = env.editor();
    const kind = ed.serviceKind;
    const hosts = SERVICE_POINTS[kind].hosts;
    const host = ed.serviceHost && hosts.includes(ed.serviceHost) ? ed.serviceHost : undefined;
    // Away from walls the pointer snaps to the grid like everything else.
    const free = e.alt ? e.world : env.snap(e.world).point;
    const wallFirst = (host ?? hosts[0]) === 'wall';
    return placeServicePoint(env.derived(), kind, wallFirst ? e.world : free, host);
  };
  return {
    id: 'service',
    cursor: 'crosshair',
    hint: 'Click to place the point. Wall points go in the nearest wall; drains go in the floor. Esc to finish.',
    onPointerMove(e, env) {
      const pl = placement(e, env);
      const kind = env.editor().serviceKind;
      env.setSnapLabel(pl.valid ? SERVICE_HOST_LABELS[pl.host] : null);
      env.setHint(pl.valid ? `${SERVICE_POINTS[kind].name}: click to place · Esc to finish.` : (pl.reason ?? null));
      env.setOverlay({ ghostService: { kind, host: pl.host, x: pl.x, y: pl.y, rotation: pl.rotation, valid: pl.valid } });
    },
    onPointerDown(e, env) {
      if (e.button !== 0) return;
      const pl = placement(e, env);
      const ed = env.editor();
      const info = SERVICE_POINTS[ed.serviceKind];
      if (!pl.valid) {
        env.setHint(pl.reason ?? 'Can’t place this here');
        return;
      }
      const id = useProjectStore.getState().execute(`Add ${info.name.toLowerCase()}`, (d) =>
        addServicePoint(d, { kind: ed.serviceKind, x: pl.x, y: pl.y, host: pl.host, wallId: pl.wallId, height: info.height, rotation: pl.rotation }),
      );
      if (id) useEditorStore.getState().setSelection([{ kind: 'service', id }]);
    },
    cancel(env) {
      env.setOverlay(null);
      return false;
    },
  };
}

interface RunSnap {
  p: Vec2;
  label: string | null;
  /** Snapped onto a point or an item of the system: a click there ends the run. */
  end: boolean;
}

/**
 * Services run tool: click the bends of wiring or a pipe; it snaps to points and items of its
 * system (clicking one after the first bend ends the run), to wall centre lines for runs in walls,
 * and to the grid. Double-click or Enter ends it, Backspace takes back a bend, Esc cancels.
 */
export function createRunTool(): Tool {
  let pts: Vec2[] = [];
  let last: Vec2 | null = null;

  const settings = (env: ToolEnv): { system: ServiceSystem; level: ServiceHost; hot: boolean; height: number } => {
    const ed = env.editor();
    const levels = SERVICE_SYSTEM_INFO[ed.runSystem].levels;
    return { system: ed.runSystem, level: levels.includes(ed.runLevel) ? ed.runLevel : levels[0], hot: ed.runSystem === 'water' && ed.runHot, height: ed.runHeight };
  };

  const snapRun = (e: PointerInfo, env: ToolEnv): RunSnap => {
    const project = env.project();
    const derived = env.derived();
    const { system, level } = settings(env);
    const tol = SNAP_PX * env.px();
    const pt = pointNear(project, derived, e.world, system, tol);
    if (pt) return { p: servicePointAt(derived, pt), label: SERVICE_POINTS[pt.kind].name, end: true };
    // Items that need this system: snap to the point of their outline nearest the pointer.
    for (const { o, needs } of serviceItems(project, needsOfProject(project))) {
      if (!neededSystems(needs).includes(system)) continue;
      const port = itemPort(o, e.world);
      if (dist(port, e.world) <= tol) return { p: port, label: o.name ?? 'Item', end: true };
    }
    const anchor = pts.length ? pts[pts.length - 1] : null;
    const r = env.snap(e.world, { anchor, forceAngle: e.shift });
    let p = r.point;
    let label = r.label || null;
    if (level === 'wall') {
      const c = wallCentreAt(derived, p, tol);
      if (c) {
        p = c.p;
        label = 'In wall';
      }
    }
    return { p, label, end: false };
  };

  const overlay = (env: ToolEnv, cur: Vec2 | null): ToolOverlay => {
    const s = settings(env);
    const points = cur ? [...pts, cur] : pts;
    let len = 0;
    for (let i = 1; i < points.length; i++) len += dist(points[i - 1], points[i]);
    return {
      runPreview: points.length ? { points, system: s.system, hot: s.hot, level: s.level } : null,
      labels: cur && pts.length ? [{ p: cur, text: fmt(env, len) }] : undefined,
      snap: cur ? { p: cur, kind: 'guide', label: '' } : null,
    };
  };

  const finish = (env: ToolEnv) => {
    const clean = pts.filter((p, i) => i === 0 || dist(p, pts[i - 1]) > 0.01);
    pts = [];
    env.setOverlay(null);
    if (clean.length < 2) return;
    const s = settings(env);
    const id = useProjectStore.getState().execute(`Add ${SERVICE_SYSTEM_INFO[s.system].run.toLowerCase()}`, (d) =>
      addServiceRun(d, { system: s.system, level: s.level, hot: s.hot, height: s.height, points: clean }),
    );
    if (id) useEditorStore.getState().setSelection([{ kind: 'run', id }]);
  };

  return {
    id: 'run',
    cursor: 'crosshair',
    hint: 'Click to start the run and at each bend. Click a point or an item to end it, or double-click / Enter. Backspace undoes a bend, Esc cancels.',
    busy: () => pts.length > 0,
    onPointerMove(e, env) {
      const s = snapRun(e, env);
      last = s.p;
      env.setSnapLabel(s.label);
      env.setOverlay(overlay(env, s.p));
    },
    onPointerDown(e, env) {
      if (e.button !== 0) return;
      const s = snapRun(e, env);
      if (pts.length && dist(pts[pts.length - 1], s.p) < 0.01) return;
      pts.push(s.p);
      if (s.end && pts.length >= 2) finish(env);
      else env.setOverlay(overlay(env, s.p));
    },
    onDoubleClick(_e, env) {
      finish(env);
    },
    onKeyDown(e, env) {
      if (e.key === 'Enter' && pts.length) {
        finish(env);
        return true;
      }
      if (e.key === 'Backspace' && pts.length) {
        pts.pop();
        env.setOverlay(overlay(env, last));
        return true;
      }
      return false;
    },
    cancel(env) {
      if (!pts.length) return false;
      pts = [];
      env.setOverlay(null);
      return true;
    },
  };
}

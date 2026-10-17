import type { Vec2 } from '@/domain/model/schema';
import { addRectangleWalls, addWallChain, splitWallAt } from '@/domain/commands/walls';
import { bezierPoint, buildWallPath, pointAt, projectOnPath } from '@/domain/geometry/wallPath';
import { add, angleOf, dist, leftNormal, normalize, scale, sub } from '@/domain/geometry/vec';
import { formatAngle, formatLength, parseLength } from '@/domain/model/units';
import { newId } from '@/domain/model/ids';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore } from '@/state/editorStore';
import { toast } from '@/state/uiStores';
import type { Tool, ToolEnv, ToolOverlay } from './types';

/** Typed numeric entry while drawing (e.g. type 3.5 then Enter for an exact length). */
export class NumericEntry {
  value = '';
  get active() {
    return this.value.length > 0;
  }
  /** Returns true when the key was consumed. */
  key(e: KeyboardEvent, allowX = false): boolean {
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    if (/^[0-9.,'"]$/.test(e.key) || (this.value && /^[a-z ]$/i.test(e.key) && (allowX || e.key.toLowerCase() !== 'x'))) {
      this.value += e.key;
      return true;
    }
    if (allowX && this.value && e.key.toLowerCase() === 'x') {
      this.value += 'x';
      return true;
    }
    if (e.key === 'Backspace' && this.value) {
      this.value = this.value.slice(0, -1);
      return true;
    }
    return false;
  }
  clear() {
    this.value = '';
  }
}

export function wallPreviewPolygon(a: Vec2, b: Vec2, thickness: number): Vec2[] {
  const d = normalize(sub(b, a));
  const n = scale(leftNormal(d), thickness / 2);
  return [add(a, n), add(b, n), sub(b, n), sub(a, n)];
}

function drawingWallOptions() {
  const p = useProjectStore.getState().project!;
  const ed = useEditorStore.getState();
  const role = ed.wallRole;
  const thickness =
    ed.wallThickness ??
    (role === 'exterior' ? p.settings.exteriorThickness : role === 'partition' ? Math.min(0.08, p.settings.defaultWall.thickness) : p.settings.defaultWall.thickness);
  return { thickness, height: p.settings.defaultWall.height, role };
}

const fmt = (env: ToolEnv, m: number) => {
  const s = env.project().settings;
  return formatLength(m, s.units, s.precision);
};

// ───────────────────────── Straight wall chain ─────────────────────────

export function createWallTool(): Tool {
  let last: Vec2 | null = null;
  let start: Vec2 | null = null;
  let cursor: Vec2 | null = null;
  let segments = 0;
  const numeric = new NumericEntry();

  const reset = () => {
    last = null;
    start = null;
    cursor = null;
    segments = 0;
    numeric.clear();
  };

  const render = (env: ToolEnv, snapRes?: ReturnType<ToolEnv['snap']>) => {
    const o: ToolOverlay = { snap: snapRes && snapRes.kind !== 'none' ? { p: snapRes.point, kind: snapRes.kind, label: snapRes.label } : null };
    if (last && cursor && dist(last, cursor) > 1e-4) {
      const { thickness } = drawingWallOptions();
      o.wallPreviews = [wallPreviewPolygon(last, cursor, thickness)];
      o.lines = [{ a: last, b: cursor, kind: 'preview' }, ...(snapRes?.guides ?? []).map((g) => ({ ...g, kind: 'guide' as const }))];
      const L = dist(last, cursor);
      o.dims = [{ a: last, b: cursor, offset: thickness / 2 + 14 * env.px(), text: fmt(env, L) }];
      o.labels = [{ p: cursor, text: formatAngle(-angleOf(sub(cursor, last))), offset: { x: 14, y: 22 } }];
    } else if (snapRes) {
      o.lines = snapRes.guides.map((g) => ({ ...g, kind: 'guide' as const }));
    }
    if (numeric.active && cursor) o.numeric = { label: 'Length', value: numeric.value, p: cursor };
    env.setOverlay(o);
  };

  const addSegment = (env: ToolEnv, to: Vec2) => {
    if (!last) return;
    const from = last;
    const opts = drawingWallOptions();
    const created = useProjectStore.getState().execute('Draw wall', (d) => addWallChain(d, [from, to], opts));
    if (created && created.length) segments++;
    last = to;
    if (start && dist(to, start) < 1e-6 && segments > 0) {
      env.setHint('Room closed. Click to start another wall, or press Esc.');
      reset();
    }
  };

  return {
    id: 'wall',
    cursor: 'crosshair',
    hint: 'Click to start a wall, click again to add segments. Type a length + Enter for exact values. Double-click or Enter to finish.',
    busy: () => last !== null,
    onPointerMove(e, env) {
      const r = env.snap(e.world, { anchor: last, forceAngle: e.shift, extraPoints: start ? [start] : [] });
      cursor = r.point;
      env.setSnapLabel(r.label || null);
      render(env, r);
    },
    onPointerDown(e, env) {
      if (e.button !== 0) return;
      const r = env.snap(e.world, { anchor: last, forceAngle: e.shift, extraPoints: start ? [start] : [] });
      const p = r.point;
      numeric.clear();
      if (!last) {
        last = p;
        start = p;
        segments = 0;
        env.setHint('Click to place the next corner. Click the start point to close. Enter finishes, Esc cancels.');
      } else if (dist(p, last) > 0.01) {
        addSegment(env, p);
      }
      render(env, r);
    },
    onDoubleClick(_e, env) {
      reset();
      env.setOverlay(null);
      env.setHint('Wall chain finished.');
    },
    onKeyDown(e, env) {
      if (last && numeric.key(e)) {
        render(env);
        return true;
      }
      if (e.key === 'Enter') {
        if (numeric.active && last && cursor) {
          const len = parseLength(numeric.value, env.project().settings.units);
          numeric.clear();
          if (len == null || len < 0.02 || len > 200) {
            toast.warning('Invalid length', 'Enter a positive length, e.g. 3.5, 350cm or 11\'6".');
            return true;
          }
          const dir = dist(cursor, last) > 1e-6 ? normalize(sub(cursor, last)) : { x: 1, y: 0 };
          addSegment(env, add(last, scale(dir, len)));
          cursor = last;
          render(env);
          return true;
        }
        reset();
        env.setOverlay(null);
        return true;
      }
      if (e.key === 'Backspace' && last && segments > 0) {
        useProjectStore.getState().undo();
        segments--;
        return true;
      }
      return false;
    },
    cancel(env) {
      const was = last !== null;
      reset();
      env.setOverlay(null);
      return was;
    },
  };
}

// ───────────────────────── Curved wall ─────────────────────────

export function createCurveTool(): Tool {
  let a: Vec2 | null = null;
  let b: Vec2 | null = null;
  let control: Vec2 | null = null;
  const reset = () => {
    a = null;
    b = null;
    control = null;
  };
  const render = (env: ToolEnv, cur: Vec2, snapRes?: ReturnType<ToolEnv['snap']>) => {
    const o: ToolOverlay = { snap: snapRes && snapRes.kind !== 'none' ? { p: snapRes.point, kind: snapRes.kind, label: snapRes.label } : null };
    const { thickness } = drawingWallOptions();
    if (a && !b) {
      o.wallPreviews = [wallPreviewPolygon(a, cur, thickness)];
      o.dims = [{ a, b: cur, offset: thickness / 2 + 14 * env.px(), text: fmt(env, dist(a, cur)) }];
    } else if (a && b) {
      const c = control ?? cur;
      const path = buildWallPath(a, b, c);
      const left = path.samples.map((s) => add(s.p, scale(leftNormal(s.tangent), thickness / 2)));
      const right = path.samples.map((s) => add(s.p, scale(leftNormal(s.tangent), -thickness / 2)));
      o.wallPreviews = [[...left, ...right.reverse()]];
      o.curveHandle = { a, b, c, mid: bezierPoint(a, c, b, 0.5) };
      o.labels = [{ p: cur, text: `Arc ${fmt(env, path.length)}`, offset: { x: 14, y: 22 } }];
    }
    env.setOverlay(o);
  };
  return {
    id: 'curve',
    cursor: 'crosshair',
    hint: 'Curved wall: click the start point, click the end point, then move to bend and click to place.',
    busy: () => a !== null,
    onPointerMove(e, env) {
      if (a && b) {
        // The curve passes through the cursor at its midpoint.
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        control = { x: 2 * e.world.x - mid.x, y: 2 * e.world.y - mid.y };
        render(env, e.world);
        return;
      }
      const r = env.snap(e.world, { anchor: a, forceAngle: e.shift });
      env.setSnapLabel(r.label || null);
      render(env, r.point, r);
    },
    onPointerDown(e, env) {
      if (e.button !== 0) return;
      if (a && b && control) {
        const opts = drawingWallOptions();
        const from = a;
        const to = b;
        const c = control;
        useProjectStore.getState().execute('Draw curved wall', (d) => addWallChain(d, [from, to], { ...opts, curves: [c] }));
        reset();
        env.setOverlay(null);
        env.setHint('Curved wall added. Select it to adjust the curve handle.');
        return;
      }
      const r = env.snap(e.world, { anchor: a, forceAngle: e.shift });
      if (!a) {
        a = r.point;
        env.setHint('Click the end point of the curved wall.');
      } else if (dist(a, r.point) > 0.05) {
        b = r.point;
        env.setHint('Move the pointer to bend the wall, then click to place it.');
      }
    },
    cancel(env) {
      const was = a !== null;
      reset();
      env.setOverlay(null);
      return was;
    },
  };
}

// ───────────────────────── Rectangle room ─────────────────────────

export function createRoomTool(): Tool {
  let p0: Vec2 | null = null;
  let p1: Vec2 | null = null;
  let dragging = false;
  let downScreen: Vec2 | null = null;
  const numeric = new NumericEntry();
  const reset = () => {
    p0 = null;
    p1 = null;
    dragging = false;
    downScreen = null;
    numeric.clear();
  };
  const render = (env: ToolEnv, snapRes?: ReturnType<ToolEnv['snap']>) => {
    const o: ToolOverlay = { snap: snapRes && snapRes.kind !== 'none' ? { p: snapRes.point, kind: snapRes.kind, label: snapRes.label } : null };
    if (p0 && p1) {
      const { thickness } = drawingWallOptions();
      const c = [p0, { x: p1.x, y: p0.y }, p1, { x: p0.x, y: p1.y }];
      o.wallPreviews = c.map((pt, i) => wallPreviewPolygon(pt, c[(i + 1) % 4], thickness));
      const x0 = Math.min(p0.x, p1.x);
      const x1 = Math.max(p0.x, p1.x);
      const y0 = Math.min(p0.y, p1.y);
      const y1 = Math.max(p0.y, p1.y);
      const off = thickness / 2 + 16 * env.px();
      o.dims = [
        { a: { x: x0, y: y0 }, b: { x: x1, y: y0 }, offset: off, text: fmt(env, x1 - x0) },
        { a: { x: x0, y: y1 }, b: { x: x0, y: y0 }, offset: off, text: fmt(env, y1 - y0) },
      ];
    }
    if (numeric.active && (p1 ?? p0)) o.numeric = { label: 'Size (W x D)', value: numeric.value, p: (p1 ?? p0)! };
    env.setOverlay(o);
  };
  const create = (env: ToolEnv) => {
    if (!p0 || !p1) return;
    if (Math.abs(p1.x - p0.x) < 0.2 || Math.abs(p1.y - p0.y) < 0.2) {
      env.setHint('Rooms must be at least 20 cm on each side.');
      return;
    }
    const a = p0;
    const b = p1;
    const opts = drawingWallOptions();
    useProjectStore.getState().execute('Draw room', (d) => addRectangleWalls(d, a, b, opts));
    reset();
    env.setOverlay(null);
  };
  return {
    id: 'room',
    cursor: 'crosshair',
    hint: 'Drag (or click two corners) to draw a rectangular room. Type W x D (e.g. 4x3) for exact sizes.',
    busy: () => p0 !== null,
    onPointerDown(e, env) {
      if (e.button !== 0) return;
      const r = env.snap(e.world);
      if (!p0) {
        p0 = r.point;
        p1 = r.point;
        dragging = true;
        downScreen = e.screen;
      } else {
        p1 = r.point;
        create(env);
      }
    },
    onPointerMove(e, env) {
      const r = env.snap(e.world);
      env.setSnapLabel(r.label || null);
      if (p0) p1 = r.point;
      render(env, r);
    },
    onPointerUp(e, env) {
      if (!dragging || !p0) return;
      dragging = false;
      if (downScreen && dist(downScreen, e.screen) > 6) create(env);
      else env.setHint('Click the opposite corner (or type W x D and press Enter).');
    },
    onKeyDown(e, env) {
      if (p0 && numeric.key(e, true)) {
        render(env);
        return true;
      }
      if (e.key === 'Enter' && numeric.active && p0) {
        const parts = numeric.value.split(/x/i);
        const units = env.project().settings.units;
        const w = parseLength(parts[0] ?? '', units);
        const h = parseLength(parts[1] ?? parts[0] ?? '', units);
        numeric.clear();
        if (w == null || h == null || w < 0.2 || h < 0.2) {
          toast.warning('Invalid size', 'Type width x depth, e.g. 4x3 or 400cm x 300cm.');
          return true;
        }
        const sx = p1 && p1.x < p0.x ? -1 : 1;
        const sy = p1 && p1.y < p0.y ? -1 : 1;
        p1 = { x: p0.x + sx * w, y: p0.y + sy * h };
        create(env);
        return true;
      }
      return false;
    },
    cancel(env) {
      const was = p0 !== null;
      reset();
      env.setOverlay(null);
      return was;
    },
  };
}

// ───────────────────────── Split ─────────────────────────

export function createSplitTool(): Tool {
  let target: { wallId: string; s: number } | null = null;
  return {
    id: 'split',
    cursor: 'crosshair',
    hint: 'Click a wall to split it at that point. Neighbouring walls are not moved.',
    onPointerMove(e, env) {
      const r = env.snap(e.world, { settings: { ...env.editor().snap, grid: false, guides: false, angle: false } });
      const derived = env.derived();
      let best: { wallId: string; s: number; d: number } | null = null;
      for (const g of derived.network.walls.values()) {
        if (g.wall.locked) continue;
        const proj = projectOnPath(g.path, r.point);
        if (proj.dist <= g.h + env.tol() && (!best || proj.dist < best.d)) best = { wallId: g.wall.id, s: proj.s, d: proj.dist };
      }
      target = best ? { wallId: best.wallId, s: best.s } : null;
      if (target) {
        const g = derived.network.walls.get(target.wallId)!;
        const { p, tangent } = pointAt(g.path, target.s);
        const n = scale(leftNormal(tangent), g.h + 6 * env.px());
        env.setOverlay({
          splitMarker: { a: add(p, n), b: sub(p, n) },
          labels: [
            { p, text: `${fmt(env, target.s)} | ${fmt(env, g.path.length - target.s)}`, offset: { x: 14, y: 22 } },
          ],
          snap: r.kind === 'midpoint' ? { p: r.point, kind: r.kind, label: r.label } : null,
        });
      } else env.setOverlay(null);
    },
    onPointerDown(e, env) {
      if (e.button !== 0 || !target) return;
      const t = target;
      const before = Object.keys(env.project().walls).length;
      useProjectStore.getState().execute('Split wall', (d) => {
        splitWallAt(d, t.wallId, t.s);
      });
      if (Object.keys(env.project().walls).length === before) env.setHint('Cannot split exactly at a wall end.');
      else env.setHint('Wall split. Both parts keep their properties and attached openings.');
    },
    cancel(env) {
      env.setOverlay(null);
      return false;
    },
  };
}

// ───────────────────────── Measure ─────────────────────────

export function createMeasureTool(): Tool {
  let a: Vec2 | null = null;
  return {
    id: 'measure',
    cursor: 'crosshair',
    hint: 'Click two points to measure. Measurements stay until you press Esc twice or leave the tool.',
    busy: () => a !== null,
    onPointerMove(e, env) {
      const r = env.snap(e.world, { anchor: a, forceAngle: e.shift, edges: true });
      env.setSnapLabel(r.label || null);
      const o: ToolOverlay = { snap: r.kind !== 'none' ? { p: r.point, kind: r.kind, label: r.label } : null };
      if (a && dist(a, r.point) > 1e-4) {
        o.dims = [{ a, b: r.point, offset: 0.0001, text: fmt(env, dist(a, r.point)) }];
        o.lines = [{ a, b: r.point, kind: 'preview' }];
      }
      env.setOverlay(o);
    },
    onPointerDown(e, env) {
      if (e.button !== 0) return;
      const r = env.snap(e.world, { anchor: a, forceAngle: e.shift, edges: true });
      if (!a) a = r.point;
      else {
        const m = { id: newId('m'), a, b: r.point };
        useEditorStore.setState((s) => ({ measurements: [...s.measurements, m] }));
        a = null;
      }
    },
    cancel(env) {
      if (a) {
        a = null;
        env.setOverlay(null);
        return true;
      }
      if (useEditorStore.getState().measurements.length) {
        useEditorStore.setState({ measurements: [] });
        return true;
      }
      return false;
    },
  };
}


import type { Vec2 } from '@/domain/model/schema';
import { addRectangleWalls, addWallChain, defaultWallMaterials, findNodeNear, setNodePositions, splitWallAt, type D, type WallOptions } from '@/domain/commands/walls';
import { WALL_PRESETS_BY_ID } from '@/domain/model/wallPresets';
import { nodeDegreeOf } from '@/domain/commands/wallTools';
import { bezierPoint, buildWallPath, pointAt, projectOnPath } from '@/domain/geometry/wallPath';
import { arcControlThrough, bulgePoint, findOppositeFace, offsetPolyline, signedBulge, wallFaceAt } from '@/domain/geometry/drafting';
import type { SnapResult } from '@/domain/geometry/snapping';
import { add, angleOf, dist, leftNormal, normalize, scale, sub } from '@/domain/geometry/vec';
import { formatAngle, formatLength, parseLength } from '@/domain/model/units';
import { newId } from '@/domain/model/ids';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore, type WallReference } from '@/state/editorStore';
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

/**
 * Options for newly drawn walls (wall, curve and room tools, in 2D and 3D): the active wall preset
 * when one is chosen (its role, thickness, height, style and finishes; a typed thickness still wins),
 * otherwise the role-based defaults.
 */
export function drawingWallOptions(): WallOptions {
  const p = useProjectStore.getState().project!;
  const ed = useEditorStore.getState();
  const preset = ed.wallPreset ? WALL_PRESETS_BY_ID[ed.wallPreset] : undefined;
  if (preset) {
    const role = preset.role;
    return {
      role,
      thickness: ed.wallThickness ?? preset.thickness,
      height: preset.height ?? p.settings.defaultWall.height,
      style: preset.style,
      styleMaterialId: preset.styleMaterialId,
      // Plain copies so drawn walls never share the preset's objects.
      finishes: preset.finishes ? (JSON.parse(JSON.stringify(preset.finishes)) as WallOptions['finishes']) : undefined,
      materials: { ...defaultWallMaterials(role), ...preset.materials },
    };
  }
  const role = ed.wallRole;
  const thickness =
    ed.wallThickness ??
    (role === 'exterior' ? p.settings.exteriorThickness : role === 'partition' ? Math.min(0.08, p.settings.defaultWall.thickness) : p.settings.defaultWall.thickness);
  return { thickness, height: p.settings.defaultWall.height, role };
}

/**
 * Signed offset from the drawn line to the wall centreline. With a face
 * reference the clicked points are that face, so the centre lies half a
 * thickness to the other side (positive = left of the drawing direction).
 */
export function referenceOffset(reference: WallReference, thickness: number): number {
  if (reference === 'left') return -thickness / 2;
  if (reference === 'right') return thickness / 2;
  return 0;
}

const fmt = (env: ToolEnv, m: number) => {
  const s = env.project().settings;
  return formatLength(m, s.units, s.precision);
};

const snapMark = (r?: SnapResult) => (r && r.kind !== 'none' ? { p: r.point, kind: r.kind, label: r.label } : null);

/** Wall tool hint for a wall reference ("left" = left of the drawing direction). */
export function wallDrawHint(ref: WallReference): string {
  if (ref === 'center')
    return 'Click to start a wall, click again to add segments. Type a length + Enter for exact values. Double-click or Enter to finish.';
  return `Drawing by the ${ref} face: the clicked points are the face on your ${ref} as you walk from click to click; the wall is built to the ${ref === 'left' ? 'right' : 'left'}. Type a length + Enter for exact values. Double-click or Enter to finish.`;
}

/** Room tool hint for a wall reference (the rectangle is walked clockwise, so "left" is its outside). */
export function roomDrawHint(ref: WallReference): string {
  const base = 'Drag (or click two corners) to draw a rectangular room. Type W x D (e.g. 4x3) for exact sizes.';
  if (ref === 'left') return `${base} The rectangle is the walls' outer face.`;
  if (ref === 'right') return `${base} The rectangle is the walls' inner face (clear room size).`;
  return base;
}

/** Moves a node the drawing tool created, but only while it is still a free end (never drags other walls). */
function moveFreeNode(d: D, nodeId: string | null, p: Vec2) {
  if (!nodeId || !d.nodes[nodeId] || nodeDegreeOf(d, nodeId) !== 1) return;
  if (dist(d.nodes[nodeId], p) < 1e-9) return;
  setNodePositions(d, { [nodeId]: p });
}

// ───────────────────────── Straight wall chain ─────────────────────────

export function createWallTool(): Tool {
  /** Clicked points (the wall face when drawing by face, else the centreline). */
  let pts: Vec2[] = [];
  /** Centreline node created at each clicked point (index-aligned with pts). */
  let nodes: (string | null)[] = [];
  /** Whether adding the segment ending at pts[i] created an undo step (index-aligned with pts). */
  let committed: boolean[] = [];
  let cursor: Vec2 | null = null;
  /** Centre offset locked when the chain starts. */
  let off = 0;
  const numeric = new NumericEntry();

  const last = () => (pts.length ? pts[pts.length - 1] : null);
  const start = () => (pts.length ? pts[0] : null);

  const reset = () => {
    pts = [];
    nodes = [];
    committed = [];
    cursor = null;
    off = 0;
    numeric.clear();
  };

  /** Centreline for the chain plus `next`, and whether it closes onto the start. */
  const centreline = (next: Vec2) => {
    const s = start();
    const closing = !!s && pts.length >= 3 && dist(next, s) < 1e-6;
    if (off === 0) return { centre: closing ? [...pts] : [...pts, next], closing };
    return closing ? { centre: offsetPolyline(pts, off, true), closing } : { centre: offsetPolyline([...pts, next], off, false), closing };
  };

  const render = (env: ToolEnv, snapRes?: SnapResult) => {
    const o: ToolOverlay = { snap: snapMark(snapRes) };
    const from = last();
    if (from && cursor && dist(from, cursor) > 1e-4) {
      const { thickness } = drawingWallOptions();
      const { centre, closing } = centreline(cursor);
      const k = pts.length;
      const segs: [Vec2, Vec2][] = [];
      if (closing) {
        segs.push([centre[k - 1], centre[0]]);
        if (off !== 0) segs.push([centre[k - 2], centre[k - 1]], [centre[0], centre[1]]);
      } else {
        segs.push([centre[k - 1], centre[k]]);
        if (off !== 0 && k >= 2) segs.push([centre[k - 2], centre[k - 1]]);
      }
      o.wallPreviews = segs.filter(([a, b]) => dist(a, b) > 1e-4).map(([a, b]) => wallPreviewPolygon(a, b, thickness));
      o.lines = [{ a: from, b: cursor, kind: 'preview' }, ...(snapRes?.guides ?? []).map((g) => ({ ...g, kind: 'guide' as const }))];
      const L = dist(from, cursor);
      // With a face reference the dimension measures the drawn face, on its open side (away from the wall).
      const dimOff = off === 0 ? thickness / 2 + 14 * env.px() : -Math.sign(off) * 14 * env.px();
      o.dims = [{ a: from, b: cursor, offset: dimOff, text: fmt(env, L) }];
      o.labels = [{ p: cursor, text: formatAngle(-angleOf(sub(cursor, from))), offset: { x: 14, y: 22 } }];
    } else if (snapRes) {
      o.lines = snapRes.guides.map((g) => ({ ...g, kind: 'guide' as const }));
    }
    if (numeric.active && cursor) o.numeric = { label: 'Length', value: numeric.value, p: cursor };
    env.setOverlay(o);
  };

  const addSegment = (env: ToolEnv, to: Vec2) => {
    if (!pts.length) return;
    const opts = drawingWallOptions();
    const { centre, closing } = centreline(to);
    const k = pts.length;
    const from = centre[k - 1];
    const end = closing ? centre[0] : centre[k];
    const prevNode = nodes[k - 1];
    const firstNode = nodes[0];
    const shift = off !== 0;
    const before = useProjectStore.getState().project;
    const nodePos = (d: D, id: string | null, fallback: Vec2): Vec2 => (id && d.nodes[id] ? { x: d.nodes[id].x, y: d.nodes[id].y } : fallback);
    const created = useProjectStore.getState().execute('Draw wall', (d) => {
      let s = from;
      let e = end;
      if (shift) {
        // Re-mitre the previous joint (and the start when closing) now that the next direction is known.
        // Nodes that already joined other walls stay put, and the new wall starts from where they are.
        if (k >= 2) {
          moveFreeNode(d, prevNode, from);
          s = nodePos(d, prevNode, from);
        }
        if (closing) {
          moveFreeNode(d, firstNode, end);
          e = nodePos(d, firstNode, end);
        }
      }
      return addWallChain(d, [s, e], opts);
    });
    const project = useProjectStore.getState().project!;
    const changed = project !== before;
    if (k === 1) nodes[0] = findNodeNear(project, from, 0.003);
    if (closing && created && created.length) {
      env.setHint('Room closed. Click to start another wall, or press Esc.');
      reset();
      return;
    }
    pts.push(to);
    nodes.push(findNodeNear(project, end, 0.003));
    committed.push(changed);
  };


  return {
    id: 'wall',
    cursor: 'crosshair',
    get hint() {
      return wallDrawHint(useEditorStore.getState().wallReference);
    },
    busy: () => pts.length > 0,
    onPointerMove(e, env) {
      const s = start();
      const r = env.snap(e.world, { anchor: last(), forceAngle: e.shift, extraPoints: s ? [s] : [] });
      cursor = r.point;
      env.setSnapLabel(r.label || null);
      render(env, r);
    },
    onPointerDown(e, env) {
      if (e.button !== 0) return;
      const s = start();
      const r = env.snap(e.world, { anchor: last(), forceAngle: e.shift, extraPoints: s ? [s] : [] });
      const p = r.point;
      numeric.clear();
      const from = last();
      if (!from) {
        pts = [p];
        nodes = [null];
        committed = [false];
        off = referenceOffset(useEditorStore.getState().wallReference, drawingWallOptions().thickness);
        env.setHint('Click to place the next corner. Click the start point to close. Enter finishes, Backspace removes the last wall, Esc cancels.');
      } else if (dist(p, from) > 0.01) {
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
      if (pts.length && numeric.key(e)) {
        render(env);
        return true;
      }
      if (e.key === 'Enter') {
        const from = last();
        if (numeric.active && from && cursor) {
          const len = parseLength(numeric.value, env.project().settings.units);
          numeric.clear();
          if (len == null || len < 0.02 || len > 200) {
            toast.warning('Invalid length', 'Enter a positive length, e.g. 3.5, 350cm or 11\'6".');
            return true;
          }
          const dir = dist(cursor, from) > 1e-6 ? normalize(sub(cursor, from)) : { x: 1, y: 0 };
          addSegment(env, add(from, scale(dir, len)));
          cursor = last();
          render(env);
          return true;
        }
        reset();
        env.setOverlay(null);
        return true;
      }
      if (e.key === 'Backspace' && pts.length > 1) {
        if (committed[committed.length - 1]) useProjectStore.getState().undo();
        pts.pop();
        nodes.pop();
        committed.pop();
        render(env);
        return true;
      }
      return false;
    },
    cancel(env) {
      const was = pts.length > 0;
      reset();
      env.setOverlay(null);
      return was;
    },
  };
}

// ───────────────────────── Curved wall ─────────────────────────

/**
 * Curved walls. Default "3-point arc": click start, end, then a point the
 * wall passes through (snapped like any other point; typed number = bulge).
 * Press A for "free bend", the original behaviour where the curve follows the
 * raw pointer without snapping.
 */
export function createCurveTool(): Tool {
  let a: Vec2 | null = null;
  let b: Vec2 | null = null;
  let through: Vec2 | null = null;
  let cursor: Vec2 | null = null;
  let mode: 'three-point' | 'free' = 'three-point';
  const numeric = new NumericEntry();
  const reset = () => {
    a = null;
    b = null;
    through = null;
    cursor = null;
    numeric.clear();
  };
  const modeHint = () =>
    mode === 'three-point'
      ? 'Curved wall (3-point arc): click the start, the end, then a point the wall passes through. A: free bend.'
      : 'Curved wall (free bend): click the start, the end, then move to bend and click. A: 3-point arc.';
  const render = (env: ToolEnv, cur: Vec2, snapRes?: SnapResult) => {
    const o: ToolOverlay = { snap: snapMark(snapRes) };
    const { thickness } = drawingWallOptions();
    if (a && !b) {
      if (dist(a, cur) > 1e-4) {
        o.wallPreviews = [wallPreviewPolygon(a, cur, thickness)];
        o.dims = [{ a, b: cur, offset: thickness / 2 + 14 * env.px(), text: fmt(env, dist(a, cur)) }];
      }
      o.lines = (snapRes?.guides ?? []).map((g) => ({ ...g, kind: 'guide' as const }));
      if (numeric.active) o.numeric = { label: 'Chord length', value: numeric.value, p: cur };
    } else if (a && b) {
      const p = through ?? cur;
      const c = arcControlThrough(a, b, p);
      const path = buildWallPath(a, b, c);
      const left = path.samples.map((s) => add(s.p, scale(leftNormal(s.tangent), thickness / 2)));
      const right = path.samples.map((s) => add(s.p, scale(leftNormal(s.tangent), -thickness / 2)));
      o.wallPreviews = [[...left, ...right.reverse()]];
      o.curveHandle = { a, b, c, mid: bezierPoint(a, c, b, 0.5) };
      const bulge = Math.abs(signedBulge(a, b, p));
      o.labels = [{ p: cur, text: `Arc ${fmt(env, path.length)} · bulge ${fmt(env, bulge)}`, offset: { x: 14, y: 22 } }];
      if (numeric.active) o.numeric = { label: 'Bulge', value: numeric.value, p: cur };
    }
    env.setOverlay(o);
  };
  const commit = (env: ToolEnv, p: Vec2) => {
    if (!a || !b) return;
    const opts = drawingWallOptions();
    const from = a;
    const to = b;
    const c = arcControlThrough(a, b, p);
    useProjectStore.getState().execute('Draw curved wall', (d) => addWallChain(d, [from, to], { ...opts, curves: [c] }));
    reset();
    env.setOverlay(null);
    env.setHint('Curved wall added. Select it to adjust the curve handle.');
  };
  const setEnd = (env: ToolEnv, p: Vec2) => {
    if (!a || dist(a, p) <= 0.05) return;
    b = p;
    env.setHint(
      mode === 'three-point'
        ? 'Click a point the wall passes through, or type the bulge + Enter. A: free bend.'
        : 'Move the pointer to bend the wall, then click to place it (or type the bulge + Enter). A: 3-point arc.',
    );
  };
  return {
    id: 'curve',
    cursor: 'crosshair',
    get hint() {
      return modeHint();
    },
    busy: () => a !== null,
    onPointerMove(e, env) {
      if (a && b) {
        if (mode === 'free') {
          through = e.world;
          cursor = e.world;
          render(env, e.world);
          return;
        }
        const r = env.snap(e.world, { extraPoints: [a, b] });
        through = r.point;
        cursor = r.point;
        env.setSnapLabel(r.label || null);
        render(env, r.point, r);
        return;
      }
      const r = env.snap(e.world, { anchor: a, forceAngle: e.shift });
      cursor = r.point;
      env.setSnapLabel(r.label || null);
      render(env, r.point, r);
    },
    onPointerDown(e, env) {
      if (e.button !== 0) return;
      numeric.clear();
      if (a && b) {
        const p = mode === 'free' ? e.world : env.snap(e.world, { extraPoints: [a, b] }).point;
        commit(env, p);
        return;
      }
      const r = env.snap(e.world, { anchor: a, forceAngle: e.shift });
      if (!a) {
        a = r.point;
        env.setHint('Click the end point of the curved wall (or type the chord length + Enter).');
      } else setEnd(env, r.point);
    },
    onKeyDown(e, env) {
      if (!e.ctrlKey && !e.metaKey && !e.altKey && !numeric.active && e.key.toLowerCase() === 'a') {
        mode = mode === 'three-point' ? 'free' : 'three-point';
        env.setHint(modeHint());
        if (cursor) render(env, cursor);
        return true;
      }
      if (a && numeric.key(e)) {
        if (cursor) render(env, cursor);
        return true;
      }
      if (e.key === 'Enter' && numeric.active && a) {
        const v = parseLength(numeric.value, env.project().settings.units);
        numeric.clear();
        if (!b) {
          if (v == null || v < 0.05 || v > 200) {
            toast.warning('Invalid length', 'Enter a positive chord length, e.g. 3.5 or 350cm.');
            return true;
          }
          const dir = cursor && dist(cursor, a) > 1e-6 ? normalize(sub(cursor, a)) : { x: 1, y: 0 };
          setEnd(env, add(a, scale(dir, v)));
          cursor = b;
          if (cursor) render(env, cursor);
          return true;
        }
        if (v == null || v < 0.01 || v > 100) {
          toast.warning('Invalid bulge', 'Enter how far the middle of the wall bows out, e.g. 0.6 or 60cm.');
          return true;
        }
        // Bulge towards the side the pointer is on (left of the chord by default).
        const side = cursor && signedBulge(a, b, cursor) < 0 ? -1 : 1;
        commit(env, bulgePoint(a, b, side * v));
        return true;
      }
      return false;
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

/** Rectangle corners clockwise on screen (y down): walking them, "left" is outside the room. */
function rectCorners(p0: Vec2, p1: Vec2): Vec2[] {
  const x0 = Math.min(p0.x, p1.x);
  const x1 = Math.max(p0.x, p1.x);
  const y0 = Math.min(p0.y, p1.y);
  const y1 = Math.max(p0.y, p1.y);
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
}

/**
 * Wall centre corners for a drawn rectangle. With a face reference the
 * rectangle is that face: "left" = the outer face (walls go inside),
 * "right" = the inner, clear face (walls go outside).
 */
export function roomCentreCorners(p0: Vec2, p1: Vec2, reference: WallReference, thickness: number): Vec2[] {
  const c = rectCorners(p0, p1);
  const off = referenceOffset(reference, thickness);
  return off === 0 ? c : offsetPolyline(c, off, true);
}

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
  const render = (env: ToolEnv, snapRes?: SnapResult) => {
    const o: ToolOverlay = { snap: snapMark(snapRes) };
    if (p0 && p1) {
      const { thickness } = drawingWallOptions();
      const ref = useEditorStore.getState().wallReference;
      const c = roomCentreCorners(p0, p1, ref, thickness);
      o.wallPreviews = c.map((pt, i) => wallPreviewPolygon(pt, c[(i + 1) % 4], thickness));
      const f = rectCorners(p0, p1);
      if (ref !== 'center') o.lines = f.map((pt, i) => ({ a: pt, b: f[(i + 1) % 4], kind: 'preview' as const }));
      const [x0, y0, x1, y1] = [f[0].x, f[0].y, f[2].x, f[2].y];
      const off = (ref === 'left' ? 0 : ref === 'right' ? thickness : thickness / 2) + 16 * env.px();
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
    const opts = drawingWallOptions();
    const c = roomCentreCorners(p0, p1, useEditorStore.getState().wallReference, opts.thickness);
    if (c[2].x - c[0].x < 0.05 || c[2].y - c[0].y < 0.05) {
      env.setHint('The room is too small for walls this thick drawn by their outer face.');
      return;
    }
    useProjectStore.getState().execute('Draw room', (d) => addRectangleWalls(d, c[0], c[2], opts));
    reset();
    env.setOverlay(null);
  };
  return {
    id: 'room',
    cursor: 'crosshair',
    get hint() {
      return roomDrawHint(useEditorStore.getState().wallReference);
    },
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

const MEASURE_HINT =
  'Click two points to measure (snaps to wall faces). On a wall face, press F to measure the clear distance to the opposite parallel face. Esc twice clears.';

export function createMeasureTool(): Tool {
  let a: Vec2 | null = null;
  /** Wall face the first point sits on, if any. */
  let aFace: { wallId: string; p: Vec2 } | null = null;
  /** Last snapped hover point (for F before the first click). */
  let hover: SnapResult | null = null;

  const faceOf = (env: ToolEnv, r: SnapResult | null) =>
    r && r.kind === 'edge' && r.refId ? wallFaceAt(env.derived().network, r.refId, r.point, 0.005) : null;

  const addMeasurement = (from: Vec2, to: Vec2) => {
    const m = { id: newId('m'), a: from, b: to };
    useEditorStore.setState((s) => ({ measurements: [...s.measurements, m] }));
  };

  const measureOpposite = (env: ToolEnv): boolean => {
    const network = env.derived().network;
    const face = aFace ? wallFaceAt(network, aFace.wallId, aFace.p, 0.005) : faceOf(env, hover);
    if (!face) {
      env.setHint('Start on a wall face (click or hover one) to measure to the opposite face with F.');
      return false;
    }
    const hit = findOppositeFace(network, face.point, face.normal);
    if (!hit) {
      env.setHint('No parallel wall face directly opposite this point.');
      return true;
    }
    addMeasurement(face.point, hit.point);
    a = null;
    aFace = null;
    env.setOverlay(null);
    env.setHint(`Clear distance: ${fmt(env, hit.distance)}. ${MEASURE_HINT}`);
    return true;
  };

  return {
    id: 'measure',
    cursor: 'crosshair',
    hint: MEASURE_HINT,
    busy: () => a !== null,
    onPointerMove(e, env) {
      const r = env.snap(e.world, { anchor: a, forceAngle: e.shift, edges: true });
      hover = r;
      env.setSnapLabel(r.label || null);
      const o: ToolOverlay = { snap: snapMark(r) };
      if (a && dist(a, r.point) > 1e-4) {
        o.dims = [{ a, b: r.point, offset: 0.0001, text: fmt(env, dist(a, r.point)) }];
        o.lines = [{ a, b: r.point, kind: 'preview' }];
      }
      env.setOverlay(o);
    },
    onPointerDown(e, env) {
      if (e.button !== 0) return;
      const r = env.snap(e.world, { anchor: a, forceAngle: e.shift, edges: true });
      if (!a) {
        a = r.point;
        const face = faceOf(env, r);
        aFace = face ? { wallId: face.wallId, p: face.point } : null;
        if (aFace) env.setHint('Click the second point, or press F for the clear distance to the opposite face.');
      } else {
        addMeasurement(a, r.point);
        a = null;
        aFace = null;
      }
    },
    onKeyDown(e, env) {
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.toLowerCase() !== 'f') return false;
      // Only claim F when it can mean "opposite face"; otherwise it stays "fit plan".
      if (!aFace && !faceOf(env, hover)) return false;
      return measureOpposite(env);
    },
    cancel(env) {
      if (a) {
        a = null;
        aFace = null;
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

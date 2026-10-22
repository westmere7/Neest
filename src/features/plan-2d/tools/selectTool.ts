import { isDividerWall } from '@/domain/model/schema';
import type { PlacedObject, Vec2 } from '@/domain/model/schema';
import { clampOpenings, insertJunctions, joinTangent, setNodePositions, settleNode, updateWalls } from '@/domain/commands/walls';
import { clampOpening, normalizeRotation, updateObjects, updateOpening } from '@/domain/commands/entities';
import { projectOnPath } from '@/domain/geometry/wallPath';
import { add, angleOf, dist, dot, leftNormal, rotate, round, scale, sub } from '@/domain/geometry/vec';
import { formatAngle, formatLength } from '@/domain/model/units';
import { getAsset } from '@/data/assets/registry';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore, type SelItem } from '@/state/editorStore';
import { hitHandle, hitTest, marqueeSelect, selectionHandles, type Handle } from '../hitTest';
import { WALL_HUG_MOVE, hugWall } from './placeTools';
import type { PointerInfo, Tool, ToolEnv, ToolOverlay } from './types';
import { movedElevation } from './surfaces';
import { axisGuide, axisLockLabel, createAxisLock, onAxis, snapOnAxis, type AxisLockState } from '@/domain/geometry/axisLock';
import type { CalloutTarget } from '@/domain/model/schema';
import { useDialogStore } from '@/state/uiStores';

type Gesture =
  | { type: 'pending'; start: Vec2; startScreen: Vec2; hit: SelItem | null; shift: boolean; wasSelected: boolean }
  | { type: 'marquee'; a: Vec2; b: Vec2; additive: boolean }
  | {
      type: 'move';
      start: Vec2;
      nodes: Record<string, Vec2>;
      objects: Record<string, Vec2>;
      /** Spot and area callouts moving with the selection: their targets at the start. */
      callouts: Record<string, CalloutTarget>;
      perp: { normal: Vec2 } | null;
      primaryObject: string | null;
      /** Shift keeps the move on one plan axis. */
      lock: AxisLockState;
    }
  | { type: 'slide-opening'; openingId: string }
  | { type: 'node'; nodeId: string; anchor: Vec2 | null; excludeWalls: Set<string> }
  | { type: 'curve'; wallId: string; end: 'mid' | 'a' | 'b' }
  | { type: 'opening-end'; openingId: string; end: 'start' | 'end' }
  | { type: 'rotate'; objectId: string; base: PlacedObject }
  | { type: 'resize'; objectId: string; sx: -1 | 0 | 1; sy: -1 | 0 | 1; base: PlacedObject }
  | { type: 'label'; roomId: string; start: Vec2; base: Vec2 }
  /** Dragging a callout's label: its offset from the anchor changes. */
  | { type: 'callout'; id: string; start: Vec2; base: Vec2 };

const DRAG_THRESHOLD_PX = 4;

/** Where the rays p + s·u and q − r·v meet in front of both ends (s, r > 0), or null. */
function rayCorner(p: Vec2, u: Vec2, q: Vec2, v: Vec2): Vec2 | null {
  const den = u.x * v.y - u.y * v.x;
  if (Math.abs(den) < 1e-6) return null;
  const w = sub(q, p);
  const s = (w.x * v.y - w.y * v.x) / den;
  const r = (u.x * w.y - u.y * w.x) / den;
  return s > 1e-4 && r > 1e-4 ? add(p, scale(u, s)) : null;
}

function isLockedItem(env: ToolEnv, item: SelItem): boolean {
  const p = env.project();
  if (item.kind === 'wall') return !!p.walls[item.id]?.locked || p.layers.construction.locked;
  if (item.kind === 'node') return p.layers.construction.locked;
  if (item.kind === 'opening') return p.layers.construction.locked;
  if (item.kind === 'object') return !!p.objects[item.id]?.locked || p.layers.furniture.locked;
  if (item.kind === 'callout') return !!p.layers.callouts?.locked;
  return false;
}

export function createSelectTool(): Tool {
  let gesture: Gesture | null = null;
  const store = () => useProjectStore.getState();
  const editor = () => useEditorStore.getState();

  const fmt = (env: ToolEnv, m: number) => {
    const s = env.project().settings;
    return formatLength(m, s.units, s.precision);
  };

  const startDrag = (env: ToolEnv, g: Extract<Gesture, { type: 'pending' }>, e: PointerInfo) => {
    const project = env.project();
    const sel = editor().selection;
    const hit = g.hit;
    if (!hit || hit.kind === 'room' || !sel.some((s) => s.id === hit.id)) {
      gesture = { type: 'marquee', a: g.start, b: e.world, additive: g.shift };
      return;
    }
    const movable = sel.filter((s) => !isLockedItem(env, s));
    if (!movable.length) {
      env.setHint('Selection is locked. Unlock it in the inspector to move it.');
      gesture = null;
      return;
    }
    if (movable.length === 1 && movable[0].kind === 'callout') {
      const c = project.callouts?.[movable[0].id];
      if (!c) return;
      store().begin('Move note');
      gesture = { type: 'callout', id: c.id, start: g.start, base: { ...c.offset } };
      return;
    }
    if (movable.length === 1 && movable[0].kind === 'opening') {
      store().begin('Move opening');
      gesture = { type: 'slide-opening', openingId: movable[0].id };
      return;
    }
    const nodes: Record<string, Vec2> = {};
    const objects: Record<string, Vec2> = {};
    const callouts: Record<string, CalloutTarget> = {};
    for (const s of movable) {
      if (s.kind === 'callout') {
        const c = project.callouts?.[s.id];
        if (c && (c.target.kind === 'point' || c.target.kind === 'region')) callouts[c.id] = structuredClone(c.target);
        continue;
      }
      if (s.kind === 'wall') {
        const w = project.walls[s.id];
        if (!w) continue;
        nodes[w.a] = { ...project.nodes[w.a] };
        nodes[w.b] = { ...project.nodes[w.b] };
      } else if (s.kind === 'node') {
        const n = project.nodes[s.id];
        if (n) nodes[n.id] = { x: n.x, y: n.y };
      } else if (s.kind === 'object') {
        const o = project.objects[s.id];
        if (o) objects[o.id] = { x: o.x, y: o.y };
      }
    }
    let perp: { normal: Vec2 } | null = null;
    if (movable.length === 1 && movable[0].kind === 'wall' && !e.alt) {
      const w = project.walls[movable[0].id];
      if (w && !w.curve) {
        const a = project.nodes[w.a];
        const b = project.nodes[w.b];
        const d = sub(b, a);
        const l = Math.hypot(d.x, d.y);
        if (l > 1e-6) perp = { normal: leftNormal({ x: d.x / l, y: d.y / l }) };
      }
    }
    const objIds = Object.keys(objects);
    store().begin(Object.keys(nodes).length ? 'Move walls' : objIds.length > 1 ? 'Move objects' : 'Move object');
    gesture = {
      type: 'move',
      start: g.start,
      nodes,
      objects,
      callouts,
      perp,
      primaryObject: objIds.length === 1 && !Object.keys(nodes).length ? objIds[0] : null,
      lock: createAxisLock(),
    };
  };

  const updateHover = (e: PointerInfo, env: ToolEnv) => {
    const project = env.project();
    const derived = env.derived();
    const handles = selectionHandles(project, derived, editor().selection, env.px());
    const h = hitHandle(handles, e.world, env.tol() * 1.2);
    if (h) {
      env.setCursor(h.type === 'object-rotate' ? 'grab' : h.type === 'object-resize' ? 'nwse-resize' : 'move');
      editor().setHover(null);
      return;
    }
    const hit = hitTest(project, derived, e.world, env.tol());
    editor().setHover(hit && hit.kind !== 'room' ? hit : null);
    env.setCursor(hit && hit.kind !== 'room' ? 'pointer' : 'default');
  };

  const overlayFor = (o: ToolOverlay) => o;

  return {
    id: 'select',
    cursor: 'default',
    hint: 'Click to select, drag to move, drag on empty space to box-select. Shift-click adds to the selection; Shift-drag moves along one axis.',
    busy: () => gesture !== null,

    onPointerDown(e, env) {
      if (e.button !== 0) return;
      const project = env.project();
      const derived = env.derived();
      const sel = editor().selection;
      const handles = selectionHandles(project, derived, sel, env.px());
      const h: Handle | null = hitHandle(handles, e.world, env.tol() * 1.2);
      if (h) {
        if (h.type === 'node') {
          if (project.layers.construction.locked) return;
          const walls = Object.values(project.walls).filter((w) => w.a === h.nodeId || w.b === h.nodeId);
          let anchor: Vec2 | null = null;
          if (walls.length === 1) {
            const w = walls[0];
            anchor = project.nodes[w.a === h.nodeId ? w.b : w.a];
          }
          store().begin('Move endpoint');
          gesture = { type: 'node', nodeId: h.nodeId, anchor, excludeWalls: new Set(walls.map((w) => w.id)) };
        } else if (h.type === 'curve') {
          store().begin('Bend wall');
          gesture = { type: 'curve', wallId: h.wallId, end: h.end };
        } else if (h.type === 'opening-end') {
          store().begin('Resize opening');
          gesture = { type: 'opening-end', openingId: h.openingId, end: h.end };
        } else if (h.type === 'object-rotate') {
          store().begin('Rotate object');
          gesture = { type: 'rotate', objectId: h.objectId, base: { ...project.objects[h.objectId] } };
        } else if (h.type === 'object-resize') {
          store().begin('Resize object');
          gesture = { type: 'resize', objectId: h.objectId, sx: h.sx, sy: h.sy, base: { ...project.objects[h.objectId] } };
        } else if (h.type === 'room-label') {
          const r = project.rooms[h.roomId];
          store().begin('Move room label');
          gesture = { type: 'label', roomId: h.roomId, start: e.world, base: { ...r.labelOffset } };
        }
        return;
      }
      const hit = hitTest(project, derived, e.world, env.tol());
      const wasSelected = !!hit && sel.some((s) => s.id === hit.id);
      if (hit) {
        // Shift on a selected item waits for the release: a drag moves the selection along one axis instead.
        if (e.shift) {
          if (!wasSelected) editor().toggleSelection(hit);
        } else if (!wasSelected) editor().setSelection([hit]);
      }
      gesture = { type: 'pending', start: e.world, startScreen: e.screen, hit, shift: e.shift, wasSelected };
    },

    onPointerMove(e, env) {
      if (!gesture) {
        updateHover(e, env);
        return;
      }
      const project = env.project();
      switch (gesture.type) {
        case 'pending': {
          if (dist(gesture.startScreen, e.screen) < DRAG_THRESHOLD_PX) return;
          startDrag(env, gesture, e);
          if (gesture && gesture.type !== 'pending') this.onPointerMove!(e, env);
          return;
        }
        case 'marquee': {
          gesture.b = e.world;
          env.setOverlay(overlayFor({ marquee: { a: gesture.a, b: gesture.b } }));
          return;
        }
        case 'move': {
          const g = gesture;
          // A single straight wall already slides along its normal; anything else locks to an axis with Shift.
          let delta = g.lock.apply(sub(e.world, g.start), e.shift && !g.perp);
          const axis = g.perp ? null : g.lock.axis;
          const grid = project.settings.gridSize;
          const snapOn = editor().snap.grid && !e.alt;
          if (g.perp) {
            let dd = dot(delta, g.perp.normal);
            if (snapOn) dd = round(dd, grid);
            delta = scale(g.perp.normal, dd);
          } else if (Object.keys(g.nodes).length && snapOn) {
            delta = { x: round(delta.x, grid), y: round(delta.y, grid) };
          }
          let hugged: ReturnType<typeof hugWall> = null;
          if (g.primaryObject) {
            const o = project.objects[g.primaryObject];
            const base = g.objects[g.primaryObject];
            const asset = o ? getAsset(project, o.assetId) : null;
            let target = add(base, delta);
            if (snapOn) target = snapOnAxis(target, base, axis, grid / 2);
            if (asset && o && (asset.wallSnap || asset.mount === 'wall') && !e.alt) {
              hugged = hugWall(env.derived(), add(base, delta), o.depth, asset.mount === 'wall' ? 0.6 : WALL_HUG_MOVE);
              // While locked, only a wall the item meets on its line counts.
              if (hugged && !onAxis(hugged, base, axis)) hugged = null;
              if (hugged) target = { x: hugged.x, y: hugged.y };
            }
            delta = sub(target, base);
          }
          const nodes = Object.fromEntries(Object.entries(g.nodes).map(([id, p]) => [id, add(p, delta)]));
          const hugRot = hugged?.rotation;
          // A single small item steps onto (or off) tables, counters and cabinets it is moved over.
          const movingIds = Object.keys(g.objects);
          const base = store().tx?.base;
          const lift = movingIds.length === 1 && base ? movedElevation(base, movingIds[0], g.objects[movingIds[0]].x + delta.x, g.objects[movingIds[0]].y + delta.y) : undefined;
          store().preview((d) => {
            setNodePositions(d, nodes);
            for (const [id, p] of Object.entries(g.objects)) {
              const o = d.objects[id];
              if (!o) continue;
              o.x = p.x + delta.x;
              o.y = p.y + delta.y;
              if (hugRot !== undefined && id === g.primaryObject) o.rotation = normalizeRotation(hugRot);
              if (lift !== undefined) o.elevation = lift;
            }
            for (const [id, t] of Object.entries(g.callouts)) {
              const c = d.callouts?.[id];
              if (!c) continue;
              if (t.kind === 'point') c.target = { ...t, x: t.x + delta.x, y: t.y + delta.y };
              else if (t.kind === 'region') c.target = { ...t, points: t.points.map((p) => ({ x: p.x + delta.x, y: p.y + delta.y })) };
            }
          });
          env.setSnapLabel([axis && axisLockLabel(axis), hugged && 'Against wall'].filter(Boolean).join(' · ') || null);
          env.setOverlay({
            lines: axis ? [{ ...axisGuide(g.start, axis, 4000 * env.px()), kind: 'guide' as const }] : undefined,
            labels: [{ p: e.world, text: `Δ ${fmt(env, Math.hypot(delta.x, delta.y))}`, offset: { x: 14, y: 22 } }],
          });
          return;
        }
        case 'slide-opening': {
          const o = project.openings[gesture.openingId];
          if (!o) return;
          const derived = env.derived();
          let wallId = o.wallId;
          let g = derived.network.walls.get(wallId);
          if (!g) return;
          let proj = projectOnPath(g.path, e.world);
          // Re-host onto another wall when the pointer moves onto it.
          if (proj.dist > g.h + env.tol() * 2) {
            for (const other of derived.network.walls.values()) {
              if (other.wall.id === wallId || isDividerWall(other.wall)) continue;
              const pr = projectOnPath(other.path, e.world);
              if (pr.dist <= other.h + env.tol()) {
                wallId = other.wall.id;
                g = other;
                proj = pr;
                break;
              }
            }
          }
          let s = proj.s;
          if (editor().snap.grid && !e.alt) s = round(s, project.settings.gridSize / 2);
          const newWall = wallId;
          store().preview((d) => {
            const op = d.openings[o.id];
            op.wallId = newWall;
            op.offset = s;
            clampOpening(d, o.id);
          });
          const updated = env.project().openings[o.id];
          const g2 = env.derived().network.walls.get(updated.wallId);
          if (g2) {
            const s0 = updated.offset - updated.width / 2;
            const s1 = g2.path.length - (updated.offset + updated.width / 2);
            env.setOverlay({
              labels: [{ p: e.world, text: `${fmt(env, s0)} ← → ${fmt(env, s1)}`, offset: { x: 14, y: 24 } }],
            });
          }
          return;
        }
        case 'node': {
          const r = env.snap(e.world, {
            anchor: gesture.anchor,
            forceAngle: e.shift,
            excludeNodes: new Set([gesture.nodeId]),
            excludeWalls: gesture.excludeWalls,
          });
          const id = gesture.nodeId;
          store().preview((d) => setNodePositions(d, { [id]: r.point }));
          env.setSnapLabel(r.label || null);
          const o: ToolOverlay = {
            snap: r.kind !== 'none' ? { p: r.point, kind: r.kind, label: r.label } : null,
            lines: r.guides.map((gd) => ({ ...gd, kind: 'guide' as const })),
          };
          if (gesture.anchor) {
            o.dims = [{ a: gesture.anchor, b: r.point, offset: 18 * env.px(), text: fmt(env, dist(gesture.anchor, r.point)) }];
          }
          env.setOverlay(o);
          return;
        }
        case 'curve': {
          const w = project.walls[gesture.wallId];
          if (!w) return;
          const a = project.nodes[w.a];
          const b = project.nodes[w.b];
          const wid = gesture.wallId;
          const snapOn = !e.alt;
          if (gesture.end === 'mid') {
            const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
            // Handle sits at the curve's midpoint; derive the Bézier control point.
            let c = { x: 2 * e.world.x - mid.x, y: 2 * e.world.y - mid.y };
            let label: string | null = null;
            // Snap to the bend that flows smoothly into the walls joined at both ends.
            const ta = joinTangent(project, wid, 'a');
            const tb = joinTangent(project, wid, 'b');
            const fit = snapOn && ta && tb ? rayCorner(a, ta, b, tb) : null;
            if (fit && dist({ x: (a.x + 2 * fit.x + b.x) / 4, y: (a.y + 2 * fit.y + b.y) / 4 }, e.world) < env.tol() * 2) {
              c = fit;
              label = 'Tangent to joined walls';
            }
            store().preview((d) => updateWalls(d, [wid], { curve: c }));
            env.setSnapLabel(label);
            return;
          }
          // End handle of a two-handle curve: snap its direction to the joined wall or 45° steps.
          const origin = gesture.end === 'a' ? a : b;
          let p = e.world;
          let label: string | null = null;
          if (snapOn) {
            const v = sub(e.world, origin);
            const len = Math.hypot(v.x, v.y);
            const t = joinTangent(project, wid, gesture.end);
            const dirs: { u: Vec2; label: string }[] = [];
            if (t) dirs.push({ u: gesture.end === 'a' ? t : scale(t, -1), label: 'Tangent to joined wall' });
            if (editor().snap.angle) for (let k = 0; k < 8; k++) dirs.push({ u: { x: Math.cos((k * Math.PI) / 4), y: Math.sin((k * Math.PI) / 4) }, label: `${k * 45}°` });
            let best: { u: Vec2; label: string; cos: number } | null = null;
            for (const dd of dirs) {
              const cos = len > 1e-6 ? dot(v, dd.u) / len : -1;
              if (cos > Math.cos((6 * Math.PI) / 180) && (!best || cos > best.cos + 1e-9)) best = { ...dd, cos };
            }
            if (best) {
              p = add(origin, scale(best.u, dot(v, best.u)));
              label = best.label;
            }
          }
          const patch = gesture.end === 'a' ? { curve: p } : { curveEnd: p };
          store().preview((d) => updateWalls(d, [wid], patch));
          env.setSnapLabel(label);
          env.setOverlay({ lines: [{ a: origin, b: p, kind: 'guide' as const }] });
          return;
        }
        case 'opening-end': {
          const o = project.openings[gesture.openingId];
          const g = o && env.derived().network.walls.get(o.wallId);
          if (!o || !g) return;
          const proj = projectOnPath(g.path, e.world);
          let s = proj.s;
          if (editor().snap.grid && !e.alt) s = round(s, project.settings.gridSize / 2);
          const fixed = gesture.end === 'start' ? o.offset + o.width / 2 : o.offset - o.width / 2;
          const width = Math.max(0.3, Math.abs(fixed - s));
          const offset = gesture.end === 'start' ? fixed - width / 2 : fixed + width / 2;
          const id = o.id;
          store().preview((d) => updateOpening(d, id, { width, offset }));
          env.setOverlay({ labels: [{ p: e.world, text: `Width ${fmt(env, width)}`, offset: { x: 14, y: 22 } }] });
          return;
        }
        case 'rotate': {
          const b = gesture.base;
          let ang = angleOf(sub(e.world, { x: b.x, y: b.y })) + Math.PI / 2;
          if (!e.alt) ang = Math.round(ang / (Math.PI / 12)) * (Math.PI / 12);
          const rot = normalizeRotation(ang);
          const id = gesture.objectId;
          store().preview((d) => updateObjects(d, [id], { rotation: rot }));
          env.setOverlay({ labels: [{ p: e.world, text: formatAngle(rot), offset: { x: 14, y: 22 } }] });
          return;
        }
        case 'resize': {
          const b = gesture.base;
          const asset = getAsset(project, b.assetId);
          const local = rotate(sub(e.world, { x: b.x, y: b.y }), -b.rotation);
          const grid = project.settings.gridSize;
          const snapOn = editor().snap.grid && !e.alt;
          let w = b.width;
          let dpt = b.depth;
          let cx = 0;
          let cy = 0;
          const min = asset?.minSize ?? { w: 0.05, d: 0.05, h: 0.05 };
          const max = asset?.maxSize ?? { w: 20, d: 20, h: 10 };
          if (gesture.sx !== 0 && (asset?.resizable.w ?? true)) {
            const fixedX = (-gesture.sx * b.width) / 2;
            let nw = Math.abs(local.x - fixedX);
            if (snapOn) nw = Math.max(grid / 2, round(nw, grid / 2));
            nw = Math.min(max.w, Math.max(min.w, nw));
            w = nw;
            cx = fixedX + (gesture.sx * nw) / 2;
          }
          if (gesture.sy !== 0 && (asset?.resizable.d ?? true)) {
            const fixedY = (-gesture.sy * b.depth) / 2;
            let nd = Math.abs(local.y - fixedY);
            if (snapOn) nd = Math.max(grid / 2, round(nd, grid / 2));
            nd = Math.min(max.d, Math.max(min.d, nd));
            dpt = nd;
            cy = fixedY + (gesture.sy * nd) / 2;
          }
          const c = add({ x: b.x, y: b.y }, rotate({ x: cx, y: cy }, b.rotation));
          const id = gesture.objectId;
          store().preview((d) => updateObjects(d, [id], { width: w, depth: dpt, x: c.x, y: c.y }));
          env.setOverlay({
            labels: [{ p: e.world, text: `${fmt(env, w)} × ${fmt(env, dpt)}`, offset: { x: 14, y: 22 } }],
          });
          return;
        }
        case 'label': {
          const off = add(gesture.base, sub(e.world, gesture.start));
          const id = gesture.roomId;
          store().preview((d) => {
            d.rooms[id].labelOffset = off;
          });
          return;
        }
        case 'callout': {
          const off = add(gesture.base, sub(e.world, gesture.start));
          const id = gesture.id;
          store().preview((d) => {
            const c = d.callouts?.[id];
            if (c) c.offset = off;
          });
          return;
        }
      }
    },

    onPointerUp(e, env) {
      const g = gesture;
      gesture = null;
      if (!g) return;
      const project = env.project();
      switch (g.type) {
        case 'pending': {
          if (!g.hit && !g.shift) editor().clearSelection();
          else if (g.hit && g.wasSelected) {
            if (g.shift) editor().toggleSelection(g.hit);
            else editor().setSelection([g.hit]);
          }
          if (!g.hit) {
            const room = hitTest(project, env.derived(), e.world, env.tol(), { rooms: true });
            if (room) editor().setSelection(g.shift ? [...editor().selection, room] : [room]);
          }
          break;
        }
        case 'marquee': {
          const items = marqueeSelect(project, env.derived(), g.a, g.b);
          editor().setSelection(g.additive ? [...editor().selection, ...items.filter((i) => !editor().selection.some((s) => s.id === i.id))] : items);
          break;
        }
        case 'move': {
          const nodeIds = Object.keys(g.nodes);
          store().commit((d) => {
            for (const id of nodeIds) if (d.nodes[id]) settleNode(d, id);
            const affected = Object.values(d.walls)
              .filter((w) => nodeIds.includes(w.a) || nodeIds.includes(w.b))
              .map((w) => w.id);
            if (affected.length) {
              insertJunctions(d, affected);
              clampOpenings(d);
            }
          });
          break;
        }
        case 'node': {
          const id = g.nodeId;
          store().commit((d) => {
            settleNode(d, id);
            clampOpenings(d);
          });
          break;
        }
        case 'curve':
        case 'opening-end':
        case 'rotate':
        case 'resize':
        case 'label':
        case 'callout':
        case 'slide-opening':
          store().commit();
          break;
      }
      env.setOverlay(null);
      env.setSnapLabel(null);
    },

    onDoubleClick(e, env) {
      // A callout: open its editor. An item: select it and close in on it. A room: select it and edit its name.
      const call = hitTest(env.project(), env.derived(), e.world, env.tol(), { callouts: true });
      if (call) {
        editor().setSelection([call]);
        useDialogStore.getState().open('callout', { id: call.id });
        return;
      }
      const item = hitTest(env.project(), env.derived(), e.world, env.tol(), { rooms: false, walls: false, objects: true, openings: true });
      if (item) {
        editor().setSelection([item]);
        editor().requestFocus();
        return;
      }
      const hit = hitTest(env.project(), env.derived(), e.world, env.tol(), { rooms: true, walls: false, objects: false, openings: false });
      if (hit) {
        editor().setSelection([hit]);
        window.dispatchEvent(new CustomEvent('neest:focus-name'));
      }
    },

    cancel(env) {
      if (!gesture) return false;
      if (gesture.type !== 'pending' && gesture.type !== 'marquee') store().cancel();
      gesture = null;
      env.setOverlay(null);
      return true;
    },
  };
}


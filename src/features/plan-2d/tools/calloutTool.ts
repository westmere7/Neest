import { CalloutSchema, type CalloutTarget, type Project, type Vec2 } from '@/domain/model/schema';
import { addCallout } from '@/domain/commands/callouts';
import { calloutAnchor, setCalloutAnchorPoint } from '@/domain/geometry/callouts';
import { add, dist, rotate, sub } from '@/domain/geometry/vec';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore } from '@/state/editorStore';
import { useDialogStore, usePrefsStore } from '@/state/uiStores';
import { hitCalloutAnchor } from '@/features/callouts/layout';
import { hitTest } from '../hitTest';
import type { Tool, ToolEnv } from './types';

const DRAG_PX = 5;

/**
 * A spot note on top of an item (its footprint centre, at its top). New notes on furniture start as
 * spots so they stay put when the furniture is moved or swapped; the editor can attach them to the item.
 */
export function spotOnItem(project: Project, objectId: string): CalloutTarget {
  const a = calloutAnchor(project, null, { kind: 'object', objectId });
  return a ? { kind: 'point', x: a.x, y: a.y, z: a.z } : { kind: 'object', objectId };
}

/**
 * What a click at `p` points a callout at. A spot by default, also on furniture (in the plan it sits
 * on the item's top, in 3D at the picked point); Shift attaches it to the item under it, Alt to the room.
 */
export function calloutTargetAt(
  env: ToolEnv,
  p: Vec2,
  alt: boolean,
  pickedObjectId?: string | null,
  worldZ = 0,
  attach = false,
): CalloutTarget {
  const project = env.project();
  const derived = env.derived();
  const r3 = (n: number) => Math.round(n * 1000) / 1000;
  if (pickedObjectId !== undefined) {
    if (attach && pickedObjectId && !alt && project.objects[pickedObjectId]) {
      const o = project.objects[pickedObjectId];
      const local = rotate({ x: p.x - o.x, y: p.y - o.y }, -o.rotation);
      return {
        kind: 'object',
        objectId: pickedObjectId,
        dx: r3(local.x),
        dy: r3(local.y),
        dz: r3(worldZ - (o.elevation + o.height)),
      };
    }
    if (alt) {
      const room = hitTest(project, derived, p, env.tol(), { rooms: true });
      if (room) {
        const base = calloutAnchor(project, derived, { kind: 'room', roomId: room.id });
        return base
          ? { kind: 'room', roomId: room.id, dx: r3(p.x - base.x), dy: r3(p.y - base.y), dz: r3(worldZ - base.z) }
          : { kind: 'room', roomId: room.id };
      }
    }
    return { kind: 'point', x: p.x, y: p.y, z: worldZ };
  }
  if (alt) {
    const room = hitTest(project, derived, p, env.tol(), { rooms: true });
    if (room) return { kind: 'room', roomId: room.id };
  }
  const item = hitTest(project, derived, p, env.tol(), { objects: true });
  const o = item ? project.objects[item.id] : undefined;
  if (o && attach) return { kind: 'object', objectId: o.id };
  return { kind: 'point', x: p.x, y: p.y, z: o ? r3(o.elevation + o.height) : 0 };
}

/** Adds a callout, selects it and opens its editor. */
export function createCalloutAt(target: CalloutTarget, px: number): string | undefined {
  // The label opens up and to the right of the target, a fixed distance on screen.
  const offset = { x: Math.max(0.35, 70 * px), y: -Math.max(0.3, 60 * px) };
  // New notes start with the style set as default in the note editor.
  const saved = usePrefsStore.getState().noteStyle;
  const style = saved && CalloutSchema.partial().safeParse(saved).success ? saved : {};
  const id = useProjectStore.getState().execute('Add note', (d) => addCallout(d, { ...style, target, offset }));
  if (!id) return undefined;
  useEditorStore.getState().setSelection([{ kind: 'callout', id }]);
  useDialogStore.getState().open('callout', { id, isNew: true });
  return id;
}

/**
 * Callout tool: click to pin a callout to that spot (on furniture too), Shift-click to attach it to
 * the item, Alt-click inside a room to pin it to the room, drag to mark an area. Clicking an existing note label moves the label; dragging its
 * anchor dot moves the spot it points to; double-clicking edits it.
 */
export function createCalloutTool(): Tool {
  let start: { world: Vec2; screen: Vec2 } | null = null;
  let dragging = false;
  /** A note pressed in this gesture (label or spot), and where: a release without a drag opens it in Notes mode. */
  let clicked: { id: string; at: Vec2 } | null = null;
  let moveCallout: { id: string; mode: 'label' | 'anchor'; start: Vec2; base: Vec2; moved: boolean } | null = null;
  return {
    id: 'callout',
    cursor: 'crosshair',
    hint: 'Click to pin a note to a spot · Shift-click to attach it to the item · Alt-click for the room · drag to mark an area · drag a note dot to move its spot.',
    busy: () => start !== null || moveCallout !== null,
    onPointerDown(e, env) {
      if (e.button !== 0) return;
      clicked = null;
      const in3d = e.pickedObjectId !== undefined;
      if (!in3d) {
        const anchorHit = hitCalloutAnchor(env.project(), env.derived(), e.world, env.px(), env.tol());
        if (anchorHit) {
          clicked = { id: anchorHit.id, at: e.screen };
          useEditorStore.getState().setSelection([{ kind: 'callout', id: anchorHit.id }]);
          if (!env.project().layers.callouts?.locked) {
            const a = calloutAnchor(env.project(), env.derived(), anchorHit.target);
            if (a) moveCallout = { id: anchorHit.id, mode: 'anchor', start: e.world, base: { x: a.x, y: a.y }, moved: false };
          }
          return;
        }
        const existing = hitTest(env.project(), env.derived(), e.world, env.tol(), { callouts: true, px: env.px() });
        if (existing?.kind === 'callout') {
          const c = env.project().callouts?.[existing.id];
          clicked = { id: existing.id, at: e.screen };
          useEditorStore.getState().setSelection([existing]);
          if (c && !env.project().layers.callouts?.locked) {
            moveCallout = { id: c.id, mode: 'label', start: e.world, base: { ...c.offset }, moved: false };
          }
          return;
        }
      }
      start = { world: e.world, screen: e.screen };
      dragging = false;
    },
    onPointerMove(e, env) {
      if (moveCallout) {
        if (!moveCallout.moved) {
          if (dist(moveCallout.start, e.world) / env.px() < DRAG_PX) return;
          moveCallout.moved = true;
          useProjectStore.getState().begin(moveCallout.mode === 'anchor' ? 'Move note spot' : 'Move note');
        }
        const id = moveCallout.id;
        const nextPos = add(moveCallout.base, sub(e.world, moveCallout.start));
        const mode = moveCallout.mode;
        const derived = env.derived();
        useProjectStore.getState().preview((d) => {
          const c = d.callouts?.[id];
          if (!c) return;
          if (mode === 'anchor') setCalloutAnchorPoint(d, derived, c, nextPos, true);
          else c.offset = nextPos;
        });
        return;
      }
      const in3d = e.pickedObjectId !== undefined;
      if (!start) {
        if (!in3d) {
          const anchorHit = hitCalloutAnchor(env.project(), env.derived(), e.world, env.px(), env.tol());
          if (anchorHit) {
            env.setCursor('move');
            useEditorStore.getState().setHover({ kind: 'callout', id: anchorHit.id });
            return;
          }
          const existing = hitTest(env.project(), env.derived(), e.world, env.tol(), { callouts: true, px: env.px() });
          if (existing?.kind === 'callout') {
            env.setCursor('pointer');
            useEditorStore.getState().setHover(existing);
            return;
          }
        }
        env.setCursor('crosshair');
        const t = calloutTargetAt(env, e.world, e.alt, e.pickedObjectId, e.worldZ, e.shift);
        useEditorStore.getState().setHover(t.kind === 'object' ? { kind: 'object', id: t.objectId } : t.kind === 'room' ? { kind: 'room', id: t.roomId } : null);
        return;
      }
      if (!in3d && !dragging && dist(start.screen, e.screen) >= DRAG_PX) dragging = true;
      if (dragging) env.setOverlay({ marquee: { a: start.world, b: e.world } });
    },
    onPointerUp(e, env) {
      const hit = clicked;
      clicked = null;
      const wasMoved = moveCallout?.moved ?? false;
      if (moveCallout) {
        if (moveCallout.moved) useProjectStore.getState().commit();
        moveCallout = null;
      }
      // In Notes mode a click on a note (no drag) opens it for editing.
      if (hit) {
        if (!wasMoved && useEditorStore.getState().notesMode && dist(hit.at, e.screen) < DRAG_PX) useDialogStore.getState().open('callout', { id: hit.id });
        return;
      }
      const s = start;
      start = null;
      env.setOverlay(null);
      if (!s) return;
      const in3d = e.pickedObjectId !== undefined;
      if (in3d && dist(s.screen, e.screen) >= DRAG_PX) return;
      let target: CalloutTarget;
      if (dragging && !in3d) {
        const a = s.world;
        const b = e.world;
        if (Math.abs(a.x - b.x) < 0.05 || Math.abs(a.y - b.y) < 0.05) return;
        target = {
          kind: 'region',
          points: [
            { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y) },
            { x: Math.max(a.x, b.x), y: Math.min(a.y, b.y) },
            { x: Math.max(a.x, b.x), y: Math.max(a.y, b.y) },
            { x: Math.min(a.x, b.x), y: Math.max(a.y, b.y) },
          ],
        };
      } else target = calloutTargetAt(env, s.world, e.alt, e.pickedObjectId, e.worldZ, e.shift);
      useEditorStore.getState().setHover(null);
      createCalloutAt(target, env.px());
      if (!useEditorStore.getState().notesMode) env.finish();
    },
    onDoubleClick(e, env) {
      const existing = hitTest(env.project(), env.derived(), e.world, env.tol(), { callouts: true, px: env.px() });
      if (existing?.kind === 'callout') {
        useEditorStore.getState().setSelection([existing]);
        useDialogStore.getState().open('callout', { id: existing.id });
      }
    },
    cancel(env) {
      if (moveCallout) {
        if (moveCallout.moved) useProjectStore.getState().cancel();
        moveCallout = null;
        return true;
      }
      if (!start) return false;
      start = null;
      env.setOverlay(null);
      return true;
    },
  };
}

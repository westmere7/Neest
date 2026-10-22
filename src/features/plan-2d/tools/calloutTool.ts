import { CalloutSchema, type CalloutTarget, type Vec2 } from '@/domain/model/schema';
import { addCallout } from '@/domain/commands/callouts';
import { dist } from '@/domain/geometry/vec';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore } from '@/state/editorStore';
import { useDialogStore, usePrefsStore } from '@/state/uiStores';
import { hitTest } from '../hitTest';
import type { Tool, ToolEnv } from './types';

const DRAG_PX = 5;

/** What a click at `p` points a callout at: the item under it, the room with Alt, otherwise the spot. */
export function calloutTargetAt(env: ToolEnv, p: Vec2, alt: boolean): CalloutTarget {
  const project = env.project();
  const derived = env.derived();
  const item = hitTest(project, derived, p, env.tol(), { objects: true });
  if (item && !alt) return { kind: 'object', objectId: item.id };
  if (alt) {
    const room = hitTest(project, derived, p, env.tol(), { rooms: true });
    if (room) return { kind: 'room', roomId: room.id };
  }
  return { kind: 'point', x: p.x, y: p.y, z: 0 };
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
 * Callout tool: click an item (or a spot) to pin a callout, Alt-click inside a room to pin it to
 * the room, drag to mark an area. The pop-up editor opens at once; the tool then hands back to Select.
 */
export function createCalloutTool(): Tool {
  let start: { world: Vec2; screen: Vec2 } | null = null;
  let dragging = false;
  return {
    id: 'callout',
    cursor: 'crosshair',
    hint: 'Click an item or a spot to pin a note · Alt-click inside a room for the room · drag to mark an area.',
    busy: () => start !== null,
    onPointerDown(e) {
      if (e.button !== 0) return;
      start = { world: e.world, screen: e.screen };
      dragging = false;
    },
    onPointerMove(e, env) {
      if (!start) {
        const t = calloutTargetAt(env, e.world, e.alt);
        useEditorStore.getState().setHover(t.kind === 'object' ? { kind: 'object', id: t.objectId } : t.kind === 'room' ? { kind: 'room', id: t.roomId } : null);
        return;
      }
      if (!dragging && dist(start.screen, e.screen) >= DRAG_PX) dragging = true;
      if (dragging) env.setOverlay({ marquee: { a: start.world, b: e.world } });
    },
    onPointerUp(e, env) {
      const s = start;
      start = null;
      env.setOverlay(null);
      if (!s) return;
      let target: CalloutTarget;
      if (dragging) {
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
      } else target = calloutTargetAt(env, s.world, e.alt);
      useEditorStore.getState().setHover(null);
      createCalloutAt(target, env.px());
      env.finish();
    },
    cancel(env) {
      if (!start) return false;
      start = null;
      env.setOverlay(null);
      return true;
    },
  };
}

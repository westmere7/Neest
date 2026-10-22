import type { Callout, CalloutTarget, Project, Vec2 } from '../model/schema';
import { CalloutSchema } from '../model/schema';
import { newId } from '../model/ids';
import { calloutAnchor } from '../geometry/callouts';
import type { D } from './walls';

/** A new callout's fields; anything left out takes the schema default. */
export type CalloutInput = Partial<Omit<Callout, 'id' | 'target'>> & { target: CalloutTarget };

/** Adds a callout and returns its id. */
export function addCallout(d: D, input: CalloutInput): string {
  const id = newId('call');
  d.callouts ??= {};
  d.callouts[id] = CalloutSchema.parse({ ...input, id });
  return id;
}

export function updateCallout(d: D, id: string, patch: Partial<Omit<Callout, 'id'>>): void {
  const c = d.callouts?.[id];
  if (!c) return;
  Object.assign(c, patch);
}

export function deleteCallouts(d: D, ids: string[]): void {
  for (const id of ids) if (d.callouts?.[id]) delete d.callouts[id];
}

/**
 * Before items or rooms are deleted: notes on a deleted item go with it; notes on a deleted room
 * stay where they were, as spot notes at the room's old label point.
 */
export function detachCallouts(d: D, deletedIds: Set<string>): void {
  for (const c of Object.values(d.callouts ?? {})) {
    const t = c.target;
    if (t.kind === 'object' && deletedIds.has(t.objectId)) {
      delete d.callouts[c.id];
      continue;
    }
    if (!(t.kind === 'room' && deletedIds.has(t.roomId))) continue;
    const a = calloutAnchor(d as unknown as Project, null, t);
    if (a) c.target = { kind: 'point', x: a.x, y: a.y, z: a.z };
  }
}

/** Moves spot and area callouts with a drag (item and room callouts follow their target by themselves). */
export function translateCallouts(d: D, ids: string[], delta: Vec2): void {
  for (const id of ids) {
    const c = d.callouts?.[id];
    if (!c) continue;
    if (c.target.kind === 'point') {
      c.target.x += delta.x;
      c.target.y += delta.y;
    } else if (c.target.kind === 'region') {
      c.target.points = c.target.points.map((p) => ({ x: p.x + delta.x, y: p.y + delta.y }));
    }
  }
}

/** Copies of callouts, shifted by `offset`; returns the new ids. */
export function duplicateCallouts(d: D, ids: string[], offset: Vec2): string[] {
  const out: string[] = [];
  for (const id of ids) {
    const c = d.callouts?.[id];
    if (!c) continue;
    const nid = newId('call');
    // A plain copy: structuredClone cannot copy an immer draft.
    const copy = JSON.parse(JSON.stringify({ ...c, id: nid })) as Callout;
    d.callouts![nid] = copy;
    translateCallouts(d, [nid], offset);
    if (copy.target.kind !== 'point' && copy.target.kind !== 'region') copy.offset = { x: c.offset.x + offset.x, y: c.offset.y + offset.y };
    out.push(nid);
  }
  return out;
}

import type { Op } from './ops';

/**
 * Messages between the app and a live room (cloud/src/room.ts), as JSON over a WebSocket. The project itself is
 * fetched over HTTP first (`GET /rooms/:room/doc`), so socket messages stay small: only changes and presence.
 */

/** What each person shares with the others while connected (not stored). */
export interface Presence {
  /** Pointer on the 2D plan, in plan metres; null when the pointer is elsewhere. */
  cursor?: { x: number; y: number } | null;
  /** Ids of the selected items. */
  sel?: string[];
  /** The layout option this person is looking at. */
  view?: string;
}

export interface Peer {
  id: string;
  name: string;
  color: string;
  p: Presence | null;
}

/** A change batch on the wire: ops without `old` (only the sender's undo needs it). */
export type WireOp = Pick<Op, 'path' | 'value'>;

export type ClientMessage =
  /** First message: who I am and the last change I have (changes after it are sent back). */
  | { t: 'hello'; since: number; name: string; color: string }
  /** My changes; the room gives them the next number and sends them to everyone, me included. */
  | { t: 'ops'; batch: string; ops: WireOp[] }
  | { t: 'presence'; p: Presence };

export type ServerMessage =
  | { t: 'welcome'; you: string; seq: number; peers: Peer[] }
  /** Changes in the room's order; `from` is the sender's connection id, `batch` the sender's batch id. */
  | { t: 'ops'; seq: number; from: string; batch: string; ops: WireOp[] }
  /** Joined, or moved the pointer, changed the selection or the shown option. */
  | ({ t: 'presence' } & Peer)
  | { t: 'leave'; id: string }
  /** The changes since `since` are no longer kept: fetch the project again. */
  | { t: 'reset' }
  | { t: 'error'; message: string };

/** Biggest change batch sent in one message; larger ones are split (Workers accept up to 1 MiB per message). */
export const MAX_MESSAGE_BYTES = 900_000;

/** True when a value looks like a change batch the room can apply (shape only, not the project schema). */
export function isWireOps(ops: unknown): ops is WireOp[] {
  return (
    Array.isArray(ops) &&
    ops.length <= 20_000 &&
    ops.every(
      (o) =>
        o !== null &&
        typeof o === 'object' &&
        Array.isArray((o as WireOp).path) &&
        (o as WireOp).path.length > 0 &&
        (o as WireOp).path.length <= 16 &&
        (o as WireOp).path.every((k) => typeof k === 'string' && k.length > 0 && k.length <= 200 && k !== '__proto__' && k !== 'constructor' && k !== 'prototype'),
    )
  );
}

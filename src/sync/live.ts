import { create } from 'zustand';
import type { Project } from '@/domain/model/schema';
import type { Op } from '@/domain/sync/ops';
import { fromDoc, toDoc, viewedOption, type ProjectDoc } from '@/domain/sync/doc';
import { MAX_MESSAGE_BYTES, type ClientMessage, type Peer, type Presence, type ServerMessage, type WireOp } from '@/domain/sync/protocol';
import { preferenceRepository } from '@/storage/indexeddb/db';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore } from '@/state/editorStore';

/**
 * Live editing (multi-user): a project can be shared to a room on the sync server (cloud/, Cloudflare Workers +
 * Durable Objects). Everyone with the link edits the same project; changes travel as document ops (domain/sync)
 * and the room's order decides. Everything else in Neest works without it: rooms exist only when a sync server
 * is configured (`VITE_NEEST_SYNC_URL`, or `/sync` proxied to `npm run cloud:dev` in development).
 */

/** Where the sync server is, or null when this build has none. */
export const SYNC_URL: string | null =
  (import.meta.env.VITE_NEEST_SYNC_URL as string | undefined) || (import.meta.env.DEV ? '/sync' : null);

export interface LiveRoom {
  room: string;
  key: string;
}

export type LiveStatus = 'off' | 'connecting' | 'live' | 'offline' | 'error';

export interface LiveState {
  status: LiveStatus;
  /** The open project's room (null when it is not shared). */
  room: LiveRoom | null;
  /** This connection's id in the room. */
  you: string | null;
  peers: Record<string, Peer>;
  error: string | null;
  /** Changes waiting for the room to confirm them. */
  pending: number;
}

export const useLiveStore = create<LiveState>(() => ({ status: 'off', room: null, you: null, peers: {}, error: null, pending: 0 }));

// ───────────── Rooms this browser knows (per project; the key never goes into the project or its file) ─────────────

async function rooms(): Promise<Record<string, LiveRoom>> {
  return (await preferenceRepository.get<Record<string, LiveRoom>>('liveRooms')) ?? {};
}
export async function roomFor(projectId: string): Promise<LiveRoom | null> {
  return (await rooms())[projectId] ?? null;
}
export async function rememberRoom(projectId: string, room: LiveRoom | null): Promise<void> {
  const all = await rooms();
  if (room) all[projectId] = room;
  else delete all[projectId];
  await preferenceRepository.set('liveRooms', all);
}

// ───────────── Who I am in rooms ─────────────

const COLORS = ['#e8590c', '#1c7ed6', '#2f9e44', '#c2255c', '#7048e8', '#0c8599', '#e67700', '#5c940d'];
export interface LiveIdentity {
  name: string;
  color: string;
}
export async function liveIdentity(): Promise<LiveIdentity | null> {
  return (await preferenceRepository.get<LiveIdentity>('liveIdentity')) ?? null;
}
export async function setLiveIdentity(name: string): Promise<LiveIdentity> {
  const prev = await liveIdentity();
  const id = { name: name.trim().slice(0, 40) || 'Guest', color: prev?.color ?? COLORS[Math.floor(Math.random() * COLORS.length)] };
  await preferenceRepository.set('liveIdentity', id);
  return id;
}

// ───────────── Server calls ─────────────

function httpBase(): string {
  if (!SYNC_URL) throw new Error('Live editing is not set up in this build.');
  return new URL(SYNC_URL, window.location.href).toString().replace(/\/$/, '');
}

/** The link others open to join (the key stays in the URL fragment, which browsers never send to a server). */
export function liveLink(room: LiveRoom): string {
  return `${window.location.origin}${window.location.pathname}#/live/${room.room}/${room.key}`;
}

/** Shares a project: creates a room holding its current version. */
export async function createRoom(project: Project): Promise<LiveRoom> {
  const res = await fetch(`${httpBase()}/rooms`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ doc: toDoc(project) }) });
  if (!res.ok) throw new Error(`The sync server answered ${res.status}.`);
  const room = (await res.json()) as LiveRoom;
  await rememberRoom(project.id, room);
  return room;
}

/** The room's current project, shown at option `show` (or its first option). */
export async function fetchRoom(room: LiveRoom, show?: string, prev?: Project): Promise<{ seq: number; project: Project }> {
  // A server that does not answer must not keep the editor waiting.
  const res = await fetch(`${httpBase()}/rooms/${room.room}/doc?key=${encodeURIComponent(room.key)}`, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
  if (res.status === 403) throw new Error('This live link is not valid (unknown room or wrong key).');
  if (!res.ok) throw new Error(`The sync server answered ${res.status}.`);
  const { seq, doc } = (await res.json()) as { seq: number; doc: ProjectDoc };
  return { seq, project: fromDoc(doc, show ?? doc.optionOrder[0] ?? 'default', prev) };
}

// ───────────── The session of the open project ─────────────

/** True when `a` is `b` or contains it. */
const covers = (a: string[], b: string[]) => a.length <= b.length && a.every((k, i) => k === b[i]);

interface Batch {
  id: string;
  ops: WireOp[];
  sent: boolean;
}

class LiveSession {
  private ws: WebSocket | null = null;
  private seq = 0;
  private batches: Batch[] = [];
  private stopped = false;
  private retry = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private presenceTimer: ReturnType<typeof setTimeout> | null = null;
  private unsubs: (() => void)[] = [];
  private lastPresence = '';

  constructor(
    private room: LiveRoom,
    private identity: LiveIdentity,
  ) {}

  async start(): Promise<void> {
    useLiveStore.setState({ status: 'connecting', room: this.room, you: null, peers: {}, error: null, pending: 0 });
    const store = useProjectStore.getState();
    const current = store.project;
    try {
      const { seq, project } = await fetchRoom(this.room, current ? viewedOption(current) : undefined, current ?? undefined);
      if (this.stopped) return;
      this.seq = seq;
      // The room is the shared truth: show its version (local history starts afresh).
      store.load(project);
    } catch (e) {
      useLiveStore.setState({ status: 'error', error: e instanceof Error ? e.message : String(e) });
      return;
    }
    this.unsubs.push(useProjectStore.getState().onLocalOps((ops) => this.queue(ops)));
    this.unsubs.push(useEditorStore.subscribe(() => this.schedulePresence()));
    this.unsubs.push(useProjectStore.subscribe((s, prev) => s.project?.activeOptionId !== prev.project?.activeOptionId && this.schedulePresence()));
    this.connect();
  }

  /** A new name or colour: reconnect so the others see it (the project and history stay). */
  rename(identity: LiveIdentity): void {
    this.identity = identity;
    this.ws?.close(1000, 'renamed');
  }

  stop(): void {
    this.stopped = true;
    for (const u of this.unsubs) u();
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.presenceTimer) clearTimeout(this.presenceTimer);
    this.ws?.close(1000, 'closed');
    this.ws = null;
    useLiveStore.setState({ status: 'off', room: null, you: null, peers: {}, error: null, pending: 0 });
  }

  private connect(): void {
    if (this.stopped) return;
    const url = new URL(`${httpBase()}/rooms/${this.room.room}/ws`);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.searchParams.set('key', this.room.key);
    const ws = new WebSocket(url);
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.send({ t: 'hello', since: this.seq, name: this.identity.name, color: this.identity.color });
    };
    ws.onmessage = (e) => {
      try {
        this.receive(JSON.parse(String(e.data)) as ServerMessage);
      } catch {
        /* ignore a malformed message */
      }
    };
    ws.onclose = () => {
      if (this.ws !== ws || this.stopped) return;
      this.ws = null;
      for (const b of this.batches) b.sent = false; // resent after reconnecting (the room drops ones it already has)
      useLiveStore.setState({ status: 'offline', peers: {} });
      const delay = Math.min(15000, 500 * 2 ** this.retry++);
      this.retryTimer = setTimeout(() => this.connect(), delay);
    };
  }

  private send(msg: ClientMessage): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(msg));
    return true;
  }

  /** Local changes → batches (split when large), sent now or after reconnecting. */
  private queue(ops: Op[]): void {
    const wire: WireOp[] = ops.map((o) => (o.value === undefined ? { path: o.path } : { path: o.path, value: o.value }));
    let chunk: WireOp[] = [];
    let size = 0;
    const flush = () => {
      if (!chunk.length) return;
      this.batches.push({ id: crypto.randomUUID(), ops: chunk, sent: false });
      chunk = [];
      size = 0;
    };
    for (const op of wire) {
      const n = JSON.stringify(op).length;
      if (size + n > MAX_MESSAGE_BYTES) flush();
      chunk.push(op);
      size += n;
    }
    flush();
    this.flushBatches();
  }

  private flushBatches(): void {
    if (useLiveStore.getState().status !== 'live') return;
    for (const b of this.batches) if (!b.sent) b.sent = this.send({ t: 'ops', batch: b.id, ops: b.ops });
    useLiveStore.setState({ pending: this.batches.length });
  }

  private receive(msg: ServerMessage): void {
    switch (msg.t) {
      case 'welcome': {
        const peers = Object.fromEntries(msg.peers.map((p) => [p.id, p]));
        useLiveStore.setState({ status: 'live', you: msg.you, peers, error: null });
        this.lastPresence = '';
        this.schedulePresence();
        // Backlog (changes missed while away) arrives next, then unconfirmed own changes go out again.
        queueMicrotask(() => this.flushBatches());
        return;
      }
      case 'ops': {
        this.seq = Math.max(this.seq, msg.seq);
        const i = this.batches.findIndex((b) => b.id === msg.batch);
        if (i >= 0) {
          // My change, now in the room's order. Re-apply it (someone may have replaced what it was inside)
          // except where a later change of mine, not yet confirmed, will overwrite it.
          const [mine] = this.batches.splice(i, 1);
          const later = this.batches.flatMap((b) => b.ops.map((o) => o.path));
          const keep = mine.ops.filter((o) => !later.some((p) => covers(p, o.path)));
          useProjectStore.getState().applyRemote(keep);
          useLiveStore.setState({ pending: this.batches.length });
          return;
        }
        // Someone else's change. Where I have an unconfirmed change on the same property (or around it), mine
        // comes later in the room's order and wins, so theirs is skipped here.
        const mine = this.batches.flatMap((b) => b.ops.map((o) => o.path));
        const apply = msg.ops.filter((o) => !mine.some((p) => covers(p, o.path)));
        useProjectStore.getState().applyRemote(apply);
        return;
      }
      case 'presence': {
        const { t: _t, ...peer } = msg;
        useLiveStore.setState((s) => ({ peers: { ...s.peers, [peer.id]: peer } }));
        return;
      }
      case 'leave':
        useLiveStore.setState((s) => {
          const peers = { ...s.peers };
          delete peers[msg.id];
          return { peers };
        });
        return;
      case 'reset': {
        // Too far behind: take the room's version again.
        const store = useProjectStore.getState();
        void fetchRoom(this.room, store.project ? viewedOption(store.project) : undefined, store.project ?? undefined).then(({ seq, project }) => {
          this.seq = seq;
          this.batches = [];
          useProjectStore.getState().load(project);
          useLiveStore.setState({ pending: 0 });
        });
        return;
      }
      case 'error':
        useLiveStore.setState({ error: msg.message });
        return;
    }
  }

  /** Pointer, selection and shown option, at most every 50 ms and only when changed. */
  private schedulePresence(): void {
    if (this.presenceTimer || this.stopped) return;
    this.presenceTimer = setTimeout(() => {
      this.presenceTimer = null;
      const ed = useEditorStore.getState();
      const project = useProjectStore.getState().project;
      const p: Presence = {
        cursor: ed.cursor ? { x: Math.round(ed.cursor.x * 1000) / 1000, y: Math.round(ed.cursor.y * 1000) / 1000 } : null,
        sel: ed.selection.map((s) => s.id).slice(0, 200),
        view: project ? viewedOption(project) : undefined,
      };
      const text = JSON.stringify(p);
      if (text === this.lastPresence) return;
      if (this.send({ t: 'presence', p })) this.lastPresence = text;
    }, 50);
  }
}

let session: LiveSession | null = null;

/** Joins the open project's room (when it has one in this browser). Returns a stop function. */
export async function startLive(projectId: string): Promise<() => void> {
  stopLive();
  const room = SYNC_URL ? await roomFor(projectId) : null;
  if (!room) return () => undefined;
  const identity = (await liveIdentity()) ?? (await setLiveIdentity('Guest'));
  const s = new LiveSession(room, identity);
  session = s;
  await s.start();
  return () => {
    if (session === s) stopLive();
  };
}

/** Applies a new name to the open live session. */
export function renameLive(identity: LiveIdentity): void {
  session?.rename(identity);
}

export function stopLive(): void {
  session?.stop();
  session = null;
}

/** Stops sharing in this browser: the project stays here as an ordinary local project. */
export async function leaveRoom(projectId: string): Promise<void> {
  stopLive();
  await rememberRoom(projectId, null);
}

/** Opening a live link: fetches the room's project into this browser, remembers the room, returns the project id. */
export async function joinFromLink(room: LiveRoom): Promise<Project> {
  const { project } = await fetchRoom(room);
  await rememberRoom(project.id, room);
  return project;
}

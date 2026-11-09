import { create } from 'zustand';
import type { Project } from '@/domain/model/schema';
import type { Op } from '@/domain/sync/ops';
import { diffProjects, fromDoc, toDoc, viewedOption, type ProjectDoc } from '@/domain/sync/doc';
import { MAX_MESSAGE_BYTES, type ClientMessage, type Peer, type Presence, type ServerMessage, type WireOp } from '@/domain/sync/protocol';
import { preferenceRepository } from '@/storage/indexeddb/db';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore } from '@/state/editorStore';
import { SYNC_URL, authHeaders, httpBase, useAuthStore, type SessionUser } from './auth';

export { SYNC_URL };

/**
 * Live editing (multi-user): a project can be shared to a room on the sync server (cloud/, Cloudflare Workers +
 * Durable Objects) for the team's accounts (./auth). Everyone signed in sees the team's shared projects and edits
 * them together; changes travel as document ops (domain/sync) and the room's order decides. Everything else in
 * Neest works without it: rooms exist only when a sync server is configured (`VITE_NEEST_SYNC_URL`, or `/sync`
 * proxied to `npm run cloud:dev` in development).
 */

export interface LiveRoom {
  room: string;
  key: string;
}

export type LiveStatus = 'off' | 'signin' | 'connecting' | 'live' | 'offline' | 'error';

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
/** Ids of the projects this browser has as shared with the team. */
export async function sharedProjectIds(): Promise<Set<string>> {
  return new Set(Object.keys(await rooms()));
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

// ───────────── Server calls ─────────────

/** The link others open to join (the key stays in the URL fragment, which browsers never send to a server). */
export function liveLink(room: LiveRoom): string {
  return `${window.location.origin}${window.location.pathname}#/live/${room.room}/${room.key}`;
}

/** A message for a failed server call. */
async function failure(res: Response): Promise<Error> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return new Error(res.status === 401 ? 'Please sign in again.' : (body?.error ?? `The sync server answered ${res.status}.`));
}

/** Shares a project with the team: creates a room holding its current version. */
export async function createRoom(project: Project): Promise<LiveRoom> {
  const res = await fetch(`${httpBase()}/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ doc: toDoc(project), name: project.name }),
  });
  if (!res.ok) throw await failure(res);
  const room = (await res.json()) as LiveRoom;
  await rememberRoom(project.id, room);
  return room;
}

/** The room's current project, shown at option `show` (or its first option). */
export async function fetchRoom(room: LiveRoom, show?: string, prev?: Project): Promise<{ seq: number; project: Project }> {
  // A server that does not answer must not keep the editor waiting.
  const res = await fetch(`${httpBase()}/rooms/${room.room}/doc?key=${encodeURIComponent(room.key)}`, { cache: 'no-store', headers: authHeaders(), signal: AbortSignal.timeout(10000) });
  if (res.status === 403) throw new Error('This live link is not valid (unknown room or wrong key).');
  if (!res.ok) throw await failure(res);
  const { seq, doc } = (await res.json()) as { seq: number; doc: ProjectDoc };
  return { seq, project: fromDoc(doc, show ?? doc.optionOrder[0] ?? 'default', prev) };
}

/** A project shared with the team (from the server's list). */
export interface SharedRoom extends LiveRoom {
  name: string;
  /** Login id and display name of whoever shared it. */
  owner: string;
  ownerName?: string;
  createdAt: number;
  /** Who has it open right now (one entry per person). */
  here?: { name: string; color: string }[];
}

export async function listRooms(): Promise<SharedRoom[]> {
  const res = await fetch(`${httpBase()}/rooms`, { headers: authHeaders(), cache: 'no-store', signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw await failure(res);
  return ((await res.json()) as { rooms: SharedRoom[] }).rooms;
}

/** Takes a project off the team's shared list (only whoever shared it). */
export async function removeRoom(room: string): Promise<void> {
  const res = await fetch(`${httpBase()}/rooms/${room}`, { method: 'DELETE', headers: authHeaders() });
  if (!res.ok) throw await failure(res);
}

// ───────────── The session of the open project ─────────────

/** True when `a` is `b` or contains it. */
const covers = (a: string[], b: string[]) => a.length <= b.length && a.every((k, i) => k === b[i]);

/** The room answers a ping with "pong" (cloud/src/room.ts); it drops connections silent for a minute. */
const PING_MS = 20_000;
/** Nothing heard for this long (two pings unanswered): the connection is dead even if the browser has not noticed. */
const DEAD_MS = 45_000;

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
  private pingTimer: ReturnType<typeof setTimeout> | null = null;
  /** When the room was last heard from on the current connection. */
  private lastHeard = 0;
  private presenceTimer: ReturnType<typeof setTimeout> | null = null;
  private unsubs: (() => void)[] = [];
  private lastPresence = '';
  private previewTimer: ReturnType<typeof setTimeout> | null = null;
  /** A preview of my gesture in progress is showing on the others' screens. */
  private previewShown = false;
  /**
   * Others' previews not shown yet: only the newest per person matters (each holds the whole change so far), so
   * they are shown once per frame and older ones are dropped — a slow redraw never builds up a lag.
   */
  private incoming = new Map<string, WireOp[] | null>();
  private incomingScheduled = false;

  constructor(
    private room: LiveRoom,
    private identity: SessionUser,
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
    // A drag or slider in progress shows on the others' screens as it happens (previews, ~25 a second).
    this.unsubs.push(
      useProjectStore.subscribe((s, prev) => {
        if (s.tx && s.project !== prev.project) this.schedulePreview();
        // Gesture over: the finished change (if any) has just been queued, so the "cancelled" note goes after it.
        else if (!s.tx && prev.tx) queueMicrotask(() => this.endPreview());
      }),
    );
    // Back online, or back to this tab after the computer slept: reconnect now instead of at the next retry.
    const wake = () => {
      if (this.stopped) return;
      if (this.ws && Date.now() - this.lastHeard > DEAD_MS) this.lost(this.ws);
      else if (!this.ws) {
        if (this.retryTimer) clearTimeout(this.retryTimer);
        this.retry = 0;
        this.connect();
      }
    };
    const onVisible = () => document.visibilityState === 'visible' && wake();
    window.addEventListener('online', wake);
    document.addEventListener('visibilitychange', onVisible);
    this.unsubs.push(() => window.removeEventListener('online', wake));
    this.unsubs.push(() => document.removeEventListener('visibilitychange', onVisible));
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    for (const u of this.unsubs) u();
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.pingTimer) clearTimeout(this.pingTimer);
    if (this.presenceTimer) clearTimeout(this.presenceTimer);
    if (this.previewTimer) clearTimeout(this.previewTimer);
    this.ws?.close(1000, 'closed');
    this.ws = null;
    useLiveStore.setState({ status: 'off', room: null, you: null, peers: {}, error: null, pending: 0 });
  }

  private connect(): void {
    if (this.stopped) return;
    const url = new URL(`${httpBase()}/rooms/${this.room.room}/ws`);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.searchParams.set('key', this.room.key);
    url.searchParams.set('token', useAuthStore.getState().token ?? '');
    const ws = new WebSocket(url);
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.lastHeard = Date.now();
      this.send({ t: 'hello', since: this.seq, name: this.identity.name, color: this.identity.color });
      this.schedulePing(ws);
    };
    ws.onmessage = (e) => {
      if (this.ws !== ws) return;
      this.lastHeard = Date.now();
      if (e.data === 'pong') return;
      try {
        this.receive(JSON.parse(String(e.data)) as ServerMessage);
      } catch {
        /* ignore a malformed message */
      }
    };
    ws.onclose = () => this.lost(ws);
  }

  /** Keeps the connection known to be alive: pings the room, and gives up on it when nothing comes back. */
  private schedulePing(ws: WebSocket): void {
    if (this.pingTimer) clearTimeout(this.pingTimer);
    this.pingTimer = setTimeout(() => {
      if (this.ws !== ws || this.stopped) return;
      if (Date.now() - this.lastHeard > DEAD_MS) return this.lost(ws);
      try {
        ws.send('ping');
      } catch {
        /* closing */
      }
      this.schedulePing(ws);
    }, PING_MS);
  }

  /** The connection is gone (closed, or silent too long): show offline and reconnect with growing pauses. */
  private lost(ws: WebSocket): void {
    if (this.ws !== ws || this.stopped) return;
    this.ws = null;
    if (this.pingTimer) clearTimeout(this.pingTimer);
    try {
      ws.close(4001, 'No answer');
    } catch {
      /* already closed */
    }
    for (const b of this.batches) b.sent = false; // resent after reconnecting (the room drops ones it already has)
    useLiveStore.setState({ status: 'offline', peers: {} });
    const delay = Math.min(15000, 500 * 2 ** this.retry++);
    this.retryTimer = setTimeout(() => this.connect(), delay);
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
        // Previews from before a reconnect may be stale; the senders' next ones (or finished changes) follow.
        useProjectStore.getState().clearRemotePreviews();
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
        // Their finished change supersedes any preview of theirs still waiting to be shown.
        this.incoming.delete(msg.from);
        useProjectStore.getState().applyRemote(apply, msg.from);
        return;
      }
      case 'preview':
        this.incoming.set(msg.id, msg.ops.length ? msg.ops : null);
        this.scheduleIncoming();
        return;
      case 'presence': {
        const { t: _t, ...peer } = msg;
        useLiveStore.setState((s) => ({ peers: { ...s.peers, [peer.id]: peer } }));
        return;
      }
      case 'leave':
        this.incoming.delete(msg.id);
        useProjectStore.getState().previewRemote(msg.id, null);
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

  private scheduleIncoming(): void {
    if (this.incomingScheduled) return;
    this.incomingScheduled = true;
    const run = () => {
      this.incomingScheduled = false;
      if (this.stopped) return;
      const mine = this.batches.flatMap((b) => b.ops.map((o) => o.path));
      const store = useProjectStore.getState();
      for (const [id, ops] of this.incoming) {
        const show = ops ? ops.filter((o) => !mine.some((p) => covers(p, o.path))) : [];
        store.previewRemote(id, show.length ? show : null);
      }
      this.incoming.clear();
    };
    // Once per frame while the page draws; a hidden or covered window draws no frames, so a timer stands in.
    let done = false;
    const once = () => {
      if (done) return;
      done = true;
      run();
    };
    if (typeof requestAnimationFrame === 'function' && document.visibilityState === 'visible') requestAnimationFrame(once);
    setTimeout(once, 50);
  }

  /** My gesture in progress, as the change from its start, at most every 40 ms. */
  private schedulePreview(): void {
    if (this.previewTimer || this.stopped) return;
    this.previewTimer = setTimeout(() => {
      this.previewTimer = null;
      const { tx, project } = useProjectStore.getState();
      if (!tx || !project) return;
      const ops: WireOp[] = diffProjects(tx.base, project).map((o) => (o.value === undefined ? { path: o.path } : { path: o.path, value: o.value }));
      if (JSON.stringify(ops).length > MAX_MESSAGE_BYTES) return; // too big to preview: the finished change still goes
      if (this.send({ t: 'preview', ops })) this.previewShown = true;
    }, 40);
  }

  /** The gesture ended: a cancelled one is taken off the others' screens (a finished one is replaced by its change). */
  private endPreview(): void {
    if (this.previewTimer) {
      clearTimeout(this.previewTimer);
      this.previewTimer = null;
    }
    if (this.previewShown && this.send({ t: 'preview', ops: [] })) this.previewShown = false;
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
  const user = useAuthStore.getState().user;
  if (!user) {
    // Shared, but not signed in here: the project opens as it is in this browser until someone signs in.
    useLiveStore.setState({ status: 'signin', room, you: null, peers: {}, error: null, pending: 0 });
    return () => useLiveStore.setState({ status: 'off', room: null });
  }
  const s = new LiveSession(room, user);
  session = s;
  await s.start();
  return () => {
    if (session === s) stopLive();
  };
}

export function stopLive(): void {
  session?.stop();
  session = null;
}

// Dev server: when this file changes, the old session must not stay connected beside the new one (it would show
// as another person in the room), so it is stopped and the page reloads.
if (import.meta.hot) {
  import.meta.hot.dispose(() => stopLive());
  import.meta.hot.accept(() => window.location.reload());
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

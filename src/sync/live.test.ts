import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildDemoProject } from '@/features/projects/demoProject';
import { applyOps, deepEqual } from '@/domain/sync/ops';
import { toDoc } from '@/domain/sync/doc';
import type { ClientMessage, ServerMessage, WireOp } from '@/domain/sync/protocol';

/**
 * Two people, each with their own copy of the app (separate module graphs: own project store, own live session),
 * against an in-memory room that follows the same protocol as cloud/src/room.ts. Message delivery is held in
 * queues so tests choose the interleaving.
 */

// Browser preferences: in memory, shared by both "browsers" only through what each writes (keys differ per test).
const prefs = new Map<string, unknown>();
vi.mock('@/storage/indexeddb/db', () => ({
  preferenceRepository: { get: async (k: string) => prefs.get(k), set: async (k: string, v: unknown) => void prefs.set(k, structuredClone(v)) },
  projectRepository: { save: async () => undefined, loadRaw: async () => null },
  blobRepository: { get: async () => null },
}));

class FakeRoom {
  doc: unknown;
  seq = 0;
  log: { seq: number; from: string; batch: string; ops: WireOp[] }[] = [];
  sockets = new Set<FakeSocket>();
  constructor(doc: unknown) {
    this.doc = structuredClone(doc);
  }
  receive(ws: FakeSocket, msg: ClientMessage) {
    if (msg.t === 'hello') {
      ws.ready = true;
      ws.deliver({ t: 'welcome', you: ws.id, seq: this.seq, peers: [] });
      for (const e of this.log) if (e.seq > msg.since) ws.deliver({ t: 'ops', ...e });
      return;
    }
    if (msg.t === 'preview') {
      for (const s of this.sockets) if (s !== ws && s.ready) s.deliver({ t: 'preview', id: ws.id, ops: structuredClone(msg.ops) });
      return;
    }
    if (msg.t === 'ops') {
      if (this.log.some((e) => e.batch === msg.batch)) return;
      this.doc = applyOps(this.doc, msg.ops).doc;
      const e = { seq: ++this.seq, from: ws.id, batch: msg.batch, ops: structuredClone(msg.ops) };
      this.log.push(e);
      for (const s of this.sockets) if (s.ready) s.deliver({ t: 'ops', ...e });
    }
  }
}

let room: FakeRoom;
let nextId = 0;
class FakeSocket {
  static OPEN = 1;
  readyState = 0;
  id = `c${++nextId}`;
  ready = false;
  /** Server → client messages not yet handed to the client. */
  inbox: ServerMessage[] = [];
  /** Client → server messages not yet handed to the room. */
  outbox: ClientMessage[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  constructor(_url: string | URL) {
    room.sockets.add(this);
    sockets.push(this);
    queueMicrotask(() => {
      this.readyState = 1;
      this.onopen?.();
    });
  }
  /** Whose socket this is (from its hello). */
  owner = '';
  send(text: string) {
    const msg = JSON.parse(text) as ClientMessage;
    if (msg.t === 'hello') this.owner = msg.name;
    this.outbox.push(msg);
  }
  deliver(msg: ServerMessage) {
    this.inbox.push(structuredClone(msg));
  }
  close() {
    if (this.readyState === 3) return;
    this.readyState = 3;
    room.sockets.delete(this);
    this.onclose?.();
  }
  /** Moves this socket's messages: client → room, then room → client. */
  pump() {
    while (this.outbox.length && this.readyState === 1) room.receive(this, this.outbox.shift()!);
    while (this.inbox.length && this.readyState === 1) this.onmessage?.({ data: JSON.stringify(this.inbox.shift()) });
  }
}
let sockets: FakeSocket[] = [];

async function person(name: string, projectId: string) {
  vi.resetModules();
  const live = await import('./live');
  const { useProjectStore } = await import('@/state/projectStore');
  const project = buildDemoProject();
  useProjectStore.getState().load({ ...project, id: projectId });
  const auth = await import('./auth');
  auth.useAuthStore.setState({ ready: true, user: { id: name.toLowerCase(), name, color: '#123456' }, token: 'token-' + name });
  await live.startLive(projectId);
  await Promise.resolve();
  /** This person's open socket (the newest, after reconnects). */
  const socket = () => sockets.filter((s) => s.owner === name && s.readyState === 1).at(-1) ?? null;
  return {
    live,
    store: useProjectStore,
    pump: () => socket()?.pump(),
    disconnect: () => socket()?.close(),
    socket,
    doc: () => {
      const d = toDoc(useProjectStore.getState().project!) as Record<string, unknown>;
      delete d.updatedAt;
      return d;
    },
  };
}

describe('live sessions: two people through a room', () => {
  beforeEach(() => {
    prefs.clear();
    sockets = [];
    const p = buildDemoProject();
    room = new FakeRoom(toDoc({ ...p, id: 'prj_live' }));
    vi.stubGlobal('WebSocket', FakeSocket);
    vi.stubGlobal('fetch', async (url: string) => {
      const u = String(url);
      if (u.includes('/doc')) return new Response(JSON.stringify({ seq: room.seq, doc: room.doc }), { status: 200 });
      return new Response('{}', { status: 404 });
    });
    prefs.set('liveRooms', { prj_live: { room: 'roomroom', key: 'keykeykey' } });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  /** Lets everything in flight arrive (several rounds: an echo can trigger more sends). */
  const settle = async (...people: Awaited<ReturnType<typeof person>>[]) => {
    for (let i = 0; i < 6; i++) {
      for (const p of people) p.pump();
      await new Promise((r) => setTimeout(r, 0));
    }
  };

  it('both edit the same property at the same time: everyone ends with the value the room ordered last', async () => {
    const a = await person('Alice', 'prj_live');
    const b = await person('Bob', 'prj_live');
    await settle(a, b);
    const w = Object.keys(a.store.getState().project!.walls)[0];
    a.store.getState().execute('A', (d) => void (d.walls[w].thickness = 0.3));
    b.store.getState().execute('B', (d) => void (d.walls[w].thickness = 0.4));
    // Alice's change reaches the room first, then Bob's; each person meanwhile shows their own value.
    a.socket()!.pump();
    expect(b.store.getState().project!.walls[w].thickness).toBe(0.4);
    await settle(b, a);
    expect(a.store.getState().project!.walls[w].thickness).toBe(0.4);
    expect(b.store.getState().project!.walls[w].thickness).toBe(0.4);
    expect(deepEqual(a.doc(), b.doc())).toBe(true);
  });

  it('one edits a wall while the other deletes it: the wall is gone for both', async () => {
    const a = await person('Alice', 'prj_live');
    const b = await person('Bob', 'prj_live');
    await settle(a, b);
    const w = Object.keys(a.store.getState().project!.walls)[0];
    b.store.getState().execute('Delete', (d) => void delete d.walls[w]);
    b.pump();
    a.store.getState().execute('Edit', (d) => void (d.walls[w].height = 3.3));
    await settle(a, b);
    expect(a.store.getState().project!.walls[w]).toBeUndefined();
    expect(b.store.getState().project!.walls[w]).toBeUndefined();
    expect(deepEqual(a.doc(), b.doc())).toBe(true);
  });

  it('one replaces a whole record while the other changes a field in it: both keep the field change on top', async () => {
    const a = await person('Alice', 'prj_live');
    const b = await person('Bob', 'prj_live');
    await settle(a, b);
    const id = Object.keys(a.store.getState().project!.objects)[0];
    a.store.getState().execute('Field', (d) => void (d.objects[id].rotation = 1));
    b.store.getState().execute('Replace', (d) => void (d.objects[id] = { ...JSON.parse(JSON.stringify(d.objects[id])), x: 9, rotation: 0 }));
    b.pump(); // Bob's replacement is ordered first, Alice's field change second
    await settle(a, b);
    expect(a.store.getState().project!.objects[id].x).toBe(9);
    expect(a.store.getState().project!.objects[id].rotation).toBe(1);
    expect(deepEqual(a.doc(), b.doc())).toBe(true);
  });

  it('changes made while disconnected are sent after reconnecting, once', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const a = await person('Alice', 'prj_live');
    const b = await person('Bob', 'prj_live');
    for (let i = 0; i < 3; i++) {
      a.pump();
      b.pump();
      await Promise.resolve();
    }
    const w = Object.keys(a.store.getState().project!.walls)[1];
    a.disconnect();
    expect(a.live.useLiveStore.getState().status).toBe('offline');
    a.store.getState().execute('Offline', (d) => void (d.walls[w].height = 2.95));
    await vi.advanceTimersByTimeAsync(1000); // reconnect
    for (let i = 0; i < 6; i++) {
      a.pump();
      b.pump();
      await vi.advanceTimersByTimeAsync(10);
    }
    expect(b.store.getState().project!.walls[w].height).toBe(2.95);
    expect(room.log.filter((e) => e.ops.some((o) => o.path.includes(w)))).toHaveLength(1);
    expect(a.live.useLiveStore.getState().pending).toBe(0);
    expect(deepEqual(a.doc(), b.doc())).toBe(true);
  });

  it('a drag shows on the other screen while it happens, then its finished change replaces it', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'] });
    const a = await person('Alice', 'prj_live');
    const b = await person('Bob', 'prj_live');
    const flush = async () => {
      for (let i = 0; i < 4; i++) {
        a.pump();
        b.pump();
        await vi.advanceTimersByTimeAsync(50);
      }
    };
    await flush();
    const w = Object.keys(a.store.getState().project!.walls)[0];
    const start = a.store.getState().project!.walls[w].height;
    const bRevision = b.store.getState().revision;
    a.store.getState().begin('Drag');
    a.store.getState().preview((d) => void (d.walls[w].height = 2.9));
    await flush();
    expect(b.store.getState().project!.walls[w].height).toBe(2.9); // live, before Alice lets go
    expect(b.store.getState().past).toHaveLength(0); // not Bob's undo step
    expect(b.store.getState().revision).toBe(bRevision); // and not saved as Bob's change
    a.store.getState().preview((d) => void (d.walls[w].height = 3.1));
    await flush();
    expect(b.store.getState().project!.walls[w].height).toBe(3.1);
    a.store.getState().commit();
    await flush();
    expect(b.store.getState().project!.walls[w].height).toBe(3.1);
    expect(deepEqual(a.doc(), b.doc())).toBe(true);

    // A drag that ends where it started: no change is sent, and the preview goes away.
    a.store.getState().begin('Drag back');
    a.store.getState().preview((d) => void (d.walls[w].height = 2.5));
    await flush();
    expect(b.store.getState().project!.walls[w].height).toBe(2.5);
    a.store.getState().preview((d) => void (d.walls[w].height = 3.1));
    a.store.getState().commit();
    await flush();
    expect(b.store.getState().project!.walls[w].height).toBe(3.1);

    // A cancelled drag disappears from the other screen.
    a.store.getState().begin('Cancelled');
    a.store.getState().preview((d) => void (d.walls[w].height = 2.2));
    await flush();
    expect(b.store.getState().project!.walls[w].height).toBe(2.2);
    a.store.getState().cancel();
    await flush();
    expect(b.store.getState().project!.walls[w].height).toBe(3.1);
    expect(start).not.toBe(3.1);
    expect(deepEqual(a.doc(), b.doc())).toBe(true);
  });

  it.each([11, 3, 99, 2024, 777])('random edits, undo and redo from both, delivered in random order, converge (seed %i)', async (start) => {
    const a = await person('Alice', 'prj_live');
    const b = await person('Bob', 'prj_live');
    await settle(a, b);
    let seed = start;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const walls = Object.keys(a.store.getState().project!.walls);
    for (let round = 0; round < 60; round++) {
      for (const p of [a, b]) {
        const w = walls[Math.floor(rnd() * walls.length)];
        const r = rnd();
        if (r < 0.35) p.store.getState().execute('t', (d) => void (d.walls[w] && (d.walls[w].thickness = 0.1 + Math.round(rnd() * 20) / 100)));
        else if (r < 0.6) p.store.getState().execute('h', (d) => void (d.walls[w] && (d.walls[w].height = 2.4 + Math.round(rnd() * 10) / 10)));
        else if (r < 0.68) p.store.getState().execute('del', (d) => void delete d.walls[w]);
        else if (r < 0.84) p.store.getState().undo();
        else p.store.getState().redo();
      }
      if (rnd() < 0.4) a.pump();
      if (rnd() < 0.4) b.pump();
      await Promise.resolve();
    }
    await settle(a, b);
    expect(deepEqual(a.doc(), b.doc())).toBe(true);
    const server = structuredClone(room.doc) as Record<string, unknown>;
    delete server.updatedAt;
    expect(deepEqual(a.doc(), server)).toBe(true);
  });
});

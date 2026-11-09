import { DurableObject } from 'cloudflare:workers';
import { applyOps } from '../../src/domain/sync/ops';
import { isWireOps, type ClientMessage, type Peer, type ServerMessage, type WireOp } from '../../src/domain/sync/protocol';

export interface Env {
  ROOMS: DurableObjectNamespace<ProjectRoom>;
  DIRECTORY: DurableObjectNamespace<import('./directory').Directory>;
  GUESTS: DurableObjectNamespace<import('./guest').GuestPage>;
  /** Team accounts (JSON, see auth.ts) and the key that signs sessions: Worker secrets. */
  USERS?: string;
  SESSION_SECRET?: string;
}

/** Per-connection state, kept on the socket so it survives hibernation. */
interface Attachment {
  id: string;
  name: string;
  color: string;
  p: Peer['p'];
  ready: boolean;
  /** Name and colour come from the account. */
  fixed?: boolean;
  /** When this connection last sent something (pings are answered without waking: see the alarm). */
  seen?: number;
  /** Closed by the room for not answering; on its way out. */
  gone?: boolean;
}

/** Snapshot rows hold at most this many characters (SQLite values in a Durable Object are limited to 2 MB). */
const SNAPSHOT_PART = 1_000_000;
/** Changes kept after the last snapshot before a new snapshot is written (people reconnecting replay them). */
const COMPACT_EVERY = 500;
/**
 * Connections that drop without closing (a laptop sleeping, a network change, a phone locking) are only noticed by
 * their silence: apps ping every 20 s (answered "pong" by the runtime, without waking the room), and a check every
 * SWEEP_MS drops connections silent for longer than STALE_MS, so they stop showing as here.
 */
const SWEEP_MS = 30_000;
const STALE_MS = 60_000;

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * One live project: the shared document, the order of everyone's changes, and who is connected. Changes are
 * applied in arrival order (last writer wins per property) and sent to everyone, the sender included, so all
 * copies end up identical. Storage: SQLite (snapshot in parts + the changes since), so it survives restarts and
 * hibernation.
 */
export class ProjectRoom extends DurableObject<Env> {
  private doc: unknown = null;
  private seq = 0;
  private snapSeq = 0;
  private keyHash: string | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    ctx.blockConcurrencyWhile(async () => {
      const sql = ctx.storage.sql;
      sql.exec('CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)');
      sql.exec('CREATE TABLE IF NOT EXISTS snap (i INTEGER PRIMARY KEY, part TEXT)');
      sql.exec('CREATE TABLE IF NOT EXISTS ops (seq INTEGER PRIMARY KEY, sender TEXT, batch TEXT, ops TEXT)');
      const meta = Object.fromEntries(sql.exec<{ k: string; v: string }>('SELECT k, v FROM meta').toArray().map((r) => [r.k, r.v]));
      this.keyHash = meta.keyHash ?? null;
      this.snapSeq = Number(meta.snapSeq ?? 0);
      this.seq = Number(meta.seq ?? 0);
      if (!this.keyHash) return;
      const parts = sql.exec<{ part: string }>('SELECT part FROM snap ORDER BY i').toArray();
      this.doc = JSON.parse(parts.map((r) => r.part).join(''));
      for (const row of sql.exec<{ ops: string }>('SELECT ops FROM ops WHERE seq > ? ORDER BY seq', this.snapSeq)) {
        this.doc = applyOps(this.doc, JSON.parse(row.ops) as WireOp[]).doc;
      }
    });
  }

  private setMeta(k: string, v: string | number) {
    this.ctx.storage.sql.exec('INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v', k, String(v));
  }

  private writeSnapshot() {
    const sql = this.ctx.storage.sql;
    const json = JSON.stringify(this.doc);
    sql.exec('DELETE FROM snap');
    for (let i = 0; i * SNAPSHOT_PART < json.length; i++) sql.exec('INSERT INTO snap (i, part) VALUES (?, ?)', i, json.slice(i * SNAPSHOT_PART, (i + 1) * SNAPSHOT_PART));
    sql.exec('DELETE FROM ops WHERE seq <= ?', this.seq);
    this.snapSeq = this.seq;
    this.setMeta('snapSeq', this.snapSeq);
  }

  /** Creates the room with its first document (once). */
  async init(doc: unknown, keyHash: string): Promise<void> {
    if (this.keyHash) throw new Error('Room already exists');
    this.keyHash = keyHash;
    this.doc = doc;
    this.seq = 0;
    this.setMeta('keyHash', keyHash);
    this.setMeta('seq', 0);
    this.writeSnapshot();
  }

  /** The current document and its change number, for a person with the room's key. */
  async getDoc(keyHash: string): Promise<{ seq: number; doc: unknown } | null> {
    if (!this.keyHash || keyHash !== this.keyHash) return null;
    return { seq: this.seq, doc: this.doc };
  }

  async fetch(request: Request): Promise<Response> {
    const key = new URL(request.url).searchParams.get('key') ?? '';
    if (!this.keyHash || (await sha256(key)) !== this.keyHash) return new Response('Unknown room or wrong key', { status: 403 });
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    this.ctx.acceptWebSocket(server);
    // The Worker vouches for who this is (signed-in account); the hello may not override it.
    let account: { name?: string; color?: string } = {};
    try {
      account = JSON.parse(request.headers.get('X-Neest-User') ?? '{}') as typeof account;
    } catch {
      /* none */
    }
    server.serializeAttachment({
      id: crypto.randomUUID().slice(0, 8),
      name: account.name ?? '',
      color: account.color ?? '',
      p: null,
      ready: false,
      fixed: !!account.name,
      seen: Date.now(),
    } satisfies Attachment);
    if ((await this.ctx.storage.getAlarm()) === null) await this.ctx.storage.setAlarm(Date.now() + SWEEP_MS);
    return new Response(null, { status: 101, webSocket: client });
  }

  private send(ws: WebSocket, msg: ServerMessage) {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      /* closed meanwhile */
    }
  }

  private broadcast(msg: ServerMessage, except?: WebSocket) {
    const text = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except || !(ws.deserializeAttachment() as Attachment | null)?.ready) continue;
      try {
        ws.send(text);
      } catch {
        /* closed meanwhile */
      }
    }
  }

  async webSocketMessage(ws: WebSocket, data: string | ArrayBuffer): Promise<void> {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(typeof data === 'string' ? data : new TextDecoder().decode(data)) as ClientMessage;
    } catch {
      return this.send(ws, { t: 'error', message: 'Not JSON' });
    }
    const att = ws.deserializeAttachment() as Attachment;
    if (att.gone) return;
    att.seen = Date.now();
    ws.serializeAttachment(att);
    if (msg.t === 'hello') {
      if (!att.fixed) {
        att.name = String(msg.name ?? '').slice(0, 40) || 'Guest';
        att.color = /^#[0-9a-f]{6}$/i.test(msg.color) ? msg.color : '#3b82f6';
      }
      att.ready = true;
      ws.serializeAttachment(att);
      const peers = this.ctx
        .getWebSockets()
        .filter((o) => o !== ws)
        .map((o) => o.deserializeAttachment() as Attachment)
        .filter((a) => a?.ready && !a.gone)
        .map(({ id, name, color, p }) => ({ id, name, color, p }));
      this.send(ws, { t: 'welcome', you: att.id, seq: this.seq, peers });
      const since = Number(msg.since) || 0;
      if (since < this.snapSeq) this.send(ws, { t: 'reset' });
      else
        for (const row of this.ctx.storage.sql.exec<{ seq: number; sender: string; batch: string; ops: string }>(
          'SELECT seq, sender, batch, ops FROM ops WHERE seq > ? ORDER BY seq',
          since,
        ))
          this.send(ws, { t: 'ops', seq: row.seq, from: row.sender, batch: row.batch, ops: JSON.parse(row.ops) as WireOp[] });
      this.broadcast({ t: 'presence', id: att.id, name: att.name, color: att.color, p: att.p }, ws);
      return;
    }
    if (!att.ready) return this.send(ws, { t: 'error', message: 'Say hello first' });
    if (msg.t === 'ops') {
      if (!isWireOps(msg.ops) || typeof msg.batch !== 'string') return this.send(ws, { t: 'error', message: 'Malformed changes' });
      // A batch resent after a reconnect that had already arrived: it was sent to everyone then (and is in the
      // backlog the sender just got), so it is not applied twice.
      if (this.ctx.storage.sql.exec('SELECT seq FROM ops WHERE batch = ? LIMIT 1', msg.batch.slice(0, 64)).toArray().length) return;
      this.doc = applyOps(this.doc, msg.ops).doc;
      this.seq += 1;
      this.ctx.storage.sql.exec('INSERT INTO ops (seq, sender, batch, ops) VALUES (?, ?, ?, ?)', this.seq, att.id, msg.batch.slice(0, 64), JSON.stringify(msg.ops));
      this.setMeta('seq', this.seq);
      this.broadcast({ t: 'ops', seq: this.seq, from: att.id, batch: msg.batch.slice(0, 64), ops: msg.ops });
      if (this.seq - this.snapSeq >= COMPACT_EVERY) this.writeSnapshot();
      return;
    }
    if (msg.t === 'preview') {
      // Relayed as it comes, never stored or numbered: only the finished change (ops) counts.
      if (!isWireOps(msg.ops)) return;
      this.broadcast({ t: 'preview', id: att.id, ops: msg.ops }, ws);
      return;
    }
    if (msg.t === 'presence') {
      att.p = msg.p && typeof msg.p === 'object' ? msg.p : null;
      ws.serializeAttachment(att);
      this.broadcast({ t: 'presence', id: att.id, name: att.name, color: att.color, p: att.p }, ws);
    }
  }

  /** Drops connections that have gone silent (see STALE_MS); runs while anyone is connected. */
  async alarm(): Promise<void> {
    const now = Date.now();
    let open = 0;
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() as Attachment | null;
      if (!att || att.gone) continue;
      const pong = this.ctx.getWebSocketAutoResponseTimestamp(ws)?.getTime() ?? 0;
      if (now - Math.max(att.seen ?? 0, pong) <= STALE_MS) {
        open++;
        continue;
      }
      if (att.ready) this.broadcast({ t: 'leave', id: att.id }, ws);
      att.ready = false;
      att.gone = true;
      ws.serializeAttachment(att);
      try {
        ws.close(4000, 'No answer');
      } catch {
        /* already closed */
      }
    }
    if (open) await this.ctx.storage.setAlarm(now + SWEEP_MS);
  }

  async webSocketClose(ws: WebSocket, code: number): Promise<void> {
    const att = ws.deserializeAttachment() as Attachment | null;
    if (att?.ready) this.broadcast({ t: 'leave', id: att.id }, ws);
    try {
      ws.close(code === 1005 ? 1000 : code, 'bye');
    } catch {
      /* already closed */
    }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws, 1011);
  }
}

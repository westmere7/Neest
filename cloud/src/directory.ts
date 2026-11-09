import { DurableObject } from 'cloudflare:workers';

/** A project shared with the team. */
export interface SharedRoom {
  room: string;
  key: string;
  name: string;
  /** Login id of the person who shared it. */
  owner: string;
  createdAt: number;
}

/** Wrong passwords allowed per account within the window before sign-in is refused for the rest of it. */
const MAX_FAILURES = 10;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;

/**
 * The team's directory (one instance): which projects are shared, and failed sign-ins per account (so a
 * password cannot be guessed endlessly). SQLite storage.
 */
export class Directory extends DurableObject {
  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env);
    ctx.storage.sql.exec(
      'CREATE TABLE IF NOT EXISTS rooms (room TEXT PRIMARY KEY, key TEXT, name TEXT, owner TEXT, createdAt INTEGER)',
    );
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS failures (user TEXT, at INTEGER)');
  }

  async addRoom(r: SharedRoom): Promise<void> {
    this.ctx.storage.sql.exec(
      'INSERT OR REPLACE INTO rooms (room, key, name, owner, createdAt) VALUES (?, ?, ?, ?, ?)',
      r.room,
      r.key,
      r.name.slice(0, 120),
      r.owner,
      r.createdAt,
    );
  }

  async listRooms(): Promise<SharedRoom[]> {
    return this.ctx.storage.sql.exec<Record<string, string | number>>('SELECT room, key, name, owner, createdAt FROM rooms ORDER BY createdAt DESC').toArray() as unknown as SharedRoom[];
  }

  async getRoom(room: string): Promise<SharedRoom | null> {
    return (this.ctx.storage.sql.exec('SELECT room, key, name, owner, createdAt FROM rooms WHERE room = ?', room).toArray()[0] as unknown as SharedRoom) ?? null;
  }

  async renameRoom(room: string, name: string): Promise<void> {
    this.ctx.storage.sql.exec('UPDATE rooms SET name = ? WHERE room = ?', name.slice(0, 120), room);
  }

  /** Removes a project from the shared list (only whoever shared it). */
  async removeRoom(room: string, user: string): Promise<boolean> {
    const r = await this.getRoom(room);
    if (!r || r.owner !== user) return false;
    this.ctx.storage.sql.exec('DELETE FROM rooms WHERE room = ?', room);
    return true;
  }

  /** True while the account may try to sign in. */
  async mayTry(user: string, now = Date.now()): Promise<boolean> {
    this.ctx.storage.sql.exec('DELETE FROM failures WHERE at < ?', now - FAILURE_WINDOW_MS);
    const n = this.ctx.storage.sql.exec('SELECT COUNT(*) AS n FROM failures WHERE user = ?', user).one().n as number;
    return n < MAX_FAILURES;
  }

  async recordFailure(user: string, now = Date.now()): Promise<void> {
    this.ctx.storage.sql.exec('INSERT INTO failures (user, at) VALUES (?, ?)', user, now);
  }

  async clearFailures(user: string): Promise<void> {
    this.ctx.storage.sql.exec('DELETE FROM failures WHERE user = ?', user);
  }
}

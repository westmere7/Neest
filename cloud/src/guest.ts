import { DurableObject } from 'cloudflare:workers';

/** Stored rows hold at most this many bytes (SQLite values in a Durable Object are limited to 2 MB). */
const PART = 1_000_000;

/** A guest link's address part: the guest title in plain letters plus a few characters of the project id. */
export const GUEST_SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** Gzip streams start with these two bytes. */
export const isGzip = (bytes: Uint8Array) => bytes.length > 18 && bytes[0] === 0x1f && bytes[1] === 0x8b;

const NOT_FOUND = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Walkthrough not found</title><body style="font:16px system-ui,sans-serif;display:grid;place-items:center;min-height:90vh;margin:0;color:#444;background:#f6f5f2">
<p>This walkthrough is no longer shared. Ask for a new link.</p></body>`;

/**
 * One guest walkthrough behind a public link (`/g/<slug>/`): a single self-contained HTML page, stored gzipped in
 * parts. Team members publish, update and take it down from the Export pane; anyone with the link can view it.
 */
export class GuestPage extends DurableObject {
  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env);
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS parts (i INTEGER PRIMARY KEY, data BLOB)');
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)');
  }

  private meta(): { at?: string; by?: string; size?: string } {
    return Object.fromEntries(this.ctx.storage.sql.exec<{ k: string; v: string }>('SELECT k, v FROM meta').toArray().map((r) => [r.k, r.v]));
  }

  /** Replaces the page with a gzipped HTML file (sent as a stream: no message size limit); null if it isn't gzip. */
  async put(gz: ReadableStream<Uint8Array>, by: string): Promise<{ at: number } | null> {
    const bytes = new Uint8Array(await new Response(gz).arrayBuffer());
    if (!isGzip(bytes)) return null;
    const at = Date.now();
    this.ctx.storage.transactionSync(() => {
      const sql = this.ctx.storage.sql;
      sql.exec('DELETE FROM parts');
      for (let i = 0; i * PART < bytes.length; i++) sql.exec('INSERT INTO parts (i, data) VALUES (?, ?)', i, bytes.slice(i * PART, (i + 1) * PART));
      for (const [k, v] of Object.entries({ at, by, size: bytes.length })) sql.exec('INSERT OR REPLACE INTO meta (k, v) VALUES (?, ?)', k, String(v));
    });
    return { at };
  }

  /** Takes the page down; false when there was none. */
  async remove(): Promise<boolean> {
    const had = this.meta().at !== undefined;
    this.ctx.storage.sql.exec('DELETE FROM parts');
    this.ctx.storage.sql.exec('DELETE FROM meta');
    return had;
  }

  /** Who published it and when, or null. */
  async info(): Promise<{ at: number; by: string; size: number } | null> {
    const m = this.meta();
    return m.at ? { at: Number(m.at), by: m.by ?? '', size: Number(m.size ?? 0) } : null;
  }

  /** Serves the page (GET / HEAD): gzipped as stored, revalidated with its publish time. */
  async fetch(request: Request): Promise<Response> {
    const m = this.meta();
    const base = { 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' };
    if (!m.at) return new Response(NOT_FOUND, { status: 404, headers: { ...base, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
    const etag = `"${m.at}"`;
    const headers = { ...base, ETag: etag, 'Cache-Control': 'no-cache, no-transform', 'Content-Type': 'text/html; charset=utf-8' };
    // Cloudflare's edge hands the tag back weak (W/) when it passes the page on compressed.
    const asked = (request.headers.get('If-None-Match') ?? '').split(',').map((t) => t.trim().replace(/^W\//, ''));
    if (asked.includes(etag)) return new Response(null, { status: 304, headers });
    const full = { ...headers, 'Content-Encoding': 'gzip' };
    if (request.method === 'HEAD') return new Response(null, { headers: full, encodeBody: 'manual' });
    const sql = this.ctx.storage.sql;
    const count = sql.exec<{ n: number }>('SELECT COUNT(*) AS n FROM parts').one().n;
    let i = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (i >= count) return controller.close();
        const row = sql.exec<{ data: ArrayBuffer }>('SELECT data FROM parts WHERE i = ?', i++).one();
        controller.enqueue(new Uint8Array(row.data));
      },
    });
    return new Response(body, { headers: full, encodeBody: 'manual' });
  }
}

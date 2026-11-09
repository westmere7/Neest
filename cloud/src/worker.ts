import { ProjectRoom, sha256, type Env } from './room';

export { ProjectRoom };

/**
 * Neest live rooms (multi-user editing), on Cloudflare Workers + Durable Objects.
 *
 *   POST /rooms                 { doc }        → { room, key }   create a room from a project document
 *   GET  /rooms/:room/doc?key=                 → { seq, doc }    the current document
 *   GET  /rooms/:room/ws?key=   (WebSocket)                      live changes and presence
 *   GET  /health
 *
 * Access is by link: whoever has the room id and its key can edit (the room stores only the key's hash).
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};
const MAX_DOC_BYTES = 20 * 1024 * 1024;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS } });

/** Random id from an unambiguous alphabet. */
function randomId(length: number): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
}

const ROOM_ID = /^[a-z0-9]{8,32}$/;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] === 'sync') parts.shift(); // served under /sync by the dev proxy and on a shared domain

    if (parts.length === 1 && parts[0] === 'health') return json({ ok: true });

    if (parts.length === 1 && parts[0] === 'rooms' && request.method === 'POST') {
      const size = Number(request.headers.get('Content-Length') ?? 0);
      if (size > MAX_DOC_BYTES) return json({ error: 'Project too large' }, 413);
      let body: { doc?: unknown };
      try {
        body = (await request.json()) as { doc?: unknown };
      } catch {
        return json({ error: 'Expected JSON' }, 400);
      }
      if (!body.doc || typeof body.doc !== 'object' || Array.isArray(body.doc)) return json({ error: 'Missing project' }, 400);
      const room = randomId(16);
      const key = randomId(24);
      await env.ROOMS.get(env.ROOMS.idFromName(room)).init(body.doc, await sha256(key));
      return json({ room, key });
    }

    if (parts.length === 3 && parts[0] === 'rooms' && ROOM_ID.test(parts[1])) {
      const stub = env.ROOMS.get(env.ROOMS.idFromName(parts[1]));
      if (parts[2] === 'doc' && request.method === 'GET') {
        const found = await stub.getDoc(await sha256(url.searchParams.get('key') ?? ''));
        return found ? json(found) : json({ error: 'Unknown room or wrong key' }, 403);
      }
      if (parts[2] === 'ws') return stub.fetch(request);
    }

    return json({ error: 'Not found' }, 404);
  },
} satisfies ExportedHandler<Env>;

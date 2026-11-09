import { ProjectRoom, sha256, type Env } from './room';
import { Directory } from './directory';
import { parseAccounts, sessionUser, signToken, verifyPassword, verifyToken, type SessionUser } from './auth';

export { ProjectRoom, Directory };

/**
 * Neest live editing on Cloudflare Workers + Durable Objects, for the team's accounts.
 *
 *   POST   /auth/login            { user, password }  → { token, user }
 *   GET    /auth/me                                   → { user }
 *   GET    /rooms                                     → { rooms }   projects shared with the team
 *   POST   /rooms                 { doc, name }       → { room, key }
 *   DELETE /rooms/:room                               (only whoever shared it)
 *   GET    /rooms/:room/doc?key=                      → { seq, doc }
 *   GET    /rooms/:room/ws?key=&token=  (WebSocket)   live changes and presence
 *   GET    /health
 *
 * Every route but login and health needs a session (Authorization: Bearer <token>, or ?token= for the
 * WebSocket, which browsers cannot give headers). The room key stays as a second check on links.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

async function signedIn(request: Request, env: Env): Promise<SessionUser | null> {
  const url = new URL(request.url);
  const header = request.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : (url.searchParams.get('token') ?? '');
  if (!token || !env.SESSION_SECRET) return null;
  const id = await verifyToken(token, env.SESSION_SECRET);
  const account = id ? parseAccounts(env.USERS)[id] : undefined;
  return id && account ? sessionUser(id, account) : null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] === 'sync') parts.shift(); // served under /sync by the dev proxy
    const directory = env.DIRECTORY.get(env.DIRECTORY.idFromName('team'));

    if (parts.length === 1 && parts[0] === 'health') return json({ ok: true });

    if (parts.join('/') === 'auth/login' && request.method === 'POST') {
      let body: { user?: unknown; password?: unknown };
      try {
        body = (await request.json()) as typeof body;
      } catch {
        return json({ error: 'Expected JSON' }, 400);
      }
      const id = String(body.user ?? '').trim().toLowerCase();
      const account = parseAccounts(env.USERS)[id];
      if (!account || !env.SESSION_SECRET) return json({ error: 'Wrong name or password.' }, 401);
      if (!(await directory.mayTry(id))) return json({ error: 'Too many wrong passwords. Try again in 15 minutes.' }, 429);
      if (!(await verifyPassword(String(body.password ?? ''), account.hash))) {
        await directory.recordFailure(id);
        return json({ error: 'Wrong name or password.' }, 401);
      }
      await directory.clearFailures(id);
      return json({ token: await signToken(id, env.SESSION_SECRET), user: sessionUser(id, account) });
    }

    const user = await signedIn(request, env);
    if (!user) return json({ error: 'Please sign in.' }, 401);

    if (parts.join('/') === 'auth/me') return json({ user });

    if (parts.length === 1 && parts[0] === 'rooms') {
      if (request.method === 'GET') {
        const accounts = parseAccounts(env.USERS);
        const rooms = (await directory.listRooms()).map((r) => ({ ...r, ownerName: accounts[r.owner]?.name ?? r.owner }));
        return json({ rooms });
      }
      if (request.method === 'POST') {
        const size = Number(request.headers.get('Content-Length') ?? 0);
        if (size > MAX_DOC_BYTES) return json({ error: 'Project too large' }, 413);
        let body: { doc?: unknown; name?: unknown };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return json({ error: 'Expected JSON' }, 400);
        }
        if (!body.doc || typeof body.doc !== 'object' || Array.isArray(body.doc)) return json({ error: 'Missing project' }, 400);
        const room = randomId(16);
        const key = randomId(24);
        await env.ROOMS.get(env.ROOMS.idFromName(room)).init(body.doc, await sha256(key));
        await directory.addRoom({ room, key, name: String(body.name ?? 'Untitled'), owner: user.id, createdAt: Date.now() });
        return json({ room, key });
      }
    }

    if (parts.length === 2 && parts[0] === 'rooms' && ROOM_ID.test(parts[1]) && request.method === 'DELETE') {
      return (await directory.removeRoom(parts[1], user.id)) ? json({ ok: true }) : json({ error: 'Only whoever shared it can remove it.' }, 403);
    }

    if (parts.length === 3 && parts[0] === 'rooms' && ROOM_ID.test(parts[1])) {
      const stub = env.ROOMS.get(env.ROOMS.idFromName(parts[1]));
      if (parts[2] === 'doc' && request.method === 'GET') {
        const found = await stub.getDoc(await sha256(url.searchParams.get('key') ?? ''));
        return found ? json(found) : json({ error: 'Unknown room or wrong key' }, 403);
      }
      if (parts[2] === 'ws') {
        // The room shows people by their account, whatever their app says.
        const headers = new Headers(request.headers);
        headers.set('X-Neest-User', JSON.stringify({ name: user.name, color: user.color }));
        return stub.fetch(new Request(request, { headers }));
      }
    }

    return json({ error: 'Not found' }, 404);
  },
} satisfies ExportedHandler<Env>;

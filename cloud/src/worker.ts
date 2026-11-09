import { ProjectRoom, sha256, type Env } from './room';
import { Directory } from './directory';
import { GUEST_SLUG, GuestPage, MAX_PIECE_BYTES, PIECE_NAME } from './guest';
import { MIN_PASSWORD, hashPassword, parseAccounts, readToken, sessionUser, signToken, verifyPassword, type SessionUser } from './auth';

export { ProjectRoom, Directory, GuestPage };

/**
 * Neest live editing on Cloudflare Workers + Durable Objects, for the team's accounts.
 *
 *   POST   /auth/login            { user, password }  → { token, user }
 *   GET    /auth/me                                   → { user }
 *   POST   /auth/password  { current, next, signOutOthers } → { token }
 *   POST   /auth/signout-others                       → { token }   ends the account's other sessions
 *   GET    /rooms                                     → { rooms }   projects shared with the team, with who is in each
 *   POST   /rooms                 { doc, name }       → { room, key }
 *   DELETE /rooms/:room                               (only whoever shared it)
 *   GET    /rooms/:room/doc?key=                      → { seq, doc }
 *   GET    /rooms/:room/ws?key=&token=  (WebSocket)   live changes and presence
 *   POST   /guest/:slug/missing  { pieces }          → { missing }   model pieces the link does not have yet
 *   PUT    /guest/:slug/p/:name   body = gzipped piece  → { ok }
 *   PUT    /guest/:slug   body = gzipped guest HTML, X-Neest-Pieces: the pieces it uses → { url, at } (409 { missing })
 *   GET    /guest/:slug                       → { page }    who published it and when (null if none)
 *   DELETE /guest/:slug                       → { ok }      takes the link down
 *   GET    /g/:slug/  and  /g/:slug/p/:name   the guest walkthrough and its model pieces, public (anyone with the link)
 *   GET    /health
 *
 * Every route but login, health and /g/ needs a session (Authorization: Bearer <token>, or ?token= for the
 * WebSocket, which browsers cannot give headers). The room key stays as a second check on links.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Neest-Pieces',
  'Access-Control-Max-Age': '86400',
};
const MAX_DOC_BYTES = 20 * 1024 * 1024;
/** Largest gzipped guest page accepted (Workers on the Free plan take request bodies up to 100 MB). */
const MAX_GUEST_BYTES = 95 * 1024 * 1024;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS } });

/** Random id from an unambiguous alphabet. */
function randomId(length: number): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
}

const ROOM_ID = /^[a-z0-9]{8,32}$/;

async function signedIn(request: Request, env: Env, directory: DurableObjectStub<Directory>): Promise<SessionUser | null> {
  const url = new URL(request.url);
  const header = request.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : (url.searchParams.get('token') ?? '');
  if (!token || !env.SESSION_SECRET) return null;
  const t = await readToken(token, env.SESSION_SECRET);
  const account = t ? parseAccounts(env.USERS)[t.user] : undefined;
  if (!t || !account) return null;
  // Signed out on other devices (or the password changed with that option) since this token was made.
  if (t.version !== (await directory.sessionVersion(t.user))) return null;
  return sessionUser(t.user, account);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] === 'sync') parts.shift(); // served under /sync by the dev proxy
    const directory = env.DIRECTORY.get(env.DIRECTORY.idFromName('team'));

    if (parts.length === 1 && parts[0] === 'health') return json({ ok: true });

    // Guest walkthroughs: public, no session.
    if (parts[0] === 'g' && parts.length === 2 && GUEST_SLUG.test(parts[1]) && (request.method === 'GET' || request.method === 'HEAD')) {
      if (!url.pathname.endsWith('/')) return Response.redirect(`${url.origin}${url.pathname}/`, 301);
      return env.GUESTS.get(env.GUESTS.idFromName(parts[1])).fetch(request);
    }
    if (parts[0] === 'g' && parts.length === 4 && GUEST_SLUG.test(parts[1]) && parts[2] === 'p' && PIECE_NAME.test(parts[3]) && (request.method === 'GET' || request.method === 'HEAD'))
      return env.GUESTS.get(env.GUESTS.idFromName(parts[1])).fetch(request);

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
      if (!(await verifyPassword(String(body.password ?? ''), await directory.passwordHash(id, account.hash)))) {
        await directory.recordFailure(id);
        return json({ error: 'Wrong name or password.' }, 401);
      }
      await directory.clearFailures(id);
      const version = await directory.sessionVersion(id);
      return json({ token: await signToken(id, env.SESSION_SECRET, Date.now(), version), user: sessionUser(id, account) });
    }

    const user = await signedIn(request, env, directory);
    if (!user) return json({ error: 'Please sign in.' }, 401);

    if (parts.join('/') === 'auth/me') return json({ user });

    if (parts.join('/') === 'auth/password' && request.method === 'POST') {
      let body: { current?: unknown; next?: unknown; signOutOthers?: unknown };
      try {
        body = (await request.json()) as typeof body;
      } catch {
        return json({ error: 'Expected JSON' }, 400);
      }
      const account = parseAccounts(env.USERS)[user.id];
      const next = String(body.next ?? '');
      if (!account || !env.SESSION_SECRET) return json({ error: 'Please sign in.' }, 401);
      if (next.length < MIN_PASSWORD || next.length > 128) return json({ error: `The new password needs at least ${MIN_PASSWORD} characters.` }, 400);
      if (!(await directory.mayTry(user.id))) return json({ error: 'Too many wrong passwords. Try again in 15 minutes.' }, 429);
      if (!(await verifyPassword(String(body.current ?? ''), await directory.passwordHash(user.id, account.hash)))) {
        await directory.recordFailure(user.id);
        return json({ error: 'The current password is not right.' }, 403);
      }
      await directory.clearFailures(user.id);
      await directory.setPasswordHash(user.id, await hashPassword(next), account.hash);
      const version = body.signOutOthers === true ? await directory.endSessions(user.id) : await directory.sessionVersion(user.id);
      return json({ token: await signToken(user.id, env.SESSION_SECRET, Date.now(), version) });
    }

    if (parts.join('/') === 'auth/signout-others' && request.method === 'POST') {
      if (!env.SESSION_SECRET) return json({ error: 'Please sign in.' }, 401);
      const version = await directory.endSessions(user.id);
      return json({ token: await signToken(user.id, env.SESSION_SECRET, Date.now(), version) });
    }

    if (parts.length === 1 && parts[0] === 'rooms') {
      if (request.method === 'GET') {
        const accounts = parseAccounts(env.USERS);
        const rooms = await Promise.all(
          (await directory.listRooms()).map(async (r) => ({
            ...r,
            ownerName: accounts[r.owner]?.name ?? r.owner,
            here: await env.ROOMS.get(env.ROOMS.idFromName(r.room))
              .here()
              .catch(() => []),
          })),
        );
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

    if (parts.length === 3 && parts[0] === 'guest' && GUEST_SLUG.test(parts[1]) && parts[2] === 'missing' && request.method === 'POST') {
      let body: { pieces?: unknown };
      try {
        body = (await request.json()) as typeof body;
      } catch {
        return json({ error: 'Expected JSON' }, 400);
      }
      const names = Array.isArray(body.pieces) ? body.pieces.filter((n): n is string => typeof n === 'string' && PIECE_NAME.test(n)) : [];
      if (names.length > 5000) return json({ error: 'Too many pieces' }, 413);
      return json({ missing: await env.GUESTS.get(env.GUESTS.idFromName(parts[1])).missing(names) });
    }

    if (parts.length === 4 && parts[0] === 'guest' && GUEST_SLUG.test(parts[1]) && parts[2] === 'p' && PIECE_NAME.test(parts[3]) && request.method === 'PUT') {
      if (Number(request.headers.get('Content-Length') ?? 0) > MAX_PIECE_BYTES) return json({ error: 'Piece too large' }, 413);
      if (!request.body) return json({ error: 'Missing piece' }, 400);
      const ok = await env.GUESTS.get(env.GUESTS.idFromName(parts[1])).putPiece(parts[3], request.body);
      return ok ? json({ ok: true }) : json({ error: 'Expected a gzipped piece under 1.2 MB' }, 400);
    }

    if (parts.length === 2 && parts[0] === 'guest' && GUEST_SLUG.test(parts[1])) {
      const page = env.GUESTS.get(env.GUESTS.idFromName(parts[1]));
      if (request.method === 'GET') return json({ page: await page.info() });
      if (request.method === 'DELETE') {
        await page.remove();
        return json({ ok: true });
      }
      if (request.method === 'PUT') {
        const size = Number(request.headers.get('Content-Length') ?? 0);
        if (size > MAX_GUEST_BYTES) return json({ error: 'The walkthrough is too large to publish (over 95 MB compressed).' }, 413);
        if (!request.body) return json({ error: 'Missing page' }, 400);
        const pieces = (request.headers.get('X-Neest-Pieces') ?? '').split(',').filter((n) => PIECE_NAME.test(n));
        const done = await page.put(request.body, user.id, pieces);
        if (!done) return json({ error: 'Expected a gzipped page' }, 400);
        if ('missing' in done) return json({ error: 'Some model pieces have not been sent', missing: done.missing }, 409);
        return json({ url: `${url.origin}/g/${parts[1]}/`, at: done.at });
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

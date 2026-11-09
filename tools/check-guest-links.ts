// `npx vite-node --config tools/vite.tools.config.ts tools/check-guest-links.ts -- <guest html file> [server]`
// End-to-end check of guest links on a room server (default: the local one, `npm run cloud:dev`): publish a page,
// read it back byte for byte, revalidate, refuse without a session, take it down. Signs a session with the server's
// key (cloud/.dev.vars for the local server, cloud/.secrets.json otherwise), so it runs on Danh's PC only.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { signToken } from '../cloud/src/auth';

const args = process.argv.slice(2).filter((a) => a !== '--');
const file = args[0];
const server = (args[1] ?? 'http://127.0.0.1:8787').replace(/\/$/, '');
if (!file) throw new Error('Usage: check-guest-links <guest html file> [server]');
const root = resolve(import.meta.dirname, '..');
const local = /127\.0\.0\.1|localhost/.test(server);
const secret = local
  ? readFileSync(resolve(root, 'cloud/.dev.vars'), 'utf8').match(/^SESSION_SECRET=(.+)$/m)?.[1]?.trim()
  : (JSON.parse(readFileSync(resolve(root, 'cloud/.secrets.json'), 'utf8')) as { SESSION_SECRET: string }).SESSION_SECRET;
if (!secret) throw new Error('No signing key.');

let auth = '';
for (let v = 0; v < 100 && !auth; v++) {
  const token = await signToken('danh', secret, Date.now(), v);
  if ((await fetch(`${server}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })).ok) auth = `Bearer ${token}`;
}
if (!auth) throw new Error('No session.');

const slug = 'check-guest-zz9zz';
const html = readFileSync(resolve(file));
const gz = gzipSync(html);
const ok = (cond: unknown, what: string) => {
  if (!cond) throw new Error(`FAILED: ${what}`);
  console.log(`ok  ${what}`);
};

ok((await fetch(`${server}/guest/${slug}`, { method: 'PUT', body: gz })).status === 401, 'publishing needs a session');
ok((await fetch(`${server}/guest/${slug}`, { method: 'PUT', headers: { Authorization: auth }, body: html.subarray(0, 4096) })).status === 400, 'a page that is not gzipped is refused');

let t = Date.now();
const put = await fetch(`${server}/guest/${slug}`, { method: 'PUT', headers: { Authorization: auth, 'Content-Type': 'application/gzip' }, body: gz });
const body = (await put.json()) as { url?: string; at?: number };
ok(put.ok && body.url?.endsWith(`/g/${slug}/`), `published ${(html.length / 1e6).toFixed(1)} MB (${(gz.length / 1e6).toFixed(1)} MB gzipped) in ${Date.now() - t} ms → ${body.url}`);

t = Date.now();
const get = await fetch(`${server}/g/${slug}/`, { headers: { 'Accept-Encoding': 'gzip' }, decompress: false } as RequestInit);
const raw = Buffer.from(await get.arrayBuffer());
const bytes = get.headers.get('content-encoding') === 'gzip' && raw[0] === 0x1f ? gunzipSync(raw) : raw;
ok(get.ok && bytes.equals(html), `the link serves the same page (${get.headers.get('content-type')}, ${Date.now() - t} ms)`);
ok(get.headers.get('x-robots-tag')?.includes('noindex'), 'kept out of search engines');
const etag = get.headers.get('etag') ?? '';
ok((await fetch(`${server}/g/${slug}/`, { headers: { 'If-None-Match': etag } })).status === 304, 'a revisit with the same version is answered 304');
const bare = await fetch(`${server}/g/${slug}`, { redirect: 'manual' });
ok(bare.status === 301 && bare.headers.get('location')?.endsWith(`/g/${slug}/`), 'the address without the last slash redirects');
const info = (await (await fetch(`${server}/guest/${slug}`, { headers: { Authorization: auth } })).json()) as { page: { by: string } | null };
ok(info.page?.by === 'danh', 'who published it is recorded');

ok((await fetch(`${server}/guest/${slug}`, { method: 'DELETE' })).status === 401, 'taking down needs a session');
ok((await fetch(`${server}/guest/${slug}`, { method: 'DELETE', headers: { Authorization: auth } })).ok, 'taken down');
const gone = await fetch(`${server}/g/${slug}/`);
ok(gone.status === 404 && (await gone.text()).includes('no longer shared'), 'the link then says it is no longer shared');

// `npm run cloud:share -- <project file> [--owner danh] [--again]`
// Puts a project file (e.g. one in projects/) on the team's shared list of the deployed live-editing server, as
// if its owner had pressed "Share with the team". Runs on the machine that holds the server's signing key
// (cloud/.secrets.json, from `npm run cloud:accounts`), so nobody has to sign in on the website for it.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { migrateProject } from '@/storage/migrations';
import { toDoc } from '@/domain/sync/doc';
import { signToken } from '../cloud/src/auth';

const args = process.argv.slice(2);
const ownerAt = args.indexOf('--owner');
const owner = ownerAt >= 0 ? args[ownerAt + 1] : 'danh';
const file = args.find((a, i) => !a.startsWith('--') && (ownerAt < 0 || i !== ownerAt + 1));
if (!file) {
  console.error('Usage: npm run cloud:share -- <project file> [--owner danh] [--again]');
  process.exit(1);
}

const root = resolve(import.meta.dirname, '..');
const env = readFileSync(resolve(root, '.env.production'), 'utf8');
const server = (process.env.NEEST_SYNC_URL ?? env.match(/^VITE_NEEST_SYNC_URL=(.+)$/m)?.[1] ?? '').trim().replace(/\/$/, '');
const app = 'https://neest.nguyentuandanh-7.workers.dev';
const { SESSION_SECRET } = JSON.parse(readFileSync(resolve(root, 'cloud/.secrets.json'), 'utf8')) as { SESSION_SECRET: string };
if (!server || !SESSION_SECRET) throw new Error('Missing the server address (.env.production) or cloud/.secrets.json.');

const { project, warnings } = migrateProject(JSON.parse(readFileSync(resolve(file), 'utf8')));
if (warnings.length) console.log(`Repaired on load: ${warnings.join(' ')}`);

// A session for the owner. "Sign out on other devices" raises the account's session number, so find the current one.
let auth = '';
for (let v = 0; v < 100 && !auth; v++) {
  const token = await signToken(owner, SESSION_SECRET, Date.now(), v);
  const res = await fetch(`${server}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.ok) auth = `Bearer ${token}`;
  else if (res.status !== 401) throw new Error(`The server answered ${res.status}.`);
}
if (!auth) throw new Error(`No session for "${owner}" (unknown account, or a different signing key on the server).`);

const { rooms } = (await (await fetch(`${server}/rooms`, { headers: { Authorization: auth } })).json()) as { rooms: { name: string; owner: string }[] };
if (rooms.some((r) => r.name === project.name) && !args.includes('--again')) {
  console.log(`"${project.name}" is already on the shared list. Add --again to share another copy.`);
  process.exit(0);
}

const res = await fetch(`${server}/rooms`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: auth },
  body: JSON.stringify({ doc: toDoc(project), name: project.name }),
});
if (!res.ok) throw new Error(`Sharing failed: ${res.status} ${await res.text()}`);
const { room, key } = (await res.json()) as { room: string; key: string };
console.log(`Shared "${project.name}" (${(JSON.stringify(project).length / 1024).toFixed(0)} KB) as ${owner}.`);
console.log(`Team list: Shared with the team. Link: ${app}/#/live/${room}/${key}`);

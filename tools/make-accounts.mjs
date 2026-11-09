// Team accounts for live editing: `node tools/make-accounts.mjs`.
// Keeps each person's password in cloud/accounts.local.json (made once, never in git) and writes what the
// server needs — password hashes and the session-signing key — to cloud/.secrets.json (uploaded by
// `npm run cloud:deploy`) and cloud/.dev.vars (used by `npm run cloud:dev`). Running it again keeps the same
// passwords and key; delete an entry from accounts.local.json to give that person a new password.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { pbkdf2Sync, randomBytes, randomInt } from 'node:crypto';

const PEOPLE = [
  { id: 'danh', name: 'Danh', color: '#e8590c' },
  { id: 'ngan', name: 'Ngân', color: '#1c7ed6' },
  { id: 'linh', name: 'Linh', color: '#2f9e44' },
];
const WORDS = ['maple', 'river', 'cloud', 'lotus', 'amber', 'cedar', 'pearl', 'olive', 'coral', 'stone', 'tiger', 'lemon', 'bamboo', 'harbor', 'sunny', 'velvet'];
const ITERATIONS = 10_000; // keep in step with cloud/src/auth.ts

const dir = new URL('../cloud/', import.meta.url);
const plainFile = new URL('accounts.local.json', dir);
const plain = existsSync(plainFile) ? JSON.parse(readFileSync(plainFile, 'utf8')) : {};
const pick = () => WORDS[randomInt(WORDS.length)];
for (const p of PEOPLE) plain[p.id] ??= `${pick()}-${pick()}-${randomInt(10, 100)}`;
writeFileSync(plainFile, JSON.stringify(plain, null, 2) + '\n');

const users = {};
for (const p of PEOPLE) {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(plain[p.id], salt, ITERATIONS, 32, 'sha256');
  users[p.id] = { name: p.name, color: p.color, hash: `pbkdf2$${ITERATIONS}$${salt.toString('base64')}$${hash.toString('base64')}` };
}

const secretsFile = new URL('.secrets.json', dir);
const prev = existsSync(secretsFile) ? JSON.parse(readFileSync(secretsFile, 'utf8')) : {};
const secrets = { USERS: JSON.stringify(users), SESSION_SECRET: prev.SESSION_SECRET ?? randomBytes(32).toString('hex') };
writeFileSync(secretsFile, JSON.stringify(secrets, null, 2) + '\n');
writeFileSync(new URL('.dev.vars', dir), `USERS='${secrets.USERS}'\nSESSION_SECRET=${secrets.SESSION_SECRET}\n`);

console.log(`Accounts: ${PEOPLE.map((p) => `${p.name} (${p.id})`).join(', ')}.`);
console.log('Passwords: cloud/accounts.local.json. Server secrets: cloud/.secrets.json and cloud/.dev.vars (all ignored by git).');

/**
 * Team accounts for live editing. The accounts are fixed (Worker secret `USERS`, made by tools/make-accounts.mjs):
 * `{ "<login>": { "name": "Ngân", "color": "#1c7ed6", "hash": "pbkdf2$<iterations>$<salt b64>$<hash b64>" } }`.
 * Sign-in returns a token `<payload b64url>.<HMAC-SHA256 b64url>` signed with the secret `SESSION_SECRET`.
 * Pure Web Crypto: runs in the Worker and in tests.
 */

export interface Account {
  name: string;
  color: string;
  hash: string;
}
export type Accounts = Record<string, Account>;

export interface SessionUser {
  /** Login id, e.g. "ngan". */
  id: string;
  name: string;
  color: string;
}

/** PBKDF2 rounds: enough to slow guessing, light enough for the Workers Free CPU budget. */
export const PBKDF2_ITERATIONS = 10_000;
/** Sessions last 30 days. */
export const SESSION_MS = 30 * 24 * 3600 * 1000;

const enc = new TextEncoder();
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const b64url = (bytes: Uint8Array) => b64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s: string) => unb64(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256));
}

/** Same length and every byte equal, without stopping at the first difference. */
function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}

export async function hashPassword(password: string, iterations = PBKDF2_ITERATIONS): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${iterations}$${b64(salt)}$${b64(await pbkdf2(password, salt, iterations))}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [kind, iter, salt, hash] = stored.split('$');
  if (kind !== 'pbkdf2' || !iter || !salt || !hash) return false;
  return sameBytes(await pbkdf2(password, unb64(salt), Number(iter)), unb64(hash));
}

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

export async function signToken(user: string, secret: string, now = Date.now()): Promise<string> {
  const payload = b64url(enc.encode(JSON.stringify({ u: user, exp: now + SESSION_MS })));
  return `${payload}.${b64url(await hmac(secret, payload))}`;
}

/** The login id a token was issued to, or null when it is forged, malformed or expired. */
export async function verifyToken(token: string, secret: string, now = Date.now()): Promise<string | null> {
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  try {
    if (!sameBytes(unb64url(sig), await hmac(secret, payload))) return null;
    const { u, exp } = JSON.parse(new TextDecoder().decode(unb64url(payload))) as { u?: unknown; exp?: unknown };
    return typeof u === 'string' && typeof exp === 'number' && exp > now ? u : null;
  } catch {
    return null;
  }
}

export function parseAccounts(json: string | undefined): Accounts {
  try {
    const v = JSON.parse(json ?? '{}') as Accounts;
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

export const sessionUser = (id: string, a: Account): SessionUser => ({ id, name: a.name, color: a.color });

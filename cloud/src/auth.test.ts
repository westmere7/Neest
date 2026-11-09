import { describe, expect, it } from 'vitest';
import { hashPassword, parseAccounts, readToken, SESSION_MS, signToken, verifyPassword, verifyToken } from './auth';

describe('team accounts', () => {
  it('a password matches its hash and nothing else', async () => {
    const h = await hashPassword('maple-river-42', 1000);
    expect(h).toMatch(/^pbkdf2\$1000\$/);
    expect(await verifyPassword('maple-river-42', h)).toBe(true);
    expect(await verifyPassword('maple-river-43', h)).toBe(false);
    expect(await verifyPassword('', h)).toBe(false);
    expect(await verifyPassword('maple-river-42', 'garbage')).toBe(false);
  });

  it('hashes made by tools/make-accounts.mjs (Node pbkdf2Sync) verify here', async () => {
    const { pbkdf2Sync, randomBytes } = await import('node:crypto');
    const salt = randomBytes(16);
    const stored = `pbkdf2$1000$${salt.toString('base64')}$${pbkdf2Sync('lotus-amber-17', salt, 1000, 32, 'sha256').toString('base64')}`;
    expect(await verifyPassword('lotus-amber-17', stored)).toBe(true);
  });

  it('a session token names its account until it expires, and cannot be forged', async () => {
    const t = await signToken('ngan', 'secret', 1_000);
    expect(await verifyToken(t, 'secret', 2_000)).toBe('ngan');
    expect(await verifyToken(t, 'secret', 1_000 + SESSION_MS + 1)).toBeNull();
    expect(await verifyToken(t, 'other secret', 2_000)).toBeNull();
    const [payload, sig] = t.split('.');
    const forged = btoa(JSON.stringify({ u: 'danh', exp: 9e15 })).replace(/=+$/, '');
    expect(await verifyToken(`${forged}.${sig}`, 'secret', 2_000)).toBeNull();
    expect(await verifyToken(`${payload}.`, 'secret', 2_000)).toBeNull();
    expect(await verifyToken('nonsense', 'secret', 2_000)).toBeNull();
  });

  it('tokens carry the session number (older tokens without one count as 0)', async () => {
    expect(await readToken(await signToken('linh', 's', 1_000, 3), 's', 2_000)).toEqual({ user: 'linh', version: 3 });
    expect((await readToken(await signToken('linh', 's', 1_000), 's', 2_000))?.version).toBe(0);
  });

  it('reads the accounts secret, and survives a missing or broken one', () => {
    expect(parseAccounts('{"linh":{"name":"Linh","color":"#2f9e44","hash":"x"}}').linh.name).toBe('Linh');
    expect(parseAccounts(undefined)).toEqual({});
    expect(parseAccounts('{')).toEqual({});
  });
});

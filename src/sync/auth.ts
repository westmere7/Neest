import { create } from 'zustand';
import { preferenceRepository } from '@/storage/indexeddb/db';

/**
 * Signing in to the team's live-editing server (cloud/src/auth.ts): three fixed accounts. The session (a signed
 * token, 30 days) is kept in this browser's preferences. Only live editing needs it — and the deployed site,
 * which asks for it before anything else.
 */

export interface SessionUser {
  id: string;
  name: string;
  color: string;
}

interface AuthState {
  /** False until the stored session has been read. */
  ready: boolean;
  user: SessionUser | null;
  token: string | null;
}

export const useAuthStore = create<AuthState>(() => ({ ready: false, user: null, token: null }));

const PREF = 'liveSession';

/** Where the sync server is, or null when this build has none. */
export const SYNC_URL: string | null =
  (import.meta.env.VITE_NEEST_SYNC_URL as string | undefined) || (import.meta.env.DEV ? '/sync' : null);

export function httpBase(): string {
  if (!SYNC_URL) throw new Error('Live editing is not set up in this build.');
  return new URL(SYNC_URL, window.location.href).toString().replace(/\/$/, '');
}

export const authHeaders = (): Record<string, string> => {
  const t = useAuthStore.getState().token;
  return t ? { Authorization: `Bearer ${t}` } : {};
};

/** Reads the stored session and checks it with the server (kept as is when the server cannot be reached). */
export async function loadSession(): Promise<void> {
  const saved = (await preferenceRepository.get<{ token: string; user: SessionUser }>(PREF).catch(() => undefined)) ?? null;
  if (!saved || !SYNC_URL) {
    useAuthStore.setState({ ready: true, user: null, token: null });
    return;
  }
  useAuthStore.setState({ ready: true, user: saved.user, token: saved.token });
  try {
    const res = await fetch(`${httpBase()}/auth/me`, { headers: { Authorization: `Bearer ${saved.token}` }, signal: AbortSignal.timeout(8000) });
    if (res.status === 401) await signOut();
    else if (res.ok) {
      const { user } = (await res.json()) as { user: SessionUser };
      useAuthStore.setState({ user });
      await preferenceRepository.set(PREF, { token: saved.token, user });
    }
  } catch {
    /* offline: keep the stored session */
  }
}

/** Signs in; throws with a message to show when the name or password is wrong. */
export async function signIn(name: string, password: string): Promise<SessionUser> {
  const res = await fetch(`${httpBase()}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: name.trim().toLowerCase(), password }),
  }).catch(() => null);
  if (!res) throw new Error('The server cannot be reached. Check the connection and try again.');
  const body = (await res.json().catch(() => ({}))) as { token?: string; user?: SessionUser; error?: string };
  if (!res.ok || !body.token || !body.user) throw new Error(body.error ?? `The server answered ${res.status}.`);
  useAuthStore.setState({ user: body.user, token: body.token });
  await preferenceRepository.set(PREF, { token: body.token, user: body.user });
  return body.user;
}

export async function signOut(): Promise<void> {
  useAuthStore.setState({ user: null, token: null });
  await preferenceRepository.set(PREF, null);
}

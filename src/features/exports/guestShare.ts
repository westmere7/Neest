import type { Project } from '@/domain/model/schema';
import { guestTitle } from '@/domain/walkthrough/guest';
import { SYNC_URL, authHeaders, httpBase } from '@/sync/auth';

/**
 * Client for live guest links: the team's server (cloud/src/guest.ts) keeps each published walkthrough and serves it
 * to anyone with the link at `<server>/g/<slug>/`. Publishing needs a signed-in team account.
 */

/** Whether this build has a server to publish to (it also needs someone signed in). */
export const canPublishLinks = (): boolean => !!SYNC_URL;

/** The link's folder for a project: its guest title in plain letters, plus a few characters of its id. */
export function guestSlug(project: Pick<Project, 'id' | 'name' | 'guest'>): string {
  const words = guestTitle(project)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 40)
    .replace(/-+$/, '');
  const tail = project.id.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(-5) || 'link';
  return `${words || 'walkthrough'}-${tail}`;
}

const failure = async (res: Response) => {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  if (res.status === 401) return new Error('Please sign in again.');
  return new Error(body?.error ?? `The server answered ${res.status}.`);
};

/** The page gzipped (about a third smaller to send and store; browsers unpack it when they open the link). */
async function gzip(html: string): Promise<Blob> {
  const stream = new Blob([html], { type: 'text/html' }).stream().pipeThrough(new CompressionStream('gzip'));
  return new Response(stream).blob();
}

/** Publishes (or updates) the walkthrough at its link; returns the address. */
export async function publishGuestLink(slug: string, html: string): Promise<string> {
  const res = await fetch(`${httpBase()}/guest/${slug}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/gzip', ...authHeaders() },
    body: await gzip(html),
  }).catch(() => null);
  if (!res) throw new Error('The team server cannot be reached. Check the connection and try again.');
  if (!res.ok) throw await failure(res);
  return ((await res.json()) as { url: string }).url;
}

/** Takes the walkthrough off its link. */
export async function unpublishGuestLink(slug: string): Promise<void> {
  const res = await fetch(`${httpBase()}/guest/${slug}`, { method: 'DELETE', headers: authHeaders() }).catch(() => null);
  if (!res) throw new Error('The team server cannot be reached. Check the connection and try again.');
  if (!res.ok) throw await failure(res);
}

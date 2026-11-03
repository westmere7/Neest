import type { Project } from '@/domain/model/schema';
import { guestTitle } from '@/domain/walkthrough/guest';

/**
 * Client for live guest links (tools/neest-share-plugin.ts): the dev/preview server publishes a guest
 * walkthrough to GitHub Pages with this machine's git sign-in. A static build has no server: status is null.
 */

const BASE = '/__neest/share';

export interface ShareTarget {
  /** owner/name of the share repository. */
  repo: string;
  /** Address the links start with. */
  base: string;
}

let status: Promise<ShareTarget | null> | null = null;

/** Where links are published, or null when this app has no share server (static build). */
export function shareStatus(): Promise<ShareTarget | null> {
  if (!status) {
    status = (async () => {
      try {
        const res = await fetch(`${BASE}/status`, { cache: 'no-store' });
        if (!res.ok) return null;
        const body = (await res.json()) as { ok?: boolean; repo?: string; base?: string };
        return body.ok && body.repo && body.base ? { repo: body.repo, base: body.base } : null;
      } catch {
        return null;
      }
    })();
  }
  return status;
}

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
  return new Error(body?.error ?? `The share server answered ${res.status}.`);
};

/** Publishes (or updates) the walkthrough at its link; returns the address. */
export async function publishGuestLink(slug: string, html: string): Promise<string> {
  const res = await fetch(`${BASE}/${slug}`, { method: 'PUT', headers: { 'Content-Type': 'text/html' }, body: html });
  if (!res.ok) throw await failure(res);
  return ((await res.json()) as { url: string }).url;
}

/** Takes the walkthrough off its link. */
export async function unpublishGuestLink(slug: string): Promise<void> {
  const res = await fetch(`${BASE}/${slug}`, { method: 'DELETE' });
  if (!res.ok) throw await failure(res);
}

/** Whether GitHub Pages serves the link yet (it takes about a minute after each publish). */
export async function isLinkLive(slug: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/live/${slug}`, { cache: 'no-store' });
    return res.ok && ((await res.json()) as { live?: boolean }).live === true;
  } catch {
    return false;
  }
}

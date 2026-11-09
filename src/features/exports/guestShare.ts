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

/** Gzipped bytes (about a third smaller to send and store; browsers unpack them when they open the link). */
async function gzip(data: BlobPart): Promise<Blob> {
  const stream = new Blob([data]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Response(stream).blob();
}

/** A request that makes no progress for this long is given up, with a message instead of waiting forever. */
const STALL_MS = 60_000;
/** Pieces sent at the same time. */
const PARALLEL = 4;

/** PUT with upload progress (XMLHttpRequest: fetch does not report it) and a stall limit. */
function put(url: string, body: Blob, headers: Record<string, string>, onSent: (bytes: number) => void): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let stall: ReturnType<typeof setTimeout> | null = null;
    let sent = 0;
    const alive = () => {
      if (stall) clearTimeout(stall);
      stall = setTimeout(() => xhr.abort(), STALL_MS);
    };
    xhr.open('PUT', url);
    for (const [k, v] of Object.entries({ ...headers, ...authHeaders() })) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => {
      alive();
      onSent(e.loaded - sent);
      sent = e.loaded;
    };
    const done = () => stall && clearTimeout(stall);
    xhr.onload = () => {
      done();
      onSent(body.size - sent);
      resolve({ status: xhr.status, text: xhr.responseText });
    };
    xhr.onerror = () => {
      done();
      reject(new Error('The team server cannot be reached. Check the connection and try again.'));
    };
    xhr.onabort = () => reject(new Error('The upload stopped moving for a minute. Check the connection and try again.'));
    alive();
    xhr.send(body);
  });
}

const ok = async (res: { status: number; text: string }) => {
  if (res.status < 200 || res.status >= 300) throw await failure(new Response(res.text, { status: res.status }));
  return JSON.parse(res.text) as Record<string, unknown>;
};

const megabytes = (n: number) => `${(n / 1e6).toFixed(n < 1e7 ? 1 : 0)} MB`;

/**
 * Publishes (or updates) the walkthrough at its link; returns the address. The 3D model goes in pieces named by their
 * content (guestPieces.ts): only the pieces the link does not have yet are sent, so an Update after a few changes
 * sends a small part of the model. `onStage` hears what is happening (building, sending n %).
 */
export async function publishGuestLink(slug: string, project: Project, onStage?: (stage: string) => void): Promise<string> {
  onStage?.('Building the 3D model…');
  const { guestModel, buildGuestHtml } = await import('./guestExport');
  const { normalizeGlb, splitModel } = await import('./guestPieces');
  const model = await splitModel(await normalizeGlb(await guestModel(project)));
  const names = model.pieces.map((p) => p.hash);
  onStage?.('Checking what changed…');
  const base = `${httpBase()}/guest/${slug}`;
  const asked = await fetch(`${base}/missing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ pieces: names }),
  }).catch(() => null);
  if (!asked) throw new Error('The team server cannot be reached. Check the connection and try again.');
  if (!asked.ok) throw await failure(asked);
  const { missing } = (await asked.json()) as { missing: string[] };

  const html = await gzip(await buildGuestHtml(project, { size: model.size, pieces: names }));
  const send = async (todo: string[]) => {
    const pieces = model.pieces.filter((p, i) => todo.includes(p.hash) && names.indexOf(p.hash) === i);
    const packed = await Promise.all(pieces.map(async (p) => ({ hash: p.hash, gz: await gzip(p.bytes) })));
    const total = packed.reduce((n, p) => n + p.gz.size, 0) + html.size;
    let sent = 0;
    const started = Date.now();
    const progress = (n: number) => {
      sent += n;
      // The speed shows whether the connection or the app is the slow part.
      const secs = (Date.now() - started) / 1000;
      const speed = secs > 1 ? ` · ${sent / secs >= 1e6 ? `${(sent / secs / 1e6).toFixed(1)} MB/s` : `${Math.round(sent / secs / 1e3)} KB/s`}` : '';
      onStage?.(`Sending ${Math.min(99, Math.floor((100 * sent) / total))} % of ${megabytes(total)}${speed}…`);
    };
    progress(0);
    let next = 0;
    const worker = async () => {
      while (next < packed.length) {
        const p = packed[next++];
        // A phone connection drops now and then: each piece is tried three times before giving up (pieces that
        // arrived stay on the server, so publishing again later continues from there).
        for (let attempt = 1; ; attempt++) {
          try {
            await ok(await put(`${base}/p/${p.hash}`, p.gz, { 'Content-Type': 'application/gzip' }, progress));
            break;
          } catch (e) {
            if (attempt >= 3) throw e;
            await new Promise((r) => setTimeout(r, 2000 * attempt));
          }
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(PARALLEL, packed.length) }, worker));
    return progress;
  };
  let progress = await send(missing);
  let res = await put(base, html, { 'Content-Type': 'application/gzip', 'X-Neest-Pieces': names.join(',') }, progress);
  if (res.status === 409) {
    // Someone else's Update dropped a piece meanwhile: send what is missing and try once more.
    const again = (JSON.parse(res.text) as { missing?: string[] }).missing ?? [];
    progress = await send(again);
    res = await put(base, html, { 'Content-Type': 'application/gzip', 'X-Neest-Pieces': names.join(',') }, progress);
  }
  return String((await ok(res)).url);
}

/** Takes the walkthrough off its link. */
export async function unpublishGuestLink(slug: string): Promise<void> {
  const res = await fetch(`${httpBase()}/guest/${slug}`, { method: 'DELETE', headers: authHeaders() }).catch(() => null);
  if (!res) throw new Error('The team server cannot be reached. Check the connection and try again.');
  if (!res.ok) throw await failure(res);
}

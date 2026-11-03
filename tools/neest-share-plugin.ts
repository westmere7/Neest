import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin, PreviewServer, ViteDevServer } from 'vite';

/**
 * Live guest links on GitHub Pages (dev & preview servers only).
 *
 * A guest walkthrough (one self-contained HTML file) is published as `<slug>/index.html` in a public
 * share repository, `<owner>/neest-share` by default (the owner of this checkout's `origin`;
 * NEEST_SHARE_REPO=owner/name overrides it), and served at https://<owner>.github.io/neest-share/<slug>/.
 *
 * Nothing to set up: publishing runs plain `git` in a cache clone (node_modules/.cache/neest-share), so
 * it uses the same stored GitHub sign-in as `git push`. Only when the share repository does not exist yet
 * is the GitHub API called (create it, turn on Pages), with the credential git already holds
 * (`git credential fill`); it is read for that call and never stored or logged. Every publish replaces the
 * repository's history with one commit of the current files, so updates of large files do not pile up.
 *
 * Endpoints (JSON), under /__neest/share:
 *   GET    /status       → { ok, repo, base }
 *   PUT    /:slug        → body = the guest HTML (≤ 120 MB); publishes it → { url }
 *   DELETE /:slug        → removes it → { ok }
 *   GET    /live/:slug   → { live } (whether GitHub Pages serves it yet)
 */

const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;
const MAX_HTML = 120 * 1024 * 1024;
const GIT_ENV = { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' };

function git(args: string[], cwd: string, input?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile('git', args, { cwd, env: GIT_ENV, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(Object.assign(new Error(`git ${args[0]} failed: ${String(stderr || err.message).trim().split('\n').slice(-2).join(' ')}`), { stderr }));
      else resolve(String(stdout));
    });
    if (input !== undefined) child.stdin?.end(input);
  });
}

function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > limit) {
        reject(Object.assign(new Error('Payload too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

const ROOT_FILES: Record<string, string> = {
  '.nojekyll': '',
  // Links are shared by hand: keep the pages out of search engines.
  'robots.txt': 'User-agent: *\nDisallow: /\n',
  'index.html':
    '<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>Neest</title>' +
    '<p style="font:15px system-ui;margin:40px">Shared Neest walkthroughs. Open the link you were given.</p>\n',
};

export function neestShare(root = process.cwd()): Plugin {
  let repo: { owner: string; name: string } | null = null;
  const cache = path.join(root, 'node_modules', '.cache', 'neest-share');
  /** One git operation at a time. */
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = queue.then(fn, fn);
    queue = run.catch(() => undefined);
    return run;
  };

  const resolveRepo = async () => {
    if (repo) return repo;
    const override = process.env.NEEST_SHARE_REPO?.match(/^([\w.-]+)\/([\w.-]+)$/);
    if (override) return (repo = { owner: override[1], name: override[2] });
    const origin = (await git(['remote', 'get-url', 'origin'], root)).trim();
    const m = origin.match(/github\.com[/:]([\w.-]+)\//);
    if (!m) throw new Error('This checkout has no GitHub origin; set NEEST_SHARE_REPO=owner/name.');
    return (repo = { owner: m[1], name: 'neest-share' });
  };
  const remoteUrl = (r: { owner: string; name: string }) => `https://github.com/${r.owner}/${r.name}.git`;
  const baseUrl = (r: { owner: string; name: string }) => `https://${r.owner.toLowerCase()}.github.io/${r.name}/`;

  /** The GitHub credential git holds (for the one-time API setup). */
  const token = async (): Promise<string> => {
    const out = await git(['credential', 'fill'], root, 'protocol=https\nhost=github.com\n\n');
    const t = out.match(/^password=(.+)$/m)?.[1];
    if (!t) throw new Error('No GitHub sign-in is stored for git on this machine.');
    return t;
  };
  const api = async (t: string, method: string, url: string, body?: unknown) =>
    fetch(`https://api.github.com${url}`, {
      method,
      headers: { Authorization: `Bearer ${t}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'neest' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

  /** Creates the share repository and turns on Pages when it does not exist yet. */
  const ensureRemote = async (r: { owner: string; name: string }) => {
    try {
      await git(['ls-remote', '--heads', remoteUrl(r)], root);
      return;
    } catch {
      /* missing (or no access): create it below */
    }
    const t = await token();
    const me = (await (await api(t, 'GET', '/user')).json()) as { login?: string };
    const create = await api(t, 'POST', me.login?.toLowerCase() === r.owner.toLowerCase() ? '/user/repos' : `/orgs/${r.owner}/repos`, {
      name: r.name,
      description: 'Guest walkthroughs shared from Neest (one folder per link).',
      private: false,
      auto_init: true,
      has_issues: false,
      has_wiki: false,
      has_projects: false,
    });
    if (!create.ok && create.status !== 422) throw new Error(`Could not create ${r.owner}/${r.name} on GitHub (${create.status}).`);
    const pages = await api(t, 'POST', `/repos/${r.owner}/${r.name}/pages`, { build_type: 'legacy', source: { branch: 'main', path: '/' } });
    if (!pages.ok && pages.status !== 409) throw new Error(`Could not turn on GitHub Pages for ${r.owner}/${r.name} (${pages.status}).`);
  };

  /** The cache clone, in step with the remote. */
  const sync = async (r: { owner: string; name: string }) => {
    if (!fs.existsSync(path.join(cache, '.git'))) {
      fs.rmSync(cache, { recursive: true, force: true });
      fs.mkdirSync(path.dirname(cache), { recursive: true });
      await git(['clone', '--depth', '1', remoteUrl(r), cache], root);
    }
    await git(['fetch', '--depth', '1', 'origin', 'main'], cache);
    await git(['checkout', '-q', '-B', 'main', 'FETCH_HEAD'], cache);
    await git(['reset', '-q', '--hard', 'FETCH_HEAD'], cache);
    await git(['clean', '-q', '-fdx'], cache);
  };

  /** Commits the working tree as the repository's only commit and pushes it. */
  const commit = async (message: string) => {
    for (const [f, text] of Object.entries(ROOT_FILES)) if (!fs.existsSync(path.join(cache, f))) fs.writeFileSync(path.join(cache, f), text);
    await git(['checkout', '-q', '--orphan', 'neest-publish'], cache);
    await git(['add', '-A'], cache);
    const name = (await git(['config', 'user.name'], cache).catch(() => '')).trim();
    const id = name ? [] : ['-c', 'user.name=Neest', '-c', 'user.email=neest@users.noreply.github.com'];
    await git([...id, 'commit', '-q', '-m', message], cache);
    await git(['push', '-q', '-f', 'origin', 'neest-publish:main'], cache);
    await git(['branch', '-q', '-M', 'neest-publish', 'main'], cache);
  };

  const publish = (slug: string, html: Buffer) =>
    serial(async () => {
      const r = await resolveRepo();
      await ensureRemote(r);
      await sync(r);
      const dir = path.join(cache, slug);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'index.html'), html);
      await commit(`Publish ${slug}`);
      return { url: `${baseUrl(r)}${slug}/` };
    });

  const unpublish = (slug: string) =>
    serial(async () => {
      const r = await resolveRepo();
      await sync(r);
      fs.rmSync(path.join(cache, slug), { recursive: true, force: true });
      await commit(`Remove ${slug}`);
      return { ok: true };
    });

  const handler = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = new URL(req.url ?? '/', 'http://local');
    if (!url.pathname.startsWith('/__neest/share')) return next();
    const parts = url.pathname.slice('/__neest/share'.length).split('/').filter(Boolean);
    try {
      if (parts[0] === 'status' && req.method === 'GET') {
        const r = await resolveRepo();
        return send(res, 200, { ok: true, repo: `${r.owner}/${r.name}`, base: baseUrl(r) });
      }
      if (parts[0] === 'live' && parts[1] && SLUG.test(parts[1]) && req.method === 'GET') {
        const r = await resolveRepo();
        const page = await fetch(`${baseUrl(r)}${parts[1]}/`, { method: 'HEAD', cache: 'no-store' }).catch(() => null);
        return send(res, 200, { live: !!page?.ok });
      }
      if (parts.length === 1 && SLUG.test(parts[0])) {
        if (req.method === 'PUT') {
          const body = await readBody(req, MAX_HTML);
          if (!/^\s*<!doctype html>/i.test(body.subarray(0, 64).toString('utf8'))) return send(res, 400, { error: 'Not an HTML page' });
          return send(res, 200, await publish(parts[0], body));
        }
        if (req.method === 'DELETE') return send(res, 200, await unpublish(parts[0]));
      }
      return send(res, 404, { error: 'Not found' });
    } catch (e) {
      const status = (e as { status?: number }).status ?? 500;
      return send(res, status, { error: e instanceof Error ? e.message : String(e) });
    }
  };

  return {
    name: 'neest-share',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => void handler(req, res, next));
    },
    configurePreviewServer(server: PreviewServer) {
      server.middlewares.use((req, res, next) => void handler(req, res, next));
    },
  };
}

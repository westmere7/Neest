import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin, PreviewServer, ViteDevServer } from 'vite';

/**
 * Repository workspace for Neest projects (dev & preview servers only).
 *
 * Projects are mirrored as pretty-printed JSON in `<repo>/projects/` so a team
 * can commit them and teammates see them after `git pull`. Imported model
 * binaries live in `projects/assets/<blobId>.glb`. The dev server watches the
 * folder and pushes `neest:projects-changed` over Vite's HMR socket, so edits
 * made on disk (by an agent, a teammate's pull, or a text editor) appear in
 * open browsers immediately.
 *
 * Endpoints (JSON unless noted), all under /__neest/fs:
 *   GET    /health                      → { ok, dir }
 *   GET    /projects                    → [{ id, name, updatedAt, file, size }]
 *   GET    /projects/:id                → project JSON
 *   PUT    /projects/:id                → write project JSON (body ≤ 50 MB)
 *   DELETE /projects/:id                → remove the file
 *   GET    /assets/:blobId              → GLB bytes
 *   PUT    /assets/:blobId              → write GLB bytes (≤ 60 MB, must start with "glTF")
 *
 * Only plain ids are accepted ([A-Za-z0-9_-]), so requests cannot escape the folder.
 * The production static build has none of this and falls back to browser storage only.
 */

const ID = /^[A-Za-z0-9_-]{1,80}$/;
const MAX_PROJECT = 50 * 1024 * 1024;
const MAX_ASSET = 60 * 1024 * 1024;

export interface WorkspaceOptions {
  /** Folder (relative to the Vite root) holding project files. */
  dir?: string;
}

function slugify(name: string): string {
  return (
    name
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
      .slice(0, 48) || 'project'
  );
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

function send(res: ServerResponse, status: number, body: unknown, type = 'application/json') {
  res.statusCode = status;
  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', 'no-store');
  res.end(type === 'application/json' ? JSON.stringify(body) : (body as Buffer));
}

export function neestWorkspace(opts: WorkspaceOptions = {}): Plugin {
  let dir = '';
  let assetsDir = '';
  /** Files we just wrote: suppress the watcher echo for them. */
  const recentWrites = new Map<string, number>();

  const fileFor = (id: string): string | null => {
    if (!fs.existsSync(dir)) return null;
    const hit = fs.readdirSync(dir).find((f) => f.endsWith(`__${id}.json`));
    return hit ? path.join(dir, hit) : null;
  };

  const listProjects = () => {
    if (!fs.existsSync(dir)) return [];
    const out: { id: string; name: string; updatedAt: number; file: string; size: number }[] = [];
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.json')) continue;
      const m = f.match(/__([A-Za-z0-9_-]+)\.json$/);
      if (!m) continue;
      const full = path.join(dir, f);
      try {
        const stat = fs.statSync(full);
        // Read only what is needed for the listing.
        const doc = JSON.parse(fs.readFileSync(full, 'utf8')) as { id?: string; name?: string; updatedAt?: number };
        out.push({ id: doc.id ?? m[1], name: doc.name ?? f, updatedAt: doc.updatedAt ?? stat.mtimeMs, file: `projects/${f}`, size: stat.size });
      } catch {
        /* skip unreadable or invalid files */
      }
    }
    return out.sort((a, b) => b.updatedAt - a.updatedAt);
  };

  const handler = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = new URL(req.url ?? '/', 'http://local');
    if (!url.pathname.startsWith('/__neest/fs')) return next();
    const parts = url.pathname.slice('/__neest/fs'.length).split('/').filter(Boolean);
    try {
      if (parts[0] === 'health') return send(res, 200, { ok: true, dir: path.relative(process.cwd(), dir) || '.' });
      if (parts[0] === 'projects' && parts.length === 1 && req.method === 'GET') return send(res, 200, listProjects());
      if (parts[0] === 'projects' && parts.length === 2) {
        const id = parts[1];
        if (!ID.test(id)) return send(res, 400, { error: 'Invalid id' });
        if (req.method === 'GET') {
          const f = fileFor(id);
          if (!f) return send(res, 404, { error: 'Not found' });
          return send(res, 200, JSON.parse(fs.readFileSync(f, 'utf8')));
        }
        if (req.method === 'PUT') {
          const body = await readBody(req, MAX_PROJECT);
          const doc = JSON.parse(body.toString('utf8')) as { id?: string; name?: string };
          if (doc.id !== id) return send(res, 400, { error: 'Body id does not match the URL' });
          fs.mkdirSync(dir, { recursive: true });
          const target = path.join(dir, `${slugify(doc.name ?? 'project')}__${id}.json`);
          const tmp = `${target}.tmp`;
          fs.writeFileSync(tmp, JSON.stringify(doc, null, 2) + '\n');
          fs.renameSync(tmp, target);
          recentWrites.set(path.resolve(target), Date.now());
          // Remove stale files for the same id (the project was renamed).
          for (const f of fs.readdirSync(dir)) {
            const full = path.join(dir, f);
            if (f.endsWith(`__${id}.json`) && full !== target) {
              recentWrites.set(path.resolve(full), Date.now());
              fs.rmSync(full);
            }
          }
          return send(res, 200, { ok: true, file: `projects/${path.basename(target)}` });
        }
        if (req.method === 'DELETE') {
          const f = fileFor(id);
          if (f) {
            recentWrites.set(path.resolve(f), Date.now());
            fs.rmSync(f);
          }
          return send(res, 200, { ok: true });
        }
      }
      if (parts[0] === 'assets' && parts.length === 2) {
        const id = parts[1];
        if (!ID.test(id)) return send(res, 400, { error: 'Invalid id' });
        const f = path.join(assetsDir, `${id}.glb`);
        if (req.method === 'GET') {
          if (!fs.existsSync(f)) return send(res, 404, { error: 'Not found' });
          return send(res, 200, fs.readFileSync(f), 'model/gltf-binary');
        }
        if (req.method === 'PUT') {
          const body = await readBody(req, MAX_ASSET);
          if (body.subarray(0, 4).toString('latin1') !== 'glTF') return send(res, 400, { error: 'Not a GLB file' });
          fs.mkdirSync(assetsDir, { recursive: true });
          if (!fs.existsSync(f) || fs.statSync(f).size !== body.length) {
            fs.writeFileSync(f, body);
            recentWrites.set(path.resolve(f), Date.now());
          }
          return send(res, 200, { ok: true });
        }
      }
      return send(res, 404, { error: 'Unknown endpoint' });
    } catch (e) {
      const status = (e as { status?: number }).status ?? 500;
      return send(res, status, { error: e instanceof Error ? e.message : String(e) });
    }
  };

  return {
    name: 'neest-workspace',
    configResolved(config) {
      dir = path.resolve(config.root, opts.dir ?? 'projects');
      assetsDir = path.join(dir, 'assets');
    },
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => void handler(req, res, next));
      fs.mkdirSync(dir, { recursive: true });
      server.watcher.add(dir);
      const notify = (file: string, kind: 'change' | 'add' | 'unlink') => {
        const full = path.resolve(file);
        if (!full.startsWith(dir) || !full.endsWith('.json')) return;
        const mine = recentWrites.get(full);
        if (mine && Date.now() - mine < 2500) return;
        const m = path.basename(full).match(/__([A-Za-z0-9_-]+)\.json$/);
        if (!m) return;
        server.ws.send({ type: 'custom', event: 'neest:projects-changed', data: { id: m[1], kind, file: `projects/${path.basename(full)}` } });
      };
      server.watcher.on('change', (f) => notify(f, 'change'));
      server.watcher.on('add', (f) => notify(f, 'add'));
      server.watcher.on('unlink', (f) => notify(f, 'unlink'));
    },
    configurePreviewServer(server: PreviewServer) {
      server.middlewares.use((req, res, next) => void handler(req, res, next));
    },
  };
}

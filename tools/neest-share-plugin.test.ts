// @vitest-environment node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';
import type { ViteDevServer } from 'vite';
import { neestShare } from './neest-share-plugin';

const runGit = (args: string[], cwd: string) =>
  execFileSync('git', args, {
    cwd,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 'test@example.com',
    },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

function mountMiddleware(plugin: ReturnType<typeof neestShare>) {
  let mw: ((req: IncomingMessage, res: ServerResponse, next: () => void) => void) | null = null;
  const hook = plugin.configureServer;
  const fn = typeof hook === 'function' ? hook : hook?.handler;
  fn?.call({} as never, {
    middlewares: {
      use: (h: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => {
        mw = h;
      },
    },
  } as unknown as ViteDevServer);
  return async (method: string, url: string, body?: string) =>
    new Promise<{ status: number; json: unknown }>((resolve, reject) => {
      const req = Object.assign(Readable.from(body ? [Buffer.from(body, 'utf8')] : []), {
        method,
        url,
      }) as unknown as IncomingMessage;
      let status = 200;
      let out = '';
      const res = {
        get statusCode() {
          return status;
        },
        set statusCode(v: number) {
          status = v;
        },
        setHeader() {},
        end(chunk?: string) {
          if (chunk) out += chunk;
          try {
            resolve({ status, json: JSON.parse(out) });
          } catch (e) {
            reject(e);
          }
        },
      } as unknown as ServerResponse;
      mw!(req, res, () => resolve({ status: 404, json: null }));
    });
}

describe('neestShare git publishing', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
  });

  it('publishes as a single root commit and recovers from a leftover neest-publish branch or dirty cache', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'neest-share-test-'));
    dirs.push(tmp);
    const remote = path.join(tmp, 'remote.git');
    const seed = path.join(tmp, 'seed');
    const appRoot = path.join(tmp, 'app');
    fs.mkdirSync(remote);
    fs.mkdirSync(seed);
    fs.mkdirSync(appRoot);

    // Bare remote seeded with an initial commit on `main`.
    runGit(['init', '-q', '--bare', '-b', 'main'], remote);
    runGit(['init', '-q', '-b', 'main'], seed);
    fs.writeFileSync(path.join(seed, 'README.md'), 'init\n');
    runGit(['add', 'README.md'], seed);
    runGit(['commit', '-q', '-m', 'init'], seed);
    runGit(['remote', 'add', 'origin', remote], seed);
    runGit(['push', '-q', 'origin', 'main'], seed);

    // App checkout with a GitHub origin URL so `resolveRepo()` resolves owner/neest-share.
    runGit(['init', '-q', '-b', 'main'], appRoot);
    runGit(['remote', 'add', 'origin', 'https://github.com/example/neest.git'], appRoot);

    const request = mountMiddleware(neestShare(appRoot, remote));
    const page1 = '<!doctype html><html><body>v1</body></html>';
    const r1 = await request('PUT', '/__neest/share/flat-abc12', page1);
    expect(r1).toEqual({ status: 200, json: { url: 'https://example.github.io/neest-share/flat-abc12/' } });
    expect(runGit(['rev-list', '--count', 'main'], remote).trim()).toBe('1');

    // Simulate an interrupted old-version publish: leftover `neest-publish` branch + dirty file in cache.
    const cache = path.join(appRoot, 'node_modules', '.cache', 'neest-share');
    runGit(['checkout', '-q', '--orphan', 'neest-publish'], cache);
    fs.writeFileSync(path.join(cache, 'flat-abc12', 'index.html'), '<!doctype html>broken');
    runGit(['add', '-A'], cache);
    runGit(['commit', '-q', '-m', 'interrupted'], cache);
    runGit(['checkout', '-q', 'main'], cache);
    fs.writeFileSync(path.join(cache, 'flat-abc12', 'index.html'), '<!doctype html>dirty');

    // Next publish must succeed cleanly, delete `neest-publish`, and keep history at 1 commit.
    const page2 = '<!doctype html><html><body>v2</body></html>';
    const r2 = await request('PUT', '/__neest/share/flat-abc12', page2);
    expect(r2).toEqual({ status: 200, json: { url: 'https://example.github.io/neest-share/flat-abc12/' } });
    expect(runGit(['rev-list', '--count', 'main'], remote).trim()).toBe('1');
    expect(runGit(['show', 'main:flat-abc12/index.html'], remote)).toBe(page2);
    expect(runGit(['branch', '--list', 'neest-publish'], cache).trim()).toBe('');

    // Unpublish removes the folder and keeps 1 root commit.
    const del = await request('DELETE', '/__neest/share/flat-abc12');
    expect(del).toEqual({ status: 200, json: { ok: true } });
    expect(runGit(['rev-list', '--count', 'main'], remote).trim()).toBe('1');
    expect(() => runGit(['show', 'main:flat-abc12/index.html'], remote)).toThrow();
  });
});

// Bakes the People pack's realistic figures (npm run people).
//
// Source characters: Quaternius "Ultimate Modular Men/Women" (CC0 1.0), as meshopt GLBs from
// github.com/nikitapage10/models (CC0 copies, shared 62-bone rig). They are downloaded once into
// the OS temp folder. Every figure in packs/people.pack.ts (BAKE_JOBS) is posed and scaled in
// headless Chromium by src/devtools/peopleBake.ts and written to public/models/people/<id>.glb,
// with src/data/assets/peopleModels.json (id → file, content hash, size, slots). The app needs no
// network: when a file is missing it shows the procedural figure instead.
//   --only id1,id2   bake just these figures
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'public', 'models', 'people');
const manifestPath = path.join(root, 'src', 'data', 'assets', 'peopleModels.json');
const cacheDir = path.join(os.tmpdir(), 'neest-people-sources');
const SOURCE_URL = (name) => `https://raw.githubusercontent.com/nikitapage10/models/main/${name}.glb`;
const onlyArg = process.argv.find((a) => a.startsWith('--only'));
const only = onlyArg ? new Set((onlyArg.split('=')[1] ?? process.argv[process.argv.indexOf(onlyArg) + 1]).split(',')) : null;

async function source(name) {
  const file = path.join(cacheDir, `${name.replace('/', '__')}.glb`);
  if (!existsSync(file)) {
    await mkdir(cacheDir, { recursive: true });
    const r = await fetch(SOURCE_URL(name));
    if (!r.ok) throw new Error(`download ${name}: HTTP ${r.status}`);
    await writeFile(file, Buffer.from(await r.arrayBuffer()));
    console.log(`downloaded ${name}`);
  }
  return (await readFile(file)).toString('base64');
}

const server = await createServer({ root, logLevel: 'error', server: { port: 5315, strictPort: false } });
await server.listen();
const url = server.resolvedUrls?.local[0] ?? 'http://localhost:5315/';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(url);
  await page.waitForFunction(() => Boolean(window.__NEEST__), null, { timeout: 120_000 });
  const jobs = await page.evaluate(async () => (await import('/packs/people.pack.ts')).BAKE_JOBS);
  const todo = jobs.filter((j) => !only || only.has(j.id));
  const manifest = existsSync(manifestPath) ? JSON.parse(await readFile(manifestPath, 'utf8')) : {};
  await mkdir(outDir, { recursive: true });
  for (const job of todo) {
    const src = await source(job.source);
    const r = await page.evaluate(async ({ job, src }) => (await import('/src/devtools/peopleBake.ts')).bakePerson({ ...job, source: src }), { job, src });
    const buf = Buffer.from(r.glb, 'base64');
    const file = `${job.id}.glb`;
    await writeFile(path.join(outDir, file), buf);
    manifest[job.id] = { file: `models/people/${file}`, hash: createHash('sha1').update(buf).digest('hex').slice(0, 12), size: r.size, seat: r.seat, slots: r.slots, source: job.source };
    console.log(`${job.id}: ${r.tris} tris, ${(buf.length / 1024).toFixed(0)} KB, ${r.size.join(' × ')} m`);
  }
  // Keep only figures that still exist.
  const ids = new Set(jobs.map((j) => j.id));
  for (const id of Object.keys(manifest)) if (!ids.has(id)) delete manifest[id];
  for (const f of await readdir(outDir)) if (f.endsWith('.glb') && !ids.has(f.slice(0, -4))) await rm(path.join(outDir, f));
  const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(manifestPath, JSON.stringify(sorted, null, 1) + '\n');
  console.log(`baked ${todo.length} figures`);
} finally {
  await browser.close();
  await server.close();
}

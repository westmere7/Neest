// Pre-renders library thumbnails into public/thumbs and material swatches into public/swatches
// (npm run thumbs).
//
// Starts a Vite dev server, opens the app in headless Chromium, renders every built-in and pack
// item with the app's own thumbnail renderer and writes one WebP per item plus manifest.json
// (asset id → file and fingerprint). The app uses a shipped file only while its fingerprint still
// matches the item's definition, so stale files are harmless; re-run this after changing items.
// Items whose fingerprint is unchanged are skipped, so re-runs are quick.
//
// Swatches: one WebP per distinct look (fingerprint of colour + pattern code, or photo set + tint),
// with manifest.json listing fingerprint → file and catalogue material id → fingerprint.
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'public', 'thumbs');
const swatchDir = path.join(root, 'public', 'swatches');
const manifestPath = path.join(outDir, 'manifest.json');
const BATCH = 24;

const previous = await readFile(manifestPath, 'utf8')
  .then((t) => JSON.parse(t))
  .catch(() => ({ items: {} }));

const server = await createServer({ root, logLevel: 'error', server: { port: 5310, strictPort: false } });
await server.listen();
const url = server.resolvedUrls?.local[0] ?? 'http://localhost:5310/';
const launchArgs = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const browser = await chromium
  .launch({ args: launchArgs })
  .catch(() => chromium.launch({ channel: 'chrome', args: launchArgs }));

try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(url);
  await page.waitForFunction(() => Boolean(window.__NEEST__), null, { timeout: 120_000 });

  // Fingerprint everything in the page (packs included) and decide what needs rendering.
  const all = await page.evaluate(async () => {
    const { ASSET_CATALOG } = await import('/src/data/assets/catalog.ts');
    const { withAllModels } = await import('/src/data/assets/models.ts');
    const { thumbFingerprint, thumbFileName, THUMB_VERSION } = await import('/src/features/library/thumbFingerprint.ts');
    // Items with model variants get a thumbnail per model (the library card shows the chosen one).
    return {
      version: THUMB_VERSION,
      items: withAllModels(ASSET_CATALOG.filter((a) => a.category !== 'custom')).map((a) => ({ id: a.id, fp: thumbFingerprint(a), file: thumbFileName(a.id) })),
    };
  });
  const todo = all.items.filter((i) => i.fp && previous.items?.[i.id]?.fp !== i.fp);
  console.log(`${all.items.length} items, ${todo.length} to render`);

  await mkdir(outDir, { recursive: true });
  const manifest = { version: all.version, items: {} };
  for (const i of all.items) if (i.fp && previous.items?.[i.id]?.fp === i.fp) manifest.items[i.id] = previous.items[i.id];

  for (let k = 0; k < todo.length; k += BATCH) {
    const ids = todo.slice(k, k + BATCH).map((i) => i.id);
    const rendered = await page.evaluate(async (ids) => {
      const { ASSET_CATALOG } = await import('/src/data/assets/catalog.ts');
      const { withAllModels } = await import('/src/data/assets/models.ts');
      const { renderThumbsForExport } = await import('/src/features/library/thumbnails.ts');
      return renderThumbsForExport(withAllModels(ASSET_CATALOG).filter((a) => ids.includes(a.id)));
    }, ids);
    for (const r of rendered) {
      const b64 = r.dataUrl.replace(/^data:image\/\w+;base64,/, '');
      await writeFile(path.join(outDir, r.file), Buffer.from(b64, 'base64'));
      manifest.items[r.id] = { file: r.file, fp: r.fp };
    }
    console.log(`rendered ${Math.min(k + BATCH, todo.length)}/${todo.length}`);
  }

  // Sorted keys keep the manifest diff small; files no item uses any more are removed.
  manifest.items = Object.fromEntries(Object.entries(manifest.items).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(manifestPath, JSON.stringify(manifest, null, 1) + '\n');
  const keep = new Set(Object.values(manifest.items).map((i) => i.file));
  for (const f of await readdir(outDir)) if (f.endsWith('.webp') && !keep.has(f)) await rm(path.join(outDir, f));
  console.log(`manifest: ${Object.keys(manifest.items).length} thumbnails`);

  // Material swatches (built-in and pack materials). Cheap enough to re-render every time.
  const sw = await page.evaluate(async () => {
    const { MATERIAL_CATALOG } = await import('/src/data/materials/catalog.ts');
    const { renderSwatchesForExport, SWATCH_VERSION } = await import('/src/features/materials/swatchFiles.ts');
    const { tintedPatternUrl } = await import('/src/features/materials/textureCache.ts');
    const r = await renderSwatchesForExport(MATERIAL_CATALOG, tintedPatternUrl);
    return { version: SWATCH_VERSION, ...r };
  });
  await mkdir(swatchDir, { recursive: true });
  const swatches = { version: sw.version, files: {}, ids: {} };
  for (const x of sw.files.sort((a, b) => a.fp.localeCompare(b.fp))) {
    const file = `${x.fp}.webp`;
    await writeFile(path.join(swatchDir, file), Buffer.from(x.dataUrl.replace(/^data:image\/\w+;base64,/, ''), 'base64'));
    swatches.files[x.fp] = { file, tile: x.tile };
  }
  swatches.ids = Object.fromEntries(Object.entries(sw.ids).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(path.join(swatchDir, 'manifest.json'), JSON.stringify(swatches, null, 1) + '\n');
  const keepSw = new Set(Object.values(swatches.files).map((x) => x.file));
  for (const f of await readdir(swatchDir)) if (f.endsWith('.webp') && !keepSw.has(f)) await rm(path.join(swatchDir, f));
  console.log(`swatches: ${sw.files.length} files for ${Object.keys(swatches.ids).length} materials`);
} finally {
  await browser.close();
  await server.close();
}

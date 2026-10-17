#!/usr/bin/env node
/**
 * Downloads Neest's curated CC0 photo texture sets (ambientCG + Poly Haven)
 * into public/textures/<set-id>/ and writes public/textures/manifest.json.
 *
 *   npm run textures                 fetch missing sets
 *   npm run textures -- --force      re-encode every set (downloads are cached)
 *   npm run textures -- --only a,b   limit to some set ids
 *   npm run textures -- --prune      delete folders of sets no longer listed
 *
 * The set list lives in src/data/materials/photoSets.json (shared with the app).
 * Each set gets colour (sRGB), normal (OpenGL convention) and roughness maps,
 * re-encoded as WebP, plus a 256 px swatch for the material pickers.
 * Colour maps are stored as near-neutral "variation" maps: the photo's
 * luminance with a little of its own hue variation, scaled to average like a
 * procedural tile. The material's base colour then tints it (multiply model),
 * so one set serves many colours without amplifying a dim channel into noise.
 * The manifest records source, asset id, licence and URL, the original photo
 * colour, and the average linear colour and roughness the renderer uses to keep
 * the material's base colour and roughness meaning the same as for procedural
 * textures. Already-downloaded sets are skipped, so the script is idempotent.
 */
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SETS_FILE = path.join(ROOT, 'src/data/materials/photoSets.json');
const OUT_DIR = path.join(ROOT, 'public/textures');
const CACHE_DIR = path.join(tmpdir(), 'neest-texture-downloads');
const MANIFEST = path.join(OUT_DIR, 'manifest.json');
const MAPS = ['color', 'normal', 'roughness'];
const QUALITY = { color: 80, normal: 84, roughness: 72, swatch: 78 };
const SWATCH_SIZE = 256;
/** Bump when the processing changes so existing outputs are re-encoded (downloads stay cached). */
const PIPELINE = 2;
/** Average linear value of a procedural near-white tile (sRGB ≈ 0.8). */
const TARGET_LINEAR = 0.6;
const UA = { 'User-Agent': 'Neest-texture-fetch/1.0 (+https://github.com/westmere7/Neest)' };

const args = process.argv.slice(2);
const force = args.includes('--force');
const prune = args.includes('--prune');
const onlyArg = args.find((a) => a.startsWith('--only'));
const only = onlyArg
  ? new Set((onlyArg.includes('=') ? onlyArg.split('=')[1] : args[args.indexOf(onlyArg) + 1] ?? '').split(',').filter(Boolean))
  : null;

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error('sharp is not installed. Run `npm install` first (it is a dev dependency).');
  process.exit(1);
}

const SOURCES = {
  ambientcg: { name: 'ambientCG', license: 'CC0 1.0 Universal', page: (id) => `https://ambientcg.com/a/${id}` },
  polyhaven: { name: 'Poly Haven', license: 'CC0 1.0 Universal', page: (id) => `https://polyhaven.com/a/${id}` },
};

async function fetchOk(url, what) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: UA, redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (err) {
      if (attempt >= 3) throw new Error(`${what}: ${err.message} (${url})`);
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
}

/** Downloads a URL into the cache folder (reused across runs). */
async function cached(url, name) {
  await mkdir(CACHE_DIR, { recursive: true });
  const file = path.join(CACHE_DIR, name);
  if (existsSync(file)) return readFile(file);
  const buf = Buffer.from(await (await fetchOk(url, name)).arrayBuffer());
  await writeFile(file, buf);
  return buf;
}

/** ambientCG: one zip per resolution with *_Color, *_NormalGL, *_Roughness JPGs. */
async function sourceAmbientCG(set) {
  const res = set.resolution >= 2048 ? '2K' : '1K';
  const api = `https://ambientcg.com/api/v2/full_json?type=Material&id=${encodeURIComponent(set.assetId)}&include=downloadData`;
  const json = await (await fetchOk(api, `${set.assetId} metadata`)).json();
  const asset = json.foundAssets?.find((a) => a.assetId === set.assetId);
  if (!asset) throw new Error(`ambientCG asset ${set.assetId} not found`);
  const downloads = Object.values(asset.downloadFolders ?? {}).flatMap((f) =>
    Object.values(f.downloadFiletypeCategories ?? {}).flatMap((c) => c.downloads ?? []),
  );
  const dl = downloads.find((d) => d.attribute === `${res}-JPG`);
  if (!dl) throw new Error(`ambientCG ${set.assetId} has no ${res}-JPG download`);
  const zip = unzipSync(new Uint8Array(await cached(dl.downloadLink, dl.fileName)));
  const pick = (suffix) => {
    const key = Object.keys(zip).find((k) => k.toLowerCase().endsWith(`_${suffix}.jpg`));
    return key ? Buffer.from(zip[key]) : null;
  };
  return {
    color: pick('color'),
    normal: pick('normalgl'),
    roughness: pick('roughness'),
    url: SOURCES.ambientcg.page(set.assetId),
    download: dl.downloadLink,
  };
}

/** Poly Haven: individual JPG maps per resolution. */
async function sourcePolyHaven(set) {
  const res = set.resolution >= 2048 ? '2k' : '1k';
  const files = await (await fetchOk(`https://api.polyhaven.com/files/${encodeURIComponent(set.assetId)}`, `${set.assetId} files`)).json();
  const get = async (key) => {
    const f = files[key]?.[res]?.jpg;
    return f ? cached(f.url, path.basename(new URL(f.url).pathname)) : null;
  };
  return {
    color: await get('Diffuse'),
    normal: await get('nor_gl'),
    roughness: await get('Rough'),
    url: SOURCES.polyhaven.page(set.assetId),
    download: `https://api.polyhaven.com/files/${set.assetId}`,
  };
}

const srgbToLinear = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const linearToSrgb = (v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);
const hex = (rgb) => '#' + rgb.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('');
const round = (v, d = 4) => Math.round(v * 10 ** d) / 10 ** d;

/** Average linear RGB of a colour map, average value of a roughness map. */
async function stats(dir) {
  const { data, info } = await sharp(path.join(dir, 'color.webp')).resize(128, 128).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const sum = [0, 0, 0];
  for (let i = 0; i < data.length; i += info.channels) for (let c = 0; c < 3; c++) sum[c] += srgbToLinear(data[i + c] / 255);
  const n = data.length / info.channels;
  const meanLinear = sum.map((s) => s / n);
  let meanRoughness = null;
  if (existsSync(path.join(dir, 'roughness.webp'))) {
    const r = await sharp(path.join(dir, 'roughness.webp')).resize(128, 128).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    let s = 0;
    for (let i = 1; i < r.data.length; i += r.info.channels) s += r.data[i] / 255; // green channel, as three.js reads it
    meanRoughness = round(s / (r.data.length / r.info.channels), 3);
  }
  return { meanLinear: meanLinear.map((v) => round(v)), meanColor: hex(meanLinear.map(linearToSrgb)), meanRoughness };
}

/**
 * Neutralises a colour map: per pixel, luminance plus a weighted share of the
 * photo's own (mean-normalised) chroma. Strongly coloured photos (red velvet,
 * orange wood) keep less chroma. Then scales toward TARGET_LINEAR without
 * clipping more than the brightest 0.5 %. Returns the original average colour.
 */
async function encodeColor(buf, size, file) {
  const { data, info } = await sharp(buf).resize(size, size, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  const n = data.length / ch;
  const lin = new Float32Array(256);
  for (let i = 0; i < 256; i++) lin[i] = srgbToLinear(i / 255);
  const mean = [0, 0, 0];
  for (let i = 0; i < data.length; i += ch) for (let c = 0; c < 3; c++) mean[c] += lin[data[i + c]];
  for (let c = 0; c < 3; c++) mean[c] = Math.max(mean[c] / n, 1e-4);
  const meanL = 0.2126 * mean[0] + 0.7152 * mean[1] + 0.0722 * mean[2];
  const balance = mean.map((m) => meanL / m);
  const weight = Math.min(0.5, (0.5 * 1.5) / Math.max(1, ...balance));
  const out = new Float32Array(n * 3);
  const hist = new Uint32Array(1024);
  for (let p = 0, i = 0; p < n; p++, i += ch) {
    const r = lin[data[i]], g = lin[data[i + 1]], b = lin[data[i + 2]];
    const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    let peak = 0;
    for (let c = 0; c < 3; c++) {
      const v = L + weight * ([r, g, b][c] * balance[c] - L);
      out[p * 3 + c] = v;
      if (v > peak) peak = v;
    }
    hist[Math.min(1023, Math.floor(peak * 1023))]++;
  }
  let acc = 0;
  let q = 1;
  for (let k = 1023; k >= 0; k--) {
    acc += hist[k];
    if (acc > n * 0.005) {
      q = (k + 1) / 1023;
      break;
    }
  }
  const scale = Math.min(TARGET_LINEAR / meanL, 0.98 / Math.max(q, 1e-3));
  const bytes = Buffer.alloc(n * 3);
  for (let k = 0; k < n * 3; k++) bytes[k] = Math.round(linearToSrgb(Math.min(1, Math.max(0, out[k] * scale))) * 255);
  await sharp(bytes, { raw: { width: info.width, height: info.height, channels: 3 } })
    .webp({ quality: QUALITY.color, effort: 5, smartSubsample: true })
    .toFile(file);
  return hex(mean.map(linearToSrgb));
}

async function encode(buf, map, size, file) {
  let img = sharp(buf).resize(size, size, { fit: 'fill' });
  if (map === 'roughness') img = img.greyscale();
  await img.webp({ quality: QUALITY[map], effort: 5, smartSubsample: map === 'color' }).toFile(file);
}

async function dirBytes(dir) {
  let total = 0;
  for (const f of await readdir(dir)) total += (await stat(path.join(dir, f))).size;
  return total;
}

async function processSet(set, previous) {
  const dir = path.join(OUT_DIR, set.id);
  const upToDate =
    !force &&
    previous &&
    previous.assetId === set.assetId &&
    previous.resolution === set.resolution &&
    previous.pipeline === PIPELINE &&
    previous.maps.color &&
    Object.values(previous.maps).every((file) => existsSync(path.join(dir, file)));
  let meta;
  if (upToDate) {
    meta = { url: previous.url, download: previous.download, maps: previous.maps, photoColor: previous.photoColor };
    console.log(`  ✓ ${set.id} (already downloaded)`);
  } else {
    const src = set.source === 'polyhaven' ? await sourcePolyHaven(set) : await sourceAmbientCG(set);
    if (!src.color) throw new Error(`${set.id}: no colour map in ${set.source}/${set.assetId}`);
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
    const maps = {};
    let photoColor = null;
    for (const m of MAPS) {
      if (!src[m]) continue;
      const file = path.join(dir, `${m}.webp`);
      if (m === 'color') photoColor = await encodeColor(src[m], set.resolution, file);
      else await encode(src[m], m, set.resolution, file);
      maps[m] = `${m}.webp`;
    }
    meta = { url: src.url, download: src.download, maps, photoColor };
    console.log(`  ↓ ${set.id} ← ${SOURCES[set.source].name} ${set.assetId} (${Object.keys(maps).join(', ')})`);
  }
  // Small preview for swatches, derived locally from the colour map.
  if (!existsSync(path.join(dir, 'swatch.webp')) || !upToDate) {
    await sharp(path.join(dir, 'color.webp')).resize(SWATCH_SIZE, SWATCH_SIZE).webp({ quality: QUALITY.swatch }).toFile(path.join(dir, 'swatch.webp'));
  }
  meta.maps = { ...meta.maps, swatch: 'swatch.webp' };
  const s = await stats(dir);
  return {
    id: set.id,
    name: set.name,
    source: SOURCES[set.source].name,
    assetId: set.assetId,
    url: meta.url,
    download: meta.download,
    license: SOURCES[set.source].license,
    size: set.size,
    resolution: set.resolution,
    pipeline: PIPELINE,
    maps: meta.maps,
    /** Average colour of the original photo (the processed map is near-neutral). */
    photoColor: meta.photoColor,
    ...s,
    bytes: await dirBytes(dir),
  };
}

async function main() {
  const { sets } = JSON.parse(await readFile(SETS_FILE, 'utf8'));
  await mkdir(OUT_DIR, { recursive: true });
  let previous = {};
  try {
    previous = JSON.parse(await readFile(MANIFEST, 'utf8')).sets ?? {};
  } catch {
    previous = {};
  }
  const todo = sets.filter((s) => !only || only.has(s.id));
  console.log(`Neest photo textures → ${path.relative(ROOT, OUT_DIR)} (${todo.length} set${todo.length === 1 ? '' : 's'})`);
  const results = { ...previous };
  const failures = [];
  const queue = [...todo];
  const worker = async () => {
    for (let set = queue.shift(); set; set = queue.shift()) {
      try {
        results[set.id] = await processSet(set, previous[set.id]);
      } catch (err) {
        failures.push(`${set.id}: ${err.message}`);
        console.warn(`  ✗ ${set.id}: ${err.message}`);
      }
    }
  };
  await Promise.all([worker(), worker(), worker()]);

  // Keep the manifest in list order and limited to listed sets with files on disk.
  const listed = new Set(sets.map((s) => s.id));
  const ordered = {};
  for (const s of sets) if (results[s.id] && existsSync(path.join(OUT_DIR, s.id, 'color.webp'))) ordered[s.id] = results[s.id];
  const stale = (await readdir(OUT_DIR, { withFileTypes: true })).filter((d) => d.isDirectory() && !listed.has(d.name)).map((d) => d.name);
  if (stale.length) {
    if (prune) {
      for (const d of stale) await rm(path.join(OUT_DIR, d), { recursive: true, force: true });
      console.log(`Pruned ${stale.length} unlisted folder(s): ${stale.join(', ')}`);
    } else console.log(`Unlisted folders (use --prune to delete): ${stale.join(', ')}`);
  }
  const manifest = {
    $comment: 'Generated by tools/fetch-textures.mjs. All sets are CC0 (public domain); attribution is appreciated, not required.',
    version: 1,
    sets: ordered,
  };
  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  const credits = [
    '# Photo textures',
    '',
    'Generated by `npm run textures` (tools/fetch-textures.mjs) from the list in `src/data/materials/photoSets.json`.',
    'Every set is **CC0 1.0** (public domain) from [ambientCG](https://ambientcg.com) or [Poly Haven](https://polyhaven.com).',
    'Maps were resized and re-encoded as WebP. Delete this folder to fall back to Neest\'s procedural textures.',
    '',
    '| Set | Source | Asset | Tile size | Pixels |',
    '| --- | --- | --- | --- | --- |',
    ...Object.values(ordered).map((s) => `| ${s.id} | ${s.source} | [${s.assetId}](${s.url}) | ${s.size} m | ${s.resolution} |`),
    '',
  ].join('\n');
  await writeFile(path.join(OUT_DIR, 'CREDITS.md'), credits);
  const total = Object.values(ordered).reduce((a, s) => a + s.bytes, 0);
  console.log(`Done: ${Object.keys(ordered).length}/${sets.length} sets, ${(total / 1048576).toFixed(1)} MB.`);
  if (failures.length) {
    console.error(`${failures.length} set(s) failed:\n  ${failures.join('\n  ')}`);
    process.exitCode = 1;
  }
}

await main();

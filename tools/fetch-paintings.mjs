// Fetches the Paintings pack's artworks (npm run paintings).
//
// Public-domain works only: the Art Institute of Chicago open-access API (CC0 images, IIIF) and
// Wikimedia Commons files tagged public domain. Each image is resized and laid out on a square
// tile rolled by half in both directions, so that a canvas whose UVs run from −size/2 to +size/2
// (box faces are UV-projected in metres about their centre) with texture scale = max(w, h) shows
// the painting exactly once. Writes public/art/<id>.webp, src/data/assets/paintings.json (the
// list the pack reads) and public/art/CREDITS.md. Downloads are cached in the OS temp folder.
//   --only id1,id2   process just these
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'public', 'art');
const dataPath = path.join(root, 'src', 'data', 'assets', 'paintings.json');
const cache = path.join(os.tmpdir(), 'neest-paintings');
const UA = { 'User-Agent': 'NeestPlanner/1.0 (https://github.com/westmere7/Neest; paintings pack)', 'AIC-User-Agent': 'NeestPlanner (https://github.com/westmere7/Neest)' };
const TILE = 768;
const only = (() => {
  const i = process.argv.indexOf('--only');
  return i > 0 ? new Set(process.argv[i + 1].split(',')) : null;
})();

/** kind: abstract | landscape | animals. `aic` artwork ids or Commons file titles. Optional `long` = metres for the longer side. */
const LIST = [
  // Abstract & modern
  { id: 'kandinsky-improvisation-30', kind: 'abstract', aic: 8991 },
  { id: 'kandinsky-green-center', kind: 'abstract', aic: 8987 },
  { id: 'kandinsky-troika', kind: 'abstract', aic: 8983 },
  { id: 'kandinsky-two-poplars', kind: 'abstract', aic: 8980 },
  { id: 'kandinsky-houses-murnau', kind: 'abstract', aic: 129849 },
  { id: 'kandinsky-composition-vii', kind: 'abstract', commons: 'File:Vassily Kandinsky, 1913 - Composition 7.jpg', title: 'Composition VII', artist: 'Wassily Kandinsky', date: '1913', long: 1.5 },
  { id: 'kandinsky-yellow-red-blue', kind: 'abstract', commons: 'File:Kandinsky - Jaune Rouge Bleu.jpg', title: 'Yellow-Red-Blue', artist: 'Wassily Kandinsky', date: '1925', long: 1.4 },
  { id: 'mondrian-composition-ii', kind: 'abstract', commons: 'File:Piet Mondriaan, 1930 - Mondrian Composition II in Red, Blue, and Yellow.jpg', title: 'Composition II in Red, Blue, and Yellow', artist: 'Piet Mondrian', date: '1930', long: 0.6 },
  { id: 'malevich-suprematist-composition', kind: 'abstract', commons: 'File:Suprematist Composition - Kazimir Malevich.jpg', title: 'Suprematist Composition', artist: 'Kazimir Malevich', date: '1916', long: 0.9 },
  { id: 'malevich-black-square', kind: 'abstract', commons: 'File:Kazimir Malevich, 1915, Black Suprematic Square, oil on linen canvas, 79.5 x 79.5 cm, Tretyakov Gallery, Moscow.jpg', title: 'Black Suprematic Square', artist: 'Kazimir Malevich', date: '1915', long: 0.8 },
  { id: 'klee-castle-and-sun', kind: 'abstract', commons: 'File:Burg und Sonne - Klee.jpg', title: 'Castle and Sun', artist: 'Paul Klee', date: '1928', long: 0.6 },
  { id: 'af-klint-ten-largest-3', kind: 'abstract', commons: 'File:Hilma af Klint - The Ten Largest No. 3 - Youth - 1907.jpg', title: 'The Ten Largest, No. 3, Youth', artist: 'Hilma af Klint', date: '1907', long: 1.6 },
  { id: 'delaunay-joie-de-vivre', kind: 'abstract', commons: 'File:Robert Delaunay - Rythme, Joie de vivre.jpg', title: 'Rhythm, Joy of Life', artist: 'Robert Delaunay', date: '1930', long: 1.5 },
  { id: 'marc-bewitched-mill', kind: 'abstract', aic: 9021 },
  { id: 'hartley-dark-mountain', kind: 'abstract', aic: 65908 },
  // Landscapes
  { id: 'monet-water-lilies', kind: 'landscape', aic: 16568 },
  { id: 'monet-stacks-end-of-summer', kind: 'landscape', aic: 64818 },
  { id: 'monet-cliff-walk-pourville', kind: 'landscape', aic: 14620 },
  { id: 'monet-poppy-field', kind: 'landscape', aic: 4783 },
  { id: 'monet-irises', kind: 'landscape', aic: 4887 },
  { id: 'cezanne-bay-of-marseille', kind: 'landscape', aic: 16487 },
  { id: 'van-gogh-fishing-in-spring', kind: 'landscape', aic: 109314 },
  { id: 'seurat-grande-jatte', kind: 'landscape', aic: 27992 },
  { id: 'caillebotte-paris-rainy-day', kind: 'landscape', aic: 20684 },
  { id: 'pissarro-snow-louveciennes', kind: 'landscape', aic: 45838 },
  { id: 'church-cotopaxi', kind: 'landscape', aic: 76571 },
  { id: 'inness-catskill-mountains', kind: 'landscape', aic: 68388 },
  { id: 'hokusai-great-wave', kind: 'landscape', aic: 24645, long: 0.6 },
  { id: 'hiroshige-mishima-morning-mist', kind: 'landscape', aic: 10926, long: 0.6 },
  { id: 'hiroshige-kanbara-evening-snow', kind: 'landscape', aic: 25613, long: 0.6 },
  // Animals
  { id: 'delacroix-lion-hunt', kind: 'animals', aic: 81505 },
  { id: 'andrieu-tiger-resting', kind: 'animals', aic: 884, long: 0.9 },
  { id: 'bonheur-horse-fair-study', kind: 'animals', aic: 93781 },
  { id: 'cuyp-vianen-cattle', kind: 'animals', aic: 181702, long: 0.9 },
  { id: 'pissarro-rabbit-warren-snow', kind: 'animals', aic: 20530 },
  { id: 'steinlen-cat-on-cushion', kind: 'animals', aic: 51719, long: 0.7 },
  { id: 'koryusai-cat-goldfish', kind: 'animals', aic: 21177, long: 0.5 },
  { id: 'hokusai-cranes-snowy-pine', kind: 'animals', aic: 21720, long: 0.8 },
  { id: 'hiroshige-crane-waves-sun', kind: 'animals', aic: 77320, long: 0.8 },
  { id: 'hiroshige-rabbits-moonlight', kind: 'animals', aic: 19013, long: 0.5 },
  { id: 'hiroshige-macaw-pine', kind: 'animals', aic: 10922, long: 0.8 },
  { id: 'hiroshige-oystercatchers', kind: 'animals', aic: 19026, long: 0.6 },
  { id: 'chosui-portrait-of-rabbit', kind: 'animals', aic: 42068, long: 0.5 },
  { id: 'bokushin-multitudes-of-cranes', kind: 'animals', aic: 41906, long: 0.6 },
];

async function json(url) {
  for (let i = 0; i < 6; i++) {
    const r = await fetch(url, { headers: UA });
    const t = await r.text();
    if (r.ok && t.startsWith('{')) return JSON.parse(t);
    await new Promise((res) => setTimeout(res, 2500 * (i + 1)));
  }
  throw new Error(`fetch failed: ${url}`);
}

async function download(url, key) {
  await mkdir(cache, { recursive: true });
  const file = path.join(cache, `${key}.img`);
  if (existsSync(file)) return readFile(file);
  for (let i = 0; i < 5; i++) {
    const r = await fetch(url, { headers: UA });
    if (r.ok) {
      const buf = Buffer.from(await r.arrayBuffer());
      await writeFile(file, buf);
      return buf;
    }
    await new Promise((res) => setTimeout(res, 3000 * (i + 1)));
  }
  throw new Error(`download failed: ${url}`);
}

const strip = (html) => String(html ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

async function meta(p) {
  if (p.aic) {
    const a = (await json(`https://api.artic.edu/api/v1/artworks/${p.aic}?fields=id,title,artist_title,date_display,image_id,dimensions_detail,is_public_domain`)).data;
    if (!a.is_public_domain) throw new Error(`${p.id}: not public domain`);
    const dim = (a.dimensions_detail ?? []).find((x) => x.width && x.height);
    return {
      title: a.title,
      artist: a.artist_title ?? 'Unknown artist',
      date: a.date_display,
      image: `https://www.artic.edu/iiif/2/${a.image_id}/full/843,/0/default.jpg`,
      realCm: dim ? [dim.width, dim.height] : null,
      source: `https://www.artic.edu/artworks/${p.aic}`,
      licence: 'CC0 1.0 (Art Institute of Chicago open access)',
    };
  }
  const q = await json(`https://commons.wikimedia.org/w/api.php?format=json&action=query&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1200&titles=${encodeURIComponent(p.commons)}`);
  const page = Object.values(q.query.pages)[0];
  const ii = page.imageinfo?.[0];
  if (!ii) throw new Error(`${p.id}: no Commons file`);
  const lic = strip(ii.extmetadata?.LicenseShortName?.value);
  if (!/public domain/i.test(lic)) throw new Error(`${p.id}: licence is ${lic}`);
  return { title: p.title, artist: p.artist, date: p.date, image: ii.thumburl ?? ii.url, realCm: null, source: ii.descriptionurl, licence: `Public domain (Wikimedia Commons: ${lic})` };
}

/** Canvas size in metres: the real size, kept within wall-friendly bounds. */
function canvasSize(p, m, aspect) {
  let long = p.long;
  if (!long && m.realCm) long = Math.max(m.realCm[0], m.realCm[1]) / 100;
  long = Math.min(1.6, Math.max(0.45, long ?? 1));
  const w = aspect >= 1 ? long : long * aspect;
  const h = aspect >= 1 ? long / aspect : long;
  const r = (x) => Math.round(x * 1000) / 1000;
  return { w: r(w), h: r(h) };
}

/** Square tile with the painting centred, then rolled by half in x and y (see the header). */
async function tile(buf, w, h) {
  const S = Math.max(w, h);
  const pw = Math.max(8, Math.round((TILE * w) / S));
  const ph = Math.max(8, Math.round((TILE * h) / S));
  const img = sharp(buf).rotate().resize(pw, ph, { fit: 'fill' }).removeAlpha();
  const raw = await img.raw().toBuffer();
  const { dominant } = await sharp(raw, { raw: { width: pw, height: ph, channels: 3 } }).stats();
  const out = Buffer.alloc(TILE * TILE * 3);
  for (let i = 0; i < TILE * TILE; i++) {
    out[i * 3] = dominant.r;
    out[i * 3 + 1] = dominant.g;
    out[i * 3 + 2] = dominant.b;
  }
  const x0 = Math.floor((TILE - pw) / 2);
  const y0 = Math.floor((TILE - ph) / 2);
  for (let y = 0; y < ph; y++) {
    for (let x = 0; x < pw; x++) {
      // Centre the painting, then roll by half the tile.
      const tx = (x0 + x + TILE / 2) % TILE;
      const ty = (y0 + y + TILE / 2) % TILE;
      const s = (y * pw + x) * 3;
      const d = (ty * TILE + tx) * 3;
      out[d] = raw[s];
      out[d + 1] = raw[s + 1];
      out[d + 2] = raw[s + 2];
    }
  }
  return sharp(out, { raw: { width: TILE, height: TILE, channels: 3 } }).webp({ quality: 82 }).toBuffer();
}

await mkdir(outDir, { recursive: true });
const previous = existsSync(dataPath) ? JSON.parse(await readFile(dataPath, 'utf8')) : [];
const byId = new Map(previous.map((x) => [x.id, x]));
for (const p of LIST) {
  if (only && !only.has(p.id)) continue;
  try {
    const m = await meta(p);
    const buf = await download(m.image, createHash('sha1').update(m.image).digest('hex').slice(0, 16));
    const info = await sharp(buf).metadata();
    const aspect = (info.width ?? 1) / (info.height ?? 1);
    const size = canvasSize(p, m, aspect);
    const webp = await tile(buf, size.w, size.h);
    await writeFile(path.join(outDir, `${p.id}.webp`), webp);
    byId.set(p.id, { id: p.id, kind: p.kind, title: m.title, artist: m.artist, date: m.date, w: size.w, h: size.h, file: `art/${p.id}.webp`, hash: createHash('sha1').update(webp).digest('hex').slice(0, 10), source: m.source, licence: m.licence });
    console.log(`${p.id}: ${size.w} × ${size.h} m, ${(webp.length / 1024).toFixed(0)} KB`);
  } catch (e) {
    console.warn(`skipped ${p.id}: ${e.message}`);
  }
  await new Promise((r) => setTimeout(r, 400));
}
const ids = new Set(LIST.map((p) => p.id));
const list = [...byId.values()].filter((x) => ids.has(x.id)).sort((a, b) => LIST.findIndex((p) => p.id === a.id) - LIST.findIndex((p) => p.id === b.id));
await writeFile(dataPath, JSON.stringify(list, null, 1) + '\n');
const credits = ['# Paintings', '', 'Public-domain artworks used by the Paintings pack (`npm run paintings`, tools/fetch-paintings.mjs).', ''];
for (const x of list) credits.push(`- **${x.title}**, ${x.artist}, ${x.date}. ${x.licence}. ${x.source}`);
await writeFile(path.join(outDir, 'CREDITS.md'), credits.join('\n') + '\n');
console.log(`${list.length} paintings`);

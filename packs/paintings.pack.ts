/**
 * Paintings — 44 public-domain artworks at their real sizes: abstract and modern (Kandinsky,
 * Mondrian, Malevich, Klee, af Klint, Delaunay, Marc), landscapes (Monet, Cézanne, Van Gogh,
 * Seurat, Caillebotte, Pissarro, Church, Hokusai, Hiroshige) and animals (Delacroix, Bonheur,
 * Cuyp, Steinlen and Japanese bird-and-flower prints).
 *
 * Images come from the Art Institute of Chicago open-access collection (CC0) and Wikimedia
 * Commons (public domain); `npm run paintings` (tools/fetch-paintings.mjs) downloads them into
 * public/art/ and lists them in src/data/assets/paintings.json, with credits in
 * public/art/CREDITS.md. Each image sits on a square tile rolled by half, so a canvas exactly
 * w × h with texture scale max(w, h) shows the painting once, edge to edge (box faces are
 * UV-mapped in metres about their centre). Resized paintings keep that: the artwork panel is built
 * at the painting's real size and stretched to the new canvas by its part scale (UVs come from the
 * unscaled box), while the frame, liner and mount are built at the new size.
 *
 * Frames by kind: abstracts float in a slim gallery frame, landscapes and Western animal
 * paintings get a wide gilt frame with a linen liner, and prints sit behind a white mount.
 * Every painting has frame variants.
 */
import { clamp, defineItem, definePack, frame4, matSlot, span, type AssetPresetVariant, type PackItem, type PackMaterial, type Part } from '@/packs/kit';
import PAINTINGS from '@/data/assets/paintings.json';

interface Painting {
  id: string;
  kind: 'abstract' | 'landscape' | 'animals';
  title: string;
  artist: string;
  date: string;
  w: number;
  h: number;
  file: string;
  hash: string;
}

type Style = 'gallery' | 'gilt' | 'mount';

/** Shorter names for the library (titles from the museums can run long). */
const NAMES: Record<string, string> = {
  'hokusai-great-wave': 'The Great Wave off Kanagawa',
  'hiroshige-mishima-morning-mist': 'Mishima: Morning Mist',
  'hiroshige-kanbara-evening-snow': 'Kanbara: Evening Snow',
  'seurat-grande-jatte': 'A Sunday on La Grande Jatte',
  'van-gogh-fishing-in-spring': 'Fishing in Spring, Pont de Clichy',
  'cuyp-vianen-cattle': 'View of Vianen with Cattle',
  'cezanne-bay-of-marseille': 'The Bay of Marseille',
  'steinlen-cat-on-cushion': 'Winter: Cat on a Cushion',
  'kandinsky-improvisation-30': 'Improvisation No. 30',
  'af-klint-ten-largest-3': 'The Ten Largest, No. 3',
};
const ARTISTS: Record<string, string> = {
  'Vasily Kandinsky': 'Wassily Kandinsky',
  'Paul Cezanne': 'Paul Cézanne',
  'Théophile-Alexandre Pierre Steinlen': 'Théophile Steinlen',
};
const PRINTS = /^(hokusai|hiroshige|koryusai|chosui|bokushin)-/;

const styleOf = (p: Painting): Style => (PRINTS.test(p.id) ? 'mount' : p.kind === 'abstract' ? 'gallery' : 'gilt');

const GROUP: Record<Painting['kind'], string> = { abstract: 'Abstract paintings', landscape: 'Landscape paintings', animals: 'Animal paintings' };

const base = (): string => {
  const b = (import.meta.env?.BASE_URL as string | undefined) ?? '/';
  return b.endsWith('/') ? b : `${b}/`;
};

const list = PAINTINGS as Painting[];

const materials: PackMaterial[] = [
  { id: 'antique-gilt', name: 'Antique gilt', category: 'metal', color: '#b48a3c', roughness: 0.42, metalness: 0.75 },
  { id: 'aged-silver-leaf', name: 'Aged silver leaf', category: 'metal', color: '#b3b0a6', roughness: 0.4, metalness: 0.7 },
  { id: 'black-gilt-edge', name: 'Black lacquer frame', category: 'paint', color: '#1b1a19', roughness: 0.35 },
  { id: 'canvas-linen', name: 'Canvas linen', category: 'fabric', color: '#e6dfd0', roughness: 0.9, pattern: { id: 'weave', scale: 0.04, contrast: 0.25 } },
  { id: 'museum-mount', name: 'Museum mount board', category: 'solid', color: '#f3f0e7', roughness: 0.95 },
  ...list.map(
    (p): PackMaterial => ({
      id: `art-${p.id}`,
      name: `Art: ${NAMES[p.id] ?? p.title}`,
      category: 'solid',
      color: '#ffffff',
      roughness: 0.82,
      image: { color: p.id, scale: Math.max(p.w, p.h) },
    }),
  ),
];

const textures = Object.fromEntries(list.map((p) => [p.id, `${base()}${p.file}?v=${p.hash}`]));

const VARIANTS: Record<Style, [string, string, string][]> = {
  gallery: [
    ['Natural oak float', 'wood-oak-natural', 'canvas-linen'],
    ['White float', 'paint-pure-white', 'canvas-linen'],
    ['Walnut float', 'wood-walnut', 'canvas-linen'],
    ['Gilt float', 'antique-gilt', 'canvas-linen'],
  ],
  gilt: [
    ['Dark walnut frame', 'wood-walnut', 'canvas-linen'],
    ['Black lacquer frame', 'black-gilt-edge', 'canvas-linen'],
    ['Silver leaf frame', 'aged-silver-leaf', 'canvas-linen'],
    ['Pale oak frame', 'wood-oak-light', 'museum-mount'],
  ],
  mount: [
    ['Black frame', 'paint-soft-black', 'museum-mount'],
    ['Walnut frame', 'wood-walnut', 'museum-mount'],
    ['White frame', 'paint-pure-white', 'museum-mount'],
    ['Oak frame, linen mount', 'wood-oak-natural', 'canvas-linen'],
  ],
};
const DEFAULT_FRAME: Record<Style, [string, string]> = {
  gallery: ['paint-soft-black', 'canvas-linen'],
  gilt: ['antique-gilt', 'canvas-linen'],
  mount: ['wood-oak-light', 'museum-mount'],
};

/** Frame border around the canvas on each side, and the overall depth. */
function border(style: Style, p: Painting): { b: number; d: number; mat: number } {
  const s = Math.min(p.w, p.h);
  if (style === 'gallery') return { b: 0.024, d: 0.045, mat: 0 };
  if (style === 'gilt') {
    const f = clamp(s * 0.09, 0.06, 0.11);
    return { b: f + 0.025, d: 0.07, mat: 0.025 };
  }
  const mat = clamp(s * 0.14, 0.05, 0.09);
  return { b: 0.022 + mat, d: 0.03, mat };
}

const r3 = (x: number) => Math.round(x * 1000) / 1000;

/** The artwork panel: the real-size picture stretched onto a canvas of cw × ch (see the header). */
function artPanel(p: Painting, cw: number, ch: number, b: number, z0: number, z1: number): Part {
  return { ...span('art', [-p.w / 2, p.w / 2], [-p.h / 2, p.h / 2], [z0, z1]), position: [0, b + ch / 2, (z0 + z1) / 2], scale: [cw / p.w, ch / p.h, 1] };
}

function build(style: Style, p: Painting, size: { w: number; h: number }): Part[] {
  const { b, d, mat } = border(style, p);
  const W = size.w;
  const H = size.h;
  const cw = Math.max(0.02, W - 2 * b);
  const ch = Math.max(0.02, H - 2 * b);
  const cx: [number, number] = [-cw / 2, cw / 2];
  const cy: [number, number] = [b, b + ch];
  const z0 = -d / 2;
  const z1 = d / 2;
  if (style === 'gallery') {
    // Stretched canvas floating in an L-section frame with a dark shadow gap.
    const t = 0.007;
    const zc = z1 - 0.006;
    return [
      ...frame4('frame', [-W / 2, W / 2], [0, H], [z0, z1], t, { plan: true }),
      span('frame', [-W / 2 + t, W / 2 - t], [t, H - t], [z0, z0 + 0.006]),
      span('liner', cx, cy, [z0 + 0.006, zc - 0.001]),
      artPanel(p, cw, ch, b, zc - 0.001, zc),
    ];
  }
  if (style === 'gilt') {
    // Stepped moulding: a wide outer band, a raised inner bead, then a linen liner to the canvas.
    const f = b - mat;
    const zArt = z1 - 0.03;
    return [
      ...frame4('frame', [-W / 2, W / 2], [0, H], [z0, z1 - 0.012], f * 0.55, { plan: true }),
      ...frame4('frame', [-W / 2 + f * 0.45, W / 2 - f * 0.45], [f * 0.45, H - f * 0.45], [z0, z1], f * 0.3),
      ...frame4('frame', [-W / 2 + f * 0.75, W / 2 - f * 0.75], [f * 0.75, H - f * 0.75], [z0, z1 - 0.018], f * 0.25),
      ...frame4('liner', [-cw / 2 - mat, cw / 2 + mat], [b - mat, b + ch + mat], [z0, zArt + 0.006], mat),
      span('liner', cx, cy, [z0, zArt - 0.001]),
      artPanel(p, cw, ch, b, zArt - 0.001, zArt),
    ];
  }
  // Print behind a white bevelled mount and a slim frame.
  const f = b - mat;
  const zm = z1 - 0.008;
  return [
    ...frame4('frame', [-W / 2, W / 2], [0, H], [z0, z1], f, { plan: true }),
    span('liner', [-W / 2 + f, W / 2 - f], [f, H - f], [z0, zm - 0.003]),
    ...frame4('liner', [-cw / 2 - mat, cw / 2 + mat], [b - mat, b + ch + mat], [zm - 0.003, zm], mat),
    artPanel(p, cw, ch, b, zm - 0.0045, zm - 0.003),
  ];
}

const kindWord: Record<Painting['kind'], string> = { abstract: 'abstract', landscape: 'landscape', animals: 'animal' };
const frameWords: Record<Style, string> = {
  gallery: 'floating in a slim black gallery frame',
  gilt: 'in a stepped antique gilt frame with a linen liner',
  mount: 'behind a white mount in a slim oak frame',
};

function item(p: Painting): PackItem {
  const style = styleOf(p);
  const { b, d } = border(style, p);
  const size = { w: r3(p.w + 2 * b), d, h: r3(p.h + 2 * b) };
  const artist = ARTISTS[p.artist] ?? p.artist;
  const date = p.date.split(',')[0];
  const surname = artist.split(' ').slice(-1)[0].toLowerCase();
  const [frame, liner] = DEFAULT_FRAME[style];
  const variants: AssetPresetVariant[] = VARIANTS[style].map(([name, f, l]) => ({
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    name,
    materials: { frame: f, liner: l },
  }));
  return defineItem({
    id: p.id,
    name: NAMES[p.id] ?? p.title,
    category: 'decor',
    type: 'decor',
    group: GROUP[p.kind],
    tags: ['painting', 'wall art', kindWord[p.kind], surname, style === 'mount' ? 'print' : 'canvas', 'art'],
    description: `${artist}, ${date}. A ${kindWord[p.kind]} work at its real size (${Math.round(p.w * 100)} × ${Math.round(p.h * 100)} cm; resizable), ${frameWords[style]}. Public domain.`,
    defaultSize: size,
    // Resizable (the picture stretches to fill the canvas); depth stays the frame's.
    minSize: { w: r3(Math.max(2 * b + 0.05, size.w * 0.4)), d, h: r3(Math.max(2 * b + 0.05, size.h * 0.4)) },
    maxSize: { w: r3(size.w * 2.5), d, h: r3(size.h * 2.5) },
    resizable: { w: true, d: false, h: true },
    mount: 'wall',
    defaultElevation: r3(Math.max(0.9, 1.55 - size.h / 2)),
    slots: [matSlot('frame', 'Frame', frame), matSlot('liner', style === 'mount' ? 'Mount' : 'Liner', liner), matSlot('art', 'Artwork', `art-${p.id}`)],
    variants,
    build: (sz) => build(style, p, sz),
  });
}

export default definePack({
  name: 'Paintings',
  version: '1.0.0',
  author: 'Neest',
  description: 'Public-domain paintings and prints at real size: abstracts, landscapes and animals, framed.',
  license: 'Public domain (artworks); CC0-1.0 (pack)',
  materials,
  textures,
  items: list.map(item),
});

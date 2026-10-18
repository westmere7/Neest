/**
 * Curtain collection — curtains, sheers and blinds for windows, doors and full glass walls, each
 * with colour and pattern variants:
 *
 * - Windows: wave curtains on a ceiling track (open and drawn), sheer wave, sheer + blackout on a
 *   double track, triple pinch pleat on a wooden pole (open and drawn), eyelet curtains (open and
 *   drawn), tab-top linen, a café curtain, a flat Roman shade, velvet drapes under an upholstered
 *   pelmet and a cellular (honeycomb) shade.
 * - Doors: a door curtain held back to one side, a thermal portière, a string curtain for doorways
 *   and sheer sash curtains for French door leaves.
 * - Glass walls (up to 12 m wide, 3.6 m tall): a floor-to-ceiling sheer (drawn or stacked to one
 *   side), sheer + blackout on a double track (open or drawn), vertical blinds and sliding panel
 *   blinds.
 *
 * Folds are real geometry: S-shaped wave sheets (a thin prism following a sine) that gather into
 * tighter, deeper waves when stacked open.
 */
import {
  box,
  clamp,
  cells,
  cyl,
  defineItem,
  definePack,
  discZ,
  matSlot,
  prism,
  range,
  rodX,
  span,
  spaced,
  sphere,
  torus,
  ring,
  type AssetPresetVariant,
  type PackItem,
  type PackMaterial,
  type PackPattern,
  type Part,
  type PlanStroke,
} from '@/packs/kit';

type V2 = [number, number];
const NP = { plan: false } as const;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ───────────────────────── Patterns ─────────────────────────

/** Vertical stripes: `bands` = [colour, width fraction] repeated across the tile. */
function stripes(id: string, name: string, bg: string, bands: [string, number, number][]): PackPattern {
  return {
    id,
    name,
    colored: true,
    normalStrength: 0.3,
    draw(ctx, size) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, size, size);
      for (const [c, x, w] of bands) {
        ctx.fillStyle = c;
        ctx.fillRect(Math.round(x * size), 0, Math.max(1, Math.round(w * size)), size);
      }
      weaveNoise(ctx, size);
    },
  };
}

/** Fine thread texture over a coloured tile (seamless: per-pixel, no neighbours). */
function weaveNoise(ctx: CanvasRenderingContext2D, size: number) {
  const img = ctx.getImageData(0, 0, size, size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const k = 1 + ((x + y) % 2 === 0 ? 0.035 : -0.035) + (y % 4 === 0 ? -0.025 : 0);
      const i = (y * size + x) * 4;
      img.data[i] = Math.min(255, img.data[i] * k);
      img.data[i + 1] = Math.min(255, img.data[i + 1] * k);
      img.data[i + 2] = Math.min(255, img.data[i + 2] * k);
    }
  ctx.putImageData(img, 0, 0);
}

function gingham(id: string, name: string, bg: string, fg: string): PackPattern {
  return {
    id,
    name,
    colored: true,
    normalStrength: 0.3,
    draw(ctx, size) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, size, size);
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = fg;
      for (const o of [0, 0.5]) {
        ctx.fillRect(o * size, 0, size / 4, size);
        ctx.fillRect(0, o * size, size, size / 4);
      }
      ctx.globalAlpha = 1;
      weaveNoise(ctx, size);
    },
  };
}

function polka(id: string, name: string, bg: string, fg: string): PackPattern {
  return {
    id,
    name,
    colored: true,
    normalStrength: 0.2,
    draw(ctx, size) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = fg;
      const r = size * 0.07;
      for (const [x, y] of [
        [0, 0],
        [size, 0],
        [0, size],
        [size, size],
        [size / 2, size / 2],
      ]) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      weaveNoise(ctx, size);
    },
  };
}

/** Diamond trellis lines (seamless: the lines run corner to corner). */
function trellis(id: string, name: string, bg: string, fg: string): PackPattern {
  return {
    id,
    name,
    colored: true,
    normalStrength: 0.3,
    draw(ctx, size) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = fg;
      ctx.lineWidth = size * 0.035;
      ctx.beginPath();
      for (const [a, b, c, d] of [
        [0, size / 2, size / 2, 0],
        [size / 2, 0, size, size / 2],
        [size, size / 2, size / 2, size],
        [size / 2, size, 0, size / 2],
      ]) {
        ctx.moveTo(a, b);
        ctx.lineTo(c, d);
      }
      ctx.stroke();
      ctx.fillStyle = fg;
      for (const [x, y] of [
        [0, size / 2],
        [size, size / 2],
        [size / 2, 0],
        [size / 2, size],
      ]) {
        ctx.beginPath();
        ctx.arc(x, y, size * 0.05, 0, Math.PI * 2);
        ctx.fill();
      }
      weaveNoise(ctx, size);
    },
  };
}

/** Ikat-style chevrons with feathered edges (zig-zag rows). */
function ikat(id: string, name: string, bg: string, fg: string): PackPattern {
  return {
    id,
    name,
    colored: true,
    normalStrength: 0.25,
    draw(ctx, size, rand) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = fg;
      const rows = 2;
      for (let r = 0; r < rows; r++) {
        const y0 = (r / rows) * size;
        for (let x = 0; x < size; x++) {
          const t = (x / size) * 2;
          const zig = (t % 1 < 0.5 ? t % 1 : 1 - (t % 1)) * 2;
          const yc = y0 + zig * (size / rows) * 0.45 + size / rows / 4;
          const jitter = (rand() - 0.5) * size * 0.03;
          ctx.fillRect(x, yc + jitter, 1, size * 0.12);
        }
      }
      weaveNoise(ctx, size);
    },
  };
}

const patterns: PackPattern[] = [
  stripes('navy-ticking', 'Navy ticking stripe', '#f1ede4', [
    ['#2c3c5e', 0.08, 0.06],
    ['#2c3c5e', 0.2, 0.02],
    ['#2c3c5e', 0.58, 0.06],
    ['#2c3c5e', 0.7, 0.02],
  ]),
  stripes('ochre-awning', 'Ochre awning stripe', '#efe7d4', [['#c79434', 0, 0.5]]),
  stripes('sage-pinstripe', 'Sage pinstripe', '#e8e7dc', [
    ['#7f8f72', 0.12, 0.03],
    ['#7f8f72', 0.62, 0.03],
  ]),
  stripes('terracotta-band', 'Terracotta band stripe', '#ede2d2', [
    ['#b0603d', 0.05, 0.22],
    ['#b0603d', 0.33, 0.04],
  ]),
  gingham('sage-gingham', 'Sage gingham', '#f3f1e8', '#8f9f80'),
  gingham('blue-gingham', 'Blue gingham', '#f4f4f0', '#6f8fb6'),
  polka('ink-dot', 'Ink dot', '#efe9dd', '#2b2d33'),
  trellis('grey-trellis', 'Grey trellis', '#f2f0ea', '#8a8b8e'),
  trellis('gold-trellis', 'Gold trellis', '#ece4d2', '#b38a3e'),
  ikat('indigo-ikat', 'Indigo ikat', '#ece6da', '#2f4268'),
  ikat('rust-ikat', 'Rust ikat', '#efe4d3', '#a4532f'),
];

// ───────────────────────── Materials ─────────────────────────

const fabric = (id: string, name: string, color: string, scale = 0.08, contrast = 0.45): PackMaterial => ({
  id,
  name,
  category: 'fabric',
  color,
  roughness: 0.95,
  pattern: { id: 'weave', scale, contrast },
});
const velvet = (id: string, name: string, color: string): PackMaterial => ({
  id,
  name,
  category: 'fabric',
  color,
  roughness: 0.72,
  pattern: { id: 'weave', scale: 0.05, contrast: 0.2 },
});
const sheer = (id: string, name: string, color: string, opacity = 0.48): PackMaterial => ({
  id,
  name,
  category: 'fabric',
  color,
  roughness: 0.9,
  opacity,
  pattern: { id: 'weave', scale: 0.03, contrast: 0.25 },
});
const printed = (id: string, name: string, pattern: string, scale: number, color = '#ffffff'): PackMaterial => ({
  id,
  name,
  category: 'fabric',
  color,
  roughness: 0.92,
  pattern: { id: pattern, scale, contrast: 1 },
});

const materials: PackMaterial[] = [
  // Linen-look curtain fabrics
  fabric('linen-ivory', 'Ivory linen', '#ece6da'),
  fabric('linen-oat', 'Oat linen', '#d9cdb8'),
  fabric('linen-sand', 'Sand linen', '#cbb898'),
  fabric('linen-stone', 'Stone grey linen', '#a7a39b'),
  fabric('linen-charcoal', 'Charcoal linen', '#4a4b4e'),
  fabric('linen-sage', 'Sage linen', '#a3ad92'),
  fabric('linen-olive', 'Olive linen', '#6f7350'),
  fabric('linen-dusty-blue', 'Dusty blue linen', '#8ea2b5'),
  fabric('linen-navy', 'Navy linen', '#2b3a55'),
  fabric('linen-terracotta', 'Terracotta linen', '#b5653f'),
  fabric('linen-mustard', 'Mustard linen', '#c99a2e'),
  fabric('linen-blush', 'Blush linen', '#d9b2a6'),
  // Velvets
  velvet('velvet-emerald', 'Emerald velvet', '#1f5a48'),
  velvet('velvet-burgundy', 'Burgundy velvet', '#6a1f2b'),
  velvet('velvet-midnight', 'Midnight velvet', '#1e2840'),
  velvet('velvet-rust', 'Rust velvet', '#8d4a2a'),
  velvet('velvet-champagne', 'Champagne velvet', '#cbb48e'),
  velvet('velvet-dove', 'Dove grey velvet', '#9a9898'),
  // Blackout
  fabric('blackout-white', 'White blackout', '#eeeeea', 0.06, 0.25),
  fabric('blackout-greige', 'Greige blackout', '#b4aa9b', 0.06, 0.25),
  fabric('blackout-slate', 'Slate blackout', '#6c6e70', 0.06, 0.25),
  fabric('blackout-black', 'Black blackout', '#262626', 0.06, 0.25),
  // Sheers
  sheer('sheer-white', 'White sheer voile', '#f8f8f4', 0.42),
  sheer('sheer-ivory', 'Ivory sheer voile', '#f2ead8', 0.48),
  sheer('sheer-linen', 'Linen-look sheer', '#ddd2bf', 0.55),
  sheer('sheer-grey', 'Grey sheer voile', '#c4c4c0', 0.5),
  sheer('sheer-blush', 'Blush sheer voile', '#ecd3cb', 0.5),
  sheer('sheer-charcoal', 'Charcoal sheer', '#55565a', 0.55),
  // Prints and wovens
  printed('print-navy-ticking', 'Navy ticking stripe', 'navy-ticking', 0.12),
  printed('print-ochre-awning', 'Ochre awning stripe', 'ochre-awning', 0.22),
  printed('print-sage-pinstripe', 'Sage pinstripe', 'sage-pinstripe', 0.09),
  printed('print-terracotta-band', 'Terracotta band stripe', 'terracotta-band', 0.3),
  printed('print-sage-gingham', 'Sage gingham', 'sage-gingham', 0.06),
  printed('print-blue-gingham', 'Blue gingham', 'blue-gingham', 0.06),
  printed('print-ink-dot', 'Ink dot', 'ink-dot', 0.09),
  printed('print-grey-trellis', 'Grey trellis', 'grey-trellis', 0.2),
  printed('print-gold-trellis', 'Gold trellis', 'gold-trellis', 0.2),
  printed('print-indigo-ikat', 'Indigo ikat', 'indigo-ikat', 0.32),
  printed('print-rust-ikat', 'Rust ikat', 'rust-ikat', 0.32),
  printed('print-botanical', 'Botanical leaf print', 'wallpaper-botanical', 0.45, '#8fa385'),
  printed('print-damask-gold', 'Gold damask', 'wallpaper-damask', 0.4, '#c8ad78'),
  printed('print-floral-blush', 'Blush floral', 'wallpaper-floral', 0.4, '#d8aea2'),
  printed('print-herringbone', 'Grey herringbone weave', 'herringbone', 0.05, '#9d9a94'),
  // Hardware and strands
  { id: 'track-white', name: 'White curtain track', category: 'metal', color: '#efefec', roughness: 0.45, metalness: 0.2 },
  { id: 'string-cotton', name: 'Cotton string', category: 'fabric', color: '#e9e1d2', roughness: 0.95 },
  { id: 'vane-pvc', name: 'Fabric vane', category: 'fabric', color: '#e7e3da', roughness: 0.85, pattern: { id: 'weave', scale: 0.04, contrast: 0.3 } },
];

// ───────────────────────── Fold geometry ─────────────────────────

/**
 * A fabric sheet across x in S-shaped folds: a thin prism whose outline follows a sine of the
 * given pitch (fold spacing) and amplitude, hanging from y0 to y1 around depth zc.
 */
function waveSheet(slot: string, x0: number, x1: number, y0: number, y1: number, zc: number, pitch: number, amp: number, t = 0.007, plan = true): Part {
  const n = Math.max(1, Math.round((x1 - x0) / pitch));
  const p = (x1 - x0) / n;
  const steps = n * 8;
  const front: V2[] = [];
  const back: V2[] = [];
  for (let i = 0; i <= steps; i++) {
    const x = x0 + ((x1 - x0) * i) / steps;
    const z = zc + amp * Math.sin((2 * Math.PI * (x - x0)) / p);
    front.push([x, z + t / 2]);
    back.push([x, z - t / 2]);
  }
  return prism(slot, [...front, ...back.reverse()], y0, y1 - y0, { plan });
}

/** Fold peaks of a wave sheet (for pinch-pleat heads, eyelets, gliders). */
function foldXs(x0: number, x1: number, pitch: number): number[] {
  const n = Math.max(1, Math.round((x1 - x0) / pitch));
  const p = (x1 - x0) / n;
  return range(n * 2 + 1).map((i) => x0 + (i * p) / 2);
}

/** Open panel stack width for a curtain of total width w (one side). */
const stackW = (w: number, k = 0.13, max = 0.7) => clamp(w * k, 0.16, max);

/** Ceiling/top track (one or two channels) spanning the width. */
function track(slot: string, w: number, h: number, zs: number[]): Part[] {
  const z0 = Math.min(...zs) - 0.018;
  const z1 = Math.max(...zs) + 0.018;
  return [span(slot, [-w / 2, w / 2], [h - 0.028, h], [z0, z1], { bevel: 0.004 }), span(slot, [-w / 2, w / 2], [h - 0.004, h], [z0 - 0.012, z1 + 0.012], NP)];
}

/** Pole with finials and wall brackets at height y, depth z. */
function pole(slot: string, w: number, y: number, z: number, d: number, r = 0.014, finial: 'ball' | 'disc' = 'ball'): Part[] {
  const parts: Part[] = [rodX(slot, -w / 2 + 0.05, w / 2 - 0.05, y, z, r)];
  for (const s of [-1, 1]) {
    const xe = s * (w / 2 - 0.028);
    parts.push(finial === 'ball' ? sphere(slot, [xe, y, z], 0.028, NP) : cyl(slot, [xe, y, z], 0.03, 0.02, { rotation: [0, 0, Math.PI / 2], plan: false }));
    const bx = s * (w / 2 - 0.15);
    parts.push(span(slot, [bx - 0.009, bx + 0.009], [y - 0.012, y + 0.006], [-d / 2 + 0.004, z], NP), discZ(slot, [bx, y - 0.004, -d / 2 + 0.004], 0.024, 0.008, NP));
  }
  if (w > 2.8) parts.push(span(slot, [-0.009, 0.009], [y - 0.012, y + 0.006], [-d / 2 + 0.004, z], NP), discZ(slot, [0, y - 0.004, -d / 2 + 0.004], 0.024, 0.008, NP));
  return parts;
}

/** Rings on a pole above the given x positions. */
const rings = (slot: string, xs: number[], y: number, z: number, r = 0.022): Part[] =>
  xs.map((x) => torus(slot, [x, y, z], r, 0.004, { rotation: [0, Math.PI / 2, 0], plan: false }));

/** Fabric tie-back cinching a stack at height y. */
const tieBack = (slot: string, xc: number, half: number, y: number, z: number, depth: number): Part =>
  ring(slot, [xc, y, z], half + 0.01, 0.012, { zScale: depth / (half + 0.022), plan: false });

/** Plan: a line along each track. */
const planLines = (w: number, _d: number, zs: number[]): PlanStroke[] => zs.map((z) => ({ kind: 'line', a: [-w / 2 + 0.02, z], b: [w / 2 - 0.02, z] }));

// ───────────────────────── Variants ─────────────────────────

const v = (name: string, materials: Record<string, string>): AssetPresetVariant => ({ id: slug(name), name, materials });

const VELVETS: [string, string][] = [
  ['Emerald velvet', 'velvet-emerald'],
  ['Burgundy velvet', 'velvet-burgundy'],
  ['Midnight velvet', 'velvet-midnight'],
  ['Rust velvet', 'velvet-rust'],
  ['Champagne velvet', 'velvet-champagne'],
  ['Dove grey velvet', 'velvet-dove'],
];
const SHEERS: [string, string][] = [
  ['Ivory sheer', 'sheer-ivory'],
  ['Linen-look sheer', 'sheer-linen'],
  ['Grey sheer', 'sheer-grey'],
  ['Blush sheer', 'sheer-blush'],
  ['Charcoal sheer', 'sheer-charcoal'],
];

/** Colourways for the main fabric slot, optionally with a hardware finish per row. */
const fabricVariants = (slot: string, rows: [string, string][]): AssetPresetVariant[] => rows.map(([n, m]) => v(n, { [slot]: m }));

// ───────────────────────── Items ─────────────────────────

const WIN = { w: 2.4, d: 0.16, h: 2.65 };
const common = { category: 'decor' as const, type: 'decor' as const, group: 'Curtains & blinds', mount: 'wall' as const };

// 1–2. Wave curtains on a ceiling track
function waveBuild(w: number, d: number, h: number, open: boolean): Part[] {
  const zc = 0;
  const parts: Part[] = track('track', w, h, [zc]);
  const y1 = h - 0.035;
  if (open) {
    const sw = stackW(w);
    parts.push(waveSheet('fabric', -w / 2 + 0.02, -w / 2 + 0.02 + sw, 0.012, y1, zc, 0.075, Math.min(0.05, d / 2 - 0.012)));
    parts.push(waveSheet('fabric', w / 2 - 0.02 - sw, w / 2 - 0.02, 0.012, y1, zc, 0.075, Math.min(0.05, d / 2 - 0.012)));
  } else {
    const a = Math.min(0.038, d / 2 - 0.015);
    parts.push(waveSheet('fabric', -w / 2 + 0.02, 0.03, 0.012, y1, zc - 0.006, 0.11, a));
    parts.push(waveSheet('fabric', -0.03, w / 2 - 0.02, 0.012, y1, zc + 0.006, 0.11, a));
  }
  return parts;
}
const waveOpen = defineItem({
  ...common,
  id: 'wave-curtains-open',
  name: 'Wave curtains on ceiling track',
  tags: ['curtains', 'wave curtain', 'ripplefold', 'ceiling track', 'window', 'rèm sóng', 'rèm cửa'],
  description: 'Modern S-fold wave curtains hung from a slim ceiling track, drawn open into neat stacks at both sides. Floor length.',
  defaultSize: WIN,
  minSize: { w: 0.9, d: 0.12, h: 1.4 },
  maxSize: { w: 6, d: 0.24, h: 3.6 },
  defaultElevation: 0,
  slots: [matSlot('fabric', 'Curtain fabric', 'linen-ivory'), matSlot('track', 'Track', 'track-white')],
  variants: fabricVariants('fabric', [
    ['Oat', 'linen-oat'],
    ['Stone grey', 'linen-stone'],
    ['Charcoal', 'linen-charcoal'],
    ['Sage', 'linen-sage'],
    ['Dusty blue', 'linen-dusty-blue'],
    ['Terracotta', 'linen-terracotta'],
    ['Navy ticking stripe', 'print-navy-ticking'],
    ['Greige blackout', 'blackout-greige'],
    ['Black blackout', 'blackout-black'],
  ]),
  build: ({ w, d, h }) => waveBuild(w, d, h, true),
  planDetail: ({ w, d }) => planLines(w, d, [0]),
});
const waveClosed = defineItem({
  ...waveOpen,
  id: 'wave-curtains-closed',
  name: 'Wave curtains on ceiling track, drawn',
  description: 'The wave curtains drawn closed across the window: soft, even S-folds from the ceiling track to the floor.',
  tags: ['curtains', 'wave curtain', 'drawn', 'closed', 'ceiling track', 'rèm sóng'],
  variantOf: 'wave-curtains-open',
  build: ({ w, d, h }) => waveBuild(w, d, h, false),
});

// 3. Sheer wave
const sheerWave = defineItem({
  ...common,
  id: 'sheer-wave-curtain',
  name: 'Sheer voile wave curtain',
  tags: ['sheer', 'voile', 'wave curtain', 'curtains', 'privacy', 'rèm voan'],
  description: 'A light, see-through voile in wave folds drawn across the window, softening daylight while keeping the view.',
  defaultSize: WIN,
  minSize: { w: 0.9, d: 0.1, h: 1.4 },
  maxSize: { w: 6, d: 0.2, h: 3.6 },
  defaultElevation: 0,
  slots: [matSlot('sheer', 'Sheer voile', 'sheer-white'), matSlot('track', 'Track', 'track-white')],
  variants: fabricVariants('sheer', SHEERS),
  build: ({ w, d, h }) => [
    ...track('track', w, h, [0]),
    waveSheet('sheer', -w / 2 + 0.02, w / 2 - 0.02, 0.012, h - 0.035, 0, 0.1, Math.min(0.035, d / 2 - 0.012), 0.004),
  ],
  planDetail: ({ w, d }) => planLines(w, d, [0]),
});

// 4. Sheer + blackout double track (window and glass-wall sizes share the builder)
function doubleBuild(w: number, d: number, h: number, drawn: boolean, oneSide = false): Part[] {
  const zs = -d / 4;
  const zb = d / 4;
  const y1 = h - 0.035;
  const a = Math.min(0.032, d / 4 - 0.008);
  const parts: Part[] = [...track('track', w, h, [zs, zb]), waveSheet('sheer', -w / 2 + 0.02, w / 2 - 0.02, 0.012, y1, zs, 0.1, a, 0.004)];
  if (drawn) {
    parts.push(waveSheet('blackout', -w / 2 + 0.02, 0.03, 0.012, y1, zb - 0.005, 0.11, a), waveSheet('blackout', -0.03, w / 2 - 0.02, 0.012, y1, zb + 0.005, 0.11, a));
  } else {
    const sw = stackW(w, oneSide ? 0.16 : 0.12, 1.1);
    const sa = Math.min(0.045, d / 4);
    parts.push(waveSheet('blackout', -w / 2 + 0.02, -w / 2 + 0.02 + sw, 0.012, y1, zb, 0.075, sa));
    if (!oneSide) parts.push(waveSheet('blackout', w / 2 - 0.02 - sw, w / 2 - 0.02, 0.012, y1, zb, 0.075, sa));
  }
  return parts;
}
const DOUBLE_VARIANTS: AssetPresetVariant[] = [
  v('Greige over ivory', { blackout: 'blackout-greige', sheer: 'sheer-ivory' }),
  v('Slate over grey', { blackout: 'blackout-slate', sheer: 'sheer-grey' }),
  v('Black over white', { blackout: 'blackout-black', sheer: 'sheer-white' }),
  v('Oat linen over linen sheer', { blackout: 'linen-oat', sheer: 'sheer-linen' }),
  v('Sage over ivory', { blackout: 'linen-sage', sheer: 'sheer-ivory' }),
  v('Navy over white', { blackout: 'linen-navy', sheer: 'sheer-white' }),
  v('Terracotta over linen sheer', { blackout: 'linen-terracotta', sheer: 'sheer-linen' }),
  v('Emerald velvet over ivory', { blackout: 'velvet-emerald', sheer: 'sheer-ivory' }),
  v('Champagne velvet over blush', { blackout: 'velvet-champagne', sheer: 'sheer-blush' }),
  v('Charcoal over charcoal sheer', { blackout: 'linen-charcoal', sheer: 'sheer-charcoal' }),
].slice(0, 9);
const doubleWindow = defineItem({
  ...common,
  id: 'sheer-blackout-double-track',
  name: 'Sheer and blackout on double track',
  tags: ['curtains', 'blackout', 'sheer', 'double track', 'two layers', 'rèm hai lớp', 'rèm cản sáng'],
  description: 'Two layers on a double ceiling track: a sheer drawn across for daytime privacy and blackout wave curtains stacked open at the sides.',
  defaultSize: { w: 2.4, d: 0.2, h: 2.65 },
  minSize: { w: 1, d: 0.16, h: 1.4 },
  maxSize: { w: 6, d: 0.3, h: 3.6 },
  defaultElevation: 0,
  slots: [matSlot('blackout', 'Blackout curtains', 'blackout-white'), matSlot('sheer', 'Sheer voile', 'sheer-white'), matSlot('track', 'Track', 'track-white')],
  variants: DOUBLE_VARIANTS,
  build: ({ w, d, h }) => doubleBuild(w, d, h, false),
  planDetail: ({ w, d }) => planLines(w, d, [-d / 4, d / 4]),
});

// 5–6. Triple pinch pleat on a wooden pole
function pinchBuild(w: number, d: number, h: number, drawn: boolean): Part[] {
  const yP = h - 0.04;
  const z = d / 2 - 0.05;
  const parts: Part[] = pole('pole', w, yP, z, d, 0.016);
  const y1 = yP - 0.035;
  const pitch = drawn ? 0.13 : 0.085;
  const amp = drawn ? Math.min(0.035, d / 2 - 0.02) : Math.min(0.048, d / 2 - 0.012);
  const spans: V2[] = drawn
    ? [
        [-w / 2 + 0.07, 0.02],
        [-0.02, w / 2 - 0.07],
      ]
    : [
        [-w / 2 + 0.07, -w / 2 + 0.07 + stackW(w, 0.15, 0.8)],
        [w / 2 - 0.07 - stackW(w, 0.15, 0.8), w / 2 - 0.07],
      ];
  for (const [x0, x1] of spans) {
    parts.push(waveSheet('fabric', x0, x1, 0.015, y1, z, pitch, amp, 0.008));
    // Pleat heads: a pinched triple pleat at every forward fold, hung from a ring.
    const xs = foldXs(x0, x1, pitch).filter((_, i) => i % 2 === 1);
    for (const x of xs) {
      parts.push(cyl('fabric', [x, y1 - 0.06, z + amp * 0.8], 0.012, 0.11, { rTop: 0.016, scale: [1, 1, 0.7], segments: 10, plan: false }));
    }
    parts.push(...rings('pole', xs, yP, z));
    if (!drawn) parts.push(tieBack('fabric', (x0 + x1) / 2, (x1 - x0) / 2, h * 0.4, z, amp + 0.012));
  }
  return parts;
}
const pinchOpen = defineItem({
  ...common,
  id: 'pinch-pleat-curtains',
  name: 'Triple pinch pleat curtains on wooden pole',
  tags: ['curtains', 'pinch pleat', 'pleated', 'pole', 'rings', 'tie-back', 'rèm xếp ly'],
  description: 'Tailored triple pinch-pleat curtains on rings and a wooden pole with ball finials, tied back at both sides.',
  defaultSize: { w: 2.6, d: 0.2, h: 2.6 },
  minSize: { w: 1, d: 0.15, h: 1.4 },
  maxSize: { w: 5.5, d: 0.3, h: 3.4 },
  defaultElevation: 0.02,
  slots: [matSlot('fabric', 'Curtain fabric', 'linen-oat'), matSlot('pole', 'Pole, rings & finials', 'wood-walnut')],
  variants: [
    ...fabricVariants('fabric', [
      ['Ivory', 'linen-ivory'],
      ['Stone grey', 'linen-stone'],
      ['Sage', 'linen-sage'],
      ['Navy', 'linen-navy'],
      ['Gold damask', 'print-damask-gold'],
    ]),
    ...VELVETS.slice(0, 4).map(([n, m]) => v(`${n}, brass pole`, { fabric: m, pole: 'metal-brass' })),
  ],
  build: ({ w, d, h }) => pinchBuild(w, d, h, false),
  planDetail: ({ w, d }) => planLines(w, d, [d / 2 - 0.05]),
});
const pinchClosed = defineItem({
  ...pinchOpen,
  id: 'pinch-pleat-curtains-closed',
  name: 'Triple pinch pleat curtains on wooden pole, drawn',
  description: 'The pinch-pleat curtains drawn closed: crisp pleated heading on rings, full folds to the floor.',
  tags: ['curtains', 'pinch pleat', 'drawn', 'closed', 'pole', 'rèm xếp ly'],
  variantOf: 'pinch-pleat-curtains',
  build: ({ w, d, h }) => pinchBuild(w, d, h, true),
});

// 7–8. Eyelet (grommet) curtains on a metal pole
function eyeletBuild(w: number, d: number, h: number, drawn: boolean): Part[] {
  const yP = h - 0.06;
  const z = 0;
  const parts: Part[] = pole('pole', w, yP, z, d, 0.012, 'disc');
  const pitch = drawn ? 0.17 : 0.1;
  const amp = Math.min(drawn ? 0.045 : 0.055, d / 2 - 0.012);
  const spans: V2[] = drawn
    ? [
        [-w / 2 + 0.06, 0.02],
        [-0.02, w / 2 - 0.06],
      ]
    : [
        [-w / 2 + 0.06, -w / 2 + 0.06 + stackW(w, 0.14)],
        [w / 2 - 0.06 - stackW(w, 0.14), w / 2 - 0.06],
      ];
  for (const [x0, x1] of spans) {
    parts.push(waveSheet('fabric', x0, x1, 0.015, h - 0.02, z, pitch, amp, 0.008));
    // Eyelets sit where the fabric crosses the pole (between front and back folds).
    const xs = foldXs(x0, x1, pitch).filter((_, i) => i % 2 === 0);
    parts.push(...xs.map((x) => torus('pole', [x, yP, z], 0.02, 0.006, { rotation: [0, Math.PI / 2, 0], plan: false })));
  }
  return parts;
}
const eyeletOpen = defineItem({
  ...common,
  id: 'eyelet-curtains',
  name: 'Eyelet curtains on metal pole',
  tags: ['curtains', 'eyelet', 'grommet', 'pole', 'window', 'rèm ore', 'rèm khoen'],
  description: 'Eyelet curtains threaded straight onto a metal pole for deep, regular folds; drawn open to the sides.',
  defaultSize: { w: 2.4, d: 0.18, h: 2.6 },
  minSize: { w: 0.9, d: 0.14, h: 1.3 },
  maxSize: { w: 5.5, d: 0.28, h: 3.4 },
  defaultElevation: 0.02,
  slots: [matSlot('fabric', 'Curtain fabric', 'linen-stone'), matSlot('pole', 'Pole & eyelets', 'metal-black-matte')],
  variants: [
    ...fabricVariants('fabric', [
      ['Ivory', 'linen-ivory'],
      ['Oat', 'linen-oat'],
      ['Charcoal', 'linen-charcoal'],
      ['Olive', 'linen-olive'],
      ['Mustard', 'linen-mustard'],
      ['Slate blackout', 'blackout-slate'],
      ['Ochre awning stripe', 'print-ochre-awning'],
      ['Ink dot', 'print-ink-dot'],
    ]),
    v('White with chrome eyelets', { fabric: 'blackout-white', pole: 'metal-chrome' }),
  ],
  build: ({ w, d, h }) => eyeletBuild(w, d, h, false),
  planDetail: ({ w, d }) => planLines(w, d, [0]),
});
const eyeletClosed = defineItem({
  ...eyeletOpen,
  id: 'eyelet-curtains-closed',
  name: 'Eyelet curtains on metal pole, drawn',
  description: 'The eyelet curtains drawn closed across the window, with deep even folds weaving around the pole.',
  tags: ['curtains', 'eyelet', 'grommet', 'drawn', 'closed', 'rèm ore'],
  variantOf: 'eyelet-curtains',
  build: ({ w, d, h }) => eyeletBuild(w, d, h, true),
});

// 9. Tab-top linen curtains
const tabTop = defineItem({
  ...common,
  id: 'tab-top-linen-curtains',
  name: 'Tab-top linen curtains',
  tags: ['curtains', 'tab top', 'linen', 'cottage', 'pole', 'farmhouse'],
  description: 'Relaxed linen panels hung by fabric tabs from a natural wooden pole, gently gathered and pulled slightly open.',
  defaultSize: { w: 2.2, d: 0.14, h: 2.5 },
  minSize: { w: 0.9, d: 0.1, h: 1.2 },
  maxSize: { w: 4.5, d: 0.22, h: 3.2 },
  defaultElevation: 0.05,
  slots: [matSlot('fabric', 'Curtain fabric', 'linen-sand'), matSlot('pole', 'Pole', 'wood-oak-natural')],
  variants: fabricVariants('fabric', [['Ivory', 'linen-ivory'], ['Oat', 'linen-oat'], ['Sage', 'linen-sage'], ['Dusty blue', 'linen-dusty-blue'], ['Blush', 'linen-blush'], ['Sage gingham', 'print-sage-gingham'], ['Blue gingham', 'print-blue-gingham'], ['Sage pinstripe', 'print-sage-pinstripe'], ['Blush floral', 'print-floral-blush']]),
  build: ({ w, d, h }) => {
    const yP = h - 0.03;
    const parts: Part[] = pole('pole', w, yP, 0, d, 0.016, 'disc');
    const pw = w * 0.36;
    for (const [x0, x1] of [
      [-w / 2 + 0.06, -w / 2 + 0.06 + pw],
      [w / 2 - 0.06 - pw, w / 2 - 0.06],
    ] as V2[]) {
      parts.push(waveSheet('fabric', x0, x1, 0.02, yP - 0.05, 0, 0.16, Math.min(0.03, d / 2 - 0.015), 0.007));
      for (const x of spaced(Math.max(3, Math.round((x1 - x0) / 0.16)), x0 + 0.03, x1 - 0.03)) parts.push(torus('fabric', [x, yP, 0], 0.03, 0.012, { rotation: [0, Math.PI / 2, 0], arc: Math.PI * 1.1, plan: false }));
    }
    return parts;
  },
  planDetail: ({ w, d }) => planLines(w, d, [0]),
});

// 10. Café curtain
const cafe = defineItem({
  ...common,
  id: 'cafe-curtain',
  name: 'Café curtain on tension rod',
  tags: ['cafe curtain', 'half curtain', 'kitchen', 'tension rod', 'privacy', 'rèm bếp'],
  description: 'A short gathered curtain on a slim tension rod across the lower half of a window: privacy for kitchens and bathrooms with light above.',
  defaultSize: { w: 1.1, d: 0.06, h: 0.75 },
  minSize: { w: 0.5, d: 0.04, h: 0.4 },
  maxSize: { w: 2.4, d: 0.1, h: 1.2 },
  defaultElevation: 0.95,
  slots: [matSlot('fabric', 'Curtain fabric', 'print-sage-gingham'), matSlot('rod', 'Rod', 'metal-brass')],
  variants: fabricVariants('fabric', [['Ivory linen', 'linen-ivory'], ['White sheer', 'sheer-white'], ['Blue gingham', 'print-blue-gingham'], ['Navy ticking', 'print-navy-ticking'], ['Ink dot', 'print-ink-dot'], ['Ochre awning', 'print-ochre-awning'], ['Blush floral', 'print-floral-blush']]),
  build: ({ w, d, h }) => [
    rodX('rod', -w / 2, w / 2, h - 0.02, 0, 0.007),
    discZ('rod', [-w / 2 + 0.006, h - 0.02, -d / 2 + 0.01], 0.014, 0.012, NP),
    discZ('rod', [w / 2 - 0.006, h - 0.02, -d / 2 + 0.01], 0.014, 0.012, NP),
    waveSheet('fabric', -w / 2 + 0.01, w / 2 - 0.01, 0, h - 0.008, 0, 0.045, Math.min(0.012, d / 2 - 0.006), 0.004),
  ],
  planDetail: ({ w, d }) => planLines(w, d, [0]),
});

// 11. Flat Roman shade
const roman = defineItem({
  ...common,
  id: 'flat-roman-shade',
  name: 'Flat Roman shade, half raised',
  tags: ['roman shade', 'roman blind', 'shade', 'window', 'folds', 'rèm roman'],
  description: 'A flat-fold Roman shade on a slim headrail, raised halfway so its soft horizontal folds stack below the panel.',
  defaultSize: { w: 1.2, d: 0.1, h: 1.5 },
  minSize: { w: 0.5, d: 0.07, h: 0.8 },
  maxSize: { w: 2.8, d: 0.16, h: 2.6 },
  defaultElevation: 0.95,
  slots: [matSlot('fabric', 'Shade fabric', 'linen-oat'), matSlot('rail', 'Headrail', 'track-white')],
  variants: fabricVariants('fabric', [['Ivory', 'linen-ivory'], ['Stone grey', 'linen-stone'], ['Charcoal', 'linen-charcoal'], ['Sage', 'linen-sage'], ['Navy ticking', 'print-navy-ticking'], ['Indigo ikat', 'print-indigo-ikat'], ['Botanical leaves', 'print-botanical'], ['Grey trellis', 'print-grey-trellis'], ['Greige blackout', 'blackout-greige']]),
  build: ({ w, d, h }) => {
    const z = -d / 2 + 0.035;
    const yb = h * 0.5;
    const n = 4;
    const fh = clamp(h * 0.05, 0.05, 0.09);
    const parts: Part[] = [span('rail', [-w / 2, w / 2], [h - 0.04, h], [-d / 2, -d / 2 + 0.05], { bevel: 0.005 }), span('fabric', [-w / 2 + 0.01, w / 2 - 0.01], [yb, h - 0.04], [z - 0.002, z + 0.002], { plan: false })];
    // Folds hang forward of the panel, each a little lower and further out.
    for (const i of range(n)) {
      const yc = yb - fh * (i + 0.5);
      const zc = z + 0.006 + i * 0.004;
      const zr = Math.min((fh / 2) * (0.55 + i * 0.05), d / 2 - 0.002 - zc);
      parts.push(rodX('fabric', -w / 2 + 0.01, w / 2 - 0.01, yc, zc, fh / 2, { scale: [1, 1, zr / (fh / 2)], plan: false }));
    }
    parts.push(span('rail', [-w / 2 + 0.012, w / 2 - 0.012], [yb - fh * n - 0.012, yb - fh * n], [z - 0.004, z + 0.012], NP));
    return parts;
  },
  planDetail: ({ w, d }) => planLines(w, d, [-d / 2 + 0.035]),
});

// 12. Velvet drapes under an upholstered pelmet
const pelmetDrapes = defineItem({
  ...common,
  id: 'velvet-drapes-pelmet',
  name: 'Velvet drapes with upholstered pelmet',
  tags: ['drapes', 'velvet', 'pelmet', 'cornice', 'luxury', 'sheer', 'rèm nhung'],
  description: 'Heavy velvet drapes tied back under a padded, fabric-covered pelmet box, with a sheer drawn behind. A classic hotel look.',
  defaultSize: { w: 2.8, d: 0.26, h: 2.7 },
  minSize: { w: 1.2, d: 0.2, h: 1.8 },
  maxSize: { w: 6, d: 0.36, h: 3.6 },
  defaultElevation: 0,
  slots: [matSlot('drape', 'Drapes', 'velvet-emerald'), matSlot('pelmet', 'Pelmet', 'velvet-emerald'), matSlot('sheer', 'Sheer', 'sheer-ivory'), matSlot('trim', 'Trim & holdbacks', 'metal-brass')],
  variants: [
    ...VELVETS.slice(1).map(([n, m]) => v(n, { drape: m, pelmet: m })),
    v('Champagne with gold damask pelmet', { drape: 'velvet-champagne', pelmet: 'print-damask-gold' }),
    v('Navy linen with ticking pelmet', { drape: 'linen-navy', pelmet: 'print-navy-ticking', trim: 'metal-chrome' }),
    v('Ivory linen with trellis pelmet', { drape: 'linen-ivory', pelmet: 'print-grey-trellis', trim: 'metal-brushed-steel' }),
  ],
  build: ({ w, d, h }) => {
    const ph = clamp(h * 0.1, 0.2, 0.32);
    const zs = -d / 2 + 0.04;
    const zd = 0.02;
    const y1 = h - ph + 0.04;
    const parts: Part[] = [
      span('pelmet', [-w / 2, w / 2], [h - ph, h], [d / 2 - 0.03, d / 2], { bevel: 0.012 }),
      span('pelmet', [-w / 2, -w / 2 + 0.03], [h - ph, h], [-d / 2, d / 2 - 0.02], { bevel: 0.008, plan: false }),
      span('pelmet', [w / 2 - 0.03, w / 2], [h - ph, h], [-d / 2, d / 2 - 0.02], { bevel: 0.008, plan: false }),
      span('trim', [-w / 2, w / 2], [h - ph - 0.008, h - ph + 0.004], [d / 2 - 0.006, d / 2 + 0.004], NP),
      waveSheet('sheer', -w / 2 + 0.05, w / 2 - 0.05, 0.01, y1, zs, 0.09, 0.022, 0.004),
    ];
    const sw = stackW(w, 0.17, 0.9);
    for (const s of [-1, 1]) {
      const x0 = s < 0 ? -w / 2 + 0.04 : w / 2 - 0.04 - sw;
      parts.push(waveSheet('drape', x0, x0 + sw, 0.005, y1, zd, 0.09, Math.min(0.06, d / 2 - 0.04), 0.01));
      parts.push(tieBack('drape', x0 + sw / 2, sw / 2, h * 0.38, zd, 0.07));
      // Holdback knob on the wall beside the tie-back.
      const xk = s < 0 ? x0 + sw + 0.03 : x0 - 0.03;
      parts.push(cyl('trim', [xk, h * 0.38, -d / 2 + 0.03], 0.008, 0.06, { rotation: [Math.PI / 2, 0, 0], plan: false }), sphere('trim', [xk, h * 0.38, -d / 2 + 0.065], 0.022, NP));
    }
    return parts;
  },
  planDetail: ({ w, d }) => [...planLines(w, d, [-d / 2 + 0.04, 0.02])],
});

// 13. Cellular shade
const cellular = defineItem({
  ...common,
  id: 'cellular-honeycomb-shade',
  name: 'Cellular honeycomb shade',
  tags: ['cellular shade', 'honeycomb', 'pleated blind', 'insulating', 'window', 'rèm tổ ong'],
  description: 'An insulating honeycomb shade: crisp horizontal cells on a slim headrail, lowered two thirds of the way.',
  defaultSize: { w: 1.2, d: 0.06, h: 1.5 },
  minSize: { w: 0.4, d: 0.04, h: 0.6 },
  maxSize: { w: 2.8, d: 0.1, h: 2.6 },
  defaultElevation: 0.9,
  slots: [matSlot('fabric', 'Cells', 'blackout-white'), matSlot('rail', 'Rails', 'track-white')],
  variants: fabricVariants('fabric', [['Ivory', 'linen-ivory'], ['Greige', 'blackout-greige'], ['Slate', 'blackout-slate'], ['Sage', 'linen-sage'], ['Dusty blue', 'linen-dusty-blue'], ['Sheer white', 'sheer-white']]),
  build: ({ w, d, h }) => {
    const z = -d / 2 + 0.025;
    const yb = h * 0.34;
    const cell = 0.026;
    const n = Math.max(2, Math.floor((h - 0.04 - yb) / cell));
    const parts: Part[] = [span('rail', [-w / 2, w / 2], [h - 0.035, h], [-d / 2, -d / 2 + 0.045], { bevel: 0.004 })];
    for (const i of range(n)) {
      const y = h - 0.035 - (i + 0.5) * cell;
      parts.push(span('fabric', [-w / 2 + 0.006, w / 2 - 0.006], [y - cell / 2, y + cell / 2], [z - 0.012, z + 0.012], { bevel: 0.01, plan: i === 0 }));
    }
    parts.push(span('rail', [-w / 2 + 0.004, w / 2 - 0.004], [h - 0.035 - n * cell - 0.018, h - 0.035 - n * cell], [z - 0.013, z + 0.013], { bevel: 0.004, plan: false }));
    return parts;
  },
});

// 14. Door curtain held back
const doorTieback = defineItem({
  ...common,
  id: 'door-curtain-tieback',
  name: 'Door curtain with tie-back',
  tags: ['door curtain', 'doorway', 'tie-back', 'portiere', 'entry', 'rèm cửa đi'],
  description: 'A single full-height curtain over a doorway on a pole, held back to one side with a tie-back and wall holdback so the door stays clear.',
  defaultSize: { w: 1.3, d: 0.18, h: 2.4 },
  minSize: { w: 0.8, d: 0.14, h: 2 },
  maxSize: { w: 2.2, d: 0.26, h: 3.2 },
  defaultElevation: 0.02,
  slots: [matSlot('fabric', 'Curtain fabric', 'linen-terracotta'), matSlot('pole', 'Pole & holdback', 'metal-black-matte')],
  variants: fabricVariants('fabric', [['Ivory', 'linen-ivory'], ['Oat', 'linen-oat'], ['Charcoal', 'linen-charcoal'], ['Olive', 'linen-olive'], ['Navy', 'linen-navy'], ['Emerald velvet', 'velvet-emerald'], ['Burgundy velvet', 'velvet-burgundy'], ['Rust ikat', 'print-rust-ikat'], ['Indigo ikat', 'print-indigo-ikat']]),
  build: ({ w, d, h }) => {
    const yP = h - 0.04;
    const z = 0.01;
    const sw = clamp(w * 0.28, 0.25, 0.5);
    const x0 = w / 2 - 0.06 - sw;
    const xs = foldXs(x0, w / 2 - 0.06, 0.09).filter((_, i) => i % 2 === 1);
    return [
      ...pole('pole', w, yP, z, d, 0.014),
      waveSheet('fabric', x0, w / 2 - 0.06, 0.015, yP - 0.035, z, 0.09, Math.min(0.05, d / 2 - 0.015), 0.009),
      ...rings('pole', xs, yP, z),
      tieBack('fabric', x0 + sw / 2, sw / 2, h * 0.42, z, 0.06),
      cyl('pole', [w / 2 - 0.02, h * 0.42, -d / 2 + 0.03], 0.007, 0.06, { rotation: [Math.PI / 2, 0, 0], plan: false }),
      sphere('pole', [w / 2 - 0.02, h * 0.42, -d / 2 + 0.065], 0.018, NP),
    ];
  },
  planDetail: ({ w, d }) => planLines(w, d, [0.01]),
});

// 15. Thermal portière
const portiere = defineItem({
  ...common,
  id: 'thermal-portiere-curtain',
  name: 'Thermal portière door curtain',
  tags: ['portiere', 'door curtain', 'thermal', 'draught', 'front door', 'velvet', 'rèm cửa'],
  description: 'A heavy lined curtain drawn across a front door on a swing-arm rod to stop draughts; pinch-pleated on rings.',
  defaultSize: { w: 1.2, d: 0.16, h: 2.35 },
  minSize: { w: 0.8, d: 0.12, h: 2 },
  maxSize: { w: 2, d: 0.24, h: 3 },
  defaultElevation: 0.01,
  slots: [matSlot('fabric', 'Curtain fabric', 'velvet-midnight'), matSlot('pole', 'Rod & rings', 'metal-brass')],
  variants: fabricVariants('fabric', [...VELVETS.filter(([n]) => n !== 'Midnight velvet'), ['Grey herringbone', 'print-herringbone'], ['Charcoal linen', 'linen-charcoal'], ['Black blackout', 'blackout-black']]),
  build: ({ w, d, h }) => {
    const yP = h - 0.04;
    const z = 0.01;
    const x0 = -w / 2 + 0.05;
    const x1 = w / 2 - 0.05;
    const xs = foldXs(x0, x1, 0.12).filter((_, i) => i % 2 === 1);
    return [
      rodX('pole', -w / 2 + 0.02, w / 2 - 0.03, yP, z, 0.012),
      sphere('pole', [w / 2 - 0.022, yP, z], 0.022, NP),
      // Swing-arm pivot on the hinge side.
      cyl('pole', [-w / 2 + 0.015, yP, (z - d / 2) / 2], 0.012, d / 2 + z, { rotation: [Math.PI / 2, 0, 0], plan: false }),
      span('pole', [-w / 2, -w / 2 + 0.03], [yP - 0.06, yP + 0.03], [-d / 2, -d / 2 + 0.012], NP),
      waveSheet('fabric', x0, x1, 0.01, yP - 0.035, z, 0.12, Math.min(0.04, d / 2 - 0.02), 0.01),
      ...xs.map((x) => cyl('fabric', [x, yP - 0.095, z + 0.03], 0.011, 0.1, { rTop: 0.015, scale: [1, 1, 0.7], segments: 10, plan: false })),
      ...rings('pole', xs, yP, z),
    ];
  },
  planDetail: ({ w, d }) => planLines(w, d, [0.01]),
});

// 16. String curtain
const stringCurtain = defineItem({
  ...common,
  id: 'string-door-curtain',
  name: 'String curtain for doorway',
  tags: ['string curtain', 'thread curtain', 'doorway', 'divider', 'fringe', 'rèm sợi'],
  description: 'Fine cotton strings hanging from a slim rail across a doorway or opening: divides a space while letting light and people through.',
  defaultSize: { w: 0.9, d: 0.04, h: 2.2 },
  minSize: { w: 0.5, d: 0.03, h: 1.2 },
  maxSize: { w: 3, d: 0.08, h: 3 },
  defaultElevation: 0.02,
  slots: [matSlot('strings', 'Strings', 'string-cotton'), matSlot('rail', 'Rail', 'track-white')],
  variants: [
    v('Sand strings', { strings: 'linen-sand' }),
    v('Grey strings', { strings: 'linen-stone' }),
    v('Black strings, black rail', { strings: 'blackout-black', rail: 'metal-black-matte' }),
    v('Terracotta strings', { strings: 'linen-terracotta' }),
    v('Sage strings', { strings: 'linen-sage' }),
    v('Mustard strings, brass rail', { strings: 'linen-mustard', rail: 'metal-brass' }),
  ],
  build: ({ w, d, h }) => {
    const n = clamp(Math.round(w / 0.022), 10, 140);
    return [span('rail', [-w / 2, w / 2], [h - 0.03, h], [-d / 2, d / 2], { bevel: 0.004 }), ...cells(n, -w / 2 + 0.005, w / 2 - 0.005).map((x, i) => cyl('strings', [x, (h - 0.03 + 0.005 * (i % 3)) / 2, (i % 2 ? 1 : -1) * Math.min(0.006, d / 4)], 0.0028, h - 0.03 - 0.005 * (i % 3), { segments: 5, plan: false }))];
  },
  planDetail: ({ w }) => [{ kind: 'line', a: [-w / 2, 0], b: [w / 2, 0] }],
});

// 17. French door sash curtains
const sash = defineItem({
  ...common,
  id: 'french-door-sash-curtain',
  name: 'Sash curtain for French door',
  tags: ['sash curtain', 'french door', 'door panel', 'sheer', 'privacy', 'glass door'],
  description: 'A sheer gathered tight between two slim sash rods on a glazed door leaf; privacy for French and patio doors that still lets light through.',
  defaultSize: { w: 0.7, d: 0.03, h: 1.75 },
  minSize: { w: 0.35, d: 0.02, h: 0.6 },
  maxSize: { w: 1.2, d: 0.05, h: 2.4 },
  defaultElevation: 0.3,
  slots: [matSlot('sheer', 'Sheer', 'sheer-white'), matSlot('rod', 'Sash rods', 'metal-white-powder')],
  variants: [...fabricVariants('sheer', SHEERS), v('Ivory linen, brass rods', { sheer: 'linen-ivory', rod: 'metal-brass' }), v('Blue gingham', { sheer: 'print-blue-gingham' })],
  build: ({ w, d, h }) => [
    rodX('rod', -w / 2, w / 2, h - 0.012, 0, 0.006),
    rodX('rod', -w / 2, w / 2, 0.012, 0, 0.006),
    waveSheet('sheer', -w / 2 + 0.01, w / 2 - 0.01, 0.004, h - 0.004, 0, 0.035, Math.min(0.007, d / 2 - 0.004), 0.003),
  ],
  planDetail: ({ w }) => [{ kind: 'line', a: [-w / 2, 0], b: [w / 2, 0] }],
});

// 18–19. Glass wall sheer
const GLASS = { w: 5, d: 0.16, h: 2.7 };
function glassSheerBuild(w: number, d: number, h: number, stacked: boolean): Part[] {
  const a = Math.min(0.04, d / 2 - 0.012);
  const parts: Part[] = track('track', w, h, [0]);
  if (stacked) {
    parts.push(waveSheet('sheer', -w / 2 + 0.02, -w / 2 + 0.02 + clamp(w * 0.09, 0.3, 1.1), 0.012, h - 0.035, 0, 0.07, Math.min(0.055, d / 2 - 0.01), 0.004));
  } else {
    parts.push(waveSheet('sheer', -w / 2 + 0.02, w / 2 - 0.02, 0.012, h - 0.035, 0, 0.11, a, 0.004));
  }
  return parts;
}
const glassSheer = defineItem({
  ...common,
  id: 'glass-wall-sheer-curtain',
  name: 'Floor-to-ceiling sheer for glass wall',
  tags: ['sheer', 'glass wall', 'floor to ceiling', 'voile', 'wave curtain', 'large window', 'rèm voan', 'vách kính'],
  description: 'A full-height sheer in wave folds across a whole glass wall or sliding doors, from a ceiling track to the floor. Up to 12 m wide.',
  defaultSize: GLASS,
  minSize: { w: 2, d: 0.12, h: 2.2 },
  maxSize: { w: 12, d: 0.24, h: 3.6 },
  defaultElevation: 0,
  slots: [matSlot('sheer', 'Sheer voile', 'sheer-white'), matSlot('track', 'Track', 'track-white')],
  variants: [...fabricVariants('sheer', SHEERS), v('White sheer, black track', { track: 'metal-black-matte' })],
  build: ({ w, d, h }) => glassSheerBuild(w, d, h, false),
  planDetail: ({ w, d }) => planLines(w, d, [0]),
});
const glassSheerStacked = defineItem({
  ...glassSheer,
  id: 'glass-wall-sheer-stacked',
  name: 'Floor-to-ceiling sheer for glass wall, stacked',
  description: 'The glass-wall sheer pulled to one side in a single deep stack, leaving the view and sliding doors open.',
  tags: ['sheer', 'glass wall', 'stacked', 'open', 'one way', 'rèm voan'],
  variantOf: 'glass-wall-sheer-curtain',
  build: ({ w, d, h }) => glassSheerBuild(w, d, h, true),
});

// 20–21. Glass wall double track
const glassDouble = defineItem({
  ...common,
  id: 'glass-wall-double-curtains',
  name: 'Sheer and blackout for glass wall',
  tags: ['glass wall', 'blackout', 'sheer', 'double track', 'floor to ceiling', 'sliding door', 'rèm hai lớp', 'vách kính'],
  description: 'A ceiling double track across a full glass wall: sheer drawn across, blackout wave curtains stacked at both ends. Up to 12 m wide.',
  defaultSize: { w: 5, d: 0.22, h: 2.7 },
  minSize: { w: 2, d: 0.16, h: 2.2 },
  maxSize: { w: 12, d: 0.32, h: 3.6 },
  defaultElevation: 0,
  slots: [matSlot('blackout', 'Blackout curtains', 'blackout-greige'), matSlot('sheer', 'Sheer voile', 'sheer-ivory'), matSlot('track', 'Track', 'track-white')],
  variants: [v('White over white', { blackout: 'blackout-white', sheer: 'sheer-white' }), ...DOUBLE_VARIANTS.slice(1)].slice(0, 9),
  build: ({ w, d, h }) => doubleBuild(w, d, h, false),
  planDetail: ({ w, d }) => planLines(w, d, [-d / 4, d / 4]),
});
const glassDoubleDrawn = defineItem({
  ...glassDouble,
  id: 'glass-wall-double-curtains-drawn',
  name: 'Sheer and blackout for glass wall, drawn',
  description: 'Both layers drawn closed across the glass wall: the blackout meets in the middle for a dark bedroom or cinema room.',
  tags: ['glass wall', 'blackout', 'drawn', 'closed', 'floor to ceiling', 'rèm cản sáng'],
  variantOf: 'glass-wall-double-curtains',
  build: ({ w, d, h }) => doubleBuild(w, d, h, true),
});
const glassDoubleOneSide = defineItem({
  ...glassDouble,
  id: 'glass-wall-double-curtains-one-side',
  name: 'Sheer and blackout for glass wall, one-way stack',
  description: 'The glass-wall pair with the blackout gathered to one end only, as for a sliding door that opens on the other side.',
  tags: ['glass wall', 'blackout', 'one way', 'stack', 'sliding door', 'rèm hai lớp'],
  variantOf: 'glass-wall-double-curtains',
  build: ({ w, d, h }) => doubleBuild(w, d, h, false, true),
});

// 22. Vertical blinds
const verticalBlinds = defineItem({
  ...common,
  id: 'vertical-blinds-glass-door',
  name: 'Vertical blinds for sliding glass door',
  tags: ['vertical blinds', 'vanes', 'sliding door', 'glass wall', 'office', 'rèm lá dọc'],
  description: 'Fabric vertical blinds on a headrail across a sliding door or glass wall, vanes tilted half open with weights and a linking chain.',
  defaultSize: { w: 3, d: 0.14, h: 2.6 },
  minSize: { w: 0.8, d: 0.1, h: 1.2 },
  maxSize: { w: 8, d: 0.2, h: 3.4 },
  defaultElevation: 0,
  slots: [matSlot('vanes', 'Vanes', 'vane-pvc'), matSlot('rail', 'Headrail', 'track-white')],
  variants: fabricVariants('vanes', [['White', 'blackout-white'], ['Greige', 'blackout-greige'], ['Slate', 'blackout-slate'], ['Charcoal', 'linen-charcoal'], ['Sand linen', 'linen-sand'], ['Sheer white', 'sheer-white']]),
  build: ({ w, h }) => {
    const n = clamp(Math.floor((w - 0.02) / 0.08), 3, 75);
    const vw = 0.089;
    const ang = 0.9;
    const z = 0;
    const parts: Part[] = [span('rail', [-w / 2, w / 2], [h - 0.05, h], [z - 0.035, z + 0.035], { bevel: 0.005 })];
    for (const x of cells(n, -w / 2 + 0.01, w / 2 - 0.01)) {
      parts.push(box('vanes', [x, (h - 0.06 + 0.02) / 2, z], [vw, h - 0.08, 0.002], { rotation: [0, ang, 0], plan: false }));
      parts.push(box('rail', [x, 0.03, z], [vw * 0.9, 0.012, 0.004], { rotation: [0, ang, 0], plan: false }));
    }
    parts.push(rodX('rail', -w / 2 + 0.03, w / 2 - 0.03, 0.022, z, 0.0012, NP));
    return parts;
  },
  planDetail: ({ w }) => {
    const n = clamp(Math.floor((w - 0.02) / 0.08), 3, 75);
    return cells(n, -w / 2 + 0.01, w / 2 - 0.01).map((x) => ({ kind: 'line', a: [x - 0.028, -0.035], b: [x + 0.028, 0.035] }) as PlanStroke);
  },
});

// 23. Panel track blinds
const panelTrack = defineItem({
  ...common,
  id: 'panel-track-blinds',
  name: 'Sliding panel track blinds',
  tags: ['panel blinds', 'panel track', 'japanese panels', 'sliding panels', 'glass wall', 'room divider', 'rèm tấm'],
  description: 'Flat fabric panels gliding on a multi-channel ceiling track, overlapping across a glass wall or wide opening. Panels about 80 cm wide.',
  defaultSize: { w: 3.6, d: 0.12, h: 2.65 },
  minSize: { w: 1.2, d: 0.08, h: 1.6 },
  maxSize: { w: 8, d: 0.18, h: 3.4 },
  defaultElevation: 0,
  slots: [matSlot('panels', 'Panels', 'linen-sand'), matSlot('rail', 'Track & bars', 'track-white')],
  variants: fabricVariants('panels', [['Ivory', 'linen-ivory'], ['Stone grey', 'linen-stone'], ['Charcoal', 'linen-charcoal'], ['Sage', 'linen-sage'], ['Sheer white', 'sheer-white'], ['Linen-look sheer', 'sheer-linen'], ['Indigo ikat', 'print-indigo-ikat'], ['Grey trellis', 'print-grey-trellis'], ['Botanical leaves', 'print-botanical']]),
  build: ({ w, d, h }) => {
    const n = clamp(Math.round(w / 0.8), 2, 10);
    const ch = Math.min(3, n);
    const pw = (w - 0.02) / n + 0.04;
    const zs = spaced(ch, -d / 2 + 0.025, d / 2 - 0.025);
    const parts: Part[] = track('rail', w, h, zs);
    cells(n, -w / 2 + 0.01, w / 2 - 0.01).forEach((x, i) => {
      const z = zs[i % ch];
      const x0 = Math.max(-w / 2, x - pw / 2);
      const x1 = Math.min(w / 2, x + pw / 2);
      parts.push(span('panels', [x0, x1], [0.03, h - 0.03], [z - 0.0015, z + 0.0015]), span('rail', [x0, x1], [0.012, 0.03], [z - 0.005, z + 0.005], NP), span('rail', [x0, x1], [h - 0.036, h - 0.028], [z - 0.005, z + 0.005], NP));
    });
    return parts;
  },
});

const items: PackItem[] = [
  waveOpen,
  waveClosed,
  sheerWave,
  doubleWindow,
  pinchOpen,
  pinchClosed,
  eyeletOpen,
  eyeletClosed,
  tabTop,
  cafe,
  roman,
  pelmetDrapes,
  cellular,
  doorTieback,
  portiere,
  stringCurtain,
  sash,
  glassSheer,
  glassSheerStacked,
  glassDouble,
  glassDoubleDrawn,
  glassDoubleOneSide,
  verticalBlinds,
  panelTrack,
];

export default definePack({
  name: 'Curtain collection',
  version: '1.0.0',
  author: 'Neest',
  description: 'Curtains, sheers and blinds for windows, doors and full glass walls, in many colours and prints.',
  license: 'CC0-1.0',
  patterns,
  materials,
  items,
});

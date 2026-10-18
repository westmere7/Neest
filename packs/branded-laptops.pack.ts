/**
 * Branded laptops — six laptops sold widely in Vietnam, open on a desk at their published sizes.
 *
 * Apple MacBook Air 13 (M3) and MacBook Pro 14 (M4); everyday Windows laptops Dell Inspiron 15 3530
 * and ASUS Vivobook 15 X1504VA. (Gaming laptops that looked the same as the MacBook Pro were dropped.)
 *
 * Each item is shown open at about 110° (the lid leans back behind the base), so its footprint is a
 * little deeper and its height is the open screen; `brand.specs` list the closed size from the
 * makers' spec sheets. Screens show a soft wallpaper (the pack's own pattern). Original procedural
 * shapes: no logos or trademark artwork.
 */
import { defineItem, definePack, line, matSlot, prism, rectPoly, roundRectPoints, span, type AssetBrand, type Part, type PackPattern, type Size3, type V2 } from '@/packs/kit';

const o = { plan: false };
const TAGS = ['laptop', 'máy tính xách tay', 'notebook', 'computer', 'electronics', 'desk', 'branded', 'vietnam'];

/** Lid opening: 110° from the base, i.e. leaning 20° back from vertical. */
const LEAN = (20 * Math.PI) / 180;

interface LaptopSpec {
  /** Closed size: width, depth, thickness (base + lid), metres. */
  W: number;
  D: number;
  T: number;
  /** Lid thickness share of T. */
  lid: number;
  /** Screen border (bezel) at the sides/top and bottom chin. */
  bezel: number;
  chin: number;
  /** Corner radius of the chassis. */
  r: number;
  /** Keyboard area as fractions of width/depth (from the hinge), numpad on 15" machines. */
  kb: { w: number; d0: number; d1: number };
  /** Raised rear exhaust block (gaming). */
  rearVent?: boolean;
  /** Notch at the top of the screen (MacBook). */
  notch?: boolean;
}

/** Open-laptop size box for a closed size. */
function openSize(s: LaptopSpec): Size3 {
  const lidL = s.D - 0.004;
  return { w: s.W, d: s.D + Math.sin(LEAN) * lidL + s.T * s.lid, h: s.T * (1 - s.lid) + Math.cos(LEAN) * lidL };
}

function fixed(size: Size3) {
  return { defaultSize: size, minSize: size, maxSize: size, resizable: { w: false, d: false, h: false } };
}

/** An open laptop: base with keyboard and trackpad, lid with screen, leaning back from the hinge. */
function laptop(s: LaptopSpec, { w, d }: Size3): Part[] {
  const base = s.T * (1 - s.lid);
  const lidT = s.T * s.lid;
  const zf = d / 2;
  const zh = zf - s.D;
  const parts: Part[] = [
    prism('body', roundRectPoints(0, zf - s.D / 2, w, s.D, s.r, 5), 0, base),
    // Keyboard well and keys (a dark grid), trackpad.
    span('keys', [-(w * s.kb.w) / 2, (w * s.kb.w) / 2], [base - 0.0008, base + 0.0006], [zh + s.D * s.kb.d0, zh + s.D * s.kb.d1], o),
    span('bezel', [-Math.min(0.06, w * 0.18), Math.min(0.06, w * 0.18)], [base - 0.0002, base + 0.0003], [zh + s.D * (s.kb.d1 + 0.05), zf - s.D * 0.07], o),
  ];
  // Key rows: thin gaps make the keyboard read at a glance.
  const rows = 6;
  for (let i = 1; i < rows; i++) {
    const z = zh + s.D * (s.kb.d0 + ((s.kb.d1 - s.kb.d0) * i) / rows);
    parts.push(span('body', [-(w * s.kb.w) / 2, (w * s.kb.w) / 2], [base + 0.0006, base + 0.0008], [z - 0.0007, z + 0.0007], o));
  }
  if (s.rearVent) parts.push(span('keys', [-w * 0.38, w * 0.38], [0.002, base - 0.001], [zh - 0.001, zh + 0.004], o));
  // Lid: a slab hinged at the back edge, leaning back.
  const lidL = s.D - 0.004;
  const rot: [number, number, number] = [Math.PI / 2 - LEAN, 0, 0];
  const lidOutline = roundRectPoints(0, 0, w, lidL, s.r, 5).map(([x, z]) => [x, z - lidL / 2] as V2);
  const hinge: [number, number, number] = [0, base, zh];
  parts.push({ shape: 'prism', outline: lidOutline, height: lidT, position: hinge, rotation: rot, slot: 'body', plan: false });
  // Screen face: the panel inside the bezel, on the lid's inner side.
  const sw = w - 2 * s.bezel;
  const sh = lidL - s.bezel - s.chin;
  const screen: V2[] = roundRectPoints(0, 0, sw, sh, 0.004, 2).map(([x, z]) => [x, z - s.chin - sh / 2] as V2);
  const bezel: V2[] = roundRectPoints(0, 0, w - 0.002, lidL - 0.002, s.r, 4).map(([x, z]) => [x, z - lidL / 2] as V2);
  const n: [number, number, number] = [0, Math.sin(LEAN), Math.cos(LEAN)];
  const at = (k: number): [number, number, number] => [hinge[0] + n[0] * k, hinge[1] + n[1] * k, hinge[2] + n[2] * k];
  parts.push({ shape: 'prism', outline: bezel, height: 0.0006, position: at(lidT), rotation: rot, slot: 'bezel', plan: false });
  parts.push({ shape: 'prism', outline: screen, height: 0.0006, position: at(lidT + 0.0006), rotation: rot, slot: 'screen', plan: false });
  if (s.notch) {
    const nb: V2[] = roundRectPoints(0, 0, 0.032, 0.007, 0.002, 2).map(([x, z]) => [x, z - (lidL - s.bezel) + 0.0035] as V2);
    parts.push({ shape: 'prism', outline: nb, height: 0.0007, position: at(lidT + 0.0009), rotation: rot, slot: 'bezel', plan: false });
  }
  return parts;
}

const plan = (s: LaptopSpec) => ({ w, d }: Size3) => [rectPoly(-w / 2, d / 2 - s.D, w / 2, d / 2), line([-w / 2, d / 2 - s.D], [w / 2, d / 2 - s.D])];

const SLOTS = (body: string) => [matSlot('body', 'Chassis', body), matSlot('keys', 'Keyboard', 'plastic-black'), matSlot('bezel', 'Bezel & trackpad', 'solid-black'), matSlot('screen', 'Screen', 'wallpaper')];

const brand = (name: string, model: string, line: string, url: string, specs: [string, string][]): AssetBrand => ({ name, model, line, url, specs });

// ---------------------------------------------------------------------------
// Laptops
// ---------------------------------------------------------------------------

const AIR: LaptopSpec = { W: 0.3041, D: 0.215, T: 0.0113, lid: 0.42, bezel: 0.008, chin: 0.012, r: 0.012, kb: { w: 0.86, d0: 0.06, d1: 0.48 }, notch: true };
const macbookAir = defineItem({
  id: 'macbook-air-13-m3',
  name: 'Apple MacBook Air 13" (M3)',
  category: 'office',
  type: 'electronics',
  group: 'Computers',
  tags: [...TAGS, 'apple', 'macbook', 'macbook air', 'm3'],
  description: 'Thin wedge-free aluminium MacBook Air with a notched 13.6" Liquid Retina display, open on the desk.',
  ...fixed(openSize(AIR)),
  slots: SLOTS('metal-brushed-steel'),
  build: (size) => laptop(AIR, size),
  planDetail: plan(AIR),
  brand: brand('Apple', 'MacBook Air 13" (M3, 2024)', 'MacBook Air', 'https://support.apple.com/118551', [
    ['Display', '13.6" Liquid Retina, 2560 × 1664'],
    ['Closed size (W × D × H)', '304.1 × 215 × 11.3 mm'],
    ['Weight', '1.24 kg'],
    ['Chip', 'Apple M3'],
  ]),
});

const PRO: LaptopSpec = { W: 0.3126, D: 0.2212, T: 0.0155, lid: 0.38, bezel: 0.008, chin: 0.011, r: 0.012, kb: { w: 0.84, d0: 0.06, d1: 0.48 }, notch: true };
const macbookPro = defineItem({
  id: 'macbook-pro-14-m4',
  name: 'Apple MacBook Pro 14" (M4)',
  category: 'office',
  type: 'electronics',
  group: 'Computers',
  tags: [...TAGS, 'apple', 'macbook', 'macbook pro', 'm4'],
  description: 'Space black MacBook Pro 14 with a notched Liquid Retina XDR display, open on the desk.',
  ...fixed(openSize(PRO)),
  slots: SLOTS('metal-anthracite'),
  build: (size) => laptop(PRO, size),
  planDetail: plan(PRO),
  brand: brand('Apple', 'MacBook Pro 14" (M4, 2024)', 'MacBook Pro', 'https://support.apple.com/en-au/121552', [
    ['Display', '14.2" Liquid Retina XDR'],
    ['Closed size (W × D × H)', '312.6 × 221.2 × 15.5 mm'],
    ['Weight', '1.55 kg'],
    ['Chip', 'Apple M4'],
  ]),
});

const INSP: LaptopSpec = { W: 0.3585, D: 0.2356, T: 0.019, lid: 0.32, bezel: 0.007, chin: 0.022, r: 0.008, kb: { w: 0.92, d0: 0.05, d1: 0.47 } };
const inspiron = defineItem({
  id: 'dell-inspiron-15-3530',
  name: 'Dell Inspiron 15 3530',
  category: 'office',
  type: 'electronics',
  group: 'Computers',
  tags: [...TAGS, 'dell', 'inspiron', 'windows', 'office laptop', 'sinh viên'],
  description: 'Everyday 15.6" Dell with a full-size keyboard and numpad, a favourite office and student laptop in Vietnam.',
  ...fixed(openSize(INSP)),
  slots: SLOTS('solid-light-grey'),
  build: (size) => laptop(INSP, size),
  planDetail: plan(INSP),
  brand: brand('Dell', 'Inspiron 15 3530', 'Inspiron 15', 'https://dell.com/en-us/shop/laptops-2-in-1-pcs/inspiron-15-laptop/spd/inspiron-15-3530-laptop', [
    ['Display', '15.6" FHD 120 Hz'],
    ['Closed size (W × D × H)', '358.5 × 235.6 × 16.96–18.99 mm'],
    ['Weight', 'from 1.62 kg'],
  ]),
});

const VIVO: LaptopSpec = { W: 0.3597, D: 0.2325, T: 0.0179, lid: 0.33, bezel: 0.006, chin: 0.02, r: 0.008, kb: { w: 0.92, d0: 0.05, d1: 0.47 } };
const vivobook = defineItem({
  id: 'asus-vivobook-15-x1504va',
  name: 'ASUS Vivobook 15 X1504VA',
  category: 'office',
  type: 'electronics',
  group: 'Computers',
  tags: [...TAGS, 'asus', 'vivobook', 'windows', 'office laptop', 'sinh viên'],
  description: 'Light 15.6" ASUS Vivobook in Quiet Blue with a numpad keyboard and slim bezels.',
  ...fixed(openSize(VIVO)),
  slots: SLOTS('fabric-navy'),
  build: (size) => laptop(VIVO, size),
  planDetail: plan(VIVO),
  brand: brand('ASUS', 'Vivobook 15 X1504VA', 'Vivobook 15', 'https://asus.com/in/laptops/for-home/vivobook/asus-vivobook-15-x1504/techspec', [
    ['Display', '15.6" FHD'],
    ['Closed size (W × D × H)', '359.7 × 232.5 × 17.9 mm'],
    ['Weight', '1.70 kg'],
  ]),
});

// ---------------------------------------------------------------------------
// Screen wallpaper
// ---------------------------------------------------------------------------

const wallpaper: PackPattern = {
  id: 'wallpaper',
  name: 'Desktop wallpaper',
  colored: true,
  normalStrength: 0,
  // Soft diagonal waves of blue, violet and teal, like a default desktop picture.
  draw(ctx, size, rand) {
    const N = size;
    const img = ctx.createImageData(N, N);
    const ph = rand() * Math.PI * 2;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const u = x / N;
        const v = y / N;
        const wv = 0.5 + 0.5 * Math.sin(Math.PI * 2 * (u + v) + ph) * Math.cos(Math.PI * 2 * (u - 2 * v));
        const i = (y * N + x) * 4;
        img.data[i] = Math.round(30 + 90 * wv);
        img.data[i + 1] = Math.round(60 + 70 * (1 - wv));
        img.data[i + 2] = Math.round(150 + 90 * wv);
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  },
};

export default definePack({
  name: 'Branded laptops',
  version: '1.0.0',
  author: 'Neest team',
  description: 'Four laptops sold widely in Vietnam at their published sizes: MacBook Air 13 and MacBook Pro 14, Dell Inspiron 15 and ASUS Vivobook 15.',
  license: 'CC0 (made for Neest); brand names belong to their owners',
  items: [macbookAir, macbookPro, inspiron, vivobook],
  patterns: [wallpaper],
  materials: [{ id: 'wallpaper', name: 'Laptop screen', category: 'glass', color: '#ffffff', roughness: 0.15, emissive: '#3a4a7a', emissiveIntensity: 0.35, pattern: { id: 'wallpaper', scale: 0.3 } }],
});

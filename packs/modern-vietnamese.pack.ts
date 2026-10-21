/**
 * Modern Vietnamese apartment: content pack.
 *
 * Pieces seen again and again in photos of today's Vietnamese apartments (chung cư) that the
 * library did not have yet: the ancestral altar cabinet with its gilded lotus backdrop, the
 * wall-hung altar shelf small flats use instead, the Thần Tài shrine by the door, zebra
 * ("rainbow") blinds, iron window grilles, the stainless safety cables strung across balconies
 * and logias, a CNC-cut lattice partition, a layered lotus-leaf pendant, a backlit wall disc and
 * the tear-off block calendar every family hangs up for Tết.
 *
 * Three patterns: a gilded lotus relief on dark lacquer, blue-and-white (thanh hoa) porcelain and
 * the interlocking-coin lattice (hoa văn đồng tiền) cut out of the partition.
 */
import {
  box,
  clamp,
  cyl,
  defineItem,
  definePack,
  discZ,
  frame4,
  knob,
  lathe,
  line,
  matSlot,
  range,
  rectPoly,
  rod,
  rodX,
  segmentText,
  spaced,
  span,
  sphere,
  torus,
  vcyl,
  type PackMaterial,
  type PackPattern,
  type Part,
} from '@/packs/kit';

const TAU = Math.PI * 2;
const NP = { plan: false } as const;
/** Ceiling height ceiling fittings are dimensioned for (as the lighting packs). */
const CEILING = 2.7;
const WARM = '#ffd9a8';

// ---------------------------------------------------------------------------
// Patterns
// ---------------------------------------------------------------------------

/** Calls `fn` with the canvas translated to (x, y) and its eight wrapped copies, so motifs tile. */
function wrapped(ctx: CanvasRenderingContext2D, size: number, x: number, y: number, fn: () => void): void {
  for (const dx of [-size, 0, size]) {
    for (const dy of [-size, 0, size]) {
      ctx.save();
      ctx.translate(x + dx, y + dy);
      fn();
      ctx.restore();
    }
  }
}

/** Gilded lotus relief on dark lacquer (the backdrop of an altar). */
function drawLotusGilt(ctx: CanvasRenderingContext2D, size: number, rand: () => number): void {
  ctx.fillStyle = '#34170c';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 600; i++) {
    ctx.fillStyle = `rgba(${90 + rand() * 40},${40 + rand() * 20},20,${0.12 + rand() * 0.2})`;
    ctx.fillRect(rand() * size, rand() * size, 1 + rand() * 2, 1 + rand() * 2);
  }
  // Water ripples (sine periods divide the tile, so they wrap).
  ctx.lineWidth = Math.max(1, size * 0.004);
  for (const k of range(7)) {
    ctx.strokeStyle = `rgba(214,170,80,${0.12 + (k % 2) * 0.08})`;
    ctx.beginPath();
    const y0 = ((k + 0.5) * size) / 7;
    for (let x = 0; x <= size; x += size / 64) {
      const y = y0 + Math.sin((x / size) * TAU * 3 + k) * size * 0.008;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  const gold = (a = 1) => `rgba(${214 + rand() * 30},${168 + rand() * 30},${78 + rand() * 30},${a})`;
  const leafAt = (x: number, y: number, r: number) =>
    wrapped(ctx, size, x, y, () => {
      ctx.scale(1, 0.62);
      ctx.fillStyle = 'rgba(140,98,38,0.9)';
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#d6ae5c';
      ctx.lineWidth = r * 0.05;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(70,40,10,0.3)';
      ctx.lineWidth = r * 0.025;
      for (const k of range(8)) {
        const a = (k / 8) * TAU + 0.2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * r * 0.92, Math.sin(a) * r * 0.92);
        ctx.stroke();
      }
    });
  const flowerAt = (x: number, y: number, r: number) =>
    wrapped(ctx, size, x, y, () => {
      ctx.strokeStyle = '#c99a3e';
      ctx.lineWidth = r * 0.07;
      ctx.beginPath();
      ctx.moveTo(0, r * 0.2);
      ctx.quadraticCurveTo(r * 0.3, r * 1.4, -r * 0.1, r * 2.4);
      ctx.stroke();
      for (const k of [-3, 3, -2, 2, -1, 1, 0]) {
        ctx.save();
        ctx.rotate(k * 0.36);
        ctx.fillStyle = gold();
        ctx.strokeStyle = 'rgba(80,45,12,0.7)';
        ctx.lineWidth = r * 0.035;
        ctx.beginPath();
        ctx.ellipse(0, -r * 0.5, r * 0.2, r * 0.55, 0, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    });
  const budAt = (x: number, y: number, r: number) =>
    wrapped(ctx, size, x, y, () => {
      ctx.strokeStyle = '#c99a3e';
      ctx.lineWidth = r * 0.12;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(r * 0.2, r * 2.2);
      ctx.stroke();
      ctx.fillStyle = gold();
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.4, r * 0.32, r * 0.6, 0, 0, TAU);
      ctx.fill();
    });
  const s = size;
  leafAt(s * 0.16, s * 0.82, s * 0.085);
  leafAt(s * 0.62, s * 0.9, s * 0.1);
  leafAt(s * 0.9, s * 0.46, s * 0.07);
  leafAt(s * 0.42, s * 0.3, s * 0.06);
  flowerAt(s * 0.3, s * 0.58, s * 0.12);
  flowerAt(s * 0.76, s * 0.66, s * 0.1);
  flowerAt(s * 0.62, s * 0.2, s * 0.11);
  flowerAt(s * 0.1, s * 0.22, s * 0.09);
  budAt(s * 0.48, s * 0.46, s * 0.06);
  budAt(s * 0.95, s * 0.8, s * 0.05);
  budAt(s * 0.24, s * 0.06, s * 0.05);
}

/** Blue-and-white (thanh hoa) porcelain: cobalt scrolls and five-petal flowers on white glaze. */
function drawThanhHoa(ctx: CanvasRenderingContext2D, size: number, rand: () => number): void {
  ctx.fillStyle = '#eef1f4';
  ctx.fillRect(0, 0, size, size);
  // Bands round the pot.
  ctx.fillStyle = '#23408f';
  for (const y of [0.04, 0.96]) ctx.fillRect(0, size * y - size * 0.012, size, size * 0.024);
  ctx.fillRect(0, size * 0.5 - size * 0.006, size, size * 0.012);
  ctx.strokeStyle = '#2a4a9a';
  ctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const x = rand() * size;
    const y = size * (0.12 + rand() * 0.76);
    const r = size * (0.03 + rand() * 0.04);
    wrapped(ctx, size, x, y, () => {
      ctx.lineWidth = size * 0.008;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.6, rand() * TAU, rand() * TAU + 3);
      ctx.stroke();
      ctx.fillStyle = '#284a9c';
      for (const k of range(5)) {
        const a = (k / 5) * TAU;
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.42, r * 0.26, a, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#eef1f4';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.22, 0, TAU);
      ctx.fill();
    });
  }
}

/** Interlocking-coin lattice (hoa văn đồng tiền) for CNC screens: solid rings, holes elsewhere. */
function drawHoaVan(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.clearRect(0, 0, size, size);
  const n = 3;
  const c = size / n;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = c * 0.12;
  for (let i = -1; i <= n; i++) {
    for (let j = -1; j <= n; j++) {
      for (const [x, y] of [
        [i * c, j * c],
        [(i + 0.5) * c, (j + 0.5) * c],
      ]) {
        ctx.beginPath();
        ctx.arc(x, y, c * 0.5, 0, TAU);
        ctx.stroke();
      }
    }
  }
  // Small bosses where the rings cross.
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i <= 2 * n; i++) {
    for (let j = 0; j <= 2 * n; j++) {
      if ((i + j) % 2 === 0) continue;
      ctx.beginPath();
      ctx.arc((i * c) / 2, (j * c) / 2, c * 0.07, 0, TAU);
      ctx.fill();
    }
  }
}

/**
 * Shared rim profile of a 190 × 190 mm hollow glass block (`u, v` in [0, 1]): a chamfered outer edge,
 * a thick pillowed glass rim with internal reflection band, a bright inner refraction ridge and a
 * deep recessed step around `inner(u, v)`.
 */
function drawGlassBlockTile(ctx: CanvasRenderingContext2D, size: number, innerFn: (u: number, v: number) => number): void {
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const sstep = (a: number, b: number, x: number) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  for (let py = 0, p = 0; py < size; py++) {
    const v = (py + 0.5) / size;
    const dy = Math.abs(v - 0.5) * 2;
    for (let px = 0; px < size; px++, p += 4) {
      const u = (px + 0.5) / size;
      const dx = Math.abs(u - 0.5) * 2;
      // Slightly rounded square Chebyshev distance so the inner frame corners have a realistic glass radius.
      const overX = Math.max(0, dx - 0.62);
      const overY = Math.max(0, dy - 0.62);
      const edge = Math.max(dx, dy) * 0.72 + (0.62 + Math.hypot(overX, overY)) * 0.28;
      // Outer glass rim: chamfered edge, internal-reflection band, bright inner step ridge and deep recess groove.
      const outerChamfer = 1 - 0.34 * sstep(0.91, 1.0, Math.max(dx, dy));
      const rimBand = 0.84 - 0.14 * Math.sin(clamp((edge - 0.75) / 0.17, 0, 1) * Math.PI);
      const outerHighlight = Math.exp(-Math.pow((edge - 0.91) / 0.022, 2)) * 0.14;
      const stepRidge = Math.exp(-Math.pow((edge - 0.74) / 0.022, 2)) * 0.2;
      const stepGroove = Math.exp(-Math.pow((edge - 0.69) / 0.024, 2)) * 0.34;
      const rimL = clamp((rimBand + outerHighlight + stepRidge) * outerChamfer, 0, 1);
      const fieldL = clamp(innerFn(u, v) - stepGroove, 0, 1);
      const mask = sstep(0.68, 0.73, edge);
      const L = clamp(fieldL * (1 - mask) + rimL * mask, 0, 1);
      const c = Math.round(L * 255);
      d[p] = c;
      d[p + 1] = c;
      d[p + 2] = c;
      d[p + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** Wavy water-cloud glass block (gạch kính vân sóng nước / vân mây). */
function drawGlassBlockWave(ctx: CanvasRenderingContext2D, size: number): void {
  drawGlassBlockTile(ctx, size, (u, v) => {
    const wx = (u - 0.5) * TAU;
    const wy = (v - 0.5) * TAU;
    const p = wx + 0.78 * Math.sin(wy * 2 + 0.4) + 0.42 * Math.cos((wx + wy) * 2 - 0.6);
    const q = wy + 0.78 * Math.cos(wx * 2 - 0.3) + 0.42 * Math.sin((wx - wy) * 2 + 0.5);
    const wave =
      0.44 * Math.sin(p * 2 + q) +
      0.34 * Math.cos(q * 2 - p * 0.6) +
      0.22 * Math.sin((p + q) * 3 + 0.8);
    const caustic = Math.pow(0.5 + 0.5 * Math.sin(p * 4 - q * 3), 2) * 0.08;
    const ridge = Math.pow(0.5 + 0.5 * wave, 1.35);
    return 0.48 + 0.48 * ridge + caustic;
  });
}

/** Cross-reeded checkered glass block (gạch kính vân ô vuông caro). */
function drawGlassBlockGrid(ctx: CanvasRenderingContext2D, size: number): void {
  drawGlassBlockTile(ctx, size, (u, v) => {
    const cells = 14;
    const gx = Math.abs(((u * cells) % 1) * 2 - 1);
    const gy = Math.abs(((v * cells) % 1) * 2 - 1);
    const facet = (1 - Math.pow(gx, 2.1)) * (1 - Math.pow(gy, 2.1));
    const reed = 0.04 * (Math.cos(u * cells * TAU * 2) + Math.cos(v * cells * TAU * 2));
    return 0.44 + 0.52 * facet + reed;
  });
}

const BLOCK_SCALE = 0.19;

const patterns: PackPattern[] = [
  { id: 'lotus-gilt', name: 'Gilded lotus relief', normalStrength: 0.7, colored: true, draw: drawLotusGilt },
  { id: 'thanh-hoa', name: 'Blue-and-white porcelain', normalStrength: 0.1, colored: true, draw: drawThanhHoa },
  { id: 'hoa-van', name: 'Coin lattice (hoa văn đồng tiền)', normalStrength: 0.6, cutout: true, draw: drawHoaVan },
  { id: 'glass-block-wave', name: 'Wave glass block (vân sóng nước)', normalStrength: 1.15, draw: drawGlassBlockWave },
  { id: 'glass-block-grid', name: 'Checkered glass block (vân ô vuông)', normalStrength: 1.15, draw: drawGlassBlockGrid },
];

const materials: PackMaterial[] = [
  { id: 'go-lacquer', name: 'Dark lacquered wood', category: 'wood', color: '#3f2115', roughness: 0.3, pattern: { id: 'wood-grain', scale: 0.7, contrast: 0.6 } },
  { id: 'lotus-gilt', name: 'Gilded lotus backdrop', color: '#ffffff', roughness: 0.4, metalness: 0.2, pattern: { id: 'lotus-gilt', scale: 0.75 } },
  { id: 'gilt', name: 'Gilt brass', category: 'metal', color: '#cfa04a', roughness: 0.3, metalness: 0.85 },
  { id: 'thanh-hoa', name: 'Blue-and-white porcelain', color: '#ffffff', roughness: 0.15, pattern: { id: 'thanh-hoa', scale: 0.35 } },
  { id: 'shrine-red', name: 'Red lacquer', color: '#9a1c14', roughness: 0.22 },
  { id: 'altar-lamp', name: 'Red altar lamp', color: '#ff7a5a', roughness: 0.4, emissive: '#ff3a1a', emissiveIntensity: 2.2 },
  { id: 'zebra-band', name: 'Zebra blind fabric', category: 'fabric', color: '#d8cebd', roughness: 0.9, pattern: { id: 'weave', scale: 0.08, contrast: 0.35 } },
  { id: 'zebra-sheer', name: 'Zebra blind sheer', category: 'fabric', color: '#f6f2ea', roughness: 0.9, opacity: 0.28, pattern: { id: 'weave', scale: 0.04, contrast: 0.5 } },
  { id: 'grille-iron', name: 'Powder-coated iron', category: 'metal', color: '#2d2b29', roughness: 0.5, metalness: 0.45 },
  { id: 'cnc-oak', name: 'CNC-cut oak lattice', category: 'wood', color: '#c49a68', roughness: 0.6, pattern: { id: 'hoa-van', scale: 0.48 } },
  { id: 'glass-block-wave', name: 'Wave glass block (vân sóng nước)', category: 'glass', color: '#cad7db', roughness: 0.14, metalness: 0.08, opacity: 0.78, pattern: { id: 'glass-block-wave', scale: BLOCK_SCALE, contrast: 1 } },
  { id: 'glass-block-grid', name: 'Checkered glass block (vân ô vuông)', category: 'glass', color: '#c6d3d7', roughness: 0.18, metalness: 0.08, opacity: 0.8, pattern: { id: 'glass-block-grid', scale: BLOCK_SCALE, contrast: 1 } },
  { id: 'glass-block-amber', name: 'Warm amber wave glass block', category: 'glass', color: '#dccab0', roughness: 0.14, metalness: 0.08, opacity: 0.78, pattern: { id: 'glass-block-wave', scale: BLOCK_SCALE, contrast: 1 } },
  { id: 'glass-block-amber-grid', name: 'Warm amber checkered glass block', category: 'glass', color: '#d8c5aa', roughness: 0.18, metalness: 0.08, opacity: 0.8, pattern: { id: 'glass-block-grid', scale: BLOCK_SCALE, contrast: 1 } },
  { id: 'lotus-shade', name: 'Matte lotus-leaf shade', color: '#f2ede3', roughness: 0.85 },
  { id: 'lich-red', name: 'Calendar board red', color: '#b5191c', roughness: 0.45 },
  { id: 'calendar-paper', name: 'Newsprint paper', category: 'fabric', color: '#f6f2e9', roughness: 0.95 },
  { id: 'lich-ink', name: 'Red print', color: '#c81e1e', roughness: 0.6 },
];

// ---------------------------------------------------------------------------
// Altar pieces
// ---------------------------------------------------------------------------

/** Incense bowl (bát hương) on y with three sticks, sized by `r`. */
function incenseBowl(bowl: string, sticks: string, x: number, y: number, z: number, r: number): Part[] {
  const h = r * 1.25;
  const parts: Part[] = [
    lathe(bowl, [x, y, z], [
      [0, 0],
      [r * 0.62, 0],
      [r * 0.66, h * 0.12],
      [r * 0.95, h * 0.6],
      [r, h * 0.92],
      [r * 0.93, h],
      [r * 0.86, h * 0.9],
    ], { segments: 24, plan: false }),
  ];
  for (const k of [-1, 0, 1]) {
    parts.push(rod(sticks, [x + k * r * 0.18, y + h * 0.7, z], [x + k * r * 0.55, y + h + r * 2.2, z - r * 0.1], 0.0018, { segments: 6, plan: false }));
  }
  return parts;
}

/** Candlestick (chân nến): footed lathe `h` tall. */
const candlestick = (slot: string, x: number, y: number, z: number, h: number): Part =>
  lathe(slot, [x, y, z], [
    [0, 0],
    [h * 0.2, 0],
    [h * 0.2, h * 0.05],
    [h * 0.07, h * 0.12],
    [h * 0.05, h * 0.5],
    [h * 0.09, h * 0.56],
    [h * 0.04, h * 0.62],
    [h * 0.035, h * 0.9],
    [h * 0.12, h * 0.94],
    [h * 0.12, h],
    [0, h],
  ], { segments: 18, plan: false });

/** Bottle vase (lọ lục bình), `h` tall. */
const bottleVase = (slot: string, x: number, y: number, z: number, h: number): Part =>
  lathe(slot, [x, y, z], [
    [0, 0],
    [h * 0.16, 0],
    [h * 0.2, h * 0.08],
    [h * 0.25, h * 0.32],
    [h * 0.2, h * 0.55],
    [h * 0.08, h * 0.72],
    [h * 0.065, h * 0.9],
    [h * 0.1, h],
    [h * 0.07, h],
  ], { segments: 22, plan: false });

/** Lidded jar (hũ) `h` tall with a knob. */
const lidJar = (slot: string, x: number, y: number, z: number, h: number): Part[] => [
  lathe(slot, [x, y, z], [
    [0, 0],
    [h * 0.24, 0],
    [h * 0.34, h * 0.3],
    [h * 0.33, h * 0.62],
    [h * 0.22, h * 0.8],
    [h * 0.26, h * 0.84],
    [h * 0.18, h * 0.94],
    [0, h * 0.94],
  ], { segments: 20, plan: false }),
  sphere(slot, [x, y + h * 0.95, z], h * 0.06, NP),
];

const altarCabinet = defineItem({
  id: 'altar-cabinet',
  name: 'Ancestral altar cabinet with lotus backdrop',
  category: 'living',
  type: 'storage',
  group: 'Sideboards & cabinets',
  tags: ['altar', 'bàn thờ', 'tủ thờ', 'ban tho', 'tu tho', 'ancestor altar', 'worship', 'lotus', 'gilded', 'vietnamese'],
  description:
    'A dark lacquered wood altar cabinet (tủ thờ) with three drawers, panelled doors, a raised offering step and a gilded lotus backdrop, set with a brass incense bowl, candlesticks and blue-and-white vases.',
  defaultSize: { w: 1.27, d: 0.61, h: 2.1 },
  minSize: { w: 0.9, d: 0.45, h: 1.5 },
  maxSize: { w: 2.2, d: 0.8, h: 2.6 },
  slots: [
    matSlot('wood', 'Lacquered wood', 'go-lacquer'),
    matSlot('backdrop', 'Lotus backdrop', 'lotus-gilt'),
    matSlot('brass', 'Brass & gilding', 'gilt'),
    matSlot('porcelain', 'Porcelain', 'thanh-hoa'),
  ],
  build: ({ w, d, h }) => {
    const z0 = -d / 2;
    const z1 = d / 2;
    const hc = clamp(h * 0.6, 0.8, 1.3);
    const top = 0.04;
    const plinth = 0.09;
    const ins = 0.025;
    const zf = z1 - 0.05; // carcass front (the top overhangs the fronts and their knobs)
    const ft = 0.016; // front thickness
    const parts: Part[] = [
      span('wood', [-w / 2 + ins, w / 2 - ins], [0, plinth], [z0 + ins, zf - 0.02]),
      span('wood', [-w / 2 + ins, w / 2 - ins], [plinth, hc - top], [z0, zf]),
      span('wood', [-w / 2, w / 2], [hc - top, hc], [z0, z1]),
    ];
    // Drawer row and two panelled doors.
    const gap = 0.006;
    const x0 = -w / 2 + ins + 0.02;
    const x1 = w / 2 - ins - 0.02;
    const y0 = plinth + 0.02;
    const y1 = hc - top - 0.02;
    const dh = (y1 - y0) * 0.24;
    const front = (xa: number, xb: number, ya: number, yb: number, kx: number, ky: number) => {
      const m = Math.min(0.04, (xb - xa) * 0.12, (yb - ya) * 0.18);
      parts.push(
        span('wood', [xa, xb], [ya, yb], [zf, zf + ft], NP),
        span('wood', [xa + m, xb - m], [ya + m, yb - m], [zf + ft, zf + ft + 0.006], NP),
        ...knob('brass', [kx, ky, zf + ft + 0.006], 0.011),
      );
    };
    for (const k of range(3)) {
      const xa = x0 + ((x1 - x0) * k) / 3 + (k ? gap / 2 : 0);
      const xb = x0 + ((x1 - x0) * (k + 1)) / 3 - (k < 2 ? gap / 2 : 0);
      front(xa, xb, y1 - dh, y1, (xa + xb) / 2, y1 - dh / 2);
    }
    for (const s of [-1, 1]) {
      const xa = s < 0 ? x0 : gap / 2;
      const xb = s < 0 ? -gap / 2 : x1;
      front(xa, xb, y0, y1 - dh - gap, s * 0.035, (y0 + y1 - dh) / 2);
    }
    // Backdrop frame, gilded panel and crown.
    const hTop = h - 0.09;
    const fw = clamp(w * 0.05, 0.045, 0.08);
    const bx = w / 2 - 0.03;
    const zb = z0 + 0.04;
    parts.push(
      ...frame4('wood', [-bx, bx], [hc, hTop], [z0, zb], fw, { plan: true }),
      span('backdrop', [-bx + fw, bx - fw], [hc + fw, hTop - fw], [z0, z0 + 0.024], NP),
      span('wood', [-w / 2, w / 2], [hTop, h - 0.03], [z0, z0 + 0.075], NP),
      span('wood', [-w / 2 + 0.03, w / 2 - 0.03], [h - 0.03, h], [z0, z0 + 0.06], NP),
      span('brass', [-bx, bx], [hTop + 0.02, hTop + 0.03], [z0 + 0.075, z0 + 0.08], NP),
    );
    // Raised offering step at the back.
    const sd = clamp(d * 0.3, 0.12, 0.22);
    const sw = w * 0.78;
    const yS = hc + 0.1;
    parts.push(span('wood', [-sw / 2, sw / 2], [hc, yS], [zb, zb + sd], NP));
    // Offerings.
    const zo = clamp(zb + sd + 0.11, z0 + d * 0.45, z1 - 0.1);
    const ir = clamp(w * 0.07, 0.065, 0.11);
    const tr = Math.min(0.12, sd / 2 - 0.005);
    parts.push(
      ...incenseBowl('brass', 'wood', 0, hc, zo, ir),
      candlestick('brass', -w * 0.2, hc, zo, 0.3),
      candlestick('brass', w * 0.2, hc, zo, 0.3),
      bottleVase('porcelain', -w * 0.36, hc, zo - 0.02, 0.32),
      bottleVase('porcelain', w * 0.36, hc, zo - 0.02, 0.32),
      ...lidJar('porcelain', -sw * 0.3, yS, zb + sd / 2, 0.2),
      ...lidJar('porcelain', sw * 0.3, yS, zb + sd / 2, 0.2),
      // Footed offering tray (mâm bồng) in the middle of the step.
      lathe('brass', [0, yS, zb + sd / 2], [
        [0, 0],
        [tr * 0.5, 0],
        [tr * 0.25, 0.05],
        [tr * 0.25, 0.09],
        [tr, 0.11],
        [tr, 0.12],
        [0, 0.12],
      ], { segments: 24, plan: false }),
    );
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w / 2 + 0.03, -d / 2 + 0.04], [w / 2 - 0.03, -d / 2 + 0.04]), rectPoly(-w * 0.39, -d / 2 + 0.04, w * 0.39, -d / 2 + 0.04 + clamp(d * 0.3, 0.12, 0.22))],
});

const hangingAltar = defineItem({
  id: 'hanging-altar-shelf',
  name: 'Wall-hung altar shelf (bàn thờ treo)',
  category: 'living',
  type: 'storage',
  group: 'Sideboards & cabinets',
  tags: ['altar', 'bàn thờ treo', 'ban tho treo', 'wall altar', 'ancestor', 'worship', 'apartment', 'vietnamese'],
  description:
    'A compact lacquered wood altar box hung high on the wall, with a gilded lotus back panel, an LED strip under its canopy and a brass incense bowl, candle lamps and offering tray, the usual solution in small apartments.',
  mount: 'wall',
  defaultElevation: 1.4,
  defaultSize: { w: 0.81, d: 0.48, h: 0.81 },
  minSize: { w: 0.6, d: 0.35, h: 0.5 },
  maxSize: { w: 1.27, d: 0.61, h: 1.1 },
  slots: [
    matSlot('wood', 'Lacquered wood', 'go-lacquer'),
    matSlot('backdrop', 'Back panel', 'lotus-gilt'),
    matSlot('brass', 'Brass offerings', 'gilt'),
    matSlot('light', 'LED strip', 'light-warm'),
  ],
  light: { color: WARM, intensity: 0.5, distance: 2.5, y: 0.75, z: 0.19, kind: 'spot', angle: 1.0, penumbra: 0.7 },
  build: ({ w, d, h }) => {
    const z0 = -d / 2;
    const z1 = d / 2;
    const t = 0.02;
    const base = 0.06;
    const parts: Part[] = [
      span('wood', [-w / 2, w / 2], [0, base], [z0, z1 - 0.012]),
      span('wood', [-w / 2 + 0.03, w / 2 - 0.03], [0.008, base - 0.008], [z1 - 0.012, z1], NP),
      span('wood', [-w / 2, w / 2], [base, h - 0.05], [z0, z0 + t]),
      span('wood', [-w / 2, -w / 2 + t], [base, h - 0.05], [z0 + t, z1 - 0.05]),
      span('wood', [w / 2 - t, w / 2], [base, h - 0.05], [z0 + t, z1 - 0.05]),
      span('wood', [-w / 2, w / 2], [h - 0.05, h], [z0, z1], NP),
      span('wood', [-w / 2 + t, w / 2 - t], [h - 0.085, h - 0.05], [z1 - 0.03, z1 - 0.012], NP),
      span('light', [-w / 2 + 0.04, w / 2 - 0.04], [h - 0.058, h - 0.053], [z1 - 0.06, z1 - 0.035], NP),
      span('backdrop', [-w / 2 + 0.05, w / 2 - 0.05], [base + 0.06, h - 0.11], [z0 + t, z0 + t + 0.006], NP),
    ];
    const zo = z0 + d * 0.62;
    const ir = clamp(w * 0.08, 0.05, 0.09);
    parts.push(...incenseBowl('brass', 'wood', 0, base, zo, ir));
    for (const s of [-1, 1]) {
      // A candle lamp (đèn thờ) and a footed fruit tray on each side.
      const x = s * w * 0.3;
      parts.push(
        candlestick('brass', x, base, zo, clamp(h * 0.28, 0.14, 0.26)),
        lathe('brass', [s * w * 0.18, base, z0 + d * 0.32], [
          [0, 0],
          [0.035, 0],
          [0.02, 0.04],
          [0.02, 0.06],
          [0.08, 0.075],
          [0.08, 0.082],
          [0, 0.082],
        ], { segments: 18, plan: false }),
      );
    }
    return parts;
  },
});

const thanTaiShrine = defineItem({
  id: 'than-tai-shrine',
  name: 'Thần Tài shrine (bàn thờ Thần Tài)',
  category: 'living',
  type: 'storage',
  group: 'Sideboards & cabinets',
  tags: ['than tai', 'thần tài', 'ông địa', 'ong dia', 'shrine', 'god of wealth', 'altar', 'red lacquer', 'vietnamese'],
  description:
    'A small red-lacquered floor shrine with a gilded tiled roof for Thần Tài and Ông Địa, the gods of wealth and the land, with two gilt figures, an incense bowl and glowing red altar lamps; it stands on the floor facing the front door.',
  defaultSize: { w: 0.48, d: 0.48, h: 0.81 },
  minSize: { w: 0.36, d: 0.36, h: 0.5 },
  maxSize: { w: 0.81, d: 0.61, h: 1.1 },
  slots: [
    matSlot('body', 'Red lacquer', 'shrine-red'),
    matSlot('gilt', 'Gilding & figures', 'gilt'),
    matSlot('wood', 'Base', 'go-lacquer'),
    matSlot('light', 'Altar lamps', 'altar-lamp'),
  ],
  light: {
    color: '#ff6a40',
    intensity: 0.22,
    distance: 1.2,
    y: 0.14,
    heads: [
      { x: -0.16, y: 0.14, z: 0.15 },
      { x: 0.16, y: 0.14, z: 0.15 },
    ],
  },
  build: ({ w, d, h }) => {
    const z0 = -d / 2;
    const z1 = d / 2;
    const fl = 0.08;
    const hr = clamp(h * 0.72, 0.36, h - 0.12);
    const wi = w / 2 - 0.015;
    const parts: Part[] = [
      span('wood', [-w / 2, w / 2], [0, 0.05], [z0, z1]),
      span('body', [-wi, wi], [0.05, fl], [z0, z1 - 0.015]),
      span('body', [-wi, wi], [fl, hr], [z0, z0 + 0.02]),
      span('body', [-wi, -wi + 0.02], [fl, hr], [z0 + 0.02, z1 - 0.07]),
      span('body', [wi - 0.02, wi], [fl, hr], [z0 + 0.02, z1 - 0.07]),
      span('gilt', [-wi + 0.04, wi - 0.04], [fl + 0.04, hr - 0.04], [z0 + 0.02, z0 + 0.024], NP),
      span('body', [-w / 2 + 0.005, w / 2 - 0.005], [hr, hr + 0.03], [z0, z1 - 0.012], NP),
    ];
    // Front columns with gilt bands.
    for (const s of [-1, 1]) {
      const x = s * (wi - 0.03);
      const z = z1 - 0.045;
      parts.push(vcyl('body', x, z, fl, hr, 0.016, { segments: 14, plan: false }));
      for (const y of [fl + 0.03, hr - 0.03]) parts.push(cyl('gilt', [x, y, z], 0.019, 0.012, { segments: 14, plan: false }));
    }
    // Gable roof: two red sloping slabs with gilt eaves, meeting at a gilt ridge.
    const ry = hr + 0.03;
    const rh = Math.max(0.04, h - ry - 0.035);
    const half = d / 2 - 0.01;
    const L = Math.hypot(half, rh) - 0.012;
    const phi = Math.atan2(rh, half);
    for (const s of [-1, 1]) {
      parts.push({
        ...span('body', [-w / 2 + 0.01, w / 2 - 0.01], [-0.008, 0.008], [-L / 2, L / 2], NP),
        position: [0, ry + rh / 2, (s * half) / 2],
        rotation: [s * phi, 0, 0],
      });
    }
    parts.push(span('gilt', [-w / 2 + 0.005, w / 2 - 0.005], [hr, hr + 0.03], [z1 - 0.012, z1], NP));
    parts.push(rodX('gilt', -w / 2 + 0.03, w / 2 - 0.03, h - 0.022, 0, 0.012, NP));
    for (const s of [-1, 1]) parts.push(sphere('gilt', [s * (w / 2 - 0.035), h - 0.022, 0], 0.018, NP));
    // Seated figures: Thần Tài (left, official's hat with side wings, ingot in hand) and Ông Địa
    // (right, bald, big laughing belly, a palm fan).
    const fh = clamp((hr - fl) * 0.45, 0.08, 0.22);
    const fz = z0 + 0.02 + (d - 0.1) * 0.38;
    for (const [s, fat] of [
      [-1, 1],
      [1, 1.2],
    ] as const) {
      const x = s * w * 0.2;
      const y0 = fl;
      parts.push(
        // Robe: wide where it falls over the seat, narrowing to the shoulders.
        lathe('gilt', [x, y0, fz], [
          [0, 0],
          [fh * 0.24 * fat, 0],
          [fh * 0.25 * fat, fh * 0.08],
          [fh * 0.18 * fat, fh * 0.2],
          [fh * 0.17 * fat, fh * 0.48],
          [fh * 0.14 * fat, fh * 0.62],
          [fh * 0.06, fh * 0.68],
          [0, fh * 0.68],
        ], { segments: 18, plan: false }),
        // Knees and lap reaching forward.
        span('gilt', [x - fh * 0.19 * fat, x + fh * 0.19 * fat], [y0, y0 + fh * 0.2], [fz, fz + fh * 0.3], { bevel: fh * 0.06, plan: false }),
        // Hands resting together on the lap.
        sphere('gilt', [x, y0 + fh * 0.34, fz + fh * 0.17], fh * 0.07, { scale: [1.5, 1, 1], plan: false }),
        sphere('gilt', [x, y0 + fh * 0.78, fz], fh * 0.11 * fat, NP),
      );
      if (fat === 1) {
        parts.push(
          cyl('gilt', [x, y0 + fh * 0.92, fz], fh * 0.09, fh * 0.1, { rTop: fh * 0.07, segments: 14, plan: false }),
          span('gilt', [x - fh * 0.24, x + fh * 0.24], [y0 + fh * 0.9, y0 + fh * 0.93], [fz - fh * 0.06, fz - fh * 0.03], NP),
          span('gilt', [x - fh * 0.06, x + fh * 0.06], [y0 + fh * 0.38, y0 + fh * 0.44], [fz + fh * 0.2, fz + fh * 0.28], { bevel: fh * 0.02, plan: false }),
        );
      } else {
        parts.push(
          sphere('gilt', [x, y0 + fh * 0.36, fz + fh * 0.1], fh * 0.17, NP),
          cyl('gilt', [x + fh * 0.27, y0 + fh * 0.55, fz + fh * 0.05], fh * 0.11, fh * 0.012, { rotation: [Math.PI / 2, 0, 0.3], segments: 16, plan: false }),
        );
      }
    }
    parts.push(...incenseBowl('gilt', 'wood', 0, fl, z1 - 0.12, clamp(w * 0.08, 0.03, 0.06)));
    // Electric altar lamps.
    for (const s of [-1, 1]) {
      const x = s * w * 0.33;
      parts.push(
        cyl('gilt', [x, fl + 0.02, z1 - 0.09], 0.02, 0.04, { rTop: 0.008, segments: 12, plan: false }),
        lathe('light', [x, fl + 0.04, z1 - 0.09], [
          [0, 0],
          [0.012, 0],
          [0.024, 0.03],
          [0.022, 0.05],
          [0, 0.05],
        ], { segments: 12, plan: false }),
      );
    }
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w / 2, 0], [w / 2, 0]), rectPoly(-w / 2 + 0.015, -d / 2, w / 2 - 0.015, -d / 2 + 0.02)],
});

// ---------------------------------------------------------------------------
// Windows, balconies and partitions
// ---------------------------------------------------------------------------

const zebraBlind = defineItem({
  id: 'zebra-blind',
  name: 'Zebra blind (rèm cầu vồng)',
  category: 'decor',
  type: 'decor',
  group: 'Curtains & blinds',
  tags: ['zebra blind', 'rèm cầu vồng', 'rem cau vong', 'day and night blind', 'roller blind', 'striped', 'window', 'apartment'],
  description:
    'A double-layer roller blind with alternating opaque and sheer polyester bands under a white aluminium cassette; sliding the layers lines the sheer bands up to let light through, as in most Vietnamese apartments.',
  mount: 'wall',
  defaultElevation: 0.7,
  defaultSize: { w: 1.2, d: 0.09, h: 1.6 },
  minSize: { w: 0.4, d: 0.06, h: 0.6 },
  maxSize: { w: 3.0, d: 0.14, h: 3.0 },
  slots: [
    matSlot('fabric', 'Solid bands', 'zebra-band'),
    matSlot('sheer', 'Sheer bands', 'zebra-sheer'),
    matSlot('cassette', 'Cassette & rail', 'metal-white-powder'),
  ],
  build: ({ w, d, h }) => {
    const z0 = -d / 2;
    const ch = clamp(d * 0.95, 0.06, 0.1);
    const parts: Part[] = [
      span('cassette', [-w / 2, w / 2], [h - ch, h], [z0, d / 2], { bevel: 0.012 }),
      span('cassette', [-w / 2 + 0.01, w / 2 - 0.01], [0.012, 0.03], [z0 + 0.012, z0 + 0.034], NP),
    ];
    const zBack = z0 + 0.016;
    const zFront = z0 + 0.03;
    const top = h - ch;
    const solid = 0.075;
    const sheer = 0.05;
    const n = Math.max(1, Math.floor((top - 0.03) / (solid + sheer)));
    const step = (top - 0.03) / n;
    const sb = step * (solid / (solid + sheer));
    for (const k of range(n)) {
      const ya = 0.03 + k * step;
      for (const z of [zBack, zFront]) {
        parts.push(
          span('fabric', [-w / 2 + 0.012, w / 2 - 0.012], [ya, ya + sb], [z, z + 0.0015], NP),
          span('sheer', [-w / 2 + 0.012, w / 2 - 0.012], [ya + sb, ya + step], [z, z + 0.0015], NP),
        );
      }
    }
    // Beaded control chain on the right.
    const cx = w / 2 - 0.02;
    const zc = d / 2 - 0.012;
    parts.push(
      rod('cassette', [cx, h - ch, zc], [cx, Math.max(0.05, h * 0.35), zc], 0.002, { segments: 6, plan: false }),
      rod('cassette', [cx - 0.012, h - ch, zc], [cx - 0.012, Math.max(0.05, h * 0.35), zc], 0.002, { segments: 6, plan: false }),
    );
    return parts;
  },
});

const windowGrille = defineItem({
  id: 'window-security-grille',
  name: 'Iron window grille (khung sắt bảo vệ)',
  category: 'construction',
  type: 'structure',
  group: 'Built-ins',
  tags: ['window grille', 'security bars', 'hoa sắt', 'hoa sat', 'khung bảo vệ', 'burglar bars', 'iron', 'window', 'vietnamese'],
  description:
    'A powder-coated square-tube iron grille fixed over a window, with vertical bars and a band of rings (hoa sắt) across it, the burglar and child guard on most Vietnamese windows.',
  mount: 'wall',
  defaultElevation: 0.9,
  defaultSize: { w: 1.2, d: 0.05, h: 1.4 },
  minSize: { w: 0.5, d: 0.03, h: 0.5 },
  maxSize: { w: 3.0, d: 0.12, h: 2.6 },
  slots: [
    matSlot('frame', 'Frame & bars', 'grille-iron'),
    matSlot('motif', 'Rings', 'grille-iron'),
  ],
  build: ({ w, d, h }) => {
    const z0 = -d / 2;
    const t = 0.03;
    const zc = z0 + t / 2;
    const parts: Part[] = [...frame4('frame', [-w / 2, w / 2], [0, h], [z0, z0 + t], t, { plan: true })];
    const n = Math.max(2, Math.round((w - 2 * t) / 0.11));
    const xs = spaced(n + 1, -w / 2 + t, w / 2 - t).slice(1, -1);
    const bar = 0.014;
    for (const x of xs) parts.push(span('frame', [x - bar / 2, x + bar / 2], [t, h - t], [zc - bar / 2, zc + bar / 2], NP));
    // Band of rings between two rails, and a rail near the top.
    const band = clamp((w - 2 * t) / (n), 0.06, 0.13);
    const yb = clamp(h * 0.3, t + 0.02, h - t - band - 0.02);
    for (const y of [yb, yb + band, h - t - 0.12]) {
      if (y < t + 0.01 || y > h - t - 0.01) continue;
      parts.push(span('frame', [-w / 2 + t, w / 2 - t], [y - bar / 2, y + bar / 2], [zc - bar / 2, zc + bar / 2], NP));
    }
    const edges = [-w / 2 + t, ...xs, w / 2 - t];
    for (const k of range(edges.length - 1)) {
      const cx = (edges[k] + edges[k + 1]) / 2;
      const gap = edges[k + 1] - edges[k];
      const r = Math.min(gap, band) / 2 - 0.006;
      if (r > 0.012) parts.push(torus('motif', [cx, yb + band / 2, zc], r - 0.004, 0.004, NP));
    }
    return parts;
  },
});

const safetyCables = defineItem({
  id: 'balcony-safety-cables',
  name: 'Balcony safety cables (lưới an toàn)',
  category: 'construction',
  type: 'structure',
  group: 'Built-ins',
  tags: ['invisible grille', 'lưới an toàn', 'luoi an toan', 'safety cables', 'balcony', 'logia', 'child safety', 'stainless'],
  description:
    'An "invisible grille": stainless-steel cables 5 cm apart, tensioned between aluminium tracks on the floor and the ceiling, closing a balcony or logia for children without blocking the view.',
  defaultSize: { w: 2.4, d: 0.05, h: 2.6 },
  minSize: { w: 0.6, d: 0.03, h: 0.8 },
  maxSize: { w: 6, d: 0.1, h: 3.2 },
  slots: [
    matSlot('track', 'Aluminium tracks', 'metal-champagne'),
    matSlot('cable', 'Steel cables', 'metal-brushed-steel'),
  ],
  build: ({ w, d, h }) => {
    const th = 0.03;
    const parts: Part[] = [
      span('track', [-w / 2, w / 2], [0, th], [-d / 2, d / 2]),
      span('track', [-w / 2, w / 2], [h - th, h], [-d / 2, d / 2]),
    ];
    const n = Math.min(140, Math.floor((w - 0.04) / 0.05) + 1);
    for (const x of spaced(n, -w / 2 + 0.02, w / 2 - 0.02)) parts.push(rod('cable', [x, th, 0], [x, h - th, 0], 0.0013, { segments: 5, plan: false }));
    return parts;
  },
  planDetail: ({ w }) => [line([-w / 2, 0], [w / 2, 0])],
});

const cncPartition = defineItem({
  id: 'cnc-lattice-partition',
  name: 'CNC lattice partition (vách ngăn CNC)',
  category: 'construction',
  type: 'structure',
  group: 'Partitions',
  tags: ['cnc screen', 'vách ngăn cnc', 'vach ngan', 'lattice', 'room divider', 'hoa văn', 'đồng tiền', 'wood screen', 'vietnamese'],
  description:
    'A floor-to-ceiling oak-framed screen with a CNC-cut interlocking-coin lattice (hoa văn đồng tiền), used between the entrance and the living room or in front of an altar.',
  defaultSize: { w: 1.2, d: 0.04, h: 2.4 },
  minSize: { w: 0.4, d: 0.02, h: 0.6 },
  maxSize: { w: 3.0, d: 0.1, h: 3.0 },
  slots: [
    matSlot('panel', 'Lattice panel', 'cnc-oak'),
    matSlot('frame', 'Frame', 'wood-oak-natural'),
  ],
  build: ({ w, d, h }) => {
    const fw = clamp(w * 0.035, 0.03, 0.05);
    return [
      ...frame4('frame', [-w / 2, w / 2], [0, h], [-d / 2, d / 2], fw, { plan: true }),
      span('panel', [-w / 2 + fw, w / 2 - fw], [fw, h - fw], [-0.006, 0.006], NP),
    ];
  },
});

const glassBlockPartition = defineItem({
  id: 'glass-block-daylight-partition',
  name: 'Alternating glass block daylighting partition (vách gạch kính lấy sáng)',
  category: 'construction',
  type: 'structure',
  group: 'Partitions',
  tags: [
    'glass block',
    'gạch kính lấy sáng',
    'gach kinh',
    'vách gạch kính',
    'tấm lấy sáng',
    'tam lay sang',
    'daylighting panel',
    'glass brick',
    'wave glass',
    'checkered glass',
    'partition',
    'vietnamese',
  ],
  description:
    'A floor-to-ceiling daylighting partition of square 19 cm hollow glass blocks set in white mortar joints on a stepped skirting plinth, alternating courses of wavy water-ripple glass and cross-reeded checkered glass to bring soft daylight into a corridor or bedroom.',
  defaultSize: { w: 0.6, d: 0.1, h: 2.5 },
  minSize: { w: 0.4, d: 0.08, h: 0.6 },
  maxSize: { w: 2.4, d: 0.2, h: 3.2 },
  slots: [
    matSlot('wave', 'Wave glass blocks', 'glass-block-wave'),
    matSlot('grid', 'Checkered glass blocks', 'glass-block-grid'),
    matSlot('mortar', 'Mortar joints', 'paint-pure-white'),
    matSlot('trim', 'Base skirting', 'paint-cream'),
  ],
  variants: [
    { id: 'warm-amber', name: 'Warm backlit amber', materials: { wave: 'glass-block-amber', grid: 'glass-block-amber-grid' } },
    { id: 'white-skirting', name: 'Crisp white skirting', materials: { trim: 'paint-satin-white' } },
    { id: 'all-wave', name: 'All wave glass (vân sóng)', materials: { grid: 'glass-block-wave' } },
    { id: 'all-grid', name: 'All checkered glass (vân ô vuông)', materials: { wave: 'glass-block-grid' } },
    { id: 'greige-trim', name: 'Greige skirting', materials: { trim: 'paint-greige' } },
  ],
  build: ({ w, d, h }) => {
    const base = h >= 1.2 ? 0.1 : clamp(h * 0.08, 0.03, 0.08);
    const skT = clamp(d * 0.1, 0.008, 0.014);
    const stepH = Math.min(0.012, base * 0.15);
    const H = h - base;
    let pitch = 0.2;
    let nx = Math.max(1, Math.round(w / pitch));
    let ny = Math.max(1, Math.round(H / pitch));
    while ((nx + 1) * (ny + 1) > 150) {
      pitch *= 1.06;
      nx = Math.max(1, Math.round(w / pitch));
      ny = Math.max(1, Math.round(H / pitch));
    }
    const cw = w / nx;
    const ch = H / ny;
    const m = clamp(Math.min(cw, ch) * 0.048, 0.006, 0.012);
    const bz = Math.max(0.025, d / 2 - skT - 0.002);
    const mz = Math.max(0.018, bz - 0.005);
    const parts: Part[] = [
      // Stepped skirting plinth at the floor (carries the full plan footprint).
      span('trim', [-w / 2, w / 2], [0, base - stepH], [-d / 2, d / 2]),
      span('trim', [-w / 2, w / 2], [base - stepH, base], [-d / 2 + skT, d / 2 - skT], NP),
    ];
    // Recessed white mortar joints between and around the glass blocks.
    for (const i of range(nx + 1)) {
      const x = -w / 2 + i * cw;
      const xa = i === 0 ? -w / 2 + 0.001 : x - m / 2;
      const xb = i === nx ? w / 2 - 0.001 : x + m / 2;
      parts.push(span('mortar', [xa, xb], [base, h], [-mz, mz], NP));
    }
    for (const j of range(ny + 1)) {
      const y = base + j * ch;
      const ya = j === 0 ? base : y - m / 2;
      const yb = j === ny ? h : y + m / 2;
      parts.push(span('mortar', [-w / 2 + 0.001, w / 2 - 0.001], [ya, yb], [-mz + 0.0005, mz - 0.0005], NP));
    }
    // Individual bevelled hollow glass blocks, alternating checkered and wave courses from bottom to top.
    for (const j of range(ny)) {
      const slot = j % 2 === 0 ? 'grid' : 'wave';
      const y0 = base + j * ch + (j === 0 ? m * 0.85 : m / 2);
      const y1 = base + (j + 1) * ch - (j === ny - 1 ? m * 0.85 : m / 2);
      const bh = y1 - y0;
      const cy = (y0 + y1) / 2;
      for (const i of range(nx)) {
        const x0 = -w / 2 + i * cw + (i === 0 ? m * 0.85 : m / 2);
        const x1 = -w / 2 + (i + 1) * cw - (i === nx - 1 ? m * 0.85 : m / 2);
        const bw = x1 - x0;
        const cx = (x0 + x1) / 2;
        parts.push(
          box(slot, [cx, cy, 0], [BLOCK_SCALE, BLOCK_SCALE, 2 * bz], {
            scale: [bw / BLOCK_SCALE, bh / BLOCK_SCALE, 1],
            uv: [BLOCK_SCALE / 2, BLOCK_SCALE / 2],
            plan: false,
          }),
        );
      }
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const skT = clamp(d * 0.1, 0.008, 0.014);
    const bz = Math.max(0.025, d / 2 - skT - 0.002);
    const nx = clamp(Math.round(w / 0.2), 1, 12);
    const cw = w / nx;
    return [
      line([-w / 2, -bz], [w / 2, -bz]),
      line([-w / 2, bz], [w / 2, bz]),
      line([-w / 2, 0], [w / 2, 0]),
      ...range(nx - 1).map((i) => {
        const x = -w / 2 + (i + 1) * cw;
        return line([x, -bz], [x, bz]);
      }),
    ];
  },
});

// ---------------------------------------------------------------------------
// Lighting
// ---------------------------------------------------------------------------

const PENDANT_H = 0.9;

const lotusPendant = defineItem({
  id: 'lotus-leaf-pendant',
  name: 'Layered lotus-leaf pendant (đèn lá sen)',
  category: 'lighting',
  type: 'lighting',
  group: 'Ceiling lights',
  tags: ['lotus leaf', 'đèn lá sen', 'den la sen', 'pendant', 'tiered', 'dining light', 'indochine', 'modern vietnamese'],
  description:
    'Three shallow matte-white discs shaped like floating lotus leaves, stacked on a brass stem with an LED under each one; a favourite over Vietnamese dining tables.',
  mount: 'ceiling',
  defaultElevation: CEILING - PENDANT_H - 0.01,
  defaultSize: { w: 0.6, d: 0.6, h: PENDANT_H },
  minSize: { w: 0.3, d: 0.3, h: 0.4 },
  maxSize: { w: 1.0, d: 1.0, h: 1.6 },
  slots: [
    matSlot('shade', 'Leaf discs', 'lotus-shade'),
    matSlot('metal', 'Stem & canopy', 'metal-brass'),
    matSlot('light', 'LEDs', 'light-warm'),
  ],
  light: { color: WARM, intensity: 1.0, distance: 4.5, y: 0.03, kind: 'spot', angle: 1.1, penumbra: 0.8 },
  build: ({ w, d, h }) => {
    const R = Math.min(w, d) / 2 - 0.005;
    const parts: Part[] = [cyl('metal', [0, h - 0.015, 0], 0.06, 0.03, { segments: 24 })];
    const tiers = [
      { r: R, y: 0.04 },
      { r: R * 0.74, y: 0.04 + Math.min(0.1, h * 0.11) },
      { r: R * 0.5, y: 0.04 + 2 * Math.min(0.1, h * 0.11) },
    ];
    parts.push(vcyl('metal', 0, 0, tiers[2].y + 0.02, h - 0.03, 0.004, NP));
    for (const [i, { r, y }] of tiers.entries()) {
      parts.push(
        lathe('shade', [0, y, 0], [
          [0.012, 0],
          [r * 0.3, 0.004],
          [r * 0.72, 0.013],
          [r, 0.03],
          [r * 0.97, 0.033],
          [r * 0.7, 0.018],
          [r * 0.3, 0.01],
          [0.012, 0.008],
        ], { segments: 40, plan: i === 0 }),
        cyl('light', [0, y - 0.003, 0], Math.max(0.02, r * 0.18), 0.004, { segments: 20, plan: false }),
        cyl('metal', [0, y + 0.012, 0], 0.012, 0.02, { segments: 12, plan: false }),
      );
    }
    return parts;
  },
});

const wallDisc = defineItem({
  id: 'backlit-wall-disc',
  name: 'Backlit round wall disc',
  category: 'lighting',
  type: 'lighting',
  group: 'Wall lights',
  tags: ['wall disc', 'halo light', 'đèn hắt tường', 'den hat tuong', 'round', 'backlit', 'moon', 'minimal'],
  description:
    'A flat painted disc standing off the wall on a hidden bracket, with an LED ring behind it that throws a soft halo onto the wall; often hung in twos or threes in living and dining rooms.',
  mount: 'wall',
  defaultElevation: 1.5,
  defaultSize: { w: 0.4, d: 0.05, h: 0.4 },
  minSize: { w: 0.15, d: 0.03, h: 0.15 },
  maxSize: { w: 1.2, d: 0.1, h: 1.2 },
  slots: [
    matSlot('disc', 'Disc', 'paint-warm-white'),
    matSlot('light', 'LED ring', 'light-warm'),
  ],
  light: { color: WARM, intensity: 0.35, distance: 1.2, y: 0.2, z: -0.012 },
  build: ({ w, d, h }) => {
    const z0 = -d / 2;
    const R = Math.min(w, h) / 2 - 0.002;
    const cy = h / 2;
    const ft = Math.min(0.025, d * 0.5);
    return [
      discZ('disc', [0, cy, z0 + (d - ft) / 2], R * 0.3, d - ft, { segments: 24 }),
      torus('light', [0, cy, z0 + d - ft - 0.004], R * 0.96, 0.003, NP),
      discZ('disc', [0, cy, d / 2 - ft / 2], R, ft, { segments: 48 }),
    ];
  },
});

// ---------------------------------------------------------------------------
// Wall decor
// ---------------------------------------------------------------------------

const blockCalendar = defineItem({
  id: 'tear-off-calendar',
  name: 'Tear-off block calendar (lịch bloc)',
  category: 'decor',
  type: 'decor',
  group: 'Wall art',
  tags: ['lịch bloc', 'lich bloc', 'block calendar', 'tear-off calendar', 'tết', 'lunar calendar', 'wall', 'vietnamese'],
  description:
    'A thick pad of daily tear-off pages with the big red solar date and the lunar date, on a gold-foil printed red board with a ribbon hanger; families hang a new one every Tết.',
  mount: 'wall',
  defaultElevation: 1.45,
  defaultSize: { w: 0.32, d: 0.035, h: 0.48 },
  minSize: { w: 0.2, d: 0.02, h: 0.3 },
  maxSize: { w: 0.6, d: 0.06, h: 0.9 },
  slots: [
    matSlot('board', 'Printed board', 'lich-red'),
    matSlot('paper', 'Paper pad', 'calendar-paper'),
    matSlot('ink', 'Red print', 'lich-ink'),
    matSlot('gilt', 'Gold foil & hanger', 'gilt'),
  ],
  build: ({ w, d, h }) => {
    const z0 = -d / 2;
    const zb = z0 + 0.004;
    const hb = h - 0.035;
    const parts: Part[] = [
      span('board', [-w / 2, w / 2], [0, hb], [z0, zb]),
      ...frame4('gilt', [-w / 2 + 0.008, w / 2 - 0.008], [0.008, hb - 0.008], [zb, zb + 0.0015], 0.005),
      discZ('gilt', [0, hb * 0.83, zb + 0.00075], Math.min(w * 0.17, hb * 0.1), 0.0015, { segments: 32, plan: false }),
      torus('gilt', [0, hb + 0.016, z0 + 0.002], 0.014, 0.0015, NP),
    ];
    // Paper pad with the day's page.
    const px = w * 0.32;
    const pb = hb * 0.08;
    const pt = hb * 0.66;
    const zf = d / 2 - 0.001;
    parts.push(
      span('paper', [-px, px], [pb, pt], [zb, zf], NP),
      span('ink', [-px + 0.006, px - 0.006], [pt - (pt - pb) * 0.14, pt - 0.006], [zf, zf + 0.0008], NP),
      // Two seven-segment digits span 1.38 × their height: keep them inside the page.
      ...segmentText('ink', '19', 0, pb + (pt - pb) * 0.48, zf, Math.min((pt - pb) * 0.42, (px * 1.6) / 1.38)),
      span('ink', [-px * 0.5, px * 0.5], [pb + (pt - pb) * 0.08, pb + (pt - pb) * 0.13], [zf, zf + 0.0008], NP),
    );
    // Torn stubs at the top of the pad.
    for (const k of range(3)) parts.push(span('paper', [-px, px], [pt, pt + 0.004], [zf - 0.004 - k * 0.003, zf - 0.003 - k * 0.003], NP));
    return parts;
  },
});

export default definePack({
  name: 'Modern Vietnamese apartment',
  version: '1.1.0',
  author: 'Neest team',
  description:
    'Altar cabinet and wall altar, Thần Tài shrine, zebra blinds, window grilles, balcony safety cables, a CNC lattice screen, an alternating wave/checkered glass block daylighting partition, a lotus-leaf pendant, a backlit wall disc and the Tết block calendar: what photos of today’s Vietnamese apartments keep showing.',
  license: 'CC0 (made for Neest)',
  items: [
    altarCabinet,
    hangingAltar,
    thanTaiShrine,
    zebraBlind,
    windowGrille,
    safetyCables,
    cncPartition,
    glassBlockPartition,
    lotusPendant,
    wallDisc,
    blockCalendar,
  ],
  patterns,
  materials,
});


/**
 * Sage study desk — a soft, sage-and-white study corner (from a reference photo): a white desk on a
 * right-hand drawer unit and tubular left legs, a lit pegboard wall with its top shelf and accessories, a gingham desk set with a
 * tablet and a round-key keyboard, and the small things on the desk (a glass cup with a straw, a
 * sage tumbler, a mint instant camera, a desk organiser with books, a glowing egg lamp).
 *
 * Coordinates: x across, y up, z to the front (+z); wall items have their back at −d/2.
 */
import {
  clamp,
  cyl,
  defineItem,
  definePack,
  foliage,
  knob,
  lathe,
  matSlot,
  pot,
  range,
  rng,
  rod,
  rodPath,
  segmentText,
  span,
  sphere,
  torus,
  vcyl,
  type Part,
  type PackMaterial,
  type PackPattern,
} from '@/packs/kit';

type V3 = [number, number, number];
const NP = { plan: false };

// ───────────────────────── Materials & the pegboard pattern ─────────────────────────

/** White pegboard with staggered oblong slots (see-through, like the popular slotted organiser boards). */
function drawSlots(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'destination-out';
  const cols = 4;
  const rows = 4;
  const sw = size / cols;
  const sh = size / rows;
  const slotW = sw * 0.18;
  const slotH = sh * 0.62;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Every other row shifted by half a column: the slots stagger.
      const cx = (c + 0.5 + (r % 2) * 0.5) * sw;
      const cy = (r + 0.5) * sh;
      for (const dx of [-size, 0, size]) {
        const x = cx + dx - slotW / 2;
        const y = cy - slotH / 2;
        const rr = slotW / 2;
        ctx.beginPath();
        ctx.moveTo(x + rr, y);
        ctx.arc(x + rr, y + rr, rr, Math.PI, 0);
        ctx.lineTo(x + slotW, y + slotH - rr);
        ctx.arc(x + rr, y + slotH - rr, rr, 0, Math.PI);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
  ctx.globalCompositeOperation = 'source-over';
}

/** Small sage-green gingham for the desk mat (two tones crossing). */
function drawGingham(ctx: CanvasRenderingContext2D, size: number): void {
  const n = 8;
  const s = size / n;
  ctx.fillStyle = '#f4f6ef';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < n; i += 2) {
    ctx.fillStyle = 'rgba(126, 160, 120, 0.45)';
    ctx.fillRect(i * s, 0, s, size);
    ctx.fillRect(0, i * s, size, s);
  }
}

const patterns: PackPattern[] = [
  { id: 'slotted-pegboard', name: 'Slotted pegboard', normalStrength: 0.6, cutout: true, draw: drawSlots },
  { id: 'sage-gingham', name: 'Sage gingham', normalStrength: 0.15, colored: true, draw: drawGingham },
];

const materials: PackMaterial[] = [
  { id: 'pegboard-white', name: 'White slotted pegboard', category: 'solid', color: '#f3f2ee', roughness: 0.55, pattern: { id: 'slotted-pegboard', scale: 0.16 } },
  { id: 'gingham-sage', name: 'Sage gingham', category: 'fabric', color: '#ffffff', roughness: 0.85, pattern: { id: 'sage-gingham', scale: 0.08 } },
  { id: 'keycap-sage', name: 'Sage keycaps', category: 'solid', color: '#cfdcc4', roughness: 0.45 },
  { id: 'tablet-screen', name: 'Tablet screen', category: 'glass', color: '#a9bfa3', roughness: 0.2, emissive: '#93b08c', emissiveIntensity: 0.35 },
  { id: 'clock-digits', name: 'Clock digits', category: 'glass', color: '#e8f0f2', roughness: 0.3, emissive: '#eaf6ff', emissiveIntensity: 1.6 },
  { id: 'bubble-candle', name: 'Pistachio candle wax', category: 'solid', color: '#c8deaa', roughness: 0.6 },
  { id: 'pencil-case', name: 'Cream canvas', category: 'fabric', color: '#ece6d8', roughness: 0.9 },
  { id: 'tumbler-sage', name: 'Sage tumbler', category: 'solid', color: '#b7c8a6', roughness: 0.35 },
  { id: 'camera-mint', name: 'Mint camera', category: 'solid', color: '#c6e3d4', roughness: 0.4 },
  { id: 'frosted-glow', name: 'Frosted glass glow', category: 'glass', color: '#fff1d6', roughness: 0.6, emissive: '#ffd79a', emissiveIntensity: 1.4 },
];

const WARM = '#ffcf8f';

// ───────────────────────── Desk on drawer units ─────────────────────────

/** A drawer front with a finger-slot pull cut along its top edge (a dark recess). */
function drawerFront(x: [number, number], y: [number, number], zf: number): Part[] {
  const g = 0.003;
  return [
    span('body', [x[0] + g, x[1] - g], [y[0] + g, y[1] - g], [zf - 0.016, zf], NP),
    span('pull', [x[0] + 0.03, x[1] - 0.03], [y[1] - g - 0.013, y[1] - g - 0.001], [zf - 0.012, zf + 0.0005], NP),
  ];
}

const drawerDesk = defineItem({
  id: 'drawer-unit-desk',
  name: 'White desk on drawer units',
  category: 'office',
  type: 'surfaces',
  group: 'Desks',
  tags: ['desk', 'drawer desk', 'alex', 'adils', 'white desk', 'study desk', 'bàn học', 'bàn làm việc', 'drawers'],
  description:
    'A white desk top supported by two slim cylindrical white legs on the left and a six-drawer tower with finger-slot pulls on the right. Leaves wide knee room for a study or home-office corner.',
  defaultSize: { w: 1.4, d: 0.6, h: 0.75 },
  minSize: { w: 1.0, d: 0.45, h: 0.68 },
  maxSize: { w: 2.2, d: 0.8, h: 0.8 },
  slots: [matSlot('top', 'Desk top', 'paint-pure-white'), matSlot('body', 'Drawer unit & legs', 'paint-pure-white'), matSlot('pull', 'Finger slots & feet', 'paint-greige')],
  build: ({ w, d, h }) => {
    const t = 0.03;
    const uh = h - t;
    const zb = -d / 2 + 0.02;
    const zf = d / 2 - 0.015;
    const rw = clamp(w * 0.26, 0.3, 0.42);
    const rx: [number, number] = [w / 2 - 0.01 - rw, w / 2 - 0.01];
    const xLeg = -w / 2 + 0.05;
    const zLeg = d / 2 - 0.055;
    const parts: Part[] = [
      span('top', [-w / 2, w / 2], [uh, h], [-d / 2, d / 2], { bevel: 0.003 }),
      // Right-hand drawer carcass, a little narrower than the top, standing on the floor.
      span('body', rx, [0, uh], [zb, zf - 0.016]),
    ];
    // Left: two cylindrical desk legs with top mounting plates and levelling feet.
    for (const zl of [-zLeg, zLeg]) {
      parts.push(
        vcyl('body', xLeg, zl, uh - 0.004, uh, 0.032, NP),
        vcyl('body', xLeg, zl, 0.006, uh - 0.004, 0.02, NP),
        vcyl('pull', xLeg, zl, 0, 0.006, 0.018, NP),
      );
    }
    // Right: six equal drawers.
    for (const i of range(6)) parts.push(...drawerFront(rx, [(i * uh) / 6, ((i + 1) * uh) / 6], zf));
    return parts;
  },
});

// ───────────────────────── Lit pegboard with shelf & accessories ─────────────────────────

/** Trailing stems with small heart leaves from (x, y, z), hanging down `drop` metres. */
function trailing(origin: V3, drop: number, n: number, seed: number, spread: number): Part[] {
  const rand = rng(seed);
  const parts: Part[] = [];
  for (const k of range(n)) {
    const a = (k / n) * Math.PI - Math.PI / 2 + (rand() - 0.5) * 0.4;
    const dx = Math.sin(a) * spread;
    const len = drop * (0.55 + rand() * 0.45);
    const pts: V3[] = [
      origin,
      [origin[0] + dx * 0.6, origin[1] + 0.01, origin[2] + 0.03],
      [origin[0] + dx, origin[1] - len * 0.5, origin[2] + 0.045],
      [origin[0] + dx * 1.1, origin[1] - len, origin[2] + 0.04],
    ];
    parts.push(...rodPath('green', pts, 0.0018, NP));
    for (const q of range(3)) {
      const f = 0.3 + q * 0.3;
      const p: V3 = [origin[0] + dx * (0.6 + f * 0.5), origin[1] - len * f, origin[2] + 0.05];
      parts.push(sphere('green', p, 0.022, { scale: [1, 0.75, 0.25], rotation: [0.2, 0, (q % 2 ? 0.6 : -0.6)], plan: false }));
    }
  }
  return parts;
}

/** Over-ear headphones hanging from a hook, facing the room. */
function headphones(cx: number, cy: number, z: number): Part[] {
  return [
    rodPath('shelf', [[cx, cy + 0.02, z - 0.04], [cx, cy + 0.02, z + 0.005], [cx, cy + 0.035, z + 0.012]], 0.003, NP),
    torus('shelf', [cx, cy - 0.06, z + 0.02], 0.075, 0.008, { arc: Math.PI, rotation: [0, 0, 0], plan: false }),
    cyl('shelf', [cx - 0.075, cy - 0.075, z + 0.02], 0.038, 0.035, { rotation: [0, 0, Math.PI / 2], segments: 20, plan: false }),
    cyl('shelf', [cx + 0.075, cy - 0.075, z + 0.02], 0.038, 0.035, { rotation: [0, 0, Math.PI / 2], segments: 20, plan: false }),
  ].flat();
}

/** A bubble candle: a little cube of 3 × 3 × 2 spheres. */
function bubbleCandle(cx: number, y0: number, cz: number, s: number): Part[] {
  const r = s / 6;
  const parts: Part[] = [];
  for (const iy of range(2)) for (const ix of range(3)) for (const iz of range(3)) parts.push(sphere('green', [cx + (ix - 1) * 2 * r * 0.95, y0 + r + iy * 2 * r * 0.95, cz + (iz - 1) * 2 * r * 0.95], r, NP));
  return parts;
}

const litPegboard = defineItem({
  id: 'lit-pegboard-shelf',
  name: 'Lit pegboard with shelf & desk accessories',
  category: 'office',
  type: 'storage',
  group: 'Office storage',
  tags: ['pegboard', 'skadis', 'led strip', 'wall shelf', 'desk shelf', 'headphones', 'digital clock', 'study', 'bảng treo đồ', 'kệ treo tường'],
  description:
    'A white slotted pegboard above a desk with a warm LED glow round its edges, a long lit shelf on top with a plant, a pencil case, a bubble candle, a digital clock and a trailing pothos, and a little shelf of pen cups and headphones on a hook. The Empty model is just the board and shelves.',
  mount: 'wall',
  defaultElevation: 0.95,
  defaultSize: { w: 1.4, d: 0.22, h: 0.85 },
  minSize: { w: 0.8, d: 0.16, h: 0.6 },
  maxSize: { w: 2.4, d: 0.3, h: 1.2 },
  slots: [
    matSlot('board', 'Pegboard', 'sage-study:pegboard-white'),
    matSlot('shelf', 'Shelves, pots & accessories', 'paint-pure-white'),
    matSlot('light', 'LED strip', 'light-warm'),
    matSlot('green', 'Plants & candle', 'plant-leaf'),
  ],
  light: {
    color: WARM,
    intensity: 0.35,
    distance: 1.6,
    y: 0.5,
    heads: [
      { x: -0.35, y: 0.55, z: 0.02 },
      { x: 0.35, y: 0.55, z: 0.02 },
    ],
  },
  models: [{ id: 'empty', name: 'Empty', build: (size) => buildPegboard(size, false) }],
  build: (size) => buildPegboard(size, true),
});

/** The pegboard, its shelves and glow; with `styled`, the plants and accessories too. */
function buildPegboard({ w, d, h }: { w: number; d: number; h: number }, styled: boolean): Part[] {
  const zb = -d / 2;
  const st = 0.025; // shelf thickness
  const hb = clamp(h - 0.27, 0.3, h - 0.2); // pegboard height
  const ys = hb + 0.03; // top shelf underside
  const bw = clamp(w * 0.8, 0.5, w - 0.05);
  const bx: [number, number] = [-w / 2 + 0.03, -w / 2 + 0.03 + bw];
  const zBoard = zb + 0.025; // board stands off the wall on spacers
  const parts: Part[] = [
    span('board', bx, [0, hb], [zBoard, zBoard + 0.008]),
    span('shelf', [bx[0] + 0.03, bx[1] - 0.03], [hb * 0.15, hb * 0.2], [zb, zBoard], NP),
    span('shelf', [bx[0] + 0.03, bx[1] - 0.03], [hb * 0.8, hb * 0.85], [zb, zBoard], NP),
    // A warm LED strip round the back of the board's edges (a glowing outline on the wall) and under the top shelf's lip.
    span('light', [bx[0] - 0.006, bx[1] + 0.006], [hb - 0.006, hb + 0.004], [zb + 0.004, zb + 0.012], NP),
    span('light', [bx[0] - 0.006, bx[1] + 0.006], [-0.004, 0.006], [zb + 0.004, zb + 0.012], NP),
    span('light', [bx[0] - 0.008, bx[0] + 0.002], [0.006, hb - 0.006], [zb + 0.004, zb + 0.012], NP),
    span('light', [bx[1] - 0.002, bx[1] + 0.008], [0.006, hb - 0.006], [zb + 0.004, zb + 0.012], NP),
    span('light', [-w / 2 + 0.02, w / 2 - 0.02], [ys - 0.004, ys], [d / 2 - 0.03, d / 2 - 0.018], NP),
    // Top shelf.
    span('shelf', [-w / 2, w / 2], [ys, ys + st], [zb, d / 2]),
  ];
  if (!styled) return parts;
  // Little shelf on the board with pen cups and a small frame.
  const sx0 = bx[0] + bw * 0.42;
  const sx1 = sx0 + clamp(bw * 0.3, 0.22, 0.4);
  const sy = hb * 0.48;
  const sd = 0.1;
  parts.push(span('shelf', [sx0, sx1], [sy - 0.012, sy], [zBoard + 0.008, zBoard + 0.008 + sd], NP));
  const zc = zBoard + 0.008 + sd / 2;
  const cupR = 0.028;
  const cups = [sx0 + 0.045, sx0 + 0.11, sx0 + 0.175];
  cups.forEach((cx, i) => {
    parts.push(vcyl(i === 0 ? 'shelf' : 'shelf', cx, zc, sy, sy + 0.085, cupR, { segments: 16, plan: false }));
    if (i < 2) for (const k of range(3)) parts.push(rod('shelf', [cx - 0.01 + k * 0.01, sy + 0.04, zc], [cx - 0.014 + k * 0.014, sy + 0.15, zc + 0.006], 0.0035, NP));
    else parts.push(...foliage('green', [cx, sy + 0.085, zc], 0.03, 0.06, 5, 77, { spread: 0.5, plan: false }));
  });
  if (sx1 - sx0 > 0.27) {
    // A small photo frame leaning at the right end.
    parts.push(span('shelf', [sx1 - 0.07, sx1 - 0.01], [sy, sy + 0.07], [zc - 0.02, zc - 0.012], { rotation: [-0.12, 0, 0], plan: false }));
  }
  // Headphones on a hook to the right.
  parts.push(...headphones(bx[1] - 0.17, hb * 0.62, zBoard + 0.008));
  // On the top shelf, left to right: a small plant, the pencil case, a bubble candle, a clock, a trailing pothos.
  const yt = ys + st;
  const zs = 0;
  const span01 = (f: number) => -w / 2 + w * f;
  parts.push(pot('shelf', [span01(0.07), yt, zs], 0.04, 0.07, 'cylinder', NP), ...foliage('green', [span01(0.07), yt + 0.07, zs], 0.06, 0.1, 7, 11, { spread: 0.7, plan: false }));
  parts.push(span('shelf', [span01(0.2) - 0.11, span01(0.2) + 0.11], [yt, yt + 0.09], [zs - 0.05, zs + 0.05], { bevel: 0.03, plan: false }));
  parts.push(rod('shelf', [span01(0.2) - 0.09, yt + 0.088, zs + 0.03], [span01(0.2) + 0.09, yt + 0.088, zs + 0.03], 0.0025, NP));
  parts.push(...bubbleCandle(span01(0.36), yt, zs, 0.075));
  const px = span01(0.62);
  parts.push(pot('shelf', [px, yt, zs], 0.055, 0.1, 'cylinder', NP), ...foliage('green', [px, yt + 0.1, zs], 0.08, 0.12, 6, 31, { spread: 0.9, plan: false }));
  parts.push(...trailing([px + 0.03, yt + 0.09, zs + 0.03], Math.min(0.55, hb * 0.9), 4, 5, 0.12));
  return parts;
}

// ───────────────────────── Gingham desk set ─────────────────────────

const deskSet = defineItem({
  id: 'gingham-desk-set',
  name: 'Gingham desk mat with tablet & keyboard',
  category: 'office',
  type: 'electronics',
  group: 'Computers',
  tags: ['desk mat', 'gingham', 'tablet', 'ipad', 'keyboard', 'round keys', 'mouse', 'notebook', 'study', 'desk setup'],
  description:
    'A sage gingham desk mat with a tablet on a stand, a sage keyboard with round keys, a white mouse and an open spiral notebook with a pencil.',
  defaultElevation: 0.75,
  defaultSize: { w: 0.95, d: 0.5, h: 0.25 },
  minSize: { w: 0.75, d: 0.4, h: 0.2 },
  maxSize: { w: 1.2, d: 0.6, h: 0.3 },
  slots: [
    matSlot('mat', 'Desk mat', 'sage-study:gingham-sage'),
    matSlot('device', 'Tablet, stand, mouse & notebook', 'plastic-white'),
    matSlot('screen', 'Screen', 'sage-study:tablet-screen'),
    matSlot('keyboard', 'Keyboard', 'sage-study:keycap-sage'),
  ],
  build: ({ w, d, h }) => {
    const parts: Part[] = [span('mat', [-w / 2, w / 2], [0, 0.003], [-d / 2, d / 2], { plan: true })];
    // Tablet on a stand at the back left, tilted back.
    const tx = -w * 0.14;
    const tz = -d / 2 + 0.11;
    const th = Math.min(0.2, h - 0.04);
    const tw = th * 1.4;
    parts.push(span('device', [tx - 0.05, tx + 0.05], [0.003, 0.012], [tz - 0.06, tz + 0.04], NP), rod('device', [tx, 0.01, tz - 0.04], [tx, 0.07, tz - 0.01], 0.008, NP));
    const tilt = -0.28;
    const cy = 0.03 + (th / 2) * Math.cos(tilt);
    parts.push(span('device', [tx - tw / 2, tx + tw / 2], [cy - th / 2, cy + th / 2], [tz - 0.004, tz + 0.004], { rotation: [tilt, 0, 0], bevel: 0.004, plan: false }));
    parts.push(span('screen', [tx - tw / 2 + 0.008, tx + tw / 2 - 0.008], [cy - th / 2 + 0.008, cy + th / 2 - 0.008], [tz + 0.0042, tz + 0.0052], { rotation: [tilt, 0, 0], plan: false }));
    // Keyboard with round keycaps in front of it.
    const kx = -w * 0.05;
    const kz = 0.0;
    const kw = 0.36;
    const kd = 0.12;
    parts.push(span('keyboard', [kx - kw / 2, kx + kw / 2], [0.003, 0.016], [kz - kd / 2, kz + kd / 2], { bevel: 0.006, plan: false }));
    const rows = 4;
    const cols = 13;
    for (const r of range(rows)) for (const c of range(cols)) {
      const x = kx - kw / 2 + 0.016 + c * ((kw - 0.032) / (cols - 1)) + (r % 2) * 0.005;
      const z = kz - kd / 2 + 0.018 + r * ((kd - 0.036) / (rows - 1));
      parts.push(cyl('keyboard', [x, 0.02, z], 0.0085, 0.008, { segments: 12, plan: false }));
    }
    // Mouse to the right.
    parts.push(sphere('device', [kx + kw / 2 + 0.11, 0.016, kz], 0.032, { scale: [0.7, 0.45, 1], plan: false }));
    // Open spiral notebook with a pencil at the front right.
    const nx = w * 0.12;
    const nz = d / 2 - 0.12;
    parts.push(
      span('device', [nx - 0.2, nx], [0.003, 0.01], [nz - 0.1, nz + 0.1], { rotation: [0, 0.08, 0], plan: false }),
      span('device', [nx, nx + 0.2], [0.003, 0.01], [nz - 0.1, nz + 0.1], { rotation: [0, 0.08, 0], plan: false }),
      rod('device', [nx, 0.012, nz - 0.1], [nx, 0.012, nz + 0.1], 0.004, NP),
      rod('device', [nx + 0.08, 0.014, nz + 0.02], [nx + 0.16, 0.014, nz - 0.03], 0.0035, NP),
    );
    return parts;
  },
});

// ───────────────────────── Small desk pieces ─────────────────────────

const deskThing = { category: 'decor' as const, type: 'decor' as const, group: 'Candles & tabletop', defaultElevation: 0.75 };

const glassCup = defineItem({
  ...deskThing,
  id: 'glass-cup-straw',
  name: 'Glass cup with straw',
  tags: ['glass cup', 'iced coffee', 'straw', 'mason glass', 'coaster', 'desk', 'ly thủy tinh'],
  description: 'A glass cup with a lid and a straw, printed with little leaves, on a sage coaster.',
  defaultSize: { w: 0.11, d: 0.11, h: 0.2 },
  minSize: { w: 0.08, d: 0.08, h: 0.14 },
  maxSize: { w: 0.14, d: 0.14, h: 0.26 },
  slots: [matSlot('glass', 'Glass', 'glass-clear'), matSlot('print', 'Leaf print & coaster', 'paint-sage'), matSlot('straw', 'Straw & lid', 'plastic-white')],
  build: ({ w, d, h }) => {
    const m = Math.min(w, d);
    const r = m * 0.36;
    const gh = h * 0.62;
    const parts: Part[] = [
      cyl('print', [0, 0.004, 0], m / 2, 0.008, { segments: 24 }),
      lathe('glass', [0, 0.008, 0], [[0, 0], [r * 0.9, 0], [r, gh * 0.1], [r * 1.02, gh]], { segments: 24, plan: false }),
      cyl('straw', [0, 0.008 + gh + 0.006, 0], r * 1.04, 0.012, { segments: 24, plan: false }),
      rod('straw', [r * 0.2, 0.03, 0], [r * 0.45, h, 0.004], 0.0045, NP),
    ];
    for (const k of range(5)) {
      const a = (k / 5) * Math.PI * 2;
      parts.push(sphere('print', [Math.sin(a) * r * 1.01, 0.008 + gh * (0.3 + (k % 3) * 0.2), Math.cos(a) * r * 1.01], 0.012, { scale: [1, 0.55, 0.15], rotation: [0, a, 0.5], plan: false }));
    }
    return parts;
  },
});

const tumbler = defineItem({
  ...deskThing,
  id: 'sage-tumbler',
  name: 'Sage tumbler',
  tags: ['tumbler', 'water bottle', 'stanley', 'sage', 'desk', 'bình giữ nhiệt'],
  description: 'A tall sage tumbler with a white lid.',
  defaultSize: { w: 0.09, d: 0.09, h: 0.25 },
  minSize: { w: 0.07, d: 0.07, h: 0.18 },
  maxSize: { w: 0.12, d: 0.12, h: 0.3 },
  slots: [matSlot('body', 'Tumbler', 'sage-study:tumbler-sage'), matSlot('lid', 'Lid', 'plastic-white')],
  build: ({ w, d, h }) => {
    const r = Math.min(w, d) / 2;
    return [
      lathe('body', [0, 0, 0], [[0, 0], [r * 0.82, 0], [r * 0.86, h * 0.35], [r, h * 0.42], [r, h * 0.86]], { segments: 24 }),
      cyl('lid', [0, h * 0.86 + h * 0.06, 0], r * 1.02, h * 0.12, { segments: 24, plan: false }),
      cyl('lid', [0, h * 0.99, 0], r * 0.5, h * 0.02, { segments: 16, plan: false }),
    ];
  },
});

const digitalClock = defineItem({
  ...deskThing,
  id: 'digital-desk-clock',
  name: 'Digital desk clock',
  group: 'Clocks',
  tags: ['digital clock', 'alarm clock', 'led clock', 'desk clock', 'đồng hồ để bàn'],
  description: 'A small white digital clock with a black face and glowing white digits.',
  defaultSize: { w: 0.18, d: 0.06, h: 0.075 },
  minSize: { w: 0.12, d: 0.04, h: 0.05 },
  maxSize: { w: 0.26, d: 0.1, h: 0.12 },
  slots: [matSlot('body', 'Case', 'plastic-white'), matSlot('face', 'Face', 'metal-black-matte'), matSlot('digits', 'Digits', 'sage-study:clock-digits')],
  build: ({ w, d, h }) => [
    span('body', [-w / 2, w / 2], [0, h], [-d / 2, d / 2], { bevel: Math.min(0.01, h / 6) }),
    span('face', [-w / 2 + 0.01, w / 2 - 0.01], [h * 0.1, h * 0.9], [d / 2 - 0.001, d / 2 + 0.001], NP),
    ...segmentText('digits', '7:45', 0, h / 2, d / 2 + 0.0015, Math.min(h * 0.55, w * 0.22)),
  ],
});

const instantCamera = defineItem({
  ...deskThing,
  id: 'instant-camera',
  group: 'Ornaments',
  name: 'Instant camera',
  tags: ['instant camera', 'instax', 'polaroid', 'mint', 'camera', 'máy ảnh chụp lấy liền'],
  description: 'A mint instant camera with a big lens and a flash window.',
  defaultSize: { w: 0.12, d: 0.07, h: 0.12 },
  minSize: { w: 0.1, d: 0.06, h: 0.1 },
  maxSize: { w: 0.14, d: 0.09, h: 0.14 },
  slots: [matSlot('body', 'Body', 'sage-study:camera-mint'), matSlot('lens', 'Lens', 'metal-black-matte'), matSlot('trim', 'Lens ring & flash', 'plastic-white')],
  build: ({ w, d, h }) => {
    const lr = Math.min(w, h) * 0.26;
    return [
      span('body', [-w / 2, w / 2], [0, h], [-d / 2, d / 2], { bevel: 0.012 }),
      cyl('trim', [-w * 0.05, h * 0.42, d / 2 + 0.008], lr * 1.15, 0.016, { rotation: [Math.PI / 2, 0, 0], segments: 24, plan: false }),
      cyl('lens', [-w * 0.05, h * 0.42, d / 2 + 0.017], lr * 0.75, 0.004, { rotation: [Math.PI / 2, 0, 0], segments: 24, plan: false }),
      span('trim', [w * 0.18, w * 0.42], [h * 0.75, h * 0.92], [d / 2 - 0.001, d / 2 + 0.002], NP),
    ];
  },
});

const organiser = defineItem({
  ...deskThing,
  id: 'desk-organiser-books',
  category: 'office',
  type: 'storage',
  group: 'Office storage',
  name: 'Desk organiser with books',
  tags: ['desk organiser', 'mini drawers', 'books', 'journal', 'book stand', 'stationery', 'study'],
  description: 'A white mini drawer organiser with a row of books and a journal standing beside it.',
  defaultSize: { w: 0.32, d: 0.22, h: 0.34 },
  minSize: { w: 0.25, d: 0.18, h: 0.25 },
  maxSize: { w: 0.45, d: 0.3, h: 0.45 },
  slots: [matSlot('box', 'Organiser', 'plastic-white'), matSlot('books', 'Books', 'book-mix'), matSlot('knob', 'Knobs', 'paint-greige')],
  build: ({ w, d, h }) => {
    const ow = w * 0.55;
    const oh = h * 0.42;
    const x0 = w / 2 - ow;
    const parts: Part[] = [span('box', [x0, w / 2], [0, oh], [-d / 2, d / 2], { bevel: 0.004 })];
    for (const i of range(3)) {
      const y0 = (i * oh) / 3;
      parts.push(span('box', [x0 + 0.006, w / 2 - 0.006], [y0 + 0.004, y0 + oh / 3 - 0.004], [d / 2 - 0.002, d / 2 + 0.002], NP), ...knob('knob', [(x0 + w / 2) / 2, y0 + oh / 6, d / 2 + 0.002], 0.006));
    }
    // Books standing behind and beside it, the tallest at the back.
    const bx0 = -w / 2;
    const n = 5;
    for (const i of range(n)) {
      const bw = 0.025 + (i % 2) * 0.01;
      const x = bx0 + i * 0.036;
      parts.push(span('books', [x, x + bw], [0, h * (0.7 + ((i * 37) % 5) * 0.06)], [-d / 2, -d / 2 + d * 0.75], { rotation: [0, 0, i === n - 1 ? -0.12 : 0], plan: false }));
    }
    parts.push(span('books', [x0 + 0.01, w / 2 - 0.02], [oh, h * 0.98], [-d / 2 + 0.02, -d / 2 + 0.04], NP));
    return parts;
  },
});

const eggLamp = defineItem({
  id: 'egg-glow-lamp',
  name: 'Glowing egg lamp',
  category: 'lighting',
  type: 'lighting',
  group: 'Table lamps',
  tags: ['egg lamp', 'mood light', 'candle lamp', 'glow', 'night light', 'frosted glass', 'đèn ngủ'],
  description: 'A small frosted-glass egg that glows warm, like a candle: a mood light for a desk, a shelf or a bedside.',
  defaultElevation: 0.75,
  defaultSize: { w: 0.12, d: 0.12, h: 0.14 },
  minSize: { w: 0.08, d: 0.08, h: 0.1 },
  maxSize: { w: 0.2, d: 0.2, h: 0.24 },
  slots: [matSlot('light', 'Glass', 'sage-study:frosted-glow'), matSlot('base', 'Base', 'plastic-white')],
  light: { color: WARM, intensity: 0.45, distance: 1.8, y: 0.08 },
  build: ({ w, d, h }) => {
    const m = Math.min(w, d);
    return [cyl('base', [0, 0.008, 0], m * 0.32, 0.016, { segments: 20 }), sphere('light', [0, 0.016 + (h - 0.016) / 2, 0], m / 2, { scale: [w / m, (h - 0.016) / m, d / m], plan: false })];
  },
});

export default definePack({
  name: 'Sage study desk',
  version: '1.0.0',
  author: 'Neest team',
  description:
    'A soft sage-and-white study corner: a desk on drawer units, a lit pegboard with its shelf and accessories, a gingham desk set with a tablet and a round-key keyboard, and the little things on the desk.',
  license: 'CC0 (made for Neest)',
  patterns,
  materials,
  items: [drawerDesk, litPegboard, digitalClock, deskSet, glassCup, tumbler, instantCamera, organiser, eggLamp],
});

/**
 * Studio living — the pieces of a tightly packed, modern serviced studio (Saigon style): a foam
 * mattress on the floor, a stacked cube cabinet, a plastic drawer tower, a mirror stand with a side
 * shelf, a compact kitchenette with an encaustic-tile splashback and LED strip, a black glass
 * fridge with a water dispenser, a black wire kitchen rack, a wet-room shower set, a gaming laptop
 * with a stacked portable monitor and a white wire shelf tower.
 *
 * Pack pattern: `encaustic-star`, a coloured cement tile (gạch bông) with navy and mustard stars.
 */
import {
  arcPoints,
  cellSpans,
  clamp,
  cushion,
  cyl,
  defineItem,
  definePack,
  discZ,
  knob,
  lathe,
  line,
  matSlot,
  prism,
  rectPoly,
  ring,
  rng,
  rod,
  rodPath,
  rodX,
  rodZ,
  spaced,
  span,
  sphere,
  torus,
  vcyl,
  box,
  circle,
  lerp,
  type Part,
  type PartOpts,
  type V2,
  type V3,
} from '@/packs/kit';

const NP: PartOpts = { plan: false };

/** Small bowl (open lathe with a wall) standing at `base`, rim radius r, height bh. */
function bowl(slot: string, base: V3, r: number, bh: number): Part {
  return lathe(
    slot,
    base,
    [
      [0, 0],
      [r * 0.45, 0],
      [r * 0.5, bh * 0.08],
      [r * 0.85, bh * 0.45],
      [r, bh],
      [r * 0.93, bh],
      [r * 0.8, bh * 0.52],
      [r * 0.42, bh * 0.14],
      [0, bh * 0.14],
    ],
    { segments: 20, plan: false },
  );
}

/** Open-top plastic basket: floor, four walls and a rolled rim. */
function basket(slot: string, x: V2, y0: number, z: V2, bh: number): Part[] {
  const t = 0.006;
  const y1 = y0 + bh;
  return [
    span(slot, [x[0] + 0.01, x[1] - 0.01], [y0, y0 + t], [z[0] + 0.01, z[1] - 0.01], NP),
    span(slot, [x[0], x[0] + t], [y0, y1], z, { bevel: 0.002, plan: false }),
    span(slot, [x[1] - t, x[1]], [y0, y1], z, { bevel: 0.002, plan: false }),
    span(slot, [x[0] + t, x[1] - t], [y0, y1], [z[0], z[0] + t], NP),
    span(slot, [x[0] + t, x[1] - t], [y0, y1], [z[1] - t, z[1]], { bevel: 0.002, plan: false }),
  ];
}

/** Uniformly scales parts about the footprint centre / floor (keeps proportions of a fixed design). */
function scaleParts(parts: Part[], k: number): Part[] {
  return parts.map((p) => {
    const q = { ...p, position: [p.position[0] * k, p.position[1] * k, p.position[2] * k] as V3 } as Part;
    switch (q.shape) {
      case 'box':
        q.size = [q.size[0] * k, q.size[1] * k, q.size[2] * k];
        if (q.bevel) q.bevel *= k;
        break;
      case 'cylinder':
        q.radiusTop *= k;
        q.radiusBottom *= k;
        q.height *= k;
        break;
      case 'sphere':
        q.radius *= k;
        break;
      case 'torus':
        q.radius *= k;
        q.tube *= k;
        break;
      case 'lathe':
        q.profile = q.profile.map(([r, y]) => [r * k, y * k] as V2);
        break;
      case 'prism':
        q.outline = q.outline.map(([x, z]) => [x * k, z * k] as V2);
        q.height *= k;
        break;
    }
    return q;
  });
}

// ---------------------------------------------------------------------------
// 1. Floor mattress with bedding
// ---------------------------------------------------------------------------

const floorMattress = defineItem({
  id: 'floor-mattress-bedding',
  name: 'Floor mattress with rumpled bedding',
  category: 'bedroom',
  type: 'beds',
  group: 'Beds',
  tags: ['mattress', 'floor bed', 'foam', 'duvet', 'bolster', 'pillows', 'studio', 'nệm', 'đệm', 'chăn', 'gối', 'gối ôm'],
  defaultSize: { w: 1.4, d: 2.0, h: 0.37 },
  minSize: { w: 0.9, d: 1.8, h: 0.28 },
  maxSize: { w: 1.8, d: 2.2, h: 0.46 },
  slots: [
    matSlot('mattress', 'Foam mattress', 'mattress-white'),
    matSlot('sheet', 'Fitted sheet', 'sheet-grey'),
    matSlot('duvet', 'Duvet', 'duvet-charcoal'),
    matSlot('pillows', 'Pillows & bolster', 'pillow-grey'),
  ],
  build: ({ w, d, h }) => {
    const mt = clamp(h - 0.17, 0.1, 0.28);
    const x0 = -w / 2;
    const x1 = w / 2;
    const z0 = -d / 2;
    const z1 = d / 2;
    const P: Part[] = [
      // Foam core showing below the sheet's elastic hem, then the fitted sheet over top and sides.
      cushion('mattress', [x0 + 0.004, x1 - 0.004], [0, 0.05], [z0 + 0.004, z1 - 0.004], { softness: 0.2 }),
      cushion('sheet', [x0, x1], [0.03, mt], [z0, z1], { softness: 0.22 }),
    ];
    // Two pillows against the wall end.
    const pw = clamp((w - 0.16) / 2, 0.34, 0.62);
    for (const s of [-1, 1]) {
      const cx = s * (pw / 2 + 0.035);
      P.push(
        cushion('pillows', [cx - pw / 2, cx + pw / 2], [mt - 0.012, mt + 0.115], [z0 + 0.06, z0 + 0.44], {
          softness: 0.45,
          rotation: [0.04, s * 0.05, 0],
          plan: false,
        }),
      );
    }
    // Bolster (gối ôm) lying lengthwise on the right, on the sheet beside the duvet.
    const br = 0.075;
    const bx = x1 - 0.13;
    const by = mt + br - 0.004;
    const bz0 = z0 + 0.52;
    const bz1 = Math.min(z1 - 0.22, bz0 + 0.95);
    P.push(rod('pillows', [bx, by, bz0], [bx - 0.05, by, bz1], br, { segments: 20, plan: false }));
    P.push(sphere('pillows', [bx, by, bz0], br, { scale: [1, 1, 0.45], plan: false }));
    P.push(sphere('pillows', [bx - 0.05, by, bz1], br, { scale: [1, 1, 0.45], plan: false }));
    for (const t of [0.07, 0.93]) {
      P.push(torus('pillows', [lerp(bx, bx - 0.05, t), by, lerp(bz0, bz1, t)], br - 0.004, 0.007, NP));
    }
    // Duvet: thrown back from the head end, covering the left two thirds, hanging over side and foot.
    const xr = x1 - 0.23;
    const zf = z0 + 0.6;
    P.push(cushion('duvet', [x0 + 0.004, xr], [mt - 0.012, mt + 0.045], [zf, z1 - 0.006], { softness: 0.45 }));
    P.push(span('duvet', [x0 - 0.014, x0 + 0.004], [0.05, mt + 0.03], [zf + 0.06, z1 - 0.03], { bevel: 0.007, plan: false }));
    P.push(span('duvet', [x0 + 0.03, xr - 0.06], [0.06, mt + 0.03], [z1 - 0.004, z1 + 0.014], { bevel: 0.007, plan: false }));
    // Rolled, turned-down edge and a thrown-back corner.
    P.push(rod('duvet', [x0 + 0.08, mt + 0.05, zf + 0.04], [xr - 0.06, mt + 0.05, zf + 0.1], 0.045, NP));
    P.push(box('duvet', [xr - 0.22, mt + 0.075, zf + 0.3], [0.42, 0.04, 0.34], { rotation: [0, 0.55, 0.05], bevel: 0.016, plan: false }));
    // Rumples: two broad, low billows and long soft folds running mostly diagonally.
    const rand = rng(41);
    const dw = xr - x0;
    const dl = z1 - zf;
    for (const [fx, fz, sx, sz] of [
      [0.3, 0.35, 0.55, 0.6],
      [0.65, 0.72, 0.5, 0.55],
    ]) {
      const ex = (dw * sx) / 2;
      const ez = (dl * sz) / 2;
      const cx = clamp(x0 + dw * fx, x0 + ex, x1 - ex);
      const cz = clamp(zf + dl * fz, z0 + ez, z1 - ez);
      P.push(sphere('duvet', [cx, mt + 0.03, cz], 0.5, { scale: [dw * sx, 0.06, dl * sz], plan: false }));
    }
    for (let i = 0; i < 6; i++) {
      const len = lerp(0.45, 0.85, rand()) * Math.min(1, dw / 0.9);
      const wid = lerp(0.14, 0.22, rand());
      const ang = lerp(0.25, 0.75, rand()) + (i % 3 === 2 ? 0.9 : 0);
      const e = (len + wid) / 2;
      const cx = clamp(lerp(x0 + 0.15, xr - 0.15, rand()), x0 + e, x1 - e);
      const cz = clamp(lerp(zf + 0.25, z1 - 0.15, rand()), z0 + e, z1 - e);
      P.push(sphere('duvet', [cx, mt + 0.035, cz], 0.5, { scale: [len, lerp(0.045, 0.06, rand()), wid], rotation: [0, ang, 0], plan: false }));
    }
    return P;
  },
  planDetail: ({ w, d }) => {
    const pw = clamp((w - 0.16) / 2, 0.34, 0.62);
    return [
      line([-w / 2, -d / 2 + 0.6], [w / 2 - 0.23, -d / 2 + 0.6]),
      line([w / 2 - 0.23, -d / 2 + 0.6], [w / 2 - 0.23, d / 2]),
      rectPoly(-pw - 0.035, -d / 2 + 0.06, -0.035, -d / 2 + 0.44),
      rectPoly(0.035, -d / 2 + 0.06, pw + 0.035, -d / 2 + 0.44),
    ];
  },
});

// ---------------------------------------------------------------------------
// 2. Stacked three-door cube cabinet
// ---------------------------------------------------------------------------

const cubeCabinet = defineItem({
  id: 'cube-cabinet-3-door',
  name: 'Three-door cube cabinet',
  category: 'bedroom',
  type: 'storage',
  group: 'Sideboards & cabinets',
  tags: ['cabinet', 'cube', 'cupboard', 'narrow', 'white', 'wood', 'studio', 'tủ', 'tủ 3 cánh', 'tủ gỗ'],
  defaultSize: { w: 0.42, d: 0.32, h: 1.15 },
  minSize: { w: 0.34, d: 0.26, h: 0.8 },
  maxSize: { w: 0.55, d: 0.42, h: 1.45 },
  slots: [
    matSlot('frame', 'Frame & top', 'wood-oak-light'),
    matSlot('panel', 'Doors & sides', 'laminate-white-matte'),
    matSlot('knob', 'Knobs', 'wood-walnut'),
  ],
  build: ({ w, d, h }) => {
    const base = 0.035;
    const top0 = h - 0.022;
    const zF = d / 2 - 0.024;
    const st = 0.022;
    const P: Part[] = [
      span('frame', [-w / 2, w / 2], [top0, h], [-d / 2, d / 2], { bevel: 0.003 }),
      span('frame', [-w / 2 + 0.015, w / 2 - 0.015], [0, base], [-d / 2 + 0.02, zF - 0.03], NP),
      // White carcass: sides and back.
      span('panel', [-w / 2 + 0.002, -w / 2 + 0.016], [base, top0], [-d / 2, zF - 0.02]),
      span('panel', [w / 2 - 0.016, w / 2 - 0.002], [base, top0], [-d / 2, zF - 0.02]),
      span('panel', [-w / 2 + 0.016, w / 2 - 0.016], [base, top0], [-d / 2, -d / 2 + 0.008], NP),
      // Light wood face frame: stiles.
      span('frame', [-w / 2, -w / 2 + st], [base, top0], [zF - 0.02, zF], { bevel: 0.002, plan: false }),
      span('frame', [w / 2 - st, w / 2], [base, top0], [zF - 0.02, zF], { bevel: 0.002, plan: false }),
    ];
    const cellsY = cellSpans(3, base, top0);
    const rail = 0.02;
    const bounds = [base, ...cellsY.map((c) => c[1])];
    for (const [i, b] of bounds.entries()) {
      const r0 = i === 0 ? b : i === 3 ? b - rail : b - rail / 2;
      const r1 = r0 + rail;
      P.push(span('frame', [-w / 2 + st, w / 2 - st], [r0, r1], [zF - 0.02, zF], NP));
      if (i > 0 && i < 3) P.push(span('panel', [-w / 2 + 0.016, w / 2 - 0.016], [r0 + 0.002, r1 - 0.002], [-d / 2 + 0.008, zF - 0.02], NP));
    }
    for (const [i, [a, b]] of cellsY.entries()) {
      const y0 = a + (i === 0 ? rail : rail / 2) + 0.002;
      const y1 = b - (i === 2 ? rail : rail / 2) - 0.002;
      P.push(span('panel', [-w / 2 + st + 0.002, w / 2 - st - 0.002], [y0, y1], [zF - 0.019, zF - 0.001], { bevel: 0.002, plan: false }));
      P.push(...knob('knob', [w / 2 - st - 0.045, (y0 + y1) / 2, zF - 0.001], 0.015));
    }
    return P;
  },
  planDetail: ({ w, d }) => [line([-w / 2, d / 2 - 0.024], [w / 2, d / 2 - 0.024])],
});

// ---------------------------------------------------------------------------
// 3. Plastic drawer tower on castors
// ---------------------------------------------------------------------------

const drawerTower = defineItem({
  id: 'plastic-drawer-tower',
  name: 'Plastic drawer tower on castors',
  category: 'bedroom',
  type: 'storage',
  group: 'Dressers & chests',
  tags: ['drawers', 'plastic', 'translucent', 'castors', 'clothes', 'storage', 'tủ nhựa', 'tủ ngăn kéo', 'tủ nhựa 5 tầng'],
  defaultSize: { w: 0.45, d: 0.4, h: 1.0 },
  minSize: { w: 0.34, d: 0.32, h: 0.6 },
  maxSize: { w: 0.6, d: 0.52, h: 1.3 },
  slots: [
    matSlot('body', 'Frame', 'pp-white'),
    matSlot('drawer', 'Drawers', 'pp-frosted'),
    matSlot('castor', 'Castors', 'rubber-black'),
    matSlot('contents', 'Folded clothes', 'fabric-navy'),
  ],
  build: ({ w, d, h }) => {
    const cy = 0.07;
    const t = 0.012;
    const P: Part[] = [];
    for (const [sx, sz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ]) {
      const x = sx * (w / 2 - 0.045);
      const z = sz * (d / 2 - 0.05);
      P.push(span('castor', [x - 0.022, x + 0.022], [cy - 0.012, cy - 0.003], [z - 0.022, z + 0.022], NP));
      P.push(span('castor', [x - 0.014, x + 0.014], [0.035, cy - 0.012], [z - 0.02, z + 0.006], NP));
      P.push(rodX('castor', x - 0.011, x + 0.011, 0.025, z + 0.006, 0.025, NP));
    }
    P.push(span('body', [-w / 2, w / 2], [cy - 0.003, cy + 0.018], [-d / 2, d / 2], { bevel: 0.004 }));
    P.push(span('body', [-w / 2, -w / 2 + t], [cy + 0.018, h - 0.02], [-d / 2, d / 2 - 0.004]));
    P.push(span('body', [w / 2 - t, w / 2], [cy + 0.018, h - 0.02], [-d / 2, d / 2 - 0.004]));
    P.push(span('body', [-w / 2 + t, w / 2 - t], [cy + 0.018, h - 0.02], [-d / 2, -d / 2 + 0.006], NP));
    // Top tray with a raised rim.
    P.push(span('body', [-w / 2, w / 2], [h - 0.02, h - 0.008], [-d / 2, d / 2], { bevel: 0.003, plan: false }));
    P.push(span('body', [-w / 2, w / 2], [h - 0.008, h], [-d / 2, -d / 2 + 0.01], NP));
    P.push(span('body', [-w / 2, w / 2], [h - 0.008, h], [d / 2 - 0.01, d / 2], NP));
    P.push(span('body', [-w / 2, -w / 2 + 0.01], [h - 0.008, h], [-d / 2 + 0.01, d / 2 - 0.01], NP));
    P.push(span('body', [w / 2 - 0.01, w / 2], [h - 0.008, h], [-d / 2 + 0.01, d / 2 - 0.01], NP));
    const n = clamp(Math.round((h - cy - 0.04) / 0.18), 3, 6);
    const ys = cellSpans(n, cy + 0.018, h - 0.02);
    const rand = rng(7);
    for (const [i, [a, b]] of ys.entries()) {
      P.push(span('drawer', [-w / 2 + t + 0.003, w / 2 - t - 0.003], [a + 0.004, b - 0.004], [-d / 2 + 0.02, d / 2 - 0.006], { bevel: 0.006, plan: false }));
      // Pull lip along the top of the drawer front.
      P.push(span('body', [-w * 0.2, w * 0.2], [b - 0.032, b - 0.014], [d / 2 - 0.008, d / 2 + 0.006], { bevel: 0.005, plan: false }));
      if (i > 0) P.push(span('body', [-w / 2, w / 2], [a - 0.004, a + 0.004], [d / 2 - 0.02, d / 2 - 0.004], NP));
      // Folded clothes inside (show through the frosted plastic).
      const ch = (b - a) * lerp(0.38, 0.6, rand());
      const xm = lerp(-0.02, 0.02, rand());
      P.push(cushion('contents', [-w / 2 + t + 0.02, xm - 0.01], [a + 0.012, a + 0.012 + ch], [-d / 2 + 0.05, d / 2 - 0.05], { softness: 0.3, plan: false }));
      P.push(cushion('contents', [xm + 0.01, w / 2 - t - 0.02], [a + 0.012, a + 0.012 + ch * lerp(0.6, 0.95, rand())], [-d / 2 + 0.05, d / 2 - 0.05], { softness: 0.3, plan: false }));
    }
    return P;
  },
  planDetail: ({ w, d }) => [line([-w * 0.2, d / 2], [w * 0.2, d / 2])],
});

// ---------------------------------------------------------------------------
// 4. Mirror stand with a side shelf and hooks
// ---------------------------------------------------------------------------

const mirrorStand = defineItem({
  id: 'mirror-stand-side-shelf',
  name: 'Mirror stand with side shelf & hooks',
  category: 'bedroom',
  type: 'decor',
  group: 'Mirrors',
  tags: ['mirror', 'full length', 'standing', 'shelf', 'hooks', 'wood', 'gương', 'gương đứng', 'kệ gương'],
  defaultSize: { w: 0.72, d: 0.42, h: 1.62 },
  minSize: { w: 0.58, d: 0.34, h: 1.3 },
  maxSize: { w: 0.95, d: 0.55, h: 1.85 },
  slots: [
    matSlot('wood', 'Frame & shelves', 'wood-oak-light'),
    matSlot('mirror', 'Mirror', 'glass-mirror'),
    matSlot('hooks', 'Hooks', 'metal-black-matte'),
  ],
  build: ({ w, d, h }) => {
    const p = 0.032;
    const fh = 0.035;
    const mw = clamp(w * 0.6, 0.34, 0.56);
    const xL = -w / 2 + p / 2;
    const xM = -w / 2 + mw - p / 2;
    const xR = w / 2 - p / 2;
    const k = h / 1.62;
    const P: Part[] = [];
    for (const x of [xL, xM, xR]) {
      P.push(span('wood', [x - p / 2, x + p / 2], [0, fh], [-d / 2, d / 2], { bevel: 0.008 }));
      P.push(span('wood', [x - p / 2, x + p / 2], [fh, h], [-p / 2, p / 2], { bevel: 0.004, plan: false }));
    }
    // Rear braces and a low back stretcher.
    for (const x of [xL, xR]) P.push(rod('wood', [x, 0.45 * k, -p / 2], [x, fh + 0.012, -d / 2 + 0.05], 0.011, NP));
    P.push(span('wood', [xL + p / 2, xR - p / 2], [0.06, 0.09], [-p / 2 - 0.018, -p / 2], NP));
    // Mirror between the left and middle posts.
    const my0 = 0.12;
    const my1 = h - 0.03;
    const mx: V2 = [xL + p / 2, xM - p / 2];
    P.push(span('wood', mx, [my1 - 0.04, my1], [-0.014, 0.014], NP));
    P.push(span('wood', mx, [my0, my0 + 0.04], [-0.014, 0.014], NP));
    P.push(span('wood', mx, [my0 + 0.04, my1 - 0.04], [-0.012, -0.004], NP));
    P.push(span('mirror', [mx[0] - 0.002, mx[1] + 0.002], [my0 + 0.04, my1 - 0.04], [-0.004, 0.008], NP));
    // Side shelf column.
    const sx: V2 = [xM + p / 2, xR - p / 2];
    const sd = clamp(d * 0.5, 0.16, 0.24);
    for (const f of [0.22, 0.6, 0.98, 1.36]) {
      const y = f * k;
      P.push(span('wood', sx, [y, y + 0.016], [-sd / 2, sd / 2]));
      P.push(span('wood', sx, [y + 0.016, y + 0.045], [sd / 2 - 0.012, sd / 2], NP));
      P.push(span('wood', [sx[0], sx[0] + 0.014], [y - 0.025, y], [-sd / 2, sd / 2], NP));
      P.push(span('wood', [sx[1] - 0.014, sx[1]], [y - 0.025, y], [-sd / 2, sd / 2], NP));
    }
    // A woven box on the bottom shelf.
    const bw = Math.min(0.16, sx[1] - sx[0] - 0.04);
    const bc = (sx[0] + sx[1]) / 2;
    P.push(span('wood', [bc - bw / 2, bc + bw / 2], [0.236 * k, 0.236 * k + 0.1], [-sd / 2 + 0.03, sd / 2 - 0.03], { bevel: 0.006, plan: false }));
    // Hooks on the front of the outer post.
    for (const f of [1.12, 1.22, 1.5]) {
      const y = f * k;
      P.push(...rodPath('hooks', [[xR, y, p / 2 - 0.002], [xR, y - 0.03, p / 2 + 0.035], [xR, y - 0.006, p / 2 + 0.055]], 0.004));
    }
    return P;
  },
  planDetail: ({ w }) => {
    const mw = clamp(w * 0.6, 0.34, 0.56);
    return [line([-w / 2, 0.008], [-w / 2 + mw, 0.008])];
  },
});

// ---------------------------------------------------------------------------
// 5. Compact kitchenette with encaustic-tile splashback and LED strip
// ---------------------------------------------------------------------------

const KIT_DEF = { w: 1.3, d: 0.6, h: 2.2 };
function kitGeom(w: number, d: number, h: number) {
  const yU = 0.9 + clamp((h - 0.9) * 0.46, 0.5, 0.62);
  const uw = w * 0.58;
  const ud = Math.min(0.32, d * 0.55);
  const zU = -d / 2 + ud;
  return { yU, uw, ud, zU, ledZ: zU - 0.05, ledX: [-w / 2 + 0.03, -w / 2 + uw - 0.03] as V2 };
}
const KG = kitGeom(KIT_DEF.w, KIT_DEF.d, KIT_DEF.h);
const LED_DIR: [number, number, number] = [0, -1, 0.12];

const kitchenette = defineItem({
  id: 'compact-kitchenette',
  name: 'Compact kitchenette with tiled splashback',
  category: 'kitchen',
  type: 'surfaces',
  group: 'Counters & cabinets',
  tags: ['kitchenette', 'kitchen', 'sink', 'hob', 'splashback', 'encaustic', 'LED', 'studio', 'bếp', 'tủ bếp', 'gạch bông', 'bồn rửa'],
  defaultSize: { ...KIT_DEF },
  minSize: { w: 1.1, d: 0.5, h: 1.9 },
  maxSize: { w: 1.6, d: 0.65, h: 2.4 },
  slots: [
    matSlot('cabinet', 'Cabinets, hob & sink', 'laminate-white-matte'),
    matSlot('worktop', 'Worktop & open shelf', 'wood-walnut'),
    matSlot('tile', 'Splashback tiles', 'encaustic-tile'),
    matSlot('light', 'LED strip', 'led-neutral'),
  ],
  light: {
    color: '#fff0dc',
    intensity: 0.9,
    distance: 2.4,
    y: KG.yU - 0.014,
    kind: 'spot',
    dir: LED_DIR,
    angle: 1.0,
    penumbra: 0.75,
    heads: [0.3, 0.7].map((f) => ({ x: -KIT_DEF.w / 2 + KG.uw * f, y: KG.yU - 0.014, z: KG.ledZ, dir: LED_DIR })),
  },
  build: ({ w, d, h }) => {
    const g = kitGeom(w, d, h);
    const PL = 0.1;
    const TOP0 = 0.86;
    const TOP1 = 0.9;
    const SINK_B = 0.69;
    const zb = -d / 2;
    const zf = d / 2 - 0.02;
    const P: Part[] = [
      span('worktop', [-w / 2 + 0.01, w / 2 - 0.01], [0, PL], [zb, zf - 0.05], NP),
      // Left unit carcass; the right one is open above the basin.
      span('cabinet', [-w / 2, -0.004], [PL, TOP0], [zb, zf]),
      span('cabinet', [0.004, w / 2], [PL, SINK_B], [zb, zf]),
      span('cabinet', [w / 2 - 0.018, w / 2], [SINK_B, TOP0], [zb, zf], NP),
      span('cabinet', [0.004, 0.022], [SINK_B, TOP0], [zb, zf], NP),
      span('cabinet', [0.022, w / 2 - 0.018], [SINK_B, TOP0], [zb, zb + 0.018], NP),
    ];
    const front = (x: V2, y: V2) =>
      span('cabinet', [x[0] + 0.0015, x[1] - 0.0015], [y[0] + 0.0015, y[1] - 0.0015], [zf, zf + 0.018], { bevel: 0.002, plan: false });
    const pull = (cx: number, yTop: number, len = 0.09) =>
      span('worktop', [cx - len / 2, cx + len / 2], [yTop - 0.014, yTop - 0.003], [zf + 0.018, zf + 0.03], { bevel: 0.002, plan: false });
    const yd = 0.71;
    P.push(front([-w / 2, 0], [PL, yd]), front([-w / 2, 0], [yd, TOP0]), pull(-w / 4, yd), pull(-w / 4, TOP0));
    P.push(front([0, w / 4], [PL, TOP0]), front([w / 4, w / 2], [PL, TOP0]), pull(w / 4 - 0.05, TOP0, 0.06), pull(w / 4 + 0.05, TOP0, 0.06));
    // Worktop around the sink cut-out.
    const sw = Math.min(0.42, w / 2 - 0.14);
    const sd = Math.min(0.36, d - 0.22);
    const scx = w / 4;
    const hx: V2 = [scx - sw / 2, scx + sw / 2];
    const hz: V2 = [zb + 0.1, zb + 0.1 + sd];
    const wt = (x: V2, z: V2) => span('worktop', x, [TOP0, TOP1], z, { bevel: 0.002 });
    P.push(wt([-w / 2, hx[0]], [zb, d / 2]), wt([hx[1], w / 2], [zb, d / 2]), wt(hx, [zb, hz[0]]), wt(hx, [hz[1], d / 2]));
    // Inset ceramic basin with a slim rim, drain and a gooseneck tap.
    const by0 = SINK_B + 0.005;
    const bt = 0.01;
    P.push(
      span('cabinet', hx, [by0, by0 + bt], hz, NP),
      span('cabinet', [hx[0], hx[0] + bt], [by0, TOP1], hz, NP),
      span('cabinet', [hx[1] - bt, hx[1]], [by0, TOP1], hz, NP),
      span('cabinet', [hx[0] + bt, hx[1] - bt], [by0, TOP1], [hz[0], hz[0] + bt], NP),
      span('cabinet', [hx[0] + bt, hx[1] - bt], [by0, TOP1], [hz[1] - bt, hz[1]], NP),
      span('cabinet', [hx[0] - 0.015, hx[1] + 0.015], [TOP1, TOP1 + 0.004], [hz[0] - 0.015, hz[0]], NP),
      span('cabinet', [hx[0] - 0.015, hx[1] + 0.015], [TOP1, TOP1 + 0.004], [hz[1], hz[1] + 0.015], NP),
      span('cabinet', [hx[0] - 0.015, hx[0]], [TOP1, TOP1 + 0.004], hz, NP),
      span('cabinet', [hx[1], hx[1] + 0.015], [TOP1, TOP1 + 0.004], hz, NP),
      cyl('worktop', [scx, by0 + bt + 0.0015, (hz[0] + hz[1]) / 2], 0.03, 0.003, NP),
    );
    const tz = zb + 0.055;
    P.push(cyl('cabinet', [scx, TOP1 + 0.015, tz], 0.024, 0.03, NP));
    P.push(
      ...rodPath(
        'cabinet',
        [
          [scx, TOP1 + 0.03, tz],
          [scx, TOP1 + 0.26, tz],
          [scx, TOP1 + 0.3, tz + 0.035],
          [scx, TOP1 + 0.295, tz + 0.1],
          [scx, TOP1 + 0.24, tz + 0.145],
        ],
        0.011,
      ),
    );
    P.push(rod('cabinet', [scx + 0.02, TOP1 + 0.06, tz], [scx + 0.07, TOP1 + 0.09, tz + 0.012], 0.006, NP));
    // Two-zone glass hob on the left unit.
    const hw = Math.min(0.3, w / 2 - 0.12);
    const hd = Math.min(0.5, d - 0.1);
    const hcx = -w / 4;
    const hz0 = zb + 0.05;
    P.push(span('cabinet', [hcx - hw / 2, hcx + hw / 2], [TOP1, TOP1 + 0.007], [hz0, hz0 + hd], { bevel: 0.003, plan: false }));
    for (const [f, r] of [
      [0.3, 0.085],
      [0.68, 0.065],
    ]) {
      P.push(ring('worktop', [hcx, TOP1 + 0.008, hz0 + hd * f], r, 0.0025, NP));
      P.push(ring('worktop', [hcx, TOP1 + 0.008, hz0 + hd * f], r * 0.55, 0.002, NP));
    }
    for (const dx of [-0.05, 0, 0.05]) P.push(cyl('worktop', [hcx + dx, TOP1 + 0.0078, hz0 + hd - 0.035], 0.009, 0.0015, NP));
    // Encaustic-tile splashback.
    P.push(span('tile', [-w / 2, w / 2], [TOP1, g.yU], [zb, zb + 0.012], NP));
    // Upper cabinet with a wooden underside, two doors and the LED strip.
    const ux: V2 = [-w / 2, -w / 2 + g.uw];
    P.push(span('cabinet', ux, [g.yU + 0.018, h], [zb, g.zU - 0.018], NP));
    P.push(span('worktop', ux, [g.yU, g.yU + 0.018], [zb, g.zU], NP));
    const doors = cellSpans(2, ux[0], ux[1]);
    for (const [i, [a, b]] of doors.entries()) {
      P.push(span('cabinet', [a + 0.0015, b - 0.0015], [g.yU + 0.0195, h - 0.0015], [g.zU - 0.018, g.zU], { bevel: 0.002, plan: false }));
      const cx = i === 0 ? b - 0.05 : a + 0.05;
      P.push(span('worktop', [cx - 0.03, cx + 0.03], [g.yU + 0.022, g.yU + 0.032], [g.zU, g.zU + 0.012], NP));
    }
    P.push(span('cabinet', g.ledX, [g.yU - 0.01, g.yU], [g.ledZ - 0.015, g.ledZ + 0.015], NP));
    P.push(span('light', [g.ledX[0] + 0.01, g.ledX[1] - 0.01], [g.yU - 0.013, g.yU - 0.009], [g.ledZ - 0.008, g.ledZ + 0.008], NP));
    // Small open wooden shelf with bowls, plates and mugs.
    const sx: V2 = [-w / 2 + g.uw + 0.03, w / 2 - 0.01];
    const sdp = Math.min(0.26, d * 0.45);
    const sy0 = g.yU + 0.06;
    const sy1 = Math.min(h, g.yU + 0.64);
    const sym = (sy0 + sy1) / 2;
    const cz = zb + sdp / 2;
    P.push(span('worktop', [sx[0], sx[0] + 0.016], [sy0, sy1], [zb, zb + sdp], NP));
    P.push(span('worktop', [sx[1] - 0.016, sx[1]], [sy0, sy1], [zb, zb + sdp], NP));
    for (const y of [sy0, sym, sy1 - 0.016]) P.push(span('worktop', [sx[0] + 0.016, sx[1] - 0.016], [y, y + 0.016], [zb, zb + sdp], NP));
    const inner: V2 = [sx[0] + 0.016, sx[1] - 0.016];
    const iw = inner[1] - inner[0];
    // Bottom board: two bowl stacks.
    const yb = sy0 + 0.016;
    for (let i = 0; i < 3; i++) P.push(bowl('cabinet', [inner[0] + 0.085, yb + i * 0.02, cz], 0.068, 0.055));
    if (iw > 0.34) for (let i = 0; i < 2; i++) P.push(bowl('cabinet', [inner[0] + 0.25, yb + i * 0.022, cz], 0.08, 0.06));
    // Middle board: a plate stack and mugs.
    const ym = sym + 0.016;
    P.push(cyl('cabinet', [inner[0] + 0.1, ym + 0.016, cz], 0.09, 0.032, NP));
    const mugs = iw > 0.4 ? [inner[0] + 0.25, inner[0] + 0.34] : [inner[0] + 0.25];
    for (const mx of mugs) {
      P.push(lathe('cabinet', [mx, ym, cz], [[0, 0], [0.036, 0], [0.04, 0.09], [0.036, 0.09], [0.033, 0.012], [0, 0.012]], { segments: 18, plan: false }));
      P.push(torus('cabinet', [mx + 0.045, ym + 0.048, cz], 0.022, 0.005, NP));
    }
    return P;
  },
  planDetail: ({ w, d }) => {
    const sw = Math.min(0.42, w / 2 - 0.14);
    const sd = Math.min(0.36, d - 0.22);
    const hd = Math.min(0.5, d - 0.1);
    const zb = -d / 2;
    return [
      rectPoly(w / 4 - sw / 2, zb + 0.1, w / 4 + sw / 2, zb + 0.1 + sd),
      circle([-w / 4, zb + 0.05 + hd * 0.3], 0.085),
      circle([-w / 4, zb + 0.05 + hd * 0.68], 0.065),
      line([0, -d / 2], [0, d / 2]),
    ];
  },
});

// ---------------------------------------------------------------------------
// 6. Black glass fridge with water dispenser
// ---------------------------------------------------------------------------

const blackFridge = defineItem({
  id: 'black-glass-fridge',
  name: 'Black glass fridge with water dispenser',
  category: 'kitchen',
  type: 'appliances',
  group: 'Refrigeration',
  tags: ['fridge', 'refrigerator', 'top freezer', 'black glass', 'water dispenser', 'tủ lạnh', 'tủ lạnh lấy nước ngoài'],
  defaultSize: { w: 0.6, d: 0.65, h: 1.75 },
  minSize: { w: 0.54, d: 0.58, h: 1.5 },
  maxSize: { w: 0.75, d: 0.75, h: 1.95 },
  slots: [
    matSlot('body', 'Glass doors', 'black-glass'),
    matSlot('trim', 'Cabinet & handles', 'metal-black-matte'),
    matSlot('dispenser', 'Dispenser', 'metal-anthracite'),
    matSlot('panel', 'Display', 'fridge-display'),
  ],
  build: ({ w, d, h }) => {
    const zb = d / 2 - 0.07;
    const ft = 0.045;
    const zf = zb + ft;
    const yb = 0.075;
    const ys = h - clamp(h * 0.28, 0.4, 0.55);
    const P: Part[] = [
      span('trim', [-w / 2 + 0.003, w / 2 - 0.003], [0.02, h - 0.003], [-d / 2, zb], { bevel: 0.01 }),
      span('dispenser', [-w / 2 + 0.03, w / 2 - 0.03], [0.022, yb - 0.008], [zb - 0.004, zb + 0.012], NP),
      // Glass doors: fridge below, freezer on top, with a shadow gap between.
      span('body', [-w / 2, w / 2], [yb, ys - 0.004], [zb, zf], { bevel: 0.01, plan: false }),
      span('body', [-w / 2, w / 2], [ys + 0.004, h], [zb, zf], { bevel: 0.01, plan: false }),
      span('trim', [-w / 2 + 0.004, w / 2 - 0.004], [ys - 0.005, ys + 0.005], [zb, zf - 0.006], NP),
      // Slim vertical pull bars on the left edge.
      span('trim', [-w / 2 + 0.012, -w / 2 + 0.03], [ys + 0.03, ys + 0.24], [zf, zf + 0.022], { bevel: 0.006, plan: false }),
      span('trim', [-w / 2 + 0.012, -w / 2 + 0.03], [ys - 0.42, ys - 0.03], [zf, zf + 0.022], { bevel: 0.006, plan: false }),
      // Small brand plate.
      span('dispenser', [-0.03, 0.03], [h - 0.06, h - 0.052], [zf, zf + 0.0015], NP),
    ];
    for (const sx of [-1, 1]) P.push(vcyl('trim', sx * (w / 2 - 0.05), zb - 0.05, 0, 0.02, 0.015, NP));
    for (const y of spaced(3, 0.03, yb - 0.018)) P.push(span('trim', [-w / 2 + 0.04, w / 2 - 0.04], [y, y + 0.004], [zb + 0.012, zb + 0.015], NP));
    // Water dispenser recess on the fridge door.
    const dc = -w * 0.05;
    const dy1 = ys - 0.1;
    const dy0 = dy1 - 0.3;
    P.push(
      span('dispenser', [dc - 0.09, dc + 0.09], [dy0, dy1], [zf - 0.002, zf + 0.003], { bevel: 0.012, plan: false }),
      span('trim', [dc - 0.072, dc + 0.072], [dy0 + 0.035, dy1 - 0.025], [zf + 0.003, zf + 0.0045], NP),
      span('dispenser', [dc - 0.028, dc + 0.028], [dy1 - 0.16, dy1 - 0.07], [zf + 0.004, zf + 0.016], { bevel: 0.004, plan: false }),
      vcyl('dispenser', dc, zf + 0.02, dy1 - 0.065, dy1 - 0.03, 0.007, NP),
      span('dispenser', [dc - 0.07, dc + 0.07], [dy0 + 0.008, dy0 + 0.028], [zf, zf + 0.024], { bevel: 0.004, plan: false }),
    );
    // Touch control panel on the freezer door: a lit ring display and a column of indicators.
    const cy = ys + (h - ys) * 0.62;
    P.push(discZ('trim', [0, cy, zf + 0.001], 0.026, 0.002, NP));
    P.push(torus('panel', [0, cy, zf + 0.002], 0.03, 0.0035, NP));
    P.push(span('panel', [-0.012, 0.012], [cy - 0.006, cy + 0.006], [zf + 0.002, zf + 0.0035], NP));
    for (let i = 0; i < 6; i++) P.push(discZ('panel', [-w / 2 + 0.07, cy + 0.065 - i * 0.026, zf + 0.0015], 0.0045, 0.003, NP));
    return P;
  },
  planDetail: ({ w, d }) => [line([-w / 2, d / 2 - 0.07], [w / 2, d / 2 - 0.07])],
});

// ---------------------------------------------------------------------------
// 7. Black wire kitchen rack with baskets, rice cooker, jars and bowls
// ---------------------------------------------------------------------------

const wireRack = defineItem({
  id: 'black-wire-kitchen-rack',
  name: 'Black wire kitchen rack with baskets',
  category: 'kitchen',
  type: 'storage',
  group: 'Kitchen cabinets',
  tags: ['wire rack', 'shelving', 'kitchen', 'baskets', 'rice cooker', 'jars', 'black', 'kệ bếp', 'kệ sắt', 'nồi cơm điện', 'rổ nhựa'],
  defaultSize: { w: 0.75, d: 0.4, h: 1.45 },
  minSize: { w: 0.55, d: 0.32, h: 1.0 },
  maxSize: { w: 1.1, d: 0.5, h: 1.8 },
  slots: [
    matSlot('wire', 'Wire frame', 'metal-black-matte'),
    matSlot('basket', 'Baskets', 'plastic-white'),
    matSlot('cooker', 'Rice cooker & bowls', 'cooker-cream'),
    matSlot('jars', 'Jars', 'glass-frosted'),
  ],
  build: ({ w, d, h }) => {
    const P: Part[] = [];
    const px = w / 2 - 0.014;
    const pz = d / 2 - 0.014;
    const postTop = h - 0.17;
    for (const x of [-px, px]) {
      for (const z of [-pz, pz]) {
        P.push(vcyl('wire', x, z, 0.012, postTop, 0.0125));
        P.push(vcyl('wire', x, z, 0, 0.012, 0.016, NP));
        P.push(vcyl('wire', x, z, postTop, postTop + 0.008, 0.014, NP));
      }
    }
    const tiers = spaced(4, 0.1, postTop - 0.02);
    const n = clamp(Math.round((w - 0.06) / 0.055), 8, 16);
    for (const y of tiers) {
      P.push(rodX('wire', -px, px, y, pz, 0.005), rodX('wire', -px, px, y, -pz, 0.005));
      P.push(rodZ('wire', -px, y, -pz, pz, 0.005), rodZ('wire', px, y, -pz, pz, 0.005));
      P.push(rodX('wire', -px, px, y - 0.012, 0, 0.004, NP));
      for (const x of spaced(n, -px + 0.03, px - 0.03)) P.push(rodZ('wire', x, y + 0.002, -pz, pz, 0.0022, NP));
    }
    const gap = tiers[1] - tiers[0];
    const yOn = (i: number) => tiers[i] + 0.006;
    const bz: V2 = [-Math.min(0.17, pz - 0.02), Math.min(0.17, pz - 0.02)];
    const bw = Math.min(0.34, px - 0.03);
    const bh = Math.min(0.19, gap - 0.05);
    // Bottom tier: two baskets, one with a bowl in it.
    P.push(...basket('basket', [-px + 0.02, -px + 0.02 + bw], yOn(0), bz, bh));
    P.push(...basket('basket', [px - 0.02 - bw, px - 0.02], yOn(0), bz, bh));
    P.push(bowl('cooker', [px - 0.02 - bw / 2, yOn(0) + 0.006, 0], Math.min(0.1, bw / 2 - 0.02), Math.min(0.08, bh - 0.02)));
    // Second tier: rice cooker and a bowl stack.
    const k = clamp((gap - 0.03) / 0.27, 0.6, 1.05);
    const rr = 0.13 * k;
    const cx = -px + 0.03 + rr;
    const y1 = yOn(1);
    P.push(
      lathe('cooker', [cx, y1, 0], [[0, 0], [rr * 0.92, 0], [rr, 0.02 * k], [rr, 0.17 * k], [rr * 0.96, 0.19 * k], [0, 0.19 * k]], { segments: 28, plan: false }),
      lathe('cooker', [cx, y1 + 0.19 * k, 0], [[0, 0], [rr * 0.95, 0], [rr * 0.86, 0.03 * k], [rr * 0.5, 0.048 * k], [0, 0.05 * k]], { segments: 28, plan: false }),
      box('wire', [cx, y1 + 0.11 * k, rr * 0.97], [rr * 0.9, 0.05 * k, 0.012], { bevel: 0.003, plan: false }),
      box('wire', [cx, y1 + 0.2 * k, rr * 0.93], [0.05 * k, 0.018 * k, 0.03], { bevel: 0.004, plan: false }),
      vcyl('wire', cx - rr * 0.35, -rr * 0.2, y1 + 0.2 * k, y1 + 0.235 * k, 0.012 * k, NP),
    );
    if (px - 0.03 - (cx + rr + 0.02) >= 0.15) {
      for (let i = 0; i < 3; i++) P.push(bowl('cooker', [px - 0.1, y1 + i * 0.022, 0], 0.07, 0.06));
    }
    // Third tier: a basket and storage jars.
    const y2 = yOn(2);
    P.push(...basket('basket', [-px + 0.02, -px + 0.02 + bw], y2, bz, bh));
    const jh = Math.min(0.16, gap - 0.06);
    const room = px - 0.03 - (-px + 0.04 + bw);
    const nj = clamp(Math.floor(room / 0.11), 0, 3);
    for (let i = 0; i < nj; i++) {
      const jx = px - 0.07 - i * 0.11;
      P.push(vcyl('jars', jx, 0.02, y2, y2 + jh, 0.045, { segments: 20, plan: false }));
      P.push(vcyl('wire', jx, 0.02, y2 + jh, y2 + jh + 0.018, 0.047, { segments: 20, plan: false }));
    }
    // Top: a colander, bowl stack and two jars.
    const y3 = yOn(3);
    const top = Math.min(0.16, h - y3 - 0.01);
    const cr = Math.min(0.11, px * 0.4);
    P.push(bowl('basket', [-px + 0.03 + cr, y3, 0], cr, Math.min(0.1, top)));
    for (let i = 0; i < 3; i++) P.push(bowl('cooker', [0.02, y3 + i * 0.02, 0], 0.07, 0.055));
    if (px > 0.3) {
      for (const jx of [px - 0.06, px - 0.16]) {
        P.push(vcyl('jars', jx, 0, y3, y3 + top - 0.02, 0.04, { segments: 20, plan: false }));
        P.push(vcyl('wire', jx, 0, y3 + top - 0.02, y3 + top, 0.042, { segments: 20, plan: false }));
      }
    }
    return P;
  },
});

// ---------------------------------------------------------------------------
// 8. Wet-room wall shower set
// ---------------------------------------------------------------------------

/** Cubic Bézier point. */
function bez(a: V3, b: V3, c: V3, e: V3, t: number): V3 {
  const u = 1 - t;
  const f = (i: number) => u * u * u * a[i] + 3 * u * u * t * b[i] + 3 * u * t * t * c[i] + t * t * t * e[i];
  return [f(0), f(1), f(2)];
}

const showerSet = defineItem({
  id: 'wet-room-shower-set',
  name: 'Wet-room wall shower set',
  category: 'bathroom',
  type: 'plumbing',
  group: 'Showers & tubs',
  tags: ['shower', 'wet room', 'mixer', 'hand shower', 'hose', 'caddy', 'floor drain', 'vòi sen', 'nhà tắm', 'sen tắm', 'phễu thoát sàn'],
  defaultSize: { w: 0.8, d: 0.42, h: 2.05 },
  minSize: { w: 0.6, d: 0.3, h: 1.8 },
  maxSize: { w: 1.2, d: 0.7, h: 2.3 },
  mount: 'wall',
  defaultElevation: 0,
  slots: [
    matSlot('chrome', 'Chrome fittings', 'metal-chrome'),
    matSlot('caddy', 'Corner caddy', 'plastic-white'),
    matSlot('bottles', 'Bottles', 'bottle-teal'),
    matSlot('accent', 'Caps, nozzles & drain slots', 'plastic-black'),
  ],
  build: ({ w, d, h }) => {
    const zw = -d / 2;
    const P: Part[] = [];
    // Wall mixer with S-unions, a single lever and a thermostatic knob.
    const mx = w * 0.12;
    const my = clamp(h * 0.5, 0.9, 1.15);
    const mz = zw + 0.065;
    for (const s of [-1, 1]) {
      P.push(discZ('chrome', [mx + s * 0.075, my, zw + 0.006], 0.032, 0.012, NP));
      P.push(rodZ('chrome', mx + s * 0.075, my, zw + 0.012, mz, 0.009, NP));
    }
    P.push(rodX('chrome', mx - 0.1, mx + 0.1, my, mz, 0.022, NP));
    P.push(rodX('chrome', mx + 0.1, mx + 0.13, my, mz, 0.026, NP));
    P.push(vcyl('chrome', mx, mz, my + 0.015, my + 0.035, 0.016, NP));
    P.push(rod('chrome', [mx, my + 0.03, mz], [mx, my + 0.075, mz + 0.06], 0.006, NP));
    P.push(vcyl('chrome', mx, mz, my - 0.055, my - 0.018, 0.011, NP));
    // Wall bracket with the hand shower resting in it.
    const bx = -w * 0.18;
    const by = Math.min(h - 0.21, 1.86);
    P.push(discZ('chrome', [bx, by, zw + 0.005], 0.025, 0.01, NP));
    P.push(rodZ('chrome', bx, by, zw + 0.01, zw + 0.035, 0.009, NP));
    P.push(cyl('chrome', [bx, by + 0.005, zw + 0.045], 0.019, 0.04, { rTop: 0.021, rotation: [0.25, 0, 0], plan: false }));
    const ha: V3 = [bx, by - 0.12, zw + 0.035];
    const hb: V3 = [bx, by + 0.08, zw + 0.085];
    P.push(rod('chrome', ha, hb, 0.012, { rTop: 0.016, plan: false }));
    const hc: V3 = [bx, by + 0.125, zw + 0.1];
    const tilt = 2.04;
    P.push(cyl('chrome', hc, 0.055, 0.026, { rotation: [tilt, 0, 0], segments: 32, plan: false }));
    P.push(cyl('accent', [hc[0], hc[1] - 0.45 * 0.014, hc[2] + 0.89 * 0.014], 0.044, 0.003, { rotation: [tilt, 0, 0], segments: 32, plan: false }));
    // Hose looping down from the hand shower to the mixer outlet.
    const ylow = Math.max(0.15, my - 0.5);
    const a: V3 = [bx, by - 0.125, zw + 0.034];
    const e: V3 = [mx, my - 0.058, mz];
    const pts: V3[] = spaced(22, 0, 1).map((t) => bez(a, [bx - 0.02, ylow - 0.25, zw + 0.06], [mx + 0.03, ylow - 0.25, zw + 0.09], e, t));
    P.push(...rodPath('chrome', pts, 0.008));
    P.push(vcyl('chrome', a[0], a[2], a[1] - 0.025, a[1], 0.011, NP));
    // Corner caddy (two quarter-round tiers) at the right end: put this end into the corner.
    const rc = Math.min(0.22, w * 0.28, d * 0.6);
    const cxr = w / 2;
    const arc = arcPoints(cxr, zw, rc, Math.PI / 2, Math.PI, 8);
    const outline: V2[] = [[cxr, zw], ...arc];
    const tiersY = [clamp(h * 0.6, 1.1, 1.3), clamp(h * 0.6, 1.1, 1.3) + 0.3];
    for (const ty of tiersY) {
      P.push(prism('caddy', outline, ty, 0.012, NP));
      const rail = arcPoints(cxr, zw, rc - 0.006, Math.PI / 2, Math.PI, 6).map(([x, z]) => [x, ty + 0.035, z] as V3);
      P.push(...rodPath('caddy', rail, 0.004));
      P.push(span('caddy', [cxr - 0.03, cxr], [ty - 0.04, ty], [zw, zw + 0.02], NP));
    }
    // Bottles on the caddy.
    const bottle = (x: number, z: number, y: number, r: number, bh: number, pump: boolean) => {
      P.push(lathe('bottles', [x, y, z], [[0, 0], [r * 0.95, 0], [r, bh * 0.08], [r, bh * 0.82], [r * 0.6, bh * 0.95], [r * 0.35, bh], [0, bh]], { segments: 18, plan: false }));
      if (pump) {
        P.push(vcyl('accent', x, z, y + bh, y + bh + 0.04, 0.011, NP));
        P.push(span('accent', [x - 0.008, x + 0.008], [y + bh + 0.035, y + bh + 0.048], [z, z + 0.035], NP));
      } else P.push(vcyl('accent', x, z, y + bh, y + bh + 0.022, r * 0.42, NP));
    };
    const t0 = tiersY[0] + 0.012;
    const t1 = tiersY[1] + 0.012;
    const pr = (f: number, ang: number): [number, number] => [cxr + Math.cos(ang) * rc * f, zw + Math.sin(ang) * rc * f];
    const [b1x, b1z] = pr(0.42, 2.0);
    const [b2x, b2z] = pr(0.6, 2.75);
    const [b3x, b3z] = pr(0.45, 2.3);
    bottle(b1x, b1z, t0, 0.034, 0.19, true);
    bottle(b2x, b2z, t0, 0.028, 0.15, false);
    bottle(b3x, b3z, t1, 0.03, 0.17, true);
    // Square floor drain in front of the wall.
    const dx = -w * 0.1;
    const dz = d / 2 - 0.09;
    P.push(span('chrome', [dx - 0.06, dx + 0.06], [0, 0.004], [dz - 0.06, dz + 0.06]));
    for (const off of spaced(5, -0.036, 0.036)) P.push(span('accent', [dx - 0.04, dx + 0.04], [0.004, 0.0048], [dz + off - 0.003, dz + off + 0.003], NP));
    return P;
  },
  planDetail: ({ w, d }) => {
    const rc = Math.min(0.22, w * 0.28, d * 0.6);
    return [line([w / 2 - rc, -d / 2], [w / 2, -d / 2 + rc])];
  },
});

// ---------------------------------------------------------------------------
// 9. Gaming laptop with a stacked portable monitor
// ---------------------------------------------------------------------------

const LAP = { w: 0.42, d: 0.42, h: 0.56 };

function laptopParts(): Part[] {
  const P: Part[] = [];
  // Cooling stand and laptop base.
  P.push(span('body', [-0.195, 0.195], [0, 0.022], [-0.12, 0.17], { bevel: 0.004 }));
  for (const x of [-0.15, 0.15]) P.push(span('body', [x - 0.02, x + 0.02], [0.022, 0.03], [0.16, 0.17], NP));
  P.push(span('body', [-0.18, 0.18], [0.022, 0.046], [-0.1, 0.155], { bevel: 0.004, plan: false }));
  // Red-backlit keyboard: a glowing deck with dark keycaps on top.
  const kz: V2 = [-0.088, 0.018];
  P.push(span('keys', [-0.165, 0.165], [0.046, 0.0475], kz, NP));
  const rows = spaced(6, kz[0] + 0.008, kz[1] - 0.008);
  for (const [r, z] of rows.entries()) {
    if (r === 5) {
      P.push(span('body', [-0.16, -0.075], [0.0475, 0.051], [z - 0.0075, z + 0.0075], NP));
      P.push(span('body', [-0.07, 0.07], [0.0475, 0.051], [z - 0.0075, z + 0.0075], NP));
      P.push(span('body', [0.075, 0.16], [0.0475, 0.051], [z - 0.0075, z + 0.0075], NP));
      continue;
    }
    for (const x of spaced(14, -0.152, 0.152)) P.push(span('body', [x - 0.0095, x + 0.0095], [0.0475, 0.051], [z - 0.0075, z + 0.0075], NP));
  }
  // Trackpad and a red accent strip along the front edge.
  P.push(span('body', [-0.055, 0.055], [0.046, 0.0472], [0.045, 0.125], { bevel: 0.0005, plan: false }));
  P.push(span('keys', [-0.12, 0.12], [0.03, 0.033], [0.155, 0.1565], NP));
  // Lid, tilted back on its hinge.
  const th = -0.3;
  const lidC: V3 = [0, 0.046 + 0.12 * Math.cos(-th), -0.1 + 0.12 * Math.sin(th) - 0.004];
  P.push(box('body', lidC, [0.36, 0.24, 0.007], { rotation: [th, 0, 0], plan: false }));
  const nY = -Math.sin(th);
  const nZ = Math.cos(th);
  P.push(box('screen', [0, lidC[1] + nY * 0.0042 + 0.006 * Math.cos(th), lidC[2] + nZ * 0.0042 + 0.006 * Math.sin(th)], [0.335, 0.2, 0.0015], { rotation: [th, 0, 0], plan: false }));
  // Portable monitor stacked above on an arm.
  const mt = -0.12;
  const mc: V3 = [0, 0.305 + 0.111 * Math.cos(mt), -0.148 + 0.111 * Math.sin(mt)];
  P.push(box('body', mc, [0.36, 0.224, 0.009], { rotation: [mt, 0, 0], bevel: 0.002, plan: false }));
  P.push(box('screen', [0, mc[1] - Math.sin(mt) * 0.005, mc[2] + Math.cos(mt) * 0.005], [0.345, 0.205, 0.0015], { rotation: [mt, 0, 0], plan: false }));
  P.push(box('body', [0, mc[1], mc[2] - 0.011], [0.08, 0.08, 0.008], { rotation: [mt, 0, 0], plan: false }));
  // Arm: weighted base, pole at the back right and a horizontal arm to the monitor.
  const ax = 0.17;
  const az = -0.188;
  P.push(cyl('body', [ax, 0.004, az], 0.03, 0.008, { segments: 24 }));
  P.push(vcyl('body', ax, az, 0.008, 0.46, 0.009, NP));
  P.push(rodX('body', 0, ax, mc[1], az, 0.008, NP));
  P.push(span('body', [ax - 0.015, ax + 0.015], [mc[1] - 0.02, mc[1] + 0.02], [az - 0.012, az + 0.012], NP));
  return P;
}

const laptopMonitor = defineItem({
  id: 'laptop-stacked-monitor',
  name: 'Lenovo Legion Pro 7 with ZenScreen OLED above',
  category: 'office',
  type: 'electronics',
  group: 'Computers',
  tags: ['laptop', 'gaming', 'lenovo', 'legion pro 7', '16irx8h', 'asus', 'zenscreen', 'mq16fc', 'oled', 'portable monitor', 'second screen', 'monitor arm', 'red backlight', 'laptop gaming', 'màn hình phụ', 'máy tính'],
  description:
    'A Lenovo Legion Pro 7 16IRX8H gaming laptop on a cooling stand with an ASUS ZenScreen OLED MQ16FC 16″ portable monitor held above it on an arm.',
  brand: {
    name: 'Lenovo · ASUS',
    model: 'Legion Pro 7 16IRX8H + ZenScreen OLED MQ16FC',
    line: 'Gaming laptop with a 16″ OLED portable monitor',
    url: 'https://psref.lenovo.com/syspool/Sys/PDF/Legion/Legion_Pro_7_16IRX8H/Legion_Pro_7_16IRX8H_Spec.PDF',
    specs: [
      ['Laptop (W × D × H)', '363.4 × 263.6 × 22–25.9 mm, < 2.8 kg'],
      ['Laptop display', '16″ 2560 × 1600, 240 Hz'],
      ['Keyboard', 'Per-key RGB, numpad'],
      ['Monitor (W × H × D)', '358 × 226 × 9 mm, about 0.65 kg'],
      ['Monitor panel', '16″ OLED 1920 × 1200, kickstand, tripod socket'],
    ],
  },
  defaultSize: { ...LAP },
  minSize: { w: 0.34, d: 0.34, h: 0.45 },
  maxSize: { w: 0.52, d: 0.52, h: 0.7 },
  slots: [
    matSlot('body', 'Laptop, stand & arm', 'metal-black-matte'),
    matSlot('screen', 'Screens', 'screen-glow'),
    matSlot('keys', 'Keyboard backlight', 'keys-red'),
  ],
  build: ({ w, d, h }) => scaleParts(laptopParts(), Math.min(w / LAP.w, d / LAP.d, h / LAP.h)),
});

// ---------------------------------------------------------------------------
// 10. Five-tier white wire shelf tower
// ---------------------------------------------------------------------------

const whiteTower = defineItem({
  id: 'white-wire-shelf-tower',
  name: 'Five-tier white wire shelf tower',
  category: 'living',
  type: 'storage',
  group: 'Bookcases & shelves',
  tags: ['wire shelf', 'shelving', 'tower', 'narrow', 'white', 'metal', 'kệ', 'kệ 5 tầng', 'kệ sắt trắng'],
  defaultSize: { w: 0.42, d: 0.32, h: 1.55 },
  minSize: { w: 0.32, d: 0.25, h: 1.0 },
  maxSize: { w: 0.6, d: 0.42, h: 1.8 },
  slots: [matSlot('wire', 'Wire frame', 'metal-white-powder'), matSlot('boxes', 'Storage boxes', 'pp-frosted')],
  build: ({ w, d, h }) => {
    const P: Part[] = [];
    const px = w / 2 - 0.012;
    const pz = d / 2 - 0.012;
    for (const x of [-px, px]) {
      for (const z of [-pz, pz]) {
        P.push(vcyl('wire', x, z, 0.01, h, 0.011));
        P.push(vcyl('wire', x, z, 0, 0.01, 0.014, NP));
      }
    }
    const tiers = spaced(5, 0.07, h - 0.06);
    const n = clamp(Math.round((w - 0.04) / 0.045), 5, 12);
    for (const y of tiers) {
      P.push(rodX('wire', -px, px, y, pz, 0.0045), rodX('wire', -px, px, y, -pz, 0.0045));
      P.push(rodZ('wire', -px, y, -pz, pz, 0.0045), rodZ('wire', px, y, -pz, pz, 0.0045));
      for (const x of spaced(n, -px + 0.025, px - 0.025)) P.push(rodZ('wire', x, y + 0.002, -pz, pz, 0.002, NP));
      // Guard rails at the back and sides.
      P.push(rodX('wire', -px, px, y + 0.045, -pz, 0.003, NP));
      P.push(rodZ('wire', -px, y + 0.045, -pz, pz - 0.04, 0.003, NP), rodZ('wire', px, y + 0.045, -pz, pz - 0.04, 0.003, NP));
    }
    // Two lidded storage boxes.
    const bw = Math.min(0.3, 2 * px - 0.04);
    const gap = tiers[1] - tiers[0];
    for (const i of [0, 2]) {
      const y = tiers[i] + 0.005;
      const bh = Math.min(0.18, gap - 0.05);
      P.push(span('boxes', [-bw / 2, bw / 2], [y, y + bh - 0.015], [-pz + 0.02, pz - 0.02], { bevel: 0.008, plan: false }));
      P.push(span('boxes', [-bw / 2 - 0.004, bw / 2 + 0.004], [y + bh - 0.016, y + bh], [-pz + 0.016, pz - 0.016], { bevel: 0.004, plan: false }));
    }
    return P;
  },
});

// ---------------------------------------------------------------------------
// Pattern: encaustic cement tile (gạch bông)
// ---------------------------------------------------------------------------

function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, ro: number, ri: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8 - Math.PI / 2;
    const r = i % 2 === 0 ? ro : ri;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function disc(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

function diamond(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy - ry);
  ctx.lineTo(cx + rx, cy);
  ctx.lineTo(cx, cy + ry);
  ctx.lineTo(cx - rx, cy);
  ctx.closePath();
  ctx.fill();
}

const NAVY = '#1f3657';
const MUSTARD = '#d5a03a';
const CREAM = '#f1ebdd';

export default definePack({
  name: 'Studio living',
  version: '1.0.0',
  author: 'Neest team',
  description:
    'Pieces from a compact modern serviced studio: a floor mattress with bedding, a cube cabinet, a plastic drawer tower, a mirror stand with shelves, a compact kitchenette with encaustic tiles and LED strip, a black glass fridge, a black wire kitchen rack, a wet-room shower set, a gaming laptop with a stacked monitor and a white wire shelf tower.',
  license: 'CC0 (made for Neest)',
  items: [floorMattress, cubeCabinet, drawerTower, mirrorStand, kitchenette, blackFridge, wireRack, showerSet, laptopMonitor, whiteTower],
  patterns: [
    {
      id: 'encaustic-star',
      name: 'Encaustic star tile',
      normalStrength: 0.25,
      colored: true,
      // 2×2 cement tiles: alternating star and flower centres, bullseye corners that join into
      // circles across tiles, half-diamonds on the edges, thin grout and a little cement speckle.
      draw(ctx, size, rand) {
        const n = 2;
        const ts = size / n;
        ctx.fillStyle = CREAM;
        ctx.fillRect(0, 0, size, size);
        for (let j = 0; j < n; j++) {
          for (let i = 0; i < n; i++) {
            const x0 = i * ts;
            const y0 = j * ts;
            const cx = x0 + ts / 2;
            const cy = y0 + ts / 2;
            ctx.save();
            ctx.beginPath();
            ctx.rect(x0, y0, ts, ts);
            ctx.clip();
            for (const [qx, qy] of [
              [x0, y0],
              [x0 + ts, y0],
              [x0, y0 + ts],
              [x0 + ts, y0 + ts],
            ]) {
              disc(ctx, qx, qy, ts * 0.3, NAVY);
              disc(ctx, qx, qy, ts * 0.255, CREAM);
              star(ctx, qx, qy, ts * 0.22, ts * 0.13, MUSTARD);
              disc(ctx, qx, qy, ts * 0.06, NAVY);
            }
            for (const [mx, my] of [
              [cx, y0],
              [cx, y0 + ts],
              [x0, cy],
              [x0 + ts, cy],
            ]) {
              diamond(ctx, mx, my, ts * 0.06, ts * 0.06, MUSTARD);
            }
            if ((i + j) % 2 === 0) {
              star(ctx, cx, cy, ts * 0.27, ts * 0.17, NAVY);
              star(ctx, cx, cy, ts * 0.17, ts * 0.1, MUSTARD);
              disc(ctx, cx, cy, ts * 0.05, CREAM);
            } else {
              ctx.strokeStyle = NAVY;
              ctx.lineWidth = ts * 0.025;
              ctx.beginPath();
              ctx.arc(cx, cy, ts * 0.25, 0, Math.PI * 2);
              ctx.stroke();
              for (let k = 0; k < 4; k++) {
                const a = (k * Math.PI) / 2 + Math.PI / 4;
                diamond(ctx, cx + Math.cos(a) * ts * 0.11, cy + Math.sin(a) * ts * 0.11, ts * 0.05, ts * 0.05, NAVY);
              }
              for (let k = 0; k < 4; k++) {
                const a = (k * Math.PI) / 2;
                ctx.save();
                ctx.translate(cx + Math.cos(a) * ts * 0.12, cy + Math.sin(a) * ts * 0.12);
                ctx.rotate(a);
                ctx.fillStyle = MUSTARD;
                ctx.beginPath();
                ctx.ellipse(0, 0, ts * 0.09, ts * 0.04, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
              }
              disc(ctx, cx, cy, ts * 0.04, NAVY);
            }
            ctx.restore();
          }
        }
        // Grout lines (half on each side of every tile edge, so the tile wraps).
        const gw = Math.max(1, size / 256);
        ctx.fillStyle = '#d4cec2';
        for (let i = 0; i <= n; i++) {
          ctx.fillRect(i * ts - gw / 2, 0, gw, size);
          ctx.fillRect(0, i * ts - gw / 2, size, gw);
        }
        // Cement speckle.
        const dots = Math.round(1600 * (size / 512) ** 2);
        for (let k = 0; k < dots; k++) {
          const x = 2 + rand() * (size - 5);
          const y = 2 + rand() * (size - 5);
          ctx.fillStyle = rand() < 0.5 ? `rgba(60,50,40,${(0.04 + rand() * 0.07).toFixed(3)})` : `rgba(255,255,255,${(0.05 + rand() * 0.08).toFixed(3)})`;
          ctx.fillRect(x, y, 1 + rand() * 1.5, 1 + rand() * 1.5);
        }
      },
    },
  ],
  materials: [
    { id: 'encaustic-tile', name: 'Encaustic star tile', category: 'tile', color: '#ffffff', roughness: 0.42, pattern: { id: 'encaustic-star', scale: 0.4 } },
    { id: 'black-glass', name: 'Gloss black glass', category: 'glass', color: '#0f1013', roughness: 0.06, metalness: 0.25 },
    { id: 'sheet-grey', name: 'Grey jersey sheet', category: 'fabric', color: '#8e9297', roughness: 0.95, pattern: { id: 'weave', scale: 0.08, contrast: 0.6 } },
    { id: 'duvet-charcoal', name: 'Charcoal microfibre duvet', category: 'fabric', color: '#2f3239', roughness: 0.9, pattern: { id: 'weave', scale: 0.1, contrast: 0.5 } },
    { id: 'pillow-grey', name: 'Pale grey pillowcase', category: 'fabric', color: '#b8babd', roughness: 0.92, pattern: { id: 'weave', scale: 0.08, contrast: 0.6 } },
    { id: 'pp-white', name: 'White polypropylene', category: 'solid', color: '#f1f1ee', roughness: 0.4 },
    { id: 'pp-frosted', name: 'Frosted polypropylene', category: 'solid', color: '#e2e6e9', roughness: 0.35, opacity: 0.72 },
    { id: 'cooker-cream', name: 'Cream appliance plastic', category: 'solid', color: '#f1ede3', roughness: 0.3 },
    { id: 'bottle-teal', name: 'Teal bottle plastic', category: 'solid', color: '#4f9c9a', roughness: 0.3 },
    { id: 'led-neutral', name: 'Neutral-white LED strip', category: 'solid', color: '#fbf8f0', roughness: 0.5, emissive: '#fff1dc', emissiveIntensity: 3 },
    { id: 'keys-red', name: 'Red keyboard backlight', category: 'solid', color: '#3a0b0b', roughness: 0.5, emissive: '#ff2a1f', emissiveIntensity: 1.6 },
    { id: 'fridge-display', name: 'Fridge display glow', category: 'solid', color: '#d8ecff', roughness: 0.3, emissive: '#bfe0ff', emissiveIntensity: 1.2 },
  ],
});

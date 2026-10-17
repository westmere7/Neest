/**
 * Japanese home — everyday objects of a Japanese apartment.
 *
 * Kotatsu with a bowl of mikan, zabuton and zaisu floor seating, a chabudai, a shikibuton futon,
 * bonsai, ikebana, a maneki-neko, a getabako with slippers, noren, a hinoki ofuro and tea things.
 *
 * Four pack patterns give the materials their surface: igusa rush weave for the tatami, fine
 * straight hinoki grain, kozo-fibre washi paper and an indigo seigaiha wave print for fabrics.
 */
import {
  box,
  cells,
  circle,
  clamp,
  cushion,
  cyl,
  defineItem,
  definePack,
  discZ,
  lathe,
  leaf,
  lerp,
  line,
  matSlot,
  pot,
  range,
  rectPoly,
  ring,
  rng,
  rod,
  rodX,
  rodZ,
  slats,
  span,
  sphere,
  torus,
  type Part,
  type V2,
  type V3,
} from '@/packs/kit';

const TAU = Math.PI * 2;

// ---------------------------------------------------------------------------
// Shape helpers
// ---------------------------------------------------------------------------


/** A flat shape in the side (z/y) plane: `pts` are [z, y] in metres, extruded `t` along +x from x0. */
function sidePlate(slot: string, pts: V2[], x0: number, t: number): Part {
  const ys = pts.map((p) => p[1]);
  const zs = pts.map((p) => p[0]);
  const ym = (Math.min(...ys) + Math.max(...ys)) / 2;
  const zm = (Math.min(...zs) + Math.max(...zs)) / 2;
  // Rotating -90° about Z maps the extrusion (local +y) onto +x and the outline's x onto -y.
  return {
    shape: 'prism',
    outline: pts.map(([z, y]) => [-(y - ym), z - zm] as V2),
    height: t,
    position: [x0, ym, zm],
    rotation: [0, 0, -Math.PI / 2],
    slot,
    plan: false,
  };
}

/**
 * One draped side of a quilt: a trapezoid sloping from a top edge (half-length `inner`, `near`
 * from the centre, at height yT) down to a bottom edge (half-length `outer`, `far` out, at yB).
 */
function drape(slot: string, side: 'front' | 'back' | 'left' | 'right', inner: number, outer: number, near: number, far: number, yT: number, yB: number, t: number): Part {
  const run = far - near;
  const L = Math.hypot(run, yT - yB);
  const phi = Math.atan2(yT - yB, run);
  const ym = (yT + yB) / 2;
  const mid = (near + far) / 2;
  const base = { shape: 'prism' as const, height: t, slot, plan: false };
  switch (side) {
    case 'front':
      return { ...base, outline: [[-inner, -L / 2], [inner, -L / 2], [outer, L / 2], [-outer, L / 2]], position: [0, ym, mid], rotation: [phi, 0, 0] };
    case 'back':
      return { ...base, outline: [[-inner, L / 2], [inner, L / 2], [outer, -L / 2], [-outer, -L / 2]], position: [0, ym, -mid], rotation: [-phi, 0, 0] };
    case 'right':
      return { ...base, outline: [[-L / 2, -inner], [-L / 2, inner], [L / 2, outer], [L / 2, -outer]], position: [mid, ym, 0], rotation: [0, 0, -phi] };
    case 'left':
      return { ...base, outline: [[L / 2, -inner], [L / 2, inner], [-L / 2, outer], [-L / 2, -outer]], position: [-mid, ym, 0], rotation: [0, 0, phi] };
  }
}

/** Board in the y/z plane tilted by `tilt` (top leaning back), spanning x, from floor y0 up to y1, back face at zBack. */
function tiltedBoard(slot: string, x: V2, y0: number, y1: number, zBack: number, t: number, tilt: number, opts?: { plan?: boolean }): Part {
  const L = (y1 - y0 - t * Math.sin(tilt)) / Math.cos(tilt);
  const yHalf = (L * Math.cos(tilt) + t * Math.sin(tilt)) / 2;
  const zHalf = (L * Math.sin(tilt) + t * Math.cos(tilt)) / 2;
  return box(slot, [(x[0] + x[1]) / 2, y0 + yHalf, zBack + zHalf], [x[1] - x[0], L, t], { rotation: [-tilt, 0, 0], plan: opts?.plan });
}

// ---------------------------------------------------------------------------
// Pattern helpers (seamless: lattices wrap and every repeat is an integer)
// ---------------------------------------------------------------------------

type Noise = (u: number, v: number) => number;

/** Smooth value noise in [-1, 1] on a cx × cy lattice that wraps; u, v are in tile units. */
function wrapNoise(rand: () => number, cx: number, cy: number): Noise {
  const g = new Float32Array(cx * cy).map(() => rand() * 2 - 1);
  const at = (i: number, j: number) => g[(((j % cy) + cy) % cy) * cx + (((i % cx) + cx) % cx)];
  return (u, v) => {
    const x = u * cx;
    const y = v * cy;
    const i = Math.floor(x);
    const j = Math.floor(y);
    const fx = x - i;
    const fy = y - j;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = at(i, j) + (at(i + 1, j) - at(i, j)) * sx;
    const b = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * sx;
    return a + (b - a) * sy;
  };
}

const smooth = (a: number, b: number, v: number): number => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

const byte = (v: number): number => Math.round(clamp(v, 0, 1) * 255);





// ---------------------------------------------------------------------------
// Kotatsu
// ---------------------------------------------------------------------------

const kotatsu = defineItem({
  id: 'kotatsu',
  name: 'Kotatsu heated table',
  category: 'living',
  type: 'surfaces',
  group: 'Coffee tables',
  tags: ['kotatsu', 'heated table', 'quilt', 'futon', 'low table', 'japanese', 'winter', 'mikan'],
  defaultSize: { w: 1.3, d: 1.3, h: 0.46 },
  minSize: { w: 0.9, d: 0.9, h: 0.32 },
  maxSize: { w: 2.2, d: 1.8, h: 0.55 },
  slots: [
    matSlot('quilt', 'Kotatsu quilt', 'kotatsu-quilt'),
    matSlot('top', 'Tabletop & bowl', 'keyaki'),
    matSlot('mikan', 'Mikan oranges', 'mikan-peel'),
    matSlot('light', 'Heater glow', 'kotatsu-glow'),
  ],
  light: { color: '#ff8040', intensity: 0.45, distance: 1.5, y: 0.08 },
  build: ({ w, d, h }) => {
    const space = Math.min(0.085, h * 0.22);
    const tt = h - space;
    const tb = tt - 0.026;
    const ax = w * 0.33;
    const az = d * 0.33;
    const qt = 0.024;
    const yTop = tb - qt;
    const bx = w / 2 - 0.035;
    const bz = d / 2 - 0.035;
    const yHem = 0.06;
    const t = 0.02;
    const ix = ax + 0.02;
    const iz = az + 0.02;
    const parts: Part[] = [
      // The heater's warm light spilling under the hem.
      span('light', [-bx + 0.06, bx - 0.06], [0, 0.01], [-bz + 0.06, bz - 0.06], { plan: false }),
      // Quilt over the frame, sandwiched under the tabletop.
      cushion('quilt', [-ix, ix], [yTop, tb], [-iz, iz], { softness: 0.4, plan: false }),
      drape('quilt', 'front', ix, bx, iz, bz - t, yTop + 0.004, yHem, t),
      drape('quilt', 'back', ix, bx, iz, bz - t, yTop + 0.004, yHem, t),
      drape('quilt', 'right', iz, bz, ix, bx - t, yTop + 0.004, yHem, t),
      drape('quilt', 'left', iz, bz, ix, bx - t, yTop + 0.004, yHem, t),
      // Rolled hem resting just off the floor (it outlines the plan footprint).
      rodX('quilt', -bx, bx, yHem, bz - 0.006, 0.022),
      rodX('quilt', -bx, bx, yHem, -bz + 0.006, 0.022),
      rodZ('quilt', bx - 0.006, yHem, -bz, bz, 0.022),
      rodZ('quilt', -bx + 0.006, yHem, -bz, bz, 0.022),
      // Tabletop.
      span('top', [-ax - 0.06, ax + 0.06], [tb, tt], [-az - 0.06, az + 0.06], { bevel: 0.008, plan: false }),
    ];
    // Soft folds where the quilt bunches at the corners.
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        parts.push(rod('quilt', [sx * ix, yTop + 0.01, sz * iz], [sx * (bx - 0.012), yHem + 0.005, sz * (bz - 0.012)], 0.026, { plan: false }));
      }
    }
    // A wooden bowl of mikan on the table.
    const br = Math.min(0.1, ax * 0.42);
    const bh = space * 0.45;
    const mr = Math.min(0.03, space * 0.22, br * 0.45);
    parts.push(pot('top', [0, tt, 0], br, bh, 'bowl', { plan: false }));
    const ringY = tt + bh * 0.6 + mr * 0.85;
    for (const k of range(3)) {
      const a = (k / 3) * TAU + 0.4;
      parts.push(sphere('mikan', [Math.cos(a) * br * 0.45, ringY, Math.sin(a) * br * 0.45], mr, { scale: [1, 0.85, 1], plan: false }));
    }
    parts.push(sphere('mikan', [0.004, ringY + mr * 1.3, -0.004], mr, { scale: [1, 0.85, 1], plan: false }));
    return parts;
  },
  planDetail: ({ w, d }) => [rectPoly(-w * 0.33 - 0.06, -d * 0.33 - 0.06, w * 0.33 + 0.06, d * 0.33 + 0.06)],
});

// ---------------------------------------------------------------------------
// Floor seating and the low table
// ---------------------------------------------------------------------------

const zabuton = defineItem({
  id: 'zabuton-cushion',
  name: 'Zabuton floor cushion',
  category: 'living',
  type: 'seating',
  group: 'Ottomans & poufs',
  tags: ['zabuton', 'floor cushion', 'cushion', 'seat', 'japanese', 'tatami', 'tassel'],
  defaultSize: { w: 0.55, d: 0.59, h: 0.09 },
  minSize: { w: 0.4, d: 0.4, h: 0.05 },
  maxSize: { w: 0.8, d: 0.8, h: 0.16 },
  slots: [
    matSlot('cover', 'Cover', 'beni-cotton'),
    matSlot('tassel', 'Tassels & ties', 'tassel-silk'),
  ],
  build: ({ w, d, h }) => {
    const parts: Part[] = [
      cushion('cover', [-w / 2 + 0.012, w / 2 - 0.012], [0, h * 0.72], [-d / 2 + 0.012, d / 2 - 0.012], { softness: 0.45 }),
      // Plump, slightly domed middle.
      sphere('cover', [0, h * 0.5, 0], 0.5, { scale: [w * 0.88, h * 0.94, d * 0.88], plan: false }),
    ];
    // Centre tie (tome): a knot with threads splayed in three directions.
    const top = h * 0.97;
    parts.push(sphere('tassel', [0, top - 0.002, 0], 0.008, { scale: [1, 0.6, 1], plan: false }));
    for (const k of range(3)) {
      const a = (k / 3) * TAU + Math.PI / 2;
      parts.push(rod('tassel', [0, top - 0.002, 0], [Math.cos(a) * 0.022, top - 0.004, Math.sin(a) * 0.022], 0.0025, { plan: false }));
    }
    // Corner tassels (fusa).
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const cx = sx * (w / 2 - 0.03);
        const cz = sz * (d / 2 - 0.03);
        const y = h * 0.36;
        parts.push(sphere('tassel', [cx, y, cz], 0.007, { plan: false }));
        parts.push(rod('tassel', [cx, y, cz], [sx * (w / 2 - 0.004), y - h * 0.18, sz * (d / 2 - 0.004)], 0.006, { rTop: 0.0025, plan: false }));
      }
    }
    return parts;
  },
});

const zaisu = defineItem({
  id: 'zaisu-chair',
  name: 'Zaisu legless chair',
  category: 'living',
  type: 'seating',
  group: 'Living chairs',
  tags: ['zaisu', 'floor chair', 'legless chair', 'japanese', 'tatami', 'seat', 'backrest'],
  defaultSize: { w: 0.48, d: 0.56, h: 0.48 },
  minSize: { w: 0.4, d: 0.45, h: 0.35 },
  maxSize: { w: 0.7, d: 0.75, h: 0.7 },
  slots: [
    matSlot('wood', 'Frame', 'keyaki'),
    matSlot('cushion', 'Cushions', 'aizome-indigo'),
  ],
  build: ({ w, d, h }) => {
    const tilt = 0.3;
    const bt = 0.022;
    const baseT = 0.03;
    const zBack = -d / 2 + 0.004;
    const back = tiltedBoard('wood', [-w / 2 + 0.004, w / 2 - 0.004], baseT - 0.006, h - 0.004, zBack, bt, tilt);
    const L = (h - 0.004 - (baseT - 0.006) - bt * Math.sin(tilt)) / Math.cos(tilt);
    // Front face of the backrest at height y.
    const zFace = (y: number) => zBack + bt / Math.cos(tilt) + (L * Math.sin(tilt) - (y - baseT) * Math.tan(tilt)) * 0.98;
    const zSeat0 = zFace(baseT) - 0.01;
    const armH = Math.min(0.22, h * 0.46);
    const ct = Math.min(0.06, h * 0.13);
    const parts: Part[] = [
      // Seat board resting on the floor.
      span('wood', [-w / 2, w / 2], [0, baseT], [zBack + 0.02, d / 2], { bevel: 0.008 }),
      back,
      // Padded seat and back.
      cushion('cushion', [-w / 2 + 0.035, w / 2 - 0.035], [baseT, baseT + ct], [zSeat0 + 0.005, d / 2 - 0.02], { softness: 0.45, plan: false }),
      tiltedBoard('cushion', [-w / 2 + 0.05, w / 2 - 0.05], baseT + ct + 0.01, h - 0.04, zFace(h - 0.04) - 0.004, 0.035, tilt, { plan: false }),
    ];
    // Side brackets joining seat and backrest.
    for (const sx of [-1, 1]) {
      const x0 = sx < 0 ? -w / 2 : w / 2 - 0.02;
      parts.push(
        sidePlate(
          'wood',
          [
            [zFace(baseT) - 0.02, baseT],
            [zFace(armH) - 0.01, armH],
            [zFace(armH) + 0.04, armH],
            [zFace(baseT) + Math.min(0.28, d * 0.5), baseT],
          ],
          x0,
          0.02,
        ),
      );
    }
    // Tie button on the seat.
    parts.push(sphere('cushion', [0, baseT + ct, (zSeat0 + d / 2) / 2], 0.009, { scale: [1, 0.5, 1], plan: false }));
    return parts;
  },
});

const chabudai = defineItem({
  id: 'chabudai',
  name: 'Chabudai round low table',
  category: 'living',
  type: 'surfaces',
  group: 'Coffee tables',
  tags: ['chabudai', 'low table', 'round table', 'folding table', 'japanese', 'tatami', 'dining'],
  defaultSize: { w: 0.75, d: 0.75, h: 0.32 },
  minSize: { w: 0.5, d: 0.5, h: 0.25 },
  maxSize: { w: 1.2, d: 1.2, h: 0.4 },
  slots: [
    matSlot('top', 'Tabletop', 'keyaki'),
    matSlot('base', 'Legs & apron', 'keyaki'),
    matSlot('metal', 'Folding hinges', 'metal-brass'),
  ],
  build: ({ w, d, h }) => {
    const r = w / 2;
    const zs = d / w;
    const tt = 0.03;
    const yt = h - tt;
    const a = r * 0.52;
    const lt = 0.04;
    const apronH = Math.min(0.05, yt * 0.2);
    const parts: Part[] = [
      lathe('top', [0, yt, 0], [[0, 0], [r - 0.012, 0], [r - 0.002, 0.006], [r, 0.014], [r - 0.002, 0.024], [r - 0.01, tt], [0, tt]], { segments: 48, scale: [1, 1, zs] }),
    ];
    // Apron square under the top.
    const az = a * zs;
    parts.push(span('base', [-a, a], [yt - apronH, yt], [az - 0.018, az], { plan: false }));
    parts.push(span('base', [-a, a], [yt - apronH, yt], [-az, -az + 0.018], { plan: false }));
    parts.push(span('base', [-a, -a + 0.018], [yt - apronH, yt], [-az + 0.018, az - 0.018], { plan: false }));
    parts.push(span('base', [a - 0.018, a], [yt - apronH, yt], [-az + 0.018, az - 0.018], { plan: false }));
    // Folding legs, slightly tapered, with brass hinge plates.
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const lx = sx * (a - 0.018 - lt / 2);
        const lz = sz * (az - 0.018 - lt / 2);
        parts.push(span('base', [lx - lt / 2, lx + lt / 2], [0.004, yt], [lz - lt / 2, lz + lt / 2], { bevel: 0.004, plan: false }));
        parts.push(span('base', [lx - lt * 0.42, lx + lt * 0.42], [0, 0.01], [lz - lt * 0.42, lz + lt * 0.42], { bevel: 0.002, plan: false }));
        const hz: V2 = sz > 0 ? [lz + lt / 2, lz + lt / 2 + 0.002] : [lz - lt / 2 - 0.002, lz - lt / 2];
        parts.push(span('metal', [lx - 0.012, lx + 0.012], [yt - apronH - 0.03, yt - apronH + 0.01], hz, { plan: false }));
      }
    }
    return parts;
  },
});

// ---------------------------------------------------------------------------
// Shoji screen
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Futon
// ---------------------------------------------------------------------------

const futonPillows = (w: number): number[] => cells(w >= 1.3 ? 2 : 1, -w / 2 + 0.05, w / 2 - 0.05);

const futon = defineItem({
  id: 'futon-shikibuton',
  name: 'Shikibuton floor futon',
  category: 'bedroom',
  type: 'beds',
  group: 'Beds',
  tags: ['futon', 'shikibuton', 'kakebuton', 'floor bed', 'mattress', 'quilt', 'buckwheat pillow', 'japanese', 'tatami'],
  defaultSize: { w: 1.0, d: 2.1, h: 0.2 },
  minSize: { w: 0.7, d: 1.7, h: 0.1 },
  maxSize: { w: 1.8, d: 2.3, h: 0.35 },
  slots: [
    matSlot('mattress', 'Shikibuton & collar', 'futon-cotton'),
    matSlot('quilt', 'Kakebuton quilt', 'seigaiha-indigo'),
    matSlot('pillow', 'Buckwheat pillow', 'sobagara'),
  ],
  build: ({ w, d, h }) => {
    const mt = Math.min(0.09, h * 0.45);
    const ph = Math.min(0.1, h - mt + 0.005);
    const zq = -d / 2 + Math.min(0.5, d * 0.24);
    const qt = mt + (h - mt) * 0.55;
    const parts: Part[] = [cushion('mattress', [-w / 2 + 0.03, w / 2 - 0.03], [0, mt], [-d / 2, d / 2 - 0.02], { softness: 0.4 })];
    // Sobagara pillows: small, firm and rectangular, with a cotton cover band.
    const xs = futonPillows(w);
    const pw = Math.min(0.36, (w - 0.1) / xs.length - 0.04);
    for (const cx of xs) {
      parts.push(cushion('pillow', [cx - pw / 2, cx + pw / 2], [mt - 0.005, mt - 0.005 + ph], [-d / 2 + 0.07, -d / 2 + 0.3], { softness: 0.45, plan: false }));
      parts.push(cushion('mattress', [cx - pw / 2 + 0.01, cx + pw / 2 - 0.01], [mt - 0.004, mt - 0.005 + ph * 1.02], [-d / 2 + 0.15, -d / 2 + 0.22], { softness: 0.45, plan: false }));
    }
    // Kakebuton quilt over the mattress, with the white collar (kake-eri) folded over its top edge.
    parts.push(cushion('quilt', [-w / 2, w / 2], [mt * 0.35, qt], [zq, d / 2], { softness: 0.45, plan: false }));
    parts.push(cushion('mattress', [-w / 2 + 0.005, w / 2 - 0.005], [mt * 0.35 + 0.01, h], [zq - 0.01, zq + Math.min(0.2, d * 0.1)], { softness: 0.45, plan: false }));
    // Tied quilting knots.
    const z0 = zq + Math.min(0.2, d * 0.1) + 0.15;
    const nx = Math.max(2, Math.round(w / 0.35));
    const nz = Math.max(3, Math.round((d / 2 - z0) / 0.32));
    for (const x of cells(nx, -w / 2 + 0.06, w / 2 - 0.06)) {
      for (const z of cells(nz, z0, d / 2 - 0.08)) parts.push(sphere('mattress', [x, qt, z], 0.009, { scale: [1, 0.5, 1], plan: false }));
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const zq = -d / 2 + Math.min(0.5, d * 0.24);
    const xs = futonPillows(w);
    const pw = Math.min(0.36, (w - 0.1) / xs.length - 0.04);
    return [line([-w / 2, zq], [w / 2, zq]), ...xs.map((cx) => rectPoly(cx - pw / 2, -d / 2 + 0.07, cx + pw / 2, -d / 2 + 0.3))];
  },
});

// ---------------------------------------------------------------------------
// Andon lamp
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Kakejiku hanging scroll
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Bonsai and ikebana
// ---------------------------------------------------------------------------

const bonsai = defineItem({
  id: 'bonsai-tree',
  name: 'Bonsai tree',
  category: 'decor',
  type: 'plants',
  group: 'Indoor plants',
  tags: ['bonsai', 'pine', 'tree', 'plant', 'pot', 'japanese', 'miniature tree'],
  defaultSize: { w: 0.5, d: 0.35, h: 0.45 },
  minSize: { w: 0.25, d: 0.18, h: 0.22 },
  maxSize: { w: 1.0, d: 0.7, h: 0.9 },
  slots: [
    matSlot('pot', 'Glazed pot', 'bonsai-glaze'),
    matSlot('trunk', 'Trunk', 'bonsai-bark'),
    matSlot('foliage', 'Foliage pads', 'pine-foliage'),
    matSlot('moss', 'Moss', 'bonsai-moss'),
  ],
  build: ({ w, d, h }) => {
    const ph = Math.min(0.07, h * 0.16);
    const pw = w * 0.62;
    const pd = d * 0.7;
    const H = h - ph;
    const o = { plan: false };
    const parts: Part[] = [
      span('pot', [-pw / 2, pw / 2], [0.012, ph - 0.01], [-pd / 2, pd / 2], { bevel: 0.006 }),
      span('pot', [-pw / 2 - 0.006, pw / 2 + 0.006], [ph - 0.012, ph], [-pd / 2 - 0.006, pd / 2 + 0.006], { bevel: 0.004, plan: false }),
      span('moss', [-pw / 2 + 0.008, pw / 2 - 0.008], [ph - 0.012, ph + 0.003], [-pd / 2 + 0.008, pd / 2 - 0.008], o),
    ];
    // Cloud feet.
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) parts.push(span('pot', [sx * pw * 0.36 - 0.018, sx * pw * 0.36 + 0.018], [0, 0.014], [sz * pd * 0.32 - 0.014, sz * pd * 0.32 + 0.014], { bevel: 0.004, plan: false }));
    }
    // Moss mounds.
    const rm = rng(9);
    for (const k of range(4)) {
      const x = (rm() - 0.5) * pw * 0.7;
      const z = (rm() - 0.5) * pd * 0.6;
      parts.push(sphere('moss', [x, ph, z], Math.min(pw, pd) * (0.1 + rm() * 0.08), { scale: [1, 0.3, 1], plan: k === 0 ? undefined : false }));
    }
    // Gnarled trunk: tapering S-curve with knuckled joints.
    const P = (p: V3): V3 => [p[0] * w, ph + p[1] * H, p[2] * d];
    const path: V3[] = [
      [-0.07, -0.01, 0],
      [-0.13, 0.16, 0.04],
      [-0.02, 0.34, -0.03],
      [0.09, 0.47, 0.02],
      [0.01, 0.62, 0],
      [-0.06, 0.78, -0.02],
    ];
    const rb = Math.min(w, d, H) * 0.065;
    const rAt = (i: number) => rb * lerp(1, 0.3, i / (path.length - 1));
    for (const i of range(path.length - 1)) {
      parts.push(rod('trunk', P(path[i]), P(path[i + 1]), rAt(i), { rTop: rAt(i + 1), plan: false }));
      if (i > 0) parts.push(sphere('trunk', P(path[i]), rAt(i) * 1.08, o));
    }
    // Nebari: surface roots spreading over the moss.
    const base = P(path[0]);
    for (const a of [0.3, 2.2, 4.1]) {
      parts.push(rod('trunk', [base[0], ph + rb * 0.6, base[2]], [base[0] + Math.cos(a) * rb * 2.6, ph, base[2] + Math.sin(a) * rb * 2.2], rb * 0.55, { rTop: rb * 0.15, plan: false }));
    }
    // Branches out to cloud-pruned foliage pads [x, y, z, sx, sy, sz] (fractions of w, H, d).
    const pads: [number, number, number, number, number, number][] = [
      [-0.29, 0.44, 0.06, 0.3, 0.1, 0.5],
      [0.28, 0.56, 0, 0.3, 0.1, 0.48],
      [0.1, 0.73, -0.11, 0.26, 0.09, 0.4],
      [-0.06, 0.88, -0.02, 0.26, 0.12, 0.44],
    ];
    const from = [2, 3, 4, 5];
    const rf = rng(41);
    for (const [k, [cx, cy, cz, sx, sy, sz]] of pads.entries()) {
      const c = P([cx, cy, cz]);
      if (from[k] < path.length - 1) parts.push(rod('trunk', P(path[from[k]]), [c[0], c[1] - sy * H * 0.2, c[2]], rAt(from[k]) * 0.55, { rTop: rb * 0.12, plan: false }));
      const S: V3 = [sx * w, sy * H, sz * d];
      parts.push(sphere('foliage', c, 0.5, { scale: S, plan: false }));
      for (const j of range(3)) {
        const ox = (j - 1) * 0.25 + (rf() - 0.5) * 0.06;
        const oz = (rf() - 0.5) * 0.36;
        parts.push(sphere('foliage', [c[0] + ox * S[0], c[1] + S[1] * 0.1, c[2] + oz * S[2]], 0.5, { scale: [S[0] * 0.45, S[1] * 0.8, S[2] * 0.5], plan: false }));
      }
    }
    return parts;
  },
});

const ikebana = defineItem({
  id: 'ikebana',
  name: 'Ikebana arrangement',
  category: 'decor',
  type: 'plants',
  group: 'Indoor plants',
  tags: ['ikebana', 'flower arrangement', 'suiban', 'kenzan', 'plum blossom', 'camellia', 'japanese', 'flowers'],
  defaultSize: { w: 0.45, d: 0.32, h: 0.6 },
  minSize: { w: 0.25, d: 0.2, h: 0.3 },
  maxSize: { w: 1.0, d: 0.7, h: 1.4 },
  slots: [
    matSlot('vase', 'Suiban basin', 'ceramic-black'),
    matSlot('stems', 'Branches', 'bonsai-bark'),
    matSlot('flowers', 'Blossoms', 'plant-flower-pink'),
    matSlot('leaves', 'Leaves', 'plant-leaf-dark'),
  ],
  build: ({ w, d, h }) => {
    const r = Math.min(w * 0.34, d * 0.46);
    const bh = Math.min(0.06, h * 0.12);
    const H = h - 0.015;
    const o = { plan: false };
    const parts: Part[] = [
      lathe('vase', [0, 0, 0], [[0, 0], [r * 0.9, 0], [r * 0.97, bh * 0.25], [r, bh], [r * 0.93, bh], [r * 0.9, bh * 0.35], [0, bh * 0.35]], { segments: 40 }),
      // Kenzan (pin holder) and the water.
      cyl('stems', [-r * 0.15, bh * 0.35 + 0.006, -r * 0.05], Math.min(0.035, r * 0.25), 0.012, o),
      cyl('vase', [0, bh * 0.75, 0], r * 0.88, 0.002, { segments: 40, plan: false }),
    ];
    const base: V3 = [-r * 0.15, bh * 0.35 + 0.012, -r * 0.05];
    // Shin (heaven), soe (person) and hikae (earth): the three lines of the arrangement.
    const shin: V3[] = [base, [-w * 0.06, H * 0.4, -d * 0.04], [-w * 0.14, H * 0.72, -d * 0.06], [-w * 0.2, H * 0.95, -d * 0.02]];
    const soe: V3[] = [base, [w * 0.07, H * 0.3, -d * 0.08], [w * 0.19, H * 0.5, -d * 0.16], [w * 0.3, H * 0.62, -d * 0.2]];
    const hikae: V3[] = [base, [w * 0.1, H * 0.16, d * 0.1], [w * 0.2, H * 0.24, d * 0.22]];
    for (const [k, path] of [shin, soe, hikae].entries()) {
      const r0 = k === 0 ? 0.008 : 0.0065;
      for (const i of range(path.length - 1)) {
        parts.push(rod('stems', path[i], path[i + 1], r0 * lerp(1, 0.45, i / (path.length - 1)), { rTop: r0 * lerp(1, 0.45, (i + 1) / (path.length - 1)), plan: false }));
      }
    }
    // Plum blossoms and buds along the upper branches.
    const rand = rng(57);
    for (const path of [shin, soe]) {
      for (const i of range(path.length - 2)) {
        const a = path[i + 1];
        const b = path[i + 2];
        for (const j of range(4)) {
          const f = (j + 0.5 + rand() * 0.4) / 4;
          const br = Math.min(0.016, h * 0.025) * (0.6 + rand() * 0.5);
          parts.push(sphere('flowers', [lerp(a[0], b[0], f) + (rand() - 0.5) * 0.02, lerp(a[1], b[1], f), lerp(a[2], b[2], f) + (rand() - 0.5) * 0.02], br, o));
        }
      }
    }
    // Camellia at the hikae tip.
    const tip = hikae[hikae.length - 1];
    const pl = Math.min(0.045, w * 0.08, h * 0.08);
    for (const k of range(6)) parts.push(leaf('flowers', tip, pl, pl * 0.75, (k / 6) * TAU, 1.15, { thick: pl * 0.18 }));
    parts.push(sphere('flowers', [tip[0], tip[1] + pl * 0.25, tip[2]], pl * 0.3, o));
    // Broad leaves fanning from the kenzan and along the hikae stem.
    const ll = Math.min(0.16, H * 0.3, w * 0.3, d * 0.4);
    for (const k of range(5)) parts.push(leaf('leaves', base, ll * (0.75 + rand() * 0.25), ll * 0.32, -2.4 + k * 1.05 + rand() * 0.3, 0.55 + rand() * 0.35));
    for (const k of range(3)) parts.push(leaf('leaves', hikae[1], ll * 0.55, ll * 0.22, 0.2 + k * 1.4, 0.9));
    return parts;
  },
  planDetail: ({ w, d }) => [circle([0, 0], Math.min(w * 0.34, d * 0.46) * 0.9)],
});


// ---------------------------------------------------------------------------
// Maneki-neko
// ---------------------------------------------------------------------------

const manekiNeko = defineItem({
  id: 'maneki-neko',
  name: 'Maneki-neko lucky cat',
  category: 'decor',
  type: 'decor',
  group: 'Ornaments',
  tags: ['maneki-neko', 'lucky cat', 'beckoning cat', 'figurine', 'koban', 'japanese', 'good luck'],
  defaultSize: { w: 0.16, d: 0.14, h: 0.22 },
  minSize: { w: 0.08, d: 0.07, h: 0.11 },
  maxSize: { w: 0.48, d: 0.42, h: 0.66 },
  slots: [
    matSlot('porcelain', 'Porcelain', 'maneki-porcelain'),
    matSlot('red', 'Collar & cushion', 'shu-red'),
    matSlot('gold', 'Bell & koban', 'kin-gold'),
    matSlot('detail', 'Face & patches', 'sumi-ink'),
  ],
  build: ({ w, d, h }) => {
    // Figurines keep their proportions: modelled at 16 × 14 × 22 cm and scaled to fit.
    const k = Math.min(w / 0.16, d / 0.14, h / 0.22);
    const s = (v: number) => v * k;
    const P = (x: number, y: number, z: number): V3 => [x * k, y * k, z * k];
    const o = { plan: false };
    const parts: Part[] = [
      cushion('red', [s(-0.075), s(0.075)], [0, s(0.018)], [s(-0.065), s(0.065)], { softness: 0.4 }),
      lathe('porcelain', P(0, 0.018, 0), [[0, 0], [s(0.055), 0], [s(0.062), s(0.03)], [s(0.056), s(0.07)], [s(0.042), s(0.1)], [s(0.03), s(0.115)], [0, s(0.115)]], {
        segments: 28,
        scale: [1, 1, 0.88],
        plan: false,
      }),
      sphere('porcelain', P(0, 0.163, 0.006), s(0.05), { scale: [1.06, 0.9, 0.94], plan: false }),
      // Collar with its bell.
      ring('red', P(0, 0.128, 0.004), s(0.033), s(0.0055), { zScale: 0.9, plan: false }),
      sphere('gold', P(0, 0.117, 0.04), s(0.01), o),
      // Beckoning paw raised beside the head.
      rod('porcelain', P(-0.04, 0.11, 0.028), P(-0.058, 0.17, 0.03), s(0.014), o),
      sphere('porcelain', P(-0.059, 0.18, 0.031), s(0.017), o),
      sphere('red', P(-0.059, 0.181, 0.046), s(0.006), { scale: [1, 1, 0.4], plan: false }),
      // The other paw holding a gold koban coin.
      rod('porcelain', P(0.036, 0.1, 0.03), P(0.03, 0.074, 0.048), s(0.014), o),
      discZ('gold', P(0.012, 0.072, 0.058), s(0.021), s(0.006), { scale: [1, 1, 1.45], plan: false }),
      sphere('porcelain', P(0.027, 0.075, 0.058), s(0.013), o),
      // Happy closed eyes, nose and whiskers.
      sphere('detail', P(-0.019, 0.17, 0.05), s(0.007), { scale: [1.5, 0.5, 0.6], plan: false }),
      sphere('detail', P(0.019, 0.17, 0.05), s(0.007), { scale: [1.5, 0.5, 0.6], plan: false }),
      sphere('red', P(0, 0.157, 0.052), s(0.004), o),
      // Calico patches.
      sphere('detail', P(-0.022, 0.196, -0.008), s(0.02), { scale: [1, 0.35, 1], rotation: [0, 0, 0.5], plan: false }),
      sphere('detail', P(0.034, 0.07, -0.03), s(0.024), { scale: [0.45, 1, 1], rotation: [0, 0.7, 0], plan: false }),
      // Tail curled round the back, and the front feet.
      torus('porcelain', P(0.03, 0.035, -0.046), s(0.016), s(0.006), { rotation: [Math.PI / 2, 0, 0], arc: Math.PI, plan: false }),
      sphere('porcelain', P(-0.024, 0.027, 0.046), s(0.014), { scale: [1, 0.7, 1.2], plan: false }),
      sphere('porcelain', P(0.024, 0.027, 0.046), s(0.014), { scale: [1, 0.7, 1.2], plan: false }),
    ];
    for (const sx of [-1, 1]) {
      // Ears with red insides.
      parts.push(cyl('porcelain', P(sx * 0.03, 0.2, -0.002), s(0.017), s(0.028), { rTop: s(0.003), rotation: [0, 0, -sx * 0.32], plan: false }));
      parts.push(cyl('red', P(sx * 0.03, 0.199, 0.005), s(0.01), s(0.02), { rTop: s(0.002), rotation: [0, 0, -sx * 0.32], plan: false }));
      for (const j of range(3)) {
        parts.push(rod('detail', P(sx * 0.024, 0.151 + j * 0.005, 0.05), P(sx * 0.047, 0.147 + j * 0.008, 0.045), s(0.0007), o));
      }
    }
    return parts;
  },
});

// ---------------------------------------------------------------------------
// Kamidana
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Getabako
// ---------------------------------------------------------------------------

const getabako = defineItem({
  id: 'getabako',
  name: 'Getabako shoe cabinet with slippers',
  category: 'storage',
  type: 'storage',
  group: 'Hallway storage',
  tags: ['getabako', 'shoe cabinet', 'genkan', 'entryway', 'slippers', 'shoe storage', 'japanese'],
  defaultSize: { w: 0.9, d: 0.36, h: 1.0 },
  minSize: { w: 0.5, d: 0.3, h: 0.6 },
  maxSize: { w: 1.8, d: 0.45, h: 1.3 },
  slots: [
    matSlot('body', 'Cabinet', 'sugi-cedar'),
    matSlot('doors', 'Lattice doors', 'hinoki'),
    matSlot('handles', 'Pulls & vents', 'metal-black-matte'),
    matSlot('slippers', 'Slippers', 'aizome-indigo'),
  ],
  build: ({ w, d, h }) => {
    const sideT = 0.02;
    const nicheH = Math.min(0.22, h * 0.22);
    const zFace = d / 2 - 0.032;
    const o = { plan: false };
    const parts: Part[] = [
      span('body', [-w / 2, -w / 2 + sideT], [0, h - 0.025], [-d / 2, zFace + 0.02]),
      span('body', [w / 2 - sideT, w / 2], [0, h - 0.025], [-d / 2, zFace + 0.02]),
      span('body', [-w / 2, w / 2], [h - 0.025, h], [-d / 2, d / 2], { bevel: 0.004 }),
      span('body', [-w / 2 + sideT, w / 2 - sideT], [nicheH, h - 0.025], [-d / 2, -d / 2 + 0.012], o),
      span('body', [-w / 2 + sideT, w / 2 - sideT], [nicheH - 0.022, nicheH], [-d / 2 + 0.012, zFace], o),
      span('body', [-w / 2 + sideT, w / 2 - sideT], [0, 0.015], [-d / 2, zFace], o),
      span('body', [-w / 2 + sideT, w / 2 - sideT], [0.015, nicheH - 0.022], [-d / 2, -d / 2 + 0.01], o),
    ];
    // Doors: framed, with vertical koshi slats over a dark vent backing.
    const n = Math.max(1, Math.round((w - 2 * sideT) / 0.45));
    const y0 = nicheH + 0.004;
    const y1 = h - 0.029;
    const rail = 0.04;
    for (const i of range(n)) {
      const x0 = -w / 2 + sideT + ((w - 2 * sideT) * i) / n + 0.002;
      const x1 = -w / 2 + sideT + ((w - 2 * sideT) * (i + 1)) / n - 0.002;
      const zf: V2 = [zFace, zFace + 0.02];
      parts.push(span('doors', [x0, x0 + rail], [y0, y1], zf, o));
      parts.push(span('doors', [x1 - rail, x1], [y0, y1], zf, o));
      parts.push(span('doors', [x0 + rail, x1 - rail], [y1 - rail, y1], zf, o));
      parts.push(span('doors', [x0 + rail, x1 - rail], [y0, y0 + rail], zf, o));
      parts.push(span('handles', [x0 + rail, x1 - rail], [y0 + rail, y1 - rail], [zFace, zFace + 0.004], o));
      const ns = Math.max(3, Math.round((x1 - x0 - 2 * rail) / 0.034));
      parts.push(...slats('doors', [x0 + rail, x1 - rail], [y0 + rail, y1 - rail], [zFace + 0.004, zFace + 0.016], ns, { axis: 'x', gap: 0.45, plan: false }));
      // Pull on the meeting edge (or the right edge of a single door).
      const hx = n > 1 && i < n / 2 ? x1 - rail / 2 : x0 + rail / 2;
      const hy = Math.min(y1 - 0.1, y0 + (y1 - y0) * 0.55);
      parts.push(span('handles', [hx - 0.006, hx + 0.006], [hy - 0.05, hy + 0.05], [zFace + 0.02, d / 2], { bevel: 0.003, plan: false }));
    }
    // Slippers waiting in the open niche, toes out.
    const pairs = Math.max(1, Math.floor((w - 0.06) / 0.26));
    const sl = Math.min(0.25, d - 0.08);
    const sw = 0.092;
    const zs1 = d / 2 - 0.02;
    const zs0 = zs1 - sl;
    for (const cx of cells(pairs, -w / 2 + sideT + 0.01, w / 2 - sideT - 0.01)) {
      for (const sx of [-1, 1]) {
        const x = cx + sx * (sw / 2 + 0.006);
        parts.push(cushion('slippers', [x - sw / 2, x + sw / 2], [0.015, 0.03], [zs0, zs1], { softness: 0.45, plan: false }));
        parts.push(sphere('slippers', [x, 0.032, zs1 - sl * 0.3], 0.5, { scale: [sw * 0.98, 0.06, sl * 0.56], plan: false }));
      }
    }
    return parts;
  },
});

// ---------------------------------------------------------------------------
// Noren
// ---------------------------------------------------------------------------

const noren = defineItem({
  id: 'noren-curtain',
  name: 'Noren doorway curtain',
  category: 'decor',
  type: 'decor',
  group: 'Curtains & blinds',
  tags: ['noren', 'curtain', 'doorway', 'fabric', 'seigaiha', 'indigo', 'japanese', 'divider'],
  mount: 'wall',
  defaultElevation: 0.9,
  defaultSize: { w: 0.9, d: 0.05, h: 1.2 },
  minSize: { w: 0.5, d: 0.03, h: 0.4 },
  maxSize: { w: 1.8, d: 0.1, h: 1.6 },
  slots: [
    matSlot('fabric', 'Noren fabric', 'seigaiha-indigo'),
    matSlot('band', 'Top band & loops', 'aizome-indigo'),
    matSlot('pole', 'Bamboo pole', 'bamboo'),
  ],
  build: ({ w, d, h }) => {
    const zc = -d / 2 + 0.02;
    const yp = h - 0.02;
    const o = { plan: false };
    const parts: Part[] = [
      rodX('pole', -w / 2 + 0.012, w / 2 - 0.012, yp, zc, 0.012),
      rodX('pole', -w / 2, -w / 2 + 0.012, yp, zc, 0.0135, o),
      rodX('pole', w / 2 - 0.012, w / 2, yp, zc, 0.0135, o),
    ];
    // Bamboo nodes.
    for (const x of cells(Math.max(2, Math.round(w / 0.28)), -w / 2 + 0.03, w / 2 - 0.03)) {
      parts.push(rodX('pole', x - 0.004, x + 0.004, yp, zc, 0.0138, o));
    }
    // Wall brackets.
    for (const sx of [-1, 1]) parts.push(span('pole', [sx * (w / 2 - 0.08) - 0.012, sx * (w / 2 - 0.08) + 0.012], [yp - 0.03, yp - 0.01], [-d / 2, zc], o));
    // Joined top band, then the split panels.
    const yTop = yp - 0.026;
    const join = Math.min(0.12, h * 0.12);
    const n = clamp(Math.round(w / 0.3), 2, 6);
    const x0 = -w / 2 + 0.02;
    const x1 = w / 2 - 0.02;
    parts.push(span('band', [x0, x1], [yTop - join, yTop], [zc - 0.003, zc + 0.003], o));
    const rand = rng(5);
    for (const i of range(n)) {
      const a = x0 + ((x1 - x0) * i) / n + (i > 0 ? 0.007 : 0);
      const b = x0 + ((x1 - x0) * (i + 1)) / n - (i < n - 1 ? 0.007 : 0);
      parts.push(box('fabric', [(a + b) / 2, (yTop - join + 0.002) / 2, zc + (rand() - 0.5) * 0.004], [b - a, yTop - join + 0.002, 0.003], { rotation: [0, (rand() - 0.5) * 0.04, 0], plan: false }));
      // Fabric loops (chichi) round the pole.
      for (const lx of [a + 0.03, b - 0.03]) parts.push(torus('band', [lx, yp, zc], 0.016, 0.003, { rotation: [0, Math.PI / 2, 0], plan: false }));
    }
    return parts;
  },
});

// ---------------------------------------------------------------------------
// Bathroom: hinoki ofuro and the wash stool set
// ---------------------------------------------------------------------------

const ofuro = defineItem({
  id: 'ofuro-tub',
  name: 'Hinoki ofuro soaking tub',
  category: 'bathroom',
  type: 'plumbing',
  group: 'Showers & tubs',
  tags: ['ofuro', 'soaking tub', 'bathtub', 'hinoki', 'cypress', 'onsen', 'japanese', 'bath'],
  defaultSize: { w: 1.1, d: 0.75, h: 0.62 },
  minSize: { w: 0.7, d: 0.6, h: 0.45 },
  maxSize: { w: 1.6, d: 1.0, h: 0.75 },
  slots: [
    matSlot('wood', 'Hinoki', 'hinoki'),
    matSlot('water', 'Water', 'water'),
    matSlot('trim', 'Corner plates', 'metal-copper'),
  ],
  build: ({ w, d, h }) => {
    const t = 0.04;
    const lidH = 0.022;
    const rimH = 0.022;
    const yb = 0.04;
    const yW = h - lidH - rimH;
    const nb = Math.max(2, Math.round((yW - yb) / 0.15));
    const o = { plan: false };
    const parts: Part[] = [];
    for (const sx of [-1, 1]) parts.push(span('wood', [sx * (w / 2 - 0.16) - 0.03, sx * (w / 2 - 0.16) + 0.03], [0, yb], [-d / 2 + 0.03, d / 2 - 0.03], o));
    // Walls: a core plus stacked outer boards whose seams show as fine grooves.
    const walls: [V2, V2, 'z' | 'x', number][] = [
      [[-w / 2, w / 2], [d / 2 - t, d / 2], 'z', 1],
      [[-w / 2, w / 2], [-d / 2, -d / 2 + t], 'z', -1],
      [[-w / 2, -w / 2 + t], [-d / 2 + t, d / 2 - t], 'x', -1],
      [[w / 2 - t, w / 2], [-d / 2 + t, d / 2 - t], 'x', 1],
    ];
    for (const [x, z, axis, s] of walls) {
      const skin = 0.008;
      const core: [V2, V2] = axis === 'z' ? [x, s > 0 ? [z[0], z[1] - skin] : [z[0] + skin, z[1]]] : [s > 0 ? [x[0], x[1] - skin] : [x[0] + skin, x[1]], z];
      const outer: [V2, V2] = axis === 'z' ? [x, s > 0 ? [z[1] - skin, z[1]] : [z[0], z[0] + skin]] : [s > 0 ? [x[1] - skin, x[1]] : [x[0], x[0] + skin], z];
      parts.push(span('wood', core[0], [yb, yW], core[1]));
      parts.push(...slats('wood', outer[0], [yb, yW], outer[1], nb, { axis: 'y', gap: 0.03, bevel: 0.002, plan: false }));
    }
    // Floor, water and the rim cap.
    parts.push(span('wood', [-w / 2 + t, w / 2 - t], [yb, yb + 0.03], [-d / 2 + t, d / 2 - t], o));
    parts.push(span('water', [-w / 2 + t, w / 2 - t], [yb + 0.03, yW - 0.08], [-d / 2 + t, d / 2 - t], o));
    const rt = t + 0.012;
    const ry: V2 = [yW, yW + rimH];
    const rb = { bevel: 0.005, plan: false };
    parts.push(span('wood', [-w / 2, w / 2], ry, [d / 2 - rt, d / 2], rb));
    parts.push(span('wood', [-w / 2, w / 2], ry, [-d / 2, -d / 2 + rt], rb));
    parts.push(span('wood', [-w / 2, -w / 2 + rt], ry, [-d / 2 + rt, d / 2 - rt], rb));
    parts.push(span('wood', [w / 2 - rt, w / 2], ry, [-d / 2 + rt, d / 2 - rt], rb));
    // Slatted lid (furo-buta) over one end.
    const lidW = w * 0.42;
    parts.push(...slats('wood', [-w / 2 + 0.01, -w / 2 + 0.01 + lidW], [h - lidH, h], [-d / 2 + 0.01, d / 2 - 0.01], Math.max(2, Math.round(lidW / 0.11)), { axis: 'x', gap: 0.04, bevel: 0.004, plan: false }));
    // Copper corner plates.
    const cy: V2 = [yb + 0.02, yW - 0.01];
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const fx: V2 = sx > 0 ? [w / 2 - 0.07, w / 2] : [-w / 2, -w / 2 + 0.07];
        const fz: V2 = sz > 0 ? [d / 2, d / 2 + 0.003] : [-d / 2 - 0.003, -d / 2];
        parts.push(span('trim', fx, cy, fz, o));
        parts.push(span('trim', sx > 0 ? [w / 2, w / 2 + 0.003] : [-w / 2 - 0.003, -w / 2], cy, sz > 0 ? [d / 2 - 0.07, d / 2] : [-d / 2, -d / 2 + 0.07], o));
      }
    }
    return parts;
  },
  planDetail: ({ w, d }) => [rectPoly(-w / 2 + 0.04, -d / 2 + 0.04, w / 2 - 0.04, d / 2 - 0.04), line([-w / 2 + 0.01 + w * 0.42, -d / 2 + 0.04], [-w / 2 + 0.01 + w * 0.42, d / 2 - 0.04])],
});

const bathStool = defineItem({
  id: 'bath-stool-set',
  name: 'Wooden bath stool and bucket',
  category: 'bathroom',
  type: 'plumbing',
  group: 'Bathroom accessories',
  tags: ['bath stool', 'koshikake', 'bucket', 'oke', 'hinoki', 'onsen', 'japanese', 'washing', 'tenugui'],
  defaultSize: { w: 0.62, d: 0.34, h: 0.26 },
  minSize: { w: 0.45, d: 0.25, h: 0.18 },
  maxSize: { w: 0.9, d: 0.5, h: 0.4 },
  slots: [
    matSlot('wood', 'Hinoki', 'hinoki'),
    matSlot('trim', 'Copper hoops', 'metal-copper'),
    matSlot('towel', 'Tenugui towel', 'seigaiha-indigo'),
  ],
  build: ({ w, d, h }) => {
    const o = { plan: false };
    // Stool on the left: a seat board on two arched slab legs.
    const sw = Math.min(0.36, w * 0.55);
    const sx0 = -w / 2;
    const sx1 = sx0 + sw;
    const sd = Math.min(0.24, d - 0.02);
    const seatT = 0.03;
    const towelT = 0.006;
    const ySeat = h - towelT;
    const parts: Part[] = [span('wood', [sx0, sx1], [ySeat - seatT, ySeat], [-sd / 2, sd / 2], { bevel: 0.008 })];
    const legT = 0.028;
    const archH = (ySeat - seatT) * 0.45;
    const a = sd * 0.28;
    const arch: V2[] = range(9).map((i) => {
      const th = Math.PI - (i * Math.PI) / 8;
      return [Math.cos(th) * a, Math.sin(th) * archH] as V2;
    });
    const leg: V2[] = [[-sd * 0.45, 0], ...arch, [sd * 0.45, 0], [sd * 0.45, ySeat - seatT], [-sd * 0.45, ySeat - seatT]];
    parts.push(sidePlate('wood', leg, sx0 + 0.03, legT));
    parts.push(sidePlate('wood', leg, sx1 - 0.03 - legT, legT));
    // Tenugui folded over the seat and hanging down the front.
    parts.push(span('towel', [sx0 + sw * 0.25, sx0 + sw * 0.6], [ySeat, h], [-sd / 2 + 0.02, sd / 2 + 0.004], o));
    parts.push(span('towel', [sx0 + sw * 0.25, sx0 + sw * 0.6], [ySeat - Math.min(0.1, h * 0.4), ySeat], [sd / 2 + 0.002, sd / 2 + 0.008], o));
    // Bucket (oke) on the right: staves bound with copper hoops.
    const br = Math.min(0.13, (w - sw) / 2 - 0.01, d / 2 - 0.01);
    const bh = Math.min(h * 0.78, 0.2);
    const bx = w / 2 - br - 0.004;
    const ns = 16;
    const chord = 2 * br * Math.sin(Math.PI / ns) * 1.04;
    for (const i of range(ns)) {
      const ang = (i / ns) * TAU;
      parts.push(box('wood', [bx + Math.cos(ang) * (br - 0.008), bh / 2, Math.sin(ang) * (br - 0.008)], [chord, bh, 0.012], { rotation: [0, Math.PI / 2 - ang, 0], plan: false }));
    }
    parts.push(cyl('wood', [bx, 0.018, 0], br - 0.004, 0.014, { segments: 24 }));
    for (const y of [bh * 0.2, bh * 0.78]) parts.push(ring('trim', [bx, y, 0], br - 0.001, 0.004));
    return parts;
  },
  planDetail: ({ w, d }) => {
    const sw = Math.min(0.36, w * 0.55);
    const br = Math.min(0.13, (w - sw) / 2 - 0.01, d / 2 - 0.01);
    return [circle([w / 2 - br - 0.004, 0], br - 0.014)];
  },
});


// ---------------------------------------------------------------------------
// Tea set
// ---------------------------------------------------------------------------

const teaSet = defineItem({
  id: 'japanese-tea-set',
  name: 'Japanese tea set on tray',
  category: 'kitchen',
  type: 'decor',
  group: 'Candles & tabletop',
  tags: ['tea set', 'kyusu', 'teapot', 'yunomi', 'cups', 'tray', 'sencha', 'green tea', 'japanese'],
  defaultSize: { w: 0.42, d: 0.28, h: 0.15 },
  minSize: { w: 0.3, d: 0.2, h: 0.1 },
  maxSize: { w: 0.8, d: 0.5, h: 0.22 },
  slots: [
    matSlot('tray', 'Tray & saucers', 'urushi-red'),
    matSlot('pot', 'Kyusu teapot', 'tokoname-clay'),
    matSlot('cups', 'Yunomi cups', 'hagi-glaze'),
    matSlot('tea', 'Green tea', 'sencha'),
  ],
  build: ({ w, d, h }) => {
    const o = { plan: false };
    const tb = 0.012;
    const rimT = 0.012;
    const rimH = Math.min(0.026, h * 0.2);
    const parts: Part[] = [
      span('tray', [-w / 2, w / 2], [0, tb], [-d / 2, d / 2], { bevel: 0.004 }),
      span('tray', [-w / 2, w / 2], [tb, rimH], [d / 2 - rimT, d / 2], { bevel: 0.004, plan: false }),
      span('tray', [-w / 2, w / 2], [tb, rimH], [-d / 2, -d / 2 + rimT], { bevel: 0.004, plan: false }),
      span('tray', [-w / 2, -w / 2 + rimT], [tb, rimH], [-d / 2 + rimT, d / 2 - rimT], { bevel: 0.004, plan: false }),
      span('tray', [w / 2 - rimT, w / 2], [tb, rimH], [-d / 2 + rimT, d / 2 - rimT], { bevel: 0.004, plan: false }),
    ];
    // Kyusu: squat clay pot with a straight side handle at right angles to the spout.
    const pr = Math.min(0.055, d * 0.2, (w - 0.05) * 0.16);
    const pbh = Math.min(0.07, h - tb - 0.036);
    const px = -w / 2 + rimT + 0.012 + pr;
    const pz = -d * 0.08;
    const y0 = tb;
    parts.push(lathe('pot', [px, y0, pz], [[0, 0], [pr * 0.7, 0], [pr * 0.95, pbh * 0.3], [pr, pbh * 0.55], [pr * 0.82, pbh * 0.95], [pr * 0.6, pbh], [0, pbh]], { segments: 28, plan: false }));
    parts.push(lathe('pot', [px, y0 + pbh, pz], [[pr * 0.6, 0], [pr * 0.56, 0.008], [pr * 0.25, 0.018], [0, 0.02]], { segments: 24, plan: false }));
    parts.push(sphere('pot', [px, y0 + pbh + 0.024, pz], Math.min(0.009, pr * 0.2), o));
    const spoutEnd = px + pr * 1.45;
    parts.push(rod('pot', [px + pr * 0.8, y0 + pbh * 0.35, pz], [spoutEnd, y0 + pbh * 0.72, pz], Math.min(0.009, pr * 0.18), { rTop: Math.min(0.006, pr * 0.12), plan: false }));
    const hz0 = pz + pr * 0.85;
    const hl = clamp(d / 2 - rimT - 0.012 - hz0, 0.02, 0.065);
    parts.push(rod('pot', [px, y0 + pbh * 0.55, hz0], [px - pr * 0.1, y0 + pbh * 0.7, hz0 + hl], Math.min(0.011, pr * 0.2), { rTop: Math.min(0.009, pr * 0.16), plan: false }));
    // Yunomi on lacquered saucers, each filled with tea.
    const cx0 = spoutEnd + 0.03;
    const cx1 = w / 2 - rimT - 0.008;
    const nc = clamp(Math.floor((cx1 - cx0) / 0.08), 1, 5);
    const cr = Math.min(0.032, (cx1 - cx0) / nc / 2 - 0.006, d * 0.16);
    const ch = Math.min(0.075, h - tb - 0.01);
    for (const [i, cx] of cells(nc, cx0, cx1).entries()) {
      const cz = nc > 2 && i % 2 === 1 ? -d * 0.12 : d * 0.08;
      const yc = tb + 0.006;
      parts.push(cyl('tray', [cx, tb + 0.003, cz], cr * 1.35, 0.006, { segments: 24, plan: false }));
      parts.push(lathe('cups', [cx, yc, cz], [[0, 0], [cr * 0.72, 0], [cr * 0.75, 0.006], [cr * 0.92, ch * 0.5], [cr, ch - 0.004], [cr * 0.92, ch - 0.004], [cr * 0.82, ch * 0.3], [0, ch * 0.3]], { segments: 24, plan: false }));
      parts.push(cyl('tea', [cx, yc + ch * 0.78, cz], cr * 0.86, 0.003, { segments: 24, plan: false }));
    }
    return parts;
  },
});

export default definePack({
  name: 'Japanese home',
  version: '1.0.0',
  author: 'Neest team',
  description: 'Everyday things of a Japanese apartment: kotatsu, floor seating, chabudai, futon, bonsai, ikebana, getabako, noren, a hinoki ofuro and tea.',
  license: 'CC0 (made for Neest)',
  items: [ kotatsu, zabuton, zaisu, chabudai, futon, bonsai, ikebana, manekiNeko, getabako, noren, ofuro, bathStool, teaSet],
  patterns: [
    {
      id: 'igusa',
      name: 'Igusa rush weave',
      normalStrength: 0.9,
      // Rows of rush stalks running along the mat, pinched by the hemp warp every couple of cm.
      draw(ctx, size, rand) {
        const img = ctx.createImageData(size, size);
        const rows = 96;
        const warps = 12;
        const tone = new Float32Array(rows).map(() => (rand() - 0.5) * 0.12);
        const ph1 = new Float32Array(rows).map(() => rand());
        const ph2 = new Float32Array(rows).map(() => rand());
        const mottle = wrapNoise(rand, 6, 6);
        const fleck = wrapNoise(rand, 40, rows);
        for (let y = 0; y < size; y++) {
          const v = ((y + 0.5) / size) * rows;
          const r = Math.min(rows - 1, Math.floor(v));
          const c = v - r;
          const prof = Math.sqrt(Math.max(0, 1 - (2 * c - 1) ** 2));
          for (let x = 0; x < size; x++) {
            const u = (x + 0.5) / size;
            const along = 0.02 * Math.sin(TAU * (u * 2 + ph1[r])) + 0.012 * Math.sin(TAU * (u * 5 + ph2[r]));
            const wu = u * warps;
            const pinch = Math.exp(-(((wu - Math.round(wu)) / 0.03) ** 2));
            const L =
              0.76 + 0.2 * prof ** 0.6 + tone[r] + along + 0.025 * mottle(u, v / rows) + 0.04 * fleck(u, (r + 0.5) / rows) - 0.045 * pinch;
            const i = (y * size + x) * 4;
            img.data[i] = img.data[i + 1] = img.data[i + 2] = byte(L);
            img.data[i + 3] = 255;
          }
        }
        ctx.putImageData(img, 0, 0);
      },
    },
    {
      id: 'hinoki-grain',
      name: 'Fine straight grain',
      normalStrength: 0.25,
      // Close, straight growth lines with gentle wander and fine fibres, as in quarter-sawn hinoki.
      draw(ctx, size, rand) {
        const img = ctx.createImageData(size, size);
        const lines = 36;
        const strength = new Float32Array(lines).map(() => 0.5 + rand() * 0.7);
        const w1 = wrapNoise(rand, 3, 2);
        const w2 = wrapNoise(rand, 8, 3);
        const fib = wrapNoise(rand, 12, 220);
        const band = wrapNoise(rand, 2, 30);
        for (let y = 0; y < size; y++) {
          const v = (y + 0.5) / size;
          for (let x = 0; x < size; x++) {
            const u = (x + 0.5) / size;
            const ph = v * lines + 0.8 * w1(u, v) + 0.35 * w2(u, v);
            const k = Math.floor(ph);
            const p = ph - k;
            const s = strength[((k % lines) + lines) % lines];
            const late = smooth(0.55, 0.82, p) * (1 - smooth(0.86, 0.98, p));
            const L = 0.92 - 0.12 * late * s + 0.025 * fib(u, v) + 0.03 * band(u, v);
            const i = (y * size + x) * 4;
            img.data[i] = img.data[i + 1] = img.data[i + 2] = byte(L);
            img.data[i + 3] = 255;
          }
        }
        ctx.putImageData(img, 0, 0);
      },
    },
    {
      id: 'washi',
      name: 'Washi paper fibre',
      normalStrength: 0.3,
      // Cloudy pulp with long kozo fibres; each fibre is drawn at every wrap offset to stay seamless.
      draw(ctx, size, rand) {
        const img = ctx.createImageData(size, size);
        const cloud = wrapNoise(rand, 5, 5);
        const cloud2 = wrapNoise(rand, 13, 13);
        const grain = wrapNoise(rand, 90, 90);
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            const u = (x + 0.5) / size;
            const v = (y + 0.5) / size;
            const L = 0.9 + 0.035 * cloud(u, v) + 0.02 * cloud2(u, v) + 0.015 * grain(u, v);
            const i = (y * size + x) * 4;
            img.data[i] = img.data[i + 1] = img.data[i + 2] = byte(L);
            img.data[i + 3] = 255;
          }
        }
        ctx.putImageData(img, 0, 0);
        ctx.lineCap = 'round';
        for (let f = 0; f < 240; f++) {
          const x = rand() * size;
          const y = rand() * size;
          const a = rand() * TAU;
          const len = size * (0.04 + rand() * 0.16);
          const bend = (rand() - 0.5) * len * 0.6;
          const light = rand() < 0.6;
          ctx.strokeStyle = light ? `rgba(255,255,255,${(0.25 + rand() * 0.35).toFixed(3)})` : `rgba(150,140,120,${(0.08 + rand() * 0.12).toFixed(3)})`;
          ctx.lineWidth = size * (0.0015 + rand() * 0.003);
          const ex = x + Math.cos(a) * len;
          const ey = y + Math.sin(a) * len;
          const mx = (x + ex) / 2 - Math.sin(a) * bend;
          const my = (y + ey) / 2 + Math.cos(a) * bend;
          for (const ox of [-size, 0, size]) {
            for (const oy of [-size, 0, size]) {
              ctx.beginPath();
              ctx.moveTo(x + ox, y + oy);
              ctx.quadraticCurveTo(mx + ox, my + oy, ex + ox, ey + oy);
              ctx.stroke();
            }
          }
        }
      },
    },
    {
      id: 'seigaiha',
      name: 'Seigaiha waves (indigo)',
      normalStrength: 0.3,
      colored: true,
      // Overlapping fans of concentric arcs in cream on an unevenly dyed indigo cotton.
      draw(ctx, size, rand) {
        const img = ctx.createImageData(size, size);
        const R = size / 8;
        const rings = 4;
        const lw = R * 0.028;
        const ground = [0.15, 0.22, 0.38];
        const ink = [0.93, 0.9, 0.82];
        const dye = wrapNoise(rand, 4, 4);
        const dye2 = wrapNoise(rand, 16, 16);
        const step = R / rings;
        for (let y = 0; y < size; y++) {
          const py = y + 0.5;
          for (let x = 0; x < size; x++) {
            const px = x + 0.5;
            // The visible fan is the lowest row whose disc covers the point (later rows overlap earlier).
            let dist = R;
            const j1 = Math.floor(py / R) + 1;
            for (const j of [j1, j1 - 1]) {
              const off = j % 2 === 1 ? R : 0;
              const cx = off + 2 * R * Math.round((px - off) / (2 * R));
              const dd = Math.hypot(px - cx, py - j * R);
              if (dd < R) {
                dist = dd;
                break;
              }
            }
            const nr = Math.round(dist / step);
            let cov: number;
            if (nr === 0) cov = clamp(step * 0.5 - dist + 0.5, 0, 1);
            else cov = clamp(lw + 0.5 - Math.abs(dist - nr * step), 0, 1);
            if (dist > R - lw * 2) cov = Math.max(cov, clamp((dist - (R - lw * 2)) / 1.2, 0, 1));
            const u = px / size;
            const v = py / size;
            const tint = 1 + 0.09 * dye(u, v) + 0.04 * dye2(u, v);
            const weave = 1 + 0.035 * Math.sin((TAU * px * 170) / size) * Math.sin((TAU * py * 170) / size);
            const i = (y * size + x) * 4;
            for (let c = 0; c < 3; c++) img.data[i + c] = byte((ground[c] * tint * (1 - cov) + ink[c] * cov) * weave);
            img.data[i + 3] = 255;
          }
        }
        ctx.putImageData(img, 0, 0);
      },
    },
  ],
  materials: [
    { id: 'igusa-tatami', name: 'Igusa tatami', category: 'rug', color: '#cbbf84', roughness: 0.85, pattern: { id: 'igusa', scale: 0.25 } },
    { id: 'tatami-heri', name: 'Tatami border cloth', category: 'fabric', color: '#1f2633', roughness: 0.7, pattern: { id: 'weave', scale: 0.05, contrast: 0.6 } },
    { id: 'hinoki', name: 'Hinoki cypress', category: 'wood', color: '#e6cfa6', roughness: 0.6, pattern: { id: 'hinoki-grain', scale: 0.5 } },
    { id: 'sugi-cedar', name: 'Sugi cedar', category: 'wood', color: '#b8875a', roughness: 0.62, pattern: { id: 'hinoki-grain', scale: 0.45, contrast: 1.2 } },
    { id: 'keyaki', name: 'Keyaki elm', category: 'wood', color: '#7a4e30', roughness: 0.4, pattern: { id: 'hinoki-grain', scale: 0.6, contrast: 1.1 } },
    { id: 'bamboo', name: 'Bamboo', category: 'wood', color: '#c9ad6e', roughness: 0.45, pattern: { id: 'hinoki-grain', scale: 0.3, contrast: 0.6 } },
    { id: 'urushi-black', name: 'Black urushi lacquer', category: 'wood', color: '#1c1614', roughness: 0.2 },
    { id: 'urushi-red', name: 'Negoro red lacquer', category: 'wood', color: '#8e2a1f', roughness: 0.22, pattern: { id: 'hinoki-grain', scale: 0.4, contrast: 0.3 } },
    { id: 'shoji-washi', name: 'Shoji washi paper', category: 'solid', color: '#f4efe2', roughness: 0.9, pattern: { id: 'washi', scale: 0.6 } },
    { id: 'andon-glow', name: 'Lit washi', category: 'solid', color: '#fff0d4', roughness: 0.85, emissive: '#ffcf8a', emissiveIntensity: 1.8, pattern: { id: 'washi', scale: 0.5 } },
    { id: 'kotatsu-glow', name: 'Kotatsu heater glow', category: 'solid', color: '#ff9a62', roughness: 0.6, emissive: '#ff5a1f', emissiveIntensity: 1.4 },
    { id: 'seigaiha-indigo', name: 'Seigaiha indigo cotton', category: 'fabric', color: '#ffffff', roughness: 0.9, pattern: { id: 'seigaiha', scale: 0.3 } },
    { id: 'aizome-indigo', name: 'Aizome indigo cotton', category: 'fabric', color: '#283a5e', roughness: 0.9, pattern: { id: 'weave', scale: 0.1, contrast: 0.6 } },
    { id: 'beni-cotton', name: 'Beni red cotton', category: 'fabric', color: '#8f2d2a', roughness: 0.85, pattern: { id: 'weave', scale: 0.1, contrast: 0.55 } },
    { id: 'kotatsu-quilt', name: 'Kotatsu quilt', category: 'fabric', color: '#a65b3c', roughness: 0.92, pattern: { id: 'weave', scale: 0.14, contrast: 0.7 } },
    { id: 'futon-cotton', name: 'Futon cotton', category: 'fabric', color: '#f2ede2', roughness: 0.95, pattern: { id: 'weave', scale: 0.08, contrast: 0.4 } },
    { id: 'sobagara', name: 'Buckwheat pillow cover', category: 'fabric', color: '#cdb98f', roughness: 0.95, pattern: { id: 'jute', scale: 0.06, contrast: 0.6 } },
    { id: 'tassel-silk', name: 'Gold silk thread', category: 'fabric', color: '#c8a24a', roughness: 0.5 },
    { id: 'mikan-peel', name: 'Mikan peel', category: 'solid', color: '#e8892a', roughness: 0.55, pattern: { id: 'leather', scale: 0.03, contrast: 0.8 } },
    { id: 'kakejiku-silk', name: 'Kakejiku brocade', category: 'fabric', color: '#8a7a52', roughness: 0.6, pattern: { id: 'weave', scale: 0.04, contrast: 0.5 } },
    { id: 'sumi-ink', name: 'Sumi ink', category: 'solid', color: '#1d1c1b', roughness: 0.8 },
    { id: 'bonsai-glaze', name: 'Bonsai pot glaze', category: 'solid', color: '#3f5a70', roughness: 0.22 },
    { id: 'bonsai-bark', name: 'Old bark', category: 'wood', color: '#5c4a3b', roughness: 0.95, pattern: { id: 'wood-grain', scale: 0.08 } },
    { id: 'pine-foliage', name: 'Pine needles', category: 'solid', color: '#3d5a2c', roughness: 0.8, pattern: { id: 'boucle', scale: 0.06 } },
    { id: 'bonsai-moss', name: 'Moss', category: 'solid', color: '#5e7a32', roughness: 0.95, pattern: { id: 'boucle', scale: 0.06 } },
    { id: 'maneki-porcelain', name: 'White porcelain', category: 'solid', color: '#f7f4ee', roughness: 0.15 },
    { id: 'shu-red', name: 'Shu vermilion', category: 'solid', color: '#c0332b', roughness: 0.35 },
    { id: 'kin-gold', name: 'Gold leaf', category: 'metal', color: '#d6ac4a', roughness: 0.28, metalness: 1 },
    { id: 'shimenawa-straw', name: 'Rice straw rope', category: 'fabric', color: '#d8c58a', roughness: 0.95, pattern: { id: 'jute', scale: 0.06 } },
    { id: 'sakaki-leaf', name: 'Sakaki leaves', category: 'solid', color: '#2f5530', roughness: 0.55 },
    { id: 'tokoname-clay', name: 'Tokoname red clay', category: 'solid', color: '#a5502e', roughness: 0.55 },
    { id: 'hagi-glaze', name: 'Hagi glaze', category: 'solid', color: '#e3d2c0', roughness: 0.25 },
    { id: 'sencha', name: 'Sencha', category: 'glass', color: '#a7b24a', roughness: 0.05, opacity: 0.85 },
  ],
});

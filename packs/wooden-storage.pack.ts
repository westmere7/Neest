/**
 * Wooden storage & beds — solid-wood pieces with real joinery.
 *
 * A mahogany sleigh bed with scrolled head- and footboards, a Vietnamese tủ chè tea cabinet with
 * carved panels and a tea set behind glass, a Welsh dresser with plates on its rack, a carved
 * wedding armoire on bun feet, a rocking spindle cradle, a stack of fruit crates used as shelves,
 * a slat divider growing out of a planter, a Japanese kaidan-dansu staircase chest, a cheval
 * mirror, a slatted shoe bench and a quilt rack with blankets. Counts (drawers, plates, spindles,
 * crates, slats, cubbies) follow the size, and contents re-flow when an item is resized.
 *
 * Pack patterns: ribbon-figured grain (quarter-sawn mahogany), weathered crate boards with knots,
 * a carved relief of rosettes and vines (for carved panels) and a coloured patchwork quilt.
 */
import {
  blobCluster,
  bookRow,
  box,
  cells,
  cellSpans,
  clamp,
  cushion,
  cyl,
  defineItem,
  definePack,
  discZ,
  drapeFolds,
  foliage,
  frame4,
  knob,
  lathe,
  lerp,
  line,
  matSlot,
  pillow,
  pot,
  range,
  rectPoly,
  rng,
  rod,
  rodX,
  rodZ,
  shakerFront,
  slats,
  spaced,
  span,
  sphere,
  torus,
  turnedLeg,
  type Part,
  type V2,
} from '@/packs/kit';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const TAU = Math.PI * 2;
const NP = { plan: false } as const;

/** Detail box (hidden from the plan) spanning x/y/z ranges, with an optional bevel. */
const sp = (slot: string, x: V2, y: V2, z: V2, bevel = 0): Part =>
  span(slot, x, y, z, { bevel, plan: false });

/** A flat shape facing the front (+z): `pts` are [x, y] in metres, `t` thick from depth z. */
function facePlate(slot: string, pts: V2[], z: number, t: number): Part {
  const ys = pts.map((p) => p[1]);
  const xs = pts.map((p) => p[0]);
  const mid = (Math.min(...ys) + Math.max(...ys)) / 2;
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  return {
    shape: 'prism',
    outline: pts.map(([x, y]) => [x - cx, -(y - mid)] as V2),
    height: t,
    position: [cx, mid, z],
    rotation: [Math.PI / 2, 0, 0],
    slot,
    plan: false,
  };
}

/** A flat shape seen from the side: `pts` are [z, y], extruded `t` along +x from x. */
function sidePlate(slot: string, pts: V2[], x: number, t: number, plan = false): Part {
  const zs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const part: Part = {
    shape: 'prism',
    outline: pts.map(([z, y]) => [-(y - cy), z - cz] as V2),
    height: t,
    position: [x, cy, cz],
    rotation: [0, 0, -Math.PI / 2],
    slot,
  };
  if (!plan) part.plan = false;
  return part;
}

/** A moulding or board between two points in the XY plane, spanning depth z; `ext` lengthens it to close mitres. */
function beamXY(slot: string, a: V2, b: V2, z: V2, t: number, ext = 0): Part {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) + ext;
  return box(slot, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (z[0] + z[1]) / 2], [len, t, z[1] - z[0]], {
    rotation: [0, 0, Math.atan2(b[1] - a[1], b[0] - a[0])],
    plan: false,
  });
}

/** Offsets a polyline both ways by `half` (along its normals) into a closed band outline. */
function band(pts: V2[], half: number): V2[] {
  const left: V2[] = [];
  const right: V2[] = [];
  for (const i of range(pts.length)) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = -(b[1] - a[1]) / len;
    const ny = (b[0] - a[0]) / len;
    left.push([pts[i][0] + nx * half, pts[i][1] + ny * half]);
    right.push([pts[i][0] - nx * half, pts[i][1] - ny * half]);
  }
  return [...left, ...right.reverse()];
}

/**
 * Tilts parts about a horizontal axis along x through (y = py, z = pz). Pre-multiplying by a
 * rotation about x merges with the leading X of a three.js 'XYZ' Euler, so any part rotates true.
 */
function tiltX(parts: Part[], t: number, py: number, pz: number): Part[] {
  const c = Math.cos(t);
  const s = Math.sin(t);
  return parts.map((p) => {
    const [x, y, z] = p.position;
    const dy = y - py;
    const dz = z - pz;
    const r = p.rotation ?? [0, 0, 0];
    return {
      ...p,
      position: [x, py + dy * c - dz * s, pz + dy * s + dz * c],
      rotation: [r[0] + t, r[1], r[2]],
    };
  });
}

/** Points of an arch-topped opening (rectangle with a semicircular head), counter-clockwise. */
function archOutline(x0: number, x1: number, y0: number, y1: number, n = 14): V2[] {
  const r = (x1 - x0) / 2;
  const cx = (x0 + x1) / 2;
  const ya = Math.max(y0 + 0.02, y1 - r);
  const pts: V2[] = [
    [x0, y0],
    [x1, y0],
  ];
  for (const i of range(n + 1)) {
    const a = (i / n) * Math.PI;
    pts.push([cx + Math.cos(a) * r, ya + Math.sin(a) * r]);
  }
  return pts;
}

/** Rosette facing the front: `petals` lobes around (x, y), outer radius R. */
function rosette(slot: string, x: number, y: number, R: number, z: number, t: number, petals = 8): Part {
  const pts: V2[] = range(48).map((i) => {
    const a = (i / 48) * TAU;
    const rr = R * (0.62 + 0.38 * Math.abs(Math.cos((petals / 2) * a)));
    return [x + Math.cos(a) * rr, y + Math.sin(a) * rr];
  });
  return facePlate(slot, pts, z, t);
}

/** Symmetric scalloped apron with outward-curling feet at both ends, as [a, y] (a across, y up). */
function apronOutline(len: number, legH: number, lw: number): V2[] {
  const W = len / 2;
  const left: V2[] = [
    [-W, legH],
    [-W, legH * 0.6],
    [-W - 0.006, legH * 0.35],
    [-W - 0.01, legH * 0.12],
    [-W - 0.004, 0],
    [-W + lw * 0.85, 0],
    [-W + lw * 0.8, legH * 0.12],
    [-W + lw * 0.7, legH * 0.3],
    [-W + lw * 0.85, legH * 0.5],
  ];
  const xa = -W + lw + 0.01;
  const m = 18;
  for (const i of range(m + 1)) {
    const x = xa + (-xa * i) / m;
    const sc = Math.abs(Math.sin((Math.PI * 3 * (x - xa)) / -xa));
    left.push([x, legH * 0.62 + legH * 0.18 * sc - legH * 0.32 * Math.exp(-((x / 0.05) ** 2))]);
  }
  const right = left
    .slice(0, -1)
    .reverse()
    .map(([x, y]) => [-x, y] as V2);
  return [...left, ...right];
}

/** One standing plate (disc facing the front, leaning back by `lean`), centred at (x, y, z). */
const plate = (slot: string, x: number, y: number, z: number, r: number, lean = 0.15, t = 0.012): Part =>
  cyl(slot, [x, y, z], r, t, { rotation: [Math.PI / 2 - lean, 0, 0], segments: 28, plan: false });

/** A pair of shoes side by side, toes to the front: sneakers (sole + upper) or leather shoes. */
function shoePair(
  upper: string,
  sole: string,
  cx: number,
  y0: number,
  zc: number,
  len: number,
  kind: 'sneaker' | 'oxford',
): Part[] {
  const sw = Math.min(0.088, len * 0.34);
  const parts: Part[] = [];
  for (const s of [-1, 1]) {
    const x = cx + s * (sw / 2 + 0.008);
    const zz = zc + s * 0.012;
    const turn = s * 0.06;
    const soleT = kind === 'sneaker' ? 0.022 : 0.014;
    parts.push(
      box(sole, [x, y0 + soleT / 2, zz], [sw, soleT, len], {
        bevel: soleT * 0.45,
        rotation: [0, turn, 0],
        plan: false,
      }),
    );
    const uh = kind === 'sneaker' ? 0.07 : 0.06;
    parts.push(
      sphere(upper, [x, y0 + soleT + uh * 0.32, zz - len * 0.05], 0.5, {
        scale: [sw * 0.92, uh, len * 0.9],
        rotation: [0, turn, 0],
        plan: false,
      }),
    );
  }
  return parts;
}

// ---------------------------------------------------------------------------
// 1. Sleigh bed
// ---------------------------------------------------------------------------

function sleighGeom(w: number, d: number, h: number) {
  const R = 0.06;
  const kH = 0.15;
  const yH = h - R;
  const zH = (y: number): number => -d / 2 + R + kH * (1 - (y / yH) ** 2);
  const hF = clamp(h * 0.62, 0.6, 0.8);
  const Rf = 0.05;
  const kF = 0.13;
  const yF = hF - Rf;
  const zF = (y: number): number => d / 2 - Rf - kF * (1 - (y / yF) ** 2);
  const mx: V2 = [-w / 2 + 0.065, w / 2 - 0.065];
  const mz: V2 = [zH(0.45) + 0.03, zF(0.45) - 0.03];
  const deck = 0.32;
  const top = 0.56;
  const duvetStart = mz[0] + clamp((mz[1] - mz[0]) * 0.28, 0.4, 0.6);
  return { R, yH, zH, hF, Rf, yF, zF, mx, mz, deck, top, duvetStart };
}

const sleighBed = defineItem({
  id: 'sleigh-bed',
  name: 'Sleigh bed',
  category: 'bedroom',
  type: 'beds',
  group: 'Beds',
  tags: [
    'bed',
    'sleigh bed',
    'scroll',
    'mahogany',
    'solid wood',
    'double',
    'queen',
    'classic',
    'giường gỗ',
    'giường cổ điển',
  ],
  defaultSize: { w: 1.75, d: 2.3, h: 1.15 },
  minSize: { w: 1.0, d: 2.1, h: 0.95 },
  maxSize: { w: 2.15, d: 2.45, h: 1.35 },
  wallSnap: true,
  slots: [
    matSlot('frame', 'Frame', 'mahogany'),
    matSlot('bedding', 'Mattress, sheets & pillows', 'fabric-white-cotton'),
    matSlot('duvet', 'Duvet', 'fabric-cream'),
    matSlot('accent', 'Throw & cushion', 'fabric-terracotta'),
  ],
  build: ({ w, d, h }) => {
    const G = sleighGeom(w, d, h);
    const { R, yH, zH, Rf, yF, zF, mx, mz, deck, top, duvetStart } = G;
    const parts: Part[] = [];
    const ft = 0.055;
    const ys = (y0: number, y1: number, n: number): number[] =>
      range(n + 1).map((i) => y0 + ((y1 - y0) * i) / n);

    // Headboard: side frames curving back into a rolled scroll, a full-width panel between them.
    const headLine = ys(0, yH, 14).map((y) => [zH(y), y] as V2);
    const headPanel = ys(0.26, yH, 12).map((y) => [zH(y), y] as V2);
    parts.push(
      sidePlate('frame', band(headLine, 0.045), -w / 2, ft),
      sidePlate('frame', band(headLine, 0.045), w / 2 - ft, ft),
      sidePlate('frame', band(headPanel, 0.014), -w / 2 + ft, w - 2 * ft),
      rodX('frame', -w / 2 + 0.01, w / 2 - 0.01, yH, zH(yH), R * 0.9),
      rodX('frame', -w / 2 + ft, w / 2 - ft, 0.27, zH(0.27), 0.024, NP),
    );
    // Footboard: lower, scrolling out towards the foot.
    const footLine = ys(0, yF, 12).map((y) => [zF(y), y] as V2);
    const footPanel = ys(0.26, yF, 10).map((y) => [zF(y), y] as V2);
    parts.push(
      sidePlate('frame', band(footLine, 0.04), -w / 2, ft),
      sidePlate('frame', band(footLine, 0.04), w / 2 - ft, ft),
      sidePlate('frame', band(footPanel, 0.014), -w / 2 + ft, w - 2 * ft),
      rodX('frame', -w / 2 + 0.01, w / 2 - 0.01, yF, zF(yF), Rf * 0.9),
      rodX('frame', -w / 2 + ft, w / 2 - ft, 0.27, zF(0.27), 0.022, NP),
    );
    // Scroll ends: full-radius end caps with a turned rosette on the outer faces.
    for (const s of [-1, 1]) {
      for (const [y, z, r] of [
        [yH, zH(yH), R],
        [yF, zF(yF), Rf],
      ] as [number, number, number][]) {
        parts.push(rodX('frame', s > 0 ? w / 2 - 0.03 : -w / 2, s > 0 ? w / 2 : -w / 2 + 0.03, y, z, r, NP));
        parts.push(
          torus('frame', [s * (w / 2 - 0.004), y, z], r * 0.55, r * 0.12, {
            rotation: [0, Math.PI / 2, 0],
            plan: false,
          }),
        );
        parts.push(
          sphere('frame', [s * (w / 2 - 0.008), y, z], r * 0.3, { scale: [0.5, 1, 1], plan: false }),
        );
      }
    }

    // Side rails with a swelling lower edge and a bead along the top.
    const zA = zH(0.33) + 0.03;
    const zB = zF(0.33) - 0.03;
    const rail: V2[] = [
      [zA, 0.46],
      [zB, 0.46],
      ...range(13).map((i) => {
        const s = 1 - i / 12;
        return [lerp(zA, zB, s), 0.26 - 0.05 * Math.sin(Math.PI * s)] as V2;
      }),
    ];
    for (const x of [-w / 2 + 0.012, w / 2 - 0.047]) {
      parts.push(sidePlate('frame', rail, x, 0.035, true));
      parts.push(rodZ('frame', x + 0.0175, 0.46, zA, zB, 0.013, NP));
    }

    // Slat deck, mattress and bedding.
    parts.push(sp('frame', [mx[0] - 0.02, mx[1] + 0.02], [deck - 0.02, deck], mz));
    parts.push(
      ...slats(
        'frame',
        [mx[0] - 0.02, mx[1] + 0.02],
        [deck - 0.045, deck - 0.02],
        mz,
        clamp(Math.round((mz[1] - mz[0]) / 0.12), 8, 18),
        { axis: 'z', gap: 0.45, plan: false },
      ),
    );
    parts.push(cushion('bedding', mx, [deck, top], mz, { softness: 0.25 }));
    const [m0, m1] = mx;
    parts.push(
      cushion('duvet', [m0 - 0.015, m1 + 0.015], [top - 0.01, top + 0.05], [duvetStart, mz[1] + 0.015], {
        softness: 0.4,
        plan: false,
      }),
      cushion('duvet', [m0 - 0.02, m1 + 0.02], [top + 0.04, top + 0.085], [duvetStart, duvetStart + 0.24], {
        softness: 0.45,
        plan: false,
      }),
      cushion(
        'bedding',
        [m0 - 0.005, m1 + 0.005],
        [top + 0.075, top + 0.092],
        [duvetStart + 0.02, duvetStart + 0.12],
        { softness: 0.45, plan: false },
      ),
    );
    for (const s of [-1, 1]) {
      const x: V2 = s < 0 ? [m0 - 0.027, m0 - 0.007] : [m1 + 0.007, m1 + 0.027];
      parts.push(sp('duvet', x, [0.47, top + 0.04], [duvetStart + 0.03, mz[1]], 0.008));
    }
    const mw = m1 - m0;
    const n = mw >= 1.2 ? 2 : 1;
    const pw = n === 1 ? Math.min(0.66, mw - 0.1) : Math.min(0.68, mw / 2 - 0.05);
    for (const px of cells(n, m0, m1)) {
      parts.push(pillow('bedding', [px, top + 0.16, mz[0] + 0.14], pw, 0.36, 0.14, { lean: 0.45 }));
    }
    parts.push(
      pillow('accent', [0, top + 0.13, mz[0] + 0.31], Math.min(0.45, mw * 0.4), 0.28, 0.12, { lean: 0.3 }),
    );
    // Folded throw across the foot, hanging down both sides.
    const tz: V2 = [mz[1] - 0.5, mz[1] - 0.14];
    parts.push(
      cushion('accent', [m0 - 0.03, m1 + 0.03], [top + 0.045, top + 0.07], tz, {
        softness: 0.4,
        plan: false,
      }),
    );
    parts.push(
      sp('accent', [m0 - 0.04, m0 - 0.026], [0.48, top + 0.07], tz, 0.006),
      sp('accent', [m1 + 0.026, m1 + 0.04], [0.48, top + 0.07], tz, 0.006),
    );
    return parts;
  },
  planDetail: ({ w, d, h }) => {
    const { mx, mz, duvetStart } = sleighGeom(w, d, h);
    return [
      rectPoly(mx[0], mz[0], mx[1], mz[1]),
      line([mx[0], duvetStart], [mx[1], duvetStart]),
      line([mx[0], duvetStart + 0.24], [mx[1], duvetStart + 0.24]),
    ];
  },
});

// ---------------------------------------------------------------------------
// 2. Tủ chè — Vietnamese tea display cabinet
// ---------------------------------------------------------------------------

const tuChe = defineItem({
  id: 'tu-che',
  name: 'Tủ chè tea display cabinet',
  category: 'living',
  type: 'storage',
  group: 'Sideboards & cabinets',
  tags: [
    'tủ chè',
    'tea cabinet',
    'tea set',
    'display cabinet',
    'glass',
    'carved',
    'gỗ gụ',
    'indochine',
    'vietnamese',
    'sideboard',
    'ấm chén',
  ],
  defaultSize: { w: 1.6, d: 0.45, h: 1.05 },
  minSize: { w: 1.1, d: 0.38, h: 0.85 },
  maxSize: { w: 2.2, d: 0.55, h: 1.3 },
  wallSnap: true,
  slots: [
    matSlot('wood', 'Gụ wood', 'gu-ribbon'),
    matSlot('carved', 'Carved panels', 'carved-gu'),
    matSlot('glass', 'Glass', 'glass-clear'),
    matSlot('ceramic', 'Tea set & vases', 'ceramic-white'),
  ],
  build: ({ w, d, h }) => {
    const parts: Part[] = [];
    const legH = 0.13;
    const yT = clamp(h * 0.48, 0.42, 0.6);
    const zc = d / 2 - 0.045;
    const zf = zc + 0.022;
    const wi = w / 2 - 0.03;

    // Base: a scalloped apron with curled "chân quỳ" feet on the front and both sides.
    parts.push(facePlate('wood', apronOutline(w - 0.024, legH, 0.075), d / 2 - 0.05, 0.03));
    const side = apronOutline(d - 0.024, legH, 0.06);
    parts.push(sidePlate('wood', side, -w / 2 + 0.004, 0.03), sidePlate('wood', side, w / 2 - 0.034, 0.03));
    // Lower carcass and the top board that doubles as the display floor.
    parts.push(span('wood', [-w / 2 + 0.02, w / 2 - 0.02], [legH, yT], [-d / 2 + 0.015, zc]));
    parts.push(span('wood', [-w / 2, w / 2], [yT, yT + 0.03], [-d / 2, d / 2], { bevel: 0.006 }));

    // Drawer row with applied carved bands and turned knobs.
    const yD0 = yT - 0.115;
    const nDr = w > 1.85 ? 4 : 3;
    for (const [a, b] of cellSpans(nDr, -wi, wi)) {
      parts.push(sp('wood', [a + 0.003, b - 0.003], [yD0, yT - 0.006], [zc, zf], 0.003));
      parts.push(sp('carved', [a + 0.035, b - 0.035], [yD0 + 0.022, yT - 0.028], [zf, zf + 0.004], 0.002));
      parts.push(...knob('wood', [(a + b) / 2, (yD0 + yT) / 2 - 0.003, zf + 0.004], 0.012));
    }
    // Cupboard: fixed carved side panels and a pair of carved doors in the middle.
    const yc: V2 = [legH + 0.008, yD0 - 0.01];
    const sb = clamp(w * 0.24, 0.25, 0.45);
    for (const x of [
      [-wi, -wi + sb],
      [wi - sb, wi],
    ] as V2[]) {
      parts.push(...frame4('wood', x, yc, [zc, zf], 0.045));
      parts.push(
        sp(
          'carved',
          [x[0] + 0.04, x[1] - 0.04],
          [yc[0] + 0.04, yc[1] - 0.04],
          [zc + 0.004, zc + 0.016],
          0.003,
        ),
      );
    }
    for (const [i, x] of cellSpans(2, -wi + sb + 0.006, wi - sb - 0.006).entries()) {
      const a = x[0] + 0.002;
      const b = x[1] - 0.002;
      parts.push(...frame4('wood', [a, b], yc, [zc, zf], 0.045));
      parts.push(
        sp('carved', [a + 0.04, b - 0.04], [yc[0] + 0.04, yc[1] - 0.04], [zc + 0.004, zc + 0.016], 0.003),
      );
      parts.push(...knob('wood', [i === 0 ? b - 0.025 : a + 0.025, (yc[0] + yc[1]) / 2, zf], 0.011));
    }

    // Glass display case.
    const cx = w / 2 - 0.05;
    const cz0 = -d / 2 + 0.03;
    const cz1 = d / 2 - 0.06;
    const yC0 = yT + 0.03;
    const yC1 = h - 0.13;
    const ps = 0.035;
    for (const x of [-cx, cx - ps]) {
      for (const z of [cz0, cz1 - ps])
        parts.push(sp('wood', [x, x + ps], [yC0, yC1 - 0.03], [z, z + ps], 0.003));
    }
    parts.push(
      sp('wood', [-cx + ps, cx - ps], [yC0, yC1 - 0.03], [cz0, cz0 + 0.012]),
      sp('glass', [-cx + 0.012, -cx + 0.018], [yC0 + 0.01, yC1 - 0.035], [cz0 + ps, cz1 - ps]),
      sp('glass', [cx - 0.018, cx - 0.012], [yC0 + 0.01, yC1 - 0.035], [cz0 + ps, cz1 - ps]),
      span('wood', [-cx - 0.01, cx + 0.01], [yC1 - 0.03, yC1], [cz0 - 0.01, cz1 + 0.012], {
        bevel: 0.004,
        plan: false,
      }),
      span('wood', [-cx - 0.025, cx + 0.025], [yC1, yC1 + 0.035], [cz0 - 0.015, cz1 + 0.025], {
        bevel: 0.008,
        plan: false,
      }),
      // Sliding-door tracks.
      sp('wood', [-cx + ps, cx - ps], [yC0, yC0 + 0.022], [cz1 - 0.04, cz1]),
      sp('wood', [-cx + ps, cx - ps], [yC1 - 0.055, yC1 - 0.03], [cz1 - 0.04, cz1]),
    );
    // Sliding glass doors on two tracks, overlapping.
    const nP = clamp(Math.round((2 * cx) / 0.5), 2, 4);
    const py: V2 = [yC0 + 0.022, yC1 - 0.055];
    for (const [i, [a, b]] of cellSpans(nP, -cx + ps, cx - ps).entries()) {
      const z = cz1 - 0.036 + (i % 2) * 0.017;
      const x: V2 = [a - (i > 0 ? 0.012 : 0), b + (i < nP - 1 ? 0.012 : 0)];
      parts.push(...frame4('wood', x, py, [z, z + 0.014], 0.024));
      parts.push(
        sp('glass', [x[0] + 0.022, x[1] - 0.022], [py[0] + 0.022, py[1] - 0.022], [z + 0.006, z + 0.009]),
      );
    }
    // Carved crest (diềm) on the cornice.
    const cw = Math.min(w * 0.55, 0.95);
    const yk = yC1 + 0.035;
    const crest: V2[] = [
      [cw / 2, yk],
      [-cw / 2, yk],
    ];
    for (const i of range(25)) {
      const u = -1 + (2 * i) / 24;
      const f = 0.25 + 0.45 * Math.cos((Math.PI * u) / 2) ** 2 + 0.3 * Math.cos(1.5 * Math.PI * u) ** 2;
      crest.push([(u * cw) / 2, yk + (h - yk) * clamp(f, 0, 1)]);
    }
    parts.push(facePlate('carved', crest, cz1, 0.02));

    // Contents: a two-step riser with standing plates, the tea set on a tray, a vase and a caddy.
    const ih = py[1] - yC0;
    const k = clamp(ih / 0.3, 0.6, 1.1);
    const zr = cz0 + 0.012;
    const rw = cx * 0.62;
    parts.push(
      sp('wood', [-rw, rw], [yC0, yC0 + ih * 0.2], [zr, zr + 0.1], 0.003),
      sp('wood', [-rw, rw], [yC0, yC0 + ih * 0.4], [zr, zr + 0.05], 0.003),
    );
    const pr = Math.min(0.07, ih * 0.27);
    for (const x of [-cx * 0.32, cx * 0.32])
      parts.push(plate('ceramic', x, yC0 + ih * 0.4 + pr + 0.003, zr + 0.026, pr, 0.15, 0.01));
    parts.push(plate('ceramic', 0, yC0 + ih * 0.2 + pr * 0.8 + 0.003, zr + 0.076, pr * 0.8, 0.15, 0.01));
    const front = cz1 - 0.04;
    const tz = (zr + 0.1 + front) / 2;
    const tr = Math.min(0.13 * k, (front - zr - 0.1) / 2 - 0.004);
    const y0 = yC0 + 0.016;
    parts.push(cyl('wood', [0, yC0 + 0.008, tz], tr, 0.016, { segments: 28, plan: false }));
    parts.push(
      lathe(
        'ceramic',
        [0, y0, tz],
        [
          [0, 0],
          [0.03 * k, 0],
          [0.05 * k, 0.022 * k],
          [0.048 * k, 0.045 * k],
          [0.028 * k, 0.062 * k],
          [0, 0.062 * k],
        ],
        { segments: 24, plan: false },
      ),
      sphere('ceramic', [0, y0 + 0.068 * k, tz], 0.008 * k, NP),
      rod('ceramic', [0.04 * k, y0 + 0.022 * k, tz], [0.075 * k, y0 + 0.055 * k, tz], 0.006 * k, NP),
      torus('ceramic', [-0.055 * k, y0 + 0.034 * k, tz], 0.016 * k, 0.004 * k, NP),
    );
    const rho = Math.max(0.05 * k, tr - 0.024 * k);
    for (const i of range(4)) {
      const a = Math.PI * 0.25 + (i * Math.PI) / 2;
      parts.push(
        lathe(
          'ceramic',
          [Math.cos(a) * rho, y0, tz + Math.sin(a) * rho * 0.9],
          [
            [0, 0],
            [0.011 * k, 0],
            [0.019 * k, 0.026 * k],
            [0.017 * k, 0.026 * k],
            [0.009 * k, 0.004 * k],
          ],
          { segments: 16, plan: false },
        ),
      );
    }
    const vh = Math.min(0.26, ih * 0.82);
    parts.push(
      lathe(
        'ceramic',
        [-(cx - 0.09), yC0, tz],
        [
          [0, 0],
          [0.03, 0],
          [0.05, vh * 0.3],
          [0.044, vh * 0.55],
          [0.016, vh * 0.78],
          [0.014, vh * 0.94],
          [0.022, vh],
          [0, vh],
        ],
        { segments: 24, plan: false },
      ),
    );
    const jh = Math.min(0.13, ih * 0.45);
    parts.push(
      lathe(
        'ceramic',
        [cx - 0.09, yC0, tz],
        [
          [0, 0],
          [0.03, 0],
          [0.048, jh * 0.42],
          [0.04, jh * 0.8],
          [0.026, jh * 0.86],
          [0.026, jh * 0.93],
          [0.01, jh],
          [0, jh],
        ],
        { segments: 24, plan: false },
      ),
      sphere('ceramic', [cx - 0.09, yC0 + jh + 0.006, tz], 0.01, NP),
    );
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w / 2 + 0.05, d / 2 - 0.06], [w / 2 - 0.05, d / 2 - 0.06])],
});

// ---------------------------------------------------------------------------
// 3. Welsh dresser
// ---------------------------------------------------------------------------

function welshGeom(d: number, h: number) {
  const yB = clamp(h * 0.44, 0.8, 0.92);
  const dr = clamp(d * 0.5, 0.2, 0.3);
  const yR1 = h - 0.12;
  const nS = clamp(Math.floor((yR1 - yB) / 0.27) - 1, 2, 3);
  const gap = (yR1 - yB) / (nS + 1);
  return { yB, dr, yR1, nS, gap };
}

const welshDresser = defineItem({
  id: 'welsh-dresser',
  name: 'Welsh dresser',
  category: 'dining',
  type: 'storage',
  group: 'Sideboards & cabinets',
  tags: [
    'welsh dresser',
    'kitchen dresser',
    'hutch',
    'plate rack',
    'plates',
    'farmhouse',
    'oak',
    'cupboard',
    'country',
    'tủ bát',
  ],
  defaultSize: { w: 1.5, d: 0.5, h: 2.0 },
  minSize: { w: 1.0, d: 0.42, h: 1.7 },
  maxSize: { w: 2.2, d: 0.6, h: 2.3 },
  wallSnap: true,
  slots: [
    matSlot('wood', 'Oak', 'aged-oak'),
    matSlot('plates', 'Plates', 'ceramic-blue'),
    matSlot('cups', 'Jugs & cups', 'ceramic-white'),
    matSlot('metal', 'Knobs & hooks', 'metal-brass'),
  ],
  build: ({ w, d, h }) => {
    const { yB, dr, yR1, nS, gap } = welshGeom(d, h);
    const parts: Part[] = [];
    const pl = 0.09;
    const zc = d / 2 - 0.04;
    const zf = zc + 0.022;
    const xi = w / 2 - 0.03;

    // Base: plinth with a bracket-foot cut-out, carcass and worktop.
    const W = w / 2 - 0.006;
    const plinth: V2[] = [
      [-W, pl],
      [-W, 0],
      [-W + 0.07, 0],
      ...range(5).map((i) => {
        const a = (i / 4) * (Math.PI / 2);
        return [-W + 0.07 + Math.sin(a) * 0.05, pl * 0.45 * (1 - Math.cos(a))] as V2;
      }),
      [W - 0.12, pl * 0.45],
      ...range(5).map((i) => {
        const a = (i / 4) * (Math.PI / 2);
        return [W - 0.07 - Math.cos(a) * 0.05, pl * 0.45 * (1 - Math.sin(a))] as V2;
      }),
      [W - 0.07, 0],
      [W, 0],
      [W, pl],
    ];
    parts.push(facePlate('wood', plinth, d / 2 - 0.042, 0.022));
    parts.push(span('wood', [-w / 2 + 0.01, w / 2 - 0.01], [0, pl], [-d / 2 + 0.01, d / 2 - 0.042]));
    parts.push(
      span('wood', [-w / 2 + 0.01, w / 2 - 0.01], [pl, yB - 0.03], [-d / 2 + 0.01, zc], { plan: false }),
    );
    parts.push(span('wood', [-w / 2, w / 2], [yB - 0.03, yB], [-d / 2, d / 2], { bevel: 0.006 }));
    // Drawers over cupboard doors.
    const yD: V2 = [yB - 0.2, yB - 0.036];
    const nDr = clamp(Math.round(w / 0.5), 2, 4);
    for (const [a, b] of cellSpans(nDr, -xi, xi)) {
      parts.push(sp('wood', [a + 0.002, b - 0.002], yD, [zc, zf], 0.004));
      parts.push(...knob('metal', [(a + b) / 2, (yD[0] + yD[1]) / 2, zf], 0.013));
    }
    const nDoor = w > 1.75 ? 3 : 2;
    const yd: V2 = [pl + 0.01, yD[0] - 0.012];
    for (const [i, [a, b]] of cellSpans(nDoor, -xi, xi).entries()) {
      parts.push(
        ...shakerFront('wood', [a + 0.002, b - 0.002], yd, zc, 0.022, { rail: 0.065, recess: 0.008 }),
      );
      const kx = nDoor === 3 && i === 1 ? b - 0.04 : i % 2 === 0 ? b - 0.04 : a + 0.04;
      parts.push(...knob('metal', [kx, (yd[0] + yd[1]) / 2 + 0.05, zf], 0.013));
    }

    // Plate rack: shaped sides, boarded back, shelves with plate rails, frieze and cornice.
    const zb = -d / 2;
    const zr = zb + dr;
    const sideP: V2[] = [
      [zb, yB],
      [zb, yR1],
      [zr, yR1],
      ...range(9).map((i) => {
        const t = 1 - i / 8;
        return [zr - dr * 0.3 * (1 - t) ** 2, yB + 0.2 * t] as V2;
      }),
    ];
    parts.push(
      sidePlate('wood', sideP, -w / 2 + 0.01, 0.022),
      sidePlate('wood', sideP, w / 2 - 0.032, 0.022),
    );
    const nB = clamp(Math.round((w - 0.06) / 0.15), 4, 12);
    parts.push(
      ...slats('wood', [-w / 2 + 0.032, w / 2 - 0.032], [yB, yR1], [zb, zb + 0.012], nB, {
        axis: 'x',
        gap: 0.025,
        plan: false,
      }),
    );
    const pr = Math.min(0.115, (gap - 0.045) / 2);
    const pitch = 2 * pr + 0.03;
    const nPl = Math.max(1, Math.floor((2 * xi - 0.04) / pitch));
    const xs = spaced(nPl, -xi + 0.02 + pr, xi - 0.02 - pr);
    for (const s of range(nS)) {
      const y = yB + (s + 1) * gap;
      parts.push(sp('wood', [-w / 2 + 0.032, w / 2 - 0.032], [y - 0.022, y], [zb + 0.012, zr - 0.01], 0.003));
      parts.push(rodX('wood', -w / 2 + 0.032, w / 2 - 0.032, y + pr * 0.55, zb + 0.09, 0.007, NP));
      for (const [i, x] of xs.entries()) {
        const big = (i + s) % 2 === 0;
        const r = big ? pr : pr * 0.86;
        parts.push(plate(big ? 'plates' : 'cups', x, y + r + 0.002, zb + 0.045, r, 0.17));
      }
    }
    // Scalloped frieze under the cornice.
    const nSc = clamp(Math.round(w / 0.16), 4, 14);
    const fx = w / 2 - 0.032;
    const frieze: V2[] = [
      [fx, yR1],
      [-fx, yR1],
      ...range(nSc * 4 + 1).map((i) => {
        const u = i / (nSc * 4);
        return [-fx + 2 * fx * u, yR1 - 0.05 - 0.035 * Math.abs(Math.sin(Math.PI * nSc * u))] as V2;
      }),
    ];
    parts.push(facePlate('wood', frieze, zr - 0.02, 0.018));
    parts.push(
      span('wood', [-w / 2 + 0.005, w / 2 - 0.005], [yR1, h - 0.035], [zb, zr + 0.015], {
        bevel: 0.004,
        plan: false,
      }),
    );
    parts.push(span('wood', [-w / 2, w / 2], [h - 0.035, h], [zb, zr + 0.04], { bevel: 0.008, plan: false }));

    // Teacups hanging on brass hooks along the first shelf.
    const yU = yB + gap - 0.022;
    const nC = clamp(Math.floor((2 * xi) / 0.22), 2, 6);
    for (const x of spaced(nC, -xi + 0.12, xi - 0.12)) {
      const zh = zr - 0.045;
      const cy = yU - 0.03 - 0.034 - 0.012;
      parts.push(rod('metal', [x, yU, zh], [x, yU - 0.028, zh], 0.0022, NP));
      parts.push(torus('cups', [x, yU - 0.035, zh], 0.013, 0.0035, NP));
      parts.push(
        lathe(
          'cups',
          [x, cy - 0.025, zh],
          [
            [0, 0],
            [0.022, 0],
            [0.034, 0.05],
            [0.031, 0.05],
            [0.019, 0.006],
          ],
          { segments: 18, rotation: [0, 0, Math.PI / 2], plan: false },
        ),
      );
    }
    // On the worktop: a platter at the back, a jug, a crock and two mugs.
    const zw = zb + 0.05;
    const pw = Math.min(0.17, (gap - 0.12) / 2);
    parts.push(plate('plates', 0, yB + pw + 0.002, zw, pw, 0.2, 0.014));
    const jx = -xi + 0.16;
    const jz = zr + 0.06;
    parts.push(
      lathe(
        'cups',
        [jx, yB, jz],
        [
          [0, 0],
          [0.05, 0],
          [0.065, 0.06],
          [0.055, 0.14],
          [0.045, 0.17],
          [0.055, 0.2],
          [0.05, 0.2],
        ],
        { segments: 24, plan: false },
      ),
      torus('cups', [jx - 0.065, yB + 0.12, jz], 0.035, 0.007, {
        arc: Math.PI,
        rotation: [0, 0, Math.PI / 2],
        plan: false,
      }),
      rod('cups', [jx + 0.045, yB + 0.19, jz], [jx + 0.068, yB + 0.205, jz], 0.012, NP),
    );
    const kx = xi - 0.14;
    parts.push(
      lathe(
        'cups',
        [kx, yB, jz],
        [
          [0, 0],
          [0.07, 0],
          [0.08, 0.1],
          [0.068, 0.15],
          [0.06, 0.15],
        ],
        { segments: 24, plan: false },
      ),
      lathe(
        'cups',
        [kx, yB + 0.15, jz],
        [
          [0.064, 0],
          [0.066, 0.012],
          [0.02, 0.025],
          [0.012, 0.04],
          [0, 0.04],
        ],
        { segments: 24, plan: false },
      ),
    );
    for (const x of [-0.14, 0.14]) {
      if (Math.abs(x) + 0.05 > kx - 0.09) continue;
      parts.push(
        lathe(
          'cups',
          [x, yB, jz + 0.04],
          [
            [0, 0],
            [0.036, 0],
            [0.038, 0.09],
            [0.034, 0.09],
            [0.032, 0.008],
          ],
          { segments: 18, plan: false },
        ),
        torus('cups', [x + 0.042, yB + 0.045, jz + 0.04], 0.022, 0.005, {
          arc: Math.PI,
          rotation: [0, 0, -Math.PI / 2],
          plan: false,
        }),
      );
    }
    return parts;
  },
  planDetail: ({ w, d, h }) => {
    const { dr } = welshGeom(d, h);
    return [
      line([-w / 2, -d / 2 + dr], [w / 2, -d / 2 + dr]),
      line([-w / 2 + 0.03, d / 2 - 0.02], [w / 2 - 0.03, d / 2 - 0.02]),
    ];
  },
});

// ---------------------------------------------------------------------------
// 4. Carved wedding armoire
// ---------------------------------------------------------------------------

const weddingArmoire = defineItem({
  id: 'wedding-armoire',
  name: 'Carved wedding armoire',
  category: 'bedroom',
  type: 'storage',
  group: 'Wardrobes',
  tags: [
    'armoire',
    'armoire de mariage',
    'wedding',
    'carved',
    'provincial',
    'french',
    'normandy',
    'wardrobe',
    'bun feet',
    'cornice',
    'tủ áo gỗ',
  ],
  defaultSize: { w: 1.4, d: 0.62, h: 2.2 },
  minSize: { w: 1.1, d: 0.5, h: 1.9 },
  maxSize: { w: 1.8, d: 0.72, h: 2.5 },
  wallSnap: true,
  slots: [
    matSlot('wood', 'Oak', 'provincial-oak'),
    matSlot('carved', 'Carving', 'carved-oak'),
    matSlot('metal', 'Hinges & escutcheon', 'metal-brass'),
  ],
  build: ({ w, d, h }) => {
    const parts: Part[] = [];
    const zc = d / 2 - 0.05;
    const zf = zc + 0.024;
    const yC = h - 0.25;
    const yb = 0.22;
    // Bun feet, base moulding and a carved apron with a shell pendant.
    for (const x of [-w / 2 + 0.07, w / 2 - 0.07]) {
      for (const z of [-d / 2 + 0.07, d / 2 - 0.07])
        parts.push(turnedLeg('wood', x, z, 0, 0.12, 0.055, { style: 'bun' }));
    }
    parts.push(
      span('wood', [-w / 2 + 0.01, w / 2 - 0.01], [0.12, yb], [-d / 2 + 0.01, d / 2 - 0.02], {
        bevel: 0.012,
      }),
    );
    const aw = w / 2 - 0.14;
    const apron: V2[] = [
      [aw, yb],
      [-aw, yb],
      ...range(25).map((i) => {
        const u = -1 + (2 * i) / 24;
        const y = 0.13 + 0.035 * Math.abs(Math.sin(Math.PI * 2 * u)) - 0.06 * Math.exp(-((u / 0.16) ** 2));
        return [u * aw, Math.min(y, yb - 0.02)] as V2;
      }),
    ];
    parts.push(facePlate('carved', apron, d / 2 - 0.02, 0.014));
    // Carcass.
    parts.push(span('wood', [-w / 2 + 0.03, w / 2 - 0.03], [yb, yC], [-d / 2 + 0.02, zc]));
    // Fluted corner pilasters with blocks at top and bottom.
    const pw = 0.08;
    for (const s of [-1, 1]) {
      const x: V2 = s < 0 ? [-w / 2 + 0.03, -w / 2 + 0.03 + pw] : [w / 2 - 0.03 - pw, w / 2 - 0.03];
      parts.push(sp('wood', x, [yb, yC], [zc, zf], 0.004));
      for (const fx of spaced(3, x[0] + 0.02, x[1] - 0.02))
        parts.push(rod('carved', [fx, yb + 0.12, zf], [fx, yC - 0.12, zf], 0.006, NP));
      parts.push(sp('wood', [x[0] - 0.006, x[1] + 0.006], [yb, yb + 0.08], [zc, zf + 0.008], 0.004));
      parts.push(sp('wood', [x[0] - 0.006, x[1] + 0.006], [yC - 0.08, yC], [zc, zf + 0.008], 0.004));
    }
    // Two doors: arched upper panel, carved rosette on the mid rail, a raised lower panel.
    const xd = w / 2 - 0.03 - pw;
    const dy: V2 = [yb + 0.015, yC - 0.015];
    const yM = dy[0] + (dy[1] - dy[0]) * 0.34;
    const rail = 0.075;
    for (const [i, [a0, b0]] of cellSpans(2, -xd, xd).entries()) {
      const a = a0 + 0.002;
      const b = b0 - 0.002;
      parts.push(...frame4('wood', [a, b], dy, [zc, zf], rail));
      parts.push(sp('wood', [a + rail, b - rail], [yM - 0.05, yM + 0.05], [zc, zf]));
      parts.push(sp('wood', [a + rail, b - rail], [dy[0] + rail, dy[1] - rail], [zc, zc + 0.01]));
      const top = dy[1] - rail - 0.02;
      parts.push(
        facePlate(
          'carved',
          archOutline(a + rail + 0.02, b - rail - 0.02, yM + 0.07, top, 16),
          zc + 0.008,
          0.012,
        ),
      );
      parts.push(
        sp(
          'carved',
          [a + rail + 0.02, b - rail - 0.02],
          [dy[0] + rail + 0.02, yM - 0.07],
          [zc + 0.008, zc + 0.02],
          0.006,
        ),
      );
      parts.push(rosette('carved', (a + b) / 2, yM, 0.04, zf, 0.008));
      // Long fiche hinges on the outer stile, escutcheon and latch on the meeting stile.
      const hx = i === 0 ? a + 0.008 : b - 0.008;
      for (const hy of [dy[0] + 0.2, dy[1] - 0.2])
        parts.push(
          cyl('metal', [hx, hy, zf + 0.004], 0.006, 0.14, NP),
          sphere('metal', [hx, hy + 0.075, zf + 0.004], 0.008, NP),
        );
      if (i === 1) {
        const ey = Math.min(1.15, yM + 0.25);
        parts.push(facePlate('metal', archOutline(a + 0.012, a + 0.042, ey - 0.12, ey + 0.1, 8), zf, 0.003));
        parts.push(...knob('metal', [a + 0.027, ey - 0.15, zf], 0.012));
      }
    }
    // Stepped cornice with a carved frieze, dentils and an arched crest.
    parts.push(
      sp('wood', [-w / 2 + 0.02, w / 2 - 0.02], [yC, yC + 0.045], [-d / 2 + 0.01, zf + 0.012], 0.004),
      span('wood', [-w / 2 + 0.008, w / 2 - 0.008], [yC + 0.045, yC + 0.1], [-d / 2 + 0.005, d / 2 - 0.012], {
        bevel: 0.012,
        plan: false,
      }),
      span('wood', [-w / 2, w / 2], [yC + 0.1, yC + 0.14], [-d / 2, d / 2], { bevel: 0.01, plan: false }),
      facePlate(
        'carved',
        [
          [-w / 2 + 0.06, yC + 0.055],
          [w / 2 - 0.06, yC + 0.055],
          [w / 2 - 0.06, yC + 0.092],
          [-w / 2 + 0.06, yC + 0.092],
        ],
        d / 2 - 0.012,
        0.008,
      ),
    );
    const nDent = clamp(Math.round((w - 0.1) / 0.05), 10, 34);
    for (const x of spaced(nDent, -w / 2 + 0.05, w / 2 - 0.05))
      parts.push(sp('wood', [x - 0.011, x + 0.011], [yC + 0.01, yC + 0.04], [zf + 0.012, zf + 0.026]));
    const cw = Math.min(w * 0.6, 0.85);
    const yk = yC + 0.14;
    const crest: V2[] = [
      [cw / 2, yk],
      [-cw / 2, yk],
    ];
    for (const i of range(29)) {
      const u = -1 + (2 * i) / 28;
      const f =
        0.18 + 0.82 * Math.max(0, 1 - u * u) ** 1.5 + 0.2 * Math.exp(-(((Math.abs(u) - 0.72) / 0.09) ** 2));
      crest.push([(u * cw) / 2, yk + (h - yk) * clamp(f, 0, 1)]);
    }
    parts.push(facePlate('carved', crest, d / 2 - 0.04, 0.022));
    return parts;
  },
  planDetail: ({ w, d }) => [
    line([-w / 2 + 0.03, d / 2 - 0.026], [w / 2 - 0.03, d / 2 - 0.026]),
    line([0, d / 2 - 0.05], [0, d / 2 - 0.026]),
  ],
});

// ---------------------------------------------------------------------------
// 5. Rocking spindle cradle
// ---------------------------------------------------------------------------

const cradle = defineItem({
  id: 'rocking-cradle',
  name: 'Rocking spindle cradle',
  category: 'kids',
  type: 'beds',
  group: 'Cots & kids beds',
  tags: [
    'cradle',
    'baby',
    'crib',
    'nursery',
    'rocking',
    'spindles',
    'newborn',
    'nôi gỗ',
    'nôi em bé',
    'wooden',
  ],
  defaultSize: { w: 1.0, d: 0.58, h: 0.85 },
  minSize: { w: 0.8, d: 0.48, h: 0.7 },
  maxSize: { w: 1.2, d: 0.7, h: 1.0 },
  slots: [
    matSlot('frame', 'Frame', 'wood-cherry'),
    matSlot('mattress', 'Mattress & pillow', 'mattress-white'),
    matSlot('quilt', 'Quilt', 'patchwork-quilt'),
  ],
  build: ({ w, d, h }) => {
    const parts: Part[] = [];
    const xP = w / 2 - 0.035;
    const zP = d / 2 - 0.1;
    const yBot = clamp(h * 0.36, 0.26, 0.36);
    const yR = Math.min(yBot + 0.38, h - 0.1);
    const yPost = h - 0.05;
    // Crescent rockers under each end, tied by a turned stretcher.
    const rockTop = (z: number): number => 0.12 + 0.02 * (z / (d / 2)) ** 2;
    const rocker: V2[] = [
      ...range(13).map((i) => {
        const z = -d / 2 + (d * i) / 12;
        return [z, 0.07 * (z / (d / 2)) ** 2] as V2;
      }),
      ...range(13).map((i) => {
        const z = d / 2 - (d * i) / 12;
        return [z, rockTop(z)] as V2;
      }),
    ];
    for (const s of [-1, 1]) parts.push(sidePlate('frame', rocker, s * xP - 0.0175, 0.035, true));
    parts.push(rodX('frame', -xP, xP, 0.07, 0, 0.016, NP));
    // Turned corner posts with finials.
    for (const x of [-xP, xP]) {
      for (const z of [-zP, zP]) {
        parts.push(turnedLeg('frame', x, z, rockTop(z) - 0.01, yPost, 0.024, { style: 'spindle' }));
        parts.push(
          sphere('frame', [x, yPost + 0.022, z], 0.022, NP),
          lathe(
            'frame',
            [x, yPost - 0.004, z],
            [
              [0, 0],
              [0.018, 0],
              [0.012, 0.012],
              [0, 0.012],
            ],
            NP,
          ),
        );
      }
    }
    // Basket floor, long sides with turned spindles.
    parts.push(span('frame', [-xP, xP], [yBot - 0.02, yBot], [-zP, zP]));
    const sx: V2 = [-xP + 0.024, xP - 0.024];
    const nSp = clamp(Math.round((sx[1] - sx[0]) / 0.062), 8, 20);
    for (const z of [-zP, zP]) {
      parts.push(sp('frame', sx, [yBot - 0.035, yBot + 0.04], [z - 0.014, z + 0.014], 0.004));
      parts.push(rodX('frame', sx[0], sx[1], yR, z, 0.018, NP));
      for (const x of spaced(nSp, sx[0] + 0.035, sx[1] - 0.035))
        parts.push(turnedLeg('frame', x, z, yBot + 0.04, yR - 0.012, 0.011, { style: 'spindle' }));
    }
    // Head end: a solid panel with an arched top. Foot end: spindles under a rail.
    const head: V2[] = [
      [-zP + 0.02, yBot - 0.035],
      [zP - 0.02, yBot - 0.035],
      ...range(13).map((i) => {
        const z = zP - 0.02 - ((2 * zP - 0.04) * i) / 12;
        return [z, h - 0.065 - 0.12 * (z / zP) ** 2] as V2;
      }),
    ];
    parts.push(sidePlate('frame', head, -xP - 0.01, 0.02));
    // Six-lobed roundel applied to the inside of the head panel.
    const ry = (yR + h - 0.12) / 2;
    const roundel: V2[] = range(36).map((i) => {
      const a = (i / 36) * TAU;
      const rr = 0.06 * (0.62 + 0.38 * Math.abs(Math.cos(3 * a)));
      return [Math.cos(a) * rr, ry + Math.sin(a) * rr];
    });
    parts.push(sidePlate('frame', roundel, -xP + 0.01, 0.008));
    const zs: V2 = [-zP + 0.024, zP - 0.024];
    parts.push(
      sp('frame', [xP - 0.014, xP + 0.014], [yBot - 0.035, yBot + 0.04], zs, 0.004),
      rodZ('frame', xP, yR, zs[0], zs[1], 0.018, NP),
    );
    for (const z of spaced(clamp(Math.round((zs[1] - zs[0]) / 0.062), 3, 9), zs[0] + 0.035, zs[1] - 0.035)) {
      parts.push(turnedLeg('frame', xP, z, yBot + 0.04, yR - 0.012, 0.011, { style: 'spindle' }));
    }
    // Mattress, pillow and a patchwork quilt with its top turned down.
    const mx: V2 = [-xP + 0.022, xP - 0.022];
    const mz: V2 = [-zP + 0.02, zP - 0.02];
    parts.push(cushion('mattress', mx, [yBot, yBot + 0.09], mz, { softness: 0.3 }));
    parts.push(
      pillow('mattress', [mx[0] + 0.11, yBot + 0.115, 0], 0.17, 0.055, Math.min(0.3, mz[1] - mz[0] - 0.04)),
    );
    parts.push(
      cushion(
        'quilt',
        [mx[0] + 0.24, mx[1] - 0.01],
        [yBot + 0.085, yBot + 0.11],
        [mz[0] + 0.005, mz[1] - 0.005],
        { softness: 0.4, plan: false },
      ),
    );
    parts.push(
      cushion(
        'quilt',
        [mx[0] + 0.23, mx[0] + 0.34],
        [yBot + 0.105, yBot + 0.13],
        [mz[0] + 0.01, mz[1] - 0.01],
        { softness: 0.45, plan: false },
      ),
    );
    return parts;
  },
  planDetail: ({ w, d }) => {
    const xP = w / 2 - 0.035;
    const zP = d / 2 - 0.1;
    return [rectPoly(-xP, -zP, xP, zP)];
  },
});

// ---------------------------------------------------------------------------
// 6. Fruit crate shelving
// ---------------------------------------------------------------------------

function crateGrid(w: number, h: number) {
  const cols = clamp(Math.round(w / 0.5), 1, 3);
  const rows = clamp(Math.round(h / 0.32), 1, 5);
  return { cols, rows, cw: w / cols, ch: h / rows };
}

const crateShelving = defineItem({
  id: 'crate-shelving',
  name: 'Fruit crate shelving',
  category: 'living',
  type: 'storage',
  group: 'Bookcases & shelves',
  tags: [
    'crates',
    'fruit crate',
    'apple crate',
    'shelving',
    'bookcase',
    'rustic',
    'upcycled',
    'pine',
    'thùng gỗ',
    'kệ thùng',
  ],
  defaultSize: { w: 1.0, d: 0.32, h: 0.96 },
  minSize: { w: 0.45, d: 0.26, h: 0.3 },
  maxSize: { w: 1.55, d: 0.4, h: 1.6 },
  wallSnap: true,
  slots: [
    matSlot('crate', 'Crates', 'crate-pine'),
    matSlot('books', 'Books', 'book-mix'),
    matSlot('pot', 'Pots & jars', 'terracotta-pot'),
    matSlot('plant', 'Plants', 'plant-leaf'),
  ],
  build: ({ w, d, h }) => {
    const { cols, rows, cw, ch } = crateGrid(w, h);
    const parts: Part[] = [];
    const rand = rng(17);
    const te = 0.016;
    const tb = 0.012;
    const cellsInfo: { x: V2; y: V2; z: V2; r: number; c: number }[] = [];
    for (const r of range(rows)) {
      for (const c of range(cols)) {
        const jx = (rand() - 0.5) * 0.012;
        const jz = (rand() - 0.5) * 0.016;
        const x0 = -w / 2 + c * cw + 0.003 + jx;
        const x1 = x0 + cw - 0.006;
        const y0 = r * ch;
        const y1 = y0 + ch - 0.002;
        const z0 = -d / 2 + 0.01 + jz;
        const z1 = d / 2 - 0.01 + jz;
        // In plan: the top row's crates seen from above (their outer boards).
        const o = { plan: r === rows - 1 };
        const zm = (z0 + z1) / 2;
        const ym = (y0 + y1) / 2;
        parts.push(
          span('crate', [x0, x0 + te], [y0, y1], [z0, z1], o),
          span('crate', [x1 - te, x1], [y0, y1], [z0, z1], o),
          span('crate', [x0 + te, x1 - te], [y1 - tb, y1], [z0, z1], o),
          sp('crate', [x0 + te, x1 - te], [y0, y0 + tb], [z0, zm - 0.012]),
          sp('crate', [x0 + te, x1 - te], [y0, y0 + tb], [zm + 0.012, z1]),
          sp('crate', [x0 + te, x1 - te], [y0 + tb, ym - 0.016], [z0, z0 + tb]),
          sp('crate', [x0 + te, x1 - te], [ym + 0.016, y1 - tb], [z0, z0 + tb]),
        );
        cellsInfo.push({
          x: [x0 + te + 0.006, x1 - te - 0.006],
          y: [y0 + tb, y1 - tb],
          z: [z0 + tb, z1],
          r,
          c,
        });
      }
    }
    // Contents, chosen per crate and capped to keep the part count in check.
    for (const { x, y, z, r, c } of cellsInfo) {
      const kind = (r * 3 + c * 2 + ((r * c) % 2)) % 5;
      const seed = 31 + r * 7 + c * 13;
      const ih = y[1] - y[0];
      const id = z[1] - z[0];
      const cx = (x[0] + x[1]) / 2;
      const cz = (z[0] + z[1]) / 2;
      const room = 146 - parts.length;
      if (kind === 0 && room > 16) {
        parts.push(
          ...bookRow(
            'books',
            x,
            y[0],
            z[0] + 0.006,
            Math.min(0.27, ih - 0.02),
            Math.min(0.21, id - 0.03),
            seed,
            { fill: 0.72, minW: 0.026, maxW: 0.045, lean: true },
          ),
        );
      } else if ((kind === 1 || kind === 4) && room > 7) {
        const pr = Math.min(0.07, id / 2 - 0.02, (x[1] - x[0]) / 2 - 0.02);
        const ph = Math.min(0.12, ih * 0.4);
        const px = kind === 1 ? cx : x[0] + pr + 0.04;
        parts.push(pot('pot', [px, y[0], cz], pr, ph, kind === 1 ? 'taper' : 'cylinder', NP));
        if (kind === 1) {
          const br = Math.min(0.11, (ih - ph) / 2 - 0.01, id / 2 - 0.01);
          parts.push(...blobCluster('plant', [px, y[0] + ph + br * 0.85, cz], br, 5, seed));
        } else {
          parts.push(
            ...foliage(
              'plant',
              [px, y[0] + ph - 0.01, cz],
              Math.min(0.1, id / 2 - 0.01),
              Math.min(0.22, ih - ph - 0.02),
              6,
              seed,
              { spread: 0.75 },
            ),
          );
          const bw = Math.min(0.2, x[1] - px - pr - 0.05);
          if (bw > 0.1) {
            let yy = y[0];
            for (const i of range(3)) {
              const th = 0.03 + 0.01 * (i % 2);
              parts.push(
                sp(
                  'books',
                  [x[1] - bw - 0.01 + i * 0.006, x[1] - 0.01 - i * 0.004],
                  [yy, yy + th],
                  [cz - 0.09 + i * 0.01, cz + 0.07 - i * 0.008],
                  0.002,
                ),
              );
              yy += th;
            }
          }
        }
      } else if (kind === 2 && room > 4) {
        let yy = y[0];
        for (const i of range(3)) {
          const th = 0.028 + 0.012 * ((i + r) % 2);
          parts.push(
            sp(
              'books',
              [x[0] + 0.02 + i * 0.008, x[0] + 0.25 - i * 0.012],
              [yy, yy + th],
              [cz - 0.1 + i * 0.006, cz + 0.08 - i * 0.01],
              0.002,
            ),
          );
          yy += th;
        }
        const jx = Math.min(x[1] - 0.06, x[0] + 0.33);
        if (jx > x[0] + 0.28) {
          parts.push(
            lathe(
              'pot',
              [jx, y[0], cz],
              [
                [0, 0],
                [0.04, 0],
                [0.055, 0.06],
                [0.05, 0.12],
                [0.03, 0.15],
                [0.034, 0.17],
                [0.03, 0.17],
              ],
              { segments: 20, plan: false },
            ),
          );
        }
      }
    }
    return parts;
  },
  planDetail: ({ w, d, h }) => {
    const { cols, cw } = crateGrid(w, h);
    return range(cols - 1).map((i) => line([-w / 2 + (i + 1) * cw, -d / 2], [-w / 2 + (i + 1) * cw, d / 2]));
  },
});

// ---------------------------------------------------------------------------
// 7. Slat divider with planter
// ---------------------------------------------------------------------------

const slatDivider = defineItem({
  id: 'slat-divider-planter',
  name: 'Slat divider with planter',
  category: 'living',
  type: 'decor',
  group: 'Screens & dividers',
  tags: [
    'room divider',
    'slats',
    'screen',
    'planter',
    'partition',
    'japandi',
    'free-standing',
    'vách ngăn gỗ',
    'lam gỗ',
    'teak',
  ],
  defaultSize: { w: 1.2, d: 0.35, h: 1.9 },
  minSize: { w: 0.6, d: 0.28, h: 1.2 },
  maxSize: { w: 2.4, d: 0.45, h: 2.6 },
  slots: [
    matSlot('slats', 'Slats', 'wood-teak'),
    matSlot('planter', 'Planter', 'wood-teak'),
    matSlot('plant', 'Plants', 'plant-leaf'),
    matSlot('soil', 'Soil', 'plant-soil'),
  ],
  build: ({ w, d, h }) => {
    const parts: Part[] = [];
    const pH = clamp(h * 0.17, 0.26, 0.4);
    const t = 0.02;
    // Planter trough: recessed plinth, slatted cladding, end boards, rim caps and soil.
    parts.push(span('planter', [-w / 2 + 0.02, w / 2 - 0.02], [0, 0.04], [-d / 2 + 0.02, d / 2 - 0.02]));
    for (const s of [-1, 1]) {
      const z: V2 = s > 0 ? [d / 2 - t, d / 2] : [-d / 2, -d / 2 + t];
      parts.push(
        ...slats('planter', [-w / 2 + t, w / 2 - t], [0.04, pH - 0.02], z, 3, {
          axis: 'y',
          gap: 0.08,
          bevel: 0.003,
          plan: false,
        }),
      );
      parts.push(
        sp(
          'planter',
          [-w / 2, w / 2],
          [pH - 0.02, pH],
          s > 0 ? [d / 2 - 0.035, d / 2] : [-d / 2, -d / 2 + 0.035],
          0.004,
        ),
      );
      const x: V2 = s > 0 ? [w / 2 - t, w / 2] : [-w / 2, -w / 2 + t];
      parts.push(sp('planter', x, [0.04, pH - 0.02], [-d / 2, d / 2]));
      parts.push(
        sp(
          'planter',
          s > 0 ? [w / 2 - 0.035, w / 2] : [-w / 2, -w / 2 + 0.035],
          [pH - 0.02, pH],
          [-d / 2 + 0.035, d / 2 - 0.035],
          0.004,
        ),
      );
    }
    parts.push(sp('soil', [-w / 2 + t, w / 2 - t], [pH - 0.06, pH - 0.035], [-d / 2 + t, d / 2 - t]));
    // Screen: end posts, vertical slats rising out of the soil and a top rail.
    const post = 0.05;
    const xi: V2 = [-w / 2 + 0.03 + post, w / 2 - 0.03 - post];
    for (const x of [
      [-w / 2 + 0.03, xi[0]],
      [xi[1], w / 2 - 0.03],
    ] as V2[]) {
      parts.push(span('slats', x, [pH - 0.06, h - 0.045], [-0.03, 0.03]));
    }
    const sw = 0.032;
    const n = clamp(Math.round((xi[1] - xi[0]) / 0.072), 2, 30);
    for (const x of spaced(n, xi[0] + 0.03, xi[1] - 0.03))
      parts.push(span('slats', [x - sw / 2, x + sw / 2], [pH - 0.06, h - 0.045], [-0.0225, 0.0225]));
    parts.push(
      span('slats', [-w / 2 + 0.025, w / 2 - 0.025], [h - 0.045, h], [-0.035, 0.035], { bevel: 0.004 }),
    );
    // Plants on both sides of the screen: upright clumps alternating with soft mounds.
    const nP = clamp(Math.round(w / 0.38), 1, 6);
    const zc = (d / 2 + 0.025) / 2;
    const rz = (d / 2 - 0.025) / 2 - 0.004;
    for (const s of [-1, 1]) {
      for (const [i, x] of cells(nP, -w / 2 + 0.04, w / 2 - 0.04).entries()) {
        const seed = 101 + i * 17 + (s > 0 ? 7 : 0);
        if ((i + (s > 0 ? 1 : 0)) % 2 === 0) {
          parts.push(
            ...foliage('plant', [x, pH - 0.05, s * zc], rz, Math.min(0.55, h * 0.24), 6, seed, {
              spread: 0.45,
            }),
          );
        } else {
          parts.push(...blobCluster('plant', [x, pH - 0.04 + rz * 0.9, s * zc], rz * 1.05, 4, seed));
        }
      }
    }
    return parts;
  },
});

// ---------------------------------------------------------------------------
// 8. Kaidan-dansu staircase chest
// ---------------------------------------------------------------------------

const kaidanSteps = (w: number, h: number): number =>
  clamp(Math.min(Math.round(h / 0.3), Math.round(w / 0.28)), 4, 6);

const kaidanDansu = defineItem({
  id: 'kaidan-dansu',
  name: 'Kaidan-dansu staircase chest',
  category: 'living',
  type: 'storage',
  group: 'Dressers & chests',
  tags: [
    'kaidan-dansu',
    'kaidan tansu',
    '階段箪笥',
    'staircase chest',
    'tansu',
    'japanese',
    'drawers',
    'iron hardware',
    'steps',
    'edo',
  ],
  defaultSize: { w: 1.8, d: 0.45, h: 1.8 },
  minSize: { w: 1.2, d: 0.38, h: 1.2 },
  maxSize: { w: 2.4, d: 0.55, h: 2.2 },
  wallSnap: true,
  slots: [
    matSlot('wood', 'Carcass & treads', 'tansu-keyaki'),
    matSlot('fronts', 'Drawers & doors', 'tansu-keyaki'),
    matSlot('iron', 'Iron fittings', 'metal-black-matte'),
  ],
  build: ({ w, d, h }) => {
    const n = kaidanSteps(w, h);
    const cw = w / n;
    const rh = h / n;
    const tT = 0.032;
    const zc = d / 2 - 0.024;
    const zf = zc + 0.018;
    const parts: Part[] = [];
    const drawer = (x0: number, x1: number, y0: number, y1: number): void => {
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const rr = Math.min(0.03, (x1 - x0) * 0.12);
      parts.push(
        sp('fronts', [x0 + 0.004, x1 - 0.004], [y0, y1], [zc, zf], 0.002),
        sp('iron', [cx - rr - 0.012, cx + rr + 0.012], [cy - 0.002, cy + 0.014], [zf, zf + 0.003], 0.001),
        torus('iron', [cx, cy - 0.002, zf + 0.005], rr, 0.0035, {
          arc: Math.PI,
          rotation: [0, 0, Math.PI],
          plan: false,
        }),
        sp('iron', [x0 + 0.004, x0 + 0.03], [y1 - 0.026, y1], [zf, zf + 0.002]),
        sp('iron', [x1 - 0.03, x1 - 0.004], [y1 - 0.026, y1], [zf, zf + 0.002]),
      );
    };
    for (const j of range(n)) {
      const x0 = -w / 2 + j * cw;
      const x1 = x0 + cw;
      const yTop = (h * (n - j)) / n;
      const top = yTop - tT;
      const carcTop = j === 0 ? (n - 1) * rh : top;
      parts.push(span('wood', [x0, x1], [0, carcTop], [-d / 2, zc]));
      parts.push(span('wood', [x0, x1], [top, yTop], [-d / 2, d / 2], { bevel: 0.004, plan: false }));
      if (j === 0) {
        // Open cubby under the top tread, with a lidded box in it.
        parts.push(
          sp('wood', [x0, x0 + 0.02], [carcTop, top], [-d / 2, zc + 0.012]),
          sp('wood', [x1 - 0.02, x1], [carcTop, top], [-d / 2, zc + 0.012]),
          sp('wood', [x0 + 0.02, x1 - 0.02], [carcTop, top], [-d / 2, -d / 2 + 0.015]),
          sp(
            'fronts',
            [x0 + 0.05, Math.min(x1 - 0.05, x0 + 0.24)],
            [carcTop, carcTop + Math.min(0.1, rh * 0.4)],
            [-d / 2 + 0.05, Math.min(zc - 0.04, -d / 2 + 0.3)],
            0.006,
          ),
        );
      }
      for (const k of range(n - j)) {
        const y0 = k * rh + (k === 0 ? 0.03 : 0.003);
        const y1 = Math.min((k + 1) * rh, top) - 0.003;
        const tall = n - j >= 3;
        if (j === 0 && k === n - 1) continue;
        if (tall && j === 0 && k <= 1) {
          if (k === 1) continue;
          // Hinged door over two rows: framed, with strap hinges, a lock plate and a ring pull.
          const Y1 = 2 * rh - 0.003;
          const cy = (y0 + Y1) / 2;
          parts.push(sp('fronts', [x0 + 0.004, x1 - 0.004], [y0, Y1], [zc, zf], 0.002));
          parts.push(...frame4('fronts', [x0 + 0.004, x1 - 0.004], [y0, Y1], [zf, zf + 0.006], 0.035));
          for (const hy of [y0 + 0.08, Y1 - 0.08])
            parts.push(
              sp('iron', [x0 + 0.004, x0 + 0.075], [hy - 0.013, hy + 0.013], [zf + 0.006, zf + 0.009], 0.001),
            );
          parts.push(
            sp('iron', [x1 - 0.1, x1 - 0.03], [cy - 0.055, cy + 0.055], [zf + 0.006, zf + 0.009], 0.002),
          );
          parts.push(torus('iron', [x1 - 0.065, cy - 0.075, zf + 0.012], 0.02, 0.0035, NP));
          continue;
        }
        if (tall && j === 1 && k <= 1) {
          if (k === 1) continue;
          // Pair of sliding doors (the left one on the rear track).
          const Y1 = 2 * rh - 0.003;
          const cx = (x0 + x1) / 2;
          const cy = (y0 + Y1) / 2;
          for (const [i, x] of [
            [x0 + 0.004, cx + 0.012],
            [cx - 0.012, x1 - 0.004],
          ].entries() as IterableIterator<[number, V2]>) {
            const z = zc - 0.006 + i * 0.012;
            parts.push(sp('fronts', x, [y0, Y1], [z, z + 0.012], 0.002));
            parts.push(...frame4('fronts', x, [y0, Y1], [z + 0.012, z + 0.016], 0.03));
            const px = i === 0 ? x[0] + 0.045 : x[1] - 0.045;
            parts.push(discZ('iron', [px, cy, z + 0.017], 0.014, 0.003, NP));
          }
          continue;
        }
        drawer(x0, x1, y0, y1);
      }
    }
    return parts;
  },
  planDetail: ({ w, d, h }) => {
    const n = kaidanSteps(w, h);
    return range(n - 1).map((j) =>
      line([-w / 2 + ((j + 1) * w) / n, -d / 2], [-w / 2 + ((j + 1) * w) / n, d / 2]),
    );
  },
});

// ---------------------------------------------------------------------------
// 9. Cheval floor mirror
// ---------------------------------------------------------------------------

const chevalMirror = defineItem({
  id: 'cheval-mirror',
  name: 'Cheval floor mirror',
  category: 'bedroom',
  type: 'decor',
  group: 'Mirrors',
  tags: [
    'cheval',
    'mirror',
    'floor mirror',
    'dressing mirror',
    'tilting',
    'arched',
    'mahogany',
    'gương đứng',
    'standing mirror',
  ],
  defaultSize: { w: 0.72, d: 0.52, h: 1.75 },
  minSize: { w: 0.55, d: 0.4, h: 1.4 },
  maxSize: { w: 1.0, d: 0.65, h: 2.0 },
  slots: [
    matSlot('frame', 'Frame', 'mahogany'),
    matSlot('mirror', 'Mirror', 'glass-mirror'),
    matSlot('metal', 'Pivots', 'metal-brass'),
  ],
  build: ({ w, d, h }) => {
    const parts: Part[] = [];
    const xP = w / 2 - 0.05;
    const r = 0.024;
    const yTop = h - 0.07;
    // Trestle feet with pads, turned uprights with finials, a turned stretcher.
    const foot: V2[] = (
      [
        ...range(13).map((i) => {
          const z = -d / 2 + (d * i) / 12;
          return [z, 0.035 + 0.05 * Math.cos((Math.PI * z) / d) ** 2] as V2;
        }),
        [d / 2, 0],
        ...range(9).map((i) => {
          const u = i / 8;
          const z = d / 2 - 0.07 - u * (d - 0.14);
          return [z, 0.018 * Math.sin(Math.PI * u)] as V2;
        }),
        [-d / 2, 0],
      ] as V2[]
    ).reverse();
    const H = yTop - 0.07;
    for (const s of [-1, 1]) {
      parts.push(sidePlate('frame', foot, s * xP - 0.02, 0.04, true));
      parts.push(
        lathe(
          'frame',
          [s * xP, 0.07, 0],
          [
            [0, 0],
            [r, 0],
            [r, 0.05],
            [r * 0.75, 0.07],
            [r * 0.6, 0.12],
            [r * 0.55, H * 0.45],
            [r * 0.85, H * 0.5],
            [r * 0.55, H * 0.55],
            [r * 0.5, H * 0.93],
            [r * 0.85, H * 0.96],
            [r * 0.85, H],
            [0, H],
          ],
          { segments: 18, plan: false },
        ),
        lathe(
          'frame',
          [s * xP, yTop, 0],
          [
            [0, 0],
            [r * 0.85, 0],
            [r * 0.55, 0.02],
            [r, 0.042],
            [r * 0.45, 0.062],
            [r * 0.12, 0.07],
            [0, 0.07],
          ],
          { segments: 16, plan: false },
        ),
      );
    }
    parts.push(rodX('frame', -xP, xP, 0.2, 0, 0.014));
    parts.push(sphere('frame', [0, 0.2, 0], 0.024, { scale: [1.6, 1, 1], plan: false }));
    // Arch-topped mirror in a moulded frame, pivoting between the uprights.
    const mw = xP - r - 0.028;
    const yb = 0.3;
    const yt = h - 0.12;
    const py = (yb + yt) / 2;
    const fw = clamp(mw * 0.16, 0.035, 0.055);
    const m: Part[] = [
      facePlate('frame', archOutline(-mw, mw, yb, yt, 18), -0.014, 0.012),
      facePlate(
        'mirror',
        archOutline(-mw + fw * 0.8, mw - fw * 0.8, yb + fw * 0.8, yt - fw * 0.8, 18),
        -0.003,
        0.004,
      ),
    ];
    const c = archOutline(-mw + fw / 2, mw - fw / 2, yb + fw / 2, yt - fw / 2, 12);
    const loop = [...c, c[0]];
    for (const i of range(loop.length - 1)) {
      const a = loop[i];
      const b = loop[i + 1];
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.005) continue;
      const straight = Math.abs(b[0] - a[0]) < 1e-6 || Math.abs(b[1] - a[1]) < 1e-6;
      parts.push(
        ...tiltX([beamXY('frame', a, b, [-0.003, 0.016], fw, straight ? fw : fw * 0.35)], -0.08, py, -0.004),
      );
    }
    parts.push(...tiltX(m, -0.08, py, -0.004));
    for (const s of [-1, 1]) {
      parts.push(rodX('metal', s > 0 ? mw - 0.01 : -xP, s > 0 ? xP : -mw + 0.01, py, -0.004, 0.007, NP));
      parts.push(sphere('metal', [s * (w / 2 - 0.016), py, -0.004], 0.014, NP));
    }
    return parts;
  },
});

// ---------------------------------------------------------------------------
// 10. Slatted shoe bench
// ---------------------------------------------------------------------------

const shoeBench = defineItem({
  id: 'slatted-shoe-bench',
  name: 'Slatted shoe bench',
  category: 'storage',
  type: 'storage',
  group: 'Hallway storage',
  tags: [
    'shoe bench',
    'shoe rack',
    'entryway',
    'hallway',
    'bench',
    'slatted seat',
    'cubbies',
    'shoes',
    'genkan',
    'ghế để giày',
    'kệ giày',
  ],
  defaultSize: { w: 1.0, d: 0.36, h: 0.48 },
  minSize: { w: 0.6, d: 0.3, h: 0.42 },
  maxSize: { w: 1.6, d: 0.45, h: 0.55 },
  wallSnap: true,
  slots: [
    matSlot('wood', 'Oak', 'wood-oak-light'),
    matSlot('leather', 'Leather shoes', 'leather-tan'),
    matSlot('canvas', 'Sneakers', 'fabric-navy'),
    matSlot('sole', 'Soles', 'plastic-white'),
  ],
  build: ({ w, d, h }) => {
    const parts: Part[] = [];
    const te = 0.025;
    const ySeat = h - 0.03;
    // End panels with a cut-out between the feet.
    const end: V2[] = [
      [-d / 2, ySeat],
      [-d / 2, 0],
      [-d / 2 + 0.05, 0],
      ...range(9).map((i) => {
        const u = i / 8;
        return [-d / 2 + 0.05 + u * (d - 0.1), 0.035 * Math.sin(Math.PI * u)] as V2;
      }),
      [d / 2 - 0.05, 0],
      [d / 2, 0],
      [d / 2, ySeat],
    ];
    parts.push(sidePlate('wood', end, -w / 2, te, true), sidePlate('wood', end, w / 2 - te, te, true));
    // Slatted seat over front and back aprons.
    parts.push(
      ...slats('wood', [-w / 2, w / 2], [ySeat, h], [-d / 2, d / 2], clamp(Math.round(d / 0.065), 4, 7), {
        axis: 'z',
        gap: 0.18,
        bevel: 0.004,
      }),
    );
    const xi: V2 = [-w / 2 + te, w / 2 - te];
    parts.push(
      sp('wood', xi, [ySeat - 0.06, ySeat], [d / 2 - 0.04, d / 2 - 0.02]),
      sp('wood', xi, [ySeat - 0.06, ySeat], [-d / 2 + 0.008, -d / 2 + 0.028]),
    );
    // Back panel, floor shelf and middle shelf, cubby dividers.
    const yF: V2 = [0.045, 0.065];
    const yM0 = yF[1] + (ySeat - 0.06 - yF[1] - 0.018) / 2;
    const yM: V2 = [yM0, yM0 + 0.018];
    parts.push(
      sp('wood', xi, [yF[0], ySeat - 0.06], [-d / 2, -d / 2 + 0.008]),
      sp('wood', xi, yF, [-d / 2 + 0.008, d / 2 - 0.01]),
      sp('wood', xi, yM, [-d / 2 + 0.008, d / 2 - 0.02]),
    );
    const nC = clamp(Math.round((w - 0.05) / 0.32), 1, 5);
    const spans = cellSpans(nC, xi[0], xi[1]);
    for (const [a] of spans.slice(1)) {
      parts.push(sp('wood', [a - 0.009, a + 0.009], [yF[1], yM[0]], [-d / 2 + 0.008, d / 2 - 0.02]));
      parts.push(sp('wood', [a - 0.009, a + 0.009], [yM[1], ySeat - 0.06], [-d / 2 + 0.008, d / 2 - 0.04]));
    }
    // A pair of shoes in every cubby: sneakers and leather shoes in turn.
    const len = Math.min(0.27, d - 0.07);
    const zc = (-d / 2 + 0.008 + d / 2 - 0.03) / 2;
    for (const [i, [a, b]] of spans.entries()) {
      const cx = (a + b) / 2;
      for (const [row, y0] of [yF[1], yM[1]].entries()) {
        const sneaker = (i + row) % 2 === 0;
        parts.push(
          ...shoePair(
            sneaker ? 'canvas' : 'leather',
            sneaker ? 'sole' : 'leather',
            cx,
            y0,
            zc,
            len,
            sneaker ? 'sneaker' : 'oxford',
          ),
        );
      }
    }
    return parts;
  },
});

// ---------------------------------------------------------------------------
// 11. Quilt rack
// ---------------------------------------------------------------------------

const quiltRack = defineItem({
  id: 'quilt-rack',
  name: 'Quilt rack with blankets',
  category: 'bedroom',
  type: 'decor',
  group: 'Cushions & throws',
  tags: [
    'quilt rack',
    'blanket rack',
    'blankets',
    'throw',
    'patchwork',
    'quilt',
    'turned',
    'cherry',
    'giá treo chăn',
  ],
  defaultSize: { w: 0.9, d: 0.4, h: 0.85 },
  minSize: { w: 0.6, d: 0.3, h: 0.6 },
  maxSize: { w: 1.4, d: 0.5, h: 1.1 },
  slots: [
    matSlot('frame', 'Frame', 'wood-cherry'),
    matSlot('quilt', 'Quilt', 'patchwork-quilt'),
    matSlot('throw', 'Throw', 'fabric-mustard'),
    matSlot('folded', 'Folded blankets', 'fabric-linen'),
  ],
  build: ({ w, d, h }) => {
    const parts: Part[] = [];
    const xF = w / 2 - 0.02;
    const zP = d / 2 - 0.06;
    const yR = h - 0.12;
    // End frames: sled feet, turned posts, a shaped crest and a stretcher.
    const foot: V2[] = [
      [-d / 2, 0.06],
      [d / 2, 0.06],
      [d / 2, 0],
      ...range(7).map((i) => {
        const u = i / 6;
        return [d / 2 - 0.06 - u * (d - 0.12), 0.02 * Math.sin(Math.PI * u)] as V2;
      }),
      [-d / 2, 0],
    ];
    const zk = zP + 0.035;
    const crest: V2[] = [
      [-zk, h - 0.085],
      [zk, h - 0.085],
      ...range(11).map((i) => {
        const z = zk - (2 * zk * i) / 10;
        return [z, h - 0.03 + 0.03 * Math.cos((Math.PI * z) / (2 * zk)) ** 2] as V2;
      }),
    ];
    for (const s of [-1, 1]) {
      const x = s * xF;
      parts.push(sidePlate('frame', foot, x - 0.0175, 0.035, true));
      parts.push(sidePlate('frame', crest, x - 0.0125, 0.025));
      for (const z of [-zP, zP])
        parts.push(turnedLeg('frame', x, z, 0.055, h - 0.08, 0.019, { style: 'spindle' }));
      parts.push(sp('frame', [x - 0.0125, x + 0.0125], [0.13, 0.16], [-zP, zP], 0.003));
    }
    // Rails and the slatted lower shelf.
    parts.push(rodX('frame', -xF, xF, yR, zP, 0.014), rodX('frame', -xF, xF, yR, -zP, 0.014));
    parts.push(
      ...slats('frame', [-xF, xF], [0.16, 0.178], [-zP, zP], 3, {
        axis: 'z',
        gap: 0.3,
        bevel: 0.003,
        plan: false,
      }),
    );
    // Patchwork quilt over the front rail: long drop in front, short one behind.
    const qx: V2 = [-xF + 0.04, xF - 0.04];
    const Lf = (yR - 0.18) * 0.62;
    parts.push(rodX('quilt', qx[0], qx[1], yR, zP, 0.026, NP));
    parts.push(
      ...drapeFolds('quilt', qx, [yR - Lf, yR], zP + 0.021, Math.round((qx[1] - qx[0]) / 0.11), 0.018, {
        plan: false,
      }),
    );
    parts.push(sp('quilt', qx, [yR - Lf * 0.5, yR], [zP - 0.03, zP - 0.022], 0.003));
    // Knitted throw over the back rail, fringed at its hem.
    const tx: V2 = [-xF + 0.09, xF - 0.09];
    const Lb = (yR - 0.15) * 0.85;
    parts.push(rodX('throw', tx[0], tx[1], yR, -zP, 0.024, NP));
    parts.push(
      ...drapeFolds('throw', tx, [yR - Lb, yR], -zP - 0.02, Math.round((tx[1] - tx[0]) / 0.09), 0.016, {
        plan: false,
      }),
    );
    parts.push(sp('throw', tx, [yR - 0.12, yR], [-zP + 0.02, -zP + 0.028], 0.003));
    parts.push(
      ...slats(
        'throw',
        tx,
        [yR - Lb - 0.04, yR - Lb],
        [-zP - 0.024, -zP - 0.016],
        clamp(Math.round((tx[1] - tx[0]) / 0.03), 8, 26),
        { axis: 'x', gap: 0.55, plan: false },
      ),
    );
    // Folded blankets on the shelf.
    const bw = Math.min(0.5, 2 * xF - 0.12);
    const bd = Math.min(0.3, 2 * zP - 0.06);
    let y = 0.178;
    for (const i of range(3)) {
      const th = 0.042 + 0.008 * (i % 2);
      const jx = (i - 1) * 0.008;
      parts.push(
        cushion(i === 1 ? 'throw' : 'folded', [-bw / 2 + jx, bw / 2 + jx], [y, y + th], [-bd / 2, bd / 2], {
          softness: 0.4,
          plan: false,
        }),
      );
      y += th;
    }
    return parts;
  },
});

// ---------------------------------------------------------------------------
// Patterns
// ---------------------------------------------------------------------------

/** Periodic value noise on an N×N tile with px × py lattice cells (wraps seamlessly), in [-1, 1]. */
function tileNoise(N: number, px: number, py: number, rand: () => number): Float32Array {
  const PX = Math.max(1, Math.round(px));
  const PY = Math.max(1, Math.round(py));
  const lat = new Float32Array(PX * PY);
  for (let i = 0; i < lat.length; i++) lat[i] = rand() * 2 - 1;
  const axis = (P: number) => {
    const i0 = new Int32Array(N);
    const i1 = new Int32Array(N);
    const tt = new Float32Array(N);
    for (let x = 0; x < N; x++) {
      const u = ((x + 0.5) * P) / N;
      const i = Math.floor(u);
      const f = u - i;
      tt[x] = f * f * (3 - 2 * f);
      i0[x] = i % P;
      i1[x] = (i + 1) % P;
    }
    return { i0, i1, tt };
  };
  const ax = axis(PX);
  const ay = axis(PY);
  const out = new Float32Array(N * N);
  for (let y = 0; y < N; y++) {
    const r0 = ay.i0[y] * PX;
    const r1 = ay.i1[y] * PX;
    const ty = ay.tt[y];
    for (let x = 0; x < N; x++) {
      const a = lat[r0 + ax.i0[x]] + (lat[r1 + ax.i0[x]] - lat[r0 + ax.i0[x]]) * ty;
      const b = lat[r0 + ax.i1[x]] + (lat[r1 + ax.i1[x]] - lat[r0 + ax.i1[x]]) * ty;
      out[y * N + x] = a + (b - a) * ax.tt[x];
    }
  }
  return out;
}

/** A few octaves of tileNoise, roughly in [-1, 1]. */
function tileFbm(N: number, px: number, py: number, octaves: number, rand: () => number): Float32Array {
  const out = new Float32Array(N * N);
  let amp = 1;
  let total = 0;
  for (let o = 0; o < octaves; o++) {
    const n = tileNoise(N, px * 2 ** o, py * 2 ** o, rand);
    for (let i = 0; i < out.length; i++) out[i] += n[i] * amp;
    total += amp;
    amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

const smooth = (e0: number, e1: number, x: number): number => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Signed offset to the nearest integer (wraps a tile coordinate difference into [-0.5, 0.5]). */
const wrap = (a: number): number => a - Math.round(a);

/** Write a grey (luminance) field to the canvas. */
function putGrey(ctx: CanvasRenderingContext2D, N: number, L: Float32Array): void {
  const img = ctx.createImageData(N, N);
  for (let i = 0; i < L.length; i++) {
    const v = Math.round(clamp(L[i], 0, 1) * 255);
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

const ribbonGrain = {
  id: 'ribbon-grain',
  name: 'Ribbon-figured grain',
  normalStrength: 0.22,
  // Quarter-sawn mahogany: vertical grain with broad ribbon stripes that swap light and dark
  // along the board, fine fibre streaks and dashed pores.
  draw(ctx: CanvasRenderingContext2D, size: number, rand: () => number) {
    const N = size;
    const warp = tileFbm(N, 2, 3, 3, rand);
    const fibre = tileNoise(N, 160, 4, rand);
    const streak = tileFbm(N, 24, 2, 2, rand);
    const pores = tileNoise(N, 110, 28, rand);
    const L = new Float32Array(N * N);
    for (let y = 0; y < N; y++) {
      const v = (y + 0.5) / N;
      for (let x = 0; x < N; x++) {
        const i = y * N + x;
        const u = (x + 0.5) / N;
        const rib =
          Math.sin(TAU * (7 * u + 0.25 * warp[i])) *
          (0.55 + 0.45 * Math.sin(TAU * (2 * v + u + 0.15 * warp[i])));
        const pore = pores[i] > 0.6 ? (pores[i] - 0.6) * 0.35 : 0;
        L[i] = 0.84 + 0.07 * rib + 0.035 * streak[i] + 0.025 * fibre[i] - pore;
      }
    }
    putGrey(ctx, N, L);
  },
};

const crateBoards = {
  id: 'crate-boards',
  name: 'Weathered crate boards',
  normalStrength: 0.55,
  // Rough-sawn pine: horizontal growth rings bending round a few knots, grey weathering, raised
  // fibres and faint diagonal saw marks.
  draw(ctx: CanvasRenderingContext2D, size: number, rand: () => number) {
    const N = size;
    const warp = tileFbm(N, 3, 2, 3, rand);
    const fibre = tileNoise(N, 4, 180, rand);
    const weather = tileFbm(N, 4, 4, 3, rand);
    const speck = tileNoise(N, 150, 150, rand);
    const knots = range(3).map(() => [rand(), rand(), 0.025 + rand() * 0.025]);
    const L = new Float32Array(N * N);
    for (let y = 0; y < N; y++) {
      const v = (y + 0.5) / N;
      for (let x = 0; x < N; x++) {
        const i = y * N + x;
        const u = (x + 0.5) / N;
        let ph = 9 * v + 0.6 * warp[i];
        let knot = 0;
        for (const [kx, ky, kr] of knots) {
          const dd = Math.hypot(wrap(u - kx) * 0.55, wrap(v - ky));
          if (dd < kr * 4) ph += (kr * 4 - dd) * 7;
          knot = Math.max(knot, 1 - smooth(kr * 0.45, kr, dd));
        }
        const p = ph - Math.floor(ph);
        const late = smooth(0.6, 0.8, p) * (1 - smooth(0.86, 0.97, p));
        const saw = Math.sin(TAU * (14 * u + 3 * v));
        L[i] =
          0.86 -
          0.13 * late +
          0.05 * weather[i] +
          0.035 * fibre[i] +
          0.012 * saw -
          0.32 * knot -
          (speck[i] > 0.82 ? 0.04 : 0);
      }
    }
    putGrey(ctx, N, L);
  },
};

const carvedRelief = {
  id: 'carved-relief',
  name: 'Carved rosettes & vines',
  normalStrength: 1.3,
  // Raised carving (light) over a chiselled ground (dark): eight-petal rosettes with a grooved
  // centre, two waving vines and leaves with a carved midrib. Everything wraps, so it tiles.
  draw(ctx: CanvasRenderingContext2D, size: number, rand: () => number) {
    const N = size;
    const chisel = tileNoise(N, 48, 48, rand);
    const grain = tileNoise(N, 6, 120, rand);
    const vines: [number, number][] = [
      [0.25, 0.08],
      [0.75, -0.08],
    ];
    const leaves: [number, number, number][] = [];
    for (const [c0, a] of vines) {
      for (const k of range(4)) {
        const uL = k / 4 + 1 / 8;
        const side = k % 2 === 0 ? 1 : -1;
        const vL = c0 + a * Math.sin(TAU * uL) + side * 0.04;
        leaves.push([uL, vL, side * 0.5 + a * TAU * Math.cos(TAU * uL)]);
      }
    }
    const L = new Float32Array(N * N);
    for (let y = 0; y < N; y++) {
      const v = (y + 0.5) / N;
      for (let x = 0; x < N; x++) {
        const i = y * N + x;
        const u = (x + 0.5) / N;
        let H = 0;
        for (const [cx, cy] of [
          [0.5, 0.5],
          [0, 0],
        ]) {
          const dx = wrap(u - cx);
          const dy = wrap(v - cy);
          const r = Math.hypot(dx, dy);
          const th = Math.atan2(dy, dx);
          const Rp = 0.16 * (0.62 + 0.38 * Math.abs(Math.cos(4 * th)));
          let f = 1 - smooth(Rp - 0.014, Rp, r);
          f -= 0.55 * smooth(0.048, 0.056, r) * (1 - smooth(0.064, 0.072, r));
          if (r > 0.08 && r < Rp)
            f -= 0.3 * (1 - smooth(0, 0.005, Math.abs(Math.sin(4 * th + Math.PI / 2)) * r));
          H = Math.max(H, f);
        }
        for (const [c0, a] of vines) {
          const slope = a * TAU * Math.cos(TAU * u);
          const dist = Math.abs(wrap(v - c0 - a * Math.sin(TAU * u))) / Math.sqrt(1 + slope * slope);
          H = Math.max(H, 0.85 * (1 - smooth(0.011, 0.019, dist)));
        }
        for (const [uL, vL, ang] of leaves) {
          const dx = wrap(u - uL);
          const dy = wrap(v - vL);
          const ca = Math.cos(ang);
          const sa = Math.sin(ang);
          const lx = dx * ca + dy * sa;
          const ly = -dx * sa + dy * ca;
          const e = (lx / 0.05) ** 2 + (ly / 0.02) ** 2;
          if (e < 1.2) {
            let f = 0.9 * (1 - smooth(0.7, 1, e));
            if (e < 0.9) f -= 0.3 * (1 - smooth(0, 0.004, Math.abs(ly)));
            H = Math.max(H, f);
          }
        }
        const ground = 0.42 + 0.06 * chisel[i];
        const raised = 0.92 + 0.03 * grain[i];
        L[i] = lerp(ground, raised, clamp(H, 0, 1));
      }
    }
    putGrey(ctx, N, L);
  },
};

const patchwork = {
  id: 'patchwork',
  name: 'Patchwork quilt',
  normalStrength: 0.6,
  colored: true,
  // 6 × 6 blocks in faded cottons (plain, half-square triangles and four-patches) with puckered
  // seams, diagonal hand-quilting stitches and a soft weave.
  draw(ctx: CanvasRenderingContext2D, size: number, rand: () => number) {
    const N = size;
    const G = 6;
    const pal: [number, number, number][] = [
      [0.72, 0.36, 0.24],
      [0.93, 0.88, 0.78],
      [0.27, 0.35, 0.52],
      [0.85, 0.66, 0.3],
      [0.55, 0.62, 0.48],
      [0.8, 0.56, 0.55],
      [0.62, 0.44, 0.32],
    ];
    const pick = () => pal[Math.floor(rand() * pal.length) % pal.length];
    const blocks = range(G * G).map(() => ({
      a: pick(),
      b: pick(),
      kind: Math.floor(rand() * 3),
      flip: rand() < 0.5,
    }));
    const weave = tileNoise(N, 128, 128, rand);
    const mottle = tileFbm(N, 8, 8, 2, rand);
    const cream: [number, number, number] = [0.95, 0.92, 0.84];
    const img = ctx.createImageData(N, N);
    for (let y = 0; y < N; y++) {
      const gy = ((y + 0.5) / N) * G;
      const by = Math.floor(gy);
      const fy = gy - by;
      for (let x = 0; x < N; x++) {
        const i = y * N + x;
        const gx = ((x + 0.5) / N) * G;
        const bx = Math.floor(gx);
        const fx = gx - bx;
        const b = blocks[by * G + bx];
        let col = b.a;
        if (b.kind === 1 && (b.flip ? fx > fy : fx + fy > 1)) col = b.b;
        if (b.kind === 2 && fx < 0.5 !== fy < 0.5) col = b.b;
        const e = Math.min(fx, 1 - fx, fy, 1 - fy);
        let shade = 1 - 0.28 * (1 - smooth(0, 0.035, e));
        const t = (fx + fy) * 2;
        const onLine = Math.abs(t - Math.round(t)) < 0.03;
        const dash = Math.sin(Math.PI * (fx - fy) * 24) > 0;
        let rgb = col;
        if (onLine && dash && e > 0.05) {
          rgb = [lerp(col[0], cream[0], 0.6), lerp(col[1], cream[1], 0.6), lerp(col[2], cream[2], 0.6)];
          shade *= 0.94;
        }
        const k = shade * (1 + 0.05 * weave[i] + 0.04 * mottle[i]);
        img.data[i * 4] = Math.round(clamp(rgb[0] * k, 0, 1) * 255);
        img.data[i * 4 + 1] = Math.round(clamp(rgb[1] * k, 0, 1) * 255);
        img.data[i * 4 + 2] = Math.round(clamp(rgb[2] * k, 0, 1) * 255);
        img.data[i * 4 + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  },
};

// ---------------------------------------------------------------------------
// Pack
// ---------------------------------------------------------------------------

export default definePack({
  name: 'Wooden storage & beds',
  version: '1.0.0',
  author: 'Neest team',
  description:
    'Solid-wood pieces with real joinery: sleigh bed, tủ chè tea cabinet, Welsh dresser, carved wedding armoire, rocking cradle, crate shelving, slat divider with planter, kaidan-dansu, cheval mirror, shoe bench and quilt rack.',
  license: 'CC0 (made for Neest)',
  items: [
    sleighBed,
    tuChe,
    welshDresser,
    weddingArmoire,
    cradle,
    crateShelving,
    slatDivider,
    kaidanDansu,
    chevalMirror,
    shoeBench,
    quiltRack,
  ],
  patterns: [ribbonGrain, crateBoards, carvedRelief, patchwork],
  materials: [
    {
      id: 'mahogany',
      name: 'Figured mahogany',
      category: 'wood',
      color: '#6e3524',
      roughness: 0.42,
      pattern: { id: 'ribbon-grain', scale: 0.8, contrast: 0.9 },
    },
    {
      id: 'gu-ribbon',
      name: 'Oiled gụ, ribbon figure',
      category: 'wood',
      color: '#4e2c1b',
      roughness: 0.4,
      pattern: { id: 'ribbon-grain', scale: 0.7, contrast: 0.8 },
    },
    {
      id: 'carved-gu',
      name: 'Carved relief, dark gụ',
      category: 'wood',
      color: '#55301c',
      roughness: 0.55,
      pattern: { id: 'carved-relief', scale: 0.28 },
    },
    {
      id: 'carved-oak',
      name: 'Carved relief, honey oak',
      category: 'wood',
      color: '#a9793f',
      roughness: 0.6,
      pattern: { id: 'carved-relief', scale: 0.32 },
    },
    {
      id: 'provincial-oak',
      name: 'Waxed provincial oak',
      category: 'wood',
      color: '#a87a48',
      roughness: 0.55,
      pattern: { id: 'wood-grain', scale: 0.9, contrast: 0.85 },
    },
    {
      id: 'aged-oak',
      name: 'Aged dresser oak',
      category: 'wood',
      color: '#9c7246',
      roughness: 0.58,
      pattern: { id: 'wood-grain', scale: 0.9, contrast: 0.9 },
    },
    {
      id: 'tansu-keyaki',
      name: 'Fumed keyaki',
      category: 'wood',
      color: '#7b4a28',
      roughness: 0.5,
      pattern: { id: 'wood-grain', scale: 0.8, contrast: 1 },
    },
    {
      id: 'crate-pine',
      name: 'Weathered crate pine',
      category: 'wood',
      color: '#cdb38c',
      roughness: 0.85,
      pattern: { id: 'crate-boards', scale: 0.6 },
    },
    {
      id: 'patchwork-quilt',
      name: 'Patchwork cotton quilt',
      category: 'fabric',
      color: '#ffffff',
      roughness: 0.92,
      pattern: { id: 'patchwork', scale: 0.7 },
    },
  ],
});

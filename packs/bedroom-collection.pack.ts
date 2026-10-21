/**
 * Bedroom collection — a modern, lived-in bedroom range.
 *
 * Beds: a velvet wingback bed with a channel-tufted headboard, an ottoman lift-up storage bed, a
 * storage bed with side drawers and a bookcase headboard, a hotel bed set into a padded headboard
 * wall with floating nightstands and two reading spots, a Japandi oak bed floating on an LED
 * under-glow, a king bed with rumpled linen and a heap of pillows, and a children's house-frame
 * floor bed with a canopy and bunting.
 * Bedside & dressing: a floating wall nightstand, a cane-front nightstand, a three-tier bedside
 * cart, a Hollywood vanity with a bulb-ringed mirror and stool, a walk-in closet island with a
 * glass-topped jewellery display and a fluted oak six-drawer dresser.
 * Seating & accessories: a bouclé chaise longue, a folding luggage rack with a suitcase, a lidded
 * seagrass hamper, a sheepskin rug and layered blackout & sheer curtains on a double rod.
 *
 * Pack patterns: channel quilting (velvet), six-way cane webbing, fluted wood and curly fleece.
 */
import {
  barPull,
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
  fronts,
  knob,
  lathe,
  lerp,
  line,
  matSlot,
  mirrorZ,
  pillow,
  pot,
  prism,
  range,
  rectPoly,
  ring,
  rng,
  rod,
  rodPath,
  rodX,
  rodZ,
  roundRectPoints,
  spaced,
  span,
  sphere,
  torus,
  vcyl,
  type FrontSpec,
  type Part,
  type V2,
  type V3,
} from '@/packs/kit';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const TAU = Math.PI * 2;
const NP = { plan: false } as const;

/** Detail box (hidden from the plan) spanning x/y/z ranges, with an optional bevel. */
const sp = (slot: string, x: V2, y: V2, z: V2, bevel = 0): Part => span(slot, x, y, z, { bevel, plan: false });

/** A flat shape facing the front (+z): `pts` are [x, y] in metres, `t` thick from depth z. */
function facePlate(slot: string, pts: V2[], z: number, t: number, plan = false): Part {
  const ys = pts.map((p) => p[1]);
  const xs = pts.map((p) => p[0]);
  const mid = (Math.min(...ys) + Math.max(...ys)) / 2;
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const part: Part = {
    shape: 'prism',
    outline: pts.map(([x, y]) => [x - cx, -(y - mid)] as V2),
    height: t,
    position: [cx, mid, z],
    rotation: [Math.PI / 2, 0, 0],
    slot,
  };
  if (!plan) part.plan = false;
  return part;
}

/** A board between two points in the XY plane, spanning depth z, `t` thick. */
function beamXY(slot: string, a: V2, b: V2, z: V2, t: number): Part {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return box(slot, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (z[0] + z[1]) / 2], [len, t, z[1] - z[0]], {
    rotation: [0, 0, Math.atan2(b[1] - a[1], b[0] - a[0])],
    plan: false,
  });
}

/** A board between two points [z, y] in a side (YZ) plane, spanning width x, `t` thick. */
function beamYZ(slot: string, x: V2, a: V2, b: V2, t: number): Part {
  const dz = b[0] - a[0];
  const dy = b[1] - a[1];
  return box(slot, [(x[0] + x[1]) / 2, (a[1] + b[1]) / 2, (a[0] + b[0]) / 2], [x[1] - x[0], Math.hypot(dz, dy), t], {
    rotation: [Math.atan2(dz, dy), 0, 0],
    plan: false,
  });
}

// ---------------------------------------------------------------------------
// Bedding
// ---------------------------------------------------------------------------

interface BedDress {
  /** Mattress footprint and height range. */
  x: V2;
  z: V2;
  y0: number;
  top: number;
  sheet: string;
  duvet: string;
  accent?: string;
  /** Where the duvet starts (turned down); defaults to about a quarter of the way down. */
  fold?: number;
  /** How far the duvet hangs out beyond the mattress sides and foot (the frame must allow it). */
  over?: number;
  /** 'pair' = sleeping pillows; 'hotel' = euro shams behind sleeping pillows. */
  pillows?: 'pair' | 'hotel';
  /** Accent cushions in front of the pillows. */
  cushions?: number;
  /** Throw folded across the foot (accent slot), hanging just past the duvet. */
  throwBlanket?: boolean;
}

/** Mattress, duvet with a turned-down sheet, pillows, cushions and an optional foot throw. */
function dressBed(b: BedDress): Part[] {
  const [x0, x1] = b.x;
  const [z0, z1] = b.z;
  const t = b.top;
  const o = b.over ?? 0.025;
  const mw = x1 - x0;
  const fold = b.fold ?? z0 + clamp((z1 - z0) * 0.27, 0.42, 0.6);
  const parts: Part[] = [cushion(b.sheet, b.x, [b.y0, t], b.z, { softness: 0.22 })];
  parts.push(
    cushion(b.duvet, [x0 - o * 0.6, x1 + o * 0.6], [t - 0.012, t + 0.05], [fold, z1 + o * 0.6], {
      softness: 0.4,
      plan: false,
    }),
    sp(b.duvet, [x0 - o, x0 - o + 0.016], [b.y0 + 0.05, t + 0.035], [fold + 0.03, z1 + o - 0.01], 0.006),
    sp(b.duvet, [x1 + o - 0.016, x1 + o], [b.y0 + 0.05, t + 0.035], [fold + 0.03, z1 + o - 0.01], 0.006),
    sp(b.duvet, [x0 - o + 0.01, x1 - 0.01 + o], [b.y0 + 0.05, t + 0.035], [z1 + o - 0.016, z1 + o], 0.006),
    cushion(b.duvet, [x0 - o * 0.8, x1 + o * 0.8], [t + 0.035, t + 0.085], [fold, fold + 0.22], {
      softness: 0.45,
      plan: false,
    }),
    cushion(b.sheet, [x0 - 0.004, x1 + 0.004], [t + 0.075, t + 0.093], [fold + 0.02, fold + 0.12], {
      softness: 0.45,
      plan: false,
    }),
  );
  const n = mw >= 1.15 ? 2 : 1;
  const pw = n === 1 ? Math.min(0.66, mw - 0.1) : Math.min(0.7, mw / 2 - 0.04);
  let zFront = z0 + 0.14;
  if (b.pillows === 'hotel') {
    const ew = n === 1 ? Math.min(0.62, mw - 0.08) : Math.min(0.66, mw / 2 - 0.03);
    for (const px of cells(n, x0, x1)) {
      parts.push(pillow(b.sheet, [px, t + 0.2, z0 + 0.12], ew, 0.43, 0.16, { lean: 0.18 }));
      parts.push(pillow(b.sheet, [px, t + 0.13, z0 + 0.3], pw * 0.96, 0.34, 0.14, { lean: 0.5 }));
    }
    zFront = z0 + 0.42;
  } else {
    for (const px of cells(n, x0, x1)) parts.push(pillow(b.sheet, [px, t + 0.13, z0 + 0.14], pw, 0.34, 0.14, { lean: 0.45 }));
    zFront = z0 + 0.3;
  }
  if (b.accent && b.cushions) {
    const k = Math.min(b.cushions, mw >= 1.15 ? 3 : 1);
    const cw = Math.min(0.44, (mw - 0.1) / k);
    cells(k, x0 + 0.05, x1 - 0.05).forEach((px, i) => {
      parts.push(
        pillow(b.accent as string, [px, t + 0.13, zFront], cw, 0.36, 0.13, {
          lean: 0.32,
          turn: k > 1 ? (i - (k - 1) / 2) * 0.14 : 0,
        }),
      );
    });
  }
  if (b.accent && b.throwBlanket) {
    const tz: V2 = [z1 - 0.52, z1 - 0.16];
    parts.push(
      cushion(b.accent, [x0 - o - 0.006, x1 + o + 0.006], [t + 0.045, t + 0.072], tz, { softness: 0.4, plan: false }),
      sp(b.accent, [x0 - o - 0.02, x0 - o - 0.006], [b.y0 + 0.1, t + 0.072], tz, 0.005),
      sp(b.accent, [x1 + o + 0.006, x1 + o + 0.02], [b.y0 + 0.1, t + 0.072], tz, 0.005),
    );
  }
  return parts;
}

function bedPlan(x: V2, z: V2, fold?: number): ReturnType<typeof line>[] {
  const f = fold ?? z[0] + clamp((z[1] - z[0]) * 0.27, 0.42, 0.6);
  return [rectPoly(x[0], z[0], x[1], z[1]), line([x[0], f], [x[1], f]), line([x[0], f + 0.22], [x[1], f + 0.22])];
}

// ---------------------------------------------------------------------------
// 1. Wingback bed with a channel-tufted headboard
// ---------------------------------------------------------------------------

function wingGeom(w: number, d: number) {
  const wing = 0.11;
  const hz1 = -d / 2 + 0.13;
  const mx: V2 = [-w / 2 + wing + 0.015, w / 2 - wing - 0.015];
  const mz: V2 = [hz1 + 0.005, d / 2 - 0.04];
  return { wing, hz1, mx, mz };
}

const wingbackBed = defineItem({
  id: 'wingback-channel-bed',
  name: 'Wingback bed with channel-tufted headboard',
  category: 'bedroom',
  type: 'beds',
  group: 'Beds',
  tags: [
    'bed',
    'upholstered bed',
    'wingback',
    'channel tufted',
    'velvet',
    'headboard',
    'double',
    'queen',
    'king',
    'giường bọc nệm',
    'giường đầu nệm',
    'giường ngủ',
  ],
  defaultSize: { w: 1.9, d: 2.3, h: 1.35 },
  minSize: { w: 1.15, d: 2.15, h: 1.1 },
  maxSize: { w: 2.25, d: 2.45, h: 1.65 },
  wallSnap: true,
  slots: [
    matSlot('upholstery', 'Upholstery', 'velvet-sage'),
    matSlot('bedding', 'Sheets & pillows', 'linen-sheet'),
    matSlot('duvet', 'Duvet', 'linen-oat'),
    matSlot('accent', 'Throw & cushions', 'linen-clay'),
  ],
  build: ({ w, d, h }) => {
    const { wing, hz1, mx, mz } = wingGeom(w, d);
    const hz0 = -d / 2;
    const parts: Part[] = [
      // Recessed plinth and the upholstered base with a piped top edge.
      sp('upholstery', [-w / 2 + 0.12, w / 2 - 0.12], [0, 0.08], [hz1, d / 2 - 0.1]),
      span('upholstery', [-w / 2 + 0.03, w / 2 - 0.03], [0.08, 0.36], [hz1 - 0.01, d / 2], { bevel: 0.035 }),
      rodX('upholstery', -w / 2 + 0.05, w / 2 - 0.05, 0.355, d / 2 - 0.014, 0.009, NP),
      // Headboard backing.
      span('upholstery', [-w / 2 + wing, w / 2 - wing], [0.08, h - 0.04], [hz0, hz0 + 0.06]),
    ];
    // Vertical channels, each a plump rounded tube of fabric.
    const xi0 = -w / 2 + wing;
    const xi1 = w / 2 - wing;
    const n = clamp(Math.round((xi1 - xi0) / 0.115), 6, 20);
    for (const [a, b] of cellSpans(n, xi0, xi1)) {
      parts.push(cushion('upholstery', [a + 0.002, b - 0.002], [0.34, h - 0.005], [hz0 + 0.04, hz1], { softness: 0.45, plan: false }));
    }
    // Wings: tall side cushions reaching forward, with a rolled top.
    for (const s of [-1, 1]) {
      const x: V2 = s < 0 ? [-w / 2, -w / 2 + wing + 0.01] : [w / 2 - wing - 0.01, w / 2];
      parts.push(cushion('upholstery', x, [0.08, h - 0.07], [hz0, hz0 + 0.3], { softness: 0.4 }));
      parts.push(rodZ('upholstery', (x[0] + x[1]) / 2, h - 0.07, hz0 + 0.004, hz0 + 0.296, (wing + 0.01) / 2, NP));
      // Welt down the front edge of the wing.
      parts.push(vcyl('upholstery', (x[0] + x[1]) / 2, hz0 + 0.296, 0.09, h - 0.08, 0.012, NP));
    }
    parts.push(
      ...dressBed({
        x: mx,
        z: mz,
        y0: 0.36,
        top: 0.6,
        sheet: 'bedding',
        duvet: 'duvet',
        accent: 'accent',
        over: 0.03,
        cushions: 2,
        throwBlanket: true,
      }),
    );
    return parts;
  },
  planDetail: ({ w, d }) => {
    const { mx, mz } = wingGeom(w, d);
    return bedPlan(mx, mz);
  },
});

// ---------------------------------------------------------------------------
// 2. Ottoman lift-up storage bed
// ---------------------------------------------------------------------------

const ottomanBed = defineItem({
  id: 'ottoman-storage-bed',
  name: 'Ottoman lift-up storage bed',
  category: 'bedroom',
  type: 'beds',
  group: 'Beds',
  tags: [
    'bed',
    'ottoman bed',
    'storage bed',
    'lift up',
    'gas lift',
    'under-bed storage',
    'upholstered',
    'bouclé',
    'giường có ngăn chứa đồ',
    'giường nâng hơi',
    'giường bọc nệm',
  ],
  defaultSize: { w: 1.65, d: 2.15, h: 1.15 },
  minSize: { w: 1.0, d: 2.0, h: 0.95 },
  maxSize: { w: 2.05, d: 2.3, h: 1.4 },
  wallSnap: true,
  slots: [
    matSlot('upholstery', 'Upholstery', 'boucle-oat'),
    matSlot('bedding', 'Sheets & pillows', 'linen-sheet'),
    matSlot('duvet', 'Duvet', 'fabric-sky'),
    matSlot('accent', 'Throw & cushions', 'channel-velvet-rose'),
  ],
  build: ({ w, d, h }) => {
    const z0 = -d / 2 + 0.1;
    const parts: Part[] = [
      // Headboard: a backing board and stacked horizontal channel bolsters.
      span('upholstery', [-w / 2, w / 2], [0.04, h - 0.02], [-d / 2, -d / 2 + 0.04], { bevel: 0.01 }),
      sp('upholstery', [-w / 2 + 0.01, w / 2 - 0.01], [0.04, 0.37], [-d / 2 + 0.03, z0]),
    ];
    const nb = clamp(Math.round((h - 0.36) / 0.17), 3, 6);
    for (const [a, b] of cellSpans(nb, 0.36, h)) {
      parts.push(cushion('upholstery', [-w / 2 + 0.005, w / 2 - 0.005], [a + 0.002, b - 0.002], [-d / 2 + 0.03, z0], { softness: 0.45, plan: false }));
    }
    // Block feet, the storage box and its lid (the slim gap reads as the opening seam).
    for (const x of [-w / 2 + 0.08, w / 2 - 0.08]) {
      for (const z of [z0 + 0.08, d / 2 - 0.08]) parts.push(sp('upholstery', [x - 0.03, x + 0.03], [0, 0.06], [z - 0.03, z + 0.03], 0.006));
    }
    parts.push(
      span('upholstery', [-w / 2 + 0.03, w / 2 - 0.03], [0.06, 0.3], [z0, d / 2 - 0.005], { bevel: 0.025 }),
      sp('upholstery', [-w / 2 + 0.025, w / 2 - 0.025], [0.304, 0.36], [z0, d / 2], 0.02),
    );
    // Fabric pull strap at the foot and the lid hinge line hidden at the head.
    parts.push(
      torus('upholstery', [0, 0.3, d / 2 - 0.006], 0.045, 0.008, { rotation: [0, 0, Math.PI], arc: Math.PI, plan: false }),
      sp('upholstery', [-0.03, 0.03], [0.255, 0.3], [d / 2 - 0.01, d / 2 + 0.002], 0.003),
    );
    parts.push(
      ...dressBed({
        x: [-w / 2 + 0.045, w / 2 - 0.045],
        z: [z0 + 0.005, d / 2 - 0.03],
        y0: 0.36,
        top: 0.58,
        sheet: 'bedding',
        duvet: 'duvet',
        accent: 'accent',
        over: 0.02,
        cushions: 1,
        throwBlanket: false,
      }),
    );
    return parts;
  },
  planDetail: ({ w, d }) => bedPlan([-w / 2 + 0.045, w / 2 - 0.045], [-d / 2 + 0.105, d / 2 - 0.03]),
});

// ---------------------------------------------------------------------------
// 3. Storage bed with side drawers and a bookcase headboard
// ---------------------------------------------------------------------------

const drawerBed = defineItem({
  id: 'drawer-storage-bed',
  name: 'Storage bed with drawers & bookcase headboard',
  category: 'bedroom',
  type: 'beds',
  group: 'Beds',
  tags: [
    'bed',
    'storage bed',
    'drawers',
    'captain bed',
    'bookcase headboard',
    'walnut',
    'giường ngăn kéo',
    'giường có hộc kéo',
    'giường gỗ',
  ],
  defaultSize: { w: 1.65, d: 2.25, h: 1.0 },
  minSize: { w: 1.0, d: 2.1, h: 0.92 },
  maxSize: { w: 2.05, d: 2.4, h: 1.2 },
  wallSnap: true,
  slots: [
    matSlot('frame', 'Frame & drawers', 'wood-walnut'),
    matSlot('bedding', 'Sheets & pillows', 'linen-sheet'),
    matSlot('duvet', 'Duvet', 'linen-oat'),
    matSlot('accent', 'Throw & books', 'linen-clay'),
  ],
  build: ({ w, d, h }) => {
    const zb = -d / 2 + 0.2;
    const t = 0.025;
    const yN = h - 0.235;
    const parts: Part[] = [
      // Bookcase headboard: back, sides, top, a shelf for the cubbies and a face behind the pillows.
      span('frame', [-w / 2, w / 2], [0, h], [-d / 2, -d / 2 + 0.02]),
      span('frame', [-w / 2, -w / 2 + t], [0, h - t], [-d / 2, zb]),
      span('frame', [w / 2 - t, w / 2], [0, h - t], [-d / 2, zb]),
      sp('frame', [-w / 2, w / 2], [h - t, h], [-d / 2, zb], 0.006),
      sp('frame', [-w / 2 + t, w / 2 - t], [yN - t, yN], [-d / 2 + 0.02, zb]),
      sp('frame', [-w / 2 + t, w / 2 - t], [0.36, yN - t], [zb - 0.02, zb]),
    ];
    const nc = clamp(Math.round(w / 0.55), 2, 4);
    const cubbies = cellSpans(nc, -w / 2 + t, w / 2 - t);
    cubbies.forEach(([a, b], i) => {
      if (i > 0) parts.push(sp('frame', [a - 0.009, a + 0.009], [yN, h - t], [-d / 2 + 0.02, zb]));
      if (i % 2 === 0) {
        parts.push(...bookRowLying('accent', [a + 0.03, b - 0.03], yN, -d / 2 + 0.03, Math.min(0.18, h - t - yN - 0.02), 0.14, 11 + i));
      }
    });
    // Base with two drawers on each side; the gap under each top lip is the finger pull.
    parts.push(
      sp('frame', [-w / 2 + 0.08, w / 2 - 0.08], [0, 0.04], [zb + 0.05, d / 2 - 0.06]),
      span('frame', [-w / 2 + 0.02, w / 2 - 0.02], [0.04, 0.36], [zb, d / 2], { bevel: 0.006 }),
    );
    for (const s of [-1, 1]) {
      const fx: V2 = s < 0 ? [-w / 2, -w / 2 + 0.02] : [w / 2 - 0.02, w / 2];
      for (const [a, b] of cellSpans(2, zb + 0.06, d / 2 - 0.08)) {
        parts.push(sp('frame', fx, [0.07, 0.29], [a + 0.004, b - 0.004]), sp('frame', fx, [0.305, 0.335], [a + 0.004, b - 0.004]));
      }
    }
    parts.push(
      ...dressBed({
        x: [-w / 2 + 0.035, w / 2 - 0.035],
        z: [zb + 0.005, d / 2 - 0.03],
        y0: 0.36,
        top: 0.58,
        sheet: 'bedding',
        duvet: 'duvet',
        accent: 'accent',
        over: 0.02,
        throwBlanket: true,
      }),
    );
    return parts;
  },
  planDetail: ({ w, d }) => bedPlan([-w / 2 + 0.035, w / 2 - 0.035], [-d / 2 + 0.205, d / 2 - 0.03]),
});

/** A stack of books lying flat on a shelf (spines to the front), filling up to `maxH`. */
function bookRowLying(slot: string, x: V2, y0: number, zBack: number, maxH: number, maxD: number, seed: number): Part[] {
  const rand = rng(seed);
  const parts: Part[] = [];
  const cx = lerp(x[0], x[1], 0.3);
  let y = y0;
  for (let i = 0; i < 6; i++) {
    const th = lerp(0.022, 0.04, rand());
    if (y + th > y0 + maxH * 0.6) break;
    const bw = Math.min(lerp(0.17, 0.24, rand()), x[1] - x[0] - 0.02);
    const off = (rand() - 0.5) * 0.02;
    parts.push(sp(slot, [cx - bw / 2 + off, cx + bw / 2 + off], [y, y + th], [zBack, zBack + maxD * lerp(0.82, 1, rand())], 0.002));
    y += th;
  }
  // A small upright run beside the stack.
  const x0 = cx + 0.14;
  let px = x0;
  while (px + 0.03 < x[1]) {
    const bw = lerp(0.02, 0.035, rand());
    parts.push(sp(slot, [px, px + bw], [y0, y0 + maxH * lerp(0.75, 1, rand())], [zBack, zBack + maxD * lerp(0.8, 1, rand())]));
    px += bw + 0.002;
    if (parts.length > 14) break;
  }
  return parts;
}

// ---------------------------------------------------------------------------
// 4. Hotel bed with a padded headboard wall, floating nightstands and reading spots
// ---------------------------------------------------------------------------

function hotelGeom(w: number, d: number) {
  const bedW = clamp(w - 1.2, 0.9, 2.0);
  const nsW = clamp((w - bedW) / 2 - 0.06, 0.3, 0.6);
  const zw = -d / 2 + 0.06;
  const mx: V2 = [-bedW / 2 + 0.03, bedW / 2 - 0.03];
  const mz: V2 = [zw + 0.01, d / 2 - 0.03];
  return { bedW, nsW, zw, mx, mz };
}

const hotelBed = defineItem({
  id: 'hotel-headboard-bed',
  name: 'Hotel bed with headboard wall & reading lights',
  category: 'bedroom',
  type: 'beds',
  group: 'Beds',
  tags: [
    'bed',
    'hotel bed',
    'headboard wall',
    'padded panel',
    'floating nightstands',
    'reading light',
    'king',
    'built-in',
    'giường khách sạn',
    'vách đầu giường',
    'đèn đọc sách',
    'tab đầu giường',
  ],
  defaultSize: { w: 3.4, d: 2.3, h: 1.4 },
  minSize: { w: 2.4, d: 2.15, h: 1.2 },
  maxSize: { w: 4.2, d: 2.45, h: 1.8 },
  wallSnap: true,
  slots: [
    matSlot('panel', 'Padded panels & runner', 'channel-velvet-taupe'),
    matSlot('wood', 'Wood & fittings', 'wood-walnut'),
    matSlot('bedding', 'Bedding', 'linen-sheet'),
    matSlot('light', 'Reading lights & LED', 'led-warm'),
  ],
  light: {
    color: '#ffe2b8',
    intensity: 0.9,
    distance: 3,
    y: 1.1,
    kind: 'spot',
    angle: 0.42,
    penumbra: 0.55,
    heads: [
      { x: -0.8, y: 1.1, z: -0.95, dir: [0.1, -1, 0.45] },
      { x: 0.8, y: 1.1, z: -0.95, dir: [-0.1, -1, 0.45] },
    ],
  },
  build: ({ w, d, h }) => {
    const { bedW, nsW, zw, mx, mz } = hotelGeom(w, d);
    const parts: Part[] = [
      // Wall backer, padded vertical panels and a walnut cap with an LED strip beneath.
      span('wood', [-w / 2, w / 2], [0, h], [-d / 2, -d / 2 + 0.025]),
      sp('wood', [-w / 2, w / 2], [h - 0.09, h], [-d / 2, -d / 2 + 0.085], 0.006),
      sp('light', [-w / 2 + 0.03, w / 2 - 0.03], [h - 0.095, h - 0.09], [-d / 2 + 0.06, -d / 2 + 0.075]),
    ];
    const np = clamp(Math.round(w / 0.62), 3, 8);
    for (const [a, b] of cellSpans(np, -w / 2 + 0.01, w / 2 - 0.01)) {
      parts.push(cushion('panel', [a + 0.004, b - 0.004], [0.3, h - 0.1], [-d / 2 + 0.02, zw], { softness: 0.3, plan: false }));
    }
    // Floating nightstands with a drawer and a recessed pull.
    for (const s of [-1, 1]) {
      const xa = bedW / 2 + 0.04;
      const xs: V2 = s < 0 ? [-xa - nsW, -xa] : [xa, xa + nsW];
      const nz: V2 = [zw, zw + 0.42];
      parts.push(
        span('wood', xs, [0.44, 0.6], nz, { bevel: 0.006 }),
        sp('wood', [xs[0] + 0.015, xs[1] - 0.015], [0.455, 0.555], [nz[1], nz[1] + 0.012], 0.003),
        sp('light', [xs[0] + 0.02, xs[1] - 0.02], [0.437, 0.442], [nz[0] + 0.04, nz[1] - 0.04]),
        // A paperback and a glass on top.
        box('bedding', [(xs[0] + xs[1]) / 2 - s * 0.05, 0.611, zw + 0.22], [0.15, 0.022, 0.21], { rotation: [0, 0.25 * s, 0], bevel: 0.003, plan: false }),
        vcyl('bedding', (xs[0] + xs[1]) / 2 + s * 0.12, zw + 0.3, 0.6, 0.7, 0.032, { rTop: 0.036, plan: false }),
      );
    }
    // Reading spots on short arms above each pillow.
    const yl = h * (1.1 / 1.4);
    for (const s of [-1, 1]) {
      const lx = s * (bedW / 2 - 0.2);
      const lz = -d / 2 + 0.2;
      parts.push(
        discZ('wood', [lx, yl + 0.02, zw + 0.004], 0.03, 0.01, NP),
        rodZ('wood', lx, yl + 0.02, zw + 0.01, lz, 0.008, NP),
        vcyl('wood', lx, lz, yl - 0.045, yl + 0.035, 0.03, { rTop: 0.024, plan: false }),
        vcyl('light', lx, lz, yl - 0.05, yl - 0.043, 0.026, NP),
      );
    }
    // Bed: walnut plinth, padded base, white bedding and a runner across the foot.
    parts.push(
      sp('wood', [-bedW / 2 + 0.08, bedW / 2 - 0.08], [0, 0.1], [zw + 0.05, d / 2 - 0.08]),
      span('panel', [-bedW / 2, bedW / 2], [0.1, 0.36], [zw, d / 2], { bevel: 0.03 }),
    );
    parts.push(
      ...dressBed({
        x: mx,
        z: mz,
        y0: 0.36,
        top: 0.62,
        sheet: 'bedding',
        duvet: 'bedding',
        accent: 'panel',
        over: 0.02,
        pillows: 'hotel',
        throwBlanket: true,
      }),
    );
    // Bolster in front of the pillows.
    parts.push(rodX('panel', mx[0] + 0.25, mx[1] - 0.25, 0.62 + 0.09, mz[0] + 0.5, 0.09, NP));
    return parts;
  },
  planDetail: ({ w, d }) => {
    const { bedW, nsW, zw, mx, mz } = hotelGeom(w, d);
    const xa = bedW / 2 + 0.04;
    return [
      ...bedPlan(mx, mz),
      rectPoly(-xa - nsW, zw, -xa, zw + 0.42),
      rectPoly(xa, zw, xa + nsW, zw + 0.42),
    ];
  },
});

// ---------------------------------------------------------------------------
// 5. Japandi floating bed with an LED under-glow
// ---------------------------------------------------------------------------

function japandiGeom(w: number, d: number) {
  const mx: V2 = [-w / 2 + 0.22, w / 2 - 0.22];
  const mz: V2 = [-d / 2 + 0.1, d / 2 - 0.2];
  return { mx, mz };
}

const japandiBed = defineItem({
  id: 'japandi-glow-bed',
  name: 'Japandi floating bed with LED under-glow',
  category: 'bedroom',
  type: 'beds',
  group: 'Beds',
  tags: [
    'bed',
    'japandi',
    'floating bed',
    'led',
    'under-glow',
    'oak',
    'platform',
    'minimal',
    'ledge',
    'giường gỗ sồi',
    'giường bay',
    'giường kiểu nhật',
    'đèn led gầm giường',
  ],
  defaultSize: { w: 2.2, d: 2.4, h: 0.85 },
  minSize: { w: 1.4, d: 2.2, h: 0.78 },
  maxSize: { w: 2.8, d: 2.6, h: 1.1 },
  wallSnap: true,
  slots: [
    matSlot('wood', 'Oak', 'oak-japandi'),
    matSlot('bedding', 'Sheets & pillows', 'linen-sheet'),
    matSlot('duvet', 'Linen duvet & throw', 'linen-oat'),
    matSlot('light', 'LED strip', 'led-warm'),
  ],
  light: {
    color: '#ffb866',
    intensity: 0.22,
    distance: 1.3,
    y: 0.06,
    heads: [
      { x: -0.6, y: 0.06, z: 1.0 },
      { x: 0.6, y: 0.06, z: 1.0 },
      { x: -0.98, y: 0.06, z: 0 },
      { x: 0.98, y: 0.06, z: 0 },
    ],
  },
  build: ({ w, d, h }) => {
    const { mx, mz } = japandiGeom(w, d);
    const px: V2 = [-w / 2 + 0.22, w / 2 - 0.22];
    const pz: V2 = [-d / 2 + 0.1, d / 2 - 0.22];
    const parts: Part[] = [
      // Recessed plinth with warm LED strips along its top edges.
      sp('wood', px, [0, 0.12], pz),
      sp('light', [px[0], px[1]], [0.1, 0.115], [pz[1], pz[1] + 0.01]),
      sp('light', [px[0] - 0.01, px[0]], [0.1, 0.115], [pz[0] + 0.05, pz[1]]),
      sp('light', [px[1], px[1] + 0.01], [0.1, 0.115], [pz[0] + 0.05, pz[1]]),
      // The deck: wider than the mattress so it forms a ledge all round.
      span('wood', [-w / 2, w / 2], [0.12, 0.2], [-d / 2 + 0.06, d / 2], { bevel: 0.015 }),
      // Low solid headboard with a thin shelf ledge along the top.
      span('wood', [-w / 2, w / 2], [0.12, h - 0.035], [-d / 2, -d / 2 + 0.07], { bevel: 0.012 }),
      sp('wood', [-w / 2, w / 2], [h - 0.035, h], [-d / 2, -d / 2 + 0.13], 0.01),
    ];
    // Shallow grooves on the headboard face.
    for (const x of spaced(clamp(Math.round(w / 0.45), 3, 7), -w / 2 + 0.2, w / 2 - 0.2)) {
      parts.push(sp('wood', [x - 0.004, x + 0.004], [0.22, h - 0.06], [-d / 2 + 0.07, -d / 2 + 0.074]));
    }
    parts.push(
      ...dressBed({
        x: mx,
        z: mz,
        y0: 0.2,
        top: 0.42,
        sheet: 'bedding',
        duvet: 'duvet',
        accent: 'duvet',
        over: 0.03,
        cushions: 1,
      }),
    );
    // On the side ledges: a stack of books and a ceramic cup on a little tray.
    const lw = 0.2;
    parts.push(
      box('duvet', [-w / 2 + lw / 2 + 0.005, 0.212, -d / 2 + 0.45], [0.15, 0.024, 0.21], { rotation: [0, 0.15, 0], bevel: 0.003, plan: false }),
      box('bedding', [-w / 2 + lw / 2 + 0.005, 0.236, -d / 2 + 0.45], [0.13, 0.024, 0.19], { rotation: [0, -0.1, 0], bevel: 0.003, plan: false }),
      sp('wood', [w / 2 - lw + 0.02, w / 2 - 0.02], [0.2, 0.212], [-d / 2 + 0.35, -d / 2 + 0.55], 0.004),
      lathe('bedding', [w / 2 - lw / 2, 0.212, -d / 2 + 0.45], [[0, 0], [0.03, 0], [0.04, 0.03], [0.043, 0.085], [0.038, 0.085]], { segments: 18, plan: false }),
    );
    return parts;
  },
  planDetail: ({ w, d }) => {
    const { mx, mz } = japandiGeom(w, d);
    return bedPlan(mx, mz);
  },
});

// ---------------------------------------------------------------------------
// 6. King bed with rumpled, lived-in linen
// ---------------------------------------------------------------------------

const livedInBed = defineItem({
  id: 'lived-in-king-bed',
  name: 'King bed with rumpled linen bedding',
  category: 'bedroom',
  type: 'beds',
  group: 'Beds',
  tags: [
    'bed',
    'king',
    'linen',
    'rumpled',
    'unmade',
    'lived-in',
    'many pillows',
    'upholstered',
    'giường đôi',
    'giường king',
    'chăn ga gối',
  ],
  defaultSize: { w: 2.05, d: 2.3, h: 1.1 },
  minSize: { w: 1.6, d: 2.15, h: 1.0 },
  maxSize: { w: 2.3, d: 2.45, h: 1.3 },
  wallSnap: true,
  slots: [
    matSlot('frame', 'Upholstered frame', 'fabric-linen'),
    matSlot('bedding', 'Sheets & pillows', 'linen-sheet'),
    matSlot('duvet', 'Duvet', 'linen-oat'),
    matSlot('accent', 'Throw & cushions', 'linen-clay'),
  ],
  build: ({ w, d, h }) => {
    const x0 = -w / 2 + 0.07;
    const x1 = w / 2 - 0.07;
    const z0 = -d / 2 + 0.13;
    const z1 = d / 2 - 0.05;
    const t = 0.58;
    const mw = x1 - x0;
    const parts: Part[] = [
      cushion('frame', [-w / 2, w / 2], [0.1, h], [-d / 2, -d / 2 + 0.12], { softness: 0.35 }),
      sp('frame', [-w / 2 + 0.1, w / 2 - 0.1], [0, 0.1], [z0, d / 2 - 0.1]),
      span('frame', [-w / 2 + 0.02, w / 2 - 0.02], [0.1, 0.34], [-d / 2 + 0.11, d / 2], { bevel: 0.04 }),
      cushion('bedding', [x0, x1], [0.34, t], [z0, z1], { softness: 0.22 }),
    ];
    const rand = rng(31);
    const fold = z0 + 0.55;
    // Duvet: pulled back, sagging over the edges, with soft rumples and one corner thrown back.
    parts.push(
      cushion('duvet', [x0 - 0.02, x1 + 0.02], [t - 0.012, t + 0.04], [fold, z1 + 0.02], { softness: 0.45, plan: false }),
      sp('duvet', [x0 - 0.045, x0 - 0.028], [0.36, t + 0.025], [fold + 0.08, z1 + 0.02], 0.007),
      sp('duvet', [x1 + 0.028, x1 + 0.045], [0.4, t + 0.025], [fold + 0.15, z1 - 0.1], 0.007),
      sp('duvet', [x0 - 0.02, x1 + 0.02], [0.38, t + 0.025], [z1 + 0.028, z1 + 0.044], 0.007),
    );
    for (let i = 0; i < 9; i++) {
      const sx = lerp(0.35, 0.65, rand());
      const sz = lerp(0.25, 0.45, rand());
      const cx = lerp(x0 + 0.42, x1 - 0.42, rand());
      const cz = lerp(fold + 0.42, z1 - 0.4, rand());
      parts.push(sphere('duvet', [cx, t + 0.04, cz], 0.5, { scale: [sx, lerp(0.05, 0.1, rand()), sz], rotation: [0, rand() * Math.PI, 0], plan: false }));
    }
    parts.push(
      box('duvet', [x1 - 0.42, t + 0.06, fold + 0.02], [0.55, 0.05, 0.42], { rotation: [0, 0.5, 0], bevel: 0.022, plan: false }),
      // Rolled edge where the duvet was pushed down.
      rod('duvet', [x0 + 0.08, t + 0.06, fold + 0.06], [x1 - 0.7, t + 0.06, fold - 0.02], 0.055, NP),
    );
    // Pillows: euro shams, sleeping pillows (one knocked askew) and accent cushions.
    const eh = clamp(h - t - 0.06, 0.4, 0.55);
    const ew = Math.min(0.66, mw / 2 - 0.03);
    for (const px of cells(2, x0, x1)) parts.push(pillow('bedding', [px, t + eh * 0.42, z0 + 0.15], ew, eh, 0.17, { lean: 0.2 }));
    const pw = Math.min(0.7, mw / 2 - 0.05);
    const pc = cells(2, x0, x1);
    parts.push(
      pillow('bedding', [pc[0], t + 0.12, z0 + 0.3], pw, 0.34, 0.15, { lean: 0.55, turn: 0.08 }),
      pillow('bedding', [pc[1] + 0.05, t + 0.06, z0 + 0.42], pw * 0.92, 0.15, 0.36, { turn: -0.25 }),
      pillow('accent', [-0.18, t + 0.13, z0 + 0.45], 0.42, 0.38, 0.13, { lean: 0.35, turn: 0.2 }),
      pillow('accent', [0.2, t + 0.12, z0 + 0.48], 0.4, 0.36, 0.13, { lean: 0.3, turn: -0.15 }),
      pillow('duvet', [0, t + 0.09, z0 + 0.58], Math.min(0.55, mw * 0.3), 0.22, 0.12, { lean: 0.25 }),
    );
    // Throw slumped across the foot corner and over the side.
    parts.push(
      box('accent', [x1 - 0.33, t + 0.07, z1 - 0.38], [0.62, 0.025, 0.5], { rotation: [0, -0.35, 0], bevel: 0.01, plan: false }),
      sp('accent', [x1 + 0.046, x1 + 0.062], [0.3, t + 0.07], [z1 - 0.62, z1 - 0.25], 0.006),
      sp('accent', [x1 - 0.1, x1 + 0.062], [t + 0.045, t + 0.075], [z1 - 0.62, z1 - 0.25], 0.008),
    );
    return parts;
  },
  planDetail: ({ w, d }) => {
    const x0 = -w / 2 + 0.07;
    const x1 = w / 2 - 0.07;
    return [rectPoly(x0, -d / 2 + 0.13, x1, d / 2 - 0.05), line([x0, -d / 2 + 0.68], [x1, -d / 2 + 0.68])];
  },
});

// ---------------------------------------------------------------------------
// 7. Children's house-frame floor bed
// ---------------------------------------------------------------------------

const houseBed = defineItem({
  id: 'house-frame-bed',
  name: 'House-frame kids floor bed',
  category: 'kids',
  type: 'beds',
  group: 'Cots & kids beds',
  tags: [
    'kids bed',
    'house bed',
    'montessori',
    'floor bed',
    'canopy',
    'bunting',
    'toddler',
    'single',
    'giường trẻ em',
    'giường hình ngôi nhà',
    'giường cho bé',
  ],
  defaultSize: { w: 1.0, d: 2.0, h: 1.75 },
  minSize: { w: 0.8, d: 1.6, h: 1.4 },
  maxSize: { w: 1.5, d: 2.15, h: 2.1 },
  wallSnap: true,
  slots: [
    matSlot('frame', 'Pine frame', 'wood-pine'),
    matSlot('bedding', 'Sheets & pillow', 'fabric-white-cotton'),
    matSlot('duvet', 'Duvet', 'fabric-sky'),
    matSlot('accent', 'Canopy & bunting', 'fabric-blush'),
  ],
  build: ({ w, d, h }) => {
    const t = 0.045;
    const r = 0.035;
    const apex = h - 0.04;
    const run = w / 2 - r;
    const ye = apex - run;
    const parts: Part[] = [];
    // Low rails with a slatted base, mattress just above.
    parts.push(
      span('frame', [-w / 2, w / 2], [0.02, 0.16], [-d / 2, -d / 2 + t]),
      span('frame', [-w / 2, w / 2], [0.02, 0.16], [d / 2 - t, d / 2]),
      span('frame', [-w / 2, -w / 2 + t], [0.02, 0.16], [-d / 2 + t, d / 2 - t]),
      span('frame', [w / 2 - t, w / 2], [0.02, 0.16], [-d / 2 + t, d / 2 - t]),
      sp('frame', [-w / 2 + t, w / 2 - t], [0.045, 0.06], [-d / 2 + t, d / 2 - t]),
    );
    // Posts, eave beams, gable rafters and a round ridge pole.
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const px = sx * (w / 2 - t / 2);
        const pz = sz * (d / 2 - t / 2);
        parts.push(span('frame', [px - t / 2, px + t / 2], [0, ye], [pz - t / 2, pz + t / 2]));
      }
      parts.push(sp('frame', sx < 0 ? [-w / 2, -w / 2 + t] : [w / 2 - t, w / 2], [ye - t, ye], [-d / 2, d / 2]));
      for (const zr of [[-d / 2, -d / 2 + t] as V2, [d / 2 - t, d / 2] as V2]) {
        parts.push(beamXY('frame', [sx * (w / 2 - r), ye], [0, apex], zr, t * 0.9));
      }
    }
    parts.push(rodZ('frame', 0, apex, -d / 2, d / 2, 0.022, NP));
    // Head-end safety rails.
    for (const sx of [-1, 1]) {
      parts.push(rodZ('frame', sx * (w / 2 - t / 2), 0.32, -d / 2 + t, -d / 2 + Math.min(0.75, d * 0.4), 0.016, NP));
    }
    // Chimney on the right slope.
    const cx = clamp(w * 0.22, 0.12, 0.3);
    const roofY = (x: number): number => apex - x;
    parts.push(sp('frame', [cx - 0.05, cx + 0.05], [roofY(cx + 0.05) - 0.01, Math.min(h - 0.01, roofY(cx - 0.05) + 0.13)], [-d / 2 + 0.25, -d / 2 + 0.35], 0.004));
    // Canopy over the ridge at the head end, falling past the eaves.
    const cz: V2 = [-d / 2 + 0.06, -d / 2 + Math.min(0.8, d * 0.42)];
    const sl = Math.SQRT2 * run * 0.98;
    for (const sx of [-1, 1]) {
      const ux = sx * Math.SQRT1_2;
      const uy = -Math.SQRT1_2;
      const off = 0.03;
      const c: V2 = [ux * (sl / 2) - sx * off * Math.SQRT1_2, apex + uy * (sl / 2) + off * Math.SQRT1_2];
      parts.push(box('accent', [c[0], c[1], (cz[0] + cz[1]) / 2], [sl, 0.008, cz[1] - cz[0]], { rotation: [0, 0, sx * -Math.PI / 4], plan: false }));
      const ex = sx * (w / 2 - 0.004);
      parts.push(...drapeFolds('accent', [cz[0], cz[1]], [ye - 0.38, ye + 0.02], 0, 5, 0.012).map((p) => ({
        ...p,
        position: [ex, p.position[1], p.position[0]] as V3,
        scale: [p.scale?.[2] ?? 1, 1, 1] as V3,
        plan: false,
      })));
    }
    // Bunting along the left eave.
    const flags = clamp(Math.round(d / 0.16), 8, 14);
    const bx = -w / 2 + t + 0.01;
    const pts: V3[] = spaced(flags + 1, -d / 2 + 0.05, d / 2 - 0.05).map((z, i) => [bx, ye - t - 0.03 - 0.08 * Math.sin((Math.PI * i) / flags), z]);
    parts.push(...rodPath('accent', pts, 0.0025));
    for (let i = 0; i < flags; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      parts.push(cyl(i % 2 === 0 ? 'accent' : 'duvet', [bx, (a[1] + b[1]) / 2 - 0.04, (a[2] + b[2]) / 2], 0.002, 0.075, { rTop: 0.035, scale: [0.15, 1, 1], segments: 3, plan: false }));
    }
    // Bedding with a soft toy-coloured cushion.
    const mx: V2 = [-w / 2 + t + 0.005, w / 2 - t - 0.005];
    const mz: V2 = [-d / 2 + t + 0.005, d / 2 - t - 0.005];
    parts.push(
      ...dressBed({
        x: mx,
        z: mz,
        y0: 0.06,
        top: 0.22,
        sheet: 'bedding',
        duvet: 'duvet',
        accent: 'accent',
        over: 0.0,
        fold: mz[0] + clamp((mz[1] - mz[0]) * 0.26, 0.35, 0.5),
        cushions: 1,
      }),
    );
    return parts;
  },
  planDetail: ({ w, d }) => [rectPoly(-w / 2 + 0.05, -d / 2 + 0.05, w / 2 - 0.05, d / 2 - 0.05), line([0, -d / 2], [0, d / 2])],
});

// ---------------------------------------------------------------------------
// 8. Floating wall nightstand
// ---------------------------------------------------------------------------

const floatingNightstand = defineItem({
  id: 'floating-nightstand',
  name: 'Floating nightstand with drawer',
  category: 'bedroom',
  type: 'surfaces',
  group: 'Nightstands',
  tags: [
    'nightstand',
    'bedside table',
    'floating',
    'wall mounted',
    'drawer',
    'shelf',
    'tủ đầu giường',
    'kệ đầu giường treo tường',
    'tab đầu giường',
  ],
  defaultSize: { w: 0.5, d: 0.32, h: 0.26 },
  minSize: { w: 0.35, d: 0.25, h: 0.18 },
  maxSize: { w: 0.8, d: 0.45, h: 0.4 },
  mount: 'wall',
  defaultElevation: 0.4,
  slots: [
    matSlot('body', 'Shell', 'oak-japandi'),
    matSlot('front', 'Drawer front', 'laminate-sage'),
    matSlot('handle', 'Pull', 'metal-brass'),
    matSlot('books', 'Books', 'book-mix'),
  ],
  build: ({ w, d, h }) => {
    const t = 0.018;
    const yd = Math.max(t + 0.05, h * 0.45);
    const zf = d / 2 - 0.02;
    const parts: Part[] = [
      span('body', [-w / 2, w / 2], [h - t, h], [-d / 2, d / 2], { bevel: 0.003 }),
      sp('body', [-w / 2, w / 2], [0, t], [-d / 2, d / 2], 0.003),
      sp('body', [-w / 2, -w / 2 + t], [t, h - t], [-d / 2, d / 2]),
      sp('body', [w / 2 - t, w / 2], [t, h - t], [-d / 2, d / 2]),
      sp('body', [-w / 2 + t, w / 2 - t], [t, h - t], [-d / 2, -d / 2 + 0.008]),
      sp('body', [-w / 2 + t, w / 2 - t], [yd - 0.012, yd], [-d / 2 + 0.008, d / 2 - 0.004]),
      // Drawer front set just inside the shell, with a slim brass bar.
      sp('front', [-w / 2 + t + 0.002, w / 2 - t - 0.002], [yd + 0.002, h - t - 0.002], [zf - 0.018, zf]),
      ...barPull('handle', [0, (yd + h - t) / 2, zf], Math.min(0.16, w * 0.4), { r: 0.005, stand: 0.015 }),
    ];
    // Open niche below: a stack of paperbacks lying flat.
    const nh = yd - 0.012 - t;
    const rand = rng(5);
    let y = t;
    for (let i = 0; i < 4; i++) {
      const th = lerp(0.016, 0.026, rand());
      if (y + th > t + nh * 0.8) break;
      const bw = Math.min(lerp(0.13, 0.18, rand()), w * 0.45);
      const off = -w / 2 + t + 0.03 + (rand() - 0.5) * 0.01;
      parts.push(sp('books', [off, off + bw], [y, y + th], [-d / 2 + 0.03, Math.min(d / 2 - 0.03, -d / 2 + 0.03 + lerp(0.18, 0.22, rand()))], 0.002));
      y += th;
    }
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w / 2 + 0.02, d / 2 - 0.02], [w / 2 - 0.02, d / 2 - 0.02])],
});

// ---------------------------------------------------------------------------
// 9. Cane-front nightstand
// ---------------------------------------------------------------------------

const caneNightstand = defineItem({
  id: 'cane-nightstand',
  name: 'Cane-front nightstand',
  category: 'bedroom',
  type: 'surfaces',
  group: 'Nightstands',
  tags: [
    'nightstand',
    'bedside table',
    'rattan',
    'cane',
    'wicker',
    'drawer',
    'door',
    'tủ đầu giường',
    'tủ mây',
    'tủ đầu giường đan mây',
  ],
  defaultSize: { w: 0.5, d: 0.4, h: 0.58 },
  minSize: { w: 0.38, d: 0.32, h: 0.45 },
  maxSize: { w: 0.7, d: 0.5, h: 0.75 },
  wallSnap: true,
  slots: [
    matSlot('wood', 'Wood', 'wood-teak'),
    matSlot('cane', 'Cane webbing', 'cane-natural'),
    matSlot('knob', 'Knobs', 'metal-brass'),
  ],
  build: ({ w, d, h }) => {
    const legH = 0.14;
    const zf = d / 2 - 0.03;
    const xd: V2 = [-w / 2 + 0.06, w / 2 - 0.06];
    const yDr: V2 = [h - 0.15, h - 0.04];
    const yDo: V2 = [legH + 0.03, yDr[0] - 0.012];
    const parts: Part[] = [
      prism('wood', roundRectPoints(0, -0.01, w - 0.02, d - 0.04, 0.05), legH, h - 0.025 - legH),
      prism('wood', roundRectPoints(0, 0, w, d, 0.06), h - 0.025, 0.025),
      // Drawer and a cane door in a slim frame.
      sp('wood', xd, yDr, [zf, zf + 0.018], 0.004),
      ...frame4('wood', xd, yDo, [zf, zf + 0.018], 0.03),
      sp('cane', [xd[0] + 0.03, xd[1] - 0.03], [yDo[0] + 0.03, yDo[1] - 0.03], [zf, zf + 0.01]),
      ...knob('knob', [0, (yDr[0] + yDr[1]) / 2, zf + 0.018], 0.012),
      ...knob('knob', [xd[1] - 0.05, (yDo[0] + yDo[1]) / 2, zf + 0.018], 0.011),
    ];
    // Slightly splayed, tapered legs.
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const top: V3 = [sx * (w / 2 - 0.07), legH + 0.005, sz * (d / 2 - 0.07) - 0.01];
        const foot: V3 = [sx * (w / 2 - 0.045), 0.006, sz * (d / 2 - 0.05) - 0.01];
        parts.push(rod('wood', foot, top, 0.016, { rTop: 0.02, plan: false }));
      }
    }
    return parts;
  },
});

// ---------------------------------------------------------------------------
// 10. Three-tier bedside cart
// ---------------------------------------------------------------------------

const bedsideCart = defineItem({
  id: 'bedside-cart',
  name: 'Three-tier bedside cart',
  category: 'bedroom',
  type: 'surfaces',
  group: 'Nightstands',
  tags: [
    'bedside cart',
    'trolley',
    'utility cart',
    'rolling',
    'nightstand',
    'metal',
    'xe đẩy',
    'kệ đẩy 3 tầng',
    'tủ đầu giường',
  ],
  defaultSize: { w: 0.45, d: 0.35, h: 0.72 },
  minSize: { w: 0.36, d: 0.3, h: 0.58 },
  maxSize: { w: 0.6, d: 0.45, h: 0.88 },
  slots: [
    matSlot('metal', 'Powder-coated steel', 'powder-sage'),
    matSlot('books', 'Books', 'book-mix'),
    matSlot('decor', 'Ceramics', 'ceramic-white'),
    matSlot('plant', 'Plant', 'plant-leaf'),
  ],
  build: ({ w, d, h }) => {
    const px = w / 2 - 0.02;
    const pz = d / 2 - 0.02;
    const parts: Part[] = [];
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        parts.push(
          vcyl('metal', sx * px, sz * pz, 0.055, h - 0.015, 0.011, NP),
          sphere('metal', [sx * px, h - 0.015, sz * pz], 0.015, NP),
          vcyl('metal', sx * px, sz * pz, 0.045, 0.06, 0.016, NP),
          discZ('decor', [sx * px, 0.023, sz * pz], 0.023, 0.016, { rotation: [0, Math.PI / 2, 0], plan: false }),
        );
      }
    }
    const levels = [0.1, lerp(0.1, h - 0.14, 0.5), h - 0.14];
    for (const y of levels) {
      parts.push(
        span('metal', [-w / 2 + 0.01, w / 2 - 0.01], [y, y + 0.006], [-d / 2 + 0.01, d / 2 - 0.01], { bevel: 0.002 }),
        sp('metal', [-w / 2 + 0.01, w / 2 - 0.01], [y, y + 0.045], [-d / 2 + 0.01, -d / 2 + 0.014]),
        sp('metal', [-w / 2 + 0.01, w / 2 - 0.01], [y, y + 0.045], [d / 2 - 0.014, d / 2 - 0.01]),
        sp('metal', [-w / 2 + 0.01, -w / 2 + 0.014], [y, y + 0.045], [-d / 2 + 0.014, d / 2 - 0.014]),
        sp('metal', [w / 2 - 0.014, w / 2 - 0.01], [y, y + 0.045], [-d / 2 + 0.014, d / 2 - 0.014]),
      );
    }
    // Top: a mug and a little potted plant. Middle: books. Bottom: a lidded jar.
    const yt = levels[2] + 0.006;
    parts.push(
      lathe('decor', [-w * 0.18, yt, 0.02], [[0, 0], [0.034, 0], [0.038, 0.01], [0.04, 0.085], [0.036, 0.085]], { segments: 18, plan: false }),
      torus('decor', [-w * 0.18 + 0.045, yt + 0.045, 0.02], 0.02, 0.005, NP),
      pot('decor', [w * 0.17, yt, -0.02], 0.045, 0.065, 'taper', NP),
      ...foliage('plant', [w * 0.17, yt + 0.06, -0.02], 0.07, Math.min(0.06, h - yt - 0.07), 7, 3),
    );
    const ym = levels[1] + 0.006;
    const rand = rng(7);
    let y = ym;
    for (let i = 0; i < 3; i++) {
      const th = lerp(0.02, 0.035, rand());
      parts.push(box('books', [-0.02 + (rand() - 0.5) * 0.03, y + th / 2, 0], [Math.min(0.24, w - 0.08), th, Math.min(0.17, d - 0.06)], { rotation: [0, (rand() - 0.5) * 0.3, 0], bevel: 0.002, plan: false }));
      y += th;
    }
    const yb = levels[0] + 0.006;
    parts.push(
      lathe('decor', [w * 0.12, yb, 0], [[0, 0], [0.06, 0], [0.065, 0.02], [0.065, 0.11], [0.05, 0.12]], { segments: 22, plan: false }),
      vcyl('plant', w * 0.12, 0, yb + 0.115, yb + 0.135, 0.052, NP),
    );
    return parts;
  },
});

// ---------------------------------------------------------------------------
// 12. Walk-in closet island with a glass-topped jewellery display
// ---------------------------------------------------------------------------

const closetIsland = defineItem({
  id: 'closet-island',
  name: 'Walk-in closet island with glass-top drawers',
  category: 'bedroom',
  type: 'storage',
  group: 'Dressers & chests',
  tags: [
    'closet island',
    'walk-in closet',
    'dressing room',
    'jewellery display',
    'glass top',
    'drawers',
    'double sided',
    'đảo tủ quần áo',
    'phòng thay đồ',
    'tủ trang sức',
    'tủ ngăn kéo',
  ],
  defaultSize: { w: 1.4, d: 0.75, h: 0.92 },
  minSize: { w: 0.9, d: 0.55, h: 0.8 },
  maxSize: { w: 2.2, d: 1.0, h: 1.05 },
  slots: [
    matSlot('carcass', 'Carcass & fronts', 'wood-walnut'),
    matSlot('glass', 'Glass top', 'glass-clear'),
    matSlot('lining', 'Velvet lining', 'fabric-velvet-navy'),
    matSlot('hardware', 'Handles & jewellery', 'metal-brass'),
  ],
  build: ({ w, d, h }) => {
    const yTop = h - 0.06;
    const parts: Part[] = [
      sp('carcass', [-w / 2 + 0.05, w / 2 - 0.05], [0, 0.08], [-d / 2 + 0.05, d / 2 - 0.05]),
      span('carcass', [-w / 2, w / 2], [0.08, yTop], [-d / 2 + 0.02, d / 2 - 0.02]),
      // Display tray: walnut rim, velvet lining, dividers and a glass lid.
      sp('carcass', [-w / 2, w / 2], [yTop, h - 0.012], [-d / 2, -d / 2 + 0.03]),
      sp('carcass', [-w / 2, w / 2], [yTop, h - 0.012], [d / 2 - 0.03, d / 2]),
      sp('carcass', [-w / 2, -w / 2 + 0.03], [yTop, h - 0.012], [-d / 2 + 0.03, d / 2 - 0.03]),
      sp('carcass', [w / 2 - 0.03, w / 2], [yTop, h - 0.012], [-d / 2 + 0.03, d / 2 - 0.03]),
      sp('lining', [-w / 2 + 0.03, w / 2 - 0.03], [yTop, yTop + 0.01], [-d / 2 + 0.03, d / 2 - 0.03]),
      span('glass', [-w / 2, w / 2], [h - 0.012, h], [-d / 2, d / 2]),
    ];
    const cols = clamp(Math.round(w / 0.3), 3, 7);
    const xs = cellSpans(cols, -w / 2 + 0.03, w / 2 - 0.03);
    const zs = cellSpans(2, -d / 2 + 0.03, d / 2 - 0.03);
    parts.push(sp('carcass', [-w / 2 + 0.03, w / 2 - 0.03], [yTop + 0.01, h - 0.02], [-0.006, 0.006]));
    for (const [a] of xs.slice(1)) parts.push(sp('carcass', [a - 0.006, a + 0.006], [yTop + 0.01, h - 0.02], [-d / 2 + 0.03, d / 2 - 0.03]));
    // Jewellery: watches, bangles and rings in the compartments.
    const rand = rng(17);
    const yj = yTop + 0.012;
    xs.forEach(([a, b], i) => {
      zs.forEach(([c, e], j) => {
        const cx = (a + b) / 2;
        const cz = (c + e) / 2;
        const kind = (i + j * 2) % 3;
        if (kind === 0) {
          parts.push(ring('hardware', [cx, yj + 0.004, cz], 0.02, 0.004, NP), vcyl('lining', cx, cz, yj, yj + 0.008, 0.016, NP));
        } else if (kind === 1) {
          parts.push(ring('hardware', [cx - 0.025, yj + 0.005, cz], 0.03, 0.005, NP), ring('hardware', [cx + 0.02, yj + 0.004, cz + 0.02], 0.026, 0.004, NP));
        } else {
          for (let k = 0; k < 3; k++) {
            parts.push(ring('hardware', [cx + (rand() - 0.5) * 0.06, yj + 0.003, cz + (rand() - 0.5) * 0.06], 0.009, 0.003, NP));
          }
        }
      });
    });
    // Three rows of drawers on both long sides.
    const dc = clamp(Math.round(w / 0.55), 2, 4);
    const specs: FrontSpec[] = [];
    for (const xr of cellSpans(dc, -w / 2 + 0.01, w / 2 - 0.01)) {
      for (const yr of cellSpans(3, 0.085, yTop - 0.005)) specs.push({ x: xr, y: yr, handle: { kind: 'bar-h', len: Math.min(0.16, (xr[1] - xr[0]) * 0.4) } });
    }
    const front = fronts('carcass', 'hardware', specs, d / 2 - 0.02, 0.018, 0.012);
    parts.push(...front, ...mirrorZ(front));
    return parts;
  },
  planDetail: ({ w, d }) => [rectPoly(-w / 2 + 0.03, -d / 2 + 0.03, w / 2 - 0.03, d / 2 - 0.03), line([-w / 2 + 0.03, 0], [w / 2 - 0.03, 0])],
});

// ---------------------------------------------------------------------------
// 13. Fluted oak six-drawer dresser
// ---------------------------------------------------------------------------

const flutedDresser = defineItem({
  id: 'fluted-dresser',
  name: 'Fluted oak six-drawer dresser',
  category: 'bedroom',
  type: 'storage',
  group: 'Dressers & chests',
  tags: [
    'dresser',
    'chest of drawers',
    'fluted',
    'reeded',
    'oak',
    'six drawer',
    'lowboy',
    'tủ ngăn kéo',
    'tủ quần áo thấp',
    'tủ gỗ sồi',
  ],
  defaultSize: { w: 1.4, d: 0.48, h: 0.8 },
  minSize: { w: 0.8, d: 0.4, h: 0.65 },
  maxSize: { w: 2.0, d: 0.55, h: 0.95 },
  wallSnap: true,
  slots: [
    matSlot('carcass', 'Carcass', 'oak-japandi'),
    matSlot('fronts', 'Fluted fronts', 'fluted-oak'),
    matSlot('knob', 'Knobs', 'metal-brass'),
  ],
  build: ({ w, d, h }) => {
    const legH = 0.1;
    const zf = d / 2 - 0.05;
    const parts: Part[] = [
      span('carcass', [-w / 2, w / 2], [h - 0.03, h], [-d / 2, d / 2], { bevel: 0.01 }),
      span('carcass', [-w / 2 + 0.01, w / 2 - 0.01], [legH, h - 0.03], [-d / 2 + 0.01, zf]),
      sp('carcass', [-w / 2 + 0.01, w / 2 - 0.01], [legH, legH + 0.03], [zf, zf + 0.018]),
    ];
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        parts.push(vcyl('carcass', sx * (w / 2 - 0.06), sz * (d / 2 - 0.07), 0, legH, 0.016, { rTop: 0.024, plan: false }));
      }
    }
    const cols = clamp(Math.round(w / 0.7), 1, 3);
    const rows = 3;
    const ys = cellSpans(rows, legH + 0.03, h - 0.035);
    for (const [a, b] of cellSpans(cols, -w / 2 + 0.015, w / 2 - 0.015)) {
      ys.forEach(([c, e], j) => {
        parts.push(sp('fronts', [a + 0.002, b - 0.002], [c + 0.002, e - 0.002], [zf, zf + 0.02], 0.003));
        // Wider drawers get two knobs.
        const kx = b - a > 0.6 ? [a + (b - a) * 0.25, a + (b - a) * 0.75] : [(a + b) / 2];
        for (const x of kx) parts.push(...knob('knob', [x, j === 0 ? e - 0.06 : (c + e) / 2, zf + 0.02], 0.014));
      });
    }
    return parts;
  },
});

// ---------------------------------------------------------------------------
// 14. Bouclé chaise longue
// ---------------------------------------------------------------------------

const chaise = defineItem({
  id: 'boucle-chaise-longue',
  name: 'Bouclé chaise longue',
  category: 'bedroom',
  type: 'seating',
  group: 'Living chairs',
  tags: [
    'chaise longue',
    'chaise lounge',
    'modern',
    'curved',
    'bouclé',
    'reading',
    'ghế dài',
    'ghế thư giãn',
    'ghế nằm đọc sách',
  ],
  defaultSize: { w: 1.7, d: 0.72, h: 0.82 },
  minSize: { w: 1.4, d: 0.6, h: 0.72 },
  maxSize: { w: 2.0, d: 0.85, h: 0.95 },
  slots: [
    matSlot('upholstery', 'Upholstery', 'boucle-ivory'),
    matSlot('legs', 'Legs', 'wood-walnut'),
    matSlot('accent', 'Bolster & throw', 'linen-clay'),
  ],
  build: ({ w, d, h }) => {
    const parts: Part[] = [];
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        parts.push(vcyl('legs', sx * (w / 2 - 0.09), sz * (d / 2 - 0.09), 0, 0.15, 0.014, { rTop: 0.022, plan: false }));
      }
    }
    parts.push(
      span('upholstery', [-w / 2 + 0.02, w / 2 - 0.02], [0.14, 0.36], [-d / 2 + 0.02, d / 2 - 0.02], { bevel: 0.05 }),
      cushion('upholstery', [-w / 2 + 0.16, w / 2 - 0.03], [0.355, 0.44], [-d / 2 + 0.15, d / 2 - 0.03], { softness: 0.45, plan: false }),
      // Rounded arm at the left end.
      cushion('upholstery', [-w / 2, -w / 2 + 0.18], [0.14, h - 0.1], [-d / 2, d / 2], { softness: 0.3 }),
      rodZ('upholstery', -w / 2 + 0.095, h - 0.1, -d / 2 + 0.005, d / 2 - 0.005, 0.095, NP),
    );
    // Back: sweeps down from the arm towards the middle, with a rounded top edge.
    const xa = -w / 2 + 0.15;
    const xb = -w / 2 + w * 0.62;
    const yTop = h - 0.13;
    const curve = range(9).map((i) => {
      const s = i / 8;
      return [lerp(xb, xa, s), 0.5 + (yTop - 0.5) * s ** 1.7] as V2;
    });
    parts.push(facePlate('upholstery', [[xa, 0.34], [xb, 0.34], ...curve], -d / 2 + 0.02, 0.14));
    const ridge: V3[] = curve.map(([x, y]) => [x, y, -d / 2 + 0.09]);
    parts.push(...rodPath('upholstery', ridge, 0.07));
    for (const p of ridge.slice(1, -1)) parts.push(sphere('upholstery', p, 0.07, NP));
    // Bolster against the arm and a throw over the foot end.
    parts.push(
      rodZ('accent', -w / 2 + 0.27, 0.53, -d / 2 + 0.18, d / 2 - 0.07, 0.085, NP),
      sp('accent', [w / 2 - 0.46, w / 2 - 0.16], [0.44, 0.462], [-d / 2 + 0.04, d / 2 - 0.02], 0.006),
      sp('accent', [w / 2 - 0.46, w / 2 - 0.16], [0.2, 0.462], [d / 2 - 0.02, d / 2 - 0.004], 0.005),
    );
    return parts;
  },
});

// ---------------------------------------------------------------------------
// 15. Folding luggage rack with a suitcase
// ---------------------------------------------------------------------------

const luggageRack = defineItem({
  id: 'luggage-rack',
  name: 'Folding luggage rack with suitcase',
  category: 'bedroom',
  type: 'storage',
  group: 'Baskets & boxes',
  tags: [
    'luggage rack',
    'suitcase',
    'travel',
    'guest room',
    'hotel',
    'folding stand',
    'giá để vali',
    'vali',
    'hành lý',
  ],
  defaultSize: { w: 0.7, d: 0.46, h: 0.78 },
  minSize: { w: 0.55, d: 0.38, h: 0.65 },
  maxSize: { w: 0.9, d: 0.55, h: 0.9 },
  slots: [
    matSlot('frame', 'Rack frame', 'wood-walnut'),
    matSlot('straps', 'Webbing & tag', 'fabric-charcoal'),
    matSlot('case', 'Suitcase shell', 'suitcase-shell'),
    matSlot('trim', 'Zip, wheels & handle', 'metal-black-matte'),
  ],
  build: ({ w, d, h }) => {
    const rackH = clamp(h - 0.27, 0.38, 0.62);
    const dz = d / 2 - 0.04;
    const parts: Part[] = [];
    // Two X-frames, a pivot bolt, top rails, a foot stretcher and three webbing straps.
    for (const s of [-1, 1]) {
      const x = s * (w / 2 - 0.045);
      const xr: V2 = [x - 0.0125, x + 0.0125];
      parts.push(
        beamYZ('frame', xr, [-dz, 0.015], [dz, rackH - 0.03], 0.035),
        beamYZ('frame', [xr[0] - s * 0.026, xr[1] - s * 0.026], [dz, 0.015], [-dz, rackH - 0.03], 0.035),
        rodX('trim', x - 0.03, x + 0.03, (rackH - 0.015) / 2, 0, 0.007, NP),
      );
    }
    parts.push(
      rodX('frame', -w / 2 + 0.02, w / 2 - 0.02, rackH - 0.022, -dz + 0.005, 0.016),
      rodX('frame', -w / 2 + 0.02, w / 2 - 0.02, rackH - 0.022, dz - 0.005, 0.016),
      rodX('frame', -w / 2 + 0.06, w / 2 - 0.06, 0.08, -dz + 0.04, 0.011, NP),
    );
    for (const xs of spaced(3, -w / 2 + 0.15, w / 2 - 0.15)) {
      parts.push(sp('straps', [xs - 0.025, xs + 0.025], [rackH - 0.01, rackH - 0.004], [-dz - 0.01, dz + 0.01]));
    }
    // Suitcase lying flat: ribbed shell, zip band, side handle, wheels and trolley housing.
    const sw = w - 0.08;
    const sd = d - 0.06;
    const top = h - 0.006;
    const mid = (rackH + top) / 2;
    parts.push(span('case', [-sw / 2, sw / 2], [rackH, top], [-sd / 2, sd / 2], { bevel: 0.04 }));
    for (const z of spaced(4, -sd / 2 + 0.08, sd / 2 - 0.08)) parts.push(sp('case', [-sw / 2 + 0.07, sw / 2 - 0.07], [top - 0.004, h], [z - 0.012, z + 0.012], 0.003));
    parts.push(
      sp('trim', [-sw / 2 - 0.003, sw / 2 + 0.003], [mid - 0.008, mid + 0.008], [-sd / 2 - 0.003, sd / 2 + 0.003], 0.006),
      ...barPull('trim', [0, mid + (top - mid) * 0.45, sd / 2], 0.16, { r: 0.007, stand: 0.022 }),
      sp('trim', [-sw / 2 - 0.012, -sw / 2 + 0.002], [rackH + 0.03, top - 0.03], [-0.11, 0.11], 0.004),
    );
    for (const z of [-sd / 2 + 0.05, sd / 2 - 0.05]) {
      for (const y of [rackH + 0.035, top - 0.035]) parts.push(sphere('trim', [-sw / 2 - 0.006, y, z], 0.024, NP));
    }
    // Luggage tag hanging from the handle.
    parts.push(
      rod('straps', [0.05, mid + (top - mid) * 0.45, sd / 2 + 0.022], [0.06, mid - 0.02, sd / 2 + 0.03], 0.002, NP),
      box('straps', [0.065, mid - 0.06, sd / 2 + 0.032], [0.05, 0.08, 0.004], { rotation: [0, 0, 0.1], plan: false }),
    );
    return parts;
  },
  planDetail: ({ w, d }) => [rectPoly(-w / 2 + 0.04, -d / 2 + 0.03, w / 2 - 0.04, d / 2 - 0.03)],
});

// ---------------------------------------------------------------------------
// 16. Lidded seagrass laundry hamper
// ---------------------------------------------------------------------------

const hamper = defineItem({
  id: 'lidded-hamper',
  name: 'Seagrass laundry hamper with lid',
  category: 'bedroom',
  type: 'storage',
  group: 'Baskets & boxes',
  tags: [
    'laundry hamper',
    'hamper',
    'lid',
    'seagrass',
    'woven',
    'basket',
    'liner',
    'giỏ đựng đồ giặt',
    'giỏ cói có nắp',
    'giỏ quần áo',
  ],
  defaultSize: { w: 0.42, d: 0.36, h: 0.62 },
  minSize: { w: 0.32, d: 0.28, h: 0.45 },
  maxSize: { w: 0.55, d: 0.45, h: 0.8 },
  slots: [
    matSlot('weave', 'Seagrass', 'seagrass'),
    matSlot('liner', 'Cotton liner', 'linen-sheet'),
    matSlot('rope', 'Rope handles', 'fabric-cream'),
  ],
  build: ({ w, d, h }) => {
    const hb = h - 0.095;
    const r = Math.min(w, d) * 0.18;
    const rr = (dw: number, dd: number, rad: number): V2[] => roundRectPoints(0, 0, w - dw, d - dd, rad, 5);
    const parts: Part[] = [
      prism('weave', rr(0.02, 0.02, r), 0, hb),
      prism('weave', rr(0.012, 0.012, r + 0.004), 0, 0.025, NP),
      prism('weave', rr(0.012, 0.012, r + 0.004), hb - 0.03, 0.03, NP),
      // Liner folded over the rim, peeking out under the lid.
      prism('liner', rr(0.004, 0.004, r + 0.008), hb - 0.06, 0.07, NP),
      prism('weave', rr(0.0, 0.0, r + 0.01), hb + 0.01, 0.035, NP),
      prism('weave', rr(0.03, 0.03, r - 0.01), hb + 0.045, 0.006, NP),
      torus('rope', [0, hb + 0.05, 0], 0.035, 0.008, { arc: Math.PI, plan: false }),
    ];
    // Woven bands around the body.
    for (const y of spaced(clamp(Math.round(hb / 0.12), 3, 6), 0.09, hb - 0.09)) {
      parts.push(prism('weave', rr(0.014, 0.014, r + 0.003), y - 0.008, 0.016, NP));
    }
    // Rope loop handles on both ends.
    for (const s of [-1, 1]) {
      parts.push(torus('rope', [s * (w / 2 - 0.03), hb - 0.08, 0], 0.035, 0.008, { rotation: [0, 0, -s * Math.PI / 2], arc: Math.PI, plan: false }));
    }
    return parts;
  },
});

// ---------------------------------------------------------------------------
// 17. Sheepskin rug
// ---------------------------------------------------------------------------

/** Right half of a pelt outline in normalised [-0.5, 0.5] coordinates, neck (−z) to tail (+z). */
const PELT: V2[] = [
  [0.1, -0.5],
  [0.19, -0.45],
  [0.23, -0.37],
  [0.4, -0.35],
  [0.5, -0.26],
  [0.44, -0.19],
  [0.35, -0.13],
  [0.37, 0.0],
  [0.36, 0.13],
  [0.43, 0.22],
  [0.5, 0.33],
  [0.42, 0.42],
  [0.28, 0.43],
  [0.16, 0.49],
  [0.0, 0.47],
];

const sheepskin = defineItem({
  id: 'sheepskin-rug',
  name: 'Sheepskin rug',
  category: 'bedroom',
  type: 'decor',
  group: 'Rugs',
  tags: [
    'sheepskin',
    'fleece',
    'rug',
    'bedside rug',
    'faux fur',
    'hygge',
    'thảm lông cừu',
    'thảm cạnh giường',
    'thảm lông',
  ],
  defaultSize: { w: 0.65, d: 1.0, h: 0.045 },
  minSize: { w: 0.45, d: 0.7, h: 0.025 },
  maxSize: { w: 1.2, d: 1.9, h: 0.07 },
  slots: [matSlot('fleece', 'Fleece', 'sheepskin')],
  build: ({ w, d, h }) => {
    const rand = rng(23);
    const half = PELT.map(([x, z]) => [x + (rand() - 0.5) * 0.015, z] as V2);
    const outline: V2[] = [...half, ...half.slice(1, -1).reverse().map(([x, z]) => [-x, z] as V2)].map(([x, z]) => [x * w, z * d] as V2);
    const parts: Part[] = [prism('fleece', outline, 0, h * 0.5)];
    // Tufts of fleece across the pelt.
    for (let i = 0; i < 14; i++) {
      const sx = w * lerp(0.16, 0.26, rand());
      const sz = d * lerp(0.1, 0.2, rand());
      const cx = lerp(-0.18, 0.18, rand()) * w;
      const cz = lerp(-0.28, 0.28, rand()) * d;
      parts.push(sphere('fleece', [cx, h * 0.5, cz], 0.5, { scale: [sx, h * 0.9, sz], rotation: [0, (rand() - 0.5) * 0.8, 0], plan: false }));
    }
    return parts;
  },
});

// ---------------------------------------------------------------------------
// 18. Layered blackout & sheer curtains on a double rod
// ---------------------------------------------------------------------------

const layeredCurtains = defineItem({
  id: 'layered-blackout-curtains',
  name: 'Blackout & sheer curtains on double rod',
  category: 'bedroom',
  type: 'decor',
  group: 'Curtains & blinds',
  tags: [
    'curtains',
    'blackout',
    'sheer',
    'voile',
    'double rod',
    'drapes',
    'window',
    'rèm cửa',
    'rèm cản sáng',
    'rèm voan',
    'rèm hai lớp',
  ],
  defaultSize: { w: 2.6, d: 0.22, h: 2.55 },
  minSize: { w: 1.0, d: 0.16, h: 1.4 },
  maxSize: { w: 5.0, d: 0.32, h: 3.2 },
  mount: 'wall',
  defaultElevation: 0.03,
  slots: [
    matSlot('blackout', 'Blackout curtains', 'blackout-velvet'),
    matSlot('sheer', 'Sheer voile', 'sheer-voile'),
    matSlot('rod', 'Rods & rings', 'metal-brass'),
  ],
  build: ({ w, d, h }) => {
    const zs = -d / 2 + 0.05;
    const zb = d / 2 - 0.05;
    const yR = h - 0.03;
    const yS = h - 0.045;
    const parts: Part[] = [
      rodX('rod', -w / 2 + 0.05, w / 2 - 0.05, yR, zb, 0.014),
      rodX('rod', -w / 2 + 0.06, w / 2 - 0.06, yS, zs, 0.009, NP),
      sphere('rod', [-w / 2 + 0.028, yR, zb], 0.028, NP),
      sphere('rod', [w / 2 - 0.028, yR, zb], 0.028, NP),
    ];
    for (const bx of spaced(w > 2.8 ? 3 : 2, -w / 2 + 0.14, w / 2 - 0.14)) {
      parts.push(
        sp('rod', [bx - 0.008, bx + 0.008], [yR - 0.012, yR + 0.004], [-d / 2 + 0.004, zb]),
        discZ('rod', [bx, yR - 0.004, -d / 2 + 0.004], 0.024, 0.008, NP),
      );
    }
    // Sheer layer drawn closed across the window.
    const ns = clamp(Math.round((w - 0.16) / 0.09), 8, 40);
    parts.push(...drapeFolds('sheer', [-w / 2 + 0.08, w / 2 - 0.08], [0.01, yS - 0.01], zs, ns, 0.03, NP));
    // Blackout panels gathered at each side on rings.
    const pw = clamp(w * 0.2, 0.3, 0.9);
    const nb = clamp(Math.round(pw / 0.1), 3, 9);
    for (const x0 of [-w / 2 + 0.06, w / 2 - 0.06 - pw]) {
      parts.push(...drapeFolds('blackout', [x0, x0 + pw], [0.015, yR - 0.03], zb, nb, Math.min(0.06, d / 2 - 0.02), { plan: true }));
      for (const x of cells(nb, x0, x0 + pw)) parts.push(torus('rod', [x, yR, zb], 0.02, 0.004, { rotation: [0, Math.PI / 2, 0], plan: false }));
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

/** Distance from a cell coordinate to the nearest integer line. */
const toLine = (a: number): number => Math.abs(a - Math.round(a));

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

const channelQuilt = {
  id: 'channel-quilt',
  name: 'Channel-quilted velvet',
  normalStrength: 1.1,
  // Four plump vertical channels per tile: bright crowns, stitched seams in shadow, and velvet pile
  // streaks with a soft mottled sheen.
  draw(ctx: CanvasRenderingContext2D, size: number, rand: () => number) {
    const N = size;
    const K = 4;
    const pile = tileNoise(N, 160, 6, rand);
    const sheen = tileFbm(N, 3, 4, 3, rand);
    const L = new Float32Array(N * N);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const i = y * N + x;
        const u = ((x + 0.5) / N) * K;
        const f = u - Math.floor(u);
        const crown = Math.sin(Math.PI * f) ** 0.7;
        const seam = 1 - smooth(0, 0.04, Math.min(f, 1 - f));
        L[i] = 0.58 + 0.34 * crown - 0.28 * seam + 0.025 * pile[i] + 0.04 * sheen[i];
      }
    }
    putGrey(ctx, N, L);
  },
};

const caneWeave = {
  id: 'cane-weave',
  name: 'Six-way cane webbing',
  normalStrength: 1.2,
  // Classic cane: vertical and horizontal strands woven over and under, two diagonal strands
  // cutting the cell corners, leaving the familiar octagonal holes (dark) between them.
  draw(ctx: CanvasRenderingContext2D, size: number, rand: () => number) {
    const N = size;
    const C = 6;
    const fibre = tileNoise(N, 220, 30, rand);
    const tone = tileFbm(N, 6, 6, 2, rand);
    const L = new Float32Array(N * N);
    const strand = (dist: number, half: number): number => (dist < half ? 0.7 + 0.25 * Math.sqrt(1 - (dist / half) ** 2) : -1);
    for (let y = 0; y < N; y++) {
      const q = ((y + 0.5) / N) * C;
      for (let x = 0; x < N; x++) {
        const i = y * N + x;
        const p = ((x + 0.5) / N) * C;
        const over = (Math.floor(p + 0.5) + Math.floor(q + 0.5)) % 2 === 0;
        const v = strand(toLine(p), 0.1);
        const hz = strand(toLine(q), 0.1);
        let l = 0.16;
        if (over) {
          if (hz > 0) l = hz;
          if (v > 0) l = v;
        } else {
          if (v > 0) l = v;
          if (hz > 0) l = hz;
        }
        const d1 = strand(toLine(p - q - 0.5) / Math.SQRT2, 0.075);
        const d2 = strand(toLine(p + q - 0.5) / Math.SQRT2, 0.075);
        if (d1 > 0) l = d1 * 0.97;
        if (d2 > 0) l = d2;
        L[i] = l > 0.3 ? l + 0.04 * fibre[i] + 0.03 * tone[i] : l;
      }
    }
    putGrey(ctx, N, L);
  },
};

const fluteRibs = {
  id: 'flute-ribs',
  name: 'Fluted wood',
  normalStrength: 1.3,
  // Eight half-round vertical flutes per tile with shadowed grooves, over straight wood fibre.
  draw(ctx: CanvasRenderingContext2D, size: number, rand: () => number) {
    const N = size;
    const K = 8;
    const grain = tileNoise(N, 96, 3, rand);
    const streak = tileFbm(N, 24, 2, 2, rand);
    const L = new Float32Array(N * N);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const i = y * N + x;
        const f = (((x + 0.5) / N) * K) % 1;
        const prof = Math.sqrt(Math.max(0, 1 - (2 * f - 1) ** 2));
        const groove = 1 - smooth(0, 0.05, Math.min(f, 1 - f));
        L[i] = 0.6 + 0.32 * prof - 0.16 * groove + 0.035 * grain[i] + 0.04 * streak[i];
      }
    }
    putGrey(ctx, N, L);
  },
};

const fleeceCurl = {
  id: 'fleece-curl',
  name: 'Curly fleece',
  normalStrength: 1.0,
  // Hundreds of little curled locks, each a bright arc with a soft shadow, on a mottled ground.
  draw(ctx: CanvasRenderingContext2D, size: number, rand: () => number) {
    const N = size;
    const ground = tileFbm(N, 5, 5, 3, rand);
    const L = new Float32Array(N * N);
    for (let i = 0; i < L.length; i++) L[i] = 0.7 + 0.06 * ground[i];
    putGrey(ctx, N, L);
    ctx.lineCap = 'round';
    for (let k = 0; k < 320; k++) {
      const cx = rand() * N;
      const cy = rand() * N;
      const r = N * (0.012 + rand() * 0.02);
      const a0 = rand() * TAU;
      const sweep = Math.PI * (1.1 + rand() * 0.9);
      const g = Math.round(215 + rand() * 40);
      for (const ox of [-N, 0, N]) {
        for (const oy of [-N, 0, N]) {
          const x = cx + ox;
          const y = cy + oy;
          if (x < -r * 2 || x > N + r * 2 || y < -r * 2 || y > N + r * 2) continue;
          ctx.lineWidth = r * 0.6;
          ctx.strokeStyle = 'rgb(140,140,140)';
          ctx.beginPath();
          ctx.arc(x + r * 0.15, y + r * 0.2, r, a0, a0 + sweep);
          ctx.stroke();
          ctx.lineWidth = r * 0.45;
          ctx.strokeStyle = `rgb(${g},${g},${g})`;
          ctx.beginPath();
          ctx.arc(x, y, r, a0, a0 + sweep);
          ctx.stroke();
        }
      }
    }
  },
};

// ---------------------------------------------------------------------------
// Pack
// ---------------------------------------------------------------------------

export default definePack({
  name: 'Bedroom collection',
  version: '1.0.0',
  author: 'Neest team',
  description:
    'A modern bedroom range: wingback, ottoman, drawer-storage, hotel, Japandi under-glow, lived-in king and house-frame kids beds; floating, cane and cart nightstands; a Hollywood vanity, closet island and fluted dresser; a chaise longue, luggage rack, hamper, sheepskin and layered curtains.',
  license: 'CC0 (made for Neest)',
  items: [
    wingbackBed,
    ottomanBed,
    drawerBed,
    hotelBed,
    japandiBed,
    livedInBed,
    houseBed,
    floatingNightstand,
    caneNightstand,
    bedsideCart,
    closetIsland,
    flutedDresser,
    chaise,
    luggageRack,
    hamper,
    sheepskin,
    layeredCurtains,
  ],
  patterns: [channelQuilt, caneWeave, fluteRibs, fleeceCurl],
  materials: [
    { id: 'velvet-sage', name: 'Sage cotton velvet', category: 'fabric', color: '#7b8b6d', roughness: 0.72, pattern: { id: 'weave', scale: 0.05, contrast: 0.25 } },
    { id: 'channel-velvet-rose', name: 'Channel-quilted velvet, dusty rose', category: 'fabric', color: '#b5867b', roughness: 0.72, pattern: { id: 'channel-quilt', scale: 0.46 } },
    { id: 'channel-velvet-taupe', name: 'Channel-quilted velvet, taupe', category: 'fabric', color: '#a39484', roughness: 0.74, pattern: { id: 'channel-quilt', scale: 0.52 } },
    { id: 'linen-sheet', name: 'White washed linen', category: 'fabric', color: '#f1eee8', roughness: 0.95, pattern: { id: 'weave', scale: 0.08, contrast: 0.4 } },
    { id: 'linen-oat', name: 'Oat stonewashed linen', category: 'fabric', color: '#d6cab8', roughness: 0.95, pattern: { id: 'weave', scale: 0.12, contrast: 0.65 } },
    { id: 'linen-clay', name: 'Clay linen', category: 'fabric', color: '#b47b5c', roughness: 0.93, pattern: { id: 'weave', scale: 0.12, contrast: 0.6 } },
    { id: 'boucle-ivory', name: 'Ivory bouclé', category: 'fabric', color: '#e8e1d4', roughness: 0.97, pattern: { id: 'boucle', scale: 0.14 } },
    { id: 'boucle-oat', name: 'Oatmeal bouclé', category: 'fabric', color: '#c8b598', roughness: 0.97, pattern: { id: 'boucle', scale: 0.14 } },
    { id: 'cane-natural', name: 'Natural cane webbing', category: 'wood', color: '#d4aa6c', roughness: 0.75, pattern: { id: 'cane-weave', scale: 0.11 } },
    { id: 'oak-japandi', name: 'Pale oiled oak', category: 'wood', color: '#c9a476', roughness: 0.6, pattern: { id: 'wood-grain', scale: 0.9, contrast: 0.75 } },
    { id: 'fluted-oak', name: 'Fluted oak', category: 'wood', color: '#c29a6a', roughness: 0.6, pattern: { id: 'flute-ribs', scale: 0.3 } },
    { id: 'sheepskin', name: 'Ivory sheepskin', category: 'rug', color: '#efe8dc', roughness: 1, pattern: { id: 'fleece-curl', scale: 0.28 } },
    { id: 'seagrass', name: 'Seagrass weave', category: 'rug', color: '#b9a37b', roughness: 0.9, pattern: { id: 'jute', scale: 0.09 } },
    { id: 'blackout-velvet', name: 'Slate blackout velvet', category: 'fabric', color: '#3a4a5c', roughness: 0.85, pattern: { id: 'weave', scale: 0.1, contrast: 0.3 } },
    { id: 'sheer-voile', name: 'Ivory sheer voile', category: 'fabric', color: '#f6f3ec', roughness: 0.9, opacity: 0.55, pattern: { id: 'weave', scale: 0.04, contrast: 0.3 } },
    { id: 'powder-sage', name: 'Sage powder-coat', category: 'metal', color: '#9cab95', roughness: 0.5, metalness: 0.35 },
    { id: 'suitcase-shell', name: 'Teal polycarbonate', category: 'solid', color: '#2f5c64', roughness: 0.32 },
    { id: 'led-warm', name: 'Warm LED glow', category: 'solid', color: '#ffd9a8', roughness: 0.4, emissive: '#ffb45e', emissiveIntensity: 2.2 },
    { id: 'bulb-glow', name: 'Vanity bulb glow', category: 'solid', color: '#fff6e6', roughness: 0.3, emissive: '#ffe9c8', emissiveIntensity: 2.8 },
  ],
});

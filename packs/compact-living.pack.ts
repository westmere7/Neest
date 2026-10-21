/**
 * Compact living — space-saving furniture for studios and small modern apartments.
 *
 * Living room:
 *   - lift-top coffee table with hidden storage (lowered + raised)
 *   - round nesting coffee tables (pair)
 *   - C-shaped sofa side table that slides under the sofa
 *   - storage ottoman cube (closed + lid open)
 *   - slatted oak storage bench with padded lid
 *   - apartment loveseat with storage arms (oak book cubbies)
 *   - armless two-seat sofa with bolster
 *   - cube ottoman with four hidden stools
 *   - sofa-back console with two shelves (styled / bare)
 *   - folding floor table (bàn xếp)
 *   - floor-to-ceiling tension pole shelf (styled / bare)
 *   - swivel TV floor stand with TV
 *   - floating media unit with fold-down desk (closed + open)
 * Dining & kitchen:
 *   - wall-mounted drop-leaf table (open + folded)
 *   - tuck-away dining table with four stools
 *   - extending console dining table (closed + extended)
 *   - wall breakfast bar ledge with two stools
 *   - kitchen island cart with drop leaf (leaf down + leaf up)
 *   - slim rolling gap cart (filled / empty)
 *   - stackable birch stools, stack of three
 *   - two folding chairs on a wall rail
 * Storage & laundry:
 *   - wall entry organiser with mirror & hooks
 *   - wall-mounted ironing board cabinet (closed + open)
 *   - wall-mounted drop-down drying rack (open + folded up)
 *
 * Open/closed states are separate items (`variantOf`), listed side by side in the library. Pack
 * materials: an oat chunky knit for throws and a blue ticking stripe for the ironing board cover.
 */
import {
  arcPoints,
  barPull,
  bookRow,
  box,
  cells,
  cellSpans,
  circle,
  clamp,
  cushion,
  cyl,
  defineItem,
  definePack,
  discZ,
  frame4,
  knob,
  lathe,
  lerp,
  line,
  matSlot,
  pillow,
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
  slats,
  spaced,
  span,
  sphere,
  torus,
  vcyl,
  type MaterialSlot,
  type PackItem,
  type Part,
  type PartOpts,
  type Size3,
  type V2,
  type V3,
} from '@/packs/kit';

const NP: PartOpts = { plan: false };
const S3 = (w: number, d: number, h: number): Size3 => ({ w, d, h });
const T18 = 0.018;

// ───────────────────────── Shared helpers ─────────────────────────

/** Parts that are props (books, bottles, vases): see `styled`. */
const PROP = new WeakSet<Part>();
function prop<P extends Part | Part[]>(p: P): P {
  for (const x of Array.isArray(p) ? p : [p]) PROP.add(x);
  return p;
}

/** Splits an item's props off into its default model, with a bare model beside it. */
function styled(item: PackItem, slots: MaterialSlot[], names: [string, string] = ['Styled', 'Bare']): PackItem {
  const raw = item.build;
  const id = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return {
    ...item,
    build: (s) => raw(s).filter((p) => !PROP.has(p)),
    models: [
      { id: id(names[0]), name: names[0], slots, props: (s) => raw(s).filter((p) => PROP.has(p)) },
      { id: id(names[1]), name: names[1] },
    ],
  };
}

/** Swivel castor under a plate whose top is at `top`: a wheel (axle along x), its fork and the plate. */
function castor(wheel: string, fork: string, x: number, z: number, r: number, top: number): Part[] {
  return [
    rodX(wheel, x - 0.008, x + 0.008, r, z, r, { segments: 16, plan: false }),
    span(fork, [x - 0.011, x + 0.011], [r * 1.25, top - 0.004], [z - r * 0.75, z + r * 0.35], NP),
    span(fork, [x - 0.018, x + 0.018], [top - 0.004, top], [z - 0.018, z + 0.018], NP),
  ];
}

/** Books or magazines lying in a loose stack, each turned a little. */
function bookStack(slot: string, cx: number, cz: number, y0: number, n: number, bw: number, bd: number, seed: number, maxH = 1): Part[] {
  const rand = rng(seed);
  const out: Part[] = [];
  let y = y0;
  for (let i = 0; i < n; i++) {
    const t = lerp(0.014, 0.03, rand());
    if (y + t > y0 + maxH) break;
    const k = lerp(0.84, 1, rand());
    out.push(
      box(slot, [cx + (rand() - 0.5) * 0.016, y + t / 2, cz + (rand() - 0.5) * 0.016], [bw * k, t, bd * lerp(0.86, 1, rand())], {
        rotation: [0, (rand() - 0.5) * 0.22, 0],
        bevel: 0.0015,
        plan: false,
      }),
    );
    y += t;
  }
  return out;
}

/** Open-top woven basket: a floor, four walls and a rolled rim front and back. */
function basket(slot: string, x: V2, y0: number, z: V2, bh: number): Part[] {
  const t = 0.008;
  const y1 = y0 + bh;
  return [
    span(slot, [x[0] + t, x[1] - t], [y0, y0 + t], [z[0] + t, z[1] - t], NP),
    span(slot, [x[0], x[0] + t], [y0, y1], z, NP),
    span(slot, [x[1] - t, x[1]], [y0, y1], z, NP),
    span(slot, [x[0] + t, x[1] - t], [y0, y1], [z[0], z[0] + t], NP),
    span(slot, [x[0] + t, x[1] - t], [y0, y1], [z[1] - t, z[1]], NP),
    rodX(slot, x[0] + 0.004, x[1] - 0.004, y1, z[1] - 0.004, 0.006, NP),
    rodX(slot, x[0] + 0.004, x[1] - 0.004, y1, z[0] + 0.004, 0.006, NP),
  ];
}

/** Bellied ceramic vase standing at (x, y, z). */
function vase(slot: string, x: number, y: number, z: number, r: number, vh: number): Part {
  return lathe(
    slot,
    [x, y, z],
    [
      [0, 0],
      [r * 0.62, 0],
      [r, vh * 0.35],
      [r * 0.86, vh * 0.72],
      [r * 0.44, vh * 0.9],
      [r * 0.5, vh],
      [r * 0.42, vh],
      [r * 0.36, vh * 0.92],
    ],
    { segments: 22, plan: false },
  );
}

/** Shallow ceramic bowl standing at (x, y, z). */
function bowl(slot: string, x: number, y: number, z: number, r: number, bh: number): Part {
  return lathe(
    slot,
    [x, y, z],
    [
      [0, 0],
      [r * 0.5, 0],
      [r * 0.85, bh * 0.45],
      [r, bh],
      [r * 0.93, bh],
      [r * 0.78, bh * 0.5],
      [r * 0.4, bh * 0.16],
      [0, bh * 0.16],
    ],
    { segments: 22, plan: false },
  );
}

/** Outline [x, z] of a board whose two front corners (towards +z) are rounded with radius r. */
function frontRounded(x0: number, x1: number, z0: number, z1: number, r: number): V2[] {
  const rr = Math.max(0.002, Math.min(r, (x1 - x0) / 2 - 0.001, z1 - z0 - 0.001));
  return [[x0, z0], [x1, z0], ...arcPoints(x1 - rr, z1 - rr, rr, 0, Math.PI / 2, 6), ...arcPoints(x0 + rr, z1 - rr, rr, Math.PI / 2, Math.PI, 6)];
}

/** Two leaning back cushions over the seat span [x0, x1], resting against a back at zBack. */
function backCushions(slot: string, x0: number, x1: number, ySeat: number, zBack: number, ch: number, ct: number, lean: number): Part[] {
  return cellSpans(2, x0, x1).map(([a, b]) =>
    box(slot, [(a + b) / 2, ySeat + ch / 2 - 0.02, zBack + ct / 2 + 0.018], [b - a - 0.008, ch, ct], { rotation: [-lean, 0, 0], bevel: 0.045, plan: false }),
  );
}

// ───────────────────────── 1–2. Lift-top coffee table ─────────────────────────

const LIFT = 0.16;
const LIFT_FWD = 0.06;

function liftGeom({ w, d, h }: Size3, raised: boolean) {
  const dc = raised ? d - LIFT_FWD : d;
  const hc = raised ? h - LIFT : h;
  const zb = -d / 2;
  const zf = zb + dc;
  const tt = 0.025;
  const yT = hc - tt;
  const yL = clamp(hc * 0.24, 0.08, 0.12);
  const yM = yL + T18 + clamp((yT - yL - T18) * 0.42, 0.08, 0.14);
  const zS = zb + clamp(dc * 0.26, 0.12, 0.17);
  return { w, h, dc, hc, zb, zf, tt, yT, yL, yM, zS };
}

function liftTop(size: Size3, raised: boolean): Part[] {
  const { w, h, zb, zf, tt, yT, yL, yM, zS, hc } = liftGeom(size, raised);
  const t = T18;
  const P: Part[] = [
    span('body', [-w / 2, w / 2], [yL, yL + t], [zb, zf], { bevel: 0.002 }),
    span('body', [-w / 2, -w / 2 + t], [yL + t, yT], [zb, zf], { bevel: 0.002 }),
    span('body', [w / 2 - t, w / 2], [yL + t, yT], [zb, zf], { bevel: 0.002 }),
    span('body', [-w / 2 + t, w / 2 - t], [yL + t, yT], [zb, zb + 0.012], NP),
    span('body', [-w / 2 + t, w / 2 - t], [yM, yM + t], [zb + 0.012, zf], NP),
    span('body', [-w / 2 + t, w / 2 - t], [yM + t, yT], [zf - t, zf], NP),
    span('body', [-t / 2, t / 2], [yL + t, yM], [zb + 0.012, zf - 0.012], NP),
    // Fixed strip at the back and the lid that lifts up and forward.
    span('top', [-w / 2, w / 2], [yT, hc], [zb, zS - 0.002], { bevel: 0.004 }),
  ];
  const ly = raised ? h - tt : yT;
  const lz = raised ? LIFT_FWD : 0;
  P.push(span('top', [-w / 2, w / 2], [ly, ly + tt], [zS + 0.002 + lz, zf + lz], { bevel: 0.004 }));
  for (const sx of [-1, 1]) {
    for (const z of [zb + 0.055, zf - 0.055]) P.push(vcyl('top', sx * (w / 2 - 0.055), z, 0, yL, 0.014, { rTop: 0.021, segments: 16, plan: false }));
  }
  // Magazines in the open niche below the compartment.
  const cellW = w / 2 - 1.5 * t;
  const nz = (zb + 0.012 + zf - 0.012) / 2;
  const nd = zf - zb - 0.1;
  const nh = yM - yL - t - 0.012;
  P.push(...bookStack('books', -w / 4 - t / 4, nz, yL + t, 4, Math.min(0.27, cellW - 0.1), Math.min(0.21, nd), 3, nh));
  P.push(...bookStack('books', w / 4 + t / 4, nz, yL + t, 2, Math.min(0.3, cellW - 0.1), Math.min(0.24, nd), 8, nh));
  if (raised) {
    const yb = yM + t;
    const yl = h - tt;
    for (const s of [-1, 1]) {
      const xp: V2 = s > 0 ? [w / 2 - t - 0.008, w / 2 - t - 0.001] : [-w / 2 + t + 0.001, -w / 2 + t + 0.008];
      const xr = s * (w / 2 - t - 0.014);
      const lo1: V3 = [xr, yb + 0.04, zS + 0.03];
      const lo2: V3 = [xr, yb + 0.04, zS + 0.17];
      const hi1: V3 = [xr, yl - 0.02, zS + LIFT_FWD + 0.18];
      const hi2: V3 = [xr, yl - 0.02, zS + LIFT_FWD + 0.04];
      P.push(
        span('metal', xp, [yb + 0.01, yb + 0.075], [zS, zS + 0.2], NP),
        span('metal', xp, [yl - 0.035, yl - 0.001], [zS + LIFT_FWD + 0.01, zS + LIFT_FWD + 0.21], NP),
        rod('metal', lo1, hi1, 0.005, NP),
        rod('metal', lo2, hi2, 0.005, NP),
        sphere('metal', [xr, (lo1[1] + hi1[1]) / 2, (lo1[2] + hi1[2] + lo2[2] + hi2[2]) / 4], 0.009, NP),
      );
    }
    // A couple of notebooks kept in the compartment.
    const z0 = zS + 0.03;
    const z1 = Math.min(zS + 0.33, zf - t - 0.02);
    P.push(...bookStack('books', -w * 0.16, (z0 + z1) / 2, yb, 3, Math.min(0.24, w * 0.24), Math.min(0.3, z1 - z0 - 0.04), 21, 0.08));
  }
  return P;
}

const LIFT_TAGS = ['lift-top coffee table', 'coffee table', 'hidden storage', 'laptop table', 'small space', 'bàn trà nâng hạ', 'bàn sofa thông minh'];

const liftTopLowered = defineItem({
  id: 'lift-top-coffee-table',
  name: 'Lift-top coffee table with hidden storage',
  category: 'living',
  type: 'surfaces',
  group: 'Coffee tables',
  tags: LIFT_TAGS,
  description:
    'A white coffee table with an oak top on tapered oak legs: the front of the top lifts up and forward to laptop height over a hidden compartment, with an open magazine niche below.',
  defaultSize: S3(1.1, 0.55, 0.45),
  minSize: S3(0.8, 0.48, 0.38),
  maxSize: S3(1.3, 0.7, 0.52),
  slots: [matSlot('top', 'Top, lid & legs', 'wood-oak-natural'), matSlot('body', 'Body', 'laminate-white-matte'), matSlot('books', 'Magazines & books', 'book-mix')],
  build: (s) => liftTop(s, false),
  planDetail: (s) => {
    const g = liftGeom(s, false);
    return [line([-s.w / 2, g.zS], [s.w / 2, g.zS])];
  },
});

const liftTopRaised = defineItem({
  ...liftTopLowered,
  id: 'lift-top-coffee-table-raised',
  name: 'Lift-top coffee table with hidden storage, raised',
  description: 'The lift-top coffee table with its lid raised on black steel lift hinges to laptop and dinner height, showing the hidden compartment under it.',
  variantOf: 'lift-top-coffee-table',
  defaultSize: S3(1.1, 0.61, 0.61),
  minSize: S3(0.8, 0.54, 0.54),
  maxSize: S3(1.3, 0.76, 0.68),
  slots: [...liftTopLowered.slots, matSlot('metal', 'Lift hinges', 'metal-black-matte')],
  build: (s) => liftTop(s, true),
  planDetail: (s) => {
    const g = liftGeom(s, true);
    return [line([-s.w / 2, g.zS + LIFT_FWD], [s.w / 2, g.zS + LIFT_FWD]), line([-s.w / 2, g.zf], [s.w / 2, g.zf])];
  },
});

// ───────────────────────── 3. Round nesting coffee tables ─────────────────────────

function nestGeom({ w, d, h }: Size3) {
  const R1 = Math.min(d, w * 0.84) / 2;
  const R2 = R1 * 0.68;
  const c1: V2 = [-w / 2 + R1, -d / 2 + R1];
  const c2: V2 = [w / 2 - R2, d / 2 - R2];
  const phi = Math.atan2(c2[1] - c1[1], c2[0] - c1[0]);
  return { R1, R2, c1, c2, phi, h2: h - 0.06 };
}

/** Round tabletop with an eased edge, from y0 up by t. */
function roundTop(slot: string, c: V2, y0: number, r: number, t: number): Part {
  return lathe(
    slot,
    [c[0], y0, c[1]],
    [
      [0, 0],
      [r - 0.006, 0],
      [r, 0.005],
      [r, t - 0.005],
      [r - 0.005, t],
      [0, t],
    ],
    { segments: 48 },
  );
}

/** Steel legs on a ring under a round top at angles `a0 + angles`, radius r. */
function ringLegs(slot: string, c: V2, r: number, a0: number, angles: number[], yTop: number): Part[] {
  const out: Part[] = [ring(slot, [c[0], yTop - 0.008, c[1]], r, 0.007, { plan: false })];
  for (const a of angles) {
    const x = c[0] + Math.cos(a0 + a) * r;
    const z = c[1] + Math.sin(a0 + a) * r;
    out.push(vcyl(slot, x, z, 0.008, yTop - 0.006, 0.011, NP), cyl(slot, [x, 0.004, z], 0.013, 0.008, NP));
  }
  return out;
}

const nestingRound = defineItem({
  id: 'round-nesting-coffee-tables',
  name: 'Round nesting coffee tables, pair',
  category: 'living',
  type: 'surfaces',
  group: 'Coffee tables',
  tags: ['nesting coffee tables', 'round coffee table', 'pair', 'walnut', 'travertine', 'small space', 'bàn trà tròn', 'bàn trà lồng nhau'],
  description:
    'Two round coffee tables that nest: a walnut top on three black steel legs and a lower travertine top that slides half under it, or pulls out as a second table.',
  defaultSize: S3(0.95, 0.8, 0.42),
  minSize: S3(0.75, 0.6, 0.36),
  maxSize: S3(1.3, 1.0, 0.48),
  slots: [matSlot('top', 'Large tabletop', 'wood-walnut'), matSlot('top2', 'Small tabletop', 'stone-travertine'), matSlot('legs', 'Legs', 'metal-black-matte')],
  build: (s) => {
    const { R1, R2, c1, c2, phi, h2 } = nestGeom(s);
    const t1 = 0.025;
    const t2 = 0.022;
    return [
      roundTop('top', c1, s.h - t1, R1, t1),
      ...ringLegs('legs', c1, R1 * 0.72, phi, [Math.PI / 2, Math.PI, (3 * Math.PI) / 2], s.h - t1),
      roundTop('top2', c2, h2 - t2, R2, t2),
      ...ringLegs('legs', c2, R2 * 0.72, phi, [Math.PI, Math.PI / 3, -Math.PI / 3], h2 - t2),
    ];
  },
  planDetail: (s) => {
    const { R2, c2 } = nestGeom(s);
    return [circle(c2, R2)];
  },
});

// ───────────────────────── 4. C-shaped sofa side table ─────────────────────────

const cTable = defineItem({
  id: 'c-shaped-sofa-table',
  name: 'C-shaped sofa side table',
  category: 'living',
  type: 'surfaces',
  group: 'End tables',
  tags: ['c table', 'sofa table', 'side table', 'laptop table', 'slide under', 'bàn sofa chữ c', 'bàn cạnh sofa'],
  description:
    'A slim side table whose base slides under the sofa so the rounded oak top reaches over the seat: a black steel tube C frame, handy for a laptop or a cup.',
  defaultSize: S3(0.45, 0.32, 0.62),
  minSize: S3(0.35, 0.25, 0.5),
  maxSize: S3(0.6, 0.45, 0.72),
  slots: [matSlot('top', 'Top', 'wood-oak-natural'), matSlot('frame', 'Steel frame', 'metal-black-matte')],
  build: ({ w, d, h }) => {
    const r = 0.011;
    const tt = 0.022;
    const xs = w / 2 - 0.025;
    const zb = -d / 2 + 0.025;
    const zf = d / 2 - 0.03;
    const yb = r;
    const yt = h - tt - r;
    const P: Part[] = [prism('top', roundRectPoints(0, 0, w, d, 0.035, 5), h - tt, tt)];
    for (const s of [-1, 1]) {
      const x = s * xs;
      P.push(vcyl('frame', x, zb, yb, yt, r, NP), rodZ('frame', x, yb, zb, zf, r, NP), rodZ('frame', x, yt, zb, zf - 0.05, r, NP));
      for (const [y, z] of [
        [yb, zb],
        [yt, zb],
        [yb, zf],
      ] as V2[])
        P.push(sphere('frame', [x, y, z], r, NP));
    }
    P.push(rodX('frame', -xs, xs, yb, zf, r, NP), rodX('frame', -xs, xs, yb, zb, r, NP), rodX('frame', -xs, xs, yt, zb, r, NP), rodX('frame', -xs, xs, h * 0.45, zb, r * 0.8, NP));
    return P;
  },
});

// ───────────────────────── 5–6. Storage ottoman cube ─────────────────────────

function ottoFeet(x: V2, z: V2, yF: number): Part[] {
  const out: Part[] = [];
  for (const fx of [x[0] + 0.045, x[1] - 0.045]) for (const fz of [z[0] + 0.045, z[1] - 0.045]) out.push(vcyl('feet', fx, fz, 0, yF, 0.014, { rTop: 0.019, segments: 14, plan: false }));
  return out;
}

const OTTO_TAGS = ['storage ottoman', 'ottoman', 'pouf', 'footstool', 'blanket box', 'đôn', 'đôn sofa có ngăn chứa', 'ghế đôn'];

const ottomanCube = defineItem({
  id: 'storage-ottoman-cube',
  name: 'Storage ottoman cube',
  category: 'living',
  type: 'seating',
  group: 'Ottomans & poufs',
  tags: OTTO_TAGS,
  description: 'A bouclé-covered cube ottoman on little oak feet with a piped, button-tufted hinged lid: a footrest, extra seat and blanket box in one.',
  defaultSize: S3(0.42, 0.42, 0.43),
  minSize: S3(0.36, 0.36, 0.36),
  maxSize: S3(0.6, 0.6, 0.5),
  slots: [matSlot('body', 'Upholstery', 'fabric-boucle-oat'), matSlot('feet', 'Feet', 'wood-oak-natural')],
  build: ({ w, d, h }) => {
    const yF = 0.03;
    const LID = clamp(h * 0.16, 0.055, 0.08);
    const yl = h - LID;
    const py = yl + 0.008;
    const pr = 0.0055;
    const P: Part[] = [
      ...ottoFeet([-w / 2, w / 2], [-d / 2, d / 2], yF),
      span('body', [-w / 2 + 0.006, w / 2 - 0.006], [yF, yl], [-d / 2 + 0.006, d / 2 - 0.006], { bevel: 0.014 }),
      cushion('body', [-w / 2, w / 2], [yl + 0.002, h], [-d / 2, d / 2], { softness: 0.3 }),
      rodX('body', -w / 2 + 0.012, w / 2 - 0.012, py, d / 2 - 0.004, pr, NP),
      rodX('body', -w / 2 + 0.012, w / 2 - 0.012, py, -d / 2 + 0.004, pr, NP),
      rodZ('body', w / 2 - 0.004, py, -d / 2 + 0.012, d / 2 - 0.012, pr, NP),
      rodZ('body', -w / 2 + 0.004, py, -d / 2 + 0.012, d / 2 - 0.012, pr, NP),
    ];
    for (const x of [-w * 0.2, w * 0.2]) for (const z of [-d * 0.2, d * 0.2]) P.push(sphere('body', [x, h - 0.004, z], 0.009, { scale: [1, 0.55, 1], plan: false }));
    return P;
  },
  planDetail: ({ w, d }) => [rectPoly(-w / 2 + 0.012, -d / 2 + 0.012, w / 2 - 0.012, d / 2 - 0.012)],
});

const ottomanCubeOpen = defineItem({
  ...ottomanCube,
  id: 'storage-ottoman-cube-open',
  name: 'Storage ottoman cube, lid open',
  description: 'The storage ottoman cube with its hinged lid standing open, showing a linen-lined box filled with folded and rolled knit throws.',
  variantOf: 'storage-ottoman-cube',
  defaultSize: S3(0.42, 0.5, 0.78),
  minSize: S3(0.36, 0.44, 0.64),
  maxSize: S3(0.6, 0.68, 1.06),
  slots: [...ottomanCube.slots, matSlot('lining', 'Lining', 'fabric-linen'), matSlot('throws', 'Throws', 'knit-oat')],
  build: ({ w, d, h }) => {
    const yF = 0.03;
    const LID = 0.065;
    const tw = 0.028;
    const z0 = -d / 2 + LID + 0.006;
    const z1 = d / 2 - 0.006;
    const x0 = -w / 2 + 0.006;
    const x1 = w / 2 - 0.006;
    const hb = clamp(h - (d / 2 - z0), 0.26, 0.5);
    const yf = yF + 0.03;
    const yr = hb - 0.006;
    const P: Part[] = [
      ...ottoFeet([x0, x1], [z0, z1], yF),
      span('body', [x0, x1], [yF, hb], [z1 - tw, z1], { bevel: 0.01 }),
      span('body', [x0, x1], [yF, hb], [z0, z0 + tw], { bevel: 0.01 }),
      span('body', [x0, x0 + tw], [yF, hb], [z0 + tw, z1 - tw], { bevel: 0.004 }),
      span('body', [x1 - tw, x1], [yF, hb], [z0 + tw, z1 - tw], { bevel: 0.004 }),
      span('body', [x0 + tw, x1 - tw], [yF, yf], [z0 + tw, z1 - tw], NP),
      // Linen lining inside the box and on the lid.
      span('lining', [x0 + tw, x1 - tw], [yf, yr], [z1 - tw - 0.003, z1 - tw], NP),
      span('lining', [x0 + tw, x1 - tw], [yf, yr], [z0 + tw, z0 + tw + 0.003], NP),
      span('lining', [x0 + tw, x0 + tw + 0.003], [yf, yr], [z0 + tw + 0.003, z1 - tw - 0.003], NP),
      span('lining', [x1 - tw - 0.003, x1 - tw], [yf, yr], [z0 + tw + 0.003, z1 - tw - 0.003], NP),
      span('lining', [x0 + tw, x1 - tw], [yf, yf + 0.003], [z0 + tw, z1 - tw], NP),
      // The lid standing open behind the box, its lined inside facing the front.
      cushion('body', [-w / 2, w / 2], [hb - 0.012, h], [-d / 2, -d / 2 + LID], { softness: 0.3 }),
      span('lining', [-w / 2 + 0.025, w / 2 - 0.025], [hb + 0.02, h - 0.025], [-d / 2 + LID, -d / 2 + LID + 0.003], NP),
      rod('lining', [x1 - tw - 0.012, hb - 0.07, z0 + tw + 0.012], [x1 - 0.035, Math.min(h - 0.05, hb + 0.18), -d / 2 + LID + 0.004], 0.005, NP),
    ];
    // Throws: two folded, one rolled on top.
    const ix: V2 = [x0 + tw + 0.012, x1 - tw - 0.012];
    const iz: V2 = [z0 + tw + 0.012, z1 - tw - 0.012];
    let y = yf + 0.003;
    const th = clamp((hb - y) * 0.27, 0.05, 0.085);
    P.push(cushion('throws', ix, [y, y + th], iz, { softness: 0.35, plan: false }));
    y += th;
    P.push(cushion('throws', [ix[0] + 0.012, ix[1] - 0.01], [y, y + th * 0.9], [iz[0] + 0.008, iz[1] - 0.012], { softness: 0.35, plan: false }));
    y += th * 0.9;
    const rr = Math.min(0.05, (iz[1] - iz[0]) / 3);
    P.push(rodX('throws', ix[0] + 0.02, ix[1] - 0.02, y + rr, (iz[0] + iz[1]) / 2, rr, { segments: 18, plan: false }));
    return P;
  },
  planDetail: ({ w, d }) => [line([-w / 2, -d / 2 + 0.065], [w / 2, -d / 2 + 0.065])],
});

// ───────────────────────── 7. Slatted oak storage bench ─────────────────────────

const storageBench = defineItem({
  id: 'slatted-storage-bench',
  name: 'Slatted oak storage bench with padded lid',
  category: 'living',
  type: 'seating',
  group: 'Stools & benches',
  tags: ['storage bench', 'bench', 'lift lid', 'padded', 'slatted', 'oak', 'ghế băng', 'ghế dài có ngăn chứa'],
  description:
    'An oak storage bench with slatted sides and a padded, button-tufted linen lid that lifts for blankets or shoes, with cognac leather pull straps at each end.',
  defaultSize: S3(1.0, 0.4, 0.46),
  minSize: S3(0.7, 0.34, 0.4),
  maxSize: S3(1.5, 0.5, 0.52),
  wallSnap: true,
  slots: [matSlot('frame', 'Oak frame', 'wood-oak-light'), matSlot('seat', 'Seat pad', 'fabric-linen'), matSlot('handles', 'Leather handles', 'leather-cognac')],
  build: ({ w, d, h }) => {
    const p = 0.04;
    const yB = 0.1;
    const yT = h - 0.075;
    const rail = 0.04;
    const P: Part[] = [];
    for (const xr of [
      [-w / 2, -w / 2 + p],
      [w / 2 - p, w / 2],
    ] as V2[]) {
      for (const zr of [
        [-d / 2, -d / 2 + p],
        [d / 2 - p, d / 2],
      ] as V2[])
        P.push(span('frame', xr, [0, yT], zr, { bevel: 0.004 }));
    }
    const nx = clamp(Math.round((w - 2 * p) / 0.055), 6, 24);
    const nz = clamp(Math.round((d - 2 * p) / 0.055), 3, 8);
    for (const s of [-1, 1]) {
      const zo: V2 = s > 0 ? [d / 2 - 0.03, d / 2 - 0.008] : [-d / 2 + 0.008, -d / 2 + 0.03];
      const zs: V2 = s > 0 ? [d / 2 - 0.026, d / 2 - 0.012] : [-d / 2 + 0.012, -d / 2 + 0.026];
      const zl: V2 = s > 0 ? [d / 2 - 0.04, d / 2 - 0.03] : [-d / 2 + 0.03, -d / 2 + 0.04];
      P.push(span('frame', [-w / 2 + p, w / 2 - p], [yB, yB + rail], zo, NP), span('frame', [-w / 2 + p, w / 2 - p], [yT - rail, yT], zo, NP));
      P.push(...slats('frame', [-w / 2 + p, w / 2 - p], [yB + rail, yT - rail], zs, nx, { axis: 'x', gap: 0.42, bevel: 0.002, plan: false }));
      P.push(span('frame', [-w / 2 + p, w / 2 - p], [yB, yT], zl, NP));
      const xo: V2 = s > 0 ? [w / 2 - 0.03, w / 2 - 0.008] : [-w / 2 + 0.008, -w / 2 + 0.03];
      const xs: V2 = s > 0 ? [w / 2 - 0.026, w / 2 - 0.012] : [-w / 2 + 0.012, -w / 2 + 0.026];
      const xl: V2 = s > 0 ? [w / 2 - 0.04, w / 2 - 0.03] : [-w / 2 + 0.03, -w / 2 + 0.04];
      P.push(span('frame', xo, [yB, yB + rail], [-d / 2 + p, d / 2 - p], NP), span('frame', xo, [yT - rail, yT], [-d / 2 + p, d / 2 - p], NP));
      P.push(...slats('frame', xs, [yB + rail, yT - rail], [-d / 2 + p, d / 2 - p], nz, { axis: 'z', gap: 0.42, bevel: 0.002, plan: false }));
      P.push(span('frame', xl, [yB, yT], [-d / 2 + 0.04, d / 2 - 0.04], NP));
      // Leather pull strap on the top end rail.
      const xe = s * (w / 2 - 0.008);
      const out = s * 0.013;
      for (const z of [-0.0625, 0.0625]) P.push(span('handles', s > 0 ? [xe, xe + 0.005] : [xe - 0.005, xe], [yT - 0.032, yT - 0.008], [z - 0.0125, z + 0.0125], NP));
      P.push(
        ...rodPath(
          'handles',
          [
            [xe + s * 0.003, yT - 0.02, -0.062],
            [xe + out * 0.75, yT - 0.026, -0.03],
            [xe + out, yT - 0.028, 0],
            [xe + out * 0.75, yT - 0.026, 0.03],
            [xe + s * 0.003, yT - 0.02, 0.062],
          ],
          0.007,
        ),
      );
    }
    P.push(span('frame', [-w / 2 + 0.04, w / 2 - 0.04], [yB, yB + 0.012], [-d / 2 + 0.04, d / 2 - 0.04], NP));
    // Lid board and padded seat with buttons.
    P.push(span('frame', [-w / 2, w / 2], [yT, yT + 0.018], [-d / 2, d / 2], { bevel: 0.003 }));
    P.push(cushion('seat', [-w / 2 + 0.008, w / 2 - 0.008], [yT + 0.018, h], [-d / 2 + 0.008, d / 2 - 0.008], { softness: 0.4 }));
    const bx = clamp(Math.round(w / 0.25), 3, 6);
    for (const x of cells(bx, -w / 2 + 0.05, w / 2 - 0.05)) for (const z of [-d * 0.18, d * 0.18]) P.push(sphere('seat', [x, h - 0.004, z], 0.008, { scale: [1, 0.55, 1], plan: false }));
    return P;
  },
  planDetail: ({ w, d }) => [rectPoly(-w / 2 + 0.008, -d / 2 + 0.008, w / 2 - 0.008, d / 2 - 0.008)],
});

// ───────────────────────── 8. Apartment loveseat with storage arms ─────────────────────────

const storageLoveseat = defineItem({
  id: 'storage-arm-loveseat',
  name: 'Apartment loveseat with storage arms',
  category: 'living',
  type: 'seating',
  group: 'Sofas & loveseats',
  tags: ['loveseat', 'two-seater', 'apartment sofa', 'storage arms', 'book cubbies', 'small space', 'sofa văng', 'sofa 2 chỗ', 'sofa nhỏ'],
  description:
    'A 1.4 m two-seater for small living rooms: grey wool upholstery, loose seat and back cushions, and wide arms with oak caps and open book cubbies facing the front, on tapered oak legs.',
  defaultSize: S3(1.4, 0.8, 0.82),
  minSize: S3(1.2, 0.72, 0.75),
  maxSize: S3(1.7, 0.9, 0.9),
  wallSnap: true,
  slots: [
    matSlot('upholstery', 'Upholstery', 'fabric-wool-grey'),
    matSlot('cushions', 'Seat & back cushions', 'fabric-wool-grey'),
    matSlot('wood', 'Legs, arm caps & cubbies', 'wood-oak-natural'),
    matSlot('books', 'Books', 'book-mix'),
  ],
  build: ({ w, d, h }) => {
    const yL = 0.12;
    const aw = clamp(w * 0.13, 0.16, 0.22);
    const ah = clamp(h * 0.72, 0.54, 0.64);
    const cap = 0.022;
    const xa = w / 2 - aw;
    const bd = clamp(d * 0.22, 0.15, 0.2);
    const ySeat = 0.3;
    const yTop = 0.44;
    const zs0 = -d / 2 + bd;
    const P: Part[] = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.push(vcyl('wood', sx * (w / 2 - aw / 2), sz * (d / 2 - 0.07), 0, yL, 0.016, { rTop: 0.022, segments: 14, plan: false }));
    P.push(cushion('upholstery', [-xa, xa], [yL, h], [-d / 2, zs0], { softness: 0.28 }));
    P.push(span('upholstery', [-xa, xa], [yL, ySeat], [zs0, d / 2], { bevel: 0.01 }));
    for (const [a, b] of cellSpans(2, -xa + 0.004, xa - 0.004)) P.push(cushion('cushions', [a + 0.003, b - 0.003], [ySeat, yTop], [zs0 + 0.004, d / 2 - 0.006], { softness: 0.32 }));
    P.push(...backCushions('cushions', -xa + 0.004, xa - 0.004, yTop, zs0, clamp(h - yTop - 0.06, 0.26, 0.4), 0.15, 0.16));
    const ph = clamp(h - yTop - 0.1, 0.26, 0.36);
    P.push(pillow('cushions', [-xa + 0.2, yTop + ph * 0.42, zs0 + 0.17], 0.4, ph, 0.13, { lean: 0.3, turn: 0.3 }));
    // Arms: upholstered shells with an oak-lined cubby facing the front and an oak cap.
    const wt = 0.03;
    const yn0 = yL + clamp((ah - yL) * 0.2, 0.08, 0.12);
    const yn1 = ah - clamp((ah - yL) * 0.16, 0.06, 0.09);
    const nd = Math.min(0.32, d - 0.2);
    const zc = d / 2 - nd;
    for (const s of [-1, 1]) {
      const x0 = s < 0 ? -w / 2 : xa;
      const x1 = s < 0 ? -xa : w / 2;
      const ix: V2 = [x0 + wt, x1 - wt];
      P.push(
        cushion('upholstery', [x0, x0 + wt], [yL, ah], [-d / 2, d / 2], { softness: 0.25 }),
        cushion('upholstery', [x1 - wt, x1], [yL, ah], [-d / 2, d / 2], { softness: 0.25 }),
        span('upholstery', ix, [yL, yn0], [-d / 2, d / 2]),
        span('upholstery', ix, [yn1, ah], [-d / 2, d / 2]),
        span('upholstery', ix, [yn0, yn1], [-d / 2, zc]),
        span('wood', [x0, x1], [ah, ah + cap], [-d / 2, d / 2], { bevel: 0.005 }),
        span('wood', ix, [yn0, yn0 + 0.012], [zc, d / 2 - 0.004], NP),
        span('wood', ix, [yn1 - 0.012, yn1], [zc, d / 2 - 0.004], NP),
        span('wood', [ix[0], ix[0] + 0.01], [yn0 + 0.012, yn1 - 0.012], [zc, d / 2 - 0.004], NP),
        span('wood', [ix[1] - 0.01, ix[1]], [yn0 + 0.012, yn1 - 0.012], [zc, d / 2 - 0.004], NP),
        span('wood', [ix[0] + 0.01, ix[1] - 0.01], [yn0 + 0.012, yn1 - 0.012], [zc, zc + 0.01], NP),
      );
      P.push(
        ...bookRow('books', [ix[0] + 0.012, ix[1] - 0.012], yn0 + 0.012, zc + 0.012, Math.min(0.24, yn1 - yn0 - 0.045), Math.min(0.2, nd - 0.05), s < 0 ? 5 : 11, {
          fill: s < 0 ? 0.95 : 0.6,
        }),
      );
    }
    return P;
  },
  planDetail: ({ w, d }) => {
    const xa = w / 2 - clamp(w * 0.13, 0.16, 0.22);
    const zs0 = -d / 2 + clamp(d * 0.22, 0.15, 0.2);
    return [line([0, zs0], [0, d / 2]), line([-xa, zs0], [xa, zs0])];
  },
});

// ───────────────────────── 9. Armless two-seat sofa ─────────────────────────

const armlessSofa = defineItem({
  id: 'armless-two-seat-sofa',
  name: 'Armless two-seat sofa with bolster',
  category: 'living',
  type: 'seating',
  group: 'Sofas & loveseats',
  tags: ['armless sofa', 'two-seat sofa', 'loveseat', 'small sofa', 'studio', 'bolster', 'sofa không tay', 'sofa đôi'],
  description:
    'A slim armless two-seater in sage linen on tapered walnut legs, with loose seat and back cushions, a round bolster at one end and a mustard pillow: it fits a short wall and opens on both sides.',
  defaultSize: S3(1.3, 0.78, 0.78),
  minSize: S3(1.1, 0.7, 0.72),
  maxSize: S3(1.6, 0.88, 0.86),
  wallSnap: true,
  slots: [
    matSlot('upholstery', 'Upholstery', 'fabric-linen-sage'),
    matSlot('cushions', 'Seat & back cushions', 'fabric-linen-sage'),
    matSlot('legs', 'Legs', 'wood-walnut'),
    matSlot('pillow', 'Bolster & pillow', 'fabric-mustard'),
  ],
  build: ({ w, d, h }) => {
    const yL = 0.16;
    const ySeat = 0.3;
    const yTop = 0.44;
    const bd = clamp(d * 0.2, 0.14, 0.18);
    const zs0 = -d / 2 + bd;
    const P: Part[] = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.push(vcyl('legs', sx * (w / 2 - 0.08), sz * (d / 2 - 0.08), 0, yL, 0.013, { rTop: 0.02, segments: 14, plan: false }));
    P.push(cushion('upholstery', [-w / 2, w / 2], [yL, ySeat], [-d / 2, d / 2], { softness: 0.25 }));
    P.push(cushion('upholstery', [-w / 2, w / 2], [ySeat - 0.03, h], [-d / 2, zs0], { softness: 0.3 }));
    P.push(rodX('upholstery', -w / 2 + 0.03, w / 2 - 0.03, ySeat - 0.006, d / 2 - 0.014, 0.005, NP));
    for (const [a, b] of cellSpans(2, -w / 2 + 0.012, w / 2 - 0.012)) P.push(cushion('cushions', [a + 0.003, b - 0.003], [ySeat, yTop], [zs0 + 0.004, d / 2 - 0.01], { softness: 0.32 }));
    P.push(...backCushions('cushions', -w / 2 + 0.012, w / 2 - 0.012, yTop, zs0, clamp(h - yTop - 0.06, 0.24, 0.36), 0.15, 0.16));
    // Bolster lying along the right end, and a pillow on the left.
    const br = 0.085;
    const bx = w / 2 - 0.1;
    const by = yTop + br;
    const bz0 = zs0 + 0.17;
    const bz1 = d / 2 - 0.05;
    P.push(rodZ('pillow', bx, by, bz0, bz1, br, { segments: 22, plan: false }));
    for (const z of [bz0, bz1]) {
      P.push(sphere('pillow', [bx, by, z], br, { scale: [1, 1, 0.3], plan: false }));
      P.push(torus('pillow', [bx, by, z], br - 0.006, 0.006, NP));
    }
    const ph = clamp(h - yTop - 0.1, 0.26, 0.36);
    P.push(pillow('pillow', [-w / 2 + 0.25, yTop + ph * 0.42, zs0 + 0.17], 0.42, ph, 0.13, { lean: 0.28, turn: -0.25 }));
    return P;
  },
  planDetail: ({ d }) => [line([0, -d / 2 + clamp(d * 0.2, 0.14, 0.18)], [0, d / 2])],
});

// ───────────────────────── 10. Cube ottoman with four hidden stools ─────────────────────────

const hiddenStools = defineItem({
  id: 'ottoman-hidden-stools',
  name: 'Cube ottoman with four hidden stools',
  category: 'living',
  type: 'seating',
  group: 'Ottomans & poufs',
  tags: ['ottoman', 'hidden stools', 'nesting stools', 'pouf', 'extra seating', 'đôn', 'ghế đôn', 'đôn kèm 4 ghế'],
  description:
    'A big bouclé cube ottoman with a walnut-banded lid; its sides are four small upholstered stools that pull out in a pinwheel when guests come.',
  defaultSize: S3(0.76, 0.76, 0.43),
  minSize: S3(0.6, 0.6, 0.38),
  maxSize: S3(0.9, 0.9, 0.48),
  slots: [matSlot('body', 'Upholstery', 'fabric-boucle'), matSlot('tray', 'Lid band', 'wood-walnut'), matSlot('feet', 'Stool feet', 'plastic-black')],
  build: ({ w, d, h }) => {
    const LH = 0.07;
    const ys = h - LH - 0.004;
    const ax = w * 0.6;
    const bx = w * 0.4;
    const az = d * 0.6;
    const bz = d * 0.4;
    const rects: [V2, V2][] = [
      [
        [-w / 2, -w / 2 + ax],
        [-d / 2, -d / 2 + bz],
      ],
      [
        [-w / 2 + ax, w / 2],
        [-d / 2, -d / 2 + az],
      ],
      [
        [w / 2 - ax, w / 2],
        [d / 2 - bz, d / 2],
      ],
      [
        [-w / 2, -w / 2 + bx],
        [-d / 2 + bz, d / 2],
      ],
    ];
    const P: Part[] = [];
    for (const [xr, zr] of rects) {
      P.push(cushion('body', [xr[0] + 0.003, xr[1] - 0.003], [0.022, ys], [zr[0] + 0.003, zr[1] - 0.003], { softness: 0.16 }));
      for (const fx of [xr[0] + 0.04, xr[1] - 0.04]) for (const fz of [zr[0] + 0.04, zr[1] - 0.04]) P.push(vcyl('feet', fx, fz, 0, 0.022, 0.011, NP));
    }
    P.push(span('tray', [-w / 2, w / 2], [h - LH, h - LH + 0.022], [-d / 2, d / 2], { bevel: 0.004 }));
    P.push(cushion('body', [-w / 2 + 0.012, w / 2 - 0.012], [h - LH + 0.022, h], [-d / 2 + 0.012, d / 2 - 0.012], { softness: 0.38 }));
    return P;
  },
  planDetail: ({ w, d }) => [rectPoly(-w / 2 + 0.012, -d / 2 + 0.012, w / 2 - 0.012, d / 2 - 0.012)],
});

// ───────────────────────── 11. Sofa-back console with shelves ─────────────────────────

const sofaConsole = styled(
  defineItem({
    id: 'sofa-back-console',
    name: 'Sofa-back console with two shelves',
    category: 'living',
    type: 'surfaces',
    group: 'Console tables',
    tags: ['console table', 'sofa table', 'behind sofa', 'narrow', 'shelves', 'hallway', 'bàn console', 'kệ sau sofa'],
    description:
      'A narrow console that stands behind a sofa or along a hallway wall: an oak top and two oak shelves on a slim black steel frame, styled with books, a basket and ceramics.',
    defaultSize: S3(1.4, 0.28, 0.76),
    minSize: S3(0.9, 0.22, 0.65),
    maxSize: S3(1.9, 0.35, 0.85),
    wallSnap: true,
    slots: [matSlot('shelf', 'Top & shelves', 'wood-oak-natural'), matSlot('frame', 'Steel frame', 'metal-black-matte')],
    build: ({ w, d, h }) => {
      const tb = 0.022;
      const tt = 0.025;
      const ys = [0.1, Math.round(h * 0.5 * 1000) / 1000];
      const P: Part[] = [span('shelf', [-w / 2, w / 2], [h - tt, h], [-d / 2, d / 2], { bevel: 0.004 })];
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const x = sx * (w / 2 - tb / 2);
          const z = sz * (d / 2 - tb / 2);
          P.push(span('frame', [x - tb / 2, x + tb / 2], [0, h - tt], [z - tb / 2, z + tb / 2], NP));
        }
        const xr: V2 = sx < 0 ? [-w / 2, -w / 2 + tb] : [w / 2 - tb, w / 2];
        for (const y of [...ys, h - tt]) P.push(span('frame', xr, [y - 0.022, y], [-d / 2 + tb, d / 2 - tb], NP));
      }
      for (const sz of [-1, 1]) P.push(span('frame', [-w / 2 + tb, w / 2 - tb], [h - tt - 0.03, h - tt], sz < 0 ? [-d / 2, -d / 2 + tb] : [d / 2 - tb, d / 2], NP));
      for (const y of ys) P.push(span('shelf', [-w / 2 + 0.003, w / 2 - 0.003], [y, y + 0.02], [-d / 2 + 0.003, d / 2 - 0.003], { bevel: 0.002, plan: false }));
      // Styling: books and a vase on the middle shelf, a basket below, books and a bowl on top.
      const yb = ys[0] + 0.02;
      const ym = ys[1] + 0.02;
      const gap = h - tt - 0.03 - ym;
      const bw = Math.min(0.44, w * 0.32);
      const bd = Math.min(0.2, d - 0.05);
      P.push(...prop(bookRow('books', [-w / 2 + 0.05, -w / 2 + 0.05 + bw], ym, -d / 2 + 0.02, Math.min(0.24, gap - 0.04), bd, 31, { lean: true })));
      P.push(prop(vase('decor', w * 0.22, ym, 0, Math.min(0.065, d / 2 - 0.03), Math.min(0.22, gap - 0.03))));
      const kw = Math.min(0.36, w * 0.3);
      P.push(...prop(basket('basket', [w / 2 - 0.06 - kw, w / 2 - 0.06], yb, [-d / 2 + 0.025, d / 2 - 0.025], Math.min(0.2, ym - 0.02 - yb - 0.06))));
      P.push(...prop(bookStack('books', -w * 0.2, 0, yb, 3, Math.min(0.3, w * 0.22), Math.min(0.22, d - 0.06), 17, 0.08)));
      P.push(...prop(bookStack('books', -w * 0.28, 0, h, 2, Math.min(0.26, w * 0.2), Math.min(0.19, d - 0.07), 23)));
      P.push(prop(bowl('decor', w * 0.26, h, 0, Math.min(0.11, d / 2 - 0.02), 0.06)));
      return P;
    },
  }),
  [matSlot('books', 'Books', 'book-mix'), matSlot('decor', 'Ceramics', 'ceramic-white'), matSlot('basket', 'Basket', 'rattan-natural')],
);

// ───────────────────────── 12. Folding floor table ─────────────────────────

const floorTable = defineItem({
  id: 'folding-floor-table',
  name: 'Folding floor table (bàn xếp)',
  category: 'living',
  type: 'surfaces',
  group: 'Coffee tables',
  tags: ['folding table', 'floor table', 'low table', 'study table', 'bàn xếp', 'bàn gấp', 'bàn ngồi bệt', 'bàn học gấp'],
  description:
    'A low oak-laminate floor table with rounded corners on two black steel leg frames that fold flat under the top: for meals, study or tea sitting on the floor, then it slides under the bed.',
  defaultSize: S3(0.8, 0.5, 0.32),
  minSize: S3(0.6, 0.4, 0.28),
  maxSize: S3(1.2, 0.7, 0.36),
  slots: [matSlot('top', 'Tabletop', 'laminate-oak'), matSlot('legs', 'Folding legs', 'metal-black-matte'), matSlot('feet', 'Foot caps', 'rubber-black')],
  build: ({ w, d, h }) => {
    const tt = 0.02;
    const yU = h - tt;
    const lz = d / 2 - 0.07;
    const r = 0.011;
    const yP = yU - 0.022;
    const P: Part[] = [prism('top', roundRectPoints(0, 0, w, d, 0.04, 5), yU, tt)];
    for (const s of [-1, 1]) {
      const x = s * (w / 2 - 0.11);
      const xf = x + s * 0.03;
      const at = (y: number) => lerp(xf, x, (y - 0.012) / (yP - 0.012));
      for (const z of [-lz, lz]) {
        P.push(span('legs', [x - 0.02, x + 0.02], [yU - 0.012, yU], [z - 0.025, z + 0.025], NP));
        P.push(rod('legs', [x, yP, z], [xf, 0.012, z], r, NP));
        P.push(sphere('feet', [xf, 0.012, z], 0.016, { scale: [1, 0.75, 1.4], plan: false }));
      }
      P.push(rodZ('legs', x, yP, -lz - 0.012, lz + 0.012, r, NP));
      P.push(rodZ('legs', at(0.06), 0.06, -lz, lz, r * 0.8, NP));
      // Folding brace from a mid rail up to a bracket under the top.
      const ym = yP * 0.5;
      P.push(rodZ('legs', at(ym), ym, -lz, lz, r * 0.7, NP));
      P.push(rod('legs', [at(ym), ym, 0], [x - s * 0.13, yU - 0.008, 0], 0.006, NP));
      P.push(span('legs', [x - s * 0.13 - 0.02, x - s * 0.13 + 0.02], [yU - 0.008, yU], [-0.02, 0.02], NP));
    }
    return P;
  },
});

// ───────────────────────── 13–14. Wall-mounted drop-leaf table ─────────────────────────

const DL = { tt: 0.025, sd: 0.1, bt: 0.018 };
const DROP_TAGS = ['drop-leaf table', 'wall table', 'folding table', 'fold-down table', 'space saving', 'bàn gấp treo tường', 'bàn ăn gấp gọn', 'bàn treo tường'];

const wallDropLeaf = defineItem({
  id: 'wall-drop-leaf-table',
  name: 'Wall-mounted drop-leaf table',
  category: 'dining',
  type: 'surfaces',
  group: 'Dining tables',
  tags: DROP_TAGS,
  description:
    'An oak table leaf hinged to a narrow wall shelf and held level by two black folding steel brackets: a two-seat dining or work table that needs no floor space.',
  defaultSize: S3(0.8, 0.6, 0.37),
  minSize: S3(0.6, 0.45, 0.3),
  maxSize: S3(1.2, 0.8, 0.45),
  mount: 'wall',
  defaultElevation: 0.38,
  slots: [matSlot('top', 'Tabletop & shelf', 'wood-oak-natural'), matSlot('panel', 'Wall panel', 'laminate-white-matte'), matSlot('metal', 'Folding brackets', 'metal-black-matte')],
  build: ({ w, d, h }) => {
    const { tt, sd, bt } = DL;
    const zb = -d / 2;
    const yT = h - tt;
    const P: Part[] = [
      span('panel', [-w / 2 + 0.02, w / 2 - 0.02], [0, yT], [zb, zb + bt]),
      span('top', [-w / 2, w / 2], [yT, h], [zb, zb + sd - 0.001], { bevel: 0.003 }),
      prism('top', frontRounded(-w / 2, w / 2, zb + sd + 0.001, d / 2, 0.06), yT, tt),
    ];
    const L = Math.max(0.15, (d - bt) * 0.72);
    const z0 = zb + bt;
    for (const s of [-1, 1]) {
      const x = s * (w / 2 - 0.09);
      const a: V3 = [x, 0.07, z0 + 0.02];
      const b: V3 = [x, yT - 0.024, z0 + L * 0.82];
      P.push(
        span('metal', [x - 0.012, x + 0.012], [0.04, yT], [z0, z0 + 0.02], NP),
        span('metal', [x - 0.012, x + 0.012], [yT - 0.024, yT], [z0 + 0.02, z0 + L], NP),
        rod('metal', a, b, 0.008, NP),
        sphere('metal', a, 0.012, NP),
        sphere('metal', b, 0.012, NP),
      );
    }
    for (const x of [-w * 0.27, w * 0.27]) P.push(span('metal', [x - 0.035, x + 0.035], [yT - 0.003, yT], [zb + sd - 0.025, zb + sd + 0.025], NP));
    return P;
  },
  planDetail: ({ w, d }) => [line([-w / 2, -d / 2 + DL.sd], [w / 2, -d / 2 + DL.sd])],
});

const wallDropLeafFolded = defineItem({
  ...wallDropLeaf,
  id: 'wall-drop-leaf-table-folded',
  name: 'Wall-mounted drop-leaf table, folded',
  description: 'The wall-mounted drop-leaf table folded down flat against the wall, leaving just a 10 cm oak shelf for keys and a lamp.',
  variantOf: 'wall-drop-leaf-table',
  defaultSize: S3(0.8, 0.14, 0.53),
  minSize: S3(0.6, 0.12, 0.42),
  maxSize: S3(1.2, 0.18, 0.62),
  defaultElevation: 0.22,
  build: ({ w, d, h }) => {
    const { tt, bt } = DL;
    const sd = Math.min(DL.sd, d - tt - 0.01);
    const zb = -d / 2;
    const yT = h - tt;
    const L = yT - 0.012;
    const zl = zb + sd + 0.002;
    const leaf = prism('top', frontRounded(-w / 2, w / 2, -L / 2, L / 2, 0.06), 0, tt, NP);
    const P: Part[] = [
      span('panel', [-w / 2 + 0.02, w / 2 - 0.02], [0, yT], [zb, zb + bt]),
      span('top', [-w / 2, w / 2], [yT, h], [zb, zb + sd], { bevel: 0.003 }),
      // The leaf hangs from the shelf's front edge, rounded corners down.
      { ...leaf, position: [0, yT - 0.004 - L / 2, zl], rotation: [Math.PI / 2, 0, 0] },
      span('metal', [-0.04, 0.04], [0.02, 0.034], [zl + tt, zl + tt + 0.005], NP),
    ];
    for (const s of [-1, 1]) {
      const x = s * (w / 2 - 0.09);
      P.push(span('metal', [x - 0.012, x + 0.012], [0.04, yT], [zb + bt, zb + bt + 0.02], NP));
      P.push(span('metal', [x - 0.012, x + 0.012], [yT - Math.min(0.42, L * 0.75), yT - 0.004], [zb + bt + 0.02, zb + bt + 0.044], NP));
    }
    return P;
  },
  planDetail: ({ w, d }) => [line([-w / 2, -d / 2 + Math.min(DL.sd, d - DL.tt - 0.01)], [w / 2, -d / 2 + Math.min(DL.sd, d - DL.tt - 0.01)])],
});

// ───────────────────────── 15. Tuck-away dining set ─────────────────────────

function tuckStool(x: V2, z: V2, hs: number): Part[] {
  const st = 0.022;
  const ins = 0.012;
  const lg = 0.03;
  const ySeat = hs - 0.045;
  const out: Part[] = [
    span('stool', x, [ySeat, ySeat + st], z, { bevel: 0.003, plan: false }),
    cushion('pad', [x[0] + 0.006, x[1] - 0.006], [ySeat + st, hs], [z[0] + 0.006, z[1] - 0.006], { softness: 0.4, plan: false }),
  ];
  for (const xx of [x[0] + ins, x[1] - ins - lg]) for (const zz of [z[0] + ins, z[1] - ins - lg]) out.push(span('stool', [xx, xx + lg], [0, ySeat], [zz, zz + lg], NP));
  for (const zz of [z[0] + ins + lg / 2, z[1] - ins - lg / 2]) out.push(span('stool', [x[0] + ins + lg, x[1] - ins - lg], [0.14, 0.16], [zz - 0.008, zz + 0.008], NP));
  return out;
}

const tuckAway = defineItem({
  id: 'tuck-away-dining-set',
  name: 'Tuck-away dining table with four stools',
  category: 'dining',
  type: 'surfaces',
  group: 'Dining tables',
  tags: ['dining set', 'space saving', 'stools', 'compact dining table', 'table for four', 'bộ bàn ăn thông minh', 'bàn ăn gấp gọn', 'bàn ăn 4 ghế'],
  description:
    'A compact oak dining table for four whose rust-linen stools slide right under it between the legs, so the whole set takes no more floor than the table.',
  defaultSize: S3(1.0, 0.65, 0.75),
  minSize: S3(0.85, 0.6, 0.72),
  maxSize: S3(1.3, 0.8, 0.78),
  slots: [matSlot('table', 'Table', 'wood-oak-light'), matSlot('stool', 'Stool frames', 'wood-oak-light'), matSlot('pad', 'Seat pads', 'fabric-linen-rust')],
  build: ({ w, d, h }) => {
    const tt = 0.028;
    const lg = 0.045;
    const P: Part[] = [span('table', [-w / 2, w / 2], [h - tt, h], [-d / 2, d / 2], { bevel: 0.005 })];
    const lx: V2 = [w / 2 - 0.005 - lg, w / 2 - 0.005];
    const lz: V2 = [d / 2 - 0.005 - lg, d / 2 - 0.005];
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        P.push(span('table', sx < 0 ? [-lx[1], -lx[0]] : lx, [0, h - tt], sz < 0 ? [-lz[1], -lz[0]] : lz, NP));
      }
      P.push(span('table', sx < 0 ? [-w / 2 + 0.02, -w / 2 + 0.038] : [w / 2 - 0.038, w / 2 - 0.02], [h - 0.1, h - tt], [-lz[0], lz[0]], NP));
      P.push(span('table', [-lx[0], lx[0]], [h - 0.09, h - tt], sx < 0 ? [-d / 2 + 0.017, -d / 2 + 0.035] : [d / 2 - 0.035, d / 2 - 0.017], NP));
    }
    const gx = 0.012;
    const sw = clamp((w - 0.01 - 2 * lg - 3 * gx) / 2, 0.3, 0.46);
    const sd = clamp((d - 0.03) / 2, 0.24, 0.36);
    const hs = clamp(h - 0.3, 0.42, 0.46);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const x0 = sx < 0 ? -gx / 2 - sw : gx / 2;
        const z0 = sz < 0 ? -0.003 - sd : 0.003;
        P.push(...tuckStool([x0, x0 + sw], [z0, z0 + sd], hs));
      }
    }
    return P;
  },
});

// ───────────────────────── 16–17. Extending console dining table ─────────────────────────

const CM = 0.225;

function consoleSeams(d: number, extended: boolean): number[] {
  if (!extended) return [0];
  const m = Math.min(CM, d / 4);
  const n = clamp(Math.round((d - 2 * m) / 0.5), 1, 4);
  return spaced(n + 1, -d / 2 + m, d / 2 - m);
}

function extendingConsole({ w, d, h }: Size3, extended: boolean): Part[] {
  const tt = 0.025;
  const lg = 0.04;
  const ap = 0.07;
  const m = extended ? Math.min(CM, d / 4) : d / 2;
  const edges = [-d / 2, ...consoleSeams(d, extended), d / 2];
  const P: Part[] = [];
  for (let i = 0; i + 1 < edges.length; i++) {
    const z0 = edges[i] + (i > 0 ? 0.0015 : 0);
    const z1 = edges[i + 1] - (i + 2 < edges.length ? 0.0015 : 0);
    P.push(span('top', [-w / 2, w / 2], [h - tt, h], [z0, z1], { bevel: 0.003 }));
  }
  for (const s of [-1, 1]) {
    const zo = s * (d / 2 - 0.01);
    const zl = zo - s * lg;
    const zi = s * (d / 2 - m + 0.004);
    const zr = (a: number, b: number): V2 => [Math.min(a, b), Math.max(a, b)];
    for (const sx of [-1, 1]) {
      P.push(span('frame', zr(sx * (w / 2 - 0.01), sx * (w / 2 - 0.01 - lg)), [0, h - tt], zr(zo, zl), NP));
      P.push(span('frame', zr(sx * (w / 2 - 0.012), sx * (w / 2 - 0.032)), [h - tt - ap, h - tt], zr(zl, zi), NP));
    }
    P.push(span('frame', [-w / 2 + 0.01 + lg, w / 2 - 0.01 - lg], [h - tt - ap, h - tt], zr(zo, zo - s * 0.02), NP));
  }
  if (extended) {
    const yr = h - tt;
    for (const sx of [-1, 1]) {
      const x = sx * (w / 2 - 0.1);
      const z0 = -d / 2 + 0.03;
      const z1 = d / 2 - 0.03;
      const reach = (z1 - z0) * 0.3;
      P.push(
        span('rails', [x - 0.02, x + 0.02], [yr - 0.04, yr], [z0, -d / 2 + m + reach], NP),
        span('rails', [x - 0.016, x + 0.016], [yr - 0.036, yr - 0.004], [-d / 2 + m, d / 2 - m], NP),
        span('rails', [x - 0.02, x + 0.02], [yr - 0.04, yr], [d / 2 - m - reach, z1], NP),
      );
      if (d > 1.6) P.push(span('frame', [x - 0.018, x + 0.018], [0, yr - 0.04], [-0.018, 0.018], NP));
    }
    if (d > 1.6) P.push(span('frame', [-w / 2 + 0.118, w / 2 - 0.118], [0.12, 0.14], [-0.01, 0.01], NP));
  }
  return P;
}

const CONSOLE_TAGS = ['extending console', 'console table', 'extendable dining table', 'telescopic', 'space saving', 'bàn console kéo dài', 'bàn ăn mở rộng', 'bàn thông minh'];

const extConsole = defineItem({
  id: 'extending-console-table',
  name: 'Extending console dining table',
  category: 'dining',
  type: 'surfaces',
  group: 'Dining tables',
  tags: CONSOLE_TAGS,
  description:
    'A 45 cm deep oak console on black steel legs that pulls out on telescopic rails into a long dining table; closed, it stands against the wall like a hall table.',
  defaultSize: S3(1.0, 0.45, 0.76),
  minSize: S3(0.9, 0.4, 0.74),
  maxSize: S3(1.2, 0.5, 0.78),
  wallSnap: true,
  slots: [matSlot('top', 'Top & leaves', 'wood-oak-natural'), matSlot('frame', 'Legs & aprons', 'metal-black-matte')],
  build: (s) => extendingConsole(s, false),
  planDetail: ({ w }) => [line([-w / 2, 0], [w / 2, 0])],
});

const extConsoleOpen = defineItem({
  ...extConsole,
  id: 'extending-console-table-extended',
  name: 'Extending console dining table, extended',
  description:
    'The extending console pulled out on its telescopic steel rails with oak leaves dropped in: a long dining table for six to eight, with a folding centre leg pair.',
  variantOf: 'extending-console-table',
  defaultSize: S3(1.0, 1.95, 0.76),
  minSize: S3(0.9, 1.4, 0.74),
  maxSize: S3(1.2, 2.45, 0.78),
  slots: [...extConsole.slots, matSlot('rails', 'Extension rails', 'metal-brushed-steel')],
  build: (s) => extendingConsole(s, true),
  planDetail: ({ w, d }) => consoleSeams(d, true).map((z) => line([-w / 2, z], [w / 2, z])),
});

// ───────────────────────── 18. Wall breakfast bar ledge with two stools ─────────────────────────

function barStool(x: number, z: number, sh: number, R: number): Part[] {
  const st = 0.04;
  const yl = sh - st - 0.012;
  const rTop = R * 0.6;
  const rFoot = R + 0.025;
  const out: Part[] = [
    lathe(
      'wood',
      [x, sh - st, z],
      [
        [0, 0],
        [R - 0.012, 0],
        [R, 0.012],
        [R, st - 0.01],
        [R - 0.01, st],
        [0, st],
      ],
      { segments: 32, plan: false },
    ),
    cyl('metal', [x, sh - st - 0.006, z], R * 0.62, 0.012, { segments: 24, plan: false }),
  ];
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    const fx = x + Math.cos(a) * rFoot;
    const fz = z + Math.sin(a) * rFoot;
    out.push(rod('metal', [x + Math.cos(a) * rTop, yl, z + Math.sin(a) * rTop], [fx, 0.008, fz], 0.011, NP));
    out.push(cyl('metal', [fx, 0.004, fz], 0.013, 0.008, NP));
  }
  const yRing = clamp(sh * 0.4, 0.22, 0.32);
  out.push(ring('metal', [x, yRing, z], lerp(rTop, rFoot, (yl - yRing) / (yl - 0.008)), 0.008, { plan: false }));
  return out;
}

const breakfastLedge = defineItem({
  id: 'wall-breakfast-ledge',
  name: 'Wall breakfast bar ledge with two stools',
  category: 'kitchen',
  type: 'surfaces',
  group: 'Dining tables',
  tags: ['breakfast bar', 'bar ledge', 'wall bar', 'bar stools', 'counter', 'quầy bar treo tường', 'bàn bar', 'ghế bar'],
  description:
    'A 35 cm deep oak bar ledge fixed to the wall on black steel brackets at counter height, with two round oak-seat bar stools with foot rings tucked under it.',
  defaultSize: S3(1.2, 0.55, 1.05),
  minSize: S3(0.9, 0.5, 0.95),
  maxSize: S3(1.8, 0.6, 1.12),
  wallSnap: true,
  slots: [matSlot('wood', 'Ledge & seats', 'wood-oak-natural'), matSlot('metal', 'Brackets & stool legs', 'metal-black-matte')],
  build: ({ w, d, h }) => {
    const zb = -d / 2;
    const tt = 0.03;
    const ld = clamp(d * 0.62, 0.28, 0.38);
    const P: Part[] = [prism('wood', frontRounded(-w / 2, w / 2, zb, zb + ld, 0.05), h - tt, tt)];
    for (const x of spaced(w > 1.45 ? 3 : 2, -w / 2 + 0.12, w / 2 - 0.12)) {
      P.push(
        span('metal', [x - 0.022, x + 0.022], [h - tt - 0.25, h - tt], [zb, zb + 0.006], NP),
        span('metal', [x - 0.006, x + 0.006], [h - tt - 0.04, h - tt], [zb + 0.006, zb + ld - 0.05], NP),
        rod('metal', [x, h - tt - 0.23, zb + 0.008], [x, h - tt - 0.035, zb + ld * 0.62], 0.007, NP),
      );
    }
    const sh = clamp(h - 0.3, 0.62, 0.8);
    const sz = zb + ld - 0.04;
    const sx = clamp(w / 4, 0.21, w / 2 - 0.21);
    for (const s of [-1, 1]) P.push(...barStool(s * sx, sz, sh, 0.175));
    return P;
  },
  planDetail: ({ w, d }) => {
    const ld = clamp(d * 0.62, 0.28, 0.38);
    const sx = clamp(w / 4, 0.21, w / 2 - 0.21);
    return [-1, 1].map((s) => circle([s * sx, -d / 2 + ld - 0.04], 0.175));
  },
});

// ───────────────────────── 19–20. Kitchen island cart with drop leaf ─────────────────────────

function islandCart({ w, d, h }: Size3, leafUp: boolean): Part[] {
  const tt = 0.035;
  const lt = 0.025;
  const pst = 0.035;
  const t = T18;
  const L = leafUp ? clamp(w * 0.27, 0.25, 0.42) : clamp(h * 0.36, 0.25, 0.38);
  const x0 = -w / 2 + 0.04;
  const x1 = leafUp ? w / 2 - L : w / 2 - 0.03;
  const cw = x1 - x0;
  const zb = -d / 2;
  const zf = d / 2;
  const yC = 0.1;
  const yTop = h - tt;
  const ym = lerp(yC, yTop, 0.5);
  const xm = x0 + cw * 0.55;
  const P: Part[] = [span('top', [x0, x1], [yTop, h], [zb, zf], { bevel: 0.003 })];
  for (const a of [x0 + 0.01, x1 - 0.01 - pst]) {
    for (const b of [zb + 0.01, zf - 0.01 - pst]) {
      P.push(span('body', [a, a + pst], [yC, yTop], [b, b + pst], { bevel: 0.003 }));
      P.push(...castor('metal', 'metal', a + pst / 2, b + pst / 2, 0.035, yC));
    }
  }
  P.push(span('body', [x0 + 0.01, x1 - 0.01], [yC, yC + t], [zb + 0.01, zf - 0.01]));
  P.push(span('body', [x0 + 0.01, x1 - 0.01], [ym, ym + t], [zb + 0.01, zf - 0.01], NP));
  P.push(span('body', [x0 + 0.012, x0 + 0.012 + t], [yC + t, yTop], [zb + 0.01 + pst, zf - 0.01 - pst], NP));
  P.push(span('body', [x0 + 0.01 + pst, x1 - 0.01 - pst], [yC + t, yTop], [zb + 0.012, zb + 0.012 + t], NP));
  P.push(span('body', [xm - t / 2, xm + t / 2], [yC + t, yTop], [zb + 0.012 + t, zf - 0.036], NP));
  // Drawer and cupboard door in the left bay.
  const zF: V2 = [zf - 0.036, zf - 0.018];
  const fx: V2 = [x0 + 0.01 + pst + 0.002, xm - t / 2 - 0.002];
  const yd = yTop - 0.14;
  P.push(span('body', fx, [yd + 0.002, yTop - 0.003], zF, { bevel: 0.003, plan: false }));
  P.push(span('body', fx, [yC + t + 0.002, yd - 0.002], zF, { bevel: 0.003, plan: false }));
  P.push(...barPull('metal', [(fx[0] + fx[1]) / 2, (yd + yTop) / 2, zF[1]], Math.min(0.14, (fx[1] - fx[0]) * 0.5), { stand: 0.022, r: 0.005 }));
  P.push(...barPull('metal', [fx[1] - 0.04, yd - 0.12, zF[1]], 0.14, { vertical: true, stand: 0.022, r: 0.005 }));
  // Rattan baskets on the open shelves of the right bay.
  const bx: V2 = [xm + t / 2 + 0.02, x1 - 0.01 - pst - 0.012];
  if (bx[1] - bx[0] > 0.14) {
    const bz: V2 = [zb + 0.012 + t + 0.02, zf - 0.04];
    P.push(...basket('baskets', bx, yC + t, bz, Math.min(0.2, ym - yC - t - 0.06)));
    P.push(...basket('baskets', bx, ym + t, bz, Math.min(0.16, yTop - ym - t - 0.08)));
  }
  // Towel rail on the left end.
  const yr = yTop - 0.07;
  P.push(rodZ('metal', x0 - 0.022, yr, zb + 0.07, zf - 0.07, 0.007, NP));
  for (const z of [zb + 0.07, zf - 0.07]) P.push(rodX('metal', x0 - 0.022, x0 + 0.01, yr, z, 0.006, NP));
  // The drop leaf on the right end.
  if (leafUp) {
    P.push(span('top', [x1 + 0.002, w / 2], [h - lt, h], [zb, zf], { bevel: 0.003 }));
    for (const z of [zb + 0.06, zf - 0.06]) {
      P.push(rod('metal', [x1 - 0.01, h - 0.3, z], [x1 + L * 0.62, h - lt - 0.009, z], 0.008, NP));
      P.push(rodX('metal', x1 - 0.01, x1 + L * 0.72, h - lt - 0.009, z, 0.008, NP));
    }
  } else {
    P.push(span('top', [x1 + 0.003, x1 + 0.003 + lt], [h - L, h - 0.002], [zb + 0.004, zf - 0.004], { bevel: 0.003 }));
  }
  return P;
}

const ISLAND_SLOTS = [
  matSlot('body', 'Cabinet', 'laminate-white-matte'),
  matSlot('top', 'Butcher-block top & leaf', 'wood-acacia'),
  matSlot('metal', 'Pulls, rail & castors', 'metal-brushed-steel'),
  matSlot('baskets', 'Baskets', 'rattan-natural'),
];

const islandCartDown = defineItem({
  id: 'island-cart-drop-leaf',
  name: 'Kitchen island cart with drop leaf',
  category: 'kitchen',
  type: 'surfaces',
  group: 'Counters & cabinets',
  tags: ['kitchen island', 'kitchen cart', 'drop leaf', 'castors', 'butcher block', 'xe đẩy bếp', 'đảo bếp di động', 'tủ bếp có bánh xe'],
  description:
    'A white kitchen island on locking castors with an acacia butcher-block top, a drawer and cupboard, open shelves with rattan baskets and a towel rail; a hinged leaf hangs down at one end.',
  defaultSize: S3(0.95, 0.5, 0.92),
  minSize: S3(0.75, 0.42, 0.85),
  maxSize: S3(1.25, 0.62, 0.95),
  slots: ISLAND_SLOTS,
  build: (s) => islandCart(s, false),
  planDetail: ({ w, d }) => [line([w / 2 - 0.03, -d / 2], [w / 2 - 0.03, d / 2])],
});

const islandCartUp = defineItem({
  ...islandCartDown,
  id: 'island-cart-drop-leaf-up',
  name: 'Kitchen island cart with drop leaf, leaf up',
  description: 'The kitchen island cart with its drop leaf raised on swing-out steel arms: a breakfast bar for two or extra prep space next to the hob.',
  variantOf: 'island-cart-drop-leaf',
  defaultSize: S3(1.25, 0.5, 0.92),
  minSize: S3(1.0, 0.42, 0.85),
  maxSize: S3(1.65, 0.62, 0.95),
  build: (s) => islandCart(s, true),
  planDetail: ({ w, d }) => {
    const x = w / 2 - clamp(w * 0.27, 0.25, 0.42);
    return [line([x, -d / 2], [x, d / 2])];
  },
});

// ───────────────────────── 21. Slim rolling gap cart ─────────────────────────

const gapCart = styled(
  defineItem({
    id: 'slim-gap-cart',
    name: 'Slim rolling gap cart',
    category: 'kitchen',
    type: 'storage',
    group: 'Kitchen cabinets',
    tags: ['gap cart', 'slim trolley', 'rolling cart', 'narrow', 'kitchen storage', 'kệ khe hẹp', 'kệ bánh xe', 'xe đẩy khe tủ lạnh'],
    description:
      'An 18 cm wide white steel trolley on castors with rimmed trays and a pull handle, made to slide into the gap beside a fridge or washing machine, here filled with oils, sauces and spice jars.',
    defaultSize: S3(0.18, 0.5, 0.85),
    minSize: S3(0.13, 0.4, 0.6),
    maxSize: S3(0.26, 0.65, 1.1),
    wallSnap: true,
    slots: [matSlot('frame', 'Frame & trays', 'metal-white-powder'), matSlot('castors', 'Castors & grip', 'rubber-black')],
    build: ({ w, d, h }) => {
      const yC = 0.065;
      const px = w / 2 - 0.0125;
      const pz = d / 2 - 0.0125;
      const n = clamp(Math.round((h - 0.12) / 0.26), 2, 4);
      const tiers = spaced(n, yC, h - 0.13);
      const P: Part[] = [];
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const top = sz > 0 ? h - 0.012 : h - 0.08;
          P.push(vcyl('frame', sx * px, sz * pz, yC, top, 0.0065, NP));
          if (sz < 0) P.push(sphere('frame', [sx * px, top, sz * pz], 0.0075, NP));
          P.push(...castor('castors', 'frame', sx * (w / 2 - 0.03), sz * (d / 2 - 0.04), 0.022, yC));
        }
      }
      for (const y of tiers) {
        P.push(span('frame', [-w / 2 + 0.003, w / 2 - 0.003], [y, y + 0.006], [-d / 2 + 0.003, d / 2 - 0.003], { bevel: 0.002 }));
        P.push(
          span('frame', [-w / 2 + 0.003, w / 2 - 0.003], [y + 0.006, y + 0.05], [d / 2 - 0.007, d / 2 - 0.003], NP),
          span('frame', [-w / 2 + 0.003, w / 2 - 0.003], [y + 0.006, y + 0.05], [-d / 2 + 0.003, -d / 2 + 0.007], NP),
          span('frame', [-w / 2 + 0.003, -w / 2 + 0.007], [y + 0.006, y + 0.05], [-d / 2 + 0.007, d / 2 - 0.007], NP),
          span('frame', [w / 2 - 0.007, w / 2 - 0.003], [y + 0.006, y + 0.05], [-d / 2 + 0.007, d / 2 - 0.007], NP),
        );
      }
      P.push(rodX('frame', -px, px, h - 0.012, pz, 0.0065, NP), rodX('castors', -px + 0.012, px - 0.012, h - 0.012, pz, 0.011, { segments: 16, plan: false }));
      // Contents: bottles and lidded jars on every tray.
      const rr = Math.min(0.034, w / 2 - 0.022);
      for (const [i, y0] of tiers.entries()) {
        const yb = y0 + 0.006;
        const room = i + 1 < tiers.length ? tiers[i + 1] - yb - 0.02 : 0.24;
        const zs = cells(clamp(Math.floor((d - 0.04) / 0.085), 3, 7), -d / 2 + 0.015, d / 2 - 0.015);
        for (const [k, z] of zs.entries()) {
          if ((k + i) % 2 === 0) {
            const bh = Math.min(0.24, room * 0.92);
            const r = rr * 0.9;
            P.push(
              prop(
                lathe(
                  'bottles',
                  [0, yb, z],
                  [
                    [0, 0],
                    [r, 0],
                    [r, bh * 0.62],
                    [r * 0.34, bh * 0.82],
                    [r * 0.34, bh * 0.94],
                    [0, bh * 0.94],
                  ],
                  { segments: 18, plan: false },
                ),
              ),
              prop(vcyl('lids', 0, z, yb + bh * 0.94, yb + bh, r * 0.38, { segments: 12, plan: false })),
            );
          } else {
            const jh = Math.min(0.12, room * 0.6);
            P.push(prop(vcyl('bottles', 0, z, yb, yb + jh, rr, { segments: 18, plan: false })), prop(vcyl('lids', 0, z, yb + jh, yb + jh + 0.018, rr * 1.03, { segments: 18, plan: false })));
          }
        }
      }
      return P;
    },
  }),
  [matSlot('bottles', 'Bottles & jars', 'glass-tinted'), matSlot('lids', 'Lids & caps', 'wood-bamboo')],
  ['Filled', 'Empty'],
);

// ───────────────────────── 22. Stackable birch stools ─────────────────────────

const stackStools = defineItem({
  id: 'stackable-birch-stools',
  name: 'Stackable birch stools, stack of three',
  category: 'dining',
  type: 'seating',
  group: 'Stools & benches',
  tags: ['stackable stools', 'stool', 'birch', 'three-legged', 'stacking', 'ghế đẩu', 'ghế xếp chồng', 'đôn gỗ'],
  description:
    'Three round three-legged birch stools with sage laminate tops, stacked in a spiral: extra seats or side tables that store in the footprint of one.',
  defaultSize: S3(0.38, 0.38, 0.53),
  minSize: S3(0.32, 0.32, 0.47),
  maxSize: S3(0.45, 0.45, 0.6),
  slots: [matSlot('wood', 'Birch legs & seats', 'wood-plywood'), matSlot('seat', 'Seat tops', 'laminate-sage')],
  build: ({ w, d, h }) => {
    const st = 0.03;
    const step = 0.054;
    const lr = 0.0175;
    const rl = Math.min(w, d) / 2 - lr - 0.002;
    const R = rl - lr - 0.001;
    const hs = h - 2 * step;
    const P: Part[] = [];
    for (let i = 0; i < 3; i++) {
      const y0 = i * step;
      const ys = y0 + hs;
      const yu = ys - st;
      P.push(
        lathe(
          'wood',
          [0, yu, 0],
          [
            [0, 0],
            [R - 0.006, 0],
            [R, 0.006],
            [R, st - 0.008],
            [R - 0.004, st - 0.003],
            [0, st - 0.003],
          ],
          { segments: 40, plan: i === 2 },
        ),
        cyl('seat', [0, ys - 0.0015, 0], R - 0.005, 0.003, { segments: 40, plan: false }),
      );
      for (let k = 0; k < 3; k++) {
        const a = i * 0.7 + (k * 2 * Math.PI) / 3;
        const x = Math.cos(a) * rl;
        const z = Math.sin(a) * rl;
        P.push(vcyl('wood', x, z, y0, yu - 0.012, lr, { segments: 14, plan: i === 0 }));
        P.push(sphere('wood', [x, yu - 0.012, z], lr, NP));
        P.push(box('wood', [x * 0.76, yu - 0.009, z * 0.76], [rl * 0.48 + lr, 0.018, 0.034], { rotation: [0, -a, 0], plan: false }));
      }
    }
    return P;
  },
});

// ───────────────────────── 23. Two folding chairs on a wall rail ─────────────────────────

const wallChairs = defineItem({
  id: 'wall-hung-folding-chairs',
  name: 'Two folding chairs on a wall rail',
  category: 'dining',
  type: 'seating',
  group: 'Dining chairs',
  tags: ['folding chairs', 'wall hung', 'chair rail', 'space saving', 'pair', 'ghế xếp', 'ghế gấp treo tường', 'ghế gỗ xếp'],
  description: 'A pair of folded oak chairs with black seats and backs, hung flat on hooks from an oak wall rail: two extra dining seats that take up no floor.',
  defaultSize: S3(1.0, 0.12, 0.92),
  minSize: S3(0.9, 0.1, 0.85),
  maxSize: S3(1.3, 0.15, 1.0),
  mount: 'wall',
  defaultElevation: 0.68,
  slots: [
    matSlot('frame', 'Chair frames', 'wood-oak-light'),
    matSlot('panel', 'Seats & backrests', 'laminate-black'),
    matSlot('rail', 'Wall rail', 'wood-oak-light'),
    matSlot('hooks', 'Hooks & pivots', 'metal-black-matte'),
  ],
  build: ({ w, d, h }) => {
    const zw = -d / 2;
    const P: Part[] = [span('rail', [-w / 2, w / 2], [h - 0.09, h], [zw, zw + 0.025], { bevel: 0.004 })];
    const cw = clamp(w / 2 - 0.06, 0.36, 0.44);
    const cl = clamp(h - 0.08, 0.76, 0.9);
    const yTop = h - 0.055;
    const yBot = yTop - cl;
    const zc = zw + 0.03;
    const xo = cw / 2 - 0.011;
    const xi = xo - 0.03;
    for (const s of [-1, 1]) {
      const cx = (s * w) / 4;
      P.push(
        ...rodPath(
          'hooks',
          [
            [cx, h - 0.045, zw + 0.025],
            [cx, h - 0.075, zw + 0.05],
            [cx, h - 0.062, zw + 0.075],
            [cx, h - 0.036, zw + 0.08],
          ],
          0.005,
        ),
      );
      for (const sx of [-1, 1]) {
        P.push(span('frame', [cx + sx * xo - 0.011, cx + sx * xo + 0.011], [yBot, yTop], [zc, zc + 0.022], { bevel: 0.003 }));
        P.push(span('frame', [cx + sx * xi - 0.011, cx + sx * xi + 0.011], [yBot, yBot + cl * 0.72], [zc + 0.022, zc + 0.044], { bevel: 0.003, plan: false }));
        const yp = yBot + cl * 0.42;
        P.push(rodX('hooks', Math.min(cx + sx * (xi - 0.006), cx + sx * (xo + 0.014)), Math.max(cx + sx * (xi - 0.006), cx + sx * (xo + 0.014)), yp, zc + 0.022, 0.005, NP));
      }
      P.push(span('frame', [cx - xo + 0.011, cx + xo - 0.011], [yTop - 0.04, yTop - 0.012], [zc, zc + 0.022], NP));
      P.push(span('frame', [cx - xo + 0.011, cx + xo - 0.011], [yBot + 0.06, yBot + 0.08], [zc + 0.004, zc + 0.018], NP));
      P.push(span('frame', [cx - xi + 0.011, cx + xi - 0.011], [yBot + 0.06, yBot + 0.08], [zc + 0.026, zc + 0.04], NP));
      P.push(span('panel', [cx - xo + 0.011, cx + xo - 0.011], [yTop - 0.24, yTop - 0.06], [zc + 0.004, zc + 0.018], NP));
      P.push(span('panel', [cx - xi + 0.011, cx + xi - 0.011], [yBot + cl * 0.3, yBot + cl * 0.7], [zc + 0.026, zc + 0.04]));
    }
    return P;
  },
});

// ───────────────────────── 24. Wall entry organiser ─────────────────────────

const entryOrganiser = defineItem({
  id: 'entry-wall-organiser',
  name: 'Wall entry organiser with mirror & hooks',
  category: 'storage',
  type: 'storage',
  group: 'Hallway storage',
  tags: ['entryway organiser', 'wall organizer', 'mirror', 'key hooks', 'coat hooks', 'mail holder', 'kệ treo tường lối vào', 'móc treo chìa khóa', 'gương treo tường'],
  description:
    'An oak wall panel for a tiny entrance: a framed mirror, a top shelf with a brass key tray, a grey felt mail pocket, key hooks and a row of brass coat hooks.',
  defaultSize: S3(0.6, 0.15, 0.85),
  minSize: S3(0.45, 0.12, 0.65),
  maxSize: S3(0.9, 0.2, 1.1),
  mount: 'wall',
  defaultElevation: 0.95,
  slots: [
    matSlot('board', 'Oak board & shelf', 'wood-oak-natural'),
    matSlot('mirror', 'Mirror', 'glass-mirror'),
    matSlot('hooks', 'Hooks & tray', 'metal-brass'),
    matSlot('pocket', 'Felt mail pocket', 'felt-grey'),
  ],
  build: ({ w, d, h }) => {
    const zb = -d / 2;
    const z1 = zb + T18;
    const P: Part[] = [
      span('board', [-w / 2, w / 2], [0, h], [zb, z1], { bevel: 0.003 }),
      span('board', [-w / 2, w / 2], [h - 0.04, h - 0.022], [z1, d / 2], { bevel: 0.002 }),
      span('board', [-w / 2 + 0.005, w / 2 - 0.005], [h - 0.022, h - 0.004], [d / 2 - 0.012, d / 2], NP),
      span('board', [-w / 2, -w / 2 + 0.014], [h - 0.11, h - 0.04], [z1, d / 2 - 0.02], NP),
      span('board', [w / 2 - 0.014, w / 2], [h - 0.11, h - 0.04], [z1, d / 2 - 0.02], NP),
    ];
    // Framed mirror on the left.
    const mw = clamp(w * 0.56, 0.24, 0.52);
    const mx: V2 = [-w / 2 + 0.05, -w / 2 + 0.05 + mw];
    const my: V2 = [0.17, h - 0.14];
    P.push(span('mirror', mx, my, [z1, z1 + 0.005], NP));
    P.push(...frame4('board', [mx[0] - 0.016, mx[1] + 0.016], [my[0] - 0.016, my[1] + 0.016], [z1, z1 + 0.014], 0.016));
    // Felt mail pocket and key hooks on the right.
    const cx: V2 = [mx[1] + 0.045, w / 2 - 0.03];
    const cwid = cx[1] - cx[0];
    const py: V2 = [my[0] + 0.04, my[0] + 0.04 + clamp((my[1] - my[0]) * 0.45, 0.14, 0.22)];
    const pz = z1 + 0.045;
    P.push(
      span('pocket', cx, [py[0], py[1]], [pz, pz + 0.005], NP),
      span('pocket', [cx[0], cx[0] + 0.004], py, [z1, pz], NP),
      span('pocket', [cx[1] - 0.004, cx[1]], py, [z1, pz], NP),
      span('pocket', [cx[0] + 0.004, cx[1] - 0.004], [py[0], py[0] + 0.004], [z1, pz], NP),
    );
    const yk = my[1] - 0.04;
    for (const x of spaced(cwid > 0.12 ? 3 : 2, cx[0] + 0.02, cx[1] - 0.02)) {
      P.push(
        ...rodPath(
          'hooks',
          [
            [x, yk, z1],
            [x, yk - 0.012, z1 + 0.026],
            [x, yk + 0.006, z1 + 0.034],
          ],
          0.0035,
        ),
      );
    }
    // Coat hooks along the bottom.
    for (const x of cells(clamp(Math.round(w / 0.15), 3, 6), -w / 2, w / 2)) {
      P.push(discZ('hooks', [x, 0.07, z1 + 0.003], 0.012, 0.006, NP));
      P.push(
        ...rodPath(
          'hooks',
          [
            [x, 0.07, z1 + 0.006],
            [x, 0.05, z1 + 0.045],
            [x, 0.075, z1 + 0.06],
          ],
          0.005,
        ),
      );
      P.push(sphere('hooks', [x, 0.08, z1 + 0.061], 0.008, NP));
    }
    // Brass key tray on the shelf.
    const tx: V2 = [w / 2 - 0.03 - Math.min(0.16, w * 0.28), w / 2 - 0.03];
    const tz: V2 = [z1 + 0.015, d / 2 - 0.02];
    const ty = h - 0.022;
    P.push(
      span('hooks', tx, [ty, ty + 0.003], tz, NP),
      span('hooks', tx, [ty + 0.003, ty + 0.016], [tz[0], tz[0] + 0.002], NP),
      span('hooks', tx, [ty + 0.003, ty + 0.016], [tz[1] - 0.002, tz[1]], NP),
      span('hooks', [tx[0], tx[0] + 0.002], [ty + 0.003, ty + 0.016], [tz[0] + 0.002, tz[1] - 0.002], NP),
      span('hooks', [tx[1] - 0.002, tx[1]], [ty + 0.003, ty + 0.016], [tz[0] + 0.002, tz[1] - 0.002], NP),
    );
    return P;
  },
});

// ───────────────────────── 25. Floor-to-ceiling tension pole shelf ─────────────────────────

const poleShelf = styled(
  defineItem({
    id: 'tension-pole-shelf',
    name: 'Floor-to-ceiling tension pole shelf',
    category: 'living',
    type: 'storage',
    group: 'Bookcases & shelves',
    tags: ['tension pole', 'pole shelf', 'floor to ceiling', 'no drill', 'shelving', 'rental', 'kệ chống trần', 'kệ không khoan tường', 'kệ sách'],
    description:
      'Two black steel poles braced between floor and ceiling with oak shelves clamped on: shelving that needs no wall drilling, for rentals and room corners, styled with books and ceramics.',
    defaultSize: S3(0.62, 0.3, 2.6),
    minSize: S3(0.45, 0.24, 2.2),
    maxSize: S3(0.9, 0.36, 3.0),
    wallSnap: true,
    slots: [matSlot('metal', 'Poles & brackets', 'metal-black-matte'), matSlot('shelf', 'Shelves', 'wood-oak-natural'), matSlot('pads', 'Floor & ceiling pads', 'rubber-black')],
    build: ({ w, d, h }) => {
      const px = w / 2 - 0.03;
      const pz = -d / 2 + 0.07;
      const P: Part[] = [];
      for (const s of [-1, 1]) {
        const x = s * px;
        P.push(
          vcyl('metal', x, pz, 0.02, h - 0.02, 0.016, NP),
          vcyl('pads', x, pz, 0, 0.02, 0.034, { segments: 20, plan: false }),
          vcyl('pads', x, pz, h - 0.02, h, 0.034, { segments: 20, plan: false }),
          vcyl('metal', x, pz, h - 0.32, h - 0.2, 0.021, { segments: 20, plan: false }),
        );
      }
      const n = clamp(Math.floor((h - 0.85) / 0.4) + 1, 4, 6);
      const ys = spaced(n, 0.3, h - 0.55);
      for (const [k, y] of ys.entries()) {
        P.push(span('shelf', [-w / 2, w / 2], [y, y + 0.02], [-d / 2, d / 2], { bevel: 0.003 }));
        for (const s of [-1, 1]) {
          P.push(span('metal', [s * px - 0.009, s * px + 0.009], [y - 0.022, y], [-d / 2 + 0.02, d / 2 - 0.03], NP));
          P.push(cyl('metal', [s * px, y - 0.03, pz], 0.022, 0.05, { segments: 18, plan: false }));
        }
        // Styling, a different mix on each shelf.
        const yt = y + 0.02;
        const xs: V2 = [-w / 2 + 0.06, w / 2 - 0.06];
        const pick = k % 3;
        if (pick === 0) {
          P.push(...prop(bookRow('books', [xs[0], xs[0] + (xs[1] - xs[0]) * 0.62], yt, -d / 2 + 0.03, 0.26, Math.min(0.2, d - 0.06), 40 + k, { lean: true })));
          P.push(prop(vase('decor', xs[1] - 0.06, yt, 0.01, 0.05, 0.2)));
        } else if (pick === 1) {
          P.push(prop(span('boxes', [xs[0], xs[0] + Math.min(0.24, (xs[1] - xs[0]) * 0.5)], [yt, yt + 0.17], [-d / 2 + 0.03, d / 2 - 0.03], { bevel: 0.006, plan: false })));
          P.push(...prop(bookStack('books', xs[1] - 0.12, 0, yt, 3, 0.18, Math.min(0.22, d - 0.06), 50 + k)));
          P.push(prop(bowl('decor', xs[1] - 0.12, yt + 0.075, 0, 0.07, 0.05)));
        } else {
          P.push(prop(vase('decor', xs[0] + 0.06, yt, 0, 0.055, 0.24)));
          P.push(...prop(bookRow('books', [xs[0] + 0.15, xs[1]], yt, -d / 2 + 0.03, 0.24, Math.min(0.19, d - 0.07), 60 + k, { fill: 0.7 })));
        }
      }
      return P;
    },
  }),
  [matSlot('books', 'Books', 'book-mix'), matSlot('decor', 'Ceramics', 'ceramic-white'), matSlot('boxes', 'Storage box', 'felt-grey')],
);

// ───────────────────────── 26–27. Wall-mounted ironing board cabinet ─────────────────────────

const IRON_CD = 0.14;
const IRON_TAGS = ['ironing board', 'wall cabinet', 'fold down', 'mirror cabinet', 'laundry', 'cầu là treo tường', 'bàn ủi gấp', 'tủ gương'];

function ironCarcass(w: number, h: number, zb: number, zf: number): Part[] {
  const t = 0.016;
  return [
    span('cabinet', [-w / 2, -w / 2 + t], [0, h], [zb, zf]),
    span('cabinet', [w / 2 - t, w / 2], [0, h], [zb, zf]),
    span('cabinet', [-w / 2 + t, w / 2 - t], [h - t, h], [zb, zf], NP),
    span('cabinet', [-w / 2 + t, w / 2 - t], [0, t], [zb, zf], NP),
    span('cabinet', [-w / 2 + t, w / 2 - t], [t, h - t], [zb, zb + 0.008], NP),
  ];
}

const ironCabinet = defineItem({
  id: 'wall-ironing-cabinet',
  name: 'Wall-mounted ironing board cabinet',
  category: 'laundry',
  type: 'storage',
  group: 'Bathroom & laundry storage',
  tags: IRON_TAGS,
  description: 'A slim white wall cabinet with a full-length mirror door that hides a fold-down ironing board: ironing space for a studio without a laundry room.',
  defaultSize: S3(0.42, 0.18, 1.18),
  minSize: S3(0.36, 0.16, 1.0),
  maxSize: S3(0.5, 0.22, 1.3),
  mount: 'wall',
  defaultElevation: 0.62,
  slots: [matSlot('cabinet', 'Cabinet', 'laminate-white-matte'), matSlot('mirror', 'Mirror', 'glass-mirror'), matSlot('fittings', 'Knob & fittings', 'metal-brushed-steel')],
  build: ({ w, d, h }) => {
    const zb = -d / 2;
    const zf = zb + Math.min(IRON_CD, d - 0.04);
    return [
      ...ironCarcass(w, h, zb, zf),
      span('cabinet', [-w / 2 + 0.002, w / 2 - 0.002], [0.002, h - 0.002], [zf, zf + 0.018], { bevel: 0.002, plan: false }),
      span('mirror', [-w / 2 + 0.03, w / 2 - 0.055], [0.04, h - 0.04], [zf + 0.018, zf + 0.022], NP),
      ...knob('fittings', [w / 2 - 0.028, h * 0.5, zf + 0.018], 0.008),
    ];
  },
});

const ironCabinetOpen = defineItem({
  ...ironCabinet,
  id: 'wall-ironing-cabinet-open',
  name: 'Wall-mounted ironing board cabinet, open',
  description:
    'The ironing board cabinet with its mirror door swung open and the padded board folded down on a steel stay to ironing height, with the iron waiting on the shelf above.',
  variantOf: 'wall-ironing-cabinet',
  defaultSize: S3(0.42, 1.12, 1.18),
  minSize: S3(0.36, 0.95, 1.0),
  maxSize: S3(0.5, 1.3, 1.3),
  slots: [...ironCabinet.slots, matSlot('cover', 'Board cover', 'ticking-blue')],
  build: ({ w, d, h }) => {
    const zb = -d / 2;
    const zf = zb + IRON_CD;
    const t = 0.016;
    const ysh = h - 0.24;
    const P: Part[] = [...ironCarcass(w, h, zb, zf), span('cabinet', [-w / 2 + t, w / 2 - t], [ysh, ysh + 0.016], [zb + 0.008, zf - 0.01], NP)];
    // Mirror door swung open 90° on its left hinge.
    const dz0 = zf + 0.004;
    const dz1 = Math.min(d / 2, dz0 + w - 0.004);
    P.push(span('cabinet', [-w / 2 + 0.004, -w / 2 + 0.022], [0.002, h - 0.002], [dz0, dz1], { bevel: 0.002, plan: false }));
    P.push(span('mirror', [-w / 2, -w / 2 + 0.004], [0.04, h - 0.04], [dz0 + 0.03, dz1 - 0.055], NP));
    // Ironing board folded down: a padded cover on a steel board with an oval nose.
    const yp = Math.min(0.24, h * 0.25);
    const z0 = zf - 0.03;
    const z1 = Math.min(d / 2 - 0.005, z0 + 0.95);
    const bw = Math.min(0.32, w - 0.07);
    const nl = (z1 - z0) * 0.45;
    const zc = z1 - nl;
    const nose = range(13).map((i) => {
      const a = (i / 12) * Math.PI;
      return [(bw / 2) * Math.cos(a), zc + nl * Math.sin(a)] as V2;
    });
    const outline: V2[] = [[-bw / 2, z0], [bw / 2, z0], ...nose];
    P.push(prism('fittings', outline, yp - 0.03, 0.018), prism('cover', outline, yp - 0.012, 0.012, NP));
    P.push(rodX('fittings', -bw / 2 + 0.01, bw / 2 - 0.01, yp - 0.04, z0 + 0.012, 0.01, NP));
    for (const x of [-bw * 0.3, bw * 0.3]) P.push(rod('fittings', [x, t + 0.006, zf - 0.02], [x, yp - 0.032, z0 + 0.34], 0.008, NP));
    // Steam iron standing on its heel on the shelf.
    const iy = ysh + 0.016;
    const iz = (zb + zf) / 2;
    P.push(
      span('fittings', [-0.045, 0.045], [iy, iy + 0.17], [iz - 0.035, iz - 0.027], { bevel: 0.003, plan: false }),
      box('fittings', [0, iy + 0.075, iz - 0.005], [0.08, 0.15, 0.04], { bevel: 0.014, plan: false }),
      rod('fittings', [0, iy + 0.03, iz + 0.022], [0, iy + 0.13, iz + 0.022], 0.012, NP),
      span('fittings', [-0.04, 0.04], [iy, iy + 0.02], [iz - 0.027, iz + 0.03], { bevel: 0.004, plan: false }),
    );
    return P;
  },
});

// ───────────────────────── 28. Swivel TV floor stand ─────────────────────────

const tvStand = defineItem({
  id: 'swivel-tv-stand',
  name: 'Swivel TV floor stand with TV',
  category: 'living',
  type: 'storage',
  group: 'Media units',
  tags: ['tv stand', 'swivel tv stand', 'tv floor stand', 'tv mount', 'studio', 'giá treo tivi di động', 'chân tivi xoay', 'kệ tivi'],
  description:
    'A black steel TV stand on a low rounded base with a swivel column, a bracket holding a 43-inch TV and a walnut shelf for a set-top box: it turns the screen between sofa and bed.',
  defaultSize: S3(0.98, 0.45, 1.45),
  minSize: S3(0.75, 0.4, 1.2),
  maxSize: S3(1.45, 0.55, 1.75),
  slots: [
    matSlot('stand', 'Stand', 'metal-black-matte'),
    matSlot('shelf', 'Shelf', 'wood-walnut'),
    matSlot('tv', 'TV frame', 'plastic-black'),
    matSlot('screen', 'Screen', 'screen-black'),
  ],
  build: ({ w, d, h }) => {
    const bw = clamp(w * 0.6, 0.5, 0.7);
    const bt = 0.025;
    const zc = -d / 2 + 0.13;
    const cd = 0.05;
    const tvH = Math.min(w * 0.58, h * 0.55);
    const tvB = h - tvH;
    const colTop = h - tvH * 0.2;
    const zt = zc + cd / 2 + 0.012;
    const P: Part[] = [
      prism('stand', roundRectPoints(0, 0, bw, d, 0.06, 5), 0, bt),
      cyl('stand', [0, bt + 0.006, zc], 0.07, 0.012, { segments: 28, plan: false }),
      span('stand', [-0.045, 0.045], [bt + 0.012, colTop], [zc - cd / 2, zc + cd / 2], { bevel: 0.006, plan: false }),
      span('stand', [-0.15, 0.15], [tvB + tvH * 0.3, tvB + tvH * 0.65], [zc + cd / 2, zt], NP),
      span('tv', [-w * 0.36, w * 0.36], [tvB + tvH * 0.12, h - tvH * 0.15], [zt, zt + 0.035], { bevel: 0.01, plan: false }),
      span('tv', [-w / 2, w / 2], [tvB, h], [zt + 0.035, zt + 0.055], { bevel: 0.003 }),
      span('screen', [-w / 2 + 0.008, w / 2 - 0.008], [tvB + 0.014, h - 0.008], [zt + 0.055, zt + 0.0565], NP),
    ];
    const ys = clamp(tvB - 0.26, 0.35, 0.7);
    const sd = Math.min(0.26, d / 2 - (zc + cd / 2) - 0.02);
    P.push(span('shelf', [-0.22, 0.22], [ys, ys + 0.016], [zc + cd / 2, zc + cd / 2 + sd], { bevel: 0.003, plan: false }));
    P.push(span('stand', [-0.03, 0.03], [ys - 0.04, ys], [zc + cd / 2, zc + cd / 2 + sd * 0.6], NP));
    return P;
  },
});

// ───────────────────────── 29–30. Floating media unit with fold-down desk ─────────────────────────

const MEDIA_SLOTS = [
  matSlot('body', 'Cabinets', 'laminate-white-matte'),
  matSlot('fronts', 'Fronts & desk flap', 'wood-walnut'),
  matSlot('metal', 'Pulls & stays', 'metal-brass'),
  matSlot('books', 'Books', 'book-mix'),
];

function mediaGeom({ w, d, h }: Size3, open: boolean) {
  const bd = 0.22;
  const yD = Math.min(0.45, h - 0.3);
  const fl = Math.min(h - yD - 0.004, d - bd);
  const cd = open ? clamp(d - 0.29, 0.3, 0.42) : d;
  const dw = clamp(w * 0.33, 0.5, 0.7);
  const ch = clamp(h * 0.4, 0.3, 0.42);
  return { zb: -d / 2, bd, yD, fl, cd, dw, ch, dx: [w / 2 - dw, w / 2] as V2, cx: [-w / 2, w / 2 - dw - 0.06] as V2 };
}

function mediaUnit(size: Size3, open: boolean): Part[] {
  const { h } = size;
  const { zb, bd, yD, fl, cd, ch, dx, cx } = mediaGeom(size, open);
  const t = T18;
  const zf = zb + cd - 0.03;
  const P: Part[] = [
    span('body', cx, [ch - t, ch], [zb, zf]),
    span('body', cx, [0, t], [zb, zf]),
    span('body', [cx[0], cx[0] + t], [t, ch - t], [zb, zf], NP),
    span('body', [cx[1] - t, cx[1]], [t, ch - t], [zb, zf], NP),
    span('body', [cx[0] + t, cx[1] - t], [t, ch - t], [zb, zb + 0.008], NP),
  ];
  // Two walnut drop flaps with an open niche between them.
  const bays = cellSpans(3, cx[0] + t, cx[1] - t);
  for (const [i, [a, b]] of bays.entries()) {
    if (i > 0) P.push(span('body', [a - t / 2, a + t / 2], [t, ch - t], [zb + 0.008, zf], NP));
    if (i === 1) {
      P.push(...bookRow('books', [a + t / 2 + 0.01, b - t / 2 - 0.01], t, zb + 0.03, Math.min(0.24, ch - 2 * t - 0.03), Math.min(0.2, cd - 0.08), 71, { fill: 0.6, lean: true }));
      continue;
    }
    const x0 = i === 0 ? cx[0] + 0.002 : a - t / 2 + 0.002;
    const x1 = i === 2 ? cx[1] - 0.002 : b + t / 2 - 0.002;
    P.push(span('fronts', [x0, x1], [0.002, ch - 0.002], [zf, zf + T18], { bevel: 0.002, plan: false }));
    P.push(...barPull('metal', [(x0 + x1) / 2, ch - 0.04, zf + T18], Math.min(0.12, (x1 - x0) * 0.35), { stand: 0.016, r: 0.005 }));
  }
  // Desk box at desk height, with pigeonholes and books inside.
  const yT = h;
  const zd = zb + bd;
  P.push(
    span('body', dx, [yT - t, yT], [zb, zd]),
    span('body', dx, [yD, yD + t], [zb, zd]),
    span('body', [dx[0], dx[0] + t], [yD + t, yT - t], [zb, zd], NP),
    span('body', [dx[1] - t, dx[1]], [yD + t, yT - t], [zb, zd], NP),
    span('body', [dx[0] + t, dx[1] - t], [yD + t, yT - t], [zb, zb + 0.008], NP),
  );
  const ym = yD + t + (yT - yD - 2 * t) * 0.52;
  const xm = dx[0] + (dx[1] - dx[0]) * 0.36;
  P.push(span('body', [dx[0] + t, dx[1] - t], [ym, ym + 0.012], [zb + 0.008, zd - 0.02], NP));
  P.push(span('body', [xm - 0.006, xm + 0.006], [yD + t, ym], [zb + 0.008, zd - 0.02], NP));
  P.push(...bookRow('books', [dx[0] + t + 0.008, xm - 0.014], yD + t, zb + 0.02, Math.min(0.22, ym - yD - t - 0.02), 0.16, 81, { fill: 0.9 }));
  P.push(...bookRow('books', [dx[0] + t + 0.01, dx[1] - t - 0.01], ym + 0.012, zb + 0.02, Math.min(0.2, yT - t - ym - 0.03), 0.15, 91, { fill: 0.5 }));
  if (open) {
    P.push(span('fronts', [dx[0] + 0.002, dx[1] - 0.002], [yD, yD + t], [zd + 0.002, zd + fl], { bevel: 0.002 }));
    for (const x of [dx[0] + 0.03, dx[1] - 0.03]) P.push(rod('metal', [x, Math.min(yD + 0.2, yT - 0.05), zd - 0.01], [x, yD + t + 0.004, zd + fl * 0.55], 0.004, NP));
    const nx = (dx[0] + dx[1]) / 2 + 0.04;
    P.push(...bookStack('books', nx, zd + Math.min(0.17, fl * 0.45), yD + t, 2, Math.min(0.26, dx[1] - dx[0] - 0.2), Math.min(0.2, fl * 0.5), 99));
  } else {
    P.push(span('fronts', [dx[0] + 0.002, dx[1] - 0.002], [yD + 0.002, yT - 0.002], [zd, zd + T18], { bevel: 0.002, plan: false }));
    P.push(...barPull('metal', [(dx[0] + dx[1]) / 2, yT - 0.04, zd + T18], 0.14, { stand: 0.016, r: 0.005 }));
  }
  return P;
}

const MEDIA_TAGS = ['media unit', 'tv cabinet', 'floating', 'wall-hung', 'fold-down desk', 'wall desk', 'kệ tivi treo tường', 'bàn làm việc gấp', 'tủ tivi'];

const mediaDesk = defineItem({
  id: 'media-unit-fold-desk',
  name: 'Floating media unit with fold-down desk',
  category: 'living',
  type: 'storage',
  group: 'Media units',
  tags: MEDIA_TAGS,
  description:
    'A wall-hung white TV cabinet with walnut drop flaps and an open book niche, beside a walnut-fronted wall box at desk height whose flap folds down into a work surface.',
  defaultSize: S3(1.8, 0.38, 0.9),
  minSize: S3(1.5, 0.34, 0.8),
  maxSize: S3(2.4, 0.45, 1.0),
  mount: 'wall',
  defaultElevation: 0.3,
  slots: MEDIA_SLOTS,
  build: (s) => mediaUnit(s, false),
});

const mediaDeskOpen = defineItem({
  ...mediaDesk,
  id: 'media-unit-fold-desk-open',
  name: 'Floating media unit with fold-down desk, open',
  description: 'The floating media unit with its desk flap folded down on brass stays: a 75 cm high work surface with pigeonholes and books above it, beside the TV cabinet.',
  variantOf: 'media-unit-fold-desk',
  defaultSize: S3(1.8, 0.67, 0.9),
  minSize: S3(1.5, 0.6, 0.8),
  maxSize: S3(2.4, 0.8, 1.0),
  build: (s) => mediaUnit(s, true),
  planDetail: (s) => {
    const g = mediaGeom(s, true);
    return [line([g.dx[0], g.zb + g.bd], [g.dx[1], g.zb + g.bd])];
  },
});

// ───────────────────────── 31–32. Wall-mounted drop-down drying rack ─────────────────────────

const RACK_SLOTS = [
  matSlot('frame', 'Bamboo frame', 'wood-bamboo'),
  matSlot('rods', 'Drying rods & cords', 'metal-brushed-steel'),
  matSlot('towel', 'Towel', 'fabric-sky'),
  matSlot('shirt', 'Shirt', 'fabric-white-cotton'),
];
const RACK_TAGS = ['drying rack', 'clothes airer', 'wall mounted', 'fold down', 'laundry', 'giàn phơi treo tường', 'giá phơi đồ gấp gọn', 'sào phơi'];

/** The fixed frame on the wall, from y0 to y1. */
function rackFrame(w: number, zw: number, y0: number, y1: number): Part[] {
  return [
    span('frame', [-w / 2, -w / 2 + 0.03], [y0, y1], [zw, zw + 0.02], { bevel: 0.003 }),
    span('frame', [w / 2 - 0.03, w / 2], [y0, y1], [zw, zw + 0.02], { bevel: 0.003 }),
    span('frame', [-w / 2 + 0.03, w / 2 - 0.03], [y1 - 0.04, y1], [zw, zw + 0.02], NP),
    span('frame', [-w / 2 + 0.03, w / 2 - 0.03], [y0, y0 + 0.04], [zw, zw + 0.02], NP),
  ];
}

const dryingRack = defineItem({
  id: 'wall-drop-drying-rack',
  name: 'Wall-mounted drop-down drying rack',
  category: 'laundry',
  type: 'appliances',
  group: 'Laundry',
  tags: RACK_TAGS,
  description:
    'A bamboo wall frame whose rack drops down level on two steel cords, with aluminium rods for drying a towel and a shirt indoors; it folds flat against the wall when done.',
  defaultSize: S3(0.8, 0.62, 0.95),
  minSize: S3(0.6, 0.45, 0.8),
  maxSize: S3(1.2, 0.8, 1.1),
  mount: 'wall',
  defaultElevation: 0.8,
  slots: RACK_SLOTS,
  build: ({ w, d, h }) => {
    const zw = -d / 2;
    const L = clamp(h - 0.36, 0.4, 0.75);
    const yR = h - L;
    const Lr = Math.min(L, d - 0.02) - 0.002;
    const zr0 = zw + 0.02;
    const zr1 = zr0 + Lr;
    const P: Part[] = [
      ...rackFrame(w, zw, yR, h),
      span('frame', [-w / 2 + 0.002, -w / 2 + 0.028], [yR, yR + 0.03], [zr0, zr1], { bevel: 0.003 }),
      span('frame', [w / 2 - 0.028, w / 2 - 0.002], [yR, yR + 0.03], [zr0, zr1], { bevel: 0.003 }),
      span('frame', [-w / 2 + 0.028, w / 2 - 0.028], [yR, yR + 0.03], [zr1 - 0.026, zr1], { bevel: 0.003 }),
    ];
    const n = clamp(Math.floor(Lr / 0.065), 5, 11);
    const zs = cells(n, zr0 + 0.01, zr1 - 0.03);
    for (const z of zs) P.push(rodX('rods', -w / 2 + 0.028, w / 2 - 0.028, yR + 0.015, z, 0.005, NP));
    for (const s of [-1, 1]) P.push(rod('rods', [s * (w / 2 - 0.015), h - 0.02, zw + 0.022], [s * (w / 2 - 0.015), yR + 0.03, zr1 - 0.03], 0.0025, NP));
    // A towel over one rod and a shirt over another.
    const tl = Math.min(0.34, yR + 0.015 - 0.03);
    const zt = zs[1];
    const tx: V2 = [-w / 2 + 0.06, -w / 2 + 0.06 + Math.min(0.42, w * 0.45)];
    P.push(
      span('towel', tx, [yR + 0.015 - tl, yR + 0.015], [zt - 0.016, zt - 0.007], { bevel: 0.003, plan: false }),
      span('towel', tx, [yR + 0.015 - tl * 0.7, yR + 0.015], [zt + 0.007, zt + 0.016], { bevel: 0.003, plan: false }),
      rodX('towel', tx[0], tx[1], yR + 0.017, zt, 0.012, NP),
    );
    const zs2 = zs[Math.min(zs.length - 2, 4)];
    const sx: V2 = [w / 2 - 0.06 - Math.min(0.36, w * 0.4), w / 2 - 0.06];
    const sl = Math.min(0.3, tl);
    P.push(
      span('shirt', sx, [yR + 0.015 - sl, yR + 0.015], [zs2 - 0.012, zs2 - 0.006], { bevel: 0.002, plan: false }),
      span('shirt', sx, [yR + 0.015 - sl * 0.9, yR + 0.015], [zs2 + 0.006, zs2 + 0.012], { bevel: 0.002, plan: false }),
      rodX('shirt', sx[0], sx[1], yR + 0.016, zs2, 0.009, NP),
      span('shirt', [sx[0] - 0.012, sx[0] + 0.004], [yR + 0.015 - sl * 0.45, yR + 0.01], [zs2 - 0.012, zs2 + 0.012], { bevel: 0.003, plan: false }),
      span('shirt', [sx[1] - 0.004, sx[1] + 0.012], [yR + 0.015 - sl * 0.45, yR + 0.01], [zs2 - 0.012, zs2 + 0.012], { bevel: 0.003, plan: false }),
    );
    return P;
  },
  planDetail: ({ w, d, h }) => {
    const Lr = Math.min(clamp(h - 0.36, 0.4, 0.75), d - 0.02) - 0.002;
    return [line([-w / 2, -d / 2 + 0.02 + Lr], [w / 2, -d / 2 + 0.02 + Lr])];
  },
});

const dryingRackFolded = defineItem({
  ...dryingRack,
  id: 'wall-drop-drying-rack-folded',
  name: 'Wall-mounted drop-down drying rack, folded up',
  description: 'The drop-down drying rack folded up flat against the wall: a slim bamboo frame of aluminium rods only 6 cm deep.',
  variantOf: 'wall-drop-drying-rack',
  defaultSize: S3(0.8, 0.06, 0.6),
  minSize: S3(0.6, 0.05, 0.45),
  maxSize: S3(1.2, 0.08, 0.75),
  defaultElevation: 1.15,
  slots: RACK_SLOTS.slice(0, 2),
  build: ({ w, d, h }) => {
    const zw = -d / 2;
    const z0 = zw + 0.02;
    const z1 = Math.min(d / 2, z0 + 0.03);
    const P: Part[] = [
      ...rackFrame(w, zw, 0, h),
      span('frame', [-w / 2 + 0.002, -w / 2 + 0.028], [0.002, h - 0.002], [z0, z1], { bevel: 0.003 }),
      span('frame', [w / 2 - 0.028, w / 2 - 0.002], [0.002, h - 0.002], [z0, z1], { bevel: 0.003 }),
      span('frame', [-w / 2 + 0.028, w / 2 - 0.028], [h - 0.028, h - 0.002], [z0, z1], { bevel: 0.003, plan: false }),
    ];
    const n = clamp(Math.floor((h - 0.03) / 0.065), 5, 11);
    for (const y of cells(n, 0.03, h - 0.04)) P.push(rodX('rods', -w / 2 + 0.028, w / 2 - 0.028, y, (z0 + z1) / 2, 0.005, NP));
    P.push(span('rods', [-0.02, 0.02], [h - 0.05, h - 0.02], [z1, z1 + 0.004], NP));
    return P;
  },
  planDetail: undefined,
});

// ───────────────────────── Pack ─────────────────────────

export default definePack({
  name: 'Compact living',
  version: '1.0.0',
  author: 'Neest team',
  description:
    'Space-saving furniture for studios and small apartments: lift-top, nesting and folding tables, storage ottomans and benches, a storage-arm loveseat, an armless sofa, wall-mounted drop-leaf and fold-down pieces, extending and tuck-away dining, an island cart, a gap cart, stacking stools, wall-hung chairs, a tension pole shelf, an ironing cabinet, a swivel TV stand and a drop-down drying rack.',
  license: 'CC0 (made for Neest)',
  items: [
    liftTopLowered,
    liftTopRaised,
    nestingRound,
    cTable,
    ottomanCube,
    ottomanCubeOpen,
    storageBench,
    storageLoveseat,
    armlessSofa,
    hiddenStools,
    sofaConsole,
    floorTable,
    poleShelf,
    tvStand,
    mediaDesk,
    mediaDeskOpen,
    wallDropLeaf,
    wallDropLeafFolded,
    tuckAway,
    extConsole,
    extConsoleOpen,
    breakfastLedge,
    islandCartDown,
    islandCartUp,
    gapCart,
    stackStools,
    wallChairs,
    entryOrganiser,
    ironCabinet,
    ironCabinetOpen,
    dryingRack,
    dryingRackFolded,
  ],
  materials: [
    { id: 'knit-oat', name: 'Oat chunky knit', category: 'fabric', color: '#d8cbb3', roughness: 0.98, pattern: { id: 'weave', scale: 0.3, contrast: 0.9 } },
    { id: 'ticking-blue', name: 'Blue ticking stripe cotton', category: 'fabric', color: '#c9d6e4', roughness: 0.9, pattern: { id: 'wallpaper-stripes', scale: 0.12, contrast: 0.8 } },
  ],
});

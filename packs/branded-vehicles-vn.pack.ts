/**
 * Branded bikes & scooters (Vietnam) — the two-wheelers parked in almost every Vietnamese home:
 * the Honda Vision, the country's best-selling scooter, and the Thống Nhất New 26 city bicycle.
 *
 * Every item is a real model sold in Vietnam at its published size (`brand.url` names the source).
 * Original procedural shapes: no logos or trademark artwork. Fixed products, so nothing resizes;
 * where the maker sells several colours they are offered as colour variants.
 * Like the library's other vehicles, the length runs along x (front = +x) and the width along z.
 */
import {
  box,
  cushion,
  defineItem,
  definePack,
  discZ,
  lathe,
  line,
  prism,
  matSlot,
  range,
  ring,
  rod,
  rodPath,
  rodX,
  rodZ,
  span,
  sphere,
  torus,
  type AssetBrand,
  type AssetPresetVariant,
  type Part,
  type Size3,
  type V2,
  type V3,
} from '@/packs/kit';

const o = { plan: false };
const TAU = Math.PI * 2;

function fixed(w: number, d: number, h: number) {
  const s: Size3 = { w, d, h };
  return { defaultSize: s, minSize: s, maxSize: s, resizable: { w: false, d: false, h: false } };
}

const brand = (name: string, model: string, line: string, url: string, specs: [string, string][]): AssetBrand => ({ name, model, line, url, specs });

/** The maker's finishes as colour variants: [id, name, { slot: material }]. */
const finishes = (...list: [string, string, Record<string, string>][]): AssetPresetVariant[] => list.map(([id, name, materials]) => ({ id, name, materials }));

/**
 * Side-profile slab: an outline drawn as [x, y] points (side view), extruded across the width from
 * z0 by `thick`. Gives scooter bodies their real silhouette.
 */
function sideSlab(slot: string, pts: V2[], z0: number, thick: number, plan = true): Part {
  const p = prism(slot, pts.map(([x, y]) => [x, -y] as V2), 0, thick, plan ? undefined : o);
  return { ...p, rotation: [Math.PI / 2, 0, 0], position: [p.position[0], -p.position[2], z0] };
}

/** Mudguard: short flat boxes following an arc of radius `r` around (cx, cy), from angle a0 to a1. */
function arcGuard(slot: string, cx: number, cy: number, r: number, a0: number, a1: number, n: number, width: number, thick: number): Part[] {
  const parts: Part[] = [];
  for (const i of range(n)) {
    const a = a0 + ((a1 - a0) * (i + 0.5)) / n;
    const seg = ((a1 - a0) / n) * r + 0.006;
    parts.push(box(slot, [cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0], [seg, thick, width], { rotation: [0, 0, a - Math.PI / 2], plan: false }));
  }
  return parts;
}

const BIKE_TAGS = ['branded', 'vietnam', 'outdoor', 'garage', 'hallway', 'parking'];

// ---------------------------------------------------------------------------
// Honda Vision (2025) scooter
// ---------------------------------------------------------------------------

/** Cast alloy wheel: tyre, rim, hub and five twin spokes, in the x/y plane at (cx, cy). */
function scooterWheel(cx: number, cy: number, R: number, tube: number, hubW: number): Part[] {
  const rim = R - tube * 0.9;
  const parts: Part[] = [torus('dark', [cx, cy, 0], R, tube), torus('metal', [cx, cy, 0], rim, 0.011, o), discZ('metal', [cx, cy, 0], 0.048, hubW, { segments: 20, plan: false })];
  for (const k of range(5)) {
    const a = (k / 5) * TAU + 0.3;
    for (const s of [-0.12, 0.12]) {
      parts.push(rod('metal', [cx + Math.cos(a) * 0.045, cy + Math.sin(a) * 0.045, 0], [cx + Math.cos(a + s) * (rim - 0.006), cy + Math.sin(a + s) * (rim - 0.006), 0], 0.008, { segments: 6, plan: false }));
    }
  }
  return parts;
}

const hondaVision = defineItem({
  id: 'honda-vision-2025',
  name: 'Honda Vision 2025 scooter',
  category: 'outdoor',
  type: 'activities',
  group: 'Bikes & scooters',
  tags: [...BIKE_TAGS, 'honda', 'vision', 'vision 2025', 'scooter', 'motorbike', 'xe máy', 'xe tay ga', 'xe vision', 'moped', 'helmet', 'mũ bảo hiểm'],
  description:
    'The Honda Vision 110 cc step-through scooter in silver and black: a 16-inch front and 14-inch rear alloy wheel, a slim raked front shield with a smoked headlight, flat floorboard, long seat over the rear body and grab rail, with a half-face helmet hanging from the right mirror.',
  ...fixed(1.925, 0.686, 1.126),
  slots: [
    matSlot('body', 'Body paint', 'hv-silver'),
    matSlot('dark', 'Black trim, seat & tyres', 'hv-black-trim'),
    matSlot('metal', 'Wheels, chrome & lenses', 'hv-alloy'),
    matSlot('helmet', 'Helmet', 'hv-helmet'),
  ],
  variants: finishes(['black', 'Đen (black)', { body: 'hv-black' }], ['grey', 'Xám đen (grey-black)', { body: 'hv-grey' }]),
  build: ({ w, h }) => {
    // 80/90-16 front and 90/90-14 rear tyres on a 1277 mm wheelbase.
    const Rf = 0.239;
    const tf = 0.038;
    const yf = Rf + tf;
    const Rr = 0.2185;
    const tr = 0.042;
    const yr = Rr + tr;
    const xf = w / 2 - yf - 0.012;
    const xr = xf - 1.277;
    const parts: Part[] = [...scooterWheel(xf, yf, Rf, tf, 0.1), ...scooterWheel(xr, yr, Rr, tr, 0.13)];
    // Front: disc brake and caliper on the left, fork legs, painted mudguard hugging the tyre.
    parts.push(
      discZ('metal', [xf, yf, -0.056], 0.095, 0.004, { segments: 28, plan: false }),
      box('dark', [xf - 0.07, yf + 0.06, -0.062], [0.06, 0.07, 0.03], { bevel: 0.008, plan: false }),
      discZ('dark', [xr, yr, 0.068], 0.07, 0.01, { segments: 24, plan: false }),
    );
    const head: V2 = [xf - 0.2, 0.7];
    for (const z of [-0.06, 0.06]) parts.push(rod('metal', [xf, yf, z], [head[0], head[1], z * 0.9], 0.019, { segments: 12, plan: false }));
    parts.push(...arcGuard('body', xf, yf, yf + 0.022, 0.45, 2.05, 6, 0.11, 0.012));
    // Front shield in side profile: raked cowl over the wheel, the leg shield behind it (wider at the knees).
    parts.push(
      sideSlab('body', [[0.25, 0.3], [0.215, 0.45], [0.205, 0.7], [0.235, 0.88], [0.3, 0.95], [0.45, 0.965], [0.56, 0.9], [0.63, 0.79], [0.685, 0.665], [0.695, 0.62], [0.66, 0.6], [0.55, 0.57], [0.45, 0.5], [0.39, 0.4], [0.36, 0.3]], -0.14, 0.28),
      sideSlab('body', [[0.25, 0.305], [0.215, 0.45], [0.205, 0.7], [0.235, 0.86], [0.3, 0.86], [0.37, 0.5], [0.34, 0.305]], -0.2, 0.4, false),
    );
    // Smoked headlight and LED strips on the cowl face, indicator lenses at its sides.
    const fa = Math.atan2(0.11, 0.22);
    parts.push(
      box('metal', [0.628, 0.79, 0], [0.012, 0.12, 0.17], { bevel: 0.005, rotation: [0, 0, fa], plan: false }),
      box('dark', [0.598, 0.865, 0], [0.01, 0.05, 0.2], { bevel: 0.004, rotation: [0, 0, fa], plan: false }),
      box('metal', [0.6, 0.86, 0], [0.008, 0.008, 0.21], { rotation: [0, 0, fa], plan: false }),
    );
    // Front storage compartment lid (with USB-C) on the rider side of the leg shield.
    parts.push(box('dark', [0.205, 0.64, 0], [0.012, 0.13, 0.22], { bevel: 0.004, rotation: [0, 0, 0.06], plan: false }));
    // Handlebar cover with the meter, bars, grips, levers and mirrors.
    const hy = 0.99;
    parts.push(
      rod('dark', [head[0], head[1], 0], [0.4, 0.93, 0], 0.025, { segments: 12, plan: false }),
      box('body', [0.38, 0.985, 0], [0.22, 0.1, 0.4], { bevel: 0.04, rotation: [0, 0, 0.1], plan: false }),
      box('dark', [0.31, 1.035, 0], [0.09, 0.012, 0.15], { bevel: 0.004, rotation: [0, 0, 0.55], plan: false }),
      rodZ('metal', 0.34, hy, -0.3, 0.3, 0.011, { segments: 8, plan: false }),
    );
    for (const s of [-1, 1]) {
      parts.push(
        rodZ('dark', 0.34, hy, s * 0.21, s * 0.325, 0.017, { segments: 12, plan: false }),
        rod('metal', [0.36, hy + 0.01, s * 0.2], [0.4, hy + 0.005, s * 0.31], 0.005, { segments: 6, plan: false }),
        rod('metal', [0.37, 1.02, s * 0.19], [0.33, 1.07, s * 0.24], 0.007, { segments: 6, plan: false }),
        sphere('dark', [0.325, h - 0.045, s * 0.255], 1, { scale: [0.02, 0.044, 0.075], plan: false }),
      );
    }
    // Floorboard with its rubber mat, the body underneath and black side sills.
    parts.push(
      span('dark', [-0.17, 0.25], [0.275, 0.3], [-0.16, 0.16], { bevel: 0.006 }),
      span('body', [-0.21, 0.3], [0.19, 0.276], [-0.15, 0.15], { bevel: 0.03, plan: false }),
      span('dark', [-0.19, 0.27], [0.2, 0.27], [-0.168, 0.168], { bevel: 0.02, plan: false }),
    );
    // Rear body in side profile: rises from the floor to the seat and runs back to the tail,
    // its lower edge sweeping up over the rear wheel; black lower covers, tail lamp, mudguard and plate.
    parts.push(
      sideSlab('body', [[-0.17, 0.298], [-0.1, 0.45], [-0.04, 0.66], [0.0, 0.705], [-0.76, 0.715], [-0.92, 0.69], [-0.955, 0.63], [-0.945, 0.575], [-0.8, 0.54], [-0.58, 0.53], [-0.42, 0.47], [-0.3, 0.38], [-0.23, 0.298]], -0.145, 0.29),
      sideSlab('dark', [[-0.23, 0.33], [-0.3, 0.4], [-0.42, 0.48], [-0.6, 0.545], [-0.62, 0.5], [-0.42, 0.43], [-0.3, 0.33]], -0.152, 0.304, false),
      span('metal', [-0.962, -0.94], [0.6, 0.65], [-0.08, 0.08], { bevel: 0.006, plan: false }),
      span('dark', [-0.94, -0.88], [0.36, 0.56], [-0.08, 0.08], { bevel: 0.01, plan: false }),
      span('metal', [-0.953, -0.941], [0.4, 0.5], [-0.07, 0.07], o),
    );
    // Seat and grab rail.
    parts.push(
      cushion('dark', [-0.74, 0.0], [0.7, 0.785], [-0.155, 0.155], { softness: 0.45 }),
      ...rodPath('dark', [
        [-0.64, 0.725, -0.165],
        [-0.86, 0.73, -0.15],
        [-0.9, 0.735, 0],
        [-0.86, 0.73, 0.15],
        [-0.64, 0.725, 0.165],
      ], 0.013),
    );
    // Engine and CVT case on the left, air box, rear shock, muffler with heat guard on the right, stands.
    parts.push(
      span('dark', [xr - 0.06, xr + 0.42], [0.17, 0.36], [-0.16, -0.05], { bevel: 0.03, plan: false }),
      span('dark', [-0.3, -0.12], [0.2, 0.37], [-0.08, 0.08], { bevel: 0.03, plan: false }),
      span('dark', [xr + 0.08, xr + 0.36], [0.36, 0.43], [-0.15, -0.08], { bevel: 0.02, plan: false }),
      rod('metal', [xr + 0.03, yr + 0.05, -0.15], [xr + 0.14, 0.52, -0.14], 0.016, { segments: 10, plan: false }),
      rod('dark', [xr + 0.32, 0.21, 0.1], [xr - 0.03, 0.33, 0.15], 0.042, { segments: 14, plan: false }),
      box('metal', [xr + 0.12, 0.29, 0.192], [0.24, 0.07, 0.006], { bevel: 0.002, rotation: [0, 0, -0.33], plan: false }),
      rod('dark', [xr + 0.42, 0.18, -0.12], [xr + 0.36, 0.012, -0.13], 0.012, o),
      rod('dark', [xr + 0.42, 0.18, 0.12], [xr + 0.36, 0.012, 0.13], 0.012, o),
      rodZ('dark', xr + 0.36, 0.012, -0.13, 0.13, 0.012, o),
    );
    // Half-face helmet left on the back of the seat, visor forward.
    const hr = 0.105;
    const hc: V3 = [-0.55, 0.778, 0];
    parts.push(
      lathe('helmet', hc, [[hr, 0], [hr * 0.98, hr * 0.3], [hr * 0.86, hr * 0.62], [hr * 0.56, hr * 0.88], [0, hr * 0.96]], { segments: 24, plan: false }),
      ring('helmet', [hc[0], hc[1] + 0.004, hc[2]], hr, 0.008, o),
      box('helmet', [hc[0] + hr * 0.95, hc[1] + 0.016, hc[2]], [0.07, 0.008, hr * 1.3], { rotation: [0, 0, -0.25], plan: false }),
    );
    return parts;
  },
  planDetail: ({ w }) => [line([-w / 2 + 0.06, 0], [w / 2 - 0.03, 0])],
  brand: brand('Honda', 'Vision 2025', 'Vision 110', 'https://www.honda.com.vn/xe-may/san-pham/vision', [
    ['Size (L × W × H)', '1925 × 686 × 1126 mm'],
    ['Curb weight', '97 kg'],
    ['Wheelbase / seat height', '1277 mm / 785 mm'],
    ['Tyres', '80/90-16 front, 90/90-14 rear'],
    ['Engine', '109.5 cc eSP, 6.59 kW, 4.8 L tank'],
  ]),
});

// ---------------------------------------------------------------------------
// Thống Nhất New 26 city bicycle
// ---------------------------------------------------------------------------

const thongNhatNew26 = defineItem({
  id: 'thong-nhat-new-26',
  name: 'Thống Nhất New 26 city bicycle',
  category: 'outdoor',
  type: 'activities',
  group: 'Bikes & scooters',
  tags: [...BIKE_TAGS, 'thống nhất', 'thong nhat', 'new 26', 'bicycle', 'bike', 'city bike', 'xe đạp', 'xe đạp nữ', 'xe đạp mini', 'basket', 'giỏ xe'],
  description:
    'The white Thống Nhất New 26 ladies city bike: a low step-through frame of twin curved steel tubes, 26-inch wheels with painted mudguards, a brown imitation-rattan basket, sprung saddle, chain guard, rear carrier and kickstand.',
  ...fixed(1.77, 0.62, 1.06),
  wallSnap: true,
  slots: [
    matSlot('frame', 'Frame & mudguards', 'tn-white'),
    matSlot('tyres', 'Tyres, grips & saddle', 'rubber-black'),
    matSlot('metal', 'Rims, spokes, carrier & chain', 'metal-chrome'),
    matSlot('basket', 'Basket', 'tn-basket'),
  ],
  build: ({ w }) => {
    // 26 × 1 3/8 tyres (ISO 590), ≈ 1.1 m wheelbase.
    const R = 0.3135;
    const tube = 0.0185;
    const ay = R + tube;
    const xr = -w / 2 + ay + 0.003;
    const xf = w / 2 - ay - 0.003;
    const parts: Part[] = [];
    for (const cx of [xr, xf]) {
      parts.push(torus('tyres', [cx, ay, 0], R, tube), torus('metal', [cx, ay, 0], R - tube - 0.006, 0.008, o), discZ('metal', [cx, ay, 0], 0.022, 0.1, { segments: 12, plan: false }));
      for (const i of range(12)) {
        const a = (i / 12) * TAU;
        const z = i % 2 === 0 ? 0.035 : -0.035;
        parts.push(rod('metal', [cx, ay, z], [cx + Math.cos(a) * (R - 0.03), ay + Math.sin(a) * (R - 0.03), 0], 0.0013, { segments: 4, plan: false }));
      }
    }
    // Painted mudguards over both wheels.
    parts.push(...arcGuard('frame', xf, ay, R + tube + 0.014, 0.3, 2.3, 6, 0.055, 0.004), ...arcGuard('frame', xr, ay, R + tube + 0.014, 0.75, 2.85, 6, 0.055, 0.004));
    // Frame: two parallel curved down tubes (step-through), seat tube, stays, head tube and fork.
    const B: V3 = [-0.12, 0.29, 0];
    const S: V3 = [-0.28, 0.74, 0];
    const Ht: V3 = [0.39, 0.87, 0];
    const Hb: V3 = [0.42, 0.71, 0];
    parts.push(
      ...rodPath('frame', [[0.395, 0.82, 0], [0.31, 0.64, 0], [0.16, 0.45, 0], [0.0, 0.34, 0], B], 0.019),
      ...rodPath('frame', [[0.415, 0.735, 0], [0.34, 0.57, 0], [0.2, 0.41, 0], [0.04, 0.31, 0], [-0.08, 0.285, 0]], 0.014),
      rod('frame', B, [S[0] - 0.01, S[1] + 0.02, 0], 0.017, o),
      rod('frame', Hb, Ht, 0.02, o),
    );
    for (const z of [-0.035, 0.035]) {
      parts.push(
        rod('frame', [xr, ay, z * 1.6], [B[0], B[1], z * 0.6], 0.009, o),
        rod('frame', [xr, ay, z * 1.6], [S[0], S[1] - 0.02, z * 0.5], 0.009, o),
        rod('frame', [Hb[0], Hb[1], z], [xf, ay, z * 1.5], 0.011, o),
      );
    }
    // Seat post, sprung saddle; stem, swept-back bar, grips, levers and bell.
    const sy = 0.915;
    parts.push(
      rod('metal', S, [S[0] - 0.05, sy - 0.03, 0], 0.012, o),
      sphere('tyres', [S[0] - 0.06, sy, 0], 1, { scale: [0.13, 0.035, 0.095], plan: false }),
      ...[-0.05, 0.05].map((z) => rod('metal', [S[0] - 0.11, sy - 0.02, z], [S[0] - 0.08, sy - 0.08, z * 0.6], 0.007, { segments: 6, plan: false })),
      rod('metal', Ht, [0.36, 0.98, 0], 0.013, o),
    );
    for (const s of [-1, 1]) {
      parts.push(
        ...rodPath('metal', [[0.36, 0.98, 0], [0.34, 0.99, s * 0.17], [0.27, 1.0, s * 0.255]], 0.011),
        rod('tyres', [0.27, 1.0, s * 0.255], [0.16, 1.0, s * 0.27], 0.017, { segments: 10, plan: false }),
        rod('metal', [0.3, 1.01, s * 0.2], [0.21, 0.99, s * 0.25], 0.005, { segments: 6, plan: false }),
      );
    }
    parts.push(lathe('metal', [0.33, 1.0, 0.13], [[0, 0], [0.026, 0.004], [0.028, 0.016], [0.018, 0.026], [0, 0.03]], { segments: 16, plan: false }));
    // Front basket (brown imitation rattan) on the bars, with two struts to the front axle.
    const bx: V2 = [0.43, 0.7];
    const by: V2 = [0.74, 0.96];
    const bz = 0.165;
    parts.push(
      span('basket', bx, [by[0], by[0] + 0.01], [-bz, bz], { bevel: 0.003 }),
      span('basket', [bx[0], bx[0] + 0.009], by, [-bz, bz], { bevel: 0.003, plan: false }),
      span('basket', [bx[1] - 0.009, bx[1]], by, [-bz, bz], { bevel: 0.003, plan: false }),
      span('basket', [bx[0] + 0.009, bx[1] - 0.009], by, [-bz, -bz + 0.009], { bevel: 0.003, plan: false }),
      span('basket', [bx[0] + 0.009, bx[1] - 0.009], by, [bz - 0.009, bz], { bevel: 0.003, plan: false }),
    );
    for (const z of [-0.06, 0.06]) parts.push(rod('metal', [bx[1] - 0.04, by[0], z], [xf, ay, z * 1.4], 0.004, { segments: 5, plan: false }));
    // Rear carrier (baga) over the rear wheel: two rails, cross bars, struts to the axle.
    const ry = 0.72;
    const rx: V2 = [-0.82, -0.33];
    for (const z of [-0.065, 0.065]) {
      parts.push(
        rodX('metal', rx[0], rx[1], ry, z, 0.006, { segments: 6, plan: false }),
        rod('metal', [rx[0] + 0.05, ry, z], [xr, ay, z * 1.3], 0.006, { segments: 6, plan: false }),
        rod('metal', [rx[1], ry, z], [S[0], S[1] - 0.04, z * 0.4], 0.006, { segments: 6, plan: false }),
      );
    }
    for (const x of [-0.78, -0.62, -0.46]) parts.push(rodZ('metal', x, ry, -0.065, 0.065, 0.005, { segments: 6, plan: false }));
    // Drivetrain: chainring, chain, chain guard on the right; cranks and pedals; kickstand on the left.
    parts.push(
      discZ('metal', [B[0], B[1], 0.06], 0.09, 0.006, { segments: 24, plan: false }),
      discZ('metal', [xr, ay, 0.06], 0.035, 0.006, { segments: 16, plan: false }),
      rod('metal', [B[0], B[1] + 0.09, 0.06], [xr, ay + 0.035, 0.06], 0.004, { segments: 4, plan: false }),
      rod('metal', [B[0], B[1] - 0.09, 0.06], [xr, ay - 0.035, 0.06], 0.004, { segments: 4, plan: false }),
      box('frame', [(B[0] + xr) / 2 + 0.03, (B[1] + ay) / 2 + 0.03, 0.078], [0.48, 0.12, 0.006], { bevel: 0.002, rotation: [0, 0, Math.atan2(ay - B[1], xr - B[0]) + Math.PI], plan: false }),
      rod('metal', [B[0] - 0.05, B[1], -0.04], [B[0] - 0.24, 0.006, -0.13], 0.008, { segments: 6, plan: false }),
    );
    for (const s of [-1, 1]) {
      const a = s > 0 ? -0.6 : Math.PI - 0.6;
      const e: V3 = [B[0] + 0.165 * Math.cos(a), B[1] + 0.165 * Math.sin(a), s * 0.075];
      parts.push(rod('metal', [B[0], B[1], s * 0.075], e, 0.009, { segments: 6, plan: false }), box('tyres', [e[0], e[1], s * 0.11], [0.09, 0.022, 0.07], { bevel: 0.005, plan: false }));
    }
    return parts;
  },
  planDetail: ({ w }) => [line([-w / 2, 0], [w / 2, 0]), line([0.27, -0.27], [0.27, 0.27])],
  brand: brand('Thống Nhất', 'New 26', 'City bike', 'https://www.dienmayxanh.com/xe-dap/new-26-26-inch', [
    ['Size (L × W × H)', '1770 × 620 × 1060 mm'],
    ['Weight / load', '16 kg / 140 kg'],
    ['Wheels', '26 inch, alloy rims'],
    ['Frame', 'STKM11A steel, powder-coated'],
    ['Brakes', 'Rim brake front, hub brake rear'],
  ]),
});

export default definePack({
  name: 'Branded bikes & scooters (Vietnam)',
  version: '1.0.0',
  author: 'Neest team',
  description:
    'The Honda Vision 2025 scooter (with a half-face helmet) and the Thống Nhất New 26 city bicycle, at their published sizes and in the colours they are sold in.',
  license: 'CC0 (made for Neest)',
  items: [hondaVision, thongNhatNew26],
  materials: [
    { id: 'hv-silver', name: 'Scooter silver', category: 'metal', color: '#b8bbbf', roughness: 0.25, metalness: 0.55 },
    { id: 'hv-black', name: 'Scooter gloss black', category: 'metal', color: '#16171a', roughness: 0.18, metalness: 0.35 },
    { id: 'hv-grey', name: 'Scooter matte grey', category: 'metal', color: '#5c6066', roughness: 0.5, metalness: 0.3 },
    { id: 'hv-black-trim', name: 'Black scooter trim', category: 'solid', color: '#1c1d20', roughness: 0.6 },
    { id: 'hv-alloy', name: 'Alloy and chrome', category: 'metal', color: '#c4c7cb', roughness: 0.28, metalness: 0.8 },
    { id: 'hv-helmet', name: 'Helmet red', category: 'solid', color: '#c4323a', roughness: 0.25 },
    { id: 'tn-white', name: 'Bicycle white enamel', category: 'metal', color: '#f1f0ec', roughness: 0.3, metalness: 0.2 },
    { id: 'tn-basket', name: 'Brown imitation rattan', category: 'solid', color: '#7a5233', roughness: 0.7, pattern: { id: 'weave', scale: 0.04, contrast: 0.7 } },
  ],
});

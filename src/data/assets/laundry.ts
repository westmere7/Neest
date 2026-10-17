import type { AssetDefinition, Part, PlanStroke } from './types';
import { frontLoaderParts, gooseneckTap } from './kitchen';
import {
  box,
  cells,
  circle,
  clamp,
  cyl,
  defineAsset,
  discZ,
  ellipsePoints,
  frame4,
  knob,
  lathe,
  line,
  matSlot,
  pillow,
  poly,
  prism,
  range,
  rectPoly,
  ring,
  rng,
  rod,
  rodPath,
  rodX,
  rodZ,
  slats,
  spaced,
  span,
  sphere,
  torus,
  vcyl,
  type V2,
  type V3,
} from './parts';

// Laundry & utility: dryers, laundry care, cleaning, utility fixtures.

const LOADER_SLOTS = [
  matSlot('body', 'Body', 'laminate-white-gloss'),
  matSlot('door', 'Door glass & display', 'glass-tinted'),
  matSlot('trim', 'Door ring & dial', 'metal-chrome'),
];

const loaderPlan = ({ w, d }: { w: number; d: number }): PlanStroke[] => [line([-w / 2, d / 2 - 0.04], [w / 2, d / 2 - 0.04])];

const tumbleDryer = defineAsset({
  id: 'tumble-dryer',
  name: 'Tumble dryer',
  category: 'laundry',
  type: 'appliances',
  group: 'Laundry',
  tags: ['dryer', 'tumble dryer', 'laundry', 'condenser', 'appliance', 'utility'],
  defaultSize: { w: 0.6, d: 0.6, h: 0.85 },
  minSize: { w: 0.55, d: 0.5, h: 0.8 },
  maxSize: { w: 0.65, d: 0.7, h: 0.9 },
  wallSnap: true,
  slots: LOADER_SLOTS,
  build: ({ w, d, h }) => frontLoaderParts('dryer', w, d, 0, h),
  planDetail: loaderPlan,
});

const washerDryerStack = defineAsset({
  id: 'washer-dryer-stack',
  name: 'Stacked washer and dryer',
  category: 'laundry',
  type: 'appliances',
  group: 'Laundry',
  tags: ['washer', 'dryer', 'stacked', 'laundry tower', 'washing machine', 'utility'],
  defaultSize: { w: 0.6, d: 0.62, h: 1.75 },
  minSize: { w: 0.55, d: 0.55, h: 1.65 },
  maxSize: { w: 0.65, d: 0.7, h: 1.85 },
  wallSnap: true,
  slots: LOADER_SLOTS,
  build: ({ w, d, h }) => {
    const kit = 0.03;
    const uh = (h - kit) / 2;
    const o = { plan: false };
    return [
      ...frontLoaderParts('washer', w, d, 0, uh),
      // Stacking kit with a pull-out shelf.
      span('trim', [-w / 2, w / 2], [uh, uh + kit], [-d / 2, d / 2 - 0.045], { bevel: 0.004, plan: false }),
      span('body', [-w / 2 + 0.04, w / 2 - 0.04], [uh + 0.006, uh + kit - 0.006], [d / 2 - 0.045, d / 2 - 0.03], { bevel: 0.003, plan: false }),
      span('trim', [-0.06, 0.06], [uh + 0.011, uh + 0.019], [d / 2 - 0.03, d / 2 - 0.024], o),
      ...frontLoaderParts('dryer', w, d, uh + kit, h - uh - kit),
    ];
  },
  planDetail: loaderPlan,
});

const laundryBasket = defineAsset({
  id: 'laundry-basket',
  name: 'Laundry basket',
  category: 'laundry',
  type: 'storage',
  group: 'Baskets & boxes',
  tags: ['laundry basket', 'hamper', 'wicker', 'clothes', 'washing'],
  defaultSize: { w: 0.45, d: 0.35, h: 0.55 },
  minSize: { w: 0.35, d: 0.28, h: 0.4 },
  maxSize: { w: 0.6, d: 0.45, h: 0.7 },
  slots: [
    matSlot('basket', 'Wicker', 'rattan-natural'),
    matSlot('clothes', 'Shirt', 'fabric-sky'),
    matSlot('clothes2', 'Jumper', 'fabric-blush'),
    matSlot('clothes3', 'Towel', 'fabric-white-cotton'),
  ],
  build: ({ w, d, h }) => {
    const hb = h * 0.82;
    const ax = w / 2 - 0.014;
    const az = d / 2 - 0.012;
    const zs = az / ax;
    const o = { plan: false };
    const parts: Part[] = [
      lathe('basket', [0, 0, 0], [
        [0, 0],
        [0.84, 0],
        [0.86, 0.012],
        [1, hb],
      ], { scale: [ax, 1, az], segments: 36 }),
      ring('basket', [0, hb, 0], ax - 0.004, 0.01, { zScale: zs, plan: false }),
      ring('basket', [0, 0.012, 0], ax * 0.86 - 0.004, 0.007, { zScale: zs, plan: false }),
    ];
    // Woven bands.
    for (const y of spaced(clamp(Math.round(hb / 0.055), 4, 11), 0.05, hb - 0.04)) {
      parts.push(ring('basket', [0, y, 0], ax * (0.86 + (0.14 * y) / hb), 0.0045, { zScale: zs, plan: false }));
    }
    // Loop handles at each end.
    for (const s of [-1, 1]) {
      parts.push(torus('basket', [s * (ax - 0.002), hb - 0.012, 0], 0.045, 0.008, { rotation: [0, Math.PI / 2, 0], arc: Math.PI, plan: false }));
    }
    // A heap of washing, with a sleeve hanging over the rim.
    const rand = rng(9);
    const heap: [string, number][] = [
      ['clothes3', 0.62],
      ['clothes', 0.5],
      ['clothes2', 0.48],
      ['clothes', 0.4],
      ['clothes3', 0.36],
      ['clothes2', 0.3],
    ];
    heap.forEach(([slot, f], i) => {
      const pw = az * 2 * f;
      const ph = Math.min(0.09, (h - hb) * 0.9);
      const a = (i / heap.length) * Math.PI * 2;
      const rx = (ax - pw / 2) * 0.55;
      const c: V3 = [Math.cos(a) * rx * rand(), hb - 0.03 + ph / 2 + (i % 2) * 0.01, Math.sin(a) * rx * zs * rand()];
      parts.push(pillow(slot, [c[0], Math.min(c[1], h - ph / 2), c[2]], pw, ph, pw * zs * 0.75, { turn: rand() * Math.PI }));
    });
    const sx: V2 = [ax * 0.05, ax * 0.38];
    const fz = az * Math.sqrt(1 - (sx[1] / ax) ** 2);
    parts.push(rodX('clothes', sx[0], sx[1], hb + 0.006, fz - 0.004, 0.013, o));
    parts.push(span('clothes', sx, [hb - 0.17, hb + 0.004], [fz, fz + 0.01], { bevel: 0.004, plan: false }));
    return parts;
  },
  planDetail: ({ w, d }) => [poly(ellipsePoints(0, 0, w / 2 - 0.03, d / 2 - 0.03))],
});

/** Ironing board outline: square end at +x (iron rest beyond it), nose towards -x. */
function boardOutline(w: number, d: number): V2[] {
  const hd = d / 2 - 0.01;
  const x1 = w / 2 - 0.14;
  const xs = -w / 2 + 0.42;
  const rx = xs + w / 2;
  const pts: V2[] = [[x1, -hd]];
  for (const i of range(15)) {
    const a = -Math.PI / 2 - (Math.PI * i) / 14;
    pts.push([xs + rx * Math.cos(a), hd * Math.sin(a)]);
  }
  pts.push([x1, hd]);
  return pts;
}

const ironingBoard = defineAsset({
  id: 'ironing-board',
  name: 'Ironing board with iron',
  category: 'laundry',
  type: 'appliances',
  group: 'Laundry',
  tags: ['ironing board', 'iron', 'steam iron', 'laundry', 'pressing'],
  defaultSize: { w: 1.3, d: 0.4, h: 1.0 },
  minSize: { w: 1.1, d: 0.33, h: 0.85 },
  maxSize: { w: 1.5, d: 0.45, h: 1.1 },
  slots: [
    matSlot('cover', 'Cover', 'fabric-sky'),
    matSlot('frame', 'Frame', 'metal-white-powder'),
    matSlot('iron', 'Iron', 'plastic-mint'),
    matSlot('sole', 'Soleplate & feet', 'metal-chrome'),
  ],
  build: ({ w, d, h }) => {
    const top = h - 0.13;
    const hd = d / 2 - 0.01;
    const x1 = w / 2 - 0.14;
    const outline = boardOutline(w, d);
    const inner = outline.map(([x, z]) => [x * 0.98, z * 0.94] as V2);
    const o = { plan: false };
    const yT = top - 0.03;
    const parts: Part[] = [
      prism('cover', outline, top - 0.014, 0.014),
      prism('frame', inner, top - 0.03, 0.017, o),
    ];
    // Scissor legs: two U-frames crossing under the board.
    const legs: [number, number, number][] = [
      [-w * 0.28, w * 0.18, hd - 0.05],
      [w * 0.22, -w * 0.24, hd - 0.08],
    ];
    for (const [xf, xt, z] of legs) {
      for (const s of [-1, 1]) parts.push(rod('frame', [xf, 0.015, s * z], [xt, yT, s * z], 0.011, o));
      parts.push(rodZ('frame', xf, 0.015, -z, z, 0.011, o));
      parts.push(rodZ('frame', xt, yT, -z, z, 0.009, o));
      for (const s of [-1, 1]) parts.push(sphere('sole', [xf, 0.015, s * z], 0.016, { scale: [1.3, 0.9, 1], plan: false }));
    }
    const px = (legs[0][0] + legs[0][1]) / 2;
    parts.push(rodZ('frame', px, yT / 2 + 0.008, -(hd - 0.04), hd - 0.04, 0.007, o));
    // Wire iron rest at the square end.
    const ry = top - 0.008;
    const rz = hd - 0.04;
    parts.push(...rodPath('frame', [
      [x1, ry, -rz],
      [w / 2 - 0.01, ry, -rz],
      [w / 2 - 0.01, ry, rz],
      [x1, ry, rz],
    ], 0.005));
    for (const x of [x1 + 0.045, x1 + 0.09]) parts.push(rodZ('frame', x, ry, -rz, rz, 0.004, o));
    // Steam iron lying with its heel on the rest.
    const ix = x1 - 0.02;
    const sole: V2[] = [
      [ix + 0.11, -0.055],
      [ix + 0.11, 0.055],
      [ix - 0.03, 0.05],
      [ix - 0.13, 0],
      [ix - 0.03, -0.05],
    ];
    const iy = top + 0.001;
    parts.push(
      prism('sole', sole, iy, 0.012, o),
      prism('iron', sole.map(([x, z]) => [ix + (x - ix) * 0.92, z * 0.88] as V2), iy + 0.012, 0.05, o),
      rodX('iron', ix - 0.05, ix + 0.07, iy + 0.105, 0, 0.012, o),
      rod('iron', [ix - 0.075, iy + 0.06, 0], [ix - 0.05, iy + 0.105, 0], 0.011, o),
      rod('iron', [ix + 0.085, iy + 0.06, 0], [ix + 0.07, iy + 0.105, 0], 0.011, o),
      cyl('sole', [ix + 0.02, iy + 0.066, 0], 0.016, 0.01, o),
      ...rodPath('iron', [
        [ix + 0.1, iy + 0.04, 0],
        [w / 2 - 0.03, iy + 0.05, 0.02],
        [w / 2 - 0.02, iy + 0.02, 0.06],
      ], 0.004),
    );
    return parts;
  },
  planDetail: ({ w, d }) => {
    const hd = d / 2 - 0.05;
    const x1 = w / 2 - 0.14;
    return [rectPoly(x1, -hd, w / 2 - 0.01, hd), line([x1, -d / 2 + 0.01], [x1, d / 2 - 0.01])];
  },
});

const dryingRack = defineAsset({
  id: 'drying-rack',
  name: 'Clothes drying rack',
  category: 'laundry',
  type: 'appliances',
  group: 'Laundry',
  tags: ['drying rack', 'clothes horse', 'airer', 'gullwing', 'laundry', 'washing'],
  defaultSize: { w: 1.4, d: 0.55, h: 0.95 },
  minSize: { w: 1.0, d: 0.5, h: 0.85 },
  maxSize: { w: 1.8, d: 0.65, h: 1.0 },
  slots: [
    matSlot('frame', 'Frame', 'metal-white-powder'),
    matSlot('towel', 'Towel', 'fabric-white-cotton'),
    matSlot('clothes', 'T-shirt', 'fabric-sky'),
    matSlot('clothes2', 'Socks', 'fabric-mustard'),
  ],
  build: ({ w, d, h }) => {
    const xc = w * 0.2;
    const zr = d / 2 - 0.02;
    const yc = h - 0.08;
    const xe = w / 2 - 0.01;
    const ye = h - 0.012;
    const barY = (x: number) => (Math.abs(x) <= xc ? yc : yc + ((Math.abs(x) - xc) / (xe - xc)) * (ye - yc));
    const o = { plan: false };
    const parts: Part[] = [];
    for (const z of [-zr, zr]) {
      parts.push(rodX('frame', -xc, xc, yc, z, 0.007));
      parts.push(rod('frame', [xc, yc, z], [xe, ye, z], 0.007));
      parts.push(rod('frame', [-xc, yc, z], [-xe, ye, z], 0.007));
    }
    const nb = clamp(Math.floor((2 * xe - 0.04) / 0.065), 8, 28);
    const bars = spaced(nb, -xe + 0.02, xe - 0.02);
    for (const x of bars) parts.push(rodZ('frame', x, barY(x), -zr, zr, 0.0035, o));
    // A-frame legs at both ends of the centre section.
    for (const x of [-xc, xc]) {
      parts.push(rod('frame', [x, 0.01, -zr], [x, yc, zr], 0.008, o));
      parts.push(rod('frame', [x, 0.01, zr], [x, yc, -zr], 0.008, o));
      for (const z of [-zr, zr]) parts.push(sphere('frame', [x, 0.01, z], 0.012, o));
    }
    // Draped laundry: a towel and a T-shirt over centre bars, socks on the wings.
    const nearest = (target: number) => bars.reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a));
    const drape = (slot: string, x: number, zw: number, front: number, back: number) => {
      const y = barY(x);
      parts.push(
        rodZ(slot, x, y + 0.003, -zw, zw, 0.01, o),
        span(slot, [x + 0.006, x + 0.016], [y - front, y + 0.004], [-zw, zw], { bevel: 0.003, plan: false }),
        span(slot, [x - 0.016, x - 0.006], [y - back, y + 0.004], [-zw, zw], { bevel: 0.003, plan: false }),
      );
    };
    const drop = Math.min(0.45, yc - 0.2);
    drape('towel', nearest(-xc * 0.45), zr * 0.85, drop, drop * 0.8);
    const tx = nearest(xc * 0.55);
    const tw = Math.min(0.2, zr * 0.75);
    drape('clothes', tx, tw, drop * 0.75, drop * 0.7);
    for (const s of [-1, 1]) {
      parts.push(box('clothes', [tx + 0.012, yc - 0.06, s * (tw + 0.025)], [0.012, 0.11, 0.05], { rotation: [s * 0.5, 0, 0], plan: false }));
    }
    const wingBars = bars.filter((x) => x > xc + 0.04);
    wingBars.slice(0, 3).forEach((x, i) => {
      const y = barY(x);
      const z = -zr * 0.5 + i * zr * 0.45;
      parts.push(span('clothes2', [x + 0.004, x + 0.012], [y - 0.17, y + 0.004], [z - 0.03, z + 0.03], { bevel: 0.002, plan: false }));
      parts.push(span('clothes2', [x + 0.004, x + 0.05], [y - 0.17, y - 0.13], [z - 0.03, z + 0.03], { bevel: 0.006, plan: false }));
      parts.push(span('clothes2', [x - 0.012, x - 0.004], [y - 0.06, y + 0.004], [z - 0.03, z + 0.03], { bevel: 0.002, plan: false }));
    });
    return parts;
  },
  planDetail: ({ w, d }) => {
    const xc = w * 0.2;
    const zr = d / 2 - 0.02;
    return [rectPoly(-w / 2 + 0.01, -zr, w / 2 - 0.01, zr), line([-xc, -zr], [-xc, zr]), line([xc, -zr], [xc, zr])];
  },
});

const utilitySink = defineAsset({
  id: 'utility-sink',
  name: 'Utility sink',
  category: 'laundry',
  type: 'plumbing',
  group: 'Sinks',
  tags: ['utility sink', 'laundry tub', 'deep sink', 'butler sink', 'mop sink', 'utility'],
  defaultSize: { w: 0.6, d: 0.55, h: 1.15 },
  minSize: { w: 0.5, d: 0.5, h: 1.05 },
  maxSize: { w: 0.8, d: 0.6, h: 1.25 },
  wallSnap: true,
  slots: [
    matSlot('tub', 'Tub', 'ceramic-white'),
    matSlot('legs', 'Legs & shelf', 'metal-white-powder'),
    matSlot('tap', 'Tap', 'metal-chrome'),
    matSlot('items', 'Bucket & detergent', 'plastic-blue'),
  ],
  build: ({ w, d, h }) => {
    const rim = h - 0.25;
    const yb = rim - 0.33;
    const wt = 0.03;
    const deck = 0.09;
    const zt = -d / 2 + deck / 2;
    const zi: V2 = [-d / 2 + deck, d / 2 - wt];
    const lx = w / 2 - 0.03;
    const lz = d / 2 - 0.03;
    const sy = 0.16;
    const o = { plan: false };
    const parts: Part[] = [
      span('tub', [-w / 2, w / 2], [yb, yb + 0.03], [-d / 2, d / 2], { bevel: 0.005 }),
      span('tub', [-w / 2, -w / 2 + wt], [yb, rim], [-d / 2, d / 2], { bevel: 0.006 }),
      span('tub', [w / 2 - wt, w / 2], [yb, rim], [-d / 2, d / 2], { bevel: 0.006 }),
      span('tub', [-w / 2 + wt - 0.005, w / 2 - wt + 0.005], [yb, rim], [d / 2 - wt, d / 2], { bevel: 0.006 }),
      span('tub', [-w / 2 + wt - 0.005, w / 2 - wt + 0.005], [yb, rim], [-d / 2, -d / 2 + deck], { bevel: 0.006 }),
      // Washboard ribs moulded into the front inner wall.
      ...slats('tub', [-w / 2 + wt + 0.05, w / 2 - wt - 0.05], [yb + 0.1, rim - 0.04], [zi[1] - 0.008, zi[1]], 7, { axis: 'y', gap: 0.5, bevel: 0.002, plan: false }),
      cyl('tap', [0, yb + 0.032, (zi[0] + zi[1]) / 2], 0.03, 0.004, o),
      ...gooseneckTap('tap', 0, zt, rim, h - 0.004, 0.18),
    ];
    for (const x of [-lx, lx]) {
      for (const z of [-lz, lz]) {
        parts.push(span('legs', [x - 0.016, x + 0.016], [0, yb + 0.01], [z - 0.016, z + 0.016], { bevel: 0.003, plan: false }));
        parts.push(cyl('items', [x, 0.006, z], 0.02, 0.012, o));
      }
    }
    // Wire shelf with a bucket and a detergent bottle.
    parts.push(rodX('legs', -lx, lx, sy, -lz, 0.006, o), rodX('legs', -lx, lx, sy, lz, 0.006, o));
    parts.push(...slats('legs', [-lx, lx], [sy - 0.004, sy + 0.004], [-lz, lz], clamp(Math.round(w / 0.04), 10, 20), { axis: 'x', gap: 0.75, plan: false }));
    const br = Math.min(0.13, lx * 0.5);
    const bx = -lx + br + 0.03;
    parts.push(
      lathe('items', [bx, sy + 0.004, 0], [
        [0, 0],
        [br * 0.78, 0],
        [br, 0.24],
        [br * 0.95, 0.24],
        [br * 0.74, 0.008],
        [0, 0.008],
      ], { segments: 28, plan: false }),
      torus('legs', [bx, sy + 0.24, 0], br * 0.95, 0.004, { arc: Math.PI, plan: false }),
    );
    const dx = lx - 0.08;
    parts.push(
      span('items', [dx - 0.05, dx + 0.05], [sy + 0.004, sy + 0.24], [-0.07, 0.07], { bevel: 0.012, plan: false }),
      cyl('legs', [dx, sy + 0.26, 0], 0.025, 0.04, o),
    );
    return parts;
  },
  planDetail: ({ w, d }) => [
    rectPoly(-w / 2 + 0.03, -d / 2 + 0.09, w / 2 - 0.03, d / 2 - 0.03),
    circle([0, (0.09 - 0.03) / 2], 0.03),
    circle([0, -d / 2 + 0.045], 0.02),
  ],
});

const waterHeater = defineAsset({
  id: 'water-heater',
  name: 'Water heater',
  category: 'laundry',
  type: 'plumbing',
  group: 'Water heating',
  tags: ['water heater', 'boiler', 'cylinder', 'hot water', 'geyser', 'tank'],
  defaultSize: { w: 0.5, d: 0.5, h: 1.0 },
  minSize: { w: 0.4, d: 0.4, h: 0.7 },
  maxSize: { w: 0.6, d: 0.6, h: 1.2 },
  mount: 'wall',
  defaultElevation: 1.3,
  slots: [
    matSlot('tank', 'Tank', 'metal-white-powder'),
    matSlot('pipes', 'Pipes & valves', 'metal-copper'),
    matSlot('controls', 'Controls & bracket', 'plastic-black'),
  ],
  build: ({ w, d, h }) => {
    const R = Math.min(w, d) / 2 - 0.02;
    const cz = -d / 2 + R + 0.035;
    const yb = 0.1;
    const yt = h - 0.05;
    const zf = cz + R;
    const o = { plan: false };
    const parts: Part[] = [
      vcyl('tank', 0, cz, yb, yt, R, { segments: 40 }),
      lathe('tank', [0, yb - 0.06, cz], [
        [0, 0],
        [R * 0.6, 0],
        [R * 0.92, 0.035],
        [R, 0.06],
      ], { segments: 40, plan: false }),
      lathe('tank', [0, yt, cz], [
        [R, 0],
        [R * 0.9, 0.03],
        [R * 0.5, 0.048],
        [0, 0.05],
      ], { segments: 40, plan: false }),
      // Wall bracket and strap.
      span('controls', [-R * 0.5, R * 0.5], [h * 0.58, h * 0.65], [-d / 2, cz - R * 0.85], o),
      ring('controls', [0, h * 0.615, cz], R + 0.004, 0.006, { plan: false }),
      // Thermostat dial, temperature gauge and rating plate.
      discZ('controls', [0, yb + 0.1, zf + 0.002], 0.045, 0.02, o),
      discZ('tank', [0, yb + 0.1, zf + 0.014], 0.03, 0.006, o),
      span('controls', [-0.004, 0.004], [yb + 0.11, yb + 0.13], [zf + 0.016, zf + 0.018], o),
      discZ('controls', [R * 0.45, yb + 0.25, cz + R * 0.89 + 0.006], 0.028, 0.02, o),
      span('controls', [-0.08, 0.08], [h * 0.4, h * 0.52], [zf - 0.012, zf + 0.002], o),
      span('tank', [-0.07, 0.07], [h * 0.41, h * 0.51], [zf + 0.002, zf + 0.003], o),
    ];
    // Hot and cold pipes with valves, and a relief valve with its discharge pipe.
    for (const [i, x] of [-0.08, 0.08].entries()) {
      parts.push(vcyl('pipes', x, cz, 0, yb - 0.03, 0.011, o));
      parts.push(sphere('pipes', [x, 0.045, cz], 0.02, o));
      parts.push(span(i === 0 ? 'controls' : 'pipes', [x - 0.006, x + 0.006], [0.04, 0.05], [cz, cz + 0.06], o));
    }
    parts.push(rodX('pipes', R - 0.02, R + 0.01, yb + 0.2, cz, 0.012, o));
    parts.push(vcyl('pipes', R + 0.01, cz, 0, yb + 0.2, 0.008, o));
    parts.push(sphere('pipes', [R + 0.01, yb + 0.2, cz], 0.016, o));
    return parts;
  },
  planDetail: ({ w, d }) => {
    const R = Math.min(w, d) / 2 - 0.02;
    return [circle([0, -d / 2 + R + 0.035], R * 0.7)];
  },
});

const stickVacuum = defineAsset({
  id: 'stick-vacuum',
  name: 'Cordless vacuum on dock',
  category: 'laundry',
  type: 'appliances',
  group: 'Cleaning',
  tags: ['vacuum', 'hoover', 'cordless', 'stick vacuum', 'cleaning', 'dock'],
  defaultSize: { w: 0.3, d: 0.28, h: 1.25 },
  minSize: { w: 0.26, d: 0.24, h: 1.15 },
  maxSize: { w: 0.36, d: 0.34, h: 1.35 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Body', 'metal-anthracite'),
    matSlot('accent', 'Wand & accents', 'metal-copper'),
    matSlot('bin', 'Dust bin', 'glass-frosted'),
    matSlot('dock', 'Dock', 'plastic-white'),
  ],
  build: ({ w, d, h }) => {
    const zw = -d / 2 + 0.14;
    const hw = Math.min(0.25, w - 0.04);
    const zh1 = Math.min(d / 2 - 0.005, zw + 0.11);
    const ym = h - 0.38;
    const o = { plan: false };
    const parts: Part[] = [
      span('dock', [-w / 2 + 0.01, w / 2 - 0.01], [0, 0.015], [-d / 2, d / 2 - 0.01], { bevel: 0.006 }),
      span('dock', [-0.025, 0.025], [0.015, h - 0.03], [-d / 2, -d / 2 + 0.04], { bevel: 0.008, plan: false }),
      span('dock', [-0.02, 0.02], [ym + 0.21, ym + 0.235], [-d / 2 + 0.04, zw - 0.055], { bevel: 0.004, plan: false }),
      // Floor head with its brush bar, resting on the dock.
      span('body', [-hw / 2, hw / 2], [0.015, 0.07], [zw - 0.05, zh1], { bevel: 0.008, plan: false }),
      rodX('accent', -hw / 2 + 0.012, hw / 2 - 0.012, 0.045, zh1 - 0.028, 0.024, o),
      sphere('body', [0, 0.08, zw], 0.026, o),
      // Wand, cyclone bin, motor, battery and handle.
      vcyl('accent', 0, zw, 0.08, ym, 0.017, o),
      vcyl('bin', 0, zw, ym, ym + 0.15, 0.045, { segments: 28, plan: false }),
      vcyl('accent', 0, zw, ym + 0.1, ym + 0.11, 0.047, o),
      lathe('body', [0, ym + 0.15, zw], [
        [0.045, 0],
        [0.04, 0.03],
        [0.03, 0.05],
        [0, 0.05],
      ], { segments: 24, plan: false }),
      span('body', [-0.04, 0.04], [ym + 0.17, ym + 0.27], [zw - 0.06, zw + 0.03], { bevel: 0.012, plan: false }),
      span('body', [-0.03, 0.03], [ym + 0.12, ym + 0.2], [zw - 0.095, zw - 0.045], { bevel: 0.01, plan: false }),
      span('accent', [-0.02, 0.02], [ym + 0.13, ym + 0.135], [zw - 0.096, zw - 0.094], o),
      ...rodPath('accent', [
        [0, ym + 0.25, zw - 0.05],
        [0, ym + 0.32, zw - 0.075],
        [0, ym + 0.24, zw - 0.09],
        [0, ym + 0.2, zw - 0.075],
      ], 0.013),
      span('accent', [-0.006, 0.006], [ym + 0.24, ym + 0.265], [zw - 0.07, zw - 0.058], o),
    ];
    // Spare tools clipped to the post: crevice tool and a dusting brush.
    const ty = h * 0.42;
    const tz = -d / 2 + 0.022;
    parts.push(
      span('dock', [0.025, 0.04], [ty + 0.05, ty + 0.07], [tz - 0.012, tz + 0.012], o),
      rod('body', [0.055, ty, tz], [0.055, ty + 0.2, tz], 0.012, { rTop: 0.016, plan: false }),
      span('dock', [-0.04, -0.025], [ty + 0.05, ty + 0.07], [tz - 0.012, tz + 0.012], o),
      vcyl('body', -0.06, tz, ty + 0.06, ty + 0.15, 0.014, o),
      span('accent', [-0.09, -0.03], [ty + 0.02, ty + 0.06], [tz - 0.014, tz + 0.014], { bevel: 0.006, plan: false }),
    );
    return parts;
  },
  planDetail: ({ w, d }) => [circle([0, -d / 2 + 0.14], 0.045), rectPoly(-Math.min(0.25, w - 0.04) / 2, -d / 2 + 0.09, Math.min(0.25, w - 0.04) / 2, Math.min(d / 2 - 0.005, -d / 2 + 0.25))],
});

const broomCupboard = defineAsset({
  id: 'broom-cupboard',
  name: 'Broom cupboard',
  category: 'laundry',
  type: 'storage',
  group: 'Hallway storage',
  tags: ['broom cupboard', 'utility cupboard', 'cleaning', 'louvre', 'storage', 'mop bucket'],
  defaultSize: { w: 0.6, d: 0.45, h: 2.0 },
  minSize: { w: 0.4, d: 0.35, h: 1.8 },
  maxSize: { w: 0.8, d: 0.6, h: 2.3 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Cupboard', 'wood-painted-white'),
    matSlot('handle', 'Knobs', 'metal-brass'),
    matSlot('items', 'Bucket & tools', 'plastic-blue'),
    matSlot('items2', 'Spray bottles', 'plastic-yellow'),
  ],
  build: ({ w, d, h }) => {
    const t = 0.018;
    const ft = 0.02;
    const zf = d / 2 - ft - 0.025;
    const zs = zf + ft;
    const plinth = 0.08;
    const bay: V2 = [plinth + t, 0.5];
    const dy: V2 = [0.5, h - 0.035];
    const o = { plan: false };
    const parts: Part[] = [
      span('body', [-w / 2 + 0.01, w / 2 - 0.01], [0, plinth], [-d / 2, zf - 0.04], o),
      span('body', [-w / 2, w / 2], [dy[0], dy[1]], [-d / 2, zf]),
      span('body', [-w / 2, -w / 2 + t], [plinth, dy[0]], [-d / 2, zs], o),
      span('body', [w / 2 - t, w / 2], [plinth, dy[0]], [-d / 2, zs], o),
      span('body', [-w / 2 + t, w / 2 - t], [plinth, bay[0]], [-d / 2, zs], o),
      span('body', [-w / 2 + t, w / 2 - t], [bay[0], dy[0]], [-d / 2, -d / 2 + 0.008], o),
      span('body', [-w / 2, w / 2], [h - 0.035, h], [-d / 2, zs + 0.012], { bevel: 0.005, plan: false }),
    ];
    // Louvred doors.
    const n = w > 0.55 ? 2 : 1;
    const dw = w / n;
    const stile = 0.05;
    cells(n, -w / 2, w / 2).forEach((cx, i) => {
      const x: V2 = [cx - dw / 2 + 0.002, cx + dw / 2 - 0.002];
      parts.push(...frame4('body', x, [dy[0] + 0.002, dy[1] - 0.002], [zf, zs], stile));
      parts.push(span('body', x, [(dy[0] + dy[1]) / 2 - 0.035, (dy[0] + dy[1]) / 2 + 0.035], [zf, zs], o));
      for (const seg of [[dy[0] + stile, (dy[0] + dy[1]) / 2 - 0.035] as V2, [(dy[0] + dy[1]) / 2 + 0.035, dy[1] - stile] as V2]) {
        const k = Math.max(3, Math.round((seg[1] - seg[0]) / 0.06));
        for (const y of cells(k, seg[0], seg[1])) {
          parts.push(box('body', [cx, y, zf + ft / 2], [dw - 2 * stile, ((seg[1] - seg[0]) / k) * 1.05, 0.005], { rotation: [-0.7, 0, 0], plan: false }));
        }
      }
      const kx = n === 2 ? (i === 0 ? x[1] - 0.03 : x[0] + 0.03) : x[1] - 0.03;
      parts.push(...knob('handle', [kx, 1.05, zs], 0.016));
    });
    // Open bay: mop bucket with wringer, spray bottles and a dustpan.
    const iw = w - 2 * t;
    const br = Math.min(0.14, iw * 0.3, (d - 0.1) / 2);
    const bx = -w / 2 + t + br + 0.02;
    const bz = -d / 2 + 0.02 + br;
    const by = bay[0];
    parts.push(
      lathe('items', [bx, by, bz], [
        [0, 0],
        [br * 0.8, 0],
        [br, 0.25],
        [br * 0.95, 0.25],
        [br * 0.76, 0.008],
        [0, 0.008],
      ], { segments: 28, plan: false }),
      span('items', [bx - br * 0.6, bx + br * 0.6], [by + 0.2, by + 0.27], [bz - br * 0.5, bz + br * 0.2], { bevel: 0.01, plan: false }),
      torus('handle', [bx, by + 0.25, bz], br * 0.95, 0.004, { arc: Math.PI, plan: false }),
    );
    const sx = Math.min(w / 2 - t - 0.05, bx + br + 0.06);
    const sbs = sx + 0.1 < w / 2 - t ? [sx, sx + 0.085] : [sx];
    sbs.forEach((x, i) => {
      const z = -d / 2 + 0.07 + i * 0.02;
      parts.push(
        cyl('items2', [x, by + 0.08, z], 0.034, 0.16, { segments: 18, plan: false }),
        span('items', [x - 0.012, x + 0.012], [by + 0.16, by + 0.21], [z - 0.02, z + 0.035], { bevel: 0.005, plan: false }),
        span('items', [x - 0.006, x + 0.006], [by + 0.13, by + 0.17], [z + 0.025, z + 0.033], o),
      );
    });
    parts.push(box('items', [w / 2 - t - 0.08, by + 0.12, zf - 0.04], [0.14, 0.22, 0.012], { rotation: [-0.25, 0, 0], plan: false }));
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w / 2, d / 2 - 0.045], [w / 2, d / 2 - 0.045])],
});

export const LAUNDRY_ASSETS: AssetDefinition[] = [
  tumbleDryer,
  washerDryerStack,
  laundryBasket,
  ironingBoard,
  dryingRack,
  utilitySink,
  waterHeater,
  stickVacuum,
  broomCupboard,
];

import type { AssetDefinition, Part, Size3 } from './types';
import {
  box,
  cells,
  circle,
  clamp,
  cyl,
  defineAsset,
  discZ,
  ellipsePoints,
  lathe,
  line,
  matSlot,
  poly,
  range,
  rectPoly,
  ring,
  rng,
  rod,
  rodPath,
  rodX,
  rodZ,
  span,
  sphere,
  vcyl,
  lerp,
  type V2,
  type V3,
} from './parts';

/** Ceiling height the ceiling-mounted fittings are dimensioned for. */
const CEILING = 2.7;
const LIGHT_SLOT = matSlot('light', 'Light diffuser', 'light-warm');
const WARM = '#ffd9a8';

/** Base elevation that puts a ceiling fitting of height `h` just under the ceiling. */
const ceilingElevation = (h: number): number => CEILING - h - 0.01;

// ---------------------------------------------------------------------------
// Shared fittings
// ---------------------------------------------------------------------------

/** Ceiling canopy (shallow dome + cord collar) whose top sits at y = `top`. */
function canopy(slot: string, top: number, r: number): Part[] {
  return [
    lathe(
      slot,
      [0, top - 0.03, 0],
      [
        [0, 0],
        [r * 0.35, 0],
        [r * 0.8, 0.012],
        [r, 0.026],
        [r, 0.03],
        [0, 0.03],
      ],
      { segments: 28, plan: false },
    ),
    vcyl(slot, 0, 0, top - 0.045, top - 0.03, Math.max(0.006, r * 0.18), { plan: false }),
  ];
}

/**
 * Drum/empire lamp shade with rolled rims. `rB`/`rT` are the outer bottom/top radii (rims
 * included), `c` the centre of its base; `zs` stretches it into an oval along Z.
 */
function drumShade(slot: string, rimSlot: string, c: V3, rB: number, rT: number, sh: number, zs = 1): Part[] {
  const t = clamp(rB * 0.03, 0.003, 0.006);
  const k = 0.003;
  const b = rB - t;
  const tp = rT - t;
  return [
    lathe(
      slot,
      c,
      [
        [b - k, 0],
        [b, 0],
        [tp, sh],
        [tp - k, sh],
        [b - k, 0],
      ],
      { scale: [1, 1, zs], segments: 40 },
    ),
    ring(rimSlot, [c[0], c[1] + t, c[2]], b, t, { zScale: zs, plan: false }),
    ring(rimSlot, [c[0], c[1] + sh - t, c[2]], tp, t, { zScale: zs, plan: false }),
  ];
}

/** Candle-flame / bulb teardrop of radius `r` and height `fh` standing at `base`. */
function flame(slot: string, base: V3, r: number, fh: number): Part {
  return lathe(
    slot,
    base,
    [
      [0, 0],
      [r * 0.8, fh * 0.12],
      [r, fh * 0.35],
      [r * 0.6, fh * 0.7],
      [0, fh],
    ],
    { segments: 16, plan: false },
  );
}

// ---------------------------------------------------------------------------
// Ceiling lights
// ---------------------------------------------------------------------------

const ceilingLight = defineAsset({
  id: 'ceiling-light',
  name: 'Flush ceiling light',
  category: 'lighting',
  type: 'lighting',
  group: 'Ceiling lights',
  tags: ['ceiling light', 'flush mount', 'dome', 'lamp', 'light'],
  defaultSize: { w: 0.4, d: 0.4, h: 0.1 },
  minSize: { w: 0.2, d: 0.2, h: 0.05 },
  maxSize: { w: 1.0, d: 1.0, h: 0.25 },
  mount: 'ceiling',
  defaultElevation: CEILING - 0.1 - 0.01,
  slots: [LIGHT_SLOT, matSlot('metal', 'Canopy & trim', 'metal-white-powder')],
  light: { color: WARM, intensity: 1.2, distance: 6, y: 0.02 },
  build: ({ w, d, h }) => {
    const R = w / 2;
    const zs = d / w;
    const scale: V3 = [1, 1, zs];
    const plateH = Math.min(0.018, h * 0.2);
    const dh = h - plateH;
    const tube = clamp(R * 0.03, 0.003, 0.01);
    const fr = Math.min(0.012, dh * 0.15);
    return [
      cyl('metal', [0, h - plateH / 2, 0], R * 0.86, plateH, { scale, segments: 40 }),
      lathe(
        'light',
        [0, 0, 0],
        [
          [0, 0],
          [R * 0.3, dh * 0.04],
          [R * 0.62, dh * 0.2],
          [R * 0.84, dh * 0.5],
          [R * 0.95, dh * 0.8],
          [R * 0.96, dh],
        ],
        { scale, segments: 48 },
      ),
      // Trim band where the diffuser meets the plate, and a fine bead mid-dome.
      ring('metal', [0, dh - tube, 0], R - tube, tube, { zScale: zs, plan: false }),
      ring('metal', [0, dh * 0.5, 0], R * 0.84, tube * 0.4, { zScale: zs, plan: false }),
      sphere('metal', [0, fr, 0], fr, { scale: [1, 0.8, 1], plan: false }),
    ];
  },
  planDetail: ({ w, d }) => [poly(ellipsePoints(0, 0, (w / 2) * 0.6, (d / 2) * 0.6)), circle([0, 0], 0.012)],
});

function pendantShade(w: number, h: number) {
  const R = w / 2;
  const shadeH = Math.min(0.3, h * 0.4, w * 0.6);
  const bulbR = Math.min(0.05, R * 0.4);
  return { R, shadeH, bulbR, bulbY: Math.max(bulbR, shadeH * 0.3) };
}

const pendant = defineAsset({
  id: 'pendant-lamp',
  name: 'Pendant lamp',
  category: 'lighting',
  type: 'lighting',
  group: 'Ceiling lights',
  tags: ['pendant', 'hanging lamp', 'ceiling', 'dome', 'light'],
  defaultSize: { w: 0.4, d: 0.4, h: 0.9 },
  minSize: { w: 0.15, d: 0.15, h: 0.3 },
  maxSize: { w: 0.9, d: 0.9, h: 1.8 },
  mount: 'ceiling',
  defaultElevation: CEILING - 0.9 - 0.01,
  slots: [matSlot('shade', 'Shade, cord & canopy', 'metal-black-matte'), matSlot('light', 'Bulb', 'light-warm')],
  light: { color: WARM, intensity: 1.4, distance: 5, y: 0.07 },
  build: ({ w, d, h }) => {
    const S = pendantShade(w, h);
    const zs = d / w;
    const tube = clamp(S.R * 0.03, 0.003, 0.008);
    return [
      ...canopy('shade', h, Math.min(0.055, S.R)),
      vcyl('shade', 0, 0, S.shadeH + 0.03, h - 0.045, 0.0035, { plan: false }),
      vcyl('shade', 0, 0, S.shadeH - 0.005, S.shadeH + 0.03, 0.012, { rTop: 0.008, plan: false }),
      lathe(
        'shade',
        [0, 0, 0],
        [
          [S.R - tube, 0],
          [S.R * 0.97 - tube, S.shadeH * 0.15],
          [S.R * 0.8, S.shadeH * 0.55],
          [S.R * 0.45, S.shadeH * 0.88],
          [0.025, S.shadeH],
          [0, S.shadeH],
        ],
        { scale: [1, 1, zs], segments: 48 },
      ),
      ring('shade', [0, tube, 0], S.R - tube, tube, { zScale: zs, plan: false }),
      vcyl('shade', 0, 0, S.bulbY + S.bulbR * 0.7, S.shadeH * 0.9, Math.min(0.018, S.R * 0.3), { plan: false }),
      sphere('light', [0, S.bulbY, 0], S.bulbR, { plan: false }),
    ];
  },
  planDetail: ({ w, d }) => [poly(ellipsePoints(0, 0, (w / 2) * 0.55, (d / 2) * 0.55)), circle([0, 0], 0.015)],
});

const pendantLinear = defineAsset({
  id: 'pendant-linear',
  name: 'Linear pendant',
  category: 'lighting',
  type: 'lighting',
  group: 'Ceiling lights',
  tags: ['linear', 'pendant', 'bar light', 'dining light', 'suspended'],
  defaultSize: { w: 1.2, d: 0.08, h: 0.8 },
  minSize: { w: 0.5, d: 0.05, h: 0.3 },
  maxSize: { w: 2.4, d: 0.2, h: 1.5 },
  mount: 'ceiling',
  defaultElevation: CEILING - 0.8 - 0.01,
  slots: [matSlot('body', 'Body & wires', 'metal-black-matte'), LIGHT_SLOT],
  light: { color: WARM, intensity: 1.6, distance: 4, y: 0 },
  build: ({ w, d, h }) => {
    const bh = 0.055;
    const cx = w * 0.3;
    const cz = Math.min(d / 2, 0.035);
    const parts: Part[] = [
      span('body', [-w / 2 + 0.012, w / 2 - 0.012], [0.006, bh], [-d / 2 + 0.002, d / 2 - 0.002], { bevel: 0.006 }),
      span('light', [-w / 2 + 0.02, w / 2 - 0.02], [0, 0.008], [-d / 2 + 0.008, d / 2 - 0.008], { plan: false }),
      // Ceiling rail.
      span('body', [-cx - 0.04, cx + 0.04], [h - 0.022, h], [-cz, cz], { bevel: 0.004, plan: false }),
    ];
    for (const s of [-1, 1]) {
      parts.push(
        span('body', s < 0 ? [-w / 2, -w / 2 + 0.012] : [w / 2 - 0.012, w / 2], [0.003, bh + 0.002], [-d / 2, d / 2], {
          bevel: 0.003,
          plan: false,
        }),
        vcyl('body', s * cx, 0, bh + 0.025, h - 0.022, 0.0015, { plan: false }),
        vcyl('body', s * cx, 0, bh, bh + 0.025, 0.006, { rTop: 0.004, plan: false }),
        vcyl('body', s * cx, 0, h - 0.035, h - 0.022, 0.006, { rTop: 0.009, plan: false }),
      );
    }
    // Shallow groove along the top of the bar.
    parts.push(span('body', [-w / 2 + 0.03, w / 2 - 0.03], [bh, bh + 0.003], [-0.004, 0.004], { plan: false }));
    return parts;
  },
  planDetail: ({ w, d }) => [rectPoly(-w / 2 + 0.02, -d / 2 + 0.008, w / 2 - 0.02, d / 2 - 0.008)],
});

const chandelier = defineAsset({
  id: 'chandelier',
  name: 'Chandelier',
  category: 'lighting',
  type: 'lighting',
  group: 'Ceiling lights',
  tags: ['chandelier', 'candelabra', 'crystal', 'ceiling', 'classic', 'dining light'],
  defaultSize: { w: 0.8, d: 0.8, h: 0.8 },
  minSize: { w: 0.5, d: 0.5, h: 0.5 },
  maxSize: { w: 1.4, d: 1.4, h: 1.5 },
  mount: 'ceiling',
  defaultElevation: ceilingElevation(0.8),
  slots: [
    matSlot('metal', 'Frame', 'metal-brass'),
    matSlot('light', 'Bulbs', 'light-warm'),
    matSlot('sleeves', 'Candle sleeves', 'plastic-white'),
    matSlot('crystals', 'Crystals', 'glass-clear'),
  ],
  light: { color: WARM, intensity: 1.8, distance: 6, y: 0.34 },
  build: ({ w, d, h }) => {
    const rx = w / 2 - 0.05;
    const rz = d / 2 - 0.05;
    const n = clamp(Math.round(Math.min(w, d) * 8), 5, 10);
    const yA = h * 0.32;
    const y0 = h * 0.08;
    const colTop = h * 0.62;
    const L = colTop - y0;
    const cl = clamp(h * 0.12, 0.06, 0.12);
    const parts: Part[] = [
      ...canopy('metal', h, 0.07),
      vcyl('metal', 0, 0, colTop, h - 0.045, 0.008, { plan: false }),
      sphere('metal', [0, lerp(colTop, h - 0.045, 0.5), 0], 0.018, { plan: false }),
      lathe(
        'metal',
        [0, y0, 0],
        [
          [0, 0],
          [0.02, 0],
          [0.045, L * 0.1],
          [0.03, L * 0.25],
          [0.055, L * 0.4],
          [0.035, L * 0.55],
          [0.02, L * 0.75],
          [0.03, L * 0.9],
          [0.012, L],
          [0, L],
        ],
        { segments: 24 },
      ),
      lathe(
        'metal',
        [0, 0, 0],
        [
          [0, 0],
          [0.012, y0 * 0.3],
          [0.02, y0 * 0.7],
          [0.014, y0],
          [0, y0],
        ],
        { segments: 16, plan: false },
      ),
      cyl('metal', [0, yA, 0], 0.07, 0.02, { segments: 24, plan: false }),
    ];
    for (const i of range(n)) {
      const a = (2 * Math.PI * i) / n + Math.PI / n;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const tip: V3 = [c * rx, yA + 0.02, s * rz];
      parts.push(
        ...rodPath(
          'metal',
          [
            [c * 0.05, yA, s * 0.05],
            [c * rx * 0.55, yA - 0.07, s * rz * 0.55],
            [c * rx * 0.9, yA - 0.03, s * rz * 0.9],
            tip,
          ],
          0.007,
        ),
        cyl('metal', [tip[0], tip[1] + 0.005, tip[2]], 0.032, 0.008, { segments: 20, plan: false }),
        vcyl('sleeves', tip[0], tip[2], tip[1] + 0.009, tip[1] + 0.009 + cl, 0.011, { plan: false }),
        flame('light', [tip[0], tip[1] + 0.009 + cl, tip[2]], 0.014, 0.045),
        vcyl('metal', tip[0], tip[2], tip[1] - 0.035, tip[1], 0.0015, { plan: false }),
        sphere('crystals', [tip[0], tip[1] - 0.05, tip[2]], 0.012, { scale: [1, 1.6, 1], plan: false }),
        sphere('crystals', [c * rx * 0.55, yA - 0.1, s * rz * 0.55], 0.014, { scale: [1, 1.5, 1], plan: false }),
        sphere('crystals', [c * 0.06, colTop - 0.03, s * 0.06], 0.012, { plan: false }),
      );
    }
    return parts;
  },
  planDetail: ({ w, d }) => [
    poly(ellipsePoints(0, 0, w / 2 - 0.05, d / 2 - 0.05)),
    poly(ellipsePoints(0, 0, (w / 2 - 0.05) * 0.55, (d / 2 - 0.05) * 0.55)),
    circle([0, 0], 0.055),
  ],
});

const pendantGlobeCluster = defineAsset({
  id: 'pendant-globe-cluster',
  name: 'Globe pendant cluster',
  category: 'lighting',
  type: 'lighting',
  group: 'Ceiling lights',
  tags: ['globe', 'cluster', 'pendant', 'bubble', 'opal glass', 'stairwell'],
  defaultSize: { w: 0.6, d: 0.6, h: 1.0 },
  minSize: { w: 0.35, d: 0.35, h: 0.5 },
  maxSize: { w: 1.2, d: 1.2, h: 2.0 },
  mount: 'ceiling',
  defaultElevation: ceilingElevation(1.0),
  slots: [matSlot('metal', 'Canopy & cords', 'metal-brass'), matSlot('light', 'Opal globes', 'light-warm')],
  light: { color: WARM, intensity: 1.6, distance: 5, y: 0.3 },
  build: ({ w, d, h }) => {
    const m = Math.min(w, d) / 2;
    const n = clamp(Math.round(m * 18), 3, 11);
    const gr = clamp(m * 0.28, 0.05, 0.11);
    const rand = rng(7);
    const zs = d / w;
    const parts: Part[] = [
      cyl('metal', [0, h - 0.01, 0], (w / 2) * 0.88, 0.02, { scale: [1, 1, zs], segments: 40, plan: false }),
      cyl('metal', [0, h - 0.025, 0], (w / 2) * 0.8, 0.01, { scale: [1, 1, zs], segments: 40, plan: false }),
    ];
    for (const i of range(n)) {
      const a = (2 * Math.PI * (i - 1)) / Math.max(1, n - 1) + rand() * 0.3;
      const rho = i === 0 ? 0 : lerp(0.55, 1, rand());
      const x = Math.cos(a) * (w / 2 - gr - 0.005) * rho;
      const z = Math.sin(a) * (d / 2 - gr - 0.005) * rho;
      const y = i === 0 ? gr + 0.01 : lerp(gr + 0.02, Math.max(gr + 0.03, h * 0.55), rand());
      parts.push(
        vcyl('metal', x, z, y + gr + 0.02, h - 0.03, 0.0018, { plan: false }),
        vcyl('metal', x, z, y + gr * 0.85, y + gr + 0.025, 0.014, { rTop: 0.009, plan: false }),
        sphere('light', [x, y, z], gr),
      );
    }
    return parts;
  },
  planDetail: ({ w, d }) => [poly(ellipsePoints(0, 0, (w / 2) * 0.88, (d / 2) * 0.88))],
});

const pendantRattan = defineAsset({
  id: 'pendant-rattan',
  name: 'Rattan pendant',
  category: 'lighting',
  type: 'lighting',
  group: 'Ceiling lights',
  tags: ['rattan', 'wicker', 'woven', 'pendant', 'boho', 'natural'],
  defaultSize: { w: 0.5, d: 0.5, h: 1.0 },
  minSize: { w: 0.3, d: 0.3, h: 0.4 },
  maxSize: { w: 1.0, d: 1.0, h: 1.8 },
  mount: 'ceiling',
  defaultElevation: ceilingElevation(1.0),
  slots: [
    matSlot('shade', 'Rattan shade', 'rattan-natural'),
    matSlot('cord', 'Cord & canopy', 'metal-black-matte'),
    matSlot('light', 'Bulb', 'light-warm'),
  ],
  light: { color: WARM, intensity: 1.2, distance: 4.5, y: 0.18 },
  build: ({ w, d, h }) => {
    const R0 = w / 2 - 0.012;
    const zs = d / w;
    const sh = clamp(Math.min(w * 0.8, h * 0.6), 0.15, 0.6);
    // Bell profile as [radius fraction, height fraction].
    const prof: V2[] = [
      [0.62, 0],
      [0.88, 0.12],
      [1, 0.3],
      [0.97, 0.5],
      [0.82, 0.7],
      [0.55, 0.86],
      [0.22, 0.96],
      [0.06, 1],
    ];
    const parts: Part[] = [
      ...canopy('cord', h, 0.055),
      vcyl('cord', 0, 0, sh, h - 0.045, 0.0035, { plan: false }),
      vcyl('cord', 0, 0, sh * 0.6, sh, 0.014, { plan: false }),
      sphere('light', [0, sh * 0.45, 0], Math.min(0.045, R0 * 0.3), { plan: false }),
      lathe(
        'shade',
        [0, 0, 0],
        prof.map(([r, y]) => [r * R0, y * sh] as V2),
        { scale: [1, 1, zs], segments: 40 },
      ),
      ring('shade', [0, 0.008, 0], prof[0][0] * R0, 0.007, { zScale: zs, plan: false }),
    ];
    for (const k of [1, 2, 3, 4, 5]) {
      const [r, y] = prof[k];
      parts.push(ring('shade', [0, y * sh, 0], r * R0 + 0.001, 0.0045, { zScale: zs, plan: false }));
    }
    // Vertical canes following the bell profile.
    for (const i of range(12)) {
      const a = (2 * Math.PI * i) / 12;
      const pts = prof.slice(0, 7).map(([r, y]) => [Math.cos(a) * r * R0, y * sh, Math.sin(a) * r * R0 * zs] as V3);
      parts.push(...rodPath('shade', pts, 0.003));
    }
    return parts;
  },
  planDetail: ({ w, d }) => [
    poly(ellipsePoints(0, 0, (w / 2) * 0.6, (d / 2) * 0.6)),
    poly(ellipsePoints(0, 0, (w / 2) * 0.85, (d / 2) * 0.85)),
  ],
});

const ceilingFanLight = defineAsset({
  id: 'ceiling-fan-light',
  name: 'Ceiling fan with light',
  category: 'lighting',
  type: 'lighting',
  group: 'Ceiling lights',
  tags: ['ceiling fan', 'fan', 'cooling', 'blades', 'light kit', 'ceiling'],
  defaultSize: { w: 1.3, d: 1.3, h: 0.45 },
  minSize: { w: 0.9, d: 0.9, h: 0.3 },
  maxSize: { w: 1.6, d: 1.6, h: 0.8 },
  mount: 'ceiling',
  defaultElevation: ceilingElevation(0.45),
  slots: [
    matSlot('body', 'Motor & downrod', 'metal-brushed-steel'),
    matSlot('blades', 'Blades', 'wood-walnut'),
    matSlot('light', 'Light kit', 'light-warm'),
  ],
  light: { color: WARM, intensity: 1.3, distance: 6, y: 0.04 },
  build: ({ w, d, h }) => {
    const m = Math.min(w, d) / 2;
    const kitH = 0.07;
    const motorH = clamp(h * 0.28, 0.09, 0.14);
    const motorR = 0.12;
    const yM0 = kitH;
    const yM1 = kitH + motorH;
    const bladeY = yM0 + motorH * 0.45;
    const bw = clamp(m * 0.22, 0.11, 0.16);
    const r0 = 0.17;
    const r1 = m - 0.012;
    const parts: Part[] = [
      ...canopy('body', h, 0.075),
      vcyl('body', 0, 0, yM1, h - 0.04, 0.013, { plan: false }),
      vcyl('body', 0, 0, yM1 - 0.005, yM1 + 0.03, 0.025, { plan: false }),
      lathe(
        'body',
        [0, yM0, 0],
        [
          [0.05, 0],
          [motorR * 0.9, motorH * 0.1],
          [motorR, motorH * 0.4],
          [motorR * 0.95, motorH * 0.7],
          [motorR * 0.55, motorH],
          [0, motorH],
        ],
        { segments: 32, plan: false },
      ),
      ring('body', [0, yM0 + motorH * 0.4, 0], motorR * 0.98, 0.006, { plan: false }),
      lathe(
        'light',
        [0, 0, 0],
        [
          [0, 0],
          [0.05, 0.005],
          [0.09, kitH * 0.45],
          [0.105, kitH * 0.9],
          [0.1, kitH],
        ],
        { segments: 32, plan: false },
      ),
      ring('body', [0, kitH - 0.006, 0], 0.1, 0.006, { plan: false }),
      sphere('body', [0, 0.008, 0], 0.01, { plan: false }),
    ];
    for (const i of range(5)) {
      const a = (2 * Math.PI * i) / 5;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const rc = (r0 + r1) / 2;
      parts.push(
        // Blade iron, then the blade itself (box X axis turned to point along azimuth a).
        box('body', [c * 0.15, bladeY + 0.01, s * 0.15], [0.12, 0.012, 0.04], { rotation: [0, -a, 0], plan: false }),
        box('blades', [c * rc, bladeY + 0.004, s * rc], [r1 - r0, 0.012, bw], { rotation: [0, -a, 0], bevel: 0.005 }),
      );
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const m = Math.min(w, d) / 2;
    return [circle([0, 0], m - 0.012), circle([0, 0], 0.12)];
  },
});

const trackSpotlights = defineAsset({
  id: 'track-spotlights',
  name: 'Track spotlights',
  category: 'lighting',
  type: 'lighting',
  group: 'Ceiling lights',
  tags: ['track', 'spotlights', 'spots', 'gallery lighting', 'rail', 'ceiling'],
  defaultSize: { w: 1.5, d: 0.15, h: 0.25 },
  minSize: { w: 0.6, d: 0.1, h: 0.15 },
  maxSize: { w: 4.0, d: 0.3, h: 0.4 },
  mount: 'ceiling',
  defaultElevation: ceilingElevation(0.25),
  slots: [matSlot('metal', 'Track & heads', 'metal-black-matte'), matSlot('light', 'Lenses', 'light-warm')],
  light: { color: WARM, intensity: 1.4, distance: 5, y: 0.1 },
  build: ({ w, d, h }) => {
    const n = clamp(Math.round(w / 0.42), 2, 8);
    const headR = Math.min(0.035, d * 0.3, h * 0.15);
    const headL = Math.min(0.12, h * 0.4);
    const tilt = 0.5;
    const ct = Math.cos(tilt);
    const st = Math.sin(tilt);
    const yExt = (headL / 2) * ct + headR * st;
    const yc = Math.max(yExt + 0.002, h - 0.09 - headR);
    const parts: Part[] = [
      span('metal', [-w / 2 + 0.012, w / 2 - 0.012], [h - 0.032, h], [-0.018, 0.018], { bevel: 0.004 }),
      span('metal', [-w / 2, -w / 2 + 0.012], [h - 0.034, h], [-0.02, 0.02], { bevel: 0.003, plan: false }),
      span('metal', [w / 2 - 0.012, w / 2], [h - 0.034, h], [-0.02, 0.02], { bevel: 0.003, plan: false }),
    ];
    for (const x of cells(n, -w / 2, w / 2)) {
      const yokeTop = yc + headR + 0.016;
      parts.push(
        span('metal', [x - 0.025, x + 0.025], [h - 0.06, h - 0.032], [-0.02, 0.02], { bevel: 0.004, plan: false }),
        vcyl('metal', x, 0, yokeTop, h - 0.06, 0.006, { plan: false }),
        span('metal', [x - headR - 0.007, x + headR + 0.007], [yokeTop - 0.006, yokeTop], [-0.006, 0.006], {
          plan: false,
        }),
        span('metal', [x - headR - 0.007, x - headR - 0.003], [yc, yokeTop - 0.006], [-0.006, 0.006], { plan: false }),
        span('metal', [x + headR + 0.003, x + headR + 0.007], [yc, yokeTop - 0.006], [-0.006, 0.006], { plan: false }),
        cyl('metal', [x, yc, 0], headR, headL, { rotation: [-tilt, 0, 0], segments: 20, plan: false }),
        cyl('light', [x, yc - ct * (headL / 2 - 0.001), st * (headL / 2 - 0.001)], headR * 0.82, 0.004, {
          rotation: [-tilt, 0, 0],
          segments: 20,
          plan: false,
        }),
      );
    }
    return parts;
  },
  planDetail: ({ w }) => {
    const n = clamp(Math.round(w / 0.42), 2, 8);
    return cells(n, -w / 2, w / 2).map((x) => circle([x, 0.02], 0.03));
  },
});

// ---------------------------------------------------------------------------
// Floor lamps
// ---------------------------------------------------------------------------

const floorLamp = defineAsset({
  id: 'floor-lamp',
  name: 'Floor lamp',
  category: 'lighting',
  type: 'lighting',
  group: 'Floor lamps',
  tags: ['floor lamp', 'standard lamp', 'lamp', 'reading', 'light'],
  defaultSize: { w: 0.42, d: 0.42, h: 1.6 },
  minSize: { w: 0.25, d: 0.25, h: 1.1 },
  maxSize: { w: 0.7, d: 0.7, h: 2.0 },
  slots: [matSlot('light', 'Shade', 'light-warm'), matSlot('base', 'Base & stem', 'metal-black-matte')],
  light: { color: WARM, intensity: 1.2, distance: 4.5, y: 1.4 },
  build: ({ w, d, h }) => {
    const shadeH = Math.min(0.38, Math.max(0.22, h * 0.2));
    const zs = d / w;
    const scale: V3 = [1, 1, zs];
    const rb = (w / 2) * 0.62;
    const yS1 = h - 0.025;
    const yS0 = yS1 - shadeH;
    const parts: Part[] = [
      lathe(
        'base',
        [0, 0, 0],
        [
          [0, 0],
          [rb, 0],
          [rb, 0.012],
          [rb * 0.85, 0.03],
          [rb * 0.3, 0.045],
          [0, 0.045],
        ],
        { scale, segments: 40 },
      ),
      vcyl('base', 0, 0, 0.045, yS0 + shadeH * 0.3, 0.011, { plan: false }),
      vcyl('base', 0, 0, h * 0.33, h * 0.33 + 0.02, 0.016, { plan: false }),
      vcyl('base', 0, 0, h * 0.66, h * 0.66 + 0.02, 0.016, { plan: false }),
      // Socket, bulb, harp and finial.
      vcyl('base', 0, 0, yS0 + shadeH * 0.3, yS0 + shadeH * 0.45, 0.02, { plan: false }),
      sphere('light', [0, yS0 + shadeH * 0.6, 0], 0.035, { plan: false }),
      ...rodPath(
        'base',
        [
          [-0.05, yS0 + shadeH * 0.4, 0],
          [0, h - 0.025, 0],
          [0.05, yS0 + shadeH * 0.4, 0],
        ],
        0.003,
      ),
      sphere('base', [0, h - 0.013, 0], 0.012, { plan: false }),
      ...drumShade('light', 'base', [0, yS0, 0], w / 2, (w / 2) * 0.8, shadeH, zs),
    ];
    // Cord running from the base to the wall, with an inline foot switch.
    const zc = rb * zs;
    if (d / 2 - 0.01 - zc > 0.05) {
      parts.push(rodZ('base', 0, 0.005, -zc, -d / 2 + 0.01, 0.004, { plan: false }));
      const zsw = -(zc + d / 2) / 2;
      parts.push(span('base', [-0.018, 0.018], [0, 0.016], [zsw - 0.03, zsw + 0.03], { bevel: 0.006, plan: false }));
    }
    return parts;
  },
  planDetail: ({ w, d }) => [circle([0, 0], 0.02), poly(ellipsePoints(0, 0, (w / 2) * 0.8, (d / 2) * 0.8))],
});

function arcLampGeom({ w, d, h }: Size3) {
  const bw = clamp(d * 0.75, 0.26, 0.36);
  const bd = Math.min(d - 0.02, bw);
  const xb = -w / 2 + bw / 2;
  const sr = Math.min(d / 2 - 0.005, 0.22);
  const sh = clamp(sr, 0.15, 0.22);
  const xe = w / 2 - sr;
  const th = 0.9;
  const y0 = h * 0.3;
  const Rx = (xe - xb) / (1 + Math.cos(th));
  const cx = xb + Rx;
  const Ry = h - 0.025 - y0;
  const yE = y0 + Ry * Math.sin(th);
  const yS1 = yE - 0.05;
  return { bw, bd, xb, sr, sh, xe, th, y0, Rx, cx, Ry, yE, yS1, yS0: yS1 - sh };
}

const ARC_DEFAULT: Size3 = { w: 1.6, d: 0.45, h: 2.0 };

const floorLampArc = defineAsset({
  id: 'floor-lamp-arc',
  name: 'Arc floor lamp',
  category: 'lighting',
  type: 'lighting',
  group: 'Floor lamps',
  tags: ['arc lamp', 'arco', 'floor lamp', 'overhanging', 'marble', 'reading'],
  defaultSize: ARC_DEFAULT,
  minSize: { w: 1.2, d: 0.35, h: 1.6 },
  maxSize: { w: 2.2, d: 0.6, h: 2.4 },
  slots: [
    matSlot('base', 'Marble base', 'stone-marble-carrara'),
    matSlot('metal', 'Arc & shade', 'metal-chrome'),
    matSlot('light', 'Bulb & diffuser', 'light-warm'),
  ],
  light: (() => {
    const g = arcLampGeom(ARC_DEFAULT);
    return { color: WARM, intensity: 1.4, distance: 5, y: g.yS0 + g.sh * 0.3 };
  })(),
  build: (size) => {
    const g = arcLampGeom(size);
    const bh = 0.07;
    const pts: V3[] = range(13).map((k) => {
      const t = Math.PI - ((Math.PI - g.th) * k) / 12;
      return [g.cx + g.Rx * Math.cos(t), g.y0 + g.Ry * Math.sin(t), 0];
    });
    return [
      span('base', [g.xb - g.bw / 2, g.xb + g.bw / 2], [0, bh], [-g.bd / 2, g.bd / 2], { bevel: 0.01 }),
      vcyl('metal', g.xb, 0, bh, bh + 0.03, 0.025, { plan: false }),
      vcyl('metal', g.xb, 0, bh + 0.03, g.y0, 0.013, { plan: false }),
      ...rodPath('metal', pts, 0.012),
      vcyl('metal', g.xe, 0, g.yS1 - 0.01, g.yE, 0.008, { plan: false }),
      lathe(
        'metal',
        [g.xe, g.yS0, 0],
        [
          [g.sr, 0],
          [g.sr * 0.97, g.sh * 0.15],
          [g.sr * 0.8, g.sh * 0.55],
          [g.sr * 0.45, g.sh * 0.88],
          [0.03, g.sh],
          [0, g.sh],
        ],
        { segments: 40 },
      ),
      ring('metal', [g.xe, g.yS0 + 0.004, 0], g.sr - 0.004, 0.004, { plan: false }),
      cyl('light', [g.xe, g.yS0 + 0.012, 0], g.sr * 0.88, 0.006, { segments: 32, plan: false }),
      sphere('light', [g.xe, g.yS0 + g.sh * 0.4, 0], 0.04, { plan: false }),
    ];
  },
  planDetail: (size) => {
    const g = arcLampGeom(size);
    return [circle([g.xe, 0], g.sr * 0.6), line([g.xb, 0], [g.xe, 0]), circle([g.xb, 0], 0.025)];
  },
});

function tripodGeom({ w, d, h }: Size3) {
  const m = Math.min(w, d) / 2;
  const shadeH = clamp(h * 0.2, 0.24, 0.36);
  const yS1 = h - 0.02;
  const yS0 = yS1 - shadeH;
  return { m, shadeH, yS1, yS0, apex: yS0 - 0.06, sr: Math.min(m * 0.78, 0.3) };
}

const TRIPOD_DEFAULT: Size3 = { w: 0.6, d: 0.6, h: 1.55 };

const floorLampTripod = defineAsset({
  id: 'floor-lamp-tripod',
  name: 'Tripod floor lamp',
  category: 'lighting',
  type: 'lighting',
  group: 'Floor lamps',
  tags: ['tripod', 'floor lamp', 'wooden legs', 'drum shade', 'scandi'],
  defaultSize: TRIPOD_DEFAULT,
  minSize: { w: 0.45, d: 0.45, h: 1.2 },
  maxSize: { w: 0.9, d: 0.9, h: 1.9 },
  slots: [
    matSlot('legs', 'Legs', 'wood-walnut'),
    matSlot('shade', 'Shade', 'fabric-linen'),
    matSlot('fittings', 'Fittings', 'metal-brass'),
    matSlot('light', 'Bulb', 'light-warm'),
  ],
  light: (() => {
    const g = tripodGeom(TRIPOD_DEFAULT);
    return { color: WARM, intensity: 1.2, distance: 4.5, y: g.yS0 + g.shadeH * 0.5 };
  })(),
  build: (size) => {
    const { w, d, h } = size;
    const g = tripodGeom(size);
    const parts: Part[] = [];
    for (const k of range(3)) {
      const a = -Math.PI / 2 + (k * 2 * Math.PI) / 3;
      const foot: V3 = [Math.cos(a) * (w / 2 - 0.03), 0.012, Math.sin(a) * (d / 2 - 0.03)];
      parts.push(
        rod('legs', foot, [Math.cos(a) * 0.03, g.apex, Math.sin(a) * 0.03], 0.015, { rTop: 0.012, plan: false }),
        sphere('fittings', foot, 0.016, { scale: [1, 0.6, 1], plan: false }),
      );
    }
    parts.push(
      vcyl('fittings', 0, 0, g.apex - 0.04, g.apex + 0.02, 0.03, { plan: false }),
      vcyl('fittings', 0, 0, g.apex + 0.02, g.yS0 + g.shadeH * 0.35, 0.009, { plan: false }),
      vcyl('fittings', 0, 0, g.yS0 + g.shadeH * 0.3, g.yS0 + g.shadeH * 0.42, 0.018, { plan: false }),
      sphere('light', [0, g.yS0 + g.shadeH * 0.5, 0], 0.035, { plan: false }),
      ...rodPath(
        'fittings',
        [
          [-0.035, g.yS0 + g.shadeH * 0.42, 0],
          [0, g.yS1 - 0.002, 0],
          [0.035, g.yS0 + g.shadeH * 0.42, 0],
        ],
        0.0025,
      ),
      sphere('fittings', [0, h - 0.012, 0], 0.011, { plan: false }),
      ...drumShade('shade', 'fittings', [0, g.yS0, 0], g.sr, g.sr * 0.88, g.shadeH),
    );
    return parts;
  },
  planDetail: (size) => {
    const g = tripodGeom(size);
    const pts: V2[] = range(3).map((k) => {
      const a = -Math.PI / 2 + (k * 2 * Math.PI) / 3;
      return [Math.cos(a) * (size.w / 2 - 0.03), Math.sin(a) * (size.d / 2 - 0.03)];
    });
    return [circle([0, 0], g.sr), ...pts.map((p) => line([0, 0], p))];
  },
});

// ---------------------------------------------------------------------------
// Table lamps
// ---------------------------------------------------------------------------

const tableLamp = defineAsset({
  id: 'table-lamp',
  name: 'Table lamp',
  category: 'lighting',
  type: 'lighting',
  group: 'Table lamps',
  tags: ['table lamp', 'bedside lamp', 'lamp', 'light', 'ginger jar'],
  defaultSize: { w: 0.32, d: 0.32, h: 0.52 },
  minSize: { w: 0.18, d: 0.18, h: 0.3 },
  maxSize: { w: 0.6, d: 0.6, h: 0.9 },
  // Sits on a bedside/side table by default.
  defaultElevation: 0.5,
  slots: [
    matSlot('light', 'Shade', 'light-warm'),
    matSlot('base', 'Ceramic base', 'ceramic-white'),
    matSlot('fittings', 'Fittings', 'metal-brass'),
  ],
  light: { color: WARM, intensity: 0.8, distance: 3, y: 0.41 },
  build: ({ w, d, h }) => {
    const rb = (Math.min(w, d) / 2) * 0.55;
    const footH = 0.012;
    const bodyH = h * 0.5 - footH;
    const shadeH = h * 0.42;
    const yS1 = h - 0.02;
    const yS0 = yS1 - shadeH;
    const capY = footH + bodyH;
    const zs = d / w;
    return [
      cyl('fittings', [0, footH / 2, 0], rb * 0.66, footH, { segments: 32 }),
      lathe(
        'base',
        [0, footH, 0],
        [
          [0, 0],
          [rb * 0.55, 0],
          [rb * 0.6, bodyH * 0.04],
          [rb * 0.92, bodyH * 0.25],
          [rb, bodyH * 0.5],
          [rb * 0.85, bodyH * 0.8],
          [rb * 0.45, bodyH * 0.93],
          [rb * 0.4, bodyH],
          [0, bodyH],
        ],
        { segments: 32 },
      ),
      cyl('fittings', [0, capY + 0.0075, 0], rb * 0.45, 0.015, { segments: 24, plan: false }),
      vcyl('fittings', 0, 0, capY + 0.015, yS0 + shadeH * 0.3, 0.007, { plan: false }),
      vcyl('fittings', 0, 0, yS0 + shadeH * 0.25, yS0 + shadeH * 0.4, 0.016, { plan: false }),
      sphere('light', [0, yS0 + shadeH * 0.5, 0], Math.min(0.03, rb * 0.5), { plan: false }),
      ...rodPath(
        'fittings',
        [
          [-Math.min(0.045, rb * 0.6), yS0 + shadeH * 0.4, 0],
          [0, yS1 - 0.002, 0],
          [Math.min(0.045, rb * 0.6), yS0 + shadeH * 0.4, 0],
        ],
        0.0022,
      ),
      sphere('fittings', [0, h - 0.01, 0], 0.01, { plan: false }),
      ...drumShade('light', 'fittings', [0, yS0, 0], w / 2, (w / 2) * 0.72, shadeH, zs),
    ];
  },
  planDetail: ({ w, d }) => [poly(ellipsePoints(0, 0, (w / 2) * 0.72, (d / 2) * 0.72)), circle([0, 0], 0.012)],
});

const tableLampMushroom = defineAsset({
  id: 'table-lamp-mushroom',
  name: 'Mushroom table lamp',
  category: 'lighting',
  type: 'lighting',
  group: 'Table lamps',
  tags: ['mushroom', 'table lamp', 'retro', 'glossy', 'bedside', 'dome'],
  defaultSize: { w: 0.3, d: 0.3, h: 0.36 },
  minSize: { w: 0.18, d: 0.18, h: 0.22 },
  maxSize: { w: 0.5, d: 0.5, h: 0.6 },
  defaultElevation: 0.5,
  slots: [
    matSlot('body', 'Shell', 'plastic-white'),
    matSlot('light', 'Diffuser', 'light-warm'),
    matSlot('cord', 'Cord & switch', 'plastic-black'),
  ],
  light: { color: WARM, intensity: 0.7, distance: 3, y: 0.2 },
  build: ({ w, d, h }) => {
    const R = w / 2;
    const zs = d / w;
    const scale: V3 = [1, 1, zs];
    const footH = h * 0.1;
    const capY0 = h * 0.55;
    const ch = h - capY0;
    const parts: Part[] = [
      lathe(
        'body',
        [0, 0, 0],
        [
          [0, 0],
          [R * 0.5, 0],
          [R * 0.52, 0.008],
          [R * 0.42, footH * 0.4],
          [R * 0.14, footH],
          [0, footH],
        ],
        { scale, segments: 40 },
      ),
      lathe(
        'body',
        [0, footH, 0],
        [
          [R * 0.14, 0],
          [R * 0.11, (capY0 - footH) * 0.5],
          [R * 0.15, capY0 - footH],
        ],
        { scale, segments: 32, plan: false },
      ),
      lathe(
        'body',
        [0, capY0, 0],
        [
          [R * 0.98, 0],
          [R, ch * 0.1],
          [R * 0.92, ch * 0.45],
          [R * 0.7, ch * 0.75],
          [R * 0.35, ch * 0.95],
          [0, ch],
        ],
        { scale, segments: 48 },
      ),
      cyl('light', [0, capY0 + 0.004, 0], R * 0.94, 0.006, { scale, segments: 48, plan: false }),
    ];
    const zc = R * 0.45 * zs;
    if (d / 2 - 0.01 - zc > 0.03) {
      const zsw = -(zc + d / 2) / 2;
      parts.push(
        rodZ('cord', 0, 0.004, -zc, -d / 2 + 0.01, 0.003, { plan: false }),
        span('cord', [-0.009, 0.009], [0, 0.012], [zsw - 0.015, zsw + 0.015], { bevel: 0.004, plan: false }),
      );
    }
    return parts;
  },
  planDetail: ({ w, d }) => [poly(ellipsePoints(0, 0, (w / 2) * 0.5, (d / 2) * 0.5)), circle([0, 0], 0.01)],
});

const lavaLamp = defineAsset({
  id: 'lava-lamp',
  name: 'Lava lamp',
  category: 'lighting',
  type: 'lighting',
  group: 'Table lamps',
  tags: ['lava lamp', 'retro', '70s', 'mood light', 'groovy', 'wax'],
  defaultSize: { w: 0.14, d: 0.14, h: 0.42 },
  minSize: { w: 0.1, d: 0.1, h: 0.3 },
  maxSize: { w: 0.25, d: 0.25, h: 0.7 },
  defaultElevation: 0.5,
  slots: [
    matSlot('metal', 'Base & cap', 'metal-chrome'),
    matSlot('glass', 'Liquid', 'water'),
    matSlot('light', 'Wax', 'light-candle'),
  ],
  light: { color: '#ff8a3c', intensity: 0.5, distance: 2.5, y: 0.21 },
  build: ({ w, d, h }) => {
    const R = Math.min(w, d) / 2;
    const bH = h * 0.3;
    const gH = h * 0.55;
    const cH = h - bH - gH;
    const gy = (f: number) => bH + gH * f;
    return [
      lathe(
        'metal',
        [0, 0, 0],
        [
          [0, 0],
          [R, 0],
          [R * 0.98, 0.006],
          [R * 0.55, bH],
          [0, bH],
        ],
        { segments: 32 },
      ),
      ring('metal', [0, bH, 0], R * 0.53, R * 0.04, { plan: false }),
      lathe(
        'glass',
        [0, bH, 0],
        [
          [0, 0],
          [R * 0.5, 0],
          [R * 0.62, gH * 0.3],
          [R * 0.5, gH * 0.7],
          [R * 0.32, gH],
          [0, gH],
        ],
        { segments: 32, plan: false },
      ),
      lathe(
        'metal',
        [0, bH + gH, 0],
        [
          [R * 0.34, 0],
          [R * 0.2, cH],
          [0, cH],
        ],
        { segments: 24, plan: false },
      ),
      sphere('light', [0, gy(0.06), 0], R * 0.42, { scale: [1, 0.45, 1], plan: false }),
      sphere('light', [R * 0.05, gy(0.36), 0], R * 0.26, { scale: [1, 1.3, 1], plan: false }),
      sphere('light', [-R * 0.08, gy(0.6), R * 0.04], R * 0.18, { scale: [1, 1.15, 1], plan: false }),
      sphere('light', [R * 0.04, gy(0.82), 0], R * 0.11, { scale: [1, 1.4, 1], plan: false }),
    ];
  },
  planDetail: ({ w, d }) => [circle([0, 0], (Math.min(w, d) / 2) * 0.6)],
});

// ---------------------------------------------------------------------------
// Wall lights
// ---------------------------------------------------------------------------

const sconce = defineAsset({
  id: 'wall-sconce',
  name: 'Wall sconce',
  category: 'lighting',
  type: 'lighting',
  group: 'Wall lights',
  tags: ['sconce', 'wall light', 'uplighter', 'wall lamp', 'light'],
  defaultSize: { w: 0.14, d: 0.2, h: 0.26 },
  minSize: { w: 0.08, d: 0.1, h: 0.12 },
  maxSize: { w: 0.4, d: 0.4, h: 0.6 },
  mount: 'wall',
  defaultElevation: 1.6,
  slots: [LIGHT_SLOT, matSlot('metal', 'Metal', 'metal-brass')],
  light: { color: WARM, intensity: 0.7, distance: 3, y: 0.2 },
  build: ({ w, d, h }) => {
    const R = Math.min(w / 2, (d / 2) * 0.8);
    const sh = h * 0.5;
    const zc = d / 2 - R;
    const pr = Math.min(w / 2, h * 0.2, 0.05);
    const py = h * 0.4;
    const tube = clamp(R * 0.04, 0.002, 0.005);
    const z0 = -d / 2;
    return [
      discZ('metal', [0, py, z0 + 0.006], pr, 0.012, { segments: 28 }),
      sphere('metal', [0, py + pr * 0.6, z0 + 0.013], 0.004, { plan: false }),
      sphere('metal', [0, py - pr * 0.6, z0 + 0.013], 0.004, { plan: false }),
      ...rodPath(
        'metal',
        [
          [0, py, z0 + 0.012],
          [0, py - h * 0.04, (z0 + zc) / 2],
          [0, h - sh - 0.012, zc],
        ],
        Math.min(0.007, R * 0.15),
      ),
      lathe(
        'metal',
        [0, h - sh - 0.015, zc],
        [
          [0, 0],
          [R * 0.3, 0],
          [R * 0.5, 0.02],
        ],
        { segments: 24, plan: false },
      ),
      lathe(
        'light',
        [0, h - sh, zc],
        [
          [0, 0],
          [R * 0.45, 0],
          [R - tube, sh],
          [R - tube - 0.003, sh],
          [R * 0.45 - 0.003, 0.003],
        ],
        { segments: 32 },
      ),
      ring('metal', [0, h - tube, zc], R - tube, tube, { plan: false }),
      sphere('light', [0, h - sh * 0.55, zc], Math.min(R * 0.4, 0.025), { plan: false }),
    ];
  },
  planDetail: ({ w, d }) => {
    const R = Math.min(w / 2, (d / 2) * 0.8);
    return [circle([0, d / 2 - R], R * 0.6)];
  },
});

const pictureLight = defineAsset({
  id: 'picture-light',
  name: 'Picture light',
  category: 'lighting',
  type: 'lighting',
  group: 'Wall lights',
  tags: ['picture light', 'art light', 'gallery', 'wall light', 'brass'],
  defaultSize: { w: 0.5, d: 0.14, h: 0.12 },
  minSize: { w: 0.25, d: 0.08, h: 0.08 },
  maxSize: { w: 1.2, d: 0.25, h: 0.2 },
  mount: 'wall',
  defaultElevation: 1.82,
  slots: [matSlot('metal', 'Brass', 'metal-brass'), matSlot('light', 'Lamp strip', 'light-warm')],
  light: { color: WARM, intensity: 0.6, distance: 2, y: 0.05 },
  build: ({ w, d, h }) => {
    const z0 = -d / 2;
    const pr = Math.min(0.035, h * 0.3);
    const py = h * 0.55;
    const rH = Math.min(0.03, d * 0.22, h * 0.32);
    const yc = h - rH - 0.004;
    const zc = d / 2 - rH;
    return [
      discZ('metal', [0, py, z0 + 0.005], pr, 0.01, { segments: 28 }),
      sphere('metal', [0, py, z0 + 0.012], 0.009, { plan: false }),
      ...rodPath(
        'metal',
        [
          [0, py, z0 + 0.012],
          [0, (py + yc) / 2 + rH * 0.3, (z0 + zc) / 2],
          [0, yc, zc - rH * 0.8],
        ],
        0.005,
      ),
      rodX('metal', -w / 2 + 0.014, w / 2 - 0.014, yc, zc, rH, { segments: 24 }),
      rodX('metal', -w / 2, -w / 2 + 0.014, yc, zc, rH + 0.003, { segments: 24, plan: false }),
      rodX('metal', w / 2 - 0.014, w / 2, yc, zc, rH + 0.003, { segments: 24, plan: false }),
      span('light', [-w / 2 + 0.02, w / 2 - 0.02], [yc - rH - 0.003, yc - rH + 0.004], [zc - rH * 0.6, zc + rH * 0.6], {
        plan: false,
      }),
    ];
  },
  planDetail: ({ w, d }) => {
    const rH = Math.min(0.03, d * 0.22);
    return [line([-w / 2, d / 2 - rH], [w / 2, d / 2 - rH]), line([0, -d / 2], [0, d / 2 - rH])];
  },
});

function swingGeom({ w, d, h }: Size3) {
  const rB = Math.min(w / 2, 0.13);
  const sh = clamp(h * 0.42, 0.14, 0.24);
  const yA = h * 0.65;
  const yS1 = yA - 0.02;
  return { rB, sh, yA, yS1, yS0: yS1 - sh, zs: d / 2 - rB };
}

const SWING_DEFAULT: Size3 = { w: 0.25, d: 0.6, h: 0.45 };

const wallLampSwingArm = defineAsset({
  id: 'wall-lamp-swing-arm',
  name: 'Swing-arm wall lamp',
  category: 'lighting',
  type: 'lighting',
  group: 'Wall lights',
  tags: ['swing arm', 'wall lamp', 'reading light', 'bedside', 'adjustable'],
  defaultSize: SWING_DEFAULT,
  minSize: { w: 0.18, d: 0.4, h: 0.35 },
  maxSize: { w: 0.4, d: 0.9, h: 0.6 },
  mount: 'wall',
  defaultElevation: 1.1,
  slots: [
    matSlot('metal', 'Arm & plate', 'metal-brass'),
    matSlot('shade', 'Shade', 'fabric-linen'),
    matSlot('light', 'Bulb', 'light-warm'),
  ],
  light: (() => {
    const g = swingGeom(SWING_DEFAULT);
    return { color: WARM, intensity: 0.8, distance: 3, y: g.yS0 + g.sh * 0.45 };
  })(),
  build: (size) => {
    const { w, d, h } = size;
    const g = swingGeom(size);
    const z0 = -d / 2;
    const pw = Math.min(w / 2 - 0.01, 0.035);
    const zMid = (z0 + 0.025 + g.zs) / 2;
    return [
      span('metal', [-pw, pw], [h * 0.2, h * 0.8], [z0, z0 + 0.012], { bevel: 0.004 }),
      discZ('metal', [0, h * 0.3, z0 + 0.016], 0.008, 0.01, { plan: false }),
      vcyl('metal', 0, z0 + 0.025, g.yA - 0.04, g.yA + 0.02, 0.012, { plan: false }),
      rodZ('metal', 0, g.yA - 0.03, z0 + 0.012, z0 + 0.025, 0.006, { plan: false }),
      rodZ('metal', 0, g.yA, z0 + 0.025, zMid, 0.008, { plan: false }),
      vcyl('metal', 0, zMid, g.yA - 0.02, g.yA + 0.02, 0.012, { plan: false }),
      rodZ('metal', 0, g.yA, zMid, g.zs, 0.008, { plan: false }),
      sphere('metal', [0, g.yA, g.zs], 0.011, { plan: false }),
      vcyl('metal', 0, g.zs, g.yS0 + g.sh * 0.55, g.yA, 0.006, { plan: false }),
      vcyl('metal', 0, g.zs, g.yS0 + g.sh * 0.35, g.yS0 + g.sh * 0.55, 0.018, { plan: false }),
      sphere('light', [0, g.yS0 + g.sh * 0.45, g.zs], Math.min(0.035, g.rB * 0.4), { plan: false }),
      ...drumShade('shade', 'metal', [0, g.yS0, g.zs], g.rB, g.rB * 0.75, g.sh),
    ];
  },
  planDetail: (size) => {
    const g = swingGeom(size);
    return [circle([0, g.zs], g.rB * 0.75), line([0, -size.d / 2], [0, g.zs])];
  },
});

export const LIGHTING_ASSETS: AssetDefinition[] = [
  ceilingLight,
  pendant,
  pendantLinear,
  chandelier,
  pendantGlobeCluster,
  pendantRattan,
  ceilingFanLight,
  trackSpotlights,
  floorLamp,
  floorLampArc,
  floorLampTripod,
  tableLamp,
  tableLampMushroom,
  lavaLamp,
  sconce,
  pictureLight,
  wallLampSwingArm,
];

import type { AssetDefinition, Part } from './types';
import {
  bookRow,
  box,
  cellSpans,
  circle,
  clamp,
  cyl,
  defineAsset,
  discZ,
  frame4,
  line,
  matSlot,
  prism,
  range,
  rectPoly,
  ring,
  rod,
  rodPath,
  rodX,
  rodZ,
  roundRectPoints,
  slats,
  span,
  spaced,
  sphere,
  torus,
  turnedLeg,
  vcyl,
  type V2,
  type V3,
} from './parts';

const SCREEN_SLOT = matSlot('screen', 'Screen', 'screen-black');
const TRIM_SLOT = matSlot('trim', 'Logo & status light', 'metal-brushed-steel');
const LED_SLOT = matSlot('led', 'Status lights', 'screen-glow');

/** Flat panel with a thin bezel: housing slab, recessed screen and a slightly thicker chin with logo. */
function flatPanel(x: V2, y: V2, zBack: number, zFront: number, bezel: number, chin: number): Part[] {
  const [x0, x1] = x;
  const [y0, y1] = y;
  return [
    span('body', [x0, x1], [y0, y1], [zBack, zFront - 0.002], { bevel: 0.002 }),
    span('screen', [x0 + bezel, x1 - bezel], [y0 + chin, y1 - bezel], [zFront - 0.003, zFront - 0.001], { plan: false }),
    ...frame4('body', [x0, x1], [y0, y1], [zFront - 0.002, zFront], bezel),
    span('body', [x0 + bezel, x1 - bezel], [y0 + bezel, y0 + chin], [zFront - 0.002, zFront], { plan: false }),
    span('trim', [(x0 + x1) / 2 - 0.022, (x0 + x1) / 2 + 0.022], [y0 + chin * 0.35, y0 + chin * 0.65], [zFront, zFront + 0.001], { plan: false }),
    sphere('trim', [x1 - bezel - 0.03, y0 + chin * 0.5, zFront], 0.0018, { plan: false }),
  ];
}

// ---------------------------------------------------------------------------
// TV, monitor and audio
// ---------------------------------------------------------------------------

const tvStand = defineAsset({
  id: 'tv-stand',
  name: 'TV on stand',
  category: 'electronics',
  type: 'electronics',
  group: 'TV & audio',
  tags: ['tv', 'television', 'screen', 'display', 'pedestal'],
  defaultSize: { w: 1.25, d: 0.25, h: 0.8 },
  minSize: { w: 0.6, d: 0.18, h: 0.4 },
  maxSize: { w: 2.2, d: 0.4, h: 1.4 },
  slots: [SCREEN_SLOT, matSlot('body', 'Bezel & stand', 'metal-black-matte'), TRIM_SLOT],
  build: ({ w, d, h }) => {
    const screenH = Math.min(w * 0.5625, h - 0.07);
    const y0 = h - screenH;
    const baseW = Math.min(w * 0.25, 0.3);
    const bd = d - 0.02;
    return [
      ...flatPanel([-w / 2, w / 2], [y0, h], -0.012, 0.006, 0.006, 0.016),
      // Rear housing bulge with vents, VESA neck and pedestal.
      span('body', [-w * 0.36, w * 0.36], [y0 + screenH * 0.1, y0 + screenH * 0.72], [-0.045, -0.012], { bevel: 0.012, plan: false }),
      ...slats('trim', [-w * 0.3, w * 0.3], [y0 + screenH * 0.6, y0 + screenH * 0.68], [-0.047, -0.044], 8, { axis: 'x', gap: 0.6, plan: false }),
      span('body', [-0.035, 0.035], [0.02, y0 + screenH * 0.3], [-0.068, -0.04], { bevel: 0.01, plan: false }),
      span('body', [-0.05, 0.05], [0.014, 0.03], [-0.075, -0.03], { bevel: 0.006, plan: false }),
      prism('body', roundRectPoints(0, 0, baseW * 2, bd, Math.min(0.04, bd * 0.3)), 0, 0.014),
      // Remote resting on the base.
      span('body', [baseW * 0.3, baseW * 0.3 + 0.16], [0.014, 0.026], [bd / 2 - 0.05, bd / 2 - 0.012], { bevel: 0.005, plan: false }),
      sphere('trim', [baseW * 0.3 + 0.02, 0.026, bd / 2 - 0.031], 0.004, { plan: false }),
    ];
  },
});

const tvWall = defineAsset({
  id: 'tv-wall',
  name: 'Wall-mounted TV',
  category: 'electronics',
  type: 'electronics',
  group: 'TV & audio',
  tags: ['tv', 'television', 'screen', 'wall mounted', 'flat screen'],
  defaultSize: { w: 1.45, d: 0.06, h: 0.83 },
  minSize: { w: 0.6, d: 0.03, h: 0.34 },
  maxSize: { w: 2.5, d: 0.12, h: 1.45 },
  mount: 'wall',
  defaultElevation: 0.95,
  slots: [SCREEN_SLOT, matSlot('body', 'Bezel & bracket', 'metal-black-matte'), TRIM_SLOT],
  build: ({ w, d, h }) => {
    const pt = Math.min(0.028, d * 0.6);
    const zp = d / 2 - pt;
    const gap = zp + d / 2;
    const hz = Math.min(0.02, gap * 0.5);
    return [
      ...flatPanel([-w / 2, w / 2], [0, h], zp, d / 2, 0.006, 0.015),
      span('body', [-w * 0.32, w * 0.32], [h * 0.15, h * 0.7], [zp - hz, zp], { bevel: Math.min(0.008, hz * 0.4), plan: false }),
      // Wall plate and two hanging rails.
      span('body', [-w * 0.2, w * 0.2], [h * 0.3, h * 0.62], [-d / 2, -d / 2 + 0.005], { plan: false }),
      span('body', [-w * 0.16, -w * 0.13], [h * 0.25, h * 0.66], [-d / 2 + 0.005, zp - hz], { plan: false }),
      span('body', [w * 0.13, w * 0.16], [h * 0.25, h * 0.66], [-d / 2 + 0.005, zp - hz], { plan: false }),
    ];
  },
});

/** Cone driver with surround, dust cap and trim ring, its front at depth z. */
function driver(x: number, y: number, z: number, r: number): Part[] {
  return [
    discZ('driver', [x, y, z - 0.005], r * 0.45, 0.01, { rTop: r * 0.86, segments: 24, plan: false }),
    torus('driver', [x, y, z - 0.002], r * 0.9, r * 0.08, { plan: false }),
    sphere('driver', [x, y, z - 0.004], r * 0.3, { scale: [1, 1, 0.4], plan: false }),
    torus('trim', [x, y, z - 0.002], r + 0.004, 0.003, { plan: false }),
  ];
}

const speaker = defineAsset({
  id: 'speaker-floor',
  name: 'Floor-standing speaker',
  category: 'electronics',
  type: 'electronics',
  group: 'TV & audio',
  tags: ['speaker', 'hifi', 'audio', 'tower', 'loudspeaker'],
  defaultSize: { w: 0.22, d: 0.3, h: 1.0 },
  minSize: { w: 0.12, d: 0.15, h: 0.2 },
  maxSize: { w: 0.5, d: 0.6, h: 1.4 },
  slots: [
    matSlot('cabinet', 'Cabinet', 'wood-walnut'),
    matSlot('driver', 'Drivers & plinth', 'metal-black-matte'),
    matSlot('trim', 'Driver rings & spikes', 'metal-brushed-steel'),
  ],
  build: ({ w, d, h }) => {
    const plinth = Math.min(0.03, h * 0.1);
    const spike = Math.min(0.012, plinth * 0.4);
    const zf = d / 2 - 0.012;
    const rt = Math.min(w * 0.15, 0.025);
    const yt = h - Math.max(0.06, rt + 0.04);
    const top = yt - rt - 0.03;
    const rw = Math.max(0.01, Math.min(w * 0.38, 0.09, (top - plinth) / 2 - 0.005));
    const n = clamp(Math.floor((top - plinth) / (2 * rw + 0.04)), 1, 3);
    const parts: Part[] = [
      span('cabinet', [-w / 2, w / 2], [plinth, h], [-d / 2, zf], { bevel: 0.008 }),
      span('driver', [-w / 2 + 0.004, w / 2 - 0.004], [plinth + 0.002, h - 0.004], [zf - 0.002, zf + 0.002], { bevel: 0.006, plan: false }),
      span('driver', [-w / 2, w / 2], [spike, plinth], [-d / 2, d / 2], { bevel: 0.003 }),
      // Tweeter: waveguide plate, soft dome, trim ring.
      discZ('driver', [0, yt, zf + 0.004], rt * 1.45, 0.006, { segments: 24, plan: false }),
      sphere('trim', [0, yt, zf + 0.006], rt * 0.55, { scale: [1, 1, 0.5], plan: false }),
      torus('trim', [0, yt, zf + 0.007], rt * 1.45, 0.0025, { plan: false }),
    ];
    for (const i of range(n)) {
      parts.push(...driver(0, top - rw - i * (2 * rw + 0.04), zf + 0.009, rw));
    }
    // Bass reflex port near the floor and a terminal plate at the back.
    const portY = plinth + Math.min(0.06, (h - plinth) * 0.08);
    const portR = Math.min(0.025, w * 0.15);
    if (top - n * (2 * rw + 0.04) > portY + portR) {
      parts.push(torus('driver', [0, portY + portR, zf + 0.003], portR, Math.min(0.006, portR * 0.3), { plan: false }));
    }
    parts.push(span('driver', [-w * 0.3, w * 0.3], [plinth + 0.05, plinth + 0.12], [-d / 2 - 0.002, -d / 2 + 0.002], { plan: false }));
    for (const x of [-w / 2 + 0.03, w / 2 - 0.03]) {
      for (const z of [-d / 2 + 0.03, d / 2 - 0.03]) {
        parts.push(cyl('trim', [x, spike / 2, z], 0.003, spike, { rTop: 0.01, segments: 12, plan: false }));
      }
    }
    return parts;
  },
});

const soundbar = defineAsset({
  id: 'soundbar',
  name: 'Soundbar',
  category: 'electronics',
  type: 'electronics',
  group: 'TV & audio',
  tags: ['soundbar', 'speaker', 'audio', 'tv sound'],
  defaultSize: { w: 0.9, d: 0.1, h: 0.07 },
  minSize: { w: 0.4, d: 0.06, h: 0.04 },
  maxSize: { w: 1.6, d: 0.16, h: 0.15 },
  // Sits on a media console by default.
  defaultElevation: 0.5,
  wallSnap: true,
  slots: [
    matSlot('body', 'Body', 'metal-black-matte'),
    matSlot('grille', 'Grille', 'fabric-wool-grey'),
    matSlot('trim', 'End caps & buttons', 'metal-anthracite'),
    LED_SLOT,
  ],
  build: ({ w, d, h }) => {
    const cap = 0.014;
    const parts: Part[] = [
      span('body', [-w / 2 + cap, w / 2 - cap], [0.004, h], [-d / 2, d / 2 - 0.004], { bevel: Math.min(0.015, h * 0.3) }),
      span('grille', [-w / 2 + cap, w / 2 - cap], [0.01, h - 0.008], [d / 2 - 0.008, d / 2], { bevel: 0.003, plan: false }),
      span('trim', [-w / 2, -w / 2 + cap], [0.004, h], [-d / 2, d / 2], { bevel: Math.min(0.012, h * 0.25) }),
      span('trim', [w / 2 - cap, w / 2], [0.004, h], [-d / 2, d / 2], { bevel: Math.min(0.012, h * 0.25) }),
      span('led', [-0.025, 0.025], [0.014, 0.017], [d / 2, d / 2 + 0.001], { plan: false }),
    ];
    // Top touch buttons.
    for (const i of range(4)) {
      parts.push(cyl('trim', [w * 0.1 + i * 0.03, h - 0.001, 0], 0.007, 0.003, { segments: 16, plan: false }));
    }
    // Rubber feet strips.
    for (const x of [-w / 2 + 0.08, w / 2 - 0.08]) {
      parts.push(span('body', [x - 0.03, x + 0.03], [0, 0.004], [-d / 2 + 0.015, d / 2 - 0.015], { plan: false }));
    }
    return parts;
  },
});

const turntable = defineAsset({
  id: 'turntable',
  name: 'Record player on stand',
  category: 'electronics',
  type: 'electronics',
  group: 'TV & audio',
  tags: ['record player', 'turntable', 'vinyl', 'hifi', 'music', 'retro', 'lp'],
  defaultSize: { w: 0.62, d: 0.42, h: 0.78 },
  minSize: { w: 0.5, d: 0.36, h: 0.62 },
  maxSize: { w: 0.9, d: 0.5, h: 0.95 },
  wallSnap: true,
  slots: [
    matSlot('wood', 'Wood', 'wood-walnut'),
    matSlot('metal', 'Platter & tonearm', 'metal-brushed-steel'),
    matSlot('vinyl', 'Vinyl & knobs', 'plastic-black'),
    matSlot('sleeves', 'Record sleeves', 'book-mix'),
  ],
  build: ({ w, d, h }) => {
    const standTop = h - 0.105;
    const legH = clamp(h * 0.25, 0.15, 0.22);
    const topT = 0.022;
    const st = 0.018;
    const yIn = legH + st;
    const yInTop = standTop - topT;
    const parts: Part[] = [
      span('wood', [-w / 2, w / 2], [yInTop, standTop], [-d / 2, d / 2], { bevel: 0.004 }),
      span('wood', [-w / 2 + 0.01, w / 2 - 0.01], [legH, yIn], [-d / 2 + 0.01, d / 2 - 0.01], { plan: false }),
      span('wood', [-w / 2 + 0.01, -w / 2 + 0.01 + st], [yIn, yInTop], [-d / 2 + 0.01, d / 2 - 0.01], { plan: false }),
      span('wood', [w / 2 - 0.01 - st, w / 2 - 0.01], [yIn, yInTop], [-d / 2 + 0.01, d / 2 - 0.01], { plan: false }),
      span('wood', [-w / 2 + 0.01, w / 2 - 0.01], [yIn, yInTop], [-d / 2 + 0.01, -d / 2 + 0.02], { plan: false }),
    ];
    // Splayed tapered legs.
    for (const x of [-w / 2 + 0.05, w / 2 - 0.05]) {
      for (const z of [-d / 2 + 0.05, d / 2 - 0.05]) parts.push(turnedLeg('wood', x, z, 0, legH, 0.02, { style: 'taper' }));
    }
    // Record cubby on the left, amplifier on the right.
    const xDiv = -w / 2 + 0.01 + st + Math.min(0.26, (w - 0.06) * 0.5);
    parts.push(span('wood', [xDiv, xDiv + st], [yIn, yInTop], [-d / 2 + 0.02, d / 2 - 0.01], { plan: false }));
    const recH = Math.min(0.315, yInTop - yIn - 0.01);
    const recD = Math.min(0.315, d - 0.05);
    parts.push(
      ...bookRow('sleeves', [-w / 2 + 0.01 + st, xDiv - 0.004], yIn, -d / 2 + 0.025, recH, recD, 47, {
        minW: 0.005,
        maxW: 0.009,
        fill: 0.85,
      }),
    );
    const ax0 = xDiv + st + 0.015;
    const ax1 = w / 2 - 0.01 - st - 0.015;
    const ampH = Math.min(0.1, yInTop - yIn - 0.04);
    const az1 = d / 2 - 0.04;
    parts.push(span('metal', [ax0, ax1], [yIn, yIn + ampH], [-d / 2 + 0.04, az1], { bevel: 0.004, plan: false }));
    for (const fx of [ax0 + 0.035, ax1 - 0.035]) {
      parts.push(discZ('vinyl', [fx, yIn + ampH / 2, az1 + 0.008], 0.016, 0.016, { segments: 20, plan: false }));
    }
    parts.push(span('vinyl', [(ax0 + ax1) / 2 - 0.04, (ax0 + ax1) / 2 + 0.04], [yIn + ampH * 0.4, yIn + ampH * 0.7], [az1, az1 + 0.002], { plan: false }));
    // Two LPs lying on top of the amp.
    if (yInTop - (yIn + ampH) > 0.02) {
      const lp = Math.min(0.155, (ax1 - ax0) / 2, d / 2 - 0.03);
      parts.push(span('sleeves', [(ax0 + ax1) / 2 - lp, (ax0 + ax1) / 2 + lp], [yIn + ampH, yIn + ampH + 0.008], [-lp, lp], { plan: false }));
    }
    // Turntable: plinth on feet, platter, record with label, spindle, tonearm.
    const tw = Math.min(0.45, w - 0.04);
    const td = Math.min(0.36, d - 0.04);
    const py = standTop + 0.01;
    const pTop = py + 0.06;
    parts.push(span('wood', [-tw / 2, tw / 2], [py, pTop], [-td / 2, td / 2], { bevel: 0.008, plan: false }));
    for (const x of [-tw / 2 + 0.04, tw / 2 - 0.04]) {
      for (const z of [-td / 2 + 0.04, td / 2 - 0.04]) parts.push(vcyl('metal', x, z, standTop, py, 0.018, { plan: false }));
    }
    const pr = Math.min(0.15, td / 2 - 0.025, (tw - 0.12) / 2);
    const px = -tw / 2 + pr + 0.03;
    parts.push(
      cyl('metal', [px, pTop + 0.007, 0], pr, 0.014, { segments: 40, plan: false }),
      cyl('vinyl', [px, pTop + 0.015, 0], pr - 0.004, 0.002, { segments: 40, plan: false }),
      ring('metal', [px, pTop + 0.0162, 0], pr * 0.62, 0.0006, { plan: false }),
      cyl('sleeves', [px, pTop + 0.0165, 0], pr * 0.32, 0.0015, { segments: 24, plan: false }),
      vcyl('metal', px, 0, pTop + 0.014, pTop + 0.028, 0.0035, { plan: false }),
    );
    const ax = px + pr + 0.045;
    const az = -pr * 0.55;
    parts.push(
      vcyl('metal', ax, az, pTop, pTop + 0.03, 0.018, { plan: false }),
      sphere('metal', [ax, pTop + 0.034, az], 0.01, { plan: false }),
      rodZ('metal', ax, pTop + 0.034, az - 0.05, az, 0.004, { plan: false }),
      cyl('vinyl', [ax, pTop + 0.034, az - 0.05], 0.014, 0.024, { rotation: [Math.PI / 2, 0, 0], plan: false }),
      rod('metal', [ax, pTop + 0.034, az], [ax - 0.012, pTop + 0.03, az + pr * 1.4], 0.0035, { plan: false }),
      box('vinyl', [ax - 0.016, pTop + 0.026, az + pr * 1.4 + 0.012], [0.016, 0.008, 0.03], { plan: false }),
      vcyl('metal', ax + 0.025, az + pr * 1.2, pTop, pTop + 0.03, 0.004, { plan: false }),
      // Start/stop and speed buttons, pitch slider.
      span('metal', [-tw / 2 + 0.03, -tw / 2 + 0.07], [pTop, pTop + 0.004], [td / 2 - 0.03, td / 2 - 0.015], { plan: false }),
      span('metal', [-tw / 2 + 0.08, -tw / 2 + 0.1], [pTop, pTop + 0.004], [td / 2 - 0.03, td / 2 - 0.015], { plan: false }),
      span('vinyl', [tw / 2 - 0.025, tw / 2 - 0.015], [pTop, pTop + 0.002], [td / 2 - 0.12, td / 2 - 0.02], { plan: false }),
    );
    return parts;
  },
  planDetail: ({ w, d }) => {
    const tw = Math.min(0.45, w - 0.04);
    const td = Math.min(0.36, d - 0.04);
    const pr = Math.min(0.15, td / 2 - 0.025, (tw - 0.12) / 2);
    const px = -tw / 2 + pr + 0.03;
    return [rectPoly(-tw / 2, -td / 2, tw / 2, td / 2), circle([px, 0], pr), circle([px, 0], pr * 0.32)];
  },
});

const radioRetro = defineAsset({
  id: 'radio-retro',
  name: 'Retro radio',
  category: 'electronics',
  type: 'electronics',
  group: 'TV & audio',
  tags: ['radio', 'retro', 'vintage', 'transistor', 'music', 'wireless'],
  defaultSize: { w: 0.32, d: 0.14, h: 0.21 },
  minSize: { w: 0.22, d: 0.1, h: 0.15 },
  maxSize: { w: 0.45, d: 0.2, h: 0.3 },
  // Sits on a shelf or side table by default.
  defaultElevation: 0.75,
  wallSnap: true,
  slots: [
    matSlot('case', 'Case', 'wood-teak'),
    matSlot('grille', 'Speaker cloth', 'rattan-natural'),
    matSlot('trim', 'Trim & knobs', 'metal-brass'),
    matSlot('dial', 'Dial face', 'ceramic-white'),
  ],
  build: ({ w, d, h }) => {
    const handleH = 0.035;
    const top = h - handleH;
    const zf = d / 2 - 0.004;
    const parts: Part[] = [
      span('case', [-w / 2, w / 2], [0.01, top], [-d / 2, zf], { bevel: Math.min(0.025, (top - 0.01) * 0.3, d * 0.3) }),
    ];
    for (const x of [-w / 2 + 0.03, w / 2 - 0.03]) {
      for (const z of [-d / 2 + 0.025, d / 2 - 0.03]) parts.push(vcyl('trim', x, z, 0, 0.01, 0.008, { plan: false }));
    }
    // Speaker cloth with brass bars and frame.
    const gx: V2 = [-w / 2 + 0.025, w * 0.06];
    const gy: V2 = [0.035, top - 0.025];
    parts.push(span('grille', gx, gy, [zf - 0.002, zf + 0.002], { plan: false }));
    parts.push(...frame4('trim', gx, gy, [zf, zf + 0.004], 0.004));
    parts.push(...slats('trim', [gx[0] + 0.004, gx[1] - 0.004], gy, [zf + 0.001, zf + 0.003], clamp(Math.round((gx[1] - gx[0]) / 0.022), 3, 9), { axis: 'x', gap: 0.82, plan: false }));
    // Tuning dial with a needle.
    const dx = (w * 0.06 + w / 2) / 2;
    const dr = Math.max(0.015, Math.min(0.045, (w / 2 - w * 0.06) / 2 - 0.012, (top - 0.08) / 2));
    const dy = top - 0.03 - dr;
    parts.push(
      discZ('dial', [dx, dy, zf + 0.001], dr, 0.003, { segments: 28, plan: false }),
      torus('trim', [dx, dy, zf + 0.003], dr + 0.003, 0.003, { plan: false }),
      box('case', [dx, dy + dr * 0.35, zf + 0.004], [0.0018, dr * 0.75, 0.001], { rotation: [0, 0, -0.5], plan: false }),
    );
    // Volume and tuning knobs.
    for (const kx of [dx - Math.min(0.03, dr * 0.75), dx + Math.min(0.03, dr * 0.75)]) {
      parts.push(discZ('trim', [kx, 0.035, zf + 0.007], 0.014, 0.014, { rTop: 0.012, segments: 20, plan: false }));
    }
    // Carry handle.
    const hx = Math.min(w * 0.3, w / 2 - 0.03);
    const pts: V3[] = [
      [-hx, top - 0.004, 0],
      [-hx + 0.012, h - 0.012, 0],
      [-hx + 0.03, h - 0.006, 0],
      [hx - 0.03, h - 0.006, 0],
      [hx - 0.012, h - 0.012, 0],
      [hx, top - 0.004, 0],
    ];
    parts.push(...rodPath('trim', pts, 0.005));
    for (const x of [-hx, hx]) parts.push(span('trim', [x - 0.008, x + 0.008], [top - 0.004, top + 0.002], [-0.012, 0.012], { plan: false }));
    return parts;
  },
});

// ---------------------------------------------------------------------------
// Computers and gaming
// ---------------------------------------------------------------------------

/** Open laptop: lid length, hinge depth and keyboard depth so the tilted lid stays in the box. */
function laptopLayout(d: number, h: number) {
  const tau = 0.28;
  const bt = 0.016;
  const lt = 0.006;
  const L = Math.max(0.1, Math.min((h - bt - 0.004) / Math.cos(tau), (d - lt) / (1 + Math.sin(tau))));
  const zh = -d / 2 + L * Math.sin(tau) + lt * Math.cos(tau);
  const kd = Math.min(0.11, (d / 2 - zh) * 0.46);
  return { tau, bt, lt, L, zh, kd, kz0: zh + 0.025 };
}

const laptop = defineAsset({
  id: 'laptop',
  name: 'Laptop',
  category: 'electronics',
  type: 'electronics',
  group: 'Computers',
  tags: ['laptop', 'notebook', 'computer', 'macbook', 'portable', 'work'],
  defaultSize: { w: 0.34, d: 0.3, h: 0.23 },
  minSize: { w: 0.28, d: 0.24, h: 0.18 },
  maxSize: { w: 0.42, d: 0.36, h: 0.3 },
  // Sits on a desk top by default.
  defaultElevation: 0.75,
  slots: [
    matSlot('body', 'Aluminium', 'metal-brushed-steel'),
    matSlot('keys', 'Keys & trackpad', 'plastic-black'),
    matSlot('screen', 'Screen', 'screen-glow'),
  ],
  build: ({ w, d, h }) => {
    const { tau, bt, lt, L, zh, kd, kz0 } = laptopLayout(d, h);
    const c = Math.cos(tau);
    const s = Math.sin(tau);
    const P = (x: number, u: number, v: number): V3 => [x, bt + u * c + v * s, zh - u * s + v * c];
    const lid = (slot: string, x: number, u: number, v: number, size: V3, plan = false): Part =>
      box(slot, P(x, u, v), size, { rotation: [-tau, 0, 0], bevel: Math.min(0.003, size[2] * 0.4), plan });
    const parts: Part[] = [
      span('body', [-w / 2, w / 2], [0.003, bt], [zh, d / 2], { bevel: 0.004 }),
      rodX('body', -w * 0.32, w * 0.32, bt, zh + 0.002, 0.006, { plan: false }),
      lid('body', 0, L / 2, -lt / 2, [w, L, lt]),
      lid('screen', 0, L / 2 + 0.003, 0.0005, [w - 0.016, L - 0.03, 0.001]),
      lid('keys', 0, L - 0.007, 0.0006, [0.004, 0.004, 0.001]),
      lid('screen', 0, L / 2, -lt - 0.0005, [0.03, 0.035, 0.001]),
    ];
    for (const x of [-w / 2 + 0.03, w / 2 - 0.03]) {
      for (const z of [zh + 0.03, d / 2 - 0.03]) parts.push(vcyl('keys', x, z, 0, 0.003, 0.006, { plan: false }));
    }
    // Keyboard: four rows of keys plus a bottom row with a space bar, then the trackpad.
    const kw = w - 0.05;
    const rows = cellSpans(5, kz0, kz0 + kd);
    const cols = clamp(Math.round(kw / 0.019), 10, 16);
    const keyW = kw / cols;
    rows.forEach(([z0, z1], r) => {
      if (r === 4) {
        const sb = kw * 0.4;
        parts.push(span('keys', [-sb / 2, sb / 2], [bt, bt + 0.002], [z0 + 0.0015, z1 - 0.0015], { plan: false }));
        for (const side of [-1, 1]) {
          for (const i of range(3)) {
            const x0 = side * (sb / 2 + 0.002 + i * keyW);
            const x1 = x0 + side * (keyW - 0.003);
            parts.push(span('keys', [Math.min(x0, x1), Math.max(x0, x1)], [bt, bt + 0.002], [z0 + 0.0015, z1 - 0.0015], { plan: false }));
          }
        }
        return;
      }
      for (const [x0, x1] of cellSpans(cols, -kw / 2, kw / 2)) {
        parts.push(span('keys', [x0 + 0.0015, x1 - 0.0015], [bt, bt + 0.002], [z0 + 0.0015, z1 - 0.0015], { plan: false }));
      }
    });
    const tpw = Math.min(0.13, w * 0.38);
    const tpz0 = kz0 + kd + 0.012;
    const tpz1 = Math.min(d / 2 - 0.012, tpz0 + 0.08);
    parts.push(span('keys', [-tpw / 2, tpw / 2], [bt - 0.0005, bt + 0.0005], [tpz0, tpz1], { plan: false }));
    return parts;
  },
  planDetail: ({ w, d, h }) => {
    const { kz0, kd } = laptopLayout(d, h);
    return [rectPoly(-w / 2 + 0.025, kz0, w / 2 - 0.025, kz0 + kd)];
  },
});

// ---------------------------------------------------------------------------
// Home cinema
// ---------------------------------------------------------------------------

const projectionScreen = defineAsset({
  id: 'projection-screen',
  name: 'Projection screen',
  category: 'electronics',
  type: 'electronics',
  group: 'TV & audio',
  tags: ['projector screen', 'pull-down screen', 'home cinema', 'movie', 'roller screen'],
  defaultSize: { w: 2.0, d: 0.08, h: 1.5 },
  minSize: { w: 1.2, d: 0.06, h: 0.9 },
  maxSize: { w: 3.0, d: 0.12, h: 2.2 },
  mount: 'wall',
  defaultElevation: 0.8,
  slots: [
    matSlot('case', 'Case', 'metal-white-powder'),
    matSlot('screen', 'Screen', 'solid-white'),
    matSlot('border', 'Border', 'solid-black'),
  ],
  build: ({ w, d, h }) => {
    const cr = Math.min(0.045, d / 2 - 0.004);
    const cy = h - cr;
    const cz = -d / 2 + cr + 0.004;
    const sz = cz + cr * 0.6;
    const sb = 0.05;
    const top = cy - cr * 0.7;
    const sx = w / 2 - 0.06;
    const parts: Part[] = [
      rodX('case', -w / 2 + 0.03, w / 2 - 0.03, cy, cz, cr, { segments: 24 }),
      rodX('case', -w / 2, -w / 2 + 0.03, cy, cz, cr + 0.003, { segments: 24, plan: false }),
      rodX('case', w / 2 - 0.03, w / 2, cy, cz, cr + 0.003, { segments: 24, plan: false }),
      span('case', [-w / 2 + 0.03, w / 2 - 0.03], [cy - cr, cy - cr + 0.004], [cz, cz + cr * 0.9], { plan: false }),
      // Hanging screen: black drop at the top, black side borders, bottom weight bar and pull ring.
      span('screen', [-sx, sx], [sb, top], [sz - 0.001, sz + 0.001], { plan: false }),
      span('border', [-sx, sx], [top - Math.min(0.25, h * 0.12), top], [sz + 0.001, sz + 0.002], { plan: false }),
      span('border', [-sx, -sx + 0.03], [sb + 0.02, top], [sz + 0.001, sz + 0.002], { plan: false }),
      span('border', [sx - 0.03, sx], [sb + 0.02, top], [sz + 0.001, sz + 0.002], { plan: false }),
      span('border', [-sx, sx], [sb, sb + 0.04], [sz + 0.001, sz + 0.002], { plan: false }),
      span('case', [-sx - 0.006, sx + 0.006], [sb - 0.022, sb], [sz - 0.01, sz + 0.01], { bevel: 0.006, plan: false }),
      torus('case', [0, sb - 0.04, sz], 0.016, 0.003, { plan: false }),
    ];
    for (const x of [-w / 2 + 0.15, w / 2 - 0.15]) {
      parts.push(span('case', [x - 0.03, x + 0.03], [cy - 0.03, cy + 0.03], [-d / 2, -d / 2 + 0.006], { plan: false }));
    }
    return parts;
  },
});

// ---------------------------------------------------------------------------
// Smart home
// ---------------------------------------------------------------------------

const wifiRouter = defineAsset({
  id: 'wifi-router',
  name: 'Wi-Fi router',
  category: 'electronics',
  type: 'electronics',
  group: 'Smart home',
  tags: ['router', 'wifi', 'modem', 'internet', 'network', 'antenna'],
  defaultSize: { w: 0.25, d: 0.16, h: 0.19 },
  minSize: { w: 0.18, d: 0.12, h: 0.12 },
  maxSize: { w: 0.35, d: 0.22, h: 0.25 },
  // Sits on a shelf by default.
  defaultElevation: 0.75,
  wallSnap: true,
  slots: [matSlot('body', 'Body', 'plastic-black'), matSlot('trim', 'Vents & feet', 'metal-anthracite'), LED_SLOT],
  build: ({ w, d, h }) => {
    const bh = Math.min(0.04, h * 0.3);
    const zb = -d / 2 + 0.012;
    const parts: Part[] = [
      span('body', [-w / 2, w / 2], [0.006, bh], [zb, d / 2], { bevel: 0.008 }),
      ...slats('trim', [-w * 0.35, w * 0.35], [bh - 0.001, bh + 0.0008], [zb + 0.02, d / 2 - 0.03], clamp(Math.round(d / 0.02), 4, 10), { axis: 'z', gap: 0.5, plan: false }),
      span('trim', [-0.025, 0.025], [bh - 0.0005, bh + 0.001], [d / 2 - 0.022, d / 2 - 0.014], { plan: false }),
    ];
    for (const x of spaced(6, -w * 0.25, w * 0.25)) parts.push(sphere('led', [x, bh * 0.55, d / 2], 0.0025, { plan: false }));
    for (const x of [-w / 2 + 0.03, w / 2 - 0.03]) {
      for (const z of [zb + 0.02, d / 2 - 0.02]) parts.push(vcyl('trim', x, z, 0, 0.006, 0.008, { plan: false }));
    }
    // Hinged antennas splaying gently outwards.
    const n = w > 0.22 ? 4 : 3;
    const ha = h - bh - 0.016;
    spaced(n, -w / 2 + 0.03, w / 2 - 0.03).forEach((x, i) => {
      const splay = ((i - (n - 1) / 2) / ((n - 1) / 2)) * 0.12;
      parts.push(span('trim', [x - 0.009, x + 0.009], [bh - 0.004, bh + 0.012], [zb - 0.009, zb + 0.009], { bevel: 0.004, plan: false }));
      const yc = bh + 0.012 + (ha / 2) * Math.cos(splay);
      const xc = x - (ha / 2) * Math.sin(splay);
      parts.push(box('body', [xc, yc, zb], [0.016, ha, 0.006], { rotation: [0, 0, splay], bevel: 0.0025, plan: false }));
    });
    return parts;
  },
});

const smartSpeaker = defineAsset({
  id: 'smart-speaker',
  name: 'Smart speaker',
  category: 'electronics',
  type: 'electronics',
  group: 'Smart home',
  tags: ['smart speaker', 'voice assistant', 'speaker', 'alexa', 'home assistant', 'music'],
  defaultSize: { w: 0.13, d: 0.13, h: 0.17 },
  minSize: { w: 0.09, d: 0.09, h: 0.1 },
  maxSize: { w: 0.2, d: 0.2, h: 0.25 },
  // Sits on a shelf by default.
  defaultElevation: 0.75,
  slots: [matSlot('fabric', 'Fabric', 'fabric-wool-grey'), matSlot('body', 'Top & base', 'plastic-white'), LED_SLOT],
  build: ({ w, d, h }) => {
    const R = Math.min(w, d) / 2;
    const parts: Part[] = [
      cyl('body', [0, 0.004, 0], R * 0.9, 0.008, { segments: 32, plan: false }),
      vcyl('fabric', 0, 0, 0.008, h - 0.012, R, { segments: 36 }),
      vcyl('body', 0, 0, h - 0.012, h - 0.002, R * 0.985, { segments: 36, plan: false }),
      ring('led', [0, h - 0.002, 0], R * 0.78, 0.0025, { plan: false }),
      cyl('led', [0, h - 0.0015, 0], R * 0.12, 0.001, { segments: 16, plan: false }),
    ];
    for (const y of spaced(3, h * 0.25, h * 0.75)) parts.push(ring('fabric', [0, y, 0], R, 0.0012, { plan: false }));
    for (const k of range(4)) {
      const a = (k * Math.PI) / 2 + Math.PI / 4;
      parts.push(vcyl('body', Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.5, h - 0.003, h, 0.006, { plan: false }));
    }
    return parts;
  },
  planDetail: ({ w, d }) => [circle([0, 0], Math.min(w, d) / 2 * 0.78)],
});

const robotVacuum = defineAsset({
  id: 'robot-vacuum',
  name: 'Robot vacuum',
  category: 'laundry',
  type: 'appliances',
  group: 'Cleaning',
  tags: ['robot vacuum', 'roomba', 'vacuum cleaner', 'cleaning', 'smart home'],
  defaultSize: { w: 0.35, d: 0.35, h: 0.095 },
  minSize: { w: 0.3, d: 0.3, h: 0.08 },
  maxSize: { w: 0.4, d: 0.4, h: 0.12 },
  slots: [
    matSlot('body', 'Body', 'plastic-white'),
    matSlot('trim', 'Bumper & brushes', 'plastic-black'),
    matSlot('accent', 'Lid trim', 'metal-brushed-steel'),
    LED_SLOT,
  ],
  build: ({ w, d, h }) => {
    const R = Math.min(w, d) / 2;
    const yl = h * 0.72;
    const parts: Part[] = [
      vcyl('body', 0, 0, 0.012, yl, R - 0.004, { segments: 40 }),
      vcyl('trim', 0, 0, 0.006, 0.014, R * 0.9, { segments: 32, plan: false }),
      vcyl('trim', 0, 0, yl, yl + 0.006, R * 0.97, { segments: 40, plan: false }),
      vcyl('accent', 0, 0, yl + 0.006, yl + 0.01, R * 0.93, { segments: 40, plan: false }),
      torus('trim', [0, h * 0.38, 0], R - 0.012, 0.012, { rotation: [Math.PI / 2, 0, 0], arc: Math.PI, plan: false }),
      // LiDAR turret.
      vcyl('trim', 0, -R * 0.3, yl + 0.01, h - 0.007, R * 0.24, { segments: 28, plan: false }),
      vcyl('accent', 0, -R * 0.3, h - 0.007, h, R * 0.25, { segments: 28, plan: false }),
      // Buttons with a glowing ring, front camera window.
      span('trim', [-0.03, 0.03], [yl + 0.01, yl + 0.013], [R * 0.35, R * 0.35 + 0.022], { bevel: 0.0012, plan: false }),
      vcyl('led', -0.012, R * 0.35 + 0.011, yl + 0.012, yl + 0.015, 0.006, { plan: false }),
      span('trim', [-0.03, 0.03], [h * 0.3, h * 0.48], [R - 0.004, R + 0.002], { plan: false }),
    ];
    // Side brushes peeking out at the front corners.
    for (const side of [-1, 1]) {
      const bx = side * R * 0.62;
      const bz = R * 0.55;
      parts.push(vcyl('trim', bx, bz, 0.004, 0.01, 0.01, { plan: false }));
      for (const k of range(3)) {
        const a = (k * 2 * Math.PI) / 3 + side * 0.4;
        parts.push(rod('trim', [bx, 0.004, bz], [bx + Math.cos(a) * 0.05, 0.002, bz + Math.sin(a) * 0.05], 0.0016, { plan: false }));
      }
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const R = Math.min(w, d) / 2;
    return [circle([0, -R * 0.3], R * 0.25), line([-R * 0.95, 0], [R * 0.95, 0])];
  },
});

// ---------------------------------------------------------------------------
// Climate
// ---------------------------------------------------------------------------

const airCon = defineAsset({
  id: 'air-conditioner',
  name: 'Wall air-conditioning unit',
  category: 'electronics',
  type: 'electronics',
  group: 'Air conditioning',
  tags: ['air conditioning', 'ac', 'split unit', 'hvac', 'climate'],
  defaultSize: { w: 0.85, d: 0.22, h: 0.3 },
  minSize: { w: 0.6, d: 0.15, h: 0.22 },
  maxSize: { w: 1.3, d: 0.3, h: 0.4 },
  mount: 'wall',
  defaultElevation: 2.1,
  slots: [
    matSlot('body', 'Body', 'laminate-white-gloss'),
    matSlot('vent', 'Vents & display', 'metal-anthracite'),
    LED_SLOT,
  ],
  build: ({ w, d, h }) => {
    const zf = d / 2 - 0.003;
    const parts: Part[] = [
      span('body', [-w / 2, w / 2], [0.05, h], [-d / 2, zf], { bevel: 0.02 }),
      span('body', [-w / 2, w / 2], [0, 0.05], [-d / 2, d / 2 - 0.12], { bevel: 0.01 }),
      span('body', [-w / 2 + 0.008, w / 2 - 0.008], [0.065, h - 0.012], [zf - 0.001, d / 2], { bevel: 0.003, plan: false }),
      span('vent', [-w / 2 + 0.008, w / 2 - 0.008], [0.062, 0.065], [zf - 0.002, d / 2], { plan: false }),
      // Outlet with vertical vanes and the swing flap hanging open.
      span('vent', [-w / 2 + 0.05, w / 2 - 0.05], [0.02, 0.05], [d / 2 - 0.12, d / 2 - 0.03], { plan: false }),
      ...slats('body', [-w / 2 + 0.06, w / 2 - 0.06], [0.022, 0.048], [d / 2 - 0.11, d / 2 - 0.05], clamp(Math.round(w / 0.06), 8, 20), { axis: 'x', gap: 0.75, plan: false }),
      span('body', [-w / 2 + 0.05, w / 2 - 0.05], [0, 0.02], [d / 2 - 0.12, d / 2 - 0.02], { plan: false }),
      box('body', [0, 0.026, d / 2 - 0.035], [w - 0.11, 0.004, 0.06], { rotation: [0.45, 0, 0], plan: false }),
      // Intake grille bars across the top.
      ...slats('vent', [-w / 2 + 0.04, w / 2 - 0.04], [h - 0.003, h + 0.001], [-d / 2 + 0.03, d / 2 - 0.05], clamp(Math.round((d - 0.08) / 0.014), 4, 14), { axis: 'z', gap: 0.5, plan: false }),
      // Display window with two glowing digits and status dots.
      span('vent', [w / 2 - 0.13, w / 2 - 0.05], [h * 0.5, h * 0.66], [d / 2, d / 2 + 0.002], { bevel: 0.002, plan: false }),
      span('led', [w / 2 - 0.115, w / 2 - 0.096], [h * 0.53, h * 0.63], [d / 2 + 0.002, d / 2 + 0.003], { plan: false }),
      span('led', [w / 2 - 0.09, w / 2 - 0.071], [h * 0.53, h * 0.63], [d / 2 + 0.002, d / 2 + 0.003], { plan: false }),
    ];
    for (const i of range(3)) parts.push(sphere('led', [w / 2 - 0.12 + i * 0.018, h * 0.44, d / 2 + 0.001], 0.002, { plan: false }));
    return parts;
  },
  planDetail: ({ w, d }) =>
    spaced(5, -d / 2 + 0.04, d / 2 - 0.06).map((z) => line([-w / 2 + 0.05, z], [w / 2 - 0.05, z])),
});

const oilHeater = defineAsset({
  id: 'oil-heater',
  name: 'Oil-filled radiator heater',
  category: 'electronics',
  type: 'electronics',
  group: 'Climate',
  tags: ['heater', 'radiator', 'oil heater', 'portable heater', 'warmth', 'winter'],
  defaultSize: { w: 0.5, d: 0.26, h: 0.64 },
  minSize: { w: 0.35, d: 0.2, h: 0.5 },
  maxSize: { w: 0.8, d: 0.32, h: 0.75 },
  slots: [
    matSlot('body', 'Fins', 'metal-white-powder'),
    matSlot('trim', 'Feet & controls', 'plastic-black'),
    matSlot('led', 'Indicator', 'plastic-red'),
  ],
  build: ({ w, d, h }) => {
    const dz = Math.min(d / 2 - 0.02, 0.1);
    const fy0 = 0.1;
    const fx0 = -w / 2 + 0.02;
    const fx1 = w / 2 - 0.1;
    const n = clamp(Math.round((fx1 - fx0) / 0.05), 4, 13);
    const parts: Part[] = [];
    for (const [a, b] of cellSpans(n, fx0, fx1)) {
      const cx = (a + b) / 2;
      const ft = Math.min(0.018, (b - a) * 0.6);
      parts.push(span('body', [cx - ft / 2, cx + ft / 2], [fy0, h - 0.02], [-dz, dz], { bevel: 0.008 }));
      parts.push(span('body', [cx - ft * 0.35, cx + ft * 0.35], [h - 0.03, h], [-dz * 0.45, dz * 0.45], { bevel: 0.005, plan: false }));
      parts.push(span('body', [cx - ft * 0.35, cx + ft * 0.35], [fy0 - 0.02, fy0 + 0.01], [-dz * 0.45, dz * 0.45], { bevel: 0.005, plan: false }));
    }
    parts.push(rodX('body', fx0, fx1 + 0.01, fy0 + 0.02, 0, 0.012, { plan: false }));
    parts.push(rodX('body', fx0, fx1 + 0.01, h - 0.06, 0, 0.012, { plan: false }));
    // Control box at the right end: two dials and an indicator light on top.
    const cx0 = fx1 + 0.005;
    const cx1 = w / 2 - 0.01;
    const ct = h - 0.09;
    parts.push(span('body', [cx0, cx1], [fy0 + 0.02, ct], [-dz * 0.7, dz * 0.7], { bevel: 0.012 }));
    parts.push(span('trim', [cx0 + 0.005, cx1 - 0.005], [ct - 0.002, ct + 0.001], [-dz * 0.6, dz * 0.6], { plan: false }));
    for (const z of [-dz * 0.3, dz * 0.25]) parts.push(vcyl('trim', (cx0 + cx1) / 2, z, ct, ct + 0.02, 0.016, { segments: 16, plan: false }));
    parts.push(sphere('led', [(cx0 + cx1) / 2, ct + 0.002, dz * 0.55], 0.005, { plan: false }));
    // Castor feet across the end fins.
    for (const x of [fx0 + 0.04, fx1 - 0.04]) {
      parts.push(span('trim', [x - 0.018, x + 0.018], [0.04, 0.06], [-d / 2 + 0.012, d / 2 - 0.012], { bevel: 0.008, plan: false }));
      parts.push(vcyl('trim', x, 0, 0.06, fy0 - 0.02, 0.008, { plan: false }));
      for (const z of [-d / 2 + 0.03, d / 2 - 0.03]) parts.push(sphere('trim', [x, 0.02, z], 0.02, { plan: false }));
    }
    // Power cable dropping from the control box.
    parts.push(
      ...rodPath(
        'trim',
        [
          [cx1 - 0.02, fy0 + 0.03, -dz * 0.5],
          [cx1 - 0.015, 0.04, -d / 2 + 0.02],
          [cx1 - 0.06, 0.004, -d / 2 + 0.01],
        ],
        0.004,
      ),
    );
    return parts;
  },
});

const airPurifier = defineAsset({
  id: 'air-purifier',
  name: 'Air purifier',
  category: 'electronics',
  type: 'electronics',
  group: 'Climate',
  tags: ['air purifier', 'air cleaner', 'hepa', 'filter', 'allergy', 'smart home'],
  defaultSize: { w: 0.3, d: 0.3, h: 0.6 },
  minSize: { w: 0.22, d: 0.22, h: 0.4 },
  maxSize: { w: 0.4, d: 0.4, h: 0.8 },
  slots: [
    matSlot('body', 'Body', 'plastic-white'),
    matSlot('grille', 'Filter mesh', 'felt-grey'),
    matSlot('trim', 'Grooves & outlet', 'plastic-black'),
    LED_SLOT,
  ],
  build: ({ w, d, h }) => {
    const R = Math.min(w, d) / 2;
    const yg = h * 0.62;
    const parts: Part[] = [
      vcyl('trim', 0, 0, 0, 0.02, R * 0.94, { segments: 36, plan: false }),
      vcyl('grille', 0, 0, 0.02, yg, R, { segments: 40 }),
      ring('led', [0, yg + 0.003, 0], R * 0.985, 0.003, { plan: false }),
      vcyl('body', 0, 0, yg + 0.006, h - 0.03, R * 0.98, { segments: 40, plan: false }),
      vcyl('trim', 0, 0, h - 0.03, h - 0.012, R * 0.9, { segments: 36, plan: false }),
      vcyl('body', 0, 0, h - 0.012, h, R * 0.26, { segments: 24, plan: false }),
      cyl('led', [0, h - 0.0005, 0], R * 0.16, 0.001, { segments: 20, plan: false }),
      // Carry recess at the back of the upper body.
      span('trim', [-R * 0.3, R * 0.3], [h - 0.09, h - 0.06], [-R * 0.98 - 0.002, -R * 0.9], { plan: false }),
    ];
    for (const y of spaced(6, 0.06, yg - 0.04)) parts.push(ring('trim', [0, y, 0], R, 0.0018, { plan: false }));
    for (const k of range(12)) {
      const a = (k * Math.PI * 2) / 12;
      const r0 = R * 0.3;
      const r1 = R * 0.85;
      parts.push(
        box('body', [Math.cos(a) * (r0 + r1) / 2, h - 0.007, Math.sin(a) * (r0 + r1) / 2], [r1 - r0, 0.01, 0.006], {
          rotation: [0, -a, 0],
          plan: false,
        }),
      );
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const R = Math.min(w, d) / 2;
    return [circle([0, 0], R * 0.9), circle([0, 0], R * 0.26)];
  },
});

export const ELECTRONICS_ASSETS: AssetDefinition[] = [
  tvStand,
  tvWall,
  speaker,
  soundbar,
  turntable,
  radioRetro,
  laptop,
  projectionScreen,
  wifiRouter,
  smartSpeaker,
  robotVacuum,
  airCon,
  oilHeater,
  airPurifier,
];

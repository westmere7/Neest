import type { AssetDefinition, Part } from './types';
import {
  bookRow,
  box,
  circle,
  clamp,
  cyl,
  defineAsset,
  discZ,
  frame4,
  matSlot,
  range,
  rectPoly,
  ring,
  rod,
  rodPath,
  rodX,
  rodZ,
  slats,
  span,
  sphere,
  torus,
  turnedLeg,
  vcyl,
  type V2,
  type V3,
} from './parts';

// ---------------------------------------------------------------------------
// TV, monitor and audio
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Climate
// ---------------------------------------------------------------------------

export const ELECTRONICS_ASSETS: AssetDefinition[] = [
  speaker,
  turntable,
  radioRetro,
  projectionScreen,
];

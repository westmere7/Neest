import type { AssetDefinition, Part } from './types';
import {
  box,
  clamp,
  cyl,
  defineAsset,
  discZ,
  line,
  matSlot,
  range,
  rod,
  span,
  spaced,
  sphere,
  torus,
  vcyl,
} from './parts';

const SCREEN_SLOT = matSlot('screen', 'Screen', 'screen-black');

const tvStand = defineAsset({
  id: 'tv-stand',
  name: 'TV on stand',
  category: 'electronics',
  tags: ['tv', 'television', 'screen', 'display', 'pedestal'],
  defaultSize: { w: 1.25, d: 0.25, h: 0.8 },
  minSize: { w: 0.6, d: 0.18, h: 0.4 },
  maxSize: { w: 2.2, d: 0.4, h: 1.4 },
  slots: [SCREEN_SLOT, matSlot('body', 'Bezel & stand', 'metal-black-matte')],
  build: ({ w, d, h }) => {
    const screenH = Math.min(w * 0.5625, h - 0.07);
    const y0 = h - screenH;
    const baseW = Math.min(w * 0.25, 0.3);
    return [
      span('body', [-w / 2, w / 2], [y0, h], [-0.025, 0.02]),
      span('screen', [-w / 2 + 0.008, w / 2 - 0.008], [y0 + 0.008, h - 0.008], [0.02, 0.023], {
        plan: false,
      }),
      span('body', [-w * 0.3, w * 0.3], [y0 + 0.05, h - screenH * 0.4], [-0.06, -0.025], { plan: false }),
      span('body', [-0.03, 0.03], [0.015, y0 + 0.05], [-0.045, -0.015], { plan: false }),
      span('body', [-baseW, baseW], [0, 0.015], [-d / 2 + 0.01, d / 2 - 0.01], { bevel: 0.005 }),
    ];
  },
});

const tvWall = defineAsset({
  id: 'tv-wall',
  name: 'Wall-mounted TV',
  category: 'electronics',
  tags: ['tv', 'television', 'screen', 'wall mounted', 'flat screen'],
  defaultSize: { w: 1.45, d: 0.06, h: 0.83 },
  minSize: { w: 0.6, d: 0.03, h: 0.34 },
  maxSize: { w: 2.5, d: 0.12, h: 1.45 },
  mount: 'wall',
  defaultElevation: 0.95,
  slots: [SCREEN_SLOT, matSlot('body', 'Bezel', 'metal-black-matte')],
  build: ({ w, d, h }) => {
    const br = Math.min(0.025, d * 0.4);
    return [
      span('body', [-w / 2, w / 2], [0, h], [-d / 2 + br, d / 2 - 0.003]),
      span('body', [-w * 0.2, w * 0.2], [h * 0.3, h * 0.7], [-d / 2, -d / 2 + br], { plan: false }),
      span('screen', [-w / 2 + 0.006, w / 2 - 0.006], [0.006, h - 0.006], [d / 2 - 0.003, d / 2]),
    ];
  },
});

const monitor = defineAsset({
  id: 'monitor',
  name: 'Computer monitor',
  category: 'electronics',
  tags: ['monitor', 'screen', 'display', 'computer', 'desktop'],
  defaultSize: { w: 0.62, d: 0.22, h: 0.48 },
  minSize: { w: 0.35, d: 0.15, h: 0.3 },
  maxSize: { w: 1.2, d: 0.35, h: 0.7 },
  // Sits on a desk top by default.
  defaultElevation: 0.75,
  slots: [SCREEN_SLOT, matSlot('body', 'Housing & stand', 'metal-anthracite')],
  build: ({ w, d, h }) => {
    const screenH = Math.min(w * 0.55, h - 0.1);
    const y0 = h - screenH;
    const zp = Math.min(0.02, d / 2 - 0.03);
    const baseW = Math.min(w * 0.2, 0.13);
    return [
      span('body', [-w / 2, w / 2], [y0, h], [zp - 0.012, zp + 0.008]),
      span('screen', [-w / 2 + 0.006, w / 2 - 0.006], [y0 + 0.006, h - 0.006], [zp + 0.008, zp + 0.011], {
        plan: false,
      }),
      span(
        'body',
        [-w * 0.18, w * 0.18],
        [y0 + screenH * 0.2, y0 + screenH * 0.7],
        [zp - 0.035, zp - 0.012],
        { plan: false },
      ),
      span('body', [-0.025, 0.025], [0.012, y0 + screenH * 0.45], [zp - 0.06, zp - 0.035], { plan: false }),
      span('body', [-baseW, baseW], [0, 0.012], [-d / 2, d / 2 - 0.02], { bevel: 0.004 }),
    ];
  },
});

const speaker = defineAsset({
  id: 'speaker-floor',
  name: 'Floor-standing speaker',
  category: 'electronics',
  tags: ['speaker', 'hifi', 'audio', 'tower', 'loudspeaker'],
  defaultSize: { w: 0.22, d: 0.3, h: 1.0 },
  minSize: { w: 0.12, d: 0.15, h: 0.2 },
  maxSize: { w: 0.5, d: 0.6, h: 1.4 },
  slots: [
    matSlot('cabinet', 'Cabinet', 'wood-walnut'),
    matSlot('driver', 'Drivers & plinth', 'metal-black-matte'),
  ],
  build: ({ w, d, h }) => {
    const plinth = Math.min(0.03, h * 0.1);
    const zf = d / 2 - 0.012;
    const rt = Math.min(w * 0.15, 0.025);
    const yt = h - Math.max(0.06, rt + 0.04);
    const top = yt - rt - 0.03;
    const rw = Math.max(0.01, Math.min(w * 0.38, 0.09, (top - plinth) / 2 - 0.005));
    const n = clamp(Math.floor((top - plinth) / (2 * rw + 0.04)), 1, 3);
    const parts: Part[] = [
      span('cabinet', [-w / 2, w / 2], [plinth, h], [-d / 2, zf], { bevel: 0.008 }),
      span('driver', [-w / 2, w / 2], [0, plinth], [-d / 2, d / 2]),
      discZ('driver', [0, yt, zf + 0.004], rt, 0.008, { plan: false }),
    ];
    for (const i of range(n)) {
      const y = top - rw - i * (2 * rw + 0.04);
      parts.push(discZ('driver', [0, y, zf + 0.004], rw, 0.008, { rTop: rw * 0.85, plan: false }));
      parts.push(sphere('driver', [0, y, zf + 0.004], rw * 0.3, { scale: [1, 1, 0.25], plan: false }));
    }
    return parts;
  },
});

const airCon = defineAsset({
  id: 'air-conditioner',
  name: 'Wall air-conditioning unit',
  category: 'electronics',
  tags: ['air conditioning', 'ac', 'split unit', 'hvac', 'climate'],
  defaultSize: { w: 0.85, d: 0.22, h: 0.3 },
  minSize: { w: 0.6, d: 0.15, h: 0.22 },
  maxSize: { w: 1.3, d: 0.3, h: 0.4 },
  mount: 'wall',
  defaultElevation: 2.1,
  slots: [
    matSlot('body', 'Body', 'laminate-white-gloss'),
    matSlot('vent', 'Vent & display', 'metal-anthracite'),
  ],
  build: ({ w, d, h }) => [
    span('body', [-w / 2, w / 2], [0.05, h], [-d / 2, d / 2 - 0.003], { bevel: 0.02 }),
    span('body', [-w / 2, w / 2], [0, 0.05], [-d / 2, d / 2 - 0.12], { bevel: 0.01 }),
    span('vent', [-w / 2 + 0.05, w / 2 - 0.05], [0.02, 0.05], [d / 2 - 0.12, d / 2 - 0.03], { plan: false }),
    span('body', [-w / 2 + 0.05, w / 2 - 0.05], [0, 0.02], [d / 2 - 0.12, d / 2 - 0.02], { plan: false }),
    span('vent', [w / 2 - 0.12, w / 2 - 0.05], [h * 0.55, h * 0.62], [d / 2 - 0.004, d / 2], { plan: false }),
  ],
  planDetail: ({ w, d }) =>
    spaced(5, -d / 2 + 0.04, d / 2 - 0.06).map((z) => line([-w / 2 + 0.05, z], [w / 2 - 0.05, z])),
});

const floorFan = defineAsset({
  id: 'floor-fan',
  name: 'Pedestal fan',
  category: 'electronics',
  tags: ['fan', 'pedestal fan', 'cooling', 'standing fan'],
  defaultSize: { w: 0.45, d: 0.38, h: 1.25 },
  minSize: { w: 0.3, d: 0.25, h: 0.6 },
  maxSize: { w: 0.7, d: 0.6, h: 1.6 },
  slots: [
    matSlot('body', 'Body', 'metal-white-powder'),
    matSlot('blades', 'Blades', 'glass-frosted'),
    matSlot('guard', 'Guard', 'metal-chrome'),
  ],
  build: ({ w, d, h }) => {
    const tube = 0.006;
    const R = Math.min(w / 2 - tube, h * 0.22);
    const yh = h - R - tube;
    const zh = d / 2 - 0.07;
    const mz1 = zh - 0.06;
    const mz0 = Math.max(-d / 2 + 0.005, mz1 - 0.14);
    const zp = clamp(0, mz0 + 0.02, mz1 - 0.02);
    const baseR = Math.min(w / 2, d / 2 - Math.abs(zp)) * 0.85;
    const parts: Part[] = [
      cyl('body', [0, 0.02, zp], baseR, 0.04, { segments: 32 }),
      vcyl('body', 0, zp, 0.04, yh - 0.04, 0.016, { plan: false }),
      discZ('body', [0, yh, (mz0 + mz1) / 2], 0.065, mz1 - mz0, { segments: 24 }),
      torus('guard', [0, yh, zh + 0.05], R, tube),
      torus('guard', [0, yh, zh - 0.05], R, tube),
      discZ('guard', [0, yh, zh + 0.055], 0.04, 0.01, { plan: false }),
      discZ('body', [0, yh, zh], 0.035, 0.04, { plan: false }),
    ];
    for (const k of range(4)) {
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      parts.push(
        rod('guard', [0, yh, zh + 0.055], [R * Math.cos(a), yh + R * Math.sin(a), zh + 0.05], 0.002, {
          plan: false,
        }),
      );
    }
    for (const k of range(3)) {
      const a = Math.PI / 2 + (k * 2 * Math.PI) / 3;
      parts.push(
        box(
          'blades',
          [Math.cos(a) * R * 0.45, yh + Math.sin(a) * R * 0.45, zh],
          [R * 0.75, R * 0.32, 0.006],
          {
            rotation: [0, 0, a],
            plan: false,
          },
        ),
      );
    }
    return parts;
  },
});

const soundbar = defineAsset({
  id: 'soundbar',
  name: 'Soundbar',
  category: 'electronics',
  tags: ['soundbar', 'speaker', 'audio', 'tv sound'],
  defaultSize: { w: 0.9, d: 0.1, h: 0.07 },
  minSize: { w: 0.4, d: 0.06, h: 0.04 },
  maxSize: { w: 1.6, d: 0.16, h: 0.15 },
  // Sits on a media console by default.
  defaultElevation: 0.5,
  wallSnap: true,
  slots: [matSlot('body', 'Body', 'metal-black-matte'), matSlot('grille', 'Grille', 'fabric-wool-grey')],
  build: ({ w, d, h }) => [
    span('body', [-w / 2, w / 2], [0, h], [-d / 2, d / 2 - 0.004], { bevel: 0.015 }),
    span('grille', [-w / 2 + 0.02, w / 2 - 0.02], [0.008, h - 0.008], [d / 2 - 0.006, d / 2], {
      plan: false,
    }),
  ],
});

export const ELECTRONICS_ASSETS: AssetDefinition[] = [
  tvStand,
  tvWall,
  monitor,
  speaker,
  airCon,
  floorFan,
  soundbar,
];

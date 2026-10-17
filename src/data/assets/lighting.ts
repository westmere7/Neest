import type { AssetDefinition } from './types';
import {
  circle,
  cyl,
  defineAsset,
  ellipsePoints,
  lathe,
  matSlot,
  poly,
  span,
  sphere,
  vcyl,
  type V3,
} from './parts';

/** Ceiling height the ceiling-mounted fittings are dimensioned for. */
const CEILING = 2.7;
const LIGHT_SLOT = matSlot('light', 'Light diffuser', 'light-warm');
const WARM = '#ffd9a8';

const ceilingLight = defineAsset({
  id: 'ceiling-light',
  name: 'Flush ceiling light',
  category: 'lighting',
  tags: ['ceiling light', 'flush mount', 'dome', 'lamp', 'light'],
  defaultSize: { w: 0.4, d: 0.4, h: 0.1 },
  minSize: { w: 0.2, d: 0.2, h: 0.05 },
  maxSize: { w: 1.0, d: 1.0, h: 0.25 },
  mount: 'ceiling',
  defaultElevation: CEILING - 0.1 - 0.01,
  slots: [LIGHT_SLOT, matSlot('metal', 'Canopy', 'metal-white-powder')],
  light: { color: WARM, intensity: 1.2, distance: 6, y: 0.02 },
  build: ({ w, d, h }) => {
    const R = w / 2;
    const scale: V3 = [1, 1, d / w];
    const dh = h - 0.02;
    return [
      cyl('metal', [0, h - 0.01, 0], R * 0.45, 0.02, { scale, segments: 32 }),
      lathe(
        'light',
        [0, 0, 0],
        [
          [0, 0],
          [R * 0.5, dh * 0.12],
          [R * 0.85, dh * 0.45],
          [R, dh * 0.85],
          [R * 0.96, dh],
        ],
        { scale, segments: 40 },
      ),
    ];
  },
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
  tags: ['pendant', 'hanging lamp', 'ceiling', 'dome', 'light'],
  defaultSize: { w: 0.4, d: 0.4, h: 0.9 },
  minSize: { w: 0.15, d: 0.15, h: 0.3 },
  maxSize: { w: 0.9, d: 0.9, h: 1.8 },
  mount: 'ceiling',
  defaultElevation: CEILING - 0.9 - 0.01,
  slots: [matSlot('shade', 'Shade, cord & canopy', 'metal-black-matte'), LIGHT_SLOT],
  light: { color: WARM, intensity: 1.4, distance: 5, y: 0.07 },
  build: ({ w, d, h }) => {
    const S = pendantShade(w, h);
    const scale: V3 = [1, 1, d / w];
    return [
      cyl('shade', [0, h - 0.0125, 0], Math.min(0.05, S.R), 0.025, { segments: 24, plan: false }),
      vcyl('shade', 0, 0, S.shadeH - 0.01, h - 0.025, 0.004, { plan: false }),
      lathe(
        'shade',
        [0, 0, 0],
        [
          [S.R, 0],
          [S.R * 0.97, S.shadeH * 0.15],
          [S.R * 0.8, S.shadeH * 0.55],
          [S.R * 0.45, S.shadeH * 0.88],
          [0.025, S.shadeH],
          [0, S.shadeH],
        ],
        { scale, segments: 40 },
      ),
      sphere('light', [0, S.bulbY, 0], S.bulbR, { plan: false }),
    ];
  },
});

const pendantLinear = defineAsset({
  id: 'pendant-linear',
  name: 'Linear pendant',
  category: 'lighting',
  tags: ['linear', 'pendant', 'bar light', 'dining light', 'suspended'],
  defaultSize: { w: 1.2, d: 0.08, h: 0.8 },
  minSize: { w: 0.5, d: 0.05, h: 0.3 },
  maxSize: { w: 2.4, d: 0.2, h: 1.5 },
  mount: 'ceiling',
  defaultElevation: CEILING - 0.8 - 0.01,
  slots: [matSlot('body', 'Body & wires', 'metal-black-matte'), LIGHT_SLOT],
  light: { color: WARM, intensity: 1.6, distance: 4, y: 0 },
  build: ({ w, d, h }) => {
    const cx = w * 0.3;
    return [
      span('body', [-w / 2, w / 2], [0.008, 0.06], [-d / 2, d / 2], { bevel: 0.004 }),
      span('light', [-w / 2 + 0.02, w / 2 - 0.02], [0, 0.008], [-d / 2 + 0.008, d / 2 - 0.008], {
        plan: false,
      }),
      span('body', [-cx, cx], [h - 0.02, h], [-Math.min(d / 2, 0.04), Math.min(d / 2, 0.04)], {
        plan: false,
      }),
      vcyl('body', -cx + 0.02, 0, 0.06, h - 0.02, 0.002, { plan: false }),
      vcyl('body', cx - 0.02, 0, 0.06, h - 0.02, 0.002, { plan: false }),
    ];
  },
});

const floorLamp = defineAsset({
  id: 'floor-lamp',
  name: 'Floor lamp',
  category: 'lighting',
  tags: ['floor lamp', 'standard lamp', 'lamp', 'reading', 'light'],
  defaultSize: { w: 0.42, d: 0.42, h: 1.6 },
  minSize: { w: 0.25, d: 0.25, h: 1.1 },
  maxSize: { w: 0.7, d: 0.7, h: 2.0 },
  slots: [LIGHT_SLOT, matSlot('base', 'Base & stem', 'metal-black-matte')],
  light: { color: WARM, intensity: 1.2, distance: 4.5, y: 1.4 },
  build: ({ w, d, h }) => {
    const shadeH = Math.min(0.38, Math.max(0.22, h * 0.2));
    const scale: V3 = [1, 1, d / w];
    return [
      cyl('base', [0, 0.0125, 0], (w / 2) * 0.65, 0.025, { scale, segments: 32 }),
      vcyl('base', 0, 0, 0.025, h - shadeH * 0.4, 0.012, { plan: false }),
      lathe(
        'light',
        [0, h - shadeH, 0],
        [
          [w / 2, 0],
          [(w / 2) * 0.8, shadeH],
        ],
        { scale, segments: 40 },
      ),
    ];
  },
  planDetail: ({ w, d }) => [circle([0, 0], 0.02), poly(ellipsePoints(0, 0, (w / 2) * 0.8, (d / 2) * 0.8))],
});

const tableLamp = defineAsset({
  id: 'table-lamp',
  name: 'Table lamp',
  category: 'lighting',
  tags: ['table lamp', 'bedside lamp', 'lamp', 'light', 'ginger jar'],
  defaultSize: { w: 0.32, d: 0.32, h: 0.52 },
  minSize: { w: 0.18, d: 0.18, h: 0.3 },
  maxSize: { w: 0.6, d: 0.6, h: 0.9 },
  // Sits on a bedside/side table by default.
  defaultElevation: 0.5,
  slots: [LIGHT_SLOT, matSlot('base', 'Base', 'ceramic-white')],
  light: { color: WARM, intensity: 0.8, distance: 3, y: 0.41 },
  build: ({ w, d, h }) => {
    const rb = (Math.min(w, d) / 2) * 0.55;
    const bodyH = h * 0.5;
    const shadeH = h * 0.42;
    const scale: V3 = [1, 1, d / w];
    return [
      lathe(
        'base',
        [0, 0, 0],
        [
          [0, 0],
          [rb * 0.6, 0],
          [rb * 0.95, bodyH * 0.25],
          [rb, bodyH * 0.5],
          [rb * 0.8, bodyH * 0.85],
          [rb * 0.35, bodyH],
          [0, bodyH],
        ],
        { segments: 32 },
      ),
      vcyl('base', 0, 0, bodyH, h - shadeH + 0.03, 0.01, { plan: false }),
      lathe(
        'light',
        [0, h - shadeH, 0],
        [
          [w / 2, 0],
          [(w / 2) * 0.72, shadeH],
        ],
        { scale, segments: 40 },
      ),
    ];
  },
});

const sconce = defineAsset({
  id: 'wall-sconce',
  name: 'Wall sconce',
  category: 'lighting',
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
    const pw = Math.min(w / 2, 0.04);
    return [
      span('metal', [-pw, pw], [h * 0.25, h * 0.65], [-d / 2, -d / 2 + 0.015]),
      span('metal', [-0.008, 0.008], [h * 0.5 - 0.0075, h * 0.5 + 0.0075], [-d / 2 + 0.015, zc], {
        plan: false,
      }),
      lathe(
        'light',
        [0, h - sh, zc],
        [
          [0, 0],
          [R * 0.45, 0],
          [R, sh],
        ],
        { segments: 32 },
      ),
    ];
  },
});

export const LIGHTING_ASSETS: AssetDefinition[] = [
  ceilingLight,
  pendant,
  pendantLinear,
  floorLamp,
  tableLamp,
  sconce,
];

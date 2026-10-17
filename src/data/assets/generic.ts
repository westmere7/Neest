import type { AssetDefinition } from './types';
import { cyl, defineAsset, line, matSlot, span } from './parts';

const SURFACE = matSlot('surface', 'Surface', 'solid-light-grey');

const genericBox = defineAsset({
  id: 'generic-box',
  name: 'Box',
  category: 'generic',
  tags: ['box', 'cube', 'block', 'primitive', 'placeholder'],
  defaultSize: { w: 1.0, d: 1.0, h: 1.0 },
  minSize: { w: 0.02, d: 0.02, h: 0.02 },
  maxSize: { w: 10, d: 10, h: 5 },
  slots: [SURFACE],
  build: ({ w, d, h }) => [span('surface', [-w / 2, w / 2], [0, h], [-d / 2, d / 2])],
});

const genericCylinder = defineAsset({
  id: 'generic-cylinder',
  name: 'Cylinder',
  category: 'generic',
  tags: ['cylinder', 'round', 'drum', 'primitive', 'placeholder'],
  defaultSize: { w: 0.6, d: 0.6, h: 1.0 },
  minSize: { w: 0.02, d: 0.02, h: 0.02 },
  maxSize: { w: 6, d: 6, h: 5 },
  slots: [SURFACE],
  build: ({ w, d, h }) => [cyl('surface', [0, h / 2, 0], w / 2, h, { scale: [1, 1, d / w], segments: 48 })],
});

const genericPlinth = defineAsset({
  id: 'generic-plinth',
  name: 'Plinth / pedestal',
  category: 'generic',
  tags: ['plinth', 'pedestal', 'podium', 'display stand', 'block'],
  defaultSize: { w: 0.4, d: 0.4, h: 0.9 },
  minSize: { w: 0.1, d: 0.1, h: 0.15 },
  maxSize: { w: 3, d: 3, h: 2 },
  slots: [matSlot('surface', 'Surface', 'plaster-white')],
  build: ({ w, d, h }) => {
    const inset = Math.min(0.03, w * 0.08, d * 0.08);
    return [
      span('surface', [-w / 2, w / 2], [0, 0.06], [-d / 2, d / 2]),
      span('surface', [-w / 2 + inset, w / 2 - inset], [0.06, h - 0.04], [-d / 2 + inset, d / 2 - inset]),
      span('surface', [-w / 2, w / 2], [h - 0.04, h], [-d / 2, d / 2]),
    ];
  },
});

const genericWallCabinet = defineAsset({
  id: 'generic-wall-cabinet',
  name: 'Wall-hung cabinet',
  category: 'generic',
  tags: ['wall cabinet', 'floating cabinet', 'box', 'wall unit', 'placeholder'],
  defaultSize: { w: 0.8, d: 0.3, h: 0.4 },
  minSize: { w: 0.1, d: 0.05, h: 0.1 },
  maxSize: { w: 4, d: 0.8, h: 2.4 },
  mount: 'wall',
  defaultElevation: 1.4,
  slots: [matSlot('body', 'Body', 'laminate-white-matte'), matSlot('front', 'Front', 'laminate-oak')],
  build: ({ w, d, h }) => {
    const ft = Math.min(0.018, d * 0.2);
    return [
      span('body', [-w / 2, w / 2], [0, h], [-d / 2, d / 2 - ft]),
      span('front', [-w / 2 + 0.002, -0.0015], [0.002, h - 0.002], [d / 2 - ft, d / 2], { plan: false }),
      span('front', [0.0015, w / 2 - 0.002], [0.002, h - 0.002], [d / 2 - ft, d / 2], { plan: false }),
    ];
  },
  planDetail: ({ w, d }) => [line([-w / 2, -d / 2], [w / 2, d / 2]), line([-w / 2, d / 2], [w / 2, -d / 2])],
});

export const GENERIC_ASSETS: AssetDefinition[] = [
  genericBox,
  genericCylinder,
  genericPlinth,
  genericWallCabinet,
];

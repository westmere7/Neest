import type { AssetDefinition, Part } from './types';
import {
  cellSpans,
  clamp,
  defineAsset,
  fronts,
  legs4,
  matSlot,
  rod,
  span,
  spaced,
  sphere,
  type FrontSpec,
  type V2,
} from './parts';

const sideboard = defineAsset({
  id: 'sideboard',
  name: 'Sideboard / credenza',
  category: 'storage',
  tags: ['sideboard', 'credenza', 'buffet', 'cabinet', 'dresser'],
  defaultSize: { w: 1.6, d: 0.45, h: 0.78 },
  minSize: { w: 0.9, d: 0.35, h: 0.6 },
  maxSize: { w: 2.6, d: 0.55, h: 1.0 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Body', 'wood-walnut'),
    matSlot('legs', 'Legs', 'wood-walnut'),
    matSlot('handle', 'Knobs', 'metal-brass'),
  ],
  build: ({ w, d, h }) => {
    const legH = Math.min(0.18, h * 0.25);
    const topT = 0.02;
    const zf = d / 2 - 0.025;
    const yTop = h - topT;
    const drawerH = Math.min(0.16, (yTop - legH) * 0.3);
    const specs: FrontSpec[] = [];
    for (const x of cellSpans(clamp(Math.round(w / 0.45), 2, 5), -w / 2 + 0.01, w / 2 - 0.01)) {
      specs.push({ x, y: [yTop - drawerH, yTop], handle: { kind: 'knob' } });
      specs.push({ x, y: [legH + 0.01, yTop - drawerH], handle: { kind: 'knob', y: yTop - drawerH - 0.06 } });
    }
    return [
      span('body', [-w / 2, w / 2], [yTop, h], [-d / 2, d / 2], { bevel: 0.003 }),
      span('body', [-w / 2, w / 2], [legH, yTop], [-d / 2, zf]),
      ...fronts('body', 'handle', specs, zf, 0.013, 0.012),
      ...legs4('legs', w, d, 0.05, 0, legH, 0.04, { round: true, taper: 0.55 }),
    ];
  },
});

const shelving = defineAsset({
  id: 'shelving-unit',
  name: 'Open shelving unit',
  category: 'storage',
  tags: ['shelves', 'shelving', 'rack', 'etagere', 'industrial'],
  defaultSize: { w: 0.9, d: 0.4, h: 1.8 },
  minSize: { w: 0.4, d: 0.25, h: 0.5 },
  maxSize: { w: 1.8, d: 0.6, h: 2.4 },
  wallSnap: true,
  slots: [matSlot('shelf', 'Shelves', 'wood-plywood'), matSlot('frame', 'Frame', 'metal-black-matte')],
  build: ({ w, d, h }) => {
    const p = 0.025;
    const st = 0.025;
    const parts: Part[] = [];
    const corners: V2[] = [
      [-w / 2 + p / 2, -d / 2 + p / 2],
      [w / 2 - p / 2, -d / 2 + p / 2],
      [-w / 2 + p / 2, d / 2 - p / 2],
      [w / 2 - p / 2, d / 2 - p / 2],
    ];
    for (const [x, z] of corners)
      parts.push(span('frame', [x - p / 2, x + p / 2], [0, h], [z - p / 2, z + p / 2]));
    const n = clamp(Math.round((h - 0.1) / 0.38) + 1, 2, 8);
    spaced(n, 0.06 + st / 2, h - st / 2).forEach((y, i) => {
      parts.push(
        span('shelf', [-w / 2 + p, w / 2 - p], [y - st / 2, y + st / 2], [-d / 2, d / 2], {
          plan: i === n - 1,
        }),
      );
    });
    const zb = -d / 2 + p / 2;
    parts.push(rod('frame', [-w / 2 + p, 0.1, zb], [w / 2 - p, h - 0.1, zb], 0.004, { plan: false }));
    parts.push(rod('frame', [w / 2 - p, 0.1, zb], [-w / 2 + p, h - 0.1, zb], 0.004, { plan: false }));
    return parts;
  },
});

const drawerUnit = defineAsset({
  id: 'drawer-unit',
  name: 'Mobile drawer unit',
  category: 'storage',
  tags: ['drawers', 'pedestal', 'caddy', 'under desk', 'storage'],
  defaultSize: { w: 0.42, d: 0.55, h: 0.6 },
  minSize: { w: 0.3, d: 0.4, h: 0.4 },
  maxSize: { w: 0.6, d: 0.7, h: 0.8 },
  slots: [
    matSlot('body', 'Body', 'laminate-white-matte'),
    matSlot('handle', 'Handles', 'metal-brushed-steel'),
    matSlot('wheel', 'Castors', 'solid-black'),
  ],
  build: ({ w, d, h }) => {
    const wheel = 0.025;
    const base = 2 * wheel;
    const zf = d / 2 - 0.035;
    const top = h - 0.01;
    const pencil = h > 0.45 ? 0.12 : 0;
    const rows: V2[] =
      pencil > 0
        ? [[top - pencil, top], ...cellSpans(2, base + 0.01, top - pencil)]
        : cellSpans(2, base + 0.01, top);
    const specs: FrontSpec[] = rows.map((y) => ({
      x: [-w / 2 + 0.005, w / 2 - 0.005],
      y,
      handle: { kind: 'bar-h', y: y[1] - Math.min(0.04, (y[1] - y[0]) * 0.3), len: Math.min(0.18, w * 0.5) },
    }));
    const parts: Part[] = [span('body', [-w / 2, w / 2], [base, h], [-d / 2, zf], { bevel: 0.004 })];
    for (const x of [-w / 2 + 0.04, w / 2 - 0.04]) {
      for (const z of [-d / 2 + 0.04, d / 2 - 0.06])
        parts.push(sphere('wheel', [x, wheel, z], wheel, { plan: false }));
    }
    parts.push(...fronts('body', 'handle', specs, zf, 0.017, 0.018));
    return parts;
  },
});

const shoeCabinet = defineAsset({
  id: 'shoe-cabinet',
  name: 'Shoe cabinet',
  category: 'storage',
  tags: ['shoe cabinet', 'shoe rack', 'hallway', 'entryway', 'tilt-out'],
  defaultSize: { w: 0.8, d: 0.24, h: 1.05 },
  minSize: { w: 0.5, d: 0.17, h: 0.6 },
  maxSize: { w: 1.4, d: 0.35, h: 1.6 },
  wallSnap: true,
  slots: [
    matSlot('body', 'Body', 'laminate-white-matte'),
    matSlot('accent', 'Top, legs & grips', 'wood-oak-light'),
  ],
  build: ({ w, d, h }) => {
    const legH = 0.08;
    const topT = 0.02;
    const zf = d / 2 - 0.025;
    const n = clamp(Math.round((h - legH - topT) / 0.3), 1, 5);
    const grip = Math.min(0.12, w * 0.2);
    const specs: FrontSpec[] = cellSpans(n, legH, h - topT).map((y) => ({ x: [-w / 2, w / 2] as V2, y }));
    const parts: Part[] = [
      span('accent', [-w / 2, w / 2], [h - topT, h], [-d / 2, d / 2], { bevel: 0.003 }),
      span('body', [-w / 2, w / 2], [legH, h - topT], [-d / 2, zf]),
      ...fronts('body', 'accent', specs, zf, 0.015, 0),
      ...legs4('accent', w, d, 0.03, 0, legH, 0.03, { round: true }),
    ];
    // Tilt-out flaps: finger grip along the top edge of each flap.
    for (const [, y1] of cellSpans(n, legH, h - topT)) {
      parts.push(
        span('accent', [-grip, grip], [y1 - 0.035, y1 - 0.012], [zf + 0.015, d / 2], { plan: false }),
      );
    }
    return parts;
  },
});

export const STORAGE_ASSETS: AssetDefinition[] = [sideboard, shelving, drawerUnit, shoeCabinet];

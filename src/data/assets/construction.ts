import type { AssetDefinition, Part } from './types';
import { cells, clamp, cyl, defineAsset, line, matSlot, span, spaced, vcyl, type V3 } from './parts';

const columnSquare = defineAsset({
  id: 'column-square',
  name: 'Square column',
  category: 'construction',
  tags: ['pillar', 'structure', 'post', 'pier'],
  defaultSize: { w: 0.4, d: 0.4, h: 2.7 },
  minSize: { w: 0.15, d: 0.15, h: 2.0 },
  maxSize: { w: 1.5, d: 1.5, h: 4.5 },
  slots: [matSlot('finish', 'Finish', 'plaster-white'), matSlot('trim', 'Skirting', 'paint-satin-white')],
  build: ({ w, d, h }) => {
    const inset = 0.012;
    return [
      span('trim', [-w / 2, w / 2], [0, 0.1], [-d / 2, d / 2]),
      span('finish', [-w / 2 + inset, w / 2 - inset], [0.1, h], [-d / 2 + inset, d / 2 - inset]),
    ];
  },
});

const columnRound = defineAsset({
  id: 'column-round',
  name: 'Round column',
  category: 'construction',
  tags: ['pillar', 'structure', 'cylinder', 'pier'],
  defaultSize: { w: 0.35, d: 0.35, h: 2.7 },
  minSize: { w: 0.15, d: 0.15, h: 2.0 },
  maxSize: { w: 1.2, d: 1.2, h: 4.5 },
  slots: [
    matSlot('finish', 'Finish', 'plaster-white'),
    matSlot('trim', 'Base & capital', 'paint-satin-white'),
  ],
  build: ({ w, d, h }) => {
    const r = w / 2;
    const scale: V3 = [1, 1, d / w];
    const band = Math.min(0.08, h * 0.04);
    return [
      cyl('trim', [0, band / 2, 0], r, band, { scale, segments: 40 }),
      cyl('finish', [0, h / 2, 0], r - Math.min(0.02, r * 0.15), h - 2 * band, { scale, segments: 40 }),
      cyl('trim', [0, h - band / 2, 0], r, band, { scale, segments: 40 }),
    ];
  },
});

const partitionGlass = defineAsset({
  id: 'partition-glass',
  name: 'Glass partition screen',
  category: 'construction',
  tags: ['divider', 'screen', 'crittall', 'glazing', 'room divider'],
  defaultSize: { w: 1.2, d: 0.05, h: 2.1 },
  minSize: { w: 0.4, d: 0.03, h: 1.0 },
  maxSize: { w: 4.0, d: 0.15, h: 3.2 },
  slots: [matSlot('frame', 'Frame', 'metal-black-matte'), matSlot('glass', 'Glass', 'glass-clear')],
  build: ({ w, d, h }) => {
    const f = 0.04;
    const panes = Math.max(1, Math.ceil((w - f) / 1.0));
    const parts: Part[] = [
      span('glass', [-w / 2 + f, w / 2 - f], [f, h - f], [-0.005, 0.005]),
      span('frame', [-w / 2, w / 2], [0, f], [-d / 2, d / 2]),
      span('frame', [-w / 2, w / 2], [h - f, h], [-d / 2, d / 2]),
      span('frame', [-w / 2, -w / 2 + f], [f, h - f], [-d / 2, d / 2]),
      span('frame', [w / 2 - f, w / 2], [f, h - f], [-d / 2, d / 2]),
    ];
    for (let i = 1; i < panes; i++) {
      const x = -w / 2 + (i * w) / panes;
      parts.push(span('frame', [x - 0.012, x + 0.012], [f, h - f], [-d / 2, d / 2]));
    }
    if (h > 1.6) {
      const ty = Math.min(0.95, h * 0.42);
      parts.push(
        span('frame', [-w / 2 + f, w / 2 - f], [ty - 0.012, ty + 0.012], [-d / 2, d / 2], { plan: false }),
      );
    }
    return parts;
  },
});

const partitionSlatted = defineAsset({
  id: 'partition-slatted',
  name: 'Slatted wood partition',
  category: 'construction',
  tags: ['divider', 'slats', 'screen', 'batten', 'room divider'],
  defaultSize: { w: 1.5, d: 0.08, h: 2.4 },
  minSize: { w: 0.4, d: 0.04, h: 1.0 },
  maxSize: { w: 3.0, d: 0.2, h: 3.2 },
  slots: [matSlot('slats', 'Slats', 'wood-oak-light'), matSlot('rail', 'Rails', 'wood-oak-light')],
  build: ({ w, d, h }) => {
    const sw = 0.045;
    const rail = 0.04;
    const n = Math.max(2, Math.round((w - sw) / 0.09) + 1);
    const parts: Part[] = [
      span('rail', [-w / 2, w / 2], [0, rail], [-d * 0.3, d * 0.3], { plan: false }),
      span('rail', [-w / 2, w / 2], [h - rail, h], [-d * 0.3, d * 0.3], { plan: false }),
    ];
    for (const x of spaced(n, -w / 2 + sw / 2, w / 2 - sw / 2)) {
      parts.push(span('slats', [x - sw / 2, x + sw / 2], [rail, h - rail], [-d / 2, d / 2]));
    }
    return parts;
  },
});

const radiator = defineAsset({
  id: 'radiator',
  name: 'Column radiator',
  category: 'construction',
  tags: ['heating', 'heater', 'radiator', 'wall'],
  defaultSize: { w: 0.8, d: 0.1, h: 0.6 },
  minSize: { w: 0.3, d: 0.06, h: 0.3 },
  maxSize: { w: 2.0, d: 0.2, h: 1.8 },
  mount: 'wall',
  defaultElevation: 0.15,
  slots: [matSlot('body', 'Body', 'metal-white-powder'), matSlot('valve', 'Valves', 'metal-chrome')],
  build: ({ w, d, h }) => {
    const n = clamp(Math.round(w / 0.065), 3, 30);
    const pitch = w / n;
    const cw = pitch * 0.82;
    const z0 = -d / 2 + Math.min(0.025, d * 0.25);
    const parts: Part[] = cells(n, -w / 2, w / 2).map((x) =>
      span('body', [x - cw / 2, x + cw / 2], [0.05, h], [z0, d / 2], { bevel: 0.008 }),
    );
    for (const x of [-w / 2 + pitch * 1.5, w / 2 - pitch * 1.5]) {
      parts.push(
        span('body', [x - 0.015, x + 0.015], [h * 0.6, h * 0.6 + 0.04], [-d / 2, z0], { plan: false }),
      );
    }
    const vz = (z0 + d / 2) / 2;
    parts.push(vcyl('valve', -w / 2 + pitch / 2, vz, 0, 0.05, 0.012, { plan: false }));
    parts.push(vcyl('valve', w / 2 - pitch / 2, vz, 0, 0.05, 0.012, { plan: false }));
    return parts;
  },
});

const nicheShelf = defineAsset({
  id: 'niche-shelf',
  name: 'Built-in niche shelving',
  category: 'construction',
  tags: ['built-in', 'alcove', 'shelves', 'joinery', 'recess'],
  defaultSize: { w: 1.0, d: 0.35, h: 2.2 },
  minSize: { w: 0.4, d: 0.2, h: 0.6 },
  maxSize: { w: 3.0, d: 0.6, h: 3.0 },
  wallSnap: true,
  slots: [matSlot('surround', 'Surround', 'plaster-white'), matSlot('shelf', 'Shelves', 'wood-oak-light')],
  build: ({ w, d, h }) => {
    const t = Math.min(0.06, w * 0.1);
    const base = 0.12;
    const back = 0.02;
    const xi: [number, number] = [-w / 2 + t, w / 2 - t];
    const parts: Part[] = [
      span('surround', [-w / 2, -w / 2 + t], [0, h], [-d / 2, d / 2]),
      span('surround', [w / 2 - t, w / 2], [0, h], [-d / 2, d / 2]),
      span('surround', xi, [h - t, h], [-d / 2, d / 2], { plan: false }),
      span('surround', xi, [0, base], [-d / 2, d / 2], { plan: false }),
      span('surround', xi, [base, h - t], [-d / 2, -d / 2 + back], { plan: false }),
    ];
    const inner = h - t - base;
    const compartments = clamp(Math.round(inner / 0.4), 2, 8);
    for (let i = 1; i < compartments; i++) {
      const y = base + (i * inner) / compartments;
      parts.push(span('shelf', xi, [y - 0.0175, y + 0.0175], [-d / 2 + back, d / 2 - 0.02]));
    }
    return parts;
  },
});

const soffitBox = defineAsset({
  id: 'soffit-box',
  name: 'Boxed soffit / bulkhead',
  category: 'construction',
  tags: ['bulkhead', 'drop ceiling', 'boxing', 'ceiling', 'duct'],
  defaultSize: { w: 1.2, d: 0.4, h: 0.3 },
  minSize: { w: 0.2, d: 0.15, h: 0.1 },
  maxSize: { w: 6.0, d: 1.5, h: 1.0 },
  mount: 'ceiling',
  defaultElevation: 2.4,
  wallSnap: true,
  slots: [matSlot('finish', 'Finish', 'paint-ceiling-white')],
  build: ({ w, d, h }) => [span('finish', [-w / 2, w / 2], [0, h], [-d / 2, d / 2])],
  // Overhead elements are conventionally crossed through on plans.
  planDetail: ({ w, d }) => [line([-w / 2, -d / 2], [w / 2, d / 2]), line([-w / 2, d / 2], [w / 2, -d / 2])],
});

export const CONSTRUCTION_ASSETS: AssetDefinition[] = [
  columnSquare,
  columnRound,
  partitionGlass,
  partitionSlatted,
  radiator,
  nicheShelf,
  soffitBox,
];

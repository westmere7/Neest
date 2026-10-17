import type { AssetDefinition, Part } from './types';
import {
  clamp,
  cyl,
  defineAsset,
  lathe,
  legs4,
  matSlot,
  ring,
  rod,
  rodX,
  span,
  vcyl,
  type V3,
} from './parts';

const tableRect = defineAsset({
  id: 'dining-table-rect',
  name: 'Rectangular dining table',
  category: 'dining',
  tags: ['table', 'dining table', 'kitchen table', 'rectangular'],
  defaultSize: { w: 1.6, d: 0.9, h: 0.75 },
  minSize: { w: 0.8, d: 0.6, h: 0.65 },
  maxSize: { w: 3.0, d: 1.2, h: 0.8 },
  slots: [matSlot('top', 'Top', 'wood-oak-light'), matSlot('legs', 'Legs & apron', 'wood-oak-light')],
  build: ({ w, d, h }) => {
    const t = 0.035;
    const leg = 0.06;
    const inset = 0.05;
    const apronH = 0.08;
    const at = 0.02;
    const ox = w / 2 - inset; // outer face of legs
    const oz = d / 2 - inset;
    const ya: [number, number] = [h - t - apronH, h - t];
    return [
      span('top', [-w / 2, w / 2], [h - t, h], [-d / 2, d / 2], { bevel: 0.004 }),
      ...legs4('legs', w, d, inset, 0, h - t, leg),
      span('legs', [-ox + leg, ox - leg], ya, [oz - at, oz], { plan: false }),
      span('legs', [-ox + leg, ox - leg], ya, [-oz, -oz + at], { plan: false }),
      span('legs', [ox - at, ox], ya, [-oz + leg, oz - leg], { plan: false }),
      span('legs', [-ox, -ox + at], ya, [-oz + leg, oz - leg], { plan: false }),
    ];
  },
});

const tableRound = defineAsset({
  id: 'dining-table-round',
  name: 'Round dining table',
  category: 'dining',
  tags: ['table', 'dining table', 'round', 'pedestal', 'tulip'],
  defaultSize: { w: 1.1, d: 1.1, h: 0.75 },
  minSize: { w: 0.7, d: 0.7, h: 0.65 },
  maxSize: { w: 1.6, d: 1.6, h: 0.8 },
  slots: [matSlot('top', 'Top', 'laminate-white-matte'), matSlot('base', 'Pedestal', 'metal-white-powder')],
  build: ({ w, d, h }) => {
    const sz: V3 = [1, 1, d / w];
    const t = 0.035;
    const rb = w * 0.28;
    return [
      cyl('top', [0, h - t / 2, 0], w / 2, t, { scale: sz, segments: 56 }),
      vcyl('base', 0, 0, 0.14, h - t, 0.05, { plan: false }),
      lathe(
        'base',
        [0, 0, 0],
        [
          [0, 0],
          [rb, 0],
          [rb, 0.02],
          [rb * 0.55, 0.06],
          [0.07, 0.15],
          [0, 0.15],
        ],
        { scale: sz, segments: 40, plan: false },
      ),
    ];
  },
});

const chair = defineAsset({
  id: 'dining-chair',
  name: 'Dining chair',
  category: 'dining',
  tags: ['chair', 'seat', 'dining chair', 'kitchen chair', 'seating'],
  defaultSize: { w: 0.46, d: 0.52, h: 0.82 },
  minSize: { w: 0.38, d: 0.42, h: 0.7 },
  maxSize: { w: 0.6, d: 0.65, h: 1.1 },
  slots: [matSlot('frame', 'Frame', 'wood-oak-light'), matSlot('seat', 'Seat', 'fabric-linen')],
  build: ({ w, d, h }) => {
    const seatTop = clamp(h * 0.56, 0.4, 0.48);
    const seatT = 0.05;
    const lt = 0.035;
    const inset = 0.012;
    const lx = w / 2 - inset - lt / 2;
    const zf = d / 2 - inset - lt / 2;
    const zr = -d / 2 + inset + lt / 2;
    const parts: Part[] = [];
    for (const x of [-lx, lx]) {
      parts.push(
        span('frame', [x - lt / 2, x + lt / 2], [0, seatTop - seatT], [zf - lt / 2, zf + lt / 2], {
          plan: false,
        }),
      );
      parts.push(
        span('frame', [x - lt / 2, x + lt / 2], [0, h], [zr - lt / 2, zr + lt / 2], { plan: false }),
      );
      parts.push(span('frame', [x - 0.01, x + 0.01], [0.15, 0.17], [zr, zf], { plan: false }));
    }
    parts.push(
      span('seat', [-w / 2, w / 2], [seatTop - seatT, seatTop], [zr + lt / 2, d / 2], { bevel: 0.015 }),
    );
    parts.push(span('frame', [-lx, lx], [h - 0.17, h - 0.02], [zr - 0.0125, zr + 0.0125], { bevel: 0.004 }));
    if (h - 0.17 > seatTop + 0.2) {
      parts.push(
        span('frame', [-lx, lx], [seatTop + 0.1, seatTop + 0.13], [zr - 0.01, zr + 0.01], { plan: false }),
      );
    }
    return parts;
  },
});

const barStool = defineAsset({
  id: 'bar-stool',
  name: 'Bar stool',
  category: 'dining',
  tags: ['stool', 'bar stool', 'counter stool', 'seating', 'high chair'],
  defaultSize: { w: 0.42, d: 0.42, h: 0.76 },
  minSize: { w: 0.32, d: 0.32, h: 0.55 },
  maxSize: { w: 0.55, d: 0.55, h: 0.9 },
  slots: [matSlot('seat', 'Seat', 'wood-oak-light'), matSlot('frame', 'Frame', 'metal-black-matte')],
  build: ({ w, d, h }) => {
    const R = w / 2;
    const sz = d / w;
    const seatT = 0.04;
    const yTop = h - seatT;
    const rb = R - 0.02;
    const rt = R * 0.62;
    const parts: Part[] = [cyl('seat', [0, h - seatT / 2, 0], R, seatT, { scale: [1, 1, sz], segments: 36 })];
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      const c = Math.cos(a);
      const s = Math.sin(a) * sz;
      parts.push(rod('frame', [rb * c, 0, rb * s], [rt * c, yTop, rt * s], 0.012, { plan: false }));
    }
    const yr = h * 0.33;
    const rho = rb + (rt - rb) * (yr / yTop);
    parts.push(ring('frame', [0, yr, 0], rho, 0.009, { zScale: sz, plan: false }));
    return parts;
  },
});

const barTable = defineAsset({
  id: 'bar-table',
  name: 'Bar / high table',
  category: 'dining',
  tags: ['bar table', 'high table', 'counter', 'poseur', 'trestle'],
  defaultSize: { w: 1.2, d: 0.6, h: 1.05 },
  minSize: { w: 0.6, d: 0.4, h: 0.9 },
  maxSize: { w: 2.4, d: 0.9, h: 1.15 },
  slots: [matSlot('top', 'Top', 'wood-walnut'), matSlot('frame', 'Frame', 'metal-black-matte')],
  build: ({ w, d, h }) => {
    const t = 0.035;
    const tx = w / 2 - Math.min(0.12, w * 0.15);
    const parts: Part[] = [span('top', [-w / 2, w / 2], [h - t, h], [-d / 2, d / 2], { bevel: 0.004 })];
    for (const x of [-tx, tx]) {
      parts.push(span('frame', [x - 0.03, x + 0.03], [0.03, h - t], [-0.03, 0.03], { plan: false }));
      parts.push(
        span('frame', [x - 0.03, x + 0.03], [0, 0.03], [-d / 2 + 0.04, d / 2 - 0.04], { plan: false }),
      );
      parts.push(
        span('frame', [x - 0.03, x + 0.03], [h - t - 0.03, h - t], [-d / 2 + 0.06, d / 2 - 0.06], {
          plan: false,
        }),
      );
    }
    parts.push(rodX('frame', -tx, tx, 0.3, 0, 0.013, { plan: false }));
    return parts;
  },
});

const bench = defineAsset({
  id: 'bench',
  name: 'Dining bench',
  category: 'dining',
  tags: ['bench', 'seat', 'seating', 'dining bench', 'hallway'],
  defaultSize: { w: 1.4, d: 0.38, h: 0.46 },
  minSize: { w: 0.6, d: 0.28, h: 0.35 },
  maxSize: { w: 2.4, d: 0.5, h: 0.55 },
  slots: [matSlot('wood', 'Wood', 'wood-oak-light')],
  build: ({ w, d, h }) => {
    const t = 0.04;
    const lx = w / 2 - Math.min(0.1, w * 0.12);
    return [
      span('wood', [-w / 2, w / 2], [h - t, h], [-d / 2, d / 2], { bevel: 0.004 }),
      span('wood', [-lx - 0.02, -lx + 0.02], [0, h - t], [-d / 2 + 0.03, d / 2 - 0.03], { plan: false }),
      span('wood', [lx - 0.02, lx + 0.02], [0, h - t], [-d / 2 + 0.03, d / 2 - 0.03], { plan: false }),
      span('wood', [-lx + 0.02, lx - 0.02], [0.12, 0.16], [-0.02, 0.02], { plan: false }),
    ];
  },
});

export const DINING_ASSETS: AssetDefinition[] = [tableRect, tableRound, chair, barStool, barTable, bench];

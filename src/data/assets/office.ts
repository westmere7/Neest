import type { AssetDefinition, Part } from './types';
import {
  box,
  circle,
  clamp,
  cyl,
  defineAsset,
  fronts,
  matSlot,
  rod,
  span,
  sphere,
  vcyl,
  type FrontSpec,
  type V2,
  type V3,
} from './parts';

const desk = defineAsset({
  id: 'desk',
  name: 'Desk',
  category: 'office',
  tags: ['desk', 'workstation', 'writing desk', 'table', 'work'],
  defaultSize: { w: 1.4, d: 0.7, h: 0.75 },
  minSize: { w: 0.8, d: 0.5, h: 0.65 },
  maxSize: { w: 2.4, d: 1.0, h: 1.25 },
  wallSnap: true,
  slots: [matSlot('top', 'Top', 'wood-oak-light'), matSlot('frame', 'Frame', 'metal-black-matte')],
  build: ({ w, d, h }) => {
    const t = 0.025;
    const fx = w / 2 - 0.05;
    const parts: Part[] = [span('top', [-w / 2, w / 2], [h - t, h], [-d / 2, d / 2], { bevel: 0.003 })];
    for (const x of [-fx, fx]) {
      for (const z of [-d / 2 + 0.05, d / 2 - 0.05]) {
        parts.push(span('frame', [x - 0.02, x + 0.02], [0, h - t], [z - 0.02, z + 0.02], { plan: false }));
      }
      parts.push(
        span('frame', [x - 0.02, x + 0.02], [h - t - 0.04, h - t], [-d / 2 + 0.03, d / 2 - 0.03], {
          plan: false,
        }),
      );
    }
    parts.push(
      span('frame', [-fx + 0.02, fx - 0.02], [h * 0.45, h - t - 0.005], [-d / 2 + 0.045, -d / 2 + 0.055], {
        plan: false,
      }),
    );
    return parts;
  },
});

const deskL = defineAsset({
  id: 'desk-l-shaped',
  name: 'L-shaped corner desk',
  category: 'office',
  tags: ['desk', 'corner desk', 'l-shape', 'workstation', 'office'],
  defaultSize: { w: 1.6, d: 1.4, h: 0.75 },
  minSize: { w: 1.1, d: 1.0, h: 0.65 },
  maxSize: { w: 2.4, d: 2.0, h: 0.8 },
  wallSnap: true,
  slots: [matSlot('top', 'Top', 'laminate-white-matte'), matSlot('frame', 'Legs', 'metal-anthracite')],
  build: ({ w, d, h }) => {
    const t = 0.025;
    const zm = -d / 2 + Math.min(0.7, d * 0.55);
    const rw = clamp(w * 0.35, 0.45, 0.6);
    const lt = 0.05;
    const legs: V2[] = [
      [-w / 2 + 0.05, -d / 2 + 0.05],
      [-w / 2 + 0.05, zm - 0.05],
      [w / 2 - 0.05, -d / 2 + 0.05],
      [w / 2 - 0.05, d / 2 - 0.05],
      [w / 2 - rw + 0.05, d / 2 - 0.05],
    ];
    return [
      span('top', [-w / 2, w / 2], [h - t, h], [-d / 2, zm], { bevel: 0.003 }),
      span('top', [w / 2 - rw, w / 2], [h - t, h], [zm, d / 2], { bevel: 0.003 }),
      ...legs.map(([x, z]) =>
        span('frame', [x - lt / 2, x + lt / 2], [0, h - t], [z - lt / 2, z + lt / 2], { plan: false }),
      ),
    ];
  },
});

const STAR_ANGLES = [0, 1, 2, 3, 4].map((k) => Math.PI / 2 + (k * 2 * Math.PI) / 5);
const starRadius = (w: number, d: number): number => Math.min(w, d) / 2 - 0.03;

const officeChair = defineAsset({
  id: 'office-chair',
  name: 'Office chair',
  category: 'office',
  tags: ['chair', 'desk chair', 'task chair', 'swivel', 'seating'],
  defaultSize: { w: 0.65, d: 0.65, h: 1.05 },
  minSize: { w: 0.55, d: 0.55, h: 0.85 },
  maxSize: { w: 0.8, d: 0.8, h: 1.3 },
  slots: [
    matSlot('upholstery', 'Upholstery', 'fabric-wool-grey'),
    matSlot('frame', 'Frame', 'metal-black-matte'),
    matSlot('base', 'Base', 'metal-chrome'),
  ],
  build: ({ w, d, h }) => {
    const R = starRadius(w, d);
    const seatY = clamp(h * 0.45, 0.42, 0.52);
    const sw = Math.min(0.48, w - 0.17);
    const sd = Math.min(0.46, d - 0.15);
    const zs0 = -sd / 2 + 0.03;
    const zs1 = sd / 2 + 0.03;
    const parts: Part[] = [];
    // Five-star base with casters.
    for (const a of STAR_ANGLES) {
      const c = Math.cos(a);
      const s = Math.sin(a);
      parts.push(box('base', [(R / 2) * c, 0.0625, (R / 2) * s], [R, 0.035, 0.05], { rotation: [0, -a, 0] }));
      parts.push(sphere('frame', [R * c, 0.03, R * s], 0.03, { plan: false }));
    }
    parts.push(cyl('base', [0, 0.07, 0], 0.05, 0.05, { plan: false }));
    parts.push(vcyl('base', 0, 0, 0.09, seatY - 0.1, 0.025, { plan: false }));
    parts.push(span('frame', [-0.1, 0.1], [seatY - 0.11, seatY - 0.07], [-0.12, 0.12], { plan: false }));
    parts.push(span('upholstery', [-sw / 2, sw / 2], [seatY - 0.07, seatY], [zs0, zs1], { bevel: 0.02 }));
    parts.push(
      span('frame', [-0.025, 0.025], [seatY - 0.1, seatY + 0.14], [zs0 - 0.05, zs0 - 0.01], { plan: false }),
    );
    parts.push(
      span('upholstery', [-sw * 0.46, sw * 0.46], [seatY + 0.08, h - 0.01], [zs0 - 0.06, zs0], {
        bevel: 0.02,
      }),
    );
    for (const side of [-1, 1]) {
      const ax = side * (sw / 2 + 0.025);
      parts.push(
        span('frame', [ax - 0.012, ax + 0.012], [seatY - 0.06, seatY + 0.2], [-0.02, 0.02], { plan: false }),
      );
      parts.push(
        span('frame', [ax - 0.03, ax + 0.03], [seatY + 0.2, seatY + 0.23], [-0.13, 0.11], { bevel: 0.008 }),
      );
    }
    return parts;
  },
  // Casters mark the five-star base, which the seat mostly hides from above.
  planDetail: ({ w, d }) => {
    const R = starRadius(w, d);
    return STAR_ANGLES.map((a) => circle([R * Math.cos(a), R * Math.sin(a)], 0.025));
  },
});

function taskLampLayout(w: number, d: number, h: number) {
  const baseR = Math.min(w / 2, d * 0.22, 0.09);
  const zb = -d / 2 + baseR;
  const shadeR = Math.min(w / 2, 0.075);
  const shadeH = Math.min(0.13, h * 0.3);
  const zh = d / 2 - shadeR;
  const yHead = h - 0.02;
  return { baseR, zb, shadeR, shadeH, zh, yHead, shadeBottom: yHead - 0.01 - shadeH };
}

const taskLamp = defineAsset({
  id: 'task-lamp',
  name: 'Desk task lamp',
  category: 'office',
  tags: ['lamp', 'desk lamp', 'task light', 'reading', 'anglepoise'],
  defaultSize: { w: 0.18, d: 0.45, h: 0.55 },
  minSize: { w: 0.14, d: 0.3, h: 0.35 },
  maxSize: { w: 0.3, d: 0.7, h: 0.9 },
  // Sits on a desk top by default.
  defaultElevation: 0.75,
  slots: [matSlot('base', 'Body', 'metal-black-matte'), matSlot('light', 'Diffuser', 'light-warm')],
  light: { color: '#ffd9a8', intensity: 0.8, distance: 2.5, y: 0.39 },
  build: ({ w, d, h }) => {
    const L = taskLampLayout(w, d, h);
    const pivot: V3 = [0, 0.04, L.zb];
    const elbow: V3 = [0, h * 0.78, L.zb + (L.zh - L.zb) * 0.2];
    const head: V3 = [0, L.yHead, L.zh];
    return [
      cyl('base', [0, 0.0125, L.zb], L.baseR, 0.025, { segments: 32 }),
      sphere('base', pivot, 0.018, { plan: false }),
      rod('base', pivot, elbow, 0.009),
      sphere('base', elbow, 0.015, { plan: false }),
      rod('base', elbow, head, 0.009),
      sphere('base', head, 0.015, { plan: false }),
      cyl('base', [0, L.yHead - 0.01 - L.shadeH / 2, L.zh], L.shadeR, L.shadeH, {
        rTop: L.shadeR * 0.4,
        segments: 32,
      }),
      cyl('light', [0, L.shadeBottom + 0.004, L.zh], L.shadeR - 0.008, 0.004, { segments: 32, plan: false }),
    ];
  },
});

const filingCabinet = defineAsset({
  id: 'filing-cabinet',
  name: 'Filing cabinet',
  category: 'office',
  tags: ['filing', 'cabinet', 'drawers', 'archive', 'office storage'],
  defaultSize: { w: 0.47, d: 0.62, h: 1.02 },
  minSize: { w: 0.38, d: 0.45, h: 0.5 },
  maxSize: { w: 0.9, d: 0.75, h: 1.4 },
  wallSnap: true,
  slots: [matSlot('body', 'Body', 'metal-anthracite'), matSlot('handle', 'Handles', 'metal-chrome')],
  build: ({ w, d, h }) => {
    const zf = d / 2 - 0.04;
    const n = clamp(Math.round(h / 0.3), 1, 5);
    const specs: FrontSpec[] = [];
    const parts: Part[] = [span('body', [-w / 2, w / 2], [0, h], [-d / 2, zf])];
    const rh = (h - 0.02) / n;
    for (let i = 0; i < n; i++) {
      const y0 = 0.01 + i * rh;
      specs.push({
        x: [-w / 2 + 0.01, w / 2 - 0.01],
        y: [y0, y0 + rh],
        handle: { kind: 'bar-h', y: y0 + rh * 0.7, len: Math.min(0.2, w * 0.45) },
      });
      parts.push(
        span('handle', [-0.04, 0.04], [y0 + rh * 0.8, y0 + rh * 0.8 + 0.025], [zf + 0.018, zf + 0.023], {
          plan: false,
        }),
      );
    }
    parts.push(...fronts('body', 'handle', specs, zf, 0.018, 0.022));
    return parts;
  },
});

export const OFFICE_ASSETS: AssetDefinition[] = [desk, deskL, officeChair, taskLamp, filingCabinet];

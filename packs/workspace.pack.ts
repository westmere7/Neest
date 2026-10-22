/**
 * Workspace — desks and the chairs to go with them.
 *
 * Desks: a slim oak desk, a writing desk with drawers, a computer desk with a hutch, L-shaped corner
 * desks (left and right hand, plain, with a drawer pedestal, a gaming L with a monitor shelf and an
 * electric standing L), an electric standing desk, a long two-person bench desk, a U-shaped desk, a
 * wall-mounted fold-down desk and a leaning ladder desk. Every desk is resizable within sensible
 * limits; the L desks keep a 60 cm return.
 *
 * Chairs: an ergonomic mesh chair with headrest (the mesh is a see-through texture), a fabric task
 * chair, a high-back leather executive chair, a drafting stool, a kneeling chair, a Scandinavian
 * wooden desk chair and a bouclé swivel chair. Plus a desk set: keyboard, mouse, notebook and pens.
 */
import {
  cells,
  containParts,
  cyl,
  defineItem,
  definePack,
  matSlot,
  plantBox,
  range,
  rod,
  rodX,
  span,
  sphere,
  torus,
  vcyl,
  type PackItem,
  type PackMaterial,
  type PackPattern,
  type Part,
  type Size3,
} from '@/packs/kit';

type V2 = [number, number];
const o = { plan: false } as const;
const keep = (parts: Part[], size: Size3) => containParts(parts, plantBox(size));
const desk = { category: 'office' as const, type: 'surfaces' as const, group: 'Desks' };
const chair = { category: 'office' as const, type: 'seating' as const, group: 'Desk chairs' };
const sorted = (a: number, b: number): V2 => (a < b ? [a, b] : [b, a]);

const patterns: PackPattern[] = [
  {
    id: 'chair-mesh',
    name: 'Chair mesh',
    cutout: true,
    normalStrength: 0.5,
    draw(ctx, size) {
      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = '#ffffff';
      const n = 16;
      const step = size / n;
      const t = Math.max(2, Math.round(step * 0.38));
      for (let i = 0; i < n; i++) {
        ctx.fillRect(Math.round(i * step), 0, t, size);
        ctx.fillRect(0, Math.round(i * step), size, t);
      }
    },
  },
];

const materials: PackMaterial[] = [
  { id: 'mesh-black', name: 'Black chair mesh', category: 'fabric', color: '#2b2c2f', roughness: 0.8, pattern: { id: 'chair-mesh', scale: 0.03, contrast: 1 } },
  { id: 'mesh-grey', name: 'Grey chair mesh', category: 'fabric', color: '#9a9ca0', roughness: 0.8, pattern: { id: 'chair-mesh', scale: 0.03, contrast: 1 } },
  { id: 'carbon-black', name: 'Carbon-fibre black', category: 'solid', color: '#26272a', roughness: 0.35, pattern: { id: 'weave', scale: 0.02, contrast: 0.35 } },
  { id: 'nylon-black', name: 'Black nylon', category: 'solid', color: '#1f2022', roughness: 0.5 },
  { id: 'leather-black', name: 'Black leather', category: 'leather', color: '#202022', roughness: 0.45, pattern: { id: 'leather', scale: 0.1, contrast: 0.5 } },
  { id: 'leather-cognac', name: 'Cognac leather', category: 'leather', color: '#8e4f27', roughness: 0.5, pattern: { id: 'leather', scale: 0.1, contrast: 0.5 } },
  { id: 'paper-white', name: 'Notebook paper', category: 'solid', color: '#f4f1e8', roughness: 0.9 },
  { id: 'rgb-glow', name: 'RGB strip', category: 'solid', color: '#7a5cff', roughness: 0.4, emissive: '#7a5cff', emissiveIntensity: 1.2 },
];

// ───────────────────────── Desks ─────────────────────────

/** Desk top with slightly rounded edges. */
const top = (slot: string, x: V2, z: V2, y: number, t = 0.025, plan = true): Part => span(slot, x, [y - t, y], z, { bevel: 0.004, plan });

/** Four square legs inset under a rectangular top. */
function legs4(slot: string, x: V2, z: V2, y: number, s = 0.035, inset = 0.04): Part[] {
  const out: Part[] = [];
  for (const lx of [x[0] + inset, x[1] - inset]) for (const lz of [z[0] + inset, z[1] - inset]) out.push(span(slot, [lx - s / 2, lx + s / 2], [0, y], [lz - s / 2, lz + s / 2], o));
  return out;
}

/** A panel (sled) leg: a slab running front to back at x. */
const panelLeg = (slot: string, x: number, z: V2, y: number, t = 0.022): Part => span(slot, [x - t / 2, x + t / 2], [0, y], z, o);

/** A drawer box hung under a top, with handles. */
function drawerUnit(body: string, handle: string, x: V2, z: V2, y0: number, y1: number, n: number): Part[] {
  const out: Part[] = [span(body, x, [y0, y1], z, { bevel: 0.004, plan: false })];
  for (const i of range(n)) {
    const a = y0 + ((y1 - y0) * i) / n;
    const b = y0 + ((y1 - y0) * (i + 1)) / n;
    out.push(span(body, [x[0] + 0.006, x[1] - 0.006], [a + 0.004, b - 0.004], [z[1], z[1] + 0.006], o), rodX(handle, (x[0] + x[1]) / 2 - 0.05, (x[0] + x[1]) / 2 + 0.05, (a + b) / 2, z[1] + 0.016, 0.005, o));
  }
  return out;
}

const slimDesk = defineItem({
  ...desk,
  id: 'slim-oak-desk',
  name: 'Slim oak desk',
  tags: ['desk', 'work table', 'oak', 'home office', 'bàn làm việc'],
  description: 'A simple desk with a solid oak top on four slim black steel legs; fits a bedroom corner or a narrow alcove.',
  defaultSize: { w: 1.2, d: 0.6, h: 0.75 },
  minSize: { w: 0.8, d: 0.45, h: 0.7 },
  maxSize: { w: 1.8, d: 0.8, h: 0.78 },
  slots: [matSlot('top', 'Top', 'wood-oak-natural'), matSlot('legs', 'Legs', 'metal-black-matte')],
  build: (size) => {
    const { w, d, h } = size;
    return keep([top('top', [-w / 2, w / 2], [-d / 2, d / 2], h), ...legs4('legs', [-w / 2, w / 2], [-d / 2, d / 2], h - 0.025, 0.025, 0.05), span('legs', [-w / 2 + 0.06, w / 2 - 0.06], [h - 0.07, h - 0.05], [-d / 2 + 0.05, -d / 2 + 0.07], o)], size);
  },
});

const writingDesk = defineItem({
  ...desk,
  id: 'writing-desk-drawers',
  name: 'Writing desk with drawers',
  tags: ['writing desk', 'desk', 'drawers', 'study', 'walnut', 'bàn học'],
  description: 'A walnut writing desk with tapered legs and two shallow drawers under the top for pens, cables and notebooks.',
  defaultSize: { w: 1.1, d: 0.55, h: 0.76 },
  minSize: { w: 0.8, d: 0.45, h: 0.72 },
  maxSize: { w: 1.5, d: 0.7, h: 0.78 },
  slots: [matSlot('wood', 'Wood', 'wood-walnut'), matSlot('handle', 'Handles', 'metal-brass')],
  build: (size) => {
    const { w, d, h } = size;
    const parts: Part[] = [top('wood', [-w / 2, w / 2], [-d / 2, d / 2], h, 0.025)];
    for (const lx of [-w / 2 + 0.05, w / 2 - 0.05]) for (const lz of [-d / 2 + 0.05, d / 2 - 0.05]) parts.push(cyl('wood', [lx, (h - 0.025) / 2, lz], 0.014, h - 0.025, { rTop: 0.02, segments: 10, plan: false }));
    parts.push(...drawerUnit('wood', 'handle', [-w / 2 + 0.07, -0.01], [-d / 2 + 0.06, d / 2 - 0.03], h - 0.11, h - 0.025, 1), ...drawerUnit('wood', 'handle', [0.01, w / 2 - 0.07], [-d / 2 + 0.06, d / 2 - 0.03], h - 0.11, h - 0.025, 1));
    return keep(parts, size);
  },
});

/**
 * L-shaped corner desk, corner at the back left: the main run along the back (full width, depth
 * `run`) and the return down the left side (full depth, width `ret`). `right` mirrors it.
 */
function lDesk(size: Size3, opts: { right?: boolean; run?: number; ret?: number; legs: 'panel' | 'frame' | 'standing'; pedestal?: boolean; shelf?: boolean; glow?: boolean; deskY?: number }): Part[] {
  const { w, d, h } = size;
  const run = opts.run ?? 0.6;
  const ret = opts.ret ?? 0.6;
  const y = opts.deskY ?? (opts.legs === 'standing' ? Math.min(h, 0.75) : h);
  const parts: Part[] = [
    top('top', [-w / 2, w / 2], [-d / 2, -d / 2 + run], y),
    top('top', [-w / 2, -w / 2 + ret], [-d / 2 + run, d / 2], y),
  ];
  const ly = y - 0.025;
  if (opts.legs === 'panel') {
    parts.push(
      panelLeg('legs', w / 2 - 0.02, [-d / 2 + 0.02, -d / 2 + run - 0.02], ly),
      span('legs', [-w / 2 + ret + 0.02, -w / 2 + ret - 0.02 + 0.04], [0, ly], [-d / 2 + 0.02, -d / 2 + 0.05], o),
      span('legs', [-w / 2 + 0.02, -w / 2 + ret - 0.02], [0, ly], [d / 2 - 0.042, d / 2 - 0.02], o),
      span('legs', [-w / 2 + 0.02, -w / 2 + 0.042], [0, ly], [-d / 2 + 0.02, d / 2 - 0.02], o),
      span('legs', [-w / 2 + ret, w / 2 - 0.03], [ly - 0.3, ly - 0.05], [-d / 2 + 0.03, -d / 2 + 0.045], o),
    );
  } else {
    const leg = (x: number, z: number) => (opts.legs === 'standing' ? vcyl('legs', x, z, 0, ly, 0.03, o) : span('legs', [x - 0.025, x + 0.025], [0, ly], [z - 0.025, z + 0.025], o));
    parts.push(leg(-w / 2 + 0.05, -d / 2 + 0.05), leg(w / 2 - 0.05, -d / 2 + 0.05), leg(w / 2 - 0.05, -d / 2 + run - 0.06), leg(-w / 2 + 0.05, d / 2 - 0.05), leg(-w / 2 + ret - 0.06, d / 2 - 0.05));
    parts.push(span('legs', [-w / 2 + 0.05, w / 2 - 0.05], [ly - 0.06, ly - 0.03], [-d / 2 + 0.04, -d / 2 + 0.07], o), span('legs', [-w / 2 + 0.04, -w / 2 + 0.07], [ly - 0.06, ly - 0.03], [-d / 2 + 0.05, d / 2 - 0.05], o));
    if (opts.legs === 'standing') parts.push(span('handle', [w / 2 - 0.25, w / 2 - 0.15], [ly - 0.03, ly - 0.005], [-d / 2 + run - 0.04, -d / 2 + run], { bevel: 0.006, plan: false }));
  }
  if (opts.pedestal) parts.push(...drawerUnit('legs', 'handle', [-w / 2 + 0.03, -w / 2 + ret - 0.03], [d / 2 - 0.5, d / 2 - 0.03], 0.02, ly - 0.02, 3));
  if (opts.shelf) parts.push(span('top', [-w / 2 + ret, w / 2 - 0.05], [y + 0.1, y + 0.12], [-d / 2 + 0.02, -d / 2 + 0.3], o), span('legs', [-w / 2 + ret, -w / 2 + ret + 0.02], [y, y + 0.1], [-d / 2 + 0.02, -d / 2 + 0.3], o), span('legs', [w / 2 - 0.07, w / 2 - 0.05], [y, y + 0.1], [-d / 2 + 0.02, -d / 2 + 0.3], o));
  if (opts.glow) parts.push(span('light', [-w / 2 + 0.05, w / 2 - 0.05], [y - 0.03, y - 0.026], [-d / 2 + run - 0.004, -d / 2 + run], o));
  return opts.right ? parts.map((p) => ({ ...p, position: [-p.position[0], p.position[1], p.position[2]] as [number, number, number] })) : parts;
}

const L_SIZE = { min: { w: 1.2, d: 1.0, h: 0.72 }, max: { w: 2.2, d: 2.0, h: 0.78 } };

const lDeskLeft = defineItem({
  ...desk,
  id: 'l-desk-corner-left',
  name: 'L-shaped corner desk, return left',
  tags: ['l-shaped desk', 'corner desk', 'l desk', 'workstation', 'bàn chữ l'],
  description: 'An L-shaped desk for a room corner: an oak top in two 60 cm deep runs on white panel legs, with a modesty panel. The short return is on the left.',
  defaultSize: { w: 1.6, d: 1.4, h: 0.75 },
  minSize: L_SIZE.min,
  maxSize: L_SIZE.max,
  slots: [matSlot('top', 'Top', 'wood-oak-light'), matSlot('legs', 'Legs & panels', 'paint-pure-white')],
  build: (size) => keep(lDesk(size, { legs: 'panel' }), size),
});
const lDeskRight = defineItem({
  ...lDeskLeft,
  id: 'l-desk-corner-right',
  name: 'L-shaped corner desk, return right',
  description: 'The L-shaped corner desk with its short return on the right, for the other corner of the room.',
  tags: ['l-shaped desk', 'corner desk', 'right hand', 'workstation', 'bàn chữ l'],
  variantOf: 'l-desk-corner-left',
  build: (size) => keep(lDesk(size, { legs: 'panel', right: true }), size),
});

const lDeskPedestal = defineItem({
  ...desk,
  id: 'l-desk-drawer-pedestal',
  name: 'L-shaped desk with drawer pedestal',
  tags: ['l-shaped desk', 'corner desk', 'drawers', 'pedestal', 'office', 'bàn chữ l'],
  description: 'A walnut L desk on black steel legs with a three-drawer pedestal built into the return: a full home-office workstation.',
  defaultSize: { w: 1.8, d: 1.5, h: 0.75 },
  minSize: L_SIZE.min,
  maxSize: L_SIZE.max,
  slots: [matSlot('top', 'Top', 'wood-walnut'), matSlot('legs', 'Frame & pedestal', 'metal-black-matte'), matSlot('handle', 'Handles', 'metal-brass')],
  build: (size) => keep(lDesk(size, { legs: 'frame', pedestal: true }), size),
});

const lDeskGaming = defineItem({
  ...desk,
  id: 'l-desk-gaming',
  name: 'Gaming L desk with monitor shelf',
  tags: ['gaming desk', 'l-shaped desk', 'monitor shelf', 'rgb', 'corner desk', 'bàn gaming'],
  description: 'A black carbon-look L desk with a raised monitor shelf along the long run and an RGB light strip under the front edge.',
  defaultSize: { w: 1.6, d: 1.2, h: 0.88 },
  minSize: { ...L_SIZE.min, h: 0.88 },
  maxSize: { ...L_SIZE.max, h: 0.88 },
  slots: [matSlot('top', 'Top & shelf', 'carbon-black'), matSlot('legs', 'Frame', 'metal-black-matte'), matSlot('light', 'Light strip', 'rgb-glow')],
  light: { color: '#7a5cff', intensity: 0.3, distance: 1.5, y: 0.7, z: 0.0 },
  build: (size) => keep(lDesk(size, { legs: 'frame', shelf: true, glow: true, deskY: 0.75 }), size),
});

const lDeskStanding = defineItem({
  ...desk,
  id: 'l-desk-standing',
  name: 'Electric standing L desk',
  tags: ['standing desk', 'l-shaped desk', 'sit stand', 'electric', 'height adjustable', 'bàn nâng hạ'],
  description: 'A sit-stand L desk on three motorised columns with a memory keypad; shown at sitting height (raise it with the height to standing, about 1.1 m).',
  defaultSize: { w: 1.8, d: 1.5, h: 0.74 },
  minSize: { w: 1.4, d: 1.1, h: 0.62 },
  maxSize: { w: 2.2, d: 1.9, h: 1.27 },
  slots: [matSlot('top', 'Top', 'laminate-oak'), matSlot('legs', 'Columns & feet', 'metal-white-powder'), matSlot('handle', 'Keypad', 'nylon-black')],
  build: (size) => {
    const parts = lDesk({ ...size, h: Math.min(size.h, 0.75) }, { legs: 'standing' });
    // Raised: lift the top, keypad and frame to the chosen height.
    const lift = Math.max(0, size.h - 0.75);
    return keep(
      parts.map((p) => (p.position[1] > 0.6 ? { ...p, position: [p.position[0], p.position[1] + lift, p.position[2]] as [number, number, number] } : p.shape === 'cylinder' ? { ...p, position: [p.position[0], p.position[1] + lift / 2, p.position[2]] as [number, number, number], height: (p as Extract<Part, { shape: 'cylinder' }>).height + lift } : p)),
      size,
    );
  },
});

const standingDesk = defineItem({
  ...desk,
  id: 'standing-desk-electric',
  name: 'Electric standing desk',
  tags: ['standing desk', 'sit stand', 'electric', 'height adjustable', 'ergonomic', 'bàn nâng hạ'],
  description: 'A motorised sit-stand desk on two lifting columns with T feet and a memory keypad; resize the height from 62 cm sitting to 127 cm standing.',
  defaultSize: { w: 1.4, d: 0.7, h: 0.74 },
  minSize: { w: 1.0, d: 0.6, h: 0.62 },
  maxSize: { w: 1.8, d: 0.8, h: 1.27 },
  slots: [matSlot('top', 'Top', 'laminate-oak'), matSlot('legs', 'Frame', 'metal-black-matte'), matSlot('handle', 'Keypad', 'nylon-black')],
  build: (size) => {
    const { w, d, h } = size;
    const parts: Part[] = [top('top', [-w / 2, w / 2], [-d / 2, d / 2], h)];
    for (const s of [-1, 1]) {
      const x = s * (w / 2 - 0.12);
      parts.push(span('legs', [x - 0.035, x + 0.035], [0.03, h - 0.05], [-0.04, 0.03], { bevel: 0.006, plan: false }), span('legs', [x - 0.04, x + 0.04], [0, 0.035], [-d / 2 + 0.04, d / 2 - 0.04], { bevel: 0.01, plan: false }));
    }
    parts.push(span('legs', [-w / 2 + 0.12, w / 2 - 0.12], [h - 0.06, h - 0.03], [-0.04, 0.0], o), span('handle', [w / 2 - 0.26, w / 2 - 0.14], [h - 0.045, h - 0.022], [d / 2 - 0.05, d / 2 - 0.005], { bevel: 0.006, plan: false }));
    return keep(parts, size);
  },
});

const benchDesk = defineItem({
  ...desk,
  id: 'two-person-bench-desk',
  name: 'Two-person bench desk',
  tags: ['double desk', 'two person desk', 'bench desk', 'shared office', 'long desk'],
  description: 'A 2.4 m desk for two working side by side, with a slim fabric divider screen in the middle and a cable tray underneath.',
  defaultSize: { w: 2.4, d: 0.75, h: 0.75 },
  minSize: { w: 1.8, d: 0.6, h: 0.72 },
  maxSize: { w: 3.2, d: 0.9, h: 0.78 },
  slots: [matSlot('top', 'Top', 'wood-oak-light'), matSlot('legs', 'Frame', 'metal-white-powder'), matSlot('screen', 'Divider screen', 'felt-grey')],
  build: (size) => {
    const { w, d, h } = size;
    const parts: Part[] = [top('top', [-w / 2, w / 2], [-d / 2, d / 2], h)];
    for (const x of [-w / 2 + 0.05, 0, w / 2 - 0.05]) parts.push(span('legs', [x - 0.02, x + 0.02], [0, h - 0.025], [-d / 2 + 0.05, d / 2 - 0.05], { plan: false }));
    parts.push(span('legs', [-w / 2 + 0.1, w / 2 - 0.1], [h - 0.15, h - 0.12], [-d / 2 + 0.05, -d / 2 + 0.2], o), span('screen', [-0.012, 0.012], [h, h + 0.35], [-d / 2 + 0.03, d / 2 - 0.25], { bevel: 0.006, plan: false }));
    return keep(parts, size);
  },
});

const uDesk = defineItem({
  ...desk,
  id: 'u-shaped-desk',
  name: 'U-shaped desk',
  tags: ['u-shaped desk', 'u desk', 'workstation', 'executive', 'corner', 'bàn chữ u'],
  description: 'A U-shaped workstation wrapping round the chair: a long back run and two returns, in oak on black frames. Room for a multi-screen setup and paperwork.',
  defaultSize: { w: 2.0, d: 1.6, h: 0.75 },
  minSize: { w: 1.6, d: 1.2, h: 0.72 },
  maxSize: { w: 2.6, d: 2.0, h: 0.78 },
  slots: [matSlot('top', 'Top', 'wood-oak-natural'), matSlot('legs', 'Frame', 'metal-black-matte')],
  build: (size) => {
    const { w, d, h } = size;
    const r = 0.6;
    const parts: Part[] = [top('top', [-w / 2, w / 2], [-d / 2, -d / 2 + r], h), top('top', [-w / 2, -w / 2 + r], [-d / 2 + r, d / 2], h), top('top', [w / 2 - r, w / 2], [-d / 2 + r, d / 2], h)];
    for (const [x, z] of [
      [-w / 2 + 0.05, -d / 2 + 0.05],
      [w / 2 - 0.05, -d / 2 + 0.05],
      [-w / 2 + 0.05, d / 2 - 0.05],
      [w / 2 - 0.05, d / 2 - 0.05],
      [-w / 2 + r - 0.06, d / 2 - 0.05],
      [w / 2 - r + 0.06, d / 2 - 0.05],
    ])
      parts.push(span('legs', [x - 0.025, x + 0.025], [0, h - 0.025], [z - 0.025, z + 0.025], o));
    return keep(parts, size);
  },
});

const wallDesk = defineItem({
  ...desk,
  id: 'wall-mounted-desk',
  name: 'Wall-mounted fold-down desk',
  tags: ['wall desk', 'floating desk', 'fold down', 'murphy desk', 'small space', 'bàn treo tường'],
  description: 'A wall cabinet whose front folds down into a desk, with pigeonholes and a shelf inside: a workspace that disappears in a studio.',
  defaultSize: { w: 0.9, d: 0.5, h: 0.6 },
  minSize: { w: 0.6, d: 0.4, h: 0.45 },
  maxSize: { w: 1.2, d: 0.6, h: 0.8 },
  mount: 'wall',
  defaultElevation: 0.5,
  slots: [matSlot('body', 'Cabinet', 'paint-pure-white'), matSlot('top', 'Desk leaf', 'wood-oak-light'), matSlot('metal', 'Stays', 'metal-chrome')],
  build: (size) => {
    const { w, d, h } = size;
    const cd = 0.2;
    const leafY = 0.25;
    const z0 = -d / 2;
    const parts: Part[] = [
      span('body', [-w / 2, w / 2], [0, h], [z0, z0 + 0.012], o),
      span('body', [-w / 2, -w / 2 + 0.018], [0, h], [z0, z0 + cd], o),
      span('body', [w / 2 - 0.018, w / 2], [0, h], [z0, z0 + cd], o),
      span('body', [-w / 2, w / 2], [h - 0.018, h], [z0, z0 + cd], o),
      span('body', [-w / 2, w / 2], [leafY - 0.018, leafY], [z0, z0 + cd], o),
      span('body', [-w / 2 + 0.018, w / 2 - 0.018], [leafY + (h - leafY) * 0.5, leafY + (h - leafY) * 0.5 + 0.012], [z0, z0 + cd - 0.02], o),
      top('top', [-w / 2, w / 2], [z0 + cd, d / 2], leafY, 0.02),
      rod('metal', [-w / 2 + 0.03, leafY + 0.1, z0 + cd], [-w / 2 + 0.03, leafY - 0.005, z0 + cd + 0.18], 0.004, o),
      rod('metal', [w / 2 - 0.03, leafY + 0.1, z0 + cd], [w / 2 - 0.03, leafY - 0.005, z0 + cd + 0.18], 0.004, o),
    ];
    for (const x of cells(3, -w / 2 + 0.018, w / 2 - 0.018).slice(1)) parts.push(span('body', [x - 0.006 - (w - 0.036) / 6, x + 0.006 - (w - 0.036) / 6], [leafY, leafY + (h - leafY) * 0.5], [z0, z0 + cd - 0.02], o));
    return keep(parts, size);
  },
});

const ladderDesk = defineItem({
  ...desk,
  id: 'leaning-ladder-desk',
  name: 'Leaning ladder desk',
  tags: ['ladder desk', 'leaning desk', 'shelves', 'small space', 'desk'],
  description: 'A desk that leans against the wall like a ladder: a work surface with three shelves above it, all on two splayed side rails.',
  defaultSize: { w: 0.8, d: 0.55, h: 1.8 },
  minSize: { w: 0.6, d: 0.45, h: 1.5 },
  maxSize: { w: 1.1, d: 0.65, h: 2.1 },
  slots: [matSlot('wood', 'Rails & shelves', 'wood-walnut')],
  build: (size) => {
    const { w, d, h } = size;
    const zBase = d / 2 - 0.03;
    const zTop = -d / 2 + 0.03;
    const at = (y: number) => zBase + (zTop - zBase) * (y / h);
    const parts: Part[] = [];
    for (const s of [-1, 1]) parts.push(rod('wood', [s * (w / 2 - 0.02), 0, zBase], [s * (w / 2 - 0.02), h, zTop], 0.018, { plan: true }));
    const deskY = 0.74;
    parts.push(top('wood', [-w / 2 + 0.04, w / 2 - 0.04], [-d / 2, at(deskY)], deskY, 0.022));
    for (const y of [1.1, 1.4, h - 0.08]) parts.push(span('wood', [-w / 2 + 0.04, w / 2 - 0.04], [y - 0.018, y], [-d / 2, at(y)], o));
    return keep(parts, size);
  },
});

const deskSet = defineItem({
  ...desk,
  type: 'electronics',
  group: 'Computers',
  id: 'desk-essentials',
  name: 'Keyboard, mouse & notebook',
  tags: ['keyboard', 'mouse', 'notebook', 'pens', 'desk set', 'work'],
  description: 'The everyday things on a working desk: a slim keyboard, a mouse on a felt pad, an open notebook with a pen and a cup of pens.',
  defaultSize: { w: 0.7, d: 0.3, h: 0.11 },
  minSize: { w: 0.55, d: 0.24, h: 0.08 },
  maxSize: { w: 0.9, d: 0.38, h: 0.14 },
  defaultElevation: 0.75,
  slots: [matSlot('device', 'Keyboard & mouse', 'paint-pure-white'), matSlot('pad', 'Desk pad', 'felt-grey'), matSlot('paper', 'Notebook', 'paper-white'), matSlot('accent', 'Pens & cup', 'nylon-black')],
  build: (size) =>
    keep(
      [
        span('pad', [-0.2, 0.2], [0, 0.003], [-0.08, 0.1], { plan: true }),
        span('device', [-0.18, 0.1], [0.003, 0.02], [-0.05, 0.07], { bevel: 0.004, rotation: [0.05, 0, 0], plan: false }),
        sphere('device', [0.15, 0.015, 0.02], 0.03, { scale: [0.65, 0.45, 1], plan: false }),
        span('paper', [0.22, 0.34], [0, 0.008], [-0.1, 0.08], { rotation: [0, 0.15, 0], plan: false }),
        rod('accent', [0.25, 0.01, -0.02], [0.33, 0.01, 0.04], 0.003, o),
        cyl('accent', [-0.29, 0.05, -0.06], 0.035, 0.1, { segments: 16, plan: false }),
        ...range(3).map((i) => rod('accent', [-0.3 + i * 0.012, 0.08, -0.06], [-0.31 + i * 0.016, 0.11, -0.065], 0.003, o)),
      ],
      size,
    ),
});

// ───────────────────────── Chairs ─────────────────────────

/** Five-star swivel base with castors and a gas column up to `colTop`. */
function starBase(slot: string, R: number, colTop: number): Part[] {
  const parts: Part[] = [vcyl(slot, 0, 0, 0.09, colTop, 0.022, o), cyl(slot, [0, 0.085, 0], 0.04, 0.03, { segments: 16, plan: false })];
  for (const i of range(5)) {
    const a = (i / 5) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(a) * R;
    const z = Math.sin(a) * R;
    parts.push(rod(slot, [0, 0.085, 0], [x, 0.06, z], 0.016, o), sphere(slot, [x, 0.028, z], 0.028, o));
  }
  return parts;
}

/** Armrests: a post and a pad on each side. */
function arms(slot: string, x: number, y: number, z: V2): Part[] {
  const parts: Part[] = [];
  for (const s of [-1, 1]) parts.push(span(slot, sorted(s * x - 0.015, s * x + 0.015), [y - 0.2, y - 0.02], [-0.03, 0.0], o), span(slot, sorted(s * x - 0.035, s * x + 0.035), [y - 0.025, y], z, { bevel: 0.01, plan: false }));
  return parts;
}

const taskChair = defineItem({
  ...chair,
  id: 'fabric-task-chair',
  name: 'Fabric task chair',
  tags: ['task chair', 'office chair', 'desk chair', 'swivel', 'fabric', 'ghế xoay'],
  description: 'A mid-back swivel task chair with an upholstered seat and back, fixed armrests and a five-star base on castors; a compact everyday desk chair.',
  defaultSize: { w: 0.6, d: 0.6, h: 0.95 },
  minSize: { w: 0.52, d: 0.52, h: 0.85 },
  maxSize: { w: 0.68, d: 0.68, h: 1.05 },
  slots: [matSlot('upholstery', 'Upholstery', 'fabric-navy'), matSlot('frame', 'Frame & base', 'nylon-black')],
  build: (size) => {
    const { w, d, h } = size;
    const seatY = 0.47;
    return keep(
      [
        ...starBase('frame', Math.min(w, d) / 2 - 0.03, seatY - 0.08),
        span('frame', [-0.1, 0.1], [seatY - 0.1, seatY - 0.06], [-0.12, 0.1], { bevel: 0.008, plan: false }),
        span('upholstery', [-0.23, 0.23], [seatY - 0.07, seatY], [-0.2, 0.22], { bevel: 0.03 }),
        ...arms('frame', 0.25, seatY + 0.2, [-0.1, 0.1]),
        rod('frame', [0, seatY - 0.07, -0.15], [0, seatY + 0.12, -0.24], 0.018, o),
        { ...span('upholstery', [-0.21, 0.21], [seatY + 0.08, h - 0.02], [-0.03, 0.03], { bevel: 0.03, plan: false }), position: [0, (seatY + 0.08 + h - 0.02) / 2, -0.25], rotation: [-0.08, 0, 0] } as Part,
      ],
      size,
    );
  },
});

const execChair = defineItem({
  ...chair,
  id: 'leather-executive-chair',
  name: 'Leather executive chair',
  tags: ['executive chair', 'leather', 'high back', 'office chair', 'boss chair', 'ghế giám đốc'],
  description: 'A high-back executive chair in quilted leather with padded arms, a deep seat and a polished five-star base; for a study or a manager’s office.',
  defaultSize: { w: 0.7, d: 0.72, h: 1.2 },
  minSize: { w: 0.64, d: 0.66, h: 1.1 },
  maxSize: { w: 0.78, d: 0.8, h: 1.3 },
  slots: [matSlot('leather', 'Leather', 'leather-cognac'), matSlot('frame', 'Base & arms', 'metal-chrome')],
  build: (size) => {
    const { w, d, h } = size;
    const seatY = 0.5;
    const parts: Part[] = [
      ...starBase('frame', Math.min(w, d) / 2 - 0.03, seatY - 0.1),
      span('leather', [-0.27, 0.27], [seatY - 0.1, seatY], [-0.22, 0.26], { bevel: 0.045 }),
      { ...span('leather', [-0.26, 0.26], [seatY - 0.02, h - 0.02], [-0.06, 0.06], { bevel: 0.05, plan: false }), position: [0, (seatY - 0.02 + h - 0.02) / 2, -0.26], rotation: [-0.12, 0, 0] } as Part,
    ];
    for (const i of range(3)) parts.push(rodX('leather', -0.22, 0.22, seatY + 0.14 + i * 0.16, -0.2 + i * 0.02, 0.028, { segments: 12, plan: false }));
    for (const s of [-1, 1]) parts.push(rod('frame', [s * 0.29, seatY - 0.08, 0.12], [s * 0.3, seatY + 0.18, 0.06], 0.01, o), span('leather', sorted(s * 0.33, s * 0.25), [seatY + 0.16, seatY + 0.22], [-0.16, 0.14], { bevel: 0.025, plan: false }));
    return keep(parts, size);
  },
});

const draftingStool = defineItem({
  ...chair,
  id: 'drafting-stool',
  name: 'Drafting stool with foot ring',
  tags: ['drafting stool', 'tall chair', 'standing desk', 'counter height', 'stool', 'ghế cao'],
  description: 'A tall swivel stool with a low back and a chrome foot ring, for standing desks, drafting tables and kitchen counters.',
  defaultSize: { w: 0.55, d: 0.55, h: 1.05 },
  minSize: { w: 0.48, d: 0.48, h: 0.9 },
  maxSize: { w: 0.62, d: 0.62, h: 1.2 },
  slots: [matSlot('upholstery', 'Seat & back', 'leather-black'), matSlot('frame', 'Base & ring', 'metal-chrome')],
  build: (size) => {
    const { w, d, h } = size;
    const seatY = h - 0.32;
    return keep(
      [
        ...starBase('frame', Math.min(w, d) / 2 - 0.03, seatY - 0.06),
        torus('frame', [0, seatY * 0.45, 0], 0.2, 0.01, { rotation: [Math.PI / 2, 0, 0], plan: false }),
        ...range(3).map((i) => {
          const a = (i / 3) * Math.PI * 2;
          return rod('frame', [0, seatY * 0.45, 0], [Math.cos(a) * 0.2, seatY * 0.45, Math.sin(a) * 0.2], 0.006, o);
        }),
        cyl('upholstery', [0, seatY - 0.03, 0], 0.21, 0.07, { segments: 24 }),
        rod('frame', [0, seatY - 0.04, -0.14], [0, seatY + 0.15, -0.2], 0.015, o),
        { ...span('upholstery', [-0.18, 0.18], [h - 0.15, h - 0.01], [-0.025, 0.025], { bevel: 0.02, plan: false }), position: [0, h - 0.08, -0.21] } as Part,
      ],
      size,
    );
  },
});

const kneelingChair = defineItem({
  ...chair,
  id: 'kneeling-chair',
  name: 'Kneeling posture chair',
  tags: ['kneeling chair', 'ergonomic', 'posture', 'balans', 'office chair'],
  description: 'A rocking kneeling chair on a curved birch frame: you sit on the tilted seat with your shins on the lower pad, which keeps the back upright.',
  defaultSize: { w: 0.5, d: 0.75, h: 0.6 },
  minSize: { w: 0.45, d: 0.65, h: 0.5 },
  maxSize: { w: 0.55, d: 0.85, h: 0.7 },
  slots: [matSlot('wood', 'Frame', 'wood-oak-light'), matSlot('cushion', 'Cushions', 'fabric-velvet-green')],
  build: (size) => {
    const { w, d, h } = size;
    const parts: Part[] = [];
    for (const s of [-1, 1]) {
      const x = s * (w / 2 - 0.04);
      parts.push(rod('wood', [x, 0.02, -d / 2 + 0.05], [x, 0.02, d / 2 - 0.05], 0.018, { plan: true }), rod('wood', [x, 0.03, -d / 2 + 0.1], [x, h - 0.06, -0.05], 0.018, o), rod('wood', [x, 0.03, d / 2 - 0.12], [x, h * 0.55, d / 2 - 0.15], 0.016, o));
    }
    parts.push({ ...span('cushion', [-w / 2 + 0.02, w / 2 - 0.02], [-0.03, 0.03], [-0.17, 0.17], { bevel: 0.025 }), position: [0, h - 0.05, -0.08], rotation: [0.25, 0, 0] } as Part);
    parts.push({ ...span('cushion', [-w / 2 + 0.02, w / 2 - 0.02], [-0.03, 0.03], [-0.1, 0.1], { bevel: 0.025 }), position: [0, h * 0.55 + 0.02, d / 2 - 0.15], rotation: [0.5, 0, 0] } as Part);
    return keep(parts, size);
  },
});

const woodenChair = defineItem({
  ...chair,
  id: 'scandi-wooden-desk-chair',
  name: 'Scandinavian wooden desk chair',
  tags: ['wooden chair', 'desk chair', 'scandinavian', 'oak', 'no wheels', 'ghế gỗ'],
  description: 'A solid oak desk chair with a curved backrest and a woven paper-cord seat; no wheels, for a calm home workspace or a dining-room desk.',
  defaultSize: { w: 0.48, d: 0.52, h: 0.8 },
  minSize: { w: 0.44, d: 0.48, h: 0.75 },
  maxSize: { w: 0.54, d: 0.58, h: 0.88 },
  slots: [matSlot('wood', 'Wood', 'wood-oak-natural'), matSlot('seat', 'Seat', 'sisal-desk')],
  build: (size) => {
    const { w, d, h } = size;
    const seatY = 0.45;
    const parts: Part[] = [span('seat', [-w / 2 + 0.03, w / 2 - 0.03], [seatY - 0.03, seatY], [-d / 2 + 0.04, d / 2 - 0.03], { bevel: 0.008 })];
    for (const [x, z, y1] of [
      [-1, 1, seatY],
      [1, 1, seatY],
      [-1, -1, h - 0.05],
      [1, -1, h - 0.05],
    ] as [number, number, number][])
      parts.push(cyl('wood', [x * (w / 2 - 0.04), y1 / 2, z * (d / 2 - 0.05)], 0.016, y1, { rTop: 0.014, segments: 10, plan: false }));
    parts.push(torus('wood', [0, h - 0.07, -d / 2 + 0.12], 0.21, 0.018, { rotation: [Math.PI / 2, 0, 0], arc: Math.PI, scale: [1, 0.45, 1], plan: false }), rodX('wood', -w / 2 + 0.04, w / 2 - 0.04, 0.15, d / 2 - 0.05, 0.01, o));
    return keep(parts, size);
  },
});

const boucleSwivel = defineItem({
  ...chair,
  id: 'boucle-swivel-desk-chair',
  name: 'Bouclé swivel desk chair',
  tags: ['boucle chair', 'swivel chair', 'desk chair', 'home office', 'cosy', 'ghế xoay'],
  description: 'A soft bouclé tub chair on a brass swivel base with castors: the cosy desk chair for a bedroom or studio workspace.',
  defaultSize: { w: 0.6, d: 0.6, h: 0.8 },
  minSize: { w: 0.54, d: 0.54, h: 0.72 },
  maxSize: { w: 0.68, d: 0.68, h: 0.9 },
  slots: [matSlot('fabric', 'Bouclé', 'fabric-boucle'), matSlot('frame', 'Base', 'metal-brass')],
  build: (size) => {
    const { w, d } = size;
    const seatY = 0.46;
    return keep(
      [
        ...starBase('frame', Math.min(w, d) / 2 - 0.04, seatY - 0.08),
        cyl('fabric', [0, seatY - 0.04, 0.01], 0.25, 0.08, { segments: 28 }),
        torus('fabric', [0, seatY + 0.08, -0.01], 0.24, 0.06, { rotation: [Math.PI / 2, 0, Math.PI], arc: Math.PI * 1.3, scale: [1, 1, 2.2], plan: false }),
      ],
      size,
    );
  },
});

materials.push({ id: 'sisal-desk', name: 'Paper cord', category: 'fabric', color: '#cbb894', roughness: 1, pattern: { id: 'jute', scale: 0.04, contrast: 0.7 } });

const items: PackItem[] = [
  slimDesk,
  writingDesk,
  lDeskLeft,
  lDeskRight,
  lDeskPedestal,
  lDeskGaming,
  lDeskStanding,
  standingDesk,
  benchDesk,
  uDesk,
  wallDesk,
  ladderDesk,
  deskSet,
  taskChair,
  execChair,
  draftingStool,
  kneelingChair,
  woodenChair,
  boucleSwivel,
];

export default definePack({
  name: 'Workspace',
  version: '1.0.0',
  author: 'Neest',
  description: 'Desks (straight, L-shaped, U-shaped, standing, wall-mounted) and desk chairs, plus a desk set.',
  license: 'CC0-1.0',
  patterns,
  materials,
  items,
});

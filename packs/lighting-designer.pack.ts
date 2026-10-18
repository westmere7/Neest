/**
 * Designer lighting — detailed fixtures the other lighting sets don't have: rice-paper lanterns,
 * layered-shade and leaf pendants, a beehive glass pendant, a suspended LED profile, branching bulb,
 * crystal and wood-bead chandeliers, a factory enamel pendant, a schoolhouse semi-flush, a magnetic
 * track system; globe, shell and reading wall lights and a coach lantern; paper-column, studio
 * tripod, mushroom, RGB corner and globe-tree floor lamps; pleated, cordless, architect, glass-dome
 * and salt table lamps and RGB light bars; a bollard and solar stake path lights.
 *
 * Every fixture's light source sits where its glowing part is (spots for downlights and task heads,
 * points for globes, lanterns and shades), sized for a 2.7 m ceiling.
 */
import {
  clamp,
  cyl,
  defineItem,
  definePack,
  lathe,
  matSlot,
  prism,
  range,
  rod,
  span,
  sphere,
  torus,
  vcyl,
  type Part,
  type PackPattern,
  type V2,
  type V3,
} from '@/packs/kit';

const CEILING = 2.7;
const ceilingAt = (h: number) => CEILING - h - 0.01;
const WARM = '#ffd9a8';
const NEUTRAL = '#fff1de';
const o = { plan: false } as const;
const TAGS = ['lighting', 'lamp', 'đèn'];

/** Ceiling canopy: a shallow round cap at the top of the box. */
const canopy = (slot: string, top: number, r = 0.06): Part[] => [
  lathe(
    slot,
    [0, top - 0.032, 0],
    [
      [0, 0],
      [r * 0.4, 0],
      [r * 0.85, 0.012],
      [r, 0.028],
      [r, 0.032],
      [0, 0.032],
    ],
    { segments: 28 },
  ),
];
/** Cord from the canopy down to y. */
const cord = (slot: string, top: number, y: number, x = 0, z = 0): Part => vcyl(slot, x, z, y, top - 0.03, 0.0035, o);

/** Ellipsoid radius at height t∈[-1,1] for a lantern of radius R. */
const ell = (R: number, t: number) => R * Math.sqrt(Math.max(0, 1 - t * t));

// ───────────────────────── Pendants & chandeliers ─────────────────────────

const paperLantern = defineItem({
  id: 'rice-paper-lantern-pendant',
  name: 'Rice-paper lantern pendant',
  category: 'lighting',
  type: 'lighting',
  group: 'Ceiling lights',
  tags: [...TAGS, 'paper lantern', 'akari', 'japandi', 'washi', 'đèn lồng giấy'],
  description: 'A big oval washi-paper lantern on a fine bamboo-rib frame, hanging from a white cord: the soft, even glow of a Japandi room.',
  defaultSize: { w: 0.6, d: 0.6, h: 1.0 },
  minSize: { w: 0.35, d: 0.35, h: 0.6 },
  maxSize: { w: 1.0, d: 1.0, h: 1.6 },
  mount: 'ceiling',
  defaultElevation: ceilingAt(1.0),
  slots: [matSlot('light', 'Paper', 'washi-glow'), matSlot('frame', 'Ribs, cord & canopy', 'paint-pure-white')],
  light: { color: WARM, intensity: 0.9, distance: 5, y: 0.3 },
  build: ({ w, d, h }) => {
    const R = Math.min(w, d) / 2 - 0.01;
    const H = Math.min(R * 1.15, h * 0.42);
    const cy = H + 0.01;
    const prof: V2[] = range(13).map((i) => {
      const t = -1 + (2 * i) / 12;
      return [Math.max(0.01, ell(R, t) * (i === 0 || i === 12 ? 0.25 : 1)), cy + t * H * 0.98];
    });
    const parts: Part[] = [
      lathe('light', [0, 0, 0], [[0, cy - H * 0.98], ...prof, [0, cy + H * 0.98]], { segments: 36, plan: true }),
      ...canopy('frame', h),
      cord('frame', h, cy + H),
    ];
    // Bamboo ribs: fine rings around the paper.
    for (const i of range(11)) {
      const t = -0.9 + (1.8 * i) / 10;
      parts.push({ ...torus('frame', [0, 0, 0], ell(R, t) + 0.0015, 0.0012, o), position: [0, cy + t * H * 0.98, 0], rotation: [Math.PI / 2, 0, 0] } as Part);
    }
    for (const y of [cy - H * 0.9, cy + H * 0.9]) parts.push({ ...torus('frame', [0, 0, 0], R * 0.42, 0.003, o), position: [0, y, 0], rotation: [Math.PI / 2, 0, 0] } as Part);
    return parts;
  },
});

const layeredShade = defineItem({
  id: 'layered-shade-pendant',
  name: 'Three-layer shade pendant',
  category: 'lighting',
  type: 'lighting',
  group: 'Ceiling lights',
  tags: [...TAGS, 'layered shades', 'mid-century', 'danish', 'glare-free', 'dining pendant'],
  description: 'Three stacked painted shades that hide the bulb and bounce the light down and sideways, a Danish dining-table classic.',
  defaultSize: { w: 0.5, d: 0.5, h: 0.9 },
  minSize: { w: 0.3, d: 0.3, h: 0.5 },
  maxSize: { w: 0.7, d: 0.7, h: 1.6 },
  mount: 'ceiling',
  defaultElevation: ceilingAt(0.9),
  slots: [matSlot('shade', 'Shades', 'paint-pure-white'), matSlot('light', 'Glow under the shades', 'light-warm'), matSlot('metal', 'Frame & canopy', 'metal-chrome')],
  light: { color: WARM, intensity: 1.2, distance: 5, y: 0.14, kind: 'spot', angle: 1.0, penumbra: 0.7 },
  build: ({ w, d, h }) => {
    const R = Math.min(w, d) / 2;
    const shade = (r: number, y: number, k: number): Part =>
      lathe(
        'shade',
        [0, y, 0],
        [
          [r * 0.35, k * 0.42],
          [r * 0.6, k * 0.3],
          [r * 0.85, k * 0.12],
          [r, 0],
          [r * 0.985, -0.004],
          [r * 0.83, k * 0.11],
          [r * 0.58, k * 0.28],
          [r * 0.34, k * 0.4],
        ],
        { segments: 40 },
      );
    const parts: Part[] = [
      { ...shade(R, 0.04, R * 0.5), plan: true },
      shade(R * 0.72, 0.14, R * 0.42),
      shade(R * 0.46, 0.24, R * 0.32),
      sphere('light', [0, 0.12, 0], R * 0.16, { scale: [1, 0.7, 1], plan: false }),
      cyl('light', [0, 0.035, 0], R * 0.3, 0.004, { segments: 28, plan: false }),
      ...canopy('metal', h),
      cord('metal', h, 0.24 + R * 0.32 * 0.4),
    ];
    for (const k of range(3)) {
      const a = (k / 3) * Math.PI * 2;
      parts.push(rod('metal', [Math.cos(a) * R * 0.3, 0.06, Math.sin(a) * R * 0.3], [Math.cos(a) * R * 0.15, 0.3, Math.sin(a) * R * 0.15], 0.002, { segments: 6, plan: false }));
    }
    return parts;
  },
});

const artichoke = defineItem({
  id: 'leaf-artichoke-pendant',
  name: 'Leaf artichoke pendant',
  category: 'lighting',
  type: 'lighting',
  group: 'Ceiling lights',
  tags: [...TAGS, 'artichoke', 'leaves', 'copper', 'statement pendant', 'sculptural'],
  description: 'A sculptural pendant of 72 overlapping copper leaves in staggered rings around a glowing core — glare-free from every side.',
  defaultSize: { w: 0.6, d: 0.6, h: 1.1 },
  minSize: { w: 0.4, d: 0.4, h: 0.7 },
  maxSize: { w: 0.9, d: 0.9, h: 1.6 },
  mount: 'ceiling',
  defaultElevation: ceilingAt(1.1),
  slots: [matSlot('leaf', 'Leaves', 'metal-copper'), matSlot('light', 'Core glow', 'light-warm'), matSlot('metal', 'Frame, cord & canopy', 'metal-black-matte')],
  light: { color: WARM, intensity: 1.0, distance: 5, y: 0.3 },
  build: ({ w, d, h }) => {
    const R = Math.min(w, d) / 2 - 0.02;
    const H = Math.min(R * 1.3, h * 0.6);
    const parts: Part[] = [sphere('light', [0, H * 0.55, 0], R * 0.42, { scale: [1, 1.3, 1] }), ...canopy('metal', h), cord('metal', h, H)];
    const rows = 6;
    for (const r of range(rows)) {
      const t = r / (rows - 1); // 0 bottom … 1 top
      const y = H * (0.16 + t * 0.78);
      const rr = R * (0.45 + Math.sin(Math.PI * (0.2 + t * 0.7)) * 0.55);
      const n = 12;
      for (const k of range(n)) {
        const a = ((k + (r % 2) * 0.5) / n) * Math.PI * 2;
        parts.push({
          ...span('leaf', [-R * 0.17, R * 0.17], [-H * 0.11, H * 0.11], [-0.0012, 0.0012], o),
          position: [Math.cos(a) * rr, y, Math.sin(a) * rr],
          // Face outwards, tip down and out.
          rotation: [0, -a + Math.PI / 2, 0],
        } as Part);
        const last = parts[parts.length - 1];
        last.rotation = [0.55 - t * 0.25, -a + Math.PI / 2, 0];
      }
    }
    return parts;
  },
});

const beehive = defineItem({
  id: 'beehive-glass-pendant',
  name: 'Beehive glass pendant',
  category: 'lighting',
  type: 'lighting',
  group: 'Ceiling lights',
  tags: [...TAGS, 'beehive', 'amber glass', 'ribbed glass', 'kitchen island', 'pendant'],
  description: 'Stacked rings of amber glass form a beehive around a filament bulb, under a brass cap — good in a row over an island.',
  defaultSize: { w: 0.3, d: 0.3, h: 1.0 },
  minSize: { w: 0.2, d: 0.2, h: 0.5 },
  maxSize: { w: 0.45, d: 0.45, h: 1.6 },
  mount: 'ceiling',
  defaultElevation: ceilingAt(1.0),
  slots: [matSlot('glass', 'Glass rings', 'amber-glass-lamp'), matSlot('light', 'Filament bulb', 'filament-glow'), matSlot('metal', 'Cap, cord & canopy', 'brass-satin')],
  light: { color: '#ffc98a', intensity: 0.8, distance: 4, y: 0.16 },
  build: ({ w, d, h }) => {
    const R = Math.min(w, d) / 2 - 0.01;
    const H = Math.min(R * 2.1, h * 0.5);
    const n = 8;
    const parts: Part[] = [];
    for (const i of range(n)) {
      const t = (i + 0.5) / n;
      const r = R * (0.55 + 0.45 * Math.sin(Math.PI * (0.15 + t * 0.85)));
      parts.push({ ...torus('glass', [0, 0, 0], r - H / (n * 2), H / (n * 2), { plan: i === 2 }), position: [0, 0.01 + t * H, 0], rotation: [Math.PI / 2, 0, 0] } as Part);
    }
    parts.push(
      sphere('light', [0, H * 0.5, 0], R * 0.28, { scale: [1, 1.35, 1], plan: false }),
      lathe('metal', [0, H, 0], [[0, 0], [R * 0.6, 0], [R * 0.5, 0.03], [R * 0.2, 0.05], [0, 0.05]], { segments: 24, plan: false }),
      ...canopy('metal', h),
      cord('metal', h, H + 0.05),
    );
    return parts;
  },
});

const linearLed = defineItem({
  id: 'suspended-linear-led',
  name: 'Suspended linear LED profile',
  category: 'lighting',
  type: 'lighting',
  group: 'Ceiling lights',
  tags: [...TAGS, 'linear', 'led profile', 'office', 'dining table', 'minimal', 'đèn thả thanh'],
  description: 'A slim aluminium LED bar with an opal diffuser underneath and an up-light strip on top, hung on two steel wires — over a long table or desk.',
  defaultSize: { w: 1.2, d: 0.06, h: 0.8 },
  minSize: { w: 0.6, d: 0.04, h: 0.3 },
  maxSize: { w: 2.4, d: 0.1, h: 1.6 },
  mount: 'ceiling',
  defaultElevation: ceilingAt(0.8),
  slots: [matSlot('body', 'Profile', 'metal-black-matte'), matSlot('light', 'Diffuser', 'led-diffuser-warm'), matSlot('wire', 'Wires & canopies', 'metal-chrome')],
  light: {
    color: NEUTRAL,
    intensity: 0.7,
    distance: 4,
    y: 0.005,
    kind: 'spot',
    angle: 1.1,
    penumbra: 0.8,
    heads: [
      { x: -0.4, y: 0.005 },
      { x: 0, y: 0.005 },
      { x: 0.4, y: 0.005 },
    ],
  },
  build: ({ w, d, h }) => {
    const parts: Part[] = [
      span('body', [-w / 2, w / 2], [0.008, 0.05], [-d / 2, d / 2], { bevel: 0.004, plan: true }),
      span('light', [-w / 2 + 0.01, w / 2 - 0.01], [0.002, 0.009], [-d / 2 + 0.006, d / 2 - 0.006], { bevel: 0.002, plan: false }),
      span('light', [-w / 2 + 0.03, w / 2 - 0.03], [0.05, 0.053], [-d / 4, d / 4], o),
      span('body', [-w / 2, -w / 2 + 0.004], [0.008, 0.05], [-d / 2, d / 2], o),
      span('body', [w / 2 - 0.004, w / 2], [0.008, 0.05], [-d / 2, d / 2], o),
    ];
    for (const s of [-1, 1]) {
      const x = s * (w / 2 - 0.12);
      parts.push(vcyl('wire', x, 0, 0.05, h - 0.012, 0.0008, o), cyl('wire', [x, h - 0.006, 0], Math.min(0.025, d / 2), 0.012, { segments: 20, plan: false }), cyl('wire', [x, 0.058, 0], 0.005, 0.012, { segments: 10, plan: false }));
    }
    return parts;
  },
});

const branching = defineItem({
  id: 'branching-globe-chandelier',
  name: 'Branching globe chandelier',
  category: 'lighting',
  type: 'lighting',
  group: 'Ceiling lights',
  tags: [...TAGS, 'branching', 'bubble', 'globes', 'brass', 'chandelier', 'đèn chùm'],
  description: 'Brass branches that fork twice and end in twelve frosted globes of two sizes, like a blossoming tree, from a single canopy.',
  defaultSize: { w: 1.0, d: 0.8, h: 0.9 },
  minSize: { w: 0.7, d: 0.5, h: 0.6 },
  maxSize: { w: 1.6, d: 1.2, h: 1.6 },
  mount: 'ceiling',
  defaultElevation: ceilingAt(0.9),
  slots: [matSlot('metal', 'Branches & canopy', 'brass-satin'), matSlot('light', 'Globes', 'light-warm')],
  light: {
    color: WARM,
    intensity: 0.6,
    distance: 5,
    y: 0.3,
    heads: [
      { x: -0.35, y: 0.25, z: 0.1 },
      { x: 0.35, y: 0.25, z: -0.1 },
      { x: 0, y: 0.18, z: 0.25 },
    ],
  },
  build: ({ w, d, h }) => {
    const hubY = h * 0.42;
    const hub: V3 = [0, hubY, 0];
    const parts: Part[] = [...canopy('metal', h, 0.07), vcyl('metal', 0, 0, hubY, h - 0.03, 0.008, o), sphere('metal', hub, 0.025, o)];
    const sx = w / 2 - 0.08;
    const sz = d / 2 - 0.08;
    for (const k of range(4)) {
      const a = (k / 4) * Math.PI * 2 + 0.4;
      const mid: V3 = [Math.cos(a) * sx * 0.5, hubY - 0.05 + (k % 2) * 0.06, Math.sin(a) * sz * 0.5];
      parts.push(rod('metal', hub, mid, 0.006, { segments: 8, plan: false }), sphere('metal', mid, 0.012, o));
      for (const j of range(3)) {
        const b = a + (j - 1) * 0.55;
        const reach = 0.75 + (j % 2) * 0.25;
        const end: V3 = [Math.cos(b) * sx * reach, hubY - 0.2 + ((k + j) % 3) * 0.08, Math.sin(b) * sz * reach];
        const r = (k + j) % 2 ? 0.06 : 0.045;
        parts.push(rod('metal', mid, [end[0], end[1] + r, end[2]], 0.004, { segments: 6, plan: false }));
        parts.push(cyl('metal', [end[0], end[1] + r + 0.008, end[2]], 0.012, 0.016, { segments: 12, plan: false }), sphere('light', end, r));
      }
    }
    return parts;
  },
});

const crystal = defineItem({
  id: 'crystal-tier-chandelier',
  name: 'Three-tier crystal chandelier',
  category: 'lighting',
  type: 'lighting',
  group: 'Ceiling lights',
  tags: [...TAGS, 'crystal', 'chandelier', 'classic', 'tiers', 'candle bulbs', 'đèn chùm pha lê'],
  description: 'A classic chandelier: three chrome rings hung with faceted crystal drops, eight candle bulbs on the middle ring and a crystal finial.',
  defaultSize: { w: 0.7, d: 0.7, h: 0.9 },
  minSize: { w: 0.5, d: 0.5, h: 0.6 },
  maxSize: { w: 1.1, d: 1.1, h: 1.4 },
  mount: 'ceiling',
  defaultElevation: ceilingAt(0.9),
  slots: [matSlot('metal', 'Frame', 'metal-chrome'), matSlot('crystal', 'Crystals', 'crystal-glass'), matSlot('light', 'Candle bulbs', 'light-warm')],
  light: {
    color: WARM,
    intensity: 0.5,
    distance: 5,
    y: 0.45,
    heads: [
      { x: 0.22, y: 0.45 },
      { x: -0.11, y: 0.45, z: 0.19 },
      { x: -0.11, y: 0.45, z: -0.19 },
    ],
  },
  build: ({ w, d, h }) => {
    const R = Math.min(w, d) / 2 - 0.02;
    const parts: Part[] = [...canopy('metal', h, 0.07), vcyl('metal', 0, 0, h * 0.25, h - 0.03, 0.006, o)];
    const tiers: [number, number, number][] = [
      [R, h * 0.4, 20],
      [R * 0.68, h * 0.25, 14],
      [R * 0.38, h * 0.62, 10],
    ];
    for (const [i, [r, y, n]] of tiers.entries()) {
      parts.push({ ...torus('metal', [0, 0, 0], r, 0.004, { plan: i === 0 }), position: [0, y, 0], rotation: [Math.PI / 2, 0, 0] } as Part);
      for (const k of range(n)) {
        const a = (k / n) * Math.PI * 2;
        const len = 0.05 + (k % 2) * 0.025;
        parts.push(cyl('crystal', [Math.cos(a) * r, y - 0.012 - len / 2, Math.sin(a) * r], 0.012, len, { rTop: 0.004, segments: 6, plan: false }));
      }
      // Spokes to the stem.
      for (const k of range(4)) {
        const a = (k / 4) * Math.PI * 2 + 0.3;
        parts.push(rod('metal', [Math.cos(a) * r, y, Math.sin(a) * r], [0, y + 0.04, 0], 0.003, { segments: 6, plan: false }));
      }
    }
    // Candle bulbs on the outer ring.
    for (const k of range(8)) {
      const a = (k / 8) * Math.PI * 2;
      const x = Math.cos(a) * R * 0.92;
      const z = Math.sin(a) * R * 0.92;
      parts.push(cyl('metal', [x, h * 0.4 + 0.03, z], 0.012, 0.05, { segments: 12, plan: false }), sphere('light', [x, h * 0.4 + 0.075, z], 0.014, { scale: [1, 1.7, 1], plan: false }));
    }
    parts.push(cyl('crystal', [0, h * 0.18, 0], 0.03, 0.12, { rTop: 0.004, segments: 8, plan: false }), sphere('crystal', [0, h * 0.25, 0], 0.035, o));
    return parts;
  },
});

const woodBead = defineItem({
  id: 'wood-bead-chandelier',
  name: 'Wood bead chandelier',
  category: 'lighting',
  type: 'lighting',
  group: 'Ceiling lights',
  tags: [...TAGS, 'wood beads', 'boho', 'coastal', 'chandelier', 'natural'],
  description: 'Three draped tiers of natural wooden beads around a cluster of frosted bulbs on a black iron ring — a soft boho centrepiece.',
  defaultSize: { w: 0.6, d: 0.6, h: 0.8 },
  minSize: { w: 0.4, d: 0.4, h: 0.5 },
  maxSize: { w: 0.9, d: 0.9, h: 1.4 },
  mount: 'ceiling',
  defaultElevation: ceilingAt(0.8),
  slots: [matSlot('wood', 'Beads', 'wood-oak-light'), matSlot('metal', 'Ring, chains & canopy', 'metal-black-matte'), matSlot('light', 'Bulbs', 'light-warm')],
  light: { color: WARM, intensity: 0.9, distance: 5, y: 0.35 },
  build: ({ w, d, h }) => {
    const R = Math.min(w, d) / 2 - 0.02;
    const ringY = h * 0.6;
    const parts: Part[] = [...canopy('metal', h), { ...torus('metal', [0, 0, 0], R * 0.55, 0.006, { plan: true }), position: [0, ringY, 0], rotation: [Math.PI / 2, 0, 0] } as Part];
    for (const k of range(4)) {
      const a = (k / 4) * Math.PI * 2;
      parts.push(rod('metal', [Math.cos(a) * R * 0.55, ringY, Math.sin(a) * R * 0.55], [0, h - 0.03, 0], 0.002, { segments: 6, plan: false }));
    }
    // Beads hang in swags between 6 points on each tier.
    const tiers: [number, number][] = [
      [R, ringY - h * 0.14],
      [R * 0.8, ringY - h * 0.26],
      [R * 0.58, ringY - h * 0.38],
    ];
    for (const [r, y] of tiers) {
      const n = 26;
      for (const k of range(n)) {
        const a = (k / n) * Math.PI * 2;
        const sag = Math.abs(Math.sin(a * 3)) * h * 0.05;
        parts.push(sphere('wood', [Math.cos(a) * r, y - sag, Math.sin(a) * r], 0.011, o));
      }
    }
    for (const k of range(5)) {
      const a = (k / 5) * Math.PI * 2;
      const x = k === 4 ? 0 : Math.cos(a) * R * 0.25;
      const z = k === 4 ? 0 : Math.sin(a) * R * 0.25;
      parts.push(vcyl('metal', x, z, ringY - h * 0.16, ringY, 0.0025, o), sphere('light', [x, ringY - h * 0.16 - 0.04, z], 0.04, { scale: [1, 1.15, 1], plan: false }));
    }
    return parts;
  },
});

const factory = defineItem({
  id: 'factory-enamel-pendant',
  name: 'Factory enamel pendant',
  category: 'lighting',
  type: 'lighting',
  group: 'Ceiling lights',
  tags: [...TAGS, 'industrial', 'enamel', 'factory', 'dome', 'kitchen', 'cafe'],
  description: 'A deep enamel dome, glossy green outside and white inside, with a ribbed socket and a fabric cord; the filament bulb peeks out below the rim.',
  defaultSize: { w: 0.4, d: 0.4, h: 0.9 },
  minSize: { w: 0.25, d: 0.25, h: 0.5 },
  maxSize: { w: 0.6, d: 0.6, h: 1.6 },
  mount: 'ceiling',
  defaultElevation: ceilingAt(0.9),
  slots: [matSlot('enamel', 'Enamel shade', 'enamel-green'), matSlot('inside', 'Inside & socket', 'paint-pure-white'), matSlot('light', 'Filament bulb', 'filament-glow'), matSlot('metal', 'Cord & canopy', 'metal-black-matte')],
  variants: [
    { id: 'black', name: 'Black', materials: { enamel: 'metal-black-matte' } },
    { id: 'white', name: 'White', materials: { enamel: 'paint-pure-white' } },
    { id: 'red', name: 'Signal red', materials: { enamel: 'enamel-red' } },
  ],
  light: { color: '#ffcf96', intensity: 1.1, distance: 5, y: 0.05, kind: 'spot', angle: 0.9, penumbra: 0.6 },
  build: ({ w, d, h }) => {
    const R = Math.min(w, d) / 2;
    const H = R * 0.75;
    const prof: V2[] = [
      [R, 0.03],
      [R * 0.97, 0.045],
      [R * 0.82, 0.03 + H * 0.35],
      [R * 0.55, 0.03 + H * 0.7],
      [R * 0.25, 0.03 + H * 0.92],
      [R * 0.12, 0.03 + H],
    ];
    return [
      lathe('enamel', [0, 0, 0], prof, { segments: 36, plan: true }),
      lathe('inside', [0, 0, 0], prof.map(([r, y]) => [Math.max(0.005, r - 0.003), y - 0.002] as V2), { segments: 36, plan: false }),
      { ...torus('enamel', [0, 0, 0], R - 0.004, 0.005, o), position: [0, 0.035, 0], rotation: [Math.PI / 2, 0, 0] } as Part,
      cyl('inside', [0, 0.03 + H + 0.03, 0], R * 0.13, 0.07, { rTop: R * 0.1, segments: 16, plan: false }),
      ...range(3).map((k) => ({ ...torus('inside', [0, 0, 0], R * 0.135, 0.0025, o), position: [0, 0.03 + H + 0.015 + k * 0.02, 0], rotation: [Math.PI / 2, 0, 0] }) as Part),
      sphere('light', [0, 0.03 + H * 0.35, 0], R * 0.22, { scale: [1, 1.3, 1], plan: false }),
      ...canopy('metal', h),
      cord('metal', h, 0.03 + H + 0.065),
    ];
  },
});

const schoolhouse = defineItem({
  id: 'schoolhouse-semi-flush',
  name: 'Schoolhouse semi-flush light',
  category: 'lighting',
  type: 'lighting',
  group: 'Ceiling lights',
  tags: [...TAGS, 'schoolhouse', 'semi-flush', 'opal glass', 'hallway', 'low ceiling'],
  description: 'A classic opal-glass schoolhouse shade on a short brass fitter, close to the ceiling for hallways and low rooms.',
  defaultSize: { w: 0.32, d: 0.32, h: 0.32 },
  minSize: { w: 0.22, d: 0.22, h: 0.24 },
  maxSize: { w: 0.45, d: 0.45, h: 0.45 },
  mount: 'ceiling',
  defaultElevation: ceilingAt(0.32),
  slots: [matSlot('light', 'Opal glass', 'light-warm'), matSlot('metal', 'Fitter & canopy', 'brass-satin')],
  light: { color: WARM, intensity: 0.9, distance: 5, y: 0.12 },
  build: ({ w, d, h }) => {
    const R = Math.min(w, d) / 2 - 0.005;
    const gh = h * 0.62;
    return [
      lathe(
        'light',
        [0, 0, 0],
        [
          [0, 0],
          [R * 0.35, 0],
          [R * 0.8, gh * 0.12],
          [R, gh * 0.4],
          [R * 0.92, gh * 0.72],
          [R * 0.55, gh * 0.95],
          [R * 0.5, gh],
          [0, gh],
        ],
        { segments: 36, plan: true },
      ),
      { ...torus('metal', [0, 0, 0], R * 0.52, 0.006, o), position: [0, gh, 0], rotation: [Math.PI / 2, 0, 0] } as Part,
      cyl('metal', [0, gh + 0.03, 0], R * 0.55, 0.05, { rTop: R * 0.3, segments: 28, plan: false }),
      vcyl('metal', 0, 0, gh + 0.05, h - 0.03, 0.012, o),
      ...canopy('metal', h, Math.min(0.07, R * 0.7)),
    ];
  },
});

const magneticTrack = defineItem({
  id: 'magnetic-track-system',
  name: 'Magnetic track system',
  category: 'lighting',
  type: 'lighting',
  group: 'Ceiling lights',
  tags: [...TAGS, 'magnetic track', 'track light', 'spotlights', 'linear module', 'modern', 'đèn ray nam châm'],
  description: 'A slim black surface-mounted track with three magnetic modules: two adjustable spots and a linear opal bar between them.',
  defaultSize: { w: 2.0, d: 0.06, h: 0.17 },
  minSize: { w: 1.0, d: 0.05, h: 0.17 },
  maxSize: { w: 4.0, d: 0.08, h: 0.24 },
  mount: 'ceiling',
  defaultElevation: ceilingAt(0.17),
  slots: [matSlot('body', 'Track & modules', 'metal-black-matte'), matSlot('light', 'Lenses & diffuser', 'led-diffuser-warm')],
  light: {
    color: NEUTRAL,
    intensity: 1.0,
    distance: 5,
    y: 0.04,
    kind: 'spot',
    angle: 0.45,
    penumbra: 0.5,
    heads: [
      { x: -0.7, y: 0.03, dir: [0.25, -1, 0.2] },
      { x: 0.7, y: 0.03, dir: [-0.25, -1, 0.2] },
      { x: 0, y: 0.1 },
    ],
  },
  build: ({ w, d, h }) => {
    const parts: Part[] = [span('body', [-w / 2, w / 2], [h - 0.045, h], [-d / 2, d / 2], { bevel: 0.003, plan: true })];
    // Linear module in the track.
    parts.push(span('body', [-0.3, 0.3], [h - 0.07, h - 0.045], [-d / 2 + 0.008, d / 2 - 0.008], o), span('light', [-0.29, 0.29], [h - 0.073, h - 0.07], [-d / 2 + 0.012, d / 2 - 0.012], o));
    for (const s of [-1, 1]) {
      const x = s * Math.min(0.7, w / 2 - 0.1);
      parts.push(cyl('body', [x, h - 0.055, 0], 0.012, 0.02, { segments: 12, plan: false }));
      parts.push({ ...cyl('body', [0, 0, 0], 0.026, 0.09, { segments: 20, plan: false }), position: [x, h - 0.11, 0], rotation: [0.2, 0, -s * 0.25] } as Part);
      parts.push({ ...cyl('light', [0, 0, 0], 0.02, 0.003, { segments: 20, plan: false }), position: [x + s * 0.011, h - 0.155, 0.009], rotation: [0.2, 0, -s * 0.25] } as Part);
    }
    return parts;
  },
});

// ───────────────────────── Wall lights ─────────────────────────

const globeSconce = defineItem({
  id: 'globe-wall-sconce',
  name: 'Globe wall sconce',
  category: 'lighting',
  type: 'lighting',
  group: 'Wall lights',
  tags: [...TAGS, 'globe', 'sconce', 'brass', 'bedside', 'opal', 'đèn tường'],
  description: 'A round brass backplate and a short arm holding an opal glass globe: beside a bed or a mirror.',
  defaultSize: { w: 0.18, d: 0.24, h: 0.26 },
  minSize: { w: 0.14, d: 0.18, h: 0.2 },
  maxSize: { w: 0.3, d: 0.34, h: 0.4 },
  mount: 'wall',
  defaultElevation: 1.6,
  slots: [matSlot('metal', 'Backplate & arm', 'brass-satin'), matSlot('light', 'Globe', 'light-warm')],
  light: { color: WARM, intensity: 0.5, distance: 3, y: 0.08, z: 0.04 },
  build: ({ w, d, h }) => {
    const z0 = -d / 2;
    const pr = Math.min(0.05, w / 2);
    const ya = h - pr - 0.005;
    const r = Math.max(0.03, Math.min(w / 2 - 0.005, (ya - 0.05) / 2, (d - 0.03) / 2));
    const gz = d / 2 - r - 0.002;
    return [
      { ...cyl('metal', [0, 0, 0], pr, 0.014, { segments: 28, plan: true }), position: [0, ya, z0 + 0.007], rotation: [Math.PI / 2, 0, 0] } as Part,
      rod('metal', [0, ya, z0 + 0.012], [0, ya, gz], 0.008, { segments: 12, plan: false }),
      vcyl('metal', 0, gz, 2 * r + 0.01, ya, 0.006, o),
      cyl('metal', [0, 2 * r + 0.02, gz], 0.02, 0.03, { segments: 16, plan: false }),
      sphere('light', [0, r + 0.006, gz], r, o),
    ];
  },
});

const shellSconce = defineItem({
  id: 'shell-uplight-sconce',
  name: 'Alabaster shell uplight',
  category: 'lighting',
  type: 'lighting',
  group: 'Wall lights',
  tags: [...TAGS, 'uplighter', 'alabaster', 'shell', 'half bowl', 'sconce', 'hallway'],
  description: 'A half-bowl of veined alabaster-look glass that washes the wall upwards — calm light for hallways and living rooms.',
  defaultSize: { w: 0.36, d: 0.18, h: 0.16 },
  minSize: { w: 0.24, d: 0.12, h: 0.1 },
  maxSize: { w: 0.5, d: 0.25, h: 0.24 },
  mount: 'wall',
  defaultElevation: 1.8,
  slots: [matSlot('light', 'Alabaster bowl', 'alabaster-glow'), matSlot('metal', 'Wall plate', 'brass-satin')],
  light: { color: WARM, intensity: 0.7, distance: 3, y: 0.12, z: -0.02, kind: 'spot', dir: [0, 1, 0.15], angle: 1.0, penumbra: 0.8 },
  build: ({ w, d, h }) => {
    const z0 = -d / 2;
    const parts: Part[] = [span('metal', [-0.04, 0.04], [h * 0.25, h * 0.75], [z0, z0 + 0.008], { bevel: 0.002, plan: false })];
    // Half bowl from stacked half-disc slices, widening towards the top.
    const n = 7;
    for (const i of range(n)) {
      const t = (i + 1) / n;
      const rx = (w / 2) * (0.35 + 0.65 * Math.sqrt(t));
      const rz = (d - 0.01) * (0.35 + 0.65 * Math.sqrt(t));
      const outline: V2[] = range(13).map((k) => {
        const a = (k / 12) * Math.PI;
        return [Math.cos(a) * rx, z0 + 0.008 + Math.sin(a) * rz];
      });
      parts.push(prism('light', outline, (h * i) / n, h / n + 0.0005, { plan: i === n - 1 }));
    }
    return parts;
  },
});

const readingWall = defineItem({
  id: 'flexible-wall-reading-light',
  name: 'Flexible wall reading light',
  category: 'lighting',
  type: 'lighting',
  group: 'Wall lights',
  tags: [...TAGS, 'reading light', 'bedside', 'gooseneck', 'usb', 'hotel'],
  description: 'A hotel-style bedside reading light: round wall plate with a switch, a flexible gooseneck and a small LED head aiming at the pillow.',
  defaultSize: { w: 0.12, d: 0.32, h: 0.34 },
  minSize: { w: 0.1, d: 0.24, h: 0.26 },
  maxSize: { w: 0.16, d: 0.4, h: 0.44 },
  mount: 'wall',
  defaultElevation: 1.0,
  slots: [matSlot('body', 'Plate, neck & head', 'metal-black-matte'), matSlot('light', 'LED lens', 'led-diffuser-warm')],
  light: { color: NEUTRAL, intensity: 0.6, distance: 2.5, y: 0.27, z: 0.12, kind: 'spot', dir: [0, -0.7, 0.7], angle: 0.4, penumbra: 0.5 },
  build: ({ w, d, h }) => {
    const z0 = -d / 2;
    const parts: Part[] = [{ ...cyl('body', [0, 0, 0], Math.min(0.05, w / 2), 0.02, { segments: 24, plan: true }), position: [0, 0.07, z0 + 0.01], rotation: [Math.PI / 2, 0, 0] } as Part, { ...cyl('light', [0, 0, 0], 0.008, 0.003, { segments: 12, plan: false }), position: [0.02, 0.07, z0 + 0.021], rotation: [Math.PI / 2, 0, 0] } as Part];
    // Gooseneck: short segments along a curve up and forward.
    const pts: V3[] = range(9).map((i) => {
      const t = i / 8;
      return [0, 0.09 + Math.sin(t * Math.PI * 0.6) * (h - 0.16), z0 + 0.02 + t * (d - 0.1)];
    });
    for (const i of range(8)) parts.push(rod('body', pts[i], pts[i + 1], 0.006, { segments: 8, plan: false }));
    const tip = pts[8];
    parts.push({ ...cyl('body', [0, 0, 0], 0.024, 0.06, { rTop: 0.016, segments: 16, plan: false }), position: [0, tip[1] - 0.01, tip[2] + 0.02], rotation: [-Math.PI / 4, 0, 0] } as Part);
    parts.push({ ...cyl('light', [0, 0, 0], 0.021, 0.003, { segments: 16, plan: false }), position: [0, tip[1] - 0.031, tip[2] + 0.041], rotation: [-Math.PI / 4, 0, 0] } as Part);
    return parts;
  },
});

const coachLantern = defineItem({
  id: 'coach-wall-lantern',
  name: 'Coach wall lantern',
  category: 'outdoor',
  type: 'lighting',
  group: 'Outdoor & string lights',
  tags: [...TAGS, 'outdoor', 'lantern', 'coach light', 'entrance', 'porch', 'balcony'],
  description: 'A black coach lantern with clear glass panes, a candle bulb and a scrolled wall bracket, for a front door, porch or balcony.',
  defaultSize: { w: 0.2, d: 0.26, h: 0.42 },
  minSize: { w: 0.15, d: 0.2, h: 0.3 },
  maxSize: { w: 0.3, d: 0.36, h: 0.6 },
  mount: 'wall',
  defaultElevation: 1.8,
  slots: [matSlot('metal', 'Lantern frame', 'metal-black-matte'), matSlot('glass', 'Glass panes', 'glass-clear'), matSlot('light', 'Candle bulb', 'filament-glow')],
  light: { color: '#ffcf96', intensity: 0.7, distance: 4, y: 0.2, z: 0.03 },
  build: ({ w, d, h }) => {
    const z0 = -d / 2;
    const s = Math.min(w, d - 0.08) / 2 - 0.005;
    const cz = d / 2 - s - 0.005;
    const y0 = Math.max(h * 0.12, 0.05);
    const y1 = h - 0.11;
    const parts: Part[] = [
      span('metal', [-0.04, 0.04], [h * 0.3, h * 0.7], [z0, z0 + 0.012], { bevel: 0.003, plan: true }),
      rod('metal', [0, h * 0.62, z0 + 0.01], [0, h * 0.62, cz], 0.006, { segments: 8, plan: false }),
      { ...torus('metal', [0, 0, 0], 0.035, 0.004, { arc: Math.PI, plan: false }), position: [0, h * 0.55, z0 + 0.05], rotation: [0, Math.PI / 2, 0] } as Part,
      span('metal', [-s, s], [y0 - 0.02, y0], [cz - s, cz + s], { bevel: 0.003, plan: false }),
      cyl('metal', [0, y0 - 0.025, cz], s * 0.35, 0.03, { rTop: s * 0.68, segments: 4, rotation: [0, Math.PI / 4, 0], plan: false }),
      cyl('metal', [0, h - 0.07, cz], s * 0.72, 0.08, { rTop: 0.006, segments: 4, rotation: [0, Math.PI / 4, 0], plan: false }),
      cyl('metal', [0, h - 0.017, cz], s * 0.3, 0.03, { segments: 12, plan: false }),
      vcyl('light', 0, cz, y0, y0 + 0.07, 0.012, o),
      sphere('light', [0, y0 + 0.1, cz], 0.016, { scale: [1, 1.8, 1], plan: false }),
    ];
    for (const [x, z] of [
      [-s, cz - s],
      [s, cz - s],
      [-s, cz + s],
      [s, cz + s],
    ])
      parts.push(vcyl('metal', x, z, y0, y1, 0.005, o));
    for (const [sx, sz] of [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ])
      parts.push(span('glass', sx ? [sx * s - 0.001, sx * s + 0.001] : [-s, s], [y0, y1], sz ? [cz + sz * s - 0.001, cz + sz * s + 0.001] : [cz - s, cz + s], o));
    return parts;
  },
});

// ───────────────────────── Floor lamps ─────────────────────────

const paperColumn = defineItem({
  id: 'paper-column-floor-lamp',
  name: 'Paper column floor lamp',
  category: 'lighting',
  type: 'lighting',
  group: 'Floor lamps',
  tags: [...TAGS, 'paper', 'akari', 'column', 'japandi', 'floor lamp', 'đèn cây giấy'],
  description: 'A tall washi-paper column on slim black legs, glowing evenly from top to bottom — a soft light sculpture for a corner.',
  defaultSize: { w: 0.3, d: 0.3, h: 1.4 },
  minSize: { w: 0.2, d: 0.2, h: 0.8 },
  maxSize: { w: 0.45, d: 0.45, h: 1.9 },
  slots: [matSlot('light', 'Paper', 'washi-glow'), matSlot('frame', 'Legs & ribs', 'metal-black-matte')],
  light: { color: WARM, intensity: 0.9, distance: 4, y: 0.75 },
  build: ({ w, d, h }) => {
    const R = Math.min(w, d) / 2 - 0.01;
    const y0 = 0.1;
    const parts: Part[] = [cyl('light', [0, y0 + (h - y0) / 2, 0], R * 0.95, h - y0 - 0.01, { rTop: R * 0.85, segments: 32, plan: true })];
    const n = clamp(Math.round((h - y0) / 0.05), 8, 30);
    for (const i of range(n)) {
      const t = (i + 0.5) / n;
      const r = R * (0.95 - 0.1 * t) + 0.0015;
      parts.push({ ...torus('frame', [0, 0, 0], r, 0.001, o), position: [0, y0 + t * (h - y0 - 0.01), 0], rotation: [Math.PI / 2, 0, 0] } as Part);
    }
    for (const k of range(3)) {
      const a = (k / 3) * Math.PI * 2;
      parts.push(rod('frame', [Math.cos(a) * R * 0.5, y0 + 0.02, Math.sin(a) * R * 0.5], [Math.cos(a) * R * 0.95, 0, Math.sin(a) * R * 0.95], 0.006, { segments: 8, plan: false }));
    }
    return parts;
  },
});

const studioTripod = defineItem({
  id: 'studio-tripod-floor-lamp',
  name: 'Studio tripod floor lamp',
  category: 'lighting',
  type: 'lighting',
  group: 'Floor lamps',
  tags: [...TAGS, 'tripod', 'studio light', 'film light', 'spotlight', 'industrial', 'floor lamp'],
  description: 'A film-set spotlight on a wooden tripod: a drum head with a front lens, cooling ribs and side handles, tilted to bounce light off a wall.',
  defaultSize: { w: 0.75, d: 0.75, h: 1.55 },
  minSize: { w: 0.55, d: 0.55, h: 1.2 },
  maxSize: { w: 0.95, d: 0.95, h: 1.9 },
  slots: [matSlot('wood', 'Tripod legs', 'wood-walnut'), matSlot('metal', 'Head & fittings', 'metal-black-matte'), matSlot('light', 'Lens', 'light-warm'), matSlot('chrome', 'Rims & handles', 'metal-chrome')],
  light: { color: WARM, intensity: 1.6, distance: 6, y: 1.36, z: 0.2, kind: 'spot', dir: [0, -0.35, 1], angle: 0.5, penumbra: 0.5 },
  build: ({ w, d, h }) => {
    const R = 0.14;
    const hy = h - R - 0.05;
    const top = hy - 0.13;
    const parts: Part[] = [];
    for (const k of range(3)) {
      const a = (k / 3) * Math.PI * 2 + Math.PI / 2;
      parts.push(rod('wood', [0, top - 0.05, 0], [Math.cos(a) * (w / 2 - 0.03), 0, Math.sin(a) * (d / 2 - 0.03)], 0.014, { segments: 10, plan: k === 0 }), cyl('metal', [Math.cos(a) * (w / 2 - 0.03), 0.01, Math.sin(a) * (d / 2 - 0.03)], 0.016, 0.02, { segments: 10, plan: true }));
    }
    parts.push(cyl('chrome', [0, top - 0.02, 0], 0.03, 0.08, { segments: 14, plan: false }), vcyl('chrome', 0, 0, top, top + 0.06, 0.01, o));
    // Yoke and tilted drum head.
    parts.push({ ...torus('metal', [0, 0, 0], R + 0.03, 0.007, { arc: Math.PI, plan: false }), position: [0, hy, 0], rotation: [0, 0, Math.PI] } as Part);
    const tilt = -0.35;
    const head = (slot: string, r: number, len: number, dz: number, segs = 32): Part => ({ ...cyl(slot, [0, 0, 0], r, len, { segments: segs, plan: false }), position: [0, hy + Math.sin(-tilt) * dz, Math.cos(tilt) * dz], rotation: [Math.PI / 2 + tilt, 0, 0] }) as Part;
    parts.push(head('metal', R, 0.22, 0), head('chrome', R + 0.008, 0.015, 0.11), head('light', R - 0.01, 0.004, 0.118), head('metal', R * 0.7, 0.05, -0.13));
    for (const i of range(5)) parts.push(head('metal', R + 0.006, 0.006, -0.08 + i * 0.03));
    for (const s of [-1, 1]) parts.push(cyl('chrome', [s * (R + 0.02), hy, 0], 0.012, 0.02, { rotation: [0, 0, Math.PI / 2], segments: 12, plan: false }));
    return parts;
  },
});

const mushroomFloor = defineItem({
  id: 'mushroom-dome-floor-lamp',
  name: 'Mushroom dome floor lamp',
  category: 'lighting',
  type: 'lighting',
  group: 'Floor lamps',
  tags: [...TAGS, 'mushroom', 'dome', 'trumpet base', 'space age', 'floor lamp', 'opal'],
  description: 'A space-age floor lamp: a wide opal dome on a slim trumpet stem, glowing softly from its underside.',
  defaultSize: { w: 0.5, d: 0.5, h: 1.3 },
  minSize: { w: 0.35, d: 0.35, h: 0.9 },
  maxSize: { w: 0.7, d: 0.7, h: 1.6 },
  slots: [matSlot('shade', 'Dome', 'paint-pure-white'), matSlot('light', 'Glow under the dome', 'light-warm'), matSlot('base', 'Stem & base', 'paint-pure-white')],
  variants: [
    { id: 'blush', name: 'Blush', materials: { shade: 'paint-blush', base: 'paint-blush' } },
    { id: 'chrome', name: 'Chrome', materials: { shade: 'metal-chrome', base: 'metal-chrome' } },
    { id: 'sage', name: 'Sage', materials: { shade: 'paint-sage', base: 'paint-sage' } },
  ],
  light: { color: WARM, intensity: 1.0, distance: 4, y: 1.08, kind: 'spot', angle: 1.1, penumbra: 0.9 },
  build: ({ w, d, h }) => {
    const R = Math.min(w, d) / 2;
    const dh = R * 0.5;
    const y = h - dh;
    return [
      lathe(
        'base',
        [0, 0, 0],
        [
          [0, 0],
          [R * 0.6, 0],
          [R * 0.55, 0.02],
          [R * 0.12, 0.12],
          [0.016, 0.35],
          [0.014, y],
          [0, y],
        ],
        { segments: 32, plan: true },
      ),
      lathe(
        'shade',
        [0, y, 0],
        [
          [R * 0.06, 0.02],
          [R, 0],
          [R * 0.96, dh * 0.3],
          [R * 0.75, dh * 0.75],
          [R * 0.35, dh * 0.98],
          [0, dh],
        ],
        { segments: 40, plan: false },
      ),
      cyl('light', [0, y + 0.004, 0], R * 0.9, 0.004, { segments: 36, plan: false }),
    ];
  },
});

const rgbCorner = defineItem({
  id: 'rgb-corner-floor-lamp',
  name: 'RGB corner floor lamp',
  category: 'lighting',
  type: 'lighting',
  group: 'Floor lamps',
  tags: [...TAGS, 'rgb', 'led', 'corner lamp', 'gaming', 'mood light', 'smart'],
  description: 'A slim LED stick on a round base that floods a corner with colour — a gaming or mood light (the glow colour is its light material).',
  defaultSize: { w: 0.24, d: 0.24, h: 1.45 },
  minSize: { w: 0.18, d: 0.18, h: 1.0 },
  maxSize: { w: 0.3, d: 0.3, h: 1.7 },
  slots: [matSlot('body', 'Stick & base', 'metal-black-matte'), matSlot('light', 'LED glow', 'rgb-glow')],
  variants: [
    { id: 'cyan', name: 'Cyan', materials: { light: 'rgb-glow-cyan' } },
    { id: 'warm', name: 'Warm white', materials: { light: 'light-warm' } },
  ],
  light: { color: '#b07cff', intensity: 0.9, distance: 3, y: 0.8, z: -0.03 },
  build: ({ w, d, h }) => {
    const R = Math.min(w, d) / 2;
    return [
      cyl('body', [0, 0.012, 0], R, 0.024, { rTop: R * 0.95, segments: 32, plan: true }),
      span('body', [-0.02, 0.02], [0.024, h - 0.01], [-0.012, 0.012], { bevel: 0.006, plan: false }),
      span('light', [-0.016, 0.016], [0.06, h - 0.03], [-0.016, -0.011], { bevel: 0.002, plan: false }),
      span('body', [-0.012, 0.012], [0.1, 0.12], [0.011, 0.014], o),
    ];
  },
});

const globeTree = defineItem({
  id: 'globe-tree-floor-lamp',
  name: 'Three-globe tree floor lamp',
  category: 'lighting',
  type: 'lighting',
  group: 'Floor lamps',
  tags: [...TAGS, 'globes', 'tree lamp', 'brass', 'opal', 'mid-century', 'floor lamp'],
  description: 'Three opal globes on brass branches at different heights, rising from a heavy marble base.',
  defaultSize: { w: 0.5, d: 0.5, h: 1.6 },
  minSize: { w: 0.4, d: 0.4, h: 1.2 },
  maxSize: { w: 0.7, d: 0.7, h: 1.9 },
  slots: [matSlot('metal', 'Stem & branches', 'brass-satin'), matSlot('light', 'Globes', 'light-warm'), matSlot('base', 'Base', 'stone-marble-carrara')],
  light: {
    color: WARM,
    intensity: 0.5,
    distance: 4,
    y: 1.45,
    heads: [
      { x: 0.12, y: 1.5 },
      { x: -0.13, y: 1.32, z: 0.05 },
      { x: 0.02, y: 1.13, z: -0.15 },
    ],
  },
  build: ({ w, d, h }) => {
    const R = Math.min(w, d) / 2;
    const g = Math.min(0.09, R * 0.36);
    const parts: Part[] = [cyl('base', [0, 0.02, 0], Math.min(0.15, R), 0.04, { segments: 32, plan: true }), vcyl('metal', 0, 0, 0.04, h * 0.7, 0.01, o)];
    const tips: V3[] = [
      [R - g - 0.01, h - g - 0.01, 0],
      [-(R - g - 0.01), h * 0.82, 0.05],
      [0.02, h * 0.7, -(R - g - 0.01)],
    ];
    for (const tip of tips) {
      const s: V3 = [0, h * 0.62, 0];
      parts.push(rod('metal', s, [tip[0], tip[1] - g, tip[2]], 0.006, { segments: 8, plan: false }), cyl('metal', [tip[0], tip[1] - g - 0.01, tip[2]], 0.018, 0.025, { segments: 12, plan: false }), sphere('light', tip, g, o));
    }
    return parts;
  },
});

// ───────────────────────── Table lamps ─────────────────────────

const pleated = defineItem({
  id: 'pleated-shade-table-lamp',
  name: 'Ribbed ceramic lamp with pleated shade',
  category: 'lighting',
  type: 'lighting',
  group: 'Table lamps',
  tags: [...TAGS, 'pleated shade', 'ceramic', 'ribbed base', 'bedside', 'table lamp', 'đèn ngủ'],
  description: 'A ribbed glazed-ceramic base under a pleated linen shade — the cosy bedside and side-table lamp.',
  defaultSize: { w: 0.32, d: 0.32, h: 0.52 },
  minSize: { w: 0.22, d: 0.22, h: 0.36 },
  maxSize: { w: 0.45, d: 0.45, h: 0.75 },
  defaultElevation: 0.5,
  slots: [matSlot('base', 'Ceramic base', 'ceramic-sage'), matSlot('light', 'Pleated shade', 'pleated-glow'), matSlot('metal', 'Neck & finial', 'brass-satin')],
  variants: [
    { id: 'terracotta', name: 'Terracotta', materials: { base: 'terracotta-pot' } },
    { id: 'white', name: 'White', materials: { base: 'ceramic-white' } },
    { id: 'blue', name: 'Blue', materials: { base: 'ceramic-blue' } },
  ],
  light: { color: WARM, intensity: 0.6, distance: 3, y: 0.38 },
  build: ({ w, d, h }) => {
    const R = Math.min(w, d) / 2;
    const bh = h * 0.46;
    const br = R * 0.5;
    const parts: Part[] = [
      lathe(
        'base',
        [0, 0, 0],
        [
          [0, 0],
          [br * 0.7, 0],
          [br, bh * 0.25],
          [br * 0.95, bh * 0.6],
          [br * 0.5, bh * 0.95],
          [br * 0.3, bh],
          [0, bh],
        ],
        { segments: 32, plan: true },
      ),
      vcyl('metal', 0, 0, bh, bh + 0.06, 0.012, o),
      cyl('light', [0, h - (h - bh - 0.04) / 2, 0], R * 0.62, h - bh - 0.05, { rTop: R * 0.98 > R ? R : R * 0.98, segments: 32, plan: false }),
      sphere('metal', [0, h - 0.008, 0], 0.008, o),
    ];
    // Shade bottom wider than top: swap radii.
    const shade = parts[2] as Part & { radiusTop: number; radiusBottom: number };
    shade.radiusTop = R * 0.62;
    shade.radiusBottom = R - 0.004;
    // Ribs on the base.
    for (const i of range(5)) parts.push({ ...torus('base', [0, 0, 0], br * (0.88 + 0.08 * Math.sin((i / 4) * Math.PI)), 0.004, o), position: [0, bh * (0.2 + i * 0.15), 0], rotation: [Math.PI / 2, 0, 0] } as Part);
    return parts;
  },
});

const cordless = defineItem({
  id: 'cordless-mushroom-lamp',
  name: 'Cordless mushroom lamp',
  category: 'lighting',
  type: 'lighting',
  group: 'Table lamps',
  tags: [...TAGS, 'cordless', 'rechargeable', 'portable', 'mushroom', 'mini', 'restaurant lamp'],
  description: 'A rechargeable mushroom lamp the size of a hand, with a dimmer ring under the dome — carry it to the table or the balcony.',
  defaultSize: { w: 0.16, d: 0.16, h: 0.25 },
  minSize: { w: 0.12, d: 0.12, h: 0.18 },
  maxSize: { w: 0.24, d: 0.24, h: 0.36 },
  defaultElevation: 0.75,
  slots: [matSlot('body', 'Body', 'paint-pure-white'), matSlot('light', 'Glow', 'light-warm')],
  variants: [
    { id: 'black', name: 'Black', materials: { body: 'metal-black-matte' } },
    { id: 'amber', name: 'Amber', materials: { body: 'enamel-amber' } },
    { id: 'olive', name: 'Olive', materials: { body: 'paint-sage' } },
  ],
  light: { color: WARM, intensity: 0.35, distance: 2, y: 0.19, kind: 'spot', angle: 1.2, penumbra: 0.9 },
  build: ({ w, d, h }) => {
    const R = Math.min(w, d) / 2;
    const dy = h - R * 0.55;
    return [
      lathe('body', [0, 0, 0], [[0, 0], [R * 0.55, 0], [R * 0.5, 0.012], [0.012, h * 0.35], [0.01, dy], [0, dy]], { segments: 28, plan: true }),
      lathe('body', [0, dy, 0], [[R * 0.1, 0.01], [R, 0], [R * 0.95, R * 0.15], [R * 0.6, R * 0.45], [0, R * 0.55]], { segments: 32, plan: false }),
      cyl('light', [0, dy + 0.003, 0], R * 0.85, 0.003, { segments: 28, plan: false }),
      { ...torus('light', [0, 0, 0], R * 0.5, 0.0025, o), position: [0, 0.006, 0], rotation: [Math.PI / 2, 0, 0] } as Part,
    ];
  },
});

const architect = defineItem({
  id: 'architect-desk-lamp',
  name: 'Architect desk lamp',
  category: 'lighting',
  type: 'lighting',
  group: 'Table lamps',
  tags: [...TAGS, 'desk lamp', 'anglepoise', 'balanced arm', 'springs', 'task light', 'đèn bàn'],
  description: 'A spring-balanced desk lamp: weighted base, two arms with tension springs and a conical shade aimed at the work.',
  defaultSize: { w: 0.2, d: 0.5, h: 0.6 },
  minSize: { w: 0.16, d: 0.36, h: 0.45 },
  maxSize: { w: 0.26, d: 0.65, h: 0.8 },
  defaultElevation: 0.75,
  slots: [matSlot('body', 'Base, arms & shade', 'metal-black-matte'), matSlot('spring', 'Springs & joints', 'metal-chrome'), matSlot('light', 'Bulb', 'light-warm')],
  variants: [
    { id: 'red', name: 'Red', materials: { body: 'enamel-red' } },
    { id: 'white', name: 'White', materials: { body: 'paint-pure-white' } },
  ],
  light: { color: NEUTRAL, intensity: 0.8, distance: 2.5, y: 0.42, z: 0.17, kind: 'spot', dir: [0, -1, 0.35], angle: 0.6, penumbra: 0.5 },
  build: ({ w, d, h }) => {
    const z0 = -d / 2;
    const bz = z0 + Math.min(0.08, w / 2);
    const j1: V3 = [0, 0.05, bz];
    const j2: V3 = [0, h * 0.68, bz + d * 0.12];
    const j3: V3 = [0, h * 0.75, d / 2 - 0.1];
    const parts: Part[] = [
      cyl('body', [0, 0.015, bz], Math.min(0.08, w / 2), 0.03, { rTop: Math.min(0.075, w / 2), segments: 28, plan: true }),
      cyl('spring', [0, 0.04, bz], 0.014, 0.02, { segments: 12, plan: false }),
      rod('body', j1, j2, 0.006, { segments: 8, plan: false }),
      rod('body', [0.012, j1[1], j1[2]], [0.012, j2[1], j2[2]], 0.004, { segments: 8, plan: false }),
      rod('body', j2, j3, 0.006, { segments: 8, plan: false }),
      sphere('spring', j2, 0.012, o),
      rod('spring', [-0.014, j1[1] + 0.05, j1[2] + 0.01], [-0.014, j2[1] - 0.1, j2[2] - 0.01], 0.006, { segments: 10, plan: false }),
      rod('spring', [-0.014, j2[1] - 0.02, j2[2] + 0.04], [-0.014, j3[1] - 0.02, j3[2] - 0.1], 0.005, { segments: 10, plan: false }),
      sphere('spring', j3, 0.01, o),
    ];
    // Conical shade hanging from j3, pointing down and forward.
    parts.push({ ...cyl('body', [0, 0, 0], 0.03, 0.13, { rTop: 0.018, segments: 24, plan: false }), position: [0, j3[1] - 0.07, j3[2] + 0.05], rotation: [-0.35, 0, 0] } as Part);
    parts.push({ ...cyl('light', [0, 0, 0], 0.027, 0.003, { segments: 20, plan: false }), position: [0, j3[1] - 0.13, j3[2] + 0.073], rotation: [-0.35, 0, 0] } as Part);
    return parts;
  },
});

const glassDome = defineItem({
  id: 'glass-dome-table-lamp',
  name: 'Glass dome table lamp',
  category: 'lighting',
  type: 'lighting',
  group: 'Table lamps',
  tags: [...TAGS, 'glass', 'smoked glass', 'mushroom', 'brass', 'table lamp'],
  description: 'A smoked-glass mushroom shade over an opal inner globe, on a slim brass stem and a round glass foot.',
  defaultSize: { w: 0.3, d: 0.3, h: 0.42 },
  minSize: { w: 0.22, d: 0.22, h: 0.3 },
  maxSize: { w: 0.42, d: 0.42, h: 0.6 },
  defaultElevation: 0.5,
  slots: [matSlot('glass', 'Smoked glass', 'smoked-glass-lamp'), matSlot('light', 'Inner globe', 'light-warm'), matSlot('metal', 'Stem', 'brass-satin')],
  light: { color: WARM, intensity: 0.5, distance: 3, y: 0.3 },
  build: ({ w, d, h }) => {
    const R = Math.min(w, d) / 2;
    const dy = h - R * 0.6;
    return [
      cyl('glass', [0, 0.008, 0], R * 0.45, 0.016, { segments: 28, plan: true }),
      vcyl('metal', 0, 0, 0.016, dy, 0.008, o),
      sphere('light', [0, dy + R * 0.08, 0], R * 0.3, { scale: [1, 0.8, 1], plan: false }),
      lathe('glass', [0, dy, 0], [[R * 0.98, 0], [R, R * 0.04], [R * 0.9, R * 0.3], [R * 0.6, R * 0.52], [0, R * 0.6]], { segments: 36, plan: false }),
    ];
  },
});

const saltLamp = defineItem({
  id: 'himalayan-salt-lamp',
  name: 'Himalayan salt lamp',
  category: 'lighting',
  type: 'lighting',
  group: 'Table lamps',
  tags: [...TAGS, 'salt lamp', 'himalayan', 'night light', 'amber glow', 'đèn đá muối'],
  description: 'A rough pink salt crystal glowing amber on a small wooden plinth — a warm night light.',
  defaultSize: { w: 0.16, d: 0.15, h: 0.24 },
  minSize: { w: 0.12, d: 0.11, h: 0.16 },
  maxSize: { w: 0.24, d: 0.22, h: 0.36 },
  defaultElevation: 0.5,
  slots: [matSlot('light', 'Salt crystal', 'salt-glow'), matSlot('wood', 'Plinth', 'wood-walnut')],
  light: { color: '#ff9a5a', intensity: 0.3, distance: 2, y: 0.12 },
  build: ({ w, d, h }) => {
    const parts: Part[] = [span('wood', [-w / 2 + 0.01, w / 2 - 0.01], [0, 0.03], [-d / 2 + 0.01, d / 2 - 0.01], { bevel: 0.006, plan: true })];
    const blobs: [number, number, number, number][] = [
      [0, 0.45, 0, 0.42],
      [-0.25, 0.3, 0.1, 0.33],
      [0.22, 0.35, -0.08, 0.3],
      [0.05, 0.7, 0.05, 0.3],
      [-0.1, 0.85, -0.05, 0.2],
      [0.15, 0.2, 0.15, 0.28],
    ];
    for (const [x, y, z, r] of blobs) {
      const rr = r * Math.min(w, d) * 0.6;
      parts.push(sphere('light', [x * w * 0.6, 0.03 + y * (h - 0.05), z * d * 0.6], rr, { scale: [1, 1.15, 0.9], rotation: [x * 2, y, z * 3], plan: false }));
    }
    return parts;
  },
});

const rgbBars = defineItem({
  id: 'rgb-light-bars',
  name: 'RGB light bars (pair)',
  category: 'lighting',
  type: 'lighting',
  group: 'Table lamps',
  tags: [...TAGS, 'rgb', 'light bars', 'gaming', 'monitor', 'desk', 'smart', 'mood light'],
  description: 'A pair of upright smart light bars for each side of a monitor or TV, washing the wall behind in colour.',
  defaultSize: { w: 0.7, d: 0.08, h: 0.3 },
  minSize: { w: 0.3, d: 0.06, h: 0.24 },
  maxSize: { w: 1.6, d: 0.1, h: 0.36 },
  defaultElevation: 0.75,
  slots: [matSlot('body', 'Stands', 'metal-black-matte'), matSlot('light', 'Light bars', 'rgb-glow')],
  variants: [
    { id: 'cyan', name: 'Cyan', materials: { light: 'rgb-glow-cyan' } },
    { id: 'warm', name: 'Warm white', materials: { light: 'light-warm' } },
  ],
  light: {
    color: '#b07cff',
    intensity: 0.35,
    distance: 2,
    y: 0.16,
    heads: [
      { x: -0.32, y: 0.16 },
      { x: 0.32, y: 0.16 },
    ],
  },
  build: ({ w, d, h }) => {
    const parts: Part[] = [];
    for (const s of [-1, 1]) {
      const x = s * (w / 2 - 0.03);
      parts.push(cyl('body', [x, 0.006, 0], Math.min(0.035, d / 2), 0.012, { segments: 20, plan: true }), cyl('light', [x, 0.012 + (h - 0.014) / 2, 0], 0.017, h - 0.014, { segments: 18, plan: false }));
    }
    return parts;
  },
});

// ───────────────────────── Outdoor ─────────────────────────

const bollard = defineItem({
  id: 'louvred-bollard-light',
  name: 'Louvred bollard light',
  category: 'outdoor',
  type: 'lighting',
  group: 'Outdoor & string lights',
  tags: [...TAGS, 'bollard', 'path light', 'garden', 'outdoor', 'louvres', 'đèn sân vườn'],
  description: 'An anthracite garden bollard with a louvred head that throws light down onto a path without glare.',
  defaultSize: { w: 0.16, d: 0.16, h: 0.65 },
  minSize: { w: 0.12, d: 0.12, h: 0.4 },
  maxSize: { w: 0.24, d: 0.24, h: 1.0 },
  slots: [matSlot('body', 'Body', 'metal-anthracite'), matSlot('light', 'Louvre glow', 'light-warm')],
  light: { color: WARM, intensity: 0.5, distance: 3, y: 0.5, kind: 'spot', angle: 1.3, penumbra: 0.9 },
  build: ({ w, d, h }) => {
    const R = Math.min(w, d) / 2;
    const ly = h - 0.14;
    const parts: Part[] = [cyl('body', [0, 0.01, 0], R, 0.02, { segments: 28, plan: true }), cyl('body', [0, ly / 2, 0], R * 0.75, ly, { segments: 28, plan: false }), cyl('light', [0, ly + 0.05, 0], R * 0.6, 0.1, { segments: 24, plan: false }), cyl('body', [0, h - 0.02, 0], R * 0.85, 0.04, { rTop: R * 0.7, segments: 28, plan: false })];
    for (const i of range(4)) parts.push(cyl('body', [0, ly + 0.012 + i * 0.024, 0], R * 0.82, 0.008, { rTop: R * 0.7, segments: 28, plan: false }));
    return parts;
  },
});

const solarStakes = defineItem({
  id: 'solar-stake-lights',
  name: 'Solar stake path lights (set of 4)',
  category: 'outdoor',
  type: 'lighting',
  group: 'Outdoor & string lights',
  tags: [...TAGS, 'solar', 'stake lights', 'path', 'garden', 'balcony planter', 'outdoor'],
  description: 'Four little solar lights on spikes, with a panel on each cap and a frosted lens below, to line a path or a planter.',
  defaultSize: { w: 1.2, d: 0.12, h: 0.38 },
  minSize: { w: 0.5, d: 0.1, h: 0.25 },
  maxSize: { w: 2.4, d: 0.16, h: 0.5 },
  slots: [matSlot('body', 'Caps & spikes', 'metal-black-matte'), matSlot('light', 'Lenses', 'light-warm'), matSlot('panel', 'Solar panels', 'solar-panel-cell')],
  light: {
    color: WARM,
    intensity: 0.15,
    distance: 1.5,
    y: 0.3,
    heads: [
      { x: -0.45, y: 0.3 },
      { x: 0.15, y: 0.3 },
    ],
  },
  build: ({ w, d, h }) => {
    const parts: Part[] = [];
    for (const x of range(4).map((i) => -w / 2 + 0.06 + ((w - 0.12) * i) / 3)) {
      const r = Math.min(0.05, d / 2);
      parts.push(vcyl('body', x, 0, 0, h - 0.1, 0.006, { plan: true }), cyl('light', [x, h - 0.07, 0], r * 0.7, 0.05, { segments: 16, plan: false }), cyl('body', [x, h - 0.035, 0], r, 0.02, { segments: 16, plan: false }), cyl('panel', [x, h - 0.023, 0], r * 0.8, 0.003, { segments: 16, plan: false }));
    }
    return parts;
  },
});

const patterns: PackPattern[] = [
  {
    id: 'washi-fibres',
    name: 'Washi paper fibres',
    normalStrength: 0.25,
    draw(ctx, size, rand) {
      ctx.fillStyle = '#f6efe2';
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = '#e4d6bd';
      for (let i = 0; i < 140; i++) {
        ctx.lineWidth = 0.5 + rand();
        ctx.beginPath();
        const x = rand() * size;
        const y = rand() * size;
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + (rand() - 0.5) * 40, y + (rand() - 0.5) * 40, x + (rand() - 0.5) * 80, y + (rand() - 0.5) * 80);
        ctx.stroke();
      }
    },
  },
  {
    id: 'pleats',
    name: 'Pleated fabric',
    normalStrength: 1,
    draw(ctx, size) {
      const n = 24;
      for (let i = 0; i < n; i++) {
        const x0 = (i * size) / n;
        const g = ctx.createLinearGradient(x0, 0, x0 + size / n, 0);
        g.addColorStop(0, '#d8cdb8');
        g.addColorStop(0.5, '#fbf6ec');
        g.addColorStop(1, '#cfc3ad');
        ctx.fillStyle = g;
        ctx.fillRect(x0, 0, size / n + 1, size);
      }
    },
  },
  {
    id: 'solar-cells',
    name: 'Solar cells',
    colored: true,
    normalStrength: 0.3,
    draw(ctx, size) {
      ctx.fillStyle = '#1b2a4a';
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = '#8fa0bf';
      ctx.lineWidth = 2;
      for (let i = 0; i <= 8; i++) {
        ctx.beginPath();
        ctx.moveTo((i * size) / 8, 0);
        ctx.lineTo((i * size) / 8, size);
        ctx.moveTo(0, (i * size) / 8);
        ctx.lineTo(size, (i * size) / 8);
        ctx.stroke();
      }
    },
  },
];

export default definePack({
  name: 'Designer lighting',
  version: '1.0.0',
  author: 'Neest',
  description: 'Paper lanterns, layered and leaf pendants, chandeliers, magnetic track, sconces, floor and table lamps, RGB lights and garden path lights.',
  license: 'CC0-1.0',
  patterns,
  materials: [
    { id: 'washi-glow', name: 'Glowing washi paper', category: 'fabric', color: '#fbf3e4', roughness: 0.95, emissive: '#ffdfae', emissiveIntensity: 1.2, pattern: { id: 'washi-fibres', scale: 0.25, contrast: 0.7 } },
    { id: 'pleated-glow', name: 'Glowing pleated linen', category: 'fabric', color: '#f4ecdc', roughness: 0.9, emissive: '#ffdcaa', emissiveIntensity: 0.9, pattern: { id: 'pleats', scale: 0.12, contrast: 1 } },
    { id: 'alabaster-glow', name: 'Glowing alabaster', category: 'stone', color: '#f6eee2', roughness: 0.45, emissive: '#ffe3bf', emissiveIntensity: 1.1, pattern: { id: 'marble', scale: 0.3, contrast: 0.5 } },
    { id: 'filament-glow', name: 'Amber filament bulb', category: 'glass', color: '#ffc477', roughness: 0.15, emissive: '#ff9d3a', emissiveIntensity: 2.6 },
    { id: 'led-diffuser-warm', name: 'Warm LED diffuser', category: 'solid', color: '#fff7ea', roughness: 0.5, emissive: '#ffe2b8', emissiveIntensity: 2.4 },
    { id: 'salt-glow', name: 'Glowing salt crystal', category: 'stone', color: '#f2a27a', roughness: 0.7, emissive: '#ff7a3a', emissiveIntensity: 1.2, pattern: { id: 'marble', scale: 0.1, contrast: 0.6 } },
    { id: 'rgb-glow', name: 'Violet LED glow', category: 'solid', color: '#c9a6ff', roughness: 0.4, emissive: '#9b5cff', emissiveIntensity: 2.4 },
    { id: 'rgb-glow-cyan', name: 'Cyan LED glow', category: 'solid', color: '#a6f0ff', roughness: 0.4, emissive: '#3cd6ff', emissiveIntensity: 2.4 },
    { id: 'brass-satin', name: 'Satin brass', category: 'metal', color: '#c9a35e', roughness: 0.3, metalness: 1, pattern: { id: 'brushed', scale: 0.3, contrast: 0.4 } },
    { id: 'enamel-green', name: 'Green enamel', category: 'metal', color: '#2f5d4a', roughness: 0.2, metalness: 0.2 },
    { id: 'enamel-red', name: 'Signal red enamel', category: 'metal', color: '#b3261e', roughness: 0.22, metalness: 0.2 },
    { id: 'enamel-amber', name: 'Amber enamel', category: 'metal', color: '#c98a2b', roughness: 0.22, metalness: 0.2 },
    { id: 'amber-glass-lamp', name: 'Amber glass', category: 'glass', color: '#c98a3a', roughness: 0.08, opacity: 0.55 },
    { id: 'smoked-glass-lamp', name: 'Smoked glass', category: 'glass', color: '#6b6560', roughness: 0.06, opacity: 0.5 },
    { id: 'crystal-glass', name: 'Crystal', category: 'glass', color: '#f2f6f8', roughness: 0.02, metalness: 0.2, opacity: 0.45 },
    { id: 'solar-panel-cell', name: 'Solar panel', category: 'solid', color: '#ffffff', roughness: 0.2, pattern: { id: 'solar-cells', scale: 0.05, contrast: 1 } },
  ],
  items: [
    paperLantern,
    layeredShade,
    artichoke,
    beehive,
    linearLed,
    branching,
    crystal,
    woodBead,
    factory,
    schoolhouse,
    magneticTrack,
    globeSconce,
    shellSconce,
    readingWall,
    coachLantern,
    paperColumn,
    studioTripod,
    mushroomFloor,
    rgbCorner,
    globeTree,
    pleated,
    cordless,
    architect,
    glassDome,
    saltLamp,
    rgbBars,
    bollard,
    solarStakes,
  ],
});

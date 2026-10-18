/**
 * Houseplants with care guides — 27 detailed houseplants, each with a care and placement guide.
 *
 * Every item carries `plant` info (botanical name, light, where to stand it, watering through the
 * seasons, humidity, temperature, soil and repotting, mature size, pet safety and difficulty) which
 * the library's info card and the Inspector show as labelled rows. Search also finds plants by
 * botanical name, light level ("low light"), "pet safe" or room.
 *
 * Models use the shared plant helpers in the kit: leaves are shaped outlines per species (violin
 * fiddle leaves with wavy margins, split monstera leaves, arrow-shaped alocasia leaves with raised
 * white veins, heart leaves on trailing vines, pinnate palm fronds, fleshy rosettes), folded along
 * the midrib and arched in segments, on proper stems in terracotta, glazed ceramic, concrete, woven
 * baskets, a mid-century plant stand and macramé hangers. Each plant is one merged mesh per
 * material, so many of them stay cheap to draw.
 *
 * Care guides are general guidance for indoor growing in temperate homes; pet safety follows the
 * ASPCA toxic and non-toxic plant lists.
 */
import {
  along,
  ball,
  bezier,
  bladeLeaf,
  canopyPlan,
  circle,
  clamp,
  containParts,
  cyl,
  definePack,
  defineItem,
  dirOf,
  discFacing,
  ellipsoid,
  facingFrame,
  fitGroup,
  GOLDEN,
  halfMin,
  hangingCords,
  knotWidth,
  lathe,
  leafFrame,
  leafPanel,
  LEAFLET_NARROW,
  lerp,
  matSlot,
  onBlade,
  ovateWidth,
  palmateOutline,
  pebbles,
  pinnateFrond,
  planter,
  PLANT_SPECIES,
  plantBox,
  plantStand,
  polar,
  poly,
  range,
  rectPoly,
  ring,
  rng,
  rod,
  sphere,
  sprigOutline,
  starPlan,
  stemPath,
  strapWidth,
  TAU,
  torus,
  vadd,
  vcross,
  vmul,
  vnorm,
  vsub,
  wedgeWidth,
  type Notch,
  type Part,
  type PlanStroke,
  type Size3,
  type V2,
  type V3,
} from '@/packs/kit';

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

const NP = { plan: false };
const CEIL = 2.7;
const tags = (...t: string[]) => [...t, 'plant', 'houseplant', 'indoor plant', 'care guide'];

/** Size scale of the plant's leaves relative to its default height (leaves grow with the plant). */
const scaleOf = (h: number, h0: number) => clamp(h / h0, 0.65, 1.4);

/** Plan symbol: pot circle and a scalloped canopy. */
const potAndCanopy =
  (pot: number, canopy = 0.46, lobes = 9) =>
  ({ w, d }: Size3): PlanStroke[] => [circle([0, 0], Math.min(w, d) * pot), canopyPlan(w * canopy, d * canopy, lobes)];

/** Hanging items hang from the ceiling, so their top touches it. */
const hanging = (h: number) => ({ mount: 'ceiling' as const, defaultElevation: CEIL - h });

/** Trailing vine polyline: from the soil at azimuth `a`, over the rim and down to `yEnd`. */
function trailPath(a: number, rIn: number, rRim: number, top: number, yRim: number, yEnd: number, reach: number, sway: number): V3[] {
  const S = polar(rIn * 0.8, a, top + 0.006);
  const R = polar(rRim + 0.012, a, yRim + 0.015);
  const M = polar(lerp(rRim + 0.02, reach, 0.6), a + sway * 0.5, lerp(yRim, yEnd, 0.45));
  const E = polar(reach, a + sway, yEnd);
  return [S, R, M, E];
}

// ---------------------------------------------------------------------------
// Floor plants and trees
// ---------------------------------------------------------------------------

const FIDDLE: V2[] = [
  [0, 0.22],
  [0.22, 0.66],
  [0.46, 0.6],
  [0.74, 1],
  [0.9, 0.82],
  [0.97, 0.45],
  [1, 0],
];

const fiddleLeafFig = defineItem({
  id: 'fiddle-leaf-fig',
  name: 'Fiddle-leaf fig tree',
  category: 'plants',
  type: 'plants',
  group: 'Trees',
  tags: tags('fiddle leaf fig', 'ficus lyrata', 'indoor tree', 'big leaves', 'woven basket', 'floor plant'),
  description: 'A standard fiddle-leaf fig with violin-shaped, wavy-edged leaves on a branched trunk, in a woven seagrass basket.',
  defaultSize: { w: 0.8, d: 0.8, h: 1.8 },
  minSize: { w: 0.5, d: 0.5, h: 1.0 },
  maxSize: { w: 1.3, d: 1.3, h: 2.6 },
  slots: [matSlot('pot', 'Basket', 'seagrass-basket'), matSlot('soil', 'Soil', 'potting-soil'), matSlot('leaf', 'Leaves', 'leaf-fiddle'), matSlot('trunk', 'Trunk & stalks', 'bark-brown')],
  build: (size) => {
    const { h } = size;
    const m = halfMin(size);
    const box = plantBox(size);
    const k = scaleOf(h, 1.8);
    const pot = planter('pot', 'soil', m * 0.48, clamp(h * 0.2, 0.2, 0.4), 'basket', { handles: m * 0.52, mound: 0.55 });
    const parts: Part[] = [...pot.parts];
    const rand = rng(11);
    const t0: V3 = [0, pot.top - 0.01, 0];
    const t1: V3 = [0.02, lerp(pot.top, h, 0.42), -0.012];
    const t2: V3 = [-0.012, h * 0.8, 0.01];
    parts.push(...stemPath('trunk', [t0, t1, t2], 0.022 * k, 0.011 * k, 8));
    const paths: V3[][] = [[t1, t2]];
    for (const b of range(3)) {
      const start = along([t1, t2], lerp(0.1, 0.55, b / 2));
      const a = b * 2.1 + 0.5;
      const end = vadd(start, polar(m * lerp(0.3, 0.42, rand()), a, Math.min(h - 0.12 - start[1], h * lerp(0.14, 0.22, rand()))));
      parts.push(rod('trunk', start, end, 0.01 * k, { rTop: 0.006 * k, segments: 6, plan: false }));
      paths.push([start, end]);
    }
    const L0 = clamp(h * 0.18, 0.15, 0.38);
    let j = 0;
    for (const [pi, path] of paths.entries()) {
      const n = pi === 0 ? 10 : 6;
      for (const i of range(n)) {
        const frac = i / (n - 1);
        const P = along(path, lerp(pi === 0 ? 0.05 : 0.3, 1, frac));
        const az = j * GOLDEN + pi * 0.7;
        const tilt = lerp(1.3, 0.55, frac) + (rand() - 0.5) * 0.25;
        const Q = vadd(P, vmul(dirOf(az, Math.min(1.35, tilt + 0.25)), 0.035 * k));
        const len = L0 * lerp(0.85, 1.05, rand()) * (1 - 0.3 * frac * frac);
        const blade = bladeLeaf('leaf', Q, len, knotWidth(len * 0.66, FIDDLE), az + (rand() - 0.5) * 0.3, tilt, {
          segs: 2,
          bend: lerp(0.15, 0.4, rand()),
          roll: (rand() - 0.5) * 0.5,
          thick: 0.005,
          samples: 8,
          wave: { amp: 0.05, n: 5 },
          plan: j < 3,
        });
        parts.push(...fitGroup([rod('trunk', P, Q, 0.0045, { segments: 5, plan: false }), ...blade.parts], P, box));
        j++;
      }
    }
    return containParts(parts, box);
  },
  planDetail: potAndCanopy(0.24, 0.44, 8),
  plant: PLANT_SPECIES['ficus-lyrata'],
});

const birdOfParadise = defineItem({
  id: 'bird-of-paradise',
  name: 'Bird of paradise in flower',
  category: 'plants',
  type: 'plants',
  group: 'Indoor plants',
  tags: tags('bird of paradise', 'strelitzia reginae', 'crane flower', 'orange flower', 'tropical', 'paddle leaves', 'floor plant'),
  description: 'Strelitzia reginae with blue-green paddle leaves on long stalks and two orange crane flowers, in a black glazed planter.',
  defaultSize: { w: 0.75, d: 0.75, h: 1.25 },
  minSize: { w: 0.45, d: 0.45, h: 0.7 },
  maxSize: { w: 1.2, d: 1.2, h: 1.8 },
  slots: [matSlot('pot', 'Planter', 'ceramic-black'), matSlot('soil', 'Soil', 'potting-soil'), matSlot('leaf', 'Leaves & stalks', 'leaf-strelitzia'), matSlot('flower', 'Flowers', 'strelitzia-orange')],
  build: (size) => {
    const { h } = size;
    const m = halfMin(size);
    const box = plantBox(size);
    const pot = planter('pot', 'soil', m * 0.42, clamp(h * 0.24, 0.18, 0.36), 'cylinder');
    const parts: Part[] = [...pot.parts];
    const rand = rng(23);
    const H = h - pot.top;
    const n = clamp(Math.round(h * 9), 7, 13);
    for (const i of range(n)) {
      // Two crossing fans of paddle leaves, the strelitzia silhouette.
      const fan = lerp(-0.5, 0.5, i / (n - 1)) + (rand() - 0.5) * 0.1;
      const az = (i % 2 ? 1.3 : 0) + (fan >= 0 ? 0 : Math.PI) + (rand() - 0.5) * 0.35;
      const tilt = Math.abs(fan) * 0.8 + 0.06;
      const base = polar(pot.rIn * 0.3 * rand(), rand() * TAU, pot.top);
      const top = vadd(base, vmul(dirOf(az, tilt), H * lerp(0.42, 0.58, rand()) * (1 - Math.abs(fan) * 0.25)));
      const bl = clamp(H * 0.4, 0.22, 0.55) * lerp(0.85, 1.05, rand());
      const notches: Notch[] = range(1 + Math.floor(rand() * 2)).map(() => ({ t: lerp(0.6, 0.9, rand()), side: rand() < 0.5 ? 1 : -1, depth: lerp(0.3, 0.6, rand()), back: 0.02, gap: 0.006 }));
      const blade = bladeLeaf('leaf', top, bl, ovateWidth(bl * 0.4, 0.5, 0.45), az + (rand() - 0.5) * 0.2, tilt + lerp(0.08, 0.3, rand()), {
        segs: 2,
        bend: lerp(0.1, 0.3, rand()),
        fold: 0.16,
        roll: (rand() - 0.5) * 0.5,
        thick: 0.005,
        samples: 7,
        notches,
        plan: i === 0 || i === n - 1,
      });
      parts.push(...fitGroup([rod('leaf', base, top, 0.009, { rTop: 0.007, segments: 6, plan: false }), ...blade.parts], base, box));
    }
    // Crane flowers: a green beak held level, three orange sepals and a blue-tipped tongue.
    for (const f of range(2)) {
      const az = f * 2.6 + 0.8;
      const base = polar(0.02, az, pot.top);
      const top = vadd(base, vmul(dirOf(az, 0.14), H * (f ? 0.48 : 0.56)));
      const beakDir = dirOf(az + 0.4, 1.42);
      const tip = vadd(top, vmul(beakDir, 0.16));
      const g: Part[] = [rod('leaf', base, top, 0.007, { rTop: 0.006, segments: 6, plan: false }), rod('leaf', top, tip, 0.014, { rTop: 0.003, segments: 8, plan: false })];
      const S = vadd(vadd(top, vmul(beakDir, 0.045)), [0, 0.012, 0]);
      for (const s of range(3)) g.push(...bladeLeaf('flower', S, 0.12, strapWidth(0.024, 0.45, 0.35), az + 0.4 + Math.PI + (s - 1) * 0.42, 0.42 + s * 0.12, { thick: 0.003, fold: 0.3 }).parts);
      g.push(...bladeLeaf('flower', vadd(S, vmul(beakDir, 0.01)), 0.09, strapWidth(0.012, 0.5, 0.5), az + 0.4 + Math.PI, 0.7, { thick: 0.003 }).parts);
      parts.push(...fitGroup(g, base, box));
    }
    return containParts(parts, box);
  },
  planDetail: potAndCanopy(0.21, 0.46, 7),
  plant: PLANT_SPECIES['strelitzia-reginae'],
});

const oliveTree = defineItem({
  id: 'olive-tree',
  name: 'Olive tree in terracotta',
  category: 'plants',
  type: 'plants',
  group: 'Trees',
  tags: tags('olive tree', 'olea europaea', 'mediterranean', 'silver leaves', 'terracotta', 'indoor tree', 'floor plant'),
  description: 'A young olive with a gnarled trunk and a loose crown of narrow silver-green leaves, in a terracotta pot on a saucer.',
  defaultSize: { w: 0.75, d: 0.75, h: 1.6 },
  minSize: { w: 0.45, d: 0.45, h: 0.9 },
  maxSize: { w: 1.3, d: 1.3, h: 2.4 },
  slots: [matSlot('pot', 'Pot', 'terracotta'), matSlot('soil', 'Soil', 'gravel-top'), matSlot('leaf', 'Leaves', 'leaf-olive'), matSlot('trunk', 'Trunk & branches', 'bark-olive')],
  build: (size) => {
    const { h } = size;
    const m = halfMin(size);
    const box = plantBox(size);
    const k = scaleOf(h, 1.6);
    const pot = planter('pot', 'soil', m * 0.46, clamp(h * 0.22, 0.2, 0.4), 'terracotta', { saucer: true });
    const parts: Part[] = [...pot.parts, ...pebbles('soil', pot.rIn, pot.top, 4, 0.012, 7)];
    const rand = rng(31);
    const top = h * 0.56;
    const trunk: V3[] = [
      [0, pot.top - 0.01, 0],
      [0.035, lerp(pot.top, top, 0.35), 0.012],
      [-0.02, lerp(pot.top, top, 0.7), -0.022],
      [0.01, top, 0.01],
    ];
    parts.push(...stemPath('trunk', trunk, 0.03 * k, 0.017 * k, 9));
    const crownY = lerp(top, h, 0.5);
    const crownR = m * 0.82;
    const ends: V3[][] = [];
    for (const b of range(5)) {
      const a = b * 1.31 + 0.3;
      const B0 = along(trunk, lerp(0.8, 1, b / 4));
      const B1: V3 = vadd(polar(crownR * lerp(0.35, 0.5, rand()), a), [0, lerp(top + 0.05, crownY, 0.6 + rand() * 0.3), 0]);
      parts.push(rod('trunk', B0, B1, 0.011 * k, { rTop: 0.007 * k, segments: 6, plan: false }));
      for (const s of [-1, 1]) {
        const B2: V3 = vadd(polar(crownR * lerp(0.7, 0.95, rand()), a + s * 0.45), [0, lerp(crownY, h - 0.08, rand() * 0.7), 0]);
        parts.push(rod('trunk', B1, B2, 0.006 * k, { rTop: 0.004 * k, segments: 5, plan: false }));
        ends.push([B1, B2]);
      }
    }
    // Sprigs of narrow leaves along and around every twig.
    let j = 0;
    for (const twig of ends) {
      for (const i of range(6)) {
        const P = along(twig, lerp(0.25, 1, i / 5) - rand() * 0.08);
        const dir = vnorm(vadd(vnorm(vsub(P, [0, crownY - 0.15, 0])), [(rand() - 0.5) * 0.8, 0.35 + rand() * 0.4, (rand() - 0.5) * 0.8]));
        const az = Math.atan2(dir[2], dir[0]);
        const tilt = Math.acos(clamp(dir[1], -1, 1));
        const len = 0.13 * k * lerp(0.75, 1.1, rand());
        const sprig = leafPanel('leaf', P, leafFrame(az, tilt, (rand() - 0.5) * 1.6), sprigOutline(len, 0.055 * k, 0.0095 * k, 0.55, LEAFLET_NARROW), 0.002, j % 9 === 0);
        parts.push(...fitGroup([sprig], P, box));
        j++;
      }
    }
    return containParts(parts, box);
  },
  planDetail: potAndCanopy(0.23, 0.43, 11),
  plant: PLANT_SPECIES['olea-europaea'],
});

const rubberTineke = defineItem({
  id: 'rubber-plant-tineke',
  name: "Rubber plant 'Tineke'",
  category: 'plants',
  type: 'plants',
  group: 'Indoor plants',
  tags: tags('rubber plant', 'ficus elastica', 'tineke', 'variegated', 'glossy leaves', 'concrete planter', 'floor plant'),
  description: 'Variegated Ficus elastica with glossy cream-edged leaves and pink new-leaf sheaths, on two stems in a concrete planter.',
  defaultSize: { w: 0.6, d: 0.6, h: 1.3 },
  minSize: { w: 0.35, d: 0.35, h: 0.7 },
  maxSize: { w: 1.0, d: 1.0, h: 2.2 },
  slots: [matSlot('pot', 'Planter', 'concrete-planter'), matSlot('soil', 'Soil', 'potting-soil'), matSlot('leaf', 'Leaves', 'leaf-tineke'), matSlot('stem', 'Stems & sheaths', 'stem-rubber')],
  build: (size) => {
    const { h } = size;
    const m = halfMin(size);
    const box = plantBox(size);
    const pot = planter('pot', 'soil', m * 0.46, clamp(h * 0.22, 0.17, 0.36), 'cylinder');
    const parts: Part[] = [...pot.parts];
    const rand = rng(41);
    const stems: V3[][] = [
      [[0.01, pot.top, 0], [-0.012, lerp(pot.top, h, 0.5), 0.008], [0.004, h * 0.88, -0.004]],
      [[pot.rIn * 0.3, pot.top, 0.02], [pot.rIn * 0.45, lerp(pot.top, h, 0.3), 0.03], [m * 0.22, h * 0.64, m * 0.08]],
    ];
    const Lb = clamp(h * 0.2, 0.14, 0.33);
    for (const [s, path] of stems.entries()) {
      parts.push(...stemPath('stem', path, s ? 0.011 : 0.014, s ? 0.007 : 0.008, 7));
      const n = clamp(Math.round((path[2][1] - path[0][1]) * 11), 5, 12);
      for (const j of range(n)) {
        const frac = j / (n - 1);
        const P = along(path, lerp(0.22, 0.96, frac));
        const az = j * GOLDEN + s * 1.3 + rand() * 0.3;
        const tilt = lerp(1.35, 0.6, frac) + (rand() - 0.5) * 0.25;
        const Q = vadd(P, vmul(dirOf(az, Math.min(1.2, tilt)), 0.035));
        const len = Lb * lerp(0.8, 1.05, rand()) * (1 - 0.3 * frac * frac);
        const blade = bladeLeaf('leaf', Q, len, ovateWidth(len * 0.5, 0.5, 0.6), az, tilt, { segs: 2, bend: lerp(0.15, 0.4, rand()), fold: 0.08, roll: (rand() - 0.5) * 0.4, thick: 0.005, samples: 7, plan: s === 0 && j < 2 });
        parts.push(...fitGroup([rod('stem', P, Q, 0.004, { segments: 5, plan: false }), ...blade.parts], P, box));
      }
      // Pink sheath wrapping the next leaf at the growing tip.
      const tip = path[2];
      parts.push(rod('stem', tip, vadd(tip, [0.004, Math.min(0.08, h - tip[1] - 0.01), 0]), 0.008, { rTop: 0.002, segments: 6, plan: false }));
    }
    return containParts(parts, box);
  },
  planDetail: potAndCanopy(0.23, 0.42, 8),
  plant: PLANT_SPECIES['ficus-elastica-tineke'],
});

const kentiaPalm = defineItem({
  id: 'kentia-palm',
  name: 'Kentia palm',
  category: 'plants',
  type: 'plants',
  group: 'Indoor plants',
  tags: tags('kentia palm', 'howea forsteriana', 'palm', 'fronds', 'low light', 'tall planter', 'floor plant', 'pet safe'),
  description: 'Howea forsteriana with long arching fronds of drooping leaflets on slender stalks, in a tall matte-white planter.',
  defaultSize: { w: 1.0, d: 1.0, h: 1.9 },
  minSize: { w: 0.55, d: 0.55, h: 1.1 },
  maxSize: { w: 1.6, d: 1.6, h: 2.7 },
  slots: [matSlot('pot', 'Planter', 'ceramic-matte-white'), matSlot('soil', 'Soil', 'potting-soil'), matSlot('leaf', 'Leaflets', 'leaf-kentia'), matSlot('stems', 'Stalks', 'stem-palm')],
  build: (size) => {
    const { h } = size;
    const m = halfMin(size);
    const box = plantBox(size);
    const pot = planter('pot', 'soil', m * 0.34, clamp(h * 0.25, 0.25, 0.5), 'taper');
    const parts: Part[] = [...pot.parts];
    const rand = rng(53);
    const H = h - pot.top;
    const n = clamp(Math.round(h * 6), 8, 12);
    const Ll = clamp(H * 0.2, 0.14, 0.38);
    for (const i of range(n)) {
      const az = i * GOLDEN;
      const base = polar(pot.rIn * 0.35 * rand(), az + 1.7, pot.top);
      const t0 = lerp(0.12, 0.5, rand());
      const start = vadd(base, vmul(dirOf(az, t0), H * lerp(0.28, 0.42, rand())));
      const fr = pinnateFrond('leaf', 'stems', start, H * lerp(0.48, 0.62, rand()), az, t0 + 0.15, {
        segs: 3,
        bend: lerp(0.8, 1.2, rand()),
        leaflet: (t) => Ll * Math.pow(Math.sin(Math.PI * clamp(0.12 + 0.88 * t, 0, 1)), 0.6),
        lw: 0.02,
        spacing: 0.042,
        beta: 0.55,
        vee: -0.38,
        from: 0.04,
        rachis: 0.006,
        plan: i < 4,
      });
      parts.push(...fitGroup([rod('stems', base, start, 0.008, { rTop: 0.006, segments: 6, plan: false }), ...fr], base, box));
    }
    return containParts(parts, box);
  },
  planDetail: potAndCanopy(0.17, 0.47, 12),
  plant: PLANT_SPECIES['howea-forsteriana'],
});

const moneyTree = defineItem({
  id: 'money-tree',
  name: 'Braided money tree',
  category: 'plants',
  type: 'plants',
  group: 'Trees',
  tags: tags('money tree', 'pachira aquatica', 'braided trunk', 'feng shui', 'palmate leaves', 'pet safe'),
  description: 'Pachira aquatica with five braided trunks and umbrellas of glossy five-fingered leaves, in a sage glazed pot.',
  defaultSize: { w: 0.65, d: 0.65, h: 1.3 },
  minSize: { w: 0.4, d: 0.4, h: 0.7 },
  maxSize: { w: 1.1, d: 1.1, h: 2.0 },
  slots: [matSlot('pot', 'Pot', 'glazed-sage'), matSlot('soil', 'Soil', 'potting-soil'), matSlot('leaf', 'Leaves', 'leaf-pachira'), matSlot('trunk', 'Trunks & stalks', 'stem-pachira')],
  build: (size) => {
    const { h } = size;
    const m = halfMin(size);
    const box = plantBox(size);
    const k = scaleOf(h, 1.3);
    const pot = planter('pot', 'soil', m * 0.44, clamp(h * 0.2, 0.16, 0.32), 'cylinder');
    const parts: Part[] = [...pot.parts];
    const rand = rng(61);
    const yTop = h * 0.52;
    const tips: V3[] = [];
    for (const s of range(5)) {
      // A five-strand braid: each trunk winds once and a half round the centre.
      const pts = range(6).map((q) => {
        const u = q / 5;
        const a = (s / 5) * TAU + u * TAU * 1.5;
        return polar(0.018 * k * (1 - 0.25 * u), a, lerp(pot.top - 0.01, yTop, u));
      });
      parts.push(...stemPath('trunk', pts, 0.011 * k, 0.008 * k, 7));
      const a = (s / 5) * TAU + 0.6;
      const tip = vadd(polar(m * lerp(0.18, 0.3, rand()), a), [0, h * lerp(0.62, 0.74, rand()), 0]);
      parts.push(rod('trunk', pts[5], tip, 0.007 * k, { rTop: 0.005 * k, segments: 6, plan: false }));
      tips.push(tip);
    }
    let j = 0;
    for (const [s, tip] of tips.entries()) {
      for (const i of range(5)) {
        const P = vadd(tip, [0, -i * 0.02, 0]);
        const az = (s / 5) * TAU + i * GOLDEN;
        const tilt = lerp(0.45, 1.2, i / 4) + (rand() - 0.5) * 0.2;
        const Q = vadd(P, vmul(dirOf(az, tilt), 0.15 * k * lerp(0.8, 1.1, rand())));
        const outline = palmateOutline(5 + (i % 3 === 0 ? 2 : 0), 0.13 * k * lerp(0.85, 1.1, rand()), 0.042 * k, 2.6, 0.006, rand);
        const leaf = leafPanel('leaf', Q, leafFrame(az, Math.min(1.45, tilt + 0.5), (rand() - 0.5) * 0.4), outline, 0.003, j < 4);
        parts.push(...fitGroup([rod('trunk', P, Q, 0.0028, { segments: 5, plan: false }), leaf], P, box));
        j++;
      }
    }
    return containParts(parts, box);
  },
  planDetail: potAndCanopy(0.22, 0.44, 10),
  plant: PLANT_SPECIES['pachira-aquatica'],
});

// ---------------------------------------------------------------------------
// Mid-size plants
// ---------------------------------------------------------------------------

const MONSTERA: V2[] = [
  [0, 0.62],
  [0.28, 1],
  [0.6, 0.92],
  [0.85, 0.56],
  [1, 0],
];

const monstera = defineItem({
  id: 'monstera',
  name: 'Monstera on a moss pole',
  category: 'plants',
  type: 'plants',
  group: 'Indoor plants',
  tags: tags('monstera', 'monstera deliciosa', 'swiss cheese plant', 'split leaves', 'moss pole', 'tropical'),
  description: 'Monstera deliciosa with big heart-shaped, deeply split leaves on arching stalks, climbing a moss pole in a white ceramic pot.',
  defaultSize: { w: 0.95, d: 0.95, h: 1.25 },
  minSize: { w: 0.55, d: 0.55, h: 0.7 },
  maxSize: { w: 1.6, d: 1.6, h: 2.2 },
  slots: [matSlot('pot', 'Pot', 'ceramic-matte-white'), matSlot('soil', 'Soil & moss pole', 'moss-pole'), matSlot('leaf', 'Leaves', 'leaf-monstera'), matSlot('stems', 'Stalks & aerial roots', 'stem-green')],
  build: (size) => {
    const { h } = size;
    const m = halfMin(size);
    const box = plantBox(size);
    const pot = planter('pot', 'soil', m * 0.36, clamp(h * 0.26, 0.2, 0.4), 'cylinder', { mound: 0.4 });
    const parts: Part[] = [...pot.parts];
    const rand = rng(71);
    const H = h - pot.top;
    const poleTop = pot.top + H * 0.72;
    parts.push(cyl('soil', [0, (pot.top + poleTop) / 2, -0.03], 0.026, poleTop - pot.top, { segments: 10, plan: false }));
    const n = clamp(Math.round(h * 7), 6, 11);
    for (const i of range(n)) {
      const frac = i / (n - 1);
      const az = i * GOLDEN + 0.4;
      const base = polar(pot.rIn * 0.35, az, pot.top);
      // Older leaves low and wide, younger ones higher up the pole.
      const T = vadd(polar(m * lerp(0.15, 0.4, rand()) * (1 - frac * 0.5), az), [0, lerp(pot.top + H * 0.3, pot.top + H * 0.82, frac), 0]);
      const C = vadd(vmul(vadd(base, T), 0.5), [0, H * 0.12, 0]);
      const L = clamp(H * 0.4, 0.2, 0.55) * lerp(0.8, 1.05, rand()) * (1 - 0.3 * frac);
      const adult = frac < 0.85;
      const notches: Notch[] = adult
        ? [0.2, 0.32, 0.42, 0.62, 0.74, 0.86].flatMap((t) =>
            ([1, -1] as const).map((side) => ({ t: t + (rand() - 0.5) * 0.02, side, depth: lerp(0.08, 0.24, rand()), back: 0.06, gap: 0.028 })),
          )
        : [];
      const blade = bladeLeaf('leaf', T, L, knotWidth(L * 0.95, MONSTERA), az + (rand() - 0.5) * 0.3, lerp(1.25, 1.6, rand()), {
        segs: 2,
        bend: lerp(0.25, 0.5, rand()),
        fold: 0.12,
        roll: (rand() - 0.5) * 0.4,
        thick: 0.006,
        samples: 9,
        notches,
        lobes: { len: 0.14, flare: 0.04, point: 0 },
        plan: i < 3,
      });
      parts.push(...fitGroup([...stemPath('stems', bezier(base, C, T, 2), 0.009, 0.007), ...blade.parts], base, box));
    }
    // Aerial roots reaching for the soil.
    for (const r of range(3)) {
      const a = r * 2.2 + 0.5;
      const A = polar(0.03, a, pot.top + H * lerp(0.3, 0.5, r / 2));
      parts.push(...stemPath('stems', [A, polar(pot.rIn * 0.6, a + 0.2, lerp(A[1], pot.top, 0.5)), polar(pot.rIn * 0.75, a + 0.3, pot.top + 0.005)], 0.004, 0.003));
    }
    return containParts(parts, box);
  },
  planDetail: potAndCanopy(0.18, 0.46, 7),
  plant: PLANT_SPECIES['monstera-deliciosa'],
});

const zzPlant = defineItem({
  id: 'zz-plant',
  name: 'ZZ plant',
  category: 'plants',
  type: 'plants',
  group: 'Indoor plants',
  tags: tags('zz plant', 'zamioculcas', 'zanzibar gem', 'low light', 'glossy leaves', 'drought tolerant', 'beginner'),
  description: 'Zamioculcas zamiifolia: upright, gently arching stems lined with glossy oval leaflets, in a square white planter.',
  defaultSize: { w: 0.5, d: 0.5, h: 0.8 },
  minSize: { w: 0.3, d: 0.3, h: 0.45 },
  maxSize: { w: 0.85, d: 0.85, h: 1.25 },
  slots: [matSlot('pot', 'Planter', 'ceramic-matte-white'), matSlot('soil', 'Soil', 'potting-soil'), matSlot('leaf', 'Leaflets', 'leaf-zz'), matSlot('stem', 'Stems', 'stem-zz')],
  build: (size) => {
    const { h } = size;
    const m = halfMin(size);
    const box = plantBox(size);
    const k = scaleOf(h, 0.8);
    const pot = planter('pot', 'soil', m * 0.44, clamp(h * 0.28, 0.13, 0.3), 'cube');
    const parts: Part[] = [...pot.parts];
    const rand = rng(83);
    const H = h - pot.top;
    const UP: V3 = [0, 1, 0];
    for (const i of range(9)) {
      const az = i * GOLDEN;
      const base = polar(pot.rIn * 0.45 * rand(), az + 2, pot.top);
      const t0 = lerp(0.05, 0.45, rand());
      const S = H * lerp(0.72, 1, rand());
      const tip = vadd(base, vmul(dirOf(az, t0 + 0.25), S));
      const mid = vadd(base, vmul(dirOf(az, t0), S * 0.55));
      const path = bezier(base, mid, tip, 2);
      const g: Part[] = [rod('stem', base, path[1], 0.012 * k, { rTop: 0.007 * k, segments: 7, plan: false }), rod('stem', path[1], tip, 0.007 * k, { rTop: 0.003 * k, segments: 6, plan: false })];
      // Five pairs of leaflets and one at the tip, angled forwards along the stem.
      for (const q of range(11)) {
        const pair = Math.floor(q / 2);
        const tq = q === 10 ? 1 : lerp(0.36, 0.92, pair / 4);
        const P = along(path, tq);
        const d = vnorm(vsub(along(path, Math.min(1, tq + 0.05)), along(path, Math.max(0, tq - 0.05))));
        const side = vnorm(vcross(d, UP));
        const dir = q === 10 ? d : vnorm(vadd(vadd(vmul(side, q % 2 ? 0.85 : -0.85), vmul(d, 0.55)), [0, 0.1, 0]));
        const az2 = Math.atan2(dir[2], dir[0]);
        const tilt = Math.acos(clamp(dir[1], -1, 1));
        const ll = 0.065 * k * (1 - 0.25 * tq) * lerp(0.9, 1.1, rand());
        g.push(...bladeLeaf('leaf', P, ll, ovateWidth(ll * 0.52, 0.48, 0.6), az2, tilt, { thick: 0.004, roll: (q % 2 ? 1 : -1) * 0.5 + (rand() - 0.5) * 0.3, samples: 6, plan: i < 2 && q < 2 }).parts);
      }
      parts.push(...fitGroup(g, base, box));
    }
    return containParts(parts, box);
  },
  planDetail: ({ w, d }) => [rectPoly(-Math.min(w, d) * 0.22, -Math.min(w, d) * 0.22, Math.min(w, d) * 0.22, Math.min(w, d) * 0.22), canopyPlan(w * 0.42, d * 0.42, 9)],
  plant: PLANT_SPECIES['zamioculcas-zamiifolia'],
});

const SNAKE: V2[] = [
  [0, 0.45],
  [0.15, 0.85],
  [0.5, 1],
  [0.8, 0.8],
  [0.95, 0.3],
  [1, 0],
];

const snakePlant = defineItem({
  id: 'snake-plant',
  name: "Snake plant 'Laurentii'",
  category: 'plants',
  type: 'plants',
  group: 'Indoor plants',
  tags: tags('snake plant', 'sansevieria', 'dracaena trifasciata', 'laurentii', "mother-in-law's tongue", 'low light', 'beginner', 'bedroom'),
  description: "Dracaena trifasciata 'Laurentii': stiff, banded sword leaves with golden edges, in a speckled stoneware pot.",
  defaultSize: { w: 0.4, d: 0.4, h: 0.9 },
  minSize: { w: 0.25, d: 0.25, h: 0.45 },
  maxSize: { w: 0.65, d: 0.65, h: 1.3 },
  slots: [matSlot('pot', 'Pot', 'speckled-stoneware'), matSlot('soil', 'Soil', 'potting-soil'), matSlot('leaf', 'Leaves', 'leaf-snake'), matSlot('edge', 'Leaf edges', 'snake-edge')],
  build: (size) => {
    const { h } = size;
    const m = halfMin(size);
    const box = plantBox(size);
    const pot = planter('pot', 'soil', m * 0.6, clamp(h * 0.28, 0.13, 0.3), 'cylinder');
    const parts: Part[] = [...pot.parts];
    const rand = rng(97);
    const H = h - pot.top;
    for (const i of range(9)) {
      const az = i * GOLDEN + rand() * 0.3;
      const base = polar(pot.rIn * lerp(0.05, 0.6, rand()), az, pot.top - 0.005);
      const len = H * lerp(0.6, 1, rand()) * (i < 2 ? 0.6 : 1);
      const W = len * lerp(0.11, 0.15, rand());
      const hw = knotWidth(W, SNAKE);
      const tilt = lerp(0.02, 0.28, rand());
      const o = { segs: 2, bend: lerp(0.02, 0.12, rand()), fold: 0.32, roll: (rand() - 0.5) * 0.8, twist: (rand() - 0.5) * 0.4, samples: 7 };
      const inner = bladeLeaf('leaf', base, len * 0.995, (t) => hw(t) * 0.86, az, tilt, { ...o, thick: 0.007, plan: i % 3 === 0 });
      const edge = bladeLeaf('edge', base, len, hw, az, tilt, { ...o, thick: 0.0035 });
      parts.push(...fitGroup([...inner.parts, ...edge.parts], base, box));
    }
    return containParts(parts, box);
  },
  planDetail: ({ w, d }) => [circle([0, 0], Math.min(w, d) * 0.3), starPlan(Math.min(w, d) * 0.36, 9, 0.35)],
  plant: PLANT_SPECIES['dracaena-trifasciata'],
});

const peaceLily = defineItem({
  id: 'peace-lily',
  name: 'Peace lily in bloom',
  category: 'plants',
  type: 'plants',
  group: 'Indoor plants',
  tags: tags('peace lily', 'spathiphyllum', 'white flowers', 'low light', 'bathroom', 'glossy leaves'),
  description: 'Spathiphyllum with glossy, arching lance leaves and white spathe flowers on tall stems, in a speckled egg-shaped pot.',
  defaultSize: { w: 0.6, d: 0.6, h: 0.7 },
  minSize: { w: 0.35, d: 0.35, h: 0.4 },
  maxSize: { w: 1.0, d: 1.0, h: 1.1 },
  slots: [matSlot('pot', 'Pot', 'speckled-stoneware'), matSlot('soil', 'Soil', 'potting-soil'), matSlot('leaf', 'Leaves & stems', 'leaf-spathiphyllum'), matSlot('flower', 'Flowers', 'spathe-white')],
  build: (size) => {
    const { h } = size;
    const m = halfMin(size);
    const box = plantBox(size);
    const k = scaleOf(h, 0.7);
    const pot = planter('pot', 'soil', m * 0.46, clamp(h * 0.28, 0.13, 0.3), 'egg');
    const parts: Part[] = [...pot.parts];
    const rand = rng(103);
    const H = h - pot.top;
    for (const i of range(15)) {
      const az = i * GOLDEN;
      const base = polar(pot.rIn * 0.25 * rand(), az, pot.top);
      const t0 = lerp(0.2, 0.75, rand());
      const P = vadd(base, vmul(dirOf(az, t0), H * lerp(0.22, 0.38, rand())));
      const len = H * lerp(0.42, 0.56, rand());
      const blade = bladeLeaf('leaf', P, len, ovateWidth(len * 0.36, 0.42, 0.7), az + (rand() - 0.5) * 0.2, t0 + 0.2, { segs: 2, bend: lerp(0.4, 0.75, rand()), fold: 0.22, thick: 0.004, samples: 7, plan: i < 4 });
      parts.push(...fitGroup([rod('leaf', base, P, 0.004, { segments: 5, plan: false }), ...blade.parts], base, box));
    }
    for (const f of range(4)) {
      const az = f * 1.7 + 0.3;
      const base = polar(pot.rIn * 0.2, az, pot.top);
      const top = vadd(base, vmul(dirOf(az, lerp(0.06, 0.2, rand())), H * lerp(0.78, 0.95, rand())));
      const sl = 0.12 * k;
      const spathe = bladeLeaf('flower', top, sl, ovateWidth(sl * 0.62, 0.45, 0.6), az + Math.PI, 0.2, { fold: 0.6, thick: 0.003, samples: 7 });
      const front = onBlade(spathe, 0.15, 0, 0.012).p;
      parts.push(
        ...fitGroup(
          [rod('leaf', base, top, 0.0035, { segments: 5, plan: false }), ...spathe.parts, rod('flower', front, vadd(front, vmul(dirOf(az, 0.2), 0.055 * k)), 0.0075 * k, { rTop: 0.005 * k, segments: 8, plan: false })],
          base,
          box,
        ),
      );
    }
    return containParts(parts, box);
  },
  planDetail: potAndCanopy(0.23, 0.45, 10),
  plant: PLANT_SPECIES['spathiphyllum-wallisii'],
});

const calathea = defineItem({
  id: 'calathea-orbifolia',
  name: 'Calathea orbifolia',
  category: 'plants',
  type: 'plants',
  group: 'Indoor plants',
  tags: tags('calathea', 'orbifolia', 'goeppertia', 'prayer plant', 'striped leaves', 'round leaves', 'pet safe', 'bathroom'),
  description: 'Goeppertia orbifolia with broad round leaves striped silver-green, on upright stalks in a footed white bowl.',
  defaultSize: { w: 0.6, d: 0.6, h: 0.65 },
  minSize: { w: 0.35, d: 0.35, h: 0.35 },
  maxSize: { w: 0.95, d: 0.95, h: 1.0 },
  slots: [matSlot('pot', 'Pot', 'ceramic-matte-white'), matSlot('soil', 'Soil', 'potting-soil'), matSlot('leaf', 'Leaves', 'leaf-orbifolia'), matSlot('stems', 'Stalks', 'stem-green')],
  build: (size) => {
    const { h } = size;
    const m = halfMin(size);
    const box = plantBox(size);
    const pot = planter('pot', 'soil', m * 0.44, clamp(h * 0.3, 0.12, 0.28), 'footed');
    const parts: Part[] = [...pot.parts];
    const rand = rng(109);
    const H = h - pot.top;
    const L = clamp(H * 0.42, 0.13, 0.36);
    for (const i of range(12)) {
      const az = i * GOLDEN;
      const base = polar(pot.rIn * 0.3 * rand(), az, pot.top);
      const t0 = lerp(0.08, 0.6, rand());
      const P = vadd(base, vmul(dirOf(az, t0), H * lerp(0.32, 0.58, rand())));
      const len = L * lerp(0.75, 1.05, rand());
      const blade = bladeLeaf('leaf', P, len, ovateWidth(len * 0.92, 0.47, 0.45), az + (rand() - 0.5) * 0.3, t0 + lerp(0.55, 0.95, rand()), {
        segs: 2,
        bend: lerp(0.15, 0.35, rand()),
        fold: 0.12,
        roll: (rand() - 0.5) * 0.3,
        thick: 0.0035,
        samples: 8,
        wave: { amp: 0.03, n: 6 },
        plan: i < 4,
      });
      parts.push(...fitGroup([rod('stems', base, P, 0.0035, { segments: 5, plan: false }), ...blade.parts], base, box));
    }
    return containParts(parts, box);
  },
  planDetail: potAndCanopy(0.22, 0.45, 8),
  plant: PLANT_SPECIES['goeppertia-orbifolia'],
});

const HEART: V2[] = [
  [0, 0.72],
  [0.3, 1],
  [0.68, 0.62],
  [1, 0],
];

/** Heart-shaped leaf `ll` long (pothos, philodendron, string of hearts). */
const heartLeaf = (slot: string, P: V3, ll: number, az: number, tilt: number, o: { roll?: number; fold?: number; thick?: number; wide?: number; plan?: boolean } = {}) =>
  bladeLeaf(slot, P, ll, knotWidth(ll * (o.wide ?? 0.78), HEART), az, tilt, { thick: o.thick ?? 0.003, fold: o.fold, roll: o.roll, samples: 6, lobes: { len: 0.13, flare: 0.04, point: 0.1 }, plan: o.plan }).parts;

const pothosStand = defineItem({
  id: 'pothos-on-stand',
  name: 'Golden pothos on a plant stand',
  category: 'plants',
  type: 'plants',
  group: 'Hanging plants',
  tags: tags('pothos', 'golden pothos', 'epipremnum aureum', "devil's ivy", 'trailing', 'plant stand', 'mid-century', 'low light', 'beginner'),
  description: 'Epipremnum aureum with gold-marbled heart leaves trailing to the floor from a white pot on a mid-century wooden plant stand.',
  defaultSize: { w: 0.55, d: 0.55, h: 1.0 },
  minSize: { w: 0.35, d: 0.35, h: 0.7 },
  maxSize: { w: 0.85, d: 0.85, h: 1.4 },
  slots: [matSlot('stand', 'Plant stand', 'oak-stand'), matSlot('pot', 'Pot', 'ceramic-matte-white'), matSlot('soil', 'Soil', 'potting-soil'), matSlot('leaf', 'Leaves & vines', 'leaf-pothos')],
  build: (size) => {
    const { h } = size;
    const m = halfMin(size);
    const box = plantBox(size);
    const standH = clamp(h * 0.5, 0.3, 0.7);
    const potR = m * 0.38;
    const potH = clamp(h * 0.2, 0.13, 0.24);
    const parts: Part[] = [...plantStand('stand', m * 0.42, standH, m, 4)];
    const pot = planter('pot', 'soil', potR, potH, 'cylinder', { y0: standH });
    parts.push(...pot.parts);
    const rand = rng(113);
    const yRim = standH + potH;
    for (const v of range(7)) {
      const a = (v / 7) * TAU + rand() * 0.4;
      const path = trailPath(a, pot.rIn, potR, pot.top, yRim, lerp(0.04, standH * 0.75, rand()), m * lerp(0.6, 0.92, rand()), (rand() - 0.5) * 0.6);
      const g: Part[] = [...stemPath('leaf', path, 0.0025, 0.0018)];
      for (const j of range(6)) {
        const t = lerp(0.12, 1, j / 5);
        const P = along(path, t);
        g.push(...heartLeaf('leaf', P, 0.07 * lerp(1, 0.7, t) * lerp(0.85, 1.1, rand()), a + (j % 2 ? 0.8 : -0.8), lerp(1.35, 2.0, rand()), { fold: 0.12, roll: (rand() - 0.5) * 0.6 }));
      }
      parts.push(...fitGroup(g, path[0], box));
    }
    for (const i of range(8)) {
      const az = i * GOLDEN;
      const base = polar(pot.rIn * 0.4 * rand(), az, pot.top);
      const P = vadd(base, vmul(dirOf(az, lerp(0.3, 0.9, rand())), 0.06));
      parts.push(...fitGroup([rod('leaf', base, P, 0.0025, { segments: 5, plan: false }), ...heartLeaf('leaf', P, 0.085 * lerp(0.85, 1.1, rand()), az, lerp(0.7, 1.3, rand()), { fold: 0.14, plan: i < 2 })], base, box));
    }
    return containParts(parts, box);
  },
  planDetail: ({ w, d }) => {
    const m = Math.min(w, d) / 2;
    return [circle([0, 0], m * 0.42), circle([0, 0], m * 0.38), canopyPlan(w * 0.44, d * 0.44, 8)];
  },
  plant: PLANT_SPECIES['epipremnum-aureum'],
});

const ALOCASIA: V2[] = [
  [0, 0.85],
  [0.15, 1],
  [0.5, 0.72],
  [0.85, 0.3],
  [1, 0],
];

const alocasia = defineItem({
  id: 'alocasia-polly',
  name: "Alocasia 'Polly'",
  category: 'plants',
  type: 'plants',
  group: 'Indoor plants',
  tags: tags('alocasia', 'polly', 'amazonica', 'elephant ear', 'african mask', 'white veins', 'arrow leaves', 'tropical'),
  description: "Alocasia × amazonica 'Polly' with dark arrow-shaped, scalloped leaves and bold white veins, in a glossy black pot.",
  defaultSize: { w: 0.5, d: 0.5, h: 0.6 },
  minSize: { w: 0.3, d: 0.3, h: 0.35 },
  maxSize: { w: 0.8, d: 0.8, h: 1.0 },
  slots: [matSlot('pot', 'Pot', 'ceramic-black'), matSlot('soil', 'Soil', 'potting-soil'), matSlot('leaf', 'Leaves & stalks', 'leaf-polly'), matSlot('veins', 'Veins', 'vein-white')],
  build: (size) => {
    const { h } = size;
    const m = halfMin(size);
    const box = plantBox(size);
    const pot = planter('pot', 'soil', m * 0.44, clamp(h * 0.3, 0.12, 0.26), 'taper');
    const parts: Part[] = [...pot.parts];
    const rand = rng(127);
    const H = h - pot.top;
    const L0 = clamp(H * 0.45, 0.12, 0.34);
    for (const i of range(7)) {
      const az = i * GOLDEN;
      const base = polar(pot.rIn * 0.2 * rand(), az, pot.top);
      const t0 = lerp(0.12, 0.6, rand());
      const P = vadd(base, vmul(dirOf(az, t0), H * lerp(0.3, 0.55, rand())));
      const L = L0 * lerp(0.75, 1.05, rand());
      const th = 0.004;
      const hw = knotWidth(L * 0.62, ALOCASIA);
      const blade = bladeLeaf('leaf', P, L, hw, az + (rand() - 0.5) * 0.3, lerp(1.45, 1.85, rand()), {
        thick: th,
        samples: 12,
        roll: (rand() - 0.5) * 0.3,
        wave: { amp: 0.07, n: 9 },
        lobes: { len: 0.3, flare: 0.12, point: 0.9 },
        plan: i < 3,
      });
      const up = th * 0.5 + 0.0012;
      const vr = 0.0018 * clamp(L / 0.25, 0.7, 1.3);
      const g: Part[] = [rod('leaf', base, P, 0.0045, { rTop: 0.0035, segments: 5, plan: false }), ...blade.parts];
      g.push(rod('veins', onBlade(blade, 0, 0, up).p, onBlade(blade, 0.93, 0, up).p, vr * 1.3, { rTop: vr * 0.6, segments: 5, plan: false }));
      for (const tv of [0.1, 0.27, 0.44, 0.61]) {
        for (const sd of [1, -1]) g.push(rod('veins', onBlade(blade, tv, 0, up).p, onBlade(blade, tv + 0.17, sd * hw(tv + 0.17) * 0.88, up).p, vr, { rTop: vr * 0.5, segments: 4, plan: false }));
      }
      for (const sd of [1, -1]) g.push(rod('veins', onBlade(blade, 0, 0, up).p, onBlade(blade, -0.26, sd * hw(0) * 0.95, up).p, vr, { rTop: vr * 0.5, segments: 4, plan: false }));
      parts.push(...fitGroup(g, base, box));
    }
    return containParts(parts, box);
  },
  planDetail: potAndCanopy(0.22, 0.45, 7),
  plant: PLANT_SPECIES['alocasia-polly'],
});

const aloeVera = defineItem({
  id: 'aloe-vera',
  name: 'Aloe vera with pups',
  category: 'plants',
  type: 'plants',
  group: 'Succulents & cacti',
  tags: tags('aloe vera', 'aloe barbadensis', 'succulent', 'medicinal', 'kitchen', 'sunny windowsill', 'terracotta'),
  description: 'A rosette of thick, toothed, grey-green aloe leaves with two pups at its feet, in a classic terracotta pot.',
  defaultSize: { w: 0.4, d: 0.4, h: 0.5 },
  minSize: { w: 0.22, d: 0.22, h: 0.26 },
  maxSize: { w: 0.7, d: 0.7, h: 0.85 },
  slots: [matSlot('pot', 'Pot', 'terracotta'), matSlot('soil', 'Grit top dressing', 'gravel-top'), matSlot('leaf', 'Leaves', 'leaf-aloe')],
  build: (size) => {
    const { h } = size;
    const m = halfMin(size);
    const box = plantBox(size);
    const pot = planter('pot', 'soil', m * 0.56, clamp(h * 0.32, 0.09, 0.22), 'terracotta');
    const parts: Part[] = [...pot.parts];
    const rand = rng(131);
    const H = h - pot.top;
    const rosette = (c: V3, n: number, size: number, seed: number, plan: boolean) => {
      const r = rng(seed);
      for (const i of range(n)) {
        const frac = i / (n - 1);
        const az = i * GOLDEN + r() * 0.2;
        const len = size * lerp(1, 0.62, frac) * lerp(0.9, 1.05, r());
        const W = len * 0.2;
        const tilt = lerp(1.05, 0.2, frac);
        const blade = bladeLeaf('leaf', vadd(c, polar(0.006, az)), len, wedgeWidth(W, 0.2), az, tilt, {
          segs: 2,
          bend: lerp(0.4, 0.08, frac),
          fold: 0.35,
          thick: clamp(W * 0.28, 0.004, 0.016),
          samples: 8,
          teeth: 0.14,
          plan: plan && i < 5,
        });
        parts.push(...fitGroup(blade.parts, c, box));
      }
    };
    rosette([0, pot.top - 0.004, 0], 16, H * 0.98, 7, true);
    for (const p of range(2)) rosette(polar(pot.rIn * 0.65, p * 2.6 + rand(), pot.top - 0.002), 5, H * 0.32, 20 + p, false);
    return containParts(parts, box);
  },
  planDetail: ({ w, d }) => [circle([0, 0], Math.min(w, d) * 0.28), starPlan(Math.min(w, d) * 0.46, 8, 0.3)],
  plant: PLANT_SPECIES['aloe-vera'],
});

const aglaonema = defineItem({
  id: 'aglaonema',
  name: "Chinese evergreen 'Silver Bay'",
  category: 'plants',
  type: 'plants',
  group: 'Indoor plants',
  tags: tags('aglaonema', 'chinese evergreen', 'silver bay', 'variegated', 'low light', 'office', 'blue pot'),
  description: "Aglaonema 'Silver Bay': lance-shaped leaves with silvery centres and dark green margins, in a blue glazed bowl.",
  defaultSize: { w: 0.5, d: 0.5, h: 0.55 },
  minSize: { w: 0.3, d: 0.3, h: 0.3 },
  maxSize: { w: 0.8, d: 0.8, h: 0.9 },
  slots: [matSlot('pot', 'Pot', 'glazed-blue'), matSlot('soil', 'Soil', 'potting-soil'), matSlot('leaf', 'Leaves', 'leaf-aglaonema'), matSlot('stems', 'Stems', 'stem-green')],
  build: (size) => {
    const { h } = size;
    const m = halfMin(size);
    const box = plantBox(size);
    const pot = planter('pot', 'soil', m * 0.48, clamp(h * 0.3, 0.11, 0.26), 'bowl');
    const parts: Part[] = [...pot.parts];
    const rand = rng(137);
    const H = h - pot.top;
    const L0 = clamp(H * 0.48, 0.12, 0.32);
    let j = 0;
    for (const s of range(4)) {
      const a = s * 1.57 + 0.4;
      const base = polar(pot.rIn * 0.3, a, pot.top);
      const top = vadd(base, [Math.cos(a) * 0.02, H * lerp(0.22, 0.4, rand()), Math.sin(a) * 0.02]);
      parts.push(rod('stems', base, top, 0.008, { rTop: 0.006, segments: 6, plan: false }));
      for (const i of range(4)) {
        const P = along([base, top], lerp(0.45, 1, i / 3));
        const az = j * GOLDEN;
        const tilt = lerp(1.25, 0.45, i / 3) + (rand() - 0.5) * 0.2;
        const Q = vadd(P, vmul(dirOf(az, tilt), 0.04));
        const len = L0 * lerp(0.8, 1.05, rand());
        const blade = bladeLeaf('leaf', Q, len, ovateWidth(len * 0.42, 0.42, 0.75), az, tilt + 0.1, { segs: 2, bend: lerp(0.2, 0.45, rand()), fold: 0.15, roll: (rand() - 0.5) * 0.4, thick: 0.004, samples: 7, plan: j < 3 });
        parts.push(...fitGroup([rod('stems', P, Q, 0.0035, { segments: 5, plan: false }), ...blade.parts], P, box));
        j++;
      }
    }
    return containParts(parts, box);
  },
  planDetail: potAndCanopy(0.24, 0.44, 9),
  plant: PLANT_SPECIES['aglaonema-silver-bay'],
});

const parlourPalm = defineItem({
  id: 'parlour-palm',
  name: 'Parlour palm in a basket',
  category: 'plants',
  type: 'plants',
  group: 'Indoor plants',
  tags: tags('parlour palm', 'parlor palm', 'chamaedorea elegans', 'neanthe bella', 'palm', 'low light', 'pet safe', 'woven basket'),
  description: 'Chamaedorea elegans: a clump of fine, feathery palm fronds in a woven seagrass basket with rope handles.',
  defaultSize: { w: 0.5, d: 0.5, h: 0.8 },
  minSize: { w: 0.3, d: 0.3, h: 0.45 },
  maxSize: { w: 0.8, d: 0.8, h: 1.3 },
  slots: [matSlot('pot', 'Basket', 'seagrass-basket'), matSlot('soil', 'Soil', 'potting-soil'), matSlot('leaf', 'Leaflets', 'leaf-parlour'), matSlot('stems', 'Stalks', 'stem-palm')],
  build: (size) => {
    const { h } = size;
    const m = halfMin(size);
    const box = plantBox(size);
    const pot = planter('pot', 'soil', m * 0.46, clamp(h * 0.24, 0.11, 0.26), 'basket', { handles: m * 0.54 });
    const parts: Part[] = [...pot.parts];
    const rand = rng(139);
    const H = h - pot.top;
    const Ll = clamp(H * 0.17, 0.07, 0.17);
    for (const i of range(9)) {
      const az = i * GOLDEN;
      const base = polar(pot.rIn * 0.45 * rand(), az + 2.3, pot.top);
      const t0 = lerp(0.12, 0.55, rand());
      const start = vadd(base, vmul(dirOf(az, t0), H * lerp(0.22, 0.38, rand())));
      const fr = pinnateFrond('leaf', 'stems', start, H * lerp(0.45, 0.62, rand()), az, t0 + 0.1, {
        segs: 2,
        bend: lerp(0.5, 0.8, rand()),
        leaflet: (t) => Ll * Math.pow(Math.sin(Math.PI * clamp(0.1 + 0.9 * t, 0, 1)), 0.7),
        lw: 0.012,
        spacing: 0.028,
        beta: 0.7,
        vee: -0.2,
        from: 0,
        rachis: 0.0035,
        plan: i < 3,
      });
      parts.push(...fitGroup([rod('stems', base, start, 0.005, { rTop: 0.004, segments: 6, plan: false }), ...fr], base, box));
    }
    return containParts(parts, box);
  },
  planDetail: potAndCanopy(0.23, 0.44, 11),
  plant: PLANT_SPECIES['chamaedorea-elegans'],
});

const NEST: V2[] = [
  [0, 0.2],
  [0.15, 0.6],
  [0.55, 1],
  [0.85, 0.75],
  [1, 0],
];

const birdsNestFern = defineItem({
  id: 'birds-nest-fern',
  name: "Bird's nest fern",
  category: 'plants',
  type: 'plants',
  group: 'Indoor plants',
  tags: tags("bird's nest fern", 'asplenium nidus', 'fern', 'bathroom', 'humidity', 'pet safe', 'rippled leaves'),
  description: 'Asplenium nidus: a shuttlecock of glossy, rippled apple-green fronds with dark midribs around a furry nest, in a white egg pot.',
  defaultSize: { w: 0.55, d: 0.55, h: 0.55 },
  minSize: { w: 0.32, d: 0.32, h: 0.3 },
  maxSize: { w: 0.9, d: 0.9, h: 0.9 },
  slots: [matSlot('pot', 'Pot', 'ceramic-matte-white'), matSlot('soil', 'Soil', 'potting-soil'), matSlot('leaf', 'Fronds', 'leaf-nest'), matSlot('rib', 'Midribs & nest', 'stem-dark')],
  build: (size) => {
    const { h } = size;
    const m = halfMin(size);
    const box = plantBox(size);
    const pot = planter('pot', 'soil', m * 0.42, clamp(h * 0.36, 0.12, 0.28), 'egg');
    const parts: Part[] = [...pot.parts, ball('rib', [0, pot.top + 0.01, 0], m * 0.1, { scale: [1, 0.55, 1], segments: 10 })];
    const rand = rng(149);
    const H = h - pot.top;
    const n = 14;
    for (const i of range(n)) {
      const frac = i / (n - 1);
      const az = i * GOLDEN;
      const len = H * lerp(1.1, 0.75, frac) * lerp(0.9, 1.05, rand());
      const W = len * 0.3;
      const blade = bladeLeaf('leaf', polar(0.015, az, pot.top + 0.01), len, knotWidth(W, NEST), az, lerp(0.95, 0.2, frac), {
        segs: 2,
        bend: lerp(0.55, 0.25, frac),
        fold: 0.2,
        thick: 0.004,
        samples: 9,
        wave: { amp: 0.1, n: 7 },
        rib: { slot: 'rib', r: 0.0035 },
        plan: i < 5,
      });
      parts.push(...fitGroup(blade.parts, [0, pot.top, 0], box));
    }
    return containParts(parts, box);
  },
  planDetail: ({ w, d }) => [circle([0, 0], Math.min(w, d) * 0.21), starPlan(Math.min(w, d) * 0.47, 10, 0.55)],
  plant: PLANT_SPECIES['asplenium-nidus'],
});

// ---------------------------------------------------------------------------
// Tabletop plants
// ---------------------------------------------------------------------------

const orchid = defineItem({
  id: 'moth-orchid',
  name: 'Moth orchid',
  category: 'plants',
  type: 'plants',
  group: 'Indoor plants',
  tags: tags('orchid', 'phalaenopsis', 'moth orchid', 'white flowers', 'flowering', 'tabletop', 'pet safe', 'bathroom'),
  description: 'Phalaenopsis with broad leathery leaves, silvery aerial roots and an arching spike of white moth-shaped flowers, in bark in a white pot.',
  defaultSize: { w: 0.32, d: 0.26, h: 0.6 },
  minSize: { w: 0.22, d: 0.18, h: 0.38 },
  maxSize: { w: 0.5, d: 0.4, h: 0.85 },
  slots: [matSlot('pot', 'Pot', 'ceramic-white'), matSlot('leaf', 'Leaves', 'leaf-orchid'), matSlot('flower', 'Flowers', 'orchid-white'), matSlot('roots', 'Roots, spike & bark', 'orchid-root')],
  build: (size) => {
    const { w, d, h } = size;
    const m = halfMin(size);
    const box = plantBox(size);
    const k = scaleOf(h, 0.6);
    const pot = planter('pot', 'roots', m * 0.72, clamp(h * 0.22, 0.09, 0.17), 'cylinder');
    const parts: Part[] = [...pot.parts, ...pebbles('roots', pot.rIn, pot.top, 6, 0.012 * k, 3)];
    const y = pot.top + 0.008;
    const leafAz = [0, Math.PI, 0.25, Math.PI + 0.3];
    for (const [i, az] of leafAz.entries()) {
      const len = clamp(Math.max(w, d) * 0.5, 0.1, 0.24) * lerp(1, 0.75, i / 3);
      const blade = bladeLeaf('leaf', [0, y + i * 0.01, 0], len, ovateWidth(len * 0.42, 0.58, 0.5), az, lerp(1.2, 1.0, i / 3), { segs: 2, bend: 0.4, fold: 0.2, thick: 0.004, samples: 7, plan: i < 2 });
      parts.push(...fitGroup(blade.parts, [0, y, 0], box));
    }
    // Aerial roots over the rim.
    for (const r of range(3)) {
      const a = r * 2.3 + 1;
      parts.push(...fitGroup(stemPath('roots', [polar(0.01, a, y), polar(pot.rIn + 0.012, a, y + 0.015), polar(pot.rIn + 0.02, a + 0.2, y - 0.04)], 0.003, 0.0025), [0, y, 0], box));
    }
    // Flower spike arching to the front, with a bamboo-like stake.
    const spike: V3[] = [
      [0.01, y, -0.01],
      [0.0, lerp(y, h, 0.5), 0],
      [0.015, h * 0.8, 0.03],
      [0.05 * k, h * 0.93, d * 0.2],
      [0.09 * k, h * 0.9, d * 0.33],
      [0.12 * k, h * 0.8, d * 0.42],
    ];
    parts.push(...stemPath('roots', spike, 0.0032, 0.0022, 5));
    const fr = 0.044 * k;
    const facing = vnorm([0.15, 0.2, 1]);
    const F = facingFrame(facing);
    for (const i of range(6)) {
      const C = vadd(along(spike, lerp(0.6, 0.94, i / 5)), [0, -fr * 0.6, fr * 0.3]);
      const at = (x: number, yy: number, z = 0): V3 => vadd(vadd(vadd(C, vmul(F.W, x * fr)), vmul(F.L, yy * fr)), vmul(F.N, z * fr));
      const s = lerp(1, 0.8, i / 5);
      parts.push(
        discFacing('flower', at(0, 0.5 * s), facing, fr * 0.32 * s, 0.003, { scale: [0.8, 1, 1.15] }),
        discFacing('flower', at(-0.32 * s, -0.36 * s), facing, fr * 0.3 * s, 0.003, { scale: [0.8, 1, 1.1] }),
        discFacing('flower', at(0.32 * s, -0.36 * s), facing, fr * 0.3 * s, 0.003, { scale: [0.8, 1, 1.1] }),
        discFacing('flower', at(-0.46 * s, 0.02, 0.05), facing, fr * 0.44 * s, 0.003),
        discFacing('flower', at(0.46 * s, 0.02, 0.05), facing, fr * 0.44 * s, 0.003),
        ball('flower', at(0, -0.12 * s, 0.18), fr * 0.16 * s, { scale: [1.2, 1, 0.8] }),
      );
    }
    parts.push(ball('flower', vadd(spike[5], [0.004, -0.01, 0.006]), 0.009 * k), ball('flower', vadd(spike[5], [0.01, -0.003, 0.012]), 0.006 * k));
    return containParts(parts, box);
  },
  planDetail: ({ w, d }) => [circle([0, 0], Math.min(w, d) * 0.36), poly([[-w * 0.45, 0], [0, -d * 0.12], [w * 0.45, 0], [0, d * 0.12]])],
  plant: PLANT_SPECIES['phalaenopsis'],
});

const goldenBarrel = defineItem({
  id: 'golden-barrel-cactus',
  name: 'Golden barrel cactus',
  category: 'plants',
  type: 'plants',
  group: 'Succulents & cacti',
  tags: tags('cactus', 'golden barrel', 'echinocactus grusonii', 'kroenleinia', 'succulent', 'sunny windowsill', 'spines', 'pet safe'),
  description: 'A ribbed green globe studded with golden spine clusters and a woolly crown, in a wide terracotta bowl with grit.',
  defaultSize: { w: 0.32, d: 0.32, h: 0.34 },
  minSize: { w: 0.18, d: 0.18, h: 0.18 },
  maxSize: { w: 0.55, d: 0.55, h: 0.55 },
  slots: [matSlot('pot', 'Bowl', 'terracotta'), matSlot('soil', 'Grit', 'gravel-top'), matSlot('body', 'Cactus', 'cactus-green'), matSlot('spines', 'Spines', 'spine-gold')],
  build: (size) => {
    const { h } = size;
    const m = halfMin(size);
    const box = plantBox(size);
    const pot = planter('pot', 'soil', m * 0.94, clamp(h * 0.34, 0.06, 0.16), 'bowl');
    const parts: Part[] = [...pot.parts];
    const R = Math.min(m * 0.74, (h - pot.top) / 1.72);
    const cy = pot.top + R * 0.7;
    parts.push(sphere('body', [0, cy, 0], R));
    const ribs = clamp(Math.round(R * 110), 14, 24);
    const star: V2[] = range(12).map((i) => {
      const a = (i / 12) * TAU;
      const r = (i % 2 ? 0.35 : 1) * R * 0.15;
      return [Math.cos(a) * r, Math.sin(a) * r];
    });
    for (const i of range(ribs)) {
      const a = (i / ribs) * TAU;
      parts.push(torus('body', [0, cy, 0], R * 0.965, R * 0.075, { arc: Math.PI * 0.86, rotation: [0, -a, -Math.PI * 0.36], plan: false }));
      for (const [q, phi] of [-0.15, 0.25, 0.62, 0.98].entries()) {
        if (q === 3 && i % 2) continue;
        const n: V3 = [Math.cos(phi) * Math.cos(a), Math.sin(phi), Math.cos(phi) * Math.sin(a)];
        parts.push(leafPanel('spines', vadd([0, cy, 0], vmul(n, R * 1.04)), facingFrame(n), star, 0.003));
      }
    }
    parts.push(ball('spines', [0, cy + R * 0.97, 0], R * 0.2, { scale: [1, 0.4, 1], segments: 10 }));
    return containParts(parts, box);
  },
  planDetail: ({ w, d }) => [circle([0, 0], Math.min(w, d) * 0.47), starPlan(Math.min(w, d) * 0.37, 16, 0.86)],
  plant: PLANT_SPECIES['kroenleinia-grusonii'],
});

const bunnyEars = defineItem({
  id: 'bunny-ears-cactus',
  name: 'Bunny ears cactus',
  category: 'plants',
  type: 'plants',
  group: 'Succulents & cacti',
  tags: tags('cactus', 'bunny ears', 'opuntia microdasys', 'prickly pear', 'pads', 'succulent', 'sunny windowsill'),
  description: 'Opuntia microdasys: branching flat oval pads dotted with tufts of cream glochids, in a small white pot.',
  defaultSize: { w: 0.32, d: 0.3, h: 0.4 },
  minSize: { w: 0.2, d: 0.2, h: 0.24 },
  maxSize: { w: 0.55, d: 0.5, h: 0.7 },
  slots: [matSlot('pot', 'Pot', 'ceramic-white'), matSlot('soil', 'Grit', 'gravel-top'), matSlot('pad', 'Pads', 'opuntia-pad'), matSlot('glochid', 'Glochids', 'glochid-cream')],
  build: (size) => {
    const { h } = size;
    const m = halfMin(size);
    const box = plantBox(size);
    const k = scaleOf(h, 0.4);
    const pot = planter('pot', 'soil', m * 0.46, clamp(h * 0.22, 0.06, 0.14), 'cylinder');
    const parts: Part[] = [...pot.parts];
    const rand = rng(157);
    const pw = 0.1 * k;
    const ph = 0.135 * k;
    const pt = 0.02 * k;
    const pad = (base: V3, az: number, tilt: number, s: number, depth: number) => {
      const f = leafFrame(az, tilt, Math.PI / 2 + (rand() - 0.5) * 0.4);
      const c = vadd(base, vmul(f.L, ph * s * 0.48));
      const g: Part[] = [ellipsoid('pad', c, f, [pw * s, ph * s, pt * s], { plan: depth === 0 })];
      for (const sd of [1, -1]) {
        for (const [x, yy] of [
          [-0.25, -0.2],
          [0.25, -0.2],
          [0, 0.1],
          [-0.22, 0.32],
          [0.22, 0.32],
        ] as V2[]) {
          g.push(ball('glochid', vadd(vadd(vadd(c, vmul(f.W, x * pw * s)), vmul(f.L, yy * ph * s)), vmul(f.N, sd * pt * s * 0.42)), 0.0045 * k * s, { segments: 5 }));
        }
      }
      parts.push(...fitGroup(g, base, box));
      if (depth < 2) {
        const top = vadd(base, vmul(f.L, ph * s * 0.9));
        const kids = depth === 0 ? 2 : rand() < 0.6 ? 1 : 0;
        for (const q of range(kids)) {
          const side = kids === 1 ? (rand() < 0.5 ? 1 : -1) : q ? 1 : -1;
          const dir = vnorm(vadd(vmul(f.W, side * 0.55 * pw * s), vmul(f.L, ph * s * 0.2)));
          pad(vadd(top, vmul(dir, -0.01)), Math.atan2(dir[2], dir[0]) + (rand() - 0.5) * 0.3, Math.min(1.1, tilt + lerp(0.35, 0.6, rand())), s * 0.78, depth + 1);
        }
      }
    };
    for (const i of range(2)) pad(polar(pot.rIn * 0.3, i * Math.PI + 0.4, pot.top - 0.01), i * Math.PI + 0.4, lerp(0.1, 0.3, rand()), i ? 0.85 : 1, 0);
    return containParts(parts, box);
  },
  planDetail: ({ w, d }) => [circle([0, 0], Math.min(w, d) * 0.29), canopyPlan(w * 0.4, d * 0.4, 5)],
  plant: PLANT_SPECIES['opuntia-microdasys'],
});

const stringOfPearls = defineItem({
  id: 'string-of-pearls',
  name: 'String of pearls on a pedestal',
  category: 'plants',
  type: 'plants',
  group: 'Succulents & cacti',
  tags: tags('string of pearls', 'senecio rowleyanus', 'curio rowleyanus', 'trailing', 'succulent', 'pedestal bowl', 'shelf'),
  description: 'Curio rowleyanus spilling strands of round green beads over the rim of a footed bowl on a slim pedestal.',
  defaultSize: { w: 0.35, d: 0.35, h: 0.5 },
  minSize: { w: 0.24, d: 0.24, h: 0.34 },
  maxSize: { w: 0.55, d: 0.55, h: 0.8 },
  slots: [matSlot('pot', 'Bowl & pedestal', 'speckled-stoneware'), matSlot('soil', 'Soil', 'potting-soil'), matSlot('pearl', 'Pearls', 'pearl-green'), matSlot('stem', 'Strands', 'stem-pearls')],
  build: (size) => {
    const { h } = size;
    const m = halfMin(size);
    const box = plantBox(size);
    const k = scaleOf(h, 0.5);
    const yP = h * 0.52;
    const potR = m * 0.58;
    const potH = clamp(h * 0.16, 0.06, 0.12);
    const parts: Part[] = [
      lathe('pot', [0, 0, 0], [[0, 0], [m * 0.45, 0], [m * 0.45, 0.012], [m * 0.16, 0.03], [m * 0.09, yP * 0.5], [m * 0.13, yP - 0.012], [potR * 0.55, yP]], { segments: 28 }),
    ];
    const pot = planter('pot', 'soil', potR, potH, 'bowl', { y0: yP });
    parts.push(...pot.parts);
    const rand = rng(163);
    const pr = 0.007 * k;
    for (let i = 0; i < 14; i++) parts.push(ball('pearl', polar(pot.rIn * 0.85 * Math.sqrt(rand()), rand() * TAU, pot.top + pr * 0.8), pr, { segments: 6 }));
    for (const v of range(10)) {
      const a = (v / 10) * TAU + rand() * 0.4;
      const path = trailPath(a, pot.rIn, potR, pot.top, yP + potH, Math.max(0.02, yP - h * lerp(0.15, 0.48, rand())), potR + lerp(0.015, 0.05, rand()), (rand() - 0.5) * 0.3);
      const g: Part[] = [...stemPath('stem', path, 0.0013, 0.0011, 4)];
      for (const j of range(8)) g.push(ball('pearl', vadd(along(path, lerp(0.14, 1, j / 7)), [0, 0, 0]), pr * lerp(1, 0.75, j / 7), { segments: 6 }));
      parts.push(...fitGroup(g, path[0], box));
    }
    return containParts(parts, box);
  },
  planDetail: ({ w, d }) => [circle([0, 0], Math.min(w, d) * 0.29), circle([0, 0], Math.min(w, d) * 0.22)],
  plant: PLANT_SPECIES['curio-rowleyanus'],
});

const echeveria = defineItem({
  id: 'echeveria',
  name: 'Echeveria rosette',
  category: 'plants',
  type: 'plants',
  group: 'Succulents & cacti',
  tags: tags('echeveria', 'echeveria elegans', 'mexican snowball', 'succulent', 'rosette', 'windowsill', 'pet safe', 'small'),
  description: 'Echeveria elegans: a tight rosette of plump, powder-blue spoon leaves with blushing tips, in a little terracotta pot.',
  defaultSize: { w: 0.18, d: 0.18, h: 0.15 },
  minSize: { w: 0.1, d: 0.1, h: 0.08 },
  maxSize: { w: 0.35, d: 0.35, h: 0.28 },
  slots: [matSlot('pot', 'Pot', 'terracotta'), matSlot('soil', 'Grit', 'gravel-top'), matSlot('leaf', 'Leaves', 'echeveria-blue'), matSlot('blush', 'Leaf tips', 'echeveria-blush')],
  build: (size) => {
    const { h } = size;
    const m = halfMin(size);
    const box = plantBox(size);
    const pot = planter('pot', 'soil', m * 0.8, clamp(h * 0.48, 0.045, 0.13), 'terracotta');
    const parts: Part[] = [...pot.parts];
    const R = Math.min(m * 0.98, (h - pot.top) * 2.2);
    const whorls: [number, number, number][] = [
      [10, 1.3, 0.95],
      [9, 1.05, 0.8],
      [7, 0.75, 0.62],
      [5, 0.45, 0.45],
      [3, 0.2, 0.28],
    ];
    for (const [wi, [n, tilt, lf]] of whorls.entries()) {
      for (const i of range(n)) {
        const az = (i / n) * TAU + wi * 0.55;
        const len = R * lf;
        const th = clamp(len * 0.22, 0.003, 0.012);
        const base = polar(0.004, az, pot.top + 0.003 + wi * 0.004);
        const blade = bladeLeaf('leaf', base, len, ovateWidth(len * 0.62, 0.64, 0.55), az, tilt, { fold: 0.3, thick: th, samples: 6, plan: wi === 0 });
        parts.push(...fitGroup([...blade.parts, ball('blush', vadd(blade.tip, vmul(blade.dir, -th * 0.5)), th * 0.45, { segments: 6 })], base, box));
      }
    }
    return containParts(parts, box);
  },
  planDetail: ({ w, d }) => [circle([0, 0], Math.min(w, d) * 0.4), starPlan(Math.min(w, d) * 0.48, 10, 0.75)],
  plant: PLANT_SPECIES['echeveria-elegans'],
});

const ponytailPalm = defineItem({
  id: 'ponytail-palm',
  name: 'Ponytail palm',
  category: 'plants',
  type: 'plants',
  group: 'Succulents & cacti',
  tags: tags('ponytail palm', 'beaucarnea recurvata', 'elephant foot', 'caudex', 'drought tolerant', 'pet safe', 'tabletop'),
  description: 'Beaucarnea recurvata with a swollen, bark-wrinkled foot and fountains of long, curling ribbon leaves, in a low grey bowl.',
  defaultSize: { w: 0.4, d: 0.4, h: 0.6 },
  minSize: { w: 0.24, d: 0.24, h: 0.35 },
  maxSize: { w: 0.7, d: 0.7, h: 1.1 },
  slots: [matSlot('pot', 'Bowl', 'glazed-grey'), matSlot('soil', 'Grit', 'gravel-top'), matSlot('trunk', 'Trunk', 'bark-ponytail'), matSlot('leaf', 'Leaves', 'leaf-ponytail')],
  build: (size) => {
    const { h } = size;
    const m = halfMin(size);
    const box = plantBox(size);
    const k = scaleOf(h, 0.6);
    const pot = planter('pot', 'soil', m * 0.62, clamp(h * 0.18, 0.07, 0.15), 'bowl');
    const parts: Part[] = [...pot.parts];
    const rand = rng(167);
    const Rb = Math.min(m * 0.42, (h - pot.top) * 0.28);
    const y0 = pot.top - 0.02;
    const trunkH = (h - pot.top) * 0.42;
    parts.push(lathe('trunk', [0, y0, 0], [[0, 0], [Rb * 0.9, 0], [Rb, Rb * 0.35], [Rb * 0.82, Rb * 0.85], [Rb * 0.38, Rb * 1.3], [0.018 * k, Rb * 1.75], [0.015 * k, trunkH], [0, trunkH]], { segments: 18 }));
    for (const f of [0.35, 0.7]) parts.push(ring('trunk', [0, y0 + Rb * f, 0], Rb * lerp(0.98, 0.86, f), 0.003, NP));
    const T: V3 = [0, y0 + trunkH, 0];
    const T2: V3 = vadd(T, [0.05 * k, -trunkH * 0.25, 0.02 * k]);
    parts.push(rod('trunk', along([[0, y0 + trunkH * 0.55, 0], T], 0), T2, 0.011 * k, { rTop: 0.009 * k, segments: 8, plan: false }));
    for (const [hi, head] of [T, T2].entries()) {
      const n = hi ? 12 : 30;
      for (const i of range(n)) {
        const az = i * GOLDEN + hi;
        const len = (h - pot.top) * lerp(0.5, 0.75, rand()) * (hi ? 0.75 : 1);
        const blade = bladeLeaf('leaf', head, len, strapWidth(0.011 * k, 0.75, 0.5), az, lerp(0.15, 0.95, rand()), { segs: 2, bend: lerp(1.0, 1.7, rand()), twist: (rand() - 0.5) * 1.2, thick: 0.0018, samples: 4, plan: i < 2 && hi === 0 });
        parts.push(...fitGroup(blade.parts, head, box));
      }
    }
    return containParts(parts, box);
  },
  planDetail: ({ w, d }) => [circle([0, 0], Math.min(w, d) * 0.31), starPlan(Math.min(w, d) * 0.45, 14, 0.5)],
  plant: PLANT_SPECIES['beaucarnea-recurvata'],
});

const maidenhair = defineItem({
  id: 'maidenhair-fern',
  name: 'Maidenhair fern',
  category: 'plants',
  type: 'plants',
  group: 'Indoor plants',
  tags: tags('maidenhair fern', 'adiantum raddianum', 'fern', 'delicate', 'bathroom', 'humidity', 'pet safe', 'tabletop'),
  description: 'Adiantum raddianum: airy mounds of tiny fan-shaped leaflets on wiry black stems, in a terracotta egg pot.',
  defaultSize: { w: 0.38, d: 0.38, h: 0.36 },
  minSize: { w: 0.22, d: 0.22, h: 0.22 },
  maxSize: { w: 0.65, d: 0.65, h: 0.6 },
  slots: [matSlot('pot', 'Pot', 'terracotta'), matSlot('soil', 'Soil', 'potting-soil'), matSlot('leaf', 'Leaflets', 'leaf-maidenhair'), matSlot('stems', 'Stems', 'stem-black')],
  build: (size) => {
    const { h } = size;
    const m = halfMin(size);
    const box = plantBox(size);
    const k = scaleOf(h, 0.36);
    const pot = planter('pot', 'soil', m * 0.52, clamp(h * 0.36, 0.08, 0.2), 'egg');
    const parts: Part[] = [...pot.parts];
    const rand = rng(173);
    const H = h - pot.top;
    const FAN: V2[] = [
      [0.3, 0.55],
      [0.7, 1],
      [0.95, 0.8],
    ];
    for (const i of range(18)) {
      const az = i * GOLDEN;
      const base = polar(pot.rIn * 0.45 * rand(), az + 1, pot.top);
      const S = H * lerp(0.7, 1, rand());
      const tip = vadd(base, vmul(dirOf(az, lerp(0.5, 1.15, rand())), S));
      const stipe = bezier(base, vadd(base, [Math.cos(az) * S * 0.15, S * 0.75, Math.sin(az) * S * 0.15]), tip, 2);
      const g: Part[] = [...stemPath('stems', stipe, 0.0016, 0.0011, 4)];
      for (const b of range(3)) {
        const P = along(stipe, lerp(0.62, 1, b / 2));
        const baz = az + (b - 1) * 0.7;
        const btilt = lerp(1.2, 1.9, rand());
        g.push(leafPanel('leaf', P, leafFrame(baz, btilt, (rand() - 0.5) * 0.6), sprigOutline(0.08 * k * lerp(0.8, 1.1, rand()), 0.016 * k, 0.014 * k, 1.05, FAN), 0.0015, i < 3 && b === 1));
      }
      parts.push(...fitGroup(g, base, box));
    }
    return containParts(parts, box);
  },
  planDetail: potAndCanopy(0.26, 0.45, 12),
  plant: PLANT_SPECIES['adiantum-raddianum'],
});

// ---------------------------------------------------------------------------
// Hanging plants (ceiling)
// ---------------------------------------------------------------------------

const heartleafPhilodendron = defineItem({
  id: 'heartleaf-philodendron',
  name: 'Hanging heartleaf philodendron',
  category: 'plants',
  type: 'plants',
  group: 'Hanging plants',
  tags: tags('philodendron', 'heartleaf', 'philodendron hederaceum', 'scandens', 'trailing', 'hanging', 'macrame', 'low light', 'beginner'),
  description: 'Philodendron hederaceum with glossy heart-shaped leaves trailing from a white hanging bowl on cotton macramé cords.',
  ...hanging(1.1),
  defaultSize: { w: 0.55, d: 0.55, h: 1.1 },
  minSize: { w: 0.35, d: 0.35, h: 0.6 },
  maxSize: { w: 0.85, d: 0.85, h: 1.8 },
  slots: [matSlot('pot', 'Hanging pot', 'ceramic-matte-white'), matSlot('cords', 'Cords', 'cotton-cord'), matSlot('leaf', 'Leaves', 'leaf-heartleaf'), matSlot('vines', 'Vines & soil', 'stem-vine')],
  build: (size) => {
    const { h } = size;
    const m = halfMin(size);
    const box = plantBox(size);
    const r = m * 0.44;
    const potH = clamp(r * 0.7, 0.1, 0.18);
    const yRim = h - clamp(h * 0.34, 0.24, 0.5);
    const pot = planter('pot', 'vines', r, potH, 'hanging', { y0: yRim - potH, mound: 0.55 });
    const parts: Part[] = [...pot.parts, ...hangingCords('cords', h, yRim, r)];
    const rand = rng(179);
    for (const v of range(7)) {
      const a = (v / 7) * TAU + rand() * 0.5;
      const path = trailPath(a, pot.rIn, r, pot.top, yRim, Math.max(0.03, (yRim - potH) * lerp(0.05, 0.75, rand())), Math.min(m - 0.02, r + lerp(0.05, 0.15, rand())), (rand() - 0.5) * 0.6);
      const g: Part[] = [...stemPath('vines', path, 0.0025, 0.0018)];
      for (const j of range(6)) {
        const t = lerp(0.14, 1, j / 5);
        g.push(...heartLeaf('leaf', along(path, t), 0.075 * lerp(1, 0.7, t) * lerp(0.85, 1.1, rand()), a + (j % 2 ? 0.85 : -0.85), lerp(1.45, 2.1, rand()), { fold: 0.14, roll: (rand() - 0.5) * 0.5, wide: 0.72 }));
      }
      parts.push(...fitGroup(g, path[0], box));
    }
    for (const i of range(6)) {
      const az = i * GOLDEN;
      const base = polar(pot.rIn * 0.4 * rand(), az, pot.top);
      const P = vadd(base, vmul(dirOf(az, lerp(0.3, 0.9, rand())), 0.05));
      parts.push(...fitGroup([rod('vines', base, P, 0.0025, { segments: 5, plan: false }), ...heartLeaf('leaf', P, 0.085, az, lerp(0.7, 1.2, rand()), { fold: 0.14, wide: 0.72, plan: i < 2 })], base, box));
    }
    return containParts(parts, box);
  },
  planDetail: ({ w, d }) => [circle([0, 0], Math.min(w, d) * 0.22), canopyPlan(w * 0.44, d * 0.44, 8)],
  plant: PLANT_SPECIES['philodendron-hederaceum'],
});

const stringOfHearts = defineItem({
  id: 'string-of-hearts',
  name: 'Hanging string of hearts',
  category: 'plants',
  type: 'plants',
  group: 'Hanging plants',
  tags: tags('string of hearts', 'ceropegia woodii', 'rosary vine', 'trailing', 'hanging', 'succulent', 'pet safe'),
  description: 'Ceropegia woodii: long, thread-thin purple strands with pairs of tiny silver-marbled hearts, from a terracotta hanging pot.',
  ...hanging(1.0),
  defaultSize: { w: 0.38, d: 0.38, h: 1.0 },
  minSize: { w: 0.25, d: 0.25, h: 0.6 },
  maxSize: { w: 0.6, d: 0.6, h: 1.6 },
  slots: [matSlot('pot', 'Hanging pot', 'terracotta'), matSlot('cords', 'Cords', 'jute-cord'), matSlot('leaf', 'Leaves', 'leaf-hearts'), matSlot('vines', 'Strands & soil', 'stem-hearts')],
  build: (size) => {
    const { h } = size;
    const m = halfMin(size);
    const box = plantBox(size);
    const r = m * 0.52;
    const potH = clamp(r * 0.75, 0.07, 0.14);
    const yRim = h - clamp(h * 0.3, 0.22, 0.42);
    const pot = planter('pot', 'vines', r, potH, 'hanging', { y0: yRim - potH });
    const parts: Part[] = [...pot.parts, ...hangingCords('cords', h, yRim, r, 3, 0.0025)];
    const rand = rng(181);
    for (const v of range(11)) {
      const a = (v / 11) * TAU + rand() * 0.4;
      const path = trailPath(a, pot.rIn, r, pot.top, yRim, Math.max(0.02, (yRim - potH) * lerp(0.02, 0.7, rand())), Math.min(m - 0.01, r + lerp(0.02, 0.06, rand())), (rand() - 0.5) * 0.2);
      const g: Part[] = [...stemPath('vines', path, 0.0011, 0.0009, 4)];
      for (const j of range(4)) {
        const P = along(path, lerp(0.22, 0.95, j / 3));
        for (const sd of [1, -1]) {
          const ll = 0.024 * lerp(0.85, 1.15, rand());
          g.push(...bladeLeaf('leaf', P, ll, knotWidth(ll * 0.95, HEART), a + sd * 0.7, lerp(1.7, 2.2, rand()), { thick: 0.0022, samples: 5, lobes: { len: 0.16, flare: 0.03, point: 0.15 } }).parts);
        }
      }
      parts.push(...fitGroup(g, path[0], box));
    }
    return containParts(parts, box);
  },
  planDetail: ({ w, d }) => [circle([0, 0], Math.min(w, d) * 0.26), circle([0, 0], Math.min(w, d) * 0.4)],
  plant: PLANT_SPECIES['ceropegia-woodii'],
});

const tradescantia = defineItem({
  id: 'tradescantia-zebrina',
  name: 'Hanging inch plant',
  category: 'plants',
  type: 'plants',
  group: 'Hanging plants',
  tags: tags('tradescantia', 'tradescantia zebrina', 'inch plant', 'wandering dude', 'purple', 'striped', 'trailing', 'hanging'),
  description: 'Tradescantia zebrina with silver-striped purple leaves along trailing stems, in a seagrass hanging basket.',
  ...hanging(0.85),
  defaultSize: { w: 0.48, d: 0.48, h: 0.85 },
  minSize: { w: 0.3, d: 0.3, h: 0.5 },
  maxSize: { w: 0.75, d: 0.75, h: 1.4 },
  slots: [matSlot('pot', 'Basket', 'seagrass-basket'), matSlot('cords', 'Cords', 'jute-cord'), matSlot('leaf', 'Leaves', 'leaf-zebrina'), matSlot('stems', 'Stems & soil', 'stem-zebrina')],
  build: (size) => {
    const { h } = size;
    const m = halfMin(size);
    const box = plantBox(size);
    const r = m * 0.48;
    const potH = clamp(r * 0.6, 0.09, 0.16);
    const yRim = h - clamp(h * 0.38, 0.25, 0.5);
    const pot = planter('pot', 'stems', r, potH, 'hanging', { y0: yRim - potH, mound: 0.5 });
    const parts: Part[] = [...pot.parts, ...hangingCords('cords', h, yRim, r)];
    const rand = rng(191);
    for (const v of range(8)) {
      const a = (v / 8) * TAU + rand() * 0.5;
      const path = trailPath(a, pot.rIn, r, pot.top, yRim, Math.max(0.03, (yRim - potH) * lerp(0.2, 0.75, rand())), Math.min(m - 0.03, r + lerp(0.06, 0.16, rand())), (rand() - 0.5) * 0.5);
      const g: Part[] = [...stemPath('stems', path, 0.003, 0.0025)];
      for (const j of range(6)) {
        const P = along(path, lerp(0.14, 1, j / 5));
        const ll = 0.07 * lerp(0.85, 1.1, rand());
        g.push(...bladeLeaf('leaf', P, ll, ovateWidth(ll * 0.46, 0.4, 0.8), a + (j % 2 ? 1 : -1), lerp(1.25, 1.7, rand()), { fold: 0.2, thick: 0.0025, samples: 6 }).parts);
      }
      parts.push(...fitGroup(g, path[0], box));
    }
    for (const i of range(8)) {
      const az = i * GOLDEN;
      const P = polar(pot.rIn * 0.5 * rand(), az, pot.top + 0.02);
      const ll = 0.075 * lerp(0.85, 1.1, rand());
      parts.push(...fitGroup(bladeLeaf('leaf', P, ll, ovateWidth(ll * 0.46, 0.4, 0.8), az, lerp(0.6, 1.1, rand()), { fold: 0.2, thick: 0.0025, samples: 6, plan: i < 2 }).parts, P, box));
    }
    return containParts(parts, box);
  },
  planDetail: ({ w, d }) => [circle([0, 0], Math.min(w, d) * 0.24), canopyPlan(w * 0.42, d * 0.42, 8)],
  plant: PLANT_SPECIES['tradescantia-zebrina'],
});

// ---------------------------------------------------------------------------
// Patterns
// ---------------------------------------------------------------------------

/** Smooth tiling wave: integer frequencies keep the tile seamless. */
const wave = (u: number, v: number, fu: number, fv: number, ph: number): number => Math.sin(TAU * (fu * u + fv * v) + ph);

/** Adds a soft round dab to a wrapped field. */
function dab(L: Float32Array, N: number, cx: number, cy: number, r: number, amt: number, soft = 1): void {
  const R = Math.ceil(r + soft + 1);
  const x0 = Math.floor(cx);
  const y0 = Math.floor(cy);
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      const d = Math.hypot(x0 + dx + 0.5 - cx, y0 + dy + 0.5 - cy);
      const f = d < r ? 1 : d < r + soft ? 1 - (d - r) / soft : 0;
      if (f <= 0) continue;
      const x = (((x0 + dx) % N) + N) % N;
      const y = (((y0 + dy) % N) + N) % N;
      L[y * N + x] += amt * f;
    }
  }
}

/**
 * Leaf venation on a tile whose left/right edge is the midrib (u = 0). Leaf UVs run across the
 * blade (u) and along it (v, tip up), so the side veins rise in chevrons towards the tip.
 * Returns the vein and midrib strengths (0–1).
 */
function venation(u: number, v: number, veins: number): [number, number] {
  const du = Math.min(u, 1 - u);
  const q = (v + 0.85 * du + 1.1 * du * du) * veins;
  const fq = Math.abs(q - Math.round(q)) / veins;
  const vein = Math.exp(-Math.pow(fq / (0.0045 + du * 0.004), 2)) * (1 - Math.min(1, du / 0.5) * 0.5);
  const rib = Math.exp(-Math.pow(du / 0.008, 2));
  return [vein, rib];
}

const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function grey(ctx: CanvasRenderingContext2D, N: number, L: Float32Array): void {
  const img = ctx.createImageData(N, N);
  for (let i = 0; i < N * N; i++) {
    const g = Math.round(clamp(L[i], 0, 1) * 255);
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = g;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

type RGB = [number, number, number];
const mix = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** Paints a coloured tile from a per-pixel colour function of (u, v). */
function paint(ctx: CanvasRenderingContext2D, N: number, fn: (u: number, v: number, i: number) => RGB): void {
  const img = ctx.createImageData(N, N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = y * N + x;
      const [r, g, b] = fn(x / N, y / N, i);
      img.data[i * 4] = Math.round(clamp(r, 0, 1) * 255);
      img.data[i * 4 + 1] = Math.round(clamp(g, 0, 1) * 255);
      img.data[i * 4 + 2] = Math.round(clamp(b, 0, 1) * 255);
      img.data[i * 4 + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** Wrapped blotch field: soft random dabs, for irregular variegation. */
function blotches(N: number, rand: () => number, n: number, r0: number, r1: number): Float32Array {
  const B = new Float32Array(N * N);
  for (let i = 0; i < n; i++) dab(B, N, rand() * N, rand() * N, N * lerp(r0, r1, rand()), 0.6 + rand() * 0.5, N * 0.02);
  return B;
}

const PATTERNS = [
  {
    id: 'leaf-veins',
    name: 'Leaf venation',
    normalStrength: 0.5,
    // Near-white blade with a darker midrib (tile edge) and chevron side veins; tinted by the leaf colour.
    draw(ctx: CanvasRenderingContext2D, size: number, rand: () => number) {
      const N = size;
      const L = new Float32Array(N * N);
      const ph = range(4).map(() => rand() * TAU);
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          const u = x / N;
          const v = y / N;
          const [vein, rib] = venation(u, v, 7);
          const net = Math.pow(Math.abs(wave(u, v, 31, 17, ph[0]) * wave(u, v, -23, 29, ph[1])), 6);
          L[y * N + x] = 0.93 + 0.025 * wave(u, v, 2, 3, ph[2]) + 0.015 * wave(u, v, 5, -4, ph[3]) - 0.07 * net - 0.24 * vein - 0.32 * rib;
        }
      }
      for (let i = 0; i < 400; i++) dab(L, N, rand() * N, rand() * N, 0.6 + rand() * 1.2, -0.03 - rand() * 0.04);
      grey(ctx, N, L);
    },
  },
  {
    id: 'leaf-stripes',
    name: 'Calathea stripes',
    normalStrength: 0.35,
    // Broad silver bands following the side veins from the midrib to the margin (orbifolia).
    draw(ctx: CanvasRenderingContext2D, size: number, rand: () => number) {
      const N = size;
      const L = new Float32Array(N * N);
      const ph = rand() * TAU;
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          const u = x / N;
          const v = y / N;
          const du = Math.min(u, 1 - u);
          const q = (v + 0.7 * du + 0.6 * du * du) * 6;
          const band = Math.cos(TAU * q);
          const [vein, rib] = venation(u, v, 12);
          L[y * N + x] = lerp(0.52, 1, smooth(-0.15, 0.35, band)) - 0.08 * vein - 0.25 * rib + 0.02 * wave(u, v, 3, 2, ph);
        }
      }
      grey(ctx, N, L);
    },
  },
  {
    id: 'snake-bands',
    name: 'Snake plant bands',
    normalStrength: 0.25,
    // Wavy dark and light cross-bands of a sansevieria leaf.
    draw(ctx: CanvasRenderingContext2D, size: number, rand: () => number) {
      const N = size;
      const L = new Float32Array(N * N);
      const ph = range(3).map(() => rand() * TAU);
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          const u = x / N;
          const v = y / N;
          const q = v * 9 + 0.18 * wave(u, v, 2, 1, ph[0]) + 0.08 * wave(u, v, 5, 2, ph[1]);
          const b = Math.abs(Math.sin(Math.PI * q));
          L[y * N + x] = lerp(0.62, 1, smooth(0.25, 0.75, b)) + 0.04 * wave(u, v, 1, 3, ph[2]);
        }
      }
      grey(ctx, N, L);
    },
  },
  {
    id: 'leaf-cream-margin',
    name: 'Cream-edged leaf',
    normalStrength: 0.3,
    colored: true,
    // Dark glossy centre, grey-green feathering and an irregular cream margin, pink midrib (Tineke).
    draw(ctx: CanvasRenderingContext2D, size: number, rand: () => number) {
      const N = size;
      const ph = range(3).map(() => rand() * TAU);
      const dark: RGB = [0.13, 0.25, 0.14];
      const mid: RGB = [0.42, 0.52, 0.36];
      const cream: RGB = [0.92, 0.88, 0.66];
      const pink: RGB = [0.86, 0.5, 0.5];
      paint(ctx, N, (u, v) => {
        const du = Math.min(u, 1 - u);
        const n = 0.05 * wave(u, v, 3, 5, ph[0]) + 0.03 * wave(u, v, 7, -4, ph[1]);
        let c = mix(dark, mid, smooth(0.16, 0.3, du + n) * 0.8);
        c = mix(c, cream, smooth(0.39, 0.45, du + n * 1.2));
        const [vein, rib] = venation(u, v, 8);
        c = mix(c, pink, rib * 0.85);
        return mix(c, [c[0] * 1.2, c[1] * 1.2, c[2] * 1.1], vein * 0.4);
      });
    },
  },
  {
    id: 'leaf-silver-centre',
    name: 'Silver-centred leaf',
    normalStrength: 0.3,
    colored: true,
    // Silvery feathered centre fading to a dark green margin (Aglaonema 'Silver Bay').
    draw(ctx: CanvasRenderingContext2D, size: number, rand: () => number) {
      const N = size;
      const ph = range(2).map(() => rand() * TAU);
      const silver: RGB = [0.7, 0.76, 0.66];
      const green: RGB = [0.14, 0.3, 0.17];
      paint(ctx, N, (u, v) => {
        const du = Math.min(u, 1 - u);
        const [vein, rib] = venation(u, v, 6);
        const feather = 0.06 * Math.sin(TAU * (v + 0.8 * du) * 6 + ph[0]) + 0.03 * wave(u, v, 4, 3, ph[1]);
        const c = mix(silver, green, smooth(0.1, 0.24, du + feather));
        return mix(mix(c, green, vein * 0.5), [0.5, 0.6, 0.45], rib * 0.6);
      });
    },
  },
  {
    id: 'leaf-gold-streaks',
    name: 'Gold-streaked leaf',
    normalStrength: 0.3,
    colored: true,
    // Bright green with yellow marbling streaks running along the leaf (golden pothos).
    draw(ctx: CanvasRenderingContext2D, size: number, rand: () => number) {
      const N = size;
      const ph = range(4).map(() => rand() * TAU);
      const B = blotches(N, rand, 40, 0.01, 0.035);
      const green: RGB = [0.2, 0.42, 0.13];
      const gold: RGB = [0.9, 0.82, 0.32];
      paint(ctx, N, (u, v, i) => {
        const f = wave(u, v, 3, 1, ph[0]) + 0.6 * wave(u, v, -2, 3, ph[1]) + 0.4 * wave(u, v, 6, 2, ph[2]);
        const streak = Math.exp(-Math.pow((f - 0.4) / 0.18, 2)) * 0.8 + clamp(B[i], 0, 1) * 0.7;
        const [vein, rib] = venation(u, v, 6);
        const c = mix(green, gold, clamp(streak, 0, 1));
        return mix(mix(c, [0.32, 0.55, 0.2], vein * 0.4), [0.75, 0.75, 0.35], rib * 0.6);
      });
    },
  },
  {
    id: 'zebra-stripes',
    name: 'Zebra leaf',
    normalStrength: 0.3,
    colored: true,
    // Two silver bands either side of a purple-green midrib (Tradescantia zebrina).
    draw(ctx: CanvasRenderingContext2D, size: number, rand: () => number) {
      const N = size;
      const ph = rand() * TAU;
      const plum: RGB = [0.3, 0.13, 0.3];
      const green: RGB = [0.16, 0.24, 0.17];
      const silver: RGB = [0.78, 0.82, 0.84];
      paint(ctx, N, (u, v) => {
        const du = Math.min(u, 1 - u);
        const band = smooth(0.1, 0.14, du) * (1 - smooth(0.26, 0.31, du));
        const base = mix(green, plum, smooth(0.32, 0.48, du));
        return mix(base, mix(silver, [0.62, 0.7, 0.7], 0.5 + 0.5 * Math.sin(TAU * v * 4 + ph)), band * 0.9);
      });
    },
  },
  {
    id: 'terracotta-grog',
    name: 'Terracotta with grog',
    normalStrength: 0.6,
    // Fired clay: soft mottling, faint throwing rings and specks of grog, dark and light.
    draw(ctx: CanvasRenderingContext2D, size: number, rand: () => number) {
      const N = size;
      const L = new Float32Array(N * N);
      const ph = range(4).map(() => rand() * TAU);
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          const u = x / N;
          const v = y / N;
          L[y * N + x] = 0.88 + 0.035 * wave(u, v, 1, 2, ph[0]) + 0.025 * wave(u, v, 3, -1, ph[1]) + 0.015 * wave(u, v, 0, 26, ph[2]) + 0.008 * wave(u, v, 0, 61, ph[3]) + (rand() - 0.5) * 0.04;
        }
      }
      for (let i = 0; i < 1600; i++) {
        const dark = rand() < 0.65;
        dab(L, N, rand() * N, rand() * N, 0.5 + rand() * 1.8, dark ? -0.12 - rand() * 0.18 : 0.06 + rand() * 0.06, 0.8);
      }
      grey(ctx, N, L);
    },
  },
  {
    id: 'glazed-speckle',
    name: 'Speckled glaze',
    normalStrength: 0.15,
    // Stoneware glaze with gentle pooling and iron speckles bleeding through.
    draw(ctx: CanvasRenderingContext2D, size: number, rand: () => number) {
      const N = size;
      const L = new Float32Array(N * N);
      const ph = range(3).map(() => rand() * TAU);
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          const u = x / N;
          const v = y / N;
          L[y * N + x] = 0.95 + 0.02 * wave(u, v, 1, 1, ph[0]) + 0.015 * wave(u, v, 2, -3, ph[1]) + 0.01 * wave(u, v, 0, 5, ph[2]) + (rand() - 0.5) * 0.012;
        }
      }
      for (let i = 0; i < 750; i++) dab(L, N, rand() * N, rand() * N, 0.4 + rand() * 1.0, -0.35 - rand() * 0.25, 0.7);
      grey(ctx, N, L);
    },
  },
];

export default definePack({
  name: 'Houseplants with care guides',
  version: '1.0.0',
  author: 'Neest team',
  description:
    'Twenty-seven detailed houseplants, from floor trees to hanging trailers, each with a care and placement guide: light, where to stand it, watering through the seasons, humidity, temperature, soil, size, pet safety and difficulty.',
  license: 'CC0 (made for Neest)',
  items: [
    fiddleLeafFig,
    birdOfParadise,
    oliveTree,
    rubberTineke,
    kentiaPalm,
    moneyTree,
    monstera,
    zzPlant,
    snakePlant,
    peaceLily,
    calathea,
    pothosStand,
    alocasia,
    aloeVera,
    aglaonema,
    parlourPalm,
    birdsNestFern,
    orchid,
    goldenBarrel,
    bunnyEars,
    stringOfPearls,
    echeveria,
    ponytailPalm,
    maidenhair,
    heartleafPhilodendron,
    stringOfHearts,
    tradescantia,
  ],
  patterns: PATTERNS,
  materials: [
    // Leaves (colour-zoned patterns put the midrib on the tile edge; scale ≈ one leaf's width)
    { id: 'leaf-fiddle', name: 'Fiddle-leaf green', color: '#2d5426', roughness: 0.35, pattern: { id: 'leaf-veins', scale: 0.5, contrast: 0.7 } },
    { id: 'leaf-strelitzia', name: 'Strelitzia blue-green', color: '#4a7356', roughness: 0.42, pattern: { id: 'leaf-veins', scale: 0.4, contrast: 0.45 } },
    { id: 'leaf-olive', name: 'Olive silver-green', color: '#4b5c3c', roughness: 0.65 },
    { id: 'leaf-tineke', name: 'Tineke variegation', color: '#ffffff', roughness: 0.25, pattern: { id: 'leaf-cream-margin', scale: 0.13 } },
    { id: 'leaf-kentia', name: 'Kentia frond', color: '#3f6b33', roughness: 0.5 },
    { id: 'leaf-pachira', name: 'Money tree leaf', color: '#3c7a2c', roughness: 0.32, pattern: { id: 'leaf-veins', scale: 0.08, contrast: 0.5 } },
    { id: 'leaf-monstera', name: 'Monstera leaf', color: '#1e4a26', roughness: 0.3, pattern: { id: 'leaf-veins', scale: 0.7, contrast: 0.55 } },
    { id: 'leaf-zz', name: 'ZZ glossy leaf', color: '#1b3c1d', roughness: 0.14 },
    { id: 'leaf-snake', name: 'Snake plant leaf', color: '#2f5530', roughness: 0.4, pattern: { id: 'snake-bands', scale: 0.22 } },
    { id: 'snake-edge', name: 'Golden leaf edge', color: '#d6c44e', roughness: 0.45 },
    { id: 'leaf-spathiphyllum', name: 'Peace lily leaf', color: '#24502a', roughness: 0.25, pattern: { id: 'leaf-veins', scale: 0.14, contrast: 0.55 } },
    { id: 'leaf-orbifolia', name: 'Orbifolia stripes', color: '#b8d2aa', roughness: 0.5, pattern: { id: 'leaf-stripes', scale: 0.3 } },
    { id: 'leaf-pothos', name: 'Golden pothos', color: '#ffffff', roughness: 0.3, pattern: { id: 'leaf-gold-streaks', scale: 0.08 } },
    { id: 'leaf-polly', name: 'Alocasia dark green', color: '#14281c', roughness: 0.22 },
    { id: 'vein-white', name: 'White veins', color: '#e6eedc', roughness: 0.45 },
    { id: 'leaf-aloe', name: 'Aloe grey-green', color: '#5a7a4c', roughness: 0.5, pattern: { id: 'glazed-speckle', scale: 0.1, contrast: 0.3 } },
    { id: 'leaf-aglaonema', name: 'Silver Bay variegation', color: '#ffffff', roughness: 0.35, pattern: { id: 'leaf-silver-centre', scale: 0.12 } },
    { id: 'leaf-parlour', name: 'Parlour palm frond', color: '#4f8a3a', roughness: 0.5 },
    { id: 'leaf-nest', name: "Bird's nest frond", color: '#62a03c', roughness: 0.3, pattern: { id: 'leaf-veins', scale: 0.14, contrast: 0.4 } },
    { id: 'leaf-orchid', name: 'Orchid leaf', color: '#2f5a2c', roughness: 0.3 },
    { id: 'orchid-white', name: 'Orchid white', color: '#f5eff4', roughness: 0.55, pattern: { id: 'leaf-veins', scale: 0.06, contrast: 0.25 } },
    { id: 'orchid-root', name: 'Orchid root & bark', color: '#8a9478', roughness: 0.8 },
    { id: 'cactus-green', name: 'Barrel cactus green', color: '#3e6b3a', roughness: 0.55 },
    { id: 'spine-gold', name: 'Golden spines', color: '#e9c860', roughness: 0.5 },
    { id: 'opuntia-pad', name: 'Opuntia pad', color: '#6d9a4c', roughness: 0.6 },
    { id: 'glochid-cream', name: 'Cream glochids', color: '#efe2b3', roughness: 0.9 },
    { id: 'pearl-green', name: 'Pearl green', color: '#6e9b4e', roughness: 0.35 },
    { id: 'stem-pearls', name: 'Pearl strand', color: '#6b7a44', roughness: 0.6 },
    { id: 'echeveria-blue', name: 'Echeveria blue', color: '#7c9f97', roughness: 0.6 },
    { id: 'echeveria-blush', name: 'Echeveria blush', color: '#d79aa3', roughness: 0.6 },
    { id: 'leaf-ponytail', name: 'Ponytail leaf', color: '#5b7c3b', roughness: 0.5 },
    { id: 'leaf-maidenhair', name: 'Maidenhair green', color: '#7cb648', roughness: 0.55 },
    { id: 'leaf-heartleaf', name: 'Heartleaf green', color: '#3e7e2c', roughness: 0.28, pattern: { id: 'leaf-veins', scale: 0.08, contrast: 0.5 } },
    { id: 'leaf-hearts', name: 'Silver-marbled heart', color: '#64806c', roughness: 0.45, pattern: { id: 'glazed-speckle', scale: 0.05, contrast: 0.6 } },
    { id: 'leaf-zebrina', name: 'Zebrina stripes', color: '#ffffff', roughness: 0.35, pattern: { id: 'zebra-stripes', scale: 0.05 } },
    // Flowers
    { id: 'strelitzia-orange', name: 'Strelitzia orange', color: '#f07b22', roughness: 0.5 },
    { id: 'spathe-white', name: 'Peace lily white', color: '#f4f3ec', roughness: 0.55, pattern: { id: 'leaf-veins', scale: 0.25, contrast: 0.3 } },
    // Stems and wood
    { id: 'stem-green', name: 'Green stalk', color: '#5b8a3c', roughness: 0.55 },
    { id: 'stem-dark', name: 'Dark midrib', color: '#2d3a22', roughness: 0.5 },
    { id: 'stem-palm', name: 'Palm stalk', color: '#5c7a36', roughness: 0.5 },
    { id: 'stem-zz', name: 'ZZ stem', color: '#3c5a2a', roughness: 0.3 },
    { id: 'stem-rubber', name: 'Rubber stem & sheath', color: '#7a5048', roughness: 0.45 },
    { id: 'stem-pachira', name: 'Money tree trunk', color: '#8a8a5a', roughness: 0.6, pattern: { id: 'wood-grain', scale: 0.15, contrast: 0.4 } },
    { id: 'stem-black', name: 'Wiry black stem', color: '#1d1a17', roughness: 0.4 },
    { id: 'stem-vine', name: 'Vine green-brown', color: '#4f5a2e', roughness: 0.6 },
    { id: 'stem-hearts', name: 'Purple strand', color: '#5e3a4a', roughness: 0.6 },
    { id: 'stem-zebrina', name: 'Purple stem', color: '#5a3550', roughness: 0.55 },
    { id: 'bark-brown', name: 'Brown bark', category: 'wood', color: '#5d4a3a', roughness: 0.85, pattern: { id: 'wood-grain', scale: 0.15, contrast: 0.6 } },
    { id: 'bark-olive', name: 'Olive bark', category: 'wood', color: '#7d7468', roughness: 0.9, pattern: { id: 'wood-grain', scale: 0.12, contrast: 0.9 } },
    { id: 'bark-ponytail', name: 'Ponytail palm bark', category: 'wood', color: '#8b7058', roughness: 0.9, pattern: { id: 'wood-grain', scale: 0.1, contrast: 0.8 } },
    { id: 'moss-pole', name: 'Soil & moss', color: '#4a3a28', roughness: 1, pattern: { id: 'terracotta-grog', scale: 0.08, contrast: 0.8 } },
    { id: 'oak-stand', name: 'Oak plant stand', category: 'wood', color: '#b08355', roughness: 0.55, pattern: { id: 'wood-grain', scale: 0.25 } },
    // Pots, baskets and cords
    { id: 'terracotta', name: 'Terracotta', category: 'stone', color: '#b8643c', roughness: 0.85, pattern: { id: 'terracotta-grog', scale: 0.3 } },
    { id: 'ceramic-white', name: 'Glossy white ceramic', category: 'stone', color: '#f3f1ec', roughness: 0.18, pattern: { id: 'glazed-speckle', scale: 0.4, contrast: 0.15 } },
    { id: 'ceramic-matte-white', name: 'Matte white ceramic', category: 'stone', color: '#ece9e2', roughness: 0.75, pattern: { id: 'glazed-speckle', scale: 0.4, contrast: 0.35 } },
    { id: 'ceramic-black', name: 'Black glazed ceramic', category: 'stone', color: '#252527', roughness: 0.3, pattern: { id: 'glazed-speckle', scale: 0.3, contrast: 0.5 } },
    { id: 'speckled-stoneware', name: 'Speckled stoneware', category: 'stone', color: '#ddd3c2', roughness: 0.5, pattern: { id: 'glazed-speckle', scale: 0.25 } },
    { id: 'glazed-sage', name: 'Sage glazed ceramic', category: 'stone', color: '#9fb39a', roughness: 0.3, pattern: { id: 'glazed-speckle', scale: 0.3, contrast: 0.5 } },
    { id: 'glazed-blue', name: 'Blue glazed ceramic', category: 'stone', color: '#3f6385', roughness: 0.25, pattern: { id: 'glazed-speckle', scale: 0.25, contrast: 0.6 } },
    { id: 'glazed-grey', name: 'Grey glazed ceramic', category: 'stone', color: '#8e8f8c', roughness: 0.35, pattern: { id: 'glazed-speckle', scale: 0.25, contrast: 0.6 } },
    { id: 'concrete-planter', name: 'Concrete planter', category: 'stone', color: '#a09d97', roughness: 0.9, pattern: { id: 'concrete', scale: 0.6 } },
    { id: 'seagrass-basket', name: 'Seagrass basket', category: 'fabric', color: '#b8995f', roughness: 0.9, pattern: { id: 'jute', scale: 0.12 } },
    { id: 'cotton-cord', name: 'Cotton macramé cord', category: 'fabric', color: '#e9e2d2', roughness: 0.95, pattern: { id: 'weave', scale: 0.05 } },
    { id: 'jute-cord', name: 'Jute cord', category: 'fabric', color: '#b39a6a', roughness: 0.95, pattern: { id: 'jute', scale: 0.05 } },
    { id: 'potting-soil', name: 'Potting soil', color: '#3a2a1f', roughness: 1, pattern: { id: 'terracotta-grog', scale: 0.08, contrast: 0.7 } },
    { id: 'gravel-top', name: 'Grit top dressing', category: 'stone', color: '#b5ada0', roughness: 0.95, pattern: { id: 'terrazzo', scale: 0.12 } },
  ],
});

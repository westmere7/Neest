/**
 * People — scale figures at real heights, posed for everyday life at home.
 *
 * Asian sizing first: Vietnamese adults average about 1.68 m (men) and 1.56 m (women); Chinese,
 * Japanese and Korean adults about 1.71–1.74 m and 1.58–1.61 m. Other figures cover taller and
 * shorter people, seniors, teenagers and children (2, 5, 7 and 10 years), with six skin tones.
 *
 * Every figure comes from `humanFigure` (src/data/assets/humanParts.ts) and has hand-made outfit
 * variants: top and bottoms (with a dress: dress and shoes). Skin, hair and shoes keep their colours.
 * Sitting figures say the seat height they fit; lying figures are raised to a mattress by setting
 * the elevation. Figures resize only a little (±10 %), uniformly.
 */
import {
  definePack,
  defineItem,
  fitHuman,
  HUMAN_POSES,
  humanFigure,
  matSlot,
  PEOPLE_MODELS,
  type HumanAge,
  type HumanBody,
  type HumanPose,
  type PackItem,
  type PackMaterial,
  type Size3,
} from '@/packs/kit';

// ───────────── Materials ─────────────

const skin = (id: string, name: string, color: string): PackMaterial => ({ id, name, category: 'solid', color, roughness: 0.6 });
const hairMat = (id: string, name: string, color: string): PackMaterial => ({ id, name, category: 'solid', color, roughness: 0.45 });
const cloth = (id: string, name: string, color: string, roughness = 0.9, scale = 0.03): PackMaterial => ({
  id,
  name,
  category: 'fabric',
  color,
  roughness,
  pattern: { id: 'weave', scale, contrast: 0.4 },
});

const materials: PackMaterial[] = [
  skin('skin-1', 'Fair skin', '#efd0ba'),
  skin('skin-2', 'Light skin', '#e3ba98'),
  skin('skin-3', 'Light-medium skin', '#d2a17c'),
  skin('skin-4', 'Medium tan skin', '#b7845f'),
  skin('skin-5', 'Brown skin', '#8a5a3c'),
  skin('skin-6', 'Deep brown skin', '#5b3a27'),
  hairMat('hair-black', 'Black hair', '#16120f'),
  hairMat('hair-dark-brown', 'Dark brown hair', '#33241a'),
  hairMat('hair-brown', 'Brown hair', '#5f4231'),
  hairMat('hair-blonde', 'Blonde hair', '#b9955c'),
  hairMat('hair-grey', 'Grey hair', '#a7a39d'),
  hairMat('hair-salt-pepper', 'Salt-and-pepper hair', '#6e6a66'),
  cloth('denim-blue', 'Blue denim', '#3d5878'),
  cloth('denim-light', 'Light denim', '#7393b6'),
  cloth('denim-black', 'Black denim', '#2b2c31'),
  cloth('chino-khaki', 'Khaki chino', '#b8a47c'),
  cloth('chino-navy', 'Navy chino', '#2f3a52'),
  cloth('trouser-grey', 'Grey trousers', '#6d6f73'),
  cloth('tee-white', 'White cotton tee', '#efede8'),
  cloth('tee-black', 'Black cotton tee', '#232326'),
  cloth('tee-grey', 'Heather grey jersey', '#8f9296'),
  cloth('tee-red', 'Red cotton tee', '#a3312f'),
  cloth('tee-mustard', 'Mustard cotton tee', '#c99a3b'),
  cloth('tee-sage', 'Sage cotton tee', '#9aa88f'),
  cloth('tee-pink', 'Pink cotton tee', '#e0a7ad'),
  cloth('shirt-sky', 'Sky blue shirt', '#a9c4dc', 0.85),
  cloth('shirt-white', 'White shirt', '#f4f3ef', 0.85),
  cloth('shirt-pink', 'Pale pink shirt', '#e8c3c1', 0.85),
  cloth('linen-beige', 'Beige linen', '#d6c8b0', 0.95),
  cloth('knit-cream', 'Cream knit', '#e8dfcf', 1, 0.02),
  cloth('knit-burgundy', 'Burgundy knit', '#6e2731', 1, 0.02),
  cloth('dress-navy', 'Navy dress cotton', '#283453'),
  cloth('dress-yellow', 'Butter yellow cotton', '#e4c866'),
  cloth('dress-terracotta', 'Terracotta crepe', '#b5694c'),
  cloth('dress-green', 'Emerald crepe', '#2f6b52'),
  cloth('silk-white', 'White silk', '#f5f2ea', 0.4, 0.02),
  cloth('silk-black', 'Black silk', '#1f1f22', 0.4, 0.02),
  cloth('silk-brown', 'Brown silk', '#6b4a35', 0.45, 0.02),
  cloth('silk-purple', 'Plum silk', '#5b3a5e', 0.45, 0.02),
  cloth('aodai-red', 'Red silk (áo dài)', '#a5232b', 0.4, 0.02),
  cloth('aodai-blue', 'Blue silk (áo dài)', '#3d6fa8', 0.4, 0.02),
  cloth('aodai-pink', 'Pink silk (áo dài)', '#d98fa0', 0.4, 0.02),
  cloth('aodai-yellow', 'Yellow silk (áo dài)', '#e2b93b', 0.4, 0.02),
  { id: 'pyjama-stripe', name: 'Blue striped cotton', category: 'fabric', color: '#9db7d6', roughness: 0.9, pattern: { id: 'wallpaper-stripes', scale: 0.06, contrast: 0.7 } },
  cloth('sport-black', 'Black activewear', '#1e1f22', 0.6),
  cloth('sport-teal', 'Teal activewear', '#2f7f86', 0.6),
  cloth('sport-coral', 'Coral activewear', '#e07a63', 0.6),
  cloth('hoodie-grey', 'Grey fleece', '#7d8084', 1, 0.02),
  cloth('jacket-olive', 'Olive cotton jacket', '#5c6340'),
];

// ───────────── Outfits (top & bottoms; with a dress, dress & shoes) ─────────────

type Outfit = [name: string, top: string, bottoms: string];
const OUT = {
  mCasual: [
    ['White tee & jeans', 'tee-white', 'denim-blue'],
    ['Black tee & khaki chinos', 'tee-black', 'chino-khaki'],
    ['Grey tee & black jeans', 'tee-grey', 'denim-black'],
    ['Sage tee & navy chinos', 'tee-sage', 'chino-navy'],
    ['Red tee & light jeans', 'tee-red', 'denim-light'],
  ],
  fCasual: [
    ['White tee & jeans', 'tee-white', 'denim-blue'],
    ['Mustard tee & black jeans', 'tee-mustard', 'denim-black'],
    ['Pink tee & light jeans', 'tee-pink', 'denim-light'],
    ['Sage tee & beige trousers', 'tee-sage', 'linen-beige'],
    ['Black tee & khaki trousers', 'tee-black', 'chino-khaki'],
  ],
  mShorts: [
    ['Grey tee & khaki shorts', 'tee-grey', 'chino-khaki'],
    ['White tee & navy shorts', 'tee-white', 'chino-navy'],
    ['Black tee & denim shorts', 'tee-black', 'denim-blue'],
    ['Red tee & grey shorts', 'tee-red', 'trouser-grey'],
  ],
  shirt: [
    ['Sky shirt & navy trousers', 'shirt-sky', 'chino-navy'],
    ['White shirt & grey trousers', 'shirt-white', 'trouser-grey'],
    ['Cream knit & jeans', 'knit-cream', 'denim-blue'],
    ['Burgundy knit & black jeans', 'knit-burgundy', 'denim-black'],
    ['Olive jacket & khaki chinos', 'jacket-olive', 'chino-khaki'],
  ],
  fShirt: [
    ['White blouse & black trousers', 'shirt-white', 'silk-black'],
    ['Pink shirt & jeans', 'shirt-pink', 'denim-blue'],
    ['Cream knit & beige trousers', 'knit-cream', 'linen-beige'],
    ['Sky shirt & navy trousers', 'shirt-sky', 'chino-navy'],
    ['Burgundy knit & black jeans', 'knit-burgundy', 'denim-black'],
  ],
  dress: [
    ['Navy dress, tan shoes', 'dress-navy', 'leather-tan'],
    ['Floral dress, white shoes', 'fabric-floral-print', 'leather-white'],
    ['Yellow dress, white shoes', 'dress-yellow', 'leather-white'],
    ['Terracotta dress, black shoes', 'dress-terracotta', 'leather-black'],
    ['Emerald dress, black shoes', 'dress-green', 'leather-black'],
  ],
  skirt: [
    ['White tee & denim skirt', 'tee-white', 'denim-blue'],
    ['Black tee & beige skirt', 'tee-black', 'linen-beige'],
    ['Pink tee & navy skirt', 'tee-pink', 'chino-navy'],
    ['Sage tee & black skirt', 'tee-sage', 'silk-black'],
  ],
  home: [
    ['Blue striped pyjamas', 'pyjama-stripe', 'pyjama-stripe'],
    ['Floral đồ bộ set', 'fabric-floral-print', 'fabric-floral-print'],
    ['Grey loungewear', 'tee-grey', 'tee-grey'],
    ['Sage tee & beige trousers', 'tee-sage', 'linen-beige'],
    ['Pink tee & grey trousers', 'tee-pink', 'trouser-grey'],
  ],
  mHome: [
    ['Grey tee & blue pyjama trousers', 'tee-grey', 'pyjama-stripe'],
    ['White tee & grey trousers', 'tee-white', 'trouser-grey'],
    ['Black tee & navy trousers', 'tee-black', 'chino-navy'],
    ['Blue striped pyjamas', 'pyjama-stripe', 'pyjama-stripe'],
  ],
  sport: [
    ['Grey hoodie & joggers', 'hoodie-grey', 'hoodie-grey'],
    ['Black activewear', 'sport-black', 'sport-black'],
    ['Teal top & black bottoms', 'sport-teal', 'sport-black'],
    ['Olive jacket & black jeans', 'jacket-olive', 'denim-black'],
  ],
  fSport: [
    ['Teal top & black leggings', 'sport-teal', 'sport-black'],
    ['Black activewear', 'sport-black', 'sport-black'],
    ['Coral top & black leggings', 'sport-coral', 'sport-black'],
    ['Grey top & joggers', 'hoodie-grey', 'hoodie-grey'],
  ],
  teen: [
    ['Mustard tee & denim shorts', 'tee-mustard', 'denim-light'],
    ['White tee & navy shorts', 'tee-white', 'chino-navy'],
    ['Pink tee & denim shorts', 'tee-pink', 'denim-blue'],
    ['Black tee & grey shorts', 'tee-black', 'trouser-grey'],
  ],
  kids: [
    ['Yellow tee & denim', 'tee-mustard', 'denim-light'],
    ['Red tee & navy', 'tee-red', 'chino-navy'],
    ['School uniform (white & navy)', 'shirt-white', 'chino-navy'],
    ['Sage tee & khaki', 'tee-sage', 'chino-khaki'],
  ],
  seniorF: [
    ['Brown áo bà ba', 'silk-brown', 'silk-black'],
    ['Plum áo bà ba', 'silk-purple', 'silk-black'],
    ['Cream blouse & black trousers', 'knit-cream', 'silk-black'],
    ['Floral blouse & black trousers', 'fabric-floral-print', 'silk-black'],
  ],
  seniorM: [
    ['White shirt & grey trousers', 'shirt-white', 'trouser-grey'],
    ['Sky shirt & khaki trousers', 'shirt-sky', 'chino-khaki'],
    ['Cream knit & navy trousers', 'knit-cream', 'chino-navy'],
    ['Grey tee & black trousers', 'tee-grey', 'silk-black'],
  ],
} satisfies Record<string, Outfit[]>;

// ───────────── Figures ─────────────

type Group = 'Standing' | 'Sitting' | 'Lying down' | 'Kitchen & chores' | 'Grooming' | 'Exercise & leisure' | 'Children';
interface PersonSpec {
  id: string;
  /** Source character for the realistic figure (defaults from sex and outfit, see `sourceFor`). */
  source?: string;
  /** Shoes colour on the realistic figure. */
  shoes?: string;
  name: string;
  group: Group;
  body: HumanBody;
  pose: HumanPose;
  skin: string;
  hair: string;
  outfits: Outfit[];
  /** First sentence of the description: who they are and what they are doing. */
  about: string;
  tags: string[];
}

const TAGS = ['person', 'people', 'human', 'figure', 'scale figure', 'người'];
const scaled = (s: Size3, k: number): Size3 => ({ w: +(s.w * k).toFixed(3), d: +(s.d * k).toFixed(3), h: +(s.h * k).toFixed(3) });
const slug = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/**
 * Realistic figure source: Quaternius Ultimate Modular Men/Women (CC0), baked by npm run people.
 * Their own colours are replaced by the slots, so only the cut of the clothes matters here.
 */
function sourceFor(p: PersonSpec): string {
  if (p.source) return p.source;
  const top = p.body.top ?? 'tee';
  if (p.body.sex === 'female') return top === 'dress' || top === 'ao-dai' ? 'women/Formal' : top === 'long-sleeve' || top === 'jacket' ? 'women/Suit' : 'women/Casual';
  if (p.body.bottoms === 'shorts') return 'men/Beach';
  return top === 'long-sleeve' || top === 'jacket' ? 'men/Casual_Hoodie' : 'men/Casual_2';
}

type ModelInfo = { file: string; hash: string; size: [number, number, number]; seat: number; slots: string[] };
const MODELS = PEOPLE_MODELS as unknown as Record<string, ModelInfo>;
const ACCENT: Record<string, [label: string, material: string]> = {
  'women/Formal': ['Belt', 'metal-brass'],
  'women/Suit': ['Blouse', 'shirt-white'],
  'men/Suit': ['Shirt & tie', 'shirt-white'],
};

function person(p: PersonSpec): PackItem {
  const fig = humanFigure(p.body, p.pose);
  const model = MODELS[p.id];
  const [first, ...rest] = p.outfits;
  const top = p.body.top ?? 'tee';
  // The realistic dress is one garment over the top and skirt slots; shoes have their own slot.
  const oneGarment = Boolean(model) && (top === 'dress' || top === 'ao-dai');
  const outfit = (t: string, b: string): Record<string, string> => (oneGarment ? { top: t, bottoms: t, ...(top === 'dress' ? { shoes: b } : {}) } : { top: t, bottoms: b });
  const sitting = p.group === 'Sitting' || /typing|desk|eating|sofa/.test(p.id);
  const lying = p.group === 'Lying down';
  const onFloor = /cross-legged|kneeling|hugging|squatting|toddler|legs-out|meditating/.test(p.id);
  const note = lying
    ? 'Set its elevation to the mattress height (about 0.45–0.55 m) to lay it on a bed.'
    : sitting && !onFloor
      ? `Fits a seat about ${Math.round((model?.seat ?? fig.seatHeight) * 100)} cm high.`
      : '';
  const bottomsLabel = top === 'dress' ? 'Shoes' : p.body.bottoms === 'skirt' ? 'Skirt' : p.body.bottoms === 'shorts' ? 'Shorts' : 'Trousers';
  const hairLabel = model || top === 'dress' || p.body.feet === 'barefoot' ? 'Hair & eyes' : 'Hair, eyes & shoes';
  const accent = model?.slots.includes('accent') ? ACCENT[sourceFor(p)] : undefined;
  const size: Size3 = model ? { w: model.size[0], d: model.size[1], h: model.size[2] } : fig.size;
  const topLabel = top === 'dress' ? 'Dress' : top === 'ao-dai' ? 'Áo dài tunic' : top === 'jacket' ? 'Jacket' : 'Top';
  return defineItem({
    id: p.id,
    name: p.name,
    category: 'people',
    type: 'people',
    group: p.group,
    tags: [...TAGS, ...p.tags],
    description: `${p.about} ${note}`.trim(),
    defaultSize: size,
    minSize: scaled(size, 0.9),
    maxSize: scaled(size, 1.1),
    slots: [
      matSlot('skin', 'Skin', p.skin),
      matSlot('hair', hairLabel, p.hair),
      matSlot('top', topLabel, first[1]),
      matSlot('bottoms', oneGarment ? 'Skirt' : bottomsLabel, oneGarment ? first[1] : first[2]),
      ...(model?.slots.includes('shoes') ? [matSlot('shoes', 'Shoes', oneGarment && top === 'dress' ? first[2] : (p.shoes ?? 'leather-black'))] : []),
      ...(accent ? [matSlot('accent', accent[0], accent[1])] : []),
    ],
    variants: rest.map(([name, t, b]) => ({ id: slug(name), name, materials: outfit(t, b) })),
    ...(model ? { model: { url: model.file, hash: model.hash } } : {}),
    build: (size) => fitHuman(fig, size),
  });
}

const F = 'female' as const;
const M = 'male' as const;
const P = HUMAN_POSES;

const people: PersonSpec[] = [
  // Standing
  {
    id: 'woman-standing',
    name: 'Woman standing (1.58 m)',
    group: 'Standing',
    body: { stature: 1.58, sex: F, hair: 'long', top: 'tee', bottoms: 'trousers' },
    pose: P.stand,
    skin: 'skin-2',
    hair: 'hair-black',
    outfits: OUT.fCasual,
    about: 'A woman of average Vietnamese height (1.58 m) standing relaxed, with long black hair, in a T-shirt and jeans.',
    tags: ['woman', 'standing', 'vietnamese', 'asian'],
  },
  {
    id: 'man-standing',
    name: 'Man standing (1.68 m)',
    group: 'Standing',
    body: { stature: 1.68, sex: M, hair: 'short', top: 'tee', bottoms: 'trousers' },
    pose: P.stand,
    skin: 'skin-3',
    hair: 'hair-black',
    outfits: OUT.mCasual,
    about: 'A man of average Vietnamese height (1.68 m) standing relaxed, in a T-shirt and jeans.',
    tags: ['man', 'standing', 'vietnamese', 'asian'],
  },
  {
    id: 'woman-summer-dress',
    name: 'Woman in a summer dress (1.60 m)',
    group: 'Standing',
    body: { stature: 1.6, sex: F, hair: 'long', top: 'dress', feet: 'shoes' },
    pose: { ...P.stand, armL: { abd: 0.06, bend: 0.35, flex: 0.1, turn: 0.4 }, armR: { abd: 0.06, bend: 0.5, flex: 0.15, turn: 0.5 } },
    skin: 'skin-2',
    hair: 'hair-black',
    outfits: OUT.dress,
    about: 'A 1.60 m woman standing in a sleeveless knee-length summer dress, hands lightly folded in front.',
    tags: ['woman', 'dress', 'summer', 'standing', 'vietnamese', 'asian'],
  },
  {
    id: 'man-arms-crossed',
    name: 'Man with arms crossed (1.72 m)',
    group: 'Standing',
    body: { stature: 1.72, sex: M, hair: 'crop', top: 'long-sleeve', bottoms: 'trousers' },
    pose: P['stand-arms-crossed'],
    skin: 'skin-2',
    hair: 'hair-black',
    outfits: OUT.shirt,
    about: 'A 1.72 m man (about the Chinese and Japanese average) standing with his arms crossed, in a long-sleeved shirt and trousers.',
    tags: ['man', 'standing', 'arms crossed', 'asian', 'office'],
  },
  {
    id: 'woman-phone-call',
    name: 'Woman on a phone call (1.62 m)',
    group: 'Standing',
    body: { stature: 1.62, sex: F, hair: 'bob', top: 'long-sleeve', bottoms: 'trousers' },
    pose: P['phone-call'],
    skin: 'skin-1',
    hair: 'hair-dark-brown',
    outfits: OUT.fShirt,
    about: 'A 1.62 m woman (about the Korean average) with a bob, holding a phone to her ear.',
    tags: ['woman', 'phone', 'calling', 'standing', 'korean', 'asian'],
  },
  {
    id: 'man-phone-scroll',
    name: 'Man looking at his phone (1.70 m)',
    group: 'Standing',
    body: { stature: 1.7, sex: M, hair: 'crop', top: 'long-sleeve', bottoms: 'trousers' },
    pose: P['phone-scroll'],
    skin: 'skin-3',
    hair: 'hair-black',
    outfits: OUT.sport,
    about: 'A 1.70 m man in a hoodie, looking down at the phone in his hands.',
    tags: ['man', 'phone', 'scrolling', 'standing', 'asian'],
  },
  {
    id: 'man-walking',
    name: 'Man walking (1.78 m)',
    group: 'Standing',
    body: { stature: 1.78, sex: M, hair: 'short', top: 'tee', bottoms: 'trousers' },
    pose: P.walk,
    skin: 'skin-1',
    hair: 'hair-brown',
    outfits: OUT.mCasual,
    about: 'A 1.78 m man (about the European average) in mid-stride, in a T-shirt and jeans.',
    tags: ['man', 'walking', 'european', 'moving'],
  },
  {
    id: 'woman-walking',
    name: 'Woman walking (1.65 m)',
    group: 'Standing',
    body: { stature: 1.65, sex: F, hair: 'ponytail', top: 'tee', bottoms: 'skirt' },
    pose: P.walk,
    skin: 'skin-5',
    hair: 'hair-black',
    outfits: OUT.skirt,
    about: 'A 1.65 m woman with a ponytail walking, in a T-shirt and a knee-length skirt.',
    tags: ['woman', 'walking', 'skirt', 'moving'],
  },
  {
    id: 'man-tall-hands-on-hips',
    name: 'Tall man, hands on hips (1.88 m)',
    group: 'Standing',
    body: { stature: 1.88, sex: M, hair: 'crop', top: 'tee', bottoms: 'trousers', build: 1.05 },
    pose: P['stand-hands-on-hips'],
    skin: 'skin-6',
    hair: 'hair-black',
    outfits: OUT.mCasual,
    about: 'A tall 1.88 m man standing with his hands on his hips: a check for door heights, hoods and shelves.',
    tags: ['man', 'tall', 'standing', 'hands on hips'],
  },
  {
    id: 'grandmother-standing',
    name: 'Grandmother standing (1.50 m)',
    group: 'Standing',
    body: { stature: 1.5, sex: F, age: 'senior', hair: 'bun', top: 'long-sleeve', bottoms: 'trousers', feet: 'slippers', build: 1.05 },
    pose: P.stoop,
    skin: 'skin-3',
    hair: 'hair-grey',
    outfits: OUT.seniorF,
    about: 'A 1.50 m grandmother with grey hair in a bun, slightly stooped, in an áo bà ba blouse, silk trousers and slippers.',
    tags: ['grandmother', 'elderly', 'senior', 'bà', 'ao ba ba', 'vietnamese'],
  },
  {
    id: 'grandfather-standing',
    name: 'Grandfather standing (1.62 m)',
    group: 'Standing',
    body: { stature: 1.62, sex: M, age: 'senior', hair: 'short', top: 'long-sleeve', bottoms: 'trousers', feet: 'slippers' },
    pose: { ...P.stand, lean: 0.08, head: { pitch: -0.08 } },
    skin: 'skin-3',
    hair: 'hair-salt-pepper',
    outfits: OUT.seniorM,
    about: 'A 1.62 m grandfather with salt-and-pepper hair, in a shirt, trousers and slippers.',
    tags: ['grandfather', 'elderly', 'senior', 'ông', 'vietnamese'],
  },
  {
    id: 'teen-girl-waving',
    name: 'Teenage girl waving (1.55 m)',
    group: 'Standing',
    body: { stature: 1.55, sex: F, age: 'teen', hair: 'ponytail', top: 'tee', bottoms: 'shorts' },
    pose: P['stand-wave'],
    skin: 'skin-2',
    hair: 'hair-black',
    outfits: OUT.teen,
    about: 'A 1.55 m teenage girl (about 13) with a ponytail, waving, in a T-shirt and shorts.',
    tags: ['girl', 'teenager', 'teen', 'waving', 'asian'],
  },
  // Sitting
  {
    id: 'woman-sitting-chair',
    name: 'Woman sitting on a chair (1.56 m)',
    group: 'Sitting',
    body: { stature: 1.56, sex: F, hair: 'long', top: 'dress', feet: 'shoes' },
    pose: P['sit-chair'],
    skin: 'skin-2',
    hair: 'hair-black',
    outfits: OUT.dress,
    about: 'A 1.56 m woman sitting upright with her hands on her lap, in a knee-length dress.',
    tags: ['woman', 'sitting', 'chair', 'dress', 'vietnamese', 'asian'],
  },
  {
    id: 'man-sitting-chair',
    name: 'Man sitting on a chair (1.70 m)',
    group: 'Sitting',
    body: { stature: 1.7, sex: M, hair: 'short', top: 'long-sleeve', bottoms: 'trousers' },
    pose: P['sit-chair'],
    skin: 'skin-3',
    hair: 'hair-black',
    outfits: OUT.shirt,
    about: 'A 1.70 m man sitting upright with his hands on his knees, in a shirt and trousers.',
    tags: ['man', 'sitting', 'chair', 'asian'],
  },
  {
    id: 'man-typing',
    name: 'Man typing at a desk (1.72 m)',
    group: 'Sitting',
    body: { stature: 1.72, sex: M, hair: 'crop', top: 'tee', bottoms: 'trousers' },
    pose: P['sit-desk-typing'],
    skin: 'skin-2',
    hair: 'hair-black',
    outfits: OUT.mCasual,
    about: 'A 1.72 m man leaning in to type, forearms forward at desk height.',
    tags: ['man', 'sitting', 'desk', 'typing', 'computer', 'office', 'work from home'],
  },
  {
    id: 'woman-typing',
    name: 'Woman typing at a desk (1.60 m)',
    group: 'Sitting',
    body: { stature: 1.6, sex: F, hair: 'bob', top: 'long-sleeve', bottoms: 'trousers' },
    pose: P['sit-desk-typing'],
    skin: 'skin-1',
    hair: 'hair-dark-brown',
    outfits: OUT.fShirt,
    about: 'A 1.60 m woman with a bob, typing at a desk.',
    tags: ['woman', 'sitting', 'desk', 'typing', 'computer', 'office', 'study'],
  },
  {
    id: 'woman-eating-rice',
    name: 'Woman eating from a rice bowl (1.57 m)',
    group: 'Sitting',
    body: { stature: 1.57, sex: F, hair: 'ponytail', top: 'tee', bottoms: 'trousers', feet: 'slippers' },
    pose: P['sit-eating'],
    skin: 'skin-3',
    hair: 'hair-black',
    outfits: OUT.home,
    about: 'A 1.57 m woman at the table holding her rice bowl up in one hand and chopsticks in the other, Vietnamese style.',
    tags: ['woman', 'sitting', 'eating', 'dining', 'rice bowl', 'chopsticks', 'ăn cơm', 'vietnamese'],
  },
  {
    id: 'man-sofa',
    name: 'Man relaxing on a sofa (1.75 m)',
    group: 'Sitting',
    body: { stature: 1.75, sex: M, hair: 'short', top: 'tee', bottoms: 'trousers', feet: 'barefoot' },
    pose: P['sit-sofa-relaxed'],
    skin: 'skin-4',
    hair: 'hair-black',
    outfits: OUT.mHome,
    about: 'A 1.75 m man leaning back on a sofa with one arm on the armrest, barefoot in homewear.',
    tags: ['man', 'sitting', 'sofa', 'relaxing', 'lounging', 'living room'],
  },
  {
    id: 'woman-sofa',
    name: 'Woman relaxing on a sofa (1.64 m)',
    group: 'Sitting',
    body: { stature: 1.64, sex: F, hair: 'long', top: 'long-sleeve', bottoms: 'trousers', feet: 'barefoot' },
    pose: P['sit-sofa-relaxed'],
    skin: 'skin-4',
    hair: 'hair-black',
    outfits: OUT.home,
    about: 'A 1.64 m woman leaning back on a sofa, barefoot in homewear.',
    tags: ['woman', 'sitting', 'sofa', 'relaxing', 'lounging', 'south asian'],
  },
  {
    id: 'woman-cross-legged',
    name: 'Woman sitting cross-legged (1.56 m)',
    group: 'Sitting',
    body: { stature: 1.56, sex: F, hair: 'long', top: 'tee', bottoms: 'trousers', feet: 'barefoot' },
    pose: P['sit-cross-legged'],
    skin: 'skin-2',
    hair: 'hair-black',
    outfits: OUT.home,
    about: 'A 1.56 m woman sitting cross-legged on the floor or a mat, barefoot, as at a floor table or on a phản.',
    tags: ['woman', 'sitting', 'floor', 'cross-legged', 'mat', 'ngồi xếp bằng', 'vietnamese'],
  },
  {
    id: 'woman-kneeling',
    name: 'Woman kneeling, seiza (1.58 m)',
    group: 'Sitting',
    body: { stature: 1.58, sex: F, hair: 'bun', top: 'long-sleeve', bottoms: 'trousers', feet: 'barefoot' },
    pose: P.kneel,
    skin: 'skin-1',
    hair: 'hair-black',
    outfits: OUT.fShirt,
    about: 'A 1.58 m woman kneeling upright and sitting back on her heels (seiza), as at a low Japanese table.',
    tags: ['woman', 'kneeling', 'seiza', 'floor', 'tatami', 'japanese'],
  },
  {
    id: 'teen-hugging-knees',
    name: 'Teenager hugging knees (1.60 m)',
    group: 'Sitting',
    body: { stature: 1.6, sex: M, age: 'teen', hair: 'crop', top: 'long-sleeve', bottoms: 'trousers' },
    pose: P['sit-hug-knees'],
    skin: 'skin-2',
    hair: 'hair-black',
    outfits: OUT.sport,
    about: 'A 1.60 m teenage boy sitting on the floor with his arms around his knees.',
    tags: ['boy', 'teenager', 'teen', 'sitting', 'floor', 'knees'],
  },
  {
    id: 'man-squatting',
    name: 'Man squatting (1.66 m)',
    group: 'Sitting',
    body: { stature: 1.66, sex: M, hair: 'short', top: 'tee', bottoms: 'shorts', feet: 'slippers' },
    pose: P.squat,
    skin: 'skin-4',
    hair: 'hair-black',
    outfits: OUT.mShorts,
    about: 'A 1.66 m man in a deep flat-footed squat, as on a balcony or at a low stool, in a T-shirt, shorts and slippers.',
    tags: ['man', 'squatting', 'squat', 'ngồi xổm', 'vietnamese', 'balcony'],
  },
  // Lying down
  {
    id: 'woman-lying-back',
    name: 'Woman lying on her back (1.60 m)',
    group: 'Lying down',
    body: { stature: 1.6, sex: F, hair: 'long', top: 'tee', bottoms: 'trousers', feet: 'barefoot' },
    pose: P['lie-back'],
    skin: 'skin-2',
    hair: 'hair-black',
    outfits: OUT.home,
    about: 'A 1.60 m woman lying on her back with one hand on her stomach, head towards the back of the item.',
    tags: ['woman', 'lying', 'sleeping', 'bed', 'resting'],
  },
  {
    id: 'man-lying-side',
    name: 'Man lying on his side (1.72 m)',
    group: 'Lying down',
    body: { stature: 1.72, sex: M, hair: 'short', top: 'tee', bottoms: 'trousers', feet: 'barefoot' },
    pose: P['lie-side'],
    skin: 'skin-3',
    hair: 'hair-black',
    outfits: OUT.mHome,
    about: 'A 1.72 m man asleep on his side with his knees drawn up, head towards the back of the item.',
    tags: ['man', 'lying', 'sleeping', 'bed', 'side'],
  },
  {
    id: 'teen-lying-reading',
    name: 'Teenager lying on her front, reading (1.58 m)',
    group: 'Lying down',
    body: { stature: 1.58, sex: F, age: 'teen', hair: 'ponytail', top: 'tee', bottoms: 'shorts', feet: 'barefoot' },
    pose: P['lie-front-reading'],
    skin: 'skin-2',
    hair: 'hair-black',
    outfits: OUT.teen,
    about: 'A 1.58 m teenage girl lying on her front, propped on her elbows with her feet up, as when reading on a bed or rug.',
    tags: ['girl', 'teenager', 'lying', 'reading', 'bed', 'rug'],
  },
  // Kitchen & chores
  {
    id: 'woman-cooking',
    name: 'Woman cooking at the stove (1.57 m)',
    group: 'Kitchen & chores',
    body: { stature: 1.57, sex: F, hair: 'bun', top: 'tee', bottoms: 'trousers', feet: 'slippers' },
    pose: P['cook-stir'],
    skin: 'skin-2',
    hair: 'hair-black',
    outfits: OUT.home,
    about: 'A 1.57 m woman stirring a pan at the hob, holding the handle with her other hand; her hands sit at a 0.85 m counter.',
    tags: ['woman', 'cooking', 'kitchen', 'stove', 'nấu ăn', 'vietnamese'],
  },
  {
    id: 'man-cooking',
    name: 'Man cooking at the stove (1.70 m)',
    group: 'Kitchen & chores',
    body: { stature: 1.7, sex: M, hair: 'short', top: 'tee', bottoms: 'trousers', feet: 'slippers' },
    pose: P['cook-stir'],
    skin: 'skin-3',
    hair: 'hair-black',
    outfits: OUT.mCasual,
    about: 'A 1.70 m man stirring a wok at the hob.',
    tags: ['man', 'cooking', 'kitchen', 'stove', 'wok'],
  },
  {
    id: 'woman-chopping',
    name: 'Woman chopping vegetables (1.60 m)',
    group: 'Kitchen & chores',
    body: { stature: 1.6, sex: F, hair: 'ponytail', top: 'long-sleeve', bottoms: 'trousers', feet: 'slippers' },
    pose: P['chop-vegetables'],
    skin: 'skin-1',
    hair: 'hair-black',
    outfits: OUT.fShirt,
    about: 'A 1.60 m woman bent slightly over a chopping board at the counter.',
    tags: ['woman', 'chopping', 'kitchen', 'counter', 'prep'],
  },
  {
    id: 'woman-washing-dishes',
    name: 'Woman washing dishes (1.58 m)',
    group: 'Kitchen & chores',
    body: { stature: 1.58, sex: F, hair: 'long', top: 'tee', bottoms: 'trousers', feet: 'slippers' },
    pose: P['wash-dishes'],
    skin: 'skin-3',
    hair: 'hair-black',
    outfits: OUT.home,
    about: 'A 1.58 m woman leaning over the sink washing dishes.',
    tags: ['woman', 'washing up', 'dishes', 'sink', 'kitchen', 'rửa bát'],
  },
  {
    id: 'man-reaching-shelf',
    name: 'Man reaching to a high shelf (1.74 m)',
    group: 'Kitchen & chores',
    body: { stature: 1.74, sex: M, hair: 'crop', top: 'tee', bottoms: 'trousers' },
    pose: P['reach-up'],
    skin: 'skin-2',
    hair: 'hair-black',
    outfits: OUT.mCasual,
    about: 'A 1.74 m man on tiptoe reaching up to a top shelf or wall cabinet: his fingertips reach about 2.2 m.',
    tags: ['man', 'reaching', 'shelf', 'cabinet', 'storage', 'reach height'],
  },
  // Grooming
  {
    id: 'woman-mirror-hair',
    name: 'Woman doing her hair at the mirror (1.60 m)',
    group: 'Grooming',
    body: { stature: 1.6, sex: F, hair: 'long', top: 'tee', bottoms: 'trousers', feet: 'barefoot' },
    pose: P['mirror-hair'],
    skin: 'skin-2',
    hair: 'hair-black',
    outfits: OUT.home,
    about: 'A 1.60 m woman facing a mirror, one hand in her hair, as at a vanity or bathroom basin.',
    tags: ['woman', 'mirror', 'hair', 'vanity', 'bathroom', 'dressing'],
  },
  {
    id: 'man-brushing-teeth',
    name: 'Man brushing his teeth (1.70 m)',
    group: 'Grooming',
    body: { stature: 1.7, sex: M, hair: 'short', top: 'tee', bottoms: 'shorts', feet: 'barefoot' },
    pose: P['mirror-brush-teeth'],
    skin: 'skin-3',
    hair: 'hair-black',
    outfits: OUT.mShorts,
    about: 'A 1.70 m man leaning towards the basin mirror, brushing his teeth.',
    tags: ['man', 'mirror', 'brushing teeth', 'bathroom', 'basin'],
  },
  // Exercise & leisure
  {
    id: 'woman-stretching',
    name: 'Woman stretching (1.62 m)',
    group: 'Exercise & leisure',
    body: { stature: 1.62, sex: F, hair: 'ponytail', top: 'tank', bottoms: 'trousers' },
    pose: P['stretch-arms-up'],
    skin: 'skin-2',
    hair: 'hair-black',
    outfits: OUT.fSport,
    about: 'A 1.62 m woman stretching with both arms overhead, in a sports top and leggings: her hands reach about 2.0 m.',
    tags: ['woman', 'stretching', 'exercise', 'yoga', 'fitness', 'activewear'],
  },
  {
    id: 'man-meditating',
    name: 'Man meditating cross-legged (1.68 m)',
    group: 'Exercise & leisure',
    body: { stature: 1.68, sex: M, hair: 'crop', top: 'tee', bottoms: 'trousers', feet: 'barefoot' },
    pose: { ...P['sit-cross-legged'], ...{ armL: { flex: 0.5, abd: 0.3, bend: 0.25, turn: 0.1 }, armR: { flex: 0.5, abd: 0.3, bend: 0.25, turn: 0.1 } }, head: { pitch: 0.1 } },
    skin: 'skin-3',
    hair: 'hair-black',
    outfits: OUT.sport,
    about: 'A 1.68 m man sitting cross-legged with his hands resting on his knees, meditating.',
    tags: ['man', 'meditating', 'meditation', 'yoga', 'floor', 'cross-legged'],
  },
  // Children
  {
    id: 'girl-standing',
    name: 'Girl standing (7 years, 1.20 m)',
    group: 'Children',
    body: { stature: 1.2, sex: F, age: 'child', hair: 'bob', top: 'tee', bottoms: 'skirt' },
    pose: P.stand,
    skin: 'skin-2',
    hair: 'hair-black',
    outfits: OUT.kids,
    about: 'A 7-year-old girl, 1.20 m tall, with a bob, in a T-shirt and skirt.',
    tags: ['girl', 'child', 'kid', 'children', 'standing'],
  },
  {
    id: 'boy-standing',
    name: 'Boy standing (5 years, 1.08 m)',
    group: 'Children',
    body: { stature: 1.08, sex: M, age: 'child', hair: 'short', top: 'tee', bottoms: 'shorts' },
    pose: P['stand-wave'],
    skin: 'skin-3',
    hair: 'hair-black',
    outfits: OUT.kids,
    about: 'A 5-year-old boy, 1.08 m tall, waving, in a T-shirt and shorts.',
    tags: ['boy', 'child', 'kid', 'children', 'standing', 'waving'],
  },
  {
    id: 'boy-at-desk',
    name: 'Boy at a desk (10 years, 1.38 m)',
    group: 'Children',
    body: { stature: 1.38, sex: M, age: 'child', hair: 'crop', top: 'tee', bottoms: 'trousers' },
    pose: P['sit-desk-typing'],
    skin: 'skin-2',
    hair: 'hair-black',
    outfits: OUT.kids,
    about: 'A 10-year-old boy, 1.38 m tall, sitting at a desk to write or type, in his school uniform colours.',
    tags: ['boy', 'child', 'kid', 'children', 'desk', 'homework', 'study'],
  },
  {
    id: 'toddler-sitting',
    name: 'Toddler sitting on the floor (2 years, 0.86 m)',
    group: 'Children',
    body: { stature: 0.86, sex: F, age: 'toddler', hair: 'crop', top: 'tee', bottoms: 'shorts', feet: 'barefoot' },
    pose: P['sit-legs-out'],
    skin: 'skin-2',
    hair: 'hair-black',
    outfits: OUT.kids,
    about: 'A 2-year-old, 0.86 m tall, sitting on the floor with legs out in front, barefoot.',
    tags: ['toddler', 'baby', 'child', 'kid', 'children', 'floor', 'playing'],
  },
];

/** Figures for npm run people (tools/bake-people.mjs). */
export const BAKE_JOBS: { id: string; source: string; stature: number; age?: HumanAge; pose: HumanPose }[] = people.map((p) => ({
  id: p.id,
  source: sourceFor(p),
  stature: p.body.stature,
  age: p.body.age,
  pose: p.pose,
}));

export default definePack({
  name: 'People',
  version: '1.0.0',
  author: 'Neest',
  description: 'Scale figures at real heights (Asian sizing first) in everyday poses, with outfit variants.',
  license: 'CC0-1.0',
  materials,
  items: people.map(person),
});

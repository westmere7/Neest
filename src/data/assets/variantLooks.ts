import type { MaterialDefinition } from '@/domain/model/schema';
import { MATERIAL_CATALOG_BY_ID } from '@/data/materials/catalog';
import type { AssetDefinition, MaterialSlot } from './types';

/**
 * The data behind the colour variants (see variants.ts): what each material slot of an item is
 * (its role), what kind of object the item is (its archetype), and the curated looks per archetype.
 *
 * A look is a real-world finish set written as tones per role — "Sage & oak": sage upholstery, oak
 * legs, a cream throw. Each tone resolves to the catalogue material of the slot's own kind, so oak is
 * oak grain on a solid-wood leg, oak planks on a plank shelf and oak-effect laminate on a laminate
 * cabinet, and a leather seat stays leather. Slots a look says nothing about keep their material.
 *
 * Rules that keep variants believable:
 *  - sheets and bedding only move between whites, creams and light greys;
 *  - props (food, clothes, books, toiletries), colour-coded parts ("Red team", "Black keys"), prints,
 *    glass, lights, sanitary ceramic and natural weaves (rattan, cane, seagrass) never change;
 *  - appliances and electronics use real appliance finishes, taps real tap finishes;
 *  - a look must change one of the item's most visible slots, so a swatch is never just a new knob.
 */

// ───────────── Material kinds ─────────────

export type Kind =
  | 'grain'
  | 'planks'
  | 'fluted'
  | 'slats'
  | 'painted'
  | 'fabric'
  | 'velvet'
  | 'boucle'
  | 'leather'
  | 'rug'
  | 'metal'
  | 'stone'
  | 'pottery'
  | 'plastic';

const PLANK_PATTERNS = new Set(['wood-planks', 'wood-planks-wide', 'herringbone', 'chevron', 'parquet-basket']);
/** Natural weaves and fibres that keep their own look. */
const NATURAL_WEAVE = /rattan|wicker|cane|bamboo|cork|seagrass|\brush\b|sisal|coconut|coir|sheepskin|fleece|tatami|igusa|straw|palm/;

/** The kind of a material, or null when it is never swapped (glass, lights, prints, natural weaves…). */
export function materialKind(m: MaterialDefinition | undefined): Kind | null {
  if (!m || m.emissive) return null;
  const t = `${m.id} ${m.name}`.toLowerCase();
  const pat = m.texture?.patternId ?? '';
  // Printed or multi-coloured patterns (art, books, prints) and white-based bitmaps keep their look.
  if (m.texture && m.color.toLowerCase() === '#ffffff') return null;
  if (NATURAL_WEAVE.test(t)) return null;
  if ((m.opacity ?? 1) < 0.9) return null;
  switch (m.category) {
    case 'wood':
      if (/painted|lacquer/.test(t)) return 'painted';
      if (pat === 'fluted') return 'fluted';
      if (pat === 'wood-slats') return 'slats';
      return PLANK_PATTERNS.has(pat) ? 'planks' : 'grain';
    case 'laminate':
      if (pat === 'fluted') return 'fluted';
      if (pat === 'terrazzo') return null;
      return 'painted';
    case 'paint':
      return /wallpaper|grasscloth/.test(t) || pat.startsWith('wallpaper') ? null : 'painted';
    case 'fabric':
      if (/mattress|felt|damask|print/.test(t)) return null;
      if (/velvet/.test(t)) return 'velvet';
      if (pat === 'boucle' || /boucl/.test(t)) return 'boucle';
      return 'fabric';
    case 'leather':
      return /suede/.test(t) ? null : 'leather';
    case 'rug':
      return 'rug';
    case 'metal':
      return 'metal';
    case 'stone':
      return /terracotta|ceramic|glaze|porcelain|clay/.test(t) ? 'pottery' : 'stone';
    case 'solid':
      if (/^ceramic-|terracotta|glaze|stoneware|porcelain/.test(m.id)) return 'pottery';
      if (/^plastic-/.test(m.id) || /textured (white|black|grey) plastic/.test(t)) return 'plastic';
      if (/^solid-(white|black|light-grey|mid-grey)$/.test(m.id) || /enamel|lacquer/.test(t)) return 'painted';
      return null;
  }
  return null;
}

// ───────────── Tones ─────────────

/** A named colour or finish, resolved per material kind (missing kinds: the tone does not apply). */
export const TONES: Record<string, Partial<Record<Kind, string>>> = {
  // Woods (painted kinds get the wood-effect laminate)
  oak: { grain: 'wood-oak-light', planks: 'wood-oak-natural', fluted: 'wood-fluted-oak', slats: 'wood-slats-oak', painted: 'laminate-oak' },
  walnut: { grain: 'wood-walnut', planks: 'wood-dark-oak-planks', fluted: 'wood-fluted-walnut', slats: 'wood-slats-walnut', painted: 'laminate-walnut' },
  ash: { grain: 'wood-ash-white', planks: 'wood-whitewashed' },
  teak: { grain: 'wood-teak', planks: 'wood-oak-wide' },
  ebony: { grain: 'wood-ebony', painted: 'laminate-black' },
  espresso: { grain: 'wood-dark-stain', planks: 'wood-dark-oak-planks' },
  cherry: { grain: 'wood-cherry' },
  pine: { grain: 'wood-pine' },
  acacia: { grain: 'wood-acacia' },
  rosewood: { grain: 'wood-rosewood' },
  mahogany: { grain: 'wood-mahogany' },
  'grey-oak': { planks: 'wood-grey-oak' },
  /** Real wood only (no wood-effect laminate): wood-cased radios, speakers and turntables. */
  'oak-wood': { grain: 'wood-oak-light', planks: 'wood-oak-natural' },
  'walnut-wood': { grain: 'wood-walnut', planks: 'wood-dark-oak-planks' },
  // Neutrals and colours (wood kinds get a painted finish)
  white: {
    grain: 'wood-painted-white',
    planks: 'wood-painted-white',
    fluted: 'laminate-fluted-white',
    painted: 'laminate-white-matte',
    fabric: 'fabric-white-cotton',
    boucle: 'fabric-boucle',
    leather: 'leather-white',
    metal: 'metal-white-powder',
    pottery: 'ceramic-white',
    plastic: 'plastic-white',
    rug: 'rug-wool-cream',
  },
  cream: { grain: 'laminate-cream', planks: 'laminate-cream', painted: 'laminate-cream', fabric: 'fabric-cream', boucle: 'fabric-boucle', velvet: 'fabric-velvet-oat', leather: 'leather-white', pottery: 'ceramic-cream', rug: 'rug-wool-cream' },
  linen: { fabric: 'fabric-linen', boucle: 'fabric-boucle-oat', velvet: 'fabric-velvet-oat', rug: 'carpet-beige' },
  'light-grey': { fabric: 'fabric-dove-grey', boucle: 'fabric-boucle-grey', rug: 'carpet-grey' },
  stone: { fabric: 'fabric-stone', boucle: 'fabric-boucle-oat', velvet: 'fabric-velvet-oat' },
  greige: { grain: 'laminate-greige', planks: 'laminate-greige', painted: 'laminate-greige', fabric: 'fabric-stone' },
  grey: { grain: 'laminate-grey', planks: 'laminate-grey', painted: 'laminate-grey', fabric: 'fabric-wool-grey', boucle: 'fabric-boucle-grey', velvet: 'fabric-velvet-grey', rug: 'carpet-grey', plastic: 'solid-light-grey' },
  charcoal: { fabric: 'fabric-charcoal', velvet: 'fabric-velvet-grey', boucle: 'fabric-boucle-charcoal', rug: 'carpet-grey', painted: 'laminate-black' },
  black: { grain: 'wood-ebony', painted: 'laminate-black', metal: 'metal-black-matte', leather: 'leather-black', plastic: 'plastic-black', pottery: 'ceramic-black' },
  navy: { grain: 'laminate-navy', planks: 'laminate-navy', painted: 'laminate-navy', fabric: 'fabric-navy', velvet: 'fabric-velvet-navy', rug: 'carpet-navy' },
  sky: { painted: 'paint-sky', grain: 'paint-sky', fabric: 'fabric-sky', plastic: 'plastic-blue' },
  sage: { grain: 'laminate-sage', planks: 'laminate-sage', painted: 'laminate-sage', fabric: 'fabric-linen-sage', velvet: 'fabric-velvet-sage', boucle: 'fabric-boucle-sage', pottery: 'ceramic-sage', plastic: 'plastic-mint' },
  olive: { grain: 'laminate-olive', painted: 'laminate-olive', fabric: 'fabric-olive', velvet: 'fabric-velvet-green', leather: 'leather-olive' },
  forest: { grain: 'laminate-forest', planks: 'laminate-forest', painted: 'laminate-forest', fabric: 'fabric-forest', velvet: 'fabric-velvet-green' },
  teal: { velvet: 'fabric-velvet-teal' },
  rust: { fabric: 'fabric-linen-rust', velvet: 'fabric-velvet-rust', boucle: 'fabric-boucle-rust' },
  terracotta: { fabric: 'fabric-terracotta', velvet: 'fabric-velvet-rust', boucle: 'fabric-boucle-rust', pottery: 'terracotta-pot', painted: 'paint-terracotta' },
  mustard: { fabric: 'fabric-mustard', velvet: 'fabric-velvet-mustard', plastic: 'plastic-yellow' },
  blush: { grain: 'laminate-pink', painted: 'laminate-pink', fabric: 'fabric-blush', velvet: 'fabric-velvet-blush', plastic: 'plastic-pink' },
  camel: { fabric: 'fabric-corduroy-camel', leather: 'leather-tan' },
  cognac: { leather: 'leather-cognac' },
  tan: { leather: 'leather-tan' },
  burgundy: { leather: 'leather-burgundy' },
  // Metals
  brass: { metal: 'metal-brass' },
  gold: { metal: 'metal-gold' },
  champagne: { metal: 'metal-champagne' },
  bronze: { metal: 'metal-bronze' },
  copper: { metal: 'metal-copper' },
  chrome: { metal: 'metal-chrome' },
  steel: { metal: 'metal-brushed-steel' },
  stainless: { metal: 'metal-brushed-steel' },
  gunmetal: { metal: 'metal-gunmetal' },
  anthracite: { metal: 'metal-anthracite', painted: 'laminate-grey', plastic: 'solid-mid-grey' },
  // Stone
  carrara: { stone: 'stone-marble-carrara' },
  quartz: { stone: 'stone-quartz-white' },
  travertine: { stone: 'stone-travertine' },
  nero: { stone: 'stone-marble-nero' },
  granite: { stone: 'stone-granite' },
  'beige-marble': { stone: 'stone-marble-beige' },
  'green-marble': { stone: 'stone-marble-green' },
  slate: { stone: 'stone-slate' },
  // Pottery and plastics
  blue: { pottery: 'ceramic-blue', plastic: 'plastic-blue' },
  red: { plastic: 'plastic-red', painted: 'solid-red' },
  yellow: { plastic: 'plastic-yellow' },
  green: { plastic: 'plastic-green' },
  pink: { plastic: 'plastic-pink', painted: 'laminate-pink' },
  mint: { plastic: 'plastic-mint', painted: 'paint-mint' },
  // Rugs
  jute: { rug: 'rug-jute' },
  sisal: { rug: 'rug-sisal' },
  berber: { rug: 'rug-berber' },
  beige: { rug: 'carpet-beige' },
  'blue-geo': { rug: 'rug-blue-geometric' },
};

/** Tones that paint wood: never offered on pieces whose character is the wood itself. */
const PAINT_TONES = new Set(['white', 'cream', 'greige', 'grey', 'sage', 'navy', 'olive', 'forest', 'blush', 'sky', 'pink', 'mint', 'anthracite', 'charcoal']);
const WOOD_KINDS = new Set<Kind>(['grain', 'planks', 'fluted', 'slats']);
/** Live-edge slabs, carved and inlaid pieces, barrels, reclaimed and traditional hardwood furniture. */
const NATURAL_WOOD = /live-edge|\bslab\b|burl|carved|carving|inlay|indochine|rosewood|hongmu|gụ|\bgu\b|tansu|dansu|keyaki|hinoki|barrel|monkey-pod|reclaimed|driftwood|pallet|\bbale\b|tủ chè|mother-of-pearl|wedding armoire|welsh dresser|sleigh|butcher/;

/** True when a tone may be used on a slot of this kind on this item (no white-painted live-edge slab). */
export function toneAllowed(asset: AssetDefinition, tone: string, kind: Kind): boolean {
  if (!WOOD_KINDS.has(kind) || !PAINT_TONES.has(tone)) return true;
  return !naturalWood(asset);
}

const naturalCache = new WeakMap<AssetDefinition, boolean>();
function naturalWood(asset: AssetDefinition): boolean {
  let v = naturalCache.get(asset);
  if (v === undefined) {
    v = NATURAL_WOOD.test(`${asset.id} ${asset.name} ${asset.tags.join(' ')} ${asset.slots.map((s) => s.defaultMaterial).join(' ')}`.toLowerCase());
    naturalCache.set(asset, v);
  }
  return v;
}

/** The first tone of `tones` that has a catalogue material for `kind`. */
export function resolveTone(tones: string | string[] | undefined, kind: Kind): string | undefined {
  if (!tones) return undefined;
  for (const t of Array.isArray(tones) ? tones : [tones]) {
    const id = TONES[t]?.[kind];
    if (id && MATERIAL_CATALOG_BY_ID[id]) return id;
  }
  return undefined;
}

// ───────────── Roles ─────────────

export type Role =
  | 'frame'
  | 'legs'
  | 'top'
  | 'fronts'
  | 'hardware'
  | 'tap'
  | 'body'
  | 'upholstery'
  | 'seat'
  | 'mesh'
  | 'accent'
  | 'trim'
  | 'sheets'
  | 'duvet'
  | 'curtain'
  | 'shade'
  | 'towel'
  | 'rug'
  | 'pot'
  | 'crockery'
  | 'foliage'
  | 'flower';

/** Roles a look may leave out, filled from another role of the same look. */
export const ROLE_FALLBACK: Partial<Record<Role, Role>> = {
  seat: 'upholstery',
  legs: 'frame',
  fronts: 'frame',
  body: 'frame',
  crockery: 'pot',
  tap: 'hardware',
};

export type Archetype =
  | 'bed'
  | 'kids'
  | 'soft'
  | 'chair'
  | 'office'
  | 'outdoor'
  | 'table'
  | 'storage'
  | 'kitchen'
  | 'bath'
  | 'appliance'
  | 'lighting'
  | 'tech-light'
  | 'rug'
  | 'curtain'
  | 'cushion'
  | 'frame-decor'
  | 'object'
  | 'fireplace'
  | 'plant'
  | 'activity'
  | 'pet'
  | 'structure'
  | 'basic'
  | 'none';

/** Props, food, colour-coded parts and fixed details: never recoloured. Tested on the first part of a label. */
const FIXED_WORDS =
  /\bskin\b|\bhair\b|\beyes?\b|soil|gravel|\bgrit\b|\bsand\b|water|screen|display|glass|mirror|\blens|bulbs?\b|flames?\b|\bwick|\bbooks?\b|magazines?|\bart\b|artwork|canvas|\bprints?\b|picture|photo|labels?\b|\bdials?\b|buttons?|\bleds?\b|\blights?\b|\blamps?\b|\bcords?\b|cables?|\bchains?\b|\bropes?\b|\btyres?\b|\btires?\b|\bsoles?\b|\bink\b|paper|chalk|\bice\b|snow|food|fruit|cake|bread|candles?\b|\bwax\b|\bkeys\b|keyboard|\bvents?\b|grille|outlet|drain|spout|baskets?\b|wicker|rattan|\bcane\b|seagrass|bamboo|cork|clothes|shirt|jumper|t-shirt|socks|trousers|jacket|shoes|sneakers|slippers|uppers|laces|\bbags?\b|\bhats?\b|gloves|\btoys?\b|teddy|blocks|\btiles\b|team|balls?\b|pieces|segments|cards?\b|\bnotes\b|\bpins\b|stationery|toiletr|cosmetic|makeup|lipstick|palettes|products|skincare|perfume|umbrella|binders?|files\b|tubs\b|cartons|crayons|\bpaint\b|thread|yarn|pages|sleeves|records|vinyl|bottles?|jars?\b|glasses|stemware|tea set|teapot|kyusu|yunomi|pearls|jewell?ery|accessories|items|supplies|props|papers|pads?\s*&\s*accessories|desk pad|inlay|writing leather|wedges|tenons?|keys\b|plants?\b|herbs|moss|logs|toast|condiment|spices?|dry goods|produce|tableware|crockery & pots|dishes & rice|placemat|mikan|oranges?|apples?|bananas?|lemons?|grapes?|tomato|carrot|\bveg|greens\b|meat|fish|salmon|rice\b|soup|broth|sauces?|dough|bao|candy|juice|potion|kimchi|banchan|coffee|milk|oil\b|wine bottles|towels? & (items|baskets)|bins\b|bin\b|mail|pocket|tag\b|webbing|suitcase|rubber|grips?\b|seals?\b|gaskets?|tyre|wheels? & feet|feet & controls|controls|keypad|console & router|\btech\b|nozzles|pump|soap|sponge|loofah|brush\b|toothbrush|razor|\bcomb\b|cutlery|blades?\b|elements|plates\b(?!.*rack)|ribbed plates|castors?\b|casters?\b|wheels?\b|non-stick|crock\b|stoneware crock|felt\b|fleece|sheepskin|tatami|bunting|patches|\bface\b|koban|bell\b|markers|hands\b|second hand|numbers?|number plates|hubs|stripes|eyes\b|\bmane\b|\bsaddle\b|knife|colou?r \d|\bmounts?\b|\bmat\b(?= board)|ink painting|lacquer panel|gold fillet|strings|tuners|drum heads|cymbals|sharps|playfield|felt top|tile faces|tile backs|dice|cue\b|sights|flights|meridian|oceans|continents|gravel|rocks|fish\b|goldfish|food & water|\bnest\b|\bhole\b|opening|doorway|entrance|flap\b|dark\b|rgb|glow|embers|charcoal embers|heater glow|solar/;
/** A colour named in the label: the colour is the design (red team, black keys, white pieces…). */
const COLOUR_WORDS = /\b(red|blue|yellow|green|orange|purple|pink|black|white|grey|gray|gold|golden|silver|light|dark|amber|smoked|clear|frosted)\b/;

const FLOWER_WORDS = /flower|petal|bloom|blossom|spathe|tulip|\broses?\b|\blil(y|ies)\b|orchid|hydrangea|geranium|petunia|lavender/;

const SANITARY = /\bbasins?\b|\bbath\b|\btub\b|toilet|\bpan\b|cistern|bidet|shower tray|\btray\b|\bsink\b|ceramic|fireclay|acrylic|enamel|\bseat\b|\bpanel\b/;

const first = (label: string): string => label.toLowerCase().split(/\s*(?:&|,|\band\b)\s*/)[0];

/** The material slot's role in this kind of object, or null when it keeps its material. */
export function slotRole(asset: AssetDefinition, slot: MaterialSlot, arche: Archetype): Role | null {
  const over = ROLE_OVERRIDES[asset.id]?.[slot.id];
  if (over !== undefined) return over;
  const m = MATERIAL_CATALOG_BY_ID[slot.defaultMaterial];
  if (!m || m.emissive || slot.id === 'light') return null;
  const full = `${slot.label}`.toLowerCase();
  const head = first(slot.label);
  const words = `${slot.id} ${head}`;

  // Plants vary leaves (only greens), flowers (only species sold in many colours) and pots.
  if (arche === 'plant' || FLOWER_WORDS.test(`${slot.id} ${full}`)) return plantRole(asset, slot, m, full);

  if (COLOUR_WORDS.test(full) && !/\bwhite oak|light oak|black ash|black steel|black metal|black frame\b/.test(full)) return null;
  if (FIXED_WORDS.test(head) || /^(light|books?|glass|mirror|screen|art|labels?|food|plants?|water)\d*$/.test(slot.id)) return null;
  const kind = materialKind(m);
  if (!kind) return null;

  switch (kind) {
    case 'pottery':
      if ((arche === 'bath' || arche === 'kitchen' || asset.type === 'plumbing') && SANITARY.test(full)) return null;
      return /\bpots?\b|planter|vase|\burns?\b|holder|\bbase\b|lamp|body\b/.test(words) ? 'pot' : 'crockery';
    case 'plastic':
      if (/shell|seat|chair/.test(words) && (arche === 'chair' || arche === 'soft' || arche === 'office')) return 'frame';
      if (/feet|foot\b|controls|slots|indicator|core\b|grooves|bumper/.test(words)) return null;
      if (/legs?\b|stand|base/.test(words)) return 'legs';
      if (/handles?|knobs?|trim|caps?\b|pulls?/.test(words)) return 'hardware';
      return arche === 'appliance' || arche === 'kids' || arche === 'lighting' ? 'body' : null;
    case 'stone':
      if (/legs?\b|\bbase\b|pedestal|plinth|stand/.test(words)) return 'legs';
      if (/surround|mantel|ring|carving|sculpture|stone\b/.test(words) && !/top/.test(words)) return 'frame';
      return 'top';
    case 'rug':
      if (/border|fringe|trim|medallion|piping/.test(words)) return 'trim';
      if (arche === 'soft' || arche === 'chair') return 'upholstery';
      return 'rug';
    case 'metal':
      return metalRole(words, arche);
    case 'fabric':
    case 'velvet':
    case 'boucle':
    case 'leather':
      return textileRole(words, full, arche, kind);
    default:
      return woodRole(words);
  }
}

function plantRole(asset: AssetDefinition, slot: MaterialSlot, m: MaterialDefinition, full: string): Role | null {
  const words = `${slot.id} ${full}`;
  if (/leaf|leaves|foliage|frond|fern|moss|grass|needles|leaflet|hedge|shrub|\bivy\b|vines?\b|succulent|cactus|cacti|pearls|\bpads\b|rosette/.test(words) && isGreen(m.color)) return 'foliage';
  if (FLOWER_WORDS.test(words)) {
    const text = `${asset.id} ${asset.name} ${asset.tags.join(' ')}`.toLowerCase();
    const multi = /orchid|phalaenopsis|tulip|\broses?\b|hydrangea|violet|wildflower|bouquet|hyacinth|anthurium|kalanchoe|cyclamen|geranium|petunia|window box|\bflowers\b/.test(text);
    const single = /peace lily|spathiphyllum|sunflower|lavender|bird of paradise|strelitzia|frangipani|cherry blossom/.test(`${asset.id} ${asset.name}`.toLowerCase());
    return multi && !single && !(m.color.toLowerCase() === '#ffffff' && m.texture) ? 'flower' : null;
  }
  if (/\bpots?\b|planter|vase|\burns?\b|\bjars?\b|\bbowl|trough/.test(words)) {
    const kind = materialKind(m);
    return kind === 'pottery' || kind === 'metal' || kind === 'painted' ? 'pot' : null;
  }
  return null;
}

function metalRole(words: string, arche: Archetype): Role | null {
  if (/\btaps?\b|faucet|shower|valves?|waste|filler|hose|mixer|spray/.test(words)) return 'tap';
  if (/\bgrates?\b|grills?\b|cast iron|\biron\b|\bbowls?\b|\bcups?\b|blades?/.test(words)) return null;
  if (/\bhob\b|burners?|oven|appliance|\bhood\b|\bsinks?\b|drainer|fridge|toaster|kettle|cooker|\bpot\b|pans?\b|utensils?|ladles?|wok|steel utensils/.test(words)) return arche === 'appliance' ? 'body' : null;
  if (arche === 'bath') return /legs?\b|stand\b/.test(words) ? 'legs' : 'tap';
  if (/handles?|knobs?|pulls?|hooks?|fittings?|hinges?|nailheads|studs|ferrules?|bolts?|escutcheons?|latch|buckle|\bzip\b|clasp|\bcaps?\b|rivets?|screws?|stays|castors?|casters?|sabots|label holders|card holders|rail|\brods?\b|brackets?|runners?|pivots?|trim\b|channels?|axle|tips?\b|hoops|rims?\b|ring\b|collar|socket|canopy|fitter|plate\b|pedals?/.test(words))
    return arche === 'lighting' && /canopy|collar|socket|fitter|plate\b/.test(words) ? 'frame' : 'hardware';
  if (/shades?\b|bowl\b|leaves\b|reflector/.test(words)) return arche === 'lighting' ? 'shade' : 'frame';
  if (/legs?\b|feet|\bbase\b|stand\b|pedestal|tripod|stem|column|swivel|glider|hairpin|trapezoid|sawhorse/.test(words)) return 'legs';
  if (arche === 'appliance') return 'body';
  return 'frame';
}

function textileRole(words: string, full: string, arche: Archetype, kind: Kind): Role | null {
  const bedish = arche === 'bed' || arche === 'kids';
  if (kind === 'leather' && /handles?|straps?|pulls?|tabs?\b/.test(words)) return 'hardware';
  if (/\bmesh\b/.test(words)) return 'mesh';
  if (/lining|liner/.test(words)) return 'accent';
  if (bedish && /\bsheets?\b|bedding|bed linen|pillowcases?|futon|mattress\s*&\s*sheet|fitted/.test(words + ' ' + full)) return 'sheets';
  if (bedish && /duvet|quilt|blanket|comforter|bedspread|kakebuton/.test(words)) return 'duvet';
  if (/curtains?|drapes?|blind|voile|sheer|noren|canopy|valance|tapes/.test(words)) return arche === 'bed' || arche === 'kids' || arche === 'curtain' ? 'curtain' : 'accent';
  if (/towels?\b|\bpile\b|bath mat/.test(words)) return 'towel';
  if (/shades?\b/.test(words)) return 'shade';
  if (/border|fringe|piping|tufts?|welt|\btrim\b|tassels?|ties\b|\bband\b|loops/.test(words)) return 'trim';
  if (/throws?\b|pillows?|bolsters?|scarf|accent|runner|cushion & pillow|blankets?/.test(words)) return 'accent';
  if (arche === 'rug' && /\bmat\b|field|rug|pile/.test(words)) return 'rug';
  if (/\bseats?\b|cushions?|\bpads?\b|mattress/.test(words)) {
    if (/mattress/.test(words) && !(arche === 'soft' || arche === 'bed' || arche === 'outdoor')) return null;
    return 'seat';
  }
  if (arche === 'cushion') return 'accent';
  if (arche === 'curtain') return 'curtain';
  if (arche === 'rug') return 'rug';
  if (arche === 'lighting') return 'shade';
  if (arche === 'bed' || arche === 'kids' || arche === 'soft' || arche === 'chair' || arche === 'office' || arche === 'outdoor' || arche === 'pet' || arche === 'activity') return 'upholstery';
  if (/upholster|\bfabric\b|boucl|velvet|leather|cover|padded|lining|sling|hammock|\bnet\b|plush/.test(words)) return 'upholstery';
  // A textile on a table, cabinet or decor piece is a small soft accent (runner, liner, lining).
  return 'accent';
}

function woodRole(words: string): Role {
  if (/fronts?\b|doors?\b|drawers?\b|panels?\b|louvr|flaps?\b|fascia|roller/.test(words)) return 'fronts';
  if (/handles?|knobs?|pulls?|grips?\b/.test(words)) return 'hardware';
  if (/legs?\b|feet|foot\b|\bbase\b|stand\b|pedestal|plinth|trestle|sawhorse|tripod|stem|column|rockers?|glider|spindles?|stretchers?|poles?\b|sawhorses?\b|posts?\b|hairpin/.test(words) && !/frame/.test(words)) return 'legs';
  if (/\btops?\b|worktop|countertop|tabletop|\bboards?\b|shelf|shelves|trays?\b|ledges?|\bleaf\b|\bleaves\b|slab|deck|treads?|\bseats?\b|\blid\b|hearth|niche|interior/.test(words)) return 'top';
  if (/blades/.test(words)) return 'frame';
  return 'frame';
}

export const isGreen = (hex: string): boolean => {
  const c = hsl(hex);
  return c.h >= 70 && c.h <= 170 && c.s >= 0.12 && c.l > 0.06 && c.l < 0.85;
};

function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h.slice(0, 6), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Hue (degrees), saturation and lightness (HSL) of a hex colour. */
export function hsl(hex: string): { h: number; s: number; l: number } {
  const [r, g, b] = hexRgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d < 1e-6) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s, l };
}

// ───────────── Archetypes ─────────────

/** Items or whole packs that get no generated variants (novelty props, food, lived-in clutter). */
const NO_VARIANT_PACKS = new Set(['halloween', 'lived-in']);

/** What kind of object an item is, from its type, shelf, room and slots. */
export function archetypeOf(asset: AssetDefinition): Archetype {
  const over = ARCHETYPE_OVERRIDES[asset.id];
  if (over) return over;
  const pack = asset.id.includes(':') ? asset.id.split(':')[0] : '';
  if (NO_VARIANT_PACKS.has(pack)) return 'none';
  const base = baseArchetype(asset);
  if (base === 'bed' || base === 'kids') {
    // A wall bed shown folded, or with its desk or sofa, has no bedding: a cabinet or a sofa.
    const roles = asset.slots.map((s) => slotRole(asset, s, base));
    if (!roles.includes('sheets') && !roles.includes('duvet')) {
      if (base === 'kids') return 'kids';
      return roles.includes('upholstery') || roles.includes('seat') ? 'soft' : 'storage';
    }
  }
  return base;
}

function baseArchetype(a: AssetDefinition): Archetype {
  const g = a.group;
  const slotsText = a.slots.map((s) => s.label.toLowerCase()).join(' | ');
  const kitchenUnit = /fronts? & carcass|cabinetry/.test(slotsText);
  switch (a.type) {
    case 'plants':
      return 'plant';
    case 'beds':
      return g === 'Cots & kids beds' ? 'kids' : 'bed';
    case 'seating':
      if (g === 'Sofas & loveseats' || g === 'Living chairs' || g === 'Ottomans & poufs') return 'soft';
      if (g === 'Desk chairs') return 'office';
      if (g === 'Outdoor seating' || a.category === 'outdoor') return 'outdoor';
      if (a.category === 'bathroom') return 'bath';
      return 'chair';
    case 'surfaces':
      if (g === 'Outdoor tables' || a.category === 'outdoor') return 'outdoor';
      if (g === 'Counters & cabinets') return 'kitchen';
      if (g === 'Nightstands' || g === 'Vanity & dressing tables') return 'storage';
      return 'table';
    case 'storage':
      if (g === 'Kitchen cabinets' || kitchenUnit) return 'kitchen';
      if (a.category === 'bathroom' || a.category === 'laundry' && /towel/.test(slotsText)) return 'bath';
      if (g === 'Baskets & boxes') return 'object';
      return 'storage';
    case 'appliances':
    case 'electronics':
      if (kitchenUnit) return 'kitchen';
      // Wood-cased radios, speakers and record players vary by their wood, like furniture.
      if (a.slots.some((s) => /case|cabinet|wood|stand/.test(s.label.toLowerCase()) && WOOD_KINDS.has(materialKind(MATERIAL_CATALOG_BY_ID[s.defaultMaterial]) as Kind))) return 'activity';
      return 'appliance';
    case 'plumbing':
      return kitchenUnit ? 'kitchen' : 'bath';
    case 'lighting':
      return 'lighting';
    case 'decor':
      if (g === 'Rugs') return 'rug';
      if (g === 'Curtains & blinds') return 'curtain';
      if (g === 'Cushions & throws') return 'cushion';
      if (g === 'Mirrors' || g === 'Wall art' || g === 'Clocks' || g === 'Screens & dividers') return 'frame-decor';
      if (g === 'Fireplaces') return 'fireplace';
      return 'object';
    case 'kids':
      return 'kids';
    case 'activities':
      return 'activity';
    case 'pets':
      return 'pet';
    case 'structure':
      return 'structure';
    case 'misc':
      return 'basic';
  }
  return 'object';
}

// ───────────── Looks ─────────────

export type Tones = string | string[];
export interface Look {
  id: string;
  name: string;
  roles: Partial<Record<Exclude<Role, 'foliage' | 'flower'>, Tones>>;
  /** Plants: how leaves and flowers shift (variants.ts picks a sibling green / flower colour). */
  foliage?: 'natural' | 'dark' | 'light' | 'warm' | 'cool';
  flower?: 'light' | 'warm' | 'cool' | 'bold';
  /** Appliances: only offered when the item's own body is a colour (a retro fridge, an enamel range). */
  retro?: boolean;
  /** Only offered when the item has a slot of this role that the look recolours ("Classic red" needs a plastic body). */
  requires?: Role;
}

const L = (id: string, name: string, roles: Look['roles'], extra?: Pick<Look, 'foliage' | 'flower' | 'retro' | 'requires'>): Look => ({ id, name, roles, ...extra });

export const LOOKS: Record<Exclude<Archetype, 'none'>, Look[]> = {
  // Bedding stays white, cream or light grey; the duvet, throw and headboard carry the colour.
  bed: [
    L('hotel-white', 'Hotel white', { sheets: 'white', duvet: 'white', accent: 'light-grey', upholstery: ['light-grey', 'linen'], curtain: 'white' }),
    L('linen-oak', 'Natural linen & oak', { frame: ['oak', 'black'], legs: ['oak', 'black'], top: 'oak', fronts: 'oak', sheets: 'white', duvet: 'linen', accent: 'rust', upholstery: ['linen', 'stone'], curtain: 'linen' }),
    L('sage-oak', 'Sage & oak', { frame: ['oak', 'white'], legs: ['oak', 'white'], top: 'oak', fronts: 'oak', sheets: 'cream', duvet: 'sage', accent: 'cream', upholstery: ['sage', 'linen'], curtain: 'cream' }),
    L('walnut-navy', 'Walnut & navy', { frame: ['walnut', 'black'], legs: ['walnut', 'black'], top: 'walnut', fronts: 'walnut', sheets: 'white', duvet: 'navy', accent: 'mustard', upholstery: ['grey', 'charcoal'], curtain: 'linen' }),
    L('blush-white', 'Blush & white', { frame: ['white'], legs: ['oak', 'white'], top: 'oak', fronts: 'white', sheets: 'white', duvet: 'blush', accent: 'cream', upholstery: ['blush', 'cream'], curtain: 'white' }),
    L('terracotta-teak', 'Terracotta & teak', { frame: ['teak', 'walnut', 'black'], legs: ['teak', 'walnut', 'black'], top: ['teak', 'walnut'], fronts: ['teak', 'walnut'], sheets: 'cream', duvet: 'terracotta', accent: 'olive', upholstery: ['linen', 'stone'], curtain: 'linen' }),
  ],
  kids: [
    L('natural', 'Natural & white', { frame: ['oak', 'white'], legs: ['oak', 'white'], top: 'oak', fronts: 'white', duvet: 'linen', accent: 'mustard', upholstery: 'linen', curtain: 'cream', body: ['white'] }),
    L('sage', 'Sage & oak', { frame: ['white', 'oak'], legs: 'oak', top: 'oak', fronts: 'sage', duvet: 'sage', accent: 'cream', upholstery: 'sage', curtain: 'cream', body: ['mint', 'green'] }),
    L('blush', 'Blush & white', { frame: 'white', legs: ['oak', 'white'], top: 'oak', fronts: 'blush', duvet: 'blush', accent: 'cream', upholstery: 'blush', curtain: 'white', body: 'pink' }),
    L('sky', 'Sky & white', { frame: 'white', legs: ['oak', 'white'], top: 'oak', fronts: 'sky', duvet: 'sky', accent: 'mustard', upholstery: 'sky', curtain: 'white', body: 'blue' }),
    L('mustard-navy', 'Mustard & navy', { frame: ['oak', 'white'], legs: 'oak', top: 'oak', fronts: 'navy', duvet: 'navy', accent: 'mustard', upholstery: 'mustard', curtain: 'linen', body: 'yellow' }),
    L('red', 'Classic red', { body: 'red', duvet: 'grey', accent: 'navy', fronts: 'white', frame: ['white'] }, { requires: 'body' }),
  ],
  // Sofas, armchairs, ottomans: one upholstery colour, legs that suit it, a contrasting cushion.
  soft: [
    L('oat-oak', 'Oat & oak', { upholstery: ['linen', 'white'], legs: ['oak', 'brass'], frame: ['oak', 'brass'], top: 'oak', fronts: 'oak', accent: 'rust', hardware: 'brass' }),
    L('grey-walnut', 'Grey & walnut', { upholstery: ['grey', 'tan'], legs: ['walnut', 'black'], frame: ['walnut', 'black'], top: 'walnut', fronts: 'walnut', accent: 'mustard', hardware: 'black' }),
    L('sage-oak', 'Sage & oak', { upholstery: ['sage', 'olive'], legs: ['oak', 'brass'], frame: ['oak', 'brass'], top: 'oak', fronts: 'oak', accent: 'cream', hardware: 'brass' }),
    L('navy-brass', 'Navy & brass', { upholstery: ['navy', 'burgundy'], legs: ['walnut', 'brass'], frame: ['walnut', 'brass'], top: 'walnut', fronts: 'walnut', accent: 'mustard', hardware: 'brass' }),
    L('charcoal-black', 'Charcoal & black', { upholstery: ['charcoal', 'black'], legs: ['black'], frame: ['black'], top: ['ebony', 'black'], fronts: 'black', accent: ['light-grey', 'linen'], hardware: 'black' }),
    L('rust-walnut', 'Rust & walnut', { upholstery: ['rust', 'cognac'], legs: ['walnut', 'black'], frame: ['walnut', 'black'], top: 'walnut', fronts: 'walnut', accent: 'cream', hardware: 'brass' }),
  ],
  // Dining chairs, stools and benches: the wood finish leads, the seat suits it.
  chair: [
    L('oak-linen', 'Oak & linen', { frame: ['oak', 'white'], legs: ['oak', 'black'], top: 'oak', seat: ['linen', 'tan'], upholstery: ['linen', 'tan'], accent: 'cream', hardware: 'black' }),
    L('walnut-charcoal', 'Walnut & charcoal', { frame: ['walnut', 'black'], legs: ['walnut', 'black'], top: 'walnut', seat: ['charcoal', 'black'], upholstery: ['charcoal', 'black'], accent: 'mustard', hardware: 'brass' }),
    L('black-cognac', 'Black & cognac', { frame: ['black'], legs: ['black'], top: ['black'], seat: ['cognac', 'rust'], upholstery: ['cognac', 'rust'], accent: 'linen', hardware: 'black' }),
    L('white-sage', 'White & sage', { frame: ['white'], legs: ['oak', 'white'], top: ['white', 'oak'], seat: ['sage', 'olive'], upholstery: ['sage', 'olive'], accent: 'cream', hardware: 'brass' }),
    L('teak-olive', 'Teak & olive', { frame: ['teak', 'bronze'], legs: ['teak', 'bronze'], top: 'teak', seat: ['olive'], upholstery: ['olive'], accent: 'cream', hardware: 'bronze' }),
    L('ash-grey', 'Ash & grey', { frame: ['ash', 'grey', 'white'], legs: ['ash', 'white'], top: 'ash', seat: ['light-grey', 'white'], upholstery: ['light-grey', 'white'], accent: 'sage', hardware: 'chrome' }),
  ],
  // Desk chairs: the shell (frame) is black, white or grey; the base (legs) black, chrome or white.
  office: [
    L('black', 'All black', { upholstery: ['charcoal', 'black'], seat: ['charcoal', 'black'], mesh: 'charcoal', frame: ['black'], legs: ['black'] }),
    L('grey-chrome', 'Grey & chrome', { upholstery: ['grey', 'black'], seat: ['grey', 'black'], mesh: 'grey', frame: ['walnut', 'black'], legs: ['chrome', 'walnut'] }),
    L('navy-black', 'Navy & black', { upholstery: ['navy', 'black'], seat: ['navy', 'black'], mesh: 'navy', frame: ['black'], legs: ['black'] }),
    L('oat-white', 'Oat & white', { upholstery: ['linen', 'white'], seat: ['linen', 'white'], mesh: 'light-grey', frame: ['white'], legs: ['white'] }),
    L('cognac-chrome', 'Cognac & chrome', { upholstery: ['cognac', 'rust'], seat: ['rust', 'cognac'], mesh: 'charcoal', frame: ['walnut', 'black'], legs: ['chrome', 'walnut'] }),
    L('sage-oak', 'Sage & oak', { upholstery: ['sage', 'olive'], seat: ['sage', 'olive'], mesh: 'grey', frame: ['oak', 'white'], legs: ['oak', 'white'] }),
  ],
  // Outdoor furniture: weathered woods, powder-coated frames, outdoor-fabric cushions.
  outdoor: [
    L('teak-cream', 'Teak & cream', { frame: ['teak', 'anthracite'], legs: ['teak', 'anthracite'], top: ['teak', 'travertine'], seat: 'cream', upholstery: 'cream', accent: 'rust', hardware: 'steel' }),
    L('black-charcoal', 'Black & charcoal', { frame: ['black'], legs: ['black'], top: ['ebony', 'slate'], seat: 'charcoal', upholstery: 'charcoal', accent: 'linen', hardware: 'black' }),
    L('white-navy', 'White & navy', { frame: ['white'], legs: ['white'], top: ['white', 'quartz'], seat: 'navy', upholstery: 'navy', accent: 'white', hardware: 'chrome' }),
    L('acacia-olive', 'Acacia & olive', { frame: ['acacia', 'bronze'], legs: ['acacia', 'bronze'], top: ['acacia', 'travertine'], seat: 'olive', upholstery: 'olive', accent: 'cream', hardware: 'bronze' }),
    L('ash-sage', 'Grey-washed & sage', { frame: ['ash', 'anthracite'], legs: ['ash', 'anthracite'], top: ['ash', 'granite'], seat: 'sage', upholstery: 'sage', accent: 'white', hardware: 'steel' }),
    L('teak-terracotta', 'Teak & terracotta', { frame: ['teak', 'black'], legs: ['teak', 'black'], top: ['teak', 'travertine'], seat: 'terracotta', upholstery: 'terracotta', accent: 'cream', hardware: 'black' }),
  ],
  // Tables and desks: the top leads; legs and base suit it.
  table: [
    L('oak-black', 'Oak & black', { top: ['oak', 'quartz'], frame: ['black'], legs: ['black'], fronts: 'oak', hardware: 'black', accent: 'linen' }),
    L('walnut-brass', 'Walnut & brass', { top: ['walnut', 'travertine'], frame: ['brass', 'walnut'], legs: ['brass', 'walnut'], fronts: 'walnut', hardware: 'brass', accent: 'rust' }),
    L('white-oak', 'White & oak', { top: ['white', 'carrara'], frame: ['oak', 'white'], legs: ['oak', 'white'], fronts: 'white', hardware: 'brass', accent: 'sage' }),
    L('ash-white', 'Ash & white', { top: ['ash', 'quartz', 'greige'], frame: ['white'], legs: ['white'], fronts: 'white', hardware: 'chrome', accent: 'light-grey' }),
    L('smoked-black', 'Smoked oak & black', { top: ['espresso', 'nero', 'black'], frame: ['black'], legs: ['black'], fronts: 'black', hardware: 'black', accent: 'charcoal' }),
    L('teak-bronze', 'Teak & bronze', { top: ['teak', 'beige-marble'], frame: ['bronze', 'teak'], legs: ['bronze', 'teak'], fronts: 'teak', hardware: 'bronze', accent: 'terracotta' }),
  ],
  // Cabinets, wardrobes, dressers, shelving: carcass and fronts together, a top and pulls that suit.
  storage: [
    // Metal carcasses (filing cabinets, lockers, shelving frames) only take black, white or steel.
    L('oak-brass', 'Oak & brass', { frame: ['oak'], fronts: 'oak', top: ['oak', 'carrara'], legs: ['oak', 'brass'], hardware: 'brass', upholstery: 'linen', accent: 'linen' }),
    L('walnut-black', 'Walnut & black', { frame: ['walnut', 'black'], fronts: 'walnut', top: ['walnut', 'nero'], legs: ['walnut', 'black'], hardware: 'black', upholstery: 'charcoal', accent: 'charcoal' }),
    L('white-oak', 'White & oak', { frame: ['white'], fronts: 'white', top: ['oak', 'quartz'], legs: ['oak', 'white'], hardware: 'brass', upholstery: 'linen', accent: 'cream' }),
    L('black-oak', 'Black & oak', { frame: ['black'], fronts: 'black', top: ['oak', 'quartz'], legs: ['black'], hardware: 'brass', upholstery: 'charcoal', accent: 'mustard' }),
    L('sage-brass', 'Sage & brass', { frame: ['sage'], fronts: 'sage', top: ['oak', 'travertine'], legs: ['oak', 'brass'], hardware: 'brass', upholstery: 'sage', accent: 'cream' }),
    L('greige-walnut', 'Greige & walnut', { frame: ['greige', 'steel'], fronts: 'greige', top: ['walnut', 'travertine'], legs: ['walnut', 'black'], hardware: 'black', upholstery: 'stone', accent: 'stone' }),
  ],
  // Kitchens: painted or oak fronts, a worktop that suits them, matching pulls. Appliances keep steel.
  kitchen: [
    // Metal-framed carts and rails take white, black or steel; wooden shelves and butcher blocks a wood.
    L('white-marble', 'White & marble', { fronts: 'white', frame: ['white'], top: ['carrara', 'oak'], legs: ['oak', 'white'], hardware: 'steel', accent: 'linen' }),
    L('sage-brass', 'Sage & brass', { fronts: 'sage', frame: ['sage', 'brass'], top: ['quartz', 'oak'], legs: ['oak', 'brass'], hardware: 'brass', accent: 'cream' }),
    L('navy-brass', 'Navy & brass', { fronts: 'navy', frame: ['navy', 'brass'], top: ['carrara', 'walnut'], legs: ['walnut', 'brass'], hardware: 'brass', accent: 'linen' }),
    L('oak-black', 'Oak & black', { fronts: 'oak', frame: ['oak', 'black'], top: ['quartz', 'oak'], legs: ['oak', 'black'], hardware: 'black', accent: 'grey' }),
    L('cream-travertine', 'Cream & travertine', { fronts: 'cream', frame: ['cream', 'white'], top: ['travertine', 'ash'], legs: ['oak', 'bronze'], hardware: 'bronze', accent: 'linen' }),
    L('forest-brass', 'Forest green & brass', { fronts: 'forest', frame: ['forest', 'steel'], top: ['carrara', 'walnut'], legs: ['walnut', 'brass'], hardware: 'brass', accent: 'cream' }),
  ],
  // Bathrooms: one tap finish for all metalwork, a vanity and top that suit it.
  bath: [
    L('chrome-white', 'Chrome & white', { tap: 'chrome', body: 'white', hardware: 'chrome', frame: ['white', 'chrome'], fronts: 'white', legs: ['chrome', 'white'], top: ['carrara', 'oak'], towel: 'white', accent: 'white', pot: 'white' }),
    L('brass-oak', 'Brass & oak', { tap: 'brass', body: 'navy', hardware: 'brass', frame: ['oak', 'brass'], fronts: 'oak', legs: ['brass', 'oak'], top: ['travertine', 'oak'], towel: 'linen', accent: 'linen', pot: 'cream' }),
    L('black-walnut', 'Black & walnut', { tap: 'black', body: 'black', hardware: 'black', frame: ['walnut', 'black'], fronts: 'walnut', legs: ['black'], top: ['quartz', 'walnut'], towel: 'grey', accent: 'grey', pot: 'black' }),
    L('gunmetal-grey', 'Gunmetal & stone', { tap: 'gunmetal', body: 'grey', hardware: 'gunmetal', frame: ['grey', 'gunmetal'], fronts: 'grey', legs: ['gunmetal'], top: ['nero', 'walnut'], towel: 'charcoal', accent: 'charcoal', pot: 'black' }),
    L('sage-brass', 'Sage & brass', { tap: 'brass', body: 'sage', hardware: 'brass', frame: ['sage', 'brass'], fronts: 'sage', legs: ['brass', 'oak'], top: ['carrara', 'oak'], towel: 'sage', accent: 'sage', pot: 'sage' }),
    L('nickel-teak', 'Brushed nickel & teak', { tap: 'steel', body: 'forest', hardware: 'steel', frame: ['teak', 'steel'], fronts: 'teak', legs: ['steel', 'teak'], top: ['beige-marble', 'teak'], towel: 'white', accent: 'white', pot: 'white' }),
  ],
  // Appliances and electronics: the finishes they are sold in. Wood-cased electronics get woods.
  appliance: [
    L('stainless', 'Stainless steel', { body: ['stainless', 'oak-wood'], frame: ['stainless', 'oak-wood'], hardware: ['chrome'], legs: ['stainless'] }),
    L('black', 'Black', { body: ['black'], frame: ['black'], hardware: ['black'], legs: ['black'] }),
    L('white', 'White', { body: ['white'], frame: ['white'], hardware: ['chrome'], legs: ['white', 'chrome'] }),
    L('graphite', 'Graphite', { body: ['anthracite', 'walnut-wood'], frame: ['anthracite', 'walnut-wood'], hardware: ['steel'], legs: ['anthracite'] }),
    L('cream', 'Cream', { body: ['cream'], frame: ['cream'], hardware: ['chrome'] }, { retro: true }),
    L('sage', 'Sage', { body: ['sage'], frame: ['sage'], hardware: ['chrome'] }, { retro: true }),
    L('red', 'Red', { body: ['red'], frame: ['red'], hardware: ['chrome'] }, { retro: true }),
    L('navy', 'Navy', { body: ['navy'], frame: ['navy'], hardware: ['brass'] }, { retro: true }),
    L('sky', 'Pastel blue', { body: ['sky'], frame: ['sky'], hardware: ['chrome'] }, { retro: true }),
  ],
  // Downlights, panels, tracks, profiles: the finishes they are made in.
  'tech-light': [
    L('white', 'White', { frame: ['white'], hardware: 'white', shade: ['white'], body: 'white', legs: 'white' }),
    L('black', 'Black', { frame: ['black'], hardware: 'black', shade: ['black'], body: 'black', legs: 'black' }),
    L('aluminium', 'Aluminium', { frame: ['steel'], hardware: 'steel', shade: ['steel'], body: 'grey', legs: 'steel' }),
    L('graphite', 'Graphite', { frame: ['anthracite'], hardware: 'anthracite', shade: ['anthracite'], body: 'anthracite', legs: 'anthracite' }),
  ],
  // Lamps: one metal finish with a shade and base that suit it.
  lighting: [
    L('brass-linen', 'Brass & linen', { frame: ['brass', 'oak'], legs: ['brass', 'walnut', 'carrara'], shade: ['linen', 'brass', 'white'], hardware: 'brass', pot: 'white', body: 'white', top: 'oak' }),
    L('black-white', 'Black & white', { frame: ['black'], legs: ['black', 'nero'], shade: ['white', 'black'], hardware: 'black', pot: 'black', body: 'black', top: 'black' }),
    L('chrome-white', 'Chrome & white', { frame: ['chrome', 'ash'], legs: ['chrome', 'ash', 'carrara'], shade: ['white', 'chrome'], hardware: 'chrome', pot: 'white', body: 'white', top: 'ash' }),
    L('bronze-oat', 'Bronze & oat', { frame: ['bronze', 'walnut'], legs: ['bronze', 'walnut', 'travertine'], shade: ['linen', 'bronze', 'cream'], hardware: 'bronze', pot: 'cream', body: 'cream', top: 'walnut' }),
    L('white-oak', 'White & oak', { frame: ['white', 'oak'], legs: ['oak', 'white'], shade: ['white'], hardware: 'white', pot: 'white', body: 'white', top: 'oak' }),
    L('copper-charcoal', 'Copper & charcoal', { frame: ['copper', 'walnut'], legs: ['black', 'walnut', 'slate'], shade: ['charcoal', 'copper'], hardware: 'copper', pot: 'terracotta', body: 'black', top: 'walnut' }),
  ],
  rug: [
    L('jute-cream', 'Jute & cream', { rug: ['jute', 'linen'], towel: 'linen', trim: 'cream' }),
    L('cream', 'Cream wool', { rug: ['cream', 'white'], towel: 'white', trim: 'linen' }),
    L('berber', 'Berber stripe', { rug: ['berber', 'light-grey'], towel: 'light-grey', trim: 'cream' }),
    L('grey', 'Grey', { rug: ['grey'], towel: 'grey', trim: 'charcoal' }),
    L('navy', 'Navy', { rug: ['navy'], towel: 'navy', trim: 'cream' }),
    L('blue-geo', 'Blue geometric', { rug: ['blue-geo', 'sky'], towel: 'sky', trim: 'white' }),
  ],
  curtain: [
    L('white-chrome', 'White & chrome', { curtain: ['white', 'cream'], frame: ['white'], hardware: 'chrome', trim: 'white', accent: 'white' }),
    L('linen-black', 'Linen & black', { curtain: ['linen'], frame: ['oak'], hardware: 'black', trim: 'linen', accent: 'linen' }),
    L('grey-steel', 'Dove grey & steel', { curtain: ['light-grey', 'grey'], frame: ['ash', 'grey-oak'], hardware: 'steel', trim: 'light-grey', accent: 'light-grey' }),
    L('sage-brass', 'Sage & brass', { curtain: ['sage'], frame: ['oak'], hardware: 'brass', trim: 'cream', accent: 'sage' }),
    L('navy-brass', 'Navy & brass', { curtain: ['navy'], frame: ['walnut'], hardware: 'brass', trim: 'navy', accent: 'navy' }),
    L('rust-black', 'Rust & black', { curtain: ['rust', 'terracotta'], frame: ['teak'], hardware: 'black', trim: 'rust', accent: 'rust' }),
  ],
  cushion: [
    L('mustard', 'Mustard', { accent: 'mustard', upholstery: 'mustard', seat: 'mustard', trim: 'cream', frame: 'oak' }),
    L('rust', 'Rust', { accent: 'rust', upholstery: 'rust', seat: 'rust', trim: 'cream', frame: 'teak' }),
    L('sage', 'Sage', { accent: 'sage', upholstery: 'sage', seat: 'sage', trim: 'white', frame: 'oak' }),
    L('navy', 'Navy', { accent: 'navy', upholstery: 'navy', seat: 'navy', trim: 'white', frame: 'walnut' }),
    L('blush', 'Blush', { accent: 'blush', upholstery: 'blush', seat: 'blush', trim: 'cream', frame: 'white' }),
    L('charcoal', 'Charcoal', { accent: 'charcoal', upholstery: 'charcoal', seat: 'charcoal', trim: 'linen', frame: 'black' }),
  ],
  // Mirrors, frames, clocks, screens: the frame finish.
  'frame-decor': [
    L('brass', 'Brass & oak', { frame: ['brass', 'oak'], legs: ['brass', 'oak'], top: 'oak', hardware: 'brass', fronts: ['brass', 'oak'], accent: 'linen' }),
    L('black', 'Black', { frame: ['black'], legs: ['black'], top: 'black', hardware: 'black', fronts: 'black', accent: 'charcoal' }),
    L('walnut-bronze', 'Bronze & walnut', { frame: ['bronze', 'walnut'], legs: ['bronze', 'walnut'], top: 'walnut', hardware: 'bronze', fronts: 'walnut', accent: 'rust' }),
    L('white', 'White', { frame: ['white'], legs: ['white'], top: 'white', hardware: 'chrome', fronts: 'white', accent: 'white' }),
    L('chrome-ash', 'Chrome & ash', { frame: ['chrome', 'ash'], legs: ['chrome', 'ash'], top: 'ash', hardware: 'chrome', fronts: 'ash', accent: 'light-grey' }),
    L('gold-oak', 'Gold & oak', { frame: ['gold', 'oak'], legs: ['gold', 'oak'], top: 'oak', hardware: 'gold', fronts: 'oak', accent: 'cream' }),
  ],
  // Vases, trays, candle holders, ornaments, boxes.
  object: [
    L('white-brass', 'White & brass', { pot: 'white', crockery: 'white', frame: ['brass', 'oak'], hardware: 'brass', top: ['oak', 'carrara'], legs: ['brass', 'oak'], accent: 'linen', upholstery: 'linen' }, { flower: 'light' }),
    L('black-brass', 'Black & brass', { pot: 'black', crockery: 'black', frame: ['black', 'walnut'], hardware: 'brass', top: ['walnut', 'nero'], legs: ['black', 'walnut'], accent: 'charcoal', upholstery: 'charcoal' }, { flower: 'bold' }),
    L('terracotta-oak', 'Terracotta & oak', { pot: 'terracotta', crockery: 'cream', frame: ['bronze', 'oak'], hardware: 'bronze', top: ['oak', 'travertine'], legs: ['bronze', 'oak'], accent: 'rust', upholstery: 'rust' }, { flower: 'warm' }),
    L('sage-ash', 'Sage & ash', { pot: 'sage', crockery: 'sage', frame: ['white', 'ash'], hardware: 'chrome', top: ['ash', 'quartz'], legs: ['chrome', 'ash'], accent: 'sage', upholstery: 'sage' }, { flower: 'cool' }),
    L('blue-walnut', 'Blue & walnut', { pot: 'blue', crockery: 'blue', frame: ['chrome', 'walnut'], hardware: 'chrome', top: ['walnut', 'carrara'], legs: ['chrome', 'walnut'], accent: 'navy', upholstery: 'navy' }),
    L('cream-black', 'Cream & black', { pot: 'cream', crockery: 'cream', frame: ['black', 'oak'], hardware: 'black', top: ['oak', 'travertine'], legs: ['black', 'oak'], accent: 'cream', upholstery: 'cream' }),
  ],
  fireplace: [
    L('carrara', 'Carrara marble', { frame: ['carrara'], top: ['carrara', 'slate'], legs: 'black', hardware: 'black' }),
    L('travertine', 'Travertine', { frame: ['travertine'], top: ['travertine'], legs: 'bronze', hardware: 'bronze' }),
    L('nero', 'Nero marble', { frame: ['nero'], top: ['nero', 'slate'], legs: 'black', hardware: 'brass' }),
    L('beige', 'Beige marble', { frame: ['beige-marble'], top: ['beige-marble', 'travertine'], legs: 'anthracite', hardware: 'brass' }),
    L('slate', 'Slate & steel', { frame: ['slate', 'granite'], top: ['slate'], legs: 'steel', hardware: 'steel' }),
  ],
  // Plants: the pot is what you choose; flowers change only on species sold in several colours.
  plant: [
    L('terracotta', 'Terracotta pot', { pot: ['terracotta', 'copper'] }, { flower: 'warm' }),
    L('white', 'White pot', { pot: 'white' }, { flower: 'light' }),
    L('black', 'Black pot', { pot: 'black' }, { flower: 'bold' }),
    L('sage', 'Sage pot', { pot: ['sage', 'brass'] }, { flower: 'cool' }),
    L('cream', 'Cream pot', { pot: ['cream', 'white'] }),
    L('blue', 'Blue pot', { pot: ['blue', 'chrome'] }),
  ],
  // Games, music, fitness, hobbies: frames and wood cases; cloths and pads in their usual colours.
  activity: [
    L('walnut', 'Walnut', { frame: ['walnut', 'black'], top: 'walnut', legs: ['walnut', 'black'], fronts: 'walnut', upholstery: ['navy', 'black'], seat: ['black'], hardware: 'brass' }),
    L('oak', 'Oak', { frame: ['oak', 'white'], top: 'oak', legs: ['oak', 'white'], fronts: 'oak', upholstery: ['grey', 'tan'], seat: ['grey', 'tan'] }),
    L('black', 'Black', { frame: ['black'], top: 'black', legs: ['black'], fronts: 'black', upholstery: ['teal', 'black'], seat: ['charcoal', 'black'], hardware: 'black' }),
    L('white', 'White', { frame: ['white'], top: ['white', 'oak'], legs: ['white'], fronts: 'white', upholstery: ['light-grey', 'white'], seat: ['light-grey', 'white'] }),
  ],
  pet: [
    L('grey-oak', 'Grey & oak', { upholstery: ['grey'], seat: ['grey'], frame: ['oak', 'black'], legs: ['oak', 'black'], top: 'oak', fronts: 'white', hardware: 'black', crockery: 'white' }),
    L('cream-walnut', 'Cream & walnut', { upholstery: ['cream'], seat: ['cream'], frame: ['walnut', 'black'], legs: ['walnut', 'black'], top: 'walnut', fronts: 'cream', hardware: 'brass', crockery: 'cream' }),
    L('oat-white', 'Oat & white', { upholstery: ['linen'], seat: ['linen'], frame: ['white'], legs: ['white'], top: 'oak', fronts: 'white', hardware: 'chrome', crockery: 'white' }),
    L('charcoal-black', 'Charcoal & black', { upholstery: ['charcoal'], seat: ['charcoal'], frame: ['black'], legs: ['black'], top: 'walnut', fronts: 'black', hardware: 'black', crockery: 'black' }),
    L('sage-oak', 'Sage & oak', { upholstery: ['sage'], seat: ['sage'], frame: ['oak', 'white'], legs: ['oak', 'white'], top: 'oak', fronts: 'sage', hardware: 'brass', crockery: 'sage' }),
  ],
  // Columns, partitions, radiators, built-ins.
  structure: [
    L('white', 'White', { frame: ['white'], legs: ['white'], top: ['oak', 'white'], fronts: 'white', hardware: 'chrome', tap: 'chrome' }),
    L('black', 'Black', { frame: ['black'], legs: ['black'], top: ['oak', 'black'], fronts: 'black', hardware: 'black', tap: 'black' }),
    L('oak-anthracite', 'Oak & graphite', { frame: ['oak', 'anthracite'], legs: ['oak', 'anthracite'], top: 'oak', fronts: 'oak', hardware: 'black', tap: 'gunmetal' }),
    L('walnut-brass', 'Walnut & brass', { frame: ['walnut', 'brass'], legs: ['walnut', 'brass'], top: 'walnut', fronts: 'walnut', hardware: 'brass', tap: 'brass' }),
    L('greige-steel', 'Greige & steel', { frame: ['greige', 'steel'], legs: ['greige', 'steel'], top: ['ash', 'greige'], fronts: 'greige', hardware: 'steel', tap: 'steel' }),
  ],
  basic: [
    L('white', 'White', { frame: 'white', fronts: 'white', top: 'white' }),
    L('black', 'Black', { frame: 'black', fronts: 'black', top: 'black' }),
    L('oak', 'Oak', { frame: 'oak', fronts: 'oak', top: 'oak' }),
    L('walnut', 'Walnut', { frame: 'walnut', fronts: 'walnut', top: 'walnut' }),
    L('sage', 'Sage', { frame: 'sage', fronts: 'sage', top: 'sage' }),
    L('terracotta', 'Terracotta', { frame: 'terracotta', fronts: 'terracotta', top: 'terracotta' }),
  ],
};

/**
 * Roles of all slots of an item. Cushions in a different fabric from the upholstery (a daybed's
 * back cushions, bolsters) are accents that contrast, not a second seat in the same colour.
 */
export function slotRoles(asset: AssetDefinition, arche: Archetype): (Role | null)[] {
  const roles = asset.slots.map((s) => slotRole(asset, s, arche));
  const cushiony = (i: number) => /cushion|pillow|bolster/.test(first(asset.slots[i].label));
  roles.forEach((r, i) => {
    if (r !== 'seat' || !cushiony(i) || ROLE_OVERRIDES[asset.id]?.[asset.slots[i].id] !== undefined) return;
    const base = roles.findIndex((q, j) => j !== i && (q === 'upholstery' || (q === 'seat' && !cushiony(j))));
    if (base >= 0 && asset.slots[base].defaultMaterial !== asset.slots[i].defaultMaterial) roles[i] = 'accent';
  });
  // A table or desk made all of one wood (a trunk, a bureau, a hot-pot table): the wood body leads like a top.
  if (arche === 'table' && !roles.includes('top')) {
    const i = roles.findIndex((r, j) => r === 'frame' && WOOD_KINDS.has(materialKind(MATERIAL_CATALOG_BY_ID[asset.slots[j].defaultMaterial]) as Kind));
    if (i >= 0) roles[i] = 'top';
  }
  return roles;
}

/** The role that carries a look, by archetype: a look whose lead tones fit none of these slots is skipped. */
export const LEAD_ROLES: Record<Exclude<Archetype, 'none'>, Role[]> = {
  bed: ['duvet', 'sheets'],
  kids: ['duvet', 'body', 'fronts', 'frame', 'upholstery'],
  soft: ['upholstery', 'seat'],
  chair: ['frame', 'legs', 'top'],
  office: ['upholstery', 'seat', 'mesh'],
  outdoor: ['seat', 'upholstery', 'frame', 'top'],
  table: ['top'],
  storage: ['frame', 'fronts', 'top'],
  kitchen: ['fronts', 'frame', 'top'],
  bath: ['tap', 'frame', 'towel'],
  appliance: ['body', 'frame'],
  lighting: ['frame', 'legs', 'shade'],
  'tech-light': ['frame', 'hardware', 'shade', 'body'],
  rug: ['rug', 'towel'],
  curtain: ['curtain', 'frame'],
  cushion: ['accent', 'upholstery', 'seat'],
  'frame-decor': ['frame'],
  object: ['pot', 'crockery', 'frame', 'top'],
  fireplace: ['frame'],
  plant: ['pot', 'flower'],
  activity: ['frame', 'top'],
  pet: ['upholstery', 'frame'],
  structure: ['frame'],
  basic: ['frame'],
};

// ───────────── Names ─────────────

/** Words in look names and the tones they stand for. */
const NAME_TONES: Record<string, string[]> = {
  oak: ['oak', 'oak-wood'],
  walnut: ['walnut', 'walnut-wood'],
  teak: ['teak'],
  ash: ['ash'],
  acacia: ['acacia'],
  'smoked oak': ['espresso'],
  oat: ['linen'],
  linen: ['linen'],
  sage: ['sage'],
  navy: ['navy'],
  charcoal: ['charcoal'],
  black: ['black', 'ebony', 'charcoal'],
  rust: ['rust'],
  cognac: ['cognac'],
  grey: ['grey', 'light-grey'],
  'dove grey': ['light-grey'],
  white: ['white'],
  cream: ['cream'],
  blush: ['blush'],
  mustard: ['mustard'],
  olive: ['olive'],
  terracotta: ['terracotta'],
  'forest green': ['forest'],
  brass: ['brass'],
  chrome: ['chrome'],
  bronze: ['bronze'],
  copper: ['copper'],
  gold: ['gold'],
  gunmetal: ['gunmetal'],
  steel: ['steel', 'stainless'],
  aluminium: ['steel'],
  greige: ['greige'],
  graphite: ['anthracite'],
  'brushed nickel': ['steel'],
  marble: ['carrara', 'nero', 'beige-marble', 'green-marble'],
  stone: ['nero', 'quartz', 'granite', 'slate'],
  travertine: ['travertine'],
  red: ['red'],
  blue: ['blue'],
};

/** How a tone reads in a variant name. */
const TONE_LABELS: Record<string, string> = {
  'oak-wood': 'oak',
  'walnut-wood': 'walnut',
  ebony: 'black',
  espresso: 'dark oak',
  'light-grey': 'grey',
  linen: 'linen',
  stainless: 'steel',
  anthracite: 'graphite',
  carrara: 'marble',
  nero: 'black marble',
  'beige-marble': 'beige marble',
  'green-marble': 'green marble',
  'grey-oak': 'grey oak',
  'blue-geo': 'blue geometric',
  forest: 'forest green',
};

const cap = (s: string, like: string): string => (like[0] && like[0] === like[0].toUpperCase() ? s[0].toUpperCase() + s.slice(1) : s);

/** How a tone reads in a name ("ebony" → "black"). */
export const toneLabel = (tone: string): string => TONE_LABELS[tone] ?? tone;

/**
 * A look's name as it turned out on this item: "Sage & oak" on a sofa with metal legs that took the
 * brass alternative reads "Sage & brass"; a part the item does not have drops out of the name.
 * `used` lists, per slot, the tones the look offered and the one that applied.
 */
export function lookName(name: string, used: { tones: string[]; tone?: string }[]): string {
  const segments = name.split(' & ');
  const out: string[] = [];
  for (const seg of segments) {
    const lower = seg.toLowerCase();
    const key = Object.keys(NAME_TONES)
      .filter((k) => new RegExp(`\\b${k}\\b`).test(lower))
      .sort((a, b) => b.length - a.length)[0];
    if (!key) {
      out.push(seg);
      continue;
    }
    const tones = NAME_TONES[key];
    // The colour shows up on the item: keep the word.
    if (used.some((u) => u.tone && tones.includes(u.tone))) {
      out.push(seg);
      continue;
    }
    // Otherwise follow the slots the word was written for (their first choice is this tone).
    const offered = used.filter((u) => u.tones.length > 0 && tones.includes(u.tones[0]));
    if (!offered.length) {
      if (segments.length === 1) out.push(seg);
      continue;
    }
    const other = offered.find((u) => u.tone)?.tone;
    if (!other) {
      if (segments.length === 1) out.push(seg);
      continue;
    }
    const label = TONE_LABELS[other] ?? other;
    const at = lower.search(new RegExp(`\\b${key}\\b`));
    out.push(seg.slice(0, at) + cap(label, seg.slice(at)) + seg.slice(at + key.length));
  }
  // "Brass & brass" → "Brass".
  const unique = out.filter((s, i) => out.findIndex((t) => t.toLowerCase() === s.toLowerCase()) === i);
  return unique.length ? unique.join(' & ').replace(/^./, (c) => c.toUpperCase()) : '';
}

// ───────────── Overrides ─────────────

/** Items whose archetype the rules get wrong. */
export const ARCHETYPE_OVERRIDES: Record<string, Archetype> = {
  // A Vietnamese folding hammock: powder-coated frame and outdoor net colours, never brass.
  'vietnamese-home:folding-hammock': 'outdoor',
  // Water heaters are appliances (white, steel, black), not tap finishes.
  'water-heater': 'appliance',
  'bathroom-collection:instant-water-heater': 'appliance',
  // A parasol's canopy is outdoor fabric; the pole a wood or powder-coat.
  parasol: 'outdoor',
  // Traditional and folk pieces keep their own colours.
  'japanese-home:maneki-neko': 'none',
  'japanese-home:japanese-tea-set': 'none',
  'japanese-home:noren-curtain': 'none',
  'vietnamese-home:non-la-wall': 'none',
  'vietnamese-home:lacquer-painting': 'none',
  'asian-everyday:tiffin-carrier': 'none',
  'cafe-dining:table-caddy': 'none',
  'chinese-home:red-lantern-pair': 'none',
  'fire-pit': 'none',
  // Technical fixtures come in white, black, aluminium or graphite only.
  'lighting-collection:recessed-downlight': 'tech-light',
  'lighting-collection:downlight-set-4': 'tech-light',
  'lighting-collection:led-panel': 'tech-light',
  'lighting-collection:monorail-spots': 'tech-light',
  'lighting-collection:linear-wall-washer': 'tech-light',
  'lighting-collection:under-cabinet-led': 'tech-light',
  'lighting-designer:magnetic-track-system': 'tech-light',
  'lighting-designer:suspended-linear-led': 'tech-light',
  'track-spotlights': 'tech-light',
  'ceiling-light': 'tech-light',
};

/** Slots whose role the rules get wrong (`null` = keep the material). */
export const ROLE_OVERRIDES: Record<string, Record<string, Role | null>> = {
  // The upper bunk's duvet takes the accent colour, so the two beds differ.
  'bed-bunk': { accent: 'accent' },
  // A gongfu table keeps its black wujin stone tea tray.
  'chinese-home:gongfu-tea-table': { tray: null },
  // A projection screen keeps its black masking border; a water heater its copper pipes.
  'projection-screen': { border: null },
  'water-heater': { pipes: null },
  // The parasol canopy is the outdoor fabric.
  parasol: { canopy: 'upholstery' },
  // A play teepee's canvas is its main fabric, not art.
  'play-teepee': { canvas: 'upholstery' },
  // A pet carrier's moulded shell takes plastic-like colours.
  'pets:pet-carrier': { shell: 'upholstery' },
  // A backlit mirror's back plate is hidden.
  'bathroom-collection:round-led-mirror': { back: null },
  // A clawfoot bath's painted cast-iron outside takes paint colours, not wood.
  'bathtub-clawfoot': { shell: 'body' },
  // The desk of a loft or wall bed is a worktop.
  'bed-loft-desk': { desk: 'top' },
  'studio-beds:wall-bed-desk': { desk: 'top' },
};

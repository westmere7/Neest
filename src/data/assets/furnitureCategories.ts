import type { AssetDefinition, AssetType } from './types';
import { ASSET_TYPE_ORDER, groupRank } from './catalog';

/**
 * Multi-category classification for the Furniture library's left sidebar.
 *
 * Categories are split into two sections:
 *   1. `ROOM_CATEGORIES` ("By room"): Living room, Bedroom, Kitchen, Dining, Bathroom, …
 *   2. `ITEM_CATEGORIES` ("By item"): Sofas & chairs, Beds, Tables & desks, Cabinets, …
 *
 * A single asset may legitimately belong to two or more room categories (e.g. a sofa bed or
 * wall-mounted AC fits both Living room and Bedroom) and two or more item categories (e.g. a
 * kitchen sink counter fits Tables & desks, Cabinets, and Bath & sinks; a loft bed with a desk
 * fits Beds and Tables & desks).
 */

export type RoomCategoryId =
  | 'room:living'
  | 'room:bedroom'
  | 'room:kitchen'
  | 'room:dining'
  | 'room:bathroom'
  | 'room:office'
  | 'room:kids'
  | 'room:laundry'
  | 'room:outdoor';

export type ItemCategoryId =
  | 'item:seating'
  | 'item:beds'
  | 'item:tables'
  | 'item:storage'
  | 'item:appliances'
  | 'item:plumbing'
  | 'item:lighting'
  | 'item:electronics'
  | 'item:textiles'
  | 'item:decor'
  | 'item:plants'
  | 'item:structure'
  | 'item:hobbies'
  | 'item:pets'
  | 'item:people'
  | 'item:misc';

export type FurnitureCategoryId = RoomCategoryId | ItemCategoryId;

export interface FurnitureCategoryDef<Id extends FurnitureCategoryId = FurnitureCategoryId> {
  id: Id;
  section: 'room' | 'item';
  label: string;
  /** Vietnamese label & search synonyms (shown in tooltip and indexed for search). */
  vn: string;
  searchTerms: string;
  /** Preferred shelf `AssetType` order when displaying this category's shelves. */
  preferredTypes?: AssetType[];
}

export const ROOM_CATEGORIES: readonly FurnitureCategoryDef<RoomCategoryId>[] = [
  {
    id: 'room:living',
    section: 'room',
    label: 'Living room',
    vn: 'Phòng khách',
    searchTerms: 'phòng khách phong khach living lounge entryway hallway sảnh',
    preferredTypes: ['seating', 'surfaces', 'storage', 'electronics', 'beds', 'lighting', 'decor', 'structure'],
  },
  {
    id: 'room:bedroom',
    section: 'room',
    label: 'Bedroom',
    vn: 'Phòng ngủ',
    searchTerms: 'phòng ngủ phong ngu bedroom sleeping master',
    preferredTypes: ['beds', 'storage', 'surfaces', 'seating', 'lighting', 'decor', 'electronics', 'structure'],
  },
  {
    id: 'room:kitchen',
    section: 'room',
    label: 'Kitchen',
    vn: 'Bếp',
    searchTerms: 'bếp nhà bếp bep nha bep kitchen cooking pantry',
    preferredTypes: ['storage', 'surfaces', 'appliances', 'plumbing', 'seating', 'lighting', 'decor', 'plants'],
  },
  {
    id: 'room:dining',
    section: 'room',
    label: 'Dining',
    vn: 'Phòng ăn',
    searchTerms: 'phòng ăn phong an bàn ăn dining',
    preferredTypes: ['surfaces', 'seating', 'storage', 'lighting', 'appliances', 'decor'],
  },
  {
    id: 'room:bathroom',
    section: 'room',
    label: 'Bathroom',
    vn: 'Phòng tắm & vệ sinh',
    searchTerms: 'phòng tắm nhà vệ sinh toilet wc nha tam ve sinh bathroom',
    preferredTypes: ['plumbing', 'storage', 'decor', 'appliances', 'lighting', 'seating'],
  },
  {
    id: 'room:office',
    section: 'room',
    label: 'Study & office',
    vn: 'Phòng làm việc',
    searchTerms: 'phòng làm việc phong lam viec học tập study office workspace',
    preferredTypes: ['surfaces', 'seating', 'storage', 'electronics', 'lighting', 'activities', 'decor'],
  },
  {
    id: 'room:kids',
    section: 'room',
    label: 'Kids & nursery',
    vn: 'Phòng trẻ em',
    searchTerms: 'phòng trẻ em phong tre em bé nursery kids baby',
    preferredTypes: ['beds', 'kids', 'storage', 'surfaces', 'seating', 'activities', 'decor'],
  },
  {
    id: 'room:laundry',
    section: 'room',
    label: 'Laundry',
    vn: 'Giặt phơi & kho',
    searchTerms: 'giặt phơi giat phoi nhà kho utility laundry cleaning',
    preferredTypes: ['appliances', 'storage', 'plumbing', 'decor'],
  },
  {
    id: 'room:outdoor',
    section: 'room',
    label: 'Outdoor',
    vn: 'Ban công & sân vườn',
    searchTerms: 'ban công sân vườn lô gia ban cong san vuon outdoor balcony patio garden',
    preferredTypes: ['seating', 'surfaces', 'plants', 'lighting', 'appliances', 'activities', 'electronics', 'structure'],
  },
];

export const ITEM_CATEGORIES: readonly FurnitureCategoryDef<ItemCategoryId>[] = [
  {
    id: 'item:seating',
    section: 'item',
    label: 'Sofas & chairs',
    vn: 'Sofa & ghế ngồi',
    searchTerms: 'sofa ghế ghe đôn băng ghế chair armchair stool bench couch seating',
    preferredTypes: ['seating', 'beds', 'structure'],
  },
  {
    id: 'item:beds',
    section: 'item',
    label: 'Beds',
    vn: 'Giường ngủ',
    searchTerms: 'giường giuong nệm đệm phản sập bed mattress bunk crib',
    preferredTypes: ['beds', 'seating'],
  },
  {
    id: 'item:tables',
    section: 'item',
    label: 'Tables & desks',
    vn: 'Bàn & quầy',
    searchTerms: 'bàn ban quầy đảo bếp table desk counter island nightstand vanity',
    preferredTypes: ['surfaces', 'storage', 'beds'],
  },
  {
    id: 'item:storage',
    section: 'item',
    label: 'Cabinets',
    vn: 'Tủ, kệ & lưu trữ',
    searchTerms: 'tủ tu kệ ke giá sách tủ quần áo tủ bếp tủ giày cabinet wardrobe shelf bookcase dresser storage',
    preferredTypes: ['storage', 'surfaces', 'seating', 'beds', 'structure'],
  },
  {
    id: 'item:appliances',
    section: 'item',
    label: 'Appliances',
    vn: 'Thiết bị gia dụng',
    searchTerms: 'thiết bị gia dụng tủ lạnh máy giặt bếp từ lò nướng hút mùi quạt điều hòa máy lọc appliance fridge washer stove oven',
    preferredTypes: ['appliances', 'electronics', 'plumbing', 'surfaces'],
  },
  {
    id: 'item:plumbing',
    section: 'item',
    label: 'Bath & sinks',
    vn: 'Thiết bị vệ sinh & chậu rửa',
    searchTerms: 'thiết bị vệ sinh bồn cầu chậu rửa lavabo vòi sen bồn tắm bình nóng lạnh toilet sink basin shower tub',
    preferredTypes: ['plumbing', 'surfaces', 'storage'],
  },
  {
    id: 'item:lighting',
    section: 'item',
    label: 'Lighting',
    vn: 'Đèn chiếu sáng',
    searchTerms: 'đèn den chiếu sáng đèn trần đèn thả đèn bàn đèn sàn đèn tường lamp light chandelier pendant sconce',
    preferredTypes: ['lighting', 'decor', 'electronics'],
  },
  {
    id: 'item:electronics',
    section: 'item',
    label: 'Electronics',
    vn: 'Điện tử & điều hòa',
    searchTerms: 'điện tử tivi tv máy tính màn hình loa điều hòa máy lạnh quạt electronics computer audio ac',
    preferredTypes: ['electronics'],
  },
  {
    id: 'item:textiles',
    section: 'item',
    label: 'Rugs & drapes',
    vn: 'Thảm, chiếu & rèm',
    searchTerms: 'thảm tham chiếu chieu rèm rem màn gối rug mat carpet curtain blind cushion',
    preferredTypes: ['decor'],
  },
  {
    id: 'item:decor',
    section: 'item',
    label: 'Decor & art',
    vn: 'Gương, tranh & trang trí',
    searchTerms: 'trang trí gương tranh đồng hồ lọ hoa bàn thờ decor mirror painting art clock ornament',
    preferredTypes: ['decor', 'storage', 'surfaces'],
  },
  {
    id: 'item:plants',
    section: 'item',
    label: 'Plants',
    vn: 'Cây xanh & hoa',
    searchTerms: 'cây cay hoa chậu cây cây cảnh plant flower tree pot',
    preferredTypes: ['plants'],
  },
  {
    id: 'item:structure',
    section: 'item',
    label: 'Structure',
    vn: 'Kiến trúc & cầu thang',
    searchTerms: 'cột dầm trần vách ngăn cầu thang vòm khung cửa lan can column beam stair partition arch portal',
    preferredTypes: ['structure', 'decor'],
  },
  {
    id: 'item:hobbies',
    section: 'item',
    label: 'Hobbies & kids',
    vn: 'Thể thao, nhạc cụ & trẻ em',
    searchTerms: 'thể thao tập gym đàn nhạc cụ đồ chơi xe đạp xe máy fitness music toy game bike',
    preferredTypes: ['activities', 'kids'],
  },
  {
    id: 'item:pets',
    section: 'item',
    label: 'Pets',
    vn: 'Thú cưng',
    searchTerms: 'thú cưng chó mèo cá chim bể cá lồng pet cat dog aquarium bird',
    preferredTypes: ['pets'],
  },
  {
    id: 'item:people',
    section: 'item',
    label: 'People',
    vn: 'Người mẫu tỷ lệ',
    searchTerms: 'người nhân vật human person figure',
    preferredTypes: ['people'],
  },
  {
    id: 'item:misc',
    section: 'item',
    label: 'Shapes & imports',
    vn: 'Khối cơ bản & mô hình nhập',
    searchTerms: 'khối cơ bản import glb gltf custom shape',
    preferredTypes: ['misc'],
  },
];

export const ALL_FURNITURE_CATEGORIES: readonly FurnitureCategoryDef[] = [...ROOM_CATEGORIES, ...ITEM_CATEGORIES];

export const FURNITURE_CATEGORY_BY_ID: ReadonlyMap<FurnitureCategoryId, FurnitureCategoryDef> = new Map(
  ALL_FURNITURE_CATEGORIES.map((c) => [c.id, c]),
);

export const isFurnitureCategoryId = (v: string): v is FurnitureCategoryId =>
  v.startsWith('room:') || v.startsWith('item:');

export interface AssetCategoryMembership {
  rooms: RoomCategoryId[];
  items: ItemCategoryId[];
  all: Set<FurnitureCategoryId>;
}

const cache = new WeakMap<AssetDefinition, AssetCategoryMembership>();

/** Normalized searchable text for rule matching on an asset. */
function assetText(a: AssetDefinition): string {
  return `${a.id} ${a.name} ${a.group} ${a.tags.join(' ')} ${a.description ?? ''}`.toLowerCase();
}

/**
 * Computes all room and item categories an asset belongs to.
 * Cached by `AssetDefinition` object identity so repeated library filtering is O(1).
 */
export function furnitureCategoriesOf(a: AssetDefinition): AssetCategoryMembership {
  const hit = cache.get(a);
  if (hit) return hit;

  const rooms = new Set<RoomCategoryId>();
  const items = new Set<ItemCategoryId>();
  const txt = assetText(a);
  const g = a.group;

  // ── 1. Room categories (top section) ──
  switch (a.category) {
    case 'living':
      rooms.add('room:living');
      break;
    case 'bedroom':
      rooms.add('room:bedroom');
      break;
    case 'kitchen':
      rooms.add('room:kitchen');
      break;
    case 'dining':
      rooms.add('room:dining');
      break;
    case 'bathroom':
      rooms.add('room:bathroom');
      break;
    case 'office':
      rooms.add('room:office');
      break;
    case 'kids':
      rooms.add('room:kids');
      break;
    case 'laundry':
      rooms.add('room:laundry');
      break;
    case 'outdoor':
      rooms.add('room:outdoor');
      break;
    default:
      break;
  }

  // Multi-room furniture & cross-room categories:
  // Beds & bedroom furniture
  if (g === 'Beds' || g === 'Wall beds' || g === 'Daybeds & sofa beds' || g === 'Wardrobes' || g === 'Dressers & chests' || g === 'Nightstands' || g === 'Vanity & dressing tables') {
    rooms.add('room:bedroom');
  }
  if (g === 'Bunk & loft beds') {
    rooms.add('room:bedroom');
    if (/\b(bunk|kids|child|twin)\b/.test(txt)) rooms.add('room:kids');
  }
  if (g === 'Daybeds & sofa beds' || (a.type === 'beds' && /\b(sofa|couch|daybed)\b/.test(txt))) {
    rooms.add('room:living');
  }
  if (a.type === 'beds' && /\bdesk\b/.test(txt)) {
    rooms.add('room:office');
  }
  if (g === 'Beauty & makeup') {
    rooms.add('room:bedroom');
    rooms.add('room:bathroom');
  }
  if (/\bbedroom\b/.test(txt)) rooms.add('room:bedroom');

  // Living, hallway & study storage
  if (g === 'Sofas & loveseats' || g === 'Living chairs' || g === 'Ottomans & poufs' || g === 'Coffee tables' || g === 'End tables' || g === 'Console tables' || g === 'Media units' || g === 'Hallway storage' || g === 'Fireplaces' || g === 'Screens & dividers') {
    rooms.add('room:living');
  }
  if (g === 'Sideboards & cabinets') {
    rooms.add('room:living');
    if (!/\b(altar|shrine|thần tài|bàn thờ)\b/.test(txt)) rooms.add('room:dining');
  }
  if (g === 'Bookcases & shelves' && a.category !== 'laundry' && a.category !== 'bathroom' && a.category !== 'kitchen') {
    rooms.add('room:living');
    rooms.add('room:office');
  }

  // Office & study
  if (g === 'Desks' || g === 'Desk chairs' || g === 'Office storage' || g === 'Computers' || g === 'Knowledge') {
    rooms.add('room:office');
  }
  if (/\b(with desk|fold-down desk|fold-over desk|desk nook|office chair)\b/.test(txt)) {
    rooms.add('room:office');
  }

  // Kitchen & dining crossover
  if (g === 'Kitchen cabinets' || g === 'Counters & cabinets' || g === 'Cooking' || g === 'Refrigeration' || g === 'Small appliances') {
    rooms.add('room:kitchen');
  }
  if (g === 'Dining tables' || g === 'Dining chairs') {
    rooms.add('room:dining');
    if (/\b(drop-leaf|compact|tuck-away|breakfast|kitchen|folding)\b/.test(txt)) rooms.add('room:kitchen');
  }
  if (g === 'Stools & benches') {
    if (/\b(bar|counter|breakfast|island|kitchen|high stool|swivel bar|tractor)\b/.test(txt)) {
      rooms.add('room:kitchen');
      rooms.add('room:dining');
    } else if (/\b(ghế nhựa|ghế đôn|ghế tre|ghế băng|stackable|folding|dining)\b/.test(txt)) {
      rooms.add('room:dining');
      rooms.add('room:living');
    }
  }
  if (g === 'Candles & tabletop' && a.category !== 'bathroom') {
    rooms.add('room:dining');
    if (a.category === 'decor') rooms.add('room:living');
  }
  if ((g === 'Small appliances' || g === 'Refrigeration') && /\b(coffee|espresso|kettle|water dispenser|wine|tea)\b/.test(txt)) {
    rooms.add('room:dining');
  }

  // Bathroom & laundry crossover
  if (g === 'Toilets' || g === 'Showers & tubs' || g === 'Bathroom accessories' || g === 'Water heating') {
    if (a.category !== 'outdoor') rooms.add('room:bathroom');
  }
  if (g === 'Sinks') {
    if (a.category === 'kitchen' || /\b(kitchen|dish|drainer|apron)\b/.test(txt)) rooms.add('room:kitchen');
    else if (a.category === 'laundry' || /\b(laundry|utility|mop)\b/.test(txt)) {
      rooms.add('room:laundry');
      rooms.add('room:bathroom');
    } else rooms.add('room:bathroom');
  }
  if (g === 'Bathroom & laundry storage') {
    if (/\b(laundry|ironing|broom|hamper|drying)\b/.test(txt)) rooms.add('room:laundry');
    if (a.category === 'bathroom' || /\b(bath|toilet|medicine|mirror|vanity|towel)\b/.test(txt)) rooms.add('room:bathroom');
  }
  if (g === 'Laundry') {
    rooms.add('room:laundry');
    if (/\b(washing machine|washer|máy giặt)\b/.test(txt)) rooms.add('room:bathroom');
  }
  if (g === 'Cleaning') {
    rooms.add('room:laundry');
  }
  if (g === 'Baskets & boxes' && (a.category === 'storage' || a.category === 'laundry')) {
    rooms.add('room:laundry');
    rooms.add('room:bedroom');
  }

  // Kids
  if (a.type === 'kids' || g === 'Cots & kids beds' || g === 'Kids furniture' || g === 'Nursery' || g === 'Toys') {
    rooms.add('room:kids');
  }
  if (/\b(kids|kid's|children|nursery|play mat|hopscotch|alphabet)\b/.test(txt) && a.type !== 'people') {
    rooms.add('room:kids');
  }

  // Electronics & climate across rooms
  if (g === 'TV & audio') {
    rooms.add('room:living');
    if (/\b(tv|television|tivi)\b/.test(txt) && !/\b(stand|console|unit)\b/.test(a.name.toLowerCase())) {
      rooms.add('room:bedroom');
    }
  }
  if (g === 'Gaming' || (g === 'Smart home' && a.category === 'electronics')) {
    rooms.add('room:living');
  }
  const isOutdoorUnit = a.category === 'outdoor' || /\b(outdoor|condenser|dàn nóng|vrf)\b/.test(txt);
  const isExhaust = /\b(exhaust|hút mùi|thông gió)\b/.test(txt);
  if (g === 'Air conditioning') {
    if (isOutdoorUnit) rooms.add('room:outdoor');
    else {
      rooms.add('room:living');
      rooms.add('room:bedroom');
      rooms.add('room:office');
    }
  }
  if (g === 'Climate') {
    if (isExhaust) {
      rooms.add('room:bathroom');
      rooms.add('room:kitchen');
    } else if (!isOutdoorUnit) {
      rooms.add('room:living');
      rooms.add('room:bedroom');
    }
  }

  // Lighting across rooms
  if (a.type === 'lighting') {
    if (g === 'Outdoor & string lights') {
      rooms.add('room:outdoor');
    } else if (g === 'Floor lamps') {
      rooms.add('room:living');
      rooms.add('room:bedroom');
    } else if (g === 'Table lamps') {
      if (/\b(desk|task|architect|banker|clamp|work)\b/.test(txt)) {
        rooms.add('room:office');
        rooms.add('room:bedroom');
      } else {
        rooms.add('room:bedroom');
        rooms.add('room:living');
      }
    } else if (g === 'Wall lights') {
      if (a.category === 'bathroom' || /\b(vanity|bath|mirror)\b/.test(txt)) rooms.add('room:bathroom');
      rooms.add('room:bedroom');
      rooms.add('room:living');
    } else if (g === 'Ceiling lights') {
      if (/\b(panel|downlight|flush|plafond|at04|p06|spot)\b/.test(txt)) {
        rooms.add('room:living');
        rooms.add('room:bedroom');
        rooms.add('room:kitchen');
        rooms.add('room:bathroom');
        rooms.add('room:office');
      } else {
        rooms.add('room:living');
        rooms.add('room:dining');
        if (/\b(bedroom|woven|rattan|paper|fabric|lotus)\b/.test(txt)) rooms.add('room:bedroom');
      }
    }
  }

  // Soft furnishings, mirrors & wall decor across rooms
  if (g === 'Curtains & blinds') {
    rooms.add('room:living');
    rooms.add('room:bedroom');
    if (/\b(blind|zebra|roller|venetian|roman)\b/.test(txt)) rooms.add('room:office');
  }
  if (g === 'Cushions & throws') {
    rooms.add('room:living');
    rooms.add('room:bedroom');
  }
  if (g === 'Mirrors') {
    if (a.category === 'bathroom' || /\b(bath|vanity|medicine|backlit|led)\b/.test(txt)) rooms.add('room:bathroom');
    rooms.add('room:bedroom');
    if (a.category !== 'bathroom') rooms.add('room:living');
  }
  if (g === 'Wall art' || g.endsWith('paintings') || g === 'Clocks') {
    rooms.add('room:living');
    rooms.add('room:bedroom');
  }
  if (g === 'Ornaments' && a.category === 'decor') {
    rooms.add('room:living');
  }
  if (g === 'Rugs') {
    const isBath = a.category === 'bathroom' || /\b(bath|shower|pebble|diatomite|duckboard)\b/.test(txt);
    const isKitchen = a.category === 'kitchen' || /\b(kitchen|anti-fatigue)\b/.test(txt);
    const isLaundry = a.category === 'laundry' || /\blaundry\b/.test(txt);
    const isKids = a.category === 'kids' || /\b(play|kids|hopscotch|alphabet|road|puzzle)\b/.test(txt);
    const isOffice = a.category === 'office' || /\b(chair mat|office)\b/.test(txt);
    const isOutdoor = a.category === 'outdoor' || /\b(door mat|doormat|entrance|welcome|coir|outdoor|scraper)\b/.test(txt);
    const isFitness = a.category === 'hobbies' || /\b(yoga|gym|exercise|fitness)\b/.test(txt);
    const isPet = a.category === 'pets' || /\b(litter|pet|feeding|dog|cat)\b/.test(txt);
    if (isBath) rooms.add('room:bathroom');
    if (isKitchen) rooms.add('room:kitchen');
    if (isLaundry) rooms.add('room:laundry');
    if (isKids) rooms.add('room:kids');
    if (isOffice) rooms.add('room:office');
    if (isOutdoor) {
      rooms.add('room:outdoor');
      rooms.add('room:living');
    }
    if (!isBath && !isKitchen && !isLaundry && !isKids && !isOffice && !isFitness && !isPet && !isOutdoor) {
      rooms.add('room:living');
      rooms.add('room:bedroom');
      if (!/\b(tatami|chiếu|prayer)\b/.test(txt)) rooms.add('room:dining');
    }
  }

  // Outdoor & balcony extras
  if (g === 'Outdoor seating' || g === 'Outdoor tables' || g === 'Outdoor cooking' || g === 'Outdoor plants' || g === 'Bikes & scooters') {
    rooms.add('room:outdoor');
  }
  if (g === 'Herbs & edibles') {
    rooms.add('room:kitchen');
    rooms.add('room:outdoor');
  }
  if (/\b(balcony|window grille|safety cable)\b/.test(txt)) {
    rooms.add('room:outdoor');
  }

  // ── 2. Item / furniture categories (bottom section) ──
  switch (a.type) {
    case 'seating':
      items.add('item:seating');
      break;
    case 'beds':
      items.add('item:beds');
      break;
    case 'surfaces':
      items.add('item:tables');
      break;
    case 'storage':
      items.add('item:storage');
      break;
    case 'appliances':
      items.add('item:appliances');
      break;
    case 'plumbing':
      items.add('item:plumbing');
      break;
    case 'lighting':
      items.add('item:lighting');
      break;
    case 'electronics':
      items.add('item:electronics');
      break;
    case 'plants':
      items.add('item:plants');
      break;
    case 'structure':
      items.add('item:structure');
      break;
    case 'activities':
    case 'kids':
      items.add('item:hobbies');
      break;
    case 'pets':
      items.add('item:pets');
      break;
    case 'people':
      items.add('item:people');
      break;
    case 'misc':
      items.add('item:misc');
      break;
    case 'decor':
      if (g === 'Rugs' || g === 'Curtains & blinds' || g === 'Cushions & throws') {
        items.add('item:textiles');
      } else {
        items.add('item:decor');
      }
      break;
  }

  // Multi-item furniture overlaps ("Một item có thể thuộc 2 hoặc nhiều category"):
  // Sofa beds, daybeds, wall beds with sofa, benches with storage/table
  if (g === 'Daybeds & sofa beds' || (a.type !== 'people' && /\b(sofa bed|sleeper|with sofa|chair bed)\b/.test(txt))) {
    items.add('item:beds');
    items.add('item:seating');
  }
  // Beds or media units with integrated desks
  if ((a.type === 'beds' || a.type === 'storage' || a.type === 'structure') && /\b(with desk|fold-over desk|fold-down desk|desk nook)\b/.test(txt)) {
    items.add('item:tables');
  }
  // Kitchen counters, islands & base units are both work surfaces and cabinets
  if (g === 'Counters & cabinets') {
    items.add('item:tables');
    items.add('item:storage');
  }
  if (g === 'Kitchen cabinets' && /\b(counter|island|peninsula|worktop|bếp xây)\b/.test(txt)) {
    items.add('item:tables');
  }
  // Seating or beds with integrated wardrobes/drawers/storage
  if ((a.type === 'seating' || a.type === 'beds' || a.type === 'surfaces') && /\b(storage|drawers|wardrobe|shoe rack|cabinet|cupboard)\b/.test(txt)) {
    items.add('item:storage');
  }
  // Built-in structures that act as storage/wardrobes/shelves
  if (g === 'Built-ins' && /\b(shelf|shelves|niche|alcove|cabinet|wardrobe|bench)\b/.test(txt)) {
    if (/\b(shelf|shelves|niche|cabinet|wardrobe)\b/.test(txt)) items.add('item:storage');
    if (/\bbench\b/.test(txt)) items.add('item:seating');
  }
  // Counters/cabinets with integrated sinks or plumbing
  if ((a.services?.water || a.services?.drain) && a.type !== 'appliances' && a.type !== 'plumbing') {
    items.add('item:plumbing');
  }
  if (g === 'Counters & cabinets' && /\b(hob|oven|cooktop|dishwasher)\b/.test(txt)) {
    items.add('item:appliances');
  }
  // AC, fans, purifiers & water heaters are searched under both Appliances and Electronics/Bath
  if (g === 'Air conditioning' || g === 'Climate' || g === 'Water heating') {
    items.add('item:appliances');
  }
  // Lit mirrors, ceiling fans with light, backlit panels
  if (a.light && a.type !== 'lighting') {
    items.add('item:lighting');
  }
  // Mirrored cabinets & dressing tables with mirrors
  if (a.type !== 'decor' && /\b(mirror|mirrored)\b/.test(txt)) {
    items.add('item:decor');
  }
  // Altars & shrines sit in Storage (Sideboards & cabinets) and Decor
  if (/\b(altar|shrine|thần tài|bàn thờ)\b/.test(txt)) {
    items.add('item:decor');
  }
  // Screens, dividers, fireplaces & integrated balcony window-curtain units bridge Decor/Textiles and Structure
  if (g === 'Screens & dividers' || g === 'Fireplaces' || (g === 'Curtains & blinds' && /\b(balcony window|balcony door|cửa sổ ban công|cửa lùa ban công)\b/.test(txt))) {
    items.add('item:structure');
  }
  // Plants & flowers always in Plants
  if (a.plant || a.category === 'plants') {
    items.add('item:plants');
  }
  // Custom imported models also surface in Shapes & imports
  if (a.category === 'custom') {
    items.add('item:misc');
  }

  // Guarantee at least one item category
  if (items.size === 0) items.add('item:misc');

  const roomsList = ROOM_CATEGORIES.map((c) => c.id).filter((id) => rooms.has(id));
  const itemsList = ITEM_CATEGORIES.map((c) => c.id).filter((id) => items.has(id));
  const membership: AssetCategoryMembership = {
    rooms: roomsList,
    items: itemsList,
    all: new Set<FurnitureCategoryId>([...roomsList, ...itemsList]),
  };
  cache.set(a, membership);
  return membership;
}

/** Primary item category used by "Show in library" to jump straight to an asset's shelf. */
export function primaryItemCategoryOf(a: AssetDefinition): ItemCategoryId {
  return furnitureCategoriesOf(a).items[0] ?? 'item:misc';
}

/** Search text contributed by all categories an asset belongs to (English + Vietnamese). */
export function furnitureCategorySearchText(a: AssetDefinition): string {
  const m = furnitureCategoriesOf(a);
  const parts: string[] = [];
  for (const id of m.all) {
    const def = FURNITURE_CATEGORY_BY_ID.get(id);
    if (def) parts.push(def.label, def.vn, def.searchTerms);
  }
  return parts.join(' ');
}

/** Shelf sort key within a selected room or item category (signature types of a room sort first). */
export function categoryShelfRank(catId: FurnitureCategoryId, type: AssetType, group: string): number {
  const def = FURNITURE_CATEGORY_BY_ID.get(catId);
  const pref = def?.preferredTypes;
  const pIdx = pref ? pref.indexOf(type) : -1;
  const typeIdx = pIdx >= 0 ? pIdx : (pref ? pref.length : 0) + Math.max(0, ASSET_TYPE_ORDER.indexOf(type));
  return typeIdx * 1000 + groupRank(type, group);
}

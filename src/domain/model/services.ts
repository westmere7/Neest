/**
 * Services: one reference system for power and plumbing (electric, water supply and drainage).
 * Not a technical layout: points and runs show roughly where sockets, water points and drains are,
 * so items that need them are placed with them in mind. Shown only in Services mode.
 *
 * Import-free (types only), so any module can use the catalogue.
 */

export const SERVICE_SYSTEMS = ['power', 'water', 'drain'] as const;
export type ServiceSystem = (typeof SERVICE_SYSTEMS)[number];

/** Where a point or run sits: in a wall, in the floor (screed / slab) or in the ceiling. */
export const SERVICE_HOSTS = ['wall', 'floor', 'ceiling'] as const;
export type ServiceHost = (typeof SERVICE_HOSTS)[number];

export const SERVICE_POINT_KINDS = [
  // Electric
  'socket',
  'dedicated',
  'switch',
  'light',
  'data',
  'panel',
  // Water supply
  'water-cold',
  'water-hot',
  'hose-tap',
  'water-main',
  // Drainage (floor only)
  'floor-drain',
  'waste',
  'toilet-outlet',
  'stack',
] as const;
export type ServicePointKind = (typeof SERVICE_POINT_KINDS)[number];

export interface ServiceSystemInfo {
  id: ServiceSystem;
  name: string;
  /** Short name for chips and legends. */
  short: string;
  color: string;
  /** Run name (what a line of this system is). */
  run: string;
  /** Hosts a run of this system may use (drainage: floor only). */
  levels: readonly ServiceHost[];
}

/** Colours read on the light and dark plan and the dark X-ray 3D view alike. */
export const SERVICE_COLORS = {
  power: '#f5b400',
  water: '#1e90ff',
  /** Hot water runs and the hot side of mixer points. */
  hot: '#ff5a4a',
  drain: '#1fbf75',
  /** Marks a need no point or run covers. */
  missing: '#ff3b5c',
} as const;

export const SERVICE_SYSTEM_INFO: Record<ServiceSystem, ServiceSystemInfo> = {
  power: { id: 'power', name: 'Electric', short: 'Power', color: SERVICE_COLORS.power, run: 'Wiring', levels: ['wall', 'floor', 'ceiling'] },
  water: { id: 'water', name: 'Water supply', short: 'Water', color: SERVICE_COLORS.water, run: 'Water pipe', levels: ['wall', 'floor', 'ceiling'] },
  drain: { id: 'drain', name: 'Drainage', short: 'Drain', color: SERVICE_COLORS.drain, run: 'Drain pipe', levels: ['floor'] },
};

export const SERVICE_HOST_LABELS: Record<ServiceHost, string> = {
  wall: 'In wall',
  floor: 'In floor',
  ceiling: 'In ceiling',
};

export interface ServicePointInfo {
  kind: ServicePointKind;
  system: ServiceSystem;
  name: string;
  /** Vietnamese trade name. */
  vn: string;
  /** Allowed hosts, the default first. Drainage points are floor only. */
  hosts: readonly ServiceHost[];
  /** Default height above the floor of a wall point (m). */
  height: number;
  /** A supply or outlet the system starts or ends at (panel, water main, stack): runs are routed to it. */
  source?: boolean;
  description: string;
}

export const SERVICE_POINTS: Record<ServicePointKind, ServicePointInfo> = {
  socket: {
    kind: 'socket',
    system: 'power',
    name: 'Power socket',
    vn: 'Ổ cắm',
    hosts: ['wall', 'floor'],
    height: 0.3,
    description: 'Ordinary socket for plug-in items: lamps, TVs, chargers, small appliances. In a wall or as a floor box.',
  },
  dedicated: {
    kind: 'dedicated',
    system: 'power',
    name: 'Appliance outlet',
    vn: 'Ổ cắm riêng / aptomat',
    hosts: ['wall', 'floor'],
    height: 0.3,
    description: 'Outlet on its own circuit for heavy loads: air conditioners, water heaters, ovens, hobs, washers and dryers.',
  },
  switch: {
    kind: 'switch',
    system: 'power',
    name: 'Light switch',
    vn: 'Công tắc',
    hosts: ['wall'],
    height: 1.25,
    description: 'Wall switch for lights and fans, usually beside a door on the latch side.',
  },
  light: {
    kind: 'light',
    system: 'power',
    name: 'Light point',
    vn: 'Điểm đèn',
    hosts: ['ceiling', 'wall'],
    height: 2.1,
    description: 'Wired point for a ceiling light, downlight, fan or wall light.',
  },
  data: {
    kind: 'data',
    system: 'power',
    name: 'Network / TV point',
    vn: 'Ổ mạng / ổ TV',
    hosts: ['wall', 'floor'],
    height: 0.3,
    description: 'Low-voltage outlet for the router, TV aerial or cable, cameras and desks.',
  },
  panel: {
    kind: 'panel',
    system: 'power',
    name: 'Power in',
    vn: 'Tủ điện tổng (CB tổng)',
    hosts: ['wall'],
    height: 1.6,
    source: true,
    description: 'Where mains power comes in: the main circuit breaker and the distribution board. Every circuit starts here.',
  },
  'water-cold': {
    kind: 'water-cold',
    system: 'water',
    name: 'Cold water point',
    vn: 'Điểm cấp nước lạnh',
    hosts: ['wall', 'floor'],
    height: 0.5,
    description: 'Cold supply stub for a toilet, washing machine, fridge or filter.',
  },
  'water-hot': {
    kind: 'water-hot',
    system: 'water',
    name: 'Hot & cold water point',
    vn: 'Điểm cấp nước nóng lạnh',
    hosts: ['wall', 'floor'],
    height: 0.55,
    description: 'Pair of hot and cold stubs for a mixer: basins, sinks, showers, baths.',
  },
  'hose-tap': {
    kind: 'hose-tap',
    system: 'water',
    name: 'Tap',
    vn: 'Vòi nước',
    hosts: ['wall'],
    height: 0.6,
    description: 'Wall tap for the balcony, laundry corner or plants.',
  },
  'water-main': {
    kind: 'water-main',
    system: 'water',
    name: 'Water in',
    vn: 'Ống cấp nước tổng / đồng hồ nước',
    hosts: ['wall', 'floor'],
    height: 0.4,
    source: true,
    description: 'Where the water supply enters the home: the meter and shut-off on the riser or tank feed. Supply runs start here.',
  },
  'floor-drain': {
    kind: 'floor-drain',
    system: 'drain',
    name: 'Floor drain',
    vn: 'Phễu thu sàn',
    hosts: ['floor'],
    height: 0,
    description: 'Grated drain in a wet floor: showers, bathrooms, laundry and balconies.',
  },
  waste: {
    kind: 'waste',
    system: 'drain',
    name: 'Waste outlet',
    vn: 'Ống chờ thoát',
    hosts: ['floor'],
    height: 0,
    description: 'Waste pipe stub for a basin, sink, washer, dishwasher or AC condensate.',
  },
  'toilet-outlet': {
    kind: 'toilet-outlet',
    system: 'drain',
    name: 'Toilet outlet',
    vn: 'Ống chờ bồn cầu',
    hosts: ['floor'],
    height: 0,
    description: 'Large soil outlet (about Ø110) under a toilet; fixes where the toilet can go.',
  },
  stack: {
    kind: 'stack',
    system: 'drain',
    name: 'Waste out',
    vn: 'Ống đứng thoát nước (hộp gen)',
    hosts: ['floor'],
    height: 0,
    source: true,
    description: 'Where waste leaves: the building’s soil and waste stack (in the duct). Every drain run ends here.',
  },
};

export const servicePointSystem = (kind: ServicePointKind): ServiceSystem => SERVICE_POINTS[kind].system;

/** Point kinds of one system, in catalogue order. */
export const pointKindsOf = (system: ServiceSystem): ServicePointKind[] => SERVICE_POINT_KINDS.filter((k) => SERVICE_POINTS[k].system === system);

/** The mains: where power and water come in and waste leaves (one per system). */
export const MAIN_POINT_KINDS: ServicePointKind[] = SERVICE_POINT_KINDS.filter((k) => SERVICE_POINTS[k].source);

// ───────────────────────── What items need ─────────────────────────

/**
 * What a library item needs to work where it is placed.
 * - power: `plug` (any socket), `dedicated` (its own circuit: AC, water heater, oven…), `wired`
 *   (hard-wired fixture: ceiling lights, downlights, hoods).
 * - water: `cold` or `hot` (hot and cold for a mixer).
 * - drain: `waste` (a waste outlet or any drain), `soil` (toilet outlet), `floor` (a floor drain:
 *   showers and wet floors).
 */
export interface AssetServices {
  power?: 'plug' | 'dedicated' | 'wired';
  water?: 'cold' | 'hot';
  drain?: 'waste' | 'soil' | 'floor';
}

const POWER = ['plug', 'dedicated', 'wired'] as const;
const WATER = ['cold', 'hot'] as const;
const DRAIN = ['waste', 'soil', 'floor'] as const;

/**
 * Reads the compact form used by itemServices.json: space-separated tokens `power`, `power:dedicated`,
 * `power:wired`, `water`, `water:hot`, `drain`, `drain:soil`, `drain:floor`. Unknown tokens throw,
 * so a typo fails the tests instead of silently dropping a need.
 */
export function parseServices(spec: string): AssetServices {
  const out: AssetServices = {};
  for (const tok of spec.trim().split(/\s+/).filter(Boolean)) {
    const [sys, level] = tok.split(':');
    if (sys === 'power' && (!level || (POWER as readonly string[]).includes(level))) out.power = (level ?? 'plug') as AssetServices['power'];
    else if (sys === 'water' && (!level || (WATER as readonly string[]).includes(level))) out.water = (level ?? 'cold') as AssetServices['water'];
    else if (sys === 'drain' && (!level || (DRAIN as readonly string[]).includes(level))) out.drain = (level ?? 'waste') as AssetServices['drain'];
    else throw new Error(`Unknown service token "${tok}"`);
  }
  return out;
}

/** The compact form of `parseServices`. */
export function formatServices(s: AssetServices): string {
  const out: string[] = [];
  if (s.power) out.push(s.power === 'plug' ? 'power' : `power:${s.power}`);
  if (s.water) out.push(s.water === 'cold' ? 'water' : `water:${s.water}`);
  if (s.drain) out.push(s.drain === 'waste' ? 'drain' : `drain:${s.drain}`);
  return out.join(' ');
}

/** Systems an item needs, in legend order. */
export const neededSystems = (s: AssetServices | undefined): ServiceSystem[] => (s ? SERVICE_SYSTEMS.filter((sys) => !!s[sys]) : []);

/** The need of one system in words, e.g. "Own circuit" or "Hot & cold". */
export function needLabel(system: ServiceSystem, s: AssetServices): string {
  if (system === 'power') return s.power === 'dedicated' ? 'Own circuit (heavy load)' : s.power === 'wired' ? 'Wired light point' : 'Socket';
  if (system === 'water') return s.water === 'hot' ? 'Hot & cold supply' : 'Cold supply';
  return s.drain === 'soil' ? 'Toilet outlet' : s.drain === 'floor' ? 'Floor drain' : 'Waste outlet';
}

/** Which point kinds meet a need. */
export function pointsMeeting(system: ServiceSystem, s: AssetServices): ServicePointKind[] {
  if (system === 'power') {
    if (s.power === 'dedicated') return ['dedicated'];
    if (s.power === 'wired') return ['light', 'dedicated'];
    return ['socket', 'dedicated'];
  }
  if (system === 'water') return s.water === 'hot' ? ['water-hot'] : ['water-cold', 'water-hot', 'hose-tap'];
  if (s.drain === 'soil') return ['toilet-outlet', 'stack'];
  if (s.drain === 'floor') return ['floor-drain'];
  return ['waste', 'floor-drain', 'toilet-outlet', 'stack'];
}

/** The point kind added for a missing need ("Add missing points"). */
export function pointForNeed(system: ServiceSystem, s: AssetServices): ServicePointKind {
  return pointsMeeting(system, s)[0];
}

/** How far (m) from an item's outline a point may be and still serve it: a plug cord reaches further than a pipe. */
export function needReach(system: ServiceSystem, s: AssetServices): number {
  if (system === 'power') return s.power === 'plug' ? 1.8 : s.power === 'wired' ? 0.6 : 1.5;
  return 1.0;
}

/** Search words for an item's needs, so "power", "water" or "drain" find the items that need them. */
export function servicesSearchText(s: AssetServices | undefined): string {
  if (!s) return '';
  const out: string[] = [];
  if (s.power) out.push('power electric socket', s.power === 'dedicated' ? 'dedicated circuit' : s.power === 'wired' ? 'wired' : '');
  if (s.water) out.push('water plumbing supply', s.water === 'hot' ? 'hot water' : '');
  if (s.drain) out.push('drain drainage waste plumbing');
  return out.filter(Boolean).join(' ');
}

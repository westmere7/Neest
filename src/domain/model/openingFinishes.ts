import { isPassageKind, isWindowKind, type OpeningKind } from './schema';

/**
 * Finish sets (colour variants) for doors and windows: a frame material and, for doors, a leaf
 * material. Windows keep their glass, and glass door leaves stay glass. Picked in the Inspector
 * (for the selected openings) and in the door/window tool options (for the next one placed).
 * Users can save their own; those live in prefs under `USER_FINISH_KEY`.
 */
export interface OpeningFinish {
  id: string;
  name: string;
  frame: string;
  /** Doors only. */
  panel?: string;
}

export const DOOR_FINISHES: OpeningFinish[] = [
  { id: 'white', name: 'Satin white', frame: 'paint-satin-white', panel: 'paint-satin-white' },
  { id: 'light-oak', name: 'Light oak', frame: 'wood-oak-light', panel: 'wood-oak-light' },
  { id: 'white-oak', name: 'White frame, oak leaf', frame: 'paint-satin-white', panel: 'wood-oak-light' },
  { id: 'black-oak', name: 'Black frame, oak leaf', frame: 'metal-black-matte', panel: 'wood-oak-light' },
  { id: 'walnut', name: 'Walnut', frame: 'wood-walnut', panel: 'wood-walnut' },
  { id: 'teak', name: 'Teak', frame: 'wood-teak', panel: 'wood-teak' },
  { id: 'ironwood', name: 'Ironwood (gỗ lim)', frame: 'wood-ironwood', panel: 'wood-ironwood' },
  { id: 'rosewood', name: 'Rosewood (gỗ hương)', frame: 'wood-rosewood', panel: 'wood-rosewood' },
  { id: 'walnut-laminate', name: 'Walnut-effect laminate (composite)', frame: 'laminate-walnut', panel: 'laminate-walnut' },
  { id: 'grey-laminate', name: 'Grey laminate (composite)', frame: 'laminate-grey', panel: 'laminate-grey' },
  { id: 'charcoal', name: 'Charcoal paint', frame: 'paint-charcoal', panel: 'paint-charcoal' },
  { id: 'sage', name: 'Sage paint', frame: 'paint-sage', panel: 'paint-sage' },
  // Metal sets for glass doors: the leaf material is the profiles, or the fittings of frameless glass.
  { id: 'white-steel', name: 'White frame, brushed steel', frame: 'paint-satin-white', panel: 'metal-brushed-steel' },
  { id: 'white-brass', name: 'White frame, brass', frame: 'paint-satin-white', panel: 'metal-brass' },
  { id: 'black-metal', name: 'Black metal', frame: 'metal-black-matte', panel: 'metal-black-matte' },
  { id: 'anthracite', name: 'Anthracite aluminium', frame: 'metal-anthracite', panel: 'metal-anthracite' },
  { id: 'champagne', name: 'Champagne aluminium (Xingfa)', frame: 'metal-champagne', panel: 'metal-champagne' },
  { id: 'white-aluminium', name: 'White aluminium', frame: 'metal-white-powder', panel: 'metal-white-powder' },
];

export const WINDOW_FINISHES: OpeningFinish[] = [
  { id: 'anthracite', name: 'Anthracite aluminium', frame: 'metal-anthracite' },
  { id: 'white-upvc', name: 'White uPVC', frame: 'plastic-upvc-white' },
  { id: 'white-aluminium', name: 'White aluminium', frame: 'metal-white-powder' },
  { id: 'black', name: 'Black steel', frame: 'metal-black-matte' },
  { id: 'champagne', name: 'Champagne aluminium (Xingfa)', frame: 'metal-champagne' },
  { id: 'wood-grain', name: 'Wood-grain aluminium', frame: 'laminate-walnut' },
  { id: 'bronze', name: 'Bronze', frame: 'metal-bronze' },
  { id: 'oak', name: 'Oak', frame: 'wood-oak-light' },
  { id: 'ironwood', name: 'Ironwood (gỗ lim)', frame: 'wood-ironwood' },
];

export type FinishFamily = 'door' | 'window';

/** Door or window (passages have no finish sets). */
export const finishFamily = (kind: OpeningKind): FinishFamily | null => (isPassageKind(kind) ? null : isWindowKind(kind) ? 'window' : 'door');

export const finishesFor = (family: FinishFamily): OpeningFinish[] => (family === 'door' ? DOOR_FINISHES : WINDOW_FINISHES);

/** Key of the user's saved finishes in the prefs store's variant map. */
export const USER_FINISH_KEY: Record<FinishFamily, string> = { door: '@door', window: '@window' };

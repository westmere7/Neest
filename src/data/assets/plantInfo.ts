import type { LengthUnit } from '@/domain/model/schema';
import type { PlantDifficulty, PlantGrowth, PlantInfo, PlantLight } from './types';

/**
 * Display helpers and validation for an asset's plant care guide (`AssetDefinition.plant`).
 * Pure: shared by the library info card, the Inspector, library search and the pack loader.
 */

export const PLANT_LIGHTS: PlantLight[] = ['direct-sun', 'bright-indirect', 'medium', 'low'];

export const PLANT_LIGHT_LABELS: Record<PlantLight, string> = {
  'direct-sun': 'Direct sun',
  'bright-indirect': 'Bright indirect',
  medium: 'Medium light',
  low: 'Low light',
};

export const PLANT_DIFFICULTY_LABELS: Record<PlantDifficulty, string> = {
  easy: 'Easy care',
  moderate: 'Some care',
  demanding: 'Demanding',
};

export const PLANT_GROWTH_LABELS: Record<PlantGrowth, string> = {
  slow: 'Slow growing',
  moderate: 'Moderate growth',
  fast: 'Fast growing',
};

export const PLANT_HUMIDITY_LABELS: Record<PlantInfo['humidity']['level'], string> = {
  low: 'Low · dry air is fine',
  average: 'Average room air',
  high: 'High · likes humid air',
};

/** Imperial project units show °F and feet/inches first. */
const imperial = (units: LengthUnit) => units === 'ft' || units === 'in';

const toF = (c: number) => Math.round((c * 9) / 5 + 32);

/** "18–27 °C (64–81 °F)", or °F first for imperial projects. */
export function plantTempRange(t: PlantInfo['temperature'], units: LengthUnit): string {
  const c = `${t.min}–${t.max} °C`;
  const f = `${toF(t.min)}–${toF(t.max)} °F`;
  return imperial(units) ? `${f} (${c})` : `${c} (${f})`;
}

/** "16–27 °C", or °F for imperial projects (one short line). */
export function plantTempShort(t: PlantInfo['temperature'], units: LengthUnit): string {
  return imperial(units) ? `${toF(t.min)}–${toF(t.max)} °F` : `${t.min}–${t.max} °C`;
}

/** "Every 7–10 days; winter 2–3 weeks" (one short line). */
export function plantWaterShort(p: PlantInfo): string {
  const w = p.water.winter.replace(/^everys+/i, '');
  return `${p.water.summer}; winter ${w.charAt(0).toLowerCase()}${w.slice(1)}`;
}

/** "Not below 12 °C", or °F first for imperial projects. */
export function plantLowest(t: PlantInfo['temperature'], units: LengthUnit): string {
  return imperial(units) ? `Not below ${toF(t.lowest)} °F (${t.lowest} °C)` : `Not below ${t.lowest} °C (${toF(t.lowest)} °F)`;
}

const trim = (v: number, d: number) => v.toFixed(d).replace(/\.?0+$/, '');

/** A size range in friendly units: "30–60 cm", "1.5–3 m", "12–24 in", "4–6 ft". */
export function plantSizeRange([a, b]: [number, number], units: LengthUnit): string {
  if (imperial(units)) {
    if (b < 0.61) return `${Math.round(a / 0.0254)}–${Math.round(b / 0.0254)} in`;
    return `${trim(a / 0.3048, 1)}–${trim(b / 0.3048, 1)} ft`;
  }
  if (b < 1) return `${Math.round(a * 100)}–${Math.round(b * 100)} cm`;
  return `${trim(a, 2)}–${trim(b, 2)} m`;
}

/** "1.5–3 m tall, 0.6–1 m wide". */
export function plantMatureSize(p: PlantInfo, units: LengthUnit): string {
  return `${plantSizeRange(p.height, units)} tall, ${plantSizeRange(p.spread, units)} wide`;
}

/** Light levels as one phrase: "Bright indirect to medium light". */
export function plantLightText(light: PlantLight[]): string {
  if (!light.length) return '';
  const sorted = [...light].sort((x, y) => PLANT_LIGHTS.indexOf(x) - PLANT_LIGHTS.indexOf(y));
  const first = PLANT_LIGHT_LABELS[sorted[0]];
  if (sorted.length === 1) return first;
  const last = PLANT_LIGHT_LABELS[sorted[sorted.length - 1]].toLowerCase();
  return `${first} to ${last}`;
}

/** Words the library search should match for a plant (botanical name, light, pets, rooms…). */
export function plantSearchText(p: PlantInfo): string {
  return [
    p.botanical,
    p.family,
    p.aka ?? '',
    ...p.light.map((l) => PLANT_LIGHT_LABELS[l]),
    PLANT_DIFFICULTY_LABELS[p.difficulty],
    p.difficulty,
    p.pets.safe ? 'pet safe pet-safe non-toxic' : 'toxic to pets',
    p.humidity.level === 'high' ? 'humidity humid bathroom' : '',
    ...p.rooms,
  ].join(' ');
}

const isText = (v: unknown, max = 200): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isRange = (v: unknown): v is [number, number] => Array.isArray(v) && v.length === 2 && v.every(isNum) && v[0] > 0 && v[0] <= v[1];

/**
 * Problems with a plant care guide (empty = fine). Content packs are plain code, so the loader
 * runs this and drops a malformed guide instead of letting the UI trip over it.
 */
export function checkPlantInfo(p: unknown): string[] {
  if (!p || typeof p !== 'object') return ['plant info must be an object'];
  const v = p as Partial<PlantInfo>;
  const errors: string[] = [];
  const need = (ok: boolean, msg: string) => {
    if (!ok) errors.push(msg);
  };
  need(isText(v.botanical, 140), 'needs a botanical name');
  need(v.form === undefined || ['living', 'cut', 'dried', 'preserved'].includes(v.form), 'form must be living, cut, dried or preserved');
  need(!v.form || v.form === 'living' ? v.vaseLife === undefined || isText(v.vaseLife, 60) : isText(v.vaseLife, 60), 'cut, dried and preserved plants need a vaseLife');
  need(isText(v.family, 80), 'needs a family');
  need(v.aka === undefined || isText(v.aka, 80), 'aka must be short text');
  need(Array.isArray(v.light) && v.light.length > 0 && v.light.every((l) => PLANT_LIGHTS.includes(l)), `light must list some of ${PLANT_LIGHTS.join(', ')}`);
  need(Array.isArray(v.light) && new Set(v.light).size === v.light.length, 'light levels must not repeat');
  need(isText(v.spot), 'needs a spot (where to stand it)');
  need(isText(v.avoid), 'needs an avoid note');
  need(Array.isArray(v.rooms) && v.rooms.length > 0 && v.rooms.every((r) => isText(r, 30)), 'needs rooms');
  need(!!v.water && isText(v.water.summer, 80) && isText(v.water.winter, 80) && isText(v.water.sign), 'water needs summer, winter and sign');
  need(!!v.humidity && ['low', 'average', 'high'].includes(v.humidity.level) && isText(v.humidity.note), 'humidity needs a level and a note');
  const t = v.temperature;
  need(!!t && isNum(t.min) && isNum(t.max) && isNum(t.lowest) && t.lowest <= t.min && t.min < t.max && t.lowest >= -20 && t.max <= 45, 'temperature needs lowest ≤ min < max (°C)');
  need(isText(v.soil), 'needs a soil note');
  need(isText(v.repot), 'needs a repotting note');
  need(isText(v.feed), 'needs a feeding note');
  need(isRange(v.height) && v.height[1] <= 30, 'height must be [from, to] metres');
  need(isRange(v.spread) && v.spread[1] <= 30, 'spread must be [from, to] metres');
  need(['slow', 'moderate', 'fast'].includes(v.growth as string), 'growth must be slow, moderate or fast');
  need(!!v.pets && typeof v.pets.safe === 'boolean' && isText(v.pets.note), 'pets needs safe (true/false) and a note');
  need(['easy', 'moderate', 'demanding'].includes(v.difficulty as string), 'difficulty must be easy, moderate or demanding');
  need(v.tip === undefined || isText(v.tip, 240), 'tip must be short text');
  return errors;
}

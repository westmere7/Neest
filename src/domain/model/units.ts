import type { AreaUnit, LengthUnit } from './schema';

/** Display units per metre. */
export const UNIT_PER_METRE: Record<LengthUnit, number> = {
  mm: 1000,
  cm: 100,
  m: 1,
  in: 1 / 0.0254,
  ft: 1 / 0.3048,
};

export const UNIT_LABELS: Record<LengthUnit, string> = {
  mm: 'Millimetres',
  cm: 'Centimetres',
  m: 'Metres',
  in: 'Inches',
  ft: 'Feet & inches',
};

export const toUnit = (metres: number, unit: LengthUnit) => metres * UNIT_PER_METRE[unit];
export const fromUnit = (value: number, unit: LengthUnit) => value / UNIT_PER_METRE[unit];

const trimZeros = (s: string) => (s.includes('.') ? s.replace(/\.?0+$/, '') : s);

/** Number of decimals shown for a unit at a given project precision (0–3). */
export function decimalsFor(unit: LengthUnit, precision: number): number {
  switch (unit) {
    case 'mm':
      return 0;
    case 'cm':
      return Math.min(precision, 1);
    case 'm':
      return Math.max(precision, 1);
    case 'in':
    case 'ft':
      return Math.min(precision, 2);
  }
}

/**
 * Formats a length in metres for display.
 * Feet use a feet-and-inches notation (e.g. 10' 6"), inches use 126.5".
 */
export function formatLength(
  metres: number,
  unit: LengthUnit,
  precision = 2,
  opts: { suffix?: boolean } = {},
): string {
  const suffix = opts.suffix ?? true;
  if (!Number.isFinite(metres)) return '—';
  if (unit === 'ft') {
    const totalIn = Math.abs(metres) / 0.0254;
    const step = precision <= 0 ? 1 : precision === 1 ? 0.5 : 0.25;
    let inches = Math.round(totalIn / step) * step;
    let feet = Math.floor(inches / 12 + 1e-9);
    inches = inches - feet * 12;
    if (inches >= 12 - 1e-9) {
      feet += 1;
      inches = 0;
    }
    const sign = metres < 0 ? '-' : '';
    const inStr = trimZeros(inches.toFixed(2));
    return `${sign}${feet}' ${inStr}"`;
  }
  const v = toUnit(metres, unit);
  const d = decimalsFor(unit, precision);
  const text = v.toFixed(d);
  if (!suffix) return text;
  return unit === 'in' ? `${text}"` : `${text} ${unit}`;
}

/** Formats a plain numeric value in display units without suffix (for inputs). */
export function formatLengthValue(metres: number, unit: LengthUnit, precision = 2): string {
  if (unit === 'ft') return formatLength(metres, unit, precision);
  return trimZeros(toUnit(metres, unit).toFixed(Math.max(decimalsFor(unit, precision), unit === 'm' ? 3 : 1)));
}

const SUFFIX_FACTORS: Record<string, number> = {
  mm: 0.001,
  cm: 0.01,
  m: 1,
  in: 0.0254,
  '"': 0.0254,
  ft: 0.3048,
  "'": 0.3048,
};

/**
 * Parses user-entered length text into metres. Accepts plain numbers (in the
 * current display unit), explicit suffixes (mm, cm, m, in, ", ft, '), and
 * feet-inch notation such as 10'6" or 10 ft 6 in. Returns null when invalid.
 */
export function parseLength(input: string, unit: LengthUnit): number | null {
  const s = input.trim().toLowerCase().replace(/,/g, '.').replace(/\s+/g, ' ');
  if (!s) return null;
  const feetInches = s.match(/^(-?\d+(?:\.\d+)?)\s*(?:'|ft)\s*(?:(\d+(?:\.\d+)?)\s*(?:"|in)?)?$/);
  if (feetInches) {
    const feet = parseFloat(feetInches[1]);
    const inches = feetInches[2] ? parseFloat(feetInches[2]) : 0;
    const sign = feet < 0 ? -1 : 1;
    return sign * (Math.abs(feet) * 0.3048 + inches * 0.0254);
  }
  const withSuffix = s.match(/^(-?\d*\.?\d+(?:e-?\d+)?)\s*(mm|cm|m|in|"|ft|')?$/);
  if (!withSuffix) return null;
  const value = parseFloat(withSuffix[1]);
  if (!Number.isFinite(value)) return null;
  const suffix = withSuffix[2];
  if (suffix) return value * SUFFIX_FACTORS[suffix];
  if (unit === 'ft') return value * 0.3048;
  return fromUnit(value, unit);
}

export function formatArea(m2: number, unit: AreaUnit, precision = 2): string {
  if (!Number.isFinite(m2)) return '—';
  if (unit === 'ft2') return `${(m2 * 10.7639104).toFixed(Math.max(0, precision - 1))} ft²`;
  return `${m2.toFixed(Math.max(1, Math.min(precision, 2)))} m²`;
}

export function formatAngle(radians: number): string {
  let deg = (radians * 180) / Math.PI;
  deg = ((deg % 360) + 360) % 360;
  return `${trimZeros(deg.toFixed(1))}°`;
}

import type { PlanMode } from '@/state/editorStore';

/** Colours for plan rendering. Shared by the on-screen canvas and exports. */
export interface PlanPalette {
  paper: string;
  grid: string;
  gridMajor: string;
  wallFill: string;
  wallStroke: string;
  hubFill: string;
  line: string;
  lineThin: string;
  opening: string;
  glass: string;
  floorFallback: string;
  roomFillDraft: string;
  furnitureFill: string;
  furnitureStroke: string;
  label: string;
  labelMuted: string;
  dim: string;
  halo: string;
  shadow: string;
}

const LIGHT_DRAFT: PlanPalette = {
  paper: '#f4f2ed',
  grid: 'rgba(40,38,34,0.06)',
  gridMajor: 'rgba(40,38,34,0.13)',
  wallFill: '#26251f',
  wallStroke: '#1a1915',
  hubFill: '#26251f',
  line: '#2b2a26',
  lineThin: '#6f6b64',
  opening: '#2b2a26',
  glass: '#6f8fa8',
  floorFallback: '#e9e5dc',
  roomFillDraft: 'rgba(0,0,0,0)',
  furnitureFill: '#f4f2ed',
  furnitureStroke: '#7a766f',
  label: '#24231f',
  labelMuted: '#6c6862',
  dim: '#2f62a0',
  halo: '#f4f2ed',
  shadow: 'rgba(30,25,15,0.18)',
};

const DARK_DRAFT: PlanPalette = {
  paper: '#1c1e20',
  grid: 'rgba(255,255,255,0.035)',
  gridMajor: 'rgba(255,255,255,0.08)',
  wallFill: '#d9d5cc',
  wallStroke: '#ece8df',
  hubFill: '#d9d5cc',
  line: '#e2ded5',
  lineThin: '#99958d',
  opening: '#e2ded5',
  glass: '#8fb4d4',
  floorFallback: '#2a2c2f',
  roomFillDraft: 'rgba(0,0,0,0)',
  furnitureFill: '#1c1e20',
  furnitureStroke: '#9a968e',
  label: '#ecebe8',
  labelMuted: '#a29f98',
  dim: '#86b6ea',
  halo: '#1c1e20',
  shadow: 'rgba(0,0,0,0.45)',
};

const LIGHT_FURNISHED: PlanPalette = {
  ...LIGHT_DRAFT,
  labelMuted: '#3f3c36',
  halo: 'rgba(250,248,243,0.9)',
  paper: '#ebe8e1',
  wallFill: '#3b3a36',
  wallStroke: '#22211e',
  hubFill: '#3b3a36',
  furnitureStroke: 'rgba(30,28,24,0.55)',
};

const DARK_FURNISHED: PlanPalette = {
  ...DARK_DRAFT,
  // Floors are mostly light finishes: use dark labels with a light halo for legibility.
  label: '#211f1b',
  labelMuted: '#3f3c36',
  halo: 'rgba(250,248,243,0.9)',
  paper: '#17191b',
  wallFill: '#4a4b4e',
  wallStroke: '#c9c5bc',
  hubFill: '#4a4b4e',
  furnitureStroke: 'rgba(0,0,0,0.6)',
};

const LIGHT_PRESENTATION: PlanPalette = {
  ...LIGHT_FURNISHED,
  paper: '#f7f5f1',
  wallFill: '#2e2d2a',
  wallStroke: '#2e2d2a',
  hubFill: '#2e2d2a',
  label: '#3a3833',
  labelMuted: '#8a857c',
};

const DARK_PRESENTATION: PlanPalette = {
  ...DARK_FURNISHED,
  paper: '#141516',
  wallFill: '#e9e5dc',
  wallStroke: '#e9e5dc',
  hubFill: '#e9e5dc',
};

export function planPalette(mode: PlanMode, theme: 'light' | 'dark'): PlanPalette {
  if (theme === 'dark') return mode === 'draft' ? DARK_DRAFT : mode === 'furnished' ? DARK_FURNISHED : DARK_PRESENTATION;
  return mode === 'draft' ? LIGHT_DRAFT : mode === 'furnished' ? LIGHT_FURNISHED : LIGHT_PRESENTATION;
}

/** Print palette: always light paper for drawings and PDF/SVG/PNG sheets. */
export const printPalette = (mode: PlanMode) => planPalette(mode, 'light');

/** Darkens (amount < 0) or lightens (amount > 0) a hex colour. */
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  const t = amount < 0 ? 0 : 255;
  const p = Math.abs(amount);
  r = Math.round((t - r) * p + r);
  g = Math.round((t - g) * p + g);
  b = Math.round((t - b) * p + b);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

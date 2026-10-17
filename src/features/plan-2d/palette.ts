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
  paper: '#f6f7f8',
  grid: 'rgba(24,30,36,0.055)',
  gridMajor: 'rgba(24,30,36,0.11)',
  wallFill: '#222528',
  wallStroke: '#16181a',
  hubFill: '#222528',
  line: '#26292c',
  lineThin: '#686e75',
  opening: '#26292c',
  glass: '#6f8fa8',
  floorFallback: '#eceef0',
  roomFillDraft: 'rgba(0,0,0,0)',
  furnitureFill: '#f6f7f8',
  furnitureStroke: '#727880',
  label: '#1e2124',
  labelMuted: '#646a72',
  dim: '#2f62a0',
  halo: '#f6f7f8',
  shadow: 'rgba(15,23,32,0.15)',
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
  labelMuted: '#3a3f45',
  halo: 'rgba(255,255,255,0.9)',
  paper: '#eef0f2',
  wallFill: '#36393d',
  wallStroke: '#1e2023',
  hubFill: '#36393d',
  furnitureStroke: 'rgba(24,28,32,0.55)',
};

const DARK_FURNISHED: PlanPalette = {
  ...DARK_DRAFT,
  // Floors are mostly light finishes: use dark labels with a light halo for legibility.
  label: '#211f1b',
  labelMuted: '#3f3c36',
  halo: 'rgba(255,255,255,0.9)',
  paper: '#17191b',
  wallFill: '#4a4b4e',
  wallStroke: '#c9c5bc',
  hubFill: '#4a4b4e',
  furnitureStroke: 'rgba(0,0,0,0.6)',
};

const LIGHT_PRESENTATION: PlanPalette = {
  ...LIGHT_FURNISHED,
  paper: '#f8f9fa',
  wallFill: '#2a2d30',
  wallStroke: '#2a2d30',
  hubFill: '#2a2d30',
  label: '#32363a',
  labelMuted: '#7d848d',
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

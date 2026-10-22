import type { Callout } from '@/domain/model/schema';
import { CALLOUT_PALETTE } from './palette';

/**
 * Note styles shared by every renderer (plan SVG, 3D, render captures, guest viewer, DXF): label
 * look and size, leader line and the mark at the target end. Lengths are in screen pixels (or print
 * points); renderers scale them with their own `px`.
 */

/** Text size factor of a label. */
export const NOTE_SIZE_SCALE = { s: 0.85, m: 1, l: 1.25 } as const;
/** Leader width in pixels. */
export const NOTE_LINE_WIDTH = { thin: 0.8, regular: 1.3, bold: 2.2 } as const;
/** Size factor of the end mark. */
export const NOTE_END_SCALE = { s: 0.7, m: 1, l: 1.45 } as const;
/** Radius of a dot or ring and length of an arrow at size "m", in pixels. */
export const NOTE_END_PX = { dot: 4, ring: 4.5, arrow: 10 } as const;

export type NoteStyle = Pick<Callout, 'color' | 'box' | 'size' | 'line' | 'lineWeight' | 'end' | 'endSize' | 'highlight'>;

/** The style fields of a note (to copy between notes or remember for new ones). */
export function noteStyle(c: NoteStyle): NoteStyle {
  return { color: c.color, box: c.box, size: c.size, line: c.line, lineWeight: c.lineWeight, end: c.end, endSize: c.endSize, highlight: c.highlight };
}

export interface LabelColors {
  main: string;
  /** Box fill, or null for a text-only label. */
  fill: string | null;
  /** Box border, or null for none. */
  stroke: string | null;
  text: string;
  info: string;
  link: string;
  /** Accent stripe on the left edge. */
  stripe: boolean;
  /** White outline behind text (text-only labels). */
  halo: boolean;
}

/** Colours of a label for its look. */
export function labelColors(c: Pick<Callout, 'color' | 'box'>): LabelColors {
  const p = CALLOUT_PALETTE[c.color];
  switch (c.box) {
    case 'solid':
      return { main: p.main, fill: p.main, stroke: p.main, text: p.onMain, info: p.onMain === '#ffffff' ? 'rgba(255,255,255,0.82)' : 'rgba(0,0,0,0.62)', link: p.onMain, stripe: false, halo: false };
    case 'outline':
      return { main: p.main, fill: '#ffffff', stroke: p.main, text: '#1f2428', info: '#55626b', link: p.main, stripe: false, halo: false };
    case 'text':
      return { main: p.main, fill: null, stroke: null, text: p.text, info: '#55626b', link: p.main, stripe: false, halo: true };
    default:
      return { main: p.main, fill: p.fill, stroke: p.main, text: p.text, info: '#55626b', link: p.main, stripe: true, halo: false };
  }
}

/** Dash pattern of the leader in pixels (null = solid; the line is not drawn for "none"). */
export function leaderDash(c: Pick<Callout, 'line' | 'lineWeight'>): number[] | null {
  const w = NOTE_LINE_WIDTH[c.lineWeight];
  if (c.line === 'dashed') return [6 + w * 2, 4 + w];
  if (c.line === 'dotted') return [0.01, 2.6 + w * 1.6];
  return null;
}

/** Size of the end mark in pixels (dot/ring radius, arrow length). */
export function endPx(c: Pick<Callout, 'end' | 'endSize'>): number {
  return c.end === 'none' ? 0 : NOTE_END_PX[c.end] * NOTE_END_SCALE[c.endSize];
}

/** Arrowhead triangle at `tip`, pointing away from `from` (plan or screen units, `len` long). */
export function arrowHead(tip: { x: number; y: number }, from: { x: number; y: number }, len: number): { x: number; y: number }[] {
  let dx = tip.x - from.x;
  let dy = tip.y - from.y;
  const d = Math.hypot(dx, dy) || 1;
  dx /= d;
  dy /= d;
  const bx = tip.x - dx * len;
  const by = tip.y - dy * len;
  const hw = len * 0.42;
  return [
    { x: tip.x, y: tip.y },
    { x: bx - dy * hw, y: by + dx * hw },
    { x: bx + dy * hw, y: by - dx * hw },
  ];
}

import type { Callout, Project, Vec2 } from '@/domain/model/schema';
import type { DerivedPlan } from '@/domain/geometry/derive';
import { calloutAnchor, calloutLabelPoint, type CalloutAnchor } from '@/domain/geometry/callouts';
import { calloutLines, type Line } from './content';
import { NOTE_SIZE_SCALE, labelColors, type LabelColors } from './style';

/**
 * Plan layout of a callout label: sizes are constant on screen (scaled by `px`, the world size of a
 * screen pixel or print point), like the plan's other labels. The leader runs from the anchor to the
 * label's near edge; the box opens away from the anchor.
 */
export interface CalloutLayout {
  callout: Callout;
  anchor: CalloutAnchor;
  /** Where the leader meets the label. */
  attach: Vec2;
  box: { x: number; y: number; w: number; h: number };
  lines: Line[];
  font: number;
  lineH: number;
  pad: number;
  colors: LabelColors;
}

const FONT_PX = 11.5;

/** Font the plan draws labels in (PlanDrawing's default). */
const MEASURE_FONT = 'Inter, "Segoe UI", system-ui, -apple-system, Helvetica, Arial, sans-serif';
let measureCtx: CanvasRenderingContext2D | null | undefined;
/** A 2D context to measure text with, in real browsers only (tests and workers fall back to an estimate). */
function measurer(): CanvasRenderingContext2D | null {
  if (measureCtx !== undefined) return measureCtx;
  measureCtx = null;
  try {
    if (typeof document !== 'undefined' && !/jsdom/i.test(navigator.userAgent)) measureCtx = document.createElement('canvas').getContext('2d');
  } catch {
    measureCtx = null;
  }
  return measureCtx;
}

/** Text width in world units: measured with the plan font where possible, else estimated from character counts. */
export function textWidth(line: Line, font: number): number {
  const ctx = measurer();
  let w = 0;
  for (const r of line.runs) {
    const bold = r.bold || line.role === 'title';
    if (ctx) {
      // Measured at 100 px and scaled, so tiny world-unit sizes keep their precision.
      ctx.font = `${r.italic ? 'italic ' : ''}${bold ? 650 : 400} 100px ${MEASURE_FONT}`;
      w += (ctx.measureText(r.text).width / 100) * font;
    } else w += r.text.length * font * (bold ? 0.6 : 0.55);
  }
  return w + line.indent * font * 0.55;
}

export function layoutCallout(project: Project, derived: DerivedPlan | null, c: Callout, px: number): CalloutLayout | null {
  const anchor = calloutAnchor(project, derived, c.target);
  if (!anchor) return null;
  const k = NOTE_SIZE_SCALE[c.size];
  const font = FONT_PX * k * px;
  const lineH = font * 1.38;
  // Text-only labels sit closer to their leader.
  const pad = (c.box === 'text' ? 3 : 7) * k * px;
  const lines = calloutLines(project, derived, c);
  const w = Math.max(70 * px, Math.max(...lines.map((l) => textWidth(l, l.role === 'info' ? font * 0.92 : font))) + pad * 2 + 4 * px);
  const h = lines.length * lineH + pad * 2 - (lineH - font) * 0.4;
  const attach = calloutLabelPoint(anchor, c);
  const right = c.offset.x >= 0;
  const box = { x: right ? attach.x : attach.x - w, y: attach.y - h / 2, w, h };
  return { callout: c, anchor, attach, box, lines, font, lineH, pad, colors: labelColors(c) };
}

/** Callouts to draw: the layer and each callout's own visibility. */
export function visibleCallouts(project: Project): Callout[] {
  if (!project.layers.callouts?.visible) return [];
  return Object.values(project.callouts ?? {}).filter((c) => !c.hidden);
}

type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

/** Plan extent of the visible callouts (labels, leaders, outlines) at a label scale, or null. */
export function calloutExtent(project: Project, derived: DerivedPlan | null, px: number): Bounds | null {
  let e: Bounds | null = null;
  const add = (x: number, y: number) => {
    if (!e) e = { minX: x, minY: y, maxX: x, maxY: y };
    else e = { minX: Math.min(e.minX, x), minY: Math.min(e.minY, y), maxX: Math.max(e.maxX, x), maxY: Math.max(e.maxY, y) };
  };
  for (const c of visibleCallouts(project)) {
    const l = layoutCallout(project, derived, c, px);
    if (!l) continue;
    add(l.anchor.x, l.anchor.y);
    add(l.box.x, l.box.y);
    add(l.box.x + l.box.w, l.box.y + l.box.h);
    for (const p of l.anchor.outline ?? []) add(p.x, p.y);
  }
  return e;
}

/** Union of two plan extents. */
export function unionBounds<B extends Bounds>(a: B | null, b: Bounds | null): Bounds | null {
  if (!a) return b;
  if (!b) return a;
  return { minX: Math.min(a.minX, b.minX), minY: Math.min(a.minY, b.minY), maxX: Math.max(a.maxX, b.maxX), maxY: Math.max(a.maxY, b.maxY) };
}

/** The callout whose label is under `p` (top-most last drawn), for picking. */
export function hitCallout(project: Project, derived: DerivedPlan | null, p: Vec2, px: number, tol = 0): Callout | null {
  const list = visibleCallouts(project);
  for (let i = list.length - 1; i >= 0; i--) {
    const l = layoutCallout(project, derived, list[i], px);
    if (!l) continue;
    const b = l.box;
    if (p.x >= b.x - tol && p.x <= b.x + b.w + tol && p.y >= b.y - tol && p.y <= b.y + b.h + tol) return list[i];
  }
  return null;
}

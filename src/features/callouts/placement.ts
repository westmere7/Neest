/**
 * Screen layout of 3D note labels (the live view, render captures and the guest viewer). Pure maths
 * on screen pixels, no DOM or three.js, so every renderer shares it.
 *
 * Each label starts where its note floats (bottom-centre of the card at the projected label point).
 * "Clear of the walls" then moves labels out of the building's screen rectangle. Finally labels that
 * overlap are pushed apart and kept inside the view, as far as the space allows.
 */

export type NotePlacement = 'close' | 'further' | 'clear';

export interface ScreenRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LabelInput {
  id: string;
  /** Projected point the note points at. */
  anchor: { x: number; y: number };
  /** Preferred bottom-centre of the label. */
  prefer: { x: number; y: number };
  w: number;
  h: number;
}

export interface PlacedLabel {
  id: string;
  rect: ScreenRect;
  /** Where the leader meets the label: the point of the label nearest the anchor. */
  attach: { x: number; y: number };
}

export interface PlaceOptions {
  mode: NotePlacement;
  /** The building's screen rectangle, kept free of labels in "clear" mode. */
  obstacle?: ScreenRect | null;
  /** Space kept between labels, and from the view's edges and the building. */
  gap?: number;
  /** Pixels of each edge covered by floating panels: labels stay inside the free area. */
  insets?: { l: number; r: number; t: number; b: number };
  iterations?: number;
}

const overlapX = (a: ScreenRect, b: ScreenRect, gap: number) => Math.min(a.x + a.w + gap - b.x, b.x + b.w + gap - a.x);
const overlapY = (a: ScreenRect, b: ScreenRect, gap: number) => Math.min(a.y + a.h + gap - b.y, b.y + b.h + gap - a.y);

/** Moves `r` the shortest way out of `o` (grown by `gap`), unless that leaves the free area. */
function pushOut(r: ScreenRect, o: ScreenRect, gap: number, area: ScreenRect) {
  if (overlapX(r, o, gap) <= 0 || overlapY(r, o, gap) <= 0) return;
  const options = [
    { x: r.x, y: o.y - gap - r.h }, // above
    { x: r.x, y: o.y + o.h + gap }, // below
    { x: o.x - gap - r.w, y: r.y }, // left
    { x: o.x + o.w + gap, y: r.y }, // right
  ].filter((p) => p.x >= area.x && p.y >= area.y && p.x + r.w <= area.x + area.w && p.y + r.h <= area.y + area.h);
  if (!options.length) return;
  options.sort((a, b) => Math.hypot(a.x - r.x, a.y - r.y) - Math.hypot(b.x - r.x, b.y - r.y));
  r.x = options[0].x;
  r.y = options[0].y;
}

/** Lays out labels in a `view` of w × h pixels. */
export function placeNoteLabels(items: LabelInput[], view: { w: number; h: number }, o: PlaceOptions): PlacedLabel[] {
  const gap = o.gap ?? 6;
  const rects = items.map((it) => ({ x: it.prefer.x - it.w / 2, y: it.prefer.y - it.h, w: it.w, h: it.h }));
  const ins = o.insets ?? { l: 0, r: 0, t: 0, b: 0 };
  const area = { x: ins.l + gap, y: ins.t + gap, w: view.w - ins.l - ins.r - gap * 2, h: view.h - ins.t - ins.b - gap * 2 };
  const clamp = (r: ScreenRect) => {
    r.x = Math.max(area.x, Math.min(area.x + area.w - r.w, r.x));
    r.y = Math.max(area.y, Math.min(area.y + area.h - r.h, r.y));
  };
  const obstacle = o.mode === 'clear' ? o.obstacle : null;
  rects.forEach((r) => {
    if (obstacle) pushOut(r, obstacle, gap * 2, area);
    clamp(r);
  });
  // Push overlapping labels apart along the axis where they overlap least, half each.
  const order = items.map((_, i) => i).sort((a, b) => (items[a].id < items[b].id ? -1 : 1));
  for (let it = 0; it < (o.iterations ?? 80); it++) {
    let moved = false;
    for (let a = 0; a < order.length; a++)
      for (let b = a + 1; b < order.length; b++) {
        const r1 = rects[order[a]];
        const r2 = rects[order[b]];
        const ox = overlapX(r1, r2, gap);
        const oy = overlapY(r1, r2, gap);
        if (ox <= 0 || oy <= 0) continue;
        moved = true;
        // Vertically would push one of them into the building ("clear"): go sideways instead.
        const dy = (oy / 2 + 0.5) * (r1.y + r1.h / 2 <= r2.y + r2.h / 2 ? 1 : -1);
        const intoBuilding =
          !!obstacle && [{ ...r1, y: r1.y - dy }, { ...r2, y: r2.y + dy }].some((r) => overlapX(r, obstacle, gap) > 0 && overlapY(r, obstacle, gap) > 0);
        if (ox < oy || intoBuilding) {
          const d = (ox / 2 + 0.5) * (r1.x + r1.w / 2 <= r2.x + r2.w / 2 ? 1 : -1);
          r1.x -= d;
          r2.x += d;
        } else {
          r1.y -= dy;
          r2.y += dy;
        }
      }
    rects.forEach((r) => {
      if (obstacle) pushOut(r, obstacle, gap * 2, area);
      clamp(r);
    });
    if (!moved) break;
  }
  return items.map((it, i) => {
    const r = rects[i];
    return {
      id: it.id,
      rect: r,
      attach: { x: Math.max(r.x, Math.min(r.x + r.w, it.anchor.x)), y: Math.max(r.y, Math.min(r.y + r.h, it.anchor.y)) },
    };
  });
}

/** True when a projected point is inside the view (with a small margin): notes on things out of view are not shown. */
export function inView(p: { x: number; y: number }, view: { w: number; h: number }, margin = 4): boolean {
  return p.x >= -margin && p.y >= -margin && p.x <= view.w + margin && p.y <= view.h + margin;
}

/** Screen rectangle around projected points (the building's box corners); null if none are in front. */
export function screenBounds(points: ({ x: number; y: number } | null)[]): ScreenRect | null {
  const ps = points.filter((p): p is { x: number; y: number } => !!p);
  if (!ps.length) return null;
  const xs = ps.map((p) => p.x);
  const ys = ps.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

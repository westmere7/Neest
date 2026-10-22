import { renderToStaticMarkup } from 'react-dom/server';
import type { LengthUnit, Project } from '@/domain/model/schema';
import { derivePlan } from '@/domain/geometry/derive';
import { formatArea } from '@/domain/model/units';
import { PlanDrawing } from '@/features/plan-2d/PlanDrawing';
import { printPalette } from '@/features/plan-2d/palette';
import type { PlanMode } from '@/state/editorStore';
import { calloutExtent, unionBounds } from '@/features/callouts/layout';

export type PaperSize = 'A4' | 'A3' | 'A2' | 'Letter' | 'Tabloid';
export const PAPER_MM: Record<PaperSize, [number, number]> = {
  A4: [297, 210],
  A3: [420, 297],
  A2: [594, 420],
  Letter: [279.4, 215.9],
  Tabloid: [431.8, 279.4],
};

export interface SheetOptions {
  paper: PaperSize;
  orientation: 'landscape' | 'portrait';
  /** Drawing scale denominator (1:N), or 'fit' to fill the drawing area. */
  scale: number | 'fit';
  mode: PlanMode;
  units: LengthUnit;
  precision: number;
  roomLabels: boolean;
  roomAreas: boolean;
  overallDims: boolean;
  wallDims: boolean;
  roomDims: boolean;
  furniture: boolean;
  /** Callout labels (those visible in the editor). */
  callouts: boolean;
  titleBlock: boolean;
  scaleBar: boolean;
  legend: boolean;
  /** Use textured floor fills (raster patterns); disable for pure vector output. */
  textures: boolean;
  /** Text halos (not supported by the PDF converter). */
  halo: boolean;
  marginMm: number;
  title: string;
}

export const SCALE_PRESETS = [20, 25, 50, 75, 100, 200] as const;

export interface SheetResult {
  svg: string;
  widthMm: number;
  heightMm: number;
  /** Effective scale denominator (1:N). */
  scale: number;
  warnings: string[];
}

/** Size of one drawing "pixel" on paper. Keeps line weights and text legible at any scale. */
const PX_MM = 0.22;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const n = (v: number) => (Math.round(v * 1000) / 1000).toString();

/**
 * Builds a vector technical sheet: the plan at a true drawing scale plus
 * title block, scale bar and optional legend. Units of the SVG are millimetres
 * on paper, so the plan's dimensions are exact at the stated scale.
 */
export function buildSheet(project: Project, o: SheetOptions): SheetResult {
  const warnings: string[] = [];
  const [pw, ph] = PAPER_MM[o.paper];
  const W = o.orientation === 'landscape' ? pw : ph;
  const H = o.orientation === 'landscape' ? ph : pw;
  const m = o.marginMm;
  const titleH = o.titleBlock ? 24 : 0;
  const legendW = o.legend ? Math.min(70, W * 0.24) : 0;
  const area = { x: m, y: m, w: W - 2 * m - (legendW ? legendW + 6 : 0), h: H - 2 * m - (titleH ? titleH + 5 : 0) };
  const derived = derivePlan(project);
  const planBounds = derived.bounds;
  // Callout labels keep their size on paper, so their extent depends on the scale: fit them in two passes.
  const pxAt = (s: number) => PX_MM / (1000 / s);
  const extent = (s: number) => (o.callouts ? unionBounds(planBounds, calloutExtent(project, derived, pxAt(s))) : planBounds);
  let b = planBounds;
  // Dimension lines extend outside the walls; reserve room for them.
  const annoPad = (o.overallDims ? 16 : 4) + (o.wallDims ? 8 : 0);
  const fitScale = (bb: NonNullable<typeof b>) => {
    const bw = Math.max(0.5, bb.maxX - bb.minX);
    const bh = Math.max(0.5, bb.maxY - bb.minY);
    const k = Math.min((area.w - annoPad * 2) / bw, (area.h - annoPad * 2) / bh); // mm per metre
    return Math.max(1, Math.ceil(1000 / k));
  };
  let scale: number;
  if (!b) {
    scale = typeof o.scale === 'number' ? o.scale : 50;
    warnings.push('The plan is empty.');
  } else if (o.scale === 'fit') {
    scale = fitScale(b);
    for (let i = 0; i < 2; i++) {
      b = extent(scale) ?? b;
      scale = fitScale(b);
    }
    b = extent(scale) ?? b;
  } else {
    scale = o.scale;
    const k = 1000 / scale;
    const fits = (bb: NonNullable<typeof b>) => (bb.maxX - bb.minX) * k + annoPad * 2 <= area.w && (bb.maxY - bb.minY) * k + annoPad * 2 <= area.h;
    const withCallouts = extent(scale) ?? b;
    if (!fits(b)) {
      warnings.push(`At 1:${scale} the plan does not fit on ${o.paper} ${o.orientation}. Choose a smaller scale, a larger paper size, or fit to page.`);
    } else if (fits(withCallouts)) {
      b = withCallouts;
    } else {
      // The plan stays centred and whole; callout labels past the drawing area are cut off.
      warnings.push(`At 1:${scale} some callouts fall outside the drawing area. Move their labels closer, choose a smaller scale or fit to page.`);
    }
  }
  const k = 1000 / scale; // paper mm per world metre
  const cx = b ? (b.minX + b.maxX) / 2 : 0;
  const cy = b ? (b.minY + b.maxY) / 2 : 0;
  const px = PX_MM / k; // world metres per drawing px
  const palette = printPalette(o.mode);
  const drawing = renderToStaticMarkup(
    <PlanDrawing
      project={project}
      derived={derived}
      opts={{
        mode: o.mode,
        palette,
        px,
        unit: o.units,
        precision: o.precision,
        areaUnit: project.settings.areaUnit,
        showRoomLabels: o.roomLabels,
        showAreas: o.roomAreas,
        dims: { overall: o.overallDims, walls: o.wallDims, rooms: o.roomDims },
        showFurniture: o.furniture,
        showConstruction: true,
        showAnnotations: true,
        showCallouts: o.callouts,
        calloutLinks: true,
        textures: o.textures,
        shadows: o.mode === 'presentation' && o.textures,
        halo: o.halo,
        idPrefix: 'sheet',
      }}
    />,
  );
  const ox = area.x + area.w / 2;
  const oy = area.y + area.h / 2;
  const parts: string[] = [];
  parts.push(`<rect x="0" y="0" width="${n(W)}" height="${n(H)}" fill="${palette.paper}"/>`);
  parts.push(
    `<defs><clipPath id="sheet-clip"><rect x="${n(area.x)}" y="${n(area.y)}" width="${n(area.w)}" height="${n(area.h)}"/></clipPath></defs>`,
  );
  parts.push(
    `<g clip-path="url(#sheet-clip)"><g transform="translate(${n(ox)} ${n(oy)}) scale(${n(k)}) translate(${n(-cx)} ${n(-cy)})">${drawing}</g></g>`,
  );
  // Sheet border.
  parts.push(`<rect x="${n(m / 2)}" y="${n(m / 2)}" width="${n(W - m)}" height="${n(H - m)}" fill="none" stroke="#2b2a26" stroke-width="0.35"/>`);
  const font = 'font-family="Helvetica, Arial, sans-serif"';
  if (o.titleBlock) {
    const ty = H - m - titleH;
    const tw = W - 2 * m;
    const date = new Date().toISOString().slice(0, 10);
    const totalArea = derived.faces.reduce((s, f) => s + f.area, 0);
    parts.push(`<g ${font} fill="#24231f">`);
    parts.push(`<rect x="${n(m)}" y="${n(ty)}" width="${n(tw)}" height="${n(titleH)}" fill="none" stroke="#2b2a26" stroke-width="0.35"/>`);
    const col = [m, m + tw * 0.44, m + tw * 0.62, m + tw * 0.8];
    for (let i = 1; i < col.length; i++) parts.push(`<line x1="${n(col[i])}" y1="${n(ty)}" x2="${n(col[i])}" y2="${n(ty + titleH)}" stroke="#2b2a26" stroke-width="0.25"/>`);
    parts.push(`<text x="${n(col[0] + 4)}" y="${n(ty + 9)}" font-size="5.2" font-weight="700">${esc(o.title || project.name)}</text>`);
    parts.push(`<text x="${n(col[0] + 4)}" y="${n(ty + 15.5)}" font-size="3">Floor plan · ${derived.faces.length} rooms · ${esc(formatArea(totalArea, project.settings.areaUnit, 1))} net floor area</text>`);
    parts.push(`<text x="${n(col[0] + 4)}" y="${n(ty + 20.5)}" font-size="2.4" fill="#6c6862">PLANNING DRAWING — NOT FOR CONSTRUCTION. Verify all dimensions on site.</text>`);
    const cell = (x: number, label: string, value: string) => {
      parts.push(`<text x="${n(x + 3)}" y="${n(ty + 7)}" font-size="2.4" fill="#6c6862">${esc(label)}</text>`);
      parts.push(`<text x="${n(x + 3)}" y="${n(ty + 15)}" font-size="4.6" font-weight="600">${esc(value)}</text>`);
    };
    cell(col[1], 'SCALE', `1:${scale}${o.scale === 'fit' ? ' (fit)' : ''} @ ${o.paper}`);
    cell(col[2], 'UNITS', o.units === 'ft' ? 'feet-inches' : o.units);
    cell(col[3], 'DATE', date);
    parts.push(`<text x="${n(col[3] + 3)}" y="${n(ty + 21)}" font-size="2.2" fill="#6c6862">Neest · neest-plan</text>`);
    parts.push('</g>');
  }
  if (o.scaleBar) {
    const imperial = o.units === 'ft' || o.units === 'in';
    const unitLen = imperial ? 0.3048 : 1; // one foot or one metre
    const target = 40; // aim for ~40 mm bar
    const steps = [1, 2, 5, 10, 20, 50];
    const stepUnits = steps.find((s) => s * unitLen * k * 4 >= target * 0.6) ?? 50;
    const seg = stepUnits * unitLen * k;
    const bx = m + 4;
    const by = (o.titleBlock ? H - m - titleH - 6 : H - m - 6) - 2;
    parts.push(`<g ${font} fill="#24231f">`);
    for (let i = 0; i < 4; i++) {
      parts.push(`<rect x="${n(bx + i * seg)}" y="${n(by)}" width="${n(seg)}" height="1.6" fill="${i % 2 ? '#ffffff' : '#24231f'}" stroke="#24231f" stroke-width="0.2"/>`);
      parts.push(`<text x="${n(bx + i * seg)}" y="${n(by - 1.2)}" font-size="2.2" text-anchor="middle">${i * stepUnits}</text>`);
    }
    parts.push(`<text x="${n(bx + 4 * seg)}" y="${n(by - 1.2)}" font-size="2.2" text-anchor="middle">${4 * stepUnits} ${imperial ? 'ft' : 'm'}</text>`);
    parts.push('</g>');
  }
  if (o.legend) {
    const lx = W - m - legendW;
    let ly = m + 4;
    parts.push(`<g ${font} fill="#24231f">`);
    parts.push(`<text x="${n(lx)}" y="${n(ly + 3)}" font-size="3.2" font-weight="700">ROOMS</text>`);
    ly += 9;
    derived.faces.forEach((f, i) => {
      if (ly > H - m - titleH - 30) return;
      const r = derived.faceRooms[i];
      parts.push(`<text x="${n(lx)}" y="${n(ly)}" font-size="2.6">${esc(r?.name ?? 'Room')}</text>`);
      parts.push(`<text x="${n(lx + legendW)}" y="${n(ly)}" font-size="2.6" text-anchor="end">${esc(formatArea(f.area, project.settings.areaUnit, 1))}</text>`);
      ly += 4.4;
    });
    const total = derived.faces.reduce((s, f) => s + f.area, 0);
    parts.push(`<line x1="${n(lx)}" y1="${n(ly - 2.5)}" x2="${n(lx + legendW)}" y2="${n(ly - 2.5)}" stroke="#24231f" stroke-width="0.2"/>`);
    parts.push(`<text x="${n(lx)}" y="${n(ly + 1)}" font-size="2.6" font-weight="700">Total</text>`);
    parts.push(`<text x="${n(lx + legendW)}" y="${n(ly + 1)}" font-size="2.6" font-weight="700" text-anchor="end">${esc(formatArea(total, project.settings.areaUnit, 1))}</text>`);
    ly += 10;
    parts.push(`<text x="${n(lx)}" y="${n(ly)}" font-size="3.2" font-weight="700">LEGEND</text>`);
    ly += 6;
    parts.push(`<rect x="${n(lx)}" y="${n(ly - 2.5)}" width="10" height="2.6" fill="${palette.wallFill}"/><text x="${n(lx + 13)}" y="${n(ly)}" font-size="2.6">Wall (cut)</text>`);
    ly += 5.5;
    parts.push(`<path d="M${n(lx)} ${n(ly)}h10M${n(lx)} ${n(ly)}a8 8 0 0 1 8 -8" fill="none" stroke="#2b2a26" stroke-width="0.25" transform="translate(0 0)"/><text x="${n(lx + 13)}" y="${n(ly)}" font-size="2.6">Door with swing</text>`);
    ly += 5.5;
    parts.push(`<path d="M${n(lx)} ${n(ly - 2)}h10M${n(lx)} ${n(ly - 0.6)}h10" stroke="${palette.glass}" stroke-width="0.3"/><text x="${n(lx + 13)}" y="${n(ly)}" font-size="2.6">Window</text>`);
    ly += 5.5;
    parts.push(`<path d="M${n(lx)} ${n(ly - 1.3)}h10" stroke="${palette.dim}" stroke-width="0.25"/><text x="${n(lx + 13)}" y="${n(ly)}" font-size="2.6">Dimension (${o.units === 'ft' ? 'ft-in' : o.units})</text>`);
    parts.push('</g>');
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${n(W)}mm" height="${n(H)}mm" viewBox="0 0 ${n(W)} ${n(H)}">${parts.join('')}</svg>`;
  return { svg, widthMm: W, heightMm: H, scale, warnings };
}

export function defaultSheetOptions(project: Project): SheetOptions {
  return {
    paper: 'A3',
    orientation: 'landscape',
    scale: 50,
    mode: 'draft',
    units: project.settings.units,
    precision: project.settings.precision,
    roomLabels: true,
    roomAreas: true,
    overallDims: true,
    wallDims: true,
    roomDims: false,
    furniture: true,
    callouts: true,
    titleBlock: true,
    scaleBar: true,
    legend: true,
    textures: false,
    halo: true,
    marginMm: 10,
    title: project.name,
  };
}

/** Formats an estimated output description for the export dialog. */
export function describeSheet(r: SheetResult, o: SheetOptions): string {
  return `${o.paper} ${o.orientation} · ${n(r.widthMm)} × ${n(r.heightMm)} mm · 1:${r.scale}`;
}


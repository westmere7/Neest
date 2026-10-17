import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import type { Project } from '@/domain/model/schema';
import { derivePlan } from '@/domain/geometry/derive';
import { PlanDrawing } from '@/features/plan-2d/PlanDrawing';
import { printPalette } from '@/features/plan-2d/palette';
import type { PlanMode } from '@/state/editorStore';
import type { SheetResult } from './sheet';

export function svgBlob(svg: string): Blob {
  return new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n`, svg], { type: 'image/svg+xml' });
}

/** Rasterises SVG markup to a PNG blob of the given pixel size. */
export async function rasterizeSvg(svg: string, width: number, height: number, background: string | null): Promise<Blob> {
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const img = new Image();
  img.decoding = 'async';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('The drawing could not be rasterised.'));
    img.src = url;
  });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width);
  canvas.height = Math.round(height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available in this browser.');
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encoding failed.'))), 'image/png'));
}

export const MAX_PNG_PIXELS = 8192;

/** Pixel size of a sheet rendered at a DPI, clamped to browser canvas limits. */
export function sheetPixelSize(sheet: Pick<SheetResult, 'widthMm' | 'heightMm'>, dpi: number) {
  let w = (sheet.widthMm / 25.4) * dpi;
  let h = (sheet.heightMm / 25.4) * dpi;
  const k = Math.min(1, MAX_PNG_PIXELS / Math.max(w, h));
  w *= k;
  h *= k;
  return { width: Math.round(w), height: Math.round(h), clamped: k < 1 };
}

export interface PlanImageOptions {
  pixelsPerMetre: number;
  mode: PlanMode;
  transparent: boolean;
  annotations: boolean;
  furniture: boolean;
}

/** Plan-only image (no sheet) at a chosen resolution, for PNG export. */
export function buildPlanImageSvg(project: Project, o: PlanImageOptions): { svg: string; width: number; height: number; background: string | null } {
  const derived = derivePlan(project);
  const b = derived.bounds ?? { minX: 0, minY: 0, maxX: 5, maxY: 5 };
  const marginM = 0.9;
  const wM = b.maxX - b.minX + marginM * 2;
  const hM = b.maxY - b.minY + marginM * 2;
  let ppm = o.pixelsPerMetre;
  const maxSide = Math.max(wM, hM) * ppm;
  if (maxSide > MAX_PNG_PIXELS) ppm *= MAX_PNG_PIXELS / maxSide;
  const palette = printPalette(o.mode);
  // Annotation sizes are fixed in world units (as on screen at ~55 px/m) so higher resolutions add detail, not clutter.
  const px = 1 / 55;
  const inner = renderToStaticMarkup(
    createElement(PlanDrawing, {
      project,
      derived,
      opts: {
        mode: o.mode,
        palette,
        px,
        unit: project.settings.units,
        precision: project.settings.precision,
        areaUnit: project.settings.areaUnit,
        showRoomLabels: o.annotations && project.settings.showRoomLabels,
        showAreas: o.annotations && project.settings.showRoomAreas,
        dims: o.annotations ? project.settings.dimensions : { overall: false, walls: false, rooms: false },
        showFurniture: o.furniture,
        showConstruction: true,
        showAnnotations: o.annotations,
        textures: true,
        shadows: true,
        halo: true,
        idPrefix: 'img',
      },
    }),
  );
  const width = Math.round(wM * ppm);
  const height = Math.round(hM * ppm);
  const bg = o.transparent ? null : palette.paper;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="${b.minX - marginM} ${b.minY - marginM} ${wM} ${hM}">${bg ? `<rect x="${b.minX - marginM}" y="${b.minY - marginM}" width="${wM}" height="${hM}" fill="${bg}"/>` : ''}${inner}</svg>`;
  return { svg, width, height, background: bg };
}

/** Vector PDF from a sheet (jsPDF + svg2pdf, loaded on demand). */
export async function sheetToPdf(sheet: SheetResult): Promise<Blob> {
  const [{ jsPDF }, { svg2pdf }] = await Promise.all([import('jspdf'), import('svg2pdf.js')]);
  const landscape = sheet.widthMm > sheet.heightMm;
  const pdf = new jsPDF({ unit: 'mm', format: [sheet.widthMm, sheet.heightMm], orientation: landscape ? 'landscape' : 'portrait', compress: true });
  pdf.setProperties({ title: 'Neest floor plan', creator: 'Neest', subject: 'Planning drawing — not for construction' });
  const doc = new DOMParser().parseFromString(sheet.svg, 'image/svg+xml');
  const svgEl = doc.documentElement as unknown as SVGSVGElement;
  // svg2pdf needs the element in the DOM to resolve styles.
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-99999px;top:0;width:10px;height:10px;overflow:hidden';
  const imported = document.importNode(svgEl, true);
  host.appendChild(imported);
  document.body.appendChild(host);
  try {
    await svg2pdf(imported, pdf, { x: 0, y: 0, width: sheet.widthMm, height: sheet.heightMm });
  } finally {
    host.remove();
  }
  return pdf.output('blob');
}

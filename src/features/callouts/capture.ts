import * as THREE from 'three';
import type { Callout, Project } from '@/domain/model/schema';
import { derivePlan } from '@/domain/geometry/derive';
import { calloutLines } from './content';
import { NOTE_LINE_WIDTH, NOTE_SIZE_SCALE, arrowHead, endPx, labelColors, leaderDash } from './style';
import { visibleCallouts, type CalloutLayout } from './layout';
import { layoutNotes3D } from './NotesOverlay';

/** The live camera framed for a shot of w × h (same viewpoint, requested aspect, no editor offset). */
export function shotCamera(camera: THREE.Camera, w: number, h: number): THREE.PerspectiveCamera | THREE.OrthographicCamera {
  const cam = camera.clone() as THREE.PerspectiveCamera | THREE.OrthographicCamera;
  if ((cam as THREE.PerspectiveCamera).isPerspectiveCamera) (cam as THREE.PerspectiveCamera).aspect = w / h;
  else {
    const o = cam as THREE.OrthographicCamera;
    const height = o.top - o.bottom;
    o.left = (-height * (w / h)) / 2;
    o.right = (height * (w / h)) / 2;
  }
  cam.clearViewOffset();
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld(true);
  return cam;
}

const FONT = "Inter, 'Segoe UI', system-ui, sans-serif";

/**
 * Paints the visible notes onto a rendered 3D image, laid out as in the live view (placement setting,
 * no overlaps where space allows). Labels scale with the image height so they read the same at
 * any resolution. Returns the original blob when there is nothing to draw.
 */
export async function compositeCallouts(blob: Blob, project: Project, camera: THREE.Camera, w: number, h: number): Promise<Blob> {
  const list = visibleCallouts(project);
  if (!list.length) return blob;
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return blob;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  drawCallouts(ctx, project, shotCamera(camera, w, h), canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encoding failed.'))), 'image/png'));
}

/** Draws callouts with a 2D context over an image of the camera's view. */
export function drawCallouts(ctx: CanvasRenderingContext2D, project: Project, camera: THREE.Camera, w: number, h: number) {
  const derived = derivePlan(project);
  const s = Math.max(1, h / 720);
  const font = 12 * s;
  const lineH = font * 1.38;
  const pad = { x: 10 * s, y: 7 * s, stripe: 4 * s };
  const fontFor = (bold: boolean, italic: boolean, size: number) => `${italic ? 'italic ' : ''}${bold ? 650 : 400} ${size}px ${FONT}`;
  // Each label's text and size first; the layout (placement, no overlaps) is the live view's.
  const metrics = new Map<string, ReturnType<typeof measure>>();
  function measure(c: Callout) {
    const colors = labelColors(c);
    const k = NOTE_SIZE_SCALE[c.size];
    const fz = font * k;
    const lh = lineH * k;
    const px = c.box === 'text' ? 4 * s : pad.x;
    const py = c.box === 'text' ? 2 * s : pad.y;
    const stripe = colors.stripe ? pad.stripe : 0;
    const lines = calloutLines(project, derived, c);
    const size = (line: CalloutLayout['lines'][number]) => (line.role === 'info' ? fz * 0.92 : fz);
    let textW = 0;
    for (const line of lines) {
      let lw = line.indent * size(line) * 0.54;
      for (const r of line.runs) {
        ctx.font = fontFor(!!r.bold || line.role === 'title', !!r.italic, size(line));
        lw += ctx.measureText(r.text).width;
      }
      textW = Math.max(textW, lw);
    }
    const bw = Math.max(c.box === 'text' ? 0 : 96 * s, textW + px * 2 + stripe);
    const bh = lines.length * lh + py * 2 - (lh - fz) * 0.4;
    return { colors, fz, lh, px, py, stripe, lines, size, bw, bh };
  }
  const notes = layoutNotes3D(project, derived, camera, w, h, (c) => {
    const m = measure(c);
    metrics.set(c.id, m);
    return { w: m.bw, h: m.bh };
  });
  // Leaders and end marks first, then the labels on top.
  for (const { c, anchor: a, placed } of notes) {
    const { colors } = metrics.get(c.id)!;
    const l = placed.attach;
    if (c.line !== 'none') {
      const dash = leaderDash(c);
      ctx.save();
      ctx.strokeStyle = colors.main;
      ctx.lineWidth = NOTE_LINE_WIDTH[c.lineWeight] * 1.15 * s;
      ctx.lineCap = 'round';
      ctx.setLineDash(dash ? dash.map((d) => d * s) : []);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(l.x, l.y);
      ctx.stroke();
      ctx.restore();
    }
    const r = endPx(c) * s;
    if (c.end === 'dot' || c.end === 'ring') {
      ctx.fillStyle = c.end === 'dot' ? colors.main : '#fff';
      ctx.beginPath();
      ctx.arc(a.x, a.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = c.end === 'dot' ? '#fff' : colors.main;
      ctx.lineWidth = (c.end === 'dot' ? 1.4 : Math.max(1.6, r / s / 2.6)) * s;
      ctx.stroke();
    } else if (c.end === 'arrow') {
      const tri = arrowHead(a, Math.hypot(l.x - a.x, l.y - a.y) > 1 ? l : { x: a.x, y: a.y - 10 }, r);
      ctx.fillStyle = colors.main;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 0.8 * s;
      ctx.beginPath();
      tri.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
  for (const { c, placed } of notes) {
    const { colors, fz, lh, px, py, stripe, lines, size, bw, bh } = metrics.get(c.id)!;
    const bx = placed.rect.x;
    const by = placed.rect.y;
    // Box with shadow and accent stripe (none for text-only labels).
    if (colors.fill) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.18)';
      ctx.shadowBlur = 10 * s;
      ctx.shadowOffsetY = 2 * s;
      ctx.fillStyle = colors.fill;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 6 * s);
      ctx.fill();
      ctx.restore();
    }
    if (colors.stroke) {
      ctx.strokeStyle = colors.stroke;
      ctx.lineWidth = 1 * s;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 6 * s);
      ctx.stroke();
    }
    if (stripe) {
      ctx.fillStyle = colors.main;
      ctx.beginPath();
      ctx.roundRect(bx, by, stripe, bh, [6 * s, 0, 0, 6 * s]);
      ctx.fill();
    }
    // Text.
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    lines.forEach((line, i) => {
      const sz = size(line);
      let x = bx + px + stripe * 0.5 + line.indent * sz * 0.54;
      const y = by + py + fz * 0.82 + i * lh;
      for (const run of line.runs) {
        ctx.font = fontFor(!!run.bold || line.role === 'title', !!run.italic, sz);
        const tw = ctx.measureText(run.text).width;
        if (colors.halo) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 3 * s;
          ctx.strokeText(run.text, x, y);
        }
        ctx.fillStyle = run.href ? colors.link : line.role === 'info' ? colors.info : colors.text;
        ctx.fillText(run.text, x, y);
        if (run.href) ctx.fillRect(x, y + 1.5 * s, tw, Math.max(1, 0.9 * s));
        x += tw;
      }
    });
  }
}

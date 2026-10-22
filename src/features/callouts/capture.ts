import * as THREE from 'three';
import type { Project } from '@/domain/model/schema';
import { derivePlan } from '@/domain/geometry/derive';
import { CALLOUT_PALETTE, calloutLines } from './content';
import { visibleCallouts, type CalloutLayout } from './layout';
import { callout3DPoints } from './Callouts3D';

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
 * Paints the visible callouts onto a rendered 3D image: leader, anchor dot and the label above the
 * leader's top, as in the live view. Labels scale with the image height so they read the same at
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
  const toScreen = (v: THREE.Vector3) => {
    const p = v.clone().project(camera);
    return { x: ((p.x + 1) / 2) * w, y: ((1 - p.y) / 2) * h, behind: p.z > 1 || p.z < -1 };
  };
  const fontFor = (bold: boolean, italic: boolean, size: number) => `${italic ? 'italic ' : ''}${bold ? 650 : 400} ${size}px ${FONT}`;
  // Far labels first so near ones sit on top.
  const items = visibleCallouts(project)
    .map((c) => ({ c, pts: callout3DPoints(project, derived, c) }))
    .flatMap(({ c, pts }) => (pts ? [{ c, pts, depth: pts.label.distanceTo(camera.position) }] : []))
    .sort((a, b) => b.depth - a.depth);
  for (const { c, pts } of items) {
    const a = toScreen(pts.anchor);
    const l = toScreen(pts.label);
    if (a.behind || l.behind) continue;
    const colors = CALLOUT_PALETTE[c.color];
    const lines = calloutLines(project, derived, c);
    const size = (line: CalloutLayout['lines'][number]) => (line.role === 'info' ? font * 0.92 : font);
    // Measure.
    let textW = 0;
    for (const line of lines) {
      let lw = line.indent * size(line) * 0.54;
      for (const r of line.runs) {
        ctx.font = fontFor(!!r.bold || line.role === 'title', !!r.italic, size(line));
        lw += ctx.measureText(r.text).width;
      }
      textW = Math.max(textW, lw);
    }
    const bw = Math.max(96 * s, textW + pad.x * 2 + pad.stripe);
    const bh = lines.length * lineH + pad.y * 2 - (lineH - font) * 0.4;
    const bx = l.x - bw / 2;
    const by = l.y - bh;
    // Leader and anchor.
    ctx.strokeStyle = colors.main;
    ctx.lineWidth = 1.5 * s;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(l.x, l.y);
    ctx.stroke();
    ctx.fillStyle = colors.main;
    ctx.beginPath();
    ctx.arc(a.x, a.y, 4 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.4 * s;
    ctx.stroke();
    // Box with shadow and accent stripe.
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.18)';
    ctx.shadowBlur = 10 * s;
    ctx.shadowOffsetY = 2 * s;
    ctx.fillStyle = colors.fill;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 6 * s);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = colors.main;
    ctx.lineWidth = 1 * s;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 6 * s);
    ctx.stroke();
    ctx.fillStyle = colors.main;
    ctx.beginPath();
    ctx.roundRect(bx, by, pad.stripe, bh, [6 * s, 0, 0, 6 * s]);
    ctx.fill();
    // Text.
    ctx.textBaseline = 'alphabetic';
    lines.forEach((line, i) => {
      const sz = size(line);
      let x = bx + pad.x + pad.stripe * 0.5 + line.indent * sz * 0.54;
      const y = by + pad.y + font * 0.82 + i * lineH;
      for (const r of line.runs) {
        ctx.font = fontFor(!!r.bold || line.role === 'title', !!r.italic, sz);
        ctx.fillStyle = r.href ? colors.main : line.role === 'info' ? '#55626b' : colors.text;
        ctx.fillText(r.text, x, y);
        const tw = ctx.measureText(r.text).width;
        if (r.href) ctx.fillRect(x, y + 1.5 * s, tw, Math.max(1, 0.9 * s));
        x += tw;
      }
    });
  }
}

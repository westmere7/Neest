import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Opening, OpeningKind } from '@/domain/model/schema';
import { isPassageKind, isWindowKind } from '@/domain/model/schema';
import {
  ASYM_VENT_SHARE,
  doorLeafLayout,
  LEAF_GROOVE,
  LEAF_RECESS,
  leafCells,
  REED_PITCH,
  resolveOpeningDesign,
  sashGlazing,
  topLightHeight,
  windowSpec,
} from '@/domain/model/openingDesigns';
import type { OpeningSpan, WallGeometry } from '@/domain/geometry/walls';
import { pointAt } from '@/domain/geometry/wallPath';
import { angleOf } from '@/domain/geometry/vec';
import type { Part } from '@/data/assets/types';
import { partGeometry, type BuildContext } from './builders';

// ───────────────────────── Small mesh helpers ─────────────────────────

type Mat = THREE.Material;
type XY = [number, number];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const r4 = (n: number) => Math.round(n * 10000) / 10000;

function meshFor(part: Part, material: Mat, shadows: boolean): THREE.Mesh {
  const mesh = new THREE.Mesh(partGeometry(part), material);
  mesh.position.set(...part.position);
  if (part.rotation) mesh.rotation.set(...part.rotation);
  if (part.scale) mesh.scale.set(...part.scale);
  mesh.castShadow = shadows;
  mesh.receiveShadow = shadows;
  return mesh;
}

function box(w: number, h: number, d: number, x: number, y: number, z: number, mat: Mat, shadows: boolean): THREE.Mesh {
  return meshFor({ shape: 'box', size: [w, h, d], position: [x, y, z], slot: '' }, mat, shadows);
}

/** Box rotated by Euler angles (radians). */
function boxR(
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  rot: [number, number, number],
  mat: Mat,
  shadows: boolean,
): THREE.Mesh {
  return meshFor({ shape: 'box', size: [w, h, d], position: [x, y, z], rotation: rot, slot: '' }, mat, shadows);
}

/** Cylinder of radius `r` and length `len` along a local axis. */
function cyl(r: number, len: number, x: number, y: number, z: number, axis: 'x' | 'y' | 'z', mat: Mat, shadows: boolean): THREE.Mesh {
  const rotation: [number, number, number] = axis === 'x' ? [0, 0, Math.PI / 2] : axis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0];
  return meshFor(
    { shape: 'cylinder', radiusTop: r, radiusBottom: r, height: len, segments: 16, position: [x, y, z], rotation, slot: '' },
    mat,
    shadows,
  );
}

/** Flat plate: an outline in the opening plane (x along the wall, y up), `depth` thick, centred on `z`. */
function plate(outline: XY[], depth: number, z: number, mat: Mat, shadows: boolean): THREE.Mesh {
  // A prism's outline lies in X/Z and extrudes along +Y; a +90° turn about X maps (x, z) → (x, -z) and Y → Z.
  return meshFor(
    {
      shape: 'prism',
      outline: outline.map(([x, y]) => [x, -y] as XY),
      height: depth,
      position: [0, 0, z - depth / 2],
      rotation: [Math.PI / 2, 0, 0],
      slot: '',
    },
    mat,
    shadows,
  );
}

/**
 * A band following an elliptical arc (centre cx/cy, semi-axes a/b along its centreline) from angle
 * th0 to th1, made of `n` slightly overlapping chord boxes `band` wide (radially) and `depth` deep.
 */
function arcBand(
  out: THREE.Object3D,
  cx: number,
  cy: number,
  a: number,
  b: number,
  th0: number,
  th1: number,
  n: number,
  band: number,
  depth: number,
  z: number,
  mat: Mat,
  shadows: boolean,
) {
  const dth = (th1 - th0) / n;
  for (let i = 0; i < n; i++) {
    const t0 = th0 + dth * i;
    const t1 = t0 + dth;
    const x0 = cx + a * Math.cos(t0);
    const y0 = cy + b * Math.sin(t0);
    const x1 = cx + a * Math.cos(t1);
    const y1 = cy + b * Math.sin(t1);
    const len = Math.hypot(x1 - x0, y1 - y0) + band * Math.abs(dth);
    out.add(boxR(len, band, depth, (x0 + x1) / 2, (y0 + y1) / 2, z, [0, 0, Math.atan2(y1 - y0, x1 - x0)], mat, shadows));
  }
}

// ───────────────────────── Design geometry (cached, never dispose) ─────────────────────────

const designGeoCache = new Map<string, THREE.BufferGeometry>();

function cachedGeo(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  const hit = designGeoCache.get(key);
  if (hit) return hit;
  const geo = make();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  geo.userData.cached = true;
  if (designGeoCache.size > 600) designGeoCache.clear();
  designGeoCache.set(key, geo);
  return geo;
}

/**
 * Fluted (reeded) surface `w` × `h` centred on the origin: vertical half-round reeds about `pitch`
 * apart, rising from z = 0 to z = `depth` and facing +z. Used for reeded timber and ribbed glass.
 */
export function flutedGeometry(w: number, h: number, pitch: number, depth: number): THREE.BufferGeometry {
  return cachedGeo(`flute|${r4(w)}|${r4(h)}|${r4(pitch)}|${r4(depth)}`, () => {
    const n = Math.max(1, Math.round(w / pitch));
    const p = w / n;
    const k = 6;
    const pos: number[] = [];
    const nrm: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    for (let r = 0; r < n; r++) {
      const base = pos.length / 3;
      for (let i = 0; i <= k; i++) {
        const th = (Math.PI * i) / k;
        const x = -w / 2 + p * (r + (1 - Math.cos(th)) / 2);
        const z = depth * Math.sin(th);
        const nx = -depth * Math.cos(th);
        const nz = (p / 2) * Math.sin(th) + 1e-4;
        const l = Math.hypot(nx, nz);
        for (const y of [-h / 2, h / 2]) {
          pos.push(x, y, z);
          nrm.push(nx / l, 0, nz / l);
          uv.push(x + w / 2, y + h / 2);
        }
      }
      for (let i = 0; i < k; i++) {
        const a = base + i * 2;
        idx.push(a, a + 2, a + 3, a, a + 3, a + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    return geo;
  });
}

/** Angled louvre slats filling a bay `w` × `h` (centred on the origin), no deeper than `lt`. */
function louvreGeometry(w: number, h: number, lt: number): THREE.BufferGeometry {
  return cachedGeo(`louvre|${r4(w)}|${r4(h)}|${r4(lt)}`, () => {
    const a = 0.6;
    const th = 0.008;
    const sh = clamp((lt - 0.003 - th * Math.cos(a)) / Math.sin(a), 0.02, 0.055);
    const n = Math.max(1, Math.round(h / (sh * Math.cos(a) * 0.9)));
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < n; i++) {
      const g = partGeometry({ shape: 'box', size: [w, sh, th], position: [0, 0, 0], slot: '' }).clone();
      g.rotateX(a);
      g.translate(0, -h / 2 + ((i + 0.5) * h) / n, 0);
      parts.push(g);
    }
    const merged = parts.length === 1 ? parts[0] : mergeGeometries(parts, false);
    if (merged !== parts[0]) for (const g of parts) g.dispose();
    return merged;
  });
}

// ───────────────────────── Opening outline ─────────────────────────

/** Outline of the hole inside the rectangular wall gap (local x along the wall, y = absolute height). */
export type OpeningShape =
  | { kind: 'rect' }
  /** Arched head: an elliptical (semicircular when tall enough) arch springing at `ys`, centred on x = 0. */
  | { kind: 'arch'; ys: number; a: number; b: number }
  /** Round hole of radius `r` centred on (0, cy). */
  | { kind: 'circle'; cy: number; r: number };

export function openingShape(kind: OpeningKind, w: number, sill: number, head: number): OpeningShape {
  const H = head - sill;
  if (kind === 'passage-arched' || kind === 'window-arched') {
    const b = Math.min(w / 2, H * 0.6);
    return { kind: 'arch', ys: head - b, a: w / 2, b };
  }
  if (kind === 'passage-moon' || kind === 'window-round') return { kind: 'circle', cy: sill + H / 2, r: Math.min(w, H) / 2 };
  return { kind: 'rect' };
}

/** Vertical extent of the hole at local x, or null outside it. */
function shapeExtent(shape: OpeningShape, x: number, sill: number, head: number): [number, number] | null {
  if (shape.kind === 'rect') return [sill, head];
  if (shape.kind === 'arch') {
    const u = clamp(x / shape.a, -1, 1);
    return [sill, shape.ys + shape.b * Math.sqrt(1 - u * u)];
  }
  if (Math.abs(x) >= shape.r) return null;
  const dy = Math.sqrt(shape.r * shape.r - x * x);
  return [shape.cy - dy, shape.cy + dy];
}

function dedupe(pts: XY[]): XY[] {
  const out: XY[] = [];
  for (const p of pts) {
    const q = out[out.length - 1];
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-6) out.push(p);
  }
  while (out.length > 2 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) <= 1e-6) out.pop();
  return out;
}

const polyArea = (pts: XY[]) =>
  pts.reduce((s, p, i) => s + p[0] * pts[(i + 1) % pts.length][1] - pts[(i + 1) % pts.length][0] * p[1], 0) / 2;

/**
 * Wall infill pieces (spandrels) between the rectangular wall gap and an arched or round hole.
 * Each piece is a simple polygon in (local x, absolute y); arcs use `seg` steps per quarter.
 */
export function infillOutlines(shape: OpeningShape, w: number, head: number, seg = 12): XY[][] {
  const x0 = -w / 2;
  const quarter = (cx: number, cy: number, a: number, b: number, from: number): XY[] => {
    const pts: XY[] = [];
    for (let i = 0; i <= seg; i++) {
      const th = from + (Math.PI / 2) * (i / seg);
      pts.push([cx + a * Math.cos(th), cy + b * Math.sin(th)]);
    }
    return pts;
  };
  const mirrorX = (pts: XY[]) => pts.map(([x, y]) => [-x, y] as XY).reverse();
  let pieces: XY[][] = [];
  if (shape.kind === 'arch') {
    const left = [[x0, head] as XY, ...quarter(0, shape.ys, shape.a, shape.b, Math.PI / 2)];
    pieces = [left, mirrorX(left)];
  } else if (shape.kind === 'circle') {
    const { cy, r } = shape;
    const topLeft: XY[] = [[x0, head], [0, head], ...quarter(0, cy, r, r, Math.PI / 2), [x0, cy]];
    const botLeft = topLeft.map(([x, y]) => [x, 2 * cy - y] as XY).reverse();
    pieces = [topLeft, mirrorX(topLeft), botLeft, mirrorX(botLeft)];
  }
  return pieces.map(dedupe).filter((pc) => pc.length >= 3 && Math.abs(polyArea(pc)) > 1e-6);
}

const infillCache = new Map<string, THREE.BufferGeometry>();

/**
 * Prism through the wall thickness for one infill outline, with the wall's three material groups:
 * 0 = left face (local -z), 1 = right face (+z), 2 = reveal sides. Face UVs follow the wall's
 * (arc length, height) mapping so textures line up with the surrounding wall. Cached (never dispose).
 */
function infillGeometry(outline: XY[], depth: number, uOffset: number): THREE.BufferGeometry {
  const key = `${r4(depth)}|${r4(uOffset)}|${outline.map(([x, y]) => `${r4(x)},${r4(y)}`).join(';')}`;
  const hit = infillCache.get(key);
  if (hit) return hit;
  const groups = [0, 1, 2].map(() => ({ pos: [] as number[], nrm: [] as number[], uv: [] as number[] }));
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const tri = (gi: number, v: THREE.Vector3[], uv: XY[], n: THREE.Vector3) => {
    e1.subVectors(v[1], v[0]);
    e2.subVectors(v[2], v[0]);
    const order = e1.cross(e2).dot(n) >= 0 ? [0, 1, 2] : [0, 2, 1];
    const g = groups[gi];
    for (const k of order) {
      g.pos.push(v[k].x, v[k].y, v[k].z);
      g.nrm.push(n.x, n.y, n.z);
      g.uv.push(uv[k][0], uv[k][1]);
    }
  };
  const zl = -depth / 2;
  const zr = depth / 2;
  const contour = outline.map(([x, y]) => new THREE.Vector2(x, y));
  const nl = new THREE.Vector3(0, 0, -1);
  const nr = new THREE.Vector3(0, 0, 1);
  for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(contour, [])) {
    const pts = [outline[a], outline[b], outline[c]];
    const uv = pts.map(([x, y]) => [uOffset + x, y] as XY);
    tri(0, pts.map(([x, y]) => new THREE.Vector3(x, y, zl)), uv, nl);
    tri(1, pts.map(([x, y]) => new THREE.Vector3(x, y, zr)), uv, nr);
  }
  const ccw = polyArea(outline) > 0;
  let u = 0;
  for (let i = 0; i < outline.length; i++) {
    const [ax, ay] = outline[i];
    const [bx, by] = outline[(i + 1) % outline.length];
    const len = Math.hypot(bx - ax, by - ay);
    if (len < 1e-7) continue;
    const dx = (bx - ax) / len;
    const dy = (by - ay) / len;
    const n = ccw ? new THREE.Vector3(dy, -dx, 0) : new THREE.Vector3(-dy, dx, 0);
    const v = [new THREE.Vector3(ax, ay, zl), new THREE.Vector3(bx, by, zl), new THREE.Vector3(bx, by, zr), new THREE.Vector3(ax, ay, zr)];
    const uv: XY[] = [
      [u, zl],
      [u + len, zl],
      [u + len, zr],
      [u, zr],
    ];
    tri(2, [v[0], v[1], v[2]], [uv[0], uv[1], uv[2]], n);
    tri(2, [v[0], v[2], v[3]], [uv[0], uv[2], uv[3]], n);
    u += len;
  }
  const geo = new THREE.BufferGeometry();
  const pos: number[] = [];
  const nrm: number[] = [];
  const uvs: number[] = [];
  let start = 0;
  groups.forEach((grp, gi) => {
    pos.push(...grp.pos);
    nrm.push(...grp.nrm);
    uvs.push(...grp.uv);
    const count = grp.pos.length / 3;
    geo.addGroup(start, count, gi);
    start += count;
  });
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  geo.userData.cached = true;
  if (infillCache.size > 800) infillCache.clear();
  infillCache.set(key, geo);
  return geo;
}

// ───────────────────────── Openings ─────────────────────────

/**
 * Door/window assembly placed in the wall gap: frame/casing, leaves or
 * sashes, glazing, and handles. Local frame: x along the wall, y up, z toward
 * the wall's right side. Arched and round kinds fill the corners of the
 * rectangular wall gap with infill in the wall's own materials.
 */
export function buildOpening(opening: Opening, g: WallGeometry, span: OpeningSpan, ctx: BuildContext): THREE.Group {
  const group = new THREE.Group();
  group.userData = { kind: 'opening', id: opening.id };
  const { p, tangent } = pointAt(g.path, span.center);
  group.position.set(p.x, 0, p.y);
  group.rotation.y = -angleOf(tangent);
  const shadows = ctx.shadows ?? true;
  const kind = opening.kind;
  const win = isWindowKind(kind);
  const passage = isPassageKind(kind);
  const frameMat = ctx.registry.get(ctx.project, opening.frameMaterialId);
  const panelMat = ctx.registry.get(ctx.project, opening.panelMaterialId);
  const glassMat = ctx.registry.get(ctx.project, win ? opening.panelMaterialId : 'glass-clear');
  const metalMat = ctx.registry.get(ctx.project, 'metal-brushed-steel');
  const frostedMat = ctx.registry.get(ctx.project, 'glass-frosted');
  const reededMat = ctx.registry.get(ctx.project, 'glass-reeded');
  const design = resolveOpeningDesign(opening);
  const spec = windowSpec(win ? design : null);
  const w = span.s1 - span.s0;
  const t = g.h * 2;
  const face = t / 2;
  const sill = span.sill;
  const head = span.head;
  const H = head - sill;
  const f = win ? spec.frame : 0.05;
  const casingDepth = t + (win ? 0.0 : 0.02);
  const shape = openingShape(kind, w, sill, head);
  const swing = opening.swingSide === 'left' ? -1 : 1; // local z sign of the swing side
  const open = (opening.openAngle * Math.PI) / 180;
  const frac = clamp(opening.openAngle / 90, 0, 1);
  const hingeAtStart = opening.hinge === 'start';
  const innerW = w - 2 * f;
  const innerH = H - f - (win ? f : 0);
  const bottom = sill + (win ? f : 0);
  const casing = !!opening.casing;
  const cw = 0.07; // casing (architrave) width
  const cd = 0.018; // casing depth off the wall face
  const add = (...o: THREE.Object3D[]) => group.add(...o);

  // Doors: glazed fanlight (transom) in the top of the opening; the leaves get shorter.
  const transomH = opening.transom && !win && !passage && shape.kind === 'rect' ? Math.min(0.4, innerH * 0.3) : 0;
  const leafH = innerH - transomH;

  // ── Wall infill (spandrels) for arched / round holes ──
  // Corner infill only makes sense in a solid wall (glass walls and railings have no body to fill).
  const solidHost = !g.wall.style || g.wall.style === 'solid' || g.wall.style === 'half';
  if (shape.kind !== 'rect' && solidHost) {
    const wallMats = [
      ctx.registry.get(ctx.project, g.wall.materials.left),
      ctx.registry.get(ctx.project, g.wall.materials.right),
      ctx.registry.get(ctx.project, g.wall.materials.top),
    ];
    for (const outline of infillOutlines(shape, w, head)) {
      const mesh = new THREE.Mesh(infillGeometry(outline, t, span.center), wallMats);
      mesh.name = 'opening-infill';
      mesh.castShadow = shadows;
      mesh.receiveShadow = shadows;
      add(mesh);
    }
  }

  // ── Frame ──
  if (shape.kind === 'rect') {
    for (const sx of [-1, 1]) {
      const x = sx * (w / 2 - f / 2);
      const pocketSide = kind === 'door-pocket' && (hingeAtStart ? sx < 0 : sx > 0);
      if (pocketSide) {
        // Split jamb: two halves with a slot between them for the leaf to slide into the wall.
        const slot = Math.min(0.035, t * 0.45) + 0.012;
        const dd = Math.max(0.005, (casingDepth - slot) / 2);
        for (const sz of [-1, 1]) add(box(f, H, dd, x, sill + H / 2, sz * (slot / 2 + dd / 2), frameMat, shadows));
      } else add(box(f, H, casingDepth, x, sill + H / 2, 0, frameMat, shadows));
    }
    add(box(w, f, casingDepth, 0, head - f / 2, 0, frameMat, shadows));
  } else if (shape.kind === 'arch') {
    const jh = shape.ys - sill;
    if (jh > 0.005) for (const sx of [-1, 1]) add(box(f, jh, casingDepth, sx * (w / 2 - f / 2), sill + jh / 2, 0, frameMat, shadows));
    arcBand(group, 0, shape.ys, shape.a - f / 2, shape.b - f / 2, 0, Math.PI, 24, f, casingDepth, 0, frameMat, shadows);
  } else {
    arcBand(group, 0, shape.cy, shape.r - f / 2, shape.r - f / 2, 0, Math.PI * 2, 48, f, casingDepth, 0, frameMat, shadows);
  }

  if (transomH > 0) {
    add(box(innerW, f, casingDepth, 0, bottom + leafH + f / 2, 0, frameMat, shadows));
    const gh = transomH - f;
    if (gh > 0.01) add(box(innerW, gh, 0.008, 0, bottom + leafH + f + gh / 2, 0, glassMat, false));
  }

  const doorGlass = (kind: 'clear' | 'frosted' | 'reeded') => (kind === 'frosted' ? frostedMat : kind === 'reeded' ? reededMat : glassMat);

  /**
   * One door leaf in its design (domain/model/openingDesigns.ts): solid, recessed and grooved
   * strips at their depths, glass in the lites, glazing bars, reeds, louvres and ledges. Local
   * frame: x from the hinge edge (0) to the closing edge (width), y up from the leaf bottom, z = 0
   * at mid-thickness. `outer` is the face that carries ledges (and the barn brace).
   */
  const leaf = (width: number, withHandle = false, lh = leafH, lt = 0.04, opts: { outer?: 1 | -1; brace?: boolean } = {}): THREE.Group => {
    const lg = new THREE.Group();
    const outer = opts.outer ?? 1;
    const layout = doorLeafLayout(design ?? 'flush', width, lh, { brace: opts.brace });
    const gm = doorGlass(layout.glass);
    for (const c of leafCells(layout, width, lh)) {
      const cw = c.x1 - c.x0;
      const ch = c.y1 - c.y0;
      const cx = (c.x0 + c.x1) / 2;
      const cy = (c.y0 + c.y1) / 2;
      if (c.type === 'solid') lg.add(box(cw, ch, lt, cx, cy, 0, panelMat, shadows));
      else if (c.type === 'recess') lg.add(box(cw, ch, Math.max(0.006, lt - 2 * LEAF_RECESS), cx, cy, 0, panelMat, shadows));
      else if (c.type === 'groove') lg.add(box(cw, ch, Math.max(0.006, lt - 2 * LEAF_GROOVE), cx, cy, 0, panelMat, shadows));
      else if (c.type === 'lite') {
        // Slightly oversized so the glass edge hides inside the surrounding stiles and rails.
        if (layout.glass === 'reeded') {
          const m = new THREE.Mesh(flutedGeometry(cw + 0.01, ch + 0.01, REED_PITCH * 0.8, 0.004), gm);
          m.position.set(cx, cy, -0.002);
          lg.add(m);
        } else lg.add(box(cw + 0.01, ch + 0.01, 0.008, cx, cy, 0, gm, false));
      }
    }
    for (const b of layout.bars) lg.add(box(b.x1 - b.x0, b.y1 - b.y0, lt * 0.7, (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, 0, panelMat, false));
    for (const r of layout.flutes) {
      for (const side of [1, -1]) {
        const m = new THREE.Mesh(flutedGeometry(r.x1 - r.x0, r.y1 - r.y0, REED_PITCH, LEAF_RECESS), panelMat);
        m.position.set((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2, side * (lt / 2 - LEAF_RECESS));
        if (side < 0) m.rotation.y = Math.PI;
        m.castShadow = shadows;
        m.receiveShadow = shadows;
        lg.add(m);
      }
    }
    for (const r of layout.louvres) {
      const m = new THREE.Mesh(louvreGeometry(r.x1 - r.x0, r.y1 - r.y0, lt), panelMat);
      m.position.set((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2, 0);
      m.castShadow = shadows;
      m.receiveShadow = shadows;
      lg.add(m);
    }
    const bd = 0.018;
    const bz = outer * (lt / 2 + bd / 2);
    for (const r of layout.battens) lg.add(box(r.x1 - r.x0, r.y1 - r.y0, bd, (r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2, bz, panelMat, shadows));
    if (layout.brace && layout.battens.length >= 2) {
      // Diagonal brace between the ledges, slightly shallower so it reads as tucked under them.
      const [lo, hi] = layout.battens;
      const x0 = 0.12;
      const x1 = width - 0.12;
      const dy = hi.y0 - lo.y1;
      if (x1 > x0 && dy > 0.2) {
        const ang = Math.atan2(dy, x1 - x0);
        lg.add(boxR(Math.hypot(x1 - x0, dy), 0.11, bd * 0.9, width / 2, (lo.y1 + hi.y0) / 2, outer * (lt / 2 + (bd * 0.9) / 2), [0, 0, ang], panelMat, shadows));
      }
    }
    if (withHandle) {
      const hy = clamp(1.0 - bottom, 0.1, lh - 0.1);
      for (const side of [-1, 1]) {
        lg.add(box(0.025, 0.06, 0.012, width - 0.07, hy, side * (lt / 2 + 0.006), metalMat, false));
        lg.add(box(0.13, 0.018, 0.018, width - 0.12, hy, side * (lt / 2 + 0.03), metalMat, false));
      }
    }
    return lg;
  };

  /** Swing leaves hinged at the jambs (single, double, French). */
  const swingLeaves = (leaves: { hingeAtStart: boolean; width: number }[], make: (width: number) => THREE.Group) => {
    for (const l of leaves) {
      const pivot = new THREE.Group();
      const hx = l.hingeAtStart ? -innerW / 2 : innerW / 2;
      pivot.position.set(hx, bottom, swing * (t / 2 - 0.03));
      const lf = make(l.width);
      if (!l.hingeAtStart) lf.scale.x = -1;
      pivot.add(lf);
      // Rotate toward the swing side.
      pivot.rotation.y = (l.hingeAtStart ? -swing : swing) * open;
      add(pivot);
    }
  };
  const pair = [
    { hingeAtStart: true, width: innerW / 2 },
    { hingeAtStart: false, width: innerW / 2 },
  ];

  if (!win) {
    if (kind === 'door-single') swingLeaves([{ hingeAtStart, width: innerW }], (width) => leaf(width, true));
    else if (kind === 'door-double') swingLeaves(pair, (width) => leaf(width, true));
    else if (kind === 'door-french') swingLeaves(pair, (width) => leaf(width, true, leafH, 0.045));
    else if (kind === 'door-sliding') {
      // The sliding panel (with the handle) runs on the swing side and closes from the hinge end;
      // the fixed panel sits on the other face at the other end.
      const pw = innerW * 0.55;
      const slide = (opening.openAngle / 90) * innerW * 0.45;
      const z = swing * t * 0.18;
      const p1 = leaf(pw, true);
      const p2 = leaf(pw);
      if (hingeAtStart) {
        p1.position.set(-innerW / 2 + slide, bottom, z);
        p2.position.set(innerW / 2 - pw, bottom, -z);
      } else {
        p1.scale.x = -1;
        p1.position.set(innerW / 2 - slide, bottom, z);
        p2.position.set(-innerW / 2, bottom, -z);
      }
      add(p1, p2);
    } else if (kind === 'door-pocket') {
      // The leaf slides into the wall cavity on the hinge side (0–90° = 0–100 % open).
      const lt = Math.min(0.035, t * 0.45);
      const dir = hingeAtStart ? -1 : 1;
      const avail = hingeAtStart ? span.s0 - g.clearStart : g.clearEnd - span.s1;
      const slide = frac * clamp(avail + f, 0, innerW);
      const lf = leaf(innerW, false, leafH, lt);
      lf.position.set(-innerW / 2 + dir * slide, bottom, 0);
      // Leading edge (away from the pocket): an edge pull plus flush cup pulls on both faces.
      const lead = dir < 0 ? innerW : 0;
      const inward = dir < 0 ? -1 : 1;
      const hy = clamp(1.0 - bottom, 0.1, leafH - 0.1);
      lf.add(box(0.006, 0.16, lt * 0.6, lead - inward * 0.003, hy, 0, metalMat, false));
      for (const side of [-1, 1]) lf.add(box(0.03, 0.13, 0.003, lead + inward * 0.06, hy, side * (lt / 2 + 0.0015), metalMat, false));
      add(lf);
    } else if (kind === 'door-bifold') {
      // 2 or 4 hinged panels folding toward the hinge jamb, zig-zagging out on the swing side.
      const n = w >= 1.2 - 1e-6 ? 4 : 2;
      const lt = 0.03;
      const gap = 0.004;
      const pw = innerW / n;
      const ph = leafH - 0.015;
      const theta = Math.min(open, Math.PI / 2);
      const bf = new THREE.Group();
      const zh = swing * (t / 2 - 0.03);
      let px = -innerW / 2;
      let pz = zh;
      for (let k = 0; k < n; k++) {
        const phi = (k % 2 === 0 ? -swing : swing) * theta;
        const pv = new THREE.Group();
        pv.position.set(px, bottom, pz);
        pv.rotation.y = phi;
        const panel = leaf(pw - gap, false, ph, lt);
        panel.position.x = gap / 2;
        pv.add(panel);
        if (k === n - 1) {
          const ky = clamp(1.0 - bottom, 0.1, ph - 0.1);
          for (const side of [-1, 1]) pv.add(cyl(0.016, 0.03, pw - 0.06, ky, side * (lt / 2 + 0.015), 'z', metalMat, false));
        }
        bf.add(pv);
        if (k > 0) for (const y of [0.15, ph / 2, ph - 0.15]) bf.add(cyl(0.008, 0.07, px, bottom + y, pz, 'y', metalMat, false));
        px += pw * Math.cos(phi);
        pz -= pw * Math.sin(phi);
      }
      // Head track.
      bf.add(box(innerW, 0.012, 0.035, 0, bottom + leafH - 0.006, zh, metalMat, false));
      if (!hingeAtStart) bf.scale.x = -1;
      add(bf);
    } else if (kind === 'door-barn') {
      // Slab leaf hung from a face-mounted rail on the swing side, sliding along the wall toward the hinge end.
      const sgn = hingeAtStart ? -1 : 1;
      const lt = 0.04;
      const stand = casing ? cd : 0; // clear the casing
      const leafW = w + 0.1;
      const railY = Math.max(head + 0.04, Math.min(head + 0.14, g.z1 - 0.03));
      const bot = sill + 0.012;
      const lh = railY - 0.05 - bot;
      const shift = sgn * frac * leafW;
      const leafZ = swing * (face + stand + 0.012 + lt / 2);
      const railZ = swing * (face + stand + 0.03);
      const lf = leaf(leafW, false, lh, lt, { outer: swing, brace: true });
      lf.position.set(-leafW / 2 + shift, bot, leafZ);
      // Hangers: straps on the outer face up to rollers riding on the rail.
      const wheelR = 0.045;
      const wheelY = railY + 0.02 + wheelR - bot;
      const strapZ = swing * (lt / 2 + 0.003);
      const wheelZ = railZ - leafZ;
      for (const x of [0.15, leafW - 0.15]) {
        const y0 = lh - 0.2;
        lf.add(box(0.04, wheelY - y0, 0.006, x, (y0 + wheelY) / 2, strapZ, metalMat, false));
        lf.add(cyl(wheelR, 0.02, x, wheelY, wheelZ, 'z', metalMat, false));
        lf.add(cyl(0.01, Math.abs(strapZ - wheelZ) + 0.02, x, wheelY, (strapZ + wheelZ) / 2, 'z', metalMat, false));
      }
      // Bar pull on the outer face, flush pull on the inner face, at the closing edge.
      const hx = sgn < 0 ? leafW - 0.12 : 0.12;
      const hy = clamp(1.0 - bot, 0.3, lh - 0.3);
      lf.add(box(0.022, 0.4, 0.022, hx, hy, swing * (lt / 2 + 0.045), metalMat, false));
      for (const dy of [-0.17, 0.17]) lf.add(cyl(0.008, 0.045, hx, hy + dy, swing * (lt / 2 + 0.0225), 'z', metalMat, false));
      lf.add(box(0.03, 0.12, 0.003, hx, hy, -swing * (lt / 2 + 0.0015), metalMat, false));
      add(lf);
      // Rail (wider than the opening so the leaf can clear it), stand-offs and end stops.
      const railLen = 2 * leafW + 0.1;
      const railCx = (sgn * leafW) / 2;
      add(box(railLen, 0.04, 0.01, railCx, railY, railZ, metalMat, shadows));
      const nb = Math.max(2, Math.ceil(railLen / 0.5) + 1);
      for (let i = 0; i < nb; i++) {
        const x = railCx - railLen / 2 + 0.05 + ((railLen - 0.1) * i) / (nb - 1);
        add(cyl(0.012, 0.025 + stand, x, railY, swing * (face + (0.025 + stand) / 2), 'z', metalMat, false));
      }
      for (const sx of [-1, 1]) add(box(0.025, 0.05, 0.03, railCx + sx * (railLen / 2 - 0.0125), railY + 0.035, railZ, metalMat, false));
      // Floor guide on the slide side.
      add(box(0.05, 0.04, lt + 0.03, sgn * (w / 2 + 0.08), sill + 0.02, leafZ, metalMat, false));
    } else if (kind === 'door-pivot') {
      // Wide slab turning about a vertical axis ~15 % in from the hinge jamb.
      const lt = 0.055;
      const pOff = 0.15 * innerW;
      const pivot = new THREE.Group();
      pivot.position.set(hingeAtStart ? -innerW / 2 + pOff : innerW / 2 - pOff, bottom, 0);
      const holder = new THREE.Group();
      const lf = leaf(innerW, false, leafH, lt);
      lf.position.x = -pOff;
      const pl = Math.min(1.4, leafH * 0.6);
      const py = clamp(1.05 - bottom, pl / 2, leafH - pl / 2);
      const px = innerW - 0.12;
      for (const side of [-1, 1]) {
        lf.add(box(0.025, pl, 0.025, px, py, side * (lt / 2 + 0.045), metalMat, false));
        for (const dy of [-pl / 2 + 0.08, pl / 2 - 0.08]) lf.add(cyl(0.009, 0.045, px, py + dy, side * (lt / 2 + 0.0225), 'z', metalMat, false));
      }
      holder.add(lf);
      if (!hingeAtStart) holder.scale.x = -1;
      pivot.add(holder);
      // Pivot hardware at floor and head.
      pivot.add(cyl(0.025, 0.012, 0, 0.006, 0, 'y', metalMat, false));
      pivot.add(cyl(0.025, 0.012, 0, leafH - 0.006, 0, 'y', metalMat, false));
      pivot.rotation.y = (hingeAtStart ? -swing : swing) * open;
      add(pivot);
    }
    // Passages (plain, arched, moon gate) have the frame only.
    if (opening.threshold) add(box(w, 0.018, t + 0.04, 0, sill + 0.009, 0, frameMat, shadows));
  } else {
    const tall = kind === 'window-tall';
    // The design's own glazing bars replace the "Muntin grid" grille.
    const grid = opening.grille === 'grid' && !spec.ownBars;
    const designGrid = design === 'win-grid-2x2' || design === 'win-grid-3x2';
    const paneMat = spec.glass === 'reeded' ? reededMat : glassMat;
    if (shape.kind !== 'circle') {
      // Frame bottom, and the sill board on the side opposite the swing (none for floor-to-ceiling windows).
      add(box(w, f, t, 0, sill + f / 2, 0, frameMat, shadows));
      if (!tall) add(box(w + 0.06, 0.025, 0.06, 0, sill - 0.0125, -swing * (t / 2 + 0.01), frameMat, shadows));
    }
    /** A glass pane `pw` × `ph` centred at (x, y) in `parent`, reeded when the design says so. */
    const pane = (parent: THREE.Object3D, pw: number, ph: number, x: number, y: number, mat = paneMat) => {
      if (pw < 0.005 || ph < 0.005) return;
      if (mat === reededMat) {
        const m = new THREE.Mesh(flutedGeometry(pw, ph, REED_PITCH, 0.004), reededMat);
        m.position.set(x, y, -0.002);
        parent.add(m);
      } else parent.add(box(pw, ph, 0.01, x, y, 0, mat, false));
    };
    // Fixed top light above a transom bar (rectangular windows).
    const tl = spec.topLight && shape.kind === 'rect' ? topLightHeight(innerH) : 0;
    const sashH = tl > 0 ? innerH - tl - f : innerH;
    if (tl > 0) {
      add(box(innerW, f, t, 0, bottom + sashH + f / 2, 0, frameMat, shadows));
      pane(group, innerW + 0.01, tl + 0.01, 0, bottom + sashH + f + tl / 2);
    }
    const sash = (x0: number, width: number, sashHingeAtStart: boolean, z: number, openable: boolean, sh = sashH) => {
      const sg = new THREE.Group();
      const sf = Math.min(spec.sash, width / 4, sh / 4);
      const sd = spec.sashDepth;
      sg.add(box(sf, sh, sd, sf / 2, sh / 2, 0, frameMat, shadows));
      sg.add(box(sf, sh, sd, width - sf / 2, sh / 2, 0, frameMat, shadows));
      sg.add(box(width - 2 * sf, sf, sd, width / 2, sf / 2, 0, frameMat, shadows));
      sg.add(box(width - 2 * sf, sf, sd, width / 2, sh - sf / 2, 0, frameMat, shadows));
      const gw = width - 2 * sf;
      const gh = sh - 2 * sf;
      const glaze = sashGlazing(design, gw, gh, width / Math.max(innerW, 1e-3));
      if (glaze.frosted) {
        const fr = glaze.frosted;
        pane(sg, fr.x1 - fr.x0 + 0.01, fr.y1 - fr.y0 + 0.005, sf + (fr.x0 + fr.x1) / 2, sf + (fr.y0 + fr.y1) / 2, frostedMat);
        if (gh - fr.y1 > 0.005) pane(sg, gw + 0.01, gh - fr.y1, width / 2, sf + (fr.y1 + gh) / 2);
      } else pane(sg, gw + 0.01, gh + 0.01, width / 2, sh / 2);
      for (const b of glaze.bars) {
        sg.add(box(b.x1 - b.x0, b.y1 - b.y0, spec.barDepth, sf + (b.x0 + b.x1) / 2, sf + (b.y0 + b.y1) / 2, 0, frameMat, false));
      }
      if (grid) {
        // Muntins dividing the glass into lites of roughly 0.3 m.
        const cols = Math.max(1, Math.round(gw / 0.3));
        const rows = Math.max(1, Math.round(gh / 0.34));
        for (let j = 1; j < cols; j++) sg.add(box(0.018, gh, 0.03, sf + (gw * j) / cols, sh / 2, 0, frameMat, false));
        for (let i = 1; i < rows; i++) sg.add(box(gw, 0.018, 0.03, width / 2, sf + (gh * i) / rows, 0, frameMat, false));
      }
      if (spec.handle && openable) {
        // Lever handle on the closing stile, interior face (opposite the swing side).
        const hx = sashHingeAtStart ? width - sf / 2 : sf / 2;
        const hy = clamp(sh / 2, 0.1, sh - 0.1);
        sg.add(box(0.03, 0.07, 0.012, hx, hy, -swing * (sd / 2 + 0.006), frameMat, false));
        sg.add(box(0.018, 0.11, 0.016, hx, hy - 0.045, -swing * (sd / 2 + 0.02), metalMat, false));
      }
      const pivot = new THREE.Group();
      pivot.position.set(sashHingeAtStart ? x0 : x0 + width, bottom, z);
      if (!sashHingeAtStart) sg.position.x = -width;
      pivot.add(sg);
      if (openable) pivot.rotation.y = (sashHingeAtStart ? -swing : swing) * open;
      add(pivot);
    };
    /** One casement (narrow) or a pair (wide) of height `sh`. */
    const casements = (sh: number) => {
      if (innerW >= 1.0) {
        sash(-innerW / 2, innerW / 2, true, swing * 0.01, true, sh);
        sash(0, innerW / 2, false, swing * 0.01, true, sh);
      } else sash(-innerW / 2, innerW, hingeAtStart, swing * 0.01, true, sh);
    };
    if (spec.mullion && shape.kind === 'rect' && innerW > 0.45) {
      // Asymmetric: a narrow vent on the hinge side, a mullion, and a wide fixed pane.
      const vw = innerW * ASYM_VENT_SHARE;
      const atStart = hingeAtStart;
      const fixedKind = kind === 'window-fixed';
      add(box(f, sashH, t, atStart ? -innerW / 2 + vw + f / 2 : innerW / 2 - vw - f / 2, bottom + sashH / 2, 0, frameMat, shadows));
      sash(atStart ? -innerW / 2 : innerW / 2 - vw, vw, atStart, fixedKind ? 0 : swing * 0.01, !fixedKind);
      sash(atStart ? -innerW / 2 + vw + f : -innerW / 2, innerW - vw - f, true, 0, false);
    } else if (kind === 'window-fixed') sash(-innerW / 2, innerW, true, 0, false);
    else if (kind === 'window-single') sash(-innerW / 2, innerW, hingeAtStart, swing * 0.01, true);
    else if (kind === 'window-double') {
      sash(-innerW / 2, innerW / 2, true, swing * 0.01, true);
      sash(0, innerW / 2, false, swing * 0.01, true);
    } else if (kind === 'window-sliding') {
      const sw = innerW * 0.52;
      const slide = (opening.openAngle / 90) * innerW * 0.45;
      sash(-innerW / 2 + slide, sw, true, 0.03, false);
      sash(innerW / 2 - sw, sw, true, -0.03, false);
    } else if (kind === 'window-tall') {
      // Floor-to-ceiling: one casement, or a pair when wide (fixed-looking when shown closed).
      if (innerW >= 1.4) casements(sashH);
      else sash(-innerW / 2, innerW, hingeAtStart, swing * 0.01, true);
    } else if (kind === 'window-arched' && shape.kind === 'arch') {
      // Casement(s) below the spring line, a transom bar, and a fixed arched fanlight above.
      const { ys, a, b } = shape;
      add(box(innerW, f, t, 0, ys, 0, frameMat, shadows));
      const sh = ys - f / 2 - bottom;
      if (sh > 0.1) casements(sh);
      const ga = a - f + 0.005;
      const gb = b - f + 0.005;
      if (ga > 0.02 && gb > 0.02) {
        const outline: XY[] = [];
        for (let i = 0; i <= 24; i++) {
          const th = (Math.PI * i) / 24;
          outline.push([ga * Math.cos(th), ys + gb * Math.sin(th)]);
        }
        add(plate(outline, 0.01, 0, spec.glass === 'reeded' ? frostedMat : glassMat, false));
        if (grid || designGrid || design === 'win-steel') {
          // Sunburst glazing bars.
          for (const th of [Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4]) {
            const ex = ga * Math.cos(th);
            const ey = gb * Math.sin(th);
            add(boxR(Math.hypot(ex, ey), spec.bar, spec.barDepth, ex / 2, ys + ey / 2, 0, [0, 0, Math.atan2(ey, ex)], frameMat, false));
          }
        }
      }
    } else if (kind === 'window-round' && shape.kind === 'circle') {
      // Fixed porthole: glass disc, an inner bead ring, optional cross bars.
      const { cy, r } = shape;
      const gr = r - f + 0.005;
      if (gr > 0.02) {
        add(cyl(gr, 0.01, 0, cy, 0, 'z', spec.glass === 'reeded' ? frostedMat : glassMat, false));
        const bead = Math.min(0.025, spec.sash * 0.6);
        arcBand(group, 0, cy, gr - bead / 2, gr - bead / 2, 0, Math.PI * 2, 40, bead, Math.min(0.045, spec.sashDepth), 0, frameMat, shadows);
        if (grid || designGrid) {
          add(box(2 * gr, spec.bar, spec.barDepth, 0, cy, 0, frameMat, false));
          add(box(spec.bar, 2 * gr, spec.barDepth, 0, cy, 0, frameMat, false));
        }
      }
    }

    // Security bars on the exterior face. Sashes open outward, so the exterior is the swing side (the interior sill board is on the other side).
    if (opening.grille === 'bars') {
      const zb = swing * (face + 0.04);
      const nb = Math.max(2, Math.round(w / 0.11));
      for (let i = 0; i < nb; i++) {
        const x = -w / 2 + ((i + 0.5) * w) / nb;
        const ext = shapeExtent(shape, x, sill, head);
        if (!ext || ext[1] - ext[0] < 0.03) continue;
        add(cyl(0.007, ext[1] - ext[0], x, (ext[0] + ext[1]) / 2, zb, 'y', metalMat, false));
      }
      if (shape.kind === 'circle') {
        arcBand(group, 0, shape.cy, shape.r, shape.r, 0, Math.PI * 2, 40, 0.025, 0.006, zb, metalMat, false);
        for (const sx of [-1, 1]) add(box(0.025, 0.025, 0.04, sx * shape.r, shape.cy, swing * (face + 0.02), metalMat, false));
      } else {
        const top = shape.kind === 'arch' ? shape.ys : head - 0.05;
        const rails = [sill + 0.05, top];
        if (top - sill > 1.2) rails.push((sill + top) / 2);
        for (const y of rails) {
          add(box(w + 0.06, 0.03, 0.006, 0, y, zb, metalMat, false));
          for (const sx of [-1, 1]) add(box(0.02, 0.03, 0.04, sx * (w / 2 + 0.02), y, swing * (face + 0.02), metalMat, false));
        }
        if (shape.kind === 'arch') arcBand(group, 0, shape.ys, shape.a - 0.012, shape.b - 0.012, 0, Math.PI, 20, 0.025, 0.006, zb, metalMat, false);
      }
    }

    // Louvred shutter pair on the exterior face, shown open against the wall beside the window.
    if (opening.shutters) {
      const st = 0.03;
      const sw = w / 2;
      const zs = swing * (face + 0.005 + st / 2);
      const x0 = w / 2 + (casing ? cw : 0) + 0.01;
      for (const sx of [-1, 1]) {
        const sg = new THREE.Group();
        sg.name = 'opening-shutter';
        sg.position.set(sx * (x0 + sw / 2), sill + H / 2, zs);
        const stile = 0.05;
        const rail = 0.08;
        for (const x of [-sw / 2 + stile / 2, sw / 2 - stile / 2]) sg.add(box(stile, H, st, x, 0, 0, frameMat, shadows));
        const rails = [-H / 2 + rail / 2, H / 2 - rail / 2];
        if (H > 1.2) rails.push(0);
        for (const y of rails) sg.add(box(sw - 2 * stile, rail, st, 0, y, 0, frameMat, shadows));
        const bays: [number, number][] =
          H > 1.2
            ? [
                [-H / 2 + rail, -rail / 2],
                [rail / 2, H / 2 - rail],
              ]
            : [[-H / 2 + rail, H / 2 - rail]];
        for (const [y0, y1] of bays) {
          const n = Math.max(1, Math.floor((y1 - y0) / 0.055));
          for (let i = 0; i < n; i++) {
            const y = y0 + ((i + 0.5) * (y1 - y0)) / n;
            sg.add(boxR(sw - 2 * stile, 0.05, 0.008, 0, y, 0, [swing * 0.6, 0, 0], frameMat, false));
          }
        }
        add(sg);
      }
    }
  }

  // ── Casing: architrave trim around the opening on both wall faces ──
  if (casing) {
    for (const sz of [-1, 1]) {
      const z = sz * (face + cd / 2);
      if (shape.kind === 'circle') {
        const rc = shape.r + cw / 2 - 0.005;
        arcBand(group, 0, shape.cy, rc, rc, 0, Math.PI * 2, 48, cw, cd, z, frameMat, shadows);
        continue;
      }
      const base = win ? sill - cw : sill;
      const top = shape.kind === 'arch' ? shape.ys : head + cw;
      for (const sx of [-1, 1]) add(box(cw, top - base, cd, sx * (w / 2 + cw / 2 - 0.005), base + (top - base) / 2, z, frameMat, shadows));
      if (shape.kind === 'arch')
        arcBand(group, 0, shape.ys, shape.a + cw / 2 - 0.005, shape.b + cw / 2 - 0.005, 0, Math.PI, 24, cw, cd, z, frameMat, shadows);
      else add(box(w + 2 * cw - 0.01, cw, cd, 0, head + cw / 2, z, frameMat, shadows));
      if (win) add(box(w + 2 * cw - 0.01, cw, cd, 0, sill - cw / 2, z, frameMat, shadows));
    }
  }
  return group;
}

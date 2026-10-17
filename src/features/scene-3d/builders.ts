import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { PlacedObject, Project, Room, Vec2 } from '@/domain/model/schema';
import type { RoomFace } from '@/domain/geometry/rooms';
import type { JunctionHub, WallGeometry, WallPiece } from '@/domain/geometry/walls';
import { triangulate } from '@/domain/geometry/polygon';
import { pointAt } from '@/domain/geometry/wallPath';
import { dist, leftNormal, normalize, sub } from '@/domain/geometry/vec';
import { getAsset, objectSlotMaterialId } from '@/data/assets/registry';
import { dropPackKeys, subscribePacks } from '@/packs/events';
import type { AssetDefinition, Part, Size3 } from '@/data/assets/types';
import type { MaterialRegistry } from './materialRegistry';

// ───────────────────────── Geometry accumulation ─────────────────────────

class Acc {
  pos: number[] = [];
  nrm: number[] = [];
  uv: number[] = [];
  idx: number[] = [];
  get count() {
    return this.pos.length / 3;
  }
  /** Adds a planar polygon (convex or not) with a known outward normal. */
  face(verts: THREE.Vector3[], normal: THREE.Vector3, uvs: [number, number][], tris?: number[][]) {
    const base = this.count;
    for (let i = 0; i < verts.length; i++) {
      this.pos.push(verts[i].x, verts[i].y, verts[i].z);
      this.nrm.push(normal.x, normal.y, normal.z);
      this.uv.push(uvs[i][0], uvs[i][1]);
    }
    const triangles = tris ?? verts.slice(1, -1).map((_, i) => [0, i + 1, i + 2]);
    const e1 = new THREE.Vector3();
    const e2 = new THREE.Vector3();
    for (const [a, b, c] of triangles) {
      e1.subVectors(verts[b], verts[a]);
      e2.subVectors(verts[c], verts[a]);
      const n = e1.cross(e2);
      if (n.dot(normal) >= 0) this.idx.push(base + a, base + b, base + c);
      else this.idx.push(base + a, base + c, base + b);
    }
  }
}

function mergeGroups(groups: Acc[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const pos: number[] = [];
  const nrm: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  let offset = 0;
  let start = 0;
  groups.forEach((a, gi) => {
    pos.push(...a.pos);
    nrm.push(...a.nrm);
    uv.push(...a.uv);
    for (const i of a.idx) idx.push(i + offset);
    g.addGroup(start, a.idx.length, gi);
    start += a.idx.length;
    offset += a.count;
  });
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

const V = (p: Vec2, h: number) => new THREE.Vector3(p.x, h, p.y);

function polylineLengths(pts: Vec2[]): number[] {
  const out = [0];
  for (let i = 1; i < pts.length; i++) out.push(out[i - 1] + dist(pts[i - 1], pts[i]));
  return out;
}

/** Top height per polyline vertex: a constant, or a function of the vertex's arc-length position along the wall. */
type TopFn = number | ((s: number) => number);

/** Arc-length position along the wall of each vertex of a face polyline covering [s0, s1]. */
function vertexS(pts: Vec2[], s0: number, s1: number): number[] {
  const L = polylineLengths(pts);
  const total = L[L.length - 1] || 1;
  return L.map((l) => s0 + ((s1 - s0) * l) / total);
}

/** Vertical strip along a polyline with outward normals on `side` (+1 left, -1 right). */
function addSide(acc: Acc, pts: Vec2[], z0: number, z1: TopFn, side: 1 | -1, uOffset: number, s1 = uOffset + polylineLengths(pts)[pts.length - 1]) {
  const L = polylineLengths(pts);
  const S = typeof z1 === 'number' ? null : vertexS(pts, uOffset, s1);
  const top = (i: number) => (typeof z1 === 'number' ? z1 : z1(S![i]));
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (dist(a, b) < 1e-7) continue;
    const n = leftNormal(normalize(sub(b, a)));
    const normal = new THREE.Vector3(n.x * side, 0, n.y * side);
    const u0 = uOffset + L[i];
    const u1 = uOffset + L[i + 1];
    const ta = top(i);
    const tb = top(i + 1);
    acc.face([V(a, z0), V(b, z0), V(b, tb), V(a, ta)], normal, [
      [u0, z0],
      [u1, z0],
      [u1, tb],
      [u0, ta],
    ]);
  }
}

function addCap(acc: Acc, poly: Vec2[], z: number, up: boolean) {
  if (poly.length < 3) return;
  const tris = triangulate(poly);
  const verts = poly.map((p) => V(p, z));
  acc.face(
    verts,
    new THREE.Vector3(0, up ? 1 : -1, 0),
    poly.map((p) => [p.x, p.y]),
    tris,
  );
}

function addEnd(acc: Acc, l: Vec2, r: Vec2, z0: number, z1: number, outward: Vec2) {
  const w = dist(l, r);
  acc.face([V(l, z0), V(r, z0), V(r, z1), V(l, z1)], new THREE.Vector3(outward.x, 0, outward.y), [
    [0, z0],
    [w, z0],
    [w, z1],
    [0, z1],
  ]);
}

/**
 * Wall mesh geometry with three material groups: 0 = left face, 1 = right
 * face, 2 = top/bottom/ends/reveals. Openings are real gaps: the wall is built
 * from solid pieces plus below-sill and above-head pieces around each opening.
 */
export function buildWallGeometry(g: WallGeometry, cutHeight?: number): THREE.BufferGeometry | null {
  // Glass walls and railings have no solid body; wallExtras.ts builds their frames and infill.
  if (!hasSolidBody(g.wall.style)) return null;
  const left = new Acc();
  const right = new Acc();
  const other = new Acc();
  let any = false;
  for (const piece of g.pieces) {
    const z0 = piece.z0;
    // Below-sill pieces end at the sill; others follow the (possibly sloped) wall top.
    const rawTop = (s: number) => (piece.kind === 'below' ? piece.z1 : g.sloped ? g.topAt(s) : piece.z1);
    const top = (s: number) => (cutHeight !== undefined ? Math.min(rawTop(s), cutHeight) : rawTop(s));
    if (Math.max(top(piece.s0), top(piece.s1)) - z0 < 1e-4) continue;
    any = true;
    addPiece(piece, z0, g.sloped || cutHeight !== undefined ? top : top(piece.s0), g, left, right, other);
  }
  return any ? mergeGroups([left, right, other]) : null;
}

/** Wall styles built as a solid body (the others are frames/infill from wallExtras.ts). */
export const hasSolidBody = (style: WallGeometry['wall']['style']): boolean => !style || style === 'solid' || style === 'half';

function addPiece(piece: WallPiece, z0: number, z1: TopFn, g: WallGeometry, left: Acc, right: Acc, other: Acc) {
  const topAt = (s: number) => (typeof z1 === 'number' ? z1 : z1(s));
  addSide(left, piece.left, z0, z1, 1, piece.s0, piece.s1);
  addSide(right, piece.right, z0, z1, -1, piece.s0, piece.s1);
  const poly = [...piece.left, ...[...piece.right].reverse()];
  if (typeof z1 === 'number') addCap(other, poly, z1, true);
  else {
    // Sloped top: each outline vertex at the height of its position along the wall.
    const sl = vertexS(piece.left, piece.s0, piece.s1);
    const sr = vertexS(piece.right, piece.s0, piece.s1).reverse();
    const heights = [...sl, ...sr].map(topAt);
    const tris = triangulate(poly);
    acc3(other, poly, heights, tris);
  }
  if (z0 > 0.001) addCap(other, poly, z0, false);
  const t0 = pointAt(g.path, piece.s0).tangent;
  const t1 = pointAt(g.path, piece.s1).tangent;
  addEnd(other, piece.left[0], piece.right[0], z0, topAt(piece.s0), { x: -t0.x, y: -t0.y });
  addEnd(other, piece.left[piece.left.length - 1], piece.right[piece.right.length - 1], z0, topAt(piece.s1), t1);
}

/** Top face with per-vertex heights (sloped wall tops); normal from the first triangle. */
function acc3(acc: Acc, poly: Vec2[], heights: number[], tris: number[][]) {
  const verts = poly.map((p, i) => V(p, heights[i]));
  const n = new THREE.Vector3(0, 1, 0);
  if (tris.length) {
    const [a, b, c] = tris[0];
    const e1 = new THREE.Vector3().subVectors(verts[b], verts[a]);
    const e2 = new THREE.Vector3().subVectors(verts[c], verts[a]);
    const cn = e1.cross(e2).normalize();
    if (cn.lengthSq() > 0) n.copy(cn.y < 0 ? cn.negate() : cn);
  }
  acc.face(
    verts,
    n,
    poly.map((p) => [p.x, p.y]),
    tris,
  );
}

export function buildHubGeometry(hub: JunctionHub, cutHeight?: number): THREE.BufferGeometry | null {
  const z1 = cutHeight !== undefined ? Math.min(hub.z1, cutHeight) : hub.z1;
  if (z1 - hub.z0 < 1e-4) return null;
  const acc = new Acc();
  addCap(acc, hub.polygon, z1, true);
  const n = hub.polygon.length;
  // Exposed sides (e.g. bevelled outside corners); hidden sides are enclosed by walls.
  const area = hub.polygon.reduce((s, p, i) => s + p.x * hub.polygon[(i + 1) % n].y - hub.polygon[(i + 1) % n].x * p.y, 0);
  for (let i = 0; i < n; i++) {
    const a = hub.polygon[i];
    const b = hub.polygon[(i + 1) % n];
    if (dist(a, b) < 1e-6) continue;
    const ln = leftNormal(normalize(sub(b, a)));
    const out = area > 0 ? { x: -ln.x, y: -ln.y } : ln;
    addEnd(acc, a, b, hub.z0, z1, out);
  }
  return mergeGroups([acc]);
}

/** Horizontal polygon (floor or ceiling) with metre-based UVs. */
export function buildSlabGeometry(outer: Vec2[], holes: Vec2[][], y: number, facingUp: boolean): THREE.BufferGeometry {
  const all = [...outer, ...holes.flat()];
  const tris = triangulate(outer, holes);
  const acc = new Acc();
  acc.face(
    all.map((p) => V(p, y)),
    new THREE.Vector3(0, facingUp ? 1 : -1, 0),
    all.map((p) => [p.x, p.y]),
    tris,
  );
  return mergeGroups([acc]);
}

// ───────────────────────── Part geometries ─────────────────────────

/**
 * Box with rounded edges and corners of radius `r` (`seg` steps per quarter arc). Each face is a
 * grid whose rows/columns crowd into the edge bands; every vertex is projected onto the rounded
 * surface (clamp to the inner box, push out by r), so flat faces keep exact face normals and only
 * the bands curve. (three's RoundedBoxGeometry spreads the curvature over the whole face at
 * non-unit sizes, which shades large bevels as if melted.)
 */
function roundedBoxGeometry(w: number, h: number, d: number, r: number, seg: number): THREE.BufferGeometry {
  const half = [w / 2, h / 2, d / 2];
  const inner = half.map((v) => Math.max(0, v - r));
  // Coordinates along one axis: arc band, flat span, arc band.
  const axis = (i: number): number[] => {
    const out: number[] = [];
    for (let k = 0; k <= seg; k++) out.push(-inner[i] - r * Math.cos((Math.PI / 2) * (k / seg)));
    for (let k = 0; k <= seg; k++) out.push(inner[i] + r * Math.sin((Math.PI / 2) * (k / seg)));
    return out;
  };
  const coords = [axis(0), axis(1), axis(2)];
  const pos: number[] = [];
  const nrm: number[] = [];
  const idx: number[] = [];
  const p = [0, 0, 0];
  // Each face: normal axis n, sign, tangent axes (u, v) with u × v pointing outward.
  const faces: [number, number, number, number][] = [
    [0, 1, 1, 2],
    [0, -1, 2, 1],
    [1, 1, 2, 0],
    [1, -1, 0, 2],
    [2, 1, 0, 1],
    [2, -1, 1, 0],
  ];
  for (const [n, sign, u, v] of faces) {
    const base = pos.length / 3;
    const cu = coords[u];
    const cv = coords[v];
    for (const b of cv) {
      for (const a of cu) {
        p[n] = sign * half[n];
        p[u] = a;
        p[v] = b;
        // Project onto the rounded surface.
        const c = p.map((x, i) => Math.max(-inner[i], Math.min(inner[i], x)));
        const dx = p[0] - c[0];
        const dy = p[1] - c[1];
        const dz = p[2] - c[2];
        const len = Math.hypot(dx, dy, dz) || 1;
        pos.push(c[0] + (dx / len) * r, c[1] + (dy / len) * r, c[2] + (dz / len) * r);
        nrm.push(dx / len, dy / len, dz / len);
      }
    }
    const cols = cu.length;
    for (let j = 0; j < cv.length - 1; j++) {
      for (let i = 0; i < cols - 1; i++) {
        const a = base + j * cols + i;
        const b = a + 1;
        const c = a + cols;
        const e = c + 1;
        idx.push(a, b, e, a, e, c);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setIndex(idx);
  return geo;
}

const geoCache = new Map<string, THREE.BufferGeometry>();
const r4 = (n: number) => Math.round(n * 10000) / 10000;

function boxProjectUVs(geo: THREE.BufferGeometry) {
  const pos = geo.getAttribute('position');
  const nrm = geo.getAttribute('normal');
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nrm.getX(i));
    const ny = Math.abs(nrm.getY(i));
    const nz = Math.abs(nrm.getZ(i));
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (nx >= ny && nx >= nz) {
      uv[i * 2] = z;
      uv[i * 2 + 1] = y;
    } else if (ny >= nz) {
      uv[i * 2] = x;
      uv[i * 2 + 1] = z;
    } else {
      uv[i * 2] = x;
      uv[i * 2 + 1] = y;
    }
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

function scaleUVs(geo: THREE.BufferGeometry, su: number, sv: number) {
  const uv = geo.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  uv.needsUpdate = true;
}

export function partGeometry(part: Part): THREE.BufferGeometry {
  let key: string;
  switch (part.shape) {
    case 'box':
      key = `box|${part.size.map(r4).join(',')}|${r4(part.bevel ?? 0)}`;
      break;
    case 'cylinder':
      key = `cyl|${r4(part.radiusTop)}|${r4(part.radiusBottom)}|${r4(part.height)}|${part.segments ?? 24}`;
      break;
    case 'sphere':
      key = `sph|${r4(part.radius)}`;
      break;
    case 'torus':
      key = `tor|${r4(part.radius)}|${r4(part.tube)}|${r4(part.arc ?? Math.PI * 2)}`;
      break;
    case 'lathe':
      key = `lathe|${part.profile.map(([a, b]) => `${r4(a)}:${r4(b)}`).join(';')}|${part.segments ?? 24}`;
      break;
    case 'prism':
      key = `prism|${part.outline.map(([a, b]) => `${r4(a)}:${r4(b)}`).join(';')}|${r4(part.height)}`;
      break;
  }
  const hit = geoCache.get(key);
  if (hit) return hit;
  let geo: THREE.BufferGeometry;
  switch (part.shape) {
    case 'box': {
      const [w, h, d] = part.size.map((s) => Math.max(s, 0.001));
      const bevel = Math.min(part.bevel ?? 0, Math.min(w, h, d) / 2 - 0.0005);
      geo = bevel > 0.002 ? roundedBoxGeometry(w, h, d, bevel, 4) : new THREE.BoxGeometry(w, h, d);
      boxProjectUVs(geo);
      break;
    }
    case 'cylinder': {
      geo = new THREE.CylinderGeometry(Math.max(0, part.radiusTop), Math.max(0, part.radiusBottom), Math.max(0.001, part.height), part.segments ?? 24);
      scaleUVs(geo, 2 * Math.PI * Math.max(part.radiusTop, part.radiusBottom), part.height);
      break;
    }
    case 'sphere':
      geo = new THREE.SphereGeometry(part.radius, 24, 16);
      scaleUVs(geo, 2 * Math.PI * part.radius, Math.PI * part.radius);
      break;
    case 'torus': {
      const arc = part.arc ?? Math.PI * 2;
      geo = new THREE.TorusGeometry(part.radius, part.tube, 12, 32, arc);
      scaleUVs(geo, arc * part.radius, 2 * Math.PI * part.tube);
      break;
    }
    case 'lathe': {
      const pts = part.profile.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y));
      geo = new THREE.LatheGeometry(pts, part.segments ?? 24);
      const maxR = Math.max(...part.profile.map(([r]) => r));
      const len = pts.reduce((s, p, i) => (i ? s + p.distanceTo(pts[i - 1]) : 0), 0);
      scaleUVs(geo, 2 * Math.PI * maxR, len);
      break;
    }
    case 'prism': {
      const outline = part.outline.map(([x, z]) => ({ x, y: z }));
      const acc = new Acc();
      addCap(acc, outline, part.height, true);
      addCap(acc, outline, 0, false);
      const n = outline.length;
      const area = outline.reduce((s, p, i) => s + p.x * outline[(i + 1) % n].y - outline[(i + 1) % n].x * p.y, 0);
      for (let i = 0; i < n; i++) {
        const a = outline[i];
        const b = outline[(i + 1) % n];
        const ln = leftNormal(normalize(sub(b, a)));
        // leftNormal is (d.y, -d.x): it points out of a counter-clockwise (area > 0) outline.
        addEnd(acc, a, b, 0, part.height, area > 0 ? ln : { x: -ln.x, y: -ln.y });
      }
      geo = mergeGroups([acc]);
      geo.clearGroups();
      boxProjectUVs(geo);
      break;
    }
  }
  geo.userData.cached = true;
  if (geoCache.size > 2500) geoCache.clear();
  geoCache.set(key, geo);
  return geo;
}

// ───────────────────────── Objects ─────────────────────────

const MERGE_ATTRS = new Set(['position', 'normal', 'uv']);
const slotGeoCache = new Map<string, { slot: string; geometry: THREE.BufferGeometry }[]>();
// Content packs reload live: rebuild their items from the new definitions.
subscribePacks(() => dropPackKeys(slotGeoCache));

/** A part's geometry baked into object space, non-indexed with position/normal/uv only (merge-compatible). */
function bakedPart(part: Part): THREE.BufferGeometry {
  const src = partGeometry(part);
  const g = src.index ? src.toNonIndexed() : src.clone();
  g.userData = {};
  for (const name of Object.keys(g.attributes)) if (!MERGE_ATTRS.has(name)) g.deleteAttribute(name);
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2));
  g.morphAttributes = {};
  g.clearGroups();
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(...part.position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...(part.rotation ?? [0, 0, 0]))),
    new THREE.Vector3(...(part.scale ?? [1, 1, 1])),
  );
  g.applyMatrix4(m);
  return g;
}

/**
 * One geometry per material slot for an asset at a size: every part baked in and merged, so a
 * detailed asset costs one draw call per slot instead of one per part. Cached and shared by all
 * objects with the same asset and size (flagged `userData.cached`: never dispose them).
 */
export function assetSlotGeometries(asset: AssetDefinition, size: Size3): { slot: string; geometry: THREE.BufferGeometry }[] {
  const key = `${asset.id}|${r4(size.w)}|${r4(size.d)}|${r4(size.h)}`;
  const hit = slotGeoCache.get(key);
  if (hit) return hit;
  const bySlot = new Map<string, THREE.BufferGeometry[]>();
  for (const part of asset.build(size)) {
    const list = bySlot.get(part.slot) ?? [];
    list.push(bakedPart(part));
    bySlot.set(part.slot, list);
  }
  const out: { slot: string; geometry: THREE.BufferGeometry }[] = [];
  for (const [slot, list] of bySlot) {
    const merged = list.length === 1 ? list[0] : mergeGeometries(list, false);
    if (list.length > 1) for (const g of list) g.dispose();
    if (!merged) continue;
    merged.computeBoundingBox();
    merged.computeBoundingSphere();
    merged.userData.cached = true;
    out.push({ slot, geometry: merged });
  }
  if (slotGeoCache.size > 600) slotGeoCache.clear();
  slotGeoCache.set(key, out);
  return out;
}

function slotMesh(geometry: THREE.BufferGeometry, material: THREE.Material, shadows: boolean): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = shadows;
  mesh.receiveShadow = shadows;
  return mesh;
}

export interface BuildContext {
  project: Project;
  registry: MaterialRegistry;
  /** Resolved imported models by blob id (already parsed). */
  customModels?: Map<string, THREE.Object3D>;
  shadows?: boolean;
}

/** Group for a placed object: procedural parts, or an imported model normalised to the object's size. */
export function buildObject(obj: PlacedObject, ctx: BuildContext): THREE.Group {
  const group = new THREE.Group();
  group.name = obj.name ?? obj.assetId;
  group.position.set(obj.x, obj.elevation, obj.y);
  group.rotation.y = -obj.rotation;
  if (obj.mirrored) group.scale.x = -1;
  group.userData = { kind: 'object', id: obj.id };
  const asset = getAsset(ctx.project, obj.assetId);
  const shadows = ctx.shadows ?? true;
  if (!asset) {
    group.add(placeholderBox(obj));
    return group;
  }
  const custom = ctx.project.customAssets[obj.assetId];
  if (custom) {
    const model = ctx.customModels?.get(custom.blobId);
    if (!model) {
      group.add(placeholderBox(obj));
      return group;
    }
    const clone = model.clone(true);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const holder = new THREE.Group();
    holder.add(clone);
    clone.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
    holder.scale.set(obj.width / Math.max(size.x, 1e-4), obj.height / Math.max(size.y, 1e-4), obj.depth / Math.max(size.z, 1e-4));
    clone.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = shadows;
        o.receiveShadow = shadows;
      }
    });
    group.add(holder);
    return group;
  }
  for (const { slot, geometry } of assetSlotGeometries(asset, { w: obj.width, d: obj.depth, h: obj.height })) {
    const mat = ctx.registry.get(ctx.project, objectSlotMaterialId(obj, asset, slot));
    group.add(slotMesh(geometry, mat, shadows));
  }
  return group;
}

function placeholderBox(obj: PlacedObject): THREE.Mesh {
  const geo = new THREE.BoxGeometry(obj.width, obj.height, obj.depth);
  const mat = new THREE.MeshStandardMaterial({ color: '#8fa3b5', transparent: true, opacity: 0.5, wireframe: false });
  const m = new THREE.Mesh(geo, mat);
  m.position.y = obj.height / 2;
  return m;
}

/** Asset preview group at its default size (thumbnails). */
export function buildAssetPreview(asset: AssetDefinition, project: Project | null, registry: MaterialRegistry): THREE.Group {
  const group = new THREE.Group();
  for (const { slot, geometry } of assetSlotGeometries(asset, asset.defaultSize)) {
    const slotMat = asset.slots.find((s) => s.id === slot)?.defaultMaterial;
    group.add(slotMesh(geometry, registry.get(project, slotMat), false));
  }
  return group;
}

// ───────────────────────── Openings ─────────────────────────

// Door/window assemblies live in ./openingBuilder (imported directly by callers, so the two modules don't form an import cycle).

// ───────────────────────── Floors & ceilings ─────────────────────────

export function ceilingHeightFor(room: Room | null, face: RoomFace, project: Project): number {
  if (room?.ceilingHeight) return room.ceilingHeight;
  const hs = face.wallIds.map((id) => project.walls[id]).filter(Boolean).map((w) => w.baseElevation + w.height);
  return hs.length ? Math.min(...hs) : project.settings.defaultWall.height;
}

export function buildFloor(face: RoomFace, room: Room | null, ctx: BuildContext): THREE.Mesh {
  const mesh = new THREE.Mesh(buildSlabGeometry(face.inner, face.holes, 0.002, true), ctx.registry.get(ctx.project, room?.floorMaterialId ?? 'wood-oak-natural'));
  mesh.receiveShadow = ctx.shadows ?? true;
  mesh.userData = { kind: 'room', id: room?.id };
  mesh.name = room ? `Floor: ${room.name}` : 'Floor';
  return mesh;
}

export function buildCeiling(face: RoomFace, room: Room | null, ctx: BuildContext): THREE.Mesh {
  const h = ceilingHeightFor(room, face, ctx.project);
  const mat = ctx.registry.get(ctx.project, room?.ceilingMaterialId ?? 'paint-ceiling-white');
  const mesh = new THREE.Mesh(buildSlabGeometry(face.inner, face.holes, h - 0.002, false), mat);
  mesh.receiveShadow = ctx.shadows ?? true;
  mesh.userData = { kind: 'ceiling', id: room?.id };
  mesh.name = room ? `Ceiling: ${room.name}` : 'Ceiling';
  return mesh;
}

/** Stable key describing a wall's geometry so meshes rebuild only when it changes. */
export function wallGeometryKey(g: WallGeometry, cut?: number): string {
  const r = (n: number) => Math.round(n * 10000);
  let s = `${cut ?? ''}|${g.wall.style ?? 'solid'}|${g.wall.heightEnd ?? ''}|`;
  for (const pc of g.pieces) {
    s += `${pc.kind}:${r(pc.z0)}:${r(pc.z1)}:`;
    for (const p of pc.left) s += `${r(p.x)},${r(p.y)};`;
    for (const p of pc.right) s += `${r(p.x)},${r(p.y)};`;
  }
  return s;
}

export function wallMaterials(project: Project, g: WallGeometry, registry: MaterialRegistry): THREE.Material[] {
  return [
    registry.get(project, g.wall.materials.left),
    registry.get(project, g.wall.materials.right),
    registry.get(project, g.wall.materials.top),
  ];
}

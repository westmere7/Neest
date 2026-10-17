import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Opening, PlacedObject, Project, Room, Vec2 } from '@/domain/model/schema';
import { isWindowKind } from '@/domain/model/schema';
import type { RoomFace } from '@/domain/geometry/rooms';
import type { JunctionHub, OpeningSpan, WallGeometry, WallPiece } from '@/domain/geometry/walls';
import { triangulate } from '@/domain/geometry/polygon';
import { pointAt } from '@/domain/geometry/wallPath';
import { angleOf, dist, leftNormal, normalize, sub } from '@/domain/geometry/vec';
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

/** Vertical strip along a polyline with outward normals on `side` (+1 left, -1 right). */
function addSide(acc: Acc, pts: Vec2[], z0: number, z1: number, side: 1 | -1, uOffset: number) {
  const L = polylineLengths(pts);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (dist(a, b) < 1e-7) continue;
    const n = leftNormal(normalize(sub(b, a)));
    const normal = new THREE.Vector3(n.x * side, 0, n.y * side);
    const u0 = uOffset + L[i];
    const u1 = uOffset + L[i + 1];
    acc.face([V(a, z0), V(b, z0), V(b, z1), V(a, z1)], normal, [
      [u0, z0],
      [u1, z0],
      [u1, z1],
      [u0, z1],
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
  const left = new Acc();
  const right = new Acc();
  const other = new Acc();
  let any = false;
  for (const piece of g.pieces) {
    const z0 = piece.z0;
    const z1 = cutHeight !== undefined ? Math.min(piece.z1, cutHeight) : piece.z1;
    if (z1 - z0 < 1e-4) continue;
    any = true;
    addPiece(piece, z0, z1, g, left, right, other);
  }
  return any ? mergeGroups([left, right, other]) : null;
}

function addPiece(piece: WallPiece, z0: number, z1: number, g: WallGeometry, left: Acc, right: Acc, other: Acc) {
  addSide(left, piece.left, z0, z1, 1, piece.s0);
  addSide(right, piece.right, z0, z1, -1, piece.s0);
  const poly = [...piece.left, ...[...piece.right].reverse()];
  addCap(other, poly, z1, true);
  if (z0 > 0.001) addCap(other, poly, z0, false);
  const t0 = pointAt(g.path, piece.s0).tangent;
  const t1 = pointAt(g.path, piece.s1).tangent;
  addEnd(other, piece.left[0], piece.right[0], z0, z1, { x: -t0.x, y: -t0.y });
  addEnd(other, piece.left[piece.left.length - 1], piece.right[piece.right.length - 1], z0, z1, t1);
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
      geo = bevel > 0.002 ? new RoundedBoxGeometry(w, h, d, 2, bevel) : new THREE.BoxGeometry(w, h, d);
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
        addEnd(acc, a, b, 0, part.height, area > 0 ? { x: -ln.x, y: -ln.y } : ln);
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

function meshFor(part: Part, material: THREE.Material, shadows: boolean): THREE.Mesh {
  const mesh = new THREE.Mesh(partGeometry(part), material);
  mesh.position.set(...part.position);
  if (part.rotation) mesh.rotation.set(...part.rotation);
  if (part.scale) mesh.scale.set(...part.scale);
  mesh.castShadow = shadows;
  mesh.receiveShadow = shadows;
  return mesh;
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

function box(w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material, shadows: boolean): THREE.Mesh {
  return meshFor({ shape: 'box', size: [w, h, d], position: [x, y, z], slot: '' }, mat, shadows);
}

/**
 * Door/window assembly placed in the wall gap: frame/casing, leaves or
 * sashes, glazing, and handles. Local frame: x along the wall, y up, z toward
 * the wall's right side.
 */
export function buildOpening(opening: Opening, g: WallGeometry, span: OpeningSpan, ctx: BuildContext): THREE.Group {
  const group = new THREE.Group();
  group.userData = { kind: 'opening', id: opening.id };
  const { p, tangent } = pointAt(g.path, span.center);
  group.position.set(p.x, 0, p.y);
  group.rotation.y = -angleOf(tangent);
  const shadows = ctx.shadows ?? true;
  const frameMat = ctx.registry.get(ctx.project, opening.frameMaterialId);
  const panelMat = ctx.registry.get(ctx.project, opening.panelMaterialId);
  const glassMat = ctx.registry.get(ctx.project, isWindowKind(opening.kind) ? opening.panelMaterialId : 'glass-clear');
  const metalMat = ctx.registry.get(ctx.project, 'metal-brushed-steel');
  const w = span.s1 - span.s0;
  const t = g.h * 2;
  const sill = span.sill;
  const head = span.head;
  const H = head - sill;
  const win = isWindowKind(opening.kind);
  const f = win ? 0.06 : 0.05;
  const casingDepth = t + (win ? 0.0 : 0.02);
  // Frame: jambs + head (+ sill for windows).
  group.add(box(f, H, casingDepth, -w / 2 + f / 2, sill + H / 2, 0, frameMat, shadows));
  group.add(box(f, H, casingDepth, w / 2 - f / 2, sill + H / 2, 0, frameMat, shadows));
  group.add(box(w, f, casingDepth, 0, head - f / 2, 0, frameMat, shadows));
  const swing = opening.swingSide === 'left' ? -1 : 1; // local z sign of the swing side
  const open = (opening.openAngle * Math.PI) / 180;
  const innerW = w - 2 * f;
  const innerH = H - f - (win ? f : 0);
  const bottom = sill + (win ? f : 0);

  const leaf = (width: number, glazed: boolean, panelled: boolean, withHandle = false): THREE.Group => {
    const lg = new THREE.Group();
    const lt = 0.04;
    if (withHandle) {
      for (const side of [-1, 1]) {
        lg.add(box(0.025, 0.06, 0.012, width - 0.07, 1.0 - bottom, side * (lt / 2 + 0.006), metalMat, false));
        lg.add(box(0.13, 0.018, 0.018, width - 0.12, 1.0 - bottom, side * (lt / 2 + 0.03), metalMat, false));
      }
    }
    if (glazed) {
      const rail = 0.09;
      lg.add(box(rail, innerH, lt, rail / 2, innerH / 2, 0, panelMat, shadows));
      lg.add(box(rail, innerH, lt, width - rail / 2, innerH / 2, 0, panelMat, shadows));
      lg.add(box(width - 2 * rail, rail, lt, width / 2, innerH - rail / 2, 0, panelMat, shadows));
      lg.add(box(width - 2 * rail, rail * 1.6, lt, width / 2, rail * 0.8, 0, panelMat, shadows));
      lg.add(box(width - 2 * rail, innerH - rail * 2.6, 0.008, width / 2, rail * 1.6 + (innerH - rail * 2.6) / 2, 0, glassMat, false));
    } else {
      lg.add(box(width, innerH, lt, width / 2, innerH / 2, 0, panelMat, shadows));
      if (panelled) {
        const pw = width * 0.62;
        for (const side of [-1, 1]) {
          lg.add(box(pw, innerH * 0.36, 0.012, width / 2, innerH * 0.72, side * (lt / 2 + 0.004), panelMat, shadows));
          lg.add(box(pw, innerH * 0.36, 0.012, width / 2, innerH * 0.28, side * (lt / 2 + 0.004), panelMat, shadows));
        }
      }
    }
    return lg;
  };

  if (!win) {
    if (opening.kind === 'door-single' || opening.kind === 'door-double') {
      const glazed = opening.style === 'glazed';
      const panelled = opening.style === 'panel';
      const leaves =
        opening.kind === 'door-single'
          ? [{ hingeAtStart: opening.hinge === 'start', width: innerW }]
          : [
              { hingeAtStart: true, width: innerW / 2 },
              { hingeAtStart: false, width: innerW / 2 },
            ];
      for (const l of leaves) {
        const pivot = new THREE.Group();
        const hx = l.hingeAtStart ? -innerW / 2 : innerW / 2;
        pivot.position.set(hx, bottom, swing * (t / 2 - 0.03));
        const lf = leaf(l.width, glazed, panelled, true);
        if (!l.hingeAtStart) lf.scale.x = -1;
        pivot.add(lf);
        // Rotate toward the swing side.
        pivot.rotation.y = (l.hingeAtStart ? -swing : swing) * open;
        group.add(pivot);
      }
    } else if (opening.kind === 'door-sliding') {
      const pw = innerW * 0.55;
      const slide = (opening.openAngle / 90) * innerW * 0.45;
      const p1 = leaf(pw, opening.style !== 'flush', false, true);
      p1.position.set(-innerW / 2 + slide, bottom, t * 0.18);
      const p2 = leaf(pw, opening.style !== 'flush', false);
      p2.position.set(innerW / 2 - pw, bottom, -t * 0.18);
      group.add(p1, p2);
    }
  } else {
    // Window sill board (interior side = opposite of the swing side) and frame bottom.
    group.add(box(w, f, t, 0, sill + f / 2, 0, frameMat, shadows));
    group.add(box(w + 0.06, 0.025, 0.06, 0, sill - 0.0125, -swing * (t / 2 + 0.01), frameMat, shadows));
    const sash = (x0: number, width: number, hingeAtStart: boolean, z: number, openable: boolean) => {
      const sg = new THREE.Group();
      const sf = 0.045;
      const sd = 0.05;
      sg.add(box(sf, innerH, sd, sf / 2, innerH / 2, 0, frameMat, shadows));
      sg.add(box(sf, innerH, sd, width - sf / 2, innerH / 2, 0, frameMat, shadows));
      sg.add(box(width - 2 * sf, sf, sd, width / 2, sf / 2, 0, frameMat, shadows));
      sg.add(box(width - 2 * sf, sf, sd, width / 2, innerH - sf / 2, 0, frameMat, shadows));
      sg.add(box(width - 2 * sf, innerH - 2 * sf, 0.01, width / 2, innerH / 2, 0, glassMat, false));
      const pivot = new THREE.Group();
      pivot.position.set(hingeAtStart ? x0 : x0 + width, bottom, z);
      if (!hingeAtStart) sg.position.x = -width;
      pivot.add(sg);
      if (openable) pivot.rotation.y = (hingeAtStart ? -swing : swing) * open;
      group.add(pivot);
    };
    if (opening.kind === 'window-fixed') sash(-innerW / 2, innerW, true, 0, false);
    else if (opening.kind === 'window-single') sash(-innerW / 2, innerW, opening.hinge === 'start', swing * 0.01, true);
    else if (opening.kind === 'window-double') {
      sash(-innerW / 2, innerW / 2, true, swing * 0.01, true);
      sash(0, innerW / 2, false, swing * 0.01, true);
    } else if (opening.kind === 'window-sliding') {
      const sw = innerW * 0.52;
      const slide = (opening.openAngle / 90) * innerW * 0.45;
      sash(-innerW / 2 + slide, sw, true, 0.03, false);
      sash(innerW / 2 - sw, sw, true, -0.03, false);
    }
  }
  return group;
}

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
  let s = `${cut ?? ''}|`;
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

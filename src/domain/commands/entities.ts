import { current, isDraft } from 'immer';
import { DEFAULT_MATERIALS, MATERIAL_CATALOG_BY_ID } from '@/data/materials/catalog';
import { newId } from '../model/ids';
import { OPENING_PRESETS, ROOM_TYPE_LABELS } from '../model/defaults';
import type {
  CameraPreset,
  MaterialDefinition,
  Opening,
  OpeningKind,
  PlacedObject,
  Project,
  Room,
  RoomType,
  Vec2,
  WallRole,
  WallSide,
} from '../model/schema';
import { computeWallNetwork, openingOffsetRange } from '../geometry/walls';
import { detectRoomFaces, matchFacesToRooms } from '../geometry/rooms';
import { rotate } from '../geometry/vec';
import { deleteWalls, type D } from './walls';

const plain = (d: D): Project => (isDraft(d) ? (current(d) as Project) : (d as Project));
const snap = <T,>(x: T): T => (isDraft(x) ? (current(x) as T) : x);

// ───────────────────────── Openings ─────────────────────────

export interface AddOpeningArgs {
  wallId: string;
  kind: OpeningKind;
  offset: number;
  width?: number;
  height?: number;
  sillHeight?: number;
  swingSide?: 'left' | 'right';
  hinge?: 'start' | 'end';
}

export function addOpening(d: D, args: AddOpeningArgs): string | null {
  const wall = d.walls[args.wallId];
  if (!wall) return null;
  const preset = OPENING_PRESETS[args.kind];
  const isWindow = args.kind.startsWith('window');
  const id = newId(isWindow ? 'win' : 'door');
  const opening: Opening = {
    id,
    wallId: args.wallId,
    kind: args.kind,
    offset: args.offset,
    width: args.width ?? preset.width,
    height: Math.min(args.height ?? preset.height, wall.height - 0.05),
    sillHeight: args.sillHeight ?? preset.sill,
    swingSide: args.swingSide ?? 'left',
    hinge: args.hinge ?? 'start',
    openAngle: 0,
    style: preset.style,
    frameMaterialId: isWindow ? DEFAULT_MATERIALS.windowFrame : DEFAULT_MATERIALS.doorFrame,
    panelMaterialId: isWindow ? DEFAULT_MATERIALS.glass : DEFAULT_MATERIALS.doorPanel,
  };
  d.openings[id] = opening;
  clampOpening(d, id);
  return id;
}

/** Keeps an opening within its host wall's clear range (never past a wall end or junction). */
export function clampOpening(d: D, id: string): void {
  const o = d.openings[id];
  if (!o) return;
  const net = computeWallNetwork(plain(d));
  const g = net.walls.get(o.wallId);
  if (!g) return;
  const avail = Math.max(0.2, g.clearEnd - g.clearStart);
  if (o.width > avail) o.width = avail;
  const [lo, hi] = openingOffsetRange(g, o.width);
  o.offset = Math.min(Math.max(o.offset, lo), hi);
  const maxH = g.z1 - o.sillHeight - 0.02;
  if (o.height > maxH) o.height = Math.max(0.2, maxH);
}

export function updateOpening(d: D, id: string, patch: Partial<Omit<Opening, 'id'>>): void {
  const o = d.openings[id];
  if (!o) return;
  Object.assign(o, patch);
  clampOpening(d, id);
}

// ───────────────────────── Objects ─────────────────────────

export interface PlaceObjectArgs {
  assetId: string;
  x: number;
  y: number;
  rotation?: number;
  width: number;
  depth: number;
  height: number;
  elevation?: number;
  materials?: Record<string, string>;
  name?: string | null;
}

export function placeObject(d: D, args: PlaceObjectArgs): string {
  const id = newId('obj');
  const obj: PlacedObject = {
    id,
    assetId: args.assetId,
    name: args.name ?? null,
    x: args.x,
    y: args.y,
    elevation: args.elevation ?? 0,
    rotation: args.rotation ?? 0,
    width: args.width,
    depth: args.depth,
    height: args.height,
    mirrored: false,
    materials: { ...(args.materials ?? {}) },
    locked: false,
    hidden: false,
  };
  d.objects[id] = obj;
  return id;
}

export function updateObjects(d: D, ids: string[], patch: Partial<Omit<PlacedObject, 'id'>>): void {
  for (const id of ids) {
    const o = d.objects[id];
    if (!o) continue;
    if (patch.materials) o.materials = { ...o.materials, ...patch.materials };
    const { materials: _m, ...rest } = patch;
    Object.assign(o, rest);
  }
}

/** Rotates objects about their own centres, or about the group centre when several are selected. */
export function rotateObjects(d: D, ids: string[], delta: number): void {
  const objs = ids.map((id) => d.objects[id]).filter(Boolean);
  if (!objs.length) return;
  const cx = objs.reduce((s, o) => s + o.x, 0) / objs.length;
  const cy = objs.reduce((s, o) => s + o.y, 0) / objs.length;
  for (const o of objs) {
    if (objs.length > 1) {
      const p = rotate({ x: o.x, y: o.y }, delta, { x: cx, y: cy });
      o.x = p.x;
      o.y = p.y;
    }
    o.rotation = normalizeRotation(o.rotation + delta);
  }
}

export function normalizeRotation(r: number): number {
  const t = Math.PI * 2;
  let v = r % t;
  if (v < 0) v += t;
  if (Math.abs(v - t) < 1e-9) v = 0;
  return v;
}

export function translateObjects(d: D, ids: string[], delta: Vec2): void {
  for (const id of ids) {
    const o = d.objects[id];
    if (!o) continue;
    o.x += delta.x;
    o.y += delta.y;
  }
}

/** Duplicates objects and openings with an offset. Returns new ids (same order). */
export function duplicateEntities(d: D, ids: string[], offset: Vec2): string[] {
  const out: string[] = [];
  for (const id of ids) {
    const o = d.objects[id];
    if (o) {
      const nid = newId('obj');
      d.objects[nid] = { ...structuredClone(snap(o)), id: nid, x: o.x + offset.x, y: o.y + offset.y };
      out.push(nid);
      continue;
    }
    const op = d.openings[id];
    if (op) {
      const nid = newId(op.kind.startsWith('window') ? 'win' : 'door');
      d.openings[nid] = { ...structuredClone(snap(op)), id: nid, offset: op.offset + op.width + 0.1 };
      clampOpening(d, nid);
      out.push(nid);
    }
  }
  return out;
}

// ───────────────────────── Deletion ─────────────────────────

/** Deletes any mix of walls, openings, objects, nodes, and rooms (a room deletes walls bounding only it). */
export function deleteEntities(d: D, ids: string[]): void {
  const wallIds: string[] = [];
  for (const id of ids) {
    if (d.objects[id]) delete d.objects[id];
    else if (d.openings[id]) delete d.openings[id];
    else if (d.walls[id]) wallIds.push(id);
    else if (d.nodes[id]) {
      for (const w of Object.values(d.walls)) if (w.a === id || w.b === id) wallIds.push(w.id);
    } else if (d.rooms[id]) wallIds.push(...exclusiveRoomWalls(plain(d), id));
  }
  if (wallIds.length) deleteWalls(d, [...new Set(wallIds)]);
}

/** Walls that bound the given room and no other room. */
export function exclusiveRoomWalls(p: Project, roomId: string): string[] {
  const faces = detectRoomFaces(p);
  const match = matchFacesToRooms(faces, p.rooms);
  let target = -1;
  match.forEach((rid, fi) => {
    if (rid === roomId) target = fi;
  });
  if (target < 0) return [];
  const counts = new Map<string, number>();
  for (const f of faces) for (const w of f.wallIds) counts.set(w, (counts.get(w) ?? 0) + 1);
  return faces[target].wallIds.filter((w) => counts.get(w) === 1);
}

// ───────────────────────── Rooms ─────────────────────────

export function updateRoom(d: D, id: string, patch: Partial<Omit<Room, 'id'>>): void {
  const r = d.rooms[id];
  if (!r) return;
  Object.assign(r, patch);
}

const WET_TYPES: RoomType[] = ['bathroom', 'wc', 'laundry'];

/** Floor material suggested when a room type changes (only if the floor is still the default). */
export function suggestedFloor(type: RoomType): string {
  return WET_TYPES.includes(type) ? DEFAULT_MATERIALS.wetFloor : DEFAULT_MATERIALS.floor;
}

/**
 * Keeps persisted room records in sync with the faces detected from the wall
 * network: matched records get fresh identity hints, new faces get new
 * records, and records whose face disappeared are removed.
 */
export function reconcileRooms(d: D): void {
  const p = plain(d);
  const faces = detectRoomFaces(p);
  const match = matchFacesToRooms(faces, p.rooms);
  const matchedRooms = new Set(match.values());
  for (const id of Object.keys(d.rooms)) if (!matchedRooms.has(id)) delete d.rooms[id];
  const usedNames = new Set(Object.values(d.rooms).map((r) => r.name));
  let counter = 1;
  faces.forEach((f, fi) => {
    const rid = match.get(fi);
    if (rid) {
      const r = d.rooms[rid];
      if (Math.abs(r.anchor.x - f.label.x) > 1e-6 || Math.abs(r.anchor.y - f.label.y) > 1e-6) r.anchor = f.label;
      if (r.boundaryWallIds.join() !== f.wallIds.join()) r.boundaryWallIds = f.wallIds;
      return;
    }
    while (usedNames.has(`Room ${counter}`)) counter++;
    const name = `Room ${counter}`;
    usedNames.add(name);
    const id = newId('room');
    d.rooms[id] = {
      id,
      name,
      type: 'other',
      anchor: f.label,
      boundaryWallIds: f.wallIds,
      floorMaterialId: DEFAULT_MATERIALS.floor,
      ceilingMaterialId: DEFAULT_MATERIALS.ceiling,
      showCeiling: true,
      ceilingHeight: null,
      showLabel: true,
      labelOffset: { x: 0, y: 0 },
    };
  });
}

export const roomTypeLabel = (t: RoomType) => ROOM_TYPE_LABELS[t];

// ───────────────────────── Materials ─────────────────────────

export type MaterialTarget =
  | { kind: 'wall-side'; wallId: string; side: WallSide | 'top' }
  | { kind: 'wall-both'; wallId: string }
  | { kind: 'room-floor'; roomId: string }
  | { kind: 'room-ceiling'; roomId: string }
  | { kind: 'object-slot'; objectId: string; slot: string }
  | { kind: 'opening-frame'; openingId: string }
  | { kind: 'opening-panel'; openingId: string }
  | { kind: 'wall-trim'; wallId: string; side: WallSide; part: WallTrimPart }
  | { kind: 'wall-style'; wallId: string };

/** Finish layers on a wall face that carry their own material. */
export type WallTrimPart = 'skirting' | 'cornice' | 'rail' | 'band';
export const WALL_TRIM_PARTS: WallTrimPart[] = ['skirting', 'cornice', 'rail', 'band'];

export type MaterialScope =
  | 'this'
  /** All walls sharing the target wall's role (both sides). */
  | 'walls-of-role'
  /** Every instance of the same asset (same slot). */
  | 'asset-instances'
  /** Every room floor of the same room type. */
  | 'rooms-of-type'
  /** Every surface currently using the target's material. */
  | 'same-material';

/** Copies a catalogue material into the project if not present. Returns its id. */
export function ensureMaterial(d: D, id: string): string {
  if (d.materials[id]) return id;
  const cat = MATERIAL_CATALOG_BY_ID[id];
  if (cat) d.materials[id] = structuredClone(cat);
  return id;
}

export function getTargetMaterialId(p: Project, t: MaterialTarget, assetDefault?: (assetId: string, slot: string) => string | undefined): string | null {
  switch (t.kind) {
    case 'wall-side': {
      const w = p.walls[t.wallId];
      return w ? w.materials[t.side] : null;
    }
    case 'wall-both':
      return p.walls[t.wallId]?.materials.left ?? null;
    case 'room-floor':
      return p.rooms[t.roomId]?.floorMaterialId ?? null;
    case 'room-ceiling':
      return p.rooms[t.roomId]?.ceilingMaterialId ?? null;
    case 'object-slot': {
      const o = p.objects[t.objectId];
      if (!o) return null;
      return o.materials[t.slot] ?? assetDefault?.(o.assetId, t.slot) ?? null;
    }
    case 'opening-frame':
      return p.openings[t.openingId]?.frameMaterialId ?? null;
    case 'opening-panel':
      return p.openings[t.openingId]?.panelMaterialId ?? null;
    case 'wall-trim':
      return p.walls[t.wallId]?.finishes?.[t.side]?.[t.part]?.materialId ?? null;
    case 'wall-style':
      return p.walls[t.wallId]?.styleMaterialId ?? null;
  }
}

/** Every reference to a material id across the project. */
export function materialUsage(p: Project, materialId: string): MaterialTarget[] {
  const out: MaterialTarget[] = [];
  for (const w of Object.values(p.walls)) {
    for (const side of ['left', 'right', 'top'] as const)
      if (w.materials[side] === materialId) out.push({ kind: 'wall-side', wallId: w.id, side });
  }
  for (const r of Object.values(p.rooms)) {
    if (r.floorMaterialId === materialId) out.push({ kind: 'room-floor', roomId: r.id });
    if (r.ceilingMaterialId === materialId) out.push({ kind: 'room-ceiling', roomId: r.id });
  }
  for (const o of Object.values(p.objects)) {
    for (const [slot, m] of Object.entries(o.materials))
      if (m === materialId) out.push({ kind: 'object-slot', objectId: o.id, slot });
  }
  for (const o of Object.values(p.openings)) {
    if (o.frameMaterialId === materialId) out.push({ kind: 'opening-frame', openingId: o.id });
    if (o.panelMaterialId === materialId) out.push({ kind: 'opening-panel', openingId: o.id });
  }
  for (const w of Object.values(p.walls)) {
    if (w.styleMaterialId === materialId) out.push({ kind: 'wall-style', wallId: w.id });
    for (const side of ['left', 'right'] as const) {
      const fin = w.finishes?.[side];
      for (const part of WALL_TRIM_PARTS) if (fin?.[part]?.materialId === materialId) out.push({ kind: 'wall-trim', wallId: w.id, side, part });
    }
  }
  return out;
}

function setTarget(d: D, t: MaterialTarget, materialId: string) {
  switch (t.kind) {
    case 'wall-side': {
      const w = d.walls[t.wallId];
      if (w) w.materials[t.side] = materialId;
      break;
    }
    case 'wall-both': {
      const w = d.walls[t.wallId];
      if (w) {
        w.materials.left = materialId;
        w.materials.right = materialId;
      }
      break;
    }
    case 'room-floor': {
      const r = d.rooms[t.roomId];
      if (r) r.floorMaterialId = materialId;
      break;
    }
    case 'room-ceiling': {
      const r = d.rooms[t.roomId];
      if (r) r.ceilingMaterialId = materialId;
      break;
    }
    case 'object-slot': {
      const o = d.objects[t.objectId];
      if (o) o.materials[t.slot] = materialId;
      break;
    }
    case 'opening-frame': {
      const o = d.openings[t.openingId];
      if (o) o.frameMaterialId = materialId;
      break;
    }
    case 'opening-panel': {
      const o = d.openings[t.openingId];
      if (o) o.panelMaterialId = materialId;
      break;
    }
    case 'wall-trim': {
      const layer = d.walls[t.wallId]?.finishes?.[t.side]?.[t.part];
      if (layer) layer.materialId = materialId;
      break;
    }
    case 'wall-style': {
      const w = d.walls[t.wallId];
      if (w) w.styleMaterialId = materialId;
      break;
    }
  }
}

/** Expands a target + scope into the concrete list of targets that will change. */
export function expandScope(
  p: Project,
  target: MaterialTarget,
  scope: MaterialScope,
  assetDefault?: (assetId: string, slot: string) => string | undefined,
): MaterialTarget[] {
  if (scope === 'this') return [target];
  if (scope === 'same-material') {
    const id = getTargetMaterialId(p, target, assetDefault);
    if (!id) return [target];
    const usage = materialUsage(p, id);
    // Object slots using the asset default (no explicit entry) also count.
    if (assetDefault) {
      for (const o of Object.values(p.objects)) {
        if (target.kind !== 'object-slot') break;
        if (o.materials[target.slot] === undefined && assetDefault(o.assetId, target.slot) === id)
          usage.push({ kind: 'object-slot', objectId: o.id, slot: target.slot });
      }
    }
    return usage.length ? usage : [target];
  }
  if (scope === 'walls-of-role' && (target.kind === 'wall-side' || target.kind === 'wall-both')) {
    const role: WallRole | undefined = p.walls[target.wallId]?.role;
    const side = target.kind === 'wall-side' ? target.side : null;
    return Object.values(p.walls)
      .filter((w) => w.role === role)
      .map((w): MaterialTarget => (side ? { kind: 'wall-side', wallId: w.id, side } : { kind: 'wall-both', wallId: w.id }));
  }
  if (scope === 'asset-instances' && target.kind === 'object-slot') {
    const assetId = p.objects[target.objectId]?.assetId;
    return Object.values(p.objects)
      .filter((o) => o.assetId === assetId)
      .map((o): MaterialTarget => ({ kind: 'object-slot', objectId: o.id, slot: target.slot }));
  }
  if (scope === 'rooms-of-type' && (target.kind === 'room-floor' || target.kind === 'room-ceiling')) {
    const type = p.rooms[target.roomId]?.type;
    return Object.values(p.rooms)
      .filter((r) => r.type === type)
      .map((r): MaterialTarget => ({ kind: target.kind, roomId: r.id }));
  }
  return [target];
}

export function assignMaterial(
  d: D,
  targets: MaterialTarget[],
  materialId: string,
): void {
  ensureMaterial(d, materialId);
  for (const t of targets) setTarget(d, t, materialId);
}

export function updateMaterial(d: D, id: string, patch: Partial<Omit<MaterialDefinition, 'id'>>): void {
  ensureMaterial(d, id);
  const m = d.materials[id];
  if (!m) return;
  if (patch.texture !== undefined) m.texture = patch.texture ? { ...patch.texture } : null;
  if (patch.photo !== undefined) m.photo = patch.photo ? { ...patch.photo } : null;
  const { texture: _t, photo: _p, ...rest } = patch;
  Object.assign(m, rest);
}

/** Creates an independent copy of a material. */
export function duplicateMaterial(d: D, id: string, opts: { name?: string; overrideOf?: string | null } = {}): string | null {
  const src = d.materials[id] ?? MATERIAL_CATALOG_BY_ID[id];
  if (!src) return null;
  const nid = newId('mat');
  const base = snap(src);
  d.materials[nid] = {
    ...structuredClone(base),
    id: nid,
    name: opts.name ?? `${src.name} copy`,
    overrideOf: opts.overrideOf ?? null,
    catalogId: null,
  };
  return nid;
}

/** Unlinks a single target from its shared material by giving it a private override copy. */
export function createOverride(d: D, target: MaterialTarget, sourceId: string): string | null {
  const src = d.materials[sourceId] ?? MATERIAL_CATALOG_BY_ID[sourceId];
  if (!src) return null;
  const nid = duplicateMaterial(d, sourceId, { name: `${src.name} (override)`, overrideOf: sourceId });
  if (!nid) return null;
  setTarget(d, target, nid);
  return nid;
}

/** Deletes a material, reassigning every reference to `replacementId`. */
export function deleteMaterial(d: D, id: string, replacementId: string): void {
  if (id === replacementId) return;
  ensureMaterial(d, replacementId);
  for (const t of materialUsage(plain(d), id)) setTarget(d, t, replacementId);
  for (const m of Object.values(d.materials)) if (m.overrideOf === id) m.overrideOf = null;
  delete d.materials[id];
}

// ───────────────────────── Cameras & settings ─────────────────────────

export function addCameraPreset(d: D, preset: Omit<CameraPreset, 'id'>): string {
  const id = newId('cam');
  d.cameras.push({ ...preset, id });
  return id;
}

export function updateCameraPreset(d: D, id: string, patch: Partial<Omit<CameraPreset, 'id'>>): void {
  const c = d.cameras.find((x) => x.id === id);
  if (c) Object.assign(c, patch);
}

export function deleteCameraPreset(d: D, id: string): void {
  const i = d.cameras.findIndex((x) => x.id === id);
  if (i >= 0) d.cameras.splice(i, 1);
  if (d.guest.startCameraId === id) d.guest.startCameraId = null;
}

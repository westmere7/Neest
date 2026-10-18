import type { CustomAsset, MaterialDefinition, PlacedObject, Project, Vec2 } from '@/domain/model/schema';
import { convexHull } from '@/domain/geometry/polygon';
import { FALLBACK_MATERIAL, MATERIAL_CATALOG_BY_ID } from '../materials/catalog';
import { ASSETS_BY_ID } from './catalog';
import type { AssetDefinition, Part, PlanStroke, Size3 } from './types';
import { dropPackKeys, subscribePacks } from '@/packs/events';
import { slotDefaultMaterial, withModel } from './models';

/** Asset lookup across the built-in catalogue and the project's imported models. */
export function getAsset(project: Pick<Project, 'customAssets'> | null, assetId: string): AssetDefinition | null {
  const builtIn = ASSETS_BY_ID[assetId];
  if (builtIn) return builtIn;
  const custom = project?.customAssets[assetId];
  if (custom) return customAssetDefinition(custom);
  return extraResolver?.(assetId) ?? null;
}

/** The asset a placed item shows: its asset in the item's model variant (see ./models). */
export function getObjectAsset(project: Pick<Project, 'customAssets'> | null, obj: Pick<PlacedObject, 'assetId' | 'model'>): AssetDefinition | null {
  return withModel(getAsset(project, obj.assetId), obj.model);
}

/** Extra asset source installed by the app (saved groups as library items: `savedgroup:<id>`). */
let extraResolver: ((assetId: string) => AssetDefinition | null) | null = null;
export function setAssetResolver(fn: (assetId: string) => AssetDefinition | null): void {
  extraResolver = fn;
}

const customCache = new Map<string, { src: CustomAsset; def: AssetDefinition }>();

/** Adapts an imported model to the asset contract (its 3D comes from the stored GLB). */
export function customAssetDefinition(c: CustomAsset): AssetDefinition {
  const cached = customCache.get(c.id);
  if (cached && cached.src === c) return cached.def;
  const def: AssetDefinition = {
    id: c.id,
    name: c.name,
    category: 'custom',
    type: 'misc',
    group: 'Imported models',
    tags: ['imported', c.fileName],
    defaultSize: { ...c.size },
    minSize: { w: 0.02, d: 0.02, h: 0.02 },
    maxSize: { w: 30, d: 30, h: 12 },
    resizable: { w: true, d: true, h: true },
    mount: 'floor',
    defaultElevation: 0,
    slots: [],
    build: () => [],
    source: { name: c.fileName, license: c.license ?? 'User-imported (licence not specified)' },
  };
  customCache.set(c.id, { src: c, def });
  return def;
}

export function isCustomAsset(project: Pick<Project, 'customAssets'>, assetId: string): boolean {
  return !ASSETS_BY_ID[assetId] && !!project.customAssets[assetId];
}

// ───────────── Materials ─────────────

/** Resolves a material id from the project, then the catalogue, then a visible fallback. */
export function resolveMaterial(project: Pick<Project, 'materials'> | null, id: string | null | undefined): MaterialDefinition {
  if (!id) return FALLBACK_MATERIAL;
  return project?.materials[id] ?? MATERIAL_CATALOG_BY_ID[id] ?? FALLBACK_MATERIAL;
}

export function objectSlotMaterialId(obj: PlacedObject, asset: AssetDefinition | null, slot: string): string {
  return obj.materials[slot] ?? slotDefaultMaterial(asset, slot) ?? FALLBACK_MATERIAL.id;
}

export function assetSlotDefault(assetId: string, slot: string): string | undefined {
  return slotDefaultMaterial(ASSETS_BY_ID[assetId], slot);
}

// ───────────── Plan footprints ─────────────

export interface PlanShape {
  points: Vec2[];
  slot: string;
  top: number;
}

export interface AssetPlan {
  shapes: PlanShape[];
  strokes: PlanStroke[];
}

type M3 = [number, number, number, number, number, number, number, number, number];

/** Rotation matrix for three.js Euler 'XYZ' order (M = Rx · Ry · Rz). */
function eulerMatrix(r: [number, number, number] | undefined): M3 {
  if (!r) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const [x, y, z] = r;
  const a = Math.cos(x),
    b = Math.sin(x),
    c = Math.cos(y),
    d = Math.sin(y),
    e = Math.cos(z),
    f = Math.sin(z);
  const ae = a * e,
    af = a * f,
    be = b * e,
    bf = b * f;
  return [c * e, -c * f, d, af + be * d, ae - bf * d, -b * c, bf - ae * d, be + af * d, a * c];
}

function ring(r: number, y: number, n = 16): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    out.push([Math.cos(t) * r, y, Math.sin(t) * r]);
  }
  return out;
}

/** Local sample points of a part shape (before scale/rotation/translation). */
function shapeSamples(part: Part): [number, number, number][] {
  switch (part.shape) {
    case 'box': {
      const [sx, sy, sz] = part.size.map((v) => v / 2) as [number, number, number];
      const pts: [number, number, number][] = [];
      for (const x of [-sx, sx]) for (const y of [-sy, sy]) for (const z of [-sz, sz]) pts.push([x, y, z]);
      return pts;
    }
    case 'cylinder':
      return [...ring(part.radiusBottom, -part.height / 2), ...ring(part.radiusTop, part.height / 2)];
    case 'sphere': {
      const r = part.radius;
      const pts = ring(r, 0);
      for (let i = 0; i < 16; i++) {
        const t = (i / 16) * Math.PI * 2;
        pts.push([Math.cos(t) * r, Math.sin(t) * r, 0], [0, Math.sin(t) * r, Math.cos(t) * r]);
      }
      return pts;
    }
    case 'torus': {
      const R = part.radius + part.tube;
      const pts: [number, number, number][] = [];
      for (let i = 0; i < 16; i++) {
        const t = (i / 16) * Math.PI * 2;
        pts.push([Math.cos(t) * R, Math.sin(t) * R, part.tube], [Math.cos(t) * R, Math.sin(t) * R, -part.tube]);
      }
      return pts;
    }
    case 'lathe':
      return part.profile.flatMap(([r, y]) => ring(Math.max(0, r), y));
    case 'prism':
      return part.outline.flatMap(([x, z]) => [
        [x, 0, z] as [number, number, number],
        [x, part.height, z] as [number, number, number],
      ]);
  }
}

/** Projects a part to the floor plane: convex hull of its top-down silhouette and its top height. */
export function partFootprint(part: Part): PlanShape {
  const m = eulerMatrix(part.rotation);
  const s = part.scale ?? [1, 1, 1];
  const [px, py, pz] = part.position;
  let top = -Infinity;
  const pts: Vec2[] = [];
  for (const [x0, y0, z0] of shapeSamples(part)) {
    const x = x0 * s[0];
    const y = y0 * s[1];
    const z = z0 * s[2];
    const rx = m[0] * x + m[1] * y + m[2] * z;
    const ry = m[3] * x + m[4] * y + m[5] * z;
    const rz = m[6] * x + m[7] * y + m[8] * z;
    top = Math.max(top, ry + py);
    pts.push({ x: rx + px, y: rz + pz });
  }
  return { points: convexHull(pts), slot: part.slot, top };
}

const planCache = new Map<string, AssetPlan>();
subscribePacks(() => dropPackKeys(planCache));

/** Derived 2D plan symbol for an asset at a given size (cached). Local coords: x = width, y = depth (front +y). */
export function assetPlan(asset: AssetDefinition, size: Size3, custom?: CustomAsset): AssetPlan {
  const key = `${asset.id}|${size.w.toFixed(4)}|${size.d.toFixed(4)}|${size.h.toFixed(4)}|${custom?.footprint.length ?? 0}`;
  const hit = planCache.get(key);
  if (hit) return hit;
  let plan: AssetPlan;
  if (custom) {
    const hull = custom.footprint.length >= 3
      ? custom.footprint.map((p) => ({ x: p.x * size.w, y: p.y * size.d }))
      : [
          { x: -size.w / 2, y: -size.d / 2 },
          { x: size.w / 2, y: -size.d / 2 },
          { x: size.w / 2, y: size.d / 2 },
          { x: -size.w / 2, y: size.d / 2 },
        ];
    plan = { shapes: [{ points: hull, slot: 'model', top: size.h }], strokes: [] };
  } else {
    const parts = asset.build(size).filter((p) => p.plan !== false);
    const shapes = parts
      .map(partFootprint)
      .filter((s) => s.points.length >= 3)
      .sort((a, b) => a.top - b.top);
    plan = { shapes, strokes: asset.planDetail?.(size) ?? [] };
  }
  // Big enough for the whole library plus a project's sizes: when it fills up it is cleared, and an
  // open library would then rebuild every card's item on each render.
  if (planCache.size > 5000) planCache.clear();
  planCache.set(key, plan);
  return plan;
}

export const objectSize = (o: PlacedObject): Size3 => ({ w: o.width, d: o.depth, h: o.height });

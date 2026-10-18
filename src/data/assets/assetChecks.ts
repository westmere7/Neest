import { describe, expect, it } from 'vitest';
import { MATERIAL_CATALOG_BY_ID } from '@/data/materials/catalog';
import { ASSET_GROUPS, ASSET_TYPE_ORDER } from './catalog';
import type { AssetDefinition, Part, PlanStroke, Size3 } from './types';
import { assetModels, withModel } from './models';

/**
 * Per-asset validation shared by catalog.test.ts (whole catalogue) and any focused test of a
 * single module. Not imported by the app.
 */

type Vec3 = [number, number, number];
export interface Bounds {
  min: Vec3;
  max: Vec3;
}

/** Allowed overshoot of a part beyond the asset bounding box (metres). */
export const TOL = 0.02;
export const CEILING = 2.7;
/** Parts per asset. Objects render as one merged mesh per material slot, so detail is cheap. */
export const MAX_PARTS = 160;
/** How far a model's props may rise above the item (a lamp on a sideboard, a vase on a table). */
export const PROPS_ABOVE = 1.0;

/** Rotate by Euler XYZ angles using the three.js convention (R = Rx · Ry · Rz). */
function rotate(v: Vec3, [ax, ay, az]: Vec3): Vec3 {
  let [x, y, z] = v;
  [x, y] = [x * Math.cos(az) - y * Math.sin(az), x * Math.sin(az) + y * Math.cos(az)];
  [x, z] = [x * Math.cos(ay) + z * Math.sin(ay), -x * Math.sin(ay) + z * Math.cos(ay)];
  [y, z] = [y * Math.cos(ax) - z * Math.sin(ax), y * Math.sin(ax) + z * Math.cos(ax)];
  return [x, y, z];
}

/** Bounds of the unscaled, unrotated shape relative to the part position. */
function localBounds(p: Part): Bounds {
  switch (p.shape) {
    case 'box': {
      const [x, y, z] = p.size;
      return { min: [-x / 2, -y / 2, -z / 2], max: [x / 2, y / 2, z / 2] };
    }
    case 'cylinder': {
      const r = Math.max(p.radiusTop, p.radiusBottom);
      return { min: [-r, -p.height / 2, -r], max: [r, p.height / 2, r] };
    }
    case 'sphere':
      return { min: [-p.radius, -p.radius, -p.radius], max: [p.radius, p.radius, p.radius] };
    case 'torus': {
      const r = p.radius + p.tube;
      return { min: [-r, -r, -p.tube], max: [r, r, p.tube] };
    }
    case 'lathe': {
      const r = Math.max(...p.profile.map((q) => q[0]));
      const ys = p.profile.map((q) => q[1]);
      return { min: [-r, Math.min(...ys), -r], max: [r, Math.max(...ys), r] };
    }
    case 'prism': {
      const xs = p.outline.map((q) => q[0]);
      const zs = p.outline.map((q) => q[1]);
      return {
        min: [Math.min(...xs), 0, Math.min(...zs)],
        max: [Math.max(...xs), p.height, Math.max(...zs)],
      };
    }
  }
}

/**
 * Axis-aligned bounds in object space: scale, then rotation (conservatively via the rotated
 * corners of the local box), then translation.
 */
export function worldBounds(p: Part): Bounds {
  const { min, max } = localBounds(p);
  const s = p.scale ?? [1, 1, 1];
  const corners: Vec3[] = [];
  for (const x of [min[0], max[0]]) {
    for (const y of [min[1], max[1]]) {
      for (const z of [min[2], max[2]]) {
        const c: Vec3 = [x * s[0], y * s[1], z * s[2]];
        corners.push(p.rotation ? rotate(c, p.rotation) : c);
      }
    }
  }
  const axis = (i: number, f: (...v: number[]) => number) => f(...corners.map((c) => c[i])) + p.position[i];
  return {
    min: [axis(0, Math.min), axis(1, Math.min), axis(2, Math.min)],
    max: [axis(0, Math.max), axis(1, Math.max), axis(2, Math.max)],
  };
}

function collectNumbers(value: unknown, out: number[] = []): number[] {
  if (typeof value === 'number') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => collectNumbers(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => collectNumbers(v, out));
  return out;
}

function dimensionsValid(p: Part): boolean {
  switch (p.shape) {
    case 'box':
      return (
        p.size.every((v) => v > 0) &&
        (p.bevel === undefined || (p.bevel >= 0 && p.bevel < Math.min(...p.size) / 2))
      );
    case 'cylinder':
      return (
        p.radiusTop >= 0 && p.radiusBottom >= 0 && Math.max(p.radiusTop, p.radiusBottom) > 0 && p.height > 0
      );
    case 'sphere':
      return p.radius > 0;
    case 'torus':
      return p.radius > 0 && p.tube > 0 && p.tube <= p.radius;
    case 'lathe':
      return p.profile.length >= 2 && p.profile.every(([r]) => r >= 0);
    case 'prism':
      return p.outline.length >= 3 && p.height > 0;
  }
}

function strokePoints(s: PlanStroke): [number, number][] {
  switch (s.kind) {
    case 'line':
      return [s.a, s.b];
    case 'circle':
      return [
        [s.c[0] - s.r, s.c[1] - s.r],
        [s.c[0] + s.r, s.c[1] + s.r],
      ];
    case 'poly':
      return s.points;
  }
}

/** Default, min, max and every min/max corner combination of the size range. */
export function sizesFor(a: AssetDefinition): [string, Size3][] {
  const lo = a.minSize ?? a.defaultSize;
  const hi = a.maxSize ?? a.defaultSize;
  const out: [string, Size3][] = [
    ['default', a.defaultSize],
    ['min', lo],
    ['max', hi],
  ];
  for (const w of [lo.w, hi.w]) {
    for (const d of [lo.d, hi.d]) {
      for (const h of [lo.h, hi.h]) out.push([`${w}×${d}×${h}`, { w, d, h }]);
    }
  }
  return out;
}

/** Registers the full per-asset validation suite for `assets`. */
export function describeAssetChecks(assets: AssetDefinition[]): void {
  describe.each(assets.map((a) => [a.id, a] as const))('%s', (_id, asset) => {
    const slotIds = new Set(asset.slots.map((s) => s.id));

    it('has well-formed metadata', () => {
      expect(asset.name.trim()).not.toBe('');
      expect(asset.tags.length).toBeGreaterThan(0);
      if (asset.pack) {
        // Content-pack items: `<pack>:<id>` and the pack named as their source.
        expect(asset.id).toMatch(new RegExp(`^${asset.pack.id}:[a-z0-9]+(-[a-z0-9]+)*$`));
        expect(asset.source.name).toContain(asset.pack.name);
        expect(asset.source.license.trim()).not.toBe('');
      } else {
        expect(asset.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
        expect(asset.source).toEqual({
          name: 'Neest procedural library',
          license: 'Original (procedural, CC0-compatible)',
        });
      }
      expect(['floor', 'wall', 'ceiling']).toContain(asset.mount);
      expect(Number.isFinite(asset.defaultElevation)).toBe(true);
      expect(asset.defaultElevation).toBeGreaterThanOrEqual(0);
      if (asset.mount === 'wall') expect(asset.wallSnap).toBe(true);
      if (asset.mount === 'ceiling') {
        const top = asset.defaultElevation + asset.defaultSize.h;
        expect(top).toBeLessThanOrEqual(CEILING);
        expect(top).toBeGreaterThan(CEILING - 0.05);
      }
      const lo = asset.minSize ?? asset.defaultSize;
      const hi = asset.maxSize ?? asset.defaultSize;
      for (const k of ['w', 'd', 'h'] as const) {
        expect(lo[k]).toBeGreaterThan(0);
        expect(asset.defaultSize[k]).toBeGreaterThanOrEqual(lo[k]);
        expect(asset.defaultSize[k]).toBeLessThanOrEqual(hi[k]);
      }
    });

    it('sits on a known type shelf', () => {
      expect(ASSET_TYPE_ORDER).toContain(asset.type);
      expect(ASSET_GROUPS[asset.type], `group "${asset.group}" for type ${asset.type}`).toContain(asset.group);
    });

    it('declares 1–4 unique material slots backed by catalogue materials', () => {
      expect(asset.slots.length).toBeGreaterThanOrEqual(1);
      // People may also have shoes and outfit-detail slots (6).
      expect(asset.slots.length).toBeLessThanOrEqual(asset.type === 'people' ? 6 : 4);
      expect(slotIds.size).toBe(asset.slots.length);
      for (const s of asset.slots) {
        expect(s.label.trim(), s.id).not.toBe('');
        expect(MATERIAL_CATALOG_BY_ID[s.defaultMaterial], `${s.id} → ${s.defaultMaterial}`).toBeDefined();
      }
    });

    it('has well-formed hand-made variants', () => {
      const ids = new Set<string>();
      for (const v of asset.variants ?? []) {
        expect(v.id, 'variant id').toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
        expect(ids.has(v.id), `duplicate variant ${v.id}`).toBe(false);
        ids.add(v.id);
        expect(v.name.trim(), v.id).not.toBe('');
        expect(Object.keys(v.materials).length, `${v.id} changes no slot`).toBeGreaterThan(0);
        for (const [slot, m] of Object.entries(v.materials)) {
          expect(slotIds.has(slot), `${v.id}: unknown slot ${slot}`).toBe(true);
          expect(MATERIAL_CATALOG_BY_ID[m], `${v.id}: ${slot} → ${m}`).toBeDefined();
        }
      }
    });

    it('emits a light only with an emissive light slot', () => {
      const hasLightSlot = slotIds.has('light');
      if (asset.category === 'lighting') {
        expect(hasLightSlot).toBe(true);
        expect(asset.light).toBeDefined();
      }
      expect(Boolean(asset.light)).toBe(hasLightSlot);
      if (asset.light) {
        const slot = asset.slots.find((s) => s.id === 'light');
        expect(MATERIAL_CATALOG_BY_ID[slot?.defaultMaterial ?? '']?.emissive).toBeTruthy();
        expect(asset.light.y).toBeGreaterThanOrEqual(0);
        expect(asset.light.y).toBeLessThanOrEqual(asset.defaultSize.h);
        expect(asset.light.intensity).toBeGreaterThan(0);
        expect(asset.light.distance).toBeGreaterThan(0);
        expect(asset.light.color).toMatch(/^#[0-9a-f]{6}$/i);
        const L = asset.light;
        expect(['point', 'spot', undefined]).toContain(L.kind);
        if (L.angle !== undefined) expect(L.angle > 0 && L.angle <= Math.PI / 2).toBe(true);
        if (L.penumbra !== undefined) expect(L.penumbra >= 0 && L.penumbra <= 1).toBe(true);
        const { w, d, h } = asset.defaultSize;
        const heads = L.heads?.length ? L.heads : [{ x: L.x, y: L.y, z: L.z, dir: L.dir }];
        for (const head of heads) {
          // Each bulb sits within the item (2 cm tolerance) and a spot has a real direction.
          expect(Math.abs(head.x ?? 0)).toBeLessThanOrEqual(w / 2 + 0.02);
          expect(Math.abs(head.z ?? 0)).toBeLessThanOrEqual(d / 2 + 0.02);
          expect(head.y).toBeGreaterThanOrEqual(-0.02);
          expect(head.y).toBeLessThanOrEqual(h + 0.02);
          const dir = head.dir ?? L.dir;
          if (dir) expect(Math.hypot(...dir)).toBeGreaterThan(0.01);
        }
      }
    });

    it.each(sizesFor(asset))('builds valid geometry at %s', (_label, size) => {
      const parts = asset.build(size);
      expect(parts.length).toBeGreaterThan(0);
      expect(parts.length).toBeLessThanOrEqual(MAX_PARTS);
      expect(parts.some((p) => p.plan !== false)).toBe(true);
      const { w, d, h } = size;
      for (const [i, p] of parts.entries()) {
        const where = `part #${i} (${p.shape}, slot '${p.slot}') at ${size.w}×${size.d}×${size.h}`;
        expect(slotIds.has(p.slot), where).toBe(true);
        expect(collectNumbers(p).every(Number.isFinite), where).toBe(true);
        expect(dimensionsValid(p), where).toBe(true);
        const b = worldBounds(p);
        expect(b.min[0], `${where} x-min`).toBeGreaterThanOrEqual(-w / 2 - TOL);
        expect(b.max[0], `${where} x-max`).toBeLessThanOrEqual(w / 2 + TOL);
        expect(b.min[1], `${where} y-min`).toBeGreaterThanOrEqual(-TOL);
        expect(b.max[1], `${where} y-max`).toBeLessThanOrEqual(h + TOL);
        expect(b.min[2], `${where} z-min`).toBeGreaterThanOrEqual(-d / 2 - TOL);
        expect(b.max[2], `${where} z-max`).toBeLessThanOrEqual(d / 2 + TOL);
      }
      for (const [i, s] of (asset.planDetail?.(size) ?? []).entries()) {
        const where = `plan stroke #${i} (${s.kind}) at ${size.w}×${size.d}×${size.h}`;
        expect(collectNumbers(s).every(Number.isFinite), where).toBe(true);
        for (const [x, z] of strokePoints(s)) {
          expect(Math.abs(x), where).toBeLessThanOrEqual(w / 2 + TOL);
          expect(Math.abs(z), where).toBeLessThanOrEqual(d / 2 + TOL);
        }
      }
    });
    const models = assetModels(asset);
    if (models.length) {
      it('has well-formed model variants', () => {
        const ids = new Set<string>();
        for (const m of models) {
          expect(m.id, 'model id').toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
          expect(m.name.trim(), m.id).not.toBe('');
          expect(ids.has(m.id), `model ${m.id} twice`).toBe(false);
          ids.add(m.id);
          for (const h of m.hide ?? []) expect(slotIds.has(h), `model ${m.id} hides unknown slot ${h}`).toBe(true);
          for (const sl of m.slots ?? []) expect(MATERIAL_CATALOG_BY_ID[sl.defaultMaterial], `${m.id}: ${sl.id} → ${sl.defaultMaterial}`).toBeDefined();
        }
      });

      it.each(models.flatMap((m) => sizesFor(asset).map(([label, size]) => [m.id, label, size] as const)))(
        'model %s keeps the outline and size at %s',
        (modelId, _label, size) => {
          const look = withModel(asset, modelId);
          const parts = look.build(size);
          const lookSlots = new Set(look.slots.map((s) => s.id));
          expect(parts.length).toBeGreaterThan(0);
          expect(parts.length).toBeLessThanOrEqual(MAX_PARTS * 2);
          // The plan outline only ever comes from the item's own parts, never from props.
          const outline = (ps: Part[]) => ps.filter((p) => p.plan !== false).map((p) => JSON.stringify(p));
          const own = new Set(outline(asset.build(size)));
          const shown = outline(parts);
          expect(shown.length, 'some part is in the plan').toBeGreaterThan(0);
          for (const p of shown) expect(own.has(p), `plan part not from the item: ${p.slice(0, 80)}`).toBe(true);
          const { w, d, h } = size;
          for (const [i, p] of parts.entries()) {
            const where = `model ${modelId} part #${i} (${p.shape}, slot '${p.slot}') at ${w}×${d}×${h}`;
            expect(lookSlots.has(p.slot), where).toBe(true);
            expect(collectNumbers(p).every(Number.isFinite), where).toBe(true);
            expect(dimensionsValid(p), where).toBe(true);
            const b = worldBounds(p);
            expect(b.min[0], `${where} x-min`).toBeGreaterThanOrEqual(-w / 2 - TOL);
            expect(b.max[0], `${where} x-max`).toBeLessThanOrEqual(w / 2 + TOL);
            expect(b.min[2], `${where} z-min`).toBeGreaterThanOrEqual(-d / 2 - TOL);
            expect(b.max[2], `${where} z-max`).toBeLessThanOrEqual(d / 2 + TOL);
            expect(b.min[1], `${where} y-min`).toBeGreaterThanOrEqual(-TOL);
            expect(b.max[1], `${where} y-max`).toBeLessThanOrEqual(h + PROPS_ABOVE);
          }
        },
      );
    }
  });
}

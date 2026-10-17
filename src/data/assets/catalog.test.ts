import { MATERIAL_CATALOG_BY_ID } from '@/data/materials/catalog';
import { ASSET_CATALOG, ASSET_CATEGORY_LABELS, ASSET_CATEGORY_ORDER, ASSETS_BY_ID } from './catalog';
import type { AssetCategory, AssetDefinition, Part, PlanStroke, Size3 } from './types';

type Vec3 = [number, number, number];
interface Bounds {
  min: Vec3;
  max: Vec3;
}

/** Allowed overshoot of a part beyond the asset bounding box (metres). */
const TOL = 0.02;
const CEILING = 2.7;
const MAX_PARTS = 40;

const MIN_PER_CATEGORY: Record<Exclude<AssetCategory, 'custom'>, number> = {
  construction: 4,
  living: 8,
  bedroom: 7,
  dining: 5,
  kitchen: 8,
  bathroom: 6,
  office: 4,
  storage: 3,
  lighting: 5,
  decor: 7,
  electronics: 4,
  generic: 2,
};

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
function worldBounds(p: Part): Bounds {
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
function sizesFor(a: AssetDefinition): [string, Size3][] {
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

describe('asset catalogue', () => {
  it('has at least 48 assets with unique ids', () => {
    expect(ASSET_CATALOG.length).toBeGreaterThanOrEqual(48);
    const ids = ASSET_CATALOG.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('indexes every asset by id', () => {
    expect(Object.keys(ASSETS_BY_ID)).toHaveLength(ASSET_CATALOG.length);
    for (const a of ASSET_CATALOG) expect(ASSETS_BY_ID[a.id]).toBe(a);
  });

  it.each(Object.entries(MIN_PER_CATEGORY))(
    'has at least the minimum number of %s assets',
    (category, min) => {
      expect(ASSET_CATALOG.filter((a) => a.category === category).length).toBeGreaterThanOrEqual(min);
    },
  );

  it('labels every category and orders all but custom', () => {
    const categories = Object.keys(MIN_PER_CATEGORY) as AssetCategory[];
    for (const c of [...categories, 'custom' as const]) expect(ASSET_CATEGORY_LABELS[c]).toBeTruthy();
    expect(ASSET_CATEGORY_LABELS.custom).toBe('Imported models');
    expect(ASSET_CATEGORY_ORDER).not.toContain('custom');
    expect([...ASSET_CATEGORY_ORDER].sort()).toEqual([...categories].sort());
    for (const a of ASSET_CATALOG) expect(ASSET_CATEGORY_ORDER).toContain(a.category);
  });

  it('has no duplicate names', () => {
    const names = ASSET_CATALOG.map((a) => a.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });
});

describe.each(ASSET_CATALOG.map((a) => [a.id, a] as const))('%s', (_id, asset) => {
  const slotIds = new Set(asset.slots.map((s) => s.id));

  it('has well-formed metadata', () => {
    expect(asset.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(asset.name.trim()).not.toBe('');
    expect(asset.tags.length).toBeGreaterThan(0);
    expect(asset.source).toEqual({
      name: 'Neest procedural library',
      license: 'Original (procedural, CC0-compatible)',
    });
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

  it('declares 1–4 unique material slots backed by catalogue materials', () => {
    expect(asset.slots.length).toBeGreaterThanOrEqual(1);
    expect(asset.slots.length).toBeLessThanOrEqual(4);
    expect(slotIds.size).toBe(asset.slots.length);
    for (const s of asset.slots) {
      expect(s.label.trim(), s.id).not.toBe('');
      expect(MATERIAL_CATALOG_BY_ID[s.defaultMaterial], `${s.id} → ${s.defaultMaterial}`).toBeDefined();
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
});

describe('parametric behaviour', () => {
  const countSlot = (parts: Part[], slot: string) => parts.filter((p) => p.slot === slot).length;

  it('beds use one pillow below 1.2 m wide and two above', () => {
    for (const id of ['bed-single', 'bed-double', 'bed-queen', 'bed-king']) {
      const bed = ASSETS_BY_ID[id];
      const narrow = bed.build({ ...bed.defaultSize, w: 1.0 });
      const wide = bed.build({ ...bed.defaultSize, w: 1.6 });
      expect(countSlot(wide, 'bedding') - countSlot(narrow, 'bedding')).toBe(1);
      expect(bed.planDetail?.(bed.defaultSize).length).toBeGreaterThan(0);
    }
  });

  it('sofas keep a fixed arm width and stretch the seat', () => {
    const sofa = ASSETS_BY_ID['sofa-3-seat'];
    const armWidth = (w: number) => {
      const parts = sofa.build({ ...sofa.defaultSize, w });
      const arms = parts
        .map(worldBounds)
        .filter((b) => Math.abs(b.min[0] + w / 2) < 1e-6 && b.max[0] - b.min[0] < w / 2);
      expect(arms.length).toBeGreaterThan(0);
      return arms[0].max[0] - arms[0].min[0];
    };
    expect(armWidth(1.6)).toBeCloseTo(armWidth(3.2), 6);
    const seats = (w: number) => countSlot(sofa.build({ ...sofa.defaultSize, w }), 'upholstery');
    expect(seats(3.2)).toBeGreaterThan(seats(1.6));
  });

  it('table legs stay in the corners when resized', () => {
    const table = ASSETS_BY_ID['dining-table-rect'];
    for (const w of [0.8, 3.0]) {
      const legs = table
        .build({ ...table.defaultSize, w })
        .filter((p) => p.slot === 'legs' && p.shape === 'box' && p.plan === false)
        .map(worldBounds)
        .filter((b) => b.min[1] === 0);
      expect(legs).toHaveLength(4);
      for (const b of legs)
        expect(Math.max(Math.abs(b.min[0]), Math.abs(b.max[0]))).toBeCloseTo(w / 2 - 0.05, 6);
    }
  });

  it('wall cabinets hang at worktop splashback height', () => {
    const wall = ASSETS_BY_ID['kitchen-wall-cabinet'];
    expect(wall.mount).toBe('wall');
    expect(wall.defaultElevation).toBeCloseTo(1.45, 2);
  });
});

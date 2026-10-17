import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { produce } from 'immer';
import { createEmptyProject, OPENING_PRESETS } from '@/domain/model/defaults';
import type { Opening, OpeningKind, Project } from '@/domain/model/schema';
import { isPassageKind, isWindowKind, OpeningKindSchema } from '@/domain/model/schema';
import { designsForKind } from '@/domain/model/openingDesigns';
import { addWallChain } from '@/domain/commands/walls';
import { addOpening } from '@/domain/commands/entities';
import { computeWallNetwork } from '@/domain/geometry/walls';
import { buildOpening, infillOutlines, openingShape } from './openingBuilder';
import type { MaterialRegistry } from './materialRegistry';

const KINDS = OpeningKindSchema.options as OpeningKind[];
const T = 0.2;

/** Registry stub: one named material per id (jsdom has no canvas for real textures). */
function fakeRegistry(): MaterialRegistry {
  const mats = new Map<string, THREE.Material>();
  return {
    get: (_p: unknown, id: string | null | undefined) => {
      const key = id ?? '';
      let m = mats.get(key);
      if (!m) {
        m = new THREE.MeshStandardMaterial({ name: key });
        mats.set(key, m);
      }
      return m;
    },
  } as unknown as MaterialRegistry;
}

/** One 8 m wall along +x (start at the origin) with a single opening at its middle. */
function setup(kind: OpeningKind, patch: Partial<Opening> = {}, size?: { width: number; height: number }) {
  let id = '';
  const project = produce(createEmptyProject(), (d) => {
    const [wallId] = addWallChain(d, [{ x: 0, y: 0 }, { x: 8, y: 0 }], { thickness: T, height: 2.7, role: 'interior' });
    d.walls[wallId].materials = { left: 'wall-left', right: 'wall-right', top: 'wall-top' };
    id = addOpening(d, { wallId, kind, offset: 4, width: size?.width, height: size?.height })!;
    Object.assign(d.openings[id], { panelMaterialId: 'test-panel', frameMaterialId: 'test-frame' }, patch);
  });
  const o = project.openings[id];
  const g = computeWallNetwork(project).walls.get(o.wallId)!;
  const span = g.spans.find((s) => s.id === id)!;
  return { project, o, g, span };
}

function build(project: Project, o: Opening, g: ReturnType<typeof setup>['g'], span: ReturnType<typeof setup>['span']) {
  const group = buildOpening(o, g, span, { project, registry: fakeRegistry(), shadows: false });
  group.updateMatrixWorld(true);
  return group;
}

function meshes(group: THREE.Object3D, pred: (m: THREE.Mesh) => boolean = () => true): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && pred(m)) out.push(m);
  });
  return out;
}

const matName = (m: THREE.Mesh) => (Array.isArray(m.material) ? m.material.map((x) => x.name).join(',') : m.material.name);

/** World-space bounds of meshes (the wall runs along +x from the origin, so world z = local z). */
function bounds(list: THREE.Mesh[]): THREE.Box3 {
  const b = new THREE.Box3();
  for (const m of list) b.union(new THREE.Box3().setFromObject(m));
  return b;
}

const ALL_OPTIONS: Partial<Opening> = { transom: true, grille: 'bars', shutters: true, casing: true, threshold: true };

describe('buildOpening', () => {
  const sizes: ({ width: number; height: number } | undefined)[] = [undefined, { width: 0.6, height: 0.6 }, { width: 2.4, height: 2.5 }];
  for (const kind of KINDS) {
    it(`builds ${kind} at several sizes, with and without options`, () => {
      for (const size of sizes) {
        for (const patch of [{}, ALL_OPTIONS, { ...ALL_OPTIONS, grille: 'grid' as const }, { openAngle: 45, hinge: 'end' as const, swingSide: 'right' as const }, { openAngle: 90 }]) {
          const { project, o, g, span } = setup(kind, patch, size);
          const group = build(project, o, g, span);
          expect(group.userData).toEqual({ kind: 'opening', id: o.id });
          const list = meshes(group);
          expect(list.length).toBeGreaterThan(2);
          const b = bounds(list);
          for (const v of [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z]) expect(Number.isFinite(v)).toBe(true);
          // Nothing pokes far above the wall or below the floor.
          expect(b.min.y).toBeGreaterThan(-0.08);
          expect(b.max.y).toBeLessThan(2.7 + 0.25);
        }
      }
    });
  }

  it('fills the moon gate corners with spandrel infill in the wall materials', () => {
    const { project, o, g, span } = setup('passage-moon');
    const group = build(project, o, g, span);
    const infill = meshes(group, (m) => m.name === 'opening-infill');
    expect(infill).toHaveLength(4);
    for (const m of infill) expect(matName(m)).toBe('wall-left,wall-right,wall-top');
    // Infill spans the full wall thickness and stays inside the rectangular gap.
    const b = bounds(infill);
    expect(b.max.z - b.min.z).toBeCloseTo(T, 5);
    expect(b.min.x).toBeGreaterThanOrEqual(span.s0 - 1e-6);
    expect(b.max.x).toBeLessThanOrEqual(span.s1 + 1e-6);
    expect(b.min.y).toBeGreaterThanOrEqual(span.sill - 1e-6);
    expect(b.max.y).toBeLessThanOrEqual(span.head + 1e-6);
    // The round hole itself stays open: no infill vertex lies inside the circle.
    const shape = openingShape('passage-moon', span.s1 - span.s0, span.sill, span.head);
    if (shape.kind !== 'circle') throw new Error('expected a circle');
    for (const outline of infillOutlines(shape, span.s1 - span.s0, span.head)) {
      for (const [x, y] of outline) expect(Math.hypot(x, y - shape.cy)).toBeGreaterThanOrEqual(shape.r - 1e-6);
    }
  });

  it('gives arched kinds two spandrels and rectangular kinds none', () => {
    for (const kind of ['passage-arched', 'window-arched'] as const) {
      const { project, o, g, span } = setup(kind);
      expect(meshes(build(project, o, g, span), (m) => m.name === 'opening-infill')).toHaveLength(2);
    }
    for (const kind of KINDS.filter((k) => !/arched|moon|round/.test(k))) {
      const { project, o, g, span } = setup(kind);
      expect(meshes(build(project, o, g, span), (m) => m.name === 'opening-infill')).toHaveLength(0);
    }
    const { project, o, g, span } = setup('window-round');
    expect(meshes(build(project, o, g, span), (m) => m.name === 'opening-infill')).toHaveLength(4);
  });

  it('hides a fully open pocket door inside the wall', () => {
    for (const hinge of ['start', 'end'] as const) {
      const { project, o, g, span } = setup('door-pocket', { openAngle: 90, hinge });
      const leaf = bounds(meshes(build(project, o, g, span), (m) => matName(m) === 'test-panel'));
      if (hinge === 'start') expect(leaf.max.x).toBeLessThanOrEqual(span.s0 + 0.05 + 1e-6);
      else expect(leaf.min.x).toBeGreaterThanOrEqual(span.s1 - 0.05 - 1e-6);
      expect(leaf.max.z - leaf.min.z).toBeLessThan(T);
    }
    // Closed: the leaf fills the opening.
    const { project, o, g, span } = setup('door-pocket', { openAngle: 0 });
    const leaf = bounds(meshes(build(project, o, g, span), (m) => matName(m) === 'test-panel'));
    expect(leaf.max.x - leaf.min.x).toBeCloseTo(span.s1 - span.s0 - 0.1, 5);
  });

  it('hangs the barn door on the swing face, with a rail wider than the opening', () => {
    for (const swingSide of ['left', 'right'] as const) {
      const { project, o, g, span } = setup('door-barn', { swingSide, style: 'flush' });
      const group = build(project, o, g, span);
      const leaf = bounds(meshes(group, (m) => matName(m) === 'test-panel'));
      // Local +z is the wall's right side; world z = local z for a wall along +x.
      if (swingSide === 'right') expect(leaf.min.z).toBeGreaterThan(T / 2);
      else expect(leaf.max.z).toBeLessThan(-T / 2);
      expect(leaf.max.x - leaf.min.x).toBeGreaterThan(span.s1 - span.s0);
      const metal = bounds(meshes(group, (m) => matName(m) === 'metal-brushed-steel'));
      expect(metal.max.x - metal.min.x).toBeGreaterThan(2 * (span.s1 - span.s0));
    }
  });

  it('uses 4 bi-fold panels from 1.2 m wide, 2 below', () => {
    const count = (width: number) => {
      const { project, o, g, span } = setup('door-bifold', { style: 'flush' }, { width, height: 2.1 });
      return meshes(build(project, o, g, span), (m) => matName(m) === 'test-panel').length;
    };
    expect(count(1.4)).toBe(4);
    expect(count(1.2)).toBe(4);
    expect(count(0.9)).toBe(2);
  });

  it('adds a glazed transom to doors and shortens the leaf', () => {
    const plain = setup('door-single', { style: 'flush' });
    const withT = setup('door-single', { style: 'flush', transom: true });
    const g0 = build(plain.project, plain.o, plain.g, plain.span);
    const g1 = build(withT.project, withT.o, withT.g, withT.span);
    expect(meshes(g0, (m) => matName(m) === 'glass-clear')).toHaveLength(0);
    expect(meshes(g1, (m) => matName(m) === 'glass-clear')).toHaveLength(1);
    const h0 = bounds(meshes(g0, (m) => matName(m) === 'test-panel'));
    const h1 = bounds(meshes(g1, (m) => matName(m) === 'test-panel'));
    expect(h1.max.y).toBeLessThan(h0.max.y - 0.2);
  });

  it('puts shutters and bars on the exterior face (the swing side: sashes open outward)', () => {
    const { project, o, g, span } = setup('window-single', { swingSide: 'left', shutters: true, grille: 'bars' });
    const group = build(project, o, g, span);
    const shutters: THREE.Mesh[] = [];
    group.traverse((x) => {
      if (x.name === 'opening-shutter') shutters.push(...meshes(x));
    });
    expect(shutters.length).toBeGreaterThan(10);
    const b = bounds(shutters);
    // swingSide left → swing (exterior) is local -z; the interior sill board is on +z.
    expect(b.max.z).toBeLessThan(-T / 2);
    // Shown open beside the window, not over it.
    const sb = shutters.map((m) => new THREE.Box3().setFromObject(m));
    for (const box of sb) expect(box.max.x <= span.s0 + 1e-6 || box.min.x >= span.s1 - 1e-6).toBe(true);
    const bars = bounds(meshes(group, (m) => matName(m) === 'metal-brushed-steel'));
    expect(bars.max.z).toBeLessThan(-T / 2 + 1e-6);
  });

  it('adds casing on both faces of every shape', () => {
    for (const kind of ['door-single', 'window-arched', 'passage-moon'] as OpeningKind[]) {
      const base = setup(kind);
      const cased = setup(kind, { casing: true });
      const f0 = meshes(build(base.project, base.o, base.g, base.span), (m) => matName(m) === 'test-frame');
      const f1 = meshes(build(cased.project, cased.o, cased.g, cased.span), (m) => matName(m) === 'test-frame');
      // Trim pieces sit just proud of each face (centre within 2 cm of it).
      const onFace = (list: THREE.Mesh[], sz: number) =>
        list.filter((m) => {
          const z = new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3()).z * sz;
          return z > T / 2 && z < T / 2 + 0.02;
        }).length;
      for (const sz of [-1, 1]) expect(onFace(f1, sz)).toBeGreaterThan(onFace(f0, sz) + 2);
      expect(bounds(f1).max.x - bounds(f1).min.x).toBeGreaterThan(bounds(f0).max.x - bounds(f0).min.x + 0.05);
    }
  });

  it('every preset kind is a window or a door/passage', () => {
    for (const kind of KINDS) expect(OPENING_PRESETS[kind].kind).toBe(kind);
    expect(KINDS.filter(isWindowKind)).toHaveLength(7);
  });
});

describe('buildOpening designs', () => {
  const tol = 0.004;
  const sizes: ({ width: number; height: number } | undefined)[] = [undefined, { width: 0.6, height: 0.7 }, { width: 2.2, height: 2.4 }];
  const isMetal = (m: THREE.Mesh) => matName(m) === 'metal-brushed-steel';

  for (const kind of KINDS.filter((k) => !isPassageKind(k))) {
    it(`keeps every ${kind} design inside the opening`, () => {
      const designs = designsForKind(kind);
      expect(designs.length).toBeGreaterThan(4);
      for (const d of designs) {
        for (const size of sizes) {
          for (const patch of [{}, { hinge: 'end' as const, swingSide: 'right' as const, casing: false }]) {
            const { project, o, g, span } = setup(kind, { design: d.id, ...patch }, size);
            const group = build(project, o, g, span);
            const list = meshes(group);
            expect(list.length).toBeGreaterThan(2);
            const shape = openingShape(kind, span.s1 - span.s0, span.sill, span.head);
            for (const m of list) {
              const b = new THREE.Box3().setFromObject(m, true);
              for (const v of [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z]) expect(Number.isFinite(v)).toBe(true);
              // Handles and hardware stand proud of the wall; the barn leaf hangs on the face; the sill board sits under the window.
              if (kind === 'door-barn' || isMetal(m) || m.name === 'opening-infill') continue;
              if (isWindowKind(kind) && b.max.y <= span.sill + 1e-6) continue;
              const where = `${kind} / ${d.id} / ${size ? `${size.width}×${size.height}` : 'preset'}`;
              expect(b.min.x, where).toBeGreaterThanOrEqual(span.s0 - tol);
              expect(b.max.x, where).toBeLessThanOrEqual(span.s1 + tol);
              expect(b.min.y, where).toBeGreaterThanOrEqual(span.sill - tol);
              expect(b.max.y, where).toBeLessThanOrEqual(span.head + tol);
              // Door frames stand 1 cm proud of each face.
              expect(b.min.z, where).toBeGreaterThanOrEqual(-T / 2 - 0.01 - tol);
              expect(b.max.z, where).toBeLessThanOrEqual(T / 2 + 0.01 + tol);
              if (shape.kind === 'rect') continue;
              // Arched and round holes: every vertex stays inside the curved outline.
              const pos = m.geometry.getAttribute('position');
              const v = new THREE.Vector3();
              for (let i = 0; i < pos.count; i++) {
                v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
                const x = v.x - span.center;
                if (shape.kind === 'circle') expect(Math.hypot(x, v.y - shape.cy), where).toBeLessThanOrEqual(shape.r + tol);
                else if (v.y > shape.ys) {
                  const u = Math.min(1, Math.abs(x) / shape.a);
                  expect(v.y, where).toBeLessThanOrEqual(shape.ys + shape.b * Math.sqrt(1 - u * u) + tol + 0.002);
                }
              }
            }
          }
        }
      }
    });
  }

  it('hangs every barn design on the swing face, clear of the wall', () => {
    for (const d of designsForKind('door-barn')) {
      const { project, o, g, span } = setup('door-barn', { design: d.id, swingSide: 'right' });
      const leaf = bounds(meshes(build(project, o, g, span), (m) => !isMetal(m) && /test-panel|glass/.test(matName(m))));
      expect(leaf.min.z, d.id).toBeGreaterThan(T / 2);
      expect(leaf.max.x - leaf.min.x).toBeGreaterThan(span.s1 - span.s0);
    }
  });

  /** A coarse fingerprint of the built parts: material plus rounded local size of every mesh. */
  const fingerprint = (group: THREE.Object3D) =>
    meshes(group)
      .map((m) => {
        const s = new THREE.Box3().setFromObject(m, true).getSize(new THREE.Vector3());
        return `${matName(m)}:${[s.x, s.y, s.z].map((n) => Math.round(n * 1000)).join('x')}`;
      })
      .sort()
      .join('|');

  it('renders each design differently, with real glass where it is glazed', () => {
    for (const kind of ['door-single', 'door-sliding', 'window-double', 'window-fixed'] as OpeningKind[]) {
      const seen = new Map<string, string>();
      for (const d of designsForKind(kind)) {
        const { project, o, g, span } = setup(kind, { design: d.id });
        const group = build(project, o, g, span);
        const fp = fingerprint(group);
        expect(seen.get(fp), `${kind}: ${d.id} looks like ${seen.get(fp)}`).toBeUndefined();
        seen.set(fp, d.id);
        const glass = meshes(group, (m) => /^glass-/.test(matName(m)) || (isWindowKind(kind) && matName(m) === 'test-panel'));
        if (d.style === 'glazed') expect(glass.length, `${kind}: ${d.id}`).toBeGreaterThan(0);
        else expect(glass.length, `${kind}: ${d.id}`).toBe(0);
      }
    }
  });

  it('uses frosted and reeded glass materials for those designs', () => {
    const names = (kind: OpeningKind, design: Opening['design']) => {
      const { project, o, g, span } = setup(kind, { design });
      return new Set(meshes(build(project, o, g, span)).map(matName));
    };
    expect(names('door-single', 'alu-frosted').has('glass-frosted')).toBe(true);
    expect(names('door-single', 'ribbed-glass').has('glass-reeded')).toBe(true);
    expect(names('window-single', 'win-reeded').has('glass-reeded')).toBe(true);
    expect(names('window-single', 'win-frosted-low').has('glass-frosted')).toBe(true);
  });

  it('keeps legacy openings (no design) looking as before', () => {
    // French doors without a design still get divided lites; panelled doors get two panels per face.
    const fr = setup('door-french', { style: 'glazed' });
    const frDiv = setup('door-french', { design: 'lites-divided' });
    expect(fingerprint(build(fr.project, fr.o, fr.g, fr.span))).toBe(fingerprint(build(frDiv.project, frDiv.o, frDiv.g, frDiv.span)));
    const pn = setup('door-single', { style: 'panel' });
    const pn2 = setup('door-single', { design: 'panel-2' });
    expect(fingerprint(build(pn.project, pn.o, pn.g, pn.span))).toBe(fingerprint(build(pn2.project, pn2.o, pn2.g, pn2.span)));
  });
});

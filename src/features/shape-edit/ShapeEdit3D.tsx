import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import type { ItemEdits, PlacedObject, Project } from '@/domain/model/schema';
import { formatLength } from '@/domain/model/units';
import { objectSlotMaterialId } from '@/data/assets/registry';
import { MIN_SECTION, editedParts, paramHandles, sectionInfo, sectionsOffered, type EditedPart } from '@/data/assets/itemEdits';
import type { AssetParam } from '@/data/assets/types';
import { partGeometry } from '@/features/scene-3d/builders';
import type { MaterialRegistry } from '@/features/scene-3d/materialRegistry';
import { useEditorStore, type ShapeSection } from '@/state/editorStore';
import { editBase, setParam, setSectionEdges, setShapeEditState } from './actions';

/**
 * The item in the shape editor. It is edited as a whole made of components, never part by part:
 * - its sections (compartments across, levels up) light up under the pointer and are picked with a
 *   click; every section edge has a handle (above the top for compartments, beside the right side for
 *   levels) that drags the divider or shelf, so the sections on both sides change size;
 * - its settings with a handle (corner radii, leg widths, soffit drop) get an orange handle on the
 *   geometry they shape, dragged along the way the value grows, with the value shown while dragging.
 * A drag previews live and is stored as one undo step when released (5 mm steps, Alt free).
 */

type V3 = [number, number, number];

const OUTLINE = new THREE.LineBasicMaterial({ color: '#8fd3c0', transparent: true, opacity: 0.14, depthWrite: false });
const SECTION_HOVER = new THREE.MeshBasicMaterial({ color: '#6fb3a0', transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide });
const SECTION_PICKED = new THREE.MeshBasicMaterial({ color: '#ffb547', transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });
const SECTION_EDGE = new THREE.LineBasicMaterial({ color: '#ffb547', transparent: true, opacity: 0.9, depthTest: false, depthWrite: false });
const GUIDE = new THREE.LineDashedMaterial({ color: '#7fe0c6', transparent: true, opacity: 0.55, dashSize: 0.04, gapSize: 0.03, depthTest: false, depthWrite: false });
const GUIDE_ON = new THREE.LineDashedMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, dashSize: 0.04, gapSize: 0.03, depthTest: false, depthWrite: false });
const SECTION_COLOR = '#5fd4b4';
const PARAM_COLOR = '#ffb547';

/** Edge lines of a (cached, shared) part geometry, cached alongside it. */
const edgeCache = new WeakMap<THREE.BufferGeometry, THREE.EdgesGeometry>();
function edgesOf(g: THREE.BufferGeometry): THREE.EdgesGeometry {
  let e = edgeCache.get(g);
  if (!e) edgeCache.set(g, (e = new THREE.EdgesGeometry(g, 25)));
  return e;
}

function PartMesh({ p, material }: { p: EditedPart; material: THREE.Material }) {
  const geometry = useMemo(() => partGeometry(p.part), [p.part]);
  return (
    <group position={p.part.position} rotation={p.part.rotation ?? [0, 0, 0]} scale={p.part.scale ?? [1, 1, 1]}>
      <mesh geometry={geometry} material={material} castShadow receiveShadow />
      <lineSegments geometry={edgesOf(geometry)} material={OUTLINE} raycast={() => null} renderOrder={6} />
    </group>
  );
}

/** Closest point parameter on the line o + t·d (d unit) to a ray. */
function axisParam(o: THREE.Vector3, d: THREE.Vector3, ray: THREE.Ray): number {
  const w = o.clone().sub(ray.origin);
  const b = d.dot(ray.direction);
  const denom = 1 - b * b;
  if (Math.abs(denom) < 1e-6) return 0;
  return (b * ray.direction.dot(w) - d.dot(w)) / denom;
}

/**
 * Starts a handle drag along item-space direction `dir` through item-space point `at`: calls `onMove`
 * with the distance dragged (metres, along dir) and `onEnd` with the last one when released.
 */
function useAxisDrag() {
  const { camera, gl, controls } = useThree();
  return (e: ThreeEvent<PointerEvent>, group: THREE.Group, at: V3, dir: V3, onMove: (t: number, ev: PointerEvent) => void, onEnd: () => void) => {
    e.stopPropagation();
    const o = group.localToWorld(new THREE.Vector3(...at));
    const d = group.localToWorld(new THREE.Vector3(at[0] + dir[0], at[1] + dir[1], at[2] + dir[2])).sub(o).normalize();
    const ray = new THREE.Raycaster();
    const rayAt = (ev: PointerEvent) => {
      const r = gl.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1), camera);
      return ray.ray;
    };
    const t0 = axisParam(o, d, rayAt(e.nativeEvent));
    const ctrl = controls as unknown as { enabled: boolean } | null;
    if (ctrl) ctrl.enabled = false;
    const move = (ev: PointerEvent) => onMove(axisParam(o, d, rayAt(ev)) - t0, ev);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (ctrl) ctrl.enabled = true;
      onEnd();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };
}

/** A handle: a ball with a cone each way it drags (both ways, or only the way the value grows). */
function Handle({ at, dir, color, on, both, size, onDown, onHover }: {
  at: V3;
  dir: V3;
  color: string;
  on: boolean;
  /** Cones both ways (a section edge) or one cone, the way the value grows (a setting). */
  both: boolean;
  size: number;
  onDown: (e: ThreeEvent<PointerEvent>) => void;
  onHover: (on: boolean) => void;
}) {
  // Turn +y onto dir.
  const q = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...dir).normalize()), [dir]);
  const c = on ? '#ffffff' : color;
  const r = size;
  const events = {
    onPointerDown: (e: ThreeEvent<PointerEvent>) => e.button === 0 && onDown(e),
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      document.body.style.cursor = 'grab';
      onHover(true);
    },
    onPointerOut: () => {
      document.body.style.cursor = '';
      onHover(false);
    },
  };
  return (
    <group position={at} quaternion={q}>
      <mesh renderOrder={41} {...events}>
        <sphereGeometry args={[r, 16, 12]} />
        <meshBasicMaterial color={c} depthTest={false} transparent opacity={0.95} toneMapped={false} />
      </mesh>
      {(both ? [1, -1] : [1]).map((s) => (
        <mesh key={s} position={[0, s * r * 2.1, 0]} rotation={[s > 0 ? 0 : Math.PI, 0, 0]} renderOrder={41} {...events}>
          <coneGeometry args={[r * 0.75, r * 1.5, 12]} />
          <meshBasicMaterial color={c} depthTest={false} transparent opacity={0.9} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/** A dashed guide line between two item-space points (where a section edge runs). */
function Guide({ a, b, on }: { a: V3; b: V3; on: boolean }) {
  const ref = useRef<THREE.LineSegments>(null);
  const geometry = useMemo(() => new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a), new THREE.Vector3(...b)]), [a, b]);
  useEffect(() => {
    ref.current?.computeLineDistances();
    return () => geometry.dispose();
  }, [geometry]);
  return <lineSegments ref={ref} geometry={geometry} material={on ? GUIDE_ON : GUIDE} raycast={() => null} renderOrder={40} />;
}

/** A drag under way: a section edge moving to `pos`, or a setting at `value`. */
type Drag = { kind: 'edge'; axis: 'x' | 'y'; index: number; pos: number } | { kind: 'param'; param: AssetParam; value: number };

/** The edits with a drag's preview applied. */
function withDrag(edits: ItemEdits | undefined, drag: Drag | null, found: Record<'x' | 'y', { edges: number[]; found: number[] }> | null): ItemEdits | undefined {
  if (!drag) return edits;
  if (drag.kind === 'param') return { ...edits, params: { ...edits?.params, [drag.param.id]: drag.value } };
  const s = found?.[drag.axis];
  if (!s) return edits;
  const edges = s.edges.map((v, i) => (i === drag.index ? drag.pos : v));
  return { ...edits, sections: { ...edits?.sections, [drag.axis]: { n: edges.length, d: edges.map((v, i) => v - s.found[i]) } } };
}

/** The section box of `sec` (item space), from the section edges. */
function sectionBox(sec: ShapeSection, s: { edges: number[]; lo: number; hi: number }, size: { w: number; d: number; h: number }): { pos: V3; size: V3 } | null {
  const all = [s.lo, ...s.edges, s.hi];
  const a = all[sec.index];
  const b = all[sec.index + 1];
  if (a === undefined || b === undefined) return null;
  return sec.axis === 'x' ? { pos: [(a + b) / 2, size.h / 2, 0], size: [b - a, size.h + 0.004, size.d + 0.012] } : { pos: [0, (a + b) / 2, 0], size: [size.w + 0.012, b - a, size.d + 0.012] };
}

/** The item being shape-edited, with its sections, edge handles and setting handles. */
export function ShapeEditObject({ project, obj, registry }: { project: Project; obj: PlacedObject; registry: MaterialRegistry }) {
  const shapeEdit = useEditorStore((s) => s.shapeEdit);
  const asset = editBase(project, obj);
  const size = useMemo(() => ({ w: obj.width, d: obj.depth, h: obj.height }), [obj.width, obj.depth, obj.height]);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const group = useRef<THREE.Group>(null);
  const startDrag = useAxisDrag();
  const offered = !!asset && (sectionsOffered(asset) || !!obj.edits?.sections);
  const committed = useMemo(() => (asset && offered ? sectionInfo(asset, size, obj.edits) : null), [asset, offered, size, obj.edits]);
  const edits = useMemo(() => withDrag(obj.edits, drag, committed), [obj.edits, drag, committed]);
  const parts = useMemo(() => (asset ? editedParts(asset, size, edits) : []), [asset, size, edits]);
  const sections = useMemo(() => (asset && offered ? sectionInfo(asset, size, edits) : null), [asset, offered, size, edits]);
  const handles = useMemo(() => (asset ? paramHandles(asset, size, edits?.params) : []), [asset, size, edits?.params]);
  useEffect(() => () => void (document.body.style.cursor = ''), []);
  if (!asset || !shapeEdit) return null;
  const u = project.settings;
  const fmt = (v: number) => formatLength(v, u.units, u.precision);
  const set = (d: Drag | null) => {
    dragRef.current = d;
    setDrag(d);
  };

  /** The section under an item-space point: a compartment when the item has them, else a level. */
  const sectionAt = (p: THREE.Vector3): ShapeSection | null => {
    if (!sections) return null;
    for (const axis of ['x', 'y'] as const) {
      const s = sections[axis];
      if (!s.edges.length) continue;
      const v = axis === 'x' ? p.x : p.y;
      const all = [s.lo, ...s.edges, s.hi];
      for (let i = 0; i < all.length - 1; i++) if (v >= all[i] - 1e-3 && v <= all[i + 1] + 1e-3) return { axis, index: i };
    }
    return null;
  };
  const local = (e: ThreeEvent<PointerEvent | MouseEvent>) => group.current!.worldToLocal(e.point.clone());

  const edgeDown = (axis: 'x' | 'y', index: number) => (e: ThreeEvent<PointerEvent>) => {
    if (!group.current || !sections) return;
    const s = sections[axis];
    const all = [s.lo, ...s.edges, s.hi];
    const start = s.edges[index];
    const lo = all[index] + MIN_SECTION;
    const hi = all[index + 2] - MIN_SECTION;
    const at = edgeHandleAt(axis, start);
    setShapeEditState({ section: { axis, index: index + 1 } });
    startDrag(
      e,
      group.current,
      at,
      axis === 'x' ? [1, 0, 0] : [0, 1, 0],
      (t, ev) => {
        let pos = start + t;
        if (!ev.altKey) pos = Math.round(pos / 0.005) * 0.005;
        set({ kind: 'edge', axis, index, pos: Math.min(hi, Math.max(lo, pos)) });
      },
      () => {
        const d = dragRef.current;
        set(null);
        if (d?.kind === 'edge' && Math.abs(d.pos - start) > 1e-6) setSectionEdges(axis, s.edges.map((v, i) => (i === index ? d.pos : v)));
      },
    );
  };

  const paramDown = (param: AssetParam, value: number, at: V3, dir: V3, per: number) => (e: ThreeEvent<PointerEvent>) => {
    if (!group.current) return;
    setShapeEditState({ param: param.id });
    startDrag(
      e,
      group.current,
      at,
      dir,
      (t, ev) => {
        let v = value + t * per;
        const step = per === 1 ? 0.005 : (param.step ?? 0.01);
        if (!ev.altKey) v = Math.round(v / step) * step;
        set({ kind: 'param', param, value: Math.min(param.max ?? Infinity, Math.max(param.min ?? 0, v)) });
      },
      () => {
        const d = dragRef.current;
        set(null);
        setShapeEditState({ param: null });
        if (d?.kind === 'param' && Math.abs(d.value - value) > 1e-6) setParam(param.id, param.label, d.value);
      },
    );
  };

  /** Where a section edge's handle sits: above the top front edge (compartments), beside the right front edge (levels). */
  function edgeHandleAt(axis: 'x' | 'y', pos: number): V3 {
    return axis === 'x' ? [pos, size.h + 0.09, size.d / 2] : [size.w / 2 + 0.09, pos, size.d / 2];
  }

  const picked = shapeEdit.section;
  const hover = shapeEdit.hover;
  const pickedBox = picked && sections ? sectionBox(picked, sections[picked.axis], size) : null;
  const hoverBox = hover && sections && !(picked && picked.axis === hover.axis && picked.index === hover.index) ? sectionBox(hover, sections[hover.axis], size) : null;
  const r = Math.max(0.018, Math.min(0.035, Math.max(size.w, size.h) * 0.012));
  const dragging = drag?.kind === 'param' ? handles.find((h) => h.param.id === drag.param.id) : undefined;
  const edgeDrag = drag?.kind === 'edge' ? drag : null;

  return (
    <group ref={group} name="shape-edit" position={[obj.x, obj.elevation, obj.y]} rotation={[0, -obj.rotation, 0]} scale={[obj.mirrored ? -1 : 1, 1, 1]}>
      <group
        onPointerMove={(e) => {
          if (dragRef.current || !sections) return;
          e.stopPropagation();
          setShapeEditState({ hover: sectionAt(local(e)) });
        }}
        onPointerOut={() => setShapeEditState({ hover: null })}
        onClick={(e) => {
          e.stopPropagation();
          if (e.delta > 4) return;
          setShapeEditState({ section: sectionAt(local(e)) });
        }}
      >
        {parts
          .filter((p) => !p.hidden)
          .map((p) => (
            <PartMesh key={p.index} p={p} material={registry.get(project, objectSlotMaterialId(obj, asset, p.part.slot))} />
          ))}
      </group>
      {hoverBox && (
        <mesh position={hoverBox.pos} material={SECTION_HOVER} raycast={() => null} renderOrder={4}>
          <boxGeometry args={hoverBox.size} />
        </mesh>
      )}
      {pickedBox && (
        <group position={pickedBox.pos}>
          <mesh material={SECTION_PICKED} raycast={() => null} renderOrder={4}>
            <boxGeometry args={pickedBox.size} />
          </mesh>
          <lineSegments material={SECTION_EDGE} raycast={() => null} renderOrder={39}>
            <edgesGeometry args={[new THREE.BoxGeometry(...pickedBox.size)]} />
          </lineSegments>
        </group>
      )}
      {sections &&
        (['x', 'y'] as const).map((axis) =>
          sections[axis].edges.map((pos, i) => {
            // Bright: an edge of the picked section, or the one being dragged.
            const on = (!!picked && picked.axis === axis && (picked.index === i || picked.index === i + 1)) || (edgeDrag?.axis === axis && edgeDrag.index === i);
            const at = edgeHandleAt(axis, pos);
            const a: V3 = axis === 'x' ? [pos, 0, size.d / 2 + 0.002] : [-size.w / 2, pos, size.d / 2 + 0.002];
            const b: V3 = axis === 'x' ? [pos, size.h + 0.09, size.d / 2 + 0.002] : [size.w / 2 + 0.09, pos, size.d / 2 + 0.002];
            return (
              <group key={`${axis}${i}`}>
                <Guide a={a} b={b} on={on} />
                <Handle
                  at={at}
                  dir={axis === 'x' ? [1, 0, 0] : [0, 1, 0]}
                  color={SECTION_COLOR}
                  on={on}
                  both
                  size={r}
                  onDown={edgeDown(axis, i)}
                  onHover={(h) => setShapeEditState({ hover: h ? { axis, index: i } : null })}
                />
              </group>
            );
          }),
        )}
      {handles.map(({ param, value, handle }) => {
        const on = shapeEdit.param === param.id;
        const at: V3 = handle.at;
        return (
          <Handle
            key={param.id}
            at={at}
            dir={handle.dir}
            color={PARAM_COLOR}
            on={on}
            both={false}
            size={r}
            onDown={paramDown(param, value, at, handle.dir, handle.per ?? 1)}
            onHover={(h) => {
              if (!dragRef.current) setShapeEditState({ param: h ? param.id : null });
            }}
          />
        );
      })}
      {(dragging || (shapeEdit.param && !drag)) &&
        (() => {
          const h = dragging ?? handles.find((x) => x.param.id === shapeEdit.param);
          if (!h) return null;
          const v = drag?.kind === 'param' ? drag.value : h.value;
          return (
            <Html position={h.handle.at} center style={{ pointerEvents: 'none' }} zIndexRange={[30, 0]}>
              <div className="shape-handle-label">
                {h.param.label}: <strong>{h.handle.per && h.handle.per !== 1 ? `${Math.round(v * 100)} %` : fmt(v)}</strong>
              </div>
            </Html>
          );
        })()}
      {edgeDrag && sections && (
        <Html position={edgeHandleAt(edgeDrag.axis, edgeDrag.pos)} center style={{ pointerEvents: 'none' }} zIndexRange={[30, 0]}>
          <div className="shape-handle-label">
            {(() => {
              const s = sections[edgeDrag.axis];
              const all = [s.lo, ...s.edges, s.hi];
              const i = edgeDrag.index;
              return `${fmt(all[i + 1] - all[i])} | ${fmt(all[i + 2] - all[i + 1])}`;
            })()}
          </div>
        </Html>
      )}
    </group>
  );
}

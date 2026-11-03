import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import type { ItemEdits, PlacedObject, Project } from '@/domain/model/schema';
import { objectSlotMaterialId } from '@/data/assets/registry';
import { editedParts, partBox, partSig, partsFollowing, sectionInfo, type EditedPart } from '@/data/assets/itemEdits';
import { partGeometry } from '@/features/scene-3d/builders';
import type { MaterialRegistry } from '@/features/scene-3d/materialRegistry';
import { useEditorStore } from '@/state/editorStore';
import { openContextMenu } from '@/components/ContextMenu';
import { dragPart, editBase, resetPart, setShapeEditState, togglePartHidden } from './actions';

/**
 * The item in the shape editor: drawn part by part so each sub-item can be hovered and picked. Every
 * editable part gets a faint outline; the picked part a tint, a bright outline and a gizmo (arrows
 * move it along the item's axes, the small cubes drag one of its faces). The active section shows as a
 * light box. A drag previews live and is stored as one undo step when released.
 */

const OUTLINE = new THREE.LineBasicMaterial({ color: '#8fd3c0', transparent: true, opacity: 0.16, depthWrite: false });
const OUTLINE_HOVER = new THREE.LineBasicMaterial({ color: '#c8f1e6', transparent: true, opacity: 0.6, depthWrite: false });
const OUTLINE_FOLLOWS = new THREE.LineBasicMaterial({ color: '#7cc9ff', transparent: true, opacity: 0.75, depthTest: false, depthWrite: false });
const OUTLINE_PICKED = new THREE.LineBasicMaterial({ color: '#ffb547', transparent: true, opacity: 0.95, depthTest: false, depthWrite: false });
const OUTLINE_HIDDEN = new THREE.LineDashedMaterial({ color: '#9aa4ad', transparent: true, opacity: 0.35, dashSize: 0.03, gapSize: 0.02, depthWrite: false });
const TINT = new THREE.MeshBasicMaterial({ color: '#ffb547', transparent: true, opacity: 0.22, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
const SECTION = new THREE.MeshBasicMaterial({ color: '#6fb3a0', transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide });
const AXIS_COLORS = ['#e5534b', '#57ab5a', '#539bf5'];

/** Edge lines of a (cached, shared) part geometry, cached alongside it. */
const edgeCache = new WeakMap<THREE.BufferGeometry, THREE.EdgesGeometry>();
function edgesOf(g: THREE.BufferGeometry): THREE.EdgesGeometry {
  let e = edgeCache.get(g);
  if (!e) edgeCache.set(g, (e = new THREE.EdgesGeometry(g, 25)));
  return e;
}

type V3 = [number, number, number];
/** A gizmo drag under way: the part, and what it adds so far. */
interface Drag {
  index: number;
  move: V3;
  grow: V3;
}

/** The edits with a drag's preview added to one part. */
function withDrag(edits: ItemEdits | undefined, parts: EditedPart[], drag: Drag | null): ItemEdits | undefined {
  if (!drag) return edits;
  const p = parts[drag.index];
  if (!p) return edits;
  const sig = partSig(p.base);
  const cur = edits?.parts?.[String(drag.index)];
  const pe = cur && cur.sig === sig ? cur : { sig };
  const add = (a: V3 | undefined, b: V3): V3 => [(a?.[0] ?? 0) + b[0], (a?.[1] ?? 0) + b[1], (a?.[2] ?? 0) + b[2]];
  return { ...edits, parts: { ...edits?.parts, [String(drag.index)]: { ...pe, move: add(pe.move, drag.move), grow: add(pe.grow, drag.grow) } } };
}

function PartMesh({ p, material, picked, hovered, follows, onPick, onHover, onMenu }: {
  p: EditedPart;
  material: THREE.Material;
  picked: boolean;
  hovered: boolean;
  /** Attached to the picked part: it follows when that part changes. */
  follows: boolean;
  onPick: (e: ThreeEvent<MouseEvent>) => void;
  onHover: (on: boolean) => void;
  onMenu: (e: ThreeEvent<MouseEvent>) => void;
}) {
  const geometry = useMemo(() => partGeometry(p.part), [p.part]);
  const edges = edgesOf(geometry);
  const lines = useRef<THREE.LineSegments>(null);
  useEffect(() => {
    if (p.hidden) lines.current?.computeLineDistances();
  }, [p.hidden, edges]);
  const pos = p.part.position;
  const rot = p.part.rotation ?? [0, 0, 0];
  const scale = p.part.scale ?? [1, 1, 1];
  return (
    <group position={pos} rotation={rot} scale={scale}>
      {!p.hidden && (
        <mesh
          geometry={geometry}
          material={material}
          castShadow
          receiveShadow
          userData={{ shapePart: p.index }}
          onClick={onPick}
          onContextMenu={onMenu}
          onPointerOver={(e) => {
            e.stopPropagation();
            onHover(true);
          }}
          onPointerOut={() => onHover(false)}
        />
      )}
      {picked && !p.hidden && <mesh geometry={geometry} material={TINT} raycast={() => null} renderOrder={5} />}
      <lineSegments
        ref={lines}
        geometry={edges}
        material={p.hidden ? OUTLINE_HIDDEN : picked ? OUTLINE_PICKED : follows ? OUTLINE_FOLLOWS : hovered ? OUTLINE_HOVER : OUTLINE}
        raycast={() => null}
        renderOrder={picked ? 20 : follows ? 12 : 6}
      />
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

/** Arrows to move the picked part along the item's axes and cubes to drag its faces. */
function PartGizmo({ group, box, onDrag, onDone }: {
  group: React.RefObject<THREE.Group | null>;
  box: { size: V3; centre: V3 };
  onDrag: (move: V3, grow: V3) => void;
  onDone: (move: V3, grow: V3) => void;
}) {
  const { camera, gl, controls } = useThree();
  const [active, setActive] = useState<string | null>(null);
  const start = (e: ThreeEvent<PointerEvent>, axis: 0 | 1 | 2, kind: 'move' | 'face', sign: 1 | -1) => {
    if (e.button !== 0 || !group.current) return;
    e.stopPropagation();
    const g = group.current;
    const c = new THREE.Vector3(...box.centre);
    const o = g.localToWorld(c.clone());
    const tip = c.clone();
    tip.setComponent(axis, tip.getComponent(axis) + 1);
    const d = g.localToWorld(tip).sub(o).normalize();
    const ray = new THREE.Raycaster();
    const rayAt = (ev: PointerEvent) => {
      const r = gl.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1), camera);
      return ray.ray;
    };
    const t0 = axisParam(o, d, rayAt(e.nativeEvent));
    const ctrl = controls as unknown as { enabled: boolean } | null;
    if (ctrl) ctrl.enabled = false;
    setActive(`${kind}${axis}${sign}`);
    let last: { move: V3; grow: V3 } = { move: [0, 0, 0], grow: [0, 0, 0] };
    const at = (ev: PointerEvent) => {
      // 5 mm steps (Alt: free).
      let t = axisParam(o, d, rayAt(ev)) - t0;
      if (!ev.altKey) t = Math.round(t / 0.005) * 0.005;
      const move: V3 = [0, 0, 0];
      const grow: V3 = [0, 0, 0];
      if (kind === 'move') move[axis] = t;
      else {
        // One face follows the pointer, the opposite face stays.
        const g2 = Math.max(0.005 - box.size[axis], sign * t);
        grow[axis] = g2;
        move[axis] = (sign * g2) / 2;
      }
      return { move, grow };
    };
    const onMove = (ev: PointerEvent) => {
      last = at(ev);
      onDrag(last.move, last.grow);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      if (ctrl) ctrl.enabled = true;
      setActive(null);
      onDone(last.move, last.grow);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };
  const [cx, cy, cz] = box.centre;
  return (
    <group position={[cx, cy, cz]} renderOrder={30}>
      {([0, 1, 2] as const).map((axis) => {
        const len = Math.max(0.18, box.size[axis] / 2 + 0.16);
        const color = AXIS_COLORS[axis];
        // Arrow along +axis: shaft and head (geometry along y, turned onto the axis).
        const rot: V3 = axis === 0 ? [0, 0, -Math.PI / 2] : axis === 2 ? [Math.PI / 2, 0, 0] : [0, 0, 0];
        const dir = (k: number): V3 => [axis === 0 ? k : 0, axis === 1 ? k : 0, axis === 2 ? k : 0];
        const on = (key: string) => active === key;
        return (
          <group key={axis}>
            <group rotation={rot}>
              <mesh position={[0, len / 2, 0]} renderOrder={31} onPointerDown={(e) => start(e, axis, 'move', 1)}>
                <cylinderGeometry args={[0.008, 0.008, len, 8]} />
                <meshBasicMaterial color={on(`move${axis}1`) ? '#ffffff' : color} depthTest={false} transparent opacity={0.9} />
              </mesh>
              <mesh position={[0, len, 0]} renderOrder={31} onPointerDown={(e) => start(e, axis, 'move', 1)}>
                <coneGeometry args={[0.028, 0.08, 14]} />
                <meshBasicMaterial color={on(`move${axis}1`) ? '#ffffff' : color} depthTest={false} transparent opacity={0.95} />
              </mesh>
            </group>
            {([1, -1] as const).map((sign) => (
              <mesh key={sign} position={dir((sign * box.size[axis]) / 2)} renderOrder={31} onPointerDown={(e) => start(e, axis, 'face', sign)}>
                <boxGeometry args={[0.04, 0.04, 0.04]} />
                <meshBasicMaterial color={on(`face${axis}${sign}`) ? '#ffffff' : color} depthTest={false} transparent opacity={0.85} />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}

/** The item being shape-edited, with its outlines, picked part, gizmo and active section. */
export function ShapeEditObject({ project, obj, registry }: { project: Project; obj: PlacedObject; registry: MaterialRegistry }) {
  const shapeEdit = useEditorStore((s) => s.shapeEdit);
  const asset = editBase(project, obj);
  const size = useMemo(() => ({ w: obj.width, d: obj.depth, h: obj.height }), [obj.width, obj.depth, obj.height]);
  const [drag, setDrag] = useState<Drag | null>(null);
  const base = useMemo(() => (asset ? editedParts(asset, size, obj.edits) : []), [asset, size, obj.edits]);
  const parts = useMemo(() => (asset && drag ? editedParts(asset, size, withDrag(obj.edits, base, drag)) : base), [asset, size, obj.edits, base, drag]);
  const group = useRef<THREE.Group>(null);
  const picked = shapeEdit?.part ?? null;
  const following = useMemo(
    () => (picked !== null && !shapeEdit?.detached ? new Set(partsFollowing(base.map((p) => p.base), picked)) : new Set<number>()),
    [base, picked, shapeEdit?.detached],
  );
  const sections = useMemo(() => (asset && shapeEdit?.section ? sectionInfo(asset, size, obj.edits) : null), [asset, size, obj.edits, shapeEdit?.section]);
  if (!asset || !shapeEdit) return null;
  const pickedPart = picked !== null ? parts[picked] : undefined;
  const box = pickedPart && !pickedPart.hidden ? partBox(pickedPart.part) : null;
  const sec = shapeEdit.section;
  let secBox: { pos: V3; size: V3 } | null = null;
  if (sec && sections) {
    const s = sections[sec.axis];
    const all = [s.lo, ...s.edges, s.hi];
    const a = all[sec.index];
    const b = all[sec.index + 1];
    if (a !== undefined && b !== undefined)
      secBox = sec.axis === 'x' ? { pos: [(a + b) / 2, size.h / 2, 0], size: [b - a, size.h, size.d + 0.01] } : { pos: [0, (a + b) / 2, 0], size: [size.w + 0.01, b - a, size.d + 0.01] };
  }
  const menu = (index: number) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    e.nativeEvent.preventDefault();
    setShapeEditState({ part: index });
    const p = parts[index];
    openContextMenu(e.nativeEvent.clientX, e.nativeEvent.clientY, [
      { label: 'Hide part', shortcut: 'H', run: () => togglePartHidden(index, true) },
      { label: 'Reset part', disabled: !p?.edited, run: () => resetPart(index) },
    ]);
  };
  return (
    <group
      ref={group}
      name="shape-edit"
      position={[obj.x, obj.elevation, obj.y]}
      rotation={[0, -obj.rotation, 0]}
      scale={[obj.mirrored ? -1 : 1, 1, 1]}
    >
      {parts.map((p) => (
        <PartMesh
          key={p.index}
          p={p}
          material={registry.get(project, objectSlotMaterialId(obj, asset, p.part.slot))}
          picked={picked === p.index}
          hovered={shapeEdit.hover === p.index}
          follows={following.has(p.index)}
          onPick={(e) => {
            e.stopPropagation();
            if (e.delta > 4) return;
            setShapeEditState({ part: p.index, section: null });
          }}
          onHover={(on) => {
            const cur = useEditorStore.getState().shapeEdit?.hover ?? null;
            if (on) setShapeEditState({ hover: p.index });
            else if (cur === p.index) setShapeEditState({ hover: null });
          }}
          onMenu={menu(p.index)}
        />
      ))}
      {secBox && (
        <mesh position={secBox.pos} material={SECTION} raycast={() => null} renderOrder={4}>
          <boxGeometry args={secBox.size} />
        </mesh>
      )}
      {box && picked !== null && (
        <PartGizmo
          group={group}
          box={box}
          onDrag={(move, grow) => setDrag({ index: picked, move, grow })}
          onDone={(move, grow) => {
            setDrag(null);
            if ([...move, ...grow].some((v) => Math.abs(v) > 1e-9)) dragPart(picked, move, grow);
          }}
        />
      )}
    </group>
  );
}

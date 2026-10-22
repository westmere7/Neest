import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Html, Line } from '@react-three/drei';
import type { Callout, Project, Vec2 } from '@/domain/model/schema';
import type { DerivedPlan } from '@/domain/geometry/derive';
import { calloutAnchor, calloutLabelPoint } from '@/domain/geometry/callouts';
import { CALLOUT_PALETTE } from './content';
import { CalloutCard } from './CalloutCard';
import { visibleCallouts } from './layout';

/** Height of the floor outline for rooms and areas, just above the floor finish. */
const OUTLINE_Y = 0.025;

export interface Callout3DPoints {
  anchor: THREE.Vector3;
  label: THREE.Vector3;
  outline: Vec2[] | null;
  /** Height the outline is drawn at (the item's base for items, the floor otherwise). */
  outlineY: number;
}

/** Share of the plan offset used in 3D: labels float mostly upwards there, so they rarely hide their own target. */
const OFFSET_3D = 0.5;

/** Where a callout sits in 3D: plan (x, y) maps to three.js (x, z); heights are y. */
export function callout3DPoints(project: Project, derived: DerivedPlan | null, c: Callout): Callout3DPoints | null {
  const a = calloutAnchor(project, derived, c.target);
  if (!a) return null;
  const l = calloutLabelPoint(a, { offset: { x: c.offset.x * OFFSET_3D, y: c.offset.y * OFFSET_3D } });
  const t = c.target;
  return {
    anchor: new THREE.Vector3(a.x, a.z, a.y),
    label: new THREE.Vector3(l.x, a.z + c.lift, l.y),
    outline: a.outline,
    outlineY: t.kind === 'object' ? 0.01 + (project.objects[t.objectId]?.elevation ?? 0) : OUTLINE_Y,
  };
}

const dotTextures = new Map<string, THREE.CanvasTexture>();
/** A filled dot with a white ring, drawn once per colour. */
function dotTexture(color: string): THREE.CanvasTexture {
  let t = dotTextures.get(color);
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(32, 32, 30, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = color;
  g.beginPath();
  g.arc(32, 32, 23, 0, Math.PI * 2);
  g.fill();
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  dotTextures.set(color, t);
  return t;
}

/**
 * Leader, anchor dot and target outline of one callout. Leader and dot keep their size on screen
 * and draw over the scene, so walls never hide them; the outline lies on the floor (or under the item).
 */
function CalloutGeometry({ pts, color, selected }: { pts: Callout3DPoints; color: string; selected: boolean }) {
  const key = [pts.anchor.toArray(), pts.label.toArray(), pts.outline?.map((p) => [p.x, p.y]), pts.outlineY].flat(3).join();
  const { leader, outline } = useMemo(
    () => ({
      leader: [pts.anchor.clone(), pts.label.clone()],
      outline: pts.outline && pts.outline.length >= 3 ? [...pts.outline, pts.outline[0]].map((p) => new THREE.Vector3(p.x, pts.outlineY, p.y)) : null,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  const dot = useMemo(() => {
    const m = new THREE.SpriteMaterial({ map: dotTexture(color), depthTest: false, sizeAttenuation: false, transparent: true });
    const sp = new THREE.Sprite(m);
    sp.renderOrder = 1000;
    sp.raycast = () => {};
    return sp;
  }, [color]);
  useEffect(() => () => dot.material.dispose(), [dot]);
  const r = selected ? 0.026 : 0.02;
  return (
    <>
      <Line points={leader} color={color} lineWidth={selected ? 3 : 2} depthTest={false} transparent renderOrder={999} raycast={() => null} />
      {outline && <Line points={outline} color={color} lineWidth={selected ? 2.5 : 1.6} dashed dashSize={0.14} gapSize={0.09} raycast={() => null} />}
      <primitive object={dot} position={pts.anchor} scale={[r, r, 1]} />
    </>
  );
}

/**
 * Callouts in the 3D view: a leader from the target up to a floating HTML label (the same card as
 * the editor preview). Labels keep a constant size on screen. In the editor a click selects the
 * callout and a double-click opens its editor; links open in a new tab.
 */
export function Callouts3D({
  project,
  derived,
  selectedIds,
  onSelect,
  onEdit,
}: {
  project: Project;
  derived: DerivedPlan;
  selectedIds?: Set<string>;
  onSelect?: (id: string, additive: boolean) => void;
  onEdit?: (id: string) => void;
}) {
  return (
    <group name="callouts">
      {visibleCallouts(project).map((c) => {
        const pts = callout3DPoints(project, derived, c);
        if (!pts) return null;
        return (
          <group key={c.id} name={`callout-${c.id}`}>
            <CalloutGeometry pts={pts} color={CALLOUT_PALETTE[c.color].main} selected={!!selectedIds?.has(c.id)} />
            <Html position={pts.label} zIndexRange={[15, 0]}>
              <div
                className={`callout-3d${onSelect ? '' : ' passive'}`}
                data-testid="callout-3d"
                data-callout-id={c.id}
                // The label is not part of the scene: keep its presses from orbiting or clearing the selection.
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect?.(c.id, e.shiftKey);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onEdit?.(c.id);
                }}
              >
                <CalloutCard project={project} derived={derived} callout={c} selected={!!selectedIds?.has(c.id)} />
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

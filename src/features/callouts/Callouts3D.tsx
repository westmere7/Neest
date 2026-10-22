import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Html, Line } from '@react-three/drei';
import type { Callout, Project, Vec2 } from '@/domain/model/schema';
import type { DerivedPlan } from '@/domain/geometry/derive';
import { calloutAnchor, calloutLabelPoint } from '@/domain/geometry/callouts';
import { CALLOUT_PALETTE } from './content';
import { CalloutCard } from './CalloutCard';
import { visibleCallouts } from './layout';
import { NOTE_LINE_WIDTH, endPx, leaderDash } from './style';

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

const endTextures = new Map<string, THREE.CanvasTexture>();
/** End mark textures, drawn once per kind and colour: a dot with a white ring, a ring, an arrow pointing up. */
function endTexture(kind: 'dot' | 'ring' | 'arrow', color: string): THREE.CanvasTexture {
  const id = `${kind}|${color}`;
  let t = endTextures.get(id);
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  if (kind === 'arrow') {
    g.fillStyle = color;
    g.strokeStyle = '#ffffff';
    g.lineWidth = 4;
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(32, 3);
    g.lineTo(58, 61);
    g.lineTo(6, 61);
    g.closePath();
    g.fill();
    g.stroke();
  } else {
    g.fillStyle = kind === 'dot' ? '#ffffff' : color;
    g.beginPath();
    g.arc(32, 32, 30, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = kind === 'dot' ? color : '#ffffff';
    g.beginPath();
    g.arc(32, 32, kind === 'dot' ? 23 : 19, 0, Math.PI * 2);
    g.fill();
  }
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  endTextures.set(id, t);
  return t;
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

/**
 * Leader, end mark and target highlight of one note. Leader and mark keep their size on screen and
 * draw over the scene, so walls never hide them; the highlight lies on the floor (or under the item).
 */
function CalloutGeometry({ pts, c, selected }: { pts: Callout3DPoints; c: Callout; selected: boolean }) {
  const color = CALLOUT_PALETTE[c.color].main;
  const key = [pts.anchor.toArray(), pts.label.toArray(), pts.outline?.map((p) => [p.x, p.y]), pts.outlineY].flat(3).join();
  const { leader, outline } = useMemo(
    () => ({
      leader: [pts.anchor.clone(), pts.label.clone()],
      outline: pts.outline && pts.outline.length >= 3 ? [...pts.outline, pts.outline[0]].map((p) => new THREE.Vector3(p.x, pts.outlineY, p.y)) : null,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  const end = c.end;
  const mark = useMemo(() => {
    if (end === 'none') return null;
    const m = new THREE.SpriteMaterial({ map: endTexture(end, color), depthTest: false, sizeAttenuation: false, transparent: true });
    const sp = new THREE.Sprite(m);
    // An arrow's tip (top of its texture) sits on the anchor and turns about it.
    if (end === 'arrow') sp.center.set(0.5, 1);
    sp.renderOrder = 1000;
    sp.raycast = () => {};
    return sp;
  }, [end, color]);
  useEffect(() => () => mark?.material.dispose(), [mark]);
  // Point the arrow from the label towards the target, as seen on screen.
  useFrame(({ camera }) => {
    if (!mark || end !== 'arrow') return;
    _a.copy(pts.anchor).project(camera);
    _b.copy(pts.label).project(camera);
    const aspect = camera instanceof THREE.PerspectiveCamera ? camera.aspect : 1;
    mark.material.rotation = Math.atan2(_a.y - _b.y, (_a.x - _b.x) * aspect) - Math.PI / 2;
  });
  const s = (endPx(c) / 4) * 0.01 * (selected ? 1.25 : 1);
  const dash = leaderDash(c);
  const width = NOTE_LINE_WIDTH[c.lineWeight] * 1.5 * (selected ? 1.5 : 1);
  return (
    <>
      {c.line !== 'none' && (
        <Line
          points={leader}
          color={color}
          lineWidth={width}
          dashed={!!dash}
          // Dash lengths in metres along the leader.
          dashSize={c.line === 'dotted' ? 0.004 : 0.09}
          gapSize={c.line === 'dotted' ? 0.045 : 0.06}
          depthTest={false}
          transparent
          renderOrder={999}
          raycast={() => null}
        />
      )}
      {outline && c.highlight && <Line points={outline} color={color} lineWidth={selected ? 2.5 : 1.6} dashed dashSize={0.14} gapSize={0.09} raycast={() => null} />}
      {mark && <primitive object={mark} position={pts.anchor} scale={[end === 'arrow' ? s * 1.6 : s * 2, end === 'arrow' ? s * 2 : s * 2, 1]} />}
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
            <CalloutGeometry pts={pts} c={c} selected={!!selectedIds?.has(c.id)} />
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

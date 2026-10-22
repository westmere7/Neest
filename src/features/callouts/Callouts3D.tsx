import { useMemo } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import type { Callout, Project, Vec2 } from '@/domain/model/schema';
import type { DerivedPlan } from '@/domain/geometry/derive';
import { calloutAnchor, calloutLabelPoint } from '@/domain/geometry/callouts';
import { CALLOUT_PALETTE } from './content';
import { visibleCallouts } from './layout';
import type { NotePlacement } from './placement';

/** Height of the floor outline for rooms and areas, just above the floor finish. */
const OUTLINE_Y = 0.025;

export interface Callout3DPoints {
  anchor: THREE.Vector3;
  label: THREE.Vector3;
  outline: Vec2[] | null;
  /** Height the outline is drawn at (the item's base for items, the floor otherwise). */
  outlineY: number;
}

/**
 * Share of the plan offset used in 3D and extra float height, per placement: close (labels float mostly upwards, so
 * they rarely hide their own target), further out, or clear of the walls (placed close, then moved off the building on screen).
 */
const PLACEMENT_3D: Record<NotePlacement, { offset: number; lift: number; extra: number }> = {
  close: { offset: 0.5, lift: 1, extra: 0 },
  further: { offset: 1, lift: 1.8, extra: 0.6 },
  clear: { offset: 0.5, lift: 1, extra: 0 },
};

/** Where a callout sits in 3D: plan (x, y) maps to three.js (x, z); heights are y. */
export function callout3DPoints(project: Project, derived: DerivedPlan | null, c: Callout, placement: NotePlacement = 'close'): Callout3DPoints | null {
  const a = calloutAnchor(project, derived, c.target);
  if (!a) return null;
  const k = PLACEMENT_3D[placement];
  const l = calloutLabelPoint(a, { offset: { x: c.offset.x * k.offset, y: c.offset.y * k.offset } });
  const t = c.target;
  return {
    anchor: new THREE.Vector3(a.x, a.z, a.y),
    label: new THREE.Vector3(l.x, a.z + c.lift * k.lift + k.extra, l.y),
    outline: a.outline,
    outlineY: t.kind === 'object' ? 0.01 + (project.objects[t.objectId]?.elevation ?? 0) : OUTLINE_Y,
  };
}

/**
 * In the scene, each note's target highlight: a dashed outline on the floor (or under the item). The
 * labels, leaders and end marks are drawn over the view by `NotesOverlay`, laid out on screen.
 */
export function Callouts3D({ project, derived, selectedIds }: { project: Project; derived: DerivedPlan; selectedIds?: Set<string> }) {
  return (
    <group name="callouts">
      {visibleCallouts(project).map((c) => {
        if (!c.highlight) return null;
        const pts = callout3DPoints(project, derived, c);
        if (!pts?.outline || pts.outline.length < 3) return null;
        return <NoteHighlight key={c.id} pts={pts} color={CALLOUT_PALETTE[c.color].main} selected={!!selectedIds?.has(c.id)} />;
      })}
    </group>
  );
}

function NoteHighlight({ pts, color, selected }: { pts: Callout3DPoints; color: string; selected: boolean }) {
  const key = [pts.outline?.map((p) => [p.x, p.y]), pts.outlineY].flat(2).join();
  const points = useMemo(
    () => [...pts.outline!, pts.outline![0]].map((p) => new THREE.Vector3(p.x, pts.outlineY, p.y)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  return <Line points={points} color={color} lineWidth={selected ? 2.5 : 1.6} dashed dashSize={0.14} gapSize={0.09} raycast={() => null} />;
}

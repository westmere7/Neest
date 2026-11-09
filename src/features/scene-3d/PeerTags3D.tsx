import { useRef, useState } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { usePeerSelections } from '@/sync/peerSelections';

const OUTLINED = new Set(['object', 'opening', 'wall']);
/** How often the tags follow what they point at (the items can move while selected). */
const FOLLOW_MS = 200;

/**
 * Name tags of the other people in a shared project, over the first thing each has selected in the 3D view (the
 * outline in their colour is drawn by PostEffects). Only people looking at the same layout option.
 */
export function PeerTags3D() {
  const scene = useThree((s) => s.scene);
  const peers = usePeerSelections();
  const [spots, setSpots] = useState<{ id: string; name: string; color: string; at: [number, number, number] }[]>([]);
  const last = useRef(0);
  useFrame(() => {
    const now = performance.now();
    if (now - last.current < FOLLOW_MS) return;
    last.current = now;
    const next: typeof spots = [];
    if (peers.length) {
      const groups = new Map<string, THREE.Object3D>();
      scene.traverse((o) => {
        const id = o.userData?.id as string | undefined;
        if (id && OUTLINED.has(o.userData.kind) && !groups.has(id)) groups.set(id, o);
      });
      const box = new THREE.Box3();
      for (const p of peers) {
        const g = p.ids.map((id) => groups.get(id)).find(Boolean);
        if (!g) continue;
        box.setFromObject(g);
        if (box.isEmpty()) continue;
        next.push({ id: p.id, name: p.name, color: p.color, at: [(box.min.x + box.max.x) / 2, box.max.y + 0.12, (box.min.z + box.max.z) / 2] });
      }
    }
    const same =
      next.length === spots.length &&
      next.every((s, i) => s.id === spots[i].id && s.name === spots[i].name && s.at.every((v, k) => Math.abs(v - spots[i].at[k]) < 0.005));
    if (!same) setSpots(next);
  });
  return (
    <>
      {spots.map((s) => (
        <Html key={s.id} position={s.at} center style={{ pointerEvents: 'none' }} zIndexRange={[20, 0]}>
          <span className="peer-tag-3d" style={{ background: s.color }} data-testid="peer-tag-3d">
            {s.name}
          </span>
        </Html>
      ))}
    </>
  );
}

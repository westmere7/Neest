import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import type { Project } from '@/domain/model/schema';
import type { DerivedPlan } from '@/domain/geometry/derive';
import { pointElevation, runPath3D, serviceItems, servicePointAt } from '@/domain/geometry/services';
import { SERVICE_COLORS, SERVICE_POINTS, neededSystems, type ServicePointKind, type ServiceSystem } from '@/domain/model/services';
import { POINT_GLYPHS, SYSTEM_GLYPHS, hexagonPath, type Glyph } from '@/features/services/glyphs';
import { needsOfProject, servicesState } from '@/features/services/needs';
import { flowsIntoItem, runColor } from '@/features/services/ServicesSvg';

export interface ServicesViewOptions {
  shown: Record<ServiceSystem, boolean>;
  selectedIds?: Set<string>;
  onPick?: (kind: 'service' | 'run' | 'object', id: string, e: ThreeEvent<MouseEvent>) => void;
}

// ───────────────────────── X-ray ─────────────────────────

const GHOST_WALL = new THREE.MeshBasicMaterial({ color: '#7fa8d8', transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide });
const GHOST_FLOOR = new THREE.MeshBasicMaterial({ color: '#5f86b8', transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide });
const EDGE = new THREE.LineBasicMaterial({ color: '#9fc3ee', transparent: true, opacity: 0.4, depthWrite: false });
// Marked, so a ghost (also one from a hot-reloaded copy of this module) is never kept as a mesh's own material.
GHOST_WALL.userData.xrayGhost = GHOST_FLOOR.userData.xrayGhost = true;
/** Groups of `neest-plan` that turn into X-ray outlines; items that need services and the services layer stay solid. */
const GHOSTED = new Set(['walls', 'openings', 'rooms']);

/**
 * Turns the building into an X-ray while mounted: walls, doors, windows and floors get a faint
 * see-through material, walls and floors their edges. Meshes rebuilt meanwhile are caught on the
 * next frame; everything is put back on unmount.
 */
export function XRayGhost({ root }: { root: React.RefObject<THREE.Group | null> }) {
  const touched = useRef(new Set<THREE.Mesh>());
  useFrame(() => {
    const g = root.current;
    if (!g) return;
    for (const child of g.children) {
      if (!GHOSTED.has(child.name)) continue;
      const edges = child.name !== 'openings';
      child.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || m.userData.xrayEdge) return;
        const ghost = m.userData.kind === 'room' ? GHOST_FLOOR : GHOST_WALL;
        if (m.material === ghost) return;
        // React re-applies a mesh's own material when it re-renders: keep the newest as the one to restore.
        if (!(m.material as THREE.Material).userData?.xrayGhost) m.userData.xrayOrig = m.material;
        if (!m.userData.xrayShadow) m.userData.xrayShadow = [m.castShadow, m.receiveShadow];
        m.material = ghost;
        m.castShadow = false;
        m.receiveShadow = false;
        if (edges && m.geometry && !m.children.some((c) => c.userData.xrayEdge)) {
          const lines = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 28), EDGE);
          lines.raycast = () => undefined;
          lines.userData.xrayEdge = true;
          m.add(lines);
        }
        touched.current.add(m);
      });
    }
  });
  useEffect(() => {
    const set = touched.current;
    return () => {
      for (const m of set) {
        if (m.userData.xrayOrig) m.material = m.userData.xrayOrig;
        const sh = m.userData.xrayShadow as [boolean, boolean] | undefined;
        if (sh) [m.castShadow, m.receiveShadow] = sh;
        delete m.userData.xrayOrig;
        delete m.userData.xrayShadow;
        for (const c of [...m.children]) {
          if (!c.userData.xrayEdge) continue;
          m.remove(c);
          (c as THREE.LineSegments).geometry.dispose();
        }
      }
      set.clear();
    };
  }, []);
  return null;
}

// ───────────────────────── Sprites ─────────────────────────

const spriteCache = new Map<string, THREE.SpriteMaterial>();

function drawGlyph(ctx: CanvasRenderingContext2D, glyph: Glyph, cx: number, cy: number, size: number, color: string, weight: number) {
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(size / 24, size / 24);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = weight;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const d of glyph.fill ?? []) ctx.fill(new Path2D(d));
  for (const d of glyph.stroke) ctx.stroke(new Path2D(d));
  ctx.restore();
}

/** A point marker: system disc (square for floor points) with the kind's glyph; white ring when selected. */
function pointMaterial(kind: ServicePointKind, floor: boolean, selected: boolean): THREE.SpriteMaterial {
  const key = `p:${kind}:${floor}:${selected}`;
  const hit = spriteCache.get(key);
  if (hit) return hit;
  const S = 96;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d')!;
  const sys = SERVICE_POINTS[kind].system;
  const main = !!SERVICE_POINTS[kind].source;
  const r = S * (main ? 0.34 : 0.4);
  if (main) {
    // The mains: a hexagon inside a second, open hexagon.
    ctx.lineWidth = 4;
    ctx.strokeStyle = SERVICE_COLORS[sys];
    ctx.stroke(new Path2D(hexagonPath(S / 2, S / 2, S * 0.47)));
  }
  ctx.beginPath();
  if (main) {
    for (let i = 0; i < 6; i++) ctx[i ? 'lineTo' : 'moveTo'](S / 2 + r * Math.cos((Math.PI / 3) * i), S / 2 + r * Math.sin((Math.PI / 3) * i));
    ctx.closePath();
  } else if (floor) ctx.roundRect(S / 2 - r, S / 2 - r, 2 * r, 2 * r, r * 0.35);
  else ctx.arc(S / 2, S / 2, r, 0, Math.PI * 2);
  ctx.fillStyle = SERVICE_COLORS[sys];
  ctx.fill();
  if (kind === 'water-hot') {
    ctx.save();
    ctx.clip();
    ctx.fillStyle = SERVICE_COLORS.hot;
    ctx.fillRect(S / 2, 0, S / 2, S);
    ctx.restore();
  }
  ctx.lineWidth = selected ? 9 : 4;
  ctx.strokeStyle = selected ? '#ffffff' : '#0c1522';
  ctx.stroke();
  drawGlyph(ctx, POINT_GLYPHS[kind], S / 2, S / 2, r * 1.3, '#ffffff', 2.4);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, sizeAttenuation: false });
  spriteCache.set(key, mat);
  return mat;
}

/** An item's need badges in a row; a red ring marks a need nothing serves. */
function badgeMaterial(systems: ServiceSystem[], missing: ServiceSystem[]): { mat: THREE.SpriteMaterial; aspect: number } {
  const key = `b:${systems.join()}:${missing.join()}`;
  const S = 64;
  const hit = spriteCache.get(key);
  if (hit) return { mat: hit, aspect: systems.length };
  const canvas = document.createElement('canvas');
  canvas.width = S * systems.length;
  canvas.height = S;
  const ctx = canvas.getContext('2d')!;
  systems.forEach((s, i) => {
    const cx = S * i + S / 2;
    ctx.beginPath();
    ctx.arc(cx, S / 2, S * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = SERVICE_COLORS[s];
    ctx.fill();
    const miss = missing.includes(s);
    ctx.lineWidth = miss ? 7 : 3;
    ctx.strokeStyle = miss ? SERVICE_COLORS.missing : '#0c1522';
    ctx.stroke();
    drawGlyph(ctx, SYSTEM_GLYPHS[s], cx, S / 2, S * 0.52, '#0c1522', 2.8);
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, sizeAttenuation: false });
  spriteCache.set(key, mat);
  return { mat, aspect: systems.length };
}

/** Height a connection leaves an item at: drains near the floor, water at basin height, power low. */
function portHeight(system: ServiceSystem, elevation: number, height: number): number {
  const top = elevation + height;
  if (system === 'drain') return Math.min(top, elevation + 0.05);
  if (system === 'water') return Math.min(top, elevation + Math.min(0.5, height * 0.6));
  return Math.min(top, elevation + Math.min(0.3, height * 0.5));
}

// ───────────────────────── Layer ─────────────────────────

/** Services in 3D (Services mode): runs as lines inside walls, floors and ceilings, points, dashed item connections and need badges. */
export function Services3D({ project, derived, options }: { project: Project; derived: DerivedPlan; options: ServicesViewOptions }) {
  const { shown, selectedIds, onPick } = options;
  const groupRef = useRef<THREE.Group>(null);
  // Markers keep their screen size: sprites without size attenuation do that in perspective only, so an
  // orthographic camera scales them by its view height.
  // Connection dashes flow from start to end (a smaller dash offset moves them forward).
  const still = useMemo(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  useFrame(({ camera }, delta) => {
    const o = camera as THREE.OrthographicCamera;
    const k = o.isOrthographicCamera ? ((o.top - o.bottom) / o.zoom) * 1.07 : 1;
    for (const c of groupRef.current?.children ?? []) {
      if (c.userData.flow && !still) {
        const m = (c as THREE.Mesh).material as THREE.Material & { dashOffset?: number };
        if (m.dashOffset !== undefined) m.dashOffset = (m.dashOffset - Math.min(delta, 0.1) * 0.06) % 0.055;
      }
      const base = c.userData.screenScale as [number, number] | undefined;
      if (base) c.scale.set(base[0] * k, base[1] * k, 1);
    }
  });
  const state = servicesState(project, derived);
  const items = useMemo(() => serviceItems(project, needsOfProject(project)), [project]);
  const pick = (kind: 'service' | 'run' | 'object', id: string) =>
    onPick
      ? (e: ThreeEvent<MouseEvent>) => {
          if (e.delta > 4) return;
          e.stopPropagation();
          onPick(kind, id, e);
        }
      : undefined;
  const missing = new Map<string, ServiceSystem[]>();
  for (const n of state.needs) if (!n.met) missing.set(n.objectId, [...(missing.get(n.objectId) ?? []), n.system]);

  return (
    <group name="services" ref={groupRef}>
      {Object.values(project.serviceRuns ?? {}).map((r) => {
        if (!shown[r.system]) return null;
        const pts = runPath3D(project, derived, r);
        const on = selectedIds?.has(r.id);
        return (
          <Line
            key={r.id}
            points={pts}
            color={on ? '#ffffff' : runColor(r)}
            lineWidth={(r.system === 'drain' ? 4 : r.system === 'water' ? 3 : 2.2) + (on ? 1.5 : 0)}
            depthTest={false}
            renderOrder={20}
            onClick={pick('run', r.id)}
            onContextMenu={pick('run', r.id)}
          />
        );
      })}
      {state.links.map((l) => {
        if (!shown[l.system]) return null;
        const o = project.objects[l.objectId];
        const pt = project.servicePoints?.[l.pointId];
        if (!o || !pt) return null;
        const item: [number, number, number] = [l.from.x, portHeight(l.system, o.elevation, o.height), l.from.y];
        const point: [number, number, number] = [l.to.x, pointElevation(project, derived, pt), l.to.y];
        // Ordered the way the service flows, so the moving dashes show it.
        return (
          <Line
            key={`${l.objectId}:${l.system}`}
            points={flowsIntoItem(l.system) ? [point, item] : [item, point]}
            color={SERVICE_COLORS[l.system]}
            lineWidth={1.4}
            dashed
            dashSize={0.03}
            gapSize={0.025}
            userData={{ flow: true }}
            depthTest={false}
            renderOrder={21}
          />
        );
      })}
      {Object.values(project.servicePoints ?? {}).map((pt) => {
        if (!shown[SERVICE_POINTS[pt.kind].system]) return null;
        const at = servicePointAt(derived, pt);
        const y = pointElevation(project, derived, pt);
        // Wall points sit just in front of the face so they read on the wall.
        const out = pt.host === 'wall' ? 0.02 : 0;
        const on = !!selectedIds?.has(pt.id);
        const size = (on ? 0.032 : 0.026) * (SERVICE_POINTS[pt.kind].source ? 1.45 : 1);
        return (
          <sprite
            key={pt.id}
            material={pointMaterial(pt.kind, pt.host === 'floor', on)}
            position={[at.x + Math.cos(at.rotation) * out, y + (pt.host === 'floor' ? 0.02 : 0), at.y + Math.sin(at.rotation) * out]}
            userData={{ screenScale: [size, size] }}
            scale={[size, size, 1]}
            renderOrder={30}
            onClick={pick('service', pt.id)}
            onContextMenu={pick('service', pt.id)}
          />
        );
      })}
      {items.map(({ o, needs }) => {
        const systems = neededSystems(needs).filter((s) => shown[s]);
        if (!systems.length) return null;
        const { mat, aspect } = badgeMaterial(systems, missing.get(o.id) ?? []);
        const k = 0.017;
        return <sprite key={`b-${o.id}`} material={mat} position={[o.x, o.elevation + o.height + 0.12, o.y]} userData={{ screenScale: [k * aspect, k] }} scale={[k * aspect, k, 1]} renderOrder={29} raycast={() => null} />;
      })}
    </group>
  );
}

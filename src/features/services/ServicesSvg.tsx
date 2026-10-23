import { memo, type CSSProperties, type ReactNode } from 'react';
import type { Project, ServicePoint, ServiceRun } from '@/domain/model/schema';
import type { DerivedPlan } from '@/domain/geometry/derive';
import { servicePointAt, serviceItems } from '@/domain/geometry/services';
import { SERVICE_COLORS, SERVICE_POINTS, SERVICE_SYSTEMS, neededSystems, type ServiceSystem } from '@/domain/model/services';
import { rectPolygon } from '@/domain/geometry/polygon';
import { add, rotate } from '@/domain/geometry/vec';
import { f, polyPath } from '@/features/plan-2d/PlanDrawing';
import { POINT_GLYPHS, SYSTEM_GLYPHS, hexagonPath, type Glyph } from './glyphs';
import { needsOfProject, servicesState } from './needs';
import './services.css';

/** Marker radius of a point on screen (px). */
export const POINT_PX = 9;
/** Run widths on screen (px). */
export const RUN_PX: Record<ServiceSystem, number> = { power: 2, water: 2.6, drain: 4 };

export const runColor = (r: Pick<ServiceRun, 'system' | 'hot'>) => (r.system === 'water' && r.hot ? SERVICE_COLORS.hot : SERVICE_COLORS[r.system]);
/** Line dashes by where a run goes: solid in walls, long dashes in the floor, dots in the ceiling (in screen px). */
export const RUN_DASH: Record<ServiceRun['level'], number[] | null> = { wall: null, floor: [9, 5], ceiling: [1.5, 4.5] };

interface Props {
  project: Project;
  derived: DerivedPlan;
  px: number;
  shown: Record<ServiceSystem, boolean>;
  selected: ReadonlySet<string>;
  hoverId: string | null;
}

/** A glyph centred at (x, y), `size` world units across, in `color`. */
export function GlyphSvg({ glyph, x, y, size, color, weight = 2 }: { glyph: Glyph; x: number; y: number; size: number; color: string; weight?: number }) {
  const k = size / 24;
  return (
    <g transform={`translate(${f(x - size / 2)} ${f(y - size / 2)}) scale(${f(k)})`} pointerEvents="none">
      {glyph.fill?.map((d, i) => <path key={`f${i}`} d={d} fill={color} />)}
      {glyph.stroke.map((d, i) => (
        <path key={`s${i}`} d={d} fill="none" stroke={color} strokeWidth={weight} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </g>
  );
}

/**
 * Services mode in the plan, over the faded (X-ray) drawing: outlines of the items that need
 * services with their need badges (red ring = not met), runs, dashed item connections and points.
 */
export const ServicesSvg = memo(function ServicesSvg({ project, derived, px, shown, selected, hoverId }: Props) {
  const state = servicesState(project, derived);
  const items = serviceItems(project, needsOfProject(project));
  const unmet = new Set(state.needs.filter((n) => !n.met).map((n) => `${n.objectId}:${n.system}`));
  const els: ReactNode[] = [];

  // Items that need services: outline + badges.
  for (const { o, needs } of items) {
    const systems = neededSystems(needs).filter((s) => shown[s]);
    if (!systems.length) continue;
    const on = selected.has(o.id) || hoverId === o.id;
    els.push(
      <path
        key={`it-${o.id}`}
        d={polyPath(rectPolygon(o.x, o.y, o.width, o.depth, o.rotation))}
        className={`svc-item${on ? ' on' : ''}`}
        strokeWidth={f((on ? 2 : 1.3) * px)}
      />,
    );
    const r = 6.5 * px;
    const corner = add(o, rotate({ x: o.width / 2, y: -o.depth / 2 }, o.rotation));
    systems.forEach((s, i) => {
      const c = { x: corner.x - r + i * 2.3 * r - (systems.length - 1) * 1.15 * r, y: corner.y - r * 0.4 };
      const missing = unmet.has(`${o.id}:${s}`);
      els.push(
        <g key={`b-${o.id}-${s}`} className="svc-badge">
          <circle cx={f(c.x)} cy={f(c.y)} r={f(r)} fill={SERVICE_COLORS[s]} stroke={missing ? SERVICE_COLORS.missing : '#0c1522'} strokeWidth={f((missing ? 2.2 : 1.2) * px)} />
          <GlyphSvg glyph={SYSTEM_GLYPHS[s]} x={c.x} y={c.y} size={r * 1.35} color="#0c1522" weight={2.6} />
        </g>,
      );
    });
  }

  // Runs.
  for (const r of Object.values(project.serviceRuns ?? {})) {
    if (!shown[r.system]) continue;
    const d = polyPath(r.points, false);
    const w = RUN_PX[r.system];
    const on = selected.has(r.id) || hoverId === r.id;
    const dash = RUN_DASH[r.level];
    els.push(
      <g key={`run-${r.id}`} className="svc-run">
        {on && <path d={d} fill="none" stroke="#ffffff" strokeOpacity={0.55} strokeWidth={f((w + 6) * px)} strokeLinecap="round" strokeLinejoin="round" />}
        <path d={d} fill="none" stroke="#0c1522" strokeOpacity={0.6} strokeWidth={f((w + 2) * px)} strokeLinecap="round" strokeLinejoin="round" />
        <path
          d={d}
          fill="none"
          stroke={runColor(r)}
          strokeWidth={f(w * px)}
          strokeLinecap={dash ? 'butt' : 'round'}
          strokeLinejoin="round"
          strokeDasharray={dash?.map((x) => f(x * px)).join(' ')}
        />
      </g>,
    );
  }

  // Connections: dashed between the item and the point serving it, the dashes flowing the way the
  // service does (power and water into the item, waste out of it into the drain).
  for (const l of state.links) {
    if (!shown[l.system]) continue;
    const on = selected.has(l.objectId) || selected.has(l.pointId);
    const [a, b] = flowsIntoItem(l.system) ? [l.to, l.from] : [l.from, l.to];
    const period = (LINK_DASH[0] + LINK_DASH[1]) * px;
    els.push(
      <g key={`ln-${l.objectId}-${l.system}`} className="svc-link">
        <line
          x1={f(a.x)}
          y1={f(a.y)}
          x2={f(b.x)}
          y2={f(b.y)}
          stroke={SERVICE_COLORS[l.system]}
          strokeWidth={f((on ? 1.8 : 1.3) * px)}
          strokeDasharray={LINK_DASH.map((x) => f(x * px)).join(' ')}
          className="svc-flow"
          style={{ '--svc-period': `${f(period)}px` } as CSSProperties}
        />
        <circle cx={f(l.from.x)} cy={f(l.from.y)} r={f(2.6 * px)} fill={SERVICE_COLORS[l.system]} />
      </g>,
    );
  }

  // Points on top.
  for (const pt of Object.values(project.servicePoints ?? {})) {
    const sys = SERVICE_POINTS[pt.kind].system;
    if (!shown[sys]) continue;
    els.push(<PointMarker key={`pt-${pt.id}`} pt={pt} derived={derived} px={px} on={selected.has(pt.id)} hover={hoverId === pt.id} />);
  }
  return <g className="services-layer">{els}</g>;
});

/** A point: a disc in a wall (with a tick toward the room), a rounded square in the floor, a ringed disc in the ceiling. */
export function PointMarker({ pt, derived, px, on = false, hover = false, ghost = false, valid = true }: { pt: Pick<ServicePoint, 'kind' | 'host' | 'x' | 'y' | 'rotation' | 'wallId'> & Partial<ServicePoint>; derived: DerivedPlan; px: number; on?: boolean; hover?: boolean; ghost?: boolean; valid?: boolean }) {
  const at = ghost ? pt : servicePointAt(derived, pt as ServicePoint);
  const sys = SERVICE_POINTS[pt.kind].system;
  const color = !valid ? SERVICE_COLORS.missing : pt.kind === 'water-hot' ? SERVICE_COLORS.water : SERVICE_COLORS[sys];
  // The mains are bigger hexagons with a second ring.
  const main = !!SERVICE_POINTS[pt.kind].source;
  const r = POINT_PX * px * (main ? 1.35 : 1);
  const ring = on ? '#ffffff' : hover ? 'rgba(255,255,255,0.75)' : '#0c1522';
  const sw = f((on ? 2.4 : 1.3) * px);
  let shape: ReactNode;
  if (main)
    shape = (
      <>
        <path d={hexagonPath(at.x, at.y, r * 1.32)} fill="none" stroke={color} strokeWidth={f(1.4 * px)} />
        <path d={hexagonPath(at.x, at.y, r)} fill={color} stroke={ring} strokeWidth={sw} />
      </>
    );
  else if (pt.host === 'floor') shape = <rect x={f(at.x - r)} y={f(at.y - r)} width={f(2 * r)} height={f(2 * r)} rx={f(r * 0.35)} fill={color} stroke={ring} strokeWidth={sw} />;
  else shape = <circle cx={f(at.x)} cy={f(at.y)} r={f(r)} fill={color} stroke={ring} strokeWidth={sw} />;
  const tip = add(at, rotate({ x: r * 1.55, y: 0 }, at.rotation));
  return (
    <g className="svc-point" opacity={ghost ? 0.75 : 1}>
      {pt.host === 'wall' && <line x1={f(at.x)} y1={f(at.y)} x2={f(tip.x)} y2={f(tip.y)} stroke={color} strokeWidth={f(2.2 * px)} strokeLinecap="round" />}
      {pt.host === 'ceiling' && !main && <circle cx={f(at.x)} cy={f(at.y)} r={f(r * 1.45)} fill="none" stroke={color} strokeWidth={f(1.2 * px)} strokeDasharray={`${f(2 * px)} ${f(2 * px)}`} />}
      {shape}
      {pt.kind === 'water-hot' && <path d={`M${f(at.x)} ${f(at.y - r)}A${f(r)} ${f(r)} 0 0 1 ${f(at.x)} ${f(at.y + r)}Z`} fill={SERVICE_COLORS.hot} />}
      <GlyphSvg glyph={POINT_GLYPHS[pt.kind]} x={at.x} y={at.y} size={r * 1.45} color="#ffffff" weight={2.4} />
    </g>
  );
}

/** Connection dashes on screen (px): dash, gap. */
export const LINK_DASH = [3, 2.5] as const;

/** Power and water flow from the point into the item; drainage from the item into the drain. */
export const flowsIntoItem = (system: ServiceSystem) => system !== 'drain';

/** Systems in legend order (for UI lists). */
export const SYSTEMS = SERVICE_SYSTEMS;

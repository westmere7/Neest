import { SERVICE_COLORS, SERVICE_POINTS, type ServicePointKind, type ServiceSystem } from '@/domain/model/services';
import { POINT_GLYPHS, SYSTEM_GLYPHS, hexagonPath, type Glyph } from './glyphs';

function GlyphPaths({ glyph, color, weight }: { glyph: Glyph; color: string; weight: number }) {
  return (
    <>
      {glyph.fill?.map((d, i) => <path key={`f${i}`} d={d} fill={color} />)}
      {glyph.stroke.map((d, i) => (
        <path key={`s${i}`} d={d} fill="none" stroke={color} strokeWidth={weight} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </>
  );
}

/** A system badge: its colour disc with the bolt, drop or drain glyph. `missing` adds a red ring. */
export function SystemIcon({ system, size = 16, missing = false, title }: { system: ServiceSystem; size?: number; missing?: boolean; title?: string }) {
  return (
    <svg className="svc-icon" width={size} height={size} viewBox="-2 -2 28 28" role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      {title && <title>{title}</title>}
      <circle cx={12} cy={12} r={12.5} fill={SERVICE_COLORS[system]} stroke={missing ? SERVICE_COLORS.missing : 'none'} strokeWidth={missing ? 3 : 0} />
      <g transform="translate(4.2 4.2) scale(0.65)">
        <GlyphPaths glyph={SYSTEM_GLYPHS[system]} color="#10161f" weight={3} />
      </g>
    </svg>
  );
}

/** A point kind's marker as in the plan (disc, with the hot half for mixer points). */
export function PointIcon({ kind, size = 22 }: { kind: ServicePointKind; size?: number }) {
  const sys = SERVICE_POINTS[kind].system;
  const floor = SERVICE_POINTS[kind].hosts[0] === 'floor';
  const main = !!SERVICE_POINTS[kind].source;
  return (
    <svg className="svc-icon" width={size} height={size} viewBox="-2 -2 28 28" aria-hidden>
      {main ? (
        <>
          <path d={hexagonPath(12, 12, 13.6)} fill="none" stroke={SERVICE_COLORS[sys]} strokeWidth={1.4} />
          <path d={hexagonPath(12, 12, 11)} fill={SERVICE_COLORS[sys]} />
        </>
      ) : floor ? <rect x={-0.5} y={-0.5} width={25} height={25} rx={7} fill={SERVICE_COLORS[sys]} /> : <circle cx={12} cy={12} r={12.5} fill={SERVICE_COLORS[sys]} />}
      {kind === 'water-hot' && <path d="M12 -0.5A12.5 12.5 0 0 1 12 24.5Z" fill={SERVICE_COLORS.hot} />}
      <g transform="translate(3.6 3.6) scale(0.7)">
        <GlyphPaths glyph={POINT_GLYPHS[kind]} color="#ffffff" weight={2.6} />
      </g>
    </svg>
  );
}

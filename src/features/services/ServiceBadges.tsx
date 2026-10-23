import type { AssetServices, ServiceSystem } from '@/domain/model/services';
import { SERVICE_COLORS, SERVICE_SYSTEM_INFO, needLabel, neededSystems } from '@/domain/model/services';
import './services.css';

/** Slim line glyphs for the hover card (the plan and 3D use the filled markers). */
const SLIM: Record<ServiceSystem, string[]> = {
  power: ['M13 3 6.5 13h5l-1 8 7-10.5h-5.2Z'],
  water: ['M12 3.5s-5.5 6.6-5.5 10.4a5.5 5.5 0 0 0 11 0C17.5 10.1 12 3.5 12 3.5Z'],
  drain: ['M4.5 12a7.5 7.5 0 1 0 15 0a7.5 7.5 0 1 0-15 0', 'M8.5 9.8h7', 'M7.6 12.4h8.8', 'M8.5 15h7'],
};

export function SlimServiceIcon({ system, size = 11 }: { system: ServiceSystem; size?: number }) {
  return (
    <svg className="svc-icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      {SLIM[system].map((d, i) => (
        <path key={i} d={d} fill="none" stroke={SERVICE_COLORS[system]} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}

/** What an item needs, in words, for the library's hover card. */
export function ServiceNeeds({ services }: { services?: AssetServices }) {
  const systems = neededSystems(services);
  if (!systems.length || !services) return null;
  return (
    <div className="aic-services" data-testid="aic-services">
      {systems.map((s) => (
        <span key={s} title={SERVICE_SYSTEM_INFO[s].name}>
          <SlimServiceIcon system={s} /> {needLabel(s, services)}
        </span>
      ))}
    </div>
  );
}

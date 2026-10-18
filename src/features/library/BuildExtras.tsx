import type { ReactNode } from 'react';
import type { OpeningKind } from '@/domain/model/schema';
import { WALL_PRESETS, type WallPreset } from '@/domain/model/wallPresets';
import { useEditorStore } from '@/state/editorStore';

/** Build-tab additions: wall-type preset cards and icons for the newer door/window/passage kinds. */

export const DOOR_KINDS: OpeningKind[] = [
  'door-single',
  'door-double',
  'door-french',
  'door-sliding',
  'door-pocket',
  'door-bifold',
  'door-barn',
  'door-pivot',
  'passage',
  'passage-arched',
  'passage-moon',
];

export const WINDOW_KINDS: OpeningKind[] = ['window-single', 'window-double', 'window-fixed', 'window-sliding', 'window-tall', 'window-arched', 'window-round'];

/** Icon for kinds the original Build tab didn't have (null = use the original icon). */
export function extraOpeningIcon(kind: OpeningKind): ReactNode | null {
  const svg = (children: ReactNode) => (
    <svg viewBox="0 0 40 40" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M2 24h8M30 24h8" strokeWidth="5" />
      {children}
    </svg>
  );
  switch (kind) {
    case 'door-pocket':
      return svg(<path d="M10 24h-7" strokeWidth="2.2" strokeDasharray="2 1.5" />);
    case 'door-bifold':
      return svg(<path d="M10 24l5-8 5 8 5-8 5 8" strokeWidth="1.8" />);
    case 'door-barn':
      return svg(
        <>
          <path d="M6 19h28" strokeWidth="1" />
          <path d="M10 20h18" strokeWidth="2.6" />
        </>,
      );
    case 'door-french':
      return svg(
        <>
          <path d="M10 24V14M30 24V14" strokeWidth="2" />
          <path d="M10 14a10 10 0 0 1 10 10M30 14a10 10 0 0 0-10 10" strokeWidth="1" />
          <path d="M12 18h4M24 18h4" strokeWidth="0.8" />
        </>,
      );
    case 'door-pivot':
      return svg(
        <>
          <path d="M13 24l-3-16 18 0" strokeWidth="0" />
          <path d="M14 30L26 10" strokeWidth="2" />
          <circle cx="16" cy="24" r="1.4" fill="currentColor" />
          <path d="M26 10a17 17 0 0 1 4 14" strokeWidth="1" />
        </>,
      );
    case 'passage-arched':
      return (
        <svg viewBox="0 0 40 40" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M8 34V18a12 12 0 0 1 24 0v16" strokeWidth="3.5" />
        </svg>
      );
    case 'passage-moon':
      return (
        <svg viewBox="0 0 40 40" aria-hidden fill="none" stroke="currentColor">
          <rect x="3" y="3" width="34" height="34" rx="2" strokeWidth="2" />
          <circle cx="20" cy="20" r="11" strokeWidth="2.5" />
        </svg>
      );
    case 'window-arched':
      return (
        <svg viewBox="0 0 40 40" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M11 34V17a9 9 0 0 1 18 0v17z" />
          <path d="M20 9v25M11 22h18" strokeWidth="1" />
        </svg>
      );
    case 'window-round':
      return (
        <svg viewBox="0 0 40 40" aria-hidden fill="none" stroke="currentColor">
          <circle cx="20" cy="20" r="12" strokeWidth="2.2" />
          <circle cx="20" cy="20" r="9" strokeWidth="1" />
        </svg>
      );
    case 'window-tall':
      return (
        <svg viewBox="0 0 40 40" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="12" y="3" width="16" height="34" />
          <path d="M20 3v34" strokeWidth="1" />
        </svg>
      );
    default:
      return null;
  }
}

function PresetIcon({ preset }: { preset: WallPreset }) {
  const wall = <rect x="4" y="16" width="32" height="8" rx="1" fill="currentColor" opacity="0.85" />;
  switch (preset.icon) {
    case 'separator':
      return (
        <svg viewBox="0 0 40 40" aria-hidden fill="none" stroke="currentColor">
          <rect x="4" y="8" width="14" height="24" fill="currentColor" stroke="none" opacity="0.18" />
          <rect x="22" y="8" width="14" height="24" fill="currentColor" stroke="none" opacity="0.4" />
          <path d="M20 6v28" strokeWidth="1.6" strokeDasharray="3 2.5" />
        </svg>
      );
    case 'glass':
      return (
        <svg viewBox="0 0 40 40" aria-hidden fill="none" stroke="currentColor">
          <rect x="4" y="17" width="32" height="6" strokeWidth="1.4" />
          <path d="M4 20h32" strokeWidth="1" opacity="0.6" />
          <path d="M14 17v6M26 17v6" strokeWidth="2" />
        </svg>
      );
    case 'railing-glass':
    case 'railing-bars':
      return (
        <svg viewBox="0 0 40 40" aria-hidden fill="none" stroke="currentColor">
          <path d="M4 12h32" strokeWidth="2.5" />
          <path d="M6 12v22M20 12v22M34 12v22" strokeWidth="2.5" />
          {preset.icon === 'railing-bars' ? (
            <path d="M9 14v20M12 14v20M15 14v20M23 14v20M26 14v20M29 14v20" strokeWidth="1" />
          ) : (
            <path d="M8 15h10v17H8zM22 15h10v17H22z" strokeWidth="1" opacity="0.6" />
          )}
        </svg>
      );
    case 'half':
      return (
        <svg viewBox="0 0 40 40" aria-hidden>
          <rect x="5" y="20" width="30" height="14" fill="currentColor" opacity="0.8" />
          <rect x="3" y="17" width="34" height="3.5" fill="currentColor" />
        </svg>
      );
    case 'brick':
      return (
        <svg viewBox="0 0 40 40" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.2">
          <rect x="4" y="10" width="32" height="20" fill="currentColor" fillOpacity="0.15" />
          <path d="M4 17h32M4 23h32M12 10v7M24 10v7M18 17v6M30 17v6M12 23v7M24 23v7" />
        </svg>
      );
    case 'block':
      return (
        <svg viewBox="0 0 40 40" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.2">
          <rect x="6" y="8" width="28" height="24" />
          <path d="M6 16h28M6 24h28M15 8v24M25 8v24" />
        </svg>
      );
    case 'panel':
    case 'tile':
      return (
        <svg viewBox="0 0 40 40" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.2">
          <rect x="6" y="5" width="28" height="30" />
          <rect x="6" y="20" width="28" height="15" fill="currentColor" fillOpacity="0.25" />
          {preset.icon === 'tile' ? <path d="M6 25h28M6 30h28M13 20v5M20 25v5M27 20v5M13 30v5M27 30v5" /> : <path d="M6 20h28M14 23v9M20 23v9M26 23v9" />}
        </svg>
      );
    case 'trim':
      return (
        <svg viewBox="0 0 40 40" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.2">
          <rect x="6" y="5" width="28" height="30" />
          <rect x="6" y="5" width="28" height="3" fill="currentColor" />
          <rect x="6" y="31" width="28" height="4" fill="currentColor" />
        </svg>
      );
    default:
      return <svg viewBox="0 0 40 40" aria-hidden>{wall}</svg>;
  }
}

/** Build cards for the named wall types (draws walls with that preset). */
export function WallPresetCards() {
  const tool = useEditorStore((s) => s.tool);
  const active = useEditorStore((s) => s.wallPreset);
  const set = useEditorStore((s) => s.set);
  return (
    <>
      <h3 className="lib-h">Wall types</h3>
      <div className="build-grid">
        {WALL_PRESETS.map((p) => {
          const on = tool === 'wall' && active === p.id;
          return (
            <button
              key={p.id}
              type="button"
              className={`build-card${on ? ' on' : ''}`}
              onClick={() => set({ tool: 'wall', wallRole: p.role, wallThickness: p.thickness, wallPreset: p.id })}
              aria-pressed={on}
              title={p.hint}
              data-testid={`build-preset-${p.id}`}
            >
              <PresetIcon preset={p} />
              <span>{p.label}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

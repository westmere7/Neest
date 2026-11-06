import { Moon, Sun } from 'lucide-react';
import type { HouseLightingMode } from '@/features/scene-3d/houseLighting';

export function HouseLightToggle({
  mode,
  onChange,
  variant = 'surface',
}: {
  mode: HouseLightingMode;
  onChange: (mode: HouseLightingMode) => void;
  variant?: 'surface' | 'dark';
}) {
  const isLight = mode === 'light';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isLight}
      aria-label="House light mode"
      title="House lighting: Light / Dark"
      className={`house-light-toggle${variant === 'dark' ? ' on-dark' : ''}`}
      onClick={() => onChange(isLight ? 'dark' : 'light')}
      data-testid="house-light-toggle"
    >
      <Moon size={14} aria-hidden="true" className="hl-ico hl-moon" />
      <span className="hl-track" aria-hidden="true">
        <span className="hl-thumb" />
      </span>
      <Sun size={14} aria-hidden="true" className="hl-ico hl-sun" />
    </button>
  );
}

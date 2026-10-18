import { X } from 'lucide-react';
import type { AssetVariant } from '@/data/assets/variants';
import './variants.css';

/** Background for a round swatch: one colour, or equal pie slices of up to three. */
function swatchBackground(colors: string[]): string {
  const c = colors.length ? colors : ['#cccccc'];
  if (c.length === 1) return c[0];
  const step = 360 / c.length;
  return `conic-gradient(from -90deg, ${c.map((col, i) => `${col} ${i * step}deg ${(i + 1) * step}deg`).join(', ')})`;
}

/**
 * A row of round colour swatches, one per variant (Sims-style). The selected one is ringed; saved
 * variants carry a small dot and, when `onDelete` is given, a remove button on hover.
 */
export function VariantSwatches({
  variants,
  selected,
  onPick,
  onDelete,
  label = 'Colour variants',
  size = 'md',
}: {
  variants: AssetVariant[];
  selected: string | null;
  onPick: (v: AssetVariant) => void;
  onDelete?: (v: AssetVariant) => void;
  label?: string;
  size?: 'sm' | 'md';
}) {
  if (variants.length < 2) return null;
  return (
    <div className={`variant-swatches ${size}`} role="radiogroup" aria-label={label} data-testid="variant-swatches">
      {variants.map((v) => (
        <span key={v.id} className={`vs-item${v.user ? ' user' : ''}`}>
          <button
            type="button"
            role="radio"
            aria-checked={selected === v.id}
            className={`vs-swatch${selected === v.id ? ' on' : ''}`}
            style={{ background: swatchBackground(v.swatch) }}
            title={v.name}
            aria-label={v.name}
            onClick={(e) => {
              e.stopPropagation();
              onPick(v);
            }}
          />
          {v.user && onDelete && (
            <button
              type="button"
              className="vs-delete"
              title={`Delete “${v.name}”`}
              aria-label={`Delete variant ${v.name}`}
              onClick={(e) => {
                e.stopPropagation();
                onDelete(v);
              }}
            >
              <X size={9} aria-hidden />
            </button>
          )}
        </span>
      ))}
    </div>
  );
}

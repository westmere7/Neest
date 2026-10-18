import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Check, ChevronDown, Shapes, Sparkles, Square, type LucideIcon } from 'lucide-react';
import type { AssetDefinition, AssetModelVariant } from '@/data/assets/types';
import { assetModels } from '@/data/assets/models';
import { usePackVersion } from '@/packs/events';
import { useEditorStore } from '@/state/editorStore';
import { openContextMenu } from '@/components/ContextMenu';
import './variants.css';

/** Icon for a model: bare looks get an empty square, filled ones sparkles, others shapes. */
export function modelIcon(m: AssetModelVariant): LucideIcon {
  const t = `${m.id} ${m.name}`.toLowerCase();
  if (/empty|bare|clear|plain|\bno\b|without|closed/.test(t)) return Square;
  if (/fill|styl|dress|set|stock|full|with|decor|lived/.test(t)) return Sparkles;
  return Shapes;
}

/** Opens the list of models under a button (any number of models; the current one is checked). */
function openModelMenu(e: MouseEvent<HTMLElement>, models: AssetModelVariant[], selected: string, onPick: (m: AssetModelVariant) => void) {
  e.stopPropagation();
  e.preventDefault();
  const r = e.currentTarget.getBoundingClientRect();
  openContextMenu(
    r.left,
    r.bottom + 4,
    models.map((m) => ({ label: m.name, checked: m.id === selected, run: () => m.id !== selected && onPick(m) })),
  );
}

/**
 * Model variant picker: a small pill with the current model's icon and name; clicking it expands the
 * list of models right below it (any number), inside whatever holds it — so the library info card
 * stays open and the place tool stays armed while switching. Shown only for items with models.
 */
export function ModelPicker({
  models,
  selected,
  onPick,
  label = 'Model',
}: {
  models: AssetModelVariant[];
  selected: string;
  onPick: (m: AssetModelVariant) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open]);
  if (models.length < 2) return null;
  const current = models.find((m) => m.id === selected) ?? models[0];
  const Icon = modelIcon(current);
  return (
    <div className="model-picker-wrap" ref={ref}>
      <button
        type="button"
        className={`model-picker${open ? ' open' : ''}`}
        data-testid="model-picker"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${label}: ${current.name} (${models.length} models)`}
        title={`${label} · ${models.length} to choose from`}
        onClick={() => setOpen(!open)}
      >
        <Icon size={12} aria-hidden />
        <span>{current.name}</span>
        <ChevronDown size={12} aria-hidden className="mp-chevron" />
      </button>
      {open && (
        <div className="mp-list" role="menu" aria-label={label} data-testid="model-list">
          {models.map((m) => {
            const MIcon = modelIcon(m);
            const on = m.id === current.id;
            return (
              <button
                key={m.id}
                type="button"
                role="menuitemradio"
                aria-checked={on}
                className={`mp-item${on ? ' on' : ''}`}
                onClick={() => {
                  setOpen(false);
                  if (!on) onPick(m);
                }}
              >
                <MIcon size={12} aria-hidden />
                <span>{m.name}</span>
                {on && <Check size={12} aria-hidden className="mp-check" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** The model chosen for an asset in the library (default first model when none is chosen). */
export function useChosenModel(asset: AssetDefinition): { models: AssetModelVariant[]; chosen: AssetModelVariant | null } {
  usePackVersion();
  const choice = useEditorStore((s) => s.modelChoice[asset.id]);
  const models = assetModels(asset);
  if (!models.length) return { models, chosen: null };
  return { models, chosen: models.find((m) => m.id === choice) ?? models[0] };
}

/** Sets the library's model choice for an asset (new items are placed in it). */
export function chooseModel(asset: AssetDefinition, modelId: string): void {
  const ed = useEditorStore.getState();
  ed.set({ modelChoice: { ...ed.modelChoice, [asset.id]: modelId } });
}

/**
 * Library card corner button: the chosen model's icon; it opens the list of models (the card's
 * thumbnail follows the choice).
 */
export function CardModelButton({ asset }: { asset: AssetDefinition }) {
  const { models, chosen } = useChosenModel(asset);
  if (!chosen) return null;
  const Icon = modelIcon(chosen);
  return (
    <button
      type="button"
      className="card-model-btn"
      data-testid="card-model-button"
      aria-haspopup="menu"
      aria-label={`Model: ${chosen.name} (${models.length} models)`}
      title={`Model: ${chosen.name} · ${models.length} models`}
      onClick={(e) => openModelMenu(e, models, chosen.id, (m) => chooseModel(asset, m.id))}
      onPointerDown={(e) => e.stopPropagation()}
      draggable={false}
    >
      <Icon size={11} aria-hidden />
    </button>
  );
}

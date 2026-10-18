import { useEffect, useId, useRef, useState } from 'react';
import type { LengthUnit, Project, WallRole, WallSegment, WallStyle } from '@/domain/model/schema';
import { formatLengthValue, parseLength } from '@/domain/model/units';
import { clampOpenings, setWallStyle, updateWalls } from '@/domain/commands/walls';
import { matchWallFinishes } from '@/domain/commands/wallTools';
import { useProjectStore } from '@/state/projectStore';
import { Button, Section, Select } from '@/components/ui';
import { MaterialSlotRow } from '@/features/materials/MaterialUI';

const MIXED = '__mixed__';

const ROLE_OPTIONS: { value: WallRole; label: string }[] = [
  { value: 'exterior', label: 'Exterior (apartment boundary)' },
  { value: 'interior', label: 'Interior wall' },
  { value: 'partition', label: 'Light partition' },
];

const STYLE_OPTIONS: { value: WallStyle; label: string }[] = [
  { value: 'solid', label: 'Solid' },
  { value: 'half', label: 'Half wall' },
  { value: 'glass', label: 'Glass wall' },
  { value: 'railing-glass', label: 'Glass railing' },
  { value: 'railing-bars', label: 'Bar railing' },
  { value: 'separator', label: 'Invisible room divider' },
];

const exec = (label: string, fn: Parameters<ReturnType<typeof useProjectStore.getState>['execute']>[1]) =>
  useProjectStore.getState().execute(label, fn);

/** The shared value of a field across walls, or undefined when they differ. */
function common<T>(walls: WallSegment[], get: (w: WallSegment) => T, eq: (a: T, b: T) => boolean = (a, b) => a === b): T | undefined {
  if (!walls.length) return undefined;
  const first = get(walls[0]);
  return walls.every((w) => eq(get(w), first)) ? first : undefined;
}

const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;

/**
 * Length input that shows "Mixed" (blank) when the selected walls differ.
 * Commits on Enter/blur; Esc reverts.
 */
function MixedLengthField({
  label,
  value,
  unit,
  precision,
  min,
  max,
  onCommit,
}: {
  label: string;
  value: number | undefined;
  unit: LengthUnit;
  precision: number;
  min: number;
  max: number;
  onCommit: (metres: number) => void;
}) {
  const shown = value === undefined ? '' : formatLengthValue(value, unit, precision);
  const [text, setText] = useState(shown);
  const [error, setError] = useState<string | null>(null);
  const focused = useRef(false);
  const id = useId();
  useEffect(() => {
    if (!focused.current) {
      setText(shown);
      setError(null);
    }
  }, [shown]);
  const commit = () => {
    if (text.trim() === '' || text === shown) {
      setText(shown);
      setError(null);
      return;
    }
    const v = parseLength(text, unit);
    if (v == null) {
      setError('Enter a length, e.g. 2.4 or 240cm');
      return;
    }
    if (v < min - 1e-9 || v > max + 1e-9) {
      setError(`Must be between ${formatLengthValue(min, unit, precision)} and ${formatLengthValue(max, unit, precision)}`);
      return;
    }
    setError(null);
    onCommit(v);
  };
  return (
    <div className={`field${error ? ' has-error' : ''}`}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className="input-wrap">
        <input
          id={id}
          className="input num"
          value={text}
          placeholder={value === undefined ? 'Mixed' : undefined}
          inputMode="decimal"
          aria-invalid={!!error}
          onFocus={(e) => {
            focused.current = true;
            e.currentTarget.select();
          }}
          onBlur={() => {
            focused.current = false;
            commit();
          }}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') {
              setText(shown);
              setError(null);
              focused.current = false;
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
        {unit !== 'ft' && <span className="input-suffix">{unit}</span>}
      </div>
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

/**
 * Edits several walls at once: thickness, height, base elevation, role and
 * construction style, plus copying the first wall's finishes onto the rest.
 * Fields where the walls differ show "Mixed" until a value is chosen.
 */
export function WallMultiEdit({ project, wallIds }: { project: Project; wallIds: string[] }) {
  const walls = wallIds.map((id) => project.walls[id]).filter((w): w is WallSegment => !!w);
  if (!walls.length) return null;
  const ids = walls.map((w) => w.id);
  const u = project.settings;
  const thickness = common(walls, (w) => w.thickness, near);
  const height = common(walls, (w) => w.height, near);
  const base = common(walls, (w) => w.baseElevation, near);
  const role = common(walls, (w) => w.role);
  const style = common(walls, (w) => w.style ?? 'solid');
  const first = walls[0];
  // Faces to finish: built walls only (not glass, railings or invisible dividers).
  const builtWalls = walls.filter((w) => !w.style || w.style === 'solid' || w.style === 'half');
  const built = builtWalls.map((w) => w.id);
  const firstBuilt = builtWalls[0];
  const mixedNote = (side: 'left' | 'right' | 'top') => (builtWalls.every((w) => w.materials[side] === firstBuilt?.materials[side]) ? '' : ' (mixed)');
  const finishesMatch = walls.every(
    (w) =>
      w.materials.left === first.materials.left &&
      w.materials.right === first.materials.right &&
      w.materials.top === first.materials.top &&
      JSON.stringify(w.finishes ?? null) === JSON.stringify(first.finishes ?? null),
  );
  return (
    <Section title={`Walls (${walls.length})`}>
      <div className="grid-2">
        <MixedLengthField
          label="Thickness"
          value={thickness}
          unit={u.units}
          precision={u.precision}
          min={0.02}
          max={2}
          onCommit={(v) =>
            exec('Set wall thickness', (d) => {
              updateWalls(d, ids, { thickness: v });
              clampOpenings(d);
            })
          }
        />
        <MixedLengthField
          label="Height"
          value={height}
          unit={u.units}
          precision={u.precision}
          min={0.2}
          max={12}
          onCommit={(v) => exec('Set wall height', (d) => updateWalls(d, ids, { height: v }))}
        />
        <MixedLengthField
          label="Base elevation"
          value={base}
          unit={u.units}
          precision={u.precision}
          min={-2}
          max={12}
          onCommit={(v) => exec('Set wall elevation', (d) => updateWalls(d, ids, { baseElevation: v }))}
        />
      </div>
      <Select<WallRole | typeof MIXED>
        label="Wall type"
        value={role ?? MIXED}
        onChange={(r) => {
          if (r !== MIXED) exec('Set wall type', (d) => updateWalls(d, ids, { role: r }));
        }}
        options={role ? ROLE_OPTIONS : [{ value: MIXED, label: 'Mixed' }, ...ROLE_OPTIONS]}
      />
      <Select<WallStyle | typeof MIXED>
        label="Style"
        value={style ?? MIXED}
        onChange={(s) => {
          if (s !== MIXED) exec('Set wall style', (d) => setWallStyle(d, ids, s));
        }}
        options={style ? STYLE_OPTIONS : [{ value: MIXED, label: 'Mixed' }, ...STYLE_OPTIONS]}
      />
      {built.length > 0 && (
        <>
          <MaterialSlotRow label={`Left sides${mixedNote('left')}`} target={{ kind: 'walls-side', wallIds: built, side: 'left' }} materialId={firstBuilt.materials.left} />
          <MaterialSlotRow label={`Right sides${mixedNote('right')}`} target={{ kind: 'walls-side', wallIds: built, side: 'right' }} materialId={firstBuilt.materials.right} />
          <MaterialSlotRow label={`Tops & ends${mixedNote('top')}`} target={{ kind: 'walls-side', wallIds: built, side: 'top' }} materialId={firstBuilt.materials.top} />
        </>
      )}
      <div className="btn-row">
        <Button
          size="sm"
          variant="subtle"
          disabled={finishesMatch}
          onClick={() => exec('Match wall finishes', (d) => matchWallFinishes(d, first.id, ids))}
        >
          Match first wall’s finishes
        </Button>
      </div>
      <p className="field-hint">Fields showing “Mixed” differ between the selected walls; enter a value to set them all.</p>
    </Section>
  );
}

import { useState } from 'react';
import type { Project, WallSideFinish, WallStyle } from '@/domain/model/schema';
import { WALL_PRESETS, presetMaterialIds } from '@/domain/model/wallPresets';
import { clampOpenings, updateWalls } from '@/domain/commands/walls';
import { ensureMaterial, type WallTrimPart } from '@/domain/commands/entities';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore } from '@/state/editorStore';
import { Button, LengthField, Section, Segmented, Select, Toggle } from '@/components/ui';
import { MaterialSlotRow } from '@/features/materials/MaterialUI';
import './walls.css';

/**
 * Inspector sections for a wall's construction style, sloped top, and per-face trims
 * (skirting, cornice, dado/picture rail, lower band). Mounted inside WallInspector.
 */

const exec = (label: string, fn: Parameters<ReturnType<typeof useProjectStore.getState>['execute']>[1]) =>
  useProjectStore.getState().execute(label, fn);

const STYLE_OPTIONS: { value: WallStyle; label: string }[] = [
  { value: 'solid', label: 'Solid wall' },
  { value: 'half', label: 'Half wall with cap' },
  { value: 'glass', label: 'Glass wall' },
  { value: 'railing-glass', label: 'Glass railing' },
  { value: 'railing-bars', label: 'Metal bar railing' },
];

const EMPTY: WallSideFinish = { skirting: null, cornice: null, rail: null, band: null };

/** Default layer when a trim is switched on. */
const DEFAULT_LAYER: { [K in WallTrimPart]: NonNullable<WallSideFinish[K]> } = {
  skirting: { height: 0.1, depth: 0.015, materialId: 'paint-satin-white' },
  cornice: { height: 0.08, depth: 0.05, materialId: 'paint-satin-white' },
  rail: { y: 0.9, height: 0.04, depth: 0.02, materialId: 'paint-satin-white' },
  band: { height: 0.9, depth: 0.012, materialId: 'wood-painted-white', cap: true },
};

const PART_LABELS: Record<WallTrimPart, string> = {
  skirting: 'Skirting',
  cornice: 'Cornice',
  rail: 'Dado / picture rail',
  band: 'Lower band (wainscot / tile)',
};

export function WallConstruction({ project, wallId, locked }: { project: Project; wallId: string; locked: boolean }) {
  const w = project.walls[wallId];
  const u = project.settings;
  const style = w.style ?? 'solid';
  const light = style === 'glass' || style === 'railing-glass' || style === 'railing-bars';
  return (
    <Section title="Construction">
      <Select<WallStyle>
        label="Built as"
        value={style}
        onChange={(next) =>
          exec('Set wall construction', (d) => {
            const wall = d.walls[wallId];
            if (!wall) return;
            if (next === 'solid') delete wall.style;
            else wall.style = next;
            if ((next === 'glass' || next === 'railing-glass') && !wall.styleMaterialId) wall.styleMaterialId = 'glass-clear';
            if (next === 'railing-bars' && !wall.styleMaterialId) wall.styleMaterialId = 'metal-black-matte';
            if (next.startsWith('railing') && wall.height > 1.3) wall.height = 1.05;
            if (next === 'half' && wall.height > 1.6) wall.height = 1.05;
            if (next !== 'solid' && next !== 'half') {
              if (wall.materials.top === 'plaster-white') wall.materials.top = 'metal-black-matte';
              ensureMaterial(d, wall.materials.top);
            }
            if (wall.styleMaterialId) ensureMaterial(d, wall.styleMaterialId);
          })
        }
        options={STYLE_OPTIONS}
      />
      {light && (
        <>
          <MaterialSlotRow label={style === 'railing-bars' ? 'Bars' : 'Glazing'} target={{ kind: 'wall-style', wallId }} materialId={w.styleMaterialId ?? 'glass-clear'} />
          <MaterialSlotRow label={style === 'glass' ? 'Frame & mullions' : 'Posts & handrail'} target={{ kind: 'wall-side', wallId, side: 'top' }} materialId={w.materials.top} />
        </>
      )}
      {style === 'half' && <MaterialSlotRow label="Cap" target={{ kind: 'wall-side', wallId, side: 'top' }} materialId={w.materials.top} />}
      <Toggle
        label="Sloped top"
        hint="Different height at each end (attic knee walls, walls under stairs)"
        checked={w.heightEnd != null}
        onChange={(on) =>
          exec(on ? 'Slope wall top' : 'Level wall top', (d) => {
            const wall = d.walls[wallId];
            if (!wall) return;
            wall.heightEnd = on ? Math.max(0.2, Math.round((wall.height * 0.5) * 100) / 100) : null;
            if (!on) delete wall.heightEnd;
            clampOpenings(d, [wallId]);
          })
        }
      />
      {w.heightEnd != null && (
        <div className="grid-2">
          <LengthField label="Height at start" value={w.height} unit={u.units} precision={u.precision} min={0.2} max={12} disabled={locked} onCommit={(v) => exec('Set wall height', (d) => { updateWalls(d, [wallId], { height: v }); clampOpenings(d, [wallId]); })} />
          <LengthField label="Height at end" value={w.heightEnd} unit={u.units} precision={u.precision} min={0.2} max={12} disabled={locked} onCommit={(v) => exec('Set wall end height', (d) => { updateWalls(d, [wallId], { heightEnd: v }); clampOpenings(d, [wallId]); })} />
        </div>
      )}
    </Section>
  );
}

export function WallTrims({ project, wallId }: { project: Project; wallId: string }) {
  const w = project.walls[wallId];
  const [side, setSide] = useState<'left' | 'right'>('left');
  const style = w.style ?? 'solid';
  if (style !== 'solid' && style !== 'half') return null;
  const fin = w.finishes?.[side] ?? EMPTY;
  const u = project.settings;
  const setLayer = (label: string, part: WallTrimPart, value: WallSideFinish[WallTrimPart] | null) =>
    exec(label, (d) => {
      const wall = d.walls[wallId];
      if (!wall) return;
      const finishes = (wall.finishes ??= {});
      const f = (finishes[side] ??= { ...EMPTY });
      (f as Record<WallTrimPart, unknown>)[part] = value;
      if (value) ensureMaterial(d, value.materialId);
    });
  const patch = <K extends WallTrimPart>(part: K, label: string, p: Partial<NonNullable<WallSideFinish[K]>>) => {
    const cur = fin[part];
    if (cur) setLayer(label, part, { ...cur, ...p } as WallSideFinish[K]);
  };
  const copyToOther = () =>
    exec('Copy trims to the other face', (d) => {
      const wall = d.walls[wallId];
      if (!wall) return;
      const other = side === 'left' ? 'right' : 'left';
      wall.finishes = { ...(wall.finishes ?? {}), [other]: structuredClone(wall.finishes?.[side] ?? EMPTY) };
    });
  return (
    <Section title="Trim & finishes">
      <Segmented
        label="Wall face"
        size="sm"
        value={side}
        onChange={setSide}
        options={[
          { value: 'left', label: 'Left face' },
          { value: 'right', label: 'Right face' },
        ]}
      />
      {(['skirting', 'band', 'rail', 'cornice'] as const).map((part) => {
        const layer = fin[part];
        return (
          <div key={part} className="trim-row">
            <Toggle
              label={PART_LABELS[part]}
              checked={!!layer}
              onChange={(on) => setLayer(on ? `Add ${PART_LABELS[part].toLowerCase()}` : `Remove ${PART_LABELS[part].toLowerCase()}`, part, on ? structuredClone(DEFAULT_LAYER[part]) : null)}
            />
            {layer && (
              <>
                <div className="grid-2">
                  {part === 'rail' && 'y' in layer && (
                    <LengthField label="Height above floor" value={layer.y} unit={u.units} precision={u.precision} min={0.1} max={6} onCommit={(v) => patch('rail', 'Set rail height', { y: v })} />
                  )}
                  <LengthField
                    label={part === 'band' ? 'Band height' : 'Profile height'}
                    value={layer.height}
                    unit={u.units}
                    precision={u.precision}
                    min={0.005}
                    max={part === 'band' ? 6 : 1}
                    onCommit={(v) => patch(part, `Set ${PART_LABELS[part].toLowerCase()} height`, { height: v })}
                  />
                  <LengthField
                    label="Depth"
                    value={layer.depth}
                    unit={u.units}
                    precision={3}
                    min={0.001}
                    max={0.2}
                    onCommit={(v) => patch(part, `Set ${PART_LABELS[part].toLowerCase()} depth`, { depth: v })}
                  />
                </div>
                {part === 'band' && 'cap' in layer && (
                  <Toggle label="Cap rail on top" checked={layer.cap} onChange={(v) => patch('band', 'Toggle band cap', { cap: v })} />
                )}
                <MaterialSlotRow label={`${PART_LABELS[part]} finish`} target={{ kind: 'wall-trim', wallId, side, part }} materialId={layer.materialId} />
              </>
            )}
          </div>
        );
      })}
      <Button size="sm" variant="subtle" onClick={copyToOther}>
        Copy to the {side === 'left' ? 'right' : 'left'} face
      </Button>
    </Section>
  );
}

/** Applies a wall preset (style, materials, trims, size) to existing walls. */
export function applyWallPreset(wallIds: string[], presetId: string): void {
  const p = WALL_PRESETS.find((x) => x.id === presetId);
  if (!p) return;
  exec(`Apply “${p.label}”`, (d) => {
    for (const id of presetMaterialIds(p)) ensureMaterial(d, id);
    for (const id of wallIds) {
      const w = d.walls[id];
      if (!w) continue;
      w.role = p.role;
      w.thickness = p.thickness;
      if (p.height) w.height = p.height;
      if (p.style && p.style !== 'solid') w.style = p.style;
      else delete w.style;
      if (p.styleMaterialId) w.styleMaterialId = p.styleMaterialId;
      if (p.materials) w.materials = { ...w.materials, ...p.materials };
      w.finishes = p.finishes ? structuredClone(p.finishes) : undefined;
      if (!w.finishes) delete w.finishes;
    }
    clampOpenings(d, wallIds);
  });
}

export function WallPresetPicker({ wallIds }: { wallIds: string[] }) {
  return (
    <Select<string>
      label="Apply a wall type"
      value=""
      onChange={(id) => id && applyWallPreset(wallIds, id)}
      options={[{ value: '', label: 'Choose…' }, ...WALL_PRESETS.map((p) => ({ value: p.id, label: p.label }))]}
    />
  );
}

/** Wall-tool option: draw new walls with a named wall type (or plain walls). */
export function DrawPresetSelect() {
  const preset = useEditorStore((s) => s.wallPreset);
  return (
    <Select<string>
      label="Wall type preset"
      value={preset ?? ''}
      onChange={(id) => {
        const p = WALL_PRESETS.find((x) => x.id === id);
        useEditorStore.getState().set(p ? { wallPreset: p.id, wallRole: p.role, wallThickness: p.thickness } : { wallPreset: null, wallThickness: null });
      }}
      options={[{ value: '', label: 'Plain wall' }, ...WALL_PRESETS.map((p) => ({ value: p.id, label: p.label }))]}
    />
  );
}

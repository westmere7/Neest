import { isDividerWall, type Project, type WallRole, type WallSegment } from '@/domain/model/schema';
import { formatLength } from '@/domain/model/units';
import { useEditorStore } from '@/state/editorStore';
import { Button, Section } from '@/components/ui';

/**
 * Wall types: the walls of a project grouped by type (role: exterior, interior, partition; invisible
 * room dividers apart). Selecting a whole type opens the multi-wall editor, where thickness, height,
 * base, style, finishes and materials change for every wall of the type at once. The material
 * picker's "All walls of this type" scope uses the same grouping.
 */
export const WALL_TYPE_LABELS: Record<WallRole | 'divider', string> = {
  exterior: 'Exterior walls',
  interior: 'Interior walls',
  partition: 'Partitions',
  divider: 'Invisible room dividers',
};

export interface WallTypeGroup {
  key: WallRole | 'divider';
  label: string;
  walls: WallSegment[];
}

const sameOr = (values: number[]): number | null => (values.every((v) => Math.abs(v - values[0]) < 1e-6) ? values[0] : null);

export function wallTypeOf(w: WallSegment): WallRole | 'divider' {
  return isDividerWall(w) ? 'divider' : w.role;
}

export function wallTypeGroups(project: Project): WallTypeGroup[] {
  const order: (WallRole | 'divider')[] = ['exterior', 'interior', 'partition', 'divider'];
  const walls = Object.values(project.walls).filter((w) => !w.hidden);
  return order
    .map((key) => ({ key, label: WALL_TYPE_LABELS[key], walls: walls.filter((w) => wallTypeOf(w) === key) }))
    .filter((g) => g.walls.length > 0);
}

export function selectWalls(ids: string[]): void {
  useEditorStore.getState().set({ tool: 'select' });
  useEditorStore.getState().setSelection(ids.map((id) => ({ kind: 'wall' as const, id })));
}

/** Project panel: one row per wall type with its common thickness and height, and "Edit all". */
export function WallTypesSection({ project }: { project: Project }) {
  const groups = wallTypeGroups(project);
  if (!groups.length) return null;
  const u = project.settings;
  const fmt = (v: number | null) => (v == null ? 'mixed' : formatLength(v, u.units, u.precision));
  return (
    <Section title="Wall types">
      <div className="wall-types">
        {groups.map((g) => {
          const t = sameOr(g.walls.map((w) => w.thickness));
          const h = sameOr(g.walls.map((w) => w.height));
          return (
            <div key={g.key} className="wall-type-row" data-testid={`wall-type-${g.key}`}>
              <div className="wall-type-text">
                <strong>
                  {g.label} <span className="num">· {g.walls.length}</span>
                </strong>
                {g.key !== 'divider' && (
                  <span className="field-hint num">
                    {fmt(t)} thick · {fmt(h)} high
                  </span>
                )}
              </div>
              <Button size="sm" variant="subtle" onClick={() => selectWalls(g.walls.map((w) => w.id))}>
                Edit all
              </Button>
            </div>
          );
        })}
      </div>
      <p className="field-hint">Edit all selects every wall of the type: change thickness, height, style, finishes and materials together.</p>
    </Section>
  );
}

/** Wall Inspector: select every wall of the same type to edit them together. */
export function SelectSameTypeButton({ project, wall }: { project: Project; wall: WallSegment }) {
  const type = wallTypeOf(wall);
  const ids = Object.values(project.walls)
    .filter((w) => !w.hidden && wallTypeOf(w) === type)
    .map((w) => w.id);
  if (ids.length < 2) return null;
  return (
    <Button size="sm" variant="subtle" onClick={() => selectWalls(ids)} data-testid="select-same-wall-type">
      Edit all {ids.length} {WALL_TYPE_LABELS[type].toLowerCase()}
    </Button>
  );
}

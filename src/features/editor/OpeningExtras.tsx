import type { Project } from '@/domain/model/schema';
import { isPassageKind, isWindowKind } from '@/domain/model/schema';
import { updateOpening } from '@/domain/commands/entities';
import { useProjectStore } from '@/state/projectStore';
import { Section, Select, Toggle } from '@/components/ui';

type Grille = 'none' | 'bars' | 'grid';

const GRILLES: { value: Grille; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'bars', label: 'Security bars' },
  { value: 'grid', label: 'Muntin grid' },
];

const exec = (label: string, fn: Parameters<ReturnType<typeof useProjectStore.getState>['execute']>[1]) =>
  useProjectStore.getState().execute(label, fn);

/**
 * Extra opening options for the Inspector: transom and threshold (doors), grille and shutters
 * (windows), casing (all). Mounted inside OpeningInspector after the "Finishes" section.
 */
export function OpeningExtras({ project, openingId }: { project: Project; openingId: string }) {
  const o = project.openings[openingId];
  if (!o) return null;
  const win = isWindowKind(o.kind);
  const door = !win && !isPassageKind(o.kind);
  const upd = (label: string, patch: Parameters<typeof updateOpening>[2]) => exec(label, (d) => updateOpening(d, openingId, patch));
  return (
    <Section title="Details">
      {door && (
        <>
          <Toggle label="Transom" hint="Glazed fanlight above the door" checked={!!o.transom} onChange={(v) => upd(v ? 'Add transom' : 'Remove transom', { transom: v })} />
          <Toggle label="Threshold" hint="Strip on the floor" checked={!!o.threshold} onChange={(v) => upd(v ? 'Add threshold' : 'Remove threshold', { threshold: v })} />
        </>
      )}
      {win && (
        <>
          <Select<Grille> label="Grille" value={o.grille ?? 'none'} options={GRILLES} onChange={(grille) => upd('Set window grille', { grille })} />
          <Toggle label="Shutters" hint="Louvred, on the outside" checked={!!o.shutters} onChange={(v) => upd(v ? 'Add shutters' : 'Remove shutters', { shutters: v })} />
        </>
      )}
      <Toggle label="Casing" hint="Trim around the opening" checked={!!o.casing} onChange={(v) => upd(v ? 'Add casing' : 'Remove casing', { casing: v })} />
    </Section>
  );
}

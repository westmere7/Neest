import type { MaterialDefinition, Opening, OpeningKind, Project } from '@/domain/model/schema';
import type { OpeningFinishMaterials } from '@/domain/commands/entities';
import { finishFamily, finishesFor, USER_FINISH_KEY, type FinishFamily } from '@/domain/model/openingFinishes';
import { MATERIAL_CATALOG_BY_ID } from '@/data/materials/catalog';
import type { AssetVariant, UserVariant } from '@/data/assets/variants';
import { useEditorStore } from '@/state/editorStore';
import { usePrefsStore } from '@/state/uiStores';

const colorOf = (id: string | undefined, defs?: Record<string, MaterialDefinition>, project?: Project): string =>
  (id && (defs?.[id] ?? project?.materials[id] ?? MATERIAL_CATALOG_BY_ID[id])?.color) || '#cccccc';

/** Built-in finish sets of a door or window family plus the user's saved ones, as swatch variants. */
export function finishOptions(family: FinishFamily, saved: UserVariant[] | undefined = usePrefsStore.getState().assetVariants[USER_FINISH_KEY[family]]): AssetVariant[] {
  const builtIn: AssetVariant[] = finishesFor(family).map((f) => ({
    id: f.id,
    name: f.name,
    materials: (f.panel ? { frame: f.frame, panel: f.panel } : { frame: f.frame }) as Record<string, string>,
    swatch: f.panel && f.panel !== f.frame ? [colorOf(f.panel), colorOf(f.frame)] : [colorOf(f.frame)],
  }));
  const mine: AssetVariant[] = (saved ?? []).map((v) => ({
    id: `user:${v.id}`,
    name: v.name,
    materials: v.materials,
    swatch: v.materials.panel && v.materials.panel !== v.materials.frame ? [colorOf(v.materials.panel, v.defs), colorOf(v.materials.frame, v.defs)] : [colorOf(v.materials.frame, v.defs)],
    user: true,
  }));
  return [...builtIn, ...mine];
}

/** Materials carried by a saved finish (project-only edits), if any. */
export function finishDefs(family: FinishFamily, id: string): Record<string, MaterialDefinition> | undefined {
  if (!id.startsWith('user:')) return undefined;
  return usePrefsStore.getState().assetVariants[USER_FINISH_KEY[family]]?.find((v) => `user:${v.id}` === id)?.defs;
}

/** The finish an opening currently shows, if it matches one exactly. */
export function matchingFinish(project: Project, o: Opening, options: AssetVariant[]): AssetVariant | undefined {
  const glassLeaf = (project.materials[o.panelMaterialId] ?? MATERIAL_CATALOG_BY_ID[o.panelMaterialId])?.category === 'glass';
  const door = finishFamily(o.kind) === 'door' && !glassLeaf;
  return options.find((v) => v.materials.frame === o.frameMaterialId && (!door || !v.materials.panel || v.materials.panel === o.panelMaterialId));
}

/** Finish chosen in the door/window tool options for the next opening of this kind. */
export function chosenOpeningFinish(kind: OpeningKind): { materials: OpeningFinishMaterials; defs?: Record<string, MaterialDefinition> } | null {
  const family = finishFamily(kind);
  if (!family) return null;
  const ed = useEditorStore.getState();
  const id = family === 'door' ? ed.doorFinish : ed.windowFinish;
  const v = id ? finishOptions(family).find((x) => x.id === id) : undefined;
  if (!v) return null;
  return { materials: v.materials as unknown as OpeningFinishMaterials, defs: finishDefs(family, v.id) };
}

import type { MaterialDefinition } from '@/domain/model/schema';
import { prepareVariantMaterials } from '@/domain/commands/entities';
import type { D } from '@/domain/commands/walls';
import type { AssetDefinition } from '@/data/assets/types';
import { assetVariants, userVariantsFor, type AssetVariant } from '@/data/assets/variants';
import { useEditorStore } from '@/state/editorStore';
import { usePrefsStore } from '@/state/uiStores';

/** Built-in and saved colour variants of an asset (empty for branded and imported items). */
export function variantsFor(asset: AssetDefinition, saved = usePrefsStore.getState().assetVariants[asset.id]): AssetVariant[] {
  const builtIn = assetVariants(asset);
  const mine = userVariantsFor(asset, saved);
  if (!mine.length) return builtIn;
  // An item with nothing to vary still shows its original next to the user's own variants.
  const base = builtIn.length ? builtIn : [{ id: 'original', name: 'Original', materials: {}, swatch: mine[0].swatch, user: false }];
  return [...base, ...mine];
}

/** Materials carried by a saved variant (project-only finishes), if any. */
export function variantDefs(asset: AssetDefinition, variantId: string): Record<string, MaterialDefinition> | undefined {
  if (!variantId.startsWith('user:')) return undefined;
  return usePrefsStore.getState().assetVariants[asset.id]?.find((v) => `user:${v.id}` === variantId)?.defs;
}

/** The variant chosen for an asset in the library, if it still exists. */
export function chosenVariant(asset: AssetDefinition): AssetVariant | undefined {
  const id = useEditorStore.getState().variantChoice[asset.id];
  return id ? variantsFor(asset).find((v) => v.id === id) : undefined;
}

/** Slot materials for placing a new item in the chosen variant (inside a project recipe). */
export function placementMaterials(d: D, asset: AssetDefinition): Record<string, string> | undefined {
  const v = chosenVariant(asset);
  if (!v || !Object.keys(v.materials).length) return undefined;
  return prepareVariantMaterials(d, v.materials, variantDefs(asset, v.id));
}

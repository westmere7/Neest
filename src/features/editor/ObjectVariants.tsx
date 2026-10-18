import { useState } from 'react';
import { Bookmark } from 'lucide-react';
import type { MaterialDefinition, Project } from '@/domain/model/schema';
import { applyObjectVariant } from '@/domain/commands/entities';
import { MATERIAL_CATALOG_BY_ID } from '@/data/materials/catalog';
import type { AssetDefinition } from '@/data/assets/types';
import { hasFixedFinish, matchingVariant, materialOverrides } from '@/data/assets/variants';
import { usePackVersion } from '@/packs/events';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore } from '@/state/editorStore';
import { toast, usePrefsStore } from '@/state/uiStores';
import { Button } from '@/components/ui';
import { VariantSwatches } from '@/features/library/VariantSwatches';
import { variantDefs, variantsFor } from '@/features/library/variantChoice';

/**
 * Colour variants of a placed item in the Inspector: swatches apply a variant to the selected
 * items of this kind, and once its finishes have been edited the user can save them as their own
 * variant (shown in the library card too, in every project).
 */
export function ObjectVariants({ project, objectId, asset }: { project: Project; objectId: string; asset: AssetDefinition }) {
  usePackVersion();
  const saved = usePrefsStore((s) => s.assetVariants[asset.id]);
  const selection = useEditorStore((s) => s.selection);
  const [naming, setNaming] = useState<string | null>(null);
  if (hasFixedFinish(asset)) return null;
  const obj = project.objects[objectId];
  if (!obj) return null;
  const variants = variantsFor(asset, saved);
  const current = matchingVariant(asset, obj.materials, variants);
  const overrides = materialOverrides(asset, obj.materials);
  const canSave = !current && Object.keys(overrides).length > 0;

  const apply = (variantId: string) => {
    const v = variants.find((x) => x.id === variantId);
    if (!v) return;
    // Every selected item of the same kind takes the variant.
    const ids = selection.filter((s) => s.kind === 'object' && project.objects[s.id]?.assetId === asset.id).map((s) => s.id);
    const targets = ids.length ? ids : [objectId];
    useProjectStore.getState().execute(targets.length > 1 ? `Apply ${v.name} to ${targets.length} items` : `Apply ${v.name}`, (d) => applyObjectVariant(d, targets, v.materials, variantDefs(asset, v.id)));
  };

  const save = (name: string) => {
    const defs: Record<string, MaterialDefinition> = {};
    for (const id of Object.values(overrides)) {
      const own = project.materials[id];
      const cat = MATERIAL_CATALOG_BY_ID[id];
      // Carry project-only or edited materials so the variant works in other projects too.
      if (own && (!cat || JSON.stringify(own) !== JSON.stringify(cat))) defs[id] = structuredClone(own);
    }
    const id = Date.now().toString(36);
    usePrefsStore.getState().saveAssetVariant(asset.id, { id, name, materials: overrides, ...(Object.keys(defs).length ? { defs } : {}) });
    const ed = useEditorStore.getState();
    ed.set({ variantChoice: { ...ed.variantChoice, [asset.id]: `user:${id}` } });
    toast.success(`Saved “${name}”`, `New ${asset.name.toLowerCase()} items are placed in it; find it under the item’s colour swatches.`);
    setNaming(null);
  };

  if (variants.length < 2 && !canSave) return null;
  return (
    <div className="object-variants" data-testid="object-variants">
      <div className="field-label">Colour variant</div>
      <VariantSwatches
        variants={variants}
        selected={current?.id ?? null}
        onPick={(v) => apply(v.id)}
        onDelete={(v) => usePrefsStore.getState().deleteAssetVariant(asset.id, v.id.slice('user:'.length))}
        size="sm"
      />
      <div className="vs-caption">{current ? current.name : 'Custom finish'}</div>
      {canSave && naming === null && (
        <Button size="sm" variant="subtle" onClick={() => setNaming(`My ${asset.name.toLowerCase()} ${(saved?.length ?? 0) + 1}`)}>
          <Bookmark size={13} aria-hidden /> Save as variant
        </Button>
      )}
      {naming !== null && (
        <form
          className="vs-save"
          onSubmit={(e) => {
            e.preventDefault();
            if (naming.trim()) save(naming.trim());
          }}
        >
          <input autoFocus value={naming} maxLength={40} aria-label="Variant name" onChange={(e) => setNaming(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && setNaming(null)} />
          <Button size="sm" type="submit">
            Save
          </Button>
        </form>
      )}
    </div>
  );
}

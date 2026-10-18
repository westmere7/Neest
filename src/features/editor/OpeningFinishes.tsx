import { useState } from 'react';
import { Bookmark } from 'lucide-react';
import type { MaterialDefinition, OpeningKind, Project } from '@/domain/model/schema';
import { applyOpeningFinish } from '@/domain/commands/entities';
import { finishFamily, USER_FINISH_KEY, type FinishFamily } from '@/domain/model/openingFinishes';
import { MATERIAL_CATALOG_BY_ID } from '@/data/materials/catalog';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore } from '@/state/editorStore';
import { toast, usePrefsStore } from '@/state/uiStores';
import { Button } from '@/components/ui';
import { VariantSwatches } from '@/features/library/VariantSwatches';
import { finishDefs, finishOptions, matchingFinish } from './openingFinishChoice';

const NOUN: Record<FinishFamily, string> = { door: 'door', window: 'window' };

/**
 * Colour variants of a door or window in the Inspector: swatches apply a finish set to every
 * selected opening of the same family; an edited combination can be saved as the user's own.
 */
export function OpeningFinishes({ project, openingId }: { project: Project; openingId: string }) {
  const o = project.openings[openingId];
  const family = o ? finishFamily(o.kind) : null;
  const saved = usePrefsStore((s) => (family ? s.assetVariants[USER_FINISH_KEY[family]] : undefined));
  const selection = useEditorStore((s) => s.selection);
  const [naming, setNaming] = useState<string | null>(null);
  if (!o || !family) return null;
  const options = finishOptions(family, saved);
  const current = matchingFinish(project, o, options);

  const apply = (id: string) => {
    const v = options.find((x) => x.id === id);
    if (!v) return;
    const ids = selection.filter((s) => s.kind === 'opening' && project.openings[s.id] && finishFamily(project.openings[s.id].kind) === family).map((s) => s.id);
    const targets = ids.length ? ids : [openingId];
    useProjectStore
      .getState()
      .execute(targets.length > 1 ? `Apply ${v.name} to ${targets.length} ${NOUN[family]}s` : `Apply ${v.name}`, (d) =>
        applyOpeningFinish(d, targets, { frame: v.materials.frame, panel: v.materials.panel }, finishDefs(family, v.id)),
      );
  };

  const save = (name: string) => {
    const materials: Record<string, string> = { frame: o.frameMaterialId };
    if (family === 'door' && (project.materials[o.panelMaterialId] ?? MATERIAL_CATALOG_BY_ID[o.panelMaterialId])?.category !== 'glass') materials.panel = o.panelMaterialId;
    const defs: Record<string, MaterialDefinition> = {};
    for (const id of Object.values(materials)) {
      const own = project.materials[id];
      const cat = MATERIAL_CATALOG_BY_ID[id];
      if (own && (!cat || JSON.stringify(own) !== JSON.stringify(cat))) defs[id] = structuredClone(own);
    }
    const id = Date.now().toString(36);
    usePrefsStore.getState().saveAssetVariant(USER_FINISH_KEY[family], { id, name, materials, ...(Object.keys(defs).length ? { defs } : {}) });
    useEditorStore.getState().set(family === 'door' ? { doorFinish: `user:${id}` } : { windowFinish: `user:${id}` });
    toast.success(`Saved “${name}”`, `New ${NOUN[family]}s are placed in it; it is listed with the ${NOUN[family]} finishes in every project.`);
    setNaming(null);
  };

  return (
    <div className="object-variants" data-testid="opening-finishes">
      <div className="field-label">Colour variant</div>
      <VariantSwatches
        variants={options}
        selected={current?.id ?? null}
        onPick={(v) => apply(v.id)}
        onDelete={(v) => usePrefsStore.getState().deleteAssetVariant(USER_FINISH_KEY[family], v.id.slice('user:'.length))}
        size="sm"
      />
      <div className="vs-caption">{current ? current.name : 'Custom finish'}</div>
      {!current && naming === null && (
        <Button size="sm" variant="subtle" onClick={() => setNaming(`My ${NOUN[family]} finish ${(saved?.length ?? 0) + 1}`)}>
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

/** Finish for the next door or window placed (door/window tool options). */
export function OpeningToolFinish({ kind }: { kind: OpeningKind }) {
  const family = finishFamily(kind);
  const saved = usePrefsStore((s) => (family ? s.assetVariants[USER_FINISH_KEY[family]] : undefined));
  const chosen = useEditorStore((s) => (family === 'door' ? s.doorFinish : s.windowFinish));
  if (!family) return null;
  const options = finishOptions(family, saved);
  const selected = options.find((v) => v.id === chosen)?.id ?? options[0].id;
  return (
    <div className="object-variants">
      <VariantSwatches
        variants={options}
        selected={selected}
        onPick={(v) => useEditorStore.getState().set(family === 'door' ? { doorFinish: v.id } : { windowFinish: v.id })}
        onDelete={(v) => usePrefsStore.getState().deleteAssetVariant(USER_FINISH_KEY[family], v.id.slice('user:'.length))}
        size="sm"
      />
      <div className="vs-caption">{options.find((v) => v.id === selected)?.name}</div>
    </div>
  );
}

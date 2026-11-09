import type { ItemEdits, Project } from '@/domain/model/schema';
import { setObjectModel } from '@/domain/commands/entities';
import type { AssetDefinition } from '@/data/assets/types';
import { assetModels, resolveModel, storedModelId } from '@/data/assets/models';
import { usePackVersion } from '@/packs/events';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore } from '@/state/editorStore';
import { ModelPicker } from '@/features/library/ModelPicker';

/** Edits tied to one model's parts (part moves and resizes, section sizes); shape settings are not. */
export const editsTieModel = (e: ItemEdits | undefined): boolean => !!e && (!!e.sections || (!!e.parts && Object.keys(e.parts).length > 0));

/**
 * Model variant of a placed item in the Inspector (filled or bare…): applies to every selected
 * item of the same kind. The item keeps its place, size, finishes and shape settings (a portal's
 * leg widths, soffit drop, radii: they apply to every model). Items whose parts or sections were
 * edited keep their model: those edits belong to that model's parts (reset the shape to change it).
 */
export function ObjectModels({ project, objectId, asset }: { project: Project; objectId: string; asset: AssetDefinition }) {
  usePackVersion();
  const selection = useEditorStore((s) => s.selection);
  const obj = project.objects[objectId];
  const models = assetModels(asset);
  if (!obj || models.length < 2) return null;
  const current = resolveModel(asset, obj.model)!;
  const edited = editsTieModel(obj.edits);
  // A teammate on a newer version picked a model this copy does not have yet.
  const unknown = !!obj.model && !models.some((m) => m.id === obj.model);
  return (
    <div className="object-models" data-testid="object-models">
      <div className="field-label">Model</div>
      <ModelPicker
        models={models}
        selected={current.id}
        onPick={(m) => {
          if (m.id === current.id || edited) return;
          const ids = selection.filter((s) => s.kind === 'object' && project.objects[s.id]?.assetId === asset.id && !editsTieModel(project.objects[s.id]?.edits)).map((s) => s.id);
          const targets = ids.length ? ids : [objectId];
          useProjectStore
            .getState()
            .execute(targets.length > 1 ? `${m.name} model for ${targets.length} items` : `${m.name} model`, (d) => setObjectModel(d, targets, storedModelId(asset, m.id)));
        }}
      />
      {edited && <p className="field-hint" data-testid="model-locked">Locked by shape edits. Reset the shape to change the model.</p>}
      {unknown && (
        <p className="field-hint" data-testid="model-unknown">
          This item uses a model from a newer version of Neest (“{obj.model}”), shown here as {current.name}. Reload the page
          (or pull the latest code) to see it.
        </p>
      )}
    </div>
  );
}

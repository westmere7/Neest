import type { Project } from '@/domain/model/schema';
import { setObjectModel } from '@/domain/commands/entities';
import type { AssetDefinition } from '@/data/assets/types';
import { assetModels, resolveModel, storedModelId } from '@/data/assets/models';
import { usePackVersion } from '@/packs/events';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore } from '@/state/editorStore';
import { ModelPicker } from '@/features/library/ModelPicker';

/**
 * Model variant of a placed item in the Inspector (filled or bare…): applies to every selected
 * item of the same kind. The item keeps its place, size and finishes. Items with shape edits keep
 * their model: the edits belong to that model's parts (reset the shape to change it).
 */
export function ObjectModels({ project, objectId, asset }: { project: Project; objectId: string; asset: AssetDefinition }) {
  usePackVersion();
  const selection = useEditorStore((s) => s.selection);
  const obj = project.objects[objectId];
  const models = assetModels(asset);
  if (!obj || models.length < 2) return null;
  const current = resolveModel(asset, obj.model)!;
  const edited = !!obj.edits;
  return (
    <div className="object-models" data-testid="object-models">
      <div className="field-label">Model</div>
      <ModelPicker
        models={models}
        selected={current.id}
        onPick={(m) => {
          if (m.id === current.id || edited) return;
          const ids = selection.filter((s) => s.kind === 'object' && project.objects[s.id]?.assetId === asset.id && !project.objects[s.id]?.edits).map((s) => s.id);
          const targets = ids.length ? ids : [objectId];
          useProjectStore
            .getState()
            .execute(targets.length > 1 ? `${m.name} model for ${targets.length} items` : `${m.name} model`, (d) => setObjectModel(d, targets, storedModelId(asset, m.id)));
        }}
      />
      {edited && <p className="field-hint" data-testid="model-locked">Locked by shape edits. Reset the shape to change the model.</p>}
    </div>
  );
}

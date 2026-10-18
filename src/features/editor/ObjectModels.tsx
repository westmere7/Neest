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
 * item of the same kind. The item keeps its place, size and finishes.
 */
export function ObjectModels({ project, objectId, asset }: { project: Project; objectId: string; asset: AssetDefinition }) {
  usePackVersion();
  const selection = useEditorStore((s) => s.selection);
  const obj = project.objects[objectId];
  const models = assetModels(asset);
  if (!obj || models.length < 2) return null;
  const current = resolveModel(asset, obj.model)!;
  return (
    <div className="object-models" data-testid="object-models">
      <div className="field-label">Model</div>
      <ModelPicker
        models={models}
        selected={current.id}
        onPick={(m) => {
          if (m.id === current.id) return;
          const ids = selection.filter((s) => s.kind === 'object' && project.objects[s.id]?.assetId === asset.id).map((s) => s.id);
          const targets = ids.length ? ids : [objectId];
          useProjectStore
            .getState()
            .execute(targets.length > 1 ? `${m.name} model for ${targets.length} items` : `${m.name} model`, (d) => setObjectModel(d, targets, storedModelId(asset, m.id)));
        }}
      />
    </div>
  );
}

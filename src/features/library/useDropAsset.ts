import { useEffect } from 'react';
import { placeObject } from '@/domain/commands/entities';
import { derivePlan } from '@/domain/geometry/derive';
import { getAsset } from '@/data/assets/registry';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore } from '@/state/editorStore';
import { usePrefsStore } from '@/state/uiStores';
import { placementFor } from '@/features/plan-2d/tools/placeTools';

/** Places an asset dropped from the library onto the plan (with wall snapping). */
export function useDropAsset() {
  useEffect(() => {
    const onDrop = (e: Event) => {
      const { assetId, x, y } = (e as CustomEvent<{ assetId: string; x: number; y: number }>).detail;
      const project = useProjectStore.getState().project;
      if (!project) return;
      const asset = getAsset(project, assetId);
      if (!asset) return;
      const env = {
        project: () => useProjectStore.getState().project!,
        derived: () => derivePlan(useProjectStore.getState().project!),
        editor: () => useEditorStore.getState(),
      };
      const pl = placementFor(asset, { x, y }, 0, env, false);
      const id = useProjectStore.getState().execute(`Place ${asset.name.toLowerCase()}`, (d) =>
        placeObject(d, {
          assetId: asset.id,
          x: pl.x,
          y: pl.y,
          rotation: pl.rotation,
          width: asset.defaultSize.w,
          depth: asset.defaultSize.d,
          height: asset.defaultSize.h,
          elevation: asset.defaultElevation,
        }),
      );
      usePrefsStore.getState().pushRecentAsset(asset.id);
      if (id) useEditorStore.getState().set({ tool: 'select', selection: [{ kind: 'object', id }] });
    };
    window.addEventListener('neest:drop-asset', onDrop);
    return () => window.removeEventListener('neest:drop-asset', onDrop);
  }, []);
}

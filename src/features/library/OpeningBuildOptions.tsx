import type { OpeningKind } from '@/domain/model/schema';
import { isPassageKind, isWindowKind } from '@/domain/model/schema';
import { OPENING_PRESETS } from '@/domain/model/defaults';
import { defaultDesign, designFitsKind } from '@/domain/model/openingDesigns';
import { useEditorStore } from '@/state/editorStore';
import { OpeningDesignGrid } from '@/features/editor/OpeningDesignPicker';
import { OpeningToolFinish } from '@/features/editor/OpeningFinishes';

/**
 * Design and finish for the door or window about to be placed, shown in the Build panel under the
 * Doors / Windows cards: browse a type, pick its design and finish, then click a wall. Placed
 * openings can still be changed in the Inspector.
 */
export function OpeningBuildOptions({ kinds }: { kinds: OpeningKind[] }) {
  const tool = useEditorStore((s) => s.tool);
  const kind = useEditorStore((s) => s.openingKind);
  const doorDesign = useEditorStore((s) => s.doorDesign);
  const windowDesign = useEditorStore((s) => s.windowDesign);
  if (tool !== 'opening' || !kinds.includes(kind)) {
    return <p className="field-hint pad">Pick a type above to choose its design and finish, then click a wall to place it.</p>;
  }
  const win = isWindowKind(kind);
  const chosen = win ? windowDesign : doorDesign;
  const design = chosen && designFitsKind(chosen, kind) ? chosen : defaultDesign(kind, OPENING_PRESETS[kind].style);
  return (
    <div className="opening-build-options">
      {!isPassageKind(kind) && (
        <>
          <h3 className="lib-h">{win ? 'Window design' : 'Door design'}</h3>
          <div className="pad-x">
            <OpeningDesignGrid kind={kind} value={design} onPick={(d) => useEditorStore.getState().set(win ? { windowDesign: d } : { doorDesign: d })} />
          </div>
          <h3 className="lib-h">{win ? 'Window finish' : 'Door finish'}</h3>
          <div className="pad-x">
            <OpeningToolFinish kind={kind} />
          </div>
        </>
      )}
      <p className="field-hint pad">
        Hover a wall and click to place. {win ? 'Windows open' : 'Doors swing'} toward the side of the wall you point at; change the design, finish or swing later in the
        Inspector.
      </p>
    </div>
  );
}

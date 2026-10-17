import { Segmented } from '@/components/ui';
import { useEditorStore, type WallReference } from '@/state/editorStore';
import { roomDrawHint, wallDrawHint } from '@/features/plan-2d/tools/drawTools';

/**
 * Chooses which line of a new wall follows the clicked points: its centreline
 * or one of its faces. "Left" and "right" are relative to the drawing
 * direction (walking from one click to the next). For the room tool the
 * rectangle is walked clockwise, so left = outer face and right = inner face.
 */
export function WallReferencePicker() {
  const reference = useEditorStore((s) => s.wallReference);
  const tool = useEditorStore((s) => s.tool);
  const isRoom = tool === 'room';
  const set = (r: WallReference) => {
    const ed = useEditorStore.getState();
    const patch: Partial<typeof ed> = { wallReference: r };
    // Keep the status-bar hint in step while a drawing tool is active.
    if (ed.tool === 'wall') patch.hint = wallDrawHint(r);
    else if (ed.tool === 'room') patch.hint = roomDrawHint(r);
    ed.set(patch);
  };
  return (
    <div className="field">
      <span className="field-label">Draw by</span>
      <Segmented<WallReference>
        label="Draw walls by"
        size="sm"
        value={reference}
        onChange={set}
        options={[
          { value: 'center', label: 'Centre', title: 'Clicked points are the wall centreline', testId: 'wall-ref-center' },
          {
            value: 'left',
            label: isRoom ? 'Outer face' : 'Left face',
            title: isRoom ? 'The rectangle is the outside face of the walls' : 'Clicked points are the face on your left as you draw',
            testId: 'wall-ref-left',
          },
          {
            value: 'right',
            label: isRoom ? 'Inner face' : 'Right face',
            title: isRoom ? 'The rectangle is the inside face (clear room size)' : 'Clicked points are the face on your right as you draw',
            testId: 'wall-ref-right',
          },
        ]}
      />
      <span className="field-hint">
        {reference === 'center'
          ? 'Clicks place the middle of the wall.'
          : isRoom
            ? reference === 'left'
              ? 'The rectangle you draw is the outside of the walls; they are built inwards.'
              : 'The rectangle you draw is the clear room; the walls are built outwards.'
            : `Clicks place the wall's ${reference} face: the side on your ${reference} as you walk from one click to the next. The wall is built to your ${reference === 'left' ? 'right' : 'left'}.`}
      </span>
    </div>
  );
}

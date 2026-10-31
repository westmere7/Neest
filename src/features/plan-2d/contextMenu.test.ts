import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyProject } from '@/domain/model/defaults';
import { placeObject, updateObjects } from '@/domain/commands/entities';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore } from '@/state/editorStore';
import { planContextMenuItems } from './contextMenu';

describe('planContextMenuItems for objects', () => {
  let objId = '';

  beforeEach(() => {
    useProjectStore.getState().load(createEmptyProject());
    useProjectStore.getState().execute('Place desk', (d) => {
      objId = placeObject(d, { assetId: 'side-table', x: 1, y: 1, width: 1.6, depth: 1.2, height: 0.75 });
    });
    useEditorStore.getState().setSelection([{ kind: 'object', id: objId }]);
  });

  it('places Flip (mirror) immediately after Rotate 90° and toggles mirrored on click', () => {
    const items = planContextMenuItems({ kind: 'object', id: objId }, { x: 1, y: 1 });
    const labels = items.map((m) => m.label);
    const rotIdx = labels.indexOf('Rotate 90°');
    expect(rotIdx).toBeGreaterThanOrEqual(0);
    expect(labels[rotIdx + 1]).toBe('Flip (mirror)');

    const flipItem = items[rotIdx + 1];
    expect(flipItem.disabled).toBe(false);
    expect(flipItem.checked).toBeUndefined();

    flipItem.run?.();
    expect(useProjectStore.getState().project?.objects[objId]?.mirrored).toBe(true);

    flipItem.run?.();
    expect(useProjectStore.getState().project?.objects[objId]?.mirrored).toBe(false);
  });

  it('disables Flip (mirror) when the object or furniture layer is locked', () => {
    useProjectStore.getState().execute('Lock desk', (d) => {
      updateObjects(d, [objId], { locked: true });
    });
    const lockedItems = planContextMenuItems({ kind: 'object', id: objId }, { x: 1, y: 1 });
    const flipLocked = lockedItems.find((m) => m.label === 'Flip (mirror)');
    expect(flipLocked?.disabled).toBe(true);
    flipLocked?.run?.();
    expect(useProjectStore.getState().project?.objects[objId]?.mirrored).toBe(false);
  });
});

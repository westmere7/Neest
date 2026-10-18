import type { Vec2 } from '@/domain/model/schema';
import { splitWallAt } from '@/domain/commands/walls';
import { projectOnPath } from '@/domain/geometry/wallPath';
import { derivePlan } from '@/domain/geometry/derive';
import type { MenuItem } from '@/components/ContextMenu';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore, type SelItem } from '@/state/editorStore';
import { useDialogStore } from '@/state/uiStores';
import {
  deleteSelection,
  duplicateSelection,
  flipOpening,
  reverseWall,
  rotateSelection,
  selectAll,
  toggleLockSelection,
} from '@/features/editor/actions';
import { groupSelection, groupState, saveSelectionToLibrary, ungroupSelection } from '@/features/editor/groups';

export function planContextMenuItems(hit: SelItem | null, world: Vec2): MenuItem[] {
  const project = useProjectStore.getState().project;
  if (!project) return [];
  const ed = useEditorStore.getState();
  if (!hit) {
    return [
      { label: 'Select all', shortcut: 'Ctrl+A', run: selectAll },
      { label: 'Fit plan to view', shortcut: 'F', run: () => ed.requestFit() },
      { separator: true, label: '' },
      { label: 'Draw walls', shortcut: 'W', run: () => ed.setTool('wall') },
      { label: 'Draw room', shortcut: 'R', run: () => ed.setTool('room') },
    ];
  }
  const items: MenuItem[] = [];
  if (hit.kind === 'object') {
    const o = project.objects[hit.id];
    const g = groupState(project);
    const gid = o?.groupId;
    items.push(
      ...(g.canGroup ? [{ label: `Group ${g.count} items`, shortcut: 'Ctrl+G', run: groupSelection }] : []),
      ...(g.canUngroup ? [{ label: g.groupName ? `Ungroup “${g.groupName}”` : 'Ungroup', shortcut: 'Ctrl+Shift+G', run: ungroupSelection }] : []),
      ...(gid
        ? [
            {
              label: 'Group name & description…',
              run: () => useDialogStore.getState().open('group-details', { kind: 'placed', id: gid }),
            },
          ]
        : []),
      ...(g.count >= 1 ? [{ label: g.count > 1 || gid ? 'Save to library as a group' : 'Save to library', run: () => void saveSelectionToLibrary() }] : []),
      ...(g.canGroup || g.canUngroup || g.count >= 1 ? [{ separator: true, label: '' }] : []),
      { label: 'Duplicate', shortcut: 'Ctrl+D', run: duplicateSelection },
      { label: 'Rotate 90°', shortcut: 'Q', run: () => rotateSelection(Math.PI / 2), disabled: o?.locked },
      { label: o?.locked ? 'Unlock' : 'Lock', shortcut: 'Ctrl+L', run: toggleLockSelection },
      { separator: true, label: '' },
      { label: 'Delete', shortcut: 'Del', danger: true, run: () => void deleteSelection(), disabled: o?.locked },
    );
  } else if (hit.kind === 'wall') {
    const w = project.walls[hit.id];
    items.push(
      {
        label: 'Split wall here',
        disabled: w?.locked,
        run: () => {
          const g = derivePlan(project).network.walls.get(hit.id);
          if (!g) return;
          const s = projectOnPath(g.path, world).s;
          useProjectStore.getState().execute('Split wall', (d) => {
            splitWallAt(d, hit.id, s);
          });
        },
      },
      { label: 'Add door here', disabled: w?.locked, run: () => ed.set({ tool: 'opening', openingKind: 'door-single' }) },
      { label: 'Swap wall sides', run: () => reverseWall(hit.id) },
      { label: w?.locked ? 'Unlock wall' : 'Lock wall', shortcut: 'Ctrl+L', run: toggleLockSelection },
      { separator: true, label: '' },
      { label: 'Delete wall', shortcut: 'Del', danger: true, run: () => void deleteSelection(), disabled: w?.locked },
    );
  } else if (hit.kind === 'opening') {
    const o = project.openings[hit.id];
    const isDoor = o && !o.kind.startsWith('window');
    items.push(
      { label: 'Duplicate', shortcut: 'Ctrl+D', run: duplicateSelection },
      { label: isDoor ? 'Flip swing side' : 'Flip inside/outside', run: () => flipOpening(hit.id, 'side') },
      ...(isDoor ? [{ label: 'Flip hinge side', run: () => flipOpening(hit.id, 'hinge') }] : []),
      { separator: true, label: '' },
      { label: 'Delete', shortcut: 'Del', danger: true, run: () => void deleteSelection() },
    );
  } else if (hit.kind === 'room') {
    items.push(
      { label: 'Rename room', run: () => window.dispatchEvent(new CustomEvent('neest:focus-name')) },
      { label: 'Fit plan to view', shortcut: 'F', run: () => ed.requestFit() },
      { separator: true, label: '' },
      { label: 'Delete room walls…', danger: true, run: () => void deleteSelection() },
    );
  }
  return items;
}

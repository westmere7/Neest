import type { Vec2 } from '@/domain/model/schema';
import { deleteCallouts, duplicateCallouts, updateCallout } from '@/domain/commands/callouts';
import { getObjectAsset } from '@/data/assets/registry';
import type { MenuItem } from '@/components/ContextMenu';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore, type SelItem } from '@/state/editorStore';
import { useDialogStore } from '@/state/uiStores';
import { createCalloutAt, spotOnItem } from '@/features/plan-2d/tools/calloutTool';
import { selectAll } from '@/features/editor/actions';

/** Turns dedicated Comments & Notes mode on or off. */
export function setNotesMode(on: boolean): void {
  const ed = useEditorStore.getState();
  if (on === ed.notesMode) return;
  if (on) {
    const keep = ed.selection.filter((s) => s.kind === 'callout');
    ed.set({
      notesMode: true,
      servicesMode: false,
      layersPanelOpen: false,
      materialPicker: null,
      selection: keep,
      hoveredNoteId: null,
      hover: null,
      tool: 'callout',
      hint: null,
      snapLabel: null,
      ...(ed.workspace === 'walk' ? { workspace: '3d' } : {}),
    });
  } else {
    ed.set({
      notesMode: false,
      hoveredNoteId: null,
      hover: null,
      tool: ed.tool === 'callout' ? 'select' : ed.tool,
      hint: null,
      snapLabel: null,
    });
  }
}

export function toggleNotesMode(): void {
  setNotesMode(!useEditorStore.getState().notesMode);
}

/**
 * Hovering a comment in the Comments panel highlights the comment and, if it is tied to an object
 * or room, highlights that object or room in 2D and 3D.
 */
export function hoverNoteInPanel(id: string | null): void {
  const ed = useEditorStore.getState();
  if (!id) {
    ed.set({ hoveredNoteId: null, hover: null });
    return;
  }
  const project = useProjectStore.getState().project;
  const c = project?.callouts?.[id];
  let hover: SelItem | null = { kind: 'callout', id };
  if (c?.target.kind === 'object' && project?.objects[c.target.objectId]) {
    hover = { kind: 'object', id: c.target.objectId };
  } else if (c?.target.kind === 'room' && project?.rooms[c.target.roomId]) {
    hover = { kind: 'room', id: c.target.roomId };
  }
  ed.set({ hoveredNoteId: id, hover });
}

/** Right-click menu in Comments mode (2D and 3D): only comment-related actions. */
export function notesMenuItems(hit: SelItem | null, world: Vec2): MenuItem[] {
  const ps = useProjectStore.getState();
  const project = ps.project;
  if (!project) return [];
  const ed = useEditorStore.getState();
  const px = 1 / Math.max(1, ed.planCamera.zoom);

  if (hit?.kind === 'callout' && project.callouts?.[hit.id]) {
    const c = project.callouts[hit.id];
    const isGeneral = c.target.kind === 'general';
    return [
      { label: 'Edit comment…', run: () => useDialogStore.getState().open('callout', { id: c.id }) },
      ...(!isGeneral
        ? [
            {
              label: 'Focus on plan',
              shortcut: 'F',
              run: () => {
                ed.setSelection([{ kind: 'callout', id: c.id }]);
                ed.requestFocus();
              },
            },
            {
              label: c.hidden ? 'Show on plan' : 'Hide on plan',
              run: () => ps.execute(c.hidden ? 'Show comment' : 'Hide comment', (d) => updateCallout(d, c.id, { hidden: !c.hidden })),
            },
          ]
        : []),
      {
        label: 'Duplicate',
        shortcut: 'Ctrl+D',
        run: () => {
          const ids = ps.execute('Duplicate comment', (d) => duplicateCallouts(d, [c.id], { x: 0.3, y: 0.3 }));
          if (ids?.length) ed.setSelection(ids.map((id) => ({ kind: 'callout', id })));
        },
      },
      { separator: true, label: '' },
      {
        label: 'Delete comment',
        shortcut: 'Del',
        danger: true,
        run: () => {
          ps.execute('Delete comment', (d) => deleteCallouts(d, [c.id]));
          ed.clearSelection();
        },
      },
    ];
  }

  const items: MenuItem[] = [];
  if (hit?.kind === 'object' && project.objects[hit.id]) {
    const o = project.objects[hit.id];
    const name = o.name || getObjectAsset(project, o)?.name || 'item';
    items.push({
      label: `Comment on "${name}"…`,
      run: () => void createCalloutAt(spotOnItem(project, hit.id), px),
    });
  } else if (hit?.kind === 'room' && project.rooms[hit.id]) {
    const r = project.rooms[hit.id];
    items.push({
      label: `Comment on "${r.name}"…`,
      run: () => void createCalloutAt({ kind: 'room', roomId: hit.id }, px),
    });
  }

  items.push(
    { label: 'Add spot comment here…', run: () => void createCalloutAt({ kind: 'point', x: world.x, y: world.y, z: 0 }, px) },
    { label: 'Add general comment…', run: () => void createCalloutAt({ kind: 'general' }, px) },
    { separator: true, label: '' },
    { label: 'Select all comments', shortcut: 'Ctrl+A', run: selectAll },
    { label: 'Fit plan to view', shortcut: 'F', run: () => ed.requestFit() },
    { separator: true, label: '' },
    { label: 'Leave Comments mode', shortcut: 'K', run: () => setNotesMode(false) },
  );
  return items;
}

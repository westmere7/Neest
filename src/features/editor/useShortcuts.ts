import { useEffect } from 'react';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore, type ToolId } from '@/state/editorStore';
import { useDialogStore, toast } from '@/state/uiStores';
import { isEditableTarget } from '@/components/hooks';
import { planKeyRouter } from '@/features/plan-2d/PlanCanvas';
import { flushSave } from '../projects/projectService';
import { deleteSelection, duplicateSelection, nudgeSelection, rotateSelection, selectAll, toggleLockSelection } from './actions';
import { groupSelection, ungroupSelection } from './groups';

export const TOOL_SHORTCUTS: Record<string, ToolId> = {
  v: 'select',
  h: 'pan',
  w: 'wall',
  c: 'curve',
  r: 'room',
  d: 'opening',
  m: 'measure',
  k: 'callout',
  s: 'split',
  e: 'extend',
};

export const SHORTCUT_LIST: { keys: string; action: string }[] = [
  { keys: 'V', action: 'Select / move' },
  { keys: 'H or Space-drag', action: 'Pan (2D & 3D)' },
  { keys: 'Two-finger swipe (trackpad)', action: 'Pan (2D) · Orbit camera (3D) · Look around (Walk)' },
  { keys: 'Shift + two-finger swipe', action: 'Pan camera (3D) · Move (Walk)' },
  { keys: 'Pinch / Option-scroll', action: 'Zoom in 2D & 3D · Walk forward/back' },
  { keys: 'W', action: 'Draw walls (chain)' },
  { keys: 'C', action: 'Draw curved wall' },
  { keys: 'R', action: 'Draw rectangular room' },
  { keys: 'D', action: 'Insert door / window' },
  { keys: 'S', action: 'Split wall' },
  { keys: 'E', action: 'Extend / trim / join walls' },
  { keys: 'M', action: 'Measure' },
  { keys: 'K', action: 'Callout (click an item or spot, Alt-click a room, drag an area)' },
  { keys: 'Shift (while drawing)', action: 'Lock angle to 45° steps' },
  { keys: 'Shift (while moving)', action: 'Keep the move on one axis (X or Y)' },
  { keys: 'Alt (while dragging)', action: 'Disable snapping' },
  { keys: 'Digits + Enter', action: 'Exact length while drawing' },
  { keys: 'A (curved wall)', action: 'Switch 3-point arc / free bend' },
  { keys: 'F (measuring on a wall face)', action: 'Clear distance to the opposite face' },
  { keys: 'Ctrl+Z / Ctrl+Shift+Z', action: 'Undo / redo' },
  { keys: 'Delete', action: 'Delete selection' },
  { keys: 'Ctrl+D', action: 'Duplicate' },
  { keys: 'Q', action: 'Rotate selection 90°' },
  { keys: 'Arrows (Shift ×10)', action: 'Nudge selection' },
  { keys: 'Ctrl+L', action: 'Lock / unlock selection' },
  { keys: 'Ctrl+G / Ctrl+Shift+G', action: 'Group / ungroup items' },
  { keys: 'Right-click', action: 'Menu for the item under the pointer' },
  { keys: 'F', action: 'Fit plan' },
  { keys: 'G', action: 'Toggle grid' },
  { keys: '1 / 2', action: 'Outline / 2D plan' },
  { keys: '4 / 5', action: '3D view / split view' },
  { keys: 'P (3D view)', action: 'Show / hide the 3D view panel' },
  { keys: 'Tab or \\', action: 'Hide / show interface' },
  { keys: 'Esc', action: 'Cancel, back to select, clear selection, show interface' },
  { keys: '?', action: 'Show shortcuts' },
];

/** Global editor keyboard handling; the active plan tool gets first refusal. */
export function useEditorShortcuts(isMobile: boolean) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isEditableTarget(e.target)) return;
      if (useDialogStore.getState().openDialog || useDialogStore.getState().confirm) return;
      const ed = useEditorStore.getState();
      const ps = useProjectStore.getState();
      const planActive = ed.workspace === 'plan' || ed.workspace === 'split';
      // Editing (tools, nudge, rotate) also works in the 3D view.
      const editActive = planActive || ed.workspace === '3d';
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (editActive && planKeyRouter.current?.(e)) {
        e.preventDefault();
        return;
      }

      if (e.key === 'Escape') {
        if (planKeyRouter.cancel?.()) return;
        if (ed.tool !== 'select') return ed.setTool('select');
        if (ed.selection.length) return ed.clearSelection();
        if (ed.chromeHidden) return ed.set({ chromeHidden: false });
        if (ed.workspace === 'walk') return ed.set({ workspace: '3d' });
        return;
      }
      if (mod && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) ps.redo();
        else ps.undo();
        return;
      }
      if (mod && key === 'y') {
        e.preventDefault();
        ps.redo();
        return;
      }
      if (mod && key === 's') {
        e.preventDefault();
        void flushSave().then(() => toast.success('Saved locally'));
        return;
      }
      if (mod && key === 'e') {
        e.preventDefault();
        useDialogStore.getState().open('export');
        return;
      }
      if (mod && key === 'd') {
        e.preventDefault();
        duplicateSelection();
        return;
      }
      if (mod && key === 'a') {
        e.preventDefault();
        selectAll();
        return;
      }
      if (mod && key === 'g') {
        e.preventDefault();
        if (e.shiftKey) ungroupSelection();
        else groupSelection();
        return;
      }
      if (mod && key === 'l') {
        e.preventDefault();
        toggleLockSelection();
        return;
      }
      if (mod) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        void deleteSelection();
        return;
      }
      // Tab toggles the interface when nothing interactive has focus (on a button or in a dialog
      // it still moves focus, so keyboard navigation keeps working); \ always toggles.
      const focusFree = !document.activeElement?.closest('[role=dialog], [role=menu], [role=listbox], .dialog');
      if (e.key === '\\' || (e.key === 'Tab' && !e.shiftKey && !e.altKey && focusFree)) {
        e.preventDefault();
        ed.set({ chromeHidden: !ed.chromeHidden });
        return;
      }
      if (e.key === '?') {
        useDialogStore.getState().open('shortcuts');
        return;
      }
      if (e.key.startsWith('Arrow') && ed.selection.length && editActive) {
        e.preventDefault();
        const step = (ps.project?.settings.gridSize ?? 0.1) * (e.shiftKey ? 10 : 1);
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        nudgeSelection(dx, dy);
        return;
      }
      if (key === 'q') return rotateSelection(e.shiftKey ? -Math.PI / 2 : Math.PI / 2);
      if (key === 'f') return ed.requestFit();
      if (key === 'g') return ed.set({ gridVisible: !ed.gridVisible });
      if (key === '1') return ed.set({ workspace: 'plan', planMode: 'draft' });
      if (key === '2') return ed.set({ workspace: 'plan', planMode: 'furnished' });
      if (key === '4') return ed.set({ workspace: '3d' });
      if (key === '5' && !isMobile) return ed.set({ workspace: 'split' });
      if (key === 'p' && ed.workspace === '3d' && !isMobile) return ed.set({ viewPanelOpen: !ed.viewPanelOpen });
      // While placing, R turns what is being placed (the tool handles it when it has the keys; this is
      // the fallback): it never switches to the room tool under a ghost.
      if (key === 'r' && !mod && (ed.tool === 'place' || ed.tool === 'opening')) {
        if (ed.tool === 'place') ed.set({ placeRotation: (ed.placeRotation + (e.shiftKey ? -Math.PI / 2 : Math.PI / 2) + Math.PI * 2) % (Math.PI * 2) });
        return;
      }
      const tool = TOOL_SHORTCUTS[key];
      if (tool && editActive) {
        if (isMobile && tool !== 'select' && tool !== 'pan') return;
        ed.setTool(tool);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMobile]);
}

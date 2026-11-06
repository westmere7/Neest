import { useEffect } from 'react';
import type { Vec2 } from '@/domain/model/schema';
import { clipboardText, copyPayload, parseClipboard, pasteObjects, payloadCentre, type ClipboardPayload } from '@/domain/commands/clipboard';
import { deleteEntities, pruneGroups } from '@/domain/commands/entities';
import { isObjectLocked } from '@/domain/commands/itemLayers';
import { getAsset } from '@/data/assets/registry';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore } from '@/state/editorStore';
import { toast } from '@/state/uiStores';
import { isolationGroupFor } from './isolation';

/**
 * Copy, cut and paste of placed items (and groups), through the system clipboard, so they paste into
 * another tab, window, project or layout option. The keys use the browser's own copy / cut / paste
 * events (no permission prompt); the menu commands use the Clipboard API, with a same-browser copy in
 * localStorage when it is refused. Text fields keep their own copy and paste.
 *
 * Where a paste lands: back in the plan it came from (same project and option) each paste steps a
 * little further from the originals; anywhere else the items keep their places (layout options of one
 * flat share their walls), and "Paste here" centres them on the clicked point.
 */

const STORE_KEY = 'neest:clipboard';
let lastPaste: { copiedAt: number; n: number } | null = null;

const es = () => useEditorStore.getState();
const ps = () => useProjectStore.getState();

/** Whether the shortcuts may act: an editor is open, no text field or text selection is in the way, no special mode. */
function editorReady(e?: Event): boolean {
  const ed = es();
  if (!ps().project || ed.shapeEdit || ed.notesMode) return false;
  const t = (e?.target ?? document.activeElement) as HTMLElement | null;
  if (t && (t.closest?.('input, textarea, select, [contenteditable="true"], [contenteditable=""]') || t.isContentEditable)) return false;
  const sel = window.getSelection?.();
  return !(sel && !sel.isCollapsed && sel.toString().trim());
}

/** Snapshot of the selected items, or null (with a note when the selection has no items). */
function selectionPayload(quiet = false): ClipboardPayload | null {
  const p = ps().project;
  if (!p) return null;
  const sel = es().selection;
  const ids = sel.filter((s) => s.kind === 'object').map((s) => s.id);
  const payload = copyPayload(p, ids);
  if (!payload) {
    if (sel.length && !quiet) toast.info('Only furniture and other items can be copied', 'Walls, doors, windows and notes are not copied.');
    return null;
  }
  if (sel.length > payload.objects.length && !quiet) toast.info('Only the items were copied', 'Walls, doors, windows and notes in the selection are not copied.');
  return payload;
}

function remember(text: string): void {
  try {
    localStorage.setItem(STORE_KEY, text);
  } catch {
    // Storage full or blocked: the system clipboard still has it.
  }
}

function copied(payload: ClipboardPayload, cut: boolean): void {
  const n = payload.objects.length;
  toast.success(`${cut ? 'Cut' : 'Copied'} ${n} item${n === 1 ? '' : 's'}`, 'Paste with Ctrl+V, here or in another tab or project.');
}

/** Removes the cut items (locked ones stay). */
function removeCut(payload: ClipboardPayload): void {
  const p = ps().project!;
  const ids = payload.objects.map((o) => o.id).filter((id) => p.objects[id] && !isObjectLocked(p, p.objects[id]) && !p.layers.furniture.locked);
  if (!ids.length) return;
  ps().execute(`Cut ${ids.length} item${ids.length === 1 ? '' : 's'}`, (d) => deleteEntities(d, ids));
  es().clearSelection();
  if (ids.length < payload.objects.length) toast.info('Locked items were copied but not removed');
}

/** Copies (or cuts) the selected items with the Clipboard API (menu commands). */
export async function copySelection(cut = false): Promise<void> {
  const payload = selectionPayload();
  if (!payload) return;
  const text = clipboardText(payload);
  remember(text);
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Refused (no focus or permission): the copy in localStorage still pastes in this browser.
  }
  copied(payload, cut);
  if (cut) removeCut(payload);
}

/** Pastes a snapshot: stepped beside the originals back home, in place elsewhere, or centred on `at`. */
export function pastePayload(payload: ClipboardPayload, at?: Vec2, inPlace = false): string[] {
  const p = ps().project;
  if (!p) return [];
  const home = payload.projectId === p.id && payload.optionId === (p.activeOptionId ?? null);
  let offset: Vec2 = { x: 0, y: 0 };
  if (at) {
    const c = payloadCentre(payload);
    offset = { x: at.x - c.x, y: at.y - c.y };
  } else if (home && !inPlace && payload.objects.some((o) => p.objects[o.id])) {
    // Each paste of the same copy steps one more grid step from the originals.
    const n = lastPaste?.copiedAt === payload.copiedAt ? lastPaste.n + 1 : 1;
    lastPaste = { copiedAt: payload.copiedAt, n };
    const step = Math.max(p.settings.gridSize, 0.1) * 3 * n;
    offset = { x: step, y: step };
  }
  const result = ps().execute(`Paste ${payload.objects.length} item${payload.objects.length === 1 ? '' : 's'}`, (d) =>
    {
      const r = pasteObjects(d, payload, offset, (id) => !!getAsset(p, id));
      // Pasted inside an isolated group: the items join it (and form no group of their own).
      const iso = isolationGroupFor(d);
      if (iso) {
        for (const id of r.ids) d.objects[id].groupId = iso;
        pruneGroups(d);
      }
      return r;
    },
  );
  if (!result) return [];
  if (result.skipped) toast.warning(`${result.skipped} item${result.skipped === 1 ? '' : 's'} not pasted`, 'Their content pack is not installed here.');
  if (!result.ids.length) return [];
  const ed = es();
  const workspace = ed.workspace === 'walk' ? '3d' : ed.workspace;
  ed.set({ tool: 'select', workspace, selection: result.ids.map((id) => ({ kind: 'object', id })) });
  // From another project the items may land out of view: bring them in.
  if (payload.projectId !== p.id) ed.requestFocus();
  return result.ids;
}

/** Reads Neest's clipboard: the system clipboard, else this browser's last copy. */
async function readPayload(): Promise<ClipboardPayload | null> {
  try {
    const fromSystem = parseClipboard(await navigator.clipboard.readText());
    if (fromSystem) return fromSystem;
  } catch {
    // Refused: fall back to this browser's copy.
  }
  try {
    return parseClipboard(localStorage.getItem(STORE_KEY));
  } catch {
    return null;
  }
}

/** Pastes from the clipboard (menu commands); `at` centres the items on a point ("Paste here"). */
export async function pasteFromClipboard(at?: Vec2): Promise<void> {
  if (!editorReady()) return;
  const payload = await readPayload();
  if (!payload) {
    toast.info('Nothing to paste', 'Copy items first (Ctrl+C), in this or another Neest tab.');
    return;
  }
  pastePayload(payload, at);
}

/** Ctrl+C / Ctrl+X / Ctrl+V on the page while an editor is open (Ctrl+Shift+V pastes in place). */
export function useItemClipboard(): void {
  useEffect(() => {
    let shiftHeld = false;
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'v' && (e.ctrlKey || e.metaKey)) shiftHeld = e.shiftKey;
    };
    const onCopy = (e: ClipboardEvent) => {
      if (!editorReady(e) || !es().selection.length) return;
      const payload = selectionPayload();
      if (!payload) return;
      const text = clipboardText(payload);
      e.clipboardData?.setData('text/plain', text);
      e.preventDefault();
      remember(text);
      const cut = e.type === 'cut';
      copied(payload, cut);
      if (cut) removeCut(payload);
    };
    const onPaste = (e: ClipboardEvent) => {
      if (!editorReady(e)) return;
      const payload = parseClipboard(e.clipboardData?.getData('text/plain'));
      if (!payload) return;
      e.preventDefault();
      pastePayload(payload, undefined, shiftHeld);
    };
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('copy', onCopy);
    document.addEventListener('cut', onCopy);
    document.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('cut', onCopy);
      document.removeEventListener('paste', onPaste);
    };
  }, []);
}

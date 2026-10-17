import { useEffect, useState } from 'react';
import { ArrowLeft, RotateCcw, X } from 'lucide-react';
import type { Project } from '@/domain/model/schema';
import { assignMaterial, expandScope, getTargetMaterialId, type MaterialTarget } from '@/domain/commands/entities';
import { OPENING_PRESETS } from '@/domain/model/defaults';
import { assetSlotDefault, getAsset, resolveMaterial } from '@/data/assets/registry';
import { MATERIAL_CATALOG_BY_ID } from '@/data/materials/catalog';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore } from '@/state/editorStore';
import { useDialogStore, usePrefsStore } from '@/state/uiStores';
import { Button, IconButton } from '@/components/ui';
import { differsFromDefault, defaultMaterialFor, FinishPicker, MaterialEditor, resetMaterialToDefault } from './MaterialUI';

/** Name of the thing a finish slot belongs to ("Loft", "Washing machine", "Wall"), or null when it is gone. */
function targetOwner(p: Project, t: MaterialTarget): string | null {
  switch (t.kind) {
    case 'room-floor':
    case 'room-ceiling':
      return p.rooms[t.roomId]?.name ?? null;
    case 'object-slot': {
      const o = p.objects[t.objectId];
      return o ? (o.name ?? getAsset(p, o.assetId)?.name ?? 'Item') : null;
    }
    case 'opening-frame':
    case 'opening-panel': {
      const o = p.openings[t.openingId];
      return o ? OPENING_PRESETS[o.kind].label : null;
    }
    default:
      return p.walls[t.wallId] ? 'Wall' : null;
  }
}

const close = () => useEditorStore.getState().set({ materialPicker: null });

/**
 * Desktop finish picker: a full-height floating panel docked to the left of the Inspector. Opened from a
 * finish slot row (`MaterialSlotRow`); picking applies at once and keeps the panel open. Esc, the close button,
 * the same slot row, a selection change or the Inspector going away close it.
 */
export function MaterialPanel() {
  const req = useEditorStore((s) => s.materialPicker);
  const project = useProjectStore((s) => s.project!);
  const owner = req ? targetOwner(project, req.target) : null;
  const stale = !!req && owner === null;

  useEffect(() => {
    if (stale) close();
  }, [stale]);

  useEffect(() => {
    if (!req) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const dialogs = useDialogStore.getState();
      if (dialogs.openDialog || dialogs.confirm) return;
      // Esc closes the panel first; the next Esc clears the selection as usual.
      e.preventDefault();
      e.stopPropagation();
      close();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [req]);

  // Edit mode: which material is open in the editor (null = browsing). Reset per slot.
  const [editing, setEditing] = useState<{ key: string; id: string } | null>(null);
  if (!req || owner === null) return null;
  const currentId = getTargetMaterialId(project, req.target, assetSlotDefault) ?? req.fallbackId;
  // Back to browsing when the slot changes or the edited material is deleted.
  const editId = editing && editing.key === req.key && (project.materials[editing.id] || MATERIAL_CATALOG_BY_ID[editing.id]) ? editing.id : null;
  const editMat = editId ? resolveMaterial(project, editId) : null;
  const title = `${req.label} · ${owner}`;
  return (
    <aside className="material-panel floating" role="dialog" aria-label={`Choose finish: ${title}`} data-testid="material-panel">
      <header className="material-panel-head">
        <div className="material-panel-titles">
          <span className="material-panel-eyebrow">Finish</span>
          <h2 title={title}>
            {req.label} <span className="material-panel-owner">· {owner}</span>
          </h2>
        </div>
        <IconButton label="Close finishes" shortcut="Esc" onClick={close} data-testid="material-panel-close">
          <X size={15} />
        </IconButton>
      </header>
      <div className="material-panel-body">
        {editMat ? (
          <section className="material-panel-edit" aria-label={`Edit ${editMat.name}`}>
            <div className="material-panel-edit-bar">
              <Button size="sm" variant="ghost" onClick={() => setEditing(null)} data-testid="material-edit-back">
                <ArrowLeft size={14} /> Finishes
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => resetMaterialToDefault(editMat.id)}
                disabled={!differsFromDefault(project, editMat)}
                title={defaultMaterialFor(project, editMat) ? 'Restore the default colour, surface and texture' : 'This finish was made from scratch: it has no default'}
              >
                <RotateCcw size={13} /> Reset to default
              </Button>
            </div>
            <MaterialEditor material={editMat} inPanel />
            {editMat.id !== currentId && (
              <div className="material-panel-use">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    const targets = expandScope(project, req.target, 'this', assetSlotDefault);
                    useProjectStore.getState().execute(`Apply ${editMat.name.toLowerCase()}`, (d) => assignMaterial(d, targets, editMat.id));
                    usePrefsStore.getState().pushRecentMaterial(editMat.id);
                  }}
                >
                  Use for this surface
                </Button>
              </div>
            )}
          </section>
        ) : (
          <FinishPicker key={req.key} target={req.target} currentId={currentId} variant="panel" onClose={close} onEdit={(id) => setEditing({ key: req.key, id })} />
        )}
      </div>
    </aside>
  );
}

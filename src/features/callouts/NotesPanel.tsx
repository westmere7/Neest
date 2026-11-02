import { useMemo, useState } from 'react';
import {
  Box,
  Crosshair,
  Eye,
  EyeOff,
  Home,
  MapPin,
  MessageSquare,
  MessageSquarePlus,
  MessageSquareText,
  Pencil,
  Trash2,
  VectorSquare,
  X,
} from 'lucide-react';
import { CALLOUT_COLORS, type Callout, type CalloutColor, type Project } from '@/domain/model/schema';
import { addCallout, deleteCallouts, updateCallout } from '@/domain/commands/callouts';
import { derivePlan, type DerivedPlan } from '@/domain/geometry/derive';
import { calloutRegionArea } from '@/domain/geometry/callouts';
import { formatArea } from '@/domain/model/units';
import { getObjectAsset } from '@/data/assets/registry';
import { Button, IconButton } from '@/components/ui';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore } from '@/state/editorStore';
import { useDialogStore, usePrefsStore } from '@/state/uiStores';
import { CALLOUT_PALETTE } from './content';
import { CalloutCard } from './CalloutCard';
import { hoverNoteInPanel, setNotesMode } from './actions';

function targetChip(project: Project, derived: DerivedPlan, c: Callout): { icon: React.ReactNode; label: string; kindLabel: string } {
  const t = c.target;
  if (t.kind === 'general') {
    return { icon: <MessageSquare size={12} />, label: 'General', kindLabel: 'General comment' };
  }
  if (t.kind === 'object') {
    const o = project.objects[t.objectId];
    const name = o ? o.name || getObjectAsset(project, o)?.name || 'Item' : 'Item';
    return { icon: <Box size={12} />, label: name, kindLabel: `Object: ${name}` };
  }
  if (t.kind === 'room') {
    const r = project.rooms[t.roomId];
    const name = r?.name || 'Room';
    return { icon: <Home size={12} />, label: name, kindLabel: `Room: ${name}` };
  }
  if (t.kind === 'region') {
    const area = formatArea(calloutRegionArea(t), project.settings.areaUnit, project.settings.precision);
    return { icon: <VectorSquare size={12} />, label: `Area (${area})`, kindLabel: `Area: ${area}` };
  }
  void derived;
  return { icon: <MapPin size={12} />, label: 'Spot', kindLabel: 'Pinned spot' };
}

/**
 * Dedicated Comments & Notes panel (long right-hand floating panel).
 * Shows all project comments together in a single list, lets users add general comments from the
 * panel (or pin comments by clicking/dragging on the canvas), highlights linked objects on hover,
 * and provides full CRUD in dedicated comment mode.
 */
export function NotesPanel() {
  const project = useProjectStore((s) => s.project);
  const execute = useProjectStore((s) => s.execute);
  const selection = useEditorStore((s) => s.selection);
  const setSelection = useEditorStore((s) => s.setSelection);
  const requestFocus = useEditorStore((s) => s.requestFocus);
  const hoveredNoteId = useEditorStore((s) => s.hoveredNoteId);

  const [addingGeneral, setAddingGeneral] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newNote, setNewNote] = useState('');
  const [newColor, setNewColor] = useState<CalloutColor>(() => usePrefsStore.getState().noteStyle?.color ?? 'teal');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editColor, setEditColor] = useState<CalloutColor>('teal');

  const derived = useMemo(() => (project ? derivePlan(project) : null), [project]);
  if (!project || !derived) return null;

  const allNotes = Object.values(project.callouts ?? {});

  const selectedIds = new Set(selection.filter((s) => s.kind === 'callout').map((s) => s.id));
  const layerVisible = project.layers.callouts?.visible ?? true;

  const handleCreateGeneral = () => {
    const title = newTitle.trim();
    const note = newNote.trim();
    if (!title && !note) return;
    const style = usePrefsStore.getState().noteStyle;
    const id = execute('Add general comment', (d) =>
      addCallout(d, {
        ...style,
        color: newColor,
        target: { kind: 'general' },
        title,
        note,
      }),
    );
    setNewTitle('');
    setNewNote('');
    setAddingGeneral(false);
    if (id) setSelection([{ kind: 'callout', id }]);
  };

  const startInlineEdit = (c: Callout) => {
    setEditingId(c.id);
    setEditTitle(c.title);
    setEditNote(c.note);
    setEditColor(c.color);
  };

  const saveInlineEdit = (id: string) => {
    execute('Edit comment', (d) =>
      updateCallout(d, id, {
        title: editTitle.trim(),
        note: editNote,
        color: editColor,
      }),
    );
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    if (hoveredNoteId === id) hoverNoteInPanel(null);
    if (editingId === id) setEditingId(null);
    execute('Delete comment', (d) => deleteCallouts(d, [id]));
    if (selectedIds.has(id)) {
      setSelection(selection.filter((s) => s.id !== id));
    }
  };

  return (
    <aside className="notes-panel floating" aria-label="Comments and notes" data-testid="notes-panel">
      <div className="notes-panel-head">
        <div className="notes-panel-title">
          <MessageSquareText size={15} />
          <span>Comments</span>
          <span className="notes-panel-count" data-testid="notes-count">
            {allNotes.length}
          </span>
        </div>
        <div className="notes-panel-head-actions">
          <IconButton
            label={layerVisible ? 'Hide pinned notes on plan' : 'Show pinned notes on plan'}
            onClick={() => execute('Toggle notes layer', (d) => void (d.layers.callouts.visible = !layerVisible))}
            data-testid="notes-toggle-layer"
          >
            {layerVisible ? <Eye size={14} /> : <EyeOff size={14} />}
          </IconButton>
          <IconButton label="Leave Comments mode" shortcut="K" onClick={() => setNotesMode(false)} data-testid="notes-panel-close">
            <X size={15} />
          </IconButton>
        </div>
      </div>

      {/* Add general comment button + hint */}
      <div className="notes-panel-actions">
        <button
          type="button"
          className={`notes-tool-btn notes-add-btn ${addingGeneral ? 'active' : ''}`}
          onClick={() => {
            setAddingGeneral((v) => !v);
            setEditingId(null);
          }}
          title="Add a general comment"
          data-testid="notes-add-general"
        >
          <MessageSquarePlus size={14} />
          <span>+ Add comment</span>
        </button>
        <div className="notes-mode-hint">
          Click an item or spot, Alt-click a room, or drag an area on the plan to pin a comment.
        </div>
      </div>

      {/* Inline composer for adding a general comment */}
      {addingGeneral && (
        <div className="notes-composer" data-testid="notes-general-composer" onKeyDown={(e) => e.stopPropagation()}>
          <div className="notes-composer-head">
            <span>New comment</span>
            <div className="notes-mini-colors">
              {CALLOUT_COLORS.slice(0, 7).map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  aria-pressed={newColor === c}
                  style={{ background: CALLOUT_PALETTE[c].main }}
                  onClick={() => setNewColor(c)}
                />
              ))}
            </div>
          </div>
          <input
            className="input"
            placeholder="Title (optional)"
            value={newTitle}
            maxLength={120}
            autoFocus
            onChange={(e) => setNewTitle(e.target.value)}
            data-testid="notes-general-title"
          />
          <textarea
            className="input"
            placeholder="Write a comment…"
            rows={3}
            value={newNote}
            maxLength={4000}
            onChange={(e) => setNewNote(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                handleCreateGeneral();
              }
            }}
            data-testid="notes-general-body"
          />
          <div className="notes-composer-foot">
            <Button size="sm" variant="ghost" onClick={() => setAddingGeneral(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" disabled={!newTitle.trim() && !newNote.trim()} onClick={handleCreateGeneral} data-testid="notes-general-submit">
              Add comment
            </Button>
          </div>
        </div>
      )}

      {/* Unified comments list */}
      <div className="notes-panel-list" role="list">
        {allNotes.length === 0 ? (
          <div className="notes-empty" data-testid="notes-empty">
            <p>No comments in this layout yet.</p>
            <span>
              Use <b>+ Add comment</b> for general notes, or click any object, room, or area on the plan to pin a comment.
            </span>
          </div>
        ) : (
          allNotes.map((c) => {
            const chip = targetChip(project, derived, c);
            const isSelected = selectedIds.has(c.id);
            const isHovered = hoveredNoteId === c.id;
            const isEditing = editingId === c.id;
            const isGeneral = c.target.kind === 'general';
            const accent = CALLOUT_PALETTE[c.color].main;

            return (
              <div
                key={c.id}
                role="listitem"
                className={`notes-item ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''} ${c.hidden ? 'is-hidden' : ''}`}
                style={{ '--note-accent': accent } as React.CSSProperties}
                onPointerEnter={() => hoverNoteInPanel(c.id)}
                onPointerLeave={() => hoverNoteInPanel(null)}
                onClick={() => setSelection([{ kind: 'callout', id: c.id }])}
                onDoubleClick={() => useDialogStore.getState().open('callout', { id: c.id })}
                data-testid={`notes-item-${c.id}`}
                data-target-kind={c.target.kind}
              >
                <div className="notes-item-bar">
                  <span className={`notes-target-chip kind-${c.target.kind}`} title={chip.kindLabel}>
                    <span className="notes-color-dot" style={{ background: accent }} />
                    {chip.icon}
                    <span className="notes-target-label">{chip.label}</span>
                  </span>
                  <div className="notes-item-actions" onClick={(e) => e.stopPropagation()}>
                    {!isGeneral && (
                      <>
                        <IconButton
                          label="Focus on plan"
                          onClick={() => {
                            setSelection([{ kind: 'callout', id: c.id }]);
                            requestFocus();
                          }}
                          data-testid={`note-focus-${c.id}`}
                        >
                          <Crosshair size={13} />
                        </IconButton>
                        <IconButton
                          label={c.hidden ? 'Show on plan' : 'Hide on plan'}
                          onClick={() => execute(c.hidden ? 'Show comment' : 'Hide comment', (d) => updateCallout(d, c.id, { hidden: !c.hidden }))}
                          data-testid={`note-vis-${c.id}`}
                        >
                          {c.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                        </IconButton>
                      </>
                    )}
                    <IconButton
                      label="Edit comment"
                      active={isEditing}
                      onClick={() => (isEditing ? setEditingId(null) : startInlineEdit(c))}
                      data-testid={`note-edit-${c.id}`}
                    >
                      <Pencil size={13} />
                    </IconButton>
                    <IconButton
                      label="Delete comment"
                      onClick={() => handleDelete(c.id)}
                      data-testid={`note-delete-${c.id}`}
                    >
                      <Trash2 size={13} />
                    </IconButton>
                  </div>
                </div>

                {isEditing ? (
                  <div className="notes-inline-edit" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                    <input
                      className="input"
                      placeholder="Title (optional)"
                      value={editTitle}
                      maxLength={120}
                      autoFocus
                      onChange={(e) => setEditTitle(e.target.value)}
                      data-testid={`note-edit-title-${c.id}`}
                    />
                    <textarea
                      className="input"
                      placeholder="Write a comment…"
                      rows={3}
                      value={editNote}
                      maxLength={4000}
                      onChange={(e) => setEditNote(e.target.value)}
                      onKeyDown={(e) => {
                        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                          e.preventDefault();
                          saveInlineEdit(c.id);
                        }
                      }}
                      data-testid={`note-edit-body-${c.id}`}
                    />
                    <div className="notes-inline-foot">
                      <div className="notes-mini-colors">
                        {CALLOUT_COLORS.slice(0, 7).map((col) => (
                          <button
                            key={col}
                            type="button"
                            aria-label={col}
                            aria-pressed={editColor === col}
                            style={{ background: CALLOUT_PALETTE[col].main }}
                            onClick={() => setEditColor(col)}
                          />
                        ))}
                      </div>
                      <div className="notes-inline-btns">
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          Cancel
                        </Button>
                        <Button size="sm" variant="primary" onClick={() => saveInlineEdit(c.id)} data-testid={`note-edit-save-${c.id}`}>
                          Save
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="notes-item-body">
                    <CalloutCard project={project} derived={derived} callout={c} />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}

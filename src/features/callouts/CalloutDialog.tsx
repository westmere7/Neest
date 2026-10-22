import { useMemo, useRef, useState } from 'react';
import { Dialog } from '@/components/Overlays';
import { Button, LengthField, Segmented, Toggle } from '@/components/ui';
import { CALLOUT_COLORS, type Callout, type CalloutTarget, type Project } from '@/domain/model/schema';
import { derivePlan } from '@/domain/geometry/derive';
import { calloutAnchor } from '@/domain/geometry/callouts';
import { pointInFace } from '@/domain/geometry/rooms';
import { pointInPolygon, rectPolygon } from '@/domain/geometry/polygon';
import { deleteEntities } from '@/domain/commands/entities';
import { updateCallout } from '@/domain/commands/callouts';
import { getObjectAsset } from '@/data/assets/registry';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore } from '@/state/editorStore';
import { CALLOUT_PALETTE, safeHref } from './content';
import { CalloutCard } from './CalloutCard';

type TargetKind = CalloutTarget['kind'];

/** The targets a callout can switch between from where it is now: the spot, the item and room under it, its area. */
function targetChoices(project: Project, c: Callout): { kind: TargetKind; label: string; target: CalloutTarget }[] {
  const derived = derivePlan(project);
  const a = calloutAnchor(project, derived, c.target);
  if (!a) return [];
  const p = { x: a.x, y: a.y };
  const out: { kind: TargetKind; label: string; target: CalloutTarget }[] = [];
  out.push({ kind: 'point', label: 'Spot', target: c.target.kind === 'point' ? c.target : { kind: 'point', x: a.x, y: a.y, z: a.z } });
  const item =
    c.target.kind === 'object'
      ? project.objects[c.target.objectId]
      : Object.values(project.objects)
          .filter((o) => !o.hidden && pointInPolygon(p, rectPolygon(o.x, o.y, o.width, o.depth, o.rotation)))
          .sort((x, y) => x.width * x.depth - y.width * y.depth)[0];
  if (item) out.push({ kind: 'object', label: `Item: ${item.name || getObjectAsset(project, item)?.name || 'item'}`, target: { kind: 'object', objectId: item.id } });
  let room = c.target.kind === 'room' ? project.rooms[c.target.roomId] : undefined;
  if (!room)
    derived.faces.forEach((face, i) => {
      const r = derived.faceRooms[i];
      if (r && !room && pointInFace(p, face)) room = r;
    });
  if (room) out.push({ kind: 'room', label: `Room: ${room.name}`, target: { kind: 'room', roomId: room.id } });
  if (c.target.kind === 'region') out.push({ kind: 'region', label: 'Area', target: c.target });
  return out;
}

/**
 * The callout pop-up: what it points to, its title and note (with a small formatting toolbar and
 * links), the target's facts, colour, 3D float height and visibility. Changes apply on Save as one
 * undo step; Cancel on a callout that was just placed removes it again.
 */
export function CalloutDialog({ id, isNew, onClose }: { id: string; isNew?: boolean; onClose: () => void }) {
  const project = useProjectStore((s) => s.project);
  const callout = project?.callouts?.[id];
  const [draft, setDraft] = useState<Callout | null>(() => (callout ? structuredClone(callout) : null));
  const [link, setLink] = useState<{ text: string; url: string } | null>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const choices = useMemo(() => (project && callout ? targetChoices(project, callout) : []), [project, callout]);
  const derived = useMemo(() => (project ? derivePlan(project) : null), [project]);
  if (!project || !callout || !draft) return null;
  const s = project.settings;
  const set = (patch: Partial<Callout>) => setDraft({ ...draft, ...patch });

  const close = (saved: boolean) => {
    if (!saved && isNew) {
      // A callout that was just placed and never saved is removed again.
      useProjectStore.getState().execute('Remove callout', (d) => deleteEntities(d, [id]));
      useEditorStore.getState().clearSelection();
    }
    onClose();
  };
  const save = () => {
    const { id: _id, ...patch } = draft;
    useProjectStore.getState().execute(isNew ? 'Add callout' : 'Edit callout', (d) => updateCallout(d, id, patch));
    onClose();
  };
  const remove = () => {
    useProjectStore.getState().execute('Delete callout', (d) => deleteEntities(d, [id]));
    useEditorStore.getState().clearSelection();
    onClose();
  };

  /** Wraps the note selection (or inserts a placeholder) with markers. */
  const wrap = (before: string, after: string, placeholder: string) => {
    const el = noteRef.current;
    const v = draft.note;
    const a = el?.selectionStart ?? v.length;
    const b = el?.selectionEnd ?? v.length;
    const inner = v.slice(a, b) || placeholder;
    const next = v.slice(0, a) + before + inner + after + v.slice(b);
    set({ note: next.slice(0, 4000) });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(a + before.length, a + before.length + inner.length);
    });
  };
  /** Prefixes the selected lines with a list marker. */
  const listify = (numbered: boolean) => {
    const el = noteRef.current;
    const v = draft.note;
    const a = el?.selectionStart ?? v.length;
    const b = el?.selectionEnd ?? v.length;
    const start = v.lastIndexOf('\n', a - 1) + 1;
    const endNl = v.indexOf('\n', b);
    const end = endNl < 0 ? v.length : endNl;
    const lines = v.slice(start, end).split('\n');
    const body = lines.map((l, i) => (numbered ? `${i + 1}. ` : '- ') + l.replace(/^([-*•]|\d+[.)])\s+/, '')).join('\n');
    set({ note: (v.slice(0, start) + body + v.slice(end)).slice(0, 4000) });
    requestAnimationFrame(() => el?.focus());
  };
  const insertLink = () => {
    if (!link) return;
    const href = safeHref(link.url);
    if (!href) return;
    const el = noteRef.current;
    const v = draft.note;
    const a = el?.selectionStart ?? v.length;
    const b = el?.selectionEnd ?? v.length;
    const text = link.text.trim() || href;
    set({ note: (v.slice(0, a) + `[${text}](${href})` + v.slice(b)).slice(0, 4000) });
    setLink(null);
  };
  const openLink = () => {
    const el = noteRef.current;
    const sel = el ? draft.note.slice(el.selectionStart, el.selectionEnd) : '';
    setLink({ text: sel, url: 'https://' });
  };

  const kind = draft.target.kind;
  const preview: Project = { ...project, callouts: { ...project.callouts, [id]: draft } };

  return (
    <Dialog
      title={isNew ? 'New callout' : 'Edit callout'}
      onClose={() => close(false)}
      wide
      testId="callout-dialog"
      footer={
        <>
          {!isNew && (
            <Button variant="ghost" onClick={remove} data-testid="callout-delete">
              Delete
            </Button>
          )}
          <span style={{ flex: 1 }} />
          <Button variant="ghost" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} data-testid="callout-save">
            Save
          </Button>
        </>
      }
    >
      <div className="callout-editor" onKeyDown={(e) => e.stopPropagation()}>
        <div>
          {choices.length > 1 && (
            <div className="field">
              <span className="field-label">Points to</span>
              <Segmented
                label="Points to"
                size="sm"
                value={kind}
                options={choices.map((c) => ({ value: c.kind, label: c.label }))}
                onChange={(k) => {
                  const c = choices.find((x) => x.kind === k);
                  if (c) set({ target: c.target });
                }}
              />
            </div>
          )}
          {draft.target.kind === 'point' && (
            <LengthField
              label="Spot height"
              value={draft.target.z}
              unit={s.units}
              precision={s.precision}
              min={0}
              max={20}
              onCommit={(z) => draft.target.kind === 'point' && set({ target: { ...draft.target, z } })}
            />
          )}
          <label className="field">
            <span className="field-label">Title</span>
            <input
              className="input"
              value={draft.title}
              maxLength={120}
              data-autofocus
              placeholder={draft.showInfo && kind !== 'point' ? 'Leave empty to use the item or room name' : 'Optional'}
              onChange={(e) => set({ title: e.target.value })}
              data-testid="callout-title"
            />
          </label>
          <div className="field">
            <span className="field-label">Note</span>
            <div className="callout-toolbar" role="toolbar" aria-label="Formatting">
              <button type="button" title="Bold (Ctrl+B)" onClick={() => wrap('**', '**', 'bold')}>
                <b>B</b>
              </button>
              <button type="button" title="Italic (Ctrl+I)" onClick={() => wrap('*', '*', 'italic')}>
                <i>I</i>
              </button>
              <button type="button" title="Bulleted list" onClick={() => listify(false)}>
                • List
              </button>
              <button type="button" title="Numbered list" onClick={() => listify(true)}>
                1. List
              </button>
              <button type="button" title="Link (Ctrl+K)" onClick={openLink} data-testid="callout-link">
                Link
              </button>
            </div>
            {link && (
              <div className="callout-link-form">
                <input className="input" placeholder="Text" value={link.text} onChange={(e) => setLink({ ...link, text: e.target.value })} />
                <input
                  className="input"
                  placeholder="https://…"
                  value={link.url}
                  autoFocus
                  onChange={(e) => setLink({ ...link, url: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && insertLink()}
                />
                <Button size="sm" onClick={insertLink} disabled={!safeHref(link.url)}>
                  Add
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setLink(null)}>
                  ✕
                </Button>
              </div>
            )}
            <textarea
              ref={noteRef}
              className="input"
              value={draft.note}
              maxLength={4000}
              placeholder="Write a note…"
              onChange={(e) => set({ note: e.target.value })}
              onKeyDown={(e) => {
                if (!(e.ctrlKey || e.metaKey)) return;
                const key = e.key.toLowerCase();
                const run = key === 'b' ? () => wrap('**', '**', 'bold') : key === 'i' ? () => wrap('*', '*', 'italic') : key === 'k' ? openLink : key === 'enter' ? save : null;
                if (!run) return;
                e.preventDefault();
                run();
              }}
              data-testid="callout-note"
            />
            <div className="callout-syntax">**bold** · *italic* · [text](https://…) · lines starting “- ” or “1. ” make lists</div>
          </div>
          {kind !== 'point' && (
            <Toggle
              label={kind === 'object' ? 'Show the item’s name, maker, size and finish' : kind === 'room' ? 'Show the room’s name and area' : 'Show the area’s size'}
              checked={draft.showInfo}
              onChange={(v) => set({ showInfo: v })}
            />
          )}
          <div className="field">
            <span className="field-label">Colour</span>
            <div className="callout-colors">
              {CALLOUT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  aria-pressed={draft.color === c}
                  style={{ background: CALLOUT_PALETTE[c].main }}
                  onClick={() => set({ color: c })}
                />
              ))}
            </div>
          </div>
          <LengthField label="Float height in 3D" value={draft.lift} unit={s.units} precision={s.precision} min={0} max={5} onCommit={(lift) => set({ lift })} />
          <Toggle label="Visible" checked={!draft.hidden} onChange={(v) => set({ hidden: !v })} />
        </div>
        <div>
          <div className="callout-preview-label">Preview</div>
          <div className="callout-preview">
            <CalloutCard project={preview} derived={derived} callout={draft} />
          </div>
        </div>
      </div>
    </Dialog>
  );
}

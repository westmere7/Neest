import type { ReactNode } from 'react';
import type { Callout, Project } from '@/domain/model/schema';
import type { DerivedPlan } from '@/domain/geometry/derive';
import { clipNoteBlocks, parseNote, type Run } from './content';
import { NOTE_SIZE_SCALE, labelColors } from './style';
import { NoteImages } from './NoteImages';
import './callouts.css';

function runs(list: Run[], interactive: boolean): ReactNode[] {
  return list.map((r, i) => {
    let node: ReactNode = r.text;
    if (r.bold) node = <strong>{node}</strong>;
    if (r.italic) node = <em>{node}</em>;
    if (r.href)
      node = interactive ? (
        <a href={r.href} target="_blank" rel="noopener noreferrer" onPointerDown={(e) => e.stopPropagation()}>
          {node}
        </a>
      ) : (
        <span className="callout-link">{node}</span>
      );
    return <span key={i}>{node}</span>;
  });
}

/** Picture glyph: on notes that carry pictures, where the pictures themselves are not shown. */
export const NOTE_IMAGE_GLYPH = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3.5" y="5" width="17" height="14" rx="2" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="M5 17l4.5-4.5 3 3 2.5-2.5L19 17" />
  </svg>
);

/**
 * A callout label as HTML: the 3D overlay, the Notes panel and the Inspector. `images` adds the note's
 * pictures (the full view); elsewhere a small picture badge says it has some. `clip` cuts a long note
 * after a few lines with "…" (floating labels that are not opened).
 */
export function CalloutCard({
  project: _project,
  derived: _derived,
  callout,
  interactive = true,
  selected = false,
  images = false,
  clip = false,
}: {
  project?: Project;
  derived?: DerivedPlan | null;
  callout: Callout;
  interactive?: boolean;
  selected?: boolean;
  images?: boolean;
  /** Cut after `NOTE_MAX_LINES` lines with "…". */
  clip?: boolean;
}) {
  void _project;
  void _derived;
  const colors = labelColors(callout);
  const parsed = parseNote(callout.note);
  const blocks = clip ? clipNoteBlocks(parsed).blocks : parsed;
  const pictures = callout.images.length;
  const lists: ReactNode[] = [];
  let list: { kind: 'bullet' | 'number'; items: ReactNode[]; start?: number } | null = null;
  const flush = () => {
    if (!list) return;
    lists.push(
      list.kind === 'bullet' ? (
        <ul key={lists.length}>{list.items}</ul>
      ) : (
        <ol key={lists.length} start={list.start}>
          {list.items}
        </ol>
      ),
    );
    list = null;
  };
  for (const b of blocks) {
    if (b.kind === 'p') {
      flush();
      lists.push(<p key={lists.length}>{runs(b.runs, interactive)}</p>);
    } else {
      if (!list || list.kind !== b.kind) {
        flush();
        list = { kind: b.kind, items: [], start: b.n };
      }
      list.items.push(<li key={list.items.length}>{runs(b.runs, interactive)}</li>);
    }
  }
  flush();
  return (
    <div
      className={`callout-card box-${callout.box}${selected ? ' selected' : ''}`}
      style={
        {
          '--callout-main': colors.main,
          '--callout-fill': colors.fill ?? 'transparent',
          '--callout-border': colors.stroke ?? 'transparent',
          '--callout-text': colors.text,
          '--callout-link': colors.link,
          '--note-scale': NOTE_SIZE_SCALE[callout.size],
        } as React.CSSProperties
      }
      data-callout={callout.id}
    >
      {lists.length > 0 && <div className="callout-note">{lists}</div>}
      {images && <NoteImages images={callout.images} />}
      {!images && pictures > 0 && (
        <span className="callout-img-badge" title={pictures === 1 ? 'Has a picture' : `Has ${pictures} pictures`} data-testid="note-img-badge">
          {NOTE_IMAGE_GLYPH}
        </span>
      )}
      {!lists.length && !(images && callout.images.length) && <div className="callout-empty">Note</div>}
    </div>
  );
}

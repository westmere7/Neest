import type { ReactNode } from 'react';
import type { Callout, Project } from '@/domain/model/schema';
import type { DerivedPlan } from '@/domain/geometry/derive';
import { calloutInfo, parseNote, type Run } from './content';
import { NOTE_SIZE_SCALE, labelColors } from './style';
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

/** A callout label as HTML: the 3D overlay and the editor's preview. */
export function CalloutCard({
  project,
  derived,
  callout,
  interactive = true,
  selected = false,
}: {
  project: Project;
  derived: DerivedPlan | null;
  callout: Callout;
  interactive?: boolean;
  selected?: boolean;
}) {
  const colors = labelColors(callout);
  const info = callout.showInfo ? calloutInfo(project, derived, callout) : [];
  const title = callout.title.trim() || (info.length ? info.shift()! : '');
  const blocks = parseNote(callout.note);
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
          '--callout-info': colors.info,
          '--callout-link': colors.link,
          '--note-scale': NOTE_SIZE_SCALE[callout.size],
        } as React.CSSProperties
      }
      data-callout={callout.id}
    >
      {title && <div className="callout-title">{title}</div>}
      {info.length > 0 && (
        <div className="callout-info">
          {info.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      )}
      {lists.length > 0 && <div className="callout-note">{lists}</div>}
      {!title && !info.length && !lists.length && <div className="callout-empty">Callout</div>}
    </div>
  );
}

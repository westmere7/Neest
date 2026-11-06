import type { Callout, Project } from '@/domain/model/schema';
import type { DerivedPlan } from '@/domain/geometry/derive';
import { getObjectAsset } from '@/data/assets/registry';

/**
 * Callout content: the note's light formatting and plain-text wrapping that
 * the plan (SVG), the 3D labels, captures (canvas) and DXF all share.
 *
 * Note syntax (a small Markdown subset): **bold**, *italic*, [text](https://…) and bare
 * https:// links; a line starting "- " or "* " is a bullet, "1. " a numbered item; a blank line
 * separates paragraphs.
 */

export interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
  href?: string;
}

export interface Block {
  kind: 'p' | 'bullet' | 'number';
  /** Number shown for numbered items. */
  n?: number;
  runs: Run[];
}

/** Only web and mail links are kept (no javascript: or data: URLs). */
export function safeHref(url: string): string | null {
  const u = url.trim();
  if (/^https?:\/\/[^\s]+$/i.test(u)) return u;
  if (/^mailto:[^\s@]+@[^\s@]+$/i.test(u)) return u;
  if (/^www\.[^\s]+\.[^\s]+$/i.test(u)) return `https://${u}`;
  return null;
}

/** Inline formatting of one line into runs. */
export function parseInline(line: string): Run[] {
  const runs: Run[] = [];
  const push = (r: Run) => {
    if (!r.text) return;
    const last = runs[runs.length - 1];
    if (last && !last.href && !r.href && !!last.bold === !!r.bold && !!last.italic === !!r.italic) last.text += r.text;
    else runs.push(r);
  };
  // Tokens: links, bold, italic, bare URLs.
  const re = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*|_([^_\s][^_]*)_|((?:https?:\/\/|www\.)[^\s)]+)/g;
  let i = 0;
  for (let m = re.exec(line); m; m = re.exec(line)) {
    if (m.index > i) push({ text: line.slice(i, m.index) });
    if (m[1] !== undefined) {
      const href = safeHref(m[2]);
      push(href ? { text: m[1], href } : { text: m[1] });
    } else if (m[3] !== undefined) {
      for (const r of parseInline(m[3])) push({ ...r, bold: true });
    } else if (m[4] !== undefined || m[5] !== undefined) {
      for (const r of parseInline(m[4] ?? m[5])) push({ ...r, italic: true });
    } else if (m[6] !== undefined) {
      const href = safeHref(m[6]);
      push(href ? { text: m[6], href } : { text: m[6] });
    }
    i = m.index + m[0].length;
  }
  if (i < line.length) push({ text: line.slice(i) });
  return runs;
}

/** Parses a note into paragraphs, bullets and numbered items. */
export function parseNote(note: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ kind: 'p', runs: parseInline(para.join(' ')) });
    para = [];
  };
  for (const raw of note.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    const num = /^(\d{1,3})[.)]\s+(.*)$/.exec(line);
    if (bullet) {
      flush();
      blocks.push({ kind: 'bullet', runs: parseInline(bullet[1]) });
    } else if (num) {
      flush();
      blocks.push({ kind: 'number', n: Number(num[1]), runs: parseInline(num[2]) });
    } else para.push(line);
  }
  flush();
  return blocks;
}

/** A rendered line of a callout label. */
export interface Line {
  runs: Run[];
  /** Line role: the title, a fact, a paragraph or list line. */
  role: 'title' | 'info' | 'text';
  /** Indent in characters (list items and their continuation lines). */
  indent: number;
}

/** Wraps runs to at most `width` characters per line (words are kept whole unless longer than a line). */
export function wrapRuns(runs: Run[], width: number, firstPrefix: Run | null, indent: number): Run[][] {
  const lines: Run[][] = [];
  let cur: Run[] = firstPrefix ? [firstPrefix] : [];
  let len = firstPrefix ? firstPrefix.text.length : indent;
  const room = () => Math.max(8, width - indent);
  const add = (r: Run) => {
    const last = cur[cur.length - 1];
    if (last && last.href === r.href && !!last.bold === !!r.bold && !!last.italic === !!r.italic) last.text += r.text;
    else cur.push({ ...r });
    len += r.text.length;
  };
  const newLine = () => {
    const last = cur[cur.length - 1];
    if (last) last.text = last.text.replace(/\s+$/, '');
    lines.push(cur);
    cur = [];
    len = indent;
  };
  // Words may span runs ("*bouclé*." is one word): collect each word's pieces, break only at spaces.
  let word: Run[] = [];
  const flushWord = () => {
    const wlen = word.reduce((n, r) => n + r.text.length, 0);
    if (!wlen) return;
    if (len + wlen > width && len > indent) newLine();
    for (const piece of word) {
      let t = piece.text;
      while (t.length) {
        // A word longer than a line is cut where the line ends.
        if (len >= indent + room()) newLine();
        const take = Math.min(t.length, indent + room() - len);
        add({ ...piece, text: t.slice(0, take) });
        t = t.slice(take);
      }
    }
    word = [];
  };
  for (const run of runs) {
    for (const part of run.text.split(/(\s+)/)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) {
        flushWord();
        if (len > indent) add({ ...run, text: ' ' });
      } else word.push({ ...run, text: part });
    }
  }
  flushWord();
  if (cur.length) lines.push(cur);
  return lines;
}

/** Characters per line of a label. */
export const CALLOUT_WRAP = 34;

/** Most lines a floating note label shows; longer notes end in "…" and open in full when clicked or selected. */
export const NOTE_MAX_LINES = 4;

/** The runs with "…" at the end (trailing spaces and punctuation dropped). */
function withEllipsis(runs: Run[]): Run[] {
  const out = runs.map((r) => ({ ...r }));
  while (out.length && !out[out.length - 1].text.trim()) out.pop();
  if (!out.length) return [{ text: '…' }];
  const last = out[out.length - 1];
  last.text = last.text.trimEnd().replace(/[\s,.;:–-]+$/, '') + '…';
  return out;
}

/**
 * A note's blocks cut to at most `maxLines` wrapped lines (as the labels wrap them), the last kept line
 * ending in "…". `cut` says whether anything was left out.
 */
export function clipNoteBlocks(blocks: Block[], maxLines = NOTE_MAX_LINES, width = CALLOUT_WRAP): { blocks: Block[]; cut: boolean } {
  const out: Block[] = [];
  let used = 0;
  for (const b of blocks) {
    const prefix = b.kind === 'bullet' ? '• ' : b.kind === 'number' ? `${b.n}. ` : '';
    const lines = wrapRuns(b.runs, width, prefix ? { text: prefix } : null, prefix.length);
    const n = Math.max(1, lines.length);
    if (used + n <= maxLines) {
      out.push(b);
      used += n;
      continue;
    }
    const room = maxLines - used;
    if (room > 0) {
      const kept = lines.slice(0, room).map((l, k) => {
        if (k || !prefix || !l[0]?.text.startsWith(prefix)) return l;
        const rest = l[0].text.slice(prefix.length);
        return rest ? [{ ...l[0], text: rest }, ...l.slice(1)] : l.slice(1);
      });
      // The last kept line leaves room for the "…".
      const last = kept[kept.length - 1];
      const len = last.reduce((t, r) => t + r.text.length, 0);
      if (len > width - 2) {
        const tail = last[last.length - 1];
        tail.text = tail.text.slice(0, Math.max(0, tail.text.length - (len - (width - 2)))).replace(/\S+$/, '') || tail.text.slice(0, 1);
      }
      out.push({ ...b, runs: withEllipsis(kept.flatMap((l, k) => (k ? [{ text: ' ' }, ...l] : l))) });
    } else if (out.length) out[out.length - 1] = { ...out[out.length - 1], runs: withEllipsis(out[out.length - 1].runs) };
    return { blocks: out, cut: true };
  }
  return { blocks: out, cut: false };
}

/** A note's first line as plain text (menus, selection labels), or `fallback` when it has no text. */
export function noteSummary(c: Pick<Callout, 'note'>, max = 40, fallback = 'Note'): string {
  const first = parseNote(c.note)[0];
  const text = first ? first.runs.map((r) => r.text).join('').trim() : '';
  if (!text) return fallback;
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** What a note points at, in a few words: General, the item's or room's name, Area or Spot. */
export function noteTargetLabel(project: Project, c: Callout): string {
  const t = c.target;
  if (t.kind === 'general') return 'General';
  if (t.kind === 'object') {
    const o = project.objects[t.objectId];
    return o ? o.name || getObjectAsset(project, o)?.name || 'Item' : 'Item';
  }
  if (t.kind === 'room') return project.rooms[t.roomId]?.name || 'Room';
  if (t.kind === 'region') return 'Area';
  return 'Spot';
}

/** All lines of a callout label: the note's formatted paragraphs and lists, wrapped. */
export function calloutLines(_project: Project, _derived: DerivedPlan | null, c: Callout, width = CALLOUT_WRAP): Line[] {
  const out: Line[] = [];
  for (const b of parseNote(c.note)) {
    const prefix = b.kind === 'bullet' ? '• ' : b.kind === 'number' ? `${b.n}. ` : '';
    const indent = prefix.length;
    wrapRuns(b.runs, width, prefix ? { text: prefix } : null, indent).forEach((l, i) => out.push({ runs: l, role: 'text', indent: i === 0 ? 0 : indent }));
  }
  if (!out.length) out.push({ runs: [{ text: 'Note', italic: true }], role: 'title', indent: 0 });
  return out;
}

/** Plain text of a line (for DXF, accessibility and tests). */
export const lineText = (l: Line) => ' '.repeat(l.indent) + l.runs.map((r) => r.text).join('');

export { CALLOUT_PALETTE } from './palette';

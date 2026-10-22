import type { Callout, Project } from '@/domain/model/schema';
import type { DerivedPlan } from '@/domain/geometry/derive';
import { calloutRegionArea } from '@/domain/geometry/callouts';
import { formatArea, formatLength } from '@/domain/model/units';
import { ROOM_TYPE_LABELS } from '@/domain/model/defaults';
import { getObjectAsset, resolveMaterial } from '@/data/assets/registry';

/**
 * Callout content: the note's light formatting, the target's facts, and plain-text wrapping that
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

/** The target's facts as short lines: item name, maker and model, size, finish; room name, area, ceiling; area size. */
export function calloutInfo(project: Project, derived: DerivedPlan | null, c: Callout): string[] {
  const s = project.settings;
  const len = (m: number) => formatLength(m, s.units, s.precision);
  const t = c.target;
  if (t.kind === 'object') {
    const o = project.objects[t.objectId];
    if (!o) return [];
    const asset = getObjectAsset(project, o);
    const lines = [o.name || asset?.name || 'Item'];
    if (asset?.brand) lines.push(`${asset.brand.name} ${asset.brand.model}`);
    lines.push(`${len(o.width)} × ${len(o.depth)} × ${len(o.height)}`);
    const slot = asset?.slots[0];
    if (slot) {
      const m = resolveMaterial(project, o.materials[slot.id] ?? slot.defaultMaterial);
      if (m?.name) lines.push(`${slot.label}: ${m.name}`);
    }
    return lines;
  }
  if (t.kind === 'room') {
    const r = project.rooms[t.roomId];
    if (!r) return [];
    const lines = [r.name || ROOM_TYPE_LABELS[r.type]];
    const face = derived?.roomFaces.get(r.id);
    if (face) lines.push(formatArea(face.area, s.areaUnit, s.precision));
    if (r.ceilingHeight) lines.push(`Ceiling ${len(r.ceilingHeight)}`);
    return lines;
  }
  if (t.kind === 'region') return [`Area ${formatArea(calloutRegionArea(t), s.areaUnit, s.precision)}`];
  return t.z > 0.01 ? [`Height ${len(t.z)}`] : [];
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

/** All lines of a callout label: title, facts (when shown), then the note, wrapped. */
export function calloutLines(project: Project, derived: DerivedPlan | null, c: Callout, width = CALLOUT_WRAP): Line[] {
  const out: Line[] = [];
  const info = c.showInfo ? calloutInfo(project, derived, c) : [];
  // Without a title, the first fact (the item or room name) is the title.
  const title = c.title.trim() || (info.length ? info.shift()! : '');
  if (title) for (const l of wrapRuns([{ text: title, bold: true }], width, null, 0)) out.push({ runs: l, role: 'title', indent: 0 });
  for (const f of info) for (const l of wrapRuns([{ text: f }], width, null, 0)) out.push({ runs: l, role: 'info', indent: 0 });
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

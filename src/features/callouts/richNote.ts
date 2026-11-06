import { parseNote, safeHref, type Run } from './content';

/**
 * The live-formatting note editor's conversions (RichNoteEditor): the note's text syntax (content.ts:
 * **bold**, *italic*, [text](url), "- " bullets, "1. " numbered items, blank line between paragraphs)
 * to editor HTML and back. Notes are still stored as that text, so the plan, 3D labels, captures,
 * exports and DXF read them as before.
 */

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function runHtml(r: Run): string {
  let h = esc(r.text);
  if (r.href) h = `<a href="${esc(r.href)}">${h}</a>`;
  if (r.italic) h = `<i>${h}</i>`;
  if (r.bold) h = `<b>${h}</b>`;
  return h;
}

/** Editor HTML for a note: paragraphs as divs, bullets and numbered items as lists. */
export function noteToHtml(note: string): string {
  const out: string[] = [];
  let list: { tag: 'ul' | 'ol'; items: string[]; start: number } | null = null;
  const close = () => {
    if (!list) return;
    const start = list.tag === 'ol' && list.start !== 1 ? ` start="${list.start}"` : '';
    out.push(`<${list.tag}${start}>${list.items.map((i) => `<li>${i || '<br>'}</li>`).join('')}</${list.tag}>`);
    list = null;
  };
  for (const b of parseNote(note)) {
    const html = b.runs.map(runHtml).join('');
    if (b.kind === 'p') {
      close();
      out.push(`<div>${html || '<br>'}</div>`);
      continue;
    }
    const tag = b.kind === 'bullet' ? 'ul' : 'ol';
    if (!list || list.tag !== tag) {
      close();
      list = { tag, items: [], start: b.n ?? 1 };
    }
    list.items.push(html);
  }
  close();
  return out.join('');
}

interface StyledRun {
  text: string;
  bold: boolean;
  italic: boolean;
  href: string | null;
}

/** No-break spaces (the box puts them after links and at ends of lines) become plain spaces. */
const NBSP = new RegExp(String.fromCharCode(160), 'g');

const BLOCK = new Set(['DIV', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE', 'SECTION', 'ARTICLE']);

/** Runs of an inline subtree, with its bold / italic / link styling. */
function collectRuns(node: Node, style: Omit<StyledRun, 'text'>, out: StyledRun[]): void {
  if (node.nodeType === 3) {
    const text = (node.textContent ?? '').replace(NBSP, ' ').replace(/[\r\n\t]+/g, ' ');
    if (text) out.push({ text, ...style });
    return;
  }
  if (node.nodeType !== 1) return;
  const el = node as HTMLElement;
  const tag = el.tagName;
  if (tag === 'BR') {
    out.push({ text: ' ', ...style });
    return;
  }
  const weight = el.style?.fontWeight;
  const s = {
    bold: style.bold || tag === 'B' || tag === 'STRONG' || weight === 'bold' || Number(weight) >= 600,
    italic: style.italic || tag === 'I' || tag === 'EM' || el.style?.fontStyle === 'italic',
    href: tag === 'A' ? safeHref(el.getAttribute('href') ?? '') : style.href,
  };
  el.childNodes.forEach((c) => collectRuns(c, s, out));
}

/** Note text of runs: markers round each styled stretch, spaces kept outside them. */
function runsText(runs: StyledRun[]): string {
  // Merge neighbours with the same styling first, so markers wrap whole stretches.
  const merged: StyledRun[] = [];
  for (const r of runs) {
    const last = merged[merged.length - 1];
    if (last && last.bold === r.bold && last.italic === r.italic && last.href === r.href) last.text += r.text;
    else merged.push({ ...r });
  }
  let out = '';
  for (const r of merged) {
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(r.text)!;
    let core = m[2];
    if (!core) {
      out += r.text;
      continue;
    }
    if (r.href) core = `[${core}](${r.href})`;
    // Bold and italic together: "**_x_**" (the parser reads no "*" inside "**…**").
    if (r.bold && r.italic) core = `**_${core}_**`;
    else if (r.bold) core = `**${core}**`;
    else if (r.italic) core = `*${core}*`;
    out += m[1] + core + m[3];
  }
  return out.replace(/ {2,}/g, ' ').trim();
}

type Line = { kind: 'p' | 'bullet' | 'number'; text: string; n?: number };

function inlineText(nodes: Node[]): string {
  const runs: StyledRun[] = [];
  for (const n of nodes) collectRuns(n, { bold: false, italic: false, href: null }, runs);
  return runsText(runs);
}

/** Lines (paragraphs and list items) of a block container, in order. */
function collectLines(parent: Node, out: Line[]): void {
  let inline: Node[] = [];
  const flush = () => {
    const text = inlineText(inline);
    if (text) out.push({ kind: 'p', text });
    inline = [];
  };
  parent.childNodes.forEach((node) => {
    if (node.nodeType !== 1) {
      inline.push(node);
      return;
    }
    const el = node as HTMLElement;
    if (el.tagName === 'UL' || el.tagName === 'OL') {
      flush();
      const numbered = el.tagName === 'OL';
      let n = numbered ? Number(el.getAttribute('start')) || 1 : 0;
      el.childNodes.forEach((li) => {
        if (li.nodeType !== 1 || (li as HTMLElement).tagName !== 'LI') return;
        // Text of the item, then any list nested in it as further items.
        const own: Node[] = [];
        const nested: Node[] = [];
        li.childNodes.forEach((c) => ((c as HTMLElement).tagName === 'UL' || (c as HTMLElement).tagName === 'OL' ? nested : own).push(c));
        const text = inlineText(own);
        if (text) out.push(numbered ? { kind: 'number', text, n: n++ } : { kind: 'bullet', text });
        for (const sub of nested) collectLines({ childNodes: [sub] } as unknown as Node, out);
      });
      return;
    }
    if (BLOCK.has(el.tagName) || el.tagName === 'LI') {
      flush();
      collectLines(el, out);
      return;
    }
    if (el.tagName === 'BR') {
      flush();
      return;
    }
    inline.push(el);
  });
  flush();
}

/** Note text of the editor's content. */
export function htmlToNote(root: Node): string {
  const lines: Line[] = [];
  collectLines(root, lines);
  let out = '';
  lines.forEach((l, i) => {
    const prev = lines[i - 1];
    // Paragraphs are separated by a blank line (single line breaks join a paragraph); list items by one.
    if (prev) out += l.kind === 'p' && prev.kind === 'p' ? '\n\n' : '\n';
    out += l.kind === 'bullet' ? `- ${l.text}` : l.kind === 'number' ? `${l.n}. ${l.text}` : l.text;
  });
  return out;
}

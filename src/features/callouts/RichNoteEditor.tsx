import { useLayoutEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui';
import { safeHref } from './content';
import { imageFilesOf } from './images';
import { htmlToNote, noteToHtml } from './richNote';

/**
 * The note editor with live formatting: bold, italic, bulleted and numbered lists and links show as
 * they will look while typing (a contentEditable box), with a toolbar (B, I, • List, 1. List, Link)
 * and the keys Ctrl+B, Ctrl+I, Ctrl+K (link) and Ctrl+Enter (`onSubmit`). The value is the note's text
 * syntax (see content.ts), converted on every edit (richNote.ts). Pasted text comes in plain; pasted
 * images go to `onPasteFiles`.
 */
export function RichNoteEditor({
  value,
  onChange,
  placeholder,
  onSubmit,
  onPasteFiles,
  autoFocus,
  maxLength = 4000,
  minHeight = 72,
  testId,
}: {
  value: string;
  onChange: (note: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
  onPasteFiles?: (files: File[]) => void;
  autoFocus?: boolean;
  maxLength?: number;
  minHeight?: number;
  testId?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  /** The note text the box shows now (so outside changes, and only those, rewrite it). */
  const shown = useRef<string | null>(null);
  const saved = useRef<Range | null>(null);
  const [link, setLink] = useState<{ text: string; url: string } | null>(null);
  const [empty, setEmpty] = useState(!value);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || value === shown.current) return;
    el.innerHTML = noteToHtml(value);
    shown.current = value;
    setEmpty(!value);
  }, [value]);

  useLayoutEffect(() => {
    if (!autoFocus || !ref.current) return;
    const el = ref.current;
    el.focus();
    // Caret at the end.
    const r = document.createRange();
    r.selectNodeContents(el);
    r.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(r);
  }, [autoFocus]);

  const emit = () => {
    const el = ref.current;
    if (!el) return;
    const note = htmlToNote(el);
    setEmpty(!note && !el.textContent?.trim());
    if (note === shown.current) return;
    if (note.length > maxLength) {
      // Too long: back to the last accepted text.
      el.innerHTML = noteToHtml(shown.current ?? '');
      return;
    }
    shown.current = note;
    onChange(note);
  };

  const command = (name: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand('defaultParagraphSeparator', false, 'div');
    document.execCommand(name, false, arg);
    emit();
  };

  const inBox = (r: Range | null) => !!r && !!ref.current?.contains(r.commonAncestorContainer);
  const openLink = () => {
    const sel = window.getSelection();
    const r = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
    saved.current = inBox(r) ? r!.cloneRange() : null;
    setLink({ text: saved.current?.toString() ?? '', url: 'https://' });
  };
  const insertLink = () => {
    if (!link) return;
    const href = safeHref(link.url);
    if (!href) return;
    const el = ref.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    sel?.removeAllRanges();
    if (saved.current) sel?.addRange(saved.current);
    else {
      const r = document.createRange();
      r.selectNodeContents(el);
      r.collapse(false);
      sel?.addRange(r);
    }
    const text = link.text.trim() || href;
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    document.execCommand('insertHTML', false, `<a href="${esc(href)}">${esc(text)}</a>&nbsp;`);
    setLink(null);
    saved.current = null;
    emit();
  };

  // Toolbar buttons keep the text selection (mousedown would move focus away).
  const keep = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div className="rich-note">
      <div className="callout-toolbar" role="toolbar" aria-label="Formatting">
        <button type="button" title="Bold (Ctrl+B)" onMouseDown={keep} onClick={() => command('bold')}>
          <b>B</b>
        </button>
        <button type="button" title="Italic (Ctrl+I)" onMouseDown={keep} onClick={() => command('italic')}>
          <i>I</i>
        </button>
        <button type="button" title="Bulleted list" onMouseDown={keep} onClick={() => command('insertUnorderedList')}>
          • List
        </button>
        <button type="button" title="Numbered list" onMouseDown={keep} onClick={() => command('insertOrderedList')}>
          1. List
        </button>
        <button type="button" title="Link (Ctrl+K)" onMouseDown={keep} onClick={openLink} data-testid="callout-link">
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
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') insertLink();
              if (e.key === 'Escape') setLink(null);
            }}
          />
          <Button size="sm" onClick={insertLink} disabled={!safeHref(link.url)}>
            Add
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setLink(null)}>
            ✕
          </Button>
        </div>
      )}
      <div
        ref={ref}
        className={`input rich-note-box${empty ? ' empty' : ''}`}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={placeholder ?? 'Note'}
        data-placeholder={placeholder}
        data-autofocus={autoFocus ? '' : undefined}
        data-testid={testId}
        style={{ minHeight }}
        onInput={emit}
        onBlur={emit}
        onPaste={(e) => {
          const files = imageFilesOf(e.clipboardData);
          e.preventDefault();
          if (files.length) {
            onPasteFiles?.(files);
            return;
          }
          // Plain text only: formatting from other pages never comes along.
          const text = e.clipboardData.getData('text/plain');
          if (text) document.execCommand('insertText', false, text);
          emit();
        }}
        onDrop={(e) => e.preventDefault()}
        onClick={(e) => {
          // Links in the box are edited, not followed.
          if ((e.target as HTMLElement).closest('a')) e.preventDefault();
        }}
        onKeyDown={(e) => {
          if (!(e.ctrlKey || e.metaKey)) return;
          const key = e.key.toLowerCase();
          if (key === 'enter' && onSubmit) {
            e.preventDefault();
            emit();
            onSubmit();
          } else if (key === 'k') {
            e.preventDefault();
            openLink();
          } else if (key === 'b' || key === 'i') {
            e.preventDefault();
            command(key === 'b' ? 'bold' : 'italic');
          }
        }}
      />
    </div>
  );
}

import { describe, expect, it } from 'vitest';
import { htmlToNote, noteToHtml } from './richNote';
import { parseNote } from './content';

/** The note text the editor gives back for some HTML. */
const fromHtml = (html: string) => {
  const el = document.createElement('div');
  el.innerHTML = html;
  return htmlToNote(el);
};
/** Note → editor → note. */
const roundTrip = (note: string) => fromHtml(noteToHtml(note));

describe('live-formatting note editor conversions', () => {
  it('shows formatting instead of markers', () => {
    expect(noteToHtml('**Phần dưới tủ** để giày')).toBe('<div><b>Phần dưới tủ</b> để giày</div>');
    expect(noteToHtml('*soft* and [link](https://example.com)')).toBe('<div><i>soft</i> and <a href="https://example.com">link</a></div>');
    expect(noteToHtml('- one\n- two\n\n3. three')).toBe('<ul><li>one</li><li>two</li></ul><ol start="3"><li>three</li></ol>');
    expect(noteToHtml('a < b & "c"')).toBe('<div>a &lt; b &amp; &quot;c&quot;</div>');
  });

  it('keeps every note the same through the editor (as the plan reads it)', () => {
    for (const note of [
      '**Phần dưới tủ để 2 ngăn đựng giày dép cho mục đích lấy nhanh, không cần mở cửa tủ**',
      'Plain first paragraph\n\nSecond with *italic* and **bold** words',
      '- one\n- two **bold**\n1. first\n2. second',
      'See [the catalogue](https://example.com/a?b=1) for sizes',
      '**_both_** styles',
      'Intro\n- item',
    ]) {
      const back = roundTrip(note);
      expect(parseNote(back), note).toEqual(parseNote(note));
    }
  });

  it('reads what browsers produce while editing', () => {
    // Enter makes divs; Shift+Enter a <br>; empty lines are <div><br></div>.
    expect(fromHtml('first<div>second</div><div><br></div><div>third</div>')).toBe('first\n\nsecond\n\nthird');
    // Bold and italic as tags or styles, nested either way; spaces stay outside the markers.
    expect(fromHtml('<div><b>bold </b>then <strong><em>both</em></strong></div>')).toBe('**bold** then **_both_**');
    expect(fromHtml('<div><span style="font-weight: 700">heavy</span> <span style="font-style: italic">slanted</span></div>')).toBe('**heavy** *slanted*');
    // Lists, numbered from their start, nested lists flattened.
    expect(fromHtml('<ol start="2"><li>a</li><li>b<ul><li>c</li></ul></li></ol>')).toBe('2. a\n3. b\n- c');
    // Links: only safe ones; no-break spaces become spaces.
    expect(fromHtml('<div><a href="https://x.io">x</a> and <a href="javascript:alert(1)">bad</a></div>')).toBe('[x](https://x.io) and bad');
    expect(fromHtml('<div><br></div>')).toBe('');
  });
});

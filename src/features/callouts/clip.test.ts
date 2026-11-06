import { describe, expect, it } from 'vitest';
import { CALLOUT_WRAP, NOTE_MAX_LINES, clipNoteBlocks, parseNote, wrapRuns } from './content';
import { GuestSettingsSchema, RenderSettingsSchema } from '@/domain/model/schema';

const text = (b: ReturnType<typeof parseNote>) => b.map((x) => x.runs.map((r) => r.text).join('')).join(' / ');
const lineCount = (blocks: ReturnType<typeof parseNote>) =>
  blocks.reduce((n, b) => {
    const prefix = b.kind === 'bullet' ? '• ' : b.kind === 'number' ? `${b.n}. ` : '';
    return n + Math.max(1, wrapRuns(b.runs, CALLOUT_WRAP, prefix ? { text: prefix } : null, prefix.length).length);
  }, 0);

describe('clipping long notes', () => {
  it('keeps short notes as they are', () => {
    const blocks = parseNote('Oak floor, oiled.\n\n- skirting 80 mm');
    const r = clipNoteBlocks(blocks);
    expect(r.cut).toBe(false);
    expect(r.blocks).toEqual(blocks);
  });

  it('cuts a long paragraph after the line limit and ends it with …', () => {
    const long = Array.from({ length: 40 }, (_, i) => `word${i}`).join(' ');
    const r = clipNoteBlocks(parseNote(long));
    expect(r.cut).toBe(true);
    expect(text(r.blocks).endsWith('…')).toBe(true);
    expect(lineCount(r.blocks)).toBeLessThanOrEqual(NOTE_MAX_LINES);
    expect(text(r.blocks).startsWith('word0 word1')).toBe(true);
  });

  it('drops later blocks and marks the cut on the last kept one', () => {
    const r = clipNoteBlocks(parseNote('One\n\nTwo\n\nThree\n\nFour\n\nFive\n\nSix'));
    expect(r.cut).toBe(true);
    expect(r.blocks).toHaveLength(NOTE_MAX_LINES);
    expect(text(r.blocks)).toBe('One / Two / Three / Four…');
  });

  it('keeps list prefixes out of the text and keeps formatting', () => {
    const r = clipNoteBlocks(parseNote(`- **${'bold '.repeat(30)}**`));
    expect(r.cut).toBe(true);
    expect(r.blocks[0].kind).toBe('bullet');
    expect(r.blocks[0].runs[0].text.startsWith('•')).toBe(false);
    expect(r.blocks[0].runs[0].bold).toBe(true);
  });
});

describe('note display', () => {
  it('loads older "compact" as full', () => {
    const render = RenderSettingsSchema.shape.noteDisplay;
    expect(render.parse('compact')).toBe('full');
    expect(render.parse('icon')).toBe('icon');
    expect(render.parse(undefined)).toBe('full');
    const guest = GuestSettingsSchema.removeDefault().shape.noteDisplay;
    expect(guest.parse('compact')).toBe('full');
    expect(guest.parse(undefined)).toBe('icon');
  });
});

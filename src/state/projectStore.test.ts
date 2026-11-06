import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { fireEvent, render } from '@testing-library/react';
import { createEmptyProject } from '@/domain/model/defaults';
import { ColorWell, Slider } from '@/components/ui';
import { isEditableTarget, isTextEntry } from '@/components/editableTarget';
import { COALESCE_MS, HISTORY_LIMIT, useProjectStore } from './projectStore';

const store = () => useProjectStore.getState();
const gridSize = () => store().project!.settings.gridSize;
const setGrid = (v: number, coalesce?: string) => store().execute('Grid', (d) => void (d.settings.gridSize = v), coalesce ? { coalesce } : undefined);

describe('undo history', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-07T10:00:00Z'));
    store().load(createEmptyProject({ name: 'Undo test' }));
  });
  afterEach(() => vi.useRealTimers());

  it('records one step per change and undoes / redoes them in order', () => {
    const g0 = gridSize();
    setGrid(0.5);
    setGrid(0.25);
    expect(store().past.map((e) => e.label)).toEqual(['Grid', 'Grid']);
    store().undo();
    expect(gridSize()).toBe(0.5);
    store().undo();
    expect(gridSize()).toBe(g0);
    store().redo();
    store().redo();
    expect(gridSize()).toBe(0.25);
  });

  it('merges quick repeats of the same change into one step (a held arrow key)', () => {
    const g0 = gridSize();
    for (const v of [0.21, 0.22, 0.23]) {
      setGrid(v, 'nudge:a');
      vi.advanceTimersByTime(200);
    }
    expect(store().past).toHaveLength(1);
    store().undo();
    expect(gridSize()).toBe(g0);
    store().redo();
    expect(gridSize()).toBe(0.23);
  });

  it('starts a new step after a pause, for another key, or after an undo', () => {
    setGrid(0.21, 'nudge:a');
    vi.advanceTimersByTime(COALESCE_MS + 1);
    setGrid(0.22, 'nudge:a');
    expect(store().past).toHaveLength(2);
    setGrid(0.23, 'nudge:b');
    expect(store().past).toHaveLength(3);
    store().undo();
    setGrid(0.24, 'nudge:a');
    setGrid(0.25, 'nudge:a');
    // After an undo the run starts afresh (the undone step is not merged into).
    expect(store().past).toHaveLength(3);
    store().undo();
    expect(gridSize()).toBe(0.22);
  });

  it('records a live edit (picker or slider drag) as one step, however many previews', () => {
    const g0 = gridSize();
    for (const v of [0.11, 0.12, 0.13]) store().livePreview('Live', (d) => void (d.settings.gridSize = v));
    expect(store().past).toHaveLength(0);
    store().commit((d) => void (d.settings.gridSize = 0.14));
    expect(store().past.map((e) => e.label)).toEqual(['Live']);
    store().undo();
    expect(gridSize()).toBe(g0);
  });

  it('a live edit interrupted by another change still lands as its own step', () => {
    store().livePreview('Live', (d) => void (d.settings.gridSize = 0.11));
    // Another edit ends the open gesture (keeping what it previewed).
    setGrid(0.5);
    expect(store().tx).toBeNull();
    store().livePreview('Live', (d) => void (d.settings.gridSize = 0.12));
    expect(store().tx?.label).toBe('Live');
    store().commit((d) => void (d.settings.gridSize = 0.13));
    expect(gridSize()).toBe(0.13);
    expect(store().past.map((e) => e.label)).toEqual(['Live', 'Grid', 'Live']);
  });

  it('undo during a drag cancels the drag instead of undoing an earlier step', () => {
    setGrid(0.5);
    store().begin('Drag');
    store().preview((d) => void (d.settings.gridSize = 0.9));
    store().undo();
    expect(store().tx).toBeNull();
    expect(gridSize()).toBe(0.5);
  });

  it('keeps at most HISTORY_LIMIT steps, also when redoing', () => {
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) setGrid(0.01 + i * 0.001);
    expect(store().past).toHaveLength(HISTORY_LIMIT);
    for (let i = 0; i < 3; i++) store().undo();
    for (let i = 0; i < 3; i++) store().redo();
    expect(store().past.length).toBeLessThanOrEqual(HISTORY_LIMIT);
  });
});

describe('controls that record undo steps', () => {
  it('a slider dragged and released outside it commits once', () => {
    const onCommit = vi.fn();
    const onChange = vi.fn();
    const { container } = render(createElement(Slider, { label: 'Roughness', value: 0.2, min: 0, max: 1, step: 0.1, onChange, onCommit }));
    const input = container.querySelector('input[type=range]') as HTMLInputElement;
    fireEvent.pointerDown(input);
    fireEvent.change(input, { target: { value: '0.5' } });
    fireEvent.change(input, { target: { value: '0.7' } });
    expect(onCommit).not.toHaveBeenCalled();
    // Released over another part of the page.
    window.dispatchEvent(new Event('pointerup'));
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenLastCalledWith(0.7);
    window.dispatchEvent(new Event('pointerup'));
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('a colour well previews while picking and commits once on change', () => {
    const onCommit = vi.fn();
    const onPreview = vi.fn();
    const { container } = render(createElement(ColorWell, { label: 'Colour', value: '#112233', onPreview, onCommit }));
    const input = container.querySelector('input[type=color]') as HTMLInputElement;
    for (const c of ['#223344', '#334455', '#445566']) fireEvent.input(input, { target: { value: c } });
    expect(onPreview).toHaveBeenCalledTimes(3);
    expect(onCommit).not.toHaveBeenCalled();
    input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenLastCalledWith('#445566');
  });

  it('only typed text keeps its own undo: sliders, checkboxes and colour wells let Ctrl+Z through', () => {
    const el = (html: string) => {
      const d = document.createElement('div');
      d.innerHTML = html;
      return d.firstElementChild!;
    };
    for (const html of ['<input type="text">', '<input>', '<textarea></textarea>', '<div contenteditable="true"></div>']) {
      const t = el(html);
      if (t instanceof HTMLElement && t.hasAttribute('contenteditable')) Object.defineProperty(t, 'isContentEditable', { value: true });
      expect(isTextEntry(t), html).toBe(true);
    }
    for (const html of ['<input type="range">', '<input type="checkbox">', '<input type="color">', '<select></select>']) {
      expect(isEditableTarget(el(html)), html).toBe(true);
      expect(isTextEntry(el(html)), html).toBe(false);
    }
  });
});

import { useEffect, useMemo } from 'react';
import { RotateCcw, Shapes, X } from 'lucide-react';
import { sectionInfo, sectionsOffered } from '@/data/assets/itemEdits';
import type { AssetParam } from '@/data/assets/types';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore } from '@/state/editorStore';
import { Button, IconButton, LengthField, NumberField, Section, Select, Toggle } from '@/components/ui';
import { clearPartEdits, editBase, exitShapeEdit, resetParams, resetSections, resetShape, setParam, setSectionSize, setShapeEditState } from './actions';
import './shapeEdit.css';

/**
 * The shape editor's panel, in the Inspector's place. The editor makes variants of the item by
 * resizing its components: its shape settings (leg width, soffit drop, corner radii…; those with an
 * orange handle in the view are highlighted with it) and its sections (compartment widths left to
 * right, level heights bottom to top; picked in the view or here). Done (or Esc) leaves the editor.
 */
export function ShapeEditPanel() {
  const project = useProjectStore((s) => s.project)!;
  const shapeEdit = useEditorStore((s) => s.shapeEdit)!;
  const o = project.objects[shapeEdit.objectId];
  const asset = o ? editBase(project, o) : null;
  // The item went away (undo, deleted elsewhere): leave the editor.
  useEffect(() => {
    if (!o || !asset) exitShapeEdit();
  }, [o, asset]);
  const size = useMemo(() => (o ? { w: o.width, d: o.depth, h: o.height } : { w: 1, d: 1, h: 1 }), [o]);
  const sections = useMemo(() => (asset ? sectionInfo(asset, size, o?.edits) : null), [asset, size, o?.edits]);
  if (!o || !asset || !sections) return null;
  const u = project.settings;
  const e = o.edits;
  const showSections = sectionsOffered(asset) || !!e?.sections;
  const partEdits = Object.keys(e?.parts ?? {}).length;
  const picked = shapeEdit.section;
  const sectionRow = (axis: 'x' | 'y') => {
    const s = sections[axis];
    if (!s.edges.length) return null;
    const all = [s.lo, ...s.edges, s.hi];
    const label = axis === 'x' ? 'Compartment' : 'Level';
    return (
      <div className="shape-sections" data-testid={`shape-sections-${axis}`}>
        <div className="field-label">{axis === 'x' ? 'Compartment widths, left to right' : 'Level heights, bottom to top'}</div>
        <div className="grid-2">
          {all.slice(0, -1).map((a, i) => (
            <div
              key={i}
              className={`shape-section-field${picked?.axis === axis && picked.index === i ? ' on' : ''}`}
              onMouseEnter={() => setShapeEditState({ hover: { axis, index: i } })}
              onMouseLeave={() => setShapeEditState({ hover: null })}
              onFocus={() => setShapeEditState({ section: { axis, index: i } })}
            >
              <LengthField
                label={`${label} ${i + 1}`}
                value={all[i + 1] - a}
                unit={u.units}
                precision={u.precision}
                min={0.06}
                max={s.hi - s.lo}
                testId={`section-${axis}-${i}`}
                onCommit={(v) => setSectionSize(axis, i, v)}
              />
            </div>
          ))}
        </div>
      </div>
    );
  };
  const param = (p: AssetParam) => {
    const v = e?.params?.[p.id] ?? p.default;
    if (p.kind === 'toggle') return <Toggle key={p.id} label={p.label} hint={p.hint} checked={v === true} onChange={(on) => setParam(p.id, p.label, on)} />;
    if (p.kind === 'choice')
      return <Select key={p.id} label={p.label} value={String(v)} options={p.options ?? []} onChange={(x) => setParam(p.id, p.label, x)} />;
    if (p.kind === 'count')
      return <NumberField key={p.id} label={p.label} value={Number(v)} min={p.min ?? 0} max={p.max ?? 99} step={1} decimals={0} onCommit={(x) => setParam(p.id, p.label, Math.round(x))} />;
    const field =
      p.max !== undefined && p.max <= 1 && p.hint?.startsWith('Share') ? (
        <NumberField label={p.label} value={Math.round(Number(v) * 100)} min={Math.round((p.min ?? 0) * 100)} max={100} step={5} decimals={0} suffix="%" onCommit={(x) => setParam(p.id, p.label, x / 100)} />
      ) : (
        <LengthField label={p.label} hint={p.hint} value={Number(v)} unit={u.units} precision={u.precision} min={p.min ?? 0} max={p.max ?? 30} testId={`param-${p.id}`} onCommit={(x) => setParam(p.id, p.label, x)} />
      );
    return (
      <div
        key={p.id}
        className={`shape-param${p.handle ? ' has-handle' : ''}${shapeEdit.param === p.id ? ' on' : ''}`}
        onMouseEnter={() => p.handle && setShapeEditState({ param: p.id })}
        onMouseLeave={() => p.handle && setShapeEditState({ param: null })}
      >
        {field}
      </div>
    );
  };
  const hasSections = showSections && (sections.x.edges.length > 0 || sections.y.edges.length > 0);
  return (
    <aside className="shape-panel floating" aria-label="Edit shape" data-testid="shape-panel">
      <div className="shape-panel-head">
        <div className="shape-panel-title">
          <Shapes size={15} />
          <div>
            <strong>Edit shape</strong>
            <span>{o.name ?? asset.name}</span>
          </div>
        </div>
        <Button size="sm" variant="primary" onClick={exitShapeEdit} data-testid="shape-done">
          Done
        </Button>
      </div>
      <div className="shape-panel-body">
        <p className="field-hint">
          Make a variant of this item by resizing its components.
          {asset.params?.some((p) => p.handle) && ' Drag the orange handles (corner radius, legs, soffit) or type the sizes.'}
          {hasSections && ' Drag the green handles to move a divider or shelf; click a compartment to pick it.'} Esc leaves.
        </p>
        {!!asset.params?.length && (
          <Section title="Shape">
            {asset.params.map(param)}
            {e?.params && (
              <Button size="sm" variant="subtle" onClick={resetParams}>
                <RotateCcw size={13} /> Reset settings
              </Button>
            )}
          </Section>
        )}
        {hasSections && (
          <Section title={sections.x.edges.length ? 'Compartments' : 'Levels'}>
            {sectionRow('x')}
            {sectionRow('y')}
            {e?.sections && (
              <Button size="sm" variant="subtle" onClick={resetSections}>
                <RotateCcw size={13} /> Reset sizes
              </Button>
            )}
          </Section>
        )}
        {!asset.params?.length && !hasSections && <p className="notice">This item has no components to resize.</p>}
        {partEdits > 0 && (
          <Section title="Earlier part edits">
            <p className="field-hint" data-testid="shape-part-edits">
              {partEdits} part{partEdits === 1 ? ' was' : 's were'} changed one by one with the earlier editor. They still apply; clear them to go back to the
              item's own parts.
            </p>
            <Button size="sm" variant="subtle" onClick={clearPartEdits}>
              <RotateCcw size={13} /> Clear part edits
            </Button>
          </Section>
        )}
      </div>
      <div className="shape-panel-foot">
        <span className="field-hint">
          {e
            ? [e.params && 'settings changed', e.sections && 'sizes changed', partEdits && `${partEdits} earlier part edit${partEdits === 1 ? '' : 's'}`].filter(Boolean).join(' · ')
            : 'As it comes from the library'}
        </span>
        <IconButton label="Reset the whole shape" disabled={!e} onClick={resetShape}>
          <RotateCcw size={14} />
        </IconButton>
        <IconButton label="Leave (Esc)" onClick={exitShapeEdit}>
          <X size={14} />
        </IconButton>
      </div>
    </aside>
  );
}

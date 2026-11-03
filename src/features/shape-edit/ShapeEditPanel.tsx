import { useEffect, useMemo } from 'react';
import { Eye, EyeOff, RotateCcw, Shapes, X } from 'lucide-react';
import { editedParts, partBox, partLabels, sectionInfo } from '@/data/assets/itemEdits';
import type { AssetParam } from '@/data/assets/types';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore } from '@/state/editorStore';
import { Button, IconButton, LengthField, NumberField, Section, Select, Toggle } from '@/components/ui';
import {
  editBase,
  exitShapeEdit,
  resetParams,
  resetPart,
  resetSections,
  resetShape,
  scalePart,
  setParam,
  setPartCentre,
  setPartSize,
  setSectionSize,
  setShapeEditState,
  togglePartHidden,
} from './actions';
import './shapeEdit.css';

const AXES = ['Width', 'Height', 'Depth'] as const;
const MOVE = ['Across (X)', 'Up (Y)', 'Front–back (Z)'] as const;

/**
 * The shape editor's panel, in the Inspector's place: the item's shape settings, its sections (widths
 * of the compartments between dividers, heights between fixed shelves) and its parts. Picking a part
 * here or in the view shows its size and place, a uniform scale, a diameter for round parts, and hide
 * and reset. Done (or Esc) leaves the editor.
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
  const parts = useMemo(() => (asset ? editedParts(asset, size, o?.edits) : []), [asset, size, o?.edits]);
  const labels = useMemo(() => (asset ? partLabels(asset, parts.map((p) => p.part)) : []), [asset, parts]);
  const sections = useMemo(() => (asset ? sectionInfo(asset, size, o?.edits) : null), [asset, size, o?.edits]);
  if (!o || !asset || !sections) return null;
  const u = project.settings;
  const e = o.edits;
  const picked = shapeEdit.part !== null ? parts[shapeEdit.part] : undefined;
  const editedCount = Object.keys(e?.parts ?? {}).length;
  const hiddenCount = parts.filter((p) => p.hidden).length;
  const box = picked ? partBox(picked.part) : null;
  const round = picked && ['cylinder', 'sphere', 'torus', 'lathe'].includes(picked.part.shape);
  const sectionRow = (axis: 'x' | 'y') => {
    const s = sections[axis];
    if (!s.edges.length) return null;
    const all = [s.lo, ...s.edges, s.hi];
    const label = axis === 'x' ? 'Section' : 'Level';
    return (
      <div className="shape-sections" data-testid={`shape-sections-${axis}`}>
        <div className="field-label">{axis === 'x' ? 'Widths, left to right' : 'Heights, bottom to top'}</div>
        <div className="grid-2">
          {all.slice(0, -1).map((a, i) => (
            <div
              key={i}
              onMouseEnter={() => setShapeEditState({ section: { axis, index: i } })}
              onMouseLeave={() => setShapeEditState({ section: null })}
              onFocus={() => setShapeEditState({ section: { axis, index: i }, part: null })}
              onBlur={() => setShapeEditState({ section: null })}
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
    return (
      <LengthField key={p.id} label={p.label} hint={p.hint} value={Number(v)} unit={u.units} precision={u.precision} min={p.min ?? 0} max={p.max ?? 30} testId={`param-${p.id}`} onCommit={(x) => setParam(p.id, p.label, x)} />
    );
  };
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
          Click a part to pick it; drag the arrows to move it, the small cubes to pull one side. Everything else is in
          X-ray while you edit. Esc drops the part, then leaves.
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
        {(sections.x.edges.length > 0 || sections.y.edges.length > 0) && (
          <Section title="Sections">
            {sectionRow('x')}
            {sectionRow('y')}
            {e?.sections && (
              <Button size="sm" variant="subtle" onClick={resetSections}>
                <RotateCcw size={13} /> Reset sections
              </Button>
            )}
          </Section>
        )}
        {picked && box && (
          <Section title={labels[picked.index] ?? 'Part'}>
            <div data-testid="shape-part" className="shape-part-fields">
              {picked.hidden ? (
                <p className="notice">This part is hidden.</p>
              ) : (
                <>
                  <div className="grid-3">
                    {AXES.map((label, i) => (
                      <LengthField
                        key={label}
                        label={label}
                        value={box.size[i]}
                        unit={u.units}
                        precision={u.precision}
                        min={0.005}
                        max={30}
                        testId={`part-size-${i}`}
                        onCommit={(v) => setPartSize(picked.index, [i === 0 ? v : null, i === 1 ? v : null, i === 2 ? v : null])}
                      />
                    ))}
                  </div>
                  <div className="grid-3">
                    {MOVE.map((label, i) => (
                      <LengthField
                        key={label}
                        label={label}
                        value={box.centre[i]}
                        unit={u.units}
                        precision={u.precision}
                        min={-30}
                        max={30}
                        testId={`part-pos-${i}`}
                        onCommit={(v) => setPartCentre(picked.index, [i === 0 ? v : null, i === 1 ? v : null, i === 2 ? v : null])}
                      />
                    ))}
                  </div>
                  <div className="grid-2">
                    <NumberField label="Scale" value={100} min={10} max={500} step={5} decimals={0} suffix="%" onCommit={(pct) => pct !== 100 && scalePart(picked.index, pct / 100)} />
                    {round && (
                      <LengthField
                        label="Diameter"
                        value={Math.max(box.size[0], box.size[2])}
                        unit={u.units}
                        precision={u.precision}
                        min={0.005}
                        max={30}
                        testId="part-diameter"
                        onCommit={(v) => setPartSize(picked.index, [v, null, v])}
                      />
                    )}
                  </div>
                </>
              )}
              <div className="btn-row">
                <Button size="sm" variant="subtle" onClick={() => togglePartHidden(picked.index, !picked.hidden)}>
                  {picked.hidden ? <Eye size={13} /> : <EyeOff size={13} />} {picked.hidden ? 'Show part' : 'Hide part'}
                </Button>
                <Button size="sm" variant="subtle" disabled={!picked.edited} onClick={() => resetPart(picked.index)}>
                  <RotateCcw size={13} /> Reset part
                </Button>
              </div>
            </div>
          </Section>
        )}
        <Section title={`Parts (${parts.length})`}>
          <div className="shape-part-list" role="list" data-testid="shape-part-list">
            {parts.map((p) => (
              <div
                key={p.index}
                role="listitem"
                className={`shape-part-row${shapeEdit.part === p.index ? ' on' : ''}${p.hidden ? ' hidden' : ''}`}
                onMouseEnter={() => setShapeEditState({ hover: p.index })}
                onMouseLeave={() => setShapeEditState({ hover: null })}
              >
                <button type="button" className="shape-part-name" onClick={() => setShapeEditState({ part: shapeEdit.part === p.index ? null : p.index, section: null })}>
                  {labels[p.index]}
                  {p.edited && !p.hidden && <span className="shape-part-tag">edited</span>}
                </button>
                <IconButton label={p.hidden ? 'Show part' : 'Hide part'} onClick={() => togglePartHidden(p.index, !p.hidden)}>
                  {p.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                </IconButton>
              </div>
            ))}
          </div>
        </Section>
      </div>
      <div className="shape-panel-foot">
        <span className="field-hint">
          {e ? `${[editedCount && `${editedCount} part${editedCount === 1 ? '' : 's'} edited`, hiddenCount && `${hiddenCount} hidden`, e.sections && 'sections moved', e.params && 'settings changed'].filter(Boolean).join(' · ')}` : 'As it comes from the library'}
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

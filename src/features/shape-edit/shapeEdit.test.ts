import { beforeEach, describe, expect, it } from 'vitest';
import '@/packs/loader';
import { createEmptyProject } from '@/domain/model/defaults';
import { placeObject } from '@/domain/commands/entities';
import { getAsset, getObjectAsset } from '@/data/assets/registry';
import { ASSET_CATALOG } from '@/data/assets/catalog';
import { editedParts, partBox } from '@/data/assets/itemEdits';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore } from '@/state/editorStore';
import {
  canEditItem,
  dragPart,
  enterShapeEdit,
  exitShapeEdit,
  resetShape,
  scalePart,
  setParam,
  setPartCentre,
  setPartSize,
  setSectionSize,
  togglePartHidden,
} from './actions';

const WARDROBE = 'wardrobe-study:wardrobe-study-wall';

/** A project with one item, open in the editor's 3D view. */
function setup(assetId = WARDROBE): string {
  const p = createEmptyProject({ name: 'Shape test' });
  const a = getAsset(p, assetId)!;
  let id = '';
  useProjectStore.getState().load(p);
  useProjectStore.getState().execute('Place', (d) => {
    id = placeObject(d, { assetId, x: 0, y: 0, rotation: 0, width: a.defaultSize.w, depth: a.defaultSize.d, height: a.defaultSize.h, elevation: 0, materials: {} });
  });
  useEditorStore.setState({ shapeEdit: null, workspace: '3d', tool: 'select', notesMode: false, servicesMode: false, layersPanelOpen: false, selection: [] });
  return id;
}

const obj = (id: string) => useProjectStore.getState().project!.objects[id];

describe('shape editor', () => {
  beforeEach(() => useEditorStore.setState({ shapeEdit: null }));

  it('opens only in the 3D view, on items that have it', () => {
    const id = setup();
    expect(canEditItem(useProjectStore.getState().project!, id)).toBe(true);
    useEditorStore.setState({ workspace: 'plan' });
    enterShapeEdit(id);
    expect(useEditorStore.getState().shapeEdit).toBeNull();
    useEditorStore.setState({ workspace: '3d' });
    enterShapeEdit(id);
    expect(useEditorStore.getState().shapeEdit?.objectId).toBe(id);
    exitShapeEdit();
    expect(useEditorStore.getState().shapeEdit).toBeNull();
    expect(useEditorStore.getState().workspace).toBe('3d');
  });

  it('allows no other tool, mode or view while it is on', () => {
    const id = setup();
    enterShapeEdit(id);
    const ed = useEditorStore.getState();
    ed.setTool('wall');
    ed.set({ servicesMode: true, notesMode: true, layersPanelOpen: true, workspace: 'plan', placeAssetId: 'sofa-3-seat', libraryOpen: true });
    const s = useEditorStore.getState();
    expect([s.tool, s.servicesMode, s.notesMode, s.layersPanelOpen, s.workspace, s.placeAssetId]).toEqual(['select', false, false, false, '3d', null]);
    exitShapeEdit();
    useEditorStore.getState().setTool('wall');
    expect(useEditorStore.getState().tool).toBe('wall');
  });

  it('edits sections, parts and settings one undo step at a time, again and again', () => {
    const id = setup();
    enterShapeEdit(id);
    const past = () => useProjectStore.getState().past.length;
    const n0 = past();
    setSectionSize('x', 0, 0.4);
    // A second and third edit start from the stored edits (they used to fail cloning a draft).
    togglePartHidden(6, true);
    dragPart(12, [0, 0, 0.1], [0, 0, 0.2]);
    setPartSize(13, [0.6, null, null]);
    setPartCentre(13, [null, 0.4, null]);
    scalePart(30, 2);
    expect(past()).toBe(n0 + 6);
    const e = obj(id).edits!;
    expect(e.sections?.x?.d[0]).toBeCloseTo(0.4 - 0.535, 3);
    expect(e.parts?.['6']?.hidden).toBe(true);
    expect(e.parts?.['12']?.grow).toEqual([0, 0, 0.2]);
    const asset = getAsset(null, WARDROBE)!;
    const size = { w: obj(id).width, d: obj(id).depth, h: obj(id).height };
    const parts = editedParts(asset, size, e);
    expect(partBox(parts[13].part).size[0]).toBeCloseTo(0.6, 3);
    expect(partBox(parts[13].part).centre[1]).toBeCloseTo(0.4, 3);
    expect(getObjectAsset(null, obj(id))!.id).toMatch(/@shape:/);
    useProjectStore.getState().undo();
    expect(obj(id).edits?.parts?.['30']).toBeUndefined();
    resetShape();
    expect(obj(id).edits).toBeUndefined();
    expect(getObjectAsset(null, obj(id))).toBe(asset);
  });

  it('changes and resets a portal setting; the default stores nothing', () => {
    const id = setup('portal-frames:rounded-portal');
    enterShapeEdit(id);
    setParam('rL', 'Left corner radius', 0.9);
    expect(obj(id).edits?.params).toEqual({ rL: 0.9 });
    setParam('rL', 'Left corner radius', 0.35);
    expect(obj(id).edits).toBeUndefined();
  });

  it('never opens on branded items or items without the editor', () => {
    const branded = ASSET_CATALOG.find((a) => a.brand && a.type === 'storage') ?? ASSET_CATALOG.find((a) => a.brand)!;
    const id = setup(branded.id);
    enterShapeEdit(id);
    expect(useEditorStore.getState().shapeEdit).toBeNull();
    const lamp = setup('floor-lamp');
    enterShapeEdit(lamp);
    expect(useEditorStore.getState().shapeEdit).toBeNull();
  });
});

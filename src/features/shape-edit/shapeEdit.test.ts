import { beforeEach, describe, expect, it } from 'vitest';
import '@/packs/loader';
import { createEmptyProject } from '@/domain/model/defaults';
import { placeObject } from '@/domain/commands/entities';
import { getAsset, getObjectAsset } from '@/data/assets/registry';
import { ASSET_CATALOG } from '@/data/assets/catalog';
import { sectionInfo } from '@/data/assets/itemEdits';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore } from '@/state/editorStore';
import { canEditItem, clearPartEdits, enterShapeEdit, exitShapeEdit, resetObjectParams, resetShape, setObjectParam, setParam, setSectionEdges, setSectionSize } from './actions';

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

  it('resizes compartments by field and by handle drag, one undo step each, again and again', () => {
    const id = setup();
    enterShapeEdit(id);
    const past = () => useProjectStore.getState().past.length;
    const n0 = past();
    setSectionSize('x', 0, 0.4);
    // A second edit starts from the stored edits (it used to fail cloning a draft).
    const asset = getAsset(null, WARDROBE)!;
    const size = () => ({ w: obj(id).width, d: obj(id).depth, h: obj(id).height });
    const edges = sectionInfo(asset, size(), obj(id).edits).x.edges;
    setSectionEdges('x', edges.map((v, i) => (i === 1 ? v - 0.1 : v)));
    expect(past()).toBe(n0 + 2);
    const e = obj(id).edits!;
    expect(e.sections?.x?.d[0]).toBeCloseTo(0.4 - 0.535, 3);
    expect(sectionInfo(asset, size(), e).x.edges[1]).toBeCloseTo(edges[1] - 0.1, 6);
    expect(getObjectAsset(null, obj(id))!.id).toMatch(/@shape:/);
    useProjectStore.getState().undo();
    expect(sectionInfo(asset, size(), obj(id).edits).x.edges[1]).toBeCloseTo(edges[1], 6);
    resetShape();
    expect(obj(id).edits).toBeUndefined();
    expect(getObjectAsset(null, obj(id))).toBe(asset);
  });

  it('keeps part edits made with the earlier editor until they are cleared', () => {
    const id = setup('desk');
    // A desk has no components to resize, but an earlier part edit still opens the editor to clear it.
    expect(canEditItem(useProjectStore.getState().project!, id)).toBe(false);
    const sig = `${getAsset(null, 'desk')!.build(getAsset(null, 'desk')!.defaultSize)[0].shape}:${getAsset(null, 'desk')!.build(getAsset(null, 'desk')!.defaultSize)[0].slot}`;
    useProjectStore.getState().execute('Old edit', (d) => {
      d.objects[id].edits = { parts: { '0': { sig, grow: [0.1, 0, 0] } } };
    });
    expect(getObjectAsset(null, obj(id))!.id).toMatch(/@shape:/);
    expect(canEditItem(useProjectStore.getState().project!, id)).toBe(true);
    enterShapeEdit(id);
    clearPartEdits();
    expect(obj(id).edits).toBeUndefined();
  });

  it('changes and resets a portal setting; the default stores nothing', () => {
    const id = setup('portal-frames:rounded-portal');
    enterShapeEdit(id);
    setParam('rL', 'Left corner radius', 0.9);
    expect(obj(id).edits?.params).toEqual({ rL: 0.9 });
    setParam('rL', 'Left corner radius', 0.35);
    expect(obj(id).edits).toBeUndefined();
  });

  it('updates and resets object shape params directly from the Inspector without entering 3D shape edit', () => {
    const id = setup('portal-frames:corner-portal-half-wall');
    useEditorStore.setState({ workspace: 'plan', shapeEdit: null });
    setObjectParam(id, 'legA', 'Side wall A (Width arm)', 1.15);
    setObjectParam(id, 'legB', 'Side wall B (Depth arm)', 0.95);
    expect(obj(id).edits?.params).toEqual({ legA: 1.15, legB: 0.95 });
    resetObjectParams(id);
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

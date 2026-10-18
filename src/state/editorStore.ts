import { create } from 'zustand';
import type { OpeningDesign, OpeningKind, Vec2, WallRole } from '@/domain/model/schema';
import type { MaterialTarget } from '@/domain/commands/entities';

export type ToolId = 'select' | 'pan' | 'wall' | 'curve' | 'room' | 'opening' | 'place' | 'measure' | 'split' | 'extend';
/** Which line of a new wall follows the drawn points: its centreline or one of its faces. */
export type WallReference = 'center' | 'left' | 'right';
export type Workspace = 'plan' | '3d' | 'split' | 'walk';
export type PlanMode = 'draft' | 'furnished' | 'presentation';
export type SelKind = 'wall' | 'node' | 'opening' | 'object' | 'room';
export type LibraryTab = 'build' | 'furniture' | 'materials';
/** Structural tools in the Build tab. (Columns, beams and similar pieces are furniture-library items.) */
export type BuildGroup = 'walls' | 'doors' | 'windows';

export interface SelItem {
  kind: SelKind;
  id: string;
}

/** The finish slot being edited in the material panel docked beside the Inspector. */
export interface MaterialPickerRequest {
  /** Identifies the slot row (target + label), so the same row can toggle the panel and show it is active. */
  key: string;
  /** Slot name shown in the panel header, e.g. "Floor" or "Body". */
  label: string;
  target: MaterialTarget;
  /** Material shown when the target has none of its own yet (e.g. default glazing). */
  fallbackId: string;
}

export interface PlanCamera {
  cx: number;
  cy: number;
  /** Screen pixels per metre. */
  zoom: number;
}

export interface Measurement {
  id: string;
  a: Vec2;
  b: Vec2;
}

export interface SnapSettings {
  grid: boolean;
  geometry: boolean;
  angle: boolean;
  guides: boolean;
}

/** What a duplicated item is placed with (see `EditorState.placeTemplate`). */
export interface PlaceTemplate {
  assetId: string;
  width: number;
  depth: number;
  height: number;
  elevation: number;
  mirrored: boolean;
  materials: Record<string, string>;
  model?: string;
  name: string | null;
}

export interface EditorState {
  tool: ToolId;
  wallRole: WallRole;
  wallThickness: number | null;
  /** Wall preset applied to newly drawn walls (see domain/model/wallPresets), or null for plain walls. */
  wallPreset: string | null;
  wallReference: WallReference;
  openingKind: OpeningKind;
  /** Designs for newly inserted doors / windows (null = the kind's default look). */
  doorDesign: OpeningDesign | null;
  windowDesign: OpeningDesign | null;
  /** Finish set for the next door / window placed: a finish id or `user:<id>`; null = the default look. */
  doorFinish: string | null;
  windowFinish: string | null;
  placeAssetId: string | null;
  placeRotation: number;
  /**
   * Placement of a copy (Duplicate): the item's own size, elevation, finishes, model and name, used
   * while `placeAssetId` is its asset. Cleared whenever something else sets `placeAssetId`.
   */
  placeTemplate: PlaceTemplate | null;
  /** Colour variant chosen per asset in the library (asset id → variant id); new items are placed in it. */
  variantChoice: Record<string, string>;
  /** Model variant chosen per asset in the library (used for new items). */
  modelChoice: Record<string, string>;
  selection: SelItem[];
  hover: SelItem | null;
  workspace: Workspace;
  planMode: PlanMode;
  chromeHidden: boolean;
  libraryOpen: boolean;
  libraryTab: LibraryTab;
  /** Asks the library to show an item's card (Inspector → Show in library); the nonce re-triggers it. */
  libraryReveal: { assetId: string; nonce: number } | null;
  /** Library: show this collection in the furniture tab (set after creating one). */
  libraryCollection: { id: string; nonce: number } | null;
  buildGroup: BuildGroup;
  libraryWidth: number;
  /** Desktop 3D view settings panel shown; when false it is stashed behind the rail's View button (P). */
  viewPanelOpen: boolean;
  /** Project overview in the Inspector's place whenever nothing is selected, in every view (top-bar toggle). */
  projectPanelOpen: boolean;
  snap: SnapSettings;
  gridVisible: boolean;
  planCamera: PlanCamera;
  /** Request for the plan canvas to fit the plan on next render. */
  fitRequest: number;
  cursor: Vec2 | null;
  snapLabel: string | null;
  hint: string | null;
  measurements: Measurement[];
  /** Currently focused material in the material editor. */
  activeMaterialId: string | null;
  /** Open finish picker panel (desktop), or null. Closed when the selection changes. */
  materialPicker: MaterialPickerRequest | null;
  /** 3D: request to move the camera to a preset id or a named view. */
  cameraRequest: { view: string; nonce: number } | null;

  setTool(tool: ToolId): void;
  setSelection(sel: SelItem[]): void;
  toggleSelection(item: SelItem): void;
  clearSelection(): void;
  setHover(item: SelItem | null): void;
  set(partial: Partial<EditorState>): void;
  requestFit(): void;
  requestCamera(view: string): void;
}

export const useEditorStore = create<EditorState>((set) => ({
  tool: 'select',
  wallRole: 'interior',
  wallThickness: null,
  wallPreset: null,
  wallReference: 'center',
  openingKind: 'door-single',
  doorDesign: null,
  windowDesign: null,
  doorFinish: null,
  windowFinish: null,
  placeAssetId: null,
  placeRotation: 0,
  placeTemplate: null,
  variantChoice: {},
  modelChoice: {},
  selection: [],
  hover: null,
  workspace: 'plan',
  planMode: 'draft',
  chromeHidden: false,
  libraryOpen: true,
  libraryTab: 'furniture',
  libraryReveal: null,
  libraryCollection: null,
  buildGroup: 'walls',
  libraryWidth: 300,
  // Opened on demand (top-bar button or P), not every time the 3D view is shown.
  viewPanelOpen: false,
  projectPanelOpen: true,
  snap: { grid: true, geometry: true, angle: true, guides: true },
  gridVisible: true,
  planCamera: { cx: 0, cy: 0, zoom: 60 },
  fitRequest: 0,
  cursor: null,
  snapLabel: null,
  hint: null,
  measurements: [],
  activeMaterialId: null,
  materialPicker: null,
  cameraRequest: null,

  setTool: (tool) => set({ tool, hint: null, snapLabel: null }),
  setSelection: (selection) => set({ selection: expandSelection(selection) }),
  toggleSelection: (item) =>
    set((s) => {
      // A grouped item toggles with its whole group.
      const items = expandSelection([item]);
      const exists = s.selection.some((x) => x.id === item.id);
      const ids = new Set(items.map((x) => x.id));
      return { selection: exists ? s.selection.filter((x) => !ids.has(x.id)) : [...s.selection, ...items.filter((x) => !s.selection.some((y) => y.id === x.id))] };
    }),
  clearSelection: () => set({ selection: [] }),
  setHover: (hover) => set((s) => (s.hover?.id === hover?.id ? s : { hover })),
  // Picking another item to place drops a Duplicate's template.
  set: (partial) => set('placeAssetId' in partial && !('placeTemplate' in partial) ? { ...partial, placeTemplate: null } : partial),
  requestFit: () => set((s) => ({ fitRequest: s.fitRequest + 1 })),
  requestCamera: (view) => set({ cameraRequest: { view, nonce: Math.random() } }),
}));

/**
 * Widens a selection to whole groups of placed items. Installed by the editor
 * (features/editor/groups.ts) so this store needs no project access; identity until then.
 */
let expandSelection: (sel: SelItem[]) => SelItem[] = (sel) => sel;
export function setSelectionExpander(fn: (sel: SelItem[]) => SelItem[]): void {
  expandSelection = fn;
}

const selectionKey = (sel: SelItem[]) => sel.map((s) => `${s.kind}:${s.id}`).join('|');

// The material panel belongs to the selection shown in the Inspector: close it when the selection changes or
// the Inspector goes away (walkthrough, hidden interface).
useEditorStore.subscribe((s, prev) => {
  if (!s.materialPicker) return;
  const selChanged = s.selection !== prev.selection && selectionKey(s.selection) !== selectionKey(prev.selection);
  if (selChanged || s.workspace === 'walk' || s.chromeHidden) s.set({ materialPicker: null });
});

export const selectionIds = (sel: SelItem[]) => sel.map((s) => s.id);

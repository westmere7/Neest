import { create } from 'zustand';
import type { OpeningKind, Vec2, WallRole } from '@/domain/model/schema';

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

export interface EditorState {
  tool: ToolId;
  wallRole: WallRole;
  wallThickness: number | null;
  /** Wall preset applied to newly drawn walls (see domain/model/wallPresets), or null for plain walls. */
  wallPreset: string | null;
  wallReference: WallReference;
  openingKind: OpeningKind;
  placeAssetId: string | null;
  placeRotation: number;
  selection: SelItem[];
  hover: SelItem | null;
  workspace: Workspace;
  planMode: PlanMode;
  chromeHidden: boolean;
  libraryOpen: boolean;
  libraryTab: LibraryTab;
  buildGroup: BuildGroup;
  libraryWidth: number;
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
  placeAssetId: null,
  placeRotation: 0,
  selection: [],
  hover: null,
  workspace: 'plan',
  planMode: 'draft',
  chromeHidden: false,
  libraryOpen: true,
  libraryTab: 'furniture',
  buildGroup: 'walls',
  libraryWidth: 300,
  snap: { grid: true, geometry: true, angle: true, guides: true },
  gridVisible: true,
  planCamera: { cx: 0, cy: 0, zoom: 60 },
  fitRequest: 0,
  cursor: null,
  snapLabel: null,
  hint: null,
  measurements: [],
  activeMaterialId: null,
  cameraRequest: null,

  setTool: (tool) => set({ tool, hint: null, snapLabel: null }),
  setSelection: (selection) => set({ selection }),
  toggleSelection: (item) =>
    set((s) => {
      const exists = s.selection.some((x) => x.id === item.id);
      return { selection: exists ? s.selection.filter((x) => x.id !== item.id) : [...s.selection, item] };
    }),
  clearSelection: () => set({ selection: [] }),
  setHover: (hover) => set((s) => (s.hover?.id === hover?.id ? s : { hover })),
  set: (partial) => set(partial),
  requestFit: () => set((s) => ({ fitRequest: s.fitRequest + 1 })),
  requestCamera: (view) => set({ cameraRequest: { view, nonce: Math.random() } }),
}));

export const selectionIds = (sel: SelItem[]) => sel.map((s) => s.id);

import type { Project, Vec2 } from '@/domain/model/schema';
import type { DerivedPlan } from '@/domain/geometry/derive';
import type { SnapContext, SnapKind, SnapResult } from '@/domain/geometry/snapping';
import type { DimensionSpec } from '../dimensions';
import type { EditorState, ToolId } from '@/state/editorStore';

export interface PointerInfo {
  /** Raw world position. */
  world: Vec2;
  /** Screen position relative to the canvas. */
  screen: Vec2;
  button: number;
  shift: boolean;
  alt: boolean;
  mod: boolean;
  pointerType: string;
}

export interface GhostObject {
  assetId: string;
  x: number;
  y: number;
  rotation: number;
  width: number;
  depth: number;
  height: number;
  /** Model variant of the item being placed. */
  model?: string;
  /** Height it stands at (on a table or counter it is placed over). */
  elevation?: number;
}

export interface ToolOverlay {
  /** Wall-thickness preview polygons. */
  wallPreviews?: Vec2[][];
  lines?: { a: Vec2; b: Vec2; kind: 'preview' | 'guide' | 'ghost' }[];
  marquee?: { a: Vec2; b: Vec2 } | null;
  dims?: DimensionSpec[];
  labels?: { p: Vec2; text: string; offset?: Vec2 }[];
  snap?: { p: Vec2; kind: SnapKind; label: string } | null;
  ghostObject?: GhostObject | null;
  /** Opening ghost: centre-line segment on a wall plus thickness. */
  ghostOpening?: { pts: Vec2[]; valid: boolean } | null;
  splitMarker?: { a: Vec2; b: Vec2 } | null;
  curveHandle?: { a: Vec2; b: Vec2; c: Vec2; mid: Vec2 } | null;
  numeric?: { label: string; value: string; p: Vec2 } | null;
}

export interface ToolEnv {
  project: () => Project;
  derived: () => DerivedPlan;
  editor: () => EditorState;
  /** World size of one screen pixel. */
  px: () => number;
  /** Pointer hit tolerance in world units (constant on screen). */
  tol: () => number;
  snap: (p: Vec2, extra?: Partial<SnapContext>) => SnapResult;
  setOverlay: (o: ToolOverlay | null) => void;
  setHint: (hint: string | null) => void;
  setSnapLabel: (label: string | null) => void;
  setCursor: (cursor: string) => void;
  /** Switch back to the select tool. */
  finish: () => void;
}

export interface Tool {
  id: ToolId;
  cursor: string;
  hint: string;
  onPointerDown?(e: PointerInfo, env: ToolEnv): void;
  onPointerMove?(e: PointerInfo, env: ToolEnv): void;
  onPointerUp?(e: PointerInfo, env: ToolEnv): void;
  onDoubleClick?(e: PointerInfo, env: ToolEnv): void;
  /** Returns true when the key was handled. */
  onKeyDown?(e: KeyboardEvent, env: ToolEnv): boolean;
  /** Abort any in-progress gesture. Returns true if something was cancelled. */
  cancel?(env: ToolEnv): boolean;
  /** True while a multi-step operation is in progress (Esc cancels it instead of leaving the tool). */
  busy?(): boolean;
}

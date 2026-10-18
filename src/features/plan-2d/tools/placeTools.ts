import { isDividerWall } from '@/domain/model/schema';
import type { Vec2 } from '@/domain/model/schema';
import { OPENING_PRESETS } from '@/domain/model/defaults';
import { addOpening, clampOpening, placeObject } from '@/domain/commands/entities';
import { chosenOpeningFinish } from '@/features/editor/openingFinishChoice';
import { placeSavedGroup, savedGroupFromDragId } from '@/features/editor/groups';
import { openingOffsetRange } from '@/domain/geometry/walls';
import { pointAt, projectOnPath } from '@/domain/geometry/wallPath';
import type { DerivedPlan } from '@/domain/geometry/derive';
import { add, dot, leftNormal, round, scale, sub } from '@/domain/geometry/vec';
import { formatLength } from '@/domain/model/units';
import { getAsset } from '@/data/assets/registry';
import type { AssetDefinition } from '@/data/assets/types';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore } from '@/state/editorStore';
import { usePrefsStore } from '@/state/uiStores';
import { placementMaterials, placementModel } from '@/features/library/variantChoice';
import type { PointerInfo, Tool, ToolEnv } from './types';
import { surfaceUnder } from './surfaces';

/**
 * Range for floor items with wallSnap while they are moved: the gap between their back and the
 * wall face. Kept small, so an item in a narrow space (a balcony) is not held by whichever wall is
 * near and dragged along it; placing a new item uses a wider range.
 */
export const WALL_HUG_MOVE = 0.08;

/**
 * Snaps an object's back against the nearest wall face (front facing into the
 * room) when it is close enough. Returns null when no wall is in range.
 */
export function hugWall(
  derived: DerivedPlan,
  center: Vec2,
  depth: number,
  range: number,
): { x: number; y: number; rotation: number; wallId: string } | null {
  let best: { x: number; y: number; rotation: number; wallId: string; d: number } | null = null;
  for (const g of derived.network.walls.values()) {
    if (isDividerWall(g.wall)) continue;
    if (g.wall.hidden) continue;
    const proj = projectOnPath(g.path, center);
    if (proj.s <= 0.001 || proj.s >= g.path.length - 0.001) continue;
    const reach = g.h + depth / 2 + range;
    if (proj.dist > reach) continue;
    const n0 = leftNormal(proj.tangent);
    const side = dot(sub(center, proj.point), n0) >= 0 ? 1 : -1;
    const n = scale(n0, side);
    const pos = add(proj.point, scale(n, g.h + depth / 2 + 0.003));
    const rotation = Math.atan2(-n.x, n.y);
    if (!best || proj.dist < best.d) best = { x: pos.x, y: pos.y, rotation, wallId: g.wall.id, d: proj.dist };
  }
  return best ? { x: best.x, y: best.y, rotation: best.rotation, wallId: best.wallId } : null;
}

// ───────────────────────── Openings ─────────────────────────

export function createOpeningTool(): Tool {
  let target: { wallId: string; offset: number; side: 'left' | 'right' } | null = null;
  /** R turns the opening round: the hinge end (R) and, inverted from the side pointed at, the side (Shift+R). */
  let hinge: 'start' | 'end' | null = null;
  let flipSide = false;
  let last: PointerInfo | null = null;
  const hingeOf = (env: ToolEnv): 'start' | 'end' => {
    const ed = env.editor();
    const tpl = ed.openingTemplate && ed.openingTemplate.kind === ed.openingKind ? ed.openingTemplate : null;
    return hinge ?? tpl?.hinge ?? 'start';
  };
  return {
    id: 'opening',
    cursor: 'copy',
    hint: 'Hover a wall and click to insert. Doors swing toward the side you point at; R flips the hinge, Shift+R the side. Esc to finish.',
    onPointerMove(e, env) {
      last = e;
      const derived = env.derived();
      const kind = env.editor().openingKind;
      const preset = OPENING_PRESETS[kind];
      const tpl = env.editor().openingTemplate;
      const copyWidth = tpl && tpl.kind === kind ? tpl.width : preset.width;
      let best: { wallId: string; s: number; d: number; side: 'left' | 'right' } | null = null;
      for (const g of derived.network.walls.values()) {
        if (g.wall.hidden || isDividerWall(g.wall)) continue;
        const proj = projectOnPath(g.path, e.world);
        if (proj.dist > g.h + env.tol() * 2.5) continue;
        const side = dot(sub(e.world, proj.point), leftNormal(proj.tangent)) >= 0 ? 'left' : 'right';
        if (!best || proj.dist < best.d) best = { wallId: g.wall.id, s: proj.s, d: proj.dist, side };
      }
      if (!best) {
        target = null;
        env.setOverlay(null);
        env.setSnapLabel(null);
        return;
      }
      const g = derived.network.walls.get(best.wallId)!;
      const width = Math.min(copyWidth, Math.max(0.3, g.clearEnd - g.clearStart));
      const [lo, hi] = openingOffsetRange(g, width);
      const grid = env.project().settings.gridSize;
      let s = best.s;
      if (env.editor().snap.grid && !e.alt) s = round(s, grid / 2);
      s = Math.min(Math.max(s, lo), hi);
      const side = flipSide ? (best.side === 'left' ? 'right' : 'left') : best.side;
      target = { wallId: best.wallId, offset: s, side };
      const at = (t: number, off: number) => {
        const { p, tangent } = pointAt(g.path, t);
        return add(p, scale(leftNormal(tangent), off));
      };
      const s0 = s - width / 2;
      const s1 = s + width / 2;
      const units = env.project().settings;
      // Which way it opens: the leaf, from the hinge end, out on the chosen side (doors that swing or fold).
      const h = hingeOf(env);
      const sgn = side === 'left' ? 1 : -1;
      const sHinge = h === 'start' ? s0 : s1;
      const swings = !kind.startsWith('window') && !kind.startsWith('passage') && kind !== 'door-sliding' && kind !== 'door-pocket';
      const leafLine = swings ? [{ a: at(sHinge, sgn * g.h), b: at(sHinge, sgn * (g.h + Math.min(width, 1.2))), kind: 'preview' as const }] : [];
      env.setSnapLabel('On wall');
      env.setOverlay({
        lines: leafLine,
        // A little proud of both wall faces: in 3D, walls win depth ties and would hide a flush ghost.
        ghostOpening: { pts: [at(s0, g.h + 0.012), at(s1, g.h + 0.012), at(s1, -g.h - 0.012), at(s0, -g.h - 0.012)], valid: hi >= lo },
        labels: [
          {
            p: at(s, 0),
            text: `${preset.label} · ${formatLength(s0, units.units, units.precision)} from start · hinge at ${h} · R / Shift+R to turn`,
            offset: { x: 14, y: 26 },
          },
        ],
      });
    },
    onPointerDown(e, env) {
      if (e.button !== 0 || !target) return;
      const t = target;
      const ed = env.editor();
      const kind = ed.openingKind;
      const design = kind.startsWith('window') ? ed.windowDesign : ed.doorDesign;
      const finish = chosenOpeningFinish(kind);
      const tpl = ed.openingTemplate && ed.openingTemplate.kind === kind ? ed.openingTemplate : null;
      const id = useProjectStore.getState().execute(`Add ${OPENING_PRESETS[kind].label.toLowerCase()}`, (d) => {
        if (tpl) {
          // A Duplicate: the original's every setting, on the wall and side clicked.
          const nid = addOpening(d, { wallId: t.wallId, kind, offset: t.offset, swingSide: t.side, width: tpl.width });
          if (nid) {
            Object.assign(d.openings[nid], JSON.parse(JSON.stringify(tpl)), { swingSide: t.side, hinge: hingeOf(env) });
            clampOpening(d, nid);
          }
          return nid;
        }
        return addOpening(d, { wallId: t.wallId, kind, offset: t.offset, swingSide: t.side, hinge: hingeOf(env), design, finish: finish ?? undefined });
      });
      if (id && !e.shift) {
        useEditorStore.getState().setSelection([{ kind: 'opening', id }]);
      }
    },
    onKeyDown(e, env) {
      // R turns the opening (as it turns furniture while placing), instead of starting the room tool.
      if (e.key.toLowerCase() !== 'r' || e.ctrlKey || e.metaKey) return false;
      if (e.shiftKey) flipSide = !flipSide;
      else hinge = hingeOf(env) === 'start' ? 'end' : 'start';
      if (last) this.onPointerMove?.(last, env);
      return true;
    },
    cancel(env) {
      target = null;
      env.setOverlay(null);
      return false;
    },
  };
}

// ───────────────────────── Furniture placement ─────────────────────────

/**
 * Placing happens on pointer-down; the click that follows on release must not select whatever lies
 * under the cursor instead (the 3D view picks objects on click, and clears the selection on a click
 * into empty space). Swallows that one click; the next press disarms it.
 */
function keepPlacedSelection(): void {
  if (typeof window === 'undefined') return;
  let timer = 0;
  const done = () => {
    window.removeEventListener('click', stop, true);
    window.removeEventListener('pointerdown', done, true);
    window.clearTimeout(timer);
  };
  const stop = (ev: MouseEvent) => {
    ev.stopPropagation();
    ev.preventDefault();
    done();
  };
  window.addEventListener('click', stop, true);
  window.addEventListener('pointerdown', done, true);
  timer = window.setTimeout(done, 5000);
}

export function placementFor(
  asset: AssetDefinition,
  world: Vec2,
  rotation: number,
  env: Pick<ToolEnv, 'derived' | 'editor' | 'project'>,
  free: boolean,
) {
  const size = asset.defaultSize;
  let x = world.x;
  let y = world.y;
  let rot = rotation;
  const grid = env.project().settings.gridSize;
  if (env.editor().snap.grid && !free) {
    x = round(x, grid / 2);
    y = round(y, grid / 2);
  }
  let hugged = false;
  if ((asset.wallSnap || asset.mount === 'wall') && !free) {
    const h = hugWall(env.derived(), world, size.d, asset.mount === 'wall' ? 0.6 : 0.3);
    if (h) {
      x = h.x;
      y = h.y;
      rot = h.rotation;
      hugged = true;
    }
  }
  return { x, y, rotation: rot, hugged };
}

export function createPlaceTool(): Tool {
  let ghost: { x: number; y: number; rotation: number } | null = null;
  const assetOf = (env: ToolEnv) => {
    const id = env.editor().placeAssetId;
    return id ? getAsset(env.project(), id) : null;
  };
  /** A Duplicate's template for this asset, if any. */
  const templateOf = (env: ToolEnv, asset: AssetDefinition) => {
    const t = env.editor().placeTemplate;
    return t && t.assetId === asset.id ? t : null;
  };
  /** Where the item stands: on the table, counter or cabinet under it, else its usual height. */
  const elevationAt = (env: ToolEnv, asset: AssetDefinition, x: number, y: number): number => {
    const t = templateOf(env, asset);
    const size = t ? { w: t.width, d: t.depth, h: t.height } : asset.defaultSize;
    return surfaceUnder(env.project(), asset, size, x, y) ?? t?.elevation ?? asset.defaultElevation;
  };
  /** The asset sized like the template (placement snaps and hugs walls with the copy's size). */
  const sizedLike = (env: ToolEnv, asset: AssetDefinition): AssetDefinition => {
    const t = templateOf(env, asset);
    return t ? { ...asset, defaultSize: { w: t.width, d: t.depth, h: t.height }, defaultElevation: t.elevation } : asset;
  };
  const render = (env: ToolEnv, hugged: boolean) => {
    const asset = assetOf(env);
    if (!asset || !ghost) {
      env.setOverlay(null);
      return;
    }
    env.setSnapLabel(hugged ? 'Against wall' : null);
    const t = templateOf(env, asset);
    env.setOverlay({
      ghostObject: {
        assetId: asset.id,
        model: t ? t.model : placementModel(asset),
        x: ghost.x,
        y: ghost.y,
        rotation: ghost.rotation,
        width: t?.width ?? asset.defaultSize.w,
        depth: t?.depth ?? asset.defaultSize.d,
        height: t?.height ?? asset.defaultSize.h,
        elevation: elevationAt(env, asset, ghost.x, ghost.y),
      },
    });
  };
  return {
    id: 'place',
    cursor: 'copy',
    hint: 'Click to place. R rotates 90°, Alt disables snapping, Shift-click places several. Esc to stop.',
    onPointerMove(e, env) {
      const asset = assetOf(env);
      if (!asset) return;
      const pl = placementFor(sizedLike(env, asset), e.world, env.editor().placeRotation, env, e.alt);
      ghost = { x: pl.x, y: pl.y, rotation: pl.rotation };
      render(env, pl.hugged);
    },
    onPointerDown(e, env) {
      if (e.button !== 0) return;
      const asset = assetOf(env);
      if (!asset) return;
      const pl = placementFor(sizedLike(env, asset), e.world, env.editor().placeRotation, env, e.alt);
      // A saved group: place its items as a new group, turned with the ghost.
      const group = savedGroupFromDragId(asset.id);
      if (group) {
        placeSavedGroup(group, { x: pl.x, y: pl.y }, pl.rotation);
        keepPlacedSelection();
        if (!e.shift) {
          env.setOverlay(null);
          useEditorStore.getState().set({ placeAssetId: null });
        }
        return;
      }
      const t = templateOf(env, asset);
      const id = useProjectStore.getState().execute(t ? `Duplicate ${asset.name.toLowerCase()}` : `Place ${asset.name.toLowerCase()}`, (d) => {
        const nid = placeObject(d, {
          assetId: asset.id,
          x: pl.x,
          y: pl.y,
          rotation: pl.rotation,
          width: t?.width ?? asset.defaultSize.w,
          depth: t?.depth ?? asset.defaultSize.d,
          height: t?.height ?? asset.defaultSize.h,
          elevation: elevationAt(env, asset, pl.x, pl.y),
          materials: t ? { ...t.materials } : placementMaterials(d, asset),
          model: t ? t.model : placementModel(asset),
          name: t?.name ?? undefined,
        });
        if (t?.mirrored) d.objects[nid].mirrored = true;
        return nid;
      });
      usePrefsStore.getState().pushRecentAsset(asset.id);
      if (id) keepPlacedSelection();
      if (!e.shift && id) {
        env.setOverlay(null);
        useEditorStore.getState().set({ tool: 'select', placeAssetId: null, selection: [{ kind: 'object', id }] });
      }
    },
    onKeyDown(e, env) {
      if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey) {
        const ed = env.editor();
        const next = (ed.placeRotation + (e.shiftKey ? -Math.PI / 2 : Math.PI / 2) + Math.PI * 2) % (Math.PI * 2);
        useEditorStore.getState().set({ placeRotation: next });
        if (ghost) {
          ghost.rotation = next;
          render(env, false);
        }
        return true;
      }
      return false;
    },
    cancel(env) {
      ghost = null;
      env.setOverlay(null);
      return false;
    },
  };
}

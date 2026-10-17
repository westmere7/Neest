import type { Vec2 } from '@/domain/model/schema';
import { OPENING_PRESETS } from '@/domain/model/defaults';
import { addOpening, placeObject } from '@/domain/commands/entities';
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
import type { Tool, ToolEnv } from './types';

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
  return {
    id: 'opening',
    cursor: 'copy',
    hint: 'Hover a wall and click to insert. Doors swing toward the side you point at. Esc to finish.',
    onPointerMove(e, env) {
      const derived = env.derived();
      const kind = env.editor().openingKind;
      const preset = OPENING_PRESETS[kind];
      let best: { wallId: string; s: number; d: number; side: 'left' | 'right' } | null = null;
      for (const g of derived.network.walls.values()) {
        if (g.wall.hidden) continue;
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
      const width = Math.min(preset.width, Math.max(0.3, g.clearEnd - g.clearStart));
      const [lo, hi] = openingOffsetRange(g, width);
      const grid = env.project().settings.gridSize;
      let s = best.s;
      if (env.editor().snap.grid && !e.alt) s = round(s, grid / 2);
      s = Math.min(Math.max(s, lo), hi);
      target = { wallId: best.wallId, offset: s, side: best.side };
      const at = (t: number, off: number) => {
        const { p, tangent } = pointAt(g.path, t);
        return add(p, scale(leftNormal(tangent), off));
      };
      const s0 = s - width / 2;
      const s1 = s + width / 2;
      const units = env.project().settings;
      env.setSnapLabel('On wall');
      env.setOverlay({
        ghostOpening: { pts: [at(s0, g.h), at(s1, g.h), at(s1, -g.h), at(s0, -g.h)], valid: hi >= lo },
        labels: [
          {
            p: at(s, 0),
            text: `${preset.label} · ${formatLength(s0, units.units, units.precision)} from start`,
            offset: { x: 14, y: 26 },
          },
        ],
      });
    },
    onPointerDown(e, env) {
      if (e.button !== 0 || !target) return;
      const t = target;
      const kind = env.editor().openingKind;
      const id = useProjectStore
        .getState()
        .execute(`Add ${OPENING_PRESETS[kind].label.toLowerCase()}`, (d) =>
          addOpening(d, { wallId: t.wallId, kind, offset: t.offset, swingSide: t.side }),
        );
      if (id && !e.shift) {
        useEditorStore.getState().setSelection([{ kind: 'opening', id }]);
      }
    },
    cancel(env) {
      target = null;
      env.setOverlay(null);
      return false;
    },
  };
}

// ───────────────────────── Furniture placement ─────────────────────────

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
  const render = (env: ToolEnv, hugged: boolean) => {
    const asset = assetOf(env);
    if (!asset || !ghost) {
      env.setOverlay(null);
      return;
    }
    env.setSnapLabel(hugged ? 'Against wall' : null);
    env.setOverlay({
      ghostObject: {
        assetId: asset.id,
        x: ghost.x,
        y: ghost.y,
        rotation: ghost.rotation,
        width: asset.defaultSize.w,
        depth: asset.defaultSize.d,
        height: asset.defaultSize.h,
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
      const pl = placementFor(asset, e.world, env.editor().placeRotation, env, e.alt);
      ghost = { x: pl.x, y: pl.y, rotation: pl.rotation };
      render(env, pl.hugged);
    },
    onPointerDown(e, env) {
      if (e.button !== 0) return;
      const asset = assetOf(env);
      if (!asset) return;
      const pl = placementFor(asset, e.world, env.editor().placeRotation, env, e.alt);
      const id = useProjectStore.getState().execute(`Place ${asset.name.toLowerCase()}`, (d) =>
        placeObject(d, {
          assetId: asset.id,
          x: pl.x,
          y: pl.y,
          rotation: pl.rotation,
          width: asset.defaultSize.w,
          depth: asset.defaultSize.d,
          height: asset.defaultSize.h,
          elevation: asset.defaultElevation,
        }),
      );
      usePrefsStore.getState().pushRecentAsset(asset.id);
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

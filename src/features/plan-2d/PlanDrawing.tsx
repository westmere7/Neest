import { isDividerWall } from '@/domain/model/schema';
import { memo, type ReactNode } from 'react';
import { isAssetHidden } from '@/data/assets/catalog';
import type { AreaUnit, LengthUnit, Project, Vec2 } from '@/domain/model/schema';
import type { DerivedPlan } from '@/domain/geometry/derive';
import { piecePolygon } from '@/domain/geometry/walls';
import { pointAt, slicePath } from '@/domain/geometry/wallPath';
import { add, dot, leftNormal, scale, sub } from '@/domain/geometry/vec';
import { convexHull, polygonCentroid } from '@/domain/geometry/polygon';
import { formatArea, formatLength } from '@/domain/model/units';
import { assetPlan, getAsset, getObjectAsset, objectSize, objectSlotMaterialId, resolveMaterial } from '@/data/assets/registry';
import { tintedPatternUrl } from '@/features/materials/textureCache';
import type { PlanMode } from '@/state/editorStore';
import { dimensionGeometry, type DimensionSpec } from './dimensions';
import { shade, type PlanPalette } from './palette';
import { arcPath, openingSymbol, type PlanPrim } from './symbols';

export interface PlanDrawOptions {
  mode: PlanMode;
  palette: PlanPalette;
  /** World size of one screen pixel (or one print point). */
  px: number;
  unit: LengthUnit;
  precision: number;
  areaUnit: AreaUnit;
  showRoomLabels: boolean;
  showAreas: boolean;
  dims: { overall: boolean; walls: boolean; rooms: boolean; openings?: boolean; thickness?: boolean; objects?: boolean };
  showFurniture: boolean;
  showConstruction: boolean;
  showAnnotations: boolean;
  textures: boolean;
  shadows: boolean;
  /** Draw a paper-coloured halo behind text for legibility. */
  halo: boolean;
  idPrefix: string;
  fontFamily?: string;
}

export const f = (n: number) => (Math.abs(n) < 1e-9 ? '0' : n.toFixed(4).replace(/\.?0+$/, ''));

export function polyPath(pts: Vec2[], closed = true): string {
  if (!pts.length) return '';
  let s = `M${f(pts[0].x)} ${f(pts[0].y)}`;
  for (let i = 1; i < pts.length; i++) s += `L${f(pts[i].x)} ${f(pts[i].y)}`;
  return closed ? s + 'Z' : s;
}

/** Objects mounted on the ceiling or this high are drawn as overhead (dashed) outlines. */
export const OVERHEAD_ELEVATION = 1.2;

function isOverhead(project: Project, o: Project['objects'][string]): boolean {
  const a = getAsset(project, o.assetId);
  return a?.mount === 'ceiling' || o.elevation >= OVERHEAD_ELEVATION;
}

const FONT = 'Inter, "Segoe UI", system-ui, -apple-system, Helvetica, Arial, sans-serif';

interface Props {
  project: Project;
  derived: DerivedPlan;
  opts: PlanDrawOptions;
}

/** The plan drawing rendered purely from the project model (screen and export). */
export const PlanDrawing = memo(function PlanDrawing({ project, derived, opts }: Props) {
  const { palette: pal, px, mode } = opts;
  const font = opts.fontFamily ?? FONT;
  const defs: ReactNode[] = [];
  const furnishedLike = mode !== 'draft';

  // ── Floors ──
  const floors = derived.faces.map((face, i) => {
    const room = derived.faceRooms[i];
    let fill = pal.roomFillDraft;
    if (furnishedLike) {
      const m = resolveMaterial(project, room?.floorMaterialId);
      fill = m.color;
      const url = opts.textures ? tintedPatternUrl(m) : null;
      if (url && m.texture) {
        const pid = `${opts.idPrefix}-floor-${i}`;
        const sz = m.texture.scale;
        defs.push(
          <pattern
            key={pid}
            id={pid}
            patternUnits="userSpaceOnUse"
            width={f(sz)}
            height={f(sz)}
            patternTransform={m.texture.rotation ? `rotate(${m.texture.rotation})` : undefined}
          >
            <image href={url} width={f(sz)} height={f(sz)} preserveAspectRatio="none" />
          </pattern>,
        );
        fill = `url(#${pid})`;
      }
    }
    const d = polyPath(face.inner) + face.holes.map((h) => polyPath(h)).join('');
    return <path key={face.key} d={d} fill={fill} fillRule="evenodd" data-room={room?.id} />;
  });

  // ── Furniture ──
  const furniture: ReactNode[] = [];
  if (opts.showFurniture && project.layers.furniture.visible) {
    const objs = Object.values(project.objects)
      .filter((o) => !o.hidden && !isAssetHidden(getAsset(project, o.assetId), project.render.hiddenCategories))
      .sort((a, b) => Number(isOverhead(project, a)) - Number(isOverhead(project, b)) || a.elevation + a.height - (b.elevation + b.height));
    for (const o of objs) {
      const asset = getObjectAsset(project, o);
      const deg = (o.rotation * 180) / Math.PI;
      const tf = `translate(${f(o.x)} ${f(o.y)}) rotate(${f(deg)})${o.mirrored ? ' scale(-1 1)' : ''}`;
      if (!asset) {
        furniture.push(
          <g key={o.id} transform={tf}>
            <rect
              x={f(-o.width / 2)}
              y={f(-o.depth / 2)}
              width={f(o.width)}
              height={f(o.depth)}
              fill="none"
              stroke={pal.dim}
              strokeDasharray={`${f(4 * px)} ${f(3 * px)}`}
              strokeWidth={f(px)}
            />
          </g>,
        );
        continue;
      }
      const plan = assetPlan(asset, objectSize(o), project.customAssets[o.assetId]);
      const sw = f(0.8 * px);
      if (isOverhead(project, o)) {
        // Ceiling fixtures and high wall units: dashed outline above the items below them.
        const hull = convexHull(plan.shapes.flatMap((sh) => sh.points));
        furniture.push(
          <g key={o.id} transform={tf} data-object={o.id}>
            <path
              d={polyPath(hull)}
              fill="none"
              stroke={furnishedLike ? 'rgba(20,18,15,0.6)' : pal.lineThin}
              strokeWidth={sw}
              strokeDasharray={`${f(4 * px)} ${f(2.5 * px)}`}
            />
          </g>,
        );
        continue;
      }
      furniture.push(
        <g key={o.id} transform={tf} data-object={o.id}>
          {plan.shapes.map((s, k) => {
            let fill = pal.furnitureFill;
            let stroke = pal.furnitureStroke;
            let fillOpacity = 1;
            if (furnishedLike) {
              const m =
                s.slot === 'model'
                  ? resolveMaterial(project, 'solid-light-grey')
                  : resolveMaterial(project, objectSlotMaterialId(o, asset, s.slot));
              fill = m.color;
              stroke = shade(m.color, -0.45);
              if (m.opacity < 0.95) fillOpacity = Math.max(0.35, m.opacity);
            }
            return (
              <path
                key={k}
                d={polyPath(s.points)}
                fill={fill}
                fillOpacity={fillOpacity}
                stroke={stroke}
                strokeWidth={sw}
                strokeLinejoin="round"
              />
            );
          })}
          {plan.strokes.map((st, k) => {
            const common = { fill: 'none', stroke: furnishedLike ? 'rgba(0,0,0,0.35)' : pal.furnitureStroke, strokeWidth: f(0.6 * px) };
            if (st.kind === 'line')
              return <line key={`s${k}`} x1={f(st.a[0])} y1={f(st.a[1])} x2={f(st.b[0])} y2={f(st.b[1])} {...common} />;
            if (st.kind === 'circle') return <circle key={`s${k}`} cx={f(st.c[0])} cy={f(st.c[1])} r={f(st.r)} {...common} />;
            return (
              <path key={`s${k}`} d={polyPath(st.points.map(([x, y]) => ({ x, y })), st.closed ?? false)} {...common} />
            );
          })}
        </g>,
      );
    }
  }

  // ── Walls ──
  const wallFills: ReactNode[] = [];
  let edgePath = '';
  if (project.layers.construction.visible) {
    for (const g of derived.network.walls.values()) {
      if (g.wall.hidden) continue;
      const style = g.wall.style ?? 'solid';
      if (style === 'separator') {
        // Invisible room divider: a thin dashed centre line, with an invisible wide stroke so it stays easy to pick.
        const centre = slicePath(g.path, 0, g.path.length, 0);
        wallFills.push(
          <g key={g.wall.id} data-wall={g.wall.id}>
            <path d={polyPath(centre, false)} fill="none" stroke="transparent" strokeWidth={f(8 * px)} />
            <path
              d={polyPath(centre, false)}
              fill="none"
              stroke={pal.dim}
              strokeOpacity={0.85}
              strokeWidth={f(1.1 * px)}
              strokeDasharray={`${f(6 * px)} ${f(4 * px)}`}
              strokeLinecap="round"
            />
          </g>,
        );
        continue;
      }
      if (style === 'glass' || style === 'railing-glass' || style === 'railing-bars') {
        // Light-weight walls: thin outline, a centre line (glass) and post/mullion ticks.
        g.planPieces.forEach((piece, k) => {
          const centre = slicePath(g.path, piece.s0, piece.s1, 0);
          wallFills.push(
            <g key={`${g.wall.id}-${k}`} data-wall={g.wall.id}>
              <path d={polyPath(piecePolygon(piece))} fill={pal.paper} fillOpacity={0.6} stroke={pal.wallFill} strokeWidth={f(0.9 * px)} />
              <path
                d={polyPath(centre, false)}
                fill="none"
                stroke={style === 'railing-bars' ? pal.wallFill : pal.glass}
                strokeWidth={f((style === 'glass' ? 1.4 : 1.1) * px)}
                strokeDasharray={style === 'railing-bars' ? `${f(2 * px)} ${f(2 * px)}` : undefined}
              />
              {wallTicks(g, piece.s0, piece.s1, style === 'glass' ? 1.2 : 1.4).map((s, i) => {
                const a = pointAt(g.path, s);
                const n = leftNormal(a.tangent);
                return (
                  <line
                    key={i}
                    x1={f(a.p.x + n.x * g.h)}
                    y1={f(a.p.y + n.y * g.h)}
                    x2={f(a.p.x - n.x * g.h)}
                    y2={f(a.p.y - n.y * g.h)}
                    stroke={pal.wallFill}
                    strokeWidth={f(1.6 * px)}
                  />
                );
              })}
            </g>,
          );
        });
        continue;
      }
      g.planPieces.forEach((piece, k) => {
        wallFills.push(
          <path
            key={`${g.wall.id}-${k}`}
            d={polyPath(piecePolygon(piece))}
            fill={pal.wallFill}
            fillOpacity={style === 'half' ? 0.55 : undefined}
            stroke={pal.wallFill}
            strokeWidth={f(0.6 * px)}
            data-wall={g.wall.id}
          />,
        );
        edgePath += polyPath(piece.left, false) + polyPath(piece.right, false);
        if (piece.atStart && g.startFree) edgePath += polyPath([g.startLeft, g.startRight], false);
        if (piece.atEnd && g.endFree) edgePath += polyPath([g.endLeft, g.endRight], false);
      });
    }
    derived.network.hubs.forEach((h) => {
      wallFills.push(
        <path key={`hub-${h.nodeId}`} d={polyPath(h.polygon)} fill={pal.hubFill} stroke={pal.hubFill} strokeWidth={f(0.6 * px)} />,
      );
    });
  }

  // ── Openings ──
  const openingEls: ReactNode[] = [];
  if (project.layers.construction.visible) {
    for (const g of derived.network.walls.values()) {
      if (g.wall.hidden) continue;
      for (const span of g.spans) {
        const o = project.openings[span.id];
        if (!o) continue;
        openingEls.push(
          <g key={o.id} data-opening={o.id}>
            {openingSymbol(o, g, span).map((prim, k) => renderPrim(prim, k, pal, px))}
          </g>,
        );
      }
    }
  }

  // ── Room labels ──
  const labels: ReactNode[] = [];
  if (opts.showAnnotations && project.layers.annotations.visible && (opts.showRoomLabels || opts.showAreas || opts.dims.rooms)) {
    derived.faces.forEach((face, i) => {
      const room = derived.faceRooms[i];
      if (room && !room.showLabel) return;
      const pos = add(face.label, room?.labelOffset ?? { x: 0, y: 0 });
      const lines: { text: string; size: number; weight: number; color: string; spacing?: number }[] = [];
      if (opts.showRoomLabels) {
        const name = room?.name ?? 'Room';
        lines.push({
          text: mode === 'presentation' ? name.toUpperCase() : name,
          size: mode === 'presentation' ? 10.5 : 12,
          weight: mode === 'presentation' ? 500 : 600,
          color: pal.label,
          spacing: mode === 'presentation' ? 1.2 : 0,
        });
      }
      if (opts.showAreas) lines.push({ text: formatArea(face.area, opts.areaUnit, opts.precision), size: 10.5, weight: 400, color: pal.labelMuted });
      if (opts.dims.rooms) {
        const w = face.bounds.maxX - face.bounds.minX;
        const h = face.bounds.maxY - face.bounds.minY;
        lines.push({
          text: `${formatLength(w, opts.unit, opts.precision, { suffix: false })} × ${formatLength(h, opts.unit, opts.precision)}`,
          size: 9.5,
          weight: 400,
          color: pal.labelMuted,
        });
      }
      const lineH = 14 * px;
      const startY = pos.y - ((lines.length - 1) * lineH) / 2 + 4 * px;
      labels.push(
        <g key={face.key} data-room-label={room?.id}>
          {lines.map((l, k) => (
            <text
              key={k}
              x={f(pos.x)}
              y={f(startY + k * lineH)}
              fontSize={f(l.size * px)}
              fontWeight={l.weight}
              fill={l.color}
              textAnchor="middle"
              fontFamily={font}
              letterSpacing={l.spacing ? f(l.spacing * px) : undefined}
              {...haloProps(opts, px)}
            >
              {l.text}
            </text>
          ))}
        </g>,
      );
    });
  }

  // ── Dimensions ──
  const dims: DimensionSpec[] = [];
  if (opts.showAnnotations && project.layers.annotations.visible) {
    const walls = [...derived.network.walls.values()].filter((g) => !g.wall.hidden && !isDividerWall(g.wall));
    if (opts.dims.overall && walls.length) {
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const g of walls)
        for (const p of g.footprint) {
          minX = Math.min(minX, p.x);
          minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x);
          maxY = Math.max(maxY, p.y);
        }
      const gap = 30 * px;
      dims.push({ a: { x: minX, y: minY }, b: { x: maxX, y: minY }, offset: gap, text: formatLength(maxX - minX, opts.unit, opts.precision) });
      dims.push({ a: { x: minX, y: maxY }, b: { x: minX, y: minY }, offset: gap, text: formatLength(maxY - minY, opts.unit, opts.precision) });
    }
    if (opts.dims.walls && walls.length) {
      const centroid = polygonCentroid(walls.map((g) => pointAt(g.path, g.path.length / 2).p));
      for (const g of walls) {
        if (g.path.control) continue;
        const L = g.path.length;
        if (L / px < 46) continue; // too short on screen for a legible label
        const mid = pointAt(g.path, L / 2);
        const n = leftNormal(mid.tangent);
        const outward = dot(n, sub(mid.p, centroid)) >= 0 ? 1 : -1;
        dims.push({ a: g.path.a, b: g.path.b, offset: outward * (g.h + 12 * px), text: formatLength(L, opts.unit, opts.precision) });
      }
    }
    if ((opts.dims.openings || opts.dims.thickness) && walls.length) {
      const centroid = polygonCentroid(walls.map((g) => pointAt(g.path, g.path.length / 2).p));
      for (const g of walls) {
        const mid = pointAt(g.path, g.path.length / 2);
        const inward = dot(leftNormal(mid.tangent), sub(mid.p, centroid)) >= 0 ? -1 : 1;
        // Door and window widths on the room side, just off the wall face.
        if (opts.dims.openings) {
          for (const span of g.spans) {
            if (!project.openings[span.id] || (span.s1 - span.s0) / px < 24) continue;
            const a = pointAt(g.path, span.s0).p;
            const b = pointAt(g.path, span.s1).p;
            dims.push({ a, b, offset: inward * (g.h + 10 * px), text: formatLength(span.s1 - span.s0, opts.unit, opts.precision) });
          }
        }
        // Thickness across the wall at a quarter of its length (clear of most openings and lengths).
        if (opts.dims.thickness && g.path.length / px > 60) {
          const q = pointAt(g.path, g.path.length * 0.25);
          const n = leftNormal(q.tangent);
          dims.push({ a: add(q.p, scale(n, -g.h)), b: add(q.p, scale(n, g.h)), offset: 0, text: formatLength(g.h * 2, opts.unit, opts.precision) });
        }
      }
    }
    // Width (along the front) and depth (along the right side) of every visible item, except small
    // things standing on furniture (a laptop on a desk) and sides too short on screen to label.
    if (opts.dims.objects && opts.showFurniture && project.layers.furniture.visible) {
      for (const o of Object.values(project.objects)) {
        if (o.hidden || Math.max(o.width, o.depth) / px < 40) continue;
        if (o.elevation > 0.3 && getAsset(project, o.assetId)?.mount === 'floor') continue;
        const c = Math.cos(o.rotation);
        const s = Math.sin(o.rotation);
        const at = (lx: number, lz: number): Vec2 => ({ x: o.x + lx * c - lz * s, y: o.y + lx * s + lz * c });
        const centre = { x: o.x, y: o.y };
        const outside = (a: Vec2, b: Vec2) => {
          const n = leftNormal({ x: b.x - a.x, y: b.y - a.y });
          const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          return dot(n, sub(m, centre)) >= 0 ? 1 : -1;
        };
        const fa = at(-o.width / 2, o.depth / 2);
        const fb = at(o.width / 2, o.depth / 2);
        if (o.width / px >= 40) dims.push({ a: fa, b: fb, offset: outside(fa, fb) * 7 * px, text: formatLength(o.width, opts.unit, opts.precision) });
        const ra = at(o.width / 2, o.depth / 2);
        const rb = at(o.width / 2, -o.depth / 2);
        if (o.depth / px >= 40) dims.push({ a: ra, b: rb, offset: outside(ra, rb) * 7 * px, text: formatLength(o.depth, opts.unit, opts.precision) });
      }
    }
  }
  const dimEls = dims.map((spec, i) => <Dimension key={i} spec={spec} px={px} color={pal.dim} opts={opts} font={font} />);

  const presentationShadow = mode === 'presentation' && opts.shadows;
  if (presentationShadow) {
    defs.push(
      <filter key="shadow" id={`${opts.idPrefix}-shadow`} x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx={f(2 * px)} dy={f(3 * px)} stdDeviation={f(3 * px)} floodColor={pal.shadow} floodOpacity="1" />
      </filter>,
    );
  }

  return (
    <g className="plan-drawing">
      {defs.length > 0 && <defs>{defs}</defs>}
      <g className="plan-floors">{floors}</g>
      <g className="plan-furniture" filter={presentationShadow ? `url(#${opts.idPrefix}-shadow)` : undefined}>
        {furniture}
      </g>
      <g className="plan-walls" filter={presentationShadow ? `url(#${opts.idPrefix}-shadow)` : undefined}>
        {wallFills}
        {edgePath && (
          <path
            d={edgePath}
            fill="none"
            stroke={pal.wallStroke}
            strokeWidth={f((mode === 'draft' ? 1.1 : 1) * px)}
            strokeLinecap="square"
          />
        )}
      </g>
      <g className="plan-openings">{openingEls}</g>
      <g className="plan-labels">{labels}</g>
      <g className="plan-dimensions">{dimEls}</g>
    </g>
  );
});

function haloProps(opts: PlanDrawOptions, px: number) {
  if (!opts.halo) return {};
  return {
    stroke: opts.palette.halo,
    strokeWidth: f(3 * px),
    strokeLinejoin: 'round' as const,
    paintOrder: 'stroke',
  };
}

function renderPrim(prim: PlanPrim, key: number, pal: PlanPalette, px: number): ReactNode {
  const color =
    prim.role === 'glass' ? pal.glass : prim.role === 'swing' || prim.role === 'thin' ? pal.lineThin : pal.opening;
  const width = prim.role === 'swing' || prim.role === 'thin' ? 0.7 * px : prim.role === 'glass' ? 0.9 * px : 1 * px;
  const dash = prim.t !== 'poly' && prim.dash ? `${f(4 * px)} ${f(3 * px)}` : undefined;
  if (prim.t === 'line')
    return (
      <line
        key={key}
        x1={f(prim.a.x)}
        y1={f(prim.a.y)}
        x2={f(prim.b.x)}
        y2={f(prim.b.y)}
        stroke={color}
        strokeWidth={f(width)}
        strokeDasharray={dash}
      />
    );
  if (prim.t === 'arc')
    return <path key={key} d={arcPath(prim.c, prim.r, prim.start, prim.end, f)} fill="none" stroke={color} strokeWidth={f(width)} strokeDasharray={dash} />;
  return (
    <path
      key={key}
      d={polyPath(prim.pts, prim.closed)}
      fill={prim.fill ? pal.paper : 'none'}
      stroke={color}
      strokeWidth={f(width)}
      strokeLinejoin="round"
    />
  );
}

export function Dimension({
  spec,
  px,
  color,
  opts,
  font,
}: {
  spec: DimensionSpec;
  px: number;
  color: string;
  opts: Pick<PlanDrawOptions, 'halo' | 'palette'>;
  font?: string;
}) {
  const g = dimensionGeometry(spec, px);
  const seg = ([a, b]: [Vec2, Vec2]) => `M${f(a.x)} ${f(a.y)}L${f(b.x)} ${f(b.y)}`;
  return (
    <g>
      <path
        d={seg(g.ext1) + seg(g.ext2) + seg(g.line)}
        stroke={color}
        strokeWidth={f(0.7 * px)}
        fill="none"
        strokeOpacity={0.85}
      />
      <path d={seg(g.tick1) + seg(g.tick2)} stroke={color} strokeWidth={f(1.3 * px)} fill="none" />
      <text
        x={f(g.textPos.x)}
        y={f(g.textPos.y)}
        fontSize={f(10.5 * px)}
        fill={color}
        textAnchor="middle"
        fontFamily={font ?? FONT}
        transform={`rotate(${f(g.textAngle)} ${f(g.textPos.x)} ${f(g.textPos.y)})`}
        style={{ fontVariantNumeric: 'tabular-nums' }}
        {...(opts.halo ? { stroke: opts.palette.paper, strokeWidth: f(3 * px), strokeLinejoin: 'round' as const, paintOrder: 'stroke' } : {})}
      >
        {spec.text}
      </text>
    </g>
  );
}

/** Positions of posts/mullions along [s0, s1]: both ends plus even divisions at most `max` apart. */
function wallTicks(g: { path: { length: number } }, s0: number, s1: number, max: number): number[] {
  const a = Math.max(0, s0 + 0.03);
  const b = Math.min(g.path.length, s1 - 0.03);
  if (b <= a) return [];
  const n = Math.max(1, Math.ceil((b - a) / max));
  return Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
}

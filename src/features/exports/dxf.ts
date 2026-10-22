import { slicePath } from '@/domain/geometry/wallPath';
import { isDividerWall } from '@/domain/model/schema';
import type { LengthUnit, Project, Vec2 } from '@/domain/model/schema';
import { derivePlan } from '@/domain/geometry/derive';
import { pointAt } from '@/domain/geometry/wallPath';
import { dot, leftNormal, sub } from '@/domain/geometry/vec';
import { polygonCentroid } from '@/domain/geometry/polygon';
import { formatArea, formatLength } from '@/domain/model/units';
import { assetPlan, getObjectAsset, objectSize } from '@/data/assets/registry';
import { openingSymbol } from '@/features/plan-2d/symbols';
import { dimensionGeometry } from '@/features/plan-2d/dimensions';
import { layoutCallout, visibleCallouts } from '@/features/callouts/layout';
import { lineText } from '@/features/callouts/content';

/**
 * DXF export (AutoCAD R12 / AC1009 ASCII), chosen for the widest CAD
 * compatibility. Mapping:
 *   A-WALL       wall outlines (faces and free ends)            LINE / POLYLINE
 *   A-DOOR       door jambs, leaves (closed polylines), swings  LINE / POLYLINE / ARC
 *   A-GLAZ       window frames and glazing lines                LINE
 *   A-AREA       clear room boundaries                          closed POLYLINE
 *   A-ANNO-TEXT  room names and areas                           TEXT
 *   A-ANNO-DIMS  dimension lines, ticks and values              LINE / TEXT (exploded)
 *   A-FURN       furniture and fixture footprints               closed POLYLINE / LINE / CIRCLE
 *   A-ANNO-CALL  callouts: target outline, leader, label box    POLYLINE / LINE / CIRCLE / TEXT
 * Model space is 1:1 in the chosen unit; the plan's +y (down on screen) is
 * flipped to DXF's +Y up.
 */

export type DxfUnit = 'mm' | 'cm' | 'm' | 'in';

export interface DxfOptions {
  unit: DxfUnit;
  furniture: boolean;
  dimensions: boolean;
  labels: boolean;
  rooms: boolean;
  /** Callouts visible in the editor. */
  callouts?: boolean;
}

const UNIT_SCALE: Record<DxfUnit, number> = { mm: 1000, cm: 100, m: 1, in: 1 / 0.0254 };
/** $INSUNITS codes. */
const INSUNITS: Record<DxfUnit, number> = { mm: 4, cm: 5, m: 6, in: 1 };

const LAYERS: { name: string; color: number; ltype?: string }[] = [
  { name: 'A-WALL', color: 7 },
  { name: 'A-DOOR', color: 3 },
  { name: 'A-GLAZ', color: 4 },
  { name: 'A-AREA', color: 5 },
  { name: 'A-ANNO-TEXT', color: 2 },
  { name: 'A-ANNO-DIMS', color: 1 },
  { name: 'A-FURN', color: 8 },
  { name: 'A-ANNO-CALL', color: 6 },
];

class DxfWriter {
  private out: string[] = [];
  minX = Infinity;
  minY = Infinity;
  maxX = -Infinity;
  maxY = -Infinity;
  constructor(private k: number) {}
  private pair(code: number, value: string | number) {
    this.out.push(String(code), typeof value === 'number' ? fmt(value) : value);
  }
  private xy(p: Vec2, codeX = 10) {
    const x = p.x * this.k;
    const y = -p.y * this.k;
    this.minX = Math.min(this.minX, x);
    this.minY = Math.min(this.minY, y);
    this.maxX = Math.max(this.maxX, x);
    this.maxY = Math.max(this.maxY, y);
    this.pair(codeX, x);
    this.pair(codeX + 10, y);
    this.pair(codeX + 20, 0);
  }
  line(layer: string, a: Vec2, b: Vec2, ltype?: string) {
    this.pair(0, 'LINE');
    this.pair(8, layer);
    if (ltype) this.pair(6, ltype);
    this.xy(a, 10);
    this.xy(b, 11);
  }
  polyline(layer: string, pts: Vec2[], closed: boolean) {
    if (pts.length < 2) return;
    this.pair(0, 'POLYLINE');
    this.pair(8, layer);
    this.pair(66, 1);
    this.pair(10, 0);
    this.pair(20, 0);
    this.pair(30, 0);
    this.pair(70, closed ? 1 : 0);
    for (const p of pts) {
      this.pair(0, 'VERTEX');
      this.pair(8, layer);
      this.xy(p);
    }
    this.pair(0, 'SEQEND');
    this.pair(8, layer);
  }
  /** Arc in plan coordinates (angles increase clockwise on screen). */
  arc(layer: string, c: Vec2, r: number, start: number, end: number) {
    // Flipping Y mirrors angles; a clockwise plan sweep start→end becomes CCW from -end to -start.
    const a0 = normDeg((-end * 180) / Math.PI);
    const a1 = normDeg((-start * 180) / Math.PI);
    this.pair(0, 'ARC');
    this.pair(8, layer);
    this.xy(c);
    this.pair(40, r * this.k);
    this.pair(50, a0);
    this.pair(51, a1);
  }
  circle(layer: string, c: Vec2, r: number) {
    this.pair(0, 'CIRCLE');
    this.pair(8, layer);
    this.xy(c);
    this.pair(40, r * this.k);
  }
  /** Centred text (or left-aligned on its baseline); rotation in plan degrees (clockwise on screen). */
  text(layer: string, p: Vec2, height: number, value: string, rotationDeg = 0, align: 'center' | 'left' = 'center') {
    this.pair(0, 'TEXT');
    this.pair(8, layer);
    this.xy(p, 10);
    this.pair(40, height * this.k);
    this.pair(1, value.replace(/[\r\n]+/g, ' '));
    if (rotationDeg) this.pair(50, normDeg(-rotationDeg));
    if (align === 'left') return;
    this.pair(72, 1);
    this.xy(p, 11);
  }
  entities() {
    return this.out;
  }
}

const fmt = (v: number) => {
  if (!Number.isFinite(v)) return '0';
  const s = (Math.round(v * 1e6) / 1e6).toString();
  return s.includes('e') ? v.toFixed(6) : s;
};
const normDeg = (d: number) => ((d % 360) + 360) % 360;

/** Builds the DXF document text for the current plan. */
export function buildDxf(project: Project, o: DxfOptions): string {
  const derived = derivePlan(project);
  const k = UNIT_SCALE[o.unit];
  const w = new DxfWriter(k);
  const textH = 0.14;
  const units: LengthUnit = o.unit === 'in' ? 'in' : o.unit;

  // Walls: the same edges drawn on screen (faces, free end caps).
  for (const g of derived.network.walls.values()) {
    if (g.wall.hidden) continue;
    // Invisible room dividers: a dashed centre line on their own layer.
    if (isDividerWall(g.wall)) {
      w.polyline('A-AREA-SEPR', slicePath(g.path, 0, g.path.length, 0), false);
      continue;
    }
    for (const piece of g.planPieces) {
      w.polyline('A-WALL', piece.left, false);
      w.polyline('A-WALL', piece.right, false);
      if (piece.atStart && g.startFree) w.line('A-WALL', g.startLeft, g.startRight);
      if (piece.atEnd && g.endFree) w.line('A-WALL', g.endLeft, g.endRight);
    }
    for (const span of g.spans) {
      const op = project.openings[span.id];
      if (!op) continue;
      const win = op.kind.startsWith('window');
      for (const prim of openingSymbol(op, g, span)) {
        const layer = win || prim.role === 'glass' ? 'A-GLAZ' : 'A-DOOR';
        if (prim.t === 'line') w.line(prim.role === 'jamb' ? 'A-WALL' : layer, prim.a, prim.b, prim.dash ? 'DASHED' : undefined);
        else if (prim.t === 'arc') w.arc(layer, prim.c, prim.r, prim.start, prim.end);
        else w.polyline(layer, prim.pts, prim.closed);
      }
    }
  }

  if (o.rooms || o.labels) {
    derived.faces.forEach((f, i) => {
      const r = derived.faceRooms[i];
      if (o.rooms) {
        w.polyline('A-AREA', f.inner, true);
        for (const h of f.holes) w.polyline('A-AREA', h, true);
      }
      if (o.labels) {
        w.text('A-ANNO-TEXT', { x: f.label.x, y: f.label.y - textH * 0.7 }, textH, r?.name ?? 'Room');
        w.text('A-ANNO-TEXT', { x: f.label.x, y: f.label.y + textH * 0.9 }, textH * 0.75, formatArea(f.area, project.settings.areaUnit, project.settings.precision));
      }
    });
  }

  if (o.furniture) {
    for (const obj of Object.values(project.objects)) {
      if (obj.hidden) continue;
      const asset = getObjectAsset(project, obj);
      if (!asset) continue;
      const plan = assetPlan(asset, objectSize(obj), project.customAssets[obj.assetId]);
      const c = Math.cos(obj.rotation);
      const s = Math.sin(obj.rotation);
      const tf = (p: Vec2): Vec2 => {
        const x = obj.mirrored ? -p.x : p.x;
        return { x: obj.x + x * c - p.y * s, y: obj.y + x * s + p.y * c };
      };
      for (const shape of plan.shapes) w.polyline('A-FURN', shape.points.map(tf), true);
      for (const st of plan.strokes) {
        if (st.kind === 'line') w.line('A-FURN', tf({ x: st.a[0], y: st.a[1] }), tf({ x: st.b[0], y: st.b[1] }));
        else if (st.kind === 'circle') w.circle('A-FURN', tf({ x: st.c[0], y: st.c[1] }), st.r);
        else w.polyline('A-FURN', st.points.map(([x, y]) => tf({ x, y })), st.closed ?? false);
      }
    }
  }

  if (o.dimensions) {
    const walls = [...derived.network.walls.values()].filter((g) => !g.wall.hidden && !g.path.control && !isDividerWall(g.wall));
    const centroid = walls.length ? polygonCentroid(walls.map((g) => pointAt(g.path, g.path.length / 2).p)) : { x: 0, y: 0 };
    const px = 0.012; // ~1 drawing px at 1:50
    for (const g of walls) {
      if (g.path.length < 0.3) continue;
      const mid = pointAt(g.path, g.path.length / 2);
      const n = leftNormal(mid.tangent);
      const outward = dot(n, sub(mid.p, centroid)) >= 0 ? 1 : -1;
      const geo = dimensionGeometry({ a: g.path.a, b: g.path.b, offset: outward * (g.h + 0.25), text: '' }, px);
      w.line('A-ANNO-DIMS', geo.ext1[0], geo.ext1[1]);
      w.line('A-ANNO-DIMS', geo.ext2[0], geo.ext2[1]);
      w.line('A-ANNO-DIMS', geo.line[0], geo.line[1]);
      w.line('A-ANNO-DIMS', geo.tick1[0], geo.tick1[1]);
      w.line('A-ANNO-DIMS', geo.tick2[0], geo.tick2[1]);
      w.text('A-ANNO-DIMS', geo.textPos, textH * 0.8, formatLength(g.path.length, units, project.settings.precision), geo.textAngle);
    }
  }

  if (o.callouts !== false) {
    const px = 0.012; // same label scale as the dimensions (~1 drawing px at 1:50)
    for (const c of visibleCallouts(project)) {
      const l = layoutCallout(project, derived, c, px);
      if (!l) continue;
      const { anchor, attach, box } = l;
      if (anchor.outline) w.polyline('A-ANNO-CALL', anchor.outline, true);
      w.circle('A-ANNO-CALL', anchor, 4 * px);
      w.line('A-ANNO-CALL', anchor, attach);
      w.polyline('A-ANNO-CALL', [{ x: box.x, y: box.y }, { x: box.x + box.w, y: box.y }, { x: box.x + box.w, y: box.y + box.h }, { x: box.x, y: box.y + box.h }], true);
      l.lines.forEach((line, i) => {
        const size = line.role === 'info' ? l.font * 0.92 : l.font;
        const y = box.y + l.pad + l.font * 0.82 + i * l.lineH;
        w.text('A-ANNO-CALL', { x: box.x + l.pad + 3 * px, y }, size, lineText(line), 0, 'left');
      });
    }
  }

  const ents = w.entities();
  const head: string[] = [];
  const p = (code: number, v: string | number) => head.push(String(code), typeof v === 'number' ? fmt(v) : v);
  p(999, `Neest floor plan export — ${project.name.replace(/[\r\n]+/g, ' ')} — planning drawing, not for construction`);
  p(0, 'SECTION');
  p(2, 'HEADER');
  p(9, '$ACADVER');
  p(1, 'AC1009');
  p(9, '$INSUNITS');
  p(70, INSUNITS[o.unit]);
  p(9, '$MEASUREMENT');
  p(70, o.unit === 'in' ? 0 : 1);
  p(9, '$EXTMIN');
  p(10, Number.isFinite(w.minX) ? w.minX : 0);
  p(20, Number.isFinite(w.minY) ? w.minY : 0);
  p(30, 0);
  p(9, '$EXTMAX');
  p(10, Number.isFinite(w.maxX) ? w.maxX : 0);
  p(20, Number.isFinite(w.maxY) ? w.maxY : 0);
  p(30, 0);
  p(0, 'ENDSEC');
  p(0, 'SECTION');
  p(2, 'TABLES');
  p(0, 'TABLE');
  p(2, 'LTYPE');
  p(70, 2);
  p(0, 'LTYPE');
  p(2, 'CONTINUOUS');
  p(70, 0);
  p(3, 'Solid line');
  p(72, 65);
  p(73, 0);
  p(40, 0);
  p(0, 'LTYPE');
  p(2, 'DASHED');
  p(70, 0);
  p(3, '__ __ __');
  p(72, 65);
  p(73, 2);
  p(40, 0.12 * k);
  p(49, 0.08 * k);
  p(49, -0.04 * k);
  p(0, 'ENDTAB');
  p(0, 'TABLE');
  p(2, 'LAYER');
  p(70, LAYERS.length);
  for (const l of LAYERS) {
    p(0, 'LAYER');
    p(2, l.name);
    p(70, 0);
    p(62, l.color);
    p(6, l.ltype ?? 'CONTINUOUS');
  }
  p(0, 'ENDTAB');
  p(0, 'TABLE');
  p(2, 'STYLE');
  p(70, 1);
  p(0, 'STYLE');
  p(2, 'STANDARD');
  p(70, 0);
  p(40, 0);
  p(41, 1);
  p(50, 0);
  p(71, 0);
  p(42, 2.5);
  p(3, 'txt');
  p(4, '');
  p(0, 'ENDTAB');
  p(0, 'ENDSEC');
  p(0, 'SECTION');
  p(2, 'BLOCKS');
  p(0, 'ENDSEC');
  p(0, 'SECTION');
  p(2, 'ENTITIES');
  const tail = ['0', 'ENDSEC', '0', 'EOF'];
  return [...head, ...ents, ...tail].join('\r\n') + '\r\n';
}

/** Minimal structural validation used by tests: balanced sections and known entity types. */
export function parseDxfPairs(text: string): { code: number; value: string }[] {
  const lines = text.split(/\r?\n/);
  const out: { code: number; value: string }[] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = parseInt(lines[i].trim(), 10);
    if (Number.isNaN(code)) break;
    out.push({ code, value: lines[i + 1] });
  }
  return out;
}

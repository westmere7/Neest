import { DEFAULT_MATERIALS } from '@/data/materials/catalog';
import type { Opening, OpeningDesign, OpeningKind, OpeningStyle, WindowDesign } from './schema';
import { DOOR_DESIGN_IDS, WINDOW_DESIGN_IDS, isPassageKind, isWindowKind } from './schema';

/**
 * Built-in door and window designs. The design is a separate axis from the kind: the kind says how
 * an opening works (swing, slide, fold, pivot, casement…), the design says what its leaves or sashes
 * look like. Everything here is pure data: the 3D builder (scene-3d/openingBuilder.ts) and the
 * picker's SVG previews (editor/OpeningDesignPicker.tsx) both draw from the same layouts.
 *
 * Leaf space: x runs from the hinge edge (0) to the closing edge (w), y from the leaf bottom (0) up
 * to h, in metres. Pane space for windows: x 0..gw, y 0..gh over one sash's glass.
 */

export interface OpeningDesignInfo {
  id: OpeningDesign;
  family: 'door' | 'window';
  label: string;
  hint: string;
  /** The coarse `Opening.style` this design implies (kept in step for older readers). */
  style: OpeningStyle;
  /** Suggested material when chosen: the leaf (doors) or the frame (windows). */
  material?: string;
  /** Kinds it never applies to. */
  exclude?: OpeningKind[];
  /** When set, the only kinds it applies to. */
  only?: OpeningKind[];
}

const D = (
  id: OpeningDesign,
  label: string,
  hint: string,
  style: OpeningStyle,
  extra: Partial<Pick<OpeningDesignInfo, 'material' | 'exclude' | 'only'>> = {},
): OpeningDesignInfo => ({
  id,
  family: (WINDOW_DESIGN_IDS as readonly string[]).includes(id) ? 'window' : 'door',
  label,
  hint,
  style,
  ...extra,
});

const RECT_WINDOWS: OpeningKind[] = [
  'window-single',
  'window-double',
  'window-fixed',
  'window-sliding',
  'window-tall',
];

export const OPENING_DESIGNS: OpeningDesignInfo[] = [
  // ── Doors ──
  D('flush', 'Flush', 'Plain flat slab', 'flush'),
  D('shaker', 'Shaker', 'One recessed panel', 'panel'),
  D('panel-2', 'Two panels', 'Two stacked recessed panels', 'panel'),
  D('panel-5', 'Five panels', 'Five horizontal recessed panels', 'panel'),
  D('groove-v', 'V-groove', 'Vertical grooves', 'flush'),
  D('groove-h', 'Lined', 'Horizontal grooves', 'flush'),
  D('reeded', 'Reeded', 'Fluted timber face', 'panel'),
  D('ledged', 'Plank', 'Vertical boards on ledges', 'panel'),
  D('louvred', 'Louvred', 'Angled slats', 'panel'),
  D('lite-half', 'Half lite', 'Glass in the upper half', 'glazed', { exclude: ['door-french'] }),
  D('lite-side', 'Side lite', 'Narrow glass strip by the hinge', 'glazed', {
    exclude: ['door-french', 'door-bifold'],
  }),
  D('lite-3h', 'Three lites', 'Three horizontal glass panes', 'glazed'),
  D('lite-full', 'Full lite', 'One large glass pane', 'glazed'),
  D('lite-frosted', 'Frosted lite', 'Framed frosted pane (bathrooms)', 'glazed'),
  D('lites-divided', 'Divided lites', 'Glazing bars in a timber frame', 'glazed'),
  D('ribbed-glass', 'Ribbed glass', 'Timber frame, reeded glass', 'glazed'),
  D('alu-clear', 'Slim aluminium', 'Minimal frame, clear glass', 'glazed', { material: 'metal-anthracite' }),
  D('alu-frosted', 'Slim frosted', 'Minimal frame, frosted glass', 'glazed', {
    material: 'metal-anthracite',
  }),
  D('alu-patio', 'Patio aluminium', 'Sturdy aluminium frame, deep bottom rail', 'glazed', {
    material: 'metal-anthracite',
    only: ['door-sliding', 'door-single', 'door-double', 'door-french', 'door-pocket'],
  }),
  D('steel-slim', 'Slim black frame', 'Thin black steel, one clear pane', 'glazed', { material: 'metal-black-matte' }),
  D('steel-fluted', 'Black fluted', 'Thin black steel, fluted glass', 'glazed', { material: 'metal-black-matte' }),
  D('steel-grid', 'Steel grid', 'Crittall-style black steel with a glazing grid', 'glazed', {
    material: 'metal-black-matte',
  }),
  // Frameless toughened glass: the "leaf" material colours the patch fittings, pulls and track.
  D('glass-frameless', 'Frameless glass', 'Toughened clear glass, patch fittings, long pull', 'glazed', {
    material: 'metal-brushed-steel',
    exclude: ['door-bifold'],
  }),
  D('glass-frameless-frosted', 'Frameless frosted', 'Satin-etched glass for bathrooms', 'glazed', {
    material: 'metal-brushed-steel',
    exclude: ['door-bifold'],
  }),
  D('glass-frameless-fluted', 'Frameless fluted', 'Reeded toughened glass, no frame', 'glazed', {
    material: 'metal-brushed-steel',
    exclude: ['door-bifold'],
  }),
  // ── Windows ──
  D('win-plain', 'Plain', 'Standard frame, clear glass', 'glazed'),
  D('win-slim', 'Slim', 'Near-frameless thin profiles', 'glazed'),
  D('win-steel', 'Black steel', 'Thin steel profiles and glazing bars', 'glazed', {
    material: 'metal-black-matte',
  }),
  D('win-tilt-turn', 'Tilt & turn', 'Chunky uPVC frame with a handle', 'glazed', {
    material: 'plastic-upvc-white',
    exclude: ['window-sliding', 'window-round'],
  }),
  D('win-transom', 'Top light', 'Fixed light above a transom bar', 'glazed', { only: RECT_WINDOWS }),
  D('win-asym', 'Asymmetric', 'Narrow vent beside a fixed pane', 'glazed', {
    only: ['window-single', 'window-fixed', 'window-tall'],
  }),
  D('win-grid-2x2', '2 × 2 grid', 'Four lites', 'glazed'),
  D('win-grid-3x2', '3 × 2 grid', 'Six lites', 'glazed', { exclude: ['window-round'] }),
  D('win-bars-v', 'Vertical bars', 'Upright glazing bars', 'glazed', { exclude: ['window-round'] }),
  D('win-bars-h', 'Horizontal bars', 'Level glazing bars', 'glazed', { exclude: ['window-round'] }),
  D('win-frosted-low', 'Frosted lower', 'Privacy pane below a bar', 'glazed', { exclude: ['window-round'] }),
  D('win-reeded', 'Reeded glass', 'Fluted privacy glass', 'glazed'),
];

export const OPENING_DESIGNS_BY_ID = Object.fromEntries(OPENING_DESIGNS.map((d) => [d.id, d])) as Record<
  OpeningDesign,
  OpeningDesignInfo
>;

export const isDoorDesign = (id: OpeningDesign) => (DOOR_DESIGN_IDS as readonly string[]).includes(id);

const FRAMELESS: readonly OpeningDesign[] = ['glass-frameless', 'glass-frameless-frosted', 'glass-frameless-fluted'];

/**
 * Frameless glass leaves: one toughened pane edge to edge, held by patch fittings (swing), a top
 * track (sliding) or clamp plates (barn) in the leaf material, drawn as glass in the plan.
 */
export const isFramelessDesign = (id: OpeningDesign | null | undefined): boolean => !!id && FRAMELESS.includes(id);

/** Thickness of a frameless toughened-glass leaf. */
export const FRAMELESS_GLASS = 0.01;

/** Whether a design can be used on an opening kind (passages take none). */
export function designFitsKind(design: OpeningDesign, kind: OpeningKind): boolean {
  const info = OPENING_DESIGNS_BY_ID[design];
  if (!info || isPassageKind(kind)) return false;
  if ((info.family === 'window') !== isWindowKind(kind)) return false;
  // French doors are glazed by definition.
  if (kind === 'door-french' && info.style !== 'glazed') return false;
  if (info.only && !info.only.includes(kind)) return false;
  return !info.exclude?.includes(kind);
}

/** Designs offered for a kind, in catalogue order. */
export function designsForKind(kind: OpeningKind): OpeningDesignInfo[] {
  return OPENING_DESIGNS.filter((d) => designFitsKind(d.id, kind));
}

/**
 * The design an opening without an explicit one shows. This reproduces the looks that existed before
 * designs: flush slabs, two panels (a braced plank leaf on barn doors), a full lite, French doors with
 * divided lites, and sliding doors glazed unless flush.
 */
export function defaultDesign(kind: OpeningKind, style: OpeningStyle): OpeningDesign | null {
  if (isPassageKind(kind)) return null;
  if (isWindowKind(kind)) return 'win-plain';
  if (kind === 'door-french') return 'lites-divided';
  if (kind === 'door-sliding') return style === 'flush' ? 'flush' : 'lite-full';
  if (style === 'glazed') return 'lite-full';
  if (style === 'panel') return kind === 'door-barn' ? 'ledged' : 'panel-2';
  return 'flush';
}

/** The design to draw: the opening's own when it fits its kind, otherwise the kind/style default. */
export function resolveOpeningDesign(o: Pick<Opening, 'kind' | 'style' | 'design'>): OpeningDesign | null {
  if (isPassageKind(o.kind)) return null;
  if (o.design && designFitsKind(o.design, o.kind)) return o.design;
  return defaultDesign(o.kind, o.style);
}

/**
 * Patch that applies a design: the design itself, its coarse style, and its suggested material on the
 * leaf (doors) or frame (windows). Leaving a design with a suggested material that is still in use
 * restores the default material, so e.g. going from "Steel grid" back to "Flush" gives a white leaf.
 */
export function designPatch(
  o: Pick<Opening, 'kind' | 'style' | 'design' | 'panelMaterialId' | 'frameMaterialId'>,
  design: OpeningDesign,
): Partial<Opening> {
  const next = OPENING_DESIGNS_BY_ID[design];
  const prevId = resolveOpeningDesign(o);
  const prev = prevId ? OPENING_DESIGNS_BY_ID[prevId] : undefined;
  const patch: Partial<Opening> = { design, style: next.style };
  const win = isWindowKind(o.kind);
  const slot = win ? 'frameMaterialId' : 'panelMaterialId';
  if (next.material) patch[slot] = next.material;
  else if (prev?.material && o[slot] === prev.material)
    patch[slot] = win ? DEFAULT_MATERIALS.windowFrame : DEFAULT_MATERIALS.doorPanel;
  return patch;
}

// ───────────────────────── Door leaves ─────────────────────────

export interface DRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Areas of a leaf that differ from the plain slab. Later regions win where they overlap. */
export type LeafRegionType = 'recess' | 'groove' | 'lite' | 'void';

export interface LeafLayout {
  regions: { type: LeafRegionType; r: DRect }[];
  /** Glass in the lites. */
  glass: 'clear' | 'frosted' | 'reeded';
  /** Glazing bars across lites. */
  bars: DRect[];
  /** Fluted fields (vertical reeds), sitting in recesses. */
  flutes: DRect[];
  /** Louvre bays (also listed as void regions). */
  louvres: DRect[];
  /** Ledges (horizontal battens) applied to the outer face. */
  battens: DRect[];
  /** Diagonal brace between the ledges (barn doors). */
  brace: boolean;
  /** One pane over the whole leaf, no stiles or rails (`isFramelessDesign`). */
  frameless: boolean;
}

/** How far recessed panels and grooves sit below each face, in metres. */
export const LEAF_RECESS = 0.01;
export const LEAF_GROOVE = 0.005;
/** Reed pitch on fluted faces and ribbed glass. */
export const REED_PITCH = 0.024;

const clampN = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const R = (x0: number, y0: number, x1: number, y1: number): DRect => ({ x0, y0, x1, y1 });
const valid = (r: DRect, min = 0.02) => r.x1 - r.x0 > min && r.y1 - r.y0 > min;

/** Stacks `n` rects over `area`, separated by rails `rail` thick (bottom to top). */
function stackRows(area: DRect, n: number, rail: number): DRect[] {
  const ph = (area.y1 - area.y0 - rail * (n - 1)) / n;
  if (ph < 0.03) return [area];
  return Array.from({ length: n }, (_, i) =>
    R(area.x0, area.y0 + i * (ph + rail), area.x1, area.y0 + i * (ph + rail) + ph),
  );
}

/** Glazing bars dividing `r` into `cols` × `rows` lites. */
export function gridBars(r: DRect, cols: number, rows: number, bar: number): DRect[] {
  const out: DRect[] = [];
  const w = r.x1 - r.x0;
  const h = r.y1 - r.y0;
  for (let j = 1; j < cols; j++) {
    const x = r.x0 + (w * j) / cols;
    out.push(R(x - bar / 2, r.y0, x + bar / 2, r.y1));
  }
  for (let i = 1; i < rows; i++) {
    const y = r.y0 + (h * i) / rows;
    out.push(R(r.x0, y - bar / 2, r.x1, y + bar / 2));
  }
  return out;
}

/** Leaf layout of a door design for a leaf `w` wide and `h` tall. */
export function doorLeafLayout(
  design: OpeningDesign,
  w: number,
  h: number,
  opts: { brace?: boolean } = {},
): LeafLayout {
  const L: LeafLayout = {
    regions: [],
    glass: 'clear',
    bars: [],
    flutes: [],
    louvres: [],
    battens: [],
    brace: false,
    frameless: false,
  };
  const add = (type: LeafRegionType, r: DRect) => {
    // Grooves are only a few millimetres wide; other regions need some size to be worth drawing.
    if (valid(r, type === 'groove' ? 0.001 : 0.02)) L.regions.push({ type, r });
  };
  const s = clampN(w * 0.16, 0.035, 0.11); // stile / top rail
  const rb = clampN(h * 0.1, s, 0.2); // bottom rail
  const field = R(s, rb, w - s, h - s);
  switch (design) {
    case 'shaker':
      add('recess', field);
      break;
    case 'panel-2': {
      const mid = h * 0.42;
      const mr = s * 0.9;
      add('recess', R(s, rb, w - s, mid - mr / 2));
      add('recess', R(s, mid + mr / 2, w - s, h - s));
      break;
    }
    case 'panel-5':
      for (const r of stackRows(field, 5, s * 0.75)) add('recess', r);
      break;
    case 'groove-v': {
      const n = Math.max(2, Math.round(w / 0.15));
      for (let i = 1; i < n; i++) add('groove', R((w * i) / n - 0.003, 0, (w * i) / n + 0.003, h));
      break;
    }
    case 'groove-h': {
      const n = Math.max(3, Math.round(h / 0.2));
      for (let i = 1; i < n; i++) add('groove', R(0, (h * i) / n - 0.003, w, (h * i) / n + 0.003));
      break;
    }
    case 'reeded': {
      const r = R(s * 0.7, rb * 0.7, w - s * 0.7, h - s * 0.7);
      add('recess', r);
      if (valid(r)) L.flutes.push(r);
      break;
    }
    case 'ledged': {
      const n = Math.max(2, Math.round(w / 0.14));
      for (let i = 1; i < n; i++) add('groove', R((w * i) / n - 0.002, 0, (w * i) / n + 0.002, h));
      const lh = clampN(h * 0.07, 0.06, 0.14);
      const inset = Math.min(0.03, w * 0.05);
      if (h > 0.8) {
        const y0 = clampN(h * 0.12, 0.1, 0.25);
        L.battens.push(R(inset, y0, w - inset, y0 + lh), R(inset, h - y0 - lh, w - inset, h - y0));
        L.brace = !!opts.brace;
      } else L.battens.push(R(inset, h / 2 - lh / 2, w - inset, h / 2 + lh / 2));
      break;
    }
    case 'louvred': {
      const bays =
        h > 1.4 ? [R(s, rb, w - s, h * 0.45 - s * 0.4), R(s, h * 0.45 + s * 0.4, w - s, h - s)] : [field];
      for (const r of bays) {
        if (!valid(r)) continue;
        add('void', r);
        L.louvres.push(r);
      }
      break;
    }
    case 'lite-half':
      add('lite', R(s, Math.max(h * 0.5, rb), w - s, h - s));
      break;
    case 'lite-side': {
      const lw = clampN(w * 0.14, 0.06, 0.14);
      add('lite', R(s * 0.9, rb + 0.1, s * 0.9 + lw, h - s - 0.1));
      break;
    }
    case 'lite-3h':
      for (const r of stackRows(field, 3, s * 0.8)) add('lite', r);
      break;
    case 'lite-full':
    case 'lite-frosted': {
      const rail = Math.min(0.09, w * 0.15);
      add('lite', R(rail, rail * 1.6, w - rail, h - rail));
      if (design === 'lite-frosted') L.glass = 'frosted';
      break;
    }
    case 'lites-divided': {
      const stile = Math.min(0.08, w * 0.15);
      const r = R(stile, Math.min(0.2, h * 0.1), w - stile, h - 0.08);
      add('lite', r);
      const rows = clampN(Math.round((r.y1 - r.y0) / 0.42), 3, 5);
      L.bars = gridBars(r, r.x1 - r.x0 > 0.45 ? 2 : 1, rows, 0.024);
      break;
    }
    case 'ribbed-glass': {
      const stile = Math.min(0.08, w * 0.15);
      add('lite', R(stile, Math.min(0.16, h * 0.08), w - stile, h - stile));
      L.glass = 'reeded';
      break;
    }
    case 'alu-clear':
    case 'alu-frosted': {
      const p = Math.min(0.04, w * 0.1);
      add('lite', R(p, p * 1.3, w - p, h - p));
      if (design === 'alu-frosted') L.glass = 'frosted';
      break;
    }
    case 'steel-grid': {
      const p = Math.min(0.04, w * 0.1);
      const r = R(p, p * 2, w - p, h - p);
      add('lite', r);
      const rows = clampN(Math.round((r.y1 - r.y0) / 0.4), 3, 7);
      L.bars = gridBars(r, r.x1 - r.x0 > 0.55 ? 2 : 1, rows, 0.022);
      break;
    }
    case 'steel-slim':
    case 'steel-fluted': {
      const p = Math.min(0.03, w * 0.08);
      add('lite', R(p, p * 1.8, w - p, h - p));
      if (design === 'steel-fluted') L.glass = 'reeded';
      break;
    }
    case 'alu-patio': {
      // Chunky sliding-door profiles: wide stiles and a deep bottom rail.
      const p = Math.min(0.07, w * 0.12);
      add('lite', R(p, Math.min(0.12, h * 0.08), w - p, h - Math.min(0.065, h * 0.05)));
      break;
    }
    case 'glass-frameless':
    case 'glass-frameless-frosted':
    case 'glass-frameless-fluted':
      add('lite', R(0, 0, w, h));
      L.frameless = true;
      if (design === 'glass-frameless-frosted') L.glass = 'frosted';
      if (design === 'glass-frameless-fluted') L.glass = 'reeded';
      break;
    default:
      break; // flush
  }
  // Bars only where there is glass.
  if (!L.regions.some((x) => x.type === 'lite')) L.bars = [];
  return L;
}

export interface LeafCell extends DRect {
  type: 'solid' | LeafRegionType;
}

/**
 * Splits a leaf into rectangles of one type each (solid, recess, groove, lite, void): the cells of the
 * grid through every region edge, merged into horizontal runs and then stacked runs. The builder turns
 * each into one box (solid at full depth, recess/groove thinner, lite = glass, void = nothing).
 */
export function leafCells(layout: LeafLayout, w: number, h: number): LeafCell[] {
  const xs = new Set<number>([0, w]);
  const ys = new Set<number>([0, h]);
  const clip = (v: number, hi: number) => Math.min(hi, Math.max(0, v));
  for (const { r } of layout.regions) {
    xs.add(clip(r.x0, w)).add(clip(r.x1, w));
    ys.add(clip(r.y0, h)).add(clip(r.y1, h));
  }
  const X = [...xs].sort((a, b) => a - b).filter((v, i, a) => i === 0 || v - a[i - 1] > 1e-6);
  const Y = [...ys].sort((a, b) => a - b).filter((v, i, a) => i === 0 || v - a[i - 1] > 1e-6);
  const typeAt = (x: number, y: number): LeafCell['type'] => {
    let t: LeafCell['type'] = 'solid';
    for (const { type, r } of layout.regions) if (x > r.x0 && x < r.x1 && y > r.y0 && y < r.y1) t = type;
    return t;
  };
  // Horizontal runs per row.
  const rows: LeafCell[][] = [];
  for (let j = 0; j < Y.length - 1; j++) {
    const row: LeafCell[] = [];
    for (let i = 0; i < X.length - 1; i++) {
      const type = typeAt((X[i] + X[i + 1]) / 2, (Y[j] + Y[j + 1]) / 2);
      const last = row[row.length - 1];
      if (last && last.type === type) last.x1 = X[i + 1];
      else row.push({ type, x0: X[i], x1: X[i + 1], y0: Y[j], y1: Y[j + 1] });
    }
    rows.push(row);
  }
  // Stack identical runs of consecutive rows.
  const out: LeafCell[] = [];
  let open: LeafCell[] = [];
  for (const row of rows) {
    const next: LeafCell[] = [];
    for (const c of row) {
      const above = open.find(
        (o) =>
          o.type === c.type &&
          Math.abs(o.x0 - c.x0) < 1e-6 &&
          Math.abs(o.x1 - c.x1) < 1e-6 &&
          Math.abs(o.y1 - c.y0) < 1e-6,
      );
      if (above) {
        above.y1 = c.y1;
        next.push(above);
      } else next.push(c);
    }
    for (const o of open) if (!next.includes(o)) out.push(o);
    open = next;
  }
  out.push(...open);
  return out;
}

// ───────────────────────── Windows ─────────────────────────

export interface WindowSpec {
  /** Outer frame width. */
  frame: number;
  /** Sash profile width and depth. */
  sash: number;
  sashDepth: number;
  /** Glazing bar width and depth. */
  bar: number;
  barDepth: number;
  glass: 'panel' | 'reeded';
  /** Fixed top light above a transom bar. */
  topLight: boolean;
  /** Off-centre mullion: a narrow vent beside a fixed pane. */
  mullion: boolean;
  /** Lever handle on the sash's closing stile. */
  handle: boolean;
  /** The design draws its own glazing bars (the "Muntin grid" grille option is then not added). */
  ownBars: boolean;
}

const BASE_SPEC: WindowSpec = {
  frame: 0.06,
  sash: 0.045,
  sashDepth: 0.05,
  bar: 0.018,
  barDepth: 0.03,
  glass: 'panel',
  topLight: false,
  mullion: false,
  handle: false,
  ownBars: false,
};

export function windowSpec(design: OpeningDesign | null): WindowSpec {
  switch (design as WindowDesign | null) {
    case 'win-slim':
      return { ...BASE_SPEC, frame: 0.035, sash: 0.02, sashDepth: 0.04 };
    case 'win-steel':
      return {
        ...BASE_SPEC,
        frame: 0.035,
        sash: 0.026,
        sashDepth: 0.035,
        bar: 0.02,
        barDepth: 0.032,
        ownBars: true,
      };
    case 'win-tilt-turn':
      return { ...BASE_SPEC, frame: 0.075, sash: 0.07, sashDepth: 0.068, handle: true };
    case 'win-transom':
      return { ...BASE_SPEC, topLight: true };
    case 'win-asym':
      return { ...BASE_SPEC, mullion: true };
    case 'win-grid-2x2':
    case 'win-grid-3x2':
    case 'win-bars-v':
    case 'win-bars-h':
      return { ...BASE_SPEC, ownBars: true };
    case 'win-reeded':
      return { ...BASE_SPEC, glass: 'reeded' };
    default:
      return BASE_SPEC;
  }
}

/** Height of the fixed top light for a window `innerH` tall (0 when too short for one). */
export function topLightHeight(innerH: number): number {
  return innerH > 0.8 ? clampN(innerH * 0.28, 0.22, 0.55) : 0;
}

/** Share of the inner width taken by the narrow vent of an asymmetric window. */
export const ASYM_VENT_SHARE = 0.36;

/**
 * Glazing bars and frosted area over one sash's glass (`gw` × `gh`), where the sash spans `share`
 * of the window's width (grids are counted per window, so a pair of casements splits the columns).
 */
export function sashGlazing(
  design: OpeningDesign | null,
  gw: number,
  gh: number,
  share = 1,
): { bars: DRect[]; frosted: DRect | null } {
  const spec = windowSpec(design);
  const all = R(0, 0, gw, gh);
  const b = spec.bar;
  switch (design as WindowDesign | null) {
    case 'win-grid-2x2':
      return { bars: gridBars(all, Math.max(1, Math.round(2 * share)), 2, b), frosted: null };
    case 'win-grid-3x2':
      return { bars: gridBars(all, Math.max(1, Math.round(3 * share)), 2, b), frosted: null };
    case 'win-bars-v':
      return { bars: gridBars(all, Math.max(2, Math.round(gw / 0.22)), 1, b), frosted: null };
    case 'win-bars-h':
      return { bars: gridBars(all, 1, Math.max(2, Math.round(gh / 0.28)), b), frosted: null };
    case 'win-steel':
      return { bars: gridBars(all, gw > 0.8 ? 2 : 1, Math.max(1, Math.round(gh / 0.42)), b), frosted: null };
    case 'win-frosted-low': {
      if (gh < 0.45) return { bars: [], frosted: all };
      const y = gh * 0.42;
      return { bars: [R(0, y - b / 2, gw, y + b / 2)], frosted: R(0, 0, gw, y - b / 2) };
    }
    default:
      return { bars: [], frosted: null };
  }
}

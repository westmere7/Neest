/**
 * Portal frames — rounded drywall portals that frame a zone: a soffit dropping from the ceiling that
 * curves down into one or two legs, as used around kitchens, bed-and-desk nooks and study platforms.
 * Round-cornered, soft-square, round-top and basket-arch openings; L-shaped frames that butt into a
 * wall (mirror the item for the other hand); asymmetric, stepped and LED-cove versions; a deep
 * kitchen portal with downlights; legs with lit shelf niches; a desk nook and a half-wall portal;
 * and a ceiling-hung rounded header.
 *
 * Everything is built from the item's real size: the opening is a 2D outline extruded through the
 * frame's depth, so corners stay circular at any width and height and only shrink when the opening
 * gets too small for them. Coordinates: x across the opening, y up, z through the frame (front +z).
 */
import { cells, clamp, cyl, defineItem, definePack, line, matSlot, prism, range, ring, spaced, span, type Part, type Size3 } from '@/packs/kit';

type V2 = [number, number];
const o = { plan: false };
const CEILING = 2.7;

/** A flat panel in the X/Y (front) plane from [x, y] points, extruded from z0 to z0 + t. */
function panelXY(slot: string, pts: V2[], z0: number, t: number): Part {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  return {
    shape: 'prism',
    outline: pts.map(([x, y]) => [x - cx, -(y - cy)] as V2),
    height: t,
    position: [cx, cy, z0],
    rotation: [Math.PI / 2, 0, 0],
    slot,
    plan: false,
  };
}

/** Points on an elliptical arc (centre cx, cy; radii rx, ry) from angle a0 to a1, endpoints included. */
const arc = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 16): V2[] =>
  range(n + 1).map((i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry] as V2;
  });

/** Drops repeated consecutive points (zero-length edges break the extrusion). */
const dedupe = (pts: V2[]): V2[] =>
  pts.filter((p, i) => {
    const q = pts[(i + pts.length - 1) % pts.length];
    return Math.abs(p[0] - q[0]) > 1e-5 || Math.abs(p[1] - q[1]) > 1e-5;
  });

/** Plan outline [x, z] of a slab with a square end at x1 and a rounded end at x0. */
function roundEnd(x0: number, x1: number, z0: number, z1: number, r: number): V2[] {
  const rr = Math.max(0.005, Math.min(r, (z1 - z0) / 2 - 0.001, x1 - x0 - 0.001));
  return dedupe([
    [x1, z0],
    [x1, z1],
    ...arc(x0 + rr, z1 - rr, rr, rr, Math.PI / 2, Math.PI, 10),
    ...arc(x0 + rr, z0 + rr, rr, rr, Math.PI, (3 * Math.PI) / 2, 10),
  ]);
}

// ---------------------------------------------------------------------------
// The portal builder
// ---------------------------------------------------------------------------

interface PortalSpec {
  /** 'both' = a leg on each side; 'right' = one leg on the right, the left end butts into a wall. */
  legs: 'both' | 'right';
  /** Leg width (m); legs never take more than 30 % (one leg: 40 %) of the width. */
  leg: number;
  /** How far the soffit drops below the ceiling (m). */
  head: number;
  /** Corner shape: rounded corners (rL, rR), a semicircular head, or a flattened basket arch. */
  shape?: 'round' | 'semicircle' | 'ellipse';
  rL?: number;
  rR?: number;
  /** Basket arch: rise as a fraction of the half-span. */
  flat?: number;
  /** Height of the legs' feet: 0 on the floor, more when they stand on a desk or half wall. */
  base?: number;
  /** Clear height kept under the soffit (shrinks the soffit first). */
  clear?: number;
  /** Front and back layers set back by this much: a stepped, double-layer frame. */
  step?: number;
  /** LED cove: a shadow-gap reveal at the ceiling line on both faces with a glowing strip. */
  cove?: boolean;
  /** Lit shelf niches in the legs (front face). */
  niche?: 'both' | 'right';
  /** Recessed downlights in the soffit underside. */
  downlights?: boolean;
  /** A built-in desk cantilevered from the right leg into the opening, at this height. */
  desk?: number;
  /** A capped half wall under the right leg reaching into the opening, at this height. */
  halfWall?: number;
  /** Timber lining this thick around the opening, through the full depth (shows as a band on both faces). */
  lining?: number;
}

interface Geo {
  w: number;
  d: number;
  h: number;
  legL: boolean;
  xl: number;
  xr: number;
  yi: number;
  yb: number;
  cl: V2;
  cr: V2;
}

function portalGeo({ w, d, h }: Size3, s: PortalSpec): Geo {
  const legL = s.legs === 'both';
  const lw = Math.min(s.leg, w * (legL ? 0.3 : 0.4));
  const xl = legL ? -w / 2 + lw : -w / 2;
  const xr = w / 2 - lw;
  const yb = s.base ?? 0;
  const head = clamp(h - yb - (s.clear ?? 1.85), 0.08, s.head);
  const yi = h - head;
  const ow = xr - xl;
  const room = Math.max(0, yi - yb - 0.04);
  let rl = legL ? (s.rL ?? 0.3) : 0;
  let rr = s.rR ?? 0.3;
  if (s.shape === 'semicircle' || s.shape === 'ellipse') {
    rl = legL ? ow / 2 : 0;
    rr = legL ? ow / 2 : ow;
  }
  const fit = rl + rr > ow ? ow / (rl + rr) : 1;
  rl *= fit;
  rr *= fit;
  const corner = (r: number): V2 => {
    if (r <= 0.001) return [0, 0];
    if (s.shape === 'ellipse') return [r, Math.min(r * (s.flat ?? 0.4), room)];
    const c = Math.min(r, room);
    return [c, c];
  };
  return { w, d, h, legL, xl, xr, yi, yb, cl: corner(rl), cr: corner(rr) };
}

/** One layer of the frame (z0..z1): the soffit and corner curves as one outline, the straight legs as boxes. */
function frameLayer(g: Geo, z: V2, grow: number, top: number, s: PortalSpec): Part[] {
  const { w, legL, yb } = g;
  const xl = legL ? g.xl - grow : g.xl;
  const xr = g.xr + grow;
  const y = g.yi + grow;
  const cr: V2 = g.cr[0] > 0 ? [g.cr[0] + grow, g.cr[1] + grow] : [0, 0];
  const cl: V2 = g.cl[0] > 0 ? [g.cl[0] + grow, g.cl[1] + grow] : [0, 0];
  const ysR = y - cr[1];
  const ysL = y - cl[1];
  const pts: V2[] = [legL ? [-w / 2, ysL] : [-w / 2, y], [-w / 2, top], [w / 2, top], [w / 2, ysR], [xr, ysR]];
  if (cr[0] > 0) pts.push(...arc(xr - cr[0], ysR, cr[0], cr[1], 0, Math.PI / 2));
  else pts.push([xr, y]);
  if (legL) {
    if (cl[0] > 0) pts.push(...arc(xl + cl[0], ysL, cl[0], cl[1], Math.PI / 2, Math.PI));
    else pts.push([xl, y], [xl, ysL]);
  }
  const parts: Part[] = [panelXY('frame', dedupe(pts), z[0], z[1] - z[0])];
  // Straight leg sections (shown on the plan); niche legs are built separately on the core layer.
  const core = grow === 0;
  if (ysR - yb > 0.005 && !(core && (s.niche === 'right' || s.niche === 'both'))) parts.push(span('frame', [xr, w / 2], [yb, ysR], z));
  if (legL && ysL - yb > 0.005 && !(core && s.niche === 'both')) parts.push(span('frame', [-w / 2, xl], [yb, ysL], z));
  return parts;
}

/** The edge of the opening grown by `grow`: from the left foot, round the head, down to the right foot. */
function openingEdge(g: Geo, grow: number): V2[] {
  const { w, legL, yb } = g;
  const xl = legL ? g.xl - grow : g.xl;
  const xr = g.xr + grow;
  const y = g.yi + grow;
  const cr: V2 = g.cr[0] > 0 ? [g.cr[0] + grow, g.cr[1] + grow] : [0, 0];
  const cl: V2 = g.cl[0] > 0 ? [g.cl[0] + grow, g.cl[1] + grow] : [0, 0];
  const pts: V2[] = [];
  if (legL) {
    pts.push([xl, yb]);
    if (cl[0] > 0) pts.push(...arc(xl + cl[0], y - cl[1], cl[0], cl[1], Math.PI, Math.PI / 2));
    else pts.push([xl, y]);
  } else pts.push([-w / 2, y]);
  if (cr[0] > 0) pts.push(...arc(xr - cr[0], y - cr[1], cr[0], cr[1], Math.PI / 2, 0));
  else pts.push([xr, y]);
  pts.push([xr, yb]);
  return pts;
}

/** A band `t` wide hugging the opening (timber lining), as one outline through the frame depth. */
function liningBand(g: Geo, t: number, z: V2): Part {
  const inner = openingEdge(g, 0);
  const outer = openingEdge(g, t).reverse();
  return panelXY('shelf', dedupe([...inner, ...outer]), z[0], z[1] - z[0]);
}

/** A leg x0..x1 (y0..y1) with an open, lit shelf niche on its front face. */
function nicheLeg(x0: number, x1: number, y0: number, y1: number, d: number): Part[] {
  const t = Math.min(0.04, (x1 - x0) * 0.15);
  const zb = -d / 2 + Math.max(0.05, d * 0.25);
  const nb = y0 + (y0 < 0.01 ? 0.1 : 0.04);
  const nt = y1 - 0.06;
  const xi: V2 = [x0 + t, x1 - t];
  const parts: Part[] = [
    span('frame', [x0, x1], [y0, y1], [-d / 2, zb]),
    span('frame', [x0, x0 + t], [y0, y1], [zb, d / 2]),
    span('frame', [x1 - t, x1], [y0, y1], [zb, d / 2]),
    span('frame', xi, [y0, nb], [zb, d / 2], o),
    span('frame', xi, [nt, y1], [zb, d / 2], o),
  ];
  if (nt - nb < 0.15) return parts;
  parts.push(
    span('shelf', xi, [nb, nt], [zb, zb + 0.012], o),
    span('glow', [xi[0] + 0.01, xi[1] - 0.01], [nt - 0.006, nt], [d / 2 - 0.06, d / 2 - 0.045], o),
  );
  const n = clamp(Math.round((nt - nb) / 0.38) - 1, 0, 5);
  for (const sy of spaced(n + 2, nb, nt).slice(1, -1)) {
    parts.push(
      span('shelf', xi, [sy - 0.012, sy + 0.012], [zb + 0.012, d / 2 - 0.02], o),
      span('glow', [xi[0] + 0.01, xi[1] - 0.01], [sy - 0.018, sy - 0.012], [d / 2 - 0.06, d / 2 - 0.045], o),
    );
  }
  return parts;
}

function buildPortal(size: Size3, s: PortalSpec): Part[] {
  const g = portalGeo(size, s);
  const { w, d, h } = g;
  const parts: Part[] = [];
  // Layers through the depth.
  if (s.cove) {
    const rv = Math.min(0.03, d * 0.15);
    const gap = 0.05;
    parts.push(
      ...frameLayer(g, [d / 2 - rv, d / 2], 0, h - gap, { ...s, niche: undefined }),
      ...frameLayer(g, [-d / 2 + rv, d / 2 - rv], 0, h, s),
      ...frameLayer(g, [-d / 2, -d / 2 + rv], 0, h - gap, { ...s, niche: undefined }),
      // The strip lines the back of each reveal, so it reads as a lit line at the ceiling.
      span('glow', [-w / 2, w / 2], [h - gap + 0.004, h - 0.004], [d / 2 - rv + 0.001, d / 2 - rv + 0.006], o),
      span('glow', [-w / 2, w / 2], [h - gap + 0.004, h - 0.004], [-d / 2 + rv - 0.006, -d / 2 + rv - 0.001], o),
    );
  } else if (s.step) {
    const ds = Math.min(d * 0.3, 0.08);
    const st = Math.min(s.step, s.leg * 0.4);
    parts.push(
      ...frameLayer(g, [d / 2 - ds, d / 2], st, h, s),
      ...frameLayer(g, [-d / 2 + ds, d / 2 - ds], 0, h, s),
      ...frameLayer(g, [-d / 2, -d / 2 + ds], st, h, s),
    );
  } else if (s.lining) {
    // Plaster frame set back from the opening by the lining; the timber band fills the gap.
    const t = Math.min(s.lining, s.leg * 0.4);
    // The band sits 1 mm inside the faces so the two finishes never share a face plane.
    parts.push(...frameLayer(g, [-d / 2, d / 2], t, h, s), liningBand(g, t, [-d / 2 + 0.001, d / 2 - 0.001]));
  } else parts.push(...frameLayer(g, [-d / 2, d / 2], 0, h, s));

  // Niche legs (on the core layer's place).
  const ysR = g.yi - g.cr[1];
  const ysL = g.yi - g.cl[1];
  const zc: number = s.cove ? Math.min(0.03, d * 0.15) : 0;
  const dz = d - 2 * zc;
  const shiftZ = (ps: Part[]) => ps; // the core layer is centred, so no shift is needed
  if (s.niche === 'right' || s.niche === 'both') parts.push(...shiftZ(nicheLeg(g.xr, w / 2, g.yb, ysR, dz)));
  if (s.niche === 'both' && g.legL) parts.push(...shiftZ(nicheLeg(-w / 2, g.xl, g.yb, ysL, dz)));

  // Desk nook: closed leg below the desk, the desk cantilevered into the opening.
  if (s.desk !== undefined) {
    const H = s.desk;
    const L = clamp((g.xr - g.xl) * 0.6, 0.5, 1.5);
    const x0 = g.xr - L;
    const r = Math.min(d / 2 - 0.01, 0.25);
    parts.push(
      span('frame', [g.xr, w / 2], [0, H], [-d / 2, d / 2]),
      prism('shelf', roundEnd(x0, g.xr, -d / 2, d / 2, r), H - 0.035, 0.035),
      span('shelf', [x0 + r, g.xr], [H - 0.15, H - 0.035], [-d / 2 + 0.03, d / 2 - 0.03], o),
    );
    // A solid half-round timber end under the desk's free end, set in 1 cm from the top's edge.
    parts.push(prism('shelf', roundEnd(x0 + 0.01, x0 + 0.01 + r, -d / 2 + 0.01, d / 2 - 0.01, r - 0.01), 0, H - 0.036));
  }

  // Half wall under the right leg with a timber cap and a rounded end.
  if (s.halfWall !== undefined) {
    const H = s.halfWall - 0.04;
    const L = clamp((g.xr - g.xl) * 0.55, 0.5, 1.6);
    const x0 = g.xr - L;
    const r = Math.min(d / 2 - 0.01, 0.3);
    parts.push(
      prism('frame', roundEnd(x0 + 0.02, w / 2, -d / 2 + 0.02, d / 2 - 0.02, r - 0.02), 0, H),
      prism('shelf', roundEnd(x0, w / 2, -d / 2, d / 2, r), H, 0.04),
    );
  }

  // Recessed downlights along the soffit underside.
  if (s.downlights) {
    const x0 = g.xl + g.cl[0] + 0.15;
    const x1 = g.xr - g.cr[0] - 0.15;
    if (x1 - x0 > 0.2) {
      for (const x of cells(clamp(Math.round((x1 - x0) / 0.7), 1, 8), x0, x1)) {
        parts.push(ring('trim', [x, g.yi - 0.003, 0], 0.042, 0.006, o), cyl('glow', [x, g.yi - 0.002, 0], 0.036, 0.008, o));
      }
    }
  }
  return parts;
}

/** Plan: the soffit's edges across the opening (it is overhead, so only its outline is drawn). */
function portalPlan(size: Size3, s: PortalSpec) {
  const g = portalGeo(size, s);
  const { d } = size;
  return [line([g.xl, -d / 2], [g.xr, -d / 2]), line([g.xl, d / 2], [g.xr, d / 2])];
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

const FRAME = matSlot('frame', 'Frame', 'paint-warm-white');
const GLOW = matSlot('glow', 'LED strip', 'light-warm');
const SHELF = matSlot('shelf', 'Shelves & timber', 'wood-oak-light');
const RIMS = matSlot('trim', 'Downlight rims', 'metal-white-powder');

const PAINT_VARIANTS = [
  { id: 'limewash', name: 'Warm limewash', materials: { frame: 'limewash-warm' } },
  { id: 'greige', name: 'Greige', materials: { frame: 'paint-greige' } },
  { id: 'sage', name: 'Sage', materials: { frame: 'paint-sage' } },
  { id: 'terracotta', name: 'Terracotta limewash', materials: { frame: 'limewash-terracotta' } },
  { id: 'venetian', name: 'Venetian plaster', materials: { frame: 'venetian-white' } },
];

const TAGS = ['portal', 'portal frame', 'arch', 'archway', 'rounded arch', 'bulkhead', 'soffit', 'khung vòm', 'cổng vòm', 'trần thạch cao', 'zoning'];

interface ItemCfg {
  id: string;
  name: string;
  description: string;
  tags: string[];
  spec: PortalSpec;
  size: Size3;
  min?: Partial<Size3>;
  max?: Partial<Size3>;
  slots?: ReturnType<typeof matSlot>[];
  variants?: { id: string; name: string; materials: Record<string, string> }[];
  ceiling?: boolean;
}

function portal(c: ItemCfg) {
  const min: Size3 = { w: 1.0, d: 0.1, h: 2.1, ...c.min };
  const max: Size3 = { w: 6.0, d: 0.8, h: 3.6, ...c.max };
  return defineItem({
    id: c.id,
    name: c.name,
    category: 'construction',
    type: 'structure',
    group: 'Portals & arches',
    tags: [...c.tags, ...TAGS],
    description: c.description,
    defaultSize: c.size,
    minSize: min,
    maxSize: max,
    ...(c.ceiling ? { mount: 'ceiling' as const, defaultElevation: CEILING - c.size.h } : {}),
    slots: c.slots ?? [FRAME],
    variants: c.variants ?? PAINT_VARIANTS,
    build: (size) => buildPortal(size, c.spec),
    planDetail: (size) => portalPlan(size, c.spec),
  });
}

const rounded = portal({
  id: 'rounded-portal',
  name: 'Rounded portal frame',
  description:
    'A plasterboard portal that frames a zone without closing it: a soffit dropping from the ceiling that curves down into a leg on each side, with generously rounded inner corners.',
  tags: ['kitchen entrance', 'open plan'],
  spec: { legs: 'both', leg: 0.2, head: 0.35, rL: 0.35, rR: 0.35 },
  size: { w: 2.4, d: 0.3, h: CEILING },
});

const softSquare = portal({
  id: 'soft-square-portal',
  name: 'Soft-square portal frame',
  description: 'A slim, crisp portal with a shallow soffit and tight 10 cm corner radii: modern and quiet, almost a square opening with softened corners.',
  tags: ['minimal', 'square'],
  spec: { legs: 'both', leg: 0.15, head: 0.3, rL: 0.1, rR: 0.1 },
  size: { w: 2.2, d: 0.25, h: CEILING },
});

const roundTop = portal({
  id: 'round-top-portal',
  name: 'Round-top portal frame',
  description: 'An open archway frame whose head is a full semicircle springing from two straight legs; wider frames keep a round crown and turn into a rounded-corner portal.',
  tags: ['semicircle', 'round arch', 'doorway'],
  spec: { legs: 'both', leg: 0.2, head: 0.2, shape: 'semicircle' },
  size: { w: 1.6, d: 0.3, h: CEILING },
});

const basket = portal({
  id: 'basket-arch-portal',
  name: 'Basket-arch portal frame',
  description: 'A wide, flattened elliptical arch across the full span: the soft curve suits living-to-dining openings where a round head would be too tall.',
  tags: ['elliptical arch', 'basket arch', 'flat arch', 'wide opening'],
  spec: { legs: 'both', leg: 0.2, head: 0.3, shape: 'ellipse', flat: 0.3 },
  size: { w: 3.0, d: 0.3, h: CEILING },
});

const lPortal = portal({
  id: 'l-portal',
  name: 'L-shaped portal frame',
  description: 'A soffit that runs from a wall and curves down into a single rounded leg: frames a bed recess, study corner or kitchen run. Mirror it for a leg on the left.',
  tags: ['one leg', 'L-shaped', 'bed recess', 'alcove'],
  spec: { legs: 'right', leg: 0.22, head: 0.4, rR: 0.45 },
  size: { w: 2.0, d: 0.3, h: CEILING },
});

const asymmetric = portal({
  id: 'asymmetric-portal',
  name: 'Asymmetric portal frame',
  description: 'A portal with one big sweeping curve on the right and a crisp, square corner on the left: a playful frame that leads the eye into the room.',
  tags: ['asymmetric', 'sweep', 'curved'],
  spec: { legs: 'both', leg: 0.2, head: 0.35, rL: 0.04, rR: 0.75 },
  size: { w: 2.4, d: 0.3, h: CEILING },
});

const stepped = portal({
  id: 'stepped-portal',
  name: 'Stepped double portal frame',
  description: 'A rounded portal in two layers: the faces step back 6 cm from the inner frame on both sides, giving the opening a deep, sculpted reveal.',
  tags: ['double frame', 'layered', 'stepped', 'reveal'],
  spec: { legs: 'both', leg: 0.24, head: 0.38, rL: 0.4, rR: 0.4, step: 0.06 },
  size: { w: 2.4, d: 0.4, h: CEILING },
  min: { d: 0.2 },
});

const cove = portal({
  id: 'led-cove-portal',
  name: 'Rounded portal with LED cove',
  description: 'A deep rounded portal with a shadow-gap reveal at the ceiling line on both faces, each hiding a warm LED strip that washes light along the frame.',
  tags: ['LED cove', 'shadow gap', 'hidden light', 'đèn hắt'],
  spec: { legs: 'both', leg: 0.22, head: 0.42, rL: 0.4, rR: 0.4, cove: true },
  size: { w: 2.6, d: 0.35, h: CEILING },
  min: { d: 0.15 },
  slots: [FRAME, GLOW],
  variants: [...PAINT_VARIANTS, { id: 'cool', name: 'Cool white LED', materials: { glow: 'light-cool' } }],
});

const kitchen = portal({
  id: 'kitchen-portal',
  name: 'Deep kitchen portal with downlights',
  description: 'A deep rounded portal around a kitchen run or fridge wall, its soffit as deep as the cabinets below and fitted with a row of recessed LED downlights.',
  tags: ['kitchen', 'fridge alcove', 'downlights', 'cabinet soffit'],
  spec: { legs: 'both', leg: 0.18, head: 0.4, rL: 0.3, rR: 0.3, downlights: true },
  size: { w: 3.0, d: 0.6, h: CEILING },
  min: { d: 0.3 },
  slots: [FRAME, GLOW, RIMS],
  variants: [...PAINT_VARIANTS, { id: 'black-rims', name: 'Black downlights', materials: { trim: 'metal-black-matte' } }],
});

const niches = portal({
  id: 'niche-portal',
  name: 'Portal with lit shelf niches',
  description: 'A rounded portal whose wide legs hold open display niches on the front, lined in oak with floating shelves and a warm LED strip under each shelf.',
  tags: ['niche', 'display shelves', 'built-in shelves', 'lit shelves', 'hốc tường'],
  spec: { legs: 'both', leg: 0.42, head: 0.35, rL: 0.35, rR: 0.35, niche: 'both' },
  size: { w: 2.8, d: 0.35, h: CEILING },
  min: { w: 1.6, d: 0.25 },
  slots: [FRAME, SHELF, GLOW],
  variants: [...PAINT_VARIANTS, { id: 'walnut', name: 'Walnut niches', materials: { shelf: 'wood-walnut' } }],
});

const deskNook = portal({
  id: 'desk-nook-portal',
  name: 'Desk nook portal with lit shelves',
  description:
    'A soffit from the wall curving into one wide leg with lit oak shelves above a built-in desk; the desk runs into the opening and ends in a rounded, supported end. Mirror it for the other hand.',
  tags: ['desk nook', 'study corner', 'built-in desk', 'bed and desk', 'góc làm việc'],
  spec: { legs: 'right', leg: 0.42, head: 0.4, rR: 0.5, niche: 'right', desk: 0.75, clear: 1.7 },
  size: { w: 2.2, d: 0.55, h: CEILING },
  min: { w: 1.6, d: 0.4, h: 2.3 },
  slots: [FRAME, SHELF, GLOW],
  variants: [...PAINT_VARIANTS, { id: 'walnut', name: 'Walnut desk & shelves', materials: { shelf: 'wood-walnut' } }],
});

const halfWall = portal({
  id: 'half-wall-portal',
  name: 'Portal on a half wall with LED cove',
  description:
    'A soffit from the wall that curves down onto a capped half wall reaching into the opening with a rounded end, lit along the ceiling line: frames a study platform or reading corner.',
  tags: ['half wall', 'study platform', 'reading corner', 'LED cove', 'tường lửng'],
  spec: { legs: 'right', leg: 0.3, head: 0.42, rR: 0.55, halfWall: 1.0, cove: true, clear: 1.2 },
  size: { w: 2.6, d: 0.35, h: CEILING },
  min: { w: 1.6, d: 0.2, h: 2.3 },
  slots: [FRAME, SHELF, GLOW],
  variants: [...PAINT_VARIANTS, { id: 'walnut', name: 'Walnut cap', materials: { shelf: 'wood-walnut' } }],
});

const oakLined = portal({
  id: 'oak-lined-portal',
  name: 'Rounded portal with oak lining',
  description:
    'A rounded plaster portal whose opening is lined in solid oak right through its depth, so a warm timber band traces the curve on both faces: frames a tea platform, reading corner or bedroom.',
  tags: ['oak lining', 'timber frame', 'tea room', 'japandi', 'khung gỗ'],
  spec: { legs: 'both', leg: 0.2, head: 0.4, rL: 0.4, rR: 0.4, lining: 0.06 },
  size: { w: 2.6, d: 0.3, h: CEILING },
  slots: [FRAME, SHELF],
  variants: [
    { id: 'walnut', name: 'Walnut lining', materials: { shelf: 'wood-walnut' } },
    { id: 'white-oak', name: 'White oak & limewash', materials: { shelf: 'wood-white-oak', frame: 'limewash-warm' } },
    { id: 'sage', name: 'Oak & sage', materials: { frame: 'paint-sage' } },
  ],
});

const oakLinedL = portal({
  id: 'oak-lined-l-portal',
  name: 'L-shaped portal with oak lining',
  description: 'A soffit running from a wall and curving down into one leg, the whole opening lined in oak: the frame around a raised tea platform or study corner. Mirror it for a leg on the left.',
  tags: ['oak lining', 'timber frame', 'one leg', 'tea platform', 'khung gỗ'],
  spec: { legs: 'right', leg: 0.22, head: 0.42, rR: 0.5, lining: 0.06 },
  size: { w: 2.4, d: 0.3, h: CEILING },
  slots: [FRAME, SHELF],
  variants: [
    { id: 'walnut', name: 'Walnut lining', materials: { shelf: 'wood-walnut' } },
    { id: 'white-oak', name: 'White oak & limewash', materials: { shelf: 'wood-white-oak', frame: 'limewash-warm' } },
  ],
});

const header = portal({
  id: 'rounded-header',
  name: 'Rounded ceiling header',
  description: 'A ceiling-hung soffit band whose ends curve down in short rounded returns: marks out a zone overhead between two walls without any legs on the floor.',
  tags: ['header', 'ceiling band', 'dropped ceiling', 'trần giật cấp'],
  spec: { legs: 'both', leg: 0.15, head: 0.22, rL: 0.35, rR: 0.35, clear: 0.05 },
  size: { w: 3.0, d: 0.3, h: 0.6 },
  min: { w: 1.0, d: 0.1, h: 0.3 },
  max: { w: 8.0, d: 0.8, h: 1.2 },
  ceiling: true,
});

const headerCove = portal({
  id: 'rounded-header-led',
  name: 'Rounded ceiling header with LED cove',
  description: 'The rounded ceiling header with a shadow-gap reveal at the ceiling line on both faces and a hidden warm LED strip in each.',
  tags: ['header', 'LED cove', 'shadow gap', 'đèn hắt'],
  spec: { legs: 'both', leg: 0.15, head: 0.25, rL: 0.35, rR: 0.35, clear: 0.05, cove: true },
  size: { w: 3.0, d: 0.35, h: 0.6 },
  min: { w: 1.0, d: 0.15, h: 0.3 },
  max: { w: 8.0, d: 0.8, h: 1.2 },
  ceiling: true,
  slots: [FRAME, GLOW],
  variants: [...PAINT_VARIANTS, { id: 'cool', name: 'Cool white LED', materials: { glow: 'light-cool' } }],
});

export default definePack({
  name: 'Portal frames',
  version: '1.0.0',
  author: 'Neest team',
  description:
    'Rounded drywall portals that frame a zone: round-cornered, soft-square, round-top and basket-arch portals, L-shaped and asymmetric frames, a stepped double frame, oak-lined portals, LED-cove and kitchen downlight portals, legs with lit shelf niches, a desk nook, a half-wall portal and rounded ceiling headers. All resize freely; the curves are rebuilt for every size.',
  license: 'CC0 (made for Neest)',
  items: [rounded, softSquare, roundTop, basket, lPortal, asymmetric, stepped, oakLined, oakLinedL, cove, kitchen, niches, deskNook, halfWall, header, headerCove],
});

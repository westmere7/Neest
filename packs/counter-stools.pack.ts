/**
 * Upholstered counter and bar stools in a modern-organic style: a soft shell or scoop back that wraps
 * around the sitter and runs seamlessly into a thick padded seat, on four slender, slightly splayed and
 * tapered solid-wood legs with a thin timber seat rail and a square ring of round footrest stretchers.
 *
 * One parametric builder (`buildStool`) makes every item from a small config: the seat (round, soft
 * square or saddle), the back (an arc or a soft square "U", flat, sloping to low arms or winged; plain,
 * channel-tufted, buttoned, oak-rimmed, veneer shell with a pad, cane panel or open slats), and the base
 * (four timber legs, a swivel on a timber base, or a round pedestal with a footring).
 *
 * Local space: origin at the centre of the footprint on the floor, +z is the front. The back keeps its
 * height above the seat when the item is resized, so changing the height moves the seat between
 * counter (~0.65 m) and bar (~0.75 m) height.
 */
import {
  clamp,
  cushion,
  cyl,
  defineItem,
  definePack,
  lathe,
  lerp,
  matSlot,
  range,
  ring,
  rod,
  rodPath,
  rodX,
  roundRectPoints,
  span,
  sphere,
  vcyl,
  type MaterialSlot,
  type Part,
  type Size3,
  type V2,
  type V3,
} from '@/packs/kit';

// ── Shared helpers ───────────────────────────────────────────────────────────

const O = { plan: false } as const;
const GROUP = 'Stools & benches';
const DEG = Math.PI / 180;

/** Point a fraction `t` of the way from a to b. */
const along = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** Box turned about the vertical axis by `ry` (hidden from the plan unless `plan`). */
function box3(slot: string, c: V3, s: V3, ry: number, bevel = 0, plan = false): Part {
  return {
    shape: 'box',
    size: [s[0], s[1], s[2]],
    ...(bevel > 0 ? { bevel: Math.min(bevel, 0.45 * Math.min(...s)) } : {}),
    position: [c[0], c[1], c[2]],
    ...(ry !== 0 ? { rotation: [0, ry, 0] as V3 } : {}),
    slot,
    ...(plan ? {} : { plan: false }),
  };
}

/** Square-section member from a to b (a box version of `rod`), hidden from the plan. */
function stick(slot: string, a: V3, b: V3, tx: number, tz = tx): Part {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz) || 0.002;
  const rot: V3 = [Math.atan2(dz / len, dy / len), 0, Math.atan2(-dx / len, Math.hypot(dy, dz) / len)];
  return {
    shape: 'box',
    size: [tx, len, tz],
    bevel: 0.003,
    position: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2],
    rotation: rot,
    slot,
    plan: false,
  };
}

/** `n` equal steps along a polyline (by arc length), n + 1 points. */
function resample(pts: V2[], n: number): V2[] {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = cum[cum.length - 1];
  let j = 0;
  return range(n + 1).map((k) => {
    const t = (L * k) / n;
    while (j < pts.length - 2 && cum[j + 1] < t) j++;
    const f = clamp((t - cum[j]) / (cum[j + 1] - cum[j] || 1), 0, 1);
    return [lerp(pts[j][0], pts[j + 1][0], f), lerp(pts[j][1], pts[j + 1][1], f)] as V2;
  });
}

const pathLength = (pts: V2[]) => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);

/**
 * Soft square "U" centreline seen from above: from the left front end back along the side, round the
 * corner, across the back and forward again on the right.
 */
function squarePath(cx: number, zBack: number, zEnd: number, rc: number): V2[] {
  const r = Math.min(rc, cx * 0.9);
  const ze = Math.max(zEnd, zBack + r);
  const pts: V2[] = [];
  if (ze > zBack + r + 0.002) pts.push([-cx, ze]);
  for (const i of range(5)) {
    const a = Math.PI + (i / 4) * (Math.PI / 2);
    pts.push([-cx + r + r * Math.cos(a), zBack + r + r * Math.sin(a)]);
  }
  for (const i of range(5)) {
    const a = 1.5 * Math.PI + (i / 4) * (Math.PI / 2);
    pts.push([cx - r + r * Math.cos(a), zBack + r + r * Math.sin(a)]);
  }
  if (ze > zBack + r + 0.002) pts.push([cx, ze]);
  return pts.filter((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 1e-4);
}

/** Thick round seat cushion with a rolled edge and a slight crown, its underside at y0. */
function roundSeat(slot: string, y0: number, R: number, ct: number): Part {
  const e = Math.min(0.028, ct * 0.38);
  const k = 0.29;
  const top = ct - 0.008;
  const prof: V2[] = [
    [0, 0],
    [R - e, 0],
    [R - e * k, e * k],
    [R, e],
    [R, top - e],
    [R - e * k, top - e * k],
    [R - e, top],
    [R * 0.55, ct - 0.002],
    [0, ct],
  ];
  return lathe(slot, [0, y0, 0], prof, { segments: 44 });
}

// ── Configuration ────────────────────────────────────────────────────────────

type Profile = 'flat' | 'slope' | 'wing';
type BackStyle = 'plain' | 'channel' | 'buttons' | 'woodRim' | 'woodShell' | 'cane' | 'slats';

interface BackCfg {
  /** 'arc': a curved shell round a round seat; 'square': a soft "U" round a square seat. */
  path: 'arc' | 'square';
  /** Arc: half the wrap angle in degrees, measured from the back centre (90 = half-moon). */
  wrap?: number;
  /** Square: how far the sides return forward, as a fraction of the seat depth. */
  ret?: number;
  /** Square: corner radius of the U (m). */
  corner?: number;
  /** Top of the back above the seat top, at the back centre (m). */
  rise: number;
  /** Height above the seat at the front ends (defaults to `rise`). */
  end?: number;
  profile?: Profile;
  /** Thickness of the shell (m). */
  t?: number;
  style?: BackStyle;
}

interface StoolCfg {
  seat: 'round' | 'square' | 'saddle';
  /** Seat cushion thickness (m). */
  seatT?: number;
  back?: BackCfg;
  base?: 'legs' | 'swivel' | 'pedestal';
  legs?: 'round' | 'square';
  /** Leg radius at the foot and at the top. */
  legR?: V2;
  /** Footrest stretchers: all four level, sides raised, or a ring plus raised side rails. */
  rails?: 'ring' | 'stagger' | 'double';
  /** Brass/steel kick plate on the front footrest ('metal' slot). */
  kick?: boolean;
  /** Contrast piping round the seat top edge ('accent' slot). */
  piping?: boolean;
}

// ── Back ─────────────────────────────────────────────────────────────────────

function backParts(b: BackCfg, yS: number, yA: number, hx: number, hz: number, Ro: number): Part[] {
  const parts: Part[] = [];
  const style = b.style ?? 'plain';
  const t = b.t ?? (style === 'cane' || style === 'slats' ? 0.03 : 0.06);
  const end = b.end ?? b.rise;
  const profile = b.profile ?? (end === b.rise ? 'flat' : 'slope');
  const shape = (u: number) => {
    if (profile === 'flat') return 1;
    if (profile === 'slope') return Math.cos((u * Math.PI) / 2);
    return u < 0.65 ? 1 : Math.cos(((u - 0.65) / 0.35) * (Math.PI / 2));
  };
  /** Top of the back at path position s (0 = left end, 0.5 = back centre, 1 = right end). */
  const top = (s: number) => yS + end + (b.rise - end) * shape(Math.abs(2 * s - 1));
  const y0 = yA;

  // Centreline of the back, from the left front end round the back to the right front end.
  let pts: V2[];
  let A = 0;
  let Rb = 0;
  if (b.path === 'arc') {
    A = (b.wrap ?? 110) * DEG;
    Rb = Ro - t / 2;
    const n = clamp(Math.round((2 * A * Rb) / 0.035), 10, 20);
    pts = range(n + 1).map((k) => {
      const phi = -Math.PI / 2 - A + (2 * A * k) / n;
      return [Rb * Math.cos(phi), Rb * Math.sin(phi)] as V2;
    });
  } else {
    const cx = hx + 0.006 - t / 2;
    const zBack = -(hz + 0.006 - t / 2);
    const raw = squarePath(cx, zBack, zBack + (b.ret ?? 0.3) * 2 * hz, b.corner ?? 0.07);
    pts = resample(raw, clamp(Math.round(pathLength(raw) / 0.04), 10, 20));
  }
  const n = pts.length - 1;
  const sAt = (k: number) => k / n;
  const segs = range(n).map((i) => {
    const p = pts[i];
    const q = pts[i + 1];
    const ang = Math.atan2(q[1] - p[1], q[0] - p[0]);
    return {
      mid: [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2] as V2,
      len: Math.hypot(q[0] - p[0], q[1] - p[1]),
      ry: -ang,
      /** Inward normal (towards the seat). */
      nrm: [-Math.sin(ang), Math.cos(ang)] as V2,
      s: (i + 0.5) / n,
    };
  });
  const ends = [pts[0], pts[n]];
  /**
   * A rolled edge (tube) along the top of the back, centre at top − r: rods with ball joints. (A torus
   * arc would be smoother, but its rotated bounds are checked as a full turned square and overshoot.)
   */
  const roll = (slot: string, r: number) => {
    const p3 = pts.map((p, k) => [p[0], top(sAt(k)) - r, p[1]] as V3);
    parts.push(...rodPath(slot, p3, r));
    for (const p of p3) parts.push(sphere(slot, p, r, O));
  };

  if (style === 'plain' || style === 'buttons' || style === 'woodRim') {
    const rim = style === 'woodRim';
    const rr = rim ? t / 2 + 0.003 : t / 2;
    for (const g of segs) {
      const y1 = top(g.s) - rr;
      parts.push(box3('uph', [g.mid[0], (y0 + y1) / 2, g.mid[1]], [g.len + 0.006, y1 - y0, t], g.ry, 0.003, true));
    }
    roll(rim ? 'wood' : 'uph', rr);
    // Rounded front ends of the shell (a timber edge on the rimmed back).
    for (const [k, e] of [[0, ends[0]], [n, ends[1]]] as [number, V2][]) {
      parts.push(vcyl(rim ? 'wood' : 'uph', e[0], e[1], y0 + (rim ? 0.003 : 0), top(sAt(k)) - rr, rr, O));
    }
    if (style === 'buttons') {
      for (const [i, g] of segs.entries()) {
        if (i % 2 === 0 || i === n - 1) continue;
        const hTop = top(g.s) - rr - yS;
        for (const f of [0.38, 0.75]) {
          const y = yS + hTop * f;
          if (y < yS + 0.05) continue;
          parts.push({
            shape: 'sphere',
            radius: 0.5,
            position: [g.mid[0] + g.nrm[0] * (t / 2 - 0.002), y, g.mid[1] + g.nrm[1] * (t / 2 - 0.002)],
            scale: [0.022, 0.022, 0.012],
            rotation: [0, g.ry, 0],
            slot: 'uph',
            plan: false,
          });
        }
      }
    }
  } else if (style === 'channel') {
    // Plump vertical channels with a thin backing panel behind the seams.
    for (const g of segs) {
      const y1 = top(g.s);
      const wc = g.len * 0.9;
      parts.push(box3('uph', [g.mid[0], (y0 + y1) / 2, g.mid[1]], [wc, y1 - y0, t], g.ry, Math.min(wc, t) * 0.45, true));
      const off = -t * 0.28;
      const yb = y1 - 0.03;
      parts.push(box3('uph', [g.mid[0] + g.nrm[0] * off, (y0 + yb) / 2, g.mid[1] + g.nrm[1] * off], [g.len + 0.004, yb - y0, t * 0.45], g.ry, 0.006));
    }
  } else if (style === 'woodShell') {
    // A thin timber shell outside, an upholstered pad inside it.
    for (const g of segs) {
      const y1 = top(g.s);
      const ow = -(t / 2 - 0.007);
      parts.push(box3('wood', [g.mid[0] + g.nrm[0] * ow, (y0 + y1) / 2, g.mid[1] + g.nrm[1] * ow], [g.len + 0.004, y1 - y0, 0.014], g.ry, 0.005, true));
      const pw = 0.006;
      const yp = y1 - 0.014;
      parts.push(box3('uph', [g.mid[0] + g.nrm[0] * pw, (y0 + 0.002 + yp) / 2, g.mid[1] + g.nrm[1] * pw], [g.len + 0.004, yp - y0 - 0.002, t - 0.012], g.ry, 0.012));
    }
  } else if (style === 'cane') {
    // A cane panel in a timber frame: top rail, end posts and a low rail just above the seat.
    const rTop = 0.016;
    for (const g of segs) {
      const y1 = top(g.s) - rTop;
      const yb = yS - 0.012;
      parts.push(box3('accent', [g.mid[0], (yb + y1) / 2, g.mid[1]], [g.len + 0.004, y1 - yb, 0.01], g.ry, 0, true));
    }
    roll('wood', rTop);
    const low = pts.map((p) => [p[0], yS + 0.012, p[1]] as V3);
    parts.push(...rodPath('wood', low, 0.011));
    for (const [k, e] of [[0, ends[0]], [n, ends[1]]] as [number, V2][]) {
      parts.push(vcyl('wood', e[0], e[1], yA - 0.014, top(sAt(k)) - rTop, 0.018, O));
    }
  } else {
    // Open slats: a curved top rail on two end posts with vertical slats between.
    const railH = 0.055;
    for (const g of segs) {
      const yt = top(g.s);
      parts.push(box3('wood', [g.mid[0], yt - railH / 2, g.mid[1]], [g.len + 0.004, railH, 0.026], g.ry, 0.006, true));
    }
    for (const k of range(n - 1)) {
      if (k % 2 === 1) continue;
      const i = k + 1;
      const p = pts[i];
      const ry = (segs[i - 1].ry + segs[i].ry) / 2;
      const yb = yS - 0.012;
      const yt = top(sAt(i)) - railH + 0.004;
      parts.push(box3('wood', [p[0], (yb + yt) / 2, p[1]], [0.034, yt - yb, 0.016], ry, 0.004));
    }
    for (const [k, e] of [[0, ends[0]], [n, ends[1]]] as [number, V2][]) {
      parts.push(vcyl('wood', e[0], e[1], yA - 0.014, top(sAt(k)) - 0.004, 0.017, O));
    }
  }
  return parts;
}

// ── Whole stool ──────────────────────────────────────────────────────────────

function buildStool(cfg: StoolCfg, { w, d, h }: Size3): Part[] {
  const parts: Part[] = [];
  const back = cfg.back;
  const rise = back?.rise ?? 0;
  const ct = cfg.seatT ?? 0.085;
  const yS = h - rise; // seat top
  const yA = yS - ct; // seat underside = top of the timber seat board
  const base = cfg.base ?? 'legs';
  const round = cfg.seat === 'round';
  const t = back?.t ?? (back?.style === 'cane' || back?.style === 'slats' ? 0.03 : 0.06);
  const Ro = Math.min(w, d) / 2 - 0.008;
  const Rs = back ? Ro - t / 2 : Math.min(w, d) / 2 - 0.028;
  const hx = cfg.seat === 'saddle' ? w / 2 - 0.04 : w / 2 - 0.035;
  const hz = cfg.seat === 'saddle' ? d / 2 - 0.06 : d / 2 - 0.035;

  // Seat cushion and the thin timber board under it.
  if (round) {
    parts.push(roundSeat('uph', yA, Rs, ct));
    parts.push(cyl('wood', [0, yA - 0.007, 0], Rs - 0.014, 0.014, { segments: 40, plan: false }));
    if (cfg.piping) {
      const e = Math.min(0.028, ct * 0.38);
      parts.push(ring('accent', [0, yA + ct - 0.008 - e * 0.29, 0], Rs - e * 0.29, 0.0045, O));
    }
  } else {
    if (cfg.seat === 'saddle') {
      // Padded saddle: a soft cushion with raised rolls front and back.
      const r = 0.028;
      parts.push(cushion('uph', [-hx, hx], [yA, yS - 0.014], [-hz, hz], { softness: 0.45 }));
      for (const s of [-1, 1]) {
        const z = s * (hz - r - 0.006);
        parts.push(rodX('uph', -hx + r + 0.01, hx - r - 0.01, yS - r, z, r, O));
        for (const sx of [-1, 1]) parts.push(sphere('uph', [sx * (hx - r - 0.01), yS - r, z], r, O));
      }
    } else {
      parts.push(cushion('uph', [-hx, hx], [yA, yS], [-hz, hz], { softness: 0.4 }));
    }
    parts.push(span('wood', [-hx + 0.014, hx - 0.014], [yA - 0.014, yA], [-hz + 0.014, hz - 0.014], { bevel: 0.004, plan: false }));
    if (cfg.piping) {
      const loop = roundRectPoints(0, 0, 2 * hx - 0.02, 2 * hz - 0.02, 0.05, 3);
      const y = yS - 0.016;
      parts.push(...rodPath('accent', [...loop, loop[0]].map((p) => [p[0], y, p[1]] as V3), 0.0045));
    }
  }

  if (back) parts.push(...backParts(back, yS, yA, hx, hz, Ro));

  // Footrest height: ~27 cm at counter height, ~33 cm at bar height.
  const yUnder = yA - 0.014;
  if (base === 'pedestal') {
    const Rp = Math.min(Math.min(w, d) / 2 - 0.02, 0.23);
    parts.push(lathe('metal', [0, 0, 0], [[0, 0], [Rp, 0], [Rp, 0.008], [Rp * 0.9, 0.018], [0.07, 0.034], [0, 0.036]], { segments: 44 }));
    parts.push(vcyl('metal', 0, 0, 0.036, yUnder - 0.016, 0.03, O));
    parts.push(cyl('metal', [0, yUnder - 0.008, 0], 0.1, 0.016, { segments: 32, plan: false }));
    const yF = clamp(0.27 + (yS - 0.65) * 0.6, 0.2, yUnder - 0.2);
    const Rf = Rp * 0.8;
    parts.push(ring('metal', [0, yF, 0], Rf, 0.01, O));
    parts.push(cyl('metal', [0, yF, 0], 0.042, 0.034, O));
    for (const k of range(4)) {
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      parts.push(rod('metal', [Math.cos(a) * 0.04, yF, Math.sin(a) * 0.04], [Math.cos(a) * Rf, yF, Math.sin(a) * Rf], 0.007, O));
    }
    return parts;
  }

  // Timber base: optional swivel plate, seat rails, four splayed tapered legs and footrests.
  const ax = round ? Rs * 0.7 : hx - 0.04;
  const az = round ? Rs * 0.7 : hz - 0.04;
  let yL = yUnder;
  if (base === 'swivel') {
    parts.push(cyl('metal', [0, yUnder - 0.008, 0], Math.min(0.1, ax - 0.01), 0.016, { segments: 32, plan: false }));
    yL = yUnder - 0.016;
    parts.push(span('wood', [-ax - 0.012, ax + 0.012], [yL - 0.016, yL], [-az - 0.012, az + 0.012], { bevel: 0.004, plan: false }));
    yL -= 0.016;
  }
  const ah = base === 'swivel' ? 0.04 : 0.05;
  const yR: V2 = [yL - ah, yL];
  for (const s of [-1, 1]) {
    parts.push(span('wood', [-ax, ax], yR, [s * az - 0.01, s * az + 0.01], { bevel: 0.003, plan: false }));
    parts.push(span('wood', [s * ax - 0.01, s * ax + 0.01], [yR[0] + 0.002, yR[1] - 0.002], [-az + 0.01, az - 0.01], { plan: false }));
  }
  const [rB, rT] = cfg.legR ?? [0.012, 0.0175];
  const inset = cfg.legs === 'square' ? 0.03 : 0.028;
  const foot = (sx: number, sz: number): V3 => [sx * (w / 2 - inset), 0, sz * (d / 2 - inset)];
  const top = (sx: number, sz: number): V3 => [sx * ax, yL, sz * az];
  const legAt = (sx: number, sz: number, y: number) => along(foot(sx, sz), top(sx, sz), y / yL);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      if (cfg.legs === 'square') parts.push(stick('wood', foot(sx, sz), top(sx, sz), 0.032));
      else parts.push(rod('wood', foot(sx, sz), top(sx, sz), rB, { rTop: rT, segments: 16, plan: false }));
    }
  }
  const yF = clamp(0.27 + (yS - 0.65) * 0.6, 0.18, yL - 0.18);
  const rails = cfg.rails ?? 'ring';
  const ySide = rails === 'stagger' ? yF + 0.07 : yF;
  parts.push(rod('wood', legAt(-1, 1, yF), legAt(1, 1, yF), 0.012, O));
  parts.push(rod('wood', legAt(-1, -1, yF), legAt(1, -1, yF), 0.0095, O));
  for (const sx of [-1, 1]) parts.push(rod('wood', legAt(sx, -1, ySide), legAt(sx, 1, ySide), 0.0095, O));
  if (rails === 'double') {
    const yU = lerp(yF, yL, 0.55);
    for (const sx of [-1, 1]) parts.push(rod('wood', legAt(sx, -1, yU), legAt(sx, 1, yU), 0.008, O));
  }
  if (cfg.kick) {
    const f = legAt(1, 1, yF);
    parts.push(rodX('metal', -f[0] * 0.62, f[0] * 0.62, yF, f[2], 0.0142, O));
  }
  return parts;
}

// ── Item factory ─────────────────────────────────────────────────────────────

const NAMES: Record<string, string> = {
  'fabric-boucle': 'Cream bouclé',
  'fabric-boucle-oat': 'Oat bouclé',
  'fabric-boucle-camel': 'Camel bouclé',
  'fabric-boucle-sage': 'Sage bouclé',
  'fabric-boucle-grey': 'Grey bouclé',
  'fabric-boucle-charcoal': 'Charcoal bouclé',
  'fabric-boucle-rust': 'Rust bouclé',
  'fabric-boucle-blush': 'Blush bouclé',
  'fabric-teddy-cream': 'Cream teddy',
  'fabric-linen': 'Natural linen',
  'fabric-linen-sage': 'Sage linen',
  'fabric-linen-rust': 'Rust linen',
  'fabric-linen-charcoal': 'Charcoal linen',
  'fabric-linen-indigo': 'Indigo linen',
  'fabric-herringbone-grey': 'Grey herringbone',
  'fabric-stone': 'Stone weave',
  'fabric-dove-grey': 'Dove grey',
  'fabric-hessian': 'Natural hessian',
  'fabric-corduroy-camel': 'Camel corduroy',
  'fabric-corduroy-olive': 'Olive corduroy',
  'fabric-velvet-rust': 'Rust velvet',
  'fabric-velvet-oat': 'Oat velvet',
  'fabric-velvet-sage': 'Sage velvet',
  'fabric-velvet-chocolate': 'Chocolate velvet',
  'leather-cognac': 'Cognac leather',
  'leather-tan': 'Tan leather',
  'leather-chocolate': 'Chocolate leather',
  'leather-black': 'Black leather',
  'leather-olive': 'Olive leather',
  'leather-grey': 'Grey leather',
  'wood-oak-light': 'Light oak',
  'wood-white-oak': 'White oak',
  'wood-walnut': 'Walnut',
  'wood-smoked-oak': 'Smoked oak',
  'wood-dark-stain': 'Dark-stained oak',
  'wood-ash-black': 'Black ash',
  'metal-brass': 'Brass',
  'metal-black-matte': 'Black',
  'metal-brushed-steel': 'Brushed steel',
};

const vid = (m: string) => m.replace(/^(fabric|leather|wood|metal)-/, '');

/** Hand-made variants: other covers, other leg finishes, then any extra combos. */
function variants(uph: string[], wood: string[] = [], extra: { id: string; name: string; materials: Record<string, string> }[] = []) {
  return [
    ...uph.map((m) => ({ id: vid(m), name: NAMES[m], materials: { uph: m } })),
    ...wood.map((m) => ({ id: `${vid(m)}-frame`, name: `${NAMES[m]} frame`, materials: { wood: m } })),
    ...extra,
  ];
}

interface StoolSpec {
  id: string;
  name: string;
  tags: string[];
  description: string;
  price: number;
  cfg: StoolCfg;
  /** Default seat height: ~0.65 counter, ~0.75 bar. */
  seat: number;
  w?: number;
  d?: number;
  uph: string;
  wood: string;
  metal?: string;
  accent?: string;
  variants?: ReturnType<typeof variants>;
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;

function stool(s: StoolSpec) {
  const { cfg } = s;
  const rise = cfg.back?.rise ?? 0;
  const bar = s.seat >= 0.72;
  const [lo, hi] = bar ? [0.7, 0.8] : [0.6, 0.72];
  const w = s.w ?? 0.5;
  const d = s.d ?? 0.52;
  const style = cfg.back?.style;
  const openBack = style === 'cane' || style === 'slats';
  const slots: MaterialSlot[] = [
    matSlot('uph', !cfg.back || openBack ? 'Seat cushion' : 'Upholstery', s.uph),
    matSlot(
      'wood',
      cfg.base === 'pedestal' ? 'Seat board' : style === 'woodRim' || style === 'woodShell' || openBack ? 'Legs, frame & back' : 'Legs & frame',
      s.wood,
    ),
  ];
  if (s.metal) {
    const label = cfg.base === 'pedestal' ? 'Pedestal & footring' : cfg.base === 'swivel' ? (cfg.kick ? 'Swivel & kick plate' : 'Swivel plate') : 'Kick plate';
    slots.push(matSlot('metal', label, s.metal));
  }
  if (s.accent) slots.push(matSlot('accent', style === 'cane' ? 'Cane back' : 'Piping', s.accent));
  return defineItem({
    id: s.id,
    name: s.name,
    category: 'kitchen',
    type: 'seating',
    group: GROUP,
    tags: s.tags,
    description: s.description,
    price: { vnd: s.price, estimate: true },
    defaultSize: { w, d, h: r3(s.seat + rise) },
    minSize: { w: r3(w - 0.06), d: r3(d - 0.06), h: r3(lo + rise) },
    maxSize: { w: r3(w + 0.06), d: r3(d + 0.06), h: r3(hi + rise) },
    slots,
    ...(s.variants?.length ? { variants: s.variants } : {}),
    build: (size) => buildStool(cfg, size),
  });
}

const COUNTER = ['counter stool', 'ghế quầy bar', 'ghế bar', 'kitchen island'];
const BAR = ['bar stool', 'ghế bar', 'ghế quầy bar', 'bar counter'];
const ROUND: StoolCfg['seat'] = 'round';

// ── Shell and scoop backs on four oak/walnut legs ────────────────────────────

const items = [
  stool({
    id: 'boucle-barrel-counter-stool-oak',
    name: 'Bouclé barrel counter stool, oak legs',
    tags: [...COUNTER, 'bouclé', 'barrel back', 'upholstered', 'oak', 'modern organic', 'ghế bọc vải bouclé'],
    description: 'A cream bouclé counter stool whose barrel back wraps round the sitter and flows into a thick round seat, on four tapered light-oak legs with a timber seat rail and a square footrest ring.',
    price: 3_600_000,
    cfg: { seat: ROUND, back: { path: 'arc', wrap: 125, rise: 0.28, t: 0.065 } },
    seat: 0.65,
    w: 0.5,
    d: 0.5,
    uph: 'fabric-boucle',
    wood: 'wood-oak-light',
    variants: variants(['fabric-boucle-oat', 'fabric-boucle-grey', 'fabric-boucle-sage'], ['wood-walnut']),
  }),
  stool({
    id: 'boucle-barrel-bar-stool-oak',
    name: 'Bouclé barrel bar stool, oak legs',
    tags: [...BAR, 'bouclé', 'barrel back', 'upholstered', 'oak', 'modern organic', 'tall stool'],
    description: 'The bar-height barrel stool: an oat bouclé shell wrapping a deep round seat, on splayed light-oak legs with a footrest ring and raised side rails.',
    price: 3_900_000,
    cfg: { seat: ROUND, back: { path: 'arc', wrap: 125, rise: 0.28, t: 0.065 }, rails: 'double' },
    seat: 0.75,
    w: 0.5,
    d: 0.5,
    uph: 'fabric-boucle-oat',
    wood: 'wood-oak-light',
    variants: variants(['fabric-boucle', 'fabric-boucle-camel', 'fabric-boucle-charcoal'], ['wood-walnut']),
  }),
  stool({
    id: 'linen-low-scoop-counter-stool-walnut',
    name: 'Low-scoop linen counter stool, walnut legs',
    tags: [...COUNTER, 'linen', 'scoop back', 'low back', 'walnut', 'upholstered', 'japandi'],
    description: 'A counter stool with a low scooped back that dips towards the sides, upholstered with the seat in textured natural linen, on tapered walnut legs with staggered footrests.',
    price: 3_200_000,
    cfg: { seat: ROUND, back: { path: 'arc', wrap: 80, rise: 0.24, end: 0.12 }, rails: 'stagger' },
    seat: 0.65,
    uph: 'fabric-linen',
    wood: 'wood-walnut',
    variants: variants(['fabric-linen-sage', 'fabric-linen-charcoal', 'fabric-linen-rust'], ['wood-oak-light']),
  }),
  stool({
    id: 'herringbone-shell-counter-stool-smoked-oak',
    name: 'Herringbone shell counter stool, smoked oak legs',
    tags: [...COUNTER, 'herringbone', 'wool', 'shell chair', 'smoked oak', 'upholstered', 'tweed'],
    description: 'A curved shell counter stool covered in grey herringbone wool, sloping gently from a tall centre to the sides, on mid-brown smoked-oak legs with a footrest ring.',
    price: 3_400_000,
    cfg: { seat: ROUND, back: { path: 'arc', wrap: 105, rise: 0.27, end: 0.16 } },
    seat: 0.65,
    uph: 'fabric-herringbone-grey',
    wood: 'wood-smoked-oak',
    variants: variants(['fabric-stone', 'fabric-boucle-oat'], ['wood-oak-light', 'wood-walnut']),
  }),
  stool({
    id: 'soft-square-back-linen-counter-stool',
    name: 'Soft square-back counter stool, oatmeal linen',
    tags: [...COUNTER, 'linen', 'square back', 'upholstered', 'white oak', 'soft modern', 'oatmeal'],
    description: 'A squarer counter stool: a padded U-shaped back with softly rounded corners and short side returns, wrapped into a thick square linen seat on white-oak legs.',
    price: 3_300_000,
    cfg: { seat: 'square', back: { path: 'square', ret: 0.35, corner: 0.07, rise: 0.3, end: 0.2 } },
    seat: 0.65,
    w: 0.48,
    d: 0.5,
    uph: 'fabric-linen',
    wood: 'wood-white-oak',
    variants: variants(['fabric-stone', 'fabric-linen-sage', 'fabric-boucle'], ['wood-smoked-oak']),
  }),
  stool({
    id: 'half-moon-sage-boucle-counter-stool',
    name: 'Half-moon back counter stool, sage bouclé',
    tags: [...COUNTER, 'half moon', 'bouclé', 'sage green', 'low back', 'oak', 'upholstered'],
    description: 'A low half-moon back curving exactly round the rear half of a deep round seat, all in sage bouclé, on splayed light-oak legs with front and back footrests set below the side rails.',
    price: 3_100_000,
    cfg: { seat: ROUND, back: { path: 'arc', wrap: 90, rise: 0.2 }, rails: 'stagger' },
    seat: 0.65,
    uph: 'fabric-boucle-sage',
    wood: 'wood-oak-light',
    variants: variants(['fabric-boucle', 'fabric-boucle-blush', 'fabric-boucle-grey'], ['wood-walnut']),
  }),
  stool({
    id: 'linen-half-moon-bar-stool-walnut',
    name: 'Half-moon back bar stool, rust linen',
    tags: [...BAR, 'half moon', 'linen', 'terracotta', 'walnut', 'low back', 'upholstered'],
    description: 'A bar stool with a low half-moon back and a thick round seat in rust linen, standing on tapered walnut legs with staggered footrests.',
    price: 3_300_000,
    cfg: { seat: ROUND, back: { path: 'arc', wrap: 90, rise: 0.22 }, rails: 'stagger' },
    seat: 0.75,
    uph: 'fabric-linen-rust',
    wood: 'wood-walnut',
    variants: variants(['fabric-linen', 'fabric-linen-sage'], ['wood-oak-light']),
  }),
  stool({
    id: 'wingback-boucle-bar-stool-walnut',
    name: 'Wingback bouclé bar stool, walnut legs',
    tags: [...BAR, 'wingback', 'bouclé', 'high back', 'walnut', 'upholstered', 'statement'],
    description: 'A tall-backed bar stool whose bouclé shell carries its full height round to side wings, then drops steeply to the seat front; walnut legs with a footrest ring and raised side rails.',
    price: 4_600_000,
    cfg: { seat: ROUND, back: { path: 'arc', wrap: 120, rise: 0.36, end: 0.14, profile: 'wing', t: 0.07 }, rails: 'double' },
    seat: 0.75,
    w: 0.52,
    d: 0.52,
    uph: 'fabric-boucle',
    wood: 'wood-walnut',
    variants: variants(['fabric-boucle-oat', 'fabric-boucle-charcoal'], ['wood-oak-light']),
  }),
  stool({
    id: 'channel-back-corduroy-counter-stool',
    name: 'Channel-tufted camel corduroy counter stool',
    tags: [...COUNTER, 'channel tufted', 'corduroy', 'camel', 'retro', 'walnut', 'upholstered'],
    description: 'A counter stool whose curved back is stitched into plump vertical channels of camel corduroy, sloping down to the sides over a thick round seat on walnut legs.',
    price: 3_800_000,
    cfg: { seat: ROUND, back: { path: 'arc', wrap: 110, rise: 0.29, end: 0.18, style: 'channel', t: 0.065 } },
    seat: 0.65,
    uph: 'fabric-corduroy-camel',
    wood: 'wood-walnut',
    variants: variants(['fabric-corduroy-olive', 'fabric-boucle-oat', 'fabric-velvet-rust'], ['wood-oak-light']),
  }),
  stool({
    id: 'oak-rimmed-boucle-shell-counter-stool',
    name: 'Oak-rimmed bouclé shell counter stool',
    tags: [...COUNTER, 'bouclé', 'oak frame', 'shell back', 'wood trim', 'upholstered', 'scandinavian'],
    description: 'An oat bouclé barrel shell finished with a rounded solid-oak rim along its top and front edges, over a padded round seat on matching white-oak legs.',
    price: 3_900_000,
    cfg: { seat: ROUND, back: { path: 'arc', wrap: 115, rise: 0.27, style: 'woodRim' } },
    seat: 0.65,
    uph: 'fabric-boucle-oat',
    wood: 'wood-white-oak',
    variants: variants(['fabric-boucle', 'fabric-linen', 'fabric-boucle-charcoal'], ['wood-walnut', 'wood-smoked-oak']),
  }),
  stool({
    id: 'low-arm-linen-scoop-counter-stool',
    name: 'Low-arm textured linen counter stool',
    tags: [...COUNTER, 'low arms', 'armchair stool', 'linen', 'sage', 'oak', 'upholstered'],
    description: 'A deep counter stool whose sage linen shell sweeps forward into low padded arms, wrapping a thick round seat on light-oak legs with staggered footrests.',
    price: 4_100_000,
    cfg: { seat: ROUND, back: { path: 'arc', wrap: 150, rise: 0.26, end: 0.12, t: 0.065 }, rails: 'stagger' },
    seat: 0.65,
    w: 0.52,
    d: 0.52,
    uph: 'fabric-linen-sage',
    wood: 'wood-oak-light',
    variants: variants(['fabric-linen', 'fabric-linen-indigo', 'fabric-boucle'], ['wood-walnut']),
  }),
  stool({
    id: 'cognac-leather-barrel-counter-stool',
    name: 'Cognac leather barrel counter stool, walnut legs',
    tags: [...COUNTER, 'leather', 'cognac', 'barrel back', 'walnut', 'mid-century', 'ghế bar da'],
    description: 'A barrel-back counter stool upholstered in cognac leather, the rolled shell running seamlessly into a padded round seat, on tapered walnut legs with a footrest ring.',
    price: 5_400_000,
    cfg: { seat: ROUND, back: { path: 'arc', wrap: 125, rise: 0.27 } },
    seat: 0.65,
    uph: 'leather-cognac',
    wood: 'wood-walnut',
    variants: variants(['leather-tan', 'leather-chocolate', 'leather-black'], ['wood-oak-light']),
  }),
  stool({
    id: 'black-leather-scoop-bar-stool',
    name: 'Black leather scoop bar stool, smoked oak legs',
    tags: [...BAR, 'leather', 'black', 'scoop back', 'smoked oak', 'upholstered', 'ghế bar da'],
    description: 'A bar stool with a scooped black leather back that slopes down to the sides around a thick round seat, on smoked-oak legs with a footrest ring and raised side rails.',
    price: 5_600_000,
    cfg: { seat: ROUND, back: { path: 'arc', wrap: 95, rise: 0.25, end: 0.14 }, rails: 'double' },
    seat: 0.75,
    uph: 'leather-black',
    wood: 'wood-smoked-oak',
    variants: variants(['leather-cognac', 'leather-grey', 'leather-olive'], ['wood-walnut']),
  }),
  stool({
    id: 'performance-weave-shell-counter-stool',
    name: 'Stain-resistant stone-weave shell counter stool',
    tags: [...COUNTER, 'performance fabric', 'stain resistant', 'easy clean', 'shell back', 'oak', 'family kitchen'],
    description: 'A family-proof shell counter stool in a stone-coloured performance weave that wipes clean, with a gently sloping back and a deep round seat on light-oak legs.',
    price: 3_000_000,
    cfg: { seat: ROUND, back: { path: 'arc', wrap: 110, rise: 0.28, end: 0.2 } },
    seat: 0.65,
    uph: 'fabric-stone',
    wood: 'wood-oak-light',
    variants: variants(['fabric-dove-grey', 'fabric-herringbone-grey', 'fabric-linen-charcoal'], ['wood-smoked-oak']),
  }),
  stool({
    id: 'teddy-barrel-counter-stool-white-oak',
    name: 'Cream teddy barrel counter stool, white oak legs',
    tags: [...COUNTER, 'teddy', 'sherpa', 'barrel back', 'cosy', 'white oak', 'upholstered'],
    description: 'A plush barrel counter stool covered in cream teddy fleece, its thick shell curling round a padded round seat, on white-oak legs with a footrest ring.',
    price: 3_500_000,
    cfg: { seat: ROUND, back: { path: 'arc', wrap: 130, rise: 0.26, t: 0.07 } },
    seat: 0.65,
    uph: 'fabric-teddy-cream',
    wood: 'wood-white-oak',
    variants: variants(['fabric-boucle-oat', 'fabric-boucle-camel'], ['wood-walnut']),
  }),
  stool({
    id: 'rust-velvet-scoop-counter-stool-walnut',
    name: 'Rust velvet scoop counter stool, walnut legs',
    tags: [...COUNTER, 'velvet', 'rust', 'terracotta', 'scoop back', 'walnut', 'upholstered'],
    description: 'A rust velvet counter stool with a scooped back that slopes into the sides of a thick round seat, on tapered walnut legs with staggered footrests.',
    price: 3_700_000,
    cfg: { seat: ROUND, back: { path: 'arc', wrap: 100, rise: 0.25, end: 0.14 }, rails: 'stagger' },
    seat: 0.65,
    uph: 'fabric-velvet-rust',
    wood: 'wood-walnut',
    variants: variants(['fabric-velvet-oat', 'fabric-velvet-sage', 'fabric-velvet-chocolate'], ['wood-oak-light']),
  }),
  stool({
    id: 'deep-wrap-corduroy-tub-bar-stool',
    name: 'Deep-wrap tub bar stool, olive corduroy',
    tags: [...BAR, 'tub chair', 'corduroy', 'olive', 'deep seat', 'smoked oak', 'upholstered'],
    description: 'A roomy bar stool whose thick olive corduroy tub wraps almost all the way round a deep round seat, on smoked-oak legs with a footrest ring and raised side rails.',
    price: 4_500_000,
    cfg: { seat: ROUND, back: { path: 'arc', wrap: 140, rise: 0.27, t: 0.075 }, rails: 'double', legR: [0.013, 0.019] },
    seat: 0.75,
    w: 0.54,
    d: 0.54,
    uph: 'fabric-corduroy-olive',
    wood: 'wood-smoked-oak',
    variants: variants(['fabric-corduroy-camel', 'fabric-boucle-oat'], ['wood-oak-light']),
  }),
  stool({
    id: 'piped-boucle-shell-counter-stool',
    name: 'Piped bouclé shell counter stool with leather welt',
    tags: [...COUNTER, 'bouclé', 'piping', 'leather trim', 'shell back', 'walnut', 'tailored'],
    description: 'A cream bouclé shell counter stool with a sloping back and a round seat edged in a thin cognac leather welt, on tapered walnut legs.',
    price: 4_000_000,
    cfg: { seat: ROUND, back: { path: 'arc', wrap: 110, rise: 0.27, end: 0.18 }, piping: true },
    seat: 0.65,
    uph: 'fabric-boucle',
    wood: 'wood-walnut',
    accent: 'leather-cognac',
    variants: variants(['fabric-boucle-oat', 'fabric-boucle-grey'], ['wood-oak-light'], [
      { id: 'black-welt', name: 'Black leather welt', materials: { accent: 'leather-black' } },
    ]),
  }),
  stool({
    id: 'brass-kick-scoop-bar-stool',
    name: 'Scoop-back bar stool with brass kick plate',
    tags: [...BAR, 'bouclé', 'camel', 'brass', 'kick plate', 'scoop back', 'walnut'],
    description: 'A camel bouclé bar stool with a scooped back sloping round a thick round seat, on walnut legs whose front footrest is sleeved in a brushed-brass kick plate.',
    price: 4_300_000,
    cfg: { seat: ROUND, back: { path: 'arc', wrap: 90, rise: 0.25, end: 0.15 }, rails: 'double', kick: true },
    seat: 0.75,
    uph: 'fabric-boucle-camel',
    wood: 'wood-walnut',
    metal: 'metal-brass',
    variants: variants(['fabric-boucle', 'fabric-boucle-rust'], ['wood-oak-light'], [
      { id: 'steel-kick', name: 'Brushed steel kick plate', materials: { metal: 'metal-brushed-steel' } },
    ]),
  }),
  stool({
    id: 'low-backrest-boucle-counter-stool-oak',
    name: 'Low-backrest bouclé counter stool, oak legs',
    tags: [...COUNTER, 'low back', 'backrest', 'bouclé', 'grey', 'compact', 'oak'],
    description: 'A compact counter stool with a short curved bouclé backrest at the rear of a thick round seat, so it tucks under the counter, on light-oak legs with a footrest ring.',
    price: 2_700_000,
    cfg: { seat: ROUND, back: { path: 'arc', wrap: 50, rise: 0.18 } },
    seat: 0.65,
    w: 0.48,
    d: 0.48,
    uph: 'fabric-boucle-grey',
    wood: 'wood-oak-light',
    variants: variants(['fabric-boucle', 'fabric-boucle-sage'], ['wood-walnut']),
  }),
  stool({
    id: 'square-leg-shell-counter-stool-smoked-oak',
    name: 'Square-leg shell counter stool, smoked oak',
    tags: [...COUNTER, 'square legs', 'shell back', 'dove grey', 'smoked oak', 'upholstered', 'minimal'],
    description: 'A dove-grey shell counter stool with a back that slopes to the sides, set on four splayed square-section smoked-oak legs with round footrest stretchers.',
    price: 3_400_000,
    cfg: { seat: ROUND, back: { path: 'arc', wrap: 115, rise: 0.28, end: 0.18 }, legs: 'square' },
    seat: 0.65,
    uph: 'fabric-dove-grey',
    wood: 'wood-smoked-oak',
    variants: variants(['fabric-boucle-oat', 'fabric-linen-charcoal'], ['wood-white-oak']),
  }),
  stool({
    id: 'rounded-bucket-linen-bar-stool',
    name: 'Rounded-square bucket bar stool, sage linen',
    tags: [...BAR, 'bucket seat', 'linen', 'sage', 'rounded square', 'oak', 'upholstered'],
    description: 'A bar stool with a rounded-square bucket of sage linen that wraps deep round the sides of a thick square seat, on light-oak legs with a footrest ring.',
    price: 4_000_000,
    cfg: { seat: 'square', back: { path: 'square', ret: 0.55, corner: 0.13, rise: 0.27, t: 0.065 } },
    seat: 0.75,
    w: 0.5,
    d: 0.5,
    uph: 'fabric-linen-sage',
    wood: 'wood-oak-light',
    variants: variants(['fabric-linen', 'fabric-boucle-oat', 'fabric-linen-indigo'], ['wood-walnut']),
  }),
  stool({
    id: 'square-back-tan-leather-bar-stool',
    name: 'Soft square-back tan leather bar stool',
    tags: [...BAR, 'leather', 'tan', 'square back', 'smoked oak', 'upholstered', 'ghế bar da'],
    description: 'A tan leather bar stool with a soft U-shaped back that steps down at the sides into a thick square seat, on smoked-oak legs with a footrest ring and raised side rails.',
    price: 5_800_000,
    cfg: { seat: 'square', back: { path: 'square', ret: 0.3, corner: 0.08, rise: 0.3, end: 0.22 }, rails: 'double' },
    seat: 0.75,
    w: 0.48,
    d: 0.5,
    uph: 'leather-tan',
    wood: 'wood-smoked-oak',
    variants: variants(['leather-cognac', 'leather-chocolate', 'leather-black'], ['wood-walnut']),
  }),
  stool({
    id: 'button-tufted-velvet-shell-bar-stool',
    name: 'Button-tufted velvet shell bar stool',
    tags: [...BAR, 'velvet', 'button tufted', 'sage', 'shell back', 'walnut', 'upholstered'],
    description: 'A sage velvet barrel shell with two rows of covered buttons on its inside face, wrapping a deep round seat on walnut legs with a footrest ring and raised side rails.',
    price: 4_400_000,
    cfg: { seat: ROUND, back: { path: 'arc', wrap: 115, rise: 0.3, style: 'buttons' }, rails: 'double' },
    seat: 0.75,
    uph: 'fabric-velvet-sage',
    wood: 'wood-walnut',
    variants: variants(['fabric-velvet-oat', 'fabric-velvet-rust', 'fabric-boucle'], ['wood-oak-light']),
  }),
  stool({
    id: 'oak-veneer-shell-boucle-counter-stool',
    name: 'Oak-veneer shell counter stool with bouclé pad',
    tags: [...COUNTER, 'bent plywood', 'oak veneer', 'shell chair', 'bouclé', 'scandinavian', 'upholstered'],
    description: 'A moulded oak-veneer shell that curves round the seat and slopes to the sides, lined with a cream bouclé pad that continues into a thick round cushion, on light-oak legs.',
    price: 4_200_000,
    cfg: { seat: ROUND, back: { path: 'arc', wrap: 115, rise: 0.28, end: 0.2, style: 'woodShell', t: 0.05 } },
    seat: 0.65,
    uph: 'fabric-boucle',
    wood: 'wood-oak-light',
    variants: variants(['fabric-boucle-oat', 'fabric-boucle-charcoal', 'leather-cognac'], ['wood-walnut']),
  }),
  stool({
    id: 'walnut-rimmed-leather-shell-bar-stool',
    name: 'Walnut-rimmed leather shell bar stool',
    tags: [...BAR, 'leather', 'chocolate', 'walnut frame', 'shell back', 'wood trim', 'ghế bar da'],
    description: 'A chocolate leather barrel shell framed by a rounded walnut rim along its top and front edges, over a padded round seat on walnut legs with a footrest ring and raised side rails.',
    price: 6_200_000,
    cfg: { seat: ROUND, back: { path: 'arc', wrap: 110, rise: 0.28, style: 'woodRim' }, rails: 'double' },
    seat: 0.75,
    uph: 'leather-chocolate',
    wood: 'wood-walnut',
    variants: variants(['leather-cognac', 'leather-black', 'leather-tan'], ['wood-oak-light']),
  }),

  // ── Swivel versions ─────────────────────────────────────────────────────────

  stool({
    id: 'swivel-boucle-barrel-counter-stool-oak-base',
    name: 'Swivel bouclé barrel counter stool on oak base',
    tags: [...COUNTER, 'swivel', 'bouclé', 'barrel back', 'oak', 'upholstered', 'ghế bar xoay'],
    description: 'A cream bouclé barrel counter stool that turns on a black steel swivel plate set into a square light-oak base with four tapered legs and a footrest ring.',
    price: 4_600_000,
    cfg: { seat: ROUND, back: { path: 'arc', wrap: 125, rise: 0.27 }, base: 'swivel' },
    seat: 0.65,
    uph: 'fabric-boucle',
    wood: 'wood-oak-light',
    metal: 'metal-black-matte',
    variants: variants(['fabric-boucle-oat', 'fabric-boucle-grey'], ['wood-walnut']),
  }),
  stool({
    id: 'swivel-linen-scoop-bar-stool-walnut-base',
    name: 'Swivel linen scoop bar stool on walnut base',
    tags: [...BAR, 'swivel', 'linen', 'scoop back', 'walnut', 'upholstered', 'ghế bar xoay'],
    description: 'A charcoal linen bar stool with a low scooped back, turning on a swivel plate over a walnut four-leg base with staggered footrests.',
    price: 4_700_000,
    cfg: { seat: ROUND, back: { path: 'arc', wrap: 85, rise: 0.24, end: 0.13 }, base: 'swivel', rails: 'stagger' },
    seat: 0.75,
    uph: 'fabric-linen-charcoal',
    wood: 'wood-walnut',
    metal: 'metal-black-matte',
    variants: variants(['fabric-linen', 'fabric-linen-sage'], ['wood-oak-light']),
  }),
  stool({
    id: 'swivel-channel-back-bar-stool-oak-base',
    name: 'Swivel channel-back bar stool on oak base',
    tags: [...BAR, 'swivel', 'channel tufted', 'bouclé', 'oak', 'upholstered', 'ghế bar xoay'],
    description: 'An oat bouclé bar stool with a channel-stitched sloping back, swivelling on a steel plate above a white-oak base with a footrest ring and raised side rails.',
    price: 5_200_000,
    cfg: { seat: ROUND, back: { path: 'arc', wrap: 115, rise: 0.3, end: 0.2, style: 'channel' }, base: 'swivel', rails: 'double' },
    seat: 0.75,
    uph: 'fabric-boucle-oat',
    wood: 'wood-white-oak',
    metal: 'metal-black-matte',
    variants: variants(['fabric-boucle-charcoal', 'fabric-corduroy-camel'], ['wood-walnut']),
  }),
  stool({
    id: 'swivel-tan-leather-pedestal-bar-stool',
    name: 'Swivel tan leather bar stool on a round pedestal',
    tags: [...BAR, 'swivel', 'pedestal', 'leather', 'tan', 'footring', 'ghế bar xoay'],
    description: 'A tan leather shell bar stool with a sloping back on a walnut seat board, swivelling on a black steel pedestal with a round weighted base and a footring.',
    price: 6_500_000,
    cfg: { seat: ROUND, back: { path: 'arc', wrap: 110, rise: 0.26, end: 0.16 }, base: 'pedestal' },
    seat: 0.75,
    uph: 'leather-tan',
    wood: 'wood-walnut',
    metal: 'metal-black-matte',
    variants: variants(['leather-cognac', 'leather-black'], [], [
      { id: 'brass-pedestal', name: 'Brass pedestal', materials: { metal: 'metal-brass' } },
    ]),
  }),
  stool({
    id: 'swivel-boucle-tub-pedestal-counter-stool',
    name: 'Swivel bouclé tub counter stool, brass pedestal',
    tags: [...COUNTER, 'swivel', 'pedestal', 'tub chair', 'bouclé', 'brass', 'ghế bar xoay'],
    description: 'A cream bouclé tub that wraps deep round its round seat, on a light-oak seat board and a brushed-brass swivel pedestal with a round base and footring.',
    price: 5_900_000,
    cfg: { seat: ROUND, back: { path: 'arc', wrap: 135, rise: 0.24, t: 0.07 }, base: 'pedestal' },
    seat: 0.65,
    uph: 'fabric-boucle',
    wood: 'wood-oak-light',
    metal: 'metal-brass',
    variants: variants(['fabric-boucle-oat', 'fabric-boucle-sage'], [], [
      { id: 'black-pedestal', name: 'Black pedestal', materials: { metal: 'metal-black-matte' } },
    ]),
  }),
  stool({
    id: 'swivel-square-back-pedestal-counter-stool',
    name: 'Swivel square-back counter stool on black pedestal',
    tags: [...COUNTER, 'swivel', 'pedestal', 'square back', 'herringbone', 'footring', 'ghế bar xoay'],
    description: 'A grey herringbone counter stool with a soft U-shaped back and a thick square seat on an oak board, swivelling on a black pedestal with a footring.',
    price: 5_200_000,
    cfg: { seat: 'square', back: { path: 'square', ret: 0.3, corner: 0.08, rise: 0.28, end: 0.2 }, base: 'pedestal' },
    seat: 0.65,
    w: 0.48,
    d: 0.5,
    uph: 'fabric-herringbone-grey',
    wood: 'wood-oak-light',
    metal: 'metal-black-matte',
    variants: variants(['fabric-stone', 'fabric-boucle-oat'], ['wood-walnut']),
  }),

  // ── Cane and slatted backs ──────────────────────────────────────────────────

  stool({
    id: 'cane-back-linen-counter-stool-oak',
    name: 'Cane-back counter stool with linen seat, oak frame',
    tags: [...COUNTER, 'cane', 'rattan', 'mây đan', 'ghế mây', 'linen', 'oak'],
    description: 'A curved panel of natural cane webbing in a light-oak frame forms the back of this counter stool, over a thick upholstered linen seat on tapered oak legs.',
    price: 3_700_000,
    cfg: { seat: ROUND, back: { path: 'arc', wrap: 105, rise: 0.3, style: 'cane' } },
    seat: 0.65,
    uph: 'fabric-linen',
    wood: 'wood-oak-light',
    accent: 'cane-natural',
    variants: variants(['fabric-boucle', 'fabric-linen-sage'], ['wood-walnut']),
  }),
  stool({
    id: 'black-cane-back-bar-stool-walnut',
    name: 'Black cane-back bar stool, walnut frame',
    tags: [...BAR, 'cane', 'black cane', 'mây đan', 'walnut', 'bouclé', 'upholstered seat'],
    description: 'A bar stool with a sloping curved back of black cane webbing in a walnut frame, over a thick charcoal bouclé seat, with a footrest ring and raised side rails.',
    price: 4_100_000,
    cfg: { seat: ROUND, back: { path: 'arc', wrap: 95, rise: 0.28, end: 0.2, style: 'cane' }, rails: 'double' },
    seat: 0.75,
    uph: 'fabric-boucle-charcoal',
    wood: 'wood-walnut',
    accent: 'cane-black',
    variants: variants(['fabric-boucle-oat', 'leather-cognac'], [], [
      { id: 'natural-cane', name: 'Natural cane', materials: { accent: 'cane-natural' } },
    ]),
  }),
  stool({
    id: 'oak-slatted-back-counter-stool',
    name: 'Oak slatted-back counter stool with seat cushion',
    tags: [...COUNTER, 'slatted back', 'solid oak', 'spindle back', 'cushion', 'scandinavian', 'ghế gỗ sồi'],
    description: 'A solid white-oak counter stool with a curved top rail on vertical slats, a thick round linen seat cushion and splayed tapered legs with a footrest ring.',
    price: 2_900_000,
    cfg: { seat: ROUND, back: { path: 'arc', wrap: 100, rise: 0.3, style: 'slats' } },
    seat: 0.65,
    uph: 'fabric-linen',
    wood: 'wood-white-oak',
    variants: variants(['fabric-boucle-oat', 'fabric-linen-charcoal'], ['wood-walnut', 'wood-smoked-oak']),
  }),
  stool({
    id: 'walnut-slat-back-bar-stool',
    name: 'Walnut slat-back bar stool with square cushion',
    tags: [...BAR, 'slatted back', 'walnut', 'square seat', 'cushion', 'japandi', 'ghế gỗ óc chó'],
    description: 'A walnut bar stool with a softly squared back of vertical slats under a wide top rail, a thick square rust-linen cushion and staggered footrests.',
    price: 3_300_000,
    cfg: { seat: 'square', back: { path: 'square', ret: 0.25, corner: 0.05, rise: 0.3, style: 'slats' }, rails: 'stagger' },
    seat: 0.75,
    w: 0.46,
    d: 0.48,
    uph: 'fabric-linen-rust',
    wood: 'wood-walnut',
    variants: variants(['fabric-linen', 'fabric-stone'], ['wood-white-oak']),
  }),

  // ── Backless padded stools ──────────────────────────────────────────────────

  stool({
    id: 'backless-round-boucle-counter-stool-oak',
    name: 'Backless round bouclé counter stool, oak frame',
    tags: [...COUNTER, 'backless', 'round seat', 'bouclé', 'oak', 'tuck under', 'ghế đôn bọc nệm'],
    description: 'A backless counter stool with a thick round cream bouclé cushion on a thin oak seat board, four splayed tapered oak legs and a square footrest ring.',
    price: 1_900_000,
    cfg: { seat: ROUND, seatT: 0.09 },
    seat: 0.65,
    w: 0.44,
    d: 0.44,
    uph: 'fabric-boucle',
    wood: 'wood-oak-light',
    variants: variants(['fabric-boucle-oat', 'fabric-boucle-sage', 'fabric-boucle-charcoal'], ['wood-walnut']),
  }),
  stool({
    id: 'backless-round-leather-bar-stool-walnut',
    name: 'Backless round leather bar stool, walnut frame',
    tags: [...BAR, 'backless', 'round seat', 'leather', 'cognac', 'walnut', 'ghế bar da'],
    description: 'A backless bar stool with a padded round cognac leather seat on a walnut board and four tapered walnut legs with a footrest ring and raised side rails.',
    price: 2_800_000,
    cfg: { seat: ROUND, seatT: 0.08, rails: 'double' },
    seat: 0.75,
    w: 0.44,
    d: 0.44,
    uph: 'leather-cognac',
    wood: 'wood-walnut',
    variants: variants(['leather-black', 'leather-tan'], ['wood-oak-light']),
  }),
  stool({
    id: 'backless-square-linen-counter-stool-walnut',
    name: 'Backless square linen counter stool, walnut frame',
    tags: [...COUNTER, 'backless', 'square seat', 'linen', 'walnut', 'padded', 'minimal'],
    description: 'A square padded counter stool in charcoal linen on a walnut seat board, with four slightly splayed walnut legs and staggered footrests.',
    price: 1_800_000,
    cfg: { seat: 'square', seatT: 0.09, rails: 'stagger' },
    seat: 0.65,
    w: 0.42,
    d: 0.42,
    uph: 'fabric-linen-charcoal',
    wood: 'wood-walnut',
    variants: variants(['fabric-linen', 'fabric-boucle-oat'], ['wood-oak-light']),
  }),
  stool({
    id: 'leather-saddle-bar-stool-oak',
    name: 'Padded leather saddle bar stool, oak frame',
    tags: [...BAR, 'saddle seat', 'leather', 'cognac', 'backless', 'brass kick plate', 'oak'],
    description: 'A backless bar stool with a padded cognac leather saddle seat raised front and back, on white-oak legs with a brass-sleeved front footrest.',
    price: 3_100_000,
    cfg: { seat: 'saddle', seatT: 0.085, kick: true },
    seat: 0.75,
    w: 0.46,
    d: 0.42,
    uph: 'leather-cognac',
    wood: 'wood-white-oak',
    metal: 'metal-brass',
    variants: variants(['leather-tan', 'leather-black'], ['wood-walnut']),
  }),
  stool({
    id: 'herringbone-saddle-counter-stool-oak',
    name: 'Herringbone saddle counter stool, oak frame',
    tags: [...COUNTER, 'saddle seat', 'herringbone', 'wool', 'backless', 'oak', 'padded'],
    description: 'A backless counter stool with a padded saddle seat in grey herringbone wool, raised at the front and back, on light-oak legs with a footrest ring.',
    price: 2_100_000,
    cfg: { seat: 'saddle', seatT: 0.08 },
    seat: 0.65,
    w: 0.46,
    d: 0.42,
    uph: 'fabric-herringbone-grey',
    wood: 'wood-oak-light',
    variants: variants(['fabric-stone', 'fabric-boucle-oat'], ['wood-smoked-oak']),
  }),
  stool({
    id: 'backless-swivel-boucle-pedestal-stool',
    name: 'Backless swivel bouclé counter stool on pedestal',
    tags: [...COUNTER, 'swivel', 'pedestal', 'backless', 'bouclé', 'sage', 'ghế bar xoay'],
    description: 'A thick round sage bouclé cushion on an oak seat board that swivels on a black steel pedestal with a weighted round base and a footring.',
    price: 2_600_000,
    cfg: { seat: ROUND, seatT: 0.09, base: 'pedestal' },
    seat: 0.65,
    w: 0.44,
    d: 0.44,
    uph: 'fabric-boucle-sage',
    wood: 'wood-oak-light',
    metal: 'metal-black-matte',
    variants: variants(['fabric-boucle', 'fabric-boucle-charcoal'], [], [
      { id: 'brass-pedestal', name: 'Brass pedestal', materials: { metal: 'metal-brass' } },
    ]),
  }),
];

export default definePack({
  name: 'Upholstered counter stools',
  version: '1.0.0',
  author: 'Neest team',
  description:
    'Modern-organic upholstered counter and bar stools (ghế quầy bar): bouclé, linen, herringbone, corduroy, velvet, teddy and leather shell, scoop, half-moon, wingback, square, channel-tufted, buttoned, oak-rimmed, veneer, cane and slatted backs on slender splayed oak or walnut legs with footrest rings, plus swivel, pedestal and backless saddle versions.',
  license: 'CC0 (made for Neest)',
  items,
});
